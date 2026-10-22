'use strict';
/* Tonfunk Energie-Lab: Tab "Lernen" (WP4c, SPEC 6.6/6.7).
   17 ausklappbare Abschnitte mit SVG-Zeichnungen und "Probier es aus"-Knopf (lädt ein Beispiel enx1…enx32 über api.loadExample oder wechselt den Tab).
   Tabellen, Formeln und Zahlen kommen aus dem Kern (ENR_CORE) und den Tabellen des Labs: Aufbau aus pv.build, Modulwerte aus pv.keys/tempCoeff/datasheet,
   Verschattung aus pv.analyze/shade, Sonne aus sun.*, Akku aus batt.defaults/cycleLife, Wechselrichter aus inv.*, Formeln aus calc.formulas (explain, also immer wie der Rechner),
   Glossar aus glossary, Tastenkürzel aus api.KEYS (sonst window.ENR_KEYS). Es gibt keine zweite Pflege von Formeln oder Tabellen (SPEC Regel 5 und 7);
   jede Zahl im Text wird hier aus einer Kernfunktion erzeugt (Regel 1). Fehlt ein Teil des Kerns, steht an der Stelle der Zahl ein Strich und ein Hinweis.
   Schnittstelle (SPEC 6.7): window.ENR_UI_EXT.help.render(host, api). Reine Funktionen unter ENR_UI_EXT.help.fn. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ENR_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fa = v => (fin(v) ? (Number.isInteger(v) ? String(v) : fnum(v, adig(v))) : '–');
  const pc = v => (fin(v) ? fnum(100 * v, Math.abs(100 * v) >= 10 ? 0 : 1) + ' %' : '–');
  const tryf = (f, d) => { try { const r = f(); return r === undefined || r === null ? d : r; } catch (e) { return d; } };
  let A = null;

  /* ============================================================ SVG-Helfer (Farben über Seitenvariablen, Schrift mindestens 12 bei 360 Einheiten Breite) */
  const VBW = 360;
  const SV = (inner, label, vb) => `<svg class="dr" viewBox="${vb || '0 0 360 150'}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  const FILL = { fg: 'var(--fg)', mute: 'var(--mute)', acc: 'var(--accent)', warn: 'var(--warn)', ok: 'var(--ok)', bad: 'var(--danger)', panel: 'var(--panel2)' };
  /* Text: Breite grob schätzen und die Schrift verkleinern, damit nichts über den Bildrand läuft (nie unter 12) */
  function TX(x, y, t, o) {
    o = o || {}; let s = o.s || 12.5; const w = String(t).length * s * 0.56, max = o.max || 0;
    if (max && w > max) s = Math.max(12, s * max / w);
    return `<text x="${x}" y="${y}" style="fill:${FILL[o.c] || o.c || FILL.fg}" font-size="${s.toFixed(1)}" text-anchor="${o.a || 'middle'}" font-family="system-ui"${o.w ? ' font-weight="700"' : ''}>${esc(t)}</text>`;
  }
  const RECT = (x, y, w, h, c, o) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${(o && o.r) || 4}" style="fill:${c};stroke:${(o && o.stroke) || FILL.mute};stroke-width:${(o && o.sw) || 1.2}"/>`;
  const LINE = (x0, y0, x1, y1, c, o) => `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="stroke:${c || FILL.mute};stroke-width:${(o && o.w) || 1.6}"${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  const ARR = (x0, y0, x1, y1, c) => { const a = Math.atan2(y1 - y0, x1 - x0), h = 7; return `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" style="stroke:${c || FILL.warn};stroke-width:2.4"/><path d="M${x1} ${y1} L${(x1 - h * Math.cos(a - 0.45)).toFixed(1)} ${(y1 - h * Math.sin(a - 0.45)).toFixed(1)} L${(x1 - h * Math.cos(a + 0.45)).toFixed(1)} ${(y1 - h * Math.sin(a + 0.45)).toFixed(1)}Z" style="fill:${c || FILL.warn}"/>`; };
  const POLY = (pts, c, o) => `<polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" style="fill:none;stroke:${c};stroke-width:${(o && o.w) || 2.4}"${o && o.dash ? ` stroke-dasharray="${o.dash}"` : ''}/>`;
  const DOT = (x, y, c, r) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r || 4.5}" style="fill:${c}"/>`;

  /* Diagrammrahmen mit Achsen: gibt { frame, X, Y } zurück (Plotfläche L,T,W,H) */
  function frame(xmax, ymax, o) {
    o = o || {}; const L = o.L || 46, T = 10, W = o.W || 296, H = o.H || 110, X = x => L + W * x / xmax, Y = y => T + H * (1 - y / ymax);
    let g = `<rect x="${L}" y="${T}" width="${W}" height="${H}" style="fill:none;stroke:${FILL.mute}"/>`;
    (o.xt || []).forEach(t => { g += LINE(X(t[0]), T + H, X(t[0]), T + H + 4, FILL.mute, { w: 1 }) + TX(X(t[0]), T + H + 16, t[1], { c: 'mute', s: 12, max: 60 }); });
    (o.yt || []).forEach(t => { g += LINE(L - 4, Y(t[0]), L, Y(t[0]), FILL.mute, { w: 1 }) + TX(L - 6, Y(t[0]) + 4, t[1], { a: 'end', c: 'mute', s: 12, max: 40 }); });
    if (o.xl) g += TX(L + W / 2, T + H + 32, o.xl, { c: 'mute', s: 12, max: W });
    return { g, X, Y, L, T, W, H };
  }

  /* ============================================================ Zahlen für die Abschnitte (alle aus Kernfunktionen) */
  const SPEC = 'si60';
  const KLEIN = 'si36';
  const NOCORE = '<p class="hint2" style="color:var(--warn)">Die Zahlen folgen, sobald der Rechenkern (enrcore.js) geladen ist.</p>';
  function FX(id, ...v) { const C = CORE(), f = C && C.calc && C.calc.formulas && C.calc.formulas.get ? tryf(() => C.calc.formulas.get(id), null) : null; if (!f || typeof f.explain !== 'function') return null; const r = tryf(() => f.explain(...v), null); return r && r.ok !== false && fin(r.value) ? r : null; }
  const formulaDefs = id => { const C = CORE(), f = C && C.calc && C.calc.formulas && C.calc.formulas.get ? tryf(() => C.calc.formulas.get(id), null) : null; return f ? f.inputs.map(i => i.def) : []; };
  const FXd = id => FX(id, ...formulaDefs(id)); /* Formel mit ihren Standardwerten (Beispiel aus dem Kern) */
  const keysOf = (id, G, Tc) => { const C = CORE(), k = C && C.pv && C.pv.keys ? tryf(() => C.pv.keys(id, { G, Tc }), null) : null; return k && k.ok !== false ? k : null; };
  function data() {
    const C = CORE(); if (!C || !C.pv || !C.sun) return null; const D = { lat: C.sun.sites && C.sun.sites.mitte ? C.sun.sites.mitte.lat : 51.7 };
    D.zelle = keysOf('zelle', 1000, 25); D.zelleSpec = tryf(() => C.pv.spec('zelle'), null); D.k = keysOf(SPEC, 1000, 25); D.k36 = keysOf(KLEIN, 1000, 25);
    D.tc = tryf(() => C.pv.tempCoeff(SPEC), null); D.ds = tryf(() => C.pv.datasheet(SPEC), null);
    D.spec = tryf(() => C.pv.spec(SPEC), null); D.specK = tryf(() => C.pv.spec(KLEIN), null); D.build = Array.isArray(C.pv.build) ? C.pv.build : [];
    D.curve = tryf(() => C.pv.curve(SPEC, { G: 1000, Tc: 25 }, { points: 80 }), null);
    D.rMpp = D.k && fin(D.k.Umpp) && D.k.Impp > 0 ? D.k.Umpp / D.k.Impp : NaN;
    D.g = [200, 500, 1000].map(G => ({ G, k: keysOf(SPEC, G, 25), cv: tryf(() => C.pv.curve(SPEC, { G, Tc: 25 }, { points: 60 }), null) }));
    D.t = [0, 25, 65].map(T => ({ T, k: keysOf(SPEC, 1000, T) }));
    D.cold = keysOf(SPEC, 1000, -10); D.hot = keysOf(SPEC, 1000, 60);
    D.serie = D.k ? FX('serie', 4, D.k.Uoc) : null; D.par = D.k ? FX('parallel', 3, D.k.Isc) : null;
    D.smax = D.cold ? FX('stringMax', D.cold.Uoc, 500) : null; D.smin = D.hot ? FX('stringMin', D.hot.Umpp, 150) : null;
    D.ff = D.k ? FX('ff', D.k.Pmpp, D.k.Uoc, D.k.Isc) : null; D.etaPv = D.k && D.spec ? FX('etaPv', D.k.Pmpp, 1000, D.spec.A) : null;
    /* Verschattung: Laubblatt, Hecke von unten (hochkant gegen quer), ohne Bypassdiode */
    const an = (orient, bypass, kind, p) => tryf(() => C.pv.analyze({ spec: SPEC, ns: 1, np: 1, cond: { G: 1000, Tc: 25, fd: 0.1 }, shade: { kind, p, orient, dunkel: 1, wer: 'alle', seed: 1 }, bypass }, {}), null);
    D.blatt = an('hochkant', 'ok', 'blatt', { col: 2, row: 9 }); D.blattOhne = an('hochkant', 'fehlt', 'blatt', { col: 2, row: 9 });
    D.heckeH = an('hochkant', 'ok', 'kante', { frac: 0.1 }); D.heckeQ = an('quer', 'ok', 'kante', { frac: 0.1 });
    D.mkH = tryf(() => C.pv.shade.make(SPEC, 'hochkant', 'kante', { frac: 0.1, dunkel: 1 }), null); D.mkQ = tryf(() => C.pv.shade.make(SPEC, 'quer', 'kante', { frac: 0.1, dunkel: 1 }), null);
    D.hotLim = C.pv.hotspotLimits || null;
    D.noonDec = tryf(() => C.sun.position(355, 12, D.lat), null);
    D.obst = D.noonDec ? tryf(() => C.pv.shade.obstacle({ H: 1.5, D: 3, z0: 0.5, l: D.spec ? 1.65 : 1.65, beta: 35, alt: D.noonDec.alt, az: 0, gam: 0 }), null) : null;
    D.noonJun = tryf(() => C.sun.position(172, 12, D.lat), null);
    D.obstJun = D.noonJun ? tryf(() => C.pv.shade.obstacle({ H: 1.5, D: 3, z0: 0.5, l: 1.65, beta: 35, alt: D.noonJun.alt, az: 0, gam: 0 }), null) : null;
    D.quer = tryf(() => C.pv.array({ spec: SPEC, ns: 1, np: 1, cond: { G: 1000, Tc: 25, fd: 0.1 }, shade: { kind: 'kante', p: { frac: 0.1 }, orient: 'quer', dunkel: 1, wer: 'alle', seed: 1 }, bypass: 'ok' }), null);
    D.queCurve = D.quer && typeof D.quer.curve === 'function' ? tryf(() => D.quer.curve({ points: 120 }), null) : null;
    D.peaks = D.quer && typeof D.quer.peaks === 'function' ? tryf(() => D.quer.peaks(), []) : [];
    D.po = D.quer && C.pv.mppt && C.pv.mppt.po ? tryf(() => C.pv.mppt.po(D.quer, { u0: 0.9 * D.quer.uoc, stepPct: 0.5, iter: 300 }), null) : null;
    D.poScan = D.quer && C.pv.mppt && C.pv.mppt.po ? tryf(() => C.pv.mppt.po(D.quer, { u0: 0.9 * D.quer.uoc, stepPct: 0.5, iter: 300, scan: true }), null) : null;
    /* Sonne */
    D.days = [['21. Dezember', 355], ['21. März', 80], ['21. Juni', 172]].map(d => ({ name: d[0], N: d[1], noon: tryf(() => C.sun.position(d[1], 12, D.lat), null), ss: tryf(() => C.sun.sunriseSunset(d[1], D.lat), null), path: tryf(() => C.sun.sunPath(d[1], D.lat, 30), null),
      e35: tryf(() => C.sun.dayEnergy({ N: d[1], lat: D.lat, beta: 35, gam: 0, c: 0 }), NaN), e60: tryf(() => C.sun.dayEnergy({ N: d[1], lat: D.lat, beta: 60, gam: 0, c: 0 }), NaN), e35b: tryf(() => C.sun.dayEnergy({ N: d[1], lat: D.lat, beta: 35, gam: 0, c: 1 }), NaN) }));
    D.polar = tryf(() => C.sun.sunriseSunset(355, 70), null);
    D.psh = tryf(() => C.sun.dayEnergy({ N: 355, lat: D.lat, beta: C.sun.bestTilt(355, D.lat, 0, 0.625), gam: 0, c: 0.625 }), NaN);
    /* Laderegler und Akku */
    D.bB = tryf(() => C.batt.defaults('blei', 12), null); D.bL = tryf(() => C.batt.defaults('lifepo4', 12), null);
    const bt = tryf(() => C.batt.create({ chem: 'blei', Usys: 12, C: 100, soc0: 0.5 }), null); D.ub = bt && typeof bt.ocv === 'function' ? tryf(() => bt.ocv(0.5), NaN) : NaN;
    D.usw = tryf(() => { const d = C.ctrl && C.ctrl.defaults ? C.ctrl.defaults('pwm', 12) : null; return d && fin(d.usw) ? d.usw : (d && fin(d.Usw) ? d.Usw : 0.3); }, 0.3); /* Spannungsabfall des PWM-Schalters (Übungswert A12) */
    const pwm = id => { const f = tryf(() => C.pv.array({ spec: id, ns: 1, np: 1, cond: { G: 1000, Tc: 25, fd: 0.1 } }), null), op = f && fin(D.ub) ? tryf(() => f.opPoint('u', D.ub + D.usw), null) : null, k = keysOf(id, 1000, 25); return op && op.ok !== false && k ? { p: op.P, share: op.P / k.Pmpp, U: op.U } : null; };
    D.pwm60 = pwm(SPEC); D.pwm36 = pwm(KLEIN);
    D.cycB = D.bB ? tryf(() => C.batt.cycleLife('blei', D.bB.dodMax), NaN) : NaN; D.cycL = D.bL ? tryf(() => C.batt.cycleLife('lifepo4', D.bL.dodMax), NaN) : NaN;
    D.cr = FXd('crate'); D.lz = FXd('ladezeit'); D.au = FXd('autonomie');
    D.ocv = ch => { const b = tryf(() => C.batt.create({ chem: ch, Usys: 12, C: 100, soc0: 0.5 }), null); return b && typeof b.ocv === 'function' ? b : null; };
    /* Wechselrichter */
    D.euro = {}; ['standard', 'einfach', 'insel'].forEach(m => { D.euro[m] = tryf(() => C.inv.euroEta(m), NaN); });
    D.etaPts = (C.inv && C.inv.euroWeights ? C.inv.euroWeights.map(x => x[0]) : [0.05, 0.1, 0.2, 0.3, 0.5, 1]);
    D.standby = tryf(() => C.inv.loss('insel', 1000, 0), NaN);
    D.grid = C.inv && Array.isArray(C.inv.gridTable) ? C.inv.gridTable : [];
    /* Auslegung, Kabel, Ertrag */
    const prof = tryf(() => C.loads && C.loads.profile ? C.loads.profile('gartenhaus') : null, null);
    D.ed = prof && fin(prof.energyWh) ? prof.energyWh : NaN; D.edFrom = fin(D.ed) ? 'Gartenhaus' : '';
    D.pv = FX('pvBedarf', ...(() => { const d = formulaDefs('pvBedarf'); if (fin(D.ed)) d[0] = D.ed; if (fin(D.psh)) d[1] = Math.round(D.psh * 100) / 100; return d; })());
    D.bk = FX('batterieKap', ...(() => { const d = formulaDefs('batterieKap'); if (fin(D.ed)) d[0] = D.ed; return d; })());
    D.sf = FXd('spannungsfall'); D.qs = FXd('querschnitt'); D.lv = FXd('leitungsverlust');
    D.skal = C.calc && C.calc.skal ? C.calc.skal : null;
    D.ertrag = FXd('ertrag'); D.amo = FXd('amortisation'); D.eq = FXd('eigenquote'); D.au2 = FXd('autarkie');
    return D;
  }

  /* ============================================================ Zeichnungen */
  function figPn() {
    return SV(RECT(60, 20, 240, 50, 'rgba(59,158,255,.28)') + TX(180, 50, 'n-Schicht (Elektronenüberschuss)', { max: 230, w: 1 }) + RECT(60, 70, 240, 6, 'rgba(255,200,0,.6)', { r: 1 }) + TX(318, 76, 'pn-Übergang', { a: 'end', c: 'warn', s: 12, max: 100 }) + RECT(60, 76, 240, 50, 'rgba(255,92,92,.28)') + TX(180, 106, 'p-Schicht (Elektronenmangel)', { max: 230, w: 1 }) +
      ARR(90, 2, 112, 28, FILL.warn) + ARR(160, 2, 182, 28, FILL.warn) + TX(280, 14, 'Licht (Photonen)', { c: 'warn', s: 12, max: 120 }) + TX(180, 134, 'Photonen erzeugen Elektron-Loch-Paare.', { c: 'mute', s: 12, max: 340 }) + TX(180, 149, 'Das Feld am pn-Übergang trennt sie.', { c: 'mute', s: 12, max: 340 }), 'Aufbau einer Solarzelle: n-Schicht, pn-Übergang, p-Schicht, Licht von oben', '0 0 360 156');
  }
  function figGrid(D, orient, mk, title) {
    const C = CORE(), sp = D.spec; if (!sp || !C.pv.shade || !C.pv.shade.layout) return '';
    const cells = tryf(() => C.pv.shade.layout(SPEC, orient), []), s = mk && mk.s ? mk.s : null, cols = orient === 'quer' ? sp.rows : sp.cols, rows = orient === 'quer' ? sp.cols : sp.rows, cw = 11, ch = 11, x0 = 18, y0 = 22; let g = '';
    cells.forEach((c, i) => { const x = x0 + Math.round(c.xf * cols * cw - cw / 2), y = y0 + Math.round((1 - c.yf) * rows * ch - ch / 2); const dark = s && s[i] < 0.5; g += `<rect x="${x}" y="${y}" width="${cw - 1}" height="${ch - 1}" style="fill:${dark ? 'rgba(0,0,0,.65)' : 'rgba(59,158,255,.45)'};stroke:${FILL.mute};stroke-width:.6"/>`; });
    return `<g>${TX(x0 + cols * cw / 2, 14, title, { c: 'fg', s: 12, max: 150, w: 1 })}${g}</g>`;
  }
  function figSchicht(D) {
    if (!D.build.length) return '';
    const cols = ['rgba(59,158,255,.28)', 'rgba(255,200,0,.28)', 'rgba(43,160,90,.45)', 'rgba(255,200,0,.28)', 'rgba(150,150,150,.35)', 'rgba(150,150,150,.55)', 'rgba(120,120,120,.5)'];
    const order = ['glas', 'eva1', 'zelle', 'eva2', 'rueck'], lay = order.map(id => D.build.find(b => b.id === id)).filter(Boolean); let g = '', y = 14; const hs = [34, 14, 22, 14, 18];
    lay.forEach((b, i) => { g += RECT(20, y, 130, hs[i], cols[i]) + TX(160, y + hs[i] / 2 + 4, b.name.replace(/ \(.*\)/, '') + ' ' + fnum(b.mm, 2) + ' mm', { a: 'start', s: 12, max: 190 }); y += hs[i]; });
    return SV(g + TX(85, y + 18, 'Dicken nicht maßstäblich', { c: 'mute', s: 12, max: 200 }) + TX(180, y + 36, 'Oben fällt das Licht ein.', { c: 'mute', s: 12, max: 300 }), 'Schichtaufbau eines Solarmoduls', '0 0 360 ' + (y + 46));
  }
  function figModul(D) {
    const sp = D.spec; if (!sp) return '';
    return SV(figGrid(D, 'hochkant', null, 'hochkant') +
      [0, 1, 2].slice(0, sp.subs).map(i => { const w = sp.cols * 11 / sp.subs; return RECT(18 + i * w, 22 + sp.rows * 11 + 6, w - 2, 10, 'rgba(255,200,0,.5)', { r: 2 }) + TX(18 + i * w + w / 2 - 1, 22 + sp.rows * 11 + 31, 'Bypass ' + (i + 1), { s: 12, max: w + 20, c: 'warn' }); }).join('') +
      TX(250, 60, sp.Ns + ' Zellen in Reihe', { a: 'middle', s: 12.5, max: 190, w: 1 }) + TX(250, 80, sp.subs + ' Teilstränge, je 1 Bypass', { s: 12, max: 190, c: 'mute' }) + TX(250, 100, sp.cols + ' Spalten × ' + sp.rows + ' Zeilen', { s: 12, max: 190, c: 'mute' }), 'Modul mit Zellraster und drei Teilsträngen mit Bypassdioden', '0 0 360 ' + (22 + sp.rows * 11 + 44));
  }
  function figIU(D) {
    const cv = D.curve; if (!cv || !D.k) return '';
    const f = frame(D.k.Uoc * 1.02, D.k.Isc * 1.12, { xt: [[0, '0'], [D.k.Uoc / 2, fa(D.k.Uoc / 2)], [D.k.Uoc, fa(D.k.Uoc)]], yt: [[0, '0'], [D.k.Isc, fa(D.k.Isc)]], xl: 'Spannung U in V, Strom I in A' });
    const pmax = D.k.Pmpp * 1.0, pts = cv.U.map((u, i) => [f.X(u), f.Y(cv.I[i])]), pp = cv.U.map((u, i) => [f.X(u), f.Y(cv.P[i] / pmax * D.k.Isc * 0.8)]);
    return SV(f.g + POLY(pts, FILL.acc) + POLY(pp, FILL.warn, { dash: '6 4', w: 1.8 }) + DOT(f.X(D.k.Umpp), f.Y(D.k.Impp), FILL.bad) + RECT(f.X(0), f.Y(D.k.Impp), f.X(D.k.Umpp) - f.X(0), f.Y(0) - f.Y(D.k.Impp), 'none', { stroke: FILL.bad, sw: 1, r: 0 }) +
      TX(f.X(D.k.Umpp) - 6, f.Y(D.k.Impp) - 8, 'MPP', { a: 'end', c: 'bad', w: 1 }) + TX(f.X(D.k.Uoc) - 2, f.Y(0) - 8, 'Uoc', { a: 'end', c: 'acc', w: 1 }) + TX(f.X(0) + 8, f.Y(D.k.Isc) + 16, 'Isc', { a: 'start', c: 'acc', w: 1 }) + TX(f.X(D.k.Uoc * 0.5), f.Y(D.k.Isc * 0.3), 'Leistung P (gestrichelt)', { a: 'middle', c: 'warn', s: 12, max: 150 }), 'I-U-Kennlinie mit Leerlaufspannung, Kurzschlussstrom und Punkt maximaler Leistung', '0 0 360 160');
  }
  function figG(D) {
    if (!D.g.every(x => x.cv && x.k)) return '';
    const f = frame(D.g[2].k.Uoc * 1.02, D.g[2].k.Isc * 1.12, { xt: [[0, '0'], [D.g[2].k.Uoc, fa(D.g[2].k.Uoc)]], yt: [[0, '0'], [D.g[2].k.Isc, fa(D.g[2].k.Isc)]], xl: 'Spannung U in V, Strom I in A' }); let g = f.g;
    D.g.forEach((x, i) => { g += POLY(x.cv.U.map((u, j) => [f.X(u), f.Y(x.cv.I[j])]), i === 2 ? FILL.acc : i === 1 ? FILL.warn : FILL.ok, { dash: i === 1 ? '7 4' : i === 0 ? '2 4' : '', w: 2.2 }) + TX(f.X(x.k.Uoc) - 4, f.Y(x.k.Isc) - 6 + 0, x.G + ' W/m²', { a: 'end', s: 12, c: 'mute', max: 80 }); });
    return SV(g, 'Kennlinien bei 200, 500 und 1000 Watt je Quadratmeter', '0 0 360 160');
  }
  function figReihe() {
    const mod = (x, y, t) => RECT(x, y, 44, 26, 'rgba(59,158,255,.3)') + TX(x + 22, y + 18, t, { s: 12, max: 40 });
    return SV(mod(30, 20, 'Modul') + mod(90, 20, 'Modul') + mod(150, 20, 'Modul') + LINE(74, 33, 90, 33, FILL.fg) + LINE(134, 33, 150, 33, FILL.fg) + TX(112, 74, 'Reihe: Spannungen addieren', { max: 230, w: 1 }) + TX(112, 92, 'gleicher Strom', { c: 'mute', s: 12 }) +
      mod(250, 8, 'Modul') + mod(250, 42, 'Modul') + mod(250, 76, 'Modul') + LINE(244, 21, 244, 89, FILL.fg) + LINE(300, 21, 300, 89, FILL.fg) + LINE(294, 21, 300, 21, FILL.fg) + LINE(294, 55, 300, 55, FILL.fg) + LINE(294, 89, 300, 89, FILL.fg) + LINE(244, 21, 250, 21, FILL.fg) + LINE(244, 55, 250, 55, FILL.fg) + LINE(244, 89, 250, 89, FILL.fg) +
      TX(272, 118, 'Parallel: Ströme addieren', { max: 160, w: 1 }) + TX(272, 135, 'gleiche Spannung', { c: 'mute', s: 12 }), 'Module in Reihe und parallel', '0 0 360 146');
  }
  function figSchatten(D) {
    if (!D.mkH || !D.mkQ) return '';
    const sp = D.spec;
    return SV(figGrid(D, 'hochkant', D.mkH, 'hochkant') + `<g transform="translate(190,0)">${figGrid(D, 'quer', D.mkQ, 'quer')}</g>` + TX(180, 22 + sp.rows * 11 + 26, 'Schatten von unten (Hecke): schwarz', { c: 'mute', s: 12, max: 340 }) + TX(90, 22 + sp.rows * 11 + 46, D.heckeH ? 'Verlust ' + pc(D.heckeH.lossPct / 100) : '', { c: 'bad', w: 1, s: 12.5 }) + TX(270, 22 + sp.rows * 11 + 46, D.heckeQ ? 'Verlust ' + pc(D.heckeQ.lossPct / 100) : '', { c: 'bad', w: 1, s: 12.5 }), 'Hecke wirft Schatten von unten auf ein hochkant und ein quer montiertes Modul', '0 0 360 ' + (22 + sp.rows * 11 + 56));
  }
  function figSonne(D) {
    const P = D.days.filter(d => d.path && d.path.alt); if (P.length < 3) return '';
    const f = frame(24, 70, { xt: [[0, '0'], [6, '6'], [12, '12'], [18, '18'], [24, '24']], yt: [[0, '0'], [30, '30'], [60, '60']], xl: 'Sonnenzeit in h; Sonnenhöhe in Grad' }), st = [{ c: FILL.bad, d: '' }, { c: FILL.ok, d: '7 4' }, { c: FILL.warn, d: '' }]; let g = f.g;
    P.forEach((d, i) => { g += POLY(d.path.t.map((t, j) => [f.X(t), f.Y(Math.max(0, d.path.alt[j]))]), st[i].c, { dash: st[i].d, w: 2.2 }) + TX(f.X(12), f.Y(d.noon ? d.noon.alt : 0) + (i === 2 ? 14 : -5), d.name.replace(/^\d+\. /, '') + ' ' + fnum(d.noon.alt, 0) + '°', { s: 12, c: i === 2 ? 'warn' : i === 1 ? 'ok' : 'bad', max: 140 }); });
    return SV(g, 'Sonnenhöhe über dem Tag am 21. Dezember, 21. März und 21. Juni', '0 0 360 160');
  }
  function figLade(D) {
    if (!D.bB) return '';
    const f = frame(10, 10, { xt: [[1.5, 'Bulk'], [5, 'Absorption'], [8.6, 'Float']], xl: 'Zeit (Prinzipbild, Zahlen ohne Maßstab)' }); let g = f.g;
    g += LINE(f.X(3.2), f.T, f.X(3.2), f.T + f.H, FILL.mute, { dash: '3 4', w: 1 }) + LINE(f.X(7), f.T, f.X(7), f.T + f.H, FILL.mute, { dash: '3 4', w: 1 });
    g += POLY([[f.X(0), f.Y(3)], [f.X(1.5), f.Y(6)], [f.X(3.2), f.Y(8)], [f.X(5), f.Y(8)], [f.X(7), f.Y(6.4)], [f.X(10), f.Y(6.4)]], FILL.acc) + POLY([[f.X(0), f.Y(8)], [f.X(3.2), f.Y(8)], [f.X(5), f.Y(5)], [f.X(7), f.Y(1.4)], [f.X(10), f.Y(1)]], FILL.warn, { dash: '6 4', w: 2 });
    g += TX(f.X(5), f.Y(8.9) - 8, fa(D.bB.uAbs) + ' V', { c: 'acc', s: 12 }) + TX(f.X(8.7), f.Y(6.4) - 8, fa(D.bB.uFloat) + ' V', { c: 'acc', s: 12 }) + TX(f.X(1.6), f.Y(8) + 16, 'Strom', { c: 'warn', s: 12 }) + TX(f.X(0.2) + 28, f.Y(2.2) - 4, 'Spannung (Blei, 12 V)', { c: 'acc', s: 12, max: 140 });
    return SV(g, 'Dreistufenladung: Bulk, Absorption, Float, Prinzipbild', '0 0 360 160');
  }
  function figOcv(D) {
    const b1 = D.ocv('blei'), b2 = D.ocv('lifepo4'); if (!b1 || !b2) return '';
    const f = frame(1, 14.2 - 11.5, { xt: [[0, '0 %'], [0.5, '50 %'], [1, '100 %']], yt: [[12 - 11.5, '12 V'], [13 - 11.5, '13 V'], [14 - 11.5, '14 V']], xl: 'Ladezustand; Ruhespannung (12-V-Akku)' }); let g = f.g, A1 = [], A2 = [];
    for (let i = 0; i <= 40; i++) { const s = i / 40; A1.push([f.X(s), f.Y(b1.ocv(s) - 11.5)]); A2.push([f.X(s), f.Y(b2.ocv(s) - 11.5)]); }
    g += POLY(A1, FILL.warn, { w: 2.4 }) + POLY(A2, FILL.acc, { dash: '7 4', w: 2.4 }) + TX(f.X(0.5), f.Y(b1.ocv(0.5) - 11.5) + 16, 'Blei: Spannung fällt gleichmäßig', { c: 'warn', s: 12, max: 200 }) + TX(f.X(0.5), f.Y(b2.ocv(0.5) - 11.5) - 8, 'Lithium: fast waagerecht', { c: 'acc', s: 12, max: 200 });
    return SV(g, 'Ruhespannung über dem Ladezustand für Blei und Lithium', '0 0 360 160');
  }
  function figEta(D) {
    const C = CORE(); if (!C.inv || !D.etaPts) return '';
    const f = frame(1, 1, { xt: [[0, '0'], [0.5, '50 %'], [1, '100 %']], yt: [[0.6, '60 %'], [0.8, '80 %'], [1, '100 %']], xl: 'Last P/Pn; Wirkungsgrad' }), Yc = y => f.T + f.H * (1 - (y - 0.5) / 0.5); let g = f.g; const st = { standard: [FILL.acc, ''], einfach: [FILL.warn, '7 4'], insel: [FILL.bad, '2 4'] };
    Object.keys(st).forEach(m => { const pts = []; for (let i = 1; i <= 50; i++) { const p = i / 50, e = tryf(() => C.inv.eta(m, p), NaN); if (fin(e)) pts.push([f.X(p), Math.max(f.T, Math.min(f.T + f.H, Yc(e)))]); } g += POLY(pts, st[m][0], { dash: st[m][1], w: 2.2 }); });
    g += TX(f.X(0.62), f.T + 14, 'Netz Standard', { c: 'acc', s: 12 }) + TX(f.X(0.62), f.T + 30, 'Netz einfach', { c: 'warn', s: 12 }) + TX(f.X(0.62), f.T + 46, 'Insel', { c: 'bad', s: 12 });
    return SV(g, 'Wirkungsgrad über der Last für drei Wechselrichter', '0 0 360 160');
  }
  function figPO(D) {
    if (!D.queCurve || !D.peaks || !D.peaks.length) return '';
    const cv = D.queCurve, pmax = Math.max(...cv.P) * 1.1, f = frame(D.quer.uoc * 1.02, pmax, { xt: [[0, '0'], [D.quer.uoc, fa(D.quer.uoc)]], yt: [[0, '0'], [pmax / 1.1, fa(pmax / 1.1) + ' W']], xl: 'Spannung U in V; Leistung P in W' }); let g = f.g;
    g += POLY(cv.U.map((u, i) => [f.X(u), f.Y(cv.P[i])]), FILL.acc);
    D.peaks.forEach((p, i) => { g += DOT(f.X(p.U), f.Y(p.P), i === 0 ? FILL.ok : FILL.warn) + TX(f.X(p.U), f.Y(p.P) - 8, (i === 0 ? 'global ' : 'lokal ') + fa(p.P) + ' W', { s: 12, c: i === 0 ? 'ok' : 'warn', max: 110 }); });
    return SV(g, 'Leistungskurve eines teilverschatteten Moduls mit zwei Maxima', '0 0 360 160');
  }

  const tbl = (head, rows) => `<table>${head ? '<tr>' + head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>' : ''}${rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('')}</table>`;
  const trybtn = (id, label) => `<button class="chip s" data-try="${esc(id)}">▶ ${esc(label)}</button>`;
  const steps = r => (r && Array.isArray(r.steps) && r.steps.length ? `<p class="hint2" style="margin:2px 0 6px">${r.steps.map(esc).join('<br>')}</p>` : '');
  const num = (v, u) => (fin(v) ? fa(v) + (u ? ' ' + u : '') : '–');

  /* ============================================================ Abschnitte */
  function sections(D, api) {
    const R = []; const add = (id, title, html, tries) => R.push({ id, title, html, tries: tries || [] });
    if (!D) { add('kern', 'Der Rechenkern fehlt', NOCORE, []); return R; }
    const k = D.k || {}, sp = D.spec || {}, tc = D.tc || {};
    /* 1 */
    add('licht', '1 Licht wird Strom', `<p>Eine <b>Solarzelle</b> ist eine große Diode aus Silizium. Trifft Licht auf sie, erzeugen die Photonen Elektron-Loch-Paare. Das Feld am <b>pn-Übergang</b> trennt die Ladungen, und es entsteht eine Spannung. Silizium hat eine Bandlücke von etwa 1,1 eV: Licht mit mehr Energie wird genutzt, der Rest geht als Wärme verloren.</p>${figPn()}<p>Eine einzelne Zelle (Fläche etwa ${num(D.zelleSpec && D.zelleSpec.A, 'm²')}) liefert bei Normbedingungen nur <b>${D.zelle ? fa(D.zelle.Uoc) + ' V' : '–'}</b> Leerlaufspannung, aber einen großen Strom von <b>${D.zelle ? fa(D.zelle.Isc) + ' A' : '–'}</b>. Ihre Leistung: <b>${D.zelle ? fa(D.zelle.Pmpp) + ' W' : '–'}</b>. Darum schaltet man viele Zellen in Reihe zu einem Modul.</p>`, [['enx1', 'Einzelne Zelle messen']]);
    /* 2 */
    const bt = D.build.length ? tbl(['Schicht', 'Dicke', 'Aufgabe'], D.build.map(b => [esc(b.name), fnum(b.mm, b.mm < 1 ? 2 : 1) + ' mm', esc(b.rolle)])) : '';
    add('modul', '2 Zelle, Modul, Strang', `<p>Ein <b>Modul</b> ist ein Sandwich: oben Glas, dann Folie, die Zellen, wieder Folie und die Rückseitenfolie, alles im Rahmen. Das 60-Zellen-Modul hat ${sp.Ns || '–'} Zellen in Reihe, geordnet in ${sp.cols || '–'} Spalten und ${sp.rows || '–'} Zeilen. In der Anschlussdose sitzen ${sp.subs || '–'} <b>Bypassdioden</b>, je eine für einen <b>Teilstrang</b> (${sp.Ns && sp.subs ? sp.Ns / sp.subs : '–'} Zellen). Mehrere Module in Reihe heißen <b>Strang</b>, mehrere Stränge zusammen <b>Feld</b>.</p>${figSchicht(D)}${bt}${figModul(D)}`, [['enx2', 'Das Modul bei STC']]);
    /* 3 */
    add('kennlinie', '3 Die I-U-Kennlinie lesen', `<p>Die Kennlinie zeigt, welchen Strom das Modul bei welcher Spannung liefert (Normbedingungen STC: 1000 W/m², 25 °C Zelltemperatur). Wichtige Punkte: <b>Leerlauf</b> (Uoc = ${num(k.Uoc, 'V')}, kein Strom), <b>Kurzschluss</b> (Isc = ${num(k.Isc, 'A')}, keine Spannung) und der <b>MPP</b>, der Punkt maximaler Leistung (Umpp = ${num(k.Umpp, 'V')}, Impp = ${num(k.Impp, 'A')}, Pmpp = ${num(k.Pmpp, 'W')}).</p>${figIU(D)}
      <p>Der <b>Füllfaktor</b> FF = Pmpp / (Uoc · Isc) sagt, wie „eckig“ die Kennlinie ist.</p>${D.ff ? steps(D.ff) : ''}<p>Der <b>Wirkungsgrad</b> ist die elektrische Leistung durch die einfallende Lichtleistung (Fläche ${num(sp.A, 'm²')}).</p>${D.etaPv ? steps(D.etaPv) : ''}<p><b>Leistungsanpassung:</b> Die größte Leistung gibt das Modul an einen Lastwiderstand von Umpp / Impp = <b>${num(D.rMpp, 'Ω')}</b> ab. Ist der Widerstand kleiner, fließt viel Strom bei kleiner Spannung; ist er größer, steigt die Spannung, aber der Strom fällt.</p>${D.ds ? `<details class="fm"><summary>Datenblatt des Übungsmoduls</summary><div class="fmb">${tbl(['Größe', 'Wert'], D.ds.rows.map(r => [esc(r.label), esc(r.text) + ' ' + esc(r.unit)]))}<p class="hint2">${esc(D.ds.note || '')}</p></div></details>` : ''}`, [['enx3', 'Lastwiderstand durchfahren']]);
    /* 4 */
    const gt = D.g.every(x => x.k) ? tbl(['Einstrahlung', 'Isc', 'Uoc', 'Pmpp'], D.g.map(x => [x.G + ' W/m²', num(x.k.Isc, 'A'), num(x.k.Uoc, 'V'), num(x.k.Pmpp, 'W')])) : '';
    const tt = D.t.every(x => x.k) ? tbl(['Zelltemperatur', 'Uoc', 'Pmpp'], D.t.map(x => [fa(x.T) + ' °C', num(x.k.Uoc, 'V'), num(x.k.Pmpp, 'W')])) : '';
    add('einfluss', '4 Einstrahlung und Temperatur', `<p>Der Kurzschlussstrom ist <b>fast proportional zur Einstrahlung</b>; die Leerlaufspannung ändert sich dagegen nur logarithmisch, also wenig.</p>${figG(D)}${gt}<p>Mit steigender Zelltemperatur <b>sinkt die Spannung</b> (Koeffizient der Leerlaufspannung ${tc.betaU !== undefined ? fnum(100 * tc.betaU, 2) : '–'} %/K), der Strom steigt leicht (${tc.alphaI !== undefined ? fnum(100 * tc.alphaI, 3) : '–'} %/K). Die Leistung sinkt um etwa <b>${tc.gammaP !== undefined ? fnum(-100 * tc.gammaP, 2) : '–'} % je Kelvin</b> (Ergebnis des Modells, nicht vorgegeben).</p>${tt}<p><b>Kalt und klar:</b> Im Winter bei strahlendem Himmel und kalten Zellen ist die Spannung am höchsten. Darauf musst du den Strang auslegen. Die Zelltemperatur im Betrieb liegt über der Lufttemperatur: Tc = Ta + (NOCT − 20)/800 · G.</p>`, [['enx4', 'Halbe Einstrahlung'], ['enx5', 'Heißer Sommer'], ['enx6', 'Kalter Wintertag']]);
    /* 5 */
    add('reihe', '5 Reihe und Parallel', `<p>In <b>Reihe</b> addieren sich die Spannungen, der Strom bleibt gleich. <b>Parallel</b> addieren sich die Ströme, die Spannung bleibt gleich.</p>${figReihe()}${D.serie ? `<p><b>Beispiel Reihe</b>:</p>${steps(D.serie)}` : ''}${D.par ? `<p><b>Beispiel parallel</b>:</p>${steps(D.par)}` : ''}<p><b>Strangauslegung:</b> Bei Kälte darf die Spannung des Strangs die Grenze des Geräts nie überschreiten (sonst wird es zerstört), bei Hitze muss die MPP-Spannung noch im Fenster liegen. Mit dem Modul bei −10 °C (Uoc = ${num(D.cold && D.cold.Uoc, 'V')}) an einem Eingang mit 500 V:</p>${D.smax ? steps(D.smax) : ''}${D.smin ? `<p>Und bei Hitze (Umpp = ${num(D.hot && D.hot.Umpp, 'V')} bei 60 °C), Mindestspannung 150 V:</p>${steps(D.smin)}` : ''}<p><b>Mismatch:</b> Passen die Module in einem Strang nicht zusammen (Schatten, Alterung, andere Typen), bestimmt das schwächste Glied den Strom. Hänge nie Stränge mit stark unterschiedlicher Länge parallel.</p>`, [['enx7', 'Module in Reihe'], ['enx8', 'Module parallel']]);
    /* 6 */
    const sTab = D.blatt && D.heckeH && D.heckeQ && D.blattOhne ? tbl(['Schattenfall (Modul 60 Zellen)', 'Leistung', 'Verlust'], [['Laubblatt auf einer Zelle', num(D.blatt.keys.Pmpp, 'W'), pc(D.blatt.lossPct / 100)], ['Hecke von unten, Modul hochkant', num(D.heckeH.keys.Pmpp, 'W'), pc(D.heckeH.lossPct / 100)], ['Hecke von unten, Modul quer', num(D.heckeQ.keys.Pmpp, 'W'), pc(D.heckeQ.lossPct / 100)]]) : '';
    const hot = D.blatt && D.blattOhne && D.hotLim ? `<p><b>Hotspot:</b> Die verschattete Zelle wird zum Verbraucher und heizt sich auf. Mit intakter Bypassdiode sind es im Beispiel ${num(D.blatt.hot && D.blatt.hot.P, 'W')} in der Zelle, <b>ohne Bypassdiode</b> ${num(D.blattOhne.hot && D.blattOhne.hot.P, 'W')}. Das Lab warnt ab ${num(D.hotLim.warn, 'W')} und meldet einen Fehler ab ${num(D.hotLim.error, 'W')} (Übungsgrenzen). Bypassdioden <b>begrenzen</b> die Hotspot-Leistung, sie beseitigen sie nicht.</p>` : '';
    const obs = D.obst && D.obstJun ? `<p><b>Schatten über den Tag:</b> Eine Hecke von 1,5 m Höhe, 3 m vor dem Modul (Unterkante 0,5 m hoch, Neigung 35°): Am Wintermittag steht die Sonne auf ${num(D.noonDec.alt, '°')} und der Schatten reicht ${num(D.obst.sShade, 'm')} ins Modul (${pc(D.obst.frac)} der Länge). Am Sommermittag (${num(D.noonJun.alt, '°')}) fällt kein Schatten auf das Modul${D.obstJun.shaded ? '' : ''}.</p>` : '';
    add('schatten', '6 Verschattung und Hotspot', `<p>Eine <b>Bypassdiode</b> überbrückt einen Teilstrang, sobald dessen Zellen verschattet sind: Der Rest des Moduls arbeitet weiter, es geht aber der ganze Teilstrang verloren. Deshalb zählt, <b>wie</b> der Schatten liegt.</p>${figSchatten(D)}${sTab}<p>Die Hecke von unten verschattet das hochkant montierte Modul in <b>${D.mkH ? D.mkH.subsHit.length : '–'}</b> von ${sp.subs || '–'} Teilsträngen (die Bypassdioden helfen kaum); quer montiert trifft sie nur ${D.mkQ ? D.mkQ.subsHit.length : '–'} Teilstrang. Merke: Der Schatten liegt am besten <b>entlang</b> der Teilstränge.</p>${hot}${obs}<p><b>Mehrere Maxima:</b> Bei teilverschatteten Modulen hat die P-U-Kurve mehrere Maxima, ein lokales und das globale. Einfache Laderegler können im lokalen hängen bleiben (siehe Abschnitt 15).</p>${figPO(D)}<p><b>Rückstrom:</b> Liegt ein Strang parallel zu einem verschatteten Strang, kann Strom rückwärts durch ihn fließen. Ab drei parallelen Strängen sichert man jeden Strang einzeln ab.</p>`, [['enx9', 'Laubblatt'], ['enx10', 'Hecke: hochkant oder quer'], ['enx12', 'Ohne Bypassdiode']]);
    /* 7 */
    const dayT = D.days.every(d => d.noon && d.ss) ? tbl(['Tag (51,7 °N)', 'Mittagshöhe', 'Tageslänge', 'Tagesenergie klar, 35°', 'klar, 60°', 'bedeckt, 35°'], D.days.map(d => [esc(d.name), num(d.noon.alt, '°'), num(d.ss.length, 'h'), num(d.e35, 'kWh/m²'), num(d.e60, 'kWh/m²'), num(d.e35b, 'kWh/m²')])) : '';
    add('sonne', '7 Sonne und Wetter', `<p><b>Sonnenzeit, nicht die Uhrzeit an der Wand:</b> Mittag ist, wenn die Sonne am höchsten steht. Im Lab rechnen alle Tageskurven in Sonnenzeit. Die Mittagshöhe ist <b>90° − φ + δ</b> (Breitengrad φ, Deklination δ); die Deklination wandert im Jahr zwischen ±23,45°.</p>${figSonne(D)}${dayT}<p>Im Winter ist ein <b>steiles</b> Modul besser, im Sommer ein <b>flaches</b>. Bei bedecktem Himmel liegt der Ertrag nur bei einem kleinen Bruchteil des klaren Tages. Die Ausrichtung nach Süden (Azimut 0°) ist in Mitteleuropa am besten.</p>${D.polar && D.polar.polar === 'nacht' ? '<p><b>Polarnacht:</b> Die Sonne geht nicht auf. Am 21. Dezember bei 70 °N liefert die Anlage gar nichts, im Juni dagegen scheint sie rund um die Uhr (Polartag).</p>' : ''}<p><b>Wolken</b> senken vor allem die Direktstrahlung; das Diffuslicht bleibt. Auch bedeckt kommt also noch etwas an, deshalb rechnet man die Auslegung mit einer Wetterlage und nicht mit klarem Himmel.</p>`, [['enx22', 'Sommertag klar'], ['enx24', 'Neigung steil oder flach']]);
    /* 8 */
    const bb = D.bB, bl = D.bL;
    const pw = D.pwm60 && D.pwm36 ? `<p><b>PWM gegen MPPT:</b> Ein PWM-Regler schaltet das Modul direkt an den Akku und zwingt es auf die Akkuspannung (hier ${num(D.ub + D.usw, 'V')}). Das 60-Zellen-Modul arbeitet dann weit unter seiner MPP-Spannung und gibt nur <b>${pc(D.pwm60.share)}</b> seiner Leistung ab; das 36-Zellen-Modul (Spannung passt zum 12-V-Akku) immerhin <b>${pc(D.pwm36.share)}</b>. Ein <b>MPPT</b>-Regler wandelt die Spannung und holt aus beiden Modulen fast den vollen MPP heraus (Wandlerverluste einige Prozent).</p>` : '';
    add('regler', '8 Laderegler PWM und MPPT', `<p>Der <b>Laderegler</b> sitzt zwischen Modul und Akku und schützt ihn. Er lädt in drei Stufen:</p>${figLade(D)}<ul><li><b>Bulk:</b> Der Strom ist so groß wie das Modul liefert; die Akkuspannung steigt.</li><li><b>Absorption:</b> Die Spannung wird auf die <b>Ladeschlussspannung</b> (hier ${bb ? fa(bb.uAbs) : '–'} V bei Blei, ${bl ? fa(bl.uAbs) : '–'} V bei Lithium) gehalten, der Strom sinkt.</li><li><b>Float:</b> Erhaltungsladung mit ${bb ? fa(bb.uFloat) : '–'} V (Blei).</li></ul>${pw}<p><b>Temperaturkompensation</b> (Blei): Ist der Akku kalt, braucht er eine höhere Ladeschlussspannung, ist er warm, eine niedrigere. Der <b>Tiefentladeschutz</b> trennt die Last, wenn die Akkuspannung unter ${bb ? fa(bb.uLvd) : '–'} V fällt (Blei, unter Last) und schaltet sie erst bei ${bb ? fa(bb.uLvdBack) : '–'} V wieder ein. Dünne, lange Leitungen verfälschen die Spannungsmessung des Reglers: Der Akku wird dann nicht ganz voll.</p><p>Ohne Regler lädt das Modul den Akku über die Ladeschlussspannung hinaus: Blei <b>gast</b> (Knallgas!) ab etwa ${bb ? fa(bb.uGas) : '–'} V, Lithium wird vom BMS abgeschaltet.</p>`, [['enx15', 'PWM am 12-V-Akku'], ['enx17', 'Dreistufenladung'], ['enx20', 'Tiefentladeschutz']]);
    /* 9 */
    const at = bb && bl ? tbl(['Größe (12-V-Akku)', 'Blei (AGM/Gel)', 'Li-Ion (LiFePO4)'], [['Zellen', String(bb.cells), String(bl.cells)], ['Innenwiderstand bei 100 Ah', fnum(bb.ri100 * 1000, 1) + ' mΩ', fnum(bl.ri100 * 1000, 1) + ' mΩ'], ['Peukert-Exponent', fnum(bb.peukert, 2), fnum(bl.peukert, 2)], ['größter Ladestrom', fnum(bb.accFrac, 2) + ' · C', fnum(bl.accFrac, 2) + ' · C'], ['empfohlene Entladetiefe', pc(bb.dodMax), pc(bl.dodMax)], ['Zyklen bei dieser Tiefe (grob)', num(D.cycB), num(D.cycL)], ['Selbstentladung je Tag', fnum(bb.selfDay * 100, 2) + ' %', fnum(bl.selfDay * 100, 2) + ' %'], ['Laden gesperrt unter', '–', bl.frostLock != null ? fa(bl.frostLock) + ' °C' : '–']]) : '';
    add('akku', '9 Akku Blei und Li-Ion', `<p>Die <b>Kapazität</b> C in Amperestunden sagt, wie viel Ladung der Akku speichert. Die Energie ist C · Usys (in Wh). Der <b>Ladezustand</b> (SoC) ist der Füllstand in Prozent; die <b>Entladetiefe</b> ist 100 % − SoC. Die <b>C-Rate</b> ist der Strom bezogen auf die Kapazität.</p>${D.cr ? steps(D.cr) : ''}<p>Bei großen Strömen liefert ein Bleiakku weniger Kapazität (<b>Peukert</b>-Effekt); Kälte verkleinert die nutzbare Kapazität.</p>${D.lz ? `<p><b>Ladezeit:</b></p>${steps(D.lz)}` : ''}${figOcv(D)}<p>Beim Bleiakku verrät die Spannung den Ladezustand ganz gut, beim Lithiumakku <b>kaum</b>: Hier zählt man die Ladung (Coulomb-Zählung).</p>${at}<p class="hint2">Alle Akkuwerte sind Größenordnungen für die Übung. Das Datenblatt des Herstellers gilt. Blei braucht Lüftung (Knallgas), Lithium eine Überwachung (BMS); unter 0 °C darf Lithium nicht geladen werden.</p>`, [['enx25', 'Camper über die Nacht']]);
    /* 10 */
    const gt2 = D.grid.length ? tbl(['Netzwechselrichter', 'Uoc max', 'MPP-Fenster', 'Start'], D.grid.map(g => [esc(g.name), num(g.udcMax, 'V'), fa(g.mppMin) + ' bis ' + fa(g.mppMax) + ' V', num(g.uStart, 'V')])) : '';
    add('wr', '10 Wechselrichter', `<p>Der <b>Wechselrichter</b> macht aus der Gleichspannung des Feldes Wechselspannung. Zwei Arten: der <b>Netzwechselrichter</b> speist ins Hausnetz ein und folgt dem Netz; der <b>Inselwechselrichter</b> bildet sein eigenes Netz aus dem Akku.</p>${figEta(D)}<p>Sein Wirkungsgrad hängt von der Last ab: Bei kleiner Last fressen die Eigenverluste viel, bei Vollast die Stromwärme. Der <b>Europäische Wirkungsgrad</b> gewichtet sechs Lastpunkte (5, 10, 20, 30, 50 und 100 %) mit dem Gewicht, das sie im mitteleuropäischen Jahr haben: Standard <b>${pc(D.euro.standard)}</b>, einfach <b>${pc(D.euro.einfach)}</b>, Insel <b>${pc(D.euro.insel)}</b>.</p>${gt2}<ul><li><b>MPP-Fenster:</b> Nur darin arbeitet der Wechselrichter am MPP; außerhalb wird der Arbeitspunkt verschoben.</li><li><b>Clipping:</b> Ist das Feld größer als der Wechselrichter, wird die Spitze gekappt.</li><li><b>Netzausfall:</b> Der Netzwechselrichter schaltet sofort ab (Anti-Islanding), damit kein Inselnetz entsteht, an dem jemand arbeitet.</li><li><b>Standby:</b> Ein Inselwechselrichter von 1000 VA verbraucht auch ohne Last ${num(D.standby, 'W')}, das sind ${num(D.standby * 24, 'Wh')} am Tag. Ein Sparmodus senkt das, erkennt dann aber kleine Verbraucher nicht.</li><li><b>Scheinleistung:</b> Der Inselwechselrichter muss die Scheinleistung S = P / cos φ liefern, nicht nur die Wirkleistung.</li></ul>`, [['enx28', 'Standard gegen einfach'], ['enx26', 'Der Standby frisst die Nacht'], ['enx30', 'Netzausfall mittags']]);
    /* 11 */
    add('auslegen', '11 Inselanlage auslegen', `<p>Die Auslegung geht in festen Schritten:</p><ol><li><b>Tagesenergie</b> aus den Verbrauchern: E_d = Σ P · t (bei Wechselstromlast kommt der Eigenverbrauch des Wechselrichters dazu).</li><li><b>Sonnenstunden</b> PSH am schlechtesten Tag (meist 21.12., Wetterlage wolkig): hier ${num(D.psh, 'h')} bei bester Neigung für 51,7 °N.</li><li><b>Modulleistung</b> P = E_d / (PSH · PR), mit der <b>Performance Ratio</b> PR als Faktor für alle Verluste.</li><li><b>Akku</b> aus Tagesenergie, Autonomietagen und Entladetiefe.</li><li>Regler, Wechselrichter, Kabel, Sicherungen.</li></ol>${D.pv ? `<p>Beispiel${D.edFrom ? ' (Profil ' + esc(D.edFrom) + ')' : ''}, Modulleistung:</p>${steps(D.pv)}` : ''}${D.bk ? `<p>Akku:</p>${steps(D.bk)}` : ''}<p>Im Tab <b>Auslegen</b> führt dich ein Assistent durch alle Schritte und prüft das Ergebnis in der Simulation (drei Schlechtwettertage).</p>`, [['tab:design', 'Zum Tab Auslegen']]);
    /* 12 */
    const sk = D.skal ? `<p>Normquerschnitte in mm²: ${D.skal.querschnitte.map(fa).join('; ')}. Sicherungen in A: ${D.skal.sicherungen.map(fa).join('; ')}.</p>` : '';
    add('kabel', '12 Kabel und Sicherung auf der Gleichstromseite', `<p>Bei 12 V sind die Ströme groß und jedes Zehntel Volt zählt. Der <b>Spannungsfall</b> auf Hin- und Rückleitung:</p>${D.sf ? steps(D.sf) : ''}<p>Umgekehrt folgt der <b>Mindestquerschnitt</b> aus dem erlaubten Spannungsfall und wird auf den nächsten Normquerschnitt aufgerundet:</p>${D.qs ? steps(D.qs) : ''}${D.qs && D.qs.note ? `<p class="hint2">${esc(D.qs.note)}</p>` : ''}<p>Die <b>Verlustleistung</b> in der Leitung wird zu Wärme:</p>${D.lv ? steps(D.lv) : ''}${sk}<p><b>Sicherung:</b> Sie schützt die <b>Leitung</b>, nicht das Gerät. Der Bemessungsstrom muss größer als der Betriebsstrom und kleiner als die Belastbarkeit der Leitung sein. Passt keine Sicherung dazwischen, ist der Querschnitt zu klein. Gleichstromlichtbögen erlöschen nicht von selbst, deshalb gehören Sicherungen und Trennstellen in jede Leitung vom Akku.</p>`, [['enx21', 'Dünnes Kabel']]);
    /* 13 */
    add('sicherheit', '13 Sicherheit', `<ul><li><b>Solarmodule liefern immer Spannung, solange Licht darauf fällt.</b> Ein Strang kann bis in den Bereich von 1000 V Gleichspannung kommen. Abdecken hilft nur teilweise.</li><li><b>Gleichstromlichtbögen</b> erlöschen nicht von selbst wie bei Wechselstrom: Es gibt keinen Nulldurchgang. Trenne Stecker und Leitungen nie unter Last.</li><li><b>Akkus</b> liefern sehr hohe Kurzschlussströme. Ein Schraubenschlüssel auf den Polen kann glühen. Sicherung nah am Akku, isoliertes Werkzeug, kein Schmuck.</li><li><b>Bleiakkus gasen</b> beim Laden (Knallgas): gut lüften, keine Funken, keine offene Flamme.</li><li><b>Lithiumakkus</b> brauchen ein BMS; nie überladen, nie tiefentladen, nie unter 0 °C laden.</li><li><b>Arbeiten an Anlagen</b> dürfen nur Elektrofachkräfte ausführen. Die Simulation ersetzt keine Unterweisung.</li></ul><p class="hint2">Im Lab lernst du die Zusammenhänge. Schutzeinrichtungen werden nie umgangen oder überbrückt.</p>`, []);
    /* 14 */
    add('wirtschaft', '14 Netzeinspeisung, Eigenverbrauch, Wirtschaftlichkeit grob', `<p>Eine Netzanlage speist Strom ein, den du nicht selbst verbrauchst, und bezieht Strom, wenn die Sonne nicht reicht. Zwei Kennzahlen: Die <b>Eigenverbrauchsquote</b> (wie viel vom Solarstrom du selbst nutzt) und der <b>Autarkiegrad</b> (wie viel von deinem Verbrauch die Anlage deckt).</p>${D.eq ? steps(D.eq) : ''}${D.au2 ? steps(D.au2) : ''}<p>Ein <b>Speicher</b> erhöht beide Kennzahlen, weil er Mittagsüberschuss in den Abend verschiebt.</p><p><b>Ertrag und Amortisation</b> sind Rechnungen mit <b>Annahmen</b>: ${D.ertrag ? esc(D.ertrag.note) : ''}</p>${D.ertrag ? steps(D.ertrag) : ''}${D.amo ? steps(D.amo) : ''}<p class="hint2">${D.amo ? esc(D.amo.note || '') : ''} Preise und Vergütung ändern sich: Annahme, bitte aktualisieren. Das Lab macht keine Aussagen zu Förderung, Anmeldung oder Vergütungsregeln.</p>`, [['enx27', 'Netzeinspeisung am Sonnentag'], ['enx31', 'Speicher erhöht den Eigenverbrauch']]);
    /* 15 */
    const poTxt = D.po && D.poScan ? `<p>Im Beispiel (Modul mit Schatten von unten, quer montiert, siehe Abschnitt 6): Der einfache Suchlauf startet bei hoher Spannung und bleibt bei <b>${num(D.po.P, 'W')}</b> hängen (${D.po.stuck ? 'lokales Maximum' : 'hier trotzdem das globale Maximum'}). Mit regelmäßigem Abtasten der ganzen Kennlinie findet er <b>${num(D.poScan.P, 'W')}</b>${D.poScan.stuck ? '' : ' (globales Maximum)'}.</p>` : '';
    add('regelung', '15 Regelung im Energiesystem', `<p>Der <b>MPPT</b> ist ein Suchverfahren: Er verändert die Spannung um einen kleinen Schritt (<i>Perturb and Observe</i>), schaut, ob die Leistung gestiegen ist, und geht weiter in diese Richtung, sonst kehrt er um. Das Ergebnis: Er pendelt um den MPP.</p>${poTxt}<p>Bei mehreren Maxima kann er im falschen hängen bleiben; moderne Regler tasten deshalb die ganze Kennlinie regelmäßig ab. Der <b>Laderegler</b> ist eine Ablaufsteuerung (Bulk, Absorption, Float), die über Schwellen schaltet; die thermische Abschaltung eines Wechselrichters wirkt wie ein Zweipunktregler mit Hysterese.</p><p>Wie man Regelkreise entwirft und Stabilität prüft, lernst du im <a href="reglab.html">Regelungstechnik-Lab</a>. Wie sich die Zelle erwärmt und was die Temperatur macht, zeigt das <a href="thmlab.html">Thermik-Lab</a>. Hier ist die Zelltemperatur nur eine Eingangsgröße der Kennlinie.</p>`, [['enx11', 'Lokal gegen global']]);
    /* 16 */
    const gl = (CORE().glossary || []).map(g => [esc((g.article ? g.article + ' ' : '') + g.name), '<b>' + esc(g.sym) + '</b>', esc(g.unit || '–'), esc(g.explain || '')]);
    add('glossar', '16 Glossar', `<p class="hint2">Ein Begriff, ein Wort: Wir sagen Solarmodul (kurz Modul), Strang, Feld, Laderegler, Akku, Wechselrichter. „Batterie“ heißt dasselbe wie Akku.</p>${gl.length ? tbl(['Begriff', 'Symbol', 'Einheit', 'Erklärung'], gl) : '<p class="hint2">Das Glossar kommt aus dem Rechenkern.</p>'}`, []);
    /* 17 */
    const keys = (api && api.KEYS) || root.ENR_KEYS || [];
    add('tasten', '17 Tastenkürzel', keys.length ? `<table>${keys.map(x => `<tr><td style="white-space:nowrap">${(x.keys || []).map(y => `<code>${esc(y)}</code>`).join(' oder ')}</td><td>${esc(x.t)}</td></tr>`).join('')}</table>` : '<p class="hint2">Die Tastenkürzel kommen aus der Seite.</p>', []);
    return R;
  }

  /* „Probier es aus“: Beispiel laden oder Tab wechseln, ohne eigene Rechnung */
  function tryAct(id, api) {
    if (!api || !id) return false;
    if (id.indexOf('tab:') === 0) { if (typeof api.setTab === 'function') { api.setTab(id.slice(4)); return true; } return false; }
    if (typeof api.loadExample === 'function') { const ok = api.loadExample(id); if (ok === false && typeof api.toast === 'function') api.toast('Dieses Beispiel ist noch nicht verfügbar.'); return ok !== false; }
    if (typeof api.toast === 'function') api.toast('Beispiele sind noch nicht geladen.'); return false;
  }

  function render(host, api) {
    A = api; const D = tryf(data, null); let secs = [];
    try { secs = sections(D, api); } catch (e) { secs = [{ id: 'err', title: 'Das hat nicht geklappt', html: '<p class="hint2">' + esc((e && e.message) || e) + '</p>', tries: [] }]; }
    host.innerHTML = '<div class="card pl"><h4>Lernen</h4><p class="big">Energie und Solar kurz erklärt</p><p class="hint2" style="margin:0">17 Abschnitte zum Aufklappen. Alle Zahlen kommen aus derselben Rechnung wie die Rechner und die Prüfstände; der Knopf „Probier es aus“ lädt den passenden Versuch.</p></div>' +
      secs.map((s, i) => `<details data-sec="${esc(s.id)}"${i === 0 ? ' open' : ''}><summary>${esc(s.title)}</summary><div class="hb2">${s.html}${s.tries.length ? `<div class="tryit">${s.tries.map(t => trybtn(t[0], t[1])).join('')}</div>` : ''}</div></details>`).join('');
    if (!host._enrHelp) { host._enrHelp = true; host.addEventListener('click', e => { const b = e.target && e.target.closest ? e.target.closest('[data-try]') : null; if (!b || !A) return; tryAct(b.dataset.try, A); }); }
  }
  const api0 = { render, fn: { data, sections, tryAct, figPn, figIU, figG, figSonne, figLade, figOcv, figEta, figPO, figSchatten, figModul, figSchicht, figReihe, tbl, TX }, VBW };
  root.ENR_UI_EXT = root.ENR_UI_EXT || {}; root.ENR_UI_EXT.help = api0;
  if (typeof module !== 'undefined') module.exports = api0;
})(typeof window !== 'undefined' ? window : globalThis);
