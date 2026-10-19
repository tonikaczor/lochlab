'use strict';
/* Tonfunk Leiterplatten-Lab: Prüfverfahren und Fertigungslinie (View-Id 'test').
   Teil A (Logik, ohne DOM, auch mit Node ladbar): window.PCB_TEST / module.exports
     PCB_TEST.planFlyingProbe(board, opts) -> { steps, timeS, coverage, issues, nodes, stats, cost, ... }
     PCB_TEST.dft(board, opts)             -> { issues, summary, coverage }
     PCB_TEST.inspect(board, faulty, opts) -> { steps, faults, found, missed, pass, escape, ... }
     PCB_TEST.breakEven(params)            -> { qty, curve, ... }
     PCB_TEST.inject(board, kind, seed)    -> { board, faults, info }   (eigene einfache Fehlerinjektion, nutzt PCB_REPAIR.inject falls vorhanden)
     PCB_TEST.compare(board, opts)         -> { fp, ict, breakEven }
   Alle Zeit- und Kostenwerte sind ein Modell mit Beispielwerten (optionen opts.*), kein Maschinendatenblatt.
   Teil B (Oberfläche) registriert PCB_VIEWS 'test' mit den Reitern Linie, Flying Probe, Verfahren, Simulator, Glossar. */
(function (root) {
  /* ====================================================================================
     TEIL A: LOGIK (ohne DOM)
     ==================================================================================== */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fm = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  function hash(seed, str) {
    let h = (2166136261 ^ (seed | 0)) >>> 0; str = String(str);
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }
  let coreCache = null;
  function core() {
    const c = root.PCB_CORE || (typeof globalThis !== 'undefined' ? globalThis.PCB_CORE : null);
    if (c) return c;
    if (!coreCache && typeof require === 'function') { try { coreCache = require('./pcbcore.js'); } catch (e) { coreCache = null; } }
    return coreCache;
  }
  const clone = o => JSON.parse(JSON.stringify(o));

  /* ---------- Werte lesen und schreiben ---------- */
  const MULT = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1 };
  function parseVal(v) {
    if (v == null) return null; if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).replace(/\s+/g, '').replace(/[Ωω]|ohm/gi, '').replace(/[FfHh]$/, '').replace(',', '.');
    if (!s) return null;
    let m = /^(\d+)([pnuµmkKMGR])(\d+)$/.exec(s);
    if (m) return parseFloat(m[1] + '.' + m[3]) * MULT[m[2]];
    m = /^(\d*\.?\d+)([pnuµmkKMGR])?$/.exec(s);
    if (m) return parseFloat(m[1]) * (m[2] ? MULT[m[2]] : 1);
    m = /^R(\d+)$/i.exec(s); if (m) return parseFloat('0.' + m[1]);
    return null;
  }
  function fmtOhm(r) {
    if (r == null || !isFinite(r)) return 'offen (> 10 MΩ)';
    const a = Math.abs(r);
    if (a < 1) return fm(r * 1000, a < 0.1 ? 1 : 0) + ' mΩ';
    if (a < 1000) return fm(r, a < 10 ? 2 : 1) + ' Ω';
    if (a < 1e6) return fm(r / 1000, a < 1e4 ? 2 : 1) + ' kΩ';
    return fm(r / 1e6, 2) + ' MΩ';
  }
  function fmtCap(c) {
    if (c == null || !isFinite(c)) return '?';
    if (c < 1e-9) return fm(c * 1e12, c < 1e-11 ? 1 : 0) + ' pF';
    if (c < 1e-6) return fm(c * 1e9, c < 1e-8 ? 2 : 1) + ' nF';
    if (c < 1e-3) return fm(c * 1e6, c < 1e-5 ? 2 : 1) + ' µF';
    return fm(c * 1e3, 2) + ' mF';
  }
  const fmtV = v => fm(v, 2) + ' V';
  const fmtMm = v => fm(v, 2) + ' mm';
  const fmtTime = s => s < 90 ? fm(s, 1) + ' s' : s < 5400 ? fm(s / 60, 1) + ' min' : fm(s / 3600, 2) + ' h';
  const fmtEur = e => (e < 10 ? fm(e, 2) : e < 1000 ? fm(e, 1) : String(Math.round(e)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + ' €';

  /* ---------- Einstellungen ---------- */
  const MODES = {
    fp: { minPad: 0.25, minPitch: 0.5, side: 'top', tallH: 5, tallDist: 2, probes: 2, speed: 100, nearDist: 1.5, tpDia: 0.6 },
    ict: { minPad: 0.8, minPitch: 1.27, side: 'bot', tallH: 5, tallDist: 3, probes: 2, speed: 100, nearDist: 1.5, tpDia: 1.0 }
  };
  const BASE = {
    touchS: 0.04, moveOverheadS: 0.02, loadS: 6, rate: 60, polarCapTest: false, viaTest: true,
    meas: { cont: 0.03, iso: 0.05, res: 0.08, cap: 0.2, ind: 0.08, diode: 0.06, led: 0.06, fuse: 0.04, pin: 0.04 },
    extraTP: [], seed: 1, kelvinBelow: 10
  };
  function mergeOpts(opts) {
    const mode = opts && opts.mode === 'ict' ? 'ict' : 'fp';
    const o = Object.assign({}, BASE, MODES[mode], opts || {}, { mode });
    o.meas = Object.assign({}, BASE.meas, (opts && opts.meas) || {});
    o.side = o.side === 'bot' || o.side === 'both' ? o.side : 'top';
    o.probes = clamp(Math.round(+o.probes || 2), 2, 8); o.speed = Math.max(5, +o.speed || 100);
    if (!Array.isArray(o.extraTP)) o.extraTP = [];
    return o;
  }

  /* ---------- Bauteilarten ---------- */
  function kindOf(part, fp) {
    const ref = String(part.ref || ''), L = ref.replace(/[0-9]/g, '').toUpperCase(), id = String(part.fp || '').toUpperCase(), val = String(part.value || '');
    if (/^(TP|MP)/.test(L) || /^TP|TESTPOINT/.test(id)) return 'tp';
    if (L === 'FID') return 'fid';
    if (L === 'R') return 'res';
    if (L === 'RV' || L === 'VR' || L === 'RP' || L === 'RN') return 'other';
    if (L === 'C') return /RADIAL|ELKO|TANT|CP_/.test(id) && /^[0-9.,]+\s*[uµ]/i.test(val) ? 'cap_pol' : 'cap';
    if (L === 'L') return 'ind';
    if (L === 'LED' || /LED/.test(id) || (L === 'D' && /LED/i.test(val))) return 'led';
    if (L === 'D' || L === 'ZD') return 'diode';
    if (L === 'F') return 'fuse';
    if (L === 'Q' || L === 'T') return 'trans';
    if (L === 'U' || L === 'IC') return 'ic';
    if (/^(J|X|P|CN|H|JP|K)$/.test(L) || (fp && /HDR|JACK/.test(id))) return 'conn';
    if (L === 'SW' || L === 'S') return 'switch';
    return 'other';
  }
  const TWOPIN = { res: 1, cap: 1, cap_pol: 1, ind: 1, led: 1, diode: 1, fuse: 1 };
  const isIcLike = k => k === 'ic' || k === 'trans';

  /* ---------- Geometrie ---------- */
  const distRect = (x, y, c) => Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.y0 - y, 0, y - c.y1));
  const insideRect = (x, y, c, m) => x >= c.x0 - (m || 0) && x <= c.x1 + (m || 0) && y >= c.y0 - (m || 0) && y <= c.y1 + (m || 0);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const nodeName = n => (n.kind === 'via' ? 'Via ' + n.n : n.extra ? n.ref : n.ref + '.' + n.n);
  const sideName = s => (s === 'bot' ? 'Unterseite' : 'Oberseite');

  /* ---------- Analyse: Knoten (Pads, Vias, Testpunkte) mit Erreichbarkeit ---------- */
  function analyze(board, opts) {
    const C = core(); if (!C) throw new Error('PCB_CORE fehlt');
    const o = mergeOpts(opts), sides = o.side === 'both' ? ['top', 'bot'] : [o.side];
    const parts = board.parts || [], geo = {}, partOf = {};
    parts.forEach(p => {
      partOf[p.ref] = p;
      let g = null; try { g = C.partGeometry(board, p); } catch (e) { g = null; }
      if (g && g.fp) geo[p.ref] = { cy: g.courtyard, h: +g.fp.bodyH || 0, side: g.side, tht: g.fp.kind === 'tht', fp: g.fp, kind: kindOf(p, g.fp) };
      else geo[p.ref] = null;
    });
    const talls = Object.keys(geo).filter(r => geo[r] && geo[r].h >= o.tallH && geo[r].kind !== 'tp');
    function blocked(x, y, ownRef, s) {
      for (const r in geo) {
        const g = geo[r]; if (!g || r === ownRef || g.side !== s || g.kind === 'tp') continue;
        if (insideRect(x, y, g.cy, 0)) return 'liegt unter dem Bauteil ' + r;
      }
      for (const r of talls) {
        const g = geo[r]; if (r === ownRef || g.side !== s) continue;
        const d = distRect(x, y, g.cy); if (d < o.tallDist) return 'zu nah am hohen Bauteil ' + r + ' (' + fm(g.h, 0) + ' mm hoch, Abstand ' + fm(d, 1) + ' mm)';
      }
      return '';
    }
    const nodes = [];
    function finishNode(n, minDim) {
      n.access = { top: false, bot: false }; n.why = { top: '', bot: '' };
      ['top', 'bot'].forEach(s => {
        const L = s === 'top' ? 'F.Cu' : 'B.Cu';
        if (n.layers.indexOf(L) < 0) { n.why[s] = 'liegt auf der anderen Seite'; return; }
        if (n.kind === 'pad' && n.tht && n.partSide === s) { n.why[s] = 'liegt unter dem Bauteilkörper (THT-Anschluss, Lötseite ist die andere Seite)'; return; }
        if (minDim < o.minPad - 1e-9) { n.why[s] = 'ist mit ' + fm(minDim, 2) + ' mm zu klein (mindestens ' + fm(o.minPad, 2) + ' mm)'; n.small = true; return; }
        if (n.kind !== 'tp' || !n.extra) { const b = blocked(n.x, n.y, n.ref, s); if (b) { n.why[s] = b; if (/hohen/.test(b)) n.tall = true; else n.under = true; return; } }
        n.access[s] = true;
      });
      n.ok = sides.some(s => n.access[s]); n.useSide = sides.find(s => n.access[s]) || null;
      nodes.push(n);
    }
    let pads = []; try { pads = C.padsOf(board) || []; } catch (e) { pads = []; }
    pads.forEach(p => {
      const g = geo[p.ref], k = g ? g.kind : 'other';
      const w = +p.w || 0, h = +p.h || 0;
      finishNode({ id: 'pad:' + p.ref + '.' + p.n, kind: k === 'tp' ? 'tp' : 'pad', ref: p.ref, n: String(p.n), net: p.net || '', x: p.x, y: p.y, w, h, layers: p.layers || ['F.Cu', 'B.Cu'], tht: p.kind === 'tht' || (g && g.tht), partSide: p.side === 'bot' ? 'bot' : 'top', pk: k }, Math.min(w, h));
    });
    if (o.viaTest) (board.vias || []).forEach(v => {
      if (!v.net) return;
      const L = []; if (!v.from || v.from === 'F.Cu' || v.to === 'F.Cu' || (v.from === 'F.Cu' && v.to === 'B.Cu')) L.push('F.Cu'); if (!v.from || v.from === 'B.Cu' || v.to === 'B.Cu') L.push('B.Cu');
      if (!v.from && !v.to) { L.length = 0; L.push('F.Cu', 'B.Cu'); }
      const d = +v.dia || 0.8;
      const n = { id: 'via:' + v.id, kind: 'via', ref: 'Via', n: String(v.id), net: v.net, x: v.x, y: v.y, w: d, h: d, layers: L, tht: false, partSide: 'top', pk: 'via' };
      if (v.tented) { n.layers = []; }
      finishNode(n, d);
    });
    (o.extraTP || []).forEach((t, i) => {
      if (!t || !t.net) return; const d = +t.dia || o.tpDia, sd = t.side === 'bot' ? ['B.Cu'] : t.side === 'both' ? ['F.Cu', 'B.Cu'] : ['F.Cu'];
      finishNode({ id: 'tp:' + i, kind: 'tp', extra: true, ref: 'TP+' + (i + 1), n: '1', net: t.net, x: t.x, y: t.y, w: d, h: d, layers: sd, tht: false, partSide: 'top', pk: 'tp' }, d);
    });
    /* Netze */
    const nets = {}, netList = [];
    (board.nets || []).forEach(n => { if (!nets[n.name]) { nets[n.name] = { name: n.name, cls: n.cls || 'signal', nodes: [], acc: [], pads: 0 }; netList.push(nets[n.name]); } });
    nodes.forEach(n => {
      if (!n.net) return; let N = nets[n.net]; if (!N) { N = nets[n.net] = { name: n.net, cls: 'signal', nodes: [], acc: [], pads: 0 }; netList.push(N); }
      N.nodes.push(n); if (n.kind === 'pad' || n.kind === 'tp') N.pads++; if (n.ok) N.acc.push(n);
    });
    const netsUsed = netList.filter(N => N.nodes.length > 0);
    /* Bauteile */
    const partInfo = [];
    parts.forEach(p => {
      const g = geo[p.ref]; if (!g) return; const k = g.kind; if (k === 'tp' || k === 'fid') return;
      const pn = nodes.filter(n => n.ref === p.ref && n.kind === 'pad'); const acc = pn.filter(n => n.ok);
      let covered;
      if (TWOPIN[k]) covered = pn.length >= 2 && acc.length === pn.length;
      else covered = pn.length > 0 && acc.length / pn.length >= 0.8;
      partInfo.push({ ref: p.ref, kind: k, fp: p.fp, value: p.value, side: g.side, pads: pn, acc, covered, part: p, h: g.h });
    });
    return { o, sides, nodes, nets: netsUsed, netByName: nets, partInfo, geo, partOf, talls, board };
  }

  /* ---------- Nachbarschaft der Netze (für Isolationsmessungen) ---------- */
  function neighborPairs(board, an, near) {
    const els = [];
    an.nodes.forEach(n => { if (n.net) els.push({ x: n.x, y: n.y, r: Math.max(n.w, n.h) / 2, net: n.net, L: n.layers.length ? n.layers : ['F.Cu', 'B.Cu'] }); });
    (board.tracks || []).forEach(t => {
      if (!t.net || !t.pts) return; const r = (+t.w || 0.25) / 2;
      for (let i = 0; i < t.pts.length - 1; i++) {
        const a = t.pts[i], b = t.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.5));
        for (let k = 0; k <= n; k++) els.push({ x: a[0] + (b[0] - a[0]) * k / n, y: a[1] + (b[1] - a[1]) * k / n, r, net: t.net, L: [t.layer] });
      }
    });
    const cell = 4 + near, grid = new Map(), key = (i, j) => i + ',' + j;
    els.forEach((e, idx) => { const k = key(Math.floor(e.x / cell), Math.floor(e.y / cell)); let a = grid.get(k); if (!a) grid.set(k, a = []); a.push(idx); });
    const pairs = new Map();
    els.forEach((e, idx) => {
      const ci = Math.floor(e.x / cell), cj = Math.floor(e.y / cell);
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
        const a = grid.get(key(ci + di, cj + dj)); if (!a) continue;
        for (const j of a) {
          if (j <= idx) continue; const f = els[j]; if (f.net === e.net) continue;
          if (!e.L.some(l => f.L.indexOf(l) >= 0)) continue;
          const gap = Math.hypot(e.x - f.x, e.y - f.y) - e.r - f.r; if (gap > near) continue;
          const k = e.net < f.net ? e.net + '\u0001' + f.net : f.net + '\u0001' + e.net, old = pairs.get(k);
          if (!old || gap < old.gap) pairs.set(k, { a: e.net < f.net ? e.net : f.net, b: e.net < f.net ? f.net : e.net, gap: Math.max(0, gap), x: (e.x + f.x) / 2, y: (e.y + f.y) / 2 });
        }
      }
    });
    return Array.from(pairs.values()).sort((p, q) => (p.a + p.b < q.a + q.b ? -1 : 1));
  }

  /* ---------- Vorschlag Testpunkt ---------- */
  function suggestTP(board, an, net, side) {
    const o = an.o, N = an.netByName[net]; if (!N) return null;
    const L = side === 'bot' ? 'B.Cu' : 'F.Cu', R = o.tpDia / 2, clr = (board.rules && board.rules.clearance) || 0.2;
    const cand = [];
    (board.tracks || []).forEach(t => {
      if (t.net !== net || t.layer !== L || !t.pts) return;
      for (let i = 0; i < t.pts.length - 1; i++) {
        const a = t.pts[i], b = t.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.5));
        for (let k = 0; k <= n; k++) cand.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, 0]);
      }
    });
    N.nodes.forEach(n => { for (let a = 0; a < 8; a++) for (const rr of [1.2, 2.0, 3.0]) cand.push([n.x + Math.cos(a * Math.PI / 4) * (rr + Math.max(n.w, n.h) / 2), n.y + Math.sin(a * Math.PI / 4) * (rr + Math.max(n.w, n.h) / 2), 1]); });
    const others = [];
    an.nodes.forEach(n => { if (n.net !== net && n.layers.indexOf(L) >= 0) others.push([n.x, n.y, Math.max(n.w, n.h) / 2]); });
    (board.tracks || []).forEach(t => {
      if (t.net === net || t.layer !== L || !t.pts) return;
      for (let i = 0; i < t.pts.length - 1; i++) {
        const a = t.pts[i], b = t.pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(len / 0.5));
        for (let k = 0; k <= n; k++) others.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n, (+t.w || 0.25) / 2]);
      }
    });
    let best = null;
    cand.forEach(c => {
      const x = Math.round(c[0] * 20) / 20, y = Math.round(c[1] * 20) / 20;
      if (x < 1 + R || y < 1 + R || x > board.w - 1 - R || y > board.h - 1 - R) return;
      for (const r in an.geo) {
        const g = an.geo[r]; if (!g || g.side !== side || g.kind === 'tp') continue;
        if (distRect(x, y, g.cy) < R + 0.3) return;
        if (g.h >= o.tallH && distRect(x, y, g.cy) < o.tallDist) return;
      }
      let m = 99;
      for (const q of others) { const d = Math.hypot(x - q[0], y - q[1]) - q[2] - R - clr; if (d < 0.1) return; if (d < m) m = d; }
      for (const e of an.nodes) { if (e.net !== net) { const d = Math.hypot(x - e.x, y - e.y) - Math.max(e.w, e.h) / 2 - R; if (d < o.minPitch / 2) return; } }
      const score = Math.min(m, 3) + (c[2] ? 0 : 0.6);
      if (!best || score > best.score + 1e-9) best = { x, y, side, net, dia: o.tpDia, score, onTrack: !c[2] };
    });
    if (!best) return null; delete best.score; return best;
  }

  /* ---------- DFT-Check ---------- */
  function dftFrom(board, an) {
    const o = an.o, issues = [], seen = {}; let n = 0;
    const add = (type, severity, msg, at, extra) => issues.push(Object.assign({ id: type + '-' + (++n), type, severity, msg, at: at || null }, extra || {}));
    const sideTxt = o.side === 'both' ? 'beiden Seiten' : o.side === 'top' ? 'der Oberseite' : 'der Unterseite';
    const sideForTP = o.side === 'bot' ? 'bot' : 'top';
    an.nets.forEach(N => {
      if (N.acc.length === 0) {
        const reasons = {}; N.nodes.forEach(nd => { const w = nd.why[sideForTP] || (o.side === 'both' ? nd.why.bot : ''); const k = w.replace(/Bauteil \S+|Bauteil [A-Z]+\d+/, 'Bauteil'); reasons[k] = (reasons[k] || 0) + 1; });
        const top = Object.keys(reasons).sort((a, b) => reasons[b] - reasons[a])[0] || '';
        const first = N.nodes[0], sug = suggestTP(board, an, N.name, sideForTP);
        add('notp', 'error', 'Netz ' + N.name + ' hat keinen erreichbaren Testpunkt auf ' + sideTxt + ' (' + N.nodes.length + ' ' + (N.nodes.length === 1 ? 'Anschluss' : 'Anschlüsse') + (top ? ', häufigster Grund: Anschluss ' + top : '') + ').' + (sug ? ' Vorschlag: Testpunkt hinzufügen bei ' + fm(sug.x, 2) + ' / ' + fm(sug.y, 2) + ' mm (' + sideName(sug.side) + ').' : ' Kein freier Platz für einen Testpunkt gefunden: Layout ändern oder Via mit Lötstopp-Öffnung vorsehen.'),
          first ? { x: first.x, y: first.y } : null, { net: N.name, suggest: sug });
      } else if (N.acc.length === 1 && N.nodes.filter(q => q.kind === 'pad' || q.kind === 'tp' || q.kind === 'via').length >= 2) {
        const sug = suggestTP(board, an, N.name, sideForTP);
        add('single', 'warn', 'Netz ' + N.name + ' hat nur einen erreichbaren Testpunkt (' + nodeName(N.acc[0]) + '). Durchgang (Unterbrechung) lässt sich so nicht prüfen, nur Isolation.' + (sug ? ' Vorschlag: zweiten Testpunkt bei ' + fm(sug.x, 2) + ' / ' + fm(sug.y, 2) + ' mm setzen.' : ''), { x: N.acc[0].x, y: N.acc[0].y }, { net: N.name, suggest: sug });
      }
    });
    /* hohe Bauteile */
    const byTall = {};
    an.nodes.forEach(nd => { if (nd.tall && nd.net && nd.kind !== 'tp') { const m = /am hohen Bauteil (\S+)/.exec(nd.why.top + ' ' + nd.why.bot); if (m) (byTall[m[1]] = byTall[m[1]] || []).push(nd); } });
    Object.keys(byTall).sort().forEach(r => {
      const l = byTall[r], g = an.geo[r];
      add('tall', 'warn', l.length + ' Testziel' + (l.length === 1 ? '' : 'e') + ' ' + (l.length === 1 ? 'liegt' : 'liegen') + ' zu nah an ' + r + ' (' + fm(g ? g.h : 0, 0) + ' mm hoch, Sperrzone ' + fm(o.tallDist, 1) + ' mm): ' + l.slice(0, 6).map(q => nodeName(q)).join(', ') + (l.length > 6 ? ' …' : '') + '. Die Nadel kommt schräg nicht heran.', { x: l[0].x, y: l[0].y }, { ref: r });
    });
    const under = an.nodes.filter(nd => nd.under && nd.net && nd.kind !== 'tp' && !(o.side === 'both' ? nd.ok : false));
    if (under.length) add('under', 'warn', under.length + ' Testziel' + (under.length === 1 ? '' : 'e') + ' ' + (under.length === 1 ? 'liegt' : 'liegen') + ' unter einem Bauteil und ' + (under.length === 1 ? 'ist' : 'sind') + ' nicht erreichbar: ' + under.slice(0, 6).map(q => nodeName(q)).join(', ') + (under.length > 6 ? ' …' : '') + '. Testpunkte nie unter Bauteile legen.', { x: under[0].x, y: under[0].y });
    const small = an.nodes.filter(nd => nd.small && nd.net);
    if (small.length) add('small', 'warn', small.length + (small.length === 1 ? ' Anschluss ist' : ' Anschlüsse sind') + ' kleiner als ' + fm(o.minPad, 2) + ' mm und für diese Prüfung zu klein: ' + small.slice(0, 6).map(q => nodeName(q)).join(', ') + (small.length > 6 ? ' …' : '') + '.', { x: small[0].x, y: small[0].y }, { count: small.length });
    /* Testpunkte zu nah */
    const acc = an.nodes.filter(nd => nd.ok && nd.net), close = [];
    for (let i = 0; i < acc.length; i++) for (let j = i + 1; j < acc.length; j++) {
      const a = acc[i], b = acc[j]; if (a.net === b.net) continue; if (a.kind === 'pad' && b.kind === 'pad') continue;
      const d = Math.hypot(a.x - b.x, a.y - b.y); if (d < o.minPitch - 1e-9) close.push({ a, b, d });
    }
    close.slice(0, 8).forEach(c => add('close', 'warn', 'Testpunkte ' + nodeName(c.a) + ' (' + c.a.net + ') und ' + nodeName(c.b) + ' (' + c.b.net + ') liegen nur ' + fm(c.d, 2) + ' mm auseinander (mindestens ' + fm(o.minPitch, 2) + ' mm).', { x: (c.a.x + c.b.x) / 2, y: (c.a.y + c.b.y) / 2 }));
    /* einseitig */
    if (o.side !== 'both') {
      const other = o.side === 'top' ? 'bot' : 'top', only = an.nets.filter(N => N.acc.length === 0 && N.nodes.some(nd => nd.access[other]));
      if (only.length) add('oneside', 'info', only.length + ' Netz' + (only.length === 1 ? ' ist' : 'e sind') + ' nur von der ' + sideName(other) + ' erreichbar: ' + only.slice(0, 8).map(N => N.name).join(', ') + (only.length > 8 ? ' …' : '') + '. Eine Maschine mit Nadeln auf beiden Seiten oder ein zweiter Durchlauf würde das beheben.', null, { nets: only.map(N => N.name) });
    }
    /* Bauteile ohne Messzugang */
    const nm = an.partInfo.filter(p => TWOPIN[p.kind] && !p.covered);
    if (nm.length) add('nopart', 'warn', nm.length + ' Bauteil' + (nm.length === 1 ? '' : 'e') + ' (' + nm.slice(0, 10).map(p => p.ref).join(', ') + (nm.length > 10 ? ' …' : '') + ') ' + (nm.length === 1 ? 'lässt' : 'lassen') + ' sich nicht beidseitig anfahren: Wert und Vorhandensein sind damit nicht prüfbar.', { x: nm[0].pads[0] ? nm[0].pads[0].x : 0, y: nm[0].pads[0] ? nm[0].pads[0].y : 0 }, { refs: nm.map(p => p.ref) });
    if (!issues.length) add('good', 'info', 'Keine Auffälligkeiten: alle Netze sind erreichbar und die Bauteile messbar.', null);
    const rank = { error: 0, warn: 1, info: 2 };
    issues.sort((a, b) => rank[a.severity] - rank[b.severity]);
    return issues;
  }

  /* ---------- Abdeckung ---------- */
  function coverageOf(an) {
    const nets = an.nets, tested = nets.filter(N => N.acc.length >= 1).length;
    const openOk = nets.filter(N => N.acc.length >= 2 || (N.nodes.length === 1 && N.acc.length === 1)).length;
    const parts = an.partInfo, covered = parts.filter(p => p.covered).length;
    const padNodes = an.nodes.filter(n => n.kind === 'pad' && n.net), padAcc = padNodes.filter(n => n.ok).length;
    const pc = (a, b) => (b ? Math.round(1000 * a / b) / 10 : 0);
    const netPct = pc(tested, nets.length), partPct = pc(covered, parts.length), openPct = pc(openOk, nets.length), pinPct = pc(padAcc, padNodes.length);
    return {
      nets: nets.length, netsTested: tested, netsOpenOk: openOk, parts: parts.length, partsCovered: covered, pins: padNodes.length, pinsAccessible: padAcc,
      netPct, openPct, partPct, pinPct, pct: nets.length || parts.length ? Math.round((netPct + openPct + partPct) / 3) : 0
    };
  }

  /* ---------- Messplan ---------- */
  function dtypeOf(kind) { return kind === 'cap_pol' ? 'cap' : kind === 'trans' ? 'pin' : kind; }
  function diodeVf(part, kind) {
    const v = String(part.value || '');
    if (kind === 'led') return /blau|blue|wei(ß|ss)|white/i.test(v) ? 2.7 : /gr[uü]n|green/i.test(v) ? 1.9 : /gelb|yellow|orange/i.test(v) ? 1.85 : 1.75;
    return /BAT|SS\d|SB\d|SCHOTTKY|1N581/i.test(v) ? 0.3 : 0.6;
  }
  function planFlyingProbe(board, opts) {
    const an = analyze(board, opts), o = an.o;
    const raw = [];   // Messschritte ohne Reihenfolge
    const near = neighborPairs(board, an, o.nearDist);
    /* Durchgang */
    an.nets.forEach(N => {
      const L = N.acc.slice(); if (L.length < 2) return;
      L.sort((p, q) => p.x - q.x || p.y - q.y);
      const chain = [L.shift()];
      while (L.length) { const last = chain[chain.length - 1]; let bi = 0, bd = 1e9; L.forEach((q, i) => { const d = dist(last, q); if (d < bd) { bd = d; bi = i; } }); chain.push(L.splice(bi, 1)[0]); }
      for (let i = 0; i < chain.length - 1; i++) raw.push({ type: 'cont', phase: 0, net: N.name, a: chain[i], b: chain[i + 1], label: 'Durchgang ' + N.name });
    });
    /* Isolation gegen Nachbarnetze */
    const compBetween = {};  // Netzpaar -> Bauteile dazwischen
    an.partInfo.forEach(p => { if (!TWOPIN[p.kind] || p.pads.length !== 2) return; const a = p.pads[0].net, b = p.pads[1].net; if (a && b && a !== b) { const k = a < b ? a + '\u0001' + b : b + '\u0001' + a; (compBetween[k] = compBetween[k] || []).push(p); } });
    let isoSkipped = 0, isoUntested = [];
    near.forEach(pr => {
      const A = an.netByName[pr.a], B = an.netByName[pr.b]; if (!A || !B) return;
      if (!A.acc.length || !B.acc.length) { isoUntested.push(pr); return; }
      const key = pr.a + '\u0001' + pr.b, via = compBetween[key] || [];
      if (via.some(p => p.kind === 'ind' || p.kind === 'fuse' || p.kind === 'diode' || p.kind === 'led')) { isoSkipped++; return; }
      let best = null; A.acc.forEach(x => B.acc.forEach(y => { const d = dist(x, y); if (!best || d < best.d) best = { d, x, y }; }));
      let exp = null, expTxt = 'Soll: > 1 MΩ';
      const rs = via.filter(p => p.kind === 'res').map(p => parseVal(p.value)).filter(v => v != null && v > 0);
      if (rs.length) { const g = rs.reduce((s, r) => s + 1 / r, 0); exp = 1 / g; expTxt = 'Soll: ca. ' + fmtOhm(exp) + ' (' + via.filter(p => p.kind === 'res').map(p => p.ref).join(', ') + ' liegt dazwischen)'; }
      raw.push({ type: 'iso', phase: 1, net: pr.a, net2: pr.b, a: best.x, b: best.y, label: 'Isolation ' + pr.a + ' gegen ' + pr.b, gap: pr.gap, expectOhm: exp, expectText: expTxt });
    });
    /* Bauteile */
    an.partInfo.forEach(p => {
      const k = p.kind, dt = dtypeOf(k);
      if (TWOPIN[k] && p.covered && p.pads.length >= 2) {
        const a = p.pads[0], b = p.pads[1], val = parseVal(p.value);
        const st = { type: dt, phase: 2, ref: p.ref, net: a.net, net2: b.net, a, b, label: p.ref + ' ' + (p.value || '') };
        if (dt === 'res') { st.expect = val; st.expectText = val != null ? 'Soll: ' + fmtOhm(val) + ' ±5 %' : 'Soll: Wert unbekannt'; st.kelvin = val != null && val < o.kelvinBelow; }
        else if (dt === 'cap') { st.expect = val; st.expectText = val != null ? 'Soll: ' + fmtCap(val) + ' ±20 %' : 'Soll: Wert unbekannt'; }
        else if (dt === 'ind') { st.expect = 0.3; st.expectText = 'Soll: Gleichstromwiderstand klein (< 5 Ω)'; }
        else if (dt === 'fuse') { st.expect = 0.1; st.expectText = 'Soll: Durchgang (< 1 Ω)'; st.kelvin = true; }
        else { st.expect = diodeVf(p.part, k); st.expectText = 'Soll: Flussspannung ca. ' + fmtV(st.expect) + ' (bei kleinem Teststrom)'; }
        raw.push(st);
      } else if (isIcLike(k) && p.acc.length >= 1) {
        const ref = p.pads.find(q => /^(gnd|agnd|dgnd|vss|0v)$/i.test(q.net)) || p.pads[0];
        p.acc.forEach(q => { if (q === ref && p.acc.length > 1) return; raw.push({ type: 'pin', phase: 2, ref: p.ref, net: q.net, a: q, b: p.acc.find(r => r !== q) || q, label: p.ref + ' Pin ' + q.n + ' (Schutzdiode)', expect: 0.6, expectText: 'Soll: Diodenstrecke zum Bezugspin, ca. 0,5 bis 0,7 V' }); });
      }
    });
    /* Reihenfolge nach kurzen Wegen, Phase für Phase */
    const board0 = { w: board.w || 0, h: board.h || 0 };
    let p0 = { x: 0, y: 0 }, p1 = { x: board0.w, y: board0.h };
    const steps = []; let tTotal = 0, pathMm = 0;
    [0, 1, 2].forEach(ph => {
      const pool = raw.filter(r => r.phase === ph);
      while (pool.length) {
        let bi = 0, bc = 1e18, bswap = false;
        for (let i = 0; i < pool.length; i++) {
          const s = pool[i], c1 = Math.max(dist(p0, s.a), dist(p1, s.b)), c2 = Math.max(dist(p0, s.b), dist(p1, s.a));
          if (c1 < bc - 1e-9) { bc = c1; bi = i; bswap = false; } if (c2 < bc - 1e-9) { bc = c2; bi = i; bswap = true; }
        }
        const s = pool.splice(bi, 1)[0], A = bswap ? s.b : s.a, B = bswap ? s.a : s.b;
        const d0 = dist(p0, A), d1 = dist(p1, B), dm = Math.max(d0, d1), tMove = dm / o.speed + (dm > 0.01 ? o.moveOverheadS : 0), tMeas = o.meas[s.type] != null ? o.meas[s.type] : 0.05;
        const tm = (s.type === 'cap' && s.expect) ? clamp(o.meas.cap * (0.5 + Math.log10(Math.max(1e-11, s.expect) / 1e-9 + 10) / 2), 0.05, 1.5) : tMeas;
        const t = tMove + o.touchS + tm;
        const kelvin = !!s.kelvin && o.probes >= 4;
        const st = {
          i: steps.length, type: s.type, net: s.net, net2: s.net2 || null, ref: s.ref || null, label: s.label,
          a: { id: A.id, x: A.x, y: A.y, name: nodeName(A), side: A.useSide || 'top' }, b: { id: B.id, x: B.x, y: B.y, name: nodeName(B), side: B.useSide || 'top' },
          dist: d0 + d1, tMove, tMeas: tm, t, kelvin, kelvinWanted: !!s.kelvin, expect: s.expect != null ? s.expect : s.expectOhm != null ? s.expectOhm : null, expectText: s.expectText || (s.type === 'cont' ? 'Soll: Durchgang (< 1 Ω)' : 'Soll: > 1 MΩ'),
          gap: s.gap != null ? s.gap : null
        };
        steps.push(st); p0 = { x: A.x, y: A.y }; p1 = { x: B.x, y: B.y }; tTotal += t; pathMm += d0 + d1;
      }
    });
    const pairs = Math.floor(o.probes / 2), pf = 1 + (pairs - 1) * 0.75;
    let acc = o.loadS; steps.forEach(s => { acc += s.t / pf; s.tEnd = acc; });
    const timeS = steps.length ? o.loadS + tTotal / pf : o.loadS;
    /* Sollwerte ("Golden") mit deterministischer Streuung */
    steps.forEach(s => {
      const r = hash(o.seed, s.label + '|' + s.i), dev = (r - 0.5) * 2;
      if (s.type === 'cont') { const R = 0.01 + 0.0025 * s.dist / 2 * 1; s.measured = R * (1 + 0.2 * dev); s.unit = 'Ω'; s.text = fmtOhm(s.measured); }
      else if (s.type === 'iso') { if (s.expect) { s.measured = s.expect * (1 + 0.004 * dev); s.unit = 'Ω'; s.text = fmtOhm(s.measured); } else { s.measured = null; s.unit = 'Ω'; s.text = '> 10 MΩ'; } }
      else if (s.type === 'res') { s.measured = s.expect != null ? s.expect * (1 + 0.006 * dev) : null; s.unit = 'Ω'; s.text = s.measured != null ? fmtOhm(s.measured) : 'nicht bewertet'; }
      else if (s.type === 'cap') { s.measured = s.expect != null ? s.expect * (1 + 0.05 * dev) : null; s.unit = 'F'; s.text = s.measured != null ? fmtCap(s.measured) : 'nicht bewertet'; }
      else if (s.type === 'ind' || s.type === 'fuse') { s.measured = s.expect * (1 + 0.15 * dev); s.unit = 'Ω'; s.text = fmtOhm(s.measured); }
      else { s.measured = s.expect * (1 + 0.03 * dev); s.unit = 'V'; s.text = fmtV(s.measured); }
      s.ok = true; s.fail = null;
    });
    const coverage = coverageOf(an), issues = dftFrom(board, an);
    const kel = steps.filter(s => s.kelvinWanted && !s.kelvin).length;
    if (kel) issues.push({ id: 'kelvin-' + kel, type: 'kelvin', severity: 'info', msg: kel + ' kleine Widerstand/Widerstände (unter ' + o.kelvinBelow + ' Ω) oder Sicherung(en) würden eine Vierleitermessung (Kelvin) mit mindestens vier Nadeln brauchen. Mit zwei Nadeln fließt der Übergangswiderstand der Nadelspitzen in die Messung ein.', at: null });
    if (isoUntested.length) issues.push({ id: 'isoun-' + isoUntested.length, type: 'isoun', severity: 'warn', msg: isoUntested.length + ' Nachbarpaar' + (isoUntested.length === 1 ? '' : 'e') + ' von Netzen ' + (isoUntested.length === 1 ? 'lässt' : 'lassen') + ' sich nicht auf Kurzschluss prüfen, weil mindestens ein Netz keinen erreichbaren Punkt hat (z. B. ' + isoUntested.slice(0, 3).map(p => p.a + '/' + p.b).join(', ') + ').', at: { x: isoUntested[0].x, y: isoUntested[0].y }, count: isoUntested.length });
    const stats = {
      measurements: steps.length, byType: steps.reduce((m, s) => { m[s.type] = (m[s.type] || 0) + 1; return m; }, {}), pathMm, nodes: an.nodes.filter(n => n.ok).length, nodesAll: an.nodes.length,
      neighborPairs: near.length, isoSkipped, isoUntested: isoUntested.length, pairs, parallel: pf
    };
    const cost = { perBoard: timeS / 3600 * o.rate, rate: o.rate };
    const nodes = an.nodes.map(n => ({ id: n.id, kind: n.kind, ref: n.ref, n: n.n, net: n.net, x: n.x, y: n.y, w: n.w, h: n.h, ok: n.ok, access: n.access, why: n.why, side: n.useSide, tall: !!n.tall, under: !!n.under, small: !!n.small, extra: !!n.extra }));
    return { steps, timeS, coverage, issues, nodes, stats, cost, opts: o, near, summary: { netsNoTP: an.nets.filter(N => !N.acc.length).map(N => N.name), partsNotCovered: an.partInfo.filter(p => !p.covered).map(p => p.ref) } };
  }

  function dft(board, opts) {
    const an = analyze(board, opts), issues = dftFrom(board, an), cov = coverageOf(an);
    return { issues, coverage: cov, summary: { netsNoTP: an.nets.filter(N => !N.acc.length).map(N => N.name), singleTP: an.nets.filter(N => N.acc.length === 1).map(N => N.name), partsNotCovered: an.partInfo.filter(p => !p.covered).map(p => p.ref) }, opts: an.o };
  }

  /* ---------- Fehler ---------- */
  const SAY = {
    found: ['Gefunden! Die Nadel hat\'s gemerkt.', 'Erwischt! Da hat die Nadel nicht locker gelassen.', 'Treffer! Der Fehler kann sich nicht verstecken.', 'Messwert falsch, Fehler gefunden: Die Nadel lügt nicht.'],
    missed: ['Übersehen! Dieser Fehler war für die Nadeln unsichtbar.', 'Durchgerutscht: An diese Stelle kommt keine Nadel.', 'Test bestanden, Platine kaputt: Das nennt man Schlupf.', 'Kein Testpunkt, keine Messung, kein Fund.'],
    pass: ['Prüfung bestanden! Alle Messungen im grünen Bereich.', 'Sauber! Jede Messung liegt im Soll.']
  };
  const FAULT_NAME = { open: 'Unterbrechung', short: 'Kurzschluss', value: 'Falscher Bauteilwert', missing: 'Bauteil fehlt', reversed: 'Bauteil verpolt', icrot: 'IC verdreht', cold: 'Kalte Lötstelle', defopen: 'Bauteil defekt (offen)', defshort: 'Bauteil defekt (Schluss)' };
  const KIND_MAP = { crack: 'open', viabreak: 'open', bridge: 'short', ball: 'short', copper: 'short', wrongvalue: 'value', reversed: 'reversed', icrot: 'icrot', cold: 'cold', missing: 'missing', def_open: 'defopen', def_short: 'defshort', open: 'open', short: 'short', value: 'value', defopen: 'defopen', defshort: 'defshort' };
  function normalizeFault(f) {
    if (!f) return null;
    const kind = KIND_MAP[f.kind] || KIND_MAP[f.id] || f.kind;
    const out = { kind, src: f.kind || f.id, name: FAULT_NAME[kind] || f.name || kind, desc: f.desc || '' };
    ['net', 'nets', 'ref', 'pad', 'was', 'now', 'where', 'padIsland', 'track', 'via', 'seed'].forEach(k => { if (f[k] != null) out[k] = f[k]; });
    if (kind === 'short' && !out.nets && out.net) out.nets = [out.net];
    if (kind === 'cold' && out.pad && !out.ref) out.ref = String(out.pad).split('.')[0];
    if (!out.where && f.at) out.where = f.at;
    return out;
  }
  function collectFaults(board, faulty) {
    if (!faulty) return [];
    if (Array.isArray(faulty)) return faulty.map(normalizeFault).filter(Boolean);
    if (faulty.faults && Array.isArray(faulty.faults)) return faulty.faults.map(normalizeFault).filter(Boolean);
    if (faulty.kind && !faulty.parts) return [normalizeFault(faulty)];
    const fb = faulty.board && faulty.board.parts ? faulty.board : faulty;
    if (fb.repair && fb.repair.faults && fb.repair.faults.length) return fb.repair.faults.map(normalizeFault).filter(Boolean);
    return diffFaults(board, fb);
  }
  function diffFaults(g, f) {
    const C = core(), out = [], gp = {}, fp = {};
    (g.parts || []).forEach(p => { gp[p.ref] = p; }); (f.parts || []).forEach(p => { fp[p.ref] = p; });
    Object.keys(gp).forEach(r => {
      const a = gp[r], b = fp[r], k = kindOf(a, null);
      if (!b) { out.push(normalizeFault({ kind: 'missing', ref: r, where: { x: a.x, y: a.y } })); return; }
      if (String(a.value) !== String(b.value)) out.push(normalizeFault({ kind: 'value', ref: r, was: a.value, now: b.value, where: { x: a.x, y: a.y } }));
      if (((a.rot || 0) - (b.rot || 0) + 720) % 360 === 180 && (k === 'ic' || k === 'led' || k === 'diode' || k === 'cap_pol' || k === 'trans')) out.push(normalizeFault({ kind: k === 'ic' || k === 'trans' ? 'icrot' : 'reversed', ref: r, where: { x: a.x, y: a.y } }));
    });
    if (C) {
      let cg = null, cf = null; try { cg = C.connectivity(g); cf = C.connectivity(f); } catch (e) { return out; }
      const gi = {}; cg.nets.forEach(n => { gi[n.name] = n.islands; });
      cf.nets.forEach(n => { if (n.islands > (gi[n.name] || 1)) { const pi = {}; Object.keys(cf.padIsland || {}).forEach(k => { if (cf.padIsland[k].net === n.name) pi[k] = cf.padIsland[k].island; }); out.push(normalizeFault({ kind: 'open', net: n.name, padIsland: pi })); } });
      (cf.shorts || []).forEach(s => { const had = (cg.shorts || []).some(q => (q.netA === s.netA && q.netB === s.netB) || (q.netA === s.netB && q.netB === s.netA)); if (!had) out.push(normalizeFault({ kind: 'short', nets: [s.netA, s.netB], where: s.at })); });
    }
    return out;
  }

  const nodeKey = id => String(id).replace(/^[a-z]+:/, '');
  function evalFault(plan, f, seed) {
    const steps = plan.steps, res = { fault: f, found: false, stepIndex: -1, steps: [], why: '', how: '' };
    const byRef = ref => steps.filter(s => s.ref === ref);
    const mark = (list, how) => { if (list.length) { res.found = true; res.steps = list.map(s => s.i); res.stepIndex = list[0].i; res.how = how; } };
    const nodes = plan.nodes, netNodes = n => nodes.filter(q => q.net === n && q.ok);
    const region = (x, y) => (f.where ? Math.hypot(x - f.where.x, y - f.where.y) : 0);
    switch (f.kind) {
      case 'open': case 'cold': {
        const cont = steps.filter(s => s.type === 'cont' && s.net === f.net);
        if (f.kind === 'open' && cont.length) {
          let hit = [];
          if (f.padIsland) {
            const isl = id => { const k = nodeKey(id); if (f.padIsland[k] != null) return f.padIsland[k]; const nd = nodes.find(q => q.id === id); let best = null, bd = 1e9; Object.keys(f.padIsland).forEach(pk => { const p = nodes.find(q => q.id === 'pad:' + pk); if (p && nd) { const d = Math.hypot(p.x - nd.x, p.y - nd.y); if (d < bd) { bd = d; best = f.padIsland[pk]; } } }); return best; };
            hit = cont.filter(s => isl(s.a.id) !== isl(s.b.id));
          } else hit = [cont.slice().sort((p, q) => region((p.a.x + p.b.x) / 2, (p.a.y + p.b.y) / 2) - region((q.a.x + q.b.x) / 2, (q.a.y + q.b.y) / 2))[0]];
          mark(hit, 'Durchgangsmessung im Netz ' + f.net);
          if (!res.found) res.why = 'Die erreichbaren Punkte des Netzes ' + f.net + ' liegen alle auf derselben Seite der Unterbrechung.';
        } else if (f.kind === 'open') {
          const n = netNodes(f.net).length;
          res.why = n === 0 ? 'Das Netz ' + f.net + ' hat keinen erreichbaren Testpunkt.' : 'Das Netz ' + f.net + ' hat nur einen erreichbaren Testpunkt: ohne zweiten Punkt gibt es keine Durchgangsmessung.';
        } else {
          const rs = byRef(f.ref).filter(s => s.type !== 'pin');
          if (rs.length && hash(seed || 1, 'cold|' + f.ref) < 0.5) mark(rs, 'Wackelkontakt an ' + f.ref + ' (Messwert springt)');
          else res.why = rs.length ? 'Wackelkontakt: Der Kontakt war bei der Messung gerade gut. Kalte Lötstellen sind elektrisch oft noch verbunden.' : 'Kalte Lötstelle: ohne Messung am Bauteil nicht zu erkennen (AOI und Sichtprüfung sind hier besser).';
        }
        break;
      }
      case 'short': {
        const [A, B] = f.nets || []; const k = s => (s.net === A && s.net2 === B) || (s.net === B && s.net2 === A);
        let list = steps.filter(s => s.type === 'iso' && k(s));
        if (!list.length) list = steps.filter(s => (s.type === 'res' || s.type === 'cap') && k(s));
        mark(list, list.length && list[0].type === 'iso' ? 'Isolationsmessung ' + A + ' gegen ' + B : 'Bauteilmessung zwischen ' + A + ' und ' + B);
        if (!res.found) res.why = !netNodes(A).length || !netNodes(B).length ? 'Mindestens eines der beiden Netze (' + A + ', ' + B + ') hat keinen erreichbaren Punkt: ohne Nadel keine Isolationsmessung.' : 'Die Netze ' + A + ' und ' + B + ' stehen nicht als Nachbarn im Testprogramm.';
        break;
      }
      case 'value': case 'defopen': case 'defshort': case 'missing': case 'reversed': case 'icrot': {
        const rs = byRef(f.ref), two = rs.filter(s => s.type !== 'pin'), pins = rs.filter(s => s.type === 'pin');
        if (f.kind === 'value') { if (two.length && (two[0].type === 'res' || two[0].type === 'cap' || two[0].type === 'ind')) mark(two, 'Wertmessung an ' + f.ref); else res.why = 'Das Bauteil ' + f.ref + ' ist nicht beidseitig erreichbar oder ein Wert wird bei diesem Typ nicht gemessen.'; }
        else if (f.kind === 'defopen' || f.kind === 'defshort') { if (two.length) mark(two, 'Messung an ' + f.ref); else res.why = 'Das Bauteil ' + f.ref + ' ist nicht beidseitig erreichbar.'; }
        else if (f.kind === 'missing') {
          if (two.length) mark(two, 'Messung an ' + f.ref + ' zeigt offen'); else if (pins.length >= 2) mark(pins.slice(0, 1), 'Schutzdioden-Test an ' + f.ref); else res.why = 'Für ' + f.ref + ' gibt es keinen Messschritt: Ein fehlendes Bauteil ohne Messung fällt nicht auf (AOI sieht es sofort).';
        } else if (f.kind === 'reversed') {
          const pol = two.find(s => s.type === 'diode' || s.type === 'led'), isCap = two.length && two[0].type === 'cap';
          if (pol) mark([pol], 'Diodentest an ' + f.ref + ': Sperrrichtung'); else if (isCap && plan.opts && plan.opts.polarCapTest) mark(two, 'Polaritätstest an ' + f.ref); else res.why = isCap ? 'Die Polarität eines Elkos sieht die Kapazitätsmessung nicht. Hier ist die AOI (Polaritätsmarkierung) besser.' : 'Das Bauteil ' + f.ref + ' ist nicht beidseitig erreichbar.';
        } else if (f.kind === 'icrot') {
          const total = (plan.nodes.filter(q => q.ref === f.ref && q.kind === 'pad')).length;
          if (pins.length && pins.length >= 0.7 * total) mark(pins.slice(0, 1), 'Schutzdioden-Muster von ' + f.ref + ' stimmt nicht'); else res.why = 'Zu wenige Pins von ' + f.ref + ' sind erreichbar (' + pins.length + ' von ' + total + '): Das Schutzdioden-Muster lässt sich nicht verlässlich lesen. AOI erkennt verdrehte ICs viel sicherer.';
        }
        break;
      }
      default: res.why = 'Unbekannte Fehlerart.';
    }
    return res;
  }

  function failText(s, f) {
    const exp = s.expectText.replace(/^Soll: /, '');
    switch (f.kind) {
      case 'open': return { measured: null, text: 'offen (> 10 MΩ)', note: 'Unterbrechung: Soll Durchgang, gemessen offen' };
      case 'cold': return { measured: s.measured ? s.measured * 8 : 5, text: s.type === 'cap' ? fmtCap(s.measured * 0.5) + ' (springt)' : fmtOhm(s.measured * 8) + ' (springt)', note: 'Wackelkontakt: Messwert instabil' };
      case 'short': return { measured: 0.3, text: '0,3 Ω', note: 'Kurzschluss: Soll ' + exp + ', gemessen 0,3 Ω' };
      case 'value': {
        const was = parseVal(f.was), now = parseVal(f.now), fac = was && now ? now / was : 10, m = s.measured * fac;
        return { measured: m, text: s.type === 'cap' ? fmtCap(m) : fmtOhm(m), note: 'Wert falsch: Soll ' + exp + ', gemessen ' + (s.type === 'cap' ? fmtCap(m) : fmtOhm(m)) };
      }
      case 'missing': return { measured: null, text: s.type === 'cap' ? 'keine Kapazität' : 'offen (> 10 MΩ)', note: 'Bauteil fehlt: ' + (s.type === 'pin' ? 'Schutzdiode nicht vorhanden' : 'Soll ' + exp + ', gemessen offen') };
      case 'reversed': return { measured: null, text: 'Sperrrichtung (offen)', note: 'Bauteil verpolt: Diodenstrecke sperrt' };
      case 'icrot': return { measured: 0.1, text: '0,10 V', note: 'IC verdreht: Diodenmuster passt nicht' };
      case 'defopen': return { measured: null, text: 'offen (> 10 MΩ)', note: 'Bauteil defekt: unterbrochen' };
      case 'defshort': return { measured: 0.2, text: '0,2 Ω', note: 'Bauteil defekt: Schluss' };
    }
    return { measured: null, text: '?', note: 'Abweichung' };
  }

  function inspect(board, faulty, opts) {
    const plan = (opts && opts.plan) || planFlyingProbe(board, opts);
    const seed = (opts && opts.seed) || 1;
    const faults = collectFaults(board, faulty);
    const steps = plan.steps.map(s => Object.assign({}, s, { fail: null, ok: true }));
    const results = faults.map(f => {
      const r = evalFault(Object.assign({}, plan, { steps }), f, seed);
      if (r.found) r.steps.forEach(i => { const s = steps[i]; if (s.fail) return; const t = failText(s, f); s.ok = false; s.fail = { kind: f.kind, note: t.note }; s.measured = t.measured; s.text = t.text; });
      return { kind: f.kind, name: f.name, net: f.net || null, nets: f.nets || null, ref: f.ref || null, where: f.where || null, found: r.found, stepIndex: r.stepIndex, steps: r.steps, how: r.how, why: r.why, desc: f.desc || '', fault: f };
    });
    const found = results.filter(r => r.found), missed = results.filter(r => !r.found), failedSteps = steps.filter(s => !s.ok);
    const pick = (arr, k) => arr[Math.floor(hash(seed, k) * arr.length) % arr.length];
    return {
      plan, steps, faults: results, found: found.length, missed: missed.length, failedSteps, pass: failedSteps.length === 0, escape: results.length > 0 && missed.length > 0,
      verdict: failedSteps.length ? 'fail' : 'pass', say: failedSteps.length ? pick(SAY.found, 'f' + results.length) : results.length ? pick(SAY.missed, 'm' + results.length) : pick(SAY.pass, 'p'),
      timeS: plan.timeS, coverage: plan.coverage
    };
  }

  /* ---------- eigene Fehlerinjektion ---------- */
  function pickIdx(seed, key, n) { return n ? Math.floor(hash(seed, key) * n) % n : 0; }
  function inject(board, kind, seed, opts) {
    seed = seed == null ? 1 : seed; opts = opts || {};
    const k = KIND_MAP[kind] || kind, C = core(), b = clone(board);
    const R = root.PCB_REPAIR;
    if (!opts.own && R && R.inject && R.faults && R.faults.some(f => f.id === kind)) {
      try { const r = R.inject(board, { kind, seed }); if (r && r.info) { const nf = normalizeFault(r.info); nf.seed = seed; return { board: r.board, faults: [nf], info: r.info, source: 'repair' }; } } catch (e) { /* weiter mit eigener Injektion */ }
    }
    const parts = b.parts || [];
    const kindParts = fn => parts.filter(p => { const kk = kindOf(p, null); return fn(kk, p); }).sort((x, y) => (x.ref < y.ref ? -1 : 1));
    const fail = msg => ({ board: b, faults: [], info: null, error: msg, source: 'own' });
    if (k === 'open') {
      if (!C) return fail('PCB_CORE fehlt');
      const cg = C.connectivity(board), names = cg.nets.filter(n => n.connected && (b.tracks || []).some(t => t.net === n.name)).map(n => n.name).sort();
      for (let a = 0; a < names.length; a++) {
        const net = names[(pickIdx(seed, 'open', names.length) + a) % names.length], trks = (b.tracks || []).filter(t => t.net === net);
        for (let j = 0; j < trks.length; j++) {
          const t = trks[(pickIdx(seed, 'tr' + net, trks.length) + j) % trks.length], c = clone(board); c.tracks = c.tracks.filter(x => x.id !== t.id);
          const cf = C.connectivity(c), nn = cf.nets.find(n => n.name === net);
          if (nn && nn.islands > 1) {
            const mid = t.pts[Math.floor(t.pts.length / 2)], pi = {}; Object.keys(cf.padIsland || {}).forEach(pk => { if (cf.padIsland[pk].net === net) pi[pk] = cf.padIsland[pk].island; });
            const f = normalizeFault({ kind: 'open', net, track: t.id, where: { x: mid[0], y: mid[1] }, padIsland: pi, seed, desc: 'Leiterbahn im Netz ' + net + ' ist unterbrochen.' });
            return { board: c, faults: [f], info: { kind: 'open', net, desc: f.desc, where: f.where }, source: 'own' };
          }
        }
      }
      return fail('Keine verlegte Leiterbahn zum Unterbrechen gefunden.');
    }
    if (k === 'short') {
      if (!C) return fail('PCB_CORE fehlt');
      const pads = C.padsOf(board).filter(p => p.net), cand = [];
      for (let i = 0; i < pads.length; i++) for (let j = i + 1; j < pads.length; j++) { const a = pads[i], c = pads[j]; if (a.net === c.net || a.ref === c.ref) continue; const d = Math.hypot(a.x - c.x, a.y - c.y); if (d < 6) cand.push({ a, c, d }); }
      cand.sort((p, q) => p.d - q.d || (p.a.ref + p.a.n + p.c.ref + p.c.n < q.a.ref + q.a.n + q.c.ref + q.c.n ? -1 : 1));
      if (!cand.length) return fail('Keine benachbarten Anschlüsse verschiedener Netze für einen Kurzschluss gefunden.');
      const pk = cand[Math.min(cand.length - 1, pickIdx(seed, 'short', Math.min(cand.length, 12)))], layer = pk.a.layers.indexOf('F.Cu') >= 0 && pk.c.layers.indexOf('F.Cu') >= 0 ? 'F.Cu' : 'B.Cu';
      b.tracks = (b.tracks || []).concat([{ id: 'inj' + seed, layer, net: pk.a.net, w: 0.3, pts: [[pk.a.x, pk.a.y], [pk.c.x, pk.c.y]] }]);
      const f = normalizeFault({ kind: 'short', nets: [pk.a.net, pk.c.net], where: { x: (pk.a.x + pk.c.x) / 2, y: (pk.a.y + pk.c.y) / 2 }, seed, desc: 'Lötbrücke zwischen ' + pk.a.net + ' und ' + pk.c.net + '.' });
      return { board: b, faults: [f], info: { kind: 'short', nets: f.nets, desc: f.desc, where: f.where }, source: 'own' };
    }
    const one = (key, list, mk) => { if (!list.length) return fail('Keine passende Stelle für ' + (FAULT_NAME[k] || k) + ' gefunden.'); const p = list[pickIdx(seed, key, list.length)]; return mk(parts.find(q => q.ref === p.ref)); };
    if (k === 'value') return one('value', kindParts(kk => kk === 'res' || kk === 'cap' || kk === 'cap_pol'), p => { const was = p.value, v = parseVal(was) || 1000, nv = v * 10; p.value = nv >= 1e-6 && nv < 1e-3 && /[uµnp]/i.test(String(was)) ? fmtCap(nv).replace(/\s/g, '').replace(',', '.') : nv >= 1e6 ? fm(nv / 1e6, 0) + 'M' : nv >= 1000 ? fm(nv / 1000, 0) + 'k' : fm(nv, 0); const f = normalizeFault({ kind: 'value', ref: p.ref, was, now: p.value, where: { x: p.x, y: p.y }, seed, desc: p.ref + ' hat den Wert ' + p.value + ' statt ' + was + '.' }); return { board: b, faults: [f], info: { kind: 'value', ref: p.ref, desc: f.desc, where: f.where }, source: 'own' }; });
    if (k === 'missing') return one('missing', kindParts(kk => kk !== 'tp' && kk !== 'fid'), p => { b.parts = parts.filter(q => q.ref !== p.ref); const f = normalizeFault({ kind: 'missing', ref: p.ref, where: { x: p.x, y: p.y }, seed, desc: 'Bauteil ' + p.ref + ' fehlt.' }); return { board: b, faults: [f], info: { kind: 'missing', ref: p.ref, desc: f.desc, where: f.where }, source: 'own' }; });
    if (k === 'reversed') return one('reversed', kindParts(kk => kk === 'led' || kk === 'diode' || kk === 'cap_pol'), p => { p.rot = (((p.rot || 0) + 180) % 360); const f = normalizeFault({ kind: 'reversed', ref: p.ref, where: { x: p.x, y: p.y }, seed, desc: p.ref + ' sitzt falsch herum.' }); return { board: b, faults: [f], info: { kind: 'reversed', ref: p.ref, desc: f.desc, where: f.where }, source: 'own' }; });
    if (k === 'cold') return one('cold', kindParts(kk => kk !== 'tp' && kk !== 'fid'), p => { const pk = C ? C.padsOf(board).filter(q => q.ref === p.ref) : []; const pd = pk.length ? pk[pickIdx(seed, 'cp', pk.length)] : { n: '1', x: p.x, y: p.y }; const f = normalizeFault({ kind: 'cold', ref: p.ref, pad: p.ref + '.' + pd.n, where: { x: pd.x, y: pd.y }, seed, desc: 'Die Lötstelle an ' + p.ref + ' Pin ' + pd.n + ' ist kalt.' }); return { board: b, faults: [f], info: { kind: 'cold', ref: p.ref, desc: f.desc, where: f.where }, source: 'own' }; });
    if (k === 'icrot') return one('icrot', kindParts(kk => kk === 'ic'), p => { p.rot = (((p.rot || 0) + 180) % 360); const f = normalizeFault({ kind: 'icrot', ref: p.ref, where: { x: p.x, y: p.y }, seed, desc: p.ref + ' sitzt um 180 Grad verdreht.' }); return { board: b, faults: [f], info: { kind: 'icrot', ref: p.ref, desc: f.desc, where: f.where }, source: 'own' }; });
    return fail('Unbekannte Fehlerart: ' + kind);
  }

  /* ---------- Break-even ICT gegen Flying Probe ---------- */
  function ictFixtureCost(nodesCount) { return 1500 + 4 * Math.max(0, nodesCount); }
  function ictTimeS(measurements) { return clamp(1.5 + 0.02 * measurements, 2, 90); }
  function breakEven(p) {
    p = p || {};
    const rateFp = +(p.rateFp != null ? p.rateFp : p.rate != null ? p.rate : 60), rateIct = +(p.rateIct != null ? p.rateIct : p.rate != null ? p.rate : 60);
    const fpT = Math.max(0, +p.fpTimeS || 0), ictT = Math.max(0, +p.ictTimeS || 0), fix = Math.max(0, +p.fixture || 0), sFp = Math.max(0, +p.fpSetup || 0), sIct = Math.max(0, +p.ictSetup || 0);
    const cFp = fpT / 3600 * rateFp, cIct = ictT / 3600 * rateIct, fixed = fix + sIct - sFp;
    let qty = null;
    if (cFp > cIct + 1e-12) qty = fixed <= 0 ? 0 : Math.ceil(fixed / (cFp - cIct)); else qty = fixed <= 0 ? 0 : null;
    const fpCost = q => sFp + q * cFp, ictCost = q => fix + sIct + q * cIct;
    const maxQ = Math.max(10, +p.maxQty || (qty ? qty * 8 : 100000)), curve = [];
    for (let i = 0; i <= 40; i++) { const q = Math.round(Math.exp(Math.log(1) + (Math.log(maxQ) - Math.log(1)) * i / 40)); if (!curve.length || curve[curve.length - 1].q !== q) curve.push({ q, fp: fpCost(q), ict: ictCost(q) }); }
    const q0 = p.qty != null ? Math.max(1, +p.qty) : null;
    return {
      qty, cFp, cIct, fpCost, ictCost, curve, maxQ,
      atQty: q0 == null ? null : { qty: q0, fp: fpCost(q0), ict: ictCost(q0), fpPer: fpCost(q0) / q0, ictPer: ictCost(q0) / q0, cheaper: Math.abs(fpCost(q0) - ictCost(q0)) < 0.005 ? 'gleich' : fpCost(q0) < ictCost(q0) ? 'fp' : 'ict' }
    };
  }
  function compare(board, opts) {
    opts = opts || {};
    const fp = planFlyingProbe(board, Object.assign({}, opts, { mode: 'fp', side: opts.side || 'both' }));
    const ict = planFlyingProbe(board, Object.assign({}, opts, { mode: 'ict', side: opts.ictSide || 'bot', probes: 2 }));
    const ictTime = ictTimeS(ict.steps.length), fix = ictFixtureCost(ict.stats.nodes);
    const be = breakEven({ fpTimeS: fp.timeS, ictTimeS: ictTime, fixture: opts.fixture != null ? opts.fixture : fix, rate: opts.rate || 60, fpSetup: opts.fpSetup != null ? opts.fpSetup : 150, ictSetup: opts.ictSetup != null ? opts.ictSetup : 400, qty: opts.qty, maxQty: opts.maxQty });
    return { fp: { timeS: fp.timeS, coverage: fp.coverage, steps: fp.steps.length }, ict: { timeS: ictTime, coverage: ict.coverage, steps: ict.steps.length, fixture: fix, nodes: ict.stats.nodes }, breakEven: be };
  }

  const api = { version: '1.0', planFlyingProbe, dft, inspect, breakEven, inject, compare, analyze: (b, o) => { const a = analyze(b, o); return { nodes: a.nodes, nets: a.nets.map(n => ({ name: n.name, nodes: n.nodes.length, acc: n.acc.length })), parts: a.partInfo.map(p => ({ ref: p.ref, kind: p.kind, covered: p.covered })) }; }, suggestTP: (b, o, net, side) => suggestTP(b, analyze(b, o), net, side), parseVal, fmtOhm, fmtCap, kindOf, ictFixtureCost, ictTimeS, SAY, FAULT_NAME, MODES, defaults: BASE };
  root.PCB_TEST = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  /* ====================================================================================
     TEIL B: OBERFLÄCHE (nur im Browser)
     ==================================================================================== */
  function installUi() {
    root.PCB_VIEWS = root.PCB_VIEWS || { views: {}, register(id, def) { this.views[id] = def; } };
    const doc = root.document;
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const lsGet = (k, d) => { try { const v = root.localStorage.getItem('pcb.test.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
    const lsSet = (k, v) => { try { root.localStorage.setItem('pcb.test.' + k, JSON.stringify(v)); } catch (e) { /* egal */ } };
    function h(tag, attrs, kids) {
      const e = doc.createElement(tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k]; if (v == null || v === false) continue;
        if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
        else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
      }
      (Array.isArray(kids) ? kids : kids == null ? [] : [kids]).forEach(c => { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? doc.createTextNode(c) : c); });
      return e;
    }
    const MONO = 'ui-monospace,SFMono-Regular,Consolas,Menlo,monospace';
    const CSS = `
.pt{position:relative;display:flex;flex-direction:column;height:100%;min-height:380px;background:#14181c;color:#e8edf2;font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;overflow:hidden}
.pt *{box-sizing:border-box}
.pt-tabs{display:flex;gap:6px;padding:8px;background:#222830;border-bottom:1px solid #2c343e;flex:0 0 auto;overflow-x:auto;-webkit-overflow-scrolling:touch}
.pt-tab{flex:0 0 auto;min-height:40px;padding:0 14px;border:1px solid #3a4452;background:#2c343e;color:#c9d2dc;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
.pt-tab.on{background:#3b9eff;border-color:#3b9eff;color:#06121f}
.pt-body{flex:1 1 auto;overflow:auto;padding:10px;-webkit-overflow-scrolling:touch}
.pt-card{background:#222830;border:1px solid #2c343e;border-radius:12px;padding:12px;margin-bottom:12px;min-width:0}
.pt-card h3{margin:0 0 8px;font-size:15px;color:#e8edf2}
.pt-card h4{margin:12px 0 4px;font-size:13px;color:#9fb0c2;font-weight:700}
.pt-card p{margin:0 0 8px;color:#c9d2dc}
.pt-card ul,.pt-card ol{margin:0 0 8px;padding-left:20px;color:#c9d2dc}
.pt-card li{margin:2px 0}
.pt-mute{color:#8b97a3;font-size:12.5px}
.pt-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}
.pt-sp{flex:1 1 4px}
.pt-btn{min-height:40px;min-width:40px;padding:0 12px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
.pt-btn:active{filter:brightness(1.25)}
.pt-btn:disabled{opacity:.38;cursor:default}
.pt-btn.pri{background:#3b9eff;border-color:#3b9eff;color:#06121f}
.pt-btn.ok{background:#4cd964;border-color:#4cd964;color:#06200d}
.pt-btn.on{background:#1d3550;border-color:#3b9eff;color:#bfe0ff}
.pt-seg{display:inline-flex;border:1px solid #3a4452;border-radius:10px;overflow:hidden;flex:0 0 auto}
.pt-seg button{min-height:40px;min-width:44px;padding:0 12px;border:0;border-right:1px solid #3a4452;background:#2c343e;color:#c9d2dc;font:inherit;font-weight:600;cursor:pointer;touch-action:manipulation}
.pt-seg button:last-child{border-right:0}
.pt-seg button.on{background:#3b9eff;color:#06121f}
.pt-lbl{font-size:13px;color:#9fb0c2}
.pt-sel{width:auto;flex:0 1 auto;min-height:40px;background:#2c343e;color:#e8edf2;border:1px solid #3a4452;border-radius:10px;padding:0 8px;font:inherit;max-width:100%}
.pt-in{min-height:40px;background:#14181c;color:#e8edf2;border:1px solid #3a4452;border-radius:10px;padding:0 10px;font:inherit;width:100%}
.pt-sl{display:grid;grid-template-columns:minmax(90px,140px) 1fr minmax(70px,auto);gap:8px;align-items:center;margin:2px 0}
.pt-sl input[type=range]{width:100%;height:40px;margin:0;accent-color:#3b9eff;touch-action:pan-y}
.pt-sl output{font:600 13px ${MONO};color:#7fc0ff;text-align:right}
.pt-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:12px;align-items:start}
.pt-grid>.pt-card{margin-bottom:0}
.pt-split{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,330px);gap:12px;align-items:start;margin-bottom:12px}
.pt-split>.pt-card{margin-bottom:0}
@media (max-width:860px){.pt-split{grid-template-columns:minmax(0,1fr)}.pt-split>.pt-card{margin-bottom:12px}}
.pt-cv{display:block;width:100%;background:#0e1115;border-radius:10px;touch-action:none;cursor:pointer}
.pt-kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:8px}
.pt-k{background:#1b2128;border:1px solid #2c343e;border-radius:10px;padding:8px 10px}
.pt-k b{display:block;font:700 20px ${MONO};color:#7fc0ff}
.pt-k span{font-size:12px;color:#9fb0c2}
.pt-ok{color:#4cd964}.pt-warn{color:#ffb340}.pt-err{color:#ff6b6b}
.pt-note{border-left:3px solid #3b9eff;background:#1b2530;padding:8px 10px;border-radius:0 8px 8px 0;margin:8px 0;color:#c9d2dc}
.pt-note.ok{border-color:#4cd964;background:#1a2a20}.pt-note.warn{border-color:#ffb340;background:#2c2618}.pt-note.err{border-color:#ff6b6b;background:#2d1d20}
.pt-acc{border:1px solid #2c343e;border-radius:12px;background:#222830;margin-bottom:10px}
.pt-acc>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700;list-style:none;padding:4px 12px}
.pt-acc>summary::-webkit-details-marker{display:none}
.pt-acc>summary::before{content:"\\203A";font-weight:700;font-size:20px;width:14px;text-align:center;margin-right:8px;color:#3b9eff;transition:transform .15s}
.pt-acc[open]>summary::before{transform:rotate(90deg)}
.pt-acc>div{padding:0 12px 10px}
.pt-acc p,.pt-acc li{color:#c9d2dc}
.pt-acc ul,.pt-acc ol{padding-left:20px;margin:0 0 8px}
.pt-acc h4{margin:12px 0 4px;font-size:13px;color:#9fb0c2}
.pt-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr));gap:10px}
.pt-pro,.pt-con{border-radius:10px;padding:8px 10px;background:#1b2128;border:1px solid #2c343e}
.pt-pro h5,.pt-con h5{margin:0 0 4px;font-size:13px}
.pt-pro h5{color:#4cd964}.pt-con h5{color:#ffb340}
.pt-tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid #2c343e;border-radius:10px}
.pt-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:640px}
.pt-tbl th,.pt-tbl td{text-align:left;padding:7px 8px;border-bottom:1px solid #2c343e;vertical-align:top}
.pt-tbl th{color:#9fb0c2;font-weight:700;background:#1b2128;position:sticky;top:0}
.pt-tbl td.c,.pt-tbl th.c{text-align:center}
.pt-m{display:inline-block;min-width:26px;border-radius:12px;padding:1px 6px;font-weight:700;font-size:12px;text-align:center}
.pt-m2{background:#1a3a24;color:#6be787}.pt-m1{background:#3a3218;color:#ffcb5c}.pt-m0{background:#2b2f35;color:#7a8592}
.pt-fig{display:block;width:100%;max-width:520px;height:auto;margin:6px auto;background:#0e1115;border-radius:10px}
.pt-ov{position:absolute;inset:0;background:rgba(6,9,12,.72);z-index:20;display:flex;align-items:flex-start;justify-content:center;padding:10px;overflow:auto}
.pt-win{background:#222830;border:1px solid #3a4452;border-radius:14px;max-width:760px;width:100%;margin:auto;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.pt-win header{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2c343e;position:sticky;top:0;background:#222830;border-radius:14px 14px 0 0;z-index:1}
.pt-win header h3{margin:0;font-size:16px;flex:1}
.pt-win .pt-wb{padding:10px 12px 14px}
.pt-win .pt-wb h4{margin:12px 0 4px;font-size:13px;color:#9fb0c2}
.pt-win .pt-wb p,.pt-win .pt-wb li{color:#c9d2dc}
.pt-win .pt-wb ul{margin:0 0 8px;padding-left:20px}
.pt-pill{display:inline-block;border-radius:12px;padding:2px 9px;font-size:12px;font-weight:700;background:#2c343e;color:#c9d2dc;margin:0 4px 4px 0}
.pt-list{display:flex;flex-direction:column;gap:6px}
.pt-pr{display:grid;grid-template-columns:34px 1fr auto;gap:6px 8px;align-items:center;background:#1b2128;border:1px solid #2c343e;border-radius:8px;padding:6px 8px;min-height:40px;cursor:pointer;font-size:13px}
.pt-pr.bad{border-color:#7a2f35;background:#2a1a1d}
.pt-pr .n{font:12px ${MONO};color:#8b97a3}
.pt-pr .v{font:600 12.5px ${MONO};color:#7fc0ff;text-align:right}
.pt-pr.bad .v{color:#ff8a8a}
.pt-pr small{grid-column:2/4;color:#8b97a3;font-size:12px}
.pt-bar{height:8px;border-radius:4px;background:#2c343e;overflow:hidden}
.pt-bar i{display:block;height:100%;background:#3b9eff;width:0}
.pt-q{border:1px solid #2c343e;border-radius:10px;padding:10px;margin-bottom:10px;background:#1b2128}
.pt-q button.opt{display:block;width:100%;text-align:left;min-height:44px;margin:6px 0 0;padding:8px 12px;border:1px solid #3a4452;background:#2c343e;color:#e8edf2;border-radius:10px;font:inherit;cursor:pointer;touch-action:manipulation}
.pt-q button.opt.good{background:#1a3a24;border-color:#4cd964}
.pt-q button.opt.bad{background:#3a1d22;border-color:#ff6b6b}
.pt-chk{display:flex;gap:10px;align-items:flex-start;min-height:44px;padding:6px 4px;border-bottom:1px solid #2c343e;cursor:pointer}
.pt-chk input{width:22px;height:22px;margin-top:2px;accent-color:#4cd964;flex:0 0 auto}
.pt-gl{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,300px),1fr));gap:8px}
.pt-gl div{background:#1b2128;border:1px solid #2c343e;border-radius:10px;padding:8px 10px}
.pt-gl b{display:block;color:#7fc0ff;margin-bottom:2px}
.pt-gl span{color:#c9d2dc;font-size:13px}
`;
    function ensureCss() { if (doc.getElementById('pcbtest-css')) return; const st = doc.createElement('style'); st.id = 'pcbtest-css'; st.textContent = CSS; doc.head.appendChild(st); }
    const C = () => root.PCB_CORE || null;

    /* ---------- Platinen-Kennzahlen für "Bezug zu deiner Platine" ---------- */
    function boardStats(b) {
      const S = { smdTop: 0, smdBot: 0, parts: 0, smd: 0, tht: 0, top: 0, bot: 0, uniq: 0, smdPads: 0, minPad: null, minPadFp: '', minRatio: null, paste: 0, tallest: 0, tallRef: '', pol: [], qfn: [], ics: [], progIc: [], conn: 0, powerNets: [], nets: 0, area: 0, thtPads: 0, polCaps: 0 };
      const K = C(); if (!b || !K) return S;
      S.nets = (b.nets || []).length; S.area = (b.w || 0) * (b.h || 0); S.powerNets = (b.nets || []).filter(n => n.cls === 'power').map(n => n.name);
      const u = {}, T = 0.12;
      (b.parts || []).forEach(p => {
        const fp = K.footprint ? K.footprint(p.fp) : null; if (!fp) return; const k = kindOf(p, fp);
        if (k === 'tp' || k === 'fid') return;
        S.parts++; if (fp.kind === 'tht') S.tht++; else { S.smd++; if (p.side === 'bot') S.smdBot++; else S.smdTop++; } if (p.side === 'bot') S.bot++; else S.top++; u[p.fp + '|' + p.value] = 1;
        if ((fp.bodyH || 0) > S.tallest) { S.tallest = fp.bodyH; S.tallRef = p.ref; }
        if (k === 'ic' || k === 'led' || k === 'diode' || k === 'cap_pol') S.pol.push(p.ref);
        if (k === 'ic') { S.ics.push(p.ref); if (/ATMEGA|ATTINY|STM32|ESP|PIC\d|RP2040|MSP430|ARDUINO|NRF|SAMD|MCU/i.test(p.value || '')) S.progIc.push(p.ref); }
        if (k === 'conn') S.conn++;
        if (/QFN|BGA|LGA|DFN/i.test(p.fp)) S.qfn.push(p.ref);
        fp.pads.forEach(pd => {
          if (fp.kind === 'tht') { S.thtPads++; return; }
          S.smdPads++; const w = pd.w, hh = pd.h, m = Math.min(w, hh);
          if (S.minPad == null || m < S.minPad) { S.minPad = m; S.minPadFp = p.fp; }
          const ratio = (w * hh) / (2 * (w + hh) * T); if (S.minRatio == null || ratio < S.minRatio) S.minRatio = ratio;
          S.paste += w * hh * T;
        });
      });
      S.uniq = Object.keys(u).length; return S;
    }
    let planCache = { key: '', plan: null };
    function planKey(b, o) { return [(b.parts || []).length, (b.tracks || []).length, (b.vias || []).length, (b.nets || []).length, b.w, b.h, (b.parts || []).reduce((s, p) => s + (p.x || 0) * 3 + (p.y || 0) + (p.rot || 0) + (p.side === 'bot' ? 7 : 0), 0).toFixed(2), (b.parts || []).map(p => p.ref + p.fp + p.value).join('|'), (b.tracks || []).reduce((s, t) => s + (t.pts || []).length * 7 + (t.w || 0), 0).toFixed(2), JSON.stringify(o)].join('|'); }
    function cachedPlan(b, o) { const k = planKey(b, o); if (planCache.key === k) return planCache.plan; const p = planFlyingProbe(b, o); planCache = { key: k, plan: p }; return p; }

    /* ====================================================================================
       Inhalte: Stationen der Fertigungslinie
       ==================================================================================== */
    const n1 = v => fm(v, 1), n0 = v => String(Math.round(v)), n2 = v => fm(v, 2);
    const STATIONS = [
      {
        id: 'paste', name: 'Lotpastendruck', sub: 'Schablonendrucker', icon: 'stencil',
        what: ['Eine dünne Edelstahlschablone (Stencil) mit Öffnungen genau über den SMD-Pads liegt auf der Platine. Ein Rakel streicht Lotpaste über die Schablone und drückt sie durch die Öffnungen auf die Pads. Lotpaste besteht aus winzigen Lotkügelchen in Flussmittel.',
          'Die Platine wird vor dem Druck über Kameras an den Fiducials (Passmarken) ausgerichtet. Nach dem Druck wird die Schablone abgehoben, die Paste bleibt auf den Pads liegen.'],
        finds: ['Der Drucker selbst prüft meist nichts, aber hier entstehen viele spätere Lötfehler: zu wenig Paste, zu viel Paste, Versatz, Brücken zwischen engen Pads, verschmierte oder verstopfte Öffnungen. Deshalb folgt direkt die SPI.'],
        params: [['Schablonendicke', 'typisch 0,10 bis 0,15 mm (Feinraster dünner)'], ['Öffnungsform', 'meist wie das Pad, bei großen Pads in Fenster aufgeteilt'], ['Pastentyp', 'Körnung Typ 3 oder 4; feinere Pads brauchen feinere Paste'], ['Druckgeschwindigkeit', 'einige zehn mm/s'], ['Lagerung der Paste', 'gekühlt, vor Gebrauch auf Raumtemperatur bringen']],
        pros: ['Alle Pads in einem Durchgang', 'Sehr schnell und gut wiederholbar'], cons: ['Eine Schablone pro Platinenversion (Kosten, Lieferzeit)', 'Sehr kleine Pads drucken schlecht (Flächenverhältnis beachten)', 'Paste ist begrenzt haltbar'],
        board: (b, S) => !S.smdPads ? ['Deine Platine hat keine SMD-Pads: Dieser Schritt entfällt, sie ist reine THT-Technik.'] : ['SMD-Pads: ' + S.smdPads + '. Kleinstes Pad: ' + n2(S.minPad) + ' mm (' + S.minPadFp + ').', 'Pastenmenge je Platine (Öffnungsfläche mal 0,12 mm Schablonendicke): etwa ' + n1(S.paste) + ' mm³.', 'Flächenverhältnis (Öffnungsfläche zur Wandfläche der Öffnung) bei 0,12 mm: kleinster Wert ' + n2(S.minRatio) + (S.minRatio < 0.66 ? '. Als Faustregel sollte es über etwa 0,66 liegen, hier wird der Druck schwierig: dünnere Schablone oder Padgeometrie anpassen.' : '. Das liegt über der Faustregel von etwa 0,66, der Druck sollte gut funktionieren.')]
      },
      {
        id: 'spi', name: 'SPI', sub: 'Lotpasteninspektion 3D', icon: 'spi',
        what: ['Die SPI (Solder Paste Inspection) misst die gedruckte Paste dreidimensional, meist mit Streifenlichtprojektion oder Laser. Für jedes Pad ermittelt sie Höhe, Fläche, Volumen und Versatz.',
          'Die Messwerte werden mit Toleranzfenstern verglichen. Viele Anlagen melden die Abweichungen zusätzlich an den Drucker zurück, der dann nachregelt.'],
        finds: ['Zu wenig oder zu viel Paste (Volumen), fehlende Paste, Versatz gegenüber dem Pad, Brücken zwischen Pasten, verschmierte Ränder, Höhenunterschiede.'],
        params: [['Messgrößen', 'Volumen, Höhe, Fläche, Versatz, Brückenerkennung'], ['Toleranzfenster', 'je Padtyp einstellbar, oft als Prozent vom Sollvolumen'], ['Takt', 'in der Linie meist im Takt der anderen Maschinen (Sekunden pro Platine)'], ['Rückkopplung', 'Messdaten können Drucker regeln']],
        pros: ['Fehler werden früh gefunden: Bei schlechtem Druck wird die Paste abgewaschen und neu gedruckt, kein Bauteil ist verloren', 'Statistik hilft, den Druckprozess stabil zu halten'], cons: ['Zusätzliche Maschine und Programmierung', 'Prüft nur die Paste, nicht den späteren Lötvorgang'],
        board: (b, S) => !S.smdPads ? ['Ohne SMD-Pads gibt es nichts zu prüfen.'] : ['Die SPI prüft etwa ' + S.smdPads + ' Pastendepots mit zusammen rund ' + n1(S.paste) + ' mm³ Sollvolumen.', S.minPad < 0.5 ? 'Dein kleinstes Pad (' + n2(S.minPad) + ' mm) ist ein typischer Kandidat für zu wenig Paste: Hier schaut die SPI besonders genau hin.' : 'Alle Pads sind größer als 0,5 mm in der kleinsten Kante: unkritisch für den Pastendruck.']
      },
      {
        id: 'pnp', name: 'Bestückautomat', sub: 'Pick and Place', icon: 'pnp',
        what: ['Ein Bestückkopf nimmt die Bauteile mit Vakuumpipetten aus den Zuführungen (Gurte, Stangen, Trays), prüft sie mit einer Kamera auf Lage und Drehung und setzt sie auf die Paste. Die Paste hält die Bauteile bis zum Löten fest.',
          'Das Programm entsteht aus den Bestückungsdaten (Pick-and-Place-Datei: Referenz, Position x/y, Drehung, Seite) und der Stückliste. Jede Bauteilsorte braucht einen Platz (Feeder) an der Maschine.'],
        finds: ['Bauteile, die nicht aufgenommen werden konnten, werden von der Kamera erkannt und aussortiert. Falsch eingelegte Rollen (falscher Wert) erkennt die Maschine nur, wenn sie das Bauteil erkennen kann, deshalb sind Rüsten und Kontrolle der Rollen wichtig.'],
        params: [['Leistung', 'je nach Maschinentyp einige tausend bis über hunderttausend Bauteile pro Stunde'], ['Genauigkeit', 'deutlich besser als 0,1 mm'], ['Rüsten', 'Rollen und Stangen in Feeder einsetzen, Rüstzeit zählt bei kleinen Losen stark'], ['Drehung', 'aus der Pick-and-Place-Datei, Polarität muss zum Bauteilgurt passen']],
        pros: ['Schnell und genau, auch bei 0402 und feinem Raster', 'Wiederholbar'], cons: ['Rüstaufwand bei vielen Bauteilsorten', 'Falsche Drehung in den Daten (z. B. bei ICs) wird millionenfach wiederholt, bis jemand es merkt'],
        board: (b, S) => !S.smd ? ['Keine SMD-Bauteile: Der Bestückautomat wird nicht gebraucht.'] : ['SMD-Bauteile: ' + S.smd + ' (Oberseite ' + S.smdTop + ', Unterseite ' + S.smdBot + '), verschiedene Bauteilsorten: ' + S.uniq + ' (so viele Feeder-Plätze brauchst du höchstens).', 'Bei beispielhaften 10 000 Bauteilen pro Stunde dauert die Bestückung etwa ' + n1(S.smd / 10000 * 3600) + ' s pro Platine.', S.smdBot ? 'Es gibt SMD-Bauteile auf der Unterseite: die Platine läuft durch Druck, Bestückung und Reflow zweimal (eine Seite je Durchgang).' : 'Alle SMD-Teile liegen auf einer Seite: ein Durchlauf genügt.']
      },
      {
        id: 'reflow', name: 'Reflow-Ofen', sub: 'Lötofen', icon: 'oven',
        what: ['Die bestückte Platine läuft auf einem Band durch mehrere Heizzonen. Das Temperaturprofil hat vier Abschnitte: Vorwärmen, Soak (Flussmittel aktiviert, Temperatur gleicht sich aus), Reflow-Spitze (Lot schmilzt) und Abkühlen.',
          'Bleifreies Lot (z. B. SAC305) schmilzt bei etwa 217 °C. Die Spitzentemperatur liegt meist im Bereich von etwa 235 bis 250 °C. Durch die Oberflächenspannung zieht das flüssige Lot die Bauteile auf die Pads (Selbstzentrierung).'],
        finds: ['Der Ofen prüft die Platine nicht. Das Profil wird mit einem Profiler (Thermoelemente auf einer Testplatine) kontrolliert. Fehler zeigen sich erst danach: Tombstones (Grabsteine), Lötbrücken, Zinnperlen, kalte Lötstellen, Lunker, Benetzungsfehler.'],
        params: [['Zeit über Liquidus', 'etwa 40 bis 90 s'], ['Aufheizrate', 'typisch bis etwa 3 °C pro Sekunde'], ['Spitze (bleifrei)', 'etwa 235 bis 250 °C'], ['Atmosphäre', 'Luft oder Stickstoff (weniger Oxidation)']],
        pros: ['Tausende Lötstellen gleichzeitig', 'Gleichmäßig, wiederholbar'], cons: ['Alle Bauteile müssen die Temperatur aushalten (viele Stecker und Elkos nicht)', 'Ungleiche Erwärmung führt zu Tombstones, besonders bei kleinen Chipbauteilen'],
        board: (b, S) => !S.smd ? ['Ohne SMD-Teile braucht deine Platine keinen Reflow-Ofen, sondern Welle oder Handlöten.'] : [S.smdBot ? 'Doppelseitig SMD-bestückt: Zuerst wird meist die Seite mit den leichteren, kleineren Bauteilen gelötet. Beim zweiten Durchgang hängen die Teile der ersten Seite kopfüber, die Oberflächenspannung des Lots hält sie.' : 'Einseitig SMD: ein Reflow-Durchgang.', S.tht ? 'THT-Bauteile (' + S.tht + ') gehören nicht in den Ofen, sie werden danach gelötet.' : 'Keine THT-Bauteile.', 'Höchstes Bauteil: ' + S.tallRef + ' mit ' + n0(S.tallest) + ' mm.']
      },
      {
        id: 'aoi', name: 'AOI', sub: 'Automatische Optische Inspektion', icon: 'aoi',
        what: ['Kameras mit farbigem, schräg einfallendem Licht fotografieren die Platine von oben. Die Software vergleicht die Bilder mit Regeln und einem Referenzmuster (Golden Board oder CAD-Daten) und bewertet jedes Bauteil und jede Lötstelle.',
          'Die AOI kann nach dem Pastendruck, vor dem Reflow oder (am häufigsten) nach dem Reflow stehen.'],
        finds: ['Fehlende, verschobene und verdrehte Bauteile, falsche Bauteile (nach Bauform und Aufdruck), falsche Polarität, Tombstones, Lötbrücken, zu wenig Lot, abgehobene Anschlüsse, Fremdkörper.'],
        params: [['Auflösung', 'je nach Gerät grob 10 bis 25 µm pro Bildpunkt'], ['Referenz', 'CAD- und Pick-and-Place-Daten, Bibliothek der Bauteilbilder oder Golden Board'], ['Takt', 'Sekunden bis eine Minute pro Platine'], ['Fehlalarme', 'sogenannte Pseudofehler: Ein Mitarbeiter prüft die markierten Stellen am Monitor']],
        pros: ['Schnell, berührungslos, kein Adapter', 'Sehr gut bei Fehlteilen, Polarität, Brücken und Verdrehung', 'Prüfprogramm entsteht aus den Bestückdaten'], cons: ['Sieht nur, was sichtbar ist: nicht unter BGA und QFN, nicht in Bohrungen', 'Kann keine elektrischen Werte messen', 'Pseudofehler kosten Zeit; Programmierung braucht Erfahrung'],
        board: (b, S) => !S.parts ? ['Noch keine Bauteile auf der Platine.'] : ['Bauteile mit Polarität oder Pin-1-Markierung (hier ist die AOI besonders wertvoll): ' + (S.pol.length ? S.pol.join(', ') : 'keine') + '.', S.qfn.length ? 'Verdeckte Anschlüsse unter ' + S.qfn.join(', ') + ': die AOI sieht sie nicht, hier hilft die AXI.' : 'Alle Lötstellen sind seitlich einsehbar (kein BGA oder QFN).', 'Bauteilhöhen bis ' + n0(S.tallest) + ' mm (' + S.tallRef + ') werfen Schatten: Hohe Bauteile können dahinterliegende Teile verdecken.']
      },
      {
        id: 'axi', name: 'Röntgen (AXI)', sub: 'Automatische Röntgeninspektion', icon: 'axi', optional: true,
        what: ['Die AXI durchleuchtet die Platine mit Röntgenstrahlen. Lot und Kupfer absorbieren stark und erscheinen dunkel, Silizium und Kunststoff kaum. So werden Lötstellen sichtbar, die von der Seite nicht einsehbar sind, etwa unter BGA und QFN.',
          'Es gibt 2D-Verfahren (Durchstrahlung) und 3D-Verfahren (Schichtbilder, Laminographie oder CT). Anlagen stehen in abgeschirmten Gehäusen.'],
        finds: ['Lunker (Voids) in Lötstellen und unter Kühlflächen, Brücken und offene Stellen unter BGA und QFN, fehlende Lotkugeln, Head-in-Pillow (Kugel und Paste verbinden sich nicht), Lochfüllung bei THT.'],
        params: [['Verfahren', '2D, 2,5D oder 3D (Schichtbilder)'], ['Zeit', 'oft deutlich länger als AOI; 3D dauert länger als 2D'], ['Einsatz', 'häufig nur für kritische Bauteile oder als Stichprobe'], ['Schutz', 'Strahlenschutz durch geschlossene Anlage']],
        pros: ['Einzige Möglichkeit, verdeckte Lötstellen zerstörungsfrei zu sehen', 'Misst Lunker und Brücken sehr gut'], cons: ['Teuer in Anschaffung und Betrieb', 'Langsamer als AOI, deshalb oft nur Stichprobe', 'Sagt nichts über die Funktion'],
        board: (b, S) => S.qfn.length ? ['Deine Platine hat verdeckte Lötstellen: ' + S.qfn.join(', ') + '. Hier lohnt sich die AXI, zumindest für die Erstmuster.'] : ['Deine Platine hat keine BGA oder QFN. Die AXI ist deshalb hier meist nicht nötig, die AOI genügt für die Lötstellen.']
      },
      {
        id: 'tht', name: 'THT: Hand, Welle, Selektiv', sub: 'bedrahtete Bauteile', icon: 'wave', optional: true,
        what: ['Bedrahtete Bauteile (THT) werden von Hand oder mit Bestückautomaten für Axial- und Radialteile eingesetzt. Dann wird gelötet:',
          'Wellenlöten: Die Platine läuft über eine stehende Lotwelle (Bad bei bleifreiem Lot um 260 °C). SMD-Teile auf der Lötseite müssen vorher aufgeklebt sein und werden mit durch die Welle geführt.',
          'Selektivlöten: Eine kleine Düse fährt nur die THT-Stellen an. Das schont SMD-Teile auf der Lötseite und ist die übliche Wahl bei gemischter Bestückung.',
          'Handlöten: Mit dem Lötkolben für Einzelstücke, Nacharbeit und Bauteile, die nicht maschinell passen.'],
        finds: ['Lötbrücken zwischen Anschlüssen, unvollständige Lochfüllung, kalte Lötstellen, Zinnperlen, Bauteile falsch herum oder schief. Das wird mit AOI oder per Sichtprüfung kontrolliert.'],
        params: [['Lötbadtemperatur', 'bleifrei etwa 255 bis 265 °C'], ['Kontaktzeit', 'wenige Sekunden pro Stelle'], ['Flussmittel', 'wird vor dem Löten aufgetragen, Platine wird vorgeheizt'], ['Handlötung', 'Kolbenspitze etwa 330 bis 380 °C (bleifrei), je nach Spitze und Wärmebedarf']],
        pros: ['Mechanisch sehr belastbare Verbindungen (Stecker, Elkos, Klemmen)', 'Handlöten ist flexibel für Prototypen und Reparatur'], cons: ['Langsamer und weniger automatisiert als SMD', 'Wellenlöten braucht Lötrahmen oder Kleber und passende Abstände', 'Handarbeit streut mehr'],
        board: (b, S) => !S.tht ? ['Keine THT-Bauteile: Dieser Schritt entfällt.'] : ['THT-Bauteile: ' + S.tht + ' mit zusammen ' + S.thtPads + ' Lötstellen.', S.smd ? 'Gemischte Bestückung (SMD und THT): Üblich ist SMD zuerst per Reflow, danach THT per Selektivlöten oder von Hand.' : 'Reine THT-Platine: Handbestückung, dann Wellen- oder Handlöten.', 'Höchstes Teil: ' + S.tallRef + ' (' + n0(S.tallest) + ' mm): Das legt die Durchlaufhöhe und die Abstände für Prüfnadeln fest.']
      },
      {
        id: 'test', name: 'ICT oder Flying Probe', sub: 'elektrische Prüfung', icon: 'probe', variant: true,
        what: ['In-Circuit-Test (ICT): Die Platine liegt auf einem Prüfadapter (Nadelbett) mit hunderten Federkontaktstiften. Per Vakuum oder Druckplatte wird sie auf alle Stifte gleichzeitig gedrückt. Die Messtechnik misst parallel Durchgang, Kurzschlüsse, Bauteilwerte, Dioden und mehr. Dauer: Sekunden.',
          'Flying Probe: Zwei bis acht bewegliche Nadeln fahren die Messpunkte nacheinander an. Es wird kein Adapter gebraucht, dafür dauert eine Platine Minuten. Details siehst du im Reiter "Flying Probe" und im Simulator.'],
        finds: ['Unterbrechungen (Open), Kurzschlüsse (Short), falsche Werte bei Widerständen, Kondensatoren und Spulen, falsch gepolte Dioden und LEDs, fehlende Bauteile. Verdrehte ICs oft über die Schutzdioden. Nicht: Funktion im Betrieb (dafür der Funktionstest).'],
        params: [['ICT Testpunkte', 'etwa 0,8 bis 1,0 mm Durchmesser, Nadelraster 100 mil (2,54 mm), 75 mil oder 50 mil'], ['ICT Zeit', 'Sekunden pro Platine'], ['Flying Probe Nadeln', '2 bis 8, ohne Adapter'], ['Flying Probe Zeit', 'Minuten pro Platine (Modell im Simulator)']],
        pros: ['ICT: sehr schnell, hohe Abdeckung, ideal für Großserien', 'Flying Probe: keine Adapterkosten, schnell programmiert, ideal für Prototypen, Kleinserien und viele Varianten'], cons: ['ICT: Adapter ist teuer und gilt nur für eine Platinenversion', 'Flying Probe: langsam und mit Nadelkontakt belastet es die Pads mechanisch', 'Beide brauchen Zugang zu den Netzen (Testpunkte)'],
        board: null
      },
      {
        id: 'prog', name: 'Programmieren', sub: 'Flashen von Firmware', icon: 'chip',
        what: ['Mikrocontroller und Speicher bekommen ihre Firmware. Das geschieht über die Programmierschnittstelle (z. B. JTAG oder SWD) oder über einen seriellen Bootloader, häufig mit Nadeladapter am Prüfplatz. Anschließend wird der Speicher zurückgelesen und verglichen (Verify).',
          'Oft werden dabei Seriennummer, Kalibrierwerte und Gerätekonfiguration mitgeschrieben. Bauteile können auch vorprogrammiert eingekauft werden.'],
        finds: ['Der Baustein antwortet nicht (Lötfehler an den Programmierpins, defekter Chip), Verify-Fehler, falsche Konfiguration.'],
        params: [['Dauer', 'von Sekunden bis Minuten, je nach Speichergröße'], ['Schnittstellen', 'JTAG, SWD, serieller Bootloader'], ['Sicherheit', 'Schreibschutz und Rückverfolgung (welche Firmware auf welcher Platine)']],
        pros: ['Eine Hardware für viele Produktvarianten', 'Datenlogging (Seriennummer) möglich'], cons: ['Lange Programmierzeit kann den Takt bestimmen (mehrere Platinen parallel programmieren)', 'Programmierpins brauchen Zugang'],
        board: (b, S) => S.progIc.length ? ['Programmierbare Bausteine erkannt: ' + S.progIc.join(', ') + '. Plane einen Programmieranschluss mit Zugang ein.'] : S.ics.length ? ['ICs: ' + S.ics.join(', ') + '. Wenn einer davon Firmware braucht, brauchst du Programmieranschlüsse (z. B. Pfostenstecker oder Testpunkte).'] : ['Keine ICs auf der Platine: Ein Programmierschritt ist hier nicht nötig.']
      },
      {
        id: 'fct', name: 'Funktionstest (FCT)', sub: 'Prüfung wie im Gerät', icon: 'fct',
        what: ['Die Platine wird mit Betriebsspannung versorgt und so benutzt, wie sie im Gerät arbeitet: Spannungen und Ströme messen, Taktsignale prüfen, Schnittstellen (z. B. UART, I2C, USB), Sensoren, Ein- und Ausgänge, Anzeigen. Die Ergebnisse werden mit Grenzwerten verglichen.',
          'Entscheidend ist das Ergebnis: Die Platine muss ihre Aufgabe erfüllen. Ein Funktionstest braucht ein auf das Produkt zugeschnittenes Prüfsystem (Adapter, Netzteile, Messgeräte, Software).'],
        finds: ['Fehlfunktionen, falsche Spannungen, Abgleichfehler, Softwareprobleme, Zusammenspiel der Baugruppen, Wackelkontakte, die beim reinen Messen nicht auffielen.'],
        params: [['Versorgung', 'Netzteil mit Strombegrenzung, damit Fehler nicht zum Schaden werden'], ['Messen', 'Spannungen, Ströme, Frequenzen, Protokolle'], ['Dauer', 'Sekunden bis Minuten je nach Produkt'], ['Ergebnis', 'Gut, Schlecht oder Nacharbeit; Messwerte werden zur Rückverfolgung gespeichert']],
        pros: ['Nähe zur Realität: Es testet, was der Kunde braucht', 'Findet auch Fehler, die kein Netz- oder Bauteiltest sieht'], cons: ['Aufwändig zu entwickeln und pro Produkt neu', 'Findet den Fehler, aber nicht immer die Stelle (Diagnose ist schwer)', 'Setzt voraus, dass die Platine bereits gut gelötet ist'],
        board: (b, S) => ['Versorgungsnetze deiner Platine: ' + (S.powerNets.length ? S.powerNets.join(', ') : 'keine als Versorgung markiert') + '. Beim Funktionstest werden sie versorgt und gemessen.', S.conn ? 'Steckverbinder (' + S.conn + '): sie dienen als Anschlüsse für den Prüfadapter.' : 'Keine Steckverbinder: Für den Funktionstest brauchst du Testpunkte oder Nadeln an den Signalen.']
      },
      {
        id: 'pack', name: 'Endkontrolle und Verpackung', sub: 'Rückverfolgbarkeit', icon: 'box',
        what: ['Zum Schluss folgen Sichtprüfung (nach IPC-A-610: Klasse 1 allgemeine Elektronik, Klasse 2 Elektronik mit höherer Lebensdauer und Betriebsanforderung, Klasse 3 Hochleistungselektronik mit höchsten Anforderungen) und die ESD-gerechte Verpackung.',
          'Auf jeder Platine oder Packung steht eine Seriennummer oder Charge. Damit lassen sich Prüfdaten, Bauteilchargen und Prozessdaten später zuordnen (Rückverfolgbarkeit).'],
        finds: ['Transport- und Handhabungsschäden, fehlende Etiketten, Verwechslungen, Verschmutzung.'],
        params: [['ESD-Schutz', 'antistatische Beutel, Trays oder Schaumstoff'], ['Kennzeichnung', 'Seriennummer, Datum, Version, Barcode oder Datamatrix'], ['Dokumentation', 'Prüfprotokoll mit der Platine verknüpft']],
        pros: ['Schützt vor Ausfällen durch statische Aufladung', 'Rückverfolgbarkeit hilft bei Reklamationen'], cons: ['Zusätzlicher Aufwand ohne eigene Wertschöpfung', 'Schlechte Verpackung kann gute Platinen zerstören'],
        board: (b, S) => ['Platinengröße ' + n1(b.w || 0) + ' x ' + n1(b.h || 0) + ' mm. In der Serie werden mehrere Platinen in einem Nutzen (Panel) gefertigt und am Ende getrennt, Fiducials und Testpunkte müssen darauf abgestimmt sein.']
      }
    ];
    const DEFECTS = [
      { id: 'none', name: 'Gute Platine', desc: 'Alles in Ordnung: Die Platine läuft durch alle Stationen.', catchers: [] },
      { id: 'paste', name: 'Zu wenig Lotpaste an einem Pad', desc: 'Eine Schablonenöffnung war verstopft, auf dem Pad liegt kaum Paste.', catchers: ['spi', 'aoi', 'test', 'fct'], hit: { spi: 'Volumen des Depots weit unter dem Sollbereich.', aoi: 'Die Lötstelle ist dünn und ohne Meniskus.', test: 'Das Pad ist nicht sicher verbunden: Durchgangsmessung offen.', fct: 'Die Schaltung zeigt eine Fehlfunktion.' } },
      { id: 'tomb', name: 'Tombstone (Grabstein) an einem Chip-Bauteil', desc: 'Ein Ende des Bauteils schmolz früher, das Bauteil stellte sich auf.', catchers: ['aoi', 'test', 'fct'], hit: { aoi: 'Bauteil steht schräg, ein Anschluss ist nicht verlötet.', test: 'Bauteil misst offen.', fct: 'Die Schaltung funktioniert nicht richtig.' } },
      { id: 'pol', name: 'Elko verpolt', desc: 'Ein gepolter Kondensator wurde um 180 Grad gedreht bestückt.', catchers: ['aoi', 'fct'], hit: { aoi: 'Polaritätsmarkierung zeigt zur falschen Seite.', fct: 'Elko wird heiß oder die Spannung bricht ein.' } },
      { id: 'qfn', name: 'Lötbrücke unter einem QFN', desc: 'Zwischen zwei Pads unter dem Gehäuse ist Lot zusammengeflossen.', catchers: ['axi', 'test', 'fct'], hit: { axi: 'Im Röntgenbild verbindet Lot zwei Pads unter dem Bauteil.', test: 'Isolationsmessung zwischen den Netzen zeigt Kurzschluss (nur wenn beide Netze erreichbar sind).', fct: 'Die Schaltung zeigt Kurzschluss oder Fehlfunktion.' } },
      { id: 'open', name: 'Unterbrechung im Netz', desc: 'Eine Leiterbahn ist unterbrochen (Haarriss im Kupfer oder abgerissene Via).', catchers: ['test', 'fct'], hit: { test: 'Durchgangsmessung im Netz: offen.', fct: 'Ein Teil der Schaltung bekommt kein Signal.' } },
      { id: 'value', name: 'Falscher Widerstandswert', desc: 'Auf einer Rolle lag der falsche Wert, die Maschine hat ihn bestückt.', catchers: ['test', 'fct'], hit: { test: 'Der gemessene Widerstand weicht deutlich vom Sollwert ab.', fct: 'Ein Messwert liegt außerhalb der Grenzen.' } },
      { id: 'fw', name: 'Falsche Firmware', desc: 'Auf dem Mikrocontroller liegt eine veraltete Version.', catchers: ['fct'], hit: { fct: 'Die Versionsabfrage und das Verhalten passen nicht zur Sollversion.' } }
    ];
    const STATION_ICON = { stencil: '▦', spi: '◬', pnp: '✥', oven: '≋', aoi: '◉', axi: '☢', wave: '≈', probe: '⌖', chip: '▣', fct: '⚡', box: '▤' };

    /* ---------- Glossar ---------- */
    const GLOSSARY = [
      ['AOI', 'Automatische Optische Inspektion: Kameras vergleichen die Platine mit einem Muster und finden fehlende, verdrehte oder schlecht gelötete Bauteile.'],
      ['AXI', 'Automatische Röntgeninspektion: durchleuchtet Lötstellen, die man von außen nicht sieht (BGA, QFN), und misst Lunker.'],
      ['Boundary Scan', 'Prüfverfahren nach IEEE 1149.1 (JTAG): Spezielle Zellen an den Pins von ICs prüfen Verbindungen zwischen ICs, ohne dass Nadeln an die Pins müssen.'],
      ['BSDL', 'Boundary Scan Description Language: Beschreibungsdatei eines JTAG-fähigen ICs für das Prüfprogramm.'],
      ['Burn-in', 'Betrieb unter erhöhter Temperatur und Spannung für eine bestimmte Zeit, damit Frühausfälle schon beim Hersteller auftreten.'],
      ['DFM', 'Design for Manufacturing: fertigungsgerechtes Entwickeln (Abstände, Pads, Fiducials, Bauteilauswahl).'],
      ['DFT', 'Design for Test: prüfgerechtes Entwickeln. Testpunkte, Zugang, Abstände, Programmieranschlüsse und Boundary-Scan-Kette einplanen.'],
      ['DPMO', 'Defects per Million Opportunities: Fehler je eine Million Fehlermöglichkeiten (Lötstellen, Bauteile). DPMO = Fehler geteilt durch (Platinen mal Möglichkeiten je Platine) mal 1 000 000.'],
      ['ESS', 'Environmental Stress Screening: Beanspruchung durch Temperaturwechsel, Vibration oder Feuchte, um fehlerhafte Baugruppen vor der Auslieferung auszusondern.'],
      ['FCT', 'Functional Test (Funktionstest): Prüfung der Platine im Betrieb, so wie sie im Gerät arbeitet.'],
      ['Fiducial', 'Passmarke: kleine runde Kupferfläche (häufig 1 mm Durchmesser) mit freier Umgebung. Kameras von Drucker, Bestücker und AOI richten sich daran aus.'],
      ['First-Pass-Yield', 'Anteil der Platinen, die den Test beim ersten Durchlauf bestehen, ohne Nacharbeit. 95 % heißt: 5 von 100 brauchen Nacharbeit.'],
      ['Flying Probe', 'Fliegende Nadeln: bewegliche Prüfnadeln fahren Messpunkte an, ohne Prüfadapter. Ideal für Prototypen und Kleinserien.'],
      ['Golden Board', 'Eine geprüfte, fehlerfreie Referenzplatine, an der AOI oder Testsysteme die Sollwerte lernen.'],
      ['Guard', 'Schutzpotenzial beim Messen eines Bauteils in der Schaltung: Ein weiterer Messpunkt wird auf das passende Potenzial gelegt, damit parallele Pfade das Ergebnis nicht verfälschen.'],
      ['ICT', 'In-Circuit-Test: Test auf einem Nadelbett-Adapter, der viele Punkte gleichzeitig kontaktiert. Sehr schnell, aber mit teurem Adapter.'],
      ['IPC-A-610', 'Richtlinie "Abnahmekriterien für elektronische Baugruppen". Beschreibt mit Bildern, wann eine Lötstelle oder Bestückung gut ist. Es gibt die Klassen 1 bis 3.'],
      ['JTAG', 'Schnittstelle nach IEEE 1149.1 für Boundary Scan, Programmieren und Debuggen. Standardsignale: TCK, TMS, TDI, TDO.'],
      ['Kelvin-Messung', 'Vierleitermessung: Zwei Nadeln leiten den Strom ein, zwei andere messen die Spannung direkt am Bauteil. Der Widerstand der Zuleitungen fällt dadurch heraus.'],
      ['Lunker (Void)', 'Gaseinschluss in der Lötstelle. Er verringert die Fläche für Strom und Wärme und ist im Röntgenbild zu sehen.'],
      ['Nadelbett', 'Prüfadapter mit einem Raster aus Federkontaktstiften, auf die die Platine gedrückt wird, um viele Testpunkte gleichzeitig zu kontaktieren.'],
      ['Netzliste', 'Liste aller Verbindungen: Welche Pins gehören zum selben Netz. Aus ihr entstehen Layout-Prüfung und Testprogramm.'],
      ['Open und Short', 'Open: Verbindung unterbrochen, die nicht sein dürfte. Short: Kurzschluss, eine Verbindung, die nicht sein dürfte.'],
      ['Panel (Nutzen)', 'Mehrere Platinen auf einer Fertigungstafel, durch Stege oder Ritzen verbunden und erst nach Bestückung, Löten und oft auch Test getrennt.'],
      ['Prüfadapter', 'Mechanische Aufnahme für die Platine im Test: Nadelbett beim ICT oder Haltevorrichtung mit Kontaktstiften beim Funktionstest.'],
      ['Pseudofehler', 'Falschmeldung der AOI: Die Software markiert ein Bauteil als fehlerhaft, obwohl es gut ist. Kostet Zeit durch Nachprüfung.'],
      ['Rework', 'Nacharbeit: Fehlerhafte Platinen werden repariert, z. B. Bauteil tauschen, Brücke entfernen, nachlöten.'],
      ['Schlupf', 'Fehlerhafte Platine, die alle Prüfungen bestanden hat und ausgeliefert wird. Das Gegenteil von sicherer Prüfabdeckung.'],
      ['SPI', 'Solder Paste Inspection: 3D-Messung der gedruckten Lotpaste (Volumen, Höhe, Versatz).'],
      ['TAP', 'Test Access Port: Anschluss des Boundary Scan mit den Signalen TCK (Takt), TMS (Steuerung), TDI (Dateneingang), TDO (Datenausgang), optional TRST (Reset).'],
      ['Testpunkt', 'Kupferfläche oder Via, die nur dem Messen dient: Hier kann eine Nadel das Netz berühren. Sie sollte frei, groß genug und mit Lötstopp-Öffnung sein.'],
      ['Tombstone', 'Grabstein: Ein Chip-Bauteil richtet sich beim Löten an einem Ende auf, weil ein Ende früher schmilzt.'],
      ['Traceability', 'Rückverfolgbarkeit: Seriennummern verbinden Platine, Bauteilchargen, Prozessdaten und Prüfergebnis.']
    ];

    /* ====================================================================================
       Inhalte: Flying Probe, Verfahren, Vergleich, Quiz
       ==================================================================================== */
    const FIG_PRINCIPLE = `<svg class="pt-fig" viewBox="0 0 520 240" role="img" aria-label="Flying Probe: zwei bewegliche Nadeln auf Linearachsen über der Platine">
<rect x="20" y="8" width="480" height="12" rx="3" fill="#3a4452"/><text x="28" y="18" fill="#c9d2dc" font-size="10">X-Achse (Schiene)</text>
<rect x="128" y="4" width="26" height="20" rx="3" fill="#3b9eff"/><rect x="138" y="24" width="6" height="86" fill="#3b9eff"/><path d="M137 110 L145 110 L141 130 Z" fill="#e8edf2"/>
<rect x="322" y="4" width="26" height="20" rx="3" fill="#ff9f43"/><rect x="332" y="24" width="6" height="116" fill="#ff9f43"/><path d="M331 140 L339 140 L335 160 Z" fill="#e8edf2"/>
<rect x="34" y="110" width="452" height="120" rx="6" fill="#14532d" stroke="#2f7a4b"/>
<g stroke="#d9a441" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M141 132 L141 185 L260 185 L335 185 L335 162"/><path d="M70 150 L70 205 L190 205"/><path d="M400 140 L400 205 L450 205"/></g>
<g fill="#d9a441"><rect x="133" y="128" width="16" height="10" rx="2"/><rect x="327" y="158" width="16" height="10" rx="2"/><rect x="62" y="146" width="16" height="10" rx="2"/><rect x="392" y="136" width="16" height="10" rx="2"/><rect x="182" y="200" width="16" height="10" rx="2"/><rect x="442" y="200" width="16" height="10" rx="2"/></g>
<rect x="215" y="160" width="46" height="22" rx="3" fill="#222" stroke="#555"/><text x="224" y="175" fill="#aaa" font-size="10">R1</text>
<text x="150" y="104" fill="#9ccaff" font-size="11">Nadel 1</text><text x="352" y="150" fill="#ffc78a" font-size="11">Nadel 2</text>
<text x="170" y="226" fill="#bfe8cd" font-size="11">Netz A: Durchgang zwischen den Spitzen?</text>
<path d="M150 60 C 230 40, 300 40, 322 60" stroke="#8b97a3" stroke-width="1.5" fill="none" stroke-dasharray="4 3"/><text x="188" y="48" fill="#c9d2dc" font-size="10">Messung zwischen Nadel 1 und 2</text>
</svg>`;
    const FIG_KELVIN = `<svg class="pt-fig" viewBox="0 0 520 220" role="img" aria-label="Kelvin-Messung mit vier Nadeln an einem kleinen Widerstand">
<rect x="20" y="130" width="480" height="80" rx="6" fill="#14532d" stroke="#2f7a4b"/>
<rect x="150" y="150" width="30" height="24" rx="2" fill="#d9a441"/><rect x="340" y="150" width="30" height="24" rx="2" fill="#d9a441"/><rect x="176" y="154" width="168" height="16" rx="3" fill="#222" stroke="#666"/><text x="236" y="166" fill="#aaa" font-size="11">Rx klein</text>
<g stroke-width="3"><path d="M158 150 L136 100" stroke="#3b9eff"/><path d="M172 150 L182 100" stroke="#ff9f43"/><path d="M348 150 L370 100" stroke="#3b9eff"/><path d="M362 150 L340 100" stroke="#ff9f43"/></g>
<text x="104" y="96" fill="#9ccaff" font-size="11">Strom F+</text><text x="176" y="92" fill="#ffc78a" font-size="11">Sense S+</text><text x="346" y="92" fill="#ffc78a" font-size="11">Sense S−</text><text x="368" y="104" fill="#9ccaff" font-size="11">Strom F−</text>
<path d="M136 100 L136 40 L370 40 L370 100" fill="none" stroke="#3b9eff" stroke-width="2"/><circle cx="253" cy="40" r="16" fill="#14181c" stroke="#3b9eff" stroke-width="2"/><text x="248" y="45" fill="#9ccaff" font-size="14">I</text>
<path d="M182 100 L182 66 L340 66 L340 100" fill="none" stroke="#ff9f43" stroke-width="2"/><circle cx="260" cy="66" r="13" fill="#14181c" stroke="#ff9f43" stroke-width="2"/><text x="255" y="71" fill="#ffc78a" font-size="13">V</text>
<text x="40" y="205" fill="#bfe8cd" font-size="11">Die Spannung wird direkt an Rx gemessen: Der Widerstand der Strom-Nadeln fällt heraus.</text>
</svg>`;
    const FIG_GUARD = `<svg class="pt-fig" viewBox="0 0 520 230" role="img" aria-label="Guard-Technik: Messung von Rx mit parallelem Pfad über R2 und R3">
<g stroke="#d9a441" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M90 70 L190 70"/><path d="M290 70 L430 70"/><path d="M90 70 L90 160 L170 160"/><path d="M250 160 L260 160 L260 160"/><path d="M430 70 L430 160 L350 160"/></g>
<rect x="190" y="56" width="100" height="28" rx="3" fill="#222" stroke="#777"/><text x="224" y="75" fill="#bbb" font-size="12">Rx (gesucht)</text>
<rect x="170" y="146" width="80" height="28" rx="3" fill="#222" stroke="#777"/><text x="200" y="165" fill="#bbb" font-size="12">R2</text>
<rect x="270" y="146" width="80" height="28" rx="3" fill="#222" stroke="#777"/><text x="300" y="165" fill="#bbb" font-size="12">R3</text>
<path d="M250 160 L270 160" stroke="#d9a441" stroke-width="3"/>
<circle cx="90" cy="70" r="7" fill="#3b9eff"/><text x="76" y="52" fill="#9ccaff" font-size="12">A (Strom ein)</text>
<circle cx="430" cy="70" r="7" fill="#3b9eff"/><text x="392" y="52" fill="#9ccaff" font-size="12">B (Strom aus)</text>
<circle cx="260" cy="160" r="7" fill="#4cd964"/><path d="M260 167 L260 205" stroke="#4cd964" stroke-width="2"/><text x="270" y="202" fill="#7fe597" font-size="12">G: Guard, auf Potenzial von B</text>
<text x="20" y="224" fill="#c9d2dc" font-size="11">Über R3 liegt keine Spannung, der Strom durch R2 fließt in den Guard: Gemessen wird nur Rx.</text>
</svg>`;

    const FP_SECTIONS = [
      { t: 'Funktionsprinzip', open: true, html: `<p>Ein Flying-Probe-Tester (Tester mit fliegenden Nadeln) hat <b>zwei bis acht bewegliche Prüfnadeln</b>. Jede Nadel hängt an einem Schlitten, der auf <b>Linearachsen</b> (X und Y) verfährt und zum Kontaktieren abgesenkt wird (Z). Die Platine liegt in einer einfachen Aufnahme, es gibt <b>keinen Prüfadapter</b>.</p>${FIG_PRINCIPLE}<p>Die Maschine fährt die Testpunkte und Pads <b>der Reihe nach</b> an, setzt die Nadeln auf und misst zwischen zwei (oder mehr) Nadeln. Welche Messung wo gemacht wird, steht im Testprogramm.</p>
<h4>Was wird gemessen?</h4><ul><li><b>Durchgang (Open):</b> Sind alle Punkte eines Netzes miteinander verbunden, wie es die Netzliste verlangt?</li><li><b>Isolation (Short):</b> Sind verschiedene Netze voneinander getrennt?</li><li><b>Bauteilwerte:</b> Widerstände, Kondensatoren und Spulen; Dioden und LEDs mit ihrer Flussspannung.</li><li><b>Transistoren und ICs:</b> Über Messungen an den Pins, vor allem an den Schutzdioden der ICs. So lässt sich sehen, ob ein Bauteil vorhanden ist und wie es sitzt.</li><li><b>Je nach Maschine:</b> Spannungsmessung und einfache Funktionsprüfung mit angelegter Versorgungsspannung.</li></ul>` },
      { t: 'Ablauf: vom Testprogramm zum Protokoll', html: `<ol><li><b>Daten sammeln:</b> Netzliste aus dem CAD, Bestückungsdaten (Pick-and-Place), Stückliste und Gerber-Daten. Die Software weiß damit für jedes Pad: Netz, Position und Bauteilwert.</li><li><b>Testprogramm erzeugen:</b> Die Software bestimmt, welche Punkte erreichbar sind (Seite, Bauteile im Weg), plant die Messungen (Durchgang je Netz, Isolation gegen Nachbarnetze, Bauteilmessungen) und ordnet sie so, dass die Verfahrwege kurz bleiben.</li><li><b>Ausrichten:</b> Die Platine wird über Fiducials mit einer Kamera ausgerichtet, damit die Nadeln die Pads treffen.</li><li><b>Prüfen:</b> Die Nadeln fahren, messen und vergleichen jeden Wert mit Sollwert und Toleranz.</li><li><b>Protokoll:</b> Für jeden Messschritt werden Netz oder Bauteil, Messwert, Soll, Ergebnis und Position gespeichert. Daraus entstehen die Fehlerliste für die Nacharbeit und die Statistik (z. B. First-Pass-Yield).</li></ol><div class="pt-note">Im Reiter "Simulator" läuft genau dieser Ablauf mit deiner Platine.</div>` },
      { t: 'Messverfahren: Kelvin und Guard', html: `<h4>Durchgang und Isolation</h4><p>Es fließt nur ein kleiner Strom oder liegt eine kleine Spannung an. Durchgang gilt als gut, wenn der Widerstand klein ist (der Grenzwert steht im Programm). Isolation gilt als gut, wenn der Widerstand zwischen zwei Netzen sehr hoch ist. Sind zwei Netze über ein Bauteil verbunden (z. B. ein Widerstand dazwischen), ist der Sollwert nicht "unendlich", sondern der Bauteilwert.</p>
<h4>Kelvin-Messung (Vierleiter)</h4><p>Bei <b>kleinen Widerständen</b> spielt der Übergangswiderstand der Nadelspitzen eine Rolle, denn er ist nicht vernachlässigbar klein und streut. Deshalb leiten zwei Nadeln den Strom ein und zwei andere messen die Spannung direkt am Bauteil. Dafür braucht der Tester mindestens vier Nadeln.</p>${FIG_KELVIN}
<h4>Guard-Technik</h4><p>Misst du ein Bauteil <b>in der Schaltung</b>, fließt ein Teil des Stroms über parallele Pfade durch andere Bauteile. Das verfälscht das Ergebnis. Mit einem <b>Guard</b> wird ein weiterer Punkt auf das passende Potenzial gelegt. Dann liegt über einem Teil des Nebenpfads keine Spannung, und der restliche Nebenstrom fließt in den Guard statt in die Messung.</p>${FIG_GUARD}
<h4>Weitere Messungen</h4><ul><li><b>Kondensatoren:</b> Mit Wechsel- oder Ladestrom (LCR-Messung). Große Kapazitäten brauchen mehr Zeit.</li><li><b>Dioden und LEDs:</b> Mit kleinem Strom wird die Flussspannung gemessen. Die Sperrrichtung zeigt die Polung.</li><li><b>ICs:</b> Über die Schutzdioden an den Pins gegen einen Bezugspin (meist Masse). Das Muster verrät, ob das Bauteil da ist und richtig herum sitzt.</li><li><b>Mit Strom (Powered Test):</b> Je nach Maschine legt der Tester die Betriebsspannung an und misst Spannungen an Testpunkten. Das ist ein Übergang zum Funktionstest.</li></ul>` },
      { t: 'Flying Probe gegen Nadelbett (ICT)', html: `<div class="pt-cols"><div class="pt-pro"><h5>Flying Probe</h5><ul><li>Kein Adapter nötig: ideal für <b>Prototypen, Kleinserien und häufig wechselnde Varianten</b></li><li>Flexibel: Platinenänderung heißt neues Programm, nicht neuer Adapter</li><li>Testprogramm entsteht schnell aus den CAD-Daten</li><li>Kann deutlich kleinere Pads als ein Nadelbett kontaktieren (je nach Maschine)</li></ul><h5 style="color:#ffb340;margin-top:8px">Nachteile</h5><ul><li><b>Langsam:</b> Sekunden pro Netz, Minuten pro Platine</li><li>Keine echte Parallelität, auch mit mehreren Nadeln fahren die Messungen größtenteils nacheinander</li><li>Geringere Abdeckung bei sehr dichten Platinen (Nadeln müssen einzeln herankommen)</li><li>Mechanische Belastung der Pads durch die Nadelspitzen</li></ul></div>
<div class="pt-pro"><h5>Nadelbett (ICT)</h5><ul><li><b>Sehr schnell:</b> eine Platine in Sekunden, weil viele Punkte gleichzeitig kontaktiert sind</li><li>Hohe Abdeckung, auch mit Guard-Messung, Powered Test und Programmieren</li><li>Ideal für <b>Großserien</b></li></ul><h5 style="color:#ffb340;margin-top:8px">Nachteile</h5><ul><li><b>Der Adapter ist teuer:</b> hunderte Federkontaktstifte, Fräsen oder Bohren, Verdrahtung, Vakuum</li><li>Der Adapter gilt für eine Platinenversion; bei einer Änderung ist er neu oder umzubauen</li><li>Lieferzeit für den Adapter</li><li>Testpunkte mit etwa 0,8 bis 1,0 mm Durchmesser nötig, das verbraucht Platz</li></ul></div></div>
<div class="pt-note">Die Rechnung dazu findest du im Simulator unter "ICT-Vergleich": Rüstkosten gegen Prüfzeit ergeben die <b>Break-even-Stückzahl</b>.</div>` },
      { t: 'DFT: Regeln für prüfbare Platinen', html: `<p>Design for Test heißt: Schon im Layout so planen, dass die Platine später geprüft werden kann. Hake ab, was bei deinem Layout stimmt.</p><div id="pt-dft-checklist"></div>` },
      { t: 'Abdeckung und Fehlerspektrum', html: `<h4>Abdeckungsbegriffe</h4><ul><li><b>Netzabdeckung:</b> Anteil der Netze, an die mindestens eine Nadel herankommt. Für die Durchgangsprüfung braucht ein Netz mindestens zwei erreichbare Punkte.</li><li><b>Bauteilabdeckung:</b> Anteil der Bauteile, die der Tester messen kann (beide Anschlüsse erreichbar).</li><li><b>Pinabdeckung:</b> Anteil der Anschlüsse, die erreichbar sind.</li><li><b>Fehlerspektrum:</b> Welche Fehlerarten ein Verfahren überhaupt sehen kann: Open, Short, falscher Wert, falsche Polung, fehlendes Bauteil, verdrehter IC.</li></ul><div class="pt-note warn">Hohe Abdeckung heißt nicht fehlerfrei: Ein Fehler an einer Stelle, die keine Nadel erreicht, bleibt unbemerkt. Das nennt man Schlupf.</div><h4>Was sieht die Flying Probe im Vergleich zur AOI?</h4><div id="pt-mini-matrix"></div>` },
      { t: 'Grenzen und Praxis', html: `<ul><li><b>Pads werden belastet:</b> Die Nadelspitze drückt auf das Pad. Weiche Lötstellen und feine Pads können Spuren zeigen. Deshalb wird der Druck begrenzt.</li><li><b>Nur Erreichbares wird geprüft:</b> Was unter einem Bauteil liegt, bleibt unbemerkt. Verdeckte Lötstellen (BGA, QFN) prüft die AXI oder Boundary Scan.</li><li><b>Mechanik begrenzt die Geschwindigkeit:</b> Die Nadeln müssen beschleunigen, abbremsen, absenken und aufsetzen. Die Messzeit ist oft nicht der größte Anteil.</li><li><b>Wärme und Spannung:</b> Maximale Messspannung und Strom sind begrenzt, damit empfindliche Bauteile nicht beschädigt werden.</li><li><b>Auswertung:</b> Ein Fehler wird einem Netz oder Bauteil mit Position zugeordnet. So findet der Rework-Platz die Stelle schnell.</li></ul>` }
    ];
    const DFT_CHECK = [
      ['Jedes Netz hat mindestens einen Testpunkt, besser zwei.', 'Für die Durchgangsprüfung braucht ein Netz mindestens zwei erreichbare Punkte. Mit nur einem kannst du nur die Isolation messen.'],
      ['Testpunktgröße passt zum Verfahren.', 'Für ICT sind etwa 0,8 bis 1,0 mm Durchmesser üblich. Die Flying Probe kann kleinere Flächen anfahren, dafür sind Bauteil-Pads oft schon Testziele.'],
      ['Alle Testpunkte liegen bevorzugt auf einer Seite.', 'Ein Nadelbett greift meist nur von der Unterseite. Wer nur eine Seite prüfen muss, spart Zeit und Adapterkosten.'],
      ['Abstand zu hohen Bauteilen halten.', 'Hohe Bauteile (Elkos, Stecker, Kühlkörper) verdecken den Zugang für die Nadel. Die genaue Sperrzone legt der Prüfplatz fest. Im Simulator rechnet das Modell mit 2 mm Abstand ab 5 mm Bauteilhöhe.'],
      ['Keine Testpunkte unter Bauteilen.', 'Was unter einem Gehäuse liegt, kann keine Nadel berühren.'],
      ['Abstand zwischen Testpunkten ausreichend.', 'Nadeln und Aufnahmen brauchen Platz. Ein Nadelbett arbeitet im Raster 100 mil (2,54 mm), bei Bedarf 75 oder 50 mil.'],
      ['Vias als Testpunkt nur mit Lötstopp-Öffnung.', 'Ist die Via mit Lötstopp abgedeckt, kann die Nadel nicht sicher kontaktieren. Außerdem muss die Via groß genug sein.'],
      ['Lötstopp-Öffnung und kein Bestückungsdruck auf dem Testpunkt.', 'Lötstopp oder Silkscreen auf dem Kupfer isolieren die Nadel.'],
      ['Fiducials für die Ausrichtung vorhanden.', 'Kameras von Drucker, Bestücker, AOI und Prüfer richten sich an den Passmarken aus.'],
      ['Programmier- und Boundary-Scan-Zugang eingeplant.', 'JTAG-Anschluss (TCK, TMS, TDI, TDO) und Programmierstecker mit Zugang vorsehen.'],
      ['Testpunkte beschriftet (TP1, TP2 ...).', 'Das spart in der Fehlersuche und beim Rework viel Zeit.']
    ];

    /* ---------- Verfahren: Karten ---------- */
    const METHODS = [
      { t: 'Boundary Scan (JTAG, IEEE 1149.1)', html: `<p>Viele ICs haben an jedem Pin eine <b>Boundary-Scan-Zelle</b>, die den Pin lesen oder treiben kann. Die Zellen sind zu einer Kette (Scan-Chain) verbunden und werden über den <b>TAP</b> (Test Access Port) gesteuert, mit den Signalen <b>TCK</b> (Takt), <b>TMS</b> (Steuerung der Testlogik), <b>TDI</b> (Dateneingang) und <b>TDO</b> (Datenausgang). Optional gibt es TRST als Reset.</p><ul><li><b>Verbindungstest:</b> Ein IC treibt über seine Zellen einen Pegel auf das Netz, das andere IC liest ihn über seine Zellen ein (Befehl EXTEST). Unterbrechungen und Kurzschlüsse zwischen den ICs werden gefunden, <b>ohne dass eine Nadel an die Pins muss</b>.</li><li><b>Weitere Befehle:</b> SAMPLE/PRELOAD (Pegel lesen), BYPASS (IC überspringen), IDCODE (Kennung lesen).</li><li><b>BSDL-Datei:</b> Der Hersteller beschreibt die Zellen und Befehle des ICs.</li><li><b>Programmieren:</b> Über JTAG lassen sich auch Flash-Speicher und CPLDs programmieren.</li></ul><p><b>Grenzen:</b> Nur ICs mit JTAG und nur die Netze zwischen ihnen. Passive Bauteile (Widerstände, Kondensatoren) und Netze ohne JTAG-IC prüft Boundary Scan nicht direkt. Besonders wertvoll bei BGA und dichten Platinen, wo kein Testpunkt Platz hat.</p>` },
      { t: 'Funktionstest (FCT)', html: `<p>Die Platine arbeitet unter Betriebsbedingungen. Spannungen, Ströme, Takte, Schnittstellen und Ein-/Ausgänge werden geprüft, oft mit einem eigens gebauten Prüfadapter. Geprüft wird, ob die Schaltung ihre Aufgabe erfüllt, nicht, wo ein Fehler sitzt. Dazu gehört häufig auch das Programmieren der Firmware und das Speichern von Seriennummer und Kalibrierwerten.</p><p><b>Stärke:</b> Nähe zur Realität. <b>Schwäche:</b> Aufwand pro Produkt, und bei Fehlern ist die Diagnose schwer.</p>` },
      { t: 'Burn-in und ESS', html: `<p>Manche Bauteile fallen in den ersten Betriebsstunden aus (<b>Frühausfälle</b>). Beim <b>Burn-in</b> läuft die Platine unter erhöhter Temperatur und Spannung für eine bestimmte Zeit, damit diese Ausfälle schon beim Hersteller auftreten. <b>ESS</b> (Environmental Stress Screening) beansprucht die Baugruppe mit Temperaturwechseln, Vibration oder Feuchte.</p><p>Das kostet Zeit und Energie und wird nur eingesetzt, wenn Ausfälle im Feld teuer oder gefährlich sind (z. B. Medizin, Luftfahrt, Industrie mit hoher Lebensdauer).</p>` },
      { t: 'Sichtprüfung nach IPC-A-610', html: `<p>Der Mitarbeiter prüft mit Auge, Lupe oder Mikroskop. Maßstab ist die Richtlinie <b>IPC-A-610</b> (Abnahmekriterien für elektronische Baugruppen). Sie teilt in drei Klassen ein: <b>Klasse 1</b> allgemeine Elektronik, <b>Klasse 2</b> Elektronik mit erhöhten Anforderungen an Lebensdauer und Betrieb, <b>Klasse 3</b> Hochleistungselektronik mit höchsten Anforderungen. Welche Klasse gilt, legt der Auftraggeber fest.</p><p>Gut für Prototypen und Nacharbeit; bei großen Stückzahlen ist die AOI schneller und gleichmäßiger.</p>` },
      { t: 'AXI (Röntgen)', html: `<p>Röntgenstrahlen zeigen Lötstellen, die man von der Seite nicht sieht: unter BGA und QFN, Lunker, Brücken und offene Stellen. Die Anlage ist teuer und langsam und wird oft nur für kritische Bauteile oder als Stichprobe genutzt. Details siehe Station "Röntgen" in der Fertigungslinie.</p>` },
      { t: 'AOI (Kamera)', html: `<p>Kameras vergleichen die Platine mit einem Muster oder den CAD-Daten. Die AOI findet fehlende, verdrehte und falsche Bauteile, falsche Polarität, Lötbrücken, Tombstones. Sie sieht nichts Verdecktes und misst keine Werte. Details siehe Station "AOI".</p>` },
      { t: 'SPI (Lotpasteninspektion)', html: `<p>Misst Volumen, Höhe und Versatz der Paste nach dem Druck. Fehler werden vor der Bestückung gefunden, wenn die Platine noch ohne Verlust gereinigt und neu bedruckt werden kann. Details siehe Station "SPI".</p>` }
    ];
    /* Matrix: 2 = sicher, 1 = bedingt, 0 = nein; Spalten SPI, AOI, AXI, ICT, FP, BS, FCT */
    const MCOLS = ['SPI', 'AOI', 'AXI', 'ICT', 'Flying Probe', 'Boundary Scan', 'FCT'];
    const MATRIX = [
      ['Fehlendes Bauteil', [0, 2, 0, 2, 2, 1, 1]],
      ['Falscher Wert (R, C)', [0, 1, 0, 2, 2, 0, 1]],
      ['Elko falsch herum', [0, 2, 0, 1, 1, 0, 1]],
      ['Diode oder LED falsch herum', [0, 2, 0, 2, 2, 0, 1]],
      ['IC verdreht', [0, 2, 0, 1, 1, 2, 2]],
      ['Lötbrücke (Short)', [1, 1, 2, 2, 2, 1, 1]],
      ['Offene Lötstelle (Open)', [1, 1, 2, 2, 2, 1, 1]],
      ['Kalte Lötstelle (noch leitend)', [0, 1, 1, 0, 0, 0, 0]],
      ['Zu viel oder zu wenig Paste', [2, 1, 1, 0, 0, 0, 0]],
      ['Lunker, verdeckte Lötstelle (BGA, QFN)', [0, 0, 2, 1, 0, 1, 1]],
      ['Fehlfunktion, Firmware, Abgleich', [0, 0, 0, 0, 0, 0, 2]]
    ];
    const MNOTE = { 2: 'sicher', 1: 'bedingt', 0: 'nein' }, MSYM = { 2: '●', 1: '◐', 0: '○' };
    function matrixHtml(cols) {
      const idx = cols.map(c => MCOLS.indexOf(c));
      return '<div class="pt-tbl-wrap"><table class="pt-tbl" style="min-width:' + (180 + idx.length * 80) + 'px"><thead><tr><th>Fehlerart</th>' + cols.map(c => '<th class="c">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
        MATRIX.map(r => '<tr><td>' + esc(r[0]) + '</td>' + idx.map(i => '<td class="c"><span class="pt-m pt-m' + r[1][i] + '" title="' + MNOTE[r[1][i]] + '">' + MSYM[r[1][i]] + '</span></td>').join('') + '</tr>').join('') +
        '</tbody></table></div><p class="pt-mute" style="margin-top:6px">● findet das sicher, ◐ nur unter Bedingungen (z. B. nur wenn der Punkt erreichbar ist), ○ sieht das nicht. Das ist eine Faustübersicht, im Einzelfall hängt es von Gerät, Programm und Platine ab.</p>';
    }
    const COMPARE = [
      ['SPI', 'Lotpaste: Volumen, Höhe, Versatz', 'Paste zu viel/wenig, Versatz, Brücken in der Paste', 'mittel bis hoch', 'schnell, im Linientakt', 'ab mittleren Serien'],
      ['AOI', 'Sichtbare Bauteile und Lötstellen', 'Fehlteile, Verdrehung, Polarität, Brücken, Tombstones', 'mittel', 'schnell (Sekunden bis eine Minute)', 'ab Kleinserie bis Großserie'],
      ['AXI', 'Verdeckte Lötstellen (Röntgen)', 'Lunker, Brücken und Opens unter BGA und QFN', 'hoch', 'langsam, oft Stichprobe', 'kritische Bauteile, Erstmuster, Hochzuverlässigkeit'],
      ['ICT (Nadelbett)', 'Netze, Bauteilwerte, Dioden, ICs über Schutzdioden', 'Open, Short, Wert, Polung, fehlende Bauteile', 'Adapter teuer, Betrieb günstig', 'sehr schnell (Sekunden)', 'Großserien mit stabilem Layout'],
      ['Flying Probe', 'Wie ICT, aber ohne Adapter', 'Open, Short, Wert, Polung, fehlende Bauteile', 'Einrichtung günstig, Betrieb teurer pro Platine', 'langsam (Minuten)', 'Prototypen, Kleinserien, viele Varianten'],
      ['Boundary Scan', 'Verbindungen zwischen JTAG-ICs, ohne Nadeln', 'Open und Short zwischen ICs, Programmierung', 'Software und Anschluss, kein Adapter', 'schnell bis mittel', 'alle Stückzahlen, besonders BGA und dichte Platinen'],
      ['Funktionstest', 'Verhalten im Betrieb', 'Fehlfunktion, Abgleich, Firmware', 'je nach Produkt mittel bis hoch', 'Sekunden bis Minuten', 'alle Stückzahlen, fast immer zusätzlich'],
      ['Burn-in / ESS', 'Frühausfälle durch Stress', 'Bauteile und Lötstellen mit Frühschäden', 'hoch (Zeit, Energie, Kammer)', 'sehr langsam (Stunden)', 'nur bei hohen Zuverlässigkeitsanforderungen'],
      ['Sichtprüfung', 'Auge, Lupe, Mikroskop', 'sichtbare Fehler nach IPC-A-610', 'gering', 'langsam, von Person abhängig', 'Prototypen, Nacharbeit, Stichproben']
    ];
    function advise(q, many, bga, jtag, dense) {
      const out = [];
      const add = (m, why) => out.push({ m, why });
      if (q <= 50) { add('Flying Probe', 'Bei ' + q + ' Platinen lohnt kein Prüfadapter. Die Flying Probe kostet keine Adapterkosten, die längere Prüfzeit fällt bei wenigen Platinen nicht ins Gewicht.'); add('Sichtprüfung oder AOI', 'Bei wenigen Platinen reicht oft die Sichtprüfung nach IPC-A-610, mit Lupe oder Mikroskop.'); }
      else if (q <= 2000) { add(many ? 'Flying Probe' : 'Flying Probe oder ICT prüfen (Break-even rechnen)', many ? 'Viele Varianten würden viele Adapter kosten. Die Flying Probe passt sich per Programm an.' : 'In diesem Bereich liegt oft der Break-even. Rechne Adapterkosten gegen Prüfzeit im Simulator.'); add('AOI', 'Ab Kleinserie lohnt sich die automatische optische Prüfung: schnell und ohne Adapter.'); }
      else { add(many ? 'ICT je Variante oder Flying Probe für kleine Varianten' : 'ICT (Nadelbett)', many ? 'Bei hohen Stückzahlen amortisiert sich der Adapter schnell. Variantenreiche Zweige mit kleinen Losen trotzdem mit Flying Probe prüfen.' : 'Bei ' + (q >= 10000 ? 'sehr hoher' : 'hoher') + ' Stückzahl und stabilem Layout zahlt sich der schnelle Nadelbett-Test aus. Der Adapter verteilt sich auf viele Platinen.'); add('AOI und SPI', 'In der Großserie fangen SPI und AOI Fehler früh und schnell ab, bevor sie Testzeit kosten.'); }
      if (bga) add('AXI (Röntgen)', 'Verdeckte Lötstellen unter BGA und QFN sieht keine Kamera und keine Nadel. Röntgen, mindestens für Erstmuster und Stichproben.');
      if (jtag || bga || dense) add('Boundary Scan', jtag ? 'Die ICs haben JTAG: Verbindungen zwischen ihnen lassen sich ohne Testpunkte prüfen, besonders wertvoll unter BGA.' : 'Wenn die ICs JTAG können, ersetzt Boundary Scan fehlende Testpunkte. Prüfe das im Datenblatt.');
      if (dense) add('Flying Probe oder Testpunkte nachplanen', 'Bei dichter Platine ohne Platz für ICT-Testpunkte kommt die Flying Probe mit kleineren Pads zurecht. Im Simulator siehst du, welche Netze erreichbar sind.');
      add('Funktionstest', 'Zusätzlich fast immer nötig: Er zeigt, ob die Platine im Gerät läuft, einschließlich Firmware.');
      return out;
    }
    const QUIZ = [
      { q: 'Du hast 5 Prototypen einer neuen Platine. Welches elektrische Prüfverfahren passt am besten?', o: ['Nadelbett (ICT) mit eigenem Adapter', 'Flying Probe', 'Burn-in über 1000 Stunden', 'Röntgen (AXI) aller Lötstellen'], a: 1, e: 'Bei wenigen Platinen wäre der Adapter viel teurer als die lange Prüfzeit. Die Flying Probe braucht keinen Adapter und ist schnell programmiert.' },
      { q: 'Dieselbe Platine wird 50 000 Mal gebaut. Was ist wahrscheinlich die wirtschaftlichste elektrische Prüfung?', o: ['Flying Probe, weil sie keinen Adapter braucht', 'Nadelbett (ICT)', 'Nur Sichtprüfung', 'Handmessung mit Multimeter'], a: 1, e: 'Der Adapter kostet einmal viel, verteilt sich aber auf 50 000 Platinen. Die Prüfzeit von Sekunden spart in der Summe viel Maschinenzeit gegenüber Minuten bei der Flying Probe.' },
      { q: 'Du willst prüfen, ob unter einem BGA Lötbrücken sitzen. Was hilft?', o: ['AOI mit Seitenkamera', 'Lotpasteninspektion (SPI)', 'Röntgen (AXI)', 'Sichtprüfung mit Lupe'], a: 2, e: 'Die Lötstellen unter dem Gehäuse sind von außen nicht sichtbar. Röntgen zeigt Brücken, Lunker und offene Stellen.' },
      { q: 'Ein Elko wurde falsch herum eingelötet. Was erkennt das am sichersten?', o: ['AOI (Polaritätsmarkierung)', 'Isolationsmessung', 'Kelvin-Messung', 'SPI'], a: 0, e: 'Die Kamera sieht, ob das Polaritätszeichen auf der richtigen Seite liegt. Die Kapazitätsmessung eines Testers erkennt die Polung nicht.' },
      { q: 'Welche Station misst, wie viel Lotpaste auf den Pads liegt?', o: ['AOI', 'SPI', 'ICT', 'Reflow-Ofen'], a: 1, e: 'Die SPI misst Volumen, Höhe und Versatz der Paste dreidimensional, direkt nach dem Druck.' },
      { q: 'Wie prüft Boundary Scan die Verbindung zwischen zwei ICs?', o: ['Mit Nadeln an allen Pins', 'Mit Zellen an den IC-Pins, gesteuert über TCK, TMS, TDI und TDO', 'Mit Röntgenstrahlen', 'Mit der Wärmebildkamera'], a: 1, e: 'Ein IC treibt über seine Pin-Zellen einen Pegel auf das Netz, das andere liest ihn ein. Nadeln sind dafür nicht nötig.' },
      { q: 'Warum dauert die Flying Probe pro Platine viel länger als ein Nadelbett?', o: ['Weil die Messgeräte langsamer sind', 'Weil die Nadeln die Punkte nacheinander anfahren', 'Weil sie nur nachts arbeitet', 'Weil sie Röntgenstrahlen nutzt'], a: 1, e: 'Beim Nadelbett sind alle Punkte gleichzeitig kontaktiert, bei der Flying Probe fahren wenige Nadeln jeden Punkt einzeln an. Dazu kommen Aufsetzen und Absenken.' },
      { q: 'Die Platine besteht alle elektrischen Tests, funktioniert im Gerät aber nicht. Was fehlt in der Prüfstrategie?', o: ['Ein Funktionstest', 'Noch ein Isolationstest', 'Eine größere Schablone', 'Ein zweiter Reflow-Durchgang'], a: 0, e: 'Netz- und Bauteiltests prüfen Aufbau, nicht Verhalten. Firmware, Abgleich und Zusammenspiel zeigt nur der Funktionstest.' },
      { q: 'Wofür ist die Kelvin-Messung (Vierleiter) wichtig?', o: ['Für große Kondensatoren', 'Für kleine Widerstände', 'Für Röntgenaufnahmen', 'Für das Programmieren'], a: 1, e: 'Bei kleinen Widerständen verfälscht der Übergangswiderstand der Nadelspitzen das Ergebnis. Zwei Nadeln leiten Strom ein, zwei messen die Spannung direkt am Bauteil.' },
      { q: 'Was bedeutet "Schlupf" bei der Prüfung?', o: ['Die Maschine rutscht auf der Schiene', 'Eine fehlerhafte Platine besteht alle Prüfungen', 'Eine gute Platine wird als schlecht gemeldet', 'Die Paste verschmiert'], a: 1, e: 'Schlupf ist ein Fehler, der durch die Prüfung gerutscht ist, z. B. weil an der Stelle kein Testpunkt war. Die Gegenseite sind Pseudofehler: gute Platinen, die als schlecht gemeldet werden.' }
    ];

    /* ====================================================================================
       Ansicht: Fertigungslinie
       ==================================================================================== */
    function stationWindow(env, id) {
      const st = STATIONS.find(s => s.id === id); if (!st) return;
      const b = env.board(), S = boardStats(b), hasBoard = b && S.parts > 0;
      const ov = h('div', { class: 'pt-ov', role: 'dialog', 'aria-modal': 'true', 'aria-label': st.name });
      const close = () => { if (ov.parentNode) ov.parentNode.removeChild(ov); doc.removeEventListener('keydown', onKey, true); };
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
      doc.addEventListener('keydown', onKey, true);
      ov.addEventListener('click', e => { if (e.target === ov) close(); });
      const win = h('div', { class: 'pt-win' });
      win.appendChild(h('header', null, [h('span', { style: 'font-size:24px', text: STATION_ICON[st.icon] || '■' }), h('h3', { text: st.name + ' · ' + st.sub }), h('button', { class: 'pt-btn', 'aria-label': 'Schließen', text: 'Schließen', onclick: close })]));
      const wb = h('div', { class: 'pt-wb' }); win.appendChild(wb);
      if (st.optional) wb.appendChild(h('span', { class: 'pt-pill', text: 'optional, je nach Platine' }));
      wb.appendChild(h('h4', { text: 'Was passiert hier?' })); st.what.forEach(t => wb.appendChild(h('p', { text: t })));
      wb.appendChild(h('h4', { text: 'Welche Fehler werden gefunden?' })); st.finds.forEach(t => wb.appendChild(h('p', { text: t })));
      wb.appendChild(h('h4', { text: 'Typische Parameter' }));
      wb.appendChild(h('div', { class: 'pt-tbl-wrap' }, h('table', { class: 'pt-tbl', style: 'min-width:0' }, h('tbody', null, st.params.map(p => h('tr', null, [h('td', { style: 'width:38%;color:#9fb0c2', text: p[0] }), h('td', { text: p[1] })]))))));
      wb.appendChild(h('div', { class: 'pt-cols', style: 'margin-top:10px' }, [
        h('div', { class: 'pt-pro' }, [h('h5', { text: 'Vorteile' }), h('ul', null, st.pros.map(t => h('li', { text: t })))]),
        h('div', { class: 'pt-con' }, [h('h5', { text: 'Nachteile' }), h('ul', null, st.cons.map(t => h('li', { text: t })))])]));
      wb.appendChild(h('h4', { text: 'Bezug zu deiner Platine' }));
      let lines = [];
      if (!hasBoard) lines = ['Noch keine Bauteile: Lade im Layout-Editor eine Platine oder ein Beispiel, dann siehst du hier konkrete Zahlen.'];
      else if (st.id === 'test') {
        try {
          const cmp = compare(b, {}), p1 = cachedPlan(b, { side: 'both' });
          lines = ['Flying Probe (Nadeln auf beiden Seiten): Abdeckung ' + fm(cmp.fp.coverage.pct, 0) + ' % (Netze ' + fm(cmp.fp.coverage.netPct, 0) + ' %, Bauteile ' + fm(cmp.fp.coverage.partPct, 0) + ' %), geschätzte Prüfzeit ' + fmtTime(cmp.fp.timeS) + ' bei ' + cmp.fp.steps + ' Messungen.',
            'ICT (nur Unterseite, Testpunkte ab 0,8 mm): Abdeckung ' + fm(cmp.ict.coverage.pct, 0) + ' %, Prüfzeit etwa ' + fmtTime(cmp.ict.timeS) + ', Adapter geschätzt ' + fmtEur(cmp.ict.fixture) + '.',
            cmp.breakEven.qty == null ? 'Nach diesem Modell ist der Nadelbett-Test nie günstiger.' : 'Break-even nach diesem Modell bei etwa ' + cmp.breakEven.qty + ' Platinen. Darunter ist die Flying Probe günstiger, darüber das Nadelbett (Beispielwerte, rechne im Simulator mit deinen Zahlen).',
            p1.issues.filter(i => i.severity !== 'info').length ? 'Offene Punkte im DFT-Check: ' + p1.issues.filter(i => i.severity !== 'info').length + ' (siehe Simulator).' : 'Der DFT-Check meldet keine offenen Punkte.'];
        } catch (e) { lines = ['Für diese Platine konnte der Test nicht berechnet werden: ' + (e.message || e)]; }
      } else { try { lines = st.board(b, S); } catch (e) { lines = ['Keine Daten: ' + (e.message || e)]; } }
      wb.appendChild(h('div', { class: 'pt-note ok' }, lines.map(t => h('div', { style: 'margin:3px 0', text: t }))));
      ov.appendChild(win); env.root.appendChild(ov);
      try { win.querySelector('button').focus(); } catch (e) { /* egal */ }
      return close;
    }

    function viewLine(host, env) {
      const b0 = env.board(), S0 = boardStats(b0);
      const st = Object.assign({ variant: 'fp', tht: null, axi: true, defect: 'none', speed: 1 }, lsGet('line', {}));
      if (st.tht == null) st.tht = S0.tht > 0 || !S0.parts;
      const save = () => lsSet('line', { variant: st.variant, tht: st.tht, axi: st.axi, defect: st.defect, speed: st.speed });
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      const card = h('div', { class: 'pt-card' });
      card.appendChild(h('h3', { text: 'Fertigungslinie einer SMT-Baugruppe' }));
      card.appendChild(h('p', { class: 'pt-mute', text: 'Tippe eine Station an: Dort erfährst du, was passiert, welche Fehler gefunden werden und was deine Platine damit zu tun hat. Mit "Start" läuft eine Platine durch die Linie.' }));
      const ctl = h('div', { class: 'pt-row' });
      const btnStart = h('button', { class: 'pt-btn ok', text: '▶ Start' }), btnReset = h('button', { class: 'pt-btn', text: '⏮ Zurück' });
      const segSpeed = h('div', { class: 'pt-seg' }, [[1, '1x'], [2, '2x'], [4, '4x']].map(a => h('button', { 'data-v': a[0], text: a[1], class: st.speed === a[0] ? 'on' : '', onclick: () => { st.speed = a[0]; save(); [...segSpeed.children].forEach(c => c.classList.toggle('on', +c.dataset.v === st.speed)); } })));
      const segVar = h('div', { class: 'pt-seg' }, [['fp', 'Flying Probe'], ['ict', 'ICT']].map(a => h('button', { 'data-v': a[0], text: a[1], class: st.variant === a[0] ? 'on' : '', onclick: () => { st.variant = a[0]; save(); [...segVar.children].forEach(c => c.classList.toggle('on', c.dataset.v === st.variant)); reset(); } })));
      const chk = (key, label) => { const i = h('input', { type: 'checkbox', style: 'width:22px;height:22px;accent-color:#3b9eff' }); i.checked = !!st[key]; i.addEventListener('change', () => { st[key] = i.checked; save(); reset(); }); return h('label', { class: 'pt-lbl', style: 'display:inline-flex;align-items:center;gap:6px;min-height:40px' }, [i, label]); };
      const selDef = h('select', { class: 'pt-sel', 'aria-label': 'Fehler auf der Platine' }, DEFECTS.map(d => h('option', { value: d.id, text: d.id === 'none' ? 'Fehler: keiner' : 'Fehler: ' + d.name })));
      selDef.value = st.defect; selDef.addEventListener('change', () => { st.defect = selDef.value; save(); reset(); });
      ctl.appendChild(btnStart); ctl.appendChild(btnReset); ctl.appendChild(segSpeed); ctl.appendChild(h('span', { class: 'pt-lbl', text: 'Test:' })); ctl.appendChild(segVar); ctl.appendChild(chk('tht', 'THT')); ctl.appendChild(chk('axi', 'Röntgen')); ctl.appendChild(selDef);
      card.appendChild(ctl);
      const cv = h('canvas', { class: 'pt-cv', 'aria-label': 'Fertigungslinie: Stationen zum Antippen' }); card.appendChild(cv);
      const status = h('div', { class: 'pt-note', style: 'margin-top:8px', text: 'Bereit. Wähle optional einen Fehler und drücke Start.' }); card.appendChild(status);
      host.appendChild(card);
      const info = h('div', { class: 'pt-card' }, [h('h3', { text: 'So liest du das Schaubild' }), h('ul', null, [
        h('li', { text: 'Grün mit Haken: Die Station hat nichts gefunden. Das heißt nicht, dass die Platine fehlerfrei ist: Jedes Verfahren sieht nur bestimmte Fehlerarten.' }),
        h('li', { text: 'Rot mit Kreuz: Die Station hat den Fehler gefunden, die Platine geht in die Nacharbeit (Rework). Je früher ein Fehler gefunden wird, desto billiger ist die Reparatur.' }),
        h('li', { text: 'Gestrichelte Station: optional, je nach Platine. THT-Stationen entfallen bei reiner SMD-Platine, Röntgen wird oft nur für BGA und QFN gebraucht.' }),
        h('li', { text: 'Probiere die Fehler durch: Ein Elko-Polaritätsfehler rutscht an SPI und Röntgen vorbei, die AOI findet ihn. Eine Brücke unter einem QFN sieht keine Kamera: Dafür ist das Röntgen da.' })])]);
      host.appendChild(info);

      let W = 300, H = 300, cells = [], hit = -1, raf = 0, last = 0, run = null, destroyed = false, result = null;
      const cols = () => clamp(Math.floor(W / 128), 2, 6);
      const act = () => STATIONS.filter(s => (s.id !== 'tht' || st.tht) && (s.id !== 'axi' || st.axi));
      const stName = s => (s.id === 'test' ? (st.variant === 'ict' ? 'ICT' : 'Flying Probe') : s.name);
      function layout() {
        W = Math.max(280, Math.floor(card.clientWidth - 24)); const c = cols(), cw = W / c, ch = 112, rows = Math.ceil(STATIONS.length / c); H = rows * ch + 8;
        cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
        cells = STATIONS.map((s, i) => { const r = Math.floor(i / c), k = i % c, col = r % 2 === 0 ? k : c - 1 - k; return { s, x: col * cw, y: r * ch + 4, w: cw, h: ch - 4, cx: col * cw + cw / 2, cy: r * ch + 4 + (ch - 4) / 2 }; });
      }
      function wrap(g, text, maxW) { const w = text.split(' '), out = []; let line = ''; w.forEach(t => { const tt = line ? line + ' ' + t : t; if (g.measureText(tt).width > maxW && line) { out.push(line); line = t; } else line = tt; }); if (line) out.push(line); return out; }
      function pathPts() { return act().map(s => { const c = cells.find(q => q.s === s); return { x: c.cx, y: c.cy, s }; }); }
      function draw() {
        if (!cv.isConnected) return; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        const on = new Set(act().map(s => s.id));
        /* Förderband */
        g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#2c343e'; g.lineWidth = 8; g.beginPath();
        cells.forEach((c, i) => { if (i === 0) g.moveTo(c.cx, c.cy); else g.lineTo(c.cx, c.cy); }); g.stroke();
        g.strokeStyle = '#3a4452'; g.lineWidth = 2; g.setLineDash([6, 8]); g.lineDashOffset = -((performance.now() / 60) | 0) % 14; g.stroke(); g.setLineDash([]);
        cells.forEach((c, i) => {
          const s = c.s, enabled = on.has(s.id), x = c.x + 6, y = c.y + 4, w = c.w - 12, hh = c.h - 8;
          const res = result && result.marks[s.id];
          g.save(); g.fillStyle = enabled ? '#222830' : '#1a1f25'; g.strokeStyle = hit === i ? '#3b9eff' : res === 'fail' ? '#ff6b6b' : res === 'ok' ? '#2f7a4b' : '#3a4452'; g.lineWidth = hit === i || res ? 2 : 1;
          if (!enabled) g.setLineDash([5, 4]); g.beginPath(); g.roundRect ? g.roundRect(x, y, w, hh, 10) : g.rect(x, y, w, hh); g.fill(); g.stroke(); g.restore();
          g.globalAlpha = enabled ? 1 : 0.45; g.textAlign = 'center'; g.fillStyle = enabled ? '#7fc0ff' : '#8b97a3'; g.font = '26px system-ui,sans-serif'; g.fillText(STATION_ICON[s.icon] || '■', c.cx, y + 34);
          g.fillStyle = '#e8edf2'; g.font = '700 12px system-ui,sans-serif'; const nm = wrap(g, stName(s), w - 8); nm.slice(0, 2).forEach((t, k) => g.fillText(t, c.cx, y + 54 + k * 14));
          g.fillStyle = '#8b97a3'; g.font = '10.5px system-ui,sans-serif'; if (nm.length < 2) { const sb = wrap(g, s.sub, w - 8); g.fillText(sb[0], c.cx, y + 70); if (sb[1] && hh > 82) g.fillText(sb[1], c.cx, y + 82); }
          g.fillStyle = '#6b7684'; g.font = '700 10px system-ui,sans-serif'; g.textAlign = 'left'; g.fillText(String(i + 1), x + 6, y + 14); g.textAlign = 'center'; g.globalAlpha = 1;
          if (res) { g.beginPath(); g.arc(x + w - 12, y + 14, 10, 0, 7); g.fillStyle = res === 'fail' ? '#ff6b6b' : '#4cd964'; g.fill(); g.fillStyle = '#06121f'; g.font = '700 13px system-ui'; g.fillText(res === 'fail' ? '✗' : '✓', x + w - 12, y + 19); }
          if (run && run.k === i && run.ph < 0.6 && enabled) { /* Scan-Effekt */
            const f = (run.ph / 0.6); g.strokeStyle = 'rgba(59,158,255,.85)'; g.lineWidth = 2; const sy = y + 6 + (hh - 12) * (0.5 + 0.5 * Math.sin(f * 12)); g.beginPath(); g.moveTo(x + 6, sy); g.lineTo(x + w - 6, sy); g.stroke();
          }
        });
        /* Platine */
        if (run) {
          const pts = pathPts(); let px = pts[0].x, py = pts[0].y;
          if (pts[run.k]) { px = pts[run.k].x; py = pts[run.k].y; }
          if (run.ph >= 0.6 && pts[run.k + 1]) { const u = (run.ph - 0.6) / 0.4, e = u * u * (3 - 2 * u); px += (pts[run.k + 1].x - px) * e; py += (pts[run.k + 1].y - py) * e; }
          const bad = run.caught; g.save(); g.translate(px, py + 18); g.fillStyle = bad ? '#8a2f35' : '#14753a'; g.strokeStyle = bad ? '#ff6b6b' : '#4cd964'; g.lineWidth = 1.5; g.fillRect(-18, -11, 36, 22); g.strokeRect(-18, -11, 36, 22);
          g.fillStyle = '#d9a441'; for (let i = 0; i < 4; i++) g.fillRect(-13 + i * 8, -6, 4, 3); g.fillRect(-13, 3, 26, 3);
          if (bad) { g.fillStyle = '#fff'; g.font = '700 14px system-ui'; g.textAlign = 'center'; g.fillText('✗', 0, 5); }
          g.restore();
        }
      }
      function reset() {
        if (raf) cancelAnimationFrame(raf); raf = 0; run = null; result = null; btnStart.textContent = '▶ Start'; layout(); draw();
        const d = DEFECTS.find(q => q.id === st.defect);
        status.className = 'pt-note'; status.textContent = d && d.id !== 'none' ? 'Fehler auf der Platine: ' + d.name + '. ' + d.desc + ' Drücke Start und sieh, ob die Linie ihn findet.' : 'Bereit. Wähle optional einen Fehler und drücke Start.';
      }
      function evalStation(s) {
        const d = DEFECTS.find(q => q.id === st.defect) || DEFECTS[0];
        if (d.id === 'none' || result.caught) return { ok: true };
        if (d.catchers.indexOf(s.id) >= 0) return { ok: false, text: stName(s) + ': ' + (d.hit && (d.hit[s.id]) || 'Abweichung gefunden.') };
        return { ok: true };
      }
      function finish() {
        const d = DEFECTS.find(q => q.id === st.defect) || DEFECTS[0], r = cv.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        if (result.caught) return;
        if (d.id === 'none') { status.className = 'pt-note ok'; status.textContent = 'Gute Platine: Alle Stationen haben nichts beanstandet. Weiter zum Versand.'; env.fx('tada', x, y, 'Prüfung bestanden!'); }
        else { status.className = 'pt-note err'; status.textContent = 'Durchgerutscht! Der Fehler "' + d.name + '" wurde in dieser Linie nicht gefunden. Der Kunde würde ihn entdecken. Überlege: Welche Station hätte ihn finden können? Tipp: Schalte Röntgen oder die andere Prüfart zu.'; env.fx('sad', x, y, 'Durchgerutscht!'); }
      }
      function start() {
        if (run && !run.done) { run.paused = !run.paused; btnStart.textContent = run.paused ? '▶ Weiter' : '⏸ Pause'; if (!run.paused) loop(); return; }
        reset(); result = { marks: {}, caught: false }; run = { t: 0, k: 0, ph: 0, caught: false, paused: false, done: false, revealed: -1 }; btnStart.textContent = '⏸ Pause'; last = performance.now(); status.className = 'pt-note'; status.textContent = 'Die Platine läuft ein ...'; loop();
      }
      const D = 1.5;
      function loop() {
        if (destroyed || !run || run.paused) return; raf = requestAnimationFrame(now => {
          const dt = Math.min(0.1, (now - last) / 1000); last = now; const list = act(), n = list.length, r = cv.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
          run.t += dt * st.speed; const T = (n - 1) * D + D * 0.62;
          let k = Math.min(n - 1, Math.floor(run.t / D)), ph = (run.t - k * D) / D; if (k === n - 1) ph = Math.min(ph, 0.6); run.k = k; run.ph = ph;
          if (ph >= 0.35 && run.revealed < k) {
            run.revealed = k; const s = list[k], ev = evalStation(s);
            if (ev.ok) { result.marks[s.id] = 'ok'; env.fx('click', x, y); status.className = 'pt-note'; status.textContent = stName(s) + ': in Ordnung.'; }
            else { result.marks[s.id] = 'fail'; result.caught = true; run.caught = true; status.className = 'pt-note err'; status.textContent = 'Gefunden! ' + ev.text + ' Die Platine geht in die Nacharbeit (Rework).'; env.fx('zap', x, y, 'Gefunden! Die Station hat\'s gemerkt.'); run.done = true; run.paused = false; btnStart.textContent = '▶ Nochmal'; draw(); return; }
          }
          draw();
          if (run.t >= T) { run.done = true; btnStart.textContent = '▶ Nochmal'; finish(); draw(); return; }
          loop();
        });
      }
      btnStart.addEventListener('click', start); btnReset.addEventListener('click', reset);
      cv.addEventListener('click', e => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, i = cells.findIndex(c => px >= c.x && px <= c.x + c.w && py >= c.y && py <= c.y + c.h); if (i >= 0) { hit = i; draw(); stationWindow(env, cells[i].s.id); setTimeout(() => { hit = -1; draw(); }, 400); } });
      layout(); draw();
      return {
        refresh() { /* Platine kann sich geändert haben: nichts nötig, Fenster rechnen beim Öffnen */ },
        onResize() { layout(); draw(); },
        onHide() { if (run && !run.done) { run.paused = true; btnStart.textContent = '▶ Weiter'; } },
        destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); }
      };
    }

    /* ====================================================================================
       Ansicht: Flying-Probe-Simulator auf der eigenen Platine
       ==================================================================================== */
    const FAULT_OPTS = [['none', 'Kein Fehler (gute Platine)'], ['open', 'Unterbrechung (Haarriss in der Bahn)'], ['short', 'Kurzschluss (Lötbrücke)'], ['value', 'Falscher Bauteilwert'], ['missing', 'Bauteil fehlt'], ['reversed', 'Diode, LED oder Elko verpolt'], ['icrot', 'IC verdreht'], ['cold', 'Kalte Lötstelle'], ['random', 'Zufälliger Fehler']];
    function makeFault(b, kind, seed) {
      const R = root.PCB_REPAIR, rmap = { open: 'crack', short: 'bridge', value: 'wrongvalue' };
      const kinds = kind === 'random' ? ['open', 'short', 'value', 'missing', 'reversed', 'icrot', 'cold'] : [kind];
      const start = kind === 'random' ? Math.floor(hash(seed, 'rnd') * kinds.length) : 0;
      for (let a = 0; a < kinds.length; a++) {
        const k = kinds[(start + a) % kinds.length];
        let r = null;
        try { if (R && R.inject) r = inject(b, rmap[k] || k, seed); if (!r || r.error || !r.faults.length) r = inject(b, k, seed, { own: true }); } catch (e) { r = null; }
        if (r && r.faults && r.faults.length) return r;
      }
      return { board: b, faults: [], error: 'Auf dieser Platine gibt es keine passende Stelle für diesen Fehler.' };
    }
    function bestSide(b) {
      try { const t = planFlyingProbe(b, { side: 'top' }), u = planFlyingProbe(b, { side: 'bot' }); return u.coverage.pct > t.coverage.pct ? 'bot' : 'top'; } catch (e) { return 'top'; }
    }

    function viewSim(host, env) {
      const SIM = Object.assign({ side: null, probes: 2, speed: 100, mult: 5, fault: 'none', seed: 1, qty: 100, rate: 60, tab: 'prot', fixture: null }, lsGet('sim', {}));
      const saveSim = () => lsSet('sim', { side: SIM.side, probes: SIM.probes, speed: SIM.speed, mult: SIM.mult, fault: SIM.fault, seed: SIM.seed, qty: SIM.qty, rate: SIM.rate, tab: SIM.tab, fixture: SIM.fixture });
      const dpr = Math.min(2, root.devicePixelRatio || 1);
      let extraTP = [], plan = null, fres = null, insp = null, err = '', scene = null, empty = false;
      let run = null, raf = 0, last = 0, destroyed = false, selNet = null, focus = null, showFault = false, clickT = 0;
      const view = { s: 1, ox: 0, oy: 0, auto: true };
      let W = 300, H = 300;
      const top = h('div', { class: 'pt-card' });
      const split = h('div', { class: 'pt-split' });
      const cvCard = h('div', { class: 'pt-card' }), kpiCard = h('div', { class: 'pt-card' });
      const tabsCard = h('div', { class: 'pt-card' });
      split.appendChild(cvCard); split.appendChild(kpiCard); host.appendChild(top); host.appendChild(split); host.appendChild(tabsCard);

      /* ---------- Steuerung ---------- */
      top.appendChild(h('h3', { text: 'Flying-Probe-Simulator' }));
      top.appendChild(h('p', { class: 'pt-mute', text: 'Die Platine aus dem Layout-Editor wird geprüft. Rechnung und Zeiten sind ein Modell mit Beispielwerten, kein echtes Maschinendatenblatt.' }));
      const ctl1 = h('div', { class: 'pt-row' }), ctl2 = h('div', { class: 'pt-row' });
      top.appendChild(ctl1); top.appendChild(ctl2);
      const segSide = h('div', { class: 'pt-seg' }, [['top', 'Oberseite'], ['bot', 'Unterseite'], ['both', 'Beide']].map(a => h('button', { 'data-v': a[0], text: a[1], onclick: () => { SIM.side = a[0]; saveSim(); stopRun(); recompute(); } })));
      const selProbes = h('select', { class: 'pt-sel', 'aria-label': 'Anzahl Nadeln' }, [2, 4, 6, 8].map(n => h('option', { value: n, text: n + ' Nadeln' })));
      const selSpeed = h('select', { class: 'pt-sel', 'aria-label': 'Verfahrgeschwindigkeit' }, [50, 100, 200, 300].map(n => h('option', { value: n, text: 'Verfahren ' + n + ' mm/s' })));
      selProbes.value = SIM.probes; selSpeed.value = SIM.speed;
      selProbes.addEventListener('change', () => { SIM.probes = +selProbes.value; saveSim(); stopRun(); recompute(); });
      selSpeed.addEventListener('change', () => { SIM.speed = +selSpeed.value; saveSim(); stopRun(); recompute(); });
      ctl1.appendChild(h('span', { class: 'pt-lbl', text: 'Prüfseite:' })); ctl1.appendChild(segSide); ctl1.appendChild(selProbes); ctl1.appendChild(selSpeed);
      const btnRun = h('button', { class: 'pt-btn ok', text: '▶ Prüfung starten' }), btnStep = h('button', { class: 'pt-btn', text: 'Schritt' }), btnReset = h('button', { class: 'pt-btn', text: '⏮ Zurück' });
      const segMult = h('div', { class: 'pt-seg' }, [[1, 'Echtzeit'], [5, '5x'], [25, '25x'], [0, 'Sofort']].map(a => h('button', { 'data-v': a[0], text: a[1], onclick: () => { SIM.mult = a[0]; saveSim(); markMult(); } })));
      const markMult = () => [...segMult.children].forEach(c => c.classList.toggle('on', +c.dataset.v === SIM.mult));
      ctl2.appendChild(btnRun); ctl2.appendChild(btnStep); ctl2.appendChild(btnReset); ctl2.appendChild(segMult);
      const ctl3 = h('div', { class: 'pt-row' }); top.appendChild(ctl3);
      const selFault = h('select', { class: 'pt-sel', 'aria-label': 'Fehlerinjektion' }, FAULT_OPTS.map(o => h('option', { value: o[0], text: 'Fehler: ' + o[1] })));
      selFault.value = SIM.fault; selFault.addEventListener('change', () => { SIM.fault = selFault.value; saveSim(); showFault = false; stopRun(); recompute(); });
      const btnDice = h('button', { class: 'pt-btn', text: '🎲 Andere Stelle', onclick: () => { SIM.seed = (SIM.seed % 997) + 1; saveSim(); showFault = false; stopRun(); recompute(); } });
      const btnShowFault = h('button', { class: 'pt-btn', text: 'Fehlerort zeigen', onclick: () => { showFault = !showFault; btnShowFault.classList.toggle('on', showFault); draw(); } });
      ctl3.appendChild(selFault); ctl3.appendChild(btnDice); ctl3.appendChild(btnShowFault);
      const zoomRow = h('div', { class: 'pt-row', style: 'margin:8px 0 0' });
      zoomRow.appendChild(h('button', { class: 'pt-btn', text: '+', 'aria-label': 'Vergrößern', onclick: () => zoomAt(W / 2, H / 2, 1.4) }));
      zoomRow.appendChild(h('button', { class: 'pt-btn', text: '−', 'aria-label': 'Verkleinern', onclick: () => zoomAt(W / 2, H / 2, 1 / 1.4) }));
      zoomRow.appendChild(h('button', { class: 'pt-btn', text: 'Einpassen', onclick: () => { view.auto = true; fitView(); draw(); } }));
      const legend = h('span', { class: 'pt-mute', html: '<span style="color:#4cd964">●</span> erreichbar &nbsp;<span style="color:#ffb340">●</span> verbaut &nbsp;<span style="color:#b48cff">●</span> zu klein &nbsp;<span style="color:#6b7684">●</span> andere Seite &nbsp;<span style="color:#3b9eff">●</span> neuer Testpunkt' });
      zoomRow.appendChild(legend);

      const cv = h('canvas', { class: 'pt-cv', 'aria-label': 'Platine mit Pads und Prüfnadeln' }); cvCard.appendChild(cv); cvCard.appendChild(zoomRow);
      const selInfo = h('div', { class: 'pt-mute', style: 'margin-top:6px', text: 'Tippe ein Pad an: Das Netz wird hervorgehoben.' }); cvCard.appendChild(selInfo);

      /* ---------- Auswertungs-Karte ---------- */
      const kpi = h('div', { class: 'pt-kpi' }); const kpiEls = {};
      [['time', 'Prüfzeit (Modell)'], ['path', 'Nadelweg'], ['meas', 'Messungen'], ['cov', 'Abdeckung'], ['cost', 'Prüfkosten je Platine'], ['probes', 'Nadeln']].forEach(a => { const b = h('b', { text: '–' }); kpiEls[a[0]] = b; kpi.appendChild(h('div', { class: 'pt-k' }, [b, h('span', { text: a[1] })])); });
      const prog = h('div', { class: 'pt-bar', style: 'margin:4px 0 6px' }, h('i')), progTxt = h('div', { class: 'pt-mute', text: 'Noch nicht gestartet.' });
      const live = h('div', { class: 'pt-note', style: 'min-height:44px', text: 'Wähle Seite und Nadeln, dann starte die Prüfung.' });
      const verdict = h('div');
      kpiCard.appendChild(h('h3', { text: 'Ergebnis' })); kpiCard.appendChild(kpi); kpiCard.appendChild(prog); kpiCard.appendChild(progTxt); kpiCard.appendChild(live); kpiCard.appendChild(verdict);

      /* ---------- Reiter unten ---------- */
      const tabRow = h('div', { class: 'pt-row' });
      const segTab = h('div', { class: 'pt-seg' }, [['prot', 'Testprotokoll'], ['dft', 'DFT-Check'], ['ict', 'ICT-Vergleich']].map(a => h('button', { 'data-v': a[0], text: a[1], onclick: () => { SIM.tab = a[0]; saveSim(); renderTab(); } })));
      tabRow.appendChild(segTab); const tabBody = h('div'); tabsCard.appendChild(tabRow); tabsCard.appendChild(tabBody);
      const protList = h('div', { class: 'pt-list' });

      /* ---------- Berechnung ---------- */
      function ensureBoardOk() { const b = env.board(); empty = !b || !(b.parts || []).length || !C(); return b; }
      function recompute(keep) {
        const b = ensureBoardOk();
        if (empty) { plan = null; insp = null; fres = null; err = ''; renderEmpty(); return; }
        if (SIM.side == null) { SIM.side = bestSide(b); saveSim(); }
        try {
          plan = planFlyingProbe(b, { side: SIM.side, probes: SIM.probes, speed: SIM.speed, extraTP, seed: SIM.seed, rate: SIM.rate }); err = '';
          fres = SIM.fault === 'none' ? null : makeFault(b, SIM.fault, SIM.seed);
          insp = fres && fres.faults && fres.faults.length ? inspect(b, fres, { plan, seed: SIM.seed }) : null;
        } catch (e) { console.error(e); plan = null; insp = null; err = String(e && e.message || e); }
        [...segSide.children].forEach(c => c.classList.toggle('on', c.dataset.v === SIM.side)); markMult();
        buildScene(b); if (view.auto) fitView(); updateKpi(); resetLive(); renderTab(); draw();
      }
      function renderEmpty() {
        cvCard.style.display = 'none'; kpiCard.style.display = 'none'; tabsCard.style.display = 'none'; split.style.display = 'none';
        let e = host.querySelector('.pt-emp'); if (!e) { e = h('div', { class: 'pt-card pt-emp' }); host.appendChild(e); }
        e.innerHTML = '<h3>Noch keine Bauteile</h3><p class="pt-mute">Setze im Layout-Editor Bauteile auf die Platine oder lade ein Beispiel. Dann kannst du hier prüfen, welche Pads eine Nadel erreicht, und einen Flying-Probe-Lauf simulieren.</p>';
      }
      function buildScene(b) {
        split.style.display = ''; cvCard.style.display = ''; kpiCard.style.display = ''; tabsCard.style.display = ''; const e = host.querySelector('.pt-emp'); if (e) e.remove();
        const courts = []; (b.parts || []).forEach(p => { let g = null; try { g = C().partGeometry(b, p); } catch (er) { g = null; } if (g) courts.push({ ref: p.ref, c: g.courtyard, tall: (g.fp.bodyH || 0) >= 5, side: g.side, tht: g.fp.kind === 'tht' }); });
        scene = { courts, b };
      }
      function updateKpi() {
        if (!plan) { Object.keys(kpiEls).forEach(k => { kpiEls[k].textContent = '–'; }); return; }
        const cov = plan.coverage;
        kpiEls.time.textContent = fmtTime(plan.timeS); kpiEls.path.textContent = plan.stats.pathMm >= 1000 ? fm(plan.stats.pathMm / 1000, 2) + ' m' : fm(plan.stats.pathMm, 0) + ' mm';
        kpiEls.meas.textContent = plan.steps.length; kpiEls.cov.textContent = fm(cov.pct, 0) + ' %'; kpiEls.cov.className = cov.pct >= 90 ? 'pt-ok' : cov.pct >= 60 ? 'pt-warn' : 'pt-err';
        kpiEls.cost.textContent = fmtEur(plan.cost.perBoard); kpiEls.probes.textContent = SIM.probes;
      }
      function resetLive() {
        prog.firstChild.style.width = '0%'; progTxt.textContent = 'Noch nicht gestartet.'; verdict.innerHTML = ''; protList.innerHTML = ''; focus = null; run = null;
        btnRun.textContent = '▶ Prüfung starten';
        if (!plan) { live.className = 'pt-note err'; live.textContent = err || 'Keine Berechnung möglich.'; return; }
        const cov = plan.coverage;
        live.className = 'pt-note'; live.innerHTML = 'Abdeckung: <b>' + fm(cov.netPct, 0) + ' %</b> der Netze, <b>' + fm(cov.partPct, 0) + ' %</b> der Bauteile messbar (' + cov.partsCovered + ' von ' + cov.parts + '). ' + (insp ? '<br>Eingebauter Fehler: <b>' + esc(insp.faults[0].name) + '</b>. Findet die Flying Probe ihn?' : (SIM.fault !== 'none' ? '<br>' + esc((fres && fres.error) || 'Kein Fehler eingebaut.') : ''));
      }

      /* ---------- Darstellung ---------- */
      function sizeCanvas() {
        const b = scene && scene.b; const cw = Math.max(260, Math.floor(cvCard.clientWidth - 24)); W = cw;
        const asp = b && b.w ? b.h / b.w : 0.7; H = Math.round(clamp(cw * asp + 24, 240, Math.min(560, Math.max(260, (root.innerHeight || 700) * 0.62))));
        cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      }
      function fitView() {
        const b = scene && scene.b; if (!b) return; sizeCanvas(); const m = 14, s = Math.min((W - 2 * m) / (b.w || 1), (H - 2 * m) / (b.h || 1)); view.s = s; view.s0 = s * 0.5; view.ox = (W - b.w * s) / 2; view.oy = (H - b.h * s) / 2;
      }
      const X = x => view.ox + x * view.s, Y = y => view.oy + y * view.s;
      const BLK = '#6b7684';
      function nodeColor(n) { return n.extra ? '#3b9eff' : n.ok ? '#4cd964' : (n.tall || n.under) ? '#ffb340' : n.small ? '#b48cff' : BLK; }
      let pos = null, trail0 = [], trail1 = [], flash = [];
      function parkPos() { const b = scene.b; return [{ x: 0, y: 0 }, { x: b.w, y: b.h }]; }
      function draw() {
        if (!scene || !cv.isConnected) return; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
        const b = scene.b, s = view.s;
        g.fillStyle = '#12301f'; g.strokeStyle = '#2f7a4b'; g.lineWidth = 2; g.fillRect(X(0), Y(0), b.w * s, b.h * s); g.strokeRect(X(0), Y(0), b.w * s, b.h * s);
        /* Leiterbahnen */
        g.lineCap = 'round'; g.lineJoin = 'round';
        (b.tracks || []).forEach(t => { if (!t.pts || t.pts.length < 2) return; const hot = selNet && t.net === selNet; g.strokeStyle = hot ? '#ffffff' : t.layer === 'F.Cu' ? 'rgba(230,90,90,.55)' : t.layer === 'B.Cu' ? 'rgba(90,140,235,.55)' : 'rgba(90,200,120,.35)'; g.lineWidth = Math.max(1, (t.w || 0.25) * s); g.beginPath(); t.pts.forEach((p, i) => { if (i) g.lineTo(X(p[0]), Y(p[1])); else g.moveTo(X(p[0]), Y(p[1])); }); g.stroke(); });
        /* Bauteile */
        g.lineWidth = 1; scene.courts.forEach(c => {
          g.fillStyle = c.tall ? 'rgba(255,179,64,.10)' : 'rgba(255,255,255,.04)'; g.strokeStyle = c.tall ? 'rgba(255,179,64,.55)' : 'rgba(200,210,220,.30)'; if (c.side === 'bot') g.setLineDash([4, 3]);
          g.fillRect(X(c.c.x0), Y(c.c.y0), (c.c.x1 - c.c.x0) * s, (c.c.y1 - c.c.y0) * s); g.strokeRect(X(c.c.x0), Y(c.c.y0), (c.c.x1 - c.c.x0) * s, (c.c.y1 - c.c.y0) * s); g.setLineDash([]);
          if (s > 3.2) { g.fillStyle = 'rgba(220,230,240,.55)'; g.font = '10px system-ui'; g.textAlign = 'left'; g.fillText(c.ref, X(c.c.x0) + 2, Y(c.c.y0) + 10); }
        });
        /* Knoten */
        if (plan) {
          plan.nodes.forEach(n => {
            const w = Math.max(3.5, (n.w || 0.5) * s), hh = Math.max(3.5, (n.h || 0.5) * s), hot = selNet && n.net === selNet;
            g.fillStyle = nodeColor(n); g.globalAlpha = n.ok || n.extra ? 1 : 0.8;
            if (n.kind === 'via' || n.extra) { g.beginPath(); g.arc(X(n.x), Y(n.y), Math.max(2.5, w / 2), 0, 7); g.fill(); if (n.extra) { g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke(); } }
            else g.fillRect(X(n.x) - w / 2, Y(n.y) - hh / 2, w, hh);
            if (hot) { g.globalAlpha = 1; g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(X(n.x) - w / 2 - 2, Y(n.y) - hh / 2 - 2, w + 4, hh + 4); }
            g.globalAlpha = 1;
          });
          /* Vorschläge */
          plan.issues.forEach(i => { if (!i.suggest) return; const q = i.suggest; g.strokeStyle = '#3b9eff'; g.lineWidth = 2; g.setLineDash([4, 3]); g.beginPath(); g.arc(X(q.x), Y(q.y), 9, 0, 7); g.stroke(); g.setLineDash([]); g.fillStyle = '#3b9eff'; g.font = '700 13px system-ui'; g.textAlign = 'center'; g.fillText('+', X(q.x), Y(q.y) + 5); });
        }
        /* Spur und Nadeln */
        g.lineWidth = 1.5; [[trail0, 'rgba(59,158,255,.5)'], [trail1, 'rgba(255,159,67,.5)']].forEach(a => { if (a[0].length < 2) return; g.strokeStyle = a[1]; g.beginPath(); a[0].forEach((p, i) => { if (i) g.lineTo(X(p.x), Y(p.y)); else g.moveTo(X(p.x), Y(p.y)); }); g.stroke(); });
        flash = flash.filter(f => performance.now() - f.t0 < 700);
        flash.forEach(f => { const u = (performance.now() - f.t0) / 700; g.strokeStyle = f.ok ? 'rgba(76,217,100,' + (1 - u) + ')' : 'rgba(255,107,107,' + (1 - u) + ')'; g.lineWidth = 3; g.beginPath(); g.arc(X(f.x), Y(f.y), 6 + u * 16, 0, 7); g.stroke(); });
        if (focus) { [focus.a, focus.b].forEach(p => { g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.arc(X(p.x), Y(p.y), 11, 0, 7); g.stroke(); }); g.strokeStyle = 'rgba(255,255,255,.5)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(focus.a.x), Y(focus.a.y)); g.lineTo(X(focus.b.x), Y(focus.b.y)); g.stroke(); g.setLineDash([]); }
        const pp = pos || parkPos(); [[pp[0], '#3b9eff'], [pp[1], '#ff9f43']].forEach((a, i) => {
          const p = a[0], x = X(p.x), y = Y(p.y), touching = run && run.touch;
          g.strokeStyle = a[1]; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 20, y - 24); g.stroke(); g.fillStyle = a[1]; g.fillRect(x - 28, y - 32, 16, 10);
          g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, touching ? 4.5 : 3, 0, 7); g.fill(); g.strokeStyle = a[1]; g.lineWidth = 2; g.beginPath(); g.arc(x, y, touching ? 8 : 6, 0, 7); g.stroke();
        });
        /* Fehlerort */
        const fault = insp && insp.faults[0] && insp.faults[0].where;
        if (fault && (showFault || (run && run.done))) { const x = X(fault.x), y = Y(fault.y); g.strokeStyle = '#ff6b6b'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, 14, 0, 7); g.stroke(); g.fillStyle = '#ff6b6b'; g.font = '700 12px system-ui'; g.textAlign = 'center'; g.fillText('Fehler', x, y - 19); }
      }

      /* ---------- Zoom und Gesten ---------- */
      function zoomAt(px, py, f) { const ns = clamp(view.s * f, view.s0 || 1, 500); const k = ns / view.s; view.ox = px - (px - view.ox) * k; view.oy = py - (py - view.oy) * k; view.s = ns; view.auto = false; draw(); }
      const ptrs = new Map(); let pinch = null, moved = false, downAt = null;
      cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (er) { /* egal */ } ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) { moved = false; downAt = { x: e.clientX, y: e.clientY }; } if (ptrs.size === 2) { const a = [...ptrs.values()]; pinch = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); moved = true; } });
      cv.addEventListener('pointermove', e => {
        const p = ptrs.get(e.pointerId); if (!p) return;
        if (ptrs.size === 1) { const dx = e.clientX - p.x, dy = e.clientY - p.y; if (!moved && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) moved = true; if (moved) { view.ox += dx; view.oy += dy; view.auto = false; draw(); } p.x = e.clientX; p.y = e.clientY; }
        else if (ptrs.size === 2) { p.x = e.clientX; p.y = e.clientY; const a = [...ptrs.values()], d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), r = cv.getBoundingClientRect(); if (pinch) zoomAt((a[0].x + a[1].x) / 2 - r.left, (a[0].y + a[1].y) / 2 - r.top, d / pinch); pinch = d; }
      });
      const up = e => { const had = ptrs.delete(e.pointerId); if (!had) return; if (ptrs.size < 2) pinch = null; if (e.type === 'pointerup' && !moved && ptrs.size === 0) tap(e); };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.2 : 1 / 1.2); }, { passive: false });
      function tap(e) {
        if (!plan) return; const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
        for (const i of plan.issues) { if (i.suggest && Math.hypot(X(i.suggest.x) - px, Y(i.suggest.y) - py) < 16) { addTP(i.suggest); return; } }
        let best = null, bd = 1e9; plan.nodes.forEach(n => { if (!n.net) return; const d = Math.hypot(X(n.x) - px, Y(n.y) - py); if (d < bd) { bd = d; best = n; } });
        if (best && bd < 16) { selNet = selNet === best.net ? null : best.net; if (selNet) { const nn = plan.nodes.filter(n => n.net === selNet), ok = nn.filter(n => n.ok).length; selInfo.innerHTML = 'Netz <b>' + esc(selNet) + '</b>: ' + nn.length + ' Anschlüsse, davon ' + ok + ' erreichbar' + (ok === 0 ? ' <span class="pt-err">(kein Testpunkt!)</span>' : ok === 1 ? ' <span class="pt-warn">(nur einer: Durchgang nicht prüfbar)</span>' : '') + '. Angetippt: ' + esc(best.ref + (best.kind === 'via' ? ' (Via)' : ' Pin ' + best.n)) + (best.ok ? '' : ': ' + esc(best.why.top && SIM.side !== 'bot' ? best.why.top : best.why.bot || best.why.top || '')) + '.'; } else selInfo.textContent = 'Tippe ein Pad an: Das Netz wird hervorgehoben.'; }
        else { selNet = null; selInfo.textContent = 'Tippe ein Pad an: Das Netz wird hervorgehoben.'; }
        draw();
      }
      function addTP(sug) {
        extraTP.push({ x: sug.x, y: sug.y, net: sug.net, side: sug.side, dia: sug.dia }); const before = plan ? plan.coverage.pct : 0; stopRun(); recompute(true);
        const r = cv.getBoundingClientRect(); const after = plan ? plan.coverage.pct : 0;
        env.fx(after >= 100 && before < 100 ? 'ding' : 'click', r.left + r.width / 2, r.top + r.height / 2, after > before ? 'Testpunkt gesetzt: Abdeckung ' + fm(after, 0) + ' %' : 'Testpunkt gesetzt');
      }

      /* ---------- Lauf ---------- */
      function stopRun() { if (raf) cancelAnimationFrame(raf); raf = 0; run = null; pos = null; trail0 = []; trail1 = []; flash = []; btnRun.textContent = '▶ Prüfung starten'; }
      const stepsOf = () => (insp ? insp.steps : plan.steps);
      function initRun() {
        stopRun(); protList.innerHTML = ''; verdict.innerHTML = ''; focus = null; const pk = parkPos();
        run = { i: 0, phase: 'move', t: 0, from: [pk[0], pk[1]], to: null, paused: false, done: false, sim: 0, touch: false, rows: 0, firstFail: false, fails: 0 }; pos = [pk[0], pk[1]]; trail0 = [pk[0]]; trail1 = [pk[1]];
      }
      function beginStep() {
        const s = stepsOf()[run.i]; run.to = [{ x: s.a.x, y: s.a.y }, { x: s.b.x, y: s.b.y }]; run.phase = 'move'; run.t = 0; run.touch = false;
        const dm = Math.max(Math.hypot(run.to[0].x - run.from[0].x, run.to[0].y - run.from[0].y), Math.hypot(run.to[1].x - run.from[1].x, run.to[1].y - run.from[1].y));
        run.dMove = SIM.mult ? Math.max(0.02, (dm / SIM.speed + 0.02) / SIM.mult) : 0; run.dMeas = SIM.mult ? Math.max(0.03, (plan.opts.touchS + s.tMeas) / SIM.mult) : 0;
      }
      function addRow(s) {
        const bad = !s.ok;
        const el = h('div', { class: 'pt-pr' + (bad ? ' bad' : ''), role: 'button', tabindex: '0', onclick: () => { focus = s; draw(); } }, [
          h('span', { class: 'n', text: '#' + (s.i + 1) }), h('span', { html: '<b class="' + (bad ? 'pt-err' : 'pt-ok') + '">' + (bad ? '✗' : '✓') + '</b> ' + esc(s.label) }), h('span', { class: 'v', text: s.text }),
          h('small', { text: s.a.name + ' → ' + s.b.name + ' · Position ' + fm(s.a.x, 1) + ' / ' + fm(s.a.y, 1) + ' mm · ' + s.expectText + (bad && s.fail ? ' · ' + s.fail.note : '') + (s.kelvin ? ' · Vierleiter' : '') })]);
        protList.appendChild(el); if (SIM.tab === 'prot' && SIM.mult) { const box = protList.parentNode; if (box && box.scrollHeight - box.scrollTop < 400) { /* mitscrollen nur im Seitenfluss nicht nötig */ } }
        run.rows++;
      }
      function finishStep() {
        const s = stepsOf()[run.i]; pos = [run.to[0], run.to[1]]; run.from = [run.to[0], run.to[1]]; trail0.push(pos[0]); trail1.push(pos[1]); if (trail0.length > 40) { trail0.shift(); trail1.shift(); }
        run.sim += s.t / (plan.stats.parallel || 1); addRow(s); flash.push({ x: s.a.x, y: s.a.y, ok: s.ok, t0: performance.now() }, { x: s.b.x, y: s.b.y, ok: s.ok, t0: performance.now() });
        const r = cv.getBoundingClientRect(), nowT = performance.now();
        if (!s.ok) { run.fails++; if (!run.firstFail) { run.firstFail = true; env.fx('zap', r.left + r.width / 2, r.top + r.height / 2, (insp && insp.say) || 'Gefunden! Die Nadel hat\'s gemerkt.'); } }
        else if (SIM.mult && SIM.mult <= 5 && nowT - clickT > 160) { clickT = nowT; env.fx('click', r.left + r.width / 2, r.top + r.height / 2); }
        run.i++; prog.firstChild.style.width = Math.round(100 * run.i / stepsOf().length) + '%';
        progTxt.textContent = 'Messung ' + run.i + ' von ' + stepsOf().length + ' · Simulierte Zeit ' + fmtTime(plan.opts.loadS + run.sim);
        live.className = 'pt-note' + (s.ok ? '' : ' err'); live.textContent = (s.ok ? '' : 'Abweichung! ') + s.label + ': ' + s.text + ' (' + s.expectText + ')';
      }
      function finishRun() {
        run.done = true; run.paused = false; btnRun.textContent = '▶ Nochmal'; const r = cv.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
        pos = pos; const fails = stepsOf().filter(s => !s.ok).length, cov = plan.coverage;
        let html = '';
        if (insp && insp.faults.length) {
          insp.faults.forEach(f => { html += f.found ? '<div class="pt-note ok"><b>Gefunden:</b> ' + esc(f.name) + (f.how ? ' (' + esc(f.how) + ')' : '') + '. ' + esc(insp.say) + '</div>' : '<div class="pt-note err"><b>Übersehen:</b> ' + esc(f.name) + '. ' + esc(f.why || '') + ' ' + esc(insp.say) + '</div>'; });
          if (insp.found) env.fx('zap', x, y, insp.say); else env.fx('sad', x, y, insp.say);
        } else { html += '<div class="pt-note ok"><b>Prüfung bestanden.</b> Alle ' + stepsOf().length + ' Messungen liegen im Soll. ' + SAY.pass[0] + '</div>'; env.fx('tada', x, y, 'Prüfung bestanden!'); }
        html += '<div class="pt-mute">Prüfdauer (Modell): ' + fmtTime(plan.timeS) + ' · Abdeckung ' + fm(cov.pct, 0) + ' % · ' + (fails ? fails + ' Messung' + (fails === 1 ? '' : 'en') + ' außerhalb Soll' : 'keine Abweichung') + '.</div>';
        if (cov.pct < 100 && !(insp && insp.found)) html += '<div class="pt-mute">Ein bestandener Test bedeutet nur: Alles, was gemessen wurde, ist in Ordnung. Bei ' + fm(cov.pct, 0) + ' % Abdeckung können Fehler an nicht erreichbaren Stellen unbemerkt bleiben.</div>';
        verdict.innerHTML = html; live.className = 'pt-note ' + (fails ? 'warn' : 'ok'); live.textContent = fails ? 'Lauf beendet: ' + fails + ' Abweichung(en) im Protokoll.' : 'Lauf beendet: bestanden.';
      }
      function tick(now) {
        raf = 0; if (destroyed || !run || run.paused) return; let dt = Math.min(0.1, (now - last) / 1000); last = now; const total = stepsOf().length;
        if (!SIM.mult) { let n = 0; while (run.i < total && n < 60) { beginStep(); finishStep(); run.to = null; n++; } }
        else {
          let guard = 0;
          while (dt > 0 && run.i < total && guard++ < 400) {
            if (!run.to) beginStep();
            if (run.phase === 'move') {
              const need = run.dMove - run.t;
              if (dt >= need) { dt -= need; run.t = 0; run.phase = 'meas'; run.touch = true; pos = [run.to[0], run.to[1]]; } else { run.t += dt; dt = 0; const u = run.dMove ? run.t / run.dMove : 1, e = u * u * (3 - 2 * u); pos = [0, 1].map(i => ({ x: run.from[i].x + (run.to[i].x - run.from[i].x) * e, y: run.from[i].y + (run.to[i].y - run.from[i].y) * e })); }
            } else {
              const need = run.dMeas - run.t; if (dt >= need) { dt -= need; finishStep(); run.to = null; } else { run.t += dt; dt = 0; }
            }
          }
        }
        draw();
        if (run.i >= total && !run.to) { finishRun(); draw(); return; }
        raf = requestAnimationFrame(tick);
      }
      function startRun() {
        if (!plan || !plan.steps.length) return;
        if (run && !run.done) { run.paused = !run.paused; btnRun.textContent = run.paused ? '▶ Weiter' : '⏸ Pause'; if (!run.paused) { last = performance.now(); raf = requestAnimationFrame(tick); } return; }
        initRun(); btnRun.textContent = '⏸ Pause'; live.className = 'pt-note'; live.textContent = 'Die Nadeln fahren los ...'; last = performance.now(); raf = requestAnimationFrame(tick);
      }
      function stepOnce() {
        if (!plan || !plan.steps.length) return; if (!run || run.done) { initRun(); } if (raf) { cancelAnimationFrame(raf); raf = 0; } run.paused = true; btnRun.textContent = '▶ Weiter';
        if (run.i < stepsOf().length) { beginStep(); finishStep(); run.to = null; draw(); if (run.i >= stepsOf().length) { finishRun(); draw(); } }
      }
      btnRun.addEventListener('click', startRun); btnStep.addEventListener('click', stepOnce);
      btnReset.addEventListener('click', () => { stopRun(); resetLive(); draw(); });

      /* ---------- Reiter: Protokoll, DFT, ICT ---------- */
      function renderTab() {
        [...segTab.children].forEach(c => c.classList.toggle('on', c.dataset.v === SIM.tab)); tabBody.innerHTML = '';
        if (!plan) { tabBody.appendChild(h('div', { class: 'pt-note err', text: err || 'Keine Daten.' })); return; }
        if (SIM.tab === 'prot') tabProtocol(); else if (SIM.tab === 'dft') tabDft(); else tabIct();
      }
      function tabProtocol() {
        tabBody.appendChild(h('p', { class: 'pt-mute', text: 'Jede Zeile ist eine Messung mit Messwert, Sollwert und Position. Tippe eine Zeile an, um die Stelle auf der Platine zu markieren. Rot sind Abweichungen.' }));
        if (!run) tabBody.appendChild(h('div', { class: 'pt-note', text: 'Noch keine Messung. Starte die Prüfung oben. Das Programm enthält ' + plan.steps.length + ' Messungen: ' + Object.keys(plan.stats.byType).map(k => plan.stats.byType[k] + ' x ' + ({ cont: 'Durchgang', iso: 'Isolation', res: 'Widerstand', cap: 'Kondensator', ind: 'Spule', diode: 'Diode', led: 'LED', fuse: 'Sicherung', pin: 'IC-Pin' })[k]).join(', ') + '.' }));
        tabBody.appendChild(protList);
      }
      function tabDft() {
        const iss = plan.issues, cov = plan.coverage;
        tabBody.appendChild(h('div', { class: 'pt-note' }, 'Prüfseite: ' + (SIM.side === 'both' ? 'beide' : sideName(SIM.side)) + ' · Netze erreichbar: ' + fm(cov.netPct, 0) + ' % · Durchgang prüfbar: ' + fm(cov.openPct, 0) + ' % · Bauteile messbar: ' + fm(cov.partPct, 0) + ' % · Anschlüsse erreichbar: ' + fm(cov.pinPct, 0) + ' %'));
        const sugs = iss.filter(i => i.suggest);
        const row = h('div', { class: 'pt-row' });
        if (sugs.length) row.appendChild(h('button', { class: 'pt-btn pri', text: 'Alle ' + sugs.length + ' Vorschläge anwenden', onclick: () => { sugs.forEach(i => extraTP.push({ x: i.suggest.x, y: i.suggest.y, net: i.suggest.net, side: i.suggest.side, dia: i.suggest.dia })); const before = cov.pct; stopRun(); recompute(); const r = cv.getBoundingClientRect(); env.fx(plan.coverage.pct >= 100 ? 'ding' : 'click', r.left + r.width / 2, r.top + r.height / 2, 'Abdeckung ' + fm(before, 0) + ' % auf ' + fm(plan.coverage.pct, 0) + ' %'); } }));
        if (extraTP.length) row.appendChild(h('button', { class: 'pt-btn', text: extraTP.length + ' zusätzliche Testpunkte entfernen', onclick: () => { extraTP = []; stopRun(); recompute(); } }));
        if (row.children.length) tabBody.appendChild(row);
        if (extraTP.length) tabBody.appendChild(h('div', { class: 'pt-mute', style: 'margin-bottom:8px', text: 'Die Testpunkte gelten nur im Simulator ("Was-wäre-wenn"). Zeichne sie anschließend im Layout-Editor als Pad oder Via mit Lötstopp-Öffnung ein.' }));
        const list = h('div', { class: 'pt-list' });
        iss.forEach(i => {
          const col = i.severity === 'error' ? '#ff6b6b' : i.severity === 'warn' ? '#ffb340' : '#7fc0ff', sym = i.severity === 'error' ? '✗' : i.severity === 'warn' ? '!' : 'i';
          const el = h('div', { class: 'pt-pr', style: 'grid-template-columns:30px 1fr;cursor:default;align-items:start' }, [h('b', { style: 'color:' + col + ';font-size:18px;text-align:center', text: sym }), h('div', null, [h('div', { text: i.msg }), h('div', { class: 'pt-row', style: 'margin:6px 0 0' }, [
            i.at ? h('button', { class: 'pt-btn', text: 'Zeigen', onclick: () => { focus = { a: i.at, b: i.at }; draw(); cv.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }) : null,
            i.suggest ? h('button', { class: 'pt-btn pri', text: '+ Testpunkt hinzufügen', onclick: () => addTP(i.suggest) }) : null])])]);
          list.appendChild(el);
        });
        tabBody.appendChild(list);
        tabBody.appendChild(h('div', { class: 'pt-note', style: 'margin-top:10px', text: 'Das Modell rechnet mit: Mindestgröße ' + fm(plan.opts.minPad, 2) + ' mm, Sperrzone ' + fm(plan.opts.tallDist, 1) + ' mm um Bauteile ab ' + fm(plan.opts.tallH, 0) + ' mm Höhe, Nachbarnetze bis ' + fm(plan.opts.nearDist, 1) + ' mm Abstand. Die Werte deiner Firma und deines Prüfers können abweichen.' }));
      }
      function tabIct() {
        const b = env.board();
        const wrap = h('div'); tabBody.appendChild(wrap);
        wrap.appendChild(h('p', { class: 'pt-mute', text: 'Gleiche Platine, zwei Prüfwege: Nadelbett (ICT, nur Unterseite, Testpunkte ab 0,8 mm) gegen Flying Probe (wie oben eingestellt). Der Adapter kostet einmal, die lange Flying-Probe-Zeit kostet bei jeder Platine. Alle Preise sind Beispielwerte.' }));
        const sl = (label, min, max, step, val, fmtF, on) => { const o = h('output'); const i = h('input', { type: 'range', min, max, step, value: val }); const upd = () => { o.textContent = fmtF(+i.value); }; i.addEventListener('input', () => { upd(); on(+i.value); }); upd(); return h('div', { class: 'pt-sl' }, [h('span', { class: 'pt-lbl', text: label }), i, o]); };
        const qtyOut = v => Math.round(Math.pow(10, v / 20));
        wrap.appendChild(sl('Stückzahl', 0, 100, 1, Math.round(20 * Math.log10(Math.max(1, SIM.qty))), v => String(qtyOut(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Stück', v => { SIM.qty = qtyOut(v); saveSim(); upd2(); }));
        wrap.appendChild(sl('Maschinenstunde', 20, 200, 5, SIM.rate, v => v + ' €/h', v => { SIM.rate = v; saveSim(); upd2(); }));
        const fxIn = h('input', { class: 'pt-in', type: 'number', min: 0, step: 100, 'aria-label': 'Adapterkosten' }); const fxRow = h('div', { class: 'pt-sl' }, [h('span', { class: 'pt-lbl', text: 'Adapterkosten' }), fxIn, h('button', { class: 'pt-btn', text: 'Auto', onclick: () => { SIM.fixture = null; saveSim(); upd2(); } })]);
        fxIn.addEventListener('input', () => { SIM.fixture = fxIn.value === '' ? null : Math.max(0, +fxIn.value); saveSim(); upd2(true); });
        wrap.appendChild(fxRow);
        const out = h('div'); const cvs = h('canvas', { class: 'pt-cv', style: 'height:240px;cursor:default;margin-top:8px', 'aria-label': 'Diagramm Gesamtkosten über Stückzahl' }); wrap.appendChild(out); wrap.appendChild(cvs);
        let pend = 0;
        function upd2(keepFx) { cancelAnimationFrame(pend); pend = requestAnimationFrame(() => paint(keepFx)); }
        function paint(keepFx) {
          let cmp; const o = { side: SIM.side, probes: SIM.probes, speed: SIM.speed, extraTP, rate: SIM.rate, qty: SIM.qty, fixture: SIM.fixture == null ? undefined : SIM.fixture, maxQty: 100000, seed: SIM.seed };
          try { cmp = compare(b, o); o.maxQty = Math.max(100, Math.ceil(Math.max(cmp.breakEven.qty ? cmp.breakEven.qty * 2.2 : 1000, SIM.qty * 1.15))); cmp = compare(b, o); } catch (e) { out.innerHTML = '<div class="pt-note err">' + esc(e.message || e) + '</div>'; return; }
          if (!keepFx) fxIn.value = Math.round(SIM.fixture != null ? SIM.fixture : cmp.ict.fixture);
          const be = cmp.breakEven, at = be.atQty, F = cmp.fp, I = cmp.ict;
          const cheaper = at.cheaper === 'fp' ? 'Flying Probe' : at.cheaper === 'ict' ? 'Nadelbett (ICT)' : 'beide gleich';
          out.innerHTML = '<div class="pt-kpi"><div class="pt-k"><b>' + fmtTime(F.timeS) + '</b><span>Flying Probe je Platine</span></div><div class="pt-k"><b>' + fmtTime(I.timeS) + '</b><span>ICT je Platine</span></div><div class="pt-k"><b>' + fm(F.coverage.pct, 0) + ' % / ' + fm(I.coverage.pct, 0) + ' %</b><span>Abdeckung FP / ICT</span></div><div class="pt-k"><b>' + (be.qty == null ? 'nie' : be.qty === 0 ? 'sofort' : String(be.qty).replace(/\B(?=(\d{3})+(?!\d))/g, '.')) + '</b><span>Break-even Stückzahl</span></div></div>' +
            '<table class="pt-tbl" style="min-width:0"><thead><tr><th></th><th class="c">Flying Probe</th><th class="c">ICT (Nadelbett)</th></tr></thead><tbody><tr><td>Einmalig (Programm/Adapter)</td><td class="c">' + fmtEur(150) + '</td><td class="c">' + fmtEur((SIM.fixture != null ? SIM.fixture : I.fixture) + 400) + '</td></tr><tr><td>Je Platine (Maschinenzeit)</td><td class="c">' + fmtEur(be.cFp) + '</td><td class="c">' + fmtEur(be.cIct) + '</td></tr><tr><td>Gesamt bei ' + String(SIM.qty).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Stück</td><td class="c">' + fmtEur(at.fp) + '</td><td class="c">' + fmtEur(at.ict) + '</td></tr><tr><td>Kosten je Platine insgesamt</td><td class="c">' + fmtEur(at.fpPer) + '</td><td class="c">' + fmtEur(at.ictPer) + '</td></tr></tbody></table>' +
            '<div class="pt-note ' + (at.cheaper === 'fp' ? '' : 'warn') + '" style="margin-top:8px"><b>Bei ' + String(SIM.qty).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Stück ist ' + cheaper + ' günstiger.</b> ' + (be.qty == null ? 'Nach diesem Modell holt das Nadelbett die Kosten nie auf.' : be.qty === 0 ? 'Das Nadelbett ist von Anfang an günstiger.' : 'Ab etwa ' + be.qty + ' Platinen lohnt sich nach diesem Modell der Adapter.') + (I.coverage.pct < F.coverage.pct - 5 ? ' Beachte: Der ICT erreicht bei dieser Platine nur ' + fm(I.coverage.pct, 0) + ' % Abdeckung, die Flying Probe ' + fm(F.coverage.pct, 0) + ' %.' : '') + '</div>';
          drawChart(cvs, be, SIM.qty);
        }
        paint(false);
      }
      function niceStep(range, n) { const raw = range / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; }
      function drawChart(c, be, qty) {
        const w = Math.max(280, Math.floor(c.parentNode.clientWidth)), hh = 250; c.width = Math.round(w * dpr); c.height = Math.round(hh * dpr); c.style.height = hh + 'px'; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, hh);
        const L = 62, R = 16, T = 24, B = 36, maxQ = be.maxQ, lx = q => L + (q / maxQ) * (w - L - R);
        const ymax = Math.max(be.fpCost(maxQ), be.ictCost(maxQ)) * 1.05, ly = v => hh - B - (v / ymax) * (hh - B - T);
        g.font = '11px system-ui'; g.fillStyle = '#8b97a3'; g.strokeStyle = '#2c343e'; g.lineWidth = 1; g.textAlign = 'right';
        const ys = niceStep(ymax, 4); for (let v = 0; v <= ymax; v += ys) { const y = ly(v); g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); g.fillText(fmtEur(v).replace(/,\d+ €/, ' €'), L - 6, y + 4); }
        g.textAlign = 'center'; const xs = niceStep(maxQ, Math.max(2, Math.floor((w - L - R) / 90))); for (let q = 0; q <= maxQ; q += xs) { const x = lx(q); g.beginPath(); g.moveTo(x, T); g.lineTo(x, hh - B); g.stroke(); g.fillText(String(Math.round(q)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), x, hh - B + 14); }
        g.fillText('Stückzahl', (L + w - R) / 2, hh - 6); g.save(); g.translate(12, (T + hh - B) / 2); g.rotate(-Math.PI / 2); g.fillText('Gesamtkosten der Prüfung', 0, 0); g.restore();
        const line = (fn, col) => { g.strokeStyle = col; g.lineWidth = 2.5; g.beginPath(); g.moveTo(lx(0), ly(fn(0))); g.lineTo(lx(maxQ), ly(fn(maxQ))); g.stroke(); };
        line(be.ictCost, '#ff9f43'); line(be.fpCost, '#3b9eff');
        if (be.qty && be.qty <= maxQ) { const x = lx(be.qty), y = ly(be.fpCost(be.qty)); g.strokeStyle = '#4cd964'; g.setLineDash([5, 4]); g.lineWidth = 2; g.beginPath(); g.moveTo(x, T); g.lineTo(x, hh - B); g.stroke(); g.setLineDash([]); g.fillStyle = '#4cd964'; g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill(); g.textAlign = x > w - 140 ? 'right' : 'left'; g.fillText('Break-even ca. ' + String(be.qty).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Stück', x + (x > w - 140 ? -8 : 8), T + 12); }
        const q0 = Math.min(qty, maxQ), xq = lx(q0); g.strokeStyle = '#ffffff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(xq, T); g.lineTo(xq, hh - B); g.stroke(); [[be.fpCost, '#3b9eff'], [be.ictCost, '#ff9f43']].forEach(a => { g.fillStyle = a[1]; g.beginPath(); g.arc(xq, ly(a[0](q0)), 4.5, 0, 7); g.fill(); });
        g.textAlign = 'left'; g.fillStyle = '#3b9eff'; g.fillText('■ Flying Probe (flach, kein Adapter)', L + 4, T - 8); g.fillStyle = '#ff9f43'; g.fillText('■ Nadelbett (hoher Sockel)', L + 210, T - 8);
      }

      sizeCanvas(); recompute();
      return {
        _sig: planKey(env.board() || {}, {}),
        refresh(why) { { const b = env.board(); const sig = planKey(b || {}, {}); if (sig !== this._sig) { this._sig = sig; extraTP = []; stopRun(); view.auto = true; selNet = null; recompute(); } } },
        onResize() { if (scene) { if (view.auto) fitView(); else sizeCanvas(); draw(); if (SIM.tab === 'ict') renderTab(); } },
        onHide() { if (run && !run.done && !run.paused) { run.paused = true; btnRun.textContent = '▶ Weiter'; } },
        destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); }
      };
    }

    /* ====================================================================================
       Ansichten: Flying Probe (Erklärung), Verfahren und Quiz, Glossar
       ==================================================================================== */
    function viewFp(host, env) {
      host.appendChild(h('div', { class: 'pt-note' }, [h('b', { text: 'Flying Probe in kurz: ' }), 'bewegliche Nadeln statt Prüfadapter. Flexibel und ohne Adapterkosten, dafür langsam. Unten findest du die ausführliche Erklärung. Im Reiter "Simulator" probierst du es an deiner eigenen Platine aus.']));
      FP_SECTIONS.forEach(sec => { const d = h('details', { class: 'pt-acc' }); if (sec.open) d.open = true; d.appendChild(h('summary', { text: sec.t })); d.appendChild(h('div', { html: sec.html })); host.appendChild(d); });
      const cl = host.querySelector('#pt-dft-checklist');
      if (cl) {
        const saved = lsGet('dft', []);
        DFT_CHECK.forEach((c, i) => {
          const inp = h('input', { type: 'checkbox' }); inp.checked = saved.indexOf(i) >= 0;
          inp.addEventListener('change', () => { const cur = lsGet('dft', []).filter(x => x !== i); if (inp.checked) cur.push(i); lsSet('dft', cur); upd(); if (inp.checked) { const r = inp.getBoundingClientRect(); env.fx('click', r.left, r.top); } });
          cl.appendChild(h('label', { class: 'pt-chk' }, [inp, h('span', null, [h('b', { text: c[0] }), h('div', { class: 'pt-mute', text: c[1] })])]));
        });
        const sum = h('div', { class: 'pt-note', style: 'margin-top:8px' }); cl.appendChild(sum);
        function upd() { const n = lsGet('dft', []).length; sum.className = 'pt-note' + (n === DFT_CHECK.length ? ' ok' : ''); sum.textContent = n + ' von ' + DFT_CHECK.length + ' Regeln abgehakt.' + (n === DFT_CHECK.length ? ' Dein Layout ist gut auf die Prüfung vorbereitet.' : ''); }
        upd();
      }
      const mm = host.querySelector('#pt-mini-matrix'); if (mm) mm.innerHTML = matrixHtml(['AOI', 'Flying Probe', 'ICT']);
      return { refresh() { /* statisch */ }, destroy() { /* nichts */ } };
    }

    function viewMethods(host, env) {
      /* Überblick */
      const c1 = h('div', { class: 'pt-card' }, [h('h3', { text: 'Weitere Prüfverfahren kurz erklärt' })]);
      METHODS.forEach((m, i) => { const d = h('details', { class: 'pt-acc' }); if (i === 0) d.open = true; d.appendChild(h('summary', { text: m.t })); d.appendChild(h('div', { html: m.html })); c1.appendChild(d); });
      host.appendChild(c1);
      /* Vergleichstabelle */
      host.appendChild(h('div', { class: 'pt-card' }, [h('h3', { text: 'Vergleich der Verfahren' }), h('div', { class: 'pt-tbl-wrap', html: '<table class="pt-tbl" style="min-width:820px"><thead><tr><th>Verfahren</th><th>Prüft</th><th>Findet</th><th>Kosten</th><th>Geschwindigkeit</th><th>Stückzahl</th></tr></thead><tbody>' + COMPARE.map(r => '<tr>' + r.map((c, i) => (i === 0 ? '<td><b>' + esc(c) + '</b></td>' : '<td>' + esc(c) + '</td>')).join('') + '</tr>').join('') + '</tbody></table>' }), h('p', { class: 'pt-mute', style: 'margin-top:6px', text: 'Wischen, falls die Tabelle breiter ist als der Bildschirm. Die Angaben sind Richtwerte für den Vergleich.' })]));
      host.appendChild(h('div', { class: 'pt-card' }, [h('h3', { text: 'Welche Fehler findet welches Verfahren?' }), h('div', { html: matrixHtml(MCOLS) })]));
      /* Entscheidungshilfe */
      const adv = h('div', { class: 'pt-card' }); adv.appendChild(h('h3', { text: 'Entscheidungshilfe: Welches Prüfverfahren?' }));
      const A = Object.assign({ v: 20, many: false, bga: false, jtag: false, dense: false }, lsGet('adv', {}));
      const out = h('div');
      const qOut = v => Math.round(Math.pow(10, v / 20));
      const o1 = h('output'), r1 = h('input', { type: 'range', min: 0, max: 100, step: 1, value: A.v });
      const upd = () => { const q = qOut(+r1.value); o1.textContent = String(q).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' Stück'; A.v = +r1.value; lsSet('adv', A); out.innerHTML = ''; advise(q, A.many, A.bga, A.jtag, A.dense).forEach(a => out.appendChild(h('div', { class: 'pt-note' }, [h('b', { text: a.m + ': ' }), a.why]))); };
      r1.addEventListener('input', upd);
      adv.appendChild(h('div', { class: 'pt-sl' }, [h('span', { class: 'pt-lbl', text: 'Stückzahl' }), r1, o1]));
      const cb = (k, t) => { const i = h('input', { type: 'checkbox', style: 'width:22px;height:22px;accent-color:#3b9eff' }); i.checked = !!A[k]; i.addEventListener('change', () => { A[k] = i.checked; upd(); }); return h('label', { class: 'pt-lbl', style: 'display:inline-flex;align-items:center;gap:6px;min-height:40px;margin-right:12px' }, [i, t]); };
      adv.appendChild(h('div', { class: 'pt-row' }, [cb('many', 'viele Varianten'), cb('bga', 'BGA oder QFN'), cb('jtag', 'ICs mit JTAG'), cb('dense', 'dichte Platine, wenig Testpunkte')]));
      adv.appendChild(out); host.appendChild(adv); upd();
      /* Quiz */
      const qc = h('div', { class: 'pt-card' }); qc.appendChild(h('h3', { text: 'Quiz: Welches Verfahren passt?' })); const qb = h('div'); qc.appendChild(qb); host.appendChild(qc);
      const Q = { i: 0, score: 0, done: false, order: [] };
      function shuffle(arr, seed) { return arr.map((v, i) => [hash(seed, 'o' + i), v]).sort((a, b) => a[0] - b[0]).map(a => a[1]); }
      function renderQ() {
        qb.innerHTML = '';
        if (Q.i >= QUIZ.length) {
          const best = Math.max(lsGet('quizBest', 0), Q.score); lsSet('quizBest', best); const pct = Math.round(100 * Q.score / QUIZ.length);
          qb.appendChild(h('div', { class: 'pt-note ' + (pct >= 70 ? 'ok' : 'warn') }, [h('b', { text: Q.score + ' von ' + QUIZ.length + ' richtig (' + pct + ' %). ' }), pct >= 90 ? 'Hervorragend: Du kennst die Prüfverfahren.' : pct >= 70 ? 'Gut gemacht. Lies bei den falschen Antworten noch einmal nach.' : 'Lies die Erklärungen in den Reitern Fertigungslinie und Flying Probe und versuche es noch einmal.']));
          qb.appendChild(h('div', { class: 'pt-mute', text: 'Bestes Ergebnis: ' + best + ' von ' + QUIZ.length }));
          qb.appendChild(h('button', { class: 'pt-btn pri', style: 'margin-top:8px', text: 'Quiz neu starten', onclick: () => { Q.i = 0; Q.score = 0; Q.seed = (Q.seed || 1) + 1; renderQ(); } }));
          if (!Q.fxDone) { Q.fxDone = true; const r = qb.getBoundingClientRect(); env.fx(pct >= 70 ? 'tada' : 'sad', r.left + r.width / 2, r.top + 40, pct >= 70 ? 'Quiz geschafft!' : 'Noch einmal üben!'); }
          return;
        }
        Q.fxDone = false; const q = QUIZ[Q.i], opts = shuffle(q.o.map((t, k) => ({ t, ok: k === q.a })), (Q.seed || 1) * 31 + Q.i);
        const box = h('div', { class: 'pt-q' }); box.appendChild(h('div', { class: 'pt-mute', text: 'Frage ' + (Q.i + 1) + ' von ' + QUIZ.length })); box.appendChild(h('div', { style: 'font-weight:700;margin:4px 0', text: q.q }));
        let answered = false; const fb = h('div');
        opts.forEach(o => { const btn = h('button', { class: 'opt', text: o.t }); btn.addEventListener('click', () => {
          if (answered) return; answered = true; const r = btn.getBoundingClientRect();
          [...box.querySelectorAll('button.opt')].forEach((bb, k) => { if (opts[k].ok) bb.classList.add('good'); }); if (o.ok) { Q.score++; env.fx('ding', r.left + r.width / 2, r.top, 'Richtig!'); } else { btn.classList.add('bad'); env.fx('sad', r.left + r.width / 2, r.top, 'Leider falsch'); }
          fb.appendChild(h('div', { class: 'pt-note ' + (o.ok ? 'ok' : 'err') }, [h('b', { text: o.ok ? 'Richtig. ' : 'Nicht ganz. ' }), q.e])); fb.appendChild(h('button', { class: 'pt-btn pri', text: Q.i + 1 >= QUIZ.length ? 'Ergebnis anzeigen' : 'Weiter', onclick: () => { Q.i++; renderQ(); } }));
        }); box.appendChild(btn); }); box.appendChild(fb); qb.appendChild(box);
      }
      renderQ();
      return { refresh() { /* statisch */ }, destroy() { /* nichts */ } };
    }

    function viewGloss(host, env) {
      const card = h('div', { class: 'pt-card' }); card.appendChild(h('h3', { text: 'Glossar' }));
      const inp = h('input', { class: 'pt-in', type: 'search', placeholder: 'Begriff suchen, z. B. Kelvin, JTAG, DFT', 'aria-label': 'Begriff suchen' }); card.appendChild(inp);
      const grid = h('div', { class: 'pt-gl', style: 'margin-top:10px' }); card.appendChild(grid); host.appendChild(card);
      const cnt = h('div', { class: 'pt-mute', style: 'margin-top:8px' }); card.appendChild(cnt);
      function render() { const q = inp.value.trim().toLowerCase(); grid.innerHTML = ''; let n = 0; GLOSSARY.forEach(g => { if (q && (g[0] + ' ' + g[1]).toLowerCase().indexOf(q) < 0) return; n++; grid.appendChild(h('div', null, [h('b', { text: g[0] }), h('span', { text: g[1] })])); }); cnt.textContent = n + ' von ' + GLOSSARY.length + ' Begriffen.'; }
      inp.addEventListener('input', render); render();
      return { refresh() { /* statisch */ }, destroy() { /* nichts */ } };
    }

    /* ====================================================================================
       Mount: Reiter innerhalb der Ansicht
       ==================================================================================== */
    function mountTest(el, ctx) {
      ensureCss();
      const fx = (k, x, y, t) => { try { if (ctx && ctx.fx) ctx.fx(k, x, y, t); } catch (e) { /* egal */ } };
      const TABS = [['line', 'Fertigungslinie'], ['fp', 'Flying Probe'], ['methods', 'Verfahren und Quiz'], ['sim', 'Simulator'], ['gloss', 'Glossar']];
      let tab = lsGet('tab', 'line'); if (!TABS.some(t => t[0] === tab)) tab = 'line';
      const rootEl = h('div', { class: 'pt' }), tabsEl = h('div', { class: 'pt-tabs', role: 'tablist' }), body = h('div', { class: 'pt-body' });
      rootEl.appendChild(tabsEl); rootEl.appendChild(body); el.innerHTML = ''; el.appendChild(rootEl);
      const env = { ctx, fx, root: rootEl, board: () => { try { return ctx.getBoard(); } catch (e) { return null; } } };
      let cur = null;
      function tabs() { tabsEl.innerHTML = ''; TABS.forEach(t => tabsEl.appendChild(h('button', { class: 'pt-tab' + (tab === t[0] ? ' on' : ''), role: 'tab', 'aria-selected': tab === t[0] ? 'true' : 'false', text: t[1], onclick: () => { tab = t[0]; lsSet('tab', tab); render(); } }))); }
      function render() {
        if (cur && cur.destroy) { try { cur.destroy(); } catch (e) { console.error(e); } } cur = null; Array.from(rootEl.querySelectorAll('.pt-ov')).forEach(o => o.remove());
        tabs(); body.innerHTML = ''; body.scrollTop = 0;
        try { cur = ({ line: viewLine, fp: viewFp, methods: viewMethods, sim: viewSim, gloss: viewGloss })[tab](body, env) || {}; }
        catch (e) { console.error('Prüfen:', e); body.innerHTML = ''; body.appendChild(h('div', { class: 'pt-note err', text: 'Dieser Reiter konnte nicht gestartet werden: ' + (e && e.message || e) })); }
      }
      render();
      return {
        refresh(why) { if (cur && cur.refresh) { try { cur.refresh(why); } catch (e) { console.error(e); } } },
        onBoard() { if (cur && cur.refresh) { try { cur.refresh('board'); } catch (e) { console.error(e); } } },
        onShow() { if (cur && cur.onResize) { try { cur.onResize(); } catch (e) { console.error(e); } } if (cur && cur.refresh && tab === 'sim') { try { cur.refresh('show'); } catch (e) { console.error(e); } } },
        onHide() { if (cur && cur.onHide) { try { cur.onHide(); } catch (e) { /* egal */ } } },
        onResize() { if (cur && cur.onResize) { try { cur.onResize(); } catch (e) { console.error(e); } } },
        destroy() { if (cur && cur.destroy) { try { cur.destroy(); } catch (e) { /* egal */ } } cur = null; }
      };
    }
    root.PCB_VIEWS.register('test', { title: 'Prüfen', mount: mountTest });
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') installUi();
})(typeof window !== 'undefined' ? window : globalThis);
