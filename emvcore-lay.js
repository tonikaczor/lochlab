/* emvcore-lay.js - EMV-Lab Kern Teil 2 (WP1c): Layout, Impulse und Schutz, Messen. Erweitert EMV_CORE um
 *   EMV_CORE.layout  (cases, solve, area, returnSplit, ftOf, lloop, eDb, limit3, pdn, pdnCurve, xtalk, hit, solvedOpts, ...)
 *   EMV_CORE.pulse   (esd, burst, surge)
 *   EMV_CORE.protect (parts, esdIO, bounce, burstLine, surge, varistor)
 *   EMV_CORE.device  (params, verdict)
 *   EMV_CORE.meas    (probe, nearField, nearSources, analyzer, rbwFor, markerAt, lisn)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: nach emvcore.js laden (haengt sich an window.EMV_CORE). Node: holt emvcore.js per require,
 * module.exports = EMV_CORE. Vanilla-JS, keine Abhaengigkeiten, kein eval. Alles Uebungswerte (Uebungsanlage), keine Vorhersage echter Geraete.
 * Herstellerdokumentation und aktuelle Norm massgeblich.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte ohne Felder,
 *    negative oder riesige Werte) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }.
 *    Gueltigkeitsgrenzen melden valid:false mit Text und rechnen nie still weiter.
 *  - Einheiten: Layout in mm / mm^2 / nH (Welt 100 x 70 mm), Strom i in A, Frequenz in Hz. Impulse und Schutz in SI (s, V, A, J, F, ohm, H).
 *    Messen: Laengen als Zahl <= 1 in METERN, > 1 in MILLIMETERN (nur lead und dnear; bei Unsicherheit leadMm / dnearMm benutzen).
 *  - Ampel-Ids ASCII: 'gruen' | 'gelb' | 'rot' | 'grau'.
 *  - Determinismus: Zufall nur ueber EMV_CORE.rng(seed) (mulberry32; Analysator-Rauschen, seed 1).
 *  - Texte stehen einmal in TEXTS_LAY (hier) und sind unter EMV_CORE.TEXTS.lay veroeffentlicht.
 *
 * ===================================================================================================
 * SCHNITTSTELLEN (Abschnitt 4.7 bis 4.9 der SPEC ist massgeblich; Festlegungen, die dort offen waren, siehe ABWEICHUNGEN.md, Abschnitt WP1c)
 *
 *  layout.cases[12]  { id, title, kurz, world:{w,h}, stackDefault, parts:[{kind,x,y,w,h,label}], forward:[[x,y]..], plane:{rect:[x,y,w,h],slits:[{x0,y0,x1,y1}]}|null,
 *                      fixes:[{id,text,patch,target,skipIf?}] (<= 3), defects:[{id,rect:[x,y,w,h],text,fix}] (<= 5), f0 (Hz), i0 (A), notes,
 *                      solution:{fixes:{fix1..},stack}, pdn? (Fall hat Abblock-Zweige), xt? (Fall hat Parallelfuehrung) }
 *  layout.solve(id, {fixes:{fix1,fix2,fix3}, stack:'2'|'2gnd'|'4', f (Hz), i (A)}) -> { ok, id, forward, ret, area (mm2), areaRef, areaDirectMm2, detourMm, len (mm), lloop (nH),
 *      ft (Hz), split:{hf,lf}, eDb (dBuV/m bei 3 m), eRef, eRel, margin (dB), limit3, ampel, limitFree?, valid, why?, iEff (A), stack, hStack (mm),
 *      pdn?:{lTot (nH), lMount (nH, ungünstigster Zweig), fres (Hz), z100 (ohm), zPeak, antires:[{f,z}], branches:[{id,C,esr,esl,lloop,nvia,viaL,lmount,d,fres}],
 *            abbl:{c,lmountH,eslH}}, xtalk?:{kdB,uKap,uInd,...}, defectsActive:[ids], parts, slits, vias, plane, f, i, fixes }
 *      ret ist wie forward von Start nach Ende gespeichert (Rueckstrom laeuft entgegen); Polygon = forward + umgekehrtes ret.
 *      Ohne Massefflaeche (Lagenaufbau '2') ist res.plane = null, ft = 0, split = {hf:1, lf:0} (der Rueckstrom fliesst im Rueckleiter).
 *      Liegt f unter 30 MHz (kein Grenzwert in der Uebungsgrenzlinie): margin = NaN, ampel = 'grau', limitFree = true (nie "bestanden").
 *  layout.area(poly) mm2 | NaN ; layout.returnSplit(f, ft) -> {hf, lf} ; layout.ftOf(hMm) Hz ; layout.lloop(areaMm2, wMm, hMm) nH ;
 *  layout.eDb(f, areaMm2, i, r=3) dBuV/m ; layout.limit3(f) dBuV/m | null ; layout.crossProfile(x, hMm) (relative Verteilung 1/(1+(x/h)^2)).
 *  layout.pdn(branches, f) -> {ok, z (ohm), re, im, phase}; layout.pdnCurve(branches, fList?) -> {ok, f[], z[], points:[[f,z]..], zmin:{f,z}, antires:[{f,z}], fres:[Hz..]}
 *      Zweig: { C (F), esr (ohm), esl (H), lmount (H) | lloop (H) + nvia (Anzahl) + viaL (H, Standard 0,8 nH), id? }
 *  layout.hit(id, x, y, fixes) -> defect | null (Toleranz 3 mm; nur Fehler, deren Massnahme noch nicht aktiv ist)
 *  layout.solvedOpts(id) -> {fixes, stack} (vollstaendig behobener Zustand), layout.baseOpts(id) -> Ausgangszustand {fixes:{}, stack, f, i}
 *
 *  pulse.esd(kV, mode) -> { ok, t (s), i (A), ip, tr (s, 10-90 %), i30, i60, kV, mode, hbm:{c,r,e (J),iIdeal} }    (Zeitachse 0..150 ns, Schritt 0,05 ns)
 *  pulse.burst(kV, {fRep}) -> { ok, t, u (V, Einzelimpuls 0..250 ns), pulseT:[s..] (75), n, fRep, gap (s), tBurst (s), tRepeat, tr, th, kV }
 *  pulse.surge(kV, {zi}) -> { ok, t, u (V, 1,2/50), i (A, 8/20), zi, T1, T2, T1i, T2i, ipk }
 *  protect.parts {tvs:{id:{vbr,rdyn,ct,eMax}}, var:{id:{vacMax,v1mA,vc100,eMax,alpha}}} ; protect.varistor(id|part) -> {alpha, i(v)}
 *  protect.esdIO({kV, tvs, rs, cbuf, cp, cin, vdd}) -> { ok, t, vp, vq, itvs, iesd, vqPeak, vpPeak, wTvs (J), wClamp (J), qIn, qCap, qTvs, qClamp, tvs }
 *  protect.bounce({kV, lg (H) | masse:'g360'|'g50'|'lose', rg, kk, rrst, crst, vdd}) -> { ok, t, dv, vrst, vrstMin, tBelow (s), tBelowVil, lg, ... }
 *  protect.burstLine({kV, fRep, n, cc, rin, cin, vclamp?}) -> { ok, n, tau, gap, dStep (V je Impuls), v:[Treppe nach jedem Impuls], vN, vInf, treppe (tau > gap), t[], vt[] }
 *  protect.surge({kV, zi, var:'v230'|.., rload, uNetz}) -> { ok, t, v, i, iVar, vPeak, iPeak, w (J), wLimit, dauer:{u, vacMax, ok} }
 *  device.params {vdd, vabs, vil, vih, tglitch, tresetMin, surgeVmax} ; device.verdict(sim, kind, params) -> { ok, kriterium:'A'|'B'|'C'|'Ausfall', ampel, text, why:[..], notes:[..], vq, vabs, resetNs, resetV, vil, nGlitch, nReset }
 *      kind: 'esd' (Ergebnis esdIO), 'bounce' (bounce), 'burst' (burstLine), 'surge' (protect.surge)
 *
 *  meas.probe({amp, rsrc, trs, lead:'klemme'|'kurz'|'feder'|mm|m, teiler:'x10'|'x1', cp?, bwTk (Hz), bwOsz (Hz), didt (A/s), dnear|d (m)})
 *      -> { ok, zeta, fr, os, osMeas, lgH, cpF, trMess, trTk, trOsz, trLoad, trWave, trFehler, bw, bwSys, pick, area, t[], vTrue[], vMeas[], ... }
 *  meas.nearField(cfg, x, y) -> Zahl (dB relativ zum Maximum der Karte, <= 0), x,y in mm; meas.nearField.grid(cfg) -> {nx, ny, w, h, db[ny][nx], hot:[..]}
 *  meas.analyzer(lines[{f,L}], {fStart, fStop, rbw?, floor?, points?, seed?, sweeps?}) -> { ok, f[], L[], points, rbw, floor, hidden:[..], visible:[..], max, markerAt(f) }
 *  meas.lisn { z(f), level(iPeak, 'gt'|'gg'), R:{gt:25, gg:50}, L (H) }
 * ===================================================================================================
 */
