/* ntscore-diag.js - Netzteil-Lab Kern Teil 3 (NTS_CORE): Fehlersuche (fault), Auslegen (design), Pruefmodell (assess), Diagnose (diagnose),
 * Rechner (formulas), Uebungen (exercise) und Ablaufprogramm-Laeufer (runSeq). SPEC 4.10 bis 4.13, Paket WP1c.
 * Reine Rechnung, keine DOM-Zugriffe. Erweitert DENSELBEN Namensraum wie ntscore.js und ntscore-sw.js (die muessen VOR dieser Datei geladen sein; in Node
 * holt sich diese Datei sie selbst per require, wenn NTS_CORE noch fehlt). Browser: window.NTS_CORE, Node: module.exports / globalThis.NTS_CORE.
 * Vanilla-JS, kein eval, kein Math.random, keine Datumsabfrage. KEINE zweite Formel: jede Zahl kommt aus ntscore.js / ntscore-sw.js; hier stehen nur Ablauf,
 * Vergleiche mit limits, Texte und Zusammenstellungen. Einzige eigene Rechnung: grenzf = 1/(2 pi sqrt(LC)) (steht in keinem anderen Kernteil, Pool S2020-N26).
 *
 * ===================================================================================================
 * SCHNITTSTELLEN (SPEC 4.10 bis 4.13; Abweichungen und Zusaetze in quelle/ntslab/ABWEICHUNGEN.md, Abschnitt WP1c)
 *  fault.catalog                      [{ id, name, symptom, stufe, netz[], messpunkte:[{point,name,unit,soll,ist,sollText,istText}], ursache, behebung, bauteil, sicht, symptome[] }] (19)
 *  fault.make(id, opts?)              -> { ok, id, name, netz, fehler, par, state } ; id 'zufall' (opts.seed) oder 'ok' (fehlerfrei); opts { netz, seed, par }
 *  fault.probe(state, point)          -> { ok, point, name, unit, value, text, soll, sollText, abweichung } ; fault.probe.points = [ids] ; fault.probe.info = { id: {...} }
 *  fault.sicht(state)                 -> { ok, text } (Sichtpruefung am freigeschalteten Geraet)
 *  fault.repair(state, bauteil)       -> { ok, state, behoben, falsch, text }  (Bauteil tauschen; falsches Bauteil bleibt wirkungslos und wird vermerkt)
 *  fault.path(symptom)                -> { ok, symptom, steps:[{id,name,text,punkte[]}], reihenfolge[] } ; fault.order(actions, symptom?) -> { ok, text, ... }
 *  fault.reference(netz?, par?)       -> fehlerfreier Zustand ; fault.netze ; fault.chain (Funktionsbloecke in der Reihenfolge des Pools H2023-N03)
 *  design.linear(cfg) ; design.buck(cfg) ; design.stringText(res)
 *  assess(rigId, state) -> { ok, ampel, text, margin? }   fuer trafo, gleich, stabil, buck, topo, gate, regel, fehler (state = Steuerwerte des Pruefstands, Einheiten wie dort)
 *  diagnose(ctx)        -> [ { id, kind, text, wert, grenze, gegenprobe, fx?, link? } ]   ctx = { rigId, state, ... }
 *  formulas             [{ id, name, symbol, expr, unit, args, fn, run, explain }] (30), fn rechnet in SI, ungueltig -> NaN
 *  exercise(kind, seed) -> { ok, kind, seed, question, given, answer:{ value, unit, tol, alt[] }, steps[], check(input) -> { ok, text, why } } ; exercise.kinds
 *  runSeq(rigFactory|rigId|rig, seq, tEndS, opts?) -> { ok, samples:[{t,meters,state}], final, events, faults, assess, errors, rejected, actions, order }
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  function tryRequire(n) { try { return typeof require === 'function' ? require(n) : null; } catch (e) { return null; } }
  if (!root.NTS_CORE) { tryRequire('./ntscore.js'); tryRequire('./ntscore-sw.js'); }
  const C = root.NTS_CORE = root.NTS_CORE || {};
  if (!C.guard || !C.util || !C.limit || !C.rect || !C.buck) {
    if (typeof console !== 'undefined') console.warn('ntscore-diag.js: ntscore.js und ntscore-sw.js muessen zuerst geladen werden.');
    return;
  }
  const U = C.util;
  const num = U.num, pos = U.pos, nn = U.nn, fin = U.fin, fail = U.fail, has = U.has, hide = U.hide;
  const G_ = function (fn) { return C.guard(fn, 'num'); };
  const S_ = function (fn) { return C.guard(fn, 'struct'); };
  const A_ = function (fn) { return C.guard(fn, 'array'); };
  const fmt = C.fmt, fmtEng = C.fmtEng, TEXTS = C.TEXTS;
  const LV = function (id) { return C.limitValue(id); };
  const isArr = Array.isArray;
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function isStr(s) { return typeof s === 'string'; }
  const PI = Math.PI;
  const EPS = 1e-9;
  const D = TEXTS.diag;
  const pc = function (x, d) { return fmt(x, d === undefined ? 1 : d) + ' %'; };

  /* ---------- zusaetzliche Grenzwerte (Uebungswerte A, Fragen F40 bis F44 in AUSBILDER.md) ---------- */
  function addLimit(id, value, unit, cmp, status, quelle, frage, text) {
    if (C.limit(id)) return;
    C.limits.push({ id: id, value: value, unit: unit, cmp: cmp, status: status, quelle: quelle, frage: frage, text: text });
  }
  /* Fehlersuche (F40) */
  addLimit('ref_u2', 8, 'V', '=', 'A', '—', 'F40', 'Sekundärspannung des Referenz-Netzteils der Fehlersuche (Effektivwert).');
  addLimit('ref_i', 0.2, 'A', '=', 'A', '—', 'F40', 'Laststrom des Referenz-Netzteils der Fehlersuche (Linearregler).');
  addLimit('ref_c', 2200, 'µF', '=', 'A', '—', 'F40', 'Ladekondensator des Referenz-Netzteils der Fehlersuche.');
  addLimit('c_rest', 10, '%', '=', 'A', '—', 'F40', 'Restkapazität eines ausgetrockneten Elkos (SPEC 4.11).');
  addLimit('esr_defekt', 1, 'Ω', '=', 'A', '—', 'F40', 'ESR eines defekten Elkos.');
  addLimit('l_sat_rest', 20, '%', '=', 'A', '—', 'F40', 'Restinduktivität der Drossel in Sättigung.');
  addLimit('i_ueberlast', 2, 'A', '=', 'A', '—', 'F40', 'Laststrom bei Überlast des Linearreglers.');
  addLimit('u2_zu_klein', 6, 'V', '=', 'A', '—', 'F40', 'Zu kleine Sekundärspannung (falscher Transformator) im Fehlerbild "Regler-Eingang zu niedrig".');
  addLimit('ilim_faktor', 1.5, '', '=', 'A', '—', 'F40', 'Stromgrenze des Schaltreglers als Vielfaches des Nennstroms (Kurzschluss, Fehlersuche).');
  addLimit('r3_ref', 0.6, 'Ω', '=', 'A', '—', 'F40', 'Messwiderstand der Strombegrenzung im Referenz-Netzteil (Pool W2024-23).');
  addLimit('temp_warm', 0.1, 'W', '>=', 'A', '—', 'F40', 'Verlustleistung, ab der die Temperaturanzeige der Fehlersuche "warm" zeigt (darüber "heiß" ab pv_therm).');
  /* Regelkreis-Lehrmodell (F41) */
  addLimit('loop_c', 100e-6, 'F', '=', 'A', '—', 'F41', 'Ausgangskondensator des Regelkreis-Lehrmodells.');
  addLimit('loop_raus', 5, 'Ω', '=', 'A', '—', 'F41', 'Ausgangswiderstand des Stellglieds im Regelkreis-Lehrmodell.');
  addLimit('loop_vr', 10, '', '=', 'A', '—', 'F41', 'Regelverstärkung des Regelkreis-Lehrmodells (Vorgabe, unkompensiert).');
  addLimit('loop_vr_schwing', 200, '', '=', 'A', '—', 'F41', 'Regelverstärkung, bei der das Lehrmodell ohne Kompensation schwingt.');
  addLimit('loop_tau', 20e-6, 's', '=', 'A', '—', 'F41', 'Verzögerung (Zeitkonstante) des Reglers im Lehrmodell.');
  addLimit('loop_di', 0.5, 'A', '=', 'A', '—', 'F41', 'Laststromsprung im Regelkreis-Lehrmodell.');
  addLimit('loop_komp', 10, '', '=', 'A', '—', 'F41', 'Kompensation: Faktor, um den die Schleifenverstärkung am Durchtritt sinkt (Dominantpol-Kompensation im Lehrmodell).');
  /* Auslegen (F42) */
  addLimit('imin_anteil', 10, '%', '=', 'A', '—', 'F42', 'Kleinstlast der Drossel-Lückgrenze beim Auslegen: Anteil des Nennstroms.');
  addLimit('r1_offen', 1e6, 'Ω', '>=', 'A', '—', 'F44', 'Ab diesem Wert gilt der Teilerwiderstand R1 im Prüfstand als offen.');
  /* belegte Toleranzen der Rechenaufgaben (Pool-Feld toleranz) */
  addLimit('tol_rechnen', 3, '%', '<=', 'belegt', 'pool:W2021-N44', null, 'Relative Toleranz der Rechenaufgaben (Pool-Feld toleranz 0,02 bis 0,03).');
  addLimit('tol_eta', 2, '%', '<=', 'belegt', 'pool:H2026-20', null, 'Relative Toleranz für Wirkungsgrad und Tastverhältnis (Pool-Feld toleranz 0,02).');

  /* ---------- Meldungstexte (nur ergaenzen, was Teil 1 und 2 nicht haben; Vorlagen decken sich mit den Rueckfalltexten der Pruefstaende) ---------- */
  function dText(id, kind, text, extra) {
    if (has(D, id)) return;
    D[id] = { kind: kind, text: text };
    if (extra) for (const k in extra) D[id][k] = extra[k];
  }
  dText('trafo-einbruch', 'warn', 'Die Klemmenspannung bricht um {e} ein ({uk} von {ul}); grün bis {g} %, rot über {r} % (Übungswerte, der Ausbilder gleicht ab).');
  dText('trafo-ueberlast', 'error', 'Überlast: Die Klemmenspannung ist unter null gerechnet, der Strom ist für diesen Innenwiderstand zu groß.');
  dText('brumm-gross', 'warn', 'Die Brummspannung ΔU = {dU} (f_p = {fp}, C = {C}) liegt über dem Lehrfaustwert {grenze} (Übungswert).');
  dText('c-zu-klein', 'warn', 'Für den Lehrfaustwert braucht der Ladekondensator mindestens {cmin}; eingestellt sind {C}.');
  dText('brumm-100-gegen-50', 'info', 'Einweg: Die Pulsfrequenz beträgt nur {fp}, ΔU = {dU}. Mit der Brücke (100 Hz) wäre ΔU = {dUb}.');
  dText('einschalt-hoch', 'info', 'Beim Einschalten fließt bis zu {imax}: Der leere Ladekondensator wirkt zuerst wie ein Kurzschluss, R_i und der Vorwiderstand begrenzen den Strom.');
  dText('rv-zu-klein', 'warn', 'Im Leerlauf nähme die Z-Diode {pz} auf, mehr als P_max = {pmax} (Übungswert). Der Vorwiderstand müsste mindestens {rvmin} haben, eingestellt sind {rv}.');
  dText('z-p-zu-gross', 'error', 'Die Verlustleistung der Z-Diode ({pz}) liegt über dem zulässigen Wert ({pmax}).');
  dText('regler-heiss', 'warn', 'Verlustleistung {p}: Kühlung und Sperrschichttemperatur rechnest du im Thermik-Lab, nicht hier.', { link: 'thmlab.html' });
  dText('lm317-imin', 'warn', 'Der Laststrom ({i}) liegt unter dem Mindestlaststrom des LM317 ({imin}): Die Ausgangsspannung kann zu hoch werden. Datenblatt maßgeblich.');
  dText('sat-drossel', 'error', 'Der Spitzenstrom der Drossel ({ilmax}) liegt über der Sättigungsgrenze ({isat}): Die Induktivität bricht ein, die Stromspitzen steigen und der Wirkungsgrad fällt.');
  dText('sync', 'info', 'Mit Synchrongleichrichter beträgt η = {sync}, mit Diode wären es {diode}.');
  dText('fehler-reihenfolge', 'info', 'Reihenfolge: Du hast „{ist}“ vor „{soll}“ gemacht. Empfohlen ist {empf}. Das ist nicht verboten, aber „{soll}“ spart Messungen, weil {grund}');
  dText('fehler-falsch', 'error', 'Die Diagnose „{diagnose}“ passt nicht zu den Messwerten: Gefunden werden sollte „{fehler}“. {hinweis}');
  dText('fehler-getauscht', 'error', 'Das Bauteil „{bauteil}“ war nicht defekt und ist getauscht worden: Der Fehler bleibt. Erst messen, dann tauschen.');

  addLimit('pz_max', 0.5, 'W', '<=', 'A', '—', 'F32', 'Zulässige Verlustleistung der Z-Diode (Übungswert, Datenblatt maßgeblich).');

  /* =====================================================================================================
   *  FEHLERSUCHE (fault), SPEC 4.11. Es gibt KEINE Messung am Netz: die Fehlersuche beginnt hinter dem Transformator (Sekundaerseite, Kleinspannung)
   *  bzw. im Gleichspannungskreis. Fehlerbilder nur Simulation, nie als Vorgehen. Alle Zahlen kommen aus dem Kern; wo der Kern keine Zahl liefert,
   *  steht ein Lehrmodellwert (limits mit Frage F40) oder eine qualitative Aussage (Temperaturanzeige "kalt / warm / heiss").
   * ===================================================================================================== */
  const NETZE = {
    linear: { name: 'Linearnetzteil', text: 'Transformator, Brückengleichrichter, Ladekondensator, Festspannungsregler 7805 (Kleinspannung)' },
    zener: { name: 'Z-Dioden-Stufe', text: 'Transformator, Brückengleichrichter, Ladekondensator, Vorwiderstand mit Z-Diode (Kleinspannung)' },
    buck: { name: 'Tiefsetzsteller', text: 'Schaltregler aus einer Gleichspannung: Schalter, Drossel, Freilaufdiode, Ausgangskondensator, Rückkopplungsteiler' },
    boost: { name: 'Hochsetzsteller', text: 'Schaltregler aus einer Gleichspannung: Schalter, Drossel, Diode, Ausgangskondensator, Rückkopplungsteiler' }
  };
  const NETZ_IDS = ['linear', 'zener', 'buck', 'boost'];
  const PT_ORDER = ['u_sek', 'u_c', 'brumm_c', 'u_aus', 'brumm_aus', 'i_aus', 'i_l_spitze', 'u_gate', 'u_sw', 'u_fb', 'u_r2', 'temp_gleich', 'temp_regler'];
  const LIN = ['linear', 'zener'], SWN = ['buck', 'boost'], ALLN = NETZ_IDS;
  /* Messpunkte: eine Tabelle. step = Pruefschritt (path), netz = an welchen Netzteilen es den Punkt gibt */
  const PT = {
    u_sek: { name: 'Sekundärspannung des Transformators (Effektivwert)', unit: 'V', step: 'versorgung', netz: LIN, text: 'Wechselspannung hinter dem Transformator, Kleinspannung (Effektivwert, belastet).' },
    u_c: { name: 'Gleichspannung am Ladekondensator (Eingang der Stufe)', unit: 'V', step: 'zwischenkreis', netz: ALLN, text: 'Mittelwert der Gleichspannung am Ladekondensator; beim Schaltregler die Eingangsgleichspannung hinter der Sicherung.' },
    brumm_c: { name: 'Brummspannung am Ladekondensator (Spitze-Spitze)', unit: 'V', step: 'zwischenkreis', netz: LIN, text: 'Wechselanteil am Ladekondensator, Spitze-Spitze (Lehrnäherung nach ΔU = I/(f_p · C), bei versagender Näherung aus der Zeitschrittrechnung).' },
    u_aus: { name: 'Ausgangsspannung (Gleichspannung)', unit: 'V', step: 'regler', netz: ALLN, text: 'Gleichspannung an der Last.' },
    brumm_aus: { name: 'Brummspannung am Ausgang (Spitze-Spitze)', unit: 'V', step: 'regler', netz: ALLN, text: 'Wechselanteil am Ausgang. Beim Linearregler im Regelbetrieb im Lehrmodell vernachlässigt (0 V), bei der Z-Diode über r_z gerechnet, beim Schaltregler aus dem Kern.' },
    i_aus: { name: 'Ausgangsstrom', unit: 'A', step: 'last', netz: ALLN, text: 'Strom in die Last.' },
    i_l_spitze: { name: 'Spitzenstrom der Drossel', unit: 'A', step: 'regler', netz: SWN, text: 'Höchster Drosselstrom im Betrieb.' },
    u_gate: { name: 'Gate-Spannung (Spitzenwert)', unit: 'V', step: 'regler', netz: SWN, text: 'Spitzenwert der Gate-Ansteuerspannung des Schalters.' },
    u_sw: { name: 'Schaltknoten (Mittelwert)', unit: 'V', step: 'regler', netz: SWN, text: 'Gleichanteil der Spannung am Schaltknoten.' },
    u_fb: { name: 'Spannung am Rückkopplungseingang', unit: 'V', step: 'regler', netz: SWN, text: 'Spannung am Rückkopplungseingang des Reglers; im Regelbetrieb gleich der Referenzspannung.' },
    u_r2: { name: 'Spannung an R2 (zum Ausgang)', unit: 'V', step: 'regler', netz: SWN, text: 'Spannungsabfall am Teilerwiderstand R2 zum Ausgang.' },
    temp_gleich: { name: 'Temperatur Gleichrichter (kalt, warm, heiß)', unit: '', step: 'zwischenkreis', netz: LIN, text: 'Qualitative Anzeige aus der Verlustleistung; keine Temperatur in Grad.', temp: true },
    temp_regler: { name: 'Temperatur Regler oder Schalter (kalt, warm, heiß)', unit: '', step: 'regler', netz: ALLN, text: 'Qualitative Anzeige aus der Verlustleistung; keine Temperatur in Grad.', temp: true }
  };
  const TEMP_TXT = ['kalt', 'warm', 'heiß'];
  function tempClass(P) { return P < LV('temp_warm') - 1e-12 ? 0 : (P < LV('pv_therm') - 1e-12 ? 1 : 2); }

  /* Referenzwerte der vier Netzteile (Uebungswerte, F40) */
  function refPar(netz) {
    if (netz === 'linear') return { U2: LV('ref_u2'), ri: LV('ri_trafo'), C: LV('ref_c'), I: LV('ref_i'), topo: 'bruecke', reg: '7805', r3: LV('r3_ref') };
    if (netz === 'zener') return { U2: 9, ri: LV('ri_trafo'), C: LV('ref_c'), topo: 'bruecke', Uz: 5.1, Rv: 470, Rlast: 4700 };
    if (netz === 'buck') return { Uin: 12, Uout: 5, Iout: 1, f: 100000, L: 100e-6, C: 100e-6, esr: LV('esr'), R1: 1000 };
    return { Uin: 5, Uout: 12, Iout: 0.5, f: 100000, L: 100e-6, C: 100e-6, esr: LV('esr'), R1: 1000 };
  }
  function parOk(netz, par) {
    const pn = function (k) { return pos(par[k]); };
    if (netz === 'linear') return pn('U2') && nn(par.ri) && pn('C') && nn(par.I) && (par.topo === 'bruecke' || par.topo === 'einweg') && (par.reg === '7805' || par.reg === '7812') && pn('r3');
    if (netz === 'zener') return pn('U2') && nn(par.ri) && pn('C') && (par.topo === 'bruecke' || par.topo === 'einweg') && pn('Uz') && pn('Rv') && pn('Rlast');
    return pn('Uin') && pn('Uout') && pn('Iout') && pn('f') && pn('L') && pn('C') && nn(par.esr) && pn('R1') && (netz === 'buck' ? par.Uout < par.Uin : par.Uout > par.Uin);
  }

  /* ---------- Rechenkerne der Netzteile (nur Kernaufrufe) ---------- */
  /* Vorderteil Gleichrichter und Ladekondensator: U2 (belastet), Brumm, Mittelwert, kleinste Spannung. */
  function frontEnd(par, U2leer, topo, Cuf, I, esrX) {
    const uf = LV('uf_si'), f = LV('f_netz');
    const ld = C.trafo.load({ U1: U2leer, n1: 1, n2: 1, ri: par.ri, iLast: I });
    if (!ld || !ld.ok) return { ok: false, why: ld && ld.why };
    const u2k = Math.max(0, ld.U2_klemme);
    if (!(u2k * Math.SQRT2 - (topo === 'einweg' ? 1 : 2) * uf > 0)) return { ok: true, u2k: u2k, uhat: 0, dU: 0, Umean: 0, Umin: 0, iPeak: 0, valid: true, tot: true };
    const cfg = { topo: topo, U2: u2k, uf: uf, f: f, C: Cuf, I: I };
    const rip = C.rect.ripple(cfg);
    if (!rip || !rip.ok) return { ok: false, why: rip && rip.why };
    let dU = rip.dU, Umean = rip.Umittel, Umin = rip.Umin, iPeak = 0;
    const needWave = !rip.valid || esrX > 0;
    if (needWave) {
      const wv = C.rect.wave({ topo: topo, U2: u2k, uf: uf, f: f, C: Cuf, I: I, ri: par.ri, rs: 0 }, 400);
      if (wv && wv.ok) {
        iPeak = wv.iPeak;
        if (!rip.valid) {
          let m = 0; for (let i = 0; i < wv.uc.length; i++) m += wv.uc[i]; m /= Math.max(1, wv.uc.length);
          dU = wv.dU; Umean = m; Umin = wv.Umin;
        }
      }
    }
    return { ok: true, u2k: u2k, uhat: rip.peak, dU: dU, Umean: Umean, Umin: Umin, iPeak: iPeak, valid: rip.valid, tot: false };
  }
  const fz = function (x) { return fin(x) ? x : 0; };

  function evalLinear(par, f) {
    const P = { u_sek: 0, u_c: 0, brumm_c: 0, u_aus: 0, brumm_aus: 0, i_aus: 0, temp_gleich: 0, temp_regler: 0 };
    const uf = LV('uf_si');
    if (f === 'trafo-primaer-offen') return { ok: true, P: P, modell: 'Primärseite offen: Auf der Sekundärseite liegt nichts an.' };
    let U2leer = par.U2, topo = par.topo, Cuf = par.C, I = par.I, esrX = 0;
    if (f === 'gleichrichter-diode-offen') topo = 'einweg';
    if (f === 'c-ausgetrocknet') Cuf = par.C * LV('c_rest') / 100;
    if (f === 'c-esr-hoch') esrX = LV('esr_defekt');
    if (f === 'regler-eingang-niedrig') U2leer = LV('u2_zu_klein');
    const typ = par.reg;
    const Ilim = C.lin.limitT2({ R3: par.r3 }).Ilim;
    let Iwunsch = I;
    if (f === 'regler-ueberlast') Iwunsch = LV('i_ueberlast');
    if (f === 'last-kurz') Iwunsch = Ilim;
    if (f === 'sicherung-offen') { P.u_sek = evalLinear(par, null).P.u_sek; return { ok: true, P: P, modell: 'Sicherung in der Sekundärleitung offen: Die Sekundärspannung ist (im Rahmen der Anzeigegenauigkeit) wie sonst da, dahinter nichts.' }; }
    let Ifront = I, shortMode = false;
    if (f === 'regler-ueberlast' || f === 'last-kurz') Ifront = Math.min(Iwunsch, Ilim);
    if (f === 'gleichrichter-diode-kurz') {
      shortMode = true; topo = 'einweg';
      const Ihat = C.rect.peak({ topo: 'bruecke', U2: U2leer, uf: uf });
      const I2eff = Ihat / par.ri / 2;                               // Halbwellenstrom: Effektivwert = Scheitel / 2
      const ldk = C.trafo.load({ U1: U2leer, n1: 1, n2: 1, ri: par.ri, iLast: I2eff });
      U2leer = Math.max(0, ldk.U2_klemme);
      Ifront = I;
    }
    const fe = frontEnd(par, U2leer, topo, Cuf, Ifront, esrX);
    if (!fe.ok) return { ok: false, why: fe.why };
    P.u_sek = shortMode ? U2leer : fe.u2k;
    P.u_c = fe.Umean; P.brumm_c = fe.dU + esrX * fe.iPeak;
    if (fe.tot) { P.u_c = 0; P.brumm_c = 0; }
    const base = C.lin.fixed({ typ: typ, Uein: Math.max(fe.Umean, 1e-9), I: Ifront });
    let Uaus, Iaus = Ifront, bril = 0, PV;
    const betrieb = !fe.tot && fe.Umin >= base.UeinMin - 1e-12;
    if (f === 'regler-kurzschluss') { Uaus = fe.Umean; bril = fe.dU; PV = 0; }
    else if (f === 'last-kurz') { Uaus = 0; Iaus = Ilim; PV = fe.Umean * Ilim; }
    else if (f === 'regler-ueberlast') { Uaus = base.Uaus * Ilim / Iwunsch; Iaus = Ilim; PV = (fe.Umean - Uaus) * Ilim; }
    else if (betrieb) { Uaus = base.Uaus; bril = 0; PV = (fe.Umean - Uaus) * Ifront; }
    else { Uaus = Math.max(0, fe.Umean - base.dropout); Uaus = Math.min(Uaus, base.Uaus); bril = fe.dU; PV = (fe.Umean - Uaus) * Ifront; }
    P.u_aus = Math.max(0, Uaus); P.brumm_aus = bril; P.i_aus = Iaus;
    const pd = (topo === 'einweg' ? 1 : 2) * uf * Ifront;
    P.temp_gleich = shortMode ? 2 : tempClass(pd);
    P.temp_regler = tempClass(Math.max(0, PV));
    if (fe.tot) { P.u_aus = 0; P.i_aus = 0; P.temp_regler = 0; P.temp_gleich = 0; }
    return { ok: true, P: P, fe: fe, base: base, PV: PV, betrieb: betrieb, modell: 'Lehrmodell: Brumm am Reglerausgang im Regelbetrieb vernachlässigt.' };
  }

  function evalZener(par, f) {
    const P = { u_sek: 0, u_c: 0, brumm_c: 0, u_aus: 0, brumm_aus: 0, i_aus: 0, temp_gleich: 0, temp_regler: 0 };
    const uf = LV('uf_si');
    if (f === 'trafo-primaer-offen') return { ok: true, P: P };
    let U2leer = par.U2, topo = par.topo, Cuf = par.C, esrX = 0;
    if (f === 'gleichrichter-diode-offen') topo = 'einweg';
    if (f === 'c-ausgetrocknet') Cuf = par.C * LV('c_rest') / 100;
    if (f === 'c-esr-hoch') esrX = LV('esr_defekt');
    if (f === 'sicherung-offen') { P.u_sek = evalZener(par, null).P.u_sek; return { ok: true, P: P }; }
    let shortMode = false;
    if (f === 'gleichrichter-diode-kurz') {
      shortMode = true; topo = 'einweg';
      const Ihat = C.rect.peak({ topo: 'bruecke', U2: U2leer, uf: uf });
      const ldk = C.trafo.load({ U1: U2leer, n1: 1, n2: 1, ri: par.ri, iLast: Ihat / par.ri / 2 });
      U2leer = Math.max(0, ldk.U2_klemme);
    }
    /* Strom der Stufe haengt von der Eingangsspannung ab: Festpunktiteration */
    let I = 0.01, fe = null, zs = null;
    const Uz = f === 'z-diode-offen' ? 1e9 : par.Uz;
    for (let k = 0; k < 12; k++) {
      fe = frontEnd(par, U2leer, topo, Cuf, I, esrX);
      if (!fe.ok || fe.tot) break;
      const Ue = fe.Umean;
      let In;
      if (f === 'z-diode-kurz' || f === 'last-kurz') In = Ue / par.Rv;
      else if (f === 'z-diode-offen' || Ue <= Uz) In = Ue / (par.Rv + par.Rlast);
      else In = Math.max(0, (Ue - Uz) / par.Rv);
      if (Math.abs(In - I) < 1e-12) { I = In; break; }
      I = In;
    }
    if (!fe.ok) return { ok: false, why: fe.why };
    P.u_sek = shortMode ? U2leer : fe.u2k;
    P.u_c = fe.tot ? 0 : fe.Umean; P.brumm_c = fe.tot ? 0 : fe.dU + esrX * fe.iPeak;
    if (fe.tot) return { ok: true, P: P };
    const Ue = fe.Umean;
    let Uaus, Iaus, PV, bril;
    if (f === 'z-diode-kurz') { Uaus = 0; Iaus = 0; PV = Ue * Ue / par.Rv; bril = 0; }
    else if (f === 'last-kurz') { Uaus = 0; Iaus = Ue / par.Rv; PV = Ue * Ue / par.Rv; bril = 0; }
    else if (f === 'z-diode-offen') {
      zs = C.zener.stage({ Ue: Ue, Uz: Ue, Rv: par.Rv, Rlast: par.Rlast });
      Uaus = zs.Uaus; Iaus = Uaus / par.Rlast; PV = (Ue - Uaus) * Iaus; bril = fe.dU * par.Rlast / (par.Rv + par.Rlast);
    } else {
      zs = C.zener.stage({ Ue: Ue, Uz: par.Uz, Rv: par.Rv, Rlast: par.Rlast, Pmax: LV('pz_max') });
      Uaus = zs.Uaus; Iaus = zs.Uaus / par.Rlast; PV = zs.Pr + zs.Pz;
      const rg = zs.leitet && zs.aktiv ? C.zener.regulation({ dUe: fe.dU, Rv: par.Rv }) : null;
      bril = rg ? Math.abs(rg.dUa) : (fe.dU * par.Rlast / (par.Rv + par.Rlast));
    }
    P.u_aus = Uaus; P.brumm_aus = bril; P.i_aus = Iaus;
    P.temp_gleich = shortMode ? 2 : tempClass((topo === 'einweg' ? 1 : 2) * uf * I);
    P.temp_regler = tempClass(Math.max(0, PV));
    return { ok: true, P: P, fe: fe, zs: zs, PV: PV };
  }

  function swCfg(par, o) {
    o = o || {};
    const cfg = { Uin: par.Uin, f: par.f, L: o.L !== undefined ? o.L : par.L, C: o.C !== undefined ? o.C : par.C, esr: o.esr !== undefined ? o.esr : par.esr };
    if (o.D !== undefined) { cfg.D = o.D; cfg.Rlast = o.Rlast; }
    else { cfg.Uout = o.Uout !== undefined ? o.Uout : par.Uout; cfg.Iout = o.Iout !== undefined ? o.Iout : par.Iout; cfg.Rlast = o.Rlast !== undefined ? o.Rlast : par.Uout / par.Iout; }
    return cfg;
  }
  /* Messwerte eines Arbeitspunkts (kind buck | boost): o: Uout/Iout/Rlast oder D/Rlast, L, C, esr */
  function swPoint(kind, par, o) {
    const cfg = swCfg(par, o);
    const rep = C[kind].ccm(cfg);
    if (!rep || rep.ok === false) return { ok: false, why: rep && rep.why };
    const wv = C[kind].wave(Object.assign({}, cfg, { periods: 1 }), 2000);
    let usw = NaN;
    if (wv && wv.ok) { const s = wv.series[0].y; let m = 0; for (let i = 0; i < s.length; i++) m += s[i]; usw = m / s.length; }
    const lcfg = { kind: kind, Uin: par.Uin, Uout: rep.Uabs, Iout: rep.Iout, f: par.f, L: cfg.L, rdson: LV('rds_on'), esr: cfg.esr };
    const ls = C.loss.parts(lcfg);
    const Psw = ls && ls.ok !== false ? ls.leitung + ls.schalt + ls.gate : 0;
    return { ok: true, rep: rep, cfg: cfg, usw: usw, Psw: Psw, ls: ls };
  }
  function fbOf(par, Uout, offen) {
    const R2 = C.loop.r2For(par.Uout, par.R1);
    const d = C.loop.divider({ R1: par.R1, R2: R2 });
    const ratio = d.ratio;
    if (offen === 'R1') return { ufb: Uout, ur2: 0 };
    if (offen === 'R2') return { ufb: 0, ur2: Uout };
    if (offen === 'FB') return { ufb: 0, ur2: Uout * ratio / (1 + ratio) };
    return { ufb: Uout / (1 + ratio), ur2: Uout * ratio / (1 + ratio) };
  }
  function evalSwitch(kind, par, f) {
    const P = { u_c: par.Uin, u_aus: 0, brumm_aus: 0, i_aus: 0, i_l_spitze: 0, u_gate: LV('ug'), u_sw: 0, u_fb: 0, u_r2: 0, temp_regler: 0 };
    if (f === 'sicherung-offen') { P.u_c = 0; P.u_gate = 0; return { ok: true, P: P }; }
    const Rl = par.Uout / par.Iout;
    const ilim = LV('ilim_faktor') * par.Iout;
    const uf = LV('uf_schottky');
    function fill(pt, fb) {
      P.u_aus = pt.rep.Uabs; P.brumm_aus = fz(pt.rep.dU); P.i_aus = pt.rep.Iout; P.i_l_spitze = pt.rep.ILmax; P.u_sw = pt.usw;
      P.temp_regler = tempClass(pt.Psw);
      P.u_fb = fb.ufb; P.u_r2 = fb.ur2;
    }
    let pt;
    if (!f) { pt = swPoint(kind, par, {}); if (!pt.ok) return pt; fill(pt, fbOf(par, par.Uout, null)); P.u_fb = LV('uref_317'); return { ok: true, P: P, pt: pt }; }
    if (f === 'c-ausgetrocknet') { pt = swPoint(kind, par, { C: par.C * LV('c_rest') / 100 }); if (!pt.ok) return pt; fill(pt, fbOf(par, par.Uout, null)); P.u_fb = LV('uref_317'); return { ok: true, P: P, pt: pt }; }
    if (f === 'c-esr-hoch') { pt = swPoint(kind, par, { esr: LV('esr_defekt') }); if (!pt.ok) return pt; fill(pt, fbOf(par, par.Uout, null)); P.u_fb = LV('uref_317'); return { ok: true, P: P, pt: pt }; }
    if (f === 'drossel-saettigung') { pt = swPoint(kind, par, { L: par.L * LV('l_sat_rest') / 100 }); if (!pt.ok) return pt; fill(pt, fbOf(par, par.Uout, null)); P.u_fb = LV('uref_317'); return { ok: true, P: P, pt: pt }; }
    if (f === 'r1-offen') {
      const dv = C.loop.divider({ R1: par.R1, R2: C.loop.r2For(par.Uout, par.R1), offen: 'R1' });
      let Uo = dv.Uaus;
      if (kind === 'boost' && Uo <= par.Uin) {              // Hochsetzsteller kann nicht unter Uin: der Schalter bleibt aus, Uin - U_F
        Uo = par.Uin - uf;
        const Il = Uo / Rl;
        P.u_aus = Uo; P.i_aus = Il; P.i_l_spitze = Il; P.u_sw = Uo; P.u_gate = LV('ug'); P.temp_regler = 0;
        const fb = fbOf(par, Uo, 'R1'); P.u_fb = fb.ufb; P.u_r2 = fb.ur2;
        return { ok: true, P: P };
      }
      pt = swPoint(kind, par, { Uout: Uo, Iout: Uo / Rl, Rlast: Rl }); if (!pt.ok) return pt;
      fill(pt, fbOf(par, Uo, 'R1')); return { ok: true, P: P, pt: pt };
    }
    if (f === 'r2-offen' || f === 'rueckkopplung-offen') {
      const Da = LV('d_max') / 100;
      pt = swPoint(kind, par, { D: Da, Rlast: Rl }); if (!pt.ok) return pt;
      fill(pt, fbOf(par, pt.rep.Uabs, f === 'r2-offen' ? 'R2' : 'FB')); return { ok: true, P: P, pt: pt };
    }
    if (f === 'schwingen') {
      pt = swPoint(kind, par, {}); if (!pt.ok) return pt;
      fill(pt, fbOf(par, par.Uout, null)); P.u_fb = LV('uref_317');
      const st = C.loop.step({ C: LV('loop_c'), Raus: LV('loop_raus'), Vr: LV('loop_vr_schwing'), tau: LV('loop_tau'), dI: LV('loop_di'), Uset: par.Uout });
      if (st && st.ok !== false) P.brumm_aus = 2 * st.dUmax;
      return { ok: true, P: P, pt: pt, step: st };
    }
    if (f === 'gate-offen') {
      if (kind === 'buck') { P.u_aus = 0; P.i_aus = 0; P.i_l_spitze = 0; P.u_sw = 0; P.u_gate = 0; P.temp_regler = 0; const fb = fbOf(par, 0, null); P.u_fb = fb.ufb; P.u_r2 = fb.ur2; return { ok: true, P: P }; }
      const Uo = par.Uin - uf, Il = Uo / Rl;
      P.u_aus = Uo; P.i_aus = Il; P.i_l_spitze = Il; P.u_sw = Uo; P.u_gate = 0; P.temp_regler = 0;
      const fb = fbOf(par, Uo, null); P.u_fb = fb.ufb; P.u_r2 = fb.ur2;
      return { ok: true, P: P };
    }
    if (f === 'diode-offen-schalt') {
      P.u_aus = 0; P.i_aus = 0; P.i_l_spitze = ilim; P.u_sw = par.Uin; P.temp_regler = 2;
      const fb = fbOf(par, 0, null); P.u_fb = fb.ufb; P.u_r2 = fb.ur2;
      return { ok: true, P: P };
    }
    if (f === 'last-kurz') {
      P.u_aus = 0; P.i_aus = ilim; P.i_l_spitze = ilim; P.u_sw = 0; P.temp_regler = 1;
      const fb = fbOf(par, 0, null); P.u_fb = fb.ufb; P.u_r2 = fb.ur2;
      return { ok: true, P: P };
    }
    return { ok: false, why: 'Dieser Fehler gibt es an diesem Netzteil nicht.' };
  }
  function evalNet(st) {
    const f = st.fehler || null, netz = st.netz;
    if (netz === 'linear') return evalLinear(st.par, f);
    if (netz === 'zener') return evalZener(st.par, f);
    return evalSwitch(netz, st.par, f);
  }

  /* ---------- Katalog ---------- */
  /* [id, Name, Symptom, Stufe, Netze, Symptom-Ids, Bauteil (je Netz), Ursache, Behebung, Sicht] */
  const FT = [
    ['sicherung-offen', 'Sicherung offen', 'Kein Ausgang, kein Strom.', 'trafo', ALLN, ['kein-ausgang'], { _: 'sicherung' },
      'Die Sicherung hinter dem Transformator (Kleinspannung) hat ausgelöst oder ist durchgealtert: Der Strompfad ist unterbrochen, die Sekundärspannung liegt noch an.',
      'Erst die Ursache des Auslösens suchen (Überlast, Kurzschluss), dann die Sicherung durch eine gleichwertige ersetzen. Niemals überbrücken oder überdimensionieren.',
      'Die Sicherung ist durchgebrannt: Der Schmelzdraht ist unterbrochen oder das Glas ist beschlagen.'],
    ['trafo-primaer-offen', 'Transformator primär unterbrochen', 'Kein Ausgang, auch sekundärseitig keine Spannung.', 'trafo', LIN, ['kein-ausgang'], { _: 'trafo' },
      'Die Primärwicklung ist unterbrochen (zum Beispiel durch Überhitzung): Sekundär wird nichts induziert.',
      'Das Gerät freischalten lassen; den Transformator ersetzen. Messungen an der Netzseite gehören nicht in dieses Lab.',
      'Der Transformator riecht verbrannt, die Isolation ist verfärbt.'],
    ['gleichrichter-diode-offen', 'Brückengleichrichter: eine Diode offen', 'Es brummt: Die Brummfrequenz ist 50 Hz statt 100 Hz.', 'gleich', LIN, ['brummt'], { _: 'gleichrichter' },
      'Eine Diode der Brücke leitet nicht mehr: Aus der Brücke wird ein Einweggleichrichter, der Ladekondensator wird nur noch in einer Halbwelle geladen. Û halbiert sich nicht, aber ΔU verdoppelt sich.',
      'Den Brückengleichrichter ersetzen (alle vier Dioden prüfen).',
      'Ohne Auffälligkeit: Die Diode sieht von außen intakt aus.'],
    ['gleichrichter-diode-kurz', 'Brückengleichrichter: eine Diode kurzgeschlossen', 'Die Sicherung löst aus, Transformator und Gleichrichter werden heiß.', 'gleich', LIN, ['kein-ausgang', 'wird-heiss'], { _: 'gleichrichter' },
      'Eine Diode schließt in Sperrrichtung kurz: In einer Halbwelle ist die Sekundärwicklung nur über ihren Innenwiderstand belastet, Trafo und Sicherung werden überlastet (Zustand kurz nach dem Einschalten, bevor die Sicherung auslöst).',
      'Das Gerät sofort ausschalten und freischalten lassen, Brückengleichrichter ersetzen, danach die Sicherung prüfen.',
      'Der Gleichrichter ist verfärbt oder hat ein Loch im Gehäuse.'],
    ['c-ausgetrocknet', 'Ladekondensator ausgetrocknet', 'Es brummt stark, die Spannung bricht unter Last ein.', 'sieb', ALLN, ['brummt'], { linear: 'ladeelko', zener: 'ladeelko', buck: 'ausgangselko', boost: 'ausgangselko' },
      'Die Kapazität ist auf einen Bruchteil gesunken: Die Brummspannung steigt im selben Verhältnis (ΔU ist proportional zu 1/C).',
      'Den Elko durch einen gleichwertigen ersetzen (Kapazität, Spannung, Temperaturklasse).',
      'Der Elko ist aufgewölbt, am Boden ist Elektrolyt ausgetreten.'],
    ['c-esr-hoch', 'Elko mit hohem ESR', 'Spannungsspitzen auf der Gleichspannung, auch bei guter Kapazität.', 'sieb', ALLN, ['brummt'], { linear: 'ladeelko', zener: 'ladeelko', buck: 'ausgangselko', boost: 'ausgangselko' },
      'Der Ersatzserienwiderstand ist stark gestiegen: Der Ladestrom erzeugt am ESR Spannungsspitzen, die zur Brummspannung addiert werden.',
      'Den Elko ersetzen; einen Typ mit kleinem ESR (für Schaltregler "Low-ESR") wählen.',
      'Keine äußere Auffälligkeit.'],
    ['z-diode-kurz', 'Z-Diode kurzgeschlossen', 'Der Ausgang liegt bei 0 V.', 'regel', ['zener'], ['kein-ausgang'], { _: 'zdiode' },
      'Die Z-Diode hat einen Kurzschluss: Der Ausgang ist kurzgeschlossen, der Vorwiderstand begrenzt den Strom und wird warm.',
      'Die Z-Diode ersetzen, den Vorwiderstand prüfen (Überlast).',
      'Der Vorwiderstand ist verfärbt, die Z-Diode sieht intakt aus.'],
    ['z-diode-offen', 'Z-Diode unterbrochen', 'Die Ausgangsspannung ist viel zu hoch, nahe der Eingangsspannung.', 'regel', ['zener'], ['zu-hoch'], { _: 'zdiode' },
      'Die Z-Diode leitet nicht mehr: Es bleibt ein Spannungsteiler aus Vorwiderstand und Last, die Ausgangsspannung ist U_ein · R_last/(R_V + R_last).',
      'Die Z-Diode ersetzen.',
      'Keine äußere Auffälligkeit.'],
    ['regler-eingang-niedrig', 'Regler-Eingang zu niedrig (Dropout)', 'Die Ausgangsspannung ist zu niedrig und folgt dem Eingang.', 'trafo', ['linear'], ['zu-niedrig'], { _: 'trafo' },
      'Die Spannung am Reglereingang liegt unter Ausgangsspannung plus Dropout (zum Beispiel wegen eines falschen oder zu schwachen Transformators): Der Regler regelt nicht mehr, der Ausgang folgt dem Eingang minus Dropout.',
      'Einen Transformator mit passender Sekundärspannung einsetzen (Auslegen: U_min über Ausgang plus Dropout).',
      'Das Typenschild des Transformators nennt eine zu kleine Sekundärspannung.'],
    ['regler-kurzschluss', 'Regler durchlegiert (Durchgangstransistor kurz)', 'Die Ausgangsspannung ist so hoch wie der Eingang, ungeregelt.', 'regel', ['linear'], ['zu-hoch'], { _: 'regler' },
      'Der Längstransistor im Regler hat Durchgang: Ausgang = Eingang. Alle Verbraucher sehen die ungeregelte Spannung samt Brumm.',
      'Den Regler ersetzen; vorher die angeschlossene Last auf Überspannungsschäden prüfen.',
      'Der Regler ist unauffällig, die Last zeigt Überspannungsschäden.'],
    ['regler-ueberlast', 'Regler überlastet', 'Die Ausgangsspannung bricht ein, der Regler wird heiß.', 'regel', ['linear'], ['zu-niedrig', 'wird-heiss'], { _: 'last' },
      'Die Last zieht mehr Strom als die Strombegrenzung zulässt: Der Regler begrenzt auf I_lim = U_BE/R3, die Ausgangsspannung sinkt, die Verlustleistung steigt.',
      'Die Last prüfen und verkleinern oder einen Regler mit größerem Strom wählen; die Wärme rechnest du im Thermik-Lab.',
      'Der Regler ist stark erwärmt, die Umgebung ist verfärbt.'],
    ['r1-offen', 'Teilerwiderstand R1 offen (nach Masse)', 'Die Ausgangsspannung ist viel zu niedrig, sie liegt bei der Referenzspannung.', 'regel', SWN, ['zu-niedrig'], { _: 'r1' },
      'R1 liegt im Teiler nach Masse (wie im Pool): Ist er offen, sieht die Rückkopplung die volle Ausgangsspannung und regelt auf die Referenzspannung U_ref. Der Ausgang ist zu niedrig.',
      'R1 ersetzen (Teilerformel U_aus = U_ref · (1 + R2/R1) prüfen).',
      'R1 ist unterbrochen oder hat eine kalte Lötstelle.'],
    ['r2-offen', 'Teilerwiderstand R2 offen (zum Ausgang)', 'Die Ausgangsspannung steigt bis zum Anschlag.', 'regel', SWN, ['zu-hoch'], { _: 'r2' },
      'R2 liegt im Teiler zum Ausgang: Ist er offen, sieht die Rückkopplung 0 V und der Regler dreht auf. Der Ausgang steigt bis zum Anschlag der Regelung.',
      'R2 ersetzen und die angeschlossene Last auf Überspannungsschäden prüfen.',
      'R2 ist unterbrochen oder hat eine kalte Lötstelle.'],
    ['drossel-saettigung', 'Drossel in Sättigung', 'Stromspitzen, der Wirkungsgrad fällt, die Anlage wird warm.', 'schalt', SWN, ['wird-heiss'], { _: 'drossel' },
      'Der Drosselkern sättigt: Die Induktivität bricht ein, die Stromwelligkeit und die Spitzenströme steigen.',
      'Eine Drossel mit größerem Sättigungsstrom einsetzen (Auslegen).',
      'Die Drossel riecht verbrannt oder ist verfärbt.'],
    ['diode-offen-schalt', 'Freilaufdiode (Diode) unterbrochen', 'Ausgang 0 V, der Schalttransistor wird heiß.', 'schalt', SWN, ['kein-ausgang', 'wird-heiss'], { _: 'freilaufdiode' },
      'Die Diode leitet nicht: Der Drosselstrom hat keinen Weg, die Schaltspannungsspitzen belasten den Schalter, am Ausgang kommt nichts an.',
      'Die Diode ersetzen und den Schalter prüfen.',
      'Der Schalter ist stark erwärmt.'],
    ['gate-offen', 'Gate-Ansteuerung fehlt', 'Ausgang 0 V (Tiefsetzsteller) oder etwa die Eingangsspannung (Hochsetzsteller).', 'schalt', SWN, ['kein-ausgang'], { _: 'treiber' },
      'Das Gate bekommt keine Ansteuerung (Treiber oder Zuleitung unterbrochen): Der Schalter bleibt aus, der Wandler schaltet nicht.',
      'Treiber und Gate-Zuleitung prüfen und ersetzen.',
      'Die Gate-Leitung ist abgerissen oder der Treiber ist verfärbt.'],
    ['rueckkopplung-offen', 'Rückkopplungsleitung unterbrochen', 'Die Ausgangsspannung steigt bis zum Anschlag.', 'regel', SWN, ['zu-hoch'], { _: 'fb_leitung' },
      'Die Verbindung zwischen Teiler und Rückkopplungseingang ist offen: Der Regler sieht 0 V und dreht auf.',
      'Die Rückkopplungsleitung (Leiterbahn, Lötstelle) wiederherstellen und die Last auf Überspannungsschäden prüfen.',
      'Die Leiterbahn zum Rückkopplungseingang ist unterbrochen.'],
    ['schwingen', 'Schwingen am Ausgang', 'Der Ausgang schwingt, starke Welligkeit.', 'regel', SWN, ['schwingt'], { _: 'ausgangselko' },
      'Der Ausgangskondensator fehlt oder hat einen falschen ESR: Die Phasenreserve des Regelkreises reicht nicht, der Ausgang schwingt nach (Lehrmodell, nur Ampelaussage).',
      'Ausgangskondensator mit passender Kapazität und passendem ESR einsetzen (Datenblatt maßgeblich).',
      'Der Ausgangskondensator fehlt oder ist unterbrochen.'],
    ['last-kurz', 'Kurzschluss in der Last', 'Der Ausgang bricht auf 0 V ein, es fließt nur der Begrenzungsstrom.', 'last', ALLN, ['kein-ausgang'], { _: 'last' },
      'Die Last hat einen Kurzschluss: Die Strombegrenzung greift (Konstantstrom beziehungsweise Aussetzbetrieb), die Ausgangsspannung ist 0 V.',
      'Die Last abklemmen und prüfen; die Strombegrenzung zeigt dabei nur ihre Wirkung, sie ist kein Freibrief.',
      'Die Last riecht verbrannt oder ist verfärbt.']
  ];
  const FTMAP = {};
  FT.forEach(function (r) { FTMAP[r[0]] = r; });
  function bauteilOf(id, netz) { const r = FTMAP[id]; if (!r) return ''; const b = r[6]; return has(b, netz) ? b[netz] : b._; }
  const PART_NAMES = { sicherung: 'Sicherung', trafo: 'Transformator', gleichrichter: 'Brückengleichrichter', ladeelko: 'Ladekondensator', ausgangselko: 'Ausgangskondensator', zdiode: 'Z-Diode', regler: 'Festspannungsregler',
    last: 'Last', r1: 'Teilerwiderstand R1', r2: 'Teilerwiderstand R2', fb_leitung: 'Rückkopplungsleitung', drossel: 'Drossel', freilaufdiode: 'Diode (Freilauf)', treiber: 'Gate-Treiber', vorwiderstand: 'Vorwiderstand' };
  const PARTS = { linear: ['sicherung', 'trafo', 'gleichrichter', 'ladeelko', 'regler', 'last'], zener: ['sicherung', 'trafo', 'gleichrichter', 'ladeelko', 'zdiode', 'vorwiderstand', 'last'],
    buck: ['sicherung', 'treiber', 'freilaufdiode', 'drossel', 'ausgangselko', 'r1', 'r2', 'fb_leitung', 'last'], boost: ['sicherung', 'treiber', 'freilaufdiode', 'drossel', 'ausgangselko', 'r1', 'r2', 'fb_leitung', 'last'] };

  function newState(netz, fehler, par, seed) {
    const p = Object.assign({}, refPar(netz), isObj(par) ? par : {});
    return { ok: true, id: fehler || 'ok', name: fehler ? FTMAP[fehler][1] : 'fehlerfrei', netz: netz, fehler: fehler || null, par: p, seed: seed, getauscht: [], falsch: [] };
  }
  function normState(st) {
    if (!isObj(st)) return null;
    if (isObj(st.state) && st.state.netz) st = st.state;
    if (!has(NETZE, st.netz) || !isObj(st.par)) return null;
    if (st.fehler !== null && st.fehler !== undefined && !has(FTMAP, st.fehler)) return null;
    return st;
  }
  const fault = C.fault = C.fault || {};
  fault.netze = NETZ_IDS.slice();
  fault.netzInfo = clone(NETZE);
  fault.parts = A_(function (netz) { return has(PARTS, netz) ? PARTS[netz].map(function (id) { return { id: id, name: PART_NAMES[id] }; }) : []; });
  /* Funktionsbloecke eines klassischen Linearnetzteils in der Reihenfolge des Pools (H2023-N03) */
  fault.chain = [{ id: 'trafo', name: 'Transformator' }, { id: 'gleich', name: 'Gleichrichtung' }, { id: 'sieb', name: 'Glättung' }, { id: 'regel', name: 'Stabilisierung' }];
  fault.reference = S_(function (netz, par) {
    const n = netz === undefined ? 'linear' : netz;
    if (!has(NETZE, n)) return fail('Das Netzteil „' + String(netz) + '“ gibt es nicht (linear, zener, buck, boost).');
    if (par !== undefined && !isObj(par)) return fail('Die Parameter müssen ein Objekt sein.');
    const s = newState(n, null, par, 1);
    if (!parOk(n, s.par)) return fail('Die Parameter sind für dieses Netzteil nicht zulässig.');
    return s;
  });
  /* make(id, opts): id = Fehler-Id | 'zufall' | 'ok' ; opts = { netz, seed, par } */
  fault.make = S_(function (id, opts) {
    const o = opts === undefined ? {} : opts;
    if (!isObj(o)) return fail('Die Optionen müssen ein Objekt sein.');
    const seed = num(o.seed, 1);
    let fid = id;
    if (id === 'ok' || id === null || id === undefined || id === '') fid = null;
    else if (id === 'zufall') {
      const nz = o.netz !== undefined ? o.netz : 'linear';
      if (!has(NETZE, nz)) return fail('Das Netzteil „' + String(o.netz) + '“ gibt es nicht (linear, zener, buck, boost).');
      const ok = FT.filter(function (r) { return r[4].indexOf(nz) >= 0; });
      fid = C.rng(seed).pick(ok)[0];
    } else if (!isStr(id) || !has(FTMAP, id)) return fail('Den Fehler „' + String(id) + '“ gibt es nicht.');
    const netz = o.netz !== undefined ? o.netz : (fid ? FTMAP[fid][4][0] : 'linear');
    if (!has(NETZE, netz)) return fail('Das Netzteil „' + String(netz) + '“ gibt es nicht (linear, zener, buck, boost).');
    if (fid && FTMAP[fid][4].indexOf(netz) < 0) return fail('Der Fehler „' + fid + '“ kommt am Netzteil „' + netz + '“ nicht vor.');
    if (o.par !== undefined && !isObj(o.par)) return fail('Die Parameter müssen ein Objekt sein.');
    const s = newState(netz, fid, o.par, seed);
    if (!parOk(netz, s.par)) return fail('Die Parameter sind für dieses Netzteil nicht zulässig.');
    return s;
  });
  /* Eine Anzeige gilt als geaendert, wenn sie um mehr als 0,5 % abweicht (Lehrregel Anzeigegenauigkeit; Temperaturstufen exakt) */
  const ABW_REL = 0.005;
  function differs(a, b) { return Math.abs(a - b) > ABW_REL * Math.max(Math.abs(a), Math.abs(b)) + 1e-9; }
  fault.probe = S_(function (state, point) {
    const st = normState(state);
    if (!st) return fail('Der Zustand des Netzteils ist ungültig (mit fault.make erzeugen).');
    if (!isStr(point) || !has(PT, point)) return fail('Den Messpunkt „' + String(point) + '“ gibt es nicht.');
    const pt = PT[point];
    if (pt.netz.indexOf(st.netz) < 0) return fail('Diesen Messpunkt gibt es an diesem Netzteil nicht.');
    const cur = evalNet(st);
    if (!cur.ok) return fail(cur.why || 'Das Netzteil ist mit diesen Werten nicht rechenbar.');
    const ref = evalNet(Object.assign({}, st, { fehler: null }));
    const v = cur.P[point], s0 = ref.ok ? ref.P[point] : NaN;
    const text = function (x) { return pt.temp ? TEMP_TXT[x] : fmtEng(x, pt.unit); };
    return { ok: true, point: point, name: pt.name, unit: pt.unit, value: v, text: text(v), soll: s0, sollText: ref.ok ? text(s0) : '–', abweichung: ref.ok ? differs(v, s0) : false, temp: !!pt.temp };
  });
  fault.probe.points = PT_ORDER.slice();
  fault.probe.info = (function () { const o = {}; PT_ORDER.forEach(function (id) { o[id] = { id: id, name: PT[id].name, unit: PT[id].unit, step: PT[id].step, netz: PT[id].netz.slice(), text: PT[id].text, temp: !!PT[id].temp }; }); return o; })();
  /* Sichtpruefung (am freigeschalteten Geraet) */
  fault.sicht = S_(function (state) {
    const st = normState(state);
    if (!st) return fail('Der Zustand des Netzteils ist ungültig (mit fault.make erzeugen).');
    if (!st.fehler) return { ok: true, text: 'Sichtprüfung: Nichts Auffälliges (keine Verfärbung, kein Geruch, keine aufgewölbten Elkos).', hinweis: false };
    return { ok: true, text: 'Sichtprüfung: ' + FTMAP[st.fehler][9], hinweis: true };
  });
  /* Bauteil tauschen: nur das defekte Bauteil behebt den Fehler */
  fault.repair = S_(function (state, bauteil) {
    const st = normState(state);
    if (!st) return fail('Der Zustand des Netzteils ist ungültig (mit fault.make erzeugen).');
    if (!isStr(bauteil) || !has(PART_NAMES, bauteil) || PARTS[st.netz].indexOf(bauteil) < 0) return fail('Das Bauteil „' + String(bauteil) + '“ gibt es an diesem Netzteil nicht.');
    const ns = clone(st);
    ns.getauscht = (st.getauscht || []).concat([bauteil]);
    if (st.fehler && bauteilOf(st.fehler, st.netz) === bauteil) {
      ns.fehler = null; ns.id = 'ok'; ns.name = 'fehlerfrei';
      return { ok: true, state: ns, behoben: true, falsch: false, text: 'Das Bauteil „' + PART_NAMES[bauteil] + '“ war defekt und ist getauscht: Der Fehler ist behoben.' };
    }
    ns.falsch = (st.falsch || []).concat([bauteil]);
    return { ok: true, state: ns, behoben: false, falsch: true, text: TEXTS.get('fehler-getauscht', { bauteil: PART_NAMES[bauteil] }).text };
  });
  /* Pruefreihenfolge */
  const STEPS = ['sicht', 'versorgung', 'zwischenkreis', 'regler', 'last'];
  const STEP_NAMES = { sicht: 'Sichtprüfung', versorgung: 'Versorgung prüfen', zwischenkreis: 'Zwischenkreis messen', regler: 'Regler prüfen', last: 'Last prüfen' };
  const STEP_WHY = { sicht: 'sie nichts kostet und oft schon das Bauteil zeigt', versorgung: 'ohne Versorgung alles dahinter nicht beurteilbar ist', zwischenkreis: 'die Gleichspannung am Ladekondensator das Vorderteil vom Regler trennt',
    regler: 'ein Fehler im Regler erst bei stimmendem Eingang beurteilbar ist', last: 'die Last den Fehler auslösen kann und deshalb erst zuletzt ausgeschlossen wird' };
  const SYMPT = { 'kein-ausgang': 'Kein Ausgang', 'brummt': 'Es brummt', 'zu-niedrig': 'Ausgangsspannung zu niedrig', 'zu-hoch': 'Ausgangsspannung zu hoch', 'wird-heiss': 'Das Gerät wird heiß', 'schwingt': 'Der Ausgang schwingt' };
  const STEP_TXT = {
    sicht: 'Sieh dir das freigeschaltete Gerät an: verfärbte Bauteile, aufgewölbte Elkos, Brandgeruch, abgerissene Leitungen.',
    versorgung: 'Miss die Sekundärspannung hinter dem Transformator (Kleinspannung). Nur im Linearnetzteil: Ist sie da, ist der Fehler dahinter; fehlt sie, davor.',
    zwischenkreis: 'Miss die Gleichspannung und die Brummspannung am Ladekondensator: Sie zeigt, ob Gleichrichter und Ladekondensator in Ordnung sind.',
    regler: 'Miss die Ausgangsspannung und beim Schaltregler Rückkopplung, Gate und Schaltknoten: Sie zeigt, ob der Regler aus dem Eingang das Richtige macht.',
    last: 'Prüfe zuletzt den Ausgangsstrom und die Last: Nimmt sie zu viel Strom auf, ist die Last die Ursache.'
  };
  const SPEC_TXT = {
    'kein-ausgang': { sicht: 'Suche zuerst eine durchgebrannte Sicherung oder verbrannte Bauteile.', versorgung: 'Ist die Sekundärspannung da? Fehlt sie, liegt der Fehler vor dem Gleichrichter (Transformator, Sicherung).' },
    'brummt': { zwischenkreis: 'Der Brumm entsteht am Ladekondensator: Miss die Brummspannung (Brücke oder Einweg, Kapazität, ESR).' },
    'zu-niedrig': { zwischenkreis: 'Ist die Spannung am Ladekondensator hoch genug (über Ausgang plus Dropout)? Wenn nicht, liegt der Fehler davor.' },
    'zu-hoch': { regler: 'Der Ausgang ist zu hoch: Prüfe, ob der Regler noch regelt (Teiler, Rückkopplung, Z-Diode, Durchgang).' },
    'wird-heiss': { last: 'Prüfe, ob die Last zu viel Strom zieht; Verlustleistung rechnest du im Thermik-Lab.' },
    'schwingt': { regler: 'Schwingen kommt aus dem Regelkreis: Prüfe den Ausgangskondensator (Kapazität, ESR).' }
  };
  fault.path = S_(function (symptom) {
    if (!isStr(symptom) || !has(SYMPT, symptom)) return fail('Das Symptom „' + String(symptom) + '“ gibt es nicht (' + Object.keys(SYMPT).join(', ') + ').');
    const sp = SPEC_TXT[symptom];
    const steps = STEPS.map(function (id) {
      const pts = PT_ORDER.filter(function (p) { return PT[p].step === id; });
      return { id: id, name: STEP_NAMES[id], text: STEP_TXT[id] + (sp && sp[id] ? ' ' + sp[id] : ''), punkte: pts, warum: STEP_WHY[id] };
    });
    return { ok: true, symptom: symptom, name: SYMPT[symptom], reihenfolge: STEPS.slice(), steps: steps, hinweis: 'Das ist eine empfohlene Reihenfolge: Eine andere wird erklärt, nicht verboten. Die Fehlersuche beginnt hinter dem Transformator, nie am Netz.' };
  });
  fault.symptoms = Object.keys(SYMPT).map(function (id) { return { id: id, name: SYMPT[id] }; });
  /* Aktionen der Fehlersuche -> Pruefschritt */
  function stepOfAction(a) {
    if (!isStr(a)) return null;
    if (a === 'sicht') return 'sicht';
    const m = /^messe:(.+)$/.exec(a);
    if (m && has(PT, m[1])) return PT[m[1]].step;
    if (/^tausche:/.test(a)) return 'tausch';
    return STEPS.indexOf(a) >= 0 ? a : null;
  }
  fault.stepOf = function (a) { try { return stepOfAction(a); } catch (e) { return null; } };
  /* order(actions, symptom?): erklaert die erste Abweichung von der empfohlenen Reihenfolge, verbietet nichts */
  fault.order = S_(function (actions, symptom) {
    if (!isArr(actions)) return fail('Die Aktionen müssen eine Liste sein.');
    const seen = [], out = { ok: true, abweichung: null, schritte: [], tauschOhneMessung: false, text: 'Die Reihenfolge entspricht der Empfehlung.' };
    let measured = false;
    for (let i = 0; i < actions.length; i++) {
      const s = stepOfAction(actions[i]);
      if (s === null) continue;
      if (s === 'tausch') { if (!measured) out.tauschOhneMessung = true; continue; }
      if (s !== 'sicht') measured = true;
      if (seen.indexOf(s) < 0) {
        const idx = STEPS.indexOf(s);
        for (let k = 0; k < idx && !out.abweichung; k++) {
          if (seen.indexOf(STEPS[k]) < 0) out.abweichung = { ist: s, soll: STEPS[k], grund: STEP_WHY[STEPS[k]] };
        }
        seen.push(s);
      }
    }
    out.schritte = seen;
    if (out.abweichung) {
      const a = out.abweichung;
      out.text = TEXTS.get('fehler-reihenfolge', { ist: STEP_NAMES[a.ist], soll: STEP_NAMES[a.soll], empf: STEPS.map(function (x) { return STEP_NAMES[x]; }).join(', '), grund: a.grund + '.' }).text;
    }
    if (symptom !== undefined && !(isStr(symptom) && has(SYMPT, symptom))) out.hinweisSymptom = 'Das Symptom ist unbekannt; es gilt die allgemeine Reihenfolge.';
    return out;
  });

  /* Katalog zusammenbauen: messpunkte = genau die Punkte, die sich gegenueber dem fehlerfreien Netzteil aendern (Kern-Rechnung des Standard-Netzteils) */
  function buildCatalog() {
    return FT.map(function (r) {
      const netz = r[4][0], st = newState(netz, r[0], null, 1);
      const cur = evalNet(st), ref = evalNet(Object.assign({}, st, { fehler: null }));
      const list = [];
      if (cur.ok && ref.ok) {
        PT_ORDER.forEach(function (p) {
          if (PT[p].netz.indexOf(netz) < 0) return;
          if (!differs(cur.P[p], ref.P[p])) return;
          const t = function (x) { return PT[p].temp ? TEMP_TXT[x] : fmtEng(x, PT[p].unit); };
          list.push({ point: p, name: PT[p].name, unit: PT[p].unit, soll: ref.P[p], ist: cur.P[p], sollText: t(ref.P[p]), istText: t(cur.P[p]) });
        });
      }
      return { id: r[0], name: r[1], symptom: r[2], stufe: r[3], netz: r[4].slice(), netzStandard: netz, symptome: r[5].slice(), bauteil: bauteilOf(r[0], netz), messpunkte: list, ursache: r[7], behebung: r[8], sicht: r[9] };
    });
  }
  fault.catalog = buildCatalog();
  hide(fault, 'build', buildCatalog);

  /* =====================================================================================================
   *  AUSLEGEN (design), Tab Auslegen. Rechnet nur mit Kernfunktionen; Rundungsregeln sind Uebungsregeln (F42):
   *  U2 auf volle Volt aufrunden, Ladekondensator und Drossel auf die Reihe E6 aufrunden.
   * ===================================================================================================== */
  addLimit('du_aus_ziel', 1, '%', '<=', 'A', '—', 'F42', 'Zielwelligkeit am Ausgang des Schaltreglers beim Auslegen, Anteil der Ausgangsspannung (Übungsregel).');
  const E6 = [1.0, 1.5, 2.2, 3.3, 4.7, 6.8];
  function e6up(x) {
    if (!(x > 0) || !isFinite(x)) return NaN;
    let dec = Math.floor(Math.log10(x));
    for (let k = 0; k < 3; k++) {
      const m = x / Math.pow(10, dec);
      for (let i = 0; i < E6.length; i++) if (E6[i] >= m * (1 - 1e-9)) return E6[i] * Math.pow(10, dec);
      dec += 1;
    }
    return NaN;
  }
  const design = C.design = C.design || {};
  design.e6up = G_(e6up);
  design.linear = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uaus)) return fail('Die Ausgangsspannung muss größer als 0 sein.');
    if (!pos(cfg.I)) return fail('Der Laststrom muss größer als 0 sein.');
    const topo = cfg.topo === undefined ? 'bruecke' : cfg.topo;
    if (topo !== 'einweg' && topo !== 'bruecke') return fail('Die Schaltung muss "einweg" oder "bruecke" sein.');
    if (cfg.Uaus > LV('u_dc_max')) return fail('Die Ausgangsspannung liegt über der Grenze des Modells (' + fmtEng(LV('u_dc_max'), 'V') + ').');
    let typ = cfg.typ;
    if (typ === undefined) typ = cfg.Uaus === 5 ? '7805' : (cfg.Uaus === 12 ? '7812' : 'lm317');
    if (typ !== '7805' && typ !== '7812' && typ !== 'lm317') return fail('Der Regler ist 7805, 7812 oder lm317.');
    if ((typ === '7805' && cfg.Uaus !== 5) || (typ === '7812' && cfg.Uaus !== 12)) return fail('Der ' + typ + ' liefert nur ' + (typ === '7805' ? '5 V' : '12 V') + '; für andere Spannungen braucht es den LM317.');
    const dr = C.lin.dropout({ typ: typ, Uaus: cfg.Uaus });
    if (!dr || !dr.ok) return fail(dr && dr.why || 'Der Dropout ist nicht rechenbar.');
    const uf = LV('uf_si'), nD = topo === 'einweg' ? 1 : 2;
    const dUproz = LV('ripple_ok');
    let dUziel = cfg.dUziel;
    if (dUziel !== undefined && !pos(dUziel)) return fail('Die Zielbrummspannung muss größer als 0 sein.');
    const UhatNeed = dUziel !== undefined ? dr.UeinMin + dUziel : dr.UeinMin / (1 - dUproz / 100);
    if (dUziel === undefined) dUziel = dUproz / 100 * UhatNeed;
    const U2 = (UhatNeed + nD * uf) / Math.SQRT2;
    const U2r = Math.ceil(U2 - 1e-9);
    if (U2r > LV('u_ac_max')) return fail('Die nötige Sekundärspannung (' + fmtEng(U2r, 'V') + ') liegt über der Grenze des Modells (' + fmtEng(LV('u_ac_max'), 'V') + ').');
    const Uhat = C.rect.peak({ topo: topo, U2: U2r, uf: uf });
    const Cmin = C.rect.cmin({ topo: topo, I: cfg.I, dU: dUziel });
    const Cn = e6up(Cmin);
    const rip = C.rect.ripple({ topo: topo, U2: U2r, uf: uf, C: Cn, I: cfg.I });
    if (!rip || !rip.ok) return fail(rip && rip.why || 'Die Brummspannung ist nicht rechenbar.');
    const Umittel = rip.valid ? rip.Umittel : Uhat - rip.dU / 2, Umin = rip.valid ? rip.Umin : Uhat - rip.dU;
    const PV = C.lin.loss(Umittel, cfg.Uaus, cfg.I), eta = C.lin.eta(Umittel, cfg.Uaus, cfg.I);
    const out = { ok: true, typ: typ, topo: topo, Uaus: cfg.Uaus, I: cfg.I, dropout: dr.dropout, UeinMin: dr.UeinMin, dUziel: dUziel, Uhat: UhatNeed, U2: U2, U2gerundet: U2r, UhatReal: Uhat,
      Cmin: Cmin, C: Cn, dU: rip.dU, naeherungOk: rip.valid, Umittel: Umittel, Umin: Umin, reserve: Umin - dr.UeinMin, PV: PV, eta: eta, therm: PV >= LV('pv_therm'), fp: rip.fp, status: 'Übungsregeln (F42)', text: [], diag: [] };
    if (typ === 'lm317') {
      const R1 = cfg.R1 === undefined ? 240 : cfg.R1;
      if (!pos(R1)) return fail('R1 muss größer als 0 sein.');
      out.R1 = R1; out.R2 = C.lin.r2For(cfg.Uaus, R1);
    }
    out.ampel = Umin < dr.UeinMin - EPS ? 'rot' : (out.therm || !rip.valid ? 'gelb' : 'gruen');
    const t = out.text;
    t.push('1. Regler: ' + typ + ' mit Dropout ' + fmtEng(dr.dropout, 'V') + ' (Übungswert): Der Eingang muss mindestens ' + fmtEng(dr.UeinMin, 'V') + ' haben.');
    t.push('2. Û = U_ein,min / (1 − ' + fmt(dUproz, 0) + ' %) = ' + fmtEng(UhatNeed, 'V') + ' (Brumm höchstens ' + fmt(dUproz, 0) + ' % von Û, Lehrfaustwert).');
    t.push('3. U2 = (Û + ' + nD + ' · ' + fmtEng(uf, 'V') + ') / √2 = ' + fmtEng(U2, 'V') + ', aufgerundet auf ' + fmtEng(U2r, 'V') + '.');
    t.push('4. C ≥ I / (f_p · ΔU) = ' + fmtEng(cfg.I, 'A') + ' / (' + fmtEng(rip.fp, 'Hz') + ' · ' + fmtEng(dUziel, 'V') + ') = ' + fmtEng(Cmin * 1e-6, 'F') + ', gewählt aus E6: ' + fmtEng(Cn * 1e-6, 'F') + '.');
    t.push('5. Kontrolle: ΔU = ' + fmtEng(rip.dU, 'V') + ', U_min = ' + fmtEng(Umin, 'V') + ' (Reserve ' + fmtEng(Umin - dr.UeinMin, 'V') + '), U_mittel = ' + fmtEng(Umittel, 'V') + '.');
    t.push('6. Verlustleistung im Regler P_V = (U_mittel − U_aus) · I = ' + fmtEng(PV, 'W') + ', Wirkungsgrad ' + fmt(eta * 100, 1) + ' %' + (out.therm ? '; ab ' + fmtEng(LV('pv_therm'), 'W') + ' ist Kühlung ein Thema (Thermik-Lab).' : '.'));
    if (typ === 'lm317') t.push('7. LM317: R2 = R1 · (U_aus/1,25 V − 1) = ' + fmtEng(out.R2, 'Ω') + ' bei R1 = ' + fmtEng(out.R1, 'Ω') + '.');
    if (!rip.valid) out.diag.push(TEXTS.get('ripple-naeherung', { dU: fmtEng(rip.dU, 'V'), grenze: fmtEng(rip.grenze, 'V') }));
    if (out.therm) out.diag.push(TEXTS.get('regler-heiss', { p: fmtEng(PV, 'W') }));
    return out;
  });
  design.buck = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Uin) || !pos(cfg.Uout) || !pos(cfg.Iout)) return fail('Uin, Uout und Iout müssen größer als 0 sein.');
    if (cfg.Uout >= cfg.Uin) return fail('Ausgangsspannung ≥ Eingangsspannung: Ein Tiefsetzsteller kann nur kleinere Spannungen erzeugen, ein Hochsetzsteller ist nötig.');
    if (cfg.Uin > LV('u_dc_max')) return fail('Die Eingangsspannung liegt über der Grenze des Modells (' + fmtEng(LV('u_dc_max'), 'V') + ').');
    const f = cfg.f === undefined ? LV('fsw') : cfg.f;
    if (!pos(f)) return fail('Die Schaltfrequenz muss größer als 0 sein.');
    const esr = cfg.esr === undefined ? LV('esr') : cfg.esr;
    if (!nn(esr)) return fail('Der ESR darf nicht negativ sein.');
    const dUziel = cfg.dUziel === undefined ? LV('du_aus_ziel') / 100 * cfg.Uout : cfg.dUziel;
    if (!pos(dUziel)) return fail('Die Zielwelligkeit muss größer als 0 sein.');
    const IminA = cfg.Imin === undefined ? LV('imin_anteil') / 100 * cfg.Iout : cfg.Imin;
    if (!pos(IminA) || IminA > cfg.Iout) return fail('Die Kleinstlast muss größer als 0 und höchstens der Nennstrom sein.');
    const r0 = C.buck.ripple({ Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: f, L: 100e-6, C: 100e-6, esr: esr, dUziel: dUziel });
    if (!r0 || !r0.ok) return fail(r0 && r0.why || 'Die Drossel ist nicht rechenbar.');
    const L0 = r0.Lauslegung, Ln = e6up(L0);
    const lk = C.buck.lcrit({ Uin: cfg.Uin, Uout: cfg.Uout, f: f, L: Ln, Imin: IminA });
    let L = Ln, lkText = '';
    if (lk && lk.ok && !lk.nichtLueckend) { L = e6up(lk.Lkrit); lkText = 'Bei der Kleinstlast ' + fmtEng(IminA, 'A') + ' wäre ' + fmtEng(Ln, 'H') + ' zu klein (L_krit = ' + fmtEng(lk.Lkrit, 'H') + '): auf ' + fmtEng(L, 'H') + ' erhöht, damit der Betrieb nicht lückt.'; }
    const r1 = C.buck.ripple({ Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: f, L: L, C: 100e-6, esr: esr, dUziel: dUziel });
    if (!r1 || !r1.ok) return fail(r1 && r1.why || 'Der Kondensator ist nicht rechenbar.');
    const Cmin = r1.Cmin;
    if (!(Cmin > 0)) return fail('Der ESR-Anteil liegt schon über der Zielwelligkeit (' + fmtEng(dUziel, 'V') + '): ein Kondensator mit kleinerem ESR ist nötig, mehr Kapazität hilft nicht.');
    const Cn = e6up(Cmin);
    const fin_ = C.buck.ccm({ Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: f, L: L, C: Cn, esr: esr });
    if (!fin_ || fin_.ok === false) return fail(fin_ && fin_.why || 'Der Arbeitspunkt ist nicht rechenbar.');
    const ls = C.loss.eta({ kind: 'buck', Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: f, L: L, esr: esr });
    const eta = ls && ls.ok !== false ? ls.eta : NaN;
    const out = { ok: true, Uin: cfg.Uin, Uout: cfg.Uout, Iout: cfg.Iout, f: f, D: fin_.D, dILziel: r0.zielDIL, L0: L0, Lnorm: Ln, L: L, Lkrit: lk && lk.ok ? lk.Lkrit : NaN, Imin: IminA,
      dIL: fin_.dIL, ILmax: fin_.ILmax, Cmin: Cmin, C: Cn, dUziel: dUziel, dU: fin_.dU, esr: esr, eta: eta, Pv: ls && ls.ok !== false ? ls.Pv : NaN, parts: ls && ls.ok !== false ? ls.parts : [], lueckt: fin_.lueckt, status: 'Übungsregeln (F42)', text: [], diag: [] };
    const bad = [];
    if (fin_.lueckt) bad.push('lueckt');
    if (fin_.dIL > LV('dil_max') * cfg.Iout + 1e-12) bad.push('dil');
    if (isFinite(eta) && eta * 100 < LV('eta_ok') - EPS) bad.push('eta');
    if (fin_.D * 100 < LV('d_min') - EPS || fin_.D * 100 > LV('d_max') + EPS) bad.push('d');
    out.ampel = bad.length ? 'gelb' : 'gruen'; out.bad = bad;
    const t = out.text;
    t.push('1. D = U_aus / U_ein = ' + fmt(fin_.D * 100, 2) + ' %.');
    t.push('2. Drossel: ΔI_L = ' + fmt(LV('dil_ausleg'), 1) + ' · I_aus = ' + fmtEng(r0.zielDIL, 'A') + ' (Lehrfaustwert); L = (U_ein − U_aus) · D / (f · ΔI_L) = ' + fmtEng(L0, 'H') + ', aus E6: ' + fmtEng(Ln, 'H') + '.');
    if (lkText) t.push('3. ' + lkText);
    else t.push('3. Lückgrenze: L_krit = ' + fmtEng(out.Lkrit, 'H') + ' bei der Kleinstlast ' + fmtEng(IminA, 'A') + '; die Drossel ist größer, der Betrieb lückt nicht.');
    t.push('4. Kondensator: C ≥ ΔI_L / (8 · f · (ΔU − ΔI_L · ESR)) = ' + fmtEng(Cmin, 'F') + ' für ΔU = ' + fmtEng(dUziel, 'V') + ', aus E6: ' + fmtEng(Cn, 'F') + '.');
    t.push('5. Kontrolle: ΔI_L = ' + fmtEng(fin_.dIL, 'A') + ', I_L,max = ' + fmtEng(fin_.ILmax, 'A') + ', ΔU = ' + fmtEng(fin_.dU, 'V') + ' (Summe aus Kapazitäts- und ESR-Anteil).');
    t.push('6. Wirkungsgrad aus den Einzelverlusten (Übungswerte): η = ' + fmt(eta * 100, 1) + ' %, P_V = ' + fmtEng(out.Pv, 'W') + '.');
    if (fin_.lueckt) out.diag.push(TEXTS.get('lueckt', { iout: fmtEng(cfg.Iout, 'A'), ikrit: fmtEng(fin_.Ikrit, 'A') }));
    (fin_.diag || []).forEach(function (d) { if (!out.diag.some(function (x) { return x.id === d.id; })) out.diag.push(d); });
    return out;
  });
  design.stringText = function (res) { try { const r = isObj(res) && res.ok === false ? String(res.why || 'Die Auslegung ist nicht möglich.') : (isObj(res) && isArr(res.text) ? res.text.join('\n') : ''); return r; } catch (e) { return ''; } };

  /* =====================================================================================================
   *  PRUEFMODELL assess(rigId, state) UND DIAGNOSE diagnose(ctx), SPEC 4.10
   *  state = Steuerwerte des Pruefstands (rig.getControls() oder rig.state()), Einheiten wie am Pruefstand (buck: f kHz, l µH, c µF, esr mOhm; topo: f Hz, l µH, c µF;
   *  gate: qg, qgd nC, ton, toff ns; gleich/stabil/trafo: V, A, Ohm, µF). Fehlende Schluessel nehmen die Vorgaben des Pruefstands. Ein Analysierer je Anlage liefert
   *  die Ampel UND die Meldungen aus derselben Rechnung (eine Quelle); die Pruefstaende duerfen dieselben Zahlen aus dem Kern ziehen (WP7: Gleichheit per Test).
   * ===================================================================================================== */
  const DEF = {
    trafo: { n1: ['n', 1150], n2: ['n', 69], ri: ['n', 0.4], iLast: ['n', 2.5], gleichspannung: ['b', false], last: ['s', 'R|diode', 'R'] },
    gleich: { u2: ['n', 12], topo: ['s', 'einweg|bruecke', 'bruecke'], diode: ['s', 'si|schottky', 'si'], rs: ['n', 0], c: ['n', 2200], rsieb: ['b', false], iLast: ['n', 0.5] },
    stabil: { art: ['s', 'zener|7805|lm317', '7805'], ue: ['n', 14], uz: ['n', 5.1], rv: ['n', 470], r1: ['n', 240], r2: ['n', 970], t2: ['b', false], r3: ['n', 0.6], rlast: ['n', 4700], iLast: ['n', 0.6], kurz: ['b', false] },
    buck: { uin: ['n', 12], steuer: ['s', 'geregelt|gesteuert', 'geregelt'], uout: ['n', 5], d: ['n', 0.4167], f: ['n', 100], l: ['n', 100], c: ['n', 100], esr: ['n', 50], rdson: ['n', 50], uf: ['s', 'diode|sync', 'diode'], iout: ['n', 1], isat: ['n', 0] },
    topo: { topo: ['s', 'boost|invers|sperr', 'boost'], uin: ['n', 5], uout: ['n', 12], f: ['n', 100000], l: ['n', 100], c: ['n', 100], iout: ['n', 0.5], n: ['n', 1] },
    gate: { ug: ['n', 10], rg: ['n', 10], qg: ['n', 20], qgd: ['n', 5], f: ['n', 100000], uin: ['n', 12], i: ['n', 1], halbbruecke: ['b', false], ton: ['n', 100], toff: ['n', 0] },
    regel: { modus: ['s', 'regelung|labor', 'regelung'], uref: ['n', 1.25], r1: ['n', 1000], r2: ['n', 6200], vr: ['n', NaN], kompensation: ['b', false], lastsprung: ['n', NaN], uset: ['n', 12], iset: ['n', 1], rlast: ['n', 20], rs: ['n', 0.6], offen: ['s', 'R1|R2', ''], erwartet: ['s', 'CV|CC', ''], tAusMax: ['n', NaN] },
    fehler: { fehler: ['s', '', ''], netz: ['s', 'linear|zener|buck|boost', ''], diagnose: ['s', '', ''], clicks: ['a', []], getauscht: ['a', []], begruendung: ['b', false] }
  };
  /* Steuerwerte lesen: Rueckgabe { v } oder { err } */
  function readState(rigId, state) {
    const spec = DEF[rigId];
    if (!spec) return { err: 'Den Prüfstand „' + String(rigId) + '“ gibt es nicht (trafo, gleich, stabil, buck, topo, gate, regel, fehler).' };
    if (!isObj(state)) return { err: 'Der Zustand des Prüfstands fehlt.' };
    const src = isObj(state.ctl) ? Object.assign({}, state.ctl, state) : state;
    const v = {};
    const keys = Object.keys(spec);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], sp = spec[k];
      let x = src[k];
      if (x === undefined || x === null) { v[k] = sp[0] === 's' ? sp[2] : (sp[0] === 'a' ? sp[1].slice() : sp[1]); continue; }
      if (sp[0] === 'n') {
        if (typeof x !== 'number' || !isFinite(x) || Math.abs(x) > 1e12) return { err: 'Der Wert „' + k + '“ ist keine gültige Zahl.' };
        v[k] = x;
      } else if (sp[0] === 'b') {
        if (typeof x === 'boolean') v[k] = x;
        else if (x === 1 || x === 0) v[k] = !!x;
        else return { err: 'Der Wert „' + k + '“ muss ja oder nein sein.' };
      } else if (sp[0] === 's') {
        if (typeof x !== 'string') return { err: 'Der Wert „' + k + '“ muss ein Text sein.' };
        if (sp[1] && x !== '' && sp[1].split('|').indexOf(x) < 0) return { err: 'Der Wert „' + k + '“ ist unbekannt (' + sp[1].split('|').join(', ') + ').' };
        v[k] = x;
      } else if (sp[0] === 'a') {
        if (!isArr(x)) return { err: 'Der Wert „' + k + '“ muss eine Liste sein.' };
        v[k] = x.slice();
      }
    }
    return { v: v };
  }
  function M(id, kind0, vars, extra) {
    const t = TEXTS.get(id, vars);
    const o = { id: id, kind: t.text ? t.kind : kind0, text: t.text, wert: NaN, grenze: NaN, gegenprobe: '' };
    if (t.link) o.link = t.link;
    if (t.fx) o.fx = t.fx;
    if (extra) for (const k in extra) o[k] = extra[k];
    return o;
  }
  const statTag = function (id) { const l = C.limit(id); return l && l.status === 'A' ? ' (Übungswert)' : ''; };
  const GRAU = function (why) { return { a: { ok: false, ampel: 'grau', text: why }, d: [], r: null }; };
  function AMP(ok, ampel, text, margin) { const o = { ok: ok, ampel: ampel, text: text }; if (typeof margin === 'number' && isFinite(margin)) o.margin = margin; return o; }

  /* ---------------- trafo ---------------- */
  function anTrafo(v) {
    const u1 = LV('u_netz');
    const rat = C.trafo.ratio({ U1: u1, n1: v.n1, n2: v.n2, iLast: v.iLast });
    if (!rat || !rat.ok) return GRAU(rat && rat.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
    const gelb = LV('trafo_gelb'), rot = LV('trafo_rot');
    if (v.gleichspannung) {
      const dc = C.trafo.dc({ U: u1, Rw: LV('ri1_trafo') });
      if (!dc || !dc.ok) return GRAU(dc && dc.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
      return { a: AMP(false, 'rot', 'Gleichspannung am Transformator: Die Wicklung wird zerstört, sekundär entsteht keine Spannung.'),
        d: [M('trafo-dc', 'error', { I: fmtEng(dc.I, 'A') }, { wert: dc.I, gegenprobe: 'Gegenprobe: I = U / R_w = ' + fmtEng(dc.U, 'V') + ' / ' + fmtEng(dc.Rw, 'Ω') + ' = ' + fmtEng(dc.I, 'A') + '. Mit Wechselspannung begrenzt zusätzlich der induktive Widerstand den Strom.' })], r: { dc: dc } };
    }
    const ld = C.trafo.load({ U1: u1, n1: v.n1, n2: v.n2, ri: v.ri, iLast: v.iLast, last: v.last, gleich: v.last === 'diode' });
    if (!ld || !ld.ok) return GRAU(ld && ld.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
    const d = [];
    if (!ld.valid) {
      d.push(M('trafo-ueberlast', 'error', {}, { wert: ld.U2_klemme, grenze: 0, gegenprobe: 'Gegenprobe: U_klemme = U_leer − I · R_i = ' + fmtEng(ld.U2_leer, 'V') + ' − ' + fmtEng(ld.I2, 'A') + ' · ' + fmtEng(ld.ri, 'Ω') + ' = ' + fmtEng(ld.U2_klemme, 'V') + ' (unter null).' }));
      return { a: AMP(false, 'rot', 'Überlast: Die Klemmenspannung ist unter null gerechnet, der Strom ist für diesen Innenwiderstand zu groß.'), d: d, r: { ld: ld } };
    }
    const e = ld.einbruch * 100;
    const txt = 'Einbruch ' + fmt(e, 1) + ' % der Leerlaufspannung (grün bis ' + fmt(gelb, 0) + ' %, rot über ' + fmt(rot, 0) + ' %)' + (statTag('trafo_gelb') ? ' (Lehrgrenzen, Übungswerte)' : '') + '.';
    let a;
    if (e <= gelb + 1e-9) a = AMP(true, 'gruen', txt, e > 0 ? gelb / e : undefined);
    else if (e <= rot + 1e-9) a = AMP(false, 'gelb', txt, rot / e);
    else a = AMP(false, 'rot', txt, rot / e);
    if (e > gelb + 1e-9) d.push(M('trafo-einbruch', null, { e: fmt(e, 1) + ' %', uk: fmtEng(ld.U2_klemme, 'V'), ul: fmtEng(ld.U2_leer, 'V'), g: fmt(gelb, 0), r: fmt(rot, 0) },
      { kind: e > rot + 1e-9 ? 'error' : 'warn', wert: e, grenze: gelb, gegenprobe: 'Gegenprobe: U_klemme = U_leer − I · R_i = ' + fmtEng(ld.U2_leer, 'V') + ' − ' + fmtEng(ld.I2, 'A') + ' · ' + fmtEng(ld.ri, 'Ω') + ' = ' + fmtEng(ld.U2_klemme, 'V') + ', Einbruch ' + fmt(e, 1) + ' %.' }));
    return { a: a, d: d, r: { ld: ld, e: e } };
  }

  /* ---------------- gleich ---------------- */
  function anGleich(v) {
    const L = LV;
    const uf = v.diode === 'schottky' ? L('uf_schottky') : L('uf_si'), f = L('f_netz'), ri = L('ri_trafo');
    const cfg = { topo: v.topo, U2: v.u2, uf: uf, f: f, C: v.c, I: v.iLast, ri: ri, rs: v.rs };
    const rip = C.rect.ripple(cfg);
    if (!rip || !rip.ok) return GRAU(rip && rip.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
    const inr = C.rect.inrush({ topo: v.topo, U2: v.u2, uf: uf, ri: ri, rs: v.rs });
    const okLim = L('ripple_ok') / 100 * rip.peak;
    const cmin = v.iLast > 0 ? C.rect.cmin({ topo: v.topo, I: v.iLast, dU: okLim, f: f }) : NaN;
    const valid = rip.valid;
    let dU = rip.dU, Umittel0 = rip.Umittel, Umin0 = rip.Umin;
    if (!valid) {
      const wv = C.rect.wave(cfg, 400);
      if (!wv || !wv.ok) return GRAU(wv && wv.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
      let mean = 0; for (let i = 0; i < wv.uc.length; i++) mean += wv.uc[i]; mean /= Math.max(1, wv.uc.length);
      dU = wv.dU; Umittel0 = mean; Umin0 = wv.Umin;
    }
    let drop = 0;
    if (v.rsieb) drop = v.iLast * L('rc_r');
    const Umin = Umin0 - drop, Umittel = Umittel0 - drop;
    const reglerMin = L('umin_7805'), reserveMin = L('reserve');
    const reg = fmtEng(reglerMin, 'V'), um = fmtEng(Math.max(0, Umin), 'V');
    let a;
    const pct = fmt(L('ripple_ok'), 0);
    const m = dU > 0 ? okLim / dU : Infinity;
    if (Umin < reglerMin - 1e-9) a = AMP(false, 'rot', 'U_min = ' + um + ' liegt unter der Mindest-Eingangsspannung des Übungsreglers 7805 (' + reg + ', Übungswert, Datenblatt maßgeblich): Der Regler fällt aus dem Betrieb.', Umin > 0 ? Umin / reglerMin : 0);
    else if (!valid) a = AMP(false, 'gelb', 'Die Brummformel gilt hier nicht (ΔU über ' + fmt(L('ripple_naeh') * 100, 0) + ' % von Û): Angezeigt ist die Zeitschritt-Rechnung. U_min = ' + um + ' bleibt über ' + reg + '.');
    else if (dU > okLim + 1e-9) a = AMP(false, 'gelb', 'ΔU = ' + fmtEng(dU, 'V') + ' liegt über dem Lehrfaustwert ' + pct + ' % von Û (' + fmtEng(okLim, 'V') + ', Übungswert). U_min = ' + um + ' bleibt über ' + reg + '.', okLim / dU);
    else if (m < reserveMin - 1e-9) a = AMP(false, 'gelb', 'ΔU = ' + fmtEng(dU, 'V') + ' ist nahe der Grenze (' + fmtEng(okLim, 'V') + '): Reserve ' + fmt(m, 2) + ' unter ' + fmt(reserveMin, 1) + ' (Lehrfaustwerte).', m);
    else a = AMP(true, 'gruen', 'ΔU = ' + fmtEng(dU, 'V') + ' liegt unter ' + pct + ' % von Û (' + fmtEng(okLim, 'V') + ') und U_min = ' + um + ' über ' + reg + ' (Lehrfaustwerte, Übungsregler).', isFinite(m) ? m : undefined);
    const d = [];
    const gpBrumm = 'Gegenprobe: ΔU = I / (f_p · C) = ' + fmtEng(v.iLast, 'A') + ' / (' + fmtEng(rip.fp, 'Hz') + ' · ' + fmtEng(v.c * 1e-6, 'F') + ') = ' + fmtEng(rip.dU, 'V') + '.';
    if (!valid) d.push(M('ripple-naeherung', 'warn', { dU: fmtEng(rip.dU, 'V'), grenze: fmtEng(rip.grenze, 'V') }, { wert: rip.dU, grenze: rip.grenze, gegenprobe: gpBrumm + ' Grenze ' + fmt(L('ripple_naeh') * 100, 0) + ' % von Û = ' + fmtEng(rip.grenze, 'V') + '.' }));
    if (valid && dU > okLim + 1e-9) {
      d.push(M('brumm-gross', 'warn', { dU: fmtEng(dU, 'V'), fp: fmtEng(rip.fp, 'Hz'), C: fmt(v.c, 0) + ' µF', grenze: fmtEng(okLim, 'V') }, { wert: dU, grenze: okLim, gegenprobe: gpBrumm }));
      if (isFinite(cmin) && v.c < cmin) d.push(M('c-zu-klein', 'warn', { cmin: fmt(cmin, 0) + ' µF', C: fmt(v.c, 0) + ' µF' }, { wert: v.c, grenze: cmin, gegenprobe: 'Gegenprobe: C_min = I / (f_p · ΔU_grenze) = ' + fmtEng(v.iLast, 'A') + ' / (' + fmtEng(rip.fp, 'Hz') + ' · ' + fmtEng(okLim, 'V') + ') = ' + fmtEng(cmin * 1e-6, 'F') + '.' }));
    }
    if (v.topo === 'einweg') {
      const other = C.rect.ripple({ topo: 'bruecke', U2: v.u2, uf: uf, f: f, C: v.c, I: v.iLast });
      if (other && other.ok) d.push(M('brumm-100-gegen-50', 'info', { fp: fmtEng(rip.fp, 'Hz'), dU: fmtEng(rip.dU, 'V'), dUb: fmtEng(other.dU, 'V') }, { wert: rip.dU, grenze: other.dU, gegenprobe: 'Gegenprobe Brücke: ΔU = I / (2 · f · C) = ' + fmtEng(other.dU, 'V') + ', also halb so groß wie bei Einweg (' + fmtEng(rip.dU, 'V') + ').' }));
    }
    if (Umin < reglerMin - 1e-9) d.push(M('regler-dropout', 'error', { umin: fmtEng(reglerMin, 'V'), uein: fmtEng(Math.max(0, Umin), 'V') }, { wert: Umin, grenze: reglerMin, gegenprobe: 'Gegenprobe: U_min = Û − ΔU' + (v.rsieb ? ' − I · R' : '') + ' = ' + fmtEng(rip.peak, 'V') + ' − ' + fmtEng(dU, 'V') + (v.rsieb ? ' − ' + fmtEng(drop, 'V') : '') + ' = ' + fmtEng(Umin, 'V') + ' (Mindest-Eingang ' + fmtEng(reglerMin, 'V') + ').' }));
    if (isFinite(inr.Imax) && inr.valid) d.push(M('einschalt-hoch', 'info', { imax: fmtEng(inr.Imax, 'A') }, { wert: inr.Imax, gegenprobe: 'Gegenprobe: I_max = Û / (R_i + R_s) = ' + fmtEng(inr.peak, 'V') + ' / ' + fmtEng(inr.Rges, 'Ω') + ' = ' + fmtEng(inr.Imax, 'A') + '.' }));
    return { a: a, d: d, r: { rip: rip, dU: dU, Umin: Umin, okLim: okLim, cmin: cmin, valid: valid } };
  }

  /* ---------------- stabil ---------------- */
  function anStabil(v) {
    const L = LV;
    const pvT = L('pv_therm');
    if (v.art === 'zener') {
      const z = C.zener.stage({ Ue: v.ue, Uz: v.uz, Rv: v.rv, Rlast: v.rlast, Pmax: L('pz_max') });
      if (!z || !z.ok) return GRAU(z && z.why || 'Die Schaltung ist mit diesen Werten nicht rechenbar.');
      const leer = C.zener.stage({ Ue: v.ue, Uz: v.uz, Rv: v.rv, Ilast: 0, Pmax: L('pz_max') });
      const rvmin = C.zener.rvMin({ Ue: v.ue, Uz: v.uz, Pmax: L('pz_max') });
      let pr, pz;
      if (z.leitet) { pr = z.Pr; pz = z.Pz; } else { const I = v.ue / (v.rv + v.rlast); pr = I * I * v.rv; pz = 0; }
      const PV = pr + pz, pvS = fmtEng(PV, 'W'), pvTs = fmtEng(pvT, 'W');
      let a;
      if (z.Ue <= z.Uz) a = AMP(false, 'rot', 'U_ein = ' + fmtEng(z.Ue, 'V') + ' liegt nicht über U_Z = ' + fmtEng(z.Uz, 'V') + ': Die Z-Diode sperrt, am Ausgang liegt nur der Spannungsteiler (' + fmtEng(z.Uaus, 'V') + ').');
      else if (!z.leitet || !z.aktiv) a = AMP(false, 'rot', 'Z-Strom I_Z = ' + fmtEng(Math.max(0, z.IzRoh), 'A') + ' liegt unter I_Z,min = ' + fmtEng(z.izmin, 'A') + ' (Übungswert): Die Z-Diode stabilisiert nicht, die Ausgangsspannung bricht ein.', z.izmin > 0 ? Math.max(0, z.IzRoh) / z.izmin : 0);
      else if (z.ueberlast) a = AMP(false, 'rot', 'P_Z = ' + fmtEng(z.Pz, 'W') + ' liegt über P_max = ' + fmtEng(L('pz_max'), 'W') + ' (Übungswert, Datenblatt maßgeblich): Die Z-Diode ist überlastet.', L('pz_max') / z.Pz);
      else if (PV >= pvT - 1e-12) a = AMP(false, 'gelb', 'P_V = ' + pvS + ' erreicht die Schwelle ' + pvTs + ' (Übungswert): Die Schaltung wird warm, Kühlung ist ein Thema (Thermik-Lab).', z.Iz / z.izmin);
      else a = AMP(true, 'gruen', 'I_Z = ' + fmtEng(z.Iz, 'A') + ' liegt über I_Z,min = ' + fmtEng(z.izmin, 'A') + ', P_Z = ' + fmtEng(z.Pz, 'W') + ' unter P_max = ' + fmtEng(L('pz_max'), 'W') + ' und P_V = ' + pvS + ' unter ' + pvTs + ' (Übungswerte).', z.Iz / z.izmin);
      const d = [];
      if (z.Ue <= z.Uz) d.push(M('z-sperrt', 'warn', { ue: fmtEng(z.Ue, 'V'), uz: fmtEng(z.Uz, 'V') }, { wert: z.Ue, grenze: z.Uz, gegenprobe: 'Gegenprobe: U_ein ≤ U_Z, also Spannungsteiler: U_aus = U_ein · R_last / (R_V + R_last) = ' + fmtEng(z.Uaus, 'V') + '.' }));
      else if (!z.aktiv) d.push(M('z-aus', 'warn', { iz: fmtEng(z.IzRoh, 'A'), izmin: fmtEng(z.izmin, 'A') }, { wert: z.IzRoh, grenze: z.izmin, gegenprobe: 'Gegenprobe: I_Z = (U_ein − U_Z)/R_V − U_Z/R_last = ' + fmtEng(z.Iges, 'A') + ' − ' + fmtEng(z.Ilast, 'A') + ' = ' + fmtEng(z.IzRoh, 'A') + '.' }));
      if (z.ueberlast) d.push(M('z-p-zu-gross', 'error', { pz: fmtEng(z.Pz, 'W'), pmax: fmtEng(L('pz_max'), 'W') }, { wert: z.Pz, grenze: L('pz_max'), gegenprobe: 'Gegenprobe: P_Z = U_Z · I_Z = ' + fmtEng(z.Uz, 'V') + ' · ' + fmtEng(z.Iz, 'A') + ' = ' + fmtEng(z.Pz, 'W') + '.' }));
      if (isFinite(rvmin) && v.rv < rvmin - 1e-9) d.push(M('rv-zu-klein', 'warn', { rv: fmtEng(v.rv, 'Ω'), rvmin: fmtEng(rvmin, 'Ω'), pmax: fmtEng(L('pz_max'), 'W'), pz: fmtEng(leer.Pz, 'W') }, { wert: v.rv, grenze: rvmin, gegenprobe: 'Gegenprobe: R_V,min = (U_ein − U_Z) · U_Z / P_max = ' + fmtEng(rvmin, 'Ω') + '; im Leerlauf P_Z = ' + fmtEng(leer.Pz, 'W') + '.' }));
      if (PV >= pvT - 1e-12) d.push(M('regler-heiss', 'warn', { p: fmtEng(PV, 'W') }, { wert: PV, grenze: pvT, gegenprobe: 'Gegenprobe: P_V = P_R + P_Z = ' + fmtEng(pr, 'W') + ' + ' + fmtEng(pz, 'W') + ' = ' + fmtEng(PV, 'W') + ' (Schwelle ' + pvTs + ').' }));
      return { a: a, d: d, r: { z: z, PV: PV } };
    }
    /* Regler */
    const base = v.art === 'lm317' ? C.lin.lm317({ R1: v.r1, R2: v.r2, Uein: v.ue, I: v.iLast }) : C.lin.fixed({ typ: '7805', Uein: v.ue, I: v.iLast });
    if (!base || !base.ok) return GRAU(base && base.why || 'Die Schaltung ist mit diesen Werten nicht rechenbar.');
    const lim = v.t2 ? C.lin.limitT2({ R3: v.r3, Uein: v.ue }) : null;
    if (v.t2 && (!lim || !lim.ok)) return GRAU(lim && lim.why || 'Die Schaltung ist mit diesen Werten nicht rechenbar.');
    const begrenzt = !!lim && (v.kurz || v.iLast > lim.Ilim + 1e-12);
    let mode, Uaus, I, PV;
    if (v.kurz && !lim) { mode = 'kurz-frei'; Uaus = 0; I = 0; PV = 0; }
    else if (begrenzt) { I = lim.Ilim; Uaus = v.kurz ? 0 : base.UausIst * lim.Ilim / v.iLast; PV = (v.ue - Uaus) * I; mode = 'begrenzt'; }
    else { mode = base.betrieb ? 'betrieb' : 'dropout'; Uaus = base.UausIst; I = v.iLast; PV = base.P_V; }
    const nm = v.art === 'lm317' ? 'LM317' : '7805';
    const pvS = fmtEng(PV, 'W'), pvTs = fmtEng(pvT, 'W');
    const margin = base.UeinMin > 0 ? v.ue / base.UeinMin : undefined;
    let a;
    if (mode === 'kurz-frei') a = AMP(false, 'rot', 'Ausgang kurzgeschlossen ohne Strombegrenzung: Der Strom ist im Modell nicht begrenzt und wird nicht gerechnet. Ein Linearregler setzt dann U_ein mal I in Wärme um (Strombegrenzung T2 zuschalten).');
    else if (mode === 'dropout') a = AMP(false, 'rot', nm + ' im Dropout: U_ein = ' + fmtEng(v.ue, 'V') + ' liegt unter der Mindest-Eingangsspannung ' + fmtEng(base.UeinMin, 'V') + ' (Übungswert, Datenblatt maßgeblich). Die Ausgangsspannung folgt dem Eingang nach unten.', margin);
    else if (mode === 'begrenzt') a = AMP(false, 'gelb', 'Strombegrenzung aktiv: I_lim = ' + fmtEng(lim.Ilim, 'A') + ' (' + fmtEng(lim.Ube, 'V') + ' / R3), U_aus fällt auf ' + fmtEng(Uaus, 'V') + ', P_V = ' + pvS + (PV >= pvT - 1e-12 ? ' (Schwelle ' + pvTs + ' erreicht, Kühlung ist ein Thema).' : '.'), margin);
    else if (PV >= pvT - 1e-12) a = AMP(false, 'gelb', nm + ' im Betrieb, aber P_V = ' + pvS + ' erreicht die Schwelle ' + pvTs + ' (Übungswert): Kühlung ist ein Thema (Thermik-Lab).', margin);
    else if (v.art === 'lm317' && base.minlastOk === false) a = AMP(false, 'gelb', 'Laststrom ' + fmtEng(v.iLast, 'A') + ' liegt unter der Mindestlast ' + fmtEng(base.imin, 'A') + ' (Übungswert): Die Ausgangsspannung ist nicht gesichert.', margin);
    else a = AMP(true, 'gruen', nm + ' im Regelbetrieb: U_ein = ' + fmtEng(v.ue, 'V') + ' liegt über ' + fmtEng(base.UeinMin, 'V') + ' (Übungswert) und P_V = ' + pvS + ' unter ' + pvTs + '.', margin);
    const d = [];
    if (mode === 'dropout') d.push(M('regler-dropout', 'error', { umin: fmtEng(base.UeinMin, 'V'), uein: fmtEng(v.ue, 'V') }, { wert: v.ue, grenze: base.UeinMin, gegenprobe: 'Gegenprobe: U_ein,min = U_aus + Dropout = ' + fmtEng(base.Uaus, 'V') + ' + ' + fmtEng(base.dropout, 'V') + ' = ' + fmtEng(base.UeinMin, 'V') + '.' }));
    if (PV >= pvT - 1e-12 && mode !== 'kurz-frei') d.push(M('regler-heiss', 'warn', { p: pvS }, { wert: PV, grenze: pvT, gegenprobe: 'Gegenprobe: P_V = (U_ein − U_aus) · I = (' + fmtEng(v.ue, 'V') + ' − ' + fmtEng(Uaus, 'V') + ') · ' + fmtEng(I, 'A') + ' = ' + pvS + ' (Schwelle ' + pvTs + ').' }));
    if (v.art === 'lm317' && base.minlastOk === false) d.push(M('lm317-imin', 'warn', { i: fmtEng(v.iLast, 'A'), imin: fmtEng(base.imin, 'A') }, { wert: v.iLast, grenze: base.imin, gegenprobe: 'Gegenprobe: I_last = ' + fmtEng(v.iLast, 'A') + ' < I_min = ' + fmtEng(base.imin, 'A') + ' (Übungswert).' }));
    if (begrenzt) d.push({ id: 'strombegrenzung', kind: 'info', text: 'Die Strombegrenzung greift bei I_lim = ' + fmtEng(lim.Ilim, 'A') + ' (U_BE / R3); die Last würde ' + fmtEng(v.iLast, 'A') + ' ziehen. Im Kurzschluss setzt der Regler U_ein · I_lim = ' + fmtEng(lim.PvKurz, 'W') + ' um.', wert: lim.Ilim, grenze: NaN, gegenprobe: 'Gegenprobe: I_lim = U_BE / R3 = ' + fmtEng(lim.Ube, 'V') + ' / ' + fmtEng(lim.R3, 'Ω') + ' = ' + fmtEng(lim.Ilim, 'A') + '.' });
    return { a: a, d: d, r: { base: base, mode: mode, PV: PV } };
  }

  /* ---------------- buck ---------------- */
  function anBuck(v) {
    const L = LV;
    const cfg = { Uin: v.uin, f: v.f * 1e3, L: v.l * 1e-6, C: v.c * 1e-6, esr: v.esr * 1e-3 };
    if (v.steuer === 'gesteuert') { cfg.D = v.d; cfg.Rlast = v.d * v.uin / v.iout; } else { cfg.Uout = v.uout; cfg.Iout = v.iout; }
    const cc = C.buck.ccm(cfg);
    if (!cc || !cc.ok) {
      const e = String(cc && cc.why || '');
      return { a: { ok: false, ampel: /Ausgangsspannung ≥|Hochsetzsteller/.test(e) ? 'rot' : 'grau', text: e ? e : 'Die Schaltung ist mit diesen Werten nicht rechenbar.' }, d: [], r: null };
    }
    const ls = C.loss.eta({ kind: 'buck', Uin: v.uin, Uout: cc.Uabs, Iout: cc.Iout, f: cc.f, L: cc.L, rdson: v.rdson * 1e-3, esr: v.esr * 1e-3, sync: v.uf === 'sync' });
    if (!ls || ls.ok === false) return GRAU(ls && ls.why || 'Die Schaltung ist mit diesen Werten nicht rechenbar.');
    const lk = C.buck.lcrit({ D: cc.Uabs / v.uin, Rlast: cc.R, f: cc.f, L: cc.L });   /* CCM-Tastverhaeltnis U_aus/U_ein (nicht das D des Lueckbetriebs) */
    const dilMax = L('dil_max'), etaOk = L('eta_ok'), dMin = L('d_min'), dMax = L('d_max');
    const why = [], dilG = dilMax * cc.Iout;
    const sat = v.isat > 0 && cc.ILmax > v.isat + 1e-12;
    if (sat) why.push('rot');
    let a;
    const txt = [];
    if (cc.lueckt) txt.push('Lückbetrieb: Der Drosselstrom fällt in jeder Periode auf 0 A (I_aus = ' + fmtEng(cc.Iout, 'A') + ' unter I_krit = ' + fmtEng(cc.Ikrit, 'A') + ').');
    else if (cc.dIL > dilG + 1e-12) txt.push('ΔI_L = ' + fmtEng(cc.dIL, 'A') + ' liegt über ' + fmt(dilMax, 1) + ' mal I_aus = ' + fmtEng(dilG, 'A') + ' (Lehrfaustwert).');
    if (ls.eta * 100 < etaOk - 1e-9) txt.push('η = ' + fmt(ls.eta * 100, 1) + ' % liegt unter ' + fmt(etaOk, 0) + ' % (Übungswert).');
    if (cc.D * 100 < dMin - 1e-9 || cc.D * 100 > dMax + 1e-9) txt.push('D = ' + fmt(cc.D * 100, 1) + ' % liegt außerhalb ' + fmt(dMin, 0) + ' bis ' + fmt(dMax, 0) + ' % (Lehrfaustwert).');
    const margin = !cc.lueckt && cc.dIL > 0 ? dilG / cc.dIL : undefined;
    if (sat) a = AMP(false, 'rot', 'Der Spitzenstrom der Drossel ' + fmtEng(cc.ILmax, 'A') + ' liegt über der Sättigungsgrenze ' + fmtEng(v.isat, 'A') + '.' + (txt.length ? ' ' + txt.join(' ') : ''), margin);
    else if (txt.length) a = AMP(false, 'gelb', txt.join(' '), margin);
    else a = AMP(true, 'gruen', 'Nicht lückend, ΔI_L = ' + fmtEng(cc.dIL, 'A') + ' unter ' + fmt(dilMax, 1) + ' mal I_aus = ' + fmtEng(dilG, 'A') + ', η = ' + fmt(ls.eta * 100, 1) + ' % über ' + fmt(etaOk, 0) + ' % und D = ' + fmt(cc.D * 100, 1) + ' % im Bereich (Lehrfaustwerte, Übungswerte).', margin);
    const d = [];
    (cc.diag || []).forEach(function (m) {
      const o = { id: m.id, kind: m.kind || 'info', text: m.text, wert: NaN, grenze: NaN, gegenprobe: '' };
      if (m.link) o.link = m.link;
      if (m.id === 'lueckt') { o.wert = cc.Iout; o.grenze = cc.Ikrit; o.gegenprobe = 'Gegenprobe: I_krit = ΔI_L / 2 = ' + fmtEng(cc.dIL, 'A') + ' / 2 = ' + fmtEng(cc.Ikrit, 'A') + '; I_aus = ' + fmtEng(cc.Iout, 'A') + '.'; }
      else if (m.id === 'd-grenze') { o.wert = cc.D * 100; o.grenze = cc.D * 100 < dMin ? dMin : dMax; o.gegenprobe = 'Gegenprobe: D = U_aus / U_ein = ' + fmtEng(cc.Uabs, 'V') + ' / ' + fmtEng(v.uin, 'V') + ' = ' + fmt(cc.D * 100, 2) + ' %.'; }
      else if (m.id === 'delta-i-gross') { o.wert = cc.dIL; o.grenze = dilG; o.gegenprobe = 'Gegenprobe: ΔI_L = (U_ein − U_aus) · D / (f · L) = ' + fmtEng(cc.dIL, 'A') + '; Grenze ' + fmt(dilMax, 1) + ' · I_aus = ' + fmtEng(dilG, 'A') + '.'; }
      else if (m.id === 'ungeregelt') { o.wert = cc.D; o.gegenprobe = 'Gegenprobe: U_aus = D · U_ein = ' + fmt(cc.D, 4) + ' · ' + fmtEng(v.uin, 'V') + ' = ' + fmtEng(cc.D * v.uin, 'V') + '.'; }
      d.push(o);
    });
    if (lk && lk.ok && lk.diag) lk.diag.forEach(function (m) { if (m.id === 'l-zu-klein') d.push({ id: m.id, kind: m.kind || 'warn', text: m.text, wert: cc.L, grenze: lk.Lkrit, gegenprobe: 'Gegenprobe: L_krit = (1 − D) · R / (2 · f) = (1 − ' + fmt(cc.Uabs / v.uin, 4) + ') · ' + fmtEng(cc.R, 'Ω') + ' / (2 · ' + fmtEng(cc.f, 'Hz') + ') = ' + fmtEng(lk.Lkrit, 'H') + '; eingestellt ' + fmtEng(cc.L, 'H') + '.' }); });
    if (sat) d.push(M('sat-drossel', 'error', { ilmax: fmtEng(cc.ILmax, 'A'), isat: fmtEng(v.isat, 'A') }, { wert: cc.ILmax, grenze: v.isat, gegenprobe: 'Gegenprobe: I_L,max = I_aus + ΔI_L/2 = ' + fmtEng(cc.Iout, 'A') + ' + ' + fmtEng(cc.dIL / 2, 'A') + ' = ' + fmtEng(cc.ILmax, 'A') + '.' }));
    if (v.uf === 'sync' && isFinite(ls.etaSync) && isFinite(ls.etaDiode) && ls.etaSync > ls.etaDiode) d.push(M('sync', 'info', { sync: fmt(ls.etaSync * 100, 1) + ' %', diode: fmt(ls.etaDiode * 100, 1) + ' %' }, { wert: ls.etaSync, grenze: ls.etaDiode, gegenprobe: 'Gegenprobe: dieselbe Rechnung mit Diode: η = ' + fmt(ls.etaDiode * 100, 1) + ' %.' }));
    return { a: a, d: d, r: { cc: cc, ls: ls, lk: lk } };
  }

  /* ---------------- topo ---------------- */
  const KIND = { boost: 'boost', invers: 'bb', sperr: 'fly' };
  function anTopo(v) {
    const L = LV;
    const kind = KIND[v.topo], Uab = v.uout, Uin = v.uin, esr = L('esr');
    const sig = kind === 'bb' ? -Uab : Uab;
    const tp = C.topology({ Uin: Uin, Uout: sig, getrennt: kind === 'fly' });
    const cfg = { Uin: Uin, Uout: sig, Iout: v.iout, Rlast: Uab / v.iout, f: v.f, L: v.l * 1e-6, C: v.c * 1e-6, esr: esr };
    if (kind === 'fly') cfg.n = v.n;
    const rep = C[kind].ccm(cfg);
    if (!rep || rep.ok === false) {
      const emp = tp && tp.ok !== false ? ' Empfohlen: ' + tp.name + '.' : '';
      const why = rep && rep.why || 'Eingabe';
      return { a: AMP(false, 'rot', 'Topologie unmöglich oder kein Arbeitspunkt: ' + why + emp), d: [M('topologie-falsch', 'error', { grund: why + emp }, { gegenprobe: 'Gegenprobe: ' + (tp && tp.ok !== false ? tp.gegenprobe : 'Die Grundschaltung erreicht diese Ausgangsspannung nicht.') })], r: null };
    }
    const tpOk = tp && tp.ok !== false ? tp : null;
    const passt = !!(tpOk && tpOk.topo === kind);
    const dmin = L('d_min'), dmax = L('d_max'), dwarn = L('d_warn');
    const dp = rep.D * 100;
    let a;
    if (!passt) a = AMP(false, 'rot', 'Die Grundschaltung passt nicht zur Aufgabe: ' + (tpOk ? tpOk.grund : ''));
    else {
      const w = [];
      if (dp > dmax + 1e-9) w.push('D = ' + fmt(dp, 1) + ' % liegt über ' + fmt(dmax, 0) + ' %: Die Regelung hat kaum noch Spielraum.');
      else if (dp > dwarn + 1e-9) w.push('D = ' + fmt(dp, 1) + ' % liegt über ' + fmt(dwarn, 0) + ' %: Der Wandler ist nah an der Grenze.');
      else if (dp < dmin - 1e-9) w.push('D = ' + fmt(dp, 1) + ' % liegt unter ' + fmt(dmin, 0) + ' %.');
      if (rep.lueckt) w.push('Der Drosselstrom fällt auf null (Lückbetrieb): Die Formeln für nicht lückenden Betrieb gelten nicht.');
      const margin = dp > 0 ? dwarn / dp : undefined;
      if (w.length) a = AMP(false, 'gelb', w.join(' '), margin);
      else a = AMP(true, 'gruen', rep.name + ' passt zur Aufgabe, D = ' + fmt(dp, 1) + ' % liegt im Bereich ' + fmt(dmin, 0) + ' % bis ' + fmt(dwarn, 0) + ' % (Lehrfaustwerte, Übungswerte), der Betrieb ist nicht lückend.', margin);
    }
    const d = [];
    (rep.diag || []).forEach(function (m) {
      const o = { id: m.id, kind: m.kind || 'info', text: m.text, wert: NaN, grenze: NaN, gegenprobe: '' };
      if (m.link) o.link = m.link;
      if (m.id === 'lueckt') { o.wert = rep.Iout; o.grenze = rep.Ikrit; o.gegenprobe = 'Gegenprobe: Drosselstrom-Mittelwert ' + fmtEng(rep.ILavg, 'A') + ' gegen ΔI_L / 2 = ' + fmtEng(rep.dIL / 2, 'A') + '.'; }
      else if (m.id === 'd-grenze') { o.wert = dp; o.grenze = dp < dmin ? dmin : dmax; o.gegenprobe = 'Gegenprobe: ' + (tpOk ? tpOk.formel + ' = ' + fmt(dp, 2) + ' %.' : 'D = ' + fmt(dp, 2) + ' %.'); }
      d.push(o);
    });
    return { a: a, d: d, r: { rep: rep, tp: tpOk, passt: passt } };
  }

  /* ---------------- gate ---------------- */
  function anGate(v) {
    const L = LV;
    const Uplat = L('uplat');
    const g = { UG: v.ug, Rg: v.rg, Qg: v.qg * 1e-9, Qgd: v.qgd * 1e-9, Uplat: Uplat, f: v.f };
    if (!(v.qgd < v.qg)) return GRAU('Die Anlage ist mit diesen Werten nicht rechenbar: Q_gd muss kleiner als Q_g sein.');
    const drv = C.gate.drive(g);
    if (!drv || drv.ok === false) {
      const why = drv && drv.why || 'Eingabe';
      if (drv && drv.id === 'ug-zu-klein') return { a: AMP(false, 'rot', why + ' (Plateauspannung ' + fmtEng(Uplat, 'V') + ', Übungswert).'), d: [M('ug-zu-klein', 'error', { ug: fmtEng(v.ug, 'V'), uplat: fmtEng(Uplat, 'V'), ugmin: fmtEng(Uplat + 2, 'V') }, { wert: v.ug, grenze: Uplat, gegenprobe: 'Gegenprobe: mit U_G = ' + fmtEng(Uplat + 2, 'V') + ' (U_plat + 2 V) schaltet der MOSFET sicher durch; I_g,plat = (U_G − U_plat)/R_g = ' + fmtEng((Uplat + 2 - Uplat) / v.rg, 'A') + '.' })], r: null };
      return GRAU('Die Anlage ist mit diesen Werten nicht rechenbar: ' + why);
    }
    const sw = C.gate.switching(Object.assign({}, g, { Vsw: v.uin, Uout: v.uin, I: v.i }));
    if (!sw || sw.ok === false) return GRAU('Die Anlage ist mit diesen Werten nicht rechenbar: ' + (sw && sw.why || 'Eingabe'));
    let dt = null;
    if (v.halbbruecke) {
      const c2 = Object.assign({}, g, { tot: v.ton * 1e-9 });
      if (v.toff > 0) c2.tOffHi = v.toff * 1e-9;
      dt = C.gate.deadtime(c2);
      if (dt && dt.ok === false) dt = null;
    }
    const resv = drv.reserve, pct = sw.anteil * 100;
    let a;
    const d = [];
    if (dt && dt.querstrom) a = AMP(false, 'rot', 'Überlappung der Gates: Die Totzeit ' + fmtEng(dt.tot, 's') + ' ist kürzer als die Ausschaltzeit ' + fmtEng(dt.tOff, 's') + ', beide Schalter leiten ' + fmtEng(dt.tUeber, 's') + ' gleichzeitig (Querstrom).');
    else {
      const w = [];
      if (drv.knapp) w.push('U_G liegt nur ' + fmtEng(resv, 'V') + ' über dem Plateau (unter 2 V Reserve, Lehrfaustwert).');
      if (sw.diag.some(function (x) { return x.id === 'schaltverlust-gross'; })) w.push('P_sw = ' + fmtEng(sw.Psw, 'W') + ' beträgt ' + fmt(pct, 2) + ' % von P_ab (Lehrfaustwert: über 1 % ist gelb).');
      if (w.length) a = AMP(false, 'gelb', w.join(' '), sw.anteil > 0 ? 0.01 / sw.anteil : undefined);
      else a = AMP(true, 'gruen', 'U_G liegt ' + fmtEng(resv, 'V') + ' über dem Plateau (mindestens 2 V Reserve) und P_sw = ' + fmtEng(sw.Psw, 'W') + ' bleibt unter 1 % von P_ab (' + fmt(pct, 2) + ' %, Lehrfaustwerte).' + (dt ? ' Die Totzeit ' + fmtEng(dt.tot, 's') + ' ist länger als die Ausschaltzeit ' + fmtEng(dt.tOff, 's') + ', es gibt keinen Querstrom.' : ''), sw.anteil > 0 ? 0.01 / sw.anteil : undefined);
    }
    if (dt && dt.querstrom) d.push(M('querstrom', 'error', { tot: fmtEng(dt.tot, 's'), toff: fmtEng(dt.tOff, 's'), tueber: fmtEng(dt.tUeber, 's') }, { wert: dt.tot, grenze: dt.tOff, gegenprobe: 'Gegenprobe: t_Off = Q_g / I_g,off = ' + fmtEng(dt.tOff, 's') + '; Totzeit − t_Off = ' + fmtEng(dt.reserve, 's') + ' (negativ heißt Überlappung).' }));
    if (drv.knapp) d.push({ id: 'ug-knapp', kind: 'warn', text: drv.diag.length ? drv.diag[0].text : 'Die Gate-Spannung liegt nur knapp über der Plateauspannung.', wert: resv, grenze: 2, gegenprobe: 'Gegenprobe: U_G − U_plat = ' + fmtEng(v.ug, 'V') + ' − ' + fmtEng(Uplat, 'V') + ' = ' + fmtEng(resv, 'V') + ' (Reserve mindestens 2 V).' });
    sw.diag.forEach(function (m) { if (m.id === 'schaltverlust-gross') d.push({ id: m.id, kind: m.kind || 'warn', text: m.text, link: m.link, wert: pct, grenze: 1, gegenprobe: 'Gegenprobe: P_sw = ½ · U · I · (t_R + t_F) · f = ' + fmtEng(sw.Psw, 'W') + '; P_ab = U · I = ' + fmtEng(sw.Pab, 'W') + '; Anteil ' + fmt(pct, 2) + ' %.' }); });
    return { a: a, d: d, r: { drv: drv, sw: sw, dt: dt } };
  }

  /* ---------------- regel ---------------- */
  function anRegel(v) {
    const L = LV;
    if (v.modus === 'labor') {
      const cv = C.lab.cvcc({ Uset: v.uset, Iset: v.iset, Rlast: v.rlast });
      if (!cv || cv.ok === false) return GRAU(cv && cv.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
      const il = C.lab.ilim({ Rs: v.rs });
      const d = [];
      const m = M(cv.modus === 'CC' ? 'cc-aktiv' : 'cv-aktiv', 'info', { r: fmtEng(v.rlast, 'Ω'), rkrit: fmtEng(cv.Rkrit, 'Ω'), iset: fmtEng(v.iset, 'A'), uset: fmtEng(v.uset, 'V'), uout: fmtEng(cv.Uout, 'V'), iout: fmtEng(cv.Iout, 'A') },
        { wert: v.rlast, grenze: cv.Rkrit, gegenprobe: 'Gegenprobe: R_krit = U_set / I_set = ' + fmtEng(v.uset, 'V') + ' / ' + fmtEng(v.iset, 'A') + ' = ' + fmtEng(cv.Rkrit, 'Ω') + '; R_last ' + (cv.modus === 'CC' ? 'liegt darunter' : 'liegt darüber oder gleich') + '.' });
      d.push(m);
      let a;
      if (v.erwartet && v.erwartet !== cv.modus) a = AMP(false, 'rot', 'Falsch gesetzt: Erwartet ist ' + v.erwartet + ', das Labornetzteil arbeitet in ' + cv.modus + ' (R_last = ' + fmtEng(v.rlast, 'Ω') + ', R_krit = ' + fmtEng(cv.Rkrit, 'Ω') + ').');
      else if (v.rlast === 0) a = AMP(false, 'gelb', 'Kurzschluss am Ausgang: Das Labornetzteil arbeitet in CC und liefert I_set = ' + fmtEng(v.iset, 'A') + ' bei 0 V. Beim Längsregler setzt der Regler dabei U_ein · I_set in Wärme um (Thermik-Lab).');
      else a = AMP(true, 'gruen', cv.modus + ': R_last = ' + fmtEng(v.rlast, 'Ω') + ' ' + (cv.modus === 'CC' ? 'unter' : 'über') + ' R_krit = ' + fmtEng(cv.Rkrit, 'Ω') + ', U_aus = ' + fmtEng(cv.Uout, 'V') + ', I_aus = ' + fmtEng(cv.Iout, 'A') + '.');
      return { a: a, d: d, r: { cv: cv, ilim: il } };
    }
    const offenR1 = v.offen === 'R1' || v.r1 >= L('r1_offen');
    const offen = offenR1 ? 'R1' : (v.offen === 'R2' ? 'R2' : null);
    if (!(v.r1 > 0) || !(v.r2 >= 0) || !(v.uref > 0)) return GRAU('Die Anlage ist mit diesen Werten nicht rechenbar: Teilerwiderstände und Referenzspannung prüfen.');
    const r1eff = offenR1 ? Math.min(Math.max(v.r1, 1), 1e12) : v.r1;
    const dv = C.loop.divider({ Uref: v.uref, R1: r1eff, R2: v.r2, offen: offen || undefined, Uanschlag: v.uset });
    if (!dv || dv.ok === false) return GRAU(dv && dv.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
    const Vr = isFinite(v.vr) ? v.vr : L('loop_vr'), dI = isFinite(v.lastsprung) ? v.lastsprung : L('loop_di');
    const tau = L('loop_tau'), VrEff = v.kompensation ? Vr / L('loop_komp') : Vr;
    const uset = isFinite(dv.Uaus) && dv.Uaus >= 0 ? dv.Uaus : 0;
    const st = C.loop.step({ C: L('loop_c'), Raus: L('loop_raus'), Vr: VrEff, tau: tau, dI: dI, Uset: uset });
    if (!st || st.ok === false) return GRAU(st && st.why || 'Die Anlage ist mit diesen Werten nicht rechenbar.');
    const d = [];
    if (offen === 'R1') d.push(M('r1-offen', 'error', { uref: fmtEng(v.uref, 'V') }, { wert: dv.Uaus, grenze: v.uref, gegenprobe: 'Gegenprobe: ohne R1 gibt es keinen Teiler nach Masse, die Rückkopplung sieht den Ausgang selbst: U_aus = U_ref = ' + fmtEng(v.uref, 'V') + '. Erst mit R1 gilt U_aus = U_ref · (1 + R2/R1).' }));
    if (offen === 'R2') d.push(M('r2-offen', 'error', { uanschlag: fmtEng(v.uset, 'V') }, { wert: dv.Uaus, grenze: v.uref, gegenprobe: 'Gegenprobe: ohne R2 sieht die Rückkopplung 0 V, der Ausgang steigt bis zum Anschlag (' + fmtEng(v.uset, 'V') + ' im Modell), nicht auf U_ref · (1 + R2/R1).' }));
    if (st.schwingt) d.push(M('regler-schwingt', 'error', { pm: fmt(st.pm, 0) + '°', pmmin: fmt(L('pm_min'), 0) + '°' }, { wert: st.pm, grenze: L('pm_min'), gegenprobe: 'Gegenprobe: Phasenreserve = 180° − arctan(ω_c τ) − arctan(ω_c R C) = ' + fmt(st.pm, 1) + '° bei f_c = ' + fmtEng(st.fc, 'Hz') + ' (Vr = ' + fmt(Vr, 0) + (v.kompensation ? ', kompensiert: wirksam ' + fmt(VrEff, 1) : ', unkompensiert') + ').' }));
    let a;
    const ue = st.ueber * 100, ug = L('ueberschwing');
    if (offen) a = AMP(false, 'rot', 'Der Teilerwiderstand ' + offen + ' ist offen: ' + (offen === 'R1' ? 'Der Ausgang liegt bei der Referenzspannung ' + fmtEng(v.uref, 'V') + ' (zu niedrig).' : 'Der Ausgang steigt bis zum Anschlag (zu hoch).'));
    else if (st.schwingt) a = AMP(false, 'rot', 'Der Regelkreis schwingt: Phasenreserve ' + fmt(st.pm, 0) + '° unter ' + fmt(L('pm_min'), 0) + '° (Lehrfaustwert).', st.pm / L('pm_min'));
    else if (ue > ug + 1e-9) a = AMP(false, 'gelb', 'Überschwingen ' + fmt(ue, 1) + ' % liegt über ' + fmt(ug, 0) + ' % (Lehrfaustwert).', ug / ue);
    else if (isFinite(v.tAusMax) && !(st.tAus <= v.tAusMax)) a = AMP(false, 'gelb', 'Ausregelzeit ' + fmtEng(st.tAus, 's') + ' liegt über der Vorgabe ' + fmtEng(v.tAusMax, 's') + '.');
    else a = AMP(true, 'gruen', 'Kein Schwingen (Phasenreserve ' + fmt(st.pm, 0) + '°), Überschwingen ' + fmt(ue, 1) + ' %, Ausregelzeit ' + fmtEng(st.tAus, 's') + ', U_aus = ' + fmtEng(dv.Uaus, 'V') + ' (Lehrmodell, Übungswerte).', st.pm / L('pm_min'));
    return { a: a, d: d, r: { dv: dv, st: st, offen: offen } };
  }

  /* ---------------- fehler ---------------- */
  function anFehler(v) {
    const fid = v.fehler;
    if (!fid) return { a: AMP(false, 'grau', 'Es ist kein Fehler eingebaut.'), d: [], r: null };
    const cat = FTMAP[fid];
    if (!cat) return GRAU('Den Fehler „' + fid + '“ gibt es nicht.');
    const netz = v.netz || cat[4][0];
    if (cat[4].indexOf(netz) < 0) return GRAU('Der Fehler „' + fid + '“ kommt am Netzteil „' + netz + '“ nicht vor.');
    const bt = bauteilOf(fid, netz);
    const st = newState(netz, fid, null, 1);
    const cur = evalNet(st), ref = evalNet(Object.assign({}, st, { fehler: null }));
    const wichtig = [];
    if (cur.ok && ref.ok) PT_ORDER.forEach(function (p) { if (PT[p].netz.indexOf(netz) >= 0 && differs(cur.P[p], ref.P[p])) wichtig.push(p); });
    const clicks = v.clicks.filter(isStr), tausch = [];
    clicks.forEach(function (c) { const m = /^tausche:(.+)$/.exec(c); if (m) tausch.push(m[1]); });
    v.getauscht.forEach(function (b) { if (isStr(b)) tausch.push(b); });
    const falsch = tausch.filter(function (b) { return b !== bt; });
    const gemessen = clicks.filter(function (c) { return /^messe:/.test(c); }).map(function (c) { return c.slice(6); });
    const begruendet = v.begruendung || gemessen.some(function (p) { return wichtig.indexOf(p) >= 0; });
    const d = [];
    const ord = fault.order(clicks);
    if (ord && ord.ok && ord.abweichung) d.push({ id: 'fehler-reihenfolge', kind: 'info', text: ord.text, wert: STEPS.indexOf(ord.abweichung.ist), grenze: STEPS.indexOf(ord.abweichung.soll), gegenprobe: 'Gegenprobe: Empfohlen ist ' + STEPS.map(function (x) { return STEP_NAMES[x]; }).join(', ') + '; zuerst fehlte „' + STEP_NAMES[ord.abweichung.soll] + '“.' });
    let a;
    if (falsch.length) {
      const nm = PART_NAMES[falsch[0]] || falsch[0];
      d.push(M('fehler-getauscht', 'error', { bauteil: nm }, { gegenprobe: 'Gegenprobe: Defekt war „' + (PART_NAMES[bt] || bt) + '“; getauscht wurde „' + nm + '“.' }));
      a = AMP(false, 'rot', 'Das Bauteil „' + nm + '“ war nicht defekt und ist getauscht worden: Der Fehler bleibt.');
    } else if (!v.diagnose) a = AMP(false, 'grau', 'Noch keine Diagnose abgegeben (' + gemessen.length + ' Messung' + (gemessen.length === 1 ? '' : 'en') + ').');
    else if (v.diagnose === fid) a = begruendet ? AMP(true, 'gruen', 'Fehler gefunden und mit einer Messung am typischen Messpunkt begründet.') : AMP(false, 'gelb', 'Fehler gefunden, aber die Begründung fehlt: Miss einen Messpunkt, der den Fehler zeigt (' + wichtig.slice(0, 3).map(function (p) { return PT[p].name; }).join(', ') + ').');
    else {
      const dg = FTMAP[v.diagnose];
      d.push(M('fehler-falsch', 'error', { diagnose: dg ? dg[1] : v.diagnose, fehler: cat[1], hinweis: 'Prüfe die Messpunkte: ' + wichtig.slice(0, 3).map(function (p) { return PT[p].name; }).join(', ') + '.' }, { gegenprobe: 'Gegenprobe: Zum eingebauten Fehler ändern sich ' + wichtig.length + ' Messpunkte, zur abgegebenen Diagnose passen sie nicht.' }));
      a = AMP(false, 'rot', 'Die Diagnose „' + (dg ? dg[1] : v.diagnose) + '“ passt nicht zu den Messwerten.');
    }
    return { a: a, d: d, r: { fid: fid, netz: netz, bauteil: bt, wichtig: wichtig, begruendet: begruendet, falsch: falsch } };
  }

  const ANALYZER = { trafo: anTrafo, gleich: anGleich, stabil: anStabil, buck: anBuck, topo: anTopo, gate: anGate, regel: anRegel, fehler: anFehler };
  function analyze(rigId, state) {
    const rd = readState(rigId, state);
    if (rd.err) return GRAU(rd.err);
    return ANALYZER[rigId](rd.v);
  }
  /* assess(rigId, state) -> { ok, ampel, text, margin? } ; margin nur wenn endlich */
  C.assess = S_(function (rigId, state) {
    const r = analyze(rigId, state);
    return r.a;
  });
  /* diagnose(ctx): ctx = { rigId | rig, state } -> Meldungen [{ id, kind, text, wert, grenze, gegenprobe }] */
  C.diagnose = A_(function (ctx) {
    if (!isObj(ctx)) return [];
    const id = isStr(ctx.rigId) ? ctx.rigId : (isStr(ctx.rig) ? ctx.rig : null);
    if (!id) return [];
    const st = isObj(ctx.state) ? ctx.state : (isObj(ctx.ctl) ? ctx.ctl : null);
    if (!st) return [];
    const r = analyze(id, st);
    return r.d.map(function (m) { return Object.assign({}, m); });
  });
  C.diagnose.ids = ['trafo-dc', 'trafo-einbruch', 'brumm-gross', 'brumm-100-gegen-50', 'c-zu-klein', 'einschalt-hoch', 'z-aus', 'z-p-zu-gross', 'rv-zu-klein', 'regler-dropout', 'regler-heiss', 'lm317-imin', 'lueckt', 'l-zu-klein', 'delta-i-gross',
    'sat-drossel', 'd-grenze', 'topologie-falsch', 'ug-zu-klein', 'querstrom', 'schaltverlust-gross', 'regler-schwingt', 'r1-offen', 'cc-aktiv', 'cv-aktiv', 'ungeregelt', 'fehler-reihenfolge', 'fehler-falsch'];
  C.assess.rigs = Object.keys(ANALYZER);

  /* =====================================================================================================
   *  RECHNER (formulas), SPEC 4.12. fn rechnet in SI (V, A, Ohm, W, Hz, F, H, s) und ist die einzige Quelle fuer die Uebungen (exercise) und den Pool-Abgleich.
   *  Jede Formel ruft eine Kernfunktion (ntscore.js / ntscore-sw.js) auf; ungueltig -> fn liefert NaN, run liefert { ok:false, why }.
   *  Einzige eigene Rechnung: grenzf (LC-Tiefpass), sie steht in keinem anderen Kernteil.
   * ===================================================================================================== */
  const DF = 1e5, DL = 1e-4;      // Hilfswerte fuer Tastverhaeltnisformeln (D haengt weder von f noch von L ab)
  function need(r, why) { if (r === undefined || r === null || (typeof r === 'number' && !isFinite(r))) throw why || 'Eingabe ungültig.'; return r; }
  function st(r) { if (!r || r.ok === false) throw (r && r.why) || 'Eingabe ungültig.'; return r; }
  function lossOf(Uin, Uout, Iout, f, L, extra) {
    return st(C.loss.parts(Object.assign({ kind: 'buck', Uin: Uin, Uout: Uout, Iout: Iout, f: f, L: L }, extra || {})));
  }
  /* Rechenfunktionen: Argumente in SI, Rueckgabe Zahl oder Wurf eines Textes */
  const FC = {
    uebersetzung: function (n1, n2) { return st(C.trafo.ratio({ n1: n1, n2: n2 })).ue; },
    strom1: function (I2, n1, n2) { return st(C.trafo.ratio({ n1: n1, n2: n2, iLast: I2 })).I1; },
    uklemme: function (Uleer, Ri, I) { const r = st(C.trafo.load({ U1: Uleer, n1: 1, n2: 1, ri: Ri, iLast: I })); if (!r.valid) throw r.diag[0].text; return r.U2_klemme; },
    scheitel: function (U2, nD, uf) {
      if (nD !== 1 && nD !== 2) throw 'Die Zahl der Dioden im Strompfad ist 1 (Einweg) oder 2 (Brücke).';
      return need(C.rect.peak({ topo: nD === 1 ? 'einweg' : 'bruecke', U2: U2, uf: uf }), 'Die Sekundärspannung reicht nicht über die Durchlassspannungen hinaus.');
    },
    brumm: function (I, fp, Cf) { return st(C.rect.ripple({ topo: 'einweg', f: fp, U2: 100, C: Cf * 1e6, I: I })).dU; },
    cmin: function (I, fp, dU) { return need(C.rect.cmin({ topo: 'einweg', f: fp, I: I, dU: dU }), 'Strom, Pulsfrequenz und Brummspannung müssen größer als 0 sein.') * 1e-6; },
    rcSieb: function (U1, R, Cf, fp) { return st(C.rect.rcSieb({ U1: U1, R: R, C: Cf * 1e6, fp: fp })).U2; },
    zStrom: function (Ue, Uz, Rv, Rlast) { const z = st(C.zener.stage({ Ue: Ue, Uz: Uz, Rv: Rv, Rlast: Rlast })); if (!z.leitet) throw 'Die Z-Diode leitet nicht (U_ein ≤ U_Z oder Laststrom zu groß).'; return z.Iz; },
    rvMin: function (Ue, Uz, Pmax) { return need(C.zener.rvMin({ Ue: Ue, Uz: Uz, Pmax: Pmax }), 'U_ein muss über U_Z liegen, P_max größer als 0.'); },
    pvLin: function (Uein, Uaus, I) { return need(C.lin.loss(Uein, Uaus, I), 'Ein Linearregler kann die Spannung nicht erhöhen (U_ein ≥ U_aus).'); },
    etaLin: function (Uein, Uaus, I) { return need(C.lin.eta(Uein, Uaus, I), 'Ein Linearregler kann die Spannung nicht erhöhen (U_ein ≥ U_aus, Strom größer als 0).'); },
    lm317: function (R1, R2) { return st(C.lin.lm317({ R1: R1, R2: R2 })).Uaus; },
    r2lm317: function (Uaus, R1) { return need(C.lin.r2For(Uaus, R1), 'U_aus muss mindestens 1,25 V sein, R1 größer als 0.'); },
    strombegr: function (R3) { return st(C.lin.limitT2({ R3: R3 })).Ilim; },
    dBuck: function (Uin, Uout) { return st(C.buck.ccm({ Uin: Uin, Uout: Uout, f: DF, L: DL })).D; },
    dBoost: function (Uin, Uout) { return st(C.boost.ccm({ Uin: Uin, Uout: Uout, f: DF, L: DL })).D; },
    dInvers: function (Uin, Uout) { return st(C.bb.ccm({ Uin: Uin, Uout: -Math.abs(Uout), f: DF, L: DL })).D; },
    dFlyback: function (Uin, Uout, n) { return st(C.fly.ccm({ Uin: Uin, Uout: Uout, n: n, f: DF, L: DL })).D; },
    dIL: function (Uin, Uout, f, L) { return st(C.buck.ccm({ Uin: Uin, Uout: Uout, f: f, L: L })).dIL; },
    lMin: function (Uin, Uout, f, dIL) { if (!(dIL > 0)) throw 'Die Drosselwelligkeit muss größer als 0 sein.'; return st(C.buck.ccm({ Uin: Uin, Uout: Uout, f: f, L: 1 })).dIL / dIL; },
    iKrit: function (Uin, Uout, f, L) { return st(C.buck.ccm({ Uin: Uin, Uout: Uout, f: f, L: L })).Ikrit; },
    dUc: function (Uin, Uout, f, L, Cf) { return st(C.buck.ccm({ Uin: Uin, Uout: Uout, f: f, L: L, C: Cf })).dUc; },
    pCond: function (Uin, Uout, Iout, f, L, Rds) { return lossOf(Uin, Uout, Iout, f, L, { rdson: Rds }).leitung; },
    pDiode: function (Uin, Uout, Iout, f, L, Uf) { return lossOf(Uin, Uout, Iout, f, L, { uf: Uf }).diode; },
    pSw: function (Uin, Uout, Iout, f, L, tsw) { return lossOf(Uin, Uout, Iout, f, L, { tsw: tsw }).schalt; },
    pGate: function (Qg, UG, f) { return st(C.gate.drive({ UG: UG, Qg: Qg, f: f })).PG; },
    etaSchalt: function (Pab, Pv) { return need(C.lin.eta(Pab + Pv, Pab, 1), 'Ausgangsleistung und Verlustleistung müssen größer als 0 sein.'); },
    pvSchalt: function (Uin, Uout, Iout, eta) { return st(C.loss.vsLinear({ Uin: Uin, Uout: Uout, Iout: Iout, etaSchalt: eta })).PvSchalt; },
    rKrit: function (Uset, Iset) { return st(C.lab.cvcc({ Uset: Uset, Iset: Iset, Rlast: 1 })).Rkrit; },
    grenzf: function (L, Cf) { if (!pos(L) || !pos(Cf)) throw 'L und C müssen größer als 0 sein.'; return 1 / (2 * PI * Math.sqrt(L * Cf)); }
  };
  /* [id, Name, Symbol, Ausdruck, Einheit, Argumente [key, Beschriftung, Einheit, Vorgabe], Erklaerung] */
  const FD = [
    ['uebersetzung', 'Übersetzungsverhältnis', 'ü', 'ü = N₁ / N₂', '', [['N1', 'Windungen primär', '', 1150], ['N2', 'Windungen sekundär', '', 69]], 'Das Verhältnis der Windungszahlen setzt die Spannung herab: U₁/U₂ = N₁/N₂.'],
    ['strom1', 'Primärstrom', 'I₁', 'I₁ = I₂ · N₂ / N₁', 'A', [['I2', 'Sekundärstrom', 'A', 2.5], ['N1', 'Windungen primär', '', 1150], ['N2', 'Windungen sekundär', '', 69]], 'Die Ströme verhalten sich umgekehrt wie die Windungszahlen (idealer Transformator, Pool F2021-N04).'],
    ['uklemme', 'Klemmenspannung unter Last', 'U_klemme', 'U_klemme = U_leer − I · R_i', 'V', [['Uleer', 'Leerlaufspannung', 'V', 13.8], ['Ri', 'Innenwiderstand', 'Ω', 0.4], ['I', 'Laststrom', 'A', 2.5]], 'Der Innenwiderstand lässt die Klemmenspannung unter Last sinken.'],
    ['scheitel', 'Scheitelwert hinter den Dioden', 'Û', 'Û = U · √2 − n_D · U_F', 'V', [['U2', 'Sekundärspannung (Effektivwert)', 'V', 12], ['nD', 'Dioden im Strompfad', '', 2], ['Uf', 'Durchlassspannung je Diode', 'V', 0.7]], 'In der Brücke liegen zwei Dioden im Strompfad, beim Einweggleichrichter eine (Pool F2020-N25).'],
    ['brumm', 'Brummspannung', 'ΔU', 'ΔU = I / (f_p · C)', 'V', [['I', 'Laststrom', 'A', 0.5], ['fp', 'Pulsfrequenz', 'Hz', 100], ['C', 'Ladekondensator', 'F', 0.0022]], 'Lehrnäherung für Sägezahnbrumm: proportional zum Strom, umgekehrt proportional zu Pulsfrequenz und Kapazität (Pool H2024-10).'],
    ['cmin', 'Kleinster Ladekondensator', 'C_min', 'C = I / (f_p · ΔU)', 'F', [['I', 'Laststrom', 'A', 0.5], ['fp', 'Pulsfrequenz', 'Hz', 100], ['dU', 'zulässige Brummspannung', 'V', 1]], 'Die Brummformel nach C umgestellt.'],
    ['rcSieb', 'Brumm nach dem RC-Glied', 'U₂', 'U₂ = U₁ · X_C / √(R² + X_C²), X_C = 1/(2π f_p C)', 'V', [['U1', 'Brumm vor dem RC-Glied', 'V', 3], ['R', 'Widerstand', 'Ω', 470], ['C', 'Kondensator', 'F', 0.001], ['fp', 'Pulsfrequenz', 'Hz', 100]], 'Spannungsteiler aus Widerstand und Blindwiderstand (Pool W2021-N44).'],
    ['zStrom', 'Strom durch die Z-Diode', 'I_Z', 'I_Z = (U_ein − U_Z)/R_V − U_Z/R_last', 'A', [['Ue', 'Eingangsspannung', 'V', 12], ['Uz', 'Z-Spannung', 'V', 5.1], ['Rv', 'Vorwiderstand', 'Ω', 470], ['Rlast', 'Lastwiderstand', 'Ω', 4700]], 'Gesamtstrom minus Laststrom (Pool S2025-30).'],
    ['rvMin', 'Kleinster Vorwiderstand', 'R_V,min', 'R_V,min = (U_ein,max − U_Z) · U_Z / P_max', 'Ω', [['Ue', 'größte Eingangsspannung', 'V', 24], ['Uz', 'Z-Spannung', 'V', 12], ['Pmax', 'zulässige Verlustleistung', 'W', 0.6]], 'Im Leerlauf trägt die Z-Diode den ganzen Strom (Pool F2020-N22).'],
    ['pvLin', 'Verlustleistung Linearregler', 'P_V', 'P_V = (U_ein − U_aus) · I', 'W', [['Uein', 'Eingangsspannung', 'V', 14], ['Uaus', 'Ausgangsspannung', 'V', 5], ['I', 'Laststrom', 'A', 0.6]], 'Die Differenzspannung mal Strom wird im Regler zu Wärme (Pool H2026-20).'],
    ['etaLin', 'Wirkungsgrad Linearregler', 'η', 'η = U_aus / U_ein', '', [['Uein', 'Eingangsspannung', 'V', 14], ['Uaus', 'Ausgangsspannung', 'V', 5], ['I', 'Laststrom', 'A', 0.6]], 'Beim Linearregler ist der Wirkungsgrad das Spannungsverhältnis (Ruhestrom vernachlässigt).'],
    ['lm317', 'Ausgangsspannung LM317', 'U_aus', 'U_aus = 1,25 V · (1 + R2/R1)', 'V', [['R1', 'R1 (Ausgang nach Adjust)', 'Ω', 240], ['R2', 'R2 (Adjust nach Masse)', 'Ω', 970]], 'Adjust-Strom vernachlässigt (Pool H2025-23).'],
    ['r2lm317', 'R2 für den LM317', 'R2', 'R2 = R1 · (U_aus/1,25 V − 1)', 'Ω', [['Uaus', 'Ausgangsspannung', 'V', 9], ['R1', 'R1', 'Ω', 240]], 'Die Formel nach R2 umgestellt (Pool W2025-13).'],
    ['strombegr', 'Begrenzungsstrom', 'I_lim', 'I_lim = U_BE / R3', 'A', [['R3', 'Messwiderstand', 'Ω', 0.6]], 'Der zweite Transistor leitet bei etwa 0,7 V und nimmt dem Längstransistor den Basisstrom (Pool W2024-23).'],
    ['dBuck', 'Tastverhältnis Tiefsetzsteller', 'D', 'D = U_aus / U_ein', '', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5]], 'Ideal, nicht lückend. Im Pool nicht belegt (Frage F17).'],
    ['dBoost', 'Tastverhältnis Hochsetzsteller', 'D', 'D = 1 − U_ein / U_aus', '', [['Uin', 'Eingangsspannung', 'V', 5], ['Uout', 'Ausgangsspannung', 'V', 12]], 'Ideal, nicht lückend. Im Pool nicht belegt (Frage F17).'],
    ['dInvers', 'Tastverhältnis Inverswandler', 'D', 'D = |U_aus| / (U_ein + |U_aus|)', '', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung (Betrag)', 'V', 5]], 'Ideal, nicht lückend. Im Pool nicht belegt (Frage F17).'],
    ['dFlyback', 'Tastverhältnis Sperrwandler', 'D', 'D = U_aus / (U_aus + n · U_ein)', '', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['n', 'Übersetzung N₂/N₁', '', 1]], 'Ideal, nicht lückend, n = N₂/N₁. Im Pool nicht belegt (Frage F17).'],
    ['dIL', 'Drosselwelligkeit Tiefsetzsteller', 'ΔI_L', 'ΔI_L = (U_ein − U_aus) · D / (f · L)', 'A', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001]], 'Spitze-Spitze-Stromschwankung in der Drossel; beim Hochsetzsteller gilt ein anderer Vorfaktor (U_ein statt U_ein − U_aus).'],
    ['lMin', 'Kleinste Drossel', 'L_min', 'L = (U_ein − U_aus) · D / (f · ΔI_L)', 'H', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['f', 'Schaltfrequenz', 'Hz', 100000], ['dIL', 'zulässige Drosselwelligkeit', 'A', 0.3]], 'Die Welligkeitsformel nach L umgestellt.'],
    ['iKrit', 'Grenzstrom zum Lückbetrieb', 'I_krit', 'I_krit = ΔI_L / 2', 'A', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001]], 'Unter diesem Ausgangsstrom lückt der Tiefsetzsteller (Drosselstrom fällt auf null).'],
    ['dUc', 'Ausgangswelligkeit (Kapazitätsanteil)', 'ΔU_C', 'ΔU_C = ΔI_L / (8 · f · C)', 'V', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001], ['C', 'Ausgangskondensator', 'F', 0.0001]], 'Der ESR-Anteil kommt hinzu (nicht in dieser Formel).'],
    ['pCond', 'Leitverlust des Schalters', 'P_cond', 'P = R_ds,on · D · I_rms²', 'W', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['Iout', 'Ausgangsstrom', 'A', 1], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001], ['Rds', 'R_ds,on', 'Ω', 0.05]], 'I_rms² = I² + ΔI²/12 (Dreieckanteil), R_ds,on ist ein Übungswert.'],
    ['pDiode', 'Diodenverlust', 'P_D', 'P = U_F · I_D,mittel', 'W', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['Iout', 'Ausgangsstrom', 'A', 1], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001], ['Uf', 'Durchlassspannung', 'V', 0.4]], 'Die Diode führt den Strom in der Ausschaltphase (1 − D).'],
    ['pSw', 'Schaltverlust', 'P_sw', 'P = ½ · U · I · (t_r + t_f) · f', 'W', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['Iout', 'Ausgangsstrom', 'A', 1], ['f', 'Schaltfrequenz', 'Hz', 100000], ['L', 'Drossel', 'H', 0.0001], ['tsw', 't_r + t_f', 's', 4e-8]], 'Wächst mit der Schaltfrequenz; Zeiten sind Übungswerte, Datenblatt maßgeblich.'],
    ['pGate', 'Gate-Verlust', 'P_G', 'P = Q_g · U_G · f', 'W', [['Qg', 'Gate-Ladung', 'C', 2e-8], ['UG', 'Gate-Spannung', 'V', 10], ['f', 'Schaltfrequenz', 'Hz', 100000]], 'Unabhängig von der Last, wächst mit der Schaltfrequenz.'],
    ['etaSchalt', 'Wirkungsgrad Schaltregler', 'η', 'η = P_ab / (P_ab + P_V)', '', [['Pab', 'abgegebene Leistung', 'W', 2], ['Pv', 'Verlustleistung', 'W', 0.273]], 'Abgegebene durch zugeführte Leistung.'],
    ['pvSchalt', 'Verlustleistung Schaltregler', 'P_V', 'P_V = P_ab · (1/η − 1)', 'W', [['Uin', 'Eingangsspannung', 'V', 12], ['Uout', 'Ausgangsspannung', 'V', 5], ['Iout', 'Ausgangsstrom', 'A', 0.4], ['eta', 'Wirkungsgrad (0 bis 1)', '', 0.88]], 'Pool W2023-09: 2 W Ausgangsleistung bei 88 % ergeben 0,273 W.'],
    ['rKrit', 'Grenzwiderstand Labornetzteil', 'R_krit', 'R_krit = U_set / I_set', 'Ω', [['Uset', 'eingestellte Spannung', 'V', 12], ['Iset', 'eingestellter Strom', 'A', 1]], 'Ab diesem Lastwiderstand abwärts arbeitet das Labornetzteil in CC.'],
    ['grenzf', 'Grenzfrequenz LC-Tiefpass', 'f₀', 'f₀ = 1 / (2π · √(L · C))', 'Hz', [['L', 'Induktivität', 'H', 0.00022], ['C', 'Kapazität', 'F', 1e-7]], 'Pool S2020-N26: 220 µH und 100 nF ergeben 33,9 kHz.']
  ];
  const formulas = FD.map(function (r) {
    const id = r[0], calc = FC[id];
    const args = r[5].map(function (a) { return { key: a[0], label: a[1], unit: a[2], def: a[3] }; });
    const fnx = function () {
      try {
        for (let i = 0; i < arguments.length; i++) if (typeof arguments[i] !== 'number' || !isFinite(arguments[i]) || Math.abs(arguments[i]) > 1e12) return NaN;
        if (arguments.length < args.length) return NaN;
        const v = calc.apply(null, arguments);
        return typeof v === 'number' && isFinite(v) ? v : NaN;
      } catch (e) { return NaN; }
    };
    const run = function () {
      const a = arguments;
      try {
        if (a.length < args.length) return { ok: false, value: NaN, why: 'Es fehlen Eingaben (' + args.map(function (x) { return x.key; }).join(', ') + ').' };
        for (let i = 0; i < a.length; i++) if (typeof a[i] !== 'number' || !isFinite(a[i]) || Math.abs(a[i]) > 1e12) return { ok: false, value: NaN, why: 'Die Eingabe „' + (args[i] ? args[i].key : i) + '“ ist keine gültige Zahl.' };
        const v = calc.apply(null, a);
        if (typeof v !== 'number' || !isFinite(v)) return { ok: false, value: NaN, why: 'Das Ergebnis ist nicht rechenbar.' };
        return { ok: true, value: v, why: '' };
      } catch (e) { return { ok: false, value: NaN, why: typeof e === 'string' ? e : 'Die Eingaben sind ungültig.' }; }
    };
    return { id: id, name: r[1], symbol: r[2], expr: r[3], unit: r[4], args: args, fn: fnx, run: run, explain: r[6] };
  });
  C.formulas = formulas;
  hide(formulas, 'get', function (id) { for (let i = 0; i < formulas.length; i++) if (formulas[i].id === id) return formulas[i]; return null; });

  /* =====================================================================================================
   *  UEBUNGEN (exercise), SPEC 4.12: gerundete Zufallswerte aus rng(seed), steps aus derselben Rechnung wie value, check mit eigenen Texten
   * ===================================================================================================== */
  const KINDS = ['uebersetzung', 'strom1', 'scheitel', 'brumm', 'cmin', 'zStrom', 'rvMin', 'pvLin', 'etaLin', 'lm317', 'r2lm317', 'dBuck', 'dBoost', 'dIL', 'lMin', 'etaSchalt', 'pvSchalt', 'rKrit', 'grenzf'];
  const VOLT = [3.3, 5, 9, 12, 15, 24];
  const E6C = [47, 68, 100, 150, 220, 330, 470, 680, 1000, 1500, 2200, 3300, 4700, 6800, 10000];      // µF
  const E6L = [22, 33, 47, 68, 100, 150, 220, 330, 470];                                               // µH
  const BASE_OK = { V: 1, A: 1, W: 1, Hz: 1, F: 1, H: 1, 'Ω': 1, s: 1, '%': 1 };
  function rnd1(x, d) { const p = Math.pow(10, d); return Math.round(x * p) / p; }
  /* Aufgabenbeschreibung: mk gibt { question, given, si, unit (Anzeige), scale (si = Anzeige*scale), base, tol, alt:[{si,text}], wrong:[{id,si,text}], steps:[...] } */
  function mkEx(kind, R) {
    const pick = function (a) { return a[R.int(0, a.length - 1)]; };
    const tolR = LV('tol_rechnen') / 100, tolE = LV('tol_eta') / 100;
    const o = { alt: [], wrong: [], steps: [], tol: tolR };
    const f2 = function (x, u) { return fmtEng(x, u); };
    switch (kind) {
      case 'uebersetzung': {
        const n1 = pick([690, 920, 1150, 1380, 1840, 2300]), n2 = pick([23, 34, 46, 69, 92]);
        const v = FC.uebersetzung(n1, n2);
        o.question = 'Ein Transformator hat primär N1 = ' + n1 + ' Windungen und sekundär N2 = ' + n2 + ' Windungen. Berechne das Übersetzungsverhältnis ü = N1/N2.';
        o.given = { N1: n1, N2: n2 }; o.si = v; o.unit = ''; o.scale = 1; o.base = '';
        o.wrong.push({ id: 'kehrwert', si: n2 / n1, text: 'Du hast N2/N1 gerechnet: Das Übersetzungsverhältnis ist N1/N2 (primär durch sekundär).' });
        o.steps = ['ü = N1 / N2', 'ü = ' + n1 + ' / ' + n2, 'ü = ' + fmt(v, 2)];
        break;
      }
      case 'strom1': {
        const n1 = pick([920, 1150, 1380, 1840]), n2 = pick([23, 46, 69, 92]), i2 = rnd1(0.5 + R.int(0, 25) / 10, 1);
        const v = FC.strom1(i2, n1, n2);
        o.question = 'Ein idealer Transformator hat primär N1 = ' + n1 + ' Windungen und sekundär N2 = ' + n2 + ' Windungen. Sekundärseitig fließen ' + f2(i2, 'A') + '. Wie groß ist der Primärstrom in mA?';
        o.given = { N1: n1, N2: n2, I2: i2 }; o.si = v; o.unit = 'mA'; o.scale = 1e-3; o.base = 'A';
        o.wrong.push({ id: 'verhaeltnis-verkehrt', si: i2 * n1 / n2, text: 'Die Ströme verhalten sich umgekehrt wie die Windungszahlen: I1 = I2 · N2/N1, nicht I2 · N1/N2.' });
        o.steps = ['I1 / I2 = N2 / N1', 'I1 = I2 · N2 / N1 = ' + f2(i2, 'A') + ' · ' + n2 + ' / ' + n1, 'I1 = ' + f2(v, 'A')];
        break;
      }
      case 'scheitel': {
        const u2 = pick([6, 9, 12, 15, 18, 24]), brueck = R.next() < 0.7, nD = brueck ? 2 : 1, uf = LV('uf_si');
        const v = FC.scheitel(u2, nD, uf);
        o.question = 'Ein ' + (brueck ? 'Brückengleichrichter (B2)' : 'Einweggleichrichter') + ' mit Ladekondensator wird aus einem Transformator mit ' + f2(u2, 'V') + ' Sekundärspannung (Effektivwert) gespeist. Je Diode beträgt die Durchlassspannung ' + f2(uf, 'V') + '. Berechne die Spitzenspannung am Ladekondensator bei vernachlässigbarer Last.';
        o.given = { U2: u2, nD: nD, UF: uf }; o.si = v; o.unit = 'V'; o.scale = 1; o.base = 'V';
        const ohne = u2 * Math.SQRT2;
        o.wrong.push({ id: 'ohne-diode', si: ohne, text: 'Die Durchlassspannung der Dioden fehlt: Û = U · √2 − n_D · U_F.' });
        o.wrong.push({ id: 'effektiv', si: u2 - nD * uf, text: 'Du hast den Effektivwert statt des Scheitelwerts genommen: Û = U · √2 − n_D · U_F.' });
        if (brueck) o.wrong.push({ id: 'eine-diode', si: ohne - uf, text: 'Nur eine Diode abgezogen: In der Brücke liegen zwei Dioden im Strompfad (2 · U_F).' });
        else o.wrong.push({ id: 'zwei-dioden', si: ohne - 2 * uf, text: 'Zwei Dioden abgezogen: Beim Einweggleichrichter liegt nur eine Diode im Strompfad.' });
        o.steps = ['Û = U · √2 − n_D · U_F', 'Û = ' + f2(u2, 'V') + ' · 1,414 − ' + nD + ' · ' + f2(uf, 'V'), 'Û = ' + f2(v, 'V')];
        break;
      }
      case 'brumm': {
        let u2 = 12, I, Cc, topo, v, fp;
        for (let k = 0; k < 50; k++) {
          I = rnd1(0.1 + R.int(0, 19) / 10, 1); Cc = pick(E6C); topo = R.next() < 0.6 ? 'bruecke' : 'einweg'; fp = C.rect.fp(topo, 50);
          v = FC.brumm(I, fp, Cc / 1e6);
          if (v <= 0.15 * C.rect.peak({ topo: topo, U2: u2, uf: LV('uf_si') })) break;
        }
        o.question = 'Ein ' + (topo === 'bruecke' ? 'Brückengleichrichter' : 'Einweggleichrichter') + ' an 50 Hz Netzfrequenz lädt einen Ladekondensator mit C = ' + f2(Cc / 1e6, 'F') + ' und versorgt eine Last mit ' + f2(I, 'A') + '. Berechne die Brummspannung ΔU (Spitze-Spitze) mit ΔU = I/(f · C).';
        o.given = { I: I, C: Cc / 1e6, topo: topo, fp: fp }; o.si = v; o.unit = 'V'; o.scale = 1; o.base = 'V';
        const fpW = topo === 'bruecke' ? 50 : 100;
        o.wrong.push({ id: 'pulsfrequenz', si: FC.brumm(I, fpW, Cc / 1e6), text: topo === 'bruecke' ? 'Du hast mit 50 Hz gerechnet: Die Brücke lädt zweimal je Netzperiode, die Pulsfrequenz ist 100 Hz.' : 'Du hast mit 100 Hz gerechnet: Der Einweggleichrichter lädt nur einmal je Netzperiode, die Pulsfrequenz ist 50 Hz.' });
        o.steps = ['Pulsfrequenz f_p = ' + (topo === 'bruecke' ? '2 · 50 Hz = 100 Hz' : '50 Hz'), 'ΔU = I / (f_p · C) = ' + f2(I, 'A') + ' / (' + f2(fp, 'Hz') + ' · ' + f2(Cc / 1e6, 'F') + ')', 'ΔU = ' + f2(v, 'V')];
        break;
      }
      case 'cmin': {
        const I = rnd1(0.2 + R.int(0, 18) / 10, 1), dU = pick([0.5, 1, 1.5, 2]), topo = R.next() < 0.6 ? 'bruecke' : 'einweg', fp = C.rect.fp(topo, 50);
        const v = FC.cmin(I, fp, dU);
        o.question = 'Ein ' + (topo === 'bruecke' ? 'Brückengleichrichter' : 'Einweggleichrichter') + ' an 50 Hz Netzfrequenz soll ' + f2(I, 'A') + ' liefern. Die Brummspannung darf höchstens ' + f2(dU, 'V') + ' betragen. Wie groß muss der Ladekondensator mindestens sein (in µF)?';
        o.given = { I: I, dU: dU, topo: topo, fp: fp }; o.si = v; o.unit = 'µF'; o.scale = 1e-6; o.base = 'F';
        o.wrong.push({ id: 'pulsfrequenz', si: FC.cmin(I, topo === 'bruecke' ? 50 : 100, dU), text: topo === 'bruecke' ? 'Du hast mit 50 Hz gerechnet: Die Brücke hat die Pulsfrequenz 100 Hz.' : 'Du hast mit 100 Hz gerechnet: Der Einweggleichrichter hat die Pulsfrequenz 50 Hz.' });
        o.steps = ['f_p = ' + f2(fp, 'Hz'), 'C = I / (f_p · ΔU) = ' + f2(I, 'A') + ' / (' + f2(fp, 'Hz') + ' · ' + f2(dU, 'V') + ')', 'C = ' + f2(v, 'F')];
        break;
      }
      case 'zStrom': {
        let ue, uz, rv, rl, v;
        for (let k = 0; k < 50; k++) {
          ue = pick([9, 12, 15, 24]); uz = pick([3.3, 5.1, 6.8, 9.1]); rv = pick([220, 330, 470, 680, 1000]); rl = pick([1000, 2200, 4700, 10000]);
          try { v = FC.zStrom(ue, uz, rv, rl); if (v > 0.002) break; } catch (e) { v = NaN; }
        }
        o.question = 'Eine Z-Diode (U_Z = ' + f2(uz, 'V') + ') wird aus ' + f2(ue, 'V') + ' über einen Vorwiderstand von ' + f2(rv, 'Ω') + ' gespeist. Parallel zur Z-Diode liegt ein Lastwiderstand von ' + f2(rl, 'Ω') + '. Wie groß ist der Strom durch die Z-Diode in mA?';
        o.given = { Ue: ue, Uz: uz, Rv: rv, Rlast: rl }; o.si = v; o.unit = 'mA'; o.scale = 1e-3; o.base = 'A';
        const ig = (ue - uz) / rv, il = uz / rl;
        o.wrong.push({ id: 'last-vergessen', si: ig, text: 'Das ist der Gesamtstrom durch den Vorwiderstand: Davon geht der Laststrom U_Z/R_last ab, der Rest fließt durch die Z-Diode.' });
        o.steps = ['I_ges = (U_ein − U_Z) / R_V = ' + f2(ig, 'A'), 'I_last = U_Z / R_last = ' + f2(il, 'A'), 'I_Z = I_ges − I_last = ' + f2(v, 'A')];
        break;
      }
      case 'rvMin': {
        const ue = pick([15, 18, 24, 30]), uz = pick([5.1, 6.8, 9.1, 12]), pm = pick([0.4, 0.5, 0.6, 0.9, 1.3]);
        const v = FC.rvMin(ue, uz, pm);
        o.question = 'Eine Z-Diode mit U_Z = ' + f2(uz, 'V') + ' darf höchstens ' + f2(pm, 'W') + ' Verlustleistung aufnehmen. Sie wird über einen Vorwiderstand aus einer Spannung gespeist, die bis zu ' + f2(ue, 'V') + ' ansteigt. Im Leerlauf trägt die Z-Diode den ganzen Strom. Berechne den kleinsten zulässigen Vorwiderstand.';
        o.given = { Ue: ue, Uz: uz, Pmax: pm }; o.si = v; o.unit = 'Ω'; o.scale = 1; o.base = 'Ω';
        o.wrong.push({ id: 'ue-statt-differenz', si: ue * uz / pm, text: 'Am Vorwiderstand fällt nur U_ein − U_Z ab, nicht die ganze Eingangsspannung.' });
        o.steps = ['I_Z,max = P_max / U_Z = ' + f2(pm / uz, 'A'), 'R_V,min = (U_ein,max − U_Z) / I_Z,max = ' + f2(ue - uz, 'V') + ' / ' + f2(pm / uz, 'A'), 'R_V,min = ' + f2(v, 'Ω')];
        break;
      }
      case 'pvLin': {
        let ue, ua;
        do { ue = pick([9, 12, 15, 24]); ua = pick([3.3, 5, 9, 12]); } while (ua >= ue);
        const I = rnd1(0.1 + R.int(0, 29) / 10, 1), mitIq = R.next() < 0.5, iq = LV('iq_7805');
        const v0 = FC.pvLin(ue, ua, I);
        const v = mitIq ? C.lin.loss(ue, ua, I, iq) : v0;
        o.question = 'Ein Festspannungsregler wird mit ' + f2(ue, 'V') + ' Eingangsspannung betrieben und liefert ' + f2(ua, 'V') + ' bei ' + f2(I, 'A') + ' Laststrom. ' + (mitIq ? 'Der Ruhestrom des Reglers beträgt ' + f2(iq, 'A') + ' (Übungswert). ' : 'Der Ruhestrom wird vernachlässigt. ') + 'Wie groß ist die Verlustleistung des Reglers (in W)?';
        o.given = { Uein: ue, Uaus: ua, I: I, iq: mitIq ? iq : 0 }; o.si = v; o.unit = 'W'; o.scale = 1; o.base = 'W';
        if (mitIq) o.alt.push({ si: v0, text: 'ohne Ruhestrom gerechnet (Näherung, wie im Pool)' });
        o.wrong.push({ id: 'nutzleistung', si: ua * I, text: 'Das ist die Nutzleistung U_aus · I. Der Verlust entsteht an der Differenz U_ein − U_aus.' });
        o.wrong.push({ id: 'eingangsleistung', si: ue * I, text: 'Das ist die Eingangsleistung U_ein · I. Der Verlust ist (U_ein − U_aus) · I.' });
        o.steps = ['P_V = (U_ein − U_aus) · I', 'P_V = (' + f2(ue, 'V') + ' − ' + f2(ua, 'V') + ') · ' + f2(I, 'A') + (mitIq ? ' + U_ein · I_q' : ''), 'P_V = ' + f2(v, 'W')];
        break;
      }
      case 'etaLin': {
        let ue, ua;
        do { ue = pick([9, 12, 15, 24]); ua = pick([3.3, 5, 9, 12]); } while (ua >= ue);
        const I = rnd1(0.1 + R.int(0, 19) / 10, 1);
        const v = FC.etaLin(ue, ua, I);
        o.question = 'Ein Linearregler wird mit ' + f2(ue, 'V') + ' betrieben und liefert ' + f2(ua, 'V') + ' bei ' + f2(I, 'A') + '. Der Ruhestrom wird vernachlässigt. Wie groß ist der Wirkungsgrad (in %)?';
        o.given = { Uein: ue, Uaus: ua, I: I }; o.si = v; o.unit = '%'; o.scale = 0.01; o.base = '%'; o.tol = tolE;
        o.wrong.push({ id: 'verlustanteil', si: 1 - v, text: 'Das ist der Verlustanteil. Der Wirkungsgrad ist abgegebene durch zugeführte Leistung, hier U_aus / U_ein.' });
        o.wrong.push({ id: 'verhaeltnis', si: v / 100, text: 'Du hast das Verhältnis angegeben: Gefragt ist Prozent, also mal 100.' });
        o.steps = ['η = P_ab / P_zu = U_aus · I / (U_ein · I) = U_aus / U_ein', 'η = ' + f2(ua, 'V') + ' / ' + f2(ue, 'V'), 'η = ' + fmt(v * 100, 1) + ' %'];
        break;
      }
      case 'lm317': {
        const r1 = pick([120, 220, 240, 330]), r2 = pick([330, 680, 970, 1000, 1500]);
        const v = FC.lm317(r1, r2), uref = LV('uref_317');
        o.question = 'Ein LM317 (Referenz ' + f2(uref, 'V') + ' zwischen Ausgang und Adjust) hat R1 = ' + f2(r1, 'Ω') + ' zwischen Ausgang und Adjust und R2 = ' + f2(r2, 'Ω') + ' von Adjust nach Masse. Der Adjust-Strom wird vernachlässigt. Berechne die Ausgangsspannung.';
        o.given = { R1: r1, R2: r2 }; o.si = v; o.unit = 'V'; o.scale = 1; o.base = 'V';
        o.wrong.push({ id: 'vertauscht', si: uref * (1 + r1 / r2), text: 'R1 und R2 sind vertauscht: Im Nenner steht R1 (Ausgang nach Adjust), im Zähler R2.' });
        o.wrong.push({ id: 'ohne-eins', si: uref * r2 / r1, text: 'Es fehlt die 1 in der Klammer: U_aus = 1,25 V · (1 + R2/R1).' });
        o.steps = ['U_aus = U_ref · (1 + R2/R1)', 'U_aus = ' + f2(uref, 'V') + ' · (1 + ' + f2(r2, 'Ω') + ' / ' + f2(r1, 'Ω') + ')', 'U_aus = ' + f2(v, 'V')];
        break;
      }
      case 'r2lm317': {
        const ua = pick([5, 6, 9, 12, 15]), r1 = pick([120, 240, 330]);
        const v = FC.r2lm317(ua, r1), uref = LV('uref_317');
        o.question = 'Ein LM317 (Referenz ' + f2(uref, 'V') + ') soll ' + f2(ua, 'V') + ' liefern. R1 zwischen Ausgang und Adjust beträgt ' + f2(r1, 'Ω') + ', R2 liegt zwischen Adjust und Masse. Der Adjust-Strom wird vernachlässigt. Wie groß muss R2 sein?';
        o.given = { Uaus: ua, R1: r1 }; o.si = v; o.unit = 'Ω'; o.scale = 1; o.base = 'Ω';
        o.wrong.push({ id: 'ohne-minus-eins', si: r1 * ua / uref, text: 'Es fehlt das „− 1“: R2 = R1 · (U_aus/1,25 V − 1).' });
        o.steps = ['U_aus = U_ref · (1 + R2/R1) → R2 = R1 · (U_aus/U_ref − 1)', 'R2 = ' + f2(r1, 'Ω') + ' · (' + f2(ua, 'V') + ' / ' + f2(uref, 'V') + ' − 1)', 'R2 = ' + f2(v, 'Ω')];
        break;
      }
      case 'dBuck': {
        let ui, uo;
        do { ui = pick([9, 12, 15, 24]); uo = pick([3.3, 5, 9, 12]); } while (uo >= ui);
        const v = FC.dBuck(ui, uo);
        o.question = 'Ein Tiefsetzsteller (ideal, nicht lückend) erzeugt aus ' + f2(ui, 'V') + ' eine Ausgangsspannung von ' + f2(uo, 'V') + '. Wie groß ist das Tastverhältnis D (in %)?';
        o.given = { Uin: ui, Uout: uo }; o.si = v; o.unit = '%'; o.scale = 0.01; o.base = '%'; o.tol = tolE;
        o.wrong.push({ id: 'verhaeltnis', si: v / 100, text: 'Du hast D als Verhältnis angegeben: Gefragt ist Prozent, also mal 100.' });
        o.wrong.push({ id: 'kehrwert', si: ui / uo, text: 'Du hast U_ein/U_aus gerechnet: Beim Tiefsetzsteller ist D = U_aus / U_ein, kleiner als 1.' });
        o.steps = ['D = U_aus / U_ein', 'D = ' + f2(uo, 'V') + ' / ' + f2(ui, 'V'), 'D = ' + fmt(v * 100, 2) + ' %'];
        break;
      }
      case 'dBoost': {
        let ui, uo;
        do { ui = pick([3.3, 5, 9, 12]); uo = pick([9, 12, 15, 24]); } while (uo <= ui);
        const v = FC.dBoost(ui, uo);
        o.question = 'Ein Hochsetzsteller (ideal, nicht lückend) erzeugt aus ' + f2(ui, 'V') + ' eine Ausgangsspannung von ' + f2(uo, 'V') + '. Wie groß ist das Tastverhältnis D (in %)?';
        o.given = { Uin: ui, Uout: uo }; o.si = v; o.unit = '%'; o.scale = 0.01; o.base = '%'; o.tol = tolE;
        o.wrong.push({ id: 'verhaeltnis', si: v / 100, text: 'Du hast D als Verhältnis angegeben: Gefragt ist Prozent, also mal 100.' });
        o.wrong.push({ id: 'ein-minus-d', si: ui / uo, text: 'Das ist 1 − D: Beim Hochsetzsteller ist D = 1 − U_ein / U_aus.' });
        o.steps = ['D = 1 − U_ein / U_aus', 'D = 1 − ' + f2(ui, 'V') + ' / ' + f2(uo, 'V'), 'D = ' + fmt(v * 100, 2) + ' %'];
        break;
      }
      case 'dIL': {
        let ui, uo;
        do { ui = pick([9, 12, 15, 24]); uo = pick([3.3, 5, 9]); } while (uo >= ui);
        const f = pick([20, 40, 50, 100, 150, 200]) * 1e3, L = pick(E6L) / 1e6;
        const v = FC.dIL(ui, uo, f, L), D = uo / ui;
        o.question = 'Ein Tiefsetzsteller (ideal) setzt ' + f2(ui, 'V') + ' auf ' + f2(uo, 'V') + ' herab, mit f = ' + f2(f, 'Hz') + ' und einer Drossel von ' + f2(L, 'H') + '. Berechne die Drosselwelligkeit ΔI_L (Spitze-Spitze).';
        o.given = { Uin: ui, Uout: uo, f: f, L: L }; o.si = v; o.unit = 'A'; o.scale = 1; o.base = 'A';
        o.wrong.push({ id: 'boost-vorfaktor', si: ui * D / (f * L), text: 'Du hast den Vorfaktor des Hochsetzstellers genommen (U_ein · D): Beim Tiefsetzsteller liegt U_ein − U_aus an der Drossel.' });
        o.wrong.push({ id: 'halbe-welligkeit', si: v / 2, text: 'Das ist nur die halbe Welligkeit (ΔI_L / 2, die Abweichung vom Mittelwert); gefragt ist Spitze-Spitze.' });
        o.steps = ['D = U_aus / U_ein = ' + fmt(D, 4), 'ΔI_L = (U_ein − U_aus) · D / (f · L) = ' + f2(ui - uo, 'V') + ' · ' + fmt(D, 4) + ' / (' + f2(f, 'Hz') + ' · ' + f2(L, 'H') + ')', 'ΔI_L = ' + f2(v, 'A')];
        break;
      }
      case 'lMin': {
        let ui, uo;
        do { ui = pick([9, 12, 15, 24]); uo = pick([3.3, 5, 9]); } while (uo >= ui);
        const f = pick([20, 40, 50, 100, 150, 200]) * 1e3, dI = pick([0.1, 0.2, 0.3, 0.5, 1]);
        const v = FC.lMin(ui, uo, f, dI), D = uo / ui;
        o.question = 'Ein Tiefsetzsteller setzt ' + f2(ui, 'V') + ' auf ' + f2(uo, 'V') + ' herab, f = ' + f2(f, 'Hz') + '. Die Drosselwelligkeit soll höchstens ' + f2(dI, 'A') + ' betragen. Wie groß muss die Drossel mindestens sein (in µH)?';
        o.given = { Uin: ui, Uout: uo, f: f, dIL: dI }; o.si = v; o.unit = 'µH'; o.scale = 1e-6; o.base = 'H';
        o.wrong.push({ id: 'boost-vorfaktor', si: ui * D / (f * dI), text: 'Du hast den Vorfaktor des Hochsetzstellers genommen (U_ein · D): Beim Tiefsetzsteller liegt U_ein − U_aus an der Drossel.' });
        o.steps = ['D = U_aus / U_ein = ' + fmt(D, 4), 'L = (U_ein − U_aus) · D / (f · ΔI_L) = ' + f2(ui - uo, 'V') + ' · ' + fmt(D, 4) + ' / (' + f2(f, 'Hz') + ' · ' + f2(dI, 'A') + ')', 'L = ' + f2(v, 'H')];
        break;
      }
      case 'etaSchalt': {
        const uo = pick([3.3, 5, 9, 12]), io = pick([0.5, 1, 1.5, 2, 3]), pab = uo * io, pv = rnd1(pab * pick([0.05, 0.08, 0.1, 0.15, 0.2]), 2);
        const v = FC.etaSchalt(pab, pv);
        o.question = 'Ein Schaltregler gibt ' + f2(uo, 'V') + ' bei ' + f2(io, 'A') + ' ab und hat dabei eine Verlustleistung von ' + f2(pv, 'W') + '. Wie groß ist der Wirkungsgrad (in %)?';
        o.given = { Uout: uo, Iout: io, Pv: pv }; o.si = v; o.unit = '%'; o.scale = 0.01; o.base = '%'; o.tol = tolE;
        o.wrong.push({ id: 'pab-durch-pv', si: pab / pv, text: 'Du hast P_ab / P_V gerechnet: Der Wirkungsgrad ist P_ab / (P_ab + P_V), abgegebene durch zugeführte Leistung.' });
        o.wrong.push({ id: 'verhaeltnis', si: v / 100, text: 'Du hast das Verhältnis angegeben: Gefragt ist Prozent, also mal 100.' });
        o.steps = ['P_ab = U_aus · I_aus = ' + f2(pab, 'W'), 'η = P_ab / (P_ab + P_V) = ' + f2(pab, 'W') + ' / (' + f2(pab, 'W') + ' + ' + f2(pv, 'W') + ')', 'η = ' + fmt(v * 100, 1) + ' %'];
        break;
      }
      case 'pvSchalt': {
        const ui = pick([12, 15, 24]), uo = pick([3.3, 5, 9]), io = pick([0.2, 0.4, 0.5, 1, 2]), eta = pick([0.8, 0.85, 0.88, 0.9, 0.92]);
        const v = FC.pvSchalt(ui, uo, io, eta), pab = uo * io;
        o.question = 'Ein Schaltregler mit einem Wirkungsgrad von ' + fmt(eta * 100, 0) + ' % liefert ' + f2(uo, 'V') + ' bei ' + f2(io, 'A') + ' (Eingang ' + f2(ui, 'V') + '). Wie groß ist seine Verlustleistung (in W)?';
        o.given = { Uin: ui, Uout: uo, Iout: io, eta: eta }; o.si = v; o.unit = 'W'; o.scale = 1; o.base = 'W';
        o.wrong.push({ id: 'verlust-auf-pab', si: pab * (1 - eta), text: 'Du hast P_ab · (1 − η) gerechnet: Der Verlust bezieht sich auf die zugeführte Leistung, P_V = P_ab · (1/η − 1).' });
        o.steps = ['P_ab = U_aus · I_aus = ' + f2(pab, 'W'), 'P_V = P_ab · (1/η − 1) = ' + f2(pab, 'W') + ' · (1/' + fmt(eta, 2) + ' − 1)', 'P_V = ' + f2(v, 'W')];
        o.tol = tolR;
        break;
      }
      case 'rKrit': {
        const us = pick([5, 12, 15, 24, 30]), is = pick([0.5, 1, 1.5, 2, 3]);
        const v = FC.rKrit(us, is);
        o.question = 'Ein Labornetzteil ist auf ' + f2(us, 'V') + ' und ' + f2(is, 'A') + ' eingestellt. Ab welchem Lastwiderstand (in Ω) wechselt es von der Spannungsregelung (CV) in die Stromregelung (CC)?';
        o.given = { Uset: us, Iset: is }; o.si = v; o.unit = 'Ω'; o.scale = 1; o.base = 'Ω';
        o.wrong.push({ id: 'kehrwert', si: is / us, text: 'Du hast I_set / U_set gerechnet (das ist ein Leitwert). Der Grenzwiderstand ist R_krit = U_set / I_set.' });
        o.steps = ['R_krit = U_set / I_set', 'R_krit = ' + f2(us, 'V') + ' / ' + f2(is, 'A'), 'R_krit = ' + f2(v, 'Ω')];
        break;
      }
      case 'grenzf': {
        const L = pick([100, 220, 330, 470]) / 1e6, Cc = pick([47e-9, 100e-9, 220e-9, 470e-9, 1e-6]);
        const v = FC.grenzf(L, Cc);
        o.question = 'Hinter einem Schaltregler dient ein LC-Tiefpass (L = ' + f2(L, 'H') + ', C = ' + f2(Cc, 'F') + ') zum Unterdrücken der hohen Schaltfrequenz. Wie groß ist seine Grenzfrequenz f0 (in kHz)?';
        o.given = { L: L, C: Cc }; o.si = v; o.unit = 'kHz'; o.scale = 1e3; o.base = 'Hz';
        o.wrong.push({ id: 'ohne-2pi', si: 1 / Math.sqrt(L * Cc), text: 'Es fehlt der Faktor 2π im Nenner: f0 = 1 / (2π · √(L · C)).' });
        o.wrong.push({ id: 'ohne-wurzel', si: 1 / (2 * PI * L * Cc), text: 'Die Wurzel fehlt: f0 = 1 / (2π · √(L · C)).' });
        o.steps = ['f0 = 1 / (2π · √(L · C))', 'f0 = 1 / (2π · √(' + f2(L, 'H') + ' · ' + f2(Cc, 'F') + '))', 'f0 = ' + f2(v, 'Hz')];
        break;
      }
      default: throw 'Unbekannte Art.';
    }
    return o;
  }
  function parseAnswer(ex, input) {
    let str;
    if (typeof input === 'number') { if (!isFinite(input)) return { err: 'keine Zahl' }; return { si: input * ex.scale }; }
    if (typeof input !== 'string') return { err: 'keine Zahl' };
    str = input.trim();
    if (str === '') return { err: 'keine Zahl' };
    const pu = C.parseUnit(str);
    if (!isFinite(pu.value)) return { err: 'keine Zahl' };
    let unit = pu.unit;
    if (unit === '') return { si: pu.value * ex.scale };
    if (unit === '%') return ex.base === '%' ? { si: pu.value * 0.01 } : { err: 'einheit', unit: unit };
    let factor = 1, base = unit;
    if (unit.length > 1 && pu.factor !== 1) { base = unit.slice(1); factor = pu.factor; }
    if (base === 'Ohm' || base === 'ohm') base = 'Ω';
    if (!has(BASE_OK, base)) return { err: 'einheit-unbekannt', unit: unit };
    if (base !== ex.base) return { err: 'einheit', unit: unit };
    return { si: pu.value * factor };
  }
  function rel(a, b) { return b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b); }
  function checkAnswer(ex, input) {
    try {
      const p = parseAnswer(ex, input);
      if (p.err === 'keine Zahl') return { ok: false, text: 'Das ist keine Zahl: Gib den Wert als Zahl ein, zum Beispiel 2,5 oder 2,5 ' + (ex.unit || 'V') + '.', why: 'keine-zahl' };
      if (p.err === 'einheit') return { ok: false, text: 'Die Einheit „' + p.unit + '“ passt nicht zur gesuchten Größe (gesucht: ' + (ex.unit || 'ohne Einheit') + '). Prüfe die Einheit.', why: 'einheit' };
      if (p.err === 'einheit-unbekannt') return { ok: false, text: 'Die Einheit „' + p.unit + '“ erkenne ich nicht. Lass sie weg oder schreibe sie als V, A, W, Ω, Hz, F, H, s oder mit Vorsatz (mA, µF, kHz).', why: 'einheit' };
      const si = p.si, tol = ex.tol;
      if (rel(si, ex.si) <= tol) return { ok: true, text: 'Richtig: ' + fmt(ex.si / ex.scale) + (ex.unit ? ' ' + ex.unit : '') + '.', why: '' };
      for (let i = 0; i < ex.alt.length; i++) if (rel(si, ex.alt[i].si) <= tol) return { ok: true, text: 'Richtig (' + ex.alt[i].text + ').', why: '' };
      for (let i = 0; i < ex.wrong.length; i++) if (isFinite(ex.wrong[i].si) && rel(si, ex.wrong[i].si) <= tol) return { ok: false, text: ex.wrong[i].text, why: ex.wrong[i].id };
      const q = ex.si !== 0 ? si / ex.si : NaN;
      if (isFinite(q) && q > 0) {
        const facs = [10, 100, 1000, 1e6];
        for (let i = 0; i < facs.length; i++) {
          if (rel(q, facs[i]) <= tol * 1.5) return { ok: false, text: 'Dein Wert ist um den Faktor ' + fmt(facs[i], 0) + ' zu groß: Prüfe die Einheiten (mA/A, µF/mF, kΩ/Ω).', why: 'groessenordnung' };
          if (rel(q, 1 / facs[i]) <= tol * 1.5) return { ok: false, text: 'Dein Wert ist um den Faktor ' + fmt(facs[i], 0) + ' zu klein: Prüfe die Einheiten (mA/A, µF/mF, kΩ/Ω).', why: 'groessenordnung' };
        }
      }
      if (si < ex.si) return { ok: false, text: 'Dein Wert ist zu klein. Rechne die Schritte noch einmal durch.', why: 'zu-klein' };
      return { ok: false, text: 'Dein Wert ist zu groß. Rechne die Schritte noch einmal durch.', why: 'zu-gross' };
    } catch (e) { return { ok: false, text: 'Die Eingabe konnte nicht geprüft werden.', why: 'fehler' }; }
  }
  function near(x, y, t) { return rel(x, y) <= t || rel(y, x) <= t; }
  function distinct(o) {
    const t = o.tol * 1.2;
    for (let i = 0; i < o.wrong.length; i++) {
      const w = o.wrong[i];
      if (!isFinite(w.si) || near(w.si, o.si, t)) return false;
      for (let a = 0; a < o.alt.length; a++) if (near(w.si, o.alt[a].si, t)) return false;
      for (let j = i + 1; j < o.wrong.length; j++) if (near(w.si, o.wrong[j].si, t)) return false;
    }
    return true;
  }
  const exercise = C.exercise = S_(function (kind, seed) {
    if (!isStr(kind) || KINDS.indexOf(kind) < 0) return fail('Die Übungsart „' + String(kind) + '“ gibt es nicht (' + KINDS.join(', ') + ').');
    const sd = typeof seed === 'number' && isFinite(seed) ? Math.floor(seed) : 1;
    const R = C.rng(sd * 7919 + KINDS.indexOf(kind) * 104729 + 13);
    /* Werte so lange ziehen, bis kein typischer Fehlerwert innerhalb der Toleranz des richtigen Werts liegt (sonst waere check nicht eindeutig) */
    let o = null, lastErr = '';
    for (let k = 0; k < 80 && !o; k++) {
      try { const c = mkEx(kind, R); if (isFinite(c.si) && distinct(c)) o = c; } catch (e) { lastErr = typeof e === 'string' ? e : 'Rechenfehler'; }
    }
    if (!o) return fail('Aus diesem Startwert lässt sich keine gültige Aufgabe bilden: ' + lastErr);
    if (!isFinite(o.si)) return fail('Aus diesem Startwert lässt sich keine gültige Aufgabe bilden.');
    const ex = { ok: true, kind: kind, seed: sd, question: o.question, given: o.given,
      answer: { value: o.si / o.scale, unit: o.unit, tol: o.tol, alt: o.alt.map(function (a) { return a.si / o.scale; }), si: o.si, scale: o.scale, base: o.base }, steps: o.steps.slice() };
    hide(ex, 'wrong', o.wrong.map(function (w) { return { id: w.id, si: w.si, value: w.si / o.scale, text: w.text }; }));
    ex.check = function (input) { return checkAnswer(o, input); };
    return ex;
  });
  exercise.kinds = KINDS.slice();

  /* =====================================================================================================
   *  LAEUFER runSeq, SPEC 4.13 (Signatur wie ELS_CORE.runSeq). seq = [ { t, set:{k:v} }, { t, ramp:{ key, to, durS } }, { t, fire:true }, { t, do:'sicht'|'messe:<punkt>'|'tausche:<bauteil>' } ]
   *  (do nur fuer den Pruefstand fehler). Deterministisch, wirft nie. Der Pruefstand ist ein Beharrungsmodell: step() bewegt nur die Phase, die Messwerte
   *  folgen den Steuerwerten; Rampen werden daher an den Abtast- und Ereigniszeiten gesetzt (Log-Regler logarithmisch).
   * ===================================================================================================== */
  function snapObj(o) {
    if (!isObj(o)) return o;
    const c = {};
    Object.keys(o).forEach(function (k) {
      const v = o[k];
      c[k] = isArr(v) ? v.slice() : (isObj(v) ? Object.assign({}, v) : v);
    });
    return c;
  }
  function collectKeys(list, map) {
    if (!isArr(list)) return;
    list.forEach(function (c) {
      if (c && typeof c.key === 'string') map[c.key] = c;
      if (c && isArr(c.items)) collectKeys(c.items, map);
      if (c && isArr(c.controls)) collectKeys(c.controls, map);
    });
  }
  const RIGIDS = ['trafo', 'gleich', 'stabil', 'buck', 'topo', 'gate', 'regel', 'fehler'];
  function resolveRig(rigIn, opts, out) {
    const seedOpt = isFinite(num(opts.seed, NaN)) ? num(opts.seed, 1) : undefined;
    let rig = null;
    try {
      if (typeof rigIn === 'function') rig = rigIn(seedOpt);
      else if (typeof rigIn === 'string') {
        let R = root.NTS_RIGS;
        if ((!R || !R.defs || !R.defs[rigIn]) && RIGIDS.indexOf(rigIn) >= 0) {
          tryRequire('./ntsrig-base.js'); tryRequire('./ntsrig-' + rigIn + '.js');
          R = root.NTS_RIGS;
        }
        if (R && typeof R.create === 'function' && R.defs && R.defs[rigIn]) rig = R.create(rigIn, Object.assign({}, isObj(opts.rigOpts) ? opts.rigOpts : {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(R && R.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'NTS_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && typeof rigIn.setControl === 'function') {
        rig = rigIn;
        if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    return rig;
  }
  function runSeqImpl(rigIn, seq, tEndS, opts) {
    opts = isObj(opts) ? opts : {};
    const out = { ok: true, samples: [], final: null, events: [], faults: [], assess: null, errors: [], rejected: [], actions: [], order: [] };
    const rig = resolveRig(rigIn, opts, out);
    if (!rig) { out.ok = false; if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); return out; }
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const tEnd = clamp(num(tEndS, 0), 0, 1e6);
    const nS = tEnd > 0 ? clamp(Math.round(num(opts.samples, 200)), 1, 2000) : 0;
    const rigId = isStr(rig.id) ? rig.id : (isStr(rigIn) ? rigIn : '');
    const faultSet = {};
    function addFault(id) { if (isStr(id) && !faultSet[id]) { faultSet[id] = 1; out.faults.push(id); } }
    function collect(st) { if (st && isArr(st.faults)) st.faults.forEach(addFault); }
    function setCtl(key, v) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '“ gibt es an dieser Anlage nicht.'); return; }
      let r;
      try { r = rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); return; }
      if (r === false) out.rejected.push({ key: key, value: v });
    }
    function doAction(name, t) {
      let okA = false;
      const m = /^(sicht|messe|tausche)(?::(.+))?$/.exec(name);
      if (rigId !== 'fehler' || !m || (m[1] !== 'sicht' && !m[2])) {
        out.rejected.push({ t: t, do: name, why: 'do gibt es nur für den Prüfstand fehler: sicht, messe:<punkt>, tausche:<bauteil>.' });
        return;
      }
      try {
        if (typeof rig.act === 'function') okA = rig.act(name) !== false;
        else if (m[1] === 'sicht' && typeof rig.sicht === 'function') { rig.sicht(); okA = true; }
        else if (m[1] === 'messe' && typeof rig.messe === 'function') okA = rig.messe(m[2]) !== false;
        else if (m[1] === 'tausche' && typeof rig.tausche === 'function') okA = rig.tausche(m[2]) !== false;
        else if (m[1] === 'messe') { setCtl('messpunkt', m[2]); if (typeof rig.fire === 'function') rig.fire(); okA = true; }
        else if (m[1] === 'tausche') { setCtl('tausche', m[2]); okA = true; }
        else out.errors.push('Dieser Prüfstand kennt „' + name + '“ nicht.');
      } catch (e) { out.errors.push('do(' + name + '): ' + (e && e.message)); }
      out.actions.push({ t: t, do: name, ok: okA });
      out.order.push(name);
    }
    if (isObj(opts.controls)) Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    /* Ereignisse */
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, i) {
      if (!(e && typeof e === 'object' && isFinite(num(e.t, NaN)))) { out.errors.push('Schritt ' + (i + 1) + ' hat keine gültige Zeit t.'); return; }
      q.push({ t: Math.max(0, num(e.t, 0)), set: isObj(e.set) ? e.set : null, ramp: isObj(e.ramp) ? e.ramp : null, fire: !!e.fire, act: isStr(e.do) ? e.do : null, k: i });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    /* Zeitpunkte: Abtastzeiten, Ereigniszeiten, Rampenenden */
    const sampleT = [];
    if (nS === 0) sampleT.push(0); else for (let i = 0; i <= nS; i++) sampleT.push(tEnd * i / nS);
    const pts = sampleT.map(function (t) { return { t: t, sample: true }; });
    q.forEach(function (e) {
      if (e.t <= tEnd + 1e-12) pts.push({ t: e.t, sample: false });
      if (e.ramp && isFinite(num(e.ramp.durS, NaN)) && num(e.ramp.durS, 0) > 0 && e.t + e.ramp.durS <= tEnd + 1e-12) pts.push({ t: e.t + e.ramp.durS, sample: false });
    });
    pts.sort(function (a, b) { return a.t - b.t || (a.sample ? 1 : 0) - (b.sample ? 1 : 0); });
    const ramps = {};
    let qi = 0, tPrev = 0;
    function applyRamps(t) {
      Object.keys(ramps).forEach(function (k) {
        const r = ramps[k], fr = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(k, r.log ? r.from * Math.pow(r.to / r.from, fr) : r.from + (r.to - r.from) * fr);
        if (fr >= 1) delete ramps[k];
      });
    }
    function takeSample(t) {
      let st = null, m = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      try { m = typeof rig.readMeters === 'function' ? rig.readMeters() : null; } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
      out.samples.push({ t: t, meters: snapObj(m), state: snapObj(st) });
      collect(st);
      try { if (typeof rig.diagnose === 'function') (rig.diagnose() || []).forEach(function (d) { if (d && d.kind === 'error') addFault(d.id); }); } catch (e) { /* ignorieren */ }
    }
    for (let pi = 0; pi < pts.length; pi++) {
      const P = pts[pi], t = P.t;
      if (t > tPrev + 1e-12) { try { if (typeof rig.step === 'function') rig.step((t - tPrev) * 1000); } catch (e) { out.errors.push('step(): ' + (e && e.message)); out.ok = false; break; } tPrev = t; }
      while (qi < q.length && q[qi].t <= t + 1e-12) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k]); });
        if (e.ramp && isStr(e.ramp.key)) {
          let from = NaN;
          try { from = typeof rig.getControl === 'function' ? num(rig.getControl(e.ramp.key), NaN) : NaN; } catch (er) { /* */ }
          const to = num(e.ramp.to, NaN), dur = num(e.ramp.durS, 0);
          if (!isFinite(to)) out.errors.push('Rampe für „' + e.ramp.key + '“ hat keinen Zielwert.');
          else if (!(dur > 0) || !isFinite(from)) { delete ramps[e.ramp.key]; setCtl(e.ramp.key, to); }
          else ramps[e.ramp.key] = { from: from, to: to, t0: e.t, dur: dur, log: !!(known[e.ramp.key] && known[e.ramp.key].scale === 'log' && from > 0 && to > 0) };
        }
        if (e.act) doAction(e.act, e.t);
        if (e.fire) {
          try { if (typeof rig.fire === 'function') rig.fire(); else out.errors.push('Dieser Prüfstand hat keine Auslösung (fire).'); } catch (er) { out.errors.push('fire(): ' + (er && er.message)); }
        }
      }
      applyRamps(t);
      if (P.sample) takeSample(t);
    }
    try { out.final = snapObj(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.assess = typeof rig.assess === 'function' ? snapObj(rig.assess()) : null; } catch (e) { out.errors.push('assess(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snapObj) : []; } catch (e) { /* ignorieren */ }
    if (opts.keepRig) out.rig = rig;
    return out;
  }
  C.runSeq = function () {
    try { return runSeqImpl.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], assess: null, errors: ['Interner Fehler im Läufer.'], rejected: [], actions: [], order: [] }; }
  };

  /* @@ENDE@@ */
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
