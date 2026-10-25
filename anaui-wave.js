'use strict';
/* Tonfunk Analogtechnik-Lab (ANA-Lab): Tab "Verläufe" (WP3d, SPEC 6.3).
   Zeichnet bis vier Spuren aus rig.waveform() (z. B. u_e und u_a; U_St, I_C und U_CE), jede Spur in einem eigenen Streifen, alle mit gemeinsamer Zeitachse.
   Cursor mit Werten (Maus, Touch, Pfeiltasten), Lauflinie (Zeitlupe, Einfrieren), Geisterspur Vorher (aus api.refRig() oder api.S.refRig, gleiche Spurnamen), Wertetabelle und CSV.
   Steilflanken (Komparator, Schalter, Schmitt-Trigger, Nadeln des Differenzierers) werden nicht geteilt: Der Cursor nennt dann beide Werte ("springt von ... auf ..").
   Begrenzen (waveform().clip) und Slew-Rate-Abschnitte (waveform().slew) erscheinen als Streifen im Bild; waagerechte Marken und die Periodendauer T kommen aus waveform().marks.
   Es wird NICHT gerechnet: Alle Zahlen (Zeiten, Spuren, Marken) kommen aus rig.waveform(); hier stehen nur Abbildung, Interpolation zwischen Stützstellen und Beschriftung (SPEC Regel 7).
   Die Vertiefung "Slew-Rate" (nur Prüfstände mit Operationsverstärker und Slew-Rate im Verlauf) vergleicht den Verlauf der Anlage mit dem Verlauf derselben Anlage bei idealem Operationsverstärker
   (zweite Prüfstands-Instanz, Steuerwert opv) und zeigt die Rechenzeile aus ANA_CORE.deep.slew. Zustand in ana.deep (api.deep).
   Kein Oszilloskop-Unterricht (Abgrenzung MessLab): Hinweis und Link. Alle Verläufe sind Lehrmodelle mit Übungswerten (A). Prüfstand ohne Verlauf (diode): "Kein Verlauf" mit Verweis auf die Kennlinien.
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.wave = { render(host, api), update(host, api), refresh(), redraw(), fn }. update() ruft der Rahmen alle 250 ms, solange der Prüfstand läuft.
   Die reinen Funktionen (ohne DOM) hängen unter fn und werden von test_anaui_ext3.js geprüft. */
