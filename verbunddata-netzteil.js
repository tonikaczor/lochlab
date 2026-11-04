/* verbunddata-netzteil.js - Verbundprojekt 6: Labornetzteil mit Längsregler (Projektdefinition, Paket P4)
 * Format laut quelle/verbund/SPEC.md, Abschnitte 4 und 9.4; fachliche Vorlage quelle/verbund-neu/P1-AUSLEGUNG.md (Abschnitt 3 und 4), SPEC-VERBUND-NEUE-PROJEKTE.md Abschnitt 5.
 * Lädt unabhängig von der Reihenfolge, auch in Node. Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE.
 * In Node liefert module.exports die Definition (def) selbst.
 * Prüfkerne (alle erst zur Prüfzeit gelesen, nie beim Laden der Datei; Liste = LAZY_CORES.netzteil in verbundbar.js): DS_CORE + DS_LIB, PCB_CORE, NTS_CORE (ntscore, -sw, -diag, Prüfstände
 * trafo, gleich, stabil, fehler), THM_CORE (Prüfstand linear), ELS_CORE (Prüfstand pruefplatz). Der Adapter verbundad-rig.js wird für die Prüfung NICHT gebraucht:
 * die Datei ruft NTS_CORE.runSeq / THM_CORE / ELS_CORE.runSeq selbst (gleiche Reihenfolge der Steuerwerte und gleiche Würfelzuordnung fSeed -> Seed wie der Adapter, Test gleicht ab).
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   rig.state     { lab, rig, ctl, seq?, T?, state, derived, meas?, <Formularwerte als Zahlen/Texte auf oberster Ebene> }
 *                 vl1 nts trafo  (ctl n1, n2, ri, iLast; Formular u2, snVA, i2eff)      vl2 nts gleich (ctl u2, topo, diode, rs, c, iLast; Formular iPeak)
 *                 vl4 nts stabil (ctl art, ue, r1, r2, t2, r3; Formular poti, rFest, schaltung, pRsW)   vl5 thm linear (ctl device, ue, ua, iLoad, heatsink, joint, paste, ...)
 *                 vl9 nts fehler (ctl netz, fehler 'zufall', seed; seq Aktionen sicht/messe/tausche; Formular begruendungText)
 *                 vl10 els pruefplatz (ctl geraet, modus, zufall, seed, anzahl; seq do-Aktionen; Formular befund1, befund2, urteil, massnahme)
 *   ds.pick       { items:[{role:'regler'|'gleichrichter', ds, part, ref}], calc:{rthJC, tjMax}, vals:{anzahlD | bruecke, cUf, unV} }
 *   sch.circuit   { lab, name, netlist, meas, snap }      pcb.board { board, report:{w,h,layers,drcErrors,drcWarns,unrouted,shorts,cost,bomCount} }
 *   mess.protocol { rows:[{id,label,unit,soll,ist,tol,instrument,tp}], values, findings }
 * Werte mit (A) sind Annahmen (Übungswerte, Tabelle FACH, Fragen F1 bis F18 in P1-AUSLEGUNG.md Abschnitt 12). */