(function (root) {
  'use strict';

  /* ---------- EMV_CORE finden (Browser: Ladereihenfolge emvcore.js zuerst; Node: require) ---------- */
  let CORE = root.EMV_CORE;
  if (!CORE && typeof require === 'function') {
    try { CORE = require('./emvcore.js'); } catch (e) { CORE = null; }
    if (!CORE) { try { CORE = require('emvcore.js'); } catch (e2) { CORE = null; } }
  }
  if (!CORE) {
    if (typeof console !== 'undefined' && console.warn) console.warn('emvcore-lay.js: emvcore.js fehlt - Teil 2 läuft mit eigener Mindest-Basis.');
    CORE = {};
    if (!root.EMV_CORE) root.EMV_CORE = CORE;
  }

  /* ---------- Hilfsfunktionen ---------- */
  const TWO_PI = 2 * Math.PI, LN10 = Math.LN10;
  const C0 = 299792458, MU0 = 4 * Math.PI * 1e-7, EPS0 = 1 / (MU0 * C0 * C0), Z0 = MU0 * C0;
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.trim().replace(',', '.')); return isFinite(x) ? x : d; }
    return d;
  }
  function pos(v, d) { const x = num(v, NaN); return x > 0 ? x : d; }
  /* ov: nicht angegeben (undefined/null) gibt den Standard, jede angegebene ungueltige Eingabe gibt NaN (wird dann abgewiesen) */
  function ov(v, d) { return v === undefined || v === null ? d : num(v, NaN); }
  function nn(v, d) { const x = num(v, NaN); return x >= 0 ? x : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function obj(o) { return isObj(o) ? o : {}; }
  function log10(x) { return Math.log(x) / LN10; }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function clone(x) { return x === undefined ? undefined : JSON.parse(JSON.stringify(x)); }
  /* N: Rechenfunktion -> NaN bei Ausnahme. S: Strukturfunktion -> { ok:false, why }. A: Liste. */
  function N(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail(TEXTS_LAY.intern); } }; }
  function Gn(fn, bad) { return function () { try { return fn.apply(this, arguments); } catch (e) { return bad; } }; }
  const uv = x => (x > 0 ? 20 * log10(x / 1e-6) : NaN);                 // Effektwert in V -> dBuV
  function dbSum(list) { let s = 0; for (let i = 0; i < list.length; i++) s += Math.pow(10, list[i] / 10); return 10 * log10(s); }
  /* Zahlenausgabe mit Dezimalkomma (EMV_CORE.fmt, sonst eigene Version) */
  function fm(x, d) {
    if (CORE && typeof CORE.fmt === 'function') { try { const s = CORE.fmt(x, d); if (typeof s === 'string') return s; } catch (e) { /* Notfall */ } }
    if (!fin(x)) return '–';
    let s = (d === undefined ? String(Number(x.toPrecision(4))) : x.toFixed(clamp(Math.round(d), 0, 10)));
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('.', ',');
  }
  const PREF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function eng(x, unit) {
    if (CORE && typeof CORE.fmtEng === 'function') { try { const s = CORE.fmtEng(x, unit); if (typeof s === 'string') return s; } catch (e) { /* Notfall */ } }
    if (!fin(x)) return '–';
    if (x === 0) return '0 ' + (unit || '');
    const a = Math.abs(x); let p = PREF[PREF.length - 1];
    for (let i = 0; i < PREF.length; i++) if (a >= PREF[i][0] * 0.9995) { p = PREF[i]; break; }
    const v = x / p[0];
    return String(Number(v.toPrecision(3))).replace('.', ',') + ' ' + p[1] + (unit || '');
  }
  function rngOf(seed) {
    if (CORE && typeof CORE.rng === 'function') { try { const r = CORE.rng(seed); if (r && typeof r.next === 'function') return r; } catch (e) { /* Notfall */ } }
    let a = (seed >>> 0) || 1;
    return {
      next() { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
      normal() { return Math.sqrt(-2 * Math.log(this.next() + 1e-12)) * Math.cos(TWO_PI * this.next()); }
    };
  }
  function ampelOfMargin(m) {
    if (!fin(m)) return 'grau';
    try {
      if (CORE && CORE.assess && typeof CORE.assess.margin === 'function') {
        let r = CORE.assess.margin(m); if (r && typeof r === 'object') r = r.ampel;
        r = String(r || '').toLowerCase().replace('ü', 'ue');
        if (r === 'gruen' || r === 'gelb' || r === 'rot' || r === 'grau') return r;
      }
    } catch (e) { /* Notfall */ }
    return m >= 6 ? 'gruen' : m >= 0 ? 'gelb' : 'rot';
  }

  /* ---------- Texte (einzige Quelle dieser Datei; veroeffentlicht unter EMV_CORE.TEXTS.lay) ---------- */
  const TEXTS_LAY = {
    intern: 'Mit diesen Werten gibt es kein Ergebnis.',
    caseUnknown: 'Diesen Layout-Fall gibt es nicht.',
    stackUnknown: 'Diesen Lagenaufbau gibt es nicht (erlaubt: 2, 2gnd, 4).',
    freqBad: 'Die Frequenz muss eine Zahl größer als 0 sein.',
    strom: 'Der Strom muss eine Zahl größer als 0 sein.',
    geomLeer: 'Die Leiterbahn hat keine Länge: Es gibt keine Schleife.',
    klein: 'Die Schleife ist elektrisch nicht mehr klein (√A = {w} ≥ λ/10 = {l10}): Die Abstrahlformel gilt nur für kleine Schleifen, der Pegel ist nur eine Größenordnung.',
    keinGrenzwert: 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert: Die Ampel bleibt grau.',
    ohneFlaeche: 'Ohne Massefläche ist der Rückleiter eine eigene Leitung; die Schleife ist so groß wie der Abstand zwischen Hin- und Rückleiter.',
    zweig: 'Dieser Abblockzweig ist ungültig (Kapazität und Induktivität müssen größer als 0 sein).',
    zweigeLeer: 'Es gibt keinen Abblockzweig.',
    listeZuLang: 'Die Liste ist zu lang.',
    geomUnmoeglich: 'Die Geometrie ist unmöglich (der Drahtradius muss kleiner als Höhe und halber Abstand sein).',
    xtLang: 'Die Leitung ist elektrisch lang (ℓ = {len} > λ/10 = {l10}): Das Modell aus Koppelkapazität und Gegeninduktivität gilt nur für elektrisch kurze Leitungen, der Pegel ist nur eine Größenordnung.',
    esdKV: 'Die Prüfspannung muss zwischen 0 und {max} kV liegen.',
    esdMode: 'Die Entladungsart gibt es nicht (erlaubt: kontakt, luft).',
    pegel: 'Der Pegel muss zwischen 0 und {max} kV liegen.',
    schutzUnbekannt: 'Dieses Schutzbauteil gibt es nicht.',
    wertBad: 'Ein Wert ist keine gültige Zahl oder liegt außerhalb des erlaubten Bereichs.',
    simFehlt: 'Es liegt keine gültige Simulation vor.',
    kindUnbekannt: 'Diese Prüfart gibt es nicht (erlaubt: esd, bounce, burst, surge).',
    tkWert: 'Mit diesen Werten gibt es keinen Tastkopf-Aufbau (Quellwiderstand, Flankenzeit und Amplitude müssen größer als 0 sein).',
    tkLead: 'Diesen Masseanschluss gibt es nicht (erlaubt: klemme, kurz, feder).',
    tkTeiler: 'Diesen Tastkopf-Teiler gibt es nicht (erlaubt: x10, x1).',
    anaLinien: 'Es gibt keine gültigen Linien (jede Linie braucht Frequenz und Pegel).',
    anaBereich: 'Der Frequenzbereich ist ungültig (Start muss kleiner als Stopp sein, beide größer als 0).',
    unterRauschen: 'Unter dem Eigenrauschen des Analysators nicht messbar.',
    nahWert: 'Mit diesen Werten gibt es keine Nahfeldkarte.',
    esdUnbekannt: 'Mit diesen Werten gibt es keine Entladung.',
    /* Aussagen mit Zahlen (Vorlagen; die Zahlen kommen aus der Rechnung) */
    umweg: 'Der Rückstrom muss einen Umweg von {d} mm nehmen: Schleifenfläche {a} mm² statt {a0} mm².',
    abblWeit: 'Der Kondensator ist {l} nH vom Pin entfernt: Seine Wirkung endet bei {f}.',
    antires: 'Antiresonanz bei {f}: Die Impedanz steigt auf {z} Ω.',
    esdAusfall: 'Spitze am Eingang {vq} V, höchstzulässig {vabs} V: Das Bauteil wird zerstört.',
    esdTvsEnergie: 'Das Schutzbauteil nimmt {w} mJ auf, zulässig sind {wl} mJ: Es wird zerstört.',
    esdReset: 'Der Reset-Pegel fiel {t} unter {v} V: Das Gerät startet neu (Kriterium B).',
    esdDaten: 'Der Pegel am Eingang lag {n}-mal länger als {tg} über {vih} V (Spitze {vq} V): Datenfehler (Kriterium B).',
    esdOk: 'Spitze am Eingang {vq} V bei höchstzulässig {vabs} V, kein Datenfehler und kein Reset: Kriterium A.',
    burstDaten: '{n} von {np} Impulsen lassen die Leitung über {vih} V liegen (Treppe bis {v} V): Datenfehler (Kriterium {k}).',
    burstOk: 'Die Treppe erreicht {v} V und bleibt unter {vih} V: Kriterium A.',
    burstTreppe: 'Die Impulse addieren sich: nach {n} Impulsen {v} V (τ = {tau}, Impulsabstand {gap}).',
    surgeAusfall: 'Spitze {v} V am Netzeingang, höchstzulässig {vmax} V: Das Gerät wird zerstört.',
    surgeEnergie: 'Der Varistor nimmt {w} J auf (Grenze {wl} J): Er wird zerstört.',
    surgeOk: 'Spitze {v} V bei höchstzulässig {vmax} V, Varistor nimmt {w} J (Grenze {wl} J): Kriterium A.',
    varDauer: 'Dauerspannung {u} V über Vac,max {vac} V: Der Varistor wird warm und altert.',
    varEnergie: 'Der Varistor nimmt {w} J auf (Grenze {wl} J).',
    tkRing: 'Der lange Masseanschluss ({l} nH) schwingt mit der Tastkopfkapazität bei {f}: Überschwinger {os} %. Nimm den Federkontakt.',
    tkPick: 'Die Masseschleife fängt {v} Störspannung ein.',
    kriterium: {
      A: 'Kriterium A: normales Verhalten während und nach der Störung.',
      B: 'Kriterium B: kurze Beeinträchtigung, das Gerät erholt sich selbst.',
      C: 'Kriterium C: Bedienereingriff nötig.',
      Ausfall: 'Ausfall: Das Bauteil ist defekt.'
    }
  };
  function tx(id, vars) {
    let t = TEXTS_LAY[id]; if (typeof t !== 'string') return '';
    return t.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? String(vars[k]) : ''; });
  }
  try { if (CORE.TEXTS && typeof CORE.TEXTS === 'object' && !CORE.TEXTS.lay) CORE.TEXTS.lay = TEXTS_LAY; } catch (e) { /* TEXTS ist optional */ }

  /* =====================================================================================================
   *  4.7 LAYOUT
   * ===================================================================================================== */
  const STACKS = { '2': { h: 0, name: '2 Lagen ohne Fläche' }, '2gnd': { h: 1.5, name: '2 Lagen, Massefläche auf der Gegenseite' }, '4': { h: 0.2, name: '4 Lagen, Massefläche unter der Signallage' } };
  const STACK_RANK = { '2': 0, '2gnd': 1, '4': 2 };
  const CU_T = 35e-6, SIGMA_CU = 5.8e7;              // Kupfer 35 µm, 5,8e7 S/m
  const SPREAD = 1.0;                                // Aufweitung des Rueckstroms vor dem Schlitz: je Seite 1,0 * Umweg (45 Grad, A20)
  const SLIT_HALF = 0.5;                             // halbe Schlitzbreite in mm (Schleifenbreite am Umweg)
  const END_CLEAR = 0.5;                             // Rueckstrom laeuft 0,5 mm hinter dem Schlitzende herum
  const W_DEFAULT = 0.25;                            // Leiterbahnbreite mm
  const GND_DEFAULT = 8;                             // Standardabstand des Rueckleiters ohne Flaeche, mm
  const VIA_NH = 0.8;                                // Via-Induktivitaet nH (A20)
  const R_FIELD = 3;                                 // Messabstand m
  const K_RAD = 2.63e-14;                            // E = 2,63e-14 * f^2 * A * i / r  (Spitzenwert mit Spiegelung, A16/A20)
  const LIM_ID = 'str-B-10m';
  const FALL_PLANE = [3, 3, 94, 64];

  const ftOf = N(function (hMm) {
    hMm = pos(hMm, NaN); if (!(hMm > 0)) return NaN;
    return (1 / (SIGMA_CU * CU_T)) / (TWO_PI * MU0 * hMm * 1e-3);
  });
  const returnSplit = S(function (f, ft) {
    f = num(f, NaN); ft = num(ft, NaN);
    if (!(f > 0) || !(ft >= 0)) return fail(TEXTS_LAY.freqBad, { hf: NaN, lf: NaN });
    const hf = ft === 0 ? 1 : (f * f) / (f * f + ft * ft);
    return { ok: true, hf: hf, lf: 1 - hf };
  });
  const lloop = N(function (areaMm2, wMm, hMm) {
    areaMm2 = nn(areaMm2, NaN); wMm = pos(wMm, NaN); hMm = pos(hMm, NaN);
    if (!(areaMm2 >= 0) || !(wMm > 0) || !(hMm > 0)) return NaN;
    return (MU0 * areaMm2 * 1e-6 / ((wMm + 2 * hMm) * 1e-3)) * 1e9;
  });
  const eDbOf = N(function (f, areaMm2, i, r) {
    f = pos(f, NaN); areaMm2 = pos(areaMm2, NaN); i = pos(i, NaN); r = pos(r, R_FIELD);
    if (!(f > 0) || !(areaMm2 > 0) || !(i > 0)) return NaN;
    return uv(K_RAD * f * f * areaMm2 * 1e-6 * i / r / Math.SQRT2);
  });
  /* Grenzlinie bei 3 m (Uebungsgrenzlinie str-B-10m, 10 m -> 3 m: + 20*lg(10/3)) oder null (kein Grenzwert) */
  const D_CONV = 20 * log10(10 / R_FIELD);
  function limit10(f) {
    try {
      if (CORE && CORE.limits && typeof CORE.limits.at === 'function') { const g = CORE.limits.at(LIM_ID, f); if (g === null || g === undefined) return null; if (fin(g)) return g; }
    } catch (e) { /* Notfall */ }
    if (!(f >= 30e6 && f <= 1e9)) return null;
    return f <= 230e6 ? 30 : 37;
  }
  const limit3 = function (f) { try { f = pos(f, NaN); if (!(f > 0)) return null; const g = limit10(f); return fin(g) ? g + D_CONV : null; } catch (e) { return null; } };
  const crossProfile = N(function (x, hMm) { x = num(x, NaN); hMm = pos(hMm, NaN); if (!fin(x) || !(hMm > 0)) return NaN; return 1 / (1 + (x / hMm) * (x / hMm)); });

  /* ---- Geometrie ---- */
  function pathLen(p) { let s = 0; for (let k = 1; k < p.length; k++) s += Math.hypot(p[k][0] - p[k - 1][0], p[k][1] - p[k - 1][1]); return s; }
  function shoelace(poly) {
    let s = 0; const n = poly.length;
    for (let k = 0; k < n; k++) { const a = poly[k], b = poly[(k + 1) % n]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  const areaFn = N(function (poly) {
    if (!isArr(poly) || poly.length < 3 || poly.length > 5000) return NaN;
    const p = [];
    for (let k = 0; k < poly.length; k++) {
      const q = poly[k]; let x, y;
      if (isArr(q)) { x = num(q[0], NaN); y = num(q[1], NaN); } else if (isObj(q)) { x = num(q.x, NaN); y = num(q.y, NaN); } else return NaN;
      if (!fin(x) || !fin(y)) return NaN; p.push([x, y]);
    }
    return shoelace(p);
  });
  function unit(a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l > 0 ? [dx / l, dy / l] : [1, 0]; }
  /* Versatz der Polylinie um d mm nach LINKS (Linksnormale (-uy, ux), y zeigt nach unten), Gehrung an den Ecken (begrenzt) */
  function offsetPath(p, d) {
    const n = p.length; if (n < 2) return p.map(q => q.slice());
    const u = []; for (let k = 0; k < n - 1; k++) u.push(unit(p[k], p[k + 1]));
    const out = [];
    for (let k = 0; k < n; k++) {
      let nx, ny, scale = 1;
      if (k === 0) { nx = -u[0][1]; ny = u[0][0]; }
      else if (k === n - 1) { nx = -u[n - 2][1]; ny = u[n - 2][0]; }
      else {
        const n1 = [-u[k - 1][1], u[k - 1][0]], n2 = [-u[k][1], u[k][0]], bx = n1[0] + n2[0], by = n1[1] + n2[1], b2 = bx * bx + by * by;
        if (b2 < 1e-9) { nx = n1[0]; ny = n1[1]; }
        else { const m = 2 / b2; nx = bx * m; ny = by * m; const ml = Math.hypot(nx, ny); if (ml > 2.5) { nx *= 2.5 / ml; ny *= 2.5 / ml; } }
      }
      out.push([p[k][0] + nx * d * scale, p[k][1] + ny * d * scale]);
    }
    return out;
  }
  function segCross(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-12) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, w = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den;
    if (t < 0 || t >= 1 || w < 0 || w > 1) return null;
    return { t: t, w: w, x: a[0] + t * r[0], y: a[1] + t * r[1] };
  }
  function distPtSeg(p, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1], l2 = vx * vx + vy * vy;
    let u = l2 > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2 : 0; u = clamp(u, 0, 1);
    return Math.hypot(p[0] - (a[0] + u * vx), p[1] - (a[1] + u * vy));
  }

  /* ---- Faelle (Welt 100 x 70 mm, y nach unten) ---- */
  const FIXN = ['fix1', 'fix2', 'fix3'];
  function capPart(x, y, label) { return { kind: 'cap', x: x - 2, y: y - 1.2, w: 4, h: 2.4, label: label || '' }; }
  function ic(x, y, w, h, label) { return { kind: 'ic', x: x, y: y, w: w, h: h, label: label || '' }; }
  const CASES = [
    {
      id: 'rueck', title: 'Rückstrom unter der Leiterbahn', stackDefault: '2gnd', f0: 1e8, i0: 0.031,
      kurz: 'Eine Leiterbahn über durchgehender Massefläche: Der Hochfrequenz-Rückstrom fließt direkt unter dem Hinleiter.',
      parts: [{ kind: 'conn', x: 3, y: 29, w: 11, h: 12, label: 'Stecker' }, ic(86, 28, 11, 14, 'IC')],
      forward: [[14, 35], [86, 35]], plane: { rect: FALL_PLANE.slice(), slits: [] },
      fixes: [],
      defects: [{ id: 'd1', rect: [20, 31, 60, 8], text: 'Der Hinleiter liegt weit über der Massefläche: Hin- und Rückstrom spannen eine große Schleife auf. Ein dünnerer Lagenabstand (vier Lagen) verkleinert sie.', fix: 'stack' }],
      notes: 'Referenzfall: Der Rückstrom sucht oberhalb der Übergangsfrequenz ft den Weg unter dem Hinleiter. Verkleinere die Schleife mit dem Lagenaufbau.'
    },
    {
      id: 'schlitz', title: 'Signal quert einen Schlitz in der Massefläche', stackDefault: '2gnd', f0: 1e8, i0: 0.0045,
      kurz: 'Die Leiterbahn quert einen Schlitz in der Massefläche: Der Rückstrom muss um das Schlitzende herum.',
      parts: [ic(3, 29, 11, 12, 'IC 1'), ic(86, 28, 11, 14, 'IC 2')],
      forward: [[14, 35], [86, 35]], plane: { rect: FALL_PLANE.slice(), slits: [{ x0: 50, y0: 12, x1: 50, y1: 64 }] },
      fixes: [
        { id: 'fix1', text: 'Bahn über das Schlitzende hinweg umlegen', target: 'area', skipIf: ['fix2'], patch: { forward: [[14, 35], [28, 6], [72, 6], [86, 35]] } },
        { id: 'fix2', text: 'Schlitz schließen', target: 'area', patch: { slits: [] } },
        { id: 'fix3', text: 'Brücken-Kondensator neben die Bahn setzen', target: 'area', patch: { bridges: [[50, 39]], partsAdd: [{ kind: 'cap', x: 47.5, y: 37.8, w: 5, h: 2.4, label: 'C' }] } }
      ],
      defects: [
        { id: 'd1', rect: [45, 30, 10, 10], text: 'Die Bahn quert den Schlitz: Der Rückstrom findet unter der Bahn keine Fläche mehr.', fix: ['fix1', 'fix2', 'fix3'] },
        { id: 'd2', rect: [45, 4, 10, 8], text: 'Am Schlitzende läuft der Rückstrom herum: Der Umweg macht die Schleife groß.', fix: ['fix2', 'fix3'] },
        { id: 'd3', rect: [46, 44, 8, 20], text: 'Ein Schlitz in der Massefläche (zum Beispiel für ein Kabel oder eine Trennung) ist selten nötig.', fix: 'fix2' }
      ],
      notes: 'Der Rückstrom kann den Schlitz nicht queren. Er läuft um das Ende herum: Die Schleifenfläche wächst mit dem Umweg.'
    },
    {
      id: 'split', title: 'Massesplit zwischen Analog und Digital', stackDefault: '2gnd', f0: 1e8, i0: 0.004,
      kurz: 'Die Massefläche ist in Analog und Digital getrennt, ein Signal quert den Split: Der Rückstrom läuft zum Verbindungspunkt.',
      parts: [ic(3, 29, 11, 12, 'Analog'), ic(86, 28, 11, 14, 'Digital')],
      forward: [[14, 35], [86, 35]], plane: { rect: FALL_PLANE.slice(), slits: [{ x0: 50, y0: 3, x1: 50, y1: 67 }] }, bridges: [[50, 60]],
      fixes: [
        { id: 'fix1', text: 'Signal nicht über den Split führen, sondern über den Verbindungspunkt', target: 'area', skipIf: ['fix2'], patch: { forward: [[14, 35], [34, 60], [66, 60], [86, 35]] } },
        { id: 'fix2', text: 'Masseflächen an einem Punkt neben dem Signal verbinden', target: 'area', patch: { bridges: [[50, 38]], partsAdd: [{ kind: 'res', x: 49, y: 37, w: 2, h: 2, label: '' }] } }
      ],
      defects: [
        { id: 'd1', rect: [45, 30, 10, 10], text: 'Das Signal quert den Split: Der Rückstrom hat unter der Bahn keine Fläche.', fix: ['fix1', 'fix2'] },
        { id: 'd2', rect: [45, 54, 10, 10], text: 'Der Verbindungspunkt der beiden Massen liegt weit vom Signal entfernt: Der Rückstrom macht einen langen Umweg.', fix: ['fix1', 'fix2'] }
      ],
      notes: 'Ein Massesplit hilft nur, wenn kein Signal ihn quert. Quert eines, muss der Rückstrom zum Verbindungspunkt laufen.'
    },
    {
      id: 'takt', title: 'Taktleitung mit entferntem Rückleiter auf zwei Lagen', stackDefault: '2', f0: 1e8, i0: 0.0021,
      kurz: 'Zwei Lagen ohne Massefläche: Die Taktleitung und ihr Rückleiter liegen weit auseinander, die Schleife ist riesig.',
      parts: [{ kind: 'xtal', x: 2, y: 19, w: 8, h: 12, label: 'Takt' }, ic(90, 19, 8, 12, 'IC')],
      forward: [[10, 25], [90, 25]], plane: null, gndOffset: 25,
      fixes: [
        { id: 'fix1', text: 'Masseleitung eng neben die Taktleitung legen', target: 'area', patch: { gndOffset: 2 } },
        { id: 'fix2', text: 'Massefläche auf der Gegenseite einführen', target: 'area', patch: { stackMin: '2gnd' } },
        { id: 'fix3', text: 'Taktleitung kürzer führen', target: 'area', patch: { forward: [[10, 25], [50, 25]], parts: [{ kind: 'xtal', x: 2, y: 19, w: 8, h: 12, label: 'Takt' }, ic(50, 19, 8, 12, 'IC')] } }
      ],
      defects: [
        { id: 'd1', rect: [10, 28, 80, 24], text: 'Zwischen Taktleitung und Rückleiter liegt eine große Fläche: Hier entsteht die Schleife.', fix: ['fix1', 'fix2'] },
        { id: 'd2', rect: [10, 20, 80, 10], text: 'Die Taktleitung ist lang: Jeder Millimeter vergrößert die Schleife.', fix: 'fix3' }
      ],
      notes: 'Ohne Massefläche muss die Schleife durch einen eng geführten Rückleiter klein gehalten werden; eine Massefläche macht das von selbst.'
    },
    {
      id: 'abblock-weit', title: 'Abblockkondensator weit vom IC', stackDefault: '2gnd', f0: 1e8, i0: 0.05,
      kurz: 'Der Abblockkondensator sitzt weit vom Versorgungspin: Die Zuleitung ist Teil der Stromschleife und hat Induktivität.',
      parts: [ic(80, 28, 17, 14, 'IC')], forward: [[80, 35], [40, 35]], plane: { rect: FALL_PLANE.slice(), slits: [] },
      pdn: { origin: [80, 35], dir: [-1, 0], viaNH: VIA_NH, branches: [{ id: 'c1', C: 100e-9, esr: 0.02, esl: 1.2e-9, d: 40, nvia: 2 }] },
      fixes: [
        { id: 'fix1', text: 'Kondensator unmittelbar an den Versorgungspin setzen', target: 'area', patch: { pdn: { dAll: 3 } } },
        { id: 'fix2', text: 'Via direkt am Pad statt zwei lange Zuleitungen', target: 'lTot', patch: { pdn: { nvia: 1 } } }
      ],
      defects: [
        { id: 'd1', rect: [34, 30, 12, 10], text: 'Der Kondensator sitzt weit vom Pin: Die Zuleitung ist Teil der Schleife.', fix: 'fix1' },
        { id: 'd2', rect: [46, 32, 32, 6], text: 'Die lange Zuleitung hat Induktivität: Der Kondensator wirkt nur bis zu seiner Resonanz.', fix: 'fix1' },
        { id: 'd3', rect: [34, 38, 12, 6], text: 'Zwei Vias liegen in Reihe zur Massefläche: Jedes Via bringt Induktivität dazu.', fix: 'fix2' }
      ],
      notes: 'Der Kondensator wirkt nur so weit, wie seine Anschlussinduktivität es zulässt. Die Anschlussinduktivität besteht aus der Schleife der Zuleitung und den Vias.'
    },
    {
      id: 'abblock-viel', title: 'Mehrere Abblockkondensatoren', stackDefault: '2gnd', f0: 1e8, i0: 0.082,
      kurz: 'Drei verschiedene Kondensatoren parallel: Zwischen den Resonanzen entsteht eine Antiresonanz mit hoher Impedanz.',
      parts: [ic(80, 28, 17, 14, 'IC')], forward: [[80, 35], [58, 35]], plane: { rect: FALL_PLANE.slice(), slits: [] },
      pdn: {
        origin: [80, 35], dir: [-1, 0], viaNH: VIA_NH, branches: [
          { id: 'c1', C: 100e-9, esr: 0.03, esl: 1.2e-9, d: 10, nvia: 2 },
          { id: 'c2', C: 10e-9, esr: 0.05, esl: 1.0e-9, d: 16, nvia: 2 },
          { id: 'c3', C: 1e-9, esr: 0.1, esl: 0.8e-9, d: 22, nvia: 2 }]
      },
      fixes: [
        { id: 'fix1', text: 'Gleiche Werte nebeneinander am Pin', target: 'antires', patch: { pdn: { equal: 100e-9, dAll: 6 } } },
        { id: 'fix2', text: 'Kürzere Vias (dünnere Lage)', target: 'lTot', patch: { pdn: { viaNH: 0.3 } } },
        { id: 'fix3', text: 'Dämpfungswiderstand in Reihe zu den Kondensatoren', target: 'zPeak', patch: { pdn: { esrAdd: 0.4 } } }
      ],
      defects: [
        { id: 'd1', rect: [58, 31, 22, 8], text: 'Kondensatoren mit sehr verschiedenen Werten bilden zwischen ihren Resonanzen eine Antiresonanz.', fix: 'fix1' },
        { id: 'd2', rect: [56, 40, 26, 6], text: 'Lange Vias machen jeden Zweig induktiv: Die Wirkung endet früher.', fix: 'fix2' },
        { id: 'd3', rect: [56, 24, 26, 6], text: 'Ohne Dämpfung steigt die Impedanz an der Antiresonanz stark an.', fix: 'fix3' }
      ],
      notes: 'Jeder Kondensator ist oberhalb seiner Resonanz eine Induktivität. Parallel zu einem anderen Wert entsteht dazwischen ein Maximum der Impedanz.'
    },
    {
      id: 'lagen', title: 'Lagenaufbau: zwei gegen vier Lagen', stackDefault: '2', f0: 1e8, i0: 0.0051,
      kurz: 'Dieselbe Leiterbahn auf zwei Lagen ohne Fläche, zwei Lagen mit Fläche und vier Lagen: Die Schleife schrumpft mit dem Lagenabstand.',
      parts: [{ kind: 'conn', x: 3, y: 29, w: 11, h: 12, label: 'Stecker' }, ic(85, 28, 12, 14, 'IC')],
      forward: [[15, 35], [85, 35]], plane: null, gndOffset: 12,
      fixes: [
        { id: 'fix1', text: 'Auf zwei Lagen mit Massefläche wechseln', target: 'area', patch: { stackMin: '2gnd' } },
        { id: 'fix2', text: 'Auf vier Lagen mit Massefläche unter der Signallage wechseln', target: 'area', patch: { stackMin: '4' } }
      ],
      defects: [
        { id: 'd1', rect: [15, 38, 70, 14], text: 'Ohne Massefläche läuft der Rückleiter weit entfernt: Die Schleife ist groß.', fix: ['fix1', 'fix2'] },
        { id: 'd2', rect: [15, 30, 70, 10], text: 'Auch mit Fläche auf der Gegenseite liegt der Rückstrom ' + String(STACKS['2gnd'].h).replace('.', ',') + ' mm unter der Bahn: Mit vier Lagen sinkt der Abstand deutlich.', fix: 'fix2' }
      ],
      notes: 'Der Lagenabstand h bestimmt die Schleifenfläche (A = Länge mal h) und die Übergangsfrequenz ft.'
    },
    {
      id: 'stecker', title: 'Kabeleingang ohne Filter am Steckerrand', stackDefault: '2gnd', f0: 1e8, i0: 0.0039,
      kurz: 'Die Leitung läuft vom Steckerrand über eine Aussparung (Moat) in der Massefläche: Ohne Filter am Stecker nimmt der Rückstrom einen Umweg.',
      parts: [{ kind: 'conn', x: 3, y: 28, w: 11, h: 14, label: 'Stecker' }, ic(80, 28, 17, 14, 'IC')],
      forward: [[8, 35], [80, 35]], plane: { rect: FALL_PLANE.slice(), slits: [{ x0: 16, y0: 8, x1: 16, y1: 60 }] },
      fixes: [
        { id: 'fix1', text: 'Filterkondensator direkt am Stecker neben die Leitung setzen', target: 'area', patch: { bridges: [[16, 37]], partsAdd: [{ kind: 'cap', x: 14, y: 36.9, w: 4, h: 2.2, label: 'C' }] } },
        { id: 'fix2', text: 'Masse am Steckergehäuse mit der Massefläche verbinden', target: 'area', patch: { bridges: [[16, 48]], partsAdd: [{ kind: 'conn', x: 14.5, y: 47, w: 3, h: 3, label: '' }] } }
      ],
      defects: [
        { id: 'd1', rect: [11, 30, 10, 10], text: 'Die Leitung quert die Aussparung am Steckerrand: Der Rückstrom hat dort keine Fläche.', fix: ['fix1', 'fix2'] },
        { id: 'd2', rect: [11, 44, 10, 18], text: 'Das Steckergehäuse ist nicht mit der Massefläche verbunden: Hochfrequenz kann nicht am Stecker abfließen.', fix: 'fix2' },
        { id: 'd3', rect: [3, 28, 14, 14], text: 'Am Steckerrand fehlt ein Filter: Störungen laufen ungehindert ins Kabel.', fix: 'fix1' }
      ],
      notes: 'Am Steckerrand muss die Störung abgeleitet werden, bevor sie ins Kabel läuft: Filter und Gehäusemasse gehören direkt an den Stecker.'
    },
    {
      id: 'parallel', title: 'Zwei Signale parallel geführt', stackDefault: '2gnd', f0: 2e8, i0: 0.023,
      kurz: 'Zwei Leitungen laufen eng parallel: Der Takt koppelt kapazitiv und induktiv auf die Nachbarleitung.',
      parts: [ic(3, 26, 12, 12, 'Takt'), ic(75, 26, 12, 12, 'E/A')],
      forward: [[15, 32], [75, 32]], plane: { rect: FALL_PLANE.slice(), slits: [] },
      xt: { s: 0.5, len: 60, w: W_DEFAULT, ro: 50, rl: 50, us: 3.3, guard: false },
      fixes: [
        { id: 'fix1', text: 'Abstand zwischen den Leitungen vergrößern', target: 'kdB', patch: { xt: { s: 1.0 } } },
        { id: 'fix2', text: 'Masseleitung zwischen die beiden Leitungen legen', target: 'kdB', patch: { xt: { guard: true, s: 1.5 } } }
      ],
      defects: [
        { id: 'd1', rect: [15, 29, 60, 8], text: 'Die Leitungen liegen sehr dicht beieinander: Die Koppelkapazität und die Gegeninduktivität sind groß.', fix: ['fix1', 'fix2'] },
        { id: 'd2', rect: [15, 32.6, 60, 2.6], text: 'Zwischen den Leitungen fehlt eine Masseleitung, die das elektrische Feld abfängt.', fix: 'fix2' }
      ],
      notes: 'Das Übersprechen sinkt mit dem Abstand; eine Masseleitung dazwischen wirkt stärker gegen die kapazitive als gegen die induktive Kopplung.'
    },
    {
      id: 'quarz', title: 'Quarz mit langer Taktleitung', stackDefault: '2', f0: 7.5e7, i0: 0.005,
      kurz: 'Der Quarz sitzt weit vom IC auf zwei Lagen: Die lange Taktleitung mit entferntem Rückleiter strahlt auf den Oberwellen.',
      parts: [{ kind: 'xtal', x: 4, y: 5, w: 12, h: 7, label: 'Quarz' }, ic(88, 45, 10, 14, 'IC')],
      forward: [[88, 52], [12, 52], [12, 12]], plane: null, gndOffset: 15,
      fixes: [
        { id: 'fix1', text: 'Quarz direkt an den IC setzen', target: 'area', patch: { forward: [[88, 52], [76, 52]], parts: [{ kind: 'xtal', x: 66, y: 48, w: 10, h: 7, label: 'Quarz' }, ic(88, 45, 10, 14, 'IC')] } },
        { id: 'fix2', text: 'Massefläche unter die Taktleitung legen', target: 'area', patch: { stackMin: '2gnd' } }
      ],
      defects: [
        { id: 'd1', rect: [8, 8, 12, 48], text: 'Der Quarz sitzt weit vom IC: Die Taktleitung ist lang.', fix: 'fix1' },
        { id: 'd2', rect: [14, 38, 72, 16], text: 'Unter der Taktleitung fehlt die Massefläche: Der Rückleiter liegt weit entfernt.', fix: 'fix2' }
      ],
      notes: 'Ein Quarzoszillator treibt Oberwellen in die Taktleitung: Kurz halten und eine Massefläche darunter legen.'
    },
    {
      id: 'schaltreg', title: 'Hot-Loop eines Schaltreglers', stackDefault: '2', f0: 5e7, i0: 0.057,
      kurz: 'Der Eingangskondensator des Schaltreglers sitzt weit vom Schalter: Der Stromimpuls läuft durch eine große Schleife.',
      parts: [ic(70, 34, 14, 12, 'Schalter')], forward: [[70, 40], [40, 40]], plane: null, gndOffset: 10,
      pdn: { origin: [70, 40], dir: [-1, 0], viaNH: VIA_NH, branches: [{ id: 'cin', C: 4.7e-6, esr: 0.01, esl: 1.5e-9, d: 30, nvia: 0 }] },
      fixes: [
        { id: 'fix1', text: 'Eingangskondensator unmittelbar an den Schalter setzen', target: 'area', patch: { pdn: { dAll: 3 } } },
        { id: 'fix2', text: 'Rückleiter eng unter oder neben dem Hinleiter führen', target: 'area', patch: { gndOffset: 1.5 } }
      ],
      defects: [
        { id: 'd1', rect: [38, 34, 34, 12], text: 'Der Eingangskondensator ist weit vom Schalter entfernt: Der Schaltstrom läuft durch eine große Schleife.', fix: 'fix1' },
        { id: 'd2', rect: [38, 26, 34, 10], text: 'Der Rückleiter liegt weit neben dem Hinleiter: Die Hot-Loop spannt eine große Fläche auf.', fix: 'fix2' }
      ],
      notes: 'Die Schleife aus Eingangskondensator, Schalter und Diode schaltet den größten Strom der Schaltung und muss deshalb die kleinste Fläche haben.'
    },
    {
      id: 'via-wechsel', title: 'Lagenwechsel ohne Masse-Via', stackDefault: '4', f0: 1e8, i0: 0.0078,
      kurz: 'Das Signal wechselt per Via die Lage, aber das nächste Masse-Via ist weit weg: Der Rückstrom braucht dort einen Umweg.',
      parts: [ic(3, 29, 11, 12, 'IC 1'), ic(86, 28, 11, 14, 'IC 2')],
      forward: [[14, 35], [50, 35], [86, 35]], plane: { rect: FALL_PLANE.slice(), slits: [] },
      trans: [{ x0: 50, y0: 3, x1: 50, y1: 67 }], bridges: [[50, 55]], vias: [[50, 35], [50, 55]],
      fixes: [
        { id: 'fix1', text: 'Masse-Via direkt neben das Signal-Via setzen', target: 'area', patch: { bridges: [[50, 38]], viasAdd: [[50, 38]] } }
      ],
      defects: [
        { id: 'd1', rect: [46, 31, 8, 8], text: 'Das Signal wechselt hier die Lage: Der Rückstrom wechselt mit, braucht aber ein Masse-Via.', fix: 'fix1' },
        { id: 'd2', rect: [46, 51, 8, 8], text: 'Das nächste Masse-Via liegt weit vom Signal-Via: Der Rückstrom macht einen Umweg.', fix: 'fix1' }
      ],
      notes: 'Wechselt ein Signal die Lage, muss der Rückstrom mit: Ein Masse-Via gehört direkt neben das Signal-Via.'
    }
  ];
  CASES.forEach(function (c) {
    c.world = { w: 100, h: 70 };
    c.fixes = c.fixes || [];
    c.fixes.forEach(function (fx) { if (!fx.skipIf) delete fx.skipIf; });
    c.solution = { fixes: {}, stack: c.stackDefault };
    c.fixes.forEach(function (fx) { c.solution.fixes[fx.id] = true; });
    if (c.id === 'rueck') c.solution.stack = '4';
  });

  function caseOf(id) {
    if (typeof id === 'number' && isFinite(id)) return CASES[Math.round(id) - 1] || null;
    if (isObj(id) && typeof id.id === 'string') id = id.id;
    if (typeof id !== 'string') return null;
    for (let k = 0; k < CASES.length; k++) if (CASES[k].id === id) return CASES[k];
    return null;
  }
  function fixFlags(fixes, c) {
    const out = { fix1: false, fix2: false, fix3: false };
    if (isArr(fixes)) { fixes.forEach(function (id) { if (typeof id === 'string' && id in out) out[id] = true; }); }
    else if (isObj(fixes)) { FIXN.forEach(function (k) { if (fixes[k] === true || fixes[k] === 1 || fixes[k] === 'true') out[k] = true; }); }
    FIXN.forEach(function (k, n) { if (n >= c.fixes.length) out[k] = false; });
    return out;
  }

  /* Wirksame Konfiguration: Fall + aktive Massnahmen (Patches in der Reihenfolge fix1, fix2, fix3; skipIf lässt eine Massnahme entfallen) */
  function applyFixes(c, flags) {
    const cfg = {
      forward: clone(c.forward), parts: clone(c.parts), plane: clone(c.plane), slits: clone(c.plane && c.plane.slits ? c.plane.slits : []),
      trans: clone(c.trans || []), bridges: clone(c.bridges || []), vias: clone(c.vias || []), gndOffset: c.gndOffset, stackMin: '2',
      w: W_DEFAULT, pdn: clone(c.pdn), xt: clone(c.xt)
    };
    for (let k = 0; k < c.fixes.length; k++) {
      const fx = c.fixes[k]; if (!flags[fx.id]) continue;
      let skip = false;
      if (isArr(fx.skipIf)) fx.skipIf.forEach(function (o) { if (flags[o]) skip = true; });
      if (skip) continue;
      const p = fx.patch || {};
      if (p.forward) cfg.forward = clone(p.forward);
      if (p.parts) cfg.parts = clone(p.parts);
      if (p.partsAdd) cfg.parts = cfg.parts.concat(clone(p.partsAdd));
      if (p.slits) { cfg.slits = clone(p.slits); }
      if (p.bridges) cfg.bridges = cfg.bridges.concat(clone(p.bridges));
      if (p.viasAdd) cfg.vias = cfg.vias.concat(clone(p.viasAdd));
      if (fin(p.gndOffset)) cfg.gndOffset = p.gndOffset;
      if (p.stackMin && (STACK_RANK[p.stackMin] > STACK_RANK[cfg.stackMin])) cfg.stackMin = p.stackMin;
      if (fin(p.w)) cfg.w = p.w;
      if (p.xt && cfg.xt) Object.keys(p.xt).forEach(function (q) { cfg.xt[q] = p.xt[q]; });
      if (p.pdn && cfg.pdn) {
        const q = p.pdn;
        if (fin(q.viaNH)) cfg.pdn.viaNH = q.viaNH;
        if (fin(q.nvia)) cfg.pdn.branches.forEach(function (b) { b.nvia = q.nvia; });
        if (fin(q.dAll)) cfg.pdn.branches.forEach(function (b) { b.d = q.dAll; });
        if (fin(q.equal)) cfg.pdn.branches.forEach(function (b) { b.C = q.equal; b.esr = cfg.pdn.branches[0].esr; b.esl = cfg.pdn.branches[0].esl; });
        if (fin(q.esrAdd)) cfg.pdn.branches.forEach(function (b) { b.esr += q.esrAdd; });
      }
    }
    return cfg;
  }

  /* Rueckpfad (von Start nach Ende gespeichert, laeuft physikalisch entgegen) */
  function buildReturn(cfg, stack, hMm) {
    // Der Versatz des Rueckpfads (Zeichnung des Querschnitts) liegt auf der Seite des Umwegs: Dann ist |Shoelace(Hinleiter + umgekehrter Rueckpfad)|
    // genau Streifen + Umweg-Trapez (gezeichnetes Polygon und Zahl stimmen ueberein).
    const r = buildReturnSide(cfg, stack, hMm, 1);
    if (r.firstSide < 0) return buildReturnSide(cfg, stack, hMm, -1);
    return r;
  }
  function buildReturnSide(cfg, stack, hMm, side) {
    const fwd = cfg.forward;
    const noPlane = stack === '2';
    const off = noPlane ? (fin(cfg.gndOffset) && cfg.gndOffset > 0 ? cfg.gndOffset : GND_DEFAULT) : hMm;
    const base = offsetPath(fwd, noPlane ? off : off * side);
    const out = { ret: base, base: base, detourMm: 0, detourArea: 0, crossings: [], firstSide: 0 };
    if (noPlane) return out;
    // Schlitze und Lagenwechsel (nicht gezeichnet), Ausgaenge: Schlitzenden und Bruecken auf dem Schlitz
    const barriers = (cfg.slits || []).map(s => ({ a: [s.x0, s.y0], b: [s.x1, s.y1], hidden: false })).concat((cfg.trans || []).map(s => ({ a: [s.x0, s.y0], b: [s.x1, s.y1], hidden: true })));
    if (!barriers.length) return out;
    const ins = [];                                   // { seg, t, pts[] }
    for (let i = 0; i < fwd.length - 1; i++) {
      const a = fwd[i], b = fwd[i + 1], dF = unit(a, b);
      for (let q = 0; q < barriers.length; q++) {
        const br = barriers[q], cr = segCross(a, b, br.a, br.b);
        if (!cr) continue;
        const X = [cr.x, cr.y], u = unit(br.a, br.b);
        let best = null;
        [[br.a, [-u[0], -u[1]]], [br.b, u]].forEach(function (e) { const d = Math.hypot(e[0][0] - X[0], e[0][1] - X[1]); if (!best || d < best.d) best = { d: d, E: e[0], out: e[1], end: true }; });
        (cfg.bridges || []).forEach(function (bp) {
          if (distPtSeg(bp, br.a, br.b) > 0.6) return;
          const d = Math.hypot(bp[0] - X[0], bp[1] - X[1]);
          if (d < best.d) best = { d: d, E: bp, out: [0, 0], end: false };
        });
        out.crossings.push({ seg: i, x: X[0], y: X[1], d: best.d, viaEnd: best.end });
        if (best.d <= 0.5) continue;                  // Bruecke / Via direkt am Signal: kein Umweg
        const sp = SPREAD * best.d + SLIT_HALF;
        const along = [best.E[0] + best.out[0] * END_CLEAR - X[0], best.E[1] + best.out[1] * END_CLEAR - X[1]];
        const Xr = [base[i][0] + (base[i + 1][0] - base[i][0]) * cr.t, base[i][1] + (base[i + 1][1] - base[i][1]) * cr.t];
        const A = [Xr[0] - dF[0] * sp, Xr[1] - dF[1] * sp], B = [Xr[0] + dF[0] * sp, Xr[1] + dF[1] * sp];
        const Ea = [Xr[0] + along[0] - dF[0] * SLIT_HALF, Xr[1] + along[1] - dF[1] * SLIT_HALF], Eb = [Xr[0] + along[0] + dF[0] * SLIT_HALF, Xr[1] + along[1] + dF[1] * SLIT_HALF];
        if (!out.firstSide) out.firstSide = (along[0] * (-dF[1]) + along[1] * dF[0]) >= 0 ? 1 : -1;
        ins.push({ seg: i, t: cr.t, pts: [A, Ea, Eb, B] });
        out.detourMm += pathLen([A, Ea, Eb, B]) - pathLen([A, B]);
        out.detourArea += (2 * sp + 2 * SLIT_HALF) / 2 * Math.hypot(along[0], along[1]);   // Trapez: Sehne A-B (2 sp) und Ea-Eb (2 * SLIT_HALF)
      }
    }
    if (ins.length) {
      ins.sort(function (p, q) { return p.seg !== q.seg ? p.seg - q.seg : p.t - q.t; });
      const ret = [];
      for (let k = 0; k < base.length; k++) {
        ret.push(base[k]);
        ins.forEach(function (e) { if (e.seg === k) e.pts.forEach(function (p) { ret.push(p); }); });
      }
      out.ret = ret;
    }
    return out;
  }

  /* Abblock-Zweige aus der Konfiguration (Leitungslaenge d in mm, Schleife ueber Rueckpfad im Abstand hEff) */
  function resolveBranches(pd, hEff, w) {
    const out = [];
    (pd.branches || []).forEach(function (b) {
      const area = b.d * hEff, ll = lloop(area, w, hEff) * 1e-9;           // H
      const viaL = (pd.viaNH !== undefined ? pd.viaNH : VIA_NH) * 1e-9, nvia = b.nvia !== undefined ? b.nvia : 2;
      const lm = ll + nvia * viaL;
      out.push({ id: b.id, C: b.C, esr: b.esr, esl: b.esl, d: b.d, lloop: ll, nvia: nvia, viaL: viaL, lmount: lm, fres: 1 / (TWO_PI * Math.sqrt((b.esl + lm) * b.C)) });
    });
    return out;
  }
  function branchZ(b, f) {
    const w = TWO_PI * f, lm = fin(b.lmount) ? b.lmount : (nn(b.lloop, 0) + nn(b.nvia, 0) * (b.viaL === undefined ? VIA_NH * 1e-9 : b.viaL));
    const x = w * (b.esl + lm) - 1 / (w * b.C);
    return [b.esr, x];
  }
  function pdnAt(branches, f) {
    let gr = 0, gi = 0;
    for (let k = 0; k < branches.length; k++) {
      const z = branchZ(branches[k], f), d = z[0] * z[0] + z[1] * z[1];
      gr += z[0] / d; gi += -z[1] / d;
    }
    const d = gr * gr + gi * gi; const re = gr / d, im = -gi / d;
    return { re: re, im: im, z: Math.hypot(re, im) };
  }
  function okBranch(b) { return isObj(b) && pos(b.C, NaN) > 0 && nn(b.esr, NaN) >= 0 && nn(b.esl, NaN) >= 0 && (b.lmount === undefined || nn(b.lmount, NaN) >= 0) && (pos(b.C, 0) > 0); }
  function normBranches(br) {
    if (!isArr(br) || !br.length) return null;
    if (br.length > 32) return null;
    const out = [];
    for (let k = 0; k < br.length; k++) {
      const b = br[k]; if (!isObj(b)) return null;
      const C = pos(b.C !== undefined ? b.C : b.c, NaN), esr = nn(b.esr, 0.02), esl = nn(b.esl, 1e-9);
      let lm = b.lmount !== undefined ? nn(b.lmount, NaN) : nn(b.lloop, 0) + nn(b.nvia, 0) * nn(b.viaL, VIA_NH * 1e-9);
      if (!(C > 0) || !fin(lm) || !(esl + lm > 0)) return null;
      out.push({ id: b.id, C: C, esr: esr, esl: esl, lmount: lm, lloop: nn(b.lloop, 0), nvia: nn(b.nvia, 0), viaL: nn(b.viaL, VIA_NH * 1e-9), d: b.d });
    }
    return out;
  }
  const pdnFn = S(function (branches, f) {
    const br = normBranches(branches); f = pos(f, NaN);
    if (!br) return fail(TEXTS_LAY.zweig);
    if (!(f > 0)) return fail(TEXTS_LAY.freqBad);
    const r = pdnAt(br, f);
    if (!fin(r.z)) return fail(TEXTS_LAY.zweig);
    return { ok: true, z: r.z, re: r.re, im: r.im, phase: Math.atan2(r.im, r.re) };
  });
  /* Maxima der Kurve zwischen zwei Minima (Antiresonanzen) */
  function findAntires(f, z) {
    const out = [], n = f.length;
    for (let k = 1; k < n - 1; k++) {
      if (z[k] > z[k - 1] && z[k] >= z[k + 1]) {
        let a = k; while (a > 0 && z[a - 1] < z[a]) a--;
        let b = k; while (b < n - 1 && z[b + 1] < z[b]) b++;
        if (a === 0 && z[0] === z[k]) continue;
        if (a > 0 || z[0] < z[k]) {
          // links muss ein Minimum liegen, nicht der Rand (steigende Flanke eines Einzelzweigs hat kein Maximum)
          if (a === 0) continue;
        }
        if (b === n - 1 && k === n - 1) continue;
        if (z[k] > 1.05 * z[a] && z[k] > 1.05 * z[b] && b > k) out.push({ f: f[k], z: z[k], zLeft: z[a], zRight: z[b] });
      }
    }
    return out;
  }
  const pdnCurve = S(function (branches, fList) {
    const br = normBranches(branches);
    if (!br) return fail(TEXTS_LAY.zweig);
    let fl;
    if (fList === undefined || fList === null) { fl = []; for (let k = 0; k <= 240; k++) fl.push(1e6 * Math.pow(10, k * 3 / 240)); }
    else if (isArr(fList)) { if (fList.length > 20000) return fail(TEXTS_LAY.listeZuLang); fl = []; for (let k = 0; k < fList.length; k++) { const q = num(fList[k], NaN); if (!(q > 0)) return fail(TEXTS_LAY.freqBad); fl.push(q); } if (!fl.length) return fail(TEXTS_LAY.freqBad); }
    else return fail(TEXTS_LAY.freqBad);
    const z = new Array(fl.length); let zi = 0;
    for (let k = 0; k < fl.length; k++) { z[k] = pdnAt(br, fl[k]).z; if (z[k] < z[zi]) zi = k; }
    return { ok: true, f: fl, z: z, points: fl.map((q, k) => [q, z[k]]), zmin: { f: fl[zi], z: z[zi] }, antires: findAntires(fl, z), fres: br.map(b => 1 / (TWO_PI * Math.sqrt((b.esl + b.lmount) * b.C))) };
  });

  /* Parallelfuehrung: Leitermodell 4.2 mit r = w/4 (flacher Streifen als Runddraht, A20). Laengen in mm. */
  function wires2(sMm, hMm, rMm, lenMm) {
    const s = sMm * 1e-3, h = hMm * 1e-3, r = rMm * 1e-3, l = lenMm * 1e-3;
    if (!(s > 0) || !(h > 0) || !(r > 0) || !(l > 0) || r >= h || r >= s / 2) return null;
    const ls = (MU0 / TWO_PI) * Math.log(2 * h / r), m = (MU0 / (4 * Math.PI)) * Math.log(1 + (2 * h / s) * (2 * h / s));
    const den = ls * ls - m * m, k = MU0 * EPS0;
    return { ls: ls, m: m, cm: k * m / den, cg: k * (ls - m) / den, len: l };
  }
  const GUARD_KAP = 0.1, GUARD_IND = 0.7;             // Masseleitung dazwischen (A29): kapazitiv x 0,1, induktiv x 0,7
  const xtalkFn = S(function (cfg) {
    cfg = obj(cfg);
    const s = ov(cfg.s, NaN), h = ov(cfg.h, NaN), w = ov(cfg.w, W_DEFAULT), len = ov(cfg.len, NaN), f = ov(cfg.f, NaN);
    const ro = ov(cfg.ro, 50), rl = ov(cfg.rl, 50), us = ov(cfg.us, 3.3), guard = cfg.guard === true;
    if (!(s > 0) || !(h > 0) || !(len > 0) || !(f > 0) || !(w > 0) || !(ro > 0) || !(rl > 0) || !(us > 0)) return fail(TEXTS_LAY.geomUnmoeglich);
    const g = wires2(s, h, w / 4, len);
    if (!g) return fail(TEXTS_LAY.geomUnmoeglich);
    const om = TWO_PI * f, cm = g.cm * g.len * (guard ? GUARD_KAP : 1), cg = g.cg * g.len, m = g.m * g.len * (guard ? GUARD_IND : 1), rp = ro / 2;
    const dn = Math.hypot(1, om * (cm + cg) * rp);
    const uKap = us * om * cm * rp / dn, uInd = 0.5 * om * m * (us / rl), uSum = uKap + uInd;
    const lam = C0 / f, l10 = lam / 10, valid = len * 1e-3 <= l10;
    const res = { ok: true, valid: valid, kdB: 20 * log10(uSum / us), uKap: uKap, uInd: uInd, uSum: uSum, cm: g.cm * g.len, cg: g.cg * g.len, m: g.m * g.len, dominant: uKap >= uInd ? 'kapazitiv' : 'induktiv', guard: guard };
    if (!valid) res.why = tx('xtLang', { len: eng(len * 1e-3, 'm'), l10: eng(l10, 'm') });
    return res;
  });

  /* Kernrechnung eines Zustands (ohne Referenz) */
  function calc(c, flags, stack, f, i) {
    const cfg = applyFixes(c, flags);
    let st = stack; if (STACK_RANK[cfg.stackMin] > STACK_RANK[st]) st = cfg.stackMin;
    const hStack = STACKS[st].h;
    if (c.pdn && cfg.pdn) {
      // Vorwaertspfad aus dem entferntesten Zweig ableiten
      let dmax = 0; cfg.pdn.branches.forEach(function (b) { if (b.d > dmax) dmax = b.d; });
      const o = cfg.pdn.origin, dir = cfg.pdn.dir;
      cfg.forward = [o.slice(), [o[0] + dir[0] * dmax, o[1] + dir[1] * dmax]];
    }
    if (!isArr(cfg.forward) || cfg.forward.length < 2) return null;
    const rr = buildReturn(cfg, st, hStack);
    const poly = cfg.forward.concat(rr.ret.slice().reverse());
    // Schleifenflaeche = Streifen zwischen Hinleiter und ungestoertem Rueckpfad + Umweg-Trapeze (Betragssumme, ungünstigster Fall, A7):
    // Streifen (senkrechte Schleife im Querschnitt) und Umweg (Schleife in der Leiterplattenebene) liegen in verschiedenen Ebenen.
    const aStrip = shoelace(cfg.forward.concat(rr.base.slice().reverse())), area = aStrip + rr.detourArea, len = pathLen(cfg.forward);
    if (!(area > 0) || !(len > 0)) return null;
    const hEff = st === '2' ? (fin(cfg.gndOffset) && cfg.gndOffset > 0 ? cfg.gndOffset : GND_DEFAULT) : hStack;
    const hMean = area / len, ll = lloop(area, cfg.w, hEff);   // SPEC 4.7: lloop = mu0 * A / (w + 2 h_eff), h_eff = Abstand zum Rueckpfad im Querschnitt (Lagenabstand bzw. Rueckleiterabstand); hMean = A / Laenge nur zur Information
    const ft = st === '2' ? 0 : ftOf(hStack);
    const sp = returnSplit(f, ft);
    const out = { cfg: cfg, st: st, hStack: hStack, hEff: hEff, forward: cfg.forward, ret: rr.ret, area: area, areaStrip: aStrip, areaPoly: shoelace(poly), detourArea: rr.detourArea, len: len, lloop: ll, ft: ft, split: { hf: sp.hf, lf: sp.lf }, detourMm: rr.detourMm, crossings: rr.crossings, areaDirect: len * hEff, hMean: hMean };
    let iEff = i, xt = null;
    if (c.xt && cfg.xt) {
      const xo = cfg.xt;
      xt = xtalkFn({ s: xo.s, h: hEff, w: xo.w, len: xo.len, f: f, ro: xo.ro, rl: xo.rl, us: xo.us, guard: xo.guard });
      if (xt && xt.ok) iEff = i * Math.pow(10, xt.kdB / 20);
      out.xtalk = xt;
    }
    out.iEff = iEff;
    out.eDb = eDbOf(f, area, iEff, R_FIELD);
    if (c.pdn && cfg.pdn) {
      const br = resolveBranches(cfg.pdn, hEff, cfg.w), curve = pdnCurve(br);
      let lsum = 0, far = br[0];
      br.forEach(function (b) { lsum += 1 / (b.esl + b.lmount); if (b.lmount > far.lmount) far = b; });
      const z100 = pdnAt(br, 1e8).z;
      let zPeak = 0; if (curve.ok && curve.antires.length) curve.antires.forEach(function (a) { if (a.z > zPeak) zPeak = a.z; });
      out.pdn = {
        branches: br, lTot: 1e9 / lsum, lMount: far.lmount * 1e9, fres: far.fres, fresList: br.map(b => b.fres), z100: z100, zPeak: zPeak || null,
        antires: curve.ok ? curve.antires : [], zmin: curve.ok ? curve.zmin : null, abbl: { c: far.C, lmountH: far.lmount, eslH: far.esl }
      };
    }
    return out;
  }

  const solve = S(function (id, opts) {
    const c = caseOf(id); if (!c) return fail(TEXTS_LAY.caseUnknown);
    opts = obj(opts);
    let st = opts.stack === undefined || opts.stack === null ? c.stackDefault : String(opts.stack);
    if (!(st in STACKS)) return fail(TEXTS_LAY.stackUnknown);
    let f = opts.f === undefined || opts.f === null ? c.f0 : num(opts.f, NaN);
    if (!(f > 0)) return fail(TEXTS_LAY.freqBad);
    let i = opts.i === undefined || opts.i === null ? c.i0 : num(opts.i, NaN);
    if (!(i > 0)) return fail(TEXTS_LAY.strom);
    if (f > 1e12 || i > 1e6) return fail(TEXTS_LAY.wertBad);
    const flags = fixFlags(opts.fixes, c);
    const r = calc(c, flags, st, f, i); if (!r) return fail(TEXTS_LAY.geomLeer);
    const none = { fix1: false, fix2: false, fix3: false };
    const same = !flags.fix1 && !flags.fix2 && !flags.fix3 && r.st === c.stackDefault;
    const ref = same ? r : calc(c, none, c.stackDefault, f, i);
    const lim = limit3(f), margin = lim === null ? NaN : lim - r.eDb;
    const lam = C0 / f, l10 = lam / 10, sq = Math.sqrt(r.area) * 1e-3, valid = sq < l10;
    const active = [];
    c.defects.forEach(function (d) {
      const fx = isArr(d.fix) ? d.fix : [d.fix];
      let off = false;
      fx.forEach(function (q) {
        if (q === 'stack') { if (r.st === '4') off = true; }
        else if (q && flags[q]) off = true;
      });
      if (!off) active.push(d.id);
    });
    const parts = clone(r.cfg.parts) || [];
    if (r.pdn) {
      // Kondensatoren an ihren Zweigpositionen
      const o = r.cfg.pdn.origin, dir = r.cfg.pdn.dir;
      r.pdn.branches.forEach(function (b) { parts.push(capPart(o[0] + dir[0] * b.d, o[1] + dir[1] * b.d, eng(b.C, 'F'))); });
    }
    if (r.cfg.xt) {
      const xo = r.cfg.xt, y0 = r.forward[0][1], x0 = r.forward[0][0];
      parts.push({ kind: 'opfer', x: x0, y: y0 + xo.s - 0.3, w: xo.len, h: 0.6, label: 'Opfer' });
      if (xo.guard) parts.push({ kind: 'masse', x: x0, y: y0 + xo.s / 2 - 0.3, w: xo.len, h: 0.6, label: 'Masse' });
    }
    const slits = r.st === '2' ? [] : clone(r.cfg.slits);
    const plane = r.st === '2' ? null : { rect: clone((c.plane && c.plane.rect) || FALL_PLANE), slits: slits };
    const res = {
      ok: true, id: c.id, forward: r.forward, ret: r.ret, area: r.area, areaRef: ref.area, areaDirectMm2: r.areaDirect, areaMm2: r.area, areaStrip: r.areaStrip, areaPoly: r.areaPoly, detourArea: r.detourArea, detourMm: r.detourMm, len: r.len, lloop: r.lloop, ft: r.ft, split: r.split,
      hMean: r.hMean, eDb: r.eDb, eRef: ref.eDb, eRel: r === ref ? 0 : r.eDb - ref.eDb, margin: margin, limit3: lim, ampel: ampelOfMargin(margin), limitFree: lim === null, valid: valid, iEff: r.iEff,
      stack: r.st, hStack: r.hStack, defectsActive: active, parts: parts, slits: slits, vias: clone(r.cfg.vias), plane: plane, f: f, i: i, fixes: flags
    };
    if (lim === null) res.why = tx('keinGrenzwert');
    if (!valid) res.why = tx('klein', { w: eng(sq, 'm'), l10: eng(l10, 'm') });
    if (r.st === '2' && !res.why) res.hint = tx('ohneFlaeche');
    if (r.pdn) res.pdn = r.pdn;
    if (r.xtalk && r.xtalk.ok) res.xtalk = r.xtalk;
    if (r.detourMm > 0) res.detour = { mm: r.detourMm, areaDirect: r.areaDirect, text: tx('umweg', { d: fm(r.detourMm, 1), a: fm(r.area, 1), a0: fm(r.areaDirect, 1) }) };
    if (r.pdn) {
      res.abblText = r.pdn.lMount > 3 ? tx('abblWeit', { l: fm(r.pdn.lMount, 1), f: eng(r.pdn.fres, 'Hz') }) : '';
      if (r.pdn.antires.length) { const a = r.pdn.antires[0]; res.antiresText = tx('antires', { f: eng(a.f, 'Hz'), z: fm(a.z, 2) }); }
    }
    return res;
  });
  const hit = Gn(function (id, x, y, fixes) {
    const c = caseOf(id); x = num(x, NaN); y = num(y, NaN);
    if (!c || !fin(x) || !fin(y)) return null;
    const flags = fixFlags(fixes, c);
    let stackOk = false;
    if (isObj(fixes) && fixes.stack === '4') stackOk = true;
    for (let k = 0; k < c.defects.length; k++) {
      const d = c.defects[k], fx = isArr(d.fix) ? d.fix : [d.fix];
      let off = false; fx.forEach(function (q) { if (q === 'stack') { if (stackOk) off = true; } else if (q && flags[q]) off = true; });
      if (off) continue;
      const r = d.rect, tol = 3;
      if (x >= r[0] - tol && x <= r[0] + r[2] + tol && y >= r[1] - tol && y <= r[1] + r[3] + tol) return d;
    }
    return null;
  }, null);
  const solvedOpts = Gn(function (id) { const c = caseOf(id); return c ? { fixes: clone(c.solution.fixes), stack: c.solution.stack, f: c.f0, i: c.i0 } : null; }, null);
  const baseOpts = Gn(function (id) { const c = caseOf(id); return c ? { fixes: {}, stack: c.stackDefault, f: c.f0, i: c.i0 } : null; }, null);

  const layout = {
    cases: CASES, stacks: STACKS, solve: solve, area: areaFn, returnSplit: returnSplit, ftOf: ftOf, lloop: lloop, eDb: eDbOf, limit3: limit3, crossProfile: crossProfile,
    pdn: pdnFn, pdnCurve: pdnCurve, xtalk: xtalkFn, hit: hit, solvedOpts: solvedOpts, baseOpts: baseOpts,
    caseOf: function (id) { try { return caseOf(id); } catch (e) { return null; } }
  };

  /* =====================================================================================================
   *  4.8 IMPULSE UND SCHUTZ
   * ===================================================================================================== */
  /* ---- Wellenformen (Parameter per Anpassung bestimmt, Testkriterien siehe test_emvcore_lay.js) ---- */
  function dexp(t, tr, td) { return t <= 0 ? 0 : Math.exp(-t / td) - Math.exp(-t / tr); }
  function dexpPk(tr, td) { const tp = Math.log(td / tr) * tr * td / (td - tr); return dexp(tp, tr, td); }
  // ESD (Zeiten in ns, Amplituden in A/kV): schneller Anteil + langsamer Anteil
  const ESD_P = { tr1: 0.7224059060731125, td1: 2.1014911387106827, a1: 2.9969125005067703, tr2: 5.448283625641623, td2: 42.777708300992614, a2: 2.626538771228338 };
  const ESD_N1 = dexpPk(ESD_P.tr1, ESD_P.td1), ESD_N2 = dexpPk(ESD_P.tr2, ESD_P.td2);
  function esdShape(tNs) { return ESD_P.a1 * dexp(tNs, ESD_P.tr1, ESD_P.td1) / ESD_N1 + ESD_P.a2 * dexp(tNs, ESD_P.tr2, ESD_P.td2) / ESD_N2; }
  // Burst 5/50 ns (Doppelexponential, Zeiten in ns)
  const BUR_P = { tr: 3.2909739911804032, td: 55.60970341686978 };
  const BUR_N = dexpPk(BUR_P.tr, BUR_P.td);
  // Surge: Spannung 1,2/50 µs (Doppelexponential, µs), Strom 8/20 µs (t^n * e^(-t/tau), µs)
  const SUR_V = { tr: 0.40403527298988406, td: 68.53996435780877 };
  const SUR_VN = dexpPk(SUR_V.tr, SUR_V.td);
  const SUR_I = { n: 4.3, tau: 2.85 };
  const SUR_IN = Math.pow(SUR_I.n, SUR_I.n) * Math.exp(-SUR_I.n);
  function surgeI(tUs) { return tUs <= 0 ? 0 : Math.pow(tUs / SUR_I.tau, SUR_I.n) * Math.exp(-tUs / SUR_I.tau) / SUR_IN; }

  const HBM = { c: 150e-12, r: 330 };
  const ESD_KV_MAX = 30;
  const ESD_MODES = { kontakt: 'kontakt', contact: 'kontakt', esdk: 'kontakt', luft: 'luft', air: 'luft', esdl: 'luft' };   // Kurznamen der Pruefstaende werden toleriert
  const pulseEsd = S(function (kV, mode) {
    kV = num(kV, NaN);
    if (!(kV > 0) || kV > ESD_KV_MAX) return fail(tx('esdKV', { max: 30 }));
    mode = mode === undefined || mode === null ? 'kontakt' : (ESD_MODES[String(mode)] || String(mode));
    if (mode !== 'kontakt' && mode !== 'luft') return fail(TEXTS_LAY.esdMode);
    const n = 3000, dt = 0.05, t = new Array(n + 1), i = new Array(n + 1); let ip = 0;
    for (let k = 0; k <= n; k++) { t[k] = k * dt * 1e-9; i[k] = kV * esdShape(k * dt); if (i[k] > ip) ip = i[k]; }
    let t10 = NaN, t90 = NaN;
    for (let k = 1; k <= n; k++) {
      if (isNaN(t10) && i[k] >= 0.1 * ip) t10 = (k - 1 + (0.1 * ip - i[k - 1]) / (i[k] - i[k - 1])) * dt;
      if (isNaN(t90) && i[k] >= 0.9 * ip) { t90 = (k - 1 + (0.9 * ip - i[k - 1]) / (i[k] - i[k - 1])) * dt; break; }
    }
    return {
      ok: true, kV: kV, mode: mode, t: t, i: i, ip: ip, tr: (t90 - t10) * 1e-9, i30: kV * esdShape(30), i60: kV * esdShape(60), dt: dt * 1e-9,
      hbm: { c: HBM.c, r: HBM.r, e: 0.5 * HBM.c * Math.pow(kV * 1e3, 2), iIdeal: kV * 1e3 / HBM.r }
    };
  });
  const pulseBurst = S(function (kV, o) {
    kV = num(kV, NaN); o = obj(o);
    if (!(kV > 0) || kV > 10) return fail(tx('pegel', { max: 10 }));
    const fRep = o.fRep === undefined ? 5e3 : num(o.fRep, NaN);
    if (!(fRep > 0) || fRep > 1e6) return fail(TEXTS_LAY.wertBad);
    const n = 500, dt = 0.5, t = new Array(n + 1), u = new Array(n + 1);
    for (let k = 0; k <= n; k++) { t[k] = k * dt * 1e-9; u[k] = kV * 1e3 * dexp(k * dt, BUR_P.tr, BUR_P.td) / BUR_N; }
    const np = 75, gap = 1 / fRep, pulseT = []; for (let k = 0; k < np; k++) pulseT.push(k * gap);
    return { ok: true, kV: kV, fRep: fRep, t: t, u: u, peak: kV * 1e3, n: np, gap: gap, pulseT: pulseT, tBurst: np * gap, tRepeat: 0.3, tr: 5e-9, th: 50e-9, dt: dt * 1e-9 };
  });
  const pulseSurge = S(function (kV, o) {
    kV = num(kV, NaN); o = obj(o);
    if (!(kV > 0) || kV > 10) return fail(tx('pegel', { max: 10 }));
    const zi = o.zi === undefined ? 2 : num(o.zi, NaN);
    if (!(zi > 0) || zi > 1000) return fail(TEXTS_LAY.wertBad);
    const n = 1000, dt = 0.2, t = new Array(n + 1), u = new Array(n + 1), i = new Array(n + 1), ipk = kV * 1e3 / zi;
    for (let k = 0; k <= n; k++) { t[k] = k * dt * 1e-6; u[k] = kV * 1e3 * dexp(k * dt, SUR_V.tr, SUR_V.td) / SUR_VN; i[k] = ipk * surgeI(k * dt); }
    return { ok: true, kV: kV, zi: zi, t: t, u: u, i: i, peakU: kV * 1e3, ipk: ipk, T1: 1.2e-6, T2: 50e-6, T1i: 8e-6, T2i: 20e-6, dt: dt * 1e-6 };
  });
  const pulse = { esd: pulseEsd, burst: pulseBurst, surge: pulseSurge, constants: { hbm: HBM } };

  /* ---- Schutzbauteile (fiktive Uebungswerte, A21) ---- */
  const PARTS = {
    tvs: {
      tvs3: { id: 'tvs3', name: 'TVS 3,3 V', vbr: 4.0, rdyn: 0.3, ct: 50e-12, eMax: 0.2e-3 },
      tvs5: { id: 'tvs5', name: 'TVS 5 V', vbr: 6.4, rdyn: 0.5, ct: 50e-12, eMax: 0.2e-3 },
      tvs12: { id: 'tvs12', name: 'TVS 12 V', vbr: 13.3, rdyn: 1.0, ct: 50e-12, eMax: 0.2e-3 },
      tvs24: { id: 'tvs24', name: 'TVS 24 V', vbr: 26.7, rdyn: 2.0, ct: 50e-12, eMax: 0.2e-3 }
    },
    var: {
      v230: { id: 'v230', name: 'Varistor 230 V', vacMax: 230, v1mA: 360, vc100: 600, eMax: 25 },
      v275: { id: 'v275', name: 'Varistor 275 V', vacMax: 275, v1mA: 430, vc100: 710, eMax: 40 },
      v320: { id: 'v320', name: 'Varistor 320 V', vacMax: 320, v1mA: 510, vc100: 830, eMax: 55 }
    }
  };
  Object.keys(PARTS.var).forEach(function (k) { const p = PARTS.var[k]; p.alpha = Math.log(1e5) / Math.log(p.vc100 / p.v1mA); });
  const U_NETZ = 253;                                   // 230 V + 10 %
  function varOf(x) { if (typeof x === 'string') return PARTS.var[x] || null; if (isObj(x) && pos(x.v1mA, NaN) > 0 && pos(x.alpha, NaN) > 0) return x; return null; }
  function varI(p, v) { return v <= 0 ? 0 : 1e-3 * Math.pow(v / p.v1mA, p.alpha); }
  const varistor = S(function (x) {
    const p = varOf(x); if (!p) return fail(TEXTS_LAY.schutzUnbekannt);
    return { ok: true, id: p.id, alpha: p.alpha, v1mA: p.v1mA, vc100: p.vc100, vacMax: p.vacMax, eMax: p.eMax, i: N(function (v) { v = num(v, NaN); return v >= 0 ? varI(p, v) : NaN; }) };
  });
  function tvsOf(x) { if (x === undefined || x === null || x === false || x === '' || x === 'kein') return null; if (typeof x === 'string') return PARTS.tvs[x] || undefined; if (isObj(x) && pos(x.vbr, NaN) > 0 && pos(x.rdyn, NaN) > 0) return x; return undefined; }

  /* ---- ESD in einen Anschlusspin: implizites (rueckwaerts-Euler) 2-Knoten-Netz, stueckweise linear ---- */
  const DEV_DEFAULT = { vdd: 3.3, vabs: 6.0, vil: 0.99, vih: 2.31, tglitch: 20e-9, tresetMin: 100e-9, surgeVmax: 1500 };
  const esdIO = S(function (cfg) {
    cfg = obj(cfg);
    const kV = cfg.kV === undefined ? 4 : num(cfg.kV, NaN), wv = pulseEsd(kV, 'kontakt');
    if (!wv.ok) return wv;
    const tvs = tvsOf(cfg.tvs); if (tvs === undefined) return fail(TEXTS_LAY.schutzUnbekannt);
    const rs = cfg.rs === undefined ? 0 : num(cfg.rs, NaN), cbuf = cfg.cbuf === undefined ? 0 : num(cfg.cbuf, NaN);
    const cp = cfg.cp === undefined ? 10e-12 : num(cfg.cp, NaN), cin = cfg.cin === undefined ? 5e-12 : num(cfg.cin, NaN), vdd = cfg.vdd === undefined ? DEV_DEFAULT.vdd : num(cfg.vdd, NaN);
    if (!(rs >= 0) || rs > 1e6 || !(cbuf >= 0) || cbuf > 1e-3 || !(cp > 0) || cp > 1e-6 || !(cin > 0) || cin > 1e-6 || !(vdd > 0) || vdd > 100) return fail(TEXTS_LAY.wertBad);
    const dtN = 0.02, n = 7500, dt = dtN * 1e-9, cq = cin + cbuf, gs = 1 / Math.max(rs, 1e-3);
    const gtvs = tvs ? 1 / tvs.rdyn : 0, vbr = tvs ? tvs.vbr : 0, vu = vdd + 0.7, gd = 1 / 5, vl = -0.7;
    const t = new Array(n + 1), vp = new Array(n + 1), vq = new Array(n + 1), itvs = new Array(n + 1), iesd = new Array(n + 1);
    let vp0 = 0, vq0 = 0, mt = false, mu = false, ml = false, vpPeak = 0, vqPeak = 0, wTvs = 0, wClamp = 0, qIn = 0, qTvs = 0, qClamp = 0;
    t[0] = 0; vp[0] = 0; vq[0] = 0; itvs[0] = 0; iesd[0] = 0;
    const gcp = cp / dt, gcq = cq / dt;
    for (let k = 1; k <= n; k++) {
      const tk = k * dtN, is = kV * esdShape(tk);
      let a = 0, b = 0, c2 = 0, d2 = 0, e1 = 0, e2 = 0, x1 = vp0, x2 = vq0;
      for (let it = 0; it < 8; it++) {
        // Gleichungen: (gcp + gs + [mt]gtvs) vp - gs vq = is + gcp vp0 + [mt] gtvs vbr ;  -gs vp + (gcq + gs + [mu]gd + [ml]gd) vq = gcq vq0 + [mu] gd vu + [ml] gd vl
        a = gcp + gs + (mt ? gtvs : 0); b = -gs; c2 = -gs; d2 = gcq + gs + (mu ? gd : 0) + (ml ? gd : 0);
        e1 = is + gcp * vp0 + (mt ? gtvs * vbr : 0); e2 = gcq * vq0 + (mu ? gd * vu : 0) + (ml ? gd * vl : 0);
        const det = a * d2 - b * c2;
        x1 = (e1 * d2 - b * e2) / det; x2 = (a * e2 - c2 * e1) / det;
        const nt = tvs ? x1 > vbr : false, nu = x2 > vu, nl = x2 < vl;
        if (nt === mt && nu === mu && nl === ml) break;
        mt = nt; mu = nu; ml = nl;
      }
      const it1 = (tvs && x1 > vbr) ? gtvs * (x1 - vbr) : 0, iu = x2 > vu ? gd * (x2 - vu) : 0, il = x2 < vl ? gd * (x2 - vl) : 0;
      vp0 = x1; vq0 = x2; t[k] = k * dt; vp[k] = x1; vq[k] = x2; itvs[k] = it1; iesd[k] = is;
      if (x1 > vpPeak) vpPeak = x1; if (x2 > vqPeak) vqPeak = x2;
      wTvs += x1 * it1 * dt; wClamp += (iu * (x2 - vdd) + il * (x2 - 0)) * dt; qIn += is * dt; qTvs += it1 * dt; qClamp += (iu + il) * dt;
    }
    const qCap = cp * vp0 + cq * vq0;
    return {
      ok: true, kV: kV, t: t, vp: vp, vq: vq, itvs: itvs, iesd: iesd, ip: wv.ip, vqPeak: vqPeak, vpPeak: vpPeak, wTvs: wTvs, wClamp: wClamp, qIn: qIn, qTvs: qTvs, qClamp: qClamp, qCap: qCap,
      qBalance: qIn - qCap - qTvs - qClamp, tvs: tvs ? tvs.id || 'tvs' : null, tvsPart: tvs, rs: rs, cbuf: cbuf, vdd: vdd, dt: dt
    };
  });

  /* ---- Entladung aufs Gehaeuse: Masseversatz dV = Rg*i + Lg*di/dt, kapazitiv auf die Reset-Leitung ---- */
  const LG = { g360: 5e-9, g50: 50e-9, lose: 500e-9, geliefert: 500e-9 };   // 'geliefert': Anbindung noch nicht geprueft (Fehlersuche em31), physikalisch wie 'lose'
  const bounce = S(function (cfg) {
    cfg = obj(cfg);
    const kV = cfg.kV === undefined ? 4 : num(cfg.kV, NaN), wv = pulseEsd(kV, 'kontakt'); if (!wv.ok) return wv;
    let lg = cfg.lg !== undefined ? num(cfg.lg, NaN) : (cfg.masse !== undefined ? (LG[cfg.masse] !== undefined ? LG[cfg.masse] : NaN) : LG.g50);
    const rg = cfg.rg === undefined ? 0.01 : num(cfg.rg, NaN), kk = cfg.kk === undefined ? 0.05 : num(cfg.kk, NaN);
    const rrst = cfg.rrst === undefined ? 10e3 : num(cfg.rrst, NaN), crst = cfg.crst === undefined ? 100e-12 : num(cfg.crst, NaN), vdd = cfg.vdd === undefined ? DEV_DEFAULT.vdd : num(cfg.vdd, NaN);
    if (!(lg >= 0) || lg > 1e-3 || !(rg >= 0) || !(kk >= 0) || kk > 1 || !(rrst > 0) || !(crst > 0) || !(vdd > 0)) return fail(TEXTS_LAY.wertBad);
    const n = wv.i.length - 1, dt = wv.dt, t = wv.t, i = wv.i, dv = new Array(n + 1), vr = new Array(n + 1), tau = rrst * crst;
    for (let k = 0; k <= n; k++) {
      const di = k === 0 ? (i[1] - i[0]) / dt : (k === n ? (i[n] - i[n - 1]) / dt : (i[k + 1] - i[k - 1]) / (2 * dt));
      dv[k] = rg * i[k] + lg * di;
    }
    // Reset-Leitung (Pull-up rrst, Kapazitaet crst): kapazitive Kopplung ist ein Hochpass,  dx/dt = kk * d(dV)/dt - x/tau,  vr = vdd + x  (linear).
    // Unterschreitet die Leitung -0,7 V, leitet die Eingangsdiode (Klemmung): Danach liegt die Leitung an der Klemmgrenze und erholt sich nur ueber
    // den Pull-up (Gedaechtnis, Zeitkonstante tau = rrst*crst). Ohne Klemmung zaehlt allein die Zeit unter vil. Anzeige oben auf vdd + 0,7 V begrenzt.
    const vilV = DEV_DEFAULT.vil, a = Math.exp(-dt / tau), vl = new Array(n + 1); let x = 0, prev = 0;     // vor dem Ereignis ist der Masseversatz 0
    for (let k = 0; k <= n; k++) { x = x * a + kk * (dv[k] - prev); prev = dv[k]; vl[k] = vdd + x; }
    let t1 = -1, k2 = -1, run = 0, runMax = 0;
    for (let k = 0; k <= n; k++) { if (vl[k] < vilV) { if (t1 < 0) t1 = k; run += dt; if (run > runMax) runMax = run; } else run = 0; if (vl[k] < -0.7) k2 = k; }
    const clampT = k2 >= 0, tRec = tau * Math.log((vdd + 0.7) / (vdd - vilV));      // Erholung von der Klemmgrenze bis vil
    const tBelow = clampT ? (k2 - t1) * dt + tRec : runMax;
    let vmin = vdd, tMin = 0;
    for (let k = 0; k <= n; k++) {
      let v = clamp(vl[k], -0.7, vdd + 0.7);
      if (clampT && k > k2) v = vdd - (vdd + 0.7) * Math.exp(-(k - k2) * dt / tau);   // Erholung ueber den Pull-up
      vr[k] = v; if (v < vmin) { vmin = v; tMin = t[k]; }
    }
    let dvMax = 0, dvMin = 0; for (let k = 0; k <= n; k++) { if (dv[k] > dvMax) dvMax = dv[k]; if (dv[k] < dvMin) dvMin = dv[k]; }
    return { ok: true, kV: kV, t: t, i: i, dv: dv, vrst: vr, vrstMin: vmin, tMin: tMin, tBelow: tBelow, tBelowVil: tBelow, lg: lg, rg: rg, kk: kk, tau: tau, dvMax: dvMax, dvMin: dvMin, vdd: vdd, vil: vilV };
  });

  /* ---- Burst ueber Koppelkapazitaet auf eine hochohmige Leitung: Treppe ---- */
  const burstLine = S(function (cfg) {
    cfg = obj(cfg);
    const kV = cfg.kV === undefined ? 4 : num(cfg.kV, NaN), fRep = cfg.fRep === undefined ? 5e3 : num(cfg.fRep, NaN), np = cfg.n === undefined ? 75 : Math.round(num(cfg.n, NaN));
    const cc = cfg.cc === undefined ? 100e-12 : num(cfg.cc, NaN), rin = cfg.rin === undefined ? 100e3 : num(cfg.rin, NaN), cin = cfg.cin === undefined ? 10e-12 : num(cfg.cin, NaN);
    if (!(kV > 0) || kV > 10) return fail(tx('pegel', { max: 10 }));
    if (!(fRep > 0) || fRep > 1e6 || !(np >= 1) || np > 1000 || !(cc > 0) || !(rin > 0) || !(cin >= 0)) return fail(TEXTS_LAY.wertBad);
    const vclamp = cfg.vclamp === undefined ? Infinity : num(cfg.vclamp, NaN);
    if (!(vclamp > 0)) return fail(TEXTS_LAY.wertBad);
    const gap = 1 / fRep, tau = rin * (cc + cin), dStep = kV * 1e3 * cc / (cc + cin), q = Math.exp(-gap / tau);
    const v = [], t = [], vt = []; let vc = 0;
    const tt = [];
    for (let k = 0; k < np; k++) {
      vc = vc * q + dStep; if (vc > vclamp) vc = vclamp; v.push(vc); tt.push(k * gap);
    }
    // Zeitverlauf fuer die Zeichnung: vor dem Impuls (nach der Entladung), nach dem Impuls (Sprung)
    let vv = 0;
    for (let k = 0; k < np; k++) {
      if (k > 0) { vv = vv * q; } t.push(k * gap); vt.push(vv);
      vv = Math.min(vclamp, vv + dStep); t.push(k * gap); vt.push(vv);
    }
    const tEnd = (np - 1) * gap + Math.min(3 * tau, 5 * gap); t.push(tEnd); vt.push(vv * Math.exp(-(tEnd - (np - 1) * gap) / tau));
    const vInf = dStep / (1 - q), vN = dStep * (1 - Math.pow(q, np)) / (1 - q);
    return { ok: true, kV: kV, fRep: fRep, n: np, cc: cc, rin: rin, cin: cin, tau: tau, gap: gap, dStep: dStep, v: v, tPulse: tt, vN: vN, vInf: vInf, vMax: v[np - 1], treppe: tau > gap, t: t, vt: vt };
  });

  /* ---- Surge auf die Netzleitung: Spannungsquelle 1,2/50 µs hinter zi, Varistor parallel zur Last ---- */
  const surgeSim = S(function (cfg) {
    cfg = obj(cfg);
    const kV = cfg.kV === undefined ? 2 : num(cfg.kV, NaN), zi = cfg.zi === undefined ? 2 : num(cfg.zi, NaN), rload = cfg.rload === undefined ? 1e4 : num(cfg.rload, NaN);
    const uNetz = cfg.uNetz === undefined ? U_NETZ : num(cfg.uNetz, NaN);
    const wv = pulseSurge(kV, { zi: zi }); if (!wv.ok) return wv;
    if (!(rload > 0) || !(uNetz > 0)) return fail(TEXTS_LAY.wertBad);
    let vp = null; const vk = cfg.var === undefined || cfg.var === null || cfg.var === 'kein' || cfg.var === false ? null : varOf(cfg.var);
    if (cfg.var !== undefined && cfg.var !== null && cfg.var !== 'kein' && cfg.var !== false && !vk) return fail(TEXTS_LAY.schutzUnbekannt);
    vp = vk;
    const n = wv.t.length - 1, dt = wv.dt, v = new Array(n + 1), isrc = new Array(n + 1), ivar = new Array(n + 1);
    let vPeak = 0, iPeak = 0, w = 0;
    for (let k = 0; k <= n; k++) {
      const us = wv.u[k];
      // (us - V)/zi = V/rload + iVar(V) : monoton in V -> Bisektion
      let lo = 0, hi = Math.max(us, 1e-9);
      if (us <= 0) { v[k] = 0; isrc[k] = 0; ivar[k] = 0; continue; }
      const fn = V => (us - V) / zi - V / rload - (vp ? varI(vp, V) : 0);
      for (let it = 0; it < 60; it++) { const mid = 0.5 * (lo + hi); if (fn(mid) > 0) lo = mid; else hi = mid; }
      const V = 0.5 * (lo + hi); v[k] = V; ivar[k] = vp ? varI(vp, V) : 0; isrc[k] = (us - V) / zi;
      if (V > vPeak) vPeak = V; if (isrc[k] > iPeak) iPeak = isrc[k];
      w += V * ivar[k] * dt;
    }
    return {
      ok: true, kV: kV, zi: zi, t: wv.t, v: v, i: isrc, iVar: ivar, vPeak: vPeak, iPeak: iPeak, w: w, wLimit: vp ? vp.eMax : null, varId: vp ? vp.id || 'var' : null, varPart: vp, uOpen: wv.u,
      dauer: vp ? { u: uNetz, vacMax: vp.vacMax, ok: uNetz <= vp.vacMax } : null, dt: dt
    };
  });

  const protect = { parts: PARTS, varistor: varistor, esdIO: esdIO, bounce: bounce, burstLine: burstLine, surge: surgeSim, constants: { uNetz: U_NETZ, lg: LG } };

  /* ---- Reaktion des Geraets (Uebungs-Controller, A22) ---- */
  function excursions(t, v, thr, minDur, above) {
    let n = 0, cur = 0, maxd = 0; const dt = t.length > 1 ? t[1] - t[0] : 0;
    for (let k = 0; k < v.length; k++) {
      const hit = above ? v[k] > thr : v[k] < thr;
      if (hit) cur += dt; else { if (cur >= minDur && cur > 0) n++; if (cur > maxd) maxd = cur; cur = 0; }
    }
    if (cur >= minDur && cur > 0) n++; if (cur > maxd) maxd = cur;
    return { n: n, max: maxd };
  }
  const verdict = S(function (sim, kind, params) {
    if (!isObj(sim) || sim.ok === false) return fail(TEXTS_LAY.simFehlt);
    const p = Object.assign({}, DEV_DEFAULT, isObj(params) ? params : {});
    ['vdd', 'vabs', 'vil', 'vih', 'tglitch', 'tresetMin', 'surgeVmax'].forEach(function (k) { p[k] = num(p[k], DEV_DEFAULT[k]); });
    const why = [], notes = [], K = TEXTS_LAY.kriterium;
    let kr = 'A', nGlitch = 0, nReset = 0, resetNs = 0, resetV = NaN, vq = NaN;
    const rank = { A: 0, B: 1, C: 2, Ausfall: 3 };
    function raise(k) { if (rank[k] > rank[kr]) kr = k; }
    if (kind === 'esd') {
      if (!isArr(sim.vq) || !isArr(sim.t)) return fail(TEXTS_LAY.simFehlt);
      vq = sim.vqPeak;
      if (!(vq <= p.vabs)) { raise('Ausfall'); why.push(tx('esdAusfall', { vq: fm(vq, 1), vabs: fm(p.vabs, 1) })); }
      const tp = sim.tvsPart;
      if (tp && sim.wTvs > tp.eMax) { raise('Ausfall'); why.push(tx('esdTvsEnergie', { w: fm(sim.wTvs * 1e3, 3), wl: fm(tp.eMax * 1e3, 1) })); }
      const ex = excursions(sim.t, sim.vq, p.vih, p.tglitch, true);
      nGlitch = ex.n;
      if (kr !== 'Ausfall' && ex.n > 0) { raise(ex.n >= 5 ? 'C' : 'B'); why.push(tx('esdDaten', { n: ex.n, tg: eng(p.tglitch, 's'), vih: fm(p.vih, 2), vq: fm(vq, 1) })); }
      if (kr === 'A') why.push(tx('esdOk', { vq: fm(vq, 1), vabs: fm(p.vabs, 1) }));
    } else if (kind === 'bounce') {
      if (!isArr(sim.vrst) || !isArr(sim.t)) return fail(TEXTS_LAY.simFehlt);
      vq = NaN; resetV = sim.vrstMin; resetNs = sim.tBelow * 1e9;
      if (sim.tBelow >= p.tresetMin) { nReset = 1; raise('B'); why.push(tx('esdReset', { t: eng(sim.tBelow, 's'), v: fm(p.vil, 2) })); }
      else why.push('Der Reset-Pegel sank auf ' + fm(sim.vrstMin, 2) + ' V und lag nur ' + eng(sim.tBelow, 's') + ' unter ' + fm(p.vil, 2) + ' V (nötig sind ' + eng(p.tresetMin, 's') + '): Kriterium A.');
    } else if (kind === 'burst') {
      if (!isArr(sim.v)) return fail(TEXTS_LAY.simFehlt);
      const lim = p.vdd + 0.7; let cnt = 0, vmax = 0, first = -1;
      sim.v.forEach(function (x, k) { const y = Math.min(x, lim); if (y > vmax) vmax = y; if (y >= (params && params.line === 'reset' ? p.vdd - p.vil : p.vih)) { cnt++; if (first < 0) first = k; } });
      vq = vmax;
      if (params && params.line === 'reset') {
        // aktiv-tiefe Reset-Leitung: Die Treppe zieht die Leitung unter vil, solange sie ueber vdd - vil liegt (negative Burst-Polaritaet)
        const depthNeed = p.vdd - p.vil;
        if (cnt > 0) {
          const tLow = (sim.v.length - 1 - first) * sim.gap + sim.tau * Math.log(Math.max(vmax, depthNeed) / depthNeed);
          resetV = p.vdd - vmax; resetNs = tLow * 1e9;
          if (tLow >= p.tresetMin) { nReset = 1; raise('B'); why.push(tx('esdReset', { t: eng(tLow, 's'), v: fm(p.vil, 2) })); }
        }
        if (kr === 'A') why.push('Die Leitung sinkt höchstens auf ' + fm(p.vdd - Math.min(vmax, lim), 2) + ' V und bleibt nicht länger als ' + eng(p.tresetMin, 's') + ' unter ' + fm(p.vil, 2) + ' V: kein Reset, Kriterium A.');
      } else {
        nGlitch = cnt;
        if (cnt > 0) { const k = cnt >= 5 ? 'C' : 'B'; raise(k); why.push(tx('burstDaten', { n: cnt, np: sim.v.length, vih: fm(p.vih, 2), v: fm(vmax, 2), k: k })); }
        else why.push(tx('burstOk', { v: fm(vmax, 2), vih: fm(p.vih, 2) }));
      }
      if (sim.treppe && sim.n > 1) notes.push(tx('burstTreppe', { n: sim.n, v: fm(sim.vN, 1), tau: eng(sim.tau, 's'), gap: eng(sim.gap, 's') }));
    } else if (kind === 'surge') {
      if (!fin(sim.vPeak)) return fail(TEXTS_LAY.simFehlt);
      vq = sim.vPeak;
      if (sim.vPeak > p.surgeVmax) { raise('Ausfall'); why.push(tx('surgeAusfall', { v: fm(sim.vPeak, 0), vmax: fm(p.surgeVmax, 0) })); }
      if (sim.wLimit && sim.w > sim.wLimit) { raise('Ausfall'); why.push(tx('surgeEnergie', { w: fm(sim.w, 1), wl: fm(sim.wLimit, 0) })); }
      if (kr === 'A') why.push(tx('surgeOk', { v: fm(sim.vPeak, 0), vmax: fm(p.surgeVmax, 0), w: fm(sim.w || 0, 1), wl: sim.wLimit ? fm(sim.wLimit, 0) : '–' }));
      if (sim.dauer && !sim.dauer.ok) notes.push(tx('varDauer', { u: fm(sim.dauer.u, 0), vac: fm(sim.dauer.vacMax, 0) }));
    } else return fail(TEXTS_LAY.kindUnbekannt);
    const ampel = kr === 'A' ? 'gruen' : kr === 'B' ? 'gelb' : 'rot';
    return { ok: true, kind: kind, kriterium: kr, ampel: ampel, text: K[kr], why: why, notes: notes, vq: vq, vabs: p.vabs, resetNs: resetNs, resetV: resetV, vil: p.vil, nGlitch: nGlitch, nReset: nReset };
  });
  const device = { params: DEV_DEFAULT, verdict: verdict };

  /* =====================================================================================================
   *  4.9 MESSEN
   * ===================================================================================================== */
  const LEADS = { klemme: 150, kurz: 50, feder: 12 };
  const CP_TK = { x10: 10e-12, x1: 100e-12 };
  function leadMmOf(v) {
    if (typeof v === 'string' && LEADS[v] !== undefined) return LEADS[v];
    const x = num(v, NaN); if (!(x > 0)) return NaN;
    return x <= 1 ? x * 1e3 : x;
  }
  /* Inverse einer 4x4-Matrix (Gauss-Jordan mit Spaltenpivot) oder null */
  function inv4(m) {
    const n = 4, a = m.map((r, i) => r.concat([0, 1, 2, 3].map(j => (i === j ? 1 : 0))));
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (!(Math.abs(a[p][c]) > 1e-300)) return null;
      const tmp = a[c]; a[c] = a[p]; a[p] = tmp;
      const d = a[c][c]; for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; }
    }
    return a.map(r => r.slice(n));
  }
  const probe = S(function (cfg) {
    cfg = obj(cfg);
    const amp = ov(cfg.amp, 3.3), rsrc = ov(cfg.rsrc, 50);
    let trs = cfg.trsNs !== undefined ? ov(cfg.trsNs, NaN) * 1e-9 : ov(cfg.trs, 5e-9);
    const leadRaw = cfg.leadMm !== undefined ? cfg.leadMm : (cfg.lead === undefined ? 'klemme' : cfg.lead);
    const leadMm = leadMmOf(leadRaw);
    if (typeof leadRaw === 'string' && LEADS[leadRaw] === undefined) return fail(TEXTS_LAY.tkLead);
    let teiler = cfg.teiler === undefined ? 'x10' : cfg.teiler;
    if (typeof teiler !== 'string' || CP_TK[teiler] === undefined) { if (cfg.cp === undefined) return fail(TEXTS_LAY.tkTeiler); }
    const cp = cfg.cp !== undefined && cfg.cp !== null ? ov(cfg.cp, NaN) : CP_TK[teiler];
    const bwTk = cfg.bwTkMHz !== undefined ? ov(cfg.bwTkMHz, NaN) * 1e6 : ov(cfg.bwTk, 100e6), bwOsz = cfg.bwOszMHz !== undefined ? ov(cfg.bwOszMHz, NaN) * 1e6 : ov(cfg.bwOsz, 200e6);
    const didt = cfg.didtAus !== undefined ? ov(cfg.didtAus, NaN) * 1e6 : ov(cfg.didt, 10e6);
    let dn = cfg.dnearMm !== undefined ? ov(cfg.dnearMm, NaN) * 1e-3 : (cfg.dnear !== undefined ? leadMmOf(cfg.dnear) * 1e-3 : (cfg.d !== undefined ? leadMmOf(cfg.d) * 1e-3 : 0.05));
    if (!(amp > 0) || !(rsrc > 0) || !(trs > 0) || !(leadMm > 0) || !(cp > 0) || !(bwTk > 0) || !(bwOsz > 0) || !(didt >= 0) || !(dn > 0)) return fail(TEXTS_LAY.tkWert);
    if (trs > 1e-3 || rsrc > 1e6 || leadMm > 1e4 || bwTk > 1e12 || bwOsz > 1e12) return fail(TEXTS_LAY.tkWert);
    const lg = 1e-9 * leadMm, zeta = (rsrc / 2) * Math.sqrt(cp / lg), wn = 1 / Math.sqrt(lg * cp), fr = wn / TWO_PI;
    const os = zeta < 1 ? Math.exp(-Math.PI * zeta / Math.sqrt(1 - zeta * zeta)) : 0;
    const trTk = 0.35 / bwTk, trOsz = 0.35 / bwOsz, trMess = Math.sqrt(trs * trs + trTk * trTk + trOsz * trOsz);
    const trSys = Math.sqrt(trTk * trTk + trOsz * trOsz), bwSys = 0.35 / trSys, trLoad = 2.2 * rsrc * cp;
    // eingefangene Stoerspannung u = mu0/(2 pi d) * A * dI/dt, A = Masseleitungslaenge * 10 mm
    const area = leadMm * 1e-3 * 10e-3, pick = (MU0 / (TWO_PI * dn)) * area * didt;
    // Zeitverlauf: Kreis  y'' + 2 zeta wn y' + wn^2 y = wn^2 u(t)  (Rampe u) mit zwei Einpol-Tiefpaessen (Tastkopf, Oszilloskop);
    // Trapezverfahren (A-stabil, daher auch bei extremen Werten endlich): (I - h/2 A) x1 = (I + h/2 A) x0 + h/2 B (u0 + u1)
    const tEnd = Math.max(8 * trs, 6 / fr + trs, 8 * (trTk + trOsz)), nPts = 400, t = new Array(nPts), vT = new Array(nPts), vM = new Array(nPts), t0 = 0.5 * trs;
    const tauA = 1 / (TWO_PI * bwTk), tauB = 1 / (TWO_PI * bwOsz);
    const sub = clamp(Math.ceil((tEnd / (nPts - 1)) / (Math.min(trs, 1 / fr, tauA, tauB) / 20)), 1, 100);
    const dt = tEnd / (nPts - 1) / sub;
    const u = tt => { const s = tt - t0; return amp * (s <= 0 ? 0 : s >= trs ? 1 : s / trs); };
    const Am = [[0, 1, 0, 0], [-wn * wn, -2 * zeta * wn, 0, 0], [1 / tauA, 0, -1 / tauA, 0], [0, 0, 1 / tauB, -1 / tauB]], Bv = [0, wn * wn, 0, 0];
    const Nm = Am.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) - dt / 2 * x)), Pm = Am.map((r, i) => r.map((x, j) => (i === j ? 1 : 0) + dt / 2 * x));
    const Ni = inv4(Nm); if (!Ni) return fail(TEXTS_LAY.tkWert);
    let st = [0, 0, 0, 0], tt = 0, osMeas = 0;
    for (let k = 0; k < nPts; k++) {
      t[k] = k * (tEnd / (nPts - 1)); vT[k] = u(t[k]); vM[k] = st[3];
      if (st[3] / amp - 1 > osMeas) osMeas = st[3] / amp - 1;
      if (k === nPts - 1) break;
      for (let q = 0; q < sub; q++) {
        const u0 = u(tt), u1 = u(tt + dt), rhs = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) { let sx = dt / 2 * Bv[i] * (u0 + u1); for (let j = 0; j < 4; j++) sx += Pm[i][j] * st[j]; rhs[i] = sx; }
        const nx = [0, 0, 0, 0]; for (let i = 0; i < 4; i++) { let sx = 0; for (let j = 0; j < 4; j++) sx += Ni[i][j] * rhs[j]; nx[i] = sx; }
        st = nx; tt += dt;
      }
      if (!fin(st[3])) return fail(TEXTS_LAY.tkWert);
    }
    // gemessene Anstiegszeit (10 bis 90 %) aus dem Zeitverlauf
    let a10 = NaN, a90 = NaN, vmaxM = 0; for (let k = 0; k < nPts; k++) if (vM[k] > vmaxM) vmaxM = vM[k];
    const ref = Math.min(amp, vmaxM > 0 ? amp : vmaxM);
    for (let k = 1; k < nPts; k++) {
      if (isNaN(a10) && vM[k] >= 0.1 * ref) a10 = t[k - 1] + (0.1 * ref - vM[k - 1]) / (vM[k] - vM[k - 1]) * (t[k] - t[k - 1]);
      if (isNaN(a90) && vM[k] >= 0.9 * ref) { a90 = t[k - 1] + (0.9 * ref - vM[k - 1]) / (vM[k] - vM[k - 1]) * (t[k] - t[k - 1]); break; }
    }
    const trWave = (a90 - a10) / 0.8;                               // auf Anstiegszeit "0 bis 100 %" des Modells zurueckgerechnet (lineare Rampe)
    const trFehler = 100 * (trMess - trs) / trs, osP = os * 100;
    const res = {
      ok: true, zeta: zeta, fr: fr, os: os, osMeas: osMeas, lgH: lg, lgNH: leadMm, cpF: cp, leadMm: leadMm, trs: trs, trMess: trMess, trTk: trTk, trOsz: trOsz, trLoad: trLoad, trWave: trWave, trFehler: trFehler,
      bw: bwSys, bwSys: bwSys, pick: pick, area: area, areaM2: area, pickRel: pick / amp, amp: amp, t: t, vTrue: vT, vMeas: vM, osPct: osP, rsrc: rsrc, didt: didt, dnear: dn
    };
    if (os > 0.1) res.ringText = tx('tkRing', { l: fm(leadMm, 0), f: eng(fr, 'Hz'), os: fm(osP, 1) });
    if (pick > 0.05 * amp) res.pickText = tx('tkPick', { v: eng(pick, 'V') });
    return res;
  });

  /* ---- Nahfeld: relative Karte, Platine 100 x 70 mm, Sondenhoehe 5 mm (A25) ---- */
  const NEAR_SRC = [
    { id: 'schaltknoten', name: 'Schaltknoten', x: 25, y: 40, kind: 'dipol', d0: 9 },
    { id: 'drossel', name: 'Drossel', x: 45, y: 32, kind: 'dipol', d0: 8 },
    { id: 'takt', name: 'Taktleitung', x0: 60, y0: 15, x1: 90, y1: 15, x: 75, y: 15, kind: 'leitung', d0: 4 },
    { id: 'schleife', name: 'Stromschleife', x0: 60, y0: 50, x1: 80, y1: 50, x: 70, y: 50, kind: 'leitung', d0: 5 }
  ];
  const PROBE_H = 5;
  function nearLevels(cfg) {
    // Pegel der vier Quellen in dB (Bezug beliebig); cfg.levels ueberschreibt, sonst Modell aus Oberwelle n, Layout, Snubber
    const n = ov(cfg.n, 3); if (!(n > 0) || n > 1e6) return null;
    const lay = cfg.layout === 'optimiert' ? -6 : 0, snub = (cfg.snub === true || (isObj(cfg.snub) && cfg.snub.on)) ? 1 : 0;
    const lv = { schaltknoten: 60 - 20 * log10(n / 3) + lay - (snub && n >= 51 ? 4 : 0), drossel: 54 - 20 * log10(n / 3) + lay, takt: 48 - 10 * log10(n / 3), schleife: 50 - 10 * log10(n / 3) + lay };
    if (isObj(cfg.levels)) Object.keys(lv).forEach(function (k) { const x = num(cfg.levels[k], NaN); if (fin(x)) lv[k] = x; });
    return lv;
  }
  function nearAt(lv, x, y) {
    // Leistungssumme der vier Quellen; Abstand d = Wurzel(Abstand in der Ebene^2 + Sondenhoehe^2)
    let p = 0, best = null;
    NEAR_SRC.forEach(function (s) {
      let d;
      if (s.kind === 'dipol') d = Math.hypot(Math.hypot(x - s.x, y - s.y), PROBE_H);
      else d = Math.hypot(distPtSeg([x, y], [s.x0, s.y0], [s.x1, s.y1]), PROBE_H);
      const a = Math.pow(10, lv[s.id] / 20) * (s.kind === 'dipol' ? 1 / (1 + Math.pow(d / s.d0, 3)) : 1 / (1 + d / s.d0));
      const pw = a * a; p += pw; if (!best || pw > best.p) best = { p: pw, s: s };
    });
    return { db: 10 * log10(p + 1e-30), src: best ? best.s : null };
  }
  const nearGrid = S(function (cfg) {
    cfg = obj(cfg); const nx = 40, ny = 28, lv = nearLevels(cfg);
    if (!lv) return fail(TEXTS_LAY.nahWert);
    const rows = []; let mx = -Infinity, mpos = [0, 0];
    for (let j = 0; j < ny; j++) { const row = []; for (let i = 0; i < nx; i++) { const x = (i + 0.5) * 100 / nx, y = (j + 0.5) * 70 / ny, v = nearAt(lv, x, y).db; row.push(v); if (v > mx) { mx = v; mpos = [x, y]; } } rows.push(row); }
    // Hot-Spots: Pegel an den Quellenpositionen; das Maximum der Karte schliesst die Quellenpositionen ein (Bezug fuer alle Werte)
    const hot0 = NEAR_SRC.map(function (s) { return nearAt(lv, s.x, s.y).db; });
    hot0.forEach(function (v, k) { if (v > mx) { mx = v; mpos = [NEAR_SRC[k].x, NEAR_SRC[k].y]; } });
    const db = rows.map(r => r.map(v => v - mx));
    const hot = NEAR_SRC.map(function (s, k) { return { id: s.id, name: s.name, x: s.x, y: s.y, db: hot0[k] - mx }; });
    return { ok: true, nx: nx, ny: ny, w: 100, h: 70, db: db, max: mx, maxAt: mpos, hot: hot, levels: lv };
  });
  const nearFn = N(function (cfg, x, y) {
    cfg = obj(cfg); x = num(x, NaN); y = num(y, NaN);
    if (!fin(x) || !fin(y)) return NaN;
    x = clamp(x, 0, 100); y = clamp(y, 0, 70);
    const lv = nearLevels(cfg), g = nearGrid(cfg); if (!lv || !g.ok) return NaN;
    return nearAt(lv, x, y).db - g.max;
  });
  nearFn.grid = nearGrid;
  nearFn.at = Gn(function (cfg, x, y) {
    cfg = obj(cfg); x = num(x, NaN); y = num(y, NaN); if (!fin(x) || !fin(y)) return fail(TEXTS_LAY.nahWert);
    x = clamp(x, 0, 100); y = clamp(y, 0, 70); const lv = nearLevels(cfg), g = nearGrid(cfg); if (!lv || !g.ok) return fail(TEXTS_LAY.nahWert); const r = nearAt(lv, x, y);
    return { ok: true, db: r.db - g.max, src: r.src ? r.src.id : null, srcName: r.src ? r.src.name : '' };
  }, fail(TEXTS_LAY.nahWert));

  /* ---- Analysator ---- */
  const rbwFor = N(function (f) { f = pos(f, NaN); if (!(f > 0)) return NaN; return f < 150e3 ? 200 : (f < 30e6 ? 9e3 : 120e3); });
  const FLOOR9K = 10;                                  // angezeigter mittlerer Rauschpegel bei 9 kHz in dBuV
  function analyzerAt(lines, rbw, f) {
    // Linien im selben Filter addieren sich in Leistung; Filterflanke -3*(2*df/rbw)^2 dB, hoechstens -60 dB
    let p = 0;
    for (let k = 0; k < lines.length; k++) {
      const df = Math.abs(lines[k].f - f), att = Math.min(60, 3 * Math.pow(2 * df / rbw, 2));
      if (att >= 60) continue;
      p += Math.pow(10, (lines[k].L - att) / 10);
    }
    return p > 0 ? 10 * log10(p) : -Infinity;
  }
  const markerAtFn = Gn(function (res, f) {
    if (!isObj(res) || !isArr(res.lines)) return null; f = pos(f, NaN); if (!(f > 0)) return null;
    let best = null;
    res.lines.forEach(function (l, k) { const d = Math.abs(Math.log(l.f / f)); if (!best || d < best.d) best = { d: d, idx: k, f: l.f, L: l.L, hidden: !!l.hidden }; });
    return best ? { idx: best.idx, f: best.f, L: best.L, hidden: best.hidden } : null;
  }, null);
  const analyzer = S(function (lines, cfg) {
    cfg = obj(cfg);
    if (!isArr(lines) || lines.length > 20000) return fail(TEXTS_LAY.anaLinien);
    const ls = [];
    for (let k = 0; k < lines.length; k++) { const q = lines[k]; if (!isObj(q)) return fail(TEXTS_LAY.anaLinien); const f = pos(q.f, NaN), L = num(q.L, NaN); if (!(f > 0) || !fin(L)) return fail(TEXTS_LAY.anaLinien); ls.push({ f: f, L: L, src: k }); }
    let fa = cfg.fStart === undefined ? (ls.length ? Math.min.apply(null, ls.map(l => l.f)) : 150e3) : num(cfg.fStart, NaN);
    let fb = cfg.fStop === undefined ? (ls.length ? Math.max.apply(null, ls.map(l => l.f)) * 1.05 : 30e6) : num(cfg.fStop, NaN);
    if (!(fa > 0) || !(fb > fa)) return fail(TEXTS_LAY.anaBereich);
    const rbw = cfg.rbw === undefined ? rbwFor(fa) : num(cfg.rbw, NaN);
    if (!(rbw > 0) || rbw > 1e9) return fail(TEXTS_LAY.wertBad);
    const floor9 = cfg.floor === undefined ? FLOOR9K : num(cfg.floor, NaN); if (!fin(floor9)) return fail(TEXTS_LAY.wertBad);
    const floor = floor9 + 10 * log10(rbw / 9e3);
    const nPts = cfg.points === undefined ? 600 : Math.round(num(cfg.points, NaN)); if (!(nPts >= 2) || nPts > 20000) return fail(TEXTS_LAY.wertBad);
    const sweeps = cfg.sweeps === undefined ? 1 : Math.round(num(cfg.sweeps, NaN)); if (!(sweeps >= 1) || sweeps > 50) return fail(TEXTS_LAY.wertBad);
    const seed = cfg.seed === undefined ? 1 : num(cfg.seed, 1), rg = rngOf(seed);
    // Frequenzraster: logarithmisch plus jede Linienfrequenz im Bereich (damit das Maximum exakt getroffen wird)
    const fs = []; for (let k = 0; k < nPts; k++) fs.push(fa * Math.pow(fb / fa, k / (nPts - 1)));
    ls.forEach(function (l) { if (l.f >= fa && l.f <= fb) fs.push(l.f); });
    fs.sort(function (a, b) { return a - b; });
    const fu = [fs[0]]; for (let k = 1; k < fs.length; k++) if (fs[k] > fu[fu.length - 1]) fu.push(fs[k]);
    const nz = Math.pow(10, floor / 10), L = new Array(fu.length).fill(-Infinity);
    for (let sw = 0; sw < sweeps; sw++) {
      for (let k = 0; k < fu.length; k++) {
        const sig = analyzerAt(ls, rbw, fu[k]), noise = floor + clamp(0.5 * rg.normal(), -1, 1);
        const p = (isFinite(sig) ? Math.pow(10, sig / 10) : 0) + Math.pow(10, noise / 10);
        const lv = 10 * log10(p); if (lv > L[k]) L[k] = lv;     // Spitzenwert-Halten ueber alle Durchlaeufe
      }
    }
    let mx = { f: fu[0], L: L[0] }; for (let k = 1; k < L.length; k++) if (L[k] > mx.L) mx = { f: fu[k], L: L[k] };
    const hidden = [], visible = [];
    const outLines = ls.map(function (l) { const inR = l.f >= fa && l.f <= fb, h = l.L < floor; const o = { f: l.f, L: l.L, hidden: h && inR, inRange: inR }; if (inR) (h ? hidden : visible).push({ f: l.f, L: l.L }); return o; });
    const res = { ok: true, f: fu, L: L, points: fu.map((q, k) => [q, L[k]]), rbw: rbw, floor: floor, floor9k: floor9, fStart: fa, fStop: fb, max: mx, hidden: hidden, visible: visible, lines: outLines, floorText: hidden.length ? tx('unterRauschen') : '' };
    res.markerAt = function (f) { return markerAtFn(res, f); };
    return res;
  });

  /* ---- Netznachbildung (V-LISN, vereinfacht, A18): 50 Ohm parallel 50 µH je Leiter ---- */
  const LISN = {
    R: { gt: 25, gg: 50 }, L: 50e-6, Rn: 50,
    z: N(function (f) {
      f = pos(f, NaN); if (!(f > 0)) return NaN;
      const x = TWO_PI * f * LISN_L, den = 50 * 50 + x * x;                       // 50 || jX = 50 * jX / (50 + jX)
      return Math.hypot(50 * x * x / den, 50 * 50 * x / den);
    }),
    level: N(function (iPeak, mode) {
      iPeak = pos(iPeak, NaN); if (!(iPeak > 0)) return NaN;
      const r = mode === 'gt' ? 25 : mode === 'gg' ? 50 : NaN; if (!fin(r)) return NaN;
      return uv(iPeak / Math.SQRT2 * r);
    })
  };
  const LISN_L = 50e-6;
  const meas = { probe: probe, nearField: nearFn, nearSources: NEAR_SRC, analyzer: analyzer, rbwFor: rbwFor, markerAt: markerAtFn, lisn: LISN, constants: { probeHeight: PROBE_H, floor9k: FLOOR9K, leads: LEADS, cp: CP_TK } };

  /* ---------- an EMV_CORE haengen (vorhandene Felder nie ueberschreiben, ausser Version von Teil 2) ---------- */
  CORE.layout = layout; CORE.pulse = pulse; CORE.protect = protect; CORE.device = device; CORE.meas = meas;
  CORE.layLoaded = '1.0';
  if (typeof module !== 'undefined' && module.exports) module.exports = CORE;
})(typeof window !== 'undefined' ? window : globalThis);
