'use strict';
/* Tonfunk Analogtechnik-Lab (ANA-Lab): Tab "Kennlinien" (WP3b, SPEC 6.4).
   Zeichnet jede Kurve aus rig.curves() als SVG: Dioden-Kennlinie mit Widerstandsgerade, Ausgangskennlinienfeld mit Arbeitsgerade (Schalter, Emitterschaltung), Übertragungskennlinie,
   Hysterese-Schleife des Schmitt-Triggers, Frequenzgang (Betrag, Phase). Dazu Fadenkreuz (Maus, Touch, Pfeiltasten), Marker (Arbeitspunkt), Grenzlinie (limit: y oder x, sym = gespiegelt),
   Bereiche (zones), Vergleichskurven des Prüfstands (kind ghost, ref), Geisterlinie der Referenz (Vorher, aus S.refRig), Wertetabelle als Alternative zum Bild und CSV (alle Kurven).
   Zwei aufklappbare Vertiefungen (<details class="ana-vertiefung">, Standard zu, Zustand in ana.deep über api.deep; der Inhalt wird erst beim Aufklappen gezeichnet):
     "Bode-Diagramm" (opv_inv, opv_nin, opv_aktiv real; Taste B): Leerlauf und gegengekoppelter Verlauf mit Knick, GBW-Marke, Dämpfung je Dekade, Rechenzeile aus ANA_CORE.deep.bode;
     "Sättigung" (opv_inv, opv_nin): Übertragungskennlinie mit ±U_e,max, Rechenzeile aus ANA_CORE.deep.sat. (Die Vertiefung "slew" gehört zum Tab Verläufe, WP3d.)
   Es wird NICHT gerechnet: Alle Zahlen (Kurven, Marker, Grenzen, Bode-Werte, U_e,max) kommen aus rig.curves(), rig.getControls()/readMeters() und ANA_CORE.deep; hier stehen nur Abbildung,
   Interpolation zwischen Stützstellen, Beschriftung und die Differenz zweier gelieferter Bode-Werte (Dämpfung je Dekade). Aussagen über die Lage des Markers entstehen nur aus dem Vergleich
   gelieferter Zahlen (Regel 2). Alle Kurven sind Lehrmodelle mit Übungswerten.
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.curve = { render(host, api), refresh(), redraw(), toggleBode(), fn }. Die reinen Funktionen (ohne DOM) hängen unter fn (test_anaui_ext.js). */
(function (root) {
  const E = root.ANA_UI_EXT = root.ANA_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const once = (host, name, ty, fn, cap) => { host.__anacu = host.__anacu || {}; if (host.__anacu[name + ty]) return; host.__anacu[name + ty] = 1; host.addEventListener(ty, fn, !!cap); };
  const CORE = () => (A && A.ANA_CORE) || root.ANA_CORE;
  const NOTE = 'Kennlinien sind Lehrmodelle mit Übungswerten (A) und idealen Bauteilen, keine Herstellerdaten und kein Nachweis.';
  const SER = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--bad-fg)'], DASH = ['', '8 4', '2 4', '10 3 2 3'];
  const SI = /^(Hz|F|H|Ω|V|A|W|s|VA)$/;
  const KIND_STYLE = { line: { col: 'var(--warn)', dash: '8 4', w: 2.2 }, tangent: { col: 'var(--ok)', dash: '2 4', w: 2.2 }, ref: { col: 'var(--mute)', dash: '6 3', w: 2 }, ghost: { col: 'var(--mute)', dash: '3 3', w: 1.4 } };
  const VERGL = k => k === 'ghost' || k === 'ref';

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* Zahl mit Dezimalkomma, 3 gültige Stellen */
  function fv(v) {
    if (!fin(v)) return '–'; const a = Math.abs(v); if (a === 0) return '0';
    const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(3);
    return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  const withUnit = (v, u) => fv(v) + (u ? ' ' + u : '');
  /* Zahl mit Einheit: SI-Einheiten mit Vorsatz über den Kern (15,9 kHz), sonst Zahl und Einheit */
  function qv(v, u) {
    if (!fin(v)) return '–';
    const C = CORE(); if (u && SI.test(u) && C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(v, u); if (typeof t === 'string' && t) return t; } catch (e) {} }
    return withUnit(v, u);
  }
  const scaleOf = s => (s === 'log' ? 'log' : 'lin');
  const rangeOf = r => (Array.isArray(r) && r.length === 2 && fin(r[0]) && fin(r[1]) && r[1] > r[0] ? [r[0], r[1]] : null);
  /* Kurve bereinigen: nur endliche Punkte (log: nur positive), leere Reihen entfallen; null, wenn nichts zu zeichnen ist */
  function clean(cv) {
    if (!cv || typeof cv !== 'object') return null;
    const xs = scaleOf(cv.xScale), ys = scaleOf(cv.yScale);
    const okp = p => Array.isArray(p) && fin(p[0]) && fin(p[1]) && (xs !== 'log' || p[0] > 0) && (ys !== 'log' || p[1] > 0);
    const kd = s => { const k = s && typeof s.kind === 'string' ? s.kind : ''; return s && s.ghost === true && !k ? 'ghost' : k; };
    const series = (Array.isArray(cv.series) ? cv.series : []).map(s => ({ name: String((s && s.name) || ''), kind: kd(s), points: (s && Array.isArray(s.points) ? s.points : []).filter(okp).map(p => [p[0], p[1]]).sort((a, b) => a[0] - b[0]) })).filter(s => s.points.length > 0);
    const mk = cv.marker && fin(cv.marker.x) && fin(cv.marker.y) && (xs !== 'log' || cv.marker.x > 0) && (ys !== 'log' || cv.marker.y > 0) ? { x: cv.marker.x, y: cv.marker.y, label: String(cv.marker.label != null ? cv.marker.label : cv.marker.text || '') } : null;
    const lim = cv.limit, lname = lim ? String(lim.name || lim.label || '') : '';
    const lm = lim && fin(lim.y) && (ys !== 'log' || lim.y > 0) ? { y: lim.y, label: lname, sym: lim.sym === true } : (lim && fin(lim.x) && (xs !== 'log' || lim.x > 0) ? { x: lim.x, label: lname, sym: lim.sym === true } : null);
    const marks = (Array.isArray(cv.marks) ? cv.marks : []).filter(m => m && fin(m.x) && (xs !== 'log' || m.x > 0)).map(m => ({ x: m.x, label: String(m.label || '') }));
    const zones = (Array.isArray(cv.zones) ? cv.zones : []).filter(z => z && fin(z.x0) && fin(z.x1) && z.x1 > z.x0 && (xs !== 'log' || z.x0 > 0)).map(z => ({ x0: z.x0, x1: z.x1, name: String(z.name || ''), kind: String(z.kind || '') }));
    if (!series.length) return null;
    return { id: String(cv.id || ''), title: String(cv.title || cv.id || 'Kennlinie'), vertiefung: cv.vertiefung === true, xLabel: String(cv.xLabel || 'x'), xUnit: String(cv.xUnit || ''), xScale: xs, yLabel: String(cv.yLabel || 'y'), yUnit: String(cv.yUnit || ''), yScale: ys, series, marker: mk, limit: lm, marks, zones, xRange: rangeOf(cv.xRange), yRange: rangeOf(cv.yRange) };
  }
  const cleanAll = list => (Array.isArray(list) ? list : []).map(clean).filter(Boolean);
  /* Hauptkurven (alle aus rig.curves()) und Kurven, die als Vertiefung markiert sind (vertiefung:true) */
  const split = list => { const a = cleanAll(list); return { main: a.filter(c => !c.vertiefung), deep: a.filter(c => c.vertiefung) }; };
  /* Farbe, Strich und Breite einer Reihe: Hauptreihen der Reihe nach, Geraden, Tangenten und Vergleichskurven nach Art */
  function styleOf(c, i) {
    const s = c.series[i], ks = KIND_STYLE[s.kind]; if (ks) return ks;
    let n = 0; for (let j = 0; j < i; j++) if (!KIND_STYLE[c.series[j].kind]) n++;
    return { col: SER[n % SER.length], dash: DASH[n % DASH.length], w: 2.6 };
  }
  function niceNum(x) { const e = Math.floor(Math.log10(x)), f = x / Math.pow(10, e); return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * Math.pow(10, e); }
  function niceRange(lo, hi, scale) {
    if (!fin(lo) || !fin(hi)) return scale === 'log' ? [1, 10] : [0, 1];
    if (scale === 'log') { lo = Math.pow(10, Math.floor(Math.log10(lo) + 1e-9)); hi = Math.pow(10, Math.ceil(Math.log10(hi) - 1e-9)); if (hi <= lo) hi = lo * 10; return [lo, hi]; }
    if (lo >= 0 && lo <= 0.35 * hi) lo = 0;
    if (hi === lo) { hi = lo + 1; }
    const st = niceNum((hi - lo) / 5); lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st; return [lo, hi];
  }
  function ticks(lo, hi, scale) {
    const out = [];
    if (scale === 'log') { for (let e = Math.round(Math.log10(lo)); e <= Math.round(Math.log10(hi)) && out.length < 14; e++) out.push(Math.pow(10, e)); return out; }
    const st = niceNum((hi - lo) / 5); for (let v = Math.ceil(lo / st - 1e-9) * st, n = 0; v <= hi + st * 1e-9 && n < 20; v += st, n++) out.push(+v.toPrecision(12)); return out;
  }
  /* Achsenbereiche: Reihen (Vergleichskurven des Prüfstands nur ohne Bereichsvorgabe nicht, Geisterlinie immer), Marker, Marken, Grenzlinie; xRange/yRange des Prüfstands begrenzen die Obergrenze */
  function bounds(c, ghost) {
    const xs = [], ys = [], dx = [], dy = [];
    c.series.forEach(s => { if (s.kind === 'ghost') return; s.points.forEach(p => { dx.push(p[0]); dy.push(p[1]); }); });
    if (!dx.length) c.series.forEach(s => s.points.forEach(p => { dx.push(p[0]); dy.push(p[1]); }));
    const mm = a => a.reduce((r, v) => [Math.min(r[0], v), Math.max(r[1], v)], [Infinity, -Infinity]);
    const bx0 = mm(dx), by0 = mm(dy);
    const xr = c.xRange, yr = c.yRange;
    xs.push(xr ? Math.max(xr[0], bx0[0]) : bx0[0], xr ? xr[1] : bx0[1]); ys.push(yr ? Math.max(yr[0], by0[0]) : by0[0], yr ? yr[1] : by0[1]);
    if (ghost) ghost.series.forEach(s => { if (s.kind !== 'ghost') s.points.forEach(p => { xs.push(p[0]); ys.push(p[1]); }); });
    if (c.marker) { xs.push(c.marker.x); ys.push(c.marker.y); }
    if (c.limit) { if (fin(c.limit.y)) { ys.push(c.limit.y); if (c.limit.sym) ys.push(-c.limit.y); } if (fin(c.limit.x)) { xs.push(c.limit.x); if (c.limit.sym) xs.push(-c.limit.x); } }
    (c.marks || []).forEach(m => xs.push(m.x));
    if (c.xScale === 'log') { const pos = xs.filter(v => v > 0); xs.length = 0; Array.prototype.push.apply(xs, pos); }
    if (c.yScale === 'log') { const pos = ys.filter(v => v > 0); ys.length = 0; Array.prototype.push.apply(ys, pos); }
    const bx = mm(xs), by = mm(ys), rx = niceRange(bx[0], bx[1], c.xScale), ry = niceRange(by[0], by[1], c.yScale);
    return { x0: rx[0], x1: rx[1], y0: ry[0], y1: ry[1] };
  }
  const pos = (v, lo, hi, scale) => (scale === 'log' ? (Math.log10(v) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)) : (v - lo) / (hi - lo));
  const unpos = (t, lo, hi, scale) => (scale === 'log' ? Math.pow(10, Math.log10(lo) + t * (Math.log10(hi) - Math.log10(lo))) : lo + t * (hi - lo));
  /* Zwischenwert einer Reihe bei x (in den Achsenmaßen interpoliert); außerhalb der Stützstellen: null */
  function interp(points, x, xScale, yScale) {
    if (!points || !points.length || !fin(x)) return null;
    const tx = v => (xScale === 'log' ? Math.log10(v) : v), ty = v => (yScale === 'log' ? Math.log10(v) : v), uy = v => (yScale === 'log' ? Math.pow(10, v) : v);
    const first = points[0], last = points[points.length - 1]; const eps = 1e-9 * Math.max(1, Math.abs(last[0])); if (x < first[0] - eps || x > last[0] + eps) return null;
    if (points.length === 1) return Math.abs(x - first[0]) <= 1e-12 * Math.max(1, Math.abs(x)) ? first[1] : null;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      if (x <= b[0] || i === points.length - 1) { const dx = tx(b[0]) - tx(a[0]), t = dx === 0 ? 0 : Math.min(1, Math.max(0, (tx(x) - tx(a[0])) / dx)); return uy(ty(a[1]) + t * (ty(b[1]) - ty(a[1]))); }
    }
    return null;
  }
  /* Fadenkreuz: Werte aller Reihen (und der Geisterlinie) bei x; Vergleichskurven (ghost) bleiben draußen, damit die Zeile lesbar bleibt */
  function readout(c, ghost, x) {
    const rows = c.series.filter(s => s.kind !== 'ghost').map(s => ({ name: s.name, y: interp(s.points, x, c.xScale, c.yScale), ghost: false }));
    if (ghost) ghost.series.filter(s => s.kind !== 'ghost').forEach(s => rows.push({ name: 'Referenz: ' + s.name, y: interp(s.points, x, c.xScale, c.yScale), ghost: true }));
    const text = c.xLabel + ' ' + qv(x, c.xUnit) + ' – ' + rows.map(r => r.name + ' ' + (r.y == null ? 'außerhalb der Kurve' : qv(r.y, c.yUnit))).join('; ');
    return { x, rows, text };
  }
  /* Lage des Markers: nur Vergleich der gelieferten Zahlen (keine Bewertung); gespiegelte Grenze (sym): innerhalb, auf, außerhalb */
  function markerNote(c) {
    if (!c || !c.marker || !c.limit) return '';
    const m = c.marker, l = c.limit, cmp = (a, b) => (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) ? 0 : a > b ? 1 : -1);
    const nm = l.label ? l.label + ' ' : '', isY = fin(l.y), mv = isY ? m.y : m.x, lv = isY ? l.y : l.x, u = isY ? c.yUnit : c.xUnit;
    if (l.sym) { const k = cmp(Math.abs(mv), Math.abs(lv)); return 'Der Marker (' + qv(mv, u) + ') liegt ' + (k < 0 ? 'innerhalb von' : k === 0 ? 'auf' : 'außerhalb von') + ' den Grenzlinien ±' + nm + '(' + qv(Math.abs(lv), u) + ').'; }
    if (isY) return 'Der Marker (' + qv(mv, u) + ') liegt ' + ['unter', 'auf', 'über'][cmp(mv, lv) + 1] + ' der Grenzlinie ' + nm + '(' + qv(lv, u) + ').';
    return 'Der Marker (' + qv(mv, u) + ') liegt ' + ['links von', 'auf', 'rechts von'][cmp(mv, lv) + 1] + ' der Grenzlinie ' + nm + '(' + qv(lv, u) + ').';
  }
  /* Geometrie des Bildes für Breite w */
  function geom(c, ghost, w) {
    w = fin(w) ? Math.max(260, Math.min(900, Math.round(w))) : 640;
    const h = Math.round(Math.max(250, Math.min(420, w * 0.62))), L = 54, R = 26, T = 10, B = 46, b = bounds(c, ghost);
    const pw = w - L - R, ph = h - T - B;
    return { w, h, L, R, T, B, pw, ph, b, X: v => L + pos(v, b.x0, b.x1, c.xScale) * pw, Y: v => T + (1 - pos(v, b.y0, b.y1, c.yScale)) * ph, xAt: px => unpos(Math.min(1, Math.max(0, (px - L) / pw)), b.x0, b.x1, c.xScale) };
  }
  const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
  function pathOf(points, g) { return points.map((p, i) => (i ? 'L' : 'M') + g.X(p[0]).toFixed(1) + ' ' + g.Y(p[1]).toFixed(1)).join(''); }
  /* pre: Kennung für Klippfläche und Fadenkreuz-Gruppe (mehrere Bilder auf einer Seite) */
  function chartSvg(c, ghost, g, show, pre) {
    pre = pre || 'anaCu'; show = show || {};
    const b = g.b, o = [], tkx = ticks(b.x0, b.x1, c.xScale), tky = ticks(b.y0, b.y1, c.yScale);
    o.push('<rect class="ana-cu-bg" x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/>');
    tkx.forEach(v => { const x = g.X(v); o.push('<line class="ana-cu-gr" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/><text class="ana-cu-tx" x="' + x.toFixed(1) + '" y="' + (g.T + g.ph + 16) + '" text-anchor="middle">' + fv(v) + '</text>'); });
    tky.forEach(v => { const y = g.Y(v); o.push('<line class="ana-cu-gr" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="ana-cu-tx" x="' + (g.L - 5) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'); });
    o.push('<rect class="ana-cu-fr" x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/>');
    o.push('<text class="ana-cu-ti" x="' + (g.L + g.pw / 2) + '" y="' + (g.h - 6) + '" text-anchor="middle">' + esc(cut(c.xLabel + (c.xUnit ? ' in ' + c.xUnit : '') + (c.xScale === 'log' ? ' (log.)' : ''), Math.floor(g.pw / 7))) + '</text>');
    o.push('<text class="ana-cu-ti" transform="translate(13 ' + (g.T + g.ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(cut(c.yLabel + (c.yUnit ? ' in ' + c.yUnit : '') + (c.yScale === 'log' ? ' (log.)' : ''), Math.floor(g.ph / 7))) + '</text>');
    o.push('<g clip-path="url(#' + pre + 'Clip)">');
    (c.zones || []).forEach((z, i) => { const x0 = g.X(z.x0), x1 = g.X(z.x1); o.push('<rect class="ana-cu-zn" x="' + x0.toFixed(1) + '" y="' + g.T + '" width="' + Math.max(1, x1 - x0).toFixed(1) + '" height="' + g.ph + '"/>' + (z.name ? '<text class="ana-cu-mt" x="' + (x0 + 3).toFixed(1) + '" y="' + (g.T + g.ph - 6 - (i % 2) * 12) + '">' + esc(cut(z.name, Math.max(6, Math.floor((x1 - x0) / 6)))) + '</text>' : '')); });
    (c.marks || []).forEach((m, i) => {
      const x = g.X(m.x), right = x > g.L + g.pw * 0.72, ty = g.T + 12 + (i % 3) * 12;
      o.push('<line class="ana-cu-mk" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/><text class="ana-cu-mt" x="' + (x + (right ? -4 : 4)).toFixed(1) + '" y="' + ty + '" text-anchor="' + (right ? 'end' : 'start') + '">' + esc(cut(m.label, Math.max(6, Math.floor(g.pw / 11)))) + '</text>');
    });
    if (show.ghost && ghost) ghost.series.forEach(s => { if (s.kind !== 'ghost') o.push('<path class="ana-cu-gh" d="' + pathOf(s.points, g) + '"/>'); });
    c.series.forEach((s, i) => {
      const st = styleOf(c, i);
      o.push('<path class="ana-cu-ln' + (VERGL(s.kind) ? ' ana-cu-vg' : '') + '" stroke="' + st.col + '" stroke-width="' + st.w + '"' + (st.dash ? ' stroke-dasharray="' + st.dash + '"' : '') + ' d="' + pathOf(s.points, g) + '"/>' + (s.points.length <= 8 && !KIND_STYLE[s.kind] ? s.points.map(p => '<circle cx="' + g.X(p[0]).toFixed(1) + '" cy="' + g.Y(p[1]).toFixed(1) + '" r="3" fill="' + st.col + '"/>').join('') : ''));
    });
    if (c.limit) {
      const ln = (a, hz) => hz ? '<line class="ana-cu-lim" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + g.Y(a).toFixed(1) + '" y2="' + g.Y(a).toFixed(1) + '"/>' : '<line class="ana-cu-lim" x1="' + g.X(a).toFixed(1) + '" x2="' + g.X(a).toFixed(1) + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/>';
      if (fin(c.limit.y)) { o.push(ln(c.limit.y, true)); if (c.limit.sym && (c.yScale !== 'log')) o.push(ln(-c.limit.y, true)); }
      else if (fin(c.limit.x)) { o.push(ln(c.limit.x, false)); if (c.limit.sym && (c.xScale !== 'log')) o.push(ln(-c.limit.x, false)); }
    }
    if (c.marker) { const x = g.X(c.marker.x).toFixed(1), y = g.Y(c.marker.y).toFixed(1); o.push('<circle class="ana-cu-mr" cx="' + x + '" cy="' + y + '" r="9"/><circle class="ana-cu-md" cx="' + x + '" cy="' + y + '" r="5"/>'); }
    o.push('</g><g id="' + pre + 'Xh"></g>');
    return '<defs><clipPath id="' + pre + 'Clip"><rect x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/></clipPath></defs>' + o.join('');
  }
  function crossSvg(c, ghost, g, x) {
    if (!fin(x)) return ''; const px = g.X(x).toFixed(1), o = ['<line class="ana-cu-xh" x1="' + px + '" x2="' + px + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/>'];
    c.series.forEach((s, i) => { if (s.kind === 'ghost') return; const y = interp(s.points, x, c.xScale, c.yScale); if (y != null) o.push('<circle cx="' + px + '" cy="' + g.Y(y).toFixed(1) + '" r="4.5" fill="' + styleOf(c, i).col + '" stroke="var(--bg)" stroke-width="1.5"/>'); });
    return o.join('');
  }
  /* Geisterlinie: gleiche Kurve (id) aus dem Referenz-Prüfstand */
  function ghostOf(refRig, id) {
    if (!refRig || typeof refRig.curves !== 'function') return null; let l = null; try { l = refRig.curves(); } catch (e) { l = null; }
    return cleanAll(l).find(q => q.id === id) || null;
  }

  /* ---------- Vertiefungen: nur Zuordnung der Steuerwerte zu den Eingaben von ANA_CORE.deep (keine Rechnung) ---------- */
  const lo = x => String(x == null ? '' : x).toLowerCase();
  const NODEEP = { bode: 'Für diese Schaltung gibt es das Bode-Diagramm hier nicht (es gilt für den Verstärker mit Gegenkopplung: invertierend, nichtinvertierend, Folger, realer Operationsverstärker).', sat: 'Die Sättigung wird für Verstärker mit Gegenkopplung gezeigt (invertierend, nichtinvertierend, Folger, nicht für den Differenzverstärker).' };
  /* liefert { bode, sat }: null = der Prüfstand hat diese Vertiefung nicht, { why } = Klappe da, aber nicht für diese Schaltung, { cfg } = Eingaben für deep.bode bzw. deep.sat */
  function deepPlan(rigId, ctl, met) {
    ctl = isObj(ctl) ? ctl : {}; met = isObj(met) ? met : {};
    const out = { bode: null, sat: null }, sch = lo(ctl.schaltung);
    const sat = () => ({ cfg: { opv: ctl.opv, uv: +ctl.uv, v: +met.v } });
    if (rigId === 'opv_inv') { out.bode = { cfg: { art: 'inv', r1: +ctl.r1, rf: +ctl.rf, opv: ctl.opv } }; out.sat = sat(); }
    else if (rigId === 'opv_nin') {
      out.bode = sch === 'differenz' ? { why: NODEEP.bode } : { cfg: { art: 'nin', rg: +ctl.rg, rf: sch === 'folger' ? 0 : +ctl.rf, opv: ctl.opv } };
      out.sat = sch === 'differenz' ? { why: NODEEP.sat } : sat();
    } else if (rigId === 'opv_aktiv') out.bode = sch === 'real' ? { cfg: { art: 'inv', r1: +ctl.r1, rf: +ctl.rf, opv: ctl.opv } } : { why: NODEEP.bode };
    return out;
  }
  const deepKeys = plan => ['bode', 'sat'].filter(k => plan && plan[k]);
  /* Bode: Aufruf von ANA_CORE.deep.bode; Rückgabe { ok, valid, b, text, curves } oder { ok:false, why } */
  function bodeData(cfg) {
    const C = CORE(); if (!C || !C.deep || typeof C.deep.bode !== 'function') return { ok: false, why: 'Der Rechenkern (anacore-op.js) ist nicht geladen.' };
    let b = null; try { b = C.deep.bode(cfg); } catch (e) { b = null; }
    if (!b || b.ok === false) return { ok: false, why: 'Für diese Werte gibt es kein Bode-Diagramm' + (b && b.why ? ': ' + b.why : '.') };
    if (b.valid === false) return { ok: false, valid: false, why: String(b.why || 'Beim idealen Operationsverstärker gibt es keinen Frequenzgang.') };
    if (!Array.isArray(b.f) || !Array.isArray(b.a) || !fin(b.fg)) return { ok: false, why: 'Für diese Werte gibt es kein Bode-Diagramm.' };
    return { ok: true, valid: true, b, curves: bodeCurves(b), text: bodeText(b) };
  }
  const zip = (f, y) => f.map((x, i) => [x, y[i]]);
  function bodeCurves(b) {
    const marks = [{ x: b.fg, label: 'f_g' }]; if (fin(b.gbw) && b.gbw > 0) marks.push({ x: b.gbw, label: 'GBW' }); if (fin(b.fA) && b.fA > 0) marks.push({ x: b.fA, label: 'f_A' });
    const base = { xLabel: 'Frequenz f', xUnit: 'Hz', xScale: 'log', vertiefung: true, marks };
    const ptsA = zip(b.f, b.a), mkA = interp(ptsA.filter(p => fin(p[1])), b.fg, 'log', 'lin'), pphi = Array.isArray(b.phi) ? zip(b.f, b.phi) : [], mkP = interp(pphi.filter(p => fin(p[1])), b.fg, 'log', 'lin');
    const a = Object.assign({ id: 'bode-a', title: 'Bode-Diagramm: Betrag', yLabel: 'Verstärkungsmaß a', yUnit: 'dB', series: [{ name: 'gegengekoppelt', kind: 'out', points: ptsA }].concat(Array.isArray(b.aOpen) ? [{ name: 'Leerlauf', kind: 'line', points: zip(b.f, b.aOpen) }] : []), marker: mkA == null ? null : { x: b.fg, y: mkA, label: 'f_g' } }, base);
    const p = Object.assign({ id: 'bode-phi', title: 'Bode-Diagramm: Phase', yLabel: 'Phasenwinkel φ', yUnit: '°', series: [{ name: 'gegengekoppelt', kind: 'out', points: pphi }].concat(Array.isArray(b.phiOpen) ? [{ name: 'Leerlauf', kind: 'line', points: zip(b.f, b.phiOpen) }] : []), marker: mkP == null ? null : { x: b.fg, y: mkP, label: 'f_g' } }, base);
    return [clean(a), clean(p)].filter(Boolean);
  }
  /* Dämpfung je Dekade im Leerlauf: Differenz zweier gelieferter Werte aOpen im Abstand einer Dekade (Rasterpunkte des Kerns, 12 je Dekade; kein eigenes Modell) */
  function decade(b) {
    if (!Array.isArray(b.aOpen) || !Array.isArray(b.f) || !(b.fA > 0) || !(b.gbw > b.fA)) return null;
    const mid = Math.sqrt(b.fA * b.gbw); let k = -1, best = Infinity;
    b.f.forEach((f, i) => { const d = Math.abs(Math.log10(f / mid)); if (d < best && fin(b.aOpen[i])) { best = d; k = i; } });
    if (k < 0) return null; let j = -1;
    for (let i = 0; i < b.f.length; i++) { if (i !== k && fin(b.aOpen[i]) && Math.abs(b.f[i] / b.f[k] / 10 - 1) < 1e-6) { j = i; break; } }
    if (j < 0) for (let i = 0; i < b.f.length; i++) { if (i !== k && fin(b.aOpen[i]) && Math.abs(b.f[i] / b.f[k] * 10 - 1) < 1e-6) { j = i; break; } }
    if (j < 0) return null; const lo1 = b.f[k] < b.f[j] ? k : j, hi1 = lo1 === k ? j : k;
    return { f1: b.f[lo1], a1: b.aOpen[lo1], f2: b.f[hi1], a2: b.aOpen[hi1], diff: b.aOpen[lo1] - b.aOpen[hi1] };
  }
  function bodeText(b) {
    const d = decade(b);
    return String(b.text || '') + (d ? ' Im Leerlauf fällt die Verstärkung je Dekade um ' + fv(d.diff) + ' dB (' + fv(d.a1) + ' dB bei ' + qv(d.f1, 'Hz') + ', ' + fv(d.a2) + ' dB bei ' + qv(d.f2, 'Hz') + ').' : '');
  }
  /* Sättigung: ANA_CORE.deep.sat; Rückgabe { ok, s, text, ueMax } oder { ok:false, why } */
  function satData(cfg) {
    const C = CORE(); if (!C || !C.deep || typeof C.deep.sat !== 'function') return { ok: false, why: 'Der Rechenkern (anacore-op.js) ist nicht geladen.' };
    let s = null; try { s = C.deep.sat(cfg); } catch (e) { s = null; }
    if (!s || s.ok === false || s.valid === false) return { ok: false, why: 'Für diese Werte gibt es keine Sättigungsrechnung' + (s && s.why ? ': ' + s.why : '.') };
    if (!fin(s.ueMax)) return { ok: false, why: 'Für diese Werte ist U_e,max nicht bestimmt (Verstärkung oder Versorgung fehlen).' };
    return { ok: true, s, ueMax: s.ueMax, text: String(s.text || '') };
  }
  /* Übertragungskennlinie mit ±U_e,max als Marken; Aussage über den Marker nur aus dem Vergleich */
  function satCurve(list, ueMax) {
    const c = cleanAll(list).find(q => q.id === 'uebertragung'); if (!c || !fin(ueMax) || !(ueMax > 0)) return null;
    return Object.assign({}, c, { vertiefung: true, marks: [{ x: ueMax, label: '+U_e,max' }, { x: -ueMax, label: '−U_e,max' }] });
  }
  function satNote(c, ueMax) {
    if (!c || !c.marker || !fin(ueMax)) return '';
    const e = Math.abs(c.marker.x), k = Math.abs(e - ueMax) <= 1e-9 * Math.max(1, ueMax) ? 0 : e > ueMax ? 1 : -1;
    return 'Die Eingangsspannung am Marker (' + qv(c.marker.x, c.xUnit) + ') liegt ' + (k < 0 ? 'innerhalb von' : k === 0 ? 'genau auf' : 'außerhalb von') + ' ±U_e,max (' + qv(ueMax, 'V') + '): ' + (k > 0 ? 'Der Ausgang ist begrenzt.' : k === 0 ? 'Der Ausgang erreicht gerade die Grenze.' : 'Der Ausgang ist nicht begrenzt.');
  }

  /* CSV über alle Kurven: Kennlinie;Reihe;x;y;x-Einheit;y-Einheit, Dezimalkomma, Felder mit ; oder " in Anführungszeichen */
  const cq = s => (/[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const cn = v => String(+v.toPrecision(9)).replace('.', ',');
  function toCsv(curves, title, extra) {
    const rows = ['# Tonfunk Analogtechnik-Lab;Kennlinien;' + cq(title || '') + ';Übungswerte, Lehrdarstellung', 'Kennlinie;Reihe;x;y;x-Einheit;y-Einheit'];
    cleanAll(curves).forEach(c => {
      const gh = extra && extra[c.id];
      c.series.forEach(s => s.points.forEach(p => rows.push([cq(c.title), cq(s.name), cn(p[0]), cn(p[1]), cq(c.xUnit), cq(c.yUnit)].join(';'))));
      if (gh) gh.series.forEach(s => s.points.forEach(p => rows.push([cq(c.title), cq('Referenz (Vorher): ' + s.name), cn(p[0]), cn(p[1]), cq(c.xUnit), cq(c.yUnit)].join(';'))));
    });
    return rows.join('\r\n') + '\r\n';
  }
  function splitCsv(line) {
    const out = []; let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ';') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out;
  }
  function fromCsv(text) {
    const res = { title: '', curves: [] }, by = {};
    String(text == null ? '' : text).replace(/^﻿/, '').split(/\r?\n/).forEach(ln => {
      if (!ln) return; const c = splitCsv(ln);
      if (ln[0] === '#') { res.title = c[2] || ''; return; }
      if (c[0] === 'Kennlinie') return;
      const x = parseFloat(String(c[2]).replace(',', '.')), y = parseFloat(String(c[3]).replace(',', '.')); if (!fin(x) || !fin(y)) return;
      let cv = by[c[0]]; if (!cv) { cv = by[c[0]] = { title: c[0], xUnit: c[4] || '', yUnit: c[5] || '', series: [] }; res.curves.push(cv); }
      let s = cv.series.find(q => q.name === c[1]); if (!s) { s = { name: c[1], points: [] }; cv.series.push(s); }
      s.points.push([x, y]);
    });
    return res;
  }
  const tableRows = (c, ghost, max) => {
    const xs = []; c.series.forEach(s => { if (s.kind !== 'ghost') s.points.forEach(p => { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); }); }); xs.sort((a, b) => a - b);
    const mx = Math.max(2, max || 24), pick = xs.length <= mx ? xs : Array.from({ length: mx }, (v, k) => xs[Math.round(k * (xs.length - 1) / (mx - 1))]).filter((v, k, a) => a.indexOf(v) === k);
    const ser = c.series.filter(s => s.kind !== 'ghost');
    return pick.map(x => ({ x, ys: ser.map(s => { const p = s.points.find(q => q[0] === x); return p ? p[1] : interp(s.points, x, c.xScale, c.yScale); }) }));
  };

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { rigId: null, id: null, ghost: true, table: false, x: null, bx: null, sx: null, v: {}, hw: 0, wFix: 0, w: 0 };
  const VIEWS = { anaCu: 'm', anaCuBA: 'ba', anaCuBP: 'bp', anaCuSC: 'sc' };
  const CSS = '.ana-cu-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.ana-cu-wrap{touch-action:pan-y;position:relative}.ana-cu-svg{display:block;width:100%;height:auto;border-radius:8px;outline:none}.ana-cu-svg:focus-visible{outline:2px solid var(--accent)}' +
    '.ana-cu-bg{fill:var(--well)}.ana-cu-fr{fill:none;stroke:var(--chart-axis);stroke-width:1}.ana-cu-gr{stroke:var(--chart-grid);stroke-width:1}.ana-cu-tx{fill:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}.ana-cu-ti{fill:var(--fg);font-size:12px}' +
    '.ana-cu-ln{fill:none;stroke-linejoin:round}.ana-cu-vg{opacity:.8}.ana-cu-gh{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-dasharray:3 3;opacity:.85}.ana-cu-zn{fill:var(--mute);opacity:.12}.ana-cu-lim{stroke:var(--danger);stroke-width:2;stroke-dasharray:6 3}' +
    '.ana-cu-mk{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 3}.ana-cu-mt{fill:var(--mute);font-size:12px}' +
    '.ana-cu-mr{fill:none;stroke:var(--fg);stroke-width:1.6}.ana-cu-md{fill:var(--fg);stroke:var(--bg);stroke-width:1.5}.ana-cu-xh{stroke:var(--fg);stroke-width:1;opacity:.7}' +
    '.ana-cu-leg{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}.ana-cu-leg li{display:flex;align-items:center;gap:6px;min-height:24px}.ana-cu-sw{width:30px;height:12px;flex:none}.ana-cu-read{min-height:44px;margin-top:8px;font-size:13.5px;font-variant-numeric:tabular-nums}' +
    '.ana-cu-deep .ana-cu-sub{margin:12px 0 4px;font-size:13px;font-weight:600}.ana-cu-rz{margin:10px 0 0;font-size:13.5px;line-height:1.45}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('anaCurveCss')) { const s = document.createElement('style'); s.id = 'anaCurveCss'; s.textContent = CSS; document.head.appendChild(s); } } catch (e) {} }
  const rigCurves = () => { let l = []; try { l = A && A.rig && typeof A.rig.curves === 'function' ? A.rig.curves() : []; } catch (e) { l = []; } return split(l); };
  const rigCtl = () => { try { if (A && typeof A.allCtl === 'function') return A.allCtl(); if (A && A.rig && typeof A.rig.getControls === 'function') return A.rig.getControls(); } catch (e) {} return {}; };
  const rigMeters = () => { try { return A && A.rig && typeof A.rig.readMeters === 'function' ? A.rig.readMeters() : {}; } catch (e) { return {}; } };
  const deepState = () => { try { const d = A && A.deep ? A.deep.get() : {}; return isObj(d) ? d : {}; } catch (e) { return {}; } };
  const plan = () => (A && A.rig ? deepPlan(A.rig.id, rigCtl(), rigMeters()) : { bode: null, sat: null });
  const swatch = (c, i, kind) => {
    const s = kind ? null : styleOf(c, i), col = kind === 'gh' || kind === 'mk' ? 'var(--mute)' : kind === 'lim' ? 'var(--danger)' : s.col, dash = kind === 'gh' ? '3 3' : kind === 'lim' ? '6 3' : kind === 'mk' ? '2 4' : s.dash;
    return '<svg class="ana-cu-sw" viewBox="0 0 30 12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" stroke="' + col + '" stroke-width="3"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/></svg>';
  };
  function legend(c, ghost, show) {
    const li = c.series.map((s, i) => '<li>' + swatch(c, i) + esc((s.kind === 'ghost' ? 'Vergleich: ' : '') + s.name) + '</li>');
    (c.marks || []).forEach(m => li.push('<li>' + swatch(c, 0, 'mk') + esc(m.label || 'Marke') + ': ' + esc(qv(m.x, c.xUnit)) + '</li>'));
    (c.zones || []).forEach(z => li.push('<li><svg class="ana-cu-sw" viewBox="0 0 30 12" aria-hidden="true"><rect x="1" y="1" width="28" height="10" fill="var(--mute)" opacity=".3"/></svg>Bereich: ' + esc(z.name || 'Bereich') + '</li>'));
    if (c.limit) { const l = c.limit, isY = fin(l.y); li.push('<li>' + swatch(c, 0, 'lim') + esc((l.sym ? '±' : '') + (l.label || 'Grenzlinie')) + ' (' + esc(qv(isY ? l.y : l.x, isY ? c.yUnit : c.xUnit)) + ')</li>'); }
    if (c.marker) li.push('<li><svg class="ana-cu-sw" viewBox="0 0 30 12" aria-hidden="true"><circle cx="15" cy="6" r="5.5" fill="none" stroke="var(--fg)" stroke-width="1.5"/><circle cx="15" cy="6" r="3" fill="var(--fg)"/></svg>Marker: ' + esc(c.marker.label || qv(c.marker.x, c.xUnit) + ' / ' + qv(c.marker.y, c.yUnit)) + '</li>');
    if (show.ghost && ghost) li.push('<li>' + swatch(c, 0, 'gh') + 'Geisterlinie: Referenz (Vorher)</li>');
    return '<ul class="ana-cu-leg" aria-label="Legende">' + li.join('') + '</ul>';
  }
  function tableHtml(c) {
    const rows = tableRows(c, null, 24), ser = c.series.filter(s => s.kind !== 'ghost');
    return '<details class="card" id="anaCuTab"' + (st.table ? ' open' : '') + '><summary>Wertetabelle (Alternative zum Bild)</summary><div class="cb"><table class="kt"><tr><th class="n">' + esc(c.xLabel + (c.xUnit ? ' [' + c.xUnit + ']' : '')) + '</th>' + ser.map(s => '<th class="n">' + esc(s.name + (c.yUnit ? ' [' + c.yUnit + ']' : '')) + '</th>').join('') + '</tr>' +
      rows.map(r => '<tr><td class="n">' + fv(r.x) + '</td>' + r.ys.map(y => '<td class="n">' + (y == null ? '–' : fv(y)) + '</td>').join('') + '</tr>').join('') + '</table></div></details>';
  }
  const ghostFor = c => (A && A.S && A.S.ref && A.S.refRig ? ghostOf(A.S.refRig, c.id) : null);
  /* Bild einer Kurve: Geometrie und SVG; merkt sich Kurve, Geisterlinie und Geometrie unter key (für das Fadenkreuz) */
  function chartBlock(key, pre, c, wEl, withGhost) {
    const ghost = withGhost === false ? null : ghostFor(c), g = geom(c, ghost, wEl), note = markerNote(c);
    st.v[key] = { c, gh: ghost, g, pre };
    return '<div class="ana-cu-wrap"><svg class="ana-cu-svg" id="' + pre + 'Svg" viewBox="0 0 ' + g.w + ' ' + g.h + '" role="img" tabindex="0" aria-label="' + esc(c.title + '. ' + (c.marker ? 'Marker: ' + (c.marker.label || '') + '. ' : '') + note + ' Mit den Pfeiltasten wanderst du über die Kurve.') + '">' + chartSvg(c, ghost, g, { ghost: st.ghost }, pre) + '</svg></div>';
  }
  const HINT_X = 'Tippe oder fahre über ein Bild für das Fadenkreuz (Pfeiltasten gehen auch).';
  const deepRead = (keys, x) => keys.map(k => (st.v[k] ? readout(st.v[k].c, st.ghost ? st.v[k].gh : null, x).text : '')).filter(Boolean).join(' | ');
  const vHead = (id, title, key) => '<details class="card ana-vertiefung" id="' + id + '" data-deep="' + key + '"' + (deepState()[key] ? ' open' : '') + '><summary>Vertiefung: ' + title + ' <span class="bdg uw" title="Vertiefung: freiwillig' + (key === 'bode' ? ', Taste B' : '') + '">Vertiefung</span></summary><div class="cb ana-cu-deep">';
  function bodeHtml(p, wEl) {
    const head = vHead('anaCuBode', 'Bode-Diagramm', 'bode');
    st.v.ba = st.v.bp = null;
    if (!deepState().bode) return head + '</div></details>';
    if (p.why) return head + '<p class="hint2">' + esc(p.why) + '</p></div></details>';
    const d = bodeData(p.cfg);
    if (!d.ok) return head + '<p class="hint2">' + esc(d.why) + (d.valid === false ? ' Stelle im Prüfstand „langsam“ oder „schnell“ ein.' : ' Prüfe Widerstände und Operationsverstärker im Prüfstand.') + '</p></div></details>';
    const a = d.curves.find(c => c.id === 'bode-a'), ph = d.curves.find(c => c.id === 'bode-phi');
    return head + '<p class="hint2" style="margin:0 0 6px">Achsen: lg f in Hz (Dekaden), Verstärkungsmaß a = 20·lg|V_u| in dB, Phasenwinkel φ in °. Die gestrichelte Linie zeigt den Leerlauf ohne Gegenkopplung; beide Kurven treffen sich am Knick bei f_g. GBW: Verstärkungs-Bandbreite-Produkt. ' + esc(vertHint()) + '</p>' +
      (a ? '<p class="ana-cu-sub">' + esc(a.title) + '</p>' + chartBlock('ba', 'anaCuBA', a, wEl, false) + legend(a, null, {}) : '') + (ph ? '<p class="ana-cu-sub">' + esc(ph.title) + '</p>' + chartBlock('bp', 'anaCuBP', ph, wEl, false) : '') +
      '<div class="ana-cu-read" id="anaCuBRead" role="status" aria-live="polite">' + (fin(st.bx) ? esc(deepRead(['ba', 'bp'], st.bx)) : HINT_X) + '</div><p class="ana-cu-rz" id="anaCuRz">' + esc(d.text) + '</p></div></details>';
  }
  function satHtml(p, wEl, list) {
    const head = vHead('anaCuSat', 'Sättigung', 'sat');
    st.v.sc = null;
    if (!deepState().sat) return head + '</div></details>';
    if (p.why) return head + '<p class="hint2">' + esc(p.why) + '</p></div></details>';
    const d = satData(p.cfg);
    if (!d.ok) return head + '<p class="hint2">' + esc(d.why) + '</p></div></details>';
    const c = satCurve(list, d.ueMax), note = c ? satNote(c, d.ueMax) : '';
    return head + '<p class="hint2" style="margin:0 0 6px">Achsen: Eingangsspannung U_e in V, Ausgangsspannung U_a in V. Die senkrechten Marken zeigen ±U_e,max; darüber begrenzt der Ausgang bei ±U_sat. ' + esc(vertHint()) + '</p>' +
      (c ? '<p class="ana-cu-sub">' + esc(c.title) + '</p>' + chartBlock('sc', 'anaCuSC', c, wEl, false) + legend(c, null, {}) + '<div class="ana-cu-read" id="anaCuSRead" role="status" aria-live="polite">' + (fin(st.sx) ? esc(deepRead(['sc'], st.sx)) : HINT_X) + '</div>' : '') +
      (note ? '<div class="ex" style="margin-top:8px">' + esc(note) + '</div>' : '') + '<p class="ana-cu-rz" id="anaCuSz">' + esc(d.text) + '</p></div></details>';
  }
  function vertHint() { const C = CORE(); return C && C.TEXTS && typeof C.TEXTS.vertiefungHinweis === 'string' ? C.TEXTS.vertiefungHinweis : 'Vertiefung: gilt für das Lehrmodell des Operationsverstärkers (Übungswerte).'; }
  function deepHtml(wEl, list) {
    const p = plan(), keys = deepKeys(p); if (!keys.length) return '';
    return keys.map(k => (k === 'bode' ? bodeHtml(p.bode, wEl) : satHtml(p.sat, wEl, list))).join('');
  }
  function html() {
    const rig = A && A.rig;
    if (!rig) return '<div class="card pl"><p class="big">Kein Prüfstand</p><p class="hint2">Wähle im Tab Prüfstand eine Anlage, dann zeigt dieser Tab ihre Kennlinien.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    const cs = rigCurves(), rname = esc(typeof A.rigName === 'function' ? A.rigName(rig.id) : rig.id);
    if (st.rigId !== rig.id) { st.rigId = rig.id; st.id = null; st.x = null; st.bx = null; st.sx = null; }
    st.v = {};
    if (!cs.main.length && !cs.deep.length) return '<div class="card pl"><h4>Kennlinien: ' + rname + '</h4><p class="big">Keine Kennlinie</p><p class="hint2">Dieser Prüfstand liefert gerade keine Kennlinie. Im Tab Prüfstand zeigen Bild, Ampel und Meldungen das Ergebnis; Kennlinien gibt es zum Beispiel bei Diode, Transistor und Operationsverstärker.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    const hw = H && H.clientWidth ? H.clientWidth : 0; if (st.hw !== hw) { st.hw = hw; st.wFix = 0; }
    const wEl = st.wFix || (hw ? hw - 26 : 640); st.w = wEl;
    const hasRef = !!(A.S && A.S.ref); let main = '';
    if (cs.main.length) {
      const c = cs.main.find(q => q.id === st.id) || cs.main[0]; st.id = c.id;
      const note = markerNote(c), ghost = ghostFor(c);
      main = '<div class="card pl"><h4>Kennlinien: ' + rname + '</h4>' +
        (cs.main.length > 1 ? '<div class="ana-cu-tabs" role="tablist" aria-label="Kennlinie wählen">' + cs.main.map(q => '<button class="chip' + (q.id === c.id ? ' on' : '') + '" role="tab" aria-selected="' + (q.id === c.id) + '" data-cv="' + esc(q.id) + '">' + esc(cut(q.title, 44)) + '</button>').join('') + '</div>' : '') +
        '<p class="hint2" style="margin:0 0 6px"><b>' + esc(c.title) + '</b></p>' + chartBlock('m', 'anaCu', c, wEl) +
        '<div class="ana-cu-read" id="anaCuRead" role="status" aria-live="polite">' + (fin(st.x) ? esc(readout(c, st.ghost ? ghost : null, st.x).text) : HINT_X.replace('ein Bild', 'das Bild')) + '</div>' +
        legend(c, ghost, { ghost: st.ghost }) + (note ? '<div class="ex" style="margin-top:8px">' + esc(note) + '</div>' : '') +
        '<div class="btns"><button class="btn" data-act="csv">Alle Kennlinien als CSV</button>' + (hasRef ? '<button class="btn" data-act="ghost" aria-pressed="' + st.ghost + '">' + (st.ghost ? 'Geisterlinie ausblenden' : 'Geisterlinie einblenden') + '</button>' : '') + '<button class="btn" data-act="table" aria-pressed="' + st.table + '">' + (st.table ? 'Tabelle schließen' : 'Wertetabelle zeigen') + '</button></div>' +
        (hasRef ? '' : '<p class="hint2">Mit „Merken“ (Taste M) im Prüfstand legst du eine Referenz fest; sie erscheint hier als Geisterlinie.</p>') +
        '<p class="hint2">' + esc(NOTE) + '</p></div>' + tableHtml(c);
    } else main = '<div class="card pl"><h4>Kennlinien: ' + rname + '</h4><p class="hint2">Dieser Prüfstand hat nur die Vertiefung (siehe unten).</p></div>';
    return main + deepHtml(wEl, cs.main);
  }
  function paint(again) {
    if (!H) return; css(); H.innerHTML = html(); H.dataset.cu = '1';
    /* tatsächliche Bildbreite messen: gleicht die Ränder der Karte aus, damit die Schrift in echter Größe steht */
    const sv = H.querySelector('#anaCuSvg'), bw = sv && typeof sv.getBoundingClientRect === 'function' ? sv.getBoundingClientRect().width : 0;
    if (!again && st.v.m && bw > 120 && Math.abs(bw - st.v.m.g.w) > 3) { st.wFix = Math.round(bw); paint(true); return; }
    drawCross();
  }
  function drawCross() {
    if (!H) return;
    const m = st.v.m; if (m) { const xh = H.querySelector('#anaCuXh'), rd = H.querySelector('#anaCuRead'), gh = st.ghost ? m.gh : null; if (xh) xh.innerHTML = fin(st.x) ? crossSvg(m.c, gh, m.g, st.x) : ''; if (rd) rd.textContent = fin(st.x) ? readout(m.c, gh, st.x).text : HINT_X.replace('ein Bild', 'das Bild'); }
    ['ba', 'bp'].forEach(k => { const v = st.v[k]; if (!v) return; const xh = H.querySelector('#' + v.pre + 'Xh'); if (xh) xh.innerHTML = fin(st.bx) ? crossSvg(v.c, null, v.g, st.bx) : ''; });
    if (st.v.ba) { const rd = H.querySelector('#anaCuBRead'); if (rd) rd.textContent = fin(st.bx) ? deepRead(['ba', 'bp'], st.bx) : HINT_X; }
    const sc = st.v.sc; if (sc) { const xh = H.querySelector('#' + sc.pre + 'Xh'), rd = H.querySelector('#anaCuSRead'); if (xh) xh.innerHTML = fin(st.sx) ? crossSvg(sc.c, null, sc.g, st.sx) : ''; if (rd) rd.textContent = fin(st.sx) ? deepRead(['sc'], st.sx) : HINT_X; }
  }
  const XKEY = { m: 'x', ba: 'bx', bp: 'bx', sc: 'sx' };
  function setX(key, x) { st[XKEY[key] || 'x'] = fin(x) ? x : null; drawCross(); }
  const keyOf = t => { const s = t && t.closest ? t.closest('.ana-cu-svg') : null; const id = s && s.id ? String(s.id).replace(/Svg$/, '') : ''; return Object.prototype.hasOwnProperty.call(VIEWS, id) ? { key: VIEWS[id], pre: id } : null; };
  function pointerX(e, k) {
    const svg = H.querySelector('#' + k.pre + 'Svg'), v = st.v[k.key]; if (!svg || !v) return null;
    const r = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null; if (!r || !(r.width > 0)) return null;
    return v.g.xAt((e.clientX - r.left) * (v.g.w / r.width));
  }
  function saveCsv(txt) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'ana-kennlinien.csv'); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ana-kennlinien.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() {
    const cs = A && A.rig && typeof A.rig.curves === 'function' ? (() => { try { return A.rig.curves(); } catch (e) { return []; } })() : [];
    if (!cleanAll(cs).length) { A && A.toast && A.toast('Dieser Prüfstand hat keine Kennlinie zum Exportieren.'); return null; }
    const extra = {}; if (st.ghost && A.S && A.S.ref && A.S.refRig) cleanAll(cs).forEach(c => { const g = ghostOf(A.S.refRig, c.id); if (g) extra[c.id] = g; });
    const txt = toCsv(cs, (A.S && A.S.name) || '', extra); try { saveCsv(txt); } catch (e) { A.toast && A.toast('Die Datei konnte nicht gespeichert werden.'); return txt; }
    A.stat && A.stat('csv'); A.toast && A.toast('CSV gespeichert'); return txt;
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const cv = t.closest('[data-cv]'); if (cv) { st.id = cv.dataset.cv; st.x = null; paint(); return; }
    const b = t.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'csv') exportCsv(); else if (a === 'ghost') { st.ghost = !st.ghost; paint(); } else if (a === 'table') { st.table = !st.table; paint(); } else if (a === 'rig' && A) A.setTab('rig');
  }
  /* Klappe: der Zustand steht in ana.deep (api.deep); gleicht die Anzeige schon dem Speicher, passiert nichts (kein doppeltes Zählen) */
  const DEEPID = { anaCuBode: 'bode', anaCuSat: 'sat' };
  function onToggle(e) {
    const d = e && e.target, key = d && Object.prototype.hasOwnProperty.call(DEEPID, d.id) ? DEEPID[d.id] : null; if (!key || !A || !A.deep) return;
    const want = !!d.open; if (want !== !!deepState()[key]) { A.deep.set(key, want); paint(); }
  }
  /* Taste B: Vertiefung "Bode" auf oder zu; nur wo der Prüfstand sie hat */
  function toggleBode() {
    if (!A || !A.deep) return false;
    if (!A.rig || !plan().bode) { A.toast && A.toast('Die Bode-Vertiefung gibt es an den Prüfständen mit Operationsverstärker (invertierend, nichtinvertierend, aktiv).'); return false; }
    A.deep.set('bode', !deepState().bode); paint(); return !!deepState().bode;
  }
  function onKey(e) {
    const k = e.target ? keyOf(e.target) : null; const v = k && st.v[k.key]; if (!v) return;
    const key = e.key, g = v.g, xk = XKEY[k.key] || 'x', cur0 = st[xk]; if (key === 'Escape') { setX(k.key, null); return; }
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return;
    if (e.preventDefault) e.preventDefault();
    const cur = fin(cur0) ? g.X(cur0) : (key === 'ArrowLeft' ? g.L + g.pw : g.L);
    setX(k.key, key === 'Home' ? g.xAt(g.L) : key === 'End' ? g.xAt(g.L + g.pw) : g.xAt(cur + (key === 'ArrowRight' ? 1 : -1) * Math.max(4, g.pw / 40)));
  }
  function render(host, api) {
    A = api; H = host;
    once(host, 'c', 'click', onClick);
    once(host, 'm', 'pointermove', e => { const k = e.target ? keyOf(e.target) : null; if (k && e.pointerType !== 'touch') { const x = pointerX(e, k); if (x != null) setX(k.key, x); } });
    once(host, 'd', 'pointerdown', e => { const k = e.target ? keyOf(e.target) : null; if (k) { const x = pointerX(e, k); if (x != null) setX(k.key, x); } });
    once(host, 'k', 'keydown', onKey); once(host, 't', 'toggle', onToggle, true);
    if (typeof ResizeObserver === 'function' && !host.__anacuRo) { host.__anacuRo = new ResizeObserver(() => redraw()); try { host.__anacuRo.observe(host); } catch (e) {} }
    paint();
  }
  function redraw() { if (!H || !A || !H.clientWidth) return; if (Math.abs(H.clientWidth - st.hw) > 6 || !H.dataset.cu) paint(); }
  function refresh() { paint(); }

  E.curve = { render, refresh, redraw, toggleBode, fn: { fv, qv, clean, cleanAll, split, styleOf, niceRange, ticks, bounds, pos, unpos, interp, readout, markerNote, geom, ghostOf, deepPlan, deepKeys, bodeData, bodeCurves, bodeText, decade, satData, satCurve, satNote, toCsv, fromCsv, tableRows, chartSvg, crossSvg, legend, html, state: st, NOTE, setApi: a => { A = a; }, setHost: h => { H = h; } } };
})(typeof window !== 'undefined' ? window : globalThis);
