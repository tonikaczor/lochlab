/* anacore-res.js - ANA-Lab Kern Teil 3 (ANA_CORE: report, assess, diagnose, formulas, exercise, runSeq, faults)
 * Haengt sich per ANA_CORE.extend(...) an anacore.js (Teil 1) und nutzt anacore-op.js (Teil 2: op, komp, act, deep) zur Laufzeit.
 * Reine Rechnung, keine DOM-Zugriffe, Node-ladbar (require('./anacore-res.js') liefert den vollstaendigen Kern). Alle Funktionen werfen nie.
 * Alle Bauteil- und Anlagenwerte sind Uebungswerte (Lehrmodelle). Simulation fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung.
 * Ist anacore-op.js nicht vorhanden, greift in Node (require mit try/catch) ein Rueckfall auf stub/stubcore.js fuer op, komp, act, deep (nur Entwicklung).
 *
 * ===================================================================================================
 * SIGNATUREN (SPEC 4.9 bis 4.12, VERTRAG 4.0; hier die Festlegungen, die dort offen waren)
 *  ZUSTAND (state / ctx.ctl): flaches Objekt der Steuerwerte des Pruefstands (Schluessel wie SPEC 5.1 bis 5.8, SI-Einheiten, wie rig.getControls()),
 *     einschliesslich des Auswahlfelds fehler (Optionstext wie 'rb offen'; auch 'rb_offen' wird gelesen) und der ziel...-Schluessel (0 = keine Vorgabe).
 *     Fehlende Schluessel nehmen den Standardwert der SPEC. Der Kern setzt den Fehlerfall selbst in Eingaben um (Tabelle SPEC 5.1 bis 5.8) und ruft dann
 *     denselben Kern wie die Rigs: ANA_CORE.rig.model(rigId, ctl) -> { ok, rigId, ctl, fehler, fehlerId, eff, r, ... } (Rigs duerfen es benutzen).
 *     Lastwiderstaende am oberen Anschlag (>= 1e6 Ohm) bedeuten Leerlauf (R_OFFEN). Einheiten der ziel-Schluessel: diode/schalter A, emitter zielUce V und
 *     zielVu (Betrag), folger ziel je Betriebsart (signal: r_aus in Ohm, zener: U_E in V, konstantstrom: I_C in mA), opv_inv/opv_nin zielV (Betrag),
 *     opv_komp zielUh in V und zielF in Hz, opv_aktiv zielF in Hz.
 *  assess(rigId, state) -> { ok, valid, ampel:'gruen'|'gelb'|'rot'|'grau', text, margin?, ziel?, punkte:[{name,ist,soll,abw,ampel,text}] }
 *  diagnose(ctx) -> [{ id, kind:'info'|'warn'|'error', text, bedingung:true, gegenprobe:true }]
 *     ctx = { rigId, ctl, verdeckt? }  Zustandsdiagnose; verdeckt:true liefert NUR Messbefunde (Ids 'messung-...'), nie den Fehlerfall.
 *     ctx = { kind, seed|given, antwort }  Antwortdiagnose zu exercise (liefert die erkannten Rechenfehler als Meldungen).
 *     diagnose.catalog = { rigId: [ids...] }  alle Meldungs-Ids je Anlage (fuer Tests und UI).
 *  formulas.<id>(...) rechnet positionell in SI (NaN bei Unsinn); formulas.list() -> [{ id, name, symbol, expr, unit, args:[{key,label,unit,def}], fn, run, explain }]
 *     run(objekt | positionell) -> { ok, value, unit, text, why? }; formulas.get(id).
 *  exercise(kind, seed) -> { ok, kind, seed, question, given, answer:{ value, unit, tol, alt:[] }, steps:[], check(input) -> { ok, why, text } }
 *     exercise.kinds, exercise.solve(kind, given) -> { ok, value, unit, alt, wrong:[{id,value,text}] }
 *  report.template, report.generate(rigId, state, seed) -> { ok, valid, rigId, seed, spalten, rows:[{x,y,y2?}], entry, ref, hinweis }  (idealer OPV: valid:false)
 *     report.check(entry, ref) -> { ok, valid, passt, items, abweichungen, text }   report.csv(entry) -> { ok, text }   report.parseCsv(text) -> { ok, entry, rows }
 *  runSeq(rigFactory|rigId|rig, seq, tEndS, opts?) -> { ok, samples, final, events, faults, assess, errors, rejected, actions, order }
 *     seq = [ {t,set}, {t,ramp:{key,to,durS}}, {t,fire:true}, {t,do:'name'} ]  (rig.do bevorzugt, sonst rig.act/doStep)
 *  faults.list(rigId) / faults.predict(rigId, faultId, ctl?) -> { ok, meas, diag:[ids], text }   Fehlerkatalog je Anlage (SPEC 5.1 bis 5.8)
 *  diagGrenzen: Lehrfaustwerte der Diagnose und der Aufgabenpruefung (Status A, Fragenummer), nicht in limits (Teil 1)
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  let C = root.ANA_CORE;
  if (typeof require === 'function') { try { C = require('./anacore.js'); } catch (e) { /* Browser: Kern bereits geladen */ } }
  if (!C || !C.util || typeof C.extend !== 'function' || C.__stub) {
    if (typeof console !== 'undefined') console.warn('anacore-res.js: ANA_CORE (anacore.js) fehlt, Teil 3 wird nicht registriert.');
    return;
  }
  /* Teil 2 (op, komp, act, deep): echt, sonst (nur Node, nur Entwicklung) Rueckfall auf den Stub */
  if (!C.op && typeof require === 'function') { try { require('./anacore-op.js'); } catch (e) { /* noch nicht vorhanden */ } }
  if (!(C.op && C.komp && C.act && C.deep) && typeof require === 'function') {
    try {
      const STUBP = '../quelle/analab/stub/stubcore.js';
      const keep = root.ANA_CORE;
      let ST = null;
      try { root.ANA_CORE = undefined; ST = require(STUBP); } finally { root.ANA_CORE = keep; }
      if (!ST || !ST.op) {
        try { delete require.cache[require.resolve(STUBP)]; } catch (e2) { /* */ }
        try { root.ANA_CORE = undefined; ST = require(STUBP); } finally { root.ANA_CORE = keep; }
      }
      if (ST && ST.op) {
        ['op', 'komp', 'act', 'deep'].forEach(function (k) { if (!C[k] && ST[k]) C.extend(k, ST[k]); });
        Object.defineProperty(C, '__opStub', { value: true, enumerable: false, configurable: true });
      }
    } catch (e) { /* kein Stub: op/komp/act/deep fehlen, die betroffenen Funktionen melden ok:false */ }
  }
  const U = C.util;
  const num = U.num, clamp = U.clamp, fin = U.fin, isArr = U.isArr, isObj = U.isObj, fail = U.fail, V = U.V, hide = U.hide;
  const reqObj = U.reqObj, reqPos = U.reqPos, reqNn = U.reqNn, reqFin = U.reqFin;
  const CG = U.C, SG = U.S, LV = U.LV, TWO_PI = U.TWO_PI, DEG = U.DEG;
  const R_OFFEN = C.R_OFFEN, R_KURZ = C.R_KURZ;
  const fmt = C.fmt, fe = C.fmtEng, TEXTS = C.TEXTS;
  const parseNum = C.parseNum;
  function snap(o) { try { return o === undefined ? null : JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function obj(o) { return isObj(o) ? o : {}; }
  function lg(x) { return Math.log(x) / Math.LN10; }
  function pc(x, d) { return fmt(x * 100, d === undefined ? 1 : d) + ' %'; }
  function par(a, b) { return a * b / (a + b); }
  function fu(x, unit) { return fe(x, unit); }
  function sgn(x) { return x < 0 ? -1 : 1; }
  function bool(v, d) {
    if (v === undefined || v === null) return d;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    const s = String(v).trim().toLowerCase();
    if (s === 'ja' || s === 'true' || s === '1' || s === 'an' || s === 'ein') return true;
    if (s === 'nein' || s === 'false' || s === '0' || s === 'aus') return false;
    return d;
  }
  function limN(id) { return LV(id); }
  function limT(id) { return C.limitText(id).replace(/^[≤≥]\s*/, ''); }
  function needOk(r, what) {
    if (!r || r.ok !== true) V(r && r.why ? r.why : (what || 'Mit diesen Eingaben gibt es kein Ergebnis.'));
    return r;
  }
  function call(fn, a, b, c) { try { return typeof fn === 'function' ? fn(a, b, c) : fail('Die Funktion fehlt.'); } catch (e) { return fail('Rechenfehler.'); } }
  const KOP = function () { return C.op || {}; }, KKO = function () { return C.komp || {}; }, KAC = function () { return C.act || {}; };

  /* =============================== Lehrfaustwerte der Diagnose und der Aufgabenpruefung (Status A) =============================== */
  const GRENZEN_RAW = [
    ['ue_stark', 10, '', 'A', 'F5', 'Übersteuerungsfaktor, ab dem der Hinweis auf die Ausschaltverzögerung kommt'],
    ['gbw_anteil', 0.5, '', 'A', 'F16', 'Anteil der Grenzfrequenz, ab dem der Verstärkungsabfall gemeldet wird'],
    ['z_iz_faktor', 1, '', 'A', 'F22', 'Faktor auf den Basisstrom, unter dem der Z-Strom am Emitterfolger als zu klein gemeldet wird'],
    ['led_rv_kurz', 10, 'Ω', 'A', 'F2', 'Vorwiderstand der LED, bis zu dem "ohne Vorwiderstand" gemeldet wird'],
    ['aufgabe_tol', 0.03, '', 'A', 'F16', 'Relative Toleranz der Rechenaufgaben (Tabellenbuch-Rundungen)'],
    ['aufgabe_tol_fg', 0.05, '', 'A', 'F16', 'Relative Toleranz der Aufgaben zu Grenzfrequenzen'],
    ['report_tol', 0.03, '', 'A', 'F16', 'Relative Toleranz der Messreihen-Kontrolle'],
    ['report_rauschen', 0.01, '', 'A', 'F16', 'Rauschen der erzeugten Messreihe (nur Darstellung)']
  ];
  const diagGrenzen = GRENZEN_RAW.map(function (r) { return Object.freeze({ id: r[0], value: r[1], unit: r[2], status: r[3], frage: r[4], text: r[5] }); });
  const GV = function (id) { for (let i = 0; i < diagGrenzen.length; i++) if (diagGrenzen[i].id === id) return diagGrenzen[i].value; return NaN; };
  const UEBUNG = ' (Lehrfaustwert, Übungswert)';

  /* =============================== Pruefstands-Modelle (Fehlerfall-Umsetzung und Kernaufruf) =============================== */
  const DEF = {
    diode: { typ: 'led_rot', modell: 'kennlinie', uq: 5, rv: 330, uz: 5.1, rlast: 1e6, temp: 27, fehler: 'keiner', ziel: 0 },
    schalter: { ub: 5, ust: 5, last: 'led', uf: 2, rv: 330, rspule: 240, lspule: 0.3, rlast: 100, rb: 4700, b: 100, freilauf: 1, eingang: 'takt', ftakt: 100, fehler: 'keiner', ziel: 0 },
    emitter: { ub: 12, ue: 0.02, f: 1000, rg: 600, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: 1, c1: 10e-6, c2: 10e-6, b: 100, rl: 10000, fehler: 'keiner', zielUce: 0, zielVu: 0, ansicht: 'signal' },
    folger: { betrieb: 'signal', schaltung: 'kollektor', ub: 12, ue: 0.1, f: 1000, rg: 10000, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, b: 100, rl: 220, uz: 6, iz: 0.012, ic: 0.09, nd: 3, ud: 0.7, fehler: 'keiner', ziel: 0 },
    opv_inv: { schaltung: 'invertierer', opv: 'ideal', uv: 12, form: 'sinus', ue: 0.5, f: 1000, r1: 10000, rf: 47000, ue2: 0, r2: 22000, ue3: 0, r3: 47000, rl: 10000, fehler: 'keiner', zielV: 0 },
    opv_nin: { schaltung: 'nichtinvertierend', opv: 'ideal', uv: 12, form: 'sinus', ue: 0.25, f: 1000, rg: 10000, rf: 47000, u1: 1.6, u2: 2.1, r1: 10000, r2: 10000, r3: 47000, r4: 47000, rl: 10000, fehler: 'keiner', zielV: 0 },
    opv_komp: { schaltung: 'schmitt_inv', opv: 'ideal', uv: 12, uref: 0, form: 'dreieck', ue: 8, f: 100, uoff: 0, r1: 10000, r2: 20000, r3: 10000, rt: 10000, c: 100e-9, fehler: 'keiner', zielUh: 0, zielF: 0 },
    opv_aktiv: { schaltung: 'integrierer', opv: 'ideal', uv: 12, form: 'rechteck', ue: 2, f: 5, r1: 100000, rf: 1e8, c: 1e-6, rs: 1, fehler: 'keiner', zielF: 0 }
  };
  const BOOLK = { ce: 1, freilauf: 1 };
  const FEHLER = {
    diode: ['keiner', 'verpolt', 'diode offen', 'diode kurz', 'rv offen'],
    schalter: ['keiner', 'rb offen', 'ce schluss', 'ce offen', 'be offen', 'last offen', 'versorgung fehlt'],
    emitter: ['keiner', 'r1 offen', 'r2 offen', 'rc offen', 're offen', 'ce offen', 'c1 offen', 'transistor defekt', 'versorgung fehlt'],
    folger: ['keiner', 'r1 offen', 'r2 offen', 're offen', 'transistor defekt', 'versorgung fehlt', 'koppel-c offen'],
    opv_inv: ['keiner', 'rf offen', 'r1 offen', 'rf kurz', 'versorgung minus fehlt', 'versorgung fehlt', 'ausgang defekt'],
    opv_nin: ['keiner', 'rf offen', 'rg offen', 'versorgung minus fehlt', 'versorgung fehlt', 'versorgung verpolt', 'eingang offen'],
    opv_komp: ['keiner', 'r2 offen', 'r3 offen', 'c offen', 'versorgung minus fehlt', 'versorgung fehlt'],
    opv_aktiv: ['keiner', 'c offen', 'rp offen', 'r1 offen', 'versorgung minus fehlt', 'versorgung fehlt']
  };
  /* Auswahloption -> Id der Diagnose-Meldung */
  const FEHLER_DIAG = {
    'rv offen': 'rv-offen', 'diode offen': 'diode-offen', 'diode kurz': 'diode-kurz', 'verpolt': 'diode-verpolt',
    'rb offen': 'rb-offen', 'ce schluss': 'ce-schluss', 'ce offen': 'ce-offen', 'be offen': 'be-offen', 'last offen': 'last-offen', 'versorgung fehlt': 'versorgung-fehlt',
    'r1 offen': 'r1-offen', 'r2 offen': 'r2-offen', 'rc offen': 'rc-offen', 're offen': 're-offen', 'c1 offen': 'c1-offen', 'transistor defekt': 'defekt', 'koppel-c offen': 'koppel-c-offen',
    'rf offen': 'rf-offen', 'rf kurz': 'rf-kurz', 'versorgung minus fehlt': 'versorgung-minus-fehlt', 'ausgang defekt': 'ausgang-defekt', 'rg offen': 'rg-offen',
    'versorgung verpolt': 'versorgung-verpolt', 'eingang offen': 'eingang-offen', 'r3 offen': 'r3-offen', 'c offen': 'c-offen', 'rp offen': 'rp-offen'
  };
  function canonFehler(rigId, v) {
    const list = FEHLER[rigId] || [];
    if (v === undefined || v === null || v === '') return 'keiner';
    const s = String(v).trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
    const s2 = s.replace(/-/g, ' ');
    for (let i = 0; i < list.length; i++) if (list[i] === s || list[i].replace(/-/g, ' ') === s2) return list[i];
    return null;
  }
  function norm(rigId, ctl) {
    const d = DEF[rigId];
    if (!d) V('Den Prüfstand „' + String(rigId).slice(0, 30) + '“ gibt es nicht.');
    const c = obj(ctl), o = {};
    Object.keys(d).forEach(function (k) {
      const dv = d[k], v = c[k];
      if (typeof dv === 'number') {
        if (BOOLK[k]) o[k] = bool(v, dv !== 0) ? 1 : 0;
        else { const x = typeof v === 'boolean' ? (v ? 1 : 0) : num(v, NaN); o[k] = isFinite(x) ? x : dv; }
      } else o[k] = v === undefined || v === null ? dv : String(v).trim();
    });
    const f = canonFehler(rigId, c.fehler);
    if (f === null) V('Den Fehlerfall „' + String(c.fehler).slice(0, 30) + '“ gibt es an dieser Anlage nicht.');
    o.fehler = f;
    return o;
  }
  const rlMap = function (r) { return r >= 0.999e6 ? R_OFFEN : r; };
  function ueberlastLed(typ) { return /^led/.test(typ); }

  /* ---- diode ---- */
  function modelDiode(c, f) {
    const cfg = { typ: c.typ, modell: c.modell, uq: c.uq, rv: c.rv, temp: c.temp };
    if (c.typ === 'z') { cfg.uz = c.uz; cfg.rlast = rlMap(c.rlast); }
    if (f === 'verpolt') cfg.uq = c.uq > 0 ? -c.uq : c.uq;
    let r;
    const led = ueberlastLed(c.typ);
    if (f === 'rv offen' || f === 'diode offen') {
      /* Strompfad unterbrochen: Der Kern kennt "offen" nur als sehr grossen Widerstand, die Messwerte des offenen Zweigs werden direkt gesetzt */
      r = { ok: true, valid: true, ud: f === 'diode offen' ? c.uq : 0, id: 0, iz: 0, ilast: 0, iq: 0, ur: f === 'rv offen' ? c.uq : 0, pr: 0, pd: 0, rd: NaN, us: NaN, zustand: 'offen', ueberlast: false, typ: c.typ, modell: c.modell, uf: NaN, uz: c.typ === 'z' ? c.uz : NaN };
    } else if (f === 'diode kurz') {
      /* Bauteil kurzgeschlossen: wie eine Z-Diode mit U_Z = 0,1 V im konstanten Modell (Kern verlangt U_F > 0,05 V), Vorzeichen spiegelbildlich */
      const k = C.diode.operating({ typ: 'z', modell: 'konstant', uz: 0.1, uq: Math.abs(c.uq), rv: c.rv });
      needOk(k);
      const s = c.uq < 0 ? -1 : 1;
      r = Object.assign({}, k, { ud: s * k.ud, id: s * k.id, iz: s * k.iz, iq: s * k.iq, ur: s * k.ur, pd: Math.abs(k.pd), us: s * k.us, zustand: 'kurz', typ: c.typ, uz: 0.1, ueberlast: led && Math.abs(k.id) > limN('led_imax') });
    } else r = C.diode.operating(cfg);
    needOk(r);
    return { cfg: cfg, r: r };
  }

  /* ---- schalter ---- */
  function modelSchalter(c, f) {
    let ub = c.ub, rb = c.rb, rv = c.rv, rsp = c.rspule, rl = c.rlast;
    if (f === 'rb offen') rb = R_OFFEN;
    if (f === 'last offen') { rv = R_OFFEN; rsp = R_OFFEN; rl = R_OFFEN; }
    if (f === 'versorgung fehlt') ub = 1e-3;
    const cfg = { ub: ub, ust: c.ust, last: c.last, uf: c.uf, rv: rv, rspule: rsp, rlast: rl, rb: rb, b: c.b };
    const ube = limN('ube');
    let r;
    if (f === 'ce schluss' || f === 'ce offen' || f === 'be offen') {
      const uf = c.last === 'led' ? c.uf : 0, rl0 = c.last === 'led' ? c.rv : (c.last === 'relais' ? c.rspule : c.rlast);
      const ibn = c.ust > ube ? (c.ust - ube) / rb : 0, ib = f === 'be offen' ? 0 : ibn;
      const ic = f === 'ce schluss' ? Math.max(0, (ub - uf) / rl0) : 0;
      r = { ok: true, valid: true, zustand: 'defekt', defekt: f === 'ce schluss' ? 'ce_schluss' : (f === 'ce offen' ? 'ce_offen' : 'be_offen'), icSat: NaN, ic: ic, ib: ib, ibmin: NaN, ueb: NaN, uce: f === 'ce schluss' ? 0 : ub,
        ube: f === 'ce schluss' || f === 'ce offen' ? Math.min(ube, Math.max(c.ust, 0)) : 0, plast: ic * ic * rl0 + uf * ic, pv: 0, rbMax: NaN, rbSoll: NaN };
    } else r = C.tr.switch(cfg);
    needOk(r);
    if (f === 'rb offen') {
      /* Basiszweig unterbrochen: kein Basisstrom, der Transistor sperrt (U_CE = U_B); der Kern rechnet bei I_B -> 0 sonst im aktiven Bereich mit U_F an der LED */
      r = Object.assign({}, r, { zustand: 'sperrt', ib: 0, ic: 0, ibmin: r.ibmin, ueb: 0, uce: ub, plast: 0, pv: 0, ube: 0 });
    }
    let rel = null;
    if (c.last === 'relais') { rel = C.tr.relais({ ub: ub, rspule: rsp, lspule: c.lspule, freilauf: c.freilauf !== 0 }); needOk(rel); }
    return { cfg: cfg, r: r, rel: rel };
  }

  /* ---- emitter ---- */
  function emitCfgOf(c, f) {
    const cfg = { ub: c.ub, r1: c.r1, r2: c.r2, rc: c.rc, re1: c.re1, re2: c.re2, ce: c.ce !== 0, b: c.b, rg: c.rg, rl: rlMap(c.rl), c1: c.c1, c2: c.c2 };
    if (f === 'r1 offen') cfg.r1 = R_OFFEN;
    if (f === 'r2 offen') cfg.r2 = R_OFFEN;
    if (f === 'rc offen') cfg.rc = R_OFFEN;
    if (f === 're offen') { cfg.re1 = R_OFFEN; cfg.re2 = R_OFFEN; }
    if (f === 'ce offen') cfg.ce = false;
    if (f === 'c1 offen') cfg.c1 = 1e-12;
    if (f === 'transistor defekt') cfg.defekt = 'be_offen';
    if (f === 'versorgung fehlt') cfg.ub = 1e-3;
    return cfg;
  }
  function modelEmitter(c, f) {
    const cfg = emitCfgOf(c, f);
    const ac = needOk(C.emit.ac(cfg));
    let large = null;
    if (ac.valid !== false) { const l = C.emit.large(Object.assign({}, cfg, { ue: c.ue, f: c.f }), 128); if (l && l.ok && l.valid !== false) large = l; }
    return { cfg: cfg, r: ac, large: large, dc: C.tr.dc({ ub: cfg.ub, r1: cfg.r1, r2: cfg.r2, rc: cfg.rc, re: cfg.re1 + cfg.re2, b: cfg.b, defekt: cfg.defekt }) };
  }

  /* ---- folger ---- */
  function modelFolger(c, f) {
    if (c.betrieb === 'zener') {
      let ub = c.ub, ic = c.ic, iz = c.iz;
      if (f === 'versorgung fehlt') ub = 1e-3;
      if (f === 'transistor defekt' || f === 're offen') ic = 1e-9;
      const r = C.tr.zfolger({ ub: ub, uz: c.uz, ic: ic, b: c.b, iz: iz });
      return { cfg: { ub: ub, uz: c.uz, ic: ic, b: c.b, iz: iz }, r: r, betrieb: 'zener' };
    }
    if (c.betrieb === 'konstantstrom') {
      let ic = c.ic;
      if (f === 'transistor defekt' || f === 're offen' || f === 'versorgung fehlt') ic = 1e-9;
      const r = C.tr.cs({ nd: Math.round(c.nd), ud: c.ud, ic: ic });
      return { cfg: { nd: Math.round(c.nd), ud: c.ud, ic: ic }, r: r, betrieb: 'konstantstrom', icSoll: c.ic, ausfall: ic !== c.ic };
    }
    const cfg = { ub: c.ub, r1: c.r1, r2: c.r2, rc: c.rc, re1: c.re1, re2: c.re2, ce: false, b: c.b, rg: c.rg, rl: rlMap(c.rl), c1: 0, c2: 0 };
    if (f === 'r1 offen') cfg.r1 = R_OFFEN;
    if (f === 'r2 offen') cfg.r2 = R_OFFEN;
    if (f === 're offen') { cfg.re1 = R_OFFEN; cfg.re2 = R_OFFEN; }
    if (f === 'transistor defekt') cfg.defekt = 'be_offen';
    if (f === 'versorgung fehlt') cfg.ub = 1e-3;
    const g = C.grund.compare(cfg);
    needOk(g);
    const ue = f === 'koppel-c offen' ? 0 : c.ue;
    const sel = g[c.schaltung] || g.kollektor;
    return { cfg: cfg, r: g, betrieb: 'signal', sel: sel, schaltung: g[c.schaltung] ? c.schaltung : 'kollektor', ue: ue };
  }

  /* ---- Operationsverstaerker ---- */
  function opBase(c, f) {
    let uv = c.uv, uvn = c.uv;
    if (f === 'versorgung minus fehlt') uvn = 0;
    if (f === 'versorgung fehlt') { uv = 0; uvn = 0; }
    return { opv: c.opv, uv: uv, uvn: uvn };
  }
  function modelOpInv(c, f) {
    const base = opBase(c, f);
    let r1 = c.r1, rf = c.rf, ue = c.ue;
    if (f === 'rf offen') rf = R_OFFEN;
    if (f === 'r1 offen') r1 = R_OFFEN;
    if (f === 'rf kurz') rf = R_KURZ;
    let r, inv = null;
    if (c.schaltung === 'summierer') {
      r = KOP().sum(Object.assign({ rf: rf, r: [r1, c.r2, c.r3], u: [ue, c.ue2, c.ue3] }, base));
      inv = KOP().inv(Object.assign({ r1: r1, rf: rf, ue: ue, f: c.f }, base));
    } else { r = KOP().inv(Object.assign({ r1: r1, rf: rf, ue: ue, f: c.f }, base)); inv = r; }
    needOk(r, 'Der Operationsverstärker ist nicht geladen.');
    const m = { cfg: Object.assign({ r1: r1, rf: rf }, base), r: r, inv: inv && inv.ok ? inv : null, base: base, summe: c.schaltung === 'summierer' };
    if (f === 'ausgang defekt') {
      const g = KOP().grenzen(base), up = g && g.ok ? g.p : base.uv;
      m.r = Object.assign({}, r, { ua: up, sat: true, defektAusgang: true });
    }
    return m;
  }
  function modelOpNin(c, f) {
    const base = opBase(c, f);
    let rg = c.rg, rf = c.rf, ue = c.ue, u1 = c.u1, u2 = c.u2;
    if (f === 'rf offen') rf = R_OFFEN;
    if (f === 'rg offen') rg = R_OFFEN;
    if (f === 'eingang offen') { ue = 0; u2 = 0; }
    let r;
    if (c.schaltung === 'differenz') r = KOP().diff(Object.assign({ r1: c.r1, r2: c.r2, r3: c.r3, r4: c.r4, u1: u1, u2: u2 }, base));
    else if (c.schaltung === 'folger') r = KOP().folger(Object.assign({ ue: ue, f: c.f }, base));
    else r = KOP().nin(Object.assign({ rg: rg, rf: rf, ue: ue, f: c.f }, base));
    needOk(r, 'Der Operationsverstärker ist nicht geladen.');
    const m = { cfg: Object.assign({ rg: rg, rf: rf }, base), r: r, base: base, ue: ue };
    if (f === 'versorgung verpolt') m.r = Object.assign({}, r, { ua: 0, sat: false, ualin: 0, verpolt: true });
    return m;
  }
  function modelOpKomp(c, f) {
    const base = opBase(c, f);
    let r2 = c.r2, r3 = c.r3, cc = c.c;
    if (f === 'r2 offen') r2 = R_OFFEN;
    if (f === 'r3 offen') r3 = R_OFFEN;
    if (f === 'c offen') cc = 1e-12;
    const art = c.schaltung;
    let r;
    if (art === 'komparator') r = KKO().comparator(Object.assign({ up: c.uoff + c.ue, un: c.uref }, base));
    else if (art === 'schmitt_nin') r = KKO().schmitt(Object.assign({ art: 'nin', r1: c.r1, r2: r2, uref: c.uref }, base));
    else if (art === 'rechteck') r = KKO().osc(Object.assign({ r: c.rt, c: cc, r2: r2, r3: r3, uref: c.uref }, base));
    else r = KKO().schmitt(Object.assign({ art: 'inv', r2: r2, r3: r3, uref: c.uref }, base));
    needOk(r, 'Der Operationsverstärker ist nicht geladen.');
    return { cfg: Object.assign({ r2: r2, r3: r3, c: cc }, base), r: r, base: base, art: art };
  }
  function modelOpAktiv(c, f) {
    const base = opBase(c, f);
    let r1 = c.r1, cc = c.c, rf = c.rf;
    if (f === 'c offen') cc = 1e-12;
    if (f === 'r1 offen') r1 = R_OFFEN;
    if (f === 'rp offen') rf = R_OFFEN;
    const art = c.schaltung;
    const rfEff = rf >= 0.999e8 ? R_OFFEN : rf, rsEff = c.rs <= 1.0001 ? 0 : c.rs;
    let r, fref = NaN, wcfg;
    if (art === 'integrierer') { r = KAC().integrator(Object.assign({ r: r1, c: cc, rp: rfEff, ue: c.ue, f: c.f }, base)); fref = r && r.ok ? (r.rpOffen ? r.fRef : r.fgRp) : NaN; wcfg = Object.assign({ art: 'integrierer', r: r1, c: cc, rp: rfEff }, base); }
    else if (art === 'differenzierer') { r = KAC().differentiator(Object.assign({ rf: rf, c: cc, rs: rsEff, f: c.f }, base)); fref = r && r.ok ? (rsEff > 0 ? r.fgRs : r.fRef) : NaN; wcfg = Object.assign({ art: 'differenzierer', rf: rf, c: cc, rs: rsEff }, base); }
    else if (art === 'tiefpass') { r = KAC().tp(Object.assign({ r1: r1, rf: rf, cf: cc }, base)); fref = r && r.ok ? r.fg : NaN; wcfg = Object.assign({ art: 'tp', r1: r1, rf: rf, cf: cc }, base); }
    else if (art === 'hochpass') { r = KAC().hp(Object.assign({ r1: r1, rf: rf, c1: cc }, base)); fref = r && r.ok ? r.fg : NaN; wcfg = Object.assign({ art: 'hp', r1: r1, rf: rf, c1: cc }, base); }
    else { r = KOP().inv(Object.assign({ r1: r1, rf: rf, ue: c.ue, f: c.f }, base)); fref = r && r.ok && r.valid !== false ? r.fg : NaN; wcfg = null; }
    needOk(r, 'Der Operationsverstärker ist nicht geladen.');
    return { cfg: Object.assign({ r1: r1, c: cc, rf: rf, rs: rsEff, rp: rfEff }, base), r: r, base: base, art: art, fref: fref, wcfg: wcfg };
  }
  const MODELS = { diode: modelDiode, schalter: modelSchalter, emitter: modelEmitter, folger: modelFolger, opv_inv: modelOpInv, opv_nin: modelOpNin, opv_komp: modelOpKomp, opv_aktiv: modelOpAktiv };
  /* Gesamtmodell: Zustand normieren, Fehlerfall umsetzen, Kern aufrufen */
  function buildModel(rigId, ctl) {
    const id = String(rigId);
    if (!MODELS[id]) V('Den Prüfstand „' + id.slice(0, 30) + '“ gibt es nicht.');
    const c = norm(id, ctl), f = c.fehler;
    const m = MODELS[id](c, f);
    m.ok = true; m.valid = true; m.rigId = id; m.ctl = c; m.fehler = f; m.fehlerId = f === 'keiner' ? null : (FEHLER_DIAG[f] || null);
    return m;
  }
  const rigApi = {
    model: SG(function (rigId, ctl) { const m = buildModel(rigId, ctl); return Object.assign({}, m); }),
    defaults: function (rigId) { return DEF[rigId] ? Object.assign({}, DEF[rigId]) : null; },
    fehler: function (rigId) { return FEHLER[rigId] ? FEHLER[rigId].slice() : []; },
    ids: function () { return Object.keys(DEF); }
  };
  C.extend('rig', rigApi);

  /* =============================== Formeln (formulas) =============================== */
  /* Jede Formel: rechnet positionell in SI, ungueltig -> NaN. Die Reihenfolge der Argumente ist die des Stubs (Pool-Abgleich ruft sie so auf). */
  const pos0 = function (x) { return x > 0; };
  const FD = [];
  function F(id, name, symbol, expr, unit, args, core, explain) { FD.push({ id: id, name: name, symbol: symbol, expr: expr, unit: unit, args: args, core: core, explain: explain }); }
  const NaNv = NaN;
  F('rvLed', 'Vorwiderstand für LED oder Diode', 'R_V', 'R_V = (U_B − U_F) / I_F', 'Ω', [['ub', 'Betriebsspannung', 'V', 24], ['uf', 'Flussspannung', 'V', 2], ['i', 'Strom', 'A', 0.012]],
    function (ub, uf, i) { return pos0(i) && ub > uf ? (ub - uf) / i : NaNv; }, 'Am Vorwiderstand fällt die Spannung ab, die nach der Flussspannung übrig bleibt; der Strom ist für beide gleich.');
  F('pRv', 'Verlustleistung am Vorwiderstand', 'P_R', 'P = (U_B − U_F)² / R_V', 'W', [['ub', 'Betriebsspannung', 'V', 24], ['uf', 'Flussspannung', 'V', 2], ['r', 'Vorwiderstand', 'Ω', 3300]],
    function (ub, uf, r) { return pos0(r) && ub >= uf ? (ub - uf) * (ub - uf) / r : NaNv; }, 'Leistung aus der Spannung am Widerstand: P = U² / R mit U = U_B − U_F.');
  F('rvZ', 'Kleinster Vorwiderstand der Z-Diode', 'R_V,min', 'R_V,min = (U_max − U_Z) / (P_Z / U_Z)', 'Ω', [['uqmax', 'größte Eingangsspannung', 'V', 15], ['uz', 'Z-Spannung', 'V', 5.1], ['pz', 'zulässige Verlustleistung', 'W', 0.5]],
    function (uqmax, uz, pz) { return pos0(uz) && pos0(pz) && uqmax > uz ? (uqmax - uz) / (pz / uz) : NaNv; }, 'Bei der größten Eingangsspannung fließt der größte Z-Strom; er darf höchstens P_Z / U_Z betragen.');
  F('izLast', 'Z-Strom mit Last', 'I_Z', 'I_Z = (U_q − U_Z) / R_V − U_Z / R_L', 'A', [['uq', 'Quellenspannung', 'V', 12], ['uz', 'Z-Spannung', 'V', 5.1], ['rv', 'Vorwiderstand', 'Ω', 470], ['rl', 'Lastwiderstand', 'Ω', 4700]],
    function (uq, uz, rv, rl) { return pos0(rv) && pos0(rl) && uq > uz ? (uq - uz) / rv - uz / rl : NaNv; }, 'Der Strom im Vorwiderstand teilt sich auf Z-Diode und Last: I_Z = I_R − I_L.');
  F('rLastZ', 'Lastwiderstand an der Z-Diode', 'R_L', 'R_L = U_Z / ((U_q − U_Z) / R_V − I_Z)', 'Ω', [['uq', 'Quellenspannung', 'V', 12], ['uz', 'Z-Spannung', 'V', 6], ['rv', 'Vorwiderstand', 'Ω', 15], ['iz', 'Z-Strom', 'A', 0.1]],
    function (uq, uz, rv, iz) { const il = pos0(rv) ? (uq - uz) / rv - iz : NaNv; return il > 0 && pos0(uz) ? uz / il : NaNv; }, 'Was vom Strom im Vorwiderstand nicht durch die Z-Diode fließt, geht in die Last.');
  F('iKette', 'Strom in einer Reihenschaltung', 'I', 'I = (U_B − ΣU) / R_V', 'A', [['ub', 'Betriebsspannung', 'V', 24], ['usum', 'Summe der Spannungen an den Bauteilen', 'V', 7.1], ['r', 'Vorwiderstand', 'Ω', 4700]],
    function (ub, usum, r) { return pos0(r) && ub > usum ? (ub - usum) / r : NaNv; }, 'Die Spannung am Widerstand ist die Betriebsspannung minus die Spannungen aller Bauteile in Reihe.');
  F('icSat', 'Kollektorstrom in der Sättigung (LED-Last)', 'I_C,sat', 'I_C = (U_B − U_CE,sat − U_F) / R_V', 'A', [['ub', 'Betriebsspannung', 'V', 5], ['ucesat', 'Sättigungsspannung', 'V', 0.2], ['uf', 'Flussspannung der LED', 'V', 2], ['rv', 'Vorwiderstand', 'Ω', 330]],
    function (ub, ucesat, uf, rv) { return pos0(rv) && ub > ucesat + uf ? (ub - ucesat - uf) / rv : NaNv; }, 'Im Sättigungsbereich fällt am Transistor nur U_CE,sat ab; der Rest liegt an LED und Vorwiderstand.');
  F('ibSchalter', 'Basisstrom beim Schalten', 'I_B', 'I_B = ü · I_C / B', 'A', [['ueb', 'Übersteuerungsfaktor', '', 3], ['ic', 'Kollektorstrom', 'A', 0.0085], ['b', 'Gleichstromverstärkung', '', 100]],
    function (ueb, ic, b) { return pos0(ueb) && pos0(ic) && pos0(b) ? ueb * ic / b : NaNv; }, 'Der Mindest-Basisstrom ist I_C / B; mit dem Übersteuerungsfaktor ü wird er bewusst größer gewählt.');
  F('rbSchalter', 'Basisvorwiderstand', 'R_B', 'R_B = (U_St − U_BE) / I_B', 'Ω', [['ust', 'Steuerspannung', 'V', 5], ['ube', 'Basis-Emitter-Spannung', 'V', 0.7], ['ib', 'Basisstrom', 'A', 0.000676]],
    function (ust, ube, ib) { return pos0(ib) && ust > ube ? (ust - ube) / ib : NaNv; }, 'Am Basisvorwiderstand fällt die Steuerspannung abzüglich U_BE ab.');
  F('pVtr', 'Verlustleistung des Transistors', 'P_V', 'P_V = U_CE · I_C + U_BE · I_B', 'W', [['uce', 'Kollektor-Emitter-Spannung', 'V', 0.2], ['ic', 'Kollektorstrom', 'A', 0.0085], ['ube', 'Basis-Emitter-Spannung', 'V', 0.7], ['ib', 'Basisstrom', 'A', 0.0009]],
    function (uce, ic, ube, ib) { return uce >= 0 && ic >= 0 && ib >= 0 ? uce * ic + ube * ib : NaNv; }, 'Die Verlustleistung entsteht am Ausgang (U_CE · I_C) und am Eingang (U_BE · I_B); sie erwärmt das Bauteil.');
  F('ubb', 'Basisspannung am Spannungsteiler', 'U_BB', 'U_BB = U_B · R_2 / (R_1 + R_2)', 'V', [['ub', 'Betriebsspannung', 'V', 12], ['r1', 'Widerstand R_1', 'Ω', 47000], ['r2', 'Widerstand R_2', 'Ω', 10000]],
    function (ub, r1, r2) { return pos0(r1) && pos0(r2) ? ub * r2 / (r1 + r2) : NaNv; }, 'Unbelasteter Spannungsteiler; der Basisstrom belastet ihn nur wenig (Querstrom groß gegen I_B).');
  F('rbTh', 'Innenwiderstand des Basisteilers', 'R_B', 'R_B = R_1 ∥ R_2', 'Ω', [['r1', 'Widerstand R_1', 'Ω', 47000], ['r2', 'Widerstand R_2', 'Ω', 10000]],
    function (r1, r2) { return pos0(r1) && pos0(r2) ? par(r1, r2) : NaNv; }, 'Für die Basis wirken R_1 und R_2 parallel (Ersatzspannungsquelle).');
  F('ibEmitter', 'Basisstrom der Emitterschaltung', 'I_B', 'I_B = (U_BB − U_BE) / (R_B + (B + 1) · R_E)', 'A', [['ubb', 'Basisspannung', 'V', 2.1053], ['ube', 'Basis-Emitter-Spannung', 'V', 0.7], ['rb', 'Innenwiderstand des Teilers', 'Ω', 8245.6], ['b', 'Gleichstromverstärkung', '', 100], ['re', 'Emitterwiderstand', 'Ω', 570]],
    function (ubb, ube, rb, b, re) { return rb >= 0 && re >= 0 && pos0(b) && ubb > ube ? (ubb - ube) / (rb + (b + 1) * re) : NaNv; }, 'Der Emitterwiderstand wirkt (B + 1)-fach auf die Basis zurück.');
  F('icAusIb', 'Kollektorstrom aus Basisstrom', 'I_C', 'I_C = B · I_B', 'A', [['b', 'Gleichstromverstärkung', '', 100], ['ib', 'Basisstrom', 'A', 0.00002135]],
    function (b, ib) { return pos0(b) && ib >= 0 ? b * ib : NaNv; }, 'Definition der Gleichstromverstärkung B im aktiven Bereich.');
  F('r2Teiler', 'Querwiderstand des Basisteilers', 'R_2', 'R_2 = U_2 / (I_1 − I_B)', 'Ω', [['u2', 'Spannung an R_2', 'V', 3], ['i1', 'Strom durch R_1', 'A', 0.0008], ['ib', 'Basisstrom', 'A', 0.00008]],
    function (u2, i1, ib) { return pos0(u2) && ib >= 0 && i1 > ib ? u2 / (i1 - ib) : NaNv; }, 'Durch R_2 fließt der Strom von R_1 abzüglich des Basisstroms.');
  F('ucePunkt', 'Kollektor-Emitter-Spannung im Arbeitspunkt', 'U_CE', 'U_CE = U_B − I_C · R_C', 'V', [['ub', 'Betriebsspannung', 'V', 12], ['ic', 'Kollektorstrom', 'A', 0.002], ['rc', 'Kollektorwiderstand', 'Ω', 2200]],
    function (ub, ic, rc) { return rc >= 0 ? ub - ic * rc : NaNv; }, 'Maschengleichung am Ausgang (ohne Emitterwiderstand); wird das Ergebnis kleiner als U_CE,sat, ist der Transistor in der Sättigung.');
  F('gm', 'Steilheit', 'g_m', 'g_m = I_C / U_T', 'S', [['ic', 'Kollektorstrom', 'A', 0.002135], ['ut', 'Temperaturspannung', 'V', 0.026]],
    function (ic, ut) { return pos0(ic) && pos0(ut) ? ic / ut : NaNv; }, 'Die Steilheit wächst mit dem Kollektorstrom; U_T ist ein Übungswert.');
  F('reT', 'Emitterwiderstand des Transistors', 'r_e', 'r_e = U_T / I_E', 'Ω', [['ut', 'Temperaturspannung', 'V', 0.026], ['ie', 'Emitterstrom', 'A', 0.002157]],
    function (ut, ie) { return pos0(ut) && pos0(ie) ? ut / ie : NaNv; }, 'Innerer Widerstand der Emitterdiode im Arbeitspunkt.');
  F('rinT', 'Eingangswiderstand des Transistors', 'r_in,T', 'r_in,T = r_BE + (B + 1) · R_E', 'Ω', [['rbe', 'Eingangswiderstand der Basis', 'Ω', 1217.7], ['b', 'Gleichstromverstärkung', '', 100], ['re', 'Emitterwiderstand (für das Signal)', 'Ω', 100]],
    function (rbe, b, re) { return pos0(rbe) && pos0(b) && re >= 0 ? rbe + (b + 1) * re : NaNv; }, 'Ein ungebrückter Emitterwiderstand erhöht den Eingangswiderstand (und senkt die Verstärkung).');
  F('vuEmitter', 'Spannungsverstärkung der Emitterschaltung (Emitter gebrückt)', 'V_u', 'V_u = −g_m · R_C', '', [['gm', 'Steilheit', 'S', 0.0821], ['rc', 'Kollektorwiderstand', 'Ω', 2200]],
    function (gm, rc) { return pos0(gm) && pos0(rc) ? -gm * rc : NaNv; }, 'Das Minuszeichen steht für die Phasendrehung um 180°; die Last liegt parallel zu R_C.');
  F('vuGegen', 'Spannungsverstärkung mit Gegenkopplung', 'V_u', 'V_u ≈ −R_C / (R_E + r_e)', '', [['rc', 'Kollektorwiderstand', 'Ω', 2200], ['re', 'Emitterwiderstand r_e des Transistors', 'Ω', 12.06], ['rE', 'Emitterwiderstand R_E (ungebrückt)', 'Ω', 100]],
    function (rc, re, rE) { return pos0(rc) && re >= 0 && rE >= 0 && re + rE > 0 ? -rc / (re + rE) : NaNv; }, 'Tabellenbuch-Näherung für B groß: Der ungebrückte Emitterwiderstand legt die Verstärkung fest (Gegenkopplung).');
  F('vuFolger', 'Spannungsverstärkung der Kollektorschaltung', 'V_u', 'V_u = (B + 1) · R_E / (r_BE + (B + 1) · R_E)', '', [['b', 'Gleichstromverstärkung', '', 100], ['re', 'Emitterwiderstand (mit Last)', 'Ω', 220], ['rbe', 'Eingangswiderstand der Basis', 'Ω', 1217.7]],
    function (b, re, rbe) { return pos0(b) && pos0(re) && pos0(rbe) ? (b + 1) * re / (rbe + (b + 1) * re) : NaNv; }, 'Immer knapp unter 1, nie darüber: keine Phasendrehung (Impedanzwandler).');
  F('ueFolger', 'Emitterspannung des Folgers', 'U_E', 'U_E = U_Basis − U_BE', 'V', [['ubb', 'Spannung an der Basis', 'V', 6], ['ube', 'Basis-Emitter-Spannung', 'V', 0.7]],
    function (ubb, ube) { return ubb - ube; }, 'Der Emitter folgt der Basisspannung im Abstand U_BE.');
  F('r1Zfolger', 'Vorwiderstand der Z-Diode am Folger', 'R_1', 'R_1 = (U_B − U_Z) / (I_Z + I_C / B)', 'Ω', [['ub', 'Betriebsspannung', 'V', 15], ['uz', 'Z-Spannung', 'V', 6], ['iz', 'Z-Strom', 'A', 0.012], ['ic', 'Kollektorstrom', 'A', 0.09], ['b', 'Gleichstromverstärkung', '', 30]],
    function (ub, uz, iz, ic, b) { return pos0(iz) && pos0(ic) && pos0(b) && ub > uz ? (ub - uz) / (iz + ic / b) : NaNv; }, 'Durch R_1 fließen der Z-Strom und der Basisstrom des Transistors.');
  F('reKonst', 'Emitterwiderstand der Konstantstromquelle', 'R_E', 'R_E = (n · U_D − U_BE) / I_C', 'Ω', [['nd', 'Anzahl der Dioden', '', 3], ['ud', 'Flussspannung je Diode', 'V', 0.7], ['ube', 'Basis-Emitter-Spannung', 'V', 0.7], ['ic', 'Kollektorstrom', 'A', 0.04]],
    function (nd, ud, ube, ic) { return nd >= 1 && pos0(ud) && pos0(ic) && nd * ud > ube ? (nd * ud - ube) / ic : NaNv; }, 'Die Diodenspannung abzüglich U_BE liegt am Emitterwiderstand und legt den Strom fest.');
  F('iBegr', 'Strombegrenzung mit Transistor', 'I_max', 'I_max = U_BE / R_Mess', 'A', [['ube', 'Basis-Emitter-Spannung', 'V', 0.6], ['r', 'Messwiderstand', 'Ω', 0.47]],
    function (ube, r) { return pos0(ube) && pos0(r) ? ube / r : NaNv; }, 'Der Transistor öffnet, sobald am Messwiderstand U_BE abfällt.');
  F('vInv', 'Verstärkung des invertierenden Verstärkers', 'V_u', 'V_u = −R_f / R_1', '', [['r1', 'Eingangswiderstand', 'Ω', 4700], ['rf', 'Rückkopplungswiderstand', 'Ω', 47000]],
    function (r1, rf) { return pos0(r1) && pos0(rf) ? -rf / r1 : NaNv; }, 'Das Minuszeichen: Der Ausgang ist gegenüber dem Eingang um 180° gedreht.');
  F('vNin', 'Verstärkung des nichtinvertierenden Verstärkers', 'V_u', 'V_u = 1 + R_f / R_g', '', [['rg', 'Widerstand nach Masse', 'Ω', 10000], ['rf', 'Rückkopplungswiderstand', 'Ω', 47000]],
    function (rg, rf) { return pos0(rg) && rf >= 0 ? 1 + rf / rg : NaNv; }, 'Nie kleiner als 1; bei R_f = 0 oder R_g offen ist V_u = 1 (Spannungsfolger).');
  F('vnRausch', 'Rauschverstärkung', 'V_n', 'V_n = 1 + R_f / R_1', '', [['r1', 'Eingangswiderstand', 'Ω', 10000], ['rf', 'Rückkopplungswiderstand', 'Ω', 100000]],
    function (r1, rf) { return pos0(r1) && rf >= 0 ? 1 + rf / r1 : NaNv; }, 'Verstärkung der Schleife (nicht des Signals): V_n bestimmt Grenzfrequenz und Offset am Ausgang.');
  F('rfInv', 'Rückkopplungswiderstand aus der Verstärkung', 'R_f', 'R_f = |V_u| · R_1', 'Ω', [['v', 'Verstärkung (Betrag)', '', 10], ['r1', 'Eingangswiderstand', 'Ω', 4700]],
    function (v, r1) { return fin(v) && v !== 0 && pos0(r1) ? Math.abs(v) * r1 : NaNv; }, 'Beim invertierenden Verstärker ist der Betrag der Verstärkung R_f / R_1.');
  F('r1Inv', 'Eingangswiderstand aus der Verstärkung', 'R_1', 'R_1 = R_f / |V_u|', 'Ω', [['v', 'Verstärkung (Betrag)', '', 10], ['rf', 'Rückkopplungswiderstand', 'Ω', 47000]],
    function (v, rf) { return fin(v) && v !== 0 && pos0(rf) ? rf / Math.abs(v) : NaNv; }, 'Umgestellt aus |V_u| = R_f / R_1.');
  F('rfNin', 'Rückkopplungswiderstand beim Nichtinvertierer', 'R_f', 'R_f = (V_u − 1) · R_g', 'Ω', [['v', 'Verstärkung', '', 5.7], ['rg', 'Widerstand nach Masse', 'Ω', 10000]],
    function (v, rg) { return v >= 1 && pos0(rg) ? (v - 1) * rg : NaNv; }, 'Umgestellt aus V_u = 1 + R_f / R_g.');
  F('uaSumm', 'Ausgangsspannung des Summierers', 'U_a', 'U_a = −R_f · (U_1/R_1 + U_2/R_2)', 'V', [['rf', 'Rückkopplungswiderstand', 'Ω', 47000], ['r1', 'Widerstand R_1', 'Ω', 10000], ['u1', 'Spannung U_1', 'V', 0.5], ['r2', 'Widerstand R_2', 'Ω', 22000], ['u2', 'Spannung U_2', 'V', 1.1]],
    function (rf, r1, u1, r2, u2) { return pos0(rf) && pos0(r1) && pos0(r2) ? -rf * (u1 / r1 + u2 / r2) : NaNv; }, 'Die Ströme der Eingänge addieren sich am virtuellen Nullpunkt; jede Spannung wird mit R_f / R_k gewichtet und invertiert.');
  F('uaDiff', 'Ausgangsspannung des Differenzverstärkers', 'U_a', 'U_a = U_2 · R_4/(R_2+R_4) · (1 + R_3/R_1) − U_1 · R_3/R_1', 'V', [['r1', 'Widerstand R_1', 'Ω', 10000], ['r2', 'Widerstand R_2', 'Ω', 10000], ['r3', 'Widerstand R_3', 'Ω', 47000], ['r4', 'Widerstand R_4', 'Ω', 47000], ['u1', 'Spannung U_1', 'V', 1.6], ['u2', 'Spannung U_2', 'V', 2.1]],
    function (r1, r2, r3, r4, u1, u2) { return pos0(r1) && pos0(r2) && pos0(r3) && pos0(r4) ? u2 * r4 / (r2 + r4) * (1 + r3 / r1) - u1 * r3 / r1 : NaNv; }, 'Überlagerung: U_1 wird invertierend, U_2 nichtinvertierend (nach dem Teiler) verstärkt; bei R_4/R_2 = R_3/R_1 wird nur U_2 − U_1 verstärkt.');
  F('vDb', 'Spannungsverstärkungsmaß', 'a', 'a = 20 · lg |V_u|', 'dB', [['v', 'Verstärkung', '', 100]],
    function (v) { return fin(v) && v !== 0 ? 20 * lg(Math.abs(v)) : NaNv; }, 'Spannungsverhältnis in Dezibel; Faktor 20, weil die Leistung mit dem Quadrat der Spannung wächst.');
  F('vAusDb', 'Verstärkung aus dem Verstärkungsmaß', 'V_u', 'V_u = 10^(a / 20)', '', [['a', 'Verstärkungsmaß', 'dB', 34]],
    function (a) { return fin(a) && Math.abs(a) < 600 ? Math.pow(10, a / 20) : NaNv; }, 'Umkehrung von a = 20 · lg V_u.');
  F('fgGbw', 'Grenzfrequenz aus dem Verstärkungs-Bandbreite-Produkt', 'f_g', 'f_g ≈ GBW / V_n', 'Hz', [['gbw', 'Verstärkungs-Bandbreite-Produkt', 'Hz', 1000000], ['v', 'Rauschverstärkung V_n = 1 + R_f / R_1', '', 11]],
    function (gbw, v) { return pos0(gbw) && fin(v) && v !== 0 ? gbw / Math.abs(v) : NaNv; }, 'Rauschverstärkung V_n = 1 + R_f / R_1 (nicht |V_u|; beim Nichtinvertierer ist V_n = V_u). Verstärkung mal Bandbreite bleibt (näherungsweise) konstant; der Wert von GBW ist ein Übungswert (Fachreview v23).');
  F('fpb', 'Vollaussteuerungsbandbreite', 'f_max', 'f_max = SR / (2π · û)', 'Hz', [['sr', 'Slew-Rate', 'V/s', 500000], ['uhat', 'Scheitelwert der Ausgangsspannung', 'V', 10]],
    function (sr, uhat) { return pos0(sr) && pos0(uhat) ? sr / (TWO_PI * uhat) : NaNv; }, 'Eine Sinusspannung steigt höchstens mit 2π · f · û; die Slew-Rate begrenzt die Steilheit des Ausgangs (Slew-Rate 1 V/µs = 1 000 000 V/s).');
  F('uosOut', 'Ausgangsoffset', 'U_a,off', 'U_a,off = U_os · (1 + R_f / R_1)', 'V', [['uos', 'Offsetspannung', 'V', 0.002], ['rf', 'Rückkopplungswiderstand', 'Ω', 100000], ['r1', 'Eingangswiderstand', 'Ω', 1000]],
    function (uos, rf, r1) { return uos >= 0 && rf >= 0 && pos0(r1) ? uos * (1 + rf / r1) : NaNv; }, 'Die Offsetspannung wird mit der Rauschverstärkung V_n verstärkt (ohne Eingangsstrom-Offset).');
  F('ueMaxSat', 'Größte Eingangsspannung ohne Begrenzen', 'U_e,max', 'U_e,max = U_sat / |V_u|', 'V', [['usat', 'Aussteuergrenze', 'V', 12], ['v', 'Verstärkung', '', 10]],
    function (usat, v) { return pos0(usat) && fin(v) && v !== 0 ? usat / Math.abs(v) : NaNv; }, 'Darüber ist der Ausgang an der Aussteuergrenze begrenzt.');
  F('schmittInv', 'Schaltschwelle des invertierenden Schmitt-Triggers', 'U_o', 'U_o = U_sat · R_3 / (R_2 + R_3)', 'V', [['usat', 'Aussteuergrenze', 'V', 12], ['r2', 'Mitkopplung R_2', 'Ω', 20000], ['r3', 'Widerstand R_3', 'Ω', 10000]],
    function (usat, r2, r3) { return pos0(usat) && pos0(r2) && pos0(r3) ? usat * r3 / (r2 + r3) : NaNv; }, 'Teilerverhältnis der Mitkopplung am nichtinvertierenden Eingang (U_ref = 0); die untere Schwelle ist das Negative davon.');
  F('schmittNin', 'Schaltschwelle des nichtinvertierenden Schmitt-Triggers', 'U_o', 'U_o = U_sat · R_1 / R_2', 'V', [['usat', 'Aussteuergrenze', 'V', 12], ['r1', 'Eingangswiderstand R_1', 'Ω', 10000], ['r2', 'Mitkopplung R_2', 'Ω', 47000]],
    function (usat, r1, r2) { return pos0(usat) && pos0(r1) && pos0(r2) ? usat * r1 / r2 : NaNv; }, 'Bei U_ref = 0 kippt der Ausgang, wenn der Strom über R_1 den Strom über R_2 aufhebt.');
  F('uh', 'Hysterese', 'U_H', 'U_H = U_o − U_u', 'V', [['uo', 'obere Schaltschwelle', 'V', 4], ['uu', 'untere Schaltschwelle', 'V', -4]],
    function (uo, uu) { return fin(uo) && fin(uu) && uo >= uu ? uo - uu : NaNv; }, 'Abstand der beiden Schaltschwellen.');
  F('tOsz', 'Periodendauer des Rechteckgenerators', 'T', 'T = 2 · R · C · ln((1 + β) / (1 − β)), β = R_3 / (R_2 + R_3)', 's', [['r', 'Zeitglied-Widerstand', 'Ω', 10000], ['c', 'Zeitglied-Kondensator', 'F', 1e-7], ['r2', 'Mitkopplung R_2', 'Ω', 10000], ['r3', 'Widerstand R_3', 'Ω', 10000]],
    function (r, c, r2, r3) { const b = pos0(r2) && pos0(r3) ? r3 / (r2 + r3) : NaNv; return pos0(r) && pos0(c) && b > 0 && b < 1 ? 2 * r * c * Math.log((1 + b) / (1 - b)) : NaNv; }, 'Der Kondensator pendelt zwischen den beiden Schaltschwellen; bei R_2 = R_3 ist T = 2 · R · C · ln 3.');
  F('tauRelais', 'Zeitkonstante der Relaisspule', 'τ', 'τ = L / R', 's', [['l', 'Induktivität', 'H', 0.3], ['r', 'Spulenwiderstand', 'Ω', 240]],
    function (l, r) { return pos0(l) && pos0(r) ? l / r : NaNv; }, 'Nach τ ist der Strom auf 63 % seines Endwerts gestiegen.');
  F('slopeInt', 'Steigung des Integrierers', 'dU_a/dt', 'dU_a/dt = −U_e / (R · C)', 'V/s', [['ue', 'Eingangsspannung', 'V', 2], ['r', 'Widerstand', 'Ω', 100000], ['c', 'Kondensator', 'F', 1e-6]],
    function (ue, r, c) { return fin(ue) && pos0(r) && pos0(c) ? -ue / (r * c) : NaNv; }, 'Bei konstanter Eingangsspannung fällt (bzw. steigt) der Ausgang linear; das Minuszeichen ist die Invertierung.');
  F('rInt', 'Widerstand des Integrierers für |V| = 1', 'R', 'R = 1 / (2π · f · C)', 'Ω', [['f', 'Frequenz', 'Hz', 100], ['c', 'Kondensator', 'F', 22e-9]],
    function (f, c) { return pos0(f) && pos0(c) ? 1 / (TWO_PI * f * c) : NaNv; }, 'Bei dieser Frequenz ist der Betrag der Verstärkung 1; X_C = R.');
  F('tau', 'Zeitkonstante', 'τ', 'τ = R · C', 's', [['r', 'Widerstand', 'Ω', 3300], ['c', 'Kondensator', 'F', 1.5e-10]],
    function (r, c) { return pos0(r) && pos0(c) ? r * c : NaNv; }, 'Produkt aus Widerstand und Kapazität.');
  F('fgAktiv', 'Grenzfrequenz des aktiven Filters', 'f_g', 'f_g = 1 / (2π · R · C)', 'Hz', [['r', 'Widerstand', 'Ω', 100000], ['c', 'Kondensator', 'F', 1.59e-9]],
    function (r, c) { return pos0(r) && pos0(c) ? 1 / (TWO_PI * r * c) : NaNv; }, 'Beim Tiefpass gilt R = R_f, C = C_f; beim Hochpass R = R_1, C = C_1 (erste Ordnung, Übungswerte).');
  F('ueb', 'Übersteuerungsfaktor', 'ü', 'ü = I_B / I_B,min mit I_B,min = I_C / B', '', [['ib', 'Basisstrom', 'A', 0.00091489], ['ic', 'Kollektorstrom', 'A', 0.0084848], ['b', 'Gleichstromverstärkung', '', 100]],
    function (ib, ic, b) { return ib >= 0 && pos0(ic) && pos0(b) ? ib / (ic / b) : NaNv; }, 'ü = 1: Der Transistor ist gerade gesättigt; darunter ist er nur aktiv (halb offen).');
  const RANGE_MAX = 1e13;
  function argsOk(args, defs) {
    for (let i = 0; i < defs.length; i++) { const a = args[i]; if (typeof a !== 'number' || !isFinite(a) || Math.abs(a) > RANGE_MAX) return false; }
    return true;
  }
  const formulas = {};
  const FMLIST = FD.map(function (m) {
    const argd = m.args.map(function (a) { return { key: a[0], label: a[1], unit: a[2], def: a[3] }; });
    const fn = function () {
      try {
        const a = arguments;
        if (a.length < argd.length || !argsOk(a, argd)) return NaN;
        const v = m.core.apply(null, a);
        return typeof v === 'number' && isFinite(v) ? v : NaN;
      } catch (e) { return NaN; }
    };
    const run = function (first) {
      try {
        let vals;
        if (isObj(first)) vals = argd.map(function (d) { return first[d.key]; });
        else vals = Array.prototype.slice.call(arguments);
        vals = vals.map(function (v) { return typeof v === 'string' ? parseNum(v) : v; });
        for (let i = 0; i < argd.length; i++) if (typeof vals[i] !== 'number' || !isFinite(vals[i])) return { ok: false, valid: false, value: NaN, unit: m.unit, why: 'Die Eingabe „' + argd[i].key + '“ fehlt oder ist keine Zahl.', text: '' };
        const v = fn.apply(null, vals);
        if (!isFinite(v)) return { ok: false, valid: false, value: NaN, unit: m.unit, why: 'Mit diesen Werten gibt es kein Ergebnis (Wertebereich der Formel beachten).', text: '' };
        return { ok: true, valid: true, id: m.id, value: v, unit: m.unit, why: '', text: m.symbol + ' = ' + (m.unit && m.unit.indexOf('/') < 0 ? fe(v, m.unit) : fmt(v) + (m.unit ? ' ' + m.unit : '')) };
      } catch (e) { return { ok: false, valid: false, value: NaN, unit: m.unit, why: 'Die Eingaben sind ungültig.', text: '' }; }
    };
    const entry = function () { return fn.apply(null, arguments); };
    [['id', m.id], ['name', m.name], ['symbol', m.symbol], ['expr', m.expr], ['unit', m.unit], ['args', Object.freeze(argd)], ['fn', fn], ['run', run], ['calc', run], ['explain', m.explain]].forEach(function (p) {
      Object.defineProperty(entry, p[0], { value: p[1], enumerable: true, writable: false, configurable: true });
    });
    formulas[m.id] = entry;
    return entry;
  });
  hide(formulas, 'list', function () { try { return FMLIST.slice(); } catch (e) { return []; } });
  hide(formulas, 'get', function (id) { try { return Object.prototype.hasOwnProperty.call(formulas, id) ? formulas[id] : null; } catch (e) { return null; } });
  hide(formulas, 'ids', function () { return FD.map(function (m) { return m.id; }); });
  C.extend('formulas', formulas);
  const FN = function (id) { return formulas[id].fn; };

  /* =============================== Bewertung (assess) =============================== */
  const RANK = { grau: 0, gruen: 1, gelb: 2, rot: 3 };
  const AMPEL_TXT = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const KEINE_VORGABE = 'Keine Vorgabe gesetzt.';
  function rate(dev, g, y) { return dev <= g + 1e-12 ? 'gruen' : (dev <= y + 1e-12 ? 'gelb' : 'rot'); }
  function relDev(ist, soll) { return Math.abs(ist - soll) / Math.abs(soll); }
  function fv(x, unit) { return unit && unit.indexOf('/') < 0 ? fe(x, unit) : fmt(x) + (unit ? ' ' + unit : ''); }
  function zielVal(st, k) { const v = num(st[k], NaN); return isFinite(v) && v > 0 ? v : NaN; }
  /* Zeile einer Bewertung: Abweichung relativ (dev in Anteilen) */
  function critRel(list, name, ist, soll, unit, g, y) {
    const dev = fin(ist) ? relDev(ist, soll) : Infinity, ampel = rate(dev, g, y);
    list.push({ name: name, ist: ist, soll: soll, abw: isFinite(dev) ? dev * 100 : NaN, ampel: ampel,
      text: name + ' ' + fv(ist, unit) + ', Vorgabe ' + fv(soll, unit) + ': Abweichung ' + (isFinite(dev) ? fmt(dev * 100, 1) + ' %' : 'nicht rechenbar') + ' (' + AMPEL_TXT[ampel] + '; grün bis ' + pc(g, 0) + ', gelb bis ' + pc(y, 0) + UEBUNG + ').' });
  }
  function crit(list, name, ist, soll, ampel, text, abw) { list.push({ name: name, ist: ist, soll: soll, abw: abw === undefined ? NaN : abw, ampel: ampel, text: text }); }
  function finish(list, st, zkeys) {
    if (!list.length) return { ok: true, valid: true, ampel: 'grau', text: KEINE_VORGABE, punkte: [] };
    let ampel = 'gruen', margin = 0;
    list.forEach(function (k) { if (RANK[k.ampel] > RANK[ampel]) ampel = k.ampel; if (isFinite(k.abw) && k.abw > margin) margin = k.abw; });
    const z = {}; zkeys.forEach(function (k) { if (isFinite(zielVal(st, k))) z[k] = zielVal(st, k); });
    return { ok: true, valid: true, ampel: ampel, text: list.map(function (k) { return k.text; }).join(' '), margin: margin, ziel: z, punkte: list };
  }
  const ZKEYS = { diode: ['ziel'], schalter: ['ziel'], emitter: ['zielUce', 'zielVu'], folger: ['ziel'], opv_inv: ['zielV'], opv_nin: ['zielV'], opv_komp: ['zielUh', 'zielF'], opv_aktiv: ['zielF'] };
  const zustandTxt = { sperrt: 'sperrt', saettigung: 'ist gesättigt', aktiv: 'ist aktiv', defekt: 'ist defekt' };

  function assessDiode(M, st, list) {
    const r = M.r, z = zielVal(st, 'ziel'), G = limN('fenster_gruen'), Y = limN('fenster_gelb');
    if (!isFinite(z)) return;
    if (r.zustand === 'verpolt') crit(list, 'Polung', r.id, z, 'rot', 'Das Bauteil liegt in der falschen Richtung (U_D = ' + fe(r.ud, 'V') + ', I = ' + fe(r.id, 'A') + '): Es fließt nicht der verlangte Strom (rot).');
    else if (r.zustand === 'sperrt') crit(list, 'Zustand', r.id, z, 'rot', 'Das Bauteil sperrt (U_D = ' + fe(r.ud, 'V') + '): Es fließt kein Strom, verlangt sind ' + fe(z, 'A') + ' (rot).');
    critRel(list, 'Strom I =', Math.max(0, r.id), z, 'A', G, Y);
    if (r.ueberlast) {
      if (/^led/.test(M.ctl.typ) || r.typ && /^led/.test(r.typ)) crit(list, 'Überlast', r.id, limN('led_imax'), 'rot', 'Strom I = ' + fe(r.id, 'A') + ' bei zulässigem Strom ' + limT('led_imax') + ': Die LED wäre überlastet (rot).');
      else crit(list, 'Überlast', r.pd, limN('pz_max'), 'rot', 'Verlustleistung P_Z = ' + fe(r.pd, 'W') + ' bei zulässigen ' + limT('pz_max') + ': Die Z-Diode wäre überlastet (rot).');
    }
  }
  function assessSchalter(M, st, list) {
    const r = M.r, rel = M.rel, z = zielVal(st, 'ziel'), G = limN('fenster_gruen'), Y = limN('fenster_gelb'), ueMin = limN('ue_min');
    if (!isFinite(z)) return;
    critRel(list, 'Laststrom I_C =', r.ic, z, 'A', G, Y);
    if (r.zustand === 'sperrt') crit(list, 'Zustand', r.ic, z, 'rot', 'Der Transistor sperrt (U_CE = ' + fe(r.uce, 'V') + '): Die Last bekommt keinen Strom (rot).');
    else if (r.zustand === 'aktiv') crit(list, 'Zustand', r.ueb, 1, 'rot', 'Der Transistor ist nur aktiv, nicht gesättigt: ü = ' + fmt(r.ueb, 2) + ' ist kleiner als 1 (halb offen, U_CE = ' + fe(r.uce, 'V') + ', P_V = ' + fe(r.pv, 'W') + ') (rot).');
    else if (r.zustand === 'defekt') crit(list, 'Zustand', r.ic, z, 'rot', 'Der Transistor schaltet nicht: I_C = ' + fe(r.ic, 'A') + ', U_CE = ' + fe(r.uce, 'V') + ' (rot).');
    else if (r.zustand === 'saettigung') {
      if (r.ueb >= ueMin - 1e-12) crit(list, 'Übersteuerung', r.ueb, ueMin, 'gruen', 'Der Transistor ist gesättigt, ü = ' + fmt(r.ueb, 2) + ' (mindestens ' + limT('ue_min') + '; grün).');
      else crit(list, 'Übersteuerung', r.ueb, ueMin, 'gelb', 'Der Transistor ist gesättigt, aber ü = ' + fmt(r.ueb, 2) + ' liegt zwischen 1 und ' + limT('ue_min') + ' (gelb; die Streuung von B könnte ihn aus der Sättigung holen).');
    }
    if (r.ic > limN('icmax') + 1e-12) crit(list, 'Überlast', r.ic, limN('icmax'), 'rot', 'Kollektorstrom I_C = ' + fe(r.ic, 'A') + ' bei zulässigen ' + limT('icmax') + ': Der Transistor wäre überlastet (rot).');
    if (r.pv > limN('ptot') + 1e-12) crit(list, 'Überlast', r.pv, limN('ptot'), 'rot', 'Verlustleistung P_V = ' + fe(r.pv, 'W') + ' bei zulässigen ' + limT('ptot') + ': Der Transistor wäre überlastet (rot).');
    if (rel) {
      if (rel.ueberUceo) crit(list, 'Spannungsspitze', rel.ucePeak, limN('uceo'), 'rot', 'Beim Abschalten steigt die Spannung am Transistor bis ' + fe(rel.ucePeak, 'V') + ' (zulässig ' + limT('uceo') + '): Das Relais braucht eine Freilaufdiode (rot).');
      else crit(list, 'Spannungsspitze', rel.ucePeak, limN('uceo'), 'gruen', 'Die Spannungsspitze am Transistor bleibt bei ' + fe(rel.ucePeak, 'V') + ' (zulässig ' + limT('uceo') + '; grün).');
    }
  }
  function assessEmitter(M, st, list) {
    const r = M.r, zU = zielVal(st, 'zielUce'), zV = zielVal(st, 'zielVu'), fen = limN('ap_fenster'), G = limN('fenster_gruen'), Y = limN('fenster_gelb');
    if (!isFinite(zU) && !isFinite(zV)) return;
    const ub = M.cfg.ub;
    if (r.valid === false) {
      const zt = r.zustand || (M.dc && M.dc.zustand);
      crit(list, 'Arbeitspunkt', r.uce, zU, 'rot', 'Der Transistor ' + (zustandTxt[zt] || 'arbeitet nicht im aktiven Bereich') + ' (U_CE = ' + fe(r.uce, 'V') + ', I_C = ' + fe(r.ic, 'A') + '): keine Verstärkung, Arbeitspunkt nicht in Ordnung (rot).');
    } else if (isFinite(zU)) {
      const dev = Math.abs(r.uce - zU) / ub, ampel = rate(dev, fen, 2 * fen);
      crit(list, 'Arbeitspunkt', r.uce, zU, ampel, 'U_CE = ' + fe(r.uce, 'V') + ', Vorgabe ' + fe(zU, 'V') + ': Abweichung ' + fmt(dev * 100, 1) + ' % der Betriebsspannung U_B (' + AMPEL_TXT[ampel] + '; grün bis ' + pc(fen, 0) + ', gelb bis ' + pc(2 * fen, 0) + UEBUNG + ').', dev * 100);
    }
    if (isFinite(zV)) critRel(list, '|V_u| =', r.valid === false ? NaN : Math.abs(r.vu), zV, '', G, Y);
    if (M.large && M.large.clip) {
      const w = M.large.clip === 'unten' ? 'die negative Halbwelle des Ausgangs (Sättigung)' : (M.large.clip === 'oben' ? 'die positive Halbwelle des Ausgangs (Sperren)' : 'beide Halbwellen des Ausgangs');
      crit(list, 'Begrenzen', M.large.uaPeak, r.uaMax, 'rot', 'Das Signal wird begrenzt: ' + w + ' ist abgeflacht (Spitze ' + fe(M.large.uaPeak, 'V') + ', Aussteuergrenze ' + fe(r.uaMax, 'V') + ') (rot).');
    }
  }
  function assessFolger(M, st, list) {
    const z = zielVal(st, 'ziel'), G = limN('fenster_gruen'), Y = limN('fenster_gelb');
    if (!isFinite(z)) return;
    const r = M.r;
    if (M.betrieb === 'signal') {
      if (r.valid === false) { crit(list, 'Arbeitspunkt', NaN, z, 'rot', 'Der Transistor arbeitet nicht im aktiven Bereich (' + (zustandTxt[r.zustand] || '') + ', I_C = ' + fe(r.ic, 'A') + '): kein Ausgangswiderstand (rot).'); return; }
      const ist = M.sel.rout, ampel = ist <= z + 1e-12 ? 'gruen' : (ist <= z * (1 + Y) + 1e-12 ? 'gelb' : 'rot');
      crit(list, 'Ausgangswiderstand', ist, z, ampel, 'Ausgangswiderstand r_aus = ' + fe(ist, 'Ω') + ', Vorgabe höchstens ' + fe(z, 'Ω') + ' (' + AMPEL_TXT[ampel] + '; gelb bis ' + pc(Y, 0) + ' darüber' + UEBUNG + ').', ist <= z ? 0 : (ist - z) / z * 100);
    } else if (M.betrieb === 'zener') {
      if (!r.ok) { crit(list, 'Emitterspannung', NaN, z, 'rot', 'Die Schaltung arbeitet nicht: ' + r.why + ' (rot).'); return; }
      critRel(list, 'Emitterspannung U_E =', r.ue, z, 'V', G, Y);
    } else {
      if (!r.ok) { crit(list, 'Kollektorstrom', NaN, z, 'rot', 'Die Stromquelle liefert nichts: ' + r.why + ' (rot).'); return; }
      critRel(list, 'Kollektorstrom I_C =', r.ic * 1e3, z, 'mA', G, Y);
    }
  }
  function assessOp(M, st, list, rigId) {
    const z = zielVal(st, 'zielV'), G = limN('fenster_op_gruen'), Y = limN('fenster_op_gelb');
    if (!isFinite(z)) return;
    const r = M.r;
    let ist;
    if (rigId === 'opv_inv') ist = M.summe ? Math.abs(r.vk && r.vk[0]) : Math.abs(r.v);
    else ist = M.ctl.schaltung === 'differenz' ? Math.abs(r.a1) : Math.abs(r.v);
    critRel(list, '|V_u| =', ist, z, '', G, Y);
    if (r.sat) crit(list, 'Begrenzen', r.ualin, r.usat, 'rot', 'Der Ausgang ist begrenzt (|U_a,lin| = ' + fe(Math.abs(r.ualin), 'V') + ' ≥ U_sat = ' + fe(r.usat, 'V') + ')' + (isFinite(r.ueMax) ? ': U_e,max = ' + fe(r.ueMax, 'V') : '') + ' (rot).');
  }
  function assessKomp(M, st, list) {
    const zU = zielVal(st, 'zielUh'), zF = zielVal(st, 'zielF'), G = limN('fenster_op_gruen'), Y = limN('fenster_op_gelb'), r = M.r, art = M.art;
    if (art === 'rechteck' && r.valid === false) {
      if (isFinite(zU) || isFinite(zF)) crit(list, 'Schwingen', NaN, NaN, 'rot', 'Der Rechteckgenerator schwingt nicht: ' + r.why + ' (rot).');
      return;
    }
    if (isFinite(zU) && art !== 'komparator') critRel(list, 'Hysterese U_H =', r.uh, zU, 'V', G, Y);
    if (isFinite(zF) && art === 'rechteck') critRel(list, 'Frequenz f =', r.f, zF, 'Hz', G, Y);
  }
  function assessAktiv(M, st, list) {
    const z = zielVal(st, 'zielF'), G = limN('fenster_gruen'), Y = limN('fenster_gelb');
    if (!isFinite(z)) return;
    const r = M.r;
    if (!isFinite(M.fref)) crit(list, 'Grenzfrequenz', NaN, z, 'rot', M.art === 'real' ? 'Der ideale Operationsverstärker hat keine Grenzfrequenz: Wähle den realen Operationsverstärker (rot).' : 'Die Grenzfrequenz ist nicht rechenbar (rot).');
    else critRel(list, 'Grenzfrequenz f_g =', M.fref, z, 'Hz', G, Y);
    let sat = false, peak = NaN, usat = NaN;
    if (M.wcfg) {
      const w = KAC().wave(Object.assign({}, M.wcfg, { ue: M.ctl.ue, f: M.ctl.f, form: M.ctl.form }), 128);
      if (w && w.ok && w.valid !== false) { peak = w.uaPeak; usat = w.usat; sat = isFinite(peak) && isFinite(usat) && peak >= usat - 1e-9 * Math.max(1, usat); }
    } else if (r && r.sat) { sat = true; peak = Math.abs(r.ualin); usat = r.usat; }
    if (sat) crit(list, 'Begrenzen', peak, usat, 'rot', 'Der Ausgang ist begrenzt (Spitze ' + fe(peak, 'V') + ' an der Aussteuergrenze ' + fe(usat, 'V') + (M.art === 'integrierer' ? ': Der Integrierer läuft in die Sättigung' : '') + ') (rot).');
  }
  const ASSESS = { diode: assessDiode, schalter: assessSchalter, emitter: assessEmitter, folger: assessFolger, opv_komp: assessKomp, opv_aktiv: assessAktiv };
  function assessCore(rigId, state) {
    const id = String(rigId);
    if (!DEF[id]) V('Den Prüfstand „' + id.slice(0, 30) + '“ gibt es nicht.');
    const st = obj(state);
    if (!ZKEYS[id].some(function (k) { return isFinite(zielVal(st, k)); })) return { ok: true, valid: true, ampel: 'grau', text: KEINE_VORGABE, punkte: [] };
    const M = buildModel(id, st), list = [];
    if (id === 'opv_inv' || id === 'opv_nin') assessOp(M, st, list, id); else ASSESS[id](M, st, list);
    if (!list.length) return { ok: true, valid: true, ampel: 'grau', text: 'Keine Vorgabe gesetzt, die zu dieser Schaltung passt.', punkte: [] };
    return finish(list, st, ZKEYS[id]);
  }
  const assess = function (rigId, state) {
    try {
      const r = SG(assessCore)(rigId, state);
      if (!r || r.ok !== true) return { ok: false, ampel: 'grau', text: r && r.why ? r.why : 'Mit diesen Eingaben gibt es keine Bewertung.', why: r && r.why ? r.why : 'Mit diesen Eingaben gibt es keine Bewertung.' };
      return r;
    } catch (e) { return { ok: false, ampel: 'grau', text: 'Mit diesen Eingaben gibt es keine Bewertung.', why: 'Mit diesen Eingaben gibt es keine Bewertung.' }; }
  };
  C.extend('assess', assess);

  /* =============================== Messreihe (report) =============================== */
  const REP_N = 12;
  const BT_KEYS = {
    diode: ['typ', 'modell', 'rv', 'uz', 'rlast'], schalter: ['last', 'rb', 'b', 'uf', 'rv', 'rspule', 'lspule', 'rlast'],
    emitter: ['r1', 'r2', 'rc', 're1', 're2', 'ce', 'c1', 'c2', 'b', 'rl'], folger: ['betrieb', 'schaltung', 'r1', 'r2', 'rc', 're1', 're2', 'b', 'rl', 'uz', 'iz', 'ic', 'nd', 'ud'],
    opv_inv: ['schaltung', 'opv', 'r1', 'rf', 'r2', 'r3'], opv_nin: ['schaltung', 'opv', 'rg', 'rf', 'r1', 'r2', 'r3', 'r4'],
    opv_komp: ['schaltung', 'opv', 'r1', 'r2', 'r3', 'rt', 'c'], opv_aktiv: ['schaltung', 'opv', 'r1', 'rf', 'c', 'rs']
  };
  const Q_KEYS = {
    diode: ['uq', 'temp'], schalter: ['ub', 'ust'], emitter: ['ub', 'ue', 'f', 'rg'], folger: ['ub', 'ue', 'f', 'rg'],
    opv_inv: ['uv', 'ue', 'f', 'ue2', 'ue3'], opv_nin: ['uv', 'ue', 'f', 'u1', 'u2'], opv_komp: ['uv', 'uref', 'ue', 'f'], opv_aktiv: ['uv', 'ue', 'f']
  };
  function colsFor(rigId, M) {
    const x = function (key, label, unit) { return { key: key, label: label, unit: unit }; };
    switch (rigId) {
      case 'diode': return [x('x', 'Spannung U', 'V'), x('y', 'Strom I', 'A')];
      case 'schalter': return [x('x', 'Steuerspannung U_St', 'V'), x('y', 'Kollektorstrom I_C', 'A'), x('y2', 'Kollektor-Emitter-Spannung U_CE', 'V')];
      case 'emitter': return [x('x', 'Frequenz f', 'Hz'), x('y', 'Verstärkung |V_u| mit Quellenwiderstand', '')];
      case 'folger': return [x('x', 'Lastwiderstand R_L', 'Ω'), x('y', 'Spannung an der Last mit Schaltung U_a', 'V'), x('y2', 'Spannung an der Last bei direktem Anschluss', 'V')];
      case 'opv_komp': return [x('x', 'Eingangsspannung U_e', 'V'), x('y', 'Ausgangsspannung U_a aufwärts', 'V'), x('y2', 'Ausgangsspannung U_a abwärts', 'V')];
      default: return [x('x', 'Frequenz f', 'Hz'), x('y', 'Verstärkung |V|', ''), x('y2', 'Phase φ', '°')];
    }
  }
  function lin(a, b, n) { const o = []; for (let i = 0; i < n; i++) o.push(a + (b - a) * i / (n - 1)); return o; }
  function logg(a, b, n) { const o = []; for (let i = 0; i < n; i++) o.push(a * Math.pow(b / a, i / (n - 1))); return o; }
  const RX_ERROR = {
    schalter_valid: 'Mit diesen Werten (Betriebsspannung zu klein) gibt es keine Messreihe.'
  };
  /* Modell der Messreihe: Rasterpunkte xs, Zeilen row(x) (ohne Rauschen), Kennwerte ausw */
  function repModel(rigId, state) {
    const id = String(rigId);
    if (!DEF[id]) V('Den Prüfstand „' + id.slice(0, 30) + '“ gibt es nicht.');
    const M = buildModel(id, state), c = M.ctl, cols = colsFor(id, M);
    const mk = function (xs, row, ausw, schaltung, extra) { return Object.assign({ M: M, cols: cols, xs: xs, row: row, ausw: ausw, schaltung: schaltung }, extra || {}); };
    const st = Object.assign({}, c);
    if (id === 'diode') {
      const zz = c.typ === 'z', ref0 = (C.diode.types.filter(function (t) { return t.id === c.typ; })[0] || {}).uf, top = zz ? 1.2 * (M.cfg.uz || c.uz) : 1.1 * (fin(M.r.uf) ? M.r.uf : ref0);
      const xs = lin(0, top, REP_N);
      const cv = needOk(C.diode.curve(Object.assign({}, M.cfg), xs));
      return mk(xs, function (x) { const k = xs.indexOf(x); const r = k >= 0 ? cv.i[k] : C.diode.curve(M.cfg, [x]).i[0]; return { y: r }; },
        { ud: M.r.ud, id: M.r.id }, 'Bauteilkennlinie ' + (zz ? 'Z-Diode' : 'Diode'));
    }
    if (id === 'schalter') {
      const xs = lin(0, M.cfg.ub > 1 ? M.cfg.ub : 5, REP_N);
      return mk(xs, function (x) { const m = buildModel('schalter', Object.assign({}, st, { ust: x })); return { y: m.r.ic, y2: m.r.uce }; }, { ic: M.r.ic, uce: M.r.uce }, 'Transistor als Schalter');
    }
    if (id === 'emitter') {
      if (M.r.valid === false) return { ok: false, why: M.r.why || 'Der Transistor arbeitet nicht im aktiven Bereich: keine Verstärkung zu messen.' };
      const a = M.r, xs = logg(10, 1e6, REP_N);
      const hp = function (f, f0) { return f0 > 0 ? f / Math.sqrt(f * f + f0 * f0) : 1; };
      return mk(xs, function (f) { return { y: Math.abs(a.vus) * hp(f, a.f1) * hp(f, a.f2) }; }, { ic: a.ic, uce: a.uce, vu: a.vu }, 'Emitterschaltung');
    }
    if (id === 'folger') {
      if (M.betrieb !== 'signal') return { ok: false, why: 'Für die Betriebsart „' + M.betrieb + '“ gibt es keine Messreihe; sie gilt für die Betriebsart „signal“.' };
      if (M.r.valid === false) return { ok: false, why: M.r.why || 'Der Transistor arbeitet nicht im aktiven Bereich.' };
      const xs = logg(10, 1e6, REP_N);
      const ue = M.ue;
      return mk(xs, function (rl) {
        const m = buildModel('folger', Object.assign({}, st, { rl: rl }));
        const rg = c.rg, direkt = rl / (rg + rl);
        return { y: ue * Math.abs(m.sel.vus), y2: ue * direkt };
      }, { vu: M.sel.vu, rout: M.sel.rout }, 'Grundschaltung ' + M.schaltung);
    }
    if (id === 'opv_inv' || id === 'opv_nin' || id === 'opv_aktiv') {
      if (c.opv === 'ideal') return { ok: false, why: 'Der ideale Operationsverstärker hat keinen Frequenzgang. Wähle den realen Operationsverstärker (langsam oder schnell).' };
      let fc = NaN, fcfg, ausw, text;
      if (id === 'opv_inv') {
        fcfg = Object.assign({ art: 'inv', r1: M.cfg.r1, rf: M.cfg.rf }, M.base); fc = M.r.fg; if (M.summe) fc = M.inv && M.inv.fg;
        ausw = { v: M.summe ? M.inv.v : M.r.v, fg: fc }; text = M.summe ? 'Summierer (erster Eingang)' : 'Invertierender Verstärker';
      } else if (id === 'opv_nin') {
        if (c.schaltung === 'differenz') return { ok: false, why: 'Für den Differenzverstärker gibt es hier keine Frequenzgang-Messreihe (wähle nichtinvertierend oder Folger).' };
        fcfg = Object.assign({ art: 'nin', rg: M.cfg.rg, rf: c.schaltung === 'folger' ? 0 : M.cfg.rf }, M.base); fc = M.r.fg; ausw = { v: M.r.v, fg: fc };
        text = c.schaltung === 'folger' ? 'Spannungsfolger' : 'Nichtinvertierender Verstärker';
      } else {
        if (M.art === 'real') { fcfg = Object.assign({ art: 'inv', r1: M.cfg.r1, rf: c.rf }, M.base); fc = M.fref; ausw = { fg: fc }; text = 'Realer Operationsverstärker (invertierend)'; }
        else { fcfg = null; fc = M.fref; ausw = { fg: fc }; text = ({ integrierer: 'Integrierer', differenzierer: 'Differenzierer', tiefpass: 'Aktiver Tiefpass', hochpass: 'Aktiver Hochpass' })[M.art] || 'Aktive Schaltung'; }
      }
      if (!isFinite(fc) || fc <= 0) return { ok: false, why: 'Für diese Einstellung gibt es keinen Frequenzgang (Grenzfrequenz nicht rechenbar).' };
      const xs = needOk(C.grid(fc, REP_N, 1.5, 1.5).length ? { ok: true, l: C.grid(fc, REP_N, 1.5, 1.5) } : fail('Das Frequenzraster fehlt.')).l;
      const respAll = function (fl) {
        if (fcfg) { const r = KOP().freq(fcfg, fl); return r && r.ok && r.valid !== false ? r : null; }
        const w = M.wcfg; const r = KAC().response(Object.assign({}, w), fl); return r && r.ok ? r : null;
      };
      const resp = respAll(xs);
      if (!resp) return { ok: false, why: 'Der Frequenzgang ist für diese Einstellung nicht rechenbar.' };
      return mk(xs, function (f) { const k = xs.indexOf(f); const r = k >= 0 ? resp : respAll([f]); const j = k >= 0 ? k : 0; return { y: r.h[j], y2: r.phi[j] }; }, ausw, text);
    }
    if (id === 'opv_komp') {
      const art = M.art;
      if (art === 'rechteck') return { ok: false, why: 'Der Rechteckgenerator hat keine Eingangsspannung: Miss stattdessen Periodendauer und Schwellen am Prüfstand (Messreihe nur für Komparator und Schmitt-Trigger).' };
      const r = M.r;
      let ulim, rowf, ausw = {};
      if (art === 'komparator') {
        ulim = Math.max(1, c.ue);
        const xs = lin(-ulim, ulim, REP_N);
        return mk(xs, function (x) { const o = KKO().comparator(Object.assign({ up: x, un: c.uref }, M.base)); return { y: o.ua, y2: o.ua }; }, ausw, 'Komparator ohne Gegenkopplung');
      }
      ulim = Math.max(1.5 * Math.max(Math.abs(r.uo), Math.abs(r.uu)), Math.abs(c.uref) + 1, 1);
      const xs = lin(-ulim, ulim, REP_N), sc = { art: art === 'schmitt_nin' ? 'nin' : 'inv', r1: c.r1, r2: M.cfg.r2, r3: M.cfg.r3, uref: c.uref };
      const scfg = Object.assign({}, sc, M.base), inv = scfg.art === 'inv';
      const up = KKO().sweep(scfg, xs, inv);
      if (!up || !up.ok) return { ok: false, why: (up && up.why) || 'Der Eingangsdurchlauf ist nicht rechenbar.' };
      const lastHigh = up.ua[up.ua.length - 1] > 0;
      const xr = xs.slice().reverse(), dn = KKO().sweep(scfg, xr, lastHigh);
      if (!dn || !dn.ok) return { ok: false, why: (dn && dn.why) || 'Der Eingangsdurchlauf ist nicht rechenbar.' };
      const yd = dn.ua.slice().reverse();
      rowf = function (x) { const k = xs.indexOf(x); return { y: up.ua[k], y2: yd[k] }; };
      ausw = { uo: r.uo, uu: r.uu };
      return mk(xs, rowf, ausw, art === 'schmitt_nin' ? 'Nichtinvertierender Schmitt-Trigger' : 'Invertierender Schmitt-Trigger');
    }
    V('Für diesen Prüfstand gibt es keine Messreihe.');
  }
  const AUSW_DEF = {
    diode: [['ud', 'Spannung am Bauteil U_D', 'V', 0.03], ['id', 'Strom I', 'A', 0.03]],
    schalter: [['ic', 'Kollektorstrom I_C', 'A', 0.03], ['uce', 'Kollektor-Emitter-Spannung U_CE', 'V', 0.03]],
    emitter: [['ic', 'Kollektorstrom I_C', 'A', 0.03], ['uce', 'Kollektor-Emitter-Spannung U_CE', 'V', 0.03], ['vu', 'Spannungsverstärkung V_u', '', 0.03]],
    folger: [['vu', 'Spannungsverstärkung V_u', '', 0.03], ['rout', 'Ausgangswiderstand r_aus', 'Ω', 0.03]],
    opv_inv: [['v', 'Spannungsverstärkung V_u', '', 0.03], ['fg', 'Grenzfrequenz f_g', 'Hz', 0.05]],
    opv_nin: [['v', 'Spannungsverstärkung V_u', '', 0.03], ['fg', 'Grenzfrequenz f_g', 'Hz', 0.05]],
    opv_komp: [['uo', 'obere Schaltschwelle U_o', 'V', 0.03], ['uu', 'untere Schaltschwelle U_u', 'V', 0.03]],
    opv_aktiv: [['fg', 'Grenzfrequenz f_g', 'Hz', 0.05]]
  };
  function repKeysOf(rigId, M) {
    let a = AUSW_DEF[rigId].map(function (d) { return { key: d[0], label: d[1], unit: d[2], tol: d[3] }; });
    return a;
  }
  const report = {};
  report.template = Object.freeze([
    { key: 'name', label: 'Name', typ: 'text', pflicht: true },
    { key: 'datum', label: 'Datum', typ: 'text', pflicht: true },
    { key: 'schaltung', label: 'Schaltung', typ: 'auswahl', pflicht: true },
    { key: 'bauteile', label: 'Bauteilwerte', typ: 'zahlen', pflicht: true },
    { key: 'quelle', label: 'Quelle (Spannungen, Frequenz)', typ: 'zahlen', pflicht: true },
    { key: 'messreihe', label: 'Messreihe', typ: 'tabelle', pflicht: true },
    { key: 'auswertung', label: 'Auswertung (I_C, U_CE, V_u, f_g, U_o, U_u …)', typ: 'zahlen', pflicht: true },
    { key: 'ergebnis', label: 'Ergebnis', typ: 'text', pflicht: true }
  ]);
  function pickKeys(c, keys) { const o = {}; keys.forEach(function (k) { if (c[k] !== undefined && c[k] !== null) o[k] = c[k]; }); return o; }
  report.generate = SG(function (rigId, state, seed) {
    const id = String(rigId);
    const m = repModel(id, state);
    if (m.ok === false) return { ok: true, valid: false, rigId: id, why: m.why, hinweis: TEXTS.protoHinweis };
    const sd = seed === undefined || seed === null ? 1 : num(seed, NaN);
    if (!isFinite(sd) || Math.abs(sd) > 1e9) V('Der Startwert (seed) muss eine Zahl sein.');
    const rnd = C.rng(sd), noise = GV('report_rauschen');
    const rows = m.xs.map(function (x) {
      const e = m.row(x), row = { x: x };
      ['y', 'y2'].forEach(function (k) {
        if (e[k] === undefined) return;
        const col = m.cols.filter(function (cc) { return cc.key === k; })[0];
        const r1 = 2 * rnd() - 1;
        row[k] = col && col.unit === '°' ? e[k] + 0.5 * r1 : e[k] * (1 + noise * r1);
      });
      return row;
    });
    const c = m.M.ctl, zustand = snap(c);
    const bt = pickKeys(c, BT_KEYS[id]), qu = pickKeys(c, Q_KEYS[id]);
    const entry = { rigId: id, name: '', datum: '', schaltung: m.schaltung, bauteile: bt, quelle: qu, spalten: m.cols.map(function (cc) { return Object.assign({}, cc); }), messreihe: rows.map(function (r) { return Object.assign({}, r); }), rows: rows.map(function (r) { return Object.assign({}, r); }), auswertung: {}, ergebnis: '', seed: sd, zustand: zustand, hinweis: TEXTS.protoHinweis };
    const ausw = {};
    repKeysOf(id, m.M).forEach(function (d) { if (isFinite(m.ausw[d.key])) ausw[d.key] = m.ausw[d.key]; });
    return { ok: true, valid: true, rigId: id, seed: sd, spalten: entry.spalten, rows: rows, entry: entry, ref: { rigId: id, state: zustand, ausw: ausw }, hinweis: TEXTS.protoHinweis };
  });
  function isEmptyS(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function hintAusw(rigId, key, v, e, m) {
    const sgnOk = (v < 0) === (e < 0) || v === 0;
    if (!sgnOk && (key === 'vu' || key === 'v')) return rigId === 'emitter' ? ' Prüfe das Vorzeichen: Die Emitterschaltung dreht die Phase um 180°, V_u ist negativ.' : (rigId === 'opv_inv' ? ' Prüfe das Vorzeichen: Der invertierende Verstärker dreht die Phase um 180°, V_u ist negativ.' : ' Prüfe das Vorzeichen: V_u ist hier positiv (gleichphasig).');
    if (rigId === 'emitter' && key === 'vu') {
      const leer = m.M.r.vuLeer, us = m.M.r.vus;
      if (isFinite(leer) && Math.abs(Math.abs(v) - Math.abs(leer)) <= 0.03 * Math.abs(leer)) return ' Prüfe, ob du die Last mitgerechnet hast: Der Wert gilt für den Leerlauf.';
      if (isFinite(us) && Math.abs(Math.abs(v) - Math.abs(us)) <= 0.03 * Math.abs(us)) return ' Der Wert enthält den Quellenwiderstand; gefragt ist V_u von der Basis zum Ausgang.';
      return ' Prüfe, ob du die Last und den ungebrückten Emitterwiderstand mitgerechnet hast.';
    }
    if ((rigId === 'opv_inv' || rigId === 'opv_nin') && key === 'v') {
      const vn = m.M.r.vn;
      if (isFinite(vn) && Math.abs(Math.abs(v) - vn) <= 0.03 * vn) return ' Prüfe die Formel: V_u = −R_f/R_1 (invertierend) gegen V_u = 1 + R_f/R_g (nichtinvertierend).';
      return ' Prüfe die Formel und die Einheiten der Widerstände.';
    }
    if (key === 'fg' || key === 'f0') {
      const r = v / e;
      if (Math.abs(r / TWO_PI - 1) < 0.03) return ' Der Wert ist rund 6,28-mal zu groß: Prüfe, ob du ω statt f eingetragen hast.';
      if (Math.abs(r * TWO_PI - 1) < 0.03) return ' Der Wert ist rund 6,28-mal zu klein: Prüfe, ob du 2π vergessen hast (f = ω / 2π).';
      return ' Prüfe, ob du die Grenzfrequenz bei −3 dB abgelesen hast.';
    }
    return ' Prüfe die Formel und die Einheiten.';
  }
  report.check = SG(function (entry, ref) {
    reqObj(entry);
    const rigId = String(entry.rigId);
    if (!DEF[rigId]) V('Für diesen Prüfstand gibt es keine Messreihe.');
    const rf = isObj(ref) ? (isObj(ref.ref) ? ref.ref : ref) : null;
    const state = rf && isObj(rf.state) ? rf.state : entry.zustand;
    if (!isObj(state)) V('Zum Prüfen fehlt der Zustand der Anlage (zustand).');
    const m = repModel(rigId, state);
    if (m.ok === false) V(m.why);
    const items = [], tol = GV('report_tol');
    function add(feld, okv, text) { items.push({ feld: feld, ok: okv, text: text }); }
    [['name', 'Der Name'], ['datum', 'Das Datum'], ['schaltung', 'Die Schaltung'], ['ergebnis', 'Das Ergebnis']].forEach(function (p) {
      add(p[0], !isEmptyS(entry[p[0]]), isEmptyS(entry[p[0]]) ? p[1] + ' fehlt (Pflichtfeld).' : p[1] + ' ist eingetragen.');
    });
    const bt = isObj(entry.bauteile) ? Object.keys(entry.bauteile).length : 0;
    add('bauteile', bt > 0, bt > 0 ? 'Die Bauteilwerte sind eingetragen.' : 'Die Bauteilwerte fehlen (Pflichtfeld).');
    if (bt > 0) {
      Object.keys(entry.bauteile).forEach(function (k) {
        const b = m.M.ctl[k];
        if (typeof b !== 'number') return;
        const a = typeof entry.bauteile[k] === 'string' ? parseNum(entry.bauteile[k]) : entry.bauteile[k];
        if (typeof a === 'number' && isFinite(a) && Math.abs(a - b) > tol * Math.max(Math.abs(b), 1e-300)) add('bauteile.' + k, false, 'Der Bauteilwert ' + k + ' weicht von der Anlage ab (' + fmt(a) + ' statt ' + fmt(b) + ').');
      });
    }
    const qn = isObj(entry.quelle) ? Object.keys(entry.quelle).length : 0;
    add('quelle', qn > 0, qn > 0 ? 'Die Quelle ist eingetragen.' : 'Die Quelle fehlt (Pflichtfeld).');
    const zl = isArr(entry.messreihe) ? entry.messreihe : (isArr(entry.rows) ? entry.rows : []);
    add('messreihe', zl.length >= 3, zl.length >= 3 ? 'Die Messreihe hat ' + zl.length + ' Zeilen.' : 'Die Messreihe braucht mindestens 3 Zeilen.');
    const bad = [], cols = m.cols;
    const scale = {};
    cols.forEach(function (cc) { if (cc.key === 'x') return; let mx = 0; m.xs.forEach(function (x) { const e = m.row(x)[cc.key]; if (isFinite(e)) mx = Math.max(mx, Math.abs(e)); }); scale[cc.key] = mx; });
    zl.forEach(function (row, k) {
      if (!isObj(row)) { bad.push('Zeile ' + (k + 1) + ' ist leer.'); return; }
      const x = typeof row.x === 'string' ? parseNum(row.x) : row.x;
      if (!(typeof x === 'number' && isFinite(x))) { bad.push('Zeile ' + (k + 1) + ': ' + cols[0].label + ' ist keine Zahl.'); return; }
      let ex; try { ex = m.row(m.xs.indexOf(x) >= 0 ? x : x); } catch (e) { bad.push('Zeile ' + (k + 1) + ': Für ' + cols[0].label + ' = ' + fe(x, cols[0].unit) + ' gibt es keine Rechnung.'); return; }
      cols.slice(1).forEach(function (cc) {
        const e = ex[cc.key];
        if (e === undefined || !isFinite(e)) return;
        const v = typeof row[cc.key] === 'string' ? parseNum(row[cc.key]) : row[cc.key];
        if (!(typeof v === 'number' && isFinite(v))) { bad.push('Zeile ' + (k + 1) + ' (' + fv(x, cols[0].unit) + '): ' + cc.label + ' ist keine Zahl.'); return; }
        const dev = cc.unit === '°' ? Math.abs(v - e) / 90 : Math.abs(v - e) / Math.max(Math.abs(e), (rigId === 'diode' ? 1e-12 : 0.01) * scale[cc.key], 1e-300);
        if (dev > tol) bad.push('Zeile ' + (k + 1) + ' (' + fv(x, cols[0].unit) + '): ' + cc.label + ' ' + fv(v, cc.unit) + ' weicht um ' + fmt(dev * 100, 1) + ' % von der Rechnung ab (' + (cc.unit === '°' ? 'bezogen auf 90°, ' : '') + 'Toleranz ' + pc(tol, 0) + UEBUNG + ').');
      });
    });
    if (zl.length >= 3) add('messwerte', bad.length === 0, bad.length === 0 ? 'Alle Messwerte stimmen mit der Rechnung überein (Toleranz ' + pc(tol, 0) + ').' : bad.slice(0, 3).join(' ') + (bad.length > 3 ? ' Dazu ' + (bad.length - 3) + ' weitere Abweichungen.' : ''));
    const aw = isObj(entry.auswertung) ? entry.auswertung : {};
    const defs = repKeysOf(rigId, m.M).filter(function (d) { return isFinite(m.ausw[d.key]); });
    if (defs.length) {
      const any = defs.some(function (d) { return !isEmptyS(aw[d.key]); });
      add('auswertung', any, any ? 'Die Auswertung ist ausgefüllt.' : 'Die Auswertung fehlt (Pflichtfeld).');
      defs.forEach(function (d) {
        if (isEmptyS(aw[d.key])) return;
        const v = typeof aw[d.key] === 'string' ? parseNum(aw[d.key]) : aw[d.key], e = m.ausw[d.key];
        if (!(typeof v === 'number' && isFinite(v))) { add('auswertung.' + d.key, false, d.label + ' ist keine Zahl.'); return; }
        const dev = Math.abs(v - e) / Math.max(Math.abs(e), 1e-300), okv = dev <= d.tol + 1e-12;
        add('auswertung.' + d.key, okv, okv ? d.label + ' stimmt mit der Rechnung überein (Abweichung ' + fmt(dev * 100, 1) + ' %, Toleranz ' + pc(d.tol, 0) + UEBUNG + ').' : d.label + ' weicht um ' + fmt(dev * 100, 0) + ' % ab:' + hintAusw(rigId, d.key, v, e, m));
      });
    } else add('auswertung', true, 'Für diese Schaltung ist keine Auswertung verlangt.');
    const fails = items.filter(function (x) { return !x.ok; });
    return { ok: true, valid: true, passt: fails.length === 0, items: items, abweichungen: fails.map(function (x) { return x.text; }), text: fails.length === 0 ? 'Die Messreihe ist in sich stimmig. ' + TEXTS.protoHinweis : fails.length + ' Punkt(e) prüfen: ' + fails.map(function (x) { return x.text; }).join(' ') };
  });
  /* CSV: Semikolon, Dezimalkomma, Anfuehrungszeichen verdoppelt */
  function csvCell(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[;"\r\n]/.test(s) || s !== s.trim()) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function typOf(v) { return typeof v === 'number' ? 'n' : (typeof v === 'boolean' ? 'b' : 's'); }
  report.csv = SG(function (entry) {
    reqObj(entry);
    const lines = ['#ANA-Messreihe;Version 1;' + TEXTS.protoHinweis.replace(/;/g, ',')];
    function meta(k, v) { if (v === undefined || v === null) return; if (typeof v === 'number' && !isFinite(v)) return; if (typeof v === 'object') return; lines.push([csvCell(k), csvCell(v), typOf(v)].join(';')); }
    ['rigId', 'name', 'datum', 'schaltung', 'ergebnis', 'seed', 'hinweis'].forEach(function (k) { meta(k, entry[k]); });
    ['bauteile', 'quelle', 'auswertung', 'zustand'].forEach(function (g) { if (isObj(entry[g])) Object.keys(entry[g]).forEach(function (k) { meta(g + '.' + k, entry[g][k]); }); });
    const rows = isArr(entry.messreihe) ? entry.messreihe : (isArr(entry.rows) ? entry.rows : []);
    const keys = ['x', 'y', 'y2'].filter(function (k) { return rows.some(function (r) { return r && r[k] !== undefined && r[k] !== null; }); });
    lines.push('');
    lines.push('@Messreihe');
    lines.push(keys.map(csvCell).join(';'));
    rows.forEach(function (r) { lines.push(keys.map(function (k) { return r && r[k] !== undefined && r[k] !== null ? csvCell(r[k]) : ''; }).join(';')); });
    return { ok: true, valid: true, text: lines.join('\r\n') + '\r\n' };
  });
  /* Zahl aus der CSV-Zelle: exakt (Dezimalkomma, Exponent), sonst mit Einheit ueber parseNum */
  function exactNum(cell) {
    const s = String(cell).trim();
    if (/^[+-]?\d+(?:,\d+)?(?:[eE][+-]?\d+)?$/.test(s)) return Number(s.replace(',', '.'));
    return parseNum(s);
  }
  function csvRows(text) {
    const rows = []; let row = [], cell = '', q = false, i = 0, started = false;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') { q = true; started = true; i++; continue; }
      if (ch === ';') { row.push(cell); cell = ''; started = true; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++;
        if (started || cell !== '' || row.length) { row.push(cell); rows.push(row); } else rows.push([]);
        row = []; cell = ''; started = false; continue;
      }
      cell += ch; started = true; i++;
    }
    if (started || cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  report.parseCsv = SG(function (text) {
    if (typeof text !== 'string' || text.length < 5) V('Das ist keine Messreihen-Datei: Der Text ist leer.');
    if (text.length > 5e6) V('Die Datei ist zu groß.');
    const rows = csvRows(text.replace(/^﻿/, ''));
    if (!rows.length || !rows[0][0] || rows[0][0].indexOf('#ANA-Messreihe') !== 0) V('Das ist keine Messreihen-Datei dieses Labs (Kopfzeile #ANA-Messreihe fehlt).');
    const entry = { bauteile: {}, quelle: {}, auswertung: {}, zustand: {} };
    let k = 1;
    function val(cell, typ) {
      if (typ === 'n') { const x = exactNum(cell); if (!isFinite(x)) V('Zahl nicht lesbar: „' + cell + '“.'); return x; }
      if (typ === 'b') return cell === 'true';
      return cell;
    }
    for (; k < rows.length; k++) {
      const r = rows[k];
      if (r.length === 0) continue;
      if (r[0] === '@Messreihe') { k++; break; }
      if (r.length < 3) V('Zeile ' + (k + 1) + ' ist keine Eigenschaft (Schlüssel;Wert;Typ).');
      const key = r[0], v = val(r[1], r[2]), dot = key.indexOf('.');
      if (dot > 0) { const g = key.slice(0, dot); if (!entry[g]) V('Unbekannter Abschnitt „' + g + '“.'); entry[g][key.slice(dot + 1)] = v; } else entry[key] = v;
    }
    const head = rows[k] || [];
    k++;
    const out = [];
    for (; k < rows.length; k++) {
      const r = rows[k];
      if (!r.length || (r.length === 1 && r[0] === '')) continue;
      const o = {};
      head.forEach(function (h, j) { if (r[j] !== undefined && r[j] !== '') { const pq = exactNum(r[j]); o[h] = isFinite(pq) ? pq : r[j]; } });
      out.push(o);
    }
    entry.messreihe = out; entry.rows = out.map(function (r) { return Object.assign({}, r); });
    const id = String(entry.rigId);
    try { entry.spalten = DEF[id] ? colsFor(id, null) : head.map(function (h) { return { key: h, label: h, unit: '' }; }); } catch (e) { entry.spalten = head.map(function (h) { return { key: h, label: h, unit: '' }; }); }
    return { ok: true, valid: true, entry: entry, rows: out };
  });
  C.extend('report', report);

  /* =============================== Aufgaben (exercise) =============================== */
  const MSG = {
    'zu-klein': 'Dein Wert ist zu klein: Er liegt {pct} % unter dem Ergebnis. Rechne die Schritte noch einmal nach.',
    'zu-gross': 'Dein Wert ist zu groß: Er liegt {pct} % über dem Ergebnis. Rechne die Schritte noch einmal nach.',
    'keine-zahl': 'Das ist keine Zahl. Gib das Ergebnis als Zahl mit Einheit ein, zum Beispiel 4,7 kΩ.',
    'vorsatz': 'Dein Wert ist um den Faktor {faktor} verschoben. Prüfe den Vorsatz: µ, n, p, m, k, M.',
    'vorzeichen': 'Das Vorzeichen stimmt nicht: Das Ergebnis hat das andere Vorzeichen. Prüfe, ob der Ausgang invertiert wird (dann ist V_u negativ).',
    'zwei-pi': 'Dein Wert passt zu einer Rechnung mit falschem Faktor 2π (oder ω statt f). Die Frequenz hängt über ω = 2π · f mit der Kreisfrequenz zusammen.',
    'einheit': 'Die Einheit passt nicht: Gesucht ist eine Größe in {gesucht}.',
    'richtig': 'Richtig: {was} = {wert}.',
    'uf-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne die Flussspannung U_F. Auch U_F fällt ab, am Vorwiderstand liegt nur der Rest: R_V = (U_B − U_F) / I.',
    'p-quelle': 'Dein Wert ({w}) ist die Leistung der ganzen Quelle (U_B · I). Gefragt ist die Leistung am Vorwiderstand: P = (U_B − U_F) · I.',
    'strom-statt-leistung': 'Dein Wert ({w}) passt zu einem gleichen Strom statt gleicher Leistung. Bei gleicher Leistung ändert sich der Strom: I₂ = U_F1 · I₁ / U_F2.',
    'rv-unveraendert': 'Dein Wert ({w}) ist der alte Vorwiderstand. Die neue LED hat eine andere Flussspannung und nimmt einen anderen Strom auf.',
    'uz-nicht-abgezogen': 'Dein Wert ({w}) passt zu U_max / I_Z,max. Am Vorwiderstand liegt nur U_max − U_Z.',
    'pz-nicht-durch-uz': 'Dein Wert ({w}) passt zu (U_max − U_Z) / P_Z. Der größte Z-Strom ist P_Z / U_Z, nicht P_Z.',
    'last-vergessen': 'Dein Wert ({w}) ist der Strom im Vorwiderstand. Davon fließt ein Teil durch die Last: I_Z = I_R − U_Z / R_L.',
    'last-addiert': 'Dein Wert ({w}) passt zu I_Z = I_R + I_L. Der Laststrom fließt am Z-Strom vorbei: Er wird abgezogen, nicht addiert.',
    'ube-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne U_BE. An der Basis-Emitter-Strecke fällt U_BE ab; am Widerstand liegt nur die Spannung davor minus U_BE.',
    'b-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne B. Der Basisstrom ist B-mal kleiner als der Kollektorstrom: I_B = I_C / B.',
    'ueb-vergessen': 'Dein Wert ({w}) ist der Basisvorwiderstand für ü = 1. Mit Übersteuerung wird der Basisstrom ü-mal so groß, der Widerstand entsprechend kleiner.',
    'ueb-mal': 'Dein Wert ({w}) passt zu R_B = ü · R_B(ü = 1). Mehr Übersteuerung heißt mehr Basisstrom und damit einen kleineren Widerstand: Du musst durch ü teilen.',
    'ucesat-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne U_CE,sat. Auch am gesättigten Transistor fällt U_CE,sat ab.',
    'ueb-kehrwert': 'Dein Wert ({w}) ist der Kehrwert. Der Übersteuerungsfaktor ist ü = I_B / I_B,min (tatsächlicher durch kleinsten Basisstrom).',
    'ib-min-falsch': 'Dein Wert ({w}) passt zu I_B,min = I_C statt I_C / B. Der kleinste Basisstrom ist der Kollektorstrom geteilt durch B.',
    'ib-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne den Basisstrom. I_B fließt zusätzlich durch den Widerstand und trägt zum Ergebnis bei.',
    'ib-nicht-abgezogen': 'Dein Wert ({w}) passt zu R_2 = U_2 / I_1. Durch R_2 fließt nur I_1 − I_B, weil der Basisstrom abgezweigt wird.',
    'i1-plus-ib': 'Dein Wert ({w}) passt zu U_2 / (I_1 + I_B). Der Basisstrom wird vom Strom I_1 abgezogen, nicht addiert.',
    'ub-statt-ubase': 'Dein Wert ({w}) passt zu einem Basisstrom aus der Betriebsspannung statt aus der Basisspannung (U_CE würde negativ: Sättigung). Der Basisstrom kommt aus der Spannung am Basiswiderstand.',
    'teiler-vertauscht': 'Dein Wert ({w}) passt zu vertauschten Widerständen im Spannungsteiler. U_BB liegt an R_2: U_BB = U_B · R_2 / (R_1 + R_2).',
    'r2-durch-r1': 'Dein Wert ({w}) passt zu U_B · R_2 / R_1. Im Nenner steht die Summe R_1 + R_2.',
    'dioden-eine': 'Dein Wert ({w}) passt zu einer Rechnung mit nur einer Diode. Alle {nd} Dioden in Reihe addieren ihre Spannungen: n · U_D.',
    'ic-statt-ib': 'Dein Wert ({w}) passt zu I_Z + I_C statt I_Z + I_C / B. Durch R_1 fließt der Basisstrom I_C / B, nicht der Kollektorstrom.',
    'ube-nicht-abgezogen': 'Dein Wert ({w}) ist die Z-Spannung selbst. Der Emitter liegt um U_BE unter der Basis: U_E = U_Z − U_BE.',
    'ube-addiert': 'Dein Wert ({w}) passt zu U_Z + U_BE. Beim Emitterfolger liegt der Emitter unter der Basis, nicht darüber.',
    'vorzeichen-vu': 'Dein Wert ({w}) hat kein Minuszeichen. Die Emitterschaltung dreht die Phase um 180°: V_u ist negativ.',
    'ut-vergessen': 'Dein Wert ({w}) passt zu g_m = I_C ohne U_T. Die Steilheit ist g_m = I_C / U_T.',
    'r-e-vergessen': 'Dein Wert ({w}) passt zu −R_C / R_E ohne den inneren Widerstand r_e. Im Nenner steht R_E + r_e mit r_e = U_T / I_E.',
    'ohne-gegenkopplung': 'Dein Wert ({w}) passt zu V_u = −g_m · R_C, also zur Emitterschaltung ohne den ungebrückten Emitterwiderstand. Der ungebrückte R_E wirkt als Gegenkopplung und senkt die Verstärkung.',
    'nin-formel': 'Dein Wert ({w}) passt zu 1 + R_f / R_1 (nichtinvertierender Verstärker). Der Invertierer hat V_u = −R_f / R_1.',
    'inv-formel': 'Dein Wert ({w}) passt zu −R_f / R_g (invertierender Verstärker). Der Nichtinvertierer hat V_u = 1 + R_f / R_g, nie kleiner als 1.',
    'rf-r1-vertauscht': 'Dein Wert ({w}) passt zu vertauschten Widerständen. V_u = −R_f / R_1: Der Rückkopplungswiderstand steht im Zähler, der Eingangswiderstand im Nenner.',
    'rg-rf-vertauscht': 'Dein Wert ({w}) passt zu vertauschten Widerständen. V_u = 1 + R_f / R_g: R_f steht im Zähler.',
    'vorzeichen-vu-inv': 'Dein Wert ({w}) hat kein Minuszeichen. Der invertierende Verstärker dreht die Phase um 180°: V_u ist negativ.',
    'vorzeichen-ua': 'Dein Wert ({w}) hat das falsche Vorzeichen. Der invertierende Verstärker dreht das Signal um 180°: Bei positivem Eingang ist U_a negativ.',
    'nin-formel-ua': 'Dein Wert ({w}) passt zu U_a = U_e · (1 + R_f / R_1). Der Invertierer verstärkt mit −R_f / R_1.',
    'plus-eins-vergessen': 'Dein Wert ({w}) passt zu R_f / R_g ohne die „+1“. Beim nichtinvertierenden Verstärker gilt V_u = 1 + R_f / R_g.',
    'minus-eins-vergessen': 'Dein Wert ({w}) passt zu R_f = V_u · R_g. Aus V_u = 1 + R_f / R_g folgt R_f = (V_u − 1) · R_g.',
    'plus-eins-falsch': 'Dein Wert ({w}) passt zu R_f = (V_u + 1) · R_g. Aus V_u = 1 + R_f / R_g folgt R_f = (V_u − 1) · R_g.',
    'nin-formel-rf': 'Dein Wert ({w}) passt zur Formel des Invertierers (R_f = V_u · R_1). Beim Nichtinvertierer ist V_u = 1 + R_f / R_g.',
    'nur-ein-eingang': 'Dein Wert ({w}) berücksichtigt nur einen Eingang. Der Summierer addiert die Ströme aller Eingänge: U_a = −R_f · Σ(U_k / R_k).',
    'summe-statt-gewichtet': 'Dein Wert ({w}) passt zur einfachen Summe der Spannungen mit demselben Widerstand. Jede Spannung wird mit ihrem eigenen Widerstand gewichtet: U_k / R_k.',
    'verstaerkung-vergessen': 'Dein Wert ({w}) ist nur die Differenz U_2 − U_1. Der Differenzverstärker verstärkt sie noch mit R_3 / R_1.',
    'u-vertauscht': 'Dein Wert ({w}) hat das umgekehrte Vorzeichen: U_1 liegt am invertierenden, U_2 am nichtinvertierenden Eingang, U_a = (R_3 / R_1) · (U_2 − U_1).',
    'dB-10lg': 'Dein Wert ({w}) passt zu 10 · lg statt 20 · lg. Für Spannungen gilt a = 20 · lg V_u (10 · lg ist für Leistungen).',
    'dB-faktor': 'Dein Wert ({w}) ist die Verstärkung als Faktor, nicht in Dezibel. Das Verstärkungsmaß ist a = 20 · lg |V_u|.',
    'a-als-faktor': 'Dein Wert ({w}) setzt das Verstärkungsmaß a wie einen Faktor ein. Der Faktor ist V_u = 10^(a / 20).',
    'gbw-mal-v': 'Dein Wert ({w}) passt zu GBW · V_n. Die Grenzfrequenz wird mit steigender Rauschverstärkung kleiner: f_g = GBW / V_n.',
    'v-vergessen': 'Dein Wert ({w}) ist das Verstärkungs-Bandbreite-Produkt selbst. Die Grenzfrequenz der Schaltung ist f_g = GBW / V_n.',
    'uss-eingesetzt': 'Dein Wert ({w}) passt zu û = U_ss (doppelter Scheitelwert). In f_max = SR / (2π · û) steht der Scheitelwert û.',
    'uhat-halbiert': 'Dein Wert ({w}) passt zu einem halbierten Scheitelwert. Der Scheitelwert û ist die Amplitude, nicht der Effektivwert oder die Hälfte davon.',
    'pi-statt-2pi': 'Dein Wert ({w}) passt zu π statt 2π. Es gilt ω = 2π · f.',
    'hysterese-statt-schwelle': 'Dein Wert ({w}) ist die Hysterese U_H = U_o − U_u (beide Schwellen zusammen). Gefragt ist die obere Schaltschwelle U_o.',
    'r2-teiler': 'Dein Wert ({w}) passt zu U_sat · R_2 / (R_2 + R_3). An der Schwelle liegt der Teiler mit R_3 (nach U_ref): U_o = U_sat · R_3 / (R_2 + R_3).',
    'r1-r1r2': 'Dein Wert ({w}) passt zu einer Teilung durch (R_1 + R_2). Beim nichtinvertierenden Schmitt-Trigger gilt U_o = U_sat · R_1 / R_2.',
    'ln-vergessen': 'Dein Wert ({w}) passt zu T = 2 · R · C ohne den Logarithmus. Der Kondensator lädt nach einer e-Funktion: T = 2 · R · C · ln((1 + β) / (1 − β)).',
    'halbe-periode': 'Dein Wert ({w}) ist nur die halbe Periode (eine Umladung). Die Periodendauer ist die Summe von Ladezeit und Entladezeit.',
    'rc-nur': 'Dein Wert ({w}) ist die Zeitkonstante τ = R · C. Die Periodendauer folgt aus τ und dem Schwellenverhältnis (ln-Faktor, zwei Umladungen).',
    'slope-vorzeichen': 'Dein Wert ({w}) hat das falsche Vorzeichen. Der Integrierer invertiert: Bei positiver Eingangsspannung fällt der Ausgang.',
    'mal-statt-durch': 'Dein Wert ({w}) passt zu U_e · R · C. Die Steigung ist U_e geteilt durch die Zeitkonstante: −U_e / (R · C).',
    'zweimal-pi': 'Dein Wert ({w}) passt zu π statt 2π im Nenner. Es gilt R = 1 / (2π · f · C).',
    'kehrwert-tau': 'Dein Wert ({w}) ist der Kehrwert. Die Zeitkonstante ist das Produkt τ = R · C (Einheit Sekunden).',
    'r1-statt-rf': 'Dein Wert ({w}) passt zu R_1 statt R_f. Beim Tiefpass bestimmen R_f und C_f die Grenzfrequenz.',
    'rf-statt-r1': 'Dein Wert ({w}) passt zu R_f statt R_1. Beim Hochpass bestimmen R_1 und C_1 die Grenzfrequenz.'
  };
  function msg(id, vars) {
    let t = MSG[id];
    if (t === undefined) return '';
    const v = vars || {};
    return t.replace(/\{(\w+)\}/g, function (m0, k) { return v[k] !== undefined ? String(v[k]) : m0; });
  }
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  const VOLT = [3.3, 5, 9, 12, 15, 24], IMA = [5, 10, 12, 15, 20];
  const UFL = [1.8, 1.9, 2.0, 2.1, 2.2];
  function rr(m, d) { return Number((m * Math.pow(10, d)).toPrecision(12)); }
  function pick(r, arr) { return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))]; }
  function rE(r, lo, hi) { return rr(pick(r, E12), lo + Math.min(hi - lo, Math.floor(r() * (hi - lo + 1)))); }
  function nearE12(x) {
    const d = Math.floor(Math.log10(x)), m = x / Math.pow(10, d);
    let best = E12[0], bd = Infinity;
    E12.concat([10]).forEach(function (e) { const dd = Math.abs(Math.log(m / e)); if (dd < bd) { bd = dd; best = e; } });
    return rr(best, d);
  }
  function cE(r) { return pick(r, [1e-9, 2.2e-9, 4.7e-9, 10e-9, 22e-9, 47e-9, 100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6]); }
  const Dx = {};
  const K2 = { pi: 3.14 };
  function voltDisp(x) { return fe(x, 'V'); }
  /* ---- Diode, LED, Z-Diode ---- */
  Dx.rvLed = { unit: 'Ω', tol: 0.03, what: 'R_V',
    gen: function (r) { return { ub: pick(r, [5, 9, 12, 15, 24]), uf: pick(r, UFL), i: pick(r, IMA) * 1e-3 }; },
    q: function (g) { return 'Übungsschaltung: Eine LED (Flussspannung U_F = ' + fe(g.uf, 'V') + ') soll an U_B = ' + fe(g.ub, 'V') + ' mit I_F = ' + fe(g.i, 'A') + ' leuchten. Berechne den Vorwiderstand R_V.'; },
    val: function (g) { return C.diode.rvFor({ uq: g.ub, uf: g.uf, i: g.i }); },
    steps: function (g, v) { return ['Am Vorwiderstand liegt U_B − U_F = ' + fe(g.ub, 'V') + ' − ' + fe(g.uf, 'V') + ' = ' + fe(g.ub - g.uf, 'V') + '.', 'R_V = (U_B − U_F) / I_F = ' + fe(g.ub - g.uf, 'V') + ' / ' + fe(g.i, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['uf-vergessen', g.ub / g.i]]; } };
  Dx.iLed = { unit: 'A', tol: 0.03, what: 'I_F',
    gen: function (r) { const ub = pick(r, [5, 9, 12, 15, 24]), uf = pick(r, UFL); let rv = rE(r, 2, 4); for (let k = 0; k < 30; k++) { const i = (ub - uf) / rv; if (i >= 0.0005 && i <= 0.03) break; rv = rE(r, 2, 4); } return { ub: ub, uf: uf, rv: rv }; },
    q: function (g) { return 'Übungsschaltung: Eine LED (U_F = ' + fe(g.uf, 'V') + ') liegt mit R_V = ' + fe(g.rv, 'Ω') + ' an U_B = ' + fe(g.ub, 'V') + '. Berechne den LED-Strom I_F.'; },
    val: function (g) { return C.diode.operating({ typ: 'led_rot', modell: 'konstant', uf: g.uf, uq: g.ub, rv: g.rv }).id; },
    steps: function (g, v) { return ['Spannung am Vorwiderstand: U_B − U_F = ' + fe(g.ub - g.uf, 'V') + '.', 'I_F = (U_B − U_F) / R_V = ' + fe(g.ub - g.uf, 'V') + ' / ' + fe(g.rv, 'Ω') + ' = ' + fe(v, 'A')]; },
    wrong: function (g) { return [['uf-vergessen', g.ub / g.rv]]; } };
  Dx.pRvLed = { unit: 'W', tol: 0.03, what: 'P_R',
    gen: function (r) { return Dx.iLed.gen(r); },
    q: function (g) { return 'Übungsschaltung: Eine LED (U_F = ' + fe(g.uf, 'V') + ') liegt mit R_V = ' + fe(g.rv, 'Ω') + ' an U_B = ' + fe(g.ub, 'V') + '. Berechne die Leistung P_R am Vorwiderstand.'; },
    val: function (g) { return C.diode.operating({ typ: 'led_rot', modell: 'konstant', uf: g.uf, uq: g.ub, rv: g.rv }).pr; },
    steps: function (g, v) { return ['Spannung am Vorwiderstand: U_B − U_F = ' + fe(g.ub - g.uf, 'V') + '.', 'P_R = (U_B − U_F)² / R_V = (' + fe(g.ub - g.uf, 'V') + ')² / ' + fe(g.rv, 'Ω') + ' = ' + fe(v, 'W')]; },
    wrong: function (g) { const i = (g.ub - g.uf) / g.rv; return [['p-quelle', g.ub * i], ['uf-vergessen', g.ub * g.ub / g.rv]]; } };
  Dx.ledTausch = { unit: 'Ω', tol: 0.03, what: 'R_V,neu',
    gen: function (r) { const uq = pick(r, [9, 12, 15, 24]); return { uq: uq, uf1: pick(r, [1.8, 1.9, 2.0]), i1: pick(r, IMA) * 1e-3, uf2: pick(r, [2.2, 2.6, 3.1]) }; },
    q: function (g) { return 'Übungsschaltung: Eine LED (U_F = ' + fe(g.uf1, 'V') + ') nimmt an U_q = ' + fe(g.uq, 'V') + ' mit I_1 = ' + fe(g.i1, 'A') + ' Leistung auf. Die LED wird gegen eine LED mit U_F = ' + fe(g.uf2, 'V') + ' getauscht; die neue LED soll dieselbe Leistung aufnehmen. Berechne den neuen Vorwiderstand.'; },
    val: function (g) { return C.diode.ledSwap({ uq: g.uq, uf1: g.uf1, i1: g.i1, uf2: g.uf2, modus: 'gleicheLeistung' }).rv; },
    steps: function (g, v) { const i2 = g.uf1 * g.i1 / g.uf2; return ['Gleiche Leistung: U_F1 · I_1 = U_F2 · I_2, also I_2 = ' + fe(g.uf1, 'V') + ' · ' + fe(g.i1, 'A') + ' / ' + fe(g.uf2, 'V') + ' = ' + fe(i2, 'A') + '.', 'R_V = (U_q − U_F2) / I_2 = ' + fe(g.uq - g.uf2, 'V') + ' / ' + fe(i2, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['strom-statt-leistung', (g.uq - g.uf2) / g.i1], ['rv-unveraendert', (g.uq - g.uf1) / g.i1]]; } };
  Dx.rvZ = { unit: 'Ω', tol: 0.03, what: 'R_V,min',
    gen: function (r) { const uz = pick(r, [5.1, 6.2, 6.8, 9.1]); return { uqmax: pick(r, [15, 18, 24]), uz: uz, pz: pick(r, [0.25, 0.5, 1]) }; },
    q: function (g) { return 'Übungsschaltung: Eine Z-Diode (U_Z = ' + fe(g.uz, 'V') + ', zulässige Verlustleistung P_Z = ' + fe(g.pz, 'W') + ') wird über einen Vorwiderstand an höchstens ' + fe(g.uqmax, 'V') + ' betrieben. Berechne den kleinsten Vorwiderstand.'; },
    val: function (g) { return C.diode.rvZMin({ uqmax: g.uqmax, uz: g.uz, pz: g.pz }); },
    steps: function (g, v) { return ['Größter Z-Strom: I_Z = P_Z / U_Z = ' + fe(g.pz, 'W') + ' / ' + fe(g.uz, 'V') + ' = ' + fe(g.pz / g.uz, 'A') + '.', 'R_V,min = (U_max − U_Z) / I_Z = ' + fe(g.uqmax - g.uz, 'V') + ' / ' + fe(g.pz / g.uz, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['uz-nicht-abgezogen', g.uqmax / (g.pz / g.uz)], ['pz-nicht-durch-uz', (g.uqmax - g.uz) / g.pz]]; } };
  Dx.izLast = { unit: 'A', tol: 0.03, what: 'I_Z',
    gen: function (r) { const uz = pick(r, [5.1, 6.2, 6.8, 9.1]); let g, k = 0; do { g = { uq: pick(r, [12, 15, 24]), uz: uz, rv: rE(r, 2, 3), rl: rE(r, 3, 4) }; k++; } while (k < 40 && !((g.uq - g.uz) / g.rv - g.uz / g.rl > 0.004)); return g; },
    q: function (g) { return 'Übungsschaltung: Eine Z-Diode (U_Z = ' + fe(g.uz, 'V') + ') liegt über R_V = ' + fe(g.rv, 'Ω') + ' an ' + fe(g.uq, 'V') + ' und versorgt eine Last R_L = ' + fe(g.rl, 'Ω') + '. Berechne den Z-Strom I_Z.'; },
    val: function (g) { return C.diode.operating({ typ: 'z', modell: 'konstant', uz: g.uz, uq: g.uq, rv: g.rv, rlast: g.rl }).iz; },
    steps: function (g, v) { return ['Strom im Vorwiderstand: I_R = (U_q − U_Z) / R_V = ' + fe((g.uq - g.uz) / g.rv, 'A') + '.', 'Laststrom: I_L = U_Z / R_L = ' + fe(g.uz / g.rl, 'A') + '.', 'I_Z = I_R − I_L = ' + fe(v, 'A')]; },
    wrong: function (g) { return [['last-vergessen', (g.uq - g.uz) / g.rv], ['last-addiert', (g.uq - g.uz) / g.rv + g.uz / g.rl]]; } };
  /* ---- Transistor als Schalter, Arbeitspunkt, Stromquellen ---- */
  Dx.rbSchalter = { unit: 'Ω', tol: 0.03, what: 'R_B',
    gen: function (r) { return { ust: pick(r, [3.3, 5, 12]), ic: pick(r, [5, 10, 20, 50, 100]) * 1e-3, b: pick(r, [50, 100, 150, 200, 300]), ueb: pick(r, [1, 2, 3]), ube: 0.7 }; },
    q: function (g) { return 'Übungsschaltung: Ein Transistor (B = ' + fmt(g.b, 0) + ', U_BE = ' + fe(g.ube, 'V') + ') soll I_C = ' + fe(g.ic, 'A') + ' schalten, die Steuerspannung beträgt U_St = ' + fe(g.ust, 'V') + (g.ueb === 1 ? ', ohne Übersteuerung (ü = 1)' : ', der Übersteuerungsfaktor ist ü = ' + fmt(g.ueb, 0)) + '. Berechne den Basisvorwiderstand R_B.'; },
    val: function (g) { return C.tr.rbFor({ ust: g.ust, ube: g.ube, ic: g.ic, b: g.b, ueb: g.ueb }).rb; },
    alt: function (g) { return [C.tr.rbFor({ ust: g.ust, ube: 0.6, ic: g.ic, b: g.b, ueb: g.ueb }).rb]; },
    steps: function (g, v) { const ib = g.ueb * g.ic / g.b; return ['Basisstrom: I_B = ü · I_C / B = ' + fmt(g.ueb, 0) + ' · ' + fe(g.ic, 'A') + ' / ' + fmt(g.b, 0) + ' = ' + fe(ib, 'A') + '.', 'R_B = (U_St − U_BE) / I_B = ' + fe(g.ust - g.ube, 'V') + ' / ' + fe(ib, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { const ib = g.ueb * g.ic / g.b, rb1 = (g.ust - g.ube) / (g.ic / g.b), w = [['ube-vergessen', g.ust / ib], ['b-vergessen', (g.ust - g.ube) / (g.ueb * g.ic)]]; if (g.ueb !== 1) { w.push(['ueb-vergessen', rb1]); w.push(['ueb-mal', rb1 * g.ueb]); } return w; } };
  Dx.icLast = { unit: 'A', tol: 0.03, what: 'I_C',
    gen: function (r) { return { ub: pick(r, [5, 12, 24]), uf: pick(r, [1.8, 2.0, 2.1, 2.2]), rv: rE(r, 2, 3), ucesat: pick(r, [0.2, 0.3]) }; },
    q: function (g) { return 'Übungsschaltung: Ein gesättigter Transistor (U_CE,sat = ' + fe(g.ucesat, 'V') + ') schaltet eine LED (U_F = ' + fe(g.uf, 'V') + ') mit R_V = ' + fe(g.rv, 'Ω') + ' an U_B = ' + fe(g.ub, 'V') + '. Berechne den Kollektorstrom I_C.'; },
    val: function (g) { return C.tr.switch({ ub: g.ub, last: 'led', uf: g.uf, rv: g.rv, ust: g.ub, rb: 1000, b: 100, ucesat: g.ucesat }).icSat; },
    steps: function (g, v) { return ['Am Vorwiderstand liegt U_B − U_CE,sat − U_F = ' + fe(g.ub, 'V') + ' − ' + fe(g.ucesat, 'V') + ' − ' + fe(g.uf, 'V') + ' = ' + fe(g.ub - g.ucesat - g.uf, 'V') + '.', 'I_C = (U_B − U_CE,sat − U_F) / R_V = ' + fe(v, 'A')]; },
    wrong: function (g) { return [['ucesat-vergessen', (g.ub - g.uf) / g.rv], ['uf-vergessen', (g.ub - g.ucesat) / g.rv]]; } };
  Dx.ueb = { unit: '', tol: 0.03, what: 'ü',
    gen: function (r) { return { ub: pick(r, [5, 12]), uf: 2.0, rv: pick(r, [220, 330, 470, 1000]), ust: pick(r, [3.3, 5]), rb: pick(r, [1000, 2200, 4700, 10000, 22000, 47000]), b: pick(r, [100, 150, 200]), ucesat: 0.2, ube: 0.7 }; },
    q: function (g) { return 'Übungsschaltung: Ein Transistor (B = ' + fmt(g.b, 0) + ', U_BE = ' + fe(g.ube, 'V') + ', U_CE,sat = ' + fe(g.ucesat, 'V') + ') schaltet bei U_B = ' + fe(g.ub, 'V') + ' eine LED (U_F = ' + fe(g.uf, 'V') + ') mit R_V = ' + fe(g.rv, 'Ω') + '. Die Steuerspannung U_St = ' + fe(g.ust, 'V') + ' liegt über R_B = ' + fe(g.rb, 'Ω') + ' an der Basis. Berechne den Übersteuerungsfaktor ü = I_B / I_B,min.'; },
    val: function (g) { return C.tr.switch({ ub: g.ub, last: 'led', uf: g.uf, rv: g.rv, ust: g.ust, rb: g.rb, b: g.b, ube: g.ube, ucesat: g.ucesat }).ueb; },
    steps: function (g, v) { const sw = C.tr.switch({ ub: g.ub, last: 'led', uf: g.uf, rv: g.rv, ust: g.ust, rb: g.rb, b: g.b, ube: g.ube, ucesat: g.ucesat }); return ['Kollektorstrom in der Sättigung: I_C,sat = ' + fe(sw.icSat, 'A') + '; kleinster Basisstrom I_B,min = I_C,sat / B = ' + fe(sw.ibmin, 'A') + '.', 'Basisstrom: I_B = (U_St − U_BE) / R_B = ' + fe(sw.ib, 'A') + '.', 'ü = I_B / I_B,min = ' + fmt(v, 2)]; },
    wrong: function (g, v) { const sw = C.tr.switch({ ub: g.ub, last: 'led', uf: g.uf, rv: g.rv, ust: g.ust, rb: g.rb, b: g.b, ube: g.ube, ucesat: g.ucesat }); return [['ueb-kehrwert', 1 / v], ['ib-min-falsch', sw.ib / sw.icSat]]; } };
  Dx.pVtr = { unit: 'W', tol: 0.03, what: 'P_V',
    gen: function (r) { return { uce: pick(r, [0.2, 1, 2.3, 6, 9]), ic: pick(r, [10, 20, 50, 100]) * 1e-3, ib: pick(r, [0.5, 1, 2, 5]) * 1e-3, ube: 0.7 }; },
    q: function (g) { return 'Übungsschaltung: Ein Transistor führt I_C = ' + fe(g.ic, 'A') + ' bei U_CE = ' + fe(g.uce, 'V') + '; der Basisstrom beträgt I_B = ' + fe(g.ib, 'A') + ' bei U_BE = ' + fe(g.ube, 'V') + '. Berechne die Verlustleistung P_V.'; },
    val: function (g) { return FN('pVtr')(g.uce, g.ic, g.ube, g.ib); },
    steps: function (g, v) { return ['Ausgang: U_CE · I_C = ' + fe(g.uce, 'V') + ' · ' + fe(g.ic, 'A') + ' = ' + fe(g.uce * g.ic, 'W') + '.', 'Eingang: U_BE · I_B = ' + fe(g.ube * g.ib, 'W') + '.', 'P_V = ' + fe(v, 'W')]; },
    wrong: function (g) { return [['ib-vergessen', g.uce * g.ic]]; } };
  Dx.ucePunkt = { unit: 'V', tol: 0.03, what: 'U_CE',
    gen: function (r) {
      let g, k = 0;
      do { const ub = pick(r, [12, 15]), rc = rE(r, 2, 3), b = pick(r, [100, 150, 200]), ic = pick(r, [2, 3, 4, 5]) * 1e-3, ubase = 5, rb = nearE12((ubase - 0.7) / (ic / b)); g = { ub: ub, rc: rc, b: b, ubase: ubase, rb: rb, ube: 0.7 }; k++; }
      while (k < 60 && !(Dx.ucePunkt.val(g) > 1 && Dx.ucePunkt.val(g) < g.ub - 1));
      return g;
    },
    q: function (g) { return 'Übungsschaltung: Ein Transistor (B = ' + fmt(g.b, 0) + ', U_BE = ' + fe(g.ube, 'V') + ') liegt an U_B = ' + fe(g.ub, 'V') + ' mit R_C = ' + fe(g.rc, 'Ω') + '. Die Basis wird über R_B = ' + fe(g.rb, 'Ω') + ' aus ' + fe(g.ubase, 'V') + ' gespeist. Berechne U_CE.'; },
    val: function (g) { return C.tr.dc({ ub: g.ub, rc: g.rc, re: 0, b: g.b, ube: g.ube, basis: 'rb', ubase: g.ubase, rb: g.rb }).uce; },
    alt: function (g) { return [C.tr.dc({ ub: g.ub, rc: g.rc, re: 0, b: g.b, ube: 0.6, basis: 'rb', ubase: g.ubase, rb: g.rb }).uce]; },
    steps: function (g, v) { const d = C.tr.dc({ ub: g.ub, rc: g.rc, re: 0, b: g.b, ube: g.ube, basis: 'rb', ubase: g.ubase, rb: g.rb }); return ['Basisstrom: I_B = (U_Basis − U_BE) / R_B = ' + fe(d.ib, 'A') + '.', 'Kollektorstrom: I_C = B · I_B = ' + fe(d.ic, 'A') + '.', 'U_CE = U_B − I_C · R_C = ' + fe(v, 'V')]; },
    wrong: function (g) { const f = function (ib) { return g.ub - g.b * ib * g.rc; }; return [['ube-vergessen', f(g.ubase / g.rb)], ['ub-statt-ubase', f((g.ub - g.ube) / g.rb)]]; } };
  Dx.r2Teiler = { unit: 'Ω', tol: 0.03, what: 'R_2',
    gen: function (r) { const ib = pick(r, [20, 50, 80, 100]) * 1e-6; return { u2: pick(r, [1.5, 2, 3, 3.5]), ib: ib, i1: pick(r, [8, 10]) * ib }; },
    q: function (g) { return 'Übungsschaltung: Am Basisspannungsteiler soll an R_2 die Spannung U_2 = ' + fe(g.u2, 'V') + ' liegen. Durch R_1 fließt I_1 = ' + fe(g.i1, 'A') + ', der Basisstrom beträgt I_B = ' + fe(g.ib, 'A') + '. Berechne R_2.'; },
    val: function (g) { return FN('r2Teiler')(g.u2, g.i1, g.ib); },
    steps: function (g, v) { return ['Durch R_2 fließt I_1 − I_B = ' + fe(g.i1, 'A') + ' − ' + fe(g.ib, 'A') + ' = ' + fe(g.i1 - g.ib, 'A') + '.', 'R_2 = U_2 / (I_1 − I_B) = ' + fe(g.u2, 'V') + ' / ' + fe(g.i1 - g.ib, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['ib-nicht-abgezogen', g.u2 / g.i1], ['i1-plus-ib', g.u2 / (g.i1 + g.ib)]]; } };
  Dx.ubbTeiler = { unit: 'V', tol: 0.03, what: 'U_BB',
    gen: function (r) { return { ub: pick(r, [9, 12, 15, 24]), r1: rE(r, 3, 5), r2: rE(r, 3, 4) }; },
    q: function (g) { return 'Übungsschaltung: Ein Basisspannungsteiler (unbelastet) aus R_1 = ' + fe(g.r1, 'Ω') + ' (nach U_B) und R_2 = ' + fe(g.r2, 'Ω') + ' (nach Masse) liegt an U_B = ' + fe(g.ub, 'V') + '. Berechne die Basisspannung U_BB.'; },
    val: function (g) { return FN('ubb')(g.ub, g.r1, g.r2); },
    steps: function (g, v) { return ['Spannungsteiler: U_BB = U_B · R_2 / (R_1 + R_2) = ' + fe(g.ub, 'V') + ' · ' + fe(g.r2, 'Ω') + ' / ' + fe(g.r1 + g.r2, 'Ω') + ' = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['teiler-vertauscht', g.ub * g.r1 / (g.r1 + g.r2)], ['r2-durch-r1', g.ub * g.r2 / g.r1]]; } };
  Dx.reKonst = { unit: 'Ω', tol: 0.03, what: 'R_E',
    gen: function (r) { return { nd: pick(r, [2, 3]), ud: pick(r, [0.65, 0.7, 0.75]), ube: pick(r, [0.65, 0.7]), ic: pick(r, [10, 20, 40]) * 1e-3 }; },
    q: function (g) { return 'Übungsschaltung: Eine Konstantstromquelle hat ' + fmt(g.nd, 0) + ' Dioden in Reihe an der Basis (je U_D = ' + fe(g.ud, 'V') + '), U_BE = ' + fe(g.ube, 'V') + '. Der Kollektorstrom soll I_C = ' + fe(g.ic, 'A') + ' betragen. Berechne den Emitterwiderstand R_E.'; },
    val: function (g) { return C.tr.cs({ nd: g.nd, ud: g.ud, ube: g.ube, ic: g.ic }).re; },
    steps: function (g, v) { return ['Spannung am Emitterwiderstand: n · U_D − U_BE = ' + fmt(g.nd, 0) + ' · ' + fe(g.ud, 'V') + ' − ' + fe(g.ube, 'V') + ' = ' + fe(g.nd * g.ud - g.ube, 'V') + '.', 'R_E = (n · U_D − U_BE) / I_C = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['ube-vergessen', g.nd * g.ud / g.ic], ['dioden-eine', (g.ud - g.ube) / g.ic, { nd: fmt(g.nd, 0) }]]; } };
  Dx.r1Zfolger = { unit: 'Ω', tol: 0.03, what: 'R_1',
    gen: function (r) { return { ub: pick(r, [12, 15, 24]), uz: pick(r, [5.1, 6, 6.8, 9.1]), iz: pick(r, [5, 10, 12]) * 1e-3, ic: pick(r, [50, 90, 100]) * 1e-3, b: pick(r, [30, 50, 100]) }; },
    q: function (g) { return 'Übungsschaltung: Ein Emitterfolger wird über R_1 aus U_B = ' + fe(g.ub, 'V') + ' an einer Z-Diode (U_Z = ' + fe(g.uz, 'V') + ', I_Z = ' + fe(g.iz, 'A') + ') betrieben. Der Transistor (B = ' + fmt(g.b, 0) + ') führt I_C = ' + fe(g.ic, 'A') + '. Berechne R_1.'; },
    val: function (g) { return C.tr.zfolger({ ub: g.ub, uz: g.uz, ic: g.ic, b: g.b, iz: g.iz }).r1; },
    steps: function (g, v) { return ['Basisstrom: I_B = I_C / B = ' + fe(g.ic / g.b, 'A') + '.', 'Durch R_1 fließen I_Z + I_B = ' + fe(g.iz + g.ic / g.b, 'A') + '.', 'R_1 = (U_B − U_Z) / (I_Z + I_B) = ' + fe(g.ub - g.uz, 'V') + ' / ' + fe(g.iz + g.ic / g.b, 'A') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['ib-vergessen', (g.ub - g.uz) / g.iz], ['ic-statt-ib', (g.ub - g.uz) / (g.iz + g.ic)]]; } };
  Dx.ueFolger = { unit: 'V', tol: 0.03, what: 'U_E',
    gen: function (r) { return { uz: pick(r, [3.3, 4.7, 5.1, 6, 6.8, 9.1]), ube: 0.7 }; },
    q: function (g) { return 'Übungsschaltung: Die Basis eines Emitterfolgers liegt an einer Z-Diode mit U_Z = ' + fe(g.uz, 'V') + ' (U_BE = ' + fe(g.ube, 'V') + '). Berechne die Emitterspannung U_E.'; },
    val: function (g) { return C.tr.zfolger({ ub: g.uz + 5, uz: g.uz, ic: 0.01, b: 100, iz: 0.01, ube: g.ube }).ue; },
    steps: function (g, v) { return ['Der Emitter folgt der Basis im Abstand U_BE: U_E = U_Z − U_BE = ' + fe(g.uz, 'V') + ' − ' + fe(g.ube, 'V') + ' = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['ube-nicht-abgezogen', g.uz], ['ube-addiert', g.uz + g.ube]]; } };
  /* ---- Emitterschaltung ---- */
  Dx.vuEmitter = { unit: '', tol: 0.03, what: 'V_u',
    gen: function (r) { return { ic: pick(r, [1, 2, 5]) * 1e-3, rc: rE(r, 2, 3), ut: 0.026 }; },
    q: function (g) { return 'Übungsschaltung: Eine Emitterschaltung (Emitterwiderstand durch C_E überbrückt, unbelastet) hat I_C = ' + fe(g.ic, 'A') + ' und R_C = ' + fe(g.rc, 'Ω') + '. Rechne mit U_T = ' + fe(g.ut, 'V') + '. Berechne die Spannungsverstärkung V_u (mit Vorzeichen).'; },
    val: function (g) { return FN('vuEmitter')(FN('gm')(g.ic, g.ut), g.rc); },
    alt: function (g) { return [FN('vuEmitter')(FN('gm')(g.ic, 0.025), g.rc)]; },
    steps: function (g, v) { const gm = FN('gm')(g.ic, g.ut); return ['Steilheit: g_m = I_C / U_T = ' + fe(g.ic, 'A') + ' / ' + fe(g.ut, 'V') + ' = ' + fe(gm, 'S') + '.', 'V_u = −g_m · R_C = −' + fe(gm, 'S') + ' · ' + fe(g.rc, 'Ω') + ' = ' + fmt(v, 2)]; },
    wrong: function (g, v) { return [['vorzeichen-vu', -v], ['ut-vergessen', -g.ic * g.rc]]; } };
  Dx.vuGegen = { unit: '', tol: 0.03, what: 'V_u',
    gen: function (r) { return { rc: rE(r, 2, 3), rE: pick(r, [47, 100, 220, 470]), ic: pick(r, [1, 2, 5]) * 1e-3, ut: 0.026 }; },
    q: function (g) { return 'Übungsschaltung: Eine Emitterschaltung hat R_C = ' + fe(g.rc, 'Ω') + ' und einen ungebrückten Emitterwiderstand R_E = ' + fe(g.rE, 'Ω') + ' bei I_C = ' + fe(g.ic, 'A') + ' (B groß, unbelastet). Rechne mit U_T = ' + fe(g.ut, 'V') + '. Berechne die Spannungsverstärkung V_u ≈ −R_C / (R_E + r_e) (mit Vorzeichen).'; },
    val: function (g) { return FN('vuGegen')(g.rc, FN('reT')(g.ut, g.ic), g.rE); },
    steps: function (g, v) { const re = FN('reT')(g.ut, g.ic); return ['Innerer Emitterwiderstand: r_e = U_T / I_E ≈ ' + fe(g.ut, 'V') + ' / ' + fe(g.ic, 'A') + ' = ' + fe(re, 'Ω') + '.', 'V_u ≈ −R_C / (R_E + r_e) = −' + fe(g.rc, 'Ω') + ' / ' + fe(g.rE + re, 'Ω') + ' = ' + fmt(v, 2)]; },
    wrong: function (g, v) { return [['vorzeichen-vu', -v], ['r-e-vergessen', -g.rc / g.rE], ['ohne-gegenkopplung', FN('vuEmitter')(FN('gm')(g.ic, g.ut), g.rc)]]; } };
  /* ---- Operationsverstaerker ---- */
  Dx.vInv = { unit: '', tol: 0.03, what: 'V_u',
    gen: function (r) { let g, k = 0; do { g = { r1: rE(r, 3, 4), rf: rE(r, 3, 5) }; k++; } while (k < 40 && (g.rf / g.r1 < 1.5 || g.rf / g.r1 > 120)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein invertierender Verstärker (idealer Operationsverstärker) hat R_1 = ' + fe(g.r1, 'Ω') + ' und R_f = ' + fe(g.rf, 'Ω') + '. Berechne die Spannungsverstärkung V_u (mit Vorzeichen).'; },
    val: function (g) { return KOP().inv({ r1: g.r1, rf: g.rf, opv: 'ideal' }).v; },
    steps: function (g, v) { return ['V_u = −R_f / R_1 = −' + fe(g.rf, 'Ω') + ' / ' + fe(g.r1, 'Ω') + ' = ' + fmt(v, 3) + '.']; },
    wrong: function (g, v) { return [['vorzeichen-vu-inv', -v], ['nin-formel', 1 + g.rf / g.r1], ['rf-r1-vertauscht', -g.r1 / g.rf]]; } };
  Dx.uaInv = { unit: 'V', tol: 0.03, what: 'U_a',
    gen: function (r) { let g, k = 0; do { g = { r1: rE(r, 3, 4), rf: rE(r, 3, 5), ue: pick(r, [0.1, 0.2, 0.25, 0.5, 1, 1.5]) }; k++; } while (k < 60 && (g.rf / g.r1 < 1.5 || Math.abs(g.rf / g.r1 * g.ue) > 10)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein invertierender Verstärker (idealer Operationsverstärker, ±12 V) mit R_1 = ' + fe(g.r1, 'Ω') + ' und R_f = ' + fe(g.rf, 'Ω') + ' bekommt U_e = ' + fe(g.ue, 'V') + ' (Gleichspannung). Berechne die Ausgangsspannung U_a (mit Vorzeichen).'; },
    val: function (g) { return KOP().inv({ r1: g.r1, rf: g.rf, ue: g.ue, opv: 'ideal', uv: 12 }).ua; },
    steps: function (g, v) { return ['V_u = −R_f / R_1 = −' + fe(g.rf, 'Ω') + ' / ' + fe(g.r1, 'Ω') + ' = ' + fmt(-g.rf / g.r1, 3) + '.', 'U_a = V_u · U_e = ' + fmt(-g.rf / g.r1, 3) + ' · ' + fe(g.ue, 'V') + ' = ' + fe(v, 'V')]; },
    wrong: function (g, v) { return [['vorzeichen-ua', -v], ['nin-formel-ua', g.ue * (1 + g.rf / g.r1)], ['rf-r1-vertauscht', -g.ue * g.r1 / g.rf]]; } };
  Dx.rfInv = { unit: 'Ω', tol: 0.03, what: 'R_f',
    gen: function (r) { return { v: pick(r, [3, 4, 5, 10, 15, 20, 25]), r1: rE(r, 3, 4) }; },
    q: function (g) { return 'Übungsschaltung: Ein invertierender Verstärker soll die Verstärkung V_u = −' + fmt(g.v, 0) + ' haben, R_1 = ' + fe(g.r1, 'Ω') + '. Berechne den Rückkopplungswiderstand R_f.'; },
    val: function (g) { return FN('rfInv')(-g.v, g.r1); },
    steps: function (g, v) { return ['Aus |V_u| = R_f / R_1 folgt R_f = |V_u| · R_1 = ' + fmt(g.v, 0) + ' · ' + fe(g.r1, 'Ω') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['rf-r1-vertauscht', g.r1 / g.v], ['plus-eins-falsch', (g.v - 1) * g.r1]]; } };
  Dx.vNin = { unit: '', tol: 0.03, what: 'V_u',
    gen: function (r) { let g, k = 0; do { g = { rg: rE(r, 3, 4), rf: rE(r, 3, 5) }; k++; } while (k < 40 && (g.rf / g.rg < 0.5 || g.rf / g.rg > 100)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein nichtinvertierender Verstärker (idealer Operationsverstärker) hat R_g = ' + fe(g.rg, 'Ω') + ' (nach Masse) und R_f = ' + fe(g.rf, 'Ω') + '. Berechne die Spannungsverstärkung V_u.'; },
    val: function (g) { return KOP().nin({ rg: g.rg, rf: g.rf, opv: 'ideal' }).v; },
    steps: function (g, v) { return ['V_u = 1 + R_f / R_g = 1 + ' + fe(g.rf, 'Ω') + ' / ' + fe(g.rg, 'Ω') + ' = ' + fmt(v, 3) + '.']; },
    wrong: function (g) { return [['plus-eins-vergessen', g.rf / g.rg], ['inv-formel', -g.rf / g.rg], ['rg-rf-vertauscht', 1 + g.rg / g.rf]]; } };
  Dx.uaNin = { unit: 'V', tol: 0.03, what: 'U_a',
    gen: function (r) { let g, k = 0; do { g = { rg: rE(r, 3, 4), rf: rE(r, 3, 5), ue: pick(r, [0.1, 0.25, 0.5, 1]) }; k++; } while (k < 60 && (g.rf / g.rg < 0.5 || (1 + g.rf / g.rg) * g.ue > 10)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein nichtinvertierender Verstärker (idealer Operationsverstärker, ±12 V) mit R_g = ' + fe(g.rg, 'Ω') + ' und R_f = ' + fe(g.rf, 'Ω') + ' bekommt U_e = ' + fe(g.ue, 'V') + ' (Gleichspannung). Berechne U_a.'; },
    val: function (g) { return KOP().nin({ rg: g.rg, rf: g.rf, ue: g.ue, opv: 'ideal', uv: 12 }).ua; },
    steps: function (g, v) { return ['V_u = 1 + R_f / R_g = ' + fmt(1 + g.rf / g.rg, 3) + '.', 'U_a = V_u · U_e = ' + fmt(1 + g.rf / g.rg, 3) + ' · ' + fe(g.ue, 'V') + ' = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['plus-eins-vergessen', g.ue * g.rf / g.rg], ['inv-formel', -g.ue * g.rf / g.rg]]; } };
  Dx.rfNin = { unit: 'Ω', tol: 0.03, what: 'R_f',
    gen: function (r) { return { v: pick(r, [2, 3, 5.7, 6, 11, 21]), rg: rE(r, 3, 4) }; },
    q: function (g) { return 'Übungsschaltung: Ein nichtinvertierender Verstärker soll die Verstärkung V_u = ' + fmt(g.v, 1) + ' haben, R_g = ' + fe(g.rg, 'Ω') + ' (nach Masse). Berechne den Rückkopplungswiderstand R_f.'; },
    val: function (g) { return FN('rfNin')(g.v, g.rg); },
    steps: function (g, v) { return ['Aus V_u = 1 + R_f / R_g folgt R_f = (V_u − 1) · R_g = ' + fmt(g.v - 1, 1) + ' · ' + fe(g.rg, 'Ω') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['minus-eins-vergessen', g.v * g.rg], ['plus-eins-falsch', (g.v + 1) * g.rg]]; } };
  Dx.uaSumm = { unit: 'V', tol: 0.03, what: 'U_a',
    gen: function (r) { let g, k = 0; do { g = { rf: rE(r, 4, 5), r1: rE(r, 3, 4), r2: rE(r, 3, 4), u1: pick(r, [0.2, 0.5, 1, 1.5]), u2: pick(r, [0.3, 0.5, 1.1, 2]) }; k++; } while (k < 80 && (g.r1 === g.r2 || Math.abs(g.rf * (g.u1 / g.r1 + g.u2 / g.r2)) > 10 || Math.abs(g.rf * (g.u1 / g.r1 + g.u2 / g.r2)) < 1)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein Summierer (idealer Operationsverstärker, ±12 V) hat R_f = ' + fe(g.rf, 'Ω') + '; U_1 = ' + fe(g.u1, 'V') + ' liegt über R_1 = ' + fe(g.r1, 'Ω') + ', U_2 = ' + fe(g.u2, 'V') + ' über R_2 = ' + fe(g.r2, 'Ω') + ' am invertierenden Eingang. Berechne U_a.'; },
    val: function (g) { return KOP().sum({ rf: g.rf, r: [g.r1, g.r2], u: [g.u1, g.u2], opv: 'ideal', uv: 12 }).ua; },
    steps: function (g, v) { return ['Eingangsströme: U_1 / R_1 = ' + fe(g.u1 / g.r1, 'A') + ', U_2 / R_2 = ' + fe(g.u2 / g.r2, 'A') + '.', 'U_a = −R_f · (U_1/R_1 + U_2/R_2) = −' + fe(g.rf, 'Ω') + ' · ' + fe(g.u1 / g.r1 + g.u2 / g.r2, 'A') + ' = ' + fe(v, 'V')]; },
    wrong: function (g, v) { return [['vorzeichen-ua', -v], ['nur-ein-eingang', -g.rf * g.u1 / g.r1], ['summe-statt-gewichtet', -(g.u1 + g.u2) * g.rf / g.r1]]; } };
  Dx.uaDiff = { unit: 'V', tol: 0.03, what: 'U_a',
    gen: function (r) { let g, k = 0; do { const a = rE(r, 3, 4), b = rE(r, 3, 5); g = { r1: a, r2: a, r3: b, r4: b, u1: pick(r, [0.5, 1, 1.6, 2]), u2: pick(r, [1.1, 2.1, 2.5, 3]) }; k++; } while (k < 80 && (g.u1 === g.u2 || g.r3 / g.r1 < 1.2 || Math.abs(g.r3 / g.r1 * (g.u2 - g.u1)) > 10 || Math.abs(g.r3 / g.r1 * (g.u2 - g.u1)) < 0.5)); return g; },
    q: function (g) { return 'Übungsschaltung: Ein Differenzverstärker (idealer Operationsverstärker, ±12 V) hat R_1 = R_2 = ' + fe(g.r1, 'Ω') + ' und R_3 = R_4 = ' + fe(g.r3, 'Ω') + '. U_1 = ' + fe(g.u1, 'V') + ' liegt am invertierenden Eingang (über R_1), U_2 = ' + fe(g.u2, 'V') + ' am nichtinvertierenden Eingang (über R_2). Berechne U_a.'; },
    val: function (g) { return KOP().diff({ r1: g.r1, r2: g.r2, r3: g.r3, r4: g.r4, u1: g.u1, u2: g.u2, opv: 'ideal', uv: 12 }).ua; },
    steps: function (g, v) { return ['Bei R_4 / R_2 = R_3 / R_1 gilt U_a = (R_3 / R_1) · (U_2 − U_1).', 'U_a = ' + fmt(g.r3 / g.r1, 3) + ' · (' + fe(g.u2, 'V') + ' − ' + fe(g.u1, 'V') + ') = ' + fe(v, 'V')]; },
    wrong: function (g, v) { return [['verstaerkung-vergessen', g.u2 - g.u1], ['u-vertauscht', -v]]; } };
  Dx.vDb = { unit: 'dB', tol: 0.03, what: 'a',
    gen: function (r) { return { v: pick(r, [2, 5, 10, 20, 50, 100, 200, 1000]) }; },
    q: function (g) { return 'Übungsaufgabe: Ein Verstärker hat die Spannungsverstärkung V_u = ' + fmt(g.v, 0) + '. Berechne das Verstärkungsmaß a in dB.'; },
    val: function (g) { return FN('vDb')(g.v); },
    steps: function (g, v) { return ['Für Spannungen gilt a = 20 · lg |V_u| = 20 · lg ' + fmt(g.v, 0) + ' = ' + fmt(v, 2) + ' dB.']; },
    wrong: function (g) { return [['dB-10lg', 10 * lg(g.v)], ['dB-faktor', g.v]]; } };
  Dx.uEinDb = { unit: 'V', tol: 0.03, what: 'U_e',
    gen: function (r) { return { a: pick(r, [20, 26, 34, 40, 46]), ua: pick(r, [1, 2, 5, 10]) }; },
    q: function (g) { return 'Übungsaufgabe: Ein Verstärker hat das Verstärkungsmaß a = ' + fmt(g.a, 0) + ' dB. Am Ausgang stehen ' + fe(g.ua, 'V') + '. Berechne die Eingangsspannung U_e.'; },
    val: function (g) { return g.ua / FN('vAusDb')(g.a); },
    steps: function (g, v) { const f = FN('vAusDb')(g.a); return ['Verstärkung: V_u = 10^(a / 20) = ' + fmt(f, 3) + '.', 'U_e = U_a / V_u = ' + fe(g.ua, 'V') + ' / ' + fmt(f, 3) + ' = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['dB-10lg', g.ua / Math.pow(10, g.a / 10)], ['a-als-faktor', g.ua / g.a]]; } };
  Dx.fgGbw = { unit: 'Hz', tol: 0.05, what: 'f_g',
    gen: function (r) { return { gbw: pick(r, [0.5e6, 1e6, 3e6, 10e6]), v: pick(r, [2, 5, 10, 20, 50, 100]) }; },
    q: function (g) { return 'Übungsschaltung: Ein gegengekoppelter Verstärker hat die Rauschverstärkung V_n = 1 + R_f / R_1 = ' + fmt(g.v, 0) + ', das Verstärkungs-Bandbreite-Produkt des Operationsverstärkers beträgt GBW = ' + fe(g.gbw, 'Hz') + '. Berechne die Grenzfrequenz f_g (Näherung).'; },
    val: function (g) { return FN('fgGbw')(g.gbw, g.v); },
    steps: function (g, v) { return ['Verstärkung mal Bandbreite bleibt konstant: f_g ≈ GBW / V_n = ' + fe(g.gbw, 'Hz') + ' / ' + fmt(g.v, 0) + ' = ' + fe(v, 'Hz')]; },
    wrong: function (g) { return [['gbw-mal-v', g.gbw * g.v], ['v-vergessen', g.gbw]]; } };
  Dx.fpb = { unit: 'Hz', tol: 0.03, what: 'f_max',
    gen: function (r) { return { sr: pick(r, [0.5, 1, 5, 13]), uhat: pick(r, [2, 5, 10, 12]) }; },
    q: function (g) { return 'Übungsschaltung: Ein Operationsverstärker hat die Slew-Rate SR = ' + fmt(g.sr, 1) + ' V/µs. Am Ausgang soll eine Sinusspannung mit dem Scheitelwert û = ' + fe(g.uhat, 'V') + ' ohne Verformung stehen. Berechne die höchste Frequenz f_max.'; },
    val: function (g) { return FN('fpb')(g.sr * 1e6, g.uhat); },
    alt: function (g) { return [g.sr * 1e6 / (2 * K2.pi * g.uhat)]; },
    steps: function (g, v) { return ['Slew-Rate in V/s: ' + fmt(g.sr, 1) + ' V/µs = ' + fmt(g.sr * 1e6, 0) + ' V/s.', 'f_max = SR / (2π · û) = ' + fmt(g.sr * 1e6, 0) + ' V/s / (2π · ' + fe(g.uhat, 'V') + ') = ' + fe(v, 'Hz')]; },
    wrong: function (g, v) { return [['zwei-pi', g.sr * 1e6 / g.uhat], ['uss-eingesetzt', v / 2], ['uhat-halbiert', v * 2], ['pi-statt-2pi', v * 2]]; } };
  Dx.uosOut = { unit: 'V', tol: 0.03, what: 'U_a,off',
    gen: function (r) { return { uos: pick(r, [1, 2, 3, 5]) * 1e-3, r1: rE(r, 3, 3), rf: rE(r, 4, 5) }; },
    q: function (g) { return 'Übungsschaltung: Ein Verstärker mit R_1 = ' + fe(g.r1, 'Ω') + ' und R_f = ' + fe(g.rf, 'Ω') + ' hat einen Operationsverstärker mit der Offsetspannung U_os = ' + fe(g.uos, 'V') + '. Berechne die Offsetspannung am Ausgang bei U_e = 0.'; },
    val: function (g) { return FN('uosOut')(g.uos, g.rf, g.r1); },
    steps: function (g, v) { return ['Rauschverstärkung: V_n = 1 + R_f / R_1 = ' + fmt(1 + g.rf / g.r1, 2) + '.', 'U_a,off = U_os · V_n = ' + fe(g.uos, 'V') + ' · ' + fmt(1 + g.rf / g.r1, 2) + ' = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['plus-eins-vergessen', g.uos * g.rf / g.r1], ['v-vergessen', g.uos]]; } };
  Dx.schmittSchwelle = { unit: 'V', tol: 0.03, what: 'U_o',
    gen: function (r) { const art = pick(r, ['inv', 'nin']); const us = pick(r, [5, 9, 12, 15]); if (art === 'inv') return { art: art, usat: us, r2: rE(r, 4, 5), r3: rE(r, 3, 4) }; return { art: art, usat: us, r1: rE(r, 3, 4), r2: rE(r, 4, 5) }; },
    q: function (g) { return g.art === 'inv' ? 'Übungsschaltung: Ein invertierender Schmitt-Trigger (U_ref = 0, idealer Operationsverstärker) hat die Aussteuergrenzen ±' + fe(g.usat, 'V') + ', die Mitkopplung R_2 = ' + fe(g.r2, 'Ω') + ' und R_3 = ' + fe(g.r3, 'Ω') + ' (nach Masse). Berechne die obere Schaltschwelle U_o.' : 'Übungsschaltung: Ein nichtinvertierender Schmitt-Trigger (U_ref = 0, idealer Operationsverstärker) hat die Aussteuergrenzen ±' + fe(g.usat, 'V') + ', den Eingangswiderstand R_1 = ' + fe(g.r1, 'Ω') + ' und die Mitkopplung R_2 = ' + fe(g.r2, 'Ω') + '. Berechne die obere Schaltschwelle U_o.'; },
    val: function (g) { return g.art === 'inv' ? KKO().schmitt({ art: 'inv', r2: g.r2, r3: g.r3, opv: 'ideal', uv: g.usat }).uo : KKO().schmitt({ art: 'nin', r1: g.r1, r2: g.r2, opv: 'ideal', uv: g.usat }).uo; },
    steps: function (g, v) { return g.art === 'inv' ? ['U_o = U_sat · R_3 / (R_2 + R_3) = ' + fe(g.usat, 'V') + ' · ' + fe(g.r3, 'Ω') + ' / ' + fe(g.r2 + g.r3, 'Ω') + ' = ' + fe(v, 'V') + '.', 'Die untere Schwelle ist −' + fe(v, 'V') + ', die Hysterese ' + fe(2 * v, 'V') + '.'] : ['U_o = U_sat · R_1 / R_2 = ' + fe(g.usat, 'V') + ' · ' + fe(g.r1, 'Ω') + ' / ' + fe(g.r2, 'Ω') + ' = ' + fe(v, 'V') + '.', 'Die untere Schwelle ist −' + fe(v, 'V') + ', die Hysterese ' + fe(2 * v, 'V') + '.']; },
    wrong: function (g, v) { return g.art === 'inv' ? [['hysterese-statt-schwelle', 2 * v], ['r2-teiler', g.usat * g.r2 / (g.r2 + g.r3)]] : [['hysterese-statt-schwelle', 2 * v], ['r1-r1r2', g.usat * g.r1 / (g.r1 + g.r2)]]; } };
  Dx.tOsz = { unit: 's', tol: 0.03, what: 'T',
    gen: function (r) { const p = pick(r, [[10000, 10000], [10000, 10000], [20000, 10000], [10000, 22000], [47000, 47000], [22000, 22000]]); return { r: rE(r, 3, 5), c: cE(r), r2: p[0], r3: p[1] }; },
    q: function (g) { return 'Übungsschaltung: Ein Rechteckgenerator (invertierender Schmitt-Trigger, U_ref = 0, idealer Operationsverstärker) hat R = ' + fe(g.r, 'Ω') + ', C = ' + fe(g.c, 'F') + ', R_2 = ' + fe(g.r2, 'Ω') + ' und R_3 = ' + fe(g.r3, 'Ω') + '. Berechne die Periodendauer T.'; },
    val: function (g) { return KKO().osc({ r: g.r, c: g.c, r2: g.r2, r3: g.r3, opv: 'ideal', uv: 12 }).T; },
    alt: function (g) { return g.r2 === g.r3 ? [2 * g.r * g.c * 1.1] : []; },
    steps: function (g, v) { const b = g.r3 / (g.r2 + g.r3); return ['Teilerverhältnis β = R_3 / (R_2 + R_3) = ' + fmt(b, 3) + '.', 'T = 2 · R · C · ln((1 + β) / (1 − β)) = 2 · ' + fe(g.r, 'Ω') + ' · ' + fe(g.c, 'F') + ' · ' + fmt(Math.log((1 + b) / (1 - b)), 3) + ' = ' + fe(v, 's')]; },
    wrong: function (g, v) { return [['ln-vergessen', 2 * g.r * g.c], ['halbe-periode', v / 2], ['rc-nur', g.r * g.c]]; } };
  Dx.slopeInt = { unit: 'V/s', tol: 0.03, what: 'dU_a/dt',
    gen: function (r) { return { ue: pick(r, [1, 2, 5]), r: rE(r, 4, 5), c: pick(r, [100e-9, 470e-9, 1e-6, 2.2e-6]) }; },
    q: function (g) { return 'Übungsschaltung: Ein Integrierer (idealer Operationsverstärker) mit R = ' + fe(g.r, 'Ω') + ' und C = ' + fe(g.c, 'F') + ' bekommt U_e = ' + fe(g.ue, 'V') + ' (Gleichspannung). Berechne die Steigung dU_a/dt des Ausgangs in V/s (mit Vorzeichen).'; },
    val: function (g) { return KAC().integrator({ r: g.r, c: g.c, ue: g.ue }).slope; },
    steps: function (g, v) { return ['Zeitkonstante: τ = R · C = ' + fe(g.r * g.c, 's') + '.', 'dU_a/dt = −U_e / (R · C) = −' + fe(g.ue, 'V') + ' / ' + fe(g.r * g.c, 's') + ' = ' + fmt(v, 3) + ' V/s']; },
    wrong: function (g, v) { return [['slope-vorzeichen', -v], ['mal-statt-durch', g.ue * g.r * g.c]]; } };
  Dx.rInt = { unit: 'Ω', tol: 0.03, what: 'R',
    gen: function (r) { return { f: pick(r, [50, 100, 200, 1000]), c: pick(r, [10e-9, 22e-9, 47e-9, 100e-9]) }; },
    q: function (g) { return 'Übungsschaltung: Ein Integrierer mit C = ' + fe(g.c, 'F') + ' soll bei f = ' + fe(g.f, 'Hz') + ' die Verstärkung |V| = 1 haben. Berechne den Eingangswiderstand R.'; },
    val: function (g) { return FN('rInt')(g.f, g.c); },
    alt: function (g) { return [1 / (2 * K2.pi * g.f * g.c)]; },
    steps: function (g, v) { return ['Bei |V| = 1 ist R = X_C = 1 / (2π · f · C) = 1 / (2π · ' + fe(g.f, 'Hz') + ' · ' + fe(g.c, 'F') + ') = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['zwei-pi', 1 / (g.f * g.c)], ['zweimal-pi', 1 / (Math.PI * g.f * g.c)]]; } };
  Dx.tauInt = { unit: 's', tol: 0.03, what: 'τ',
    gen: function (r) { return { r: rE(r, 3, 5), c: cE(r) }; },
    q: function (g) { return 'Übungsschaltung: Ein Integrierer hat R = ' + fe(g.r, 'Ω') + ' und C = ' + fe(g.c, 'F') + '. Berechne die Zeitkonstante τ.'; },
    val: function (g) { return FN('tau')(g.r, g.c); },
    steps: function (g, v) { return ['τ = R · C = ' + fe(g.r, 'Ω') + ' · ' + fe(g.c, 'F') + ' = ' + fe(v, 's')]; },
    wrong: function (g, v) { return [['kehrwert-tau', 1 / v], ['zwei-pi', v * 2 * Math.PI]]; } };
  Dx.fgAktiv = { unit: 'Hz', tol: 0.05, what: 'f_g',
    gen: function (r) { const art = pick(r, ['tp', 'hp']); return { art: art, r1: rE(r, 3, 4), rf: rE(r, 4, 5), c: pick(r, [1e-9, 2.2e-9, 10e-9, 47e-9, 100e-9]) }; },
    q: function (g) { return g.art === 'tp' ? 'Übungsschaltung: Ein aktiver Tiefpass erster Ordnung (invertierend, idealer Operationsverstärker) hat R_1 = ' + fe(g.r1, 'Ω') + ', R_f = ' + fe(g.rf, 'Ω') + ' und C_f = ' + fe(g.c, 'F') + ' parallel zu R_f. Berechne die Grenzfrequenz f_g.' : 'Übungsschaltung: Ein aktiver Hochpass erster Ordnung (invertierend, idealer Operationsverstärker) hat C_1 = ' + fe(g.c, 'F') + ' in Reihe zu R_1 = ' + fe(g.r1, 'Ω') + ' und R_f = ' + fe(g.rf, 'Ω') + '. Berechne die Grenzfrequenz f_g.'; },
    val: function (g) { return g.art === 'tp' ? KAC().tp({ r1: g.r1, rf: g.rf, cf: g.c }).fg : KAC().hp({ r1: g.r1, rf: g.rf, c1: g.c }).fg; },
    alt: function (g) { const R = g.art === 'tp' ? g.rf : g.r1; return [1 / (2 * K2.pi * R * g.c)]; },
    steps: function (g, v) { const R = g.art === 'tp' ? g.rf : g.r1; return [(g.art === 'tp' ? 'Beim Tiefpass bestimmen R_f und C_f die Grenzfrequenz: ' : 'Beim Hochpass bestimmen R_1 und C_1 die Grenzfrequenz: ') + 'f_g = 1 / (2π · R · C) = 1 / (2π · ' + fe(R, 'Ω') + ' · ' + fe(g.c, 'F') + ') = ' + fe(v, 'Hz')]; },
    wrong: function (g) { const R = g.art === 'tp' ? g.rf : g.r1; return [['zwei-pi', 1 / (R * g.c)], g.art === 'tp' ? ['r1-statt-rf', 1 / (2 * Math.PI * g.r1 * g.c)] : ['rf-statt-r1', 1 / (2 * Math.PI * g.rf * g.c)]]; } };
  const KINDS = ['rvLed', 'iLed', 'pRvLed', 'ledTausch', 'rvZ', 'izLast', 'rbSchalter', 'icLast', 'ueb', 'pVtr', 'ucePunkt', 'r2Teiler', 'ubbTeiler', 'reKonst', 'r1Zfolger', 'ueFolger', 'vuEmitter', 'vuGegen',
    'vInv', 'uaInv', 'rfInv', 'vNin', 'uaNin', 'rfNin', 'uaSumm', 'uaDiff', 'vDb', 'uEinDb', 'fgGbw', 'fpb', 'uosOut', 'schmittSchwelle', 'tOsz', 'slopeInt', 'rInt', 'tauInt', 'fgAktiv'];
  const PREFS = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function dispOf(v, unit) {
    if (unit === '' || unit === 'dB' || unit === '°' || unit.indexOf('/') >= 0 || !isFinite(v) || v === 0) return { value: v, unit: unit, factor: 1 };
    const a = Math.abs(v);
    let p = PREFS[PREFS.length - 1];
    for (let i = 0; i < PREFS.length; i++) if (a >= PREFS[i][0] * 0.99995) { p = PREFS[i]; break; }
    return { value: v / p[0], unit: p[1] + unit, factor: p[0] };
  }
  /* Antwortwerte aus der Aufgabe: value (SI), alt (Tabellenbuch-Rundungen), wrong (Fehlerbilder mit Text) */
  function buildEx(def, g) {
    const value = def.val(g);
    if (!fin(value)) V('Die Aufgabe hat keinen gültigen Wert.');
    const alt = [];
    (def.alt ? def.alt(g) : []).forEach(function (a) {
      if (a !== null && a !== undefined && fin(a) && Math.abs(a - value) > 1e-12 * Math.abs(value) && !alt.some(function (x) { return Math.abs(x - a) <= 1e-12 * Math.abs(a); })) alt.push(a);
    });
    const wrong = [];
    (def.wrong ? def.wrong(g, value) : []).forEach(function (w) {
      const wv = w[1];
      if (!fin(wv)) return;
      if (Math.abs(wv - value) <= 2 * def.tol * Math.abs(value)) return;            /* Gegenprobe: unterscheidbar vom richtigen Ergebnis */
      if (alt.some(function (a) { return Math.abs(wv - a) <= def.tol * Math.abs(a); })) return;
      if (wrong.some(function (x) { return Math.abs(x.value - wv) <= def.tol * Math.abs(x.value) + 1e-12 * Math.abs(wv); })) return;   /* erstes Fehlerbild gilt (wie in check) */
      const vars = Object.assign({ w: fv(wv, def.unit) }, w[2] || {});
      wrong.push({ id: w[0], value: wv, text: msg(w[0], vars) });
    });
    return { value: value, alt: alt, wrong: wrong, disp: dispOf(value, def.unit) };
  }
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 's', 'S', 'dB', 'V/s', 'V/µs', 'V/us'];
  function baseUnit(u) {
    if (!u) return '';
    if (ULIST.indexOf(u) >= 0) return u === 'Ohm' || u === 'ohm' ? 'Ω' : u;
    if (u.length >= 2 && 'pnµumkMG'.indexOf(u[0]) >= 0 && ULIST.indexOf(u.slice(1)) >= 0) { const b = u.slice(1); return b === 'Ohm' || b === 'ohm' ? 'Ω' : b; }
    return '';
  }
  function checkAnswerEx(def, built, tol, input) {
    let a, rest = '';
    if (typeof input === 'number') a = input;
    else if (typeof input === 'string') {
      a = parseNum(input);
      const m = input.trim().match(/^[+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?\s*(.*)$/);
      rest = m ? m[1].trim() : '';
    } else a = NaN;
    if (!fin(a)) return { ok: false, why: 'keine-zahl', text: msg('keine-zahl') };
    const unit = def.unit;
    const hasUnit = rest !== '';
    if (hasUnit && unit) {
      const b = baseUnit(rest);
      const same = b === unit || (unit === 'V/s' && (b === 'V/µs' || b === 'V/us'));
      if (b && !same && !(b === 'dB' && unit === '')) return { ok: false, why: 'einheit', text: msg('einheit', { gesucht: unit }) };
    }
    const cands = [a];
    if (!hasUnit && built.disp.factor !== 1) cands.push(a * built.disp.factor);
    const refs = [built.value].concat(built.alt);
    const close = function (x, y, t) { return Math.abs(x - y) <= t * Math.abs(y) + 1e-300; };
    for (let i = 0; i < cands.length; i++) for (let j = 0; j < refs.length; j++) if (close(cands[i], refs[j], tol)) return { ok: true, why: 'richtig', text: msg('richtig', { was: def.what, wert: fv(built.value, unit) }) };
    let x = cands[0];
    if (cands.length > 1 && built.value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / built.value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / built.value))); if (l1 < l0) x = cands[1]; }
    for (let k = 0; k < built.wrong.length; k++) {
      const w = built.wrong[k];
      for (let i = 0; i < cands.length; i++) if (close(cands[i], w.value, tol)) return { ok: false, why: w.id, text: w.text };
    }
    return diagGenericEx(def, built, x);
  }
  function diagGenericEx(def, built, a) {
    const v = built.value;
    if (a !== 0 && v !== 0 && ((a > 0) === (v > 0))) {
      const r = a / v, l = lg(Math.abs(r));
      if (Math.abs(l - Math.round(l)) < 0.012 && Math.round(l) !== 0) return { ok: false, why: 'vorsatz', text: msg('vorsatz', { faktor: Math.round(l) > 0 ? '10^' + Math.round(l) : '10^(−' + (-Math.round(l)) + ')' }) };
      if (Math.abs(r / TWO_PI - 1) < 0.03 || Math.abs(r * TWO_PI - 1) < 0.03) return { ok: false, why: 'zwei-pi', text: msg('zwei-pi') };
      if (r < 1) return { ok: false, why: 'zu-klein', text: msg('zu-klein', { pct: fmt((1 - r) * 100, 0) }) };
      return { ok: false, why: 'zu-gross', text: msg('zu-gross', { pct: fmt((r - 1) * 100, 0) }) };
    }
    if (a !== 0 && v !== 0) return { ok: false, why: 'vorzeichen', text: msg('vorzeichen') };
    return a < v ? { ok: false, why: 'zu-klein', text: msg('zu-klein', { pct: '100' }) } : { ok: false, why: 'zu-gross', text: msg('zu-gross', { pct: fmt(Math.abs(a - v) / Math.max(Math.abs(v), 1e-300) * 100, 0) }) };
  }
  const exercise = function (kind, seed) {
    try {
      const k = String(kind);
      const def = Dx[k];
      if (!def || KINDS.indexOf(k) < 0) return fail('Diese Aufgabenart gibt es nicht: ' + k.slice(0, 30) + '.');
      const sd = seed === undefined || seed === null ? 1 : num(seed, NaN);
      if (!isFinite(sd) || Math.abs(sd) > 1e9) return fail('Der Startwert (seed) muss eine Zahl sein.');
      const g = def.gen(C.rng(sd * 7919 + KINDS.indexOf(k) * 104729 + 13));
      const b = buildEx(def, g), tol = def.tol;
      const answer = { value: b.value, unit: def.unit, tol: tol, alt: b.alt.slice(), disp: b.disp };
      const steps = def.steps(g, b.value);
      const ex = {
        ok: true, valid: true, kind: k, seed: sd, question: def.q(g), given: g, answer: answer, steps: steps, hinweis: TEXTS.uebungswert,
        check: function (input) { try { return checkAnswerEx(def, b, tol, input); } catch (e) { return { ok: false, why: 'keine-zahl', text: msg('keine-zahl') }; } }
      };
      hide(ex, 'wrong', b.wrong);
      return ex;
    } catch (e) { return fail(e && e.anaWhy ? e.anaWhy : 'Mit diesen Eingaben gibt es keine Aufgabe.'); }
  };
  exercise.kinds = KINDS.slice();
  /* Loesung zu gegebenen Werten (Tests, Diagnose): { ok, value, unit, alt, wrong:[{id,value,text}] } */
  exercise.solve = SG(function (kind, given) {
    const def = Dx[kind];
    if (!def) V('Diese Aufgabenart gibt es nicht: ' + String(kind).slice(0, 30) + '.');
    const b = buildEx(def, obj(given));
    return { ok: true, valid: true, value: b.value, unit: def.unit, alt: b.alt, wrong: b.wrong, disp: b.disp, tol: def.tol };
  });
  exercise.msg = msg;
  hide(exercise, 'msg', msg);
  C.extend('exercise', exercise);

  /* =============================== Diagnose =============================== */
  function DM(id, kind, text) { return { id: id, kind: kind, text: text, bedingung: true, gegenprobe: true }; }
  const IDS = {
    diode: ['led-ohne-rv', 'led-ueberstrom', 'diode-verpolt', 'z-unter-uz', 'z-ueberlast', 'uf-temp', 'rv-offen', 'diode-offen', 'diode-kurz'],
    schalter: ['sperrt', 'halb-offen', 'uebersteuert-stark', 'freilauf-fehlt', 'pv-hoch', 'b-streuung', 'rb-offen', 'ce-schluss', 'ce-offen', 'last-offen', 'versorgung-fehlt', 'be-offen'],
    emitter: ['ap-unten', 'ap-oben', 'clip-unten', 'clip-oben', 'ce-offen', 'r1-offen', 'r2-offen', 'rc-offen', 're-offen', 'c1-offen', 'klirr-hoch', 'defekt', 'versorgung-fehlt', 'vu-ohne-last'],
    folger: ['vu-kleiner-1', 'rout-hoch', 'z-iz-klein', 'cs-zu-wenig-dioden', 'quelle-hochohmig', 'r1-offen', 'r2-offen', 're-offen', 'defekt', 'versorgung-fehlt', 'koppel-c-offen'],
    opv_inv: ['ohne-gegenkopplung', 'saettigung', 'gbw-grenze', 'slew', 'offset', 'versorgung-fehlt', 'versorgung-minus-fehlt', 'rf-offen', 'r1-offen', 'rf-kurz', 'ausgang-defekt', 'v-vorzeichen', 'summierer-vorzeichen'],
    opv_nin: ['ohne-gegenkopplung', 'saettigung', 'gbw-grenze', 'slew', 'offset', 'versorgung-fehlt', 'versorgung-minus-fehlt', 'versorgung-verpolt', 'rf-offen', 'rg-offen', 'eingang-offen', 'v-vorzeichen', 'diff-abgleich'],
    opv_komp: ['ohne-gegenkopplung', 'hysterese-fehlt', 'kippt-nicht', 'osc-schwingt-nicht', 'r3-offen', 'c-offen', 'versorgung-fehlt', 'versorgung-minus-fehlt'],
    opv_aktiv: ['saettigung', 'gbw-grenze', 'slew', 'offset', 'integrierer-drift', 'c-offen', 'rp-offen', 'r1-offen', 'versorgung-fehlt', 'versorgung-minus-fehlt']
  };
  function isFault(M, id) { return M.fehlerId === id; }
  function cleanNum(x) { return fin(x) ? x : NaN; }

  function dgDiode(M) {
    const c = M.ctl, r = M.r, out = [], led = ueberlastLed(c.typ);
    if (led && M.cfg.rv <= GV('led_rv_kurz') && M.fehler !== 'diode kurz') out.push(DM('led-ohne-rv', 'error', 'Der Vorwiderstand beträgt nur ' + fe(M.cfg.rv, 'Ω') + ': Der Strom wird nicht mehr begrenzt, sondern nur noch von der Kennlinie der LED festgelegt (I = ' + fe(r.id, 'A') + (r.ueberlast ? ', zulässig ' + limT('led_imax') + '). Die LED wäre überlastet' : ')') + '. Ein Vorwiderstand ist immer nötig (nur Simulation).'));
    if (led && r.ueberlast) out.push(DM('led-ueberstrom', 'error', 'Der Strom I = ' + fe(r.id, 'A') + ' liegt über dem zulässigen Strom ' + limT('led_imax') + ': Die LED wäre überlastet (nur Simulation). Mit größerem Vorwiderstand sinkt der Strom.'));
    if (r.zustand === 'verpolt') out.push(DM('diode-verpolt', 'error', c.typ === 'z' || M.cfg.typ === 'z' ? 'Die Z-Diode liegt in Durchlassrichtung (U_D = ' + fe(r.ud, 'V') + ', I = ' + fe(r.id, 'A') + '): Sie leitet wie eine Siliziumdiode und stabilisiert nichts. Die Z-Diode arbeitet in Sperrrichtung.' : 'Das Bauteil ist in Sperrrichtung gepolt: Es fließt kein Strom (I = ' + fe(r.id, 'A') + '), die ganze Quellenspannung liegt am Bauteil (U_D = ' + fe(r.ud, 'V') + ').'));
    if (M.cfg.typ === 'z' && r.zustand === 'sperrt' && M.cfg.uq > 0) out.push(DM('z-unter-uz', 'warn', 'Die Spannung am Bauteil (U_D = ' + fe(r.ud, 'V') + ') liegt unter der Z-Spannung U_Z = ' + fe(M.cfg.uz, 'V') + ': Es gibt keinen Durchbruch, der Z-Strom ist null (I_Z = ' + fe(r.iz, 'A') + ').'));
    if (M.cfg.typ === 'z' && r.ueberlast) out.push(DM('z-ueberlast', 'error', 'Die Verlustleistung P_Z = ' + fe(r.pd, 'W') + ' liegt über den zulässigen ' + limT('pz_max') + ': Die Z-Diode wäre überlastet (nur Simulation). Ein größerer Vorwiderstand senkt den Strom.'));
    if (Math.abs(c.temp - limN('temp_ref')) > 1e-9 && r.zustand !== 'kurz') {
      const t0 = C.diode.operating(Object.assign({}, M.cfg, { temp: limN('temp_ref') }));
      if (t0 && t0.ok) out.push(DM('uf-temp', 'info', 'Bei ' + fmt(c.temp, 0) + ' °C statt ' + fmt(limN('temp_ref'), 0) + ' °C verschiebt sich die Flussspannung (' + fmt(limN('tk_uf') * 1000, 1) + ' mV/K, Übungswert): U_D ändert sich um ' + fmt((r.ud - t0.ud) * 1000, 1) + ' mV, von ' + fe(t0.ud, 'V') + ' auf ' + fe(r.ud, 'V') + '.'));
    }
    if (isFault(M, 'rv-offen')) out.push(DM('rv-offen', 'error', 'Der Vorwiderstand ist offen (oder nicht angeschlossen): Es fließt kein Strom (I = ' + fe(r.id, 'A') + '), die ganze Quellenspannung liegt am offenen Zweig (U_R = ' + fe(r.ur, 'V') + ', U_D = ' + fe(r.ud, 'V') + ').'));
    if (isFault(M, 'diode-offen')) out.push(DM('diode-offen', 'error', 'Der Strompfad ist am Bauteil unterbrochen: Es fließt kein Strom (I = ' + fe(r.id, 'A') + '), am Vorwiderstand fällt keine Spannung ab (U_R = ' + fe(r.ur, 'V') + '), die ganze Quellenspannung liegt am Bauteil (U_D = ' + fe(r.ud, 'V') + ').'));
    if (isFault(M, 'diode-kurz')) out.push(DM('diode-kurz', 'error', 'Das Bauteil ist kurzgeschlossen: U_D = ' + fe(r.ud, 'V') + ', der Strom wird nur noch vom Vorwiderstand begrenzt (I = ' + fe(r.id, 'A') + (r.ueberlast ? ', über dem zulässigen Wert' : '') + ').'));
    return out;
  }
  function dgSchalter(M) {
    const c = M.ctl, r = M.r, rel = M.rel, out = [], ube = limN('ube'), f = M.fehler;
    const ust = c.ust, ubE = M.cfg.ub;
    if (r.zustand === 'sperrt' && f === 'keiner' && ust <= ube + 1e-12) out.push(DM('sperrt', 'warn', 'Die Steuerspannung U_St = ' + fe(ust, 'V') + ' ist nicht größer als U_BE = ' + limT('ube') + ': Es fließt kein Basisstrom, der Transistor sperrt (I_C = ' + fe(r.ic, 'A') + ', U_CE = U_B = ' + fe(r.uce, 'V') + ').'));
    if (r.zustand === 'aktiv') out.push(DM('halb-offen', 'warn', 'Der Transistor ist nur aktiv, nicht gesättigt (ü = ' + fmt(r.ueb, 2) + ' ist kleiner als 1, halb offen): U_CE = ' + fe(r.uce, 'V') + ', P_V = ' + fe(r.pv, 'W') + '. Für die Sättigung darf R_B höchstens ' + fe(r.rbMax, 'Ω') + ' betragen (ü = 1).'));
    if (r.zustand === 'saettigung' && r.ueb > GV('ue_stark')) out.push(DM('uebersteuert-stark', 'info', 'Der Übersteuerungsfaktor ü = ' + fmt(r.ueb, 1) + ' ist sehr groß (über ' + fmt(GV('ue_stark'), 0) + UEBUNG + '): Der Transistor sättigt tief, beim Ausschalten kommt dadurch eine Verzögerung (Ausschaltverzögerung, hier nur als Begriff).'));
    if (rel && rel.ueberUceo && c.freilauf === 0) {
      const mit = C.tr.relais({ ub: M.cfg.ub, rspule: M.cfg.rspule, lspule: c.lspule, freilauf: true });
      out.push(DM('freilauf-fehlt', 'error', 'Ohne Freilaufdiode springt die Spannung am Transistor beim Abschalten bis auf U_CEO = ' + fe(rel.ucePeak, 'V') + ' (zulässig ' + limT('uceo') + '): Das Bauteil wäre gefährdet (Fehlerbild, nur Simulation). Mit Freilaufdiode bleibt die Spitze bei ' + fe(mit && mit.ok ? mit.ucePeak : NaN, 'V') + '.'));
    }
    if (r.pv > limN('ptot')) out.push(DM('pv-hoch', 'error', 'Die Verlustleistung P_V = ' + fe(r.pv, 'W') + ' liegt über den zulässigen ' + limT('ptot') + ': Der Transistor wäre überlastet (nur Simulation).'));
    if (r.zustand === 'saettigung' && r.ueb < 2) {
      const hb = C.tr.switch(Object.assign({}, M.cfg, { b: c.b / 2 }));
      if (hb && hb.ok && hb.valid !== false && hb.ueb < 1) out.push(DM('b-streuung', 'warn', 'Schon bei halber Gleichstromverstärkung (B/2 = ' + fmt(c.b / 2, 0) + ') fiele der Übersteuerungsfaktor von ' + fmt(r.ueb, 2) + ' auf ' + fmt(hb.ueb, 2) + ' unter 1: Der Transistor wäre dann nur noch aktiv. Die Streuung von B braucht Reserve (ü ≥ ' + limT('ue_min').replace('≥ ', '').replace(' (Übungswert)', '') + UEBUNG + ').'));
    }
    if (isFault(M, 'rb-offen')) out.push(DM('rb-offen', 'error', 'Der Basisstrom ist I_B = ' + fe(r.ib, 'A') + ' (praktisch null), obwohl U_St = ' + fe(ust, 'V') + ' anliegt; U_CE = ' + fe(r.uce, 'V') + ' liegt nahe U_B: Der Basiszweig ist unterbrochen.'));
    if (isFault(M, 'ce-schluss')) out.push(DM('ce-schluss', 'error', 'U_CE = ' + fe(r.uce, 'V') + ' und der Laststrom I_C = ' + fe(r.ic, 'A') + ' fließt immer, auch ohne Ansteuerung: Kollektor und Emitter sind durchverbunden (defekter Transistor, nur Simulation).'));
    if (isFault(M, 'ce-offen')) out.push(DM('ce-offen', 'error', 'I_C = ' + fe(r.ic, 'A') + ', obwohl I_B = ' + fe(r.ib, 'A') + ' fließt; U_CE = U_B = ' + fe(r.uce, 'V') + ': Die Kollektor-Emitter-Strecke ist unterbrochen (defekter Transistor, nur Simulation).'));
    if (isFault(M, 'be-offen')) out.push(DM('be-offen', 'error', 'I_B = ' + fe(r.ib, 'A') + ' und I_C = ' + fe(r.ic, 'A') + ' trotz U_St = ' + fe(ust, 'V') + '; U_CE = U_B = ' + fe(r.uce, 'V') + ': Die Basis-Emitter-Strecke ist unterbrochen (defekter Transistor, nur Simulation).'));
    if (isFault(M, 'last-offen')) out.push(DM('last-offen', 'error', 'I_C = ' + fe(r.ic, 'A') + ' (praktisch null), obwohl I_B = ' + fe(r.ib, 'A') + ' fließt und der Transistor durchgesteuert ist: Der Laststrompfad ist unterbrochen.'));
    if (isFault(M, 'versorgung-fehlt')) out.push(DM('versorgung-fehlt', 'error', 'Die Versorgung fehlt: U_B = ' + fe(ubE, 'V') + ', es fließt kein Laststrom (I_C = ' + fe(r.ic, 'A') + ').'));
    return out;
  }
  function dgEmitter(M) {
    const c = M.ctl, a = M.r, dc = M.dc && M.dc.ok ? M.dc : null, lg2 = M.large, out = [], f = M.fehler, ub = M.cfg.ub, fen = limN('ap_fenster');
    const okAp = dc && f !== 'versorgung fehlt' && f !== 'transistor defekt';
    if (okAp && (dc.zustand === 'saettigung' || (dc.zustand === 'aktiv' && dc.uce < fen * ub))) out.push(DM('ap-unten', 'warn', 'Der Arbeitspunkt liegt zu weit unten: U_CE = ' + fe(dc.uce, 'V') + (dc.zustand === 'saettigung' ? ' ist auf U_CE,sat gedrückt (Sättigung)' : ' ist nur ' + pc(dc.uce / ub, 0) + ' der Betriebsspannung') + ', I_C = ' + fe(dc.ic, 'A') + '. Dem Ausgang fehlt die Reserve nach unten: Die negative Halbwelle wird begrenzt.'));
    if (okAp && (dc.zustand === 'sperrt' || (dc.zustand === 'aktiv' && dc.uce >= (1 - fen) * ub))) out.push(DM('ap-oben', 'warn', 'Der Arbeitspunkt liegt zu weit oben: U_CE = ' + fe(dc.uce, 'V') + ' liegt nahe U_B = ' + fe(ub, 'V') + ', I_C = ' + fe(dc.ic, 'A') + ' ist klein. Dem Ausgang fehlt die Reserve nach oben: Die positive Halbwelle wird begrenzt.'));
    if (lg2 && (lg2.clip === 'unten' || lg2.clip === 'beide')) out.push(DM('clip-unten', 'warn', 'Die negative Halbwelle des Ausgangs ist abgeflacht (Sättigung): Die Spitze beträgt ' + fe(lg2.uaPeak, 'V') + ' bei der unteren Aussteuergrenze ' + fe(a.uaMaxUnten, 'V') + '; am Eingang wären höchstens U_e,max = ' + fe(a.ueMax, 'V') + ' möglich.'));
    if (lg2 && (lg2.clip === 'oben' || lg2.clip === 'beide')) out.push(DM('clip-oben', 'warn', 'Die positive Halbwelle des Ausgangs ist abgeflacht (Sperren): Die Spitze beträgt ' + fe(lg2.uaPeak, 'V') + ' bei der oberen Aussteuergrenze ' + fe(a.uaMaxOben, 'V') + '; am Eingang wären höchstens U_e,max = ' + fe(a.ueMax, 'V') + ' möglich.'));
    if (M.cfg.ce === false) {
      const mit = C.emit.ac(Object.assign({}, M.cfg, { ce: true })), ohne = a.valid === false ? null : a;
      if (mit && mit.ok && mit.valid !== false && ohne) out.push(DM('ce-offen', 'warn', 'Ohne Emitterkondensator wirkt auch R_E2 als Gegenkopplung: |V_u| sinkt von ' + fmt(Math.abs(mit.vu), 2) + ' auf ' + fmt(Math.abs(ohne.vu), 2) + ' (belastet); dafür wird die Schaltung weniger verzerrt.'));
    }
    if (isFault(M, 'r1-offen')) out.push(DM('r1-offen', 'error', 'Ohne R_1 fehlt die Basisvorspannung: U_BB = ' + fe(dc ? dc.ubb : NaN, 'V') + ' ist kleiner als U_BE, der Transistor sperrt (I_C = ' + fe(dc ? dc.ic : NaN, 'A') + ', U_CE = U_B = ' + fe(dc ? dc.uce : NaN, 'V') + ').'));
    if (isFault(M, 'r2-offen')) out.push(DM('r2-offen', 'error', 'Ohne R_2 steigt die Basisspannung (U_BB = ' + fe(dc ? dc.ubb : NaN, 'V') + '): Der Transistor geht in die Sättigung (U_CE = ' + fe(dc ? dc.uce : NaN, 'V') + ', I_C = ' + fe(dc ? dc.ic : NaN, 'A') + '), das Signal wird nicht mehr verstärkt.'));
    if (isFault(M, 'rc-offen')) out.push(DM('rc-offen', 'error', 'Ohne R_C kann kein Kollektorstrom fließen (I_C = ' + fe(dc ? dc.ic : NaN, 'A') + '): Der Ausgang liefert kein Signal, die Spannung am Kollektor hängt nicht mehr am Arbeitspunkt.'));
    if (isFault(M, 're-offen')) out.push(DM('re-offen', 'error', 'Der Emitterwiderstand ist offen: Der Emitter hat keinen Strompfad, I_C = ' + fe(dc ? dc.ic : NaN, 'A') + ' (praktisch null), U_CE = ' + fe(dc ? dc.uce : NaN, 'V') + '.'));
    if (isFault(M, 'c1-offen')) {
      const ok0 = C.emit.ac(Object.assign({}, M.cfg, { c1: c.c1 }));
      out.push(DM('c1-offen', 'error', 'Das Eingangssignal kommt nicht durch: Mit offenem Koppelkondensator steigt die untere Grenzfrequenz von f_u = ' + fe(ok0 && ok0.ok ? ok0.fu : NaN, 'Hz') + ' auf ' + fe(a.fu, 'Hz') + ', bei ' + fe(c.f, 'Hz') + ' kommt praktisch nichts an.'));
    }
    if (lg2 && lg2.thd > limN('klirr_grenze')) out.push(DM('klirr-hoch', 'warn', 'Der Klirrfaktor THD = ' + fmt(lg2.thdProzent, 2) + ' % liegt über ' + pc(limN('klirr_grenze'), 0) + UEBUNG + ': Das Ausgangssignal ist verzerrt. Verringere die Aussteuerung oder erhöhe die Gegenkopplung.'));
    if (isFault(M, 'defekt')) out.push(DM('defekt', 'error', 'I_C = ' + fe(dc ? dc.ic : NaN, 'A') + ' und U_CE = U_B = ' + fe(dc ? dc.uce : NaN, 'V') + ': Der Transistor leitet nicht (defekt, nur Simulation).'));
    if (isFault(M, 'versorgung-fehlt')) out.push(DM('versorgung-fehlt', 'error', 'Die Versorgung fehlt: U_B = ' + fe(ub, 'V') + ', alle Spannungen und Ströme sind praktisch null (I_C = ' + fe(a.ic, 'A') + ').'));
    if (a.valid !== false && M.cfg.rl < 1e11 && Math.abs(a.vu) < 0.995 * Math.abs(a.vuLeer)) out.push(DM('vu-ohne-last', 'info', 'Mit der Last R_L = ' + fe(M.cfg.rl, 'Ω') + ' sinkt |V_u| von ' + fmt(Math.abs(a.vuLeer), 2) + ' (Leerlauf) auf ' + fmt(Math.abs(a.vu), 2) + ' (belastet): R_C und R_L liegen für das Signal parallel (' + fe(a.rcl, 'Ω') + ').'));
    return out;
  }
  function dgFolger(M) {
    const c = M.ctl, r = M.r, out = [], f = M.fehler;
    if (M.betrieb === 'signal') {
      const sel = M.sel, kol = r.kollektor, valid = r.valid !== false, rl = M.cfg.rl;
      if (valid && M.schaltung === 'kollektor' && kol && kol.vu < 1) out.push(DM('vu-kleiner-1', 'info', 'V_u = ' + fmt(kol.vu, 4) + ': knapp unter 1, nie darüber; keine Phasendrehung (Impedanzwandler).'));
      if (valid && rl < 1e11 && sel && sel.rout > rl) out.push(DM('rout-hoch', 'warn', 'Der Ausgangswiderstand r_aus = ' + fe(sel.rout, 'Ω') + ' ist größer als die Last R_L = ' + fe(rl, 'Ω') + ': Mehr als die Hälfte der Spannung geht im Ausgangswiderstand verloren (nur ' + pc(rl / (rl + sel.rout), 0) + ' kommen an).'));
      if (valid && M.schaltung === 'kollektor' && rl < 1e11) {
        const direkt = fin(r.direkt) ? r.direkt : rl / (c.rg + rl), ue = M.ue;
        if (direkt < 0.5 && kol && Math.abs(kol.vus) > direkt) out.push(DM('quelle-hochohmig', 'info', 'Die Quelle ist hochohmig (R_G = ' + fe(c.rg, 'Ω') + ' gegen R_L = ' + fe(rl, 'Ω') + '): Bei direktem Anschluss kommen nur ' + fe(ue * direkt, 'V') + ' an der Last an (' + pc(direkt, 1) + ' von ' + fe(ue, 'V') + '), mit der Kollektorschaltung ' + fe(ue * Math.abs(kol.vus), 'V') + '.'));
      }
      const info = valid ? '' : ' (I_C = ' + fe(r.ic, 'A') + ')';
      if (isFault(M, 'r1-offen')) out.push(DM('r1-offen', 'error', 'Ohne R_1 fehlt die Basisvorspannung: Der Transistor sperrt' + info + ', am Ausgang kommt kein Signal an.'));
      if (isFault(M, 'r2-offen')) out.push(DM('r2-offen', 'error', 'Ohne R_2 steigt die Basisspannung: Der Transistor ist in der Sättigung' + info + ', der Emitter folgt dem Eingang nicht mehr.'));
      if (isFault(M, 're-offen')) out.push(DM('re-offen', 'error', 'Der Emitterwiderstand ist offen: Der Emitter hat keinen Strompfad' + info + '; der Ausgang folgt dem Eingang nicht.'));
      if (isFault(M, 'defekt')) out.push(DM('defekt', 'error', 'Der Transistor leitet nicht' + info + ' (defekter Transistor, nur Simulation): Am Ausgang kommt kein Signal an.'));
      if (isFault(M, 'versorgung-fehlt')) out.push(DM('versorgung-fehlt', 'error', 'Die Versorgung fehlt: U_B = ' + fe(M.cfg.ub, 'V') + ', der Transistor arbeitet nicht' + info + '.'));
      if (isFault(M, 'koppel-c-offen')) out.push(DM('koppel-c-offen', 'error', 'Das Signal fehlt am Eingang (U_e = ' + fe(M.ue, 'V') + '): Mit offenem Koppelkondensator kommt keine Wechselspannung an die Basis, am Ausgang bleibt nur die Gleichspannung.'));
    } else if (M.betrieb === 'zener') {
      if (r.ok && c.iz < GV('z_iz_faktor') * r.ib) out.push(DM('z-iz-klein', 'warn', 'Der Z-Strom I_Z = ' + fe(c.iz, 'A') + ' ist kleiner als der Basisstrom I_B = ' + fe(r.ib, 'A') + UEBUNG + ': Die Z-Diode verliert bei Laständerung ihren Arbeitsbereich, die Z-Spannung bricht ein.'));
      const bad = !r.ok ? ' (' + r.why + ')' : '';
      if (isFault(M, 'defekt') || isFault(M, 're-offen')) out.push(DM(M.fehlerId, 'error', 'Es fließt kein Kollektorstrom (I_C = ' + fe(M.cfg.ic, 'A') + '): Der Emitterausgang bleibt ohne Strom.'));
      if (isFault(M, 'versorgung-fehlt')) out.push(DM('versorgung-fehlt', 'error', 'Die Versorgung fehlt: U_B = ' + fe(M.cfg.ub, 'V') + bad + '.'));
    } else {
      if (c.nd * c.ud <= limN('ube') + 1e-12) out.push(DM('cs-zu-wenig-dioden', 'error', 'n_D · U_D = ' + fe(c.nd * c.ud, 'V') + ' ist nicht größer als U_BE = ' + limT('ube') + ': Es liegt keine Spannung am Emitterwiderstand, der Kollektorstrom ist null.'));
      if (isFault(M, 'defekt') || isFault(M, 're-offen') || isFault(M, 'versorgung-fehlt')) out.push(DM(M.fehlerId, 'error', 'Es fließt kein Kollektorstrom (I_C = ' + fe(M.cfg.ic, 'A') + '): Die Stromquelle liefert nichts.'));
    }
    return out;
  }
  function opVals(M) { const r = M.r; return { ua: r.ua, ualin: r.ualin, usat: r.usat, v: r.v }; }
  function dgOpCommon(M, rigId) {
    const c = M.ctl, r = M.r, f = M.fehler, out = [], real = c.opv !== 'ideal';
    const nin = rigId === 'opv_nin', diff = nin && c.schaltung === 'differenz';
    if (r.sat && !r.defektAusgang && !r.verpolt) out.push(DM('saettigung', 'warn', 'Der Ausgang ist begrenzt: |U_a,lin| = ' + fe(Math.abs(r.ualin), 'V') + ' ist nicht kleiner als U_sat = ' + fe(r.usat, 'V') + (fin(r.ueMax) ? '; die Eingangsspannung dürfte höchstens U_e,max = ' + fe(r.ueMax, 'V') + ' betragen' : '') + '.'));
    if (real && !diff && r.fg > 0 && c.f > GV('gbw_anteil') * r.fg && c.form !== 'gleich') {
      const art = rigId === 'opv_inv' ? 'inv' : 'nin';
      const cfgf = rigId === 'opv_inv' ? { art: 'inv', r1: M.cfg.r1, rf: M.cfg.rf } : { art: 'nin', rg: M.cfg.rg, rf: c.schaltung === 'folger' ? 0 : M.cfg.rf };
      const fr = KOP().freq(Object.assign({ opv: c.opv, uv: M.base.uv }, cfgf), [c.f]);
      if (fr && fr.ok && fr.valid !== false) out.push(DM('gbw-grenze', 'warn', 'Bei f = ' + fe(c.f, 'Hz') + ' ist die Verstärkung wegen der Grenzfrequenz f_g = ' + fe(r.fg, 'Hz') + ' (Verstärkungs-Bandbreite-Produkt) schon auf ' + pc(fr.h[0] / fr.v0, 1) + ' des Werts bei tiefen Frequenzen gefallen.'));
    }
    if (real && !diff && c.form !== 'gleich' && fin(r.ualin) && c.f > 0) {
      const uh = Math.min(Math.abs(r.ualin), r.usat), sl = C.deep && C.deep.slew ? C.deep.slew({ opv: c.opv, uhat: uh, f: c.f, uv: M.base.uv }) : null;
      if (sl && sl.ok && sl.valid !== false && uh > 0 && c.f > sl.fpb) out.push(DM('slew', 'warn', 'Der Ausgang (Scheitelwert ' + fe(uh, 'V') + ') müsste bei f = ' + fe(c.f, 'Hz') + ' schneller steigen, als die Slew-Rate erlaubt: Die höchste Frequenz ist f_max = ' + fe(sl.fpb, 'Hz') + '; darüber wird das Signal dreieckförmig verformt.'));
    }
    if (real && !diff && Math.abs(M.ue === undefined ? c.ue : M.ue) < 1e-12 && fin(r.uosOut) && r.uosOut > 0) out.push(DM('offset', 'info', 'Bei U_e = 0 steht am Ausgang trotzdem U_a,off = ' + fe(r.uosOut, 'V') + ': Die Offsetspannung wird mit V_n = ' + fmt(r.vn, 1) + ' verstärkt.'));
    return out;
  }
  function dgSupply(M) {
    const out = [], g = KOP().grenzen(M.base), r = M.r;
    const gp = g && g.ok ? g.p : 0, gn = g && g.ok ? g.n : 0;
    if (isFault(M, 'versorgung-fehlt')) out.push(DM('versorgung-fehlt', 'error', 'Die Versorgung fehlt: Der Operationsverstärker kann nicht von 0 V abweichen' + (gp === 0 && gn === 0 ? ', beide Aussteuergrenzen sind ' + fe(0, 'V') : ', die Aussteuergrenzen sind ' + fe(gp, 'V') + ' und −' + fe(gn, 'V')) + (fin(r.ua) ? ', U_a = ' + fe(r.ua, 'V') : '') + '.'));
    if (isFault(M, 'versorgung-minus-fehlt')) out.push(DM('versorgung-minus-fehlt', 'error', 'Ohne negative Versorgung kann der Ausgang nicht unter 0 V gehen (Bereich 0 bis ' + fe(gp, 'V') + ')' + (fin(r.ualin) && fin(r.ua) ? ': Die berechnete Ausgangsspannung ' + fe(r.ualin, 'V') + ' wird auf U_a = ' + fe(r.ua, 'V') + ' begrenzt' : ': Der Ausgang ist nur nach oben begrenzt') + '.'));
    return out;
  }
  function dgOpInv(M) {
    const c = M.ctl, r = M.r, out = [], f = M.fehler, ue = c.ue;
    if (isFault(M, 'rf-offen')) out.push(DM('ohne-gegenkopplung', 'error', TEXTS.gegenkopplung + ' Mit offener Rückkopplung wirkt die Leerlaufverstärkung: Bei U_e = ' + fe(ue, 'V') + ' liegt der Ausgang schon bei U_a = ' + fe(r.ua, 'V') + ' an der Aussteuergrenze.'));
    out.push.apply(out, dgOpCommon(M, 'opv_inv'));
    out.push.apply(out, dgSupply(M));
    if (isFault(M, 'rf-offen')) out.push(DM('rf-offen', 'error', 'R_f ist offen: Es gibt keine Gegenkopplung, die Verstärkung ist riesig (V_u = ' + fmt(r.v) + ') und nur durch die Aussteuergrenze ' + fe(r.usat, 'V') + ' begrenzt.'));
    if (isFault(M, 'r1-offen')) out.push(DM('r1-offen', 'error', 'R_1 ist offen: Es fließt kein Eingangsstrom, am Ausgang steht U_a = ' + fe(r.ua, 'V') + ' (kein Signal) bei U_e = ' + fe(ue, 'V') + '.'));
    if (isFault(M, 'rf-kurz')) out.push(DM('rf-kurz', 'error', 'R_f ist kurzgeschlossen: V_u = ' + fmt(r.v) + ' (praktisch null), der Ausgang folgt dem virtuellen Nullpunkt, U_a = ' + fe(r.ua, 'V') + '.'));
    if (isFault(M, 'ausgang-defekt')) out.push(DM('ausgang-defekt', 'error', 'Der Ausgang hängt an der positiven Aussteuergrenze (U_a = ' + fe(r.ua, 'V') + ') und folgt dem Eingang nicht (defekt, nur Simulation).'));
    if (!M.fehlerId) {
      if (c.schaltung === 'summierer') out.push(DM('summierer-vorzeichen', 'info', 'Der Summierer invertiert: U_a = −R_f · Σ(U_k / R_k) = ' + fe(r.ualin, 'V') + '.'));
      else if (r.valid !== false) out.push(DM('v-vorzeichen', 'info', 'Der Ausgang ist gegenüber dem Eingang um ' + fmt(limN('opv_inv_phase'), 0) + '° gedreht: V_u = ' + fmt(r.v) + ' ist negativ (invertierender Verstärker).'));
    }
    return out;
  }
  function dgOpNin(M) {
    const c = M.ctl, r = M.r, out = [], diff = c.schaltung === 'differenz';
    if (isFault(M, 'rf-offen')) out.push(DM('ohne-gegenkopplung', 'error', TEXTS.gegenkopplung + ' Mit offener Rückkopplung wirkt die Leerlaufverstärkung: Bei U_e = ' + fe(M.ue, 'V') + ' liegt der Ausgang schon bei U_a = ' + fe(r.ua, 'V') + ' an der Aussteuergrenze.'));
    out.push.apply(out, dgOpCommon(M, 'opv_nin'));
    out.push.apply(out, dgSupply(M));
    if (isFault(M, 'versorgung-verpolt')) out.push(DM('versorgung-verpolt', 'error', 'Mit vertauschter Versorgung wäre der Operationsverstärker zerstört (Lehrmodell): Ausgang U_a = ' + fe(r.ua, 'V') + ' (Fehlerbild, nur Simulation).'));
    if (isFault(M, 'rf-offen')) out.push(DM('rf-offen', 'error', 'R_f ist offen: Es gibt keine Gegenkopplung, die Verstärkung ist riesig (V_u = ' + fmt(r.v) + ') und nur durch die Aussteuergrenze ' + fe(r.usat, 'V') + ' begrenzt.'));
    if (isFault(M, 'rg-offen')) out.push(DM('rg-offen', 'error', 'R_g ist offen: Es gibt keinen Zweig nach Masse, V_u = ' + fmt(r.v) + ' (wie beim Spannungsfolger).'));
    if (isFault(M, 'eingang-offen')) out.push(DM('eingang-offen', 'error', 'Der Eingang ist offen: U_e = ' + fe(M.ue, 'V') + ', am Ausgang steht U_a = ' + fe(r.ua, 'V') + ' (kein Signal).'));
    if (!M.fehlerId && !diff && r.valid !== false) out.push(DM('v-vorzeichen', 'info', 'Der Ausgang ist gleichphasig zum Eingang: V_u = ' + fmt(r.v) + ' ist positiv und mindestens 1 (nichtinvertierender Verstärker).'));
    if (diff && fin(r.abgleich) && Math.abs(r.abgleich - 1) > 1e-6) out.push(DM('diff-abgleich', 'warn', 'R_4 / R_2 = ' + fmt(M.cfg ? c.r4 / c.r2 : NaN, 3) + ' ist ungleich R_3 / R_1 = ' + fmt(c.r3 / c.r1, 3) + ': Der Differenzverstärker ist nicht abgeglichen, die Gleichtaktverstärkung beträgt ' + fmt(r.vgl, 4) + ' (abgeglichen: 0).'));
    return out;
  }
  function dgOpKomp(M) {
    const c = M.ctl, r = M.r, out = [], art = M.art;
    if (art === 'komparator') out.push(DM('ohne-gegenkopplung', 'info', TEXTS.gegenkopplung + ' Hier vergleicht der Komparator U_+ = ' + fe(c.uoff + c.ue, 'V') + ' mit U_− = ' + fe(c.uref, 'V') + ' (Differenz ' + fe(r.ud, 'V') + '): Der Ausgang steht bei U_a = ' + fe(r.ua, 'V') + '.'));
    if (art === 'rechteck' && r.valid === false) out.push(DM('osc-schwingt-nicht', 'error', 'Der Rechteckgenerator schwingt nicht: Die Schwellen U_o = ' + fe(r.uo, 'V') + ' und U_u = ' + fe(r.uu, 'V') + ' liegen außerhalb der Aussteuergrenzen (' + fe(M.base.uv === 0 ? 0 : (KOP().grenzen(M.base) || {}).p, 'V') + ').'));
    if ((art === 'schmitt_inv' || art === 'schmitt_nin') && r.valid !== false) {
      if (fin(r.uh) && r.uh <= 1e-6 * Math.max(r.usat, 1e-9) + 1e-9) out.push(DM('hysterese-fehlt', 'error', 'Die Hysterese beträgt nur U_H = ' + fe(r.uh, 'V') + ': Ohne Mitkopplung (R_2 offen) gibt es nur eine Schaltschwelle, der Ausgang kippt bei jeder Störung hin und her.'));
      const hi = c.uoff + c.ue, lo = c.uoff - c.ue;
      if (!(hi > r.uo && lo < r.uu) && !M.fehlerId) out.push(DM('kippt-nicht', 'warn', 'Der Eingang läuft nur von ' + fe(lo, 'V') + ' bis ' + fe(hi, 'V') + ', die Schaltschwellen liegen bei U_u = ' + fe(r.uu, 'V') + ' und U_o = ' + fe(r.uo, 'V') + ': Der Ausgang kippt nicht in beide Richtungen.'));
    }
    if (isFault(M, 'r3-offen')) out.push(DM('r3-offen', 'error', 'R_3 ist offen: Die Schwellen liegen bei U_o = ' + fe(r.uo, 'V') + ' und U_u = ' + fe(r.uu, 'V') + ' (fast ±U_sat = ' + fe(r.usat, 'V') + ').'));
    if (isFault(M, 'c-offen')) out.push(DM('c-offen', 'error', art === 'rechteck' && r.valid !== false ? 'C ist offen (nur noch Leitungskapazität): Der Generator schwingt mit f = ' + fe(r.f, 'Hz') + ', weit über dem gewollten Bereich (Hinweis: Das Modell gilt dort nicht mehr).' : 'C ist offen: Das Zeitglied fehlt, ohne Kondensator gibt es keine Periode.'));
    if (isFault(M, 'r2-offen') && !out.some(function (x) { return x.id === 'hysterese-fehlt'; }) && art !== 'rechteck') out.push(DM('hysterese-fehlt', 'error', 'R_2 ist offen: Die Mitkopplung fehlt, U_H = ' + fe(r.uh, 'V') + '.'));
    out.push.apply(out, dgSupply(M));
    return out;
  }
  function dgOpAktiv(M) {
    const c = M.ctl, r = M.r, out = [], real = c.opv !== 'ideal';
    if (M.wcfg) {
      const w = KAC().wave(Object.assign({}, M.wcfg, { ue: c.ue, f: c.f, form: c.form }), 128);
      if (w && w.ok && w.valid !== false && isFinite(w.uaPeak) && isFinite(w.usat) && w.uaPeak >= w.usat - 1e-9 * Math.max(1, w.usat) && w.usat > 0) out.push(DM('saettigung', 'warn', 'Der Ausgang ist begrenzt: Die Spitze erreicht die Aussteuergrenze U_sat = ' + fe(w.usat, 'V') + (M.art === 'integrierer' && fin(r.tSat) ? '; bei U_e = ' + fe(c.ue, 'V') + ' dauert das ' + fe(r.tSat, 's') + ' (ideal)' : '') + '.'));
    } else if (r.sat) out.push(DM('saettigung', 'warn', 'Der Ausgang ist begrenzt: |U_a,lin| = ' + fe(Math.abs(r.ualin), 'V') + ' erreicht die Aussteuergrenze U_sat = ' + fe(r.usat, 'V') + '.'));
    if (M.art === 'real' && real && r.fg > 0 && c.f > GV('gbw_anteil') * r.fg) {
      const fr = KOP().freq({ art: 'inv', r1: M.cfg.r1, rf: c.rf, opv: c.opv, uv: M.base.uv }, [c.f]);
      if (fr && fr.ok && fr.valid !== false) out.push(DM('gbw-grenze', 'warn', 'Bei f = ' + fe(c.f, 'Hz') + ' ist die Verstärkung wegen der Grenzfrequenz f_g = ' + fe(r.fg, 'Hz') + ' (Verstärkungs-Bandbreite-Produkt) schon auf ' + pc(fr.h[0] / fr.v0, 1) + ' gefallen.'));
    }
    if (M.art === 'real' && real && c.form !== 'gleich' && fin(r.ualin)) {
      const uh = Math.min(Math.abs(r.ualin), r.usat), sl = C.deep && C.deep.slew ? C.deep.slew({ opv: c.opv, uhat: uh, f: c.f, uv: M.base.uv }) : null;
      if (sl && sl.ok && sl.valid !== false && uh > 0 && c.f > sl.fpb) out.push(DM('slew', 'warn', 'Der Ausgang (Scheitelwert ' + fe(uh, 'V') + ') müsste bei f = ' + fe(c.f, 'Hz') + ' schneller steigen, als die Slew-Rate erlaubt: Die höchste Frequenz ist f_max = ' + fe(sl.fpb, 'Hz') + '.'));
    }
    if (M.art === 'real' && real && Math.abs(c.ue) < 1e-12 && fin(r.uosOut) && r.uosOut > 0) out.push(DM('offset', 'info', 'Bei U_e = 0 steht am Ausgang trotzdem U_a,off = ' + fe(r.uosOut, 'V') + ' (Offsetspannung mal V_n).'));
    if (M.art === 'integrierer' && r.rpOffen && fin(r.drift) && r.drift > 0) out.push(DM('integrierer-drift', 'warn', 'Ohne Parallelwiderstand R_p driftet der Ausgang mit ' + fe(r.drift, 'V/s') + ' (Offsetspannung) und erreicht die Sättigung nach t = ' + fe(r.tSatOff, 's') + '.'));
    if (isFault(M, 'rp-offen')) out.push(DM('rp-offen', 'error', 'Der Parallelwiderstand R_p fehlt: Der Integrierer hat keinen Gleichspannungsabgleich, ein Gleichanteil wird bis zur Sättigung integriert' + (fin(r.tSat) ? ' (bei U_e = ' + fe(c.ue, 'V') + ' nach t = ' + fe(r.tSat, 's') + ')' : '') + '.'));
    if (isFault(M, 'c-offen')) out.push(DM('c-offen', 'error', 'C ist offen (nur noch Leitungskapazität): ' + (M.art === 'integrierer' ? 'Die Zeitkonstante τ = ' + fe(r.tau, 's') + ' ist winzig, der Integrierer integriert nicht mehr.' : 'Die Grenzfrequenz verschiebt sich auf ' + fe(M.fref, 'Hz') + ', die Schaltung wirkt nicht mehr als Filter.')));
    if (isFault(M, 'r1-offen')) out.push(DM('r1-offen', 'error', 'R_1 ist offen: Es fließt kein Eingangsstrom, am Ausgang steht kein Signal (' + (M.art === 'integrierer' ? 'Steigung ' + fe(r.slope, 'V/s') : 'U_a = ' + fe(r.ua === undefined ? 0 : r.ua, 'V')) + ').'));
    out.push.apply(out, dgSupply(M));
    return out;
  }
  const DIAG = { diode: dgDiode, schalter: dgSchalter, emitter: dgEmitter, folger: dgFolger, opv_inv: dgOpInv, opv_nin: dgOpNin, opv_komp: dgOpKomp, opv_aktiv: dgOpAktiv };
  /* Messbefunde (nur Messwerte, nie der Fehlerfall) */
  function mess(id, name, val) { return DM('messung-' + id, 'info', name + ' = ' + val); }
  function messOf(M) {
    const r = M.r, c = M.ctl, out = [];
    const add = function (id, n, x, u) { if (fin(x)) out.push(mess(id, n, fe(x, u))); };
    switch (M.rigId) {
      case 'diode': add('ud', 'U_D', r.ud, 'V'); add('id', 'I_D', r.id, 'A'); add('ur', 'U_R', r.ur, 'V'); break;
      case 'schalter': add('ic', 'I_C', r.ic, 'A'); add('ib', 'I_B', r.ib, 'A'); add('uce', 'U_CE', r.uce, 'V'); add('ube', 'U_BE', r.ube, 'V'); break;
      case 'emitter': { const d = M.dc && M.dc.ok ? M.dc : r; add('ic', 'I_C', d.ic, 'A'); add('ib', 'I_B', d.ib, 'A'); add('uce', 'U_CE', d.uce, 'V'); add('ue', 'U_E', d.ue, 'V'); if (r.valid !== false) out.push(mess('vu', '|V_u|', fmt(Math.abs(r.vu), 2))); break; }
      case 'folger':
        if (M.betrieb === 'signal') { if (r.valid !== false && M.sel) { out.push(mess('vu', 'V_u', fmt(M.sel.vu, 4))); add('rin', 'r_ein', M.sel.rin, 'Ω'); add('rout', 'r_aus', M.sel.rout, 'Ω'); } else add('ic', 'I_C', r.ic, 'A'); }
        else if (M.betrieb === 'zener') { if (r.ok) { add('ue', 'U_E', r.ue, 'V'); add('ib', 'I_B', r.ib, 'A'); } else out.push(mess('ue', 'U_E', fe(0, 'V'))); }
        else { if (r.ok) { add('ic', 'I_C', r.ic, 'A'); add('re', 'R_E', r.re, 'Ω'); } else add('ic', 'I_C', 0, 'A'); }
        break;
      case 'opv_inv': case 'opv_nin': add('ua', 'U_a', r.ua, 'V'); if (fin(r.v)) out.push(mess('v', 'V_u', fmt(r.v))); if (fin(r.ualin)) add('ualin', 'U_a,lin', r.ualin, 'V'); break;
      case 'opv_komp': if (M.art === 'komparator') add('ua', 'U_a', r.ua, 'V'); else if (r.valid !== false) { add('uo', 'U_o', r.uo, 'V'); add('uu', 'U_u', r.uu, 'V'); add('uh', 'U_H', r.uh, 'V'); if (M.art === 'rechteck') add('t', 'T', r.T, 's'); } else { add('uo', 'U_o', r.uo, 'V'); add('uu', 'U_u', r.uu, 'V'); } break;
      default: if (fin(M.fref)) add('fg', 'f_g', M.fref, 'Hz'); if (fin(r.tau)) add('tau', 'τ', r.tau, 's'); if (fin(r.slope)) out.push(mess('slope', 'dU_a/dt', fmt(r.slope, 3) + ' V/s')); if (fin(r.ua)) add('ua', 'U_a', r.ua, 'V');
    }
    return out;
  }
  /* Antwortdiagnose (zu exercise): ctx = { kind, seed|given, antwort } */
  function diagAntwort(ctx) {
    const kind = String(ctx.kind);
    let g = ctx.given;
    const def = Dx[kind];
    if (!def) return [];
    if (!isObj(g)) { const ex = exercise(kind, ctx.seed === undefined ? 1 : ctx.seed); if (!ex.ok) return []; g = ex.given; }
    const b = buildEx(def, g);
    const a = typeof ctx.antwort === 'string' ? parseNum(ctx.antwort) : ctx.antwort;
    if (!fin(a)) return [];
    const cands = [a];
    if (typeof ctx.antwort === 'string' && !/[A-Za-zΩµ°]/.test(ctx.antwort.replace(/[eE][+-]?\d+/, '')) && b.disp.factor !== 1) cands.push(a * b.disp.factor);
    const out = [];
    b.wrong.forEach(function (w) { if (cands.some(function (x) { return Math.abs(x - w.value) <= def.tol * Math.abs(w.value); })) out.push({ id: w.id, kind: 'warn', text: w.text, bedingung: true, gegenprobe: true, wert: w.value }); });
    return out;
  }
  const diagnose = function (ctx) {
    try {
      if (!isObj(ctx)) return [];
      if (ctx.kind !== undefined) return diagAntwort(ctx);
      if (ctx.rigId === undefined) return [];
      const id = String(ctx.rigId);
      if (!DIAG[id]) return [];
      const M = buildModel(id, ctx.ctl);
      if (ctx.verdeckt === true) return messOf(M);
      return DIAG[id](M).filter(function (m) { return m && typeof m.text === 'string' && m.text.indexOf('NaN') < 0 && m.text.indexOf('undefined') < 0; });
    } catch (e) { return []; }
  };
  diagnose.catalog = Object.freeze(Object.keys(IDS).reduce(function (o, k) { o[k] = Object.freeze(IDS[k].slice()); return o; }, {}));
  hide(diagnose, 'catalog', diagnose.catalog);
  C.extend('diagnose', diagnose);

  /* =============================== Fehlerkatalog (faults) =============================== */
  const FAULT_TXT = {
    'verpolt': 'Quellenspannung verpolt', 'diode offen': 'Bauteil offen', 'diode kurz': 'Bauteil kurzgeschlossen', 'rv offen': 'Vorwiderstand offen',
    'rb offen': 'Basisvorwiderstand offen', 'ce schluss': 'Kollektor-Emitter-Strecke durchverbunden', 'ce offen': 'Kollektor-Emitter-Strecke unterbrochen', 'be offen': 'Basis-Emitter-Strecke unterbrochen',
    'last offen': 'Last offen', 'versorgung fehlt': 'Versorgung fehlt', 'r1 offen': 'R_1 offen', 'r2 offen': 'R_2 offen', 'rc offen': 'R_C offen', 're offen': 'Emitterwiderstand offen',
    'c1 offen': 'Koppelkondensator offen', 'transistor defekt': 'Transistor defekt', 'koppel-c offen': 'Koppelkondensator offen', 'rf offen': 'R_f offen', 'rf kurz': 'R_f kurzgeschlossen',
    'versorgung minus fehlt': 'negative Versorgung fehlt', 'ausgang defekt': 'Ausgang defekt', 'rg offen': 'R_g offen', 'versorgung verpolt': 'Versorgung verpolt', 'eingang offen': 'Eingang offen',
    'r3 offen': 'R_3 offen', 'c offen': 'Kondensator offen', 'rp offen': 'Parallelwiderstand R_p offen'
  };
  function measDict(M) {
    const r = M.r, o = {}, put = function (k, v) { if (fin(v)) o[k] = v; };
    switch (M.rigId) {
      case 'diode': put('ud', r.ud); put('id', r.id); put('ur', r.ur); put('pd', r.pd); break;
      case 'schalter': put('ic', r.ic); put('ib', r.ib); put('uce', r.uce); put('ube', r.ube); put('pv', r.pv); put('plast', r.plast); if (M.rel) { put('ucePeak', M.rel.ucePeak); } break;
      case 'emitter': { const d = M.dc && M.dc.ok ? M.dc : r; put('ic', d.ic); put('ib', d.ib); put('uce', d.uce); put('ue', d.ue); put('ubb', d.ubb); if (r.valid !== false) { put('vu', r.vu); put('vus', r.vus); put('rin', r.rin); } break; }
      case 'folger': if (M.betrieb === 'signal') { if (r.valid !== false && M.sel) { put('vu', M.sel.vu); put('vus', M.sel.vus); put('rin', M.sel.rin); put('rout', M.sel.rout); } } else if (M.betrieb === 'zener') { put('ue', r.ok ? r.ue : 0); put('r1', r.r1); } else { put('ic', r.ok ? r.ic : 0); put('re', r.re); } break;
      case 'opv_inv': case 'opv_nin': put('ua', r.ua); put('v', r.v); put('ualin', r.ualin); put('usat', r.usat); o.sat = r.sat ? 1 : 0; break;
      case 'opv_komp': put('ua', r.ua); put('uo', r.uo); put('uu', r.uu); put('uh', r.uh); put('T', r.T); put('f', r.f); break;
      default: put('fg', M.fref); put('tau', r.tau); put('slope', r.slope); put('ua', r.ua);
    }
    return o;
  }
  const faults = {
    list: function (rigId) {
      try { const l = FEHLER[rigId]; if (!l) return []; return l.filter(function (x) { return x !== 'keiner'; }).map(function (x) { return { id: x, label: FAULT_TXT[x] || x, diag: FEHLER_DIAG[x] || null }; }); } catch (e) { return []; }
    },
    predict: SG(function (rigId, faultId, ctl) {
      const id = String(rigId);
      if (!DEF[id]) V('Den Prüfstand „' + id.slice(0, 30) + '“ gibt es nicht.');
      const f = canonFehler(id, faultId);
      if (f === null) V('Den Fehlerfall „' + String(faultId).slice(0, 30) + '“ gibt es an dieser Anlage nicht.');
      const M = buildModel(id, Object.assign({}, obj(ctl), { fehler: f }));
      const ids = DIAG[id](M).map(function (x) { return x.id; });
      return { ok: true, valid: true, rigId: id, fault: f, label: FAULT_TXT[f] || f, meas: measDict(M), diag: ids, messbefunde: messOf(M).map(function (x) { return x.text; }), text: 'Fehlerfall „' + (FAULT_TXT[f] || f) + '“ (nur Simulation): ' + messOf(M).map(function (x) { return x.text; }).join(', ') + '.' };
    }),
    labels: Object.freeze(Object.assign({}, FAULT_TXT))
  };
  hide(faults, 'labels', faults.labels);
  C.extend('faults', faults);
  C.extend('diagGrenzen', diagGrenzen);

  /* =============================== Laeufer runSeq =============================== */
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
        const Rr = root.ANA_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'ANA_RIGS ist nicht geladen.');
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
        else out.errors.push('Dieser Prüfstand kennt keine Schritte (do).');
      } catch (e) { out.errors.push('do(' + name + '): ' + (e && e.message)); }
      if (!okA) out.rejected.push({ t: t, do: name });
      out.actions.push({ t: t, do: name, ok: okA });
      out.order.push(name);
    }
    if (isObj(opts.controls)) Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, i) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: isObj(e.set) ? e.set : null, ramp: isObj(e.ramp) ? e.ramp : null, fire: !!e.fire, act: typeof e.do === 'string' && e.do ? e.do : null, k: i });
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
  C.extend('runSeq', function () {
    try { return runSeq.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], assess: null, errors: ['Interner Fehler im Läufer.'], rejected: [], actions: [], order: [] }; }
  });

  if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
