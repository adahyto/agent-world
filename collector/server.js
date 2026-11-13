#!/usr/bin/env node
// Agent World collector — Etap 1.5 + konta (etap 1: właściciel, etap 2: tokeny i zdarzenia z cudzych komputerów).
// Receives Claude Code hook events, keeps agent state in memory (persisted to ~/.agent-world/state.json),
// pushes changes over SSE (/stream), serves the pixel world from ../web and a plain table at /table.
// No dependencies. Run: node server.js

const http = require('http');
const https = require('https');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 7777);
const HOST = process.env.HOST || '127.0.0.1'; // keep it local; put a reverse proxy + auth in front if exposing
const MAX_EVENTS = 1500;      // per owner
const MAX_HISTORY = 3000;     // per owner, on top of the 24 h window
const WEB_DIR = path.join(__dirname, '..', 'web');
const STATE_FILE = process.env.AGENT_WORLD_STATE || path.join(os.homedir(), '.agent-world', 'state.json');
// Tokens of the hooks on other people's computers (only SHA-256 hashes are stored).
const TOKENS_FILE = process.env.AGENT_WORLD_TOKENS || path.join(path.dirname(STATE_FILE), 'tokens.json');
const MAX_TOKENS = 5;               // per owner (laptop, server, …)
const MAX_INGEST_BYTES = 256 * 1024; // one hook event
const INGEST_PER_MIN = 300;         // per token
const MAX_REMOTE_AGENTS = 40;       // live sessions + subagents per remote owner
// Public address of this site, put into the connect script (hooks post to PUBLIC_URL/ingest).
const PUBLIC_URL = (process.env.AGENT_WORLD_PUBLIC_URL || 'https://dziki.doner.cloud').replace(/\/+$/, '');
const CONNECT_SCRIPT = path.join(__dirname, '..', 'hooks', 'podlacz.sh');
// Cloudflare Access: requests that come through Apache carry X-Agent-World-Edge and must bring a valid
// Cf-Access-Jwt-Assertion for this application (team domain + AUD from the Access app). Hooks post locally without it.
const ACCESS_TEAM = process.env.AGENT_WORLD_ACCESS_TEAM || ''; // e.g. "mojazespol" for mojazespol.cloudflareaccess.com
const ACCESS_AUD = process.env.AGENT_WORLD_ACCESS_AUD || '';
// Only for tests: where to fetch the Access signing keys (default: the team's cloudflareaccess.com certs).
const ACCESS_CERTS_URL = process.env.AGENT_WORLD_ACCESS_CERTS_URL || `https://${ACCESS_TEAM}.cloudflareaccess.com/cdn-cgi/access/certs`;
// Every agent, event and timeline entry belongs to one owner (an e-mail). Hooks on this server post
// locally and belong to the server owner; viewers from the edge see only what belongs to their Access e-mail.
// Unset = local data belongs to "local", which is not an e-mail, so no edge viewer sees it (fail closed).
const OWNER = normEmail(process.env.AGENT_WORLD_OWNER || '') || 'local';
function normEmail(e) { return String(e || '').trim().toLowerCase(); }

/** @type {Map<string, Agent>} */
const agents = new Map();
const eventsBy = new Map(); // owner -> ring buffer of normalized events
const historyBy = new Map(); // owner -> status changes for the timeline: { ts, agentId, name, kind, status, waitingFor, tool }, last 24 h
const listOf = (m, owner) => { let l = m.get(owner); if (!l) m.set(owner, (l = [])); return l; };
function addEvent(e) { const l = listOf(eventsBy, e.owner); l.push(e); if (l.length > MAX_EVENTS) l.shift(); }
function addHistory(h) { const l = listOf(historyBy, h.owner); l.push(h); if (l.length > MAX_HISTORY) l.shift(); }
const HISTORY_MS = 24 * 60 * 60 * 1000;
const transcripts = new Map(); // agentId -> transcript_path (kept out of /agents; only read by /transcript)

// ---- event normalization ---------------------------------------------------

function nameFor(ev, projectDir) {
  if (ev.session_title) return ev.session_title;
  const dir = projectDir || ev.cwd || '';
  return dir ? path.basename(dir) : ev.session_id?.slice(0, 8) || 'agent';
}

function getOrCreate(id, ev, projectDir, owner, extra = {}) {
  let a = agents.get(id);
  if (!a) {
    a = {
      id,
      owner,                     // e-mail of the person whose Claude Code this is
      name: nameFor(ev, projectDir),
      project: projectDir || ev.cwd || null,
      parentId: null,
      kind: 'session',           // 'session' | 'subagent'
      sid: id.slice(0, 4),       // short id, to tell apart sessions with the same name
      model: null,               // from SessionStart only (null for sessions caught mid-way and for subagents)
      status: 'idle',            // idle | thinking | tool | waiting_for_user | done | error
      waitingFor: null,          // when waiting_for_user: permission | question | input
      currentTool: null,
      lastMessage: null,
      lastPrompt: null,          // last user prompt (truncated)
      since: Date.now(),         // when the current status began
      startedAt: Date.now(),
      updatedAt: Date.now(),
      toolCalls: 0,
      ...extra,
    };
    agents.set(id, a);
  }
  return a;
}

