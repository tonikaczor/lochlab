/* verbunddata-heizung.js - Verbundprojekt 7: Heizungsregelung für einen Raum (Projektdefinition, Paket P5)
 * Format laut quelle/verbund/SPEC.md, fachliche Vorlage quelle/verbund-neu/P1-AUSLEGUNG.md (Abschnitte 5 und 6, 9, 10). Lädt unabhängig von der Reihenfolge, auch in Node.
 * Registriert sich bei window.Verbund (registerProject); ist der Kern noch nicht da, wartet die Definition in window.VERBUND_QUEUE. In Node liefert module.exports die Definition.
 * Die Kerne (regcore.js + regrig-raum.js, sencore.js + senrig-temp.js, thmcore.js, verbundrun.js mit arduino.js und pyrun.js) werden erst beim Aufruf von
 * lastenheft/check gelesen (der Hub lädt sie bei Bedarf nach, in Node laden sie sich selbst per require). Beim Registrieren wird kein Kern gebraucht.
 *
 * Slot-Formate (Daten der Hülle), von den Adaptern zu liefern:
 *   haus.plan     { circuits:[{name, breaker:{type,inA}, rcd:{imaMa,type}|null, cable:{mm2,lenM}, loads:[{name,pW}]}], pAvailW, notes }
 *   sen.chain     { rig:'temperatur', preset, ctl:{sensor,circuit,rRef,gain,adcBits,vref,wires,lead,...}, scale:{pts:[[Code,°C],...]}, thr:{kurz,bruch}, state, derived }
 *   mess.protocol { rows:[{id:'r0'|'rref'|'rklemme'|'riso', label, unit, soll, ist, tol, instrument, urteil:'io'|'nio'}], values:{dT}, findings:[Befund-ID] }
 *   rig.state     { lab:'reg', rig:'raumtemp', ctl, seq, op, T, state, derived, meas, <Formularwerte> }   vh4: ks, ksEinheit, tu, tg, tgtu, urteil; vh5: regel
 *   ds.pick       { items:[{role:'stellglied'|'kuehlkoerper', ds:'fach:<id>', part}], calc:{tjC, pVerlW}, vals:{} }
 *   code.sketch   { lang:'arduino', src, run:{serial:[Zeilen]} }       Ein/Aus: A0 Raumfühler, A1 Sollwert (10 bis 30 °C), Pin 9 Heizung (PWM oder zeitproportional)
 *   pi.script     { lang:'python', src, out:[Zeilen] }                  Kopf: daten, daten_ref (je 1008 Zeilen [t_h, T, W, Y, P_W]), DT_S, T_SOLL, BAND_K, NUTZ_VON_H, NUTZ_BIS_H, NUTZ_TAGE
 *   pr.quiz       { answers:{q1..q8}, n:8 }
 * Werte mit (A) sind Annahmen (Lehrwerte), Tabelle FACH (HAx), siehe P1-AUSLEGUNG.md Abschnitte 10 bis 12.
 * Abweichungen von P1 (Gründe im Bericht von P5): Befund-IDs mit Präfix fh-; Regelbarkeit nach Kern (über 10 gut, ab 3 noch regelbar); vh4 open.T = 6 h (spanS des Prüfstands 4 h reicht für
 *   die Beharrung nicht); vh7: Sollwert an A1 (P1 lässt die Quelle offen), Kaltstart bei 10 °C und Anti-Windup relativ zum Muster + 1 K (15 °C und absolut 1 K sind mit dem Muster nicht erreichbar),
 *   Überschwingen + 0,1 K, Zeilenabstand ±2,5 s (der Läufer rechnet in Schritten von 1 s); vh5: die Anti-Windup-Mutante zeigt sich nur bei −5 °C (Fenster-Ausregelzeit 1,8-fach). */
