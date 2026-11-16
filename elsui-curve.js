'use strict';
/* Tonfunk Sicherheits-Lab (ELS-Lab): Tab "Kennlinien" (WP3b, SPEC 6.4).
   Zeichnet jede Kurve aus rig.curves() als SVG: Zonenbild (koerper, klassen), Auslöseband log-log (schutz, netz, rcd), Schleifenstrom über der Leitungslänge mit Grenzlinie (netz),
   Auslösezeit über Differenzstrom (rcd), R_iso über Feuchte (isolation). Dazu Fadenkreuz (Maus, Touch, Pfeiltasten), Marker (Betriebspunkt), Grenzlinie, Band (früheste/späteste Linie),
   Geisterlinie der Referenz (Vorher, aus S.refRig), Wertetabelle als Alternative zum Bild und CSV (alle Kurven).
   Es wird NICHT gerechnet: Alle Zahlen (Kurven, Marker, Grenzen) kommen aus rig.curves(); hier stehen nur Abbildung, Interpolation zwischen Stützstellen und Beschriftung (SPEC Regel 7).
   Aussagen über die Lage des Markers (über/unter der Linie) entstehen nur aus dem Vergleich der gelieferten Zahlen (Regel 2). Alle Kurven sind Lehrmodelle mit Übungswerten.
   Schnittstelle (VERTRAG 6.5): window.ELS_UI_EXT.curve = { render(host, api), refresh(), redraw(), fn }. Die reinen Funktionen (ohne DOM) hängen unter fn und werden von test_elsui_ext.js geprüft. */