function truncate(s, n = 200) {
  if (!s) return null;
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function describeTool(ev) {
  const t = ev.tool_name || '?';
  const i = ev.tool_input || {};
  const detail = i.command || i.file_path || i.pattern || i.query || i.url || i.description || '';
  return detail ? `${t}: ${truncate(detail, 80)}` : t;
}

// Tools that block on the human, so the agent is waiting rather than working.
const WAITING_TOOLS = { AskUserQuestion: 'question', ExitPlanMode: 'permission' };

// In-flight tool calls per agent, keyed by tool_use_id. Hooks run async, so parallel
// calls overlap and a fast tool's PostToolUse can arrive before its PreToolUse.
const toolRuns = new Map(); // agentId -> { active: Map<toolUseId, toolName>, finished: Set<toolUseId> }

function runsFor(id) {
  let r = toolRuns.get(id);
  if (!r) toolRuns.set(id, (r = { active: new Map(), finished: new Set() }));
  return r;
}

function finishTool(a, ev) {
  const r = runsFor(a.id);
  r.active.delete(ev.tool_use_id);
  r.finished.add(ev.tool_use_id);
  if (r.finished.size > 200) r.finished.clear();
  const still = [...r.active.values()];
  a.status = still.length ? 'tool' : 'thinking';
  a.currentTool = still.at(-1) || null;
}

function endTurn(a, status) {
  runsFor(a.id).active.clear();
  a.status = status;
  a.currentTool = null;
}

function applyEvent(ev, projectDir, owner) {
  const type = ev.hook_event_name;
  const sid = ev.session_id;
  if (!type || !sid || !owner) return null;
  // Session ids are random UUIDs; one that already belongs to someone else is refused, never merged.
  for (const k of [sid, ev.agent_id]) { const x = k && agents.get(k); if (x && x.owner !== owner) return null; }

  // Subagent events: the agent is ev.agent_id, parent is the session.
  const isSub = Boolean(ev.agent_id);
  // Claude Code also runs internal helper agents (prompt suggestions, summaries): they send
  // only SubagentStop, with an empty agent_type and no SubagentStart. Not real subagents.
  if (isSub && !ev.agent_type && !agents.has(ev.agent_id)) return null;
  const id = isSub ? ev.agent_id : sid;
  const a = getOrCreate(id, ev, projectDir, owner, isSub
    ? { parentId: sid, kind: 'subagent', name: ev.agent_type || `sub-${ev.agent_id.slice(0, 6)}` }
    : {});
  if (isSub) getOrCreate(sid, ev, projectDir, owner); // make sure the parent exists too
  if (ev.agent_transcript_path && isSub) transcripts.set(id, ev.agent_transcript_path);
  else if (ev.transcript_path && !transcripts.has(id)) transcripts.set(id, ev.transcript_path);

  let summary = type;
  switch (type) {
    case 'SessionStart':
      a.status = 'idle';
      a.name = nameFor(ev, projectDir);
      if (ev.model) a.model = ev.model;
      summary = `session ${ev.source || 'start'}`;
      break;
    case 'UserPromptSubmit':
      endTurn(a, 'thinking');
      // Results of background subagents come back as a synthetic prompt.
      if (/^<task-notification>/.test(ev.prompt || '')) summary = 'background task result';
      else { a.lastPrompt = truncate(ev.prompt, 300); summary = `prompt: ${truncate(ev.prompt, 80)}`; }
      break;
    case 'PreToolUse': {
      a.toolCalls += 1;
      summary = describeTool(ev);
      const r = runsFor(id);
      if (r.finished.has(ev.tool_use_id)) break; // its PostToolUse already arrived
      r.active.set(ev.tool_use_id, ev.tool_name || '?');
      a.status = WAITING_TOOLS[ev.tool_name] ? 'waiting_for_user' : 'tool';
      a.waitingFor = WAITING_TOOLS[ev.tool_name] || null;
      a.currentTool = ev.tool_name || null;
      break;
    }
    case 'PermissionRequest':
      a.status = 'waiting_for_user';
      a.waitingFor = WAITING_TOOLS[ev.tool_name] || 'permission';
      summary = `permission: ${describeTool(ev)}`;
      break;
    case 'PostToolUse':
      finishTool(a, ev);
      summary = `done: ${ev.tool_name || '?'}`;
      break;
    case 'PostToolUseFailure':
      // Esc during a tool interrupts the whole turn, and no Stop follows.
      if (ev.is_interrupt) endTurn(a, 'idle');
      else finishTool(a, ev);
      summary = `${ev.is_interrupt ? 'interrupted' : 'failed'}: ${ev.tool_name || '?'}`;
      break;
    case 'PermissionDenied':
      finishTool(a, ev);
      summary = `denied: ${ev.tool_name || '?'}${ev.reason ? ` (${truncate(ev.reason, 60)})` : ''}`;
      break;
    case 'Notification': {
      const kind = ev.notification_type || '';
      // permission_prompt comes a few seconds late and can land after the tool already ran;
      // idle_prompt fires 60s after Stop.
      if (kind === 'permission_prompt' && a.status === 'tool') {
        a.status = 'waiting_for_user';
        a.waitingFor = 'permission';
      } else if (kind === 'idle_prompt' && a.status === 'idle') {
        a.status = 'waiting_for_user';
        a.waitingFor = 'input';
      } else if (kind === 'elicitation_dialog') {
        a.status = 'waiting_for_user';
        a.waitingFor = 'question';
      }
      summary = `notification: ${kind || truncate(ev.message, 80)}`;
      break;
    }
    case 'SubagentStart':
      a.status = 'thinking';
      summary = `subagent started (${ev.agent_type || '?'})`;
      break;
    case 'SubagentStop':
      endTurn(a, 'done');
      a.lastMessage = truncate(ev.last_assistant_message);
      summary = 'subagent finished';
      break;
    case 'Stop':
      endTurn(a, 'idle');
      a.lastMessage = truncate(ev.last_assistant_message);
      summary = `turn finished: ${truncate(ev.last_assistant_message, 80) || ''}`;
      break;
    case 'StopFailure': {
      endTurn(a, 'error');
      const err = typeof ev.error === 'string' ? ev.error : JSON.stringify(ev.error);
      a.lastMessage = truncate(err);
      summary = `turn failed: ${truncate(err, 80)}`;
      break;
    }
    case 'SessionEnd':
      endTurn(a, 'done');
      summary = `session ended (${ev.reason || '?'})`;
      break;
  }
  if (a.status !== 'waiting_for_user') a.waitingFor = null;
  a.updatedAt = Date.now();
  const sig = `${a.status}|${a.waitingFor || ''}|${a.currentTool || ''}`;
  if (a._sig !== sig) {
    a._sig = sig; a.since = a.updatedAt;
    addHistory({ ts: a.updatedAt, owner, agentId: id, name: a.name, kind: a.kind, status: a.status, waitingFor: a.waitingFor, tool: a.currentTool });
    pruneHistory();
  }

  const norm = { ts: a.updatedAt, owner, agentId: id, type, summary };
  addEvent(norm);
  broadcast(owner, { type: 'event', event: norm });
  scheduleSave();
  return norm;
}

function pruneHistory() {
  const cutoff = Date.now() - HISTORY_MS;
  for (const [o, l] of historyBy) {
    while (l.length && l[0].ts < cutoff) l.shift();
    if (!l.length) historyBy.delete(o);
  }
}

// ---- persistence: restart must not lose the board -----------------------------
let saveTimer = null;
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const data = JSON.stringify({ savedAt: Date.now(), agents: [...agents.values()], events: [...eventsBy.values()].flatMap((l) => l.slice(-500)), history: [...historyBy.values()].flat(), transcripts: [...transcripts] }, (k, v) => (k === '_sig' ? undefined : v));
    fs.mkdir(path.dirname(STATE_FILE), { recursive: true }, () => fs.writeFile(STATE_FILE + '.tmp', data, (e) => { if (!e) fs.rename(STATE_FILE + '.tmp', STATE_FILE, () => {}); }));
  }, 2000);
}
function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    // Before accounts there was no owner field: everything belonged to the server owner.
    for (const a of data.agents || []) agents.set(a.id, { sid: a.id.slice(0, 4), model: null, ...a, owner: a.owner || OWNER });
    for (const e of data.events || []) addEvent({ ...e, owner: e.owner || OWNER });
    for (const h of data.history || []) addHistory({ ...h, owner: h.owner || OWNER });
    for (const [id, p] of data.transcripts || []) transcripts.set(id, p);
    pruneHistory();
    console.log(`state restored: ${agents.size} agents, ${(data.events || []).length} events, ${eventsBy.size} owners (${new Date(data.savedAt).toLocaleString()})`);
  } catch (e) { if (e.code !== 'ENOENT') console.log('state not restored: ' + e.message); }
}
loadState();

