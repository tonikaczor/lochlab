'use strict';
/* Tonfunk Analogtechnik-Lab: Tab "Rechnen" (WP3c, SPEC 6.4).
   Acht Karten aus ANA_CORE.formulas (alle 50 Einträge, Rechenweg = expr + Kerntext) plus zwei Prüfzeilen (Arbeitspunkt aus tr.dc, Schalter aus tr.switch);
   dazu der Übungsgenerator ("Neue Aufgabe") für alle ANA_CORE.exercise-Arten (Prüfung mit exercise.check, Zähler anacalc).
   ALLE Zahlen kommen aus ANA_CORE (formulas.get(id).calc/fn, tr.dc, tr.switch, TEXTS, limitText, exercise); hier steht keine zweite Formelimplementierung
   (SPEC Regel 7). Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen. Alle Beispielwerte in den Feldern sind Übungswerte.
   Einheitenvorsätze beim Einlesen: "4,7 kΩ", "12 mA", "100 nF", "4k7" nimmt der Kern (parseQty); eine reine Zahl gilt in der Anzeigeeinheit des Feldes.
   Anzeigeeinheit und Vorbelegung eines Feldes ergeben sich aus dem Vorgabewert der Kernformel (Vorsatzwahl, keine Physik).
   Schnittstelle (VERTRAG 6.5): window.ANA_UI_EXT.calc.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter ANA_UI_EXT.calc.fn
   und werden von quelle/analab/test_anaui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ANA_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + (u ? ' ' + u : '') : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (anacore.js, anacore-op.js und anacore-res.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (anacore.js, anacore-op.js oder anacore-res.js ist nicht vollständig geladen). Dieser Rechner liefert deshalb keine Zahlen.';
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben lesen */
  const PLAIN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)(e[+-]?\d+)?$/i;
  /* Text -> SI-Zahl: reine Zahl gilt in der Anzeigeeinheit des Feldes (f.scale); mit Vorsatz oder Einheit ("4,7 kΩ", "12 mA", "4k7") nimmt der Kern sie in SI */
  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1;
    if (typeof txt === 'number') return fin(txt) ? Number((txt * sc).toPrecision(12)) : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    if (PLAIN.test(t)) { const x = Number(t.replace(',', '.')); return fin(x) ? Number((x * sc).toPrecision(12)) : NaN; }
    const q = C && typeof C.parseQty === 'function' ? tryf(() => C.parseQty(t), NaN) : NaN;
    return fin(q) ? q : NaN;
  }
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limT = id => { const C = CORE(); return C && typeof C.limitText === 'function' ? tryf(() => C.limitText(id), '') : ''; };
  const limN = (label, id) => { const t = limT(id); return t ? label + ' ' + t : ''; };

  /* ============================================================ Anzeigeeinheit je Feld (Vorsatzwahl nach Vorgabewert) */
  const PREF = { p: 1e-12, n: 1e-9, 'µ': 1e-6, m: 1e-3, '': 1, k: 1e3, M: 1e6 };
  const ALLOW = { 'Ω': ['', 'k', 'M'], A: ['n', 'µ', 'm', ''], F: ['p', 'n', 'µ', 'm', ''], H: ['µ', 'm', ''], Hz: ['', 'k', 'M'], s: ['µ', 'm', ''], W: ['m', ''], V: ['m', ''] };
  const MINM = { V: 0.1 };
  function pickUnit(unit, def) {
    if (unit === 'V/s') return ['V/µs', 1e6];
    const al = ALLOW[unit]; if (!al) return [unit || '', 1];
    const a = Math.abs(Number(def)), mm = MINM[unit] || 1; let best = al[0];
    if (!(a > 0) || !fin(a)) return [unit, 1];
    al.forEach(p => { if (a >= PREF[p] * mm * (1 - 1e-9)) best = p; });
    return [best + unit, PREF[best]];
  }
  const dnum = x => { if (!fin(x)) return ''; const s = String(Number(Number(x).toPrecision(6))); return /e/.test(s) ? fm(Number(Number(x).toPrecision(6)), 6) : s.replace('.', ','); };

  /* ============================================================ Karten (Daten, keine Formeln) */
  const CARDS = [
    { id: 'c1', icon: '💡', title: '1 LED und Z-Diode', rows: ['rvLed', 'pRv', 'rvZ', 'izLast', 'rLastZ', 'iKette'] },
    { id: 'c2', icon: '🔀', title: '2 Transistor als Schalter', rows: ['icSat', 'ibSchalter', 'rbSchalter', 'ueb', 'pVtr', 'tauRelais', 'schaltCheck'] },
    { id: 'c3', icon: '🎯', title: '3 Arbeitspunkt und Basisspannungsteiler', rows: ['ubb', 'rbTh', 'ibEmitter', 'icAusIb', 'r2Teiler', 'ucePunkt', 'apDc'] },
    { id: 'c4', icon: '📶', title: '4 Emitterschaltung: V_u, r_ein, r_aus', rows: ['gm', 'reT', 'rinT', 'vuEmitter', 'vuGegen'] },
    { id: 'c5', icon: '🪞', title: '5 Folger, Z-Folger und Konstantstromquelle', rows: ['vuFolger', 'ueFolger', 'r1Zfolger', 'reKonst', 'iBegr'] },
    { id: 'c6', icon: '➖', title: '6 Invertierender und nichtinvertierender Verstärker, Summierer, Differenzverstärker, dB', rows: ['vInv', 'vNin', 'vnRausch', 'rfInv', 'r1Inv', 'rfNin', 'uaSumm', 'uaDiff', 'vDb', 'vAusDb'] },
    { id: 'c7', icon: '🔔', title: '7 Schmitt-Trigger und Rechteckgenerator', rows: ['schmittInv', 'schmittNin', 'uh', 'tOsz'] },
    { id: 'c8', icon: '∫', title: '8 Integrierer, Filter, GBW, Slew-Rate und Offset', rows: ['slopeInt', 'rInt', 'tau', 'fgAktiv', 'fgGbw', 'fpb', 'uosOut', 'ueMaxSat'] }
  ];
  /* Prüfzeilen ohne Eintrag in formulas (Aussage von tr.dc bzw. tr.switch); Vorgaben sind Übungswerte (SI) */
  const STATE_ROWS = {
    apDc: { title: 'Arbeitspunkt aus den Bauteilen prüfen (Kern: tr.dc)', expr: 'U_BB, I_B, I_C, U_CE aus dem vollständigen Gleichungssystem (Sättigung mit zwei Gleichungen)', unit: 'V',
      args: [{ key: 'ub', label: 'Betriebsspannung U_B', unit: 'V', def: 12 }, { key: 'r1', label: 'R_1', unit: 'Ω', def: 47000 }, { key: 'r2', label: 'R_2', unit: 'Ω', def: 10000 },
        { key: 'rc', label: 'R_C', unit: 'Ω', def: 2200 }, { key: 're', label: 'R_E (Gleichstrom, gesamt)', unit: 'Ω', def: 570 }, { key: 'b', label: 'Gleichstromverstärkung B', unit: '', def: 100 }] },
    schaltCheck: { title: 'Schalter mit LED-Last prüfen (Kern: tr.switch)', expr: 'I_C,sat, I_B,min, ü und U_CE aus dem Schaltermodell (gesättigt, aktiv oder gesperrt)', unit: 'A',
      args: [{ key: 'ub', label: 'Betriebsspannung U_B', unit: 'V', def: 5 }, { key: 'ust', label: 'Steuerspannung U_St', unit: 'V', def: 5 }, { key: 'rb', label: 'Basisvorwiderstand R_B', unit: 'Ω', def: 6000 },
        { key: 'b', label: 'Gleichstromverstärkung B', unit: '', def: 100 }, { key: 'rv', label: 'LED-Vorwiderstand R_V', unit: 'Ω', def: 330 }, { key: 'uf', label: 'Flussspannung der LED U_F', unit: 'V', def: 2 }] }
  };
  /* Hinweise je Zeile: nur Texte aus TEXTS/limits (Regel 1, 2) */
  const NOTES = {
    rvLed: () => [limN('Zulässiger LED-Strom:', 'led_imax'), textOf('modellDiode')], pRv: () => [textOf('modellDiode')], rvZ: () => [limN('Zulässige Verlustleistung der Z-Diode:', 'pz_max'), textOf('modellDiode')],
    izLast: () => [textOf('modellDiode')], rLastZ: () => [textOf('modellDiode')], iKette: () => [textOf('modellDiode')],
    icSat: () => [limN('Sättigungsspannung U_CE,sat:', 'ucesat'), textOf('modellTransistor')], ibSchalter: () => [limN('Übersteuerung üblich ü =', 'ue_typ'), textOf('modellTransistor')],
    rbSchalter: () => [limN('Basis-Emitter-Spannung U_BE =', 'ube'), textOf('modellTransistor')], ueb: () => [limN('Mindest-Übersteuerung ü', 'ue_min'), textOf('modellTransistor')],
    pVtr: () => [limN('Zulässige Verlustleistung des Transistors:', 'ptot'), textOf('modellTransistor')], tauRelais: () => [textOf('modellTransistor')],
    schaltCheck: () => [limN('Mindest-Übersteuerung ü', 'ue_min'), textOf('modellTransistor')],
    ubb: () => [textOf('modellTransistor')], rbTh: () => [textOf('modellTransistor')], ibEmitter: () => [limN('Basis-Emitter-Spannung U_BE =', 'ube'), textOf('modellTransistor')], icAusIb: () => [textOf('modellTransistor')],
    r2Teiler: () => [textOf('modellTransistor')], ucePunkt: () => [limN('Arbeitspunkt-Fenster:', 'ap_fenster'), textOf('modellTransistor')], apDc: () => [limN('Arbeitspunkt-Fenster:', 'ap_fenster'), textOf('modellTransistor')],
    gm: () => [limN('Temperaturspannung U_T =', 'ut'), textOf('modellEmitter')], reT: () => [limN('Temperaturspannung U_T =', 'ut'), textOf('modellEmitter')], rinT: () => [textOf('modellEmitter')],
    vuEmitter: () => [limN('Phase der Emitterschaltung:', 'emitter_phase'), textOf('modellEmitter')], vuGegen: () => [textOf('modellEmitter')],
    vuFolger: () => [limN('V_u der Kollektorschaltung', 'kollektor_vu'), textOf('modellEmitter')], ueFolger: () => [textOf('modellTransistor')], r1Zfolger: () => [textOf('modellTransistor')], reKonst: () => [textOf('modellTransistor')], iBegr: () => [textOf('modellTransistor')],
    vInv: () => [textOf('opvModell'), textOf('gegenkopplung')], vNin: () => [limN('V_u des Nichtinvertierers', 'opv_nin_vmin'), textOf('opvModell')], vnRausch: () => [textOf('opvModell')],
    rfInv: () => [textOf('opvModell')], r1Inv: () => [textOf('opvModell')], rfNin: () => [limN('V_u des Nichtinvertierers', 'opv_nin_vmin'), textOf('opvModell')],
    uaSumm: () => [textOf('opvModell')], uaDiff: () => [textOf('opvModell')], vDb: () => [limN('Faktor vor dem Logarithmus:', 'db_faktor')], vAusDb: () => [limN('Faktor vor dem Logarithmus:', 'db_faktor')],
    schmittInv: () => [textOf('mitkopplung')], schmittNin: () => [textOf('mitkopplung')], uh: () => [textOf('mitkopplung')], tOsz: () => [textOf('mitkopplung')],
    slopeInt: () => [limN('Steigung des Integrierers:', 'integr_db')], rInt: () => [textOf('opvModell')], tau: () => [], fgAktiv: () => [textOf('opvModell')],
    fgGbw: () => [limN('Verstärkungs-Bandbreite-Produkt (langsamer Operationsverstärker):', 'gbw_langsam'), textOf('vertiefungHinweis')],
    fpb: () => [limN('Slew-Rate (langsamer Operationsverstärker):', 'sr_langsam'), textOf('vertiefungHinweis')],
    uosOut: () => [limN('Offsetspannung (langsamer Operationsverstärker):', 'uos_langsam'), textOf('vertiefungHinweis')], ueMaxSat: () => [textOf('vertiefungHinweis')]
  };
  /* Bezeichnung der Übungsarten (alle 37 Arten des Kerns) */
  const EXLABEL = {
    rvLed: 'LED: Vorwiderstand berechnen', iLed: 'LED: Strom aus dem Vorwiderstand', pRvLed: 'LED: Verlustleistung am Vorwiderstand', ledTausch: 'LED tauschen: neuer Vorwiderstand',
    rvZ: 'Z-Diode: kleinster Vorwiderstand', izLast: 'Z-Diode: Z-Strom mit Last', rbSchalter: 'Transistorschalter: Basisvorwiderstand', icLast: 'Transistorschalter: Laststrom',
    ueb: 'Transistorschalter: Übersteuerungsfaktor', pVtr: 'Transistor: Verlustleistung', ucePunkt: 'Arbeitspunkt: Kollektor-Emitter-Spannung', r2Teiler: 'Basisspannungsteiler: R_2',
    ubbTeiler: 'Basisspannungsteiler: Basisspannung', reKonst: 'Konstantstromquelle: Emitterwiderstand', r1Zfolger: 'Z-Folger: Vorwiderstand der Z-Diode', ueFolger: 'Z-Folger: Emitterspannung',
    vuEmitter: 'Emitterschaltung: Verstärkung (Emitter gebrückt)', vuGegen: 'Emitterschaltung: Verstärkung mit Gegenkopplung', vInv: 'Invertierer: Verstärkung', uaInv: 'Invertierer: Ausgangsspannung',
    rfInv: 'Invertierer: Rückkopplungswiderstand', vNin: 'Nichtinvertierer: Verstärkung', uaNin: 'Nichtinvertierer: Ausgangsspannung', rfNin: 'Nichtinvertierer: Rückkopplungswiderstand',
    uaSumm: 'Summierer: Ausgangsspannung', uaDiff: 'Differenzverstärker: Ausgangsspannung', vDb: 'Verstärkungsmaß in dB berechnen', uEinDb: 'Eingangsspannung aus dem Verstärkungsmaß',
    fgGbw: 'Grenzfrequenz aus dem Verstärkungs-Bandbreite-Produkt', fpb: 'Vollaussteuerungsbandbreite aus der Slew-Rate', uosOut: 'Ausgangsoffset aus der Offsetspannung',
    schmittSchwelle: 'Schmitt-Trigger: Schaltschwelle', tOsz: 'Rechteckgenerator: Periodendauer', slopeInt: 'Integrierer: Steigung der Ausgangsspannung', rInt: 'Integrierer: Widerstand',
    tauInt: 'Integrierer: Zeitkonstante', fgAktiv: 'Aktiver Filter: Grenzfrequenz'
  };
  const ZUSTAND = { sperrt: 'Der Transistor sperrt.', aktiv: 'Der Transistor ist aktiv (kein Schalter, keine Sättigung).', saettigung: 'Der Transistor ist gesättigt.', defekt: 'Der Transistor ist defekt.' };

  /* ============================================================ reine Rechenfunktionen (alle rufen ANA_CORE) */
  function formulaList() { const C = CORE(), f = C && C.formulas; if (!f || typeof f.list !== 'function') return []; return tryf(() => f.list(), []); }
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!f || typeof f.get !== 'function') return null; const e = tryf(() => f.get(id), null); return e && typeof e.calc === 'function' ? e : null; }
  const inCards = id => CARDS.some(c => c.rows.indexOf(id) >= 0);
  /* Zeilen-Beschreibung: Felder aus den Argumenten der Kernformel (Label, Einheit), Anzeigeeinheit und Vorgabe aus dem Vorgabewert */
  function rowById(id) {
    if (!inCards(id)) return null;
    const st = STATE_ROWS[id], fo = st ? null : formulaById(id);
    if (!st && !fo) return null;
    const args = st ? st.args : fo.args;
    const fields = args.map(a => {
      const u = pickUnit(a.unit, a.def), scale = u[1];
      return { key: a.key, label: a.label, unit: u[0], scale, def: fin(Number(a.def)) ? dnum(Number(a.def) / scale) : '' };
    });
    return { id, formula: st ? null : id, state: !!st, title: st ? st.title : fo.name + (fo.symbol ? ' (' + fo.symbol + ')' : ''), expr: st ? st.expr : fo.expr, fields };
  }
  function cardList() { return CARDS.map(c => ({ id: c.id, icon: c.icon, title: c.title, rows: c.rows.slice() })); }
  function defaultsOf(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { o[f.key] = f.def; }); return o; }
  function argsOf(r, vals) {
    const out = {}, bad = [];
    r.fields.forEach(f => {
      const raw = vals && vals[f.key] != null ? vals[f.key] : f.def, v = readNum(raw, f);
      if (!fin(v)) bad.push(f.label);
      out[f.key] = v;
    });
    return { args: out, bad };
  }
  /* Eine Zeile rechnen: Ergebnis genau aus formulas.get(id).calc (Text und Zahl vom Kern) */
  function calc(rowId, vals) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    const r = rowById(rowId); if (!r) return { ok: false, why: C.formulas ? 'Diesen Rechner gibt es nicht.' : NOFN('formulas') };
    const { args, bad } = argsOf(r, vals);
    if (bad.length) return { ok: false, why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt, Vorsätze wie k, m, µ sind erlaubt): ' + bad.join(', ') + '.' };
    const notes = (NOTES[rowId] ? NOTES[rowId]() : []).filter(t => t);
    if (rowId === 'apDc') return dcCalc(C, r, args, notes);
    if (rowId === 'schaltCheck') return switchCalc(C, r, args, notes);
    const f = formulaById(rowId); if (!f) return { ok: false, why: NOFN('formulas') };
    const e = tryf(() => f.calc(args), null);
    if (!e || e.ok === false || e.valid === false || !fin(e.value)) return { ok: false, why: (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0 oder ein Wert kleiner oder gleich 0).' };
    return { ok: true, id: rowId, row: rowId, value: e.value, unit: e.unit != null ? e.unit : '', shown: e.text, text: e.text, steps: [f.expr, e.text], explain: f.explain || '', args, notes };
  }
  function dcCalc(C, r, a, notes) {
    if (!C.tr || typeof C.tr.dc !== 'function') return { ok: false, why: NOFN('tr.dc') };
    const d = tryf(() => C.tr.dc({ ub: a.ub, r1: a.r1, r2: a.r2, rc: a.rc, re: a.re, b: a.b }), null);
    if (!d || d.ok === false || d.valid === false || !fin(d.uce)) return { ok: false, why: (d && d.why) || 'Mit diesen Werten gibt es keinen Arbeitspunkt.' };
    const text = 'U_BB = ' + eng(d.ubb, 'V') + ', I_B = ' + eng(d.ib, 'A') + ', I_C = ' + eng(d.ic, 'A') + ', U_CE = ' + eng(d.uce, 'V') + '. ' + (ZUSTAND[d.zustand] || '');
    return { ok: true, id: 'apDc', row: 'apDc', value: d.uce, unit: 'V', zustand: d.zustand, ic: d.ic, ib: d.ib, ubb: d.ubb, shown: text, text, steps: [r.expr, text], explain: '', args: a, notes };
  }
  function switchCalc(C, r, a, notes) {
    if (!C.tr || typeof C.tr.switch !== 'function') return { ok: false, why: NOFN('tr.switch') };
    const s = tryf(() => C.tr.switch({ last: 'led', ub: a.ub, ust: a.ust, rb: a.rb, b: a.b, rv: a.rv, uf: a.uf }), null);
    if (!s || s.ok === false || s.valid === false || !fin(s.ic)) return { ok: false, why: (s && s.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
    const z = ZUSTAND[s.zustand] || '';
    const text = 'I_C,sat = ' + eng(s.icSat, 'A') + ', I_B,min = ' + eng(s.ibmin, 'A') + ', I_B = ' + eng(s.ib, 'A') + (fin(s.ueb) ? ', ü = ' + fm(s.ueb, 2) : '') + ', U_CE = ' + eng(s.uce, 'V') + '. ' + z;
    return { ok: true, id: 'schaltCheck', row: 'schaltCheck', value: s.ic, unit: 'A', zustand: s.zustand, ueb: s.ueb, shown: text, text, steps: [r.expr, text], explain: '', args: a, notes };
  }
  function exKinds() { const C = CORE(); return C && C.exercise && Array.isArray(C.exercise.kinds) ? C.exercise.kinds.slice() : []; }
  function exLabel(k) { return EXLABEL[k] || (formulaById(k) ? formulaById(k).name : k); }
  function exNew(kind, seed) {
    const C = CORE(); if (!C || typeof C.exercise !== 'function') return { ok: false, why: NOCORE };
    const e = tryf(() => C.exercise(kind, seed), null);
    if (!e || e.ok === false || typeof e.check !== 'function') return { ok: false, why: (e && e.why) || 'Diese Übung gibt es nicht.' };
    return e;
  }
  function exCheck(ex, input) {
    if (!ex || typeof ex.check !== 'function') return { ok: false, text: 'Erst eine Aufgabe erzeugen.', why: '' };
    const r = tryf(() => ex.check(String(input == null ? '' : input)), null);
    return r && typeof r === 'object' ? r : { ok: false, text: 'Mit dieser Eingabe gibt es kein Ergebnis.', why: '' };
  }

  /* ============================================================ Oberfläche */
  const ST = { vals: {}, ex: null, kind: '', seed: 0, ans: '', res: null, show: false };
  const CSS = '<style>.ana-cg{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.ana-cg label{flex:1 1 150px;min-width:130px;font-size:12.5px;color:var(--mute)}.ana-cg input,.ana-cg select{margin-top:3px;min-height:42px}.ana-crow{padding:10px 12px;border-top:1px solid var(--line)}.ana-crow:first-child{border-top:0}.ana-crow h5{margin:0;font-size:14px}.ana-cres{margin-top:8px}.ana-cbad{color:var(--danger);font-size:13.5px;margin:6px 0 0}.ana-cq{font-size:15px;line-height:1.5;margin:6px 0}</style>';
  function fieldHtml(rowId, f) {
    const k = rowId + '.' + f.key, v = ST.vals[k] != null ? ST.vals[k] : f.def, id = 'ana_c_' + rowId + '_' + f.key;
    return `<label for="${id}">${esc(f.label)}${f.unit ? ' in ' + esc(f.unit) : ''}<input id="${id}" data-f="${esc(k)}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`;
  }
  function resHtml(res) {
    if (!res) return '';
    if (!res.ok) return `<p class="ana-cbad" role="status">${esc(res.why)}</p>`;
    return `<div class="res"><div class="big2">${esc(res.shown)}</div><ol>${res.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${res.explain ? `<p class="hint2">${esc(res.explain)}</p>` : ''}${res.notes.map(t => `<p class="hint2">${esc(t)}</p>`).join('')}</div>`;
  }
  function rowVals(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { const k = rowId + '.' + f.key; o[f.key] = ST.vals[k] != null ? ST.vals[k] : f.def; }); return o; }
  function rowHtml(rowId) {
    const r = rowById(rowId); if (!r) return `<div class="ana-crow"><p class="ana-cbad">${esc(CORE() ? NOFN('formulas.' + rowId) : NOCORE)}</p></div>`;
    return `<div class="ana-crow" data-row="${esc(rowId)}"><h5>${esc(r.title)}</h5><p class="hint2" style="margin:2px 0 0">${esc(r.expr)}</p><div class="ana-cg">${r.fields.map(f => fieldHtml(rowId, f)).join('')}</div><div class="ana-cres" data-res="${esc(rowId)}" aria-live="polite">${resHtml(calc(rowId, rowVals(rowId)))}</div></div>`;
  }
  function cardHtml(c, open) {
    return `<details class="card" data-card="${esc(c.id)}"${open ? ' open' : ''}><summary>${c.icon} ${esc(c.title)}</summary><div class="cb">${c.rows.map(rowHtml).join('')}</div></details>`;
  }
  function exHtml() {
    const kinds = exKinds(), ex = ST.ex;
    const sel = `<label for="ana_c_kind">Art der Aufgabe<select id="ana_c_kind" data-act-sel="kind">${kinds.map(k => `<option value="${esc(k)}"${k === ST.kind ? ' selected' : ''}>${esc(exLabel(k))}</option>`).join('')}</select></label>`;
    let body = '';
    if (!kinds.length) body = `<p class="ana-cbad">${esc(CORE() ? NOFN('exercise') : NOCORE)}</p>`;
    else if (ex && ex.ok === false) body = `<p class="ana-cbad">${esc(ex.why)}</p>`;
    else if (ex) {
      const res = ST.res, du = ex.answer && ex.answer.disp && ex.answer.disp.unit ? ex.answer.disp.unit : ex.answer.unit;
      const dv = ex.answer.disp && ex.answer.disp.value != null ? ex.answer.disp.value : ex.answer.value;
      body = `<p class="ana-cq" data-ex="q">${esc(ex.question)}</p><label for="ana_c_ans">Deine Antwort${du ? ' (Einheit: ' + esc(du) + (du !== ex.answer.unit && ex.answer.unit ? ' oder ' + esc(ex.answer.unit) : '') + ')' : ''}<input id="ana_c_ans" data-ans="1" inputmode="decimal" autocomplete="off" value="${esc(ST.ans)}"></label>
        <div class="btns"><button class="btn pri" data-act="check">Prüfen</button><button class="btn" data-act="steps">Rechenweg zeigen</button><button class="btn" data-act="newex">Neue Aufgabe</button></div>
        <div data-ex="res" aria-live="polite">${res ? `<div class="ex ${res.ok ? 'ok' : 'bad'}"><b>${res.ok ? 'Richtig. ' : ''}</b>${esc(res.text)}${!res.ok && res.why ? `<details><summary>Warum?</summary>${esc(res.why)}</details>` : ''}</div>` : ''}${ST.show ? `<div class="ex"><b>Rechenweg</b><ol>${(ex.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="hint2">Ergebnis: ${esc(fm(dv, 4) + (du ? ' ' + du : ''))}</p></div>` : ''}</div><p class="hint2">${esc(textOf('uebungswert'))}</p>`;
    } else body = `<div class="btns"><button class="btn pri" data-act="newex">Neue Aufgabe</button></div>`;
    return `<details class="card" data-card="ex" open><summary>🎯 Übungsgenerator: Neue Aufgabe</summary><div class="cb"><div class="ana-crow"><div class="ana-cg">${sel}</div>${body}</div></div></details>`;
  }
  function renderAll() {
    const C = CORE();
    const top = `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für das Analogtechnik-Lab</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, Zahlen mit Komma, Rechenweg zum Nachvollziehen. Die Werte in den Feldern sind Übungswerte; einen Zusatz wie 4,7 kΩ, 12 mA oder 100 nF darfst du mittippen. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="ana-cbad">${esc(NOCORE)}</p></div>`;
    return CSS + top + CARDS.map((c, i) => cardHtml(c, i === 0)).join('') + exHtml();
  }
  function newEx(newSeed) {
    const kinds = exKinds(); if (!kinds.length) { ST.ex = null; return; }
    if (!ST.kind || kinds.indexOf(ST.kind) < 0) ST.kind = kinds[0];
    if (!ST.seed) ST.seed = 1 + Math.floor(Date.now() / 1000) % 100000; else if (newSeed) ST.seed += 1;
    ST.ex = exNew(ST.kind, ST.seed); ST.ans = ''; ST.res = null; ST.show = false;
  }
  function stat(n) { try { if (A && typeof A.stat === 'function') A.stat('anacalc', n == null ? 1 : n); } catch (e) {} }
  function redrawEx(host) { const card = host.querySelector('[data-card="ex"]'); if (card) card.outerHTML = exHtml(); else host.innerHTML = renderAll(); }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset) return;
    if (t.dataset.f) {
      ST.vals[t.dataset.f] = t.value; const rowId = t.dataset.f.split('.')[0], el = host.querySelector('[data-res="' + rowId + '"]');
      const r = calc(rowId, rowVals(rowId));
      if (el) el.innerHTML = resHtml(r);
      if (e.type === 'change' && r && r.ok) stat();
    } else if (t.dataset.ans) ST.ans = t.value;
    else if (t.dataset.actSel === 'kind' && e.type === 'change') { ST.kind = t.value; newEx(true); redrawEx(host); }
  }
  function onClick(host, e) {
    const b = e && e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return; const a = b.dataset.act;
    if (a === 'newex') { newEx(true); redrawEx(host); }
    else if (a === 'check') { if (!ST.ex || ST.ex.ok === false) return; ST.res = exCheck(ST.ex, ST.ans); stat(); redrawEx(host); }
    else if (a === 'steps') { ST.show = !ST.show; redrawEx(host); }
  }
  function render(host, api) {
    A = api || A; ST.ex = null; const kinds = exKinds(); if (kinds.length) { if (!ST.kind) ST.kind = kinds[0]; newEx(false); }
    host.innerHTML = renderAll();
    if (!host._anaCalc) { host._anaCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }
  /* Zustand der Rechenkarten für Speichern und Teilen (nur Eingabetexte und gewählte Übungsart) */
  function getState() { return { v: 1, vals: JSON.parse(JSON.stringify(ST.vals)), kind: ST.kind }; }
  function setState(o) {
    if (!o || typeof o !== 'object' || !o.vals || typeof o.vals !== 'object') return false;
    const vals = {};
    Object.keys(o.vals).forEach(k => { const m = /^([A-Za-z0-9]+)\.([A-Za-z0-9]+)$/.exec(k), r = m ? rowById(m[1]) : null; if (r && r.fields.some(f => f.key === m[2]) && (typeof o.vals[k] === 'string' || typeof o.vals[k] === 'number')) vals[k] = String(o.vals[k]); });
    ST.vals = vals; if (typeof o.kind === 'string' && exKinds().indexOf(o.kind) >= 0) ST.kind = o.kind; return true;
  }

  const API = { render, getState, setState, fn: { cardList, rowById, defaultsOf, calc, formulaList, formulaById, readNum, pickUnit, exKinds, exLabel, exNew, exCheck }, _st: ST };
  root.ANA_UI_EXT = root.ANA_UI_EXT || {}; root.ANA_UI_EXT.calc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
