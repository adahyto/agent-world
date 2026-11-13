// Agent World — silnik świata.
// Na żywo: odwzorowuje agentów z collectora (AW.live.sync). W symulacji: udaje kilku agentów.
// Przesuwa postacie między miejscami, rysuje wspólne efekty statusów i obsługuje sterowanie.
// Świat (forest-map.js + forest-life.js) dostarcza tło, miejsca, trasy i sprite'y przez AW.register({...}).
(() => {
  'use strict';
  const W = 640, H = 360, S = 3;
  const AW = (window.AW = { W, H, concepts: [] });
  AW.register = (c) => AW.concepts.push(c);

  // ---- pixel helpers --------------------------------------------------------
  AW.sprite = (w, h, draw) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw((x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(x, y, ww, hh); }, g);
    return c;
  };
  const cache = new Map();
  AW.cached = (key, w, h, draw) => {
    let s = cache.get(key);
    if (!s) cache.set(key, (s = AW.sprite(w, h, draw)));
    return s;
  };
  AW.shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const ch = (v) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
    return '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => ch(v).toString(16).padStart(2, '0')).join('');
  };
  AW.rand = (a, b) => a + Math.random() * (b - a);
  AW.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  AW.rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  AW.blit = (g, spr, x, y, o = {}) => {
    g.save();
    g.globalAlpha = o.alpha ?? 1;
    g.translate(Math.round(x), Math.round(y));
    if (o.angle) g.rotate(o.angle);
    if (o.flip) g.scale(-1, 1);
    g.drawImage(spr, -(o.ax ?? spr.width / 2), -(o.ay ?? spr.height));
    g.restore();
  };
  AW.text = (g, s, x, y, col, size = 8, align = 'center') => {
    size = Math.round(size * (AW.opts?.textScale || 1));
    g.font = `${size}px "Pixelify Sans", ui-monospace, monospace`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(8,10,16,.85)';
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(s, x + dx * 0.7, y + dy * 0.7);
    g.fillStyle = col;
    g.fillText(s, x, y);
  };
  // Pixel bubble with a tail, centered at x, bottom at y.
  AW.bubble = (g, x, y, w, h, fill, edge) => {
    x = Math.round(x - w / 2); y = Math.round(y - h);
    g.fillStyle = edge;
    g.fillRect(x + 1, y - 1, w - 2, h + 2); g.fillRect(x - 1, y + 1, w + 2, h - 2); g.fillRect(x, y, w, h);
    g.fillStyle = fill;
    g.fillRect(x + 1, y, w - 2, h); g.fillRect(x, y + 1, w, h - 2);
    g.fillStyle = edge; g.fillRect(x + w / 2 - 1, y + h + 1, 3, 2); g.fillRect(x + w / 2, y + h + 3, 1, 1);
    g.fillStyle = fill; g.fillRect(x + w / 2, y + h, 1, 2);
    return { x, y };
  };
  // Rising puffs (smoke, steam, dust), deterministic in time.
  AW.puffs = (g, x, y, t, col, n = 3, rise = 14, seed = 0) => {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const k = (t * 0.8 + i / n + seed * 0.37) % 1;
      const s = 2 + Math.round(k * 3);
      g.globalAlpha = 0.85 * (1 - k);
      g.fillRect(Math.round(x + Math.sin((k + i) * 6) * 3 - s / 2), Math.round(y - k * rise - s / 2), s, s);
    }
    g.globalAlpha = 1;
  };
  AW.pose = (a, t) => {
    if (a.status === 'error') return { pose: 'down', f: 0 };
    if (a.moving) return { pose: 'walk', f: Math.floor(t * 8 + a.phase) % 2 };
    if (a.status === 'tool') return { pose: 'work', f: Math.floor(t * 6 + a.phase) % 2 };
    if (a.status === 'waiting_for_user' && a.waitingFor !== 'input') return { pose: 'alert', f: Math.floor(t * 4) % 2 };
    return { pose: 'stand', f: Math.floor(t * 1.4 + a.phase) % 2 };
  };
  AW.unitColor = (a) => (a.status === 'done' ? '#8d929c' : a.color);
  // Point on the path behind the agent, `dist` px back (for train wagons).
  AW.trailPoint = (a, dist) => {
    let acc = 0, px = a.x, py = a.y;
    for (let i = a.trail.length - 1; i >= 0; i--) {
      const p = a.trail[i], d = Math.hypot(px - p.x, py - p.y);
      if (acc + d >= dist) {
        const k = (dist - acc) / (d || 1);
        return { x: px + (p.x - px) * k, y: py + (p.y - py) * k, ang: Math.atan2(py - p.y, px - p.x) };
      }
      acc += d; px = p.x; py = p.y;
    }
    const rest = dist - acc; // no trail yet: extend straight back from the last point
    return { x: px - Math.cos(a.angle) * rest, y: py - Math.sin(a.angle) * rest, ang: a.angle };
  };

  // ---- 16-bit look: outlines, chibi characters, houses, trees, ambience --------
  // Dark 1px outline around every opaque pixel. Sprites keep a 1px transparent margin.
  AW.outline = (c, col) => {
    const g = c.getContext('2d'), w = c.width, h = c.height;
    const d = g.getImageData(0, 0, w, h).data;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
    g.fillStyle = col;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1))) g.fillRect(x, y, 1, 1);
    }
    return c;
  };
  AW.cachedO = (key, w, h, draw, col = '#1d1522') => {
    let s = cache.get(key);
    if (!s) cache.set(key, (s = AW.outline(AW.sprite(w, h, draw), col)));
    return s;
  };
  // Chibi character on a 32×32 grid, facing right, feet at y=30.
  // o: { skin, hair, style, eyes, big, blush, top, top2, legs, shoes, beard, back(R,pose,f), hat(R,up), hand(R,up,work,f) }
  AW.chibi = (R, o, pose, f) => {
    const up = pose === 'alert' && f === 0, work = pose === 'work' && f === 1, walk = pose === 'walk';
    const la = walk ? (f ? 2 : 4) : 3, lb = walk ? (f ? 4 : 2) : 3;
    o.back?.(R, pose, f);
    if (!o.robe) {
      R(12, 25, 3, la + 1, o.legs); R(17, 25, 3, lb + 1, o.legs);
      R(11, 25 + la, 4, 2, o.shoes); R(17, 25 + lb, 4, 2, o.shoes);
    } else {
      R(10, 24, 13, 5, o.top2 || AW.shade(o.top, -0.18)); R(11, 29, 4, 1, o.shoes); R(18, 29, 4, 1, o.shoes);
    }
    R(10, 16, 12, 9, o.top); R(10, 22, 12, 3, o.top2 || AW.shade(o.top, -0.18)); R(10, 16, 12, 1, AW.shade(o.top, 0.25));
    R(9, 17, 2, 6, AW.shade(o.top, -0.3)); R(9, 22, 2, 2, o.skin);
    if (up) { R(21, 9, 2, 8, o.top); R(21, 7, 2, 2, o.skin); }
    else { R(21, 17, 2, 6, o.top); R(21, work ? 21 : 22, 2, 2, o.skin); }
    R(10, 4, 13, 12, o.skin); R(9, 6, 15, 8, o.skin); R(10, 14, 13, 1, AW.shade(o.skin, -0.12));
    const ey = o.eyesY ?? 9, ew = o.big ? 3 : 2, eh = o.big ? 4 : 3;
    R(14, ey, ew, eh, o.eyes || '#2a1a2a'); R(19, ey, ew, eh, o.eyes || '#2a1a2a');
    R(14, ey, 1, 1, '#ffffff'); R(19, ey, 1, 1, '#ffffff');
    if (o.big) { R(15, ey + 3, 1, 1, AW.shade(o.eyes || '#2a1a2a', 0.5)); R(20, ey + 3, 1, 1, AW.shade(o.eyes || '#2a1a2a', 0.5)); }
    if (o.blush) { R(13, ey + eh, 2, 1, o.blush); R(21, ey + eh, 2, 1, o.blush); }
    R(17, ey + eh + 1, 2, 1, o.mouth || '#8a3a3a');
    const hr = o.hair, hl = AW.shade(o.hair || '#000000', 0.35);
    if (o.style !== 'bald' && hr) {
      R(9, 3, 15, 4, hr); R(10, 2, 13, 1, hr); R(9, 3, 4, 9, hr); R(13, 6, 4, 2, hr); R(17, 6, 3, 1, hr); R(13, 3, 6, 1, hl);
      if (o.style === 'long' || o.style === 'braid') { R(7, 5, 4, 15, hr); R(22, 6, 2, 6, hr); }
      if (o.style === 'braid') { R(6, 18, 3, 7, hr); R(6, 20, 3, 1, AW.shade(hr, -0.3)); R(6, 23, 3, 1, AW.shade(hr, -0.3)); }
      if (o.style === 'spiky') { R(10, 0, 3, 3, hr); R(14, 0, 3, 3, hr); R(18, 1, 3, 2, hr); R(22, 3, 2, 4, hr); R(7, 4, 3, 3, hr); }
      if (o.style === 'bun') { R(5, 3, 5, 5, hr); R(6, 2, 3, 1, hr); }
    }
    if (o.beard) { R(13, 13, 10, 4, o.beard); R(14, 17, 8, 2, o.beard); R(16, 19, 4, 1, o.beard); }
    o.hat?.(R, up);
    o.hand?.(R, up, work, f);
  };
  // Draws a character sprite with a soft shadow; handles walking bob, facing and lying down.
  AW.drawChar = (g, a, t, spr, o = {}) => {
    const { pose, f } = AW.pose(a, t);
    const s = spr(pose === 'down' ? 'stand' : pose, f);
    g.fillStyle = 'rgba(10,8,20,.28)';
    g.fillRect(Math.round(a.x - 7), Math.round(a.y - 1), 14, 2); g.fillRect(Math.round(a.x - 5), Math.round(a.y - 2), 10, 4);
    if (pose === 'down') AW.blit(g, s, a.x + 12, a.y + 2, { angle: -Math.PI / 2, alpha: a.alpha, ay: 20 });
    else AW.blit(g, s, a.x, a.y - (pose === 'walk' && f ? 1 : 0) - (o.hop || 0), { flip: a.dir < 0, alpha: a.alpha });
  };
  // 3/4 top-down building: roof seen from above, front wall with door and windows.
  AW.house = (R, x, y, w, h, roof, wall, o = {}) => {
    const rh = Math.round(h * (o.roofK || 0.6)), wy = y + rh;
    R(x + 4, y + 5, w, h, 'rgba(10,8,20,.28)');
    R(x, wy, w, h - rh, wall); R(x, wy, w, 1, AW.shade(wall, -0.35)); R(x, y + h - 1, w, 1, AW.shade(wall, -0.25));
    if (o.beams) for (let bx = x + 4; bx < x + w - 2; bx += 6) R(bx, wy + 1, 1, h - rh - 1, AW.shade(wall, -0.18));
    R(x - 2, y, w + 4, rh, roof);
    for (let yy = y + 2; yy < y + rh - 2; yy += 3) R(x - 2, yy, w + 4, 1, AW.shade(roof, (yy - y) / rh < 0.5 ? 0.1 : -0.1));
    R(x - 2, y, w + 4, 1, AW.shade(roof, 0.3)); R(x - 2, y + rh - 2, w + 4, 2, AW.shade(roof, -0.35));
    const dw = o.doorW || 8, dx = x + Math.round(w / 2 - dw / 2), dh = Math.min(10, h - rh - 2);
    R(dx, y + h - dh, dw, dh, o.door || '#3a2416'); R(dx, y + h - dh, dw, 1, AW.shade(o.door || '#3a2416', 0.3));
    if (h - rh >= 10) for (const wx of [x + 4, x + w - 10]) if (Math.abs(wx + 3 - (dx + dw / 2)) > dw) {
      R(wx, wy + 3, 6, 5, o.win || '#ffd98a'); R(wx, wy + 3, 6, 1, AW.shade(o.win || '#ffd98a', -0.4)); R(wx + 2, wy + 3, 1, 5, AW.shade(o.win || '#ffd98a', -0.4));
    }
  };
  AW.tree = (R, x, y, s, leaf, trunk = '#5a3a24') => {
    R(x - 1, y - 2, 3, 6, trunk);
    R(x - s + 2, y - 2, s * 2 - 2, 3, 'rgba(10,8,20,.25)');
    R(x - s, y - s * 2 + 1, s * 2, s * 2 - 3, AW.shade(leaf, -0.25)); R(x - s + 2, y - s * 2 - 1, s * 2 - 4, s * 2 - 2, leaf);
    R(x - s + 2, y - s * 2 + 1, s - 1, s - 2, AW.shade(leaf, 0.25)); R(x - s + 3, y - s * 2, 2, 1, AW.shade(leaf, 0.45));
  };
  let vig = null;
  AW.vignette = (g, strength = 0.35) => {
    if (!vig) {
      vig = document.createElement('canvas'); vig.width = W; vig.height = H;
      const v = vig.getContext('2d'), gr = v.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,6,20,1)');
      v.fillStyle = gr; v.fillRect(0, 0, W, H);
    }
    g.globalAlpha = strength; g.drawImage(vig, 0, 0); g.globalAlpha = 1;
  };
  // n drifting particles (petals, leaves, dust, sparks): draw(x, y, i, k) for each.
  AW.drift = (t, n, vx, vy, draw, seed = 1) => {
    const r = AW.rng(seed * 997);
    for (let i = 0; i < n; i++) {
      const x0 = r() * W, y0 = r() * H, sp = 0.6 + r() * 0.8;
      const x = (((x0 + t * vx * sp + Math.sin(t * 0.9 + i) * 8) % W) + W) % W;
      const y = (((y0 + t * vy * sp) % H) + H) % H;
      draw(Math.round(x), Math.round(y), i, (t * 0.7 + i * 0.13) % 1);
    }
  };
  // Water tiles with moving glints.
  AW.water = (g, x, y, w, h, t, base, glint) => {
    g.fillStyle = base; g.fillRect(x, y, w, h);
    g.fillStyle = glint;
    for (let i = 0; i < (w * h) / 220; i++) {
      const gx = x + ((i * 53 + Math.floor(t * 12)) % w), gy = y + ((i * 29) % h);
      if ((Math.floor(t * 2) + i) % 3) g.fillRect(gx, gy, 3, 1);
    }
  };

  // Enemies marching on the fronts (demons, barbarians). An agent using one of
  // cfg.fightTools at its own front shoots the nearest one down.
  AW.raiders = (cfg) => {
    let list = [], shots = [], bursts = [], spawnT = 0;
    return {
      reset() { list = []; shots = []; bursts = []; spawnT = 0; },
      update(dt, agents) {
        if ((spawnT -= dt) <= 0 && list.length < cfg.max) {
          spawnT = AW.rand(0.6, 1.6);
          const front = Math.floor(Math.random() * cfg.fronts.length);
          list.push({ x: cfg.fronts[front] + AW.rand(-34, 34), y: cfg.topY, front, v: AW.rand(5, 11), stop: cfg.wallY - AW.rand(0, 14), f: Math.random() * 9, big: Math.random() < 0.15 });
        }
        for (const r of list) if (r.y < r.stop) r.y += r.v * dt;
        for (const a of agents) {
          if (a.status !== 'tool' || !cfg.fightTools.includes(a.tool) || a.moving || a.kind !== 'session') continue;
          if ((a.fireCd = (a.fireCd || 0) - dt) > 0) continue;
          a.fireCd = AW.rand(0.6, 1.1) * (a.model === 'opus' ? 1.4 : a.model === 'haiku' ? 0.7 : 1);
          const targets = list.filter((r) => r.front === a.front && !r.hit);
          if (!targets.length) continue;
          const r = targets.reduce((p, q) => (q.y > p.y ? q : p));
          r.hit = true;
          shots.push({ x0: a.x + a.dir * 6, y0: a.y - 18, r, t: 0, big: a.model === 'opus', color: cfg.shotColor(a) });
        }
        for (const s of shots) {
          s.t += dt * 3.2;
          if (s.t >= 1 && !s.done) { s.done = true; list = list.filter((r) => r !== s.r); bursts.push({ x: s.r.x, y: s.r.y - 6, t: 0 }); }
        }
        shots = shots.filter((s) => !s.done);
        for (const b of bursts) b.t += dt * 1.8;
        bursts = bursts.filter((b) => b.t < 1);
      },
      draw(g, t) {
        for (const r of list) {
          const spr = cfg.sprite(r.big, Math.floor(t * 4 + r.f) % 2);
          AW.blit(g, spr, r.x, r.y, { flip: Math.sin(r.f + t * 0.5) < 0 });
        }
        for (const s of shots) {
          const x = s.x0 + (s.r.x - s.x0) * s.t, y = s.y0 + (s.r.y - 6 - s.y0) * s.t;
          cfg.drawShot(g, x, y, s);
        }
        for (const b of bursts) {
          for (let i = 0; i < 8; i++) {
            const an = (i / 8) * Math.PI * 2, d = 2 + b.t * 12;
            g.fillStyle = i % 2 ? cfg.burst[0] : cfg.burst[1];
            g.globalAlpha = 1 - b.t;
            g.fillRect(Math.round(b.x + Math.cos(an) * d), Math.round(b.y + Math.sin(an) * d * 0.7), 2, 2);
          }
          g.globalAlpha = 1;
        }
      },
    };
  };

  // ---- simulation -----------------------------------------------------------
  const TEAM = ['#ff6b4a', '#4aa8ff', '#ffd24a', '#5be08a', '#c77dff', '#ff8ad0', '#7fe0e8', '#ffb060'];
  // Projekty = barłogi. W symulacji: pięć nazw z SESSIONS; na żywo: katalogi projektów z collectora, w kolejności pojawienia się.
  const projects = [];
  AW.projects = projects;
  AW.projectIndex = (key, name) => {
    let i = projects.findIndex((p) => p.key === key);
    if (i >= 0) return i;
    if (projects.length >= TEAM.length) { let h = 0; for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % TEAM.length; }
    projects.push({ key, name, color: TEAM[projects.length] });
    concept?.rebuild?.();
    return projects.length - 1;
  };
  // Zmyślone projekty pokazu (bez nazw prawdziwych serwisów); prompt = „ostatnie polecenie” w panelu.
  const SESSIONS = [
    { name: 'sklep', model: 'opus', start: ['tool', { tool: 'Bash' }], prompt: 'Dodaj do koszyka przycisk „kup jeszcze raz” i uruchom testy.' },
    { name: 'blog', model: 'sonnet', start: ['thinking'], prompt: 'Napisz wstęp do wpisu o jesiennym sadzeniu cebulek.' },
    { name: 'api-pogody', model: 'opus', start: ['waiting_for_user', { waitingFor: 'permission', pending: 'Edit' }], prompt: 'Popraw obsługę błędu, gdy stacja pogodowa nie odpowiada.' },
    { name: 'notatki', model: 'haiku', start: ['tool', { tool: 'Read' }], prompt: 'Zbierz z notatek listę rzeczy do zrobienia na ten tydzień.' },
    { name: 'raport', model: 'sonnet', start: ['idle'], prompt: 'Zrób wykres sprzedaży z pliku CSV za październik.' },
  ];
  AW.SESSIONS = SESSIONS;
  AW.TEAM = TEAM;
  AW.MODELS = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku', sub: 'subagent' };
  const SPEED = { opus: 34, sonnet: 46, haiku: 64, sub: 56 };
  const TOOLS = [
    ['Bash', 3], ['Read', 3], ['Edit', 2.5], ['Write', 1], ['Grep', 1.5], ['Glob', 0.6],
    ['WebSearch', 0.8], ['WebFetch', 0.6], ['TodoWrite', 0.6], ['MCP', 0.6], ['Agent', 1],
  ];
  const DUR = { idle: [6, 12], thinking: [1.5, 3.5], tool: [3, 6], error: [4, 6], done: [5, 7] };
  const WAIT = { permission: [5, 8], question: [5, 8], input: [6, 10] };
  const SUB_NAMES = ['Explore', 'Plan', 'general'];

  let concept = null, agents = [], now = 0, auto = true, selected = null, nextId = 1;
  AW.live = { enabled: false };
  function select(a) { if (a === selected) return; selected = a || null; AW.onSelect?.(selected); }
  AW.opts = { toolLabels: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches };
  const occ = new Map(); // place key -> Map(slot -> agent id)

  function makeAgent(base, front, parent) {
    return {
      id: nextId++, name: base.name, model: parent ? 'sub' : base.model,
      kind: parent ? 'subagent' : 'session', parent: parent || null, front,
      color: parent ? parent.color : TEAM[front], status: 'idle', waitingFor: null, tool: null, pending: null,
      x: 0, y: 0, path: [], dir: 1, angle: 0, heading: 0, moving: false, timer: 0, life: 0,
      born: now, since: now, alpha: 1, trail: [], slotKey: null, slot: 0, phase: Math.random() * 10,
    };
  }
  function pickTool(a) {
    const list = a.kind === 'subagent' ? TOOLS.filter(([t]) => t !== 'Agent') : TOOLS;
    let r = Math.random() * list.reduce((s, [, w]) => s + w, 0);
    for (const [t, w] of list) if ((r -= w) <= 0) return t;
    return 'Bash';
  }
  function release(a) {
    const m = occ.get(a.slotKey);
    if (m && m.get(a.slot) === a.id) m.delete(a.slot);
    a.slotKey = null;
  }
  function placeKey(a) {
    if (a.status === 'error') return null; // stays put
    if (a.status === 'waiting_for_user' && a.waitingFor !== 'input' && !concept.waitMoves) return null; // stays put, unless the world sends it somewhere
    return concept.key ? concept.key(a) : a.status === 'tool' ? a.tool : a.status;
  }
  function retarget(a, teleport) {
    const key = placeKey(a);
    if (key == null) { a.path = []; return; } // stops where it is and keeps its slot, so nobody lands on it
    if (key === a.slotKey) return;
    release(a);
    let m = occ.get(key);
    if (!m) occ.set(key, (m = new Map()));
    let s = 0;
    while (m.has(s)) s++;
    m.set(s, a.id); a.slotKey = key; a.slot = s;
    const dest = concept.spot(a, s);
    if (teleport) {
      a.x = dest.x; a.y = dest.y; a.path = []; a.trail = [];
      if (dest.ang != null) a.angle = a.heading = dest.ang;
      return;
    }
    a.path = concept.route ? concept.route(a, { x: a.x, y: a.y }, dest) : [dest];
  }
  function setState(a, status, o = {}) {
    a.status = status; a.tool = o.tool || null; a.waitingFor = o.waitingFor || null; a.pending = o.pending || null;
    a.since = now;
    const [lo, hi] = status === 'waiting_for_user' ? WAIT[a.waitingFor] : DUR[status];
    a.timer = o.hold ?? AW.rand(lo, hi);
    a.spawnSubs = !AW.live.enabled && status === 'tool' && a.tool === 'Agent';
    retarget(a, o.teleport);
    if (a.spawnSubs && !a.path.length) { a.spawnSubs = false; spawnSubs(a); }
  }
  function spawnSubs(p) {
    const n = p.model === 'opus' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const s = makeAgent({ name: AW.pick(SUB_NAMES) }, p.front, p);
      s.x = p.x + (i ? 8 : -8); s.y = p.y + 4; s.life = AW.rand(12, 20);
      agents.push(s);
      setState(s, 'thinking');
    }
  }
  function respawn(a) {
    const e = concept.entrance(a);
    a.x = e.x; a.y = e.y; a.trail = []; a.path = []; a.born = now; a.alpha = 1;
    release(a);
    setState(a, 'idle');
  }
  function next(a) {
    const r = Math.random(), sub = a.kind === 'subagent';
    switch (a.status) {
      case 'idle':
        if (r < 0.05) return setState(a, 'done');
        if (r < 0.25) return setState(a, 'waiting_for_user', { waitingFor: 'input' });
        return setState(a, 'thinking');
      case 'thinking':
        if (sub && now - a.born > a.life) return setState(a, 'done');
        if (!sub && r < 0.14) return setState(a, 'idle');
        if (!sub && r < 0.26) return setState(a, 'waiting_for_user', { waitingFor: 'permission', pending: pickTool(a) });
        if (!sub && r < 0.31) return setState(a, 'waiting_for_user', { waitingFor: 'question' });
        if (r < 0.33) return setState(a, 'error');
        return setState(a, 'tool', { tool: pickTool(a) });
      case 'tool':
        return setState(a, 'thinking');
      case 'waiting_for_user':
        if (a.waitingFor === 'permission') return setState(a, 'tool', { tool: a.pending || 'Bash' });
        return setState(a, 'thinking');
      case 'error':
        return setState(a, sub ? 'done' : 'idle');
      case 'done':
        if (sub) { a.dead = true; release(a); return; }
        return respawn(a);
    }
  }
  function update(dt) {
    now += dt;
    for (const a of agents.slice()) {
      if (a.path.length) {
        const p = a.path[0], dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy);
        const sp = (concept.speed?.[a.model] ?? SPEED[a.model]) * dt;
        if (d <= sp) { a.x = p.x; a.y = p.y; a.path.shift(); } else { a.x += (dx / d) * sp; a.y += (dy / d) * sp; }
        if (Math.abs(dx) > 0.5) a.dir = dx > 0 ? 1 : -1;
        if (d > 0.5) a.heading = Math.atan2(dy, dx);
        a.moving = true;
        const last = a.trail[a.trail.length - 1];
        if (!last || Math.hypot(last.x - a.x, last.y - a.y) > 2) { a.trail.push({ x: a.x, y: a.y }); if (a.trail.length > 120) a.trail.shift(); }
        if (!a.path.length && a.spawnSubs) { a.spawnSubs = false; spawnSubs(a); }
      } else a.moving = false;
      let da = a.heading - a.angle;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      a.angle += da * Math.min(1, dt * 6);
      if (a.status === 'done') a.alpha = Math.max(0.25, a.alpha - dt / 5);
      if (!a.moving && !AW.live.enabled && (auto || a.kind === 'subagent')) {
        a.timer -= dt;
        if (a.timer <= 0) next(a);
      }
    }
    agents = agents.filter((a) => !a.dead);
    if (selected && selected.dead) select(null);
    concept.tick?.(dt, agents, now);
  }

  // ---- drawing --------------------------------------------------------------
  const cv = document.getElementById('stage');
  const g = cv.getContext('2d');
  cv.width = W * S; cv.height = H * S;

  function drawAgent(a, t) {
    const age = now - a.born;
    g.save();
    if (age < 0.8) {
      const k = age / 0.8;
      g.globalAlpha = 1 - k;
      g.fillStyle = concept.spawnColor || '#bff4ff';
      const w = Math.round(14 * (1 - k)) + 2;
      g.fillRect(Math.round(a.x - w / 2), 0, w, Math.round(a.y));
      g.globalAlpha = k;
    }
    concept.drawUnit(g, a, t);
    g.restore();
  }
  // Podpisy sesji nie nachodzą na siebie: gdy dwa dziki stoją blisko, niższy podpis schodzi o wiersz w dół.
  function placeLabels(list) {
    const placed = [];
    for (const a of list) {
      a.labelDy = 0;
      if (a.kind !== 'session') continue;
      const w = a.name.length * 4.6 + 4, x = a.x;
      let y = a.y + 9;
      for (let guard = 0; guard < 4; guard++) {
        const hit = placed.some((p) => Math.abs(p.x - x) < (p.w + w) / 2 && Math.abs(p.y - y) < 8);
        if (!hit) break;
        y += 8; a.labelDy += 8;
      }
      placed.push({ x, y, w });
    }
  }
  function head(a) { return a.y - (concept.headY ? concept.headY(a) : a.kind === 'subagent' ? 20 : 34); }

  function drawFx(a, t) {
    const hx = Math.round(a.x), hy = Math.round(head(a));
    const blink = AW.opts.reduced ? true : Math.floor(t * 3) % 2 === 0;
    if (a === selected) {
      const r = a.kind === 'subagent' ? 11 : 18, y0 = Math.round(a.y - r * 1.6), y1 = Math.round(a.y + 3);
      g.fillStyle = '#ffffff';
      for (const [x, y, sx, sy] of [[hx - r, y0, 1, 1], [hx + r, y0, -1, 1], [hx - r, y1, 1, -1], [hx + r, y1, -1, -1]]) {
        g.fillRect(x, y, 4 * sx, 1); g.fillRect(x, y, 1, 4 * sy);
      }
    }
    if (a.kind === 'session') AW.text(g, a.name, hx, Math.round(a.y + 9 + (a.labelDy || 0)), AW.shade(a.color, 0.35), 8);
    if (a.status === 'thinking') {
      const b = AW.bubble(g, hx, hy, 17, 9, '#f4f6fb', '#20242e');
      const n = Math.floor(t * 3) % 4;
      g.fillStyle = '#20242e';
      for (let i = 0; i < 3; i++) if (i < n) g.fillRect(b.x + 4 + i * 4, b.y + 4, 2, 2);
    } else if (a.status === 'waiting_for_user' && a.waitingFor === 'permission') {
      const k = (t * 1.6) % 1;
      g.strokeStyle = `rgba(255,59,59,${1 - k})`;
      g.lineWidth = 1.2;
      g.beginPath(); g.ellipse(hx, a.y, 8 + k * 16, 3 + k * 6, 0, 0, Math.PI * 2); g.stroke();
      if (blink) {
        const by = hy - 4 - (AW.opts.reduced ? 0 : Math.abs(Math.sin(t * 6)) * 3);
        AW.bubble(g, hx, by, 11, 14, '#ff3b3b', '#3a0606');
        g.fillStyle = '#ffffff';
        g.fillRect(hx - 1, Math.round(by - 12), 2, 7); g.fillRect(hx - 1, Math.round(by - 3), 2, 2);
      }
    } else if (a.status === 'waiting_for_user' && a.waitingFor === 'question') {
      const by = hy - 2 - (AW.opts.reduced ? 0 : Math.sin(t * 3) * 1.5);
      AW.bubble(g, hx, by, 11, 13, '#ffd23f', '#3a2e05');
      AW.text(g, '?', hx, Math.round(by - 6), '#3a2e05', 10);
    } else if (a.status === 'waiting_for_user') {
      const b = AW.bubble(g, hx, hy, 15, 9, '#bff3cf', '#0f3a1f');
      g.fillStyle = '#0f3a1f';
      g.fillRect(b.x + 4, b.y + 3, 1, 1); g.fillRect(b.x + 5, b.y + 4, 1, 1); g.fillRect(b.x + 4, b.y + 5, 1, 1);
      if (Math.floor(t * 1.5) % 2) g.fillRect(b.x + 7, b.y + 5, 4, 1);
    } else if (a.status === 'tool' && AW.opts.toolLabels && !a.moving) {
      const label = a.tool;
      g.font = '8px "Pixelify Sans", ui-monospace, monospace';
      const w = Math.ceil(g.measureText(label).width) + 6;
      const b = AW.bubble(g, hx, hy, w, 10, '#20242e', '#f4f6fb');
      AW.text(g, label, hx, b.y + 5, '#f4f6fb', 8);
    } else if (a.status === 'error' && !concept.ownError) {
      AW.puffs(g, hx, a.y - 10, t, '#6b6f78', 4, 20, a.id);
      if (blink) { g.fillStyle = '#ff5a36'; g.fillRect(hx - 6 + ((t * 40) % 12), Math.round(a.y - 8), 1, 1); }
    }
  }

  function render(t) {
    g.setTransform(S, 0, 0, S, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(concept.bg, 0, 0);
    concept.drawWorld?.(g, t, agents, now);
    const list = agents.slice().sort((p, q) => p.y - q.y);
    for (const a of list) concept.drawAction?.(g, a, t);
    for (const a of list) drawAgent(a, t);
    concept.drawTop?.(g, t, agents, now);
    placeLabels(list);
    for (const a of list) drawFx(a, t);
  }

  // ---- UI -------------------------------------------------------------------
  const $ = (s) => document.querySelector(s);
  function describe(a) {
    return a.status === 'tool' ? `tool · ${a.tool}` : a.waitingFor ? `waiting · ${a.waitingFor}` : a.status;
  }
  AW.state = () => ({ agents, selected });
  const CHIP_ST = { idle: 'czeka na polecenie', thinking: 'myśli', tool: 'pracuje', done: 'zakończona', error: 'błąd', 'w-permission': 'czeka na zgodę', 'w-question': 'zadaje pytanie', 'w-input': 'bezczynna' };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  AW.ago = (t) => {
    const s = Math.max(0, Math.round((Date.now() - t) / 1000));
    if (s < 60) return '<1 min';
    if (s < 3600) return `${Math.floor(s / 60)} min`;
    if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
    return `${Math.floor(s / 86400)} d`;
  };
  function renderChips() {
    const box = $('#chips');
    if (!box) return;
    const html = agents.map((a) => {
      const key = a.waitingFor ? 'w-' + a.waitingFor : a.status;
      const cls = ['chip', a === selected ? 'is-sel' : '', 'st-' + key, a.kind === 'subagent' ? 'is-sub' : ''].join(' ');
      const nm = a.kind === 'subagent' ? `↳ ${a.name}` : a.name;
      const st = (CHIP_ST[key] || a.status) + (a.status === 'tool' && a.tool ? `: ${a.tool}` : '');
      const src = a.srcId && window.LIVE ? LIVE.agents.get(a.srcId) : null;
      const since = src && (src.since || src.updatedAt) ? AW.ago(src.since || src.updatedAt) : '';
      const proj = a.project && !String(a.name).startsWith(a.project) ? `<span class="chip-proj">${esc(a.project)}</span>` : '';
      return `<button type="button" class="${cls}" data-id="${esc(a.id)}" style="--pc:${a.color}"><span class="chip-top"><i></i><b>${esc(nm)}</b><small>${AW.MODELS[a.model]}</small></span>${proj}<span class="chip-st"><em>${st}</em>${since ? `<time>${since}</time>` : ''}</span></button>`;
    }).join('');
    if (box.dataset.html !== html) { box.innerHTML = html; box.dataset.html = html; }
    const sn = $('#sel-name'); if (sn) sn.textContent = selected ? `${selected.name} (${AW.MODELS[selected.model]})` : '—';
    const sm = $('#sel-msg'); if (sm) sm.textContent = selected && selected.lastMessage ? selected.lastMessage : '';
  }
  function renderLegend(c) {
    const rows = (list) => list.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('');
    $('#legend').innerHTML = `
      <p class="lead">${c.lead}</p>
      <div class="cols">
        <section><h3>Statusy na mapie</h3><table>${rows(c.legend)}</table></section>
        <section><h3>Modele i projekty</h3><table>${rows(c.models)}</table>
          ${c.pros.length || c.cons.length ? `<h3>Do dyskusji</h3><ul class="pc">${c.pros.map((p) => `<li class="pro">${p}</li>`).join('')}${c.cons.map((p) => `<li class="con">${p}</li>`).join('')}</ul>` : ''}
        </section>
      </div>`;
  }
  function start(c) {
    concept = c; occ.clear(); agents = []; now = 0; projects.length = 0;
    c.reset?.();
    if (!AW.live.enabled) {
      SESSIONS.forEach((s) => AW.projectIndex(s.name, s.name));
      c.rebuild?.();
      c.bg = c.bg || AW.sprite(W, H, (R, gg) => c.drawBg(R, gg));
      SESSIONS.forEach((s, i) => {
        const a = makeAgent(s, i);
        a.born = -5;
        agents.push(a);
        setState(a, 'idle', { teleport: true });
        const [st, o = {}] = s.start;
        if (st !== 'idle') setState(a, st, { ...o, teleport: true }); // waiting stays at the idle spot
        a.timer += i * 1.2;
      });
    } else { c.rebuild?.(); c.bg = c.bg || AW.sprite(W, H, (R, gg) => c.drawBg(R, gg)); if (AW.live.last) AW.live.sync(AW.live.last); }
    select(AW.live.enabled ? null : agents[2] || agents[0] || null);
    document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === c.id)));
    const cn = $('#concept-name'), ct = $('#concept-tag');
    if (cn) cn.textContent = c.name;
    if (ct) ct.textContent = c.tagline;
    renderLegend(c);
  }
  // ---- tryb na żywo: lista agentów z collectora zamiast symulacji ----------------
  const MODEL_OF = (m) => (/opus/i.test(m || '') ? 'opus' : /haiku/i.test(m || '') ? 'haiku' : 'sonnet');
  const TOOL_OF = (t) => (!t ? null : /^mcp__/.test(t) ? 'MCP' : t);
  AW.live.sync = (list) => {
    AW.live.last = list;
    if (!concept || !AW.live.enabled) return;
    const seen = new Set();
    const names = {};
    for (const c of list) if (c.kind !== 'subagent') names[c.name] = (names[c.name] || 0) + 1;
    for (const c of list) {
      seen.add(c.id);
      const parentSrc = c.parentId ? list.find((x) => x.id === c.parentId) : null;
      const key = (parentSrc || c).project || c.name;
      const front = AW.projectIndex(key, path(key));
      let a = agents.find((x) => x.srcId === c.id);
      if (!a) {
        const parent = c.parentId ? agents.find((x) => x.srcId === c.parentId) : null;
        a = makeAgent({ name: c.name, model: MODEL_OF(c.model) }, front, parent);
        a.srcId = c.id; a.color = parent ? parent.color : TEAM[front];
        const e = concept.entrance(a);
        a.x = parent ? parent.x - 8 : e.x; a.y = parent ? parent.y + 4 : e.y;
        agents.push(a);
        setState(a, 'idle', { hold: 1e9 });
      }
      a.name = c.kind === 'subagent' ? c.name : names[c.name] > 1 ? `${c.name}·${c.sid}` : c.name;
      a.project = path(key);
      a.srcModel = c.model; a.lastMessage = c.lastMessage || null;
      if (c.model && a.kind === 'session') a.model = MODEL_OF(c.model);
      const tool = c.status === 'tool' ? TOOL_OF(c.currentTool) || 'other' : null, wf = c.status === 'waiting_for_user' ? c.waitingFor || 'input' : null;
      if (a.status !== c.status || a.tool !== tool || a.waitingFor !== wf) { if (a.status === 'done') a.alpha = 1; setState(a, c.status, { tool, waitingFor: wf, hold: 1e9 }); }
    }
    for (const a of agents) if (!seen.has(a.srcId)) { a.dead = true; release(a); }
    agents = agents.filter((a) => !a.dead);
    if (selected && selected.dead) select(null);
    else if (selected) AW.onSelect?.(selected);
  };
  const path = (p) => String(p || '').split('/').filter(Boolean).pop() || String(p || '');
  AW.setLive = (on) => { AW.live.enabled = on; if (concept) start(concept); };

  AW.boot = () => {
    const tabs = $('#tabs');
    if (AW.concepts.length < 2) tabs.hidden = true;
    tabs.innerHTML = AW.concepts.map((c) => `<button type="button" role="tab" data-id="${c.id}">${c.short}</button>`).join('');
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      start(AW.concepts.find((c) => c.id === b.dataset.id));
      try { history.replaceState(null, '', '#' + b.dataset.id); } catch (_) { /* sandboxed */ }
    });
    $('#chips').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b) select(agents.find((a) => a.id === Number(b.dataset.id)) || selected);
    });
    cv.addEventListener('click', (e) => {
      const r = cv.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * W, y = ((e.clientY - r.top) / r.height) * H;
      let best = null, bd = 26;
      for (const a of agents) { const d = Math.hypot(a.x - x, a.y - 12 - y); if (d < bd) { bd = d; best = a; } }
      select(best);
    });
    $('#controls').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-status]');
      if (!b || !selected) return;
      const o = { hold: 12 };
      if (b.dataset.tool) o.tool = b.dataset.tool;
      if (b.dataset.wait) { o.waitingFor = b.dataset.wait; o.pending = 'Edit'; }
      if (b.dataset.status === 'done') o.hold = 6;
      selected.alpha = 1;
      setState(selected, b.dataset.status, o);
    });
    $('#auto').addEventListener('change', (e) => { auto = e.target.checked; if (AW.live.supported) AW.setLive(!e.target.checked); });
    $('#labels').addEventListener('change', (e) => { AW.opts.toolLabels = e.target.checked; });
    const first = AW.concepts.find((c) => '#' + c.id === location.hash) || AW.concepts[0];
    start(first);
    let last = performance.now(), chipT = 0;
    const loop = (ms) => {
      const dt = Math.min(0.1, (ms - last) / 1000);
      last = ms;
      update(dt);
      render(now);
      if ((chipT += dt) > 0.25) { chipT = 0; renderChips(); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };
})();
