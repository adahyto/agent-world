// Agent World: podłączanie komputerów. Okno „Podłącz swoje Claude Code”: token (POST /tokens), jedna linia do terminala,
// lista komputerów z unieważnianiem (DELETE /tokens). Zmiany wysyłają nagłówek X-AW (ochrona przed cudzymi formularzami).
(() => {
  const $ = (s) => document.querySelector(s);
  const dlg = $('#connect');
  if (!dlg || !window.fetch) return;
  const script = `${location.origin}/ingest/podlacz.sh`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const day = (t) => (t ? new Date(t).toLocaleString('pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null);
  const MODE = { status: 'tylko statusy', full: 'pełne dane' };
  let tokens = [];

  $('#c-unline').textContent = `curl -fsSL ${script} | bash -s -- --usun`;

  async function api(method, url, body) {
    const r = await fetch(url, { method, headers: method === 'GET' ? {} : { 'X-AW': '1', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `błąd ${r.status}`);
    return j;
  }
  function render() {
    $('#c-none').hidden = tokens.length > 0;
    $('#c-list').innerHTML = tokens.map((t) => `<li><div><b>${esc(t.label)}</b><small>${MODE[t.mode] || esc(t.mode)} · dodany ${esc(day(t.createdAt))} · ${t.lastUsedAt ? `ostatnie zdarzenie ${esc(day(t.lastUsedAt))}` : 'jeszcze nic nie wysłał'}</small></div><button type="button" class="btn" data-revoke="${esc(t.id)}">unieważnij</button></li>`).join('');
    const ec = $('#empty-connect'); if (ec) ec.hidden = tokens.length > 0;
  }
  async function load() {
    try { tokens = (await api('GET', '/tokens')).tokens || []; render(); window.CONNECT = { tokens: tokens.length }; } catch (_) { window.CONNECT = { tokens: 1 }; /* collector bez kont: bez pokazu */ }
    window.LIVE_DEMO?.recheck();
  }
  function open() {
    $('#c-cmd').hidden = true; $('#c-err').hidden = true;
    load();
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }

  $('#connect-btn')?.addEventListener('click', open);
  document.addEventListener('click', (e) => { if (e.target.closest('[data-open-connect]')) open(); });
  $('#c-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  $('#c-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#c-err'); err.hidden = true;
    const mode = new FormData(e.target).get('mode') === 'full' ? 'full' : 'status';
    try {
      const t = await api('POST', '/tokens', { label: $('#c-label').value.trim() || 'komputer', mode });
      $('#c-line').textContent = `curl -fsSL ${script} | bash -s -- ${t.token} ${t.mode}`;
      $('#c-cmd').hidden = false; $('#c-copied').textContent = '';
      $('#c-cmd').scrollIntoView({ block: 'nearest' });
      await load();
    } catch (x) { err.textContent = x.message; err.hidden = false; }
  });
  $('#c-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#c-line').textContent); $('#c-copied').textContent = 'skopiowane'; }
    catch (_) { $('#c-copied').textContent = 'zaznacz polecenie i skopiuj ręcznie'; }
  });
  $('#c-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-revoke]'); if (!b) return;
    const t = tokens.find((x) => x.id === b.dataset.revoke);
    if (!t || !confirm(`Unieważnić „${t.label}”? Hook na tym komputerze przestanie wysyłać zdarzenia.`)) return;
    try { await api('DELETE', `/tokens?id=${encodeURIComponent(t.id)}`); } catch (x) { alert(x.message); }
    load();
  });

  $('#c-wipe').addEventListener('click', async () => {
    if (!confirm('Usunąć wszystkie Twoje dane z tej strony: tokeny (hooki przestaną działać), sesje na mapie, zdarzenia i oś czasu? Tego nie da się cofnąć.')) return;
    try { await api('DELETE', '/me'); $('#c-wiped').textContent = 'usunięte'; $('#c-cmd').hidden = true; load(); }
    catch (x) { $('#c-wiped').textContent = x.message; }
  });
  // Guest accounts live 24 h from the first visit; the badge and the note say how long is left.
  const left = (t) => { const m = Math.max(0, Math.round((t - Date.now()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  let expiresAt = null, hours = 24;
  function showAccount() {
    if (!expiresAt) return;
    const gone = expiresAt <= Date.now();
    const b = $('#acct-badge'); b.hidden = false;
    b.textContent = gone ? 'konto gościa usunięte' : `konto gościa: zostało ${left(expiresAt)}`;
    const n = $('#c-acct'); n.hidden = false;
    n.textContent = gone
      ? 'To konto gościa minęło i zostało usunięte razem z tokenami, sesjami i historią. Zaloguj się ponownie, żeby założyć nowe na kolejne 24 godziny, i podłącz komputer od nowa.'
      : `To konto gościa działa ${hours} godziny od pierwszego wejścia (zostało ${left(expiresAt)}). Potem automatycznie usuwam tokeny, sesje i historię, a logowanie Cloudflare wygasa; hook na komputerze przestanie wysyłać zdarzenia. Żeby korzystać dalej, zaloguj się ponownie i podłącz komputer od nowa.`;
  }
  fetch('/me').then((r) => r.json()).then((m) => {
    if (m.email && m.email.includes('@')) $('#me-line').textContent = ` (zalogowano jako ${m.email})`;
    if (m.expiresAt) { expiresAt = m.expiresAt; hours = m.accountHours || 24; showAccount(); setInterval(showAccount, 30000); }
  }).catch(() => {});
  load();
})();