(function (root) {
  const E = root.ANA_UI_EXT = root.ANA_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const once = (host, name, ty, fn) => { host.__anawv = host.__anawv || {}; if (host.__anawv[name + ty]) return; host.__anawv[name + ty] = 1; host.addEventListener(ty, fn); };
  const NOTE = 'Verläufe sind Lehrmodelle aus den Kernzahlen des Prüfstands mit Übungswerten (A), nicht maßstäblich. Grün heißt nicht: für jeden Einsatz geeignet.';
  const SER = ['var(--accent)', 'var(--warn)', 'var(--ok)', 'var(--bad-fg)'];
  const MAXS = 4, PERIOD = 8, SLOW = 0.25;
  const SLEWRIGS = ['opv_inv', 'opv_nin', 'opv_aktiv'];

  /* ============================================================ reine Funktionen (ohne DOM) */
  /* Zahl mit Dezimalkomma, 3 gültige Stellen */
  function fv(v) {
    if (!fin(v)) return '–'; const a = Math.abs(v); if (a === 0 || a < 1e-9) return '0';
    const s = a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(3);
    return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  const withUnit = (v, u) => fv(v) + (u ? ' ' + u : '');
  const cut = (s, n) => (s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s);
  const spans = a => (Array.isArray(a) ? a : []).filter(q => q && fin(q.t0) && fin(q.t1) && q.t1 > q.t0).map(q => ({ t0: q.t0, t1: q.t1, name: String(q.name == null ? '' : q.name) }));
  /* Verlauf bereinigen: je Spur nur endliche Paare (stabil nach Zeit sortiert, doppelte Zeiten bleiben in Reihenfolge), leere Spuren entfallen; null, wenn nichts zu zeichnen ist.
     marks darf die Liste [{ name, value, unit }] oder das Objekt { h:[{ y, name, series? }], span:[{ t0, t1, name }] } der Prüfstände sein; clip und slew sind Listen von Zeitabschnitten. */
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
    const mk = w.marks, marks = [], hs = [];
    if (Array.isArray(mk)) mk.filter(m => m && fin(m.value)).forEach(m => marks.push({ name: String(m.name == null ? '' : m.name), value: m.value, unit: String(m.unit == null ? '' : m.unit) }));
    else if (mk && typeof mk === 'object') {
      (Array.isArray(mk.h) ? mk.h : []).filter(m => m && fin(m.y)).forEach(m => { hs.push({ y: m.y, name: String(m.name == null ? '' : m.name), series: fin(m.series) ? m.series : null }); });
      spans(mk.span).filter(q => q.name === 'T' || q.name === 'Periode').forEach(q => marks.push({ name: q.name === 'T' ? 'T' : 'Periode', value: q.t1 - q.t0, unit: String(w.tUnit == null ? '' : w.tUnit) }));
    }
    return { tUnit: String(w.tUnit == null ? '' : w.tUnit), series, marks, hs, clip: spans(w.clip), slew: spans(w.slew) };
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
    if (!ts.length) ts.push(0, 1);
    const bt = mm(ts), t0 = bt[0] >= 0 && bt[0] <= 0.35 * bt[1] ? 0 : bt[0], t1 = bt[1] > t0 ? bt[1] : t0 + 1, lanes = {};
    names.forEach(n => { const b = mm(ys[n] || [0, 1]); lanes[n] = niceRange(b[0], b[1]); });
    return { t0, t1, lanes };
  }
  /* Wert einer Spur bei x. Steilflanken werden nicht geteilt: Ein Abschnitt zwischen zwei Stützstellen (oder zwei gleiche Zeitwerte) gilt als Flanke, wenn der Sprung über 25 % des
     Wertebereichs der Spur beträgt und der Abschnitt nicht länger als das 1,5-fache des mittleren Stützstellenabstands ist; auf der Flanke gilt der Wert danach, "step" nennt beide.
     Rückgabe { y, step: null | { from, to } } oder null außerhalb der Stützstellen / bei ungültigem x */
  function interp(points, x) {
    if (!Array.isArray(points) || !points.length || !fin(x)) return null;
    const n = points.length, t0 = points[0][0], t1 = points[n - 1][0], span = Math.abs(t1 - t0), edge = 1e-9 * Math.max(1, span, Math.abs(t1));
    if (x < t0 - edge || x > t1 + edge) return null;
    let lo = Infinity, hi = -Infinity; for (let i = 0; i < n; i++) { const y = points[i][1]; if (y < lo) lo = y; if (y > hi) hi = y; }
    const rng = hi - lo, mean = n > 1 ? span / (n - 1) : 0;
    const steep = (p, q) => { const dy = Math.abs(q[1] - p[1]), dt = q[0] - p[0]; return dy > 0.25 * rng && rng > 0 && dt <= 1.5 * mean + edge; };
    /* gleiche Zeitwerte: erster und letzter Punkt dieser Zeit */
    let a = -1, b = -1; for (let i = 0; i < n; i++) if (Math.abs(points[i][0] - x) <= edge) { if (a < 0) a = i; b = i; }
    if (a >= 0 && b > a) return { y: points[b][1], step: points[b][1] !== points[a][1] && Math.abs(points[b][1] - points[a][1]) > 0.02 * (rng || 1) ? { from: points[a][1], to: points[b][1] } : null };
    if (a >= 0) { const p = points[a], q = points[a + 1]; return { y: p[1], step: q && q[0] > p[0] && steep(p, q) ? { from: p[1], to: q[1] } : null }; }
    for (let i = 1; i < n; i++) {
      if (points[i][0] > x) {
        const p = points[i - 1], q = points[i], dx = q[0] - p[0];
        if (dx > 0 && steep(p, q)) return { y: q[1], step: { from: p[1], to: q[1] } };
        return { y: dx > 0 ? p[1] + (q[1] - p[1]) * (x - p[0]) / dx : q[1], step: null };
      }
    }
    return null;
  }
  /* Cursor-Werte aller gezeigten Spuren (und der Geisterspuren) bei x */
  function readout(c, names, ghost, x) {
    const rows = [];
    names.forEach(n => { const s = c.series.find(q => q.name === n); if (!s) return; const r = interp(s.points, x); rows.push({ name: n, unit: s.unit, y: r ? r.y : null, step: r ? r.step : null, ghost: false }); });
    if (ghost) names.forEach(n => { const s = ghost.series.find(q => q.name === n); if (!s) return; const r = interp(s.points, x); rows.push({ name: n, unit: s.unit, y: r ? r.y : null, step: r ? r.step : null, ghost: true }); });
    const txt = r => (r.ghost ? 'Vorher ' : '') + r.name + ' ' + (r.y == null ? 'außerhalb des Verlaufs' : (r.step ? 'springt von ' + withUnit(r.step.from, r.unit) + ' auf ' + withUnit(r.step.to, r.unit) : withUnit(r.y, r.unit)));
    const inBand = (c.clip || []).some(q => x >= q.t0 && x <= q.t1) ? ' – Ausgang begrenzt' : ((c.slew || []).some(q => x >= q.t0 && x <= q.t1) ? ' – Slew-Rate begrenzt die Steigung' : '');
    return { x, rows, text: 'Zeit ' + withUnit(x, c.tUnit) + ' – ' + rows.map(txt).join('; ') + inBand };
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
    if (refRig && refRig.rig && typeof refRig.rig === 'object') refRig = refRig.rig;
    if (!refRig || typeof refRig.waveform !== 'function' || (rigId && refRig.id && refRig.id !== rigId)) return null; let w = null; try { w = refRig.waveform(); } catch (e) { w = null; } return clean(w);
  }
  function chartSvg(c, names, ghost, g, showGhost, uid) {
    const o = [], b = g.b, tk = ticks(b.t0, b.t1, 5); uid = uid || 'anaWvClip';
    names.forEach((n, i) => {
      const s = c.series.find(q => q.name === n); if (!s) return; const top = g.laneTop(i), r = b.lanes[n], col = SER[i % SER.length];
      o.push('<defs><clipPath id="' + uid + i + '"><rect x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/></clipPath></defs>');
      o.push('<rect class="ana-wv-bg" x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/>');
      [['ana-wv-clip', c.clip], ['ana-wv-slew', c.slew]].forEach(bd => (bd[1] || []).forEach(q => { const x0 = Math.max(g.L, g.X(q.t0)), x1 = Math.min(g.L + g.pw, g.X(q.t1)); if (x1 > x0) o.push('<rect class="' + bd[0] + '" x="' + x0.toFixed(1) + '" y="' + top + '" width="' + (x1 - x0).toFixed(1) + '" height="' + g.lh + '"/>'); }));
      tk.forEach(t => { const x = g.X(t).toFixed(1); o.push('<line class="ana-wv-gr" x1="' + x + '" x2="' + x + '" y1="' + top + '" y2="' + (top + g.lh) + '"/>'); });
      ticks(r[0], r[1], 3).forEach(v => { const y = g.Y(i, v).toFixed(1); o.push('<line class="ana-wv-gr" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + y + '" y2="' + y + '"/><text class="ana-wv-tx" x="' + (g.L - 5) + '" y="' + (+y + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'); });
      if (r[0] < 0 && r[1] > 0) o.push('<line class="ana-wv-zero" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + g.Y(i, 0).toFixed(1) + '" y2="' + g.Y(i, 0).toFixed(1) + '"/>');
      (c.hs || []).forEach(m => { if ((m.series == null || (c.series[m.series] && c.series[m.series].name === n)) && m.y >= r[0] && m.y <= r[1]) o.push('<line class="ana-wv-mk" x1="' + g.L + '" x2="' + (g.L + g.pw) + '" y1="' + g.Y(i, m.y).toFixed(1) + '" y2="' + g.Y(i, m.y).toFixed(1) + '"/>'); });
      o.push('<rect class="ana-wv-fr" x="' + g.L + '" y="' + top + '" width="' + g.pw + '" height="' + g.lh + '"/>');
      o.push('<text class="ana-wv-nm" x="' + (g.L + 6) + '" y="' + (top + 14) + '" fill="' + col + '">' + esc(cut(n + (s.unit ? ' in ' + s.unit : ''), Math.floor(g.pw / 7))) + '</text>');
      o.push('<g clip-path="url(#' + uid + i + ')">');
      if (showGhost && ghost) { const gs = ghost.series.find(q => q.name === n); if (gs) o.push('<path class="ana-wv-gh" d="' + pathOf(gs.points, g.X, v => g.Y(i, v)) + '"/>'); }
      o.push('<path class="ana-wv-ln" stroke="' + col + '" d="' + pathOf(s.points, g.X, v => g.Y(i, v)) + '"/></g>');
    });
    const yb = g.T + g.n * g.lh + (g.n - 1) * g.gap;
    tk.forEach(t => { const x = g.X(t).toFixed(1); o.push('<text class="ana-wv-tx" x="' + x + '" y="' + (yb + 16) + '" text-anchor="middle">' + fv(t) + '</text>'); });
    o.push('<text class="ana-wv-ti" x="' + (g.L + g.pw / 2) + '" y="' + (g.h - 6) + '" text-anchor="middle">Zeit' + (c.tUnit ? ' in ' + esc(c.tUnit) : '') + '</text><g id="anaWvXh"></g>');
    return o.join('');
  }
  /* Überlagerung: Cursor (Linie plus Punkte) und Lauflinie (Punkte und dünne Linie) */
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
  const marksText = c => { if (!c) return ''; const a = c.marks.map(m => m.name + ' ' + withUnit(m.value, m.unit)); (c.hs || []).forEach(m => a.push((m.name || 'Marke') + ' ' + fv(m.y))); return a.join(' · '); };
  /* Ablesehilfe: Höchst- und Tiefstwert jeder gezeigten Spur aus den Daten des Prüfstands (die Verstärkung rechnest du selbst) */
  function peaks(c, names) {
    return names.map(n => { const s = c.series.find(q => q.name === n); if (!s) return null; const ys = s.points.map(p => p[1]), b = mm(ys); return { name: n, unit: s.unit, min: b[0], max: b[1] }; }).filter(Boolean);
  }
  const peaksText = r => r.map(p => p.name + ': ' + withUnit(p.min, p.unit) + ' bis ' + withUnit(p.max, p.unit)).join(' · ');
  /* CSV: Spur;Zeit;Wert;Zeit-Einheit;Einheit, Dezimalkomma, Felder mit ; oder " in Anführungszeichen */
  const cq = s => (/[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s);
  const cn = v => String(+v.toPrecision(9)).replace('.', ',');
  function toCsv(c, title, ghost) {
    const rows = ['# Tonfunk Analogtechnik-Lab;Verläufe;' + cq(title || '') + ';Übungswerte, Lehrdarstellung', 'Spur;Zeit;Wert;Zeit-Einheit;Einheit'];
    if (!c) return rows.join('\r\n') + '\r\n';
    c.series.forEach(s => s.points.forEach(p => rows.push([cq(s.name), cn(p[0]), cn(p[1]), cq(c.tUnit), cq(s.unit)].join(';'))));
    if (ghost) ghost.series.forEach(s => s.points.forEach(p => rows.push([cq('Vorher: ' + s.name), cn(p[0]), cn(p[1]), cq(ghost.tUnit), cq(s.unit)].join(';'))));
    return rows.join('\r\n') + '\r\n';
  }
  /* CSV zurücklesen (Roundtrip-Test): Liste { name, t, y, tUnit, unit } */
  function parseCsv(txt) {
    const out = []; String(txt || '').split(/\r?\n/).forEach(l => {
      if (!l || l[0] === '#' || /^Spur;/.test(l)) return; const f = []; let cur = '', q = false;
      for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ';') { f.push(cur); cur = ''; } else cur += ch; }
      f.push(cur); if (f.length < 5) return; const t = +f[1].replace(',', '.'), y = +f[2].replace(',', '.'); if (fin(t) && fin(y)) out.push({ name: f[0], t, y, tUnit: f[3], unit: f[4] });
    }); return out;
  }
  /* Wertetabelle: gleichmäßig ausgewählte Zeitpunkte (ohne doppelte Zeiten), Werte nach der Steilflanke */
  function tableRows(c, names, max) {
    const xs = []; c.series.forEach(s => { if (names.indexOf(s.name) >= 0) s.points.forEach(p => { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); }); }); xs.sort((a, b) => a - b);
    const step = Math.max(1, Math.ceil(xs.length / (max || 24))), pick = xs.filter((v, i) => i % step === 0 || i === xs.length - 1);
    return pick.map(x => ({ x, ys: names.map(n => { const s = c.series.find(q => q.name === n), r = s ? interp(s.points, x) : null; return r ? r.y : null; }) }));
  }
  /* Nächste Stützzeit links oder rechts von x (für die Pfeiltasten: jede Flanke wird angefahren, nichts wird übersprungen); stride = Anzahl Stützstellen je Tastendruck */
  function stepTime(c, names, x, dir, stride) {
    const xs = []; c.series.forEach(s => { if (names.indexOf(s.name) >= 0) s.points.forEach(p => { if (xs.indexOf(p[0]) < 0) xs.push(p[0]); }); }); xs.sort((a, b) => a - b); if (!xs.length) return x;
    if (!fin(x)) return dir > 0 ? xs[0] : xs[xs.length - 1];
    const k = Math.max(1, Math.round(stride || 1)), eps = 1e-12 * Math.max(1, Math.abs(x)), last = xs.length - 1; let j;
    if (dir > 0) { j = xs.findIndex(v => v > x + eps); j = j < 0 ? last : Math.min(last, j + k - 1); }
    else { j = -1; for (let i = 0; i <= last; i++) if (xs[i] < x - eps) j = i; j = j < 0 ? 0 : Math.max(0, j - (k - 1)); }
    return xs[j];
  }

  /* ============================================================ Oberfläche */
  let A = null, H = null;
  const st = { rigId: null, sel: null, ghost: true, frozen: false, slow: false, table: false, x: null, pos: 0, t: 0, g: null, c: null, names: [], gh: null, w: 0, sig: '', n: 0 };
  const CSS = '.ana-wv-wrap{touch-action:pan-y;position:relative}.ana-wv-svg{display:block;width:100%;height:auto;border-radius:8px;outline:none}.ana-wv-svg:focus-visible{outline:2px solid var(--accent)}.ana-wv-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px}' +
    '.ana-wv-bg{fill:var(--well)}.ana-wv-fr{fill:none;stroke:var(--chart-axis);stroke-width:1}.ana-wv-gr{stroke:var(--chart-grid);stroke-width:1}.ana-wv-zero{stroke:var(--chart-axis);stroke-width:1;stroke-dasharray:2 3}.ana-wv-mk{stroke:var(--mute);stroke-width:1;stroke-dasharray:6 3}.ana-wv-tx{fill:var(--mute);font-size:12px;font-variant-numeric:tabular-nums}.ana-wv-ti{fill:var(--fg);font-size:12px}.ana-wv-nm{font-size:12px;font-weight:700}' +
    '.ana-wv-ln{fill:none;stroke-width:2.4;stroke-linejoin:round}.ana-wv-gh{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-dasharray:3 3;opacity:.85}.ana-wv-xh{stroke:var(--fg);stroke-width:1;opacity:.75}.ana-wv-sc{stroke:var(--mute);stroke-width:1;stroke-dasharray:2 3}.ana-wv-clip{fill:var(--bad-fg);opacity:.18}.ana-wv-slew{fill:var(--accent);opacity:.16}' +
    '.ana-wv-leg{list-style:none;margin:8px 0 0;padding:0;display:flex;flex-wrap:wrap;gap:4px 14px;font-size:13px}.ana-wv-leg li{display:flex;align-items:center;gap:6px;min-height:24px}.ana-wv-sw{width:30px;height:12px;flex:none}.ana-wv-read{min-height:44px;margin-top:8px;font-size:13.5px;font-variant-numeric:tabular-nums}.ana-wv-deep svg{display:block;width:100%;height:auto}';
  function css() { try { if (typeof document !== 'undefined' && document.head && !document.getElementById('anaWaveCss')) { const s = document.createElement('style'); s.id = 'anaWaveCss'; s.textContent = CSS; document.head.appendChild(s); } } catch (e) { /* ohne Stil */ } }
  const refRigOf = () => { try { let o = A && typeof A.refRig === 'function' ? A.refRig() : (A && A.refRig && typeof A.refRig === 'object' ? A.refRig : null); if (!o && A && A.S) o = A.S.refRig || null; return o && o.rig && typeof o.rig === 'object' ? o.rig : o; } catch (e) { return null; } };
  const rigWave = () => { let w = null; try { w = A && A.rig && typeof A.rig.waveform === 'function' ? A.rig.waveform() : null; } catch (e) { w = null; } return clean(w); };
  const swatch = (i, gh) => '<svg class="ana-wv-sw" viewBox="0 0 30 12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" stroke="' + (gh ? 'var(--mute)' : SER[i % SER.length]) + '" stroke-width="3"' + (gh ? ' stroke-dasharray="3 3"' : '') + '/></svg>';
  function legend(c, names, ghost, showGhost) {
    const li = names.map((n, i) => { const s = c.series.find(q => q.name === n); return '<li>' + swatch(i) + esc(n + (s && s.unit ? ' in ' + s.unit : '')) + '</li>'; });
    if (showGhost && ghost) li.push('<li>' + swatch(0, true) + 'Geisterspur: Vorher</li>');
    if (c.clip && c.clip.length) li.push('<li>roter Streifen: Ausgang begrenzt</li>'); if (c.slew && c.slew.length) li.push('<li>blauer Streifen: Slew-Rate begrenzt</li>');
    return '<ul class="ana-wv-leg" aria-label="Legende">' + li.join('') + '</ul>';
  }
  function tableHtml(c, names) {
    const rows = tableRows(c, names, 24);
    return '<details class="card" id="anaWvTab"' + (st.table ? ' open' : '') + '><summary>Wertetabelle (Alternative zum Bild)</summary><div class="cb"><table class="kt"><tr><th class="n">Zeit' + (c.tUnit ? ' [' + esc(c.tUnit) + ']' : '') + '</th>' + names.map(n => { const s = c.series.find(q => q.name === n); return '<th class="n">' + esc(n + (s && s.unit ? ' [' + s.unit + ']' : '')) + '</th>'; }).join('') + '</tr>' +
      rows.map(r => '<tr><td class="n">' + fv(r.x) + '</td>' + r.ys.map(y => '<td class="n">' + (y == null ? '–' : fv(y)) + '</td>').join('') + '</tr>').join('') + '</table></div></details>';
  }
  const HINT = '<p class="hint2">Trigger und Messbereich übst du im <a href="messlab.html">MessLab</a>; hier schaust du nur, wie sich die Verläufe mit deinen Einstellungen ändern und liest Amplitude und Periodendauer ab.</p>';
  /* ---- Vertiefung "Slew-Rate": Verlauf der Anlage und derselben Anlage mit idealem Operationsverstärker, Rechenzeile aus deep.slew ---- */
  function cloneRig(opv) {
    try {
      const R = root.ANA_RIGS, rig = A && A.rig; if (!R || !R.defs || !rig || !R.defs[rig.id]) return null;
      const r = R.defs[rig.id].create({ seed: 1 }); if (typeof rig.snapshot === 'function' && typeof r.restore === 'function') r.restore(rig.snapshot());
      if (typeof r.setControl === 'function') r.setControl('opv', opv); return r;
    } catch (e) { return null; }
  }
  const curOpv = () => { try { const v = A.rig.getControl('opv'); return v === 'langsam' || v === 'schnell' ? v : 'ideal'; } catch (e) { return 'ideal'; } };
  function slewData() {
    if (!A || !A.rig || SLEWRIGS.indexOf(A.rig.id) < 0) return null;
    const real = curOpv() === 'ideal' ? 'langsam' : curOpv(), a = cloneRig(real), b = cloneRig('ideal'); if (!a || !b) return null;
    let wa = null, wb = null; try { wa = clean(a.waveform()); wb = clean(b.waveform()); } catch (e) { return null; } if (!wa || !wb) return null;
    const ua = wa.series.find(s => /^u_a/.test(s.name)) || wa.series[wa.series.length - 1], ub = wb.series.find(s => /^u_a/.test(s.name)) || wb.series[wb.series.length - 1], ue = wa.series[0];
    let f = NaN; try { f = A.rig.getControl('f'); } catch (e) { f = NaN; }
    const uhat = Math.max.apply(null, ub.points.map(p => Math.abs(p[1]))), C = root.ANA_CORE; let ds = null;
    try { ds = C && C.deep && typeof C.deep.slew === 'function' ? C.deep.slew({ opv: real, uhat, f }) : null; } catch (e) { ds = null; }
    return { real, ideal: curOpv() === 'ideal', wa, wb, ua, ub, ue, f, uhat, text: ds && ds.text ? ds.text : '', valid: !!(ds && ds.valid !== false), clipA: wa.clip, slewA: wa.slew, hasSlew: wa.slew.length > 0 };
  }
  function slewSvg(d) {
    const w = 400, h = 190, L = 50, R = 10, T = 8, B = 40, pw = w - L - R, ph = h - T - B; if (!d) return '';
    const ser = [{ s: d.ue, c: SER[0], dash: '', nm: d.ue.name }, { s: d.ua, c: SER[1], dash: '', nm: d.ua.name + ' mit Slew-Rate' }, { s: d.ub, c: SER[2], dash: '6 4', nm: d.ub.name + ' ideal' }];
    const ts = []; ser.forEach(q => q.s.points.forEach(p => ts.push(p[0]))); const bt = mm(ts), ys = []; ser.forEach(q => q.s.points.forEach(p => ys.push(p[1]))); const yr = niceRange.apply(null, mm(ys)), t0 = bt[0], t1 = bt[1] > bt[0] ? bt[1] : bt[0] + 1;
    const X = t => L + (t - t0) / (t1 - t0) * pw, Y = v => T + ph - (v - yr[0]) / (yr[1] - yr[0]) * ph, o = [];
    o.push('<rect class="ana-wv-bg" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/>');
    (d.slewA || []).forEach(q => { const x0 = Math.max(L, X(q.t0)), x1 = Math.min(L + pw, X(q.t1)); if (x1 > x0) o.push('<rect class="ana-wv-slew" x="' + x0.toFixed(1) + '" y="' + T + '" width="' + (x1 - x0).toFixed(1) + '" height="' + ph + '"/>'); });
    ticks(yr[0], yr[1], 4).forEach(v => o.push('<line class="ana-wv-gr" x1="' + L + '" x2="' + (L + pw) + '" y1="' + Y(v).toFixed(1) + '" y2="' + Y(v).toFixed(1) + '"/><text class="ana-wv-tx" x="' + (L - 5) + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="end">' + fv(v) + '</text>'));
    ticks(t0, t1, 4).forEach(v => o.push('<text class="ana-wv-tx" x="' + X(v).toFixed(1) + '" y="' + (T + ph + 16) + '" text-anchor="middle">' + fv(v) + '</text>'));
    o.push('<rect class="ana-wv-fr" x="' + L + '" y="' + T + '" width="' + pw + '" height="' + ph + '"/>');
    ser.forEach(q => o.push('<path class="ana-wv-ln" stroke="' + q.c + '"' + (q.dash ? ' stroke-dasharray="' + q.dash + '"' : '') + ' d="' + pathOf(q.s.points, X, Y) + '"/>'));
    o.push('<text class="ana-wv-ti" x="' + (L + pw / 2) + '" y="' + (h - 6) + '" text-anchor="middle">Zeit in ' + esc(d.wa.tUnit) + ', Spannung in ' + esc(d.ua.unit || 'V') + '</text>');
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc('Ausgang mit Slew-Rate und mit idealem Operationsverstärker im Vergleich: ' + ser.map(q => q.nm + ' Spitze ' + withUnit(Math.max.apply(null, q.s.points.map(p => Math.abs(p[1]))), q.s.unit)).join('; ')) + '">' + o.join('') + '</svg>' +
      '<ul class="ana-wv-leg">' + ser.map(q => '<li><svg class="ana-wv-sw" viewBox="0 0 30 12" aria-hidden="true"><line x1="1" x2="29" y1="6" y2="6" stroke="' + q.c + '" stroke-width="3"' + (q.dash ? ' stroke-dasharray="' + q.dash + '"' : '') + '/></svg>' + esc(q.nm) + '</li>').join('') + '</ul>';
  }
  function deepHtml() {
    if (!A || !A.rig || SLEWRIGS.indexOf(A.rig.id) < 0) return '';
    const open = deepGet('slew'), d = open ? slewData() : null;
    const body = !open ? '' : (d ? '<div class="ana-wv-deep">' + slewSvg(d) +
      '<p class="hint2">' + (d.ideal ? 'Der Prüfstand steht auf dem idealen Operationsverstärker; zum Vergleich ist die ' + esc(d.real) + 'e Klasse gerechnet. ' : '') + (d.hasSlew ? 'Im blauen Streifen begrenzt die Slew-Rate die Steigung des Ausgangs.' : 'Bei dieser Amplitude und Frequenz begrenzt die Slew-Rate den Ausgang nicht.') + ' Der ideale Operationsverstärker kennt weder Slew-Rate noch Bandbreitengrenze.</p>' +
      (d.text ? '<p class="ex">' + esc(d.text) + '</p>' : '<p class="hint2">Für den idealen Operationsverstärker gibt es keine Rechenzeile.</p>') + '</div>' : '<p class="hint2">Für diese Einstellung gibt es keinen Vergleich.</p>');
    return '<details class="ana-vertiefung card" data-deep="slew"' + (open ? ' open' : '') + '><summary>Vertiefung: Slew-Rate&nbsp;<span class="bdg uw">Vertiefung</span></summary>' + body + '</details>';
  }
  function deepGet(k) { try { if (A && A.deep && typeof A.deep.get === 'function') { const d = A.deep.get(); return !!(d && d[k]); } if (A && typeof A.lsGet === 'function') { const d = A.lsGet('ana.deep', {}); return !!(d && d[k]); } } catch (e) { /* zu */ } return false; }
  function deepSet(k, v) {
    try {
      if (A && A.deep && typeof A.deep.set === 'function') { if (deepGet(k) !== !!v) A.deep.set(k, !!v); return true; }
      if (A && typeof A.lsGet === 'function' && typeof A.lsSet === 'function') { const d = A.lsGet('ana.deep', {}), o = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; if (!!o[k] !== !!v) { o[k] = !!v; if (v) o.n = (+o.n || 0) + 1; A.lsSet('ana.deep', o); } return true; }
    } catch (e) { /* kein Absturz */ }
    return false;
  }
  function html() {
    const rig = A && A.rig;
    if (!rig) return '<div class="card pl"><p class="big">Kein Prüfstand</p><p class="hint2">Wähle im Tab Prüfstand einen Prüfstand, dann zeigt dieser Tab seine Verläufe.</p><div class="btns"><button class="btn" data-act="rig">Zum Prüfstand</button></div></div>';
    if (st.rigId !== rig.id) { st.rigId = rig.id; st.sel = null; st.x = null; st.pos = 0; }
    const c = rigWave();
    if (!c) { st.c = null; st.g = null; return '<div class="card pl"><p class="big">Kein Verlauf</p><p class="hint2">' + (rig.id === 'diode' ? 'Kein Zeitverlauf: Dioden, LED und Z-Diode arbeiten hier mit Gleichgrößen. ' : 'Dieser Prüfstand zeigt keinen Zeitverlauf (oder die Einstellung lässt keinen zu). ') + 'Die Ampel und die Meldungen im Tab Prüfstand sagen mehr dazu; die Kennlinie (Strom über Spannung, Arbeitspunkt) findest du im Tab Kennlinien.</p><div class="btns"><button class="btn" data-act="curve">Zu den Kennlinien</button><button class="btn" data-act="rig">Zum Prüfstand</button></div>' + HINT + '</div>'; }
    const names = pickNames(c, st.sel); st.sel = names;
    const ghost = ghostOf(refRigOf(), rig.id), wEl = H && H.clientWidth ? H.clientWidth - 26 : 640, g = geom(c, names, ghost, wEl);
    st.c = c; st.names = names; st.gh = ghost; st.g = g; st.w = wEl; st.sig = sigOf(c, ghost);
    const hasRef = !!(A.ref || (A.S && A.S.ref)), mk = marksText(c), still = reduced(), pk = peaksText(peaks(c, names));
    return '<div class="card pl"><h4>Verläufe: ' + esc(typeof A.rigName === 'function' ? A.rigName(rig.id) : rig.id) + '</h4>' +
      (c.series.length > 1 ? '<div class="ana-wv-chips" role="group" aria-label="Spuren wählen (höchstens vier)">' + c.series.map(s => '<button class="chip' + (names.indexOf(s.name) >= 0 ? ' on' : '') + '" data-sr="' + esc(s.name) + '" aria-pressed="' + (names.indexOf(s.name) >= 0) + '">' + esc(cut(s.name + (s.unit ? ' (' + s.unit + ')' : ''), 24)) + '</button>').join('') + '</div>' : '') +
      '<div class="ana-wv-wrap"><svg class="ana-wv-svg" id="anaWvSvg" viewBox="0 0 ' + g.w + ' ' + g.h + '" role="img" tabindex="0" aria-label="' + esc('Verläufe: ' + names.join(', ') + '. ' + (mk ? mk + '. ' : '') + 'Mit den Pfeiltasten wanderst du über die Zeit.') + '">' + chartSvg(c, names, ghost, g, st.ghost) + '</svg></div>' +
      '<div class="ana-wv-read" id="anaWvRead" role="status" aria-live="polite"></div>' +
      legend(c, names, ghost, st.ghost) + (mk ? '<div class="ex" style="margin-top:8px">Marken: ' + esc(mk) + '</div>' : '') + (pk ? '<div class="ex" style="margin-top:8px">Ablesen: ' + esc(pk) + '</div>' : '') +
      '<div class="btns"><button class="btn" data-act="freeze" aria-pressed="' + st.frozen + '">' + (st.frozen ? 'Lauflinie weiterlaufen lassen' : 'Einfrieren') + '</button><button class="btn" data-act="slow" aria-pressed="' + st.slow + '">' + (st.slow ? 'Zeitlupe aus' : 'Zeitlupe') + '</button>' +
      (hasRef ? '<button class="btn" data-act="ghost" aria-pressed="' + st.ghost + '">' + (st.ghost ? 'Geisterspur ausblenden' : 'Geisterspur einblenden') + '</button>' : '') +
      '<button class="btn" data-act="table" aria-pressed="' + st.table + '">' + (st.table ? 'Tabelle schließen' : 'Wertetabelle zeigen') + '</button><button class="btn" data-act="csv">Verlauf als CSV</button></div>' +
      (hasRef ? '' : '<p class="hint2">Mit „Merken“ (Taste M) im Prüfstand legst du einen Vorher-Stand fest; er erscheint hier als Geisterspur.</p>') +
      (still ? '<p class="hint2">Die Lauflinie steht, weil dein Gerät reduzierte Bewegung wünscht. Der Cursor funktioniert trotzdem.</p>' : '') +
      HINT + '<p class="hint2">' + esc(NOTE) + '</p></div>' + deepHtml() + tableHtml(c, names);
  }
  function reduced() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  /* Kennung der Daten: ändert sie sich, wird neu gezeichnet (Steuerwerte, Vorher-Stand) */
  function sigOf(c, ghost) {
    const f = q => (q ? q.series.map(s => s.name + ':' + s.points.length + ':' + (s.points.reduce((a, p, i) => a + p[0] * 0.37 + p[1] * (1 + i % 7) + p[1] * p[1], 0)).toPrecision(9)).join('|') : '-');
    return f(c) + '#' + f(ghost) + '#' + st.names.join(',');
  }
  function paint() { if (!H) return; css(); H.innerHTML = html(); H.dataset.wv = '1'; st.n++; drawOverlay(); }
  /* Wert der Lesezeile: Cursor, sonst Stellung der Lauflinie */
  function scanX() { return st.g ? st.g.b.t0 + st.pos * (st.g.b.t1 - st.g.b.t0) : null; }
  function drawOverlay() {
    if (!H || !st.c || !st.g) return;
    const xh = H.querySelector('#anaWvXh'), rd = H.querySelector('#anaWvRead'), gh = st.ghost ? st.gh : null, cur = fin(st.x) ? st.x : null, sx = scanX();
    if (xh) xh.innerHTML = (cur == null ? crossSvg(st.c, st.names, st.g, sx, 'ana-wv-sc') : crossSvg(st.c, st.names, st.g, cur, 'ana-wv-xh'));
    if (rd) rd.textContent = cur != null ? readout(st.c, st.names, gh, cur).text : (fin(sx) ? 'Lauflinie: ' + readout(st.c, st.names, gh, sx).text + ' (Tippe oder fahre über das Bild für den Cursor.)' : '');
  }
  function setX(x) { st.x = fin(x) ? x : null; drawOverlay(); }
  function pointerX(e) {
    const svg = H.querySelector('#anaWvSvg'); if (!svg || !st.g) return null;
    const r = typeof svg.getBoundingClientRect === 'function' ? svg.getBoundingClientRect() : null; if (!r || !(r.width > 0)) return null;
    return st.g.tAt((e.clientX - r.left) * (st.g.w / r.width));
  }
  function saveCsv(txt) {
    const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
    if (root.LabExport && root.LabExport.saveBlob) { try { root.LabExport.saveBlob(blob, root.LabExport.fname ? root.LabExport.fname('csv') : 'ana-verlauf.csv'); return; } catch (e) { /* Rückfall */ } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'ana-verlauf.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
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
    else if (a === 'freeze') { st.frozen = !st.frozen; paint(); } else if (a === 'slow') { st.slow = !st.slow; paint(); } else if (a === 'rig' && A) A.setTab('rig'); else if (a === 'curve' && A) A.setTab('curve');
  }
  function onKey(e) {
    if (!st.g || !st.c || !e.target || !e.target.closest || !e.target.closest('#anaWvSvg')) return;
    const k = e.key, g = st.g; if (k === 'Escape') { setX(null); return; }
    if (k !== 'ArrowLeft' && k !== 'ArrowRight' && k !== 'Home' && k !== 'End') return;
    if (e.preventDefault) e.preventDefault();
    if (k === 'Home') { setX(g.b.t0); return; } if (k === 'End') { setX(g.b.t1); return; }
    const total = st.c.series[0] ? st.c.series[0].points.length : 60;
    setX(stepTime(st.c, st.names, st.x, k === 'ArrowRight' ? 1 : -1, e.shiftKey ? 1 : Math.max(1, Math.round(total / 60))));
  }
  function render(host, api) {
    A = api; H = host; st.t = Date.now();
    once(host, 'c', 'click', onClick); once(host, 'm', 'pointermove', e => { if (e.target && e.target.closest && e.target.closest('#anaWvSvg') && (e.pointerType !== 'touch' || e.buttons)) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'd', 'pointerdown', e => { if (e.target && e.target.closest && e.target.closest('#anaWvSvg')) { const x = pointerX(e); if (x != null) setX(x); } });
    once(host, 'k', 'keydown', onKey);
    once(host, 'tg', 'toggle', e => { const d = e.target; if (d && d.dataset && d.dataset.deep === 'slew') { deepSet('slew', !!d.open); if (d.open) paint(); } });
    if (typeof ResizeObserver === 'function' && !host.__anawvRo) { host.__anawvRo = new ResizeObserver(() => redraw()); try { host.__anawvRo.observe(host); } catch (e) { /* ohne */ } }
    paint();
  }
  /* wird vom Rahmen alle 250 ms gerufen, solange der Prüfstand läuft: Lauflinie weiterschieben, bei geänderten Daten neu zeichnen */
  function update(host, api) {
    if (api) A = api; if (host) H = host; if (!H || !A) return;
    const now = Date.now(), dt = st.t ? (now - st.t) / 1000 : 0; st.t = now;
    const c = rigWave(); if (!c !== !st.c) { paint(); return; }
    if (c) { const gh = ghostOf(refRigOf(), A.rig.id); if (sigOf(c, gh) !== st.sig) { paint(); return; } }
    if (!st.frozen && st.c && !reduced()) { const sp = A.S && fin(A.S.speed) && A.S.speed > 0 ? A.S.speed : 1; st.pos = advance(st.pos, dt, sp * (st.slow ? SLOW : 1)); drawOverlay(); }
  }
  function redraw() { if (!H || !A || !H.clientWidth) return; if (Math.abs(H.clientWidth - 26 - st.w) > 8 || !H.dataset.wv) paint(); }
  function refresh() { paint(); }

  E.wave = { render, update, refresh, redraw, fn: { fv, clean, pickNames, niceRange, ticks, bounds, interp, readout, geom, ghostOf, chartSvg, crossSvg, legend, advance, marksText, peaks, peaksText, toCsv, parseCsv, tableRows, tableHtml, html, sigOf, stepTime, slewData, slewSvg, deepHtml, state: st, NOTE, SLEWRIGS, setApi: a => { A = a; } } };
  if (typeof module !== 'undefined') module.exports = E.wave;
})(typeof window !== 'undefined' ? window : globalThis);