// ---- per-owner views ----------------------------------------------------------------
// Internal fields never leave the collector (owner is known to the viewer anyway).
const OUT = (k, v) => (k === '_sig' || k === 'owner' ? undefined : v);
// transcript: whether the panel can show one (only sessions on this server have a JSONL here)
const agentsOf = (owner) => [...agents.values()].filter((a) => a.owner === owner).map((a) => ({ ...a, transcript: transcripts.has(a.id) }));

// ---- SSE: push every change to the browser of its owner ------------------------------
const clients = new Map(); // res -> owner
function broadcast(owner, msg) {
  if (!owner) return;
  const line = `data: ${JSON.stringify({ ...msg, agents: agentsOf(owner), now: Date.now() }, OUT)}\n\n`;
  for (const [res, o] of clients) if (o === owner) res.write(line);
}
setInterval(() => { for (const res of clients.keys()) res.write(': ping\n\n'); }, 20000);

// Forget finished agents after a while so the board doesn't fill up; a session that sent nothing for 24 h
// (closed terminal, no SessionEnd) goes too. Events older than 24 h and tokens unused for 90 days are deleted.
const TOKEN_IDLE_MS = 90 * 24 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now(), cutoff = now - 10 * 60 * 1000, stale = now - HISTORY_MS;
  for (const [o, l] of eventsBy) {
    while (l.length && l[0].ts < stale) l.shift();
    if (!l.length) eventsBy.delete(o);
  }
  pruneHistory();
  let tokGone = false;
  for (const [h, t] of tokens) if ((t.lastUsedAt || t.createdAt) < now - TOKEN_IDLE_MS) { tokens.delete(h); rate.delete(t.id); tokGone = true; }
  if (tokGone) saveTokens(true);
  for (const [id, a] of agents) {
    if ((a.status === 'done' && a.updatedAt < cutoff) || a.updatedAt < stale) {
      agents.delete(id);
      toolRuns.delete(id);
      transcripts.delete(id);
      addHistory({ ts: Date.now(), owner: a.owner, agentId: id, name: a.name, kind: a.kind, status: 'gone', waitingFor: null, tool: null });
      broadcast(a.owner, { type: 'event', event: { ts: Date.now(), agentId: id, type: 'Forget', summary: 'forgotten' } });
      scheduleSave();
    }
  }
}, 60 * 1000);

