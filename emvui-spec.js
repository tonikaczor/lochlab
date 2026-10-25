'use strict';
/* Tonfunk EMV-Lab: Tab "Spektrum" (WP3b), Analysator-Ansicht des gewählten Prüfstands.
   Quelle der Daten ist IMMER der Prüfstand: rig.spectrum() (Linien, Einhüllende, Grenzlinien, Eigenrauschen), sonst die erste Kurve aus rig.curves(); Zeitverlauf aus rig.waveform().
   Das Bild zeichnet diese Datei selbst (Bedienung wie ein Analysator: Zoom, Verschieben, Marker brauchen die Geometrie der Zeichenfläche, siehe ABWEICHUNGEN.md WP3b).
   Zahlen (Pegel, Marge, Frequenz) stammen aus den Daten des Prüfstands; die Marge ist Grenzwert minus Pegel an der Frequenz, der Grenzwert kommt aus rig.spectrum().limits (Stützpunkte).
   Bedienung: Start- und Stoppfrequenz (Schnellwahl 150 kHz bis 30 MHz, 30 bis 1000 MHz, alles; Zwei-Finger-Zoom, Mausrad, Ziehen), RBW (Anzeige), Detektor (nur Spitzenwert, Text),
   Referenzpegel, Spitzenwert halten (Taste P), Marker (Berühren, Pfeiltasten, "Marker auf Spitze"), Einhüllende, Grenzlinien, Gleichtakt/Gegentakt, Geisterlinie der Referenz (Vorher), Tabelle der fünf höchsten Linien.
   Schnittstelle (SPEC 8.8): window.EMV_UI_EXT.spec = { render(host, api), refresh(), redraw(), fn } mit api = { S, rig, setTab, loadExample, startTask, toast, esc, stat, lsGet, lsSet, EMV_CORE, EMV_DRAW, snapshot, setRef, quality, ... }.
   Die reinen Funktionen (ohne DOM) hängen unter EMV_UI_EXT.spec.fn und werden von test_emvui_ext.js geprüft. EMV_UI_EXT.util enthält Zeichenhelfer, die emvui-lay.js mitbenutzt. */