(function (root) {
  const E = root.ELS_UI_EXT = root.ELS_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const once = (host, name, ty, fn) => { host.__elscu = host.__elscu || {}; if (host.__elscu[name + ty]) return; host.__elscu[name + ty] = 1; host.addEventListener(ty, fn); };
  const NOTE = 'Kennlinien sind Lehrmodelle mit Übungswerten (A), keine Herstellerdaten und kein Nachweis.';
  const SER = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--lv-zusatz)'], DASH = ['', '8 4', '2 4', '10 3 2 3'];

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* Zahl mit Dezimalkomma, 3 gültige Stellen */
  function fv(v) {
    if (!fin(v)) return '–'; const a = Math.abs(v); if (a === 0) return '0';
    const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(3);
    return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  const withUnit = (v, u) => fv(v) + (u ? ' ' + u : '');
  const scaleOf = s => (s === 'log' ? 'log' : 'lin');
  /* Kurve bereinigen: nur endliche Punkte (log: nur positive), leere Reihen entfallen; null, wenn nichts zu zeichnen ist */
  function clean(cv) {
    if (!cv || typeof cv !== 'object') return null;
    const xs = scaleOf(cv.xScale), ys = scaleOf(cv.yScale);
    const okp = p => Array.isArray(p) && fin(p[0]) && fin(p[1]) && (xs !== 'log' || p[0] > 0) && (ys !== 'log' || p[1] > 0);
    const series = (Array.isArray(cv.series) ? cv.series : []).map(s => ({ name: String((s && s.name) || ''), points: (s && Array.isArray(s.points) ? s.points : []).filter(okp).map(p => [p[0], p[1]]).sort((a, b) => a[0] - b[0]) })).filter(s => s.points.length > 0);
    const mk = cv.marker && fin(cv.marker.x) && fin(cv.marker.y) && (xs !== 'log' || cv.marker.x > 0) && (ys !== 'log' || cv.marker.y > 0) ? { x: cv.marker.x, y: cv.marker.y, label: String(cv.marker.label != null ? cv.marker.label : cv.marker.text || '') } : null;
    const lm = cv.limit && fin(cv.limit.y) && (ys !== 'log' || cv.limit.y > 0) ? { y: cv.limit.y, label: String(cv.limit.label || '') } : null;
    if (!series.length) return null;
    return { id: String(cv.id || ''), title: String(cv.title || cv.id || 'Kennlinie'), xLabel: String(cv.xLabel || 'x'), xUnit: String(cv.xUnit || ''), xScale: xs, yLabel: String(cv.yLabel || 'y'), yUnit: String(cv.yUnit || ''), yScale: ys, series, marker: mk, limit: lm };
  }
  const cleanAll = list => (Array.isArray(list) ? list : []).map(clean).filter(Boolean);
  /* Band: genau zwei Reihen "früheste ..." und "späteste ..." (Streuung statt einer Linie) */
  function bandOf(c) {
    if (!c) return null; const lo = c.series.findIndex(s => /früh/i.test(s.name)), hi = c.series.findIndex(s => /spät/i.test(s.name));
    return lo >= 0 && hi >= 0 && lo !== hi ? { lo, hi } : null;
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
  /* Achsenbereiche über alle Reihen (und Geisterlinie), Marker und Grenzlinie */
  function bounds(c, ghost) {
    const xs = [], ys = [];
    [c, ghost].forEach(q => { if (!q) return; q.series.forEach(s => s.points.forEach(p => { xs.push(p[0]); ys.push(p[1]); })); if (q.marker) { xs.push(q.marker.x); ys.push(q.marker.y); } if (q.limit) ys.push(q.limit.y); });
    const mm = a => a.reduce((r, v) => [Math.min(r[0], v), Math.max(r[1], v)], [Infinity, -Infinity]);
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
  /* Fadenkreuz: Werte aller Reihen (und der Geisterlinie) bei x */
  function readout(c, ghost, x) {
    const rows = c.series.map(s => ({ name: s.name, y: interp(s.points, x, c.xScale, c.yScale), ghost: false }));
    if (ghost) ghost.series.forEach(s => rows.push({ name: 'Referenz: ' + s.name, y: interp(s.points, x, c.xScale, c.yScale), ghost: true }));
    const text = c.xLabel + ' ' + withUnit(x, c.xUnit) + ' – ' + rows.map(r => r.name + ' ' + (r.y == null ? 'außerhalb der Kurve' : withUnit(r.y, c.yUnit))).join('; ');
    return { x, rows, text };
  }
  /* Lage des Markers: nur Vergleich der gelieferten Zahlen (keine Bewertung) */
  function markerNote(c) {
    if (!c || !c.marker) return '';
    const m = c.marker, out = [], cmp = (a, b) => (Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)) ? 0 : a > b ? 1 : -1), w = ['unter', 'auf', 'über'];
    if (c.limit) out.push('Der Marker (' + withUnit(m.y, c.yUnit) + ') liegt ' + w[cmp(m.y, c.limit.y) + 1] + ' der Grenzlinie (' + withUnit(c.limit.y, c.yUnit) + ').');
    const b = bandOf(c);
    if (b) {
      const lo = interp(c.series[b.lo].points, m.x, c.xScale, c.yScale), hi = interp(c.series[b.hi].points, m.x, c.xScale, c.yScale);
      if (lo != null && hi != null) { const a = Math.min(lo, hi), z = Math.max(lo, hi); out.push('Bei ' + withUnit(m.x, c.xUnit) + ' liegt der Marker ' + (m.y < a * (1 - 1e-9) ? 'unter' : m.y > z * (1 + 1e-9) ? 'über' : 'im') + ' Band (' + withUnit(a, c.yUnit) + ' bis ' + withUnit(z, c.yUnit) + ').'); }
    }
    return out.join(' ');
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
  function chartSvg(c, ghost, g, show) {
    const b = g.b, o = [], tkx = ticks(b.x0, b.x1, c.xScale), tky = ticks(b.y0, b.y1, c.yScale), bd = bandOf(c);
    o.push('<rect class="cu-bg" x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/>');
    tkx.forEach(v => { const x = g.X(v); o.push('<line class="cu-gr" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/><text class="cu-tx" x="' + x.toFixed(1) + '" y="' + (g.T + g.ph + 16) + '" text-anchor="middle">' + fv(v) + '</text>'); });
    tky.forEach(v => { const y = g.Y(v); o.push('<line class="cu-gr" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + y.toFixed(1) + '" y2="' + y.toFixed(1) + '"/><text class="cu-tx" x="' + (g.L - 5) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'); });
    o.push('<rect class="cu-fr" x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/>');
    o.push('<text class="cu-ti" x="' + (g.L + g.pw / 2) + '" y="' + (g.h - 6) + '" text-anchor="middle">' + esc(cut(c.xLabel + (c.xUnit ? ' in ' + c.xUnit : ''), Math.floor(g.pw / 7))) + '</text>');
    o.push('<text class="cu-ti" transform="translate(13 ' + (g.T + g.ph / 2) + ') rotate(-90)" text-anchor="middle">' + esc(cut(c.yLabel + (c.yUnit ? ' in ' + c.yUnit : ''), Math.floor(g.ph / 7))) + '</text>');
    o.push('<g clip-path="url(#cuClip)">');
    if (bd) { const lo = c.series[bd.lo].points, hi = c.series[bd.hi].points.slice().reverse(); o.push('<path class="cu-band" d="' + pathOf(lo.concat(hi), g) + 'Z"/>'); }
    if (show.ghost && ghost) ghost.series.forEach(s => o.push('<path class="cu-gh" d="' + pathOf(s.points, g) + '"/>'));
    c.series.forEach((s, i) => o.push('<path class="cu-ln" stroke="' + SER[i % SER.length] + '"' + (DASH[i % DASH.length] ? ' stroke-dasharray="' + DASH[i % DASH.length] + '"' : '') + ' d="' + pathOf(s.points, g) + '"/>' + (s.points.length <= 8 ? s.points.map(p => '<circle cx="' + g.X(p[0]).toFixed(1) + '" cy="' + g.Y(p[1]).toFixed(1) + '" r="3" fill="' + SER[i % SER.length] + '"/>').join('') : '')));
    if (c.limit) o.push('<line class="cu-lim" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + g.Y(c.limit.y).toFixed(1) + '" y2="' + g.Y(c.limit.y).toFixed(1) + '"/>');
    if (c.marker) { const x = g.X(c.marker.x).toFixed(1), y = g.Y(c.marker.y).toFixed(1); o.push('<circle class="cu-mr" cx="' + x + '" cy="' + y + '" r="9"/><circle class="cu-md" cx="' + x + '" cy="' + y + '" r="5"/>'); }
    o.push('</g><g id="cuXh"></g>');
    return '<defs><clipPath id="cuClip"><rect x="' + g.L + '" y="' + g.T + '" width="' + g.pw + '" height="' + g.ph + '"/></clipPath></defs>' + o.join('');
  }
  function crossSvg(c, ghost, g, x) {
    if (!fin(x)) return ''; const px = g.X(x).toFixed(1), o = ['<line class="cu-xh" x1="' + px + '" x2="' + px + '" y1="' + g.T + '" y2="' + (g.T + g.ph) + '"/>'];
    c.series.forEach((s, i) => { const y = interp(s.points, x, c.xScale, c.yScale); if (y != null) o.push('<circle cx="' + px + '" cy="' + g.Y(y).toFixed(1) + '" r="4.5" fill="' + SER[i % SER.length] + '" stroke="var(--bg)" stroke-width="1.5"/>'); });
    return o.join('');
  }
  /* Geisterlinie: gleiche Kurve (id) aus dem Referenz-Prüfstand */
  function ghostOf(refRig, id) {
    if (!refRig || typeof refRig.curves !== 'function') return null; let l = null; try { l = refRig.curves(); } catch (e) { l = null; }
    return cleanAll(l).find(q => q.id === id) || null;
  }
  /* CSV über alle Kurven: Kennlinie;Reihe;x;y;x-Einheit;y-Einheit, Dezimalkomma, Felder mit ; oder " in Anführungszeichen */
  const cq = s => (/[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const cn = v => String(+v.toPrecision(9)).replace('.', ',');
  function toCsv(curves, title, extra) {
    const rows = ['# Tonfunk Sicherheits-Lab;Kennlinien;' + cq(title || '') + ';Übungswerte, Lehrdarstellung', 'Kennlinie;Reihe;x;y;x-Einheit;y-Einheit'];
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
    const xs = []; c.series.forEach(s => s.points.forEach(p => { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); })); xs.sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(xs.length / (max || 24))), pick = xs.filter((v, i) => i % step === 0 || i === xs.length - 1);
    return pick.map(x => ({ x, ys: c.series.map(s => { const p = s.points.find(q => q[0] === x); return p ? p[1] : interp(s.points, x, c.xScale, c.yScale); }) }));
  };

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { rigId: null, id: null, ghost: true, table: false, x: null, g: null, c: null, gh: null, w: 0 };
  const CSS = '.cu-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}.cu-wrap{touch-action:pan-y;position:relative}.cu-svg{display:block;width:100%;height:auto;border-radius:8px;outline:none}.cu-svg:focus-visible{outline:2px solid var(--accent)}' +
    '.cu-bg{fill:var(--well)}.cu-fr{fill:none;stroke:var(--chart-axis);stroke-width:1}.cu-gr{stroke:var(--chart-grid);stroke-width:1}.cu-tx{fill:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}.cu-ti{fill:var(--fg);font-size:12px}' +
    '.cu-ln{fill:none;stroke-width:2.6;stroke-linejoin:round}.cu-gh{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-dasharray:3 3;opacity:.85}.cu-band{fill:var(--accent);opacity:.16}.cu-lim{stroke:var(--danger);stroke-width:2;stroke-dasharray:6 3}' +
    '.cu-mr{fill:none;stroke:var(--fg);stroke-width:1.6}.cu-md{fill:var(--fg);stroke:var(--bg);stroke-width:1.5}.cu-xh{stroke:var(--fg);stroke-width:1;opacity:.7}' +
    '.cu-leg{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}.cu-leg li{display:flex;align-items:center;gap:6px;min-height:24px}.cu-sw{width:30px;height:12px;flex:none}.cu-read{min-height:44px;margin-top:8px;font-size:13.5px;font-variant-numeric:tabular-nums}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('elsCurveCss')) { const s = document.createElement('style'); s.id = 'elsCurveCss'; s.textContent = CSS + ZCSS; document.head.appendChild(s); } } catch (e) {} }
  const rigCurves = () => { let l = []; try { l = A && A.rig && typeof A.rig.curves === 'function' ? A.rig.curves() : []; } catch (e) { l = []; } return cleanAll(l); };
  const swatch = (i, kind) => '<svg class="cu-sw" viewBox="0 0 30 12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" stroke="' + (kind === 'gh' ? 'var(--mute)' : kind === 'lim' ? 'var(--danger)' : SER[i % SER.length]) + '" stroke-width="3"' + (kind === 'gh' ? ' stroke-dasharray="3 3"' : kind === 'lim' ? ' stroke-dasharray="6 3"' : DASH[i % DASH.length] ? ' stroke-dasharray="' + DASH[i % DASH.length] + '"' : '') + '/></svg>';
  function legend(c, ghost, show) {
    const li = c.series.map((s, i) => '<li>' + swatch(i) + esc(s.name) + '</li>');
    if (bandOf(c)) li.push('<li><svg class="cu-sw" viewBox="0 0 30 12" aria-hidden="true"><rect x="1" y="1" width="28" height="10" fill="var(--accent)" opacity=".3"/></svg>Band zwischen frühester und spätester Linie</li>');
    if (c.limit) li.push('<li>' + swatch(0, 'lim') + esc(c.limit.label || 'Grenzlinie') + ' (' + withUnit(c.limit.y, c.yUnit) + ')</li>');
    if (c.marker) li.push('<li><svg class="cu-sw" viewBox="0 0 30 12" aria-hidden="true"><circle cx="15" cy="6" r="5.5" fill="none" stroke="var(--fg)" stroke-width="1.5"/><circle cx="15" cy="6" r="3" fill="var(--fg)"/></svg>Marker: ' + esc(c.marker.label || withUnit(c.marker.x, c.xUnit) + ' / ' + withUnit(c.marker.y, c.yUnit)) + '</li>');
    if (show.ghost && ghost) li.push('<li>' + swatch(0, 'gh') + 'Geisterlinie: Referenz (Vorher)</li>');
    return '<ul class="cu-leg" aria-label="Legende">' + li.join('') + '</ul>';
  }
  function tableHtml(c, ghost) {
    const rows = tableRows(c, ghost, 24);
    return '<details class="card" id="cuTab"' + (st.table ? ' open' : '') + '><summary>Wertetabelle (Alternative zum Bild)</summary><div class="cb"><table class="kt"><tr><th class="n">' + esc(c.xLabel + (c.xUnit ? ' [' + c.xUnit + ']' : '')) + '</th>' + c.series.map(s => '<th class="n">' + esc(s.name + (c.yUnit ? ' [' + c.yUnit + ']' : '')) + '</th>').join('') + '</tr>' +
      rows.map(r => '<tr><td class="n">' + fv(r.x) + '</td>' + r.ys.map(y => '<td class="n">' + (y == null ? '–' : fv(y)) + '</td>').join('') + '</tr>').join('') + '</table></div></details>';
  }
  /* ============================================================ Zeit-Strom-Diagramm (B-els-06): Zonenflächen, ziehbarer Punkt, 30-mA-RCD-Linie.
     Alle Werte stammen aus ELS_CORE (body.zoneCurve, body.zone, rcd.trip); hier stehen nur Abbildung (log-log) und Beschriftung. */
  const ZD = { i0: 0.1, i1: 1000, t0: 10, t1: 10000 }, zd = { pt: null, rigId: null, drag: false, g: null };
  const ZCSS = '.zd-wrap{position:relative}.zd-svg{display:block;width:100%;height:auto;border-radius:8px;outline:none;touch-action:none;cursor:crosshair}.zd-svg:focus-visible{outline:2px solid var(--accent)}.zd-say{margin:8px 0 0;font-size:14px;line-height:1.45}.zd-leg{display:flex;flex-wrap:wrap;gap:6px 14px;margin:8px 0 0;padding:0;list-style:none;font-size:14px}.zd-leg li{display:flex;align-items:center;gap:6px}.zd-leg i{display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid var(--line)}';
  const zdCore = () => (root.ELS_CORE && root.ELS_CORE.body && root.ELS_CORE.rcd ? root.ELS_CORE : null);
  const ZD_RCD = { idn: 30, type: 'A', on: true };
  function zdGeom(w) {
    const h = Math.max(300, Math.round(w * 0.72)), m = { l: 52, r: 14, t: 12, b: 44 }, lx = Math.log10(ZD.i1 / ZD.i0), ly = Math.log10(ZD.t1 / ZD.t0), pw = w - m.l - m.r, ph = h - m.t - m.b;
    return { w, h, m, pw, ph, X: i => m.l + Math.log10(i / ZD.i0) / lx * pw, Y: t => m.t + ph - Math.log10(t / ZD.t0) / ly * ph, iAt: x => ZD.i0 * Math.pow(10, Math.min(1, Math.max(0, (x - m.l) / pw)) * lx), tAt: y => ZD.t0 * Math.pow(10, Math.min(1, Math.max(0, (m.t + ph - y) / ph)) * ly) };
  }
  function zdFromRig() {
    const C = zdCore(); if (!C || !A || !A.rig || typeof A.rig.getControl !== 'function') return null;
    try { const g = k => A.rig.getControl(k), tMs = g('t'), tc = C.body.touch({ U: g('u'), haut: g('haut'), pfad: g('weg'), rv: g('rv'), tMs }); if (tc && tc.ok && tc.iK > 0 && tMs > 0) return { i: tc.iK * 1000, t: tMs }; } catch (e) {}
    return null;
  }
  function zdTrip(i) { const C = zdCore(); try { return C.rcd.trip(ZD_RCD, 'sinus', i); } catch (e) { return null; } }
  function zdSay(p) {
    const C = zdCore(); if (!C) return 'Das Zonenmodell ist nicht geladen.';
    let z; try { z = C.body.zone(p.i / 1000, p.t); } catch (e) { z = null; } if (!z || !z.ok) return 'Für diesen Punkt gibt es keine Zone.';
    const tr = zdTrip(p.i); let s = 'Bei ' + fv(p.i) + ' mA und ' + fv(p.t) + ' ms: ' + z.text;
    if (tr && tr.tripped) { let z2 = null; try { z2 = C.body.zone(p.i / 1000, tr.tTrip * 1000); } catch (e) {} s += ' Ein 30-mA-RCD löst bei diesem Strom nach höchstens ' + fv(tr.tTrip * 1000) + ' ms aus' + (z2 && z2.ok ? '. Mit der kürzeren Zeit liegt der Punkt in Zone ' + z2.zone + '.' : '.'); }
    else if (tr && tr.possible) s += ' Ein 30-mA-RCD kann hier auslösen, sicher ist es nicht.';
    else s += ' Ein 30-mA-RCD löst bei diesem Strom nicht aus.';
    return s;
  }
  function zdSvg(w) {
    const C = zdCore(); if (!C) return '';
    const g = zd.g = zdGeom(w), m = g.m, N = 48, ts = [];
    for (let k = 0; k <= N; k++) ts.push(ZD.t0 * Math.pow(ZD.t1 / ZD.t0, k / N));
    let zc; try { zc = C.body.zoneCurve(ts); } catch (e) { zc = null; } if (!Array.isArray(zc) || !zc.length || !zc[0].ok) return '';
    const cl = v => Math.min(ZD.i1, Math.max(ZD.i0, v)), yBot = g.Y(ZD.t0), yTop = g.Y(ZD.t1), xL = g.X(ZD.i0), xR = g.X(ZD.i1);
    const z1 = zc[0].z1 * 1000, z2 = zc[0].z2 * 1000, curve = zc.map(q => [g.X(cl(q.flimmer * 1000)), g.Y(q.t)]);
    const P = a => a.map((q, k) => (k ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    let s = '<rect x="' + m.l + '" y="' + m.t + '" width="' + g.pw + '" height="' + g.ph + '" fill="var(--bg)"/>';
    s += '<rect x="' + xL + '" y="' + yTop + '" width="' + (g.X(z1) - xL) + '" height="' + (yBot - yTop) + '" fill="var(--ok)" opacity=".28"/>';
    s += '<rect x="' + g.X(z1) + '" y="' + yTop + '" width="' + (g.X(z2) - g.X(z1)) + '" height="' + (yBot - yTop) + '" fill="var(--accent)" opacity=".26"/>';
    s += '<path d="' + P([[g.X(z2), yBot]].concat(curve, [[g.X(z2), yTop]])) + 'Z" fill="var(--warn)" opacity=".30"/>';
    s += '<path d="' + P(curve.concat([[xR, yTop], [xR, yBot]])) + 'Z" fill="var(--danger)" opacity=".30"/>';
    [0.1, 1, 10, 100, 1000].forEach(v => { const x = g.X(v); s += '<line x1="' + x + '" x2="' + x + '" y1="' + yTop + '" y2="' + yBot + '" stroke="var(--line)" stroke-width="1"/><text x="' + x + '" y="' + (yBot + 18) + '" text-anchor="middle" font-size="12" fill="var(--mute)">' + fv(v) + '</text>'; });
    [10, 100, 1000, 10000].forEach(v => { const y = g.Y(v); s += '<line x1="' + xL + '" x2="' + xR + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/><text x="' + (xL - 6) + '" y="' + (y + 4) + '" text-anchor="end" font-size="12" fill="var(--mute)">' + fv(v) + '</text>'; });
    s += '<text x="' + (m.l + g.pw / 2) + '" y="' + (g.h - 6) + '" text-anchor="middle" font-size="12" fill="var(--fg)">Körperstrom in mA</text><text transform="translate(13 ' + (m.t + g.ph / 2) + ') rotate(-90)" text-anchor="middle" font-size="12" fill="var(--fg)">Einwirkdauer in ms</text>';
    s += '<path d="' + P(curve) + '" fill="none" stroke="var(--danger)" stroke-width="2"/>';
    /* RCD-Linie: nur dort, wo rcd.trip sicher auslöst; die Zeit kommt aus rcd.trip */
    const fi = []; for (let k = 0; k <= 60; k++) { const i = 10 * Math.pow(ZD.i1 / 10, k / 60), tr = zdTrip(i); if (tr && tr.tripped && tr.tTrip > 0) fi.push([g.X(i), g.Y(Math.min(ZD.t1, Math.max(ZD.t0, tr.tTrip * 1000)))]); }
    if (fi.length > 1) s += '<path d="' + P(fi) + '" fill="none" stroke="var(--fg)" stroke-width="3" stroke-dasharray="7 4"/><text x="' + (xR - 4) + '" y="' + (fi[fi.length - 1][1] - 6) + '" text-anchor="end" font-size="12" fill="var(--fg)">30-mA-RCD löst aus</text>';
    [[Math.sqrt(0.1 * z1), 'Z1', 2500], [Math.sqrt(z1 * z2), 'Z2', 2500], [Math.sqrt(z2 * 40), 'Z3', 4000], [547, 'Z4', 3000]].forEach(q => { s += '<text x="' + g.X(q[0]) + '" y="' + g.Y(q[2]) + '" text-anchor="middle" font-size="13" font-weight="700" fill="var(--fg)">' + q[1] + '</text>'; });
    return s + '<g id="zdPt"></g>';
  }
  function zdPoint() {
    if (typeof document === 'undefined') return;
    const g = zd.g, p = zd.pt, el = document.getElementById('zdPt'); if (!g || !p || !el) return;
    const x = g.X(Math.min(ZD.i1, Math.max(ZD.i0, p.i))), y = g.Y(Math.min(ZD.t1, Math.max(ZD.t0, p.t)));
    el.innerHTML = '<line x1="' + x + '" x2="' + x + '" y1="' + y + '" y2="' + (g.h - g.m.b) + '" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3"/><line x1="' + g.m.l + '" x2="' + x + '" y1="' + y + '" y2="' + y + '" stroke="var(--fg)" stroke-width="1" stroke-dasharray="3 3"/><circle cx="' + x + '" cy="' + y + '" r="22" fill="transparent"/><circle cx="' + x + '" cy="' + y + '" r="9" fill="var(--bg)" stroke="var(--fg)" stroke-width="3"/>';
    const txt = zdSay(p), rd = document.getElementById('zdRead'); if (rd) rd.textContent = txt;
    const sv = document.getElementById('zdSvg'); if (sv) sv.setAttribute('aria-valuetext', txt);
  }
  function zdCard(w) {
    if (!zdCore()) return '';
    const svg = zdSvg(w); if (!svg) return '';
    const rid = A && A.rig && A.rig.id; if (!zd.pt || zd.rigId !== rid) { zd.rigId = rid; zd.pt = zdFromRig() || { i: 30, t: 300 }; }
    return '<div class="card pl" id="zdCard"><h4>Zeit-Strom-Diagramm: Zonen und 30-mA-RCD</h4><p class="hint2" style="margin:0 0 6px">Ziehe den Punkt: Er zeigt, in welcher Zone Strom und Einwirkdauer liegen. Mit den Pfeiltasten geht es auch.</p>' +
      '<div class="zd-wrap"><svg class="zd-svg" id="zdSvg" viewBox="0 0 ' + w + ' ' + zd.g.h + '" role="slider" tabindex="0" aria-label="Punkt im Zeit-Strom-Diagramm. Pfeil links und rechts ändern den Strom, hoch und runter die Einwirkdauer.">' + svg + '</svg></div>' +
      '<p class="zd-say" id="zdRead" role="status" aria-live="polite"></p>' +
      '<ul class="zd-leg"><li><i style="background:var(--ok);opacity:.55"></i>Zone 1</li><li><i style="background:var(--accent);opacity:.55"></i>Zone 2</li><li><i style="background:var(--warn);opacity:.6"></i>Zone 3</li><li><i style="background:var(--danger);opacity:.6"></i>Zone 4</li><li>gestrichelt: Auslösung 30-mA-RCD</li></ul>' +
      '<div class="btns"><button class="btn" data-act="zdrig">Punkt vom Prüfstand holen</button></div>' +
      '<p class="hint2">Vereinfachtes Lehrmodell mit Übungswerten, nicht das Originaldiagramm der IEC 60479-1.</p></div>';
  }
  function zdSet(i, t) { zd.pt = { i: Math.min(ZD.i1, Math.max(ZD.i0, i)), t: Math.min(ZD.t1, Math.max(ZD.t0, t)) }; zdPoint(); }
  function zdPtr(e) { const sv = document.getElementById('zdSvg'); if (!sv || !zd.g) return; const r = sv.getBoundingClientRect(); if (!(r.width > 0)) return; const k = zd.g.w / r.width; zdSet(zd.g.iAt((e.clientX - r.left) * k), zd.g.tAt((e.clientY - r.top) * k)); }
  function html() {
    const rig = A && A.rig;
    if (!rig) return '<div class="card pl"><p class="big">Kein Prüfstand</p><p class="hint2">Wähle im Tab Prüfstand eine Anlage, dann zeigt dieser Tab ihre Kennlinien.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    const cs = rigCurves();
    if (!cs.length) return '<div class="card pl"><p class="big">Keine Kennlinie</p><p class="hint2">Dieser Prüfstand hat keine Kennlinie. Die Ampel und die Meldungen im Tab Prüfstand zeigen das Ergebnis.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    if (st.rigId !== rig.id) { st.rigId = rig.id; st.id = null; st.x = null; }
    const c = cs.find(q => q.id === st.id) || cs[0]; st.id = c.id;
    const ghost = A.S && A.S.ref && A.S.refRig ? ghostOf(A.S.refRig, c.id) : null, show = { ghost: st.ghost };
    const hw = H && H.clientWidth ? H.clientWidth : 0; if (st.hw !== hw) { st.hw = hw; st.wFix = 0; }
    const wEl = st.wFix || (hw ? hw - 26 : 640), g = geom(c, ghost, wEl);
    st.c = c; st.gh = ghost; st.g = g; st.w = wEl;
    const hasRef = !!(A.S && A.S.ref), note = markerNote(c);
    return '<div class="card pl"><h4>Kennlinien: ' + esc(typeof A.rigName === 'function' ? A.rigName(rig.id) : rig.id) + '</h4>' +
      (cs.length > 1 ? '<div class="cu-tabs" role="tablist" aria-label="Kennlinie wählen">' + cs.map(q => '<button class="chip' + (q.id === c.id ? ' on' : '') + '" role="tab" aria-selected="' + (q.id === c.id) + '" data-cv="' + esc(q.id) + '">' + esc(cut(q.title, 44)) + '</button>').join('') + '</div>' : '') +
      '<p class="hint2" style="margin:0 0 6px"><b>' + esc(c.title) + '</b></p>' +
      '<div class="cu-wrap"><svg class="cu-svg" id="cuSvg" viewBox="0 0 ' + g.w + ' ' + g.h + '" role="img" tabindex="0" aria-label="' + esc(c.title + '. ' + (c.marker ? 'Marker: ' + (c.marker.label || '') + '. ' : '') + note + ' Mit den Pfeiltasten wanderst du über die Kurve.') + '">' + chartSvg(c, ghost, g, show) + '</svg></div>' +
      '<div class="cu-read" id="cuRead" role="status" aria-live="polite">' + (fin(st.x) ? esc(readout(c, show.ghost ? ghost : null, st.x).text) : 'Tippe oder fahre über das Bild für das Fadenkreuz (Pfeiltasten gehen auch).') + '</div>' +
      legend(c, ghost, show) + (note ? '<div class="ex" style="margin-top:8px">' + esc(note) + '</div>' : '') +
      '<div class="btns"><button class="btn" data-act="csv">Alle Kennlinien als CSV</button>' + (hasRef ? '<button class="btn" data-act="ghost" aria-pressed="' + st.ghost + '">' + (st.ghost ? 'Geisterlinie ausblenden' : 'Geisterlinie einblenden') + '</button>' : '') + '<button class="btn" data-act="table" aria-pressed="' + st.table + '">' + (st.table ? 'Tabelle schließen' : 'Wertetabelle zeigen') + '</button></div>' +
      (hasRef ? '' : '<p class="hint2">Mit „Merken“ (Taste M) im Prüfstand legst du eine Referenz fest; sie erscheint hier als Geisterlinie.</p>') +
      '<p class="hint2">' + esc(NOTE) + '</p></div>' + (rig.id === 'koerper' ? zdCard(wEl) : '') + tableHtml(c, ghost);
  }
  function paint(again) {
    if (!H) return; css(); H.innerHTML = html(); H.dataset.cu = '1';
    /* tatsächliche Bildbreite messen: gleicht die Ränder der Karte aus, damit die Schrift in echter Größe steht */
    const sv = H.querySelector('#cuSvg'), bw = sv && typeof sv.getBoundingClientRect === 'function' ? sv.getBoundingClientRect().width : 0;
    if (!again && st.g && bw > 120 && Math.abs(bw - st.g.w) > 3) { st.wFix = Math.round(bw); paint(true); return; }
    if (fin(st.x) && st.c) drawCross(); zdPoint();
  }
  function drawCross() {
    const xh = H.querySelector('#cuXh'), rd = H.querySelector('#cuRead'); if (!st.c || !st.g) return;
    const gh = st.ghost ? st.gh : null;
    if (xh) xh.innerHTML = crossSvg(st.c, gh, st.g, st.x);
    if (rd) rd.textContent = fin(st.x) ? readout(st.c, gh, st.x).text : 'Tippe oder fahre über das Bild für das Fadenkreuz (Pfeiltasten gehen auch).';
  }
  function setX(x) { st.x = fin(x) ? x : null; drawCross(); }
  function pointerX(e) {
    const svg = H.querySelector('#cuSvg'); if (!svg || !st.g) return null;
    const r = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null; if (!r || !(r.width > 0)) return null;
    return st.g.xAt((e.clientX - r.left) * (st.g.w / r.width));
  }
  function saveCsv(txt) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'els-kennlinien.csv'); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'els-kennlinien.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
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
    if (a === 'csv') exportCsv(); else if (a === 'ghost') { st.ghost = !st.ghost; paint(); } else if (a === 'table') { st.table = !st.table; paint(); } else if (a === 'rig' && A) A.setTab('rig'); else if (a === 'zdrig') { const p = zdFromRig(); if (p) zdSet(p.i, p.t); }
  }
  function onKey(e) {
    if (!st.g || !st.c || !e.target || !e.target.closest || !e.target.closest('#cuSvg')) return;
    const k = e.key, g = st.g; if (k === 'Escape') { setX(null); return; }
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    if (e.preventDefault) e.preventDefault();
    const cur = fin(st.x) ? g.X(st.x) : (k === 'ArrowLeft' ? g.L + g.pw : g.L);
    setX(k === 'Home' ? g.xAt(g.L) : k === 'End' ? g.xAt(g.L + g.pw) : g.xAt(cur + (k === 'ArrowRight' ? 1 : -1) * Math.max(4, g.pw / 40)));
  }
  function render(host, api) {
    A = api; H = host;
    once(host, 'c', 'click', onClick); once(host, 'm', 'pointermove', e => { if (e.target && e.target.closest && e.target.closest('#cuSvg') && (e.pointerType !== 'touch')) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'd', 'pointerdown', e => { if (e.target && e.target.closest && e.target.closest('#cuSvg')) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'k', 'keydown', onKey);
    once(host, 'zdd', 'pointerdown', e => { if (e.target && e.target.closest && e.target.closest('#zdSvg')) { zd.drag = true; try { e.target.closest('#zdSvg').setPointerCapture(e.pointerId); } catch (x) {} zdPtr(e); e.preventDefault(); } });
    once(host, 'zdm', 'pointermove', e => { if (zd.drag) zdPtr(e); });
    once(host, 'zdu', 'pointerup', () => { zd.drag = false; }); once(host, 'zdc', 'pointercancel', () => { zd.drag = false; });
    once(host, 'zdk', 'keydown', e => { if (!e.target || !e.target.closest || !e.target.closest('#zdSvg') || !zd.pt) return; const f = 1.12, d = { ArrowLeft: [1 / f, 1], ArrowRight: [f, 1], ArrowUp: [1, f], ArrowDown: [1, 1 / f] }[e.key]; if (d) { e.preventDefault(); zdSet(zd.pt.i * d[0], zd.pt.t * d[1]); } });
    if (typeof ResizeObserver === 'function' && !host.__elscuRo) { host.__elscuRo = new ResizeObserver(() => redraw()); try { host.__elscuRo.observe(host); } catch (e) {} }
    paint();
  }
  function redraw() { if (!H || !A || !H.clientWidth) return; if (Math.abs(H.clientWidth - st.hw) > 6 || !H.dataset.cu) paint(); }
  function refresh() { paint(); }

  E.curve = { render, refresh, redraw, fn: { fv, clean, cleanAll, bandOf, niceRange, ticks, bounds, pos, unpos, interp, readout, markerNote, geom, ghostOf, toCsv, fromCsv, tableRows, chartSvg, crossSvg, legend, html, state: st, NOTE, setApi: a => { A = a; } } };
})(typeof window !== 'undefined' ? window : globalThis);
