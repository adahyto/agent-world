// Agent World: panel szczegółów sesji (klik na dzika albo kafelek). Dane z collectora (LIVE) albo z symulacji.
(() => {
  const $ = (s) => document.querySelector(s);
  const panel = $('#panel');
  if (!panel) return;
  let current = null, timer = null;

  const STATUS = {
    idle: ['czeka na polecenie', 'idle'], thinking: ['myśli', 'thinking'], tool: ['pracuje', 'tool'],
    'waiting:permission': ['czeka na pozwolenie', 'w-permission'], 'waiting:question': ['zadaje pytanie', 'w-question'], 'waiting:input': ['bezczynna', 'w-input'],
    done: ['zakończona', 'done'], error: ['błąd', 'error'],
  };
  const MODEL = (m) => (/opus/i.test(m || '') ? 'Opus' : /haiku/i.test(m || '') ? 'Haiku' : /sonnet/i.test(m || '') ? 'Sonnet' : '');
  const ago = (t) => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
    return `${Math.floor(s / 86400)} d`;
  };
  const clock = (t) => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const EV_ICON = { PreToolUse: '▸', PostToolUse: '✓', PostToolUseFailure: '✗', PermissionRequest: '!', PermissionDenied: '⊘', UserPromptSubmit: '›', Stop: '■', StopFailure: '⚠', Notification: '◦', SessionStart: '●', SessionEnd: '○', SubagentStart: '↳', SubagentStop: '↲', Forget: '·' };

  function data(a) {
    // Agent silnika → dane: na żywo z collectora, w symulacji z samego agenta.
    const src = a.srcId && window.LIVE ? LIVE.agents.get(a.srcId) : null;
    if (src) return { live: true, id: src.id, name: a.name, model: MODEL(src.model) || (a.model === 'sub' ? 'subagent' : AW.MODELS[a.model]), project: src.project, status: src.status, waitingFor: src.waitingFor, tool: src.currentTool, since: src.since || src.updatedAt, startedAt: src.startedAt, prompt: src.lastPrompt, msg: src.lastMessage, toolCalls: src.toolCalls, kind: src.kind, transcript: src.transcript !== false };
    return { live: false, id: null, name: a.name, model: AW.MODELS[a.model], project: a.name, status: a.status, waitingFor: a.waitingFor, tool: a.tool, since: null, startedAt: null, prompt: (AW.SESSIONS || []).find((s) => a.kind !== 'subagent' && s.name === a.name)?.prompt || null, msg: a.lastMessage, toolCalls: null, kind: a.kind };
  }

  function render() {
    if (!current) return;
    const d = data(current);
    const key = d.status === 'waiting_for_user' ? `waiting:${d.waitingFor || 'input'}` : d.status;
    const [label, cls] = STATUS[key] || [d.status, d.status];
    $('#p-name').textContent = d.name;
    const pc = $('#p-color'); if (pc) pc.style.background = current.color || '';
    $('#p-model').textContent = d.model || '';
    const st = $('#p-status'); st.textContent = d.status === 'tool' && d.tool ? `${label}: ${d.tool}` : label; st.className = 'st-' + cls;
    $('#p-since').textContent = d.since ? `od ${ago(d.since)}` : '';
    $('#p-project').textContent = d.project ? `${d.kind === 'subagent' ? 'subagent · ' : ''}${d.project}` : '';
    $('#p-started').textContent = d.startedAt ? `sesja od ${clock(d.startedAt)}${d.toolCalls != null ? ` · narzędzia: ${d.toolCalls}` : ''}` : '';
    $('#p-prompt').textContent = d.prompt || (d.live ? '—' : document.body.classList.contains('demo') ? '(pokaz)' : '(symulacja)');
    $('#p-msg').textContent = d.msg || '—';
    const tr = $('#p-tr-sec'); if (tr) tr.hidden = d.live && !d.transcript; // sessions from other computers have no transcript here
  }
  function renderEvents(list) {
    const ol = $('#p-events');
    ol.innerHTML = list.length ? list.slice().reverse().map((e) => `<li class="ev-${esc(e.type)}"><time>${clock(e.ts)}</time><i>${EV_ICON[e.type] || '·'}</i><span>${esc(e.summary)}</span></li>`).join('') : '<li class="empty">brak zdarzeń</li>';
  }
  async function loadEvents() {
    const d = data(current);
    if (!d.live) return renderEvents([]);
    try { const r = await (await fetch(`/events?agent=${encodeURIComponent(d.id)}&limit=40`)).json(); if (current && data(current).id === d.id) renderEvents(r.events || []); }
    catch (_) { renderEvents([]); }
  }

  // Transkrypt: ładowany dopiero na życzenie, strony po 30 wpisów od końca.
  let trBefore = 0, trId = null;
  const trRender = (items, prepend) => {
    const ol = $('#p-transcript');
    const html = items.map((it) => {
      const t = it.ts ? `<time>${clock(it.ts)}</time>` : '';
      if (it.role === 'user') return `<li class="tr-user">${t}${esc(it.text)}</li>`;
      if (it.role === 'assistant') return `<li class="tr-assistant">${t}${esc(it.text)}</li>`;
      if (it.role === 'tool') return `<li class="tr-tool">${t}▸ ${esc(it.tool)}${it.detail ? ': ' + esc(it.detail) : ''}</li>`;
      if (it.role === 'result') return `<li class="tr-result${it.error ? ' err' : ''}">↳ ${it.error ? 'błąd narzędzia' : 'wynik narzędzia'} (${it.chars} zn.)</li>`;
      if (it.role === 'thinking') return `<li class="tr-thinking">… myślenie (${it.chars} zn.)</li>`;
      return '';
    }).join('');
    if (prepend) ol.insertAdjacentHTML('afterbegin', html); else { ol.innerHTML = html; ol.scrollTop = ol.scrollHeight; }
  };
  async function trLoad(more) {
    const d = data(current);
    if (!d.live) return;
    if (!more || trId !== d.id) { trBefore = 0; trId = d.id; }
    $('#p-tr-info').textContent = 'ładuję…';
    try {
      const r = await (await fetch(`/transcript?id=${encodeURIComponent(d.id)}&n=30&before=${trBefore}`)).json();
      if (!r.items) throw new Error(r.error || 'błąd');
      if (!current || data(current).id !== d.id) return;
      trRender(r.items, more);
      trBefore = r.before;
      $('#p-tr-info').textContent = `${Math.min(r.total, r.before)} z ${r.total} wpisów`;
      $('#p-tr-more').hidden = r.before >= r.total;
      $('#p-tr-load').textContent = 'odśwież';
    } catch (e) { $('#p-tr-info').textContent = e.message; }
  }
  $('#p-tr-load')?.addEventListener('click', () => trLoad(false));
  $('#p-tr-more')?.addEventListener('click', () => trLoad(true));
  function trReset() { $('#p-transcript').innerHTML = ''; $('#p-tr-info').textContent = ''; $('#p-tr-more').hidden = true; $('#p-tr-load').textContent = 'pokaż ostatnie 30 wpisów'; trId = null; trBefore = 0; }

  function show(a) {
    if (a !== current) trReset();
    current = a;
    if (!a) { panel.hidden = true; document.body.classList.remove('has-panel'); clearInterval(timer); timer = null; return; }
    panel.hidden = false; document.body.classList.add('has-panel');
    render(); loadEvents();
    if (!timer) timer = setInterval(() => { if (current) $('#p-since').textContent = data(current).since ? `od ${ago(data(current).since)}` : ''; }, 10000);
  }

  AW.onSelect = show;
  $('#p-close').addEventListener('click', () => { show(null); });
  window.PANEL = {
    onEvent(ev) { if (!current) return; const d = data(current); if (d.live && ev.agentId === d.id) { loadEvents(); render(); } },
    refresh() { if (current) render(); },
  };
})();
