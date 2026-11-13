// Agent World: układy. Tryb TV (sama mapa, pełny ekran, większe podpisy, kursor znika), powiększenie mapy na telefonie,
// zapamiętana legenda.
(() => {
  const $ = (s) => document.querySelector(s);
  const body = document.body;
  let idleTimer = null;

  function setTv(on) {
    body.classList.toggle('tv', on);
    AW.opts.textScale = on ? 1.3 : 1;
    try { on ? history.replaceState(null, '', '?tv') : history.replaceState(null, '', location.pathname); } catch (_) { /* sandboxed */ }
    if (on && document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    wake();
  }
  function wake() {
    body.classList.remove('idle');
    clearTimeout(idleTimer);
    if (body.classList.contains('tv')) idleTimer = setTimeout(() => body.classList.add('idle'), 3000);
  }
  $('#tv-btn')?.addEventListener('click', () => setTv(true));
  $('#tv-exit')?.addEventListener('click', () => setTv(false));
  document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.key === 'f') setTv(!body.classList.contains('tv'));
    if (e.key === 'Escape' && body.classList.contains('tv') && !document.fullscreenElement) setTv(false);
  });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && body.classList.contains('tv')) setTv(false); });
  for (const ev of ['mousemove', 'touchstart', 'keydown']) document.addEventListener(ev, wake, { passive: true });
  if (new URLSearchParams(location.search).has('tv')) { body.classList.add('tv'); AW.opts.textScale = 1.3; wake(); }

  $('#zoom-btn')?.addEventListener('click', () => { const f = $('.stage-frame'); f.classList.toggle('zoomed'); const l = $('#zoom-btn .lbl'); if (l) l.textContent = f.classList.contains('zoomed') ? 'zmniejsz' : 'powiększ'; });

  // Ustawienia: zamykaj okienko kliknięciem poza nim albo Esc. Motyw: auto / jasny / ciemny (zapamiętany).
  const settings = $('#settings');
  document.addEventListener('click', (e) => { if (settings?.open && !settings.contains(e.target)) settings.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && settings?.open) settings.open = false; });
  const seg = $('#theme-seg');
  const paintTheme = () => { const cur = document.documentElement.dataset.theme || 'auto'; seg?.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === cur))); };
  seg?.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-theme-set]'); if (!b) return;
    const v = b.dataset.themeSet;
    if (v === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    try { v === 'auto' ? localStorage.removeItem('aw-theme') : localStorage.setItem('aw-theme', v); } catch (_) { /* ignore */ }
    paintTheme();
  });
  paintTheme();

  const box = $('#legend-box');
  try { if (localStorage.getItem('aw-legend') === 'open') box.open = true; } catch (_) { /* brak localStorage */ }
  box?.addEventListener('toggle', () => { try { localStorage.setItem('aw-legend', box.open ? 'open' : 'closed'); } catch (_) { /* ignore */ } });
})();