// ---- Cloudflare Access: JWT check for requests from the edge -----------------------
let certCache = { keys: [], at: 0 };
function accessCerts() {
  if (Date.now() - certCache.at < 60 * 60 * 1000 && certCache.keys.length) return Promise.resolve(certCache.keys);
  return new Promise((resolve) => {
    (ACCESS_CERTS_URL.startsWith('http:') ? http : https).get(ACCESS_CERTS_URL, { timeout: 5000 }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { try { certCache = { keys: JSON.parse(d).keys || [], at: Date.now() }; } catch (_) { /* keep old */ } resolve(certCache.keys); });
    }).on('error', () => resolve(certCache.keys));
  });
}
const b64u = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');
// Returns the verified, lower-cased e-mail of the viewer, or null.
async function accessEmail(req) {
  if (!ACCESS_TEAM || !ACCESS_AUD) return null; // fail closed: edge traffic without configured Access is refused
  const tok = req.headers['cf-access-jwt-assertion'];
  if (!tok) return null;
  const [h, p, sig] = String(tok).split('.');
  if (!h || !p || !sig) return null;
  let hdr, body;
  try { hdr = JSON.parse(b64u(h)); body = JSON.parse(b64u(p)); } catch (_) { return null; }
  if (hdr.alg !== 'RS256') return null;
  const now = Math.floor(Date.now() / 1000);
  const aud = Array.isArray(body.aud) ? body.aud : [body.aud];
  if (!aud.includes(ACCESS_AUD) || body.iss !== `https://${ACCESS_TEAM}.cloudflareaccess.com` || !(body.exp > now) || (body.nbf && body.nbf > now + 60)) return null;
  const email = normEmail(body.email);
  if (!email || !email.includes('@')) return null; // service tokens carry no e-mail: no owner, no data
  const jwk = (await accessCerts()).find((k) => k.kid === hdr.kid);
  if (!jwk) return null;
  try {
    const key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    return crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, b64u(sig)) ? email : null;
  } catch (_) { return null; }
}
const seenViewers = new Set(); // log each viewer once per run (as a short hash, the journal keeps no e-mails)
const who = (email) => (email === OWNER ? 'owner' : 'u-' + crypto.createHash('sha256').update(email).digest('hex').slice(0, 8));

// ---- transcript preview: last entries of the session's JSONL, text only, no tool results or file contents ----
const MAX_TRANSCRIPT_BYTES = 40 * 1024 * 1024;
function toolDetail(input) {
  const i = input || {};
  return truncate(i.command || i.file_path || i.pattern || i.query || i.url || i.description || i.prompt || '', 160);
}
function transcriptItems(file) {
  const st = fs.statSync(file);
  if (st.size > MAX_TRANSCRIPT_BYTES) throw new Error('transcript too large');
  const out = [];
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line) continue;
    let o;
    try { o = JSON.parse(line); } catch (_) { continue; }
    const c = o.message && o.message.content, ts = o.timestamp ? Date.parse(o.timestamp) : null;
    if (o.type === 'user' && typeof c === 'string') {
      if (o.isMeta || /^<task-notification>/.test(c)) continue;
      out.push({ ts, role: 'user', text: truncate(c, 600) });
    } else if (o.type === 'user' && Array.isArray(c)) {
      for (const x of c) {
        if (x.type === 'text' && x.text && !o.isMeta) out.push({ ts, role: 'user', text: truncate(x.text, 600) });
        else if (x.type === 'tool_result') { const t = typeof x.content === 'string' ? x.content : JSON.stringify(x.content || ''); out.push({ ts, role: 'result', chars: t.length, error: Boolean(x.is_error) }); }
      }
    } else if (o.type === 'assistant' && Array.isArray(c)) {
      for (const x of c) {
        if (x.type === 'text' && x.text) out.push({ ts, role: 'assistant', text: truncate(x.text, 600) });
        else if (x.type === 'tool_use') out.push({ ts, role: 'tool', tool: x.name, detail: toolDetail(x.input) });
        else if (x.type === 'thinking' && x.thinking) out.push({ ts, role: 'thinking', chars: x.thinking.length });
      }
    }
  }
  return out;
}

