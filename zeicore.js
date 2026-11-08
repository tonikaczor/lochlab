'use strict';
/* Tonfunk Zeichnungs-Lab: Kern (ZEI_CORE). Keine DOM-Zugriffe, nur Rechnung und SVG-Texte.
   Körper = Voxel-Modell {nx,ny,nz,c[],holes[],u}. Koordinaten: x nach rechts, y nach hinten (y=0 ist die Vorderseite), z nach oben.
   Projektionsmethode 1 (Europa): Vorderansicht Mitte, Draufsicht UNTER, Seitenansicht von links RECHTS der Vorderansicht.
   Ansichtsgitter (a nach rechts, b nach oben, k = Tiefe, 0 = nächste Schicht zum Betrachter):
     front: a=x, b=z, k=y      top: a=x, b=y (hinten oben), k=Blick von oben      side: a=ny-1-y, b=z, k=x (Blick von links)
   Kantencodes: 0 keine, 1 sichtbar (Volllinie), 2 verdeckt (Strichlinie). */
(function (root) {
  const VN = { front: 'Vorderansicht', top: 'Draufsicht', side: 'Seitenansicht von links' };
  const VIEWS = ['front', 'top', 'side'];

  /* ---------- Zufall, Zahlen ---------- */
  function hashStr(s) { s = String(s); let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function rng(seed) { let a = typeof seed === 'number' ? seed >>> 0 : hashStr(seed); return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  const rnd6 = v => Math.round(v * 1e6) / 1e6;
  const fmtDe = v => String(rnd6(v)).replace('.', ',');
  function parseDe(s) { s = String(s == null ? '' : s).trim().replace(/\s/g, '').replace(',', '.'); return s === '' || !/^[-+]?\d*\.?\d+$/.test(s) ? NaN : Number(s); }

  /* ---------- Modelle ---------- */
  function mk(nx, ny, nz) { return { nx, ny, nz, c: new Array(nx * ny * nz).fill(0), holes: [], u: 10 }; }
  const get = (m, x, y, z) => (x < 0 || y < 0 || z < 0 || x >= m.nx || y >= m.ny || z >= m.nz) ? 0 : m.c[x + m.nx * (y + m.ny * z)];
  const put = (m, x, y, z, v) => { m.c[x + m.nx * (y + m.ny * z)] = v ? 1 : 0; };
  /* lay[z][r]: Schicht z (unten beginnend), Zeile r von hinten (r=0) nach vorn (letzte Zeile = y=0), wie in der Draufsicht gezeichnet */
  function fromLayers(def) {
    const lay = def.lay, nz = lay.length, ny = lay[0].length, nx = lay[0][0].length, m = mk(nx, ny, nz);
    for (let z = 0; z < nz; z++) for (let r = 0; r < ny; r++) for (let x = 0; x < nx; x++) put(m, x, ny - 1 - r, z, lay[z][r][x] === '#');
    m.holes = (def.holes || []).map(h => Object.assign({}, h)); m.u = def.u || 10; m.name = def.name || ''; return m;
  }
  const count = m => m.c.reduce((a, b) => a + b, 0);
  function clone(m) { const n = mk(m.nx, m.ny, m.nz); n.c = m.c.slice(); n.holes = m.holes.map(h => Object.assign({}, h)); n.u = m.u; n.name = m.name; return n; }
  function rotate(m, r) { let cur = m; for (let i = 0; i < ((r % 4) + 4) % 4; i++) { const n = mk(cur.ny, cur.nx, cur.nz); for (let z = 0; z < cur.nz; z++) for (let y = 0; y < cur.ny; y++) for (let x = 0; x < cur.nx; x++) if (get(cur, x, y, z)) put(n, cur.ny - 1 - y, x, z, 1); n.u = cur.u; cur = n; } return cur; }
  function mirror(m, ax) { const n = mk(m.nx, m.ny, m.nz); n.u = m.u; for (let z = 0; z < m.nz; z++) for (let y = 0; y < m.ny; y++) for (let x = 0; x < m.nx; x++) if (get(m, x, y, z)) put(n, ax === 'x' ? m.nx - 1 - x : x, ax === 'y' ? m.ny - 1 - y : y, ax === 'z' ? m.nz - 1 - z : z, 1); return n; }
  const cache = {};
  function modelByName(name) { const D = root.ZEI_DATA; if (!cache[name]) { if (!D || !D.models[name]) throw new Error('Modell fehlt: ' + name); cache[name] = fromLayers(Object.assign({ name }, D.models[name])); } return clone(cache[name]); }
  function connected(m) {
    const n = count(m); if (!n) return false; const seen = new Set(); let st = null;
    for (let i = 0; i < m.c.length && !st; i++) if (m.c[i]) st = [i]; seen.add(st[0]);
    while (st.length) { const i = st.pop(), x = i % m.nx, y = Math.floor(i / m.nx) % m.ny, z = Math.floor(i / (m.nx * m.ny));
      [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].forEach(d => { const a = x + d[0], b = y + d[1], c = z + d[2]; if (get(m, a, b, c)) { const j = a + m.nx * (b + m.ny * c); if (!seen.has(j)) { seen.add(j); st.push(j); } } }); }
    return seen.size === n;
  }

  /* ---------- Ansichten ---------- */
  const dimsOf = (m, v) => v === 'front' ? [m.nx, m.nz, m.ny] : v === 'top' ? [m.nx, m.ny, m.nz] : [m.ny, m.nz, m.nx];
  function occ(m, v, a, b, k) { return v === 'front' ? get(m, a, k, b) : v === 'top' ? get(m, a, b, m.nz - 1 - k) : get(m, k, m.ny - 1 - a, b); }
  function depthMap(m, v) {
    const d = dimsOf(m, v), W = d[0], H = d[1], K = d[2], D = [];
    for (let a = 0; a < W; a++) { D[a] = []; for (let b = 0; b < H; b++) { let t = Infinity; for (let k = 0; k < K; k++) if (occ(m, v, a, b, k)) { t = k; break; } D[a][b] = t; } }
    return D;
  }
  const realEdge = (q0, q1, q2, q3) => { const n = q0 + q1 + q2 + q3; return n === 1 || n === 3 || (n === 2 && q0 === q2); };
  /* Kantenraster einer Ansicht: h[a][bl] waagerechtes Stück von (a,bl) nach (a+1,bl); v[al][b] senkrechtes Stück von (al,b) nach (al,b+1) */
  function edgeGrid(m, v) {
    const d = dimsOf(m, v), W = d[0], H = d[1], K = d[2], D = depthMap(m, v), o = (a, b, k) => occ(m, v, a, b, k);
    const dd = (a, b) => (a < 0 || b < 0 || a >= W || b >= H) ? Infinity : D[a][b], h = [], vv = [];
    for (let a = 0; a < W; a++) { h[a] = []; for (let bl = 0; bl <= H; bl++) {
      let c = 0; if (dd(a, bl - 1) !== dd(a, bl)) c = 1; else for (let kl = 0; kl <= K; kl++) if (realEdge(o(a, bl - 1, kl - 1), o(a, bl, kl - 1), o(a, bl, kl), o(a, bl - 1, kl))) { c = 2; break; }
      h[a][bl] = c; } }
    for (let al = 0; al <= W; al++) { vv[al] = []; for (let b = 0; b < H; b++) {
      let c = 0; if (dd(al - 1, b) !== dd(al, b)) c = 1; else for (let kl = 0; kl <= K; kl++) if (realEdge(o(al - 1, b, kl - 1), o(al, b, kl - 1), o(al, b, kl), o(al - 1, b, kl))) { c = 2; break; }
      vv[al][b] = c; } }
    return { W, H, h, v: vv };
  }
  const emptyGrid = (W, H) => ({ W, H, h: Array.from({ length: W }, () => new Array(H + 1).fill(0)), v: Array.from({ length: W + 1 }, () => new Array(H).fill(0)) });
  const gridKey = g => g.h.map(r => r.join('')).join('|') + '/' + g.v.map(r => r.join('')).join('|');
  const sig = (m, v) => gridKey(edgeGrid(m, v));
  const sil = (m, v) => depthMap(m, v).map(col => col.map(x => (x === Infinity ? 0 : 1)));
  const silKey = (m, v) => sil(m, v).map(c => c.join('')).join('|');
  function fullBox(m, v) { const s = sil(m, v); if (!s.length) return false; if (!s.every(c => c.some(x => x))) return false; for (let b = 0; b < s[0].length; b++) if (!s.some(c => c[b])) return false; return true; }
  function toLines(g) {
    const vis = [], hid = [];
    [[1, vis], [2, hid]].forEach(p => { const c = p[0], out = p[1];
      for (let bl = 0; bl <= g.H; bl++) { let a = 0; while (a < g.W) { if (g.h[a][bl] === c) { let e = a; while (e < g.W && g.h[e][bl] === c) e++; out.push([a, bl, e, bl]); a = e; } else a++; } }
      for (let al = 0; al <= g.W; al++) { let b = 0; while (b < g.H) { if (g.v[al][b] === c) { let e = b; while (e < g.H && g.v[al][e] === c) e++; out.push([al, b, al, e]); b = e; } else b++; } } });
    return { W: g.W, H: g.H, vis, hid };
  }
  const lines = (m, v) => toLines(edgeGrid(m, v));
  /* Stetige Abbildung Modell -> Ansichtsebene (für Mittellinien) */
  const P = (m, v, p) => v === 'front' ? [p[0], p[2]] : v === 'top' ? [p[0], p[1]] : [m.ny - p[1], p[2]];
  function centerLines(m, v) {
    const out = [];
    (m.holes || []).forEach(h => {
      let p0, p1;
      if (h.ax === 'z') { p0 = [h.x + .5, h.y + .5, h.from - .3]; p1 = [h.x + .5, h.y + .5, h.to + .3]; }
      else if (h.ax === 'y') { p0 = [h.x + .5, h.from - .3, h.z + .5]; p1 = [h.x + .5, h.to + .3, h.z + .5]; }
      else { p0 = [h.from - .3, h.y + .5, h.z + .5]; p1 = [h.to + .3, h.y + .5, h.z + .5]; }
      const a = P(m, v, p0), b = P(m, v, p1);
      if (Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9) { const r = .75; out.push([a[0] - r, a[1], a[0] + r, a[1]], [a[0], a[1] - r, a[0], a[1] + r]); }
      else out.push([a[0], a[1], b[0], b[1]]);
    });
    return out;
  }
  /* Anordnung nach Projektionsmethode 1; Rechtecke in Pixeln */
  function layout(m, s, o) {
    o = o || {}; const padL = o.padL == null ? 16 : o.padL, padT = o.padT == null ? 16 : o.padT, gap = o.gap || Math.max(32, Math.round(s * 0.7));
    const fw = m.nx * s, fh = m.nz * s, th = m.ny * s, sw = m.ny * s;
    const front = { x: padL, y: padT, w: fw, h: fh, W: m.nx, H: m.nz };
    const top = { x: padL, y: padT + fh + gap, w: fw, h: th, W: m.nx, H: m.ny };
    const side = { x: padL + fw + gap, y: padT, w: sw, h: fh, W: m.ny, H: m.nz };
    return { front, top, side, s, gap, W: padL + fw + gap + sw + 16, H: top.y + th + 34 };
  }
  /* Verdeckungsprüfung für die Isometrie: jede Zelle mit freier Fläche (nicht ganz im Inneren) muss in der Isometrie (von vorn rechts oben) mit mindestens einer Fläche sichtbar sein */
  function isoVisibleAll(m) {
    const lim = (m.nx + m.ny + m.nz) * 1.2, us = [.2, .5, .8];
    const free = (p) => { for (let t = .07; t < lim; t += .13) if (get(m, Math.floor(p[0] + t), Math.floor(p[1] - t), Math.floor(p[2] + t))) return false; return true; };
    for (let z = 0; z < m.nz; z++) for (let y = 0; y < m.ny; y++) for (let x = 0; x < m.nx; x++) {
      if (!get(m, x, y, z) || (get(m, x + 1, y, z) && get(m, x, y - 1, z) && get(m, x, y, z + 1))) continue; let vis = false;
      for (const u of us) for (const w of us) { if (vis) break;
        if (!get(m, x, y, z + 1) && free([x + u, y + w, z + 1.02])) vis = true;
        else if (!get(m, x, y - 1, z) && free([x + u, y - .02, z + w])) vis = true;
        else if (!get(m, x + 1, y, z) && free([x + 1.02, y + u, z + w])) vis = true; }
      if (!vis) return false;
    }
    return true;
  }
  /* Sind drei Silhouetten (Vorder-, Drauf-, Seitenansicht) durch irgendeinen Körper darstellbar? (visuelle Hülle) */
  function hullOK(F, T, S) {
    const nx = F.length, nz = F[0].length, ny = T[0].length;
    if (T.length !== nx || S.length !== ny || S[0].length !== nz) return false;
    const f = F.map(c => c.map(() => 0)), t = T.map(c => c.map(() => 0)), s = S.map(c => c.map(() => 0));
    for (let x = 0; x < nx; x++) for (let y = 0; y < ny; y++) for (let z = 0; z < nz; z++) if (F[x][z] && T[x][y] && S[ny - 1 - y][z]) { f[x][z] = 1; t[x][y] = 1; s[ny - 1 - y][z] = 1; }
    const eq = (A, B) => A.every((c, i) => c.every((v, j) => v === B[i][j]));
    return eq(f, F) && eq(t, T) && eq(s, S);
  }
  const silSet = (m, o) => { const r = {}; VIEWS.forEach(v => { r[v] = o && o[v] ? o[v] : sil(m, v); }); return r; };

  /* ---------- Schnitt (Vollschnitt, Schnittebene parallel zur Vorderansicht durch die Mitte der Schicht y=cy; Blick von vorn, Vorderteil entfernt) ---------- */
  function sectionData(m, cy) {
    const m2 = mk(m.nx, m.ny - cy, m.nz); for (let z = 0; z < m.nz; z++) for (let y = cy; y < m.ny; y++) for (let x = 0; x < m.nx; x++) if (get(m, x, y, z)) put(m2, x, y - cy, z, 1);
    const g = edgeGrid(m2, 'front'); g.h = g.h.map(r => r.map(c => (c === 1 ? 1 : 0))); g.v = g.v.map(r => r.map(c => (c === 1 ? 1 : 0)));
    const hatch = []; for (let x = 0; x < m.nx; x++) for (let z = 0; z < m.nz; z++) if (get(m, x, cy, z)) hatch.push([x, z]);
    g.hatch = hatch; return g;
  }
  const sectionKey = s => gridKey(s) + '#' + s.hatch.map(p => p.join(',')).join(';');

  /* ---------- Körper erzeugen ---------- */
  function mutate(m, R, n) {
    const q = clone(m); q.holes = [];
    for (let i = 0; i < n; i++) { const x = ri(R, 0, m.nx - 1), y = ri(R, 0, m.ny - 1), z = ri(R, 0, m.nz - 1); put(q, x, y, z, !get(q, x, y, z)); }
    return q;
  }
  /* Ändert die Silhouette in einer Ansicht: eine ganze Sichtlinie leeren oder füllen */
  function mutateView(m, v, R) {
    const d = dimsOf(m, v), a = ri(R, 0, d[0] - 1), b = ri(R, 0, d[1] - 1), q = clone(m); q.holes = []; let any = false;
    for (let k = 0; k < d[2]; k++) if (occ(m, v, a, b, k)) any = true;
    for (let k = 0; k < d[2]; k++) { const x = v === 'front' ? a : v === 'top' ? a : k, y = v === 'front' ? k : v === 'top' ? b : m.ny - 1 - a, z = v === 'front' ? b : v === 'top' ? m.nz - 1 - k : b; put(q, x, y, z, !any); }
    return q;
  }
  function genBody(R, level) {
    for (let t = 0; t < 400; t++) {
      const nx = ri(R, 3, level >= 3 ? 5 : 4), ny = ri(R, 2, 3), nz = ri(R, 2, level >= 3 ? 4 : 3), m = mk(nx, ny, nz), hs = [];
      for (let x = 0; x < nx; x++) { hs[x] = []; for (let y = 0; y < ny; y++) { hs[x][y] = ri(R, 1, nz); for (let z = 0; z < hs[x][y]; z++) put(m, x, y, z, 1); } }
      if (level >= 2 && ny >= 3 && nx >= 3 && R() < .5) { const hx = ri(R, 1, nx - 2), hy = ri(R, 1, ny - 2), hh = hs[hx][hy]; for (let z = 0; z < hh; z++) put(m, hx, hy, z, 0); m.holes = [{ ax: 'z', x: hx, y: hy, from: 0, to: hh }]; }
      m.name = 'rand';
      const n = count(m); if (n < 5 || n > 30 || !connected(m) || !isoVisibleAll(m) || !VIEWS.every(v => fullBox(m, v))) continue;
      const flat = new Set(); hs.forEach(c => c.forEach(h => flat.add(h))); if (flat.size < 2) continue;
      if (new Set(VIEWS.map(v => sig(m, v))).size < 3 && t < 300) continue;
      return m;
    }
    return modelByName('treppe');
  }

  /* ---------- Antwortmöglichkeiten ---------- */
  /* Alternativen zu einer Ansicht: gespiegelte oder in einzelnen Würfeln veränderte Körper. opt.given = Silhouetten der gegebenen Ansichten
     (dann bevorzugt: Alternative ist mit den gegebenen Ansichten durch keinen Körper darstellbar) */
  function viewChoices(m, v, R, opt) {
    opt = opt || {}; const base = sig(m, v), baseSil = silKey(m, v), seen = new Set([base]), cand = [];
    const consider = nm => {
      const s = sig(nm, v); if (seen.has(s) || !fullBox(nm, v)) return; seen.add(s);
      const diffSil = silKey(nm, v) !== baseSil; let hullBad = false;
      if (opt.given) { const S = silSet(m, opt.given); S[v] = sil(nm, v); hullBad = !hullOK(S.front, S.top, S.side); }
      cand.push({ m: nm, score: (hullBad ? 2 : 0) + (diffSil ? 1 : 0), hullBad, diffSil });
    };
    ['x', 'y', 'z'].forEach(a => consider(mirror(m, a)));
    for (let t = 0; t < 500 && cand.length < 60; t++) consider(t % 2 ? mutateView(m, v, R) : mutate(m, R, 1 + Math.floor(t / 80)));
    const sorted = shuffle(R, cand).sort((a, b) => b.score - a.score).slice(0, 3);
    const all = shuffle(R, [{ m, ok: true }].concat(sorted.map(c => ({ m: c.m, ok: false, hullBad: c.hullBad, diffSil: c.diffSil }))));
    return { items: all, correct: all.findIndex(x => x.ok), weak: opt.given ? sorted.filter(c => !c.hullBad).length : sorted.filter(c => !c.diffSil).length, n: sorted.length };
  }
  function sectionChoices(m, cy, R) {
    const base = sectionKey(sectionData(m, cy)), seen = new Set([base]), cand = [];
    const consider = (nm, c) => { const s = sectionData(nm, c); if (!s.hatch.length) return; const k = sectionKey(s); if (seen.has(k)) return; seen.add(k); cand.push({ m: nm, cy: c }); };
    for (let c = 0; c < m.ny; c++) if (c !== cy) consider(m, c);
    ['x', 'z'].forEach(a => consider(mirror(m, a), cy));
    for (let t = 0; t < 300 && cand.length < 40; t++) consider(mutate(m, R, 1 + Math.floor(t / 80)), cy);
    const sorted = shuffle(R, cand).slice(0, 3), all = shuffle(R, [{ m, cy, ok: true }].concat(sorted.map(c => ({ m: c.m, cy: c.cy, ok: false }))));
    return { items: all, correct: all.findIndex(x => x.ok), n: sorted.length };
  }

  /* ---------- Maßstab ---------- */
  const SCALES = { 1: [[1, 2], [2, 1]], 2: [[1, 2], [1, 5], [2, 1], [5, 1]], 3: [[1, 2], [1, 5], [2, 1], [5, 1], [10, 1]] };
  const scaleLabel = s => s[0] + ':' + s[1];
  /* Maßstab a:b = Zeichnung : Natur */
  function genScale(R, level, scale) {
    const sc = scale || pick(R, SCALES[level] || SCALES[2]), a = sc[0], b = sc[1]; let nat, zei;
    if (a >= b) { nat = ri(R, 2, a >= 10 ? 12 : 24); if (level >= 3 && a < 10 && R() < .4) nat += 0.5; zei = rnd6(nat * a / b); }
    else { zei = ri(R, 4, 60); nat = rnd6(zei * b / a); }
    return { scale: sc, label: scaleLabel(sc), nat, zei };
  }
  const natToZei = (nat, sc) => rnd6(nat * sc[0] / sc[1]);
  const zeiToNat = (zei, sc) => rnd6(zei * sc[1] / sc[0]);

  /* ---------- SVG ---------- */
  let uid = 0;
  const n1 = v => +(+v).toFixed(1);
  const svgOpen = (W, H, label, extra) => `<svg class="zsvg" viewBox="0 0 ${n1(W)} ${n1(H)}" style="width:100%;max-width:${Math.round(W)}px;height:auto;display:block;margin:0 auto" role="img" aria-label="${label}"${extra || ''}>`;
  const ln = (c, x1, y1, x2, y2) => `<line class="${c}" x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}"/>`;
  const arrow = (x, y, dir) => { const d = dir * 8; return `<polygon class="za" points="${n1(x)},${n1(y)} ${n1(x + d)},${n1(y - 2.6)} ${n1(x + d)},${n1(y + 2.6)}"/>`; };
  const arrowV = (x, y, dir) => { const d = dir * 8; return `<polygon class="za" points="${n1(x)},${n1(y)} ${n1(x - 2.6)},${n1(y + d)} ${n1(x + 2.6)},${n1(y + d)}"/>`; };
  /* Maßeintragung: Maßhilfslinien, Maßlinie mit Pfeilen, Maßzahl (waagerecht: über der Linie; senkrecht: links, von rechts lesbar) */
  function dimH(x1, x2, yl, yr, txt) {
    const dir = yl < yr ? -1 : 1; let s = ln('zd', x1, yr + dir * 3, x1, yl + dir * 4) + ln('zd', x2, yr + dir * 3, x2, yl + dir * 4) + ln('zd', x1, yl, x2, yl) + arrow(x1, yl, 1) + arrow(x2, yl, -1);
    return s + `<text class="zt" x="${n1((x1 + x2) / 2)}" y="${n1(yl - 4)}" text-anchor="middle">${txt}</text>`;
  }
  function dimV(y1, y2, xl, xr, txt) {
    const dir = xl < xr ? -1 : 1; let s = ln('zd', xr + dir * 3, y1, xl + dir * 4, y1) + ln('zd', xr + dir * 3, y2, xl + dir * 4, y2) + ln('zd', xl, y1, xl, y2) + arrowV(xl, y1, 1) + arrowV(xl, y2, -1);
    const tx = xl - 4, ty = (y1 + y2) / 2;
    return s + `<text class="zt" x="${n1(tx)}" y="${n1(ty)}" text-anchor="middle" transform="rotate(-90 ${n1(tx)} ${n1(ty)})">${txt}</text>`;
  }
  function viewG(m, v, b, o) {
    const L = lines(m, v), s = b.w / b.W, X = a => b.x + a * s, Y = q => b.y + (b.H - q) * s; let g = '';
    if (o.hid !== false) L.hid.forEach(l => { g += ln('zh', X(l[0]), Y(l[1]), X(l[2]), Y(l[3])); });
    if (o.ctr !== false) centerLines(m, v).forEach(l => { g += ln('zc', X(l[0]), Y(l[1]), X(l[2]), Y(l[3])); });
    L.vis.forEach(l => { g += ln('zv', X(l[0]), Y(l[1]), X(l[2]), Y(l[3])); });
    return g;
  }
  const VLAB = { front: ['Vorderansicht'], top: ['Draufsicht'], side: ['Seitenansicht', 'von links'] };
  const lab = (b, v) => VLAB[v].map((t, i) => `<text class="zn" x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h + 14 + i * 12)}" text-anchor="middle">${t}</text>`).join('');
  function viewsSvg(m, o) {
    o = o || {}; const dim = !!o.dim, show = o.show || VIEWS, maxW = o.w || 340, padL = dim ? 46 : 16, padT = dim ? 30 : 16;
    const s = o.s || Math.max(14, Math.min(o.smax || 40, Math.floor((maxW - padL - 16 - 34) / (m.nx + m.ny)))), L = layout(m, s, { padL, padT }); let g = '';
    VIEWS.forEach(v => { const b = L[v];
      if (show.indexOf(v) < 0) g += `<rect class="zq" x="${n1(b.x)}" y="${n1(b.y)}" width="${n1(b.w)}" height="${n1(b.h)}"/><text class="zqt" x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h / 2 + 8)}" text-anchor="middle">?</text>`;
      else g += viewG(m, v, b, o);
      g += lab(b, v); });
    if (dim) {
      const F = L.front, T = L.top, u = m.u;
      g += dimH(F.x, F.x + F.w, F.y - 16, F.y, fmtDe(m.nx * u)) + dimV(F.y, F.y + F.h, F.x - 16, F.x, fmtDe(m.nz * u)) + dimV(T.y, T.y + T.h, T.x - 16, T.x, fmtDe(m.ny * u));
    }
    return svgOpen(L.W, L.H, 'Ansichten nach Projektionsmethode 1: Vorderansicht, Draufsicht unten, Seitenansicht rechts') + g + '</svg>';
  }
  function viewSvg(m, v, o) {
    o = o || {}; const maxW = o.w || 200, dd = dimsOf(m, v), s = o.s || Math.max(14, Math.min(o.smax || 40, Math.floor((maxW - 32) / dd[0]))), padB = o.name === false ? 14 : 30;
    const b = { x: 16, y: 16, w: dd[0] * s, h: dd[1] * s, W: dd[0], H: dd[1] };
    return svgOpen(b.w + 32, b.h + 16 + padB, VN[v]) + viewG(m, v, b, o) + (o.name === false ? '' : lab(b, v)) + '</svg>';
  }
  function hatchDefs(id) { return `<defs><pattern id="${id}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="zhat" x1="0" y1="0" x2="0" y2="7"/></pattern></defs>`; }
  function sectionSvg(m, cy, o) {
    o = o || {}; const sd = sectionData(m, cy), maxW = o.w || 200, s = o.s || Math.max(14, Math.min(o.smax || 40, Math.floor((maxW - 32) / m.nx))), id = 'zh' + (++uid);
    const b = { x: 16, y: 26, w: m.nx * s, h: m.nz * s, W: m.nx, H: m.nz }, X = a => b.x + a * s, Y = q => b.y + (b.H - q) * s; let g = hatchDefs(id);
    sd.hatch.forEach(p => { g += `<rect x="${n1(X(p[0]))}" y="${n1(Y(p[1] + 1))}" width="${n1(s)}" height="${n1(s)}" fill="url(#${id})"/>`; });
    const L = toLines(sd); L.vis.forEach(l => { g += ln('zv', X(l[0]), Y(l[1]), X(l[2]), Y(l[3])); });
    g += `<text class="zn" x="${n1(b.x)}" y="16" font-weight="700">Schnitt A–A</text>`;
    return svgOpen(b.w + 32, b.h + 26 + 16, 'Schnitt A–A mit Schraffur') + g + '</svg>';
  }
  /* Draufsicht mit Schnittverlauf A–A: Strich-Punkt-Linie, an den Enden breit, Pfeile zeigen die Blickrichtung (nach hinten = in der Draufsicht nach oben) */
  function topcutSvg(m, cy, o) {
    o = o || {}; const maxW = o.w || 220, s = o.s || Math.max(14, Math.min(o.smax || 40, Math.floor((maxW - 60) / m.nx))), b = { x: 30, y: 34, w: m.nx * s, h: m.ny * s, W: m.nx, H: m.ny };
    const y = b.y + (b.H - (cy + .5)) * s, x1 = b.x - .45 * s, x2 = b.x + b.w + .45 * s; let g = viewG(m, 'top', b, o);
    g += ln('zs', x1, y, x2, y) + ln('zsb', x1, y, x1 + .3 * s, y) + ln('zsb', x2 - .3 * s, y, x2, y);
    [x1, x2].forEach(x => { g += ln('zd2', x, y, x, y - .5 * s) + arrowV(x, y - .5 * s - 1, 1) + `<text class="zn" x="${n1(x)}" y="${n1(y - .5 * s - 7)}" text-anchor="middle" font-weight="700">A</text>`; });
    g += `<text class="zn" x="${n1(b.x + b.w / 2)}" y="${n1(b.y + b.h + 20)}" text-anchor="middle">Draufsicht mit Schnittverlauf</text>`;
    return svgOpen(b.w + 60, b.h + 34 + 30, 'Draufsicht mit Schnittverlauf A–A') + g + '</svg>';
  }
  /* Isometrie (Blick von vorn rechts oben, r = 0..3 dreht den Körper um 90° um die Hochachse) */
  function isoSvg(m0, r, o) {
    o = o || {}; r = ((r || 0) % 4 + 4) % 4; const m = rotate(m0, r), C = 0.8660254, pr = (x, y, z) => [(x + y) * C, -(z + (y - x) * 0.5)];
    const cells = []; for (let z = 0; z < m.nz; z++) for (let y = 0; y < m.ny; y++) for (let x = 0; x < m.nx; x++) if (get(m, x, y, z)) cells.push([x, y, z]);
    cells.sort((p, q) => (p[0] - p[1] + p[2]) - (q[0] - q[1] + q[2]) || p[2] - q[2] || p[1] - q[1]);
    const exX = (m.nx + m.ny) * C, exY = m.nz + (m.nx + m.ny) * 0.5, pad = 14, maxW = o.w || 300, s = o.s || Math.min(o.smax || 38, (maxW - 2 * pad) / exX, 240 / exY);
    const ox = pad, oy = pad + (m.nz + m.ny * 0.5) * s, T = p => { const q = pr(p[0], p[1], p[2]); return [ox + q[0] * s, oy + q[1] * s]; };
    const cont = (x, y, z, d, n) => get(m, x + d[0], y + d[1], z + d[2]) && !get(m, x + d[0] + n[0], y + d[1] + n[1], z + d[2] + n[2]);
    let g = '';
    const face = (cls, pts, nrm, x, y, z, ds) => {
      g += `<polygon class="${cls}" points="${pts.map(p => T(p).map(n1).join(',')).join(' ')}"/>`;
      for (let i = 0; i < 4; i++) if (!cont(x, y, z, ds[i], nrm)) { const a = T(pts[i]), b = T(pts[(i + 1) % 4]); g += ln('zk', a[0], a[1], b[0], b[1]); }
    };
    cells.forEach(c => { const x = c[0], y = c[1], z = c[2];
      if (!get(m, x, y, z + 1)) face('zft', [[x, y, z + 1], [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1]], [0, 0, 1], x, y, z, [[0, -1, 0], [1, 0, 0], [0, 1, 0], [-1, 0, 0]]);
      if (!get(m, x, y - 1, z)) face('zfl', [[x, y, z], [x + 1, y, z], [x + 1, y, z + 1], [x, y, z + 1]], [0, -1, 0], x, y, z, [[0, 0, -1], [1, 0, 0], [0, 0, 1], [-1, 0, 0]]);
      if (!get(m, x + 1, y, z)) face('zfr', [[x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1]], [1, 0, 0], x, y, z, [[0, 0, -1], [0, 1, 0], [0, 0, 1], [0, -1, 0]]);
    });
    const W = exX * s + 2 * pad, H = exY * s + 2 * pad + 14;
    g += `<text class="zn" x="8" y="${n1(H - 6)}">Vorderseite zeigt nach ${['↙', '↘', '↗', '↖'][r]}</text>`;
    return svgOpen(W, H, 'Isometrische Darstellung des Körpers') + g + '</svg>';
  }
  const LSTY = { breit: [3.2, ''], schmal: [1.2, ''], strich: [1.5, '9 5'], sp: [1.2, '18 4 3 4'], spb: [3.2, '18 4 3 4'], zwei: [1.2, '18 4 3 4 3 4'] };
  function lineSample(id, o) {
    o = o || {}; const w = o.w || 170; let g;
    if (id === 'frei') g = '<path d="M4 9 q10 -9 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
    else { const st = LSTY[id] || LSTY.breit; g = `<line x1="4" y1="9" x2="${w - 4}" y2="9" stroke="currentColor" stroke-width="${st[0]}"${st[1] ? ` stroke-dasharray="${st[1]}"` : ''}/>`; }
    return `<svg width="${w}" height="18" viewBox="0 0 ${w} 18" role="img" aria-label="Linienbeispiel" style="max-width:100%">${g}</svg>`;
  }
  /* Raster zum Eintragen von Kanten: Tippen wechselt leer, Volllinie, Strichlinie */
  function rasterSvg(W, H, grid, o) {
    o = o || {}; const s = o.s || Math.max(28, Math.min(56, Math.floor(((o.w || 300) - 40) / W))), p = 20, X = a => p + a * s, Y = q => p + (H - q) * s; let g = '', hit = '';
    for (let a = 0; a <= W; a++) for (let b = 0; b <= H; b++) g += `<circle class="zdot" cx="${X(a)}" cy="${Y(b)}" r="2.2"/>`;
    for (let a = 0; a < W; a++) for (let bl = 0; bl <= H; bl++) { const c = grid.h[a][bl]; if (c) g += ln(c === 1 ? 'zv' : 'zh', X(a), Y(bl), X(a + 1), Y(bl)); hit += `<line class="zhit" data-s="h-${a}-${bl}" x1="${X(a) + 8}" y1="${Y(bl)}" x2="${X(a + 1) - 8}" y2="${Y(bl)}"/>`; }
    for (let a = 0; a <= W; a++) for (let b = 0; b < H; b++) { const c = grid.v[a][b]; if (c) g += ln(c === 1 ? 'zv' : 'zh', X(a), Y(b), X(a), Y(b + 1)); hit += `<line class="zhit" data-s="v-${a}-${b}" x1="${X(a)}" y1="${Y(b) - 8}" x2="${X(a)}" y2="${Y(b + 1) + 8}"/>`; }
    return svgOpen(W * s + 2 * p, H * s + 2 * p, 'Raster zum Eintragen der Kanten') + g + hit + '</svg>';
  }
  function fig(f, o) {
    o = o || {}; const M = f.m;
    switch (f.k) {
      case 'iso': return isoSvg(M, f.r || 0, o);
      case 'views': return viewsSvg(M, Object.assign({}, o, f));
      case 'view': return viewSvg(M, f.v, Object.assign({}, o, f));
      case 'section': return sectionSvg(M, f.cy, o);
      case 'topcut': return topcutSvg(M, f.cy, o);
      case 'line': return lineSample(f.id, o);
      default: return '';
    }
  }

  /* ---------- Raster prüfen: sagt nur, WAS falsch ist ---------- */
  function checkGrid(ans, sol) {
    const c = { miss1: 0, miss2: 0, extra: 0, toDash: 0, toSolid: 0, ok: 0, total: 0 };
    const cmp = (u, a) => { if (!u && !a) return; c.total++; if (u === a) c.ok++; else if (!u) c[a === 1 ? 'miss1' : 'miss2']++; else if (!a) c.extra++; else if (a === 2) c.toDash++; else c.toSolid++; };
    sol.h.forEach((r, a) => r.forEach((s, b) => cmp(ans.h[a][b], s))); sol.v.forEach((r, a) => r.forEach((s, b) => cmp(ans.v[a][b], s)));
    const msgs = [], pl = (n, e, m) => (n === 1 ? e : m);
    if (c.miss1) msgs.push(`${c.miss1} sichtbare${pl(c.miss1, 's Kantenstück fehlt', ' Kantenstücke fehlen')} noch (Volllinie).`);
    if (c.miss2) msgs.push(`${c.miss2} verdeckte${pl(c.miss2, 's Kantenstück fehlt', ' Kantenstücke fehlen')} noch (Strichlinie).`);
    if (c.extra) msgs.push(`${c.extra} ${pl(c.extra, 'Kantenstück ist', 'Kantenstücke sind')} zu viel: dort ist keine Kante.`);
    if (c.toDash) msgs.push(`${c.toDash} Volllinien-${pl(c.toDash, 'Stück müsste', 'Stücke müssten')} eine Strichlinie sein (verdeckte Kante).`);
    if (c.toSolid) msgs.push(`${c.toSolid} Strichlinien-${pl(c.toSolid, 'Stück müsste', 'Stücke müssten')} eine Volllinie sein (sichtbare Kante).`);
    return { ok: !msgs.length, msgs, c };
  }

  /* ---------- Aufgaben erzeugen ---------- */
  const LET = 'ABCD';
  function pickModel(spec, R) { const mm = spec.model; if (mm === 'rand') return genBody(R, spec.level || 3); return modelByName(Array.isArray(mm) ? pick(R, mm) : mm); }
  function build(spec, seed) {
    const D = root.ZEI_DATA, R = rng(spec.id + '|' + seed), inst = { id: spec.id, seed, kind: spec.kind, type: 'choice', prompt: spec.text || '', figs: [], choices: [], correct: 0, expl: spec.expl || '', sol: '' };
    const choose = (items, mkChoice) => { inst.choices = items.items.map(mkChoice); inst.correct = items.correct; };
    switch (spec.kind) {
      case 'know': { const all = shuffle(R, [spec.right].concat(spec.wrong)); inst.choices = all.map(t => ({ t })); inst.correct = all.indexOf(spec.right); inst.prompt = spec.q; break; }
      case 'iso2view': { let m, ch; for (let t = 0; t < 40; t++) { m = pickModel(spec, R); ch = viewChoices(m, spec.view, R); if (!ch.weak && ch.n === 3) break; } inst.model = m; inst.figs = [{ k: 'iso', m, r: 0 }]; choose(ch, it => ({ f: { k: 'view', m: it.m, v: spec.view, name: false } })); inst.weak = ch.weak; break; }
      case 'view3': { let m, ch; for (let t = 0; t < 60; t++) { m = pickModel(spec, R); ch = viewChoices(m, spec.target, R, { given: spec.given.reduce((o, v) => { o[v] = sil(m, v); return o; }, {}) }); if (!ch.weak && ch.n === 3) break; } inst.model = m; inst.figs = [{ k: 'views', m, show: spec.given }]; choose(ch, it => ({ f: { k: 'view', m: it.m, v: spec.target, name: false } })); inst.weak = ch.weak; break; }
      case 'edges': { const m = pickModel(spec, R), g = edgeGrid(m, spec.target); inst.type = 'edges'; inst.model = m; inst.target = spec.target; inst.W = g.W; inst.H = g.H; inst.solution = g; inst.figs = [{ k: 'iso', m, r: 0 }].concat(spec.given.map(v => ({ k: 'view', m, v }))); inst.sol = 'Die gesuchte Ansicht ist die ' + VN[spec.target] + ' des gezeigten Körpers.'; break; }
      case 'schnitt': { const m = pickModel(spec, R), cy = spec.cy == null ? 1 : Math.min(spec.cy, m.ny - 1), ch = sectionChoices(m, cy, R); inst.model = m; inst.cy = cy; inst.figs = [{ k: 'topcut', m, cy }, { k: 'iso', m, r: 0 }]; choose(ch, it => ({ f: { k: 'section', m: it.m, cy: it.cy } })); inst.weak = 3 - ch.n; break; }
      case 'use2line': { const ids = spec.pool || [spec.line], id = pick(R, ids), L = D.lines.find(l => l.id === id), others = shuffle(R, D.lines.filter(l => l.id !== id)).slice(0, 3), all = shuffle(R, [L].concat(others));
        inst.prompt = 'Welche Linienart wird verwendet für: ' + L.use + '?'; inst.choices = all.map(l => ({ f: { k: 'line', id: l.id }, t: l.name })); inst.correct = all.indexOf(L); inst.expl = L.name + ' (' + L.nr + '): ' + L.use + '.'; break; }
      case 'line2use': { const ids = spec.pool || [spec.line], id = pick(R, ids), L = D.lines.find(l => l.id === id), others = shuffle(R, D.lines.filter(l => l.id !== id)).slice(0, 3), all = shuffle(R, [L].concat(others));
        inst.prompt = 'Wofür wird diese Linienart verwendet?'; inst.figs = [{ k: 'line', id: L.id }]; inst.choices = all.map(l => ({ t: l.use })); inst.correct = all.indexOf(L); inst.expl = L.name + ' (' + L.nr + '): ' + L.use + '.'; break; }
      case 'rule': { const idx = pick(R, spec.pool || [spec.rule]), r = D.rules[idx], all = shuffle(R, [r.right].concat(r.wrong)); inst.prompt = r.q; inst.choices = all.map(t => ({ t })); inst.correct = all.indexOf(r.right); inst.expl = r.expl; break; }
      case 'scale': { const g = genScale(R, spec.level, spec.scale), toZ = spec.dir === 'z' || (spec.dir == null && R() < .5); inst.type = 'num'; inst.unit = 'mm'; inst.tol = 0.001; inst.scale = g;
        if (toZ) { inst.prompt = `Maßstab M ${g.label}. Ein Bauteil ist in Wirklichkeit ${fmtDe(g.nat)} mm lang. Wie lang zeichnest du es (Zeichnungsmaß)?`; inst.value = g.zei; inst.label = 'Zeichnungsmaß'; inst.expl = `Zeichnung = Natur × ${g.scale[0]}/${g.scale[1]}: ${fmtDe(g.nat)} mm × ${g.scale[0]}/${g.scale[1]} = ${fmtDe(g.zei)} mm.`; }
        else { inst.prompt = `Maßstab M ${g.label}. Eine Strecke misst in der Zeichnung ${fmtDe(g.zei)} mm. Wie groß ist sie in Wirklichkeit (Naturmaß)?`; inst.value = g.nat; inst.label = 'Naturmaß'; inst.expl = `Natur = Zeichnung × ${g.scale[1]}/${g.scale[0]}: ${fmtDe(g.zei)} mm × ${g.scale[1]}/${g.scale[0]} = ${fmtDe(g.nat)} mm.`; }
        inst.sol = fmtDe(inst.value) + ' mm'; break; }
      case 'scaleq': { const g = genScale(R, spec.level || 2); const four = [g.scale].concat(shuffle(R, SCALES[3].filter(s => scaleLabel(s) !== g.label)).slice(0, 3)), opts = shuffle(R, four);
        inst.prompt = `Ein Bauteil ist in Wirklichkeit ${fmtDe(g.nat)} mm lang. In der Zeichnung misst die Strecke ${fmtDe(g.zei)} mm. Welcher Maßstab wurde verwendet?`; inst.choices = opts.map(s => ({ t: 'M ' + scaleLabel(s) })); inst.correct = opts.findIndex(s => scaleLabel(s) === g.label);
        inst.expl = `Maßstab = Zeichnungsmaß : Naturmaß = ${fmtDe(g.zei)} : ${fmtDe(g.nat)} = ${g.label}.`; break; }
      default: throw new Error('Aufgabenart unbekannt: ' + spec.kind);
    }
    if (inst.type === 'choice') { const c = inst.choices[inst.correct]; inst.sol = 'Antwort ' + LET[inst.correct] + (c.t ? ': ' + c.t : ''); }
    return inst;
  }

  root.ZEI_CORE = { VN, VIEWS, rng, hashStr, ri, pick, shuffle, fmtDe, parseDe, mk, get, put, fromLayers, count, clone, rotate, mirror, modelByName, connected,
    dimsOf, edgeGrid, emptyGrid, gridKey, sig, sil, silKey, fullBox, lines, toLines, centerLines, layout, isoVisibleAll, hullOK, sectionData, sectionKey,
    mutate, genBody, viewChoices, sectionChoices, genScale, natToZei, zeiToNat, scaleLabel, SCALES, checkGrid, build,
    svg: { iso: isoSvg, views: viewsSvg, view: viewSvg, section: sectionSvg, topcut: topcutSvg, line: lineSample, raster: rasterSvg, fig, dimH, dimV } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZEI_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
