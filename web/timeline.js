// Agent World: oś czasu pod mapą. Jedna linia na sesję, kolor = status, z /history collectora (ostatnie 24 h).
(() => {
  const $ = (s) => document.querySelector(s);
  const box = $('#timeline');
  if (!box) return;
  const svg = box.querySelector('svg'), tip = $('#tl-tip');
  let hours = 6, entries = [], now = Date.now(), timer = null;
  const LABEL = { idle: 'czeka na polecenie', thinking: 'myśli', tool: 'pracuje', waiting_for_user: 'czeka', done: 'zakończona', error: 'błąd', gone: 'zapomniana' };
  const CLASS = (h) => (h.status === 'waiting_for_user' ? `w-${h.waitingFor || 'input'}` : h.status);
  const clock = (t) => new Date(t).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

  async function load() {
    try { const r = await (await fetch(`/history?since=${Date.now() - 24 * 3600 * 1000}`)).json(); entries = r.history || []; now = r.now || Date.now(); } catch (_) { entries = []; }
    draw();
  }
  function rows() {
    // Sesje (nie subagenci) widoczne w oknie: ostatni wpis sprzed okna + wpisy w oknie.
    const from = now - hours * 3600 * 1000, by = new Map();
    for (const h of entries) { if (h.kind === 'subagent') continue; let r = by.get(h.agentId); if (!r) by.set(h.agentId, (r = { id: h.agentId, name: h.name, list: [] })); r.list.push(h); r.name = h.name; }
    const dup = {};
    for (const r of by.values()) dup[r.name] = (dup[r.name] || 0) + 1;
    const out = [];
    for (const r of by.values()) {
      if (dup[r.name] > 1) r.name = `${r.name}·${String(r.id).slice(0, 4)}`;
      r.list.sort((a, b) => a.ts - b.ts);
      const segs = [];
      for (let i = 0; i < r.list.length; i++) {
        const h = r.list[i], end = i + 1 < r.list.length ? r.list[i + 1].ts : now;
        if (h.status === 'gone' || end < from) continue;
        segs.push({ s: Math.max(h.ts, from), e: end, h });
      }
      if (segs.length) out.push({ ...r, segs });
    }
    return out.sort((a, b) => a.segs[0].s - b.segs[0].s);
  }
  function draw() {
    const data = rows(), W = 1000, L = 110, RH = 15, GAP = 4, top = 18, H = top + data.length * (RH + GAP) + 8;
    const from = now - hours * 3600 * 1000, x = (t) => L + ((t - from) / (now - from)) * (W - L - 8);
    svg.setAttribute('viewBox', `0 0 ${W} ${Math.max(H, 40)}`);
    svg.style.height = `${Math.max(H, 40)}px`;
    let out = '';
    const step = hours <= 6 ? 1 : hours <= 12 ? 2 : 4;
    for (let t = Math.ceil(from / 3600000) * 3600000; t <= now; t += step * 3600000) { if (x(t) > W - 48) continue; out += `<line x1="${x(t).toFixed(1)}" y1="${top - 4}" x2="${x(t).toFixed(1)}" y2="${H - 6}" class="tl-grid"/><text x="${x(t).toFixed(1)}" y="10" class="tl-tick">${clock(t)}</text>`; }
    out += `<text x="${W - 8}" y="10" class="tl-tick tl-now">teraz</text>`;
    data.forEach((r, i) => {
      const y = top + i * (RH + GAP);
      out += `<text x="${L - 6}" y="${y + RH - 3}" class="tl-name">${esc(r.name)}</text>`;
      for (const sg of r.segs) out += `<rect x="${x(sg.s).toFixed(1)}" y="${y}" width="${Math.max(1.5, x(sg.e) - x(sg.s)).toFixed(1)}" height="${RH}" rx="2" class="tl-seg st-${CLASS(sg.h)}" data-tip="${esc(`${r.name} · ${LABEL[sg.h.status] || sg.h.status}${sg.h.waitingFor ? ` (${sg.h.waitingFor})` : ''}${sg.h.tool ? `: ${sg.h.tool}` : ''} · ${clock(sg.s)}–${sg.e === now ? 'teraz' : clock(sg.e)}`)}"/>`;
    });
    if (!data.length) out += `<text x="${L}" y="${top + 10}" class="tl-name">brak historii w tym oknie</text>`;
    svg.innerHTML = out;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  svg.addEventListener('mousemove', (e) => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = box.getBoundingClientRect();
    tip.style.left = `${Math.min(e.clientX - r.left + 12, r.width - tip.offsetWidth - 8)}px`; tip.style.top = `${e.clientY - r.top + 14}px`;
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  box.querySelectorAll('button[data-hours]').forEach((b) => b.addEventListener('click', () => { hours = Number(b.dataset.hours); box.querySelectorAll('button[data-hours]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw(); }));

  window.TIMELINE = { refresh: load };
  load();
  timer = setInterval(() => { now = Date.now(); draw(); }, 30000);
  setInterval(load, 120000);
})();