// ---- tokens: hooks on other people's computers ------------------------------------------
// A token belongs to one owner (the Access e-mail that created it) and carries the data mode the owner chose:
// 'status' keeps only states and tool names, 'full' also the prompt, the reply and a short tool detail.
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const tokens = new Map(); // hash -> { id, owner, label, mode, createdAt, lastUsedAt }
function loadTokens() {
  try { for (const t of JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')).tokens || []) tokens.set(t.hash, t); }
  catch (e) { if (e.code !== 'ENOENT') console.log('tokens not loaded: ' + e.message); }
}
let tokTimer = null;
function saveTokens(now = false) {
  if (tokTimer && !now) return;
  clearTimeout(tokTimer);
  tokTimer = setTimeout(() => {
    tokTimer = null;
    const data = JSON.stringify({ tokens: [...tokens.values()] });
    fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true }, () => fs.writeFile(TOKENS_FILE + '.tmp', data, { mode: 0o600 }, (e) => { if (!e) fs.rename(TOKENS_FILE + '.tmp', TOKENS_FILE, () => {}); }));
  }, now ? 0 : 10000);
}
loadTokens();
// ---- guest accounts: 24 h from the first visit, then everything goes, also the user in Cloudflare Access ----------
// accounts.json: { accounts: { email: { createdAt } }, cfPending: [{ email, tries, next }] }. The owner (and
// AGENT_WORLD_KEEP_EMAILS) never expire. Cloudflare: AGENT_WORLD_CF_ACCOUNT_ID + AGENT_WORLD_CF_API_TOKEN; without them
// the removals wait in cfPending until the token is configured.
const ACCOUNT_MS = Number(process.env.AGENT_WORLD_ACCOUNT_HOURS || 24) * 60 * 60 * 1000;
const ACCOUNTS_FILE = path.join(path.dirname(TOKENS_FILE), 'accounts.json');
const KEEP = new Set([OWNER, ...String(process.env.AGENT_WORLD_KEEP_EMAILS || '').split(',').map(normEmail).filter(Boolean)]);
const CF_API = (process.env.AGENT_WORLD_CF_API || 'https://api.cloudflare.com/client/v4').replace(/\/+$/, '');
const CF_ACCOUNT = process.env.AGENT_WORLD_CF_ACCOUNT_ID || '';
const CF_TOKEN = process.env.AGENT_WORLD_CF_API_TOKEN || '';
const accounts = new Map(); // email -> { createdAt }
let cfPending = [];         // [{ email, tries, next }]
function loadAccounts() {
  try { const d = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8')); for (const [e, a] of Object.entries(d.accounts || {})) accounts.set(e, a); cfPending = d.cfPending || []; }
  catch (e) { if (e.code !== 'ENOENT') console.log('accounts not loaded: ' + e.message); }
}
function saveAccounts() {
  const data = JSON.stringify({ accounts: Object.fromEntries(accounts), cfPending });
  fs.mkdir(path.dirname(ACCOUNTS_FILE), { recursive: true }, () => fs.writeFile(ACCOUNTS_FILE + '.tmp', data, { mode: 0o600 }, (e) => { if (!e) fs.rename(ACCOUNTS_FILE + '.tmp', ACCOUNTS_FILE, () => {}); }));
}
loadAccounts();
const isGuest = (email) => Boolean(email) && email.includes('@') && !KEEP.has(email);
function touchAccount(email) {
  if (!isGuest(email) || accounts.has(email)) return;
  accounts.set(email, { createdAt: Date.now() }); saveAccounts();
  console.log(`account created: ${who(email)}`);
}
const accountExpiresAt = (email) => (accounts.has(email) ? accounts.get(email).createdAt + ACCOUNT_MS : null);
// Guests that already had data before accounts existed: their 24 h count from their oldest token.
for (const t of tokens.values()) if (isGuest(t.owner) && !accounts.has(t.owner)) accounts.set(t.owner, { createdAt: t.createdAt });

// Deletes every token, session, event and timeline entry of one person (used by the button and by expiry).
function wipeOwner(owner) {
  let n = 0;
  for (const [h, t] of tokens) if (t.owner === owner) { tokens.delete(h); rate.delete(t.id); n++; }
  for (const [id, a] of agents) if (a.owner === owner) { agents.delete(id); toolRuns.delete(id); transcripts.delete(id); }
  eventsBy.delete(owner); historyBy.delete(owner);
  saveTokens(true); scheduleSave();
  broadcast(owner, { type: 'event', event: { ts: Date.now(), agentId: '', type: 'Forget', summary: 'all data deleted' } });
  return n;
}

function cfCall(method, pathname, body) {
  return new Promise((resolve) => {
    const u = new URL(CF_API + pathname);
    const data = body ? JSON.stringify(body) : null;
    // family 4: the API token is limited to the server's IPv4 address, and this server prefers IPv6 to Cloudflare
    const req = (u.protocol === 'http:' ? http : https).request(u, { method, timeout: 10000, family: 4, headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) } }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => { let j = null; try { j = JSON.parse(d); } catch (_) { /* not JSON */ } resolve({ status: r.statusCode, ok: r.statusCode < 300 && j && j.success !== false, j }); });
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', () => resolve({ status: 0, ok: false, j: null }));
    if (data) req.write(data);
    req.end();
  });
}
// Removes the person from Cloudflare Access: delete the user (also ends seats and sessions); if that call is not
// allowed for the token, at least free the seat. Returns true when nothing is left to do.
async function cfRemove(email) {
  const base = `/accounts/${encodeURIComponent(CF_ACCOUNT)}/access`;
  const list = await cfCall('GET', `${base}/users?email=${encodeURIComponent(email)}&per_page=50`);
  if (!list.ok) return false;
  const users = (list.j.result || []).filter((u) => normEmail(u.email) === email);
  for (const u of users) {
    const del = await cfCall('DELETE', `${base}/users/${encodeURIComponent(u.id)}`);
    if (del.ok) continue;
    if (!u.seat_uid) return false;
    const seat = await cfCall('PATCH', `${base}/seats`, [{ seat_uid: u.seat_uid, access_seat: false, gateway_seat: false }]);
    if (!seat.ok) return false;
  }
  return true;
}
let cfBusy = false;
async function cfWork() {
  if (cfBusy || !cfPending.length || !CF_ACCOUNT || !CF_TOKEN) return;
  cfBusy = true;
  try {
    const now = Date.now();
    for (const p of cfPending.filter((x) => x.next <= now)) {
      const done = await cfRemove(p.email);
      if (done) { cfPending = cfPending.filter((x) => x !== p); console.log(`cloudflare: user removed (${who(p.email)})`); }
      else { p.tries += 1; p.next = now + Math.min(6 * 3600000, 60000 * 2 ** p.tries); console.log(`cloudflare: removal failed (${who(p.email)}), try ${p.tries}`); }
    }
    saveAccounts();
  } finally { cfBusy = false; }
}
function expireAccounts() {
  const now = Date.now();
  for (const [email, a] of accounts) {
    if (a.createdAt + ACCOUNT_MS > now) continue;
    const n = wipeOwner(email);
    accounts.delete(email);
    if (!cfPending.some((x) => x.email === email)) cfPending.push({ email, tries: 0, next: now });
    console.log(`account expired: ${who(email)} (${n} tokens)`);
  }
  saveAccounts();
  cfWork();
}
setInterval(expireAccounts, 60 * 1000);

