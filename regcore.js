/* regcore.js - Regelungstechnik-Lab Kern (REG_CORE, Version 1.0)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.REG_CORE, Node: module.exports / globalThis.REG_CORE.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Bezeichnungen (DIN 19226, Annahme A1): w Fuehrungsgroesse (Sollwert), x Regelgroesse (Istwert), y Stellgroesse,
 *    z Stoergroesse, e = w - x Regeldifferenz. Regler und Kennwerte rechnen in PROZENT des Messbereichs (A2).
 *  - Zeit: intern Prozess-Sekunden. Feste Schrittweite h je Anlage; Totzeiten werden auf Vielfache von h gerundet
 *    (Fehler <= h/2). Zufall nur ueber rng(seed) (mulberry32, Box-Muller).
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings,
 *    Objekte ohne Felder, negative Zeiten) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen
 *    { ok:false, why:'deutscher Text' }. Methoden zurueckgegebener Objekte (step, reset, ...) sind ebenfalls robust.
 *  - Bausteine (lag, delay, plant): Das Schrittverfahren ist zweiter Ordnung genau. Jeder Baustein liefert neben dem Wert am
 *    Schrittende auch den Wert in der Schrittmitte; der naechste Baustein der Kette rechnet mit der Schrittmitte
 *    (Totzeit und Stufensignale halten den Wert). Ein einzelnes PT1 ist exakt (Fehler < 1e-9).
 *
 * ===================================================================================================
 * ENTSCHEIDUNGEN BEI OFFENEN PUNKTEN (Praezisierungen der Spezifikation, Details in quelle/reglab/ABWEICHUNGEN.md)
 *  - Anti-Windup 'rueck': I += Kp*Ta/Tn*e + (Ta/Tr)*(y_alt - yu_alt) mit den Werten des Vorschritts.
 *  - Stoessfreie Umschaltung: bumpless() zieht den naechsten I-Zuwachs schon ab, deshalb springt y beim Umschalten nicht.
 *  - oscillation(): Das Amplitudenverhaeltnis wird auf eine volle Periode umgerechnet (ratioPeriod), damit kurze und
 *    lange Aufzeichnungen gleich klassifiziert werden; ratio ist das rohe Verhaeltnis letzte/erste Amplitude.
 *  - fitStep(): Glaettungsfenster 5 bei rauschfreien Daten, bei Rauschen wird es aus dem geschaetzten Rauschen berechnet.
 *  - Frequenzgang: negative K-Glieder tragen -pi nach Paritaet (gerade Anzahl: 0), damit die Phasensumme stetig bleibt.
 * ===================================================================================================
 * SCHNITTSTELLEN FUER ANDERE PAKETE (Kurzfassung, Abschnitt 4 der Spezifikation ist massgeblich)
 *  Bausteine (M1): lag(T,h) {step(u), stepMid(u), reset(y0), value()}; delay(Tt,h) {step(u), reset(y0), N}; rk4(f,x,u,h);
 *    rateLimit(rate) {step(u,h), reset}; deadband(db) {step(u,mid)}; backlash(b) {step(xi), reset(xo0)};
 *    valveChar(y,kind,R), valveSlope(y,kind,R) (1/%); sensor({T,noise,seed}) {step(x,h), reset, setNoise(s), value()}.
 *  plant({blocks,op,zIn,zOut,xmin,xmax,limit,x0}, h) {step(y,z)->x, reset(x0), setSteady(y,z,x0), steady(y,z), gain(), blocks(), state(), msgs}
 *    Bloecke: K{K}, PT1{T}, PT2{w0,D} (oder {T1,T2}), I{Ki}, Tt{Tt}. Strecke hat Ausgleich: steady() liefert x, sonst NaN.
 *  controller(spec, h) {step(w,x)->y, bumpless(yHand,w,x)->y, reset(), setParams(p)->{ok,why,kept}, state(), params()}
 *    EIN Aufruf von step()/bumpless() = EIN Kernschritt h; gerechnet wird alle Ta (Ausgang dazwischen gehalten). Rig ruft im Handbetrieb
 *    bumpless() statt step(). state(): y, yu, P, I, D, e, s (2P/3P), windup = |yu - y|, u0Track, hasI, note.
 *    Ungueltige Werte: controller() liefert {ok:false, why}; setParams() behaelt den letzten gueltigen Wert (kept:true).
 *  loop(cfg) {step(), run(tEnd), setW, setZ, setMode, trace, state(), reset()} nur als Hilfe (Reihenfolge 4.5).
 *  Frequenzbereich (M2): freq.loopBlocks(plantBlocks, ctrl) -> Blockliste (Array) oder {ok:false}; margins(blocks|loopBlocksErgebnis),
 *    bode, nyquist, ultimate(plantBlocks), charPoly(plantBlocks, ctrl) -> {coef (hoechste Potenz zuerst)}, routh(coef).
 *    Reglerbloecke in Listen: PI{Kp,Tn}, PD{Kp,Tv,Tf}, PID{Kp,Tn,Tv,Tf}. ctrl.Ta (>0) haengt das Halteglied Ta/2 an (ctrl.hold:false = aus).
 *  Kenngroessen (M2): stepMetrics(t,x,{w0,w1,t0,tol,range}), disturbMetrics(t,x,{w,tz,band,range,unit}), oscillation(t,x,{range,y,ymin,ymax}),
 *    steadyState(info{Ks,q,yn?,stable?}, ctrl, {w,z,u0,off,ymin,ymax,limits}); z als aequivalente Stellgroesse in %.
 *  Identifikation (M3): stepResponse, fitStep(t,x,dy,{t0}), identify(blocks) -> {Ks|Kis, art, Tu, Tg, Tsum, TsumKlein, T1, T2, Kkrit, Tkrit, ...},
 *    findCritical(rigFactory, {op:{y}, step, kp0, controls}) braucht am Rig: setControl, stepProcess, state, setOperatingPoint, steady,
 *    (optional linBlocks, identify, range, h). Steuerwerte: mode, ctrl, tv, noise, u0, w, kp.
 *  Regeln/Formeln (M3): rules.table (Faktoren: {k, of, label?, alt?}), rules.apply(method, kennwerte, type), rules.validity, rules.expr(cell);
 *    formulas.<id> {id,name,symbol,expr,unit,fn,explain(...)->{ok,value,steps}}, formulas.list(); scale.*, twoPoint.period.
 *  exercise(kind, seed) -> {question, given, answer{value,unit,tol,alt}, steps, check(input)->{ok,text}}; exercise.kinds.
 *  diagnose(ctx) -> [{id,kind,text,fx?}]. ctx-Felder (alle optional, fehlende Felder erzeugen nie eine Meldung):
 *    ctrl, mode, dir, requiredDir, y, ymax, tHold, satHighFor, satLowFor, aw, windup, windupFor, osc{cls,period}, settled, e, ePct, unit, q,
 *    tv, noise, sigmaY, Tt, Tdom, blocks (linBlocks), kp, tn, ta, N, tUnit, friction, backlash, period, Ts, swing, hyst, Pben, Pmax, lockoutLeft.
 *    Zeiten (satHighFor, windupFor, period, ta, lockoutLeft) in Prozess-Sekunden; tUnit steuert die Textausgabe.
 *  TEXTS.diag/TEXTS.rig/TEXTS.kern: einzige Quelle der Kernmeldungen; TEXTS.get(id, vars).
 *  runSeq(rigFactory|rigId|rig, seq, tEndS, opts) -> {ok, samples, final, events, faults, metrics{step?}, errors, rejected}.
 *    Achtung: opts.op {y} ruft setOperatingPoint und stellt damit auf HAND; ein controls:{mode:"auto"} wird davon überschrieben. Für Automatik immer {t:0, set:{mode:"auto"}} an den Anfang der Sequenz setzen.
 *    Rig-Anforderung: setControl (false = abgelehnt), state(), stepProcess(dtS) (sonst step(dtMs)), optional getControl, readMeters, controls (Schluessel), range, h, setOperatingPoint, events.
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const TWO_PI = 2 * Math.PI;
  const LN10 = Math.LN10;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v); return isFinite(x) ? x : d; }
    return d;
  }
  function pos(v, d) { const x = num(v, NaN); return x > 0 ? x : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isArr(a) { return Array.isArray(a); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function dbl(v) { return Number(v); }
  /* guard: Rechenfunktion -> NaN, Strukturfunktion -> { ok:false, why } */
  function C(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail('Interner Fehler bei ungültiger Eingabe.'); } }; }
  function swallow(fn, bad) { try { return fn(); } catch (e) { return bad; } }
  function log10(x) { return Math.log(x) / LN10; }
  function sign(x) { return x > 0 ? 1 : (x < 0 ? -1 : 0); }

  /* ---------- Texte (einzige Quelle fuer Kernmeldungen) ---------- */
  const TXT = {
    tPos: 'T muss größer 0 sein',
    hPos: 'h muss größer 0 sein',
    ttNeg: 'Tt darf nicht negativ sein',
    ttZuGross: 'Die Totzeit ist im Verhältnis zum Rechenschritt zu groß.',
    keineZahl: 'Das ist keine Zahl. Schreibe zum Beispiel 2,5.',
    kpNeg: 'Kp darf nicht kleiner 0 sein',
    tnPos: 'Tn muss größer 0 sein',
    tvNeg: 'Tv darf nicht kleiner 0 sein',
    taPos: 'Ta muss größer 0 sein',
    nMin: 'N muss mindestens 1 sein',
    yGrenzen: 'ymin muss kleiner als ymax sein',
    hystNeg: 'Die Schaltdifferenz darf nicht negativ sein',
    deadNeg: 'Die halbe Totzonenbreite darf nicht negativ sein',
    artUnbekannt: 'Diese Reglerart gibt es nicht (erlaubt: P, I, PI, PD, PID, 2P, 3P).',
    zweipunktSofort: 'Zweipunktregler: Stellgröße schaltet sofort',
    reglerartAnlage: 'Diese Reglerart gibt es an dieser Anlage nicht.',
    instabil: 'Der Regelkreis ist instabil',
    sprungNull: 'Der Sollwertsprung ist 0: Kenngrößen sind nicht definiert.',
    zuKurz: 'Die Aufzeichnung ist zu kurz: Es fehlen Messwerte nach dem Sprung.',
    nichtEingeschwungen: 'Die Regelgröße ist am Ende noch nicht eingeschwungen: Bleibende Abweichung und Ausregelzeit sind nur vorläufig.',
    schaltregler: 'Für Schaltregler gibt es keinen Frequenzgang (nichtlinear).',
    schaltreglerKurz: 'Für Schaltregler gibt es keinen Frequenzgang.',
    keinDurchtritt: 'Kreisverstärkung kleiner 1: kein Durchtritt, der Kreis ist stabil.',
    unendlichAR: 'Die Phase erreicht −180° nicht: unendliche Amplitudenreserve.',
    mehrfachDurchtritt: 'Mehrere Durchtrittsfrequenzen (oder instabiler offener Kreis): das vereinfachte Kriterium gilt hier nicht; prüfe die Ortskurve.',
    negativeKreisverst: 'Die Kreisverstärkung ist negativ: Der Wirkungssinn des Reglers passt nicht zur Strecke (aus der Gegenkopplung wird eine Mitkopplung).',
    keineUltimate: 'Diese Strecke schwingt mit einem P-Regler nie (Phase erreicht −180° nicht); der Schwingversuch ist nicht möglich.',
    routhSonder: 'Sonderfall: 0 in der ersten Spalte – der Kreis liegt an der Stabilitätsgrenze oder ist instabil.',
    steadyNur: 'Nur für stabile, unbegrenzte lineare Kreise.',
    zwei_int: 'Zwei Integratoren im Kreis: Prüfe die Stabilität, ohne D-Anteil neigt der Kreis zum Schwingen.',
    tuKlein: 'Die Verzugszeit ist praktisch 0: Regeln, die durch Tu teilen, geben dann sehr große Verstärkungen. Nimm die T-Summen-Regel oder begrenze Kp.',
    schwingt: 'Die Antwort schwingt: Das Wendetangentenverfahren gilt nur für aperiodische Strecken.',
    tsumArm: 'Die kleinen Zeitkonstanten sind fast 0: Das Betragsoptimum liefert dann eine unrealistisch große Verstärkung. Begrenze Kp auf 100.',
    tsumNurP: 'T-Summe nur für Strecken mit Ausgleich.',
    iKeinTg: 'Für Strecken ohne Ausgleich gibt es kein Tg: Diese Methode hat hier keine Nachstellzeit. Nimm Ziegler-Nichols (Sprungantwort) oder die Störungs-Variante.',
    heizArm: 'Die Heizleistung reicht nicht, um die obere Schaltschwelle zu erreichen: Der Regler schaltet nie ab.',
    kuehlArm: 'Die Kühlleistung reicht nicht, um die untere Schaltschwelle zu erreichen: Der Regler schaltet nie ab.',
    abkuehlNie: 'Die Abkühlung erreicht die untere Schaltschwelle nie: Der Regler schaltet nie ein.',
    erwaermNie: 'Die Erwärmung erreicht die obere Schaltschwelle nie: Der Regler schaltet nie ein.',
    drahtbruch: 'Unter 3,6 mA: Drahtbruch oder Messumformer ausgefallen (Live-Zero).',
    uebersteuerung: 'Übersteuerung: Messwert über 100 %',
    untersteuerung: 'Untersteuerung: Messwert unter 0 %',
    ueberlaufRoh: 'Rohwert über 32511: außerhalb des Übersteuerungsbereichs, der Messwert ist ungültig.'
  };

  /* ---------- Zahlen: Ausgabe und Eingabe ---------- */
  /* fmt(x, digits): Dezimalkomma. Ohne digits: bis zu 4 gueltige Stellen, ueberfluessige Nullen entfallen.
   * Mit digits (0..10): feste Nachkommastellen. Nicht endlich: '–'. */
  function fmt(x, digits) {
    x = num(x, NaN);
    if (!isFinite(x)) return '–';
    let s;
    const dg = digits === undefined || digits === null ? NaN : Number(digits);
    if (isFinite(dg)) s = x.toFixed(clamp(Math.round(dg), 0, 10));
    else if (x === 0) s = '0';
    else {
      const a = Math.abs(x);
      if (a >= 1e4) s = Math.abs(x) < 1e15 ? String(Math.round(x)) : x.toExponential(3);
      else if (a >= 1e-4) s = String(Number(x.toPrecision(4)));
      else s = x.toExponential(2);
    }
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('.', ',');
  }
  /* fmtTime(sec, unit): Zeit mit Einheit; unit 's' | 'min' | 'h' | 'auto' */
  function fmtTime(sec, unit) {
    sec = num(sec, NaN);
    if (!isFinite(sec)) return '–';
    let u = unit;
    if (u !== 's' && u !== 'min' && u !== 'h') u = Math.abs(sec) < 120 ? 's' : (Math.abs(sec) < 7200 ? 'min' : 'h');
    if (u === 'min') return fmt(sec / 60) + ' min';
    if (u === 'h') return fmt(sec / 3600) + ' h';
    return fmt(sec) + ' s';
  }
  /* parseNum(str): Komma/Punkt, Leerzeichen als Tausendertrennung, Einheitenzusatz toleriert. Zahl oder NaN.
   * Mehrdeutig: "1.234" ist 1,234 (ein einzelnes Trennzeichen gilt als Dezimaltrenner); "1.234.567" und "1 234" sind Tausender. */
  function parseNum(str) {
    if (typeof str === 'number') return isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    let s = str.replace(/−/g, '-').replace(/[   ]/g, ' ').trim();
    const m = s.match(/^[+-]?\s?(?:[0-9][0-9 .,]*|[.,][0-9]+)/);
    if (!m) return NaN;
    let body = m[0].replace(/\s+$/, '').replace(/[.,]+$/, '');
    let rest = s.slice(m[0].length);
    if (!body) return NaN;
    let sgn = 1;
    if (body[0] === '-' || body[0] === '+') { if (body[0] === '-') sgn = -1; body = body.slice(1).trim(); }
    if (/ /.test(body)) {
      if (!/^\d{1,3}( \d{3})+([.,]\d+)?$/.test(body)) return NaN;
      body = body.replace(/ /g, '');
    }
    const nC = (body.match(/,/g) || []).length, nP = (body.match(/\./g) || []).length;
    if (nC && nP) {
      const dec = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
      const th = dec === ',' ? '.' : ',';
      const parts = body.split(dec);
      if (parts.length !== 2) return NaN;
      if (parts[0].indexOf(th) >= 0 && !new RegExp('^\\d{1,3}(?:\\' + th + '\\d{3})+$').test(parts[0])) return NaN;
      body = parts[0].split(th).join('') + '.' + parts[1];
    } else if (nC > 1 || nP > 1) {
      const sep = nC > 1 ? ',' : '.';
      if (!new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$').test(body)) return NaN;
      body = body.split(sep).join('');
    } else if (nC === 1) body = body.replace(',', '.');
    if (!/^\d*\.?\d+$|^\d+\.?$/.test(body)) return NaN;
    let v = Number(body);
    const ex = rest.match(/^[eE]([+-]?\d+)/);
    if (ex) v = v * Math.pow(10, Number(ex[1]));
    v = sgn * v;
    return isFinite(v) ? v : NaN;
  }

  /* ---------- Zufall ---------- */
  function rng(seed) {
    let a = Math.floor(num(seed, 1) * 1) | 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function normal() {
      const u1 = 1 - next(), u2 = next();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(TWO_PI * u2);
    }
    return { next: next, normal: normal };
  }

  /* ---------- Normierung ---------- */
  const norm = {
    toPct: C(function (v, lo, hi) { v = num(v, NaN); lo = num(lo, NaN); hi = num(hi, NaN); return hi === lo ? NaN : 100 * (v - lo) / (hi - lo); }),
    fromPct: C(function (p, lo, hi) { p = num(p, NaN); lo = num(lo, NaN); hi = num(hi, NaN); return hi === lo ? NaN : lo + p / 100 * (hi - lo); })
  };

  /* ---------- Glossar (einzige Quelle fuer Begriffe, Symbole, Einheiten, Erklaertexte) ---------- */
  const GL = [
    ['w', 'w', 'Führungsgröße', 'die', 'Sollwert', '%', 'Die Führungsgröße w (der Sollwert) ist der Wert, auf den der Regler die Regelgröße bringen soll.'],
    ['x', 'x', 'Regelgröße', 'die', 'Istwert', '%', 'Die Regelgröße x (der Istwert) ist die Größe, die geregelt wird, zum Beispiel der Füllstand oder die Temperatur.'],
    ['xm', 'xm', 'Messwert', 'der', '', '%', 'Der Messwert xm kommt aus dem Messglied und enthält dessen Verzögerung und das Messrauschen.'],
    ['e', 'e', 'Regeldifferenz', 'die', 'Regelabweichung', '%', 'Die Regeldifferenz e = w − x ist der Unterschied zwischen Sollwert und Istwert. Bei inversem Wirkungssinn dreht sich das Vorzeichen um.'],
    ['y', 'y', 'Stellgröße', 'die', '', '%', 'Die Stellgröße y ist das Ausgangssignal des Reglers. Sie steuert das Stellglied (0 bis 100 %).'],
    ['z', 'z', 'Störgröße', 'die', '', 'Anlagenwert', 'Die Störgröße z wirkt von außen auf die Regelstrecke, zum Beispiel eine Entnahme, eine Last oder ein offenes Fenster. Sie ist nicht vom Regler einstellbar.'],
    ['ebl', 'e_bl', 'bleibende Regelabweichung', 'die', '', '%', 'Die bleibende Regelabweichung ist der Rest von e, der nach dem Einschwingen übrig bleibt.'],
    ['strecke', '', 'Regelstrecke', 'die', 'Strecke', '', 'Die Regelstrecke ist der Teil der Anlage, in dem die Regelgröße entsteht und auf die Stellgröße und die Störgröße reagiert.'],
    ['regler', '', 'Regler', 'der', '', '', 'Der Regler vergleicht Sollwert und Istwert und berechnet daraus die Stellgröße.'],
    ['stellglied', '', 'Stellglied', 'das', '', '', 'Das Stellglied (Pumpe, Ventil, Heizung, Steller) setzt die Stellgröße in eine physikalische Wirkung auf die Strecke um.'],
    ['messglied', '', 'Messglied', 'das', 'Sensor', '', 'Das Messglied (Sensor mit Messumformer) erfasst die Regelgröße und führt sie als Messwert zum Regler zurück.'],
    ['wirkungsplan', '', 'Wirkungsplan', 'der', '', '', 'Der Wirkungsplan zeigt als Blockschaltbild, wie w, e, y, z und x im geschlossenen Kreis wirken.'],
    ['ks', 'Ks', 'Streckenverstärkung', 'die', '', '%/%', 'Die Streckenverstärkung Ks = Δx/Δy ist das Verhältnis aus Änderung der Regelgröße und Änderung der Stellgröße im Beharrungszustand.'],
    ['kis', 'Kis', 'Integrierbeiwert', 'der', '', '1/s', 'Der Integrierbeiwert Kis der I-Strecke gibt an, wie schnell die Regelgröße je Prozent Stellgröße wächst.'],
    ['t', 'T', 'Zeitkonstante', 'die', '', 's', 'Die Zeitkonstante T beschreibt, wie träge ein Speicher (PT1-Glied) reagiert. Nach T erreicht die Sprungantwort ' + fmt(100 * (1 - Math.exp(-1)), 1) + ' % des Endwerts.'],
    ['tt', 'Tt', 'Totzeit', 'die', '', 's', 'Die Totzeit Tt ist die Zeit, um die ein Signal unverändert verspätet ankommt, zum Beispiel durch Rohrlänge oder Bus.'],
    ['tu', 'Tu', 'Verzugszeit', 'die', '', 's', 'Die Verzugszeit Tu ist der Abschnitt von der Sprungzeit bis zum Schnittpunkt der Wendetangente mit dem Anfangswert.'],
    ['tg', 'Tg', 'Ausgleichszeit', 'die', '', 's', 'Die Ausgleichszeit Tg ist der Zeitabschnitt der Wendetangente zwischen Anfangswert und Endwert.'],
    ['regelbarkeit', 'Tg/Tu', 'Regelbarkeit', 'die', '', '', 'Die Regelbarkeit Tg/Tu sagt, wie gut sich die Strecke regeln lässt: Je größer, desto leichter.'],
    ['kp', 'Kp', 'Proportionalbeiwert', 'der', 'Reglerverstärkung', '', 'Der Proportionalbeiwert Kp (die Reglerverstärkung) gibt an, wie stark die Stellgröße auf die Regeldifferenz reagiert.'],
    ['xp', 'Xp', 'Proportionalbereich', 'der', '', '%', 'Der Proportionalbereich Xp = 100 %/Kp ist die Regeldifferenz, bei der die Stellgröße den ganzen Stellbereich durchläuft.'],
    ['tn', 'Tn', 'Nachstellzeit', 'die', '', 's', 'Die Nachstellzeit Tn gibt an, nach welcher Zeit der I-Anteil bei konstanter Regeldifferenz genauso groß ist wie der P-Anteil. Kleines Tn bedeutet starker I-Anteil.'],
    ['tv', 'Tv', 'Vorhaltzeit', 'die', '', 's', 'Die Vorhaltzeit Tv bestimmt die Stärke des D-Anteils: Er reagiert auf die Änderungsgeschwindigkeit und dämpft den Kreis.'],
    ['ta', 'Ta', 'Abtastzeit', 'die', '', 's', 'Die Abtastzeit Ta ist der Takt, in dem ein digitaler Regler rechnet. Dazwischen hält er die Stellgröße konstant.'],
    ['v0', 'V0', 'Kreisverstärkung', 'die', '', '', 'Die Kreisverstärkung V0 = Kp·Ks ist das Produkt der Proportionalbeiwerte im aufgeschnittenen Regelkreis.'],
    ['phir', 'φR', 'Phasenreserve', 'die', '', '°', 'Die Phasenreserve φR ist der Abstand der Phase des offenen Kreises bei der Durchtrittsfrequenz (Betrag 1) von −180°. Sind φR und AR positiv, ist der Kreis nach dem vereinfachten Nyquist-Kriterium stabil.'],
    ['ar', 'AR', 'Amplitudenreserve', 'die', '', 'dB', 'Die Amplitudenreserve AR gibt an, um wie viel dB die Kreisverstärkung noch wachsen darf, bis der Kreis bei −180° Phase die Stabilitätsgrenze erreicht.'],
    ['kkrit', 'Kkrit', 'kritische Verstärkung', 'die', '', '', 'Die kritische Verstärkung Kkrit ist der Wert von Kp, bei dem der P-Regelkreis gerade noch dauernd schwingt.'],
    ['tkrit', 'Tkrit', 'kritische Periodendauer', 'die', '', 's', 'Die kritische Periodendauer Tkrit ist die Periodendauer der Dauerschwingung bei Kkrit.'],
    ['tsum', 'TΣ', 'Summenzeitkonstante', 'die', '', 's', 'Die Summenzeitkonstante TΣ ist die Summe aller Zeitkonstanten und der Totzeit der Strecke.'],
    ['anregelzeit', 'tAn', 'Anregelzeit', 'die', '', 's', 'Die Anregelzeit ist die Zeit vom Sollwertsprung, bis die Regelgröße zum ersten Mal im Toleranzband um den neuen Sollwert liegt.'],
    ['ausregelzeit', 'tAus', 'Ausregelzeit', 'die', '', 's', 'Die Ausregelzeit ist die Zeit vom Sprung, nach der die Regelgröße dauerhaft im Toleranzband bleibt.'],
    ['ueberschwing', 'ü', 'Überschwingweite', 'die', '', '%', 'Die Überschwingweite ist der größte Wert über dem neuen Sollwert, bezogen auf den Sollwertsprung.'],
    ['fuehrung', '', 'Führungsverhalten', 'das', '', '', 'Das Führungsverhalten beschreibt, wie die Regelgröße einem Sollwertsprung folgt.'],
    ['stoer', '', 'Störverhalten', 'das', '', '', 'Das Störverhalten beschreibt, wie der Regelkreis einen Störgrößensprung ausregelt.'],
    ['dauer', '', 'Dauerschwingung', 'die', '', '', 'Bei einer Dauerschwingung bleibt die Amplitude gleich: Der Kreis liegt an der Stabilitätsgrenze.'],
    ['windup', '', 'Windup', 'das', '', '', 'Windup nennt man das Weglaufen des I-Anteils, solange das Stellglied am Anschlag steht. Anti-Windup verhindert das.'],
    ['wirkungssinn', '', 'Wirkungssinn', 'der', '', '', 'Der Wirkungssinn legt fest, ob die Stellgröße bei positiver Regeldifferenz steigt (direkt) oder fällt (invers).'],
    ['schaltdifferenz', 'Δ', 'Schaltdifferenz', 'die', 'Hysterese', '%', 'Die Schaltdifferenz Δ ist der Abstand zwischen Einschalt- und Ausschaltschwelle eines Zweipunktreglers.'],
    ['rueckfuehrung', '', 'Rückführung', 'die', '', '', 'Die Rückführung bringt den Messwert zum Regler zurück und schließt so den Wirkungskreis.']
  ];
  const glossary = { items: [], byId: {} };
  GL.forEach(function (g) {
    const o = { id: g[0], symbol: g[1], term: g[2], article: g[3], alt: g[4], unit: g[5], text: g[6] };
    glossary.items.push(o); glossary.byId[o.id] = o;
  });
  glossary.get = function (id) { return Object.prototype.hasOwnProperty.call(glossary.byId, id) ? glossary.byId[id] : null; };
  /* Verbotene Schreibweisen (Regel 6): Suchmuster (RegExp-Quelltext), Kennzeichen, Ersatz */
  glossary.forbidden = [
    { pattern: 'Sollgr(ö|oe)ße', flags: 'i', use: 'Sollwert' },
    { pattern: 'Istgr(ö|oe)ße', flags: 'i', use: 'Istwert' },
    { pattern: 'R(ü|ue)ckkopplung', flags: 'i', use: 'Rückführung' },
    { pattern: '\\bSie (m(ü|ue)ssen|k(ö|oe)nnen|sollen|stellen|messen|lesen)\\b', flags: '', use: 'Du-Anrede' },
    { pattern: '\\b[Mm]esse\\b', flags: '', use: 'miss' },
    { pattern: '\\bLies\\b(?! ab)', flags: '', use: 'lies ab' },
    { pattern: 'Regelgr(ö|oe)ße Stellgr(ö|oe)ße', flags: '', use: 'ein Begriff je Größe' }
  ];

  /* =====================================================================================================
   *  BAUSTEINE (M1)
   * ===================================================================================================== */
  function dead(why, methods) {
    const o = { ok: false, why: why, step: function () { return NaN; }, reset: function () {}, value: function () { return NaN; } };
    if (methods) for (const k in methods) o[k] = methods[k];
    return o;
  }

  /* lag(T, h): exakter PT1-Schritt  y += (1 - exp(-h/T)) * (u - y). T <= 0 oder nicht endlich: P-Glied (y = u) mit Meldung. */
  function lag(T, h) {
    h = num(h, NaN);
    if (!(h > 0)) return dead(TXT.hPos);
    const Tn = num(T, NaN), valid = Tn > 0;
    const alpha = valid ? -Math.expm1(-h / Tn) : 1;
    const alphaHalf = valid ? -Math.expm1(-h / (2 * Tn)) : 1;
    let y = 0;
    const o = {
      ok: true, msg: valid ? '' : TXT.tPos, T: valid ? Tn : NaN, h: h, alpha: alpha,
      step: function (u) { u = num(u, NaN); if (!isFinite(u)) return NaN; y += alpha * (u - y); return y; },
      stepMid: function (u) { u = num(u, NaN); if (!isFinite(u)) return NaN; const y0 = y; y += alpha * (u - y); return y0 + alphaHalf * (u - y0); },
      reset: function (y0) { y = num(y0, 0); },
      value: function () { return y; }
    };
    return o;
  }

  /* delay(Tt, h): Totzeitglied, Ringpuffer N = round(Tt/h); N = 0: keine Verzoegerung */
  function delay(Tt, h) {
    h = num(h, NaN);
    if (!(h > 0)) return dead(TXT.hPos);
    Tt = num(Tt, NaN);
    if (!(Tt >= 0)) return dead(TXT.ttNeg);
    const N = Math.round(Tt / h);
    if (N > 2000000) return dead(TXT.ttZuGross);
    const buf = new Float64Array(N);
    let idx = 0, last = 0;
    return {
      ok: true, N: N, Tt: N * h, h: h,
      step: function (u) {
        u = num(u, NaN); if (!isFinite(u)) return NaN;
        if (N === 0) { last = u; return u; }
        const out = buf[idx]; buf[idx] = u; idx = (idx + 1) % N; last = out; return out;
      },
      reset: function (y0) { const v = num(y0, 0); buf.fill(v); idx = 0; last = v; },
      value: function () { return last; }
    };
  }

  /* rk4(f, x, u, h): klassischer RK4-Schritt. x Zahl oder Vektor, f(x, u) liefert die Ableitung (gleiche Form) */
  function rk4(f, x, u, h) {
    h = num(h, NaN);
    const vec = isArr(x);
    const bad = vec ? x.map(function () { return NaN; }) : NaN;
    if (typeof f !== 'function' || !isFinite(h)) return bad;
    const X = vec ? x.map(dbl) : [num(x, NaN)];
    if (X.some(function (v) { return !isFinite(v); })) return bad;
    function call(s) {
      const r = f(vec ? s.slice() : s[0], u);
      return vec ? (isArr(r) ? r.map(dbl) : null) : [dbl(r)];
    }
    function add(a, b, k) { const o = new Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] + k * b[i]; return o; }
    const k1 = call(X); if (!k1 || k1.length !== X.length) return bad;
    const k2 = call(add(X, k1, h / 2)), k3 = call(add(X, k2, h / 2)), k4 = call(add(X, k3, h));
    if (!k2 || !k3 || !k4) return bad;
    const out = new Array(X.length);
    for (let i = 0; i < X.length; i++) out[i] = X[i] + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    return vec ? out : out[0];
  }

  /* rateLimit(rate): Stellgeschwindigkeitsbegrenzung in %/s. rate <= 0 oder nicht endlich: keine Begrenzung */
  function rateLimit(rate) {
    rate = num(rate, NaN);
    const active = rate > 0;
    let y = 0;
    return {
      ok: true, active: active, rate: active ? rate : NaN,
      step: function (u, h) {
        u = num(u, NaN); h = num(h, NaN);
        if (!isFinite(u)) return NaN;
        if (!active || !(h > 0)) { y = u; return y; }
        y += clamp(u - y, -rate * h, rate * h); return y;
      },
      reset: function (y0) { y = num(y0, 0); },
      value: function () { return y; }
    };
  }

  /* deadband(db): Totzone/Haftreibung. u_eff = 0 wenn |u - mitte| <= db, sonst u - sign(u - mitte)*db */
  function deadband(db) {
    db = num(db, NaN);
    if (!(db >= 0)) return dead('Die Totzone darf nicht negativ sein.');
    return {
      ok: true, db: db,
      step: function (u, mid) {
        u = num(u, NaN); mid = num(mid, 0);
        if (!isFinite(u)) return NaN;
        const d = u - mid;
        return Math.abs(d) <= db ? 0 : d - sign(d) * db;
      }
    };
  }

  /* backlash(width): Lose, Standardmodell. xi Antrieb, xo Abtrieb */
  function backlash(width) {
    width = num(width, NaN);
    if (!(width >= 0)) return dead('Die Lose darf nicht negativ sein.');
    let xo = 0;
    return {
      ok: true, b: width,
      step: function (xi) {
        xi = num(xi, NaN); if (!isFinite(xi)) return NaN;
        if (xi - xo > width / 2) xo = xi - width / 2;
        else if (xi - xo < -width / 2) xo = xi + width / 2;
        return xo;
      },
      reset: function (x0) { xo = num(x0, 0); },
      value: function () { return xo; }
    };
  }

  /* valveChar(y, kind, R): Kennlinie phi(y) 0..1; kind 'linear' | 'gleichprozentig' (R = 30, vereinfacht, A16) */
  function valveChar(y, kind, R) {
    y = num(y, NaN); if (!isFinite(y)) return NaN;
    const p = clamp(y, 0, 100) / 100;
    if (kind === 'linear') return p;
    if (kind === 'gleichprozentig') {
      const r = R === undefined || R === null ? 30 : num(R, NaN);
      if (!(r > 1)) return NaN;
      return (Math.pow(r, p) - 1) / (r - 1);
    }
    return NaN;
  }
  /* valveSlope(y, kind, R): Steigung dphi/dy in 1/% (fuer Ks(y)) */
  function valveSlope(y, kind, R) {
    y = num(y, NaN); if (!isFinite(y)) return NaN;
    const p = clamp(y, 0, 100) / 100;
    if (kind === 'linear') return 1 / 100;
    if (kind === 'gleichprozentig') {
      const r = R === undefined || R === null ? 30 : num(R, NaN);
      if (!(r > 1)) return NaN;
      return Math.log(r) / 100 * Math.pow(r, p) / (r - 1);
    }
    return NaN;
  }

  /* sensor({ T, noise, seed }): Messglied = PT1 + normalverteiltes Rauschen (sigma in % des Bereichs) */
  function sensor(spec) {
    spec = spec && typeof spec === 'object' ? spec : {};
    const T = num(spec.T, 0);
    let sigma = Math.max(0, num(spec.noise, 0));
    const R = rng(num(spec.seed, 1));
    let y = 0;
    const valid = T > 0;
    return {
      ok: true, msg: valid || T === 0 ? '' : TXT.tPos, T: valid ? T : 0,
      step: function (x, h) {
        x = num(x, NaN); h = num(h, NaN);
        if (!isFinite(x) || !(h > 0)) return NaN;
        if (valid) y += -Math.expm1(-h / T) * (x - y); else y = x;
        return sigma > 0 ? y + sigma * R.normal() : y;
      },
      reset: function (x0) { y = num(x0, 0); },
      value: function () { return y; },
      setNoise: function (s) { sigma = Math.max(0, num(s, 0)); },
      get sigma() { return sigma; }
    };
  }

  /* =====================================================================================================
   *  STRECKE (M1)
   * ===================================================================================================== */
  function normBlocks(blocks) {
    const out = [];
    if (!isArr(blocks)) return null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b || typeof b !== 'object') return null;
      if (b.t === 'K') { const K = num(b.K, NaN); if (!isFinite(K)) return null; out.push({ t: 'K', K: K }); }
      else if (b.t === 'PT1') { out.push({ t: 'PT1', T: num(b.T, NaN) }); }
      else if (b.t === 'PT2') {
        if (b.T1 !== undefined && b.w0 === undefined) { out.push({ t: 'PT1', T: num(b.T1, NaN) }); out.push({ t: 'PT1', T: num(b.T2, NaN) }); }
        else { const w0 = num(b.w0, NaN), D = num(b.D, NaN); if (!(w0 > 0) || !isFinite(D)) return null; out.push({ t: 'PT2', w0: w0, D: clamp(D, 0.05, 2) }); }
      }
      else if (b.t === 'I') { const Ki = num(b.Ki, NaN); if (!isFinite(Ki)) return null; out.push({ t: 'I', Ki: Ki }); }
      else if (b.t === 'Tt') { const Tt = num(b.Tt, NaN); if (!(Tt >= 0)) return null; out.push({ t: 'Tt', Tt: Tt }); }
      else return null;
    }
    return out;
  }

  /* Ein Baustein der Kette. step(uMid, uEnd) setzt oMid (Wert in der Schrittmitte) und oEnd (Wert am Schrittende). */
  function makeBlock(b, h) {
    const o = { oMid: 0, oEnd: 0, b: b };
    if (b.t === 'K') {
      o.step = function (um, ue) { o.oMid = b.K * um; o.oEnd = b.K * ue; };
      o.reset = function () {}; o.setSteady = function (v) { return b.K * v; };
      o.state = function () { return null; };
      o.out = function () { return 0; };
    } else if (b.t === 'PT1') {
      const valid = b.T > 0;
      const al = valid ? -Math.expm1(-h / b.T) : 1, ah = valid ? -Math.expm1(-h / (2 * b.T)) : 1;
      let s = 0;
      o.step = function (um) { const s0 = s; s += al * (um - s); o.oMid = s0 + ah * (um - s0); o.oEnd = s; };
      o.reset = function (v) { s = v; }; o.setSteady = function (v) { s = v; return v; };
      o.state = function () { return s; }; o.out = function () { return s; };
    } else if (b.t === 'PT2') {
      const w0 = b.w0, D = b.D;
      let ns = Math.max(2, 2 * Math.ceil(h * w0 / 0.2));
      if (ns > 4000) ns = 4000;
      const dt = h / ns;
      let x = 0, v = 0;
      const f = function (s, u) { return [s[1], w0 * w0 * (u - s[0]) - 2 * D * w0 * s[1]]; };
      o.step = function (um) {
        const x0 = x; let st = [x, v], xm = x;
        for (let i = 0; i < ns; i++) {
          const k1 = f(st, um), s2 = [st[0] + dt / 2 * k1[0], st[1] + dt / 2 * k1[1]];
          const k2 = f(s2, um), s3 = [st[0] + dt / 2 * k2[0], st[1] + dt / 2 * k2[1]];
          const k3 = f(s3, um), s4 = [st[0] + dt * k3[0], st[1] + dt * k3[1]];
          const k4 = f(s4, um);
          st = [st[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), st[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
          if (i === ns / 2 - 1) xm = st[0];
        }
        x = st[0]; v = st[1]; o.oMid = xm; o.oEnd = x; void x0;
      };
      o.reset = function (val) { x = val; v = 0; }; o.setSteady = function (val) { x = val; v = 0; return val; };
      o.state = function () { return [x, v]; }; o.out = function () { return x; };
    } else if (b.t === 'I') {
      let s = 0, lo = -Infinity, hi = Infinity;
      o.setLimit = function (a, c) { lo = a; hi = c; };
      o.step = function (um) { const s0 = s; s = clamp(s + b.Ki * h * um, lo, hi); o.oMid = clamp(s0 + b.Ki * h / 2 * um, lo, hi); o.oEnd = s; };
      o.reset = function (v) { s = clamp(v, lo, hi); };
      o.setSteady = function (v, hold) { if (isFinite(hold)) s = clamp(hold, lo, hi); return s; };
      o.state = function () { return s; }; o.out = function () { return s; };
      o.isI = true;
    } else {
      const N = Math.round(b.Tt / h);
      const buf = new Float64Array(N); let idx = 0;
      o.step = function (um, ue) {
        if (N === 0) { o.oMid = um; o.oEnd = ue; return; }
        const out = buf[idx]; buf[idx] = um; idx = (idx + 1) % N; o.oMid = out; o.oEnd = out;
      };
      o.reset = function (v) { buf.fill(v); idx = 0; }; o.setSteady = function (v) { buf.fill(v); idx = 0; return v; };
      o.state = function () { return Array.prototype.slice.call(buf); }; o.out = function () { return N === 0 ? 0 : buf[idx]; };
    }
    return o;
  }

  /* plant(spec, h): Blockkette Eingang -> Ausgang um den Arbeitspunkt  x = op.x + G*(y - op.y) (+ Stoerung) */
  function plant(spec, h) {
    h = num(h, NaN);
    if (!(h > 0)) return fail(TXT.hPos);
    if (!spec || typeof spec !== 'object') return fail('Die Streckenbeschreibung fehlt.');
    const blocks = normBlocks(spec.blocks);
    if (!blocks) return fail('Die Blockliste der Strecke ist ungültig (erlaubt: K, PT1, PT2, I, Tt mit endlichen Werten).');
    for (let i = 0; i < blocks.length; i++) if (blocks[i].t === 'Tt' && Math.round(blocks[i].Tt / h) > 2000000) return fail(TXT.ttZuGross);
    const op = { y: num(spec.op && spec.op.y, 0), x: num(spec.op && spec.op.x, 0) };
    const zIn = num(spec.zIn, 1) , zOut = num(spec.zOut, 0);
    const xmin = num(spec.xmin, -500), xmax = num(spec.xmax, 500);
    const limit = isArr(spec.limit) && spec.limit.length === 2 ? [num(spec.limit[0], NaN), num(spec.limit[1], NaN)] : null;
    const msgs = [];
    const bs = blocks.map(function (b) { if (b.t === 'PT1' && !(b.T > 0)) msgs.push(TXT.tPos); return makeBlock(b, h); });
    // Verstaerkung hinter Block i (Produkt der K-Glieder dahinter)
    function gainAfter(i) { let g = 1; for (let j = i + 1; j < blocks.length; j++) if (blocks[j].t === 'K') g *= blocks[j].K; return g; }
    // Integrator-Grenze (absolut in x): auf den letzten I-Baustein anwenden
    if (limit && isFinite(limit[0]) && isFinite(limit[1])) {
      for (let i = blocks.length - 1; i >= 0; i--) if (bs[i].isI) {
        const g = gainAfter(i);
        if (g > 0) bs[i].setLimit((limit[0] - op.x) / g, (limit[1] - op.x) / g);
        else if (g < 0) bs[i].setLimit((limit[1] - op.x) / g, (limit[0] - op.x) / g);
        break;
      }
    }
    let x = clamp(num(spec.x0, op.x), xmin, xmax), t = 0;
    function resetTo(x0) {
      const d0 = num(x0, op.x) - op.x;
      for (let i = 0; i < bs.length; i++) { const g = gainAfter(i); bs[i].reset(g !== 0 ? d0 / g : 0); }
      x = clamp(op.x + d0, xmin, xmax); t = 0;
    }
    resetTo(x);
    let Ks = 1; blocks.forEach(function (b) { if (b.t === 'K') Ks *= b.K; else if (b.t === 'I') Ks *= b.Ki; });
    const hasI = blocks.some(function (b) { return b.t === 'I'; });
    function step(ya, z) {
      ya = num(ya, NaN); z = num(z, 0);
      if (!isFinite(ya)) return x;
      const u = ya - op.y + zIn * z;
      let mid = u, end = u;
      for (let i = 0; i < bs.length; i++) { bs[i].step(mid, end); mid = bs[i].oMid; end = bs[i].oEnd; }
      x = clamp(op.x + end + zOut * z, xmin, xmax); t += h;
      return x;
    }
    function steady(y, z) {
      y = num(y, NaN); z = num(z, 0);
      if (hasI || !isFinite(y)) return NaN;
      return op.x + Ks * (y - op.y + zIn * z) + zOut * z;
    }
    function setSteady(y, z, x0) {
      y = num(y, op.y); z = num(z, 0);
      let v = y - op.y + zIn * z, steadyOk = true;
      for (let i = 0; i < bs.length; i++) {
        if (blocks[i].t === 'I') {
          if (Math.abs(v) > 1e-9) steadyOk = false;
          const hold = isFinite(num(x0, NaN)) ? (num(x0, 0) - op.x - zOut * z) / gainAfter(i) : NaN;
          v = bs[i].setSteady(v, hold);
        } else v = bs[i].setSteady(v);
      }
      x = clamp(op.x + v + zOut * z, xmin, xmax);
      return { ok: true, steady: steadyOk, x: x };
    }
    return {
      ok: true, h: h, msgs: msgs, Ks: Ks, q: blocks.filter(function (b) { return b.t === 'I'; }).length,
      step: step, reset: resetTo, setSteady: setSteady, steady: steady,
      gain: function () { return Ks; },
      blocks: function () { return blocks.map(function (b) { return Object.assign({}, b); }); },
      state: function () { return { x: x, t: t, blocks: bs.map(function (b) { return b.state(); }) }; }
    };
  }

  /* =====================================================================================================
   *  REGLER (M1)
   * ===================================================================================================== */
  const TYPES = ['P', 'I', 'PI', 'PD', 'PID', '2P', '3P'];
  function normCtrl(spec, h) {
    spec = spec && typeof spec === 'object' ? spec : {};
    const type = spec.type === undefined ? 'P' : spec.type;
    if (TYPES.indexOf(type) < 0) return fail(TXT.artUnbekannt);
    function g(k, d) { return spec[k] === undefined || spec[k] === null ? d : num(spec[k], NaN); }
    const p = {
      type: type, Kp: g('Kp', 1), Tn: g('Tn', 10), Tv: g('Tv', 0), N: g('N', 10), Ta: g('Ta', h), u0: g('u0', 0),
      ymin: g('ymin', 0), ymax: g('ymax', 100), aw: spec.aw === undefined ? 'rueck' : spec.aw,
      dOn: spec.dOn === undefined ? 'x' : spec.dOn, dir: spec.dir === undefined ? 'direkt' : spec.dir,
      hyst: g('hyst', 2), dead: g('dead', 1), yOn: g('yOn', 100), yOff: g('yOff', 0),
      yPlus: g('yPlus', 100), yZero: g('yZero', 50), yMinus: g('yMinus', 0), Tr: spec.Tr === undefined || spec.Tr === null ? null : num(spec.Tr, NaN)
    };
    const needTn = type === 'I' || type === 'PI' || type === 'PID';
    const nums = ['Kp', 'Tv', 'N', 'Ta', 'u0', 'ymin', 'ymax', 'hyst', 'dead', 'yOn', 'yOff', 'yPlus', 'yZero', 'yMinus'];
    for (let i = 0; i < nums.length; i++) if (!isFinite(p[nums[i]])) return fail(nums[i] + ' muss eine Zahl sein');
    if (needTn && !isFinite(p.Tn)) return fail('Tn muss eine Zahl sein');
    if (p.Kp < 0) return fail(TXT.kpNeg);
    if (needTn && !(p.Tn > 0)) return fail(TXT.tnPos);
    if (p.Tv < 0) return fail(TXT.tvNeg);
    if (!(p.Ta > 0)) return fail(TXT.taPos);
    if (p.N < 1) return fail(TXT.nMin);
    if (!(p.ymin < p.ymax)) return fail(TXT.yGrenzen);
    if (p.hyst < 0) return fail(TXT.hystNeg);
    if (p.dead < 0) return fail(TXT.deadNeg);
    if (['aus', 'klemmen', 'rueck'].indexOf(p.aw) < 0) return fail('Anti-Windup muss aus, klemmen oder rueck sein');
    if (p.dOn !== 'x' && p.dOn !== 'e') return fail('dOn muss x oder e sein');
    if (p.dir !== 'direkt' && p.dir !== 'invers') return fail('Der Wirkungssinn muss direkt oder invers sein');
    if (p.Tr !== null && !(p.Tr > 0)) return fail('Tr muss größer 0 sein');
    p.nTa = Math.max(1, Math.round(p.Ta / h));
    p.TaEff = p.nTa * h;
    return { ok: true, p: p };
  }

  /* controller(spec, h): Regler. step(w, x, opts?) -> y (ein Aufruf = ein Kernschritt h; gerechnet wird alle Ta). */
  function controller(spec, h) {
    h = num(h, NaN);
    if (!(h > 0)) return fail(TXT.hPos);
    const first = normCtrl(spec, h);
    if (!first.ok) return first;
    let raw = Object.assign({}, spec);
    let p = first.p;
    let I = 0, Dst = 0, vAlt = NaN, yuAlt = 0, yAlt = 0, s = 0, k = 0, u0t = p.u0, track = false, y = clamp(p.u0, p.ymin, p.ymax), yu = y;
    let lastP = 0, lastD = 0, lastE = 0;
    yAlt = y; yuAlt = y;
    function trOf() {
      if (p.Tr) return p.Tr;
      if (p.type === 'PID' && p.Tv > 0) return Math.sqrt(p.Tn * p.Tv);
      return p.Tn;
    }
    // Zweipunkt/Dreipunkt: neuer Schaltzustand
    function switching(e) {
      if (p.type === '2P') {
        if (e > p.hyst / 2) s = 1; else if (e < -p.hyst / 2) s = 0;
        y = s ? p.yOn : p.yOff;
      } else {
        const d = p.dead, hh = p.hyst / 2;
        if (s === 1) { if (e < d - hh) { s = 0; if (e < -d - hh) s = -1; } }
        else if (s === -1) { if (e > -d + hh) { s = 0; if (e > d + hh) s = 1; } }
        else if (e > d + hh) s = 1; else if (e < -d - hh) s = -1;
        y = s === 1 ? p.yPlus : (s === -1 ? p.yMinus : p.yZero);
      }
      y = clamp(y, p.ymin, p.ymax); yu = y; lastE = e;
    }
    function parts(w, x) {
      const dirS = p.dir === 'direkt' ? 1 : -1;
      const e = dirS * (w - x);
      const hasD = p.type === 'PD' || p.type === 'PID';
      const P = p.type === 'I' ? 0 : p.Kp * e;
      const v = p.dOn === 'e' ? e : -dirS * x;
      let D = 0;
      if (hasD && p.Tv > 0) {
        if (!isFinite(vAlt)) vAlt = v;
        const Tf = p.Tv / p.N;
        D = (Tf * Dst + p.Kp * p.Tv * (v - vAlt)) / (Tf + p.TaEff);
      }
      vAlt = v; Dst = D;
      return { e: e, P: P, D: D };
    }
    function compute(w, x) {
      if (p.type === '2P' || p.type === '3P') { const dirS = p.dir === 'direkt' ? 1 : -1; switching(dirS * (w - x)); return y; }
      const q = parts(w, x), e = q.e;
      const hasI = p.type === 'I' || p.type === 'PI' || p.type === 'PID';
      const Ki = (p.type === 'I' ? 1 : p.Kp) * p.TaEff / p.Tn;
      if (hasI) {
        let In = I + Ki * e;
        if (p.aw === 'rueck') In += p.TaEff / trOf() * (yAlt - yuAlt);
        if (p.aw === 'klemmen') {
          const cand = u0t + q.P + In + q.D;
          if ((cand > p.ymax && e > 0) || (cand < p.ymin && e < 0)) In = I;
        }
        I = In;
      }
      yu = u0t + q.P + I + q.D;
      y = clamp(yu, p.ymin, p.ymax);
      yuAlt = yu; yAlt = y; lastP = q.P; lastD = q.D; lastE = e;
      return y;
    }
    const o = {
      ok: true,
      step: function (w, x) {
        w = num(w, NaN); x = num(x, NaN);
        if (!isFinite(w) || !isFinite(x)) return NaN;
        const due = k % p.nTa === 0; k++;
        if (!due) return y;
        return compute(w, x);
      },
      bumpless: function (yHand, w, x) {
        yHand = num(yHand, NaN); w = num(w, NaN); x = num(x, NaN);
        if (!isFinite(yHand) || !isFinite(w) || !isFinite(x)) return NaN;
        const yh = clamp(yHand, p.ymin, p.ymax);
        const due = k % p.nTa === 0; k++;
        if (due && p.type !== '2P' && p.type !== '3P') {
          const q = parts(w, x);
          const hasI = p.type === 'I' || p.type === 'PI' || p.type === 'PID';
          if (hasI) {
            const Ki = (p.type === 'I' ? 1 : p.Kp) * p.TaEff / p.Tn;
            I = yh - u0t - q.P - q.D - Ki * q.e;
          } else { u0t = yh - q.P - q.D; track = true; }
          yu = yh; yAlt = yh; yuAlt = yh; lastP = q.P; lastD = q.D; lastE = q.e;
        }
        y = yh;
        return yh;
      },
      reset: function () {
        I = 0; Dst = 0; vAlt = NaN; s = 0; k = 0; u0t = p.u0; track = false;
        y = clamp(p.u0, p.ymin, p.ymax); yu = y; yAlt = y; yuAlt = y; lastP = 0; lastD = 0; lastE = 0;
      },
      setParams: function (np) {
        if (!np || typeof np !== 'object') return { ok: false, why: 'Es wurden keine Parameter übergeben.', kept: true };
        const merged = Object.assign({}, raw, np);
        const r = normCtrl(merged, h);
        if (!r.ok) return { ok: false, why: r.why, kept: true };
        raw = merged; p = r.p;
        if (np.u0 !== undefined) { u0t = p.u0; track = false; }
        return { ok: true };
      },
      state: function () {
        return {
          type: p.type, y: y, yu: yu, P: lastP, I: I, D: lastD, e: lastE, s: s, k: k, u0: p.u0, u0Track: u0t, tracking: track,
          Kp: p.Kp, Tn: p.Tn, Tv: p.Tv, Ta: p.TaEff, nTa: p.nTa, aw: p.aw, dir: p.dir, ymin: p.ymin, ymax: p.ymax,
          windup: Math.abs(yu - y), hasI: p.type === 'I' || p.type === 'PI' || p.type === 'PID',
          note: p.type === '2P' || p.type === '3P' ? TXT.zweipunktSofort : ''
        };
      },
      params: function () { return Object.assign({}, p); }
    };
    return o;
  }

  /* loop(cfg): Regelkreis-Hilfe in der Reihenfolge nach Spezifikation 4.5 (Sollwertrampe, Messglied, Regler, Strecke, Spur) */
  function loop(cfg) {
    cfg = cfg && typeof cfg === 'object' ? cfg : {};
    const h = num(cfg.h, NaN);
    if (!(h > 0)) return fail(TXT.hPos);
    const pl = plant(cfg.plant, h); if (!pl.ok) return pl;
    const ct = controller(Object.assign({ Ta: h }, cfg.ctrl || {}), h); if (!ct.ok) return ct;
    const se = sensor(Object.assign({ T: 0, noise: 0, seed: 1 }, cfg.sensor || {}));
    let w = num(cfg.w, 0), ws = w, z = num(cfg.z, 0), wRamp = Math.max(0, num(cfg.wRamp, 0)), mode = cfg.mode === 'hand' ? 'hand' : 'auto', yHand = num(cfg.yHand, 0);
    let x = pl.state().x, y = 0, t = 0, n = 0;
    const every = Math.max(1, Math.round(num(cfg.traceEvery, 1)));
    const trace = { t: [], w: [], x: [], y: [], z: [], e: [] };
    se.reset(x);
    function step() {
      if (wRamp > 0) ws += clamp(w - ws, -wRamp * h, wRamp * h); else ws = w;
      const xm = se.step(x, h);
      const yc = ct.step(ws, xm);
      y = mode === 'hand' ? ct.bumpless(yHand, ws, xm) : yc;
      if (!isFinite(y)) y = 0;
      x = pl.step(y, z); t += h; n++;
      if (n % every === 0 && trace.t.length < 2000000) { trace.t.push(t); trace.w.push(ws); trace.x.push(x); trace.y.push(y); trace.z.push(z); trace.e.push(ws - x); }
    }
    return {
      ok: true, h: h, trace: trace, plant: pl, ctrl: ct, sensor: se,
      step: step,
      run: function (tEnd) { const N = Math.min(Math.round(num(tEnd, 0) / h), 1000000); for (let i = 0; i < N; i++) step(); return x; },
      setW: function (v) { w = num(v, w); }, setZ: function (v) { z = num(v, z); },
      setMode: function (m, yh) { mode = m === 'hand' ? 'hand' : 'auto'; if (yh !== undefined) yHand = num(yh, yHand); },
      state: function () { return { t: t, w: ws, x: x, y: y, z: z, e: ws - x, mode: mode }; },
      reset: function (x0) { pl.reset(x0); ct.reset(); x = pl.state().x; se.reset(x); y = 0; t = 0; n = 0; ws = w; for (const k in trace) trace[k].length = 0; }
    };
  }

  /* ---------- Export M1 ---------- */
  api.version = '1.0';
  api.rng = S(rng);
  api.glossary = glossary;
  api.norm = norm;
  api.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  api.fmtTime = function (s, u) { try { return fmtTime(s, u); } catch (e) { return '–'; } };
  api.parseNum = C(parseNum);
  api.lag = S(lag); api.delay = S(delay); api.rk4 = function () { try { return rk4.apply(null, arguments); } catch (e) { return NaN; } };
  api.rateLimit = S(rateLimit); api.deadband = S(deadband); api.backlash = S(backlash);
  api.valveChar = C(valveChar); api.valveSlope = C(valveSlope);
  api.sensor = S(sensor); api.plant = S(plant); api.controller = S(controller); api.loop = S(loop);

  /* =====================================================================================================
   *  KENNGROESSEN AUS ZEITVERLAEUFEN (M2)
   * ===================================================================================================== */
  function numArr(a) {
    if (!isArr(a)) return false;
    for (let i = 0; i < a.length; i++) if (typeof a[i] !== 'number' || !isFinite(a[i])) return false;
    return true;
  }
  function meanOf(a, from, to) {
    let s = 0; const n = to - from;
    if (!(n > 0)) return NaN;
    for (let i = from; i < to; i++) s += a[i];
    return s / n;
  }
  function mean(arr, key) {
    if (!isArr(arr) || !arr.length) return NaN;
    const a = typeof key === 'string' ? arr.map(function (o) { return o && typeof o === 'object' ? o[key] : NaN; }) : arr;
    if (!numArr(a)) return NaN;
    return meanOf(a, 0, a.length);
  }
  function stdev(arr, key) {
    if (!isArr(arr) || arr.length < 2) return NaN;
    const a = typeof key === 'string' ? arr.map(function (o) { return o && typeof o === 'object' ? o[key] : NaN; }) : arr;
    if (!numArr(a)) return NaN;
    const m = meanOf(a, 0, a.length); let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - m) * (a[i] - m);
    return Math.sqrt(s / (a.length - 1));
  }
  /* window(samples, t0, t1): alle Messpunkte mit t0 <= t <= t1 (Punkte sind Zahlen mit Zeit .t oder Objekte mit .t) */
  function windowOf(samples, t0, t1) {
    t0 = num(t0, NaN); t1 = num(t1, NaN);
    if (!isArr(samples) || !isFinite(t0) || !isFinite(t1)) return [];
    return samples.filter(function (s) { return s && typeof s === 'object' && typeof s.t === 'number' && s.t >= t0 && s.t <= t1; });
  }

  /* oscillation(t, x, opts): Extrema (Zickzack mit Schwelle), Amplitudenfolge, Klasse */
  function oscillation(t, x, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!numArr(t) || !numArr(x) || t.length !== x.length) return fail('Zeit und Werte müssen gleich lange Zahlenlisten sein.');
    const res = { ok: true, cls: 'aperiodisch', period: NaN, amp: NaN, ratio: NaN, ratioPeriod: NaN, limited: false, n: 0, extrema: [] };
    const n = x.length;
    if (n < 3) return res;
    let mn = x[0], mx = x[0];
    for (let i = 1; i < n; i++) { if (x[i] < mn) mn = x[i]; if (x[i] > mx) mx = x[i]; }
    const range = num(opts.range, NaN);
    // opts.noise = Messrauschen in Prozent des Bereichs (range): Ausschläge unterhalb von 2 Rauschbreiten zählen nicht als Schwingung
    const noiseAmp = isFinite(range) && isFinite(num(opts.noise, NaN)) && num(opts.noise, 0) > 0 ? num(opts.noise, 0) * Math.abs(range) / 100 : 0;
    const delta = Math.max(isFinite(range) ? 0.005 * Math.abs(range) : 0, 0.02 * (mx - mn), 2 * noiseAmp);
    if (!(delta > 0)) return res;
    const ext = [];
    let dir = 0, maxV = x[0], maxI = 0, minV = x[0], minI = 0;
    for (let i = 1; i < n; i++) {
      if (x[i] > maxV) { maxV = x[i]; maxI = i; }
      if (x[i] < minV) { minV = x[i]; minI = i; }
      if (dir === 0) {
        if (x[i] - minV >= delta) { dir = 1; maxV = x[i]; maxI = i; }
        else if (maxV - x[i] >= delta) { dir = -1; minV = x[i]; minI = i; }
      } else if (dir === 1) {
        if (maxV - x[i] >= delta) { ext.push({ t: t[maxI], x: maxV, kind: 'max' }); dir = -1; minV = x[i]; minI = i; }
      } else if (x[i] - minV >= delta) { ext.push({ t: t[minI], x: minV, kind: 'min' }); dir = 1; maxV = x[i]; maxI = i; }
    }
    res.extrema = ext; res.n = ext.length;
    if (ext.length >= 2) res.amp = Math.abs(ext[ext.length - 1].x - ext[ext.length - 2].x);
    if (ext.length < 3) return res;
    const a1 = Math.abs(ext[1].x - ext[0].x), aN = res.amp;
    res.ratio = a1 > 0 ? aN / a1 : NaN;
    const steps = ext.length - 2;
    res.ratioPeriod = res.ratio > 0 ? Math.pow(res.ratio, 2 / steps) : 0;
    let ps = 0, pc = 0;
    for (let k = 0; k + 2 < ext.length; k++) { ps += ext[k + 2].t - ext[k].t; pc++; }
    res.period = pc ? ps / pc : NaN;
    if (!isFinite(res.ratioPeriod)) res.cls = 'aperiodisch';
    else if (res.ratioPeriod < 0.8) res.cls = 'gedaempft';
    else if (res.ratioPeriod <= 1.25) res.cls = 'dauerschwingung';
    else res.cls = 'aufschaukelnd';
    if (isArr(opts.y) && opts.y.length === n) {
      const ymin = num(opts.ymin, 0), ymax = num(opts.ymax, 100), tStart = ext[0].t;
      for (let i = 0; i < n; i++) if (t[i] >= tStart && (opts.y[i] <= ymin + 0.5 || opts.y[i] >= ymax - 0.5)) { res.limited = true; break; }
    }
    return res;
  }

  /* Hilfen fuer Band- und Schwellenzeiten (relativ zum Start, linear interpolierte Durchgaenge) */
  function crossTime(tt, d, from) {
    // erster Index i >= from mit d[i] <= 0 (innen); liefert interpolierte Zeit oder null
    for (let i = from; i < d.length; i++) {
      if (d[i] <= 0) {
        if (i === from || i === 0) return tt[i];
        const f = d[i - 1] / (d[i - 1] - d[i]);
        return tt[i - 1] + f * (tt[i] - tt[i - 1]);
      }
    }
    return null;
  }
  function lastOutside(tt, d) {
    // letzter Zeitpunkt, an dem d > 0 (aussen) galt; 0 wenn nie aussen; null wenn am Ende aussen
    let last = -1;
    for (let i = 0; i < d.length; i++) if (d[i] > 0) last = i;
    if (last < 0) return 0;
    if (last === d.length - 1) return null;
    const f = d[last] / (d[last] - d[last + 1]);
    return tt[last] + f * (tt[last + 1] - tt[last]);
  }
  function selectFrom(t, x, t0) {
    let i0 = -1;
    for (let i = 0; i < t.length; i++) if (t[i] >= t0 - 1e-12) { i0 = i; break; }
    if (i0 < 0) return null;
    const tt = [], xx = [];
    for (let i = i0; i < t.length; i++) { tt.push(t[i] - t0); xx.push(x[i]); }
    return { tt: tt, xx: xx };
  }

  /* stepMetrics(t, x, { w0, w1, t0, tol, range }): Fuehrungssprung */
  function stepMetrics(t, x, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!isArr(t) || !isArr(x) || t.length !== x.length) return fail('Zeit und Messwerte müssen gleich lange Listen sein.');
    const w0 = num(opts.w0, NaN), w1 = num(opts.w1, NaN), dw = w1 - w0;
    if (!isFinite(dw) || dw === 0) return fail(TXT.sprungNull);
    if (!numArr(t) || !numArr(x)) return fail('Die Aufzeichnung enthält ungültige Werte.');
    const t0 = isFinite(num(opts.t0, NaN)) ? num(opts.t0, 0) : (t.length ? t[0] : 0);
    const sel = selectFrom(t, x, t0);
    if (!sel || sel.tt.length < 5) return fail(TXT.zuKurz);
    const tt = sel.tt, xx = sel.xx, n = tt.length, adw = Math.abs(dw), dirS = sign(dw);
    const tol = clamp(num(opts.tol, 0.02), 0.001, 0.5);
    const m5 = Math.max(5, Math.ceil(0.05 * n));
    const xEnd = meanOf(xx, Math.max(0, n - m5), n);
    const tenth = Math.max(1, Math.floor(n / 10));
    const a = meanOf(xx, n - tenth, n), b = meanOf(xx, Math.max(0, n - 2 * tenth), n - tenth);
    const settled = Math.abs(a - b) <= 0.005 * adw;
    const ebl = w1 - xEnd, eblPct = 100 * ebl / adw;
    let im = 0;
    for (let i = 1; i < n; i++) if (dirS * xx[i] > dirS * xx[im]) im = i;
    const ueberPct = Math.max(0, 100 * dirS * (xx[im] - w1) / adw), tMax = tt[im];
    const dTol = xx.map(function (v) { return Math.abs(v - w1) - tol * adw; });
    const tAn = crossTime(tt, dTol, 0);
    const dFirst = xx.map(function (v) { return -dirS * (v - w1); });
    const tFirst = crossTime(tt, dFirst, 0);
    const t10 = crossTime(tt, xx.map(function (v) { return -dirS * (v - (w0 + 0.1 * dw)); }), 0);
    const t90 = crossTime(tt, xx.map(function (v) { return -dirS * (v - (w0 + 0.9 * dw)); }), 0);
    const tRise = t10 !== null && t90 !== null ? t90 - t10 : null;
    function aus(frac) {
      const band = frac * adw;
      if (Math.abs(xEnd - w1) > band) {
        return { v: null, why: 'nicht ausgeregelt: Die bleibende Abweichung (' + fmt(Math.abs(eblPct)) + ' %) ist größer als das Toleranzband (' + fmt(frac * 100) + ' %).' };
      }
      return { v: lastOutside(tt, xx.map(function (v) { return Math.abs(v - w1) - band; })), why: '' };
    }
    const a2 = aus(0.02), a5 = aus(0.05);
    const osc = oscillation(tt, xx, { range: num(opts.range, NaN) });
    return {
      ok: true, dw: dw, w0: w0, w1: w1, n: n, tol: tol, xEnd: xEnd, settled: settled, warn: settled ? '' : TXT.nichtEingeschwungen,
      ebl: ebl, eblPct: eblPct, eblRange: ebl, ueberPct: ueberPct, tMax: tMax, tAn: tAn, tFirst: tFirst, tRise: tRise,
      tAus2: a2.v, tAus5: a5.v, tAus2Why: a2.why, tAus5Why: a5.why, cls: osc
    };
  }

  /* disturbMetrics(t, x, { w, tz, band, range, unit }): Stoergroessensprung bei tz */
  function disturbMetrics(t, x, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!isArr(t) || !isArr(x) || t.length !== x.length) return fail('Zeit und Messwerte müssen gleich lange Listen sein.');
    const w = num(opts.w, NaN);
    if (!isFinite(w)) return fail('Der Sollwert w fehlt.');
    if (!numArr(t) || !numArr(x)) return fail('Die Aufzeichnung enthält ungültige Werte.');
    const tz = isFinite(num(opts.tz, NaN)) ? num(opts.tz, 0) : (t.length ? t[0] : 0);
    const range = pos(opts.range, 100);
    const band = pos(opts.band, 0.02 * range);
    const sel = selectFrom(t, x, tz);
    if (!sel || sel.tt.length < 5) return fail(TXT.zuKurz);
    const tt = sel.tt, xx = sel.xx, n = tt.length;
    let im = 0;
    for (let i = 1; i < n; i++) if (Math.abs(xx[i] - w) > Math.abs(xx[im] - w)) im = i;
    const xdMax = xx[im] - w;
    if (Math.abs(xdMax) < 0.1 * band) return fail('Die Störung hat die Regelgröße nicht erkennbar verändert (Abweichung unter einem Zehntel des Toleranzbandes).');
    const m5 = Math.max(5, Math.ceil(0.05 * n)), xEnd = meanOf(xx, Math.max(0, n - m5), n);
    const eblStoer = xEnd - w;
    const tenth = Math.max(1, Math.floor(n / 10));
    const settled = Math.abs(meanOf(xx, n - tenth, n) - meanOf(xx, Math.max(0, n - 2 * tenth), n - tenth)) <= 0.005 * range;
    let tAus = null, why = '';
    if (Math.abs(eblStoer) > band) {
      const u = typeof opts.unit === 'string' && opts.unit ? ' ' + opts.unit : '';
      why = 'nicht ausgeregelt: Die bleibende Abweichung (' + fmt(Math.abs(eblStoer)) + u + ') ist größer als das Toleranzband (' + fmt(band) + u + ').';
    } else tAus = lastOutside(tt, xx.map(function (v) { return Math.abs(v - w) - band; }));
    return { ok: true, xdMax: xdMax, tMax: tt[im], tAus: tAus, tAusWhy: why, eblStoer: eblStoer, band: band, settled: settled, warn: settled ? '' : TXT.nichtEingeschwungen };
  }

  /* steadyState(info, ctrl, { w, z, u0, off, ymin, ymax, limits }): analytische bleibende Abweichung.
   * info = { Ks, q, yn?, stable? }; ctrl = Reglerbeschreibung; z als aequivalente Stellgroesse in %; off = Festanteil der Strecke
   * (x = off + Ks*y). Alle Werte in %. */
  function steadyState(info, ctrl, inp) {
    if (!info || typeof info !== 'object' || !ctrl || typeof ctrl !== 'object') return fail('Es fehlen Streckenkennwerte oder Reglerdaten.');
    inp = inp && typeof inp === 'object' ? inp : {};
    const type = ctrl.type === undefined ? 'P' : ctrl.type;
    if (TYPES.indexOf(type) < 0) return fail(TXT.artUnbekannt);
    if (type === '2P' || type === '3P') return fail('Für Schaltregler gibt es keine bleibende Abweichung im linearen Sinn: Der Wert schwankt um die Schaltschwellen.');
    const Ks = num(info.Ks, NaN), q = Math.round(num(info.q, 0));
    const Kp = num(ctrl.Kp, NaN), dirS = ctrl.dir === 'invers' ? -1 : 1;
    const w = num(inp.w, NaN), zeq = num(inp.z, 0), u0 = num(inp.u0, 0), off = num(inp.off, 0), yn = num(info.yn, 0);
    if (!isFinite(Ks) || !isFinite(w) || !isFinite(Kp) || Kp < 0 || (q !== 0 && q !== 1) || info.stable === false) return fail(TXT.steadyNur);
    const hasI = type === 'I' || type === 'PI' || type === 'PID';
    const Kpe = (type === 'I' ? 0 : dirS * Kp);
    const ymin = num(inp.ymin, 0), ymax = num(inp.ymax, 100), limits = inp.limits !== false;
    let ebl, yss, V0 = dirS * Kp * Ks, warn = '';
    if (q === 0) {
      if (hasI) {
        if (Ks === 0) return fail(TXT.steadyNur);
        ebl = 0; yss = (w - off) / Ks - zeq;
      } else {
        if (!(1 + V0 > 0)) return fail(TXT.steadyNur);
        const A = Ks * (u0 + zeq) + off;
        ebl = (w - A) / (1 + V0);
        yss = u0 + Kpe * ebl;
      }
    } else {
      if (hasI) { ebl = 0; warn = TXT.zwei_int; }
      else {
        if (!(Kpe > 0)) return fail(TXT.steadyNur);
        ebl = -(u0 - yn + zeq) / Kpe; if (ebl === 0) ebl = 0;
      }
      yss = yn - zeq;
    }
    if (limits && (yss < ymin - 1e-9 || yss > ymax + 1e-9)) return fail(TXT.steadyNur);
    return { ok: true, ebl: ebl + 0, xss: w - ebl, yss: yss, V0: V0, warn: warn };
  }

  /* =====================================================================================================
   *  FREQUENZBEREICH (M2)
   * ===================================================================================================== */
  function normFreq(blocks) {
    if (blocks && typeof blocks === 'object' && !isArr(blocks) && blocks.ok === false) return { err: blocks };
    if (!isArr(blocks) || !blocks.length) return { err: fail('Die Blockliste fehlt oder ist leer.') };
    const out = [];
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b || typeof b !== 'object') return { err: fail('Die Blockliste enthält ungültige Einträge.') };
      const bad = fail('Block ' + (i + 1) + ' (' + (b && b.t) + ') hat ungültige Werte.');
      switch (b.t) {
        case 'K': { const K = num(b.K, NaN); if (!isFinite(K)) return { err: bad }; out.push({ t: 'K', K: K }); break; }
        case 'PT1': { const T = num(b.T, NaN); if (!(T > 0)) return { err: bad }; out.push({ t: 'PT1', T: T }); break; }
        case 'PT2': {
          if (b.T1 !== undefined && b.w0 === undefined) {
            const T1 = num(b.T1, NaN), T2 = num(b.T2, NaN); if (!(T1 > 0) || !(T2 > 0)) return { err: bad };
            out.push({ t: 'PT1', T: T1 }); out.push({ t: 'PT1', T: T2 });
          } else { const w0 = num(b.w0, NaN), D = num(b.D, NaN); if (!(w0 > 0) || !isFinite(D)) return { err: bad }; out.push({ t: 'PT2', w0: w0, D: clamp(D, 0.05, 2) }); }
          break;
        }
        case 'I': { const Ki = num(b.Ki, NaN); if (!isFinite(Ki) || Ki === 0) return { err: bad }; out.push({ t: 'I', Ki: Ki }); break; }
        case 'Tt': { const Tt = num(b.Tt, NaN); if (!(Tt >= 0)) return { err: bad }; out.push({ t: 'Tt', Tt: Tt }); break; }
        case 'PI': { const Kp = num(b.Kp, NaN), Tn = num(b.Tn, NaN); if (!(Kp >= 0) || !(Tn > 0)) return { err: bad }; out.push({ t: 'PI', Kp: Kp, Tn: Tn }); break; }
        case 'PD': { const Kp = num(b.Kp, NaN), Tv = num(b.Tv, NaN), Tf = num(b.Tf, 0); if (!(Kp >= 0) || !(Tv >= 0) || !(Tf >= 0)) return { err: bad }; out.push({ t: 'PD', Kp: Kp, Tv: Tv, Tf: Tf }); break; }
        case 'PID': { const Kp = num(b.Kp, NaN), Tn = num(b.Tn, NaN), Tv = num(b.Tv, NaN), Tf = num(b.Tf, 0); if (!(Kp >= 0) || !(Tn > 0) || !(Tv >= 0) || !(Tf >= 0)) return { err: bad }; out.push({ t: 'PID', Kp: Kp, Tn: Tn, Tv: Tv, Tf: Tf }); break; }
        default: return { err: fail('Unbekannter Block „' + b.t + '“.') };
      }
    }
    return { blocks: out };
  }
  /* Betrag und Phase (Summe der analytischen Blockphasen, stetig) */
  function respOf(blocks, w) {
    let lm = 0, ph = 0, neg = 0;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      switch (b.t) {
        case 'K': if (b.K < 0) neg++; lm += Math.log(Math.abs(b.K)); break;
        case 'PT1': lm -= 0.5 * Math.log(1 + w * w * b.T * b.T); ph -= Math.atan(w * b.T); break;
        case 'PT2': { const r = w / b.w0, re = 1 - r * r, im = 2 * b.D * r; lm -= 0.5 * Math.log(re * re + im * im); ph -= Math.atan2(im, re); break; }
        case 'I': if (b.Ki < 0) neg++; lm += Math.log(Math.abs(b.Ki) / w); ph -= Math.PI / 2; break;
        case 'Tt': ph -= w * b.Tt; break;
        case 'PI': { lm += 0.5 * Math.log(b.Kp * b.Kp * (1 + 1 / (w * w * b.Tn * b.Tn))); ph -= Math.atan(1 / (w * b.Tn)); break; }
        case 'PD': case 'PID': {
          const den = 1 + w * w * b.Tf * b.Tf;
          const re = b.Kp * (1 + w * w * b.Tv * b.Tf / den);
          let im = b.Kp * w * b.Tv / den;
          if (b.t === 'PID') im -= b.Kp / (w * b.Tn);
          lm += 0.5 * Math.log(re * re + im * im); ph += Math.atan2(im, re); break;
        }
      }
    }
    if (neg % 2 === 1) ph -= Math.PI;
    return { mag: Math.exp(lm), ph: ph, neg: neg };
  }
  function loopInfo(blocks) {
    let q = 0, V0 = 1, Kv = 1, neg = 0;
    blocks.forEach(function (b) {
      if (b.t === 'K') { V0 *= b.K; Kv *= Math.abs(b.K); if (b.K < 0) neg++; }
      else if (b.t === 'I') { q++; Kv *= Math.abs(b.Ki); if (b.Ki < 0) neg++; }
      else if (b.t === 'PI' || b.t === 'PID') { q++; V0 *= b.Kp; Kv *= b.Kp / b.Tn; }
      else if (b.t === 'PD') { V0 *= b.Kp; Kv *= b.Kp; }
    });
    return { q: q, V0: neg % 2 === 1 && V0 > 0 ? -V0 : V0, Kv: q === 0 ? Math.abs(V0) : Kv, neg: neg };
  }
  function gridFor(blocks, opts) {
    let Tmax = 0, Tmin = Infinity;
    function addT(T) { if (T > 0) { if (T > Tmax) Tmax = T; if (T < Tmin) Tmin = T; } }
    blocks.forEach(function (b) {
      if (b.t === 'PT1') addT(b.T); else if (b.t === 'PT2') addT(1 / b.w0);
      else if (b.t === 'PI' || b.t === 'PID') addT(b.Tn);
      if (b.t === 'PD' || b.t === 'PID') { addT(b.Tv); addT(b.Tf); }
      if (b.t === 'Tt') addT(b.Tt);
    });
    let wmin = 0.01, wmax = 1000;
    if (Tmax > 0) { wmin = 1e-3 / Tmax; wmax = 1e3 / Tmin; }
    opts = opts || {};
    if (isFinite(num(opts.wmin, NaN)) && num(opts.wmin, 0) > 0) wmin = num(opts.wmin, wmin);
    if (isFinite(num(opts.wmax, NaN)) && num(opts.wmax, 0) > wmin) wmax = num(opts.wmax, wmax);
    return { wmin: wmin, wmax: wmax };
  }
  function logGrid(wmin, wmax, N) {
    const a = Math.log(wmin), b = Math.log(wmax), w = new Array(N);
    for (let i = 0; i < N; i++) w[i] = Math.exp(a + (b - a) * i / (N - 1));
    return w;
  }
  function bisect(f, a, b) {
    // f(a) und f(b) haben verschiedene Vorzeichen; Bisektion auf log w, 60 Schritte
    let la = Math.log(a), lb = Math.log(b), fa = f(a);
    for (let i = 0; i < 60; i++) {
      const lm = 0.5 * (la + lb), fm = f(Math.exp(lm));
      if ((fa <= 0 && fm <= 0) || (fa >= 0 && fm >= 0)) { la = lm; fa = fm; } else lb = lm;
    }
    return Math.exp(0.5 * (la + lb));
  }
  function findCross(blocks, w, fn) {
    const out = [];
    let prev = fn(respOf(blocks, w[0])), pz = prev === 0;
    if (pz) out.push(w[0]);
    for (let i = 1; i < w.length; i++) {
      const cur = fn(respOf(blocks, w[i]));
      if (cur === 0 && !pz) out.push(w[i]);
      else if (prev !== 0 && cur !== 0 && (prev < 0) !== (cur < 0)) out.push(bisect(function (x) { return fn(respOf(blocks, x)); }, w[i - 1], w[i]));
      pz = cur === 0; prev = cur;
    }
    return out;
  }

  /* freq.eval(blocks, w): komplexer Frequenzgang */
  function freqEval(blocks, w) {
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    w = num(w, NaN);
    if (!(w > 0)) return fail('Die Kreisfrequenz muss größer 0 sein.');
    const r = respOf(nb.blocks, w);
    return { ok: true, w: w, mag: r.mag, phase: r.ph, re: r.mag * Math.cos(r.ph), im: r.mag * Math.sin(r.ph), magDb: 20 * log10(r.mag), phaseDeg: r.ph * 180 / Math.PI };
  }
  /* freq.loopBlocks(plantBlocks, ctrl): offener Kreis = Strecke + Regler (+ Halteglied Ta/2 wenn ctrl.Ta gesetzt, A12) */
  function loopBlocks(plantBlocks, ctrl) {
    const nb = normFreq(plantBlocks); if (nb.err) return nb.err;
    if (!ctrl || typeof ctrl !== 'object') return fail('Die Reglerbeschreibung fehlt.');
    const type = ctrl.type === undefined ? 'P' : ctrl.type;
    if (type === '2P' || type === '3P') return fail(TXT.schaltregler);
    const TaIn = num(ctrl.Ta, NaN);
    const nc = normCtrl(Object.assign({}, ctrl, { Ta: isFinite(TaIn) && TaIn > 0 ? TaIn : 1 }), isFinite(TaIn) && TaIn > 0 ? TaIn : 1);
    if (!nc.ok) return nc;
    const p = nc.p, out = nb.blocks.slice(), Tf = p.Tv / p.N;
    if (p.type === 'P') out.push({ t: 'K', K: p.Kp });
    else if (p.type === 'I') out.push({ t: 'I', Ki: 1 / p.Tn });
    else if (p.type === 'PI') out.push({ t: 'PI', Kp: p.Kp, Tn: p.Tn });
    else if (p.type === 'PD') out.push({ t: 'PD', Kp: p.Kp, Tv: p.Tv, Tf: Tf });
    else out.push({ t: 'PID', Kp: p.Kp, Tn: p.Tn, Tv: p.Tv, Tf: Tf });
    if (p.dir === 'invers') out.push({ t: 'K', K: -1 });
    if (isFinite(TaIn) && TaIn > 0 && ctrl.hold !== false) out.push({ t: 'Tt', Tt: TaIn / 2 });
    return out;
  }
  /* margins(blocks, opts): Phasen- und Amplitudenreserve */
  function margins(blocks, opts) {
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    const b = nb.blocks, info = loopInfo(b), g = gridFor(b, opts);
    const res = { ok: true, V0: info.V0, q: info.q, Kv: info.Kv, wD: null, phiR: null, wPi: null, AR: null, stable: false, valid: true, multi: false, note: '' };
    if (info.V0 < 0 || (info.neg % 2 === 1)) {
      res.valid = false; res.stable = false; res.note = TXT.negativeKreisverst; return res;
    }
    const w = logGrid(g.wmin, g.wmax, 4000);
    const wD = findCross(b, w, function (r) { return r.mag - 1; });
    const wPi = findCross(b, w, function (r) { return r.ph + Math.PI; });
    res.multi = wD.length > 1;
    let bestP = null;
    wD.forEach(function (x) { const ph = respOf(b, x).ph, pr = 180 + ph * 180 / Math.PI; if (bestP === null || pr < bestP.phiR) bestP = { w: x, phiR: pr }; });
    let bestA = null;
    wPi.forEach(function (x) { const a = -20 * log10(respOf(b, x).mag); if (bestA === null || a < bestA.AR) bestA = { w: x, AR: a }; });
    if (bestP) { res.wD = bestP.w; res.phiR = bestP.phiR; }
    if (bestA) { res.wPi = bestA.w; res.AR = bestA.AR; }
    res.valid = info.q <= 2 && !res.multi;
    res.stable = (res.phiR === null || res.phiR > 0) && (res.AR === null || res.AR > 0);
    const notes = [];
    if (!res.valid) notes.push(info.q > 2 ? 'Mehr als zwei Integratoren im Kreis: das vereinfachte Kriterium gilt hier nicht.' : TXT.mehrfachDurchtritt);
    else {
      if (res.phiR === null) notes.push(TXT.keinDurchtritt);
      if (res.AR === null) notes.push(TXT.unendlichAR);
    }
    res.note = notes.join(' ');
    return res;
  }
  function bode(blocks, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    const g = gridFor(nb.blocks, opts), N = clamp(Math.round(num(opts.points, 400)), 20, 20000);
    const w = logGrid(g.wmin, g.wmax, N), magDb = [], phaseDeg = [];
    for (let i = 0; i < N; i++) { const r = respOf(nb.blocks, w[i]); magDb.push(20 * log10(r.mag)); phaseDeg.push(r.ph * 180 / Math.PI); }
    const m = margins(nb.blocks, opts);
    return { ok: true, w: w, magDb: magDb, phaseDeg: phaseDeg, marks: { wD: m.wD, wPi: m.wPi, phiR: m.phiR, AR: m.AR } };
  }
  function nyquist(blocks, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    const g = gridFor(nb.blocks, opts), N = clamp(Math.round(num(opts.points, 600)), 20, 20000);
    const w = logGrid(g.wmin, g.wmax, N), pts = [], ws = [];
    let clipped = false, started = false;
    for (let i = 0; i < N; i++) {
      const r = respOf(nb.blocks, w[i]);
      if (!started) { if (r.mag > 10) { clipped = true; continue; } started = true; }
      pts.push([r.mag * Math.cos(r.ph), r.mag * Math.sin(r.ph)]); ws.push(w[i]);
    }
    return { ok: true, pts: pts, w: ws, crit: [-1, 0], clipped: clipped };
  }
  /* ultimate(plantBlocks): Ziegler-Nichols Schwingversuch analytisch (Strecke allein, Betraege der K-Glieder) */
  function ultimate(plantBlocks) {
    const nb = normFreq(plantBlocks); if (nb.err) return nb.err;
    const b = nb.blocks.map(function (x) {
      if (x.t === 'K') return { t: 'K', K: Math.abs(x.K) };
      if (x.t === 'I') return { t: 'I', Ki: Math.abs(x.Ki) };
      return x;
    });
    const g = gridFor(b), w = logGrid(g.wmin, g.wmax, 4000);
    const c = findCross(b, w, function (r) { return r.ph + Math.PI; });
    if (!c.length) return fail(TXT.keineUltimate);
    const wp = c[0], r = respOf(b, wp);
    if (!(r.mag > 0)) return fail(TXT.keineUltimate);
    return { ok: true, Kkrit: 1 / r.mag, Tkrit: TWO_PI / wp, wPi: wp };
  }

  /* charPoly(plantBlocks, ctrl) und routh(coef): nur rationale Strecken ohne Totzeit (A17) */
  function pmul(a, b) {
    const o = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) o[i + j] += a[i] * b[j];
    return o;
  }
  function padd(a, b) {
    const n = Math.max(a.length, b.length), o = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) o[i] += a[i];
    for (let i = 0; i < b.length; i++) o[i] += b[i];
    return o;
  }
  function charPoly(plantBlocks, ctrl) {
    const nb = normFreq(plantBlocks); if (nb.err) return nb.err;
    if (!ctrl || typeof ctrl !== 'object') return fail('Die Reglerbeschreibung fehlt.');
    const type = ctrl.type === undefined ? 'P' : ctrl.type;
    if (type === '2P' || type === '3P') return fail(TXT.schaltregler);
    const nc = normCtrl(Object.assign({}, ctrl, { Ta: 1 }), 1); if (!nc.ok) return nc;
    const p = nc.p, dirS = p.dir === 'invers' ? -1 : 1;
    let num_ = [1], den = [1];
    for (let i = 0; i < nb.blocks.length; i++) {
      const b = nb.blocks[i];
      if (b.t === 'Tt') return fail('Der Routh-Test gilt nur für Strecken ohne Totzeit; die Totzeit gibt es nur im Frequenzbereich.');
      if (b.t === 'K') num_ = pmul(num_, [b.K]);
      else if (b.t === 'PT1') den = pmul(den, [1, b.T]);
      else if (b.t === 'PT2') den = pmul(den, [1, 2 * b.D / b.w0, 1 / (b.w0 * b.w0)]);
      else if (b.t === 'I') { num_ = pmul(num_, [b.Ki]); den = pmul(den, [0, 1]); }
      else return fail('In der Strecke sind Reglerblöcke nicht erlaubt.');
    }
    let nC, dC;
    if (p.type === 'P') { nC = [p.Kp]; dC = [1]; }
    else if (p.type === 'I') { nC = [1]; dC = [0, p.Tn]; }
    else if (p.type === 'PI') { nC = [p.Kp, p.Kp * p.Tn]; dC = [0, p.Tn]; }
    else if (p.type === 'PD') { nC = [p.Kp, p.Kp * p.Tv]; dC = [1]; }
    else { nC = [p.Kp, p.Kp * p.Tn, p.Kp * p.Tn * p.Tv]; dC = [0, p.Tn]; }
    nC = nC.map(function (v) { return v * dirS; });
    const total = padd(pmul(den, dC), pmul(num_, nC));
    const coef = total.slice().reverse();
    while (coef.length > 1 && Math.abs(coef[0]) < 1e-15) coef.shift();
    return { ok: true, coef: coef, degree: coef.length - 1 };
  }
  function routh(coef) {
    if (!isArr(coef) || !numArr(coef)) return fail('Die Koeffizienten müssen eine Liste von Zahlen sein.');
    let a = coef.slice();
    while (a.length && a[0] === 0) a.shift();
    if (a.length < 2) return fail('Das Polynom braucht mindestens den Grad 1.');
    if (a[0] < 0) a = a.map(function (v) { return -v; });
    const n = a.length - 1, scale = Math.max.apply(null, a.map(Math.abs)), eps = 1e-12 * scale;
    let r0 = [], r1 = [];
    for (let i = 0; i < a.length; i += 2) r0.push(a[i]);
    for (let i = 1; i < a.length; i += 2) r1.push(a[i]);
    const first = [r0[0]];
    let special = false;
    if (n >= 1) first.push(r1[0]);
    for (let k = 2; k <= n; k++) {
      if (Math.abs(r1[0]) < eps) { special = true; break; }
      const w = Math.max(r0.length, r1.length), nr = [];
      for (let j = 0; j < w - 1; j++) {
        const x0 = j + 1 < r0.length ? r0[j + 1] : 0, x1 = j + 1 < r1.length ? r1[j + 1] : 0;
        nr.push((r1[0] * x0 - r0[0] * x1) / r1[0]);
      }
      if (!nr.length) nr.push(0);
      r0 = r1; r1 = nr; first.push(r1[0]);
    }
    if (!special && Math.abs(first[first.length - 1]) < eps) special = true;
    if (!special) for (let i = 0; i < first.length; i++) if (Math.abs(first[i]) < eps) { special = true; break; }
    if (special) return { ok: true, stable: false, firstColumn: first, signChanges: NaN, special: true, text: TXT.routhSonder };
    let sc = 0;
    for (let i = 1; i < first.length; i++) if ((first[i] < 0) !== (first[i - 1] < 0)) sc++;
    const stable = sc === 0;
    return {
      ok: true, stable: stable, firstColumn: first, signChanges: sc, special: false,
      text: stable ? 'Alle Werte der ersten Spalte sind positiv: Der Kreis ist stabil.'
        : 'Die erste Spalte hat ' + sc + ' Vorzeichenwechsel: ' + (sc === 1 ? '1 Pol liegt' : sc + ' Pole liegen') + ' in der rechten Halbebene, der Kreis ist instabil.'
    };
  }

  api.stepMetrics = S(stepMetrics); api.disturbMetrics = S(disturbMetrics); api.oscillation = S(oscillation);
  api.steadyState = S(steadyState);
  api.window = function (s, a, b) { try { return windowOf(s, a, b); } catch (e) { return []; } };
  api.mean = C(mean); api.stdev = C(stdev);
  api.freq = { eval: S(freqEval), loopBlocks: S(loopBlocks) };
  api.margins = S(margins); api.bode = S(bode); api.nyquist = S(nyquist); api.ultimate = S(ultimate);
  api.charPoly = S(charPoly); api.routh = S(routh);

  /* =====================================================================================================
   *  IDENTIFIKATION (M3)
   * ===================================================================================================== */
  /* stepResponse(blocks, tEnd, h): lineare Einheitssprungantwort der Strecke (Anfangswert 0) */
  function stepResponse(blocks, tEnd, h) {
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    tEnd = num(tEnd, NaN); h = num(h, NaN);
    if (!(tEnd > 0) || !(h > 0)) return fail('Endzeit und Schrittweite müssen größer 0 sein.');
    if (nb.blocks.some(function (b) { return b.t === 'PI' || b.t === 'PD' || b.t === 'PID'; })) return fail('Die Sprungantwort gilt für die Strecke, nicht für Reglerblöcke.');
    const N = Math.ceil(tEnd / h - 1e-9);
    if (N > 2000000) return fail('Zu viele Rechenschritte: Wähle eine größere Schrittweite oder eine kürzere Endzeit.');
    const pl = plant({ blocks: nb.blocks, op: { x: 0, y: 0 }, xmin: -1e15, xmax: 1e15 }, h);
    if (!pl.ok) return pl;
    const t = [0], x = [0];
    for (let i = 1; i <= N; i++) { x.push(pl.step(1, 0)); t.push(i * h); }
    return { ok: true, t: t, x: x };
  }

  function median(a) { const b = a.slice().sort(function (p, q) { return p - q; }); const m = b.length >> 1; return b.length % 2 ? b[m] : 0.5 * (b[m - 1] + b[m]); }
  /* lokale lineare Regression im Fenster w (ungerade): liefert geglaettete Werte xs und Steigungen sl */
  function localFit(tt, xx, w) {
    const n = tt.length, k = (w - 1) >> 1, xs = new Array(n).fill(NaN), sl = new Array(n).fill(NaN);
    for (let i = k; i < n - k; i++) {
      let st = 0, sx = 0;
      for (let j = i - k; j <= i + k; j++) { st += tt[j]; sx += xx[j]; }
      const mt = st / w, mx = sx / w; let num_ = 0, den = 0;
      for (let j = i - k; j <= i + k; j++) { num_ += (tt[j] - mt) * (xx[j] - mx); den += (tt[j] - mt) * (tt[j] - mt); }
      const s = den > 0 ? num_ / den : 0;
      sl[i] = s; xs[i] = mx + s * (tt[i] - mt);
    }
    return { xs: xs, sl: sl, k: k };
  }
  function regelUrteil(r) { return r > 10 ? 'gut regelbar' : (r >= 3 ? 'noch regelbar' : 'schwer regelbar'); }

  /* fitStep(t, x, dy, opts): Wendetangente. Ergebnis { ok, art, Ks, Tu, Tg, Kis?, regelbarkeit, urteil, warn, text, ... } */
  function fitStep(t, x, dy, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!isArr(t) || !isArr(x) || t.length !== x.length) return fail('Zeit und Messwerte müssen gleich lange Listen sein.');
    if (!numArr(t) || !numArr(x)) return fail('Die Aufzeichnung enthält ungültige Werte.');
    dy = num(dy, NaN);
    if (!isFinite(dy) || dy === 0) return fail('Der Stellgrößensprung ist 0: Ks und die Zeiten sind nicht definiert.');
    const t0 = isFinite(num(opts.t0, NaN)) ? num(opts.t0, 0) : (t.length ? t[0] : 0);
    const sel = selectFrom(t, x, t0);
    if (!sel || sel.tt.length < 10) return fail('Die Aufzeichnung ist zu kurz: Es werden mindestens 10 Messwerte nach dem Sprung gebraucht.');
    const tt = sel.tt, xx = sel.xx, n = tt.length;
    const x0 = meanOf(xx, 0, 3), m5 = Math.max(3, Math.ceil(0.05 * n)), xEndRaw = meanOf(xx, n - m5, n);
    const D = xEndRaw - x0;
    if (Math.abs(D) <= 1e-9 * Math.max(1, Math.abs(x0))) return fail('Die Regelgröße hat sich nicht geändert: Es ist keine Sprungantwort zu erkennen.');
    const dirS = sign(D);
    // Rauschschaetzung und Fensterwahl
    const d2 = [];
    for (let i = 1; i < n - 1; i++) d2.push(Math.abs(xx[i + 1] - 2 * xx[i] + xx[i - 1]));
    const sigma = 1.4826 * median(d2) / Math.sqrt(6);
    const dtm = (tt[n - 1] - tt[0]) / (n - 1);
    const oddc = function (v) { v = Math.max(5, Math.round(v)); return v % 2 ? v : v + 1; };
    const wMax = oddc(Math.floor(n / 4));
    let w = 5;
    if (sigma > 5e-4 * Math.abs(D)) {
      const big = localFit(tt, xx, Math.min(wMax, oddc(n / 10)));
      let smax = 0; for (let i = 0; i < n; i++) if (isFinite(big.sl[i]) && Math.abs(big.sl[i]) > smax) smax = Math.abs(big.sl[i]);
      for (w = 5; w < wMax; w += 2) {
        if (sigma / (dtm * Math.sqrt(w * (w * w - 1) / 12)) <= 0.02 * smax) break;
      }
    }
    const fit = localFit(tt, xx, Math.min(w, n % 2 ? n : n - 1));
    const xs = fit.xs, sl = fit.sl, k = fit.k;
    const i1 = k, i2 = n - 1 - k;
    // gegenlaeufiger Anteil (schwingende Antwort)
    let peak = -Infinity, retreat = 0;
    for (let i = i1; i <= i2; i++) { const v = dirS * (xs[i] - x0); if (v > peak) peak = v; if (peak - v > retreat) retreat = peak - v; }
    if (retreat > 0.2 * Math.abs(D)) return fail(TXT.schwingt);
    // Art: I-Strecke (Rampe) oder P-Strecke
    const a0 = Math.floor(0.8 * n), am = Math.floor((a0 + n - 1) / 2);
    const sa = (xx[am] - xx[a0]) / (tt[am] - tt[a0]), sb = (xx[n - 1] - xx[am]) / (tt[n - 1] - tt[am]);
    const mS = 0.5 * (sa + sb);
    const isI = dirS * mS > 0 && Math.abs(sb - sa) <= 0.05 * Math.abs(mS) && Math.abs(mS) * (tt[n - 1] - tt[a0]) >= 0.1 * Math.abs(D);
    let ie = i2;
    if (!isI) for (let i = i1; i <= i2; i++) if (dirS * (xs[i] - x0) >= 0.9 * Math.abs(D)) { ie = i; break; }
    let im = i1;
    for (let i = i1; i <= ie; i++) if (dirS * sl[i] > dirS * sl[im]) im = i;
    const s = sl[im];
    if (!(dirS * s > 0)) return fail('Es ist kein Anstieg in der Sprungantwort zu erkennen.');
    const res = { ok: true, art: isI ? 'I' : 'P', x0: x0, tWendepunkt: tt[im], xWendepunkt: xs[im], slope: s, warn: '', text: '' };
    const TuRaw = tt[im] - (xs[im] - x0) / s;
    res.TuRaw = TuRaw;
    if (isI) {
      const span = tt[n - 1] - tt[0];
      let Tu = Math.max(0, TuRaw);
      if (Tu < 0.005 * span) { res.warn = 'tu-klein'; res.text = TXT.tuKlein; Tu = 0.005 * span; }
      res.Tu = Tu; res.Kis = s / dy; res.Ks = NaN; res.Tg = NaN; res.regelbarkeit = NaN; res.urteil = '';
      return res;
    }
    const xEnd = xEndRaw, tInt = tt[im] + (xEnd - xs[im]) / s;
    let Tg = tInt - Math.max(0, TuRaw), Tu = Math.max(0, TuRaw);
    if (!(Tg > 0)) return fail('Die Antwort hat keinen erkennbaren Anstieg bis zum Endwert.');
    if (Tu < 0.02 * Tg) { res.warn = 'tu-klein'; res.text = TXT.tuKlein; Tu = 0.02 * Tg; }
    res.xEnd = xEnd; res.Ks = D / dy; res.Tu = Tu; res.Tg = Tg; res.TuTg = Tu / Tg;
    res.regelbarkeit = Tg / Tu; res.urteil = regelUrteil(res.regelbarkeit);
    return res;
  }

  /* identify(blocks): Sollwerte der Strecke (Ks, Tu, Tg, Tsum, Art, Kkrit, Tkrit) aus der Blockliste */
  function identify(blocks) {
    const nb = normFreq(blocks); if (nb.err) return nb.err;
    const b = nb.blocks;
    if (b.some(function (x) { return x.t === 'PI' || x.t === 'PD' || x.t === 'PID'; })) return fail('Die Strecke darf keine Reglerblöcke enthalten.');
    const taus = []; let Tt = 0, Ks = 1, Kis = 1, q = 0, osc = false;
    b.forEach(function (x) {
      if (x.t === 'K') { Ks *= x.K; Kis *= x.K; }
      else if (x.t === 'PT1') taus.push(x.T);
      else if (x.t === 'PT2') {
        if (x.D >= 1) { const r = Math.sqrt(x.D * x.D - 1); taus.push((x.D + r) / x.w0); taus.push((x.D - r) / x.w0); }
        else { taus.push(2 * x.D / x.w0); osc = true; }
      }
      else if (x.t === 'I') { q++; Kis *= x.Ki; }
      else if (x.t === 'Tt') Tt += x.Tt;
    });
    taus.sort(function (p, r) { return r - p; });
    let sumT = 0; taus.forEach(function (v) { sumT += v; });
    const Tsum = sumT + Tt, T1 = taus.length ? taus[0] : 0, T2 = taus.length > 1 ? taus[1] : null;
    const out = { ok: true, art: q > 0 ? 'I' : 'P', Ks: q > 0 ? NaN : Ks, Kis: q > 0 ? Kis : NaN, Tsum: Tsum, TsumKlein: Tsum - T1, T1: T1, T2: T2, taus: taus.slice(), Tt: Tt, oszillierend: osc, V0pro1: q > 0 ? NaN : Ks };
    const u = ultimate(b);
    out.Kkrit = u.ok ? u.Kkrit : null; out.Tkrit = u.ok ? u.Tkrit : null; out.ultimateWhy = u.ok ? '' : u.why;
    if (q === 0 && taus.length === 0 && Tt === 0) {
      out.Tu = null; out.Tg = null; out.regelbarkeit = null; out.urteil = '';
      out.fitWhy = 'Die Strecke hat kein Zeitverhalten (nur eine Verstärkung).';
      return out;
    }
    // Sprungantwort mit feinem h
    let span = q > 0 ? 20 * Tsum : 10 * Tsum;
    if (!(span > 0)) span = q > 0 ? 10 : 1;
    let Tmin = Infinity; taus.forEach(function (v) { if (v > 0 && v < Tmin) Tmin = v; }); if (Tt > 0 && Tt < Tmin) Tmin = Tt;
    let h = span / 6000;
    if (isFinite(Tmin)) h = Math.min(h, Tmin / 50);
    h = Math.max(h, span / 150000);
    const sr = stepResponse(b, span, h);
    if (!sr.ok) { out.Tu = null; out.Tg = null; out.fitWhy = sr.why; return out; }
    const f = fitStep(sr.t, sr.x, 1, {});
    if (!f.ok) { out.Tu = null; out.Tg = null; out.regelbarkeit = null; out.urteil = ''; out.fitWhy = f.why; return out; }
    out.Tu = f.Tu; out.Tg = f.Tg; out.TuRaw = f.TuRaw; out.warn = f.warn; out.text = f.text;
    if (f.art === 'I') { out.Kis = f.Kis; out.regelbarkeit = null; out.urteil = ''; }
    else { out.regelbarkeit = f.regelbarkeit; out.urteil = f.urteil; }
    return out;
  }

  /* findCritical(rigFactory, opts): Schwingversuch am Pruefstand (headless). opts: { op:{y}, step (% des Bereichs), kp0, controls } */
  function findCritical(rigFactory, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    function make() {
      if (typeof rigFactory === 'function') return rigFactory();
      if (typeof rigFactory === 'string' && root.REG_RIGS && typeof root.REG_RIGS.create === 'function') return root.REG_RIGS.create(rigFactory, opts.rigOpts);
      return null;
    }
    let rig0 = null;
    try { rig0 = make(); } catch (e) { rig0 = null; }
    const need = ['setControl', 'stepProcess', 'state', 'setOperatingPoint', 'steady'];
    if (!rig0 || need.some(function (m) { return typeof rig0[m] !== 'function'; })) {
      return fail('Der Prüfstand fehlt oder bietet die Schnittstelle für den Schwingversuch nicht an (setControl, stepProcess, state, setOperatingPoint, steady).');
    }
    if (typeof rig0.linBlocks === 'function') {
      const u = ultimate(swallow(function () { return rig0.linBlocks(); }, null));
      if (!u.ok) return fail(u.why);
    }
    const h = pos(rig0.h, 0.01);
    const range = rig0.range && isFinite(rig0.range.hi - rig0.range.lo) ? rig0.range.hi - rig0.range.lo : 100;
    let Tdom = NaN;
    if (typeof rig0.identify === 'function') { const idn = swallow(function () { return rig0.identify(); }, null); if (idn && idn.T1 > 0) Tdom = Math.max(idn.T1, idn.Tkrit > 0 ? idn.Tkrit : 0); }
    if (!(Tdom > 0)) Tdom = 100 * h;
    const L = Math.max(40 * Tdom, 60 * h);
    const yop = isFinite(num(opts.op && opts.op.y, NaN)) ? num(opts.op.y, 50) : 50;
    const stepPct = pos(opts.step, 5);
    function run(kp) {
      const rig = make();
      const ctl = Object.assign({ mode: 'auto', ctrl: 'P', tv: 0, noise: 0 }, opts.controls || {});
      if (typeof rig.setControl !== 'function') return null;
      Object.keys(ctl).forEach(function (k) { swallow(function () { rig.setControl(k, ctl[k]); }, 0); });
      swallow(function () { rig.setControl('u0', yop); }, 0);
      rig.setOperatingPoint(yop);
      // setOperatingPoint stellt auf Hand: danach wieder die gewünschte Betriebsart (Automatik), sonst läuft der Versuch im offenen Kreis.
      swallow(function () { rig.setControl('mode', ctl.mode); }, 0);
      const w0 = rig.steady(yop);
      swallow(function () { rig.setControl('w', w0); rig.setControl('kp', kp); }, 0);
      rig.stepProcess(5 * h);
      swallow(function () { rig.setControl('w', w0 + stepPct / 100 * range); }, 0);
      const N = Math.ceil(L / h), dec = Math.max(1, Math.ceil(N / 4000)), tt = [], xx = [], yy = [];
      for (let i = 0; i < N; i += dec) {
        rig.stepProcess(dec * h);
        const st = rig.state(); tt.push((i + dec) * h); xx.push(st.x); yy.push(st.y);
      }
      return oscillation(tt, xx, { range: range, y: yy, ymin: 0, ymax: num(ctl.ymax, 100) });
    }
    function undamped(o) { return o && o.ok && (o.cls === 'dauerschwingung' || o.cls === 'aufschaukelnd'); }
    let kp = pos(opts.kp0, 0.5), lo = null, hi = null, hiRes = null;
    let r0 = run(kp);
    if (undamped(r0)) {
      hi = kp; hiRes = r0;
      for (let i = 0; i < 8 && lo === null; i++) { kp /= 1.5; const r = run(kp); if (undamped(r)) { hi = kp; hiRes = r; } else lo = kp; }
      if (lo === null) return fail('Der Kreis schwingt schon bei sehr kleinem Kp: Der Schwingversuch ist so nicht auswertbar.');
    } else {
      lo = kp;
      for (let i = 0; i < 12 && hi === null; i++) { kp *= 1.5; const r = run(kp); if (undamped(r)) { hi = kp; hiRes = r; } else lo = kp; }
      if (hi === null) return fail('Bis Kp = ' + fmt(kp) + ' ist keine Dauerschwingung aufgetreten: Die Strecke schwingt nicht oder sehr schwer.');
    }
    for (let i = 0; i < 12; i++) {
      const mid = Math.sqrt(lo * hi), r = run(mid);
      if (undamped(r)) { hi = mid; hiRes = r; } else lo = mid;
    }
    // Das Daempfungskriterium (Verhaeltnis 0,8 je Periode) liegt etwas unter der Stabilitaetsgrenze:
    // aus zwei gedaempften Laeufen wird auf Verhaeltnis 1 extrapoliert.
    const rA = run(lo), kB = lo * 0.9, rB = run(kB);
    let Kkrit = hi;
    if (rA && rB && rA.ratioPeriod > 0 && rB.ratioPeriod > 0 && isFinite(rA.ratioPeriod) && isFinite(rB.ratioPeriod)) {
      const la = Math.log(rA.ratioPeriod), lb = Math.log(rB.ratioPeriod);
      if (la !== lb) {
        const kx = lo + (0 - la) * (kB - lo) / (lb - la);
        if (isFinite(kx) && kx >= lo && kx <= 2 * hi) Kkrit = kx;
      }
    }
    // Die Periodendauer der gedaempften Laeufe wird ebenfalls auf die Stabilitaetsgrenze extrapoliert.
    let per = hiRes && isFinite(hiRes.period) ? hiRes.period : (rA && isFinite(rA.period) ? rA.period : NaN);
    if (rA && rB && isFinite(rA.period) && isFinite(rB.period) && Kkrit !== hi) {
      const pk = rA.period + (Kkrit - lo) * (rA.period - rB.period) / (lo - kB);
      if (isFinite(pk) && pk > 0.5 * rA.period && pk < 1.5 * rA.period) per = pk;
    }
    return { ok: isFinite(per), Kkrit: Kkrit, Tkrit: per, KpGedaempft: lo, KpUngedaempft: hi, why: isFinite(per) ? '' : 'Die Periodendauer konnte nicht bestimmt werden.' };
  }

  /* =====================================================================================================
   *  EINSTELLREGELN (M3): rules.table ist die einzige Quelle (Rechner, Lernen, Heft, Tests lesen sie von hier)
   * ===================================================================================================== */
  function cell(k, of, extra) { const o = { k: k, of: of }; if (extra) for (const key in extra) o[key] = extra[key]; return o; }
  const KG = 'Tg/(Ks·Tu)';
  const TABLE = [
    { id: 'zn-schwing', name: 'Ziegler-Nichols (Schwingversuch)', input: 'schwing', iStrecke: false, rows: {
      P: { Kp: cell(0.5, 'Kkrit'), Tn: null, Tv: null },
      PI: { Kp: cell(0.45, 'Kkrit'), Tn: cell(1 / 1.2, 'Tkrit', { label: 'Tkrit/1,2', alt: [0.83, 0.85] }), Tv: null },
      PID: { Kp: cell(0.6, 'Kkrit'), Tn: cell(0.5, 'Tkrit'), Tv: cell(0.125, 'Tkrit') } } },
    { id: 'zn-sprung', name: 'Ziegler-Nichols (Sprungantwort)', input: 'sprung', iStrecke: true, rows: {
      P: { Kp: cell(1, KG), Tn: null, Tv: null },
      PI: { Kp: cell(0.9, KG), Tn: cell(1 / 0.3, 'Tu', { label: 'Tu/0,3', alt: [3.3, 3.33] }), Tv: null },
      PID: { Kp: cell(1.2, KG), Tn: cell(2, 'Tu'), Tv: cell(0.5, 'Tu') } } },
    { id: 'chr-fuehr-0', name: 'Chien-Hrones-Reswick, Führung aperiodisch', input: 'sprung', iStrecke: true, rows: {
      P: { Kp: cell(0.3, KG), Tn: null, Tv: null },
      PI: { Kp: cell(0.35, KG), Tn: cell(1.2, 'Tg'), Tv: null },
      PID: { Kp: cell(0.6, KG), Tn: cell(1, 'Tg'), Tv: cell(0.5, 'Tu') } } },
    { id: 'chr-fuehr-20', name: 'Chien-Hrones-Reswick, Führung 20 % Überschwingen', input: 'sprung', iStrecke: true, rows: {
      P: { Kp: cell(0.7, KG), Tn: null, Tv: null },
      PI: { Kp: cell(0.6, KG), Tn: cell(1, 'Tg'), Tv: null },
      PID: { Kp: cell(0.95, KG), Tn: cell(1.35, 'Tg', { alt: [1.4] }), Tv: cell(0.47, 'Tu') } } },
    { id: 'chr-stoer-0', name: 'Chien-Hrones-Reswick, Störung aperiodisch', input: 'sprung', iStrecke: true, rows: {
      P: { Kp: cell(0.3, KG), Tn: null, Tv: null },
      PI: { Kp: cell(0.6, KG), Tn: cell(4, 'Tu'), Tv: null },
      PID: { Kp: cell(0.95, KG), Tn: cell(2.4, 'Tu'), Tv: cell(0.42, 'Tu') } } },
    { id: 'chr-stoer-20', name: 'Chien-Hrones-Reswick, Störung 20 % Überschwingen', input: 'sprung', iStrecke: true, rows: {
      P: { Kp: cell(0.7, KG), Tn: null, Tv: null },
      PI: { Kp: cell(0.7, KG), Tn: cell(2.3, 'Tu'), Tv: null },
      PID: { Kp: cell(1.2, KG), Tn: cell(2, 'Tu'), Tv: cell(0.42, 'Tu') } } },
    { id: 'tsumme', name: 'T-Summe (Betragsoptimum, vereinfacht)', input: 'tsumme', iStrecke: false, rows: {
      PI: { Kp: cell(0.5, 'T1/(Ks·TΣk)'), Tn: cell(1, 'T1'), Tv: null },
      PID: { Kp: cell(0.5, "T1/(Ks·TΣk′)"), Tn: cell(1, 'T1'), Tv: cell(1, 'T2') } } }
  ];
  function ruleExpr(c) {
    if (!c) return '–';
    return c.label || (fmt(c.k) + ' · ' + c.of);
  }
  function normKenn(k) {
    k = k && typeof k === 'object' ? k : {};
    const o = {};
    ['Ks', 'Tu', 'Tg', 'Kis', 'Kkrit', 'Tkrit', 'T1', 'T2', 'TsumKlein'].forEach(function (f) { o[f] = num(k[f], NaN); });
    o.art = k.art === 'I' || (!isFinite(o.Ks) && isFinite(o.Kis)) ? 'I' : 'P';
    return o;
  }
  function baseNeeds(of, art) {
    switch (of) {
      case 'Kkrit': return ['Kkrit']; case 'Tkrit': return ['Tkrit']; case 'Tu': return ['Tu']; case 'T1': return ['T1']; case 'T2': return ['T2'];
      case 'Tg': return ['Tg'];
      case KG: return art === 'I' ? ['Kis', 'Tu'] : ['Ks', 'Tu', 'Tg'];
      case 'T1/(Ks·TΣk)': return ['Ks', 'T1', 'TsumKlein'];
      default: return ['Ks', 'T1', 'TsumKlein', 'T2'];
    }
  }
  function baseVal(of, k) {
    switch (of) {
      case 'Kkrit': return k.Kkrit; case 'Tkrit': return k.Tkrit; case 'Tu': return k.Tu; case 'Tg': return k.Tg; case 'T1': return k.T1; case 'T2': return k.T2;
      case KG: return k.art === 'I' ? 1 / (k.Kis * k.Tu) : k.Tg / (Math.abs(k.Ks) * k.Tu);
      case 'T1/(Ks·TΣk)': return k.T1 / (Math.abs(k.Ks) * k.TsumKlein);
      default: return k.T1 / (Math.abs(k.Ks) * (k.TsumKlein - k.T2));
    }
  }
  function baseStep(of, k) {
    switch (of) {
      case KG: return k.art === 'I' ? '1/(Kis·Tu) = 1/(' + fmt(k.Kis) + ' · ' + fmt(k.Tu) + ') = ' + fmt(baseVal(of, k))
        : 'Tg/(Ks·Tu) = ' + fmt(k.Tg) + '/(' + fmt(Math.abs(k.Ks)) + ' · ' + fmt(k.Tu) + ') = ' + fmt(baseVal(of, k));
      case 'T1/(Ks·TΣk)': return 'T1/(Ks·TΣk) = ' + fmt(k.T1) + '/(' + fmt(Math.abs(k.Ks)) + ' · ' + fmt(k.TsumKlein) + ') = ' + fmt(baseVal(of, k));
      case "T1/(Ks·TΣk′)": return "T1/(Ks·TΣk′) = " + fmt(k.T1) + '/(' + fmt(Math.abs(k.Ks)) + ' · (' + fmt(k.TsumKlein) + ' − ' + fmt(k.T2) + ')) = ' + fmt(baseVal(of, k));
      default: return '';
    }
  }
  function ruleMethod(id) { for (let i = 0; i < TABLE.length; i++) if (TABLE[i].id === id) return TABLE[i]; return null; }
  function validity(method, kennwerte) {
    const m = ruleMethod(method);
    if (!m) return fail('Unbekannte Methode „' + method + '“.');
    const k = normKenn(kennwerte), warn = [];
    if (m.id === 'tsumme') {
      let T1 = k.T1, Tk = k.TsumKlein;
      if (!isFinite(T1) && isFinite(k.Tg) && isFinite(k.Tu)) { T1 = k.Tg; Tk = k.Tu; }
      if (T1 > 0 && Tk >= 0 && Tk < 0.02 * T1) warn.push(TXT.tsumArm);
    } else if (m.input === 'sprung' && k.art === 'P' && k.Tu > 0 && k.Tg > 0) {
      const r = k.Tu / k.Tg;
      if (m.id === 'zn-sprung') { if (r > 0.3) warn.push('Tu/Tg = ' + fmt(r) + ': Z-N Sprungantwort ist für Tu/Tg über etwa 0,3 zu scharf eingestellt'); }
      else if (r < 0.1 || r > 1) warn.push('Tu/Tg = ' + fmt(r) + ' liegt außerhalb von 0,1 bis 1: Die CHR-Regeln gelten dafür nicht.');
    }
    return { ok: true, warn: warn };
  }
  /* rules.apply(method, kennwerte, type): Kp, Tn, Tv, Xp mit Rechenweg. Tn = null: kein I-Anteil. */
  function rulesApply(method, kennwerte, type) {
    const m = ruleMethod(method);
    if (!m) return fail('Unbekannte Methode „' + method + '“.');
    const row = m.rows[type];
    if (!row) return fail('Für diese Methode gibt es keinen ' + type + '-Regler (die Tabelle kennt ' + Object.keys(m.rows).join(', ') + ').');
    const k = normKenn(kennwerte);
    if (m.id === 'tsumme') {
      if (k.art === 'I') return fail(TXT.tsumNurP);
      if (!isFinite(k.T1) && isFinite(k.Tg) && isFinite(k.Tu)) { k.T1 = k.Tg; k.TsumKlein = k.Tu; }
      if (type === 'PID' && !(k.T2 > 0)) return fail('Für den PID-Regler braucht die T-Summen-Regel mindestens zwei Zeitkonstanten (T1 und T2).');
      if (!isFinite(k.Ks) && isFinite(num(kennwerte && kennwerte.Ks, NaN))) k.Ks = num(kennwerte.Ks, NaN);
    }
    const names = ['Kp', 'Tn', 'Tv'], missing = [], iFail = [];
    names.forEach(function (nm) {
      const c = row[nm]; if (!c) return;
      if (k.art === 'I' && c.of === 'Tg') { iFail.push(nm); return; }
      baseNeeds(c.of, k.art).forEach(function (f) { if (!(num(k[f], NaN) > 0 || (f === 'Ks' && Math.abs(k.Ks) > 0)) && missing.indexOf(f) < 0) missing.push(f); });
    });
    if (iFail.length) return fail(TXT.iKeinTg);
    if (missing.length) return fail('Für diese Methode fehlen gültige Kennwerte (größer 0): ' + missing.join(', ') + '.');
    if (m.id === 'tsumme' && type === 'PID' && !(k.TsumKlein - k.T2 > 0)) {
      // keine kleinen Zeitkonstanten ausser T2: Verstaerkung nicht berechenbar -> begrenzt
    }
    const steps = [], out = { ok: true, Kp: NaN, Tn: null, Tv: null, Xp: NaN, warn: [], steps: steps, limited: false, method: m.id, type: type };
    const v = validity(m.id, kennwerte); if (v.ok) out.warn = v.warn.slice();
    const done = {};
    names.forEach(function (nm) {
      const c = row[nm]; if (!c) return;
      let bv;
      if (m.id === 'tsumme' && c.of === "T1/(Ks·TΣk′)" && !(k.TsumKlein - k.T2 > 0)) { bv = Infinity; }
      else bv = baseVal(c.of, k);
      if (!done[c.of]) { done[c.of] = 1; const bs = baseStep(c.of, k); if (bs && isFinite(bv)) steps.push(bs); }
      let val = c.k * bv;
      if (nm === 'Kp' && m.id === 'tsumme' && (!isFinite(val) || val > 100)) { val = 100; out.limited = true; if (out.warn.indexOf(TXT.tsumArm) < 0) out.warn.push(TXT.tsumArm); }
      out[nm] = val;
      const unit = nm === 'Kp' ? '' : ' s';
      steps.push(nm + ' = ' + ruleExpr(c) + ' = ' + fmt(c.k) + ' · ' + fmt(bv) + ' = ' + fmt(val) + unit + (nm === 'Kp' && out.limited ? ' (auf 100 begrenzt)' : ''));
    });
    out.Xp = 100 / out.Kp;
    steps.push('Xp = 100 / Kp = 100 / ' + fmt(out.Kp) + ' = ' + fmt(out.Xp) + ' %');
    if (!row.Tn) steps.push('Kein I-Anteil: Tn entfällt (Regler ' + type + ').');
    return out;
  }
  const rules = {
    table: TABLE,
    methods: TABLE.map(function (m) { return { id: m.id, name: m.name, input: m.input, types: Object.keys(m.rows) }; }),
    apply: S(rulesApply), validity: S(validity), expr: function (c) { try { return ruleExpr(c); } catch (e) { return '–'; } }
  };

  /* =====================================================================================================
   *  FORMELN, SKALIERUNG, ZWEIPUNKT (M3)
   * ===================================================================================================== */
  const formulas = {};
  const FORDER = [];
  function def(id, name, symbol, expr, unit, args, tpl, fn) {
    const f = {
      id: id, name: name, symbol: symbol, expr: expr, unit: unit, args: args, tpl: tpl,
      fn: C(fn),
      explain: function () {
        try {
          const a = Array.prototype.slice.call(arguments).map(function (v) { return num(v, NaN); });
          const value = fn.apply(null, a);
          const sub = tpl.replace(/\{(\d)\}/g, function (_, i) { return fmt(a[+i]); });
          return { ok: isFinite(value), value: value, unit: unit, steps: isFinite(value) ? [expr, sub, '= ' + fmt(value) + (unit ? ' ' + unit : '')] : [expr, 'Mit diesen Werten ist die Formel nicht definiert.'] };
        } catch (e) { return { ok: false, value: NaN, unit: unit, steps: [expr, 'Mit diesen Werten ist die Formel nicht definiert.'] }; }
      }
    };
    formulas[id] = f; FORDER.push(id);
  }
  function fin(v) { return isFinite(v) ? v : NaN; }
  def('xp', 'Proportionalbereich', 'Xp', 'Xp = 100 % / Kp', '%', ['Kp'], '100 / {0}', function (Kp) { return Kp > 0 ? 100 / Kp : NaN; });
  def('kp', 'Reglerverstärkung', 'Kp', 'Kp = 100 % / Xp', '', ['Xp [%]'], '100 / {0}', function (Xp) { return Xp > 0 ? 100 / Xp : NaN; });
  def('v0', 'Kreisverstärkung', 'V0', 'V0 = Kp · Ks', '', ['Kp', 'Ks'], '{0} · {1}', function (Kp, Ks) { return fin(Kp * Ks); });
  def('eblP', 'Bleibende Regelabweichung (P-Regler, Strecke mit Ausgleich)', 'e_bl', 'e_bl = w / (1 + V0)', '%', ['w [%]', 'V0'], '{0} / (1 + {1})', function (w, V0) { return 1 + V0 !== 0 ? fin(w / (1 + V0)) : NaN; });
  def('tclP1', 'Zeitkonstante des geschlossenen Kreises (P-Regler an PT1)', 'T_cl', 'T_cl = T / (1 + V0)', 's', ['T [s]', 'V0'], '{0} / (1 + {1})', function (T, V0) { return 1 + V0 > 0 ? fin(T / (1 + V0)) : NaN; });
  def('piStep', 'Sprungantwort des PI-Reglers', 'y(t)', 'y(t) = Kp · e · (1 + t / Tn)', '%', ['Kp', 'e [%]', 'Tn [s]', 't [s]'], '{0} · {1} · (1 + {3} / {2})', function (Kp, e, Tn, t) { return Tn > 0 ? fin(Kp * e * (1 + t / Tn)) : NaN; });
  def('pdStep', 'Sprungantwort des PD-Reglers (mit Filter N = 10)', 'y(t)', 'y(t) = Kp · e · (1 + N · e^(−t / Tf)), Tf = Tv / N', '%', ['Kp', 'e [%]', 'Tv [s]', 't [s]'], '{0} · {1} · (1 + 10 · e^(−{3} / ({2} / 10)))', function (Kp, e, Tv, t) { return Tv > 0 ? fin(Kp * e * (1 + 10 * Math.exp(-t / (Tv / 10)))) : NaN; });
  def('tnLesen', 'Nachstellzeit aus der PI-Sprungantwort', 'Tn', 'Tn = t · y0 / (y(t) − y0)', 's', ['t [s]', 'y(t) [%]', 'y0 [%]'], '{0} · {2} / ({1} − {2})', function (t, yt, y0) { return yt !== y0 ? fin(t * y0 / (yt - y0)) : NaN; });
  def('ks', 'Streckenverstärkung', 'Ks', 'Ks = Δx / Δy', '', ['Δx [%]', 'Δy [%]'], '{0} / {1}', function (dx, dy) { return dy !== 0 ? fin(dx / dy) : NaN; });
  def('regelbarkeit', 'Regelbarkeit', 'Tg/Tu', 'Tg / Tu', '', ['Tg [s]', 'Tu [s]'], '{0} / {1}', function (Tg, Tu) { return Tu > 0 ? fin(Tg / Tu) : NaN; });
  def('kkrit', 'Kritische Verstärkung (drei PT1 in Reihe)', 'Kkrit', 'Kkrit = (T1+T2)(T2+T3)(T1+T3) / (T1·T2·T3 · Ks)', '', ['Ks', 'T1 [s]', 'T2 [s]', 'T3 [s]'], '({1}+{2})·({2}+{3})·({1}+{3}) / ({1}·{2}·{3}·{0})', function (Ks, T1, T2, T3) {
    if (!(Ks > 0 && T1 > 0 && T2 > 0 && T3 > 0)) return NaN;
    return (T1 + T2) * (T2 + T3) * (T1 + T3) / (T1 * T2 * T3) / Ks;
  });
  def('twoPointPeriod', 'Periodendauer des Zweipunktreglers (ohne Fühlerverzögerung)', 'T', 'T = t_ein + t_aus', 's', ['Ph [W]', 'R [K/W]', 'C [J/K]', 'ϑa [°C]', 'w [°C]', 'Δ [K]'], 'siehe twoPoint.period', function (Ph, R, C_, ta, w, d) { const r = twoPointPeriod({ Ph: Ph, R: R, C: C_, thetaA: ta, w: w, hyst: d }); return r.ok ? r.T : NaN; });
  def('ed', 'Einschaltdauer', 'ED', 'ED = t_ein / (t_ein + t_aus) · 100 %', '%', ['t_ein [s]', 't_aus [s]'], '{0} / ({0} + {1}) · 100', function (a, b) { return a + b > 0 ? fin(a / (a + b) * 100) : NaN; });
  def('schaltfreq', 'Schaltspiele je Stunde', 'f', 'f = 3600 s / T', '1/h', ['T [s]'], '3600 / {0}', function (T) { return T > 0 ? 3600 / T : NaN; });
  def('qFuell', 'Zeitkonstante des Tanks im Arbeitspunkt (Düse)', 'T', 'T = 2 · A · √h0 / c', 's', ['A [m²]', 'h0 [m]', 'c [m^2,5/s]'], '2 · {0} · √{1} / {2}', function (A, h0, c) { return A > 0 && h0 >= 0 && c > 0 ? 2 * A * Math.sqrt(h0) / c : NaN; });
  def('heizbedarf', 'Heizbedarf', 'P_ben', 'P_ben = UA · (w − ϑa) − Pz', 'W', ['UA [W/K]', 'w [°C]', 'ϑa [°C]', 'Pz [W]'], '{0} · ({1} − {2}) − {3}', function (UA, w, ta, Pz) { return fin(UA * (w - ta) - (isFinite(Pz) ? Pz : 0)); });
  def('skal', 'Skalierung Rohwert in Messgröße', 'x', 'x = lo + Rohwert / 27648 · (hi − lo)', '', ['Rohwert', 'lo', 'hi'], '{1} + {0} / 27648 · ({2} − {1})', function (raw, lo, hi) { return fin(lo + raw / 27648 * (hi - lo)); });
  def('maProzent', 'Normsignal 4…20 mA in Prozent', 'p', 'p = (I − 4 mA) / 16 mA · 100 %', '%', ['I [mA]'], '({0} − 4) / 16 · 100', function (mA) { return fin((mA - 4) / 16 * 100); });
  def('abtastVerlust', 'Phasenverlust durch Abtast-Halteglied', 'Δφ', 'Δφ = ωD · Ta / 2 · 180° / π', '°', ['ωD [rad/s]', 'Ta [s]'], '{0} · {1} / 2 · 180 / π', function (wD, Ta) { return wD >= 0 && Ta >= 0 ? fin(wD * Ta / 2 * 180 / Math.PI) : NaN; });
  formulas.list = function () { return FORDER.map(function (id) { return formulas[id]; }); };

  const RAWMAX = 27648;
  const scale = {
    rawToPct: C(function (raw, rawMax) { rawMax = pos(rawMax, RAWMAX); raw = num(raw, NaN); return 100 * raw / rawMax; }),
    rawToEng: C(function (raw, lo, hi, rawMax) { rawMax = pos(rawMax, RAWMAX); raw = num(raw, NaN); lo = num(lo, NaN); hi = num(hi, NaN); return lo + raw / rawMax * (hi - lo); }),
    pctToRaw: C(function (p, rawMax) { rawMax = pos(rawMax, RAWMAX); p = num(p, NaN); return p / 100 * rawMax; }),
    pctToMa: C(function (p) { p = num(p, NaN); return 4 + 16 * p / 100; }),
    maToPct: C(function (mA) { mA = num(mA, NaN); return (mA - 4) / 16 * 100; }),
    /* rawInfo/maInfo melden Ueber- und Untersteuerung, statt still zu klemmen (A11) */
    rawInfo: S(function (raw, rawMax) {
      raw = num(raw, NaN); rawMax = pos(rawMax, RAWMAX);
      if (!isFinite(raw)) return fail('Der Rohwert ist keine Zahl.');
      const o = { ok: true, pct: 100 * raw / rawMax, over: raw > rawMax, under: raw < 0, fault: null, text: '' };
      if (o.over) o.text = TXT.uebersteuerung;
      if (o.under) o.text = TXT.untersteuerung;
      if (raw > 32511 && rawMax === RAWMAX) { o.fault = 'ueberlauf'; o.text = TXT.ueberlaufRoh; }
      return o;
    }),
    maInfo: S(function (mA) {
      mA = num(mA, NaN);
      if (!isFinite(mA)) return fail('Der Stromwert ist keine Zahl.');
      const o = { ok: true, pct: (mA - 4) / 16 * 100, over: mA > 20, under: mA < 4, fault: null, text: '' };
      if (o.over) o.text = TXT.uebersteuerung;
      if (o.under) o.text = TXT.untersteuerung;
      if (mA < 3.6) { o.fault = 'drahtbruch'; o.text = TXT.drahtbruch; }
      return o;
    })
  };

  /* twoPoint.period({ Ph, R, C, thetaA, w, hyst, Pz }): Schaltspiel ohne Fuehlerverzoegerung (Heizen; negatives Ph = Kuehlen) */
  function twoPointPeriod(o) {
    o = o && typeof o === 'object' ? o : {};
    const Ph = num(o.Ph, NaN), R = num(o.R, NaN), Cc = num(o.C, NaN), ta = num(o.thetaA, NaN), w = num(o.w, NaN), hy = num(o.hyst, NaN), Pz = num(o.Pz, 0);
    if (!isFinite(Ph) || !(R > 0) || !(Cc > 0) || !isFinite(ta) || !isFinite(w) || !(hy > 0)) return fail('Die Eingaben sind unvollständig oder ungültig (Ph, R > 0, C > 0, ϑa, w, Δ > 0).');
    const tau = R * Cc, to = w + hy / 2, tu = w - hy / 2;
    const tOn = ta + (Ph + Pz) * R, tOff = ta + Pz * R;
    let tEin, tAus;
    if (tOn > tOff) { // Heizen
      if (tOn <= to) return fail(TXT.heizArm);
      if (tu <= tOff) return fail(TXT.abkuehlNie);
      tEin = tau * Math.log((tOn - tu) / (tOn - to));
      tAus = tau * Math.log((to - tOff) / (tu - tOff));
    } else { // Kuehlen: Einschalten bei oberer Schwelle, Ausschalten an der unteren
      if (tOn >= tu) return fail(TXT.kuehlArm);
      if (tOff <= to) return fail(TXT.erwaermNie);
      tEin = tau * Math.log((to - tOn) / (tu - tOn));
      tAus = tau * Math.log((tOff - tu) / (tOff - to));
    }
    const T = tEin + tAus;
    return { ok: true, mode: tOn > tOff ? 'heizen' : 'kuehlen', tEin: tEin, tAus: tAus, T: T, ED: tEin / T * 100, f: 1 / T, fPerH: 3600 / T, swing: hy, thetaO: to, thetaU: tu, tau: tau, thetaInf: tOn };
  }
  const twoPoint = { period: S(twoPointPeriod) };

  /* =====================================================================================================
   *  UEBUNGEN (M3)
   * ===================================================================================================== */
  function exercise(kind, seed) {
    const KINDS = exercise.kinds;
    if (KINDS.indexOf(kind) < 0) return fail('Unbekannte Übungsart „' + kind + '“. Erlaubt: ' + KINDS.join(', ') + '.');
    const sd = isFinite(num(seed, NaN)) ? Math.floor(num(seed, 1)) : 1;
    const R = rng(sd * 7919 + KINDS.indexOf(kind) * 104729 + 13);
    function pick(a) { return a[Math.floor(R.next() * a.length) % a.length]; }
    const KPS = [0.5, 1, 2, 2.5, 4, 5, 10], KSS = [0.5, 1, 1.5, 2, 2.5, 4];
    let q = '', given = {}, ans, steps = [], wrong = [];
    function F(id) { return formulas[id]; }
    function ex(value, unit, tol, alt, extra) { ans = Object.assign({ value: value, unit: unit, tol: tol, alt: alt || [] }, extra || {}); }
    function addWrong(v, text) { if (isFinite(v) && ans && Math.abs(v - ans.value) > 0.06 * Math.abs(ans.value) + 1e-12) wrong.push({ v: v, text: text }); }
    function uText(u) { return u ? ' ' + u : ''; }
    let lowHint = '', highHint = '', slip = [];
    switch (kind) {
      case 'xp': {
        const Kp = pick(KPS), Xp = 100 / Kp;
        if (R.next() < 0.5) {
          given = { Kp: Kp }; q = 'Ein P-Regler hat die Verstärkung Kp = ' + fmt(Kp) + '. Berechne den Proportionalbereich Xp in %.';
          ex(F('xp').fn(Kp), '%', 0.03); steps = F('xp').explain(Kp).steps; addWrong(Kp, 'Du hast Kp abgeschrieben. Der Proportionalbereich ist der Kehrwert: Xp = 100 / Kp.');
          lowHint = 'Prüfe: Xp = 100 % / Kp.'; highHint = 'Prüfe: Xp = 100 % / Kp.';
        } else {
          given = { Xp: Xp }; q = 'Ein P-Regler hat den Proportionalbereich Xp = ' + fmt(Xp) + ' %. Berechne die Verstärkung Kp.';
          ex(F('kp').fn(Xp), '', 0.03); steps = F('kp').explain(Xp).steps; addWrong(Xp, 'Du hast Xp abgeschrieben. Die Verstärkung ist der Kehrwert: Kp = 100 / Xp.');
          lowHint = 'Prüfe: Kp = 100 % / Xp.'; highHint = 'Prüfe: Kp = 100 % / Xp.';
        }
        break;
      }
      case 'v0': {
        const Kp = pick(KPS), Ks = pick(KSS);
        given = { Kp: Kp, Ks: Ks }; q = 'Ein Regler mit Kp = ' + fmt(Kp) + ' arbeitet an einer Strecke mit Ks = ' + fmt(Ks) + '. Berechne die Kreisverstärkung V0.';
        ex(F('v0').fn(Kp, Ks), '', 0.03); steps = F('v0').explain(Kp, Ks).steps;
        addWrong(Kp + Ks, 'Du hast addiert. Die Kreisverstärkung ist das Produkt: V0 = Kp · Ks.');
        lowHint = 'Prüfe: V0 = Kp · Ks.'; highHint = 'Prüfe: V0 = Kp · Ks.';
        break;
      }
      case 'ebl': {
        const w = pick([20, 40, 50, 60, 80]), Kp = pick(KPS), Ks = pick(KSS), V0 = Kp * Ks;
        given = { w: w, Kp: Kp, Ks: Ks, V0: V0 };
        q = 'Eine Strecke mit Ausgleich (Ks = ' + fmt(Ks) + ') wird mit einem P-Regler (Kp = ' + fmt(Kp) + ') geregelt. Die Stellgröße hat keinen Grundwert (u0 = 0), der Sollwert ist w = ' + fmt(w) + ' % und die Störung ist 0. Berechne die bleibende Regelabweichung e_bl in %.';
        ex(F('eblP').fn(w, V0), '%', 0.03);
        steps = [F('v0').explain(Kp, Ks).steps.join(' ')].concat(F('eblP').explain(w, V0).steps);
        addWrong(w / V0, 'Du hast durch V0 geteilt. Richtig ist e_bl = w / (1 + V0).');
        addWrong(w * V0 / (1 + V0), 'Das ist der Istwert x. Die bleibende Regelabweichung ist e = w − x.');
        lowHint = 'Prüfe: e_bl = w / (1 + V0) mit V0 = Kp · Ks.'; highHint = lowHint;
        break;
      }
      case 'piStep': {
        const Kp = pick([1, 2, 2.5, 4, 5]), Tn = pick([5, 10, 20, 40, 60]), e = pick([2, 5, 10]);
        const t = pick(Tn % 10 === 0 ? [Tn / 2, Tn, 2 * Tn] : [Tn, 2 * Tn]);
        given = { Kp: Kp, Tn: Tn, e: e, t: t };
        q = 'Ein PI-Regler (Kp = ' + fmt(Kp) + ', Tn = ' + fmt(Tn) + ' s) bekommt einen Sprung der Regeldifferenz auf e = ' + fmt(e) + ' % (Grundwert u0 = 0). Berechne die Stellgröße y nach t = ' + fmt(t) + ' s in %.';
        ex(F('piStep').fn(Kp, e, Tn, t), '%', 0.03); steps = F('piStep').explain(Kp, e, Tn, t).steps;
        addWrong(Kp * e, 'Du hast nur den P-Anteil gerechnet. Der I-Anteil Kp · e · t / Tn kommt dazu.');
        addWrong(Kp * e * t / Tn, 'Das ist nur der I-Anteil. Der P-Anteil Kp · e kommt dazu.');
        lowHint = 'Prüfe: y = Kp · e · (1 + t / Tn).'; highHint = lowHint;
        break;
      }
      case 'tnLesen': {
        const Kp = pick([2, 4]), e = pick([5, 10]), Tn = pick([10, 20, 30, 60]), y0 = Kp * e, t = pick([Tn, 2 * Tn]), yt = y0 * (1 + t / Tn);
        given = { y0: y0, t: t, yt: yt };
        q = 'Ein PI-Regler bekommt einen Sprung der Regeldifferenz. Die Stellgröße springt sofort auf ' + fmt(y0) + ' % und steigt dann linear. Nach ' + fmt(t) + ' s liest du ' + fmt(yt) + ' % ab. Berechne die Nachstellzeit Tn in s.';
        ex(F('tnLesen').fn(t, yt, y0), 's', 0.05); steps = F('tnLesen').explain(t, yt, y0).steps;
        addWrong(t, 'Das ist die Ablesezeit, nicht Tn. Tn ist die Zeit, in der der I-Anteil so groß wie der P-Anteil geworden ist.');
        slip = [60]; lowHint = 'Prüfe: Tn = t · y0 / (y(t) − y0).'; highHint = lowHint;
        break;
      }
      case 'ks': {
        const dy = pick([10, 20]), Ks = pick([0.5, 0.8, 1, 1.5, 2, 2.5]), dx = Ks * dy;
        given = { dx: dx, dy: dy };
        q = 'Du änderst die Stellgröße im Handbetrieb um ' + fmt(dy) + ' %. Die Regelgröße ändert sich im Beharrungszustand um ' + fmt(dx) + ' %. Berechne die Streckenverstärkung Ks.';
        ex(F('ks').fn(dx, dy), '', 0.03); steps = F('ks').explain(dx, dy).steps;
        addWrong(dy / dx, 'Du hast den Kehrwert gebildet. Ks = Δx / Δy (Wirkung durch Ursache).');
        lowHint = 'Prüfe: Ks = Δx / Δy.'; highHint = lowHint;
        break;
      }
      case 'regelbarkeit': {
        const Tu = pick([5, 6, 10, 12, 15, 20, 30]), Tg = pick([60, 90, 120, 150, 180, 240]);
        given = { Tu: Tu, Tg: Tg };
        q = 'An der Wendetangente der Sprungantwort liest du die Verzugszeit Tu = ' + fmt(Tu) + ' s und die Ausgleichszeit Tg = ' + fmt(Tg) + ' s ab. Berechne die Regelbarkeit Tg/Tu.';
        const r = F('regelbarkeit').fn(Tg, Tu);
        ex(r, '', 0.03); steps = F('regelbarkeit').explain(Tg, Tu).steps.concat(['Urteil: ' + regelUrteil(r)]);
        ans.verdict = regelUrteil(r);
        addWrong(Tu / Tg, 'Du hast den Kehrwert gebildet. Die Regelbarkeit ist Tg / Tu.');
        lowHint = 'Prüfe: Regelbarkeit = Tg / Tu.'; highHint = lowHint;
        break;
      }
      case 'znSchwing': {
        const Kkrit = pick([4, 5, 8, 10, 12, 20]), Tkrit = pick([10, 20, 30, 40, 60]), type = pick(['P', 'PI', 'PID']);
        const which = pick(type === 'P' ? ['Kp'] : (type === 'PI' ? ['Kp', 'Tn'] : ['Kp', 'Tn', 'Tv']));
        const r = rulesApply('zn-schwing', { Kkrit: Kkrit, Tkrit: Tkrit }, type), c = ruleMethod('zn-schwing').rows[type][which];
        const base = which === 'Kp' ? Kkrit : Tkrit;
        given = { Kkrit: Kkrit, Tkrit: Tkrit, type: type, which: which };
        q = 'Im Schwingversuch schwingt der Regelkreis mit einem P-Regler bei Kkrit = ' + fmt(Kkrit) + ' dauernd mit der Periodendauer Tkrit = ' + fmt(Tkrit) + ' s. Berechne nach Ziegler-Nichols für einen ' + type + '-Regler ' + (which === 'Kp' ? 'die Verstärkung Kp' : (which === 'Tn' ? 'die Nachstellzeit Tn in s' : 'die Vorhaltzeit Tv in s')) + '.';
        ex(r[which], which === 'Kp' ? '' : 's', 0.03, (c.alt || []).map(function (a) { return a * base; })); steps = r.steps;
        if (which === 'Kp' && type !== 'P') addWrong(0.5 * Kkrit, 'Das ist der Faktor für den P-Regler. Für ' + type + ' gilt ' + ruleExpr(c) + '.');
        if (which !== 'Kp') addWrong(base, 'Das ist der Bezugswert ' + (which === 'Tn' ? 'Tkrit' : 'Tkrit') + ' ohne Faktor. Multipliziere mit dem Faktor aus der Tabelle (' + ruleExpr(c) + ').');
        slip = which === 'Kp' ? [] : [60]; lowHint = 'Prüfe den Faktor der Tabelle: ' + ruleExpr(c) + '.'; highHint = lowHint;
        break;
      }
      case 'znSprung': case 'chr': {
        const Ks = pick([1, 1.5, 2, 2.5, 4]), Tu = pick([5, 10, 15, 20, 30]), Tg = Tu * pick([4, 6, 8, 10]);
        const mid = kind === 'znSprung' ? 'zn-sprung' : pick(['chr-fuehr-0', 'chr-fuehr-20', 'chr-stoer-0', 'chr-stoer-20']);
        const type = pick(['PI', 'PID']);
        const which = pick(type === 'PI' ? ['Kp', 'Tn'] : ['Kp', 'Tn', 'Tv']);
        const r = rulesApply(mid, { Ks: Ks, Tu: Tu, Tg: Tg }, type), c = ruleMethod(mid).rows[type][which];
        const base = c.of === 'Tu' ? Tu : (c.of === 'Tg' ? Tg : null);
        given = { Ks: Ks, Tu: Tu, Tg: Tg, type: type, which: which, method: mid };
        q = 'Eine Strecke hat Ks = ' + fmt(Ks) + ', Tu = ' + fmt(Tu) + ' s und Tg = ' + fmt(Tg) + ' s. Berechne nach ' + ruleMethod(mid).name + ' für einen ' + type + '-Regler ' + (which === 'Kp' ? 'die Verstärkung Kp' : (which === 'Tn' ? 'die Nachstellzeit Tn in s' : 'die Vorhaltzeit Tv in s')) + '.';
        ex(r[which], which === 'Kp' ? '' : 's', 0.03, base === null ? [] : (c.alt || []).map(function (a) { return a * base; })); steps = r.steps;
        if (which === 'Kp') addWrong(Tg / Tu, 'Du hast Ks vergessen. Der Bezugswert ist Tg / (Ks · Tu).');
        slip = which === 'Kp' ? [] : [60]; lowHint = 'Prüfe den Faktor der Tabelle: ' + ruleExpr(c) + '.'; highHint = lowHint;
        break;
      }
      case 'tsumme': {
        const Ks = pick([1, 2, 2.5, 4]), T1 = pick([20, 30, 40, 60]), a = pick([1, 2, 3, 5]), b = pick([1, 2, 3]);
        const which = pick(['Kp', 'Tn']);
        const r = rulesApply('tsumme', { Ks: Ks, T1: T1, TsumKlein: a + b }, 'PI');
        given = { Ks: Ks, T1: T1, small: [a, b], which: which };
        q = 'Eine Strecke mit Ausgleich hat Ks = ' + fmt(Ks) + ' und die Zeitkonstanten T1 = ' + fmt(T1) + ' s, ' + fmt(a) + ' s und ' + fmt(b) + ' s. Berechne nach der T-Summen-Regel (Betragsoptimum) für einen PI-Regler ' + (which === 'Kp' ? 'die Verstärkung Kp' : 'die Nachstellzeit Tn in s') + '.';
        ex(r[which], which === 'Kp' ? '' : 's', 0.03); steps = r.steps;
        if (which === 'Kp') addWrong(T1 / (2 * Ks * a), 'Zu den kleinen Zeitkonstanten zählen alle außer T1: TΣk = ' + fmt(a) + ' s + ' + fmt(b) + ' s.');
        slip = which === 'Kp' ? [] : [60]; lowHint = 'Prüfe: Kp = T1 / (2 · Ks · TΣk), Tn = T1.'; highHint = lowHint;
        break;
      }
      case 'stabil': {
        const phi = pick([-10, 10, 20, 30, 45, 60]), AR = pick([-6, -3, 3, 6, 10, 12]);
        const stable = phi > 0 && AR > 0, f = Math.pow(10, AR / 20);
        given = { phiR: phi, AR: AR, stable: stable };
        q = 'Ein Regelkreis hat die Phasenreserve φR = ' + fmt(phi) + '° und die Amplitudenreserve AR = ' + fmt(AR) + ' dB. Mit welchem Faktor musst du Kp multiplizieren, damit die Amplitudenreserve genau 0 dB wird? (Faktor über 1: Kp darf größer werden, Faktor unter 1: Kp muss kleiner werden.)';
        ex(f, '', 0.03, [], { verdict: stable ? 'stabil' : 'instabil' });
        steps = [stable ? 'Urteil: φR und AR sind positiv, der Kreis ist stabil.' : 'Urteil: Mindestens eine Reserve ist negativ, der Kreis ist instabil.', 'Faktor = 10^(AR/20) = 10^(' + fmt(AR) + '/20) = ' + fmt(f)];
        addWrong(AR, 'Das ist die Reserve in dB. Rechne in einen Faktor um: 10^(AR/20).');
        addWrong(Math.pow(10, AR / 10), 'Bei Amplituden gilt 20 · log10, nicht 10 · log10: Faktor = 10^(AR/20).');
        lowHint = 'Prüfe: Faktor = 10^(AR/20).'; highHint = lowHint;
        break;
      }
      case 'routh': {
        let a2, a1, a0;
        do { a2 = pick([2, 3, 4, 5, 6]); a1 = pick([3, 4, 5, 6, 8, 10]); a0 = pick([1, 2, 5, 10, 20, 30]); } while (Math.abs(a2 * a1 - a0) < 1);
        const rr = routh([1, a2, a1, a0]), b1 = rr.firstColumn[2];
        given = { a3: 1, a2: a2, a1: a1, a0: a0 };
        q = 'Ein Regelkreis hat die charakteristische Gleichung s³ + ' + fmt(a2) + ' s² + ' + fmt(a1) + ' s + ' + fmt(a0) + ' = 0. Berechne das erste Element der Zeile s¹ im Routh-Schema (a2 · a1 − a3 · a0) / a2.';
        ex(b1, '', 0.03, [], { verdict: rr.stable ? 'stabil' : 'instabil' });
        steps = ['b1 = (a2 · a1 − a3 · a0) / a2 = (' + fmt(a2) + ' · ' + fmt(a1) + ' − 1 · ' + fmt(a0) + ') / ' + fmt(a2) + ' = ' + fmt(b1), rr.text];
        addWrong(a2 * a1 - a0, 'Du hast nicht durch a2 geteilt: b1 = (a2 · a1 − a3 · a0) / a2.');
        lowHint = 'Prüfe: b1 = (a2 · a1 − a3 · a0) / a2.'; highHint = lowHint;
        break;
      }
      case 'skalierung': {
        const sc = pick([[0, 100, '°C'], [0, 10, 'bar'], [0, 200, '°C'], [0, 6, 'm'], [-50, 150, '°C']]), kk = pick([1, 2, 3, 4, 5, 6, 7]);
        const lo = sc[0], hi = sc[1], un = sc[2], raw = kk * RAWMAX / 8, eng = lo + kk / 8 * (hi - lo);
        if (R.next() < 0.5) {
          given = { raw: raw, lo: lo, hi: hi, unit: un };
          q = 'Ein Analogeingang liefert den Rohwert ' + fmt(raw) + ' (Messbereich ' + fmt(lo) + ' bis ' + fmt(hi) + ' ' + un + ', 27648 entspricht 100 %). Berechne den Messwert in ' + un + '.';
          ex(F('skal').fn(raw, lo, hi), un, 0.03); steps = F('skal').explain(raw, lo, hi).steps;
          addWrong(raw / RAWMAX * 100, 'Das ist der Wert in Prozent. Rechne ihn noch auf den Messbereich um.');
          addWrong(lo + raw / 32767 * (hi - lo), 'Der Rohwert 27648 entspricht 100 %, nicht 32767.');
        } else {
          given = { eng: eng, lo: lo, hi: hi, unit: un };
          q = 'Ein Messwert von ' + fmt(eng) + ' ' + un + ' (Messbereich ' + fmt(lo) + ' bis ' + fmt(hi) + ' ' + un + ') soll als Rohwert an die Steuerung gehen (27648 entspricht 100 %). Berechne den Rohwert.';
          const p = norm.toPct(eng, lo, hi);
          ex(scale.pctToRaw(p), '', 0.03); steps = ['p = (x − lo) / (hi − lo) · 100 % = (' + fmt(eng) + ' − ' + fmt(lo) + ') / (' + fmt(hi) + ' − ' + fmt(lo) + ') · 100 % = ' + fmt(p) + ' %', 'Rohwert = p / 100 % · 27648 = ' + fmt(p) + ' / 100 · 27648 = ' + fmt(ans.value)];
          addWrong(p, 'Das ist der Wert in Prozent. Multipliziere mit 27648 / 100.');
        }
        lowHint = 'Prüfe: 0 % entspricht 0, 100 % entspricht 27648.'; highHint = lowHint;
        break;
      }
      case 'maProzent': {
        if (R.next() < 0.5) {
          const mA = pick([6, 8, 10, 12, 14, 16, 18, 20]);
          given = { mA: mA }; q = 'Ein Messumformer liefert ' + fmt(mA) + ' mA (Normsignal 4 bis 20 mA). Berechne den Messwert in % des Messbereichs.';
          ex(F('maProzent').fn(mA), '%', 0.03); steps = F('maProzent').explain(mA).steps;
          addWrong(mA / 20 * 100, 'Das Normsignal beginnt bei 4 mA (Live-Zero), nicht bei 0 mA: p = (I − 4 mA) / 16 mA · 100 %.');
        } else {
          const p = pick([10, 25, 50, 60, 75, 90]);
          given = { p: p }; q = 'Ein Stellsignal von ' + fmt(p) + ' % soll als Normsignal 4 bis 20 mA ausgegeben werden. Berechne den Strom in mA.';
          ex(scale.pctToMa(p), 'mA', 0.03); steps = ['I = 4 mA + 16 mA · p / 100 % = 4 + 16 · ' + fmt(p) + ' / 100 = ' + fmt(ans.value) + ' mA'];
          addWrong(20 * p / 100, 'Bei 0 % fließen schon 4 mA (Live-Zero): I = 4 mA + 16 mA · p / 100 %.');
        }
        lowHint = 'Prüfe: 0 % sind 4 mA und 100 % sind 20 mA.'; highHint = lowHint;
        break;
      }
      case 'zweipunkt': {
        const sc = pick([{ Ph: 1000, R: 0.2, C: 1500, thetaA: 25, w: 150, hyst: 10, n: 'Bügeleisen-Sohle' }, { Ph: 2000, R: 0.05, C: 4000, thetaA: 20, w: 60, hyst: 4, n: 'Wasserbad' }, { Ph: 500, R: 0.1, C: 2000, thetaA: 20, w: 50, hyst: 2, n: 'Übungsofen' }]);
        const ask = pick(['T', 'ED', 'f']), r = twoPointPeriod(sc);
        given = Object.assign({}, sc, { ask: ask });
        q = 'Ein Zweipunktregler (' + sc.n + ', Übungsanlage) heizt mit P = ' + fmt(sc.Ph) + ' W. Wärmewiderstand R = ' + fmt(sc.R) + ' K/W, Wärmekapazität C = ' + fmt(sc.C) + ' J/K, Umgebung ' + fmt(sc.thetaA) + ' °C, Sollwert ' + fmt(sc.w) + ' °C, Schaltdifferenz ' + fmt(sc.hyst) + ' K (ideal, ohne Fühlerverzögerung). Berechne ' + (ask === 'T' ? 'die Periodendauer T in s' : (ask === 'ED' ? 'die Einschaltdauer ED in %' : 'die Zahl der Schaltspiele je Stunde')) + '.';
        const val = ask === 'T' ? r.T : (ask === 'ED' ? r.ED : r.fPerH);
        ex(val, ask === 'T' ? 's' : (ask === 'ED' ? '%' : 'je Stunde'), 0.03);
        steps = ['τ = R · C = ' + fmt(sc.R) + ' · ' + fmt(sc.C) + ' = ' + fmt(r.tau) + ' s', 'θ∞ = ϑa + P · R = ' + fmt(sc.thetaA) + ' + ' + fmt(sc.Ph) + ' · ' + fmt(sc.R) + ' = ' + fmt(r.thetaInf) + ' °C',
          'Schaltschwellen: oben ' + fmt(r.thetaO) + ' °C, unten ' + fmt(r.thetaU) + ' °C', 't_ein = ' + fmt(r.tEin) + ' s, t_aus = ' + fmt(r.tAus) + ' s', 'T = t_ein + t_aus = ' + fmt(r.T) + ' s',
          'ED = t_ein / T = ' + fmt(r.ED) + ' %', 'Schaltspiele je Stunde = 3600 s / T = ' + fmt(r.fPerH)];
        if (ask === 'T') addWrong(r.tEin, 'Das ist nur die Einschaltzeit t_ein. Die Periodendauer ist t_ein + t_aus.');
        if (ask === 'ED') addWrong(r.tEin / 1, 'Das ist die Einschaltzeit in s. Die Einschaltdauer ist t_ein / T in %.');
        if (ask === 'f') addWrong(r.T, 'Das ist die Periodendauer in s. Die Schaltspiele je Stunde sind 3600 s / T.');
        lowHint = 'Prüfe: t_ein = τ · ln((θ∞ − θu) / (θ∞ − θo)), t_aus = τ · ln((θo − ϑa) / (θu − ϑa)).'; highHint = lowHint;
        break;
      }
      case 'abtast': {
        const wD = pick([0.5, 1, 2, 5, 10]), Ta = pick([0.02, 0.05, 0.1, 0.2, 0.5, 1]);
        given = { wD: wD, Ta: Ta };
        q = 'Ein digitaler Regler tastet mit Ta = ' + fmt(Ta) + ' s ab. Die Durchtrittsfrequenz des Kreises ist ωD = ' + fmt(wD) + ' rad/s. Das Halteglied wirkt wie eine Totzeit Ta/2. Wie viel Grad Phasenreserve kostet die Abtastung?';
        ex(F('abtastVerlust').fn(wD, Ta), '°', 0.03); steps = F('abtastVerlust').explain(wD, Ta).steps;
        addWrong(wD * Ta * 180 / Math.PI, 'Das Halteglied verzögert im Mittel um Ta/2, nicht um Ta.');
        addWrong(wD * Ta / 2, 'Das Ergebnis steht in Grad: Multipliziere den Winkel in rad mit 180° / π.');
        lowHint = 'Prüfe: Δφ = ωD · Ta / 2 · 180° / π.'; highHint = lowHint;
        break;
      }
    }
    const value = ans.value, tol = ans.tol, alts = ans.alt, unit = ans.unit;
    function check(input) {
      try {
        const v = parseNum(input);
        if (!isFinite(v)) return { ok: false, text: TXT.keineZahl };
        const cands = [value].concat(alts);
        for (let i = 0; i < cands.length; i++) {
          if (Math.abs(v - cands[i]) <= tol * Math.abs(cands[i]) + 1e-12) {
            return { ok: true, text: 'Richtig: ' + fmt(value) + uText(unit) + '.' + (alts.length ? ' Auch ' + alts.map(function (a) { return fmt(a); }).join(' oder ') + uText(unit) + ' gilt als richtig (Tabellenbuch-Rundung).' : '') };
          }
        }
        const b1 = value * (1 - tol), b2 = value * (1 + tol), bl = Math.min(b1, b2), bh = Math.max(b1, b2);
        const small = v < bl;
        let text = small ? 'Dein Wert ist zu klein (' + fmt(v) + ' < ' + fmt(bl) + ').' : 'Dein Wert ist zu groß (' + fmt(v) + ' > ' + fmt(bh) + ').';
        let hint = '';
        for (let i = 0; i < wrong.length && !hint; i++) if (Math.abs(v - wrong[i].v) <= tol * Math.abs(wrong[i].v) + 1e-12) hint = wrong[i].text;
        for (let i = 0; i < slip.length && !hint; i++) {
          if (Math.abs(v - value * slip[i]) <= 0.05 * Math.abs(value * slip[i]) || Math.abs(v - value / slip[i]) <= 0.05 * Math.abs(value / slip[i])) hint = 'Einheit: Das Ergebnis steht in Sekunden, nicht in Minuten.';
        }
        if (!hint) hint = small ? lowHint : highHint;
        return { ok: false, text: text + (hint ? ' ' + hint : '') };
      } catch (e) { return { ok: false, text: TXT.keineZahl }; }
    }
    return { ok: true, kind: kind, seed: sd, question: q, given: given, answer: ans, steps: steps, check: check };
  }
  exercise.kinds = ['xp', 'v0', 'ebl', 'piStep', 'tnLesen', 'ks', 'regelbarkeit', 'znSchwing', 'znSprung', 'chr', 'tsumme', 'stabil', 'routh', 'skalierung', 'maProzent', 'zweipunkt', 'abtast'];

  /* =====================================================================================================
   *  DIAGNOSE UND TEXTE (M3)
   * ===================================================================================================== */
  const DIAG = {
    'sat-hoch': 'Die Stellgröße steht am oberen Anschlag ({x} %). Mehr kann das Stellglied nicht liefern; der Regler kann den Sollwert nicht schneller erreichen.',
    'sat-tief': 'Die Stellgröße steht am unteren Anschlag (0 %). Der Regler kann nicht weniger stellen.',
    'windup': 'Der I-Anteil ist weggelaufen (Windup): {x} % über dem Stellbereich. Das gibt später ein großes Überschwingen. Schalte Anti-Windup ein (klemmen oder rueck).',
    'dauer': 'Der Regelkreis schwingt dauernd, Periode etwa T = {T}. Die Kreisverstärkung ist zu groß. Verkleinere Kp{Tn}.',
    'auf': 'Die Schwingung wird immer größer: Der Kreis ist instabil. Verkleinere Kp deutlich.',
    'ebl': '{art}-Regler: bleibende Regelabweichung {e}. Sie wird mit größerem Kp kleiner, verschwindet aber nie. Nimm einen I-Anteil (PI).',
    'ebl-stoer': '{art}-Regler: bleibende Regelabweichung {e} durch die Störung. Sie wird mit größerem Kp kleiner, verschwindet aber nie. Nimm einen I-Anteil (PI).',
    'd-rausch': 'Der D-Anteil verstärkt das Messrauschen: Die Stellgröße zittert (σ = {x} %). Verkleinere Tv oder das Rauschen.',
    'wirk': 'Der Regler wirkt in die falsche Richtung (Wirkungssinn): Hier muss er {dir} wirken.',
    'totzeit': 'Die Totzeit ist groß gegen die Zeitkonstante (Tt/T = {x}). Stelle den Regler langsam ein; ein D-Anteil hilft hier kaum.',
    'abtast': 'Die Abtastzeit Ta = {Ta} kostet etwa {x}° Phasenreserve. Wähle Ta kleiner oder Kp kleiner.',
    'hand': 'Handbetrieb: Der Regler ist abgeschaltet und folgt nur. Beim Umschalten auf Automatik springt die Stellgröße nicht (stoßfrei).',
    'hand-schalt': 'Handbetrieb: Der Regler ist abgeschaltet. Zweipunkt- und Dreipunktregler: Die Stellgröße schaltet sofort.',
    'grenz': 'Grenzzyklus: Haftreibung oder Lose und der I-Anteil lassen die Achse um den Sollwert pendeln. Verkleinere den I-Anteil oder nimm PD.',
    'flatter': 'Der Schalter schaltet schneller, als der Fühler folgen kann: Die Schaltdifferenz ist zu klein.',
    'swing-groesser': 'Die Schwankungsbreite ({x} {u}) ist größer als die Schaltdifferenz ({d} {u}), weil der Fühler träge ist und die Anlage nachläuft.',
    'heizleistung': 'Die Heizleistung reicht nicht: Du brauchst {P} W, die Heizung liefert nur {Pmax} W.',
    'sperre': 'Wiedereinschaltsperre: Der Verdichter darf erst nach {t} wieder starten.'
  };
  const TEXTS = {
    diag: DIAG,
    rig: {
      reglerart: TXT.reglerartAnlage, zweipunkt: TXT.zweipunktSofort, instabil: TXT.instabil, tPos: TXT.tPos, tnPos: TXT.tnPos + ' (letzter Wert bleibt)',
      zeitraffer: 'Zeitraffer gedrosselt'
    },
    kern: TXT,
    get: function (id, vars) { return fillTpl(DIAG[id] !== undefined ? DIAG[id] : (this.rig[id] !== undefined ? this.rig[id] : ''), vars); }
  };
  function fillTpl(tpl, vars) {
    vars = vars || {};
    return String(tpl).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? '{' + k + '}' : String(vars[k]); });
  }
  /* diagnose(ctx): jede Meldung nur bei geprueft erfuellter Bedingung; fehlen Messwerte, bleibt die Meldung aus (Regel 2) */
  function diagnose(ctx) {
    const out = [];
    if (!ctx || typeof ctx !== 'object') return out;
    const c = ctx, type = typeof c.ctrl === 'string' ? c.ctrl : '', cont = TYPES.indexOf(type) >= 0 && type !== '2P' && type !== '3P';
    const hasI = type === 'I' || type === 'PI' || type === 'PID', hasD = type === 'PD' || type === 'PID';
    const hand = c.mode === 'hand', tHold = num(c.tHold, NaN), y = num(c.y, NaN), ymax = num(c.ymax, 100);
    const unit = typeof c.unit === 'string' ? c.unit : '';
    function add(id, kind, vars, fx, tplId) { const o = { id: id, kind: kind, text: fillTpl(DIAG[tplId || id], vars) }; if (fx) o.fx = fx; out.push(o); }
    const osc = c.osc && typeof c.osc === 'object' ? c.osc : null;
    if (!hand && isFinite(y) && isFinite(tHold) && y >= ymax - 0.5 && num(c.satHighFor, NaN) >= tHold) add('sat-hoch', 'warn', { x: fmt(ymax) });
    if (!hand && cont && isFinite(y) && isFinite(tHold) && y <= 0.5 && num(c.satLowFor, NaN) >= tHold) add('sat-tief', 'warn', {});
    if (!hand && c.aw === 'aus' && hasI && isFinite(tHold) && num(c.windup, NaN) > 25 && num(c.windupFor, NaN) >= tHold) add('windup', 'warn', { x: fmt(c.windup, 0) }, 'windup');
    if (!hand && cont && osc && osc.cls === 'dauerschwingung' && isFinite(num(osc.period, NaN))) add('dauer', 'warn', { T: fmtTime(osc.period, c.tUnit), Tn: hasI ? ' oder vergrößere Tn' : '' }, 'osc');
    if (!hand && cont && osc && osc.cls === 'aufschaukelnd') add('auf', 'error', {}, 'osc');
    if (!hand && cont && !hasI && c.settled === true && isFinite(num(c.e, NaN)) && Math.abs(num(c.ePct, 0)) > 2 && isFinite(num(c.ePct, NaN))) {
      const stoer = num(c.q, 0) >= 1;
      add('ebl', 'info', { art: type, e: fmt(Math.abs(c.e)) + (unit ? ' ' + unit : '') }, null, stoer ? 'ebl-stoer' : 'ebl');
    }
    if (!hand && hasD && num(c.tv, 0) > 0 && num(c.noise, 0) > 0 && num(c.sigmaY, 0) > 5) add('d-rausch', 'warn', { x: fmt(c.sigmaY) });
    if ((c.dir === 'direkt' || c.dir === 'invers') && (c.requiredDir === 'direkt' || c.requiredDir === 'invers') && c.dir !== c.requiredDir) add('wirk', 'error', { dir: c.requiredDir });
    if (num(c.Tt, 0) > 0 && num(c.Tdom, 0) > 0 && c.Tt / c.Tdom > 0.5) add('totzeit', 'info', { x: fmt(c.Tt / c.Tdom) });
    if (cont && isArr(c.blocks) && num(c.ta, NaN) > 0 && !hand) {
      const base = { type: type, Kp: c.kp, Tn: c.tn, Tv: c.tv, dir: c.dir, N: c.N === undefined ? 10 : c.N };
      const l1 = loopBlocks(c.blocks, base), l2 = loopBlocks(c.blocks, Object.assign({}, base, { Ta: c.ta }));
      if (isArr(l1) && isArr(l2)) {
        const m1 = margins(l1), m2 = margins(l2);
        if (m1.ok && m2.ok && m1.valid && m2.valid && m1.phiR !== null && m2.phiR !== null && m1.phiR - m2.phiR > 10) add('abtast', 'warn', { Ta: fmtTime(c.ta, c.tUnit), x: fmt(m1.phiR - m2.phiR, 0) });
      }
    }
    if (hand) add('hand', 'info', {}, null, (type === '2P' || type === '3P') ? 'hand-schalt' : 'hand');
    if (!hand && (num(c.friction, 0) > 0 || num(c.backlash, 0) > 0) && osc && osc.cls === 'dauerschwingung' && hasI) add('grenz', 'warn', {}, 'osc');
    if (type === '2P' && num(c.period, NaN) > 0 && num(c.Ts, NaN) > 0 && c.period < 3 * c.Ts) add('flatter', 'warn', {});
    if (type === '2P' && num(c.swing, NaN) > 0 && num(c.hyst, NaN) > 0 && c.swing > c.hyst) add('swing-groesser', 'info', { x: fmt(c.swing), d: fmt(c.hyst), u: unit || 'K' });
    if (!hand && isFinite(num(c.Pben, NaN)) && isFinite(num(c.Pmax, NaN)) && c.Pben > c.Pmax && isFinite(y) && y >= ymax - 0.5) add('heizleistung', 'warn', { P: fmt(c.Pben, 0), Pmax: fmt(c.Pmax, 0) });
    if (num(c.lockoutLeft, 0) > 0) add('sperre', 'info', { t: fmtTime(c.lockoutLeft, c.tUnit) });
    return out;
  }

  /* =====================================================================================================
   *  LAEUFER (M3)
   * ===================================================================================================== */
  function snapObj(o) {
    if (!o || typeof o !== 'object') return o;
    const c = {};
    for (const k of Object.keys(o)) { const v = o[k]; c[k] = isArr(v) ? v.slice() : v; }
    return c;
  }
  function collectKeys(list, set) {
    if (!isArr(list)) return;
    list.forEach(function (e) {
      if (typeof e === 'string') set[e] = 1;
      else if (e && typeof e === 'object') { if (typeof e.key === 'string') set[e.key] = 1; if (isArr(e.controls)) collectKeys(e.controls, set); }
    });
  }
  function runSeq(rigIn, seq, tEndS, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const out = { ok: true, samples: [], final: null, events: [], faults: [], metrics: {}, errors: [], rejected: [] };
    let rig = null;
    try {
      const seedOpt = isFinite(num(opts.seed, NaN)) ? num(opts.seed, 1) : undefined;
      if (typeof rigIn === 'function') rig = rigIn(seedOpt);
      else if (typeof rigIn === 'string') {
        const Rr = root.REG_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'REG_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && (typeof rigIn.stepProcess === 'function' || typeof rigIn.step === 'function')) {
        rig = rigIn; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); return out; }
    const h = pos(rig.h, 0.01);
    const tEnd = clamp(num(tEndS, 0), 0, Math.min(1e7, 5e6 * h));
    const sampleS = Math.max(h, pos(opts.sampleS, tEnd / 2000));
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const rng_ = rig.range && isFinite(rig.range.hi - rig.range.lo) && rig.range.hi > rig.range.lo ? rig.range.hi - rig.range.lo : 100;
    const faultSet = {}, jumps = [];
    function wNow() { try { return typeof rig.getControl === 'function' ? num(rig.getControl('w'), NaN) : num(rig.state().w, NaN); } catch (e) { return NaN; } }
    function setCtl(key, v, t) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '" gibt es an dieser Anlage nicht.'); return; }
      const before = key === 'w' ? wNow() : NaN;
      let r;
      try { r = rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); return; }
      if (r === false) { out.rejected.push({ key: key, value: v, t: t }); return; }
      if (key === 'w' && t !== undefined) {
        const after = wNow();
        if (isFinite(before) && isFinite(after) && Math.abs(after - before) >= 0.02 * rng_) jumps.push({ t: t, w0: before, w1: after });
      }
    }
    function collect(st) { if (st && isArr(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } }); }
    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    if (opts.op && typeof opts.op === 'object') {
      if (isFinite(num(opts.op.z, NaN))) setCtl('z', opts.op.z);
      if (isFinite(num(opts.op.y, NaN)) && typeof rig.setOperatingPoint === 'function') { try { rig.setOperatingPoint(num(opts.op.y, 0)); } catch (e) { out.errors.push('setOperatingPoint: ' + (e && e.message)); } }
    }
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, k) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: e.set && typeof e.set === 'object' ? e.set : null, ramp: e.ramp && typeof e.ramp === 'object' ? e.ramp : null, k: k });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    const ramps = [];
    let t = 0, qi = 0, nextSample = 0;
    function advance(dt) {
      if (typeof rig.stepProcess === 'function') rig.stepProcess(dt);
      else rig.step(dt * 1000 / pos(rig.timeScale, 1));
    }
    function takeSample() {
      let st = null, m = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      try { m = typeof rig.readMeters === 'function' ? rig.readMeters() : null; } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
      const s = st || {};
      out.samples.push({ t: t, w: s.w, x: s.x, y: s.y, z: s.z, e: s.e, meters: snapObj(m), state: snapObj(st) });
      collect(st);
    }
    for (let guard = 0; guard < 6000000; guard++) {
      while (qi < q.length && q[qi].t <= t + 1e-9) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k], t); });
        if (e.ramp && typeof e.ramp.key === 'string') {
          let from = NaN;
          try { from = typeof rig.getControl === 'function' ? num(rig.getControl(e.ramp.key), NaN) : NaN; } catch (er) { /* */ }
          const to = num(e.ramp.to, NaN), dur = num(e.ramp.durS, 0);
          if (!isFinite(to)) out.errors.push('Rampe für „' + e.ramp.key + '“ hat keinen Zielwert.');
          else if (!(dur > 0) || !isFinite(from)) setCtl(e.ramp.key, to, t);
          else {
            ramps.push({ key: e.ramp.key, from: from, to: to, t0: t, dur: dur });
            if (e.ramp.key === 'w' && Math.abs(to - from) >= 0.02 * rng_) jumps.push({ t: t, w0: from, w1: to });
          }
        }
      }
      for (let i = ramps.length - 1; i >= 0; i--) {
        const r = ramps[i], f = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(r.key, r.from + (r.to - r.from) * f);
        if (f >= 1) ramps.splice(i, 1);
      }
      if (t >= nextSample - 1e-9) { takeSample(); nextSample += sampleS; }
      if (t >= tEnd - 1e-9) break;
      let tn = Math.min(nextSample, tEnd);
      if (qi < q.length) tn = Math.min(tn, q[qi].t);
      if (ramps.length) { let rd = Infinity; ramps.forEach(function (r) { rd = Math.min(rd, r.dur / 200); }); tn = Math.min(tn, t + Math.max(h, rd)); }
      let dt = tn - t;
      if (!(dt > 1e-12)) dt = h;
      try { advance(dt); } catch (e) { out.errors.push('step(): ' + (e && e.message)); break; }
      t += dt;
    }
    try { out.final = snapObj(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snapObj) : []; } catch (e) { /* */ }
    if (jumps.length && out.samples.length >= 5) {
      const j = jumps[0], tNext = jumps.length > 1 ? jumps[1].t : Infinity;
      const ts = [], xs = [];
      out.samples.forEach(function (s) { if (s.t >= j.t - 1e-9 && s.t < tNext - 1e-9 && isFinite(s.x)) { ts.push(s.t); xs.push(s.x); } });
      out.metrics.step = stepMetrics(ts, xs, { w0: j.w0, w1: j.w1, t0: j.t, tol: 0.02, range: rng_ });
    }
    if (opts.keepRig) out.rig = rig;
    return out;
  }

  api.stepResponse = S(stepResponse); api.fitStep = S(fitStep); api.identify = S(identify); api.findCritical = S(findCritical);
  api.rules = rules; api.formulas = formulas; api.scale = scale; api.twoPoint = twoPoint;
  api.exercise = S(exercise); api.exercise.kinds = exercise.kinds;
  api.diagnose = function (c) { try { return diagnose(c); } catch (e) { return []; } };
  api.TEXTS = TEXTS;
  api.runSeq = S(runSeq);

/*@@NEXT@@*/
  root.REG_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
