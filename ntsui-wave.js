'use strict';
/* Tonfunk Netzteil-Lab (NTS-Lab): Tab "Verläufe" (WP3b, SPEC 6.3).
   Zeichnet bis vier Spuren aus rig.waveform() (z. B. u2, uc, iD; u_sw, i_L, u_C), jede Spur in einem eigenen Streifen, alle mit gemeinsamer Zeitachse.
   Cursor mit Werten (Maus, Touch, Pfeiltasten), Lauflinie (Zeitlupe, Einfrieren), Geisterlinie Vorher/Nachher (aus api.refRig(), gleiche Spurnamen), Wertetabelle als Alternative und CSV.
   Steilflanken (doppelte Zeitwerte, zum Beispiel beim Gate-Verlauf) werden nicht geteilt: Der Cursor nennt dann beide Werte ("springt von ... auf ...").
   Es wird NICHT gerechnet: Alle Zahlen (Zeiten, Spuren, Marken) kommen aus rig.waveform(); hier stehen nur Abbildung, Interpolation zwischen Stützstellen und Beschriftung (SPEC Regel 7).
   Kein Trigger- und Messbereichsunterricht: Hinweis und Link ins MessLab. Alle Verläufe sind Lehrmodelle mit Übungswerten (A).
   Schnittstelle (VERTRAG 6.4): window.NTS_UI_EXT.wave = { render(host, api), update(host, api), refresh(), redraw(), fn }. Die reinen Funktionen (ohne DOM) hängen unter fn und werden von test_ntsui_ext.js geprüft. */
