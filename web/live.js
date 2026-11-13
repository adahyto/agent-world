// Agent World: połączenie z collectorem. SSE /stream (migawka + każda zmiana), zapas: odpytywanie /agents.
(() => {
  const $ = (s) => document.querySelector(s);
  const badge = $('#live-badge');
  let es = null, pollTimer = null, gotData = false;
  window.LIVE = { agents: new Map() };

  function setBadge(state, text) {
    if (!badge) return;
    badge.dataset.state = state;
    badge.textContent = text;
  }
  // Pokaz: konto bez sesji i bez podłączonego komputera dostaje udawane dziki z paskiem „Pokaz”.
  // Pierwsza prawdziwa sesja albo token kończy pokaz; odznaczenie „symulacji” w ustawieniach też.
  let demo = false, demoOff = false, lastAgents = [];
  const hasTokens = () => window.CONNECT?.tokens == null ? null : window.CONNECT.tokens > 0;
  function setDemo(on) {
    if (on === demo) return;
    demo = on;
    document.body.classList.toggle('demo', on);
    $('#demo-note').hidden = !on;
    $('#auto').checked = on;
    AW.setLive(!on);
    if (on && matchMedia('(max-width: 900px)').matches) $('#p-close')?.click(); // na telefonie panel zasłaniałby mapę
  }
  function decide() {
    const want = gotData && !demoOff && lastAgents.length === 0 && hasTokens() === false;
    setDemo(want);
    if (demo) { setBadge('demo', 'pokaz · udawane dziki'); $('#live-empty').hidden = true; }
    return demo;
  }
  $('#auto').addEventListener('change', (e) => { if (demo && !e.target.checked) { demoOff = true; demo = false; document.body.classList.remove('demo'); $('#demo-note').hidden = true; apply(lastAgents); } });
  window.LIVE_DEMO = { recheck: () => { if (gotData) apply(lastAgents); } };

  const sesji = (n) => (n === 1 ? 'sesja' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? 'sesje' : 'sesji');
  function apply(agents, now) {
    gotData = true;
    lastAgents = agents;
    LIVE.agents = new Map(agents.map((a) => [a.id, a]));
    if (decide()) return;
    AW.live.sync(agents);
    window.PANEL?.refresh();
    const n = agents.filter((a) => a.kind !== 'subagent').length, s = agents.length - n;
    setBadge('on', `na żywo · ${n} ${sesji(n)}${s ? ` + ${s} sub` : ''}`);
    $('#live-empty').hidden = agents.length > 0;
    const wait = agents.filter((a) => a.status === 'waiting_for_user' && a.waitingFor !== 'input').length;
    const wb = $('#wait-badge');
    if (wb) { wb.hidden = !wait; wb.textContent = wait === 1 ? '1 czeka na Ciebie' : `${wait} czekają na Ciebie`; }
    document.title = wait ? `! ${wait} · Agent World` : n ? `Agent World · ${n} ${sesji(n)}` : 'Agent World';
  }
  function connect() {
    if (!window.EventSource) return poll();
    es = new EventSource('/stream');
    es.onmessage = (m) => { try { const d = JSON.parse(m.data); if (d.agents) apply(d.agents, d.now); if (d.event) { window.PANEL?.onEvent(d.event); window.TIMELINE?.refresh(); } } catch (_) { /* ignore */ } };
    es.onerror = () => { setBadge('off', 'łączę ponownie…'); if (!pollTimer) poll(); };
    es.onopen = () => { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } };
  }
  function poll() {
    const tick = async () => { try { const d = await (await fetch('/agents')).json(); apply(d.agents, d.now); } catch (_) { setBadge('off', 'collector nie odpowiada'); } };
    tick(); pollTimer = setInterval(tick, 2000);
  }

  AW.live.supported = true;
  AW.setLive(true);
  $('#auto').checked = false;
  setBadge('off', 'łączę…');
  connect();
})();