(function (root) {
  'use strict';

  const PID = 'netzteil', K_PID = 0x6e74306c;
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = x => (Array.isArray(x) ? x : []);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const rd = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const sameVal = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-6 : rel) * Math.max(Math.abs(a), Math.abs(b), 1e-12);
  const lc = s => String(s == null ? '' : s).toLowerCase();

  /* ---------- Hash, Zufall (gleich zum Kern: FNV-1a 32 Bit, mulberry32) ---------- */
  function hash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];

  /* ---------- Kerne (erst zur Laufzeit gelesen) ---------- */
  const N_ = () => root.NTS_CORE, T_ = () => root.THM_CORE, E_ = () => root.ELS_CORE, DS = () => root.DS_CORE, LIB = () => root.DS_LIB, PCB = () => root.PCB_CORE;
  const limOf = (C, id) => { const l = C && C.limits ? C.limits.find(x => x.id === id) : null; if (!l) throw new Error('Grenzwert ' + id + ' fehlt im Kern'); return l.value; };
  const nl_ = id => limOf(N_(), id), el_ = id => limOf(E_(), id);
  const numOf = v => {                          // '4k7', '4700u', 4700, '1,2' -> Zahl, sonst NaN
    if (fin(v)) return v;
    const s = String(v == null ? '' : v).trim().replace(',', '.');
    const m = /^([-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?)\s*([kKMmuµnp]?)/.exec(s);
    return m ? parseFloat(m[1]) * ({ k: 1e3, K: 1e3, M: 1e6, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12 }[m[2]] || 1) : NaN;
  };
  const numF = x => { if (fin(x)) return x; if (x === null || x === undefined || x === '') return NaN; const v = parseFloat(String(x).replace(',', '.')); return fin(v) ? v : NaN; };

  /* ====================================================================== Fachwerte des Projekts (A = Annahme/Lehrwert, siehe P1-AUSLEGUNG.md) */
  /* Tabelle FACH: alle neuen Annahmen dieses Projekts (Status A, Frage Fx an Eric). Kernwerte (belegt oder A im Kern) stehen NICHT hier, sie kommen aus NTS_CORE.limits / ELS_CORE.limits. */
  const FACH = {
    NA1_netzTol: { v: 0.10, st: 'A', f: 'F1' }, NA2_tAmb: { v: 25, unit: '°C', st: 'A', f: 'F6' }, NA3_tjReserve: { v: 20, unit: 'K', st: 'A', f: 'F6' },
    NA4_ilminAuslegung: { v: 0.010, unit: 'A', st: 'A', f: 'F3' }, NA5_eReserve: { v: 0.025, st: 'A', f: 'F16' },
    NA6_elko: { reihe: [1000, 1500, 2200, 3300, 4700], cMax: 4700, unit: 'µF', st: 'A', f: 'F17' }, NA7_ilimFaktor: { v: 1.2, st: 'A', f: 'F3' },
    NA8_trafo: { kI2eff: 1.8, snReihe: [5, 10, 16, 25, 40, 63], u2Reihe: [12, 15, 18, 24], st: 'A', f: 'F4' }, NA9_board: { w: 80, h: 60, layers: 2, st: 'A' },
    NA10_ksFreiZulaessig: { v: true, st: 'A', f: 'F14' }, NA11_elkoUfaktor: { v: 1.2, unReihe: [16, 25, 35, 50, 63], st: 'A', f: 'F2' },
    NA12_uausMin: { v: 2.0, unit: 'V', st: 'A', f: 'F16' }, NA13_rsLeistungFaktor: { v: 2, st: 'A' }, NA14_passiv: { fan: 'aus', st: 'A' },
    NA15_lm317Rand: { v: 10, unit: 'mm', st: 'A' }, NA16_befund: { st: 'A', f: 'F18' }
  };
  const E6C = FACH.NA6_elko.reihe, U2S = FACH.NA8_trafo.u2Reihe, SNS = FACH.NA8_trafo.snReihe, UNS = FACH.NA11_elkoUfaktor.unReihe, K_I2 = FACH.NA8_trafo.kI2eff, K_IDIM = FACH.NA7_ilimFaktor.v;
  const N1 = 1150;                              // Windungszahl primär im Prüfstand-Beispiel (A, Rig-Standard)
  const COMBOS = { 1: [[12, 0.5]], 2: [[12, 0.3], [12, 0.5]], 3: [[12, 0.3], [15, 0.3]] };
  const TJ_MAX = 125;                           // THM-Katalog lm317 (Test gleicht ab); T_j-Grenze = 125 - 20 K
  const E12L = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2, 10];
  const isE12 = v => { if (!fin(v) || v <= 0) return false; let x = v; while (x >= 10 - 1e-9) x /= 10; while (x < 1 - 1e-9) x *= 10; return E12L.some(e => Math.abs(e - x) <= 1e-3 * e); };
  /* Musterlösungen M1 bis M4 (P1-AUSLEGUNG.md Abschnitt 3.3 und 10); alle Rechenwerte darunter kommen zur Laufzeit aus dem Kern, hier stehen nur die gewählten Bauteile */
  const MUSTER = [
    { id: 'M1', umax: 12, imax: 0.5, tol: 0, U2: 12, snVA: 16, C: 4700, unV: 25, R1: 120, poti: 1000, rFest: 47, schaltung: 'reihe', Rs: 1.2, pRsW: 1, thm: { heatsink: 'xl', ue: 15, iLoad: 0.6 } },
    { id: 'M2', umax: 12, imax: 0.3, tol: 0, U2: 12, snVA: 10, C: 3300, unV: 25, R1: 120, poti: 1000, rFest: 47, schaltung: 'reihe', Rs: 2.2, pRsW: 0.5, thm: { heatsink: 'm', ue: 15.5, iLoad: 0.35 } },
    { id: 'M3', umax: 12, imax: 0.3, tol: 0.1, U2: 15, snVA: 10, C: 2200, unV: 35, R1: 120, poti: 1000, rFest: 47, schaltung: 'reihe', Rs: 2.2, pRsW: 0.5, thm: { heatsink: 'l', ue: 21.5, iLoad: 0.35 } },
    { id: 'M4', umax: 15, imax: 0.3, tol: 0.1, U2: 18, snVA: 16, C: 2200, unV: 35, R1: 120, poti: 2200, rFest: 3300, schaltung: 'parallel', Rs: 2.2, pRsW: 0.5, thm: { heatsink: 'xl', ue: 26, iLoad: 0.35 } }
  ];
  const musterOf = P => MUSTER.find(m => m.umax === P.umax && m.imax === P.imax && Math.abs(m.tol - P.netzTol) < 1e-9) || MUSTER[0];
  const KATALOG = ['sicherung', 'trafo', 'gleichrichter', 'ladeelko', 'regler', 'last'];     // Bauteile, die im Fehlerprüfstand (linear) getauscht werden können

  /* ====================================================================== Fehlerwürfel (R1): nur Prüfseite */
  const fseed = n => (fin(+n) ? ((Math.abs(Math.round(+n)) + 98) % 99) + 1 : 1);          // gleich verbundad-rig.js pure.fseed (Test gleicht ab)
  const sNtsOf = P => fseed(P && P.fSeed);
  const sElsOf = P => 1 + (Math.floor(Math.abs(+(P && P.fSeed) || 0) / 99) % 99);
  const nMangelOf = (P, level) => (level === 3 ? Math.floor(Math.abs(+(P && P.fSeed) || 0) / 9801) % 3 : 1);
  function faultMake(P) {                       // Zustand des Kundengeräts (nur Prüfseite)
    const N = N_(); if (!N || !N.fault || !P || !fin(+P.fSeed)) return null;
    try { const m = N.fault.make('zufall', { netz: 'linear', seed: sNtsOf(P) }); return m && m.ok !== false && m.fehler ? m : null; } catch (e) { return null; }
  }
  function faultKey(P) { const m = faultMake(P); return m ? m.fehler : null; }
  function symptomName(P) {
    const N = N_(), m = faultMake(P); if (!m) return null;
    try { const c = N.fault.catalog.find(f => f.id === m.fehler), p = c && N.fault.path(c.symptome[0]); return p && p.name ? p.name : null; } catch (e) { return null; }
  }

  /* ====================================================================== Lastenheft */
  const LV_NAME = { 1: 'Einsteiger', 2: 'Standard', 3: 'Profi' };
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ K_PID);
    const combo = pick(r, COMBOS[level]);                                  // 1. Ziehung
    const fSeed = Math.floor(r() * 29403);                                 // 2. Ziehung: verdeckter Fehler (R1)
    const p = { umax: combo[0], imax: combo[1], netzTol: level === 3 ? FACH.NA1_netzTol.v : 0, uNetz: 230, fNetz: 50, tAmb: FACH.NA2_tAmb.v, tjGrenze: TJ_MAX - FACH.NA3_tjReserve.v,
      boardW: FACH.NA9_board.w, boardH: FACH.NA9_board.h, layers: FACH.NA9_board.layers, cMax: FACH.NA6_elko.cMax, fSeed: fSeed, hidden: ['fSeed'] };
    const sym = symptomName(p);
    const text = [
      'Projekt Labornetzteil, Stufe ' + level + ' (' + LV_NAME[level] + ').',
      'Labornetzteil für den Arbeitsplatz: einstellbar bis mindestens ' + p.umax + ' V, Strombegrenzung für ' + fm(p.imax, 1) + ' A, kurzschlussfest im Dauerbetrieb. Netz ' + p.uNetz + ' V/' + p.fNetz + ' Hz. Umgebung im Gehäuse ' + p.tAmb + ' °C (Übungswert), passive Kühlung ohne Lüfter. Platine höchstens ' + p.boardW + ' × ' + p.boardH + ' mm, ' + p.layers + ' Lagen.',
      'Auslegung (Übungswerte): Brücke mit Ladeelko, Elko aus der Reihe E6 und höchstens ' + p.cMax + ' µF, Brummspannung höchstens 10 % der Scheitelspannung, Spannungsabfall am Regler mindestens 2 V, Reserve 2,5 % für die E-Reihen, Strombegrenzung zwischen 1,0- und 1,2-fachem I_max.'
    ];
    if (p.netzTol > 0) text.push('Netzspannung ' + p.uNetz + ' V ± ' + fm(p.netzTol * 100, 0) + ' %: Mindestspannung für den Regler bei −10 %, Erwärmung bei +10 % rechnen.');
    if (level === 1) {
      text.push('Starthilfe Stufe 1: Der Effektivstrom im Trafo ist etwa 1,8-mal so groß wie der Gleichstrom (Faktor 1,8). Elkos gibt es mit 1000, 1500, 2200, 3300 und 4700 µF (Reihe E6).');
      text.push('Starthilfe Stufe 1 für die Fehlersuche: Miss in dieser Reihenfolge Sekundärspannung, Spannung am Elko, Brummspannung am Elko, Ausgangsspannung, Ausgangsstrom. Notiere jeden Wert.');
    }
    text.push('Zusätzlich bringt ein Kunde sein 5-V-Netzteil (Festspannungsregler) zur Reparatur. ' + (sym ? 'Kundenangabe: ' + sym + '.' : 'Das Kundensymptom siehst du am Prüfstand.'));
    return { params: p, text: text };
  }

  /* ====================================================================== Auslegungsregeln (Kern: NTS_CORE rect, lab, lin, trafo) */
  const iDim = P => K_IDIM * P.imax;
  const dropReq = P => (1 + FACH.NA5_eReserve.v) * P.umax + nl_('dropout_317');
  const sieb = (P, U2, C, I, sign, topo) => N_().rect.ripple({ topo: topo || 'bruecke', U2: U2 * (1 + (sign || 0) * P.netzTol), C: C, I: I });
  function cOk(P, U2, C, topo) {
    const nom = sieb(P, U2, C, P.imax, 0, topo), lo = sieb(P, U2, C, P.imax, -1, topo);
    const okBr = !!nom.ok && !!nom.valid && nom.dU <= nl_('ripple_ok') / 100 * nom.peak + 1e-9;
    const okDr = !!lo.ok && !!lo.valid && lo.Umin >= dropReq(P) - 1e-9;
    return { ok: okBr && okDr, brumm: okBr, drop: okDr, nom: nom, lo: lo };
  }
  const cMin = (P, U2) => { for (let i = 0; i < E6C.length; i++) if (cOk(P, U2, E6C[i]).ok) return E6C[i]; return null; };
  const u2Min = P => { for (let i = 0; i < U2S.length; i++) if (cMin(P, U2S[i]) !== null) return U2S[i]; return null; };
  function pvOf(P, U2, C, Ilim) {               // P_V,max im Kurzschluss: Längsregler, ganze Eingangsspannung am Regler (Kern lab.short, W6)
    const hi = sieb(P, U2, C, Ilim, +1), N = N_();
    return { ue: hi.Umittel, peak: hi.peak, pv: N.lab.short({ Uin: hi.Umittel, Iset: Ilim }).PvRegler };
  }
  const peakHi = (P, U2) => N_().rect.peak({ topo: 'bruecke', U2: U2 * (1 + P.netzTol) });
  const ilimOf = Rs => N_().lab.ilim({ Rs: Rs }).Ilim;
  const r2maxOf = (sch, poti, rf) => (sch === 'parallel' ? (poti > 0 && rf > 0 ? poti * rf / (poti + rf) : NaN) : poti + rf);
  const r2minOf = (sch, rf) => (sch === 'parallel' ? 0 : rf);
  const uausOf = (R1, R2) => N_().lin.lm317({ R1: R1, R2: R2 }).Uaus;
  const snMin = (u2, P) => SNS.find(s => s >= K_I2 * u2 * iDim(P) - 1e-9) || null;
  const unMin = (P, U2) => UNS.find(u => u >= FACH.NA11_elkoUfaktor.v * peakHi(P, U2) - 1e-9) || null;
  const tolOfP = P => P.netzTol;

  /* ====================================================================== Gemeinsame Infrastruktur der Stationen */
  const P_ = ctx => { const s = ctx && ctx.spec; return isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); };
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const LEVEL = ctx => (ctx && (ctx.level === 1 || ctx.level === 3) ? ctx.level : 2);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
  const dOf = d => (isObj(d) ? d : {});
  const ctlOf = d => (isObj(d && d.ctl) ? d.ctl : {});
  function slotOf(ctx, slot) {
    let d = null;
    if (ctx) {
      try { if (typeof ctx.get === 'function') d = ctx.get(slot); } catch (e) { d = null; }
      if (d == null && isObj(ctx.slots)) d = ctx.slots[slot];
    }
    return d == null ? null : unwrap(d);
  }
  function need(ctx, slot) {                    // Eingang: vorhandene Daten, sonst die Musterlösung der erzeugenden Station (Hub-/Testläufe)
    const d = slotOf(ctx, slot);
    if (d != null) return d;
    if (!ctx || ctx.noSol) return null;
    if (!ctx._sol) { try { Object.defineProperty(ctx, '_sol', { value: {}, enumerable: false, writable: true }); } catch (e) { return null; } }
    if (ctx._sol[slot] === undefined) {
      const st = STATIONS.find(s => s.out === slot);
      ctx._sol[slot] = null;
      if (st) { try { ctx._sol[slot] = st.solution(ctx); } catch (e) { ctx._sol[slot] = null; } }
    }
    return ctx._sol[slot];
  }
  const L = (ok, text, pts) => ({ ok: !!ok, text: text, pts: pts });
  function safe(fn, label) {
    return function (data, ctx) {
      try { return { lines: fn(data, ctx || {}) }; }
      catch (e) { return { lines: [L(false, label + ': Prüfung nicht möglich (' + (e && e.message ? e.message : e) + ')', 100)] }; }
    };
  }
  /* Zahl im Fenster [lo, hi]: getrennte Texte für fehlt, ungültig, zu klein, zu groß (Fable 3) */
  function win(name, v, lo, hi, unit, dg, pts, tipLow, tipHigh) {
    const u = unit ? ' ' + unit : '';
    if (v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v))) return L(false, name + ': fehlt', pts);
    if (!fin(v)) return L(false, name + ': ungültiger Wert', pts);
    const rng = fin(lo) && fin(hi) ? fm(lo, dg) + ' bis ' + fm(hi, dg) + u : fin(lo) ? 'mindestens ' + fm(lo, dg) + u : 'höchstens ' + fm(hi, dg) + u;
    if (fin(lo) && v < lo - 1e-9) return L(false, name + ': ' + fm(v, dg) + u + ' ist zu klein (erlaubt ' + rng + '). ' + (tipLow || ''), pts);
    if (fin(hi) && v > hi + 1e-9) return L(false, name + ': ' + fm(v, dg) + u + ' ist zu groß (erlaubt ' + rng + '). ' + (tipHigh || ''), pts);
    return L(true, name + ': ' + fm(v, dg) + u + ' passt (' + rng + ')', pts);
  }
  const winRel = (name, v, soll, relTol, unit, dg, pts, tipLow, tipHigh) => win(name, v, soll * (1 - relTol), soll * (1 + relTol), unit, dg, pts, tipLow, tipHigh);

  /* ---------- Rechenläufe im Kern (wie der Adapter: Steuerwerte mit Auswahlfeldern zuerst, runSeq mit opts.controls) ---------- */
  const FIRST = ['preset', 'device', 'geraet', 'netz', 'typ', 'art', 'topo', 'form', 'modell', 'seed'];
  function ordered(ctl) {
    const o = {}; if (!isObj(ctl)) return o;
    FIRST.forEach(k => { if (ctl[k] !== undefined && ctl[k] !== 'verdeckt') o[k] = ctl[k]; });
    Object.keys(ctl).forEach(k => { if (o[k] === undefined && ctl[k] !== 'verdeckt') o[k] = ctl[k]; });
    return o;
  }
  const coreOf = lab => (lab === 'nts' ? N_() : lab === 'thm' ? T_() : lab === 'els' ? E_() : null);
  const cleanSeq = seq => arr(seq).filter(x => isObj(x) && fin(x.t)).slice(0, 500).map(clone);
  function runRig(lab, rig, ctl, seq, T) {
    const C = coreOf(lab); if (!C || typeof C.runSeq !== 'function') return null;
    try { const r = C.runSeq(rig, cleanSeq(seq), T, { seed: 1, controls: ordered(ctl) }); return r && r.final ? r : null; } catch (e) { return null; }
  }
  function metersOf(r) { const s = r && arr(r.samples).length ? r.samples[r.samples.length - 1] : null, m = {}; if (s && isObj(s.meters)) Object.keys(s.meters).forEach(k => { if (fin(s.meters[k]) && Object.keys(m).length < 200) m[k] = +s.meters[k].toPrecision(7); }); return m; }
  function stateOf(r) {                         // nur Zahlen, Wahrheitswerte und die Ampel; nie Fehlerklartext (R1)
    const f = r && r.final, o = {}; if (!f) return o; let n = 0;
    Object.keys(f).forEach(k => {
      if (n >= 150 || k === 'ctl' || /^(fehler|sicht|netz|reihenfolge|messung|messwerte|punkte|getauscht|clicks|faults|rot|gesamt|naechster|diagnose)/i.test(k)) return;
      const v = f[k];
      if (typeof v === 'number' && isFinite(v)) { o[k] = +v.toPrecision(9); n++; } else if (typeof v === 'boolean') { o[k] = v; n++; }
    });
    if (typeof f.ampel === 'string' && f.ampel.length <= 12) o.ampel = f.ampel;
    return o;
  }
  function mkRig(lab, rig, ctl, seq, extra, T) {
    const r = runRig(lab, rig, ctl, seq, T), d = { lab: lab, rig: rig, ctl: clone(ctl) };
    if (arr(seq).length) d.seq = cleanSeq(seq);
    if (fin(T)) d.T = T;
    d.state = stateOf(r);
    const a = r && r.assess; d.derived = {}; if (a && typeof a.ampel === 'string') d.derived.ampel = a.ampel; if (a && typeof a.ok === 'boolean') d.derived.assessOk = a.ok;
    const m = metersOf(r); if (Object.keys(m).length) d.meas = m;
    Object.keys(extra || {}).forEach(k => { d[k] = extra[k]; });
    return d;
  }

  /* ====================================================================== vl1: Trafo wählen (Netzteil-Lab, Prüfstand trafo) */
  function checkTrafo(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), d = dOf(data), c = ctlOf(d), N = N_(), lines = [];
    const req = u2Min(P), u2 = numF(d.u2), uU = fin(u2) && U2S.indexOf(u2) >= 0;
    let t1;
    if (!fin(u2)) t1 = 'Trafospannung: fehlt (Auswahl ' + U2S.join(', ') + ' V)';
    else if (!uU) t1 = 'Trafospannung: ' + fm(u2, 0) + ' V gibt es nicht (Auswahl ' + U2S.join(', ') + ' V)';
    else if (req === null) t1 = 'Trafospannung: keine Spannung der Reihe erfüllt die Auslegung';
    else if (u2 < req) t1 = 'Trafospannung: U2 = ' + fm(u2, 0) + ' V ist zu klein: Bei ' + (P.netzTol > 0 ? 'U_netz −10 %' : 'Nennnetz') + ' reicht U_dc,min nicht für U_max + U_drop. Prüfe die nächste Stufe der Reihe.';
    else if (u2 > req) {
      const a = pvOf(P, req, cMin(P, req), iDim(P)).pv, cb = cMin(P, u2) || FACH.NA6_elko.cMax, b = pvOf(P, u2, cb, iDim(P)).pv;
      t1 = 'Trafospannung: U2 = ' + fm(u2, 0) + ' V ist größer als nötig: P_V im Kurzschluss steigt von ' + fm(a, 1) + ' auf ' + fm(b, 1) + ' W (bei I_lim = 1,2 · I_max)';
    } else t1 = 'Trafospannung: U2 = ' + fm(u2, 0) + ' V ist die kleinste Spannung, mit der Brumm und Mindestspannung aufgehen';
    lines.push(L(uU && req !== null && u2 === req, t1, 30));
    const n1 = numF(c.n1), n2 = numF(c.n2), rat = fin(n1) && fin(n2) && n1 > 0 ? N.trafo.ratio({ n1: n1, n2: n2 }) : null, u2L = rat && rat.ok ? rat.U2_leer : NaN;
    lines.push(L(fin(u2L) && uU && Math.abs(u2L - u2) <= 0.01 * u2, 'Windungen: n1 = ' + fm(n1, 0) + ', n2 = ' + fm(n2, 0) + ' geben U2 leer = ' + (fin(u2L) ? fm(u2L, 1) + ' V' : '?') + ', gewählt ' + (uU ? fm(u2, 0) + ' V' : 'fehlt') + ' (Abweichung höchstens 1 %)', 15));
    const iSoll = K_I2 * iDim(P), i2 = numF(d.i2eff);
    lines.push(winRel('Effektivstrom I_2,eff (Faktor ' + fm(K_I2, 1) + ' mal I_dim = 1,2 · I_max)', i2, iSoll, 0.05 * tol, 'A', 2, 15, 'Bei Brücke mit Ladeelko fließt der Strom nur in kurzen Spitzen, der Effektivwert ist größer als der Gleichstrom.', 'Du rechnest mit zu viel Strom, der Trafo würde unnötig groß.'));
    const iL = numF(c.iLast), ld = fin(n1) && fin(n2) && fin(iL) && n1 > 0 ? N.trafo.load({ n1: n1, n2: n2, ri: nl_('ri_trafo'), iLast: iL }) : null, eb = ld && ld.ok ? ld.einbruch * 100 : NaN;
    const ref = fin(i2) ? i2 : iSoll;
    lines.push(L(fin(iL) && Math.abs(iL - ref) <= 0.05 + 1e-9 && fin(eb) && eb <= nl_('trafo_gelb') + 1e-9, 'Belastung im Rig: Laststrom ' + (fin(iL) ? fm(iL, 2) + ' A' : 'fehlt') + ' (soll ' + fm(ref, 2) + ' A ± 0,05 A), Spannungseinbruch ' + (fin(eb) ? fm(eb, 1) + ' %' : '?') + ' (höchstens ' + fm(nl_('trafo_gelb'), 0) + ' %)', 15));
    const sn = numF(d.snVA), need_ = uU ? snMin(u2, P) : null, snOk = fin(sn) && SNS.indexOf(sn) >= 0;
    lines.push(L(snOk && need_ !== null && sn >= need_, 'Nennleistung: ' + (snOk ? fm(sn, 0) + ' VA' : fin(sn) ? 'Wert nicht in der Reihe' : 'fehlt') + (need_ !== null && snOk && sn < need_ ? ' ist zu klein (S_N mindestens Faktor · U2 · I_dim, nimm den nächsten Reihenwert darüber)' : need_ !== null && snOk ? ' reicht für ' + fm(K_I2 * u2 * iDim(P), 1) + ' VA' : ''), 15));
    lines.push(L(snOk && need_ !== null && sn === need_, 'Nennleistung, Reihe: ' + (need_ !== null ? 'der kleinste Reihenwert ab ' + fm(K_I2 * u2 * iDim(P), 1) + ' VA ist ' + need_ + ' VA' : 'ohne gültige Trafospannung nicht berechenbar') + (snOk && need_ !== null && sn > need_ ? ' – ' + fm(sn, 0) + ' VA ist unnötig groß' : ''), 10));
    return lines;
  }
  function trafoSolution(ctx) {
    const P = P_(ctx), M = musterOf(P), i2 = rd(K_I2 * iDim(P), 3);
    return mkRig('nts', 'trafo', { n1: N1, n2: Math.round(M.U2 * N1 / 230), ri: nl_('ri_trafo'), gleichspannung: false, iLast: i2, last: 'R' }, null, { u2: M.U2, snVA: M.snVA, i2eff: i2 }, 10);
  }

  /* ====================================================================== vl2: Brücke und Ladeelko (Netzteil-Lab, Prüfstand gleich) */
  function checkGleich(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), d = dOf(data), c = ctlOf(d), tr = dOf(need(ctx, 'netzteil.trafo')), lines = [];
    const u2 = numF(c.u2), cf = numF(c.c), il = numF(c.iLast), topo = c.topo, ok0 = fin(u2) && fin(cf) && cf > 0 && (topo === 'bruecke' || topo === 'einweg');
    const rip = sg => (ok0 ? sieb(P, u2, cf, P.imax, sg, topo) : null), nom = rip(0), lo = rip(-1);
    lines.push(L(topo === 'bruecke' && c.diode === 'si', 'Schaltung: ' + (topo === 'bruecke' ? 'Brücke' : topo === 'einweg' ? 'Einweg (nur 50 Hz, doppelter Brumm)' : 'fehlt') + ' mit ' + (c.diode === 'si' ? 'Silizium-Dioden (U_F ' + fm(nl_('uf_si'), 1) + ' V)' : c.diode === 'schottky' ? 'Schottky-Dioden (nicht die Auslegung dieses Projekts)' : 'fehlt'), 15));
    const u2T = numF(tr.u2);
    lines.push(L(fin(u2) && fin(u2T) && Math.abs(u2 - u2T) <= 0.01 && fin(il) && Math.abs(il - P.imax) <= 0.01 + 1e-9, 'Eingang: U2 = ' + (fin(u2) ? fm(u2, 1) + ' V' : 'fehlt') + ' (aus Station 1: ' + (fin(u2T) ? fm(u2T, 1) + ' V' : '?') + '), Laststrom ' + (fin(il) ? fm(il, 2) + ' A' : 'fehlt') + ' (I_max ' + fm(P.imax, 2) + ' A)', 10));
    const dUmax = nom && nom.ok ? nl_('ripple_ok') / 100 * nom.peak : NaN;
    lines.push(L(!!nom && nom.ok && nom.dU <= dUmax + 1e-9, 'Brumm: ΔU = I/(f_p · C) = ' + (nom && nom.ok ? fm(nom.dU, 2) + ' V' : 'nicht berechenbar') + ', höchstens 10 % von Û = ' + (fin(dUmax) ? fm(dUmax, 2) + ' V' : '?') + (nom && nom.ok && nom.dU > dUmax ? ' – C ist zu klein' : ''), 20));
    const need_ = dropReq(P);
    lines.push(L(!!lo && lo.ok && lo.Umin >= need_ - 1e-9, 'Dropout: U_dc,min' + (P.netzTol > 0 ? ' bei Netz −' + fm(P.netzTol * 100, 0) + ' %' : '') + ' = ' + (lo && lo.ok ? fm(lo.Umin, 2) + ' V' : 'nicht berechenbar') + ', verlangt mindestens 1,025 · U_max + 2 V = ' + fm(need_, 2) + ' V' + (lo && lo.ok && lo.Umin < need_ ? ' – C ist zu klein oder U2 zu niedrig' : ''), 25));
    const ci = E6C.indexOf(cf);
    lines.push(L(ci >= 0 && cf <= P.cMax, 'Reihe: C = ' + (fin(cf) ? fm(cf, 0) + ' µF' : 'fehlt') + (ci < 0 ? ' gehört nicht zur Reihe E6 (' + E6C.join(', ') + ' µF)' : cf > P.cMax ? ' ist größer als ' + P.cMax + ' µF (Platz, Einschaltstrom)' : ' ist ein E6-Wert bis ' + P.cMax + ' µF'), 5));
    const cm = fin(u2) ? cMin(P, u2) : null, ci0 = cm === null ? -1 : E6C.indexOf(cm);
    lines.push(L(ci >= 0 && ci0 >= 0 && ci >= ci0 && ci - ci0 <= 2, 'Größe: ' + (ci0 >= 0 ? 'kleinster passender Wert ' + cm + ' µF' + (ci >= 0 && ci - ci0 > 2 ? ', dein ' + fm(cf, 0) + ' µF ist unnötig groß (höherer Einschaltstrom)' : ', dein Wert liegt höchstens zwei Stufen darüber') : 'mit diesem U2 gibt es keinen passenden Elko'), 5));
    lines.push(L(!!nom && nom.ok && nom.fp === nl_('fp_brueck'), 'Pulsfrequenz: f_p = ' + (nom && nom.ok ? fm(nom.fp, 0) + ' Hz' : '?') + ', die Brücke lädt mit ' + fm(nl_('fp_brueck'), 0) + ' Hz nach', 10));
    const r = ok0 ? runRig('nts', 'gleich', c, null, 10) : null, mt = metersOf(r), ip = numF(d.iPeak);
    lines.push(winRel('Spitzenstrom aus dem Prüfstand (Meter iPeak ' + (fin(mt.iPeak) ? fm(mt.iPeak, 2) + ' A' : 'nicht lesbar') + ')', ip, fin(mt.iPeak) ? mt.iPeak : NaN, 0.1 * tol, 'A', 2, 10, 'Lies den Spitzenstrom im Prüfstand ab.', 'Lies den Spitzenstrom im Prüfstand ab.'));
    return lines;
  }
  function gleichSolution(ctx) {
    const P = P_(ctx), M = musterOf(P), ctl = { u2: M.U2, topo: 'bruecke', diode: 'si', rs: 0, c: M.C, rsieb: false, iLast: P.imax };
    const d = mkRig('nts', 'gleich', ctl, null, null, 10); d.iPeak = d.meas && fin(d.meas.iPeak) ? rd(d.meas.iPeak, 3) : 0; return d;
  }

  /* ====================================================================== vl3: Datenblätter (Datenblatt-Lab) */
  const dsOf = id => { const l = LIB(); return l && l.byId ? l.byId[id] || null : null; };
  function dsRow(ds, key) { if (!ds) return null; const all = arr(ds.abs).concat(arr(ds.elec), arr(ds.rec)); return all.find(r => r.key === key) || null; }
  function dsVal(row, field) {
    const f = field == null ? 'max' : field;
    if (!row || !fin(row[f])) return NaN;
    const d = DS(); const x = d && d.toSI ? d.toSI(row[f], row.unit) : row[f];
    return fin(x) ? x : NaN;
  }
  const recRow = (ds, key) => arr(ds && ds.rec).find(r => r.key === key) || null;
  const absRow = (ds, key) => arr(ds && ds.abs).find(r => r.key === key) || null;
  function checkDs(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), d = dOf(data), lines = [], items = arr(d.items).filter(isObj), vals = isObj(d.vals) ? d.vals : {}, calc = isObj(d.calc) ? d.calc : {};
    const si = dOf(need(ctx, 'netzteil.sieb')), sc = ctlOf(si), u2 = numF(sc.u2), cS = numF(sc.c);
    const reg = items.find(x => x.role === 'regler'), gl = items.find(x => x.role === 'gleichrichter'), rds = reg ? dsOf(reg.ds) : null;
    const io = rds ? dsVal(recRow(rds, 'io'), 'max') : NaN, vd = rds ? dsVal(absRow(rds, 'vdiff'), 'max') : NaN;
    lines.push(L(!!rds && rds.id === 'tf-lm317' && fin(io) && io >= iDim(P), 'Regler: ' + (rds ? rds.ref + ' (I_O bis ' + fm(io, 1) + ' A)' : 'nicht gewählt') + (rds && rds.id !== 'tf-lm317' ? ' – das ist kein einstellbarer Regler, das Netzteil braucht einen mit Einstellanschluss' : '') + '; verlangt I_O mindestens I_dim = ' + fm(iDim(P), 2) + ' A', 15));
    const uhi = fin(u2) ? peakHi(P, u2) : NaN;
    lines.push(L(!!rds && fin(vd) && fin(uhi) && vd >= uhi, 'Spannungsfestigkeit Regler: V_I−V_O höchstens ' + (fin(vd) ? fm(vd, 0) + ' V' : '?') + ', im Kurzschluss liegt die ganze Eingangsspannung am Regler: Û(+Netztoleranz) = ' + (fin(uhi) ? fm(uhi, 1) + ' V' : '?'), 15));
    let gOk = false, gTxt = 'Gleichrichter: nicht gewählt';
    const an = numF(vals.anzahlD), brc = typeof vals.bruecke === 'string' ? vals.bruecke.trim() : '';
    if (brc) {
      const dc = N_().rect.decode(brc);
      gOk = !!dc.ok && dc.topo === 'bruecke' && dc.kapazitiv === true && dc.Uanschluss >= (fin(u2) ? u2 * (1 + P.netzTol) : Infinity) && dc.I >= iDim(P) - 1e-9;
      gTxt = 'Gleichrichter: Brücke ' + brc + (dc.ok ? ' (' + fm(dc.Uanschluss, 0) + ' V, ' + (dc.kapazitiv ? 'kapazitive Last zulässig' : 'nur ohmsche Last') + ', ' + fm(dc.I, 1) + ' A)' : ' (Bezeichnung nicht lesbar)') + '; verlangt Anschlussspannung mindestens U2 · (1 + Netztoleranz), kapazitive Last zulässig, Strom mindestens I_dim = ' + fm(iDim(P), 2) + ' A';
    } else if (gl && dsOf(gl.ds)) {
      const g = dsOf(gl.ds), ifav = dsVal(absRow(g, 'ifav'), 'max'), vr = dsVal(absRow(g, 'vrrm'), 'max'), vNeed = fin(u2) ? 1.2 * u2 * Math.SQRT2 * (1 + P.netzTol) : Infinity;
      gOk = g.id === 'tf-1n4007' && an === 4 && fin(ifav) && ifav >= iDim(P) / 2 && fin(vr) && vr >= vNeed;
      gTxt = 'Gleichrichter: ' + (an === 4 ? '4 × ' : (fin(an) ? fm(an, 0) + ' × ' : 'Anzahl fehlt, ')) + g.ref + ' (I_F(AV) ' + fm(ifav, 1) + ' A, V_RRM ' + fm(vr, 0) + ' V); verlangt vier Dioden, I_F(AV) mindestens I_dim/2 = ' + fm(iDim(P) / 2, 2) + ' A und V_RRM mindestens 1,2 · Û = ' + (fin(vNeed) ? fm(vNeed, 1) + ' V' : '?');
    }
    lines.push(L(gOk, gTxt, 25));
    const cU = numF(vals.cUf);
    lines.push(L(fin(cU) && fin(cS) && sameVal(cU, cS, 0.005), 'Elko Kapazität: ' + (fin(cU) ? fm(cU, 0) + ' µF' : 'fehlt') + ' (Station 2: ' + (fin(cS) ? fm(cS, 0) + ' µF' : '?') + ')', 15));
    const un = numF(vals.unV), unN = fin(u2) ? unMin(P, u2) : null;
    lines.push(L(fin(un) && UNS.indexOf(un) >= 0 && unN !== null && un >= unN, 'Elko Nennspannung: ' + (fin(un) ? fm(un, 0) + ' V' : 'fehlt') + (fin(un) && UNS.indexOf(un) < 0 ? ' gehört nicht zur Reihe ' + UNS.join(', ') + ' V' : fin(un) && unN !== null && un < unN ? ' ist zu klein: die Leerlaufspannung bei höchster Netzspannung braucht 20 % Reserve' : '') + '; verlangt mindestens 1,2 · Û(Leerlauf, +Netztoleranz) = ' + (fin(uhi) ? fm(1.2 * uhi, 1) + ' V' : '?') + ' aus der Reihe ' + UNS.join(', ') + ' V', 20));
    const th = rds && isObj(rds.thermal) ? rds.thermal : {}, rj = numF(calc.rthJC), tj = numF(calc.tjMax);
    lines.push(L(fin(th.rthJC) && fin(rj) && Math.abs(rj - th.rthJC) < 1e-6 && fin(tj) && Math.abs(tj - th.tjMax) < 1e-6, 'Thermikwerte: R_thJC ' + (fin(rj) ? fm(rj, 1) + ' K/W' : 'fehlt') + ' und T_jmax ' + (fin(tj) ? fm(tj, 0) + ' °C' : 'fehlt') + ' wie im Datenblatt' + (fin(th.rthJC) ? ' (' + fm(th.rthJC, 1) + ' K/W, ' + fm(th.tjMax, 0) + ' °C)' : ''), 10));
    return lines;
  }
  function dsSolution(ctx) {
    const P = P_(ctx), M = musterOf(P), reg = dsOf('tf-lm317'), g = dsOf('tf-1n4007'), th = reg && reg.thermal ? reg.thermal : { rthJC: 5, tjMax: TJ_MAX };
    return { items: [{ role: 'regler', ds: 'tf-lm317', part: reg ? reg.part : 'TF-LM317', ref: reg ? reg.ref : 'LM317' }, { role: 'gleichrichter', ds: 'tf-1n4007', part: g ? g.part : 'TF-1N4007', ref: g ? g.ref : '1N4007' }],
      calc: { rthJC: th.rthJC, tjMax: th.tjMax }, vals: { anzahlD: 4, cUf: M.C, unV: M.unV } };
  }

  /* ====================================================================== vl4: Regler und Strombegrenzung (Netzteil-Lab, Prüfstand stabil) */
  const sch2 = v => (v === 'parallel' ? 'parallel' : v === 'reihe' ? 'reihe' : null);
  function checkStabil(data, ctx) {
    const P = P_(ctx), d = dOf(data), c = ctlOf(d), lines = [], si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), UREF = nl_('uref_317');
    const r1 = numF(c.r1), r2 = numF(c.r2), rs = numF(c.r3), poti = numF(d.poti), rf = numF(d.rFest), sh = sch2(d.schaltung), pw = numF(d.pRsW);
    const t2on = c.t2 === true || c.t2 === 'true' || c.t2 === 1;
    lines.push(L(c.art === 'lm317' && t2on, 'Bauart: ' + (c.art === 'lm317' ? 'LM317' : c.art ? 'nicht LM317 (das Netzteil braucht einen einstellbaren Regler)' : 'fehlt') + ', Strombegrenzungs-Transistor ' + (t2on ? 'an' : 'aus (ohne ihn gibt es keine Strombegrenzung)'), 10));
    const r1Max = UREF / FACH.NA4_ilminAuslegung.v;
    const lMl = win('Mindestlast: R1', r1, 100, r1Max, 'Ω', 0, 15, 'Der Prüfstand und die Auslegung verlangen mindestens 100 Ω.', 'Der Teilerstrom U_ref/R1 fällt unter ' + fm(FACH.NA4_ilminAuslegung.v * 1000, 0) + ' mA, den der Regler als Mindestlast braucht (garantierter Datenblattwert).');
    if (lMl.ok) lMl.text += '; Teilerstrom U_ref/R1 = ' + fm(UREF / r1 * 1000, 1) + ' mA';
    lines.push(lMl);
    const r2max = sh && fin(poti) && fin(rf) ? r2maxOf(sh, poti, rf) : NaN;
    lines.push(L(fin(r2) && fin(r2max) && Math.abs(r2 - r2max) <= 1 + 1e-9, 'Teiler stimmig: R2 im Prüfstand ' + (fin(r2) ? fm(r2, 0) + ' Ω' : 'fehlt') + ', aus Poti ' + (fin(poti) ? fm(poti, 0) : '?') + ' Ω ' + (sh === 'parallel' ? 'parallel zu' : sh === 'reihe' ? 'in Reihe mit' : '(Schaltung fehlt) und') + ' R_fest ' + (fin(rf) ? fm(rf, 0) : '?') + ' Ω ergibt sich R2,max = ' + (fin(r2max) ? fm(r2max, 0) + ' Ω' : 'nicht berechenbar') + ' (Abweichung höchstens 1 Ω)', 10));
    const uHi = fin(r1) && fin(r2) && r1 > 0 ? uausOf(r1, r2) : NaN;
    lines.push(win('Höchstspannung: U_aus,max', uHi, P.umax, (1 + FACH.NA5_eReserve.v) * P.umax, 'V', 2, 20, 'R2,max ist zu klein, die Ausgangsspannung erreicht U_max nicht. U_aus = U_ref · (1 + R2/R1).', 'R2,max ist zu groß, die Spannung liegt über U_max plus 2,5 %.'));
    const r2min = sh && fin(rf) ? r2minOf(sh, rf) : NaN, uLo = fin(r1) && fin(r2min) && r1 > 0 ? uausOf(r1, r2min) : NaN;
    lines.push(win('Kleinstspannung: U_aus,min', uLo, -Infinity, FACH.NA12_uausMin.v, 'V', 2, 10, '', 'Mit dem Poti ganz zugedreht muss die Spannung unter 2 V sinken. Ein kleinerer Festwiderstand in Reihe oder die Parallelschaltung hilft.'));
    const sU2 = numF(si.u2), sC = numF(si.c), lo = fin(sU2) && fin(sC) && sC > 0 ? sieb(P, sU2, sC, P.imax, -1, si.topo === 'einweg' ? 'einweg' : 'bruecke') : null, uMin = lo && lo.ok ? lo.Umin : NaN;
    lines.push(L(fin(uMin) && fin(uHi) && uHi + nl_('dropout_317') <= uMin + 1e-9, 'Dropout: U_aus,max ' + (fin(uHi) ? fm(uHi, 2) : '?') + ' V plus 2 V gegen die kleinste Eingangsspannung aus deiner Station 2: ' + (fin(uMin) ? fm(uMin, 2) + ' V' : 'nicht berechenbar') + (fin(uMin) && fin(uHi) && uHi + nl_('dropout_317') > uMin ? ' – der Regler fällt aus der Regelung' : ''), 15));
    const il = fin(rs) && rs > 0 ? ilimOf(rs) : NaN, lI = win('Strombegrenzung: I_lim = U_BE/R_S', il, P.imax, FACH.NA7_ilimFaktor.v * P.imax, 'A', 3, 15, 'Die Begrenzung setzt zu früh ein, R_S ist zu groß.', 'Die Begrenzung setzt zu spät ein, R_S ist zu klein.');
    if (lI.ok && !isE12(rs)) { lI.ok = false; lI.text += '; R_S = ' + fm(rs, 2) + ' Ω ist kein E12-Wert'; } else if (lI.ok) lI.text += '; R_S = ' + fm(rs, 1) + ' Ω (E12)';
    lines.push(lI);
    const pNeed = fin(il) && fin(rs) ? FACH.NA13_rsLeistungFaktor.v * il * il * rs : NaN;
    lines.push(L(fin(pw) && fin(pNeed) && pw >= pNeed - 1e-9, 'Belastbarkeit R_S: ' + (fin(pw) ? fm(pw, 2) + ' W' : 'fehlt') + ', verlangt mindestens 2 · I_lim² · R_S = ' + (fin(pNeed) ? fm(pNeed, 2) + ' W' : '?'), 5));
    return lines;
  }
  function reglerSolution(ctx) {
    const P = P_(ctx), M = musterOf(P), il = ilimOf(M.Rs), r2 = Math.round(r2maxOf(M.schaltung, M.poti, M.rFest));
    const ue = rd(Math.round(2 * sieb(P, M.U2, M.C, P.imax, 0).Umittel) / 2, 1);
    return mkRig('nts', 'stabil', { art: 'lm317', ue: ue, r1: M.R1, r2: r2, t2: true, r3: M.Rs, iLast: P.imax }, null, { poti: M.poti, rFest: M.rFest, schaltung: M.schaltung, pRsW: M.pRsW }, 10);
  }

  /* ====================================================================== vl5: Kühlkörper (Thermik-Lab, Prüfstand linear) */
  function pvPoint(P, ctx) {                    // ungünstigster Punkt aus den EIGENEN Stationen 1, 2 und 4 (R-Pv)
    const si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), st = ctlOf(dOf(need(ctx, 'netzteil.regler')));
    const u2 = numF(si.u2), cf = numF(si.c), rs = numF(st.r3);
    if (!fin(u2) || !fin(cf) || cf <= 0 || !fin(rs) || rs <= 0) return { ok: false };
    const il = ilimOf(rs), pv = pvOf(P, u2, cf, il);
    return { ok: true, il: il, ue: pv.ue, pv: pv.pv };
  }
  const MONTAGE = {
    kurzschluss: 'Die Kühlfahne des LM317 liegt am Ausgang. Direkt auf einem geerdeten Kühlkörper schließt das den Ausgang kurz: Glimmer mit Isolierbuchse nehmen oder den Kühlkörper isoliert montieren.',
    'paste-fehlt': 'Zwischen Gehäuse und Kühlkörper fehlt die Wärmeleitpaste: der Übergangswiderstand steigt stark.',
    dick: 'Die Wärmeleitpaste ist zu dick aufgetragen: der Übergangswiderstand steigt.',
    locker: 'Die Befestigungsschraube sitzt locker: der Übergangswiderstand steigt.',
    'buchse-fehlt': 'Bei Glimmer fehlt die Isolierbuchse an der Schraube: die Schraube schließt zum Kühlkörper.'
  };
  function checkTherm(data, ctx) {
    const P = P_(ctx), d = dOf(data), c = ctlOf(d), lines = [], pt = pvPoint(P, ctx), T = T_();
    lines.push(L(c.device === 'lm317', 'Bauteil: ' + (c.device === 'lm317' ? 'LM317' : c.device ? c.device + ' (das Netzteil nutzt den LM317)' : 'fehlt'), 10));
    const ue = numF(c.ue), ua = numF(c.ua), il = numF(c.iLoad), ilN = pt.ok ? Math.ceil(pt.il / 0.05 - 1e-9) * 0.05 : NaN;
    const bpOk = pt.ok && fin(ue) && ue >= pt.ue - 0.25 - 1e-9 && fin(il) && il >= ilN - 1e-9 && fin(ua) && Math.abs(ua - 1.25) <= 0.01;
    lines.push(L(bpOk, 'Betriebspunkt: U_e ' + (fin(ue) ? fm(ue, 1) + ' V' : 'fehlt') + ' (mindestens ' + (pt.ok ? fm(pt.ue - 0.25, 1) : '?') + ' V, mittlere Eingangsspannung bei höchster Netzspannung und I_lim), Strom ' + (fin(il) ? fm(il, 2) + ' A' : 'fehlt') + ' (mindestens ' + (pt.ok ? fm(ilN, 2) : '?') + ' A, aufgerundet auf 0,05 A), U_a ' + (fin(ua) ? fm(ua, 2) + ' V' : 'fehlt') + ' (kleinstmöglich 1,25 V)', 15));
    const ta = numF(c.ta);
    lines.push(L(fin(ta) && Math.abs(ta - P.tAmb) <= 0.5, 'Umgebung: ' + (fin(ta) ? fm(ta, 0) + ' °C' : 'fehlt') + ' (Lastenheft ' + fm(P.tAmb, 0) + ' °C)', 5));
    let st = null; try { if (pt.ok) st = T.steady(T.cfgFromControls(c, 'lm317'), pt.pv, P.tAmb); } catch (e) { st = null; }
    const tjOk = !!st && st.ok !== false && fin(st.tj) && st.tj <= P.tjGrenze + 1e-9;
    lines.push(L(tjOk, 'Sperrschicht: ' + (st && fin(st.tj) ? 'T_j = ' + fm(st.tj, 1) + ' °C bei P_V = ' + fm(pt.pv, 2) + ' W' : 'nicht berechenbar') + ', höchstens ' + fm(P.tjGrenze, 0) + ' °C (T_jmax − 20 K)' + (st && fin(st.tj) && st.tj > P.tjGrenze ? ' – größerer Kühlkörper, besserer Übergang oder kleinerer Trafo' : ''), 35));
    const fl = st && Array.isArray(st.faults) ? st.faults : null;
    lines.push(L(!!fl && fl.length === 0, 'Montage: ' + (fl === null ? 'nicht berechenbar' : fl.length ? fl.map(f => MONTAGE[f] || ('Montagefehler ' + f)).join(' ') : 'Fahne isoliert, Paste und Schraube in Ordnung'), 25));
    lines.push(L(c.fan === FACH.NA14_passiv.fan, 'Kühlart: ' + (c.fan === 'aus' ? 'passiv, ohne Lüfter' : c.fan ? 'mit Lüfter (laut Lastenheft passive Kühlung)' : 'fehlt'), 10));
    return lines;
  }
  function thermSolution(ctx) {
    const P = P_(ctx), M = musterOf(P);
    return mkRig('thm', 'linear', { device: 'lm317', ue: M.thm.ue, ua: 1.25, loadMode: 'strom', iLoad: M.thm.iLoad, heatsink: M.thm.heatsink, joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: P.tAmb }, null, null, 1800);
  }

  /* ====================================================================== Netzlisten-Hilfen (privat, wie in verbunddata-giessen.js) */
  function nlIdx(nl) {
    const ix = { ok: false, net: {}, nets: {}, parts: {}, dups: [] };
    if (!isObj(nl)) return ix;
    arr(nl.parts).forEach(p => { if (isObj(p) && typeof p.ref === 'string') ix.parts[p.ref] = p; });
    arr(nl.nets).forEach(n => {
      if (!isObj(n) || typeof n.name !== 'string') return;
      if (!ix.nets[n.name]) ix.nets[n.name] = [];
      arr(n.pins).forEach(pin => { pin = String(pin); if (ix.net[pin] !== undefined && ix.net[pin] !== n.name) ix.dups.push(pin); ix.net[pin] = n.name; ix.nets[n.name].push(pin); });
    });
    Object.keys(ix.parts).forEach(ref => {
      const pp = ix.parts[ref].pins;
      if (isObj(pp)) Object.keys(pp).forEach(k => { const a = ref + '.' + k; if (ix.net[a] === undefined && typeof pp[k] === 'string' && pp[k]) { ix.net[a] = pp[k]; (ix.nets[pp[k]] = ix.nets[pp[k]] || []).push(a); } });
    });
    ix.ok = Object.keys(ix.parts).length > 0;
    return ix;
  }
  const netOf = (ix, ref, pin) => ix.net[ref + '.' + pin];
  const ofKind = (ix, kind) => Object.keys(ix.parts).map(k => ix.parts[k]).filter(p => p.kind === kind);
  function nlBuilder(name) {
    const parts = [], nets = {}, order = [];
    const b = {
      add(ref, kind, value, pins) {
        parts.push({ ref: ref, kind: kind, value: value == null ? '' : String(value), pins: Object.assign({}, pins) });
        Object.keys(pins).forEach(k => { const n = pins[k]; if (!nets[n]) { nets[n] = []; order.push(n); } nets[n].push(ref + '.' + k); });
        return b;
      },
      done() { return { v: 1, name: name, parts: parts, nets: order.map(n => ({ name: n, cls: /^(GND|VCC)$/.test(n) ? 'power' : 'signal', pins: nets[n].slice() })) }; }
    };
    return b;
  }
  const rmPart = (nl, ref) => { nl.parts = nl.parts.filter(p => p.ref !== ref); nl.nets.forEach(n => { n.pins = n.pins.filter(p => p.indexOf(ref + '.') !== 0); }); return nl; };
  const setPart = (nl, ref, fn) => { nl.parts.forEach(p => { if (p.ref === ref) fn(p); }); return nl; };
  function movePin(nl, addr, toNet) {           // Anschluss addr ('Q1.C') an ein anderes Netz legen
    const dot = addr.indexOf('.'), ref = addr.slice(0, dot), pn = addr.slice(dot + 1);
    nl.nets.forEach(n => { n.pins = n.pins.filter(p => p !== addr); });
    setPart(nl, ref, p => { if (p.pins) p.pins[pn] = toNet; });
    let n = nl.nets.find(x => x.name === toNet); if (!n) { n = { name: toNet, cls: 'signal', pins: [] }; nl.nets.push(n); }
    n.pins.push(addr); return nl;
  }
  const capOf = v => { const s = String(v == null ? '' : v).trim().replace(',', '.'), m = /^(\d+(?:\.\d+)?)\s*([uµmnp]?)F?$/i.exec(s); if (!m) return NaN; const u = m[2].toLowerCase(); return parseFloat(m[1]) * (u === 'm' ? 1000 : u === 'n' ? 0.001 : u === 'p' ? 1e-6 : 1); };   // µF
  const fmtR = v => String(rd(v, 3));
  const rVal = p => (p ? numOf(p.value) : NaN);

  /* ====================================================================== vl6: Schaltplan (SchaltLab) */
  function psuOf(ix) {                          // Funktion der Schaltung aus der Netzliste (unabhängig von Bauteilnamen)
    const o = { errs: [] }, rs = ofKind(ix, 'R'), reg = ofKind(ix, 'REG')[0] || null;
    const touch = (p, a, b) => { const x = netOf(ix, p.ref, '1'), y = netOf(ix, p.ref, '2'); return (x === a && y === b) || (x === b && y === a); };
    const has = (p, n) => netOf(ix, p.ref, '1') === n || netOf(ix, p.ref, '2') === n;
    const other = (p, n) => (netOf(ix, p.ref, '1') === n ? netOf(ix, p.ref, '2') : netOf(ix, p.ref, '1'));
    o.reg = reg;
    if (reg) { o.nIn = netOf(ix, reg.ref, 'IN'); o.nAdj = netOf(ix, reg.ref, 'GND'); o.nOut = netOf(ix, reg.ref, 'OUT'); o.lm = /lm\s*317/i.test(reg.value); }
    o.r1 = reg ? rs.find(p => touch(p, o.nOut, o.nAdj)) || null : null;
    o.r2 = reg ? rs.find(p => p !== o.r1 && has(p, o.nAdj) && other(p, o.nAdj) !== o.nOut && other(p, o.nAdj) !== o.nAdj) || null : null;
    o.nGnd = o.r2 ? other(o.r2, o.nAdj) : null;
    o.rs = reg ? rs.find(p => p !== o.r1 && p !== o.r2 && has(p, o.nOut) && other(p, o.nOut) !== o.nAdj && other(p, o.nOut) !== o.nOut) || null : null;
    o.nAus = o.rs ? other(o.rs, o.nOut) : null;
    o.q = ofKind(ix, 'NPN')[0] || null;
    o.qOk = !!(o.q && reg && o.rs && netOf(ix, o.q.ref, 'B') === o.nOut && netOf(ix, o.q.ref, 'E') === o.nAus && netOf(ix, o.q.ref, 'C') === o.nAdj);
    const trf = ofKind(ix, 'TRF')[0] || null, acs = ofKind(ix, 'AC')[0] || null;
    o.src = trf ? 'Trafo' : acs ? 'Wechselspannungsquelle' : null;
    o.acA = trf ? netOf(ix, trf.ref, 'S1') : acs ? netOf(ix, acs.ref, '+') : null; o.acB = trf ? netOf(ix, trf.ref, 'S2') : acs ? netOf(ix, acs.ref, '-') : null;
    const dd = ofKind(ix, 'D'), br = ofKind(ix, 'BRUECKE')[0] || null, rEr = [];
    if (!o.src) rEr.push('keine Wechselspannungsquelle (Trafo) am Gleichrichter');
    if (!reg) rEr.push('kein Regler in der Schaltung');
    if (br && reg && o.src) {
      const a = netOf(ix, br.ref, 'AC1'), b2 = netOf(ix, br.ref, 'AC2'), same = (a === o.acA && b2 === o.acB) || (a === o.acB && b2 === o.acA);
      if (!same) rEr.push('die Brücke liegt nicht an der Sekundärseite des Trafos');
      if (netOf(ix, br.ref, '+') !== o.nIn) rEr.push('der Plus-Ausgang der Brücke liegt nicht am Reglereingang');
      if (o.nGnd !== null && netOf(ix, br.ref, '-') !== o.nGnd) rEr.push('der Minus-Ausgang der Brücke liegt nicht an Masse');
      o.bridge = br.ref;
    } else if (reg && o.src && !br) {
      const used = new Set();
      [o.acA, o.acB].forEach(ac => {
        const up = dd.find(x => !used.has(x.ref) && netOf(ix, x.ref, 'A') === ac && netOf(ix, x.ref, 'K') === o.nIn);
        if (up) used.add(up.ref); else { const rev = dd.find(x => !used.has(x.ref) && netOf(ix, x.ref, 'K') === ac && netOf(ix, x.ref, 'A') === o.nIn); rEr.push(rev ? 'Diode ' + rev.ref + ' sitzt verkehrt herum (Anode an den Reglereingang)' : 'es fehlt eine Diode vom Wechselspannungsanschluss zum Reglereingang'); if (rev) used.add(rev.ref); }
        const dn = dd.find(x => !used.has(x.ref) && netOf(ix, x.ref, 'K') === ac && o.nGnd !== null && netOf(ix, x.ref, 'A') === o.nGnd);
        if (dn) used.add(dn.ref); else { const rev = dd.find(x => !used.has(x.ref) && netOf(ix, x.ref, 'A') === ac && netOf(ix, x.ref, 'K') === o.nGnd); rEr.push(rev ? 'Diode ' + rev.ref + ' sitzt verkehrt herum (Kathode an Masse)' : 'es fehlt eine Diode von Masse zum Wechselspannungsanschluss'); if (rev) used.add(rev.ref); }
      });
    }
    o.rectErrs = rEr;
    const ce = ofKind(ix, 'CE')[0] || null; o.ce = ce;
    if (ce && reg) { const n1 = netOf(ix, ce.ref, '1'), n2 = netOf(ix, ce.ref, '2'); o.cePol = n1 === o.nIn && n2 === o.nGnd ? 'ok' : n1 === o.nGnd && n2 === o.nIn ? 'verpolt' : 'falsch'; }
    const srcPin = a => { const k = (ix.parts[a.split('.')[0]] || {}).kind, q = a.split('.')[1]; return (k === 'TRF' && (q === 'P1' || q === 'P2')) || (k === 'NETZ' && (q === 'L' || q === 'N')) || (k === 'AC' && (q === '+' || q === '-')); };
    o.fuse = ofKind(ix, 'FUSE').find(f => ['1', '2'].some(k => arr(ix.nets[netOf(ix, f.ref, k)]).some(srcPin))) || null;
    return o;
  }
  function checkSch(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), lines = [], d = dOf(data), ix = nlIdx(d.netlist), o = ix.ok ? psuOf(ix) : { rectErrs: ['keine Schaltung (Netzliste leer)'] };
    const si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), st = dOf(need(ctx, 'netzteil.regler')), sc = ctlOf(st), cS = numF(si.c);
    lines.push(L(ix.ok && o.rectErrs.length === 0, 'Gleichrichtung: ' + (ix.ok && o.rectErrs.length === 0 ? o.src + ' mit ' + (o.bridge ? 'Brücke' : 'vier Dioden') + ' richtig herum an Wechselspannung, Plus am Reglereingang und Minus an Masse' : o.rectErrs[0]), 20));
    const cv = o.ce ? capOf(o.ce.value) : NaN;
    lines.push(L(!!o.ce && o.cePol === 'ok' && fin(cv) && fin(cS) && sameVal(cv, cS, 0.005), 'Ladeelko: ' + (!o.ce ? 'fehlt' : o.cePol === 'ok' ? 'richtig gepolt (Plus am Reglereingang)' : o.cePol === 'verpolt' ? 'verpolt (Plus liegt an Masse)' : 'nicht zwischen Reglereingang und Masse') + (o.ce && fin(cv) && fin(cS) ? ', Wert ' + fm(cv, 0) + ' µF (Station 2: ' + fm(cS, 0) + ' µF)' : o.ce ? ', Wert nicht lesbar' : ''), 15));
    const rg = [];
    if (!o.reg) rg.push('kein Regler'); else { if (!o.lm) rg.push('der Regler muss „LM317“ heißen'); if (!o.r1) rg.push('R1 zwischen OUT und ADJ fehlt'); if (!o.r2) rg.push('R2 zwischen ADJ und Masse fehlt'); else if (o.rectErrs.length === 0 && o.nGnd === null) rg.push('R2 liegt nicht an Masse'); }
    lines.push(L(rg.length === 0, 'Regler: ' + (rg.length ? rg[0] : 'LM317 mit IN am Elko, R1 zwischen OUT und ADJ, R2 zwischen ADJ und Masse'), 25));
    const sb = [];
    if (!o.rs) sb.push('der Messwiderstand R_S im Ausgangszweig fehlt'); if (!o.q) sb.push('der Begrenzungs-Transistor (NPN) fehlt'); else if (o.rs && !o.qOk) sb.push('der Transistor sitzt falsch: Basis an OUT, Emitter am Ausgang hinter R_S, Kollektor an ADJ');
    lines.push(L(sb.length === 0, 'Strombegrenzung: ' + (sb.length ? sb[0] : 'R_S im Ausgangszweig, NPN mit Basis und Emitter über R_S und Kollektor an ADJ'), 20));
    const r1 = rVal(o.r1), r2 = rVal(o.r2), r3 = rVal(o.rs), u1 = fin(r1) && fin(r2) && r1 > 0 ? uausOf(r1, r2) : NaN, uS = fin(numF(sc.r1)) && fin(numF(sc.r2)) ? uausOf(numF(sc.r1), numF(sc.r2)) : NaN;
    const ev = [];
    if (!(fin(r1) && sameVal(r1, numF(sc.r1), 0.01))) ev.push('R1 ' + (fin(r1) ? fm(r1, 0) : 'fehlt') + ' Ω statt ' + fm(numF(sc.r1), 0) + ' Ω');
    if (!(fin(r2) && sameVal(r2, numF(sc.r2), 0.01))) ev.push('R2 ' + (fin(r2) ? fm(r2, 0) : 'fehlt') + ' Ω statt R2,max ' + fm(numF(sc.r2), 0) + ' Ω');
    if (!(fin(r3) && sameVal(r3, numF(sc.r3), 0.01))) ev.push('R_S ' + (fin(r3) ? fm(r3, 2) : 'fehlt') + ' Ω statt ' + fm(numF(sc.r3), 2) + ' Ω');
    if (!(fin(u1) && fin(uS) && sameVal(u1, uS, 0.01))) ev.push('U_aus,max aus der Netzliste ' + (fin(u1) ? fm(u1, 2) + ' V' : '?') + ' statt ' + (fin(uS) ? fm(uS, 2) + ' V' : '?'));
    lines.push(L(ev.length === 0, 'Werte: ' + (ev.length ? ev.join('; ') : 'R1, R2,max und R_S wie in Station 4, U_aus,max ' + fm(u1, 2) + ' V aus der Netzliste'), 15));
    lines.push(L(!!o.fuse, 'Sicherung: ' + (o.fuse ? 'im Primärkreis vor dem Trafo' : 'fehlt im Primärkreis (zwischen Netz und Trafo)'), 5));
    return lines;
  }
  function buildSch(P, ctx) {
    const M = musterOf(P), st = ctlOf(dOf(need(ctx, 'netzteil.regler'))), si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), dsp = dOf(need(ctx, 'netzteil.ds')), tr = dOf(need(ctx, 'netzteil.trafo'));
    const r1 = numF(st.r1), r2 = numF(st.r2), r3 = numF(st.r3), cF = numF(si.c), u2 = numF(tr.u2), vals = isObj(dsp.vals) ? dsp.vals : {}, br = typeof vals.bruecke === 'string' && vals.bruecke ? vals.bruecke : '';
    const b = nlBuilder('Labornetzteil');
    b.add('N1', 'NETZ', '230V', { L: 'N_L', N: 'N_N' });
    b.add('F1', 'FUSE', '0.2', { '1': 'N_L', '2': 'N_P' });
    b.add('T1', 'TRF', '230V:' + u2 + 'V', { P1: 'N_P', P2: 'N_N', S1: 'AC1', S2: 'AC2' });
    if (br) b.add('B1', 'BRUECKE', br, { AC1: 'AC1', AC2: 'AC2', '+': 'UE', '-': 'GND' });
    else { b.add('D1', 'D', '1N4007', { A: 'AC1', K: 'UE' }); b.add('D2', 'D', '1N4007', { A: 'AC2', K: 'UE' }); b.add('D3', 'D', '1N4007', { A: 'GND', K: 'AC1' }); b.add('D4', 'D', '1N4007', { A: 'GND', K: 'AC2' }); }
    b.add('C1', 'CE', cF + 'u', { '1': 'UE', '2': 'GND' });
    b.add('U1', 'REG', 'LM317', { IN: 'UE', GND: 'ADJ', OUT: 'OUT' });
    b.add('R1', 'R', fmtR(r1), { '1': 'OUT', '2': 'ADJ' });
    b.add('R2', 'R', fmtR(r2), { '1': 'ADJ', '2': 'GND' });
    b.add('R3', 'R', fmtR(r3), { '1': 'OUT', '2': 'AUS' });
    b.add('Q1', 'NPN', 'BC547', { B: 'OUT', C: 'ADJ', E: 'AUS' });
    const uHi = uausOf(r1, r2), il = ilimOf(r3);
    return { lab: 'sch', name: 'Labornetzteil', netlist: b.done(), meas: { Uaus_max_V: rd(uHi, 3), Ilim_A: rd(il, 4), Umax_V: P.umax }, snap: {} };
  }

  /* ====================================================================== vl7: Platine (Leiterplatten-Lab) */
  const asBoard = b => { if (typeof b === 'string') { try { return JSON.parse(b); } catch (e) { return null; } } return isObj(b) ? b : null; };
  const boardCache = new Map();
  function boardStats(board) {
    const key = hash(JSON.stringify(board));
    if (boardCache.has(key)) return boardCache.get(key);
    const c = PCB(), conn = c.connectivity(board), drc = arr(c.drc(board));
    const errs = drc.filter(x => x.severity === 'error' && x.type !== 'unconnected'), warns = drc.filter(x => x.severity !== 'error');
    let cost = NaN; try { const cc = c.cost(board); cost = cc && fin(cc.total) ? cc.total : NaN; } catch (e) { /* ohne Kosten */ }
    const s = { conn: conn, drc: drc, errs: errs, warns: warns, unrouted: arr(conn.unrouted).length, shorts: arr(conn.shorts).length, cost: cost };
    if (boardCache.size > 200) boardCache.clear();
    boardCache.set(key, s);
    return s;
  }
  function boardReport(board) {
    const s = boardStats(board);
    return { w: board.w, h: board.h, layers: board.layers, drcErrors: s.errs.length, drcWarns: s.warns.length, unrouted: s.unrouted, shorts: s.shorts, cost: s.cost, bomCount: arr(board.parts).length };
  }
  /* Funktion der Platine aus den Netzen (unabhängig von Bauteilnamen): Elko, Begrenzungs-Transistor, Dioden, Widerstände, Klemmen */
  function boardFunc(board) {
    const bnet = {}, errs = [], o = { errs: errs, roles: {} };
    arr(board.nets).forEach(n => { if (isObj(n)) arr(n.pins).forEach(p => { if (bnet[String(p)] === undefined) bnet[String(p)] = n.name; }); });
    const parts = arr(board.parts).filter(isObj), byFp = f => parts.filter(p => f.test(String(p.fp)));
    const pn = (p, pad) => bnet[p.ref + '.' + pad];
    const dio = byFp(/^D_DO41$/), el = byFp(/^C_RADIAL/)[0], q = byFp(/^TO-92$/)[0], u1 = byFp(/^TO-220$/)[0], res = byFp(/^R(_AXIAL|0|1)/), terms = byFp(/^TERMINAL_/);
    o.u1 = u1 || null;
    if (!el) errs.push('der Ladeelko fehlt auf der Platine (Gehäuse C_RADIAL)'); if (!q) errs.push('der Begrenzungs-Transistor fehlt auf der Platine (TO-92)'); if (!u1) errs.push('der LM317 fehlt auf der Platine (TO-220)');
    if (dio.length !== 4) errs.push('für die Brücke braucht die Platine vier Dioden (D_DO41), es sind ' + dio.length);
    if (terms.length < 2) errs.push('die Platine braucht Anschlussklemmen für Wechselspannung und Ausgang');
    if (errs.length) return o;
    const ue = pn(el, '1'), gnd = pn(el, '2'), adj = pn(q, '1'), out = pn(q, '2'), aus = pn(q, '3');
    [['Elko Plus', ue], ['Elko Minus', gnd], ['Kollektor des Transistors', adj], ['Basis des Transistors', out], ['Emitter des Transistors', aus]].forEach(x => { if (x[1] === undefined) errs.push('Pad „' + x[0] + '“ ist keinem Netz zugeordnet'); });
    if (errs.length) return o;
    Object.assign(o.roles, { ue: ue, gnd: gnd, adj: adj, out: out, aus: aus });
    if (new Set([ue, gnd, adj, out, aus]).size < 5) errs.push('Netze sind auf der Platine verbunden: Elko Plus, Minus, ADJ, OUT und Ausgang müssen fünf getrennte Netze sein');
    const up = dio.filter(x => pn(x, '1') === ue), ac = up.map(x => pn(x, '2')).filter((v, i, a) => v !== undefined && a.indexOf(v) === i);
    if (up.length !== 2 || ac.length !== 2) errs.push('Brücke: zwei Dioden müssen mit der Kathode (Ring) am Elko-Plus liegen und mit der Anode an zwei verschiedenen Wechselspannungsnetzen');
    else {
      o.roles.ac1 = ac[0]; o.roles.ac2 = ac[1];
      ac.forEach(a => { if (!dio.some(x => pn(x, '2') === gnd && pn(x, '1') === a)) errs.push('Brücke: eine Diode von Masse zum Wechselspannungsnetz ' + a + ' fehlt oder sitzt verkehrt herum'); });
    }
    const touch = (p, a, b2) => { const x = pn(p, '1'), y = pn(p, '2'); return (x === a && y === b2) || (x === b2 && y === a); };
    if (!res.some(p => touch(p, out, adj))) errs.push('R1 zwischen OUT und ADJ fehlt'); if (!res.some(p => touch(p, adj, gnd))) errs.push('R2 zwischen ADJ und Masse fehlt'); if (!res.some(p => touch(p, out, aus))) errs.push('R_S zwischen OUT und Ausgang fehlt');
    const tpads = []; terms.forEach(t => { const f = PCB().footprint(t.fp); arr(f && f.pads).forEach(p => tpads.push(t.ref + '.' + p.n)); });
    const need4 = [['Wechselspannung', o.roles.ac1], ['Wechselspannung', o.roles.ac2], ['Ausgang plus', aus], ['Masse', gnd]];
    need4.forEach(x => { if (x[1] !== undefined && !tpads.some(tp => bnet[tp] === x[1])) errs.push('Netz ' + x[1] + ' (' + x[0] + ') hat keine Anschlussklemme'); });
    const good = [o.roles.ac1, o.roles.ac2, aus, gnd];
    tpads.forEach(tp => { if (bnet[tp] === undefined) errs.push('Klemmenpin ' + tp + ' ist nirgends angeschlossen'); else if (good.indexOf(bnet[tp]) < 0) errs.push('Klemmenpin ' + tp + ' hängt an keinem Anschlussnetz des Netzteils'); });
    o.bnet = bnet;
    return o;
  }
  const boardCacheSol = new Map();
  function buildBoard(P, Ilim, vals) {
    const c = PCB(), key = hash(JSON.stringify([P.boardW, P.boardH, P.layers, rd(Ilim, 4), vals]));
    if (boardCacheSol.has(key)) return clone(boardCacheSol.get(key));
    const W = P.boardW, H = P.boardH, wPow = rd(Math.max(c.ipcWidth(Ilim, { oz: 1, rise: 10 }) + 0.1, 0.5), 2);
    const b = c.newBoard({ id: 'netzteil', name: 'Labornetzteil', w: W, h: H, layers: P.layers });
    let n = 0; const add = (ref, fp, x, y, val) => b.parts.push({ id: 'p' + (++n), ref: ref, fp: fp, x: rd(x, 2), y: rd(y, 2), rot: 0, side: 'top', value: val == null ? '' : String(val) });
    const sx = W / 80, sy = H / 60;
    add('X1', 'TERMINAL_2', 4, 18 * sy, 'AC'); add('X2', 'TERMINAL_2', W - 6, 12 * sy, 'AUS');
    [9, 16, 23, 30].forEach((y, i) => add('D' + (i + 1), 'D_DO41', 22 * sx, y * sy, '1N4007'));
    add('C1', 'C_RADIAL_5', 44 * sx, 15 * sy, vals.C + 'u'); add('U1', 'TO-220', W - 10, 40 * sy, 'LM317'); add('Q1', 'TO-92', 52 * sx, 34 * sy, 'BC547');
    add('R1', 'R_AXIAL_10', 34 * sx, 46 * sy, vals.R1); add('R2', 'R_AXIAL_10', 34 * sx, 53 * sy, vals.R2); add('R3', 'R_AXIAL_10', 52 * sx, 46 * sy, vals.R3);
    const nets = {}, ord = [], ap = (nm, pin) => { if (!nets[nm]) { nets[nm] = []; ord.push(nm); } nets[nm].push(pin); };
    ap('AC1', 'X1.1'); ap('AC1', 'D1.2'); ap('AC1', 'D3.1'); ap('AC2', 'X1.2'); ap('AC2', 'D2.2'); ap('AC2', 'D4.1');
    ap('UE', 'D1.1'); ap('UE', 'D2.1'); ap('UE', 'C1.1'); ap('UE', 'U1.3');
    ap('GND', 'D3.2'); ap('GND', 'D4.2'); ap('GND', 'C1.2'); ap('GND', 'R2.2'); ap('GND', 'X2.2');
    ap('ADJ', 'U1.1'); ap('ADJ', 'R1.2'); ap('ADJ', 'R2.1'); ap('ADJ', 'Q1.1');
    ap('OUT', 'U1.2'); ap('OUT', 'R1.1'); ap('OUT', 'R3.1'); ap('OUT', 'Q1.2');
    ap('AUS', 'R3.2'); ap('AUS', 'Q1.3'); ap('AUS', 'X2.1');
    b.nets = ord.map(nm => { const o = { name: nm, cls: nm === 'ADJ' ? 'signal' : 'power', pins: nets[nm] }; if (nm !== 'ADJ') o.width = wPow; return o; });
    const r = c.autoroute(b, {}), res = r.board || b;
    boardCacheSol.set(key, clone(res));
    return clone(res);
  }
  function checkPcb(data, ctx) {
    const P = P_(ctx), lines = [], sch = dOf(need(ctx, 'netzteil.sch')), ix = nlIdx(sch.netlist), st = ctlOf(dOf(need(ctx, 'netzteil.regler')));
    const board = asBoard(data && data.board);
    if (!board || !PCB()) return [L(false, 'Platine oder Schaltplan fehlt, die Platine lässt sich nicht prüfen', 100)];
    const norm = PCB().normalize(board), bs = boardStats(norm), fn = boardFunc(norm), nParts = arr(norm.parts).length, ps = ix.ok ? psuOf(ix) : null;
    const schOk = !!ps && ps.rectErrs.length === 0 && !!ps.r1 && !!ps.r2 && !!ps.rs && ps.qOk;
    const eqErr = !ix.ok ? 'der Schaltplan aus Station 6 ist leer' : !schOk ? 'der Schaltplan aus Station 6 ist nicht vollständig, die Platine kann nicht dazu passen' : fn.errs.length ? fn.errs[0] + (fn.errs.length > 1 ? ' (+' + (fn.errs.length - 1) + ' weitere)' : '') : '';
    lines.push(L(nParts > 0 && !eqErr, 'Netze: Platine gleichwertig zum Schaltplan (Brücke, Ladeelko, LM317-Beschaltung, Begrenzung, Klemmen für Wechselspannung und Ausgang)' + (eqErr ? ' – ' + eqErr : nParts ? '' : ' – die Platine ist leer'), 30));
    lines.push(L(nParts > 0 && bs.errs.length === 0 && bs.unrouted === 0 && bs.shorts === 0, 'DRC: ' + bs.errs.length + ' Fehler, ' + bs.unrouted + ' offene Verbindungen, ' + bs.shorts + ' Kurzschlüsse' + (bs.errs.length ? ' (' + String(bs.errs[0].msg).slice(0, 60) + ')' : '') + (nParts ? '' : ' – die Platine ist leer'), 20));
    const il = fin(numF(st.r3)) && numF(st.r3) > 0 ? ilimOf(numF(st.r3)) : NaN, need_ = fin(il) ? Math.max(PCB().ipcWidth(il, { oz: norm.copperOz || 1, rise: 10 }), 0.3) : NaN;
    const loadNets = ['ac1', 'ac2', 'ue', 'out', 'aus', 'gnd'].map(k => fn.roles[k]).filter(x => x !== undefined);
    let minW = Infinity, nTr = 0;
    arr(norm.tracks).forEach(t => { const nm = bs.conn.itemNet && bs.conn.itemNet[t.id] || t.net; if (loadNets.indexOf(nm) >= 0) { nTr++; minW = Math.min(minW, +t.w || 0); } });
    lines.push(L(nTr > 0 && fin(need_) && minW >= need_ - 1e-9, 'Bahnbreite: im Laststrompfad mindestens ' + fm(need_, 2) + ' mm (IPC-2221 für I_lim = ' + (fin(il) ? fm(il, 2) : '?') + ' A, 1 oz, 10 K, nie unter 0,3 mm)' + (nTr ? ', schmalste ' + fm(minW, 2) + ' mm' : ' – keine Leiterbahnen auf den Laststromnetzen'), 20));
    lines.push(L(fin(norm.w) && fin(norm.h) && norm.w <= P.boardW + 1e-6 && norm.h <= P.boardH + 1e-6 && norm.w >= 20 && norm.h >= 15 && norm.layers >= 1 && norm.layers <= P.layers, 'Maße und Lagen: ' + fm(norm.w, 0) + ' × ' + fm(norm.h, 0) + ' mm, ' + norm.layers + ' Lagen (höchstens ' + P.boardW + ' × ' + P.boardH + ' mm, ' + P.layers + ' Lagen)', 10));
    const u1 = fn.u1, bn = (u1 && fn.bnet) || {}, pm = u1 ? [bn[u1.ref + '.1'] === fn.roles.adj, bn[u1.ref + '.2'] === fn.roles.out, bn[u1.ref + '.3'] === fn.roles.ue] : [false, false, false];
    const u1ok = !!u1 && fn.roles.adj !== undefined && pm.every(Boolean);
    lines.push(L(u1ok, 'LM317-Anschlüsse: ' + (!u1 ? 'LM317 fehlt' : fn.roles.adj === undefined ? 'nicht prüfbar, die Netze fehlen' : u1ok ? 'Pad 1 = ADJ, Pad 2 = OUT, Pad 3 = IN wie im Datenblatt' : 'im Datenblatt des LM317 ist Pad 1 = ADJ, Pad 2 = OUT, Pad 3 = IN (nicht wie beim 7805)'), 10));
    let dist = Infinity; if (u1) PCB().padsOf(norm).filter(p => p.ref === u1.ref).forEach(p => { dist = Math.min(dist, p.x, norm.w - p.x, p.y, norm.h - p.y); });
    lines.push(L(fin(dist) && dist <= FACH.NA15_lm317Rand.v, 'Kühlkörperplatz: der LM317 sitzt ' + (fin(dist) ? fm(dist, 1) + ' mm' : '?') + ' vom Platinenrand (höchstens ' + FACH.NA15_lm317Rand.v + ' mm, damit er am Gehäusekühlkörper sitzen kann)', 10));
    return lines;
  }
  function pcbSolution(ctx) {
    const P = P_(ctx), st = ctlOf(dOf(need(ctx, 'netzteil.regler'))), si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), b = buildBoard(P, ilimOf(numF(st.r3)), { C: numF(si.c), R1: numF(st.r1), R2: numF(st.r2), R3: numF(st.r3) });
    return { board: b, report: boardReport(b) };
  }

  /* ====================================================================== vl8: Inbetriebnahme (MessLab-Protokoll, Werte aus den NTS-Prüfständen) */
  const normId = s => lc(s).replace(/[^a-z0-9]/g, '');
  const rowOf = (rows, id) => arr(rows).find(r => isObj(r) && normId(r.id || r.label) === id) || null;
  function rowVal(r, base) {                    // Messwert in der Grundeinheit (V oder A); mV und mA werden umgerechnet
    if (!r) return NaN;
    const v = fin(r.ist) ? r.ist : numF(r.ist); if (!fin(v)) return NaN;
    const u = String(r.unit == null ? '' : r.unit).trim();
    if (u === 'mV' && base === 'V') return v / 1000; if (u === 'mA' && base === 'A') return v / 1000;
    if (u === 'V' && base === 'V') return v; if (u === 'A' && base === 'A') return v;
    return u ? NaN : v;
  }
  function messSoll(P, ctx) {                   // Sollwerte aus den eigenen Stationen über den Kern (R3)
    const si = ctlOf(dOf(need(ctx, 'netzteil.sieb'))), sd = dOf(need(ctx, 'netzteil.regler')), st = ctlOf(sd);
    const u2 = numF(si.u2), cf = numF(si.c), r1 = numF(st.r1), r2 = numF(st.r2), rs = numF(st.r3);
    const o = { ok: fin(u2) && fin(cf) && cf > 0 && fin(r1) && fin(r2) && fin(rs) && rs > 0 };
    if (!o.ok) return o;
    const rp = sieb(P, u2, cf, P.imax, 0, si.topo === 'einweg' ? 'einweg' : 'bruecke'), sh = sch2(sd.schaltung), rf = numF(sd.rFest), r2min = sh && fin(rf) ? r2minOf(sh, rf) : 0;
    o.ue = rp.Umittel; o.dU = rp.dU; o.umax = uausOf(r1, r2); o.umin = uausOf(r1, r2min); o.ik = ilimOf(rs); o.dulastMax = P.imax * rs + 0.005 * o.umax; o.rs = rs;
    return o;
  }
  function checkMess(data, ctx) {
    const P = P_(ctx), tol = TOL(ctx), d = dOf(data), rows = arr(d.rows), lines = [], s = messSoll(P, ctx);
    if (!s.ok) return [L(false, 'Die Sollwerte lassen sich nicht berechnen: die Stationen 2 und 4 fehlen oder sind unvollständig', 100)];
    lines.push(winRel('Spannung U_e am Elko (Gleichspannung, Multimeter)', rowVal(rowOf(rows, 'ue'), 'V'), s.ue, 0.05 * tol, 'V', 2, 10, 'Lies mit dem Multimeter in Gleichspannung am Elko ab.', 'Lies mit dem Multimeter in Gleichspannung am Elko ab.'));
    const rb = rowOf(rows, 'brumm'), vb = rowVal(rb, 'V'), br = win('Brummspannung ΔU_ss am Elko (Oszilloskop, AC-Kopplung)', vb, s.dU * (1 - 0.15 * tol), s.dU * (1 + 0.15 * tol), 'V', 3, 20, 'Gib die Spitze-Spitze-Spannung an.', 'Gib die Spitze-Spitze-Spannung an.');
    if (!br.ok && fin(vb) && (vb / s.dU > 500 || vb / s.dU < 0.002)) br.text = 'Brummspannung: Zahl und Einheit passen nicht zusammen (V oder mV?), erwartet etwa ' + fm(s.dU * 1000, 0) + ' mV = ' + fm(s.dU, 3) + ' V';
    if (br.ok && !/oszillo/i.test(String(rb && rb.instrument))) { br.ok = false; br.text = 'Brummspannung: der Wert passt, aber die Brummspannung siehst du nur mit dem Oszilloskop in AC-Kopplung (Messgerät: ' + (rb && rb.instrument ? rb.instrument : 'fehlt') + ')'; }
    lines.push(br);
    lines.push(win('Ausgangsspannung U_aus,max im Leerlauf', rowVal(rowOf(rows, 'umax'), 'V'), s.umax * 0.96, s.umax * 1.04, 'V', 2, 20, 'Der Sollwert hat die Toleranz der Referenzspannung aus dem Datenblatt (U_ref 1,2 bis 1,3 V).', 'Der Sollwert hat die Toleranz der Referenzspannung aus dem Datenblatt (U_ref 1,2 bis 1,3 V).'));
    lines.push(win('Ausgangsspannung U_aus,min (Poti ganz zugedreht)', rowVal(rowOf(rows, 'umin'), 'V'), s.umin * 0.96 - 0.05, s.umin * 1.04 + 0.05, 'V', 2, 10, '', ''));
    lines.push(win('Lastausregelung ΔU = U_leer − U(I_max)', rowVal(rowOf(rows, 'dulast'), 'V'), -0.05, s.dulastMax, 'V', 3, 15, 'Die Spannung kann unter Last nicht höher sein als im Leerlauf.', 'R_S liegt außerhalb der Regelschleife: erlaubt ist I_max · R_S plus 0,5 % von U_aus.'));
    lines.push(winRel('Kurzschlussstrom I_lim', rowVal(rowOf(rows, 'ik'), 'A'), s.ik, 0.1 * tol, 'A', 3, 15, 'Miss den Kurzschlussstrom mit dem Strommessgerät.', 'Miss den Kurzschlussstrom, nicht den Nennstrom I_max.'));
    const miss = ['ue', 'brumm', 'umax', 'umin', 'dulast', 'ik'].filter(k => { const r = rowOf(rows, k); return !r || !fin(rowVal(r, 'V')) && !fin(rowVal(r, 'A')) || !String(r.unit || '').trim() || !String(r.instrument || '').trim(); });
    lines.push(L(miss.length === 0, 'Protokoll vollständig: sechs Messzeilen mit Wert, Einheit und Messgerät' + (miss.length ? ' – fehlt: ' + miss[0] : ''), 10));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), s = messSoll(P, ctx), mk = (id, label, unit, soll, ins) => ({ id: id, label: label, unit: unit, soll: rd(soll, 4), ist: rd(soll, 4), tol: 5, instrument: ins, tp: '' });
    return { rows: [mk('ue', 'U_e am Elko', 'V', s.ue, 'Multimeter DC'), mk('brumm', 'Brummspannung am Elko', 'mV', s.dU * 1000, 'Oszilloskop (AC-Kopplung)'), mk('umax', 'U_aus,max (Leerlauf)', 'V', s.umax, 'Multimeter DC'),
      mk('umin', 'U_aus,min', 'V', s.umin, 'Multimeter DC'), mk('dulast', 'Lastausregelung', 'V', P.imax * s.rs + 0.001 * s.umax, 'Multimeter DC'), mk('ik', 'Kurzschlussstrom', 'A', s.ik, 'Multimeter A')], values: {}, findings: [] };
  }

  /* ====================================================================== vl9: Fehlersuche am Kundengerät (verdeckt, Prüfstand fehler, Netz linear) */
  const PUNKTE = ['u_sek', 'u_c', 'brumm_c', 'u_aus'];
  const numUnits = txt => {                     // Zahlen mit Einheit aus dem Begründungstext in V oder A
    const out = [], re = /(\d+(?:[.,]\d+)?)\s*(mV|V|mA|A)\b/g; let m;
    while ((m = re.exec(String(txt == null ? '' : txt)))) { const v = parseFloat(m[1].replace(',', '.')); out.push(m[2] === 'mV' || m[2] === 'mA' ? v / 1000 : v); }
    return out;
  };
  function checkFehler(data, ctx) {
    const P = P_(ctx), lvl = LEVEL(ctx), d = dOf(data), c = ctlOf(d), N = N_(), m = faultMake(P), lines = [];
    if (!m) return [L(false, 'Fehlersuche: der Rechenkern des Kundengeräts ist nicht geladen', 100)];
    const fid = m.fehler, cat = N.fault.catalog.find(f => f.id === fid), sym = cat ? cat.symptome[0] : undefined;
    const acts = arr(d.seq).filter(x => isObj(x) && typeof x.do === 'string').map(x => x.do);
    const diag = typeof d.diag1 === 'string' && d.diag1 ? d.diag1 : typeof d.diagnose === 'string' && d.diagnose ? d.diagnose : typeof c.diagnose === 'string' ? c.diagnose : '';
    lines.push(L(!!diag && diag === fid, !diag ? 'Diagnose fehlt' : diag === fid ? 'Diagnose richtig: ' + (cat ? cat.name : fid) : 'Diagnose stimmt nicht: Vergleiche die Messwerte mit den Sollwerten und grenze die Stufe ein', 50));
    // Messplan
    const iT = acts.findIndex(a => /^tausche:/.test(a)), before = iT < 0 ? acts : acts.slice(0, iT), pts = before.filter(a => /^messe:/.test(a)).map(a => a.slice(6)).filter((v, i, a) => a.indexOf(v) === i);
    const dev = pts.filter(p => { try { return !!N.fault.probe(m, p).abweichung; } catch (e) { return false; } });
    let od = null; try { od = N.fault.order(acts, sym); } catch (e) { od = null; }
    const mp = [];
    if (acts[0] !== 'sicht') mp.push('beginne mit der Sichtprüfung');
    if (pts.length < 3) mp.push('mindestens drei verschiedene Messpunkte vor dem ersten Tausch (du hast ' + pts.length + ')');
    else if (dev.length === 0) mp.push('keine deiner Messungen zeigt eine Abweichung vom Sollwert: miss weiter entlang des Energieflusses');
    if (od && od.tauschOhneMessung) mp.push('tausche erst, wenn eine Messung das Bauteil eingrenzt');
    lines.push(L(mp.length === 0, 'Messplan: ' + (mp.length ? mp.join('; ') : 'Sichtprüfung zuerst, ' + pts.length + ' Messpunkte vor dem Tausch, mindestens eine Abweichung gefunden'), 20));
    // Instandsetzung
    const tp = acts.filter(a => /^tausche:/.test(a)).map(a => a.slice(8));
    const wrong = tp.filter(p => { try { return !N.fault.repair(faultMake(P), p).behoben; } catch (e) { return true; } });
    const seq = arr(d.seq).filter(x => isObj(x) && fin(x.t)).map(clone), tEnd = (seq.length ? seq[seq.length - 1].t : 0) + 1;
    const r = runRig('nts', 'fehler', { netz: 'linear', fehler: 'zufall', seed: sNtsOf(P) }, seq.concat([{ t: tEnd, set: { diagnose: diag, begruendung: c.begruendung === true } }]), tEnd + 3);
    const beh = r ? r.final.behoben === true : false;
    lines.push(L(beh && wrong.length === 0, 'Instandsetzung: ' + (tp.length === 0 ? 'es wurde kein Bauteil getauscht' : wrong.length ? 'ein falsches Bauteil wurde getauscht (' + wrong.join(', ') + ')' : beh ? 'das getauschte Bauteil behebt den Fehler' : 'der Fehler ist nach dem Tausch nicht behoben'), 20));
    // Begründung mit eigenem Messwert
    const meas = []; pts.forEach(p => { try { const q = N.fault.probe(m, p); if (q && fin(q.value)) meas.push(q.value); } catch (e) { /* weiter */ } });
    const txt = typeof d.begruendungText === 'string' ? d.begruendungText : '', nums = numUnits(txt);
    const txtOk = nums.some(v => meas.some(w => Math.abs(v - w) <= Math.max(0.05 * Math.abs(w), 0.002)));
    const sw = c.begruendung === true, okB = lvl === 3 ? txtOk : txtOk || sw;
    lines.push(L(okB, 'Begründung: ' + (txtOk ? 'dein Text nennt einen deiner Messwerte mit Einheit' : lvl === 3 ? 'nenne in deiner Begründung einen eigenen Messwert mit Einheit (Stufe Profi: Pflicht)' : sw ? 'Begründung im Prüfstand eingeschaltet' : 'nenne einen eigenen Messwert mit Einheit oder schalte im Prüfstand die Begründung ein'), 10));
    return lines;
  }
  function fehlerSolution(ctx) {
    const P = P_(ctx), N = N_(), m = faultMake(P), fid = m.fehler, fix = N.fault.parts('linear').find(p => N.fault.repair(faultMake(P), p.id).behoben);
    const seq = [{ t: 1, do: 'sicht' }]; PUNKTE.forEach((p, i) => seq.push({ t: i + 2, do: 'messe:' + p })); seq.push({ t: PUNKTE.length + 2, do: 'tausche:' + fix.id });
    let q = null; PUNKTE.forEach(p => { const x = N.fault.probe(m, p); if (!q && x.abweichung) q = x; });
    const txt = q ? 'Messung ' + q.name + ': ' + q.text + ' statt Sollwert ' + q.sollText + '. Der Fehler liegt an dieser Stufe, ich habe das Bauteil getauscht.' : 'Alle Messungen zeigen keine Abweichung.';
    return mkRig('nts', 'fehler', { netz: 'linear', fehler: 'zufall', seed: sNtsOf(P), diagnose: fid, begruendung: true }, seq, { begruendungText: txt }, PUNKTE.length + 6);
  }

  /* ====================================================================== vl10: Geräteprüfung Schutzklasse I (ELS-Prüfplatz, Prüfling aus dem Katalog) */
  const BEFUND = {
    leitung: { l: 'Anschlussleitung beschädigt', f: ['leitung-beschaedigt'] }, stecker: { l: 'Stecker locker oder beschädigt', f: ['stecker-lose'] }, gehaeuse: { l: 'Gehäuse gebrochen', f: ['gehaeuse-gebrochen'] },
    'pe-offen': { l: 'Schutzleiter unterbrochen', f: ['pe-unterbrochen'] }, 'pe-hoch': { l: 'Schutzleiter hochohmig', f: ['pe-hochohmig'] }, iso: { l: 'Isolationswiderstand zu klein (feucht oder defekt)', f: ['isolation-feucht', 'isolation-defekt'] },
    ableit: { l: 'Ableitstrom zu groß', f: ['y-kondensator-alt'] }, keiner: { l: 'kein Mangel', f: [] }
  };
  const BEFUND_IDS = Object.keys(BEFUND);
  const befundOf = fault => BEFUND_IDS.find(k => BEFUND[k].f.indexOf(fault) >= 0) || null;
  const PRUEF_SEQ = [{ t: 1, do: 'sicht:leitung' }, { t: 2, do: 'sicht:stecker' }, { t: 3, do: 'sicht:gehaeuse' }, { t: 4, do: 'rpe' }, { t: 5, do: 'riso' }, { t: 6, do: 'ipe' }, { t: 7, do: 'ergebnis' }];
  const pruefCtl = (P, lvl) => ({ geraet: 'netzteil-labor', modus: 'instandsetzung', zufall: true, seed: sElsOf(P), anzahl: nMangelOf(P, lvl) });
  function pruefExpect(P, lvl) {                // erwartetes Ergebnis aus einem vollständigen Musterablauf im Kern
    const r = runRig('els', 'pruefplatz', pruefCtl(P, lvl), PRUEF_SEQ, 10);
    if (!r) return null;
    const cats = arr(r.final.faults).map(befundOf).filter((v, i, a) => v && a.indexOf(v) === i);
    return { gesamt: r.final.gesamt, cats: cats, run: r };
  }
  function checkPruef(data, ctx) {
    const P = P_(ctx), lvl = LEVEL(ctx), d = dOf(data), ex = pruefExpect(P, lvl), lines = [];
    if (!ex) return [L(false, 'Geräteprüfung: der Rechenkern des Prüfplatzes ist nicht geladen', 100)];
    const seq = arr(d.seq).filter(x => isObj(x) && fin(x.t) && typeof x.do === 'string'), acts = seq.map(x => x.do), ix = k => acts.indexOf(k);
    const sights = ['sicht:leitung', 'sicht:stecker', 'sicht:gehaeuse'], iS = sights.map(ix), last = Math.max.apply(null, iS), allS = iS.every(v => v >= 0);
    const ord = allS && ix('rpe') > last && ix('riso') > ix('rpe') && ix('ipe') > ix('riso') && ix('ergebnis') > ix('ipe');
    const miss = sights.concat(['rpe', 'riso', 'ipe', 'ergebnis']).filter(k => ix(k) < 0);
    lines.push(L(ord, 'Reihenfolge: ' + (ord ? 'Sichtprüfung an allen drei Stellen, dann R_PE, R_ISO, I_PE und Ergebnis' : miss.length ? 'es fehlt ' + miss[0].replace('sicht:', 'Sichtprüfung ') + ' (feste Reihenfolge: Sichtprüfung an allen Stellen, R_PE, R_ISO, I_PE, Ergebnis)' : 'die feste Reihenfolge ist Sichtprüfung an allen drei Stellen, dann R_PE, R_ISO, I_PE, Ergebnis'), 25));
    const r = runRig('els', 'pruefplatz', pruefCtl(P, lvl), seq, Math.max(10, (seq.length ? seq[seq.length - 1].t : 0) + 3)), done = r ? arr(r.final.done) : [], mt = metersOf(r);
    const gOk = ['rpe', 'riso', 'ipe'].every(k => done.indexOf(k) >= 0 && fin(mt[k]));
    lines.push(L(gOk, 'Grenzwerte: ' + (gOk ? 'R_PE ' + fm(mt.rpe, 3) + ' Ω (Grenze ≤ ' + fm(el_('rpe_5m'), 1) + ' Ω), R_ISO ' + fm(mt.riso, 3) + ' MΩ (Grenze ≥ ' + fm(el_('riso_sk1'), 0) + ' MΩ), I_PE ' + fm(mt.ipe, 3) + ' mA (Grenze ≤ ' + fm(el_('ipe_sk1'), 1) + ' mA) – alle drei Schritte gemessen' : 'es fehlt ein Messschritt: R_PE, R_ISO und I_PE müssen alle gemessen werden'), 20));
    lines.push(L(d.urteil === ex.gesamt, 'Urteil: ' + (d.urteil === 'bestanden' || d.urteil === 'nicht bestanden' ? (d.urteil === ex.gesamt ? '„' + d.urteil + '“ passt zu den Messwerten' : '„' + d.urteil + '“ passt nicht zu den Messwerten: vergleiche jeden Wert mit seinem Grenzwert') : 'fehlt'), 25));
    const got = [d.befund1, d.befund2].filter(v => typeof v === 'string' && v && v !== 'keiner' && BEFUND[v]).filter((v, i, a) => a.indexOf(v) === i), want = ex.cats;
    const bOk = got.length === want.length && want.every(w => got.indexOf(w) >= 0);
    lines.push(L(bOk, 'Befund: ' + (bOk ? (want.length ? want.map(w => BEFUND[w].l).join(' und ') : 'kein Mangel') : (got.length || d.befund1 === 'keiner' ? 'der Befund passt nicht zu den Messwerten: ordne den Befund dem Messschritt zu, der ihn zeigt' : 'fehlt')), 20));
    const sperr = ex.gesamt === 'nicht bestanden';
    lines.push(L(d.massnahme === (sperr ? 'sperren' : 'freigeben'), 'Maßnahme: ' + (d.massnahme === (sperr ? 'sperren' : 'freigeben') ? (sperr ? 'Gerät sperren und kennzeichnen, Mangel beheben, erneut prüfen' : 'Gerät freigeben') : d.massnahme ? 'die Maßnahme passt nicht zum Urteil (nicht bestandene Geräte werden gesperrt, bestandene freigegeben)' : 'fehlt'), 10));
    return lines;
  }
  function pruefSolution(ctx) {
    const P = P_(ctx), lvl = LEVEL(ctx), ex = pruefExpect(P, lvl), sperr = ex.gesamt === 'nicht bestanden';
    return mkRig('els', 'pruefplatz', pruefCtl(P, lvl), PRUEF_SEQ, { befund1: ex.cats[0] || 'keiner', befund2: ex.cats[1] || 'keiner', urteil: ex.gesamt, massnahme: sperr ? 'sperren' : 'freigeben' }, 10);
  }

  /* ====================================================================== vlF: Abschlusstest (ein Tag am Laborplatz) */
  function loadPoints(P, c) {                   // acht Lastpunkte (je U_set und vier Lasten) aus den eigenen Slots, alles über den Kern
    const N = N_(), T = T_(), out = [], si = ctlOf(c.sieb), st = ctlOf(c.regler), u2 = numF(si.u2), cf = numF(si.c), rs = numF(st.r3), r1 = numF(st.r1), r2 = numF(st.r2);
    if (!fin(u2) || !fin(cf) || cf <= 0 || !fin(rs) || rs <= 0 || !fin(r1) || !fin(r2)) return null;
    const il = ilimOf(rs), uHi = uausOf(r1, r2), cfg = T.cfgFromControls(ctlOf(c.therm), 'lm317'), topo = si.topo === 'einweg' ? 'einweg' : 'bruecke';
    [P.umax, 5].forEach(us => [['CV 100 Ω', 100, 'CV'], ['CV 2U/I_lim', 2 * us / il, 'CV'], ['CC 0,5U/I_lim', 0.5 * us / il, 'CC'], ['Kurzschluss', 0, 'CC']].forEach(x => {
      const cv = N.lab.cvcc({ Uset: us, Iset: il, Rlast: x[1] }), iu = Math.max(cv.Iout, 1e-6);
      const lo = N.rect.ripple({ topo: topo, U2: u2 * (1 - P.netzTol), C: cf, I: iu }), hi = N.rect.ripple({ topo: topo, U2: u2 * (1 + P.netzTol), C: cf, I: iu });
      const dr = cv.modus === 'CV' ? N.lin.dropout({ typ: 'lm317', Uaus: cv.Uout, Uein: lo.Umin }).betrieb : true, p = Math.max(0, hi.Umittel - cv.Uout) * cv.Iout;
      let tj = NaN; try { tj = T.steady(cfg, p, P.tAmb).tj; } catch (e) { tj = NaN; }
      out.push({ name: rd(us, 2) + ' V ' + x[0], us: us, soll: x[2], modus: cv.modus, uout: cv.Uout, iout: cv.Iout, drop: dr, p: p, tj: tj });
    }));
    return { pts: out, il: il, uHi: uHi };
  }
  function finalCheck(slots, spec, level) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolMul = { 1: 1.5, 2: 1, 3: 0.6 }[lv];
    const ctx = { spec: { params: P }, level: lv, tol: tolMul, noSol: true, slots: slots || {}, get: k => (slots || {})[k] };
    const g = k => dOf(slotOf(ctx, 'netzteil.' + k)), lines = [], kpis = [];
    const c = { trafo: g('trafo'), sieb: g('sieb'), ds: g('ds'), regler: g('regler'), therm: g('therm'), sch: g('sch'), pcb: g('pcb'), mess: g('mess'), fehler: g('fehler'), pruef: g('pruef') };
    const si = ctlOf(c.sieb), st = ctlOf(c.regler), u2 = numF(si.u2), cf = numF(si.c), lp = loadPoints(P, c), ok0 = !!lp, il = lp ? lp.il : NaN, uHi = lp ? lp.uHi : NaN;
    const ilOk = fin(il) && il >= P.imax - 1e-9 && il <= FACH.NA7_ilimFaktor.v * P.imax + 1e-9, uOk = fin(uHi) && uHi >= P.umax - 1e-9;
    const bad = lp ? lp.pts.filter(p => p.modus !== p.soll || (p.soll === 'CV' ? Math.abs(p.uout - p.us) > 0.04 * p.us : Math.abs(p.iout - il) > 0.1 * il)) : [];
    lines.push(L(ok0 && ilOk && uOk && bad.length === 0, 'CV/CC: ' + (ok0 ? (bad.length ? 'Lastpunkt „' + bad[0].name + '“ liefert ' + bad[0].modus + ' mit ' + fm(bad[0].uout, 2) + ' V und ' + fm(bad[0].iout, 3) + ' A' : 'alle acht Lastpunkte (' + fm(P.umax, 0) + ' V und 5 V, je vier Lasten) stimmen: Konstantspannung ±4 %, Konstantstrom ±10 % bei I_lim = ' + fm(il, 3) + ' A') + (ilOk ? '' : ' – I_lim liegt nicht zwischen I_max und 1,2 · I_max') + (uOk ? '' : ' – U_aus,max erreicht U_max nicht') : 'nicht berechenbar (Stationen 2, 4 oder 5 fehlen)'), 30));
    const lo = fin(u2) && fin(cf) && cf > 0 ? sieb(P, u2, cf, P.imax, -1, si.topo === 'einweg' ? 'einweg' : 'bruecke') : null, dropBad = lp ? lp.pts.filter(p => !p.drop) : [];
    lines.push(L(ok0 && !!lo && lo.ok && lo.Umin >= dropReq(P) - 1e-9 && dropBad.length === 0, 'Dropout: ' + (ok0 ? (dropBad.length ? 'am Lastpunkt „' + dropBad[0].name + '“ fällt der Regler aus der Regelung' : 'der Regler bleibt an allen Konstantspannungs-Punkten in der Regelung') + (lo && lo.ok && lo.Umin < dropReq(P) ? '; die Auslegung aus Station 1 und 2 verletzt 1,025 · U_max + 2 V (' + fm(lo.Umin, 2) + ' V)' : '; U_dc,min ' + (lo && lo.ok ? fm(lo.Umin, 2) + ' V' : '?') + ' erfüllt die Auslegung') : 'nicht berechenbar'), 20));
    const hot = lp ? lp.pts.filter(p => !(fin(p.tj) && p.tj <= P.tjGrenze)) : [], tjMax = lp ? Math.max.apply(null, lp.pts.map(p => (fin(p.tj) ? p.tj : Infinity))) : NaN, pvMax = lp ? Math.max.apply(null, lp.pts.map(p => p.p)) : NaN;
    lines.push(L(ok0 && hot.length === 0, 'Thermik: ' + (ok0 ? (hot.length ? 'am Lastpunkt „' + hot[0].name + '“ wird die Sperrschicht ' + (fin(hot[0].tj) ? fm(hot[0].tj, 1) + ' °C' : 'zu heiß') + ' (Grenze ' + fm(P.tjGrenze, 0) + ' °C)' : 'alle acht Lastpunkte unter ' + fm(P.tjGrenze, 0) + ' °C, am heißesten ' + fm(tjMax, 1) + ' °C bei P_V = ' + fm(pvMax, 2) + ' W') : 'nicht berechenbar'), 20));
    // Konsistenz: ds = sch = pcb = mess
    const ix = nlIdx(c.sch.netlist), ps = ix.ok ? psuOf(ix) : null, board = asBoard(c.pcb.board), fn = board && PCB() ? boardFunc(PCB().normalize(board)) : null, ds = c.ds, items = arr(ds.items), vals = isObj(ds.vals) ? ds.vals : {};
    const kon = [], r1 = numF(st.r1), r2 = numF(st.r2), r3 = numF(st.r3);
    if (!items.some(x => x && x.role === 'regler' && x.ds === 'tf-lm317') || !ps || !ps.lm || !fn || !fn.u1) kon.push('der Regler ist nicht überall der LM317 (Datenblatt, Schaltplan, Platine)');
    const cs = ps && ps.ce ? capOf(ps.ce.value) : NaN; if (!(fin(cf) && sameVal(numF(vals.cUf), cf, 0.005) && sameVal(cs, cf, 0.005))) kon.push('die Kapazität ist nicht in Station 2, 3 und 6 gleich');
    if (!(ps && ps.r1 && ps.r2 && ps.rs && sameVal(rVal(ps.r1), r1, 0.01) && sameVal(rVal(ps.r2), r2, 0.01) && sameVal(rVal(ps.rs), r3, 0.01))) kon.push('R1, R2,max und R_S sind in Station 4 und im Schaltplan nicht gleich');
    const um = rowVal(rowOf(arr(c.mess.rows), 'umax'), 'V'); if (!(fin(um) && fin(uHi) && Math.abs(um - uHi) <= 0.04 * uHi)) kon.push('der Messwert U_aus,max im Messprotokoll passt nicht zu Station 4');
    const un = numF(vals.unV), unN = fin(u2) ? unMin(P, u2) : null; if (!(fin(un) && unN !== null && un >= unN)) kon.push('die Nennspannung des Elkos reicht nicht für 1,2 · Û');
    lines.push(L(kon.length === 0, 'Konsistenz: ' + (kon.length ? kon[0] : 'Datenblatt-Auswahl, Schaltplan, Platine und Messprotokoll gehören zusammen (LM317, C, R1, R2,max, R_S, Elko-Nennspannung)'), 15));
    const pr = checkPruef(c.pruef, ctx), pOk = pr.length >= 4 && pr[2].ok && pr[3].ok;
    lines.push(L(pOk, 'Geräteprüfung: ' + (pOk ? 'Urteil und Befund der Prüfung sind richtig' : 'Urteil oder Befund der Geräteprüfung stimmt nicht'), 15));
    const k = (key, label, value, unit, ok) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 3) : null, unit: unit, ok: !!ok && fin(value) });
    const rp = fin(u2) && fin(cf) && cf > 0 ? sieb(P, u2, cf, P.imax, 0, si.topo === 'einweg' ? 'einweg' : 'bruecke') : null;
    k('umax', 'Höchste Ausgangsspannung', uHi, 'V', uOk && fin(uHi) && uHi <= (1 + FACH.NA5_eReserve.v) * P.umax + 1e-9);
    k('ilim', 'Strombegrenzung', il, 'A', ilOk);
    k('brumm', 'Brummspannung am Elko', rp && rp.ok ? rp.dU : NaN, 'V', !!rp && rp.ok && rp.dU <= nl_('ripple_ok') / 100 * rp.peak + 1e-9);
    k('tjMax', 'Sperrschichttemperatur (heißester Punkt)', fin(tjMax) ? tjMax : NaN, '°C', ok0 && hot.length === 0);
    k('pvMax', 'Verlustleistung im Kurzschluss', pvMax, 'W', ok0);
    k('pruefung', 'Geräteprüfung richtig', pOk ? 1 : 0, '', pOk);
    return { lines: lines, kpis: kpis, rep: null };
  }

  /* ====================================================================== Stationen */
  const currentState = () => { try { const V = root.Verbund; return V && V.state ? V.state(PID) : null; } catch (e) { return null; } };
  const currentSpec = () => { try { const V = root.Verbund; const s = V && V.spec ? V.spec(PID) : null; return isObj(s) ? s : null; } catch (e) { return null; } };
  const F_NUM = (key, label, unit, hint) => ({ key: key, label: label, type: 'number', unit: unit, hint: hint });
  const STATIONS = [
    { id: 'vl1', lab: 'vb', cat: 'Labornetzteil', title: 'Trafo für das Netzteil wählen', level: 1,
      on: 'nts',
      text: 'Dein Netzteil braucht einen Trafo. Rechne vom Ausgang zurück: Welche Spannung braucht der Regler mindestens, und wie viel verlierst du an den Dioden und durch den Brumm? Wähle die kleinste Sekundärspannung, die reicht. Stelle im Prüfstand Windungen und Belastung ein, trage den Effektivstrom ein und wähle die Nennleistung.',
      in: [], out: 'netzteil.trafo', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'trafo' },
      hint: ['Rechne vom Ausgang zurück: Welche Spannung braucht der Regler mindestens, und wie viel verlierst du an den Dioden und durch den Brumm?',
        'Û = U2 · √2 − 2 · U_F. Prüfe jede Trafospannung der Reihe, beginnend mit der kleinsten; bei Netztoleranz rechnest du mit −10 %.',
        'Bei Brücke mit Ladeelko ist der Effektivstrom im Trafo deutlich größer als der Gleichstrom (Faktor im Lastenheft). Die Nennleistung ist Spannung mal Effektivstrom; nimm den nächsten Reihenwert darüber.'],
      check: safe(checkTrafo, 'Trafo'),
      form: [{ key: 'u2', label: 'Sekundärspannung U2 (Effektivwert)', type: 'select', options: U2S.map(u => ({ value: String(u), label: u + ' V' })) }, F_NUM('i2eff', 'Effektivstrom I_2,eff im Trafo', 'A'),
        { key: 'snVA', label: 'Nennleistung des Trafos', type: 'select', options: SNS.map(s => ({ value: String(s), label: s + ' VA' })) }],
      starter: ctx => ({ lab: 'nts', rig: 'trafo', ctl: { n1: N1, n2: 69, ri: 0.4, gleichspannung: false, iLast: 2.5, last: 'R' }, state: {}, derived: {} }),
      solution: ctx => trafoSolution(ctx),
      mutants: [
        { name: 'U2 = 12 V (zu klein)', levels: [3], mutate: d => { d.u2 = 12; d.ctl.n2 = 60; return d; }, expectFail: ['Trafospannung'] },
        { name: 'U2 = 24 V (viel zu groß)', mutate: d => { d.u2 = 24; d.ctl.n2 = 120; return d; }, expectFail: ['Trafospannung'] },
        { name: 'Windungszahl n2 falsch', mutate: d => { d.ctl.n2 += 10; return d; }, expectFail: ['Windungen'] },
        { name: 'Nennleistung 5 VA', mutate: d => { d.snVA = 5; return d; }, expectFail: ['Nennleistung'] },
        { name: 'Effektivstrom gleich I_max (Faktor vergessen)', mutate: (d, ctx) => { d.i2eff = P_(ctx).imax; return d; }, expectFail: ['Effektivstrom'] }
      ] },

    { id: 'vl2', lab: 'vb', cat: 'Labornetzteil', title: 'Brücke und Ladeelko auslegen', level: 2,
      on: 'nts',
      text: 'Stelle im Prüfstand die Brücke mit Ladeelko ein. Wähle den Elko aus der Reihe E6 so, dass der Brumm höchstens 10 Prozent von Û bleibt und der Regler auch bei der kleinsten Netzspannung genug Eingangsspannung hat. Nimm den Trafo aus Station 1 und den Laststrom I_max. Trage den Spitzenstrom aus dem Prüfstand ein.',
      in: ['netzteil.trafo'], out: 'netzteil.sieb', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'gleich' },
      assist: { 1: { rig: 'gleich', ctl: { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, iLast: 0.5 } } },
      hint: ['Die Brücke lädt den Elko 100-mal je Sekunde nach; dazwischen liefert nur der Elko den Strom.',
        'ΔU = I/(f_p · C) (Näherung). Rechne zuerst die kleinste Spannung am Elko, die der Regler noch braucht, dann die größte erlaubte Brummspannung.',
        'Prüfe beide Bedingungen (Brumm in Prozent von Û und Mindestspannung) und nimm den nächsten Wert der E6-Reihe darüber.'],
      check: safe(checkGleich, 'Brücke und Elko'),
      form: [F_NUM('iPeak', 'Spitzenstrom durch die Dioden (Meter im Prüfstand)', 'A')],
      starter: ctx => ({ lab: 'nts', rig: 'gleich', ctl: { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 0.5 }, state: {}, derived: {} }),
      solution: ctx => gleichSolution(ctx),
      mutants: [
        { name: 'Elko 1000 µF (zu klein)', mutate: d => { d.ctl.c = 1000; return d; }, expectFail: ['Brumm', 'Dropout'] },
        { name: 'Einweggleichrichter', mutate: d => { d.ctl.topo = 'einweg'; return d; }, expectFail: ['Schaltung'] },
        { name: 'Schottky-Dioden', mutate: d => { d.ctl.diode = 'schottky'; return d; }, expectFail: ['Schaltung'] },
        { name: 'Elko 6800 µF (über dem Höchstwert)', mutate: d => { d.ctl.c = 6800; return d; }, expectFail: ['Reihe'] },
        { name: 'Laststrom 0,1 A im Prüfstand', mutate: d => { d.ctl.iLast = 0.1; return d; }, expectFail: ['Eingang'] }
      ] },

    { id: 'vl3', lab: 'vb', cat: 'Labornetzteil', title: 'Regler, Gleichrichter und Elko aus Datenblättern wählen', level: 2,
      on: 'ds',
      text: 'Wähle in den Übungsdatenblättern den Regler und den Gleichrichter. Suche die Grenzwerte, nicht die typischen Werte. Für den Elko gibt es kein Datenblatt: trage Kapazität und Nennspannung ein. Übernimm die Wärmewerte des Reglers für die Kühlung.',
      in: ['netzteil.sieb'], out: 'netzteil.ds', type: 'ds.pick', w: 100, pass: null,
      open: {},
      hint: ['Suche im Datenblatt die Grenzwerte, nicht die typischen Werte.',
        'Im Kurzschluss liegt die ganze Eingangsspannung am Regler; vergleiche mit der größten Spannungsdifferenz.',
        'Bei der Brücke sperrt jede Diode etwa den Scheitelwert; das Datenblatt verlangt 20 % Reserve. Der Elko muss die Leerlaufspannung bei höchster Netzspannung aushalten.'],
      check: safe(checkDs, 'Datenblätter'),
      form: [{ key: 'regler', label: 'Regler', type: 'select', options: [{ value: 'tf-lm317', label: 'LM317 (einstellbar, 1,5 A)' }, { value: 'tf-7805', label: '7805 (fest 5 V)' }, { value: 'tf-ne555', label: 'NE555 (Timer)' }] },
        { key: 'gleichrichter', label: 'Gleichrichter', type: 'select', options: [{ value: 'tf-1n4007', label: 'Einzeldioden 1N4007' }, { value: 'tf-1n4148', label: 'Einzeldioden 1N4148' }, { value: 'bruecke', label: 'Brückengleichrichter (Bezeichnung eintragen)' }] },
        F_NUM('anzahlD', 'Anzahl der Einzeldioden', ''), { key: 'bruecke', label: 'Bezeichnung des Brückengleichrichters', type: 'text', hint: 'Zum Beispiel B40C1500 (leer lassen bei Einzeldioden)' },
        F_NUM('cUf', 'Elko: Kapazität', 'µF'), { key: 'unV', label: 'Elko: Nennspannung', type: 'select', options: UNS.map(u => ({ value: String(u), label: u + ' V' })) },
        F_NUM('rthJC', 'Regler: R_thJC aus dem Datenblatt', 'K/W'), F_NUM('tjMax', 'Regler: T_jmax aus dem Datenblatt', '°C')],
      fromForm: v => {
        v = v || {}; const n = k => { const x = numOf(v[k]); return fin(x) ? x : null; }, reg = dsOf(v.regler), isBr = v.gleichrichter === 'bruecke', gl = isBr ? null : dsOf(v.gleichrichter);
        const items = [{ role: 'regler', ds: String(v.regler || ''), part: reg ? reg.part : '', ref: reg ? reg.ref : '' }];
        if (isBr) items.push({ role: 'gleichrichter', ds: '', part: String(v.bruecke || ''), ref: String(v.bruecke || '') }); else items.push({ role: 'gleichrichter', ds: String(v.gleichrichter || ''), part: gl ? gl.part : '', ref: gl ? gl.ref : '' });
        const vals = {}; if (n('cUf') !== null) vals.cUf = n('cUf'); if (n('unV') !== null) vals.unV = n('unV'); if (isBr && v.bruecke) vals.bruecke = String(v.bruecke).trim(); else if (n('anzahlD') !== null) vals.anzahlD = n('anzahlD');
        const calc = {}; if (n('rthJC') !== null) calc.rthJC = n('rthJC'); if (n('tjMax') !== null) calc.tjMax = n('tjMax');
        return { items: items, calc: calc, vals: vals };
      },
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => dsSolution(ctx),
      mutants: [
        { name: 'Elko 16 V (Nennspannung zu klein)', mutate: d => { d.vals.unV = 16; return d; }, expectFail: ['Elko Nennspannung'] },
        { name: 'Brücke B40R800 (nur ohmsche Last)', mutate: d => { d.items[1] = { role: 'gleichrichter', ds: '', part: 'B40R800', ref: 'B40R800' }; delete d.vals.anzahlD; d.vals.bruecke = 'B40R800'; return d; }, expectFail: ['Gleichrichter'] },
        { name: 'Festregler 7805 statt LM317', mutate: d => { d.items[0] = { role: 'regler', ds: 'tf-7805', part: 'TF-7805', ref: '7805' }; return d; }, expectFail: ['Regler'] },
        { name: 'Kapazität weicht von Station 2 ab', mutate: d => { d.vals.cUf = d.vals.cUf * 2; return d; }, expectFail: ['Elko Kapazität'] },
        { name: 'R_thJC falsch übernommen', mutate: d => { d.calc.rthJC = 50; return d; }, expectFail: ['Thermikwerte'] }
      ] },

    { id: 'vl4', lab: 'vb', cat: 'Labornetzteil', title: 'Regler und Strombegrenzung einstellen', level: 3,
      on: 'nts',
      text: 'Lege den Regler fest: R1 und R2 für die Ausgangsspannung, dazu die Strombegrenzung mit Transistor und R_S. Stelle den LM317 im Prüfstand ein und trage Poti, Festwiderstand und die Belastbarkeit von R_S ein. U_aus muss bis U_max reichen, ohne dass der Regler aus der Regelung fällt, und mit zugedrehtem Poti unter 2 V sinken.',
      in: ['netzteil.sieb', 'netzteil.ds'], out: 'netzteil.regler', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'stabil' },
      hint: ['Der Regler hält zwischen OUT und ADJ die Referenzspannung; R1 bestimmt den Teilerstrom, der immer fließen muss.',
        'U_aus = U_ref · (1 + R2/R1). Das Poti stellt R2 von klein bis groß; ein Festwiderstand in Reihe oder parallel legt das obere Ende fest.',
        'Die Strombegrenzung setzt ein, wenn am Messwiderstand die Basis-Emitter-Spannung abfällt: I_lim = U_BE/R_S. Nimm den E12-Wert, der knapp über dem geforderten Strom begrenzt.'],
      check: safe(checkStabil, 'Regler'),
      form: [F_NUM('poti', 'Poti für R2', 'Ω'), F_NUM('rFest', 'Festwiderstand zum Poti', 'Ω'), { key: 'schaltung', label: 'Schaltung von Poti und Festwiderstand', type: 'select', options: [{ value: 'reihe', label: 'in Reihe' }, { value: 'parallel', label: 'parallel' }] }, F_NUM('pRsW', 'Belastbarkeit des Messwiderstands R_S', 'W')],
      starter: ctx => ({ lab: 'nts', rig: 'stabil', ctl: { art: '7805', ue: 14, uz: 5.1, rv: 470, r1: 240, r2: 970, t2: false, r3: 0.6, rlast: 4700, iLast: 0.6, kurz: false }, state: {}, derived: {} }),
      solution: ctx => reglerSolution(ctx),
      mutants: [
        { name: 'R1 = 240 Ω (Mindestlast verletzt)', mutate: d => { d.ctl.r1 = 240; d.ctl.r2 = 2102; d.poti = 2200; d.rFest = 47000; d.schaltung = 'parallel'; return d; }, expectFail: ['Mindestlast'] },
        { name: 'R2 = 1000 Ω (U_max nicht erreicht)', mutate: d => { d.ctl.r2 = 1000; d.poti = 1000; d.rFest = 0; d.schaltung = 'reihe'; return d; }, expectFail: ['Höchstspannung'] },
        { name: 'R2 = 1200 Ω (Spannung zu hoch)', mutate: d => { d.ctl.r2 = 1200; d.poti = 1200; d.rFest = 0; d.schaltung = 'reihe'; return d; }, expectFail: ['Höchstspannung', 'Dropout'] },
        { name: 'Festwiderstand 330 Ω in Reihe (U_aus,min zu hoch)', mutate: d => { d.poti = d.ctl.r2 - 330; d.rFest = 330; d.schaltung = 'reihe'; return d; }, expectFail: ['Kleinstspannung'] },
        { name: 'R_S = 1,0 Ω (Begrenzung zu hoch)', mutate: d => { d.ctl.r3 = 1; return d; }, expectFail: ['Strombegrenzung'] },
        { name: 'R_S = 1,8 Ω (Begrenzung setzt zu früh ein)', mutate: d => { d.ctl.r3 = 1.8; return d; }, expectFail: ['Strombegrenzung'] },
        { name: 'Begrenzungs-Transistor aus', mutate: d => { d.ctl.t2 = false; return d; }, expectFail: ['Bauart'] }
      ] },

    { id: 'vl5', lab: 'vb', cat: 'Labornetzteil', title: 'Kühlkörper für den Regler wählen', level: 3,
      on: 'thm',
      text: 'Wähle den Kühlkörper für den ungünstigsten Betriebspunkt, den Kurzschluss bei höchster Netzspannung. Stelle im Thermik-Prüfstand den LM317 mit Kühlkörper, Übergang und Befestigung ein. Die Sperrschicht darf die Grenze aus dem Lastenheft nicht überschreiten, und die Montage muss fehlerfrei sein.',
      in: ['netzteil.regler', 'netzteil.sieb'], out: 'netzteil.therm', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'linear' },
      hint: ['Am Längsregler ist der Kurzschluss der schlimmste Fall: Die ganze Eingangsspannung fällt am Regler ab.',
        'T_j = T_a + P · (R_thJC + R_thCK + R_thK). Die Fahne liegt am Ausgang: Überlege, wie Kühlkörper und Gerätemasse zueinander stehen.',
        'Rechne den größten erlaubten Gesamtwiderstand aus der Temperaturgrenze und ziehe Gehäuse und Übergang ab. Glimmer isoliert, kostet aber Wärmewiderstand; ohne Paste wird er deutlich schlechter.'],
      check: safe(checkTherm, 'Kühlkörper'),
      starter: ctx => ({ lab: 'thm', rig: 'linear', ctl: { device: '7805', ue: 12, ua: 5, loadMode: 'strom', iLoad: 0.5, heatsink: 'none', joint: 'direkt', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }, state: {}, derived: {} }),
      solution: ctx => thermSolution(ctx),
      mutants: [
        { name: 'Glimmer ohne Wärmeleitpaste', mutate: d => { d.ctl.joint = 'glimmer'; d.ctl.paste = 'keine'; d.ctl.bushing = true; return d; }, expectFail: ['Montage'] },
        { name: 'Direkt auf dem geerdeten Kühlkörper', mutate: d => { d.ctl.joint = 'direkt'; d.ctl.paste = 'duenn'; d.ctl.ksPot = 'masse'; return d; }, expectFail: ['Montage'] },
        { name: 'Ohne Kühlkörper', mutate: d => { d.ctl.heatsink = 'none'; return d; }, expectFail: ['Sperrschicht'] },
        { name: 'Schraube locker', mutate: d => { d.ctl.screw = 'locker'; return d; }, expectFail: ['Montage'] },
        { name: 'Lüfter eingeschaltet', mutate: d => { d.ctl.fan = 'leise'; return d; }, expectFail: ['Kühlart'] },
        { name: 'Falsches Bauteil im Prüfstand (7805)', mutate: d => { d.ctl.device = '7805'; return d; }, expectFail: ['Bauteil'] },
        { name: 'Eingangsspannung zu klein eingestellt', mutate: d => { d.ctl.ue = 8; return d; }, expectFail: ['Betriebspunkt'] }
      ] },

    { id: 'vl6', lab: 'vb', cat: 'Labornetzteil', title: 'Schaltplan des Netzteils zeichnen', level: 2,
      on: 'sch',
      text: 'Zeichne den Schaltplan deines Netzteils mit den gewählten Bauteilen: Sicherung, Trafo, Brücke, Ladeelko, LM317 mit R1 und R2, Messwiderstand R_S und Begrenzungstransistor. Die Werte kommen aus deinen Stationen. Achte auf die Polung des Elkos und auf die Anschlüsse des Reglers.',
      in: ['netzteil.ds', 'netzteil.regler'], out: 'netzteil.sch', type: 'sch.circuit', w: 100, pass: null,
      open: {},
      assist: { 1: { kind: 'startschaltung', parts: ['Masse'] } },
      hint: ['Zeichne den Energiefluss von links nach rechts: Netz, Trafo, Gleichrichter, Speicher, Regler, Ausgang.',
        'Zwischen OUT und ADJ liegt die Referenzspannung; dort gehört R1 hin.',
        'Der Begrenzungstransistor misst die Spannung am Messwiderstand zwischen Basis und Emitter und zieht mit dem Kollektor den Einstellanschluss herunter.'],
      check: safe(checkSch, 'Schaltplan'),
      starter: ctx => ({ lab: 'sch', name: 'neu', netlist: { v: 1, name: 'neu', parts: [], nets: [] }, meas: {}, snap: {} }),
      solution: ctx => buildSch(P_(ctx), ctx),
      mutants: [
        { name: 'Elko verpolt', mutate: d => { movePin(d.netlist, 'C1.1', 'GND'); movePin(d.netlist, 'C1.2', 'UE'); return d; }, expectFail: ['Ladeelko'] },
        { name: 'Eine Diode verkehrt herum', mutate: d => { const nl = d.netlist; if (nl.parts.some(p => p.ref === 'D2')) { movePin(nl, 'D2.A', 'UE'); movePin(nl, 'D2.K', 'AC2'); } else { movePin(nl, 'B1.AC1', 'GND'); } return d; }, expectFail: ['Gleichrichtung'] },
        { name: 'R1 und R2 vertauscht', mutate: d => { const a = d.netlist.parts.find(p => p.ref === 'R1'), b = d.netlist.parts.find(p => p.ref === 'R2'), t = a.value; a.value = b.value; b.value = t; return d; }, expectFail: ['Werte'] },
        { name: 'Kollektor des Transistors an Masse statt ADJ', mutate: d => { movePin(d.netlist, 'Q1.C', 'GND'); return d; }, expectFail: ['Strombegrenzung'] },
        { name: 'Messwiderstand R_S fehlt', mutate: d => { rmPart(d.netlist, 'R3'); return d; }, expectFail: ['Strombegrenzung'] },
        { name: 'Sicherung fehlt', mutate: d => { rmPart(d.netlist, 'F1'); return d; }, expectFail: ['Sicherung'] }
      ] },

    { id: 'vl7', lab: 'vb', cat: 'Labornetzteil', title: 'Platine für das Netzteil entwerfen', level: 3,
      on: 'pcb',
      text: 'Entwirf aus deinem Schaltplan die Platine, höchstens 80 mal 60 Millimeter und zweilagig. Der Trafo und der Ausgang werden Schraubklemmen. Der LM317 gehört an den Rand, damit er am Gehäusekühlkörper sitzen kann. Achte auf die Anschlussfolge im Datenblatt und auf breite Bahnen im Laststrompfad.',
      in: ['netzteil.sch', 'netzteil.regler'], out: 'netzteil.pcb', type: 'pcb.board', w: 100, pass: null,
      open: {},
      assist: { 1: { kind: 'vorplatziert' } },
      hint: ['Übernimm zuerst alle Netze aus dem Schaltplan, dann ordne den Energiefluss.',
        'Die Bahnbreite richtet sich nach dem größten Dauerstrom, also dem Begrenzungsstrom.',
        'Der Regler kommt an den Rand, damit er am Gehäusekühlkörper sitzen kann; prüfe die Anschlussfolge im Datenblatt.'],
      check: safe(checkPcb, 'Platine'),
      starter: ctx => { const P = P_(ctx); const b = PCB().newBoard({ id: 'netzteil', name: 'Neue Platine', w: P.boardW, h: P.boardH, layers: P.layers }); return { board: b, report: boardReport(b) }; },
      solution: ctx => pcbSolution(ctx),
      mutants: [
        { name: 'Leiterbahnen im Laststrompfad nur 0,2 mm', mutate: d => { d.board.tracks.forEach(t => { t.w = 0.2; }); d.report = boardReport(PCB().normalize(d.board)); return d; }, expectFail: ['Bahnbreite'] },
        { name: 'LM317-Pads in der Reihenfolge des 7805', mutate: d => { d.board.nets.forEach(n => { n.pins = n.pins.map(p => p === 'U1.3' ? 'U1.x' : p).map(p => (p === 'U1.1' ? 'U1.3' : p)).map(p => (p === 'U1.x' ? 'U1.1' : p)); }); d.report = boardReport(PCB().normalize(d.board)); return d; }, expectFail: ['LM317-Anschlüsse'] },
        { name: 'Platine 100 mal 60 mm', mutate: d => { d.board.w = 100; d.report = boardReport(PCB().normalize(d.board)); return d; }, expectFail: ['Maße und Lagen'] },
        { name: 'Eine Verbindung nicht verlegt', mutate: d => { d.board.tracks = d.board.tracks.slice(1); d.report = boardReport(PCB().normalize(d.board)); return d; }, expectFail: ['DRC'] },
        { name: 'LM317 in der Platinenmitte', mutate: d => { const u = d.board.parts.find(p => p.ref === 'U1'); u.x = 40; u.y = 30; d.board.tracks = []; d.report = boardReport(PCB().normalize(d.board)); return d; }, expectFail: ['Kühlkörperplatz'] }
      ] },

    { id: 'vl8', lab: 'vb', cat: 'Labornetzteil', title: 'Netzteil in Betrieb nehmen und messen', level: 2,
      on: 'mess',
      text: 'Das Netzteil ist aufgebaut. Miss die Spannung am Elko, die Brummspannung mit dem Oszilloskop, die größte und die kleinste Ausgangsspannung, die Spannung unter Last und den Kurzschlussstrom. Trage Werte, Einheiten und Messgeräte ein.',
      in: ['netzteil.pcb'], out: 'netzteil.mess', type: 'mess.protocol', w: 100, pass: null,
      open: {},
      hint: ['Miss in der Reihenfolge des Energieflusses und notiere zu jedem Wert Einheit und Messgerät.',
        'Die Brummspannung siehst du nur mit dem Oszilloskop in AC-Kopplung; gib die Spitze-Spitze-Spannung an.',
        'Der Sollwert der Ausgangsspannung hat die Toleranz der Referenzspannung aus dem Datenblatt.'],
      check: safe(checkMess, 'Messprotokoll'),
      form: [F_NUM('ue', 'Spannung am Elko (Gleichspannung)', 'V'), F_NUM('brumm', 'Brummspannung am Elko (Spitze-Spitze)', ''), { key: 'brummEinheit', label: 'Einheit der Brummspannung', type: 'select', options: [{ value: 'mV', label: 'mV' }, { value: 'V', label: 'V' }] },
        { key: 'brummGeraet', label: 'Messgerät für die Brummspannung', type: 'select', options: [{ value: 'Oszilloskop (AC-Kopplung)', label: 'Oszilloskop, AC-Kopplung' }, { value: 'Multimeter DC', label: 'Multimeter, Gleichspannung' }] },
        F_NUM('umax', 'Ausgangsspannung bei Poti ganz aufgedreht', 'V'), F_NUM('umin', 'Ausgangsspannung bei Poti ganz zugedreht', 'V'), F_NUM('dulast', 'Spannungsabfall von Leerlauf auf I_max', 'V'), F_NUM('ik', 'Kurzschlussstrom', 'A')],
      fromForm: v => {
        v = v || {}; const mk = (id, label, unit, val, ins) => ({ id: id, label: label, unit: unit, soll: 0, ist: fin(numF(val)) ? numF(val) : null, tol: 5, instrument: ins, tp: '' });
        return { rows: [mk('ue', 'U_e am Elko', 'V', v.ue, 'Multimeter DC'), mk('brumm', 'Brummspannung am Elko', String(v.brummEinheit || ''), v.brumm, String(v.brummGeraet || '')), mk('umax', 'U_aus,max', 'V', v.umax, 'Multimeter DC'), mk('umin', 'U_aus,min', 'V', v.umin, 'Multimeter DC'),
          mk('dulast', 'Lastausregelung', 'V', v.dulast, 'Multimeter DC'), mk('ik', 'Kurzschlussstrom', 'A', v.ik, 'Multimeter A')], values: {}, findings: [] };
      },
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'Brummspannung 1064 V (Zahl in mV, Einheit V)', mutate: d => { const r = d.rows.find(x => x.id === 'brumm'); r.unit = 'V'; return d; }, expectFail: ['Brummspannung'] },
        { name: 'U_aus,max = 13 V (außerhalb der Toleranz)', mutate: d => { d.rows.find(x => x.id === 'umax').ist = 13.6; return d; }, expectFail: ['Ausgangsspannung U_aus,max'] },
        { name: 'Kurzschlussstrom nur halb gemessen', mutate: d => { const r = d.rows.find(x => x.id === 'ik'); r.ist = r.ist * 0.5; return d; }, expectFail: ['Kurzschlussstrom'] },
        { name: 'Messgeräte fehlen', mutate: d => { d.rows.forEach(r => { r.instrument = ''; }); return d; }, expectFail: ['Protokoll vollständig', 'Brummspannung'] },
        { name: 'Lastausregelung 1,5 V', mutate: d => { d.rows.find(x => x.id === 'dulast').ist = 1.5; return d; }, expectFail: ['Lastausregelung'] },
        { name: 'Brummspannung mit dem Multimeter gemessen', mutate: d => { d.rows.find(x => x.id === 'brumm').instrument = 'Multimeter DC'; return d; }, expectFail: ['Brummspannung'] }
      ] },

    { id: 'vl9', lab: 'vb', cat: 'Labornetzteil', title: 'Fehler am Kundengerät suchen', level: 3,
      on: 'nts',
      text: 'Ein Kunde bringt sein 5-V-Netzteil mit Festspannungsregler zur Reparatur. Das Gerät ist freigeschaltet. Finde den Fehler: Beginne mit der Sichtprüfung, miss entlang des Energieflusses und tausche erst, wenn eine Messung das Bauteil eingrenzt. Stelle am Ende die Diagnose und begründe sie mit einem deiner Messwerte.',
      in: ['netzteil.mess'], out: 'netzteil.fehler', type: 'rig.state', w: 100, pass: null,
      get open() { const s = currentSpec(); return { rig: 'fehler', ctl: { netz: 'linear' }, fSeed: s && fin(s.fSeed) ? s.fSeed : undefined }; },
      hint: ['Beginne mit der Sichtprüfung am freigeschalteten Gerät und notiere, was du siehst.',
        'Miss entlang des Energieflusses: hinter dem Trafo, am Ladeelko (Gleichspannung und Brumm), am Reglerausgang, Laststrom. Vergleiche jeden Wert mit dem Sollwert.',
        'Halbiere: Stimmt ein Messpunkt, liegt der Fehler dahinter. Tausche erst, wenn eine Messung das Bauteil eingrenzt, und begründe mit dem Messwert.'],
      check: safe(checkFehler, 'Fehlersuche'),
      form: [{ key: 'begruendungText', label: 'Begründung mit einem deiner Messwerte', type: 'area', hint: 'Nenne einen Messwert mit Einheit, zum Beispiel 4,7 V' }],
      starter: ctx => ({ lab: 'nts', rig: 'fehler', ctl: { netz: 'linear', fehler: 'zufall', seed: sNtsOf(P_(ctx)) }, state: {}, derived: {} }),
      solution: ctx => fehlerSolution(ctx),
      mutants: [
        { name: 'Diagnose ist ein anderer Katalogeintrag', mutate: (d, ctx) => { const f = faultKey(P_(ctx)), o = N_().fault.catalog.find(x => x.netz.indexOf('linear') >= 0 && x.id !== f); d.ctl.diagnose = o.id; return d; }, expectFail: ['Diagnose'] },
        { name: 'Nur zwei Messungen vor dem Tausch', mutate: d => { const t = d.seq.find(x => /^tausche:/.test(x.do)); d.seq = [{ t: 1, do: 'sicht' }, { t: 2, do: 'messe:u_sek' }, { t: 3, do: 'messe:u_aus' }, { t: 4, do: t.do }]; return d; }, expectFail: ['Messplan'] },
        { name: 'Tausch ohne Messung', mutate: d => { const t = d.seq.find(x => /^tausche:/.test(x.do)); d.seq = [{ t: 1, do: 'sicht' }, { t: 2, do: t.do }]; return d; }, expectFail: ['Messplan'] },
        { name: 'Falsches Bauteil getauscht', mutate: (d, ctx) => { const N = N_(), P = P_(ctx), bad = N.fault.parts('linear').find(p => !N.fault.repair(faultMake(P), p.id).behoben); const t = d.seq.find(x => /^tausche:/.test(x.do)); t.do = 'tausche:' + bad.id; return d; }, expectFail: ['Instandsetzung'] },
        { name: 'Begründung ohne Messwert', mutate: d => { d.begruendungText = 'Ich habe das Bauteil getauscht, weil es defekt aussah.'; d.ctl.begruendung = false; return d; }, expectFail: ['Begründung'] }
      ] },

    { id: 'vl10', lab: 'vb', cat: 'Labornetzteil', title: 'Netzteil nach der Reparatur prüfen (Schutzklasse I)', level: 2,
      on: 'els',
      text: 'Das Labornetzteil ist instand gesetzt und kommt zur Prüfung (Schutzklasse I). Prüfe in der festen Reihenfolge: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom, Ergebnis. Vergleiche jeden Wert mit seinem Grenzwert und trage Befund, Urteil und Maßnahme ein. Normbezug nur nach Norm, Ausgabe laut Ausbilder.',
      in: ['netzteil.fehler'], out: 'netzteil.pruef', type: 'rig.state', w: 100, pass: null,
      get open() { const s = currentSpec(), stt = currentState(), P = s || {}; return { rig: 'pruefplatz', ctl: pruefCtl(P, stt && stt.level) }; },
      hint: ['Prüfe in der festen Reihenfolge; ein Schritt, der nicht bestanden ist, beendet die Prüfung nicht, er bestimmt das Urteil.',
        'Vergleiche jeden Messwert mit dem Grenzwert für Schutzklasse I; die Grenzwerte stehen im Prüfplatz.',
        'Ordne den Befund dem Messschritt zu, der ihn zeigt.'],
      check: safe(checkPruef, 'Geräteprüfung'),
      form: [{ key: 'befund1', label: 'Befund 1', type: 'select', options: BEFUND_IDS.map(k => ({ value: k, label: BEFUND[k].l })) }, { key: 'befund2', label: 'Befund 2 (falls ein zweiter Mangel vorliegt)', type: 'select', options: BEFUND_IDS.map(k => ({ value: k, label: BEFUND[k].l })) },
        { key: 'urteil', label: 'Urteil', type: 'select', options: [{ value: 'bestanden', label: 'bestanden' }, { value: 'nicht bestanden', label: 'nicht bestanden' }] },
        { key: 'massnahme', label: 'Maßnahme', type: 'select', options: [{ value: 'sperren', label: 'Gerät sperren und kennzeichnen, Mangel beheben, erneut prüfen' }, { value: 'freigeben', label: 'Gerät freigeben' }, { value: 'weiter', label: 'Gerät weiter benutzen und den Mangel notieren' }] }],
      starter: ctx => ({ lab: 'els', rig: 'pruefplatz', ctl: pruefCtl(P_(ctx), LEVEL(ctx)), state: {}, derived: {} }),
      solution: ctx => pruefSolution(ctx),
      mutants: [
        { name: 'Isolationswiderstand nicht gemessen', mutate: d => { d.seq = d.seq.filter(x => x.do !== 'riso'); return d; }, expectFail: ['Reihenfolge', 'Grenzwerte'] },
        { name: 'Sichtprüfung nach dem Schutzleiterwiderstand', mutate: d => { d.seq = [{ t: 1, do: 'sicht:leitung' }, { t: 2, do: 'sicht:stecker' }, { t: 3, do: 'rpe' }, { t: 4, do: 'sicht:gehaeuse' }, { t: 5, do: 'riso' }, { t: 6, do: 'ipe' }, { t: 7, do: 'ergebnis' }]; return d; }, expectFail: ['Reihenfolge'] },
        { name: 'Falsches Urteil trotz der Messwerte', mutate: (d, ctx) => { const ex = pruefExpect(P_(ctx), LEVEL(ctx)); d.urteil = ex.gesamt === 'bestanden' ? 'nicht bestanden' : 'bestanden'; return d; }, expectFail: ['Urteil'] },
        { name: 'Befund passt nicht zu den Messwerten', mutate: (d, ctx) => { const ex = pruefExpect(P_(ctx), LEVEL(ctx)), o = BEFUND_IDS.find(k => k !== 'keiner' && ex.cats.indexOf(k) < 0); d.befund1 = o; d.befund2 = 'keiner'; return d; }, expectFail: ['Befund'] },
        { name: 'Falsche Maßnahme', mutate: (d, ctx) => { const ex = pruefExpect(P_(ctx), LEVEL(ctx)); d.massnahme = ex.gesamt === 'bestanden' ? 'sperren' : 'weiter'; return d; }, expectFail: ['Maßnahme'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => ((slots || {})[k] ? dOf(unwrap(slots[k])) : null);
    const out = [], tr = g('netzteil.trafo'), si = g('netzteil.sieb'), ds = g('netzteil.ds'), rg = g('netzteil.regler'), th = g('netzteil.therm'), sc = g('netzteil.sch'), pc = g('netzteil.pcb'), me = g('netzteil.mess'), fe = g('netzteil.fehler'), pr = g('netzteil.pruef');
    out.push({ h: 'Lastenheft', rows: [['Ausgangsspannung', 'bis ' + fm(P.umax, 0) + ' V'], ['Strom', fm(P.imax, 1) + ' A'], ['Netz', P.uNetz + ' V, ' + P.fNetz + ' Hz' + (P.netzTol ? ' ± ' + fm(P.netzTol * 100, 0) + ' %' : '')], ['Umgebung', P.tAmb + ' °C'], ['Platine', P.boardW + ' × ' + P.boardH + ' mm, ' + P.layers + ' Lagen']] });
    if (tr) out.push({ h: 'Trafo', rows: [['Sekundärspannung', fm(numF(tr.u2), 0) + ' V'], ['Nennleistung', fm(numF(tr.snVA), 0) + ' VA'], ['Effektivstrom', fm(numF(tr.i2eff), 2) + ' A']] });
    if (si) { const c = ctlOf(si); out.push({ h: 'Brücke und Ladeelko', rows: [['Elko', fm(numF(c.c), 0) + ' µF'], ['Spitzenstrom', fm(numF(si.iPeak), 2) + ' A']] }); }
    if (ds && N_()) { try { const it = arr(ds.items); out.push({ h: 'Bauteile', rows: [['Regler', (it.find(x => x.role === 'regler') || {}).ref || '-'], ['Gleichrichter', (isObj(ds.vals) && ds.vals.bruecke) || ((it.find(x => x.role === 'gleichrichter') || {}).ref + ' × ' + fm(numF(ds.vals && ds.vals.anzahlD), 0))], ['Elko', fm(numF(ds.vals && ds.vals.cUf), 0) + ' µF / ' + fm(numF(ds.vals && ds.vals.unV), 0) + ' V']] }); } catch (e) { /* ohne Abschnitt */ } }
    if (rg) { const c = ctlOf(rg); out.push({ h: 'Regler und Strombegrenzung', rows: [['R1', fm(numF(c.r1), 0) + ' Ω'], ['R2,max', fm(numF(c.r2), 0) + ' Ω'], ['R_S', fm(numF(c.r3), 2) + ' Ω'], ['U_aus,max', N_() ? fm(uausOf(numF(c.r1), numF(c.r2)), 2) + ' V' : '?'], ['I_lim', N_() ? fm(ilimOf(numF(c.r3)), 3) + ' A' : '?']] }); }
    if (th) { const c = ctlOf(th); out.push({ h: 'Kühlung', rows: [['Kühlkörper', String(c.heatsink)], ['Übergang', String(c.joint) + ', Paste ' + String(c.paste)], ['Lüfter', String(c.fan)]] }); }
    const ix = sc ? nlIdx(sc.netlist) : null; if (ix && ix.ok) out.push({ h: 'Schaltung und Stückliste', rows: arr(sc.netlist.parts).map(p => [p.ref, p.kind + (p.value ? ' ' + p.value : '')]) });
    const b = pc && asBoard(pc.board); if (b && PCB()) { const r = boardReport(PCB().normalize(b)); out.push({ h: 'Platine', rows: [['Maße', fm(r.w, 0) + ' × ' + fm(r.h, 0) + ' mm, ' + r.layers + ' Lagen'], ['Bauteile', r.bomCount], ['DRC-Fehler', r.drcErrors], ['Kosten', fm(r.cost, 2) + ' €']] }); }
    if (me) out.push({ h: 'Messprotokoll', rows: arr(me.rows).map(r => [r.label || r.id, fm(numF(r.ist), 3) + ' ' + (r.unit || '') + (r.instrument ? ' (' + r.instrument + ')' : '')]) });
    if (fe) { const ok = N_() && typeof (ctlOf(fe).diagnose) === 'string' && ctlOf(fe).diagnose === faultKey(P); out.push({ h: 'Fehlersuche am Kundengerät', rows: [['Aktionen', arr(fe.seq).length + ' (Sicht, Messungen, Tausch)'], ['Diagnose', ok ? 'bestätigt' : 'noch nicht bestätigt']] }); }
    if (pr) out.push({ h: 'Geräteprüfung', rows: [['Urteil', String(pr.urteil || '-')], ['Maßnahme', String(pr.massnahme || '-')]] });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Labornetzteil: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx); const sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Labornetzteil: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Labornetzteil: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Labornetzteil mit Längsregler', icon: '🔌', prefix: 'vl', order: 6,
    story: 'Die Lehrwerkstatt der Tonfunk GmbH baut fünf Netzteile für die eigenen Arbeitsplätze: einstellbar von 1,25 V an, mit Strombegrenzung und dauerhaft kurzschlussfest. Meister Funk mahnt: „Ein Netzteil ist erst fertig, wenn es kalt bleibt und geprüft ist.“ Du wählst den Trafo, legst Brücke, Elko und Regler aus, kühlst den LM317, zeichnest und baust die Platine, nimmst das Gerät in Betrieb und prüfst es nach der Reparatur. Dazwischen suchst du den Fehler an einem Kundengerät.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['nts', 'ds', 'thm', 'sch', 'pcb', 'mess', 'els'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    faultKey: faultKey,
    stations: STATIONS,
    final: {
      id: 'vlF', title: 'Abschlusstest: Ein Tag am Laborplatz', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Trafo und Elko aus Station 2 zu klein', mutate: s => { s['netzteil.sieb'].ctl.u2 = 12; s['netzteil.sieb'].ctl.c = 1000; return s; }, expectFail: ['Dropout'] },
        { name: 'Kühlkörper zu klein', mutate: s => { s['netzteil.therm'].ctl.heatsink = 'fahne'; return s; }, expectFail: ['Thermik'] },
        { name: 'Urteil der Geräteprüfung falsch', mutate: s => { s['netzteil.pruef'].urteil = s['netzteil.pruef'].urteil === 'bestanden' ? 'nicht bestanden' : 'bestanden'; return s; }, expectFail: ['Geräteprüfung'] },
        { name: 'R_S im Schaltplan weicht ab', mutate: s => { const p = s['netzteil.sch'].netlist.parts.find(x => x.ref === 'R3'); p.value = String(numOf(p.value) * 2); return s; }, expectFail: ['Konsistenz'] }
      ]
    },
    kpis: ['umax', 'ilim', 'brumm', 'tjMax', 'pvMax', 'pruefung'],
    report: reportParts,
    selfTest: selfTest,
    _test: { FACH: FACH, MUSTER: MUSTER, COMBOS: COMBOS, musterOf: musterOf, u2Min: u2Min, cMin: cMin, cOk: cOk, dropReq: dropReq, iDim: iDim, pvOf: pvOf, pvPoint: pvPoint, sieb: sieb, snMin: snMin, unMin: unMin, peakHi: peakHi, ilimOf: ilimOf, uausOf: uausOf, r2maxOf: r2maxOf,
      faultMake: faultMake, faultKey: faultKey, symptomName: symptomName, sNtsOf: sNtsOf, sElsOf: sElsOf, nMangelOf: nMangelOf, fseed: fseed, runRig: runRig, psuOf: psuOf, nlIdx: nlIdx, boardFunc: boardFunc, buildBoard: buildBoard, boardReport: boardReport, boardStats: boardStats, loadPoints: loadPoints,
      pruefExpect: pruefExpect, pruefCtl: pruefCtl, BEFUND: BEFUND, befundOf: befundOf, TJ_MAX: TJ_MAX, E6C: E6C, U2S: U2S, mkRig: mkRig, isE12: isE12, capOf: capOf, buildSch: buildSch, rowVal: rowVal, messSoll: messSoll, numUnits: numUnits, K_PID: K_PID, checkSch: checkSch, checkPcb: checkPcb },
    demos: [{ id: 'bis4', name: 'Labornetzteil bis Station 4', upTo: 'vl4' }, { id: 'fertig', name: 'Labornetzteil fertig', upTo: 'vlF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_NETZTEIL = def;
})(typeof window !== 'undefined' ? window : globalThis);