const tokenView = (t) => ({ id: t.id, label: t.label, mode: t.mode, createdAt: t.createdAt, lastUsedAt: t.lastUsedAt || null });
const tokensOf = (owner) => [...tokens.values()].filter((t) => t.owner === owner);
function bearer(req) {
  const m = /^Bearer\s+(aw_[A-Za-z0-9_-]{20,80})$/.exec(String(req.headers.authorization || ''));
  return m ? tokens.get(sha(m[1])) || null : null;
}

// Simple per-token rate limit: a minute window.
const rate = new Map(); // token id -> { start, n }
function rateOk(id) {
  const now = Date.now(); let r = rate.get(id);
  if (!r || now - r.start > 60000) rate.set(id, (r = { start: now, n: 0 }));
  return ++r.n <= INGEST_PER_MIN;
}

// An event from someone else's computer is rebuilt from known fields only. Never kept: transcript paths
// (they would point at files on this server), full paths, file contents, tool output.
const HOOK_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PermissionRequest', 'PostToolUse', 'PostToolUseFailure', 'PermissionDenied', 'Notification', 'SubagentStart', 'SubagentStop', 'Stop', 'StopFailure', 'SessionEnd']);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const str = (v, n) => (typeof v === 'string' && v ? truncate(v, n) : undefined);
const base = (p) => str(path.basename(String(p || '').replace(/\\/g, '/')), 80);
function cleanRemote(ev, mode) {
  if (!ev || typeof ev !== 'object' || !HOOK_EVENTS.has(ev.hook_event_name) || !ID_RE.test(ev.session_id || '')) return null;
  if (ev.agent_id != null && !ID_RE.test(ev.agent_id)) return null;
  const c = {
    hook_event_name: ev.hook_event_name, session_id: ev.session_id, agent_id: ev.agent_id || undefined,
    agent_type: str(ev.agent_type, 64), tool_name: str(ev.tool_name, 64),
    tool_use_id: ID_RE.test(ev.tool_use_id || '') ? ev.tool_use_id : undefined,
    is_interrupt: ev.is_interrupt === true, notification_type: str(ev.notification_type, 40),
    source: str(ev.source, 40), model: str(ev.model, 64), cwd: base(ev.cwd),
  };
  if (mode === 'full') {
    const i = ev.tool_input && typeof ev.tool_input === 'object' ? ev.tool_input : {};
    const d = i.command || i.file_path || i.pattern || i.query || i.url || i.description;
    if (typeof d === 'string') c.tool_input = { description: truncate(i.file_path ? base(d) : d, 80) };
    c.prompt = str(ev.prompt, 300); c.last_assistant_message = str(ev.last_assistant_message, 200);
    c.session_title = str(ev.session_title, 80); c.message = str(ev.message, 80); c.reason = str(ev.reason, 60);
    c.error = typeof ev.error === 'string' ? str(ev.error, 200) : ev.error ? truncate(JSON.stringify(ev.error), 200) : undefined;
  } else if (ev.hook_event_name === 'StopFailure') c.error = 'error';
  return c;
}

// Body with a hard cap; resolves null when it is too big.
function readBodyMax(req, max) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0, over = false;
    req.on('data', (c) => { if (over) return; n += c.length; if (n > max) { over = true; chunks.length = 0; } else chunks.push(c); });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function ingest(req, res) {
  const t = bearer(req);
  if (!t) return json(res, 401, { ok: false, error: 'zły albo unieważniony token' });
  if (!rateOk(t.id)) return json(res, 429, { ok: false, error: 'za dużo zdarzeń na minutę' });
  const body = await readBodyMax(req, MAX_INGEST_BYTES);
  if (body === null) return json(res, 413, { ok: false, error: 'zdarzenie za duże' });
  let ev; try { ev = JSON.parse(body); } catch (_) { return json(res, 400, { ok: false, error: 'to nie jest JSON' }); }
  const c = cleanRemote(ev, t.mode);
  if (!c) return json(res, 400, { ok: false, error: 'nieznane zdarzenie' });
  if ([c.session_id, c.agent_id].some((k) => k && agents.has(k) && agents.get(k).owner !== t.owner)) return json(res, 409, { ok: false, error: 'ta sesja należy do kogoś innego' });
  const isNew = (k) => k && !agents.has(k);
  if ((isNew(c.session_id) || isNew(c.agent_id)) && agentsOf(t.owner).length >= MAX_REMOTE_AGENTS) return json(res, 429, { ok: false, error: 'za dużo sesji naraz' });
  applyEvent(c, base(req.headers['x-project-dir']) || c.cwd || null, t.owner);
  t.lastUsedAt = Date.now(); saveTokens();
  return json(res, 200, { ok: true });
}

