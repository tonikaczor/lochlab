'use strict';
/* Tonfunk Analogtechnik-Lab (ANA-Lab): Tab "Lernen" (WP3d, SPEC 6.5).
   26 ausklappbare Abschnitte mit SVG-Zeichnungen, fast alle mit "Probier es aus"-Knopf (lädt ein Beispiel aex<n>, wenn ANA_DATA es kennt, sonst eine Voreinstellung des Prüfstands).
   Tabellen und Zahlen kommen AUS DEM KERN und den Tabellen der Oberfläche (SPEC Regel 1, 5, 7): Formelsammlung aus ANA_CORE.formulas, Glossar aus ANA_CORE.glossary,
   Tastenkürzel aus api.KEYS (sonst window.ANA_KEYS), feste Werte NUR über ANA_CORE.limitText / limits, Texte über ANA_CORE.TEXTS. Jede Zahl im Fließtext und in den Zeichnungen
   stammt aus derselben Kernfunktion wie die Rechnung im Rechner und in der Prüfung (diode, tr, emit, grund, op, komp, act, deep, formulas, diagnose); die Kennlinien und Verläufe
   in den Zeichnungen sind die curves() und waveform() der Prüfstände (ANA_RIGS, ihrerseits aus dem Kern). Fehlt eine Funktion, steht ein Strich statt einer Zahl.
   Es gibt keine zweite Formelimplementierung; die Zeichnungen rechnen nur Bildkoordinaten.
   Übungswerte (Status A) erscheinen immer mit dem Kennzeichen aus limitText ("(Übungswert)"), belegte Werte mit "✓"; Bauteilwerte der Beispiele heißen "Übungsschaltung".
   Sicherheit (SPEC 9): Kleinspannung, keine Aufbau- oder Messanleitung für Netzspannung; die Abschnitte 5, 6 und 13 tragen den Satz "Ein defekter Aufbau wird hier nur simuliert."
   Verdeckter Fehler (SPEC 11 (i)): Die Beispiele zur Fehlersuche (Abschnitt 22) stehen erst nach einem Klick auf "Messbilder aufdecken" im Text und nur, wenn keine Aufgabe offen ist;
   im festen Text steht kein Fehlerfall-Name der Prüfstände.
   Die Vertiefungen Bode/GBW, Slew-Rate, Offset und Sättigung (Abschnitte 17 bis 20) sind aufklappbare <details class="ana-vertiefung" data-deep="..."> mit dem Zustand in ana.deep (api.deep).
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.help = { render(host, api), refresh(), fn }. Die reinen Funktionen (ohne DOM) hängen unter ANA_UI_EXT.help.fn und werden von test_anaui_help.js geprüft. */
(function (root) {
  const X = root.ANA_UI_EXT = root.ANA_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn, cap) => { host.__anahl = host.__anahl || {}; if (host.__anahl[name + ty]) return; host.__anahl[name + ty] = 1; host.addEventListener(ty, fn, !!cap); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ANA_CORE;
  const DASH = '–';
  const SIMNUR = 'Ein defekter Aufbau wird hier nur simuliert.';
  const DATENBLATT = 'Typnamen und Datenblattwerte gibt es hier nicht: Das Datenblatt ist maßgeblich.';
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
  const deg = x => (fin(x) ? ff(x, 1) + '°' : DASH);
  const pct = x => (fin(x) ? ff(x * 100, 2) + ' %' : DASH);
  /* Funktionsaufruf im Kern über Pfad ("diode.operating"); null bei fehlender Funktion, Ausnahme oder ok:false */
  const call = (path, ...args) => { const C = CORE(); let o = C, ctx = null; for (const k of path.split('.')) { ctx = o; o = o && o[k]; } if (typeof o !== 'function') return null; try { const r = o.apply(ctx, args); return r && r.ok === false ? null : r; } catch (e) { return null; } };
  /* Formel: calc-Ergebnis (Wert und Text); null, wenn der Kern die Formel nicht hat oder sie ungültig meldet */
  const FX = (id, o) => { const C = CORE(), f = C && C.formulas && C.formulas[id]; if (!f || typeof f.calc !== 'function') return null; try { const r = f.calc(o); return r && r.ok !== false && r.valid !== false && fin(r.value) ? r : null; } catch (e) { return null; } };
  const FV = (id, o) => { const r = FX(id, o); return r ? r.value : NaN; };
  const FT = (id, o) => { const r = FX(id, o); return r ? r.text : DASH; };
  /* Grenzwerttext mit Statuszeichen nur aus dem Kern: Übungswert (A) trägt "(Übungswert)", ein belegter Wert "✓"; jede Verwendung wird für den Test vermerkt */
  const LTLOG = [];
  const LT = id => {
    const C = CORE(); if (!C || typeof C.limitText !== 'function') return DASH;
    try {
      let t = C.limitText(id); if (typeof t !== 'string' || !t) return DASH;
      const l = typeof C.limit === 'function' ? C.limit(id) : null;
      if (l && l.status === 'belegt') t += ' ✓';
      LTLOG.push({ id, text: t, status: l ? l.status : '?' });
      return t;
    } catch (e) { return DASH; }
  };
  const LV = id => { const C = CORE(); if (C && typeof C.limit === 'function') { try { const l = C.limit(id); if (l && fin(l.value)) return l.value; } catch (e) { /* NaN */ } } return NaN; };
  const TX = k => { const C = CORE(), t = C && C.TEXTS && C.TEXTS[k]; return typeof t === 'string' ? t : ''; };
  const gv = (o, k) => (o && fin(o[k]) ? o[k] : NaN);
  const ix = (o, k, i) => (o && Array.isArray(o[k]) && fin(o[k][i]) ? o[k][i] : NaN);
  const ob = (o, k) => (o && o[k] && typeof o[k] === 'object' ? o[k] : null);
  const tx = o => (o && typeof o.text === 'string' ? o.text : DASH);

  /* ============================================================ Prüfstände (nur Lesen: curves() und waveform() liefern die Kennlinien und Verläufe aus dem Kern) */
  function mkRig(id, preset, over) {
    const R = root.ANA_RIGS; if (!R || !R.defs || !R.defs[id] || typeof R.create !== 'function') return null;
    try {
      const r = R.create(id, { seed: 1 });
      if (preset && typeof r.applyPreset === 'function') r.applyPreset(preset);
      Object.keys(over || {}).forEach(k => { if (typeof r.setControl === 'function') r.setControl(k, over[k]); });
      return r;
    } catch (e) { return null; }
  }
  function rigCurve(id, preset, over, cid) { const r = mkRig(id, preset, over); if (!r || typeof r.curves !== 'function') return null; try { const l = r.curves(); return (Array.isArray(l) ? l : []).find(c => c && c.id === cid) || null; } catch (e) { return null; } }
  function rigWave(id, preset, over) { const r = mkRig(id, preset, over); if (!r || typeof r.waveform !== 'function') return null; try { const w = r.waveform(); return w && Array.isArray(w.t) && Array.isArray(w.series) ? w : null; } catch (e) { return null; } }

  /* ============================================================ Zahlenblatt: jede Zahl im Fließtext, mit der Kernfunktion, aus der sie stammt (Test rechnet jede unabhängig nach) */
  /* Übungsschaltung Emitterschaltung (R_E = R_E1 + R_E2 = 570 Ω, Teiler 47 kΩ / 10 kΩ, Quelle 600 Ω, Last 10 kΩ) */
  const EC = { ub: 12, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: true, b: 100, rg: 600, rl: 10000, c1: 10e-6, c2: 10e-6 };
  const OP_LANGSAM = { art: 'inv', r1: 10000, rf: 100000, opv: 'langsam' };
  function nums() {
    const o = {}, C = CORE(); if (!C) return o;
    const UV = LV('uv_std'); o.uv = UV;
    /* 1 Diode */
    const si = { typ: 'si', modell: 'kennlinie', uq: 5, rv: 1000 };
    o.si = call('diode.operating', si); o.siT = call('diode.operating', Object.assign({}, si, { temp: 87 })); o.schottky = call('diode.operating', Object.assign({}, si, { typ: 'schottky' }));
    o.siRev = call('diode.operating', Object.assign({}, si, { uq: -5 }));
    o.dT = o.si && o.siT ? o.siT.ud - o.si.ud : NaN;
    /* 2 LED */
    o.led = call('diode.operating', { typ: 'led_rot', modell: 'konstant', uq: 24, rv: 3300, uf: 2 });
    o.xRvLed = FX('rvLed', { ub: 24, uf: 2, i: 0.012 }); o.xPRv = FX('pRv', { ub: 24, uf: 2, r: 3300 });
    o.ledKurz = call('diode.operating', { typ: 'led_rot', modell: 'konstant', uq: 5, rv: 1, uf: 2 });
    o.swap = call('diode.ledSwap', { uq: 24, uf1: 2, i1: 0.02, uf2: 3.1, modus: 'gleicherStrom' });
    /* 3 Z-Diode */
    const zc = { typ: 'z', modell: 'konstant', uq: 12, rv: 470, rlast: 4700, uz: 5.1 };
    o.z = call('diode.operating', zc); o.zLow = call('diode.operating', { typ: 'z', modell: 'konstant', uq: 4, rv: 470, uz: 5.1 }); o.zRev = call('diode.operating', { typ: 'z', modell: 'konstant', uq: -5, rv: 470, uz: 5.1 });
    o.xIz = FX('izLast', { uq: 12, uz: 5.1, rv: 470, rl: 4700 }); o.xRvZ = FX('rvZ', { uqmax: 15, uz: 5.1, pz: LV('pz_max') });
    /* 4 Transistor */
    o.fam = call('tr.family', { b: LV('b_std'), ucesat: LV('ucesat') }, [0, 20e-6, 40e-6, 60e-6, 80e-6], [0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2, 4, 6, 8, 10, 12]);
    o.dc = call('tr.dc', { ub: 12, rc: 2200, re: 570, b: LV('b_std'), basis: 'teiler', r1: 47000, r2: 10000 });
    o.xIc = FX('icAusIb', { b: LV('b_std'), ib: 40e-6 });
    /* 5 Schalter */
    const swc = { ub: 5, last: 'led', uf: 2, rv: 330, ust: 5, rb: 4700 };
    o.sw = call('tr.switch', swc); o.swHalb = call('tr.switch', Object.assign({}, swc, { rb: 200000 })); o.swSperr = call('tr.switch', Object.assign({}, swc, { ust: 0.5 }));
    o.rb1 = call('tr.rbFor', { ust: 3.3, ic: 0.045, b: 110 }); o.rb3 = call('tr.rbFor', { ust: 3.3, ic: 0.06, b: 100, ueb: 3 });
    if (o.sw) { o.xIcSat = FX('icSat', { ub: 5, ucesat: LV('ucesat'), uf: 2, rv: 330 }); o.xIbSw = FX('ibSchalter', { ueb: 3, ic: o.sw.icSat, b: LV('b_std') }); o.xRbSw = FX('rbSchalter', { ust: 5, ube: LV('ube'), ib: o.sw.ib }); o.xUeb = FX('ueb', { ib: o.sw.ib, ic: o.sw.icSat, b: LV('b_std') }); o.xPv = FX('pVtr', { uce: o.sw.uce, ic: o.sw.ic, ube: LV('ube'), ib: o.sw.ib }); }
    /* 6 Relais */
    const rl = { ub: 12, rspule: 240, lspule: 0.3 };
    o.relD = call('tr.relais', Object.assign({}, rl, { freilauf: true })); o.rel0 = call('tr.relais', Object.assign({}, rl, { freilauf: false })); o.xTauR = FX('tauRelais', { l: 0.3, r: 240 });
    /* 7 Arbeitspunkt */
    if (o.dc) { o.xUbb = FX('ubb', { ub: 12, r1: 47000, r2: 10000 }); o.xRbTh = FX('rbTh', { r1: 47000, r2: 10000 }); o.xIb = FX('ibEmitter', { ubb: o.dc.ubb, ube: LV('ube'), rb: o.dc.rbth, b: LV('b_std'), re: 570 }); o.xIcDc = FX('icAusIb', { b: LV('b_std'), ib: o.dc.ib }); o.xUce = FX('ucePunkt', { ub: 12, ic: o.dc.ic, rc: 2200 }); }
    o.dc2 = call('tr.dc', { ub: 12, rc: 2200, re: 570, b: LV('b_std'), basis: 'teiler', r1: 47000, r2: 15000 });
    /* 8 Gegenkopplung, 9 Ein- und Ausgangswiderstand */
    o.ac = call('emit.ac', EC); o.acN = call('emit.ac', Object.assign({}, EC, { ce: false }));
    if (o.ac) { o.xGm = FX('gm', { ic: o.ac.ic, ut: LV('ut') }); o.xVuE = FX('vuEmitter', { gm: o.ac.gm, rc: 2200 }); o.xVuG = FX('vuGegen', { rc: 2200, re: o.ac.re, rE: o.ac.reac }); o.xVuGN = FX('vuGegen', { rc: 2200, re: o.acN.re, rE: o.acN.reac }); o.xDb = FX('vDb', { v: Math.abs(o.ac.vu) }); }
    /* 10 Aussteuerung */
    o.lg = [0.005, 0.3, 0.4].map(ue => call('emit.large', Object.assign({}, EC, { ue, f: 1000 }), 128));
    /* 11 Grundschaltungen */
    o.cmp = call('grund.compare', EC); o.cmpW = call('grund.compare', Object.assign({}, EC, { rg: 10000, rl: 220 }));
    /* 12 Z-Folger, Konstantstromquelle */
    o.zf = call('tr.zfolger', { ub: 15, uz: 6, ic: 0.09, b: 30, iz: 0.012 }); o.cs = call('tr.cs', { nd: 3, ud: 0.7, ube: 0.7, ic: 0.04 }); o.cs2 = call('tr.cs', { nd: 2, ud: 0.75, ube: 0.65, ic: 0.02 });
    if (o.zf) { o.xR1z = FX('r1Zfolger', { ub: 15, uz: 6, iz: 0.012, ic: 0.09, b: 30 }); o.xUeZ = FX('ueFolger', { ubb: 6, ube: LV('ube') }); }
    if (o.cs) o.xRe = FX('reKonst', { nd: 3, ud: 0.7, ube: 0.7, ic: 0.04 });
    /* 13 OPV */
    o.opHoch = call('op.open', { up: 3, un: 2.5 }); o.opTief = call('op.open', { up: 1.8, un: 2.5 }); o.opGr = call('op.grenzen', { opv: 'ideal', uv: UV }); o.opGrR = call('op.grenzen', { opv: 'langsam', uv: UV });
    /* 14 Invertierer, Summierer */
    o.inv = call('op.inv', { r1: 4700, rf: 47000, ue: 0.5 }); o.sum = call('op.sum', { rf: 47000, r: [10000, 22000], u: [0.5, 1.1] });
    o.xVInv = FX('vInv', { r1: 4700, rf: 47000 }); o.xRf = FX('rfInv', { v: -10, r1: 4700 }); o.xUaS = FX('uaSumm', { rf: 47000, r1: 10000, u1: 0.5, r2: 22000, u2: 1.1 });
    /* 15 Nichtinvertierer, Folger, Differenzverstärker */
    o.nin = call('op.nin', { rg: 10000, rf: 47000, ue: 0.25 }); o.fol = call('op.folger', { ue: 2 }); o.diff = call('op.diff', { r1: 10000, r2: 10000, r3: 47000, r4: 47000, u1: 1.6, u2: 2.1 });
    o.diffV = call('op.diff', { r1: 10000, r2: 10000, r3: 47000, r4: 56000, u1: 1.6, u2: 2.1 });
    o.xVNin = FX('vNin', { rg: 10000, rf: 47000 }); o.xUaD = FX('uaDiff', { r1: 10000, r2: 10000, r3: 47000, r4: 47000, u1: 1.6, u2: 2.1 });
    /* 16 Komparator, Schmitt-Trigger, Rechteckgenerator */
    o.sInv = call('komp.schmitt', { art: 'inv', r2: 20000, r3: 10000, uv: UV }); o.sNin = call('komp.schmitt', { art: 'nin', r1: 10000, r2: 47000, uv: UV });
    o.osc = call('komp.osc', { r: 10000, c: 1e-7, r2: 10000, r3: 10000, uv: UV });
    if (o.sInv) { o.xSInv = FX('schmittInv', { usat: UV, r2: 20000, r3: 10000 }); o.xUH = FX('uh', { uo: o.sInv.uo, uu: o.sInv.uu }); }
    o.xSNin = FX('schmittNin', { usat: UV, r1: 10000, r2: 47000 }); o.xTosz = FX('tOsz', { r: 10000, c: 1e-7, r2: 10000, r3: 10000 });
    /* 17 Bode */
    o.bode = call('deep.bode', OP_LANGSAM);
    if (o.bode) {
      o.bodeFg = call('op.freq', OP_LANGSAM, [o.bode.fg]); o.bodeOffen = call('op.freq', { art: 'offen', opv: 'langsam' }, [1e5, 1e6]); o.xVn = FX('vnRausch', { r1: 10000, rf: 100000 });
      o.xGbw = FX('fgGbw', { gbw: LV('gbw_langsam'), v: o.bode.vn });     }
    o.xDbV = FX('vDb', { v: 10 });
    /* 18 Slew-Rate */
    o.slew = call('deep.slew', { opv: 'langsam', uhat: 10, f: 20000 }); o.xFpb = FX('fpb', { sr: LV('sr_langsam'), uhat: 10 });
    const wv = { art: 'inv', r1: 10000, rf: 100000, ue: 1, f: 20000, form: 'sinus' };
    o.wvL = call('op.wave', Object.assign({ opv: 'langsam' }, wv), 128); o.wvS = call('op.wave', Object.assign({ opv: 'schnell' }, wv), 128); o.invF = call('op.inv', { r1: 10000, rf: 100000, ue: 1, f: 20000, opv: 'langsam' });
    o.slewS = call('deep.slew', { opv: 'schnell', uhat: 10, f: 20000 });
    /* 19 Offset */
    o.off = call('deep.offset', { opv: 'langsam', rf: 100000, r1: 1000 }); o.off2 = call('deep.offset', { opv: 'langsam', rf: 100000, r1: 10000 }); o.offS = call('deep.offset', { opv: 'schnell', rf: 100000, r1: 1000 });
    o.xOff = FX('uosOut', { uos: LV('uos_langsam'), rf: 100000, r1: 1000 });
    o.intOff = call('act.integrator', { r: 100000, c: 1e-6, opv: 'langsam', ue: 0 }); o.intOffRp = call('act.integrator', { r: 100000, c: 1e-6, opv: 'langsam', ue: 0, rp: 1e6 });
    /* 20 Sättigung */
    o.satI = call('deep.sat', { opv: 'ideal', uv: UV, v: -10 }); o.satR = call('deep.sat', { opv: 'langsam', uv: UV, v: -10 }); o.xSat = FX('ueMaxSat', { usat: UV, v: 10 });
    /* 21 Integrierer, Differenzierer, Filter */
    o.integ = call('act.integrator', { r: 100000, c: 1e-6, ue: 2 }); o.integRp = call('act.integrator', { r: 100000, c: 1e-6, ue: 2, rp: 1e6 }); o.dif = call('act.differentiator', { rf: 10000, c: 1e-7, rs: 100 });
    o.tp = call('act.tp', { r1: 10000, rf: 100000, cf: 1.59e-9 }); o.hp = call('act.hp', { r1: 10000, rf: 100000, c1: 1e-8 });
    o.xSlope = FX('slopeInt', { ue: 2, r: 100000, c: 1e-6 }); o.xTau = FX('tau', { r: 100000, c: 1e-6 }); o.xRInt = FX('rInt', { f: 100, c: 2.2e-8 }); o.xFgTp = FX('fgAktiv', { r: 100000, c: 1.59e-9 });
    return o;
  }

  /* ============================================================ Zeichnungen (SVG, Breite 400, Schrift 13 und 14; Text bis zum Rand: Prüfung im Test) */
  const svg = (label, body, h) => `<svg class="dr" viewBox="0 0 400 ${Math.round(h || 170)}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,sans-serif" font-size="14" fill="currentColor">${body}</svg>`;
  const T = (x, y, t, anchor, extra) => `<text x="${+(+x).toFixed(1)}" y="${+(+y).toFixed(1)}"${anchor ? ` text-anchor="${anchor}"` : ''} ${extra || 'font-size="13"'}>${esc(t)}</text>`;
  const LN = (x1, y1, x2, y2, c, w, dash) => `<line x1="${+(+x1).toFixed(1)}" y1="${+(+y1).toFixed(1)}" x2="${+(+x2).toFixed(1)}" y2="${+(+y2).toFixed(1)}" stroke="${c || 'currentColor'}" stroke-width="${w || 2}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
  const RC = (x, y, w, h, c, fill, r) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r == null ? 8 : r}" fill="${fill || 'none'}" stroke="${c || 'currentColor'}" stroke-width="2"/>`;
  const ARR = (x1, y1, x2, y2, c, w) => { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, col = c || 'currentColor'; return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${(x2 - ux * 6).toFixed(1)}" y2="${(y2 - uy * 6).toFixed(1)}" stroke="${col}" stroke-width="${w || 2}"/><polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(x2 - ux * 9 - uy * 4.5).toFixed(1)},${(y2 - uy * 9 + ux * 4.5).toFixed(1)} ${(x2 - ux * 9 + uy * 4.5).toFixed(1)},${(y2 - uy * 9 - ux * 4.5).toFixed(1)}" fill="${col}"/>`; };
  /* Farben: Spannung blau, Strom orange, Ausgang grün, Fehler/Begrenzen rot (Linienstil und Beschriftung kommen immer dazu) */
  const COL = { u: '#3b82f6', i: '#f59e0b', o: '#22c55e', k: '#8a8f98', a: '#ef4444', q: '#a855f7' };
  const unavailable = (label, text) => svg(label + ' nicht verfügbar', T(200, 60, text || 'Die Werte fehlen im Kern', 'middle', 'font-size="14"'), 100);
  /* Zeilenumbruch für SVG-Text (kein tspan, jede Zeile ein eigenes text-Element, damit die Prüfung jede Zeile misst) */
  function wrap(t, max) {
    const words = String(t == null ? '' : t).split(/\s+/).filter(Boolean), lines = []; let cur = '';
    words.forEach(w => { if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; });
    if (cur) lines.push(cur); return lines.length ? lines : [''];
  }
  const cut = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s; };
  const lg10 = Math.log10;
  /* Teilung und Beschriftung der Achsen */
  function fv(v) {
    if (!fin(v)) return DASH; const a = Math.abs(v); if (a === 0) return '0';
    const s = a >= 1e5 ? v.toExponential(0).replace('e+', '·10^') : a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : v.toPrecision(2);
    return (s.indexOf('.') >= 0 && s.indexOf('e') < 0 && s.indexOf('^') < 0 ? s.replace(/0+$/, '').replace(/\.$/, '') : s).replace('.', ',');
  }
  function fk(v) { if (!fin(v)) return DASH; if (v >= 1e6) return +(v / 1e6).toPrecision(3) + ' M'; if (v >= 1e3) return +(v / 1e3).toPrecision(3) + ' k'; return String(+v.toPrecision(3)).replace('.', ','); }
  const fkc = v => fk(v).replace('.', ',');
  function niceNum(x) { const e = Math.floor(Math.log10(x)), f = x / Math.pow(10, e); return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * Math.pow(10, e); }
  function niceRange(lo, hi) {
    if (!fin(lo) || !fin(hi)) return [0, 1];
    if (lo >= 0 && lo <= 0.35 * hi) lo = 0; else if (hi <= 0 && hi >= 0.35 * lo) hi = 0;
    if (hi === lo) { lo -= 0.5; hi += 0.5; }
    const st = niceNum((hi - lo) / 4); lo = Math.floor(lo / st + 1e-9) * st; hi = Math.ceil(hi / st - 1e-9) * st; return [+lo.toPrecision(12), +hi.toPrecision(12)];
  }
  function ticksLin(lo, hi, n) { const out = [], st = niceNum((hi - lo) / (n || 4)); for (let v = Math.ceil(lo / st - 1e-9) * st, k = 0; v <= hi + st * 1e-9 && k < 20; v += st, k++) out.push(+v.toPrecision(12)); return out; }
  function ticksLog(lo, hi) { const out = []; for (let e = Math.ceil(lg10(lo) - 1e-9); e <= Math.floor(lg10(hi) + 1e-9) && out.length < 12; e++) out.push(Math.pow(10, e)); return out; }
  /* Diagrammkörper: Linien, Achsen, Teilung, Legende; Linien werden am Diagrammfeld abgeschnitten. o = { series:[{x,y,c,dash,w}], xlog, xmin, xmax, ymin, ymax, xticks, yticks, xtitle, ytitle,
     hl, vl, bands:[{x0,x1,c}], dots:[{x,y,c}], legend:[{t,c,dash,dot}], extra(xm, ym), h } */
  let uid = 0;
  function plotBody(o, dy) {
    const X0 = 66, XW = 300, Y0 = 26, YH = o.h || 120, c0 = 'currentColor', id = 'anaCl' + (++uid);
    const xm = v => X0 + XW * (o.xlog ? (lg10(v) - lg10(o.xmin)) / (lg10(o.xmax) - lg10(o.xmin)) : (v - o.xmin) / (o.xmax - o.xmin));
    const ym = v => Y0 + YH - YH * (v - o.ymin) / (o.ymax - o.ymin);
    let b = T(8, 16, cut(o.ytitle || '', 46), 'start') + LN(X0, Y0, X0, Y0 + YH) + LN(X0, Y0 + YH, X0 + XW, Y0 + YH);
    b += `<defs><clipPath id="${id}"><rect x="${X0}" y="${Y0}" width="${XW}" height="${YH}"/></clipPath></defs>`;
    (o.hl || []).forEach(h => { b += LN(X0, ym(h[0]), X0 + XW, ym(h[0]), h[1] || COL.k, 1, '4 4'); });
    (o.vl || []).forEach(v => { b += LN(xm(v[0]), Y0, xm(v[0]), Y0 + YH, v[1] || COL.k, 1, '4 4'); });
    (o.xticks || []).forEach(t => { b += LN(xm(t[0]), Y0 + YH, xm(t[0]), Y0 + YH + 6, c0, 1.5) + T(xm(t[0]), Y0 + YH + 20, t[1], 'middle'); });
    (o.yticks || []).forEach(t => { b += LN(X0 - 5, ym(t[0]), X0, ym(t[0]), c0, 1.5) + T(X0 - 8, ym(t[0]) + 5, t[1], 'end'); });
    b += `<g clip-path="url(#${id})">`;
    (o.bands || []).forEach(q => { if (fin(q.x0) && fin(q.x1) && q.x1 > q.x0) b += `<rect x="${xm(q.x0).toFixed(1)}" y="${Y0}" width="${(xm(q.x1) - xm(q.x0)).toFixed(1)}" height="${YH}" fill="${q.c || COL.a}" opacity="0.18"/>`; });
    (o.series || []).forEach(s => {
      const pts = []; for (let k = 0; k < s.x.length; k++) { if (fin(s.x[k]) && fin(s.y[k]) && (!o.xlog || s.x[k] > 0)) pts.push(xm(s.x[k]).toFixed(1) + ',' + ym(s.y[k]).toFixed(1)); }
      if (pts.length > 1) b += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.c}" stroke-width="${s.w || 2.5}"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''} stroke-linejoin="round"/>`;
    });
    (o.dots || []).forEach(d => { if (fin(d.x) && fin(d.y)) b += `<circle cx="${xm(d.x).toFixed(1)}" cy="${ym(d.y).toFixed(1)}" r="5" fill="#fff" stroke="${d.c || 'currentColor'}" stroke-width="2.5"/>`; });
    b += '</g>';
    if (typeof o.extra === 'function') b += o.extra(xm, ym, { X0, XW, Y0, YH });
    b += T(X0 + XW / 2, Y0 + YH + 42, cut(o.xtitle || '', 46), 'middle');
    let y = Y0 + YH + 64, x = 12;
    (o.legend || []).forEach(l => {
      const t = cut(l.t, 44), w = 30 + 7.8 * t.length; if (x + w > 392 && x > 12) { x = 12; y += 20; }
      b += (l.dot ? `<circle cx="${x + 11}" cy="${y - 4}" r="5" fill="#fff" stroke="${l.c}" stroke-width="2.5"/>` : LN(x, y - 4, x + 22, y - 4, l.c, 2.5, l.dash)) + T(x + 28, y, t, 'start'); x += w + 8;
    });
    const H = (o.legend && o.legend.length ? y + 12 : Y0 + YH + 52);
    return { body: dy ? `<g transform="translate(0,${dy})">${b}</g>` : b, h: H };
  }
  function plot(label, o) { const r = plotBody(o, 0); return svg(label, r.body, r.h); }
  const okArr = (...a) => a.every(x => Array.isArray(x) && x.length > 1);
  /* Stil je Kurvenart (kind der Prüfstände): Strichart ist die Zweitcodierung zur Farbe */
  const KIND = { i: [COL.i, '', 2.5], u: [COL.u, '', 2.5], out: [COL.o, '', 2.5], err: [COL.a, '', 2.5], line: [COL.k, '8 3 2 3', 2], tangent: [COL.u, '3 3', 2], ref: [COL.k, '6 4', 2], ghost: [COL.k, '2 4', 1.2] };
  const kindOf = s => (s && KIND[s.kind] ? s.kind : (s && s.ghost ? 'ghost' : 'i'));
  /* zwei Punkte einer Geraden auf das Fenster [x0, x1] zuschneiden (nur Anfang und Ende, wie die Prüfstände sie liefern) */
  function clipLine(pts, x0, x1) {
    if (!Array.isArray(pts) || pts.length !== 2) return pts; const a = pts[0], b = pts[1]; if (!a || !b || a[0] === b[0]) return pts;
    const at = x => a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]), lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]), l = Math.max(lo, x0), h = Math.min(hi, x1);
    return l < h ? [[l, at(l)], [h, at(h)]] : pts;
  }
  /* Kennlinie eines Prüfstands (curves()-Eintrag) als Zeichnung: Achsen mit Größe und Einheit, Arbeitspunkt als weißer Ring, Gerade zugeschnitten, Grenze gestrichelt */
  function curveSvg(label, cv, opt) {
    opt = opt || {};
    if (!cv || !Array.isArray(cv.series)) return unavailable(label);
    const ser = cv.series.filter(s => s && Array.isArray(s.points) && s.points.length > 1), main = ser.filter(s => ['i', 'u', 'out', 'err'].indexOf(kindOf(s)) >= 0);
    if (!main.length) return unavailable(label);
    const xlog = cv.xScale === 'log', mx = [], my = [];
    main.forEach(s => s.points.forEach(p => { if (fin(p[0]) && fin(p[1]) && (!xlog || p[0] > 0)) { mx.push(p[0]); my.push(p[1]); } }));
    if (cv.marker && fin(cv.marker.x) && fin(cv.marker.y)) { mx.push(cv.marker.x); my.push(cv.marker.y); }
    if (!mx.length) return unavailable(label);
    let xlo = Math.min.apply(null, mx), xhi = Math.max.apply(null, mx);
    if (opt.xmax != null) xhi = Math.min(xhi, opt.xmax);
    let xr; if (xlog) xr = [Math.pow(10, Math.floor(lg10(xlo) + 1e-9)), Math.pow(10, Math.ceil(lg10(xhi) - 1e-9))]; else xr = niceRange(xlo, xhi);
    if (xlog && xr[1] <= xr[0]) xr[1] = xr[0] * 10;
    const prep = ser.map(s => { const k = kindOf(s), pts = (k === 'line' || k === 'tangent') ? clipLine(s.points, xr[0], xr[1]) : s.points; return { s, k, pts }; });
    prep.forEach(p => { if (p.k === 'line' || p.k === 'tangent') p.pts.forEach(q => { if (fin(q[1]) && q[0] >= xr[0] && q[0] <= xr[1]) my.push(q[1]); }); });
    if (cv.limit && fin(cv.limit.y)) my.push(cv.limit.y);
    const yr = niceRange(Math.min.apply(null, my), Math.max.apply(null, my));
    const xt = (xlog ? ticksLog(xr[0], xr[1]).map(v => [v, fkc(v)]) : ticksLin(xr[0], xr[1], 4).map(v => [v, fv(v)])), yt = ticksLin(yr[0], yr[1], 4).map(v => [v, fv(v)]);
    const leg = [];
    prep.forEach(p => { if (p.k === 'ghost') return; const st = KIND[p.k]; if (leg.length < 6) leg.push({ t: p.s.name || '', c: st[0], dash: st[2] ? st[1] : '' }); });
    const dots = [];
    if (cv.marker && fin(cv.marker.x) && fin(cv.marker.y)) { dots.push({ x: cv.marker.x, y: cv.marker.y, c: '#1c2329' }); leg.push({ t: cv.marker.label || cv.marker.text || 'Arbeitspunkt', c: '#1c2329', dot: true }); }
    const hl = []; if (cv.limit && fin(cv.limit.y)) { hl.push([cv.limit.y, COL.a]); if (cv.limit.sym !== false) hl.push([-cv.limit.y, COL.a]); leg.push({ t: (cv.limit.name || 'Grenze') + ' = ' + fv(cv.limit.y) + (cv.yUnit ? ' ' + cv.yUnit : ''), c: COL.a, dash: '4 4' }); }
    const sr = prep.filter(p => p.pts.length > 1).map(p => { const st = KIND[p.k]; return { x: p.pts.map(q => q[0]), y: p.pts.map(q => q[1]), c: st[0], dash: st[1], w: st[2] }; });
    const unit = u => (u && u !== '–' ? ' in ' + u : '');
    return plot(label, { series: sr, xlog, xmin: xr[0], xmax: xr[1], ymin: yr[0], ymax: yr[1], xticks: xt, yticks: yt, xtitle: (cv.xLabel || '') + unit(cv.xUnit) + (xlog ? ' (logarithmisch)' : ''), ytitle: (cv.yLabel || '') + unit(cv.yUnit), hl, dots, legend: leg });
  }
  /* Zeitverlauf eines Prüfstands (waveform()): ausgewählte Spuren auf einer Achse, Begrenzen (clip) als roter Streifen, waagerechte Marken */
  function waveSvg(label, w, names, opt) {
    opt = opt || {};
    if (!w || !okArr(w.t) || !Array.isArray(w.series)) return unavailable(label);
    const sel = w.series.filter(s => s && Array.isArray(s.y) && (!names || names.indexOf(s.name) >= 0)); if (!sel.length) return unavailable(label);
    const ys = []; sel.forEach(s => s.y.forEach(v => { if (fin(v)) ys.push(v); })); if (!ys.length) return unavailable(label);
    const t0 = w.t[0], t1 = w.t[w.t.length - 1], yr = niceRange(Math.min.apply(null, ys), Math.max.apply(null, ys)), tu = w.tUnit || '';
    const leg = [], sr = [];
    sel.forEach((s, i) => { const k = s.kind && KIND[s.kind] ? s.kind : ['u', 'out', 'i', 'err'][i % 4], st = KIND[k]; sr.push({ x: w.t, y: s.y, c: st[0], dash: st[1], w: 2.5 }); leg.push({ t: s.name + (s.unit ? ' in ' + s.unit : ''), c: st[0], dash: st[2] ? st[1] : '' }); });
    const bands = (Array.isArray(w.clip) ? w.clip : []).filter(q => q && fin(q.t0) && fin(q.t1)).map(q => ({ x0: q.t0, x1: q.t1, c: COL.a })); if (bands.length) leg.push({ t: 'Begrenzen (roter Streifen)', c: COL.a, dash: '' });
    const hl = []; const mk = w.marks && Array.isArray(w.marks.h) ? w.marks.h : [];
    mk.forEach(m => { if (m && fin(m.y) && m.y >= yr[0] && m.y <= yr[1]) hl.push([m.y, COL.k]); });
    const sp = w.marks && Array.isArray(w.marks.span) ? w.marks.span.filter(q => q && fin(q.t0) && fin(q.t1) && q.t1 > q.t0 && q.name === 'T')[0] : null;
    if (sp) leg.push({ t: 'T = ' + fv(sp.t1 - sp.t0) + (tu ? ' ' + tu : ''), c: COL.k, dash: '4 4' });
    return plot(label, { series: sr, xmin: t0, xmax: t1, ymin: yr[0], ymax: yr[1], xticks: ticksLin(t0, t1, 4).map(v => [v, fv(v)]), yticks: ticksLin(yr[0], yr[1], 4).map(v => [v, fv(v)]), xtitle: 'Zeit t' + (tu ? ' in ' + tu : ''), ytitle: opt.ytitle || ('Spannung' + (sel[0].unit ? ' in ' + sel[0].unit : '')), bands, hl, legend: leg });
  }
  /* ---- Schaltzeichen (nur Beschriftung, keine Zahlen außer aus dem Zahlenblatt) ---- */
  const symNpn = (x, y) => {
    /* Basisstrich bei x+40, Kreis um (x+55, y), Kollektor oben rechts, Emitter unten rechts (Pfeil nach außen) */
    const bx = x + 40;
    return `<circle cx="${x + 56}" cy="${y}" r="40" fill="none" stroke="currentColor" stroke-width="2"/>` + LN(bx, y - 26, bx, y + 26, 'currentColor', 3) + LN(x, y, bx, y, 'currentColor', 2) +
      LN(bx, y - 14, x + 78, y - 38, 'currentColor', 2) + LN(x + 78, y - 38, x + 78, y - 62, 'currentColor', 2) + LN(bx, y + 14, x + 78, y + 38, 'currentColor', 2) + LN(x + 78, y + 38, x + 78, y + 62, 'currentColor', 2) +
      `<polygon points="${x + 78},${y + 38} ${x + 66},${y + 36} ${x + 72},${y + 26}" fill="currentColor"/>`;
  };
  const symDiode = (x, y) => LN(x, y, x + 36, y) + `<polygon points="${x + 36},${y - 16} ${x + 36},${y + 16} ${x + 70},${y}" fill="none" stroke="currentColor" stroke-width="2"/>` + LN(x + 70, y - 18, x + 70, y + 18, 'currentColor', 3) + LN(x + 70, y, x + 106, y);
  const symOpv = (x, y) => `<polygon points="${x},${y - 46} ${x},${y + 46} ${x + 86},${y}" fill="none" stroke="currentColor" stroke-width="2"/>` + T(x + 8, y - 16, '−', 'start', 'font-size="18"') + T(x + 8, y + 28, '+', 'start', 'font-size="18"') + LN(x - 34, y - 24, x, y - 24) + LN(x - 34, y + 24, x, y + 24) + LN(x + 86, y, x + 124, y);

  const DRAW = {
    diode: n => {
      const cv = rigCurve('diode', 'si-1k', null, 'kennlinie'), d = n && n.si, sch = n && n.schottky; if (!cv || !d) return unavailable('Kennlinie der Siliziumdiode');
      return curveSvg('Kennlinie der Siliziumdiode mit Widerstandsgerade und Arbeitspunkt bei ' + fe(d.ud, 'V') + ' und ' + fe(d.id, 'A') + '; die Tangente im Arbeitspunkt schneidet die Spannungsachse bei der Schwellspannung ' + fe(d.us, 'V') + (sch ? '; zum Vergleich die Schottky-Diode mit ' + fe(sch.ud, 'V') : ''), cv, { xmax: 0.9 });
    },
    diodeSym: () => svg('Schaltzeichen der Diode mit Anode, Katode, Durchlassstrom und Spannung in Durchlassrichtung',
      symDiode(60, 54) + T(60, 100, 'Anode (A)', 'middle') + T(166, 100, 'Katode (K)', 'middle') + ARR(70, 24, 140, 24, COL.i, 2) + T(150, 28, 'I_D (Durchlassrichtung)', 'start') + ARR(66, 80, 166, 80, COL.u, 2) + T(180, 84, 'U_D (A nach K)', 'start'), 116),
    led: n => {
      const cv = rigCurve('diode', 'led-24v', null, 'kennlinie'), d = n && n.led; if (!cv || !d) return unavailable('Kennlinie der LED mit Vorwiderstand');
      return curveSvg('Kennlinie der roten LED mit Widerstandsgerade des Vorwiderstands 3,3 kΩ an 24 V: Arbeitspunkt bei ' + fe(d.ud, 'V') + ' und ' + fe(d.id, 'A') + ', zulässiger Strom ' + LT('led_imax'), cv, { xmax: 3 });
    },
    zdiode: n => {
      const cv = rigCurve('diode', 'z-12v', null, 'kennlinie'), d = n && n.z; if (!cv || !d) return unavailable('Kennlinie der Z-Diode');
      return curveSvg('Kennlinie der Z-Diode in Sperrrichtung mit Vorwiderstand 470 Ω an 12 V und Last 4,7 kΩ: Arbeitspunkt im Durchbruch bei ' + fe(d.ud, 'V') + ' mit Z-Strom ' + fe(d.iz, 'A'), cv, {});
    },
    familie: n => {
      const f = n && n.fam; if (!f || !okArr(f.uce) || !Array.isArray(f.series)) return unavailable('Ausgangskennlinienfeld des Transistors');
      const ser = f.series.filter(s => s && okArr(s.ic)), im = Math.max.apply(null, ser.map(s => Math.max.apply(null, s.ic.filter(fin)))) * 1000, yr = niceRange(0, im), us = LV('ucesat');
      const sr = ser.map((s, i) => ({ x: f.uce, y: s.ic.map(v => v * 1000), c: i ? COL.i : COL.k, dash: i === 0 ? '4 4' : (i % 2 ? '' : '7 4'), w: 2.5 })), leg = ser.map((s, i) => ({ t: 'I_B = ' + fe(s.ib, 'A'), c: i ? COL.i : COL.k, dash: i === 0 ? '4 4' : (i % 2 ? '' : '7 4') }));
      return plot('Ausgangskennlinienfeld des Transistors: Kollektorstrom über Kollektor-Emitter-Spannung für fünf Basisströme; oberhalb von U_CE,sat ' + LT('ucesat') + ' ist der Kollektorstrom das B-fache des Basisstroms', {
        series: sr, xmin: 0, xmax: 12, ymin: yr[0], ymax: yr[1], xticks: [0, 4, 8, 12].map(v => [v, String(v)]), yticks: ticksLin(yr[0], yr[1], 4).map(v => [v, fv(v)]), xtitle: 'Spannung U_CE in V', ytitle: 'Kollektorstrom I_C in mA', vl: [[us, COL.a]],
        legend: leg.concat([{ t: 'U_CE,sat = ' + fe(us, 'V'), c: COL.a, dash: '4 4' }])
      });
    },
    npn: n => {
      const dc = n && n.dc; if (!dc) return unavailable('Schaltzeichen des Transistors');
      let b = symNpn(30, 90) + T(24, 94, 'B', 'end') + T(126, 18, 'C', 'start') + T(126, 172, 'E', 'start') + ARR(6, 74, 40, 74, COL.i, 2) + T(6, 62, 'I_B', 'start') + ARR(108, 30, 108, 56, COL.i, 2) + T(176, 40, 'I_C = B · I_B', 'start') + ARR(108, 152, 108, 130, COL.i, 2) + T(176, 160, 'I_E = I_C + I_B', 'start');
      b += T(176, 76, 'U_BE: ' + LT('ube'), 'start') + T(176, 100, 'B: ' + LT('b_std'), 'start') + T(176, 124, 'Beispiel: I_B ' + fe(dc.ib, 'A') + ',', 'start') + T(176, 142, 'I_C ' + fe(dc.ic, 'A') + ', I_E ' + fe(dc.ie, 'A'), 'start');
      return svg('Schaltzeichen des npn-Transistors mit Basis, Kollektor, Emitter und den Strömen; im Beispiel ist I_B ' + fe(dc.ib, 'A') + ', I_C ' + fe(dc.ic, 'A') + ' und I_E ' + fe(dc.ie, 'A'), b, 186);
    },
    schaltAusgang: () => curveSvg('Ausgangskennlinien des Transistors als Schalter mit Arbeitsgerade: der Arbeitspunkt liegt in der Sättigung bei kleiner Kollektor-Emitter-Spannung', rigCurve('schalter', 'led-5v', null, 'ausgang'), {}),
    schaltUeb: () => curveSvg('Übersteuerungsfaktor über dem Basisvorwiderstand: bei ü = 1 ist der Transistor gerade gesättigt, darunter nur aktiv', rigCurve('schalter', 'led-5v', null, 'ueb'), {}),
    relais: n => {
      const a = rigWave('schalter', 'mcu-relais', null), b = rigWave('schalter', 'freilauf-aus', null); const d = n && n.relD, o0 = n && n.rel0; if (!a || !b || !d || !o0) return unavailable('Spannung am Transistor mit und ohne Freilaufdiode');
      const one = (w, nm, y) => { const r = plotBody({ series: [{ x: w.t, y: w.series.find(s => s.name === 'U_CE').y, c: COL.u, w: 2.5 }], xmin: w.t[0], xmax: w.t[w.t.length - 1], ymin: 0, ymax: niceRange(0, Math.max.apply(null, w.series.find(s => s.name === 'U_CE').y))[1], xticks: ticksLin(w.t[0], w.t[w.t.length - 1], 4).map(v => [v, fv(v)]), yticks: ticksLin(0, niceRange(0, Math.max.apply(null, w.series.find(s => s.name === 'U_CE').y))[1], 3).map(v => [v, fv(v)]), xtitle: 'Zeit t in ' + (w.tUnit || 's'), ytitle: nm, h: 80, legend: [] }, y); return r; };
      const p1 = one(a, 'U_CE in V, mit Freilaufdiode: Spitze ' + fe(d.ucePeak, 'V'), 0), p2 = one(b, 'U_CE in V, ohne Diode (Fehlerbild): ' + fe(o0.ucePeak, 'V'), p1.h + 4);
      return svg('Spannung am Transistor beim Abschalten des Relais: mit Freilaufdiode bleibt die Spitze bei ' + fe(d.ucePeak, 'V') + ', ohne Freilaufdiode (nur Simulation) steigt sie bis ' + fe(o0.ucePeak, 'V') + ' an der Durchbruchspannung', p1.body + p2.body, p1.h + 4 + p2.h);
    },
    arbeitspunkt: n => {
      const dc = n && n.dc; if (!dc) return unavailable('Arbeitspunkt der Emitterschaltung');
      return curveSvg('Ausgangskennlinienfeld der Emitterschaltung mit Arbeitsgerade: Arbeitspunkt bei U_CE ' + fe(dc.uce, 'V') + ' und I_C ' + fe(dc.ic, 'A'), rigCurve('emitter', 'standard', null, 'ausgang'), {});
    },
    gegen: n => {
      const a = n && n.ac, b = n && n.acN; if (!a || !b) return unavailable('Spannungsverstärkung mit und ohne Emitterkondensator');
      const mx = Math.max(Math.abs(a.vu), Math.abs(b.vu)), bw = 130 / mx;
      let s = RC(150, 28, Math.abs(a.vu) * bw, 28, COL.o, COL.o, 4) + RC(150, 82, Math.abs(b.vu) * bw, 28, COL.i, COL.i, 4) + T(8, 47, 'mit C_E', 'start') + T(8, 101, 'ohne C_E', 'start');
      s += T(150 + Math.abs(a.vu) * bw + 6, 47, 'V_u ' + ff(a.vu, 2), 'start') + T(150 + Math.abs(b.vu) * bw + 6, 101, 'V_u ' + ff(b.vu, 2), 'start');
      s += T(8, 16, 'Betrag der Spannungsverstärkung (Last ' + fe(10000, 'Ω') + ')', 'start') + T(8, 134, 'R_E,ac = ' + fe(a.reac, 'Ω') + ' mit C_E, ' + fe(b.reac, 'Ω') + ' ohne', 'start');
      return svg('Spannungsverstärkung der Emitterschaltung: mit Emitterkondensator V_u ' + ff(a.vu, 2) + ', ohne Emitterkondensator nur V_u ' + ff(b.vu, 2) + ' durch die Gegenkopplung, beide mit 180° Phasendrehung', s, 148);
    },
    freqgang: n => {
      const a = n && n.ac; if (!a) return unavailable('Frequenzgang der Emitterschaltung');
      return curveSvg('Frequenzgang der Emitterschaltung: unterhalb der unteren Grenzfrequenz ' + fe(a.fu, 'Hz') + ' sinkt die Verstärkung wegen der Koppelkondensatoren', rigCurve('emitter', 'standard', null, 'frequenzgang'), {});
    },
    aussteuer: n => {
      const w = rigWave('emitter', 'uebersteuert', null), l = n && n.lg && n.lg[2]; if (!w || !l) return unavailable('Übersteuerte Emitterschaltung');
      return waveSvg('Übersteuerte Emitterschaltung bei 400 mV Eingangsamplitude: der Ausgang wird oben und unten begrenzt, Klirrfaktor ' + ff(l.thdProzent, 1) + ' %', w, null, {});
    },
    grund: n => {
      const c = n && n.cmp; if (!c || !c.emitter) return unavailable('Die drei Grundschaltungen im Vergleich');
      const col = (x, t, o) => RC(x, 30, 120, 130, 'currentColor', 'none', 8) + T(x + 60, 52, t, 'middle', 'font-size="14"') + T(x + 60, 76, 'V_u ' + ff(o.vu, 2), 'middle') + T(x + 60, 98, 'Phase ' + ff(o.phase, 0) + '°', 'middle') + T(x + 60, 120, 'r_ein ' + fe(o.rin, 'Ω'), 'middle') + T(x + 60, 142, 'r_aus ' + fe(o.rout, 'Ω'), 'middle');
      return svg('Die drei Grundschaltungen bei gleichem Arbeitspunkt: Emitter V_u ' + ff(c.emitter.vu, 2) + ', Kollektor V_u ' + ff(c.kollektor.vu, 2) + ', Basis V_u ' + ff(c.basis.vu, 2),
        T(200, 16, 'mit Quellenwiderstand ' + fe(EC.rg, 'Ω') + ', Last ' + fe(EC.rl, 'Ω'), 'middle') + col(4, 'Emitter', c.emitter) + col(140, 'Kollektor', c.kollektor) + col(276, 'Basis', c.basis), 172);
    },
    zfolger: n => {
      const z = n && n.zf, c = n && n.cs; if (!z || !c) return unavailable('Z-Folger und Konstantstromquelle');
      /* links: Z-Folger, rechts: Konstantstromquelle (Prinzipbilder, Zahlen aus tr.zfolger und tr.cs) */
      let b = LN(20, 24, 100, 24, COL.k, 1.5) + T(20, 18, '+U_B = ' + fe(15, 'V'), 'start') + LN(60, 24, 60, 50) + RC(48, 50, 24, 40, 'currentColor', 'none', 3) + T(80, 74, 'R_1 = ' + fe(z.r1, 'Ω'), 'start') + LN(60, 90, 60, 150) + LN(60, 110, 20, 110) +
        symDiodeV(60, 130) + T(70, 160, 'Z', 'start') + LN(60, 170, 60, 186) + LN(40, 186, 80, 186) + T(88, 134, 'U_Z = ' + fe(6, 'V'), 'start') +
        LN(20, 110, 20, 150, COL.k, 1, '2 3');
      b += T(8, 206, 'Z-Folger: U_E = ' + fe(z.ue, 'V'), 'start', 'font-size="13"');
      b += LN(220, 24, 380, 24, COL.k, 1.5) + T(220, 18, 'konstanter Strom', 'start') + LN(300, 24, 300, 60) + T(310, 52, 'I_C = ' + fe(c.ic, 'A'), 'start') + RC(288, 60, 24, 40, 'currentColor', 'none', 3) + T(320, 84, 'Transistor', 'start') +
        LN(300, 100, 300, 120) + RC(288, 120, 24, 36, 'currentColor', 'none', 3) + T(320, 144, 'R_E = ' + fe(c.re, 'Ω'), 'start') + LN(300, 156, 300, 186) + LN(280, 186, 320, 186);
      b += T(220, 206, '3 Dioden: U_RE = ' + fe(c.ure, 'V'), 'start', 'font-size="13"');
      return svg('Z-Folger links: Vorwiderstand ' + fe(z.r1, 'Ω') + ' für die Z-Diode, Ausgangsspannung ' + fe(z.ue, 'V') + '; Konstantstromquelle rechts: Emitterwiderstand ' + fe(c.re, 'Ω') + ' für ' + fe(c.ic, 'A') + ' bei drei Dioden an der Basis', b, 222);
    },
    opv: n => {
      const g = n && n.opGr, gr = n && n.opGrR; if (!g || !gr) return unavailable('Operationsverstärker');
      let b = symOpv(150, 90) + T(112, 66, 'U_−', 'end') + T(112, 114, 'U_+', 'end') + T(290, 94, 'U_a', 'start') + T(190, 28, '+U_v', 'middle') + LN(190, 32, 190, 56, COL.k, 1.5) + T(190, 168, '−U_v', 'middle') + LN(190, 124, 190, 150, COL.k, 1.5);
      b += T(8, 184, 'ideal: ±' + fe(g.p, 'V') + ', real: ±' + fe(gr.p, 'V') + ' (Übungswert)', 'start');
      return svg('Schaltzeichen des Operationsverstärkers mit invertierendem Eingang, nichtinvertierendem Eingang, Ausgang und Versorgung; der Ausgang geht ideal bis plus minus ' + fe(g.p, 'V') + ', real nur bis plus minus ' + fe(gr.p, 'V'), b, 196);
    },
    inv: () => waveSvg('Invertierender Verstärker mit Sinus: Ausgang und Eingang sind um 180° gedreht', rigWave('opv_inv', 'v-10', { form: 'sinus', ue: 0.5 }), null, {}),
    nin: () => waveSvg('Nichtinvertierender Verstärker mit Sinus: Ausgang und Eingang sind gleichphasig, der Ausgang ist 5,7-fach größer', rigWave('opv_nin', 'v-5-7', { form: 'sinus', ue: 0.25 }), null, {}),
    hyst: n => curveSvg('Hysterese-Schleife des invertierenden Schmitt-Triggers: der Ausgang kippt bei ' + fe(gv(n && n.sInv, 'uo'), 'V') + ' hoch und bei ' + fe(gv(n && n.sInv, 'uu'), 'V') + ' tief', rigCurve('opv_komp', 'schmitt-inv', null, 'hysterese'), {}),
    osz: n => waveSvg('Rechteckgenerator: Kondensatorspannung pendelt zwischen den Schaltschwellen, der Ausgang kippt zwischen plus und minus Aussteuergrenze, Periodendauer ' + fe(gv(n && n.osc, 'T'), 's'), rigWave('opv_komp', 'rechteck', null), null, {}),
    bode: n => curveSvg('Bode-Diagramm des gegengekoppelten Verstärkers mit Leerlaufkurve: Knick bei der Grenzfrequenz ' + fe(gv(n && n.bode, 'fg'), 'Hz') + ', danach fällt die Verstärkung mit 20 dB je Dekade', rigCurve('opv_aktiv', 'real-gbw', null, 'bode'), {}),
    slew: n => {
      const a = n && n.wvL, b = n && n.wvS; if (!a || !b || !okArr(a.t, a.uout, b.uout, a.uin)) return unavailable('Slew-Rate');
      const tms = a.t.map(v => v * 1e6), ym = Math.max.apply(null, a.uin.concat(a.uout, b.uout).map(Math.abs)), yr = niceRange(-ym, ym);
      return plot('Ausgang des Invertierers bei 20 kHz und 1 V Eingang: mit der langsamen Klasse begrenzt die Slew-Rate die Steigung (Dreieck, Spitze ' + fe(a.uaPeak, 'V') + '), mit der schnellen Klasse nicht (Spitze ' + fe(b.uaPeak, 'V') + ')', {
        series: [{ x: tms, y: a.uin, c: COL.u }, { x: tms, y: a.uout, c: COL.i, dash: '' }, { x: tms, y: b.uout, c: COL.o, dash: '7 4' }], xmin: tms[0], xmax: tms[tms.length - 1], ymin: yr[0], ymax: yr[1],
        xticks: ticksLin(tms[0], tms[tms.length - 1], 4).map(v => [v, fv(v)]), yticks: ticksLin(yr[0], yr[1], 4).map(v => [v, fv(v)]), xtitle: 'Zeit t in µs', ytitle: 'Spannung in V',
        legend: [{ t: 'u_e (1 V, 20 kHz)', c: COL.u }, { t: 'u_a langsam: Spitze ' + fe(a.uaPeak, 'V'), c: COL.i }, { t: 'u_a schnell: Spitze ' + fe(b.uaPeak, 'V'), c: COL.o, dash: '7 4' }]
      });
    },
    offset: n => {
      const o = n && n.off; if (!o) return unavailable('Offsetspannung');
      const bx = (x, w, t, c) => RC(x, 40, w, 52, c, 'none', 6) + T(x + w / 2, 62, t[0], 'middle') + T(x + w / 2, 82, t[1], 'middle');
      return svg('Offsetspannung: die Eingangs-Offsetspannung ' + fe(o.uos, 'V') + ' wird mit der Rauschverstärkung ' + ff(o.vn, 0) + ' multipliziert und erscheint am Ausgang als ' + fe(o.uaOff, 'V'),
        bx(8, 110, ['U_os', fe(o.uos, 'V')], COL.u) + ARR(122, 66, 150, 66, COL.k, 2) + bx(154, 100, ['V_n', ff(o.vn, 0)], COL.k) + ARR(258, 66, 286, 66, COL.k, 2) + bx(290, 104, ['U_a,off', fe(o.uaOff, 'V')], COL.a) + T(200, 120, 'U_a,off = U_os · (1 + R_f / R_1)', 'middle', 'font-size="14"'), 136);
    },
    saett: () => curveSvg('Übertragungskennlinie des Invertierers an der Aussteuergrenze: oberhalb der maximalen Eingangsspannung bleibt der Ausgang auf der Grenze stehen', rigCurve('opv_inv', 'saettigung', null, 'uebertragung'), {}),
    integ: () => waveSvg('Integrierer mit Rechteck am Eingang: der Ausgang ist ein Dreieck mit entgegengesetzter Steigung', rigWave('opv_aktiv', 'integrierer', { form: 'rechteck' }), null, {}),
    tp: () => curveSvg('Bode-Diagramm des aktiven Tiefpasses erster Ordnung: waagerecht bis zur Grenzfrequenz, danach 20 dB je Dekade abwärts', rigCurve('opv_aktiv', 'tp-1khz', null, 'bode'), {}),
    quer: () => {
      const box = (x, y, w, t) => RC(x, y, w, 40, 'currentColor', 'none', 8) + T(x + w / 2, y + 25, t, 'middle');
      return svg('Querverweise: das Analogtechnik-Lab in der Mitte, drumherum Netzteil-Lab, Thermik-Lab, Sensorik-Lab, Datenblatt-Lab und Wechselstrom-Lab',
        LN(128, 60, 160, 90, COL.k, 1.5) + LN(272, 60, 240, 90, COL.k, 1.5) + LN(128, 150, 160, 120, COL.k, 1.5) + LN(272, 150, 240, 120, COL.k, 1.5) + LN(200, 125, 200, 150, COL.k, 1.5) +
        box(150, 85, 100, 'Analog') + box(10, 30, 118, 'Netzteil-Lab') + box(272, 30, 118, 'Thermik-Lab') + box(10, 130, 118, 'Sensorik-Lab') + box(272, 130, 118, 'Datenblatt') + box(150, 150, 100, 'Wechselstrom'), 196);
    }
  };
  function symDiodeV(x, y) { return `<polygon points="${x - 14},${y - 18} ${x + 14},${y - 18} ${x},${y + 8}" fill="none" stroke="currentColor" stroke-width="2"/>` + LN(x - 16, y + 12, x + 16, y + 12, 'currentColor', 3) + LN(x, y - 28, x, y - 18) + LN(x, y + 12, x, y + 40); }
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
  /* Auf dem Handy werden Tabellen zu Karten (Zeile = Karte, Spaltenkopf vor dem Inhalt), damit nichts seitlich abgeschnitten wird */
  const CSS = '@media(max-width:600px){.hl table.rs,.hl table.rs tbody{display:block;overflow:visible}.hl table.rs tr:first-child{display:none}.hl table.rs tr{display:block;padding:6px 0;border-top:1px solid var(--line)}.hl table.rs td{display:block;border:0;padding:2px 4px}.hl table.rs td::before{content:attr(data-l) ": ";color:var(--mute);font-size:12px;text-transform:uppercase;letter-spacing:.04em}.hl table.rs td:first-child::before{content:""}}.hl .kk{border-left:4px solid var(--accent);background:var(--well);padding:8px 12px;border-radius:6px;margin:8px 0}.hl ol,.hl ul{margin:.4em 0;padding-left:1.3em}.hl details.ana-vertiefung{border-style:dashed;margin:10px 0 10px;padding:0 14px}.hl details.ana-vertiefung>summary{font-size:14.5px}.hl .hb2 a{color:var(--accent)}';
  /* "Probier es aus": Beispiel aex<n> (wenn ANA_DATA es kennt), sonst Voreinstellung des Prüfstands; { tab } wechselt den Tab, { deep } klappt die Vertiefung zu den Werten auf */
  const TRY = [
    { ex: 'aex1', rig: 'diode', preset: 'led-24v' }, { ex: 'aex2', rig: 'diode', preset: 'si-1k', label: 'Kennlinien vergleichen' }, { ex: 'aex3', rig: 'diode', preset: 'z-12v' },
    { ex: 'aex4', rig: 'schalter', preset: 'led-5v' }, { ex: 'aex5', rig: 'schalter', preset: 'ueb-3', label: 'Übersteuerung ausprobieren' }, { ex: 'aex6', rig: 'schalter', preset: 'mcu-relais', label: 'Relais mit Freilaufdiode ansehen' },
    { rig: 'schalter', preset: 'freilauf-aus', label: 'Fehlerbild ansehen (nur Simulation)' },
    { ex: 'aex8', rig: 'emitter', preset: 'standard' }, { ex: 'aex9', rig: 'emitter', preset: 'gegenkopplung' }, { ex: 'aex11', rig: 'emitter', preset: 'standard', tab: 'curve', label: 'Frequenzgang ansehen' },
    { ex: 'aex10', rig: 'emitter', preset: 'uebersteuert' }, { ex: 'aex13', rig: 'folger', preset: 'emitterfolger' }, { ex: 'aex16', rig: 'folger', preset: 'vergleich' },
    { ex: 'aex14', rig: 'folger', preset: 'z-folger' }, { ex: 'aex15', rig: 'folger', preset: 'konstantstrom' },
    { ex: 'aex17', rig: 'opv_inv', preset: 'v-10' }, { ex: 'aex18', rig: 'opv_inv', preset: 'summierer' }, { ex: 'aex21', rig: 'opv_nin', preset: 'v-5-7' }, { ex: 'aex23', rig: 'opv_nin', preset: 'differenz' },
    { ex: 'aex25', rig: 'opv_komp', preset: 'komparator' }, { ex: 'aex26', rig: 'opv_komp', preset: 'schmitt-inv' }, { ex: 'aex28', rig: 'opv_komp', preset: 'rechteck' },
    { ex: 'aex32', rig: 'opv_aktiv', preset: 'real-gbw', deep: 'bode', label: 'Bode-Diagramm im Prüfstand' }, { ex: 'aex33', rig: 'opv_aktiv', preset: 'real-slew', deep: 'slew', label: 'Slew-Rate im Prüfstand' },
    { ex: 'aex34', rig: 'opv_aktiv', preset: 'offset-drift', deep: 'offset', label: 'Offsetspannung im Prüfstand' }, { ex: 'aex19', rig: 'opv_inv', preset: 'saettigung', deep: 'sat', label: 'Sättigung im Prüfstand' },
    { ex: 'aex29', rig: 'opv_aktiv', preset: 'integrierer' }, { ex: 'aex31', rig: 'opv_aktiv', preset: 'tp-1khz' }, { ex: 'aex22', rig: 'opv_nin', preset: 'folger' },
    { ex: 'aex12', rig: 'emitter', preset: 'standard', label: 'Beispiel zur Fehlersuche laden' }, { ex: 'aex7', rig: 'schalter', preset: 'led-5v', label: 'Zweites Beispiel zur Fehlersuche' },
    { tab: 'calc', label: 'Zum Rechner' }
  ];
  const tryBtn = a => '<div class="tryit">' + a.map((i, k) => { const t = TRY[i]; return t ? `<button class="btn${k ? '' : ' pri'}" data-try="${i}">${t.tab && !t.rig ? '🧮' : '▶'} ${esc(t.label || 'Probier es aus')}</button>` : ''; }).join('') + '</div>';
  const keyOf = (api, id) => { const K = (api && Array.isArray(api.KEYS) && api.KEYS) || (Array.isArray(root.ANA_KEYS) && root.ANA_KEYS) || []; return K.find(k => k && k.id === id) || null; };
  const noteLine = t => `<p class="kk"><b>${esc(t)}</b></p>`;
  const SEC = (id, title, html, tryIdx, deep) => ({ id, title, html: html + (tryIdx && tryIdx.length ? tryBtn(tryIdx) : ''), tryIdx: tryIdx || null, deep: deep || null });
  function limitRows() { const C = CORE(), l = C && Array.isArray(C.limits) ? C.limits : []; return l.map(x => ({ id: x.id, text: x.text || '', lt: LT(x.id), status: x.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)', frage: x.frage || DASH })); }
  function limitTableHtml() { const r = limitRows(); if (!r.length) return P('Die Grenzwerte sind nicht geladen (anacore.js fehlt).'); return `<div data-lim="1">` + TB(['Größe', 'Wert im Lab', 'Status', 'Frage'], r.map(x => [esc(x.text), '<b>' + esc(x.lt) + '</b>', esc(x.status), esc(x.frage)])) + '</div>'; }
  /* Werte der Fehlersuche-Beispiele aus der Diagnose des Kerns (erst nach Klick sichtbar, siehe oben) */
  const FAULTS = [
    { rig: 'schalter', f: 'rb offen', name: 'Basisvorwiderstand offen' }, { rig: 'schalter', f: 'ce schluss', name: 'Kollektor-Emitter-Schluss' }, { rig: 'emitter', f: 'r2 offen', name: 'R_2 offen' },
    { rig: 'emitter', f: 'r1 offen', name: 'R_1 offen' }, { rig: 'emitter', f: 'ce offen', name: 'C_E offen' }, { rig: 'opv_inv', f: 'rf offen', name: 'R_f offen' }, { rig: 'opv_nin', f: 'rg offen', name: 'R_g offen' },
    { rig: 'opv_nin', f: 'versorgung minus fehlt', name: 'negative Versorgung fehlt' }
  ];
  function faultRows() {
    const C = CORE(); if (!C || typeof C.diagnose !== 'function') return [];
    return FAULTS.map(x => {
      let all = null, ver = null;
      try { all = C.diagnose({ rigId: x.rig, ctl: { fehler: x.f } }); ver = C.diagnose({ rigId: x.rig, ctl: { fehler: x.f }, verdeckt: true }); } catch (e) { /* Strich */ }
      all = Array.isArray(all) ? all : []; ver = Array.isArray(ver) ? ver : [];
      const cause = all.find(m => m && m.kind === 'error') || all.find(m => m && m.kind === 'warn') || all.find(m => m && m.kind !== 'info') || null;
      return { name: x.name, rig: x.rig, fehler: x.f, messbild: ver.map(m => m.text).join('; ') || DASH, ursache: cause ? cause.text : DASH };
    });
  }
  function faultTableHtml() { const r = faultRows(); if (!r.length) return P('Die Diagnose ist nicht geladen (anacore-res.js fehlt).'); return TB(['Fehlerbild (Simulation)', 'Messbild', 'Erklärung aus der Diagnose'], r.map(x => ['<b>' + esc(x.name) + '</b>', esc(x.messbild), esc(x.ursache)])); }

  function sections(api) {
    uid = 0; LTLOG.length = 0;
    const n = nums(), out = [], UV = n.uv, sim = esc(TX('simOnly')), klein = esc(TX('kleinspannung')), SN = esc(SIMNUR), DB = esc(DATENBLATT);
    const add = (id, title, html, tryIdx, deep) => out.push(SEC(id, title, html, tryIdx, deep));
    const si = n.si || {}, sch = n.schottky || {}, led = n.led || {}, z = n.z || {}, dc = n.dc || {}, sw = n.sw || {}, ac = n.ac || {}, acN = n.acN || {}, cmp = n.cmp || {}, bo = n.bode || {}, sl = n.slew || {}, of = n.off || {};
    const lg = n.lg || [], zf = n.zf || {}, cs = n.cs || {};
    /* 1 */
    add('halbleiter', '1 Halbleiter und die Diode', DRAW.diodeSym() + DRAW.diode(n) +
      P('Eine <b>Diode</b> aus Silizium leitet den Strom nur in einer Richtung: In <b>Durchlassrichtung</b> (Anode positiv gegenüber der Katode) fließt Strom erst, wenn die <b>Flussspannung</b> erreicht ist; in <b>Sperrrichtung</b> sperrt sie. Ein Halbleiter ist dafür gezielt mit Fremdatomen versehen (p- und n-Gebiet); an ihrer Grenze entsteht die Sperrschicht. ' + esc(TX('modellDiode'))) +
      TB(['Größe', 'Erklärung', 'Übungsschaltung: Silizium, 5 V, 1 kΩ'], [
        ['<b>Flussspannung</b> U_F (Silizium)', 'Spannung an der leitenden Diode, nahezu konstant', esc(LT('uf_si'))],
        ['<b>Arbeitspunkt</b>', 'Schnittpunkt von Kennlinie und Widerstandsgerade', esc('U_D = ' + fe(gv(si, 'ud'), 'V') + ', I_D = ' + fe(gv(si, 'id'), 'A'))],
        ['<b>Schwellspannung</b> U_S', 'Tangente im Arbeitspunkt, Schnittpunkt mit der Spannungsachse (Näherung)', esc(fe(gv(si, 'us'), 'V'))],
        ['<b>Dynamischer Widerstand</b> r_d', 'Steigung der Kennlinie im Arbeitspunkt, dU / dI', esc(fe(gv(si, 'rd'), 'Ω'))],
        ['<b>Schottky-Diode</b>', 'kleinere Flussspannung (Übungswert ' + esc(LT('uf_schottky')) + ')', esc('U_D = ' + fe(gv(sch, 'ud'), 'V'))],
        ['<b>Temperatur</b>', 'Die Flussspannung sinkt mit steigender Temperatur (' + esc(LT('tk_uf')) + ')', esc('bei 27 °C ' + fe(gv(si, 'ud'), 'V') + ', bei 87 °C ' + fe(gv(n.siT, 'ud'), 'V') + ', Änderung ' + fe(n.dT, 'V'))],
        ['<b>Sperrrichtung</b>', 'Der Strom ist null (keine Leitung)', esc('Zustand "' + (n.siRev ? n.siRev.zustand : DASH) + '": I = ' + fe(gv(n.siRev, 'id'), 'A'))]]) +
      P('Die Spannung am Vorwiderstand ist die Quellenspannung minus die Flussspannung. Das Lab zeigt zwei Modelle: die <b>Kennlinie</b> (Exponentialfunktion) und die <b>konstante Flussspannung</b>, mit der die meisten Aufgaben rechnen (Übungswerte, Frage F1 an den Ausbilder). ' + esc(TX('uebungswert'))), [1, 0]);
    /* 2 */
    add('led', '2 LED und Vorwiderstand', DRAW.led(n) +
      P('Eine <b>LED</b> ist eine Diode, die leuchtet. Die LED verträgt nur einen begrenzten Strom (' + esc(LT('led_imax')) + '): Der <b>Vorwiderstand</b> R_V in Reihe legt den Strom fest. Er muss die Spannung aufnehmen, die nach der Flussspannung übrig bleibt; ' + esc(TX('modellDiode'))) +
      TB(['Größe', 'Formel', 'Übungsschaltung: rote LED U_F = ' + fe(2, 'V') + ', 24 V'], [
        ['<b>Vorwiderstand</b> R_V', esc('R_V = (U_B − U_F) / I_F'), esc('für 12 mA: ' + FT('rvLed', { ub: 24, uf: 2, i: 0.012 }))],
        ['<b>Strom</b> bei R_V = ' + fe(3300, 'Ω'), esc('I = (U_B − U_F) / R_V'), esc(fe(gv(led, 'id'), 'A') + ', Spannung am Widerstand ' + fe(gv(led, 'ur'), 'V'))],
        ['<b>Leistung im Vorwiderstand</b>', esc('P = (U_B − U_F)² / R_V'), esc(FT('pRv', { ub: 24, uf: 2, r: 3300 }))],
        ['<b>LED tauschen</b>, gleicher Strom (' + fe(0.02, 'A') + ', rot ' + fe(2, 'V') + ' → blau ' + fe(3.1, 'V') + ')', 'neuer R_V aus dem Kern', esc('R_V = ' + fe(gv(n.swap, 'rv'), 'Ω') + ', P = ' + fe(gv(n.swap, 'p'), 'W'))]]) +
      TB(['LED-Farbe', 'Flussspannung bei ' + esc(LT('uf_iref'))], [['<b>rot</b>', esc(LT('uf_led_rot'))], ['<b>gelb</b>', esc(LT('uf_led_gelb'))], ['<b>grün</b>', esc(LT('uf_led_gruen'))], ['<b>blau</b>', esc(LT('uf_led_blau'))]]) +
      P('Die Flussspannung wächst mit der Photonenenergie: blaue LEDs brauchen mehr als rote. <b>Fehlerbild (nur Simulation):</b> Fehlt der Vorwiderstand (hier mit R_V = ' + fe(1, 'Ω') + ' gerechnet) und liegen ' + fe(5, 'V') + ' an einer LED mit U_F = ' + fe(2, 'V') + ', rechnet das Lab ' + esc(fe(gv(n.ledKurz, 'id'), 'A')) + ' und meldet die Überlast, denn die Grenze liegt bei ' + esc(LT('led_imax')) + '. ' + SN), [0]);
    /* 3 */
    add('zdiode', '3 Z-Diode', DRAW.zdiode(n) +
      P('Eine <b>Z-Diode</b> arbeitet in <b>Sperrrichtung</b> im Durchbruch: Oberhalb der Z-Spannung U_Z leitet sie und hält die Spannung nahezu konstant; der <b>Vorwiderstand</b> begrenzt den Strom. Ohne Vorwiderstand würde die Z-Diode überlastet (zulässige Verlustleistung ' + esc(LT('pz_max')) + '). In Durchlassrichtung verhält sie sich wie eine Siliziumdiode. ' + esc(TX('modellDiode'))) +
      TB(['Größe', 'Formel', 'Übungsschaltung: 12 V, R_V = ' + fe(470, 'Ω') + ', U_Z = ' + fe(5.1, 'V') + ', Last ' + fe(4700, 'Ω')], [
        ['<b>Z-Strom</b> I_Z', esc('I_Z = (U_q − U_Z) / R_V − U_Z / R_L'), esc(FT('izLast', { uq: 12, uz: 5.1, rv: 470, rl: 4700 }) + ' (Zustand "' + (n.z ? n.z.zustand : DASH) + '")')],
        ['<b>Laststrom</b> und Gesamtstrom', esc('I_R = I_Z + I_L'), esc('I_L = ' + fe(gv(z, 'ilast'), 'A') + ', I_R = ' + fe(gv(z, 'iq'), 'A'))],
        ['<b>Verlustleistung</b>', esc('P_Z = U_Z · I_Z'), esc('Z-Diode ' + fe(gv(z, 'pd'), 'W') + ', Vorwiderstand ' + fe(gv(z, 'pr'), 'W'))],
        ['<b>Kleinster Vorwiderstand</b>', esc('R_V,min = (U_max − U_Z) / (P_Z / U_Z)'), esc(FT('rvZ', { uqmax: 15, uz: 5.1, pz: LV('pz_max') }))],
        ['<b>Quellenspannung unter U_Z</b>', 'kein Durchbruch, kein Strom', esc('4 V: Zustand "' + (n.zLow ? n.zLow.zustand : DASH) + '", I_Z = ' + fe(gv(n.zLow, 'iz'), 'A'))],
        ['<b>Verpolt</b> (Durchlassrichtung)', 'leitet wie eine Siliziumdiode', esc('−5 V: Zustand "' + (n.zRev ? n.zRev.zustand : DASH) + '", U = ' + fe(gv(n.zRev, 'ud'), 'V'))]]) +
      P('Die Z-Spannung der Voreinstellung ist ' + esc(LT('uz_std')) + '; Aufgaben nennen sie selbst. Die <b>Stabilisierungsschaltung</b> als Ganzes (Regelverhalten, Last, Linearregler) gehört ins <a href="ntslab.html">Netzteil-Lab</a>; hier geht es nur um das Bauteil und seinen Arbeitspunkt.'), [2]);
    /* 4 */
    add('transistor', '4 Der Transistor', DRAW.npn(n) + DRAW.familie(n) +
      P('Der <b>Transistor</b> (hier der npn-Typ) hat Basis, Kollektor und Emitter. Ein kleiner <b>Basisstrom</b> I_B steuert einen großen <b>Kollektorstrom</b> I_C: Im aktiven Bereich ist I_C das B-fache von I_B, B heißt <b>Gleichstromverstärkung</b>. Zwischen Basis und Emitter liegt eine Diodenstrecke: U_BE ist etwa konstant. ' + esc(TX('modellTransistor'))) +
      TB(['Größe', 'Formel oder Wert', 'Lehrmodell'], [
        ['<b>Gleichstromverstärkung</b> B', esc('I_C = B · I_B'), esc(LT('b_std') + '; Beispiel I_B = ' + fe(40e-6, 'A') + ' → ' + tx(n.xIc))],
        ['<b>Basis-Emitter-Spannung</b> U_BE', 'Diodenspannung der Basisstrecke', esc(LT('ube'))],
        ['<b>Sättigungsspannung</b> U_CE,sat', 'kleinste Spannung am durchgeschalteten Transistor', esc(LT('ucesat'))],
        ['<b>Grenzwerte</b>', 'nicht überschreiten (Auslegungskriterium)', esc('U_CEO ' + LT('uceo') + '; P_tot ' + LT('ptot') + '; I_C,max ' + LT('icmax'))],
        ['<b>Emitterstrom</b> I_E', esc('I_E = I_C + I_B'), esc('im Beispiel der Emitterschaltung (Abschnitt 7): I_E = ' + fe(gv(dc, 'ie'), 'A'))]]) +
      P('Das <b>Ausgangskennlinienfeld</b> zeigt I_C über U_CE für verschiedene Basisströme. Oberhalb von U_CE,sat verläuft jede Kurve waagerecht (Lehrmodell ohne Early-Effekt); darunter fällt der Strom ab: der <b>Sättigungsbereich</b>. Der MOSFET ist ein anderes Bauteil: ' + esc(TX('mosfet'))), [3]);
    /* 5 */
    add('schalter', '5 Der Transistor als Schalter', noteLine(SIMNUR) + DRAW.schaltAusgang() + DRAW.schaltUeb() +
      P('Als <b>Schalter</b> ist der Transistor entweder gesperrt (U_St kleiner als U_BE: kein Strom) oder in der <b>Sättigung</b>: Dann fällt an ihm nur noch U_CE,sat ab, der Rest liegt an der Last. Damit er sicher durchsteuert, bekommt er mehr Basisstrom als nötig: Der <b>Übersteuerungsfaktor</b> ü = I_B / I_B,min sagt, wie viel mehr (Übungsvorschlag ü = ' + esc(LT('ue_typ')) + ', Mindestwert für grün ' + esc(LT('ue_min')) + '). ' + esc(TX('modellTransistor'))) +
      TB(['Größe', 'Formel', 'Übungsschaltung: 5 V, LED ' + fe(2, 'V') + ', R_V ' + fe(330, 'Ω') + ', R_B ' + fe(4700, 'Ω')], [
        ['<b>Kollektorstrom</b> in der Sättigung', esc('I_C,sat = (U_B − U_CE,sat − U_F) / R_V'), esc(tx(n.xIcSat))],
        ['<b>Mindest-Basisstrom</b> und ü', esc('I_B = ü · I_C / B'), esc('I_B,min = ' + fe(gv(sw, 'ibmin'), 'A') + ', I_B = ' + fe(gv(sw, 'ib'), 'A') + ', ü = ' + ff(gv(sw, 'ueb'), 2))],
        ['<b>Basisvorwiderstand</b> R_B', esc('R_B = (U_St − U_BE) / I_B'), esc(tx(n.xRbSw))],
        ['<b>Verlustleistung</b> im Transistor', esc('P_V = U_CE · I_C + U_BE · I_B'), esc(tx(n.xPv))],
        ['<b>Größter R_B</b> (ü = 1) und für ü = ' + esc(LT('ue_typ')), 'aus dem Kern', esc(fe(gv(sw, 'rbMax'), 'Ω') + ' und ' + fe(gv(sw, 'rbSoll'), 'Ω'))],
        ['<b>Beispiel R_B für ' + fe(3.3, 'V') + ', ' + fe(0.045, 'A') + ', B = 110, ü = 1</b>', esc('R_B = (U_St − U_BE) / I_B'), esc('R_B = ' + fe(gv(n.rb1, 'rb'), 'Ω'))],
        ['<b>Beispiel R_B für ' + fe(3.3, 'V') + ', ' + fe(0.06, 'A') + ', B = 100, ü = 3</b>', esc('R_B = (U_St − U_BE) / I_B'), esc('R_B = ' + fe(gv(n.rb3, 'rb'), 'Ω'))]]) +
      P('<b>Halb offen:</b> Mit R_B = ' + esc(fe(200000, 'Ω')) + ' ist ü = ' + esc(ff(gv(n.swHalb, 'ueb'), 2)) + ' kleiner als 1, der Transistor nur aktiv: U_CE = ' + esc(fe(gv(n.swHalb, 'uce'), 'V')) + ', die Verlustleistung ' + esc(fe(gv(n.swHalb, 'pv'), 'W')) + ' im Transistor. Das ist kein sauberer Schaltzustand. <b>Sperrt:</b> Bei ' + esc(fe(0.5, 'V')) + ' Steuerspannung (unter U_BE) ist der Zustand "' + esc(n.swSperr ? n.swSperr.zustand : DASH) + '", U_CE = ' + esc(fe(gv(n.swSperr, 'uce'), 'V')) + '.') +
      P(klein + ' ' + sim + ' ' + SN), [3, 4]);
    /* 6 */
    add('relais', '6 Relais und Freilaufdiode', noteLine(SIMNUR) + DRAW.relais(n) +
      P('Ein <b>Relais</b> ist eine Spule, die Energie speichert. Der Strom steigt nach dem Einschalten mit der Zeitkonstante τ = L / R (nach τ erst 63 %). Beim Abschalten will die Spule den Strom weitertreiben und erzeugt eine <b>Spannungsspitze</b>. Die <b>Freilaufdiode</b> parallel zur Spule fängt sie ab: Die Diode begrenzt die Spannung auf die Flussspannung (' + esc(LT('ufd_freilauf')) + ') über der Betriebsspannung.') +
      TB(['Größe', 'Formel oder Wert', 'Übungsschaltung: 12 V, Spule ' + fe(240, 'Ω') + ', ' + fe(0.3, 'H')], [
        ['<b>Zeitkonstante</b> τ', esc('τ = L / R'), esc(tx(n.xTauR))],
        ['<b>Anstiegszeit auf 90 %</b>', 'aus dem Kern', esc(fe(gv(n.relD, 'tAn90'), 's') + ', Endstrom ' + fe(gv(n.relD, 'i0'), 'A') + ', Spulenleistung ' + fe(gv(n.relD, 'pSpule'), 'W'))],
        ['<b>Spitze mit Freilaufdiode</b>', esc('U_CE,max = U_B + U_FD'), esc(fe(gv(n.relD, 'ucePeak'), 'V') + ', Abklingen in ' + fe(gv(n.relD, 'tAus'), 's'))],
        ['<b>Spitze ohne Freilaufdiode</b> (Fehlerbild)', 'bis zur Durchbruchspannung U_CEO (' + esc(LT('uceo')) + ')', esc(fe(gv(n.rel0, 'ucePeak'), 'V') + (n.rel0 && n.rel0.ueberUceo ? ': über U_CEO, der Transistor wäre überlastet' : ''))]]) +
      P('Ohne Freilaufdiode kann die Spannungsspitze den Transistor zerstören. Das Lab zeigt das als Fehlerbild im Zeitverlauf (Zahl und Grenzwert), es ist kein Versuch zum Nachbauen. ' + SN + ' ' + sim + ' ' + klein), [5, 6]);
    /* 7 */
    add('arbeitspunkt', '7 Arbeitspunkt der Emitterschaltung', DRAW.arbeitspunkt(n) +
      P('Die <b>Emitterschaltung</b> verstärkt ein Wechselsignal. Damit der Transistor es in beide Richtungen verarbeiten kann, stellst du zuerst seinen <b>Arbeitspunkt</b> ein: Gleichstrom I_C und Gleichspannung U_CE ohne Signal. Der <b>Basisspannungsteiler</b> R_1 / R_2 legt die Basisspannung fest. Günstig liegt U_CE etwa in der Mitte der Betriebsspannung (Fenster ' + esc(LT('ap_fenster')) + ' bezogen auf U_B), dann hat der Ausgang nach oben und unten Reserve. ' + esc(TX('modellEmitter'))) +
      TB(['Schritt', 'Formel', 'Übungsschaltung: 12 V, R_1 ' + fe(47000, 'Ω') + ', R_2 ' + fe(10000, 'Ω') + ', R_C ' + fe(2200, 'Ω') + ', R_E ' + fe(570, 'Ω')], [
        ['<b>Basisspannung</b> U_BB', esc('U_BB = U_B · R_2 / (R_1 + R_2)'), esc(tx(n.xUbb))], ['<b>Ersatzwiderstand</b> R_B', esc('R_B = R_1 ∥ R_2'), esc(tx(n.xRbTh))],
        ['<b>Basisstrom</b> I_B', esc('I_B = (U_BB − U_BE) / (R_B + (B + 1) · R_E)'), esc(tx(n.xIb))], ['<b>Kollektorstrom</b> I_C', esc('I_C = B · I_B'), esc(tx(n.xIcDc))],
        ['<b>Kollektor-Emitter-Spannung</b> U_CE', esc('U_CE = U_B − I_C · R_C − I_E · R_E'), esc('U_CE = ' + fe(gv(dc, 'uce'), 'V') + ' (Zustand "' + (dc.zustand || DASH) + '"); ohne R_E gerechnet: ' + tx(n.xUce))]]) +
      P('Wird R_2 größer (hier ' + esc(fe(15000, 'Ω')) + '), steigt die Basisspannung auf ' + esc(fe(gv(n.dc2, 'ubb'), 'V')) + ', I_C auf ' + esc(fe(gv(n.dc2, 'ic'), 'A')) + ' und U_CE sinkt auf ' + esc(fe(gv(n.dc2, 'uce'), 'V')) + ': Der Arbeitspunkt wandert in Richtung Sättigung. Die Arbeitsgerade im Bild verbindet U_B auf der Spannungsachse mit dem Kurzschlussstrom auf der Stromachse; der Arbeitspunkt liegt auf ihr.'), [7]);
    /* 8 */
    add('gegenkopplung', '8 Gegenkopplung durch R_E und Spannungsverstärkung', DRAW.gegen(n) +
      P('Das Signal ändert den Basisstrom und damit I_C; am Kollektorwiderstand entsteht daraus eine große Wechselspannung: <b>V_u ist negativ</b>, der Ausgang ist gegenüber dem Eingang um 180° gedreht (' + esc(LT('emitter_phase')) + '). Der Emitterwiderstand wirkt als <b>Gegenkopplung</b>: Bleibt er für das Signal wirksam, sinkt die Verstärkung; überbrückt ihn der <b>Emitterkondensator</b> C_E, ist sie am größten. Die Kleinsignalrechnung nutzt die Steilheit g_m = I_C / U_T (U_T ' + esc(LT('ut')) + ').') +
      TB(['Größe', 'Formel', 'Übungsschaltung (Abschnitt 7): R_E1 = ' + fe(100, 'Ω') + ' bleibt ungebrückt, R_E2 = ' + fe(470, 'Ω') + ' ist mit C_E überbrückt'], [
        ['<b>Steilheit</b> g_m', esc('g_m = I_C / U_T'), esc(tx(n.xGm))],
        ['<b>Grenzfall ohne Gegenkopplung</b> (R_E,ac = 0)', esc('V_u = −g_m · R_C'), esc(tx(n.xVuE) + ': so groß wird die Verstärkung nie, ein Rest-R_E bleibt immer')],
        ['<b>Mit C_E</b> (R_E,ac = ' + fe(gv(ac, 'reac'), 'Ω') + '), Leerlauf', esc('V_u ≈ −R_C / (R_E + r_e)'), esc('Kern: V_u = ' + ff(gv(ac, 'vuLeer'), 3) + '; Näherung: ' + tx(n.xVuG))],
        ['<b>Mit C_E und Last</b> ' + fe(10000, 'Ω'), esc('R_C ∥ R_L statt R_C'), esc('V_u = ' + ff(gv(ac, 'vu'), 3) + ', das sind ' + tx(n.xDb))],
        ['<b>Ohne C_E</b> (R_E,ac = ' + fe(gv(acN, 'reac'), 'Ω') + '), Leerlauf', esc('V_u ≈ −R_C / (R_E + r_e)'), esc('Kern: V_u = ' + ff(gv(acN, 'vuLeer'), 3) + ', mit Last ' + ff(gv(acN, 'vu'), 3) + '; Näherung: ' + tx(n.xVuGN))],
        ['<b>Vorteil der Gegenkopplung</b>', 'Verstärkung hängt weniger von B und U_T ab', 'dafür kleinere Verstärkung']]) +
      P('Das Minuszeichen steht für die Phasendrehung um 180°. Die Näherung V_u ≈ −R_C / (R_E + r_e) stimmt für große B auf wenige Prozent (Test im Kern); der Kern rechnet mit der vollständigen Kleinsignalschaltung (Hybrid-π). ' + esc(TX('modellEmitter'))), [8]);
    /* 9 */
    add('eingang', '9 Ein- und Ausgangswiderstand, Koppelkondensator', DRAW.freqgang(n) +
      P('Die Stufe belastet die Quelle mit ihrem <b>Eingangswiderstand</b> r_ein (Teiler und Transistor parallel). Der <b>Ausgangswiderstand</b> r_aus der Stufe ist etwa der Kollektorwiderstand. Die <b>Koppelkondensatoren</b> C_1 und C_2 sperren den Gleichanteil und wirken mit den Widerständen als Hochpässe: Unterhalb der <b>unteren Grenzfrequenz</b> f_u sinkt die Verstärkung.') +
      TB(['Größe', 'Beschreibung', 'Übungsschaltung (Abschnitt 7), Quelle ' + fe(600, 'Ω') + ', Last ' + fe(10000, 'Ω') + ', C_1 = C_2 = ' + fe(10e-6, 'F')], [
        ['<b>Eingangswiderstand</b> r_ein', 'R_1 ∥ R_2 ∥ r_ein,Transistor', esc(fe(gv(ac, 'rin'), 'Ω') + ' (Transistor allein: ' + fe(gv(ac, 'rinT'), 'Ω') + ')')], ['<b>Ausgangswiderstand</b> r_aus', 'etwa R_C', esc(fe(gv(ac, 'rout'), 'Ω'))],
        ['<b>Verstärkung mit Quelle</b>', 'Spannungsteiler Quelle gegen r_ein', esc('V_u = ' + ff(gv(ac, 'vus'), 3))],
        ['<b>Eckfrequenzen</b> der Hochpässe', 'f = 1 / (2π · R · C) mit dem jeweiligen Widerstand', esc('f_1 = ' + fe(gv(ac, 'f1'), 'Hz') + ', f_2 = ' + fe(gv(ac, 'f2'), 'Hz'))], ['<b>Untere Grenzfrequenz</b> f_u', 'aus beiden Hochpässen zusammen', esc(fe(gv(ac, 'fu'), 'Hz'))]]) +
      P('Eine hochohmige Quelle verliert Spannung am Eingangswiderstand: Je kleiner r_ein, desto weniger kommt am Eingang an. Der Frequenzgang im Bild zeigt nur den unteren Teil (kein oberer Frequenzgang im Lehrmodell, Frage F6). ' + esc(TX('modellEmitter'))), [9]);
    /* 10 */
    add('aussteuerung', '10 Aussteuerung, Übersteuerung, Klirrfaktor', DRAW.aussteuer(n) +
      P('Die <b>Aussteuerung</b> ist die Signalamplitude am Ausgang im Verhältnis zu dem, was die Stufe verträgt. Geht das Signal zu weit nach unten, läuft der Transistor in die Sättigung; geht es zu weit nach oben, sperrt er: Die Halbwelle wird <b>begrenzt</b> (flach). Schon vor dem Begrenzen verzerrt die gekrümmte Kennlinie das Signal; der <b>Klirrfaktor</b> THD fasst die Oberwellen 2 bis 10 zusammen. Als Meldegrenze gilt ' + esc(LT('klirr_grenze')) + '.') +
      TB(['Amplitude am Eingang', 'Klirrfaktor THD', 'Begrenzen', 'Spitze am Ausgang'], [0.005, 0.3, 0.4].map((ue, i) => [esc(fe(ue, 'V')), esc(ff(gv(lg[i], 'thdProzent'), 2) + ' %'), esc(lg[i] && lg[i].clip ? (lg[i].clip === 'beide' ? 'oben und unten' : lg[i].clip) : 'nein'), esc(fe(gv(lg[i], 'uaPeak'), 'V'))])) +
      P('Übungsschaltung wie in Abschnitt 7 (Quelle ' + fe(600, 'Ω') + ', Last ' + fe(10000, 'Ω') + ', 1 kHz). Ist die obere Reserve kleiner als die untere (hier ' + esc(fe(gv(ac, 'uaMaxOben'), 'V')) + ' gegen ' + esc(fe(gv(ac, 'uaMaxUnten'), 'V')) + '), begrenzt die Stufe zuerst nach oben; der Kern nennt als größte Ausgangsamplitude ' + esc(fe(gv(ac, 'uaMax'), 'V')) + ' und als größte Eingangsamplitude ' + esc(fe(gv(ac, 'ueMax'), 'V')) + '. Ein verschobener Arbeitspunkt verkürzt die Reserve auf einer Seite: Dann wird nur eine Halbwelle flach.'), [10]);
    /* 11 */
    add('kollektor', '11 Kollektor- und Basisschaltung, Impedanzwandler', DRAW.grund(n) +
      P('Bei der <b>Kollektorschaltung</b> (Emitterfolger) liegt der Ausgang am Emitter. Die Spannungsverstärkung ist <b>knapp unter 1</b> (' + esc(LT('kollektor_vu')) + '), ohne Phasendrehung; der Eingangswiderstand ist hoch, der Ausgangswiderstand klein: Die Schaltung ist ein <b>Impedanzwandler</b> (Impedanz = Wechselstromwiderstand). Die <b>Basisschaltung</b> hat einen kleinen Eingangswiderstand und verstärkt ohne Phasendrehung.') +
      TB(['Schaltung', 'V_u', 'Phase', 'r_ein', 'r_aus'], [['<b>Emitter</b>', ff(gv(cmp.emitter, 'vu'), 2), deg(gv(cmp.emitter, 'phase')), fe(gv(cmp.emitter, 'rin'), 'Ω'), fe(gv(cmp.emitter, 'rout'), 'Ω')], ['<b>Kollektor</b>', ff(gv(cmp.kollektor, 'vu'), 3), deg(gv(cmp.kollektor, 'phase')), fe(gv(cmp.kollektor, 'rin'), 'Ω'), fe(gv(cmp.kollektor, 'rout'), 'Ω')], ['<b>Basis</b>', ff(gv(cmp.basis, 'vu'), 1), deg(gv(cmp.basis, 'phase')), fe(gv(cmp.basis, 'rin'), 'Ω'), fe(gv(cmp.basis, 'rout'), 'Ω')]].map(r => r.map((c, i) => (i ? esc(c) : c)))) +
      P('Alle drei mit demselben Arbeitspunkt (Abschnitt 7) gerechnet. <b>Impedanzwandler</b> bei hochohmiger Quelle (' + esc(fe(10000, 'Ω')) + ') und kleiner Last (' + esc(fe(220, 'Ω')) + '): Direkt angeschlossen kommt der Anteil ' + esc(ff(gv(n.cmpW, 'direkt'), 4)) + ' der Quellenspannung an, über den Emitterfolger ' + esc(ff(gv(ob(n.cmpW, 'kollektor'), 'vus'), 4)) + ' (V_u ' + esc(ff(gv(ob(n.cmpW, 'kollektor'), 'vu'), 4)) + ', r_aus ' + esc(fe(gv(ob(n.cmpW, 'kollektor'), 'rout'), 'Ω')) + ').'), [11, 12]);
    /* 12 */
    add('zfolger', '12 Z-Folger und Konstantstromquelle', DRAW.zfolger(n) +
      P('Am <b>Z-Folger</b> hält die Z-Diode die Basisspannung konstant; der Emitter folgt im Abstand U_BE. Der Vorwiderstand R_1 muss den Z-Strom und den Basisstrom liefern. Die <b>Konstantstromquelle</b> legt mit Dioden (oder einer Z-Diode) die Basisspannung fest; der Emitterwiderstand bestimmt den Strom, unabhängig von der Last.') +
      TB(['Größe', 'Formel', 'Übungsschaltung'], [
        ['<b>Vorwiderstand</b> R_1 (Z-Folger)', esc('R_1 = (U_B − U_Z) / (I_Z + I_C / B)'), esc('15 V, U_Z ' + fe(6, 'V') + ', I_Z ' + fe(0.012, 'A') + ', I_C ' + fe(0.09, 'A') + ', B 30: ' + tx(n.xR1z))],
        ['<b>Ausgangsspannung</b> U_E', esc('U_E = U_Basis − U_BE'), esc(tx(n.xUeZ) + ' (Kern: ' + fe(gv(zf, 'ue'), 'V') + '), Basisstrom ' + fe(gv(zf, 'ib'), 'A'))],
        ['<b>Emitterwiderstand</b> R_E (Konstantstrom)', esc('R_E = (n · U_D − U_BE) / I_C'), esc('drei Dioden à ' + fe(0.7, 'V') + ', ' + fe(0.04, 'A') + ': ' + tx(n.xRe))],
        ['<b>Zweites Beispiel</b>', 'zwei Dioden à ' + esc(fe(0.75, 'V')) + ', U_BE ' + esc(fe(0.65, 'V')) + ', ' + esc(fe(0.02, 'A')), esc('R_E = ' + fe(gv(n.cs2, 're'), 'Ω'))]]) +
      P('Ist der Z-Strom kleiner als der Basisstrom, fällt die Z-Diode aus dem Durchbruch und der Folger regelt schlecht. Die Z-Diode als Spannungsstabilisierung allein gehört ins <a href="ntslab.html">Netzteil-Lab</a>.'), [13, 14]);
    /* 13 */
    add('opv', '13 Der Operationsverstärker', noteLine(SIMNUR) + DRAW.opv(n) +
      P('Der <b>Operationsverstärker</b> (kurz OPV) hat zwei Eingänge, den invertierenden (−) und den nichtinvertierenden (+), und einen Ausgang. Er verstärkt die Differenz der Eingangsspannungen mit der sehr großen <b>Leerlaufverstärkung</b> A₀ (Übungswert ' + esc(LT('a0')) + '). Der Ausgang kann nicht über die <b>Aussteuergrenze</b> hinaus: Die Grenze liegt ideal bei der Betriebsspannung (±' + esc(fe(UV, 'V')) + ', ' + esc(LT('uv_std')) + '), real etwas darunter (' + esc(LT('dusat')) + ').') +
      P('<b>Idealer Operationsverstärker:</b> ' + esc(TX('opvModell')) + ' <b>Mit Gegenkopplung</b> (ein Teil des Ausgangs geht auf den invertierenden Eingang zurück) regelt der Ausgang so, dass beide Eingänge gleiche Spannung haben: Am invertierenden Verstärker liegt der Eingang deshalb auf einem <b>virtuellen Nullpunkt</b>. ' + esc(TX('gegenkopplung'))) +
      TB(['Zustand ohne Gegenkopplung', 'Spannungen am Eingang', 'Ausgang (ideal)'], [['<b>Komparator</b>, U_+ größer als U_−', esc(fe(3, 'V') + ' gegen ' + fe(2.5, 'V')), esc('U_a = ' + fe(gv(n.opHoch, 'ua'), 'V') + ' (' + (n.opHoch ? n.opHoch.zustand : DASH) + ')')], ['<b>Komparator</b>, U_+ kleiner als U_−', esc(fe(1.8, 'V') + ' gegen ' + fe(2.5, 'V')), esc('U_a = ' + fe(gv(n.opTief, 'ua'), 'V') + ' (' + (n.opTief ? n.opTief.zustand : DASH) + ')')]]) +
      P('Im Lehrmodell hat der reale Operationsverstärker einen Pol (Verstärkungs-Bandbreite-Produkt, Abschnitt 17), eine Slew-Rate (18), eine Offsetspannung (19) und die Aussteuergrenze (20). Typnamen gibt es hier nicht: ' + DB + ' ' + sim + ' ' + SN), [15]);
    /* 14 */
    add('invertierer', '14 Invertierer und Summierer', DRAW.inv() +
      P('Beim <b>invertierenden Verstärker</b> kommt das Signal über R_1 an den (−)-Eingang, der Rückkopplungswiderstand R_f führt vom Ausgang zurück, der (+)-Eingang liegt auf Masse. Der (−)-Eingang ist ein virtueller Nullpunkt; die Spannungsverstärkung hängt nur von den Widerständen ab. Ausgang und Eingang sind um 180° gedreht (' + esc(LT('opv_inv_phase')) + '). Der <b>Summierer</b> addiert mehrere Eingangsströme am virtuellen Nullpunkt.') +
      TB(['Größe', 'Formel', 'Übungsschaltung: R_1 ' + fe(4700, 'Ω') + ', R_f ' + fe(47000, 'Ω') + ', U_e ' + fe(0.5, 'V')], [
        ['<b>Spannungsverstärkung</b> V_u', esc('V_u = −R_f / R_1'), esc(tx(n.xVInv))], ['<b>Ausgangsspannung</b>', 'U_a = V_u · U_e', esc('U_a = ' + fe(gv(n.inv, 'ua'), 'V'))],
        ['<b>Größte Eingangsspannung</b> ohne Begrenzen', esc('U_e,max = U_sat / |V_u|'), esc(fe(gv(n.inv, 'ueMax'), 'V'))], ['<b>Rückkopplungswiderstand</b> für V_u = −10', esc('R_f = |V_u| · R_1'), esc(tx(n.xRf))],
        ['<b>Summierer</b> (R_f ' + fe(47000, 'Ω') + ', ' + fe(0.5, 'V') + ' über ' + fe(10000, 'Ω') + ', ' + fe(1.1, 'V') + ' über ' + fe(22000, 'Ω') + ')', esc('U_a = −R_f · (U_1 / R_1 + U_2 / R_2)'), esc(tx(n.xUaS))]]) +
      P('Die Ströme der beiden Eingänge im Summierer sind ' + esc(fe(ix(n.sum, 'i', 0), 'A')) + ' und ' + esc(fe(ix(n.sum, 'i', 1), 'A')) + '. Das Verstärkungsmaß in dB schreibst du a = 20 · lg |V_u|: Für |V_u| = 10 sind das ' + esc(tx(n.xDbV)) + '.'), [15, 16]);
    /* 15 */
    add('nichtinvertierer', '15 Nichtinvertierer, Spannungsfolger, Differenzverstärker', DRAW.nin() +
      P('Beim <b>nichtinvertierenden Verstärker</b> liegt das Signal am (+)-Eingang; R_f und R_g bilden den Spannungsteiler der Gegenkopplung. V_u ist nie kleiner als 1 und ohne Phasendrehung. Der <b>Spannungsfolger</b> (R_f = 0 oder kein R_g) hat V_u = 1: ein Impedanzwandler mit sehr großem Eingangswiderstand. Der <b>Differenzverstärker</b> verstärkt die Differenz von U_2 und U_1.') +
      TB(['Größe', 'Formel', 'Übungsschaltung'], [
        ['<b>Spannungsverstärkung</b> V_u', esc('V_u = 1 + R_f / R_g'), esc('R_g ' + fe(10000, 'Ω') + ', R_f ' + fe(47000, 'Ω') + ': ' + tx(n.xVNin))], ['<b>Ausgang</b> bei U_e = ' + esc(fe(0.25, 'V')), 'U_a = V_u · U_e', esc('U_a = ' + fe(gv(n.nin, 'ua'), 'V'))],
        ['<b>Spannungsfolger</b>', esc('V_u = 1'), esc('V_u = ' + ff(gv(n.fol, 'v'), 0) + ', bei ' + fe(2, 'V') + ' am Eingang U_a = ' + fe(gv(n.fol, 'ua'), 'V'))],
        ['<b>Differenzverstärker</b> (R_1 = R_2 ' + fe(10000, 'Ω') + ', R_3 = R_4 ' + fe(47000, 'Ω') + ', U_1 ' + fe(1.6, 'V') + ', U_2 ' + fe(2.1, 'V') + ')', esc('U_a = U_2 · R_4/(R_2+R_4) · (1 + R_3/R_1) − U_1 · R_3/R_1'), esc(tx(n.xUaD))]]) +
      P('Beim Differenzverstärker gilt als Abgleich R_4 / R_2 = R_3 / R_1: Dann ist die <b>Gleichtaktverstärkung</b> null (hier ' + esc(ff(gv(n.diff, 'vgl'), 3)) + '). Ist R_4 verstimmt (' + esc(fe(56000, 'Ω')) + '), wächst sie auf ' + esc(ff(gv(n.diffV, 'vgl'), 3)) + ' und ein Gleichtaktsignal erscheint am Ausgang.'), [17, 18, 28]);
    /* 16 */
    add('komparator', '16 Komparator, Schmitt-Trigger, Rechteckgenerator', DRAW.hyst(n) + DRAW.osz(n) +
      P('Der <b>Komparator</b> arbeitet ohne Gegenkopplung: Er vergleicht zwei Spannungen und springt auf die Aussteuergrenze. Beim <b>Schmitt-Trigger</b> geht ein Teil des Ausgangs auf den (+)-Eingang zurück (Mitkopplung): Es gibt zwei <b>Schaltschwellen</b> U_o und U_u, die <b>Hysterese</b> U_H = U_o − U_u macht ihn unempfindlich gegen Rauschen. ' + esc(TX('mitkopplung'))) +
      TB(['Schaltung', 'Formel', 'Übungsschaltung', 'Ergebnis'], [
        ['<b>Invertierender Schmitt-Trigger</b>', esc('U_o = U_sat · R_3 / (R_2 + R_3)'), esc('R_2 ' + fe(20000, 'Ω') + ', R_3 ' + fe(10000, 'Ω') + ', ±' + fe(UV, 'V')), esc(tx(n.xSInv) + '; U_u = ' + fe(gv(n.sInv, 'uu'), 'V') + '; ' + tx(n.xUH))],
        ['<b>Nichtinvertierender Schmitt-Trigger</b>', esc('U_o = U_sat · R_1 / R_2'), esc('R_1 ' + fe(10000, 'Ω') + ', R_2 ' + fe(47000, 'Ω')), esc(tx(n.xSNin) + '; Hysterese ' + fe(gv(n.sNin, 'uh'), 'V'))],
        ['<b>Rechteckgenerator</b>', esc('T = 2 · R · C · ln((1 + β) / (1 − β))'), esc('R ' + fe(10000, 'Ω') + ', C ' + fe(1e-7, 'F') + ', R_2 = R_3'), esc(tx(n.xTosz) + '; f = ' + fe(gv(n.osc, 'f'), 'Hz'))]]) +
      P('Beim Rechteckgenerator lädt der Kondensator abwechselnd zur oberen und unteren Schaltschwelle (' + esc(fe(gv(n.osc, 'uo'), 'V')) + ' und ' + esc(fe(gv(n.osc, 'uu'), 'V')) + '); die Halbperioden sind ' + esc(fe(gv(n.osc, 't1'), 's')) + ' und ' + esc(fe(gv(n.osc, 't2'), 's')) + '. In der Darstellung läuft er verlangsamt, nichts blinkt häufiger als dreimal pro Sekunde.'), [19, 20, 21]);
    /* 17 bis 20: Vertiefungen */
    const bk = keyOf(api, 'bode');
    add('bode', '17 Vertiefung: Bode-Diagramm und GBW', noteLine(TX('vertiefungHinweis')) + DRAW.bode(n) +
      P('Im <b>Bode-Diagramm</b> trägst du die Verstärkung in dB über der Frequenz auf einer logarithmischen Achse auf. Der Operationsverstärker allein (<b>Leerlauf</b>) fällt ab der Eckfrequenz f_A mit 20 dB je Dekade; bei der Frequenz GBW erreicht er die Verstärkung 1 (0 dB). Mit <b>Gegenkopplung</b> ist die Verstärkung kleiner und flach bis zur <b>Grenzfrequenz</b> f_g, dann folgt sie der Leerlaufkurve. ' + esc(bo.text || DASH)) +
      TB(['Größe', 'Formel', 'Übungsschaltung: langsame Klasse, R_1 ' + fe(10000, 'Ω') + ', R_f ' + fe(100000, 'Ω')], [
        ['<b>Leerlaufverstärkung</b> A₀ und <b>GBW</b>', 'Übungswerte', esc(LT('a0') + '; GBW ' + LT('gbw_langsam') + ' (schnelle Klasse ' + LT('gbw_schnell') + ')')], ['<b>Eckfrequenz im Leerlauf</b> f_A', esc('f_A = GBW / A₀'), esc(fe(gv(bo, 'fA'), 'Hz'))],
        ['<b>Rauschverstärkung</b> V_n', esc('V_n = 1 + R_f / R_1'), esc(tx(n.xVn))], ['<b>Grenzfrequenz</b> f_g (exakt)', esc('f_g = f_A · (1 + A₀ / V_n)'), esc(fe(gv(bo, 'fg'), 'Hz'))],
        ['<b>Näherung</b> f_g ≈ GBW / V_n', esc('f_g ≈ GBW / V'), esc(tx(n.xGbw) + ' (V = V_n); Abweichung ' + pct(gv(bo, 'abwNaeh')))], ['<b>Bei f_g</b>', 'Verstärkung 3 dB kleiner, Phase 45° weiter gedreht', esc(ff(ix(n.bodeFg, 'a', 0), 2) + ' dB statt ' + ff(FV('vDb', { v: gv(bo, 'v0') }), 2) + ' dB, Phase ' + deg(ix(n.bodeFg, 'phi', 0)))],
        ['<b>Neigung im Leerlauf</b>', 'zwei Frequenzen, eine Dekade auseinander', esc(ff(ix(n.bodeOffen, 'a', 1) - ix(n.bodeOffen, 'a', 0), 2) + ' dB von ' + fe(1e5, 'Hz') + ' bis ' + fe(1e6, 'Hz'))]]) +
      LI(['<b>Merke:</b> GBW ≈ V_n · f_g gilt mit der <b>Rauschverstärkung</b> V_n = 1 + R_f / R_1, nicht mit dem Betrag von V_u: Beim Invertierer ist V_n um 1 größer als |V_u| (hier V_n = ' + esc(ff(gv(bo, 'vn'), 0)) + ' bei |V_u| = ' + esc(ff(10, 0)) + ').', esc(bk ? 'Taste ' + (bk.keys || []).join(' oder ') + ': ' + bk.t : 'Die Taste für die Bode-Vertiefung steht in den Tastenkürzeln.'), 'Der Frequenzgang gilt für das Lehrmodell mit einem Pol; Übungswerte, kein Datenblatt.']), [22], 'bode');
    add('slew', '18 Vertiefung: Slew-Rate', noteLine(TX('vertiefungHinweis')) + DRAW.slew(n) +
      P('Die <b>Slew-Rate</b> SR ist die größte Änderungsgeschwindigkeit der Ausgangsspannung (in V/µs). Ein Sinus mit Scheitelwert û und Frequenz f steigt höchstens mit 2π · f · û an. Ist das mehr als SR, folgt der Ausgang nicht mehr: Aus dem Sinus wird ein Dreieck, und die Amplitude sinkt. Die höchste Frequenz bei Vollaussteuerung ist f_max = SR / (2π · û).') +
      TB(['Größe', 'Formel', 'Übungsschaltung: langsame Klasse, û = ' + fe(10, 'V') + ', f = ' + fe(20000, 'Hz')], [
        ['<b>Slew-Rate</b> SR', 'Übungswerte', esc(LT('sr_langsam') + ' (schnelle Klasse ' + LT('sr_schnell') + ')')], ['<b>Vollaussteuerungsbandbreite</b> f_max', esc('f_max = SR / (2π · û)'), esc(tx(n.xFpb) + ' (Kern: ' + fe(gv(sl, 'fpb'), 'Hz') + ')')],
        ['<b>Größte Amplitude</b> bei ' + fe(20000, 'Hz'), esc('û_max = SR / (2π · f)'), esc(fe(gv(sl, 'uhatMax'), 'V'))], ['<b>Anstiegszeit</b> für ' + fe(10, 'V'), esc('t = û / SR'), esc(fe(gv(sl, 'tAnstieg'), 's'))],
        ['<b>Invertierer</b> V_u = −10, ' + fe(1, 'V') + ', ' + fe(20000, 'Hz'), 'Amplitude mit Slew-Rate und ohne', esc('langsam: Spitze ' + fe(gv(n.wvL, 'uaPeak'), 'V') + '; nur durch die Bandbreite (ohne Slew-Rate) wäre |V_u| = ' + ff(Math.abs(gv(n.invF, 'hf')), 2) + ' bei ' + fe(20000, 'Hz') + '; schnelle Klasse: Spitze ' + fe(gv(n.wvS, 'uaPeak'), 'V'))]]) +
      P('Die Slew-Rate begrenzt große Signale bei hohen Frequenzen, kleine Signale bei derselben Frequenz sind davon nicht betroffen. ' + esc(sl.text || DASH)), [23], 'slew');
    add('offset', '19 Vertiefung: Offsetspannung', noteLine(TX('vertiefungHinweis')) + DRAW.offset(n) +
      P('Der <b>Offset</b> entsteht, weil die beiden Eingänge nie ganz gleich sind: Der Operationsverstärker verhält sich, als läge zusätzlich eine kleine Spannung U_os am Eingang. Diese Spannung wird wie das Signal mit V_n = 1 + R_f / R_1 verstärkt und erscheint am Ausgang als Gleichspannung, auch ohne Eingangssignal. Im Lehrmodell gibt es nur diese Offsetspannung, keine Eingangsströme (Frage F13).') +
      TB(['Größe', 'Formel', 'Übungsschaltung'], [
        ['<b>Offsetspannung</b> U_os', 'Übungswerte', esc(LT('uos_langsam') + ' (schnelle Klasse ' + LT('uos_schnell') + ')')],
        ['<b>Ausgangsoffset</b>, R_f ' + fe(100000, 'Ω') + ', R_1 ' + fe(1000, 'Ω'), esc('U_a,off = U_os · (1 + R_f / R_1)'), esc(tx(n.xOff) + ' (Kern: ' + fe(gv(of, 'uaOff'), 'V') + ', V_n = ' + ff(gv(of, 'vn'), 0) + ')')],
        ['<b>mit R_1</b> ' + fe(10000, 'Ω'), 'weniger Verstärkung, weniger Offset', esc(fe(gv(n.off2, 'uaOff'), 'V') + ' (V_n = ' + ff(gv(n.off2, 'vn'), 0) + ')')],
        ['<b>Schnelle Klasse</b>, R_1 ' + fe(1000, 'Ω'), 'anderer Übungswert für U_os', esc(fe(gv(n.offS, 'uaOff'), 'V'))],
        ['<b>Integrierer ohne R_p</b> (R ' + fe(100000, 'Ω') + ', C ' + fe(1e-6, 'F') + ')', 'Offset wird aufintegriert: Drift', esc(ff(gv(n.intOff, 'drift'), 3) + ' V/s, Sättigung nach ' + fe(gv(n.intOff, 'tSatOff'), 's'))],
        ['<b>mit R_p</b> ' + fe(1e6, 'Ω') + ' parallel zum Kondensator', 'Endwert statt Drift', esc(fe(gv(n.intOffRp, 'uaInf'), 'V'))]]) +
      P('Der Offset begrenzt, wie klein ein Gleichsignal sein darf, damit du es noch von der Ausgangsabweichung unterscheidest; große Verstärkung vergrößert ihn. ' + esc(of.text || DASH)), [24], 'offset');
    add('saettigung', '20 Vertiefung: Sättigung des Ausgangs', noteLine(TX('vertiefungHinweis')) + DRAW.saett() +
      P('Der Ausgang des Operationsverstärkers kann nicht über die Aussteuergrenze U_sat hinaus. Wird die Eingangsspannung zu groß, bleibt der Ausgang an der Grenze stehen: Das Signal wird flach <b>begrenzt</b>, die Verstärkung gilt nicht mehr. Die größte Eingangsspannung ohne Begrenzen ist U_e,max = U_sat / |V_u|.') +
      TB(['Fall', 'Formel', 'Übungsschaltung: |V_u| = 10, Betriebsspannung ±' + fe(UV, 'V')], [['<b>Idealer Operationsverstärker</b>', esc('U_e,max = U_sat / |V_u|'), esc(tx(n.satI) + '; Formel: ' + tx(n.xSat))], ['<b>Realer Operationsverstärker</b>', 'U_sat ist ' + esc(LT('dusat')) + ' kleiner als die Betriebsspannung', esc(tx(n.satR))]]) +
      P('Mit einem Eingang von ' + esc(fe(2, 'V')) + ' wäre der Ausgang ohne Grenze −20 V; er bleibt bei −' + esc(fe(UV, 'V')) + ' stehen (ideal). Ein Komparator nutzt die Sättigung bewusst, ein Verstärker soll sie vermeiden.'), [25], 'sat');
    /* 21 */
    add('integrierer', '21 Integrierer, Differenzierer, aktive Filter', DRAW.integ() + DRAW.tp() +
      P('Der <b>Integrierer</b> ersetzt R_f des Invertierers durch einen Kondensator: Der Ausgang ist das Integral der Eingangsspannung mit negativem Vorzeichen; bei konstantem Eingang steigt oder fällt er linear. Der <b>Differenzierer</b> vertauscht R und C: Er antwortet auf die Änderung des Eingangs (Rechteck gibt Nadeln). Der <b>aktive Tiefpass</b> und <b>Hochpass</b> erster Ordnung sind Invertierer mit Kondensator; die Grenzfrequenz ist f_g = 1 / (2π · R · C) (' + esc(LT('integr_db')) + ' beim Integrierer).') +
      TB(['Schaltung', 'Formel', 'Übungsschaltung', 'Ergebnis'], [
        ['<b>Integrierer</b>, Steigung', esc('dU_a/dt = −U_e / (R · C)'), esc('R ' + fe(100000, 'Ω') + ', C ' + fe(1e-6, 'F') + ', ' + fe(2, 'V')), esc(tx(n.xSlope) + ', Zeitkonstante ' + tx(n.xTau) + ', Sättigung nach ' + fe(gv(n.integ, 'tSat'), 's'))],
        ['<b>Integrierer</b> mit R_p', esc('V_0 = −R_p / R'), esc('R_p ' + fe(1e6, 'Ω')), esc('V_0 = ' + ff(gv(n.integRp, 'v0'), 1) + ', f_g = ' + fe(gv(n.integRp, 'fgRp'), 'Hz'))],
        ['<b>Frequenz mit |V| = 1</b>', esc('R = 1 / (2π · f · C)'), esc(fe(100, 'Hz') + ', C ' + fe(22e-9, 'F')), esc(tx(n.xRInt))],
        ['<b>Differenzierer</b>', esc('f_ref = 1 / (2π · R_f · C)'), esc('R_f ' + fe(10000, 'Ω') + ', C ' + fe(1e-7, 'F') + ', R_s ' + fe(100, 'Ω')), esc('f_ref = ' + fe(gv(n.dif, 'fRef'), 'Hz') + ', Begrenzung bei ' + fe(gv(n.dif, 'fgRs'), 'Hz'))],
        ['<b>Aktiver Tiefpass</b>', esc('f_g = 1 / (2π · R_f · C_f)'), esc('R_1 ' + fe(10000, 'Ω') + ', R_f ' + fe(100000, 'Ω') + ', C_f ' + fe(1.59e-9, 'F')), esc('V_0 = ' + ff(gv(n.tp, 'v0'), 1) + ', ' + tx(n.xFgTp))],
        ['<b>Aktiver Hochpass</b>', esc('f_g = 1 / (2π · R_1 · C_1)'), esc('R_1 ' + fe(10000, 'Ω') + ', R_f ' + fe(100000, 'Ω') + ', C_1 ' + fe(1e-8, 'F')), esc('V_∞ = ' + ff(gv(n.hp, 'vInf'), 1) + ', f_g = ' + fe(gv(n.hp, 'fg'), 'Hz'))]]) +
      P('Ohne Parallelwiderstand R_p driftet der Integrierer schon durch den Offset (Abschnitt 19). Die Filter sind nur erster Ordnung (Frage F12).'), [26, 27]);
    /* 22 */
    add('fehlersuche', '22 Fehlersuche an Transistor- und OPV-Stufen', noteLine(SIMNUR) +
      P('Fehlersuche heißt: <b>messen, einordnen, begründen</b>. Du misst Spannungen gegen Masse und vergleichst sie mit dem, was du aus der Schaltung erwartest. Jede Meldung des Labs nennt die gerechnete Zahl; ' + esc(TX('ampelHinweis'))) +
      LI(['<b>Am Transistor:</b> Miss U_CE und die Spannung am Emitter. U_CE gleich der Betriebsspannung bedeutet: kein Strom, der Transistor sperrt. U_CE nahe ' + esc(LT('ucesat')) + ' bedeutet: Sättigung, der Strom ist durch die Last begrenzt. Dazwischen arbeitet er aktiv.',
        '<b>Verstärkung prüfen:</b> Ist der Arbeitspunkt in Ordnung, aber die Verstärkung viel kleiner als erwartet, sieh nach der Gegenkopplung (Abschnitt 8) und nach der Last.', '<b>Am Operationsverstärker:</b> Mit Gegenkopplung sind die beiden Eingänge praktisch gleich. Steht der Ausgang dagegen an der Aussteuergrenze, obwohl der Eingang klein ist, fehlt die Gegenkopplung oder eine Versorgung.',
        '<b>Eine Änderung nach der anderen:</b> Behebe die vermutete Ursache und prüfe, ob die Messwerte wieder zum erwarteten Verhalten passen.']) +
      P('Die Beispiele unten zeigen für einige Fehlerbilder, was du messen würdest und wie der Kern es erklärt. Die Beispiele stehen erst nach dem Klick im Text, damit sie keine offene Aufgabe verraten.') +
      '<div data-reveal="faults"><button class="btn" data-reveal-btn>Messbilder aufdecken</button></div>' +
      P(klein + ' ' + sim + ' ' + SN), [29, 30]);
    /* 23 */
    add('quer', '23 Querverweise', DRAW.quer() + LI([
      '<b><a href="ntslab.html">Netzteil-Lab</a>:</b> Z-Diode als Stabilisierung, Linearregler, Gleichrichter und Siebung. Hier nur die Z-Diode als Bauteil und der Z-Folger als Transistorschaltung.',
      '<b><a href="thmlab.html">Thermik-Lab</a>:</b> Wärmewiderstand, Kühlkörper und Sperrschichttemperatur. Hier nur die elektrische Verlustleistung als Zahl und die Grenzwerte (P_tot).',
      '<b><a href="senlab.html">Sensorik-Lab</a>:</b> Messbrücke und Messverstärker mit Sensor. Hier der Differenzverstärker und der Summierer als Grundschaltung.',
      '<b><a href="dslab.html">Datenblatt-Lab</a>:</b> Datenblatt lesen und Bauteile austauschen. Hier nur Lehrmodell-Kennwerte als Begriffe; ' + esc(DATENBLATT),
      '<b><a href="wsllab.html">Wechselstrom-Lab</a>:</b> Zeiger, RC-Filter und Bode-Diagramm von passiven Gliedern. Hier nur das Bode-Diagramm des Verstärkers.',
      '<b><a href="digilab.html">Digital-Lab</a>:</b> Transistor als Logikglied. Hier nur der Schalter mit LED, Relais und Widerstand.',
      '<b><a href="messlab.html">MessLab</a>:</b> Messgeräte und Oszilloskop bedienen. Hier liest du nur die Darstellung ab.',
      '<b><a href="pruefungslab.html">Prüfungs-Lab</a>:</b> Pool-Fragen zum Thema (nur Lesen).']) +
      P('<b>MOSFET:</b> ' + esc(TX('mosfet')) + ' Der Abblockkondensator an der Versorgung ist nur ein Begriff: Er gehört ins <a href="emvlab.html">EMV-Lab</a>.'), null);
    add('formeln', '24 Formelsammlung und feste Werte', formulaTableHtml() + P('<b>Alle festen Werte des Labs</b> aus einer Tabelle (✓ belegt: Quelle im Prüfungspool oder vom Ausbilder; Übungswert (A): Der Ausbilder gleicht ab, die Frage steht rechts):') + limitTableHtml(), [31]);
    add('glossar', '25 Glossar', glossaryHtml(), null);
    add('tasten', '26 Tastenkürzel', keysTableHtml(api), null);
    return out;
  }
  /* Tabellen aus Kern und KEYS (nichts davon steht hier von Hand) */
  function formulaRows() { const C = CORE(), f = C && C.formulas; if (!f) return []; const l = typeof f.list === 'function' ? f.list() : []; return (l || []).filter(x => x && x.id).map(x => ({ id: x.id, name: x.name || x.id, symbol: x.symbol || '', expr: x.expr || '', unit: x.unit || '', explain: x.explain || '' })); }
  function formulaTableHtml() { const r = formulaRows(); if (!r.length) return P('Der Rechenkern ist nicht geladen (anacore-res.js fehlt): Ohne ihn gibt es keine Formelsammlung.'); return P('Alle Formeln des Labs aus einer Tabelle. Im Tab „Rechnen“ setzt du Zahlen ein und siehst den Rechenweg.') + TB(['Größe', 'Formel', 'Einheit', 'Hinweis'], r.map(x => [esc(x.name), esc(x.expr), esc(x.unit || DASH), esc(x.explain)])); }
  function glossaryRows() { const C = CORE(), g = C && C.glossary, items = g && typeof g.list === 'function' ? g.list() : (Array.isArray(g) ? g : []); return (items || []).filter(x => x && x.term).map(x => ({ term: x.term, genus: x.genus || '', abbr: x.abbr || '', unit: x.unit || '', text: x.text || '' })); }
  function glossaryHtml() {
    const r = glossaryRows(); if (!r.length) return P('Das Glossar ist nicht geladen (anacore.js fehlt).');
    return TB(['Begriff', 'Bedeutung'], r.map(x => [`<b>${esc((x.genus ? x.genus + ' ' : '') + x.term)}</b>${x.abbr || x.unit ? ' (' + esc([x.abbr, x.unit].filter(Boolean).join('; ')) + ')' : ''}`, esc(x.text)]));
  }
  function keyRows(api) { const K = (api && Array.isArray(api.KEYS) && api.KEYS) || (Array.isArray(root.ANA_KEYS) && root.ANA_KEYS) || []; return K.filter(k => k).map(k => ({ keys: Array.isArray(k.keys) ? k.keys : [], t: k.t || '' })); }
  function keysTableHtml(api) { const r = keyRows(api); return r.length ? TB(['Taste', 'Wirkung'], r.map(k => [k.keys.map(x => `<code>${esc(x)}</code>`).join(' oder '), esc(k.t)])) + '<p class="hint2">Die Kürzel gelten nicht, solange ein Eingabefeld oder ein Fenster offen ist.</p>' : P('Die Tastenkürzel sind nicht geladen.'); }
  /* Zustand der Vertiefungen (ana.deep = { bode, slew, offset, sat, n }): über api.deep, sonst über den Speicher der Oberfläche */
  let API0 = null;
  const DEEPS = ['bode', 'slew', 'offset', 'sat'];
  function deepState(api, key) { try { if (api && api.deep && typeof api.deep.get === 'function') { const d = api.deep.get(); return !!(d && d[key || 'bode']); } if (api && typeof api.lsGet === 'function') { const d = api.lsGet('ana.deep', {}); return !!(d && d[key || 'bode']); } } catch (e) { /* zu */ } return false; }
  function deepSave(api, key, open) {
    try {
      if (DEEPS.indexOf(key) < 0) return false;
      if (api && api.deep && typeof api.deep.set === 'function') { if (deepState(api, key) !== !!open) api.deep.set(key, !!open); return true; }
      if (api && typeof api.lsGet === 'function' && typeof api.lsSet === 'function') { const d = api.lsGet('ana.deep', {}), o = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; if (!!o[key] !== !!open) { o[key] = !!open; if (open) o.n = (+o.n || 0) + 1; api.lsSet('ana.deep', o); } return true; }
    } catch (e) { /* kein Absturz */ }
    return false;
  }
  const exampleExists = id => { const d = root.ANA_DATA, a = d && d.examples; return !!(Array.isArray(a) && a.some(x => x && x.id === id)); };
  /* Beispiele zur Fehlersuche: nur ohne offene Aufgabe (api.S.task); danach steht die Tabelle im Text, ein erneutes render oder refresh() entfernt sie wieder */
  const taskOpen = api => !!(api && api.S && api.S.task);
  function revealFaults(host, api) {
    const box = host.querySelector && host.querySelector('[data-reveal="faults"]'); if (!box) return false;
    if (taskOpen(api)) { if (api.toast) api.toast('Beende zuerst die Aufgabe: Die Messbilder verraten sonst den Fehler.'); return false; }
    box.innerHTML = faultTableHtml() + '<div class="btns"><button class="btn" data-reveal-hide>Messbilder wieder verbergen</button></div>'; box.dataset.open = '1'; return true;
  }
  function hideFaults(host) { const box = host && host.querySelector && host.querySelector('[data-reveal="faults"]'); if (!box) return false; box.innerHTML = '<button class="btn" data-reveal-btn>Messbilder aufdecken</button>'; box.dataset.open = ''; return true; }
  X.help = X.help || {};
  X.help.render = function (host, api) {
    if (!host) return; api = api || {}; API0 = api;
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('ana-help-css')) { const s = document.createElement('style'); s.id = 'ana-help-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!CORE()) { host.innerHTML = `<div class="card pl"><p class="big">Lernen wird geladen</p><p class="hint2">Der Rechenkern ist nicht geladen (anacore.js fehlt). Ohne ihn gibt es hier keine Zahlen und Tabellen.</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    const secs = sections(api);
    host.innerHTML = `<div class="card pl"><h4>Lernen</h4><p class="hint2" style="margin:0">Analogtechnik: Halbleiter und Verstärker, kurz erklärt. Jeder Abschnitt mit Versuch hat einen Knopf „Probier es aus“, der den passenden Prüfstand lädt. Alle Zahlen stammen aus derselben Rechnung wie im Rechner; Übungswerte tragen das Zeichen „(Übungswert)“, belegte Werte ein „✓“, Bauteilwerte der Beispiele heißen „Übungsschaltung“. ${esc(TX('simOnly'))} ${esc(TX('kleinspannung'))}</p></div><div class="hl">` +
      secs.map((s, i) => s.deep
        ? `<details class="ana-vertiefung" data-deep="${esc(s.deep)}" data-sec="${esc(s.id)}"${deepState(api, s.deep) ? ' open' : ''}><summary>${esc(s.title)}&nbsp;<span class="bdg uw">Vertiefung</span></summary><div class="hb2">${s.html}</div></details>`
        : `<details${i === 0 ? ' open' : ''} data-sec="${esc(s.id)}"><summary>${esc(s.title)}</summary><div class="hb2">${s.html}</div></details>`).join('') + '</div>';
    /* Zähler analern1 (Abzeichen "Erste Schritte beim Lernen"): Abschnitt 1 steht beim Aufruf des Tabs offen und wird damit angezeigt */
    try { if (api.stat && secs[0] && /^1 /.test(secs[0].title)) api.stat('analern1', 1, 'max'); } catch (e) { /* Zähler ist freiwillig */ }
    if (!host.addEventListener) return;
    once(host, 'help', 'click', e => {
      const a = API0 || {};
      const rb = e.target && e.target.closest && e.target.closest('[data-reveal-btn]'); if (rb) { revealFaults(host, a); return; }
      const hb = e.target && e.target.closest && e.target.closest('[data-reveal-hide]'); if (hb) { hideFaults(host); return; }
      const b = e.target && e.target.closest && e.target.closest('[data-try]'); if (!b) return; const t = TRY[+b.dataset.try]; if (!t) return;
      if (t.tab && !t.rig) { if (a.setTab) a.setTab(t.tab); return; }
      if (t.deep) deepSave(a, t.deep, true);
      let ok = false; if (t.ex && a.loadExample && exampleExists(t.ex)) ok = a.loadExample(t.ex) !== false;
      if (!ok && a.loadRig) a.loadRig({ rig: t.rig, preset: t.preset, tab: t.tab || 'rig', name: 'Probier es aus', toast: 'Geladen: ' + (t.label || t.rig) });
    });
    /* toggle sprudelt nicht nach oben: Erfassungsphase am Host */
    once(host, 'deep', 'toggle', e => {
      const d = e.target; if (!d || !d.dataset) return;
      if (d.dataset.deep && DEEPS.indexOf(d.dataset.deep) >= 0) { deepSave(API0, d.dataset.deep, !!d.open); return; }
      if (d.dataset.sec === 'halbleiter' && d.open) { try { if (API0 && API0.stat) API0.stat('analern1', 1, 'max'); } catch (er) { /* freiwillig */ } }
    }, true);
  };
  /* Vom Rahmen zu rufen, wenn eine Aufgabe startet: entfernt aufgedeckte Messbilder aus dem Text */
  X.help.refresh = function (host) { const h = host || (typeof document !== 'undefined' && document.querySelector ? document.querySelector('#helpView') : null); try { return hideFaults(h); } catch (e) { return false; } };
  X.help.fn = { nums, FX, FV, FT, LT, LV, TX, sections, formulaRows, formulaTableHtml, glossaryRows, glossaryHtml, keyRows, keysTableHtml, limitRows, limitTableHtml, svgTextCheck, DRAW, TRY, exampleExists, wrap, SCALE390, deepState, deepSave, plot, curveSvg, waveSvg, rigCurve, rigWave, faultRows, faultTableHtml, revealFaults, hideFaults, FAULTS, LTLOG, EC, DEEPS, SIMNUR, DATENBLATT, fv, ticksLin, ticksLog, niceRange };
  if (typeof module !== 'undefined') module.exports = X.help;
})(typeof window !== 'undefined' ? window : globalThis);
