'use strict';
/* Tonfunk Wechselstrom-Lab (WSL-Lab): Tab "Lernen" (WP3d, SPEC 6.5).
   Siebzehn ausklappbare Abschnitte mit SVG-Zeichnungen, fast alle mit "Probier es aus"-Knopf (lädt ein Beispiel wsx<n> oder eine Voreinstellung des Prüfstands).
   Tabellen und Zahlen kommen AUS DEM KERN und den Tabellen der Oberfläche (SPEC Regel 1, 5, 7): Formelsammlung aus WSL_CORE.formulas, Glossar aus WSL_CORE.glossary,
   Tastenkürzel aus api.KEYS (sonst window.WSL_KEYS), feste Werte NUR über WSL_CORE.limitText / limits, Texte über WSL_CORE.TEXTS. Jede Zahl im Fließtext und in den Zeichnungen
   stammt aus derselben Kernfunktion wie die Rechnung im Rechner (sine, rlc, power, comp, res, filter, trafo, three, formulas); fehlt eine Funktion, steht ein Strich statt einer Zahl.
   Es gibt keine zweite Formelimplementierung; die Zeichnungen rechnen nur Bildkoordinaten.
   Übungswerte (Status A) erscheinen immer mit dem Kennzeichen aus limitText ("Übungswert (A), F<n>"); belegte Werte mit "✓ belegt". Bauteilwerte der Beispiele heißen "Übungsschaltung".
   Sicherheit (SPEC 9): keine Mess- oder Aufbauanleitung für Netzspannung; die Abschnitte 8 und 9 tragen den Satz aus TEXTS.ueberhoehung (Lehrbeispiel, nicht nachbauen);
   jeder Abschnitt mit Netzspannung nennt TEXTS.simOnly. Die Bode-Vertiefung (Abschnitt 11) ist ein aufklappbares <details class="wsl-vertiefung">, der Zustand steht in wsl.deep (api.deep).
   Schnittstelle (VERTRAG 6.5): window.WSL_UI_EXT.help = { render(host, api), fn }. Die reinen Funktionen (ohne DOM) hängen unter WSL_UI_EXT.help.fn und werden von test_wslui_help.js geprüft. */
