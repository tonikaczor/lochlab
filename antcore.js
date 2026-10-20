/* antcore.js - Antriebs-Lab Kern (ANT_CORE, Version 1.0)
 * Physikmodelle: Gleichstrommotor, H-Bruecke, PWM, Schrittmotor, Servo (Lageregelung), Drehstrom-Asynchronmotor
 * (Netz, Stern-Dreieck, Frequenzumrichter), Getriebe, Formeln, Ablaufprogramm-Laeufer, Typenschild-Rechner.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval. Browser: window.ANT_CORE, Node: module.exports / globalThis.ANT_CORE.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten SI intern und in allen Rueckgabeobjekten: rad/s (w), Nm, A, V, W, K bzw. degC (temp), s.
 *    Zusaetzlich immer rpm (1/min) und angle/Grad, wo sinnvoll. step(dtMs): Zeit in MILLISEKUNDEN.
 *  - Jedes step(dtMs, inp) akzeptiert beliebiges dtMs (auch 0, negativ, NaN: dann Zustand unveraendert). Intern feste
 *    Teilschritte (DC 0,25 ms; Schrittmotor 0,125 ms; Servo und Drehstrom 0,5 ms), Rest wird gemerkt
 *    -> Ergebnis ist unabhaengig davon, wie die Zeit auf Aufrufe verteilt wird. Deterministisch, kein Zufall.
 *  - step() liefert IMMER ein frisches Zustandsobjekt (Kopie, darf aufbewahrt werden). Dasselbe liefert m.state().
 *  - Alle Konstruktoren akzeptieren undefined/null/Unsinn und werfen nie. Zahlen duerfen auch als String kommen.
 *    Ungueltige Werte fallen auf den Vorgabewert zurueck. m.reset() setzt den Zustand zurueck, m.params ist
 *    eine Kopie der wirksamen Parameter, m.setParams(p) aendert Parameter im Betrieb.
 *  - Thermik: Parameter thermFactor (Vorgabe 1) beschleunigt die Erwaermung/Abkuehlung. Reale Zeitkonstanten
 *    liegen bei Minuten bis Stunden, fuer die Vorfuehrung im Lab sind 10..50 sinnvoll (Pruefstaende setzen das selbst).
 *    Grenztemperatur Wicklung: tempMax = 130 degC (Getriebe 90 degC). Umgebung 25 degC.
 *  - Fehlerkennzeichen in jedem Zustand: faults = [Codes], Texte in ANT_CORE.faultTexts[code] (Deutsch).
 *
 * ===================================================================================================
 * ENTSCHEIDUNGEN BEI OFFENEN PUNKTEN
 *  - duty (PWM) ist ein Anteil 0..1; Werte > 1 gelten als Prozent (duty = 1 ist also 100 %, nicht 1 %).
 *    Negatives duty = Gegenrichtung (nur pwmAverage). Frequenzen in Hz; Werte <= 100 gelten als kHz (1, 5, 20 kHz).
 *  - H-Bruecke: S1 oben links, S2 unten links, S3 oben rechts, S4 unten rechts; Motor zwischen den Mitten.
 *    vor = S1+S4, rueck = S3+S2, bremse = beide unteren (S2+S4) ODER beide oberen (S1+S3) (Wicklung kurzgeschlossen),
 *    frei = Motor an hoechstens einer Seite verbunden (Freilauf, Strom 0), kurzschluss = S1+S2 oder S3+S4 (shoot).
 *    Brueckenabfall 0,2 V je Schalter (2 Schalter im Strompfad).
 *  - dcMotor: lastmoment 'load' (Nm, Betrag) wirkt wie Coulomb-Reibung IMMER entgegen der Drehrichtung (Bremse),
 *    'tLoad' (Nm, mit Vorzeichen) wirkt konstant entgegen der positiven Drehrichtung (Gewicht, Gravitation),
 *    'fan' = Lueftermoment M = fan*w^2. Offener Stromkreis (Freilauf): open:true. Bremsen (Kurzschluss): u = 0.
 *    Der Haftzustand (Stillstand) wird exakt behandelt: Motor bleibt stehen, solange Kt*i innerhalb der Haftreibung+Last liegt.
 *    'torque' = Wellenmoment (Kt*i minus innere Reibung) = im Beharrungszustand gleich dem Lastmoment.
 *  - Der PWM-Betrieb des Motors laeuft ueber den MITTELWERT (u = pwmAverage), die Welligkeit liefert pwmRipple;
 *    iPeak = iAvg + Ripple/2 (Spitze), siehe pwmRipple().
 *  - Schrittmotor: Kippmoment = Sinus-Modell M = Mpk(f)*sin(Feldwinkel - Rotorwinkel) mit Pull-out-Kennlinie
 *    Mpo(f) = Mh*I/(1+(f/fc)^1.6), fc ~ Versorgungsspannung; Daempfung wirkt auf die Abweichung zur Feldgeschwindigkeit (zeta 0,1), Resonanz zeigt sich als Pendeln (vibration) bei ca. 0,8 x Eigenfrequenz. Schrittverlust folgt aus der Dynamik (Rotor rutscht
 *    um jeweils 4 Vollschritte = 1 elektrische Periode zurueck); lostSteps zaehlt in Schritten der aktuellen Betriebsart
 *    (Halbschritt: 2 je Vollschritt). Verlorene Schritte bleiben bis reset()/clearLoss() stehen (Lage ist dann falsch).
 *    Ansteuermuster: 4 Bits [A1,A2,B1,B2] (Zahl: Bit0=A1, Bit1=A2, Bit2=B1, Bit3=B2; String '1010'; Array; Objekt).
 *    A1/A2 sind die beiden Haelften der Wicklung A (unipolar) bzw. die beiden Stromrichtungen (bipolar). Beide an = 0.
 *    Feldvektor (A1-A2, B1-B2); Vollschritt hat das groesste Moment, Wave-Drive 70,7 %, Halbschritt wechselt.
 *  - Servo: kp [V/rad], ki [V/(rad*s)], kd [V*s/rad] (Fehler/Drehzahl am Abtrieb). Der D-Anteil wirkt auf die Messgroesse
 *    (Drehzahl), nicht auf den Sollwertsprung. 'load' am Abtrieb = konstantes Moment mit Vorzeichen (Gewicht). RC-Modus:
 *    feste Servo-Verstaerkung, Totband 0,9 Grad, kein I-Anteil. Anschlaege: rc +-95 Grad, regler +-190 Grad.
 *  - Asynchronmotor: Kloss mit Rotor-Frequenz: M = 2*Mk/(wr/wk + wk/wr), wr = ws - w (Schlupfdrehzahl), wk konstant
 *    (Rotorfrequenz am Kipppunkt ist frequenzunabhaengig), Mk ~ psi^2 (psi = Fluss = U/f). Netzbetrieb: psi = U/UN exakt
 *    (Stern 1/3 Moment). FU: zusaetzlich Spannungsabfall am Staenderwiderstand (wichtig bei kleinen Frequenzen ->
 *    Boost). Strom: Rotorstrom aus Schlupfdrehzahl (auf Typenschild-Anlaufstrom kalibriert) plus Magnetisierungsstrom plus
 *    Eisenstrom; cosphi = Wirkleistung/Scheinleistung (energetisch). Verluste kalibriert auf Typenschild-Wirkungsgrad. Reines Kloss ergaebe zu kleines Anlaufmoment: die Kipp-Schlupfdrehzahl waechst mit der Schlupfdrehzahl (kappa), dadurch MA ca. 1,8..2 x MN, Mk/MN bleibt wie am Typenschild.
 *    Typenschildspannung = Wicklungsspannung im Dreieck (uDelta = 400 V, "400/690 V Dreieck/Stern"): nur solche Motoren
 *    sind am 400-V-Netz fuer Stern-Dreieck-Anlauf geeignet. Netz-Phasenausfall: Wechselfeld-Modell, kein Anlaufmoment.
 *    FU-Hochlaufzeit ramp = Zeit von 0 auf Nennfrequenz (50 Hz); Stromgrenze 150 % IN haelt die Rampe an,
 *    laenger als 3 s Begrenzung = FU-Abschaltung (fuFault). Schuetzlogik K1/K2/K3 nur, wenn eines davon uebergeben wird,
 *    sonst gilt 'connection' (Netz an).
 *  - Getriebe: i = z2/z1 (* z4/z3), Schnecke: z1 = Gangzahl (gaenge) der Schnecke, i = z2/gaenge, zweite Stufe immer Stirnrad.
 *    nOut ohne Vorzeichen (nOut = nIn/i), Drehrichtung in dirOut (+1 gleich, -1 gegenlaeufig; je Stirnrad-Stufe -1).
 *    mOut = (mIn - mDrag)*i*eta. Riemenschlupf wird nicht modelliert. Zahnbruch (broken) nach Ueberlast ueber
 *    mLimit: Schaden steigt mit 20*(M/Mlimit-1) je Sekunde, bei 1 gebrochen (bleibt bis reset()).
 *  - runSeq erweitert die Spezifikation um optionale Rampen { t, ramp:{ key, to, durMs } } und opts.controls (Startwerte).
 *
 * ===================================================================================================
 * API  (jeweils: Parameter -> Rueckgabe)
 *
 *  ANT_CORE.version                      '1.0'
 *  ANT_CORE.faultTexts                   { code: 'deutscher Text' }
 *
 *  dcMotor(params | presetId)            params: Ra [Ohm], La [H], Ke [V*s/rad] (= Kt [Nm/A]), J [kg m^2], Jload [kg m^2],
 *                                        Mc [Nm] (Coulomb), B [Nm*s/rad] (viskos), Cth [J/K], Rth [K/W], alphaCu (0,0039),
 *                                        uNom [V], tempMax (130), thermFactor (1), tAmb (25), preset:'gm12' (Basis, andere Felder ueberschreiben)
 *    m.step(dtMs, { u [V, mit Vorzeichen], load [Nm], tLoad [Nm, vorzeichenbehaftet], fan [Nm/(rad/s)^2], open:bool })
 *       -> { t, u, i, w, rpm, torque, torqueEm, theta, thetaDeg, temp, emf, ra, pElec, pMech, pLoss, eta, stalled, overheat,
 *            overvoltage, iStart, faults }
 *    m.state(), m.reset(), m.setParams(p), m.params, m.derived(u) (siehe dcDerived)
 *  ANT_CORE.dcPresets                    Array [{ id, name, info, params, uNom, mMax, nominal:{u,load} }], auch per id:
 *                                        dcPresets.gm12 (Getriebemotor 12 V ~3 W), .antrieb24 (24 V ~100 W), .modell6 (Modellbau 6 V)
 *  ANT_CORE.dcDerived(params, u)         -> { kt, n0 [rpm], w0, iStall, mStall, iNoLoad, pMax, tauM, tauE, etaMax, iEtaMax, mEtaMax, nEtaMax }
 *  ANT_CORE.hBridge(sw, uSupply, drop|{drop})   sw = {S1,S2,S3,S4} | [4] | '1001'
 *       -> { uOut, mode:'vor'|'rueck'|'frei'|'bremse'|'kurzschluss', shoot, open, closed, brake, left, right, drop, hint }
 *  ANT_CORE.hBridgeTransition(prev, next, deadMs) -> { risk, shoot, hint }   (Umschalten ohne Totzeit)
 *  ANT_CORE.shootCurrent(uSupply, {rLoop, rSource, iLimit}) -> { iUnlimited, i, uBus, limited, pHeat }  (Brueckenkurzschluss)
 *  ANT_CORE.pwmAverage(duty, uSupply, drop) -> mittlere Spannung [V] (mit Vorzeichen von duty)
 *  ANT_CORE.pwmRipple({duty,uSupply,freq,L,R,emf,iAvg,drop} | duty,uSupply,freq,L,R,emf)
 *       -> { ripple [A, Spitze-Spitze], iMin, iMax, iAvg, iPeak, continuous, tOn, tOff, f }
 *
 *  stepper(params | presetId)            params: spr (200), Mh [Nm], iRated [A], Rph [Ohm], Lph [H], J, Jload, Mdet, fc [Hz bei uRef],
 *                                        uRef (24), uSupply (24), expo (1,6), fPi [Hz], zeta, Mf, Cth, Rth, tempMax, thermFactor
 *    m.step(dtMs, { pattern | (rate [Schritte/s], dir, run:bool, stepMode:'voll'|'halb'|'wave', accel [Schritte/s^2]),
 *                   load [Nm], loadType:'reibung'|'gewicht', current [A], pulse:bool (Einzelschritt, steigende Flanke) })
 *       -> { t, theta [rad rel.], angle [Grad rel.], w (geglaettet, tau 50 ms), wInst (momentan), rpm (geglaettet), rpmInst, steps (Befehle, +-), fieldSteps (Vollschritte), pos (Rotorlage in
 *            Schritten), stepAngle [Grad], stepMode, pattern [4], lag [Vollschritte], lagDeg, lostSteps, slips (Zaehler),
 *            slipEvent (in diesem Aufruf neu), torque (momentan), torqueAvail (Pull-out bei aktueller Frequenz), torqueHold,
 *            torquePullIn, rate (Ist-Frequenz Vollschritte/s), current, temp, vibration (Pendelamplitude in Vollschritten), resonance, fRes [Schritte/s, Resonanzstelle = 0,8 x Eigenfrequenz],
 *            stalled, overheat, faults }
 *    m.pulse(dir) (Einzelschritt), m.pullOut(f, I), m.pullIn(f, I), m.curve({fMax, n, current}) -> { pullOut:[[f,M]], pullIn:[[f,M]] },
 *    m.maxAccel(f, load) [Schritte/s^2], m.fRes(), m.clearLoss(), m.reset(), m.state()
 *  ANT_CORE.stepPatterns                 { voll:[4x4], halb:[8x4], wave:[4x4], decode(p), read(p), names }
 *  ANT_CORE.stepperPresets               [{id,name,params}] nema14, nema17, nema23
 *
 *  servo(params | presetId)              params: motor:{DC-Parameter}, N (Getriebe), etaG, Jout, uMax [V], kp, ki, kd, db [Grad], tCtrl [ms],
 *                                        kickNm, limits:[min,max] Grad, preset:'micro'|'standard'|'kraft'
 *    m.step(dtMs, { mode:'rc'|'regler', pulse [ms], period [ms], setpoint [Grad], kp, ki, kd, load [Nm], disturb:bool, uMax })
 *       -> { t, mode, pulse, target, setpoint, angle [Grad], theta [rad], error [Grad], w, rpm (Abtrieb), rpmMotor, i, u, torque (Abtrieb),
 *            temp, overshoot [%], settle [s], settled, riseTime [s], oscillating, saturated, atStop, stalled, overload, overheat, faults }
 *    m.kick(Nm, ms), m.reset(), m.state()
 *  ANT_CORE.servoPresets, ANT_CORE.servoPulse.toAngle(ms) / .fromAngle(deg), ANT_CORE.servoStepResponse(params, {kp,ki,kd}, stepDeg, tEndMs)
 *       -> { points:[[t_s, Grad]], overshoot, settle, riseTime, target }
 *
 *  induction(params | presetId)          params (Typenschild): P [W], uDelta [V], fN, pp, nN [1/min], eta, cosphi, iN [A], lambdaK (Mk/MN), iaRatio (IA/IN), kappa (Anlaufmoment-Anhebung, 1), fuIlim (1,5), fuTripS (3),
 *                                        J, Jload, boost (0..1), tempMax, thermFactor, connection ('dreieck'|'stern')
 *    m.step(dtMs, { source:'netz'|'fu', K1,K2,K3, connection, freq [Hz], vf:'konstant'|'boost'|'quadratisch', boost, ramp [s],
 *                   load [Nm], fan [Nm bei Nenndrehzahl], reverse:bool, phaseLoss:bool, enable:bool, uMains [V], fMains [Hz], fuReset:bool })
 *       -> { t, w, rpm, slip (Anteil), slipPct, torque (Welle), torqueEm, iLine [A], iPhase, cosphi, pElec, pMech, eta, temp, uMotor (Klemmen,
 *            Leiter-Leiter), uWinding, fMotor [Hz], fSigned, nSync [1/min], connection:'stern'|'dreieck'|'offen'|'kurzschluss', source, on,
 *            tipped, stalled, hum, fuFault, fuLimiting, regen, phaseLost, overheat, overvoltage, mk, theta, faults }
 *    m.curves({ connection, source, f, vf, boost, uMains, phaseLoss, n }) -> { torque:[[rpm,Nm]], current:[[rpm,A]], nSync, mk, mStart, iStart }
 *    m.derived (Mk0, MN, sN, sk0, IphN, iN ...), m.reset(), m.state()
 *  ANT_CORE.acPresets                    [{ id, name, plate:{P,uDelta,uStar,iDelta,iStar,cosphi,n,eta,f,poles}, params }], per id: m055, m15, m4
 *
 *  gearbox(params)                       params: type 'stirnrad'|'riemen'|'schnecke', stages 1|2, z1..z4, gaenge (Schnecke), q (Schnecke, 11),
 *                                        eta (Wirkungsgrad je Stufe, sonst automatisch), lube:bool, mLimit [Nm Abtrieb], nMax [1/min], mDrag [Nm],
 *                                        Cth, Rth, tempMax (90), thermFactor
 *    m.apply({ nIn [1/min], mIn [Nm], mLoad? [Nm Abtrieb], lube? }) -> { ratio, nOut, nOutSigned, dirOut, mOut, pIn, pOut, pLoss, eta (wirksam),
 *            etaMesh, mDrag, mInRequired, overload, overspeed, overheat, broken, selfLocking, temp, faults }   (rein, aendert nichts)
 *    m.step(dtMs, same) -> wie apply, plus Thermik und Zahnbruch-Zustand       m.applyReverse({ nOut, mOut }) -> { nIn, mIn, blocked }
 *    m.info() -> { ratio, eta, stages:[{type,i,eta,dir}], selfLocking, dirOut },  m.setParams(p), m.reset(), m.state()
 *
 *  ANT_CORE.formulas                     Rechenfunktionen mit Einheiten, formulas.info[name] = { args, unit, expr, text },
 *                                        formulas.explain(name, ...args) -> { value, unit, steps:[Rechenweg-Zeilen] }
 *  ANT_CORE.runSeq(rigFactory|rigId|rig, seq, tEndMs, opts) -> { samples:[{t,meters,state}], final, events, faults, peaks, errors }
 *       seq = [{ t [ms], set:{key:value}, ramp?:{key,to,durMs} }], opts: { dtMs (5), sampleMs (50), controls, rigOpts, keepRig }
 *  ANT_CORE.typenschild(P, U, I, cosphi, n, opts) -> { ok, pIn, eta, etaPct, torque, slip, slipPct, nSync, polePairs, poles, S, Q, pLoss, iStarRated (I/sqrt3), iStartStar (1/3 des Direktanlaufs), hinweis }
 *       P in W (opts.unitP:'kW' fuer kW), U Leiterspannung V, I A, n 1/min, opts.f (50)
 * =================================================================================================== */