// ---- http ------------------------------------------------------------------

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body, OUT));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // The page in front of the login (web/start): what this is and how to try it. Public, like /ingest
  // (Cloudflare bypasses /start and everything under it), so nothing here may depend on who asks.
  if (req.method === 'GET' && (url.pathname === '/start' || url.pathname.startsWith('/start/'))) {
    if (url.pathname === '/start') { res.writeHead(301, { Location: '/start/' }); return res.end(); }
    return serveStatic(url.pathname === '/start/' ? '/start/index.html' : url.pathname, res);
  }
  // Hooks on other people's computers: no Access login (Cloudflare bypasses /ingest), only their token.
  // The connect script and its check are public too (Cloudflare bypasses /ingest and everything under it).
  if (req.method === 'GET' && url.pathname === '/ingest/podlacz.sh') {
    return fs.readFile(CONNECT_SCRIPT, 'utf8', (err, text) => {
      if (err) return json(res, 404, { ok: false });
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Robots-Tag': 'noindex' });
      res.end(text.replace(/__INGEST_URL__/g, PUBLIC_URL + '/ingest'));
    });
  }
  if (req.method === 'GET' && url.pathname === '/ingest/check') {
    const t = bearer(req);
    if (!t) return json(res, 401, { ok: false, error: 'zły albo unieważniony token' });
    if (!rateOk(t.id)) return json(res, 429, { ok: false });
    return json(res, 200, { ok: true, label: t.label, mode: t.mode });
  }
  if (url.pathname === '/ingest') {
    if (req.method !== 'POST') return json(res, 405, { ok: false });
    try { return await ingest(req, res); } catch (e) { return json(res, 400, { ok: false, error: String(e.message || e) }); }
  }

  // Who is asking: a viewer from the edge (Access e-mail) or this server itself (the owner).
  let viewer = OWNER;
  const edge = Boolean(req.headers['x-agent-world-edge']);
  if (edge) {
    viewer = await accessEmail(req);
    if (!viewer) { res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); return res.end('403: wymagane logowanie Cloudflare Access'); }
    if (!seenViewers.has(viewer)) { seenViewers.add(viewer); console.log(`viewer: ${who(viewer)}`); }
    touchAccount(viewer);
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
  }

  if (req.method === 'GET' && url.pathname === '/me') {
    return json(res, 200, { email: viewer || null, local: viewer === OWNER, expiresAt: accountExpiresAt(viewer), accountHours: ACCOUNT_MS / 3600000 });
  }
  // "Usuń moje dane": every token, session, event and timeline entry of the viewer, at once.
  if (req.method === 'DELETE' && url.pathname === '/me') {
    if (req.headers['x-aw'] !== '1') return json(res, 403, { ok: false, error: 'brak nagłówka X-AW' });
    const n = wipeOwner(viewer);
    console.log(`data deleted by ${who(viewer)} (${n} tokens)`);
    return json(res, 200, { ok: true });
  }

  // Token management for the logged-in viewer. Changes need the X-AW header: a cross-site form cannot set it,
  // and without CORS a script on another site cannot send it either.
  if (url.pathname === '/tokens') {
    if (req.method === 'GET') return json(res, 200, { tokens: tokensOf(viewer).map(tokenView) });
    if (req.headers['x-aw'] !== '1') return json(res, 403, { ok: false, error: 'brak nagłówka X-AW' });
    if (req.method === 'POST') {
      if (tokensOf(viewer).length >= MAX_TOKENS) return json(res, 409, { ok: false, error: `najwyżej ${MAX_TOKENS} tokenów` });
      let b = {}; try { b = JSON.parse((await readBodyMax(req, 4096)) || '{}'); } catch (_) { /* defaults */ }
      const raw = 'aw_' + crypto.randomBytes(24).toString('base64url');
      const t = { id: crypto.randomBytes(4).toString('hex'), hash: sha(raw), owner: viewer, label: str(b.label, 40) || 'komputer', mode: b.mode === 'full' ? 'full' : 'status', createdAt: Date.now(), lastUsedAt: null };
      tokens.set(t.hash, t); saveTokens(true);
      console.log(`token ${t.id} created for ${who(viewer)} (${t.mode})`);
      return json(res, 200, { ok: true, token: raw, ...tokenView(t) });
    }
    if (req.method === 'DELETE') {
      const t = tokensOf(viewer).find((x) => x.id === url.searchParams.get('id'));
      if (!t) return json(res, 404, { ok: false });
      tokens.delete(t.hash); rate.delete(t.id); saveTokens(true);
      console.log(`token ${t.id} revoked by ${who(viewer)}`);
      return json(res, 200, { ok: true });
    }
    return json(res, 405, { ok: false });
  }

  // Raw hook events are accepted only from this server itself (its own hooks).
  if (edge && req.method !== 'GET') return json(res, 403, { ok: false, error: 'hooks only from this server' });

  if (req.method === 'POST' && url.pathname === '/events') {
    try {
      const ev = JSON.parse(await readBody(req));
      const norm = applyEvent(ev, req.headers['x-project-dir'] || null, OWNER);
      if (norm) console.log(`[${new Date(norm.ts).toLocaleTimeString()}] ${norm.agentId.slice(0, 8)} ${norm.summary}`);
      return json(res, 200, { ok: true });
    } catch (e) {
      return json(res, 400, { ok: false, error: String(e.message || e) });
    }
  }

  if (req.method === 'GET' && url.pathname === '/agents') {
    return json(res, 200, { agents: agentsOf(viewer), now: Date.now() });
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const since = Number(url.searchParams.get('since') || 0), agent = url.searchParams.get('agent'), limit = Math.min(200, Number(url.searchParams.get('limit') || 200));
    const list = (eventsBy.get(viewer) || []).filter((e) => e.ts > since && (!agent || e.agentId === agent));
    return json(res, 200, { events: list.slice(-limit) });
  }

  if (req.method === 'GET' && url.pathname === '/transcript') {
    const id = url.searchParams.get('id') || '', n = Math.min(100, Math.max(1, Number(url.searchParams.get('n') || 30))), before = Math.max(0, Number(url.searchParams.get('before') || 0));
    const file = transcripts.get(id);
    if (!file || agents.get(id)?.owner !== viewer) return json(res, 404, { ok: false, error: 'brak transkryptu dla tej sesji' });
    try {
      const all = transcriptItems(file), end = Math.max(0, all.length - before), items = all.slice(Math.max(0, end - n), end);
      res.setHeader('Cache-Control', 'no-store');
      return json(res, 200, { items, total: all.length, before: all.length - Math.max(0, end - n) });
    } catch (e) { return json(res, 500, { ok: false, error: String(e.message || e) }); }
  }

  if (req.method === 'GET' && url.pathname === '/history') {
    const since = Number(url.searchParams.get('since') || 0);
    pruneHistory();
    return json(res, 200, { history: (historyBy.get(viewer) || []).filter((h) => h.ts > since), now: Date.now() });
  }

  if (req.method === 'GET' && url.pathname === '/stream') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'snapshot', agents: agentsOf(viewer), now: Date.now() }, OUT)}\n\n`);
    clients.set(res, viewer);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/table') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }

  if (req.method === 'GET') return serveStatic(url.pathname, res);

  json(res, 404, { ok: false });
});

// ---- static files from ../web (the pixel world) ----------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
function serveStatic(pathname, res) {
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1));
  const file = path.normalize(path.join(WEB_DIR, rel));
  if (!file.startsWith(WEB_DIR + path.sep)) return json(res, 404, { ok: false });
  fs.readFile(file, (err, data) => {
    if (err) return json(res, 404, { ok: false });
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

server.listen(PORT, HOST, () => {
  console.log(`agent-world collector listening on http://${HOST}:${PORT}`);
});