(function (root) {
  'use strict';

  const PID = 'heizung';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const arr = x => (Array.isArray(x) ? x : []);
  const fm = (x, d) => (fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '?');
  const rd = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const lc = s => String(s == null ? '' : s).toLowerCase();

  /* ---------- Hash, Zufall (gleich zum Kern: FNV-1a 32 Bit, mulberry32) ---------- */
  function hash(str) { let h = 0x811c9dc5; str = String(str); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pick = (r, list) => list[Math.floor(r() * list.length) % list.length];
  const numOf = v => { if (fin(v)) return v; const x = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : NaN; };

  /* ---------- Kerne (erst zur Laufzeit gelesen; in Node laden sie sich bei Bedarf selbst) ---------- */
  function core(glob, files) {
    if (root[glob]) return root[glob];
    if (typeof require === 'function') files.forEach(f => { try { require('./' + f); } catch (e) { /* nicht vorhanden */ } });
    return root[glob] || null;
  }
  const REG = () => core('REG_CORE', ['regcore.js', 'regrig-raum.js']);
  const SEN = () => core('SEN_CORE', ['sencore.js', 'senrig-temp.js']);
  const THM = () => core('THM_CORE', ['thmcore.js']);
  function runners() {
    let V = root.Verbund;
    if (!(V && V.runSketch) && typeof require === 'function') { try { V = require('./verbundrun.js'); } catch (e) { V = null; } }
    return V && V.runSketch ? V : null;
  }

  /* ====================================================================== Fachwerte des Projekts (A = Annahme/Lehrwert, siehe P1 Abschnitt 10) */
  const FACH = {
    pHeiz: 3000, uNetz: 230, wNutz: 20,                          // HA1 (F19), HA2 (F8)
    kappa: 56, rho: 0.0178, dUmax: 3,                             // Kupfer: beide Schreibweisen zulassen
    LS_MAX: { 0.75: 10, 1: 10, 1.5: 16, 2.5: 20, 4: 25, 6: 32 }, // gleich verbunddata-giessen.js:68 (Test vergleicht)
    fiMaMax: 30,                                                  // HA9 (F24): FI Typ A, höchstens 30 mA
    aufloesung: 0.2, skalEng: 0.3, skalWeit: 1.0,                // HA10, HA11 (F22)
    risoMin: 100,                                                 // HA13: MΩ bei 100 V
    regelTol: 0.15, ebl: 0.1, ueber: 0.5, band: 0.3, reserve: 1.25,   // HA15 bis HA18
    stellI: 1.5, stellU: 1.5, tjReserve: 20,                      // HA20 (F10), Reserve wie Thermik-Lab
    sketchTol: 1.2, kaltstart: 1.0,                               // HA23, HA24
    tBand: 0.5, komfortMin: 90, energieFaktor: 1.1,               // HA27 (F8), Spec
    tP: 10, errBruch: 1, errKurz: 2, ySicher: 0,                  // HA22, HA25 (F9)
    tagesgang: 3, fensterS: 600, nutzVon: 7, nutzBis: 17, absVon: 19, absBis: 5,   // HA4 (F21), HA7
    tolMul: { 1: 1.5, 2: 1, 3: 0.6 }
  };

  const tolOfLevel = lv => FACH.tolMul[lv === 1 || lv === 3 ? lv : 2];

  /* Fühlerbefund-Katalog (HA14). Namen nur in der Auswahl; vor der Diagnose nennt kein Text, keine Prüfzeile und kein Tipp einen Namen (R1). */
  const FUEHLER = [
    { id: 'fh-ok', name: 'in Ordnung' },
    { id: 'fh-uebergang', name: 'Übergangswiderstand an der Klemme' },
    { id: 'fh-drift', name: 'Fühler außerhalb Klasse B' },
    { id: 'fh-pt100', name: 'falscher Fühlertyp (Pt100)' },
    { id: 'fh-feuchte', name: 'Feuchte im Schutzrohr (Nebenschluss)' },
    { id: 'fh-bruch', name: 'Leitungsunterbrechung' },
    { id: 'fh-kurz', name: 'Leitung gequetscht (Kurzschluss)' }
  ];
  const fuehlerById = id => FUEHLER.find(f => f.id === id) || null;

  /* Stellglied-Katalog (HA19/HA20/HA21, Übungswerte; Zusatzpaket P10c ersetzt ihn durch echte Datenblätter) */
  const STELLGLIEDER = [
    { id: 'ssr-10', name: 'Halbleiterrelais 10 A, Nullspannungsschalter', iN: 10, uDRM: 600, nullsp: true, uT: 1.2, rthJC: 1.5, tjMax: 125, rthCK: 0.2, uCtl: [3, 32] },
    { id: 'ssr-25', name: 'Halbleiterrelais 25 A, Nullspannungsschalter', iN: 25, uDRM: 600, nullsp: true, uT: 1.2, rthJC: 1.0, tjMax: 125, rthCK: 0.2, uCtl: [3, 32] },
    { id: 'ssr-25-sofort', name: 'Halbleiterrelais 25 A, Sofortschaltung', iN: 25, uDRM: 600, nullsp: false, uT: 1.2, rthJC: 1.0, tjMax: 125, rthCK: 0.2, uCtl: [3, 32] },
    { id: 'triac-16', name: 'Triac 16 A (TO-220, isoliert montiert)', iN: 16, uDRM: 600, nullsp: false, uT0: 0.85, rT: 0.025, rthJC: 2.1, tjMax: 125, pkg: 'TO-220', uCtl: null },
    { id: 'relais-16', name: 'Relais 16 A (mechanisch)', iN: 16, mech: true, uCtl: null },
    { id: 'schuetz-20', name: 'Schütz 20 A (mechanisch)', iN: 20, mech: true, uCtl: null }
  ];
  const stellById = id => STELLGLIEDER.find(s => s.id === id) || null;
  const KK_IDS = ['s', 'm', 'l', 'xl'];

  /* ====================================================================== Pt1000 (IEC 60751), Leitung, Fühler-Prüfling */
  const CVD_A = 3.9083e-3, CVD_B = -5.775e-7;
  function ptR(t) { const s = SEN(); if (s && s.formulas && s.formulas.ptResistance) return s.formulas.ptResistance(t, 1000); return 1000 * (1 + CVD_A * t + CVD_B * t * t); }
  const ptSlope = t => 1000 * (CVD_A + 2 * CVD_B * t);                      // dR/dϑ in Ω/K (R0 = 1000 Ω)
  function ptClassB(t) { const s = SEN(); if (s && s.formulas && s.formulas.ptTolerance) return s.formulas.ptTolerance(t, 'B'); return 0.3 + 0.005 * Math.abs(t); }
  const ptTolOhm = t => ptClassB(t) * ptSlope(t);                          // Klassengrenze in Ω
  const rLeitung = P => FACH.rho * P.lFuehler / P.qFuehler;                // Widerstand je Ader in Ω (ρ = 0,0178; 1/56 = 0,01786, 0,3 % Unterschied)
  const dT2L = (P, lead) => 2 * (fin(lead) ? lead : rLeitung(P)) / ptSlope(P.tRef);   // Leitungsfehler der Zweileiterschaltung in K

  /* R1: nur fSeed (Zahl). Der Befund des Prüflings entsteht erst zur Prüfzeit; alte Spielstände mit params.fault bleiben lesbar. */
  function faultKey(P) {
    if (!P) return null;
    if (typeof P.fault === 'string') return P.fault;
    const f = P.fSeed; if (typeof f !== 'number' || !isFinite(f) || f < 0) return null;
    return FUEHLER[Math.floor(f) % FUEHLER.length].id;
  }
  const P_ = ctx => { const s = ctx && ctx.spec, p = isObj(s) && isObj(s.params) ? s.params : (isObj(s) ? s : {}); if (p.fault !== undefined || p.fSeed === undefined) return p; const k = faultKey(p), q = Object.assign({}, p); if (k) Object.defineProperty(q, 'fault', { value: k, enumerable: false }); return q; };
  const fkindOf = P => faultKey(P) || 'fh-ok';

  /* Messwerte des Prüflings (auf 0,1 Ω gerundet, aus dem Katalog; Grundlage von Lastenheft-Text und Prüfung) */
  function fuehlerVals(P) {
    const kind = fkindOf(P), r = rng(hash('vhM|' + (P.fSeed == null ? 'n' : P.fSeed) + '|' + P.tBruch + '|' + P.tRef + '|' + P.lFuehler));
    const R0 = ptR(0), Rr = ptR(P.tRef), t0 = ptTolOhm(0), tr = ptTolOhm(P.tRef), rl = rLeitung(P), two = P.wires === 2 ? 2 * rl : 0;
    let r0 = R0 + (r() * 2 - 1) * 0.5 * t0, rref = Rr + (r() * 2 - 1) * 0.5 * tr, rkl, riso = 500;
    const ru = 2 + 3 * r();
    if (kind === 'fh-drift') { r0 = R0 + 2.5; rref = Rr + 2.5; }
    else if (kind === 'fh-pt100') { r0 = R0 / 10; rref = Rr / 10; }
    else if (kind === 'fh-feuchte') { r0 = R0 * 50000 / (R0 + 50000); rref = Rr * 50000 / (Rr + 50000); riso = 0.05; }
    rkl = rref + two;
    if (kind === 'fh-uebergang') rkl = rref + two + ru;
    else if (kind === 'fh-bruch') rkl = Infinity;
    else if (kind === 'fh-kurz') rkl = 2 * rl;
    const q = x => (fin(x) ? Math.round(x * 10) / 10 : x);
    return { r0: q(r0), rref: q(rref), rklemme: q(rkl), riso: riso };
  }
  /* Soll, Toleranz und richtige Beurteilung je Messzeile (aus der Formel, nicht aus dem Katalog) */
  function fuehlerSoll(P) {
    const R0 = ptR(0), Rr = ptR(P.tRef), rl = rLeitung(P), two = P.wires === 2 ? 2 * rl : 0, v = fuehlerVals(P);
    const soll = { r0: R0, rref: Rr, rklemme: Rr + two }, tol = { r0: ptTolOhm(0), rref: ptTolOhm(P.tRef), rklemme: ptTolOhm(P.tRef) }, urteil = {};
    ['r0', 'rref', 'rklemme'].forEach(k => { urteil[k] = fin(v[k]) && Math.abs(v[k] - soll[k]) <= tol[k] ? 'io' : 'nio'; });
    urteil.riso = v.riso >= FACH.risoMin ? 'io' : 'nio';
    return { soll: soll, tol: tol, urteil: urteil, vals: v };
  }

  /* ====================================================================== Lastenheft */
  const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  const y1Of = P => Math.round((17 - P.tOutSprung) / 30 * 100);              // Handsprung: Anfangswert, bei dem der Raum stationär bei 17 °C steht
  const fmv = x => (fin(x) ? fm(x, 1) + ' Ω' : 'OL');
  function lastenheft(seed, level) {
    level = level === 1 || level === 3 ? level : 2;
    const r = rng((seed >>> 0) ^ 0x68657a31);
    const dw = pick(r, level === 1 ? [4] : [3, 4, 5]);
    const tOut = pick(r, level === 1 ? [0] : [-5, 0, 5]);
    const lZu = pick(r, [10, 15, 20]), lF = pick(r, [5, 10, 15]);
    const tRef = 19.5 + Math.floor(r() * 41) / 10;
    const tMean = []; for (let i = 0; i < 7; i++) tMean.push(-5 + Math.floor(r() * 11));
    const win = [];
    for (let i = 0; i < 2; i++) { const tag = pick(r, [0, 1, 2, 3, 4]), h = pick(r, [8, 9, 10, 11, 12, 13, 14, 15]); win.push({ tag: tag, h: h, d: FACH.fensterS }); }
    if (win[1].tag === win[0].tag && win[1].h === win[0].h) win[1].h = win[0].h === 15 ? 8 : win[0].h + 1;
    const tBruch = 1800 + 60 * Math.floor(r() * 61);
    const fSeed = level === 3 ? Math.floor(r() * 7000) : null;
    const p = {
      pHeiz: FACH.pHeiz, uNetz: FACH.uNetz, wNutz: FACH.wNutz, dw: dw, nutzVon: FACH.nutzVon, nutzBis: FACH.nutzBis, absVon: FACH.absVon, absBis: FACH.absBis,
      tOutSprung: tOut, lZu: lZu, qZu: 1.5, lFuehler: lF, qFuehler: 0.5, tRef: tRef, tMean: tMean, tagesgang: FACH.tagesgang, win: win, tBruch: tBruch,
      wires: level === 1 ? 3 : 2, adcBits: 10, uRef: 5, fSeed: fSeed, hidden: ['fSeed'].concat(['tBruch'])
    };
    const fv = fuehlerVals(p);
    const text = [
      'Projekt Heizungsregelung, Stufe ' + level + ' (' + (level === 1 ? 'Einsteiger' : level === 2 ? 'Standard' : 'Profi') + ').',
      'Werkstatt-Büro mit elektrischem Heizgerät ' + (p.pHeiz / 1000) + ' kW an ' + p.uNetz + ' V (Prüfstandswert), Zuleitung ' + lZu + ' m mit 1,5 mm². Solltemperatur ' + p.wNutz + ' °C in der Nutzzeit Montag bis Freitag von ' + p.nutzVon + ' bis ' + p.nutzBis + ' Uhr (A). Absenkung um ' + dw + ' K von ' + p.absVon + ' bis ' + p.absBis + ' Uhr und am Wochenende (A).',
      'Raumfühler Pt1000 in ' + (p.wires === 3 ? 'Dreileiter' : 'Zweileiter') + '-Schaltung, Fühlerleitung ' + lF + ' m mit 0,5 mm² Kupfer. Messkette zum Arduino: ADU ' + p.adcBits + ' Bit mit ' + p.uRef + ' V Referenz. Der Regler der Strecke rechnet in Prozent des Messbereichs 10 bis 30 °C.',
      'Außentemperatur im Winter −5 bis +5 °C. Tagesmittel Montag bis Sonntag: ' + tMean.join(', ') + ' °C, dazu ein Tagesgang von ±' + p.tagesgang + ' K (A). Zwei Fenster je 10 Minuten offen: ' + TAGE[win[0].tag] + ' ' + win[0].h + ' Uhr und ' + TAGE[win[1].tag] + ' ' + win[1].h + ' Uhr.',
      'Streckenversuch im Handbetrieb: Außentemperatur ' + tOut + ' °C, Anfangswert der Stellgröße y1 = ' + y1Of(p) + ' %, dann Sprung um 10 % (A).',
      'Fühler-Prüfling, Messwerte: Fühlerkopf im Eiswasser (0 °C) ' + fmv(fv.r0) + '; Fühlerkopf bei ' + fm(tRef, 1) + ' °C (Referenzthermometer) ' + fmv(fv.rref) + '; an der Reglerklemme bei ' + fm(tRef, 1) + ' °C ' + fmv(fv.rklemme) + '; Isolation Fühler gegen Schutzrohr bei 100 V ' + (fv.riso >= 1 ? fm(fv.riso, 0) : fm(fv.riso, 2)) + ' MΩ.'
    ];
    if (level === 1) text.push('Starthilfe: Als Einstellregel ist chr-stoer-0 vorgegeben. Am Ende der Nachtabsenkung hilft eine Sollwertrampe.');
    if (level === 3) text.push('Hinweis Fühlerprüfung: Der Prüfling kann einen Fehler haben, oder auch nicht. Beurteile die Messwerte und gib einen Befund.');
    const io = [{ key: 'A0', sym: 'Raumfühler', text: 'Messkette des Pt1000 (Station 2)' }, { key: 'A1', sym: 'Sollwert', text: 'Sollwert 10 bis 30 °C über 0 bis 1023 Digit (Schaltuhr)' }, { key: '9', sym: 'Heizung', text: 'Heizgerät über Stellglied: PWM oder zeitproportional' }];
    return { params: p, text: text, io: io };
  }

  /* ====================================================================== Gemeinsame Infrastruktur der Stationen */
  const TOL = ctx => (ctx && fin(ctx.tol) ? ctx.tol : 1);
  const LEVEL = ctx => (ctx && (ctx.level === 1 || ctx.level === 3) ? ctx.level : 2);
  const unwrap = d => (isObj(d) && isObj(d.data) && typeof d.type === 'string' ? d.data : d);
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
    if (!ctx) return null;
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
  const memo = (map, key, fn) => { if (map.has(key)) return map.get(key); const v = fn(); if (map.size > 300) map.clear(); map.set(key, v); return v; };
  const sig = o => hash(JSON.stringify(o));
  const pcOk = (x, soll, rel) => fin(x) && fin(soll) && Math.abs(x - soll) <= rel * Math.abs(soll);
  /* Vergleichszeile mit getrenntem Text für fehlt, ungültig, zu klein, zu groß (Korrekturrichtung) */
  function cmpTxt(label, x, soll, tolAbs, unit, dec) {
    const u = unit ? ' ' + unit : '';
    if (x === null || x === undefined || x === '') return { ok: false, t: label + ': fehlt' };
    if (!fin(x)) return { ok: false, t: label + ': keine gültige Zahl' };
    const d = x - soll;
    if (Math.abs(d) <= tolAbs) return { ok: true, t: label + ': ' + fm(x, dec) + u + ' (erwartet ' + fm(soll, dec) + u + ', ±' + fm(tolAbs, dec) + ')' };
    return { ok: false, t: label + ': ' + fm(x, dec) + u + ' ist ' + (d < 0 ? 'zu klein' : 'zu groß') + ', erwartet ' + fm(soll, dec) + u + ' (±' + fm(tolAbs, dec) + ')' };
  }

  /* ====================================================================== Strecke, Wochenmodell (REG_CORE.plant-Ketten + REG_CORE.controller, P1 5.3) */
  const DEF_RP = { Pmax: 3000, Thk: 300, Tt: 120, C: 180000, UA: 100, UAwin: 250, Ts: 60, lo: 10, hi: 30 };
  let RPc = null;
  function RP() {                                  // Parameter des Prüfstands raumtemp (wird exportiert, P1 5.3); Rückfall: die Prüfstandswerte
    if (RPc) return RPc;
    REG(); const R = root.REG_RIGS; let p = null;
    try { p = R && R.create ? R.create('raumtemp', { seed: 1 }).params : null; } catch (e) { p = null; }
    return (RPc = p && p.Pmax ? p : DEF_RP);
  }
  const pctOf = x => 100 * (x - RP().lo) / (RP().hi - RP().lo), physOf = p => RP().lo + p * (RP().hi - RP().lo) / 100;
  /* Ketten: Heizkörper [PT1 Thk, Tt] (y % -> P % von Pmax), Raum [K, PT1 C/UA] (P % + Fensterverlust -> ϑ − T_a in % des Bereichs), Fühler [PT1 Ts]; h in Sekunden */
  function makeSim(h, tout0, x0) {
    const C = REG(), P = RP(), rg = P.hi - P.lo, KS = P.Pmax / P.UA / rg, TAU = P.C / P.UA;
    const heat = C.plant({ blocks: [{ t: 'PT1', T: P.Thk }, { t: 'Tt', Tt: P.Tt }], op: { y: 0, x: 0 } }, h);
    const room = C.plant({ blocks: [{ t: 'K', K: KS }, { t: 'PT1', T: TAU }], op: { y: 0, x: 0 } }, h);
    const sens = C.plant({ blocks: [{ t: 'PT1', T: P.Ts }], op: { y: 0, x: 0 } }, h);
    const y0 = (x0 - tout0) / (P.Pmax / P.UA) * 100;
    heat.setSteady(y0); room.setSteady(y0); sens.setSteady(pctOf(x0));
    const s = { xRoom: x0, xm: x0, ph: y0, y0: y0,
      step(y, tout, win) {
        const ph = heat.step(y, 0), z = win ? -(P.UAwin - P.UA) * (s.xRoom - tout) / (P.Pmax / 100) : 0;
        s.xRoom = tout + room.step(ph + z, 0) * rg / 100; s.xm = physOf(sens.step(pctOf(s.xRoom), 0)); s.ph = ph; return s;
      } };
    return s;
  }
  /* Sollwert zur Zeit t (Sekunden ab Montag 0 Uhr): 20 °C von 5 bis 19 Uhr (Nutzzeit 7 bis 17 Uhr), sonst abgesenkt; wkend: Sa/So ganztägig abgesenkt (A HA4) */
  function wTarget(t, dw, wkend) {
    const day = Math.floor(t / 86400) % 7, hr = (t % 86400) / 3600;
    if (wkend && day >= 5) return FACH.wNutz - dw;
    return hr >= FACH.absVon || hr < FACH.absBis ? FACH.wNutz - dw : FACH.wNutz;
  }
  const toutOf = (t, tMean, amp) => tMean[Math.floor(t / 86400) % tMean.length] + (amp == null ? FACH.tagesgang : amp) * Math.cos(((t % 86400) / 3600 - 15) / 24 * 2 * Math.PI);
  const wkCache = new Map();
  /* weekModel: o = { Kp, Tn, ctrl, aw, ymax, u0, ramp (%/s), dw, days, tMean, windows:[{t,d}], wkend, amp, nutzTage, h } -> { ok, E (kWh), komfort (%), minT, rows:[[t_h, T, W, Y, P_W]] } */
  function weekModel(o) {
    return memo(wkCache, sig(o), () => {
      const C = REG(), P = RP(), h = o.h || 10, days = o.days || 7, rg = P.hi - P.lo, tMean = arr(o.tMean).length ? o.tMean : [0];
      const ctl = C.controller({ type: o.ctrl === 'P' ? 'P' : 'PI', Kp: o.Kp, Tn: o.Tn, dir: 'direkt', ymin: 0, ymax: fin(o.ymax) ? o.ymax : 100, Ta: 1, u0: fin(o.u0) ? o.u0 : 0, aw: o.aw || 'rueck' }, h);
      if (!ctl || ctl.ok === false) return { ok: false, why: (ctl && ctl.why) || 'Reglerwerte ungültig' };
      const w0 = wTarget(0, o.dw, o.wkend), sim = makeSim(h, toutOf(0, tMean, o.amp), w0);
      if (ctl.bumpless) ctl.bumpless(sim.y0, pctOf(w0), pctOf(w0));
      const ramp = o.ramp > 0 ? o.ramp : 0, N = Math.round(days * 86400 / h), nRow = Math.round(600 / h), nutzT = o.nutzTage || 5, wins = arr(o.windows);
      let wS = pctOf(w0), E = 0, nutz = 0, komf = 0, minT = Infinity;
      const rows = [];
      for (let i = 0; i < N; i++) {
        const t = i * h, wT = pctOf(wTarget(t, o.dw, o.wkend)), xb = sim.xRoom;
        wS = ramp > 0 ? wS + Math.max(-ramp * h, Math.min(ramp * h, wT - wS)) : wT;
        const win = wins.some(q => t >= q.t && t < q.t + q.d), y = ctl.step(wS, pctOf(sim.xm));
        sim.step(y, toutOf(t, tMean, o.amp), win);
        E += P.Pmax * sim.ph / 100 * h / 3.6e6;
        const hr = (t % 86400) / 3600, dayNo = Math.floor(t / 86400) % 7;
        if (hr >= FACH.nutzVon && hr < FACH.nutzBis && dayNo < nutzT) { nutz++; if (Math.abs(xb - FACH.wNutz) <= FACH.tBand) komf++; minT = Math.min(minT, xb); }
        if (i % nRow === 0) rows.push([rd(t / 3600, 4), rd(xb, 3), rd(physOf(wS), 3), rd(y, 2), rd(P.Pmax * sim.ph / 100, 1)]);
      }
      return { ok: true, E: E, komfort: 100 * komf / Math.max(1, nutz), minT: minT, rows: rows };
    });
  }
  const winsOf = P => arr(P.win).map(q => ({ t: q.tag * 86400 + q.h * 3600, d: q.d || FACH.fensterS }));
  /* Wochenmodell mit Reglerwerten aus Formularen oder Muster; Absenkung dw (0 = ohne Absenkung) */
  function weekFor(P, c, dw) {
    return weekModel({ Kp: c.kp, Tn: c.tn, ctrl: c.ctrl, aw: c.aw, ymax: c.ymax, u0: c.u0, ramp: c.wRamp, dw: dw, days: 7, tMean: P.tMean, windows: winsOf(P), wkend: true });
  }

  /* ====================================================================== Rig-Läufe (REG_CORE.runSeq, ohne Wirkung auf das Bild) */
  const cleanSeq = s => arr(s).filter(x => isObj(x) && fin(x.t)).slice(0, 500).map(clone);
  const runCache = new Map();
  function regRun(d, o) {
    o = o || {};
    const C = REG(); if (!C || !C.runSeq) return { ok: false, why: 'Der Rechenkern des Regelungs-Labs ist nicht geladen.' };
    if (!isObj(d) || d.rig !== 'raumtemp' || !isObj(d.ctl)) return { ok: false, why: 'Die Daten gehören nicht zum Prüfstand „raumtemp“ (Raumtemperatur).' };
    const T = fin(o.T) ? o.T : fin(d.T) ? d.T : NaN;
    if (!(T > 0)) return { ok: false, why: 'Die Dauer des Laufs fehlt.' };
    const ctl = clone(d.ctl), seq = cleanSeq(d.seq), opts = { seed: 1, controls: ctl, sampleS: o.sampleS || 30 };
    if (ctl.mode !== 'auto' && isObj(d.op) && fin(d.op.y)) opts.op = { y: d.op.y };
    return memo(runCache, sig([ctl, seq, Math.min(86400, T), opts.op || null, opts.sampleS]), () => {
      let r; try { r = C.runSeq('raumtemp', seq, Math.min(86400, T), opts); } catch (e) { return { ok: false, why: 'Der Rechenlauf ist abgebrochen.' }; }
      if (!r || !arr(r.samples).length) return { ok: false, why: 'Der Rechenlauf lieferte keine Werte.' };
      return { ok: true, samples: r.samples, final: r.final };
    });
  }
  /* vh4: Daten des Streckenversuchs lesen, Lauf rechnen, fitStep auf den Samples (K_s in K/% und %/%, T_u, T_g, Regelbarkeit) */
  function strInfo(d, P) {
    const o = { ok: false, errs: [] };
    if (!isObj(d) || d.rig !== 'raumtemp' || !isObj(d.ctl)) { o.errs.push('keine Versuchsdaten des Prüfstands „raumtemp“'); return o; }
    const seq = cleanSeq(d.seq), eff = Object.assign({}, d.ctl);
    seq.forEach(s => { if (s.t <= 0 && isObj(s.set)) Object.assign(eff, s.set); });
    const st = seq.find(s => s.t > 0 && isObj(s.set) && fin(+s.set.yHand));
    o.eff = eff; o.hand = eff.mode === 'hand'; o.y1 = isObj(d.op) && fin(d.op.y) ? +d.op.y : +eff.yHand; o.tS = st ? st.t : NaN; o.y2 = st ? +st.set.yHand : NaN; o.T = fin(d.T) ? d.T : NaN;
    if (!o.hand) { o.errs.push('der Versuch läuft nicht im Handbetrieb'); return o; }
    if (!st) { o.errs.push('es gibt keinen Sprung der Handstellgröße'); return o; }
    if (!fin(o.y1) || !fin(o.y2) || o.y2 === o.y1) { o.errs.push('Anfangswert oder Sprunghöhe fehlen'); return o; }
    const run = regRun(d, { T: o.T, sampleS: 30 }); if (!run.ok) { o.errs.push(run.why); return o; }
    const t = run.samples.map(s => s.t), x = run.samples.map(s => s.x), C = REG();
    let fs; try { fs = C.fitStep(t, x, o.y2 - o.y1, { t0: o.tS }); } catch (e) { fs = null; }
    if (!fs || fs.ok === false || !fin(fs.Ks) || !fin(fs.Tu) || !fin(fs.Tg)) { o.errs.push('die Sprungantwort lässt sich nicht auswerten' + (fs && fs.why ? ' (' + fs.why + ')' : '')); return o; }
    const rg = RP().hi - RP().lo;
    Object.assign(o, { ok: true, t: t, x: x, fs: fs, Ks: fs.Ks, KsNorm: fs.Ks * 100 / rg, Tu: fs.Tu, Tg: fs.Tg, ratio: fs.Tg / fs.Tu, urteil: fs.urteil });
    return o;
  }
  const REGELN = { 'chr-stoer-0': { ramp: 0.005 }, 'chr-fuehr-0': { ramp: 0 } };
  function ruleOf(regel, st) {                   // Kp, Tn nach Regel aus den (eigenen) Kennwerten
    try { const a = REG().rules.apply(regel, { Ks: st.KsNorm, Tu: st.Tu, Tg: st.Tg }, 'PI'); return a && a.ok !== false && fin(a.Kp) && fin(a.Tn) ? { Kp: a.Kp, Tn: a.Tn } : null; } catch (e) { return null; }
  }
  const musterCtl = (regel, rule) => ({ ctrl: 'PI', kp: rule.Kp, tn: rule.Tn, aw: 'rueck', wRamp: (REGELN[regel] || REGELN['chr-stoer-0']).ramp, ymax: 100 });
  const CTL_KEYS = ['ctrl', 'kp', 'tn', 'tv', 'aw', 'wRamp', 'ymax', 'ta', 'dir', 'u0'];
  const guCache = new Map();
  /* Prüflauf Führung + Fenster (P1 5.2 guete): stationär bei w0 = 20 − dw, Sprung auf 20 °C, nach 5 h Fenster 10 min, 3 h Nachlauf */
  function guete(P, ctlIn) {
    const c = {}; CTL_KEYS.forEach(k => { if (isObj(ctlIn) && ctlIn[k] !== undefined && ctlIn[k] !== null) c[k] = ctlIn[k]; });
    return memo(guCache, sig([P.tOutSprung, P.dw, c]), () => {
      const C = REG(), tOut = P.tOutSprung, w0 = FACH.wNutz - P.dw, yop = clamp((w0 - tOut) / 30 * 100, 0, 100), tS = 3600, tW = tS + 5 * 3600, tEnd = tW + 3 * 3600;
      const seq = [{ t: 0, set: Object.assign({ mode: 'auto' }, c, { w: w0 }) }, { t: tS, set: { w: FACH.wNutz } }, { t: tW, set: { window: true } }, { t: tW + 600, set: { window: false } }];
      let r; try { r = C.runSeq('raumtemp', seq, tEnd, { seed: 1, sampleS: 10, controls: { tOut: tOut, z: 0, window: false, noise: 0, mode: 'auto', w: w0 }, op: { y: yop, x: w0 } }); } catch (e) { r = null; }
      if (!r || !arr(r.samples).length) return { ok: false };
      const s = r.samples.filter(q => q.t >= tS && q.t < tW), t = s.map(q => q.t), x = s.map(q => q.x);
      let tAus = NaN; for (let i = x.length - 1; i >= 0; i--) if (Math.abs(x[i] - FACH.wNutz) > FACH.band) { tAus = i + 1 < t.length ? t[i + 1] - tS : NaN; break; }
      const d = r.samples.filter(q => q.t >= tW); let dm = null;
      try { dm = C.disturbMetrics(d.map(q => q.t), d.map(q => q.x), { w: FACH.wNutz, tz: tW, band: FACH.band, range: RP().hi - RP().lo, unit: 'K' }); } catch (e) { dm = null; }
      return { ok: true, over: Math.max(0, Math.max.apply(null, x) - FACH.wNutz), tAus: tAus, ebl: Math.abs(FACH.wNutz - x[x.length - 1]), xd: dm && fin(dm.xdMax) ? Math.abs(dm.xdMax) : NaN, tAusF: dm && fin(dm.tAus) ? dm.tAus : NaN };
    });
  }

  /* ====================================================================== Messkette (SEN_CORE.runSeq, Prüfstand temperatur) */
  const senCache = new Map(), SEN_KEYS = ['sensor', 'circuit', 'rRef', 'gain', 'adcBits', 'vref', 'wires', 'lead', 'selfHeat', 'lin', 'cjc'];
  const SEN_TEMPS = [-10, -5, 0, 5, 10, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50];
  function senRun(ctl, tMeas, brk) {              // eingeschwungen (Sonde startet bei 25 °C, τ = 6 s): 54 s Prozesszeit = 9 τ, Schritt 20 ms, controls = Einstellungen
    const s = { tMeas: tMeas }; SEN_KEYS.forEach(k => { if (ctl[k] !== undefined && ctl[k] !== null) s[k] = ctl[k]; });
    return memo(senCache, sig([s, !!brk]), () => {
      const S = SEN(); if (!S || !S.runSeq) return null;
      const seq = [{ t: 0, set: s }]; if (brk) seq.push({ t: 100, set: { wireBreak: true } });
      try { const r = S.runSeq('temperatur', seq, 54000, { seed: 1, controls: s, dtMs: 20, sampleMs: 60000 }); return r && r.final ? r.final : null; } catch (e) { return null; }
    });
  }
  function senInfo(d) {
    const o = { ok: false, errs: [], codes: {}, sat: {} };
    if (!isObj(d) || !isObj(d.ctl)) { o.errs.push('keine Daten der Messkette'); return o; }
    if (!SEN()) { o.errs.push('Der Rechenkern der Sensorik ist nicht geladen.'); return o; }
    SEN_TEMPS.forEach(t => { const f = senRun(d.ctl, t); o.codes[t] = f && fin(f.adc) ? f.adc : NaN; o.sat[t] = f ? !!f.saturated : true; });
    const f20 = senRun(d.ctl, 20), fb = senRun(d.ctl, 20, true);
    o.res20 = f20 && fin(f20.resolution) ? f20.resolution : NaN; o.cBreak = fb && fin(fb.adc) ? fb.adc : NaN; o.adcMax = f20 && fin(f20.adcMax) ? f20.adcMax : 1023;
    o.ok = SEN_TEMPS.every(t => fin(o.codes[t]));
    if (!o.ok) o.errs.push('Die Messkette liefert keine Werte (Einstellungen unzulässig).');
    return o;
  }
  /* stückweise lineare Skalierung aus Stützstellen [[Code, °C], ...] (mindestens zwei, Codes verschieden) */
  function scalePts(d) {
    const p = d && isObj(d.scale) ? arr(d.scale.pts) : [];
    const a = p.filter(q => Array.isArray(q) && fin(+q[0]) && fin(+q[1])).map(q => [+q[0], +q[1]]).sort((u, v) => u[0] - v[0]);
    return a.length >= 2 && a.length <= 5 && a.every((q, i) => i === 0 || q[0] > a[i - 1][0]) ? a : null;
  }
  function skal(pts, c) {
    let i = 1; while (i < pts.length - 1 && c > pts[i][0]) i++;
    const a = pts[i - 1], b = pts[i]; return a[1] + (c - a[0]) * (b[1] - a[1]) / (b[0] - a[0]);
  }
  function codeAt(si, t) {                         // Code bei beliebiger Temperatur aus den gerechneten Stützstellen (linear)
    const T = SEN_TEMPS; let i = 1; while (i < T.length - 1 && t > T[i]) i++;
    const a = T[i - 1], b = T[i], ca = si.codes[a], cb = si.codes[b];
    return Math.round(ca + (t - a) * (cb - ca) / (b - a));
  }

  /* ====================================================================== vh1: Stromkreis für das Heizgerät (Haus-Lab) */
  function hausInfo(d, P) {
    const cs = arr(d && d.circuits).filter(isObj);
    const c = cs.find(x => /heiz|raum|büro|buero/i.test(String(x.name))) || cs[0] || null;
    const o = { c: c, iB: P.pHeiz / FACH.uNetz };
    if (!c) return o;
    const loads = arr(c.loads).filter(isObj);
    o.pLoad = loads.reduce((a, l) => a + (fin(+l.pW) ? +l.pW : 0), 0);
    o.mm2 = c.cable && fin(+c.cable.mm2) ? +c.cable.mm2 : NaN;
    o.len = c.cable && fin(+c.cable.lenM) ? +c.cable.lenM : NaN;
    const dU = k => 2 * o.len * o.iB / (k * o.mm2) / FACH.uNetz * 100;
    o.dUpct = fin(o.mm2) && fin(o.len) ? dU(FACH.kappa) : NaN;                       // κ = 56 m/(Ω·mm²)
    o.dUpct2 = fin(o.mm2) && fin(o.len) ? dU(1 / FACH.rho) : NaN;                    // ρ = 0,0178 Ω·mm²/m (gleiche Größe, 0,3 % Unterschied)
    o.iZ = FACH.LS_MAX[o.mm2];
    return o;
  }
  function checkHaus(data, ctx) {
    const P = P_(ctx), lines = [], h = hausInfo(data, P), c = h.c, br = c && isObj(c.breaker) ? c.breaker : null;
    const inA = br ? +br.inA : NaN, typeOk = !!br && ['b', 'c'].indexOf(lc(br.type)) >= 0;
    let why = '';
    if (!c) why = 'kein Stromkreis eingetragen';
    else if (!br || !fin(inA)) why = 'Bemessungsstrom des Leitungsschutzschalters fehlt';
    else if (!typeOk) why = 'Typ ' + String(br.type) + ' passt nicht: verlangt ist Auslösecharakteristik B oder C';
    else if (!fin(h.iZ)) why = 'Leitungsquerschnitt fehlt oder steht nicht in der Tabelle';
    else if (inA < h.iB) why = 'I_N ' + fm(inA, 0) + ' A ist zu klein: der Betriebsstrom ' + fm(h.iB, 2) + ' A löst den Schutzschalter aus';
    else if (inA > h.iZ) why = 'I_N ' + fm(inA, 0) + ' A ist zu groß: ' + fm(h.mm2, 2) + ' mm² vertragen höchstens ' + fm(h.iZ, 0) + ' A';
    lines.push(L(!why, 'Leitungsschutz: ' + (why || 'I_N ' + fm(inA, 0) + ' A liegt zwischen Betriebsstrom ' + fm(h.iB, 2) + ' A und ' + fm(h.iZ, 0) + ' A (' + fm(h.mm2, 2) + ' mm²)'), 25));
    const mmOk = fin(h.mm2) && fin(h.iZ), lenOk = fin(h.len) && Math.abs(h.len - P.lZu) <= 0.5;
    lines.push(L(mmOk && lenOk, 'Leitung und Länge: ' + (!c ? 'keine Leitung eingetragen' : !mmOk ? 'Querschnitt fehlt oder ist nicht üblich (0,75; 1; 1,5; 2,5; 4; 6 mm²)' : !lenOk ? 'Länge ' + (fin(h.len) ? fm(h.len, 0) + ' m' : 'fehlt') + ' weicht vom Lastenheft ab (' + P.lZu + ' m)' : fm(h.mm2, 2) + ' mm² über ' + fm(h.len, 0) + ' m, wie im Lastenheft'), 15));
    const dOk = fin(h.dUpct) && Math.min(h.dUpct, h.dUpct2) <= FACH.dUmax;
    lines.push(L(dOk, 'Spannungsfall ΔU = 2 · l · I / (κ · A): ' + (fin(h.dUpct) ? fm(h.dUpct, 2) + ' % bei ' + fm(h.iB, 2) + ' A' : 'nicht berechenbar (Querschnitt oder Länge fehlen)') + ', erlaubt höchstens ' + FACH.dUmax + ' % (κ = 56 m/(Ω·mm²), das entspricht ρ = 0,0178 Ω·mm²/m)' + (fin(h.dUpct) && !dOk ? ' – größeren Querschnitt wählen' : ''), 25));
    const rc = c && isObj(c.rcd) ? c.rcd : null, ma = rc ? +rc.imaMa : NaN, fiOk = !!rc && lc(rc.type) === 'a' && fin(ma) && ma > 0 && ma <= FACH.fiMaMax;
    lines.push(L(fiOk, 'Zusatzschutz: ' + (!rc ? 'kein FI eingetragen' : lc(rc.type) !== 'a' ? 'FI Typ ' + String(rc.type) + ' passt nicht, verlangt ist Typ A' : !fin(ma) || ma <= 0 ? 'Bemessungsfehlerstrom fehlt' : ma > FACH.fiMaMax ? 'FI mit ' + fm(ma, 0) + ' mA ist zu groß, höchstens ' + FACH.fiMaMax + ' mA' : 'FI Typ A mit ' + fm(ma, 0) + ' mA') + ' (A)', 15));
    const pOk = fin(h.pLoad) && h.pLoad > 0 && Math.abs(h.pLoad - P.pHeiz) <= 1;
    lines.push(L(pOk, 'Leistung: ' + (!(h.pLoad > 0) ? 'kein Heizgerät eingetragen' : fm(h.pLoad, 0) + ' W' + (pOk ? ' (Lastenheft ' + P.pHeiz + ' W)' : (h.pLoad < P.pHeiz ? ' ist zu klein' : ' ist zu groß') + ', das Lastenheft nennt ' + P.pHeiz + ' W')), 20));
    return lines;
  }
  function hausSolution(ctx) {
    const P = P_(ctx);
    return { circuits: [{ name: 'Heizgerät Werkstatt-Büro', breaker: { type: 'B', inA: 16 }, rcd: { imaMa: 30, type: 'A' }, cable: { mm2: 1.5, lenM: P.lZu }, loads: [{ name: 'Heizgerät', pW: P.pHeiz }] }],
      pAvailW: P.pHeiz, notes: 'B16 auf 1,5 mm², FI Typ A 30 mA, Spannungsfall unter 3 %.' };
  }

  /* ====================================================================== vh2: Messkette Pt1000 (Sensorik-Lab, Prüfstand temperatur) */
  function checkSen(data, ctx) {
    const P = P_(ctx), lines = [], d = isObj(data) ? data : {}, ctl = isObj(d.ctl) ? d.ctl : {}, si = senInfo(d), ok = si.ok;
    const lead = numOf(ctl.lead), leadSoll = rLeitung(P), e1 = [];
    if (lc(ctl.sensor) !== 'pt1000') e1.push('der Fühler muss ein Pt1000 sein (eingestellt: ' + (ctl.sensor == null ? 'nichts' : String(ctl.sensor)) + ')');
    if (numOf(ctl.wires) !== P.wires) e1.push('verlangt ist ' + P.wires + '-Leiter-Anschluss (eingestellt: ' + (fin(numOf(ctl.wires)) ? numOf(ctl.wires) + '-Leiter' : 'nichts') + ')');
    if (!fin(lead)) e1.push('der Leitungswiderstand je Ader fehlt');
    else if (!pcOk(lead, leadSoll, 0.02)) e1.push('Leitungswiderstand ' + fm(lead, 3) + ' Ω je Ader ist zu ' + (lead < leadSoll ? 'klein' : 'groß') + ', aus ρ · l / A folgen ' + fm(leadSoll, 3) + ' Ω (' + P.lFuehler + ' m, 0,5 mm², ρ = 0,0178 Ω·mm²/m, mit κ = 56 gleich)');
    lines.push(L(e1.length === 0, 'Fühler und Leitung: ' + (e1.length ? e1[0] : 'Pt1000 im ' + P.wires + '-Leiter-Anschluss, ' + fm(leadSoll, 3) + ' Ω je Ader'), 15));
    const bits = numOf(ctl.adcBits), vref = numOf(ctl.vref);
    lines.push(L(bits === P.adcBits && vref === P.uRef, 'ADU: ' + (fin(bits) ? bits + ' Bit' : 'Auflösung fehlt') + ' mit ' + (fin(vref) ? fm(vref, 1) + ' V' : 'fehlender') + ' Referenz, verlangt sind ' + P.adcBits + ' Bit mit ' + P.uRef + ' V (Arduino)', 5));
    lines.push(L(ok && si.res20 <= FACH.aufloesung, 'Auflösung bei 20 °C: ' + (ok ? fm(si.res20, 3) + ' K je Digit' : 'nicht berechenbar (' + (si.errs[0] || '?') + ')') + ', höchstens ' + fm(FACH.aufloesung, 1) + ' K (A)' + (ok && si.res20 > FACH.aufloesung ? ' – zu grob: Messbereich des ADU besser nutzen (Brücke, größere Verstärkung)' : ''), 20));
    const sat = ok && (si.sat[-10] || si.sat[50]), c1 = ok ? si.codes[-10] : NaN, c2 = ok ? si.codes[50] : NaN, inR = c => fin(c) && c >= 1 && c <= si.adcMax - 1;
    lines.push(L(ok && !sat && inR(c1) && inR(c2), 'Messbereich −10 bis +50 °C: ' + (ok ? 'Zählwerte ' + c1 + ' und ' + c2 + (sat || !inR(c1) || !inR(c2) ? ' – der ADU läuft an die Grenze (1 bis ' + (si.adcMax - 1) + ' verlangt), Verstärkung verkleinern oder Brücke abgleichen' : ' liegen im ADU-Bereich') : 'nicht berechenbar'), 10));
    const pts = scalePts(d);
    let eEng = NaN, eWeit = NaN;
    if (ok && pts) {
      eEng = 0; eWeit = 0;
      SEN_TEMPS.forEach(t => { const e = Math.abs(skal(pts, si.codes[t]) - t); if (t >= 15 && t <= 25) eEng = Math.max(eEng, e); if (t >= 0 && t <= 40) eWeit = Math.max(eWeit, e); });
    }
    lines.push(L(ok && !!pts && eEng <= FACH.skalEng && eWeit <= FACH.skalWeit, 'Skalierung: ' + (!pts ? 'zwei bis fünf Stützstellen (Zählwert, °C) mit verschiedenen Zählwerten eintragen' : !ok ? 'nicht berechenbar' : 'stückweise linear aus ' + pts.length + ' Stützstellen, größter Fehler ' + fm(eEng, 2) + ' K bei 15 bis 25 °C (höchstens ' + fm(FACH.skalEng, 1) + ' K) und ' + fm(eWeit, 2) + ' K bei 0 bis 40 °C (höchstens ' + fm(FACH.skalWeit, 1) + ' K, A)' + (eEng > FACH.skalEng || eWeit > FACH.skalWeit ? ' – der Fühler ist nicht linear, mehr Stützstellen oder andere Verteilung' : '')), 30));
    const thr = isObj(d.thr) ? d.thr : {}, ku = numOf(thr.kurz), br = numOf(thr.bruch), cB = ok ? si.cBreak : NaN, e6 = [];
    if (!fin(ku)) e6.push('Kurzschlussschwelle fehlt'); else if (ku < 0 || (ok && ku >= c1)) e6.push('Kurzschlussschwelle ' + fm(ku, 0) + ' muss zwischen 0 und dem Zählwert bei −10 °C (' + (ok ? c1 : '?') + ') liegen');
    if (!fin(br)) e6.push('Bruchschwelle fehlt'); else if (ok && br <= c2) e6.push('Bruchschwelle ' + fm(br, 0) + ' muss über dem Zählwert bei +50 °C (' + c2 + ') liegen'); else if (ok && br > cB) e6.push('Bruchschwelle ' + fm(br, 0) + ' liegt über dem Zählwert bei Drahtbruch (' + cB + '), der Bruch würde nicht erkannt');
    lines.push(L(ok && e6.length === 0, 'Fehlerschwellen: ' + (e6.length ? e6[0] : 'Kurzschluss unter ' + fm(ku, 0) + ', Bruch über ' + fm(br, 0) + ' Digit (Drahtbruch zeigt ' + cB + ')') + (ok ? '' : ' (Messkette nicht berechenbar)'), 20));
    return lines;
  }
  function senSolution(ctx) {
    const P = P_(ctx), ctl = { sensor: 'pt1000', circuit: 'bruecke', rRef: 1000, gain: 10, adcBits: P.adcBits, vref: P.uRef, wires: P.wires, lead: rd(rLeitung(P), 3), selfHeat: true, tMeas: 20 };
    const data = { rig: 'temperatur', preset: '', ctl: ctl, state: {}, derived: {} }, si = senInfo(data);
    data.scale = { pts: [0, 10, 20, 30, 40].map(t => [si.codes[t], t]) }; data.thr = { kurz: 300, bruch: 1000 };
    data.state = { adc: si.codes[20], resolution: rd(si.res20, 4) }; data.derived = { aufloesung: rd(si.res20, 4), codeMin: si.codes[-10], codeMax: si.codes[50], codeBruch: si.cBreak };
    return data;
  }
  const senForm = (function () { const f = []; for (let i = 0; i < 5; i++) { f.push({ key: 'c' + i, label: 'Stützstelle ' + (i + 1) + ': Zählwert', type: 'number', unit: 'Digit' }); f.push({ key: 't' + i, label: 'Stützstelle ' + (i + 1) + ': Temperatur', type: 'number', unit: '°C' }); } f.push({ key: 'kurz', label: 'Schwelle Kurzschluss (Zählwert darunter)', type: 'number', unit: 'Digit' }); f.push({ key: 'bruch', label: 'Schwelle Fühlerbruch (Zählwert darüber)', type: 'number', unit: 'Digit' }); return f; })();

  /* ====================================================================== vh3: Fühler prüfen (Mess-Lab als Formularstation, Prüflingswerte im Lastenheft) */
  const MROWS = [['r0', 'Fühlerkopf im Eiswasser (0 °C)', 'Eiswasser'], ['rref', 'Fühlerkopf bei Referenztemperatur', 'Fühlerkopf'], ['rklemme', 'an der Reglerklemme', 'Klemme']];
  const rowOf = (rows, id) => rows.find(r => isObj(r) && r.id === id) || null;
  const rowNum = (r, k) => (r && fin(r[k]) && r[k] !== 0 ? r[k] : null);
  function checkMess(data, ctx) {
    const P = P_(ctx), tolM = TOL(ctx), lines = [], d = isObj(data) ? data : {}, rows = arr(d.rows), fs = fuehlerSoll(P), v = fs.vals;
    const wide = 0.05 * Math.max(1, tolM), pts1 = { r0: 8, rref: 8, rklemme: 9 }, pts2 = { r0: 7, rref: 7, rklemme: 6 }, pts3 = { r0: 6, rref: 6, rklemme: 7 };
    MROWS.forEach(m => { const c = cmpTxt('Soll ' + m[2], rowNum(rowOf(rows, m[0]), 'soll'), fs.soll[m[0]], wide, 'Ω', 2); lines.push(L(c.ok, 'Soll ' + m[2] + ' (' + m[1] + '): ' + c.t.replace(/^Soll [^:]*: /, ''), pts1[m[0]])); });
    MROWS.forEach(m => { const c = cmpTxt('Toleranz ' + m[2], rowNum(rowOf(rows, m[0]), 'tol'), fs.tol[m[0]], 0.05 * tolM * fs.tol[m[0]], 'Ω', 2); lines.push(L(c.ok, c.t + ' (Klassengrenze in K mal Steigung in Ω/K, nicht in Kelvin)', pts2[m[0]])); });
    const urt = (id, ist, soll, tol) => {
      const r = rowOf(rows, id), u = r && (r.urteil === 'io' || r.urteil === 'nio') ? r.urteil : '', right = fs.urteil[id];
      const dev = fin(ist) ? 'Abweichung ' + fm(ist - soll, 2) + ' Ω bei Toleranz ' + fm(tol, 2) + ' Ω' : 'Messwert OL, kein Wert';
      return { ok: u === right, t: u ? (u === right ? 'dein Urteil ' + (u === 'io' ? 'i. O.' : 'n. i. O.') + ' passt zu: ' + dev : 'dein Urteil ' + (u === 'io' ? 'i. O.' : 'n. i. O.') + ' passt nicht zu: ' + dev) : 'noch kein Urteil gewählt (' + dev + ')' };
    };
    MROWS.forEach(m => { const u = urt(m[0], v[m[0]], fs.soll[m[0]], fs.tol[m[0]]); lines.push(L(u.ok, 'Beurteilung ' + m[2] + ': ' + u.t, pts3[m[0]])); });
    const ri = rowOf(rows, 'riso'), ui = ri && (ri.urteil === 'io' || ri.urteil === 'nio') ? ri.urteil : '';
    lines.push(L(ui === fs.urteil.riso, 'Beurteilung Isolation: ' + (ui ? 'dein Urteil ' + (ui === 'io' ? 'i. O.' : 'n. i. O.') + (ui === fs.urteil.riso ? ' passt' : ' passt nicht') + ' zu ' + (v.riso >= 1 ? fm(v.riso, 0) : fm(v.riso, 2)) + ' MΩ gegen den Mindestwert ' + FACH.risoMin + ' MΩ bei 100 V (A)' : 'noch kein Urteil gewählt'), 6));
    const ids = arr(d.findings).filter(x => typeof x === 'string' && fuehlerById(x)), want = fkindOf(P), any = arr(d.findings).length > 0;
    const good = ids.length === 1 && ids[0] === want;
    lines.push(L(good, 'Fehler benannt: ' + (good ? fuehlerById(want).name : ids.length > 1 ? 'Diagnose stimmt nicht: nur ein Befund ist erlaubt' : any ? 'Diagnose stimmt nicht: der Befund passt nicht zu den Messwerten' : 'Diagnose fehlt, es ist noch kein Befund gewählt'), 20));
    const dt = d.values && fin(+d.values.dT) && d.values.dT !== null ? +d.values.dT : null, dtS = P.wires === 2 ? dT2L(P) : 0;
    const c = P.wires === 2 ? cmpTxt('Leitungsfehler der Zweileiterschaltung ΔT = 2 · R_L / (dR/dϑ)', dt, dtS, 0.05 * Math.max(1, tolM) * dtS, 'K', 3) : cmpTxt('Leitungsfehler (Dreileiter, wird ausgeglichen)', dt, 0, 0.02, 'K', 3);
    lines.push(L(c.ok, c.t, 10));
    return lines;
  }
  function messSolution(ctx) {
    const P = P_(ctx), fs = fuehlerSoll(P), v = fs.vals, rows = MROWS.map(m => ({ id: m[0], label: m[1], unit: 'Ω', soll: rd(fs.soll[m[0]], 2), ist: fin(v[m[0]]) ? v[m[0]] : null, tol: rd(fs.tol[m[0]], 2), instrument: 'Multimeter', urteil: fs.urteil[m[0]] }));
    rows.push({ id: 'riso', label: 'Isolation Fühler gegen Schutzrohr', unit: 'MΩ', soll: FACH.risoMin, ist: v.riso, tol: 0.01, instrument: 'Isolationsmessgerät 100 V', urteil: fs.urteil.riso });
    return { rows: rows, values: { dT: P.wires === 2 ? rd(dT2L(P), 3) : 0 }, findings: [fkindOf(P)] };
  }
  const formMess = [];
  MROWS.forEach(m => { formMess.push({ key: 's' + m[0], label: 'Soll ' + m[1], type: 'number', unit: 'Ω' }); formMess.push({ key: 't' + m[0], label: 'Toleranz ' + m[1], type: 'number', unit: 'Ω' }); formMess.push({ key: 'u' + m[0], label: 'Urteil ' + m[1], type: 'select', options: [{ value: 'io', label: 'in Ordnung (i. O.)' }, { value: 'nio', label: 'nicht in Ordnung (n. i. O.)' }] }); });
  formMess.push({ key: 'uriso', label: 'Urteil Isolation Fühler gegen Schutzrohr', type: 'select', options: [{ value: 'io', label: 'in Ordnung (i. O.)' }, { value: 'nio', label: 'nicht in Ordnung (n. i. O.)' }] });
  formMess.push({ key: 'dT', label: 'Leitungsfehler der Zweileiterschaltung (Dreileiter: 0)', type: 'number', unit: 'K' });
  formMess.push({ key: 'befund', label: 'Befund zum Fühler', type: 'select', options: FUEHLER.map(f => ({ value: f.id, label: f.name })) });

  /* ====================================================================== vh4: Strecke aufnehmen (Regelungs-Lab, Prüfstand raumtemp, Handbetrieb) */
  const RATIO_URTEIL = ['gut regelbar', 'noch regelbar', 'schwer regelbar'];
  function checkStr(data, ctx) {
    const P = P_(ctx), tolM = TOL(ctx), lines = [], d = isObj(data) ? data : {}, si = strInfo(d, P), ok = si.ok, eff = si.eff || {}, e1 = [];
    if (!isObj(d.ctl) || d.rig !== 'raumtemp') e1.push('keine Versuchsdaten des Prüfstands „Raumtemperatur“');
    else if (!si.hand) e1.push('der Versuch muss im Handbetrieb laufen (eingestellt: ' + (eff.mode == null ? 'nichts' : String(eff.mode)) + ')');
    else if (!fin(si.tS) || !fin(si.y2)) e1.push('es fehlt der Sprung der Handstellgröße');
    else if (Math.abs(si.y2 - si.y1 - 10) > 0.5) e1.push('der Sprung beträgt ' + fm(si.y2 - si.y1, 1) + ' %, verlangt sind +10 %');
    else if (!fin(si.y1) || Math.abs(si.y1 - y1Of(P)) > 3) e1.push('Anfangswert y1 = ' + (fin(si.y1) ? fm(si.y1, 0) : '?') + ' % weicht vom Lastenheft ab (' + y1Of(P) + ' %)');
    else if (!fin(+eff.tOut) || Math.abs(+eff.tOut - P.tOutSprung) > 0.5) e1.push('Außentemperatur ' + (fin(+eff.tOut) ? fm(+eff.tOut, 0) + ' °C' : 'fehlt') + ' statt ' + P.tOutSprung + ' °C laut Lastenheft');
    else if (+eff.z !== 0 && eff.z !== undefined || eff.window === true) e1.push('Fremdwärme und offenes Fenster müssen aus sein, sonst ist der Versuch gestört');
    lines.push(L(e1.length === 0, 'Versuch: ' + (e1[0] || 'Handbetrieb, Anfangswert ' + fm(si.y1, 0) + ' %, Sprung +10 % bei ' + fm(si.tS, 0) + ' s, ' + fm(+eff.tOut, 0) + ' °C Außentemperatur, keine Störung'), 15));
    let bh = false, bt = '';
    if (!ok) bt = 'nicht prüfbar (' + (si.errs[0] || '?') + ')';
    else if (!(si.T - si.tS >= 14400 - 1e-6)) bt = 'Aufzeichnung bricht vor der Beharrung ab: nach dem Sprung ' + fm((si.T - si.tS) / 3600, 1) + ' h, verlangt sind mindestens 4 h';
    else {
      const x = si.x, t = si.t, tEnd = t[t.length - 1]; let j = t.length - 1; while (j > 0 && t[j] > tEnd - 1800) j--;
      const tail = Math.abs(x[x.length - 1] - x[j]), dx = Math.abs(si.fs.xEnd - si.fs.x0);
      bh = tail < 0.02 * dx; bt = 'Aufzeichnung ' + fm((si.T - si.tS) / 3600, 1) + ' h nach dem Sprung, in den letzten 30 min ändert sich ' + fm(tail, 3) + ' K' + (bh ? ' (unter 2 % von ' + fm(dx, 2) + ' K)' : ' – das ist noch nicht eingeschwungen (höchstens 2 % von ' + fm(dx, 2) + ' K)');
    }
    lines.push(L(bh, 'Beharrung: ' + bt, 15));
    const ks = d.ks === null || d.ks === '' ? null : numOf(d.ks), un = d.ksEinheit, tolR = 0.10 * tolM;
    let kt, kok = false;
    if (!ok) kt = 'nicht prüfbar';
    else if (ks === null || d.ks === undefined) kt = 'K_s fehlt';
    else if (!fin(ks)) kt = 'K_s ist keine gültige Zahl';
    else if (un !== 'K/%' && un !== '%/%') kt = 'die Einheit von K_s fehlt (K/% oder %/%)';
    else {
      const exp = un === '%/%' ? si.KsNorm : si.Ks, other = un === '%/%' ? si.Ks : si.KsNorm, c = cmpTxt('K_s', ks, exp, tolR * exp, un, 4);
      kok = c.ok; kt = !c.ok && pcOk(ks, other, tolR) ? 'Zahlenwert ' + fm(ks, 4) + ' passt zur anderen Einheit (' + (un === '%/%' ? 'K/%' : '%/%') + '), nicht zu ' + un + ' (K_s in K/% mal 100/20 ergibt %/%)' : c.t.replace(/^K_s: /, '');
    }
    lines.push(L(kok, 'K_s (Verstärkung der Strecke): ' + kt, 25));
    [['tu', 'T_u (Verzugszeit)', si.Tu, 20], ['tg', 'T_g (Ausgleichszeit)', si.Tg, 20]].forEach(q => {
      const x = d[q[0]] === null || d[q[0]] === '' ? null : numOf(d[q[0]]), c = ok ? cmpTxt(q[1], x, q[2], tolR * q[2], 's', 1) : { ok: false, t: q[1] + ': nicht prüfbar' };
      lines.push(L(c.ok, c.t + (!c.ok && ok && q[0] === 'tu' && fin(x) && pcOk(x, si.Tg, tolR) ? ' – das ist die Ausgleichszeit, nicht die Verzugszeit' : '') + (!c.ok && ok && q[0] === 'tg' && fin(x) && pcOk(x, si.Tu, tolR) ? ' – das ist die Verzugszeit, nicht die Ausgleichszeit' : ''), q[3]));
    });
    const rt = d.tgtu === null || d.tgtu === '' ? null : numOf(d.tgtu), ur = d.urteil;
    const rOk = ok && fin(rt) && pcOk(rt, si.ratio, 0.2 * tolM) && ur === si.urteil;
    lines.push(L(rOk, 'Regelbarkeit T_g / T_u: ' + (!ok ? 'nicht prüfbar' : !fin(rt) ? 'Verhältnis fehlt' : !pcOk(rt, si.ratio, 0.2 * tolM) ? 'dein Verhältnis ' + fm(rt, 2) + ' weicht von ' + fm(si.ratio, 2) + ' ab' : RATIO_URTEIL.indexOf(ur) < 0 ? 'Urteil fehlt (gut, noch oder schwer regelbar)' : ur !== si.urteil ? 'Verhältnis ' + fm(si.ratio, 2) + ' ergibt „' + si.urteil + '“ (über 10 gut, ab 3 noch, darunter schwer), nicht „' + ur + '“' : 'Verhältnis ' + fm(si.ratio, 2) + ', „' + ur + '“'), 5));
    return lines;
  }
  function strSolution(ctx) {
    const P = P_(ctx), y1 = y1Of(P);
    const data = { lab: 'reg', rig: 'raumtemp', ctl: { mode: 'hand', yHand: y1, tOut: P.tOutSprung, z: 0, window: false, noise: 0, ymax: 100 }, seq: [{ t: 1800, set: { yHand: y1 + 10 } }], op: { y: y1 }, T: 21600, state: {}, derived: {} };
    const si = strInfo(data, P);
    Object.assign(data, { ks: rd(si.Ks, 4), ksEinheit: 'K/%', tu: rd(si.Tu, 1), tg: rd(si.Tg, 1), tgtu: rd(si.ratio, 2), urteil: si.urteil });
    data.state = { x: rd(si.x[si.x.length - 1], 3), y: y1 + 10 }; data.derived = { ks: rd(si.Ks, 4), tu: rd(si.Tu, 1), tg: rd(si.Tg, 1) };
    return data;
  }

  /* ====================================================================== vh5: Regler einstellen (Regelungs-Lab, Prüfstand raumtemp, Automatik) */
  const musterGuete = (P, regel, sd) => { const rule = ruleOf(regel, sd); return rule ? guete(P, musterCtl(regel, rule)) : { ok: false }; };
  function checkReg(data, ctx) {
    const P = P_(ctx), tolM = TOL(ctx), lines = [], d = isObj(data) ? data : {}, sd = strInfo(need(ctx, 'heizung.strecke'), P);
    if (!sd.ok) return [L(false, 'Die Streckenstation (Station 4) fehlt oder ist unbrauchbar, die Einstellregel lässt sich nicht rechnen (' + (sd.errs[0] || '?') + ')', 100)];
    if (!isObj(d.ctl) || d.rig !== 'raumtemp') return [L(false, 'Keine Reglerdaten des Prüfstands „Raumtemperatur“ übergeben', 100)];
    const ctl = d.ctl, regel = typeof d.regel === 'string' && d.regel ? d.regel : (LEVEL(ctx) === 1 ? 'chr-stoer-0' : ''), known = !!REGELN[regel], rule = known ? ruleOf(regel, sd) : null;
    let e1 = '';
    if (!regel) e1 = 'wähle die Einstellregel (chr-stoer-0 oder chr-fuehr-0)';
    else if (!known) e1 = 'die Regel „' + regel + '“ ist hier nicht zugelassen (zulässig: chr-stoer-0, chr-fuehr-0)';
    else if (!rule) e1 = 'die Regel lässt sich mit deinen Kennwerten nicht rechnen';
    else if (ctl.ctrl !== 'PI') e1 = 'verlangt ist ein PI-Regler (eingestellt: ' + (ctl.ctrl == null ? 'nichts' : String(ctl.ctrl)) + ')';
    else {
      const kp = numOf(ctl.kp), tn = numOf(ctl.tn), tl = FACH.regelTol * tolM, ck = cmpTxt('K_p', kp, rule.Kp, tl * rule.Kp, '', 2), ct = cmpTxt('T_n', tn, rule.Tn, tl * rule.Tn, 's', 0);
      if (!ck.ok) e1 = ck.t + ' nach ' + regel + ' mit deinen Kennwerten'; else if (!ct.ok) e1 = ct.t + ' nach ' + regel + ' mit deinen Kennwerten';
    }
    lines.push(L(!e1, 'Einstellregel: ' + (e1 || regel + ' mit K_p ' + fm(numOf(ctl.kp), 2) + ' und T_n ' + fm(numOf(ctl.tn), 0) + ' s (Sollwerte ' + fm(rule.Kp, 2) + ' und ' + fm(rule.Tn, 0) + ' s, ±' + fm(FACH.regelTol * tolM * 100, 0) + ' %)'), 25));
    const g = guete(P, ctl), M = musterGuete(P, known ? regel : 'chr-stoer-0', sd);
    if (!g.ok || !M.ok) { lines.push(L(false, 'Regelgüte: der Prüflauf im Prüfstand ist nicht möglich (Reglerwerte ungültig?)', 75)); return lines; }
    lines.push(L(g.ebl <= FACH.ebl, 'Bleibende Regeldifferenz am Ende des Sprungabschnitts: ' + fm(g.ebl, 3) + ' K (höchstens ' + fm(FACH.ebl, 1) + ' K, A)', 15));
    lines.push(L(g.over <= FACH.ueber, 'Überschwingen beim Sprung um ' + P.dw + ' K (Ende der Nachtabsenkung): ' + fm(g.over, 2) + ' K, höchstens ' + fm(FACH.ueber, 1) + ' K (A)' + (g.over > FACH.ueber ? ' – zu viel: Sollwertrampe oder Regel für Führungsverhalten' : ''), 20));
    const tA = fin(g.tAus) && g.tAus <= FACH.reserve * M.tAus;
    lines.push(L(tA, 'Ausregelzeit (Band ±' + fm(FACH.band, 1) + ' K): ' + (fin(g.tAus) ? fm(g.tAus, 0) + ' s' : 'nicht ausgeregelt') + ', höchstens ' + fm(FACH.reserve, 2) + ' · ' + fm(M.tAus, 0) + ' s (Muster derselben Regel)', 20));
    const fOk = fin(g.xd) && g.xd <= FACH.reserve * M.xd && fin(g.tAusF) && g.tAusF <= FACH.reserve * M.tAusF;
    lines.push(L(fOk, 'Störung Fenster 10 min: größte Abweichung ' + fm(g.xd, 2) + ' K (höchstens ' + fm(FACH.reserve * M.xd, 2) + ' K), Ausregelzeit ' + (fin(g.tAusF) ? fm(g.tAusF, 0) + ' s' : 'nicht ausgeregelt') + ' (höchstens ' + fm(FACH.reserve * M.tAusF, 0) + ' s)', 20));
    return lines;
  }
  function regSolution(ctx) {
    const P = P_(ctx), sd = strInfo(need(ctx, 'heizung.strecke'), P), regel = 'chr-stoer-0', rule = sd.ok ? ruleOf(regel, sd) : null;
    const mc = rule ? musterCtl(regel, rule) : { ctrl: 'PI', kp: 3.578, tn: 1153.1, aw: 'rueck', wRamp: 0.005, ymax: 100 };
    const w0 = FACH.wNutz - P.dw, tS = 3600, tW = tS + 5 * 3600;
    const ctl = Object.assign({ mode: 'auto' }, mc, { w: w0, tOut: P.tOutSprung, z: 0, window: false, noise: 0 });
    const seq = [{ t: tS, set: { w: FACH.wNutz } }, { t: tW, set: { window: true } }, { t: tW + 600, set: { window: false } }];
    const g = guete(P, mc);
    return { lab: 'reg', rig: 'raumtemp', ctl: ctl, seq: seq, op: { y: rd(clamp((w0 - P.tOutSprung) / 30 * 100, 0, 100), 2) }, T: tW + 3 * 3600, regel: regel, state: {}, derived: g.ok ? { ueberschwingen: rd(g.over, 3), tAus: rd(g.tAus, 0), xFenster: rd(g.xd, 3) } : {} };
  }

  /* ====================================================================== vh6: Stellglied für 3 kW (Datenblatt-Lab als Formularstation, Katalog FACH) */
  const itemId = (d, role) => { const it = arr(d && d.items).find(i => isObj(i) && i.role === role), m = it && typeof it.ds === 'string' ? /^fach:(?:kk-)?(.+)$/.exec(it.ds) : null; return m ? m[1] : ''; };
  function stellCalc(st, kkId, P) {
    const T = THM(), ta = T && T.const && fin(T.const.TA_GERAET) ? T.const.TA_GERAET : 40, iB = P.pHeiz / FACH.uNetz, o = { ta: ta, iB: iB, tjLim: st ? (st.tjMax || 0) - FACH.tjReserve : NaN };
    if (!st || st.mech) return o;
    o.pV = st.uT != null ? st.uT * iB : st.uT0 * iB + st.rT * iB * iB;
    o.rthCK = st.rthCK != null ? st.rthCK : (T && T.mount && T.mount.rthCK ? T.mount.rthCK(st.pkg || 'TO-220', 'glimmer', 'duenn', 'fest') : NaN);
    const hs = T && arr(T.heatsinks).find(h => h.id === kkId); o.rthK = hs ? hs.rthK : NaN;
    o.tj = ta + o.pV * (st.rthJC + o.rthCK + o.rthK);
    return o;
  }
  function checkStell(data, ctx) {
    const P = P_(ctx), tolM = TOL(ctx), lines = [], d = isObj(data) ? data : {}, st = stellById(itemId(d, 'stellglied')), kk = itemId(d, 'kuehlkoerper'), sc = stellCalc(st, kk, P), calc = isObj(d.calc) ? d.calc : {};
    const iMin = FACH.stellI * sc.iB, uMin = FACH.stellU * FACH.uNetz * Math.SQRT2 * 1.1;
    lines.push(L(!!st && st.iN >= iMin, 'Strom: ' + (!st ? 'kein Stellglied gewählt' : 'I_N ' + fm(st.iN, 0) + ' A, nötig mindestens ' + fm(FACH.stellI, 1) + ' · I_B = ' + fm(iMin, 1) + ' A (I_B = ' + fm(sc.iB, 2) + ' A)' + (st.iN < iMin ? ' – zu klein' : '')) + ' (A)', 25));
    lines.push(L(!!st && (st.mech || st.uDRM >= uMin), 'Sperrspannung: ' + (!st ? 'kein Stellglied gewählt' : st.mech ? 'mechanische Kontakte, keine Halbleiter-Sperrspannung' : 'U_DRM ' + fm(st.uDRM, 0) + ' V, nötig mindestens ' + fm(FACH.stellU, 1) + ' · 230 V · √2 · 1,1 = ' + fm(uMin, 0) + ' V' + (st.uDRM < uMin ? ' – zu klein' : '')) + ' (A)', 20));
    lines.push(L(!!st && st.nullsp === true, 'Schaltverhalten: ' + (!st ? 'kein Stellglied gewählt' : st.nullsp === true ? 'Nullspannungsschalter, zeitproportionaler Betrieb ohne Netzstörung' : st.mech ? 'ein mechanischer Schalter verschleißt im Takt der Zeitproportional-Regelung (' + FACH.tP + ' s)' : 'Sofortschaltung: schaltet mitten in der Netzspannung, verlangt ist der Nullspannungsschalter für die ohmsche Last') + ' (A)', 15));
    let kt, kOk = false;
    if (!st) kt = 'kein Stellglied gewählt';
    else if (st.mech) { kt = 'keine Halbleiterverluste, kein Kühlkörper nötig'; kOk = true; }
    else if (!fin(sc.rthK)) kt = 'kein Kühlkörper aus dem Katalog gewählt (s, m, l, xl)';
    else {
      const stj = calc.tjC === null || calc.tjC === undefined || calc.tjC === '' ? NaN : numOf(calc.tjC), tt = Math.max(4, 0.08 * sc.tj) * tolM, mine = fin(stj);
      kOk = sc.tj <= sc.tjLim && mine && Math.abs(stj - sc.tj) <= tt;
      kt = 'T_j = ' + fm(sc.ta, 0) + ' °C + ' + fm(sc.pV, 1) + ' W · (' + fm(st.rthJC, 1) + ' + ' + fm(sc.rthCK, 1) + ' + ' + fm(sc.rthK, 1) + ') K/W = ' + fm(sc.tj, 0) + ' °C, höchstens ' + fm(sc.tjLim, 0) + ' °C (T_jmax − ' + FACH.tjReserve + ' K, T_a im Verteiler aus dem Thermik-Lab)' + (sc.tj > sc.tjLim ? ' – zu heiß: größerer Kühlkörper' : !mine ? ' – deine Rechnung fehlt' : Math.abs(stj - sc.tj) > tt ? ' – deine Rechnung ' + fm(stj, 0) + ' °C weicht ab' : '');
    }
    lines.push(L(kOk, 'Kühlung: ' + kt, 25));
    const ctlOk = !!st && Array.isArray(st.uCtl) && st.uCtl[0] <= 5 && st.uCtl[1] >= 5;
    lines.push(L(ctlOk, 'Ansteuerung: ' + (!st ? 'kein Stellglied gewählt' : ctlOk ? 'Steuereingang ' + st.uCtl[0] + ' bis ' + st.uCtl[1] + ' V DC, der 5-V-Pin des Arduino genügt' : 'der 5-V-Pin des Arduino steuert dieses Bauteil nicht direkt an (Treiber oder Optokoppler nötig)') + ' (A)', 15));
    return lines;
  }
  function stellSolution(ctx) {
    const P = P_(ctx), sc = stellCalc(stellById('ssr-25'), 'xl', P);
    return { items: [{ role: 'stellglied', ds: 'fach:ssr-25', part: 'SSR-25' }, { role: 'kuehlkoerper', ds: 'fach:kk-xl', part: 'KK-xl' }], calc: { tjC: rd(sc.tj, 1), pVerlW: rd(sc.pV, 2) }, vals: {} };
  }

  /* ====================================================================== vh7: Raumregler-Sketch (Arduino-Lab), Prüfung im geschlossenen Kreis mit dem Wochenmodell (h = 1 s) */
  const FMT = /^T=-?\d+(?:\.\d+)?;W=-?\d+(?:\.\d+)?;Y=-?\d+(?:\.\d+)?;ERR=\d+$/;
  const wCode = w => clamp(Math.round((w - 10) / 20 * 1023), 0, 1023);
  const median = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
  function reglerCfg(P, ctx) {                    // Reglerwerte des Azubis (Station 5), sonst die Musterwerte der gewählten Regel
    const reg = need(ctx, 'heizung.regler'), sd = strInfo(need(ctx, 'heizung.strecke'), P), r = reg && isObj(reg.ctl) ? reg.ctl : null;
    const regel = reg && typeof reg.regel === 'string' && REGELN[reg.regel] ? reg.regel : 'chr-stoer-0', rule = sd.ok ? ruleOf(regel, sd) : null;
    const own = r && fin(numOf(r.kp)) && fin(numOf(r.tn)) ? { ctrl: r.ctrl === 'P' ? 'P' : 'PI', kp: numOf(r.kp), tn: numOf(r.tn), aw: r.aw || 'rueck', wRamp: fin(numOf(r.wRamp)) ? numOf(r.wRamp) : 0, ymax: fin(numOf(r.ymax)) ? numOf(r.ymax) : 100, u0: fin(numOf(r.u0)) ? numOf(r.u0) : 0 } : null;
    return { regel: regel, rule: rule, sd: sd, cfg: own || (rule ? musterCtl(regel, rule) : null), own: !!own };
  }
  function sketchSource(c) {                      // Muster: Messkette (Stützstellen), PI mit Rückrechnung, Sollwertrampe, Fühlerfehler -> sicher aus
    const n = c.pts.length;
    return ['const int N = ' + n + ';', 'const int CODE[' + n + '] = {' + c.pts.map(p => p[0]).join(', ') + '};', 'const float TC[' + n + '] = {' + c.pts.map(p => fm(p[1], 1).replace(',', '.')).join(', ') + '};',
      'const float KP = ' + rd(c.kp, 4) + ', TN = ' + rd(c.tn, 2) + ', TA = 10.0;', 'const float RAMP = ' + rd(c.rampK, 5) + ';', 'const int KURZ = ' + Math.round(c.kurz) + ', BRUCH = ' + Math.round(c.bruch) + ';',
      'float yi = 0.0, y = 0.0, yu = 0.0, ws = -1.0;', 'unsigned long last = 0;',
      'float tempOf(int c) {', '  for (int i = 1; i < N; i++) {', '    if (c <= CODE[i] || i == N - 1) { return TC[i - 1] + (c - CODE[i - 1]) * (TC[i] - TC[i - 1]) / (CODE[i] - CODE[i - 1]); }', '  }', '  return 0.0;', '}',
      'void setup() { Serial.begin(9600); pinMode(9, OUTPUT); }', 'void loop() {', '  if (millis() - last >= 10000UL) {', '    last += 10000UL;', '    int a0 = analogRead(A0);', '    int err = 0;', '    if (a0 > BRUCH) { err = 1; }', '    if (a0 < KURZ) { err = 2; }',
      '    float T = tempOf(a0);', '    float W = 10.0 + analogRead(A1) * 20.0 / 1023.0;', '    if (ws < 0.0) { ws = W; }', '    float st = RAMP * TA;', '    if (RAMP > 0.0 && W > ws + st) { ws = ws + st; } else if (RAMP > 0.0 && W < ws - st) { ws = ws - st; } else { ws = W; }',
      '    if (err > 0) { y = 0.0; yi = 0.0; yu = 0.0; }', '    else {', '      float e = (ws - T) * 100.0 / 20.0;', '      yi = yi + KP * TA / TN * e + TA / TN * (y - yu);', '      yu = KP * e + yi;', '      y = yu;', '      if (y > 100.0) { y = 100.0; }', '      if (y < 0.0) { y = 0.0; }', '    }',
      '    analogWrite(9, (int)(y * 2.55));', '    Serial.print("T="); Serial.print(T, 2); Serial.print(";W="); Serial.print(ws, 1); Serial.print(";Y="); Serial.print(y, 1); Serial.print(";ERR="); Serial.println(err);', '  }', '}'].join('\n');
  }
  const FRAME = ['const float TA = 10.0;', 'unsigned long last = 0;', 'void setup() { Serial.begin(9600); pinMode(9, OUTPUT); }', 'void loop() {', '  if (millis() - last >= 10000UL) {', '    last += 10000UL;', '    int a0 = analogRead(A0);          // Raumfühler in Digit', '    float T = 0.0;                    // hier: Skalierung aus Station 2 in °C', '    float W = 10.0 + analogRead(A1) * 20.0 / 1023.0;   // Sollwert', '    float Y = 0.0;                    // hier: PI-Regler mit Anti-Windup, 0 bis 100 %', '    int err = 0;                      // hier: Fühlerbruch 1, Kurzschluss 2', '    analogWrite(9, (int)(Y * 2.55));', '    Serial.print("T="); Serial.print(T, 2); Serial.print(";W="); Serial.print(W, 1); Serial.print(";Y="); Serial.print(Y, 1); Serial.print(";ERR="); Serial.println(err);', '  }', '}'].join('\n');
  const clCache = new Map();
  /* Lauf im geschlossenen Kreis: sc = { key, x0, tOut, wFn(t) in °C, tEnd, win(t), a0(t) (Überschreibung in Digit), si } */
  function clRun(src, sc) {
    return memo(clCache, sig([src, sc.key]), () => {
      const R = runners(); if (!R) return { ok: false, error: 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen.' };
      const sim = makeSim(1, sc.tOut, sc.x0), rows = []; let a0 = clamp(codeAt(sc.si, sc.x0), 0, 1023);
      const r = R.runSketch(src, { T: sc.tEnd, dt: 1, analog: { A0: () => a0, A1: t => wCode(sc.wFn(t)) }, onStep: (t, io) => {
        const du = io.dutyNow(9), yy = du != null ? du / 255 * 100 : io.level(9) * 100;
        sim.step(yy, sc.tOut, sc.win ? sc.win(t) : false);
        const ov = sc.a0 ? sc.a0(t) : null; a0 = ov != null ? ov : clamp(codeAt(sc.si, sim.xm), 0, 1023);
        if (t % 10 === 0) rows.push({ t: t, x: sim.xRoom, y: yy });
      } });
      const times = []; if (r.io && r.io.serialEvents) r.io.serialEvents.forEach(e => { if (/\n/.test(e.s)) times.push(e.t); });
      return { ok: r.ok, error: r.error, phase: r.phase, lines: r.lines || [], times: times, rows: rows };
    });
  }
  const kvLine = l => { const m = /^T=(-?[\d.]+);W=(-?[\d.]+);Y=(-?[\d.]+);ERR=(\d+)$/.exec(String(l)); return m ? { T: +m[1], W: +m[2], Y: +m[3], err: +m[4] } : null; };
  const scenA = (P, si) => ({ key: 'A' + P.tOutSprung + '|' + sig(si.codes), x0: 10, tOut: P.tOutSprung, wFn: () => FACH.wNutz, tEnd: 10800, si: si });            // Kaltstart, Sollwert 20 °C
  const scenB = (P, si) => ({ key: 'B' + P.tOutSprung + '|' + P.dw + '|' + sig(si.codes), x0: FACH.wNutz - P.dw, tOut: P.tOutSprung, wFn: t => (t < 3600 ? FACH.wNutz - P.dw : FACH.wNutz), win: t => t >= 21600 && t < 22200, tEnd: 32400, si: si });   // Ende der Absenkung, Fenster
  const scenC = (P, si) => ({ key: 'C' + P.tBruch + '|' + sig(si.codes), x0: FACH.wNutz, tOut: P.tOutSprung, wFn: () => FACH.wNutz, tEnd: P.tBruch + 1920, si: si,
    a0: t => (t >= P.tBruch && t < P.tBruch + 1200 ? si.cBreak : t >= P.tBruch + 1200 && t < P.tBruch + 1800 ? 0 : null) });                                  // Fühlerbruch, danach Kurzschluss
  function sketchCtx(P, ctx) {
    const sen = need(ctx, 'heizung.sen'), si = senInfo(sen), pts = scalePts(sen), thr = sen && isObj(sen.thr) ? sen.thr : null, rc = reglerCfg(P, ctx);
    const ok = si.ok && !!pts && !!thr && fin(numOf(thr.kurz)) && fin(numOf(thr.bruch)) && !!rc.rule && !!rc.cfg && rc.sd.ok;
    return { ok: ok, si: si, pts: pts, thr: thr, rc: rc, M: ok ? musterGuete(P, rc.regel, rc.sd) : null };
  }
  const refSketch = c => sketchSource({ pts: c.pts, kp: c.rc.rule.Kp, tn: c.rc.rule.Tn, rampK: musterCtl(c.rc.regel, c.rc.rule).wRamp * 0.2, kurz: numOf(c.thr.kurz), bruch: numOf(c.thr.bruch) });
  function fensterOf(rows, tW) { const d = rows.filter(q => q.t >= tW); let dm = null; try { dm = REG().disturbMetrics(d.map(q => q.t), d.map(q => q.x), { w: FACH.wNutz, tz: tW, band: FACH.band, range: RP().hi - RP().lo, unit: 'K' }); } catch (e) { dm = null; } return { xd: dm && fin(dm.xdMax) ? Math.abs(dm.xdMax) : NaN, tAusF: dm && fin(dm.tAus) ? dm.tAus : NaN }; }
  /* Fühlerfehler (Szenario C): ERR=1 spätestens 2 · T_a nach dem Bruch, ERR=2 im Kurzschluss, Y = 0 ab dem Fehler, kein Fehlalarm davor */
  function bruchEval(P, run) {
    const kv = run.lines.map(kvLine), tm = run.times, tB = P.tBruch, o = { ok: false, text: '' };
    if (!run.ok || kv.length < 5 || kv.some(x => !x) || tm.length !== kv.length) { o.text = 'der Lauf liefert keine auswertbaren Zeilen (' + (run.error || 'Zeilenformat') + ')'; return o; }
    const ta = median(tm.slice(1).map((t, i) => t - tm[i])), at = (i, k) => kv[i][k];
    if (!(ta > 0)) { o.text = 'die Abtastzeit ist nicht erkennbar'; return o; }
    const idx = (a, b) => kv.map((x, i) => i).filter(i => tm[i] >= a && tm[i] < b);
    const pre = idx(0, tB).filter(i => at(i, 'err') !== 0);
    const f1 = idx(tB, tB + 1200).find(i => at(i, 'err') === FACH.errBruch);
    const f2 = idx(tB + 1200, tB + 1800).find(i => at(i, 'err') === FACH.errKurz);
    const hold1 = idx(tB + 2 * ta + 1e-6, tB + 1200).every(i => at(i, 'err') === FACH.errBruch), hold2 = idx(tB + 1200 + 2 * ta + 1e-6, tB + 1800).every(i => at(i, 'err') === FACH.errKurz);
    const yz = idx(tB, tB + 1800).every(i => at(i, 'err') === 0 || Math.abs(at(i, 'Y') - FACH.ySicher) <= 0.05);
    if (pre.length) o.text = 'ERR ist schon vor dem Fühlerfehler ungleich null (Fehlalarm)';
    else if (f1 === undefined || tm[f1] - tB > 2 * ta + 1e-6) o.text = 'der Fühlerbruch (Zählwert über der Schwelle) wird nicht innerhalb von 2 · T_a mit ERR=' + FACH.errBruch + ' gemeldet';
    else if (!hold1) o.text = 'ERR=' + FACH.errBruch + ' bleibt beim Fühlerbruch nicht stehen';
    else if (f2 === undefined || tm[f2] - (tB + 1200) > 2 * ta + 1e-6) o.text = 'der Fühlerkurzschluss (Zählwert unter der Schwelle) wird nicht innerhalb von 2 · T_a mit ERR=' + FACH.errKurz + ' gemeldet';
    else if (!hold2) o.text = 'ERR=' + FACH.errKurz + ' bleibt beim Fühlerkurzschluss nicht stehen';
    else if (!yz) o.text = 'bei einem Fühlerfehler bleibt Y nicht bei ' + FACH.ySicher + ' % (sichere Stellung: Heizung aus, A)';
    else { o.ok = true; o.text = 'ERR=' + FACH.errBruch + ' nach ' + fm(tm[f1] - tB, 0) + ' s beim Bruch, ERR=' + FACH.errKurz + ' nach ' + fm(tm[f2] - tB - 1200, 0) + ' s beim Kurzschluss, Y bleibt bei ' + FACH.ySicher + ' %'; }
    return o;
  }
  /* ausgegebenes T bei drei festen Zählwerten gegen die Skalierung der Messkette (±0,1 K) */
  function skalEval(src, c) {
    const R = runners(), out = [];
    [10, 20, 30].forEach(t => {
      const cd = c.si.codes[t], r = memo(clCache, sig([src, 'S', cd]), () => { const q = R.runSketch(src, { T: 130, dt: 1, analog: { A0: cd, A1: wCode(FACH.wNutz) } }); return { ok: q.ok, lines: q.lines || [] }; });
      const kv = r.ok && r.lines.length ? kvLine(r.lines[r.lines.length - 1]) : null, want = skal(c.pts, cd);
      out.push({ t: t, code: cd, got: kv ? kv.T : NaN, want: want, ok: !!kv && Math.abs(kv.T - want) <= 0.1 });
    });
    return out;
  }
  function checkCode(data, ctx) {
    const R = runners(), src = String(isObj(data) && typeof data.src === 'string' ? data.src : ''), P = P_(ctx);
    if (!R) return [L(false, 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen', 100)];
    const c = sketchCtx(P, ctx);
    if (!c.ok) return [L(false, 'Messkette (Station 2), Strecke (Station 4) oder Regler (Station 5) fehlen oder sind unbrauchbar, der Sketch lässt sich nicht im geschlossenen Kreis prüfen', 100)];
    const comp = R.runSketch(src, { T: 1, dt: 1 });
    if (comp.phase === 'compile') return [L(false, 'Zeilenformat: Der Sketch lässt sich nicht übersetzen – ' + comp.error, 10), L(false, 'Abtastzeit: nicht prüfbar', 10), L(false, 'Regelgüte: nicht prüfbar', 35), L(false, 'Anti-Windup: nicht prüfbar', 15), L(false, 'Fühlerausfall: nicht prüfbar', 20), L(false, 'Skalierung: nicht prüfbar', 10)];
    const lines = [], a = clRun(src, scenA(P, c.si)), b = clRun(src, scenB(P, c.si)), cc = clRun(src, scenC(P, c.si));
    const bad = a.lines.find(x => !FMT.test(String(x)));
    lines.push(L(a.ok && a.lines.length >= 5 && !bad, 'Zeilenformat T=..;W=..;Y=..;ERR=.. (Zahlen mit Punkt): ' + (!a.ok ? 'Laufzeitfehler – ' + a.error : a.lines.length < 5 ? 'zu wenig Ausgabe (' + a.lines.length + ' Zeilen)' : bad ? 'falsche Zeile „' + String(bad).slice(0, 40) + '“' : a.lines.length + ' Zeilen im richtigen Format'), 10));
    const dif = a.times.slice(1).map((t, i) => t - a.times[i]), ta = median(dif), jit = Math.max(0.01 * ta, 2.5);   // der Läufer rechnet in Schritten von 1 s und je 300 Operationen einen Schritt: ±2 s Zeitrauschen
    const taOk = a.ok && dif.length >= 24 && ta >= 1 && ta <= 60 && dif.every(x => Math.abs(x - ta) <= jit) && Math.abs(median(dif.slice(-12)) - median(dif.slice(0, 12))) <= 0.02 * ta;
    lines.push(L(taOk, 'Abtastzeit: ' + (dif.length < 24 ? 'zu wenig Ausgabe' : 'Zeilenabstand ' + fm(ta, 1) + ' s' + (taOk ? ', konstant (1 bis 60 s)' : ta < 1 || ta > 60 ? ', verlangt sind 1 bis 60 s' : ', nicht konstant (Abweichung höchstens ±' + fm(jit, 1) + ' s, kein Wandern): millis() statt delay() nutzen')), 10));
    const mB = fensterOf(b.rows, 21600), xs = b.rows.filter(q => q.t >= 3600 && q.t < 21600).map(q => q.x), over = xs.length ? Math.max(0, Math.max.apply(null, xs) - FACH.wNutz) : NaN, M = c.M;
    const gOk = b.ok && fin(over) && over <= FACH.sketchTol * M.over + 0.1 && fin(mB.xd) && mB.xd <= FACH.sketchTol * M.xd && fin(mB.tAusF) && mB.tAusF <= FACH.sketchTol * M.tAusF;
    lines.push(L(gOk, 'Regelgüte (Ende der Absenkung, Fenster 10 min, höchstens ' + fm(FACH.sketchTol, 1) + ' · Muster derselben Regel): ' + (!b.ok ? 'Laufzeitfehler – ' + b.error : 'Überschwingen ' + fm(over, 2) + ' K (Grenze ' + fm(FACH.sketchTol * M.over + 0.1, 2) + ' K), größte Abweichung am Fenster ' + fm(mB.xd, 2) + ' K (Grenze ' + fm(FACH.sketchTol * M.xd, 2) + ' K), Ausregelzeit ' + (fin(mB.tAusF) ? fm(mB.tAusF, 0) + ' s' : 'nicht ausgeregelt') + ' (Grenze ' + fm(FACH.sketchTol * M.tAusF, 0) + ' s)'), 35));
    const ar = clRun(refSketch(c), scenA(P, c.si)), ovA = a.rows.length ? Math.max(0, Math.max.apply(null, a.rows.map(q => q.x)) - FACH.wNutz) : NaN, ovR = ar.rows.length ? Math.max(0, Math.max.apply(null, ar.rows.map(q => q.x)) - FACH.wNutz) : NaN;
    lines.push(L(a.ok && fin(ovA) && ovA <= ovR + FACH.kaltstart, 'Anti-Windup (Kaltstart bei 10 °C, Sollwert 20 °C): Überschwingen ' + fm(ovA, 2) + ' K, höchstens ' + fm(ovR + FACH.kaltstart, 2) + ' K (Muster ' + fm(ovR, 2) + ' K + ' + fm(FACH.kaltstart, 1) + ' K, A)' + (fin(ovA) && ovA > ovR + FACH.kaltstart ? ' – der I-Anteil läuft weg, bei Sättigung anhalten oder zurückrechnen' : ''), 15));
    const be = bruchEval(P, cc);
    lines.push(L(be.ok, 'Fühlerausfall: ' + be.text, 20));
    const sk = skalEval(src, c), skOk = sk.every(x => x.ok);
    lines.push(L(skOk, 'Skalierung: ' + sk.map(x => 'Zählwert ' + x.code + ' → ' + (fin(x.got) ? fm(x.got, 2) : 'keine Ausgabe') + ' °C (Messkette ' + fm(x.want, 2) + ' °C)').join(', ') + (skOk ? '' : ' – ±0,1 K zur Skalierung aus Station 2 verlangt'), 10));
    return lines;
  }
  function codeSolution(ctx) {
    const P = P_(ctx), c = sketchCtx(P, ctx), src = c.ok ? refSketch(c) : FRAME;
    const serial = c.ok ? (clRun(src, { key: 'P' + sig(c.si.codes), x0: 20, tOut: P.tOutSprung, wFn: () => FACH.wNutz, tEnd: 1500, si: c.si }).lines || []).slice(0, 124) : [];
    return { lang: 'arduino', src: src, run: { serial: serial, events: [] } };
  }

  /* ====================================================================== vh8: Wochenprotokoll in Python (Pi-Lab) */
  const PY_HEAD = ['daten = []', 'daten_ref = []', 'DT_S = 600', 'T_SOLL = 20.0', 'BAND_K = 0.5', 'NUTZ_VON_H = 7', 'NUTZ_BIS_H = 17', 'NUTZ_TAGE = 5'];
  const PY_SRC = PY_HEAD.concat(['e = 0.0', 'eref = 0.0', 'nutz = 0', 'gut = 0', 'mint = 1000.0', 'for z in daten:', '    e = e + z[4] * DT_S / 3600000.0', '    h = z[0] % 24', '    tag = int(z[0] // 24)',
    '    if tag < NUTZ_TAGE and h >= NUTZ_VON_H and h < NUTZ_BIS_H:', '        nutz = nutz + 1', '        if abs(z[1] - T_SOLL) <= BAND_K:', '            gut = gut + 1', '        if z[1] < mint:', '            mint = z[1]',
    'for z in daten_ref:', '    eref = eref + z[4] * DT_S / 3600000.0', 'print("ENERGIE_KWH=" + str(round(e, 2)))', 'print("KOMFORT_PROZENT=" + str(round(100.0 * gut / nutz, 1)))',
    'print("EINSPARUNG_PROZENT=" + str(round((eref - e) / eref * 100.0, 1)))', 'print("MIN_T=" + str(round(mint, 1)))']).join('\n');
  function pyHeader(ctx) {
    const P = P_(ctx), rc = reglerCfg(P, ctx), c = rc.cfg || { ctrl: 'PI', kp: 3.578, tn: 1153.1, aw: 'rueck', wRamp: 0.005, ymax: 100 };
    const w = weekFor(P, c, P.dw), w0 = weekFor(P, c, 0);
    return { daten: w.ok ? w.rows : [], daten_ref: w0.ok ? w0.rows : [], DT_S: 600, T_SOLL: FACH.wNutz, BAND_K: FACH.tBand, NUTZ_VON_H: FACH.nutzVon, NUTZ_BIS_H: FACH.nutzBis, NUTZ_TAGE: 5 };
  }
  function weekStats(h) {                         // Rechenvorschrift (A HA26): Rechteck, Leistung am Zeilenanfang, 600 s; Nutzzeit Mo bis Fr 7 bis 17 Uhr
    let e = 0, er = 0, n = 0, g = 0, m = Infinity;
    arr(h.daten).forEach(z => { e += z[4] * h.DT_S / 3.6e6; const hr = z[0] % 24, tag = Math.floor(z[0] / 24); if (tag < h.NUTZ_TAGE && hr >= h.NUTZ_VON_H && hr < h.NUTZ_BIS_H) { n++; if (Math.abs(z[1] - h.T_SOLL) <= h.BAND_K) g++; if (z[1] < m) m = z[1]; } });
    arr(h.daten_ref).forEach(z => { er += z[4] * h.DT_S / 3.6e6; });
    return { ENERGIE_KWH: e, KOMFORT_PROZENT: n ? 100 * g / n : NaN, EINSPARUNG_PROZENT: er > 0 ? (er - e) / er * 100 : NaN, MIN_T: m };
  }
  function checkPi(data, ctx) {
    const lines = [], R = runners(), src = String(isObj(data) && typeof data.src === 'string' ? data.src : ''), tolM = TOL(ctx);
    if (!R || !R.runPython) return [L(false, 'Der Prüf-Läufer (verbundrun.js) ist nicht geladen', 100)];
    const h = pyHeader(ctx); if (!h.daten.length) return [L(false, 'Die Wochendaten lassen sich nicht rechnen (Reglerwerte aus Station 5 fehlen oder sind unbrauchbar)', 100)];
    const alt = clone(h); alt.daten = h.daten.slice(0, 700).map((z, i) => (i % 9 === 0 ? [z[0], z[1] + 0.4, z[2], z[3], z[4] * 1.1] : z)); alt.daten_ref = h.daten_ref.slice(0, 700).map((z, i) => (i % 5 === 0 ? [z[0], z[1], z[2], z[3], z[4] * 0.9] : z));
    const r1 = R.runPython(src, h, { T: 60 }), r2 = R.runPython(src, alt, { T: 60 }), e1 = weekStats(h), e2 = weekStats(alt);
    const keys = [['ENERGIE_KWH', 'Energie = Σ P · 600 s', 0.01, 'rel', 25, 2], ['KOMFORT_PROZENT', 'Komfort in der Nutzzeit (Mo bis Fr 7 bis 17 Uhr, ±0,5 K)', 1, 'abs', 25, 1], ['EINSPARUNG_PROZENT', 'Einsparung gegen die Woche ohne Absenkung', 0.5, 'abs', 25, 1], ['MIN_T', 'kleinste Raumtemperatur in der Nutzzeit', 0.1, 'abs', 15, 1]];
    keys.forEach(k => {
      const g = (run, e) => { const v = run.kv ? run.kv[k[0]] : undefined, t = k[2] * Math.max(1, tolM); return fin(v) && Math.abs(v - e[k[0]]) <= (k[3] === 'rel' ? t * Math.abs(e[k[0]]) : t); };
      const got = r1.kv ? r1.kv[k[0]] : undefined, okK = r1.ok && r2.ok && g(r1, e1) && g(r2, e2);
      lines.push(L(okK, k[0] + ' (' + k[1] + '): ' + (got === undefined ? 'nicht ausgegeben' : 'ausgegeben ' + fm(got, k[5] + 1)) + ', erwartet ' + fm(e1[k[0]], k[5] + 1) + (r2.ok && !g(r2, e2) ? ' – mit anderen Daten stimmt der Wert nicht (Ergebnis nicht aus den Daten gerechnet?)' : ''), k[4]));
    });
    const fmtOk = r1.ok && keys.every(k => r1.kv && r1.kv[k[0]] !== undefined) && arr(r1.lines).every(x => /^[A-Z_]+=/.test(String(x)));
    lines.push(L(fmtOk, 'Ausgabeformat KEY=Wert, alle vier Zeilen, kein Laufzeitfehler' + (r1.ok ? '' : ' – ' + r1.error), 10));
    return lines;
  }
  function piSolution(ctx) {
    const R = runners(), h = pyHeader(ctx); let out = [];
    if (R && R.runPython && h.daten.length) out = R.runPython(PY_SRC, h, { T: 60 }).lines || [];
    return { lang: 'python', src: PY_SRC, out: out };
  }

  /* ====================================================================== vh9: Fachgespräch (8 Zahlenfragen, bestanden ab 6) */
  const QUESTIONS = [['q1', 'Betriebsstrom deines Heizgeräts', 'A', 2], ['q2', 'Spannungsfall deiner Zuleitung', '%', 2], ['q3', 'Widerstand eines Pt1000 bei 20 °C', 'Ω', 1], ['q4', 'Temperaturfehler deiner Fühlerleitung in Zweileiterschaltung ohne Korrektur', 'K', 3],
    ['q5', 'K_p nach deiner Einstellregel', '', 2], ['q6', 'T_n nach deiner Einstellregel', 's', 0], ['q7', 'Regelbarkeit T_g / T_u deiner Strecke', '', 2], ['q8', 'Einsparung durch die Absenkung', '%', 1]];
  function quizTruth(ctx) {
    const P = P_(ctx), h = hausInfo(need(ctx, 'heizung.haus'), P), sd = strInfo(need(ctx, 'heizung.strecke'), P), rc = reglerCfg(P, ctx), rule = sd.ok ? ruleOf(rc.regel, sd) : null;
    const st = weekStats(pyHeader(ctx));
    return { q1: P.pHeiz / FACH.uNetz, q2: h.dUpct, q3: ptR(20), q4: dT2L(P), q5: rule ? rule.Kp : NaN, q6: rule ? rule.Tn : NaN, q7: sd.ok ? sd.ratio : NaN, q8: st.EINSPARUNG_PROZENT };
  }
  const qTol = (id, tolM, truth) => ({ q1: 0.02 * tolM * Math.abs(truth), q2: 0.03 * tolM * Math.abs(truth), q3: 0.1 * Math.max(1, tolM), q4: 0.05 * tolM * Math.abs(truth), q5: 0.02 * tolM * Math.abs(truth), q6: 0.02 * tolM * Math.abs(truth), q7: 0.02 * tolM * Math.abs(truth), q8: 0.5 * Math.max(1, tolM) }[id]);
  function checkPr(data, ctx) {
    const tolM = TOL(ctx), lines = [], tr = quizTruth(ctx), ans = isObj(data && data.answers) ? data.answers : {};
    QUESTIONS.forEach(q => {
      const a = ans[q[0]] === null || ans[q[0]] === undefined || ans[q[0]] === '' ? NaN : numOf(ans[q[0]]), t = tr[q[0]], tl = qTol(q[0], tolM, t), unit = q[2] ? ' ' + q[2] : '';
      lines.push(L(fin(a) && fin(t) && Math.abs(a - t) <= tl, 'Frage ' + q[0].slice(1) + ' (' + q[1] + '): ' + (fin(a) ? 'deine Antwort ' + fm(a, q[3] + 1) + unit : 'keine Antwort') + ', richtig ' + fm(t, q[3] + 1) + unit + ' (±' + fm(tl, q[3] + 1) + ')', 11));
    });
    lines.push(L(QUESTIONS.every(q => fin(numOf(ans[q[0]])) && ans[q[0]] !== ''), 'Vollständigkeit: alle acht Fragen beantwortet (bestanden ab sechs richtigen Antworten)', 12));
    return lines;
  }
  function questionList(ctx) {
    const P = P_(ctx), tolM = TOL(ctx); let tr = {}, tx = {};
    try {
      tr = quizTruth(ctx); const h = hausInfo(need(ctx, 'heizung.haus'), P), rc = reglerCfg(P, ctx), sd = rc.sd;
      tx = {
        q1: 'Dein Heizgerät nimmt ' + P.pHeiz + ' W an ' + P.uNetz + ' V auf, ohmsche Last. Welchen Betriebsstrom führt der Stromkreis?',
        q2: 'Deine Zuleitung hat ' + fm(h.mm2, 1) + ' mm² und ' + fm(h.len, 0) + ' m Länge (Kupfer, κ = 56 m/(Ω·mm²)). Wie groß ist der Spannungsfall in Prozent von ' + P.uNetz + ' V bei dem Betriebsstrom?',
        q3: 'Welchen Widerstand hat ein Pt1000 bei 20 °C nach IEC 60751?',
        q4: 'Deine Fühlerleitung ist ' + P.lFuehler + ' m lang mit 0,5 mm² (Kupfer). Welchen Temperaturfehler macht ein Pt1000 in Zweileiterschaltung ohne Korrektur (Steigung etwa 3,9 Ω/K)?',
        q5: 'Deine Strecke hat T_u = ' + fm(sd.Tu, 0) + ' s, T_g = ' + fm(sd.Tg, 0) + ' s und K_s = ' + fm(sd.KsNorm, 3) + ' %/%. Welches K_p liefert die Regel ' + rc.regel + ' für einen PI-Regler?',
        q6: 'Welche Nachstellzeit T_n liefert dieselbe Regel (' + rc.regel + ') mit denselben Kennwerten?',
        q7: 'Welche Regelbarkeit T_g / T_u hat deine Strecke?',
        q8: 'Dein Python-Protokoll vergleicht die Woche mit Absenkung (' + P.dw + ' K) mit der Woche ohne. Wie viel Prozent der Heizenergie spart die Absenkung?'
      };
    } catch (e) { tx = {}; }
    return QUESTIONS.map(q => ({ id: q[0], q: tx[q[0]] || (q[1] + '?'), type: 'num', unit: q[2], ans: fin(tr[q[0]]) ? +tr[q[0]].toPrecision(5) : null, tol: fin(tr[q[0]]) && tr[q[0]] ? qTol(q[0], tolM, tr[q[0]]) / Math.abs(tr[q[0]]) : 0.02 * tolM, w: 11 }));
  }
  function prSolution(ctx) { const t = quizTruth(ctx), a = {}; QUESTIONS.forEach(q => { a[q[0]] = fin(t[q[0]]) ? +t[q[0]].toPrecision(5) : null; }); return { answers: a, n: 8 }; }

  /* ====================================================================== vhF: Abschlusstest „Eine Winterwoche“ */
  function finalCheck(slots, spec, level) {
    const P0 = isObj(spec) && isObj(spec.params) ? spec.params : spec || {};
    const lv = level === 1 || level === 3 ? level : 2, tolM = tolOfLevel(lv), ctx = { spec: { params: P0 }, level: lv, tol: tolM, slots: slots || {}, get: k => (slots || {})[k] }, P = P_(ctx);
    const g = k => slotOf(ctx, k), lines = [], kpis = [], haus = g('heizung.haus'), sen = g('heizung.sen'), mess = g('heizung.mess'), ds = g('heizung.ds'), code = g('heizung.code');
    const rc = reglerCfg(P, ctx), wk = rc.cfg ? weekFor(P, rc.cfg, P.dw) : null, w0 = rc.cfg ? weekFor(P, rc.cfg, 0) : null, wM = rc.rule ? weekFor(P, musterCtl(rc.regel, rc.rule), P.dw) : null;
    const wkOk = !!wk && wk.ok, mOk = !!wM && wM.ok;
    lines.push(L(wkOk && wk.komfort >= FACH.komfortMin, 'Komfort in der Woche (Mo bis Fr ' + FACH.nutzVon + ' bis ' + FACH.nutzBis + ' Uhr, ±' + fm(FACH.tBand, 1) + ' K, zwei Fenster, Außentemperatur ' + arr(P.tMean).join('/') + ' °C): ' + (wkOk ? fm(wk.komfort, 1) + ' % der Nutzzeit, verlangt mindestens ' + FACH.komfortMin + ' % (A), kleinste Raumtemperatur ' + fm(wk.minT, 1) + ' °C' : 'nicht berechenbar (Regler aus Station 5 fehlt oder ist unbrauchbar)'), 30));
    lines.push(L(wkOk && mOk && wk.E <= FACH.energieFaktor * wM.E, 'Energie: ' + (wkOk && mOk ? fm(wk.E, 1) + ' kWh in der Woche, höchstens ' + fm(FACH.energieFaktor, 1) + ' · ' + fm(wM.E, 1) + ' kWh (Muster derselben Regel)' : 'nicht berechenbar'), 25));
    const c = sketchCtx(P, ctx), src = isObj(code) && typeof code.src === 'string' ? code.src : '', be = c.ok && runners() ? bruchEval(P, clRun(src, scenC(P, c.si))) : { ok: false, text: 'Messkette, Regler oder Sketch fehlen' };
    lines.push(L(be.ok, 'Fühlerausfall (Bruch und Kurzschluss, Zeitpunkt aus dem Lastenheft): ' + be.text, 20));
    const hl = checkHaus(haus, ctx), sl = checkStell(ds, ctx), sOk = hl[0].ok && hl[2].ok && sl[0].ok && sl[1].ok && sl[3].ok;
    lines.push(L(sOk, 'Sicherheit: Leitungsschutz ' + (hl[0].ok ? 'passt' : 'passt nicht') + ', Spannungsfall ' + (hl[2].ok ? 'unter 3 %' : 'zu groß') + ', Stellglied Strom ' + (sl[0].ok ? 'passt' : 'passt nicht') + ', Sperrspannung ' + (sl[1].ok ? 'passt' : 'passt nicht') + ', Kühlung ' + (sl[3].ok ? 'passt' : 'passt nicht'), 15));
    const sk = c.ok && runners() ? skalEval(src, c) : [], skOk = sk.length === 3 && sk.every(x => x.ok);
    const lead = sen && isObj(sen.ctl) ? numOf(sen.ctl.lead) : NaN, wires = sen && isObj(sen.ctl) ? numOf(sen.ctl.wires) : NaN, dTe = wires === 2 && fin(lead) ? 2 * lead / ptSlope(P.tRef) : 0, dTm = mess && isObj(mess.values) && fin(+mess.values.dT) ? +mess.values.dT : NaN;
    const dOk = fin(dTm) && Math.abs(dTm - dTe) <= (dTe > 0 ? 0.05 * dTe : 0.02);
    lines.push(L(skOk && dOk, 'Konsistenz: ' + (skOk ? 'der Sketch gibt die Temperatur wie die Skalierung der Messkette aus (±0,1 K)' : 'der Sketch weicht von der Skalierung der Messkette ab (Station 7 gegen Station 2)') + ', ' + (dOk ? 'der Leitungsfehler der Fühlerprüfung passt zur Leitung der Messkette (' + fm(dTe, 3) + ' K)' : 'der Leitungsfehler der Fühlerprüfung (' + (fin(dTm) ? fm(dTm, 3) : 'fehlt') + ' K) passt nicht zur Leitung der Messkette (' + fm(dTe, 3) + ' K)'), 10));
    const gu = rc.cfg ? guete(P, rc.cfg) : { ok: false }, h = hausInfo(haus, P);
    const k = (key, label, value, unit, okk) => kpis.push({ key: key, label: label, value: fin(value) ? rd(value, 2) : null, unit: unit, ok: !!okk && fin(value) });
    k('komfort', 'Komfort in der Nutzzeit', wkOk ? wk.komfort : NaN, '%', wkOk && wk.komfort >= FACH.komfortMin);
    k('energie', 'Heizenergie je Woche', wkOk ? wk.E : NaN, 'kWh', wkOk && mOk && wk.E <= FACH.energieFaktor * wM.E);
    k('einsparung', 'Einsparung durch die Absenkung', wkOk && w0 && w0.ok ? 100 * (w0.E - wk.E) / w0.E : NaN, '%', wkOk && !!w0 && w0.ok);
    k('ueberschwingen', 'Überschwingen am Ende der Absenkung', gu.ok ? gu.over : NaN, 'K', gu.ok && gu.over <= FACH.ueber);
    k('fuehler', 'Fühlerausfall erkannt', be.ok ? 1 : 0, '', be.ok);
    k('spannungsfall', 'Spannungsfall Zuleitung', h.dUpct, '%', fin(h.dUpct) && h.dUpct <= FACH.dUmax);
    return { lines: lines, kpis: kpis };
  }

  /* ====================================================================== Stationen */
  const nVal = (v, k) => { const x = typeof v[k] === 'string' ? parseFloat(v[k].replace(',', '.')) : v[k]; return fin(x) ? x : null; };
  const noFi = [{ value: 'AC', label: 'Typ AC' }, { value: 'A', label: 'Typ A' }, { value: 'F', label: 'Typ F' }];
  const URT = [{ value: 'io', label: 'in Ordnung (i. O.)' }, { value: 'nio', label: 'nicht in Ordnung (n. i. O.)' }];
  const mutSlot = (d, f) => { f(d); return d; };

  const STATIONS = [
    { id: 'vh1', lab: 'vb', cat: 'Heizungsregelung', title: 'Stromkreis für das Heizgerät planen', level: 1,
      on: 'haus',
      text: 'Das elektrische Heizgerät im Werkstatt-Büro braucht einen eigenen Stromkreis. Plane ihn: Leitung mit Querschnitt und Länge aus dem Lastenheft, Leitungsschutzschalter, FI-Schutzschalter und die Leistung des Heizgeräts. Rechne den Betriebsstrom und den Spannungsfall deiner Zuleitung.',
      in: [], out: 'heizung.haus', type: 'haus.plan', w: 100, pass: null,
      open: { ex: 'Heizgerät Stromkreis' },
      hint: ['Rechne den Betriebsstrom aus Leistung und Netzspannung (ohmsche Last): I = P / U. Das Heizgerät hat keinen Blindanteil.',
        'Der Schutzschalter muss mindestens den Betriebsstrom führen können und darf höchstens so groß sein, wie die Leitung verträgt. Für 1,5 mm² ist B16 die übliche Zuordnung.',
        'Spannungsfall: ΔU = 2 · l · I / (κ · A) mit κ(Cu) = 56 m/(Ω·mm²), höchstens 3 % von 230 V. Zusätzlich schützt ein FI Typ A mit höchstens 30 mA.'],
      check: safe(checkHaus, 'Stromkreis'),
      form: [
        { key: 'brType', label: 'Leitungsschutzschalter: Auslösecharakteristik', type: 'select', options: ['B', 'C'] },
        { key: 'brA', label: 'Leitungsschutzschalter: Bemessungsstrom', type: 'number', unit: 'A' },
        { key: 'rcdType', label: 'FI-Schutzschalter: Typ', type: 'select', options: noFi },
        { key: 'rcdMa', label: 'FI-Schutzschalter: Bemessungsfehlerstrom', type: 'number', unit: 'mA' },
        { key: 'mm2', label: 'Leitung: Querschnitt', type: 'number', unit: 'mm²', hint: 'Zum Beispiel 1,5 oder 2,5' },
        { key: 'lenM', label: 'Leitung: Länge laut Lastenheft', type: 'number', unit: 'm' },
        { key: 'pW', label: 'Leistung des Heizgeräts', type: 'number', unit: 'W' }
      ],
      fromForm: v => {
        v = v || {}; const c = { name: 'Heizgerät Werkstatt-Büro' }, br = {}, rc = {}, ca = {};
        if (v.brType) br.type = String(v.brType); if (nVal(v, 'brA') !== null) br.inA = nVal(v, 'brA'); if (Object.keys(br).length) c.breaker = br;
        if (v.rcdType) rc.type = String(v.rcdType); if (nVal(v, 'rcdMa') !== null) rc.imaMa = nVal(v, 'rcdMa'); if (Object.keys(rc).length) c.rcd = rc;
        if (nVal(v, 'mm2') !== null) ca.mm2 = nVal(v, 'mm2'); if (nVal(v, 'lenM') !== null) ca.lenM = nVal(v, 'lenM'); if (Object.keys(ca).length) c.cable = ca;
        const o = { circuits: [c] }; if (nVal(v, 'pW') !== null) { o.pAvailW = nVal(v, 'pW'); c.loads = [{ name: 'Heizgerät', pW: nVal(v, 'pW') }]; } return o;
      },
      toForm: d => { const c = (d && Array.isArray(d.circuits) && d.circuits[0]) || {}, b = c.breaker || {}, r = c.rcd || {}, k = c.cable || {}; return { brType: b.type, brA: b.inA, rcdType: r.type, rcdMa: r.imaMa, mm2: k.mm2, lenM: k.lenM, pW: d ? d.pAvailW : undefined }; },
      starter: ctx => ({ circuits: [], pAvailW: 0, notes: '' }),
      solution: ctx => hausSolution(ctx),
      mutants: [
        { name: 'B10 (Leitungsschutz zu klein)', mutate: d => mutSlot(d, x => { x.circuits[0].breaker.inA = 10; }), expectFail: ['Leitungsschutz'] },
        { name: 'B20 auf 1,5 mm² (Leitung ungeschützt)', mutate: d => mutSlot(d, x => { x.circuits[0].breaker.inA = 20; }), expectFail: ['Leitungsschutz'] },
        { name: '0,75 mm² mit B16', mutate: d => mutSlot(d, x => { x.circuits[0].cable.mm2 = 0.75; }), expectFail: ['Leitungsschutz'] },
        { name: 'Länge 5 m statt Lastenheft', mutate: (d, ctx) => mutSlot(d, x => { x.circuits[0].cable.lenM = P_(ctx).lZu === 5 ? 6 : 5; }), expectFail: ['Leitung und Länge'] },
        { name: 'kein FI', mutate: d => mutSlot(d, x => { x.circuits[0].rcd = null; }), expectFail: ['Zusatzschutz'] },
        { name: 'Leistung 2000 W', mutate: d => mutSlot(d, x => { x.circuits[0].loads[0].pW = 2000; x.pAvailW = 2000; }), expectFail: ['Leistung'] }
      ] },

    { id: 'vh2', lab: 'vb', cat: 'Heizungsregelung', title: 'Messkette für den Pt1000 auslegen', level: 2,
      on: 'sen',
      text: 'Der Raumfühler ist ein Pt1000. Baue im Sensorik-Prüfstand „Temperatur“ die Messkette für den Arduino auf: Schaltung, Verstärkung, ADU und der Leitungswiderstand deiner Fühlerleitung. Stelle sie so ein, dass der Messbereich −10 bis +50 °C nicht übersteuert und die Auflösung reicht. Lege mit Zählwerten aus dem Prüfstand die Skalierung in °C fest, dazu die Schwellen für Fühlerbruch und Kurzschluss.',
      in: ['heizung.haus'], out: 'heizung.sen', type: 'sen.chain', w: 100, pass: null,
      open: { ex: 'Temperaturmessung', rig: 'temperatur', ctl: { sensor: 'pt1000', adcBits: 10, vref: 5 } },
      assist: { 1: { rig: 'temperatur', ctl: { sensor: 'pt1000', circuit: 'bruecke', rRef: 1000, gain: 10, adcBits: 10, vref: 5, wires: 3 } } },
      hint: ['Der Pt1000 ändert seinen Widerstand um etwa 3,9 Ω je Kelvin; die Messschaltung macht daraus eine kleine Spannungsänderung.',
        'Die Auflösung ist die Temperaturänderung je ADU-Schritt und steht als Meter im Prüfstand. Eine Brücke nimmt den Grundwert weg, danach nutzt die Verstärkung den ADU-Bereich aus.',
        'Nimm die Zählwerte für die Skalierung aus dem Prüfstand bei festen Temperaturen (zum Beispiel 0, 10, 20, 30 und 40 °C). Fühlerbruch und Kurzschluss liegen außerhalb des Messbereichs.'],
      check: safe(checkSen, 'Messkette'),
      form: senForm,
      fromForm: v => {
        v = v || {}; const pts = []; for (let i = 0; i < 5; i++) { const c = nVal(v, 'c' + i), t = nVal(v, 't' + i); if (c !== null && t !== null) pts.push([c, t]); }
        const o = { scale: { pts: pts }, thr: {} }; if (nVal(v, 'kurz') !== null) o.thr.kurz = nVal(v, 'kurz'); if (nVal(v, 'bruch') !== null) o.thr.bruch = nVal(v, 'bruch'); return o;
      },
      toForm: d => { const o = {}, p = d && d.scale && Array.isArray(d.scale.pts) ? d.scale.pts : []; p.slice(0, 5).forEach((q, i) => { o['c' + i] = q[0]; o['t' + i] = q[1]; }); if (d && d.thr) { o.kurz = d.thr.kurz; o.bruch = d.thr.bruch; } return o; },
      starter: ctx => ({ rig: 'temperatur', preset: '', ctl: { sensor: 'ntc', circuit: 'teiler', rRef: 10000, gain: 1, adcBits: 10, vref: 3.3, wires: 2, lead: 0 }, scale: { pts: [] }, thr: {}, state: {}, derived: {} }),
      solution: ctx => senSolution(ctx),
      mutants: [
        { name: 'Verstärkung 5 (Auflösung zu grob)', mutate: d => mutSlot(d, x => { x.ctl.gain = 5; }), expectFail: ['Auflösung'] },
        { name: 'Skalierung nur aus 0 und 40 °C', mutate: d => mutSlot(d, x => { x.scale.pts = [x.scale.pts[0], x.scale.pts[4]]; }), expectFail: ['Skalierung'] },
        { name: 'Bruchschwelle 950 (unter dem Zählwert bei 50 °C)', mutate: d => mutSlot(d, x => { x.thr.bruch = 950; }), expectFail: ['Fehlerschwellen'] },
        { name: 'Pt100 statt Pt1000', mutate: d => mutSlot(d, x => { x.ctl.sensor = 'pt100'; }), expectFail: ['Fühler und Leitung'] },
        { name: 'Leitungswiderstand 0', mutate: d => mutSlot(d, x => { x.ctl.lead = 0; }), expectFail: ['Fühler und Leitung'] },
        { name: '12 Bit statt 10 Bit', mutate: d => mutSlot(d, x => { x.ctl.adcBits = 12; }), expectFail: ['ADU'] }
      ] },

    { id: 'vh3', lab: 'vb', cat: 'Heizungsregelung', title: 'Fühler prüfen und beurteilen', level: 2,
      on: 'mess',
      text: 'Prüfe den Pt1000-Fühler vor dem Einbau. Die Messwerte des Prüflings stehen im Lastenheft. Rechne für jede Zeile Soll und Toleranz (Klasse B nach IEC 60751, in Ohm), beurteile jede Zeile mit in Ordnung oder nicht in Ordnung, gib den Leitungsfehler der Zweileiterschaltung an und wähle deinen Befund.',
      in: ['heizung.sen'], out: 'heizung.mess', type: 'mess.protocol', w: 100, pass: null,
      form: formMess,
      fromForm: (v, ctx) => {
        v = v || {}; const P = ctx ? P_(ctx) : null, fv = P && fin(P.tRef) ? fuehlerVals(P) : null, u = k => (v[k] === 'io' || v[k] === 'nio' ? v[k] : '');
        const rows = MROWS.map(m => ({ id: m[0], label: m[1], unit: 'Ω', soll: nVal(v, 's' + m[0]) !== null ? nVal(v, 's' + m[0]) : 0, ist: fv && fin(fv[m[0]]) ? fv[m[0]] : null, tol: nVal(v, 't' + m[0]) !== null ? nVal(v, 't' + m[0]) : 0, instrument: 'Multimeter', urteil: u('u' + m[0]) }));
        rows.push({ id: 'riso', label: 'Isolation Fühler gegen Schutzrohr', unit: 'MΩ', soll: FACH.risoMin, ist: fv ? fv.riso : null, tol: 0.01, instrument: 'Isolationsmessgerät 100 V', urteil: u('uriso') });
        return { rows: rows, values: nVal(v, 'dT') !== null ? { dT: nVal(v, 'dT') } : {}, findings: v.befund ? [String(v.befund)] : [] };
      },
      toForm: d => { const o = {}; arr(d && d.rows).forEach(r => { if (r.id === 'riso') o.uriso = r.urteil; else { o['s' + r.id] = r.soll; o['t' + r.id] = r.tol; o['u' + r.id] = r.urteil; } }); if (d && d.values && d.values.dT !== undefined) o.dT = d.values.dT; if (d && d.findings && d.findings[0]) o.befund = d.findings[0]; return o; },
      open: { ex: 'Fühler messen' },
      hint: ['Miss den Fühler direkt am Kopf und an der Klemme; der Unterschied zeigt, was die Leitung beiträgt.',
        'R(ϑ) = R0 · (1 + A · ϑ + B · ϑ²) nach IEC 60751. Die Klassengrenze gilt in Kelvin; rechne sie mit der Steigung dR/dϑ in Ohm um.',
        'Vergleiche, welche Zeile zuerst abweicht: am Kopf, an der Klemme oder bei der Isolation. Der Sprung zwischen den Zeilen zeigt, wo die Ursache liegt.'],
      check: safe(checkMess, 'Messprotokoll'),
      starter: ctx => ({ rows: [], values: {}, findings: [] }),
      solution: ctx => messSolution(ctx),
      mutants: [
        { name: 'falscher Befund', mutate: (d, ctx) => mutSlot(d, x => { const w = fkindOf(P_(ctx)); x.findings = [FUEHLER[(FUEHLER.findIndex(f => f.id === w) + 1) % FUEHLER.length].id]; }), expectFail: ['Fehler benannt'] },
        { name: 'Soll an der Klemme ohne Leitungswiderstand', levels: [2, 3], mutate: (d, ctx) => mutSlot(d, x => { rowOf(x.rows, 'rklemme').soll = rd(ptR(P_(ctx).tRef), 2); }), expectFail: ['Soll Klemme'] },
        { name: 'Toleranz in Kelvin statt Ohm', mutate: (d, ctx) => mutSlot(d, x => { const P = P_(ctx); rowOf(x.rows, 'r0').tol = 0.3; rowOf(x.rows, 'rref').tol = rd(ptClassB(P.tRef), 2); rowOf(x.rows, 'rklemme').tol = rd(ptClassB(P.tRef), 2); }), expectFail: ['Toleranz'] },
        { name: 'Isolation falsch beurteilt', mutate: d => mutSlot(d, x => { const r = rowOf(x.rows, 'riso'); r.urteil = r.urteil === 'io' ? 'nio' : 'io'; }), expectFail: ['Beurteilung Isolation'] },
        { name: 'Leitungsfehler vergessen', levels: [2, 3], mutate: d => mutSlot(d, x => { x.values.dT = 0; }), expectFail: ['Leitungsfehler'] }
      ] },

    { id: 'vh4', lab: 'vb', cat: 'Heizungsregelung', title: 'Strecke im Handbetrieb aufnehmen', level: 2,
      on: 'reg',
      text: 'Nimm die Sprungantwort deines Raums im Regelungs-Prüfstand „Raumtemperatur“ auf: Handbetrieb, Außentemperatur und Anfangswert y1 aus dem Lastenheft, dann ein Sprung um 10 % der Stellgröße. Zeichne mindestens vier Stunden nach dem Sprung auf, bis sich die Temperatur nicht mehr ändert. Bestimme K_s, T_u und T_g und beurteile die Regelbarkeit.',
      in: ['heizung.mess'], out: 'heizung.strecke', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'raumtemp', T: 21600, ctl: { mode: 'hand', z: 0, window: false, noise: 0 } },
      assist: { 1: { rig: 'raumtemp', ctl: { mode: 'hand', yHand: 57, tOut: 0, z: 0, window: false, noise: 0 }, op: { y: 57 }, seq: [{ t: 1800, set: { yHand: 67 } }] } },
      hint: ['Stelle die Stellgröße im Handbetrieb fest ein und warte, bis die Temperatur ruht, bevor du springst.',
        'Lege die Wendetangente an die Sprungantwort: Ihre Schnittpunkte mit Anfangs- und Endwert ergeben T_u und T_g. Die Aufzeichnung muss bis zur Beharrung laufen.',
        'K_s ist die Temperaturänderung geteilt durch die Stellgrößenänderung; gib die Einheit an (K/% oder %/%, der Regler rechnet in Prozent des Messbereichs 10 bis 30 °C).'],
      check: safe(checkStr, 'Strecke'),
      form: [
        { key: 'ks', label: 'K_s (Verstärkung der Strecke)', type: 'number' },
        { key: 'ksEinheit', label: 'Einheit von K_s', type: 'select', options: ['K/%', '%/%'] },
        { key: 'tu', label: 'T_u (Verzugszeit)', type: 'number', unit: 's' },
        { key: 'tg', label: 'T_g (Ausgleichszeit)', type: 'number', unit: 's' },
        { key: 'tgtu', label: 'Regelbarkeit T_g / T_u', type: 'number' },
        { key: 'urteil', label: 'Urteil zur Regelbarkeit', type: 'select', options: RATIO_URTEIL }
      ],
      fromForm: v => { v = v || {}; const o = {}; ['ks', 'tu', 'tg', 'tgtu'].forEach(k => { if (nVal(v, k) !== null) o[k] = nVal(v, k); }); if (v.ksEinheit) o.ksEinheit = String(v.ksEinheit); if (v.urteil) o.urteil = String(v.urteil); return o; },
      toForm: d => (d ? { ks: d.ks, ksEinheit: d.ksEinheit, tu: d.tu, tg: d.tg, tgtu: d.tgtu, urteil: d.urteil } : {}),
      starter: ctx => ({ lab: 'reg', rig: 'raumtemp', ctl: { mode: 'auto', ctrl: 'PI', w: 20, tOut: -5, z: 0, window: false, noise: 0 }, seq: [], T: 600, state: {}, derived: {} }),
      solution: ctx => strSolution(ctx),
      mutants: [
        { name: 'Sprung in Automatik', mutate: d => mutSlot(d, x => { x.ctl.mode = 'auto'; }), expectFail: ['Versuch'] },
        { name: 'nur zwei Stunden aufgezeichnet', mutate: d => mutSlot(d, x => { x.T = x.seq[0].t + 7200; }), expectFail: ['Beharrung'] },
        { name: 'K_s in %/% als K/% eingetragen', mutate: d => mutSlot(d, x => { x.ks = rd(x.ks * 5, 3); }), expectFail: ['K_s'] },
        { name: 'T_u und T_g vertauscht', mutate: d => mutSlot(d, x => { const t = x.tu; x.tu = x.tg; x.tg = t; }), expectFail: ['T_u'] },
        { name: 'T_u aus der Kernauswertung (348 s)', mutate: d => mutSlot(d, x => { x.tu = 348; }), expectFail: ['T_u'] },
        { name: 'Fremdwärme 300 W im Versuch', mutate: d => mutSlot(d, x => { x.ctl.z = 300; }), expectFail: ['Versuch'] }
      ] },

    { id: 'vh5', lab: 'vb', cat: 'Heizungsregelung', title: 'PI-Regler nach Einstellregel einstellen', level: 2,
      on: 'reg',
      text: 'Stelle den PI-Regler für den Raum ein. Rechne K_p und T_n mit der Einstellregel chr-stoer-0 (Störverhalten) oder chr-fuehr-0 (Führungsverhalten) aus den Kennwerten deiner Strecke. Der Prüflauf hebt den Sollwert am Ende der Nachtabsenkung auf 20 °C und öffnet fünf Stunden später ein Fenster für zehn Minuten. Das Überschwingen soll klein bleiben, der Regler muss ohne bleibende Abweichung ausregeln.',
      in: ['heizung.strecke'], out: 'heizung.regler', type: 'rig.state', w: 100, pass: null,
      open: { rig: 'raumtemp', T: 32400, ctl: { mode: 'auto', ctrl: 'PI', aw: 'rueck', z: 0, window: false, noise: 0 } },
      assist: { 1: { rig: 'raumtemp', ctl: { mode: 'auto', ctrl: 'PI', aw: 'rueck', tOut: 0, z: 0, window: false, noise: 0, w: 16, wRamp: 0.005 } } },
      hint: ['Die Regel liefert K_p und T_n aus deinen Kennwerten; die Regel für das Störverhalten macht den Regler schnell, überschwingt aber beim Sollwertsprung.',
        'Beim Ende der Nachtabsenkung hilft eine Sollwertrampe oder die Regel für das Führungsverhalten.',
        'Prüfe nach dem Sprung auch das offene Fenster: Die Temperatur fällt stark, der Regler muss danach ohne Überschwingen zurückfinden. Der Anti-Windup bleibt eingeschaltet.'],
      check: safe(checkReg, 'Regler'),
      form: [{ key: 'regel', label: 'Einstellregel', type: 'select', options: ['chr-stoer-0', 'chr-fuehr-0'] }],
      fromForm: v => ({ regel: v && v.regel ? String(v.regel) : null }),
      toForm: d => ({ regel: d ? d.regel : undefined }),
      starter: ctx => ({ lab: 'reg', rig: 'raumtemp', ctl: { mode: 'auto', ctrl: 'P', kp: 2, w: 20, tOut: -5, z: 0, window: false, noise: 0 }, seq: [], T: 600, state: {}, derived: {} }),
      solution: ctx => regSolution(ctx),
      mutants: [
        { name: 'chr-stoer-0 ohne Sollwertrampe', mutate: d => mutSlot(d, x => { x.ctl.wRamp = 0; }), expectFail: ['Überschwingen'] },
        { name: 'K_p verdoppelt', mutate: d => mutSlot(d, x => { x.ctl.kp = x.ctl.kp * 2; }), expectFail: ['Einstellregel'] },
        { name: 'T_n halbiert', mutate: d => mutSlot(d, x => { x.ctl.tn = x.ctl.tn / 2; }), expectFail: ['Einstellregel'] },
        { name: 'Anti-Windup aus (sichtbar nur bei -5 °C Außentemperatur: Fenster-Ausregelzeit 1,8-fach)', mutate: (d, ctx) => (P_(ctx).tOutSprung === -5 ? mutSlot(d, x => { x.ctl.aw = 'aus'; }) : null), expectFail: ['Störung Fenster'] },
        { name: 'P-Regler statt PI', mutate: d => mutSlot(d, x => { x.ctl.ctrl = 'P'; }), expectFail: ['Bleibende Regeldifferenz', 'Einstellregel'] },
        { name: 'Werte nach Ziegler-Nichols', mutate: d => mutSlot(d, x => { x.ctl.kp = 5.367; x.ctl.tn = 960.9; }), expectFail: ['Einstellregel'] }
      ] },

    { id: 'vh6', lab: 'vb', cat: 'Heizungsregelung', title: 'Stellglied für 3 kW wählen', level: 2,
      on: 'ds',
      text: 'Das Heizgerät braucht ein Stellglied, das die 3 kW zeitproportional schaltet. Wähle aus dem Katalog ein Stellglied und einen Kühlkörper. Rechne die Verlustleistung und die Sperrschichttemperatur im Verteiler. Das Stellglied muss Strom und Spannung mit Reserve aushalten und direkt vom 5-V-Pin des Arduino ansteuerbar sein.',
      in: ['heizung.regler', 'heizung.haus'], out: 'heizung.ds', type: 'ds.pick', w: 100, pass: null,
      form: [
        { key: 'stellglied', label: 'Stellglied', type: 'select', options: STELLGLIEDER.map(s => ({ value: 'fach:' + s.id, label: s.name })) },
        { key: 'kuehlkoerper', label: 'Kühlkörper', type: 'select', options: [{ value: 'fach:kk-s', label: 'Profil klein (s)' }, { value: 'fach:kk-m', label: 'Profil mittel (m)' }, { value: 'fach:kk-l', label: 'Profil groß (l)' }, { value: 'fach:kk-xl', label: 'Rippenkörper sehr groß (xl)' }] },
        { key: 'pVerlW', label: 'Verlustleistung des Stellglieds', type: 'number', unit: 'W' },
        { key: 'tjC', label: 'Sperrschichttemperatur T_j im Verteiler', type: 'number', unit: '°C' }
      ],
      fromForm: v => {
        v = v || {}; const items = [], pn = id => String(id).replace(/^fach:(kk-)?/, '').toUpperCase();
        if (v.stellglied) items.push({ role: 'stellglied', ds: String(v.stellglied), part: pn(v.stellglied) });
        if (v.kuehlkoerper) items.push({ role: 'kuehlkoerper', ds: String(v.kuehlkoerper), part: 'KK-' + pn(v.kuehlkoerper) });
        return { items: items, calc: { tjC: nVal(v, 'tjC'), pVerlW: nVal(v, 'pVerlW') }, vals: {} };
      },
      toForm: d => { const o = {}; arr(d && d.items).forEach(i => { if (i.role === 'stellglied') o.stellglied = i.ds; if (i.role === 'kuehlkoerper') o.kuehlkoerper = i.ds; }); if (d && d.calc) { o.tjC = d.calc.tjC; o.pVerlW = d.calc.pVerlW; } return o; },
      open: { tab: 'lib' },
      hint: ['Ein Stellglied muss den Laststrom dauernd mit Reserve führen und den Netzscheitel sperren.',
        'Halbleiter haben im Durchlass einen Spannungsabfall; daraus folgt die Verlustwärme P = U_T · I. Die Sperrschicht liegt über dem Verteiler um P mal die Summe der Wärmewiderstände.',
        'Ohmsche Lasten schaltet man im Nulldurchgang, das schont das Netz. Prüfe auch, ob der 5-V-Pin den Steuereingang direkt treiben kann.'],
      check: safe(checkStell, 'Stellglied'),
      starter: ctx => ({ items: [], calc: {}, vals: {} }),
      solution: ctx => stellSolution(ctx),
      mutants: [
        { name: 'Halbleiterrelais 10 A (Strom zu klein)', mutate: d => mutSlot(d, x => { x.items[0] = { role: 'stellglied', ds: 'fach:ssr-10', part: 'SSR-10' }; }), expectFail: ['Strom'] },
        { name: 'Sofortschaltung statt Nullspannungsschalter', mutate: d => mutSlot(d, x => { x.items[0] = { role: 'stellglied', ds: 'fach:ssr-25-sofort', part: 'SSR-25-SOFORT' }; }), expectFail: ['Schaltverhalten'] },
        { name: 'Triac 16 A (Strom zu klein)', mutate: d => mutSlot(d, x => { x.items[0] = { role: 'stellglied', ds: 'fach:triac-16', part: 'TRIAC-16' }; }), expectFail: ['Strom'] },
        { name: 'Kühlkörper mittel (zu heiß)', mutate: d => mutSlot(d, x => { x.items[1] = { role: 'kuehlkoerper', ds: 'fach:kk-m', part: 'KK-M' }; }), expectFail: ['Kühlung'] },
        { name: 'kein Kühlkörper gewählt', mutate: d => mutSlot(d, x => { x.items = [x.items[0]]; }), expectFail: ['Kühlung'] },
        { name: 'Sperrschichttemperatur falsch gerechnet', mutate: d => mutSlot(d, x => { x.calc.tjC = x.calc.tjC + 40; }), expectFail: ['Kühlung'] }
      ] },

    { id: 'vh7', lab: 'vb', cat: 'Heizungsregelung', title: 'Raumregler im Arduino programmieren', level: 3,
      on: 'code',
      text: 'Programmiere den Raumregler: Alle 10 Sekunden (mit millis(), nicht mit delay()) liest du den Fühler an A0 und den Sollwert an A1, rechnest den Fühler mit deiner Skalierung in °C um, regelst mit PI und Anti-Windup und gibst das Stellsignal an Pin 9 aus. Hast du in Station 5 eine Sollwertrampe gewählt, gehört sie in den Sketch. Bei Fühlerbruch oder Kurzschluss geht die Heizung aus. Die serielle Zeile heißt T=<°C>;W=<°C>;Y=<%>;ERR=<n>, ERR ist 1 bei Bruch und 2 bei Kurzschluss. Der Regler aus Station 5 rechnet in Prozent des Messbereichs 10 bis 30 °C.',
      in: ['heizung.sen', 'heizung.regler'], out: 'heizung.code', type: 'code.sketch', w: 100, pass: null,
      open: { ex: 'Serielle Meldung' },
      assist: { 1: { kind: 'rahmenprogramm' } },
      frame: ctx => (ctx && ctx.assist ? FRAME : null),
      hint: ['Rechne den Regler in festen Abständen mit millis(), nicht mit delay().',
        'Begrenze die Stellgröße auf 0 bis 100 % und halte den I-Anteil an oder rechne ihn zurück, wenn die Grenze erreicht ist. Der Sollwert läuft mit der Rampe aus Station 5 auf den neuen Wert.',
        'Prüfe vor jeder Rechnung den ADU-Wert gegen deine Fehlerschwellen aus Station 2; bei einem Fühlerfehler gilt die sichere Stellung: Heizung aus (Y = 0).'],
      check: safe(checkCode, 'Sketch'),
      starter: ctx => ({ lang: 'arduino', src: 'void setup() {\n}\nvoid loop() {\n}\n', run: { serial: [], events: [] } }),
      probe: ctx => { const c = sketchCtx(P_(ctx), ctx); return { T: 130, dt: 1, analog: { A0: c.ok ? c.si.codes[20] : 700, A1: wCode(FACH.wNutz) } }; },
      solution: ctx => codeSolution(ctx),
      mutants: [
        { name: 'ohne Anti-Windup', mutate: d => mutSlot(d, x => { x.src = x.src.replace('yi = yi + KP * TA / TN * e + TA / TN * (y - yu);', 'yi = yi + KP * TA / TN * e;'); }), expectFail: ['Anti-Windup'] },
        { name: 'Fühlerfehler wird nicht gemeldet', mutate: d => mutSlot(d, x => { x.src = x.src.replace('if (a0 > BRUCH) { err = 1; }', '').replace('if (a0 < KURZ) { err = 2; }', ''); }), expectFail: ['Fühlerausfall'] },
        { name: 'Y bleibt beim Fühlerfehler auf dem letzten Wert', mutate: d => mutSlot(d, x => { x.src = x.src.replace('if (err > 0) { y = 0.0; yi = 0.0; yu = 0.0; }', 'if (err > 0) { y = y; }'); }), expectFail: ['Fühlerausfall'] },
        { name: 'Zeilenformat mit Komma', mutate: d => mutSlot(d, x => { x.src = x.src.replace('Serial.print(";Y=");', 'Serial.print(",Y=");'); }), expectFail: ['Zeilenformat'] },
        { name: 'wachsender Abstand der Zeilen', mutate: d => mutSlot(d, x => { x.src = x.src.replace('unsigned long last = 0;', 'unsigned long last = 0;\nunsigned long wait = 10000UL;').replace('millis() - last >= 10000UL', 'millis() - last >= wait').replace('last += 10000UL;', 'last = millis();\n    wait = wait + 300UL;'); }), expectFail: ['Abtastzeit'] },
        { name: 'K_p verdoppelt', mutate: d => mutSlot(d, x => { x.src = x.src.replace(/KP = ([\d.]+)/, (m, a) => 'KP = ' + (2 * +a)); }), expectFail: ['Regelgüte'] },
        { name: 'lineare Skalierung statt Stützstellen', mutate: d => mutSlot(d, x => { x.src = x.src.replace(/const int CODE\[\d+\] = \{[^}]*\};/, 'const int CODE[2] = {514, 883};').replace(/const float TC\[\d+\] = \{[^}]*\};/, 'const float TC[2] = {0.0, 40.0};').replace('const int N = 5;', 'const int N = 2;'); }), expectFail: ['Skalierung'] }
      ] },

    { id: 'vh8', lab: 'vb', cat: 'Heizungsregelung', title: 'Wochenprotokoll in Python auswerten', level: 2,
      on: 'pi',
      text: 'Dein Python-Programm wertet das Wochenprotokoll aus. Im Kopf stehen daten (Woche mit Absenkung) und daten_ref (Woche ohne Absenkung), je Zeile [t_h, T, W, Y, P_W] für zehn Minuten, dazu DT_S, T_SOLL, BAND_K, NUTZ_VON_H, NUTZ_BIS_H und NUTZ_TAGE. Gib ENERGIE_KWH, KOMFORT_PROZENT, EINSPARUNG_PROZENT und MIN_T aus. Komfort und MIN_T zählen nur in der Nutzzeit von Montag bis Freitag.',
      in: ['heizung.code', 'heizung.regler'], out: 'heizung.pi', type: 'pi.script', w: 100, pass: null,
      open: { ex: 'Daten auswerten' },
      hint: ['Jede Zeile steht für 10 Minuten; Energie ist Leistung mal Zeit. Der Zeilenanfang gilt für das ganze Intervall, 3,6 Millionen Wattsekunden sind eine Kilowattstunde.',
        'Für den Komfort zählst du nur die Zeilen in der Nutzzeit (Tag kleiner als NUTZ_TAGE, Stunde von NUTZ_VON_H bis vor NUTZ_BIS_H) mit einer Abweichung von höchstens BAND_K.',
        'Die Einsparung beziehst du auf die Woche ohne Absenkung: (E_ref − E) / E_ref · 100. Gib alles als KEY=Wert aus, zum Beispiel print("MIN_T=" + str(round(mint, 1))).'],
      check: safe(checkPi, 'Auswertung'),
      starter: ctx => ({ lang: 'python', src: PY_HEAD.join('\n') + '\n', out: [] }),
      dataFor: ctx => pyHeader(ctx), runT: 60,
      solution: ctx => piSolution(ctx),
      mutants: [
        { name: 'Energie in Wh statt kWh', mutate: d => mutSlot(d, x => { x.src = x.src.replace('str(round(e, 2))', 'str(round(e * 1000.0, 2))'); }), expectFail: ['ENERGIE_KWH'] },
        { name: 'Komfort über alle Zeilen statt Nutzzeit', mutate: d => mutSlot(d, x => { x.src = x.src.replace('if tag < NUTZ_TAGE and h >= NUTZ_VON_H and h < NUTZ_BIS_H:', 'if h >= 0:'); }), expectFail: ['KOMFORT_PROZENT'] },
        { name: 'Einsparung auf E statt E_ref bezogen', mutate: d => mutSlot(d, x => { x.src = x.src.replace('(eref - e) / eref', '(eref - e) / e'); }), expectFail: ['EINSPARUNG_PROZENT'] },
        { name: 'Syntaxfehler', mutate: d => mutSlot(d, x => { x.src = x.src.replace('for z in daten:', 'for z in daten'); }), expectFail: ['Ausgabeformat'] }
      ] },

    { id: 'vh9', lab: 'vb', cat: 'Heizungsregelung', title: 'Fachgespräch zur Heizungsregelung', level: 1,
      on: 'pr',
      text: 'Probeprüfung zu deiner eigenen Heizungsregelung: Acht Fragen, die sich aus deinen Zahlen ergeben. Antworte numerisch. Alle Werte stehen in deinen bisherigen Stationen, du musst sie nur richtig verknüpfen. Bestanden ist die Probeprüfung ab sechs richtigen Antworten.',
      in: ['heizung.pi', 'heizung.regler', 'heizung.strecke', 'heizung.haus'], out: 'heizung.pr', type: 'pr.quiz', w: 100, pass: 75,
      form: QUESTIONS.map(q => ({ key: q[0], label: 'Frage ' + q[0].slice(1) + ': ' + q[1], type: 'number', unit: q[2] })),
      fromForm: v => { v = v || {}; const a = {}; QUESTIONS.forEach(q => { const x = numOf(v[q[0]]); if (fin(x)) a[q[0]] = x; }); return { answers: a, n: 8 }; },
      open: { ex: 'Fachgespräch' },
      hint: ['Die Fragen verlangen nur Zahlen aus deinen Stationen: Betriebsstrom und Spannungsfall stehen in Station 1, die Fühlerleitung im Lastenheft, die Kennwerte der Strecke in Station 4, die Reglerwerte in Station 5, die Einsparung in Station 8.',
        'Betriebsstrom I = P / U. Spannungsfall ΔU = 2 · l · I / (κ · A). Der Pt1000 hat bei 20 °C etwa 1078 Ω; der Fehler der Zweileiterschaltung ist 2 · R_L geteilt durch die Steigung von etwa 3,9 Ω/K.',
        'K_p und T_n liefert die Einstellregel aus K_s, T_u und T_g deiner Strecke. Die Regelbarkeit ist T_g / T_u. Die Einsparung steht in der Ausgabe deines Python-Programms.'],
      questions: ctx => questionList(ctx),
      check: safe(checkPr, 'Fachgespräch'),
      starter: ctx => ({ answers: {}, n: 0 }),
      solution: ctx => prSolution(ctx),
      mutants: [
        { name: 'Pt1000 bei 20 °C mit 1000 Ω', mutate: d => mutSlot(d, x => { x.answers.q3 = 1000; }), expectFail: ['Frage 3'] },
        { name: 'Zweileiterfehler mit einfachem Leitungswiderstand', mutate: d => mutSlot(d, x => { x.answers.q4 = rd(x.answers.q4 / 2, 4); }), expectFail: ['Frage 4'] },
        { name: 'zwei Antworten fehlen', mutate: d => mutSlot(d, x => { delete x.answers.q6; delete x.answers.q8; }), expectFail: ['Vollständigkeit'] }
      ] }
  ];

  /* ====================================================================== Bericht, Selbsttest, Projektdefinition */
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  function reportParts(slots, spec) {
    const P = isObj(spec) && isObj(spec.params) ? spec.params : spec || {}, g = k => (slots || {})[k] ? unwrap(slots[k]) : null;
    const ctx = { spec: { params: P }, slots: slots || {}, get: k => (slots || {})[k] }, out = [];
    out.push({ h: 'Lastenheft', rows: [['Heizgerät', fm(P.pHeiz / 1000, 1) + ' kW an ' + P.uNetz + ' V, Zuleitung ' + P.lZu + ' m'], ['Sollwert', P.wNutz + ' °C Mo bis Fr ' + P.nutzVon + ' bis ' + P.nutzBis + ' Uhr, Absenkung ' + P.dw + ' K'], ['Fühler', 'Pt1000, ' + P.wires + '-Leiter, Leitung ' + P.lFuehler + ' m'], ['Streckenversuch', 'Außentemperatur ' + P.tOutSprung + ' °C, y1 ' + y1Of(P) + ' %']] });
    const haus = g('heizung.haus'); if (haus) { const h = hausInfo(haus, P); out.push({ h: 'Stromkreis', rows: [['Betriebsstrom', fm(h.iB, 2) + ' A'], ['Leitungsschutz', h.c && h.c.breaker ? h.c.breaker.type + h.c.breaker.inA : '-'], ['Leitung', fm(h.mm2, 1) + ' mm², ' + fm(h.len, 0) + ' m'], ['Spannungsfall', fm(h.dUpct, 2) + ' %']] }); }
    const sen = g('heizung.sen'); if (sen && isObj(sen.ctl)) { const si = senInfo(sen); if (si.ok) out.push({ h: 'Messkette Pt1000', rows: [['Schaltung', String(sen.ctl.circuit) + ', Verstärkung ' + sen.ctl.gain + ', ' + sen.ctl.adcBits + ' Bit'], ['Auflösung', fm(si.res20, 3) + ' K je Digit'], ['Fehlerschwellen', sen.thr ? sen.thr.kurz + ' / ' + sen.thr.bruch : '-']] }); }
    const mess = g('heizung.mess'); if (mess) out.push({ h: 'Fühlerprüfung', rows: arr(mess.rows).map(r => [r.label || r.id, fm(+r.ist, 1) + ' ' + (r.unit || '') + ' (Soll ' + fm(+r.soll, 1) + ')']).concat([['Befund', arr(mess.findings).map(f => (fuehlerById(f) ? fuehlerById(f).name : String(f))).join(', ') || '-']]) });
    const sd = strInfo(g('heizung.strecke'), P); if (sd.ok) out.push({ h: 'Strecke', rows: [['K_s', fm(sd.Ks, 3) + ' K/% (' + fm(sd.KsNorm, 3) + ' %/%)'], ['T_u', fm(sd.Tu, 0) + ' s'], ['T_g', fm(sd.Tg, 0) + ' s'], ['Regelbarkeit', fm(sd.ratio, 1) + ', ' + sd.urteil]] });
    const reg = g('heizung.regler'); if (reg && isObj(reg.ctl)) out.push({ h: 'Regler', rows: [['Regel', String(reg.regel || '-')], ['K_p', fm(numOf(reg.ctl.kp), 2)], ['T_n', fm(numOf(reg.ctl.tn), 0) + ' s'], ['Sollwertrampe', fm(numOf(reg.ctl.wRamp), 3) + ' %/s']] });
    const ds = g('heizung.ds'); if (ds) { const st = stellById(itemId(ds, 'stellglied')); if (st) out.push({ h: 'Stellglied', rows: [['Typ', st.name], ['Kühlkörper', itemId(ds, 'kuehlkoerper') || '-'], ['T_j', fm(+(ds.calc || {}).tjC, 0) + ' °C']] }); }
    const code = g('heizung.code'); if (code && code.src) out.push({ h: 'Raumregler (Arduino)', html: '<pre>' + esc(code.src) + '</pre>' });
    const pi = g('heizung.pi'); if (pi && pi.out) out.push({ h: 'Wochenprotokoll (Python)', rows: arr(pi.out).map(x => { const m = /^([^=]+)=(.*)$/.exec(String(x)); return m ? [m[1], m[2]] : [String(x), '']; }) });
    return out;
  }
  function selfTest() {
    const r = [];
    try {
      const a = lastenheft(12345, 2), b = lastenheft(12345, 2);
      r.push({ ok: JSON.stringify(a) === JSON.stringify(b), text: 'Heizung: Lastenheft deterministisch' });
      const slots = {}, ctx = { spec: a, level: 2, tol: 1, slots: slots, get: k => slots[k] || null };
      let all = true;
      STATIONS.forEach(s => { const d = s.solution(ctx); slots[s.out] = d; const res = s.check(d, ctx), sum = res.lines.reduce((p, l) => p + l.pts, 0), got = res.lines.filter(l => l.ok).reduce((p, l) => p + l.pts, 0); if (got !== sum || sum !== 100) all = false; });
      r.push({ ok: all, text: 'Heizung: Musterlösungen aller Stationen 100 %' });
    } catch (e) { r.push({ ok: false, text: 'Heizung: Selbsttest Fehler ' + (e && e.message) }); }
    return r;
  }

  const def = {
    id: PID, name: 'Heizungsregelung für einen Raum', icon: '🌡️', prefix: 'vh', order: 7,
    story: 'Das Werkstatt-Büro der Tonfunk GmbH wird mit einem elektrischen Heizgerät beheizt, und im Winter schwankt die Temperatur zwischen kalt und stickig. Die Lehrwerkstatt baut eine Raumregelung: vom Stromkreis über Fühler und Strecke bis zum Regler im Arduino und der Wochenauswertung. Meister Funk sagt: „Ein Regler ist nur so gut wie seine Strecke. Miss sie, bevor du rechnest.“ Du planst den Stromkreis, baust die Messkette, prüfst den Fühler, nimmst die Strecke auf, stellst den Regler ein und programmierst ihn am Ende.',
    company: 'Tonfunk GmbH Ermsleben',
    labs: ['haus', 'sen', 'mess', 'reg', 'ds', 'code', 'pi', 'pr'],
    levels: { 1: { name: 'Einsteiger', pass: 70, tolMul: 1.5 }, 2: { name: 'Standard', pass: 80, tolMul: 1 }, 3: { name: 'Profi', pass: 90, tolMul: 0.6 } },
    lastenheft: lastenheft,
    faultKey: faultKey,
    stations: STATIONS,
    final: {
      id: 'vhF', title: 'Abschlusstest: Eine Winterwoche', check: finalCheck,
      solution: ctx => { const slots = {}, c = Object.assign({}, ctx, { get: k => slots[k] || null, slots: slots }); STATIONS.forEach(s => { slots[s.out] = s.solution(c); }); return { slots: slots }; },
      mutants: [
        { name: 'Sketch ohne Fühlerüberwachung', mutate: s => { s['heizung.code'] = { lang: 'arduino', src: 'void setup() {\n}\nvoid loop() {\n}\n', run: { serial: [] } }; return s; }, expectFail: ['Fühlerausfall'] },
        { name: 'Stromkreis ohne FI und mit B10', mutate: s => { s['heizung.haus'].circuits[0].breaker.inA = 10; return s; }, expectFail: ['Sicherheit'] },
        { name: 'P-Regler statt PI', mutate: s => { s['heizung.regler'].ctl.ctrl = 'P'; return s; }, expectFail: ['Komfort'] },
        { name: 'Skalierung der Messkette geändert', mutate: s => { s['heizung.sen'].scale.pts = s['heizung.sen'].scale.pts.map(p => [p[0], p[1] + 0.8]); return s; }, expectFail: ['Konsistenz'] }
      ]
    },
    kpis: ['komfort', 'energie', 'einsparung', 'ueberschwingen', 'fuehler', 'spannungsfall'],
    report: reportParts,
    selfTest: selfTest,
    _test: { weekModel: weekModel, weekFor: weekFor, weekStats: weekStats, makeSim: makeSim, wTarget: wTarget, toutOf: toutOf, winsOf: winsOf, strInfo: strInfo, regRun: regRun, guete: guete, musterGuete: musterGuete, musterCtl: musterCtl, ruleOf: ruleOf, REGELN: REGELN,
      senInfo: senInfo, senRun: senRun, scalePts: scalePts, skal: skal, codeAt: codeAt, fuehlerVals: fuehlerVals, fuehlerSoll: fuehlerSoll, hausInfo: hausInfo, stellCalc: stellCalc, pyHeader: pyHeader, quizTruth: quizTruth, sketchSource: sketchSource, sketchCtx: sketchCtx,
      clRun: clRun, refSketch: refSketch, reglerCfg: reglerCfg, bruchEval: bruchEval, skalEval: skalEval, scenA: scenA, scenB: scenB, scenC: scenC, FACH: FACH, FUEHLER: FUEHLER, STELLGLIEDER: STELLGLIEDER, ptR: ptR, ptSlope: ptSlope, dT2L: dT2L, rLeitung: rLeitung, y1Of: y1Of, RP: RP, QUESTIONS: QUESTIONS, PY_SRC: PY_SRC, FRAME: FRAME, kvLine: kvLine, fensterOf: fensterOf },
    demos: [{ id: 'bis4', name: 'Heizungsregelung bis Station 4', upTo: 'vh4' }, { id: 'fertig', name: 'Heizungsregelung fertig', upTo: 'vhF' }]
  };

  /* ---------- Registrierung ---------- */
  const V = root.Verbund || (typeof require === 'function' && typeof module !== 'undefined' ? (function () { try { return require('./verbund.js'); } catch (e) { return null; } })() : null);
  if (V && typeof V.registerProject === 'function') V.registerProject(def);
  else { root.VERBUND_QUEUE = root.VERBUND_QUEUE || []; root.VERBUND_QUEUE.push(def); }
  if (typeof module !== 'undefined' && module.exports) module.exports = def;
  root.VERBUND_HEIZUNG = def;
})(typeof window !== 'undefined' ? window : globalThis);
