/* elscore-pruef.js - ELS-Lab Kern Teil 2 (haengt sich an ELS_CORE aus elscore.js)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.ELS_CORE, Node: module.exports / globalThis.ELS_CORE (Vorgaenger per require).
 * Vanilla-JS, kein eval. Alle Anlagen- und Pruefwerte sind Uebungswerte; Grenzwerte stehen NUR in ELS_CORE.limits.
 * Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. Norm und Vorschrift massgeblich.
 *
 * ===================================================================================================
 * SIGNATUREN (SPEC 4.6 bis 4.13; hier die Festlegungen, die dort offen waren)
 *  Einheiten: Widerstand Ohm (riso in MOhm nur als Anzeigefeld rMOhm bzw. in device.measureAll), Strom in A (Felder imA / ipe / ber in mA, ausdruecklich benannt),
 *             Kapazitaet leak.y in F, leak.touch / device-Katalog cy in nF, Laenge m, Querschnitt mm2.
 *  insu.parts(cfg) -> {ok, parts:[{id,name,R}], values:[Ohm], R, unit:'Ohm'}   cfg {rMat=1e9, feuchte 0..1, schmutz 0..1, defekt:true|Ohm, uPruef=500, sk}
 *  insu.R(cfg) -> Ohm (NaN)         insu.measure(cfg) -> {ok, I(A), R_gemessen(Ohm), rMOhm, U_pruef, sk, grenze(MOhm|null), grenzeId, bestanden:true|false|null, nahe, status, text, hinweis}
 *  pe.measure(cfg) -> {ok, R, R_gemessen, R_Leitung, R_Kontakt, rKorr, mode, wiggle, schwankt, werte[], ueberlauf, grenze:{valid,...}, bestanden:true|false|null, verfaelscht, text}
 *       cfg {len, q, rho, mode:'2L'|'4L', rk (Kontakt, nur 2L), rInt, wiggle, bruch:false|true|'wackel'|'offen', seed}
 *  pe.limit(len) -> {ok:true, valid:true, value:0.3, unit, status:'belegt'} | {ok:true, valid:false, why}  (len > 5 m: kein Wert, F1)
 *  leak.y(C[F], U=230, f=50) -> A (NaN)      leak.touch({cy[nF]|C[F], U, f, iBase[mA], sk}) -> {ok, I(A), imA, grenze(mA), grenzeId, bestanden, cMaxNf, ratio, text}
 *  device.catalog[] {id,name,sk,leitungM,q,cy(nF),cyAlt,rInt,rMat,iBase(mA),defekteMoeglich}  device.faults[] (Mangel-Ids) device.sichtMaengel[]
 *  device.make(id, faults|{seed,n}|'zufall') -> {ok,id,name,sk,leitungM,q,cy,faults[],seed}
 *  device.measureAll(dev, opts{seed,rauschen}) -> {ok, sicht:[Mangel-Ids], rpe(Ohm|null), riso(MOhm), ipe(mA|null, SK I), ber(mA|null, SK II), sk, einheiten, seed}
 *  device.verdict(meas, dev) -> {ok, steps:[{id,name,wert,einheit,grenze,grenzText,cmp,limitId,limitStatus,status:'ok'|'rot'|'nicht gemessen'|'kein Grenzwert',ok:true|false|null,blockiert}],
 *                              gesamt:'bestanden'|'nicht bestanden'|'unvollstaendig', vollstaendig, fehlend[], reihenfolgeOk, text}
 *  protocol.template[] {key,label,typ,pflicht,optionen?,hilfe}  protocol.check(entry, dev) -> {ok, abweichungen:[{id,feld,text,diag}], text}  protocol.text(entry) -> {ok, text}
 *  rules.five[] (Ids)  rules.list[] ({id,nr,name,text,grund})  rules.info(id)  rules.check(seq, scenario) -> {ok, art, firstError, text, vollstaendig, weiter, szene, schritte}
 *  aid.chain[] (Ids)   aid.list[]  aid.info(id)  aid.check(seq) -> wie rules.check
 *  (M3) design.circuit / minCross / stringText, assess(rigId,state), diagnose(ctx), formulas, exercise(kind,seed), runSeq
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  let E = root.ELS_CORE;
  if (!E && typeof require === 'function') { try { E = require('./elscore.js'); } catch (e) { E = null; } }
  if (!E || !E.util || typeof E.extend !== 'function') {
    if (typeof console !== 'undefined') console.warn('elscore-pruef.js: ELS_CORE (elscore.js) fehlt, Teil 2 wird nicht registriert.');
    return;
  }
  const U = E.util;
  const num = U.num, clamp = U.clamp, isArr = U.isArr, isObj = U.isObj, obj = U.obj, fail = U.fail, V = U.V;
  const reqPos = U.reqPos, reqNn = U.reqNn, optPos = U.optPos, optNn = U.optNn, C = U.C, S = U.S, A = U.A, L = U.L, hide = U.hide;
  const fmt = E.fmt, fmtEng = E.fmtEng, TEXTS = E.TEXTS, limitText = E.limitText, limitOK = E.limitOK;
  const UL = U.UL, TWO_PI = 2 * Math.PI;
  const RHO = E.const.rho, RHO_ALT = E.const.rhoAlt, F_NETZ = E.const.f, U0 = E.const.U0;
  const SK_IDS = ['I', 'II', 'III'];
  function skOf(v) {
    if (v === undefined || v === null) return null;
    let s = String(v).toUpperCase().replace(/^SK\s*/, '').trim();
    if (s === '1') s = 'I'; else if (s === '2') s = 'II'; else if (s === '3') s = 'III';
    if (SK_IDS.indexOf(s) < 0) V('Unbekannte Schutzklasse: erlaubt sind I, II und III.');
    return s;
  }
  function freeze(o) { return Object.freeze(o); }
  function snap(o) { try { return o === undefined ? null : JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }

  /* =============================== 4.6 Isolation (insu) =============================== */
  const UP = L('upruef_iso');
  const FEU_K = 4e5;      /* R_Feuchte = FEU_K / feuchte^2 (Lehrmodell: 0,8 -> 0,625 MOhm) */
  const SCH_K = 5e6;      /* R_Schmutz = SCH_K / schmutz^2 */
  const DEF_R = 2e5;      /* Durchschlag: 0,2 MOhm */
  function insuCfg(cfg) {
    const c = obj(cfg);
    const rMat = optPos(c.rMat, 1e9, 'Der Materialwiderstand', 1e15);
    const feu = c.feuchte === undefined || c.feuchte === null ? 0 : num(c.feuchte, NaN);
    if (!(feu >= 0 && feu <= 1)) V('Die Feuchte muss zwischen 0 und 1 liegen.');
    const sch = c.schmutz === undefined || c.schmutz === null ? 0 : num(c.schmutz, NaN);
    if (!(sch >= 0 && sch <= 1)) V('Der Verschmutzungsgrad muss zwischen 0 und 1 liegen.');
    let def = null;
    if (c.defekt === true) def = DEF_R;
    else if (c.defekt !== undefined && c.defekt !== null && c.defekt !== false) def = reqPos(c.defekt, 'Der Defektwiderstand', 1e15);
    const u = optPos(c.uPruef, UP.value, 'Die Prüfspannung', 1e5);
    return { rMat: rMat, feuchte: feu, schmutz: sch, defekt: def, uPruef: u, sk: skOf(c.sk) };
  }
  function insuParts(c) {
    const p = [{ id: 'material', name: 'Isoliermaterial', R: c.rMat }];
    if (c.feuchte > 0) p.push({ id: 'feuchte', name: 'Feuchtigkeit', R: FEU_K / (c.feuchte * c.feuchte) });
    if (c.schmutz > 0) p.push({ id: 'schmutz', name: 'Verschmutzung', R: SCH_K / (c.schmutz * c.schmutz) });
    if (c.defekt !== null) p.push({ id: 'defekt', name: 'Defekt (Durchschlag)', R: c.defekt });
    return p;
  }
  function parallel(list) { let g = 0; for (let i = 0; i < list.length; i++) g += 1 / list[i]; return 1 / g; }
  function rIso(c) { return parallel(insuParts(c).map(function (p) { return p.R; })); }
  const insu = {};
  insu.parts = S(function (cfg) {
    const c = insuCfg(cfg), p = insuParts(c);
    return { ok: true, parts: p, values: p.map(function (x) { return x.R; }), R: parallel(p.map(function (x) { return x.R; })), unit: 'Ω', text: 'Die Leckpfade liegen parallel: 1/R = Σ 1/R_i (Lehrmodell, Zahlen sind Übungswerte).' };
  });
  insu.R = C(function (cfg) { return rIso(insuCfg(cfg)); });
  function rIsoLimit(sk) {
    if (sk === 'I') return 'riso_sk1';
    if (sk === 'II') return 'riso_sk2';
    return null;
  }
  insu.measure = S(function (cfg) {
    const c = insuCfg(cfg), R = rIso(c), rM = R / 1e6;
    const o = { ok: true, I: c.uPruef / R, R_gemessen: R, rMOhm: rM, U_pruef: c.uPruef, sk: c.sk, grenze: null, grenzeId: null, bestanden: null, nahe: false, status: null, text: '', hinweis: TEXTS.isoNurFrei };
    const lid = rIsoLimit(c.sk);
    if (lid) {
      const l = L(lid);
      o.grenze = l.value; o.grenzeId = lid; o.status = l.status;
      o.bestanden = limitOK(lid, rM);
      o.nahe = o.bestanden === true && rM <= 1.2 * l.value;
      o.text = o.bestanden
        ? 'Isolationswiderstand ' + fmt(rM, 3) + ' MΩ bei ' + fmt(c.uPruef) + ' V: Grenzwert ' + limitText(lid) + ' eingehalten.'
        : 'Isolationswiderstand ' + fmt(rM, 3) + ' MΩ bei ' + fmt(c.uPruef) + ' V liegt unter dem Grenzwert ' + limitText(lid) + ': nicht bestanden.';
    } else if (c.sk === 'III') {
      o.text = 'Isolationswiderstand ' + fmt(rM, 3) + ' MΩ bei ' + fmt(c.uPruef) + ' V. Für Schutzklasse III gibt es im Lab keinen Grenzwert (' + limitText('riso_sk3') + ').';
    } else o.text = 'Isolationswiderstand ' + fmt(rM, 3) + ' MΩ bei ' + fmt(c.uPruef) + ' V (ohne Schutzklasse kein Vergleich).';
    return o;
  });
  E.extend('insu', insu);

  /* =============================== 4.6 Schutzleiterwiderstand (pe) =============================== */
  const RPE = L('rpe_5m');
  const BRUCH_RUHE = 0.02, BRUCH_MAX = 1.5, OVERFLOW = 1e6;
  const pe = {};
  pe.limit = S(function (len) {
    const x = num(len, NaN);
    if (!(x > 0) || x > 1e5) V('Die Leitungslänge muss größer als 0 m sein.');
    if (x <= 5) return { ok: true, valid: true, value: RPE.value, unit: RPE.unit, cmp: RPE.cmp, status: RPE.status, quelle: RPE.quelle, id: 'rpe_5m', text: 'Bei einer Anschlussleitung bis 5 m: ' + limitText('rpe_5m') + '.' };
    return { ok: true, valid: false, id: 'rpe_zuschlag', status: 'A', frage: 'F1', why: 'Zuschlag nach Norm, Wert hier nicht festgelegt (F1)', text: 'Bei Leitungen über 5 m gilt ein Zuschlag nach Norm. Im Lab gibt es dafür keinen Wert (F1), also auch kein Urteil.' };
  });
  function peCfg(cfg) {
    const c = obj(cfg);
    const mode = c.mode === undefined || c.mode === null ? '2L' : String(c.mode);
    if (mode !== '2L' && mode !== '4L') V('Die Messart muss 2L oder 4L sein.');
    let bruch = false;
    if (c.bruch === true || c.bruch === 'wackel') bruch = 'wackel';
    else if (c.bruch === 'offen') bruch = 'offen';
    else if (c.bruch !== undefined && c.bruch !== null && c.bruch !== false) V('Der Bruch muss false, true, wackel oder offen sein.');
    return {
      len: optPos(c.len, 1.5, 'Die Leitungslänge', 1e5), q: optPos(c.q, 1, 'Der Querschnitt', 1000), rho: optPos(c.rho, RHO, 'Der spezifische Widerstand', 0.1),
      mode: mode, rk: optNn(c.rk, 0.05, 'Der Kontaktwiderstand', 1e4), rInt: optNn(c.rInt, 0, 'Der Innenwiderstand', 1e4),
      wiggle: c.wiggle === true, bruch: bruch, seed: Math.floor(num(c.seed, 1))
    };
  }
  pe.measure = S(function (cfg) {
    const c = peCfg(cfg);
    const rl = c.rho * c.len / c.q;
    const rkEff = c.mode === '2L' ? c.rk : 0;
    const rng = E.rng(c.seed * 31 + 7);
    const werte = [];
    let ueber = false;
    if (c.bruch === 'offen') { werte.push(OVERFLOW); ueber = true; }
    else if (c.bruch === 'wackel' && c.wiggle) {
      for (let i = 0; i < 8; i++) werte.push(rl + c.rInt + BRUCH_RUHE + (BRUCH_MAX - BRUCH_RUHE) * rng.next() + rkEff);
    } else werte.push(rl + c.rInt + (c.bruch === 'wackel' ? BRUCH_RUHE : 0) + rkEff);
    let R = werte[0], mn = R, mx = R;
    for (let i = 1; i < werte.length; i++) { if (werte[i] > mx) mx = werte[i]; if (werte[i] < mn) mn = werte[i]; }
    R = mx;
    const lim = pe.limit(c.len);
    const o = { ok: true, R: R, R_gemessen: R, R_Leitung: rl, R_Kontakt: rkEff, rKorr: R - rkEff, mode: c.mode, wiggle: c.wiggle, schwankt: mx - mn > 0.02, werte: werte, ueberlauf: ueber, rMin: mn, rMax: mx, grenze: lim, bestanden: null, verfaelscht: false, bruch: c.bruch, text: '' };
    if (lim.valid) {
      o.bestanden = limitOK('rpe_5m', R);
      const bK = limitOK('rpe_5m', R - rkEff);
      o.verfaelscht = c.mode === '2L' && rkEff > 0 && bK !== o.bestanden;
      if (ueber) o.text = 'Schutzleiterwiderstand: Messbereich überschritten, der Schutzleiter ist unterbrochen. Grenzwert ' + limitText('rpe_5m') + ': nicht bestanden.';
      else {
        o.text = 'Schutzleiterwiderstand ' + fmt(R, 3) + ' Ω (' + (c.mode === '2L' ? '2-Leiter-Messung inklusive Kontaktwiderstand ' + fmt(rkEff, 3) + ' Ω' : '4-Leiter-Messung') + '), Grenzwert ' + limitText('rpe_5m') + ': ' + (o.bestanden ? 'eingehalten.' : 'nicht bestanden.');
        if (o.verfaelscht) o.text += ' Der Kontaktwiderstand verfälscht das Urteil: ohne ihn sind es ' + fmt(R - rkEff, 3) + ' Ω.';
      }
    } else o.text = 'Schutzleiterwiderstand ' + fmt(R, 3) + ' Ω. ' + lim.text;
    if (c.bruch === 'wackel' && !c.wiggle) o.text += ' Bewege die Leitung (Wackelprüfung), um einen Wackelkontakt zu erkennen.';
    if (c.wiggle && c.bruch === 'wackel') o.text += ' Beim Bewegen der Leitung schwankt der Wert zwischen ' + fmt(mn, 3) + ' Ω und ' + fmt(mx, 3) + ' Ω.';
    return o;
  });
  E.extend('pe', pe);

  /* =============================== 4.6 Ableitstrom (leak) =============================== */
  const leak = {};
  leak.y = C(function (Cap, Uv, f) {
    const c = num(Cap, NaN);
    const u = Uv === undefined || Uv === null ? U0 : num(Uv, NaN);
    const fr = f === undefined || f === null ? F_NETZ : num(f, NaN);
    if (!(c >= 0) || c > 1 || !(u >= 0) || u > 1e6 || !(fr >= 0) || fr > 1e9) return NaN;
    return TWO_PI * fr * c * u;
  });
  function leakLimit(sk) { return sk === 'I' ? 'ber_sk1' : (sk === 'II' ? 'ber_sk2' : null); }
  leak.touch = S(function (cfg) {
    const c = obj(cfg);
    let cap;
    if (c.cy !== undefined && c.cy !== null) cap = reqNn(c.cy, 'Die Y-Kapazität', 1e6) * 1e-9;
    else if (c.C !== undefined && c.C !== null) cap = reqNn(c.C, 'Die Y-Kapazität', 1);
    else V('Die Y-Kapazität fehlt (cy in nF).');
    const u = optPos(c.U, U0, 'Die Spannung', 1e6), f = optPos(c.f, F_NETZ, 'Die Frequenz', 1e9);
    const iBase = optNn(c.iBase, 0, 'Der Grundableitstrom', 1e6);
    const sk = c.sk === undefined || c.sk === null ? 'II' : skOf(c.sk);
    const I = TWO_PI * f * cap * u + iBase / 1000;
    const o = { ok: true, I: I, imA: I * 1000, sk: sk, U: u, f: f, grenze: null, grenzeId: null, bestanden: null, status: null, ratio: null, cMaxNf: null, text: '' };
    const lid = leakLimit(sk);
    if (lid) {
      const l = L(lid);
      o.grenzeId = lid; o.grenze = l.value; o.status = l.status; o.ratio = o.imA / l.value;
      o.cMaxNf = (l.value / 1000 - iBase / 1000) / (TWO_PI * f * u) * 1e9;
      o.bestanden = limitOK(lid, o.imA);
      o.text = 'Berührungsstrom ' + fmt(o.imA, 3) + ' mA, Grenzwert ' + limitText(lid) + ': ' + (o.bestanden ? 'eingehalten.' : 'nicht bestanden.');
    } else o.text = 'Berührungsstrom ' + fmt(o.imA, 3) + ' mA. Für Schutzklasse III gibt es im Lab keinen Grenzwert.';
    return o;
  });
  E.extend('leak', leak);

  /* =============================== 4.7 Geraetepruefung (device) =============================== */
  const SICHT_M = ['leitung-beschaedigt', 'stecker-lose', 'gehaeuse-gebrochen'];
  const ALL_F = SICHT_M.concat(['pe-unterbrochen', 'pe-hochohmig', 'isolation-feucht', 'isolation-defekt', 'y-kondensator-alt']);
  const FAULT_NAME = {
    'leitung-beschaedigt': 'Anschlussleitung beschädigt',
    'stecker-lose': 'Stecker locker oder beschädigt',
    'gehaeuse-gebrochen': 'Gehäuse gebrochen',
    'pe-unterbrochen': 'Schutzleiter unterbrochen',
    'pe-hochohmig': 'Schutzleiter hochohmig',
    'isolation-feucht': 'Isolierung feucht',
    'isolation-defekt': 'Isolierung defekt',
    'y-kondensator-alt': 'Y-Kondensator gealtert (Ableitstrom zu groß)'
  };
  const FAULT_STEP = { 'leitung-beschaedigt': 'sicht', 'stecker-lose': 'sicht', 'gehaeuse-gebrochen': 'sicht', 'pe-unterbrochen': 'rpe', 'pe-hochohmig': 'rpe', 'isolation-feucht': 'riso', 'isolation-defekt': 'riso', 'y-kondensator-alt': 'ipe' };
  const EXCL = [['pe-unterbrochen', 'pe-hochohmig'], ['isolation-feucht', 'isolation-defekt']];
  const PE_HOCH = 0.8;
  /* [id, Name, SK, Leitung m, q mm2, cy nF, cyAlt nF, rInt Ohm, rMat Ohm, iBase mA] */
  const DEVTAB = [
    ['wasserkocher', 'Wasserkocher', 'I', 1.5, 1, 0, 0, 0.03, 2e8, 0.15],
    ['bohrmaschine', 'Bohrmaschine', 'II', 2, 1, 0, 0, 0, 1e9, 0.05],
    ['heizluefter', 'Heizlüfter', 'I', 1.8, 1.5, 0, 0, 0.03, 5e7, 0.4],
    ['kaffeemaschine', 'Kaffeemaschine', 'I', 1.6, 1, 0, 0, 0.03, 1e8, 0.2],
    ['haartrockner', 'Haartrockner', 'II', 1.8, 0.75, 0, 0, 0, 3e8, 0.1],
    ['loetkolben', 'Lötkolben', 'I', 1.5, 0.75, 0, 0, 0.02, 3e8, 0.05],
    ['netzteil-labor', 'Labornetzteil', 'I', 1.5, 1, 10, 60, 0.03, 1e9, 0.1],
    ['steckernetzteil', 'Steckernetzteil', 'II', 1.8, 0.75, 2.2, 10, 0, 1e9, 0.02],
    ['leuchte', 'Leuchte', 'I', 2, 0.75, 0, 0, 0.03, 5e8, 0.1],
    ['verlaengerung', 'Verlängerungsleitung (5 m)', 'I', 5, 1.5, 0, 0, 0.04, 1e9, 0.02],
    ['mehrfachsteckdose', 'Mehrfachsteckdose', 'I', 1.5, 1.5, 0, 0, 0.08, 1e9, 0.02],
    ['pc-netzteil', 'PC-Netzteil', 'I', 1.5, 0.75, 22, 100, 0.03, 1e9, 0.3],
    ['messgeraet', 'Messgerät', 'II', 1.5, 0.75, 1, 10, 0, 1e9, 0.03],
    ['ladegeraet', 'Ladegerät', 'II', 1.2, 0.75, 4.7, 15, 0, 1e9, 0.02]
  ];
  const catalog = DEVTAB.map(function (r) {
    const sk = r[2];
    const f = SICHT_M.slice();
    if (sk === 'I') f.push('pe-unterbrochen', 'pe-hochohmig');
    f.push('isolation-feucht', 'isolation-defekt');
    if (r[6] > 0) f.push('y-kondensator-alt');
    return freeze({ id: r[0], name: r[1], sk: sk, leitungM: r[3], q: r[4], cy: r[5], cyAlt: r[6], rInt: r[7], rMat: r[8], iBase: r[9], defekteMoeglich: freeze(f) });
  });
  function cat(id) {
    const k = isObj(id) ? id.id : id;
    for (let i = 0; i < catalog.length; i++) if (catalog[i].id === k) return catalog[i];
    V('Unbekannter Prüfling: ' + String(k));
  }
  const device = {};
  device.catalog = freeze(catalog);
  device.faults = freeze(ALL_F.slice());
  device.sichtMaengel = freeze(SICHT_M.slice());
  device.faultName = freeze(Object.assign({}, FAULT_NAME));
  device.faultStep = freeze(Object.assign({}, FAULT_STEP));
  device.make = S(function (id, faults) {
    const d = cat(id);
    let list = [], seed = 1;
    if (faults === undefined || faults === null) list = [];
    else if (isArr(faults)) {
      if (faults.length > 20) V('Es sind höchstens 20 Mängel erlaubt.');
      faults.forEach(function (f) {
        const s = String(f);
        if (d.defekteMoeglich.indexOf(s) < 0) V('Der Mangel „' + s + '“ ist beim Prüfling ' + d.name + ' nicht möglich.');
        if (list.indexOf(s) < 0) list.push(s);
      });
    } else if (faults === 'zufall' || isObj(faults)) {
      const o = isObj(faults) ? faults : {};
      seed = Math.floor(num(o.seed, 1));
      const n = clamp(Math.floor(num(o.n, 1)), 0, 3);
      const r = E.rng(seed * 7919 + 17);
      const pool = d.defekteMoeglich.slice();
      for (let k = 0; k < n && pool.length; k++) {
        const j = Math.min(pool.length - 1, Math.floor(r.next() * pool.length));
        const f = pool.splice(j, 1)[0];
        list.push(f);
        EXCL.forEach(function (g) { if (g.indexOf(f) >= 0) g.forEach(function (x) { const p = pool.indexOf(x); if (p >= 0) pool.splice(p, 1); }); });
      }
    } else V('Die Mängel müssen als Liste angegeben werden.');
    EXCL.forEach(function (g) { let c = 0; g.forEach(function (x) { if (list.indexOf(x) >= 0) c++; }); if (c > 1) V('Diese Mängel schließen sich aus: ' + g.join(' und ') + '.'); });
    return { ok: true, id: d.id, name: d.name, sk: d.sk, leitungM: d.leitungM, q: d.q, cy: d.cy, faults: list, seed: seed };
  });
  function devOf(dev) {
    if (typeof dev === 'string') return { d: cat(dev), faults: [], seed: 1 };
    const o = obj(dev);
    if (o.ok === false) V('Der Prüfling ist ungültig.');
    const d = cat(o);
    const faults = isArr(o.faults) ? o.faults.filter(function (f) { return d.defekteMoeglich.indexOf(String(f)) >= 0; }).map(String) : [];
    return { d: d, faults: faults, seed: Math.floor(num(o.seed, 1)) };
  }
  /* Wahrheitswerte ohne Rauschen */
  function truth(d, faults) {
    const has = function (f) { return faults.indexOf(f) >= 0; };
    const t = { sicht: SICHT_M.filter(has), rpe: null, riso: null, ipe: null, ber: null };
    if (d.sk === 'I') {
      const m = pe.measure({ len: d.leitungM, q: d.q, mode: '4L', rInt: d.rInt + (has('pe-hochohmig') ? PE_HOCH : 0), bruch: has('pe-unterbrochen') ? 'offen' : false });
      t.rpe = m.R;
    }
    t.riso = insu.measure({ rMat: d.rMat, feuchte: has('isolation-feucht') ? 0.8 : 0, defekt: has('isolation-defekt'), sk: d.sk }).rMOhm;
    if (d.sk !== 'III') {
      const cy = has('y-kondensator-alt') && d.cyAlt > 0 ? d.cyAlt : d.cy;
      const i = leak.touch({ cy: cy, iBase: d.iBase, sk: d.sk }).imA;
      if (d.sk === 'I') t.ipe = i; else t.ber = i;
    }
    return t;
  }
  device.measureAll = S(function (dev, opts) {
    const x = devOf(dev), o = obj(opts);
    const seed = o.seed === undefined || o.seed === null ? x.seed : Math.floor(num(o.seed, 1));
    const t = truth(x.d, x.faults);
    const r = E.rng(seed * 977 + 13);
    const nz = o.rauschen === false ? function () { r.next(); return 1; } : function () { return 1 + 0.02 * (2 * r.next() - 1); };
    const f1 = nz(), f2 = nz(), f3 = nz();
    return {
      ok: true, sicht: t.sicht.slice(), rpe: t.rpe === null ? null : t.rpe * f1, riso: t.riso * f2,
      ipe: t.ipe === null ? null : t.ipe * f3, ber: t.ber === null ? null : t.ber * f3, sk: x.d.sk, seed: seed,
      einheiten: { rpe: 'Ω', riso: 'MΩ', ipe: 'mA', ber: 'mA' }
    };
  });
  const STEP_DEF = {
    sicht: { name: 'Sichtprüfung', einheit: '' },
    rpe: { name: 'Schutzleiterwiderstand', einheit: 'Ω' },
    riso: { name: 'Isolationswiderstand', einheit: 'MΩ' },
    ipe: { name: 'Schutzleiterstrom', einheit: 'mA' }
  };
  function fmtVal(id, v) { return id === 'rpe' && v >= 5e5 ? 'über dem Messbereich (Schutzleiter unterbrochen)' : fmt(v, 3) + ' ' + (STEP_DEF[id] ? STEP_DEF[id].einheit : ''); }
  function stepName(id, sk) { return id === 'ipe' && sk === 'II' ? 'Berührungsstrom' : STEP_DEF[id].name; }
  function stepLimit(id, sk, leitungM) {
    if (id === 'rpe') { const l = pe.limit(leitungM === undefined ? 1.5 : leitungM); return l.valid ? { id: 'rpe_5m', valid: true } : { id: 'rpe_zuschlag', valid: false, why: l.why }; }
    if (id === 'riso') { const lid = rIsoLimit(sk); return lid ? { id: lid, valid: true } : { id: 'riso_sk3', valid: false, kein: true, why: limitText('riso_sk3') }; }
    if (id === 'ipe') return { id: sk === 'II' ? 'ber_sk2' : 'ipe_sk1', valid: true };
    return null;
  }
  device.verdict = S(function (meas, dev) {
    const m = obj(meas);
    const dd = obj(dev);
    const sk = skOf(dd.sk !== undefined ? dd.sk : (dd.id !== undefined ? cat(dd).sk : m.sk));
    if (!sk) V('Zum Urteil gehört die Schutzklasse des Prüflings.');
    let leitungM = num(dd.leitungM, NaN);
    if (!isFinite(leitungM) && dd.id !== undefined) leitungM = cat(dd).leitungM;
    const order = E.cls.info(sk).pruefung;
    const steps = [], fehlend = [];
    let rot = false, blockiert = false;
    order.forEach(function (id) {
      const st = { id: id, name: stepName(id, sk), wert: null, einheit: STEP_DEF[id].einheit, grenze: null, grenzText: '', cmp: null, limitId: null, limitStatus: null, status: 'nicht gemessen', ok: null, blockiert: false };
      if (id === 'sicht') {
        if (isArr(m.sicht)) {
          st.wert = m.sicht.length; st.grenze = 0; st.cmp = '='; st.grenzText = 'keine Mängel'; st.mangel = m.sicht.map(String);
          st.ok = m.sicht.length === 0; st.status = st.ok ? 'ok' : 'rot';
        }
      } else {
        const lim = stepLimit(id, sk, leitungM);
        let v = id === 'ipe' ? (sk === 'II' ? (m.ber !== undefined && m.ber !== null ? m.ber : m.ipe) : m.ipe) : m[id];
        v = v === undefined || v === null ? NaN : num(v, NaN);
        st.limitId = lim.id;
        if (isFinite(v)) st.wert = v;
        if (lim.valid) { const l = L(lim.id); st.grenze = l.value; st.cmp = l.cmp; st.limitStatus = l.status; st.grenzText = limitText(lim.id); }
        else { st.grenzText = lim.why; st.limitStatus = 'A'; }
        if (isFinite(v)) {
          if (lim.valid) { st.ok = limitOK(lim.id, v); st.status = st.ok ? 'ok' : 'rot'; }
          else { st.status = 'kein Grenzwert'; st.ok = null; st.blockiert = !lim.kein; }
        }
      }
      if (st.status === 'nicht gemessen') fehlend.push(id);
      if (st.status === 'rot') rot = true;
      if (st.blockiert) blockiert = true;
      steps.push(st);
    });
    const voll = fehlend.length === 0;
    const gesamt = rot ? 'nicht bestanden' : (voll && !blockiert ? 'bestanden' : 'unvollstaendig');
    let reihenfolgeOk = null;
    if (isArr(m.reihenfolge)) {
      const done = m.reihenfolge.map(String);
      reihenfolgeOk = true;
      for (let i = 0; i < done.length; i++) if (done[i] !== order[i]) { reihenfolgeOk = false; break; }
    }
    const lines = steps.map(function (s) {
      if (s.status === 'nicht gemessen') return s.name + ': nicht gemessen.';
      if (s.id === 'sicht') return s.name + ': ' + (s.ok ? 'keine Mängel gefunden.' : s.wert + ' Mangel/Mängel gefunden.');
      if (s.status === 'kein Grenzwert') return s.name + ': ' + fmtVal(s.id, s.wert) + ', ' + s.grenzText + '.';
      return s.name + ': ' + fmtVal(s.id, s.wert) + ', Grenzwert ' + s.grenzText + ': ' + (s.ok ? 'eingehalten.' : 'nicht eingehalten.');
    });
    let text = gesamt === 'bestanden' ? 'Alle Prüfschritte sind durchgeführt und im Grenzbereich: bestanden.'
      : (gesamt === 'nicht bestanden' ? 'Mindestens ein Prüfschritt ist nicht eingehalten: nicht bestanden.'
        : 'Noch kein Gesamturteil: ' + (fehlend.length ? 'Es fehlen Prüfschritte (' + fehlend.map(function (i) { return stepName(i, sk); }).join(', ') + ').' : 'Ein Grenzwert ist im Lab nicht festgelegt.'));
    text += ' ' + lines.join(' ');
    if (reihenfolgeOk === false) text += ' Die Prüfreihenfolge Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom wurde nicht eingehalten.';
    return { ok: true, steps: steps, gesamt: gesamt, vollstaendig: voll, fehlend: fehlend, reihenfolgeOk: reihenfolgeOk, sk: sk, text: text };
  });
  E.extend('device', device);

  /* =============================== 4.7 Pruefprotokoll (protocol) =============================== */
  const PRUEFARTEN = ['Wiederholungsprüfung', 'nach Instandsetzung'];
  const MASSNAHMEN = ['weiterverwenden', 'reparieren', 'aussondern'];
  const ERGEBNISSE = ['bestanden', 'nicht bestanden'];
  const TEMPLATE = [
    { key: 'geraet', label: 'Gerät', typ: 'text', pflicht: true, hilfe: 'Name des Prüflings.' },
    { key: 'geraetenummer', label: 'Gerätenummer', typ: 'text', pflicht: true, hilfe: 'Nummer oder Aufkleber des Geräts.' },
    { key: 'standort', label: 'Standort', typ: 'text', pflicht: true, hilfe: 'Wo das Gerät steht oder eingesetzt wird.' },
    { key: 'schutzklasse', label: 'Schutzklasse', typ: 'select', optionen: SK_IDS.slice(), pflicht: true, hilfe: 'I, II oder III nach Typenschild.' },
    { key: 'pruefer', label: 'Prüfer', typ: 'text', pflicht: true, hilfe: 'Name der prüfenden Person.' },
    { key: 'datum', label: 'Prüfdatum', typ: 'datum', pflicht: true, hilfe: 'Datum der Prüfung.' },
    { key: 'messgeraet', label: 'Messgerät', typ: 'text', pflicht: true, hilfe: 'Freitext: Bezeichnung des Prüfgeräts.' },
    { key: 'pruefart', label: 'Prüfart', typ: 'select', optionen: PRUEFARTEN.slice(), pflicht: true, hilfe: 'Wiederholungsprüfung oder Prüfung nach Instandsetzung.' },
    { key: 'sicht', label: 'Sichtprüfung (Mängel)', typ: 'liste', pflicht: true, hilfe: 'Alle gefundenen Mängel; eine leere Liste heißt: keine Mängel gefunden.' },
    { key: 'messwerte', label: 'Messwerte', typ: 'messwerte', pflicht: true, hilfe: 'Wert je Prüfschritt mit Grenzwert und Ergebnis.' },
    { key: 'ergebnis', label: 'Gesamtergebnis', typ: 'select', optionen: ERGEBNISSE.slice(), pflicht: true, hilfe: 'bestanden oder nicht bestanden, nach allen Schritten.' },
    { key: 'massnahme', label: 'Maßnahme', typ: 'select', optionen: MASSNAHMEN.slice(), pflicht: true, hilfe: 'weiterverwenden, reparieren oder aussondern.' },
    { key: 'naechste', label: 'Nächste Prüfung', typ: 'text', pflicht: false, hilfe: 'Freifeld. ' + TEXTS.betriebLegtFest }
  ].map(function (f) { if (f.optionen) f.optionen = freeze(f.optionen); return freeze(f); });
  const protocol = {};
  protocol.template = freeze(TEMPLATE);
  protocol.pruefarten = freeze(PRUEFARTEN);
  protocol.massnahmen = freeze(MASSNAHMEN);
  protocol.ergebnisse = freeze(ERGEBNISSE);
  function emptyStr(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function toDisp(key, v) {
    if (v === undefined || v === null || v === '') return NaN;
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    const q = E.parseQty(v);
    if (!q) return NaN;
    if (!q.hasUnit) return q.raw;
    if (key === 'rpe') return q.v;
    if (key === 'riso') return q.v / 1e6;
    return q.v * 1000;
  }
  function near(a, b) { return Math.abs(a - b) <= Math.max(0.03 * Math.abs(b), 0.0051); }
  protocol.check = S(function (entry, dev) {
    const e = obj(entry);
    if (!isObj(entry)) V('Das Protokoll ist leer.');
    const x = devOf(dev);
    const d = x.d, abw = [];
    function add(id, feld, text, diag) { abw.push({ id: id, feld: feld, text: text, diag: diag }); }
    TEMPLATE.forEach(function (f) {
      if (!f.pflicht) return;
      if (f.key === 'sicht') { if (!isArr(e.sicht)) add('feld', 'sicht', 'Die Sichtprüfung fehlt: Trage die gefundenen Mängel ein (eine leere Liste heißt: keine Mängel).', 'proto-fehlt'); }
      else if (f.key === 'messwerte') { if (!isObj(e.messwerte)) add('feld', 'messwerte', 'Die Messwerte fehlen.', 'proto-fehlt'); }
      else if (emptyStr(e[f.key])) add('feld', f.key, 'Das Pflichtfeld „' + f.label + '“ ist nicht ausgefüllt.', 'proto-fehlt');
    });
    if (!emptyStr(e.schutzklasse)) {
      let sk = null; try { sk = skOf(e.schutzklasse); } catch (er) { sk = null; }
      if (sk !== d.sk) add('wert', 'schutzklasse', 'Die Schutzklasse stimmt nicht: Der Prüfling ' + d.name + ' ist Schutzklasse ' + d.sk + '.', 'proto-ergebnis');
    }
    if (!emptyStr(e.geraet)) {
      const g = String(e.geraet).trim().toLowerCase();
      if (g !== d.id.toLowerCase() && g !== d.name.toLowerCase()) add('wert', 'geraet', 'Das Gerät stimmt nicht mit dem Prüfling ' + d.name + ' überein.', 'proto-ergebnis');
    }
    if (!emptyStr(e.pruefart) && PRUEFARTEN.indexOf(String(e.pruefart)) < 0) add('wert', 'pruefart', 'Die Prüfart muss Wiederholungsprüfung oder nach Instandsetzung sein.', 'proto-ergebnis');
    if (!emptyStr(e.massnahme) && MASSNAHMEN.indexOf(String(e.massnahme)) < 0) add('wert', 'massnahme', 'Die Maßnahme muss weiterverwenden, reparieren oder aussondern sein.', 'proto-ergebnis');
    if (!emptyStr(e.ergebnis) && ERGEBNISSE.indexOf(String(e.ergebnis)) < 0) add('wert', 'ergebnis', 'Das Gesamtergebnis muss bestanden oder nicht bestanden sein.', 'proto-ergebnis');
    /* Maengel der Sichtpruefung */
    const real = SICHT_M.filter(function (f) { return x.faults.indexOf(f) >= 0; });
    if (isArr(e.sicht)) {
      const got = e.sicht.map(String);
      real.forEach(function (f) { if (got.indexOf(f) < 0) add('sicht', 'sicht', 'Ein Mangel fehlt im Protokoll: ' + FAULT_NAME[f] + '.', 'proto-fehlt'); });
      got.forEach(function (f) { if (real.indexOf(f) < 0) add('sicht', 'sicht', 'Eingetragen ist ein Mangel, den der Prüfling nicht hat: ' + (FAULT_NAME[f] || f) + '.', 'proto-fehlt'); });
    }
    /* Messwerte */
    const t = device.measureAll({ id: d.id, faults: x.faults, seed: x.seed });
    const mw = isObj(e.messwerte) ? e.messwerte : null;
    const keys = d.sk === 'III' ? ['riso'] : (d.sk === 'II' ? ['riso', 'ber'] : ['rpe', 'riso', 'ipe']);
    const einh = { rpe: 'Ω', riso: 'MΩ', ipe: 'mA', ber: 'mA' };
    const nm = { rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom', ber: 'Berührungsstrom' };
    if (mw) {
      keys.forEach(function (k) {
        const raw = mw[k] !== undefined ? mw[k] : (k === 'ber' ? mw.ipe : undefined);
        const v = toDisp(k, raw);
        if (!isFinite(v)) add('wert', 'messwerte.' + k, 'Der Messwert „' + nm[k] + '“ fehlt oder ist keine Zahl.', 'proto-fehlt');
        else if (!near(v, t[k])) add('wert', 'messwerte.' + k, 'Der Messwert „' + nm[k] + '“ (' + fmt(v, 3) + ' ' + einh[k] + ') passt nicht zur Messung (' + fmt(t[k], 3) + ' ' + einh[k] + ').', 'proto-ergebnis');
      });
      if (d.sk !== 'I' && mw.rpe !== undefined && mw.rpe !== null && mw.rpe !== '') add('wert', 'messwerte.rpe', 'Bei Schutzklasse ' + d.sk + ' gibt es keinen Schutzleiterwiderstand.', 'proto-ergebnis');
    }
    /* Ergebnis gegen das Urteil */
    const vd = device.verdict({ sicht: real, rpe: t.rpe, riso: t.riso, ipe: t.ipe, ber: t.ber }, { id: d.id, sk: d.sk, leitungM: d.leitungM });
    const erg = emptyStr(e.ergebnis) ? null : String(e.ergebnis);
    if (erg === 'bestanden' && vd.gesamt !== 'bestanden') {
      const reds = vd.steps.filter(function (s) { return s.status === 'rot'; });
      const bad = reds.filter(function (s) { return s.id !== 'sicht'; })[0] || reds[0];
      if (bad) {
        const ueber = bad.cmp === '>=' ? 'unter' : 'über';
        add('ergebnis', 'ergebnis', bad.id === 'sicht' ? 'Die Sichtprüfung hat Mängel gefunden: nicht bestanden.' : 'Messwert ' + ueber + ' Grenzwert: nicht bestanden. ' + bad.name + ' ' + fmtVal(bad.id, bad.wert) + ', Grenzwert ' + bad.grenzText + '.', 'proto-ergebnis');
      } else add('ergebnis', 'ergebnis', 'Das Ergebnis „bestanden“ ist nicht zu belegen: ' + vd.text, 'proto-ergebnis');
    } else if (erg === 'nicht bestanden' && vd.gesamt === 'bestanden') add('ergebnis', 'ergebnis', 'Alle Prüfschritte sind eingehalten, das Ergebnis „nicht bestanden“ passt nicht dazu.', 'proto-ergebnis');
    const mn = emptyStr(e.massnahme) ? null : String(e.massnahme);
    if (mn && erg) {
      if (erg === 'nicht bestanden' && mn === 'weiterverwenden') add('massnahme', 'massnahme', 'Ein Gerät, das nicht bestanden hat, wird nicht weiterverwendet: reparieren oder aussondern.', 'proto-ergebnis');
      if (erg === 'bestanden' && mn !== 'weiterverwenden') add('massnahme', 'massnahme', 'Ein bestandenes Gerät wird weiterverwendet; reparieren oder aussondern passt nicht zum Ergebnis.', 'proto-ergebnis');
    }
    const ok = abw.length === 0;
    return { ok: ok, abweichungen: abw, text: ok ? 'Das Protokoll ist stimmig. ' + TEXTS.uebungProtokoll : abw.map(function (a) { return a.text; }).join(' '), erwartet: vd.gesamt };
  });
  protocol.text = S(function (entry) {
    const e = obj(entry);
    if (!isObj(entry)) V('Das Protokoll ist leer.');
    const L_ = [];
    TEMPLATE.forEach(function (f) {
      let v = e[f.key];
      if (f.key === 'sicht') v = isArr(v) ? (v.length ? v.map(function (m) { return FAULT_NAME[m] || String(m); }).join('; ') : 'keine Mängel') : '–';
      else if (f.key === 'messwerte') {
        if (isObj(v)) v = Object.keys(v).map(function (k) { const nv = toDisp(k, v[k]); return (nm0[k] || k) + ' ' + (isFinite(nv) ? fmt(nv, 3) : '–') + ' ' + (u0[k] || ''); }).join('; ');
        else v = '–';
      } else if (emptyStr(v)) v = '–';
      L_.push(f.label + ': ' + String(v));
    });
    return { ok: true, text: 'Prüfprotokoll\n' + L_.join('\n') + '\n' + TEXTS.uebungProtokoll };
  });
  const nm0 = { rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom', ber: 'Berührungsstrom' };
  const u0 = { rpe: 'Ω', riso: 'MΩ', ipe: 'mA', ber: 'mA' };
  E.extend('protocol', protocol);

  /* =============================== 4.8 Sicherheitsregeln und Rettungskette (rules, aid) =============================== */
  const FIVE = [
    { id: 'freischalten', nr: 1, name: 'Freischalten', text: 'Die Anlage allpolig vom Netz trennen.', grund: 'Ohne Trennung bleibt die Anlage unter Spannung.' },
    { id: 'sichern', nr: 2, name: 'Gegen Wiedereinschalten sichern', text: 'Verhindern, dass jemand die Anlage wieder einschaltet.', grund: 'Sonst kann die Anlage einschalten, während jemand an ihr arbeitet.' },
    { id: 'spannungsfrei', nr: 3, name: 'Spannungsfreiheit allpolig feststellen', text: 'Feststellen, dass die Anlage an der Arbeitsstelle spannungsfrei ist.', grund: 'Erst die Feststellung beweist, dass das Freischalten gewirkt hat.' },
    { id: 'erden', nr: 4, name: 'Erden und Kurzschließen', text: 'Die Anlage an der Arbeitsstelle erden und kurzschließen.', grund: 'Falls doch noch Spannung auftritt, wird die Quelle abgeschaltet und die Arbeitsstelle bleibt gesichert; erst nach der Feststellung der Spannungsfreiheit.' },
    { id: 'abdecken', nr: 5, name: 'Benachbarte unter Spannung stehende Teile abdecken oder abschranken', text: 'Teile in der Nähe, die unter Spannung stehen, abdecken oder abschranken.', grund: 'Sie sind weiter gefährlich und werden vor versehentlichem Berühren geschützt.' }
  ];
  const AID = [
    { id: 'eigenschutz', nr: 1, name: 'Eigenschutz beachten', text: 'Zuerst dich selbst schützen: Nicht in Gefahr begeben.', grund: 'Wer selbst verunglückt, kann nicht helfen.' },
    { id: 'abschalten', nr: 2, name: 'Spannung abschalten oder den Verunfallten sicher vom Stromkreis trennen', text: 'Den Stromkreis abschalten, ohne dich selbst zu gefährden.', grund: 'Solange der Strom fließt, ist der Verunfallte weiter gefährdet.' },
    { id: 'notruf', nr: 3, name: 'Notruf 112 absetzen', text: 'Den Rettungsdienst über den Notruf 112 alarmieren.', grund: 'Professionelle Hilfe muss schnell unterwegs sein.' },
    { id: 'pruefen', nr: 4, name: 'Bewusstsein und Atmung prüfen', text: 'Feststellen, ob der Verunfallte reagiert und atmet.', grund: 'Davon hängen die nächsten Maßnahmen ab.' },
    { id: 'massnahmen', nr: 5, name: 'Erste-Hilfe-Maßnahmen einleiten', text: 'Maßnahmen einleiten, wie du es im Erste-Hilfe-Kurs gelernt hast. ' + TEXTS.keinKurs, grund: 'Die Maßnahmen richten sich nach dem Befund aus dem vierten Schritt.' }
  ];
  const SZENEN = {
    schaltschrank: { name: 'Schaltschrank', labels: { freischalten: 'Hauptschalter ausschalten (Symbol)', sichern: 'Vorhängeschloss am Hauptschalter', spannungsfrei: 'Spannungsprüfer (nur Symbol)', erden: 'Erdungsseil anlegen (Symbol)', abdecken: 'Absperrband und Abdeckung' } },
    maschine: { name: 'Maschine', labels: { freischalten: 'Maschinenhauptschalter aus', sichern: 'Schloss und Schild am Hauptschalter', spannungsfrei: 'Spannungsprüfer (nur Symbol)', erden: 'Erdung der Zuleitung (Symbol)', abdecken: 'Nachbarfeld abdecken' } },
    leuchte: { name: 'Leuchte', labels: { freischalten: 'Sicherung des Lichtkreises ausschalten', sichern: 'Sicherung gegen Einschalten sperren', spannungsfrei: 'Spannungsprüfer (nur Symbol)', erden: 'Erden und Kurzschließen (nur Begriff)', abdecken: 'Benachbarte Teile abdecken' } }
  };
  function mkSeq(ORDER, kind, hooks) {
    return function (seq, scenario) { const r = mkSeq0(ORDER, kind, hooks)(seq, scenario); if (!r.ok) r.why = r.text; return r; };
  }
  function mkSeq0(ORDER, kind, hooks) {
    return function (seq, scenario) {
      if (!isArr(seq)) V('Die Reihenfolge muss als Liste angegeben werden.');
      if (seq.length > 200) V('Die Reihenfolge ist zu lang.');
      const ids = ORDER.map(function (o) { return o.id; });
      const nameOf = function (id) { return ORDER[ids.indexOf(id)].name; };
      let sz = null;
      if (kind === 'rules') {
        sz = scenario === undefined || scenario === null ? 'schaltschrank' : String(scenario);
        if (!SZENEN[sz]) V('Unbekanntes Szenario: erlaubt sind schaltschrank, maschine und leuchte.');
      }
      const out = { ok: false, art: 'ok', firstError: null, text: '', vollstaendig: false, weiter: false, szene: sz, schritte: ORDER.map(function (o) { return { id: o.id, nr: o.nr, name: o.name, text: o.text, grund: o.grund, beschriftung: sz ? SZENEN[sz].labels[o.id] : null }; }) };
      const got = [];
      for (let i = 0; i < seq.length; i++) {
        const id = isObj(seq[i]) ? String(seq[i].id) : String(seq[i]);
        if (ids.indexOf(id) < 0) { out.art = 'unbekannt'; out.firstError = i; out.text = '„' + id + '“ gehört nicht zu den ' + (kind === 'rules' ? 'fünf Sicherheitsregeln' : 'Schritten der Rettungskette') + '.'; return out; }
        if (got.indexOf(id) >= 0) { out.art = 'doppelt'; out.firstError = i; out.text = 'Doppelte Angabe: „' + nameOf(id) + '“ steht schon in deiner Reihenfolge.'; return out; }
        got.push(id);
      }
      if (!got.length) { out.art = 'fehlt'; out.firstError = 0; out.weiter = true; out.text = 'Du hast noch keinen Schritt gewählt. Der erste Schritt ist „' + ORDER[0].name + '“.'; return out; }
      for (let i = 0; i < got.length; i++) {
        if (got[i] === ids[i]) continue;
        out.firstError = i;
        const h = hooks(got, i, ids, nameOf);
        if (h) { out.art = 'reihenfolge'; out.text = h; return out; }
        if (got.indexOf(ids[i]) < 0) {
          out.art = 'fehlt';
          out.text = (i === 0 ? 'Es fehlt der erste Schritt: „' + ORDER[0].name + '“.' : 'Es fehlt ein Schritt: Nach „' + nameOf(ids[i - 1]) + '“ gehört „' + nameOf(ids[i]) + '“ in deine Reihenfolge.');
          return out;
        }
        out.art = 'reihenfolge';
        out.text = i === 0 ? 'Reihenfolge: Als Erstes kommt „' + ORDER[0].name + '“, nicht „' + nameOf(got[0]) + '“.'
          : 'Reihenfolge: Nach „' + nameOf(ids[i - 1]) + '“ folgt „' + nameOf(ids[i]) + '“, nicht „' + nameOf(got[i]) + '“.';
        return out;
      }
      if (got.length < ids.length) {
        out.art = 'fehlt'; out.firstError = got.length; out.weiter = true;
        out.text = 'Bisher richtig. Es fehlen noch ' + (ids.length - got.length) + ' Schritt(e); als Nächstes kommt „' + nameOf(ids[got.length]) + '“.';
        return out;
      }
      out.ok = true; out.art = 'ok'; out.vollstaendig = true;
      out.text = (kind === 'rules' ? 'Die fünf Sicherheitsregeln stehen in der richtigen Reihenfolge.' : 'Die Rettungskette steht in der richtigen Reihenfolge.') + (kind === 'rules' ? ' ' + TEXTS.keinKurs : ' ' + TEXTS.keinKurs);
      return out;
    };
  }
  const rules = {};
  rules.five = freeze(FIVE.map(function (r) { return r.id; }));
  rules.list = freeze(FIVE.map(freeze));
  rules.szenen = freeze(Object.keys(SZENEN));
  rules.info = S(function (id) {
    const k = String(id);
    for (let i = 0; i < FIVE.length; i++) if (FIVE[i].id === k) return Object.assign({ ok: true }, FIVE[i]);
    V('Unbekannte Sicherheitsregel: ' + k);
  });
  rules.check = S(mkSeq(FIVE, 'rules', function (got, i, ids, nameOf) {
    if (got[i] === 'erden' && got.slice(0, i).indexOf('spannungsfrei') < 0) return 'Vor dem Feststellen der Spannungsfreiheit darfst du nicht erden und kurzschließen.';
    if (i === 1 && got[0] === 'freischalten' && got[1] !== 'sichern') return 'Reihenfolge: Nach dem Freischalten folgt das Sichern gegen Wiedereinschalten.';
    if (got[i] === 'spannungsfrei' && got.slice(0, i).indexOf('freischalten') < 0) return 'Spannungsfreiheit kannst du erst nach dem Freischalten und Sichern sinnvoll feststellen.';
    return null;
  }));
  const aid = {};
  aid.chain = freeze(AID.map(function (r) { return r.id; }));
  aid.list = freeze(AID.map(freeze));
  aid.info = S(function (id) {
    const k = String(id);
    for (let i = 0; i < AID.length; i++) if (AID[i].id === k) return Object.assign({ ok: true }, AID[i]);
    V('Unbekannter Schritt der Rettungskette: ' + k);
  });
  aid.check = S(mkSeq(AID, 'aid', function (got, i, ids, nameOf) {
    if (i === 0) return got[0] === 'notruf' ? 'Reihenfolge: Erst der Eigenschutz, dann der Notruf. Ohne Eigenschutz gefährdest du dich selbst.' : 'Reihenfolge: Zuerst kommt der Eigenschutz. Wer sich selbst gefährdet, kann nicht helfen.';
    if (got[i] === 'massnahmen' && got.slice(0, i).indexOf('pruefen') < 0) return 'Reihenfolge: Erst Bewusstsein und Atmung prüfen, dann Maßnahmen einleiten.';
    return null;
  }));
  E.extend('rules', rules);
  E.extend('aid', aid);

  /* =============================== 4.10 Pruefmodell assess =============================== */
  const AMP_SYM = TEXTS.ampelSym;
  const RES_MIN = 1.2, UB_NAHE = 40;   /* Lehrfaustwerte (A2, F19), im Text so genannt */
  function res(ampel, text, extra) { const o = { ok: true, ampel: ampel, sym: AMP_SYM[ampel], text: text }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function rcdOn(c) { return isObj(c) && c.on === true; }
  function assessNetz(st) {
    const c = obj(st);
    const pe_ = c.fehler === 'pe-unterbrochen';
    const g = E.grid.fault(Object.assign({}, c, { fehler: pe_ ? 'pe-unterbrochen' : 'koerperschluss' }));
    if (!g.ok) return g;
    if (pe_) {
      const iK = g.iK;
      if (!rcdOn(c.rcd)) return res('rot', 'Der Schutzleiter ist unterbrochen und es gibt keinen Zusatzschutz: Der Leitungsschutz löst nicht aus, das Gehäuse führt Spannung (U_B = ' + fmt(g.uB) + ' V), der Körperstrom wäre ' + fmtEng(iK, 'A') + '.', { margin: null, zusatz: false });
      if (g.rcd && g.rcd.tripped) return res('gelb', 'Der Schutzleiter ist unterbrochen. Der RCD löst durch den Körperstrom ' + fmtEng(iK, 'A') + ' aus (höchstens nach ' + fmt(g.rcd.tTrip * 1000, 0) + ' ms). ' + TEXTS.zusatzErsetztNicht + ' Behebe den Fehler am Schutzleiter.', { margin: null, zusatz: true });
      return res('rot', 'Der Schutzleiter ist unterbrochen und der RCD löst bei ' + fmtEng(iK, 'A') + ' Körperstrom nicht sicher aus (IΔn = ' + fmt(c.rcd.idn === undefined ? 30 : c.rcd.idn) + ' mA).', { margin: null, zusatz: false });
    }
    if (g.form === 'TT') {
      if (!rcdOn(c.rcd)) return res('rot', 'Im TT-System gibt es ohne RCD keine sichere Abschaltung: I_F = ' + fmtEng(g.iF, 'A') + ', U_B = ' + fmt(g.uB, 1) + ' V.', { margin: null, zusatz: false });
      const ra = U.gridCfg(c).ra, r = g.raMax / ra;
      const txt = 'R_A = ' + fmt(ra, 1) + ' Ω, R_A,max = U_L / IΔn = ' + fmt(g.raMax, 1) + ' Ω. ';
      if (!g.bedingung) return res('rot', txt + 'Die TT-Bedingung ist nicht erfüllt.', { margin: r, zusatz: true });
      if (r < RES_MIN) return res('gelb', txt + 'Erfüllt, aber die Reserve ' + fmt(r, 2) + ' ist knapp (unter ' + fmt(RES_MIN) + '; ' + TEXTS.faustwert + ')', { margin: r, zusatz: true });
      return res('gruen', txt + 'Die TT-Bedingung ist erfüllt (Reserve ' + fmt(r, 2) + ').', { margin: r, zusatz: true });
    }
    if (g.form === 'IT' && g.meldung) return res('gruen', 'Erster Fehler im IT-System: I_F1 = ' + fmtEng(g.iF, 'A') + ', U_B = ' + fmt(g.uB, 3) + ' V. Es wird nicht abgeschaltet, die Isolationsüberwachung meldet den Fehler.', { margin: null, zusatz: false });
    const zus = rcdOn(c.rcd);
    if (!g.bedingung) return res('rot', 'Zs = ' + fmt(g.zs, 4) + ' Ω ist größer als Zs_max = ' + fmt(g.zsMax, 4) + ' Ω: Die Abschaltbedingung ist nicht erfüllt.', { margin: g.reserve, zusatz: zus });
    const base = 'Zs = ' + fmt(g.zs, 4) + ' Ω ≤ Zs_max = ' + fmt(g.zsMax, 4) + ' Ω (Reserve ' + fmt(g.reserve, 2) + '), U_B = ' + fmt(g.uB, 1) + ' V.';
    if (g.reserve < RES_MIN || g.uB >= UB_NAHE) return res('gelb', base + ' Knapp: ' + (g.reserve < RES_MIN ? 'Reserve unter ' + fmt(RES_MIN) : 'U_B ab ' + fmt(UB_NAHE) + ' V nahe an ' + fmt(UL) + ' V') + ' (Lehrfaustwert, kein Normwert).', { margin: g.reserve, zusatz: zus });
    return res('gruen', base + ' Der Schutz wirkt in der Simulation.', { margin: g.reserve, zusatz: zus });
  }
  function assessKoerper(st) {
    const c = obj(st);
    if (c.art !== undefined && /^(dc|gleich|gleichstrom)$/i.test(String(c.art))) return res('grau', TEXTS.gleichstrom, { valid: false, margin: null });
    const t = E.body.touch({ U: c.U === undefined ? 230 : c.U, haut: c.haut, pfad: c.pfad, rv: c.rv, tMs: c.tMs });
    if (!t.ok) return t;
    let z = t.zoneInfo, zus = false, extra = '';
    const rc = c.rcd;
    if (rc === true || rc === 30 || (isObj(rc) && rc.on !== false)) {
      const idn = isObj(rc) && rc.idn ? rc.idn : 30;
      const p = E.rcd.person({ U: t.U, haut: c.haut, pfad: c.pfad, rv: c.rv, idn: idn, type: 'A', on: true });
      if (p.ok && p.trip.tripped) {
        zus = true;
        const tm = Math.min(t.tMs, p.tAb * 1000);
        z = E.body.zone(t.I_K, tm);
        extra = ' Der RCD löst aus und verkürzt die Einwirkdauer auf höchstens ' + fmt(tm, 0) + ' ms. ' + TEXTS.rcdVerkuerzt;
      } else if (p.ok) extra = ' Der RCD löst bei diesem Körperstrom nicht sicher aus.';
    }
    const amp = z.zone === 1 ? 'gruen' : (z.zone === 2 ? 'gelb' : 'rot');
    return res(amp, 'Körperstrom ' + fmtEng(t.I_K, 'A') + ' bei ' + fmt(t.U) + ' V: ' + z.text + extra + (t.hinweis ? ' ' + t.hinweis : ''), { margin: z.margin, zusatz: zus, zone: z.zone });
  }
  function assessSchutz(st) {
    const c = obj(st);
    const dev = c.dev === undefined ? 'LS-B' : c.dev, In = c.In === undefined ? 16 : c.In;
    const cab = E.prot.cable(c.q === undefined ? 2.5 : c.q);
    if (!cab.ok) return cab;
    const t = [];
    let rot = false, gelb = false;
    const ib = c.ib === undefined ? 0 : num(c.ib, NaN);
    const chk = E.prot.check(ib, In, cab.iz);
    if (chk.ok === false && chk.why) return chk;
    if (!chk.ibOk || !chk.izOk) rot = true;
    t.push(chk.text);
    const sc = E.prot.shortCircuit({ q: cab.q, qpe: c.qpe, l: c.l, zv: c.zv, rho: c.rho, U0: c.U0 });
    if (!sc.ok) return sc;
    const tk = E.prot.trip(dev, In, sc.ik);
    if (!tk.ok) return tk;
    if (tk.bereich === 'sicher') t.push('Der Kurzschlussstrom ' + fmtEng(sc.ik, 'A') + ' löst den ' + dev + ' sicher aus.');
    else if (tk.bereich === 'unsicher') { gelb = true; t.push('Der Kurzschlussstrom ' + fmtEng(sc.ik, 'A') + ' liegt im unsicheren Bereich des ' + dev + ': Die Auslösung ist nicht garantiert.'); }
    else { rot = true; t.push('Der Kurzschlussstrom ' + fmtEng(sc.ik, 'A') + ' löst den ' + dev + ' nicht sicher aus.'); }
    if (c.ein !== undefined && c.ein !== null) {
      const e = E.prot.inrush(dev, In, c.ein);
      if (!e.ok) return e;
      if (e.ausloesung === 'ja') rot = true; else if (e.ausloesung === 'moeglich') gelb = true;
      t.push(e.text);
    }
    if (c.i !== undefined && c.i !== null) {
      const w = E.prot.trip(dev, In, num(c.i, NaN));
      if (!w.ok) return w;
      if (w.bereich === 'unsicher') gelb = true;
      t.push('Arbeitspunkt ' + fmtEng(num(c.i, 0), 'A') + ': ' + w.text);
    }
    return res(rot ? 'rot' : (gelb ? 'gelb' : 'gruen'), t.join(' '), { margin: cab.iz / U.inOf(In), iz: cab.iz, ik: sc.ik });
  }
  function assessRcd(st) {
    const c = obj(st);
    const cfg = { idn: c.idn === undefined ? 30 : c.idn, type: c.type === undefined ? 'A' : c.type, on: c.on === undefined ? true : c.on === true, defekt: c.defekt === true };
    const chk = E.rcd.trip(cfg, 'sinus', 0);
    if (!chk.ok) return chk;
    if (!cfg.on) return res('grau', 'Der RCD ist ausgeschaltet: Es wird nichts geprüft.', { margin: null });
    const t = [];
    let rot = false, gelb = false, tested = false, margin = null;
    if (isArr(c.leak) && c.leak.length) {
      const ls = E.rcd.leakSum(c.leak, cfg);
      if (!ls.ok) return ls;
      tested = true; margin = ls.ratio;
      if (ls.fehlausloesung) { rot = true; t.push(ls.text); }
      else if (ls.nahe) { gelb = true; t.push('Die Ableitströme ' + fmt(ls.sum, 2) + ' mA erreichen ' + fmt(ls.ratio, 2) + ' · IΔn: Die Fehlauslösung liegt nahe (ab 0,3 · IΔn, Lehrfaustwert).'); }
      else t.push('Die Ableitströme ' + fmt(ls.sum, 2) + ' mA liegen bei ' + fmt(ls.ratio, 2) + ' · IΔn: keine Fehlauslösung zu erwarten.');
    }
    let iF = num(c.iFehler, 0);
    const fromPerson = c.person === true;
    if (fromPerson) {
      const b = E.body.resistance({ haut: c.haut, pfad: c.pfad, rv: c.rv });
      if (b.ok) iF = Math.max(iF, 1000 * U0 / b.rges);
    }
    if (iF > 0) {
      tested = true;
      const sh = c.form === undefined || c.form === null ? 'sinus' : String(c.form);
      const tr = E.rcd.trip(cfg, sh, iF);
      if (!tr.ok) return tr;
      if (margin === null) margin = iF / cfg.idn;
      if (tr.blind) { rot = true; t.push(tr.text); }
      else if (tr.tripped) t.push('Fehlerstrom ' + fmt(iF, 2) + ' mA: ' + tr.text);
      else if (tr.possible) { gelb = true; t.push(tr.text); }
      else if (fromPerson) { rot = true; t.push('Körperstrom ' + fmt(iF, 2) + ' mA: ' + tr.text + ' Du bist weiter gefährdet.'); }
      else t.push(tr.text);
    }
    if (c.taste === true) {
      tested = true;
      const tb = E.rcd.testButton(cfg);
      if (!tb.tripped) rot = true;
      t.push(tb.text);
    }
    if (!tested) return res('grau', 'Noch nichts geprüft: Drücke die Prüftaste, lege einen Fehlerstrom an oder trage Ableitströme ein.', { margin: null });
    return res(rot ? 'rot' : (gelb ? 'gelb' : 'gruen'), t.join(' '), { margin: margin });
  }
  const NASS = ['Bad', 'Außen', 'Aussen'];
  function assessKlassen(st) {
    const c = obj(st);
    const sk = c.sk === undefined || c.sk === null ? 'I' : String(c.sk);
    const ci = E.cls.info(sk);
    if (!ci.ok) return ci;
    const t = [];
    let rot = false, gelb = false;
    if (ci.id === 'I' && c.pe === false) { rot = true; t.push('Ein Gerät der Schutzklasse I ohne angeschlossenen Schutzleiter hat keinen Fehlerschutz.'); }
    if (ci.id === 'III' && c.quelle !== undefined && c.quelle !== null && String(c.quelle) === 'Netz') { rot = true; t.push('Schutzklasse III braucht eine SELV- oder PELV-Quelle, nicht das Netz.'); }
    if (c.fehler === 'koerperschluss') { const ef = E.cls.effect(ci.id, 'koerperschluss'); if (ef.ok) t.push(ef.text); }
    if (c.ip !== undefined && c.ip !== null && c.umgebung !== undefined && NASS.indexOf(String(c.umgebung)) >= 0) {
      const code = isArr(c.ip) ? E.ip.encode(c.ip[0], c.ip[1]) : E.ip.decode(c.ip);
      if (!code.ok) return code;
      if (code.b === 0) { gelb = true; t.push('Im Bereich ' + String(c.umgebung) + ' bietet ' + code.code + ' keinen Schutz gegen Wasser (zweite Ziffer 0: ' + code.textB + ').'); }
    }
    if (!t.length) t.push('Maßnahme und Schutzklasse ' + ci.id + ' passen zusammen.');
    return res(rot ? 'rot' : (gelb ? 'gelb' : 'gruen'), t.join(' '), { margin: null });
  }
  function assessIsolation(st) {
    const c = obj(st);
    const art = c.art === undefined || c.art === null ? 'riso' : String(c.art);
    if (art === 'riso') {
      const m = E.insu.measure(Object.assign({}, c, { sk: c.sk === undefined ? 'I' : c.sk }));
      if (!m.ok) return m;
      if (m.bestanden === null) return res('grau', m.text, { margin: null });
      const r = m.rMOhm / m.grenze;
      if (!m.bestanden) return res('rot', m.text, { margin: r });
      if (m.nahe) return res('gelb', m.text + ' Der Wert liegt nahe am Grenzwert (höchstens das 1,2-fache; Lehrfaustwert).', { margin: r });
      return res('gruen', m.text, { margin: r });
    }
    if (art === 'rpe') {
      const m = E.pe.measure(c);
      if (!m.ok) return m;
      if (!m.grenze.valid) return res('grau', m.text, { margin: null });
      const lim = L('rpe_5m').value, r = lim / m.R;
      if (m.verfaelscht) return res('rot', m.text + ' Die Messart ist falsch gewählt: Bei kleinem Widerstand verfälscht der Kontaktwiderstand das Ergebnis.', { margin: r });
      if (!m.bestanden) return res('rot', m.text, { margin: r });
      if (m.R > lim / RES_MIN) return res('gelb', m.text + ' Der Wert liegt nahe am Grenzwert (Lehrfaustwert 1,2).', { margin: r });
      return res('gruen', m.text, { margin: r });
    }
    if (art === 'ableit') {
      const m = E.leak.touch(Object.assign({}, c, { sk: c.sk === undefined ? 'II' : c.sk }));
      if (!m.ok) return m;
      if (m.bestanden === null) return res('grau', m.text, { margin: null });
      const r = m.grenze / m.imA;
      if (!m.bestanden) return res('rot', m.text, { margin: r });
      if (m.imA * RES_MIN > m.grenze) return res('gelb', m.text + ' Der Wert liegt nahe am Grenzwert (Lehrfaustwert 1,2).', { margin: r });
      return res('gruen', m.text, { margin: r });
    }
    V('Unbekannte Messart: erlaubt sind riso, rpe und ableit.');
  }
  function hasStep(m, id) {
    if (id === 'sicht') return isArr(m.sicht);
    if (id === 'ipe') return (m.ipe !== undefined && m.ipe !== null) || (m.ber !== undefined && m.ber !== null);
    return m[id] !== undefined && m[id] !== null;
  }
  function assessPruefplatz(st) {
    const c = obj(st);
    const x = devOf(c.dev);
    const sk = x.d.sk;
    const exp = E.cls.info(sk).pruefung;
    const m = obj(c.meas);
    const done = exp.filter(function (id) { return hasStep(m, id); });
    const order = isArr(c.order) ? c.order.map(String) : done;
    if (!done.length && !order.length) return res('grau', 'Noch kein Prüfschritt durchgeführt. Beginne mit der Sichtprüfung.', { margin: null });
    let ordOk = true;
    for (let i = 0; i < order.length; i++) if (order[i] !== exp[i]) { ordOk = false; break; }
    if (!ordOk) return res('rot', 'Falsche Reihenfolge: Zuerst die Sichtprüfung, dann Schutzleiterwiderstand, Isolationswiderstand und Schutzleiterstrom (bei Schutzklasse II ohne Schutzleiterwiderstand).', { margin: null });
    const vd = device.verdict(Object.assign({}, m), { id: x.d.id, sk: sk, leitungM: x.d.leitungM });
    if (!vd.ok) return vd;
    const erg = c.ergebnis === undefined || c.ergebnis === null || c.ergebnis === '' ? null : String(c.ergebnis);
    if (erg !== null) {
      const falsch = erg === 'bestanden' ? vd.gesamt !== 'bestanden' : (erg === 'nicht bestanden' ? vd.gesamt === 'bestanden' : true);
      if (falsch) return res('rot', 'Fehlurteil: Eingetragen ist „' + erg + '“, die Messwerte ergeben ' + (vd.gesamt === 'unvollstaendig' ? 'noch kein Urteil' : '„' + vd.gesamt + '“') + '. ' + vd.text, { margin: null });
    }
    if (done.length < exp.length) return res('gelb', 'Es fehlen noch Prüfschritte: ' + vd.fehlend.map(function (i) { return stepName(i, sk); }).join(', ') + '. Ohne alle Schritte gibt es kein „bestanden“.', { margin: null });
    if (erg === null) return res('gelb', 'Alle Schritte sind durchgeführt, das Gesamtergebnis ist noch nicht eingetragen. ' + vd.text, { margin: null });
    return res('gruen', 'Alle Schritte durchgeführt, Ergebnis „' + erg + '“ stimmt mit den Messwerten überein. ' + TEXTS.uebungProtokoll, { margin: null });
  }
  function assessRegeln(st) {
    const c = obj(st);
    const aidMode = c.modus === 'aid' || c.modus === 'rettung';
    const seq = isArr(c.seq) ? c.seq : [];
    const r = aidMode ? aid.check(seq) : rules.check(seq, c.szene);
    if (r.ok === false && r.art === undefined) return r;
    if (!seq.length) return res('grau', 'Noch kein Schritt gewählt.', { margin: null });
    if (r.ok) return res('gruen', r.text, { margin: null });
    if (r.art === 'fehlt' && r.weiter && c.fertig !== true) return res('grau', r.text, { margin: null });
    return res('rot', r.text, { margin: null, art: r.art });
  }
  const ASSESS = { koerper: assessKoerper, netz: assessNetz, schutz: assessSchutz, rcd: assessRcd, klassen: assessKlassen, isolation: assessIsolation, pruefplatz: assessPruefplatz, regeln: assessRegeln };
  const assess = function (rigId, state) {
    let r;
    try {
      const f = Object.prototype.hasOwnProperty.call(ASSESS, String(rigId)) ? ASSESS[String(rigId)] : null;
      if (!f) V('Unbekannter Prüfstand: erlaubt sind ' + Object.keys(ASSESS).join(', ') + '.');
      r = f(state);
    } catch (e) { r = fail(e && e.elsWhy ? e.elsWhy : 'Mit diesen Eingaben gibt es kein Ergebnis.'); }
    if (!isObj(r)) r = fail('Mit diesen Eingaben gibt es kein Ergebnis.');
    if (r.ok === false) { r.ampel = 'grau'; r.sym = AMP_SYM.grau; r.text = r.text || r.why || TEXTS.eingabe; }
    return r;
  };
  E.extend('assess', assess);

  /* =============================== 4.9 Auslegung (design) =============================== */
  const QS = [1.5, 2.5, 4, 6];
  const design = {};
  function worst(a, b) { const o = { gruen: 0, gelb: 1, rot: 2, grau: 0 }; return o[b] > o[a] ? b : a; }
  design.circuit = S(function (cfg) {
    const c = obj(cfg);
    const Uv = c.U === undefined || c.U === null ? U0 : reqPos(c.U, 'Die Spannung', 1e4);
    let ib;
    if (c.ib !== undefined && c.ib !== null) ib = reqNn(c.ib, 'Der Betriebsstrom', 1e5);
    else ib = reqNn(c.P === undefined || c.P === null ? 0 : c.P, 'Die Leistung', 1e8) / Uv;
    const q = c.q === undefined || c.q === null ? 2.5 : c.q;
    const cab = E.prot.cable(q);
    if (!cab.ok) V(cab.why);
    const In = c.In === undefined || c.In === null ? 16 : c.In;
    const dev = c.dev === undefined || c.dev === null ? 'LS-B' : c.dev;
    const chk = E.prot.check(ib, In, cab.iz);
    if (chk.ok === false && chk.why) V(chk.why);
    const gc = Object.assign({}, c, { q: cab.q, dev: dev, In: In, fehler: 'koerperschluss' });
    delete gc.P; delete gc.ib; delete gc.U;
    const g = E.grid.fault(gc);
    if (!g.ok) V(g.why);
    const rc = isObj(c.rcd) ? c.rcd : {};
    const zusatz = rc.on === true && (rc.idn === undefined ? 30 : num(rc.idn, 999)) <= L('idn_zusatz').value;
    const an = assessNetz(gc);
    const as = assessSchutz({ dev: dev, In: In, ib: ib, q: cab.q, l: gc.l, zv: gc.zv, qpe: gc.qpe, rho: gc.rho, U0: gc.U0 });
    let amp = 'gruen';
    [an, as].forEach(function (a) { if (a.ok && a.ampel) amp = worst(amp, a.ampel); });
    const zsOk = g.form === 'IT' && g.meldung ? null : g.bedingung;
    const text = [];
    text.push('Betriebsstrom Ib = ' + fmtEng(ib, 'A') + (c.P !== undefined && c.P !== null ? ' (P / U bei cos φ = 1)' : '') + '.');
    text.push(chk.text);
    if (g.form === 'IT' && g.meldung) text.push(g.text);
    else if (g.form === 'TT') text.push('TT: I_F = ' + fmtEng(g.iF, 'A') + ', U_B = ' + fmt(g.uB, 1) + ' V, R_A,max = ' + fmt(g.raMax, 1) + ' Ω.');
    else text.push('Zs = ' + fmt(g.zs, 4) + ' Ω, Ia = ' + fmtEng(g.ia, 'A') + ', Zs_max = ' + fmt(g.zsMax, 4) + ' Ω: Abschaltbedingung ' + (g.bedingung ? 'erfüllt' : 'nicht erfüllt') + ', I_F = ' + fmtEng(g.iF, 'A') + ', U_B = ' + fmt(g.uB, 1) + ' V.');
    text.push(zusatz ? 'Zusatzschutz: RCD mit ' + fmt(rc.idn === undefined ? 30 : rc.idn) + ' mA ist vorhanden.' : 'Kein Zusatzschutz mit höchstens ' + limitText('idn_zusatz') + '.');
    return { ok: true, ib: ib, in: U.inOf(In), iz: cab.iz, ibOk: chk.ibOk, izOk: chk.izOk, check: chk, zs: g.zs, ia: g.ia, zsMax: g.zsMax, zsOk: zsOk, reserve: g.reserve, tAb: g.tAb, tOK: g.tOK, ub: g.uB, iF: g.iF, zusatz: zusatz, ampel: amp, sym: AMP_SYM[amp], text: text, fault: g, netz: an, schutz: as };
  });
  design.minCross = S(function (cfg) {
    const c = obj(cfg);
    const fixedPe = c.qpe !== undefined && c.qpe !== null;
    let last = null;
    for (let i = 0; i < QS.length; i++) {
      const cc = Object.assign({}, c, { q: QS[i] });
      if (!fixedPe) cc.qpe = QS[i];
      const r = design.circuit(cc);
      if (!r.ok) return r;
      last = r;
      if (r.ibOk && r.izOk && r.zsOk !== false) {
        let lmax = null;
        if (r.fault.form !== 'TT') { const ml = E.grid.maxLength(Object.assign({}, cc, { fehler: 'koerperschluss' })); if (ml.ok) lmax = ml.lMax; }
        return { ok: true, q: QS[i], circuit: r, lMax: lmax, text: 'Kleinster Querschnitt: ' + fmt(QS[i]) + ' mm² (Iz = ' + fmtEng(r.iz, 'A') + (lmax !== null ? ', größte Länge ' + fmt(lmax, 1) + ' m' : '') + ').' };
      }
    }
    return fail('Kein Querschnitt aus ' + QS.map(function (q) { return fmt(q); }).join('; ') + ' mm² erfüllt Strombelastbarkeit und Abschaltbedingung' + (last && last.zsOk === false ? ' bei dieser Länge (Zs = ' + fmt(last.zs, 4) + ' Ω > Zs_max = ' + fmt(last.zsMax, 4) + ' Ω bei ' + fmt(QS[QS.length - 1]) + ' mm²)' : '') + '.');
  });
  design.stringText = function (r) {
    try {
      if (isObj(r) && isArr(r.text)) return r.text.join(' ');
      if (isObj(r) && typeof r.text === 'string') return r.text;
      if (isObj(r) && typeof r.why === 'string') return r.why;
      return '';
    } catch (e) { return ''; }
  };
  design.qs = QS.slice();
  E.extend('design', design);

  /* =============================== Diagnose (diagnose) =============================== */
  Object.assign(TEXTS.diag, {
    'zs-zu-gross': 'Die Schleifenimpedanz Zs = {zs} ist größer als Zs_max = {zsmax}: Das Schutzorgan löst nicht sicher aus, die Abschaltbedingung ist verletzt.',
    'leitung-zu-lang': 'Die Leitung ist mit {l} länger als die größte zulässige Länge von {lmax}: Verkürze sie oder nimm einen größeren Querschnitt.',
    'ub-gross': 'Die Berührungsspannung U_B = {ub} liegt über der dauernd zulässigen Berührungsspannung {ul}.',
    'pe-unterbr': 'Der Schutzleiter ist unterbrochen: Der Fehlerstrom I_F ist nahezu 0, der Leitungsschutz bleibt stumm und das Gehäuse führt Spannung (U_B = {ub}).{rcd}',
    'ls-zu-gross': 'Der Nennstrom In = {in} ist größer als die Strombelastbarkeit Iz = {iz}: Die Leitung ist bei Überlast nicht geschützt.',
    'unsicher': 'Bei {i} liegt die Auslösung des {dev} im unsicheren Bereich ({lo} bis {hi} · In): Er kann auslösen, die Auslösung ist nicht garantiert.',
    'rcd-blind': 'Der RCD {typ} erkennt die Stromform {form} nicht: Er löst bei {i} nicht aus.',
    'rcd-fehlausl': 'Die Ableitströme summieren sich auf {sum} = {ratio} · IΔn (ab {schwelle} · IΔn ist eine Fehlauslösung möglich, Lehrfaustwert).',
    'rcd-taste': 'Die Prüftaste löst aus, obwohl der Schutzleiter unterbrochen ist. Die Prüftaste prüft nur die Auslösefunktion des RCD, nicht den Schutzleiter.',
    'riso-klein': 'Der Isolationswiderstand {r} liegt unter dem Grenzwert {grenze}.',
    'rpe-gross': 'Der Schutzleiterwiderstand {r} liegt über dem Grenzwert {grenze}.',
    'rpe-2l': 'Die 2-Leiter-Messung zeigt {r}, davon sind {rk} Kontaktwiderstand: Ohne ihn sind es {rkorr}. Das Urteil ändert sich; miss mit 4 Leitern oder ziehe den Kontaktwiderstand ab.',
    'ipe-gross': 'Der Schutzleiterstrom {i} liegt über dem Grenzwert {grenze}.',
    'ber-gross': 'Der Berührungsstrom {i} liegt über dem Grenzwert {grenze}.',
    'sk-pe': 'Ein Gerät der Schutzklasse I braucht einen angeschlossenen Schutzleiter; hier fehlt der Schutzleiterpfad.',
    'ip-unpassend': 'Im Bereich {umg} bietet {ip} keinen Schutz gegen Wasser ({textb}).',
    'regel-reihenfolge': '{why}',
    'regel-fehlt': '{why}',
    'aid-reihenfolge': '{why}',
    'proto-ergebnis': '{why}',
    'proto-fehlt': '{why}'
  });
  const DIAG_IDS = ['zs-zu-gross', 'leitung-zu-lang', 'ub-gross', 'pe-unterbr', 'ls-zu-gross', 'unsicher', 'rcd-blind', 'rcd-fehlausl', 'rcd-taste', 'riso-klein', 'rpe-gross', 'rpe-2l', 'ipe-gross', 'ber-gross', 'sk-pe', 'ip-unpassend', 'regel-reihenfolge', 'regel-fehlt', 'aid-reihenfolge', 'proto-ergebnis', 'proto-fehlt'];
  const DIAG_KIND = { 'zs-zu-gross': 'error', 'leitung-zu-lang': 'warn', 'ub-gross': 'warn', 'pe-unterbr': 'error', 'ls-zu-gross': 'error', 'unsicher': 'warn', 'rcd-blind': 'error', 'rcd-fehlausl': 'warn', 'rcd-taste': 'info', 'riso-klein': 'error', 'rpe-gross': 'error', 'rpe-2l': 'warn', 'ipe-gross': 'error', 'ber-gross': 'error', 'sk-pe': 'error', 'ip-unpassend': 'warn', 'regel-reihenfolge': 'error', 'regel-fehlt': 'warn', 'aid-reihenfolge': 'error', 'proto-ergebnis': 'error', 'proto-fehlt': 'warn' };
  function dpush(out, id, vars) { out.push({ id: id, kind: DIAG_KIND[id] || 'info', text: TEXTS.get(id, vars) }); }
  function dtry(fn) { try { fn(); } catch (e) { /* nie werfen */ } }
  const diagnose = function (ctx) {
    const out = [];
    try {
      ctx = obj(ctx);
      const n = ctx.netz;
      if (isObj(n)) dtry(function () {
        const f = E.grid.fault(n);
        if (!f.ok) return;
        const tn = f.form === 'TN-S' || f.form === 'TN-C-S' || (f.form === 'IT' && n.zweiterFehler === true);
        if (f.fehler === 'pe-unterbrochen') {
          dpush(out, 'pe-unterbr', { ub: fmt(f.uB) + ' V', rcd: f.rcd && f.rcd.tripped ? ' Der RCD löst erst durch den Körperstrom aus. ' + TEXTS.zusatzErsetztNicht : '' });
        } else if (f.fehler === 'koerperschluss') {
          if (tn && f.bedingung === false) dpush(out, 'zs-zu-gross', { zs: fmt(f.zs, 4) + ' Ω', zsmax: fmt(f.zsMax, 4) + ' Ω' });
          if (tn) {
            const ml = E.grid.maxLength(n), l = U.lineCfg(n).l;
            if (ml.ok && ml.valid && l > ml.lMax + 1e-9) dpush(out, 'leitung-zu-lang', { l: fmt(l, 1) + ' m', lmax: fmt(ml.lMax, 1) + ' m' });
          }
          if (f.uB > UL + 1e-9) dpush(out, 'ub-gross', { ub: fmt(f.uB, 1) + ' V', ul: limitText('ul_ac') });
          if (tn && f.bereich === 'unsicher') {
            const d = E.prot.devices.filter(function (x) { return x.id === (n.dev === undefined ? 'LS-B' : n.dev); })[0];
            dpush(out, 'unsicher', { i: fmtEng(f.iF, 'A'), dev: d.id, lo: fmt(d.lo), hi: fmt(d.hi) });
          }
        }
      });
      const s = ctx.schutz;
      if (isObj(s)) dtry(function () {
        const dev = s.dev === undefined ? 'LS-B' : s.dev, In = s.In === undefined ? 16 : s.In;
        const cab = E.prot.cable(s.q === undefined ? 2.5 : s.q);
        if (cab.ok && num(In, NaN) > cab.iz) dpush(out, 'ls-zu-gross', { in: fmtEng(In, 'A'), iz: fmtEng(cab.iz, 'A') });
        if (s.i !== undefined && s.i !== null) {
          const t = E.prot.trip(dev, In, num(s.i, NaN));
          if (t.ok && t.bereich === 'unsicher') {
            const d = E.prot.devices.filter(function (x) { return x.id === dev; })[0];
            dpush(out, 'unsicher', { i: fmtEng(num(s.i, 0), 'A'), dev: dev, lo: fmt(d.lo), hi: fmt(d.hi) });
          }
        }
      });
      const r = ctx.rcd;
      if (isObj(r)) dtry(function () {
        const cfg = { idn: r.idn === undefined ? 30 : r.idn, type: r.type === undefined ? 'A' : r.type, on: r.on === undefined ? true : r.on === true };
        const iF = num(r.iFehler, 0);
        if (iF > 0 && cfg.on) {
          const sh = r.form === undefined ? 'sinus' : String(r.form);
          const t = E.rcd.trip(cfg, sh, iF);
          if (t.ok && t.blind) dpush(out, 'rcd-blind', { typ: cfg.type, form: sh, i: fmt(iF, 2) + ' mA' });
        }
        if (isArr(r.leak) && r.leak.length) {
          const ls = E.rcd.leakSum(r.leak, cfg);
          if (ls.ok && ls.fehlausloesung) dpush(out, 'rcd-fehlausl', { sum: fmt(ls.sum, 2) + ' mA', ratio: fmt(ls.ratio, 2), schwelle: fmt(L('rcd_bereich').value) });
        }
        if (r.taste === true && cfg.on && String(r.pe) === 'unterbrochen') {
          const tb = E.rcd.testButton(cfg);
          if (tb.tripped) dpush(out, 'rcd-taste', {});
        }
      });
      const iso = ctx.iso;
      if (isObj(iso)) dtry(function () {
        if (isObj(iso.riso)) {
          const m = E.insu.measure(iso.riso);
          if (m.ok && m.bestanden === false) dpush(out, 'riso-klein', { r: fmt(m.rMOhm, 3) + ' MΩ', grenze: limitText(m.grenzeId) });
        }
        if (isObj(iso.rpe)) {
          const m = E.pe.measure(iso.rpe);
          if (m.ok && m.grenze.valid) {
            if (m.verfaelscht) dpush(out, 'rpe-2l', { r: fmt(m.R, 3) + ' Ω', rk: fmt(m.R_Kontakt, 3) + ' Ω', rkorr: fmt(m.rKorr, 3) + ' Ω' });
            else if (m.bestanden === false) dpush(out, 'rpe-gross', { r: m.ueberlauf ? 'über dem Messbereich' : fmt(m.R, 3) + ' Ω', grenze: limitText('rpe_5m') });
          }
        }
        if (isObj(iso.leak)) {
          const sk = iso.leak.sk === undefined ? 'II' : iso.leak.sk;
          const m = E.leak.touch(iso.leak);
          if (m.ok && m.bestanden === false) {
            if (String(m.sk) === 'I' && iso.leak.art === 'ipe') dpush(out, 'ipe-gross', { i: fmt(m.imA, 3) + ' mA', grenze: limitText('ipe_sk1') });
            else dpush(out, 'ber-gross', { i: fmt(m.imA, 3) + ' mA', grenze: limitText(m.grenzeId) });
          }
          if (iso.leak.ipe !== undefined && iso.leak.ipe !== null) {
            const v = num(iso.leak.ipe, NaN);
            if (isFinite(v) && limitOK('ipe_sk1', v) === false) dpush(out, 'ipe-gross', { i: fmt(v, 3) + ' mA', grenze: limitText('ipe_sk1') });
          }
          void sk;
        }
      });
      const k = ctx.klasse;
      if (isObj(k)) dtry(function () {
        const sk = skOf(k.sk === undefined ? 'I' : k.sk);
        if (sk === 'I' && k.pe === false) dpush(out, 'sk-pe', {});
        if (k.ip !== undefined && k.ip !== null && k.umgebung !== undefined && NASS.indexOf(String(k.umgebung)) >= 0) {
          const code = isArr(k.ip) ? E.ip.encode(k.ip[0], k.ip[1]) : E.ip.decode(k.ip);
          if (code.ok && code.b === 0) dpush(out, 'ip-unpassend', { umg: String(k.umgebung), ip: code.code, textb: code.textB });
        }
      });
      const rg = ctx.regeln;
      if (isObj(rg)) dtry(function () {
        const c = rules.check(isArr(rg.seq) ? rg.seq : [], rg.szene);
        if (c.ok || !isArr(rg.seq) || !rg.seq.length) return;
        if (c.art === 'reihenfolge' || c.art === 'doppelt' || c.art === 'unbekannt') dpush(out, 'regel-reihenfolge', { why: c.text });
        else if (c.art === 'fehlt' && (!c.weiter || rg.fertig === true)) dpush(out, 'regel-fehlt', { why: c.text });
      });
      const ad = ctx.aid;
      if (isObj(ad)) dtry(function () {
        const c = aid.check(isArr(ad.seq) ? ad.seq : []);
        if (c.ok || !isArr(ad.seq) || !ad.seq.length) return;
        if (c.art === 'reihenfolge' || c.art === 'doppelt' || c.art === 'unbekannt' || (c.art === 'fehlt' && (!c.weiter || ad.fertig === true))) dpush(out, 'aid-reihenfolge', { why: c.text });
      });
      const pr = ctx.protokoll;
      if (isObj(pr)) dtry(function () {
        const c = protocol.check(pr.entry, pr.dev);
        if (!c.ok && isArr(c.abweichungen)) {
          const e = c.abweichungen.filter(function (a) { return a.diag === 'proto-ergebnis'; });
          const f = c.abweichungen.filter(function (a) { return a.diag === 'proto-fehlt'; });
          if (e.length) dpush(out, 'proto-ergebnis', { why: e.map(function (a) { return a.text; }).join(' ') });
          if (f.length) dpush(out, 'proto-fehlt', { why: f.map(function (a) { return a.text; }).join(' ') });
        }
      });
    } catch (e) { /* nie werfen */ }
    return out;
  };
  diagnose.ids = DIAG_IDS.slice();
  E.extend('diagnose', diagnose);

  /* =============================== 4.11 Formeln (formulas) =============================== */
  const formulas = {};
  const FORDER = [];
  /* def(id, Name, Symbol, Ausdruck, Einheit, Argumente [[Name, Einheit]], Weg-Vorlage, fn, whyFn) */
  function def(id, name, symbol, expr, unit, args, weg, fn, whyFn) {
    const f = C(fn);
    const o = {
      id: id, name: name, symbol: symbol, expr: expr, unit: unit,
      args: args.map(function (a) { return { name: a[0], unit: a[1] }; }),
      fn: f,
      explain: function () {
        try {
          const a = Array.prototype.slice.call(arguments);
          const v = f.apply(null, a);
          if (typeof v !== 'number' || !isFinite(v)) {
            let why = TEXTS.eingabe;
            try { if (whyFn) { const w = whyFn.apply(null, a); if (w) why = w; } } catch (e) { /* */ }
            return { ok: false, value: NaN, why: why, text: why };
          }
          const t = weg.replace(/\{(\d+)\}/g, function (_, i) { const k = Number(i); const u = args[k] ? args[k][1] : ''; return args[k] ? (u === '#' ? fmt(a[k]) : fmtEng(a[k], u)) : ''; });
          return { ok: true, value: v, text: t + ' = ' + fmtEng(v, unit), unit: unit };
        } catch (e) { return { ok: false, value: NaN, why: TEXTS.eingabe, text: TEXTS.eingabe }; }
      }
    };
    formulas[id] = o; FORDER.push(id);
  }
  const pos_ = function (x) { return typeof x === 'number' && isFinite(x) && x > 0; };
  const nn_ = function (x) { return typeof x === 'number' && isFinite(x) && x >= 0; };
  def('ohm', 'Ohmsches Gesetz', 'U', 'U = R · I', 'V', [['R', 'Ω'], ['I', 'A']], '{0} · {1}', function (R, I) { return nn_(R) && nn_(I) ? R * I : NaN; });
  def('koerperStrom', 'Körperstrom', 'I_K', 'I_K = U / (R_K + R_v)', 'A', [['U', 'V'], ['R_K', 'Ω'], ['R_v', 'Ω']], '{0} / ({1} + {2})', function (u, rk, rv) { rv = rv === undefined ? 0 : rv; return nn_(u) && pos_(rk) && nn_(rv) ? u / (rk + rv) : NaN; }, function () { return TEXTS.rkRechenwert; });
  def('rLeiter', 'Leitungswiderstand', 'R', 'R = ρ · l / q (Kupfer ρ = 0,0178 oder 0,0172 Ω·mm²/m)', 'Ω', [['l', 'm'], ['q', 'mm²'], ['ρ', '#']], '{2} · {0} / {1}', function (l, q, rho) { rho = rho === undefined ? RHO : rho; return pos_(l) && pos_(q) && pos_(rho) && rho < 0.1 ? rho * l / q : NaN; });
  def('zs', 'Schleifenimpedanz', 'Zs', 'Zs = Zv + R_L + R_PE', 'Ω', [['Zv', 'Ω'], ['R_L', 'Ω'], ['R_PE', 'Ω']], '{0} + {1} + {2}', function (zv, rl, rpe) { return nn_(zv) && nn_(rl) && nn_(rpe) ? zv + rl + rpe : NaN; });
  def('iF', 'Fehlerstrom', 'I_F', 'I_F = U0 / Zs', 'A', [['U0', 'V'], ['Zs', 'Ω']], '{0} / {1}', function (u0, zs) { return nn_(u0) && pos_(zs) ? u0 / zs : NaN; });
  def('ia', 'Auslösestrom', 'Ia', 'Ia = Faktor · In (B: 5, C: 10, D: 20)', 'A', [['Faktor', '#'], ['In', 'A']], '{0} · {1}', function (k, In) { return pos_(k) && pos_(In) ? k * In : NaN; });
  def('zsMax', 'Größte Schleifenimpedanz', 'Zs_max', 'Zs ≤ U0 / Ia', 'Ω', [['U0', 'V'], ['Ia', 'A']], '{0} / {1}', function (u0, ia) { return pos_(u0) && pos_(ia) ? u0 / ia : NaN; });
  def('maxL', 'Größte Leitungslänge', 'l_max', 'l_max = (Zs_max − Zv) / (ρ · (1/q + 1/q_PE))', 'm', [['Zs_max', 'Ω'], ['Zv', 'Ω'], ['q', 'mm²'], ['q_PE', 'mm²'], ['ρ', '#']], '({0} − {1}) / ({4} · (1/{2} + 1/{3}))',
    function (zm, zv, q, qpe, rho) { qpe = qpe === undefined || qpe === null ? q : qpe; rho = rho === undefined ? RHO : rho; return pos_(zm) && nn_(zv) && pos_(q) && pos_(qpe) && pos_(rho) && zm > zv ? (zm - zv) / (rho * (1 / q + 1 / qpe)) : NaN; },
    function (zm, zv) { return pos_(zm) && nn_(zv) && zm <= zv ? 'Schon die Netzimpedanz ' + fmtEng(zv, 'Ω') + ' ist nicht kleiner als Zs_max = ' + fmtEng(zm, 'Ω') + ': Es gibt keine zulässige Länge.' : TEXTS.eingabe; });
  def('uB', 'Berührungsspannung', 'U_B', 'U_B = I_F · R_PE', 'V', [['I_F', 'A'], ['R_PE', 'Ω']], '{0} · {1}', function (i, r) { return nn_(i) && nn_(r) ? i * r : NaN; });
  def('raTT', 'Größter Erdungswiderstand (TT)', 'R_A,max', 'R_A ≤ U_L / IΔn', 'Ω', [['U_L', 'V'], ['IΔn', 'A']], '{0} / {1}', function (ul, idn) { return pos_(ul) && pos_(idn) ? ul / idn : NaN; });
  def('ableit', 'Ableitstrom über einen Kondensator', 'I', 'I = 2π · f · C · U', 'A', [['C', 'F'], ['U', 'V'], ['f', 'Hz']], '2π · {2} · {0} · {1}', function (c, u, f) { return nn_(c) && nn_(u) && nn_(f) ? E.leak.y(c, u, f) : NaN; });
  def('cMax', 'Größte Kapazität bei Grenzstrom', 'C_max', 'C = I / (2π · f · U)', 'F', [['I', 'A'], ['U', 'V'], ['f', 'Hz']], '{0} / (2π · {2} · {1})', function (i, u, f) { return nn_(i) && pos_(u) && pos_(f) ? i / (TWO_PI * f * u) : NaN; });
  def('iIso', 'Strom durch die Isolation', 'I', 'I = U_prüf / R_iso', 'A', [['U_prüf', 'V'], ['R_iso', 'Ω']], '{0} / {1}', function (u, r) { return nn_(u) && pos_(r) ? u / r : NaN; });
  def('rParallel', 'Parallelschaltung', 'R', '1/R = 1/R1 + 1/R2 + …', 'Ω', [['R1', 'Ω'], ['R2', 'Ω']], '1 / (1/{0} + 1/{1})', function () {
    const a = Array.prototype.slice.call(arguments);
    if (a.length < 2 || a.length > 50) return NaN;
    let g = 0;
    for (let i = 0; i < a.length; i++) { if (!pos_(a[i])) return NaN; g += 1 / a[i]; }
    return 1 / g;
  });
  def('rcdSum', 'Summe der Ableitströme', 'I_ab', 'I_ab = I1 + I2 + I3 + …', 'A', [['I1', 'A'], ['I2', 'A'], ['I3', 'A']], '{0} + {1} + {2}', function () {
    const a = Array.prototype.slice.call(arguments);
    if (!a.length || a.length > 50) return NaN;
    let s = 0;
    for (let i = 0; i < a.length; i++) { if (!nn_(a[i])) return NaN; s += a[i]; }
    return s;
  });
  def('rcdRatio', 'Verhältnis zum Nennfehlerstrom', 'r', 'r = I_ab / IΔn', '', [['I_ab', 'A'], ['IΔn', 'A']], '{0} / {1}', function (s, idn) { return nn_(s) && pos_(idn) ? s / idn : NaN; });
  def('ibNenn', 'Betriebsstrom aus der Leistung', 'Ib', 'Ib = P / (U · cos φ), hier cos φ = 1', 'A', [['P', 'W'], ['U', 'V'], ['cos φ', '#']], '{0} / ({1} · {2})', function (p, u, cp) { cp = cp === undefined ? 1 : cp; return nn_(p) && pos_(u) && pos_(cp) && cp <= 1 ? p / (u * cp) : NaN; });
  def('izCheck', 'Leitungsschutz', 'Ib ≤ In ≤ Iz', 'Ib ≤ In ≤ Iz (Ergebnis 1 = erfüllt, 0 = verletzt)', '', [['Ib', 'A'], ['In', 'A'], ['Iz', 'A']], 'Ib ≤ In ≤ Iz mit {0}, {1}, {2}', function (ib, In, iz) { const r = E.prot.check(ib, In, iz); return r && r.ok === true ? 1 : (r && r.ok === false && !r.why ? 0 : NaN); });
  def('energie', 'Energie (nicht benutzt)', 'W', 'W = P · t', 'J', [['P', 'W'], ['t', 's']], '{0} · {1}', function (p, t) { return nn_(p) && nn_(t) ? p * t : NaN; });
  formulas.list = function () { return FORDER.map(function (id) { return formulas[id]; }); };
  hide(formulas, 'list', formulas.list);
  E.extend('formulas', formulas);
  /* =============================== 4.11 Uebungen (exercise) =============================== */
  const KINDS = ['koerperStrom', 'rLeiter', 'zs', 'iF', 'ia', 'zsMax', 'maxL', 'uB', 'raTT', 'ableit', 'cMax', 'iIso', 'rParallel', 'rcdSum', 'ibNenn'];
  const E6 = [1, 1.5, 2.2, 3.3, 4.7, 6.8];
  const LSF = { 'LS-B': 5, 'LS-C': 10, 'LS-D': 20 };
  function lsFaktorText(dev) { return 'Typ ' + dev.slice(3) + ': sichere Auslösung bei ' + fmt(LSF[dev]) + ' · In, ' + U.statusTag(L(dev === 'LS-B' ? 'faktor_b' : 'ls_bcd')); }
  function mk(kind, R) {
    const pick = function (a) { return a[Math.min(a.length - 1, Math.floor(R.next() * a.length))]; };
    const o = { fehler: [], alt: [], tol: 0.03, scale: 1, steps: [], given: {}, hinweis: '' };
    function rhoTxt() { return 'Kupfer mit ρ = ' + fmt(RHO) + ' Ω·mm²/m; ' + fmt(RHO_ALT) + ' ist ebenfalls zulässig'; }
    function om(x) { return fmt(Number(Number(x).toPrecision(4))) + ' Ω'; }
    function lv(id) { return limitText(id).replace(/^[≤≥] /, ''); }
    if (kind === 'koerperStrom') {
      const Uv = pick([24, 50, 120, 230, 400]), rv = pick([0, 500, 1000, 2000, 4000]);
      const I = E.body.current(Uv, { haut: 'rechen', rv: rv }), rg = 1000 + rv;
      o.question = 'Ein Mensch berührt eine Spannung von ' + fmt(Uv) + ' V. Der Körperwiderstand beträgt 1 kΩ (Rechenwert für Aufgaben), der Übergangswiderstand von Boden und Schuhen ' + fmtEng(rv, 'Ω') + '. Berechne den Körperstrom.';
      o.given = { U: Uv, rk: 1000, rv: rv };
      o.si = I; o.unit = 'mA'; o.scale = 1e-3;
      o.steps = ['R_ges = R_K + R_v = ' + fmtEng(1000, 'Ω') + ' + ' + fmtEng(rv, 'Ω') + ' = ' + fmtEng(rg, 'Ω'), 'I_K = U / R_ges = ' + fmt(Uv) + ' V / ' + fmtEng(rg, 'Ω') + ' = ' + fmtEng(I, 'A')];
      if (rv > 0) o.fehler.push({ si: Uv / 1000, text: 'Du hast den Übergangswiderstand vergessen: R_ges = R_K + R_v.' });
      o.hinweis = TEXTS.rkRechenwert;
    } else if (kind === 'rLeiter') {
      const l = pick([5, 10, 15, 20, 25, 30, 40, 50]), q = pick([1.5, 2.5, 4, 6]);
      const rl = formulas.rLeiter.fn(l, q, RHO);
      o.question = 'Eine Leitung aus ' + rhoTxt() + ' ist ' + fmt(l) + ' m lang und hat ' + fmt(q) + ' mm². Berechne den Widerstand eines Leiters (nur Hinweg).';
      o.given = { l: l, q: q, rho: RHO };
      o.si = rl; o.unit = 'Ω'; o.alt = [formulas.rLeiter.fn(l, q, RHO_ALT)];
      o.steps = ['R = ρ · l / q = ' + fmt(RHO) + ' · ' + fmt(l) + ' / ' + fmt(q) + ' = ' + om(rl)];
      o.fehler.push({ si: 2 * rl, text: 'Du hast Hin- und Rückleiter gerechnet; gefragt ist ein einzelner Leiter.' });
    } else if (kind === 'zs') {
      const zv = pick([0.3, 0.4, 0.5]), l = pick([10, 15, 20, 25, 30, 40]), q = pick([1.5, 2.5, 4, 6]);
      const lp = E.grid.loop({ form: 'TN-S', zv: zv, q: q, l: l, rho: RHO });
      o.question = 'In einem TN-S-System beträgt die Netzimpedanz Zv = ' + om(zv) + '. Die Leitung (' + rhoTxt() + ') ist ' + fmt(l) + ' m lang, Außenleiter und Schutzleiter haben je ' + fmt(q) + ' mm². Berechne die Schleifenimpedanz Zs.';
      o.given = { zv: zv, l: l, q: q, qpe: q };
      o.si = lp.zs; o.unit = 'Ω'; o.tol = 0.02;
      o.alt = [E.grid.loop({ form: 'TN-S', zv: zv, q: q, l: l, rho: RHO_ALT }).zs];
      o.steps = ['R_L = R_PE = ρ · l / q = ' + om(lp.rl), 'Zs = Zv + R_L + R_PE = ' + om(zv) + ' + ' + om(lp.rl) + ' + ' + om(lp.rpe) + ' = ' + om(lp.zs)];
      o.fehler.push({ si: zv + lp.rl, text: 'Du hast nur den Hinleiter gerechnet: Die Fehlerschleife besteht aus Außenleiter und Schutzleiter, also doppelte Leitungslänge.' });
      o.fehler.push({ si: lp.rl + lp.rpe, text: 'Du hast die Netzimpedanz Zv vergessen: Sie gehört zur Schleife.' });
    } else if (kind === 'iF') {
      const zs = pick([0.45, 0.6, 0.8, 1, 1.2, 1.5, 2]);
      const I = formulas.iF.fn(U0, zs);
      o.question = 'Die Schleifenimpedanz beträgt Zs = ' + om(zs) + ' bei U0 = ' + fmt(U0) + ' V. Berechne den Fehlerstrom I_F.';
      o.given = { zs: zs, U0: U0 };
      o.si = I; o.unit = 'A';
      o.steps = ['I_F = U0 / Zs = ' + fmt(U0) + ' V / ' + om(zs) + ' = ' + fmtEng(I, 'A')];
      o.fehler.push({ si: U0 * zs, text: 'Du hast multipliziert statt geteilt: I = U / Z.' });
    } else if (kind === 'ia') {
      const dev = pick(['LS-B', 'LS-C', 'LS-D']), In = pick([6, 10, 13, 16, 20, 25, 32]);
      const ia = E.prot.ia(dev, In);
      o.question = 'Ein Leitungsschutzschalter ' + dev + ' hat den Nennstrom In = ' + fmt(In) + ' A. Für die sichere Abschaltung gilt der obere Grenzwert des magnetischen Bereichs (' + lsFaktorText(dev) + '). Berechne den Auslösestrom Ia.';
      o.given = { dev: dev, In: In, faktor: LSF[dev] };
      o.si = ia; o.unit = 'A'; o.tol = 0.02;
      o.steps = ['Ia = Faktor · In = ' + fmt(LSF[dev]) + ' · ' + fmt(In) + ' A = ' + fmtEng(ia, 'A')];
      o.fehler.push({ si: LSF[dev], text: 'Du hast den Nennstrom vergessen: Ia = Faktor · In.' });
      Object.keys(LSF).forEach(function (d) { if (d !== dev) o.fehler.push({ si: LSF[d] * In, text: 'Du hast den Faktor des Typs ' + d.slice(3) + ' (' + fmt(LSF[d]) + ' · In) genommen; der ' + dev + ' hat ' + fmt(LSF[dev]) + ' · In.' }); });
    } else if (kind === 'zsMax') {
      const dev = pick(['LS-B', 'LS-C', 'LS-D']), In = pick([6, 10, 13, 16, 20, 25, 32]);
      const zm = E.grid.zsMax(dev, In), ia = E.prot.ia(dev, In);
      o.question = 'In einem TN-System (U0 = ' + fmt(U0) + ' V) wird ein Leitungsschutzschalter ' + dev + ' mit In = ' + fmt(In) + ' A eingesetzt (' + lsFaktorText(dev) + '). Wie groß darf die Schleifenimpedanz höchstens sein?';
      o.given = { dev: dev, In: In, U0: U0, faktor: LSF[dev] };
      o.si = zm; o.unit = 'Ω'; o.tol = 0.02;
      o.steps = ['Ia = ' + fmt(LSF[dev]) + ' · ' + fmt(In) + ' A = ' + fmtEng(ia, 'A'), 'Zs ≤ U0 / Ia = ' + fmt(U0) + ' V / ' + fmtEng(ia, 'A') + ' = ' + om(zm)];
      o.fehler.push({ si: U0 / In, text: 'Du hast durch In geteilt statt durch Ia: Ia = Faktor · In.' });
      Object.keys(LSF).forEach(function (d) { if (d !== dev) o.fehler.push({ si: U0 / (LSF[d] * In), text: 'Du hast den Faktor des Typs ' + d.slice(3) + ' (' + fmt(LSF[d]) + ' · In) genommen; der ' + dev + ' hat ' + fmt(LSF[dev]) + ' · In.' }); });
    } else if (kind === 'maxL') {
      let dev, In, q, zv, ml = null, tries = 0;
      do {
        dev = pick(['LS-B', 'LS-C', 'LS-D']); In = pick([10, 13, 16, 20, 25, 32]); q = pick([1.5, 2.5, 4, 6]); zv = pick([0.3, 0.4, 0.5]);
        ml = E.grid.maxLength({ form: 'TN-S', dev: dev, In: In, q: q, zv: zv, rho: RHO });
        tries++;
      } while ((!ml.ok || !ml.valid || ml.lMax < 5) && tries < 60);
      o.question = 'In einem TN-S-System (U0 = ' + fmt(U0) + ' V, Netzimpedanz Zv = ' + om(zv) + ') schützt ein ' + dev + ' mit In = ' + fmt(In) + ' A eine Leitung (' + rhoTxt() + ') mit ' + fmt(q) + ' mm² für Außenleiter und Schutzleiter (' + lsFaktorText(dev) + '). Wie lang darf die Leitung höchstens sein?';
      o.given = { dev: dev, In: In, q: q, zv: zv, faktor: LSF[dev] };
      o.si = ml.lMax; o.unit = 'm';
      o.alt = [E.grid.maxLength({ form: 'TN-S', dev: dev, In: In, q: q, zv: zv, rho: RHO_ALT }).lMax];
      o.steps = ['Zs_max = U0 / Ia = ' + om(ml.zsMax), 'Für die Leitung bleiben Zs_max − Zv = ' + om(ml.frei), 'l_max = (Zs_max − Zv) / (ρ · (1/q + 1/q_PE)) = ' + fmt(ml.lMax, 1) + ' m'];
      o.fehler.push({ si: 2 * ml.lMax, text: 'Du hast nur einen Leiter gerechnet: Außenleiter und Schutzleiter liegen beide in der Schleife (doppelte Länge).' });
      o.fehler.push({ si: ml.zsMax / (2 * RHO / q), text: 'Du hast die Netzimpedanz Zv vergessen: Sie geht zuerst von Zs_max ab.' });
    } else if (kind === 'uB') {
      const zv = pick([0.3, 0.4, 0.5]), l = pick([10, 15, 20, 25, 30, 40]), q = pick([1.5, 2.5, 4, 6]);
      const g = E.grid.fault({ form: 'TN-S', zv: zv, q: q, l: l, rho: RHO, dev: 'LS-B', In: 16 });
      o.question = 'In einem TN-S-System (U0 = ' + fmt(U0) + ' V, Zv = ' + om(zv) + ') tritt an einer ' + fmt(l) + ' m langen Leitung (' + rhoTxt() + ', ' + fmt(q) + ' mm² für Außenleiter und Schutzleiter) ein Körperschluss auf. Berechne die Berührungsspannung U_B am Gehäuse (Spannungsabfall am Schutzleiter).';
      o.given = { zv: zv, l: l, q: q };
      o.si = g.uB; o.unit = 'V';
      o.alt = [E.grid.fault({ form: 'TN-S', zv: zv, q: q, l: l, rho: RHO_ALT, dev: 'LS-B', In: 16 }).uB];
      o.steps = ['Zs = ' + om(g.zs) + ', I_F = U0 / Zs = ' + fmtEng(g.iF, 'A'), 'U_B = I_F · R_PE = ' + fmtEng(g.iF, 'A') + ' · ' + om(g.rpe) + ' = ' + fmt(g.uB, 1) + ' V'];
      o.fehler.push({ si: g.iF * (g.rl + g.rpe), text: 'U_B fällt nur am Schutzleiter ab (R_PE), nicht an der ganzen Leitungsschleife.' });
    } else if (kind === 'raTT') {
      const idn = pick([30, 100, 300, 500]);
      const ra = E.grid.raMax(idn);
      o.question = 'Im TT-System gilt die Grenzspannung U_L = ' + lv('ul_ac') + '. Ein RCD hat den Nennfehlerstrom IΔn = ' + fmt(idn) + ' mA. Wie groß darf der Erdungswiderstand R_A höchstens sein?';
      o.given = { idn: idn, UL: UL };
      o.si = ra; o.unit = 'Ω';
      o.steps = ['R_A ≤ U_L / IΔn = ' + fmt(UL) + ' V / ' + fmt(idn / 1000) + ' A = ' + om(ra)];
      o.fehler.push({ si: U0 / (idn / 1000), text: 'Für die TT-Bedingung gilt die Grenzspannung 50 V, nicht 230 V.' });
      o.fehler.push({ si: UL / idn, text: 'Setze IΔn in A ein (mA durch 1000 teilen).' });
    } else if (kind === 'ableit') {
      const cn = pick(E6) * pick([1, 10]);
      const I = E.leak.y(cn * 1e-9, U0, F_NETZ);
      o.question = 'Ein Netzteil hat einen Y-Kondensator von ' + fmtEng(cn * 1e-9, 'F') + ' zwischen Netz und Gehäuse (U = ' + fmt(U0) + ' V, f = ' + fmt(F_NETZ) + ' Hz). Berechne den Ableitstrom.';
      o.given = { C: cn * 1e-9, U: U0, f: F_NETZ };
      o.si = I; o.unit = 'mA'; o.scale = 1e-3;
      o.steps = ['I = 2π · f · C · U = 2π · ' + fmt(F_NETZ) + ' Hz · ' + fmtEng(cn * 1e-9, 'F') + ' · ' + fmt(U0) + ' V = ' + fmtEng(I, 'A')];
      o.fehler.push({ si: F_NETZ * cn * 1e-9 * U0, text: 'Du hast den Faktor 2π vergessen: I = 2π · f · C · U.' });
    } else if (kind === 'cMax') {
      const lid = pick(['ber_sk2', 'ipe_sk1']), lim = L(lid);
      const C_ = formulas.cMax.fn(lim.value / 1000, U0, F_NETZ);
      o.question = 'Der Ableitstrom über einen Y-Kondensator soll höchstens ' + lv(lid) + ' betragen (U = ' + fmt(U0) + ' V, f = ' + fmt(F_NETZ) + ' Hz). Wie groß darf die Kapazität höchstens sein?';
      o.given = { I: lim.value / 1000, U: U0, f: F_NETZ, grenze: lid };
      o.si = C_; o.unit = 'nF'; o.scale = 1e-9;
      o.steps = ['C = I / (2π · f · U) = ' + fmtEng(lim.value / 1000, 'A') + ' / (2π · ' + fmt(F_NETZ) + ' Hz · ' + fmt(U0) + ' V) = ' + fmtEng(C_, 'F')];
      o.fehler.push({ si: lim.value / 1000 / (F_NETZ * U0), text: 'Du hast den Faktor 2π vergessen: C = I / (2π · f · U).' });
    } else if (kind === 'iIso') {
      const r = pick([0.5, 1, 2, 5, 10, 50]);
      const up = L('upruef_iso').value;
      const I = formulas.iIso.fn(up, r * 1e6);
      o.question = 'Bei der Isolationsmessung liegt die Prüfspannung ' + lv('upruef_iso') + ' am Prüfling, der Isolationswiderstand beträgt ' + fmt(r) + ' MΩ. Berechne den Messstrom.';
      o.given = { U: up, R: r * 1e6 };
      o.si = I; o.unit = 'µA'; o.scale = 1e-6;
      o.steps = ['I = U_prüf / R_iso = ' + fmt(up) + ' V / ' + fmtEng(r * 1e6, 'Ω') + ' = ' + fmtEng(I, 'A')];
      o.fehler.push({ si: up / r, text: 'Setze den Widerstand in Ω ein (MΩ mal 1 000 000).' });
    } else if (kind === 'rParallel') {
      const a = pick(E6) * pick([1, 10]), b = pick(E6) * pick([1, 10]);
      const rp = formulas.rParallel.fn(a * 1e3, b * 1e3);
      o.question = 'Zwei Leckpfade der Isolierung liegen parallel: ' + fmtEng(a * 1e3, 'Ω') + ' und ' + fmtEng(b * 1e3, 'Ω') + '. Berechne den Gesamtwiderstand.';
      o.given = { R1: a * 1e3, R2: b * 1e3 };
      o.si = rp; o.unit = 'kΩ'; o.scale = 1e3;
      o.steps = ['1/R = 1/R1 + 1/R2 = 1/' + fmtEng(a * 1e3, 'Ω') + ' + 1/' + fmtEng(b * 1e3, 'Ω'), 'R = ' + fmtEng(rp, 'Ω')];
      o.fehler.push({ si: (a + b) * 1e3, text: 'Das ist die Reihenschaltung. Bei parallelen Pfaden addieren sich die Leitwerte.' });
      o.fehler.push({ si: (a + b) / 2 * 1e3, text: 'Der Mittelwert ist nicht der Parallelwiderstand: 1/R = 1/R1 + 1/R2.' });
    } else if (kind === 'rcdSum') {
      const vals = [pick([0.5, 0.75, 1, 1.5]), pick([0.5, 1, 1.5, 2.5]), pick([1, 2, 3.5, 5])];
      const ls = E.rcd.leakSum(vals, { idn: 30 });
      o.question = 'Hinter einem RCD mit IΔn = 30 mA hängen drei Geräte mit den Ableitströmen ' + vals.map(function (v) { return fmt(v) + ' mA'; }).join(', ') + '. Berechne die Summe der Ableitströme.';
      o.given = { leak: vals, idn: 30 };
      o.si = ls.sum / 1000; o.unit = 'mA'; o.scale = 1e-3;
      o.steps = ['I_ab = ' + vals.map(function (v) { return fmt(v); }).join(' + ') + ' mA = ' + fmt(ls.sum, 2) + ' mA', 'Verhältnis zu IΔn: ' + fmt(ls.ratio, 2) + (ls.fehlausloesung ? ' (ab ' + fmt(L('rcd_bereich').value) + ' · IΔn ist eine Fehlauslösung möglich, Lehrfaustwert)' : ' (unter ' + fmt(L('rcd_bereich').value) + ' · IΔn)')];
      o.fehler.push({ si: ls.sum / 1000 / 3, text: 'Das ist der Mittelwert; die Ableitströme addieren sich.' });
    } else if (kind === 'ibNenn') {
      const P = pick([500, 1000, 1500, 2000, 2300, 3000, 3680]);
      const ib = formulas.ibNenn.fn(P, U0, 1);
      o.question = 'Ein Verbraucher nimmt ' + fmtEng(P, 'W') + ' bei ' + fmt(U0) + ' V auf (rechne mit cos φ = 1). Berechne den Betriebsstrom Ib.';
      o.given = { P: P, U: U0, cosphi: 1 };
      o.si = ib; o.unit = 'A';
      o.steps = ['Ib = P / (U · cos φ) = ' + fmtEng(P, 'W') + ' / (' + fmt(U0) + ' V · 1) = ' + fmtEng(ib, 'A')];
      o.fehler.push({ si: P * U0, text: 'Du hast multipliziert statt geteilt: Ib = P / U.' });
    }
    return o;
  }
  function within(a, b, tol) { return Math.abs(a - b) <= tol * Math.abs(b) + 1e-15; }
  function mkCheck(o, kind) {
    return function (input) {
      try {
        let q;
        if (typeof input === 'number') q = isFinite(input) ? { v: input, raw: input, hasUnit: false, unit: '' } : null;
        else q = typeof input === 'string' ? E.parseQty(input) : null;
        if (!q || !isFinite(q.v)) return { ok: false, text: TEXTS.keineZahl, why: TEXTS.keineZahl, richtung: null, art: 'keine-zahl' };
        const targets = [o.si].concat(o.alt);
        const weg = 'Rechenweg: ' + o.steps.join('; ');
        const vS = q.hasUnit ? q.v : q.raw * o.scale;
        if (targets.some(function (t) { return within(vS, t, o.tol); })) return { ok: true, text: 'Richtig: ' + fmt(o.si / o.scale, 4) + ' ' + o.unit + '.', why: '', richtung: null, art: 'ok' };
        if (!q.hasUnit && o.scale !== 1 && targets.some(function (t) { return within(q.raw, t, o.tol); })) return { ok: true, text: 'Richtig, schreibe die Einheit dazu: ' + fmt(o.si / o.scale, 4) + ' ' + o.unit + '.', why: '', richtung: null, art: 'einheit-fehlt' };
        for (let i = 0; i < o.fehler.length; i++) {
          const f = o.fehler[i];
          if (within(vS, f.si, o.tol)) return { ok: false, text: f.text, why: weg, richtung: vS < o.si ? 'zu klein' : 'zu gross', art: 'typisch' };
        }
        let best = targets[0], bd = Infinity;
        targets.forEach(function (t) { const d = Math.abs(Math.log(Math.max(vS, 1e-300) / t)); if (d < bd) { bd = d; best = t; } });
        const r = vS / best;
        if (r > 0) {
          const lg = Math.log10(r), k = Math.round(lg);
          if (k !== 0 && Math.abs(lg - k) < 0.015 && Math.abs(k) <= 9) return { ok: false, text: 'Dein Wert ist um den Faktor ' + fmt(Math.pow(10, k)) + ' daneben. Prüfe den Vorsatz: mA oder A, Ω, kΩ oder MΩ, nF oder µF.', why: weg, richtung: k < 0 ? 'zu klein' : 'zu gross', art: 'vorsatz' };
        }
        if (['zs', 'maxL', 'uB', 'rLeiter'].indexOf(kind) >= 0) {
          const r2 = vS / best;
          if (Math.abs(r2 - 2) < 0.06 || Math.abs(r2 - 0.5) < 0.03) return { ok: false, text: 'Dein Wert ist halb oder doppelt so groß wie erwartet (Faktor 2). Prüfe, ob du Hin- und Rückleiter (Außenleiter und Schutzleiter) richtig berücksichtigt hast.', why: weg, richtung: r2 < 1 ? 'zu klein' : 'zu gross', art: 'faktor2' };
        }
        if (vS < best) return { ok: false, text: 'Dein Wert ist zu klein. ' + (o.hinweis ? o.hinweis + ' ' : '') + 'Prüfe den Rechenweg.', why: weg, richtung: 'zu klein', art: 'zu-klein' };
        return { ok: false, text: 'Dein Wert ist zu groß. ' + (o.hinweis ? o.hinweis + ' ' : '') + 'Prüfe den Rechenweg.', why: weg, richtung: 'zu gross', art: 'zu-gross' };
      } catch (e) { return { ok: false, text: TEXTS.eingabe, why: TEXTS.eingabe, richtung: null, art: 'fehler' }; }
    };
  }
  const exercise = S(function (kind, seed) {
    const k = String(kind);
    if (KINDS.indexOf(k) < 0) V('Unbekannte Übungsart „' + k + '“. Erlaubt: ' + KINDS.join(', ') + '.');
    const sd = isFinite(num(seed, NaN)) ? Math.floor(num(seed, 1)) : 1;
    const R = E.rng(sd * 7919 + KINDS.indexOf(k) * 104729 + 13);
    const o = mk(k, R);
    const rev = { kind: k, seed: sd, question: o.question, given: o.given, answer: { value: o.si / o.scale, unit: o.unit, tol: o.tol, alt: o.alt.map(function (a) { return a / o.scale; }), si: o.si, scale: o.scale }, steps: o.steps.slice(), hinweis: o.hinweis };
    rev.ok = true;
    const chk = mkCheck(o, k);
    rev.check = chk;
    return rev;
  });
  exercise.kinds = KINDS.slice();
  E.extend('exercise', exercise);

  /* =============================== 4.12 Laeufer (runSeq) =============================== */
  function collectKeys(list, map) {
    if (!isArr(list)) return;
    list.forEach(function (c) {
      if (c && typeof c.key === 'string') map[c.key] = c;
      if (c && isArr(c.items)) collectKeys(c.items, map);
      if (c && isArr(c.controls)) collectKeys(c.controls, map);
    });
  }
  function runSeq(rigIn, seq, tEndS, opts) {
    opts = isObj(opts) ? opts : {};
    const out = { ok: true, samples: [], final: null, events: [], faults: [], assess: null, errors: [], rejected: [], actions: [], order: [] };
    let rig = null;
    try {
      const seedOpt = isFinite(num(opts.seed, NaN)) ? num(opts.seed, 1) : undefined;
      if (typeof rigIn === 'function') rig = rigIn(seedOpt);
      else if (typeof rigIn === 'string') {
        const Rr = root.ELS_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'ELS_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && typeof rigIn.setControl === 'function') {
        rig = rigIn; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { out.ok = false; if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); return out; }
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const tEnd = clamp(num(tEndS, 0), 0, 1e6);
    const sampleS = Math.max(tEnd / 20000, num(opts.sampleS, 0) > 0 ? num(opts.sampleS, 0) : (tEnd / 200 || 1));
    const faultSet = {};
    function collect(st) { if (st && isArr(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } }); }
    function setCtl(key, v) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '“ gibt es an dieser Anlage nicht.'); return; }
      let r;
      try { r = rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); return; }
      if (r === false) out.rejected.push({ key: key, value: v });
    }
    function doAction(name, t) {
      let okA = false;
      try {
        if (typeof rig.do === 'function') okA = rig.do(name) !== false;
        else if (typeof rig.act === 'function') okA = rig.act(name) !== false;
        else if (typeof rig.doStep === 'function') okA = rig.doStep(name) !== false;
        else {
          setCtl('schritt', name);
          if (typeof rig.fire === 'function') { rig.fire(); okA = true; } else out.errors.push('Dieser Prüfstand kennt keine Schritte (act oder fire).');
        }
      } catch (e) { out.errors.push('do(' + name + '): ' + (e && e.message)); }
      out.actions.push({ t: t, do: name, ok: okA });
      out.order.push(name);
    }
    if (isObj(opts.controls)) Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, i) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: isObj(e.set) ? e.set : null, ramp: isObj(e.ramp) ? e.ramp : null, fire: !!e.fire, act: typeof e.do === 'string' ? e.do : null, k: i });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    const ramps = [];
    let t = 0, qi = 0, nextSample = 0;
    function takeSample() {
      let st = null, m = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      try { m = typeof rig.readMeters === 'function' ? rig.readMeters() : null; } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
      out.samples.push({ t: t, meters: snap(m), state: snap(st) });
      collect(st);
    }
    for (let guardN = 0; guardN < 200000; guardN++) {
      while (qi < q.length && q[qi].t <= t + 1e-9) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k]); });
        if (e.ramp && typeof e.ramp.key === 'string') {
          let from = NaN;
          try { from = typeof rig.getControl === 'function' ? num(rig.getControl(e.ramp.key), NaN) : NaN; } catch (er) { /* */ }
          const to = num(e.ramp.to, NaN), dur = num(e.ramp.durS, 0);
          if (!isFinite(to)) out.errors.push('Rampe für „' + e.ramp.key + '“ hat keinen Zielwert.');
          else if (!(dur > 0) || !isFinite(from)) setCtl(e.ramp.key, to);
          else ramps.push({ key: e.ramp.key, from: from, to: to, t0: t, dur: dur, log: known[e.ramp.key] && known[e.ramp.key].scale === 'log' && from > 0 && to > 0 });
        }
        if (e.act) doAction(e.act, e.t);
        if (e.fire) {
          try { if (typeof rig.fire === 'function') rig.fire(); else out.errors.push('Dieser Prüfstand hat keine Auslösung (fire).'); } catch (er) { out.errors.push('fire(): ' + (er && er.message)); }
        }
      }
      for (let i = ramps.length - 1; i >= 0; i--) {
        const r = ramps[i], fr = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(r.key, r.log ? r.from * Math.pow(r.to / r.from, fr) : r.from + (r.to - r.from) * fr);
        if (fr >= 1) ramps.splice(i, 1);
      }
      if (t >= nextSample - 1e-9) { takeSample(); nextSample += sampleS; }
      if (t >= tEnd - 1e-9) break;
      let tn = Math.min(nextSample, tEnd);
      if (qi < q.length) tn = Math.min(tn, q[qi].t);
      if (ramps.length) { let rd = Infinity; ramps.forEach(function (r) { rd = Math.min(rd, r.dur / 50); }); tn = Math.min(tn, t + Math.max(rd, tEnd / 20000)); }
      let dt = tn - t;
      if (!(dt > 1e-12)) dt = Math.max(1e-6, tEnd / 20000);
      try { if (typeof rig.step === 'function') rig.step(dt * 1000); } catch (e) { out.errors.push('step(): ' + (e && e.message)); break; }
      t += dt;
    }
    try { out.final = snap(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.assess = typeof rig.assess === 'function' ? snap(rig.assess()) : null; } catch (e) { out.errors.push('assess(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snap) : []; } catch (e) { /* */ }
    if (opts.keepRig) out.rig = rig;
    return out;
  }
  E.extend('runSeq', function () {
    try { return runSeq.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], assess: null, errors: ['Interner Fehler im Läufer.'], rejected: [], actions: [], order: [] }; }
  });

  if (typeof module !== 'undefined') module.exports = E;
})(typeof window !== 'undefined' ? window : globalThis);