(function (root) {
  'use strict';

  const PI = Math.PI, TWO_PI = 2 * PI, SQ3 = Math.sqrt(3);
  const WEPS = 0.02;                       // rad/s: darunter gilt der Motor als stehend (Haftzustand)
  const MAXDT = 10000;                     // ms je step()-Aufruf werden maximal gerechnet

  /* ---------- Hilfsfunktionen ---------- */
  function num(x, d) {
    if (typeof x === 'string' && x.trim() !== '') x = +x.replace(',', '.');
    return (typeof x === 'number' && isFinite(x)) ? x : d;
  }
  function pos(x, d, min) { x = num(x, d); return x > (min === undefined ? 0 : min) ? x : d; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }
  function bool(x) { return x === true || x === 1 || x === '1' || x === 'true' || x === 'an' || x === 'ein' || x === 'on'; }
  function hyp(a, b) { return Math.sqrt(a * a + b * b); }
  function wrapPi(a) { a = a % TWO_PI; if (a > PI) a -= TWO_PI; else if (a <= -PI) a += TWO_PI; return a; }
  function rpmOf(w) { return w * 60 / TWO_PI; }
  function omegaOf(n) { return n * TWO_PI / 60; }
  function mixParams(def, p) {
    const o = Object.assign({}, def);
    if (p && typeof p === 'object') {
      for (const k of Object.keys(p)) {
        const dv = def[k], v = p[k];
        if (typeof dv === 'number') o[k] = num(v, dv);
        else if (typeof dv === 'boolean') o[k] = v === undefined ? dv : bool(v);
        else if (v !== undefined && v !== null) o[k] = v;
      }
    }
    return o;
  }
  function listWithIds(arr) {                 // Array, zusaetzlich per id erreichbar (nicht aufzaehlbar)
    arr.forEach(function (e) { Object.defineProperty(arr, e.id, { value: e, enumerable: false }); });
    return arr;
  }
  function advance(self, dtMs, h, fn) {      // feste Teilschritte h [ms]; Rest merken
    let dt = num(dtMs, 0);
    if (!(dt > 0)) return 0;
    if (dt > MAXDT) dt = MAXDT;
    self.acc = (self.acc || 0) + dt;
    let n = 0;
    while (self.acc >= h - 1e-9) { fn(h / 1000); self.acc -= h; n++; }
    if (self.acc < 0) self.acc = 0;
    return n;
  }
  function pickPreset(list, p) {              // 'id' oder { preset:'id', ... } oder { ... }
    if (typeof p === 'string') return { base: list[p] ? list[p].params : null, over: null, preset: list[p] || null };
    if (p && typeof p === 'object' && typeof p.preset === 'string' && list[p.preset]) return { base: list[p.preset].params, over: p, preset: list[p.preset] };
    return { base: null, over: p, preset: null };
  }

  const FAULT_TEXTS = {
    brueckenkurzschluss: 'Brückenkurzschluss! Die beiden Schalter einer Seite dürfen nie gleichzeitig an sein.',
    ueberstrom: 'Überstrom: Der Strom ist viel zu hoch.',
    ueberhitzung: 'Überhitzung: Die Wicklung ist zu heiß (über 130 °C).',
    blockiert: 'Der Motor ist blockiert: Das Lastmoment ist größer als das Motormoment.',
    ueberspannung: 'Überspannung: Die Versorgungsspannung ist zu hoch für diesen Motor.',
    schrittverlust: 'Schrittverlust: Der Rotor kommt nicht mehr mit dem Drehfeld mit.',
    resonanz: 'Resonanz: Der Motor dröhnt und schwingt bei dieser Schrittfrequenz.',
    schwingt: 'Der Regelkreis schwingt: Die Verstärkung ist zu hoch.',
    anschlag: 'Der Servo läuft gegen den mechanischen Anschlag.',
    ueberlast: 'Überlast: Der Motor wird dauerhaft zu stark belastet.',
    kurzschluss: 'Stern und Dreieck gleichzeitig: Kurzschluss!',
    kippt: 'Kippmoment überschritten: Der Motor bleibt stehen und brummt.',
    fu: 'Frequenzumrichter hat wegen Überstrom abgeschaltet.',
    phasenausfall: 'Phasenausfall: Der Motor läuft nur an zwei Phasen.',
    zahnbruch: 'Zahnbruch: Das Grenzmoment des Getriebes wurde überschritten.',
    ueberdrehzahl: 'Überdrehzahl: Die Eingangsdrehzahl ist zu hoch für das Getriebe.',
    trockenlauf: 'Das Getriebe läuft ohne Schmierung: Reibung und Temperatur steigen.'
  };

  /* =====================================================================================================
   *  GLEICHSTROMMOTOR
   * ===================================================================================================== */
  const DC_DEFAULTS = {
    Ra: 8, La: 0.002, Ke: 0.01883, J: 1.5e-6, Jload: 0, Mc: 0.0002, B: 3e-7, Cth: 18, Rth: 14,
    alphaCu: 0.0039, uNom: 12, tempMax: 130, thermFactor: 1, tAmb: 25
  };
  function dcSanitize(p) {
    p.Ra = pos(p.Ra, DC_DEFAULTS.Ra, 1e-4); p.La = pos(p.La, DC_DEFAULTS.La, 1e-7);
    p.Ke = pos(p.Ke, DC_DEFAULTS.Ke, 1e-6); p.J = pos(p.J, DC_DEFAULTS.J, 1e-10);
    p.Jload = Math.max(0, num(p.Jload, 0)); p.Mc = Math.max(0, num(p.Mc, 0)); p.B = Math.max(0, num(p.B, 0));
    p.Cth = pos(p.Cth, DC_DEFAULTS.Cth, 1e-3); p.Rth = pos(p.Rth, DC_DEFAULTS.Rth, 1e-4);
    p.uNom = pos(p.uNom, DC_DEFAULTS.uNom, 0); p.thermFactor = clamp(num(p.thermFactor, 1), 0, 5000);
    p.tempMax = num(p.tempMax, 130); p.tAmb = num(p.tAmb, 25); p.alphaCu = num(p.alphaCu, 0.0039);
    return p;
  }
  function dcParams(params) {
    const pk = pickPreset(dcPresets, params);
    return dcSanitize(mixParams(DC_DEFAULTS, Object.assign({}, pk.base || {}, pk.over && typeof pk.over === 'object' ? pk.over : {})));
  }

  /* Ein Integrationsschritt h [s] des Gleichstrommotors (implizites Euler fuer i und w, Haftzustand exakt).
   * s: { i, w, theta, temp, stuck, pHeat }; inp: { u, fr (zusaetzliche Coulomb-Last), text (vorzeichenbehaftet), fanB, open, Jt } */
  function dcTick(p, s, h, inp) {
    const Ra = p.Ra * (1 + p.alphaCu * (s.temp - p.tAmb));
    const La = p.La, Ke = p.Ke, Jt = inp.Jt;
    const Bt = p.B + inp.fanB * Math.abs(s.w);
    const fr = p.Mc + inp.fr, text = inp.text, u = inp.u;
    const a11 = La / h + Ra, b1 = u + (La / h) * s.i, c = Jt / h, a22 = c + Bt;
    const w0 = s.w;
    let i1, w1, stuck = false, dirn = 0;
    if (Math.abs(w0) < WEPS) {
      const ih = inp.open ? 0 : b1 / a11;
      const tm = Ke * ih;
      if (Math.abs(tm - text) <= fr) { w1 = 0; i1 = ih; stuck = true; }
      else dirn = sign(tm - text);
    } else dirn = sign(w0);
    if (!stuck) {
      const b2 = c * w0 - fr * dirn - text;
      if (inp.open) { i1 = 0; w1 = b2 / a22; }
      else {
        const det = a11 * a22 + Ke * Ke;
        i1 = (b1 * a22 - Ke * b2) / det;
        w1 = (a11 * b2 + Ke * b1) / det;
      }
      if (w0 !== 0 && w1 * w0 < 0) { w1 = 0; i1 = inp.open ? 0 : b1 / a11; }
    }
    s.i = i1; s.w = w1; s.theta += w1 * h; s.stuck = stuck;
    s.pHeat = i1 * i1 * Ra + 0.3 * (p.Mc * Math.abs(w1) + p.B * w1 * w1);
    s.temp += (s.pHeat - (s.temp - p.tAmb) / p.Rth) / p.Cth * h * p.thermFactor;
    s.Ra = Ra;
  }

  function dcDerived(params, u) {
    const p = dcParams(params);
    u = num(u, p.uNom);
    const kt = p.Ke;
    const iNoLoad = (p.Mc + p.B * (u / kt)) / kt;
    const w0 = Math.max(0, (u - p.Ra * iNoLoad) / kt);
    const iStall = u / p.Ra;
    const o = {
      kt: kt, ke: p.Ke, u: u, w0: w0, n0: rpmOf(w0), iStall: iStall, mStall: kt * iStall, iNoLoad: iNoLoad,
      pMax: u * u / (4 * p.Ra), tauM: p.J * p.Ra / (p.Ke * kt), tauE: p.La / p.Ra
    };
    let best = { eta: 0, i: 0 };
    for (let k = 1; k <= 400; k++) {
      const i = iNoLoad + (iStall - iNoLoad) * k / 401;
      const w = (u - p.Ra * i) / p.Ke;
      const M = kt * i - p.Mc - p.B * w;
      const eta = u * i > 0 ? M * w / (u * i) : 0;
      if (eta > best.eta) best = { eta: eta, i: i, M: M, w: w };
    }
    o.etaMax = best.eta; o.iEtaMax = best.i; o.mEtaMax = best.M || 0; o.nEtaMax = rpmOf(best.w || 0);
    return o;
  }

  function dcMotor(params) {
    let p = dcParams(params);
    let s, self, last;
    function reset() {
      s = { i: 0, w: 0, theta: 0, temp: p.tAmb, stuck: false, pHeat: 0, Ra: p.Ra };
      self = { acc: 0 }; last = { u: 0, load: 0, text: 0, open: false, t: 0 };
    }
    function state() {
      const em = p.Ke * s.i;
      const fr0 = p.Mc * (s.w !== 0 ? sign(s.w) : clamp(em / (p.Mc || 1), -1, 1));
      const torque = em - p.B * s.w - fr0;
      const pElec = last.open ? 0 : last.u * s.i;
      const pMech = torque * s.w;
      const eta = pElec > 1e-6 && pMech > 0 ? clamp(pMech / pElec, 0, 1) : 0;
      const faults = [];
      const stalled = Math.abs(s.w) < 1 && Math.abs(last.u) > 0.3 && Math.abs(s.i) > 0.25 * Math.abs(last.u) / s.Ra;
      const overheat = s.temp > p.tempMax, overvoltage = Math.abs(last.u) > 1.25 * p.uNom;
      if (stalled) faults.push('blockiert');
      if (overheat) faults.push('ueberhitzung');
      if (overvoltage) faults.push('ueberspannung');
      return {
        t: last.t, u: last.u, i: s.i, w: s.w, rpm: rpmOf(s.w), torque: torque, torqueEm: em, theta: s.theta,
        thetaDeg: s.theta * 180 / PI, temp: s.temp, emf: p.Ke * s.w, ra: s.Ra, pElec: pElec, pMech: pMech,
        pLoss: pElec - pMech, eta: eta, stalled: stalled, overheat: overheat, overvoltage: overvoltage,
        iStart: last.u / s.Ra, faults: faults
      };
    }
    function step(dtMs, inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const u = clamp(num(inp.u, 0), -1000, 1000), load = Math.abs(num(inp.load, 0));
      const text = num(inp.tLoad, 0), fan = Math.abs(num(inp.fan, 0)), open = bool(inp.open);
      last.u = u; last.load = load; last.open = open;
      const Jt = p.J + p.Jload;
      const n = advance(self, dtMs, 0.25, function (h) {
        dcTick(p, s, h, { u: u, fr: load, text: text, fanB: fan, open: open, Jt: Jt });
      });
      last.t += n * 0.25;
      return state();
    }
    reset();
    return {
      step: step, state: state, reset: reset,
      get params() { return Object.assign({}, p); },
      setParams: function (q) { p = dcSanitize(mixParams(p, q)); },
      derived: function (u) { return dcDerived(p, u); }
    };
  }

  const dcPresets = listWithIds([
    { id: 'gm12', name: 'Getriebemotor 12 V (ca. 3 W)', info: 'Kleiner 12-V-Motor, Leerlauf ca. 6000 1/min, Anlaufstrom ca. 1,5 A.',
      params: { Ra: 8, La: 0.002, Ke: 0.01883, J: 1.5e-6, Mc: 0.0002, B: 3e-7, Cth: 18, Rth: 14, uNom: 12 },
      uNom: 12, mMax: 0.031, nominal: { u: 12, load: 0.005 } },
    { id: 'antrieb24', name: '24-V-Antrieb (ca. 100 W)', info: '24-V-Gleichstrommotor, Nenndrehzahl ca. 3000 1/min bei 0,3 Nm, Anlaufstrom ca. 40 A.',
      params: { Ra: 0.6, La: 0.0012, Ke: 0.0659, J: 3e-5, Mc: 0.012, B: 3e-5, Cth: 150, Rth: 2.5, uNom: 24 },
      uNom: 24, mMax: 2.9, nominal: { u: 24, load: 0.3 } },
    { id: 'modell6', name: 'Modellbau-Motor 6 V', info: 'Kleiner schneller 6-V-Motor, Leerlauf ca. 12000 1/min, wird beim Blockieren sehr schnell heiß.',
      params: { Ra: 2, La: 0.0006, Ke: 0.004455, J: 8e-7, Mc: 0.0004, B: 4e-7, Cth: 8, Rth: 12, uNom: 6 },
      uNom: 6, mMax: 0.015, nominal: { u: 6, load: 0.003 } }
  ]);

  /* =====================================================================================================
   *  H-BRUECKE UND PWM
   * ===================================================================================================== */
  function readSwitches(sw) {
    let a = [false, false, false, false];
    if (Array.isArray(sw)) a = [0, 1, 2, 3].map(function (k) { return bool(sw[k]); });
    else if (typeof sw === 'string') { const m = sw.replace(/[^01]/g, ''); a = [0, 1, 2, 3].map(function (k) { return m[k] === '1'; }); }
    else if (sw && typeof sw === 'object') a = [0, 1, 2, 3].map(function (k) { return bool(sw['S' + (k + 1)] !== undefined ? sw['S' + (k + 1)] : sw['s' + (k + 1)]); });
    return a;
  }
  function hBridge(sw, uSupply, opt) {
    const s = readSwitches(sw);
    const U = Math.max(0, num(uSupply, 0));
    const drop = Math.max(0, typeof opt === 'number' ? num(opt, 0.2) : (opt && typeof opt === 'object' ? num(opt.drop, 0.2) : 0.2));
    const S1 = s[0], S2 = s[1], S3 = s[2], S4 = s[3];
    const res = { uOut: 0, mode: 'frei', shoot: false, open: true, closed: false, brake: false, left: '?', right: '?', drop: drop, hint: '' };
    res.left = S1 ? '+' : S2 ? '-' : '?'; res.right = S3 ? '+' : S4 ? '-' : '?';
    if ((S1 && S2) || (S3 && S4)) {
      res.mode = 'kurzschluss'; res.shoot = true; res.open = false;
      res.hint = FAULT_TEXTS.brueckenkurzschluss;
      return res;
    }
    if (res.left === '?' || res.right === '?') {
      res.hint = 'Freilauf: Der Motor ist nicht vollständig angeschlossen, es fließt kein Strom, er läuft aus.';
      if (res.left === '?' && res.right === '?') res.hint = 'Alle Schalter offen: Freilauf, der Motor läuft aus.';
      return res;
    }
    res.open = false; res.closed = true;
    const uEff = Math.max(0, U - 2 * drop);
    if (res.left === '+' && res.right === '-') { res.mode = 'vor'; res.uOut = uEff; res.hint = 'Vorwärts: S1 und S4 geschlossen.'; }
    else if (res.left === '-' && res.right === '+') { res.mode = 'rueck'; res.uOut = -uEff; res.hint = 'Rückwärts: S3 und S2 geschlossen.'; }
    else { res.mode = 'bremse'; res.brake = true; res.uOut = 0; res.hint = 'Bremsen: Beide Motoranschlüsse liegen an derselben Spannung, die Wicklung ist kurzgeschlossen.'; }
    return res;
  }
  function hBridgeTransition(prev, next, deadMs) {
    const a = readSwitches(prev), b = readSwitches(next), dead = num(deadMs, 0);
    const legs = [];
    if ((a[0] && b[1]) || (a[1] && b[0])) legs.push('links');
    if ((a[2] && b[3]) || (a[3] && b[2])) legs.push('rechts');
    const shoot = (b[0] && b[1]) || (b[2] && b[3]);
    const risk = legs.length > 0 && dead <= 0;
    let hint = '';
    if (shoot) hint = FAULT_TEXTS.brueckenkurzschluss;
    else if (risk) hint = 'Umschalten ohne Totzeit: Auf der ' + legs.join(' und ') + 'n Seite sind kurzzeitig beide Schalter an. Warte erst, bis der eine ganz aus ist (Totzeit).';
    else if (legs.length) hint = 'Mit Totzeit umgeschaltet: sicher.';
    return { risk: risk || shoot, shoot: shoot, legs: legs, hint: hint };
  }
  function shootCurrent(uSupply, opt) {
    opt = opt && typeof opt === 'object' ? opt : {};
    const U = Math.max(0, num(uSupply, 0)), rLoop = pos(opt.rLoop, 0.12, 0), rSource = pos(opt.rSource, 0.4, 0);
    const iLimit = pos(opt.iLimit, 5, 0);
    const iUn = U / (rLoop + rSource);
    const limited = iUn > iLimit;
    const i = limited ? iLimit : iUn;
    return { iUnlimited: iUn, i: i, uBus: limited ? i * rLoop : U - i * rSource, limited: limited, pHeat: i * i * rLoop };
  }
  function normDuty(d) {
    d = num(d, 0);
    const sg = d < 0 ? -1 : 1; let a = Math.abs(d);
    if (a > 1) a = a / 100;
    return sg * Math.min(1, a);
  }
  function normFreq(f) { f = num(f, 1000); if (!(f > 0)) f = 1000; if (f <= 100) f *= 1000; return f; }
  function pwmAverage(duty, uSupply, drop) {
    const d = normDuty(duty), U = Math.max(0, num(uSupply, 0)), dr = Math.max(0, num(drop, 0.2));
    return d * Math.max(0, U - 2 * dr);
  }
  function pwmRipple(a, b, c, d, e, f) {
    let o;
    if (a && typeof a === 'object') o = a; else o = { duty: a, uSupply: b, freq: c, L: d, R: e, emf: f };
    const D = Math.abs(normDuty(o.duty)), drop = Math.max(0, num(o.drop, 0.2));
    const U = Math.max(0, num(o.uSupply, 12) - 2 * drop);
    const fq = normFreq(o.freq), T = 1 / fq;
    const L = pos(o.L, 0.002, 0), R = pos(o.R, 8, 0);
    let emf;
    if (o.emf !== undefined && isFinite(num(o.emf, NaN))) emf = num(o.emf, 0);
    else if (o.iAvg !== undefined && isFinite(num(o.iAvg, NaN))) emf = D * U - num(o.iAvg, 0) * R;
    else emf = D * U;                              // Leerlauf-nah: mittlere Spannung = Gegenspannung
    const res = { ripple: 0, iMin: 0, iMax: 0, iAvg: 0, iPeak: 0, continuous: true, tOn: D * T, tOff: (1 - D) * T, f: fq };
    if (D <= 0 || D >= 1) {
      const i = D >= 1 ? Math.max(0, (U - emf) / R) : 0;
      res.iMin = res.iMax = res.iAvg = i; res.iPeak = i; return res;
    }
    const tau = L / R, aa = Math.exp(-D * T / tau), bb = Math.exp(-(1 - D) * T / tau);
    const iOn = (U - emf) / R, iOff = (0 - emf) / R;
    let iMax = (iOn * (1 - aa) + aa * iOff * (1 - bb)) / (1 - aa * bb);
    let iMin = iOff + (iMax - iOff) * bb;
    if (iMin < 0) { res.continuous = false; iMin = 0; iMax = Math.max(0, iOn * (1 - aa)); }
    res.iMin = iMin; res.iMax = iMax; res.ripple = iMax - iMin;
    res.iAvg = o.iAvg !== undefined && isFinite(num(o.iAvg, NaN)) ? num(o.iAvg, 0) : (iMax + iMin) / 2;
    res.iPeak = res.iAvg + res.ripple / 2;
    return res;
  }

  /* =====================================================================================================
   *  SCHRITTMOTOR
   * ===================================================================================================== */
  const stepPatterns = {
    voll: [[1, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]],
    halb: [[1, 0, 0, 0], [1, 0, 1, 0], [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 1], [0, 0, 0, 1], [1, 0, 0, 1]],
    wave: [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]],
    names: { voll: 'Vollschritt (2 Spulen)', halb: 'Halbschritt', wave: 'Wave-Drive (1 Spule)' }
  };
  Object.defineProperty(stepPatterns, 'names', { enumerable: false });
  function readPattern(p) {
    if (p === undefined || p === null) return null;
    if (typeof p === 'number') { p = Math.floor(num(p, 0)); return [p & 1 ? 1 : 0, p & 2 ? 1 : 0, p & 4 ? 1 : 0, p & 8 ? 1 : 0]; }
    if (typeof p === 'string') { const m = p.replace(/[^01]/g, ''); return [0, 1, 2, 3].map(function (k) { return m[k] === '1' ? 1 : 0; }); }
    if (Array.isArray(p)) return [0, 1, 2, 3].map(function (k) { return (p[k] === true || num(p[k], 0) > 0) ? 1 : 0; });
    if (typeof p === 'object') return [p.A1, p.A2, p.B1, p.B2].map(function (x) { return (x === true || num(x, 0) > 0) ? 1 : 0; });
    return null;
  }
  function decodePattern(p) {
    const q = readPattern(p) || [0, 0, 0, 0];
    const a = q[0] - q[1], b = q[2] - q[3], mag = hyp(a, b);
    return { a: a, b: b, mag: mag, on: mag > 0, angle: mag > 0 ? Math.atan2(b, a) : 0, coils: (a !== 0 ? 1 : 0) + (b !== 0 ? 1 : 0), bits: q };
  }
  Object.defineProperty(stepPatterns, 'decode', { value: decodePattern });
  Object.defineProperty(stepPatterns, 'read', { value: readPattern });
  function normStepMode(m) {
    m = String(m === undefined || m === null ? 'voll' : m).toLowerCase();
    if (m.indexOf('halb') === 0 || m === 'half') return 'halb';
    if (m.indexOf('wave') === 0 || m === 'welle' || m === 'ein') return 'wave';
    return 'voll';
  }
  function normDir(d) {
    if (typeof d === 'string') return /^(r|z|back|-|rev|links|neg)/i.test(d.trim()) ? -1 : 1;
    if (typeof d === 'boolean') return d ? 1 : -1;
    d = num(d, 1); return d < 0 ? -1 : 1;
  }

  const ST_DEFAULTS = {
    spr: 200, Mh: 0.40, iRated: 1.5, Rph: 2.0, Lph: 0.0035, J: 5.4e-6, Jload: 0, Mdet: 0.02, fc: 450, uRef: 24, uSupply: 24,
    expo: 1.6, fPi: 900, zeta: 0.1, Mf: 0.002, Cth: 30, Rth: 10, tempMax: 130, thermFactor: 1, tAmb: 25, resThresh: 0.5
  };
  function stSanitize(p) {
    p.spr = Math.max(4, Math.round(pos(p.spr, 200, 3) / 4) * 4);
    p.Mh = pos(p.Mh, 0.4, 0); p.iRated = pos(p.iRated, 1.5, 0); p.Rph = pos(p.Rph, 2, 0); p.Lph = pos(p.Lph, 0.0035, 0);
    p.J = pos(p.J, 5.4e-6, 1e-9); p.Jload = Math.max(0, num(p.Jload, 0)); p.Mdet = Math.max(0, num(p.Mdet, 0));
    p.fc = pos(p.fc, 450, 0); p.uRef = pos(p.uRef, 24, 0); p.uSupply = pos(p.uSupply, 24, 0); p.expo = pos(p.expo, 1.6, 0);
    p.fPi = pos(p.fPi, 900, 0); p.zeta = clamp(num(p.zeta, 0.1), 0.005, 2); p.Mf = Math.max(0, num(p.Mf, 0));
    p.Cth = pos(p.Cth, 30, 1e-3); p.Rth = pos(p.Rth, 10, 1e-4); p.thermFactor = clamp(num(p.thermFactor, 1), 0, 5000);
    return p;
  }
  function satCurrent(x) { x = Math.max(0, x); return x <= 1 ? x : 1 + 0.3 * (1 - Math.exp(-(x - 1) / 0.3)); }

  function stepper(params) {
    const pk = pickPreset(stepperPresets, params);
    let p = stSanitize(mixParams(ST_DEFAULTS, Object.assign({}, pk.base || {}, pk.over && typeof pk.over === 'object' ? pk.over : {})));
    let s, self;
    const stepFull = function () { return TWO_PI / p.spr; };
    const Nr = function () { return p.spr / 4; };
    function pullOut(f, current) {
      f = Math.max(0, num(f, 0));
      const I = current === undefined ? p.iRated : Math.max(0, num(current, p.iRated));
      const fc = p.fc * p.uSupply / p.uRef;
      return p.Mh * satCurrent(I / p.iRated) / (1 + Math.pow(f / fc, p.expo));
    }
    function pullIn(f, current) {
      f = Math.max(0, num(f, 0));
      const fPi = p.fPi * Math.sqrt(p.uSupply / p.uRef) / Math.sqrt(1 + p.Jload / p.J);
      return pullOut(f, current) * Math.max(0, 1 - (f / fPi) * (f / fPi));
    }
    function Jt() { return p.J + p.Jload; }
    function fRes() { return 0.8 * Math.sqrt(p.Mh * Nr() / Jt()) / TWO_PI; }
    function maxAccel(f, load) {
      return Math.max(0, (pullOut(f) - Math.abs(num(load, 0)) - p.Mf)) / Jt() / stepFull();
    }
    function reset() {
      const ang0 = decodePattern(stepPatterns.voll[0]).angle;
      s = {
        phi: ang0, theta: ang0 / Nr(), theta0: ang0 / Nr(), w: 0, idx: 0, mode: 'voll', pat: stepPatterns.voll[0].slice(), lastAng: ang0,
        steps: 0, fieldSteps: 0, spf: 1, stepAng: stepFull(), phase: 0, rEff: 0, tSince: 1, fEst: 0, slipN: 0, slipBase: 0, slips: 0,
        slipEvent: false, lagMean: 0, swing: 0, temp: p.tAmb, t: 0, lastPulse: false, current: p.iRated, load: 0, ncoil: 2, vib: 0,
        tq: 0, mpk: 0, coilOn: true, ampF: 1, wAvg: 0, fDir: 1
      };
      self = { acc: 0 };
    }
    function applyPattern(pat, countStep) {
      const dp = decodePattern(pat);
      s.pat = dp.bits.slice();
      s.coilOn = dp.on; s.ncoil = dp.coils; s.ampF = dp.on ? dp.mag / Math.SQRT2 : 0;
      if (!dp.on) return;
      let d = wrapPi(dp.angle - s.lastAng);
      if (Math.abs(d) > 3.1) d = PI;
      s.lastAng = dp.angle;
      if (Math.abs(d) < 1e-9) return;
      s.phi += d;
      s.fDir = sign(d); s.steps += sign(d); s.fieldSteps += d / (PI / 2);
      s.spf = Math.abs(d) < PI / 4 + 0.05 ? 2 : 1;
      s.stepAng = Math.abs(d) / Nr();
      const inst = Math.abs(d) / (PI / 2) / Math.max(s.tSince, 1e-4);
      s.fEst = s.fEst > 0 && s.tSince < 0.2 ? 0.5 * s.fEst + 0.5 * inst : inst;
      s.tSince = 0;
    }
    function switchMode(m) {
      if (m === s.mode) return;
      const tab = stepPatterns[m]; let best = 0, bd = 1e9;
      for (let k = 0; k < tab.length; k++) {
        const dp = decodePattern(tab[k]);
        const d = Math.abs(wrapPi(dp.angle - s.lastAng));
        if (d < bd) { bd = d; best = k; }
      }
      s.mode = m; s.idx = best;
    }
    function doStep(d) {
      const tab = stepPatterns[s.mode];
      s.idx = ((s.idx + d) % tab.length + tab.length) % tab.length;
      applyPattern(tab[s.idx], true);
    }
    function mechStep(h, inp) {
      s.tSince += h;
      const I = inp.current;
      const fc = p.fc * p.uSupply / p.uRef;
      const mpk = s.coilOn ? p.Mh * (s.ampF || 0) * satCurrent(I / p.iRated) / (1 + Math.pow(s.fEst / fc, p.expo)) : 0;
      const lagEl = s.phi - Nr() * s.theta;
      let tq = mpk * Math.sin(lagEl);
      tq -= p.Mdet * Math.sin(p.spr * s.theta);
      const tl = inp.loadType === 'gewicht' ? inp.load : inp.load * Math.tanh(s.w / 0.3);
      const c = 2 * p.zeta * Math.sqrt(p.Mh * Nr() * Jt());
      const wF = s.fDir * s.fEst * (PI / 2) / Nr();
      const net = tq - tl - p.Mf * Math.tanh(s.w / 0.3) - c * (s.w - wF);
      s.w += h * net / Jt();
      s.theta += h * s.w;
      s.tq = tq; s.mpk = mpk;
    }
    function tick(h, inp) {
      // Drehfeld im Auto-Betrieb (Schrittzeitpunkte exakt innerhalb des Teilschritts)
      let rest = h;
      if (!inp.manual) {
        const target = inp.run ? inp.rate : 0;
        if (isFinite(inp.accel)) {
          const dr = inp.accel * h;
          s.rEff = s.rEff < target ? Math.min(target, s.rEff + dr) : Math.max(target, s.rEff - dr);
        } else s.rEff = target;
        if (s.rEff > 0) {
          let guard = 0;
          while (guard++ < 8) {
            const tn = (1 - s.phase) / s.rEff;
            if (tn > rest + 1e-12) { mechStep(rest, inp); s.phase += s.rEff * rest; rest = 0; break; }
            mechStep(Math.max(0, tn), inp); rest -= Math.max(0, tn); s.phase = 0;
            doStep(inp.dir);
          }
        } else s.phase = 0;
      }
      if (rest > 1e-12) mechStep(rest, inp);
      if (!inp.manual && s.rEff > 0) s.fEst = s.rEff / s.spf;
      else {
        if (s.fEst > 0 && s.tSince > 2 / s.fEst) s.fEst *= Math.exp(-h / 0.004);
        if (s.fEst < 0.5 && s.tSince > 0.05) s.fEst = 0;
      }
      const lagEl = s.phi - Nr() * s.theta;
      // Schlupf-Erkennung (jeweils eine elektrische Periode)
      const x = lagEl / TWO_PI;
      while (x - s.slipN > 0.55) { s.slipN++; s.slips++; s.slipEvent = true; }
      while (x - s.slipN < -0.55) { s.slipN--; s.slips++; s.slipEvent = true; }
      // Schwingung/Resonanz
      const lagFull = lagEl / (PI / 2) - 4 * s.slipN;
      s.lagMean += (lagFull - s.lagMean) * h / 0.04;
      s.swing += (Math.abs(lagFull - s.lagMean) - s.swing) * h / 0.03;
      s.wAvg += (s.w - s.wAvg) * h / 0.05;
      // Waerme
      const pw = p.Rph * inp.current * inp.current * (s.ncoil || 0);
      s.temp += (pw - (s.temp - p.tAmb) / p.Rth) / p.Cth * h * p.thermFactor;
    }
    function state() {
      const lagEl = s.phi - Nr() * s.theta;
      const lostFull = 4 * Math.abs(s.slipN - s.slipBase);
      const lostSteps = lostFull * s.spf;
      const thetaRel = s.theta - s.theta0;
      const f = s.fEst;
      const faults = [];
      const overheat = s.temp > p.tempMax;
      const resonance = s.swing > p.resThresh && f > 2;
      const stalled = lostFull > 0 && Math.abs(s.wAvg) < 0.15 * Math.abs(f * stepFull()) && f > 5;
      if (lostSteps > 0) faults.push('schrittverlust');
      if (resonance) faults.push('resonanz');
      if (overheat) faults.push('ueberhitzung');
      const o = {
        t: s.t, theta: thetaRel, angle: thetaRel * 180 / PI, w: s.wAvg, wInst: s.w, rpm: rpmOf(s.wAvg), rpmInst: rpmOf(s.w), steps: s.steps, fieldSteps: s.fieldSteps,
        pos: Math.round(thetaRel / (s.stepAng || stepFull())), stepAngle: (s.stepAng || stepFull()) * 180 / PI, stepMode: s.mode,
        pattern: s.pat.slice(), lag: lagEl / (PI / 2) - 4 * s.slipN, lagDeg: (lagEl - TWO_PI * s.slipN) / Nr() * 180 / PI,
        lostSteps: lostSteps, slips: s.slips, slipEvent: s.slipEvent, torque: s.tq, torqueAvail: pullOut(f, s.current),
        torqueHold: s.coilOn ? p.Mh * (s.ampF || 0) * satCurrent(s.current / p.iRated) : 0, torquePullIn: pullIn(f, s.current),
        rate: f, current: s.current, temp: s.temp, vibration: s.swing, resonance: resonance, fRes: fRes(),
        stalled: stalled, overheat: overheat, faults: faults
      };
      return o;
    }
    function step(dtMs, inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const manual = inp.pattern !== undefined && inp.pattern !== null;
      s.load = Math.abs(num(inp.load, 0)); s.current = Math.max(0, num(inp.current, p.iRated));
      s.slipEvent = false;
      const tin = {
        manual: manual, rate: clamp(num(inp.rate, 0), 0, 20000), dir: normDir(inp.dir === undefined ? 1 : inp.dir),
        run: inp.run === undefined ? num(inp.rate, 0) > 0 : bool(inp.run), accel: inp.accel === undefined ? Infinity : Math.max(1, num(inp.accel, Infinity)),
        current: s.current, load: s.load, loadType: inp.loadType === 'gewicht' ? 'gewicht' : 'reibung'
      };
      if (!isFinite(tin.accel)) tin.accel = Infinity;
      if (manual) {
        const pat = readPattern(inp.pattern);
        if (pat.join('') !== s.pat.join('')) applyPattern(pat, true);
      } else {
        const m = normStepMode(inp.stepMode);
        if (m !== s.mode) switchMode(m);
        const pu = bool(inp.pulse);
        if (pu && !s.lastPulse) doStep(tin.dir);
        s.lastPulse = pu;
      }
      const n = advance(self, dtMs, 0.125, function (h) { tick(h, tin); });
      s.t += n * 0.125;
      return state();
    }
    function pulse(dir) { switchMode(s.mode); doStep(normDir(dir === undefined ? 1 : dir)); return state(); }
    function curve(o) {
      o = o && typeof o === 'object' ? o : {};
      const fMax = pos(o.fMax, 3000, 0), n = clamp(Math.round(num(o.n, 60)), 2, 500);
      const po = [], pi = [];
      for (let k = 0; k <= n; k++) { const f = fMax * k / n; po.push([f, pullOut(f, o.current)]); pi.push([f, pullIn(f, o.current)]); }
      return { pullOut: po, pullIn: pi };
    }
    reset();
    return {
      step: step, state: state, reset: reset, pulse: pulse, pullOut: pullOut, pullIn: pullIn, curve: curve, maxAccel: maxAccel, fRes: fRes,
      clearLoss: function () { s.slipBase = s.slipN; },
      get params() { return Object.assign({}, p); },
      setParams: function (q) { p = stSanitize(mixParams(p, q)); }
    };
  }

  const stepperPresets = listWithIds([
    { id: 'nema14', name: 'Schrittmotor NEMA 14 (klein)', params: { Mh: 0.13, iRated: 1.0, Rph: 2.8, Lph: 0.0025, J: 1.5e-6, Mdet: 0.007, fc: 600, fPi: 1100, Cth: 20, Rth: 14 } },
    { id: 'nema17', name: 'Schrittmotor NEMA 17 (0,4 Nm)', params: { Mh: 0.40, iRated: 1.5, Rph: 2.0, Lph: 0.0035, J: 5.4e-6, Mdet: 0.02, fc: 450, fPi: 900, Cth: 30, Rth: 10 } },
    { id: 'nema23', name: 'Schrittmotor NEMA 23 (1,3 Nm)', params: { Mh: 1.26, iRated: 2.8, Rph: 0.9, Lph: 0.0025, J: 3.0e-5, Mdet: 0.05, fc: 350, fPi: 650, Cth: 80, Rth: 6 } }
  ]);

  /* =====================================================================================================
   *  SERVO
   * ===================================================================================================== */
  const SERVO_DEFAULTS = {
    N: 200, etaG: 0.6, Jout: 3e-5, uMax: 4.8, kp: 9, ki: 0, kd: 0.05, db: 0.9, tCtrl: 2, kickNm: 0, tempMax: 130, thermFactor: 1
  };
  const servoPulse = {
    toAngle: function (ms) { return (clamp(num(ms, 1.5), 0.5, 2.5) - 1.5) * 90; },
    fromAngle: function (deg) { return 1.5 + clamp(num(deg, 0), -90, 90) / 90; }
  };
  function servoParams(params) {
    const pk = pickPreset(servoPresets, params);
    const merged = Object.assign({}, pk.base || {}, pk.over && typeof pk.over === 'object' ? pk.over : {});
    const p = mixParams(SERVO_DEFAULTS, merged);
    const mo = Object.assign({}, (pk.base && pk.base.motor) || {}, merged.motor && typeof merged.motor === 'object' ? merged.motor : {});
    p.motor = dcSanitize(mixParams(Object.assign({}, DC_DEFAULTS, { Ra: 6.8, La: 0.0008, Ke: 0.0021, J: 2e-8, Mc: 4.5e-5, B: 1e-9, Cth: 3, Rth: 35, uNom: 4.8 }), mo));
    p.motor.thermFactor = clamp(num(p.thermFactor, 1), 0, 5000); p.motor.tempMax = p.tempMax;
    p.N = pos(p.N, 200, 0); p.etaG = clamp(num(p.etaG, 0.6), 0.05, 1); p.Jout = Math.max(0, num(p.Jout, 3e-5));
    p.uMax = pos(p.uMax, 4.8, 0); p.tCtrl = clamp(num(p.tCtrl, 2), 0.5, 50);
    const lim = Array.isArray(merged.limits) ? [num(merged.limits[0], NaN), num(merged.limits[1], NaN)] : null;
    p.limits = lim && isFinite(lim[0]) && isFinite(lim[1]) && lim[0] < lim[1] ? lim : null;
    return p;
  }
  function servo(params) {
    let p = servoParams(params);
    let s, self, c, mode, kicks;
    function reset() {
      s = { i: 0, w: 0, theta: 0, temp: p.motor.tAmb, stuck: false, pHeat: 0, Ra: p.motor.Ra };
      self = { acc: 0 };
      c = {
        t: 0, integ: 0, uHold: 0, cnt: 0, tgt: 0, setpoint: 0, pulse: 1.5, period: 20, saturated: false, atStop: false, lastDisturb: false,
        meas: null, overshoot: 0, settle: 0, settled: true, rise: 0, errSign: 0, cross: [], amp: 0, stallT: 0, ovlT: 0, uCmd: 0, tOsc: 0
      };
      mode = 'rc'; kicks = { nm: 0, ms: 0 };
      c.kickDefault = 0;
    }
    function limitsFor(m) { return p.limits || (m === 'rc' ? [-95, 95] : [-190, 190]); }
    function defaultKick(uMax) { return p.kickNm > 0 ? p.kickNm : 0.5 * p.motor.Ke * (uMax / p.motor.Ra) * p.N * p.etaG; }
    function startMeasure(tgt, from) {
      const amp = tgt - from;
      if (Math.abs(amp) < 0.5) { return; }
      c.meas = { t0: c.t, a0: from, tgt: tgt, amp: amp, peak: 0, t10: null, t90: null, tLastOut: c.t, inSince: null };
      c.overshoot = 0; c.settle = 0; c.settled = false; c.rise = 0;
    }
    function updateMeasure(angDeg) {
      const m = c.meas; if (!m) return;
      const sg = sign(m.amp), band = Math.max(0.02 * Math.abs(m.amp), 1.0);
      const over = (angDeg - m.tgt) * sg;
      if (over > m.peak) m.peak = over;
      c.overshoot = m.peak / Math.abs(m.amp) * 100;
      const frac = (angDeg - m.a0) / m.amp;
      if (m.t10 === null && frac >= 0.1) m.t10 = c.t;
      if (m.t90 === null && frac >= 0.9) { m.t90 = c.t; c.rise = m.t10 !== null ? (m.t90 - m.t10) : 0; }
      if (Math.abs(angDeg - m.tgt) > band) { m.tLastOut = c.t; m.inSince = null; }
      else if (m.inSince === null) m.inSince = c.t;
      const settled = m.inSince !== null && c.t - m.inSince >= 0.2;
      c.settled = settled;
      c.settle = settled ? m.tLastOut - m.t0 : c.t - m.t0;
    }
    function tick(h, inp) {
      const N = p.N, pm = p.motor;
      const lim = limitsFor(inp.mode);
      let thOut = s.theta / N;
      const wOut = s.w / N;
      if (c.cnt <= 0) {
        const eRad = (inp.target - thOut * 180 / PI) * PI / 180;
        let u;
        if (inp.mode === 'rc') {
          u = Math.abs(eRad * 180 / PI) < p.db ? 0 : inp.kp * eRad - inp.kd * wOut;
          c.integ = 0;
        } else {
          const dt = p.tCtrl / 1000;
          const uNoI = inp.kp * eRad - inp.kd * wOut;
          let integ = c.integ + eRad * dt;
          if (inp.ki > 0) integ = clamp(integ, -inp.uMax / inp.ki, inp.uMax / inp.ki); else integ = 0;
          u = uNoI + inp.ki * integ;
          if (Math.abs(u) < inp.uMax || sign(u) !== sign(eRad)) c.integ = integ;
        }
        c.saturated = Math.abs(u) >= inp.uMax * 0.999;
        c.uHold = clamp(u, -inp.uMax, inp.uMax);
        c.cnt = Math.max(1, Math.round(p.tCtrl / (h * 1000)));
      }
      c.cnt--;
      let text = inp.load, kickT = 0;
      if (kicks.ms > 0) { kickT = kicks.nm; kicks.ms -= h * 1000; }
      text += kickT;
      const g = text * s.w >= 0 ? 1 / p.etaG : p.etaG;
      dcTick(pm, s, h, { u: c.uHold, fr: 0, text: text / N * g, fanB: 0, open: false, Jt: pm.J + p.Jout / (N * N) });
      thOut = s.theta / N;
      const mx = lim[1] * PI / 180, mn = lim[0] * PI / 180;
      c.atStop = false;
      if (thOut > mx) { s.theta = mx * N; if (s.w > 0) s.w = 0; c.atStop = true; }
      else if (thOut < mn) { s.theta = mn * N; if (s.w < 0) s.w = 0; c.atStop = true; }
      c.t += h;
      const ang = s.theta / N * 180 / PI, err = inp.target - ang;
      updateMeasure(ang);
      // Schwingungserkennung
      const sg = err > 0.4 ? 1 : err < -0.4 ? -1 : 0;
      if (sg !== 0 && sg !== c.errSign) { if (c.errSign !== 0) c.cross.push(c.t); c.errSign = sg; }
      while (c.cross.length && c.t - c.cross[0] > 0.6) c.cross.shift();
      c.amp += (Math.abs(err) - c.amp) * h / 0.1;
      // Blockieren / Ueberlast
      const blocked = Math.abs(s.w) < 0.5 * N * 0.01 && Math.abs(c.uHold) > 0.9 * inp.uMax && Math.abs(err) > 2;
      c.stallT = blocked ? c.stallT + h : Math.max(0, c.stallT - h);
    }
    function state() {
      const N = p.N, pm = p.motor;
      const ang = s.theta / N * 180 / PI;
      const em = pm.Ke * s.i;
      const tOut = (em - pm.B * s.w - pm.Mc * sign(s.w || em)) * N * p.etaG;
      const faults = [];
      const oscillating = c.cross.length >= 4 && c.amp > 0.5;
      const overheat = s.temp > pm.tempMax;
      const stalled = c.stallT > 0.3, overload = overheat || c.stallT > 1.5;
      if (oscillating) faults.push('schwingt');
      if (c.atStop && Math.abs(c.uHold) > 0.3 * (c.uMaxLast || 1)) faults.push('anschlag');
      if (stalled) faults.push('blockiert');
      if (overload) faults.push('ueberlast');
      if (overheat) faults.push('ueberhitzung');
      return {
        t: c.t, mode: mode, pulse: c.pulse, period: c.period, target: c.tgt, setpoint: c.setpoint, angle: ang, theta: s.theta / N, error: c.tgt - ang,
        w: s.w / N, rpm: rpmOf(s.w / N), rpmMotor: rpmOf(s.w), i: s.i, u: c.uHold, torque: tOut, temp: s.temp, overshoot: c.overshoot,
        settle: c.settle, settled: c.settled, riseTime: c.rise, oscillating: oscillating, saturated: c.saturated, atStop: c.atStop,
        stalled: stalled, overload: overload, overheat: overheat, faults: faults
      };
    }
    function step(dtMs, inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const m = inp.mode === 'regler' || inp.mode === 'pid' ? 'regler' : (inp.mode === 'rc' ? 'rc' : mode);
      if (m !== mode) { mode = m; }
      let tgt;
      if (mode === 'rc') {
        c.pulse = clamp(num(inp.pulse, c.pulse), 0.5, 2.5); c.period = clamp(num(inp.period, c.period), 5, 100);
        tgt = servoPulse.toAngle(c.pulse); c.setpoint = tgt;
      } else {
        c.setpoint = clamp(num(inp.setpoint, c.setpoint), -180, 180); tgt = c.setpoint;
      }
      const lim = limitsFor(mode);
      tgt = clamp(tgt, lim[0], lim[1]);
      const uMax = pos(inp.uMax, p.uMax, 0); c.uMaxLast = uMax;
      if (Math.abs(tgt - c.tgt) > 0.5) {
        startMeasure(tgt, s.theta / p.N * 180 / PI);
      }
      c.tgt = tgt;
      const dist = bool(inp.disturb);
      if (dist && !c.lastDisturb) kicks = { nm: defaultKick(uMax), ms: 120 };
      c.lastDisturb = dist;
      const tin = {
        mode: mode, target: tgt, kp: Math.max(0, num(inp.kp, p.kp)), ki: Math.max(0, num(inp.ki, p.ki)), kd: Math.max(0, num(inp.kd, p.kd)),
        uMax: uMax, load: num(inp.load, 0)
      };
      advance(self, dtMs, 0.5, function (h) { tick(h, tin); });
      return state();
    }
    reset();
    return {
      step: step, state: state, reset: reset,
      kick: function (nm, ms) { kicks = { nm: num(nm, 0), ms: Math.max(0, num(ms, 100)) }; },
      get params() { return Object.assign({}, p); },
      setParams: function (q) { p = servoParams(Object.assign({}, p, q)); }
    };
  }
  function servoStepResponse(params, gains, stepDeg, tEndMs) {
    const sv = servo(params), g = gains && typeof gains === 'object' ? gains : {};
    const target = clamp(num(stepDeg, 45), -180, 180), tEnd = clamp(num(tEndMs, 1500), 100, 20000);
    const pts = [], dt = 5;
    const inp = { mode: 'regler', setpoint: 0, kp: g.kp, ki: g.ki, kd: g.kd, load: num(g.load, 0) };
    sv.step(20, inp);
    inp.setpoint = target;
    let st = sv.state();
    for (let t = 0; t <= tEnd + 1e-9; t += dt) {
      st = sv.step(t === 0 ? 0.0001 : dt, inp);
      pts.push([t / 1000, st.angle]);
    }
    return { points: pts, overshoot: st.overshoot, settle: st.settle, riseTime: st.riseTime, target: target };
  }
  const servoPresets = listWithIds([
    { id: 'micro', name: 'Mikro-Servo 9 g (1,8 kg·cm)', info: 'Kleiner Modellbau-Servo, 0,1 s/60° bei 4,8 V.',
      params: { motor: { Ra: 6.8, La: 0.0008, Ke: 0.0021, J: 2e-8, Mc: 4.5e-5, B: 1e-9, Cth: 3, Rth: 35, uNom: 4.8 }, N: 200, etaG: 0.6, Jout: 3e-5, uMax: 4.8, kp: 9, ki: 0, kd: 0.05, db: 0.9 } },
    { id: 'standard', name: 'Standard-Servo (6 kg·cm)', info: 'Modellbau-Standardservo, 0,16 s/60° bei 6 V.',
      params: { motor: { Ra: 5, La: 0.001, Ke: 0.0033, J: 6e-8, Mc: 1.2e-4, B: 3e-9, Cth: 8, Rth: 25, uNom: 6 }, N: 250, etaG: 0.62, Jout: 2e-4, uMax: 6, kp: 6, ki: 0, kd: 0.05, db: 0.9 } },
    { id: 'kraft', name: 'Kraft-Servo (17 kg·cm)', info: 'Servo mit Metallgetriebe, langsamer, aber sehr kräftig.',
      params: { motor: { Ra: 2.6, La: 0.0012, Ke: 0.0042, J: 2.2e-7, Mc: 3e-4, B: 1e-8, Cth: 20, Rth: 12, uNom: 6 }, N: 300, etaG: 0.6, Jout: 6e-4, uMax: 6, kp: 5, ki: 0, kd: 0.05, db: 0.9 } }
  ]);

  /* =====================================================================================================
   *  DREHSTROM-ASYNCHRONMOTOR
   * ===================================================================================================== */
  const AC_DEFAULTS = {
    P: 1500, uDelta: 400, fN: 50, pp: 2, nN: 1420, eta: 0.82, cosphi: 0.78, iN: 3.4, lambdaK: 2.5, iaRatio: 6.0, J: 0.0045, Jload: 0.0045,
    boost: 0.07, tempMax: 130, thermFactor: 1, tAmb: 25, connection: 'dreieck', fuIlim: 1.5, fuTripS: 3, kappa: 1.0
  };
  function acSanitize(p) {
    p.P = pos(p.P, 1500, 0); p.uDelta = pos(p.uDelta, 400, 0); p.fN = pos(p.fN, 50, 0); p.pp = Math.max(1, Math.round(num(p.pp, 2)));
    const ns = 60 * p.fN / p.pp;
    p.nN = clamp(num(p.nN, 1420), 0.5 * ns, 0.995 * ns);
    p.eta = clamp(num(p.eta, 0.82), 0.3, 0.97); p.cosphi = clamp(num(p.cosphi, 0.78), 0.3, 0.98);
    p.iN = num(p.iN, 0) > 0 ? num(p.iN, 0) : p.P / p.eta / (SQ3 * p.uDelta * p.cosphi);
    p.lambdaK = clamp(num(p.lambdaK, 2.5), 1.5, 4); p.iaRatio = clamp(num(p.iaRatio, 6), 2, 12);
    p.J = pos(p.J, 0.0045, 1e-6); p.Jload = Math.max(0, num(p.Jload, 0));
    p.boost = clamp(num(p.boost, 0.07) > 1 ? num(p.boost, 7) / 100 : num(p.boost, 0.07), 0, 0.3);
    p.thermFactor = clamp(num(p.thermFactor, 1), 0, 5000); p.kappa = clamp(num(p.kappa, 1), 0, 2); p.fuIlim = pos(p.fuIlim, 1.5, 0.5); p.fuTripS = pos(p.fuTripS, 3, 0);
    p.connection = normConn(p.connection) === 'stern' ? 'stern' : 'dreieck';
    return p;
  }
  function normConn(c) {
    if (typeof c !== 'string') return 'dreieck';
    c = c.trim().toLowerCase();
    return (c[0] === 's' || c[0] === 'y' || c === 'star') ? 'stern' : 'dreieck';
  }
  function normVf(v) {
    v = String(v === undefined || v === null ? 'konstant' : v).toLowerCase();
    if (v.indexOf('boost') === 0) return 'boost';
    if (v.indexOf('quad') === 0) return 'quad';
    return 'konstant';
  }
  function acDerive(p) {
    const d = {};
    d.wN = omegaOf(p.nN); d.MN = p.P / d.wN; d.ns = 60 * p.fN / p.pp; d.ws0 = TWO_PI * p.fN / p.pp;
    d.sN = clamp((d.ns - p.nN) / d.ns, 0.004, 0.4);
    const lam = p.lambdaK;
    d.Mk0 = lam * d.MN; d.kappa = p.kappa;
    d.sk0 = d.sN * (lam + Math.sqrt(lam * lam - 1)) / (1 + d.kappa * d.sN);
    d.wk = d.sk0 * d.ws0;
    d.wkb = d.kappa * d.sk0 < 0.95 ? d.wk / (1 - d.kappa * d.sk0) : d.wk * 20;
    d.UphN = p.uDelta; d.iN = p.iN; d.IphN = p.iN / SQ3;
    const pin = p.P / p.eta;
    d.pinN = pin;
    d.Re = Math.min(pin / (3 * d.UphN), 0.97 * d.IphN);
    d.cosN = d.Re / d.IphN; d.ImN = Math.sqrt(Math.max(1e-9, d.IphN * d.IphN - d.Re * d.Re));
    const Ptot = Math.max(1, pin - p.P);
    d.PfricN = 0.10 * Ptot; d.PfeN = 0.20 * Ptot;
    const pcu2 = d.sN * (p.P + d.PfricN) / (1 - d.sN);
    d.Pcu2N = pcu2;
    d.Pcu1N = Math.max(0.15 * Ptot, Ptot - d.PfricN - d.PfeN - pcu2);
    d.Rs = d.Pcu1N / (3 * d.IphN * d.IphN);
    d.rsPu = clamp(d.Rs * d.IphN / d.UphN, 0.01, 0.12);
    d.Mf = d.PfricN / d.wN;
    // Stromkalibrierung (Rotorstrom ~ Schlupfdrehzahl, Knie wkI, Endwert Iinf)
    const Ife = d.PfeN / (3 * d.UphN), wrN = d.sN * d.ws0;
    let Iinf = p.iaRatio * d.IphN, k = d.wk, Imu = 0.4 * d.IphN;
    for (let it = 0; it < 60; it++) {
      const reN = Math.max(1e-6, d.Re - Ife), rho = clamp(reN / Iinf, 0.001, 0.49);
      const a = (1 - Math.sqrt(1 - 4 * rho * rho)) / (2 * rho);
      k = wrN / a;
      const I2N = Iinf * a / Math.sqrt(1 + a * a), s2N = a / Math.sqrt(1 + a * a);
      Imu = Math.max(0.25 * d.IphN, d.ImN - I2N * s2N);
      const r = d.ws0, den = Math.sqrt(r * r + k * k);
      const I2s = Iinf * r / den, c2 = k / den, s2 = r / den;
      const I1s = hyp(Ife + I2s * c2, Imu + I2s * s2);
      Iinf *= 1 + 0.7 * (p.iaRatio * d.IphN / I1s - 1);
    }
    d.Iinf = Iinf; d.wkI = k; d.Imu0 = Imu; d.Ife0 = Ife;
    d.Cth = 800 * p.P / 1000 + 150; d.Rth = 80 / Ptot;
    d.iNLine = p.iN;
    return d;
  }

  function induction(params) {
    const pk = pickPreset(acPresets, params);
    let p = acSanitize(mixParams(AC_DEFAULTS, Object.assign({}, pk.base || {}, pk.over && typeof pk.over === 'object' ? pk.over : {})));
    let d = acDerive(p);
    let s, self, last;

    /* Betriebspunkt bei Rotordrehzahl w [rad/s] und Speisung sup { on, uPh, f (Hz, vorzeichenbehaftet), fu, phaseLoss, conn } */
    function ev(w, sup, iPrev) {
      const r = { M: 0, I1: 0, iLine: 0, pin: 0, pcu1: 0, pcu2: 0, pfe: 0, psi: 0, ws: 0, wr: 0, Mk: 0, cosphi: 0, uOverFlag: false };
      if (!sup.on || Math.abs(sup.f) < 0.2) return r;
      const fr = Math.abs(sup.f) / p.fN, ws = TWO_PI * sup.f / p.pp, dirS = ws >= 0 ? 1 : -1;
      const u = sup.uPh / d.UphN;
      let psiRaw;
      if (sup.fu) {
        const iEst = clamp(iPrev, 0.4, 1.2);
        psiRaw = Math.max(0, (u - d.rsPu * iEst) / (1 - d.rsPu)) / fr;
      } else psiRaw = u / fr;
      const psiT = Math.min(psiRaw, 1.25);
      const wr = ws - w, Mk = d.Mk0 * psiT * psiT;
      const K = function (x) { if (Math.abs(x) < 1e-9) return 0; const wkx = d.wk * (1 + d.kappa * Math.abs(x) / d.ws0); return 2 * Mk / (x / wkx + wkx / x); };
      let M;
      if (sup.phaseLoss) {
        const uu = clamp(Math.abs(w) / Math.abs(ws), 0, 1);
        M = (0.45 + 0.15 * uu) * K(ws - w) - 0.45 * Math.pow(1 - uu, 1.5) * K(ws + w);
        if (w * ws < 0) M = 0.45 * K(ws - w);
      } else M = K(wr);
      // Strom
      const rr = Math.abs(wr), den = Math.sqrt(rr * rr + d.wkI * d.wkI);
      const I2 = psiT * d.Iinf * rr / den, c2 = d.wkI / den, s2 = rr / den;
      const motoring = wr * dirS >= 0 ? 1 : -1;
      const sat = psiRaw + 3 * Math.max(0, psiRaw - 1) * Math.max(0, psiRaw - 1);
      const Imu = d.Imu0 * sat;
      const pfe = d.PfeN * psiRaw * psiRaw * Math.pow(fr, 1.5);
      const Ife = pfe / (3 * Math.max(sup.uPh, 0.05 * d.UphN));
      let I1 = hyp(Ife + motoring * I2 * c2, Imu + I2 * s2);
      let kPL = 1;
      if (sup.phaseLoss) kPL = 0.87 + 1.0 * clamp(1 - rr / Math.max(Math.abs(ws), 1e-6), 0, 1);
      I1 *= kPL;
      const iLine = sup.conn === 'stern' ? I1 : SQ3 * I1;
      const pcu2 = Math.abs(M * wr), pcu1 = 3 * d.Rs * I1 * I1;
      const pmech = M * w;
      const pin = pmech + pcu2 + pcu1 + pfe;
      const S = 3 * sup.uPh * I1;
      r.M = M; r.I1 = I1; r.iLine = iLine; r.pin = pin; r.pcu1 = pcu1; r.pcu2 = pcu2; r.pfe = pfe; r.psi = psiRaw; r.ws = ws; r.wr = wr; r.Mk = Mk;
      r.cosphi = S > 1e-6 ? clamp(pin / S, 0, 1) : 0; r.uOverFlag = u > 1.15 && fr <= 1.0001;
      return r;
    }
    function mfric(w) { return d.Mf * w / d.wN; }
    function supplyFor(inp, h) {
      const src = inp.source === 'fu' ? 'fu' : 'netz';
      const rev = bool(inp.reverse);
      const sup = { on: false, uPh: 0, f: 0, fu: src === 'fu', phaseLoss: false, conn: 'dreieck', short: false, uLine: 0, label: 'dreieck', source: src };
      if (src === 'netz') {
        const uL = Math.max(0, num(inp.uMains, 400)), fm = pos(inp.fMains, 50, 0);
        sup.uLine = uL; sup.f = rev ? -fm : fm;
        const hasK = inp.K1 !== undefined || inp.K2 !== undefined || inp.K3 !== undefined;
        if (hasK) {
          const K1 = bool(inp.K1), K2 = bool(inp.K2), K3 = bool(inp.K3);
          if (K2 && K3) { sup.short = true; sup.label = 'kurzschluss'; sup.conn = 'dreieck'; }
          else if (K2) { sup.conn = 'stern'; sup.label = 'stern'; }
          else if (K3) { sup.conn = 'dreieck'; sup.label = 'dreieck'; }
          else sup.label = 'offen';
          sup.on = K1 && !sup.short && (K2 || K3);
        } else {
          sup.conn = normConn(inp.connection === undefined ? p.connection : inp.connection); sup.label = sup.conn;
          sup.on = inp.K1 === undefined ? true : bool(inp.K1);
        }
        sup.phaseLoss = bool(inp.phaseLoss);
        s.fOut = sup.f;
      } else {
        const enable = inp.enable === undefined ? true : bool(inp.enable);
        if (bool(inp.fuReset)) { s.fuFault = false; s.fuAcc = 0; }
        sup.conn = normConn(inp.connection === undefined ? p.connection : inp.connection); sup.label = sup.conn;
        const fT = enable ? clamp(num(inp.freq, 0), 0, 87) * (rev ? -1 : 1) : 0;
        const ramp = Math.max(0.05, num(inp.ramp, 2)), rate = p.fN / ramp;
        s.fuLimiting = false;
        if (!s.fuFault) {
          const dif = fT - s.fOut;
          let stp = clamp(dif, -rate * h, rate * h);
          const accelerating = Math.abs(s.fOut + stp) > Math.abs(s.fOut);
          const iRatio = s.iLine / d.iN;
          if (accelerating && iRatio > p.fuIlim) { stp = 0; s.fuLimiting = true; }
          s.fOut += stp;
          s.fuAcc = s.fuLimiting ? s.fuAcc + h : Math.max(0, s.fuAcc - 0.5 * h);
          if (s.fuAcc > p.fuTripS) s.fuFault = true;
        } else s.fOut = Math.max(0, Math.abs(s.fOut) - rate * h) * sign(s.fOut);
        sup.f = s.fOut;
        const fr = Math.abs(sup.f) / p.fN, vf = normVf(inp.vf);
        let b = inp.boost === undefined ? p.boost : num(inp.boost, p.boost); if (b > 1) b /= 100; b = clamp(b, 0, 0.3);
        let upu = vf === 'boost' ? b + (1 - b) * fr : vf === 'quad' ? 0.04 + 0.96 * fr * fr : fr;
        upu = Math.min(1, upu);
        const uN = sup.conn === 'stern' ? p.uDelta * SQ3 : p.uDelta;
        sup.uLine = Math.min(upu * uN, Math.max(0, num(inp.uMains, 400)));
        sup.on = !s.fuFault && Math.abs(sup.f) >= 0.2;
      }
      sup.uPh = sup.conn === 'stern' ? sup.uLine / SQ3 : sup.uLine;
      return sup;
    }
    function reset() {
      s = { w: 0, theta: 0, temp: p.tAmb, fOut: 0, iRatio: 0, iLine: 0, tipped: false, fuFault: false, fuAcc: 0, fuLimiting: false, accel: 0, stuck: false, uEff: 0 };
      self = { acc: 0 };
      last = { t: 0, sup: { on: false, uPh: 0, f: 0, fu: false, phaseLoss: false, conn: 'dreieck', label: 'offen', uLine: 0, source: 'netz', short: false }, r: ev(0, { on: false }, 0), load: 0, torque: 0 };
    }
    function tick(h, inp) {
      const sup = supplyFor(inp, h);
      if (sup.short) {                       // Kurzschluss: Netz bricht zusammen, kein Moment
        const r0 = ev(0, { on: false }, 0);
        r0.iLine = 20 * d.iN; r0.pin = 0; last.r = r0; last.sup = sup; s.iLine = r0.iLine;
        mech(h, inp, sup, r0);
        return;
      }
      const r0 = ev(s.w, sup, s.iRatio);
      mech(h, inp, sup, r0);
    }
    function mech(h, inp, sup, r0) {
      const Jt = p.J + p.Jload;
      const load = Math.abs(num(inp.load, 0)), fan = Math.abs(num(inp.fan, 0));
      const w0 = s.w;
      let M0 = r0.M - mfric(w0), dirn = 0, stuck = false, w1;
      if (Math.abs(w0) < WEPS) { if (Math.abs(M0) <= load) { stuck = true; w1 = 0; } else dirn = sign(M0); } else dirn = sign(w0);
      if (!stuck) {
        const tl = dirn * (load + fan * (w0 / d.wN) * (w0 / d.wN));
        const net = M0 - tl;
        let slope = 0;
        if (sup.on) { const r1 = ev(w0 + 0.5, sup, s.iRatio); slope = (r1.M - r0.M) / 0.5 - d.Mf / d.wN; }
        w1 = slope < 0 ? w0 + h * net / (Jt - h * slope) : w0 + h * net / Jt;
        if (w0 !== 0 && w1 * w0 < 0) w1 = 0;
      }
      s.accel = (w1 - w0) / h; s.w = w1; s.theta += w1 * h; s.stuck = stuck;
      const r = sup.short ? last.r : ev(w1, sup, s.iRatio);
      last.r = r; last.sup = sup; last.load = load;
      if (!sup.short) { s.iRatio = r.I1 / d.IphN; s.iLine = r.iLine; }
      // Kippen
      const wrA = Math.abs(r.wr);
      if (sup.on && !sup.short) {
        if (wrA > d.wkb && s.accel < 0.5 && Math.abs(r.ws) > 1) s.tipped = true;
        else if (wrA < 0.8 * d.wkb) s.tipped = false;
        if (Math.abs(w1) < 1 && Math.abs(r.ws) > 1 && wrA > d.wkb * 0.5 && load > 0 && Math.abs(r.M) <= load + d.Mf) s.tipped = true;
      } else s.tipped = false;
      // Thermik
      const pheat = sup.short ? 0 : r.pcu1 + r.pcu2 + r.pfe;
      const cool = (0.35 + 0.65 * Math.min(1, Math.abs(w1) / d.wN)) / d.Rth;
      s.temp += (pheat - (s.temp - p.tAmb) * cool) / d.Cth * h * p.thermFactor;
    }
    function state() {
      const r = last.r, sup = last.sup, w = s.w;
      const torque = r.M - mfric(w);
      const pMech = torque * w;
      const eta = r.pin > 10 && pMech > 0 ? clamp(pMech / r.pin, 0, 1) : 0;
      const nSync = sup.on ? 60 * Math.abs(sup.f) / p.pp : 0;
      const ws = sup.on ? TWO_PI * sup.f / p.pp : 0;
      const slip = sup.on && Math.abs(ws) > 1e-6 ? (ws - w) / ws : 0;
      const stalled = sup.on && Math.abs(w) < 0.03 * d.ws0 && Math.abs(ws) > 1;
      const faults = [];
      const overheat = s.temp > p.tempMax;
      if (sup.short) faults.push('kurzschluss');
      if (s.tipped) faults.push('kippt');
      if (overheat) faults.push('ueberhitzung');
      if (s.fuFault) faults.push('fu');
      if (sup.phaseLoss && sup.on) faults.push('phasenausfall');
      if (r.uOverFlag) faults.push('ueberspannung');
      const o = {
        t: last.t, w: w, rpm: rpmOf(w), slip: slip, slipPct: slip * 100, torque: torque, torqueEm: r.M, iLine: r.iLine, iPhase: r.I1, cosphi: r.cosphi,
        pElec: r.pin, pMech: pMech, eta: eta, temp: s.temp, uMotor: sup.on ? sup.uLine : (sup.short ? 0 : sup.uLine * 0), uWinding: sup.on ? sup.uPh : 0,
        fMotor: Math.abs(sup.f), fSigned: sup.f, nSync: nSync, connection: sup.label, source: sup.source, on: !!sup.on, tipped: s.tipped,
        stalled: stalled, hum: (s.tipped || stalled) && sup.on, fuFault: s.fuFault, fuLimiting: s.fuLimiting, regen: sup.on && r.pin < -1,
        phaseLost: !!(sup.phaseLoss && sup.on), overheat: overheat, overvoltage: r.uOverFlag, mk: r.Mk, theta: s.theta, faults: faults
      };
      if (sup.short) { o.iLine = last.r.iLine; o.uMotor = 0; }
      return o;
    }
    function step(dtMs, inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const n = advance(self, dtMs, 0.5, function (h) { tick(h, inp); });
      last.t += n * 0.5;
      return state();
    }
    function supplyStatic(cfg) {
      cfg = cfg && typeof cfg === 'object' ? cfg : {};
      const fu = cfg.source === 'fu';
      const conn = normConn(cfg.connection === undefined ? p.connection : cfg.connection);
      const sup = { on: true, fu: fu, phaseLoss: !fu && bool(cfg.phaseLoss), conn: conn, uPh: 0, f: 0, uLine: 0 };
      if (!fu) {
        sup.uLine = Math.max(0, num(cfg.uMains, 400)); sup.f = pos(cfg.fMains, 50, 0);
      } else {
        const f = clamp(num(cfg.f !== undefined ? cfg.f : cfg.freq, 50), 0, 87), fr = f / p.fN, vf = normVf(cfg.vf);
        let b = cfg.boost === undefined ? p.boost : num(cfg.boost, p.boost); if (b > 1) b /= 100; b = clamp(b, 0, 0.3);
        const upu = Math.min(1, vf === 'boost' ? b + (1 - b) * fr : vf === 'quad' ? 0.04 + 0.96 * fr * fr : fr);
        sup.f = f; sup.uLine = Math.min(upu * (conn === 'stern' ? p.uDelta * SQ3 : p.uDelta), Math.max(0, num(cfg.uMains, 400)));
      }
      sup.uPh = conn === 'stern' ? sup.uLine / SQ3 : sup.uLine;
      return sup;
    }
    function curves(cfg) {
      const sup = supplyStatic(cfg), n = clamp(Math.round(num(cfg && cfg.n, 80)), 4, 600);
      const nS = 60 * Math.abs(sup.f) / p.pp, nMax = Math.max(nS * 1.02, 1);
      const tq = [], cu = [];
      let iPrev = 0.8, mk = 0;
      for (let k = n; k >= 0; k--) {
        const rpm = nMax * k / n, w = omegaOf(rpm);
        let r = ev(w, sup, iPrev); iPrev = clamp(r.I1 / d.IphN, 0.4, 1.2);
        r = ev(w, sup, iPrev);
        tq.push([rpm, r.M - mfric(w)]); cu.push([rpm, r.iLine]); mk = Math.max(mk, r.M);
      }
      tq.reverse(); cu.reverse();
      const r0 = ev(0, sup, 1.2);
      return { torque: tq, current: cu, nSync: nS, mk: mk, mStart: r0.M, iStart: r0.iLine };
    }
    function operatingPoint(cfg, rpm) {
      const sup = supplyStatic(cfg), w = omegaOf(num(rpm, 0));
      let r = ev(w, sup, 1);
      r = ev(w, sup, clamp(r.I1 / d.IphN, 0.4, 1.2));
      return { torque: r.M - mfric(w), iLine: r.iLine, cosphi: r.cosphi, pElec: r.pin, pMech: (r.M - mfric(w)) * w, mk: r.Mk, wr: r.wr };
    }
    reset();
    return {
      step: step, state: state, reset: reset, curves: curves, operatingPoint: operatingPoint,
      get params() { return Object.assign({}, p); },
      get derived() { return Object.assign({}, d); },
      setParams: function (q) { p = acSanitize(mixParams(p, q)); d = acDerive(p); }
    };
  }

  function mkAcPreset(id, name, plate, extra) {
    return {
      id: id, name: name, plate: plate,
      params: Object.assign({ P: plate.P, uDelta: plate.uDelta, fN: plate.f, pp: plate.poles / 2, nN: plate.n, eta: plate.eta, cosphi: plate.cosphi, iN: plate.iDelta }, extra)
    };
  }
  const acPresets = listWithIds([
    mkAcPreset('m055', 'Drehstrommotor 0,55 kW, 4-polig', { P: 550, uDelta: 400, uStar: 690, iDelta: 1.4, iStar: 0.81, cosphi: 0.74, n: 1400, eta: 0.77, f: 50, poles: 4 },
      { lambdaK: 2.3, iaRatio: 5.0, J: 0.0018, Jload: 0.0018 }),
    mkAcPreset('m15', 'Drehstrommotor 1,5 kW, 4-polig', { P: 1500, uDelta: 400, uStar: 690, iDelta: 3.4, iStar: 1.96, cosphi: 0.78, n: 1420, eta: 0.82, f: 50, poles: 4 },
      { lambdaK: 2.5, iaRatio: 6.0, J: 0.0045, Jload: 0.0045 }),
    mkAcPreset('m4', 'Drehstrommotor 4 kW, 4-polig', { P: 4000, uDelta: 400, uStar: 690, iDelta: 8.4, iStar: 4.85, cosphi: 0.80, n: 1445, eta: 0.86, f: 50, poles: 4 },
      { lambdaK: 2.7, iaRatio: 6.8, J: 0.0115, Jload: 0.0115 })
  ]);

  /* =====================================================================================================
   *  GETRIEBE
   * ===================================================================================================== */
  const GB_DEFAULTS = {
    type: 'stirnrad', stages: 1, z1: 20, z2: 40, z3: 20, z4: 40, gaenge: 1, q: 11, eta: 0, lube: true, mLimit: 0, nMax: 0, mDrag: 0,
    Cth: 500, Rth: 0.5, tempMax: 90, thermFactor: 1, tAmb: 25
  };
  function normType(t) {
    t = String(t === undefined || t === null ? 'stirnrad' : t).toLowerCase();
    if (t.indexOf('ri') === 0 || t.indexOf('belt') === 0) return 'riemen';
    if (t.indexOf('sch') === 0 || t.indexOf('worm') === 0) return 'schnecke';
    return 'stirnrad';
  }
  function gbSanitize(p) {
    p.type = normType(p.type);
    p.stages = num(p.stages, 1) >= 2 ? 2 : 1;
    ['z1', 'z2', 'z3', 'z4'].forEach(function (k) { p[k] = Math.max(1, Math.round(num(p[k], GB_DEFAULTS[k]))); });
    p.gaenge = clamp(Math.round(num(p.gaenge, 1)), 1, 6); p.q = clamp(num(p.q, 11), 6, 20);
    p.eta = num(p.eta, 0) > 0 && num(p.eta, 0) <= 1 ? num(p.eta, 0) : 0;
    p.mLimit = num(p.mLimit, 0) > 0 ? num(p.mLimit, 0) : (p.type === 'riemen' ? 20 : p.type === 'schnecke' ? 80 : 60);
    p.nMax = num(p.nMax, 0) > 0 ? num(p.nMax, 0) : (p.type === 'riemen' ? 4000 : p.type === 'schnecke' ? 3000 : 6000);
    p.mDrag = num(p.mDrag, 0) > 0 ? num(p.mDrag, 0) : (p.type === 'riemen' ? 0.008 : p.type === 'schnecke' ? 0.03 : 0.01);
    p.Cth = pos(p.Cth, 500, 0); p.Rth = pos(p.Rth, 0.5, 0); p.thermFactor = clamp(num(p.thermFactor, 1), 0, 5000);
    p.lube = typeof p.lube === 'boolean' ? p.lube : bool(p.lube);
    return p;
  }
  function gbStages(p, lube) {
    const out = [];
    function mk(type, zIn, zOut, first) {
      let eta, i = zOut / zIn, dir = 1, selfLock = false, etaRev = 0;
      if (type === 'stirnrad') { eta = lube ? 0.97 : 0.88; dir = -1; etaRev = eta; }
      else if (type === 'riemen') { eta = lube ? 0.94 : 0.91; etaRev = eta; }
      else {
        const gam = Math.atan(p.gaenge / p.q), mu = lube ? 0.08 : 0.20, rho = Math.atan(mu), rhoS = Math.atan(1.4 * mu);
        eta = Math.tan(gam) / Math.tan(gam + rho);
        i = zOut / p.gaenge;
        selfLock = gam <= rhoS;
        etaRev = gam > rhoS ? Math.tan(gam - rho) / Math.tan(gam) : 0;
        if (gam <= rho) etaRev = 0;
      }
      if (p.eta > 0) { eta = p.eta; etaRev = type === 'schnecke' && selfLock ? 0 : p.eta; }
      out.push({ type: type, i: i, eta: eta, etaRev: etaRev, dir: dir, selfLocking: selfLock, zIn: zIn, zOut: zOut });
    }
    mk(p.type, p.type === 'schnecke' ? p.gaenge : p.z1, p.z2, true);
    if (p.stages === 2) mk(p.type === 'schnecke' ? 'stirnrad' : p.type, p.z3, p.z4, false);
    return out;
  }
  function gearbox(params) {
    let p = gbSanitize(mixParams(GB_DEFAULTS, params && typeof params === 'object' ? params : {}));
    let s, self;
    function reset() { s = { temp: p.tAmb, dmg: 0, broken: false, t: 0 }; self = { acc: 0 }; }
    function info(lube) {
      const lb = lube === undefined ? p.lube : !!lube;
      const st = gbStages(p, lb);
      let i = 1, eta = 1, dir = 1, etaRev = 1, sl = false;
      st.forEach(function (x) { i *= x.i; eta *= x.eta; dir *= x.dir; etaRev *= x.etaRev; if (x.selfLocking) sl = true; });
      return { ratio: i, eta: eta, etaRev: etaRev, dirOut: dir, stages: st.map(function (x) { return { type: x.type, i: x.i, eta: x.eta, dir: x.dir }; }), selfLocking: sl };
    }
    function calc(inp, lube) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const inf = info(lube);
      const lb = lube === undefined ? p.lube : !!lube;
      const nIn = num(inp.nIn, 0), mIn = num(inp.mIn, 0);
      const wIn = omegaOf(nIn);
      const drag = p.mDrag * (lb ? 1 : 3) * (0.5 + 0.5 * Math.min(4, Math.abs(nIn) / 1500));
      const mEff = sign(mIn) * Math.max(0, Math.abs(mIn) - drag);
      let mOut = mEff * inf.ratio * inf.eta, nOut = nIn / inf.ratio;
      const hasLoad = inp.mLoad !== undefined && isFinite(num(inp.mLoad, NaN));
      const mLoad = hasLoad ? Math.abs(num(inp.mLoad, 0)) : 0;
      if (s.broken) { mOut = 0; nOut = 0; }
      const pIn = mIn * wIn, pOut = mOut * omegaOf(nOut);
      const etaEff = Math.abs(mIn) > 1e-9 ? mOut / (mIn * inf.ratio) : inf.eta;
      const stress = Math.max(Math.abs(mOut), mLoad);
      const overload = stress > p.mLimit, overspeed = Math.abs(nIn) > p.nMax;
      const overheat = s.temp > p.tempMax;
      const faults = [];
      if (s.broken) faults.push('zahnbruch');
      else if (overload) faults.push('ueberlast');
      if (overspeed) faults.push('ueberdrehzahl');
      if (overheat) faults.push('ueberhitzung');
      if (!lb) faults.push('trockenlauf');
      return {
        ratio: inf.ratio, nOut: nOut, nOutSigned: nOut * inf.dirOut, dirOut: inf.dirOut, mOut: mOut, pIn: pIn, pOut: pOut, pLoss: pIn - pOut,
        eta: etaEff, etaMesh: inf.eta, mDrag: drag, mInRequired: hasLoad ? mLoad / (inf.ratio * inf.eta) + drag : drag, overload: overload,
        overspeed: overspeed, overheat: overheat, broken: s.broken, selfLocking: inf.selfLocking, temp: s.temp, damage: s.dmg, faults: faults, lube: lb
      };
    }
    function step(dtMs, inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const lb = inp.lube === undefined ? p.lube : bool(inp.lube);
      const dt = clamp(num(dtMs, 0), 0, MAXDT) / 1000;
      if (dt > 0) {
        let r = calc(inp, lb);
        const stress = Math.max(Math.abs(r.mOut), inp.mLoad !== undefined ? Math.abs(num(inp.mLoad, 0)) : 0);
        if (!s.broken && stress > p.mLimit) { s.dmg += 20 * (stress / p.mLimit - 1) * dt; if (s.dmg >= 1) s.broken = true; }
        else if (!s.broken && s.dmg > 0) s.dmg = Math.max(0, s.dmg - 0.05 * dt);
        r = calc(inp, lb);
        const pl = Math.max(0, r.pLoss);
        const rth = p.Rth * (lb ? 1 : 2), tinf = p.tAmb + pl * rth, tau = rth * p.Cth / Math.max(1e-9, p.thermFactor);
        s.temp = tinf + (s.temp - tinf) * Math.exp(-dt / tau);
        s.t += dt * 1000;
      }
      return calc(inp, lb);
    }
    function applyReverse(inp) {
      inp = inp && typeof inp === 'object' ? inp : {};
      const inf = info();
      const nOut = num(inp.nOut, 0), mOut = num(inp.mOut, 0);
      const blocked = inf.selfLocking || inf.etaRev <= 0;
      return { nIn: blocked ? 0 : nOut * inf.ratio, mIn: blocked ? mOut / inf.ratio : mOut / inf.ratio * inf.etaRev, blocked: blocked, etaRev: inf.etaRev };
    }
    reset();
    return {
      apply: function (inp) { return calc(inp, undefined); }, step: step, applyReverse: applyReverse, info: function () { return info(); },
      state: function () { return calc({ nIn: 0, mIn: 0 }); }, reset: reset,
      get params() { return Object.assign({}, p); },
      setParams: function (q) { p = gbSanitize(mixParams(p, q)); }
    };
  }

  /* =====================================================================================================
   *  FORMELN
   * ===================================================================================================== */
  const F = {}, FINFO = {};
  function fmt(x) {
    if (typeof x !== 'number' || !isFinite(x)) return String(x);
    const a = Math.abs(x);
    let s;
    if (a === 0) s = '0';
    else if (a >= 1e5 || a < 1e-3) s = x.toExponential(3);
    else s = String(Math.round(x * Math.pow(10, 3 - Math.floor(Math.log10(a)))) / Math.pow(10, 3 - Math.floor(Math.log10(a))));
    return s.replace('.', ',');
  }
  function def(name, args, unit, expr, text, tpl, fn) {
    F[name] = function () { const a = Array.prototype.slice.call(arguments).map(function (v) { return num(v, NaN); }); return fn.apply(null, a); };
    FINFO[name] = { name: name, args: args, unit: unit, expr: expr, text: text, tpl: tpl };
  }
  def('omega', ['n [1/min]'], 'rad/s', 'ω = 2π · n / 60', 'Winkelgeschwindigkeit aus Drehzahl', '2π · {0} / 60', function (n) { return TWO_PI * n / 60; });
  def('n', ['ω [rad/s]'], '1/min', 'n = ω · 60 / (2π)', 'Drehzahl aus Winkelgeschwindigkeit', '{0} · 60 / (2π)', function (w) { return w * 60 / TWO_PI; });
  def('rpm', ['ω [rad/s]'], '1/min', 'n = ω · 60 / (2π)', 'Drehzahl aus Winkelgeschwindigkeit', '{0} · 60 / (2π)', function (w) { return w * 60 / TWO_PI; });
  def('power', ['M [Nm]', 'n [1/min]'], 'W', 'P = M · 2π · n / 60', 'Mechanische Leistung aus Moment und Drehzahl', '{0} · 2π · {1} / 60', function (M, n) { return M * TWO_PI * n / 60; });
  def('powerFromTorque', ['M [Nm]', 'n [1/min]'], 'W', 'P = M · 2π · n / 60', 'Mechanische Leistung aus Moment und Drehzahl', '{0} · 2π · {1} / 60', function (M, n) { return M * TWO_PI * n / 60; });
  def('torque', ['P [W]', 'n [1/min]'], 'Nm', 'M = P / (2π · n / 60)', 'Drehmoment aus Leistung und Drehzahl', '{0} / (2π · {1} / 60)', function (P, n) { return P / (TWO_PI * n / 60); });
  def('torqueFromPower', ['P [W]', 'n [1/min]'], 'Nm', 'M = P / (2π · n / 60)', 'Drehmoment aus Leistung und Drehzahl', '{0} / (2π · {1} / 60)', function (P, n) { return P / (TWO_PI * n / 60); });
  def('powerOmega', ['M [Nm]', 'ω [rad/s]'], 'W', 'P = M · ω', 'Leistung aus Moment und Winkelgeschwindigkeit', '{0} · {1}', function (M, w) { return M * w; });
  def('torqueOmega', ['P [W]', 'ω [rad/s]'], 'Nm', 'M = P / ω', 'Moment aus Leistung und Winkelgeschwindigkeit', '{0} / {1}', function (P, w) { return P / w; });
  def('eta', ['P_ab [W]', 'P_zu [W]'], '(Anteil 0..1)', 'η = P_ab / P_zu', 'Wirkungsgrad', '{0} / {1}', function (a, z) { return a / z; });
  def('etaPct', ['P_ab [W]', 'P_zu [W]'], '%', 'η = P_ab / P_zu · 100 %', 'Wirkungsgrad in Prozent', '{0} / {1} · 100', function (a, z) { return a / z * 100; });
  def('etaChain', ['η1', 'η2', 'η3'], '(Anteil)', 'η_ges = η1 · η2 · η3', 'Gesamtwirkungsgrad hintereinander geschalteter Stufen', '{0} · {1} · {2}', function (a, b, c) { return a * (isFinite(b) ? b : 1) * (isFinite(c) ? c : 1); });
  def('slip', ['n_s [1/min]', 'n [1/min]'], '(Anteil 0..1)', 's = (n_s − n) / n_s', 'Schlupf des Asynchronmotors', '({0} − {1}) / {0}', function (ns, n) { return (ns - n) / ns; });
  def('slipPct', ['n_s [1/min]', 'n [1/min]'], '%', 's = (n_s − n) / n_s · 100 %', 'Schlupf in Prozent', '({0} − {1}) / {0} · 100', function (ns, n) { return (ns - n) / ns * 100; });
  def('syncSpeed', ['f [Hz]', 'p (Polpaare)'], '1/min', 'n_s = 60 · f / p', 'Synchrone Drehzahl des Drehfelds', '60 · {0} / {1}', function (f, p) { return 60 * f / p; });
  def('syncSpeedPoles', ['f [Hz]', 'Polzahl 2p'], '1/min', 'n_s = 120 · f / Polzahl', 'Synchrone Drehzahl aus der Polzahl', '120 · {0} / {1}', function (f, poles) { return 120 * f / poles; });
  def('polePairs', ['f [Hz]', 'n [1/min]'], '', 'p = ⌊60 · f / n⌋', 'Polpaarzahl aus Typenschilddrehzahl', '⌊60 · {0} / {1}⌋', function (f, n) { return Math.max(1, Math.floor(60 * f / n + 1e-9)); });
  def('ratio', ['z1 (treibend)', 'z2 (getrieben)'], '', 'i = z2 / z1', 'Übersetzung eines Zahnradpaars (i > 1: ins Langsame)', '{1} / {0}', function (z1, z2) { return z2 / z1; });
  def('ratioFromSpeeds', ['n_ein [1/min]', 'n_aus [1/min]'], '', 'i = n_ein / n_aus', 'Übersetzung aus den Drehzahlen', '{0} / {1}', function (a, b) { return a / b; });
  def('nOut', ['n_ein [1/min]', 'i'], '1/min', 'n_aus = n_ein / i', 'Ausgangsdrehzahl', '{0} / {1}', function (n, i) { return n / i; });
  def('mOut', ['M_ein [Nm]', 'i', 'η'], 'Nm', 'M_aus = M_ein · i · η', 'Ausgangsmoment', '{0} · {1} · {2}', function (m, i, e) { return m * i * (isFinite(e) ? e : 1); });
  def('mIn', ['M_aus [Nm]', 'i', 'η'], 'Nm', 'M_ein = M_aus / (i · η)', 'Benötigtes Eingangsmoment', '{0} / ({1} · {2})', function (m, i, e) { return m / (i * (isFinite(e) ? e : 1)); });
  def('startCurrentRatio', ['I_A / I_N (Direktanlauf)', 'Art (0 = direkt, 1 = Stern-Dreieck, 2 = FU)'], '(Vielfaches von I_N)', 'I_Anlauf / I_N', 'Anlaufstrom: direkt 5…8 · I_N, Stern-Dreieck ein Drittel davon, FU nur ca. 1,5 · I_N',
    'I_A/I_N = {0}', function (ia, mode) { mode = isFinite(mode) ? mode : 0; return mode === 1 ? ia / 3 : mode === 2 ? 1.5 : ia; });
  def('starDeltaFactor', [], '', 'Faktor = 1/3', 'Beim Umschalten auf Stern sinken Strom und Moment auf ein Drittel', '1 / 3', function () { return 1 / 3; });
  def('tauMech', ['J [kg·m²]', 'R_a [Ω]', 'K_e [V·s/rad]'], 's', 'τ_m = J · R_a / K_e²', 'Mechanische Zeitkonstante des Gleichstrommotors', '{0} · {1} / {2}²', function (J, R, K) { return J * R / (K * K); });
  def('tauElec', ['L [H]', 'R [Ω]'], 's', 'τ_el = L / R', 'Elektrische Zeitkonstante', '{0} / {1}', function (L, R) { return L / R; });
  def('accelTime', ['J [kg·m²]', 'n [1/min]', 'M_b [Nm]'], 's', 't = J · ω / M_b', 'Hochlaufzeit auf Drehzahl n mit Beschleunigungsmoment M_b', '{0} · 2π · {1} / 60 / {2}', function (J, n, M) { return J * TWO_PI * n / 60 / M; });
  def('inertiaReflected', ['J_last [kg·m²]', 'i'], 'kg·m²', 'J_Motorseite = J_last / i²', 'Trägheit auf die Motorseite umgerechnet', '{0} / {1}²', function (J, i) { return J / (i * i); });
  def('powerThreePhase', ['U [V]', 'I [A]', 'cos φ'], 'W', 'P = √3 · U · I · cos φ', 'Aufgenommene Wirkleistung (Drehstrom)', '√3 · {0} · {1} · {2}', function (U, I, c) { return SQ3 * U * I * c; });
  def('apparentPower', ['U [V]', 'I [A]'], 'VA', 'S = √3 · U · I', 'Scheinleistung (Drehstrom)', '√3 · {0} · {1}', function (U, I) { return SQ3 * U * I; });
  def('reactivePower', ['U [V]', 'I [A]', 'cos φ'], 'var', 'Q = √3 · U · I · sin φ', 'Blindleistung (Drehstrom)', '√3 · {0} · {1} · √(1 − {2}²)', function (U, I, c) { return SQ3 * U * I * Math.sqrt(Math.max(0, 1 - c * c)); });
  def('currentThreePhase', ['P_zu [W]', 'U [V]', 'cos φ'], 'A', 'I = P_zu / (√3 · U · cos φ)', 'Leiterstrom aus aufgenommener Leistung', '{0} / (√3 · {1} · {2})', function (P, U, c) { return P / (SQ3 * U * c); });
  def('torqueFromForce', ['F [N]', 'r [m]'], 'Nm', 'M = F · r', 'Drehmoment aus Kraft und Hebelarm', '{0} · {1}', function (Fv, r) { return Fv * r; });
  def('forceFromTorque', ['M [Nm]', 'r [m]'], 'N', 'F = M / r', 'Kraft aus Drehmoment und Hebelarm', '{0} / {1}', function (M, r) { return M / r; });
  def('kineticEnergy', ['J [kg·m²]', 'n [1/min]'], 'J', 'W = ½ · J · ω²', 'Drehenergie', '½ · {0} · (2π · {1} / 60)²', function (J, n) { const w = TWO_PI * n / 60; return 0.5 * J * w * w; });
  def('backEmf', ['K_e [V·s/rad]', 'n [1/min]'], 'V', 'U_i = K_e · ω', 'Induzierte Gegenspannung des Gleichstrommotors', '{0} · 2π · {1} / 60', function (K, n) { return K * TWO_PI * n / 60; });
  def('dcSpeed', ['U [V]', 'I [A]', 'R_a [Ω]', 'K_e [V·s/rad]'], '1/min', 'n = (U − R_a · I) / K_e · 60 / (2π)', 'Drehzahl des Gleichstrommotors bei Strom I', '({0} − {2} · {1}) / {3} · 60 / (2π)', function (U, I, R, K) { return (U - R * I) / K * 60 / TWO_PI; });
  def('stallCurrent', ['U [V]', 'R_a [Ω]'], 'A', 'I_A = U / R_a', 'Anlauf- bzw. Blockierstrom', '{0} / {1}', function (U, R) { return U / R; });
  def('dcTorque', ['K_t [Nm/A]', 'I [A]'], 'Nm', 'M = K_t · I', 'Motormoment des Gleichstrommotors', '{0} · {1}', function (K, I) { return K * I; });
  def('copperLoss', ['I [A]', 'R [Ω]'], 'W', 'P_v = I² · R', 'Stromwärmeverlust', '{0}² · {1}', function (I, R) { return I * I * R; });
  def('pwmMean', ['Tastgrad (0..1)', 'U [V]'], 'V', 'U_mittel = D · U', 'Mittlere Spannung bei PWM', '{0} · {1}', function (D, U) { return (D > 1 ? D / 100 : D) * U; });
  def('pwmDuty', ['U_soll [V]', 'U [V]'], '(Anteil 0..1)', 'D = U_soll / U', 'Nötiger Tastgrad für eine mittlere Spannung', '{0} / {1}', function (a, U) { return a / U; });
  def('rippleSimple', ['U [V]', 'D (0..1)', 'L [H]', 'f [Hz]'], 'A', 'ΔI = U · D · (1 − D) / (L · f)', 'Stromwelligkeit (Spitze-Spitze), Näherung ohne Widerstand', '{0} · {1} · (1 − {1}) / ({2} · {3})', function (U, D, L, f) { D = D > 1 ? D / 100 : D; return U * D * (1 - D) / (L * f); });
  def('stepAngle', ['Schritte je Umdrehung'], '°', 'α = 360° / Schritte', 'Schrittwinkel', '360 / {0}', function (spr) { return 360 / spr; });
  def('stepRate', ['n [1/min]', 'Schritte je Umdrehung'], 'Schritte/s', 'f = n / 60 · Schritte', 'Schrittfrequenz für eine Drehzahl', '{0} / 60 · {1}', function (n, spr) { return n / 60 * (isFinite(spr) ? spr : 200); });
  def('rpmFromStepRate', ['f [Schritte/s]', 'Schritte je Umdrehung'], '1/min', 'n = f / Schritte · 60', 'Drehzahl aus Schrittfrequenz', '{0} / {1} · 60', function (f, spr) { return f / (isFinite(spr) ? spr : 200) * 60; });
  def('stepsForAngle', ['Winkel [°]', 'Schritte je Umdrehung'], 'Schritte', 'z = Winkel / 360° · Schritte', 'Schrittzahl für einen Winkel', '{0} / 360 · {1}', function (a, spr) { return a / 360 * (isFinite(spr) ? spr : 200); });
  def('servoPulseToAngle', ['Pulsbreite [ms]'], '°', 'α = (t − 1,5 ms) · 90°/ms', 'Servo-Puls 0,5…2,5 ms entspricht −90…+90°', '({0} − 1,5) · 90', function (ms) { return (clamp(ms, 0.5, 2.5) - 1.5) * 90; });
  def('servoAngleToPulse', ['Winkel [°]'], 'ms', 't = 1,5 ms + α / 90°', 'Pulsbreite für einen Servowinkel', '1,5 + {0} / 90', function (a) { return 1.5 + clamp(a, -90, 90) / 90; });
  F.info = FINFO;
  Object.defineProperty(F, 'info', { enumerable: false });
  F.explain = function (name) {
    const info = FINFO[name];
    if (!info) return { value: NaN, unit: '', steps: ['Unbekannte Formel: ' + name], ok: false };
    const args = Array.prototype.slice.call(arguments, 1).map(function (v) { return num(v, NaN); });
    let value;
    try { value = F[name].apply(null, args); } catch (e) { value = NaN; }
    const sub = info.tpl.replace(/\{(\d)\}/g, function (_, k) { return fmt(args[+k]); });
    return { ok: isFinite(value), value: value, unit: info.unit, steps: [info.expr, sub, '= ' + fmt(value) + (info.unit ? ' ' + info.unit : '')] };
  };
  Object.defineProperty(F, 'explain', { enumerable: false });

  /* =====================================================================================================
   *  TYPENSCHILD
   * ===================================================================================================== */
  function typenschild(P, U, I, cosphi, n, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    let pw = num(P, NaN); if (opts.unitP === 'kW') pw *= 1000;
    const u = num(U, NaN), i = num(I, NaN), c = num(cosphi, NaN), nn = num(n, NaN), f = pos(opts.f, 50, 0);
    const bad = !(pw > 0 && u > 0 && i > 0 && c > 0 && c <= 1.0001 && nn > 0);
    const r = { ok: !bad, pIn: NaN, eta: NaN, etaPct: NaN, torque: NaN, slip: NaN, slipPct: NaN, nSync: NaN, polePairs: NaN, poles: NaN, S: NaN, Q: NaN, pLoss: NaN, omega: NaN, f: f, hinweis: '' };
    if (bad) { r.hinweis = 'Bitte alle Werte (P, U, I, cos φ ≤ 1, n) als positive Zahlen eingeben.'; return r; }
    r.pIn = SQ3 * u * i * c; r.eta = pw / r.pIn; r.etaPct = r.eta * 100;
    r.omega = omegaOf(nn); r.torque = pw / r.omega;
    r.polePairs = Math.max(1, Math.floor(60 * f / nn + 1e-9)); r.poles = 2 * r.polePairs;
    r.nSync = 60 * f / r.polePairs; r.slip = (r.nSync - nn) / r.nSync; r.slipPct = r.slip * 100;
    r.S = SQ3 * u * i; r.Q = Math.sqrt(Math.max(0, r.S * r.S - r.pIn * r.pIn)); r.pLoss = r.pIn - pw;
    r.iStarRated = i / SQ3;                 // Nennstrom in Sternschaltung (am hoeheren Netz, z. B. 690 V): I_Y = I_Delta / sqrt(3)
    r.iStartStar = i / 3;                   // Anlaufstrom im Stern-Dreieck-Anlauf bezogen auf den Direktanlauf: ein Drittel (Faktor, nicht A)
    if (r.eta > 1.0001) r.hinweis = 'Der Wirkungsgrad wäre über 100 %: Prüfe, ob P in Watt und I in Ampere eingegeben wurde.';
    return r;
  }

  /* =====================================================================================================
   *  ABLAUFPROGRAMM-LAEUFER
   * ===================================================================================================== */
  function snap(o) {
    if (!o || typeof o !== 'object') return o;
    const c = {};
    for (const k of Object.keys(o)) { const v = o[k]; c[k] = Array.isArray(v) ? v.slice() : v; }
    return c;
  }
  function runSeq(rigFactory, seq, tEndMs, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const out = { samples: [], final: null, events: [], faults: [], peaks: {}, errors: [] };
    let rig = null;
    try {
      if (typeof rigFactory === 'function') rig = rigFactory();
      else if (typeof rigFactory === 'string') {
        const R = root.ANT_RIGS;
        if (R && R.create) rig = R.create(rigFactory, opts.rigOpts); else out.errors.push('ANT_RIGS nicht geladen');
      } else if (rigFactory && typeof rigFactory === 'object' && typeof rigFactory.step === 'function') {
        rig = rigFactory; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { if (!out.errors.length) out.errors.push('Kein Prüfstand'); return out; }
    const tEnd = clamp(num(tEndMs, 0), 0, 3600000), dt = clamp(num(opts.dtMs, 5), 1, 100), sampleMs = Math.max(dt, num(opts.sampleMs, 50));
    const q = [];
    (Array.isArray(seq) ? seq : []).forEach(function (e, k) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: e.set && typeof e.set === 'object' ? e.set : null, ramp: e.ramp && typeof e.ramp === 'object' ? e.ramp : null, k: k });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    const faultSet = {};
    function setCtl(key, v) { try { rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); } }
    function collect(st) {
      if (st && Array.isArray(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } });
    }
    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    const ramps = [];
    let t = 0, qi = 0, nextSample = 0;
    for (let guard = 0; guard < 2000000; guard++) {
      while (qi < q.length && q[qi].t <= t + 1e-9) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k]); });
        if (e.ramp && typeof e.ramp.key === 'string') {
          let from = NaN; try { from = num(rig.getControl(e.ramp.key), NaN); } catch (er) { /* */ }
          ramps.push({ key: e.ramp.key, from: isFinite(from) ? from : 0, to: num(e.ramp.to, 0), t0: t, dur: Math.max(1, num(e.ramp.durMs, 1000)) });
        }
      }
      for (let k = ramps.length - 1; k >= 0; k--) {
        const r = ramps[k], fr = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(r.key, r.from + (r.to - r.from) * fr);
        if (fr >= 1) ramps.splice(k, 1);
      }
      let st = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      collect(st);
      if (t >= nextSample - 1e-9) {
        let m = null; try { m = rig.readMeters(); } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
        out.samples.push({ t: t, meters: snap(m), state: snap(st) });
        if (m) Object.keys(m).forEach(function (k) {
          const v = m[k]; if (typeof v !== 'number' || !isFinite(v)) return;
          const pk = out.peaks[k] || (out.peaks[k] = { min: v, max: v });
          if (v < pk.min) pk.min = v; if (v > pk.max) pk.max = v;
        });
        nextSample += sampleMs;
      }
      if (t >= tEnd - 1e-9) break;
      const d = Math.min(dt, tEnd - t);
      try { rig.step(d); } catch (e) { out.errors.push('step(): ' + (e && e.message)); break; }
      t += d;
    }
    try { out.final = snap(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.events = Array.isArray(rig.events) ? rig.events.map(snap) : []; } catch (e) { /* */ }
    if (opts.keepRig) out.rig = rig;
    return out;
  }

  /* ---------- Ausgabe ---------- */
  const api = {
    version: '1.0',
    faultTexts: FAULT_TEXTS,
    dcMotor: dcMotor, dcPresets: dcPresets, dcDerived: dcDerived,
    hBridge: hBridge, hBridgeTransition: hBridgeTransition, shootCurrent: shootCurrent,
    pwmAverage: pwmAverage, pwmRipple: pwmRipple,
    stepper: stepper, stepPatterns: stepPatterns, stepperPresets: stepperPresets,
    servo: servo, servoPresets: servoPresets, servoPulse: servoPulse, servoStepResponse: servoStepResponse,
    induction: induction, acPresets: acPresets,
    gearbox: gearbox,
    formulas: F,
    runSeq: runSeq,
    typenschild: typenschild
  };
  root.ANT_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