// ---- plain status page (Etap 1 placeholder; the pixel world replaces this) --

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>Agent World — status</title>
<style>
  body { font: 14px/1.4 ui-monospace, Menlo, Consolas, monospace; margin: 24px; background: #111; color: #ddd; }
  h1 { font-size: 16px; margin: 0 0 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #333; vertical-align: top; }
  th { color: #888; font-weight: normal; }
  .sub td:first-child { padding-left: 28px; }
  .idle { color: #8a8; } .thinking { color: #ad8; } .tool { color: #fc6; }
  .waiting_for_user { color: #f66; font-weight: bold; } .done { color: #666; } .error { color: #f33; }
  #log { margin-top: 20px; color: #999; white-space: pre-wrap; max-height: 40vh; overflow: auto; }
</style>
<h1>Agent World — <span id="count">0</span> agentów</h1>
<table>
  <thead><tr><th>agent</th><th>status</th><th>narzędzie</th><th>ostatnia wiadomość</th><th>tool calls</th><th>ostatnia zmiana</th></tr></thead>
  <tbody id="rows"></tbody>
</table>
<div id="log"></div>
<script>
  let lastTs = 0;
  const ago = (t) => Math.round((Date.now() - t) / 1000) + 's temu';
  const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  async function tick() {
    try {
      const { agents } = await (await fetch('/agents')).json();
      const roots = agents.filter((a) => !a.parentId);
      const subs = (id) => agents.filter((a) => a.parentId === id);
      const row = (a, cls = '') => '<tr class="' + cls + '"><td>' + esc(a.name) + '</td>' +
        '<td class="' + a.status + '">' + a.status + (a.waitingFor ? ' (' + a.waitingFor + ')' : '') + '</td><td>' + esc(a.currentTool || '') + '</td>' +
        '<td>' + esc(a.lastMessage || '') + '</td><td>' + a.toolCalls + '</td><td>' + ago(a.updatedAt) + '</td></tr>';
      document.getElementById('rows').innerHTML =
        roots.map((r) => row(r) + subs(r.id).map((s) => row(s, 'sub')).join('')).join('');
      document.getElementById('count').textContent = agents.length;

      const { events } = await (await fetch('/events?since=' + lastTs)).json();
      if (events.length) {
        lastTs = events[events.length - 1].ts;
        const log = document.getElementById('log');
        log.textContent += events.map((e) => new Date(e.ts).toLocaleTimeString() + '  ' + e.agentId.slice(0, 8) + '  ' + e.summary).join('\\n') + '\\n';
        log.scrollTop = log.scrollHeight;
      }
    } catch (e) { /* collector restarting */ }
  }
  tick(); setInterval(tick, 1000);
</script>`;