(function (root) {
  const E = root.EMV_UI_EXT = root.EMV_UI_EXT || {};
  const U = E.util = E.util || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn) => { host.__emvl = host.__emvl || {}; if (host.__emvl[name + ty]) return; host.__emvl[name + ty] = 1; host.addEventListener(ty, fn); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function fe(x, unit) {
    const C = root.EMV_CORE; if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) {} }
    if (!fin(x)) return '–'; if (x === 0) return '0 ' + (unit || ''); const a = Math.abs(x), p = PRE.find(q => a >= q[0] * 0.9995) || PRE[PRE.length - 1], v = x / p[0];
    return String(+v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)).replace('.', ',') + ' ' + p[1] + (unit || '');
  }
  U.esc = esc; U.fin = fin; U.clamp = clamp; U.fnum = fnum; U.fe = fe;

  /* ============================================================ Zeichenhelfer (auch für emvui-lay.js) */
  U.injectCss = function (id, css) { if (typeof document === 'undefined' || document.getElementById(id)) return; const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s); };
  /* Farben aus den Seitenvariablen (Hell und Dunkel), mit Rückfall */
  let palT = 0, palV = null;
  U.pal = function () {
    const now = typeof performance !== 'undefined' ? performance.now() : 0; if (palV && now - palT < 800) return palV; palT = now;
    const dflt = { bg: '#10151a', panel: '#222830', fg: '#e8ecf0', mute: '#8d99a6', line: '#38424d', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', acc: '#3b9eff', grid: '#26303a', src: '#ff8a5c', mass: '#3fd7c0', e: '#b58cff', h: '#ffc64d' };
    if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return (palV = dflt);
    const cs = getComputedStyle(document.documentElement), g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
    palV = { bg: g('--well', dflt.bg), panel: g('--panel', dflt.panel), fg: g('--fg', dflt.fg), mute: g('--mute', dflt.mute), line: g('--line', dflt.line), ok: g('--ok', dflt.ok), warn: g('--warn', dflt.warn), bad: g('--danger', dflt.bad), acc: g('--accent', dflt.acc), grid: g('--chart-grid', dflt.grid), src: g('--lv-quelle', dflt.src), mass: '#3fd7c0', e: '#b58cff', h: '#ffc64d' };
    return palV;
  };
  U.niceStep = (range, n) => { const raw = range / Math.max(1, n), mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; };
  U.linTicks = function (a, b, n) { const st = U.niceStep(b - a, n || 5), out = []; for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-6; v += st) out.push(+v.toPrecision(10)); return out; };
  U.logTicks = function (a, b) { const out = []; if (!(a > 0 && b > a)) return out; const d0 = Math.floor(Math.log10(a)), d1 = Math.ceil(Math.log10(b)); for (let d = d0; d <= d1; d++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, d); if (v >= a * 0.9999 && v <= b * 1.0001) out.push(v); }); return out; };
  /* Platte hinter Text (nie Text ohne Hintergrund über Linien) */
  U.label = function (g, txt, x, y, o) {
    o = o || {}; const P = U.pal(), sz = o.size || 12; g.font = (o.bold ? '700 ' : '') + sz + 'px system-ui'; g.textAlign = o.align || 'left'; g.textBaseline = 'middle';
    const w = g.measureText(txt).width + 8, h = sz + 6; let x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    if (o.W) x0 = clamp(x0, 1, o.W - w - 1); const tx = o.align === 'right' ? x0 + w - 4 : o.align === 'center' ? x0 + w / 2 : x0 + 4;
    if (o.bg !== false) { g.fillStyle = o.bgc || P.panel; g.globalAlpha = 0.88; g.fillRect(x0, y - h / 2, w, h); g.globalAlpha = 1; }
    g.fillStyle = o.color || P.fg; g.fillText(txt, tx, y); return w;
  };
  /* Linien- und Kurvendiagramm: cfg = { xMin, xMax, xLog, yMin, yMax, series:[{name, pts:[[x,y]], color, dash, width}], vlines:[{x, text}], hlines:[{y, text, dash, color}], xLabel, yLabel, xTick(v) → Text, marker:{x,y}, band? } → Geometrie { X(x), Y(y), px0, py0, pw, ph } */
  U.lineChart = function (g, W, H, cfg) {
    if (!g || !(W >= 120) || !(H >= 80) || !cfg || ![cfg.xMin, cfg.xMax, cfg.yMin, cfg.yMax].every(fin) || !(cfg.xMax > cfg.xMin) || !(cfg.yMax > cfg.yMin)) return null;
    if (cfg.xLog && !(cfg.xMin > 0)) return null;
    const P = U.pal(), narrow = W < 460, fs = narrow ? 11 : 12, m = { l: narrow ? 44 : 54, r: 12, t: 12, b: cfg.xLabel ? 40 : 26 };
    const px0 = m.l, py0 = m.t, pw = W - m.l - m.r, ph = H - m.t - m.b; if (pw < 40 || ph < 30) return null;
    const lx = cfg.xLog ? Math.log10(cfg.xMin) : cfg.xMin, hx = cfg.xLog ? Math.log10(cfg.xMax) : cfg.xMax;
    const X = x => px0 + ((cfg.xLog ? Math.log10(Math.max(x, 1e-300)) : x) - lx) / (hx - lx) * pw, Y = y => py0 + (1 - (y - cfg.yMin) / (cfg.yMax - cfg.yMin)) * ph;
    g.save(); g.fillStyle = P.bg; g.fillRect(0, 0, W, H); g.font = fs + 'px system-ui'; g.textBaseline = 'middle';
    const yt = U.linTicks(cfg.yMin, cfg.yMax, Math.max(3, Math.floor(ph / 38)));
    g.lineWidth = 1; g.strokeStyle = P.grid; g.fillStyle = P.mute; g.textAlign = 'right';
    yt.forEach(v => { const y = Math.round(Y(v)) + 0.5; g.beginPath(); g.moveTo(px0, y); g.lineTo(px0 + pw, y); g.stroke(); g.fillText(String(+v.toFixed(2)).replace('.', ','), px0 - 5, y); });
    const xt = cfg.xLog ? U.logTicks(cfg.xMin, cfg.xMax) : U.linTicks(cfg.xMin, cfg.xMax, Math.max(3, Math.floor(pw / 80)));
    g.textAlign = 'center'; let lastR = -1e9;
    xt.forEach(v => { const x = Math.round(X(v)) + 0.5; g.strokeStyle = P.grid; g.beginPath(); g.moveTo(x, py0); g.lineTo(x, py0 + ph); g.stroke(); const t = cfg.xTick ? cfg.xTick(v) : String(+v.toPrecision(4)).replace('.', ','), w = g.measureText(t).width; if (x - w / 2 > lastR + 4 && x - w / 2 > 0 && x + w / 2 < W) { g.fillStyle = P.mute; g.fillText(t, x, py0 + ph + 12); lastR = x + w / 2; } });
    g.strokeStyle = P.line; g.strokeRect(px0 + 0.5, py0 + 0.5, pw, ph);
    g.save(); g.beginPath(); g.rect(px0, py0, pw, ph); g.clip();
    (cfg.band ? [cfg.band] : []).forEach(b => { g.fillStyle = b.color || P.warn; g.globalAlpha = 0.14; g.fillRect(px0, Y(b.y1), pw, Y(b.y0) - Y(b.y1)); g.globalAlpha = 1; });
    (cfg.vlines || []).forEach(v => { if (!fin(v.x)) return; const x = Math.round(X(v.x)) + 0.5; g.strokeStyle = v.color || P.mute; g.setLineDash(v.dash || [3, 4]); g.beginPath(); g.moveTo(x, py0); g.lineTo(x, py0 + ph); g.stroke(); g.setLineDash([]); });
    (cfg.hlines || []).forEach(h => { if (!fin(h.y)) return; const y = Math.round(Y(h.y)) + 0.5; g.strokeStyle = h.color || P.fg; g.lineWidth = 1.6; g.setLineDash(h.dash || [8, 4]); g.beginPath(); g.moveTo(px0, y); g.lineTo(px0 + pw, y); g.stroke(); g.setLineDash([]); g.lineWidth = 1; });
    (cfg.series || []).forEach((s, i) => {
      const pts = (s.pts || []).filter(p => p && fin(p[0]) && fin(p[1]) && (!cfg.xLog || p[0] > 0)); if (pts.length < 2) return;
      g.strokeStyle = s.color || P.acc; g.lineWidth = s.width || 2; g.setLineDash(s.dash || []); g.globalAlpha = s.alpha == null ? 1 : s.alpha; g.beginPath();
      pts.forEach((p, k) => { const x = X(p[0]), y = clamp(Y(p[1]), py0 - 4000, py0 + ph + 4000); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
    });
    g.restore();
    (cfg.vlines || []).forEach(v => { if (v.text && fin(v.x) && X(v.x) > px0 && X(v.x) < px0 + pw) U.label(g, v.text, X(v.x) + 3, py0 + 10 + (v.row || 0) * 16, { size: fs, W }); });
    (cfg.hlines || []).forEach(h => { if (h.text && fin(h.y) && Y(h.y) > py0 && Y(h.y) < py0 + ph) U.label(g, h.text, px0 + pw - 2, Y(h.y) - 9, { size: fs, align: 'right', W }); });
    if (cfg.marker && fin(cfg.marker.x) && fin(cfg.marker.y)) { const mx = X(cfg.marker.x), my = Y(cfg.marker.y); if (mx >= px0 && mx <= px0 + pw) { g.fillStyle = P.warn; g.strokeStyle = P.bg; g.lineWidth = 2; g.beginPath(); g.arc(mx, clamp(my, py0, py0 + ph), 5, 0, 7); g.fill(); g.stroke(); } }
    g.fillStyle = P.mute; g.font = fs + 'px system-ui'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    if (cfg.xLabel) g.fillText(cfg.xLabel, px0 + pw / 2, H - 4);
    if (cfg.yLabel) { g.save(); g.translate(11, py0 + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(cfg.yLabel, 0, 0); g.restore(); }
    g.restore();
    return { X, Y, px0, py0, pw, ph, inv: px => { const t = lx + (px - px0) / pw * (hx - lx); return cfg.xLog ? Math.pow(10, t) : t; } };
  };

  /* ============================================================ reine Funktionen (ohne DOM) */
  const BANDS = { cispr: { id: 'cispr', label: '150 kHz – 30 MHz', f0: 150e3, f1: 30e6 }, funk: { id: 'funk', label: '30 – 1000 MHz', f0: 30e6, f1: 1e9 }, alles: { id: 'alles', label: 'Alles', f0: null, f1: null } };
  /* Auflösebandbreite: Übungswerte (A) 9 kHz leitungsgebunden (unter 30 MHz), 120 kHz darüber; Anzeige, kein Rechenwert */
  const RBW = { low: 9e3, high: 120e3, split: 30e6 };
  function rbwFor(f0, f1) {
    if (!fin(f0) || !fin(f1)) return { rbw: NaN, text: '–' };
    if (f1 <= RBW.split) return { rbw: RBW.low, text: fe(RBW.low, 'Hz') };
    if (f0 >= RBW.split) return { rbw: RBW.high, text: fe(RBW.high, 'Hz') };
    return { rbw: RBW.low, text: fe(RBW.low, 'Hz') + ' bis 30 MHz, darüber ' + fe(RBW.high, 'Hz') };
  }
  /* Spur des Modes (sum = Summe, gt = Gleichtakt, gg = Gegentakt): Arrays f und L; fehlt das Feld, fällt der Mode auf die Summe zurück */
  function traceOf(sp, mode) {
    const lines = sp && Array.isArray(sp.lines) ? sp.lines.filter(l => l && fin(l.f) && l.f > 0 && fin(l.L)) : [];
    const key = mode === 'gt' && lines.every(l => fin(l.Lcm)) && lines.length ? 'Lcm' : mode === 'gg' && lines.every(l => fin(l.Ldm)) && lines.length ? 'Ldm' : 'L';
    return { key, f: lines.map(l => l.f), L: lines.map(l => l[key]), n: lines.length };
  }
  const hasModes = sp => !!(sp && Array.isArray(sp.lines) && sp.lines.length && sp.lines.every(l => fin(l.Lcm) && fin(l.Ldm)));
  /* Wert einer Grenzlinie (Stützpunkte [[f, Pegel]…], linear über lg f, Stufen als zwei Punkte gleicher Frequenz); null außerhalb */
  function interp(pts, f) {
    if (!Array.isArray(pts) || pts.length < 2 || !(f > 0)) return null; const p = pts.filter(q => Array.isArray(q) && fin(q[0]) && fin(q[1]));
    if (p.length < 2 || f < p[0][0] * (1 - 1e-9) || f > p[p.length - 1][0] * (1 + 1e-9)) return null;
    let res = null;
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1]; if (f < a[0] * (1 - 1e-9) || f > b[0] * (1 + 1e-9)) continue;
      const v = b[0] === a[0] ? Math.min(a[1], b[1]) : a[1] + (b[1] - a[1]) * (Math.log10(f / a[0]) / Math.log10(b[0] / a[0]));
      res = res == null ? v : Math.min(res, v);
    }
    return res;
  }
  /* strengste Grenzlinie an der Frequenz: { value, name } oder null (kein Grenzwert definiert: kein "bestanden") */
  function limitAt(limits, f) {
    let best = null; (limits || []).forEach(l => { const v = interp(l && l.pts, f); if (v != null && (best == null || v < best.value)) best = { value: v, name: l.name || l.id || '' }; }); return best;
  }
  const marginAt = (limits, f, L) => { const l = limitAt(limits, f); return l && fin(L) ? { margin: l.value - L, limit: l.value, name: l.name } : null; };
  const rate = m => (!fin(m) ? 'grau' : m >= 6 ? 'gruen' : m >= 0 ? 'gelb' : 'rot');
  /* die n höchsten Linien (Frequenz, Pegel, Marge, Maßnahmenvorschlag aus den Meldungen des Prüfstands) */
  function topLines(sp, n, mode, diag, lever) {
    const tr = traceOf(sp, mode), idx = tr.f.map((_, i) => i).sort((a, b) => tr.L[b] - tr.L[a] || tr.f[a] - tr.f[b]).slice(0, n == null ? 5 : n);
    const warn = (diag || []).filter(d => d && (d.kind === 'warn' || d.kind === 'error') && d.text);
    return idx.map(i => {
      const m = marginAt(sp.limits, tr.f[i], tr.L[i]), mg = m ? m.margin : null, k = rate(mg);
      const hint = k === 'gruen' ? 'Keine Maßnahme nötig: Die Marge ist mindestens 6 dB.' : k === 'grau' ? 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert.' : warn.length ? warn[0].text : 'Wähle einen Hebel: ' + ['quelle', 'pfad', 'senke'].map(h => (lever && lever[h]) || h).join(', ') + '.';
      return { f: tr.f[i], L: tr.L[i], margin: mg, ampel: k, hint, i };
    });
  }
  /* Ausschnitt: Zoom um einen Ankerpunkt (logarithmisch) und Verschieben, begrenzt auf die Daten */
  function zoomRange(r, factor, anchor, bounds) {
    const a = Math.log10(r.f0), b = Math.log10(r.f1), c = Math.log10(clamp(anchor, r.f0, r.f1)), k = clamp(factor, 0.05, 20);
    let n0 = c - (c - a) * k, n1 = c + (b - c) * k; const lo = Math.log10(bounds.f0), hi = Math.log10(bounds.f1);
    if (n1 - n0 > hi - lo) { n0 = lo; n1 = hi; } if (n1 - n0 < 0.02) { const mid = (n0 + n1) / 2; n0 = mid - 0.01; n1 = mid + 0.01; }
    if (n0 < lo) { n1 += lo - n0; n0 = lo; } if (n1 > hi) { n0 -= n1 - hi; n1 = hi; } n0 = Math.max(lo, n0);
    return { f0: Math.pow(10, n0), f1: Math.pow(10, n1) };
  }
  function panRange(r, frac, bounds) {
    const a = Math.log10(r.f0), b = Math.log10(r.f1), d = (b - a) * frac, lo = Math.log10(bounds.f0), hi = Math.log10(bounds.f1);
    let n0 = a + d, n1 = b + d; if (n0 < lo) { n1 += lo - n0; n0 = lo; } if (n1 > hi) { n0 -= n1 - hi; n1 = hi; }
    return { f0: Math.pow(10, Math.max(lo, n0)), f1: Math.pow(10, n1) };
  }
  const nearestIdx = (fs, f) => { let best = -1, bd = Infinity; for (let i = 0; i < fs.length; i++) { const d = Math.abs(Math.log(fs[i] / f)); if (d < bd) { bd = d; best = i; } } return best; };
  /* Bereich der Daten (Grenzen für Zoom): aus sp.fMin/fMax, sonst aus den Linien */
  function boundsOf(sp) {
    const tr = traceOf(sp, 'sum'); let f0 = fin(sp && sp.fMin) && sp.fMin > 0 ? sp.fMin : tr.n ? Math.min.apply(null, tr.f) : NaN, f1 = fin(sp && sp.fMax) && sp.fMax > 0 ? sp.fMax : tr.n ? Math.max.apply(null, tr.f) : NaN;
    if (!fin(f0) || !fin(f1) || !(f1 > f0)) { f0 = 9e3; f1 = 1e9; } return { f0, f1 };
  }
  /* Pegelachse: Referenzpegel (oberer Rand) automatisch auf volle 10 dB über dem höchsten Wert in der Anzeige */
  function autoRef(sp, mode, r) {
    const tr = traceOf(sp, mode); let mx = -Infinity; for (let i = 0; i < tr.n; i++) if (tr.f[i] >= r.f0 && tr.f[i] <= r.f1 && tr.L[i] > mx) mx = tr.L[i];
    (sp && sp.limits || []).forEach(l => (l.pts || []).forEach(p => { if (p[0] >= r.f0 && p[0] <= r.f1 && p[1] > mx) mx = p[1]; }));
    return fin(mx) ? Math.ceil((mx + 5) / 10) * 10 : 100;
  }
  const floorCount = (sp, mode) => { const tr = traceOf(sp, mode); const fl = sp && fin(sp.floor) ? sp.floor : -Infinity; let n = 0; for (let i = 0; i < tr.n; i++) if (tr.L[i] < fl) n++; return n; };
  /* Spitzenwert halten: Schatten fällt mit 6 dB/s auf den aktuellen Wert */
  function holdStep(hold, L, dtS) { const out = new Float64Array(L.length); for (let i = 0; i < L.length; i++) { const h = hold && fin(hold[i]) ? hold[i] - 6 * dtS : -Infinity; out[i] = Math.max(L[i], h); } return out; }
  const aria = (name, tb) => 'Spektrum des Prüfstands ' + name + (tb && tb.length ? '. Höchste Linie ' + fe(tb[0].f, 'Hz') + ' mit ' + fnum(tb[0].L, 1) + ' dB' + (tb[0].margin != null ? ', Marge ' + fnum(tb[0].margin, 1) + ' dB' : '') : '');
  E.spec = E.spec || {};
  E.spec.fn = { markerHtml, BANDS, RBW, rbwFor, traceOf, hasModes, interp, limitAt, marginAt, rate, topLines, zoomRange, panRange, nearestIdx, boundsOf, autoRef, floorCount, holdStep, aria, fe, fnum };

  /* ============================================================ Oberfläche */
  const CSS = `.spbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px}.spbar .sp{color:var(--mute);font-size:12.5px;margin-left:4px}.spbar input.spn{width:92px;min-height:40px;padding:5px 8px;text-align:right}
.spwrap{position:relative;width:100%;touch-action:none}.spwrap canvas{display:block;width:100%;height:auto;max-height:62vh;aspect-ratio:16/9;background:var(--well);border:1px solid var(--line);border-radius:10px;touch-action:none;cursor:crosshair}
@media(max-width:600px){.spwrap canvas{aspect-ratio:4/3}}
.spwrap.wv canvas{aspect-ratio:16/5;cursor:default}
.sptab{width:100%;border-collapse:collapse;font-size:13.5px}.sptab th,.sptab td{padding:6px 6px;border-top:1px solid var(--line);text-align:left;vertical-align:top}.sptab th{color:var(--mute);font-size:12px;text-transform:uppercase;letter-spacing:.05em;border-top:0}.sptab td.n,.sptab th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.sptab tr.k-rot td:first-child{border-left:4px solid var(--danger)}.sptab tr.k-gelb td:first-child{border-left:4px solid var(--warn)}.sptab tr.k-gruen td:first-child{border-left:4px solid var(--ok)}.sptab tr.k-grau td:first-child{border-left:4px solid var(--mute)}
.sptab .sy{font-weight:800;margin-right:4px}.sptab tr.k-rot .sy{color:var(--bad-fg)}.sptab tr.k-gelb .sy{color:var(--warn)}.sptab tr.k-gruen .sy{color:var(--ok)}
@media(max-width:600px){.sptab tr{display:grid;grid-template-columns:minmax(0,1fr) 74px 74px}.sptab td:nth-child(4),.sptab th:nth-child(4){grid-column:1/-1}.sptab th:nth-child(4){display:none}.sptab td{border-top:0}.sptab tr+tr{border-top:1px solid var(--line)}}
.sptab tr[data-i]{cursor:pointer}.sptab tr[data-i]:active{background:var(--panel2)}`;
  const SYM = { rot: '✗', gelb: '!', gruen: '✓', grau: '–' }, NAME = { rot: 'rot', gelb: 'gelb', gruen: 'grün', grau: 'kein Grenzwert' };
  const spMode = { sum: 'Summe', gt: 'Gleichtakt', gg: 'Gegentakt' };
  const ST = { rigId: null, band: 'auto', range: null, mode: 'sum', env: true, lim: true, ref: null, span: 80, marker: null, hold: null, holdN: -1, n: 0, ghostKey: '', ghost: null, tween: null, disp: null, spKey: '', sp: null, dirty: true, loop: 0, pointers: new Map(), pan: null };
  function useStat(api, n) { if (!api || !api.stat) return; try { const k = (api.lsGet ? api.lsGet('emv.specn', 0) : 0) || 0; if (api.lsSet) api.lsSet('emv.specn', k + 1); api.stat('emvspec', k + 1, 'max'); } catch (e) {} void n; }

  E.spec.render = function (host, api) {
    if (!host) return; ST.api = api; U.injectCss('emv-spec-css', CSS);
    const rig = api.rig;
    if (!rig) { host.innerHTML = '<div class="card pl"><p class="big">Prüfstand fehlt</p><p class="hint2">Ohne Prüfstand gibt es kein Spektrum. Wähle im Tab „Prüfstand“ eine Anlage.</p></div>'; return; }
    const rid = api.S && api.S.rigId; if (ST.rigId !== rid) { ST.rigId = rid; ST.range = null; ST.band = 'auto'; ST.marker = null; ST.hold = null; ST.ref = null; ST.mode = 'sum'; ST.tween = null; ST.disp = null; ST.spKey = ''; }
    const sp = getSpectrum(api, true), name = api.rigName ? api.rigName(rid) : rid;
    const curv = !sp ? firstCurve(rig) : null;
    if (!sp && !curv) { host.innerHTML = '<div class="card pl"><h4>Spektrum</h4><p class="big">Kein Spektrum</p><p class="hint2">Dieser Prüfstand liefert weder ein Spektrum noch eine Kurve über der Frequenz.</p></div>'; return; }
    const b = sp ? boundsOf(sp) : curveBounds(curv); if (!ST.range) ST.range = { f0: b.f0, f1: b.f1 };
    const modes = sp && hasModes(sp);
    host.innerHTML = `<div class="card pl"><h4>${sp ? 'Spektrumanalysator' : 'Kurve über der Frequenz'} · ${esc(name)}</h4>
      <div class="spbar" role="group" aria-label="Frequenzbereich">${['cispr', 'funk', 'alles'].map(k => `<button class="chip s" data-sb="${k}" aria-pressed="false">${BANDS[k].label}</button>`).join('')}
        <label class="sp">Start <input class="spn" id="spF0" inputmode="decimal" autocomplete="off" aria-label="Startfrequenz"></label><label class="sp">Stopp <input class="spn" id="spF1" inputmode="decimal" autocomplete="off" aria-label="Stoppfrequenz"></label></div>
      ${sp ? `<div class="spbar" role="group" aria-label="Anzeige"><span class="sp" id="spRbw"></span><span class="sp">Detektor: Spitzenwert</span>
        <label class="sp">Referenzpegel <input class="spn" id="spRef" inputmode="decimal" autocomplete="off" aria-label="Referenzpegel in ${esc(sp.unit || 'dBµV')}" style="width:70px"> ${esc(sp.unit || 'dBµV')}</label>
        <button class="chip s" data-sa="refdn" aria-label="Referenzpegel 10 dB tiefer">−10 dB</button><button class="chip s" data-sa="refup" aria-label="Referenzpegel 10 dB höher">+10 dB</button><button class="chip s" data-sa="refauto">Auto</button></div>
      <div class="spbar" role="group" aria-label="Darstellung"><button class="chip s on" data-sa="env" aria-pressed="true">Einhüllende</button><button class="chip s on" data-sa="lim" aria-pressed="true">Grenzlinien</button><button class="chip s" data-sa="peak" aria-pressed="false" title="Taste P">Spitzenwert halten</button><button class="chip s" data-sa="mk">Marker auf Spitze</button>
        ${modes ? `<span class="seg" role="group" aria-label="Gleichtakt und Gegentakt">${['sum', 'gt', 'gg'].map(k => `<button data-sm="${k}">${spMode[k]}</button>`).join('')}</span>` : ''}</div>` : ''}
      <div class="spwrap"><canvas id="spCv" role="img" aria-label="Spektrum"></canvas></div>
      <div class="readout" id="spRead" aria-live="polite"></div>
      <p class="hint2" id="spFloor"></p>
      <div id="spTab"></div>
      ${sp ? `<details class="fm"><summary>Warum nur der Spitzenwert?</summary><div class="fmb"><p class="hint2" style="margin:0">Der Analysator zeigt hier den Spitzenwert. Der Spitzenwert ist immer größer oder gleich dem Quasi-Spitzenwert, und der ist immer größer oder gleich dem Mittelwert. Liegt der Spitzenwert schon unter der Grenzlinie, liegen die anderen Werte erst recht darunter. Liegt er darüber, wird im Labor mit Quasi-Spitzenwert und Mittelwert nachgemessen. Die Linien sind Übungswerte; die Übungsgrenzlinie ist an die Grenzwertklassen der Fachgrundnormen angelehnt (A), Herstellerdokumentation und aktuelle Norm maßgeblich.</p></div></details>` : ''}</div>
      <div class="card pl" id="spWvCard" hidden><h4>Zeitverlauf</h4><div class="spwrap wv"><canvas id="spWv" role="img" aria-label="Zeitverlauf"></canvas></div><div class="legend" id="spWvLeg"></div></div>`;
    ST.host = host; ST.dirty = true; ST.spKey = '';
    wire(host, api); syncUi(host, api); startLoop(host, api);
  };
  E.spec.refresh = function () { ST.dirty = true; ST.spKey = ''; if (ST.host && ST.api) { syncUi(ST.host, ST.api); } };
  E.spec.redraw = function () { ST.dirty = true; };

  function getSpectrum(api, force) {
    const rig = api.rig; if (!rig || typeof rig.spectrum !== 'function') return null; let key = '';
    try { key = (rig.getControls ? JSON.stringify(rig.getControls()) : '') + '|' + (rig.state ? (rig.state().version || '') : ''); } catch (e) {}
    if (!force && key === ST.spKey && ST.sp) return ST.sp; let sp = null; try { sp = rig.spectrum(); } catch (e) { sp = null; }
    if (sp && !Array.isArray(sp.lines)) sp = null; ST.spKey = key; ST.sp = sp; ST.dirty = true; ST.changeAt = typeof performance !== 'undefined' ? performance.now() : 0; return sp;
  }
  function firstCurve(rig) { let c = null; try { c = rig && rig.curves ? (rig.curves() || [])[0] : null; } catch (e) { c = null; } return c && Array.isArray(c.series) && c.series.length ? c : null; }
  function curveBounds(c) { let a = Infinity, b = -Infinity; c.series.forEach(s => (s.points || []).forEach(p => { if (fin(p[0]) && p[0] > 0) { if (p[0] < a) a = p[0]; if (p[0] > b) b = p[0]; } })); return fin(a) && b > a ? { f0: a, f1: b } : { f0: 50, f1: 1e9 }; }
  /* Geisterlinie: Spektrum des gemerkten Vorher-Zustands (eigene Anlage mit restore) */
  function ghostOf(api) {
    const S = api.S; if (!S || !S.ref || !api.defOf) return null; const key = JSON.stringify(S.ref) + ST.rigId; if (key === ST.ghostKey) return ST.ghost;
    ST.ghostKey = key; ST.ghost = null;
    try { const d = api.defOf(ST.rigId), r = d.create({ seed: 1 }); if (r.restore(JSON.parse(JSON.stringify(S.ref))) !== false && typeof r.spectrum === 'function') ST.ghost = r.spectrum(); } catch (e) { ST.ghost = null; }
    return ST.ghost;
  }

  function syncUi(host, api) {
    const sp = ST.sp || getSpectrum(api, true), $ = s => host.querySelector(s);
    const f0 = $('#spF0'), f1 = $('#spF1'); if (f0 && f1 && ST.range) { if (!f0.matches || !f0.matches(':focus')) f0.value = fe(ST.range.f0, 'Hz'); if (!f1.matches || !f1.matches(':focus')) f1.value = fe(ST.range.f1, 'Hz'); }
    if (!sp) return;
    const rb = $('#spRbw'); if (rb && ST.range) rb.textContent = 'RBW automatisch: ' + rbwFor(ST.range.f0, ST.range.f1).text + ' (Übungswert (A))';
    const rf = $('#spRef'); if (rf && (!rf.matches || !rf.matches(':focus'))) rf.value = String(ST.ref != null ? ST.ref : autoRef(sp, ST.mode, ST.range)).replace('.', ',');
    host.querySelectorAll && host.querySelectorAll('[data-sb]').forEach(b => { const k = b.dataset.sb, B = BANDS[k], on = B.f0 == null ? (Math.abs(ST.range.f0 / boundsOf(sp).f0 - 1) < 1e-6 && Math.abs(ST.range.f1 / boundsOf(sp).f1 - 1) < 1e-6) : (Math.abs(ST.range.f0 / B.f0 - 1) < 1e-6 && Math.abs(ST.range.f1 / B.f1 - 1) < 1e-6); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    host.querySelectorAll && host.querySelectorAll('[data-sm]').forEach(b => { const on = b.dataset.sm === ST.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    [['env', ST.env], ['lim', ST.lim], ['peak', !!(api.S && api.S.peak)]].forEach(([k, on]) => { const b = $('[data-sa="' + k + '"]'); if (b) { b.classList.toggle('on', !!on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); } });
    renderTable(host, api, sp);
  }
  function renderTable(host, api, sp) {
    const el = host.querySelector('#spTab'); if (!el) return; const lever = {}; try { Object.keys(api.LEVERS || {}).forEach(k => { lever[k] = api.LEVERS[k].name; }); } catch (e) {}
    let diag = []; try { diag = api.rig.diagnose ? api.rig.diagnose() : []; } catch (e) {}
    const top = topLines(sp, 5, ST.mode, diag, lever); ST.top = top;
    el.innerHTML = sp ? `<table class="sptab"><tr><th>Die fünf höchsten Linien</th><th class="n">Pegel in ${esc(sp.unit || 'dBµV')}</th><th class="n">Marge in dB</th><th>Maßnahme</th></tr>${top.map(r => `<tr class="k-${r.ampel}" data-i="${r.i}" tabindex="0"><td><span class="sy" aria-hidden="true">${SYM[r.ampel]}</span>${esc(fe(r.f, 'Hz'))}</td><td class="n">${fnum(r.L, 1)}</td><td class="n">${r.margin == null ? 'kein Grenzwert' : fnum(r.margin, 1)}</td><td>${esc(r.hint)}</td></tr>`).join('')}</table><p class="hint2">Tippe eine Zeile an: Der Marker springt auf die Linie. Die Marge ist die Differenz zur strengsten Übungsgrenzlinie an dieser Frequenz.</p>` : '';
  }

  /* Text der Markeranzeige (Frequenz, Pegel, Marge zur strengsten Grenzlinie); rein, ohne DOM */
  function markerHtml(sp, mode, f) {
    const tr = traceOf(sp, mode); if (f == null || !tr.n) return 'Tippe ins Bild, um einen Marker zu setzen, oder wähle „Marker auf Spitze“.';
    const i = nearestIdx(tr.f, f), m = marginAt(sp.limits, tr.f[i], tr.L[i]), k = rate(m ? m.margin : null);
    return `Marker: <b>${esc(fe(tr.f[i], 'Hz'))}</b>, <b>${fnum(tr.L[i], 1)} ${esc(sp.unit || 'dBµV')}</b>, ${m ? `Marge <b>${fnum(m.margin, 1)} dB</b> zur Grenzlinie (${SYM[k]} ${NAME[k]})` : 'für diese Frequenz gibt es keinen Grenzwert'}.`;
  }
  function readout(api) {
    const sp = ST.sp, el = ST.host && ST.host.querySelector('#spRead'); if (!el) return;
    let html = '';
    if (sp) html = markerHtml(sp, ST.mode, ST.marker);
    else { const c = firstCurve(api.rig); html = c ? 'Kurve: ' + esc(c.title || '') + (ST.marker != null ? ' · ' + curveReadout(c, ST.marker) : '') : ''; }
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
  }
  function interpPts(pts, x) { const p = (pts || []).filter(q => fin(q[0]) && fin(q[1])); for (let i = 0; i < p.length - 1; i++) if (x >= p[i][0] && x <= p[i + 1][0]) { const t = p[i + 1][0] === p[i][0] ? 0 : Math.log(x / p[i][0]) / Math.log(p[i + 1][0] / p[i][0]); return p[i][1] + (p[i + 1][1] - p[i][1]) * t; } return null; }
  function curveReadout(c, x) { return esc(fe(x, c.xUnit || 'Hz')) + ': ' + c.series.map(s => { const v = interpPts(s.points, x); return esc(s.name) + ' ' + (v == null ? '–' : fnum(v, 1) + ' ' + esc(c.yUnit || '')); }).join(', '); }

  /* ---- Zeichnen des Spektrums ---- */
  function drawSpectrum(cv, api, now) {
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    const dpr = Math.min(2, root.devicePixelRatio || 1), cw = Math.round(W * dpr), ch = Math.round(H * dpr); if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const P = U.pal(), sp = ST.sp;
    if (!sp) return drawCurveView(g, W, H, api);
    const tr = traceOf(sp, ST.mode), r = ST.range, top = ST.ref != null ? ST.ref : autoRef(sp, ST.mode, r), bot = top - ST.span;
    const narrow = W < 460, fs = narrow ? 11 : 12, m = { l: narrow ? 44 : 54, r: 12, t: 14, b: 40 }, px0 = m.l, py0 = m.t, pw = W - m.l - m.r, ph = H - m.t - m.b;
    if (pw < 60 || ph < 40) return;
    const lx = Math.log10(r.f0), hx = Math.log10(r.f1), X = f => px0 + (Math.log10(f) - lx) / (hx - lx) * pw, Y = L => py0 + (1 - (L - bot) / (top - bot)) * ph, inv = x => Math.pow(10, lx + (x - px0) / pw * (hx - lx));
    ST.geo = { px0, py0, pw, ph, inv, X, Y, W, H };
    g.fillStyle = P.bg; g.fillRect(0, 0, W, H); g.font = fs + 'px system-ui'; g.textBaseline = 'middle'; g.lineWidth = 1;
    U.linTicks(bot, top, Math.max(3, Math.floor(ph / 36))).forEach(v => { const y = Math.round(Y(v)) + 0.5; g.strokeStyle = P.grid; g.beginPath(); g.moveTo(px0, y); g.lineTo(px0 + pw, y); g.stroke(); g.fillStyle = P.mute; g.textAlign = 'right'; g.fillText(String(v).replace('.', ','), px0 - 5, y); });
    let lastR = -1e9; U.logTicks(r.f0, r.f1).forEach(v => { const x = Math.round(X(v)) + 0.5; g.strokeStyle = P.grid; g.beginPath(); g.moveTo(x, py0); g.lineTo(x, py0 + ph); g.stroke(); const t = fe(v, 'Hz'), w = g.measureText(t).width; if (x - w / 2 > lastR + 4 && x - w / 2 > 0 && x + w / 2 < W) { g.fillStyle = P.mute; g.textAlign = 'center'; g.fillText(t, x, py0 + ph + 12); lastR = x + w / 2; } });
    g.strokeStyle = P.line; g.strokeRect(px0 + 0.5, py0 + 0.5, pw, ph);
    g.fillStyle = P.mute; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText('Frequenz in Hz, kHz, MHz', px0 + pw / 2, H - 4); g.save(); g.translate(11, py0 + ph / 2); g.rotate(-Math.PI / 2); g.fillText('Pegel in ' + (sp.unit || 'dBµV'), 0, 0); g.restore();
    g.save(); g.beginPath(); g.rect(px0, py0, pw, ph); g.clip();
    /* Eigenrauschen als Teppich (gestrichelte Schraffur) */
    if (fin(sp.floor) && sp.floor > bot) { const y = Y(Math.min(sp.floor, top)); g.fillStyle = P.mute; g.globalAlpha = 0.16; g.fillRect(px0, y, pw, py0 + ph - y); g.globalAlpha = 0.5; g.strokeStyle = P.mute; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(px0, y); g.lineTo(px0 + pw, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; }
    /* Geisterlinie des Vorher-Zustands */
    const gh = ghostOf(api); if (gh && !(api.S && api.S.ghost === false)) { const gt = traceOf(gh, ST.mode); g.strokeStyle = P.fg; g.globalAlpha = 0.45; g.lineWidth = 1.4; g.setLineDash([2, 3]); g.beginPath(); let st = false; for (let i = 0; i < gt.n; i++) { if (gt.f[i] < r.f0 * 0.9 || gt.f[i] > r.f1 * 1.1) continue; const x = X(gt.f[i]), y = Y(gt.L[i]); g.moveTo(x, py0 + ph); g.lineTo(x, y); st = true; } if (st) g.stroke(); g.setLineDash([]); g.globalAlpha = 1; g.lineWidth = 1; }
    /* Balken: Farbe nach Marge zur strengsten Grenzlinie (grün, gelb, rot), über der Grenzlinie zusätzlich schraffiert */
    const vis = []; for (let i = 0; i < tr.n; i++) { const f = tr.f[i]; if (f >= r.f0 * 0.98 && f <= r.f1 * 1.02) vis.push(i); }
    const bw = vis.length < 40 ? 4 : vis.length < 200 ? 2.5 : 1.5, disp = ST.disp; ST.visN = vis.length;
    vis.forEach(i => {
      const f = tr.f[i], L = disp && disp.length === tr.n ? disp[i] : tr.L[i], x = X(f), y = clamp(Y(L), py0, py0 + ph), m2 = marginAt(sp.limits, f, tr.L[i]), k = m2 ? rate(m2.margin) : 'neutral';
      if (fin(sp.floor) && tr.L[i] < sp.floor) return;
      const col = k === 'gruen' ? P.ok : k === 'gelb' ? P.warn : k === 'rot' ? P.bad : P.acc;
      g.fillStyle = col; g.fillRect(x - bw / 2, y, bw, py0 + ph - y);
      if (k === 'rot' && m2) { const yl = clamp(Y(m2.limit), py0, py0 + ph); g.strokeStyle = P.bg; g.lineWidth = Math.max(1, bw * 0.55); g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, y); g.lineTo(x, yl); g.stroke(); g.setLineDash([]); g.lineWidth = 1; }
    });
    /* Spitzenwert halten */
    if (api.S && api.S.peak && ST.hold && ST.hold.length === tr.n) { g.strokeStyle = P.fg; g.lineWidth = 1.5; vis.forEach(i => { const x = X(tr.f[i]), y = Y(ST.hold[i]); g.beginPath(); g.moveTo(x - 2.5, y); g.lineTo(x + 2.5, y); g.stroke(); }); g.lineWidth = 1; }
    /* Einhüllende und Grenzlinien */
    if (ST.env && Array.isArray(sp.env) && sp.env.length > 1) { g.strokeStyle = P.fg; g.globalAlpha = 0.7; g.lineWidth = 1.4; g.setLineDash([7, 4]); g.beginPath(); sp.env.filter(p => p && fin(p[0]) && fin(p[1]) && p[0] > 0).forEach((p, k) => { const x = X(p[0]), y = clamp(Y(p[1]), py0 - 2000, py0 + ph + 2000); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.globalAlpha = 1; g.lineWidth = 1; }
    if (ST.lim) (sp.limits || []).forEach((l, li) => { const p = (l.pts || []).filter(q => fin(q[0]) && fin(q[1]) && q[0] > 0); if (p.length < 2) return; g.strokeStyle = P.fg; g.lineWidth = 2; g.setLineDash(li % 2 ? [2, 4] : [10, 5]); g.beginPath(); p.forEach((q, k) => { const x = X(q[0]), y = Y(q[1]); if (k) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); g.setLineDash([]); g.lineWidth = 1; });
    /* Marker */
    let mkIdx = -1; if (ST.marker != null && tr.n) { mkIdx = nearestIdx(tr.f, ST.marker); const x = X(tr.f[mkIdx]); g.strokeStyle = P.warn; g.lineWidth = 1.6; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(x, py0); g.lineTo(x, py0 + ph); g.stroke(); g.setLineDash([]); g.lineWidth = 1; g.fillStyle = P.warn; g.beginPath(); g.moveTo(x - 6, py0); g.lineTo(x + 6, py0); g.lineTo(x, py0 + 9); g.closePath(); g.fill(); }
    g.restore();
    if (ST.lim) (sp.limits || []).forEach((l, li) => { const p = (l.pts || []).filter(q => fin(q[0]) && fin(q[1]) && q[0] > 0); if (!p.length) return; const lastP = p[p.length - 1], x = clamp(X(Math.min(lastP[0], r.f1)), px0, px0 + pw); if (X(lastP[0]) < px0) return; const yy = clamp(Y(lastP[1]), py0 + 8, py0 + ph - 8); U.label(g, l.name || l.id || 'Grenzlinie', x - 2, yy + (li % 2 ? 14 : -14), { size: fs, align: 'right', W }); });
    if (fin(sp.floor) && sp.floor > bot && sp.floor < top) U.label(g, 'Eigenrauschen ' + fnum(sp.floor, 0) + ' ' + (sp.unit || 'dBµV'), px0 + 4, Y(sp.floor) - 10, { size: fs, W });
    /* höchste Linie und Marker beschriften: Zahlen stehen immer im Bild */
    const topI = vis.reduce((b2, i) => (b2 < 0 || tr.L[i] > tr.L[b2] ? i : b2), -1), lab = mkIdx >= 0 ? mkIdx : topI;
    if (lab >= 0) { const x = X(tr.f[lab]), y = clamp(Y(tr.L[lab]), py0 + 12, py0 + ph - 8); U.label(g, fe(tr.f[lab], 'Hz') + ' · ' + fnum(tr.L[lab], 1) + ' ' + (sp.unit || 'dBµV'), clamp(x, px0 + 4, px0 + pw - 4), y - 12, { size: fs, align: x > px0 + pw * 0.6 ? 'right' : 'left', bold: true, W, color: mkIdx >= 0 ? P.warn : P.fg }); }
  }
  function drawCurveView(g, W, H, api) {
    const c = firstCurve(api.rig), P = U.pal(); if (!c) return; const r = ST.range;
    let y0 = Infinity, y1 = -Infinity; c.series.forEach(s => (s.points || []).forEach(p => { if (fin(p[1]) && p[0] >= r.f0 && p[0] <= r.f1) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } }));
    if (!fin(y0) || !(y1 > y0)) { y0 = 0; y1 = 1; } const pad = (y1 - y0) * 0.08;
    const cols = [P.acc, P.src, P.warn, P.mass, P.e, P.fg], dashes = [[], [8, 4], [2, 4], [10, 3, 2, 3]];
    U.lineChart(g, W, H, { xMin: r.f0, xMax: r.f1, xLog: c.xScale !== 'lin', yMin: y0 - pad, yMax: y1 + pad, series: c.series.map((s, i) => ({ name: s.name, pts: s.points, color: cols[i % cols.length], dash: dashes[i % dashes.length], width: 2 })), marker: c.marker, xLabel: (c.xLabel || 'Frequenz') + ' in ' + (c.xUnit || 'Hz'), yLabel: (c.yLabel || '') + ' in ' + (c.yUnit || ''), xTick: v => fe(v, c.xUnit || 'Hz'), hlines: c.limit && fin(c.limit.y) ? [{ y: c.limit.y, text: c.limit.name || 'Grenzwert' }] : [] });
    ST.geo = { px0: W < 460 ? 44 : 54, pw: W - (W < 460 ? 44 : 54) - 12, W, H, curve: true, inv: x => { const lx = Math.log10(r.f0), hx = Math.log10(r.f1); return Math.pow(10, lx + (x - (W < 460 ? 44 : 54)) / (W - (W < 460 ? 44 : 54) - 12) * (hx - lx)); } };
  }
  function drawWave(host, api) {
    const card = host.querySelector('#spWvCard'), cv = host.querySelector('#spWv'); if (!card || !cv || !cv.getContext) return; let wv = null; try { wv = api.rig.waveform ? api.rig.waveform() : null; } catch (e) { wv = null; }
    if (!wv || !Array.isArray(wv.series) || !wv.series.length || !Array.isArray(wv.t) || wv.t.length < 2) { card.hidden = true; return; } card.hidden = false;
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; const dpr = Math.min(2, root.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const P = U.pal(), cols = [P.src, P.acc, P.warn, P.mass, P.e], dashes = [[], [8, 4], [2, 4], [10, 3, 2, 3]];
    let y0 = Infinity, y1 = -Infinity; wv.series.forEach(s => (s.y || []).forEach(v => { if (fin(v)) { if (v < y0) y0 = v; if (v > y1) y1 = v; } })); if (!fin(y0) || !(y1 > y0)) { y0 = 0; y1 = 1; } const pad = (y1 - y0) * 0.1;
    U.lineChart(g, W, H, { xMin: wv.t[0], xMax: wv.t[wv.t.length - 1], yMin: y0 - pad, yMax: y1 + pad, series: wv.series.map((s, i) => ({ name: s.name, pts: wv.t.map((t, k) => [t, s.y[k]]), color: cols[i % cols.length], dash: dashes[i % dashes.length], width: 2 })), vlines: (wv.marks || []).map((m, i) => ({ x: m.t, text: m.text, row: i % 2 })), xLabel: 'Zeit in ' + (wv.tUnit || 's'), yLabel: wv.series[0] && wv.series[0].unit ? 'in ' + wv.series[0].unit : '' });
    const leg = host.querySelector('#spWvLeg'); if (leg) { const h = wv.series.map((s, i) => `<span><i style="background:${cols[i % cols.length]}"></i>${esc(s.name)}${s.unit ? ' in ' + esc(s.unit) : ''} (${['durchgezogen', 'gestrichelt', 'punktiert', 'strichpunktiert'][i % 4]})</span>`).join(''); if (leg.dataset.h !== h) { leg.dataset.h = h; leg.innerHTML = h; } }
  }

  /* ---- Bedienung ---- */
  function wire(host, api) {
    if (!host.addEventListener) return;
    const set = () => { ST.dirty = true; ST.spKey = ST.spKey; syncUi(host, api); };
    once(host, 'spec', 'click', e => {
      const sb = e.target.closest && e.target.closest('[data-sb]'), sa = e.target.closest && e.target.closest('[data-sa]'), sm = e.target.closest && e.target.closest('[data-sm]'), row = e.target.closest && e.target.closest('tr[data-i]');
      const sp = ST.sp, b = sp ? boundsOf(sp) : { f0: 50, f1: 1e9 };
      if (sb) { const B = BANDS[sb.dataset.sb]; ST.range = B.f0 == null ? { f0: b.f0, f1: b.f1 } : { f0: clamp(B.f0, b.f0, b.f1), f1: clamp(B.f1, b.f0, b.f1) }; if (!(ST.range.f1 > ST.range.f0)) ST.range = { f0: b.f0, f1: b.f1 }; useStat(api); set(); }
      else if (sm) { ST.mode = sm.dataset.sm; ST.hold = null; useStat(api); set(); }
      else if (sa) {
        const k = sa.dataset.sa;
        if (k === 'env') ST.env = !ST.env; else if (k === 'lim') ST.lim = !ST.lim; else if (k === 'peak') { if (api.S) api.S.peak = !api.S.peak; ST.hold = null; useStat(api); }
        else if (k === 'refup' || k === 'refdn') { const cur = ST.ref != null ? ST.ref : autoRef(sp, ST.mode, ST.range); ST.ref = cur + (k === 'refup' ? 10 : -10); } else if (k === 'refauto') ST.ref = null;
        else if (k === 'mk') { const tr = traceOf(sp, ST.mode); let bi = -1; for (let i = 0; i < tr.n; i++) if (tr.f[i] >= ST.range.f0 && tr.f[i] <= ST.range.f1 && (bi < 0 || tr.L[i] > tr.L[bi])) bi = i; if (bi >= 0) { ST.marker = tr.f[bi]; useStat(api); } else api.toast && api.toast('Im sichtbaren Bereich gibt es keine Linie.'); }
        set();
      } else if (row) { const sp2 = ST.sp, tr = traceOf(sp2, ST.mode), i = +row.dataset.i; if (tr.f[i]) { ST.marker = tr.f[i]; useStat(api); set(); } }
    });
    once(host, 'spec', 'change', e => {
      const t = e.target; if (!t || !t.id) return; const sp = ST.sp, b = sp ? boundsOf(sp) : { f0: 50, f1: 1e9 };
      if (t.id === 'spF0' || t.id === 'spF1') { const P = api.parseNum || (s => parseFloat(String(s).replace(',', '.'))); let v = P(t.value); if (!fin(v) || v <= 0) { syncUi(host, api); return; } const rr = { f0: ST.range.f0, f1: ST.range.f1 }; if (t.id === 'spF0') rr.f0 = clamp(v, b.f0, b.f1); else rr.f1 = clamp(v, b.f0, b.f1); if (rr.f1 > rr.f0 * 1.001) ST.range = rr; else api.toast && api.toast('Die Stoppfrequenz muss größer sein als die Startfrequenz.'); useStat(api); set(); }
      else if (t.id === 'spRef') { const v = (api.parseNum || (s => parseFloat(String(s).replace(',', '.'))))(t.value); if (fin(v)) ST.ref = v; set(); }
    });
    const cv = host.querySelector('#spCv'); if (!cv || !cv.addEventListener) return;
    const pos = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const setMarker = x => { const geo = ST.geo; if (!geo) return; const f = geo.inv(clamp(x, geo.px0, geo.px0 + geo.pw)); if (ST.sp) { const tr = traceOf(ST.sp, ST.mode); if (tr.n) { ST.marker = tr.f[nearestIdx(tr.f, f)]; } } else ST.marker = f; ST.dirty = true; useStat(api); renderTable(host, api, ST.sp || { lines: [], limits: [] }); readout(api); syncUi(host, api); };
    cv.addEventListener('pointerdown', e => { try { cv.setPointerCapture(e.pointerId); } catch (x) {} const [x, y] = pos(e); ST.pointers.set(e.pointerId, { x, y, x0: x, moved: false }); if (ST.pointers.size === 2) { const a = [...ST.pointers.values()]; ST.pinch = { d: Math.abs(a[0].x - a[1].x), r: { f0: ST.range.f0, f1: ST.range.f1 }, c: (a[0].x + a[1].x) / 2 }; } ST.pan = { r: { f0: ST.range.f0, f1: ST.range.f1 } }; });
    cv.addEventListener('pointermove', e => {
      const p = ST.pointers.get(e.pointerId); if (!p) return; const [x, y] = pos(e), geo = ST.geo; p.x = x; p.y = y; if (Math.abs(x - p.x0) > 6) p.moved = true; if (!geo || !ST.range) return; const b = ST.sp ? boundsOf(ST.sp) : curveBounds(firstCurve(api.rig) || { series: [] });
      if (ST.pointers.size === 2 && ST.pinch) { const a = [...ST.pointers.values()], d = Math.abs(a[0].x - a[1].x); if (d > 8 && ST.pinch.d > 8) { ST.range = zoomRange(ST.pinch.r, ST.pinch.d / d, geo.inv((a[0].x + a[1].x) / 2), b); ST.dirty = true; syncUi(host, api); } return; }
      if (p.moved && ST.pointers.size === 1 && ST.pan) { const frac = -(x - p.x0) / geo.pw; ST.range = panRange(ST.pan.r, frac, b); ST.dirty = true; syncUi(host, api); }
    });
    const up = e => { const p = ST.pointers.get(e.pointerId); ST.pointers.delete(e.pointerId); if (ST.pointers.size < 2) ST.pinch = null; if (p && !p.moved && ST.pointers.size === 0) setMarker(p.x); if (ST.pointers.size === 0) ST.pan = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', e => { ST.pointers.delete(e.pointerId); ST.pinch = null; ST.pan = null; });
    cv.addEventListener('wheel', e => { e.preventDefault(); const geo = ST.geo; if (!geo || !ST.range) return; const [x] = pos(e), b = ST.sp ? boundsOf(ST.sp) : curveBounds(firstCurve(api.rig) || { series: [] }); ST.range = zoomRange(ST.range, e.deltaY > 0 ? 1.25 : 0.8, geo.inv(clamp(x, geo.px0, geo.px0 + geo.pw)), b); ST.dirty = true; syncUi(host, api); }, { passive: false });
    cv.tabIndex = 0; cv.addEventListener('keydown', e => { if (!ST.sp) return; const tr = traceOf(ST.sp, ST.mode); if (!tr.n || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; e.preventDefault(); const i = ST.marker == null ? 0 : nearestIdx(tr.f, ST.marker), j = clamp(i + (e.key === 'ArrowRight' ? 1 : -1), 0, tr.n - 1); ST.marker = tr.f[j]; ST.dirty = true; syncUi(host, api); });
  }

  function startLoop(host, api) {
    if (typeof requestAnimationFrame === 'undefined') return; const my = ++ST.loop; let last = 0;
    const tick = ts => {
      if (my !== ST.loop || !host.isConnected) return; requestAnimationFrame(tick);
      if (!api.S || api.S.tab !== 'spec') { last = ts; return; }
      const dt = Math.min(0.1, (ts - (last || ts)) / 1000); last = ts; const was = ST.spKey; const sp = getSpectrum(api, false);
      if (sp && ST.spKey !== was) { const tr = traceOf(sp, ST.mode), now = ts; const target = Float64Array.from(tr.L); if (api.reduced || !ST.disp || ST.disp.length !== tr.n) { ST.disp = Float64Array.from(target); ST.tween = null; } else ST.tween = { from: Float64Array.from(ST.disp), to: target, t0: now }; syncUi(host, api); }
      if (ST.tween) { const k = clamp((ts - ST.tween.t0) / 300, 0, 1), e = k * (2 - k); const d = ST.disp && ST.disp.length === ST.tween.to.length ? ST.disp : (ST.disp = new Float64Array(ST.tween.to.length)); for (let i = 0; i < d.length; i++) d[i] = ST.tween.from[i] + (ST.tween.to[i] - ST.tween.from[i]) * e; ST.dirty = true; if (k >= 1) ST.tween = null; }
      if (sp && api.S && api.S.peak) { const tr = traceOf(sp, ST.mode); if (!ST.hold || ST.hold.length !== tr.n) ST.hold = Float64Array.from(tr.L); ST.hold = holdStep(ST.hold, tr.L, dt); ST.dirty = true; } else if (ST.hold) ST.hold = null;
      if (!ST.dirty) return; ST.dirty = false; const cv = host.querySelector('#spCv'); if (cv) { drawSpectrum(cv, api, ts); try { cv.setAttribute('aria-label', aria(api.rigName ? api.rigName(ST.rigId) : ST.rigId, ST.top)); } catch (e) {} } drawWave(host, api); readout(api);
      const fl = host.querySelector('#spFloor'); if (fl && ST.sp) { const n = floorCount(ST.sp, ST.mode), t = n ? n + ' Linie' + (n > 1 ? 'n' : '') + ' liegen unter dem Eigenrauschen des Analysators (' + fnum(ST.sp.floor, 0) + ' ' + (ST.sp.unit || 'dBµV') + ') und sind nicht messbar.' : ''; if (fl.textContent !== t) fl.textContent = t; }
    };
    requestAnimationFrame(tick);
  }
  E.spec.state = ST;
  if (typeof module !== 'undefined') module.exports = E.spec;
})(typeof window !== 'undefined' ? window : globalThis);
