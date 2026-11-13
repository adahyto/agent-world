// Watacha dzików v3: nieregularna ściana lasu, pięć różnych barłogów, duża urozmaicona polana,
// wąski pas przedmieść. Pory roku i rysowanie tła. Postacie i życie: forest-life.js.
(() => {
  const { W, H, rng, shade, house } = AW;
  // Pula barłogów: każdy inny, w zatokach lasu. Rysowane są tylko te, które mają projekt (AW.projects).
  const NESTS = [
    { x: 58, y: 62, kind: 'wykrot' },
    { x: 178, y: 40, kind: 'paprocie' },
    { x: 290, y: 30, kind: 'glaz' },
    { x: 470, y: 36, kind: 'jalowce' },
    { x: 590, y: 58, kind: 'swierk' },
    { x: 118, y: 18, kind: 'glaz' },
    { x: 384, y: 14, kind: 'paprocie' },
    { x: 536, y: 12, kind: 'jalowce' },
  ];
  const activeNests = () => NESTS.slice(0, Math.max(1, Math.min(NESTS.length, (AW.projects || []).length)));
  // Ściana lasu: falista, z zatokami.
  const edgeY = (x) => Math.round(90 + 12 * Math.sin(x / 64) + 7 * Math.sin(x / 23 + 1) + 4 * Math.sin(x / 9));
  // Miejsca narzędzi na polanie (y ~100–288) i na przedmieściach (y 288–360).
  const P = {
    base: { x: 372, y: 132, label: 'BAZA DZIKÓW', spots: [[362, 162], [388, 162], [346, 172], [374, 178], [404, 172], [334, 160], [416, 160], [372, 192]] }, // czeka na zgodę / pytanie
    feeder: { x: 66, y: 114, w: 54, h: 24, label: 'PAŚNIK' },           // MCP
    thicket: { x: 188, y: 106, w: 52, h: 22, label: 'GĄSZCZ' },         // Agent
    rub: { x: 492, y: 104, w: 22, h: 30, label: 'CZOCHRADŁO' },         // TodoWrite
    bucht: { x: 26, y: 176, w: 108, h: 42, label: 'BUCHTOWISKO' },      // Bash
    tracks: { x: 148, y: 244, w: 90, h: 24, label: 'TROPY' },           // Read
    wallow: { x: 330, y: 214, rx: 46, ry: 17, label: 'BABRZYSKO' },     // thinking
    oaks: { x: 498, y: 150, w: 120, h: 72, label: 'DĘBY' },             // Grep, Glob
    hill: { x: 594, y: 258, r: 32, label: 'WZGÓRZE' },                  // WebSearch
    nest2: { x: 462, y: 256, w: 50, h: 20, label: 'NOWY BARŁÓG' },      // Write
    brook: { x: 446, w: 10, label: 'STRUMIEŃ' },                        // inne narzędzia
    road: { y: 292, h: 18 },
    fence: { y: 326 },
    plots: { x: 8, y: 330, w: 124, h: 28, label: 'DZIAŁKI', hole: 70 }, // Edit
    bins: { x: 158, y: 330, w: 62, h: 28, label: 'ŚMIETNIKI', hole: 190 }, // WebFetch
    estate: { x: 380, y: 328, w: 252, h: 32, gates: [427, 567] },
  };
  // Dwa domy na skraju osiedla: stąd wychodzą ludzie, gdy dzik ma błąd.
  const HOUSES = [
    { x: 400, y: 328, w: 52, h: 28, roof: 0, door: 426 },
    { x: 540, y: 328, w: 52, h: 28, roof: 1, door: 566 },
  ];
  const LAMPS = [60, 240, 470, 620];
  const BUS = { x: 300, y: 316 };
  const PATH = [[372, 150], [408, 176], [404, 236], [362, 272], [334, 296]];

  const SEASONS = {
    wiosna: {
      name: 'Wiosna', tagline: 'Świeża zieleń, kwitnące drzewka, kałuże i płatki w powietrzu. Warchlaki właśnie przyszły na świat.',
      grass: ['#7fb257', '#8fc266', '#6f9e4a'], meadow: '#9ccc70', fern: '#4f9a3f', heather: ['#6f9e4a', '#86b65a'], sand: '#d8c890',
      spruce: ['#1e3d26', '#2a5636', '#3f7a4c'], birch: ['#b8e07a', '#d0ec96'], oak: ['#5f9a3e', '#7fb552', '#a0d070'], bush: '#4a8a48', juniper: ['#2f5a44', '#3f7a58'],
      soil: '#6b4a2f', mud: '#4e3622', water: '#5f8fb5', glint: '#d8ecff', litter: '#8a6a3c', path: '#b09a6a',
      road: '#4b4b52', pave: '#a8a49c', curb: '#d2cec4', fenceW: '#9a7446', fenceM: '#6d7078',
      wall: '#efe5d0', roofs: ['#9a3f36', '#5a6b86', '#7a4a3a', '#3a5a8a'], glass: '#bfe3ff',
      flowers: ['#ffffff', '#ffd23f', '#f59ac0', '#c8a0f0'], blossom: '#ffc0d8', crops: ['#5fa84a', '#8fc96a', '#3f8a3a'],
      label: '#fff8e6', snow: false, bare: false, fog: 0.06, vign: 0.14, drift: { col: ['#ffc0d8', '#ffffff', '#ffd6e6'], vx: 9, vy: 7, n: 16 },
    },
    lato: {
      name: 'Lato', tagline: 'Soczysta zieleń, łąka w kwiatach, wrzosy, motyle nad polaną i senne przedmieścia za drogą.',
      grass: ['#6f9f4a', '#7cab52', '#5f8c40'], meadow: '#8ebe62', fern: '#3f7a35', heather: ['#8a5a9a', '#b07ac0'], sand: '#d8c890',
      spruce: ['#1c3a22', '#275233', '#3a6d45'], birch: ['#8fc05a', '#a8d06a'], oak: ['#4a7a30', '#5f9a3e', '#7fb552'], bush: '#2f6b3a', juniper: ['#27503a', '#366a4c'],
      soil: '#6b4a2f', mud: '#4e3622', water: '#5a86a8', glint: '#c9e6ff', litter: '#8a6a3c', path: '#b09a6a',
      road: '#4b4b52', pave: '#a8a49c', curb: '#d2cec4', fenceW: '#9a7446', fenceM: '#6d7078',
      wall: '#efe5d0', roofs: ['#9a3f36', '#5a6b86', '#7a4a3a', '#3a5a8a'], glass: '#bfe3ff',
      flowers: ['#ffd23f', '#ffffff', '#e0405a', '#c8a0f0'], blossom: null, crops: ['#3f8a3a', '#6fb04a', '#c9402a'],
      label: '#fff8e6', snow: false, bare: false, fog: 0, vign: 0.16, drift: null,
    },
    jesien: {
      name: 'Jesień', tagline: 'Złote dęby i brzozy, liście w powietrzu, grzyby pod świerkami i mgła nad polaną. Sezon na żołędzie.',
      grass: ['#8c9a48', '#9aa852', '#7a8a40'], meadow: '#b0ac60', fern: '#9a6a2a', heather: ['#7a4a7a', '#9a6a9a'], sand: '#d0b880',
      spruce: ['#22382a', '#2e4f36', '#3f6646'], birch: ['#e0b83a', '#f0d060'], oak: ['#a85a1e', '#d08a2a', '#e8b23c'], bush: '#8a5a24', juniper: ['#2a4a3a', '#3a6650'],
      soil: '#6b4a2f', mud: '#4e3622', water: '#6a8aa0', glint: '#e8f0ff', litter: '#b07a3a', path: '#a8906a',
      road: '#4b4b52', pave: '#a8a49c', curb: '#d2cec4', fenceW: '#9a7446', fenceM: '#6d7078',
      wall: '#efe5d0', roofs: ['#9a3f36', '#5a6b86', '#7a4a3a', '#3a5a8a'], glass: '#dfe9f2',
      flowers: ['#e8a02a', '#ffffff', '#c86a2a', '#d8b060'], blossom: null, crops: ['#8a7a2a', '#b08a3a', '#c9402a'],
      label: '#fff8e6', snow: false, bare: false, fog: 0.16, vign: 0.2, drift: { col: ['#e8b23c', '#d08a2a', '#a85a1e', '#c84a2a'], vx: 10, vy: 9, n: 24 },
    },
    zima: {
      name: 'Zima', tagline: 'Śnieg na polanie, czapy na świerkach, lód na babrzysku i para z ryjów. Dziki szukają żeru pod śniegiem.',
      grass: ['#e6ecf2', '#f2f6fa', '#d4dde6'], meadow: '#eef2f6', fern: '#9aa8b4', heather: ['#8a7a7a', '#a89a98'], sand: '#e8ecf0',
      spruce: ['#1c3426', '#274a34', '#f4f8fc'], birch: ['#f0f4f8', '#ffffff'], oak: ['#5a3e26', '#6b4a2e', '#7a5a3a'], bush: '#6a7a6a', juniper: ['#2a4436', '#f0f4f8'],
      soil: '#5a4030', mud: '#4e3622', water: '#b8ccdc', glint: '#ffffff', litter: '#7a6a5a', path: '#d8dce4',
      road: '#5a5a62', pave: '#c8ccd2', curb: '#e8ecf0', fenceW: '#8a6a40', fenceM: '#6d7078',
      wall: '#efe5d0', roofs: ['#9a3f36', '#5a6b86', '#7a4a3a', '#3a5a8a'], glass: '#dfe9f2',
      flowers: [], blossom: null, crops: ['#8a7a6a', '#9a8a7a', '#6a5a4a'],
      label: '#2a3a4a', snow: true, bare: true, fog: 0.1, vign: 0.1, drift: { col: ['#ffffff', '#ffffff', '#e8f0ff'], vx: 3, vy: 11, n: 44 },
    },
  };
  const NIGHT = { wiosna: [20, 6], lato: [21, 5], jesien: [18, 7], zima: [17, 7] };
  function autoTheme(d = new Date()) {
    const m = d.getMonth() + 1, h = d.getHours();
    const season = m >= 3 && m <= 5 ? 'wiosna' : m >= 6 && m <= 8 ? 'lato' : m >= 9 && m <= 11 ? 'jesien' : 'zima';
    const [a, b] = NIGHT[season];
    return { season, night: h >= a || h < b };
  }

  // ---- drzewa i drobiazgi ----
  function spruce(R, x, y, s, th) {
    R(x - s + 1, y - 1, s * 2 - 2, 3, 'rgba(10,8,20,.3)');
    R(x - 1, y - 3, 3, 4, '#3a2416');
    for (let i = 0; i < s; i++) {
      const w = Math.max(2, Math.round(((s - i) / s) * s * 2) - 1), yy = y - 4 - i * 2;
      R(x - Math.floor(w / 2), yy, w, 2, i % 2 ? th.spruce[1] : th.spruce[0]);
      if (i % 2) R(x - Math.floor(w / 2) + 1, yy, Math.max(1, Math.floor(w / 3)), 1, th.snow ? '#f4f8fc' : th.spruce[2]);
    }
    R(x, y - 4 - s * 2, 1, 2, th.snow ? '#ffffff' : th.spruce[2]);
  }
  function birch(R, x, y, s, th) {
    R(x - s + 2, y - 1, s * 2 - 3, 2, 'rgba(10,8,20,.25)');
    R(x - 1, y - s * 2 + 2, 2, s * 2, '#f0f0ec'); R(x, y - s * 2 + 4, 1, 2, '#2a2a30'); R(x - 1, y - s + 1, 1, 2, '#2a2a30'); R(x, y - 4, 1, 1, '#2a2a30');
    if (th.bare) { for (let i = 0; i < 4; i++) { R(x - 4 + i * 3, y - s * 2 - 2 + i, 1, 3, '#e8e8e4'); R(x - 3 + i * 2, y - s * 2 - 4 + (i % 2) * 2, 2, 1, '#d8d8d4'); } return; }
    const cy = y - s * 2 - 1, r = s - 1;
    for (let dy = -r; dy <= r; dy++) { const hw = Math.round(Math.sqrt(r * r - dy * dy) * 0.8); if (hw < 1) continue; R(x - hw, cy + dy, hw * 2, 1, dy < 0 ? th.birch[1] : th.birch[0]); }
    for (let k = 0; k < 6; k++) R(x - r + 1 + ((k * 5) % (r * 2 - 2)), cy - r + 2 + ((k * 3) % (r * 2 - 3)), 1, 1, k % 2 ? shade(th.birch[0], -0.25) : '#ffffff');
  }
  function oakTree(R, x, y, s, th) {
    R(x - 2, y - 4, 5, 8, '#4a2e1a'); R(x - 3, y - 1, 7, 2, '#3a2416'); R(x - 1, y - 4, 1, 6, '#6a4a2a');
    R(x - s + 2, y - 2, s * 2 - 2, 3, 'rgba(10,8,20,.28)');
    if (th.bare) {
      for (let i = 0; i < 7; i++) { const a = -2.4 + i * 0.5, len = s - 2 - (i % 2) * 3; for (let k = 2; k < len; k++) R(Math.round(x + Math.cos(a) * k), Math.round(y - 6 + Math.sin(a) * k * 0.9), 1, 1, k < 4 ? '#4a2e1a' : '#6b4a2e'); }
      for (let i = 0; i < 9; i++) R(x - s + 3 + i * 3, y - s - 6 + (i % 3) * 3, 2, 1, '#ffffff');
      return;
    }
    const cy = y - s - 4;
    for (let dy = -s; dy <= s; dy++) { const hw = Math.round(Math.sqrt(s * s - dy * dy)); if (hw < 1) continue; R(x - hw, cy + dy, hw * 2, 1, dy > s * 0.4 ? shade(th.oak[0], -0.1) : th.oak[0]); }
    for (let dy = -s + 3; dy <= s - 4; dy++) { const hw = Math.round(Math.sqrt((s - 3) * (s - 3) - dy * dy)); if (hw < 1) continue; R(x - hw, cy + dy, hw * 2, 1, dy > 0 ? th.oak[0] : th.oak[1]); }
    for (let dy = -s + 5; dy <= -1; dy++) { const hw = Math.round(Math.sqrt((s - 6) * (s - 6) - (dy + 3) * (dy + 3))); if (hw < 1) continue; R(x - hw - 2, cy + dy, hw, 1, th.oak[2]); }
    for (let k = 0; k < s; k++) R(x - s + 3 + ((k * 7) % (s * 2 - 6)), cy - s + 4 + ((k * 5) % (s * 2 - 8)), 2, 1, k % 2 ? th.oak[2] : shade(th.oak[0], -0.2));
  }
  function pine(R, x, y, th) { // samotna sosna: wysoki pień, korona u góry
    R(x - 6, y - 1, 13, 3, 'rgba(10,8,20,.28)'); R(x - 1, y - 30, 3, 32, '#8a6a3c'); R(x - 1, y - 30, 1, 32, '#a88450'); R(x + 1, y - 30, 1, 32, '#5a4024');
    for (let i = 0; i < 4; i++) { const ww = 22 - i * 5, yy = y - 30 - i * 4; R(x - ww / 2, yy, ww, 5, i % 2 ? th.spruce[1] : th.spruce[2]); R(x - ww / 2 + 2, yy, Math.max(2, ww / 3), 1, th.snow ? '#ffffff' : shade(th.spruce[2], 0.3)); }
  }
  function juniper(R, x, y, h, th) { R(x - 4, y - 1, 9, 3, 'rgba(10,8,20,.25)'); for (let i = 0; i < h; i++) { const ww = 3 + Math.round(Math.sin((i / h) * Math.PI) * 4); R(x - Math.floor(ww / 2), y - h + i, ww, 1, i % 2 ? th.juniper[0] : th.juniper[1]); } R(x - 1, y - h + 1, 1, 2, shade(th.juniper[1], 0.3)); }
  function stump(R, x, y, th) { R(x - 4, y, 9, 3, 'rgba(10,8,20,.25)'); R(x - 4, y - 5, 8, 6, '#6b4a2a'); R(x - 4, y - 6, 8, 2, '#a88450'); R(x - 2, y - 6, 4, 1, '#c9a26a'); if (!th.snow) { R(x + 3, y - 3, 3, 2, '#d8a040'); R(x + 4, y - 1, 1, 2, '#f0e0c0'); } else R(x - 4, y - 7, 8, 2, '#ffffff'); }
  function log(R, x, y, th, len = 28) { R(x - 2, y + 2, len + 2, 3, 'rgba(10,8,20,.25)'); R(x, y - 3, len, 6, '#6b4a2a'); R(x, y - 3, len, 1, '#8a6a3c'); R(x + len - 1, y - 3, 3, 6, '#a88450'); R(x + len, y - 1, 1, 2, '#6b4a2a'); if (th.snow) R(x, y - 4, len, 2, '#ffffff'); else { R(x + 6, y - 5, 3, 2, th.fern); R(x + 14, y - 4, 2, 1, th.fern); } }
  function boulder(R, x, y, w, h, th) { R(x - 1, y + h - 2, w + 2, 3, 'rgba(10,8,20,.25)'); R(x, y, w, h, '#8a8a84'); R(x + 1, y - 1, w - 2, 1, '#b8b8b0'); R(x + 1, y, 3, 2, '#c8c8c0'); R(x + w - 3, y + h - 3, 3, 3, '#6a6a64'); if (th.snow) R(x, y - 2, w, 2, '#ffffff'); else { R(x + 2, y + h - 2, 2, 1, '#5a8a4a'); R(x + w - 5, y + 1, 2, 1, '#7a9a5a'); } }
  function fern(R, x, y, th) { R(x, y - 5, 1, 6, th.fern); R(x - 3, y - 3, 7, 1, th.fern); R(x - 2, y - 5, 5, 1, shade(th.fern, 0.2)); R(x - 4, y - 1, 9, 1, shade(th.fern, -0.15)); }
  function hoofprint(R, x, y, col) { R(x, y, 2, 3, col); R(x + 3, y, 2, 3, col); R(x, y + 4, 1, 1, col); R(x + 4, y + 4, 1, 1, col); }
  function bin(R, x, y, col, open) {
    R(x + 2, y + 15, 12, 2, 'rgba(10,8,20,.3)');
    R(x, y + 3, 12, 13, col); R(x, y + 3, 1, 13, shade(col, 0.25)); R(x + 11, y + 3, 1, 13, shade(col, -0.3)); R(x + 2, y + 7, 8, 1, shade(col, -0.25)); R(x + 2, y + 11, 8, 1, shade(col, -0.25));
    if (open) { R(x + 8, y - 4, 6, 7, shade(col, -0.1)); R(x + 7, y - 5, 2, 2, '#2a2a30'); } else { R(x - 1, y, 14, 4, shade(col, -0.1)); R(x + 4, y - 1, 4, 1, '#2a2a30'); }
    R(x + 1, y + 16, 2, 2, '#2a2a30'); R(x + 9, y + 16, 2, 2, '#2a2a30');
  }
  function snowRoof(R, x, y, w, rh) { R(x - 2, y, w + 4, 2, '#ffffff'); R(x - 2, y + 2, w + 4, 1, '#e8f0f8'); for (let k = x; k < x + w; k += 7) R(k, y + 3, 3, 1, '#ffffff'); R(x - 2, y + rh - 1, w + 4, 1, '#ffffff'); }
  const ellipseFill = (g, x, y, rx, ry, col) => { g.fillStyle = col; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };

  // Barłóg: małe zagłębienie z legowiskiem, inne otoczenie dla każdego projektu.
  function nest(R, g, n, c, th, r) {
    const { x, y } = n;
    switch (n.kind) {
      case 'wykrot': // wywrócony świerk: tarcza korzeni za barłogiem, pień w bok
        R(x - 22, y - 26, 44, 30, 'rgba(10,8,20,.25)');
        for (let dy = -24; dy <= 4; dy++) { const hw = Math.round(Math.sqrt(Math.max(0, 24 * 24 - (dy + 10) * (dy + 10)))); if (hw < 1) continue; R(x - hw, y + dy, hw * 2, 1, dy % 3 ? '#4a3220' : '#5a4028'); }
        for (let i = 0; i < 9; i++) { const a = -2.9 + i * 0.36; for (let k = 4; k < 20; k++) R(Math.round(x + Math.cos(a) * k), Math.round(y - 8 + Math.sin(a) * k * 0.9), 1, 1, k % 4 ? '#7a5a38' : '#a88450'); }
        R(x + 18, y - 14, 34, 7, '#6b4a2a'); R(x + 18, y - 14, 34, 1, '#8a6a3c'); R(x + 18, y - 8, 34, 1, '#4a3220');
        break;
      case 'paprocie': for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; fern(R, Math.round(x + Math.cos(a) * 22), Math.round(y + 2 + Math.sin(a) * 11), th); } break;
      case 'glaz': boulder(R, x - 20, y - 20, 40, 18, th); R(x - 14, y - 10, 28, 8, '#5a5a56'); R(x - 10, y - 9, 20, 6, '#3a3a38'); break;
      case 'jalowce': juniper(R, x - 26, y + 6, 20, th); juniper(R, x + 26, y + 4, 24, th); juniper(R, x - 10, y - 12, 18, th); juniper(R, x + 12, y - 12, 14, th); break;
      case 'swierk': spruce(R, x, y - 16, 14, th); break;
    }
    ellipseFill(g, x, y + 4, 24, 10, shade(th.soil, -0.25)); ellipseFill(g, x, y + 3, 21, 8, th.soil);
    for (let k = 0; k < 50; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(x + Math.cos(an) * d * 19), Math.round(y + 3 + Math.sin(an) * d * 7), 2, 1, k % 3 ? th.litter : shade(th.litter, 0.3)); }
    ellipseFill(g, x, y + 5, 11, 4, th.snow ? '#e0d4c0' : shade(th.litter, 0.2));
    for (let k = 0; k < 8; k++) R(x - 9 + Math.floor(r() * 18), y + 2 + Math.floor(r() * 6), 3, 1, k % 2 ? shade(th.litter, 0.45) : th.fern);
    if (n.kind === 'swierk') { R(x - 16, y - 2, 32, 4, th.spruce[1]); R(x - 12, y - 4, 24, 3, th.spruce[0]); }
    R(x - 27, y - 2, 2, 12, '#6b4a2a'); R(x - 30, y - 6, 8, 6, '#e8dcc0'); R(x - 29, y - 5, 6, 4, c); R(x - 30, y - 6, 8, 1, shade(c, -0.4));
    R(x + 24, y - 14, 2, 7, c); R(x + 26, y - 14, 1, 4, c);
  }

  function drawBg(R, g, th) {
    const r = rng(777);
    // ---- las z falistą ścianą ----
    // trzy plany: tył najciemniejszy (mgła w głębi), przód jaśniejszy; drzewa w rzędach z przesunięciem, z przodu większe
    const forestCol = th.snow ? '#2a4030' : th.spruce[0];
    for (let x = 0; x < W; x++) { const e = edgeY(x); R(x, 0, 1, e, shade(forestCol, -0.38)); R(x, Math.max(0, e - 52), 1, 52, shade(forestCol, -0.18)); R(x, Math.max(0, e - 24), 1, 24, forestCol); }
    for (let i = 0; i < 1400; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * 110); if (y < edgeY(x)) R(x, y, 2, 1, r() < 0.5 ? shade(th.spruce[1], -0.2) : shade(forestCol, -0.25)); }
    if (th.snow) for (let i = 0; i < 500; i++) { const x = Math.floor(r() * W), y = Math.floor(r() * 110); if (y < edgeY(x)) R(x, y, 2, 1, '#dce8f0'); }
    const thBack = { ...th, spruce: th.spruce.map((c) => shade(c, -0.28)), birch: th.birch.map((c) => shade(c, -0.25)) };
    const thMid = { ...th, spruce: th.spruce.map((c) => shade(c, -0.12)), birch: th.birch.map((c) => shade(c, -0.1)) };
    const trees = [];
    for (let row = 0; row < 7; row++) for (let x = -6 + (row % 2) * 7; x < W + 6; x += 13) {
      const xx = x + Math.floor(r() * 9) - 4, yy = row * 13 + 6 + Math.floor(r() * 8), e = edgeY(xx);
      if (yy > e - 3) continue;
      if (activeNests().some((n) => Math.abs(n.x - xx) < 34 && yy > n.y - 28 && yy < n.y + 24)) continue;
      if (Math.abs(xx - P.base.x) < 46 && yy > 34) continue;
      const depth = yy / e;
      trees.push({ x: xx, y: yy, depth, s: 4 + Math.round(depth * 5) + Math.floor(r() * 2), birch: r() < (depth < 0.45 ? 0.06 : 0.16) });
    }
    trees.sort((a, b) => a.y - b.y);
    for (const t of trees) { const tt = t.depth < 0.4 ? thBack : t.depth < 0.72 ? thMid : th; if (t.birch) birch(R, t.x, t.y, Math.max(4, Math.min(7, t.s - 1)), tt); else spruce(R, t.x, t.y, t.s, tt); }
    activeNests().forEach((n, i) => nest(R, g, n, (AW.projects[i] || { color: AW.TEAM[i] }).color, th, r));
    // leśne drobiazgi: pniaki z grzybami, kłody, mrowisko, dziupla z sową
    stump(R, 126, 84, th); stump(R, 404, 60, th); log(R, 222, 76, th, 24); log(R, 536, 88, th, 22);
    R(640 - 46, 84, 14, 6, '#6b4a2a'); R(640 - 44, 80, 10, 5, '#7a5a38'); R(640 - 41, 77, 4, 4, '#8a6a48'); for (let k = 0; k < 10; k++) R(640 - 45 + (k * 5) % 12, 81 + (k % 3) * 3, 1, 1, '#2a1a10');
    R(16, 44, 10, 40, '#4a3220'); R(18, 42, 6, 3, '#5a4028'); R(18, 54, 6, 7, '#140c08'); R(19, 56, 1, 1, '#ffd23f'); R(22, 56, 1, 1, '#ffd23f'); R(20, 58, 2, 1, '#c88a3a');
    // skraj lasu: paprocie i krzaki wzdłuż fali
    for (let x = 0; x < W; x += 6) { const jx = x + Math.floor(r() * 5) - 2, y = edgeY(jx) + 1 + Math.floor(r() * 4); if (Math.abs(jx - P.base.x) < 30 || r() < 0.3) continue; fern(R, jx, y, th); if (r() < 0.3) { R(jx + 2, y - 8, 5, 5, th.bush); R(jx + 3, y - 9, 3, 1, shade(th.bush, 0.3)); } }
    // ---- polana ----
    for (let x = 0; x < W; x++) R(x, edgeY(x), 1, P.road.y - 4 - edgeY(x), th.grass[0]);
    // plamy jaśniejszej i ciemniejszej trawy (nierówna łąka), cień pod ścianą lasu
    if (!th.snow) for (let k = 0; k < 14; k++) { const x = Math.floor(r() * W), y = 100 + Math.floor(r() * 180), rx = 24 + Math.floor(r() * 40), ry = 8 + Math.floor(r() * 12); if (Math.abs(x - P.base.x) < 60 && y < 170) continue; ellipseFill(g, x, y, rx, ry, shade(th.grass[0], k % 2 ? 0.06 : -0.06)); }
    for (let x = 0; x < W; x++) { const e = edgeY(x); R(x, e, 1, 4, shade(th.grass[0], th.snow ? -0.06 : -0.16)); R(x, e + 4, 1, 3, shade(th.grass[0], th.snow ? -0.03 : -0.08)); }
    for (let i = 0; i < 2600; i++) { const x = Math.floor(r() * W), y = 70 + Math.floor(r() * 220); if (y < edgeY(x) || y >= P.road.y - 4) continue; R(x, y, 2, 1, r() < 0.45 ? th.grass[1] : th.grass[2]); if (!th.snow && r() < 0.08) R(x, y - 2, 1, 3, th.grass[2]); }
    // łąki z wysoką trawą, wrzosowisko, piaszczysko, mech
    for (const [mx, my, rx, ry] of [[270, 160, 46, 16], [92, 252, 40, 14], [560, 110, 30, 10]]) {
      ellipseFill(g, mx, my, rx, ry, th.meadow);
      for (let k = 0; k < rx * 2; k++) { const an = r() * 7, d = Math.sqrt(r()); const x = Math.round(mx + Math.cos(an) * d * rx), y = Math.round(my + Math.sin(an) * d * ry); R(x, y - 4, 1, 5, th.grass[2]); R(x + 1, y - 3, 1, 2, shade(th.meadow, 0.25)); if (th.flowers.length && k % 5 === 0) R(x - 1, y - 5, 2, 1, th.flowers[k % th.flowers.length]); }
    }
    { const hx = 272, hy = 268, rx = 44, ry = 12; ellipseFill(g, hx, hy, rx, ry, shade(th.grass[2], -0.05)); for (let k = 0; k < 260; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(hx + Math.cos(an) * d * rx), Math.round(hy + Math.sin(an) * d * ry), 2, 1, k % 3 ? th.heather[0] : th.heather[1]); } }
    { const sx = 236, sy = 196, rx = 30, ry = 9; ellipseFill(g, sx, sy, rx + 2, ry + 1, shade(th.sand, -0.2)); ellipseFill(g, sx, sy, rx, ry, th.sand); for (let k = 0; k < 40; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(sx + Math.cos(an) * d * rx), Math.round(sy + Math.sin(an) * d * ry), 1, 1, k % 2 ? shade(th.sand, 0.3) : shade(th.sand, -0.15)); } }
    if (th.flowers.length) for (let i = 0; i < 60; i++) { const x = Math.floor(r() * W), y = 100 + Math.floor(r() * 180); if (y < edgeY(x) + 4 || y > P.road.y - 8) continue; if (Math.abs(x - P.wallow.x) < 60 && Math.abs(y - P.wallow.y) < 30) continue; if (Math.abs(x - P.base.x) < 60 && y < P.base.y + 30) continue; R(x, y, 2, 2, th.flowers[i % th.flowers.length]); R(x, y + 2, 1, 2, th.grass[2]); }
    for (let i = 0; i < 7; i++) { const x = 30 + Math.floor(r() * 580), y = 120 + Math.floor(r() * 150); if (Math.abs(x - 372) < 60 && y < 160) continue; R(x - 3, y - 2, 7, 3, shade(th.soil, 0.1)); R(x - 2, y - 3, 5, 2, shade(th.soil, 0.2)); }
    // kępy trawy, kamyki, grzyby pod lasem, pojedyncze krzaki
    const free = (x, y) => !(Math.abs(x - P.base.x) < 62 && y < P.base.y + 34) && !(Math.abs(x - P.wallow.x) < 62 && Math.abs(y - P.wallow.y) < 28) && !(Math.abs(x - P.brook.x) < 16);
    if (!th.snow) for (let i = 0; i < 90; i++) { const x = Math.floor(r() * W), y = 96 + Math.floor(r() * 190); if (y < edgeY(x) + 3 || y > P.road.y - 8 || !free(x, y)) continue; const c = shade(th.grass[2], -0.12); R(x, y - 3, 1, 4, c); R(x - 2, y - 2, 1, 3, c); R(x + 2, y - 2, 1, 3, c); R(x, y - 4, 1, 1, shade(th.grass[1], 0.2)); }
    for (let i = 0; i < 26; i++) { const x = Math.floor(r() * W), y = 100 + Math.floor(r() * 180); if (y < edgeY(x) + 3 || y > P.road.y - 8 || !free(x, y)) continue; R(x, y, 2, 1, th.snow ? '#b8c4d0' : '#8a8a84'); R(x, y - 1, 1, 1, th.snow ? '#e0e8f0' : '#b8b8b0'); }
    if (!th.snow) for (let i = 0; i < 16; i++) { const x = Math.floor(r() * W), e = edgeY(x), y = e + 6 + Math.floor(r() * 26); if (!free(x, y) || y > P.road.y - 20) continue; const red = th.season === 'jesien' ? i % 2 === 0 : i % 4 === 0; R(x, y - 2, 1, 3, '#e8dcc0'); R(x - 1, y - 4, 3, 2, red ? '#c83a2a' : '#c9a26a'); if (red) R(x, y - 4, 1, 1, '#ffffff'); if (i % 3 === 0) { R(x + 3, y - 1, 1, 2, '#e8dcc0'); R(x + 2, y - 2, 3, 1, red ? '#c83a2a' : '#b08a4a'); } }
    for (const [bx, by] of [[62, 154], [122, 282], [628, 146], [250, 284], [330, 286]]) { if (by > P.road.y - 6) continue; R(bx - 6, by + 2, 13, 2, 'rgba(10,8,20,.22)'); R(bx - 6, by - 7, 12, 9, th.bush); R(bx - 4, by - 9, 8, 3, shade(th.bush, 0.22)); R(bx - 2, by - 8, 3, 1, shade(th.bush, 0.5)); if (th.snow) R(bx - 6, by - 10, 12, 3, '#ffffff'); else if (th.flowers.length && by % 2 === 0) R(bx + 1, by - 6, 2, 2, th.flowers[0]); }
    // ścieżka od bazy do drogi
    for (let i = 0; i < PATH.length - 1; i++) {
      const [x0, y0] = PATH[i], [x1, y1] = PATH[i + 1], n = Math.hypot(x1 - x0, y1 - y0);
      for (let k = 0; k <= n; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n); R(x - 3, y, 7, 1, shade(th.path, -0.12)); R(x - 1, y, 3, 1, th.path); if (k % 9 === 0) R(x + (k % 2 ? 2 : -3), y, 2, 1, shade(th.path, -0.3)); }
    }
    // strumień z kładką
    for (let y = 60; y < P.road.y + 2; y += 2) { const x = P.brook.x + Math.round(Math.sin(y / 20) * 7); if (y < edgeY(x) - 2 && y < 80) continue; if (y >= edgeY(x)) { R(x - 5, y, P.brook.w + 10, 2, shade(th.grass[0], th.snow ? -0.05 : -0.14)); R(x - 3, y, 1, 2, th.snow ? '#d8e0e8' : th.sand); R(x + P.brook.w + 2, y, 1, 2, th.snow ? '#d8e0e8' : th.sand); } R(x - 2, y, P.brook.w + 4, 2, th.snow ? '#c8d4dc' : th.mud); R(x, y, P.brook.w, 2, th.water); R(x + 2, y, P.brook.w - 5, 2, shade(th.water, 0.1)); if (y % 6 === 0) R(x + 2 + (y % 4), y, 3, 1, th.glint); if (y % 8 === 4) R(x + 1, y, 2, 1, shade(th.water, -0.18)); }
    if (!th.snow) for (const [dx, y, n] of [[-9, 108, 3], [14, 140, 2], [-10, 190, 3], [15, 222, 3], [-9, 254, 2], [14, 272, 2]]) { const x = P.brook.x + Math.round(Math.sin(y / 20) * 7) + dx; if (y < edgeY(x)) continue; for (let k = 0; k < n; k++) { R(x + k * 2, y - 9 + (k % 2) * 2, 1, 9, th.fern); R(x + k * 2, y - 11 + (k % 2) * 2, 1, 3, '#6b4a2a'); } }
    for (const [dx, y] of [[-6, 120], [12, 150], [-5, 200], [13, 236], [-4, 268]]) { const x = P.brook.x + Math.round(Math.sin(y / 20) * 7) + dx; R(x, y, 4, 3, '#8a8a84'); R(x, y, 4, 1, '#b8b8b0'); }
    { const y = 178, x = P.brook.x + Math.round(Math.sin(y / 20) * 7); R(x - 6, y - 2, P.brook.w + 12, 7, '#8a6a3c'); for (let k = x - 6; k < x + P.brook.w + 6; k += 3) R(k, y - 2, 1, 7, '#6b4a2a'); R(x - 6, y - 4, P.brook.w + 12, 1, '#5a4024'); R(x - 6, y + 5, P.brook.w + 12, 1, '#5a4024'); }
    for (let k = 0; k < 30; k++) { const y = 100 + Math.floor(r() * 180), x = P.brook.x + Math.round(Math.sin(y / 20) * 7) + (k % 2 ? 12 + Math.floor(r() * 8) : -6 - Math.floor(r() * 8)); if (y < edgeY(x)) continue; R(x, y, 2, 2, shade(th.grass[1], 0.15)); }
    // święty dąb i baza dzików: ziemianka z palisadą, bramą, wieżą, sztandarem i totemem
    oakTree(R, P.base.x, P.base.y - 38, 17, th);
    const B = P.base;
    ellipseFill(g, B.x, B.y - 18, 44, 18, 'rgba(10,8,20,.25)');
    ellipseFill(g, B.x, B.y - 20, 42, 17, shade(th.soil, -0.25)); ellipseFill(g, B.x, B.y - 22, 40, 15, th.soil);
    ellipseFill(g, B.x, B.y - 26, 36, 10, th.snow ? '#f2f6fa' : th.meadow);
    for (let k = 0; k < 90; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(B.x + Math.cos(an) * d * 34), Math.round(B.y - 26 + Math.sin(an) * d * 9), 2, 1, k % 3 ? th.grass[2] : shade(th.meadow, 0.25)); }
    for (let k = 0; k < 40; k++) R(B.x - 36 + Math.floor(r() * 72), B.y - 14 + Math.floor(r() * 7), 2, 1, k % 2 ? shade(th.soil, -0.2) : shade(th.soil, 0.25));
    R(B.x - 7, B.y - 16, 14, 12, '#140c08'); R(B.x - 9, B.y - 18, 18, 3, '#6b4a2a'); R(B.x - 9, B.y - 18, 2, 14, '#6b4a2a'); R(B.x + 7, B.y - 18, 2, 14, '#6b4a2a'); R(B.x - 8, B.y - 19, 16, 1, '#8a6a3c');
    R(B.x - 2, B.y - 13, 4, 2, '#ffd23f'); // lampka nad wejściem
    // palisada z bramą, pochodnie, kosz ogniowy
    for (let x = B.x - 44; x <= B.x + 44; x += 4) { if (Math.abs(x - B.x) < 10) continue; const h = 9 + ((x / 4) % 3); R(x, B.y - 2 - h, 3, h + 4, '#8a6a3c'); R(x, B.y - 2 - h, 1, h + 4, '#a88450'); R(x + 2, B.y - 2 - h, 1, h + 4, '#5a4024'); R(x + 1, B.y - 3 - h, 1, 1, '#a88450'); }
    R(B.x - 44, B.y - 6, 88, 1, '#5a4024'); R(B.x - 44, B.y + 1, 88, 1, '#5a4024');
    for (const gx of [B.x - 12, B.x + 10]) { R(gx, B.y - 16, 3, 20, '#5a4024'); R(gx - 1, B.y - 17, 5, 2, '#8a6a3c'); R(gx, B.y - 21, 3, 4, '#3a2416'); }
    R(B.x - 9, B.y - 18, 18, 2, '#8a6a3c'); R(B.x - 6, B.y - 22, 12, 4, '#e8dcc0'); R(B.x - 5, B.y - 21, 10, 2, '#a3262a');
    R(B.x - 26, B.y + 12, 10, 8, '#2a2a30'); R(B.x - 25, B.y + 11, 8, 1, '#4a4a52'); R(B.x - 24, B.y + 19, 2, 3, '#2a2a30'); R(B.x - 18, B.y + 19, 2, 3, '#2a2a30');
    // wieża strażnicza (prawa) i sztandar z szablami (lewy), totem, stos żołędzi
    const tw = B.x + 52;
    R(tw - 8, B.y + 4, 2, 22, '#5a4024'); R(tw + 6, B.y + 4, 2, 22, '#5a4024'); R(tw - 7, B.y + 10, 14, 1, '#6b4a2a'); R(tw - 7, B.y + 18, 14, 1, '#6b4a2a'); R(tw - 6, B.y + 12, 12, 6, 'rgba(0,0,0,.15)');
    R(tw - 10, B.y + 2, 20, 3, '#8a6a3c'); R(tw - 10, B.y - 8, 2, 10, '#8a6a3c'); R(tw + 8, B.y - 8, 2, 10, '#8a6a3c'); R(tw - 9, B.y - 4, 18, 1, '#8a6a3c'); R(tw - 12, B.y - 12, 24, 4, '#6b4a2a'); R(tw - 9, B.y - 15, 18, 3, '#6b4a2a'); if (th.snow) R(tw - 12, B.y - 14, 24, 2, '#ffffff');
    const fp = B.x - 54;
    R(fp, B.y - 30, 2, 36, '#5a4024'); R(fp + 2, B.y - 30, 16, 11, '#a3262a'); R(fp + 2, B.y - 30, 16, 1, '#c84a3a'); R(fp + 6, B.y - 27, 2, 5, '#f2eadb'); R(fp + 12, B.y - 27, 2, 5, '#f2eadb'); R(fp + 7, B.y - 23, 6, 1, '#f2eadb'); R(fp + 16, B.y - 26, 2, 3, '#a3262a');
    R(B.x - 40, B.y - 2, 5, 18, '#6b4a2a'); R(B.x - 40, B.y - 2, 5, 4, '#4a3a2a'); R(B.x - 41, B.y + 2, 7, 2, '#f2eadb'); R(B.x - 42, B.y + 1, 2, 2, '#f2eadb'); R(B.x - 36, B.y + 1, 2, 2, '#f2eadb'); R(B.x - 39, B.y + 6, 3, 1, '#ffd23f'); R(B.x - 41, B.y + 10, 7, 2, '#f2eadb');
    for (let k = 0; k < 9; k++) { const x = B.x + 24 + (k % 4) * 3 + Math.floor(k / 4), y = B.y + 10 - Math.floor(k / 4) * 2; R(x, y, 2, 2, '#8a5a2a'); R(x, y, 2, 1, '#4a2e1a'); }
    // samotne drzewa, głazy, kłoda na polanie
    birch(R, 168, 206, 7, th); pine(R, 392, 262, th); birch(R, 556, 232, 6, th);
    boulder(R, 158, 128, 12, 7, th); boulder(R, 300, 254, 9, 5, th); boulder(R, 610, 190, 16, 9, th); log(R, 212, 150, th, 26);
    // buchtowisko
    const b = P.bucht;
    ellipseFill(g, b.x + b.w / 2, b.y + b.h / 2 + 2, b.w / 2, b.h / 2, shade(th.soil, -0.3)); ellipseFill(g, b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 2, b.h / 2 - 2, th.soil);
    for (let k = 0; k < 150; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(b.x + b.w / 2 + Math.cos(an) * d * (b.w / 2 - 4)), Math.round(b.y + b.h / 2 + Math.sin(an) * d * (b.h / 2 - 4)), 2 + Math.floor(r() * 2), 1, k % 4 ? shade(th.soil, -0.2) : shade(th.soil, 0.3)); }
    for (const [x, y] of [[b.x + 14, b.y + 10], [b.x + 60, b.y + 28], [b.x + 88, b.y + 12]]) { R(x, y, 10, 2, '#8a6a4a'); R(x + 8, y - 2, 2, 4, '#8a6a4a'); R(x + 3, y + 2, 4, 1, shade(th.soil, -0.35)); }
    // tropy
    const tr = P.tracks;
    ellipseFill(g, tr.x + tr.w / 2, tr.y + tr.h / 2, tr.w / 2, tr.h / 2, th.snow ? '#d8e0e8' : shade(th.mud, 0.35));
    for (let k = 0; k < 60; k++) { const an = r() * 7, d = Math.sqrt(r()); R(Math.round(tr.x + tr.w / 2 + Math.cos(an) * d * (tr.w / 2 - 3)), Math.round(tr.y + tr.h / 2 + Math.sin(an) * d * (tr.h / 2 - 3)), 2, 1, th.snow ? '#c0ccd8' : shade(th.mud, 0.5)); }
    for (let k = 0; k < 6; k++) hoofprint(R, tr.x + 12 + k * 12, tr.y + 6 + (k % 2) * 7, th.snow ? '#9aa8b8' : shade(th.mud, -0.2));
    // babrzysko (zimą zamarznięte) z trzciną i kamieniami
    const w = P.wallow;
    ellipseFill(g, w.x, w.y + 2, w.rx + 12, w.ry + 8, shade(th.mud, 0.25));
    for (let k = 0; k < 180; k++) { const an = r() * 7, d = 0.75 + Math.sqrt(r()) * 0.35; R(Math.round(w.x + Math.cos(an) * d * (w.rx + 9)), Math.round(w.y + 2 + Math.sin(an) * d * (w.ry + 5)), 2, 1, k % 3 ? th.mud : shade(th.mud, 0.45)); }
    ellipseFill(g, w.x, w.y, w.rx, w.ry, th.mud); ellipseFill(g, w.x, w.y, w.rx - 6, w.ry - 5, th.snow ? th.water : shade(th.water, -0.25));
    if (th.snow) { for (let k = 0; k < 6; k++) R(w.x - 28 + k * 10, w.y - 7 + (k % 3) * 5, 8, 1, '#ffffff'); R(w.x - 10, w.y - 2, 14, 1, '#8aa0b4'); R(w.x + 4, w.y - 1, 8, 1, '#8aa0b4'); }
    for (const [dx, dy] of [[-28, -7], [24, 5], [-8, 11], [30, -9]]) { R(w.x + dx, w.y + dy, 5, 3, '#8a8a84'); R(w.x + dx, w.y + dy, 5, 1, '#b8b8b0'); }
    for (const [dx, dy] of [[-48, 9], [46, 3], [-42, -11], [40, -13]]) { R(w.x + dx, w.y + dy - 6, 1, 8, th.fern); R(w.x + dx + 2, w.y + dy - 8, 1, 10, th.fern); R(w.x + dx + 1, w.y + dy - 11, 2, 4, '#6b4a2a'); }
    // dęby z żołędziami
    const o = P.oaks;
    for (let k = 0; k < 110; k++) R(o.x + 6 + Math.floor(r() * (o.w - 12)), o.y + 34 + Math.floor(r() * (o.h - 38)), 2, 1, k % 3 ? th.litter : th.grass[2]);
    for (let k = 0; k < 24; k++) { const x = o.x + 10 + Math.floor(r() * (o.w - 20)), y = o.y + 38 + Math.floor(r() * (o.h - 44)); R(x, y, 2, 2, '#8a5a2a'); R(x, y, 2, 1, '#4a2e1a'); }
    oakTree(R, o.x + 30, o.y + 42, 14, th); oakTree(R, o.x + 90, o.y + 48, 12, th);
    // czochradło
    const rb = P.rub;
    R(rb.x + 6, rb.y + 26, 12, 3, 'rgba(10,8,20,.3)'); R(rb.x + 8, rb.y, 7, 28, '#8a6a3c'); R(rb.x + 8, rb.y, 2, 28, '#a88450'); R(rb.x + 13, rb.y, 2, 28, '#5a4024');
    R(rb.x + 7, rb.y + 14, 9, 8, '#c9a26a'); R(rb.x + 6, rb.y + 16, 11, 4, '#6b4a2f'); R(rb.x + 9, rb.y + 18, 5, 2, shade('#6b4a2f', 0.3));
    for (let i = 0; i < 4; i++) { const yy = rb.y - 6 + i * 4, ww = 10 + i * 6; R(rb.x + 11 - ww / 2, yy, ww, 3, i % 2 ? th.spruce[1] : th.spruce[2]); }
    // paśnik
    const fd = P.feeder;
    R(fd.x + 4, fd.y + 20, fd.w, 4, 'rgba(10,8,20,.3)'); R(fd.x + 2, fd.y + 9, fd.w - 4, 9, '#8a6a3c'); R(fd.x + 2, fd.y + 9, fd.w - 4, 1, '#a88450');
    for (const px of [fd.x + 4, fd.x + fd.w - 7]) R(px, fd.y + 5, 3, 19, '#5a4024');
    R(fd.x + 6, fd.y + 11, fd.w - 12, 5, '#d9b04a'); R(fd.x + 8, fd.y + 10, 10, 2, '#e8c860');
    R(fd.x - 2, fd.y + 1, fd.w + 4, 6, '#6b4a2f'); R(fd.x + 2, fd.y - 3, fd.w - 4, 5, '#6b4a2f'); R(fd.x + 2, fd.y - 3, fd.w - 4, 1, shade('#6b4a2f', 0.3)); if (th.snow) R(fd.x + 2, fd.y - 5, fd.w - 4, 3, '#ffffff');
    // gąszcz leszczyny
    const tk = P.thicket;
    for (let k = 0; k < 9; k++) { const x = tk.x + 4 + (k % 5) * 11, y = tk.y + 6 + Math.floor(k / 5) * 9; R(x - 4, y + 6, 9, 2, 'rgba(10,8,20,.25)'); R(x - 5, y - 6, 11, 12, k % 2 ? th.bush : shade(th.bush, 0.2)); R(x - 3, y - 8, 7, 4, shade(th.bush, 0.3)); R(x - 2, y - 7, 2, 1, shade(th.bush, 0.6)); if (th.snow) R(x - 4, y - 9, 9, 2, '#ffffff'); }
    // nowy barłóg
    const n2 = P.nest2;
    ellipseFill(g, n2.x + n2.w / 2, n2.y + n2.h / 2 + 2, n2.w / 2, n2.h / 2, shade(th.soil, -0.1));
    for (let k = 0; k < 6; k++) { const x = n2.x + 6 + k * 6, y = n2.y + 4 + (k % 3) * 4; R(x, y, 12, 2, '#6b4a2a'); R(x + 2, y - 1, 8, 1, '#8a6a3c'); }
    // wzgórze z drogowskazem
    const hl = P.hill;
    ellipseFill(g, hl.x, hl.y + 4, hl.r, hl.r * 0.5, shade(th.grass[2], -0.1)); ellipseFill(g, hl.x, hl.y, hl.r - 4, hl.r * 0.42, th.meadow); ellipseFill(g, hl.x - 4, hl.y - 4, hl.r - 14, hl.r * 0.2, shade(th.meadow, 0.2));
    for (let k = 0; k < 10; k++) { const x = hl.x - 22 + Math.floor(r() * 44), y = hl.y - 6 + Math.floor(r() * 14); R(x, y - 3, 1, 4, th.grass[2]); R(x + 2, y - 2, 1, 3, th.grass[2]); }
    R(hl.x + 18, hl.y - 10, 2, 22, '#6b4a2a'); R(hl.x + 12, hl.y - 12, 14, 4, '#c9a26a'); R(hl.x + 14, hl.y - 6, 12, 4, '#c9a26a'); R(hl.x + 14, hl.y - 11, 8, 1, '#5a4024'); R(hl.x + 16, hl.y - 5, 8, 1, '#5a4024');
    // ---- przedmieścia: wąski pas ----
    const rd = P.road;
    R(0, rd.y - 4, W, 4, shade(th.grass[2], -0.2));
    R(0, rd.y, W, rd.h, th.road); R(0, rd.y, W, 1, th.curb); R(0, rd.y + rd.h - 1, W, 1, th.curb);
    for (let x = 4; x < W; x += 20) R(x, rd.y + 8, 10, 2, '#d8d4c4');
    for (let k = 0; k < 100; k++) R(Math.floor(r() * W), rd.y + 2 + Math.floor(r() * (rd.h - 4)), 2, 1, shade(th.road, k % 2 ? 0.1 : -0.15));
    for (const [px, pw] of [[150, 16], [398, 12], [560, 20]]) R(px, rd.y + 3 + (px % 5), pw, 4, shade(th.road, -0.1));
    R(212, rd.y + 12, 8, 4, shade(th.road, -0.3)); R(213, rd.y + 13, 6, 2, shade(th.road, 0.15)); for (let k = 0; k < 3; k++) R(213 + k * 2, rd.y + 13, 1, 2, shade(th.road, -0.3));
    R(520, rd.y + rd.h - 4, 10, 3, '#2a2a30'); for (let k = 0; k < 4; k++) R(521 + k * 2, rd.y + rd.h - 3, 1, 1, '#5a5a62');
    if (th.snow) for (let x = 0; x < W; x += 3) { R(x, rd.y, 2, 2, '#e8ecf0'); R(x + 1, rd.y + rd.h - 2, 2, 2, '#e8ecf0'); }
    const br = P.brook.x + Math.round(Math.sin((rd.y - 2) / 20) * 7); R(br - 4, rd.y - 4, P.brook.w + 8, 5, '#8a8a84'); R(br - 2, rd.y - 3, P.brook.w + 4, 3, '#2a2a30');
    R(0, rd.y + rd.h, W, 8, th.pave); for (let x = 0; x < W; x += 12) R(x, rd.y + rd.h, 1, 8, shade(th.pave, -0.15));
    for (const cx of [88, 262, 430, 598]) { R(cx, rd.y + rd.h + 2, 1, 3, shade(th.pave, -0.3)); R(cx + 1, rd.y + rd.h + 4, 2, 1, shade(th.pave, -0.3)); R(cx + 3, rd.y + rd.h + 5, 1, 2, shade(th.pave, -0.3)); }
    R(0, rd.y + rd.h + 8, W, H - rd.y - rd.h - 8, th.grass[0]);
    for (let i = 0; i < 400; i++) R(Math.floor(r() * W), rd.y + rd.h + 8 + Math.floor(r() * 42), 2, 1, r() < 0.5 ? th.grass[1] : th.grass[2]);
    // żywopłot z kwiatami między śmietnikami a przystankiem, ławka przy przystanku
    { const fy = P.fence.y; for (let x = 232; x < 288; x += 7) { R(x, fy + 6, 8, 3, 'rgba(10,8,20,.22)'); R(x, fy - 3, 8, 10, th.snow ? '#6a7a6a' : th.bush); R(x + 1, fy - 5, 6, 3, th.snow ? '#ffffff' : shade(th.bush, 0.22)); if (!th.snow && th.flowers.length && x % 14 === 0) R(x + 3, fy - 2, 2, 2, th.flowers[(x / 7) % th.flowers.length]); } }
    R(338, BUS.y + 2, 18, 3, '#8a6a3c'); R(338, BUS.y + 5, 18, 1, '#5a4024'); R(339, BUS.y + 6, 2, 4, '#5a4024'); R(353, BUS.y + 6, 2, 4, '#5a4024'); R(338, BUS.y - 2, 18, 2, '#8a6a3c'); if (th.snow) R(338, BUS.y + 1, 18, 1, '#ffffff');
    // przystanek
    R(BUS.x - 2, BUS.y + 8, 30, 3, 'rgba(10,8,20,.25)'); R(BUS.x, BUS.y - 2, 26, 12, '#8ab0c8'); R(BUS.x, BUS.y - 2, 26, 1, '#c8e0f0'); R(BUS.x + 2, BUS.y, 22, 7, '#5a7a8a'); R(BUS.x - 2, BUS.y - 6, 30, 5, '#3a4a5a'); R(BUS.x + 28, BUS.y - 8, 2, 18, '#2a2a30'); R(BUS.x + 26, BUS.y - 10, 6, 4, '#ffd23f'); R(BUS.x + 10, BUS.y + 2, 6, 3, '#ffffff');
    // płoty: drewniany z dziurami przy działkach i śmietnikach, siatka z furtkami przy domach
    const fy = P.fence.y;
    for (let x = 0; x < 236; x += 5) { if (Math.abs(x - P.plots.hole) < 8 || Math.abs(x - P.bins.hole) < 8) continue; R(x, fy - 8, 3, 11, th.fenceW); R(x, fy - 8, 3, 1, shade(th.fenceW, 0.3)); R(x, fy - 9, 1, 1, th.fenceW); }
    R(0, fy - 4, 236, 1, shade(th.fenceW, -0.25)); R(0, fy + 1, 236, 1, shade(th.fenceW, -0.25));
    for (const hx of [P.plots.hole, P.bins.hole]) { R(hx - 7, fy - 2, 14, 4, th.soil); R(hx - 5, fy - 5, 3, 4, shade(th.fenceW, -0.4)); R(hx + 3, fy - 6, 2, 3, shade(th.fenceW, -0.4)); }
    for (let x = 380; x < W; x += 2) { if (P.estate.gates.some((gx) => Math.abs(gx - x) < 6)) continue; R(x, fy - 7, 1, 1, th.fenceM); R(x, fy - 1, 1, 1, th.fenceM); for (let y = fy - 7; y < fy; y += 2) if ((x / 2 + y / 2) % 2 === 0) R(x, y, 1, 1, shade(th.fenceM, 0.25)); }
    for (let x = 380; x < W; x += 24) if (!P.estate.gates.some((gx) => Math.abs(gx - x) < 8)) R(x, fy - 9, 2, 12, th.fenceM);
    for (const gx of P.estate.gates) { R(gx - 7, fy - 10, 2, 13, th.fenceM); R(gx + 5, fy - 10, 2, 13, th.fenceM); R(gx - 5, fy - 8, 10, 1, th.fenceM); R(gx - 5, fy - 2, 10, 1, th.fenceM); R(gx - 5, fy + 3, 10, 8, th.pave); }
    // działki: trzy grządki, szklarnia, kompost
    const pl = P.plots;
    R(pl.x, pl.y, pl.w, pl.h, shade(th.grass[0], -0.05));
    for (let i = 0; i < 3; i++) {
      const x = pl.x + 6 + i * 32, y = pl.y + 6;
      R(x, y, 26, 20, th.snow ? '#8a7a6a' : th.soil); R(x, y, 26, 1, shade(th.soil, -0.35));
      if (th.snow) { for (let yy = y + 2; yy < y + 19; yy += 5) R(x + 1, yy, 24, 2, '#eef2f6'); continue; }
      for (let yy = y + 3; yy < y + 19; yy += 6) for (let xx = x + 2; xx < x + 25; xx += 6) { const c = th.crops[(i + Math.floor((yy - y) / 6)) % 3]; R(xx, yy, 3, 3, c); R(xx + 1, yy - 1, 1, 1, shade(c, 0.3)); }
    }
    R(pl.x + 102, pl.y + 4, 20, 16, '#c9d8e0'); R(pl.x + 102, pl.y + 4, 20, 1, '#ffffff'); for (let x = pl.x + 106; x < pl.x + 122; x += 6) R(x, pl.y + 4, 1, 16, '#8e9ca8'); R(pl.x + 102, pl.y + 12, 20, 1, '#8e9ca8');
    { const x = pl.x + 108, y = pl.y + 24; R(x - 1, y - 6, 2, 8, '#6b4a2a'); if (th.bare) { R(x - 4, y - 9, 9, 4, '#8a6a4a'); R(x - 3, y - 11, 7, 3, '#ffffff'); } else { R(x - 5, y - 13, 10, 8, th.blossom || th.oak[1]); R(x - 3, y - 15, 6, 3, th.blossom ? '#ffffff' : th.oak[2]); } }
    // śmietniki
    const bn = P.bins;
    R(bn.x, bn.y + 4, bn.w, bn.h - 6, '#9a9a96'); R(bn.x, bn.y + 4, bn.w, 1, '#b8b8b0');
    R(bn.x - 2, bn.y - 6, bn.w + 4, 9, '#5a5a62'); R(bn.x - 2, bn.y - 6, bn.w + 4, 1, '#7a7a84'); R(bn.x, bn.y + 2, 2, 26, '#4a4a52'); R(bn.x + bn.w - 2, bn.y + 2, 2, 26, '#4a4a52'); if (th.snow) R(bn.x - 2, bn.y - 8, bn.w + 4, 3, '#ffffff');
    bin(R, bn.x + 6, bn.y + 8, '#3a7a3a', false); bin(R, bn.x + 25, bn.y + 8, '#2f5fb0', false); bin(R, bn.x + 44, bn.y + 8, '#d9b24a', false);
    // dwa domy, samochód, skrzynka na listy, drzewka
    for (const h of HOUSES) { house(R, h.x, h.y, h.w, h.h, th.roofs[h.roof], th.wall, { roofK: 0.5, doorW: 8, win: th.glass }); if (th.snow) snowRoof(R, h.x, h.y, h.w, Math.round(h.h * 0.5)); }
    R(480, 342, 26, 11, '#3a5a8a'); R(484, 338, 18, 5, '#3a5a8a'); R(486, 339, 14, 3, th.glass); R(482, 352, 5, 3, '#1d1522'); R(499, 352, 5, 3, '#1d1522');
    R(606, 342, 6, 10, '#2a2a30'); R(604, 338, 10, 5, '#c84a3a');
    for (const [x, y] of [[466, 356], [522, 358], [620, 356]]) { if (th.bare) { R(x - 1, y - 10, 2, 10, '#5a3a24'); R(x - 4, y - 12, 8, 3, '#6b4a2e'); R(x - 3, y - 14, 6, 2, '#ffffff'); } else { R(x - 1, y - 6, 2, 6, '#5a3a24'); R(x - 5, y - 16, 10, 11, th.oak[1]); R(x - 3, y - 18, 6, 3, th.oak[2]); if (th.blossom) R(x - 4, y - 15, 3, 2, th.blossom); } }
    // kot na płocie i latarnie
    R(596, fy - 12, 7, 4, '#2a2a30'); R(602, fy - 15, 3, 4, '#2a2a30'); R(602, fy - 16, 1, 1, '#2a2a30'); R(604, fy - 16, 1, 1, '#2a2a30'); R(603, fy - 14, 1, 1, '#ffd23f'); R(593, fy - 10, 3, 1, '#2a2a30');
    for (const x of LAMPS) { R(x, rd.y + rd.h + 2, 2, 16, '#2a2a30'); R(x - 3, rd.y + rd.h, 8, 3, '#2a2a30'); R(x - 2, rd.y + rd.h + 1, 6, 1, '#d9e2ea'); }
    for (let x = 0; x < W; x += 2) R(x, H - 2, 1, 2, shade(th.grass[2], -0.3));
  }

  window.FOREST = { NESTS, activeNests, edgeY, P, HOUSES, LAMPS, BUS, PATH, SEASONS, NIGHT, autoTheme, drawBg, hoofprint, bin };
})();