(function (root) {
  const E = root.NTS_UI_EXT = root.NTS_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const once = (host, name, ty, fn) => { host.__ntswv = host.__ntswv || {}; if (host.__ntswv[name + ty]) return; host.__ntswv[name + ty] = 1; host.addEventListener(ty, fn); };
  const NOTE = 'Verläufe sind Lehrmodelle aus den Kernzahlen des Prüfstands mit Übungswerten (A), nicht maßstäblich. Grün heißt nicht: gefahrlos anfassen.';
  const SER = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--bad-fg)'];
  const MAXS = 4, PERIOD = 8, SLOW = 0.25;

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* Zahl mit Dezimalkomma, 3 gültige Stellen */
  function fv(v) {
    if (!fin(v)) return '–'; const a = Math.abs(v); if (a === 0) return '0';
    const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(3);
    return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  const withUnit = (v, u) => fv(v) + (u ? ' ' + u : '');
  const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
  /* Verlauf bereinigen: je Spur nur endliche Paare (stabil nach Zeit sortiert, doppelte Zeiten bleiben in Reihenfolge), leere Spuren entfallen; null, wenn nichts zu zeichnen ist */
  function clean(w) {
    if (!w || typeof w !== 'object' || !Array.isArray(w.t) || !Array.isArray(w.series)) return null;
    const series = [];
    w.series.forEach(s => {
      if (!s || !Array.isArray(s.y)) return;
      const pts = []; for (let i = 0; i < w.t.length && i < s.y.length; i++) if (fin(w.t[i]) && fin(s.y[i])) pts.push([w.t[i], s.y[i], i]);
      pts.sort((a, b) => (a[0] - b[0]) || (a[2] - b[2]));
      if (pts.length) series.push({ name: String(s.name == null ? '' : s.name), unit: String(s.unit == null ? '' : s.unit), points: pts.map(p => [p[0], p[1]]) });
    });
    if (!series.length) return null;
    const marks = (Array.isArray(w.marks) ? w.marks : []).filter(m => m && fin(m.value)).map(m => ({ name: String(m.name == null ? '' : m.name), value: m.value, unit: String(m.unit == null ? '' : m.unit) }));
    return { tUnit: String(w.tUnit == null ? '' : w.tUnit), series, marks };
  }
  /* Spurwahl: gewünschte Namen, die es gibt (höchstens vier); sonst die ersten vier */
  function pickNames(c, sel) {
    if (!c) return []; const all = c.series.map(s => s.name);
    let r = (Array.isArray(sel) ? sel : []).filter((n, i, a) => all.indexOf(n) >= 0 && a.indexOf(n) === i).slice(0, MAXS);
    if (!r.length) r = all.slice(0, MAXS); return r;
  }
  function niceNum(x) { const e = Math.floor(Math.log10(x)), f = x / Math.pow(10, e); return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * Math.pow(10, e); }
  function niceRange(lo, hi) {
    if (!fin(lo) || !fin(hi)) return [0, 1];
    if (lo >= 0 && lo <= 0.35 * hi) lo = 0; else if (hi <= 0 && hi >= 0.35 * lo) hi = 0;
    if (hi === lo) { lo -= 0.5; hi += 0.5; }
    const st = niceNum((hi - lo) / 4); lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st; return [lo, hi];
  }
  function ticks(lo, hi, n) {
    const out = [], st = niceNum((hi - lo) / (n || 4)); for (let v = Math.ceil(lo / st - 1e-9) * st, k = 0; v <= hi + st * 1e-9 && k < 20; v += st, k++) out.push(+v.toPrecision(12)); return out;
  }
  const mm = a => a.reduce((r, v) => [Math.min(r[0], v), Math.max(r[1], v)], [Infinity, -Infinity]);
  /* Zeitbereich (beginnt bei 0, wenn der Verlauf dort beginnt) und je Spur ein Wertebereich, Geisterspur eingerechnet */
  function bounds(c, names, ghost) {
    const ts = [], ys = {};
    [c, ghost].forEach((q, qi) => { if (!q) return; q.series.forEach(s => { if (qi === 0 && names.indexOf(s.name) < 0) return; s.points.forEach(p => ts.push(p[0])); const b = ys[s.name] = ys[s.name] || []; s.points.forEach(p => b.push(p[1])); }); });
    const bt = mm(ts), t0 = bt[0] >= 0 && bt[0] <= 0.35 * bt[1] ? 0 : bt[0], t1 = bt[1] > t0 ? bt[1] : t0 + 1, lanes = {};
    names.forEach(n => { const b = mm(ys[n] || [0, 1]); lanes[n] = niceRange(b[0], b[1]); });
    return { t0, t1, lanes };
  }
  /* Wert einer Spur bei x. Doppelte Zeitwerte (Steilflanke) werden nicht geteilt: bei x genau auf der Flanke gilt der Wert danach, "step" nennt beide.
     Rückgabe { y, step: null | { from, to } } oder null außerhalb der Stützstellen / bei ungültigem x */
  function interp(points, x) {
    if (!Array.isArray(points) || !points.length || !fin(x)) return null;
    const n = points.length, t0 = points[0][0], t1 = points[n - 1][0], span = Math.abs(t1 - t0), edge = 1e-9 * Math.max(1, span, Math.abs(t1)), eps = Math.max(edge, span / 2000);
    if (x < t0 - edge || x > t1 + edge) return null;
    let a = -1, b = -1, lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { const y = points[i][1]; if (y < lo) lo = y; if (y > hi) hi = y; if (Math.abs(points[i][0] - x) <= eps) { if (a < 0) a = i; b = i; } }
    /* Steilflanke: Punkte innerhalb einer Bildpunktbreite (span/2000) mit deutlichem Sprung (ueber 2 % des Wertebereichs) werden nicht geteilt */
    if (a >= 0) return { y: points[b][1], step: b > a && Math.abs(points[b][1] - points[a][1]) > 0.02 * (hi - lo) && points[b][1] !== points[a][1] ? { from: points[a][1], to: points[b][1] } : null };
    for (let i = 1; i < n; i++) {
      if (points[i][0] > x) { const p = points[i - 1], q = points[i], dx = q[0] - p[0]; return { y: dx > 0 ? p[1] + (q[1] - p[1]) * (x - p[0]) / dx : q[1], step: null }; }
    }
    return null;
  }
  /* Cursor-Werte aller gezeigten Spuren (und der Geisterspuren) bei x */
  function readout(c, names, ghost, x) {
    const rows = [];
    names.forEach(n => { const s = c.series.find(q => q.name === n); if (!s) return; const r = interp(s.points, x); rows.push({ name: n, unit: s.unit, y: r ? r.y : null, step: r ? r.step : null, ghost: false }); });
    if (ghost) names.forEach(n => { const s = ghost.series.find(q => q.name === n); if (!s) return; const r = interp(s.points, x); rows.push({ name: n, unit: s.unit, y: r ? r.y : null, step: r ? r.step : null, ghost: true }); });
    const txt = r => (r.ghost ? 'Vorher ' : '') + r.name + ' ' + (r.y == null ? 'außerhalb des Verlaufs' : (r.step ? 'springt von ' + withUnit(r.step.from, r.unit) + ' auf ' + withUnit(r.step.to, r.unit) : withUnit(r.y, r.unit)));
    return { x, rows, text: 'Zeit ' + withUnit(x, c.tUnit) + ' – ' + rows.map(txt).join('; ') };
  }
  /* Geometrie: je Spur ein Streifen, unten die gemeinsame Zeitachse */
  function geom(c, names, ghost, w) {
    w = fin(w) ? Math.max(260, Math.min(900, Math.round(w))) : 640;
    const n = Math.max(1, names.length), lh = w < 420 ? 74 : 88, L = 54, R = 12, T = 8, B = 44, gap = 10, b = bounds(c, names, ghost);
    const pw = w - L - R, h = T + n * lh + (n - 1) * gap + B, span = b.t1 - b.t0;
    return { w, h, L, R, T, B, pw, lh, gap, n, b, X: t => L + (t - b.t0) / span * pw, laneTop: i => T + i * (lh + gap), Y: (i, v) => { const r = b.lanes[names[i]]; return T + i * (lh + gap) + (1 - (v - r[0]) / (r[1] - r[0])) * lh; }, tAt: px => b.t0 + Math.min(1, Math.max(0, (px - L) / pw)) * span };
  }
  function pathOf(points, X, Y) { return points.map((p, i) => (i ? 'L' : 'M') + X(p[0]).toFixed(1) + ' ' + Y(p[1]).toFixed(1)).join(''); }
  /* Geisterspur: gleicher Verlauf aus dem Referenz-Prüfstand (nur derselbe Prüfstandstyp) */
  function ghostOf(refRig, rigId) {
    if (!refRig || typeof refRig.waveform !== 'function' || (rigId && refRig.id && refRig.id !== rigId)) return null; let w = null; try { w = refRig.waveform(); } catch (e) { w = null; } return clean(w);
  }
  function chartSvg(c, names, ghost, g, showGhost) {
    const o = [], b = g.b, tk = ticks(b.t0, b.t1, 5);
    names.forEach((n, i) => {
      const s = c.series.find(q => q.name === n); if (!s) return; const top = g.laneTop(i), r = b.lanes[n], col = SER[i % SER.length];
      o.push('<defs><clipPath id="wvClip' + i + '"><rect x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/></clipPath></defs>');
      o.push('<rect class="wv-bg" x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/>');
      tk.forEach(t => { const x = g.X(t).toFixed(1); o.push('<line class="wv-gr" x1="' + x + '" x2="' + x + '" y1="' + top + '" y2="' + (top + g.lh) + '"/>'); });
      ticks(r[0], r[1], 3).forEach(v => { const y = g.Y(i, v).toFixed(1); o.push('<line class="wv-gr" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + y + '" y2="' + y + '"/><text class="wv-tx" x="' + (g.L - 5) + '" y="' + (+y + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'); });
      if (r[0] < 0 && r[1] > 0) o.push('<line class="wv-zero" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + g.Y(i, 0).toFixed(1) + '" y2="' + g.Y(i, 0).toFixed(1) + '"/>');
      o.push('<rect class="wv-fr" x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/>');
      o.push('<text class="wv-nm" x="' + (g.L + 6) + '" y="' + (top + 14) + '" fill="' + col + '">' + esc(cut(n + (s.unit ? ' in ' + s.unit : ''), Math.floor(g.pw / 7))) + '</text>');
      o.push('<g clip-path="url(#wvClip' + i + ')">');
      if (showGhost && ghost) { const gs = ghost.series.find(q => q.name === n); if (gs) o.push('<path class="wv-gh" d="' + pathOf(gs.points, g.X, v => g.Y(i, v)) + '"/>'); }
      o.push('<path class="wv-ln" stroke="' + col + '" d="' + pathOf(s.points, g.X, v => g.Y(i, v)) + '"/></g>');
    });
    const yb = g.T + g.n * g.lh + (g.n - 1) * g.gap;
    tk.forEach(t => { const x = g.X(t).toFixed(1); o.push('<text class="wv-tx" x="' + x + '" y="' + (yb + 16) + '" text-anchor="middle">' + fv(t) + '</text>'); });
    o.push('<text class="wv-ti" x="' + (g.L + g.pw / 2) + '" y="' + (g.h - 6) + '" text-anchor="middle">Zeit' + (c.tUnit ? ' in ' + esc(c.tUnit) : '') + '</text><g id="wvXh"></g>');
    return o.join('');
  }
  /* Überlagerung: Cursor (Linie plus Punkte) und Lauflinie (nur Punkte und dünne Linie) */
  function crossSvg(c, names, g, x, cls) {
    if (!fin(x)) return ''; const px = g.X(x).toFixed(1), o = ['<line class="' + cls + '" x1="' + px + '" x2="' + px + '" y1="' + g.T + '" y2="' + (g.T + g.n * g.lh + (g.n - 1) * g.gap) + '"/>'];
    names.forEach((n, i) => { const s = c.series.find(q => q.name === n), r = s ? interp(s.points, x) : null; if (r) o.push('<circle cx="' + px + '" cy="' + g.Y(i, r.y).toFixed(1) + '" r="4.5" fill="' + SER[i % SER.length] + '" stroke="var(--bg)" stroke-width="1.5"/>'); });
    return o.join('');
  }
  /* Stellung der Lauflinie: dt in Sekunden, Faktor aus Zeitlupe und Prüfstandsgeschwindigkeit; Bruchteil bleibt in [0, 1) */
  function advance(pos, dtS, factor) {
    pos = fin(pos) ? pos : 0; dtS = fin(dtS) && dtS > 0 ? Math.min(dtS, 0.5) : 0; factor = fin(factor) && factor > 0 ? factor : 1;
    const p = pos + dtS * factor / PERIOD; return p - Math.floor(p);
  }
  const marksText = c => (c && c.marks.length ? c.marks.map(m => m.name + ' ' + withUnit(m.value, m.unit)).join(' · ') : '');
  /* CSV: Zeit;Spur;Wert;Zeit-Einheit;Einheit, Dezimalkomma, Felder mit ; oder " in Anführungszeichen */
  const cq = s => (/[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const cn = v => String(+v.toPrecision(9)).replace('.', ',');
  function toCsv(c, title, ghost) {
    const rows = ['# Tonfunk Netzteil-Lab;Verläufe;' + cq(title || '') + ';Übungswerte, Lehrdarstellung', 'Spur;Zeit;Wert;Zeit-Einheit;Einheit'];
    if (!c) return rows.join('\r\n') + '\r\n';
    c.series.forEach(s => s.points.forEach(p => rows.push([cq(s.name), cn(p[0]), cn(p[1]), cq(c.tUnit), cq(s.unit)].join(';'))));
    if (ghost) ghost.series.forEach(s => s.points.forEach(p => rows.push([cq('Vorher: ' + s.name), cn(p[0]), cn(p[1]), cq(ghost.tUnit), cq(s.unit)].join(';'))));
    return rows.join('\r\n') + '\r\n';
  }
  /* Wertetabelle: gleichmäßig ausgewählte Zeitpunkte (ohne doppelte Zeiten), Werte nach der Steilflanke */
  function tableRows(c, names, max) {
    const xs = []; c.series.forEach(s => { if (names.indexOf(s.name) >= 0) s.points.forEach(p => { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); }); }); xs.sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(xs.length / (max || 24))), pick = xs.filter((v, i) => i % step === 0 || i === xs.length - 1);
    return pick.map(x => ({ x, ys: names.map(n => { const s = c.series.find(q => q.name === n), r = s ? interp(s.points, x) : null; return r ? r.y : null; }) }));
  }

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { rigId: null, sel: null, ghost: true, frozen: false, slow: false, table: false, x: null, pos: 0, t: 0, g: null, c: null, names: [], gh: null, w: 0, sig: '' };
  const CSS = '.wv-wrap{touch-action:pan-y;position:relative}.wv-svg{display:block;width:100%;height:auto;border-radius:8px;outline:none}.wv-svg:focus-visible{outline:2px solid var(--accent)}.wv-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}' +
    '.wv-bg{fill:var(--well)}.wv-fr{fill:none;stroke:var(--chart-axis);stroke-width:1}.wv-gr{stroke:var(--chart-grid);stroke-width:1}.wv-zero{stroke:var(--chart-axis);stroke-width:1;stroke-dasharray:2 3}.wv-tx{fill:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}.wv-ti{fill:var(--fg);font-size:12px}.wv-nm{font-size:12px;font-weight:700}' +
    '.wv-ln{fill:none;stroke-width:2.4;stroke-linejoin:round}.wv-gh{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-dasharray:3 3;opacity:.85}.wv-xh{stroke:var(--fg);stroke-width:1;opacity:.75}.wv-sc{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 3}' +
    '.wv-leg{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}.wv-leg li{display:flex;align-items:center;gap:6px;min-height:24px}.wv-sw{width:30px;height:12px;flex:none}.wv-read{min-height:44px;margin-top:8px;font-size:13.5px;font-variant-numeric:tabular-nums}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('ntsWaveCss')) { const s = document.createElement('style'); s.id = 'ntsWaveCss'; s.textContent = CSS; document.head.appendChild(s); } } catch (e) {} }
  const refRigOf = () => { try { const o = A && typeof A.refRig === 'function' ? A.refRig() : null; return o && o.rig ? o.rig : null; } catch (e) { return null; } };
  const rigWave = () => { let w = null; try { w = A && A.rig && typeof A.rig.waveform === 'function' ? A.rig.waveform() : null; } catch (e) { w = null; } return clean(w); };
  const swatch = (i, gh) => '<svg class="wv-sw" viewBox="0 0 30 12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" stroke="' + (gh ? 'var(--mute)' : SER[i % SER.length]) + '" stroke-width="3"' + (gh ? ' stroke-dasharray="3 3"' : '') + '/></svg>';
  function legend(c, names, ghost, showGhost) {
    const li = names.map((n, i) => { const s = c.series.find(q => q.name === n); return '<li>' + swatch(i) + esc(n + (s && s.unit ? ' in ' + s.unit : '')) + '</li>'; });
    if (showGhost && ghost) li.push('<li>' + swatch(0, true) + 'Geisterspur: Vorher</li>');
    return '<ul class="wv-leg" aria-label="Legende">' + li.join('') + '</ul>';
  }
  function tableHtml(c, names) {
    const rows = tableRows(c, names, 24);
    return '<details class="card" id="wvTab"' + (st.table ? ' open' : '') + '><summary>Wertetabelle (Alternative zum Bild)</summary><div class="cb"><table class="kt"><tr><th class="n">Zeit' + (c.tUnit ? ' [' + esc(c.tUnit) + ']' : '') + '</th>' + names.map(n => { const s = c.series.find(q => q.name === n); return '<th class="n">' + esc(n + (s && s.unit ? ' [' + s.unit + ']' : '')) + '</th>'; }).join('') + '</tr>' +
      rows.map(r => '<tr><td class="n">' + fv(r.x) + '</td>' + r.ys.map(y => '<td class="n">' + (y == null ? '–' : fv(y)) + '</td>').join('') + '</tr>').join('') + '</table></div></details>';
  }
  const HINT = '<p class="hint2">Trigger und Messbereich übst du im <a href="messlab.html">MessLab</a>; hier schaust du nur, wie sich die Verläufe mit deinen Einstellungen ändern.</p>';
  function html() {
    const rig = A && A.rig;
    if (!rig) return '<div class="card pl"><p class="big">Kein Prüfstand</p><p class="hint2">Wähle im Tab Prüfstand einen Prüfstand, dann zeigt dieser Tab seine Verläufe.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    if (st.rigId !== rig.id) { st.rigId = rig.id; st.sel = null; st.x = null; st.pos = 0; }
    const c = rigWave();
    if (!c) { st.c = null; st.g = null; return '<div class="card pl"><p class="big">Kein Verlauf</p><p class="hint2">Dieser Prüfstand zeigt keinen Zeitverlauf (oder die Einstellung lässt keinen zu). Die Ampel und die Meldungen im Tab Prüfstand sagen, warum; Kennlinien findest du im Tab Kennlinien.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div>' + HINT + '</div>'; }
    const names = pickNames(c, st.sel); st.sel = names;
    const ghost = ghostOf(refRigOf(), rig.id), wEl = H && H.clientWidth ? H.clientWidth - 26 : 640, g = geom(c, names, ghost, wEl);
    st.c = c; st.names = names; st.gh = ghost; st.g = g; st.w = wEl; st.sig = sigOf(c, ghost);
    const hasRef = !!(A.ref || (A.S && A.S.ref)), mk = marksText(c), still = reduced();
    return '<div class="card pl"><h4>Verläufe: ' + esc(typeof A.rigName === 'function' ? A.rigName(rig.id) : rig.id) + '</h4>' +
      (c.series.length > 1 ? '<div class="wv-chips" role="group" aria-label="Spuren wählen (höchstens vier)">' + c.series.map(s => '<button class="chip' + (names.indexOf(s.name) >= 0 ? ' on' : '') + '" data-sr="' + esc(s.name) + '" aria-pressed="' + (names.indexOf(s.name) >= 0) + '">' + esc(cut(s.name + (s.unit ? ' (' + s.unit + ')' : ''), 24)) + '</button>').join('') + '</div>' : '') +
      '<div class="wv-wrap"><svg class="wv-svg" id="wvSvg" viewBox="0 0 ' + g.w + ' ' + g.h + '" role="img" tabindex="0" aria-label="' + esc('Verläufe: ' + names.join(', ') + '. ' + (mk ? mk + '. ' : '') + 'Mit den Pfeiltasten wanderst du über die Zeit.') + '">' + chartSvg(c, names, ghost, g, st.ghost) + '</svg></div>' +
      '<div class="wv-read" id="wvRead" role="status" aria-live="polite"></div>' +
      legend(c, names, ghost, st.ghost) + (mk ? '<div class="ex" style="margin-top:8px">Marken: ' + esc(mk) + '</div>' : '') +
      '<div class="btns"><button class="btn" data-act="freeze" aria-pressed="' + st.frozen + '">' + (st.frozen ? 'Lauflinie weiterlaufen lassen' : 'Einfrieren') + '</button><button class="btn" data-act="slow" aria-pressed="' + st.slow + '">' + (st.slow ? 'Zeitlupe aus' : 'Zeitlupe') + '</button>' +
      (hasRef ? '<button class="btn" data-act="ghost" aria-pressed="' + st.ghost + '">' + (st.ghost ? 'Geisterspur ausblenden' : 'Geisterspur einblenden') + '</button>' : '') +
      '<button class="btn" data-act="table" aria-pressed="' + st.table + '">' + (st.table ? 'Tabelle schließen' : 'Wertetabelle zeigen') + '</button><button class="btn" data-act="csv">Verlauf als CSV</button></div>' +
      (hasRef ? '' : '<p class="hint2">Mit „Merken“ (Taste M) im Prüfstand legst du einen Vorher-Stand fest; er erscheint hier als Geisterspur.</p>') +
      (still ? '<p class="hint2">Die Lauflinie steht, weil dein Gerät reduzierte Bewegung wünscht. Der Cursor funktioniert trotzdem.</p>' : '') +
      HINT + '<p class="hint2">' + esc(NOTE) + '</p></div>' + tableHtml(c, names);
  }
  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  /* Kennung der Daten: ändert sie sich, wird neu gezeichnet (Steuerwerte, Vorher-Stand) */
  function sigOf(c, ghost) {
    const f = q => (q ? q.series.map(s => s.name + ':' + s.points.length + ':' + (s.points.reduce((a, p) => a + p[0] * 0.37 + p[1], 0)).toPrecision(9)).join('|') : '-');
    return f(c) + '#' + f(ghost) + '#' + st.names.join(',');
  }
  function paint() { if (!H) return; css(); H.innerHTML = html(); H.dataset.wv = '1'; drawOverlay(); }
  /* Wert der Lesezeile: Cursor, sonst Stellung der Lauflinie */
  function scanX() { return st.g ? st.g.b.t0 + st.pos * (st.g.b.t1 - st.g.b.t0) : null; }
  function drawOverlay() {
    if (!H || !st.c || !st.g) return;
    const xh = H.querySelector('#wvXh'), rd = H.querySelector('#wvRead'), gh = st.ghost ? st.gh : null, cur = fin(st.x) ? st.x : null, sx = scanX();
    if (xh) xh.innerHTML = (cur == null ? crossSvg(st.c, st.names, st.g, sx, 'wv-sc') : crossSvg(st.c, st.names, st.g, cur, 'wv-xh'));
    if (rd) rd.textContent = cur != null ? readout(st.c, st.names, gh, cur).text : (fin(sx) ? 'Lauflinie: ' + readout(st.c, st.names, gh, sx).text + ' (Tippe oder fahre über das Bild für den Cursor.)' : '');
  }
  function setX(x) { st.x = fin(x) ? x : null; drawOverlay(); }
  function pointerX(e) {
    const svg = H.querySelector('#wvSvg'); if (!svg || !st.g) return null;
    const r = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null; if (!r || !(r.width > 0)) return null;
    return st.g.tAt((e.clientX - r.left) * (st.g.w / r.width));
  }
  function saveCsv(txt) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'nts-verlauf.csv'); return; } catch (e) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'nts-verlauf.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCsv() {
    const c = rigWave(); if (!c) { A && A.toast && A.toast('Dieser Prüfstand hat keinen Verlauf zum Exportieren.'); return null; }
    const gh = st.ghost && A.rig ? ghostOf(refRigOf(), A.rig.id) : null, txt = toCsv(c, (A.S && A.S.name) || '', gh);
    try { saveCsv(txt); } catch (e) { A.toast && A.toast('Die Datei konnte nicht gespeichert werden.'); return txt; }
    A.stat && A.stat('csv'); A.toast && A.toast('CSV gespeichert'); return txt;
  }
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target : null; if (!t) return;
    const sr = t.closest('[data-sr]');
    if (sr) {
      const n = sr.dataset.sr, cur = st.names.slice(), i = cur.indexOf(n);
      if (i >= 0) { if (cur.length > 1) cur.splice(i, 1); else { A && A.toast && A.toast('Mindestens eine Spur bleibt sichtbar.'); return; } }
      else if (cur.length >= MAXS) { A && A.toast && A.toast('Höchstens vier Spuren gleichzeitig.'); return; } else cur.push(n);
      st.sel = cur; paint(); return;
    }
    const b = t.closest('[data-act]'); if (!b) return; const a = b.dataset.act;
    if (a === 'csv') exportCsv(); else if (a === 'ghost') { st.ghost = !st.ghost; paint(); } else if (a === 'table') { st.table = !st.table; paint(); }
    else if (a === 'freeze') { st.frozen = !st.frozen; paint(); } else if (a === 'slow') { st.slow = !st.slow; paint(); } else if (a === 'rig' && A) A.setTab('rig');
  }
  function onKey(e) {
    if (!st.g || !st.c || !e.target || !e.target.closest || !e.target.closest('#wvSvg')) return;
    const k = e.key, g = st.g; if (k === 'Escape') { setX(null); return; }
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    if (e.preventDefault) e.preventDefault();
    const cur = fin(st.x) ? g.X(st.x) : (k === 'ArrowLeft' ? g.L + g.pw : g.L);
    setX(k === 'Home' ? g.tAt(g.L) : k === 'End' ? g.tAt(g.L + g.pw) : g.tAt(cur + (k === 'ArrowRight' ? 1 : -1) * Math.max(3, g.pw / 60)));
  }
  function render(host, api) {
    A = api; H = host; st.t = Date.now();
    once(host, 'c', 'click', onClick); once(host, 'm', 'pointermove', e => { if (e.target && e.target.closest && e.target.closest('#wvSvg') && (e.pointerType !== 'touch')) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'd', 'pointerdown', e => { if (e.target && e.target.closest && e.target.closest('#wvSvg')) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'k', 'keydown', onKey);
    if (typeof ResizeObserver === 'function' && !host.__ntswvRo) { host.__ntswvRo = new ResizeObserver(() => redraw()); try { host.__ntswvRo.observe(host); } catch (e) {} }
    paint();
  }
  /* wird von ntsui.js alle 250 ms gerufen, solange der Prüfstand läuft: Lauflinie weiterschieben, bei geänderten Daten neu zeichnen */
  function update(host, api) {
    if (api) A = api; if (host) H = host; if (!H || !A) return;
    const now = Date.now(), dt = st.t ? (now - st.t) / 1000 : 0; st.t = now;
    const c = rigWave(); if (!c !== !st.c) { paint(); return; }
    if (c) { const gh = ghostOf(refRigOf(), A.rig.id); if (sigOf(c, gh) !== st.sig) { paint(); return; } }
    if (!st.frozen && st.c && !reduced()) { const sp = A.S && fin(A.S.speed) && A.S.speed > 0 ? A.S.speed : 1; st.pos = advance(st.pos, dt, sp * (st.slow ? SLOW : 1)); drawOverlay(); }
  }
  function redraw() { if (!H || !A || !H.clientWidth) return; if (Math.abs(H.clientWidth - 26 - st.w) > 8 || !H.dataset.wv) paint(); }
  function refresh() { paint(); }

  E.wave = { render, update, refresh, redraw, fn: { fv, clean, pickNames, niceRange, ticks, bounds, interp, readout, geom, ghostOf, chartSvg, crossSvg, legend, advance, marksText, toCsv, tableRows, tableHtml, html, sigOf, state: st, NOTE, setApi: a => { A = a; } } };
})(typeof window !== 'undefined' ? window : globalThis);
