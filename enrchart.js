/* enrchart.js - Energie-Lab Diagramme (ENR_CHART, Version 1.0)
 * Kennlinien (I-U, P-U, Kurvenscharen, P(R)), Tagesgang, gestapelte Flaechen, Ladekennlinie mit Phasenbaendern, Wirkungsgradkurve mit
 * Euro-Eta-Stuetzstellen, Sonnenbahn, Balken (Tagesenergie, Strangpruefung, Bilanz), allgemeine Liniendiagramme.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval, offline. Browser: window.ENR_CHART, Node: module.exports / globalThis.ENR_CHART.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Jede Zeichenfunktion hat die Form f(ctx, rect, daten, opts). rect = { x, y, w, h } in Pixeln des Kontexts (Mindestgroesse 80 x 60).
 *    Rueckgabe = Layout-Objekt (siehe unten) oder null. null heisst: es gab KEINEN Aufruf am ctx (ctx fehlt, rect unbrauchbar oder zu klein,
 *    nicht endlich, riesig). Unsinnige Daten werfen nie: Punkte, die keine endlichen Zahlen sind, werden ausgelassen; ohne Daten erscheint
 *    der Text "Keine Daten" im Rahmen (Layout mit empty:true).
 *  - Die Daten sind genau das, was ENR_RIGS[..].curves() liefert (ein Eintrag je Diagramm), plus die dayTrace-Form { t, g, gClear, pv, load, soc }
 *    fuer dayChart:
 *      { id, kind?, title, xLabel, xUnit, yLabel, yUnit, yLabel2?, yUnit2?, xScale?:'log', xMin?, xMax?, yMin?, yMax?,
 *        series:[{ name, points:[[x,y]..], color?, dash?:[..] | line?:'solid'|'dash'|'dot'|'dashdot'|'dotdash' | style?:'solid'|'dashed'|'dotted' | dashed?,
 *                  bold?, current?, width?, axis?:'right', unit?, fill? }],
 *        marker?:{ x, y, label?, axis? }, marks?:[{ x, y, label, global? }], rects?:[{ x0, y0, x1, y1, name, fill?, dash? }],
 *        bands?:[{ from, to, stage 0..3, label }], now?, night?:{ rise, set, polar }, stack?:[{ name, points, line? }], best?:{ x },
 *        euroPoints?:[{ p, eta, weight }], euroEta?, lostWh?, hlines?:[{ y, label }], vlines?:[{ x, label }],
 *        bars?:[{ id, label, value, unit, limit?, ok? }], euro?:[{ id, label, value, unit }], note?, iscSumme?, idcMax? }
 *  - Farben und Linienarten (Farbenblindheit): jede Kurve unterscheidet sich zusaetzlich zur Farbe durch Linienart und steht in der Legende;
 *    Flaechen, Baender und Marken tragen ein Textschild. Farben fuer Energiefluesse wie ENR_DRAW (Solar Gold, Last Violett, Netzbezug Rot ...).
 *  - Schrift mindestens 11 px, Dezimalkomma, echtes Minuszeichen, Einheit an jeder Zahl in Wertanzeigen. Alle Texte werden auf die verfuegbare
 *    Breite gekuerzt (nie ueber den rect hinaus).
 *
 * LAYOUT-RUECKGABE (Linien-, Tages-, Flaechen-, Sonnen-, Eta-Diagramme)
 *  { kind, empty, rect, plot:{x,y,w,h}, xr:{min,max,log}, yr:{min,max}, yr2:{min,max}|null,
 *    xPx(x), yPx(y, rechts?), xAt(px), yAt(py, rechts?), valueAt(px, py) -> null | { x, xText, y, rows:[{ name, y, text, color, dash }], marker? }, series:[..], legend:[..] }
 *  Balken: { kind:'bars', plot, bars:[{ id, label, value, unit, x, y, w, h }], valueAt(px, py) -> null | { id, label, value, text }, xAt, yAt (NaN) }
 *
 * FUNKTIONEN
 *  chart(ctx, rect, curve, opts)   Verteiler nach curve.kind bzw. Inhalt
 *  ivChart, dayChart, stackChart, chargeChart, etaChart, sunChart, barChart, lineChart (alle (ctx, rect, daten, opts))
 *  crosshair(ctx, layout, px, py, opts) -> null | { x, rows, text }   Fadenkreuz mit Wertanzeige
 *  theme(el) -> Farbobjekt aus den CSS-Variablen der Seite ; fm(v, d) ; fns ; version
 *  opts: { colors:{ fg, mute, grid, axis, plot, panel, night, halo, danger, ok, warn, accent, now } | light:true, title:true, legend:true|false,
 *          markerName, showMarkerLabel, peaks:false, maxPoints }
 * ===================================================================================================
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Hilfen */
  const TAU = Math.PI * 2, MINUS = '−';
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e12;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  const str = v => (typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : ''));
  /* Zahl mit Dezimalkomma und Minuszeichen */
  function fm(v, d) {
    if (typeof v !== 'number' || !isFinite(v)) return '–';
    d = (typeof d === 'number' && isFinite(d)) ? cl(Math.round(d), 0, 8) : 1;
    const a = Math.abs(v);
    if (a >= 1e15) return (v < 0 ? MINUS : '') + a.toExponential(2).replace('.', ',');
    let s = a.toFixed(d).replace('.', ',');
    if (v < 0 && +a.toFixed(d) !== 0) s = MINUS + s;
    return s;
  }
  const autoDec = v => { v = Math.abs(v); return v === 0 ? 0 : v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fa = v => { let s = fm(v, autoDec(v)); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; };
  function hhmm(x) {
    if (!fin(x)) return '–';
    let m = Math.round((((x % 24) + 24) % 24) * 60); if (m >= 1440) m -= 1440;
    const h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }

  const DARK = { light: false, fg: '#e8ecf0', mute: '#9aa7b3', grid: 'rgba(150,165,180,0.20)', axis: '#6b7785', plot: 'rgba(255,255,255,0.03)', panel: 'rgba(16,21,26,0.93)', night: 'rgba(24,34,84,0.40)', halo: 'rgba(10,14,18,0.85)', danger: '#ff6b6b', ok: '#3ddc84', warn: '#ffb340', accent: '#4ea1ff', now: '#ffd54a' };
  const LIGHT = { light: true, fg: '#1c2329', mute: '#5a6672', grid: 'rgba(60,80,100,0.18)', axis: '#9aa7b3', plot: 'rgba(0,0,0,0.03)', panel: 'rgba(255,255,255,0.95)', night: 'rgba(60,80,140,0.22)', halo: 'rgba(255,255,255,0.85)', danger: '#c42b2b', ok: '#1d8a36', warn: '#a85d00', accent: '#1a6fd4', now: '#a87400' };
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 64 && !/NaN|undefined|null|Infinity/i.test(v);
  function resolveTheme(opts) {
    const o = obj(opts), c = obj(o.colors), base = (o.light === true || c.light === true) ? LIGHT : DARK, th = {};
    Object.keys(base).forEach(k => { th[k] = (k !== 'light' && goodColor(c[k])) ? c[k] : base[k]; });
    return th;
  }
  /* Farben aus den CSS-Variablen der Seite (--fg, --mute, --chart-grid, --chart-axis, --well) */
  function theme(el) {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return {};
    const out = {};
    try {
      const cs = getComputedStyle(el && el.nodeType === 1 ? el : document.documentElement), v = k => (cs.getPropertyValue(k) || '').trim();
      [['fg', '--fg'], ['mute', '--mute'], ['grid', '--chart-grid'], ['axis', '--chart-axis']].forEach(p => { const x = v(p[1]); if (goodColor(x)) out[p[0]] = x; });
      const bg = v('--bg'), m = /^#([0-9a-f]{6})$/i.exec(bg);
      if (m) { const r = parseInt(m[1].slice(0, 2), 16), g = parseInt(m[1].slice(2, 4), 16), b = parseInt(m[1].slice(4, 6), 16); if (0.299 * r + 0.587 * g + 0.114 * b > 150) out.light = true; }
      if (out.light) { out.grid = out.grid || LIGHT.grid; }
    } catch (e) { /* Standard */ }
    return out;
  }

  const PAL = ['#4ea1ff', '#ffc83d', '#3ddc84', '#ff7a59', '#c792ea', '#2dd4bf', '#ff6b6b', '#9aa5b1'];
  /* Farbe nach Bedeutung des Namens (wie die Energiefluss-Pfeile), sonst nach Reihenfolge */
  const SEM = [[/potenzial|klaren? himmel/i, '#ffe9a0'], [/netzbezug/i, '#ff6b6b'], [/einspeis/i, '#2dd4bf'], [/entl(ä|ae)dt|entladen/i, '#4fd8ff'], [/speicher l(ä|ae)dt|akku l(ä|ae)dt|in den speicher/i, '#3ddc84'],
    [/ladezustand/i, '#8be28b'], [/solar|feldleistung|leistung des feldes/i, '#ffc83d'], [/last|haus|verbrauch/i, '#c792ea'], [/einstrahlung/i, '#ff9a3d'], [/unverschattet|gemerkt|vorher/i, '#9aa5b1'], [/weg des/i, '#ff7a59'], [/spannung/i, '#4ea1ff']];
  const DASH = { solid: [], dash: [9, 5], dashed: [9, 5], dot: [2, 4], dotted: [2, 4], dashdot: [10, 4, 2, 4], dotdash: [2, 4, 10, 4] };
  const SEMDASH = [[/potenzial|klaren? himmel/i, 'dash']];
  const STAGE = [{ n: 'aus', c: 'rgba(150,160,170,0.20)' }, { n: 'Bulk', c: 'rgba(255,154,61,0.20)' }, { n: 'Absorption', c: 'rgba(255,213,74,0.20)' }, { n: 'Float', c: 'rgba(61,220,132,0.20)' }];

  function dashOf(s) {
    if (Array.isArray(s.dash)) { const d = s.dash.filter(v => typeof v === 'number' && isFinite(v) && v >= 0); return d.length ? d : []; }
    const k = s.line || s.style || (s.dashed ? 'dash' : '');
    if (k && DASH[k]) return DASH[k];
    return [];
  }

  /* ------------------------------------------------------------------ Text */
  function setFont(ctx, px, bold) { ctx.font = (bold ? '600 ' : '') + px + 'px system-ui, sans-serif'; }
  function tw(ctx, s, px, bold) { setFont(ctx, px, bold); const m = ctx.measureText(s); return m && fin(m.width) ? m.width : s.length * px * 0.58; }
  function fit(ctx, s, maxW, px, bold) {
    if (!(maxW > 4)) return '';
    if (tw(ctx, s, px, bold) <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (tw(ctx, s.slice(0, mid) + '…', px, bold) <= maxW) lo = mid; else hi = mid - 1; }
    return lo > 0 ? s.slice(0, lo) + '…' : '';
  }
  /* o: size, bold, color, align, halo, maxW */
  function txt(ctx, s, x, y, o) {
    o = o || {}; s = String(s); const px = Math.max(11, o.size || 12);
    if (o.maxW !== undefined) s = fit(ctx, s, o.maxW, px, o.bold);
    if (!s) return 0;
    setFont(ctx, px, o.bold); ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
    if (o.halo) { ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = o.halo; ctx.strokeText(s, x, y); }
    ctx.fillStyle = o.color || '#fff'; ctx.fillText(s, x, y);
    return tw(ctx, s, px, o.bold);
  }

  /* ------------------------------------------------------------------ Skalen */
  function niceStep(range, n) {
    if (!(range > 0) || !(n > 0)) return 1;
    const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag;
    return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  }
  function ticksOf(lo, hi, n) {
    if (!(hi > lo)) hi = lo + 1;
    const s = niceStep(hi - lo, Math.max(1, n)), t = [];
    for (let v = Math.ceil(lo / s - 1e-9) * s, k = 0; v <= hi + s * 1e-6 && k < 60; v += s, k++) t.push(+v.toPrecision(12));
    return { t, s };
  }
  const tickDec = s => cl(Math.ceil(-Math.log10(s) - 1e-9), 0, 6);
  function logTicks(lo, hi) {
    const t = [], e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi));
    for (let e = e0; e <= e1 && t.length < 40; e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e); if (v >= lo * 0.999 && v <= hi * 1.001) t.push(v); });
    return { t: t.length >= 2 ? t : [lo, hi], s: 0 };
  }
  const logFmt = v => (v >= 1 ? fm(v, 0) : fm(v, Math.min(4, Math.ceil(-Math.log10(v)))));
  function extent(vals) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < vals.length; i++) { const v = vals[i]; if (fin(v)) { if (v < lo) lo = v; if (v > hi) hi = v; } }
    return lo <= hi ? { lo, hi } : null;
  }
  /* y-Bereich: Kopfraum, Null einbeziehen, runde Grenzen */
  function yRange(ext, force, o) {
    let lo = ext ? ext.lo : 0, hi = ext ? ext.hi : 1;
    const nonneg = lo >= 0;
    if (o.zero === true && lo > 0) lo = 0;
    else if (o.zero === undefined && lo > 0 && lo < hi * 0.5) lo = 0;
    if (!(hi > lo)) { const d = Math.max(Math.abs(hi) * 0.1, 1); lo -= d; hi += d; if (nonneg && lo < 0 && o.zero !== false) lo = 0; }
    if (!fin(force.max)) hi += (hi - lo) * 0.06;
    if (fin(force.min)) lo = force.min;
    if (fin(force.max)) hi = force.max;
    if (!(hi > lo)) hi = lo + 1;
    return { min: lo, max: hi, fixMin: fin(force.min), fixMax: fin(force.max) };
  }
  /* runde Achsengrenzen auf Tick-Vielfache, Rueckgabe Ticks */
  function niceAxis(q, n) {
    let t = ticksOf(q.min, q.max, n);
    if (t.t.length >= 2) {
      if (!q.fixMin) q.min = Math.floor(q.min / t.s + 1e-9) * t.s;
      if (!q.fixMax) q.max = Math.ceil(q.max / t.s - 1e-9) * t.s;
      q.min = +q.min.toPrecision(12); q.max = +q.max.toPrecision(12);
      if (!(q.max > q.min)) q.max = q.min + t.s;
      t = ticksOf(q.min, q.max, n);
    }
    return t;
  }

  /* ------------------------------------------------------------------ Daten ordnen */
  function cleanPts(pts, log) {
    const out = []; if (!Array.isArray(pts)) return out;
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; if (Array.isArray(p) && fin(p[0]) && fin(p[1]) && (!log || p[0] > 0)) out.push([p[0], p[1]]); }
    return out;
  }
  const isSorted = pts => { for (let i = 1; i < pts.length; i++) if (pts[i][0] < pts[i - 1][0]) return false; return true; };
  function interp(pts, sorted, x) {
    const n = pts.length; if (!n) return NaN;
    if (sorted) {
      if (x < pts[0][0] || x > pts[n - 1][0]) { const e = x < pts[0][0] ? pts[0] : pts[n - 1], span = Math.max(1e-12, pts[n - 1][0] - pts[0][0]); return Math.abs(x - e[0]) <= span * 0.03 ? e[1] : NaN; }
      let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
      const a = pts[lo], b = pts[hi], d = b[0] - a[0]; return d > 0 ? a[1] + (b[1] - a[1]) * (x - a[0]) / d : a[1];
    }
    let best = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.abs(pts[i][0] - x); if (d < bd) { bd = d; best = i; } }
    return pts[best][1];
  }
  function fromDay(d) {
    const t = Array.isArray(d.t) ? d.t : [], zip = a => (Array.isArray(a) ? t.map((x, i) => [x, a[i]]) : []), s = [];
    if (Array.isArray(d.gClear)) s.push({ name: 'Einstrahlung bei klarem Himmel (Potenzial)', points: zip(d.gClear), line: 'dash' });
    if (Array.isArray(d.g)) s.push({ name: 'Einstrahlung', points: zip(d.g), line: 'solid' });
    if (Array.isArray(d.pv)) s.push({ name: 'Solarleistung', points: zip(d.pv), line: 'solid' });
    if (Array.isArray(d.load)) s.push({ name: 'Lastleistung', points: zip(d.load), line: 'dot' });
    if (Array.isArray(d.soc)) s.push({ name: 'Ladezustand (%)', points: zip(d.soc), axis: 'right', unit: '%', line: 'dashdot' });
    return s;
  }
  function inferKind(c) {
    if (Array.isArray(c.bars)) return 'bars';
    if (Array.isArray(c.stack)) return 'stack';
    if (Array.isArray(c.euroPoints)) return 'eta';
    if (Array.isArray(c.bands)) return 'charge';
    if (fin(c.now)) return 'day';
    if (c.id === 'sonnenbahn') return 'sun';
    if (c.id === 'iu' || c.id === 'pu' || c.id === 'schar-iu' || c.id === 'schar-pu' || c.id === 'p-r') return 'iv';
    return 'line';
  }

  /* Modell: alles, was gezeichnet wird, in einheitlicher Form */
  function model(data, kind, opts) {
    const d = obj(data), o = obj(opts), log = d.xScale === 'log';
    let src = Array.isArray(d.series) ? d.series : (Array.isArray(d.t) ? fromDay(d) : []);
    const series = [];
    src.forEach((s0, i) => {
      const s = obj(s0), pts = cleanPts(s.points, log); if (!pts.length) return;
      const nm = str(s.name) || ('Reihe ' + (series.length + 1));
      let color = goodColor(s.color) ? s.color : null, ds = dashOf(s);
      if (!color) { const m = SEM.find(q => q[0].test(nm)); color = m ? m[1] : PAL[i % PAL.length]; }
      if (!ds.length && !s.line && !s.style && !s.dash && !s.dashed) { const m = SEMDASH.find(q => q[0].test(nm)); if (m) ds = DASH[m[1]]; }
      series.push({ name: nm, pts, sorted: isSorted(pts), color, dash: ds, lw: (s.bold || s.current) ? 3.2 : (fin(s.width) && s.width > 0 ? cl(s.width, 0.5, 8) : 2), axis: s.axis === 'right' || s.axis === 'r' ? 'r' : 'l', unit: str(s.unit), fill: s.fill === true, dots: s.dots === true });
    });
    const stack = [];
    (Array.isArray(d.stack) ? d.stack : []).forEach((s0, i) => {
      const s = obj(s0), pts = cleanPts(s.points, false); if (!pts.length) return;
      const nm = str(s.name) || ('Anteil ' + (stack.length + 1));
      let color = goodColor(s.color) ? s.color : null; if (!color) { const m = SEM.find(q => q[0].test(nm)); color = m ? m[1] : PAL[(i + 2) % PAL.length]; }
      stack.push({ name: nm, pts, sorted: isSorted(pts), color, dash: dashOf(s), unit: str(s.unit) });
    });
    const marks = [];
    (Array.isArray(d.marks) ? d.marks : []).forEach(m0 => { const m = obj(m0); if (fin(m.x) && fin(m.y) && (!log || m.x > 0)) marks.push({ x: m.x, y: m.y, label: str(m.label), global: m.global === true }); });
    const rects = [];
    (Array.isArray(d.rects) ? d.rects : []).forEach(r0 => { const r = obj(r0); if (fin(r.x0) && fin(r.y0) && fin(r.x1) && fin(r.y1)) rects.push({ x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, name: str(r.name), fill: r.fill === true, dash: Array.isArray(r.dash) ? r.dash.filter(v => fin(v) && v >= 0) : null }); });
    const bands = [];
    (Array.isArray(d.bands) ? d.bands : []).forEach(b0 => { const b = obj(b0); if (fin(b.from) && fin(b.to) && b.to > b.from) bands.push({ from: b.from, to: b.to, stage: cl(Math.round(fin(b.stage) ? b.stage : 0), 0, 3), label: str(b.label) }); });
    const hl = [], vl = [];
    (Array.isArray(d.hlines) ? d.hlines : []).forEach(h0 => { const h = obj(h0); if (fin(h.y)) hl.push({ y: h.y, label: str(h.label), color: goodColor(h.color) ? h.color : null }); });
    (Array.isArray(d.vlines) ? d.vlines : []).forEach(v0 => { const v = obj(v0); if (fin(v.x)) vl.push({ x: v.x, label: str(v.label), color: goodColor(v.color) ? v.color : null }); });
    if (d.best && fin(d.best.x)) vl.push({ x: d.best.x, label: 'Optimum ' + fm(d.best.x, 0) + (str(d.xUnit) ? ' ' + str(d.xUnit) : ''), color: null });
    const mk = obj(d.marker), marker = fin(mk.x) && fin(mk.y) && (!log || mk.x > 0) ? { x: mk.x, y: mk.y, label: str(mk.label), axis: mk.axis === 'right' ? 'r' : 'l' } : null;
    const night = d.night && typeof d.night === 'object' ? { rise: fin(d.night.rise) ? d.night.rise : NaN, set: fin(d.night.set) ? d.night.set : NaN, polar: d.night.polar === 'nacht' || d.night.polar === 'tag' ? d.night.polar : null } : null;
    const euro = [];
    (Array.isArray(d.euroPoints) ? d.euroPoints : []).forEach(e0 => { const e = obj(e0); if (fin(e.p) && fin(e.eta)) euro.push({ p: e.p, eta: e.eta, w: fin(e.weight) ? e.weight : NaN }); });
    return { kind, log, series, stack, marks, rects, bands, hl, vl, marker, night, euro, euroEta: fin(d.euroEta) ? d.euroEta : NaN, now: fin(d.now) ? d.now : NaN, lostWh: fin(d.lostWh) ? d.lostWh : NaN,
      xLabel: str(d.xLabel), xUnit: str(d.xUnit), yLabel: str(d.yLabel), yUnit: str(d.yUnit), yLabel2: str(d.yLabel2), yUnit2: str(d.yUnit2), title: str(d.title),
      xMin: d.xMin, xMax: d.xMax, yMin: d.yMin, yMax: d.yMax, id: str(d.id) };
  }

  /* ------------------------------------------------------------------ Linien-, Tages-, Flaechen-, Sonnen-, Eta-Diagramme */
  function plotChart(ctx, rect, data, opts, kind) {
    if (!ctx || typeof ctx.beginPath !== 'function' || typeof ctx.fillText !== 'function') return null;
    const r = obj(rect);
    if (!fin(r.x) || !fin(r.y) || !fin(r.w) || !fin(r.h) || r.w < 80 || r.h < 60 || r.w > 20000 || r.h > 20000) return null;
    const o = obj(opts), th = resolveTheme(o), M = model(data, kind, o), RX = r.x, RY = r.y, RW = r.w, RH = r.h;
    const fs = RW >= 560 ? 12 : 11, rowH = fs + 5;
    const hasR = M.series.some(s => s.axis === 'r');
    const dayLike = kind === 'day' || kind === 'stack' || (M.night && !M.log) || fin(M.now);
    const sunK = kind === 'sun';

    /* ---- x-Bereich */
    let xe = extent([].concat(...M.series.map(s => s.pts.map(p => p[0])), ...M.stack.map(s => s.pts.map(p => p[0])), M.marks.map(m => m.x), M.marker ? [M.marker.x] : [], ...M.rects.map(q => [q.x0, q.x1]), M.euro.map(e => e.p), M.vl.map(v => v.x), M.bands.map(b => b.from), M.bands.map(b => b.to)));
    let xmin = xe ? xe.lo : 0, xmax = xe ? xe.hi : 1;
    if (dayLike && !fin(M.xMin) && !fin(M.xMax)) { xmin = 0; xmax = 24; }
    if (kind === 'iv' && !M.log && xmin > 0 && !fin(M.xMin)) xmin = 0;
    if (sunK && !fin(M.xMin) && !fin(M.xMax)) { const a = Math.min(-90, Math.floor((xmin - 5) / 30) * 30), b = Math.max(90, Math.ceil((xmax + 5) / 30) * 30); xmin = a; xmax = b; }
    if (fin(M.xMin)) xmin = M.xMin; if (fin(M.xMax)) xmax = M.xMax;
    if (M.log) { if (!(xmin > 0)) xmin = 0.01; if (!(xmax > xmin * 1.0001)) xmax = xmin * 10; } else if (!(xmax > xmin)) { xmax = xmin + 1; }

    /* ---- y-Bereiche */
    const lv = [], rv = [];
    M.series.forEach(s => { (s.axis === 'r' ? rv : lv).push(...s.pts.map(p => p[1])); });
    if (M.stack.length) {
      const base = M.stack[0].pts, sorted = M.stack.every(s => s.sorted);
      let pos = base.map(() => 0), neg = base.map(() => 0);
      M.stack.forEach(s => { base.forEach((p, i) => { const v = sorted ? interp(s.pts, true, p[0]) : p[1]; if (fin(v)) { if (v >= 0) pos[i] += v; else neg[i] += v; } }); });
      lv.push(...pos, ...neg, 0);
    }
    M.marks.forEach(m => lv.push(m.y)); M.rects.forEach(q => lv.push(q.y0, q.y1)); M.hl.forEach(h => lv.push(h.y)); M.euro.forEach(e => lv.push(e.eta));
    if (fin(M.euroEta)) lv.push(M.euroEta);
    if (M.marker) (M.marker.axis === 'r' ? rv : lv).push(M.marker.y);
    const zeroOpt = (kind === 'eta') ? false : (kind === 'iv' || kind === 'day' || kind === 'stack' || kind === 'sun') ? true : undefined;
    const ey = extent(lv);
    const yr = yRange(ey, { min: M.yMin, max: M.yMax }, { zero: zeroOpt });
    if (sunK && !fin(M.yMax)) { yr.max = Math.max(30, Math.ceil(((ey ? ey.hi : 60) + 4) / 10) * 10); yr.fixMax = true; }
    let yr2 = null;
    if (hasR) {
      const e2 = extent(rv), pct = /%/.test(M.yUnit2 || '') || M.series.some(s => s.axis === 'r' && /%/.test(s.unit));
      yr2 = yRange(e2, { min: pct && e2 && e2.lo >= 0 ? 0 : undefined, max: pct && e2 && e2.hi <= 100 ? 100 : undefined }, { zero: true });
    }

    /* ---- Legende (Elemente) */
    const markerName = str(o.markerName) || (fin(M.now) ? 'jetzt' : kind === 'iv' ? 'Arbeitspunkt' : kind === 'sun' ? 'Sonne jetzt' : kind === 'eta' ? 'Betriebspunkt' : 'Betriebspunkt');
    const items = [];
    M.stack.forEach(s => items.push({ name: s.name, color: s.color, dash: s.dash, area: true }));
    M.series.forEach(s => items.push({ name: s.name, color: s.color, dash: s.dash, lw: s.lw, dot: s.dots }));
    if (M.marker) items.push({ name: markerName, color: th.danger, dot: true });
    if (kind === 'eta' && M.euro.length) items.push({ name: 'Stützstellen des Europäischen Wirkungsgrads', color: th.warn, diamond: true });
    if (M.rects.length) M.rects.forEach(q => { if (q.name) items.push({ name: q.name, color: q.fill ? th.accent : th.mute, dash: q.dash || [], area: q.fill }); });
    const wantLegend = o.legend === true || (o.legend !== false && items.length >= 2);
    const legRows = [];
    let legendH = 0, xtitle = M.xLabel ? (M.xLabel + (M.xUnit ? ' in ' + M.xUnit : '')) : (M.xUnit ? 'in ' + M.xUnit : '');
    if (kind === 'day' && !M.xLabel) xtitle = 'Sonnenzeit in h';
    let ytitle = M.yLabel ? (M.yLabel + (M.yUnit ? ' in ' + M.yUnit : '')) : (M.yUnit ? 'in ' + M.yUnit : '');
    let ytitle2 = M.yLabel2 ? (M.yLabel2 + (M.yUnit2 ? ' in ' + M.yUnit2 : '')) : (M.yUnit2 ? 'in ' + M.yUnit2 : '');
    let ttl = o.title ? M.title : '';
    function layoutLegend(maxRows) {
      legRows.length = 0; if (!wantLegend) return 0;
      const wmax = RW - 16; let row = [], rw = 0;
      items.forEach(it => {
        const w = 26 + Math.min(wmax - 26, tw(ctx, it.name, fs, false)) + 12;
        if (row.length && rw + w > wmax) { legRows.push(row); row = []; rw = 0; }
        row.push({ it, w }); rw += w;
      });
      if (row.length) legRows.push(row);
      if (legRows.length > maxRows) legRows.length = maxRows;
      return legRows.length * (fs + 5) + 4;
    }
    /* ---- senkrechte Aufteilung, stufenweise verkleinern, wenn der Platz fehlt */
    let showTitles = true, topH, bottomH;
    const calcV = () => {
      legendH = wantLegend ? layoutLegend(3) : 0;
      topH = 6 + (ttl ? rowH : 0) + (showTitles && (ytitle || ytitle2) ? rowH + 4 : 0);
      bottomH = 6 + rowH + (showTitles && xtitle ? rowH : 0) + legendH + 2;
    };
    calcV();
    if (RH - topH - bottomH < 60 && wantLegend) { legendH = 0; legRows.length = 0; bottomH = 6 + rowH + (showTitles && xtitle ? rowH : 0) + 2; }
    if (RH - topH - bottomH < 50) { ttl = ''; showTitles = false; topH = 6; bottomH = 6 + rowH + 2; }
    const py0 = RY + topH, ph = Math.max(10, RH - topH - bottomH);

    /* ---- y-Ticks, linker/rechter Rand */
    const ny = Math.max(2, Math.floor(ph / 38));
    const ty = niceAxis(yr, ny), ydec = tickDec(ty.s), ylab = v => fm(v, ydec);
    let ty2 = null, ydec2 = 0;
    if (yr2) { ty2 = niceAxis(yr2, ny); ydec2 = tickDec(ty2.s); }
    let lw = 0; ty.t.forEach(v => { lw = Math.max(lw, tw(ctx, ylab(v), fs, false)); });
    let rw = 0; if (yr2) ty2.t.forEach(v => { rw = Math.max(rw, tw(ctx, fm(v, ydec2), fs, false)); });
    const pxl = RX + Math.min(RW * 0.3, lw + 12), pxr = RX + RW - (yr2 ? Math.min(RW * 0.25, rw + 12) : 14), pw = Math.max(10, pxr - pxl);

    /* ---- x-Ticks */
    let tx;
    if (M.log) tx = logTicks(xmin, xmax);
    else if (dayLike && xmin === 0 && xmax === 24) { const st = pw >= 330 ? 3 : 6, t = []; for (let v = 0; v <= 24; v += st) t.push(v); tx = { t, s: st }; }
    else if (sunK) { const t = []; for (let v = Math.ceil(xmin / 30) * 30; v <= xmax + 1e-9; v += 30) t.push(v); tx = { t, s: 30 }; }
    else tx = ticksOf(xmin, xmax, Math.max(2, Math.floor(pw / 74)));
    const xdec = tickDec(tx.s || 1), xlab = v => (M.log ? logFmt(v) : fm(v, tx.s ? xdec : 0));

    const lgx = Math.log10;
    const X = x => pxl + pw * (M.log ? (lgx(Math.max(x, 1e-300)) - lgx(xmin)) / ((lgx(xmax) - lgx(xmin)) || 1) : (x - xmin) / ((xmax - xmin) || 1));
    const Y = (y, right) => { const q = right && yr2 ? yr2 : yr; return py0 + ph * (1 - (y - q.min) / ((q.max - q.min) || 1)); };
    const XA = px => { const f = (px - pxl) / pw; return M.log ? Math.pow(10, lgx(xmin) + f * (lgx(xmax) - lgx(xmin))) : xmin + f * (xmax - xmin); };
    const YA = (py, right) => { const q = right && yr2 ? yr2 : yr, f = 1 - (py - py0) / ph; return q.min + f * (q.max - q.min); };
    const plot = { x: pxl, y: py0, w: pw, h: ph };

    /* ---- Rahmen, Raster, Beschriftung */
    ctx.save();
    ctx.fillStyle = th.plot; ctx.fillRect(pxl, py0, pw, ph);
    ctx.lineWidth = 1; ctx.strokeStyle = th.grid; ctx.setLineDash([]);
    ctx.beginPath();
    ty.t.forEach(v => { const y = Math.round(Y(v)) + 0.5; if (y >= py0 - 0.5 && y <= py0 + ph + 0.5) { ctx.moveTo(pxl, y); ctx.lineTo(pxl + pw, y); } });
    tx.t.forEach(v => { const x = Math.round(X(v)) + 0.5; if (x >= pxl - 0.5 && x <= pxl + pw + 0.5) { ctx.moveTo(x, py0); ctx.lineTo(x, py0 + ph); } });
    ctx.stroke();
    /* Nachtschattierung (Tagesgang) */
    if (M.night && xmin === 0 && xmax === 24) {
      const nb = [];
      if (M.night.polar === 'nacht') nb.push([0, 24]); else if (M.night.polar !== 'tag' && fin(M.night.rise) && fin(M.night.set)) { if (M.night.rise > 0) nb.push([0, Math.min(24, M.night.rise)]); if (M.night.set < 24) nb.push([Math.max(0, M.night.set), 24]); }
      ctx.fillStyle = th.night;
      nb.forEach(b => { ctx.fillRect(X(b[0]), py0, Math.max(0, X(b[1]) - X(b[0])), ph); });
      ctx.save(); ctx.beginPath(); ctx.rect(pxl, py0, pw, ph); ctx.clip();
      nb.forEach(b => { const wpx = X(b[1]) - X(b[0]); if (wpx > 60) txt(ctx, M.night.polar === 'nacht' ? 'Polarnacht' : 'Nacht', (X(b[0]) + X(b[1])) / 2, py0 + ph - 8, { size: fs, color: th.mute, align: 'center', maxW: wpx - 8 }); });
      if (M.night.polar === 'tag') txt(ctx, 'Polartag', pxl + 6, py0 + ph - 8, { size: fs, color: th.mute });
      ctx.restore();
    }
    ctx.strokeStyle = th.axis; ctx.lineWidth = 1; ctx.strokeRect(pxl + 0.5, py0 + 0.5, pw, ph);
    /* Achsenbeschriftung */
    ty.t.forEach(v => { const y = Y(v); if (y >= py0 - 2 && y <= py0 + ph + 2) txt(ctx, ylab(v), pxl - 6, y + 4, { size: fs, color: th.mute, align: 'right', maxW: pxl - RX - 4 }); });
    if (yr2) ty2.t.forEach(v => { const y = Y(v, true); if (y >= py0 - 2 && y <= py0 + ph + 2) txt(ctx, fm(v, ydec2), pxl + pw + 6, y + 4, { size: fs, color: th.mute, align: 'left', maxW: RX + RW - (pxl + pw) - 6 }); });
    const lastX = tx.t.length ? X(tx.t[tx.t.length - 1]) : 0;
    tx.t.forEach(v => {
      const x = X(v); if (x < pxl - 1 || x > pxl + pw + 1) return;
      const s = xlab(v), w = tw(ctx, s, fs, false), al = (x + w / 2 > RX + RW - 1) ? 'right' : (x - w / 2 < RX + 1 ? 'left' : 'center');
      txt(ctx, s, al === 'right' ? Math.min(x + w / 2, RX + RW - 1) : al === 'left' ? Math.max(x - w / 2, RX + 1) : x, py0 + ph + fs + 4, { size: fs, color: th.mute, align: al, maxW: RW - 4 });
    });
    void lastX;
    if (showTitles) {
      if (xtitle) txt(ctx, xtitle, pxl + pw / 2, py0 + ph + fs + 4 + rowH - 1, { size: fs, color: th.fg, align: 'center', maxW: RW - 8 });
      const half = (RW - 12) / (ytitle2 ? 2 : 1);
      if (ytitle) txt(ctx, ytitle, RX + 6, RY + 6 + (ttl ? rowH : 0) + fs, { size: fs, color: th.fg, maxW: half });
      if (ytitle2) txt(ctx, ytitle2, RX + RW - 6, RY + 6 + (ttl ? rowH : 0) + fs, { size: fs, color: th.fg, align: 'right', maxW: half });
    }
    if (ttl) txt(ctx, ttl, RX + 6, RY + 6 + fs, { size: fs + 1, bold: true, color: th.fg, maxW: RW - 12 });

    /* ---- Inhalt im Rahmen (geclippt) */
    ctx.save(); ctx.beginPath(); ctx.rect(pxl, py0, pw, ph); ctx.clip();
    const placed = [];
    const fitBox = (bx, by, bw, bh) => bx >= pxl + 1 && bx + bw <= pxl + pw - 1 && by >= py0 + 1 && by + bh <= py0 + ph - 1 && !placed.some(p => bx < p.x + p.w && bx + bw > p.x && by < p.y + p.h && by + bh > p.y);
    /* Baender (Ladephasen) */
    M.bands.forEach(b => {
      const x0 = cl(X(b.from), pxl, pxl + pw), x1 = cl(X(b.to), pxl, pxl + pw); if (x1 - x0 < 1) return;
      ctx.fillStyle = STAGE[b.stage].c; ctx.fillRect(x0, py0, x1 - x0, ph);
      ctx.strokeStyle = th.axis; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(Math.round(x0) + 0.5, py0); ctx.lineTo(Math.round(x0) + 0.5, py0 + ph); ctx.stroke(); ctx.setLineDash([]);
      const lab = b.label || STAGE[b.stage].n;
      if (x1 - x0 > 28) txt(ctx, lab, (x0 + x1) / 2, py0 + fs + 4, { size: fs, bold: true, color: th.fg, align: 'center', maxW: x1 - x0 - 6 });
    });
    /* Rechtecke (Fuellfaktor) */
    M.rects.forEach(q => {
      const xa = X(Math.min(q.x0, q.x1)), xb = X(Math.max(q.x0, q.x1)), ya = Y(Math.max(q.y0, q.y1)), yb = Y(Math.min(q.y0, q.y1));
      if (q.fill) { ctx.fillStyle = th.light ? 'rgba(26,111,212,0.16)' : 'rgba(78,161,255,0.16)'; ctx.fillRect(xa, ya, xb - xa, yb - ya); }
      ctx.strokeStyle = q.fill ? th.accent : th.mute; ctx.lineWidth = 1.4; ctx.setLineDash(q.dash && q.dash.length ? q.dash : (q.fill ? [] : [6, 4])); ctx.strokeRect(xa + 0.5, ya + 0.5, Math.max(0, xb - xa), Math.max(0, yb - ya)); ctx.setLineDash([]);
    });
    /* Flaechen unter Reihen (Solarleistung) */
    M.series.forEach(s => {
      const fillIt = s.fill || (dayLike && /^solarleistung/i.test(s.name)); if (!fillIt || s.pts.length < 2) return;
      const yb = Y(Math.max(yr.min, Math.min(0, yr.max)), s.axis === 'r');
      ctx.fillStyle = s.color; ctx.globalAlpha = 0.16; ctx.beginPath(); ctx.moveTo(X(s.pts[0][0]), yb);
      drawPath(ctx, s.pts, X, p => Y(p, s.axis === 'r'), 1, true); ctx.lineTo(X(s.pts[s.pts.length - 1][0]), yb); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    });
    /* gestapelte Flaechen */
    if (M.stack.length) {
      const base = M.stack[0].pts, sorted = M.stack.every(q => q.sorted), n = base.length;
      const stepPx = n > 1 ? Math.max(1, Math.ceil(n / Math.max(10, pw / 2))) : 1;
      let low = base.map(() => 0);
      M.stack.forEach(s => {
        const vals = base.map(p => { const v = sorted ? interp(s.pts, true, p[0]) : p[1]; return fin(v) ? Math.max(0, v) : 0; });
        const up = low.map((l, i) => l + vals[i]);
        ctx.fillStyle = s.color; ctx.globalAlpha = 0.5; ctx.beginPath();
        let first = true;
        for (let i = 0; i < n; i += stepPx) { const px = X(base[i][0]), py = Y(up[i]); if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py); }
        if ((n - 1) % stepPx !== 0) ctx.lineTo(X(base[n - 1][0]), Y(up[n - 1]));
        for (let i = n - 1; i >= 0; i -= stepPx) ctx.lineTo(X(base[i][0]), Y(low[i]));
        if (n > 0 && (n - 1) % stepPx !== 0) ctx.lineTo(X(base[0][0]), Y(low[0]));
        ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []); ctx.beginPath();
        first = true; for (let i = 0; i < n; i += stepPx) { const px = X(base[i][0]), py = Y(up[i]); if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py); }
        ctx.stroke(); ctx.setLineDash([]);
        low = up;
      });
    }
    /* verlorene Energie (Clipping) */
    if (fin(M.lostWh) && M.lostWh > 0) {
      const a = M.series.find(s => /feld|potenzial/i.test(s.name)), b = M.series.find(s => /nennleistung/i.test(s.name));
      if (a && b) {
        ctx.fillStyle = th.danger; ctx.globalAlpha = 0.30; ctx.beginPath(); let run = [];
        const flush = () => { if (run.length > 1) { ctx.moveTo(X(run[0][0]), Y(run[0][2])); run.forEach(q => ctx.lineTo(X(q[0]), Y(q[1]))); ctx.lineTo(X(run[run.length - 1][0]), Y(run[run.length - 1][2])); ctx.closePath(); } run = []; };
        a.pts.forEach(p => { const yb = interp(b.pts, b.sorted, p[0]); if (fin(yb) && p[1] > yb) run.push([p[0], p[1], yb]); else flush(); }); flush();
        ctx.fill(); ctx.globalAlpha = 1;
        txt(ctx, 'Verlorene Energie: ' + fm(M.lostWh, 0) + ' Wh', pxl + 8, py0 + fs + 6, { size: fs, bold: true, color: th.danger, halo: th.halo, maxW: pw - 16 });
      }
    }
    /* Horizont (Sonnenbahn) */
    if (sunK && yr.min <= 0) { const y0 = Y(0); ctx.fillStyle = th.light ? 'rgba(80,60,30,0.10)' : 'rgba(120,90,50,0.16)'; ctx.fillRect(pxl, y0, pw, py0 + ph - y0); ctx.strokeStyle = th.axis; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(pxl, Math.round(y0) + 0.5); ctx.lineTo(pxl + pw, Math.round(y0) + 0.5); ctx.stroke();
      [[-90, 'Ost'], [0, 'Süd'], [90, 'West']].forEach(c => { if (c[0] >= xmin && c[0] <= xmax) txt(ctx, c[1], X(c[0]), py0 + ph - 6, { size: fs, color: th.mute, align: 'center', maxW: 60 }); }); }
    /* Waagerechte und senkrechte Hilfslinien */
    M.hl.forEach(h => { const y = Math.round(Y(h.y)) + 0.5; ctx.strokeStyle = h.color || th.warn; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(pxl, y); ctx.lineTo(pxl + pw, y); ctx.stroke(); ctx.setLineDash([]); if (h.label) txt(ctx, h.label, pxl + 6, y - 4, { size: fs, color: h.color || th.warn, halo: th.halo, maxW: pw - 12 }); });
    if (fin(M.euroEta) && kind === 'eta') { const y = Math.round(Y(M.euroEta)) + 0.5; ctx.strokeStyle = th.warn; ctx.lineWidth = 1.4; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(pxl, y); ctx.lineTo(pxl + pw, y); ctx.stroke(); ctx.setLineDash([]); txt(ctx, 'Europäischer Wirkungsgrad = ' + fm(M.euroEta, 1) + ' %', pxl + pw - 6, y + (y < py0 + 20 ? fs + 6 : -5), { size: fs, bold: true, color: th.warn, halo: th.halo, align: 'right', maxW: pw - 12 }); }
    M.vl.forEach(v => { const x = Math.round(X(v.x)) + 0.5; if (x < pxl || x > pxl + pw) return; ctx.strokeStyle = v.color || th.warn; ctx.lineWidth = 1.4; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py0 + ph); ctx.stroke(); ctx.setLineDash([]); if (v.label) { const w = tw(ctx, v.label, fs, false), right = x + 6 + w > pxl + pw; txt(ctx, v.label, right ? x - 6 : x + 6, py0 + fs + 4, { size: fs, color: v.color || th.warn, halo: th.halo, align: right ? 'right' : 'left', maxW: pw - 12 }); } });
    /* Reihen */
    const maxPts = fin(o.maxPoints) && o.maxPoints > 20 ? o.maxPoints : Math.max(40, Math.round(pw * 1.2));
    M.series.forEach(s => {
      if (s.dots) { ctx.fillStyle = s.color; ctx.strokeStyle = th.halo; ctx.lineWidth = 2; s.pts.slice(0, 80).forEach(p => { ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1], s.axis === 'r'), 4.5, 0, TAU); ctx.fill(); ctx.stroke(); }); return; }
      ctx.strokeStyle = s.color; ctx.lineWidth = s.lw; ctx.lineJoin = 'round'; ctx.setLineDash(s.dash.map(v => v * (s.lw > 2.5 ? 1.1 : 1))); ctx.beginPath();
      drawPath(ctx, s.pts, X, p => Y(p, s.axis === 'r'), maxPts, false, s.sorted);
      ctx.stroke(); ctx.setLineDash([]);
    });
    /* Spitzenwerte (Tagesgang) */
    if ((kind === 'day' || kind === 'stack') && o.peaks !== false) {
      const s = M.series.find(q => /^solarleistung|^feldleistung|^einspeisung \(wechsel/i.test(q.name)) || null;
      if (s) { let best = s.pts[0]; s.pts.forEach(p => { if (p[1] > best[1]) best = p; });
        if (best && best[1] > 1) { const bx = X(best[0]), by = Y(best[1], s.axis === 'r'); ctx.fillStyle = s.color; ctx.strokeStyle = th.halo; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, by, 4, 0, TAU); ctx.fill(); ctx.stroke();
          const lab = 'Spitze ' + fm(best[1], best[1] >= 100 ? 0 : 1) + ' W um ' + hhmm(best[0]) + ' Uhr', w = tw(ctx, lab, fs, true); const right = bx + 8 + w > pxl + pw - 4;
          txt(ctx, lab, right ? bx - 8 : bx + 8, Math.max(py0 + fs + 2, by - 6), { size: fs, bold: true, color: th.fg, halo: th.halo, align: right ? 'right' : 'left', maxW: pw - 12 }); } }
    }
    /* Euro-Eta-Stuetzstellen */
    if (kind === 'eta') M.euro.forEach(e => { const ex = X(e.p), ey2 = Y(e.eta); ctx.fillStyle = th.warn; ctx.strokeStyle = th.halo; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ex, ey2 - 6); ctx.lineTo(ex + 6, ey2); ctx.lineTo(ex, ey2 + 6); ctx.lineTo(ex - 6, ey2); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (fin(e.w)) { const lab = fm(e.w * (e.w <= 1 ? 100 : 1), 0) + ' %'; txt(ctx, lab, ex, ey2 + 20, { size: fs, color: th.warn, halo: th.halo, align: 'center', maxW: 40 }); } });
    /* Marken mit Textschild (Platzierung ohne Ueberdeckung) */
    M.marks.forEach(m => {
      const mx = X(m.x), my = Y(m.y), rad = m.global ? 6.5 : 4.5;
      ctx.fillStyle = m.global ? th.ok : th.warn; ctx.strokeStyle = th.halo; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, rad, 0, TAU); ctx.fill(); ctx.stroke();
      if (m.global) { ctx.strokeStyle = th.ok; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(mx, my, rad + 3.5, 0, TAU); ctx.stroke(); }
      if (!m.label) return;
      const w = Math.min(pw - 8, tw(ctx, m.label, fs, m.global)), hgt = fs + 3, cands = [[mx + 8, my - 8], [mx - 8 - w, my - 8], [mx + 8, my + hgt + 2], [mx - 8 - w, my + hgt + 2], [mx - w / 2, my - 12], [mx - w / 2, my + hgt + 8]];
      let pick = null; for (const c of cands) { if (fitBox(c[0], c[1] - hgt, w, hgt + 2)) { pick = c; break; } }
      if (!pick) pick = [cl(mx + 8, pxl + 2, pxl + pw - w - 2), cl(my - 8, py0 + hgt + 2, py0 + ph - 4)];
      placed.push({ x: pick[0], y: pick[1] - hgt, w, h: hgt + 2 });
      txt(ctx, m.label, pick[0], pick[1], { size: fs, bold: m.global, color: th.fg, halo: th.halo, maxW: pw - 8 });
    });
    /* "jetzt" */
    if (fin(M.now) && M.now >= xmin && M.now <= xmax) {
      const x = Math.round(X(M.now)) + 0.5; ctx.strokeStyle = th.now; ctx.lineWidth = 1.6; ctx.setLineDash([5, 3]); ctx.beginPath(); ctx.moveTo(x, py0); ctx.lineTo(x, py0 + ph); ctx.stroke(); ctx.setLineDash([]);
      const lab = 'jetzt ' + hhmm(M.now), w = tw(ctx, lab, fs, true), right = x + 6 + w > pxl + pw; txt(ctx, lab, right ? x - 6 : x + 6, py0 + ph - 8, { size: fs, bold: true, color: th.now, halo: th.halo, align: right ? 'right' : 'left', maxW: pw - 12 });
    }
    /* Betriebspunkt */
    if (M.marker) {
      const mx = X(M.marker.x), my = Y(M.marker.y, M.marker.axis === 'r');
      if (kind !== 'sun') { ctx.strokeStyle = th.mute; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(mx, py0 + ph); ctx.lineTo(mx, my); ctx.lineTo(pxl, my); ctx.stroke(); ctx.setLineDash([]); }
      if (kind === 'sun') sunGlyph(ctx, mx, my, th); else { ctx.fillStyle = th.danger; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 5.5, 0, TAU); ctx.fill(); ctx.stroke(); }
      const lab = M.marker.label || (o.showMarkerLabel ? fa(M.marker.x) + ' / ' + fa(M.marker.y) : '');
      if (lab) { const w = tw(ctx, lab, fs, true), right = mx + 10 + w > pxl + pw; txt(ctx, lab, right ? mx - 10 : mx + 10, cl(my - 8, py0 + fs + 2, py0 + ph - 4), { size: fs, bold: true, color: th.fg, halo: th.halo, align: right ? 'right' : 'left', maxW: pw - 12 }); }
    }
    if (!M.series.length && !M.stack.length && !M.marks.length && !M.rects.length && !M.euro.length) txt(ctx, 'Keine Daten', pxl + pw / 2, py0 + ph / 2, { size: fs + 2, color: th.mute, align: 'center', maxW: pw - 16 });
    ctx.restore();
    /* ---- Legende */
    let ly = py0 + ph + 6 + rowH + (showTitles && xtitle ? rowH : 0) + fs;
    legRows.forEach(row => {
      let lx = RX + 8;
      row.forEach(c => {
        const it = c.it;
        if (it.dot) { ctx.fillStyle = it.color; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx + 10, ly - fs / 2 + 1, 4.5, 0, TAU); ctx.fill(); ctx.stroke(); }
        else if (it.diamond) { const cx = lx + 10, cy = ly - fs / 2 + 1; ctx.fillStyle = it.color; ctx.beginPath(); ctx.moveTo(cx, cy - 5); ctx.lineTo(cx + 5, cy); ctx.lineTo(cx, cy + 5); ctx.lineTo(cx - 5, cy); ctx.closePath(); ctx.fill(); }
        else if (it.area) { ctx.fillStyle = it.color; ctx.globalAlpha = 0.5; ctx.fillRect(lx + 1, ly - fs + 1, 18, fs - 2); ctx.globalAlpha = 1; ctx.strokeStyle = it.color; ctx.lineWidth = 1.5; ctx.setLineDash(it.dash || []); ctx.beginPath(); ctx.moveTo(lx + 1, ly - fs + 1); ctx.lineTo(lx + 19, ly - fs + 1); ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.strokeStyle = it.color; ctx.lineWidth = Math.min(3.2, it.lw || 2); ctx.setLineDash((it.dash || []).map(v => Math.min(v, 8))); ctx.beginPath(); ctx.moveTo(lx, ly - fs / 2 + 1); ctx.lineTo(lx + 20, ly - fs / 2 + 1); ctx.stroke(); ctx.setLineDash([]); }
        txt(ctx, it.name, lx + 26, ly, { size: fs, color: th.fg, maxW: c.w - 30 });
        lx += c.w;
      });
      ly += fs + 5;
    });
    ctx.restore();

    /* ---- Layout-Rueckgabe */
    const seriesOut = M.series.map(s => ({ name: s.name, color: s.color, dash: s.dash, axis: s.axis === 'r' ? 'right' : 'left', unit: s.unit }));
    const xnm = M.xLabel || (dayLike ? 'Sonnenzeit' : 'x');
    function fmtX(x) { return dayLike && xmin === 0 && xmax === 24 ? hhmm(x) + ' Uhr Sonnenzeit' : (M.xLabel ? M.xLabel + ' = ' : '') + fa(x) + (M.xUnit ? ' ' + M.xUnit : ''); }
    function rowsAt(x) {
      const rows = [];
      M.stack.forEach(s => { const v = interp(s.pts, s.sorted, x); if (fin(v)) rows.push({ name: s.name, y: v, text: s.name + ': ' + fa(v) + ' ' + (s.unit || M.yUnit), color: s.color, dash: s.dash }); });
      M.series.forEach(s => { const v = interp(s.pts, s.sorted, x); if (fin(v)) { const u = s.unit || (s.axis === 'r' ? M.yUnit2 : M.yUnit); rows.push({ name: s.name, y: v, text: s.name + ': ' + fa(v) + (u ? ' ' + u : ''), color: s.color, dash: s.dash }); } });
      return rows;
    }
    const layout = {
      kind, empty: !M.series.length && !M.stack.length && !M.marks.length && !M.rects.length && !M.euro.length, rect: { x: RX, y: RY, w: RW, h: RH }, plot,
      xr: { min: xmin, max: xmax, log: M.log }, yr: { min: yr.min, max: yr.max }, yr2: yr2 ? { min: yr2.min, max: yr2.max } : null,
      xPx: X, yPx: Y, xAt: XA, yAt: YA, series: seriesOut, legend: items.map(i => i.name),
      valueAt(px, py) {
        if (!fin(px) || !fin(py) || px < pxl || px > pxl + pw || py < py0 || py > py0 + ph) return null;
        const x = XA(px); return { x, xText: fmtX(x), y: YA(py), rows: rowsAt(x), xName: xnm };
      }
    };
    return layout;
  }
  /* Pfad einzeichnen; bei mehr als zwei Punkten je 3 Pixel Breite je Spaltengruppe nur kleinster und groesster Wert (in Reihenfolge), erster und letzter Punkt bleiben.
     cont = ohne moveTo am Anfang (Fortsetzung eines Pfads) */
  function drawPath(ctx, pts, X, Y, lim, cont, sorted) {
    const n = pts.length; if (!n) return;
    let first = !cont;
    const put = (px, py) => { if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py); };
    const x0 = X(pts[0][0]), x1 = X(pts[n - 1][0]), buckets = Math.max(1, Math.ceil(Math.abs(x1 - x0) / 3));
    if (sorted === false || !(n > buckets * 2)) {
      const st = sorted === false && n > 2000 ? Math.ceil(n / 2000) : 1;
      for (let i = 0; i < n; i += st) put(X(pts[i][0]), Y(pts[i][1]));
      if (st > 1 && (n - 1) % st !== 0) put(X(pts[n - 1][0]), Y(pts[n - 1][1]));
      return;
    }
    let col = null, mn = null, mx = null, f = null;
    const emit = () => { if (!mn) return; const a = mn.i <= mx.i ? mn : mx, b = mn.i <= mx.i ? mx : mn; if (f && f.i < a.i) put(f.px, f.py); put(a.px, a.py); if (b !== a) put(b.px, b.py); };
    let lastQ = null;
    for (let i = 0; i < n; i++) {
      const px = X(pts[i][0]), py = Y(pts[i][1]), c = Math.floor((px - x0) / 3), q = { px, py, i };
      if (c !== col) { emit(); col = c; mn = q; mx = q; f = (i === 0) ? q : null; } else { if (py < mn.py) mn = q; if (py > mx.py) mx = q; }
      lastQ = q;
    }
    emit(); if (lastQ && (!mx || lastQ.i > Math.max(mn.i, mx.i))) put(lastQ.px, lastQ.py);
  }
  function sunGlyph(ctx, x, y, th) {
    ctx.strokeStyle = '#ffb300'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8; ctx.moveTo(x + Math.cos(a) * 8, y + Math.sin(a) * 8); ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); }
    ctx.stroke(); ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = th.halo; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); ctx.stroke();
  }

  /* ------------------------------------------------------------------ Balken */
  function barChart(ctx, rect, data, opts) {
    if (!ctx || typeof ctx.beginPath !== 'function' || typeof ctx.fillText !== 'function') return null;
    const r = obj(rect);
    if (!fin(r.x) || !fin(r.y) || !fin(r.w) || !fin(r.h) || r.w < 80 || r.h < 60 || r.w > 20000 || r.h > 20000) return null;
    const o = obj(opts), th = resolveTheme(o), d = obj(data), fs = r.w >= 560 ? 12 : 11;
    const clean = (arr, dflt) => (Array.isArray(arr) ? arr : []).map((b0, i) => { const b = obj(b0); return fin(b.value) ? { id: str(b.id) || String(i), label: str(b.label) || str(b.id) || ('Wert ' + (i + 1)), value: Math.max(0, b.value), raw: b.value, unit: str(b.unit) || dflt, limit: fin(b.limit) ? b.limit : NaN, ok: b.ok === true ? true : b.ok === false ? false : null } : null; }).filter(Boolean);
    const bars = clean(d.bars, str(d.yUnit)), euro = clean(d.euro, '€');
    const title = o.title ? str(d.title) : '';
    ctx.save();
    ctx.fillStyle = th.plot; ctx.fillRect(r.x, r.y, r.w, r.h);
    let y = r.y + 6; const x0 = r.x + 10, wAll = r.w - 20;
    if (title) { txt(ctx, title, x0, y + fs + 1, { size: fs + 1, bold: true, color: th.fg, maxW: wAll }); y += fs + 9; }
    const notes = [];
    if (fin(d.iscSumme) && fin(d.idcMax)) notes.push('Summe der Kurzschlussströme ' + fm(d.iscSumme, 2) + ' A, Eingangsstrom des Geräts höchstens ' + fm(d.idcMax, 1) + ' A.');
    if (str(d.note)) notes.push(str(d.note));
    const noteH = notes.length * (fs + 4) + (notes.length ? 4 : 0);
    const nRows = bars.length + euro.length + (euro.length ? 1 : 0), avail = r.y + r.h - 6 - noteH - y;
    const out = { kind: 'bars', empty: !bars.length && !euro.length, rect: { x: r.x, y: r.y, w: r.w, h: r.h }, plot: { x: x0, y, w: wAll, h: Math.max(0, avail) }, bars: [], xAt: () => NaN, yAt: () => NaN, series: [], legend: [] };
    if (!nRows) {
      txt(ctx, 'Keine Daten', r.x + r.w / 2, r.y + r.h / 2, { size: fs + 2, color: th.mute, align: 'center', maxW: wAll });
      ctx.restore(); out.valueAt = () => null; return out;
    }
    const rh = Math.max(20, Math.min(46, avail / nRows)), stacked = rh >= 36;
    const maxV = Math.max(1e-9, ...bars.map(b => Math.max(b.value, fin(b.limit) ? b.limit : 0)));
    const maxE = Math.max(1e-9, ...euro.map(b => b.value));
    const draw = (b, scale, i) => {
      const top = y + i * rh, lab = b.label;
      const barX = stacked ? x0 : x0 + Math.min(wAll * 0.42, 190), barW = stacked ? wAll - 6 : wAll - (barX - x0) - 6;
      const bh = stacked ? Math.min(16, rh - fs - 8) : Math.min(16, rh - 6), by = stacked ? top + fs + 5 : top + (rh - bh) / 2;
      if (stacked) txt(ctx, lab, x0, top + fs + 1, { size: fs, color: th.fg, maxW: wAll }); else txt(ctx, lab, x0, by + bh / 2 + 4, { size: fs, color: th.fg, maxW: barX - x0 - 8 });
      const frac = Math.min(1, b.value / (scale * 1.12)), w = Math.max(b.value > 0 ? 2 : 0, barW * frac);
      ctx.fillStyle = th.grid; ctx.fillRect(barX, by, barW, bh);
      const col = b.ok === false ? th.danger : b.ok === true ? th.ok : (/€/.test(b.unit) ? th.warn : th.accent);
      ctx.fillStyle = col; ctx.globalAlpha = 0.85; ctx.fillRect(barX, by, w, bh); ctx.globalAlpha = 1;
      if (b.ok === false) { ctx.strokeStyle = th.fg; ctx.lineWidth = 1; ctx.beginPath(); for (let k = barX + 4; k < barX + w; k += 8) { ctx.moveTo(k, by + bh); ctx.lineTo(Math.min(k + 6, barX + w), by); } ctx.stroke(); }
      if (fin(b.limit)) { const lx = barX + barW * Math.min(1, b.limit / (scale * 1.12)); ctx.strokeStyle = th.fg; ctx.lineWidth = 2; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(lx, by - 3); ctx.lineTo(lx, by + bh + 3); ctx.stroke(); ctx.setLineDash([]); }
      const vt = (b.unit === '€' ? fm(b.raw, 2) : fa(b.raw)) + (b.unit ? ' ' + b.unit : '') + (fin(b.limit) ? ' (Grenze ' + fa(b.limit) + ' ' + b.unit + ')' : '') + (b.ok === false ? ', Problem' : b.ok === true ? ', in Ordnung' : '');
      const vw = tw(ctx, vt, fs, true), inside = vw + 10 < w;
      txt(ctx, vt, inside ? barX + w - 6 : barX + w + 6, by + bh / 2 + 4, { size: fs, bold: true, color: inside ? '#0b1117' : th.fg, align: inside ? 'right' : 'left', maxW: inside ? w - 8 : Math.max(20, barX + barW - (barX + w + 6) + 6), halo: inside ? null : th.halo });
      out.bars.push({ id: b.id, label: b.label, value: b.raw, unit: b.unit, ok: b.ok, x: barX, y: by, w: barW, h: bh, text: b.label + ': ' + vt });
    };
    bars.forEach((b, i) => draw(b, maxV, i));
    if (euro.length) {
      const top = y + bars.length * rh; txt(ctx, 'Wert in Euro (Annahme, bitte aktualisieren)', x0, top + fs + 1, { size: fs, bold: true, color: th.mute, maxW: wAll });
      euro.forEach((b, i) => draw(b, maxE, bars.length + 1 + i));
    }
    let ny = r.y + r.h - 6 - noteH + fs + 2;
    notes.forEach(n => { txt(ctx, n, x0, ny, { size: fs, color: th.mute, maxW: wAll }); ny += fs + 4; });
    ctx.restore();
    out.valueAt = (px, py) => { if (!fin(px) || !fin(py)) return null; const b = out.bars.find(q => px >= q.x - 4 && px <= q.x + q.w + 4 && py >= q.y - fs - 6 && py <= q.y + q.h + 4); return b ? { id: b.id, label: b.label, value: b.value, text: b.text } : null; };
    return out;
  }

  /* ------------------------------------------------------------------ Fadenkreuz mit Wertanzeige */
  function crosshair(ctx, L, px, py, opts) {
    if (!ctx || typeof ctx.beginPath !== 'function' || !L || typeof L.valueAt !== 'function' || !L.plot || L.kind === 'bars') return null;
    const v = L.valueAt(px, py); if (!v) return null;
    const o = obj(opts), th = resolveTheme(o), P = L.plot, fs = L.rect && L.rect.w >= 560 ? 12 : 11;
    const x = Math.round(cl(px, P.x, P.x + P.w)) + 0.5, rows = v.rows.slice(0, 6);
    ctx.save(); ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
    ctx.strokeStyle = th.fg; ctx.lineWidth = 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x, P.y); ctx.lineTo(x, P.y + P.h); ctx.stroke();
    ctx.strokeStyle = th.mute; ctx.setLineDash([3, 3]); const yy = Math.round(cl(py, P.y, P.y + P.h)) + 0.5; ctx.beginPath(); ctx.moveTo(P.x, yy); ctx.lineTo(P.x + P.w, yy); ctx.stroke(); ctx.setLineDash([]);
    L.series.forEach((s, i) => { const row = v.rows.find(q => q.name === s.name); if (!row) return; const ry = L.yPx(row.y, s.axis === 'right'); if (!fin(ry)) return; ctx.fillStyle = s.color; ctx.strokeStyle = th.halo; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, ry, 4, 0, TAU); ctx.fill(); ctx.stroke(); void i; });
    const lines = [v.xText].concat(rows.map(q => q.text)), wmax = Math.max(60, Math.min(P.w - 8, 300));
    let bw = 0; lines.forEach((s, i) => { bw = Math.max(bw, Math.min(wmax, tw(ctx, s, fs, i === 0) + 24)); });
    const bh = lines.length * (fs + 4) + 8, bx0 = x + 12 + bw > P.x + P.w - 2 ? x - 12 - bw : x + 12, bx = cl(bx0, P.x + 2, Math.max(P.x + 2, P.x + P.w - bw - 2)), by = P.y + 4;
    ctx.fillStyle = th.panel; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = th.axis; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    lines.forEach((s, i) => {
      const ty = by + 4 + (i + 1) * (fs + 4) - 3;
      if (i > 0 && rows[i - 1]) { ctx.fillStyle = rows[i - 1].color; ctx.fillRect(bx + 6, ty - fs + 3, 8, fs - 4); }
      txt(ctx, s, bx + (i > 0 ? 18 : 6), ty, { size: fs, bold: i === 0, color: th.fg, maxW: bw - (i > 0 ? 22 : 10) });
    });
    ctx.restore();
    return { x: v.x, rows: v.rows, text: lines.join('; ') };
  }

  /* ------------------------------------------------------------------ Verteiler und Namen */
  const wrap = kind => (ctx, rect, data, opts) => { try { return kind === 'bars' ? barChart(ctx, rect, data, opts) : plotChart(ctx, rect, data, opts, kind); } catch (e) { try { ctx.restore(); } catch (x) { /* nichts */ } return null; } };
  function chart(ctx, rect, curve, opts) {
    const c = obj(curve), o = obj(opts), k = ['day', 'stack', 'bars', 'eta', 'sun', 'line', 'iv', 'charge'].indexOf(c.kind) >= 0 ? c.kind : (['day', 'stack', 'bars', 'eta', 'sun', 'line', 'iv', 'charge'].indexOf(o.kind) >= 0 ? o.kind : inferKind(c));
    return wrap(k)(ctx, rect, curve, opts);
  }
  const API = { version: '1.0', chart, ivChart: wrap('iv'), dayChart: wrap('day'), stackChart: wrap('stack'), chargeChart: wrap('charge'), etaChart: wrap('eta'), sunChart: wrap('sun'), barChart: wrap('bars'), lineChart: wrap('line'),
    crosshair, theme, fm, fa, hhmm, inferKind, fns: ['chart', 'ivChart', 'dayChart', 'stackChart', 'chargeChart', 'etaChart', 'sunChart', 'barChart', 'lineChart', 'crosshair', 'theme', 'fm'] };
  root.ENR_CHART = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
