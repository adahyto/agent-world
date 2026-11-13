// Watacha dzików v5: dopracowane dziki z szablonów pikselowych, baza dzików z druidem-strażnikiem,
// ludzie z osiedla przy błędach,
// miejsca narzędzi, życie na mapie, pory roku i noc. Rejestruje jeden świat ze zmienną porą.
(() => {
  const { W, H, shade, cachedO, text, puffs, chibi, unitColor } = AW;
  const { NESTS, edgeY, P, HOUSES, LAMPS, BUS, SEASONS, autoTheme } = FOREST;

  // ---- szablony dzików (profil, w prawo). b tułów, d szczecina/cień, H błysk grzbietu, l brzuch, D cień pod brzuchem,
  // h pręga, p ucho, e oko, s ryj, n nozdrze. Racice na y=30. ----
  const T = {
    opus: {
      cw: 40, bx: 1, by: 9, bw: 30, bh: 15, hov: 8, hh: 14, legs: [4, 9, 20, 25], lw: 3, tusk: 3,
      body: [
        '..............dddddddddd......',
        '..........dddHHHHHHHHHdddd....',
        '.......dddHHHbbbbbbbbbbbbddd..',
        '.....ddbbbbbbbbbbbbbbbbbbbbbd.',
        '...ddbbbbbbbbbbbbbbbbbbbbbbbbb',
        '..dbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        '.dbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'dbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        'dbbbbbbbbbbbbbbbbbbbbbbbbbbbb.',
        '.bbbmmmmmmmmmmmmmmmmmmmbbbbbb.',
        '.bbmmmmmmmmmmmmmmmmmmmmmbbbbb.',
        '..bmmmmmmmmmmmmmmmmmmmmmmbbb..',
        '..DDmmmmmmmmmmmmmmmmmmmmDDD...',
        '...DDDDDDDDDDDDDDDDDDDDDD.....',
        '....DDDDDDDDDDDDDDDDDDDD......',
      ],
      head: [
        '....pp........',
        '...pppp.......',
        '..pbbpb.......',
        '.bbbbbbbb.....',
        'bbbbbbbbbbb...',
        'bbbbbbbbbbbb..',
        'bbbbbbebbbbbb.',
        'bbbbbbbbbbbbbb',
        '.bbbbbbbbbbbbs',
        '.bbbbbbbbbwwss',
        '..bbbbbbwwwwsn',
        '..mmmmbwwwwsss',
        '...mmmmmwwwss.',
        '....mmmmm.....',
      ],
      pal: { b: '#5e4634', d: '#2e2018', H: '#8a6e54', m: '#4a3628', D: '#2e2018', p: '#a86858', s: '#c08878', n: '#4a2020', w: '#b8aa98' },
    },
    sonnet: {
      cw: 36, bx: 2, by: 12, bw: 24, bh: 12, hov: 7, hh: 11, legs: [3, 7, 15, 19], lw: 3, tusk: 2,
      body: [
        '...........dddddddd.....',
        '........dddHHHHHHdddd...',
        '.....ddbHHbbbbbbbbbbbdd.',
        '...ddbbbbbbbbbbbbbbbbbbb',
        '..dbbbbbbbbbbbbbbbbbbbbb',
        '.dbbbbbbbbbbbbbbbbbbbbbb',
        'dbbbbbbbbbbbbbbbbbbbbbb.',
        '.bbmmmmmmmmmmmmmmmmbbbb.',
        '.bmmmmmmmmmmmmmmmmmmbbb.',
        '..DmmmmmmmmmmmmmmmmmDD..',
        '..DDDDDDDDDDDDDDDDDDD...',
        '...DDDDDDDDDDDDDDDDD....',
      ],
      head: [
        '...pp......',
        '..pppp.....',
        '.bbpbbb....',
        'bbbbbbbbb..',
        'bbbbbbbbbb.',
        'bbbbbebbbbb',
        'bbbbbbbbbbb',
        '.bbbbbbbwws',
        '.bbbbbbwwss',
        '..mmmbwwwsn',
        '...mmmwwss.',
      ],
      pal: { b: '#75553f', d: '#3e2c20', H: '#9c7c60', m: '#5e4432', D: '#3e2c20', p: '#b87868', s: '#d49a86', n: '#5a2a2a', w: '#c4b6a4' },
    },
    haiku: {
      cw: 32, bx: 3, by: 14, bw: 20, bh: 10, hov: 6, hh: 9, legs: [3, 6, 12, 16], lw: 2, tusk: 0,
      body: [
        '.........ddddddd....',
        '......dddHHHHHddd...',
        '....ddbbbbbbbbbbbdd.',
        '..ddbbbbbbbbbbbbbbbb',
        '.dbbbbbbbbbbbbbbbbbb',
        'dbbbbbbbbbbbbbbbbbb.',
        '.bmmmmmmmmmmmmmmbbb.',
        '.bmmmmmmmmmmmmmmbbb.',
        '..DDDDDDDDDDDDDDDD..',
        '...DDDDDDDDDDDDDD...',
      ],
      head: [
        '..pp.....',
        '.pppp....',
        'bbpbbb...',
        'bbbbbbbb.',
        'bbbbebbbb',
        'bbbbbbbbb',
        '.bbbbbwws',
        '.bbbbwwss',
        '..mmmwwsn',
      ],
      pal: { b: '#946c4c', d: '#54402c', H: '#b8906c', m: '#7a5840', D: '#54402c', p: '#c88878', s: '#e0a898', n: '#6a3030', w: '#d4c8b4' },
    },
    sub: {
      cw: 28, bx: 4, by: 18, bw: 14, bh: 7, hov: 5, hh: 7, legs: [2, 5, 8, 11], lw: 2, tusk: 0,
      body: [
        '.....bbbbbbbb.',
        '...bbhbbhbbhbb',
        '..bbhbbhbbhbbb',
        '.bbbhbbhbbhbbb',
        'bbbbhbbhbbhbbb',
        '.bbmmmmmmmmbb.',
        '..DDDDDDDDDD..',
      ],
      head: [
        '.pp....',
        'bppb...',
        'bbbbbb.',
        'bebbbbb',
        'bbbbbss',
        '.bbbwss',
        '..mmwsn',
      ],
      pal: { b: '#b08a5c', d: '#7a5a3a', H: '#d0b088', m: '#9a7a4e', D: '#7a5a3a', h: '#f0dcac', p: '#d89888', s: '#e8b0a0', n: '#7a3a3a', w: '#e8dcc8' },
    },
  };
  const HEAD_Y = { opus: 28, sonnet: 23, haiku: 19, sub: 14 };
  const HOOF = '#1d1410', TUSK = '#f2eadb', EYE = '#0e0a0c';
  const stamp = (R, rows, x, y, pal) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const c = pal[row[i]]; if (c) R(x + i, y + j, 1, 1, c); } });
  const tint = (pal, v) => { const o = {}; for (const k in pal) o[k] = k === 'n' ? pal[k] : shade(pal[k], v); return o; };

  function boarShape(R, z, col, v, pose, f) {
    const pal = { ...tint(z.pal, v), e: EYE };
    const alert = pose === 'alert', up = alert && f === 0, work = pose === 'work', walk = pose === 'walk', cower = pose === 'down', stand = pose === 'stand';
    const dy = cower ? 4 : 0, { bx, bw, bh } = z, by = z.by + dy, ly = by + bh - 1;
    const hx = bx + bw - z.hov, hy = by - 2 + (work ? 5 + (f ? 1 : 0) : up ? -3 : alert ? -2 : 0);
    // ogon z kitą: w górze przy czujności, macha w marszu
    if (up) { R(bx + 1, by + 1, 2, 4, pal.d); R(bx, by - 1, 3, 2, pal.d); }
    else { const sw = walk && f ? 1 : 0; R(bx - 1, by + 4, 2, 6, pal.d); R(bx - 2 - sw, by + 9, 3, 3, pal.d); }
    // nogi: tylne z zaznaczonym stawem skokowym (udo szersze, goleń cofnięta), przednie proste; w marszu naprzemiennie
    if (!cower) z.legs.forEach((lx, k) => {
      const d = walk ? (k % 2 === (f ? 1 : 0) ? 1 : -1) : 0, lift = walk && d > 0 ? 1 : 0, back = k < 2, x = bx + lx + d;
      if (back) { R(x - 1, ly, z.lw + 1, 3, pal.D); R(x - 1, ly + 3, z.lw, 30 - ly - 3 - lift, pal.D); R(x - 1, ly + 3, 1, 1, pal.m); R(x - 1, 28 - lift, z.lw, 2, HOOF); }
      else { R(x, ly, z.lw, 30 - ly - lift, pal.m); R(x, ly + 1, 1, 2, pal.b); R(x, 28 - lift, z.lw, 2, HOOF); }
    }); else z.legs.forEach((lx, k) => R(bx + lx, 27, z.lw + 1, 3, k < 2 ? pal.D : pal.m));
    stamp(R, z.body, bx, by, pal);
    // szczecina na grzbiecie: pojedyncze włosy, najeżone przy czujności
    for (let x = bx + Math.round(bw * 0.4); x < bx + bw - 4; x += 3) R(x, by - (alert ? 2 : 1), 1, alert ? 2 : 1, pal.d);
    const head = cower ? z.head.map((r) => r.replace(/p/g, 'b')) : z.head;
    stamp(R, head, hx, hy, pal);
    // strzyżenie uszami w spoczynku, uszy płasko przy kuleniu
    if (stand && f) R(hx + Math.floor(z.head[0].indexOf('p')) + 1, hy - 1, 2, 1, pal.p);
    if (cower) R(hx + 1, hy + 2, 4, 1, pal.d);
    { const ex = z.head.findIndex((r) => r.includes('e')), ei = z.head[ex].indexOf('e'); R(hx + ei - 1, hy + ex, 1, 1, '#ffffff'); if (alert) R(hx + ei, hy + ex - 1, 1, 1, '#ffffff'); R(hx + ei - 1, hy + ex - 1, 3, 1, pal.d); }
    // szable: dolne wygięte do góry przed ryjem, górne fajki krótsze
    if (z.tusk) { const tx = hx + z.head[0].length - 3, ty = hy + z.hh - 3; R(tx, ty - z.tusk + 1, 1, z.tusk, TUSK); R(tx - 1, ty + 1, 1, 1, TUSK); R(tx + 1, ty - z.tusk, 1, 1, TUSK); if (z.tusk > 2) R(tx - 2, ty - 1, 1, 1, shade(TUSK, -0.25)); }
    // obroża telemetryczna i kolczyk w kolorze projektu
    R(hx - 1, by + 1, 2, bh - 3, col); R(hx - 2, by + bh - 4, 3, 2, shade(col, -0.35)); R(hx + Math.floor(z.head[0].indexOf('p')) + 1, hy + 1, 2, 2, col);
  }
  const boar = (model, col, v, pose, f) => { const z = T[model] || T.sonnet; return cachedO(`dz:${model}:${col}:${v}:${pose}:${f}`, z.cw, 32, (R) => boarShape(R, z, col, v, pose, f)); };
  const variantOf = (a) => [-0.1, 0, 0.1, -0.05, 0.06][a.id % 5];

  // ---- druid, ludzie z osiedla, zwierzęta ----
  const SKIN = '#f6d2b0';
  const druid = (pose, f, glow) => cachedO(`dz:druid:${pose}:${f}:${glow}`, 32, 32, (R) => {
    chibi(R, {
      skin: SKIN, hair: '#e8e4da', style: 'long', beard: '#e8e4da', robe: true, top: '#3f6b3a', top2: '#2f5230', shoes: '#3a2416',
      hat: (R) => { R(8, 1, 15, 5, '#2f5230'); R(7, 4, 3, 6, '#2f5230'); R(22, 4, 3, 5, '#2f5230'); R(9, 1, 13, 1, '#4a8a48'); R(15, 7, 3, 1, '#c9a26a'); },
      hand: (R, up) => {
        R(10, 20, 12, 1, '#8a6a3c'); R(14, 17, 3, 3, '#c9a26a');
        if (up) { R(24, 0, 1, 18, '#6b4a2a'); R(22, 0, 5, 3, glow ? '#bff4ff' : '#7ab8c8'); R(23, 1, 3, 1, '#ffffff'); }
        else { R(24, 8, 1, 22, '#6b4a2a'); R(22, 6, 5, 3, glow ? '#bff4ff' : '#7ab8c8'); R(23, 7, 3, 1, '#ffffff'); }
      },
    }, pose, f);
  });
  const sentinel = (pose, f) => cachedO(`dz:wart:${pose}:${f}`, 28, 32, (R) => {
    boarShape(R, T.sub, '#a3262a', 0, pose, f);
    R(16, 14 - (pose === 'alert' && f === 0 ? 3 : 0), 8, 3, '#6a6a64'); R(17, 13 - (pose === 'alert' && f === 0 ? 3 : 0), 6, 1, '#8a8a84'); R(23, 15 - (pose === 'alert' && f === 0 ? 3 : 0), 1, 2, '#6a6a64');
    R(10, 16, 1, 8, '#3a2416'); R(9, 14, 3, 3, '#4a4a52'); R(10, 15, 1, 1, '#9ad0ff');
  });
  const PEOPLE = [
    { skin: SKIN, hair: '#5a3a24', top: '#8ab0d8', top2: '#6a90b8', robe: true, shoes: '#c84a3a', hand: (R, up, work) => { R(21, work ? 17 : 19, 6, 2, '#6a6a70'); R(26, work ? 16 : 18, 2, 4, '#ffe7a8'); } },
    { skin: SKIN, hair: '#2a1a10', style: 'spiky', top: '#c84a3a', legs: '#3a4a7a', shoes: '#1d1522', hat: (R) => { R(9, 2, 15, 3, '#2f55d4'); R(20, 4, 7, 2, '#2f55d4'); }, hand: (R, up, work) => { R(24, work ? 4 : 6, 1, 22, '#8a6a3c'); R(22, work ? 24 : 26, 6, 4, '#d9b04a'); } },
    { skin: SKIN, hair: '#e6c35c', style: 'bun', top: '#e0a0c0', legs: '#4a4a52', shoes: '#1d1522', hand: (R, up, work) => { R(20, work ? 16 : 18, 9, 2, '#c9a26a'); R(19, work ? 16 : 18, 1, 2, '#8a6a3c'); R(29, work ? 16 : 18, 1, 2, '#8a6a3c'); } },
    { skin: SKIN, hair: '#6b4a2f', top: '#3aa86b', legs: '#2f55d4', shoes: '#ffffff', big: true, blush: '#f5a5a5', hand: (R, up, work) => { R(22, work ? 14 : 16, 3, 5, '#2a2a30'); R(23, work ? 15 : 17, 1, 3, '#9ad0ff'); } },
  ];
  const person = (k, pose, f) => cachedO(`dz:os:${k}:${pose}:${f}`, 32, 32, (R) => chibi(R, PEOPLE[k], pose, f));
  const deer = (f) => cachedO(`dz:sarna:${f}`, 24, 24, (R) => {
    R(6, 8, 12, 7, '#b88a5a'); R(8, 13, 8, 2, '#e8d8b8'); R(16, 4, 5, 6, '#b88a5a'); R(17, 1, 1, 3, '#b88a5a'); R(20, 1, 1, 3, '#b88a5a'); R(19, 6, 1, 1, '#1d1522'); R(21, 8, 1, 1, '#1d1522');
    for (const lx of [7, 10, 14, 17]) R(lx + (f && lx % 2 ? 1 : 0), 15, 1, 7, '#9a7046'); R(5, 8, 2, 3, '#ffffff');
  });
  const fox = (f) => cachedO(`dz:lis:${f}`, 24, 24, (R) => {
    R(5, 12, 11, 5, '#d8692a'); R(7, 15, 7, 2, '#f2e2c8'); R(14, 9, 5, 5, '#d8692a'); R(15, 7, 1, 2, '#d8692a'); R(17, 7, 1, 2, '#d8692a'); R(18, 11, 2, 2, '#1d1522'); R(17, 11, 1, 1, '#1d1522');
    R(1, 11 + (f ? 1 : 0), 5, 3, '#d8692a'); R(0, 11 + (f ? 1 : 0), 2, 3, '#ffffff'); for (const lx of [6, 9, 12, 15]) R(lx, 17, 1, 4, '#3a2416');
  });
  const hare = (f) => cachedO(`dz:zajac:${f}`, 16, 16, (R) => { R(3, 8, 8, 5, '#9a8a6a'); R(9, 5, 4, 5, '#9a8a6a'); R(10, 1, 1, 4, '#9a8a6a'); R(12, 1, 1, 4, '#9a8a6a'); R(12, 7, 1, 1, '#1d1522'); R(2, 8, 2, 2, '#ffffff'); R(4, 13 - f, 2, 2 + f, '#7a6a4a'); R(9, 13 - f, 2, 2 + f, '#7a6a4a'); });
  const crow = (f) => cachedO(`dz:wrona:${f}`, 16, 12, (R) => { R(5, 5, 6, 3, '#1d1a22'); R(10, 3, 3, 3, '#1d1a22'); R(13, 4, 2, 1, '#d9b24a'); R(1, 4 - (f ? 2 : 0), 5, 2, '#1d1a22'); R(10, 4 - (f ? 2 : 0), 4, 2, '#1d1a22'); });

  // ---- miejsca ----
  const PLACE = { Bash: 'Bash', Read: 'Read', Grep: 'Grep', Glob: 'Grep', Edit: 'Edit', Write: 'Write', NotebookEdit: 'Write', WebSearch: 'WebSearch', WebFetch: 'WebFetch', TodoWrite: 'TodoWrite', MCP: 'MCP', Agent: 'Agent' };
  const nestOf = (front) => NESTS[front % NESTS.length] || NESTS[0];
  function place(a) {
    if (a.status === 'waiting_for_user' && a.waitingFor !== 'input') return 'base';
    if (a.status === 'thinking') return 'thinking';
    if (a.status === 'tool') return PLACE[a.tool] || 'other';
    return 'home';
  }
  function baseSpot(a, k, s) {
    const b = P.bucht, tr = P.tracks, w = P.wallow, o = P.oaks, hl = P.hill, B = P.base;
    switch (k) {
      case 'base': { const [x, y] = B.spots[s % B.spots.length]; return { x: x + Math.floor(s / B.spots.length) * 6, y: y + Math.floor(s / B.spots.length) * 8 }; }
      case 'thinking': { const an = Math.PI * 0.2 + s * 0.9; return { x: w.x + Math.cos(an) * (w.rx + 16), y: w.y + 10 + Math.sin(an) * (w.ry + 9) }; }
      case 'Bash': return { x: b.x + 22 + (s % 4) * 24, y: b.y + 24 + Math.floor(s / 4) * 14 };
      case 'Read': return { x: tr.x + 14 + (s % 4) * 22, y: tr.y + 24 - Math.floor(s / 4) * 10 };
      case 'Grep': return { x: o.x + 18 + (s % 4) * 26, y: o.y + 70 - Math.floor(s / 4) * 12 };
      case 'Edit': return { x: P.plots.x + 20 + (s % 3) * 32, y: P.plots.y + 26 + Math.floor(s / 3) * 6 };
      case 'Write': return { x: P.nest2.x + 10 + (s % 3) * 16, y: P.nest2.y + 26 + Math.floor(s / 3) * 8 };
      case 'WebSearch': return { x: hl.x - 12 + (s % 3) * 12, y: hl.y + 4 - Math.floor(s / 3) * 6 };
      case 'WebFetch': return { x: P.bins.x + 10 + (s % 3) * 20, y: P.bins.y + 30 + Math.floor(s / 3) * 6 };
      case 'TodoWrite': return { x: P.rub.x - 8 + (s % 2) * 30, y: P.rub.y + 34 + Math.floor(s / 2) * 10 };
      case 'MCP': return { x: P.feeder.x + 8 + (s % 3) * 20, y: P.feeder.y + 36 + Math.floor(s / 3) * 10 };
      case 'Agent': return { x: P.thicket.x + 6 + (s % 3) * 20, y: P.thicket.y + 34 + Math.floor(s / 3) * 10 };
      case 'other': return { x: P.brook.x - 12 + (s % 2) * 34, y: 212 + Math.floor(s / 2) * 16 };
      default: { const n = nestOf(a.front); return { x: n.x - 6 + (s % 2) * 14, y: n.y + 12 + Math.floor(s / 2) * 5 }; }
    }
  }
  // Na przedmieścia dziki chodzą dziurą w płocie, z powrotem też.
  function route(a, from, to) {
    const fy = P.fence.y;
    if ((from.y < fy) === (to.y < fy)) return [to];
    const far = to.y > fy ? to : from, hole = Math.abs(far.x - P.plots.hole) < Math.abs(far.x - P.bins.hole) ? P.plots.hole : P.bins.hole;
    return [{ x: hole, y: fy - 12 }, { x: hole, y: fy + 6 }, to];
  }
  const busyWith = (agents, ...tools) => agents.some((a) => a.status === 'tool' && tools.includes(a.tool) && !a.moving);
  const waiting = (agents) => agents.filter((a) => a.kind === 'session' && a.status === 'waiting_for_user' && a.waitingFor !== 'input');

  // ---- pora roku i dnia ----
  let th = null, concept = null;
  function setTheme(season, night) {
    th = { ...SEASONS[season], season, night };
    if (concept) concept.bg = AW.sprite(W, H, (R, g) => FOREST.drawBg(R, g, th));
    caption();
  }
  function caption() {
    const nm = document.getElementById('concept-name'), tg = document.getElementById('concept-tag');
    if (nm) nm.textContent = `${th.name}, ${th.night ? 'noc' : 'dzień'}`;
    if (tg) tg.textContent = th.tagline + (th.night ? ' Po zmroku osiedle świeci oknami i latarniami, a przy bazie płoną pochodnie.' : '');
  }
  function applyControls() {
    const s = document.getElementById('season'), d = document.getElementById('daytime');
    const auto = autoTheme();
    const season = s && s.value !== 'auto' ? s.value : auto.season;
    const night = d && d.value !== 'auto' ? d.value === 'noc' : auto.night;
    if (!th || th.season !== season || th.night !== night) setTheme(season, night); else caption();
  }

  // ---- ludzie z osiedla: przychodzą do dzika z błędem i przeganiają go ----
  let people = [], hareT = 8, hares = [];
  const nearestGate = (x) => P.estate.gates.reduce((p, q) => (Math.abs(q - x) < Math.abs(p - x) ? q : p));
  function tick(dt, agents, now) {
    for (const a of agents) {
      if (a.status !== 'error' || a.moving || people.some((p) => p.agent === a)) continue;
      const h = HOUSES[Math.floor(Math.random() * HOUSES.length)], gate = nearestGate(h.door);
      const p = { k: Math.floor(Math.random() * PEOPLE.length), agent: a, x: h.door, y: h.y + h.h + 3, home: { x: h.door, y: h.y + h.h + 3 }, dir: 1, phase: 'go', f: Math.random() * 9 };
      p.path = [{ x: gate, y: P.fence.y + 6 }, { x: gate, y: P.fence.y - 12 }, { x: a.x - a.dir * 18, y: a.y + 2 }];
      people.push(p);
    }
    for (const p of people) {
      if (p.phase === 'scold' && (p.agent.status !== 'error' || p.agent.dead)) { p.phase = 'back'; const g = nearestGate(p.home.x); p.path = [{ x: g, y: P.fence.y - 12 }, { x: g, y: P.fence.y + 6 }, p.home]; }
      if (!p.path.length) { if (p.phase === 'go') p.phase = 'scold'; else if (p.phase === 'back') p.dead = true; continue; }
      const t = p.path[0], dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy), sp = 52 * dt;
      if (d <= sp) { p.x = t.x; p.y = t.y; p.path.shift(); } else { p.x += (dx / d) * sp; p.y += (dy / d) * sp; }
      if (Math.abs(dx) > 0.5) p.dir = dx > 0 ? 1 : -1;
    }
    people = people.filter((p) => !p.dead);
    if ((hareT -= dt) <= 0) { hareT = 14 + Math.random() * 16; hares.push({ x: -10, y: 120 + Math.random() * 150, t: 0 }); }
    for (const h of hares) { h.x += 70 * dt; h.t += dt; }
    hares = hares.filter((h) => h.x < W + 12);
    if (Math.floor(now) % 60 === 0 && Math.floor(now) !== tick.last) { tick.last = Math.floor(now); applyControls(); }
  }

  // ---- noc: źródła światła ----
  function lights(agents, now) {
    const L = [];
    for (const x of LAMPS) L.push([x + 1, P.road.y + P.road.h + 2, 36, 0.8]);
    for (const h of HOUSES) { const wy = h.y + Math.round(h.h * 0.5) + 5; L.push([h.x + 7, wy, 16, 0.6]); L.push([h.x + h.w - 7, wy, 16, 0.6]); }
    L.push([P.plots.x + 112, P.plots.y + 12, 16, 0.5]); L.push([BUS.x + 28, BUS.y - 8, 16, 0.5]);
    const B = P.base, wn = Math.min(3, waiting(agents).length);
    L.push([B.x - 21, B.y + 10, 30, 0.7 + 0.3 * wn]); L.push([B.x - 11, B.y - 20, 18, 0.5 + 0.2 * wn]); L.push([B.x + 11, B.y - 20, 18, 0.5 + 0.2 * wn]); L.push([B.x, B.y - 12, 14, 0.4]); L.push([B.x + 52, B.y - 10, 16, 0.4]);
    for (const p of people) if (p.k === 0) L.push([p.x + p.dir * 16, p.y - 10, 26, 0.7]);
    if (th.season === 'lato' || th.season === 'wiosna') L.push([P.wallow.x, P.wallow.y, 40, 0.15]);
    return L;
  }

  function world(g, t, agents) {
    const w = P.wallow, o = P.oaks, B = P.base, f = Math.floor(t * 4) % 2, R2 = (x, y, ww, hh, c) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
    if (!th.snow) { g.save(); g.beginPath(); g.ellipse(w.x, w.y, w.rx - 6, w.ry - 5, 0, 0, 7); g.clip(); AW.water(g, w.x - w.rx, w.y - w.ry, w.rx * 2, w.ry * 2, t, shade(th.water, -0.25), shade(th.mud, 0.5)); g.restore(); }
    for (let y = 84; y < P.road.y; y += 6) { if (th.snow && y % 12) continue; const x = P.brook.x + Math.round(Math.sin(y / 20) * 7) + 2 + ((Math.floor(t * 10) + y / 6) % 3) * 2; if (y < edgeY(x)) continue; g.fillStyle = th.glint; g.fillRect(x, y, 2, 1); }
    // baza dzików: kosz ogniowy, pochodnie w kolorach czekających projektów, wartownik na wieży, druid-strażnik przy bramie
    const wt = waiting(agents), big = wt.length > 0;
    const fl = Math.floor(t * 9) % 3, bx = B.x - 21, byy = B.y + 11;
    R2(bx - 3, byy - 7 - fl - (big ? 3 : 0), 6, 6 + fl + (big ? 3 : 0), '#ff8a2a'); R2(bx - 2, byy - 5 - fl - (big ? 2 : 0), 4, 4 + fl, '#ffd23f'); R2(bx - 1, byy - 3, 2, 2, '#fff3c4');
    for (let i = 0; i < (big ? 6 : 3); i++) { const k = (t * 1.3 + i / 6) % 1; g.fillStyle = `rgba(255,200,80,${1 - k})`; g.fillRect(Math.round(bx - 4 + Math.sin(k * 9 + i) * 5), Math.round(byy - 8 - k * 22), 1, 1); }
    puffs(g, bx, byy - 12, t * 0.6, 'rgba(200,200,210,.5)', 3, 24, 4);
    [B.x - 11, B.y - 22, B.x + 11, B.y - 22].forEach((v, i) => { if (i % 2) return; const x = v, y = [B.y - 22, B.y - 22][i / 2], c = wt[i / 2] ? wt[i / 2].color : '#ff8a2a'; R2(x - 1, y - 2 - (fl % 2), 3, 3 + (fl % 2), c); R2(x, y - 3 - (fl % 2), 1, 1, '#fff3c4'); });
    wt.slice(0, 6).forEach((a, i) => { const x = B.x - 40 + i * 16, y = B.y - 8 - (Math.floor(t * 3 + i) % 2); g.fillStyle = a.color; g.fillRect(x, y - 4, 2, 5); g.fillRect(x + 2, y - 4, 5, 3); });
    AW.blit(g, sentinel(big ? 'alert' : 'stand', Math.floor(t * (big ? 4 : 1.4)) % 2), B.x + 52, B.y + 4);
    AW.blit(g, druid(big ? 'alert' : 'stand', big ? Math.floor(t * 2) % 2 : Math.floor(t * 1.4) % 2, big), B.x - 36, B.y + 22);
    // praca przy narzędziach
    for (const a of agents) if (a.status === 'tool' && !a.moving) {
      if (a.tool === 'Bash') puffs(g, a.x + a.dir * 14, a.y - 2, t * 1.4, shade(th.soil, -0.15), 5, 16, a.id);
      if (a.tool === 'Edit') { puffs(g, a.x + a.dir * 14, a.y - 2, t * 1.4, th.crops[1], 4, 18, a.id); puffs(g, a.x + a.dir * 10, a.y, t * 1.1, th.soil, 3, 10, a.id + 7); }
    }
    if (busyWith(agents, 'Read')) { const n = Math.floor(t * 2) % 7; for (let k = 0; k < n; k++) FOREST.hoofprint(R2, P.tracks.x + 12 + k * 12, P.tracks.y + 10 + (k % 2) * 6, th.snow ? '#7a8a9a' : shade(th.mud, -0.45)); }
    if (busyWith(agents, 'Grep', 'Glob')) for (let i = 0; i < 6; i++) { const k = (t * 0.9 + i / 6) % 1, x = o.x + 14 + ((i * 37) % (o.w - 28)), y = o.y + 18 + k * 44; R2(x, Math.round(y), 2, 2, '#8a5a2a'); R2(x, Math.round(y), 2, 1, '#4a2e1a'); }
    if (busyWith(agents, 'TodoWrite')) { const dx = f ? 1 : -1; R2(P.rub.x + 6 + dx, P.rub.y - 4, 10, 2, th.spruce[2]); R2(P.rub.x + 6, P.rub.y + 20 + (Math.floor(t * 3) % 3), 11, 1, shade(th.mud, 0.2)); }
    const mcp = busyWith(agents, 'MCP');
    AW.blit(g, deer(f), P.feeder.x - 14, P.feeder.y + 38 + (mcp ? 0 : 1));
    if (mcp) { AW.blit(g, fox(f), P.feeder.x + P.feeder.w + 16, P.feeder.y + 40, { flip: true }); for (let i = 0; i < 4; i++) { const k = (t * 1.2 + i / 4) % 1; R2(P.feeder.x + 10 + i * 10, Math.round(P.feeder.y + 16 + k * 12), 2, 1, '#e8c860'); } }
    if (busyWith(agents, 'Agent')) for (let k = 0; k < 5; k++) if ((Math.floor(t * 6) + k) % 2) R2(P.thicket.x + 4 + k * 11 + (f ? 1 : -1), P.thicket.y - 2 + (k % 2) * 4, 3, 2, shade(th.bush, 0.45));
    if (busyWith(agents, 'Write')) { const n = 1 + (Math.floor(t * 1.5) % 4); for (let k = 0; k < n; k++) R2(P.nest2.x + 12 + k * 7, P.nest2.y + 2 - k * 2, 14, 2, k % 2 ? th.fern : '#8a6a3c'); }
    if (busyWith(agents, 'WebSearch')) for (let i = 0; i < 7; i++) { const k = (t * 0.5 + i / 7) % 1, x = P.hill.x + 20 - k * 110, y = P.hill.y - 26 + i * 5 + Math.sin(k * 9 + i) * 2; g.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`; g.fillRect(Math.round(x), Math.round(y), 8, 1); }
    if (busyWith(agents, 'WebFetch')) {
      FOREST.bin(R2, P.bins.x + 6, P.bins.y + 8, '#3a7a3a', true); FOREST.bin(R2, P.bins.x + 25, P.bins.y + 8, '#2f5fb0', f === 1); FOREST.bin(R2, P.bins.x + 44, P.bins.y + 8, '#d9b24a', true);
      for (let i = 0; i < 5; i++) { const k = (t * 1.1 + i / 5) % 1; R2(Math.round(P.bins.x + 12 + i * 10 + Math.sin(k * 7) * 3), Math.round(P.bins.y + 4 - Math.sin(k * Math.PI) * 18), 3, 2, ['#ffd23f', '#ffffff', '#e0405a', '#ffffff', '#9ad0ff'][i]); }
      const k = (t * 0.6) % 1; AW.blit(g, crow(f), P.bins.x + 30 + k * 60, P.bins.y - 12 - k * 40);
    }
    for (const h of hares) AW.blit(g, hare(Math.floor(h.t * 6) % 2), h.x, h.y - Math.abs(Math.sin(h.t * 6)) * 4);
    if (!th.night) for (const x of [120, 560]) AW.blit(g, crow(0), x + (Math.floor(t * 0.5) % 2), P.road.y + 15, { flip: x > 300 });
    for (const p of people) {
      const pose = p.path.length ? 'walk' : 'work', fr = Math.floor(t * (pose === 'walk' ? 8 : 5) + p.f) % 2;
      g.fillStyle = 'rgba(10,8,20,.28)'; g.fillRect(Math.round(p.x - 6), Math.round(p.y - 1), 12, 2);
      AW.blit(g, person(p.k, pose, fr), p.x, p.y - (pose === 'walk' && fr ? 1 : 0), { flip: p.dir < 0 });
    }
    if (th.drift) AW.drift(t, th.drift.n, th.drift.vx, th.drift.vy, (x, y, i) => { g.fillStyle = th.drift.col[i % th.drift.col.length]; g.fillRect(x, y, th.snow ? 1 : 2, 1); if (!th.snow && i % 3 === 0) g.fillRect(x + 1, y - 1, 1, 1); }, 5);
    if (th.season === 'lato' && !th.night) AW.drift(t, 6, 14, -3, (x, y, i) => { if (y > 284 || y < edgeY(x)) return; const ww = Math.floor(t * 8 + i) % 2; g.fillStyle = ['#ffd23f', '#ffffff', '#9ad0ff', '#f59ac0', '#ffffff', '#e0405a'][i]; g.fillRect(x - 1, y - ww, 1, 2); g.fillRect(x + 1, y - ww, 1, 2); g.fillRect(x, y, 1, 1); }, 8);
  }

  function labels(g) {
    const col = th.label;
    AW.projects.slice(0, NESTS.length).forEach((pr, i) => text(g, pr.name, NESTS[i].x, NESTS[i].y - 16, col, 8));
    for (const k of ['feeder', 'thicket', 'bucht', 'tracks', 'oaks', 'nest2', 'plots', 'bins']) { const p = P[k]; text(g, p.label, p.x + p.w / 2, k === 'plots' || k === 'bins' ? p.y + p.h - 3 : k === 'bucht' ? p.y + p.h + 8 : p.y - 4, col, 7); }
    text(g, P.rub.label, P.rub.x + 11, P.rub.y + 44, col, 7);
    text(g, P.wallow.label, P.wallow.x, P.wallow.y + P.wallow.ry + 12, col, 7);
    text(g, P.hill.label, P.hill.x, P.hill.y - 20, col, 7);
    text(g, P.base.label, P.base.x, P.base.y - 56, col, 7);
  }

  function top(g, t, agents) {
    if (th.night) {
      g.fillStyle = th.snow ? 'rgba(14,16,48,.46)' : 'rgba(12,10,40,.58)'; g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = 'lighter';
      for (const [x, y, r, a] of lights(agents, t)) {
        const k = a * (0.9 + 0.1 * Math.sin(t * 6 + x * 0.3));
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(255,190,110,${k * 0.5})`); gr.addColorStop(1, 'rgba(255,190,110,0)');
        g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
      }
      if (th.season === 'lato' || th.season === 'wiosna') AW.drift(t, 16, 5, -3, (x, y, i) => { if (y > edgeY(x) && y < 284 && Math.floor(t * 2 + i) % 3) { g.fillStyle = 'rgba(220,255,140,.9)'; g.fillRect(x, y, 1, 1); } }, 11);
      g.fillStyle = Math.floor(t * 0.7) % 5 ? '#ffd23f' : '#2a1a10'; g.fillRect(19, 56, 1, 1); g.fillRect(22, 56, 1, 1);
      g.globalCompositeOperation = 'source-over';
    }
    if (th.fog) { const gr = g.createLinearGradient(0, 80, 0, 190); gr.addColorStop(0, 'rgba(235,235,225,0)'); gr.addColorStop(0.35, `rgba(235,235,225,${th.fog})`); gr.addColorStop(1, 'rgba(235,235,225,0)'); g.fillStyle = gr; g.fillRect(0, 80, W, 110); }
    for (const a of waiting(agents)) {
      if (a.waitingFor !== 'permission') continue;
      const k = 0.14 + 0.14 * Math.sin(t * 5), n = nestOf(a.front);
      g.fillStyle = `rgba(255,50,50,${k})`; g.beginPath(); g.ellipse(n.x, n.y + 4, 30, 14, 0, 0, 7); g.fill();
      g.strokeStyle = `rgba(255,70,70,${0.5 + k})`; g.lineWidth = 2; g.beginPath(); g.ellipse(n.x, n.y + 4, 28, 12, 0, 0, 7); g.stroke();
    }
    for (const p of people) if (!p.path.length && p.phase === 'scold') { const fr = Math.floor(t * 5 + p.f) % 2, b = AW.bubble(g, p.x, p.y - 36 - fr, 22, 10, '#ff5a52', '#3a0606'); text(g, 'SIO!', p.x, b.y + 5, '#ffffff', 8); }
    labels(g);
    AW.vignette(g, th.vign + (th.night ? 0.12 : 0));
  }

  const legend = [
    ['idle, done', 'Leży w swoim barłogu w lesie. Po zakończeniu sesji zasypia („z”) i blednie.'],
    ['thinking', 'Tapla się w babrzysku na polanie, w dymku „…”. Zimą babrzysko jest zamarznięte.'],
    ['Bash', 'Buchtowisko: ryje w ziemi, grudy lecą na boki.'],
    ['Read', 'Tropy: węszy po śladach, które pojawiają się jeden po drugim.'],
    ['Grep, Glob', 'Dęby: szuka żołędzi, które spadają z koron.'],
    ['Edit', 'Działki za drogą: ryje w grządkach, sałata fruwa. Wchodzi dziurą w płocie.'],
    ['Write', 'Nowy barłóg: ściele legowisko, warstwa po warstwie.'],
    ['WebSearch', 'Wzgórze z drogowskazem: węszy wiatr od osiedla.'],
    ['WebFetch', 'Śmietniki: otwiera kubły, śmieci lecą, wrona ucieka.'],
    ['TodoWrite', 'Czochradło: znaczy sosnę błotem, drzewo się trzęsie.'],
    ['narzędzia MCP', 'Paśnik: przychodzą sarna i lis, czyli obce usługi.'],
    ['Agent', 'Gąszcz: woła warchlaki, czyli subagentów.'],
    ['inne narzędzia', 'Pije ze strumienia przy kładce.'],
    ['czeka: pozwolenie', 'Idzie pod bramę bazy dzików i staje czujnie z „!”. Druid-strażnik unosi kostur, kosz ogniowy bucha, pochodnie i proporce na palisadzie przybierają kolor projektu, wartownik na wieży staje czujnie, a barłóg pulsuje na czerwono.'],
    ['czeka: pytanie', 'Też pod bramą bazy, z żółtym „?” nad głową.'],
    ['czeka: bezczynność', 'Wraca do barłogu, spokojny zielony dymek.'],
    ['error', 'Z jednego z dwóch domów wychodzi człowiek (szlafrok z latarką, miotła, wałek albo dzieciak z telefonem), podchodzi i woła „SIO!”. Dzik kuli się przy ziemi. Gdy błąd mija, człowiek wraca.'],
  ];
  const models = [
    ['Opus', 'Odyniec: największy i najciemniejszy, wysoki kłąb, najeżona szczecina, duże szable. Najwolniejszy.'],
    ['Sonnet', 'Locha: dorosły dzik średniej wielkości, małe szable.'],
    ['Haiku', 'Przelatek: mniejszy, rudawy, bez szabli. Najszybszy.'],
    ['subagent', 'Warchlak w paski, biega za rodzicem.'],
    ['osobnik', 'Każdy dzik tej samej rasy ma trochę inny odcień.'],
    ['projekt', 'Obroża telemetryczna i kolczyk w kolorze projektu, tabliczka i wstążka przy barłogu.'],
    ['barłogi', 'Każdy projekt dostaje własny barłóg w zatoce lasu, w kolejności pojawiania się: pod wykrotem, w paprociach, pod głazem, w jałowcach, pod świerkiem (i dalej). Znikają, gdy projekt nie ma żadnej sesji.'],
    ['Ty', 'Druid-strażnik przy bramie bazy dzików: ziemianki pod świętym dębem z palisadą, wieżą strażniczą z wartownikiem w hełmie, sztandarem z szablami, totemem i stosem żołędzi.'],
    ['pora', 'Pora roku z daty (wiosna III–V, lato VI–VIII, jesień IX–XI, zima XII–II) i noc z godziny (lato 21–5, zima 17–7). Da się nadpisać w ustawieniach.'],
  ];
  const pros = [], cons = [];

  const auto = autoTheme();
  th = { ...SEASONS[auto.season], season: auto.season, night: auto.night };
  concept = {
    id: 'dziki', short: 'Dziki', name: 'Watacha dzików', tagline: '',
    spawnColor: '#d8f0b0', waitMoves: true, ownError: true,
    speed: { opus: 38, sonnet: 50, haiku: 68, sub: 60 },
    key(a) { let k = place(a); if (k === 'home') k += ':' + a.front; return (a.kind === 'subagent' ? 's:' : '') + k; },
    spot(a, s) {
      const sub = a.kind === 'subagent', k = a.slotKey.replace(/^s:/, '').split(':')[0];
      const p = baseSpot(a, k, sub ? s + 3 : s);
      return sub ? { x: p.x + 14, y: p.y + 5 } : p;
    },
    route, tick,
    rebuild() { concept.bg = AW.sprite(W, H, (R, g) => FOREST.drawBg(R, g, th)); },
    headY: (a) => HEAD_Y[a.model] || 23,
    entrance: (a) => { const n = nestOf(a.front); return { x: n.x, y: n.y - 10 }; },
    drawBg: (R, g) => FOREST.drawBg(R, g, th),
    drawWorld: (g, t, agents) => world(g, t, agents),
    drawAction(g, a, t) {
      const hy = HEAD_Y[a.model] || 23;
      if (a.status === 'error') for (let i = 0; i < 2; i++) { const k = (t * 1.5 + i / 2) % 1; g.fillStyle = `rgba(160,220,255,${1 - k})`; g.fillRect(Math.round(a.x + a.dir * 8 + i * 3), Math.round(a.y - hy + 4 + k * 8), 1, 2); }
      if (a.status === 'done' && Math.floor(t * 1.2) % 2) text(g, 'z', a.x + 12, a.y - hy - 4 - (Math.floor(t * 2) % 3), '#ffffff', 8);
      if (a.status === 'tool' && !a.moving && (a.tool === 'Read' || a.tool === 'WebSearch')) { const k = Math.floor(t * 5) % 3; g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 2; i++) g.fillRect(Math.round(a.x + a.dir * (16 + i * 3)), Math.round(a.y - (a.tool === 'Read' ? 4 : 18) - k - i * 2), 2, 1); }
      if (th.snow && a.status !== 'done' && Math.floor(t * 0.8 + a.phase) % 3 === 0) puffs(g, a.x + a.dir * 16, a.y - hy + 10, t * 1.5, 'rgba(255,255,255,.7)', 2, 8, a.id);
    },
    drawUnit(g, a, t) {
      const col = unitColor(a), { pose, f } = AW.pose(a, t);
      const s = boar(a.model, col, variantOf(a), pose, f), z = T[a.model] || T.sonnet;
      g.fillStyle = 'rgba(10,8,20,.28)'; g.fillRect(Math.round(a.x - z.bw / 2 - 2), Math.round(a.y - 1), z.bw + 6, 2); g.fillRect(Math.round(a.x - z.bw / 2), Math.round(a.y - 2), z.bw + 2, 4);
      AW.blit(g, s, a.x, a.y - (pose === 'walk' && f ? 1 : 0), { flip: a.dir < 0, alpha: a.alpha });
    },
    drawTop: (g, t, agents) => top(g, t, agents),
    lead: 'Las u góry to barłogi projektów, każdy w innej zatoce. Na skraju lasu stoi baza dzików pod świętym dębem: tam dzik przychodzi, gdy czeka na Twoją zgodę, a druid-strażnik unosi kostur. Polana to miejsca pracy: buchtowisko, tropy, dęby, babrzysko, czochradło, paśnik, gąszcz, nowy barłóg, wzgórze i strumień. Za drogą są działki i śmietniki, a z dwóch domów na osiedlu wychodzą ludzie, gdy sesja ma błąd.',
    legend, models, pros, cons,
  };
  AW.register(concept);
  window.FOREST_LIFE = { setTheme, applyControls, current: () => th, sprite: boar };
})();
