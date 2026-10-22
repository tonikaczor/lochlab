/* enrsys.js - Energie-Lab Kern Teil 2 (ENR_CORE: batt, ctrl, inv, loads, sys, design, diagnose, runSeq). Version 1.0
 * Erweitert denselben Namensraum wie enrcore.js (Teil 1) und enrcalc.js (Teil 3). Reine Rechnung, keine DOM-Zugriffe.
 * Browser: window.ENR_CORE, Node: module.exports / globalThis.ENR_CORE. Vanilla-JS, kein eval, offline.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Zeit: Prozess-Sekunden seit Start; Sonnenzeit (wahre Ortszeit, Stunden 0..24), Tag des Jahres N. Festschritt h (Standard 60 s).
 *  - Vorzeichen: Akku laden positiv, entladen negativ. Netz: Einspeisung positiv, Bezug negativ.
 *  - GUARD: Alle oeffentlichen Funktionen (auch Methoden zurueckgegebener Objekte) werfen NIE. Rechenfunktionen liefern NaN,
 *    Struktur-Funktionen { ok:false, why:'deutscher Text' }. Zufall nur ueber ENR_CORE.rng(seed) (im Wolkenzug des Kerns).
 *  - Abhaengigkeit: enrcore.js (pv.spec/cond/current/keys/array/cellTemp, sun.*). Fehlt der Kern, liefern sys/design { ok:false }.
 *
 * ===================================================================================================
 * SCHNITTSTELLEN FUER ANDERE PAKETE (Kurzfassung; SPEC 4.8 bis 4.16 ist massgeblich, Praezisierungen in ABWEICHUNGEN.md, Kuerzel WP1b)
 *  batt.defaults(chem, Usys) -> {ok, uAbs, uFloat, uLvd, uLvdBack, uGas, ri100, peukert, accFrac, selfDay, kT, dodMax, ocvTable, ...} (Spannungen skaliert)
 *  batt.create({chem, Usys, C, T, soc0}) -> { step(dtS, {iReq, temp}) -> {I, ut, soc, ...}, state(), ocv(soc), uTerm(I), accept(), reset(soc), limits(dtS), capacityAt(I),
 *      rCharge(), ri() }
 *    state(): soc, ocv, ut, i, ri, rCharge, accept, T, cT, damage (0..1), damagePct, gasAh, eZu, eAb, dEchem, loss{ri,pol,gas,eta,peukert,self}, lossSum, ahIn, ahOut
 *  batt.cycleLife(chem, dod); batt.lifeYears({chem, dod, cyclesPerYear, tempC}); batt.capacity(spec, I); batt.dischargeCurve(spec, I, points)
 *  ctrl.defaults(type, Usys); ctrl.create(spec) -> { step(dtS, inputs) -> out, state(), reset() }
 *    inputs: { field:{uoc, isc, umpp, impp, pmpp, iAt(U), dark}, batt (batt.create-Objekt), pLoad (W am Sammelpunkt), rPv, rBat (Ohm), tBat (Grad C) }
 *    out: { ok, iPv (X in den Sammelpunkt), ub, ut, iBat (laden +), uf, iF, pF (Feldleistung), pPot, pOut, pLoadAct, loss{cable, conv, self}, curtail, curtailImax,
 *           stage (0 aus/Nacht, 1 Bulk, 2 Absorption, 3 Float), stageName, loadOn, dead, events[] }
 *  inv.models; inv.eta(model, p); inv.euroEta(model); inv.acFromDc(model, Pn, Pdc); inv.loss(model, Pn, Pac); inv.gridTable; inv.create(spec)
 *    netz: step(dtS, {field, netzOk, np}) -> {state, pDc, pAc, pLoss, uDc, iDc, pPot, curtail, curtailKind, pStandby, dead, events[]}
 *    insel: step(dtS, {pAc, s, ub, sparmodus}) -> {pDc, pAc (bedient), loss, standby, off, events[]}
 *  loads.devices; loads.profile(kind, {pFrei, faktor}) -> {name, devices, hourly[24], energyWh, peakW, peakVA, surgeW, cosphi};
 *    loads.fromDevices(geraete) -> profile; loads.power(profile, tS) (W); loads.apparent(profile, tS) (VA); loads.energy(profile) (Wh)
 *  sys.create(cfg) -> sim { step(dtS), state(), reset(), balance(scope), daily(), dayTrace(), update(patch), setClock(N,tS), events, cfg }; sys.run(cfg, days, opts); sys.presets(wetter)
 *  design.autoDesign(inp), design.verify(inp, result, opts), design.cable(inp), design.fuse(inp), design.stringCheck(inp), design.lists
 *  diagnose(ctx) -> [{id, kind, text, fx?}]  (ctx-Felder im Kopf von diagnose(), alle optional, fehlende erzeugen nie eine Meldung)
 *  runSeq(rigFactory | rigId | rig, seq, tEndS, opts) -> { ok, samples, final, events, faults, metrics, errors, rejected }
 *  TEXTS: ENR_CORE.TEXTS.diag[id] = { kind, text } (Vorlagen mit {x}-Platzhaltern; Ids aus Teil 1 bleiben dort). TEXTS.get liefert ein String-Objekt mit .id, .kind, .text.
 *  sys: cfg { typ, ort, N, tS, tage, neigung, azimut, wetter{c,preset,seed,zug}, feld{spec,ns,np,shade}, regler{typ,Imax,Uocmax,tempComp,lvd,Uabs,Ufloat,lvdU}, leitung{pv{l,q},bat{l,q},kappa}
 *       (oder regler.lPv/aPv/lBat/aBat), akku{chem,Usys,C,soc0,T}, wr{modell,Sn|Pn,sparmodus,limit} (null/kein = Gleichstromlast), last{profil|geraete,faktor,pFrei}, netz{ok,limit,speicherKWh},
 *       quelle:'konstant' (G, ta feste Einstrahlung/Temperatur), uhrFest, h }.
 *    state(): t, N, tS, elev, azim, gPoa, tcell, ta, pPot (MPP), pPv (am Reglereingang, nach Modulleitung), pField (am Modul), uPv/iPv (Modulpunkt), pCurt (abgeregelt), uBat, iBat, pBat (Klemmen, laden +), soc, stage,
 *       pLoad, pLoadDc, lvdAktiv, regDead, bmsAus, gasAh, damage, pStandby, sApp, wrOverload; Netz: pDc, uDc, pAc, eta, pHaus, pNetz, pSp, socSp, wrDead, wrOn, clip, window, netzOk.
 *    Abweichungen von der Spezifikation: siehe FORTSCHRITT-WP1b.md.
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const C = root.ENR_CORE = root.ENR_CORE || {};
  if (!C.pv && typeof module !== 'undefined' && module.exports && typeof require === 'function') { try { require('./enrcore.js'); } catch (e) { /* Kern fehlt: sys/design melden ok:false */ } }

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.replace(',', '.')); return isFinite(x) ? x : d; }
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function fm(x, d) {
    if (typeof C.fmt === 'function') { try { return d === undefined ? C.fmt(x) : C.fmt(x, d); } catch (e) { /* Rueckfall */ } }
    if (typeof x !== 'number' || !isFinite(x)) return '–';
    return (d === undefined ? String(Number(x.toPrecision(4))) : x.toFixed(d)).replace('.', ',');
  }
  function G_(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function S_(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { if (root.ENR_DEBUG) console.error(e); return fail('Ungültige Eingabe.'); } }; }
  /* Methoden eines zurueckgegebenen Objekts kapseln (numeric: NaN, sonst { ok:false }) */
  function wrapMethods(o, numeric) {
    numeric = numeric || {};
    Object.keys(o).forEach(function (k) { if (typeof o[k] === 'function') o[k] = numeric[k] ? G_(o[k]) : S_(o[k]); });
    return o;
  }
  function interp(tab, x) {
    if (!(x === x)) return NaN;
    if (x <= tab[0][0]) return tab[0][1];
    for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const a = tab[i - 1], b = tab[i]; return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); }
    return tab[tab.length - 1][1];
  }
  function bisect(f, lo, hi, n) { /* f fallend: groesstes x mit f(x) >= 0 */
    for (let i = 0; i < n; i++) { const m = 0.5 * (lo + hi); if (f(m) >= 0) lo = m; else hi = m; }
    return 0.5 * (lo + hi);
  }
  function fillTpl(tpl, vars) {
    vars = vars || {};
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? '{' + k + '}' : String(vars[k]); });
  }

  /* =====================================================================================================
   *  TEXTE (einzige Quelle der Meldungen dieser Datei, SPEC 4.15). Vorlagen mit {x}-Platzhaltern aus gemessenen Werten.
   * ===================================================================================================== */
  const DIAG = {
    'hotspot-gefahr': 'Hotspot: Eine verschattete Zelle erwärmt sich mit {x} W. Das ist gefährlich viel, die Zelle kann Schaden nehmen.',
    'pwm-verlust': 'Der PWM-Regler zwingt das Modul auf die Akkuspannung ({x} V statt Umpp = {y} V): {z} W gehen verloren.',
    'mppt-start': 'Die Modulspannung ({x} V) liegt zu nahe an der Akkuspannung: Der MPPT-Wandler arbeitet nicht richtig.',
    'regler-strom': 'Der Regler begrenzt den Strom auf {x} A. Das Feld könnte {y} W liefern, es werden nur {z} W genutzt.',
    'regler-tot': 'Der Regler ist zerstört: Die Leerlaufspannung ({x} V) war höher als sein Eingang ({y} V).',
    'ladeschluss': 'Ladephase: {stage} (Spannung {x} V, Strom {y} A).',
    'ueberladung': 'Der Akku gast (Spannung {x} V): Wasser geht verloren, bei Blei entsteht Knallgas. Hier fehlt die Laderegelung.',
    'bms-aus': 'Das Batteriemanagement hat abgeschaltet: Spannung/Temperatur außerhalb des erlaubten Bereichs.',
    'tiefentladung': 'Tiefentladung: Der Akku nimmt dauerhaft Schaden (Ladezustand {x} %).',
    'lvd-aus': 'Tiefentladeschutz: Last getrennt bei {x} V.',
    'lvd-wieder': 'Last wieder zugeschaltet bei {x} V.',
    'akku-leer-nacht': 'Der Akku war vor Sonnenaufgang leer: Er trägt {x} Wh, die Nacht braucht {y} Wh.',
    'kabel-spannungsfall': 'Auf der Leitung gehen {x} V ({y} %) verloren: {z} W Verlustleistung. Nimm mehr Querschnitt.',
    'kabel-ueberlast': 'Die Leitung führt {x} A, erlaubt sind {y} A. Sie erwärmt sich zu stark.',
    'wr-ueberlast': 'Wechselrichter überlastet: Scheinleistung {x} VA, Nennleistung {y} VA.',
    'wr-standby': 'Der Wechselrichter verbraucht auch ohne Last {x} W, das sind {y} Wh in 24 h.',
    'wr-clipping': 'Der Wechselrichter begrenzt auf {x} W. Das Feld könnte {y} W liefern: {z} Wh gehen heute verloren.',
    'wr-fenster': 'Die Strangspannung ({x} V) liegt außerhalb des MPP-Fensters ({y} bis {z} V).',
    'wr-zerstoert': 'Der Wechselrichter-Eingang wurde überspannt: {x} V bei erlaubten {y} V.',
    'netzausfall': 'Netzausfall: Der Wechselrichter schaltet ab und speist nicht ein (kein Inselbetrieb). Die Sonne scheint trotzdem.',
    'speicher-voll': 'Der Speicher ist voll: {x} W werden eingespeist.',
    /* zusaetzliche Ereignisse dieser Datei (ABWEICHUNGEN WP1b) */
    'wr-unterspannung': 'Der Wechselrichter hat abgeschaltet: Die Akkuspannung ({x} V) liegt unter seiner Eingangsgrenze ({y} V).',
    'akku-leer': 'Der Akku ist leer: Die Last wird nicht mehr versorgt (Ladezustand {x} %).',
    'wr-nicht-erkannt': 'Der Wechselrichter im Sparmodus erkennt Lasten unter {x} W nicht: Der Verbraucher ({y} W) bekommt keinen Strom.',
    'speicher-leer': 'Der Speicher ist leer: Das Haus bezieht alles aus dem Netz.',
    'wr-start': 'Der Wechselrichter startet und speist ein ({x} W).',
    'wr-stopp': 'Der Wechselrichter stoppt: Die Strangspannung ist zu niedrig zum Einspeisen.',
    'begrenzung': 'Die Einspeisebegrenzung ist aktiv: höchstens {x} W.',
    'sonnenaufgang': 'Sonnenaufgang.',
    'sonnenuntergang': 'Sonnenuntergang.',
    'akku-voll': 'Der Akku ist voll (Ladezustand {x} %).',
    'blackout': 'Netzausfall: Das Haus hat keinen Strom, denn es gibt keine Insel-Notversorgung.'
  };
  const TXT = {
    keinKern: 'Der Kern (enrcore.js) ist nicht geladen.',
    quoteKeinePv: 'Keine Erzeugung: Die Eigenverbrauchsquote gibt es nicht.',
    autarkieKeinHaus: 'Kein Verbrauch: Der Autarkiegrad gibt es nicht.',
    bilanz: 'Energiebilanz: Die Abweichung beträgt {x} Wh ({y} % der Solarenergie).'
  };
  const TEXTS = C.TEXTS = (C.TEXTS && typeof C.TEXTS === 'object') ? C.TEXTS : {};
  TEXTS.diag = TEXTS.diag && typeof TEXTS.diag === 'object' ? TEXTS.diag : {};
  TEXTS.sys = Object.assign(TEXTS.sys && typeof TEXTS.sys === 'object' ? TEXTS.sys : {}, TXT);
  if (typeof TEXTS.get !== 'function') TEXTS.get = function (id, vars) { const d = TEXTS.diag[id]; return { id: id, kind: d && d.kind || 'info', text: fillTpl(d && d.text || '', vars) }; };

  /* =====================================================================================================
   *  AKKU (ENR_CORE.batt)  SPEC 4.9, alle Zahlen (A13)
   * ===================================================================================================== */
  const CHEMS = {
    blei: {
      name: 'Blei (AGM/Gel)', cells: 6, cellV: 2.0, uAbs: 14.4, uFloat: 13.6, uLvd: 11.1, uLvdBack: 12.6, uGas: 14.8, ri100: 0.009, peukert: 1.2,
      accFrac: 0.30, dischMax: 1.0, selfDay: 0.001, kT: 0.008, dodMax: 0.5, frostLock: null, tailFrac: 0.02, floatFrac: 0.005, kpol: 30, polS0: 0.55, kneeV: 2.4, kneeS0: 0.25,
      ocv: [[0, 11.80], [0.25, 12.00], [0.5, 12.20], [0.75, 12.45], [1.0, 12.70]]
    },
    lifepo4: {
      name: 'Li-Ion (LiFePO4)', cells: 4, cellV: 3.2, uAbs: 14.2, uFloat: 13.5, uLvd: 11.2, uLvdBack: 12.8, uGas: null, ri100: 0.005, peukert: 1.03,
      accFrac: 0.50, dischMax: 1.0, selfDay: 0.0008, kT: 0.005, dodMax: 0.8, frostLock: 0, tailFrac: 0.05, floatFrac: 0, kpol: 3.2, polS0: 0.6, kneeV: 3.0, kneeS0: 0.15,
      ocv: [[0, 12.0], [0.1, 12.8], [0.2, 13.0], [0.5, 13.2], [0.9, 13.3], [1.0, 13.6]]
    }
  };
  const USYS = [12, 24, 48];
  function battDefaults(chem, Usys) {
    const c = CHEMS[chem], U = num(Usys, NaN);
    if (!c) return fail('Unbekannte Zellchemie. Erlaubt sind „blei“ und „lifepo4“.');
    if (USYS.indexOf(U) < 0) return fail('Die Systemspannung muss 12, 24 oder 48 V sein.');
    const s = U / 12;
    return {
      ok: true, chem: chem, name: c.name, Usys: U, s: s, cells: c.cells * s, cellV: c.cellV, uAbs: c.uAbs * s, uFloat: c.uFloat * s, uLvd: c.uLvd * s,
      uLvdBack: c.uLvdBack * s, uGas: c.uGas === null ? null : c.uGas * s, ri100: c.ri100 * s, peukert: c.peukert, accFrac: c.accFrac, dischMax: c.dischMax,
      selfDay: c.selfDay, kT: c.kT, dodMax: c.dodMax, frostLock: c.frostLock, tailFrac: c.tailFrac, floatFrac: c.floatFrac, kpol: c.kpol * s, polS0: c.polS0, kneeV: c.kneeV * s, kneeS0: c.kneeS0,
      kg100: 0.12 * s, ocvTable: c.ocv.map(function (p) { return [p[0], p[1] * s]; })
    };
  }
  function cycleLife(chem, dod) {
    const d = num(dod, NaN);
    if (!(d > 0 && d <= 1)) return NaN;
    if (chem === 'blei') return 500 * Math.pow(0.5 / d, 1.3);
    if (chem === 'lifepo4') return 3000 * (0.8 / d);
    return NaN;
  }
  function lifeYears(o) {
    o = isObj(o) ? o : {};
    const chem = o.chem, dod = num(o.dod, NaN), cpy = num(o.cyclesPerYear, NaN), T = num(o.tempC, 25);
    if ((chem !== 'blei' && chem !== 'lifepo4') || !(dod > 0 && dod <= 1) || !(cpy >= 0)) return NaN;
    const over = Math.max(0, T - 25) / 10;
    const cal = chem === 'blei' ? 6 * Math.pow(0.5, over) : 12 * Math.pow(0.7, over);
    const N = cycleLife(chem, dod);
    return cpy <= 0 ? cal : Math.min(cal, N / cpy);
  }
  function battCreate(spec) {
    spec = isObj(spec) ? spec : {};
    const d = battDefaults(spec.chem, spec.Usys);
    if (!d.ok) return d;
    const Cah = num(spec.C, NaN);
    if (!(Cah >= 1 && Cah <= 5000)) return fail('Die Kapazität muss zwischen 1 und 5000 Ah liegen.');
    const T0 = clamp(num(spec.T, 25), -40, 80);
    const soc0 = clamp(num(spec.soc0, 1), 0, 1);
    const kg = d.kg100 * (100 / Cah);
    const iRef = Cah / 20;
    const st = {};
    function zero(o) { return o; }
    function resetAll(soc) {
      st.soc = clamp(num(soc, soc0), 0, 1); st.T = T0; st.I = 0; st.ut = ocvAt(st.soc); st.x = 0; st.eZu = 0; st.eAb = 0; st.dEchem = 0; st.ahIn = 0; st.ahOut = 0; st.gasAh = 0;
      st.loss = { ri: 0, pol: 0, gas: 0, eta: 0, peukert: 0, self: 0 }; st.damage = 0; st.dir = 1; st.peak = st.soc; st.trough = st.soc; st.low = false; st.tLow = 0;
      st.t = 0; st.uMax = st.ut; st.uMin = st.ut; st.cycles = 0;
    }
    function ocvAt(soc) { return interp(d.ocvTable, clamp(num(soc, NaN), 0, 1)); }
    function cT(T) { return Cah * clamp(1 + d.kT * (T - 25), 0.5, 1.05); }
    function ri() { return d.ri100 * (100 / Cah) * (1 + 0.015 * Math.max(0, 25 - st.T)); }
    function hpol(soc) { const x = Math.max(0, (soc - d.polS0) / (1 - d.polS0)); return x * x; }
    function rCharge() { return ri() + d.kpol * hpol(st.soc) / Cah; }
    function etaC(soc) { return d.chem === 'blei' ? 0.95 - 0.45 * Math.max(0, (soc - 0.8) / 0.2) : 0.99; }
    function accept() {
      if (d.frostLock !== null && st.T < d.frostLock) return 0;
      const f = d.chem === 'blei' ? (st.soc <= 0.8 ? 1 : Math.pow(Math.max(0, (1 - st.soc) / 0.2), 1.5)) : (st.soc <= 0.95 ? 1 : Math.max(0, (1 - st.soc) / 0.05));
      return d.accFrac * Cah * f;
    }
    function peuk(a) { return Math.max(1, Math.pow(a / iRef, d.peukert - 1)); }
    function maxDis(dtH) { /* groesster Entladestrom (A, positiv), der den Ladezustand nicht unter 0 drueckt */
      const ct = cT(st.T), avail = st.soc * ct - (st.soc > 0 ? ct * d.selfDay / 24 * dtH : 0);
      if (!(avail > 0) || !(dtH > 0)) return 0;
      let lo = 0, hi = 3 * Cah;
      if (hi * peuk(hi) * dtH <= avail) return hi;
      for (let i = 0; i < 50; i++) { const m = 0.5 * (lo + hi); if (m * peuk(m) * dtH <= avail) lo = m; else hi = m; }
      return lo;
    }
    /* Entlade-Knie: Die Klemmenspannung bricht unter Last kurz vor leer ein (Lehrmodell, A13); sonst koennte der Tiefentladeschutz (LVD) nie ansprechen. */
    function knee(soc, I) { if (!(I < 0) || !(soc < d.kneeS0)) return 0; const q = (d.kneeS0 - soc) / d.kneeS0; return d.kneeV * q * q * Math.min(1, -I / (0.05 * Cah)); }
    function uTerm(I) {
      I = num(I, NaN); if (!(I === I)) return NaN;
      const ocv = ocvAt(st.soc);
      if (I <= 0) return ocv + I * ri() - knee(st.soc, I);
      const ia = accept();
      return ocv + I * rCharge() + kg * Math.max(0, I - ia);
    }
    function countCycles(soc) {
      if (st.dir >= 0) { if (soc > st.peak) st.peak = soc; else if (st.peak - soc >= 0.05) { st.dir = -1; st.trough = soc; } }
      else { if (soc < st.trough) st.trough = soc; else if (soc - st.trough >= 0.05) { const dd = st.peak - st.trough; const n = cycleLife(d.chem, Math.min(1, dd)); if (n > 0) st.damage += 1 / n; st.cycles += 1; st.dir = 1; st.peak = soc; } }
    }
    function step(dtS, inp) {
      const dt = clamp(num(dtS, 0), 0, 86400); inp = isObj(inp) ? inp : {};
      let I = num(inp.iReq, 0);
      const Tn = num(inp.temp, NaN); st.T = isFinite(Tn) ? clamp(Tn, -40, 80) : st.T;
      const ct = cT(st.T), ri0 = ri(), rc0 = rCharge(), ocv0 = ocvAt(st.soc), dtH = dt / 3600;
      if (!(dt > 0)) { return { ok: true, I: 0, ut: ocv0, soc: st.soc, x: 0, overflow: 0, iChem: 0 }; }
      let iraw = 0, x = 0, ichem = 0, ieff = 0, gasI = 0;
      if (I > 0) {
        const ia = accept(); iraw = Math.min(I, ia); x = I - iraw;
        /* Gasung: Oberhalb der Gasungsspannung geht ein Teil des Ladestroms in die Wasserzersetzung (Lehrmodell, A13: 2 A je V und 100 Ah, je 12 V) */
        let u1 = ocv0 + I * rc0 + kg * x; const uTo = num(inp.uT, NaN); if (x <= 0 && isFinite(uTo)) u1 = Math.max(uTo, ocv0 + I * ri0);
        if (d.uGas !== null && u1 > d.uGas) gasI = Math.min(iraw, 2 * (u1 - d.uGas) / d.s * (Cah / 100));
        ichem = etaC(st.soc) * (iraw - gasI);
      }
      else if (I < 0) {
        let a = -I; const am = maxDis(dtH);
        if (a > am) { a = am; I = -a; }
        ieff = a * peuk(a); ichem = -ieff;
      }
      let isd = st.soc > 0 ? ct * d.selfDay / 24 : 0;
      if (st.soc + (ichem - isd) * dtH / ct < 0) isd = Math.max(0, st.soc * ct / dtH + ichem);
      let socNew = st.soc + (ichem - isd) * dtH / ct, e = 0;
      if (socNew > 1) { e = (socNew - 1) * ct / dtH; socNew = 1; }
      if (socNew < 0) { socNew = 0; }
      const kn = knee(st.soc, I);
      let ut = I > 0 ? ocv0 + I * rc0 + kg * x : ocv0 + I * ri0 - kn;
      const uTo = num(inp.uT, NaN);
      if (I > 0 && x <= 0 && isFinite(uTo)) ut = Math.max(uTo, ocv0 + I * ri0); /* geregelte Ladung: der Regler haelt die Spannung, die Differenz ist Polarisation */
      const vpol = I > 0 ? Math.max(0, ut - ocv0 - I * ri0 - kg * x) : 0;
      const dQ = (socNew - st.soc) * ct;
      /* Posten einzeln gerechnet (Wh), Summe = Ut*I - ocv0*dQ (Test) */
      const k = dtH;
      const l = {
        ri: I * I * ri0 * k, pol: vpol * Math.max(0, I) * k + kn * Math.max(0, -I) * k, gas: (kg * x * I + ocv0 * (x + e) + ocv0 * etaC(st.soc) * gasI) * k, eta: ocv0 * (1 - (I > 0 ? etaC(st.soc) : 1)) * iraw * k,
        peukert: ocv0 * Math.max(0, ieff - Math.abs(Math.min(0, I))) * k, self: ocv0 * isd * k
      };
      const eTerm = ut * I * k;
      if (eTerm >= 0) st.eZu += eTerm; else st.eAb -= eTerm;
      st.dEchem += ocv0 * dQ; st.ahIn += Math.max(0, I) * k; st.ahOut += Math.max(0, -I) * k;
      Object.keys(l).forEach(function (kk) { st.loss[kk] += l[kk]; });
      if (d.uGas !== null && ut > d.uGas && x > 0) st.gasAh += (x + e) * k;
      st.gasAh += gasI * k;
      st.soc = socNew; st.I = I; st.ut = ut; st.x = x; st.t += dt;
      st.uMax = Math.max(st.uMax, ut); st.uMin = Math.min(st.uMin, ut);
      countCycles(socNew);
      if (d.chem === 'blei') {
        if (socNew < 0.10 && !st.low) { st.damage += 0.02; st.low = true; } else if (socNew > 0.15) st.low = false;
        if (socNew < 0.20) { st.tLow += dt; if (st.tLow >= 86400) { st.damage += 0.02; st.tLow -= 86400; } } else st.tLow = 0;
      }
      st.damage = Math.min(1, st.damage);
      return { ok: true, I: I, ut: ut, soc: socNew, x: x, gasI: gasI, overflow: e, iChem: dQ / dtH, eTerm: eTerm, loss: l };
    }
    function capacityAt(I) { const a = Math.abs(num(I, NaN)); if (!(a > 0)) return NaN; return cT(st.T) / peuk(a); }
    function state() {
      const ls = st.loss, sum = ls.ri + ls.pol + ls.gas + ls.eta + ls.peukert + ls.self;
      return {
        soc: st.soc, ocv: ocvAt(st.soc), ut: st.ut, i: st.I, ri: ri(), rCharge: rCharge(), accept: accept(), T: st.T, cT: cT(st.T), damage: st.damage, damagePct: st.damage * 100,
        gasAh: st.gasAh, eZu: st.eZu, eAb: st.eAb, dEchem: st.dEchem, loss: Object.assign({}, ls), lossSum: sum, ahIn: st.ahIn, ahOut: st.ahOut, cycles: st.cycles,
        uMax: st.uMax, uMin: st.uMin, t: st.t, kg: kg, C: Cah
      };
    }
    resetAll(soc0);
    const obj = {
      spec: { chem: d.chem, Usys: d.Usys, C: Cah, T: T0 }, defaults: d, step: step, state: state, ocv: ocvAt, uTerm: uTerm, accept: accept, reset: resetAll, limits: function (dtS) { return { iChargeMax: accept(), iDischargeMax: maxDis(clamp(num(dtS, 0), 0, 86400) / 3600) }; },
      capacityAt: capacityAt, rCharge: rCharge, ri: ri
    };
    return wrapMethods(obj, { ocv: 1, uTerm: 1, accept: 1, capacityAt: 1, rCharge: 1, ri: 1 });
  }
  function battCapacity(spec, I) {
    const b = battCreate(Object.assign({ C: 100, Usys: 12 }, isObj(spec) ? spec : {}));
    if (!b || b.ok === false) return NaN;
    return b.capacityAt(I);
  }
  function battDischargeCurve(spec, I, points) {
    const b = battCreate(Object.assign({ C: 100, Usys: 12 }, isObj(spec) ? spec : {}));
    if (!b || b.ok === false) return fail('Ungültiger Akku.');
    const n = clamp(Math.round(num(points, 51)), 3, 500), cur = Math.abs(num(I, NaN));
    if (!(cur >= 0)) return fail('Der Entladestrom muss eine Zahl sein.');
    const soc = [], u = [];
    for (let i = 0; i < n; i++) { const s = 1 - i / (n - 1); b.reset(s); soc.push(s); u.push(b.uTerm(-cur)); }
    return { ok: true, soc: soc, u: u };
  }
  const batt = {
    defaults: S_(battDefaults), create: S_(battCreate), cycleLife: G_(cycleLife), lifeYears: G_(lifeYears), capacity: G_(battCapacity), dischargeCurve: S_(battDischargeCurve), chems: ['blei', 'lifepo4'], usys: USYS.slice()
  };

  /* =====================================================================================================
   *  WECHSELRICHTER (ENR_CORE.inv)  SPEC 4.10, alle Zahlen (A14)
   * ===================================================================================================== */
  const INV_MODELS = {
    standard: { id: 'standard', name: 'Netzwechselrichter (Standard)', kind: 'netz', a: 0.005, b: 0.010, c: 0.015 },
    einfach: { id: 'einfach', name: 'Netzwechselrichter (einfach)', kind: 'netz', a: 0.012, b: 0.020, c: 0.025 },
    insel: { id: 'insel', name: 'Inselwechselrichter', kind: 'insel', a: 0.012, b: 0.030, c: 0.040 }
  };
  const GRID_TABLE = [
    { Pn: 800, name: 'Mikro-Wechselrichter 800 W', udcMax: 60, mppMin: 28, mppMax: 48, uStart: 22, iDcMax: 25, nMppt: 1 },
    { Pn: 1500, name: 'Wechselrichter 1,5 kW', udcMax: 600, mppMin: 120, mppMax: 500, uStart: 120, iDcMax: 12.5, nMppt: 1 },
    { Pn: 3000, name: 'Wechselrichter 3 kW', udcMax: 600, mppMin: 150, mppMax: 500, uStart: 150, iDcMax: 12.5, nMppt: 2 },
    { Pn: 5000, name: 'Wechselrichter 5 kW', udcMax: 1000, mppMin: 150, mppMax: 800, uStart: 150, iDcMax: 12.5, nMppt: 2 },
    { Pn: 8000, name: 'Wechselrichter 8 kW', udcMax: 1000, mppMin: 150, mppMax: 800, uStart: 150, iDcMax: 12.5, nMppt: 2 }
  ];
  const EURO_W = [[0.05, 0.03], [0.10, 0.06], [0.20, 0.13], [0.30, 0.10], [0.50, 0.48], [1.0, 0.20]];
  function invModel(m) {
    if (typeof m === 'string') return INV_MODELS[m] || null;
    if (isObj(m) && isFinite(num(m.a, NaN)) && isFinite(num(m.b, NaN)) && isFinite(num(m.c, NaN)) && num(m.a, -1) >= 0 && num(m.b, -1) >= 0 && num(m.c, -1) >= 0) return { id: m.id || 'frei', name: m.name || 'frei', kind: m.kind || 'netz', a: +m.a, b: +m.b, c: +m.c };
    return null;
  }
  function invEta(model, p) {
    const m = invModel(model), x = num(p, NaN);
    if (!m || !(x === x)) return NaN;
    if (x <= 0) return 0;
    return x / (x + m.a + m.b * x + m.c * x * x);
  }
  function invEuro(model) {
    const m = invModel(model);
    if (!m) return NaN;
    let s = 0;
    EURO_W.forEach(function (w) { s += w[1] * invEta(m, w[0]); });
    return s;
  }
  function invLoss(model, Pn, Pac) {
    const m = invModel(model), pn = num(Pn, NaN), pa = num(Pac, NaN);
    if (!m || !(pn > 0) || !(pa >= 0)) return NaN;
    const p = pa / pn;
    return pn * (m.a + m.b * p + m.c * p * p);
  }
  function invAcFromDc(model, Pn, Pdc) {
    const m = invModel(model), pn = num(Pn, NaN), pd = num(Pdc, NaN);
    if (!m || !(pn > 0) || !(pd >= 0)) return NaN;
    const pdc = pd / pn;
    if (pdc <= m.a) return 0;
    if (m.c < 1e-12) return Math.max(0, (pdc - m.a) / (1 + m.b)) * pn;
    const p = (-(1 + m.b) + Math.sqrt((1 + m.b) * (1 + m.b) - 4 * m.c * (m.a - pdc))) / (2 * m.c);
    return Math.max(0, p) * pn;
  }
  function gridEntry(Pn) { for (let i = 0; i < GRID_TABLE.length; i++) if (GRID_TABLE[i].Pn === Pn) return GRID_TABLE[i]; return null; }
  function invCreate(spec) {
    spec = isObj(spec) ? spec : {};
    const kind = spec.kind === 'insel' ? 'insel' : (spec.kind === 'netz' || spec.kind === undefined ? 'netz' : null);
    if (!kind) return fail('Die Art des Wechselrichters muss „netz“ oder „insel“ sein.');
    const S = { off: false, why: '', overloadS: 0, retryS: 0, dead: false, state: 'aus', lastPac: 0 };
    if (kind === 'insel') {
      const Sn = num(spec.Sn, NaN);
      if (!(Sn >= 50 && Sn <= 20000)) return fail('Die Nennleistung des Inselwechselrichters muss zwischen 50 und 20000 VA liegen.');
      const model = invModel(spec.model || 'insel');
      if (!model) return fail('Unbekanntes Wechselrichter-Modell.');
      const uCut = num(spec.uCut, 10.5 * (num(spec.Usys, 12) / 12)), sparmodus = !!spec.sparmodus;
      function stepIns(dtS, inp) {
        const dt = clamp(num(dtS, 0), 0, 86400); inp = isObj(inp) ? inp : {};
        const pReq = Math.max(0, num(inp.pAc, 0)), sReq = Math.max(pReq, num(inp.s, pReq)), ub = num(inp.ub, NaN);
        const spar = inp.sparmodus === undefined ? sparmodus : !!inp.sparmodus;
        const out = { ok: true, pDc: 0, pAc: 0, loss: 0, standby: 0, off: S.off, events: [], unerkannt: false, pReq: pReq };
        if (S.off) {
          S.retryS += dt;
          if (S.retryS >= 600 && S.why !== 'unterspannung') { S.off = false; S.overloadS = 0; S.retryS = 0; }
          else if (S.why === 'unterspannung' && ub > uCut + 0.5) { S.off = false; S.retryS = 0; }
          else { out.off = true; S.state = 'aus'; return out; }
        }
        if (isFinite(ub) && ub < uCut) { S.off = true; S.why = 'unterspannung'; S.retryS = 0; out.off = true; out.events.push({ id: 'wr-unterspannung', x: ub, y: uCut }); S.state = 'aus'; return out; }
        if (sReq > Sn + 1e-9) { S.overloadS += dt; if (S.overloadS > 5) { S.off = true; S.why = 'ueberlast'; S.retryS = 0; out.off = true; out.events.push({ id: 'wr-ueberlast', x: sReq, y: Sn }); S.state = 'aus'; return out; } } else S.overloadS = 0;
        if (spar && pReq < 25) {
          out.standby = 1.5; out.pDc = 1.5; out.loss = 1.5; out.unerkannt = pReq > 0; S.state = 'spar';
          if (pReq > 0) out.events.push({ id: 'wr-nicht-erkannt', x: 25, y: pReq });
          return out;
        }
        const loss = invLoss(model, Sn, pReq);
        out.pAc = pReq; out.pDc = pReq + loss; out.loss = loss; out.standby = pReq <= 0 ? loss : 0; S.state = 'an';
        return out;
      }
      const o = { kind: 'insel', Sn: Sn, model: model, step: stepIns, state: function () { return { off: S.off, why: S.why, overloadS: S.overloadS, state: S.state, Sn: Sn, sparmodus: sparmodus }; }, reset: function () { S.off = false; S.why = ''; S.overloadS = 0; S.retryS = 0; S.state = 'aus'; } };
      return wrapMethods(o);
    }
    /* Netz */
    const model = invModel(spec.model || 'standard');
    if (!model) return fail('Unbekanntes Wechselrichter-Modell.');
    const Pn = num(spec.Pn, NaN), ent = gridEntry(Pn);
    const udcMax = num(spec.udcMax, ent ? ent.udcMax : NaN), mppMin = num(spec.mppMin, ent ? ent.mppMin : NaN), mppMax = num(spec.mppMax, ent ? ent.mppMax : NaN), uStart = num(spec.uStart, ent ? ent.uStart : NaN);
    const iDcMax = num(spec.iDcMax, ent ? ent.iDcMax * (ent.nMppt > 1 && spec.iDcMax === undefined ? ent.nMppt : 1) : NaN);
    if (!(Pn >= 50 && Pn <= 100000) || !(udcMax > 0) || !(mppMin > 0) || !(mppMax > mppMin) || !(uStart > 0) || !(iDcMax > 0)) return fail('Die Daten des Netzwechselrichters sind unvollständig: Nennleistung, höchste Eingangsspannung, MPP-Fenster, Startspannung und Eingangsstrom werden gebraucht.');
    const limit = clamp(num(spec.limit, 1), 0.05, 1);
    const cfg = { Pn: Pn, udcMax: udcMax, mppMin: mppMin, mppMax: mppMax, uStart: uStart, iDcMax: iDcMax, limit: limit };
    function stepNetz(dtS, inp) {
      inp = isObj(inp) ? inp : {};
      const f = isObj(inp.field) ? inp.field : null;
      const out = { ok: true, state: 'aus', pDc: 0, pAc: 0, pLoss: 0, uDc: 0, iDc: 0, pPot: 0, curtail: 0, curtailKind: '', pStandby: 0, dead: S.dead, events: [] };
      if (!f) { out.ok = false; out.why = 'Es fehlt das Solarfeld.'; return out; }
      const uoc = Math.max(0, num(f.uoc, 0)), pmpp = Math.max(0, num(f.pmpp, 0)), umpp = Math.max(0, num(f.umpp, 0)), iAt = typeof f.iAt === 'function' ? f.iAt : function () { return 0; };
      out.pPot = pmpp;
      const netzOk = inp.netzOk !== false, lim = isFinite(num(inp.limit, NaN)) ? clamp(num(inp.limit, 1), 0.05, 1) : limit;
      if (S.dead) { out.state = 'zerstoert'; out.curtail = pmpp; out.curtailKind = 'tot'; return out; }
      if (uoc > udcMax) { S.dead = true; out.dead = true; out.state = 'zerstoert'; out.curtail = pmpp; out.curtailKind = 'tot'; out.events.push({ id: 'wr-zerstoert', x: uoc, y: udcMax }); S.state = 'zerstoert'; return out; }
      if (!netzOk) { out.state = 'netzaus'; out.curtail = pmpp; out.curtailKind = 'netz'; if (S.state !== 'netzaus') out.events.push({ id: 'netzausfall' }); S.state = 'netzaus'; return out; }
      if (uoc < uStart || pmpp <= 0) { out.state = pmpp > 0 ? 'start' : 'nacht'; out.curtail = pmpp; out.curtailKind = pmpp > 0 ? 'start' : ''; out.pStandby = 1; if (S.state === 'an') out.events.push({ id: 'wr-stopp' }); S.state = 'aus'; return out; }
      /* Arbeitspunkt: im Fenster am MPP, sonst an der Fenstergrenze */
      let U = umpp, P = pmpp, kind = '';
      if (U < mppMin || U > mppMax) { U = clamp(U, mppMin, mppMax); P = U > uoc ? 0 : U * Math.max(0, iAt(U)); kind = 'fenster'; out.events.push({ id: 'wr-fenster', x: umpp, y: mppMin, z: mppMax, quiet: true }); }
      if (P > 0 && iAt(U) > iDcMax) { /* Eingangsstrom begrenzt: Arbeitspunkt nach rechts schieben */
        const u2 = bisect(function (u) { return iAt(u) - iDcMax; }, U, uoc, 40);
        U = u2; P = U * iDcMax; kind = 'strom';
      }
      let pAc = invAcFromDc(model, Pn, P);
      const cap = Pn * lim;
      if (pAc > cap + 1e-9) { /* Clipping / Einspeisebegrenzung */
        const pc = cap / Pn, pdcCap = cap + Pn * (model.a + model.b * pc + model.c * pc * pc);
        /* rechts vom MPP faellt P(U): groesstes U mit P(U) >= pdcCap */
        const u4 = bisect(function (u) { return u * Math.max(0, iAt(u)) - pdcCap; }, Math.max(U, umpp), uoc, 40);
        U = u4; P = pdcCap; pAc = cap; kind = lim < 1 - 1e-9 ? 'limit' : 'clip';
      }
      out.state = 'an'; out.pDc = P; out.pAc = pAc; out.pLoss = P - pAc; out.uDc = U; out.iDc = U > 0 ? P / U : 0; out.curtail = Math.max(0, pmpp - P); out.curtailKind = kind === 'fenster' ? '' : kind;
      out.window = kind === 'fenster'; out.pStandby = 0;
      if (S.state !== 'an') out.events.push({ id: 'wr-start', x: pAc });
      if (kind === 'clip') out.events.push({ id: 'wr-clipping', x: Pn, y: pmpp });
      if (kind === 'limit') out.events.push({ id: 'begrenzung', x: cap });
      S.state = 'an';
      return out;
    }
    const o = { kind: 'netz', cfg: cfg, model: model, step: stepNetz, state: function () { return { state: S.state, dead: S.dead }; }, reset: function () { S.dead = false; S.state = 'aus'; } };
    return wrapMethods(o);
  }
  const inv = {
    models: INV_MODELS, eta: G_(invEta), euroEta: G_(invEuro), acFromDc: G_(invAcFromDc), loss: G_(invLoss), gridTable: GRID_TABLE, euroWeights: EURO_W, create: S_(invCreate)
  };

  /* =====================================================================================================
   *  LAST (ENR_CORE.loads)  SPEC 4.11: Geraete sind die einzige Quelle, alle Tagesenergien werden aus ihnen gerechnet
   * ===================================================================================================== */
  const DEVICES = [
    { id: 'led10', name: 'LED-Licht 2 × 5 W', P: 10, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'pumpe60', name: 'Pumpe 60 W', P: 60, cosphi: 1, surge: 3, type: 'dc', duty: 1 },
    { id: 'radio10', name: 'Radio', P: 10, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'laden30', name: 'Handy und Laptop laden', P: 30, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'kuehlbox45', name: 'Kühlbox (Verdichter, Einschaltdauer 35 %)', P: 45, cosphi: 1, surge: 1, type: 'dc', duty: 0.35 },
    { id: 'led12', name: 'LED-Licht', P: 12, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'laptop45', name: 'Laptop', P: 45, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'wasserpumpe40', name: 'Wasserpumpe', P: 40, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'handy10', name: 'Handy laden', P: 10, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'pumpe250', name: 'Bewässerungspumpe', P: 250, cosphi: 0.8, surge: 3, type: 'ac', duty: 1 },
    { id: 'steuerung2', name: 'Steuerung', P: 2, cosphi: 1, surge: 1, type: 'dc', duty: 1 },
    { id: 'grund110', name: 'Dauerlast Haus (Kühlschrank, Pumpen, Netzteile)', P: 110, cosphi: 0.95, surge: 1, type: 'ac', duty: 1 },
    { id: 'standby40', name: 'Verbraucher im Standby', P: 40, cosphi: 0.9, surge: 1, type: 'ac', duty: 1 },
    { id: 'morgen600', name: 'Morgenspitze (Kaffee, Licht)', P: 600, cosphi: 0.95, surge: 1, type: 'ac', duty: 1 },
    { id: 'mittag700', name: 'Mittagsspitze (Kochen)', P: 700, cosphi: 0.95, surge: 1, type: 'ac', duty: 1 },
    { id: 'abend500', name: 'Abendlast (Licht, Fernseher)', P: 500, cosphi: 0.95, surge: 1, type: 'ac', duty: 1 },
    { id: 'buero250', name: 'Homeoffice-Arbeitsplatz', P: 250, cosphi: 0.95, surge: 1, type: 'ac', duty: 1 },
    { id: 'frei', name: 'freier Verbraucher', P: 100, cosphi: 1, surge: 1, type: 'ac', duty: 1 }
  ];
  const DEV_BY_ID = {}; DEVICES.forEach(function (d) { DEV_BY_ID[d.id] = d; });
  const PROFILES = {
    gartenhaus: { name: 'Gartenhaus', list: [['led10', [[19, 23]]], ['pumpe60', [[12, 13]]], ['radio10', [[15, 18]]], ['laden30', [[17, 19]]]] },
    camper: { name: 'Camper', list: [['kuehlbox45', [[0, 24]]], ['led12', [[19, 23]]], ['laptop45', [[15, 18]]], ['wasserpumpe40', [[8, 8.25]]], ['handy10', [[16, 19]]]] },
    pumpe: { name: 'Bewässerungspumpe', list: [['pumpe250', [[7, 9]]], ['steuerung2', [[0, 24]]]] },
    haushalt: { name: 'Haushalt', list: [['grund110', [[0, 24]]], ['standby40', [[0, 24]]], ['morgen600', [[6, 8]]], ['mittag700', [[11, 13]]], ['abend500', [[17, 22]]]] },
    'haushalt-gross': { name: 'großer Haushalt', base: 'haushalt', factor: 1.4 },
    homeoffice: { name: 'Haushalt mit Homeoffice', base: 'haushalt', extra: [['buero250', [[8, 17]]]] },
    leer: { name: 'Haus leer (Ferien)', list: [['grund110', [[0, 24]]], ['standby40', [[0, 24]]]] },
    frei: { name: 'freier Verbraucher', list: [['frei', [[0, 24]]]] }
  };
  function winHrs(w) { let h = 0; (w || []).forEach(function (x) { h += Math.max(0, x[1] - x[0]); }); return h; }
  function inWin(w, t) { for (let i = 0; i < w.length; i++) if (t >= w[i][0] - 1e-9 && t < w[i][1] - 1e-9) return true; return false; }
  function overlap(w, a, b) { let s = 0; for (let i = 0; i < w.length; i++) s += Math.max(0, Math.min(b, w[i][1]) - Math.max(a, w[i][0])); return s; }
  function finishProfile(p) {
    const ds = p.devices;
    let e = 0, eS = 0;
    ds.forEach(function (d) { d.hours = winHrs(d.windows); d.wh = d.P * d.duty * d.hours; e += d.wh; eS += d.wh / (d.cosphi > 0 ? d.cosphi : 1); });
    p.energyWh = e; p.cosphi = eS > 0 ? e / eS : 1;
    p.hourly = []; for (let h = 0; h < 24; h++) { let s = 0; ds.forEach(function (d) { s += d.P * d.duty * overlap(d.windows, h, h + 1); }); p.hourly.push(s); }
    let pk = 0, pkVA = 0;
    for (let m = 0; m < 1440; m++) { const t = (m + 0.5) / 60; let s = 0, sv = 0; ds.forEach(function (d) { if (inWin(d.windows, t)) { s += d.P * d.duty; sv += d.P * d.duty / (d.cosphi > 0 ? d.cosphi : 1); } }); if (s > pk) pk = s; if (sv > pkVA) pkVA = sv; }
    p.peakW = pk; p.peakVA = pkVA;
    let sg = 0;
    ds.forEach(function (d) { if (!(d.surge > 1)) return; d.windows.forEach(function (w) { const t = w[0] + 1e-6; let s = 0; ds.forEach(function (o) { if (inWin(o.windows, t)) s += o.P * o.duty; }); s += d.P * (d.surge - 1); if (s > sg) sg = s; }); });
    p.surgeW = Math.max(sg, pk);
    return p;
  }
  function devCopy(def, P, windows) { return { id: def.id, name: def.name, P: P, cosphi: def.cosphi, surge: def.surge, type: def.type, duty: def.duty, windows: windows.map(function (w) { return [w[0], w[1]]; }) }; }
  function profileOf(kind, opt) {
    opt = isObj(opt) ? opt : {};
    const def = typeof kind === 'string' && Object.prototype.hasOwnProperty.call(PROFILES, kind) ? PROFILES[kind] : null;
    if (!def) return fail('Unbekanntes Lastprofil. Bekannt sind: ' + Object.keys(PROFILES).join(', ') + '.');
    const fk = clamp(num(opt.faktor, 1), 0.01, 100), pFrei = clamp(num(opt.pFrei, 100), 0, 100000);
    let list = def.list; const factor = def.factor || 1;
    if (def.base) list = PROFILES[def.base].list.concat(def.extra || []);
    const devices = list.map(function (it) { const d = DEV_BY_ID[it[0]]; return devCopy(d, (it[0] === 'frei' ? pFrei : d.P) * factor * fk, it[1]); });
    const p = { ok: true, kind: kind, name: def.name, factor: factor * fk, devices: devices };
    return finishProfile(p);
  }
  function profileFromDevices(geraete) {
    if (!isArr(geraete) || !geraete.length) return fail('Die Geräteliste ist leer.');
    const devices = [];
    for (let i = 0; i < geraete.length; i++) {
      const g = geraete[i];
      if (!isObj(g)) return fail('Gerät ' + (i + 1) + ' ist ungültig.');
      const P = num(g.P, NaN), h = num(g.stunden, NaN);
      if (!(P >= 0) || !(h >= 0 && h <= 24)) return fail('Gerät ' + (i + 1) + ': Leistung (ab 0 W) und Stunden je Tag (0 bis 24) müssen Zahlen sein.');
      /* Zeitlage (ungünstig angenommen): Die Betriebsstunden beginnen um 18 Uhr, die Last liegt also nach Sonnenuntergang. */
      const w = h >= 24 ? [[0, 24]] : (18 + h <= 24 ? [[18, 18 + h]] : [[18, 24], [0, 18 + h - 24]]);
      const cp = clamp(num(g.cosphi, 1), 0.3, 1);
      devices.push({ id: 'g' + i, name: String(g.name || 'Gerät ' + (i + 1)), P: P, cosphi: cp, surge: Math.max(1, num(g.anlauf, 1)), type: g.typ === 'ac' ? 'ac' : 'dc', duty: 1, windows: w });
    }
    return finishProfile({ ok: true, kind: 'geraete', name: 'Geräteliste', factor: 1, devices: devices });
  }
  function minuteOf(tS) { let t = num(tS, NaN); if (!isFinite(t)) return NaN; t = ((t % 24) + 24) % 24; return Math.floor(t * 60 + 1e-9) / 60; }
  function loadPower(p, tS) {
    if (!isObj(p) || !isArr(p.devices)) return NaN;
    const t = minuteOf(tS); if (!isFinite(t)) return NaN;
    let s = 0; for (let i = 0; i < p.devices.length; i++) { const d = p.devices[i]; if (inWin(d.windows, t)) s += d.P * d.duty; }
    return s;
  }
  function loadApparent(p, tS) {
    if (!isObj(p) || !isArr(p.devices)) return NaN;
    const t = minuteOf(tS); if (!isFinite(t)) return NaN;
    let s = 0; for (let i = 0; i < p.devices.length; i++) { const d = p.devices[i]; if (inWin(d.windows, t)) s += d.P * d.duty / (d.cosphi > 0 ? d.cosphi : 1); }
    return s;
  }
  function loadEnergy(p) {
    if (!isObj(p) || !isArr(p.devices)) return NaN;
    let e = 0; p.devices.forEach(function (d) { e += d.P * d.duty * winHrs(d.windows); });
    return e;
  }
  const loads = {
    devices: DEVICES, profiles: Object.keys(PROFILES), profile: S_(profileOf), fromDevices: S_(profileFromDevices), power: G_(loadPower), apparent: G_(loadApparent), energy: G_(loadEnergy)
  };

  /* =====================================================================================================
   *  LADEREGLER (ENR_CORE.ctrl)  SPEC 4.8
   * ===================================================================================================== */
  const CTRL_TYPES = ['pwm', 'mppt', 'direkt'];
  function ctrlDefaults(type, Usys) {
    const U = num(Usys, NaN);
    if (CTRL_TYPES.indexOf(type) < 0) return fail('Unbekannter Reglertyp. Erlaubt sind „pwm“, „mppt“ und „direkt“.');
    if (USYS.indexOf(U) < 0) return fail('Die Systemspannung muss 12, 24 oder 48 V sein.');
    return {
      ok: true, type: type, Usys: U, usw: type === 'pwm' ? 0.3 : 0, Usw: type === 'pwm' ? 0.3 : 0, etaDc: 0.975, etaTrack: 0.99, startDelta: 5, iSelf: type === 'mppt' ? 0.02 : 0,
      uocMax: type === 'pwm' ? 50 : (type === 'mppt' ? 100 : null), uocMaxOptions: type === 'pwm' ? [50] : (type === 'mppt' ? [50, 100, 150] : []), imax: 20, imaxOptions: [10, 20, 30, 40],
      tAbsMaxS: 4 * 3600, tCompMvK: 3, tNachtS: 3600, tRebulkS: 600, tFilterS: 30
    };
  }
  function illinois(f, a, b, fa, fb) {
    let side = 0, c = a;
    for (let it = 0; it < 60; it++) {
      c = (fa * b - fb * a) / (fa - fb);
      if (!isFinite(c) || c <= Math.min(a, b) || c >= Math.max(a, b)) c = 0.5 * (a + b);
      const fc = f(c);
      if (!isFinite(fc)) return c;
      if (Math.abs(fc) < 1e-10 || Math.abs(b - a) < 1e-11) return c;
      if (fc * fb > 0) { b = c; fb = fc; if (side === -1) fa *= 0.5; side = -1; } else { a = c; fa = fc; if (side === 1) fb *= 0.5; side = 1; }
    }
    return c;
  }
  function ctrlCreate(spec) {
    spec = isObj(spec) ? spec : {};
    const df = ctrlDefaults(spec.type, spec.Usys);
    if (df.ok === false) return df;
    const chem = spec.chem === 'lifepo4' ? 'lifepo4' : 'blei';
    const bd = battDefaults(chem, df.Usys);
    const P = { type: df.type, Usys: df.Usys, chem: chem, s: df.Usys / 12 };
    function applySpec(sp) {
      P.imax = clamp(num(sp.Imax, P.imax === undefined ? df.imax : P.imax), 1, 200);
      const um = sp.Uocmax !== undefined ? sp.Uocmax : sp.uocMax;
      P.uocMax = df.uocMax === null ? Infinity : clamp(num(um, P.uocMax === undefined || P.uocMax === Infinity ? df.uocMax : P.uocMax), 10, 1000);
      P.tempComp = sp.tempComp !== undefined ? (!!sp.tempComp && chem === 'blei') : !!P.tempComp;
      P.lvd = sp.lvd !== undefined ? !!sp.lvd : (P.lvd === undefined ? true : P.lvd);
      const ua = sp.uAbs !== undefined ? sp.uAbs : sp.Uabs, uf = sp.uFloat !== undefined ? sp.uFloat : sp.Ufloat, ul = sp.lvdU !== undefined ? sp.lvdU : sp.uLvd;
      P.uAbs = clamp(num(ua, P.uAbs === undefined ? bd.uAbs : P.uAbs), 0.85 * bd.uAbs, 1.15 * bd.uAbs);
      P.uFloat = clamp(num(uf, P.uFloat === undefined ? bd.uFloat : P.uFloat), 0.85 * bd.uFloat, 1.15 * bd.uFloat);
      P.uLvd = clamp(num(ul, P.uLvd === undefined ? bd.uLvd : P.uLvd), 0.8 * bd.uLvd, 1.1 * bd.uLvd);
      P.uBack = P.uLvd + (bd.uLvdBack - bd.uLvd);
      const Cn = num(sp.C, P.C === undefined ? 100 : P.C); P.C = clamp(Cn, 1, 5000);
      P.tail = bd.tailFrac * P.C; P.iFloat = bd.floatFrac * P.C;
    }
    applySpec(spec);
    const S = {};
    function resetS() { S.phase = 1; S.tAbs = 0; S.tNoPv = 0; S.night = true; S.loadOn = true; S.uf = NaN; S.dead = false; S.bmsOff = false; S.tLow = 0; S.ub = NaN; S.unmet = false; S.t = 0; }
    resetS();
    const STAGE_NAME = ['aus', 'Bulk', 'Absorption', 'Float'];
    function step(dtS, inp) {
      const dt = clamp(num(dtS, 0), 0, 3600); inp = isObj(inp) ? inp : {};
      const f = inp.field, b = inp.batt;
      if (!isObj(f) || !b || typeof b.state !== 'function') return fail('Der Regler braucht ein Feld und einen Akku.');
      const bs = b.state();
      const rPv = Math.max(0, num(inp.rPv, 0)), rBat = Math.max(0, num(inp.rBat, 0)), tB = num(inp.tBat, bs.T);
      const out = { ok: true, iPv: 0, ub: bs.ocv, ut: bs.ocv, ubus: bs.ocv, iBat: 0, uf: 0, iF: 0, pF: 0, pPot: 0, pOut: 0, pLoadAct: 0, pLoadReq: 0, loss: { cable: 0, cableBat: 0, conv: 0, self: 0 }, curtail: 0, curtailImax: 0, curtailReg: 0, mismatch: 0,
        stage: 0, stageName: 'aus', phase: S.phase, loadOn: S.loadOn, dead: S.dead, uT: NaN, regulated: false, limited: false, unmet: false, mode: P.type, duty: NaN, bmsOff: S.bmsOff, pFree: 0, iL: 0, usw: 0, events: [] };
      const uoc = Math.max(0, num(f.uoc, 0)), isc = Math.max(0, num(f.isc, 0)), umpp = Math.max(0, num(f.umpp, 0)), impp = Math.max(0, num(f.impp, 0)), pmpp = Math.max(0, num(f.pmpp, 0));
      const iAt = typeof f.iAt === 'function' ? f.iAt : function () { return 0; };
      out.pPot = pmpp;
      if (!isFinite(S.uf)) S.uf = bs.ocv;
      if (!S.dead && uoc > P.uocMax) { S.dead = true; out.dead = true; out.events.push({ id: 'regler-tot', code: 'regler-uoc', x: uoc, y: P.uocMax }); }
      /* Tiefentladeschutz (Hysterese), gefilterte Spannung */
      if (!P.lvd) S.loadOn = true;
      else if (S.loadOn && S.uf < P.uLvd) { S.loadOn = false; out.events.push({ id: 'lvd-aus', x: S.uf }); }
      else if (!S.loadOn && S.uf > P.uBack) { S.loadOn = true; out.events.push({ id: 'lvd-wieder', x: S.uf }); }
      out.loadOn = S.loadOn;
      const aF = 1 - Math.exp(-dt / df.tFilterS);
      if (S.dead) {
        S.uf += (bs.ocv - S.uf) * aF; S.ub = bs.ocv; S.tNoPv = 0;
        out.stage = 0; out.stageName = STAGE_NAME[0]; out.ut = bs.ocv; out.ub = bs.ocv; out.ubus = bs.ocv;
        return out;
      }
      const pLoadReq = S.loadOn ? Math.max(0, num(inp.pLoad, 0)) : 0;
      out.pLoadReq = pLoadReq;
      const ub0 = isFinite(S.ub) ? S.ub : bs.ocv;
      const lim = b.limits(dt), dmax = Math.max(0, num(lim && lim.iDischargeMax, 0));
      let mode = P.type;
      if (mode === 'mppt' && !(umpp >= ub0 + df.startDelta)) mode = 'pwm';
      out.mode = mode;
      const usw = mode === 'pwm' ? df.usw : 0, iSelf = P.type === 'mppt' ? df.iSelf : 0;
      const eta = df.etaDc * df.etaTrack;
      const pOutFree = mode === 'mppt' ? eta * Math.max(0, pmpp - impp * impp * rPv) : 0;
      function ipv(U) {
        if (mode === 'mppt') return pOutFree / Math.max(U, 1);
        const u0 = U + usw;
        if (!(u0 < uoc)) return 0;
        let I = Math.max(0, iAt(u0));
        if (rPv > 1e-9) { for (let k = 0; k < 6; k++) { const un = u0 + I * rPv; const In = un < uoc ? Math.max(0, iAt(un)) : 0; I = 0.4 * I + 0.6 * In; } }
        return I;
      }
      function utOf(x) { return b.uTerm(x); }
      function resid(x) { const U = utOf(x) + x * rBat; return ipv(U) - pLoadReq / Math.max(U, 1) - iSelf - x; }
      /* freie Loesung: Strombilanz am Sammelpunkt, Akku und Feld im Gleichgewicht */
      const lo = -dmax, hi = (mode === 'mppt' ? pOutFree / Math.max(0.5 * bs.ocv, 1) : isc) + 1e-6;
      const rlo = resid(lo);
      let xFree, unmet = false;
      if (rlo < -1e-6) { xFree = lo; unmet = true; }
      else {
        const rhi = resid(hi);
        if (rhi >= 0) xFree = hi;
        else if (rlo === 0) xFree = lo;
        else xFree = illinois(resid, lo, hi, rlo, rhi);
      }
      const uFree = utOf(xFree) + xFree * rBat;
      const iFreePv = ipv(uFree);
      /* Spannungsregelung (Dreistufenladung) */
      const comp = P.tempComp ? -0.003 * (clamp(tB, 0, 40) - 25) * (6 * P.s) : 0;
      const uAb = P.uAbs + comp, uFl = P.uFloat + comp;
      const uHold = S.phase === 3 ? uFl : uAb;
      const xV = Math.max(0, (uHold - bs.ocv) / (bs.rCharge + rBat));
      const xCap = Math.min(bs.accept, xV, S.phase === 3 ? P.iFloat : Infinity);
      let x = xFree, regulated = false, limited = false, bms = false;
      if (P.type === 'direkt') {
        if (chem === 'lifepo4') {
          if (S.bmsOff) { if (bs.ocv < P.uFloat) S.bmsOff = false; }
          else if (utOf(xFree) > 1.15 * P.uAbs && xFree > 0) { S.bmsOff = true; out.events.push({ id: 'bms-aus', x: utOf(xFree) }); }
          if (S.bmsOff) { bms = true; x = Math.min(0, -(pLoadReq / Math.max(ub0, 1)) - iSelf); x = Math.max(x, -dmax); }
        }
      } else if (!unmet && xFree > xCap + 1e-9) { regulated = true; x = xCap; }
      let U, ut, uT = NaN;
      function point() {
        if (regulated) { ut = Math.max(uHold - x * rBat, bs.ocv + x * bs.ri); uT = ut; } else { ut = utOf(x); uT = NaN; }
        U = ut + x * rBat;
      }
      point();
      let iL = pLoadReq / Math.max(U, 1), pLoadAct = pLoadReq;
      let iPvNeed = x + iL + iSelf;
      if (!unmet && !bms && iPvNeed > P.imax + 1e-9) {
        limited = true; regulated = false;
        for (let k = 0; k < 5; k++) { x = Math.max(-dmax, P.imax - iL - iSelf); point(); iL = pLoadReq / Math.max(U, 1); }
        iPvNeed = x + iL + iSelf;
      }
      let iPvOut = Math.max(0, iPvNeed);
      if (bms) iPvOut = 0;
      if (unmet) {
        x = -dmax; point();
        const iAvail = Math.min(ipv(U), P.imax);
        iL = Math.max(0, iAvail - iSelf - x); const iLmax = pLoadReq / Math.max(U, 1); if (iL > iLmax) iL = iLmax;
        pLoadAct = iL * U; iPvOut = Math.max(0, x + iL + iSelf);
      } else pLoadAct = iL * U;
      /* Feldseite */
      let iF = 0, uF = 0, pF = 0, cable = 0, conv = 0, pFfree = 0, mismatch = 0, duty = NaN;
      const uFfree = Math.min(uFree + usw + iFreePv * rPv, Math.max(uoc, uFree + usw));
      if (mode === 'mppt') {
        pFfree = pmpp;
        if (iPvOut > 0) {
          const iAv = pOutFree / Math.max(U, 1), lam = iAv > 1e-12 ? clamp(iPvOut / iAv, 0, 1) : 0;
          pF = lam * pmpp; cable = lam * impp * impp * rPv; conv = (pF - cable) * (1 - eta); uF = umpp; iF = umpp > 0 ? pF / umpp : 0;
        }
      } else {
        pFfree = iFreePv * uFfree; mismatch = Math.max(0, pmpp - pFfree);
        if (iPvOut > 0) {
          iF = iPvOut; uF = Math.min(U + usw + iF * rPv, Math.max(uoc, U + usw)); pF = iF * uF; cable = iF * iF * rPv; conv = iF * usw;
          const iFull = ipv(U); duty = iFull > 1e-9 ? clamp(iF / iFull, 0, 1) : NaN;
        }
      }
      const curtail = Math.max(0, pFfree - pF);
      Object.assign(out, { iPv: iPvOut, ub: ut, ut: ut, ubus: U, iBat: x, uf: uF, iF: iF, pF: pF, pOut: iPvOut * U, pLoadAct: pLoadAct, curtail: curtail, curtailImax: limited ? curtail : 0, curtailReg: limited ? 0 : curtail, mismatch: mismatch,
        uT: uT, regulated: regulated, limited: limited, unmet: unmet, duty: duty, bmsOff: S.bmsOff, pFree: pFfree, iL: iL, usw: usw });
      out.loss = { cable: cable, cableBat: x * x * rBat, conv: conv, self: iSelf * U };
      /* Zustandsmaschine der Ladephasen */
      if (unmet && !S.unmet) out.events.push({ id: 'akku-leer', x: bs.soc * 100 });
      S.unmet = unmet;
      const ph0 = S.phase;
      if (iPvOut < 0.02) S.tNoPv += dt; else { S.tNoPv = 0; S.night = false; }
      if (S.tNoPv >= df.tNachtS && !S.night) { S.night = true; S.phase = 1; S.tAbs = 0; S.tLow = 0; }
      if (!S.night) {
        if (S.phase === 1 && regulated && (xV <= bs.accept + 1e-9 || bs.accept < bd.accFrac * P.C * (1 - 1e-9))) { S.phase = 2; S.tAbs = 0; } /* Absorption: Spannungsgrenze erreicht oder Akku nimmt wegen Saettigung weniger auf */
        else if (S.phase === 2) {
          if (iPvOut >= 0.02) S.tAbs += dt;
          if ((regulated && x < P.tail) || S.tAbs >= df.tAbsMaxS) S.phase = 3;
        } else if (S.phase === 3) {
          if (ut < uFl - 0.6 * P.s) S.tLow += dt; else S.tLow = 0;
          if (S.tLow >= df.tRebulkS) { S.phase = 1; S.tAbs = 0; S.tLow = 0; }
        }
      }
      if (S.phase !== ph0) out.events.push({ id: 'ladeschluss', stage: STAGE_NAME[S.phase], x: ut, y: Math.abs(x) });
      out.phase = S.phase; out.stage = S.night ? 0 : S.phase; out.stageName = STAGE_NAME[out.stage];
      S.uf += (ut - S.uf) * aF; S.ub = ut; S.t += dt;
      return out;
    }
    function state() {
      return { type: P.type, stage: S.night ? 0 : S.phase, stageName: STAGE_NAME[S.night ? 0 : S.phase], phase: S.phase, night: S.night, loadOn: S.loadOn, lvdAktiv: P.lvd && !S.loadOn, dead: S.dead, bmsOff: S.bmsOff, tAbs: S.tAbs, uf: S.uf, uAbs: P.uAbs, uFloat: P.uFloat, uLvd: P.uLvd, uBack: P.uBack, imax: P.imax, uocMax: P.uocMax === Infinity ? null : P.uocMax, tail: P.tail, iFloat: P.iFloat, tempComp: P.tempComp, lvd: P.lvd };
    }
    function update(patch) {
      if (!isObj(patch)) return fail('Die Änderung des Reglers muss ein Objekt sein.');
      if (patch.type !== undefined && patch.type !== P.type) return fail('Der Reglertyp lässt sich nicht im Betrieb ändern.');
      applySpec(patch); return { ok: true };
    }
    const obj = { type: P.type, defaults: df, step: step, state: state, reset: resetS, update: update, loadOn: function () { return S.loadOn; } };
    return wrapMethods(obj, { loadOn: 1 });
  }
  const ctrl = { defaults: S_(ctrlDefaults), create: S_(ctrlCreate), types: CTRL_TYPES.slice() };

  /* =====================================================================================================
   *  FELD und KENNFELD  SPEC 4.12 Schritt 3
   * ===================================================================================================== */
  const MAP_NG = 24, MAP_NT = 19, MAP_G = [], MAP_T = [];
  for (let i = 0; i < MAP_NG; i++) MAP_G.push(Math.pow(1500, i / (MAP_NG - 1))); /* gleichmaessig in ln G: bei kleinem Licht ist Pmpp/G stark gekruemmt */
  const MAP_LG = MAP_G.map(Math.log);
  for (let j = 0; j < MAP_NT; j++) MAP_T.push(-30 + 130 * j / (MAP_NT - 1));
  const mapCache = {};
  function mapKey(sp) { return [sp.Ns, sp.n, sp.Rs, sp.Rsh, sp.IscRef, sp.UocRef, sp.aI, sp.bU, sp.A].join('|'); }
  function mapFor(sp) {
    const key = mapKey(sp);
    if (mapCache[key]) return mapCache[key];
    /* Knoten werden erst beim ersten Zugriff gerechnet (jeder Knoten ist ein exaktes pv.keys) */
    const pg = [], um = [];
    for (let i = 0; i < MAP_NG; i++) { pg.push(new Array(MAP_NT)); um.push(new Array(MAP_NT)); }
    function node(i, j) { if (pg[i][j] === undefined) { const k = C.pv.keys(sp, { G: MAP_G[i], Tc: MAP_T[j] }); pg[i][j] = k.Pmpp / MAP_G[i]; um[i][j] = k.Umpp; } }
    const ks = Object.keys(mapCache); if (ks.length > 12) delete mapCache[ks[0]];
    return (mapCache[key] = { pg: pg, um: um, node: node });
  }
  function idxOf(nodes, x) {
    if (x <= nodes[0]) return [0, 0];
    const n = nodes.length;
    if (x >= nodes[n - 1]) return [n - 2, 1];
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (nodes[m] <= x) lo = m; else hi = m; }
    return [lo, (x - nodes[lo]) / (nodes[lo + 1] - nodes[lo])];
  }
  function mapAt(m, G, Tc) {
    const a = idxOf(MAP_LG, Math.log(G)), b = idxOf(MAP_T, Tc), i = a[0], j = b[0], u = a[1], v = b[1];
    m.node(i, j); m.node(i, j + 1); m.node(i + 1, j); m.node(i + 1, j + 1);
    function bil(t) { return (1 - u) * ((1 - v) * t[i][j] + v * t[i][j + 1]) + u * ((1 - v) * t[i + 1][j] + v * t[i + 1][j + 1]); }
    return { pg: bil(m.pg), um: bil(m.um) };
  }
  const DARK = { dark: true, uoc: 0, isc: 0, umpp: 0, impp: 0, pmpp: 0, iAt: function () { return 0; }, uAt: function () { return 0; } };
  function makeField(fc) {
    fc = isObj(fc) ? fc : {};
    if (!C.pv || typeof C.pv.spec !== 'function') return fail(TXT.keinKern);
    const sp = C.pv.spec(fc.spec === undefined ? 'si60' : fc.spec);
    if (!sp || sp.ok === false) return fail(sp && sp.why ? sp.why : 'Die Modul-Spezifikation ist ungültig.');
    const ns = clamp(Math.round(num(fc.ns, 1)), 1, 40), np = clamp(Math.round(num(fc.np, 1)), 1, 20);
    const shaded = isObj(fc.shade) && fc.shade.kind && fc.shade.kind !== 'keiner';
    const m = shaded ? null : mapFor(sp), cache = {};
    function at(G, Tc) {
      G = clamp(num(G, 0), 0, 1500); Tc = clamp(num(Tc, 25), -40, 120);
      if (G < 1) return DARK;
      if (!shaded) {
        const par = C.pv.cond(sp, { G: G, Tc: Tc }), uocM = par.Uoc, mm = mapAt(m, G, Tc);
        const umpp = ns * mm.um, pmpp = ns * np * mm.pg * G;
        return {
          dark: false, uoc: ns * uocM, isc: np * par.Isc, umpp: umpp, pmpp: pmpp, impp: umpp > 0 ? pmpp / umpp : 0,
          iAt: function (U) { return np * C.pv.current(par, U / ns); }, uAt: function (I) { return ns * C.pv.voltage(par, I / np); }
        };
      }
      const key = Math.round(G / 10) + '|' + Math.round(Tc / 2);
      if (cache[key]) return cache[key];
      const fe = C.pv.array({ spec: sp, ns: ns, np: np, cond: { G: G, Tc: Tc }, shade: fc.shade, bypass: fc.bypass });
      if (!fe || fe.ok === false) return DARK;
      const mp = fe.mpp(), o = { dark: false, uoc: fe.uoc, isc: fe.isc, umpp: mp.U, impp: mp.I, pmpp: mp.P, iAt: function (U) { return fe.iAt(U); }, uAt: function (I) { return fe.uAt(I); } };
      const ks = Object.keys(cache); if (ks.length > 60) delete cache[ks[0]];
      return (cache[key] = o);
    }
    return { ok: true, spec: sp, ns: ns, np: np, shaded: shaded, at: at };
  }

  /* =====================================================================================================
   *  SYSTEMSIMULATION (ENR_CORE.sys)  SPEC 4.12
   * ===================================================================================================== */
  const WX = { klar: { c: 0 }, heiter: { c: 0.25 }, wolkig: { c: 0.625 }, bedeckt: { c: 1 }, wechselhaft: { c: 0.5, zug: true } };
  function sysPresets(w) {
    if (w === undefined) { const o = {}; Object.keys(WX).forEach(function (k) { o[k] = { c: WX[k].c, zug: !!WX[k].zug }; }); return o; }
    if (typeof w !== 'string' || !Object.prototype.hasOwnProperty.call(WX, w)) return fail('Unbekannte Wetterlage. Bekannt sind: ' + Object.keys(WX).join(', ') + '.');
    return { ok: true, preset: w, c: WX[w].c, zug: !!WX[w].zug };
  }
  const KIND = {
    'regler-tot': 'error', 'tiefentladung': 'error', 'wr-ueberlast': 'error', 'wr-zerstoert': 'error', 'ueberladung': 'error', 'hotspot-gefahr': 'error', 'kabel-ueberlast': 'error',
    'lvd-aus': 'warn', 'bms-aus': 'warn', 'netzausfall': 'warn', 'akku-leer': 'warn', 'wr-clipping': 'warn', 'wr-unterspannung': 'warn', 'wr-nicht-erkannt': 'warn', 'blackout': 'warn', 'kabel-spannungsfall': 'warn',
    'akku-leer-nacht': 'warn', 'regler-strom': 'warn', 'uoc-hoch': 'warn', 'pwm-verlust': 'warn', 'mppt-start': 'warn', 'wr-fenster': 'warn', 'lokal-mpp': 'warn', 'rueckstrom': 'warn', 'bypass-fehlt': 'warn', 'hotspot': 'warn', 'pv-schatten': 'warn'
  };
  Object.keys(DIAG).forEach(function (id) { if (!TEXTS.diag[id]) TEXTS.diag[id] = { kind: KIND[id] || 'info', text: DIAG[id] }; });
  function evText(id, vars) {
    const tp = TEXTS.diag && TEXTS.diag[id];
    const raw = tp ? (typeof tp === 'string' ? tp : tp.text) : '';
    return fillTpl(raw, vars);
  }
  const NORM_KAPPA = 56;
  function oget(o, a, b) { return isObj(o) && o[a] !== undefined ? o[a] : (isObj(o) ? o[b] : undefined); }
  function normCfg(cfg) {
    if (!isObj(cfg)) return fail('Die Anlagenbeschreibung fehlt.');
    const o = {};
    if (cfg.typ !== undefined && cfg.typ !== 'insel' && cfg.typ !== 'netz') return fail('Die Art der Anlage muss „insel“ oder „netz“ sein.');
    o.typ = cfg.typ === 'netz' ? 'netz' : 'insel';
    o.ort = cfg.ort === undefined ? 'mitte' : cfg.ort;
    const site = C.sun.site(o.ort);
    if (!site) return fail('Unbekannter Standort. Erlaubt sind mitte, sued, nord, pol oder ein Breitengrad.');
    o.lat = site.lat;
    o.N = clamp(Math.round(num(cfg.N, 172)), 1, 365);
    o.tS = clamp(num(cfg.tS, 8), 0, 24); if (o.tS >= 24) o.tS = 0;
    o.tage = clamp(num(cfg.tage, 3), 0.1, 400);
    o.neigung = clamp(num(cfg.neigung, 35), 0, 90); o.azimut = clamp(num(cfg.azimut, 0), -180, 180);
    const w = isObj(cfg.wetter) ? cfg.wetter : {};
    o.wetter = { c: clamp(num(w.c, 0), 0, 1), preset: typeof w.preset === 'string' ? w.preset : 'frei', seed: Math.round(num(w.seed, 1)), zug: !!w.zug };
    o.h = clamp(num(cfg.h, 60), 1, 600);
    o.quelle = cfg.quelle === 'konstant' ? 'konstant' : 'tagesgang';
    o.G = clamp(num(cfg.G, 1000), 0, 1500); o.ta = clamp(num(cfg.ta, 25), -40, 60); o.uhrFest = !!cfg.uhrFest;
    const f = isObj(cfg.feld) ? cfg.feld : {};
    o.feld = { spec: f.spec === undefined ? 'si60' : f.spec, ns: num(f.ns, 1), np: num(f.np, 1), shade: f.shade, bypass: f.bypass };
    const rg = isObj(cfg.regler) ? cfg.regler : {}, lt = isObj(cfg.leitung) ? cfg.leitung : {};
    const kap = clamp(num(lt.kappa, NORM_KAPPA), 30, 70);
    const lp = isObj(lt.pv) ? lt.pv : {}, lb = isObj(lt.bat) ? lt.bat : {};
    o.leitung = {
      kappa: kap,
      pv: { l: Math.max(0, num(lp.l !== undefined ? lp.l : (rg.lPv !== undefined ? rg.lPv : rg.lLeitung), 0)), q: Math.max(0.1, num(lp.q !== undefined ? lp.q : (rg.aPv !== undefined ? rg.aPv : rg.qLeitung), 4)) },
      bat: { l: Math.max(0, num(lb.l !== undefined ? lb.l : rg.lBat, 0)), q: Math.max(0.1, num(lb.q !== undefined ? lb.q : rg.aBat, 10)) }
    };
    o.rPv = o.leitung.pv.l > 0 ? 2 * o.leitung.pv.l / (kap * o.leitung.pv.q) : 0;
    o.rBat = o.leitung.bat.l > 0 ? 2 * o.leitung.bat.l / (kap * o.leitung.bat.q) : 0;
    const ls = isObj(cfg.last) ? cfg.last : {};
    o.last = { profil: ls.profil === undefined ? (o.typ === 'netz' ? 'haushalt' : 'frei') : ls.profil, faktor: num(ls.faktor, 1), pFrei: num(ls.pFrei, 100), geraete: ls.geraete };
    if (o.typ === 'insel') {
      const ak = isObj(cfg.akku) ? cfg.akku : {};
      o.akku = { chem: ak.chem === undefined ? 'blei' : ak.chem, Usys: num(ak.Usys, 12), C: num(ak.C, 100), soc0: clamp(num(ak.soc0, 1), 0, 1), T: num(ak.T, 25) };
      o.regler = { typ: rg.typ === undefined ? 'mppt' : rg.typ, Imax: rg.Imax, Uocmax: rg.Uocmax, tempComp: rg.tempComp !== undefined ? rg.tempComp : o.akku.chem === 'blei', lvd: rg.lvd, Uabs: rg.Uabs, Ufloat: rg.Ufloat, lvdU: rg.lvdU };
      const wr = cfg.wr;
      if (isObj(wr) && wr.modell !== 'kein' && wr.modell !== undefined || (isObj(wr) && (wr.Sn !== undefined))) o.wr = { modell: wr.modell === undefined ? 'insel' : wr.modell, Sn: num(wr.Sn !== undefined ? wr.Sn : wr.Pn, NaN), sparmodus: !!wr.sparmodus };
      else o.wr = null;
    } else {
      const wr = isObj(cfg.wr) ? cfg.wr : {}, nz = isObj(cfg.netz) ? cfg.netz : {};
      o.wr = { modell: wr.modell === undefined ? 'standard' : wr.modell, Pn: num(wr.Pn, 3000), limit: clamp(num(wr.limit !== undefined ? wr.limit : nz.limit, 1), 0.05, 1) };
      o.netz = { ok: nz.ok !== false, limit: o.wr.limit, speicherKWh: Math.max(0, num(nz.speicherKWh, 0)) };
    }
    return o;
  }
  function sunTimeOf(N, lat) { const r = C.sun.sunriseSunset(N, lat); return r && r.ok !== false ? r : { rise: 6, set: 18, polar: null }; }

  function sysCreate(cfg0) {
    if (!C.pv || !C.sun || !C.pv.cond) return fail(TXT.keinKern);
    let cfg = normCfg(cfg0);
    if (cfg.ok === false) return cfg;
    const F = makeField(cfg.feld);
    if (F.ok === false) return F;
    cfg.feld.ns = F.ns; cfg.feld.np = F.np;
    let prof = null, batt = null, ctl = null, wr = null, cloud = null;
    function buildProfile() {
      const l = cfg.last;
      if (isObj(l.profil) && isArr(l.profil.devices)) return l.profil;
      if (isArr(l.geraete)) return profileFromDevices(l.geraete);
      return profileOf(l.profil, { pFrei: l.pFrei, faktor: l.faktor });
    }
    function buildCloud() {
      const w = cfg.wetter;
      const span = clamp(cfg.tage * 24 + 24, 24, 24 * 28);
      cloud = w.zug && w.c > 0 ? { f: C.sun.cloudTrack(w.seed, w.c, span), span: span } : null;
    }
    prof = buildProfile();
    if (!prof || prof.ok === false) return fail(prof && prof.why ? prof.why : 'Das Lastprofil ist ungültig.');
    buildCloud();
    if (cfg.typ === 'insel') {
      batt = battCreate(cfg.akku);
      if (batt.ok === false) return batt;
      ctl = ctrlCreate({ type: cfg.regler.typ, Usys: cfg.akku.Usys, chem: cfg.akku.chem, C: cfg.akku.C, Imax: cfg.regler.Imax, Uocmax: cfg.regler.Uocmax, tempComp: cfg.regler.tempComp, lvd: cfg.regler.lvd, uAbs: cfg.regler.Uabs, uFloat: cfg.regler.Ufloat, lvdU: cfg.regler.lvdU });
      if (ctl.ok === false) return ctl;
      if (cfg.wr) {
        wr = invCreate({ kind: 'insel', model: cfg.wr.modell === 'insel' || INV_MODELS[cfg.wr.modell] ? cfg.wr.modell : 'insel', Sn: cfg.wr.Sn, Usys: cfg.akku.Usys, sparmodus: cfg.wr.sparmodus });
        if (wr.ok === false) return wr;
      }
    } else {
      wr = invCreate({ kind: 'netz', model: cfg.wr.modell, Pn: cfg.wr.Pn, limit: cfg.wr.limit });
      if (wr.ok === false) return wr;
    }
    const capWh = cfg.typ === 'netz' ? cfg.netz.speicherKWh * 1000 : 0;
    const ETA_SP = 0.95;
    /* ---- Zustand ---- */
    let dayT0 = 0, T, clockT, N0, absS0, tc, dayIdx, eSp, lastInv, events, lastEv, Q, base, dayList, trace, ST, err;
    function zeroQ() {
      return { ePot: 0, eFeld: 0, eCurt: 0, eMis: 0, eCabPv: 0, eConv: 0, eBusPv: 0, eSelf: 0, eCabBat: 0, eLoadDc: 0, eLoadAc: 0, eWr: 0, eStandby: 0, tLvd: 0, tN: 0,
        eAc: 0, eWrLoss: 0, eStb: 0, eHaus: 0, eDirekt: 0, eInSp: 0, eAusSp: 0, eEinsp: 0, eBezug: 0, eBezugStb: 0, eSpIn: 0, eSpOut: 0, uMax: -1e9, uMin: 1e9, socMin: 1, socMax: 0, ePv: 0 };
    }
    function snap() {
      const q = Object.assign({}, Q);
      if (batt) { const b = batt.state(); q.bZu = b.eZu; q.bAb = b.eAb; q.bDE = b.dEchem; q.bLoss = Object.assign({}, b.loss); q.bLossSum = b.lossSum; q.gasAh = b.gasAh; q.damage = b.damage; }
      q.eSp = eSp;
      return q;
    }
    function newDayTrace() { return { t: [], g: [], gClear: [], pv: [], load: [], bat: [], soc: [], netz: [], pot: [], haus: [], ac: [], sp: [] }; }
    function resetAll(soc) {
      T = 0; dayT0 = 0; clockT = 0; N0 = cfg.N; absS0 = cfg.tS * 3600; dayIdx = 0; eSp = 0; lastInv = null; events = []; lastEv = {}; err = '';
      Q = zeroQ(); dayList = []; trace = newDayTrace();
      if (batt) batt.reset(soc); if (ctl) ctl.reset(); if (wr && wr.reset) wr.reset();
      const e0 = envAt(0), f0 = F.at(e0.G, e0.Ta + (cfg.feld ? (F.spec.NOCT - 20) / 800 * e0.G : 0)); void f0;
      tc = e0.Ta + (F.spec.NOCT - 20) / 800 * e0.G;
      base = snap();
      ST = { soc: batt ? batt.state().soc : 0, pPv: 0, pPot: 0, pMpp: 0, pCurt: 0, curtail: 0, uBat: batt ? batt.state().ocv : 0, iBat: 0, pBat: 0, stage: 0, stageName: 'aus', pLoad: 0, pLoadDc: 0, uPv: 0, iPv: 0, uMpp: 0, uoc: 0, uOc: 0, lvdAktiv: false, regDead: false, bmsAus: false, gasAh: 0, damage: 0, pDc: 0, pAc: 0, pHaus: 0, pNetz: 0, pSp: 0, socSp: 0, wrOn: false, wrDead: false, netzOk: true, window: true, clip: false, eta: 0, pStandby: 0, sApp: 0, wrOverload: false, tBat: cfg.typ === 'insel' ? cfg.akku.T : 0 };
      makeState(null, e0);
    }
    function clockAt(dt) {
      const a = absS0 + clockT + dt, di = Math.floor(a / 86400 + 1e-12);
      return { di: di, N: ((N0 - 1 + di) % 365 + 365) % 365 + 1, tS: (a - di * 86400) / 3600, tH: a / 3600 };
    }
    function envAt(dt) {
      const ck = clockAt(cfg.quelle === 'konstant' || cfg.uhrFest ? 0 : dt);
      if (cfg.quelle === 'konstant') return { N: ck.N, tS: ck.tS, G: cfg.G, alt: 45, az: 0, Ta: cfg.ta, m: 1, di: ck.di, gh: cfg.G };
      const m = cloud ? cloud.f(ck.tH % cloud.span) : 1;
      const q = C.sun.poa({ N: ck.N, tS: ck.tS, lat: cfg.lat, beta: cfg.neigung, gam: cfg.azimut, c: cfg.wetter.c, m: m });
      const Ta = C.sun.climate(cfg.ort, ck.N, ck.tS);
      return { N: ck.N, tS: ck.tS, G: q.g, alt: q.alt, az: q.az, Ta: isFinite(Ta) ? Ta : 15, m: m, di: ck.di, gh: q.gh };
    }
    function emit(id, vars, edge) {
      if (!edge && lastEv[id] !== undefined && T - lastEv[id] < 3600) return;
      lastEv[id] = T;
      const ck = clockAt(0), e = { t: T, N: ck.N, tS: ck.tS, id: id, kind: KIND[id] || 'info', text: evText(id, vars) };
      if (id === 'regler-tot' || id === 'wr-zerstoert') e.fx = 'crash';
      events.push(e); if (events.length > 400) events.shift();
    }
    function vf(x, d) { return fm(x, d); }
    function evFromCtl(list) {
      list.forEach(function (e) {
        if (e.id === 'regler-tot') emit('regler-tot', { x: vf(e.x, 0), y: vf(e.y, 0) }, true);
        else if (e.id === 'lvd-aus' || e.id === 'lvd-wieder') emit(e.id, { x: vf(e.x, 2) }, true);
        else if (e.id === 'ladeschluss') emit('ladeschluss', { stage: e.stage, x: vf(e.x, 2), y: vf(e.y, 1) }, true);
        else if (e.id === 'akku-leer') emit('akku-leer', { x: vf(e.x, 0) }, true);
        else if (e.id === 'bms-aus') emit('bms-aus', {}, true);
      });
    }
    function evFromInv(list) {
      list.forEach(function (e) {
        if (e.quiet) return;
        const vars = { x: vf(e.x, 0), y: vf(e.y, 0), z: vf(e.z, 0) };
        if (e.id === 'wr-unterspannung') { vars.x = vf(e.x, 1); vars.y = vf(e.y, 1); }
        emit(e.id, vars, e.id === 'netzausfall' || e.id === 'wr-start' || e.id === 'wr-stopp' || e.id === 'wr-zerstoert');
      });
    }
    function closeDay(partial) {
      const s = snap(), b = base, cfgTyp = cfg.typ;
      const d = function (k) { return (s[k] || 0) - (b[k] || 0); };
      const ck = clockAt(0);
      const rec = { N: ((N0 - 1 + dayIdx) % 365 + 365) % 365 + 1, partial: !!partial, tag: dayIdx };
      if (cfgTyp === 'insel') {
        Object.assign(rec, { ePv: d('eFeld') - d('eCabPv'), ePot: d('ePot'), eCurt: d('eCurt'), eLast: wr ? d('eLoadAc') : d('eLoadDc'), eLadung: 0, eEntl: 0, socMin: Q.socMin, socMax: Q.socMax, tLvd: d('tLvd') / 3600,
          gasAh: d('gasAh'), uMax: Q.uMax > -1e8 ? Q.uMax : 0, uMin: Q.uMin < 1e8 ? Q.uMin : 0, eInvStandby: d('eStandby'), damage: s.damage || 0 });
        rec.eLadung = Q.eChg || 0; rec.eEntl = Q.eDis || 0;
        rec.eLadung -= (b.eChg || 0); rec.eEntl -= (b.eDis || 0);
      } else {
        const eAc = d('eAc'), eHaus = d('eHaus'), eEig = d('eDirekt') + d('eAusSp');
        Object.assign(rec, { ePvAc: eAc, ePot: d('ePot'), eEigen: eEig, eEinsp: d('eEinsp'), eBezug: d('eBezug') + d('eBezugStb'), eHaus: eHaus, eCurt: d('eCurt'),
          quote: eAc > 0 ? (d('eDirekt') + d('eInSp')) / eAc : NaN, autarkie: eHaus > 0 ? eEig / eHaus : NaN, euro: invEuro(cfg.wr.modell) });
      }
      void ck;
      return rec;
    }
    function rollDay() {
      dayList.push(closeDay(false)); if (dayList.length > 60) dayList.shift();
      dayIdx = clockAt(0).di; dayT0 = T;
      base = snap(); Q.socMin = ST.soc !== undefined ? ST.soc : 1; Q.socMax = Q.socMin; Q.uMax = -1e9; Q.uMin = 1e9; Q.eChg = 0; Q.eDis = 0; base.eChg = 0; base.eDis = 0; trace = newDayTrace();
    }
    /* ---- Zustandsobjekt fuer Pruefstaende (viele Namen, alle gleich belegt) ---- */
    function makeState(o, e) {
      const s = ST;
      s.t = T; s.N = e.N; s.tS = e.tS; s.elev = e.alt; s.alt = e.alt; s.azim = e.az; s.az = e.az; s.gPoa = e.G; s.G = e.G; s.tcell = tc; s.Tc = tc; s.ta = e.Ta; s.m = e.m; s.typ = cfg.typ;
      if (o) Object.assign(s, o);
      return s;
    }
    function reportBatt(bs) { return { soc: bs.soc, gasAh: bs.gasAh, damage: bs.damage, tBat: bs.T }; }
    function subInsel(d, e, fo) {
      const dH = d / 3600;
      const pP = loadPower(prof, e.tS), sP = loadApparent(prof, e.tS);
      let invOut = null, pDcReq = 0, pAcReq = 0;
      const connected = ctl.loadOn();
      if (wr) { pAcReq = pP; if (connected) { invOut = wr.step(d, { pAc: pP, s: sP, ub: ST.uBat > 0 ? ST.uBat : batt.ocv(ST.soc), sparmodus: cfg.wr.sparmodus }); evFromInv(invOut.events || []); pDcReq = invOut.pDc; } }
      else pDcReq = connected ? pP : 0;
      const co = ctl.step(d, { field: fo, batt: batt, pLoad: pDcReq, rPv: cfg.rPv, rBat: cfg.rBat, tBat: cfg.akku.T });
      if (!co || co.ok === false) { err = (co && co.why) || 'Der Regler konnte nicht rechnen.'; return false; }
      evFromCtl(co.events || []);
      const bo = batt.step(d, { iReq: co.iBat, uT: co.uT, temp: cfg.akku.T });
      if (!bo || bo.ok === false) { err = 'Der Akku konnte nicht rechnen.'; return false; }
      const sc = co.pLoadReq > 1e-12 ? clamp(co.pLoadAct / co.pLoadReq, 0, 1) : (co.loadOn ? 1 : 0);
      const pAcSrv = invOut ? invOut.pAc * sc : 0, wrLoss = invOut ? invOut.loss * sc : 0, stby = invOut ? invOut.standby * sc : 0;
      const pLoadShown = wr ? pAcSrv : co.pLoadAct, bs = batt.state();
      const pBat = bo.ut * bo.I;
      Q.ePot += fo.pmpp * dH; Q.eFeld += co.pF * dH; Q.eCurt += co.curtail * dH; Q.eMis += co.mismatch * dH; Q.eCabPv += co.loss.cable * dH; Q.eConv += co.loss.conv * dH;
      Q.eBusPv += co.iPv * co.ubus * dH; Q.eSelf += co.loss.self * dH; Q.eCabBat += co.loss.cableBat * dH; Q.eLoadDc += co.pLoadAct * dH; Q.eLoadAc += pAcSrv * dH; Q.eWr += wrLoss * dH; Q.eStandby += stby * dH;
      if (pBat > 0) Q.eChg = (Q.eChg || 0) + pBat * dH; else Q.eDis = (Q.eDis || 0) - pBat * dH;
      if (!co.loadOn && cfg.regler.lvd !== false) Q.tLvd += d;
      Q.socMin = Math.min(Q.socMin, bs.soc); Q.socMax = Math.max(Q.socMax, bs.soc); Q.uMax = Math.max(Q.uMax, bo.ut); Q.uMin = Math.min(Q.uMin, bo.ut); Q.tN += d;
      const wst = wr ? wr.state() : null, lvdA = cfg.regler.lvd !== false && !co.loadOn;
      makeState({
        uPv: co.uf, iPv: co.iF, pPv: Math.max(0, co.pF - co.loss.cable), pField: co.pF, pPot: fo.pmpp, pMpp: fo.pmpp, uMpp: fo.umpp, uoc: fo.uoc, uOc: fo.uoc, isc: fo.isc, pCurt: co.curtail, curtail: co.curtail, curtailImax: co.curtailImax, mismatch: co.mismatch,
        uBat: bo.ut, iBat: bo.I, pBat: pBat, ub: bo.ut, uBus: co.ubus, soc: bs.soc, stage: co.stage, stageName: co.stageName, pLoad: pLoadShown, pLoadDc: co.pLoadAct, pLoadReq: pAcReq || pDcReq,
        iBus: co.iPv, lvdAktiv: lvdA, lvdOff: lvdA, regDead: co.dead, dead: co.dead, bmsAus: co.bmsOff, gasAh: bs.gasAh, damage: bs.damage, tBat: bs.T, pStandby: stby, sApp: invOut ? sP * sc : 0,
        wrOverload: !!(wst && wst.why === 'ueberlast' && wst.off), wrOn: !!(wst && wst.state === 'an'), duty: isFinite(co.duty) ? co.duty : undefined, regulated: co.regulated, unmet: co.unmet, mode: co.mode, ctrlMode: co.mode,
        pLoss: co.loss.cable + co.loss.conv + co.loss.cableBat + co.loss.self + wrLoss, etaCtrl: co.pF - co.loss.cable > 1 ? co.iPv * co.ubus / (co.pF - co.loss.cable) : 0
      }, e);
      return true;
    }
    function subNetz(d, e, fo) {
      const dH = d / 3600, netzOk = cfg.netz.ok;
      const pH = netzOk ? loadPower(prof, e.tS) : 0;
      const wo = wr.step(d, { field: fo, netzOk: netzOk, limit: cfg.wr.limit });
      if (!wo || wo.ok === false) { err = (wo && wo.why) || 'Der Wechselrichter konnte nicht rechnen.'; return false; }
      evFromInv(wo.events || []);
      const pAc = wo.pAc, pMax = 500 * cfg.netz.speicherKWh;
      const dir = Math.min(pAc, pH), sur = pAc - dir, def = pH - dir;
      let pIn = 0, pOut = 0;
      if (capWh > 0 && netzOk) {
        if (sur > 0) { pIn = Math.min(sur, pMax, Math.max(0, (capWh - eSp) / (dH * ETA_SP))); eSp += pIn * ETA_SP * dH; }
        else if (def > 0) { pOut = Math.min(def, pMax, eSp * ETA_SP / dH); eSp -= pOut / ETA_SP * dH; }
        eSp = clamp(eSp, 0, capWh);
      }
      const einsp = sur - pIn, bezug = def - pOut, stb = wo.pStandby || 0;
      const pNetz = einsp - bezug - stb;
      Q.ePot += fo.pmpp * dH; Q.eAc += pAc * dH; Q.eWrLoss += wo.pLoss * dH; Q.eCurt += wo.curtail * dH; Q.eHaus += pH * dH; Q.eDirekt += dir * dH; Q.eInSp += pIn * dH; Q.eAusSp += pOut * dH;
      Q.eEinsp += einsp * dH; Q.eBezug += bezug * dH; Q.eBezugStb += stb * dH; Q.eStb += stb * dH; Q.ePv += wo.pDc * dH; Q.tN += d;
      const socSp = capWh > 0 ? eSp / capWh : 0;
      if (capWh > 0 && socSp >= 0.99 && einsp > 1 && sur > 0) emit('speicher-voll', { x: vf(einsp, 0) }, false);
      if (!netzOk && pHauseWanted(e) > 0) emit('blackout', {}, false);
      makeState({
        pDc: wo.pDc, uDc: wo.uDc, iDc: wo.iDc, pAc: pAc, eta: wo.pDc > 1 ? pAc / wo.pDc : 0, pHaus: pH, pNetz: pNetz, pSp: pIn > 0 ? pIn : -pOut, socSp: socSp, wrDead: !!wo.dead, wrOn: wo.state === 'an', clip: wo.curtailKind === 'clip',
        window: !wo.window, netzOk: netzOk, pCurt: wo.curtail, curtail: wo.curtail, curtailKind: wo.curtailKind, pPot: fo.pmpp, pMpp: fo.pmpp, uMpp: fo.umpp, uoc: fo.uoc, uOc: fo.uoc, isc: fo.isc, wrState: wo.state, pLoss: wo.pLoss,
        pStandby: stb, pDirekt: dir, pEinsp: einsp, pBezug: bezug
      }, e);
      Q.socMin = Math.min(Q.socMin, socSp); Q.socMax = Math.max(Q.socMax, socSp);
      return true;
    }
    function pHauseWanted(e) { return loadPower(prof, e.tS); }
    function sub(d) {
      const e = envAt(d / 2);
      const tcS = e.Ta + (F.spec.NOCT - 20) / 800 * e.G;
      tc += (tcS - tc) * (1 - Math.exp(-d / 300));
      const fo = F.at(e.G, tc);
      const ok = cfg.typ === 'insel' ? subInsel(d, e, fo) : subNetz(d, e, fo);
      if (!ok) return false;
      T += d; ST.t = T; if (!(cfg.quelle === 'konstant' || cfg.uhrFest)) clockT += d;
      const ck = clockAt(0);
      if (ck.di !== dayIdx) rollDay();
      /* Tagesgang */
      const tr = trace; tr.t.push(+ck.tS.toFixed(5)); tr.g.push(e.G); tr.pot.push(fo.pmpp);
      if (cfg.typ === 'insel') { tr.pv.push(ST.pPv); tr.load.push(ST.pLoad); tr.bat.push(ST.pBat); tr.soc.push(ST.soc * 100); tr.netz.push(0); tr.haus.push(0); tr.ac.push(0); tr.sp.push(0); }
      else { tr.pv.push(ST.pDc); tr.load.push(ST.pHaus); tr.bat.push(ST.pSp); tr.soc.push(ST.socSp * 100); tr.netz.push(ST.pNetz); tr.haus.push(ST.pHaus); tr.ac.push(ST.pAc); tr.sp.push(ST.pSp); }
      tr.gClear.push(e.G);
      return true;
    }
    function step(dtS) {
      let rem = clamp(num(dtS, 0), 0, 86400 * 30);
      if (err) return { ok: false, why: err };
      let n = 0;
      while (rem > 1e-9) { const d = Math.min(cfg.h, rem); if (!sub(d)) return { ok: false, why: err }; rem -= d; n++; }
      return { ok: true, steps: n, t: T };
    }
    function state() { return Object.assign({}, ST, { events: events.length, cfgTyp: cfg.typ, h: cfg.h, N: clockAt(0).N, tS: clockAt(0).tS }); }
    function sunNow() { const ck = clockAt(0); return sunTimeOf(ck.N, cfg.lat); }
    function dayTraceFn() {
      const ck = clockAt(0), su = sunNow(), tr = trace, k = Math.max(1, Math.ceil(tr.t.length / 1440));
      const pick2 = function (a) { return a.filter(function (v, i) { return i % k === 0; }); };
      const o = { t: pick2(tr.t), g: pick2(tr.g), gClear: pick2(tr.gClear), pv: pick2(tr.pv), load: pick2(tr.load), bat: pick2(tr.bat), soc: pick2(tr.soc), netz: pick2(tr.netz), pot: pick2(tr.pot), haus: pick2(tr.haus), ac: pick2(tr.ac), sp: pick2(tr.sp) };
      o.now = ck.tS; o.N = ck.N; o.rise = su.rise; o.set = su.set; o.polar = su.polar;
      return o;
    }
    function dailyFn() { const l = dayList.slice(); if (T > dayT0 + 1e-9) l.push(closeDay(true)); return l; }
    /* ---- Energiebilanz ---- */
    function balance(scope) {
      const s = snap(), b = scope === 'tag' ? base : zeroBase(), d = function (k) { return (s[k] || 0) - (b[k] || 0); };
      const out = { ok: true, typ: cfg.typ, scope: scope === 'tag' ? 'tag' : 'gesamt', E: {}, rows: [], checks: [], text: '' };
      const rows = out.rows, E = out.E;
      function row(id, label, value, group) { E[id] = value; rows.push({ id: id, label: label, value: value, unit: 'Wh', group: group || '' }); }
      let ref = 0, res = [];
      if (cfg.typ === 'insel') {
        const eZu = d('bZu'), eAb = d('bAb'), dE = d('bDE'), lossSum = d('bLossSum');
        const l = {}; ['ri', 'pol', 'gas', 'eta', 'peukert', 'self'].forEach(function (k) { l[k] = (s.bLoss ? s.bLoss[k] : 0) - (b.bLoss ? b.bLoss[k] : 0); });
        row('ePot', 'Feld: Potenzial am MPP', d('ePot'), 'feld'); row('eMis', 'Feld: Arbeitspunkt neben dem MPP (Regler zwingt die Spannung)', d('eMis'), 'feld');
        row('eCurt', 'Feld: abgeregelt (Akku voll oder Stromgrenze)', d('eCurt'), 'feld'); row('eFeld', 'Feld: genutzt', d('eFeld'), 'feld');
        row('eCabPv', 'Verlust Leitung Modul-Regler', d('eCabPv'), 'regler'); row('eConv', 'Verlust im Regler (Schalter oder Wandler)', d('eConv'), 'regler'); row('eBusPv', 'Solarenergie am Sammelpunkt', d('eBusPv'), 'regler');
        row('eAbTerm', 'Akku gibt ab (an den Klemmen)', eAb, 'akku'); row('eZuTerm', 'Akku nimmt auf (an den Klemmen)', eZu, 'akku'); row('eCabBat', 'Verlust Leitung Regler-Akku', d('eCabBat'), 'regler');
        row('eSelf', 'Eigenverbrauch des Reglers', d('eSelf'), 'regler'); row('eLoadDc', 'Last (Gleichstrom am Sammelpunkt)', d('eLoadDc'), 'last');
        row('eWr', 'Verlust im Wechselrichter', d('eWr'), 'wr'); row('eLoadAc', 'Last (Wechselstrom)', d('eLoadAc'), 'last');
        row('dEchem', 'Akku: Änderung der gespeicherten Energie', dE, 'akku');
        ['ri', 'pol', 'gas', 'eta', 'peukert', 'self'].forEach(function (k) { row('akkuV_' + k, 'Akku-Verlust ' + { ri: 'Innenwiderstand', pol: 'Polarisation', gas: 'Gasung und Überlauf', eta: 'Ladewirkungsgrad', peukert: 'Peukert', self: 'Selbstentladung' }[k], l[k], 'akku'); });
        ref = Math.max(E.ePot, E.eFeld, 1);
        res = [['feld', 'Feld: genutzt = Leitung + Regler + Sammelpunkt', E.eFeld - E.eCabPv - E.eConv - E.eBusPv], ['pot', 'Feld: Potenzial = genutzt + abgeregelt + neben dem MPP', E.ePot - E.eFeld - E.eCurt - E.eMis],
          ['bus', 'Sammelpunkt: Quellen = Senken', E.eBusPv + eAb - (E.eLoadDc + eZu + E.eCabBat + E.eSelf)], ['akku', 'Akku: aufgenommen − abgegeben = gespeichert + Verluste', (eZu - eAb) - (dE + lossSum)], ['wr', 'Wechselrichter: Last (DC) = Last (AC) + Verlust', wr ? E.eLoadDc - E.eLoadAc - E.eWr : 0]];
        E.lossSum = lossSum; E.soc = ST.soc;
      } else {
        const sp0 = (b.eSp || 0);
        row('ePot', 'Feld: Potenzial am MPP', d('ePot'), 'feld'); row('eAc', 'Wechselrichter: Wechselstrom', d('eAc'), 'wr'); row('eWrLoss', 'Verlust im Wechselrichter', d('eWrLoss'), 'wr'); row('eCurt', 'abgeregelt (Clipping, Fenster, Begrenzung, Netz)', d('eCurt'), 'wr');
        row('eHaus', 'Hausverbrauch', d('eHaus'), 'haus'); row('eDirekt', 'Eigenverbrauch direkt', d('eDirekt'), 'haus'); row('eInSp', 'in den Speicher (Wechselstrom)', d('eInSp'), 'speicher'); row('eAusSp', 'aus dem Speicher (Wechselstrom)', d('eAusSp'), 'speicher');
        row('eEinsp', 'Einspeisung', d('eEinsp'), 'netz'); row('eBezug', 'Netzbezug für das Haus', d('eBezug'), 'netz'); row('eStb', 'Eigenverbrauch des Wechselrichters aus dem Netz', d('eStb'), 'netz');
        row('dESp', 'Speicher: Änderung der gespeicherten Energie', (s.eSp || 0) - sp0, 'speicher');
        ref = Math.max(E.ePot, E.eAc, 1);
        const lossSp = E.eInSp * (1 - ETA_SP) + E.eAusSp * (1 / ETA_SP - 1);
        res = [['pot', 'Feld: Potenzial = Wechselstrom + Verlust + abgeregelt', E.ePot - E.eAc - E.eWrLoss - E.eCurt], ['ac', 'Wechselstrom = direkt + Speicher + Einspeisung', E.eAc - E.eDirekt - E.eInSp - E.eEinsp],
          ['haus', 'Haus = direkt + aus Speicher + Bezug', E.eHaus - E.eDirekt - E.eAusSp - E.eBezug], ['speicher', 'Speicher: ein − aus − Verlust = gespeichert', (E.eInSp - E.eAusSp - lossSp) - E.dESp]];
        const q = E.eAc > 0 ? (E.eDirekt + E.eInSp) / E.eAc : NaN, a = E.eHaus > 0 ? (E.eDirekt + E.eAusSp) / E.eHaus : NaN;
        out.kennzahlen = { quote: q, autarkie: a, quoteText: isFinite(q) ? '' : TXT.quoteKeinePv, autarkieText: isFinite(a) ? '' : TXT.autarkieKeinHaus, euroEta: invEuro(cfg.wr.modell) };
      }
      let tot = 0;
      res.forEach(function (r) { tot += Math.abs(r[2]); out.checks.push({ id: r[0], text: r[1], value: r[2], ok: Math.abs(r[2]) <= 0.005 * ref }); });
      out.residualWh = tot; out.residualPct = 100 * tot / ref; out.ref = ref; out.closed = tot <= 0.005 * ref;
      out.text = fillTpl(TXT.bilanz, { x: fm(tot, 1), y: fm(100 * tot / ref, 2) });
      return out;
    }
    function zeroBase() { return { bLoss: { ri: 0, pol: 0, gas: 0, eta: 0, peukert: 0, self: 0 } }; }
    /* ---- Aenderungen im Betrieb ---- */
    function merge(dst, src) {
      Object.keys(src).forEach(function (k) { if (isObj(src[k]) && isObj(dst[k])) merge(dst[k], src[k]); else dst[k] = src[k]; });
      return dst;
    }
    function update(patch) {
      if (!isObj(patch)) return fail('Die Änderung muss ein Objekt sein.');
      const raw = merge(JSON.parse(JSON.stringify(cfg0 === undefined ? {} : cfg0, function (k, v) { return typeof v === 'function' ? undefined : v; })), patch);
      const nc = normCfg(raw);
      if (nc.ok === false) return nc;
      if (nc.typ !== cfg.typ) return fail('Die Art der Anlage lässt sich nicht im Betrieb ändern.');
      const f2 = makeField(nc.feld);
      if (f2.ok === false) return f2;
      const same = JSON.stringify([nc.feld.spec, f2.ns, f2.np, nc.feld.shade || null]) === JSON.stringify([cfg.feld.spec, F.ns, F.np, cfg.feld.shade || null]);
      if (!same) return fail('Modul, Strang und Verschattung lassen sich nicht im Betrieb ändern.');
      if (cfg.typ === 'insel') {
        if (nc.akku.chem !== cfg.akku.chem || nc.akku.Usys !== cfg.akku.Usys || nc.akku.C !== cfg.akku.C || nc.regler.typ !== cfg.regler.typ) return fail('Akku und Reglertyp lassen sich nicht im Betrieb ändern.');
        if (JSON.stringify(nc.wr) !== JSON.stringify(cfg.wr)) return fail('Der Wechselrichter lässt sich nicht im Betrieb ändern.');
      } else if (nc.wr.modell !== cfg.wr.modell || nc.wr.Pn !== cfg.wr.Pn || nc.netz.speicherKWh !== cfg.netz.speicherKWh) return fail('Wechselrichter und Speicher lassen sich nicht im Betrieb ändern.');
      const wchg = JSON.stringify(nc.wetter) !== JSON.stringify(cfg.wetter) || nc.tage !== cfg.tage;
      const keepN = N0, keepAbs = absS0, keepClock = clockT;
      void keepN; void keepAbs; void keepClock;
      const mergedKeep = { N: cfg.N, tS: cfg.tS };
      cfg = nc; cfg.N = mergedKeep.N; cfg.tS = mergedKeep.tS; cfg.feld.ns = F.ns; cfg.feld.np = F.np;
      cfg0 = raw;
      const p2 = buildProfile(); if (p2 && p2.ok !== false) prof = p2;
      if (wchg) buildCloud();
      if (ctl) ctl.update({ Imax: cfg.regler.Imax, Uocmax: cfg.regler.Uocmax, tempComp: cfg.regler.tempComp, lvd: cfg.regler.lvd, uAbs: cfg.regler.Uabs, uFloat: cfg.regler.Ufloat, lvdU: cfg.regler.lvdU });
      return { ok: true };
    }
    function setClock(N, tS) {
      const n = clamp(Math.round(num(N, NaN)), 1, 365), t = num(tS, NaN);
      if (!isFinite(n) || !isFinite(t)) return fail('Tag und Sonnenzeit müssen Zahlen sein.');
      const ck0 = clockAt(0); void ck0;
      N0 = n; absS0 = clamp(t, 0, 24) * 3600; if (absS0 >= 86400) absS0 = 0; clockT = 0; dayIdx = 0; dayT0 = T;
      base = snap(); Q.socMin = ST.soc !== undefined ? ST.soc : 1; Q.socMax = Q.socMin; Q.uMax = -1e9; Q.uMin = 1e9; Q.eChg = 0; Q.eDis = 0; base.eChg = 0; base.eDis = 0; trace = newDayTrace();
      return { ok: true };
    }
    resetAll(cfg.typ === 'insel' ? cfg.akku.soc0 : 0);
    const sim = {
      cfg: cfg, step: step, state: state, reset: function (soc) { resetAll(soc === undefined ? (cfg.typ === 'insel' ? cfg.akku.soc0 : 0) : soc); return { ok: true }; }, balance: balance, daily: dailyFn, dayTrace: dayTraceFn, update: update, setClock: setClock,
      get events() { return events; }, get time() { return T; }, profile: function () { return prof; }
    };
    const wrapped = wrapMethods(sim);
    Object.defineProperty(wrapped, 'cfg', { get: function () { return cfg; }, enumerable: true });
    return wrapped;
  }
  function sysRun(cfg, days, opts) {
    opts = isObj(opts) ? opts : {};
    const dd = clamp(num(days, 1), 0, 60);
    const sim = sysCreate(cfg);
    if (!sim || sim.ok === false) return sim && sim.ok === false ? sim : fail(TXT.keinKern);
    const h = sim.cfg.h, total = dd * 86400, nSteps = Math.round(total / h);
    if (nSteps > 100000) return fail('Der Lauf wäre zu lang (höchstens 100 000 Schritte).');
    const sampleS = Math.max(h, num(opts.sampleS, 600)), per = Math.max(1, Math.round(sampleS / h));
    const samples = [];
    const keys = ['t', 'N', 'tS', 'gPoa', 'tcell', 'pPv', 'pPot', 'pCurt', 'uBat', 'iBat', 'pBat', 'soc', 'stage', 'pLoad', 'lvdAktiv', 'pDc', 'pAc', 'pHaus', 'pNetz', 'pSp', 'socSp'];
    const grab = function () { const s = sim.state(), o = {}; keys.forEach(function (k) { if (s[k] !== undefined) o[k] = typeof s[k] === 'number' ? s[k] : s[k]; }); samples.push(o); };
    grab();
    for (let i = 1; i <= nSteps; i++) { const r = sim.step(h); if (!r || r.ok === false) return fail((r && r.why) || 'Die Simulation hat abgebrochen.', { samples: samples }); if (i % per === 0) grab(); }
    const ev = sim.events.slice(), faults = []; ev.forEach(function (e) { if ((e.kind === 'error' || e.kind === 'warn') && faults.indexOf(e.id) < 0) faults.push(e.id); });
    const res = { ok: true, samples: samples, daily: sim.daily(), balance: sim.balance(), events: ev, faults: faults, final: sim.state() };
    Object.defineProperty(res, 'sim', { value: sim, enumerable: false });
    return res;
  }
  const sys = { create: S_(sysCreate), run: S_(sysRun), presets: S_(sysPresets), weather: Object.keys(WX) };

  /* =====================================================================================================
   *  AUSLEGUNG (ENR_CORE.design)  SPEC 4.13
   * ===================================================================================================== */
  const LIST_FB = { querschnitte: [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95], sicherungen: [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250], akku: [50, 75, 100, 120, 150, 200, 250, 300, 400, 600], regler: [10, 20, 30, 40, 60], wr: [150, 300, 500, 1000, 1500, 2000, 3000, 5000] };
  /* Strombelastbarkeit Kupferleitung (Verlegeart B2, grobe Tabellenwerte, A) */
  const IZ = { 1.5: 18, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76, 25: 101, 35: 125, 50: 151, 70: 192, 95: 232 };
  function listsOf() {
    const s = C.calc && C.calc.skal ? C.calc.skal : null;
    return { querschnitte: (s && s.querschnitte) || LIST_FB.querschnitte, sicherungen: (s && s.sicherungen) || LIST_FB.sicherungen, akku: (s && s.akku) || LIST_FB.akku, regler: (s && s.regler) || LIST_FB.regler, wr: LIST_FB.wr, iz: IZ };
  }
  function upL(list, x) { for (let i = 0; i < list.length; i++) if (list[i] >= x * (1 - 1e-9)) return list[i]; return NaN; }
  function izOf(A) { return Object.prototype.hasOwnProperty.call(IZ, A) ? IZ[A] : NaN; }
  const WX_C = { klar: 0, heiter: 0.25, wolkig: 0.625, bedeckt: 1 };
  function kappaOf(inp) {
    let k = num(inp.kappa, NaN);
    if (!isFinite(k)) { const r = num(inp.rho, NaN); k = isFinite(r) && r > 0 ? 1 / r : NORM_KAPPA; }
    if (k > 0 && k < 1) k = 1 / k; /* ρ in Ω·mm²/m (0,0178 oder 0,0172) statt κ */
    return k;
  }
  function cableOf(inp) {
    if (!isObj(inp)) return fail('Die Eingabe für die Leitung fehlt.');
    const I = Math.abs(num(oget(inp, 'I', 'strom'), NaN)), L = num(oget(inp, 'L', 'laenge'), NaN), U = num(oget(inp, 'Usys', 'U'), NaN);
    let fall = num(oget(inp, 'spannungsfall', 'dUfrac'), 0.02);
    const dUabs = num(inp.dU, NaN), kappa = kappaOf(inp);
    if (!(I > 0)) return fail('Der Strom muss größer als 0 A sein.');
    if (!(L > 0)) return fail('Die einfache Leitungslänge muss größer als 0 m sein.');
    if (!(U > 0)) return fail('Die Spannung muss größer als 0 V sein.');
    if (!(kappa > 20 && kappa < 80)) return fail('Die Leitfähigkeit κ liegt bei Kupfer zwischen 56 und 58 m/(Ω·mm²).');
    if (!(fall > 0 && fall <= 0.2)) return fail('Der Spannungsfall muss zwischen 0,1 und 20 % liegen.');
    const dU = isFinite(dUabs) && dUabs > 0 ? dUabs : fall * U;
    const aMin = 2 * L * I / (kappa * dU);
    const L_ = listsOf();
    const given = num(inp.A, NaN);
    const aNorm = isFinite(given) && given > 0 ? given : upL(L_.querschnitte, aMin);
    const o = { ok: true, I: I, L: L, U: U, kappa: kappa, dUmax: dU, aMin: aMin, aNorm: aNorm, steps: [], checks: [] };
    o.steps.push('ΔU_max = ' + fm(100 * dU / U, 1) + ' % von ' + fm(U, 1) + ' V = ' + fm(dU, 2) + ' V');
    o.steps.push('A_min = 2 · L · I / (κ · ΔU) = 2 · ' + fm(L, 1) + ' m · ' + fm(I, 1) + ' A / (' + fm(kappa, 1) + ' m/(Ω·mm²) · ' + fm(dU, 2) + ' V) = ' + fm(aMin, 2) + ' mm²');
    if (isFinite(aNorm)) {
      const R = 2 * L / (kappa * aNorm);
      o.dU = I * R; o.dUpct = o.dU / U; o.pV = I * I * R; o.iz = izOf(aNorm);
      o.steps.push('Normquerschnitt (aufgerundet): ' + fm(aNorm, 2) + ' mm²');
      o.steps.push('Verlustleistung P_V = I² · 2 · L / (κ · A) = ' + fm(o.pV, 2) + ' W, Spannungsfall ' + fm(o.dU, 2) + ' V (' + fm(100 * o.dUpct, 1) + ' %)');
      o.checks.push({ id: 'kabel-spannungsfall', ok: o.dUpct <= (isFinite(dUabs) ? dUabs / U : fall) + 1e-9, text: 'Spannungsfall ' + fm(100 * o.dUpct, 1) + ' % (erlaubt ' + fm(100 * dU / U, 1) + ' %).' });
      if (isFinite(o.iz)) o.checks.push({ id: 'kabel-ueberlast', ok: I <= o.iz, text: 'Die Leitung führt ' + fm(I, 1) + ' A, erlaubt sind ' + fm(o.iz, 0) + ' A.' });
      o.ueberlast = isFinite(o.iz) && I > o.iz;
    } else { o.why = 'Größer als der größte Normquerschnitt (95 mm²): Länge verkürzen, Strom senken oder die Systemspannung erhöhen.'; o.checks.push({ id: 'kabel-gross', ok: false, text: o.why }); }
    return o;
  }
  function fuseOf(inp) {
    if (!isObj(inp)) return fail('Die Eingabe für die Sicherung fehlt.');
    let Ib = num(oget(inp, 'Ib', 'I'), NaN);
    if (!isFinite(Ib)) Ib = num(inp.strom, NaN);
    if (inp.kind === 'pv' && isFinite(num(inp.Isc, NaN))) Ib = 1.56 * num(inp.Isc, NaN);
    if (!(Ib > 0)) return fail('Der Betriebsstrom der Sicherung muss größer als 0 A sein.');
    let A = num(oget(inp, 'A', 'aNorm'), NaN);
    let Iz = num(inp.Iz, NaN);
    if (!isFinite(Iz)) Iz = izOf(A);
    if (!isFinite(Iz)) return fail('Für die Sicherung braucht es den Querschnitt der Leitung (Normwert, zum Beispiel 4 oder 6 mm²) oder ihre Belastbarkeit Iz.');
    const L_ = listsOf(), InMin = upL(L_.sicherungen, Ib);
    const o = { ok: true, Ib: Ib, Iz: Iz, A: A };
    if (!isFinite(InMin) || InMin > Iz + 1e-9) {
      let next = NaN;
      for (let i = 0; i < L_.querschnitte.length; i++) if (isFinite(izOf(L_.querschnitte[i])) && izOf(L_.querschnitte[i]) >= InMin && L_.querschnitte[i] > (isFinite(A) ? A : 0)) { next = L_.querschnitte[i]; break; }
      o.ok = false; o.In = NaN; o.aNext = next;
      o.why = 'Keine Sicherung aus der Reihe passt: Der Betriebsstrom ' + fm(Ib, 1) + ' A verlangt mindestens ' + (isFinite(InMin) ? fm(InMin, 0) + ' A' : 'eine größere Sicherung') + ', die Leitung erlaubt aber nur ' + fm(Iz, 0) + ' A. Querschnitt vergrößern' + (isFinite(next) ? ' (zum Beispiel ' + fm(next, 1) + ' mm²).' : '.');
      o.text = o.why;
      return o;
    }
    o.In = InMin;
    o.text = 'Betriebsstrom ' + fm(Ib, 1) + ' A ≤ Nennstrom ' + fm(InMin, 0) + ' A ≤ Belastbarkeit der Leitung ' + fm(Iz, 0) + ' A.';
    return o;
  }
  function stringCheckOf(inp) {
    if (!isObj(inp)) return fail('Die Eingabe für die Strangprüfung fehlt.');
    if (!C.pv || !C.pv.keys) return fail(TXT.keinKern);
    const sp = C.pv.spec(inp.spec === undefined ? 'si60' : inp.spec);
    if (!sp || sp.ok === false) return fail(sp && sp.why ? sp.why : 'Die Modul-Spezifikation ist ungültig.');
    const ns = Math.round(num(inp.ns, NaN)), np = Math.round(num(inp.np, 1));
    if (!(ns >= 1 && ns <= 100) || !(np >= 1 && np <= 100)) return fail('Module in Reihe und Stränge parallel müssen ganze Zahlen ab 1 sein.');
    const tmin = num(inp.TminC, -10), tmax = num(inp.TmaxC, 60);
    if (!(tmax > tmin)) return fail('Die höchste Temperatur muss über der tiefsten liegen.');
    const uMax = num(inp.UdcMax, NaN), mMin = num(inp.mppMin, NaN), mMax = num(inp.mppMax, NaN), iMax = num(inp.IdcMax, NaN);
    const kc = C.pv.keys(sp, { G: 1000, Tc: tmin }), kh = C.pv.keys(sp, { G: 1000, Tc: tmax }), ks = C.pv.keys(sp, { G: 1000, Tc: 25 });
    if (!kc || kc.ok === false || !kh || kh.ok === false || !ks || ks.ok === false) return fail('Mit diesen Werten lässt sich der Strang nicht prüfen.');
    const o = { ok: true, ns: ns, np: np, UocKalt: ns * kc.Uoc, UmppHeiss: ns * kh.Umpp, UmppKalt: ns * kc.Umpp, IscSumme: np * ks.Isc, UocModulKalt: kc.Uoc, UmppModulHeiss: kh.Umpp, checks: [] };
    o.nMax = isFinite(uMax) ? Math.floor(uMax / kc.Uoc + 1e-9) : NaN; o.nMin = isFinite(mMin) ? Math.ceil(mMin / kh.Umpp - 1e-9) : NaN;
    if (isFinite(uMax)) { const ok = o.UocKalt <= uMax; o.checks.push({ id: 'uoc-max', ok: ok, text: 'Leerlaufspannung bei ' + fm(tmin, 0) + ' °C: ' + fm(o.UocKalt, 1) + ' V; Grenze des Geräts: ' + fm(uMax, 0) + ' V. ' + (ok ? 'In Ordnung.' : 'Zu hoch: Das Gerät kann zerstört werden. Weniger Module in Reihe (höchstens ' + fm(o.nMax, 0) + ').') }); }
    if (isFinite(mMin)) { const ok = o.UmppHeiss >= mMin; o.checks.push({ id: 'mpp-min', ok: ok, text: 'MPP-Spannung bei ' + fm(tmax, 0) + ' °C: ' + fm(o.UmppHeiss, 1) + ' V; unterste Grenze: ' + fm(mMin, 0) + ' V. ' + (ok ? 'In Ordnung.' : 'Zu niedrig: Mehr Module in Reihe (mindestens ' + fm(o.nMin, 0) + ').') }); }
    if (isFinite(mMax)) { const ok = o.UmppKalt <= mMax; o.checks.push({ id: 'mpp-max', ok: ok, text: 'MPP-Spannung bei ' + fm(tmin, 0) + ' °C: ' + fm(o.UmppKalt, 1) + ' V; oberste Grenze des MPP-Fensters: ' + fm(mMax, 0) + ' V. ' + (ok ? 'In Ordnung.' : 'Zu hoch: Der Wechselrichter arbeitet außerhalb seines Fensters. Weniger Module in Reihe.') }); }
    if (isFinite(iMax)) { const ok = o.IscSumme <= iMax; o.checks.push({ id: 'isc-max', ok: ok, text: 'Kurzschlussstrom aller Stränge: ' + fm(o.IscSumme, 1) + ' A; Grenze des Eingangs: ' + fm(iMax, 1) + ' A. ' + (ok ? 'In Ordnung.' : 'Zu hoch: Weniger Stränge parallel.') }); }
    return o;
  }
  function autoDesign(inp) {
    if (!isObj(inp)) return fail('Die Eingabe für die Auslegung fehlt.');
    if (!C.pv || !C.sun) return fail(TXT.keinKern);
    const ge = inp.geraete;
    if (!isArr(ge) || !ge.length) return fail('Trage mindestens ein Gerät ein.');
    const dev = [];
    for (let i = 0; i < ge.length; i++) {
      const g = ge[i], P = num(isObj(g) ? g.P : NaN, NaN), t = num(isObj(g) ? g.stunden : NaN, NaN);
      if (!(P > 0) || !(t >= 0 && t <= 24)) return fail('Gerät ' + (i + 1) + ': Leistung (größer 0 W) und Stunden je Tag (0 bis 24) müssen Zahlen sein.');
      dev.push({ name: String(g.name || 'Gerät'), P: P, t: t, typ: g.typ === 'ac' ? 'ac' : 'dc', cos: clamp(num(g.cosphi, 1), 0.3, 1), anlauf: Math.max(1, num(g.anlauf, 1)) });
    }
    const Usys = num(inp.Usys, 12);
    if (USYS.indexOf(Usys) < 0) return fail('Die Systemspannung muss 12, 24 oder 48 V sein.');
    const tage = num(inp.tage, 2);
    if (!(tage >= 0.5 && tage <= 14)) return fail('Die Autonomie liegt zwischen 0,5 und 14 Tagen.');
    const tag = Math.round(num(inp.tag, 355));
    if (!(tag >= 1 && tag <= 365)) return fail('Der Auslegungstag liegt zwischen 1 und 365.');
    let cW = typeof inp.wetter === 'string' ? WX_C[inp.wetter] : (inp.wetter === undefined || inp.wetter === null ? 0.625 : num(inp.wetter, NaN));
    if (!(cW >= 0 && cW <= 1)) return fail('Die Wetterlage muss klar, heiter, wolkig, bedeckt oder eine Bewölkung von 0 bis 1 sein.');
    const site = C.sun.site(inp.ort === undefined ? 'mitte' : inp.ort);
    if (!site) return fail('Unbekannter Standort.');
    const chem = inp.chem === 'lifepo4' ? 'lifepo4' : (inp.chem === undefined || inp.chem === 'blei' ? 'blei' : null);
    if (!chem) return fail('Die Zellchemie muss „blei“ oder „lifepo4“ sein.');
    const bd = battDefaults(chem, Usys);
    const dod = inp.dod === null || inp.dod === undefined ? bd.dodMax : num(inp.dod, NaN);
    if (!(dod > 0 && dod <= 1)) return fail('Die Entladetiefe muss zwischen 0 und 1 liegen.');
    const PR = inp.PR === undefined ? 0.65 : num(inp.PR, NaN);
    if (!(PR > 0 && PR <= 1)) return fail('Die Performance Ratio muss zwischen 0 und 1 liegen.');
    const sp = C.pv.spec(inp.modul === undefined ? 'si60' : inp.modul);
    if (!sp || sp.ok === false) return fail(sp && sp.why ? sp.why : 'Die Modul-Spezifikation ist ungültig.');
    const lg = isObj(inp.laenge) ? inp.laenge : {};
    const Lpv = num(lg.pv, 5), Lak = num(lg.akku, 1), Lwr = num(lg.wr, 1);
    if (!(Lpv > 0 && Lak > 0 && Lwr > 0)) return fail('Die drei Leitungslängen müssen größer als 0 m sein.');
    const fall = inp.spannungsfall === undefined ? 0.02 : num(inp.spannungsfall, NaN);
    if (!(fall > 0 && fall <= 0.2)) return fail('Der Spannungsfall muss zwischen 0,1 und 20 % liegen.');
    const spar = !!inp.wrSparmodus;
    const reglerWunsch = inp.regler === 'pwm' ? 'pwm' : (inp.regler === 'mppt' ? 'mppt' : (sp.Ns <= 40 ? 'pwm' : 'mppt'));
    const L_ = listsOf(), steps = [], checks = [], inv = INV_MODELS.insel;
    const kSTC = C.pv.keys(sp, { G: 1000, Tc: 25 });
    const beta = inp.neigung === null || inp.neigung === undefined ? C.sun.bestTilt(tag, site.lat, num(inp.azimut, 0), cW) : clamp(num(inp.neigung, 35), 0, 90);
    const gam = num(inp.azimut, 0);
    /* 1. Tagesenergie */
    let eDc = 0, eAc = 0, sPeak = 0, pAcSum = 0, tB = 0, surge = 0, pAll = 0;
    dev.forEach(function (d) {
      pAll += d.P;
      if (d.typ === 'ac') { eAc += d.P * d.t; sPeak += d.P / d.cos; pAcSum += d.P; tB = Math.max(tB, d.t); } else eDc += d.P * d.t;
    });
    let maxExtra = 0; dev.forEach(function (d) { if (d.typ === 'ac') maxExtra = Math.max(maxExtra, d.P * (d.anlauf - 1)); });
    surge = pAcSum + maxExtra;
    let Sn = 0, e0 = 0, etaWr = 1;
    const hasAc = eAc > 0;
    if (hasAc) {
      Sn = upL(L_.wr, 1.25 * sPeak);
      if (!isFinite(Sn)) Sn = Math.ceil(1.25 * sPeak / 1000) * 1000;
      while (surge > 2 * Sn + 1e-9) { const nx = upL(L_.wr, Sn * 1.0001 + 1); if (!isFinite(nx)) break; Sn = nx; }
      const tb = Math.max(tB, 1);
      e0 = spar ? 1.5 * 24 : inv.a * Sn * (24 - tb);
      etaWr = invEta('insel', clamp(eAc / tb / Sn, 0.05, 1));
    }
    const eD = eDc + eAc + e0;
    const eBat = eDc + (eAc + e0) / etaWr;
    steps.push('1. Tagesenergie: E_d = Σ P · t = ' + fm(eDc + eAc, 0) + ' Wh' + (hasAc ? ' + Wechselrichter-Eigenverbrauch ' + fm(e0, 0) + ' Wh = ' + fm(eD, 0) + ' Wh' : ''));
    /* 2. Sonnenstunden */
    const kWh = C.sun.dayEnergy({ N: tag, lat: site.lat, beta: beta, gam: gam, c: cW });
    const psh = kWh / 1;
    steps.push('2. Sonnenstunden am Tag ' + tag + ': PSH = ' + fm(kWh, 2) + ' kWh/m² / 1 kWh/m² = ' + fm(psh, 2) + ' h (Neigung ' + fm(beta, 0) + '°, Bewölkung ' + fm(cW, 2) + ')');
    if (!(psh > 0)) return fail('Am Auslegungstag liefert die Sonne an diesem Standort nichts (Polarnacht). Wähle einen anderen Tag oder Standort.');
    /* 3. Modulleistung und Strangbildung */
    const pPv = eD / (psh * PR), nMod = Math.max(1, Math.ceil(pPv / kSTC.Pmpp - 1e-9));
    steps.push('3. Modulleistung: P_pv = E_d / (PSH · PR) = ' + fm(eD, 0) + ' Wh / (' + fm(psh, 2) + ' h · ' + fm(PR, 2) + ') = ' + fm(pPv, 0) + ' W; Module: ' + fm(pPv, 0) + ' W / ' + fm(kSTC.Pmpp, 0) + ' W = ' + fm(pPv / kSTC.Pmpp, 2) + ' → ' + nMod);
    const kHot = C.pv.keys(sp, { G: 1000, Tc: 60 }), kCold = C.pv.keys(sp, { G: 1000, Tc: -15 });
    let ns = 1, uocMax = 50, regler = reglerWunsch;
    if (regler === 'pwm') {
      ns = Math.max(1, Math.round(Usys / 12));
      uocMax = 50;
      if (sp.Ns > 40) checks.push({ id: 'pwm-modul', ok: false, text: 'Ein Modul mit ' + sp.Ns + ' Zellen passt nicht zu einem PWM-Regler: Die Modulspannung wird auf die Akkuspannung gezwungen, ein großer Teil der Leistung geht verloren. Nimm ein 36-Zellen-Modul oder einen MPPT-Regler.' });
    } else {
      while (ns * kHot.Umpp < bd.uAbs + 5 - 1e-9 && ns < 40) ns++;
      const uocCold = ns * kCold.Uoc; uocMax = NaN;
      for (let i = 0; i < 3; i++) { const c = [50, 100, 150][i]; if (uocCold <= 0.9 * c + 1e-9) { uocMax = c; break; } }
    }
    const np = Math.max(1, Math.ceil(nMod / ns));
    const uocKalt = ns * kCold.Uoc;
    steps.push('   Strang: ' + (regler === 'mppt' ? 'Start des MPPT-Wandlers: ns · Umpp(60 °C) = ' + ns + ' · ' + fm(kHot.Umpp, 1) + ' V = ' + fm(ns * kHot.Umpp, 1) + ' V ≥ U_abs + 5 V = ' + fm(bd.uAbs + 5, 1) + ' V; ' : 'PWM-Regler: ns = ' + ns + '; ') + 'ns · Uoc(−15 °C) = ' + fm(uocKalt, 1) + ' V; Stränge parallel: np = ' + np);
    if (regler === 'mppt') checks.push({ id: 'uoc-max', ok: isFinite(uocMax), text: isFinite(uocMax) ? 'Leerlaufspannung bei −15 °C: ' + fm(uocKalt, 1) + ' V ≤ 0,9 · ' + fm(uocMax, 0) + ' V Eingang des Reglers. In Ordnung.' : 'Leerlaufspannung bei −15 °C: ' + fm(uocKalt, 1) + ' V. Das ist mehr als 0,9 · 150 V: Kein Regler der Reihe passt, weniger Module in Reihe oder ein Wechselrichter-Eingang mit höherer Spannung.' });
    else checks.push({ id: 'uoc-max', ok: uocKalt <= 0.9 * uocMax, text: 'Leerlaufspannung bei −15 °C: ' + fm(uocKalt, 1) + ' V' + (uocKalt <= 0.9 * uocMax ? ' ≤ ' : ' > ') + '0,9 · ' + fm(uocMax, 0) + ' V Eingang des Reglers.' });
    checks.push({ id: 'mppt-start', ok: regler !== 'mppt' || ns * kHot.Umpp >= bd.uAbs + 5 - 1e-9, text: 'Startbedingung des MPPT-Wandlers: Umpp des Strangs bei 60 °C = ' + fm(ns * kHot.Umpp, 1) + ' V, nötig sind U_abs + 5 V = ' + fm(bd.uAbs + 5, 1) + ' V.' });
    /* 4. Akku */
    const cRaw = eBat * tage / (Usys * dod), cAh = upL(L_.akku, cRaw);
    steps.push('4. Akku: C = (E / η_WR) · Tage / (Usys · DoD) = ' + fm(eBat, 0) + ' Wh · ' + fm(tage, 1) + ' / (' + Usys + ' V · ' + fm(dod, 2) + ') = ' + fm(cRaw, 0) + ' Ah → Normwert ' + (isFinite(cAh) ? fm(cAh, 0) + ' Ah' : 'über 600 Ah'));
    if (!isFinite(cAh)) checks.push({ id: 'akku-gross', ok: false, text: 'Der Akku wäre größer als 600 Ah: Mehrere Akkus parallel oder eine höhere Systemspannung nehmen.' });
    /* 5. Laderegler */
    const iReg = 1.25 * np * kSTC.Isc, reglerA = upL(L_.regler, iReg);
    steps.push('5. Laderegler: I = 1,25 · np · Isc = 1,25 · ' + np + ' · ' + fm(kSTC.Isc, 2) + ' A = ' + fm(iReg, 1) + ' A → ' + (isFinite(reglerA) ? fm(reglerA, 0) + ' A' : 'über 60 A'));
    checks.push({ id: 'regler-strom', ok: isFinite(reglerA), text: isFinite(reglerA) ? 'Ein Regler für ' + fm(reglerA, 0) + ' A genügt.' : 'Kein Regler bis 60 A: Mehrere Regler einsetzen oder weniger Stränge parallel.' });
    /* 6. Wechselrichter */
    if (hasAc) {
      steps.push('6. Wechselrichter: Sn ≥ 1,25 · S_Spitze = 1,25 · ' + fm(sPeak, 0) + ' VA = ' + fm(1.25 * sPeak, 0) + ' VA → ' + fm(Sn, 0) + ' VA; Anlaufspitze ' + fm(surge, 0) + ' W ≤ 2 · Sn = ' + fm(2 * Sn, 0) + ' W');
      checks.push({ id: 'wr-anlauf', ok: surge <= 2 * Sn + 1e-9, text: 'Anlaufspitze ' + fm(surge, 0) + ' W; der Wechselrichter liefert kurz ' + fm(2 * Sn, 0) + ' W.' });
    } else steps.push('6. Wechselrichter: Alle Geräte laufen mit Gleichstrom, es wird keiner gebraucht.');
    /* 7. Kabel */
    const impp = kSTC.Impp, uPvSys = regler === 'mppt' ? ns * kSTC.Umpp : Usys;
    const iPvC = np * impp, pInst = ns * np * kSTC.Pmpp;
    const iCharge = Math.min(pInst / Usys, isFinite(reglerA) ? reglerA : 60);
    const etaPeak = hasAc ? invEta('insel', clamp(sPeak / Sn, 0.05, 1)) : 1;
    const iWr = (pAll / etaPeak) / bd.uLvd, iAk = Math.max(iCharge, iWr);
    const cabs = {};
    function cab(id, I, L, U) { const r = cableOf({ I: I, L: L, Usys: U, spannungsfall: fall }); cabs[id] = r; return r; }
    cab('pv', iPvC, Lpv, uPvSys); cab('akku', iAk, Lak, Usys); cab('wr', iWr, Lwr, Usys);
    ['pv', 'akku', 'wr'].forEach(function (k) { const r = cabs[k]; if (r.ok === false) return; steps.push('7. Kabel ' + { pv: 'Modul–Regler', akku: 'Regler–Akku', wr: 'Akku–Last' }[k] + ': I = ' + fm(r.I, 1) + ' A, L = ' + fm(r.L, 0) + ' m, ΔU = ' + fm(100 * fall, 1) + ' % von ' + fm(r.U, 1) + ' V → A_min = ' + fm(r.aMin, 2) + ' mm² → ' + (isFinite(r.aNorm) ? fm(r.aNorm, 1) + ' mm²' : 'über 95 mm²')); });
    /* 8. Sicherungen (Gleichstromseite), Querschnitt wird vergroessert, wenn keine Sicherung passt */
    const fuses = {};
    const ibs = { pv: 1.56 * kSTC.Isc, akku: iAk, wr: iWr };
    ['pv', 'akku', 'wr'].forEach(function (k) {
      let r = cabs[k];
      if (r.ok === false || !isFinite(r.aNorm)) return;
      let f = fuseOf({ Ib: ibs[k], A: r.aNorm });
      let guard = 0;
      while (f.ok === false && isFinite(f.aNext) && guard++ < 8) {
        steps.push('8. Sicherung ' + k + ': Keine Sicherung passt zu ' + fm(r.aNorm, 1) + ' mm², Querschnitt vergrößert auf ' + fm(f.aNext, 1) + ' mm².');
        r = Object.assign({}, r, { aNorm: f.aNext, iz: izOf(f.aNext) }); cabs[k] = r; f = fuseOf({ Ib: ibs[k], A: f.aNext });
      }
      fuses[k] = f;
      steps.push('8. Sicherung ' + { pv: 'Strang', akku: 'Akku', wr: 'Last' }[k] + ': I_b = ' + fm(ibs[k], 1) + ' A' + (f.ok ? ' → ' + fm(f.In, 0) + ' A (Leitung erlaubt ' + fm(f.Iz, 0) + ' A)' : ': ' + f.why));
    });
    ['pv', 'akku', 'wr'].forEach(function (k) {
      const r = cabs[k]; if (!r || r.ok === false) return;
      const nm = { pv: 'Leitung Modul–Regler', akku: 'Leitung Regler–Akku', wr: 'Leitung Akku–Last' }[k];
      const q = isFinite(r.aNorm) ? cableOf({ I: r.I, L: r.L, Usys: r.U, spannungsfall: fall, A: r.aNorm }) : r;
      checks.push({ id: 'kabel-' + k, ok: isFinite(r.aNorm) && q.checks && q.checks.every(function (c) { return c.ok; }), text: nm + ': ' + (isFinite(r.aNorm) ? fm(r.aNorm, 1) + ' mm², Spannungsfall ' + fm(100 * q.dUpct, 1) + ' %, Verlust ' + fm(q.pV, 1) + ' W.' : 'kein Normquerschnitt reicht.') });
      const f = fuses[k]; if (f) checks.push({ id: 'sicherung-' + k, ok: f.ok !== false, text: f.ok !== false ? 'Sicherung ' + fm(f.In, 0) + ' A passt zu ' + fm(r.aNorm, 1) + ' mm².' : f.why });
    });
    const out = {
      ok: true, steps: steps, tagesWh: eD, eBatWh: eBat, etaWr: etaWr, psh: psh, pPv: pPv, nModule: nMod, nInstalliert: ns * np, pInstalliert: pInst, strang: { ns: ns, np: np }, reglerTyp: regler, uocMax: uocMax, neigung: beta, azimut: gam, wetterC: cW,
      akkuAh: cAh, akkuKWh: isFinite(cAh) ? cAh * Usys / 1000 : NaN, akkuAhRoh: cRaw, dod: dod, chem: chem, reglerA: reglerA, wrVA: Sn, wrSparmodus: spar,
      kabel: { pv: cabs.pv.aNorm, akku: cabs.akku.aNorm, wr: cabs.wr.aNorm }, sicherung: { pv: fuses.pv ? fuses.pv.In : NaN, akku: fuses.akku ? fuses.akku.In : NaN, wr: fuses.wr ? fuses.wr.In : NaN },
      strom: { pv: iPvC, akku: iAk, wr: iWr }, checks: checks, lat: site.lat, tag: tag, Usys: Usys
    };
    return out;
  }
  function verifyOf(inp, res, opts) {
    opts = isObj(opts) ? opts : {};
    if (!isObj(inp)) return fail('Die Eingabe für die Prüfung fehlt.');
    if (!isObj(res) || res.ok === false) return fail('Zuerst muss die Auslegung ein Ergebnis haben.');
    if (!(res.akkuAh > 0)) return fail('Die Auslegung hat keinen gültigen Akku.');
    const tage = num(inp.tage, 2), tag = res.tag || Math.round(num(inp.tag, 355));
    const nBad = Math.max(3, Math.ceil(tage));
    const hasAc = res.wrVA > 0;
    const geraete = inp.geraete.map(function (g) { return Object.assign({}, g, { typ: hasAc ? 'ac' : 'dc' }); });
    const cfg = {
      typ: 'insel', ort: inp.ort === undefined ? 'mitte' : inp.ort, N: tag, tS: 0, tage: nBad + 2, neigung: res.neigung, azimut: res.azimut, wetter: { c: 1, preset: 'bedeckt', seed: 1, zug: false },
      feld: { spec: inp.modul === undefined ? 'si60' : inp.modul, ns: res.strang.ns, np: res.strang.np },
      regler: { typ: res.reglerTyp, Imax: isFinite(res.reglerA) ? res.reglerA : 60, Uocmax: res.uocMax, tempComp: res.chem === 'blei', lvd: true },
      leitung: { pv: { l: num(isObj(inp.laenge) ? inp.laenge.pv : 5, 5), q: res.kabel.pv }, bat: { l: num(isObj(inp.laenge) ? inp.laenge.akku : 1, 1), q: res.kabel.akku } },
      akku: { chem: res.chem, Usys: res.Usys, C: res.akkuAh, soc0: 1, T: 25 }, wr: hasAc ? { modell: 'insel', Sn: res.wrVA, sparmodus: !!res.wrSparmodus } : null,
      last: { profil: { devices: null }, geraete: geraete }, h: clamp(num(opts.h, 120), 30, 300)
    };
    delete cfg.last.profil;
    const sim = sysCreate(cfg);
    if (!sim || sim.ok === false) return fail(sim && sim.why ? sim.why : 'Die Prüfung lässt sich nicht aufbauen.');
    const h = cfg.h, per = Math.max(1, Math.round(1800 / h)), soc = [], tt = [];
    let socMin = 1, tLvd = 0, tFirst = null, lvdPrev = false, n = 0, socStartLast = 1, socTage = 1;
    const nSteps = Math.round(nBad * 86400 / h);
    for (let i = 0; i < nSteps; i++) {
      const r = sim.step(h); if (!r || r.ok === false) return fail((r && r.why) || 'Die Prüfung ist abgebrochen.');
      const s = sim.state(); n++;
      if (s.soc < socMin) socMin = s.soc;
      if ((i + 1) * h <= tage * 86400 + 1e-6 && s.soc < socTage) socTage = s.soc;
      if (s.lvdAktiv) { tLvd += h / 3600; if (!lvdPrev && tFirst === null) tFirst = (i + 1) * h / 3600; }
      lvdPrev = !!s.lvdAktiv;
      if (n % per === 0) { soc.push(s.soc); tt.push((i + 1) * h / 3600); }
    }
    socStartLast = sim.state().soc;
    const tLvdBad = tLvd;
    sim.update({ wetter: { c: cW0(res), preset: 'frei', seed: 1, zug: false } });
    const nDay = Math.round(86400 / h);
    for (let i = 0; i < nDay; i++) {
      const r = sim.step(h); if (!r || r.ok === false) break;
      const s = sim.state(); n++;
      if (s.lvdAktiv) tLvd += h / 3600;
      if (n % per === 0) { soc.push(s.soc); tt.push((nSteps + i + 1) * h / 3600); }
    }
    const socEnd = sim.state().soc, hrs = nBad * 24;
    const lvdOk = tFirst === null || tFirst > tage * 24;
    const bilanzOk = socEnd >= socStartLast - 0.001;
    const dodPlan = clamp(num(res.dod, 0.5), 0.05, 1), dodOk = socTage >= 1 - dodPlan - 0.01;
    const voll = socEnd >= 0.95;
    const tageUeb = tFirst === null ? nBad : Math.min(nBad, Math.floor(tFirst / 24));
    const checks = [
      { id: 'lvd', ok: lvdOk, text: lvdOk ? 'Der Tiefentladeschutz hat in den ' + fm(tage, 1) + ' Autonomietagen nicht getrennt (kleinster Ladezustand ' + fm(100 * socMin, 0) + ' %).' : 'Der Tiefentladeschutz hat nach ' + fm(tFirst, 1) + ' h getrennt: Der Akku war nach ' + fm(tFirst / 24, 1) + ' Tagen leer, geplant waren ' + fm(tage, 1) + ' Tage.' },
      { id: 'dod', ok: dodOk, text: dodOk ? 'Nach ' + fm(tage, 1) + ' Tagen ohne Sonne liegt der Ladezustand bei ' + fm(100 * socTage, 0) + ' %, die geplante Entladetiefe von ' + fm(100 * dodPlan, 0) + ' % (Ladezustand ' + fm(100 * (1 - dodPlan), 0) + ' %) wird eingehalten.' : 'Nach ' + fm(tage, 1) + ' Tagen ohne Sonne liegt der Ladezustand bei ' + fm(100 * socTage, 0) + ' %. Geplant war eine Entladetiefe von höchstens ' + fm(100 * dodPlan, 0) + ' % (Ladezustand ab ' + fm(100 * (1 - dodPlan), 0) + ' %): Der Akku ist zu klein für ' + fm(tage, 1) + ' Tage.' },
      { id: 'bilanz', ok: bilanzOk, text: bilanzOk ? 'Am ersten Sonnentag danach lädt der Akku mehr, als er abgibt (Ladezustand von ' + fm(100 * socStartLast, 0) + ' auf ' + fm(100 * socEnd, 0) + ' %).' : 'Am ersten Sonnentag danach lädt der Akku nicht mehr nach (Ladezustand ' + fm(100 * socStartLast, 0) + ' % auf ' + fm(100 * socEnd, 0) + ' %): Die Module sind zu klein für den Verbrauch.' },
      { id: 'voll', ok: voll, hinweis: true, text: voll ? 'Der Akku ist am Ende des Sonnentags wieder voll (' + fm(100 * socEnd, 0) + ' %).' : 'Hinweis: Der Akku wird an diesem einen Sonnentag nicht wieder voll (' + fm(100 * socEnd, 0) + ' %). Mehrere Sonnentage nacheinander sind nötig.' }
    ];
    void hrs;
    return { ok: lvdOk && dodOk && bilanzOk, socMin: socMin, socMinTage: socTage, tLvd: tLvdBad, tLvdAt: tFirst, tLvdGesamt: tLvd, tageUeberlebt: tageUeb, tageGeprueft: nBad, socEnde: socEnd, voll: voll, checks: checks, soc: soc, t: tt };
  }
  function cW0(res) { return clamp(num(res.wetterC, 0.625), 0, 1); }
  const design = {
    autoDesign: S_(autoDesign), verify: S_(verifyOf), cable: S_(cableOf), fuse: S_(fuseOf), stringCheck: S_(stringCheckOf)
  };
  Object.defineProperty(design, 'lists', { enumerable: true, get: listsOf });

  /* =====================================================================================================
   *  DIAGNOSE  SPEC 4.15
   *  ctx (alle Felder optional, fehlende Felder erzeugen nie eine Meldung): G; polar; shadeActive, lossW, lossPct, subsHit; bypassOn (Zahl ueberbrueckter Zellen); bypass ('ok'|'fehlt'|'kurz');
   *  hotP, hotPNoBypass; peaks[], trackStuck, pTrack, pGlobal; iRev, iRevMax; uocHot, uocLimit; ctrlType, stage (0..3), stagePrev, pOp, pMpp, uOp, uMpp, ub; curtailW, curtailKind ('imax'|'wr'|'regler'), imax, pUsed;
   *  ctrlDead, deadUoc, deadLimit; uBat, uGas, gasMin; soc, uLvd, lvdOn, loadW; bms; lvdEvent ('aus'|'wieder'); akkuLeerNacht {eAkku, eNacht}; cable {dU, uPct (Anteil), pV, I, Iz};
   *  wrS, wrSn, wrOverS; wrOn, wrStandbyW; clipW, wrPn, pPot, eLost; fenster {u, min, max}; wrDeadUoc, wrUdcMax; netzOk; speicherSoc, pEinsp.
   * ===================================================================================================== */
  function diagnoseOf(ctx) {
    const out = [];
    if (!isObj(ctx)) return out;
    const fin_ = function (v) { return typeof v === 'number' && isFinite(v); };
    const add = function (id, kind, vars, fx) { const d = { id: id, kind: kind || KIND[id] || 'info', text: evText(id, vars) }; if (fx) d.fx = fx; out.push(d); };
    const lim = C.pv && C.pv.hotspotLimits ? C.pv.hotspotLimits : { warn: 25, error: 100 };
    if (fin_(ctx.G) && ctx.G < 1) add('nacht', 'info', {});
    if (ctx.polar === 'nacht') add('polarnacht', 'info', {});
    if (ctx.shadeActive && fin_(ctx.lossPct) && ctx.lossPct >= 5 && fin_(ctx.lossW)) {
      const n = fin_(ctx.subsHit) ? ctx.subsHit : NaN;
      add('pv-schatten', 'warn', { w: fm(ctx.lossW, 0), pct: fm(ctx.lossPct, 0), betroffen: isFinite(n) ? (n === 1 ? 'Ein Teilstrang ist betroffen' : fm(n, 0) + ' Teilstränge sind betroffen') : 'Teilstränge sind betroffen' });
    }
    if (fin_(ctx.bypassOn) && ctx.bypassOn > 0) add('bypass-an', 'info', { wer: 'Eine Bypassdiode', verb: 'leitet und überbrückt', n: fm(ctx.bypassOn, 0) });
    if (ctx.bypass && ctx.bypass !== 'ok' && fin_(ctx.hotP) && ctx.hotP >= lim.warn) add('bypass-fehlt', 'warn', { p: fm(ctx.hotP, 0) });
    if (fin_(ctx.hotP) && ctx.hotP >= lim.warn) {
      if (ctx.hotP >= lim.error) add('hotspot-gefahr', 'error', { x: fm(ctx.hotP, 0) }, 'overheat');
      else { const d = { id: 'hotspot', kind: 'warn', text: evText('hotspot', { p: fm(ctx.hotP, 0) }) + (fin_(ctx.hotPNoBypass) && ctx.hotPNoBypass > ctx.hotP ? evText('hotspot-vergleich', { p0: fm(ctx.hotPNoBypass, 0) }) : '') }; out.push(d); }
    }
    if (isArr(ctx.peaks) && ctx.peaks.length >= 2 && ctx.trackStuck && fin_(ctx.pTrack) && fin_(ctx.pGlobal) && ctx.pGlobal > ctx.pTrack) add('lokal-mpp', 'warn', { x: fm(ctx.pTrack, 0), y: fm(ctx.pGlobal, 0) });
    if (fin_(ctx.iRev) && fin_(ctx.iRevMax) && Math.abs(ctx.iRev) > ctx.iRevMax) add('rueckstrom', 'warn', { x: fm(Math.abs(ctx.iRev), 1), y: fm(ctx.iRevMax, 1) });
    if (fin_(ctx.uocHot) && fin_(ctx.uocLimit) && ctx.uocHot > ctx.uocLimit) add('uoc-hoch', 'warn', { x: fm(ctx.uocHot, 0), y: fm(ctx.uocLimit, 0), abhilfe: 'Ein Modul weniger in Reihe.' });
    if (ctx.ctrlType === 'pwm' && ctx.stage === 1 && fin_(ctx.pOp) && fin_(ctx.pMpp) && ctx.pMpp > 0 && ctx.pOp < 0.8 * ctx.pMpp && fin_(ctx.uOp) && fin_(ctx.uMpp)) add('pwm-verlust', 'warn', { x: fm(ctx.uOp, 1), y: fm(ctx.uMpp, 1), z: fm(ctx.pMpp - ctx.pOp, 0) });
    if (ctx.ctrlType === 'mppt' && fin_(ctx.uMpp) && fin_(ctx.ub) && ctx.uMpp < ctx.ub + 5 && ctx.uMpp > 0) add('mppt-start', 'warn', { x: fm(ctx.uMpp, 1) });
    if (fin_(ctx.curtailW) && ctx.curtailW > 0 && ctx.curtailKind === 'imax' && fin_(ctx.imax) && fin_(ctx.pMpp) && fin_(ctx.pUsed)) add('regler-strom', 'warn', { x: fm(ctx.imax, 0), y: fm(ctx.pMpp, 0), z: fm(ctx.pUsed, 0) });
    if (ctx.ctrlDead && fin_(ctx.deadUoc) && fin_(ctx.deadLimit)) add('regler-tot', 'error', { x: fm(ctx.deadUoc, 0), y: fm(ctx.deadLimit, 0) }, 'crash');
    if (fin_(ctx.stage) && ctx.stage >= 1 && fin_(ctx.stagePrev) && ctx.stage !== ctx.stagePrev && fin_(ctx.ub) && fin_(ctx.iBat)) add('ladeschluss', 'info', { stage: ['aus', 'Bulk', 'Absorption', 'Float'][ctx.stage], x: fm(ctx.ub, 2), y: fm(Math.abs(ctx.iBat), 1) });
    if (fin_(ctx.uBat) && fin_(ctx.uGas) && ctx.uBat > ctx.uGas && fin_(ctx.gasMin) && ctx.gasMin > 10) add('ueberladung', 'error', { x: fm(ctx.uBat, 2) });
    if (ctx.bms) add('bms-aus', 'warn', {});
    if ((fin_(ctx.soc) && ctx.soc < 0.10) || (ctx.lvdOn === false && fin_(ctx.uBat) && fin_(ctx.uLvd) && ctx.uBat < ctx.uLvd && fin_(ctx.loadW) && ctx.loadW > 0)) add('tiefentladung', 'error', { x: fm(fin_(ctx.soc) ? ctx.soc * 100 : NaN, 0) });
    if (ctx.lvdEvent === 'aus' && fin_(ctx.uBat)) add('lvd-aus', 'warn', { x: fm(ctx.uBat, 2) });
    if (ctx.lvdEvent === 'wieder' && fin_(ctx.uBat)) add('lvd-wieder', 'info', { x: fm(ctx.uBat, 2) });
    if (isObj(ctx.akkuLeerNacht) && fin_(ctx.akkuLeerNacht.eAkku) && fin_(ctx.akkuLeerNacht.eNacht) && ctx.akkuLeerNacht.eAkku < ctx.akkuLeerNacht.eNacht) add('akku-leer-nacht', 'warn', { x: fm(ctx.akkuLeerNacht.eAkku, 0), y: fm(ctx.akkuLeerNacht.eNacht, 0) });
    if (isObj(ctx.cable)) {
      const c = ctx.cable;
      if (fin_(c.uPct) && c.uPct > 0.03 && fin_(c.dU) && fin_(c.pV)) add('kabel-spannungsfall', 'warn', { x: fm(c.dU, 2), y: fm(100 * c.uPct, 1), z: fm(c.pV, 1) });
      if (fin_(c.I) && fin_(c.Iz) && c.I > c.Iz) add('kabel-ueberlast', 'error', { x: fm(c.I, 1), y: fm(c.Iz, 0) });
    }
    if (fin_(ctx.wrS) && fin_(ctx.wrSn) && ctx.wrS > ctx.wrSn && fin_(ctx.wrOverS) && ctx.wrOverS > 5) add('wr-ueberlast', 'error', { x: fm(ctx.wrS, 0), y: fm(ctx.wrSn, 0) });
    if (ctx.wrOn && fin_(ctx.loadW) && ctx.loadW === 0 && fin_(ctx.wrStandbyW) && ctx.wrStandbyW > 0) add('wr-standby', 'info', { x: fm(ctx.wrStandbyW, 1), y: fm(ctx.wrStandbyW * 24, 0) });
    if (fin_(ctx.clipW) && ctx.clipW > 0 && fin_(ctx.wrPn) && fin_(ctx.pPot) && fin_(ctx.eLost)) add('wr-clipping', 'warn', { x: fm(ctx.wrPn, 0), y: fm(ctx.pPot, 0), z: fm(ctx.eLost, 0) });
    if (isObj(ctx.fenster) && fin_(ctx.fenster.u) && fin_(ctx.fenster.min) && fin_(ctx.fenster.max) && (ctx.fenster.u < ctx.fenster.min || ctx.fenster.u > ctx.fenster.max)) add('wr-fenster', 'warn', { x: fm(ctx.fenster.u, 0), y: fm(ctx.fenster.min, 0), z: fm(ctx.fenster.max, 0) });
    if (fin_(ctx.wrDeadUoc) && fin_(ctx.wrUdcMax) && ctx.wrDeadUoc > ctx.wrUdcMax) add('wr-zerstoert', 'error', { x: fm(ctx.wrDeadUoc, 0), y: fm(ctx.wrUdcMax, 0) }, 'crash');
    if (ctx.netzOk === false) add('netzausfall', 'warn', {});
    if (fin_(ctx.speicherSoc) && ctx.speicherSoc >= 0.99 && fin_(ctx.pEinsp) && ctx.pEinsp > 0) add('speicher-voll', 'info', { x: fm(ctx.pEinsp, 0) });
    return out;
  }

  /* =====================================================================================================
   *  LAEUFER ENR_CORE.runSeq  SPEC 4.16
   * ===================================================================================================== */
  function cloneJ(o) { try { return JSON.parse(JSON.stringify(o, function (k, v) { return typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? null : v); })); } catch (e) { return null; } }
  function runSeqImpl(rigIn, seq, tEndS, opts) {
    opts = isObj(opts) ? opts : {};
    const out = { ok: false, samples: [], final: null, events: [], faults: [], metrics: { keys: null, analyze: null, daily: [] }, errors: [], rejected: [] };
    const Tend = num(tEndS, NaN);
    if (!(Tend >= 0 && Tend <= 1e7)) { out.errors.push('Die Dauer des Ablaufs muss eine Zahl zwischen 0 und 10 000 000 s sein.'); return out; }
    let rig = null;
    try {
      if (typeof rigIn === 'function') rig = rigIn();
      else if (typeof rigIn === 'string') {
        const R = root.ENR_RIGS;
        if (!R || !R.defs || !R.defs[rigIn]) { out.errors.push('Den Prüfstand „' + rigIn.slice(0, 40) + '“ gibt es nicht.'); return out; }
        rig = R.create(rigIn, { seed: num(opts.seed, 1) });
      } else if (isObj(rigIn)) rig = rigIn;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden.'); return out; }
    if (!rig || typeof rig.stepProcess !== 'function' || typeof rig.setControl !== 'function' || typeof rig.state !== 'function') { out.errors.push('Der Prüfstand fehlt oder ist unvollständig.'); return out; }
    const known = function (k) {
      try { if (isArr(rig.controls)) return rig.controls.some(function (c) { return c && c.key === k; }); if (typeof rig.getControl === 'function') return rig.getControl(k) !== undefined; } catch (e) { return false; }
      return true;
    };
    const setAll = function (obj) {
      if (!isObj(obj)) return;
      Object.keys(obj).forEach(function (k) {
        let r; try { r = rig.setControl(k, obj[k]); } catch (e) { r = false; }
        if (r === false) { if (!known(k)) out.errors.push('Schlüssel „' + k + '“ gibt es an dieser Anlage nicht.'); else out.rejected.push({ key: k, value: obj[k] }); }
      });
    };
    try {
      setAll(opts.controls);
      if (isObj(opts.start) && typeof rig.setClock === 'function') rig.setClock(opts.start.N, opts.start.tS);
      const evs = (isArr(seq) ? seq : []).filter(function (e) { return isObj(e) && isFinite(num(e.t, NaN)) && num(e.t, 0) >= 0; }).map(function (e) { return Object.assign({}, e, { t: num(e.t, 0) }); }).sort(function (a, b) { return a.t - b.t; });
      const hh = num(rig.h, 1), sampleS = num(opts.sampleS, NaN) > 0 ? num(opts.sampleS, 1) : Math.max(hh, Tend / 2000, 1e-3);
      const ramps = [], faults = [];
      const addFaults = function (st) { if (st && isArr(st.faults)) st.faults.forEach(function (f) { if (faults.indexOf(f) < 0) faults.push(f); }); };
      const sample = function (t) {
        let st = null, mt = null; try { st = cloneJ(rig.state()); mt = typeof rig.readMeters === 'function' ? cloneJ(rig.readMeters()) : null; } catch (e) { st = null; }
        addFaults(st); out.samples.push({ t: t, meters: mt, state: st });
      };
      let t = 0, k = 0, nextS = sampleS;
      const due = function () {
        while (k < evs.length && evs[k].t <= t + 1e-9) {
          const e = evs[k++];
          if (isObj(e.set)) setAll(e.set);
          if (isObj(e.ramp) && typeof e.ramp.key === 'string') {
            let v0 = NaN; try { v0 = +rig.getControl(e.ramp.key); } catch (x) { v0 = NaN; }
            if (!known(e.ramp.key)) out.errors.push('Schlüssel „' + e.ramp.key + '“ gibt es an dieser Anlage nicht.');
            else ramps.push({ key: e.ramp.key, v0: isFinite(v0) ? v0 : 0, to: num(e.ramp.to, 0), t0: t, dur: Math.max(1e-6, num(e.ramp.durS, 0)) });
          }
        }
      };
      due(); sample(0);
      let guard = 0;
      while (t < Tend - 1e-9 && guard++ < 400000) {
        let dt = Math.min(nextS - t, Tend - t);
        if (k < evs.length) dt = Math.min(dt, Math.max(evs[k].t - t, 1e-6));
        ramps.forEach(function (r) { if (t - r.t0 < r.dur - 1e-9) dt = Math.min(dt, Math.max(r.dur / 100, hh, 1e-3), Math.max(1e-3, r.dur - (t - r.t0))); });
        dt = Math.max(dt, 1e-6);
        ramps.forEach(function (r) { const q = clamp((t + dt / 2 - r.t0) / r.dur, 0, 1); try { rig.setControl(r.key, r.v0 + (r.to - r.v0) * q); } catch (e) { /* abgelehnt */ } });
        rig.stepProcess(dt); t += dt;
        ramps.forEach(function (r) { if (t - r.t0 >= r.dur - 1e-9 && !r.done) { r.done = true; try { rig.setControl(r.key, r.to); } catch (e) { /* abgelehnt */ } } });
        due();
        if (t >= nextS - 1e-9) { sample(t); nextS += sampleS; }
      }
      out.final = cloneJ(rig.state()); addFaults(out.final);
      try { if (typeof rig.diagnose === 'function') { const dg = rig.diagnose(); if (isArr(dg)) dg.forEach(function (d) { if (d && d.id && faults.indexOf(d.id) < 0) faults.push(d.id); }); } } catch (e) { /* ohne */ }
      out.faults = faults;
      out.events = isArr(rig.events) ? cloneJ(rig.events) || [] : [];
      try { out.metrics.keys = typeof rig.readMeters === 'function' ? cloneJ(rig.readMeters()) : null; } catch (e) { /* ohne */ }
      try { out.metrics.analyze = typeof rig.analysis === 'function' ? cloneJ(rig.analysis()) : null; } catch (e) { /* ohne */ }
      try { out.metrics.daily = typeof rig.daily === 'function' ? (cloneJ(rig.daily()) || []) : []; } catch (e) { /* ohne */ }
      out.ok = true;
    } catch (e) { out.errors.push('Der Lauf wurde abgebrochen.'); }
    return out;
  }
  function runSeq() { try { return runSeqImpl.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], metrics: { keys: null, analyze: null, daily: [] }, errors: ['Interner Fehler im Läufer.'], rejected: [] }; } }

  C.batt = batt; C.inv = inv; C.loads = loads; C.ctrl = ctrl; C.sys = sys; C.design = design; C.diagnose = function () { try { return diagnoseOf.apply(null, arguments); } catch (e) { return []; } }; C.runSeq = runSeq;
  /* TEXTS.get: Der Kern (Teil 1) liefert ein Objekt { id, kind, text }, die Pruefstaende (WP3) lesen das Ergebnis wie eine Zeichenkette. Das Ergebnis ist deshalb ein String-Objekt,
   * das zusaetzlich id, kind, text und fx traegt: Beides funktioniert (Textausgabe, JSON, .text). */
  if (typeof TEXTS.get === 'function' && !TEXTS.get.enrWrapped) {
    const getOrig = TEXTS.get;
    const getW = function (id, vars) {
      const o = getOrig.call(TEXTS, id, vars);
      if (!o || typeof o !== 'object') return o;
      const s = new String(o.text === undefined || o.text === null ? '' : String(o.text));
      s.id = o.id; s.kind = o.kind; s.text = o.text === undefined ? '' : o.text; if (o.fx) s.fx = o.fx;
      return s;
    };
    getW.enrWrapped = true; TEXTS.get = getW;
  }
  /* Basis aus Teil 1, falls dort (noch) nicht im Namensraum: fmt und parseNum gehoeren laut Schnittstelle 4.0 zu ENR_CORE */
  if (typeof C.fmt !== 'function') C.fmt = function (x, d) { return fm(x, d); };
  if (typeof C.parseNum !== 'function') C.parseNum = function (str) {
    if (typeof str === 'number') return isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    const m = str.replace(/−/g, '-').trim().match(/^[+-]?s?d[d .,]*/);
    if (!m) return NaN;
    const body = m[0].replace(/s+$/, '').replace(/ /g, '').replace(',', '.'), v = Number(body);
    return isFinite(v) ? v : NaN;
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