(function (root) {
  const X = root.WSL_UI_EXT = root.WSL_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn, cap) => { host.__wsll = host.__wsll || {}; if (host.__wsll[name + ty]) return; host.__wsll[name + ty] = 1; host.addEventListener(ty, fn, !!cap); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.WSL_CORE;
  const DASH = '–';
  /* Zahlenformat wie im Rechner: Dezimalkomma, Einheit mit Vorsatz */
  function fe(x, unit) {
    const C = CORE(); if (!fin(x)) return DASH;
    if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return String(+x.toPrecision(3)).replace('.', ',') + (unit ? ' ' + unit : '');
  }
  function ff(x, d) {
    const C = CORE(); if (!fin(x)) return DASH;
    if (C && typeof C.fmt === 'function') { try { const t = C.fmt(x, d == null ? 1 : d); if (typeof t === 'string' && t) return t; } catch (e) { /* Rückfall unten */ } }
    return (+x).toFixed(d == null ? 1 : d).replace('.', ',');
  }
  const fhz = x => (fin(x) && x < 1000 ? ff(x, 1) + ' Hz' : fe(x, 'Hz'));
  const a3 = x => (fin(x) ? ff(x, 3) + ' A' : DASH);
  const ma1 = x => (fin(x) ? ff(x * 1000, 1) + ' mA' : DASH);
  const db0 = x => (fin(x) ? ff(x, 0) + ' dB' : DASH);
  const deg = x => (fin(x) ? ff(x, 1) + '°' : DASH);
  /* Funktionsaufruf im Kern über Pfad ("rlc.series"); null bei fehlender Funktion, Ausnahme oder ok:false */
  const call = (path, ...args) => { const C = CORE(); let o = C, ctx = null; for (const k of path.split('.')) { ctx = o; o = o && o[k]; } if (typeof o !== 'function') return null; try { const r = o.apply(ctx, args); return r && r.ok === false ? null : r; } catch (e) { return null; } };
  /* Formel: calc-Ergebnis (Wert und Text); null, wenn der Kern die Formel nicht hat oder sie ungültig meldet */
  const FX = (id, o) => { const C = CORE(), f = C && C.formulas && C.formulas[id]; if (!f || typeof f.calc !== 'function') return null; try { const r = f.calc(o); return r && r.ok !== false && r.valid !== false && fin(r.value) ? r : null; } catch (e) { return null; } };
  const FV = (id, o) => { const r = FX(id, o); return r ? r.value : NaN; };
  const FT = (id, o) => { const r = FX(id, o); return r ? r.text : DASH; };
  /* Grenzwerttext mit Statuszeichen (✓ belegt / Übungswert (A), F<n>) nur aus dem Kern */
  const LT = id => { const C = CORE(); if (C && typeof C.limitText === 'function') { try { const t = C.limitText(id); if (typeof t === 'string' && t) return t; } catch (e) { /* Strich */ } } return DASH; };
  const LV = id => { const C = CORE(); if (C && typeof C.limit === 'function') { try { const l = C.limit(id); if (l && fin(l.value)) return l.value; } catch (e) { /* NaN */ } } return NaN; };
  const TX = k => { const C = CORE(), t = C && C.TEXTS && C.TEXTS[k]; return typeof t === 'string' ? t : ''; };
  const gv = (o, k) => (o && fin(o[k]) ? o[k] : NaN);
  const ob = (o, k) => (o && o[k] && typeof o[k] === 'object' ? o[k] : null);
  const tx = o => (o && typeof o.text === 'string' ? o.text : DASH);

  /* ============================================================ Zahlenblatt: jede Zahl im Fließtext, mit der Kernfunktion, aus der sie stammt (Test rechnet jede unabhängig nach) */
  function nums() {
    const o = {}, C = CORE(); if (!C) return o;
    const grid = (c, n, a, b) => call('grid', c, n, a, b) || [];
    const UN = LV('u_netz'), FN = LV('f_netz'), UL = LV('u_aussen'); o.un = UN; o.fn = FN; o.uAussen = UL;
    /* 1 Sinus: Scheitelwert, der zu 230 V gehört (Übungsschaltung) */
    const sin = { form: 'sinus', ampl: 325.27, f: FN };
    o.sin = call('sine.values', sin); o.rect = call('sine.values', { form: 'rechteck', ampl: 325.27, f: FN });
    o.xEff = FX('eff', { ampl: 325.27 }); o.xGl = FX('gleichricht', { ampl: 325.27 }); o.xFF = FX('formfaktor', { ampl: 325.27 }); o.xT = FX('periode', { f: FN }); o.xW = FX('omega', { f: FN });
    o.smp = call('sine.sample', sin, 64);
    /* 2 Phase */
    o.sh = call('sine.shift', { f: FN, phi: 45 }); o.xDt = FX('zeitversatz', { f: FN, phi: 45 });
    o.smpU = call('sine.sample', { form: 'sinus', ampl: 1, f: FN, phi: 45 }, 64); o.smpI = call('sine.sample', { form: 'sinus', ampl: 1, f: FN, phi: 0 }, 64);
    /* 3 Spule, Kondensator */
    o.xl50 = FX('xl', { f: FN, l: 0.1 }); o.xl100 = FX('xl', { f: 100, l: 0.1 }); o.xc50 = FX('xc', { f: FN, c: 47e-6 }); o.xc100 = FX('xc', { f: 100, c: 47e-6 });
    o.sL = call('rlc.series', { u: UN, f: FN, l: 0.1 }); o.sC = call('rlc.series', { u: UN, f: FN, c: 47e-6 });
    o.coil = call('rlc.coil', { u: UN, i: 2.5, p: 150, f: FN }); o.xCoil = FX('spule', { u: UN, i: 2.5, p: 150 });
    o.fR = grid(FN, 41, 0.5, 0.5); o.rxl = []; o.rxc = [];
    o.fR.forEach(f => { const r = call('rlc.reactance', { f, l: 0.1, c: 47e-6 }); o.rxl.push(gv(r, 'xl')); o.rxc.push(gv(r, 'xc')); });
    /* 4 Reihe */
    o.rl = call('rlc.series', { u: UN, f: FN, r: 22, l: 0.1 }); o.rlc = call('rlc.series', { u: UN, f: FN, r: 100, l: 0.25, c: 4.7e-6 });
    if (o.rl) { o.xZ = FX('zReihe', { r: 22, xl: o.rl.xl, xc: 0 }); o.xPhi = FX('phiReihe', { r: 22, xl: o.rl.xl, xc: 0 }); o.xI = FX('iReihe', { u: UN, r: 22, xl: o.rl.xl, xc: 0 }); o.xU = FX('uGeom', { ur: o.rl.ur, ul: o.rl.ul, uc: o.rl.uc }); }
    /* 5 Parallel */
    o.par = call('rlc.parallel', { u: UN, f: FN, r: 100, l: 0.5, c: 10e-6 }); if (o.par) o.xY = FX('yParallel', { r: 100, xl: o.par.xl, xc: o.par.xc });
    /* 6 Leistung */
    o.mot = call('power.fromPcos', 3200, 0.8, UN); o.mess = call('power.fromMeasure', 100, 0.25, 12);
    if (o.mot) { o.xS = FX('sUI', { u: UN, i: o.mot.i }); o.xQ = FX('qAusSP', { s: o.mot.s, p: o.mot.p }); o.xCos = FX('cosphi', { p: o.mot.p, s: o.mot.s }); }
    /* 7 Kompensation: Ziel aus limits */
    o.cos2 = LV('cos_ziel'); o.need = call('comp.need', { p: 3200, cos1: 0.8, cos2: o.cos2, u: UN, f: FN }); o.xC = FX('cKomp', { p: 3200, cos1: 0.8, cos2: o.cos2, u: UN, f: FN });
    o.xQc = FX('qc', { p: 3200, cos1: 0.8, cos2: o.cos2 }); o.over = call('comp.state', { p: 3200, cos1: 0.8, u: UN, f: FN, c: 162e-6, cos2: o.cos2 });
    /* 8 Reihenkreis */
    o.rs = call('res.series', { l: 1e-3, c: 100e-9, r: 10 }); o.tune = call('res.tune', { l: 0.2, f0: 50 });
    o.ueh = o.tune ? call('res.series', { u: UN, l: 0.2, c: o.tune.c, r: 22 }) : null;
    o.xUL = FX('uLReso', { u: UN, r: 22, xl: gv(call('rlc.reactance', { f: FN, l: 0.2 }), 'xl') }); o.xF0 = FX('f0', { l: 1e-3, c: 100e-9 }); o.xZ0 = FX('z0', { l: 1e-3, c: 100e-9 });
    if (o.rs) { o.fK = grid(o.rs.f0, 49, 0.3, 0.3); o.curS = call('res.curve', { art: 'reihe', l: 1e-3, c: 100e-9, r: 10, u: 1 }, o.fK); }
    /* 9 Parallelkreis */
    o.rp = call('res.parallel', { u: 10, l: 1e-3, c: 100e-9, r: 1000 }); o.rpL = call('res.parallel', { u: 10, l: 1e-3, c: 100e-9, rl: 10 });
    if (o.rp) o.curP = call('res.curve', { art: 'parallel', l: 1e-3, c: 100e-9, r: 1000, u: 10 }, o.fK);
    /* 10 Güte, Bandbreite */
    o.g1 = o.rs; o.g2 = call('res.series', { l: 1e-3, c: 100e-9, r: 20 }); o.xG = FX('gueteReihe', { l: 1e-3, c: 100e-9, r: 10 }); o.xGp = FX('gueteParallel', { l: 1e-3, c: 100e-9, rp: 1000 }); o.xGp2 = FX('gueteParallel', { l: 1e-3, c: 100e-9, rp: 2000 });
    if (o.g1) o.xB = FX('bandbreite', { f0: o.g1.f0, qg: o.g1.qg }); if (o.g2) o.xB2 = FX('bandbreite', { f0: o.g2.f0, qg: o.g2.qg });
    o.curG2 = o.g2 ? call('res.curve', { art: 'reihe', l: 1e-3, c: 100e-9, r: 20, u: 1 }, o.fK) : null;
    /* 11 Filter */
    o.f1 = call('filter.rc', { typ: 'tief', r: 1000, c: 100e-9 }); o.f2 = call('filter.rc', { typ: 'tief', r: 10000, c: 47e-9 }); o.f3 = call('filter.rc', { typ: 'hoch', r: 15000, c: 100e-9 });
    o.rlf = call('filter.rl', { typ: 'tief', r: 100, l: 0.1 }); o.sieve = call('filter.sieve', { r: 470, c: 2.2e-6, f: 100, u1: 4 });
    o.xFg = FX('fgRC', { r: 1000, c: 100e-9 }); o.xFgL = FX('fgRL', { r: 100, l: 0.1 }); o.xTau = FX('tau', { r: 1000, c: 100e-9 });
    if (o.f1) { o.xH = FX('hBetrag', { f: o.f1.fg, fg: o.f1.fg }); o.xDb = o.xH ? FX('dB', { h: o.xH.value }) : null; o.fB = grid(o.f1.fg, 41, 2, 2); o.bT = call('filter.bode', { art: 'RC', typ: 'tief', r: 1000, c: 100e-9 }, o.fB); o.bH = call('filter.bode', { art: 'RC', typ: 'hoch', r: 1000, c: 100e-9 }, o.fB); o.fBt = grid(o.f1.fg, 5, 2, 2); }
    /* 12 Trafo */
    o.tr = call('trafo.ideal', { u1: UN, n1: 1150, n2: 69, i2: 2.5 }); o.trK = call('trafo.ideal', { u1: UN, n1: 1150, n2: 60, i2: 2 }); o.dc = call('trafo.dc', { u: 12, rw: 5 }); o.n1 = 1150; o.n2 = 69; o.kp = 3200;
    o.xUeb = FX('ueb', { n1: 1150, n2: 69 }); o.xI1 = FX('i1', { i2: 2.5, n1: 1150, n2: 69 });
    /* 13 Drehstrom */
    o.st = call('three.star', { ul: UL, il: 10, cosphi: 0.8 }); o.dp = call('three.power', { ul: UL, zstr: 40, cosphi: 1 });
    o.xP = FX('pDrehstrom', { ul: UL, il: 10, cosphi: 0.8 }); o.xUa = o.st ? FX('uAussen', { ustr: o.st.ustr }) : null;
    o.smp3 = call('sine.sample', { form: 'sinus', ampl: 1, f: FN }, 72);
    o.ph3 = o.smp3 ? call('three.phases', { ul: UL, f: FN }, o.smp3.t) : null;
    return o;
  }
  
  /* ============================================================ Zeichnungen (SVG, Breite 400, Schrift 14; Text bis zum Rand: Prüfung im Test) */
  const svg = (label, body, h) => `<svg class="dr" viewBox="0 0 400 ${Math.round(h || 170)}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="14" fill="currentColor">${body}</svg>`;
  const T = (x, y, t, anchor, extra) => `<text x="${+(+x).toFixed(1)}" y="${+(+y).toFixed(1)}"${anchor ? ` text-anchor="${anchor}"` : ''} ${extra || 'font-size="13"'}>${esc(t)}</text>`;
  const LN = (x1, y1, x2, y2, c, w, dash) => `<line x1="${+(+x1).toFixed(1)}" y1="${+(+y1).toFixed(1)}" x2="${+(+x2).toFixed(1)}" y2="${+(+y2).toFixed(1)}" stroke="${c || 'currentColor'}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const RC = (x, y, w, h, c, fill, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 8 : r}" fill="${fill || 'none'}" stroke="${c || 'currentColor'}" stroke-width="2"/>`;
  const ARR = (x1, y1, x2, y2, c, w) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, col = c || 'currentColor'; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x2 - ux * 6).toFixed(1)}" y2="${(y2 - uy * 6).toFixed(1)}" stroke="${col}" stroke-width="${w || 2}"/><polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(x2 - ux * 9 - uy * 4.5).toFixed(1)},${(y2 - uy * 9 + ux * 4.5).toFixed(1)} ${(x2 - ux * 9 + uy * 4.5).toFixed(1)},${(y2 - uy * 9 - ux * 4.5).toFixed(1)}" fill="${col}"/>`; };
  /* Farben: Spannung blau, Strom orange, Leistung grün, Blindanteil violett (Linienstil und Beschriftung kommen immer dazu) */
  const COL = { u: '#3b82f6', i: '#f59e0b', p: '#22c55e', q: '#a855f7', k: '#8a8f98', a: '#ef4444' };
  const unavailable = (label, text) => svg(label + ' nicht verfügbar', T(200, 60, text || 'Die Werte fehlen im Kern', 'middle', 'font-size="14"'), 100);
  /* Zeilenumbruch für SVG-Text (kein tspan, jede Zeile ein eigenes text-Element, damit die Prüfung jede Zeile misst) */
  function wrap(t, max) {
    const words = String(t == null ? '' : t).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  const lg10 = Math.log10;
  const clampV = (v, a, b) => (v < a ? a : v > b ? b : v);
  /* Diagrammkörper: Linien, Achsen, Teilung, Legende. o = { xs/ys je Reihe, xlog, xmin, xmax, ymin, ymax, xticks, yticks, xtitle, ytitle, hl, vl, legend, extra(xm, ym) } */
  function plotBody(o, dy) {
    const X0 = 66, XW = 300, Y0 = 26, YH = o.h || 120, c0 = 'currentColor';
    const xm = v => X0 + XW * (o.xlog ? (lg10(v) - lg10(o.xmin)) / (lg10(o.xmax) - lg10(o.xmin)) : (v - o.xmin) / (o.xmax - o.xmin));
    const ym = v => Y0 + YH - YH * (clampV(v, o.ymin, o.ymax) - o.ymin) / (o.ymax - o.ymin);
    let b = T(8, 16, o.ytitle || '', 'start') + LN(X0, Y0, X0, Y0 + YH) + LN(X0, Y0 + YH, X0 + XW, Y0 + YH);
    (o.hl || []).forEach(h => { b += LN(X0, ym(h[0]), X0 + XW, ym(h[0]), h[1] || COL.k, 1, '4 4'); });
    (o.vl || []).forEach(v => { b += LN(xm(v[0]), Y0, xm(v[0]), Y0 + YH, v[1] || COL.k, 1, '4 4'); });
    (o.xticks || []).forEach(t => { b += LN(xm(t[0]), Y0 + YH, xm(t[0]), Y0 + YH + 6, c0, 1.5) + T(xm(t[0]), Y0 + YH + 20, t[1], 'middle'); });
    (o.yticks || []).forEach(t => { b += LN(X0 - 5, ym(t[0]), X0, ym(t[0]), c0, 1.5) + T(X0 - 8, ym(t[0]) + 5, t[1], 'end'); });
    (o.series || []).forEach(s => {
      const pts = []; for (let k = 0; k < s.x.length; k++) { if (fin(s.x[k]) && fin(s.y[k]) && (!o.xlog || s.x[k] > 0)) pts.push(xm(s.x[k]).toFixed(1) + ',' + ym(s.y[k]).toFixed(1)); }
      if (pts.length > 1) b += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.c}" stroke-width="2.5"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
    });
    if (typeof o.extra === 'function') b += o.extra(xm, ym, { X0, XW, Y0, YH });
    b += T(X0 + XW / 2, Y0 + YH + 42, o.xtitle || '', 'middle');
    let y = Y0 + YH + 64, x = 12;
    (o.legend || []).forEach(l => { const w = 30 + 7.8 * l.t.length; if (x + w > 392 && x > 12) { x = 12; y += 20; } b += LN(x, y - 4, x + 22, y - 4, l.c, 2.5, l.dash) + T(x + 28, y, l.t, 'start'); x += w + 8; });
    const H = (o.legend && o.legend.length ? y + 12 : Y0 + YH + 52);
    return { body: dy ? `<g transform="translate(0,${dy})">${b}</g>` : b, h: H };
  }
  function plot(label, o) { const r = plotBody(o, 0); return svg(label, r.body, r.h); }
  const okArr = (...a) => a.every(x => Array.isArray(x) && x.length > 1);
  /* Rechtwinkliges Dreieck (Spannungs-, Strom-, Leistungsdreieck): a waagerecht, b senkrecht (negativ = nach unten), rechts eine Wertespalte */
  function tri(label, o) {
    const a = o.a, b = o.b; if (!fin(a) || !fin(b) || (a === 0 && b === 0)) return unavailable(label);
    const aw = 190, bh = 100, s = Math.min(a ? aw / Math.abs(a) : Infinity, b ? bh / Math.abs(b) : Infinity), la = Math.abs(a) * s, lb = Math.abs(b) * s, up = b >= 0;
    const x0 = 30, y0 = up ? 30 + bh + 10 : 40, x1 = x0 + la, y1 = up ? y0 - lb : y0 + lb, ar = 30;
    const ang = Math.atan2(lb, la), ax = x0 + ar * Math.cos(ang), ay = up ? y0 - ar * Math.sin(ang) : y0 + ar * Math.sin(ang);
    let body = LN(x0, y0, x1, y0, COL[o.ca || 'u'], 3) + LN(x1, y0, x1, y1, COL[o.cb || 'q'], 3) + LN(x0, y0, x1, y1, COL[o.cc || 'k'], 3, o.dash || '') +
      `<path d="M ${x1 - 10 * (la > 0 ? 1 : 0)} ${y0} L ${x1 - 10 * (la > 0 ? 1 : 0)} ${up ? y0 - 10 : y0 + 10} L ${x1} ${up ? y0 - 10 : y0 + 10}" fill="none" stroke="currentColor" stroke-width="1.2"/>` +
      `<path d="M ${x0 + ar} ${y0} A ${ar} ${ar} 0 0 ${up ? 0 : 1} ${ax.toFixed(1)} ${ay.toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.5"/>` + T(x0 + ar + 6, up ? y0 - 8 : y0 + 18, 'φ', 'start');
    body += T((x0 + x1) / 2, up ? y0 + 20 : y0 - 8, o.names[0], 'middle') + T(x1 + 8, (y0 + y1) / 2 + 5, o.names[1], 'start') + T((x0 + x1) / 2 - 12, (y0 + y1) / 2 + (up ? -8 : 20), o.names[2], 'end');
    (o.lines || []).forEach((t, k) => { body += T(292, 52 + 24 * k, t, 'start'); });
    return svg(label, body, 164);
  }
  const DRAW = {
    sinus: n => {
      const v = n && n.sin, sm = n && n.smp; if (!v || !sm || !okArr(sm.t, sm.y)) return unavailable('Sinuskurve mit Scheitelwert, Effektivwert und Gleichrichtwert');
      const T0 = v.T, pk = v.peak;
      return plot('Sinuskurve einer Wechselspannung mit Scheitelwert ' + fe(pk, 'V') + ', Effektivwert ' + fe(v.rms, 'V') + ' und Gleichrichtwert ' + fe(v.rect, 'V'), {
        xs: sm.t, xmin: 0, xmax: T0, ymin: -pk * 1.1, ymax: pk * 1.1, xticks: [[0, '0'], [T0 / 2, fe(T0 / 2, 's')], [T0, fe(T0, 's')]], yticks: [[pk, fe(pk, 'V')], [0, '0'], [-pk, '−' + fe(pk, 'V')]],
        xtitle: 'Zeit t in s', ytitle: 'Spannung u in V', hl: [[v.rms, COL.i], [-v.rms, COL.i], [v.rect, COL.p]], series: [{ x: sm.t, y: sm.y, c: COL.u }],
        legend: [{ t: 'u(t), û = ' + fe(pk, 'V'), c: COL.u }, { t: 'U = ' + fe(v.rms, 'V'), c: COL.i, dash: '4 4' }, { t: '|u| = ' + fe(v.rect, 'V'), c: COL.p, dash: '4 4' }]
      });
    },
    phase: n => {
      const a = n && n.smpU, b = n && n.smpI, sh = n && n.sh; if (!a || !b || !sh || !okArr(a.t, a.y, b.y)) return unavailable('Zwei Sinuskurven mit Phasenverschiebung');
      const T0 = a.T, dt = sh.dtS;
      return plot('Zwei Sinuskurven mit Phasenverschiebung ' + deg(sh.phi) + ': u eilt i vor, Zeitversatz ' + fe(dt, 's'), {
        xs: a.t, xmin: 0, xmax: T0, ymin: -1.2, ymax: 1.2, xticks: [[0, '0'], [T0 / 2, fe(T0 / 2, 's')], [T0, fe(T0, 's')]], yticks: [[0, '0']], xtitle: 'Zeit t in s', ytitle: 'u, i (Maßstab frei)',
        series: [{ x: a.t, y: a.y, c: COL.u }, { x: b.t, y: b.y, c: COL.i, dash: '7 4' }],
        extra: (xm, ym) => { const x1 = xm(T0 - dt), x2 = xm(T0), y = ym(0.55); return LN(x1, ym(0), x1, y, COL.u, 1, '2 3') + LN(x2, ym(0), x2, y, COL.i, 1, '2 3') + ARR(x2 - 1, y, x1, y, 'currentColor', 1.5) + T((x1 + x2) / 2, y - 6, 'Δt = ' + fe(dt, 's'), 'end'); },
        legend: [{ t: 'u (Spannung)', c: COL.u }, { t: 'i (Strom)', c: COL.i, dash: '7 4' }, { t: 'φ = ' + deg(sh.phi), c: COL.k }]
      });
    },
    zeiger: n => {
      const sh = n && n.sh; if (!sh) return unavailable('Zeigerdiagramm'); const cx0 = 100, cy0 = 96, r = 70, ph = sh.phi * Math.PI / 180;
      const px = cx0 + r * Math.cos(ph), py = cy0 - r * Math.sin(ph);
      let b = `<circle cx="${cx0}" cy="${cy0}" r="${r}" fill="none" stroke="${COL.k}" stroke-width="1" stroke-dasharray="3 4"/>` + LN(cx0 - r - 10, cy0, cx0 + r + 14, cy0, COL.k, 1) + LN(cx0, cy0 - r - 10, cx0, cy0 + r + 10, COL.k, 1) +
        ARR(cx0, cy0, cx0 + r, cy0, COL.i, 3) + ARR(cx0, cy0, px, py, COL.u, 3) + `<path d="M ${cx0 + 34} ${cy0} A 34 34 0 0 0 ${(cx0 + 34 * Math.cos(ph)).toFixed(1)} ${(cy0 - 34 * Math.sin(ph)).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.5"/>`;
      b += T(cx0 + r + 6, cy0 + 18, 'i', 'start') + T(px + 6, py - 6, 'u', 'start') + T(cx0 + 40, cy0 - 8, 'φ', 'start');
      wrap(sh.text, 20).forEach((t, k) => { b += T(212, 40 + 22 * k, t, 'start'); });
      b += T(212, 150, 'Drehsinn: gegen den', 'start') + T(212, 170, 'Uhrzeigersinn', 'start');
      return svg('Zeigerdiagramm: der Spannungszeiger u steht ' + deg(sh.phi) + ' vor dem Stromzeiger i, beide drehen gegen den Uhrzeigersinn', b, 200);
    },
    blind: n => {
      if (!n || !okArr(n.fR, n.rxl, n.rxc) || !n.xl50 || !n.xc50) return unavailable('Blindwiderstände über der Frequenz');
      const ym0 = Math.max.apply(null, n.rxl.concat(n.rxc).filter(fin)) * 1.05;
      return plot('Blindwiderstände über der Frequenz: X_L steigt, X_C fällt; bei ' + fe(n.fn, 'Hz') + ' ist X_L ' + fe(n.xl50.value, 'Ω') + ' und X_C ' + fe(n.xc50.value, 'Ω'), {
        xlog: true, xmin: n.fR[0], xmax: n.fR[n.fR.length - 1], ymin: 0, ymax: ym0, xticks: [[n.fn, fe(n.fn, 'Hz')]], yticks: [[n.xl50.value, fe(n.xl50.value, 'Ω')], [n.xc50.value, fe(n.xc50.value, 'Ω')]],
        xtitle: 'Frequenz f in Hz (logarithmisch)', ytitle: 'Blindwiderstand in Ω', vl: [[n.fn, COL.k]], hl: [[n.xl50.value, COL.u], [n.xc50.value, COL.i]],
        series: [{ x: n.fR, y: n.rxl, c: COL.u }, { x: n.fR, y: n.rxc, c: COL.i, dash: '7 4' }], legend: [{ t: 'X_L der Spule', c: COL.u }, { t: 'X_C des Kondensators', c: COL.i, dash: '7 4' }]
      });
    },
    spannung: n => { const r = n && n.rl; if (!r) return unavailable('Spannungsdreieck');
      return tri('Spannungsdreieck der Reihenschaltung: U_R waagerecht, U_L senkrecht, Gesamtspannung U als Hypotenuse, φ ' + deg(r.phi), { a: r.ur, b: r.ux * (r.x >= 0 ? 1 : -1), names: ['U_R', 'U_L', 'U'], ca: 'u', cb: 'q', cc: 'k', lines: ['U_R ' + fe(r.ur, 'V'), 'U_L ' + fe(r.ul, 'V'), 'U ' + fe(r.uGeom, 'V'), 'φ ' + deg(r.phi)] }); },
    strom: n => { const r = n && n.par; if (!r) return unavailable('Stromdreieck');
      return tri('Stromdreieck der Parallelschaltung: I_R waagerecht, I_X senkrecht, Gesamtstrom I als Hypotenuse, φ ' + deg(r.phi), { a: r.ir, b: r.ix * (r.bl >= r.bc ? 1 : -1), names: ['I_R', 'I_X', 'I'], ca: 'i', cb: 'q', cc: 'k', lines: ['I_R ' + fe(r.ir, 'A'), 'I_X ' + fe(r.ix, 'A'), 'I ' + fe(r.i, 'A'), 'φ ' + deg(r.phi)] }); },
    leistung: n => { const r = n && n.mot; if (!r) return unavailable('Leistungsdreieck');
      return tri('Leistungsdreieck: Wirkleistung P ' + fe(r.p, 'W') + ' waagerecht, Blindleistung Q ' + fe(r.q, 'var') + ' senkrecht, Scheinleistung S ' + fe(r.s, 'VA') + ' als Hypotenuse', { a: r.p, b: r.q, names: ['P', 'Q', 'S'], ca: 'p', cb: 'q', cc: 'k', lines: ['P ' + fe(r.p, 'W'), 'Q ' + fe(r.q, 'var'), 'S ' + fe(r.s, 'VA'), 'cos φ ' + ff(r.cosphi, 2)] }); },
    komp: n => {
      const k = n && n.need; if (!k || !fin(n.kp)) return unavailable('Kompensation im Leistungsdreieck'); const p = n.kp, aw = 190, s = Math.min(aw / p, 100 / k.q1), x0 = 30, y0 = 140, x1 = x0 + p * s, yq1 = y0 - k.q1 * s, yq2 = y0 - k.q2 * s;
      let b = LN(x0, y0, x1, y0, COL.p, 3) + LN(x1, y0, x1, yq1, COL.q, 3, '6 4') + LN(x0, y0, x1, yq1, COL.k, 2, '6 4') + LN(x1 + 14, y0, x1 + 14, yq2, COL.q, 3) + LN(x0, y0, x1 + 14, yq2, COL.k, 3) + ARR(x1 + 14, yq2 - 1, x1 + 14, yq1, COL.a, 2);
      b += T((x0 + x1) / 2, y0 + 20, 'P', 'middle') + T(x1 - 8, (y0 + yq1) / 2 + 5, 'Q₁', 'end') + T(x1 + 24, (y0 + yq2) / 2 + 5, 'Q₂', 'start');
      ['P ' + fe(p, 'W'), 'Q₁ ' + fe(k.q1, 'var'), 'Q₂ ' + fe(k.q2, 'var'), 'Q_C ' + fe(k.qc, 'var'), 'C ' + fe(k.c, 'F')].forEach((t, i) => { b += T(290, 50 + 22 * i, t, 'start'); });
      return svg('Kompensation im Leistungsdreieck: der parallele Kondensator nimmt Q_C ' + fe(k.qc, 'var') + ' auf, die Blindleistung sinkt von ' + fe(k.q1, 'var') + ' auf ' + fe(k.q2, 'var') + ', die Wirkleistung bleibt', b, 168);
    },
    reihe: n => {
      const cv = n && n.curS, r = n && n.rs; if (!cv || !r || !okArr(cv.f, cv.i)) return unavailable('Resonanzkurve des Reihenschwingkreises');
      const im = Math.max.apply(null, cv.i), nm = cv.i.map(x => x / im), h = LV('fg_betrag');
      return plot('Resonanzkurve des Reihenschwingkreises: der Strom ist bei der Resonanzfrequenz ' + fe(r.f0, 'Hz') + ' am größten, Bandbreite ' + fe(r.b, 'Hz'), {
        xlog: true, xmin: cv.f[0], xmax: cv.f[cv.f.length - 1], ymin: 0, ymax: 1.08, xticks: [[r.f0, fe(r.f0, 'Hz')]], yticks: [[1, '1'], [h, ff(h, 4)]], xtitle: 'Frequenz f in Hz (logarithmisch)', ytitle: 'Strom I, bezogen auf den Höchstwert',
        hl: [[h, COL.k]], vl: [[r.f0, COL.k]], series: [{ x: cv.f, y: nm, c: COL.i }],
        extra: (xm, ym) => LN(xm(r.fu), ym(h), xm(r.fu), ym(0), COL.u, 1.5, '3 3') + LN(xm(r.fo), ym(h), xm(r.fo), ym(0), COL.u, 1.5, '3 3') + T(xm(r.fu) - 3, ym(0.25), 'f_u', 'end') + T(xm(r.fo) + 3, ym(0.25), 'f_o', 'start'),
        legend: [{ t: 'I(f), Z am kleinsten', c: COL.i }, { t: 'B = ' + fe(r.b, 'Hz'), c: COL.u, dash: '3 3' }]
      });
    },
    sperr: n => {
      const cv = n && n.curP, r = n && n.rp; if (!cv || !r || !okArr(cv.f, cv.z)) return unavailable('Impedanzkurve des Parallelschwingkreises');
      const zm = Math.max.apply(null, cv.z), nm = cv.z.map(x => x / zm), h = LV('fg_betrag');
      return plot('Impedanzkurve des Parallelschwingkreises: der Scheinwiderstand ist bei der Resonanzfrequenz ' + fe(r.f0, 'Hz') + ' am größten', {
        xlog: true, xmin: cv.f[0], xmax: cv.f[cv.f.length - 1], ymin: 0, ymax: 1.08, xticks: [[r.f0, fe(r.f0, 'Hz')]], yticks: [[1, '1'], [h, ff(h, 4)]], xtitle: 'Frequenz f in Hz (logarithmisch)', ytitle: 'Scheinwiderstand Z, bezogen auf den Höchstwert',
        hl: [[h, COL.k]], vl: [[r.f0, COL.k]], series: [{ x: cv.f, y: nm, c: COL.u }], legend: [{ t: 'Z(f), Z am größten: ' + fe(r.rp, 'Ω'), c: COL.u }]
      });
    },
    guete: n => {
      const a = n && n.curS, b = n && n.curG2, g1 = n && n.g1, g2 = n && n.g2; if (!a || !b || !g1 || !g2 || !okArr(a.f, a.i, b.i)) return unavailable('Resonanzkurven mit hoher und niedriger Güte');
      const m1 = Math.max.apply(null, a.i), m2 = Math.max.apply(null, b.i), h = LV('fg_betrag');
      return plot('Zwei Resonanzkurven: hohe Güte Q_G ' + ff(g1.qg, 2) + ' mit schmaler Bandbreite ' + fe(g1.b, 'Hz') + ', niedrige Güte Q_G ' + ff(g2.qg, 2) + ' mit breiter Bandbreite ' + fe(g2.b, 'Hz'), {
        xlog: true, xmin: a.f[0], xmax: a.f[a.f.length - 1], ymin: 0, ymax: 1.08, xticks: [[g1.f0, fe(g1.f0, 'Hz')]], yticks: [[1, '1'], [h, ff(h, 4)]], xtitle: 'Frequenz f in Hz (logarithmisch)', ytitle: 'Strom I, bezogen auf den Höchstwert', hl: [[h, COL.k]], vl: [[g1.f0, COL.k]],
        series: [{ x: a.f, y: a.i.map(x => x / m1), c: COL.i }, { x: b.f, y: b.i.map(x => x / m2), c: COL.u, dash: '7 4' }],
        legend: [{ t: 'Q_G = ' + ff(g1.qg, 2) + ', B = ' + fe(g1.b, 'Hz'), c: COL.i }, { t: 'Q_G = ' + ff(g2.qg, 2) + ', B = ' + fe(g2.b, 'Hz'), c: COL.u, dash: '7 4' }]
      });
    },
    filter: n => {
      const a = n && n.bT, b = n && n.bH, f = n && n.f1; if (!a || !b || !f || !okArr(a.f, a.a, b.a)) return unavailable('Frequenzgang von Tiefpass und Hochpass');
      const lo = Math.min.apply(null, a.a.concat(b.a).filter(fin)), db = LV('fg_db');
      return plot('Frequenzgang von Tiefpass und Hochpass: Dämpfungsmaß in dB über der Frequenz, bei der Grenzfrequenz ' + fe(f.fg, 'Hz') + ' liegt die Kurve ' + db0(db) + ' unter dem Durchlassbereich', {
        xlog: true, xmin: a.f[0], xmax: a.f[a.f.length - 1], ymin: Math.max(lo, -45), ymax: 3, xticks: [[f.fg, fe(f.fg, 'Hz')]], yticks: [[0, '0 dB'], [db, db0(db)]], xtitle: 'Frequenz f in Hz (logarithmisch)', ytitle: 'Dämpfungsmaß a in dB',
        hl: [[db, COL.k]], vl: [[f.fg, COL.k]], series: [{ x: a.f, y: a.a, c: COL.u }, { x: b.f, y: b.a, c: COL.i, dash: '7 4' }], legend: [{ t: 'Tiefpass', c: COL.u }, { t: 'Hochpass', c: COL.i, dash: '7 4' }, { t: 'f_g = ' + fe(f.fg, 'Hz'), c: COL.k, dash: '4 4' }]
      });
    },
    bode: n => {
      const a = n && n.bT, f = n && n.f1, tk = n && n.fBt; if (!a || !f || !tk || !okArr(a.f, a.a, a.asymp, a.phi)) return unavailable('Bode-Diagramm');
      const db = LV('fg_db'), ph = -LV('fg_phase'), xt = tk.map(v => [v, fe(v, 'Hz')]);
      const m = plotBody({ xlog: true, xmin: a.f[0], xmax: a.f[a.f.length - 1], ymin: -45, ymax: 3, xticks: xt, yticks: [[0, '0 dB'], [db, db0(db)], [a.dekade ? a.dekade.a : -20, db0(a.dekade ? a.dekade.a : NaN)]], xtitle: 'Frequenz f in Hz (Dekaden)', ytitle: 'Betrag a in dB', vl: xt.map(t => [t[0], COL.k]),
        series: [{ x: a.f, y: a.asymp, c: COL.k, dash: '5 4' }, { x: a.f, y: a.a, c: COL.u }], legend: [{ t: 'Kurve', c: COL.u }, { t: 'Asymptoten', c: COL.k, dash: '5 4' }, { t: a.steigungText || '', c: COL.k }].filter(l => l.t) }, 0);
      const p = plotBody({ xlog: true, xmin: a.f[0], xmax: a.f[a.f.length - 1], ymin: -100, ymax: 10, xticks: xt, yticks: [[0, '0°'], [ph, deg(ph)]], xtitle: 'Frequenz f in Hz (Dekaden)', ytitle: 'Phase φ in °', vl: xt.map(t => [t[0], COL.k]), series: [{ x: a.f, y: a.phi, c: COL.i }],
        extra: (xm, ym) => `<circle cx="${xm(f.fg).toFixed(1)}" cy="${ym(ph).toFixed(1)}" r="4" fill="${COL.i}"/>`, legend: [{ t: 'φ bei f_g: ' + deg(ph), c: COL.i }] }, m.h + 6);
      return svg('Bode-Diagramm des RC-Tiefpasses: oben das Dämpfungsmaß mit Asymptoten und Knick bei der Grenzfrequenz ' + fe(f.fg, 'Hz') + ', unten die Phase mit ' + deg(ph) + ' bei der Grenzfrequenz', m.body + p.body, m.h + 6 + p.h);
    },
    trafo: n => {
      const t = n && n.tr; if (!t) return unavailable('Transformator');
      let b = RC(160, 24, 80, 124, 'currentColor', 'none', 4) + RC(178, 42, 44, 88, 'currentColor', 'none', 2);
      for (let k = 0; k < 6; k++) b += `<path d="M 160 ${34 + 18 * k} a 14 9 0 0 0 0 18" fill="none" stroke="${COL.u}" stroke-width="3"/><path d="M 240 ${34 + 18 * k} a 14 9 0 0 1 0 18" fill="none" stroke="${COL.i}" stroke-width="3"/>`;
      b += T(118, 62, 'N₁ ' + ff(n.n1, 0), 'end') + T(118, 82, 'U₁ ' + fe(t.u1, 'V'), 'end') + T(118, 102, 'I₁ ' + fe(t.i1, 'A'), 'end') + T(282, 62, 'N₂ ' + ff(n.n2, 0), 'start') + T(282, 82, 'U₂ ' + fe(t.u2, 'V'), 'start') + T(282, 102, 'I₂ ' + fe(t.i2, 'A'), 'start') + T(200, 170, 'ü = ' + ff(t.ueb, 2), 'middle', 'font-size="14"');
      return svg('Transformator: Primärseite mit ' + ff(n.n1, 0) + ' Windungen und ' + fe(t.u1, 'V') + ', Sekundärseite mit ' + ff(n.n2, 0) + ' Windungen und ' + fe(t.u2, 'V') + ', Primärstrom ' + fe(t.i1, 'A') + ' bei ' + fe(t.i2, 'A') + ' Sekundärstrom', b, 184);
    },
    drehstrom: n => {
      const p = n && n.ph3, sm = n && n.smp3; if (!p || !sm || !okArr(sm.t, p.u1, p.u2, p.u3, p.sum)) return unavailable('Drei Strangspannungen im Drehstrom');
      const T0 = sm.T, pk = p.uHat;
      return plot('Drei Strangspannungen im Drehstrom, gegeneinander um ein Drittel der Periodendauer verschoben, ihre Summe ist null', {
        xmin: 0, xmax: T0, ymin: -pk * 1.1, ymax: pk * 1.1, xticks: [[0, '0'], [T0 / 2, fe(T0 / 2, 's')], [T0, fe(T0, 's')]], yticks: [[pk, fe(pk, 'V')], [0, '0'], [-pk, '−' + fe(pk, 'V')]], xtitle: 'Zeit t in s', ytitle: 'Strangspannung in V',
        series: [{ x: sm.t, y: p.u1, c: COL.u }, { x: sm.t, y: p.u2, c: COL.i, dash: '7 4' }, { x: sm.t, y: p.u3, c: COL.p, dash: '2 3' }, { x: sm.t, y: p.sum, c: COL.a, dash: '' }], legend: [{ t: 'U1', c: COL.u }, { t: 'U2', c: COL.i, dash: '7 4' }, { t: 'U3', c: COL.p, dash: '2 3' }, { t: 'Summe = 0', c: COL.a }]
      });
    },
    quer: () => {
      const box = (x, y, w, t) => RC(x, y, w, 40, 'currentColor', 'none', 8) + T(x + w / 2, y + 25, t, 'middle');
      return svg('Querverweise: das Wechselstrom-Lab in der Mitte, drumherum Netzteil-Lab, Sicherheits-Lab, EMV-Lab und MessLab', LN(120, 60, 160, 90, COL.k, 1.5) + LN(280, 60, 240, 90, COL.k, 1.5) + LN(120, 150, 160, 120, COL.k, 1.5) + LN(280, 150, 240, 120, COL.k, 1.5) +
        box(150, 85, 100, 'Wechselstrom') + box(10, 30, 118, 'Netzteil-Lab') + box(272, 30, 118, 'Sicherheit') + box(10, 130, 118, 'EMV-Lab') + box(272, 130, 118, 'MessLab'), 184);
    }
  };
  /* SVG-Texte: grobe Breitenschätzung (0,6 · Schriftgröße je Zeichen) gegen die Zeichenfläche. Bei 390 Pixel Seitenbreite wird die Zeichnung (Breite 400) auf etwa 334 Pixel verkleinert;
     SCALE390 = 334/400 ist der Verkleinerungsfaktor, die wirksame Schrift (Schrift · SCALE390) muss lesbar bleiben (Test: mindestens 10,5 Pixel). Browser misst zusätzlich mit getBBox. */
  const SCALE390 = (390 - 56) / 400;
  function svgTextCheck(markup, width) {
    const bad = [], vb = /viewBox="0 0 (\d+) (\d+)"/.exec(markup), W = vb ? +vb[1] : width || 400, root0 = /<svg[^>]*font-size="(\d+)"/.exec(markup), fs0 = root0 ? +root0[1] : 14, re = /<text\b([^>]*)>([^<]*)<\/text>/g; let m;
    while ((m = re.exec(markup))) {
      const at = k => { const q = new RegExp('(?:^|\\s)' + k + '="([^"]*)"').exec(m[1]); return q ? q[1] : null; }, x = +at('x'), fs = +(at('font-size') || fs0), t = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'), w = t.length * fs * 0.6, anc = at('text-anchor') || 'start';
      const x0 = anc === 'middle' ? x - w / 2 : anc === 'end' ? x - w : x, x1 = x0 + w;
      if (x0 < -1 || x1 > W + 1) bad.push(t + ' (' + Math.round(x0) + '…' + Math.round(x1) + ' von ' + W + ')');
      if (fs * SCALE390 < 10.5) bad.push(t + ' (Schrift zu klein bei 390 px: ' + (fs * SCALE390).toFixed(1) + ')');
    }
    return bad;
  }

  /* ============================================================ Abschnitte */
  const P = t => `<p>${t}</p>`, LI = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';
  const TB = (head, rows) => `<table class="rs"><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map((c, i) => `<td data-l="${esc(head[i] || '')}">${c}</td>`).join('')}</tr>`).join('')}</table>`;
  const NORM = () => TX('norm') || 'Norm und Vorschrift maßgeblich.';
  /* Auf dem Handy werden Tabellen zu Karten (Zeile = Karte, Spaltenkopf vor dem Inhalt), damit nichts seitlich abgeschnitten wird */
  const CSS = '@media(max-width:600px){.hl table.rs,.hl table.rs tbody{display:block;overflow:visible}.hl table.rs tr:first-child{display:none}.hl table.rs tr{display:block;padding:6px 0;border-top:1px solid var(--line)}.hl table.rs td{display:block;border:0;padding:2px 4px}.hl table.rs td::before{content:attr(data-l) ": ";color:var(--mute);font-size:11px;text-transform:uppercase;letter-spacing:.04em}.hl table.rs td:first-child::before{content:""}}.hl .kk{border-left:4px solid var(--accent);background:var(--well);padding:8px 12px;border-radius:6px;margin:8px 0}.hl ol,.hl ul{margin:.4em 0;padding-left:1.3em}.hl details.wsl-vertiefung{border-style:dashed;margin:10px 0 2px;padding:0 4px}.hl details.wsl-vertiefung>summary{font-size:14.5px}.hl .hb2 a{color:var(--accent)}';
  /* "Probier es aus": Beispiel wsx<n> (wenn WSL_DATA es kennt), sonst Voreinstellung des Prüfstands; { tab } wechselt den Tab */
  const TRY = [
    { ex: 'wsx1', rig: 'sinus', preset: 'netz-230' }, { ex: 'wsx2', rig: 'sinus', preset: 'phase-45' }, { ex: 'wsx5', rig: 'rlc', preset: 'spule' }, { ex: 'wsx6', rig: 'rlc', preset: 'kondensator', label: 'Kondensator ausprobieren' },
    { ex: 'wsx9', rig: 'rlc', preset: 'rlc-reihe' }, { rig: 'rlc', preset: 'parallel' }, { ex: 'wsx11', rig: 'leistung', preset: 'motor' }, { ex: 'wsx14', rig: 'kompens', preset: 'ziel-095' },
    { ex: 'wsx15', rig: 'kompens', preset: 'ueberkomp', label: 'Überkompensation ansehen' }, { ex: 'wsx17', rig: 'schwing', preset: 'reihe-10' }, { ex: 'wsx20', rig: 'schwing', preset: 'parallel-sperr' }, { ex: 'wsx19', rig: 'schwing', preset: 'niedrige-guete' },
    { ex: 'wsx23', rig: 'filter', preset: 'tiefpass-rc' }, { ex: 'wsx28', rig: 'filter', preset: 'tiefpass-rc', bode: true, label: 'Bode-Diagramm öffnen' }, { ex: 'wsx29', rig: 'trafo', preset: 'labor-230-12' }, { ex: 'wsx33', rig: 'drehstrom', preset: 'stern-400' },
    { tab: 'calc', label: 'Zum Rechner' }
  ];
  const tryBtn = a => '<div class="tryit">' + a.map((i, k) => { const t = TRY[i]; return t ? `<button class="btn${k ? '' : ' pri'}" data-try="${i}">${t.tab ? '🧮' : '▶'} ${esc(t.label || 'Probier es aus')}</button>` : ''; }).join('') + '</div>';
  const keyOf = (api, id) => { const K = (api && Array.isArray(api.KEYS) && api.KEYS) || (Array.isArray(root.WSL_KEYS) && root.WSL_KEYS) || []; return K.find(k => k && k.id === id) || null; };
  const noteLine = t => `<p class="kk"><b>${esc(t)}</b></p>`;
  function limitRows() { const C = CORE(), l = C && Array.isArray(C.limits) ? C.limits : []; return l.map(x => ({ id: x.id, text: x.text || '', lt: LT(x.id), status: x.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)', frage: x.frage || DASH })); }
  function limitTableHtml() { const r = limitRows(); if (!r.length) return P('Die Grenzwerte sind nicht geladen (wslcore.js fehlt).'); return `<div data-lim="1">` + TB(['Größe', 'Wert im Lab', 'Status', 'Frage'], r.map(x => [esc(x.text), '<b>' + esc(x.lt) + '</b>', esc(x.status), esc(x.frage)])) + '</div>'; }
  function sections(api) {
    const n = nums(), C = CORE(), out = [];
    const add = (id, title, html, tryIdx) => out.push({ id, title, html: html + (tryIdx && tryIdx.length ? tryBtn(tryIdx) : ''), tryIdx: tryIdx || null });
    const UN = n.un, FN = n.fn, UL = n.uAussen, VU = fe(UN, 'V'), HF = fe(FN, 'Hz'), VL = fe(UL, 'V'), sim = esc(TX('simOnly')), ue = esc(TX('ueberhoehung')), mod = esc(TX('modell'));
    const sin = n.sin || {}, sh = n.sh || {}, rl = n.rl || {}, rlc3 = n.rlc || {}, par = n.par || {}, mot = n.mot || {}, mes = n.mess || {}, nd = n.need || {}, rs = n.rs || {}, rp = n.rp || {}, g2 = n.g2 || {}, f1 = n.f1 || {}, tr = n.tr || {}, st = n.st || {};
    /* 1 */
    add('sinus', '1 Wechselspannung und Sinus', DRAW.sinus(n) +
      P('Eine <b>Wechselspannung</b> ändert dauernd Betrag und Richtung. Die Netzspannung ist ein Sinus: Netzfrequenz ' + esc(LT('f_netz')) + ', Netzspannung ' + esc(LT('u_netz')) + '. ' + sim) +
      TB(['Größe', 'Formel', 'Beispiel (Übungsschaltung, û = ' + fe(325.27, 'V') + ')'], [
        ['<b>Scheitelwert</b> û', 'größter Augenblickswert', esc(fe(sin.peak, 'V'))], ['<b>Effektivwert</b> U', esc('U = û / √2'), esc(tx(n.xEff))], ['<b>Gleichrichtwert</b> |u|', esc('|u| = 2 · û / π'), esc(tx(n.xGl))], ['<b>Formfaktor</b> F', esc('F = U / |u|'), esc('F = ' + ff(sin.formFactor, 4))],
        ['<b>Scheitelfaktor</b>', esc('û / U'), esc(ff(sin.crest, 4))], ['<b>Periodendauer</b> T', esc('T = 1 / f'), esc(tx(n.xT))], ['<b>Kreisfrequenz</b> ω', esc('ω = 2π · f'), esc(tx(n.xW))]]) +
      P(esc(TX('effHinweis')) + ' Beim Sinus gilt U = û · ' + esc(LT('eff_sinus')) + '; beim Rechteck ist der Effektivwert gleich dem Scheitelwert (Faktor ' + esc(LT('eff_rechteck')) + '): ' + esc(fe(gv(n.rect, 'rms'), 'V')) + ' bei û = ' + esc(fe(325.27, 'V')) + '.') +
      P('Der arithmetische <b>Mittelwert</b> einer reinen Wechselgröße ist über eine Periode ' + esc(fe(gv(sin, 'mean'), 'V')) + '. Das Messgerät mit Gleichrichtung zeigt den <b>Gleichrichtwert</b>, den Mittelwert des Betrags. Welche Mittelwerte unterrichtet werden, gleicht der Ausbilder ab (F1). ' + esc(TX('uebung'))), [0]);
    /* 2 */
    add('phase', '2 Phase und Zeiger', DRAW.phase(n) + DRAW.zeiger(n) +
      P('Zwei Sinusgrößen gleicher Frequenz können gegeneinander verschoben sein: Das ist die <b>Phasenverschiebung</b>, ihre Zahl ist der <b>Phasenwinkel</b> φ. Ein <b>Zeiger</b> stellt eine Sinusgröße dar: Seine Länge ist der Scheitelwert (oder der Effektivwert), sein Winkel zeigt die Lage zum Bezug. Der Zeiger dreht gegen den Uhrzeigersinn; ist seine Länge der Scheitelwert, ist die Höhe seiner Spitze über der Achse der Augenblickswert.') +
      LI([esc(tx(sh)), esc(tx(n.xDt)) + ' (Δt = φ / 360° · T, bei ' + HF + ' und ' + esc(deg(sh.phi)) + ').', esc(TX('konvention')), esc(TX('nurSinus'))]) +
      P('Sprich immer mit der Größe: „Die Spannung eilt dem Strom um 45° vor“ heißt, die Spannungskurve erreicht ihren Nulldurchgang früher. ' + esc(TX('uebung'))), [1]);
    /* 3 */
    add('lc', '3 Spule und Kondensator am Wechselstrom', DRAW.blind(n) +
      P('Spule und Kondensator setzen dem Wechselstrom einen <b>Blindwiderstand</b> entgegen, der von der Frequenz abhängt: Der Blindwiderstand der Spule wächst mit f, der des Kondensators sinkt mit f.') +
      TB(['Bauteil', 'Formel', HF, '100 Hz', 'Phasenverschiebung bei ' + VU + ' (Übungsschaltung)'], [
        ['<b>Spule</b> L = ' + esc(fe(0.1, 'H')), esc('X_L = 2π · f · L'), esc(fe(gv(n.xl50, 'value'), 'Ω')), esc(fe(gv(n.xl100, 'value'), 'Ω')), esc(tx(n.sL))],
        ['<b>Kondensator</b> C = ' + esc(fe(47e-6, 'F')), esc('X_C = 1 / (2π · f · C)'), esc(fe(gv(n.xc50, 'value'), 'Ω')), esc(fe(gv(n.xc100, 'value'), 'Ω')), esc(tx(n.sC))]]) +
      P(esc(TX('gleichstrom')) + ' Bei f = 0 gibt es keinen Blindwiderstand zu berechnen, das meldet der Kern als Gleichstrom.') +
      P('<b>Spule aus Messwerten:</b> Mit ' + VU + ', 2,5 A und 150 W (Übungsschaltung) folgt R = ' + esc(fe(gv(n.coil, 'r'), 'Ω')) + ', ' + esc(tx(n.xCoil)) + ', L = ' + esc(fe(gv(n.coil, 'l'), 'H')) + '. Eine reale Spule hat also Wirkwiderstand und Blindwiderstand.'), [2, 3]);
    /* 4 */
    add('reihe', '4 Reihenschaltung RLC', DRAW.spannung(n) +
      P('In der Reihenschaltung fließt überall derselbe Strom, er ist der Bezug. Die Teilspannungen addierst du <b>geometrisch</b>, nicht zahlenmäßig: U_L und U_C zeigen entgegengesetzt, U_R steht im rechten Winkel dazu. Daraus folgt der Scheinwiderstand (Impedanz) Z mit dem Pythagoras.') +
      TB(['Größe', 'Formel', 'R = ' + fe(22, 'Ω') + ', L = ' + fe(0.1, 'H') + ', ' + VU + ' (Übungsschaltung)'], [
        ['<b>Scheinwiderstand</b> Z', esc('Z = √(R² + (X_L − X_C)²)'), esc(tx(n.xZ))], ['<b>Strom</b> I', esc('I = U / Z'), esc(tx(n.xI))], ['<b>Phasenwinkel</b> φ', esc('φ = arctan((X_L − X_C) / R)'), esc(tx(n.xPhi))],
        ['<b>Gesamtspannung</b> U', esc('U = √(U_R² + (U_L − U_C)²)'), esc(tx(n.xU))]]) +
      P('Teilspannungen: U_R = ' + esc(fe(gv(rl, 'ur'), 'V')) + ', U_L = ' + esc(fe(gv(rl, 'ul'), 'V')) + ' (zusammen ' + esc(fe(gv(rl, 'ur') + gv(rl, 'ul'), 'V')) + ' zahlenmäßig, aber nur ' + esc(fe(gv(rl, 'uGeom'), 'V')) + ' geometrisch). ' + esc(tx(rl))) +
      P('<b>Mit Kondensator</b> (R = ' + esc(fe(100, 'Ω')) + ', L = ' + esc(fe(0.25, 'H')) + ', C = ' + esc(fe(4.7e-6, 'F')) + ', ' + VU + ', ' + HF + '): Z = ' + esc(fe(gv(rlc3, 'z'), 'Ω')) + ', I = ' + esc(a3(gv(rlc3, 'i'))) + ', ' + esc(tx(rlc3)) + ' Die Schaltung ist kapazitiv; U_C = ' + esc(fe(gv(rlc3, 'uc'), 'V')) + ' ist größer als die Quellenspannung ' + VU + '.') +
      P(esc(TX('konvention'))), [4]);
    /* 5 */
    add('parallel', '5 Parallelschaltung RLC', DRAW.strom(n) +
      P('In der Parallelschaltung liegt an allen Zweigen dieselbe Spannung, sie ist der Bezug. Die Zweigströme addierst du geometrisch: I_L und I_C zeigen entgegengesetzt, I_R steht im rechten Winkel dazu. Rechne mit den Leitwerten: Der <b>Scheinleitwert</b> Y ist der Kehrwert des Scheinwiderstands.') +
      TB(['Größe', 'Formel', 'R = ' + fe(100, 'Ω') + ', L = ' + fe(0.5, 'H') + ', C = ' + fe(10e-6, 'F') + ', ' + VU + ' (Übungsschaltung)'], [
        ['<b>Scheinleitwert</b> Y', esc('Y = √((1/R)² + (1/X_L − 1/X_C)²)'), esc(tx(n.xY))], ['<b>Zweigströme</b>', esc('I_R = U / R, I_L = U / X_L, I_C = U / X_C'), esc('I_R = ' + fe(gv(par, 'ir'), 'A') + ', I_L = ' + fe(gv(par, 'il'), 'A') + ', I_C = ' + fe(gv(par, 'ic'), 'A'))],
        ['<b>Gesamtstrom</b> I', esc('I = U · Y'), esc(fe(gv(par, 'i'), 'A') + ', Z = ' + fe(gv(par, 'z'), 'Ω'))]]) +
      P(esc(tx(par)) + ' Der Strom in der Spule ist größer als der im Kondensator, deshalb überwiegt der induktive Anteil. ' + esc(TX('konvention'))), [5]);
    /* 6 */
    add('leistung', '6 Wirk-, Blind- und Scheinleistung, cos φ', DRAW.leistung(n) +
      P('Die <b>Wirkleistung</b> P (Einheit W) wird in Wärme, Licht oder Bewegung umgesetzt. Die <b>Blindleistung</b> Q (Einheit var) pendelt zwischen Quelle und Spule oder Kondensator und leistet keine Arbeit. Die <b>Scheinleistung</b> S (Einheit VA) ist das Produkt aus U und I. Der <b>Leistungsfaktor</b> cos φ = P / S sagt, welcher Anteil Wirkleistung ist.') +
      TB(['Größe', 'Formel', 'Motor, 3,2 kW, cos φ 0,8, ' + VU + ' (Übungsschaltung)'], [
        ['<b>Scheinleistung</b> S', esc('S = U · I'), esc(fe(gv(mot, 's'), 'VA') + ' bei I = ' + fe(gv(mot, 'i'), 'A'))], ['<b>Blindleistung</b> Q', esc('Q = √(S² − P²)'), esc(tx(n.xQ))], ['<b>Wirkleistung</b> P', esc('P = U · I · cos φ'), esc(fe(gv(mot, 'p'), 'W'))], ['<b>Leistungsfaktor</b>', esc('cos φ = P / S'), esc(tx(n.xCos))]]) +
      P('<b>Aus Messwerten</b> (100 V, 0,25 A, 12 W, Übungsschaltung): S = ' + esc(fe(gv(mes, 's'), 'VA')) + ', Q = ' + esc(fe(gv(mes, 'q'), 'var')) + ', cos φ = ' + esc(ff(gv(mes, 'cosphi'), 2)) + '. Ein kleiner Leistungsfaktor heißt: viel Strom für wenig Wirkleistung.'), [6]);
    /* 7 */
    add('komp', '7 Kompensation', DRAW.komp(n) +
      P('Ein Motor nimmt Blindleistung auf, die Leitung muss den Strom dafür mittragen. Die <b>Kompensation</b> schaltet einen Kondensator <b>parallel</b> zur Last; er liefert die Blindleistung vor Ort, der Strom aus dem Netz sinkt, die Wirkleistung bleibt. ' + esc(TX('kompNurParallel'))) +
      TB(['Größe', 'Formel', 'Motor, 3,2 kW, cos φ 0,8 auf Ziel ' + LT('cos_ziel') + ', ' + VU + ', ' + HF + ' (Übungsschaltung)'], [
        ['<b>Kompensationsblindleistung</b> Q_C', esc('Q_C = P · (tan φ₁ − tan φ₂)'), esc(tx(n.xQc))], ['<b>Kondensator</b> C', esc('C = Q_C / (ω · U²)'), esc(tx(n.xC))],
        ['<b>Strom aus dem Netz</b>', esc('vorher / nachher'), esc(fe(gv(nd, 'i1'), 'A') + ' / ' + fe(gv(nd, 'i2'), 'A'))], ['<b>Blindleistung</b>', esc('vorher / nachher'), esc(fe(gv(nd, 'q1'), 'var') + ' / ' + fe(gv(nd, 'q2'), 'var'))]]) +
      P('Zielwerte im Lab: ' + esc(LT('cos_ziel')) + ' und ' + esc(LT('cos_ziel2')) + '. Vorgaben des Netzbetreibers sind kein Lab-Thema: ' + esc(NORM())) +
      P('<b>Überkompensation:</b> ' + esc(tx(n.over)) + ' Mehr Kondensator ist also nicht besser, die Kompensation endet bei dem Wert, der das Ziel trifft.'), [7, 8]);
    /* 8 */
    add('reihenkreis', '8 Reihenschwingkreis', noteLine(TX('ueberhoehung')) + DRAW.reihe(n) +
      P('Ein <b>Schwingkreis</b> aus Spule und Kondensator hat eine <b>Resonanzfrequenz</b> f₀, bei der X_L und X_C gleich groß sind. Im <b>Reihenschwingkreis</b> heben sich die Blindwiderstände auf: ' + esc(LT('res_reihe'))) +
      TB(['Größe', 'Formel', 'L = ' + fe(1e-3, 'H') + ', C = ' + fe(100e-9, 'F') + ', R = ' + fe(10, 'Ω') + ' (Übungsschaltung)'], [
        ['<b>Resonanzfrequenz</b> f₀', esc('f₀ = 1 / (2π · √(L · C))'), esc(tx(n.xF0))], ['<b>Kennwiderstand</b> Z₀', esc('Z₀ = √(L / C)'), esc(tx(n.xZ0))], ['<b>Bandbreite</b> mit f_u und f_o', esc('B = f_o − f_u'), esc(fe(gv(rs, 'b'), 'Hz') + ' (' + fe(gv(rs, 'fu'), 'Hz') + ' bis ' + fe(gv(rs, 'fo'), 'Hz') + ')')]]) +
      P('<b>Spannungsüberhöhung (Lehrbeispiel):</b> Mit R = ' + esc(fe(22, 'Ω')) + ', L = ' + esc(fe(0.2, 'H')) + ' und C = ' + esc(fe(gv(n.tune, 'c'), 'F')) + ' (Resonanz bei ' + esc(fe(gv(n.tune, 'f0'), 'Hz')) + ') und ' + VU + ' Quellenspannung liegen an der Spule ' + esc(ff(gv(ob(n.ueh, 'resonanz'), 'ul'), 1)) + ' V und am Kondensator ebenso viel (U_L = U / R · X_L = ' + esc(ff(gv(n.xUL, 'value'), 1)) + ' V). '
      + 'Die Bauteile müssen diese Spannung aushalten: Das ist ein Auslegungskriterium, kein Versuch. Ein geladener Kondensator speichert Ladung: Entladen vor Berühren.') +
      P(sim) + noteLine(TX('ueberhoehung')), [9]);
    /* 9 */
    add('parallelkreis', '9 Parallelschwingkreis (Sperrkreis)', noteLine(TX('ueberhoehung')) + DRAW.sperr(n) +
      P('Im <b>Parallelschwingkreis</b> liegen Spule und Kondensator parallel. Bei f₀ heben sich ihre Ströme gegenseitig auf: ' + esc(LT('res_parallel')) + ' Deshalb heißt er auch <b>Sperrkreis</b>: Er sperrt die Frequenz f₀.') +
      TB(['Größe', 'Wert', 'L = ' + fe(1e-3, 'H') + ', C = ' + fe(100e-9, 'F') + ', R_p = ' + fe(1000, 'Ω') + ' parallel, 10 V (Übungsschaltung)'], [
        ['<b>Resonanzfrequenz</b> f₀', esc('wie beim Reihenkreis'), esc(fe(gv(rp, 'f0'), 'Hz'))], ['<b>Scheinwiderstand bei f₀</b>', esc('Z = R_p'), esc(fe(gv(ob(rp, 'resonanz'), 'z'), 'Ω'))], ['<b>Strom aus der Quelle</b>', esc('am kleinsten'), esc(fe(gv(ob(rp, 'resonanz'), 'i'), 'A'))],
        ['<b>Strom im Kreis</b> (Spule und Kondensator)', esc('I_L = I_C'), esc(fe(gv(ob(rp, 'resonanz'), 'kreisstrom'), 'A'))]]) +
      P('Der Kreisstrom ist viel größer als der Strom aus der Quelle, und zwar um den Faktor ' + esc(ff(gv(rp, 'qg'), 2)) + ' (die Güte, Abschnitt 10). Das ist die Stromüberhöhung im Kreis: ein Auslegungskriterium für Spule und Kondensator, kein Versuch.') +
      P('<b>Modell (F5):</b> Das Lab rechnet mit einem Verlustwiderstand R_p <b>parallel</b> zum Kreis (Lehrmodell). Eine reale Spule mit Wicklungswiderstand R_L ersetzt du näherungsweise durch R_p = Z₀² / R_L: Mit R_L = ' + esc(fe(10, 'Ω')) + ' ergibt das ' + esc(fe(gv(n.rpL, 'rp'), 'Ω')) + '. ' + esc(n.rpL && n.rpL.hinweis ? n.rpL.hinweis : '')) +
      P(sim) + noteLine(TX('ueberhoehung')), [10]);
    /* 10 */
    add('guete', '10 Güte und Bandbreite', DRAW.guete(n) +
      P('Die <b>Güte</b> Q_G (Formelzeichen mit Index G, damit sie nicht mit der Blindleistung Q verwechselt wird) sagt, wie scharf ein Schwingkreis abstimmt. Die <b>Bandbreite</b> B ist der Abstand der beiden Grenzfrequenzen, an denen der Strom auf ' + esc(LT('fg_betrag')) + ' des Höchstwerts gefallen ist (' + esc(LT('fg_db')) + ').') +
      TB(['Größe', 'Formel', 'R = ' + fe(10, 'Ω') + ' (Übungsschaltung)', 'R = ' + fe(20, 'Ω')], [
        ['<b>Güte Reihenkreis</b>', esc('Q_G = Z₀ / R'), esc(tx(n.xG)), esc('Q_G = ' + ff(gv(g2, 'qg'), 3))], ['<b>Güte Parallelkreis</b>', esc('Q_G = R_p / Z₀'), esc(tx(n.xGp) + ' (R_p = ' + fe(1000, 'Ω') + ')'), esc(tx(n.xGp2) + ' (R_p = ' + fe(2000, 'Ω') + ')')],
        ['<b>Bandbreite</b>', esc('B = f₀ / Q_G'), esc(tx(n.xB)), esc(tx(n.xB2))], ['<b>Untere und obere Grenzfrequenz</b>', esc('exakt aus der Kurve'), esc(fe(gv(rs, 'fu'), 'Hz') + ' bis ' + fe(gv(rs, 'fo'), 'Hz')), esc(fe(gv(g2, 'fu'), 'Hz') + ' bis ' + fe(gv(g2, 'fo'), 'Hz'))]]) +
      P('Verdoppelst du den Verlustwiderstand, sinkt die Güte von ' + esc(ff(gv(rs, 'qg'), 2)) + ' auf ' + esc(ff(gv(g2, 'qg'), 2)) + ' und die Bandbreite steigt von ' + esc(fe(gv(rs, 'b'), 'Hz')) + ' auf ' + esc(fe(gv(g2, 'b'), 'Hz')) + '. Hohe Güte heißt: schmale Kurve, scharfe Trennung. Das Lab rechnet die Grenzfrequenzen exakt: B = f₀ / Q_G, f_u · f_o = f₀² und f_o − f_u = B. Nur näherungsweise liegen f_u und f_o symmetrisch bei f₀ ∓ B / 2. Welche Definition von Güte und Bandbreite gelehrt wird (Frage F4), gleicht der Ausbilder ab.'), [11]);
    /* 11 */
    const dp = deepState(api), bk = keyOf(api, 'bode'), bT = n.bT || {};
    add('filter', '11 RC- und RL-Filter, Grenzfrequenz', DRAW.filter(n) +
      P('Ein <b>Tiefpass</b> lässt tiefe Frequenzen durch und dämpft hohe, ein <b>Hochpass</b> macht es umgekehrt. Der RC-Tiefpass besteht aus R in Reihe und C nach Masse; beim Hochpass tauschen R und C die Plätze. Die <b>Grenzfrequenz</b> f_g trennt Durchlass- und Sperrbereich.') +
      TB(['Größe', 'Formel', 'Beispiel (Übungsschaltung)'], [
        ['<b>Grenzfrequenz RC</b>', esc('f_g = 1 / (2π · R · C)'), esc('R = ' + fe(1000, 'Ω') + ', C = ' + fe(100e-9, 'F') + ': ' + tx(n.xFg))], ['<b>Grenzfrequenz RL</b>', esc('f_g = R / (2π · L)'), esc('R = ' + fe(100, 'Ω') + ', L = ' + fe(0.1, 'H') + ': ' + tx(n.xFgL))],
        ['<b>Zeitkonstante</b> τ', esc('τ = R · C'), esc(tx(n.xTau))], ['<b>Übertragungsverhältnis</b>', esc('|H| = 1 / √(1 + (f / f_g)²)'), esc(tx(n.xH) === DASH ? DASH : '|H| = ' + ff(gv(n.xH, 'value'), 4) + ' bei f = f_g')], ['<b>Dämpfungsmaß</b>', esc('a = 20 · lg |H|'), esc(tx(n.xDb))]]) +
      P('<b>Bei der Grenzfrequenz</b> gilt: |H| = ' + esc(LT('fg_betrag')) + ', Dämpfungsmaß ' + esc(LT('fg_db')) + ', Phase ' + esc(LT('fg_phase')) + ' (Betrag, beim Tiefpass nacheilend), Blindwiderstand X_C = ' + esc(LT('fg_xc')) + '. Im Beispiel: |H| = ' + esc(ff(gv(f1, 'h'), 4)) + ', ' + esc(fe(gv(f1, 'a'), 'dB')) + ', Phase ' + esc(deg(gv(f1, 'phi'))) + '.') +
      LI(['<b>Hochpass</b> (R = ' + esc(fe(15000, 'Ω')) + ', C = ' + esc(fe(100e-9, 'F')) + '): f_g = ' + esc(fhz(gv(n.f3, 'fg'))) + ', Phase bei f_g: ' + esc(deg(gv(n.f3, 'phi'))) + '.', '<b>Tiefpass</b> (R = ' + esc(fe(10000, 'Ω')) + ', C = ' + esc(fe(47e-9, 'F')) + '): f_g = ' + esc(fhz(gv(n.f2, 'fg'))) + '.',
        '<b>Siebglied</b> (R = ' + esc(fe(470, 'Ω')) + ', C = ' + esc(fe(2.2e-6, 'F')) + ', 4 V bei 100 Hz): U₂ = ' + esc(ff(gv(n.sieve, 'u2'), 3) + ' V') + '. Hier nur als Filter, die Brummrechnung gehört ins Netzteil-Lab.', esc(TX('rlIdeal')), 'Am Rechteck verschleift der Tiefpass die Flanken, der Hochpass macht Nadelimpulse; nach ' + esc(LT('tau_5')) + ' ist der Ausgleichsvorgang abgeschlossen.']) +
      `<details class="wsl-vertiefung" data-deep="bode"${dp ? ' open' : ''}><summary>Vertiefung: Bode-Diagramm&nbsp;<span class="bdg uw">Vertiefung</span></summary><div class="hb2">` + DRAW.bode(n) +
      P('Im <b>Bode-Diagramm</b> trägst du das Dämpfungsmaß in dB und die Phase über der Frequenz auf einer logarithmischen Achse (Dekaden) auf. Die gestrichelten Asymptoten treffen sich im Knick bei der Grenzfrequenz. ' + esc(bT.text || DASH)) +
      LI(['Steigung des Tiefpasses oberhalb f_g: <b>' + esc(bT.steigungText || DASH) + '</b>; beim Hochpass unterhalb f_g: ' + esc(gv(n.bH, 'steigung') ? (n.bH.steigungText || DASH) : DASH) + '.', 'Phase des Tiefpasses bei f_g: ' + esc(deg(gv(ob(bT, 'knick'), 'phi'))) + ', Hochpass: ' + esc(deg(gv(ob(ob(n, 'bH'), 'knick'), 'phi'))) + '.', esc(bk ? 'Taste ' + (bk.keys || []).join(' oder ') + ': ' + bk.t : 'Die Taste für die Bode-Vertiefung steht in den Tastenkürzeln.')]) +
      P(esc(TX('filterNurErsteOrdnung')) + ' Weitere Vertiefungen der Analogtechnik folgen später in anderen Labs.') + '</div></details>', [12, 13]);
    /* 12 */
    add('trafo', '12 Transformator', DRAW.trafo(n) +
      P('Ein <b>Transformator</b> überträgt Wechselspannung zwischen zwei Wicklungen, die nur magnetisch gekoppelt sind. Die <b>Primärseite</b> liegt an der Quelle, die <b>Sekundärseite</b> an der Last. ' + esc(LT('trafo_ueb'))) +
      TB(['Größe', 'Formel', 'N₁ = 1150, N₂ = 69, ' + VU + ', I₂ = ' + fe(2.5, 'A') + ' (Übungsschaltung)'], [
        ['<b>Übersetzungsverhältnis</b> ü', esc('ü = N₁ / N₂ = U₁ / U₂'), esc(tx(n.xUeb))], ['<b>Sekundärspannung</b> U₂', esc('U₂ = U₁ / ü'), esc(fe(gv(tr, 'u2'), 'V'))], ['<b>Primärstrom</b> I₁', esc('I₁ = I₂ · N₂ / N₁'), esc(tx(n.xI1))]]) +
      P('Ein Kleintransformator ' + VU + ' auf 12 V (N₁ = 1150, N₂ = 60, I₂ = ' + esc(fe(2, 'A')) + ', Übungsschaltung): ü = ' + esc(ff(gv(n.trK, 'ueb'), 2)) + ', I₁ = ' + esc(ma1(gv(n.trK, 'i1'))) + '. Mehr Strom auf der Sekundärseite bedeutet mehr Strom auf der Primärseite.') +
      P(esc(TX('trafoModell')) + ' Im Lehrmodell gelten als Übungswerte: Kurzschlussspannung ' + esc(LT('trafo_uk')) + ', Eisenverlust ' + esc(LT('trafo_pfe')) + '. Verluste senken die Spannung unter Last leicht und den Wirkungsgrad (η = P₂ / (P₂ + P_Cu + P_Fe)).') +
      P('<b>Fehlerbild Gleichspannung:</b> ' + esc(LT('trafo_dc')) + '. ' + esc(n.dc && n.dc.why ? n.dc.why : DASH) + ' Das ist ein Beispiel in der Simulation (12 V und 5 Ω, Übungsschaltung), kein Versuch.') + P(sim), [14]);
    /* 13 */
    add('drehstrom', '13 Drehstrom (kurz)', DRAW.drehstrom(n) +
      P('Im <b>Drehstrom</b> gibt es drei Außenleiter, deren Spannungen um ein Drittel der Periodendauer (120°) verschoben sind; ihre Summe ist in jedem Augenblick null. Zwischen Außenleiter und <b>Sternpunkt</b> liegt die Strangspannung, zwischen zwei Außenleitern die Außenleiterspannung. Im Lab gilt ' + esc(LT('u_aussen')) + '.') +
      TB(['Größe', 'Formel', 'Stern, ' + VL + ', I_L = ' + fe(10, 'A') + ', cos φ 0,8 (Übungsschaltung)'], [
        ['<b>Strangspannung</b> U_Str', esc('U_L = √3 · U_Str'), esc(fe(gv(st, 'ustr'), 'V') + ' → ' + tx(n.xUa) + ', im Lab ' + LT('u_aussen'))], ['<b>Wirkleistung</b> P', esc('P = √3 · U_L · I_L · cos φ'), esc(tx(n.xP))],
        ['<b>Scheinleistung</b> S', esc('S = √3 · U_L · I_L'), esc(fe(gv(st, 's'), 'VA'))], ['<b>Blindleistung</b> Q', esc('Q = √(S² − P²)'), esc(fe(gv(st, 'q'), 'var'))]]) +
      P('<b>Stern und Dreieck</b> als Rechenvergleich: ' + esc(tx(n.dp)) + ' (Übungsschaltung: gleiche Last, ' + VL + ', Strangwiderstand ' + esc(fe(40, 'Ω')) + '). ' + esc(TX('dreiOhne'))) +
      P('Das Lab rechnet nur. ' + sim), [15]);
    /* 14 */
    add('quer', '14 Querverweise', DRAW.quer() + LI([
      '<b><a href="ntslab.html">Netzteil-Lab</a>:</b> Gleichrichtung, Siebung, Regler und Schaltregler. Hier kommen nur der Transformator und das RC-Siebglied als Wechselstrombauteile vor.',
      '<b><a href="elslab.html">Sicherheits-Lab</a>:</b> Schutzmaßnahmen, Netzformen und Ableitströme. Hier rechnest du nur die Wechselstromphysik, etwa den Blindwiderstand eines Kondensators.',
      '<b><a href="emvlab.html">EMV-Lab</a>:</b> Filter als Entstörmaßnahme. Hier lernst du den Filter als Grundschaltung mit Grenzfrequenz und Bode-Diagramm.',
      '<b><a href="messlab.html">MessLab</a>:</b> Messgeräte und Oszilloskop bedienen. Hier liest du nur die Darstellung ab.',
      '<b><a href="enrlab.html">Energie-Lab</a>:</b> Scheinleistung und cos φ im Inselnetz; die Grundlagen stehen in Abschnitt 6.',
      '<b><a href="pruefungslab.html?thema=wechselstrom">Prüfungs-Lab</a>:</b> Pool-Fragen zum Thema Wechselstrom (nur Lesen).']) +
      P('Weitere Vertiefungen der Analogtechnik (Bode-Diagramm beim Operationsverstärker, Slew-Rate, Offset, Sättigung) folgen später in anderen Labs. Hier gibt es nur das Bode-Diagramm für RC- und RL-Glieder. ' + esc(NORM())), null);
    add('formeln', '15 Formelsammlung und feste Werte', formulaTableHtml() + P('<b>Alle festen Werte des Labs</b> aus einer Tabelle (✓ belegt: Quelle im Prüfungspool oder vom Ausbilder; Übungswert (A): Der Ausbilder gleicht ab):') + limitTableHtml(), [16]);
    add('glossar', '16 Glossar', glossaryHtml(), null);
    add('tasten', '17 Tastenkürzel', keysTableHtml(api), null);
    return out;
  }
  /* Tabellen aus Kern und KEYS (nichts davon steht hier von Hand) */
  function formulaRows() { const C = CORE(), f = C && C.formulas; if (!f) return []; const l = typeof f.list === 'function' ? f.list() : []; return (l || []).filter(x => x && x.id).map(x => ({ id: x.id, name: x.name || x.id, symbol: x.symbol || '', expr: x.expr || '', unit: x.unit || '', explain: x.explain || '' })); }
  function formulaTableHtml() { const r = formulaRows(); if (!r.length) return P('Der Rechenkern ist nicht geladen (wslcore-res.js fehlt): Ohne ihn gibt es keine Formelsammlung.'); return P('Alle Formeln des Labs aus einer Tabelle. Im Tab „Rechnen“ setzt du Zahlen ein und siehst den Rechenweg.') + TB(['Größe', 'Formel', 'Einheit', 'Hinweis'], r.map(x => [esc(x.name), esc(x.expr), esc(x.unit || DASH), esc(x.explain)])); }
  function glossaryRows() { const C = CORE(), g = C && C.glossary, items = g && typeof g.list === 'function' ? g.list() : (Array.isArray(g) ? g : []); return (items || []).filter(x => x && x.term).map(x => ({ term: x.term, genus: x.genus || '', abbr: x.abbr || '', unit: x.unit || '', text: x.text || '' })); }
  function glossaryHtml() {
    const r = glossaryRows(); if (!r.length) return P('Das Glossar ist nicht geladen (wslcore.js fehlt).');
    return TB(['Begriff', 'Bedeutung'], r.map(x => [`<b>${esc((x.genus ? x.genus + ' ' : '') + x.term)}</b>${x.abbr || x.unit ? ' (' + esc([x.abbr, x.unit].filter(Boolean).join('; ')) + ')' : ''}`, esc(x.text)]));
  }
  function keyRows(api) { const K = (api && Array.isArray(api.KEYS) && api.KEYS) || (Array.isArray(root.WSL_KEYS) && root.WSL_KEYS) || []; return K.filter(k => k).map(k => ({ keys: Array.isArray(k.keys) ? k.keys : [], t: k.t || '' })); }
  function keysTableHtml(api) { const r = keyRows(api); return r.length ? TB(['Taste', 'Wirkung'], r.map(k => [k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder '), esc(k.t)])) + '<p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>' : P('Die Tastenkürzel sind nicht geladen.'); }
  /* Zustand der Bode-Vertiefung (wsl.deep): über api.deep, sonst über den Speicher der Oberfläche */
  let API0 = null;
  function deepState(api) { try { if (api && api.deep && typeof api.deep.get === 'function') { const d = api.deep.get(); return !!(d && d.bode); } if (api && typeof api.lsGet === 'function') { const d = api.lsGet('wsl.deep', {}); return !!(d && d.bode); } } catch (e) { /* zu */ } return false; }
  function deepSave(api, open) {
    try {
      if (api && api.deep && typeof api.deep.set === 'function') { if (deepState(api) !== !!open) api.deep.set('bode', !!open); return true; }
      if (api && typeof api.lsGet === 'function' && typeof api.lsSet === 'function') { const d = api.lsGet('wsl.deep', {}), o = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; if (!!o.bode !== !!open) { o.bode = !!open; if (open) o.n = (+o.n || 0) + 1; api.lsSet('wsl.deep', o); } return true; }
    } catch (e) { /* kein Absturz */ }
    return false;
  }
  const exampleExists = id => { const d = root.WSL_DATA, a = d && d.examples; return !!(Array.isArray(a) && a.some(x => x && x.id === id)); };
  X.help = X.help || {};
  X.help.render = function (host, api) {
    if (!host) return; api = api || {}; API0 = api;
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('wsl-help-css')) { const s = document.createElement('style'); s.id = 'wsl-help-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!CORE()) { host.innerHTML = `<div class="card pl"><p class="big">Lernen wird geladen</p><p class="hint2">Der Rechenkern ist nicht geladen (wslcore.js fehlt). Ohne ihn gibt es hier keine Zahlen und Tabellen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    const secs = sections(api);
    host.innerHTML = `<div class="card pl"><h4>Lernen</h4><p class="hint2" style="margin:0">Wechselstrom und Schwingkreise, kurz erklärt. Jeder Abschnitt mit Versuch hat einen Knopf „Probier es aus“, der den passenden Prüfstand lädt. Alle Zahlen stammen aus derselben Rechnung wie im Rechner; Übungswerte tragen das Zeichen „Übungswert (A)“, Bauteilwerte der Beispiele heißen „Übungsschaltung“. ${esc(TX('simOnly'))}</p></div><div class="hl">` +
      secs.map((s, i) => `<details${i === 0 ? ' open' : ''} data-sec="${esc(s.id)}"><summary>${esc(s.title)}</summary><div class="hb2">${s.html}</div></details>`).join('') + '</div>';
    if (!host.addEventListener) return;
    once(host, 'help', 'click', e => {
      const b = e.target && e.target.closest && e.target.closest('[data-try]'); if (!b) return; const t = TRY[+b.dataset.try]; if (!t) return; const a = API0 || {};
      if (t.tab) { if (a.setTab) a.setTab(t.tab); return; }
      if (t.bode) deepSave(a, true);
      let ok = false; if (t.ex && a.loadExample && exampleExists(t.ex)) ok = a.loadExample(t.ex) !== false;
      if (!ok && a.loadRig) a.loadRig({ rig: t.rig, preset: t.preset, tab: 'rig', name: 'Probier es aus', toast: 'Geladen: ' + (t.label || t.rig) });
    });
    /* toggle sprudelt nicht nach oben: Erfassungsphase am Host */
    once(host, 'deep', 'toggle', e => { const d = e.target; if (!d || !d.dataset || d.dataset.deep !== 'bode') return; deepSave(API0, !!d.open); }, true);
  };
  X.help.fn = { nums, FX, FV, FT, LT, LV, TX, sections, formulaRows, formulaTableHtml, glossaryRows, glossaryHtml, keyRows, keysTableHtml, limitRows, limitTableHtml, svgTextCheck, DRAW, TRY, NORM, exampleExists, wrap, SCALE390, deepState, deepSave, plot, tri };
  if (typeof module !== 'undefined') module.exports = X.help;
})(typeof window !== 'undefined' ? window : globalThis);
