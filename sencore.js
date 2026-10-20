/* ===================================================================================================
 * sencore.js  -  SEN_CORE, Kern des Tonfunk Sensorik-Labs (Sensormodelle, Signalaufbereitung, ADU, I2C, Formeln)
 * IIFE, 'use strict', window.SEN_CORE, Node-ladbar (module.exports / globalThis), keine Abhaengigkeiten, kein eval.
 *
 * ENTSCHEIDUNGEN ZU OFFENEN PUNKTEN
 *  - Einheiten: Temperatur Grad C, Widerstand Ohm, Spannung V, Strom A (Ausnahme: Normsignale und loop420 in mA),
 *    Laenge mm, Zeit ms bei step(dtMs), Zeitkonstanten tau in SEKUNDEN (physikalisch), Frequenz Hz, Kapazitaet F (I2C: pF).
 *  - Alle Fuehler sind deterministisch. Rauschen nur mit Parameter noise (Faktor, 0 = aus = Standard, 1 = typisch) und
 *    festem seed (eigener PRNG mulberry32). Unsinnseingaben (NaN, Infinity, Strings, null, Objekte) werfen nie, sie fallen
 *    auf Standardwerte zurueck bzw. werden auf den zulaessigen Bereich begrenzt.
 *  - PT100/PT1000: komplette Callendar-Van-Dusen-Gleichung. T >= 0: R0(1 + A T + B T^2); T < 0 zusaetzlich C (T-100) T^3
 *    (C = -4,183e-12). Das ist die uebliche Norm-Gleichung und gilt als "Naeherung darunter" ausreichend genau.
 *  - NTC: wahre Kennlinie = B-Wert-Gleichung R = R25 exp(B (1/T - 1/T25)). Steinhart-Hart (3-Punkt-Fit bei 0/25/50 Grad),
 *    Tabelle (lineare Interpolation, Stuetzstelle alle 10 K) und Gerade (0..50 Grad) sind Auswertungs-/Linearisierungsarten
 *    in ntc.linearize(R, mode) und weichen daher leicht von der wahren Kennlinie ab (Lehrzweck).
 *  - Thermoelement Typ K: lineare Naeherung 41 uV/K (Parameter seebeck), keine NIST-Polynome.
 *  - Waermetraegheit: PT1-Glied exakt diskretisiert (exp). Medium (luft/wasser/oel) skaliert tau und Waermeleitwert G.
 *    Selbsterwaermung: dT = P/G mit P = I^2 R(T_Koerper) (iteriert, daher auch bei NTC stabil begrenzt).
 *  - DMS: Brueckenspannung exakt aus den Widerstaenden gerechnet (Viertelbruecke leicht nichtlinear, Halb-/Vollbruecke linear).
 *    Hysterese = Play-Operator (Schleifenbreite hys, Anteil vom Endwert), Kriechen = PT1 (creep, tauCreep).
 *  - ADU: convert(u) liefert die GANZZAHL (floor-Typ, N = floor(u/Uref*2^n), begrenzt auf 0..2^n-1). Alle Zwischengroessen
 *    liefert adc.sample(u). quantErr(u) ist mit Mittenrekonstruktion gerechnet (Fehler +-LSB/2).
 *  - I2C: Zeiten der Wellenform in Mikrosekunden. Flanke SDA/SCL = RC aus Pull-up und Buskapazitaet, Anstiegszeit 30..70 %
 *    = 0,8473 R C. Pegel erkannt bei 0,3 Vcc (low) und 0,7 Vcc (high). Abtastpunkt = Mitte der High-Phase von SCL.
 *    errorRate ist ein deterministisches Modell (0 bis 1), keine Zufallszahl.
 *  - MEMS: ADXL345-aehnlich. res 10 = fest 10 Bit, res 13 = Full-Resolution (3,9 mg/LSB bei jedem Bereich). Registerwerte
 *    DATAX0..DATAZ1 (0x32..0x37), Little-Endian, 16 Bit Zweierkomplement, rechtsbuendig.
 *    Neigung: tiltX = Nick (x-Achse zeigt nach oben: ax = sin(tiltX)), tiltY = Roll um die x-Achse
 *    (ay = cos(tiltX) sin(tiltY), az = cos(tiltX) cos(tiltY)). Rueckrechnung: pitch = atan2(ax, hypot(ay,az)), roll = atan2(ay, az).
 *  - Modellwerte (Gas, Fotodiode, LDR, Prellzeiten) sind typische Groessenordnungen fuer den Unterricht, keine Datenblattwerte.
 *
 * ===================================================================================================
 * API  (jeweils: Parameter -> Rueckgabe; alle Zwischengroessen stehen im Rueckgabeobjekt)
 *
 *  SEN_CORE.version               '1.0'
 *  SEN_CORE.faultTexts            { code: 'deutscher Text' }   (Fehlercodes stehen in out.faults:[code,...])
 *  SEN_CORE.presets               { ntc:[{id,name,params}], pt, ldr, inductive, capacitive, strain, mems, gas, ... }
 *
 *  Gemeinsame Sensor-Schnittstelle:  s = SEN_CORE.sensors.xyz(params);   params duerfen Teilmengen sein.
 *      s.step(dtMs, input) -> out (Objekt, siehe unten)   s.reset()   s.state() (letztes out)   s.params   s.kind
 *      s.curve(from, to, n) -> [[x,y],...]  statische Kennlinie (x/y siehe je Sensor)
 *      Zeitkonstanten der thermischen Sensoren: params.tau [s] (in Luft) * Medium-Faktor; params.medium 'luft'|'wasser'|'oel'.
 *
 *  sensors.ntc({ r25=10000 [Ohm], b=3950 [K], t25=25 [C], tau=8 [s], g=0.002 [W/K], tMax=125, tMin=-40, noise=0, seed=1,
 *               medium='luft', tInit=25 })
 *      step(dtMs, { T [C Medium], i [A durch den Sensor] | p [W] })
 *        -> { r [Ohm], rTrue, tBody [C], tMedium, dTself [K], power [W], tau [s], g [W/K], alpha [%/K], dRdT [Ohm/K],
 *             overheat, faults }
 *      s.resistance(tC), s.temperature(R), s.linearize(R, 'b'|'sh'|'table'|'linear') -> C, s.solve(T, i) -> stationaer
 *      s.shCoeffs() -> {a,b,c}      curve: T [C] -> R [Ohm]
 *  sensors.pt({ type='pt100'|'pt1000' (oder r0), tau=10, g=0.005, tMax=600, tMin=-200, noise, seed, medium, tInit })
 *      step(dtMs, { T, i [A], wires=2|3|4, rLead [Ohm je Ader], leadMismatch [Ohm, nur 3-Leiter] })
 *        -> { r, rEff [Ohm, was die Schaltung sieht], rLeadErr [Ohm], leadErrK [K], tBody, tMedium, dTself, power, dRdT,
 *             overheat, faults }
 *      s.resistance(tC), s.temperature(R)      curve: T -> R
 *  sensors.lm35({ type='lm35'|'tmp36', offsetK=0 [K], gainErr=0, negSupply=false, iq [A], tau=20, g=0.004 })   (sensors.tmp36 = Kurzform)
 *      step(dtMs, { T, vcc=5 }) -> { u [V], uIdeal, tShown [C aus u], tBody, dTself, saturated, faults }   lm35: 10 mV/K, tmp36: 500 mV + 10 mV/K
 *  sensors.thermocouple({ seebeck=41 [uV/K], tau=2, coldComp=true, tColdAssumed=0, tMin=-200, tMax=1250 })
 *      step(dtMs, { T [C Messstelle], tCold [C Vergleichsstelle], tColdMeas [C, gemessen; Standard tCold], open })
 *        -> { emf [mV], emfUV, tHot, tCold, tShown [C], errorK, open, faults }
 *  sensors.ldr({ r10=15000 [Ohm bei 10 lx], gamma=0.7, rDark=1e6, tauRise=0.02 [s], tauFall=0.03 [s], pMax=0.1 [W], noise, seed })
 *      step(dtMs, { lux, ambient [lx, wird addiert], vcc, rSeries }) -> { r, g [S], lux, luxTotal, power, overload, faults }
 *      s.resistance(lux)     curve: lux -> R
 *  sensors.photodiode({ sens=0.05 [uA/lx], id25=2e-9 [A], isat=1e-11, mode='pc'|'pv'|'tia', rLoad=10000, rf=100000, tauMs })
 *      step(dtMs, { lux, ambient, rLoad, rf, vcc=5, T=25 }) -> { iPhoto, iDark, i [A], u [V], saturated, faults }
 *  sensors.phototransistor({ sens=0.05 [uA/lx Basisstrom], hfe=300, iceo=5e-8, vceSat=0.2, rLoad })
 *      step(dtMs, { lux, ambient, rLoad, vcc=5, T=25 }) -> { iPhoto, ic [A], u [V Kollektor, invertierend], saturated, faults }
 *  sensors.lightBarrier({ kind='gabel'|'reflex', thresh=0.5, hyst=0.1, range=100 [mm], ambientImmune=false, ambientMax=20000 })
 *      step(dtMs, { blocked 0..1 (gabel), dist [mm] (reflex), reflect 0..1, ambient [lx], thresh, hyst })
 *        -> { signal 0..1, signalOwn, interference, state 0|1, edge, saturated, flutterRisk, faults }
 *  sensors.inductive({ sn=4 [mm Nennschaltabstand], hyst=0.1 [Anteil], tempDrift=0.001 [1/K], type='pnp'|'npn', noise })
 *      step(dtMs, { dist [mm], material='stahl'|'edelstahl'|'messing'|'alu'|'kupfer'|'kunststoff'|'wasser'|..., size=1 [rel. Zielgroesse],
 *                   T=23, vcc=24, rLoad })
 *        -> { state 0|1, edge, factor [Reduktionsfaktor], sr [mm Realschaltabstand = Einschaltpunkt], srOn, srOff, hystMm,
 *             signal 0..1, uOut [V], iOut [A], dist, toggles, faults }
 *      INDUCTIVE_FACTORS / s.factors  { stahl:1, edelstahl:0.7, messing:0.4, alu:0.4, kupfer:0.3, kunststoff:0, ... }
 *  sensors.capacitive({ sn=8, hyst=0.15, sens=1 (Empfindlichkeit 0.3..1.3), ... })   dasselbe Muster, material wasser/metall 1, glas 0.5, ...
 *  sensors.ultrasonic({ minMm=20, maxMm=4000, tempComp=true, timerUs=1, periodMs=60, sigmaMm=0.3, noise, seed })
 *      step(dtMs, { dist [mm], T [C Luft] }) -> { tofUs [us, Zeitzaehler], tofExact, echoUs (HC-SR04 Impulsbreite), c [m/s],
 *             cAssumed, distShown [mm], error [mm], valid, status:'ok'|'zu nah'|'kein Echo', updated, faults }
 *  sensors.strainGauge({ k=2, r0=350 [Ohm], bridge='quarter'|'half'|'full', epsMax=1000 [um/m bei fMax], fMax=100 [N oder bar], ue=5 [V],
 *               alphaR=1e-5 [1/K], kTc=-1e-4 [1/K], tRef=23, tauT=30 [s], hys=0.005, creep=0.002, tauCreep=120 [s],
 *               overload=1.5, unbalance=0, pMaxGauge=0.05 [W] })
 *      step(dtMs, { force | load | pressure [N/bar], fMax, ue, temp [C Umgebung], bridge })
 *        -> { strain [um/m, mechanisch+scheinbar], strainMech, dROverR (aktiver DMS), dR [Ohm], ratio [V/V], mVperV, uBridge [mV Ausgang],
 *             ue, load [Anteil von fMax], tGauge, apparentStrain, hysteresis [% FS], creepPct, permanentSet [um/m], pGauge [W],
 *             overrange, overload, faults }
 *  sensors.mems({ range=2|4|8|16 [g], res=10|13, rate=100 [Hz], noise=0, seed, offsetMg=[0,0,0], sensErr=0 })
 *      step(dtMs, { tiltX, tiltY [Grad], shock [g, auf z], vibFreq [Hz], vibAmp [g], ax, ay, az [g, zusaetzlich] })
 *        -> { ax, ay, az [g], ms2:{x,y,z}, raw:[x,y,z] (Zaehlwerte), regs:[6 Bytes ab 0x32], hex:[...], pitch, roll [Grad aus Zaehlwerten],
 *             pitchTrue, rollTrue, tiltErr [Grad], norm [g], lsbG, bits, bw [Hz], noiseG, clipped:{x,y,z,any}, sampleReady, faults }
 *      s.lsb()   curve: tiltX [Grad] -> raw x
 *  sensors.humidity({ tauT=5 [s], tauRH=8 [s], rhOff=0, tOff=0, noise })
 *      step(dtMs, { T, rh }) -> { T [C angezeigt], rh [%], tTrue, rhTrue, rawT, rawRH (16 Bit), bytes[6] (mit CRC), dewPoint, absHum [g/m^3], faults }
 *  sensors.gas({ gas='lpg'|'co'|'methane'|'alkohol'|'h2'|'rauch', r0=10000 [Ohm], rClean=9.8, rLoad=10000, tauHeat=45 [s], tempCoeff=0.008 })
 *      step(dtMs, { gas [ppm], T=20, vcc=5, heater=true }) -> { rs [Ohm], ratio [Rs/R0], uOut [V], ppmEst, warm 0..1, ready, heaterW, faults }
 *      curve: ppm -> Rs/R0     GAS_TABLE als SEN_CORE.gasTable
 *  sensors.tof({ maxRange=2000 [mm], minMm=30, budgetMs=33, sigmaLimit=18 [mm], offsetMm=0, noise, seed })
 *      step(dtMs, { dist [mm], reflect=0.5, ambient [klx] }) -> { distShown [mm], distRaw, sigma [mm], status 0|1|3|4, valid, maxEff, updated, faults }
 *
 *  circuits.divider(uin, r1, r2, rLoad?)            -> { uOut, i, iLoad, ratio, rTh, pR1, pR2, rEff }
 *  circuits.bridge(type, { ue, r, x | eps [um/m], k, xt [Temperaturdrift], unbalance, r1..r4 (type 'general') })
 *      type 'quarter'|'half'|'full'|'general' -> { ua [V], ratio [V/V], mVperV, uA, uB, linear [V Naeherung], nonlinPct, iBridge [A], pBridge [W] }
 *      Zweige: Knoten A = Ue R2/(R1+R2), Knoten B = Ue R4/(R3+R4), Ua = A - B. (bridge.quarter(p) ... als Kurzform)
 *  circuits.instrAmp({ gain | rg, kOhm=49400, vccP=5, vccN=0, margin=1, vref=0, cmrrDb=100, vos=0, gbw=1e6 })
 *      .eval(up, um) -> { out, outIdeal, gain, diff, cm, cmErr, saturated, clip:'high'|'low'|null, railHigh, railLow }   .step(dtMs, {up, um}) (mit Bandbreite gbw/gain)
 *      .rgFor(gain)
 *  circuits.opampGain({ mode='inv'|'noninv', rin, rf, vccP=5, vccN=0, margin=0.1, gbw=1e6 })   .eval(u, vref=0) / .step(dtMs, {u, vref})
 *  circuits.lowpass({ fc | (r, c), order=1..4, init='first' })  .step(dtMs, u) -> y   .gain(f) .phase(f) .tau .fc  .riseTime
 *  circuits.comparator({ vth, hyst [V Gesamtbreite], invert, vcc })  .step(u) -> { state, out, upper, lower, switched }
 *  circuits.schmitt(rin, rfb, usat)                 -> { upper, lower, hyst }   (nichtinvertierender Schmitt-Trigger ohne Referenz)
 *  circuits.constCurrent({ iSet [A] | (uRef, rSense), vcc=5, drop=0.5 })  .eval(rLoad) -> { i, uLoad, iSet, limited, uMax, pLoad }
 *  circuits.loop420(params) = circuits.normChain({ signal:'4-20' ... })
 *  circuits.normChain({ signal='4-20'|'0-20'|'0-10'|'1-5', value [Messgroesse], lo=0, hi=100, uSupply=24, uMin=12 [V Messumformer],
 *            rBurden=250, rLine=0 [Ohm Schleife], rOut=100, rIn=1e6 (Spannungssignale), adcBits=12, vref=3.3, att (Teiler 0..1, Standard auto),
 *            emi [V], t [ms], wireBreak, short })
 *      -> { signal, frac, iSet, iLoop [mA], uSig [V], uBurden [V], uAdc [V], code, lsb, shown [Messgroesse], valueTrue, error [% Spanne],
 *           errorAbs, headroom [V, mit Sollstrom], headroomActual, iMaxCompl [mA], rBurdenMax [Ohm], saturated, wireBreak, wireBreakDetected,
 *           ambiguousZero, underrange, overrange, adcClipped, noise, pBurden [W], uTx [V], faults }
 *  circuits.normSignals / circuits.normSignal(type, frac) -> Wert in mA|V,  circuits.normFraction(type, val) -> 0..1
 *
 *  adc(bits, vref, { mode='floor'|'round', offsetLsb, gainErr, noiseLsb, seed })
 *      .convert(u) -> Zaehlwert (ganze Zahl)   .sample(u) -> { code, uQuant (floor), uMid, err (uMid-u), lsb, clipped:'low'|'high'|null, frac, ... }
 *      .toVoltage(code, mid=false)  .quantErr(u)  .lsb  .levels  .snr()  .staircase(n) -> [[u, code]]
 *  adcCapture({ wave='sin'|'tri'|'square'|'dc', fSig, amp, offset, noise, bits, vref, fs, n=256, aaf:{order,fc}|fc, seed, window })
 *      -> { t, vinRaw, vin, codes, vq, err, errRms, snrMeas, snrTheory, enobMeas, lsb, fs, nyquist, alias, spectrum, dominantF, aaf, clipped, ref }
 *  waveValue(kind, f, amp, offset, tSeconds)
 *  dft(samples, { fs=1, window='rect'|'hann' }) -> { n, fs, df, freq[], amp[], phase[], re[], im[], peak:{k,f,amp}, dc }   (n <= 2048)
 *  alias(fSig, fs) -> { fAlias, aliased, borderline, nyquist, order, minFs }
 *
 *  i2c.crc8(bytes, poly=0x31, init=0xFF) ; i2c.checkCrc(bytes, crc)
 *  i2c.frame(addr, rw, bytes, { present=true, nackAt, stretchUs, conflictBytes }) -> frame (siehe unten)
 *  i2c.transaction(addr, [{rw:'W',bytes},{rw:'R',bytes}], opts)  mit Repeated Start
 *      frame = { addr, events:[{type:'start'|'rstart'|'addr'|'rw'|'ack'|'data'|'stop', value?, ack?, by?, bits?}], slots (Bit-Ebene), bytes, ok, nack,
 *                nackAt, text ('S 44 W A 2C A 06 A P'), nBits, durationUs(kHz) }
 *  i2c.waveform(frame, { pullup=4700, cbusPf=100, vcc=3.3, kHz=100, ronOhm=100, stretchUs, pts=32 })
 *      -> { t [us], scl [V], sda [V], sclD, sdaD (0/1), T [us/Bit], marks:[{type,text,t0,t1,value,ack}], analysis:{ tau, tr (30-70 %),
 *           tr10_90, trMax, vol, volOk, sclHighOk, badBits, errorRate, hints:[..], ok } }
 *  i2c.decode({ scl, sda, vcc? }) -> { events, addr, rw, bytes, acks, addrAck, nack, complete, text, errors }
 *  i2c.bus({ pullup, cbusPf, kHz, vcc }) -> { tau, tr, trMax, rMax, rMin, vol, ok, errorRate, hints, tHighUs }  i2c.busCap(lengthM, nDevices)
 *  i2c.edge(r, cPf, vcc, tUs) / i2c.addrConflict([{name,addr}]) -> { ok, conflicts, free } / i2c.scan(devices, {...})
 *  i2c.devices                                  Adress-Tabelle (sht3x 0x44/0x45, adxl345 0x53/0x1D, vl53l0x 0x29, aht10 0x38, ...)
 *  i2c.sht3x.encode(T, rh) -> { rawT, rawRH, bytes[6] mit CRC, ... }   .decode(bytes) -> { T, rh, crcOkT, crcOkRH, ok }   .read(T, rh, opts) -> Transaktion
 *  i2c.adxl345.encode([gx,gy,gz], range, res) -> 6 Bytes   .decode(bytes, range, res) -> { g:[..], raw, pitch, roll }  .read(...)  .bwRate(rate)
 *  i2c.aht.decode(bytes) / i2c.vl53.decodeRange(bytes)
 *
 *  formulas.<name>(...)  -> Zahl (Einheiten siehe formulas.units[name] und formulas.info [{id,name,unit,formula,args}])
 *     kelvin, celsius, beta, ntcResistance, ntcTemperature, steinhartCoeffs, steinhart, ptResistance, ptTemperature, ptTolerance,
 *     dividerOut, bridgeVoltage, bridgeQuarter, bridgeHalf, bridgeFull, strain, strainToDR, gainFromRange, instrAmpGain, invGain,
 *     noninvGain, lowpassFc, lowpassTau, lowpassGain, ldrResistance, ldrLux, photoCurrent, speedOfSound, ultrasonicDistance, ultrasonicTof,
 *     thermocoupleEmf, tcTemperature, selfHeating, selfHeatPower, pt1, burdenMax, loopCurrent, loopValue, burdenVoltage, lsb, adcCode,
 *     adcVoltage, snr, enob, nyquist, alias, minSampleRate, tiltRoll, tiltPitch, memsLsb, shtTemperature, shtHumidity, dewPoint, gasRs,
 *     gasRatio, switchDistance, i2cRiseTime, i2cRMax, i2cRMin, i2cDuration, crc8
 *
 *  runSeq(rigFactory|rigId|rig, seq, tEndMs, opts) -> { samples:[{t,meters,state}], final, events, faults, peaks, errors }
 *      seq = [{ t [ms], set:{key:value}, ramp?:{key,to,durMs} }], opts: { dtMs (5), sampleMs (50), controls, rigOpts, keepRig }
 *      Rigs aus window.SEN_RIGS (create(id)).
 * =================================================================================================== */
(function (root) {
  'use strict';

  const PI = Math.PI, TWO_PI = 2 * PI, K0 = 273.15, G0 = 9.80665;

  /* ---------- Hilfsfunktionen ---------- */
  function num(x, d) {
    if (typeof x === 'string' && x.trim() !== '') x = +x.replace(',', '.');
    return (typeof x === 'number' && isFinite(x)) ? x : d;
  }
  function pos(x, d) { x = num(x, d); return x > 0 ? x : d; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function bool(x) { return x === true || x === 1 || x === '1' || x === 'true' || x === 'an' || x === 'ein' || x === 'on'; }
  function obj(x) { return x && typeof x === 'object' ? x : {}; }
  function first() { for (let i = 0; i < arguments.length; i++) if (arguments[i] !== undefined && arguments[i] !== null) return arguments[i]; return undefined; }
  function mixParams(def, p) {
    const o = Object.assign({}, def);
    if (p && typeof p === 'object') {
      for (const k of Object.keys(p)) {
        const dv = def[k], v = p[k];
        if (typeof dv === 'number') o[k] = num(v, dv);
        else if (typeof dv === 'boolean') o[k] = v === undefined ? dv : bool(v);
        else if (Array.isArray(dv)) o[k] = Array.isArray(v) ? v.slice() : dv.slice();
        else if (v !== undefined && v !== null) o[k] = v;
      }
    }
    return o;
  }
  function makeRng(seed) {
    const s0 = (Math.floor(num(seed, 1)) >>> 0) || 1;
    let s = s0;
    const o = {
      next() { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; },
      gauss() { const u = o.next() || 1e-12, v = o.next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v); },
      reset() { s = s0; }
    };
    return o;
  }
  function snap(o) { if (!o || typeof o !== 'object') return o; const c = {}; for (const k of Object.keys(o)) { const v = o[k]; c[k] = Array.isArray(v) ? v.slice() : (v && typeof v === 'object' ? Object.assign({}, v) : v); } return c; }
  function pushUnique(a, v) { if (a.indexOf(v) < 0) a.push(v); }
  function hex2(v) { v = (Math.floor(v) & 255).toString(16).toUpperCase(); return v.length < 2 ? '0' + v : v; }
  function curveOf(fn, from, to, n) {
    n = clamp(Math.floor(num(n, 50)), 2, 2000); from = num(from, 0); to = num(to, 1);
    const pts = [];
    for (let i = 0; i < n; i++) { const x = from + (to - from) * i / (n - 1); pts.push([x, fn(x)]); }
    return pts;
  }

  const FAULT_TEXTS = {
    ueberhitzung: 'Der Sensor ist im Dauerbetrieb zu heiß geworden.',
    selbsterwaermung: 'Selbsterwärmung: Der Messstrom heizt den Sensor spürbar auf. Strom verkleinern.',
    bereich: 'Messgröße außerhalb des Messbereichs des Sensors.',
    drahtbruch: 'Drahtbruch: Kein Strom bzw. offene Leitung.',
    uebersteuerung: 'Übersteuerung: Das Signal ist größer als der Messbereich.',
    ueberlast: 'Überlast: Der Sensor wurde über den Endwert hinaus belastet (bleibende Verformung möglich).',
    ueberlast_bleibend: 'Überlast: bleibende Verformung, der Nullpunkt hat sich verschoben.',
    saettigung: 'Sättigung: Der Ausgang ist am Anschlag.',
    clipping: 'Messbereichsüberschreitung (Clipping): Wähle einen größeren Messbereich.',
    kein_echo: 'Kein Echo empfangen.',
    zu_nah: 'Objekt liegt im Totbereich (zu nah).',
    sigma: 'Messung zu unsicher (Streuung zu groß).',
    ausser_bereich: 'Objekt außerhalb der Reichweite.',
    warm: 'Sensorheizung noch nicht auf Temperatur: Messwert unzuverlässig.',
    speisung_hoch: 'Brückenspeisung zu hoch: der DMS erwärmt sich.',
    stoerung: 'Starke Störeinkopplung auf der Leitung.',
    buerde_zu_gross: 'Bürde zu groß: Der Messumformer kann den Strom nicht mehr einprägen.',
    adu_uebersteuert: 'ADU übersteuert: Die Eingangsspannung ist größer als die Referenzspannung.',
    unterbereich: 'Unterschreitung des Messbereichs.',
    flattern: 'Schaltausgang kann flattern (zu wenig Hysterese).',
    fremdlicht: 'Fremdlicht stört den Empfänger.',
    sperrbar: 'Gerät außer Betrieb.'
  };

  /* ---------- Waermetraegheit und Selbsterwaermung ---------- */
  const MEDIA = { luft: { tau: 1, g: 1 }, wasser: { tau: 0.12, g: 8 }, oel: { tau: 0.3, g: 4 } };
  function thermal(p, T0) {
    const m = MEDIA[p.medium] || MEDIA.luft;
    const b = {
      tau: Math.max(1e-3, pos(p.tau, 1) * m.tau),
      g: Math.max(1e-9, pos(p.g, 0.005) * m.g),
      T: T0,
      step(dtMs, Tm, pf) {
        const dt = clamp(num(dtMs, 0), 0, 600000) / 1000;
        if (!(dt > 0)) return;
        const n = clamp(Math.ceil(dt / (b.tau / 4)), 1, 400), h = dt / n, k = 1 - Math.exp(-h / b.tau);
        for (let i = 0; i < n; i++) {
          let P = pf ? pf(b.T) : 0; if (!isFinite(P) || P < 0) P = 0;
          b.T += (Tm + P / b.g - b.T) * k;
          if (!isFinite(b.T)) b.T = Tm;
          b.T = clamp(b.T, -300, 1500);
        }
      },
      reset(T) { b.T = T; },
      solve(Tm, pf) {
        let T = Tm;
        for (let i = 0; i < 200; i++) {
          let P = pf ? pf(T) : 0; if (!isFinite(P) || P < 0) P = 0;
          const Tn = clamp(Tm + P / b.g, -300, 1500);
          if (Math.abs(Tn - T) < 1e-9) { T = Tn; break; }
          T += 0.6 * (Tn - T);
        }
        return T;
      }
    };
    return b;
  }

  /* =====================================================================================================
   * FORMELN
   * ===================================================================================================== */
  const F = { info: [], units: {} };
  function def(id, fn, name, unit, formula, args) {
    F[id] = fn; F.units[id] = unit;
    F.info.push({ id: id, name: name, unit: unit, formula: formula, args: args || '' });
  }
  def('kelvin', c => num(c, 0) + K0, 'Celsius in Kelvin', 'K', 'T = θ + 273,15', 'θ in °C');
  def('celsius', k => num(k, K0) - K0, 'Kelvin in Celsius', '°C', 'θ = T - 273,15', 'T in K');
  def('beta', function (r1, t1, r2, t2) {
    const T1 = num(t1, 25) + K0, T2 = num(t2, 85) + K0, a = pos(r1, 1), b = pos(r2, 1), d = 1 / T1 - 1 / T2;
    return d === 0 ? 0 : Math.log(a / b) / d;
  }, 'B-Wert aus zwei Messpunkten', 'K', 'B = ln(R1/R2) / (1/T1 - 1/T2)', 'R in Ω, t in °C');
  def('ntcResistance', function (tC, r25, b, t25) {
    const T = clamp(num(tC, 25), -200, 1500) + K0, T0 = num(t25, 25) + K0;
    return pos(r25, 10000) * Math.exp(pos(b, 3950) * (1 / T - 1 / T0));
  }, 'NTC-Widerstand (B-Wert)', 'Ω', 'R = R25 · exp(B · (1/T - 1/T25))', 'tC in °C, r25 in Ω, b in K');
  def('ntcTemperature', function (R, r25, b, t25) {
    const r0 = pos(r25, 10000), T0 = num(t25, 25) + K0, rr = clamp(pos(R, r0), 1e-6, 1e15);
    return 1 / (1 / T0 + Math.log(rr / r0) / pos(b, 3950)) - K0;
  }, 'NTC-Temperatur aus Widerstand (B-Wert)', '°C', 'T = 1 / (1/T25 + ln(R/R25)/B)', 'R in Ω');
  def('steinhartCoeffs', function (r1, t1, r2, t2, r3, t3) {
    const L1 = Math.log(pos(r1, 32650)), L2 = Math.log(pos(r2, 10000)), L3 = Math.log(pos(r3, 3600));
    const Y1 = 1 / (num(t1, 0) + K0), Y2 = 1 / (num(t2, 25) + K0), Y3 = 1 / (num(t3, 50) + K0);
    const g2 = (Y2 - Y1) / (L2 - L1), g3 = (Y3 - Y1) / (L3 - L1);
    const c = (g3 - g2) / (L3 - L2) / (L1 + L2 + L3), b = g2 - c * (L1 * L1 + L1 * L2 + L2 * L2), a = Y1 - (b + c * L1 * L1) * L1;
    if (!isFinite(a) || !isFinite(b) || !isFinite(c)) return { a: 1.129148e-3, b: 2.34125e-4, c: 8.76741e-8 };
    return { a: a, b: b, c: c };
  }, 'Steinhart-Hart-Koeffizienten aus drei Punkten', '1/K', 'a, b, c aus drei (R, T)-Paaren', 'R in Ω, t in °C');
  def('steinhart', function (R, co) {
    co = obj(co); const a = num(co.a, 1.129148e-3), b = num(co.b, 2.34125e-4), c = num(co.c, 8.76741e-8);
    const L = Math.log(clamp(pos(R, 10000), 1e-6, 1e15)), d = a + b * L + c * L * L * L;
    return d > 0 ? 1 / d - K0 : 1500;
  }, 'Steinhart-Hart-Gleichung', '°C', '1/T = a + b·ln R + c·(ln R)³', 'R in Ω');
  const CVD_A = 3.9083e-3, CVD_B = -5.775e-7, CVD_C = -4.183e-12;
  function ptR(tC, r0) {
    const T = clamp(num(tC, 0), -260, 900);
    return pos(r0, 100) * (1 + CVD_A * T + CVD_B * T * T + (T < 0 ? CVD_C * (T - 100) * T * T * T : 0));
  }
  function ptT(R, r0) {
    r0 = pos(r0, 100); const rr = num(R, r0);
    if (rr >= r0) {
      const disc = CVD_A * CVD_A - 4 * CVD_B * (1 - rr / r0);
      return clamp((-CVD_A + Math.sqrt(Math.max(0, disc))) / (2 * CVD_B), 0, 900);
    }
    let lo = -260, hi = 0;
    if (rr <= ptR(lo, r0)) return lo;
    for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (ptR(mid, r0) < rr) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  def('ptResistance', ptR, 'Pt100/Pt1000-Widerstand (Callendar-Van-Dusen)', 'Ω', 'R = R0 (1 + A·θ + B·θ²), θ<0: + C (θ-100) θ³', 'θ in °C, R0 in Ω (100 oder 1000)');
  def('ptTemperature', ptT, 'Pt-Temperatur aus Widerstand', '°C', 'θ = (-A + √(A² - 4B(1 - R/R0))) / (2B)', 'R in Ω');
  def('ptTolerance', function (tC, cls) {
    const T = Math.abs(num(tC, 0)); cls = String(cls || 'B').toUpperCase();
    return cls === 'AA' ? 0.1 + 0.0017 * T : cls === 'A' ? 0.15 + 0.002 * T : 0.3 + 0.005 * T;
  }, 'Toleranz Pt-Fühler nach Klasse', 'K', 'A: ±(0,15 + 0,002·|θ|), B: ±(0,30 + 0,005·|θ|)', 'θ in °C, Klasse AA/A/B');
  def('dividerOut', function (uin, r1, r2, rl) {
    const a = Math.max(0, num(r1, 0)), b = Math.max(0, num(r2, 0)), l = num(rl, Infinity);
    const be = (l > 0 && isFinite(l)) ? (b === 0 ? 0 : b * l / (b + l)) : b;
    return a + be === 0 ? 0 : num(uin, 0) * be / (a + be);
  }, 'Spannungsteiler', 'V', 'Ua = Ue · R2 / (R1 + R2)', 'Ue in V, R in Ω');
  def('bridgeVoltage', function (ue, r1, r2, r3, r4) {
    const a = Math.max(0, num(r1, 1)), b = Math.max(0, num(r2, 1)), c = Math.max(0, num(r3, 1)), d = Math.max(0, num(r4, 1));
    return num(ue, 0) * ((a + b) === 0 ? 0 : b / (a + b) - ((c + d) === 0 ? 0 : d / (c + d)));
  }, 'Wheatstone-Brückenspannung', 'V', 'Ua = Ue · (R2/(R1+R2) - R4/(R3+R4))', 'Ue in V, R in Ω');
  def('bridgeQuarter', (ue, k, epsUm) => num(ue, 0) * num(k, 2) * num(epsUm, 0) * 1e-6 / 4, 'Viertelbrücke (Näherung)', 'V', 'Ua ≈ Ue · k · ε / 4', 'Ue in V, ε in µm/m');
  def('bridgeHalf', (ue, k, epsUm) => num(ue, 0) * num(k, 2) * num(epsUm, 0) * 1e-6 / 2, 'Halbbrücke', 'V', 'Ua = Ue · k · ε / 2', 'Ue in V, ε in µm/m');
  def('bridgeFull', (ue, k, epsUm) => num(ue, 0) * num(k, 2) * num(epsUm, 0) * 1e-6, 'Vollbrücke', 'V', 'Ua = Ue · k · ε', 'Ue in V, ε in µm/m');
  def('strain', (dR, r, k) => num(dR, 0) / (pos(r, 350) * pos(k, 2)), 'Dehnung aus Widerstandsänderung', '1 (·10⁶ = µm/m)', 'ε = (ΔR/R) / k', 'ΔR, R in Ω');
  def('strainToDR', (epsUm, r, k) => pos(r, 350) * pos(k, 2) * num(epsUm, 0) * 1e-6, 'Widerstandsänderung aus Dehnung', 'Ω', 'ΔR = R · k · ε', 'ε in µm/m');
  def('gainFromRange', (uInMax, uOutMax) => pos(uOutMax, 5) / pos(uInMax, 0.01), 'Verstärkung aus Aussteuerbereich', '1', 'G = Ua,max / Ue,max', 'Spannungen in V');
  def('instrAmpGain', (rg, kOhm) => { rg = num(rg, Infinity); return rg > 0 && isFinite(rg) ? 1 + pos(kOhm, 49400) / rg : 1; }, 'Instrumentenverstärker (AD620)', '1', 'G = 1 + 49,4 kΩ / RG', 'RG in Ω');
  def('invGain', (rf, rin) => -pos(rf, 10000) / pos(rin, 1000), 'Invertierender Verstärker', '1', 'G = -Rf / Rin', 'R in Ω');
  def('noninvGain', (rf, rg) => 1 + pos(rf, 10000) / pos(rg, 1000), 'Nichtinvertierender Verstärker', '1', 'G = 1 + Rf / Rg', 'R in Ω');
  def('lowpassFc', (r, c) => 1 / (TWO_PI * pos(r, 1000) * pos(c, 1e-7)), 'Grenzfrequenz RC-Tiefpass', 'Hz', 'fg = 1 / (2π R C)', 'R in Ω, C in F');
  def('lowpassTau', (r, c) => pos(r, 1000) * pos(c, 1e-7), 'Zeitkonstante RC', 's', 'τ = R · C', 'R in Ω, C in F');
  def('lowpassGain', (f, fc, order) => Math.pow(1 / Math.sqrt(1 + Math.pow(Math.abs(num(f, 0)) / pos(fc, 1), 2)), clamp(Math.floor(num(order, 1)), 1, 8)), 'Betrag Tiefpass', '1', '|H| = 1/√(1+(f/fg)²)', 'f, fg in Hz');
  def('ldrResistance', (lux, r10, gamma) => pos(r10, 15000) * Math.pow(clamp(pos(lux, 10), 1e-3, 1e6) / 10, -pos(gamma, 0.7)), 'LDR-Widerstand', 'Ω', 'R = R10 · (E/10 lx)^(-γ)', 'E in lx');
  def('ldrLux', (R, r10, gamma) => 10 * Math.pow(pos(R, 15000) / pos(r10, 15000), -1 / pos(gamma, 0.7)), 'Beleuchtungsstärke aus LDR-Widerstand', 'lx', 'E = 10 lx · (R/R10)^(-1/γ)', 'R in Ω');
  def('photoCurrent', (lux, sens) => Math.max(0, num(lux, 0)) * pos(sens, 0.05) * 1e-6, 'Fotostrom', 'A', 'Iph = S · E', 'E in lx, S in µA/lx');
  def('speedOfSound', tC => 331.3 + 0.606 * num(tC, 20), 'Schallgeschwindigkeit in Luft', 'm/s', 'c = 331,3 + 0,606 · θ', 'θ in °C');
  def('ultrasonicDistance', (tofUs, tC) => (331.3 + 0.606 * num(tC, 20)) * Math.max(0, num(tofUs, 0)) * 1e-3 / 2, 'Abstand aus Laufzeit', 'mm', 's = c · t / 2', 't in µs, θ in °C');
  def('ultrasonicTof', (dMm, tC) => 2 * Math.max(0, num(dMm, 0)) / (331.3 + 0.606 * num(tC, 20)) * 1e3, 'Laufzeit aus Abstand', 'µs', 't = 2 · s / c', 's in mm');
  def('thermocoupleEmf', (tHot, tCold, S) => pos(S, 41) * (num(tHot, 0) - num(tCold, 0)) / 1000, 'Thermospannung Typ K (Näherung)', 'mV', 'U = S · (θ_Mess - θ_Vergleich), S ≈ 41 µV/K', 'θ in °C');
  def('tcTemperature', (emfMv, tCold, S) => num(tCold, 0) + num(emfMv, 0) * 1000 / pos(S, 41), 'Temperatur aus Thermospannung', '°C', 'θ = θ_Vergleich + U / S', 'U in mV');
  def('selfHeating', (P, G) => Math.max(0, num(P, 0)) / pos(G, 0.002), 'Selbsterwärmung', 'K', 'ΔT = P / G', 'P in W, G in W/K');
  def('selfHeatPower', (i, r) => num(i, 0) * num(i, 0) * Math.max(0, num(r, 0)), 'Verlustleistung im Fühler', 'W', 'P = I² · R', 'I in A, R in Ω');
  def('pt1', (t, tau, y0, y1) => num(y1, 1) + (num(y0, 0) - num(y1, 1)) * Math.exp(-Math.max(0, num(t, 0)) / pos(tau, 1)), 'PT1-Sprungantwort', 'wie y', 'y(t) = y1 + (y0 - y1)·e^(-t/τ)', 't, τ in gleicher Einheit');
  def('burdenMax', (us, umin, imaxMa) => Math.max(0, num(us, 24) - num(umin, 12)) / (pos(imaxMa, 20) / 1000), 'Maximalbürde Stromschleife', 'Ω', 'RB,max = (US - UMin) / 20 mA', 'U in V, Imax in mA');
  def('loopCurrent', function (value, lo, hi, iLo, iHi) {
    const l = num(lo, 0), h = num(hi, 100), a = num(iLo, 4), b = num(iHi, 20);
    return h === l ? a : a + (num(value, 0) - l) / (h - l) * (b - a);
  }, 'Schleifenstrom aus Messwert', 'mA', 'I = 4 mA + (x - xLo)/(xHi - xLo) · 16 mA', 'x in Messgrößeneinheit');
  def('loopValue', function (mA, lo, hi, iLo, iHi) {
    const l = num(lo, 0), h = num(hi, 100), a = num(iLo, 4), b = num(iHi, 20);
    return b === a ? l : l + (num(mA, 0) - a) / (b - a) * (h - l);
  }, 'Messwert aus Schleifenstrom', 'Messgrößeneinheit', 'x = xLo + (I - 4 mA)/16 mA · (xHi - xLo)', 'I in mA');
  def('burdenVoltage', (iMa, r) => num(iMa, 0) / 1000 * Math.max(0, num(r, 250)), 'Spannung an der Bürde', 'V', 'U = I · RB', 'I in mA, RB in Ω');
  def('lsb', (vref, bits) => pos(vref, 3.3) / Math.pow(2, clamp(Math.floor(num(bits, 10)), 1, 32)), 'LSB (Auflösung ADU)', 'V', 'LSB = Uref / 2ⁿ', 'Uref in V');
  def('adcCode', function (u, vref, bits) {
    const n = clamp(Math.floor(num(bits, 10)), 1, 24), lv = Math.pow(2, n);
    return clamp(Math.floor(num(u, 0) / pos(vref, 3.3) * lv), 0, lv - 1);
  }, 'ADU-Zählwert', '1', 'N = floor(U / Uref · 2ⁿ)', 'U in V');
  def('adcVoltage', (code, vref, bits) => num(code, 0) * pos(vref, 3.3) / Math.pow(2, clamp(Math.floor(num(bits, 10)), 1, 32)), 'Spannung aus Zählwert', 'V', 'U = N · LSB', 'N ohne Einheit');
  def('snr', bits => 6.02 * clamp(num(bits, 10), 0, 32) + 1.76, 'Quantisierungs-SNR', 'dB', 'SNR = 6,02 · n + 1,76 dB', 'n in Bit');
  def('enob', sinad => (num(sinad, 0) - 1.76) / 6.02, 'Effektive Bitzahl', 'Bit', 'ENOB = (SINAD - 1,76 dB) / 6,02', 'SINAD in dB');
  def('nyquist', fs => Math.max(0, num(fs, 0)) / 2, 'Nyquist-Frequenz', 'Hz', 'fN = fs / 2', 'fs in Hz');
  def('alias', (fSig, fs) => alias(fSig, fs).fAlias, 'Alias-Frequenz', 'Hz', 'fA = |fSig - k·fs|, k = round(fSig/fs)', 'Frequenzen in Hz');
  def('minSampleRate', (fmax, factor) => 2 * Math.abs(num(fmax, 0)) * Math.max(1, num(factor, 1)), 'Mindest-Abtastfrequenz', 'Hz', 'fs ≥ 2 · fmax (mit Sicherheitsfaktor)', 'fmax in Hz');
  def('tiltRoll', (ay, az) => Math.atan2(num(ay, 0), num(az, 1)) * 180 / PI, 'Rollwinkel aus Beschleunigung', '°', 'φ = atan2(ay, az)', 'a in g');
  def('tiltPitch', (ax, ay, az) => Math.atan2(num(ax, 0), Math.hypot(num(ay, 0), num(az, 1))) * 180 / PI, 'Nickwinkel aus Beschleunigung', '°', 'θ = atan2(ax, √(ay² + az²))', 'a in g');
  def('memsLsb', (rangeG, bits) => 2 * pos(rangeG, 2) / Math.pow(2, clamp(Math.floor(num(bits, 10)), 1, 24)), 'g pro LSB (MEMS)', 'g', 'LSB = 2 · Bereich / 2ⁿ', 'Bereich in g');
  def('shtTemperature', raw => -45 + 175 * clamp(num(raw, 0), 0, 65535) / 65535, 'SHT3x Temperatur', '°C', 'T = -45 + 175 · S / 65535', 'S = 16-Bit-Rohwert');
  def('shtHumidity', raw => 100 * clamp(num(raw, 0), 0, 65535) / 65535, 'SHT3x Feuchte', '%', 'RH = 100 · S / 65535', 'S = 16-Bit-Rohwert');
  function dewPoint(tC, rh) {
    const T = clamp(num(tC, 20), -80, 100), r = clamp(num(rh, 50), 0.01, 100), a = 17.62, b = 243.12;
    const g = Math.log(r / 100) + a * T / (b + T);
    return b * g / (a - g);
  }
  def('dewPoint', dewPoint, 'Taupunkt (Magnus)', '°C', 'τ = b·γ / (a - γ), γ = ln(RH/100) + a·T/(b+T)', 'T in °C, RH in %');
  def('gasRs', (u, vcc, rl) => { u = num(u, 0); return u <= 0 ? 1e9 : Math.max(0, pos(rl, 10000) * (num(vcc, 5) - u) / u); }, 'Sensorwiderstand aus Teilerspannung', 'Ω', 'Rs = RL · (Vcc - U) / U', 'U, Vcc in V');
  def('gasRatio', (rs, r0) => Math.max(0, num(rs, 0)) / pos(r0, 10000), 'Verhältnis Rs/R0', '1', 'Rs/R0', 'R in Ω');
  def('switchDistance', (sn, factor) => Math.max(0, num(sn, 4)) * Math.max(0, num(factor, 1)), 'Realschaltabstand', 'mm', 'sr = sn · Reduktionsfaktor', 'sn in mm');
  def('i2cRiseTime', (r, c) => 0.8473 * Math.max(0, num(r, 4700)) * Math.max(0, num(c, 1e-10)), 'I²C-Anstiegszeit (30...70 %)', 's', 'tr = 0,8473 · R · C', 'R in Ω, C in F');
  def('i2cRMax', (trMax, cb) => pos(trMax, 1e-6) / (0.8473 * pos(cb, 1e-10)), 'Größter Pull-up', 'Ω', 'Rmax = tr,max / (0,8473 · Cb)', 'tr in s, Cb in F');
  def('i2cRMin', (vcc, vol, iol) => Math.max(0, num(vcc, 3.3) - num(vol, 0.4)) / pos(iol, 0.003), 'Kleinster Pull-up', 'Ω', 'Rmin = (Vcc - VOL) / IOL', 'V, A');
  def('i2cDuration', (nBytes, kHz) => (9 * (1 + Math.max(0, Math.floor(num(nBytes, 0)))) + 2) * 1000 / pos(kHz, 100), 'Dauer eines I²C-Telegramms', 'µs', 't = (9·(1+n) + 2) / f', 'n Datenbytes, f in kHz');
  def('crc8', (bytes) => crc8(bytes, 0x31, 0xFF), 'CRC-8 (Sensirion)', '1', 'Polynom 0x31, Start 0xFF', 'Bytes');

  /* =====================================================================================================
   * FUEHLER
   * ===================================================================================================== */
  const sensors = {};
  const presets = {};

  /* ---------- NTC ---------- */
  function ntc(params) {
    const p = mixParams({ r25: 10000, b: 3950, t25: 25, tau: 8, g: 0.002, tMax: 125, tMin: -40, noise: 0, seed: 1, medium: 'luft', tInit: 25 }, params);
    p.r25 = pos(p.r25, 10000); p.b = pos(p.b, 3950);
    const rng = makeRng(p.seed), body = thermal(p, p.tInit);
    let last = null, sh = null;
    const R = tC => F.ntcResistance(tC, p.r25, p.b, p.t25);
    function shCoeffs() { if (!sh) sh = F.steinhartCoeffs(R(0), 0, R(25), 25, R(50), 50); return sh; }
    function linearize(r, mode, opts) {
      r = clamp(pos(r, p.r25), 1e-3, 1e12); mode = String(mode || 'b'); opts = obj(opts);
      if (mode === 'sh') return F.steinhart(r, shCoeffs());
      if (mode === 'linear') { const r0 = R(0), r50 = R(50); return 50 * (r - r0) / (r50 - r0); }
      if (mode === 'table') {
        const st = clamp(pos(opts.step, 10), 1, 50), t0 = -40, t1 = 125, tab = [];
        for (let t = t0; t < t1 + st; t += st) tab.push([R(Math.min(t, t1 + st)), Math.min(t, t1 + st)]);
        if (r >= tab[0][0]) return tab[0][1]; if (r <= tab[tab.length - 1][0]) return tab[tab.length - 1][1];
        for (let i = 0; i < tab.length - 1; i++) if (r <= tab[i][0] && r >= tab[i + 1][0]) {
          const f = (tab[i][0] - r) / (tab[i][0] - tab[i + 1][0]); return tab[i][1] + f * (tab[i + 1][1] - tab[i][1]);
        }
        return tab[0][1];
      }
      return F.ntcTemperature(r, p.r25, p.b, p.t25);
    }
    function powerOf(inp, T) { const i = Math.min(10, Math.abs(num(inp.i, 0))); return inp.p !== undefined ? Math.min(1e4, Math.max(0, num(inp.p, 0))) : i * i * R(T); }
    function solve(Tm, i) { const inp = { i: i }; const T = body.solve(clamp(num(Tm, 25), -150, 1000), t => powerOf(inp, t)); return { tBody: T, r: R(T), dTself: T - num(Tm, 25), power: powerOf(inp, T) }; }
    function step(dtMs, inp) {
      inp = obj(inp);
      const Tm = clamp(num(first(inp.T, inp.tMed), 25), -150, 1000);
      body.step(dtMs, Tm, T => powerOf(inp, T));
      const tb = body.T, tn = p.noise > 0 ? rng.gauss() * 0.02 * p.noise : 0, rTrue = R(tb);
      const pw = powerOf(inp, tb), faults = [];
      if (tb > p.tMax) faults.push('ueberhitzung');
      if (tb - Tm > 0.5) faults.push('selbsterwaermung');
      if (Tm < p.tMin || Tm > p.tMax) faults.push('bereich');
      last = { r: R(tb + tn), rTrue: rTrue, tBody: tb, tMedium: Tm, dTself: tb - Tm, power: pw, tau: body.tau, g: body.g,
        alpha: -p.b / Math.pow(tb + K0, 2) * 100, dRdT: -p.b / Math.pow(tb + K0, 2) * rTrue, overheat: tb > p.tMax, faults: faults };
      return last;
    }
    function reset(T0) { body.reset(num(T0, p.tInit)); rng.reset(); step(0, { T: num(T0, p.tInit) }); }
    const s = { kind: 'ntc', params: p, resistance: R, temperature: r => F.ntcTemperature(r, p.r25, p.b, p.t25), linearize: linearize, solve: solve,
      shCoeffs: shCoeffs, curve: (a, b, n) => curveOf(R, num(a, -40), num(b, 125), n), step: step, reset: reset, state: () => last };
    reset(p.tInit);
    return s;
  }

  /* ---------- Pt100 / Pt1000 ---------- */
  function pt(params) {
    const p = mixParams({ type: 'pt100', r0: 0, tau: 10, g: 0.005, tMax: 600, tMin: -200, noise: 0, seed: 1, medium: 'luft', tInit: 25 }, params);
    const r0 = p.r0 > 0 ? p.r0 : (String(p.type).toLowerCase() === 'pt1000' ? 1000 : 100); p.r0 = r0;
    const rng = makeRng(p.seed), body = thermal(p, p.tInit);
    let last = null;
    const R = tC => ptR(tC, r0);
    const dRdT = tC => r0 * (CVD_A + 2 * CVD_B * tC);
    function powerOf(inp, T) { const i = Math.min(10, Math.abs(num(inp.i, 0))); return inp.p !== undefined ? Math.min(1e4, Math.max(0, num(inp.p, 0))) : i * i * R(T); }
    function step(dtMs, inp) {
      inp = obj(inp);
      const Tm = clamp(num(inp.T, 25), -250, 1000), wires = [2, 3, 4].indexOf(Math.floor(num(inp.wires, 2))) >= 0 ? Math.floor(num(inp.wires, 2)) : 2;
      const rl = Math.max(0, num(inp.rLead, 0));
      body.step(dtMs, Tm, T => powerOf(inp, T));
      const tb = body.T, tn = p.noise > 0 ? rng.gauss() * 0.01 * p.noise : 0, r = R(tb + tn);
      const leadErr = wires === 2 ? 2 * rl : wires === 3 ? Math.max(0, num(inp.leadMismatch, 0)) : 0;
      const d = dRdT(tb), faults = [];
      if (tb > p.tMax) faults.push('ueberhitzung');
      if (tb - Tm > 0.5) faults.push('selbsterwaermung');
      if (Tm < p.tMin || Tm > p.tMax) faults.push('bereich');
      last = { r: r, rEff: r + leadErr, rLeadErr: leadErr, leadErrK: d !== 0 ? leadErr / d : 0, wires: wires, tBody: tb, tMedium: Tm, dTself: tb - Tm,
        power: powerOf(inp, tb), dRdT: d, tau: body.tau, g: body.g, overheat: tb > p.tMax, faults: faults };
      return last;
    }
    function reset(T0) { body.reset(num(T0, p.tInit)); rng.reset(); step(0, { T: num(T0, p.tInit) }); }
    const s = { kind: 'pt', params: p, resistance: R, temperature: r => ptT(r, r0), dRdT: dRdT, solve(Tm, i) { const inp = { i: i }; const T = body.solve(clamp(num(Tm, 25), -250, 1000), t => powerOf(inp, t)); return { tBody: T, r: R(T), dTself: T - num(Tm, 25) }; },
      curve: (a, b, n) => curveOf(R, num(a, -50), num(b, 300), n), step: step, reset: reset, state: () => last };
    reset(p.tInit);
    return s;
  }

  /* ---------- LM35 / TMP36 ---------- */
  function lm35(params) {
    const p0 = obj(params), isTmp = String(p0.type || 'lm35').toLowerCase() === 'tmp36';
    const p = mixParams({ type: isTmp ? 'tmp36' : 'lm35', offsetK: 0, gainErr: 0, negSupply: false, iq: isTmp ? 50e-6 : 60e-6, tau: 20, g: 0.004, medium: 'luft', tInit: 25, noise: 0, seed: 1 }, params);
    const rng = makeRng(p.seed), body = thermal(p, p.tInit), v0 = isTmp ? 0.5 : 0, tLo = isTmp ? -40 : (p.negSupply ? -55 : 2), tHi = isTmp ? 125 : 150;
    let last = null;
    const U = tC => v0 + 0.01 * (1 + p.gainErr) * (tC + p.offsetK);
    function step(dtMs, inp) {
      inp = obj(inp);
      const Tm = clamp(num(inp.T, 25), -100, 400), vcc = clamp(num(inp.vcc, 5), 0, 40);
      body.step(dtMs, Tm, () => vcc * p.iq);
      const tb = body.T, ideal = U(tb), noise = p.noise > 0 ? rng.gauss() * 0.0005 * p.noise : 0, faults = [];
      let u = ideal + noise;
      const uMax = Math.max(0, vcc - (isTmp ? 0.3 : 1.5));
      const uMin = isTmp ? 0.1 : (p.negSupply ? -0.55 : 0);
      let sat = false;
      if (u > uMax) { u = uMax; sat = true; } if (u < uMin) { u = uMin; sat = true; }
      if (sat) faults.push('saettigung');
      if (tb < tLo || tb > tHi) faults.push('bereich');
      last = { u: u, uIdeal: ideal, tShown: (u - v0) / 0.01 - p.offsetK, tBody: tb, tMedium: Tm, dTself: tb - Tm, saturated: sat, vcc: vcc, faults: faults };
      return last;
    }
    function reset(T0) { body.reset(num(T0, p.tInit)); rng.reset(); step(0, { T: num(T0, p.tInit) }); }
    const s = { kind: p.type, params: p, voltage: U, curve: (a, b, n) => curveOf(U, num(a, tLo), num(b, tHi), n), step: step, reset: reset, state: () => last };
    reset(p.tInit);
    return s;
  }

  /* ---------- Thermoelement Typ K ---------- */
  function thermocouple(params) {
    const p = mixParams({ seebeck: 41, tau: 2, coldComp: true, tColdAssumed: 0, tMin: -200, tMax: 1250, g: 0.01, medium: 'luft', tInit: 25 }, params);
    p.seebeck = pos(p.seebeck, 41);
    const body = thermal(p, p.tInit); let last = null;
    function step(dtMs, inp) {
      inp = obj(inp);
      const Tm = clamp(num(inp.T, 25), -300, 1800), tc = clamp(num(inp.tCold, 25), -50, 120), tcm = clamp(num(inp.tColdMeas, tc), -50, 120), open = bool(inp.open);
      body.step(dtMs, Tm, null);
      const th = body.T, emf = open ? 0 : p.seebeck * (th - tc) / 1000, faults = [];
      const shown = (emf * 1000) / p.seebeck + (p.coldComp ? tcm : p.tColdAssumed);
      if (open) faults.push('drahtbruch');
      if (th < p.tMin || th > p.tMax) faults.push('bereich');
      last = { emf: emf, emfUV: emf * 1000, tHot: th, tMedium: Tm, tCold: tc, tShown: open ? NaN : shown, errorK: open ? NaN : shown - th, open: open, faults: faults };
      if (open) { last.tShown = 0; last.errorK = -th; }
      return last;
    }
    function reset(T0) { body.reset(num(T0, p.tInit)); step(0, { T: num(T0, p.tInit) }); }
    const s = { kind: 'thermocouple', params: p, emf: (tH, tC) => F.thermocoupleEmf(tH, tC, p.seebeck), curve: (a, b, n) => curveOf(t => p.seebeck * (t - 25) / 1000, num(a, -50), num(b, 500), n), step: step, reset: reset, state: () => last };
    reset(p.tInit);
    return s;
  }

  /* ---------- LDR ---------- */
  function ldr(params) {
    const p = mixParams({ r10: 15000, gamma: 0.7, rDark: 1e6, tauRise: 0.02, tauFall: 0.03, pMax: 0.1, noise: 0, seed: 1 }, params);
    p.r10 = pos(p.r10, 15000); p.gamma = pos(p.gamma, 0.7); p.rDark = pos(p.rDark, 1e6);
    const rng = makeRng(p.seed); let g = 1 / p.rDark, last = null;
    const R = lux => 1 / (1 / p.rDark + 1 / F.ldrResistance(lux, p.r10, p.gamma));
    function step(dtMs, inp) {
      inp = obj(inp);
      const lux = clamp(Math.max(0, num(inp.lux, 100)) + Math.max(0, num(inp.ambient, 0)), 0.01, 1e6);
      const gT = 1 / R(lux), tau = gT > g ? p.tauRise : p.tauFall, dt = clamp(num(dtMs, 0), 0, 600000) / 1000;
      g += (gT - g) * (tau > 0 ? 1 - Math.exp(-dt / tau) : 1);
      let r = 1 / g; if (p.noise > 0) r *= 1 + rng.gauss() * 0.005 * p.noise;
      const vcc = clamp(num(inp.vcc, 5), 0, 50), rs = Math.max(0, num(inp.rSeries, 10000)), pw = (rs + r) > 0 ? vcc * vcc / Math.pow(rs + r, 2) * r : 0;
      last = { r: r, g: g, lux: clamp(Math.max(0, num(inp.lux, 100)), 0, 1e6), luxTotal: lux, rStatic: R(lux), power: pw, overload: pw > p.pMax, faults: pw > p.pMax ? ['ueberhitzung'] : [] };
      return last;
    }
    function reset() { g = 1 / p.rDark; rng.reset(); step(0, { lux: 100 }); g = 1 / R(100); last.r = 1 / g; }
    const s = { kind: 'ldr', params: p, resistance: R, curve: (a, b, n) => curveOf(R, num(a, 0.1), num(b, 100000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Fotodiode ---------- */
  function photodiode(params) {
    const p = mixParams({ sens: 0.05, id25: 2e-9, isat: 1e-11, mode: 'pc', rLoad: 10000, rf: 100000, tauMs: 0.01, noise: 0, seed: 1 }, params);
    let last = null, iF = 0;
    const rng = makeRng(p.seed);
    function step(dtMs, inp) {
      inp = obj(inp);
      const lux = Math.max(0, num(inp.lux, 100)) + Math.max(0, num(inp.ambient, 0)), T = clamp(num(inp.T, 25), -40, 125), vcc = clamp(num(inp.vcc, 5), 0, 50);
      const iph = lux * p.sens * 1e-6, id = p.id25 * Math.pow(2, (T - 25) / 10);
      const tau = Math.max(1e-6, p.tauMs / 1000), dt = clamp(num(dtMs, 0), 0, 600000) / 1000;
      iF += (iph + id - iF) * (1 - Math.exp(-dt / tau));
      let i = iF; if (p.noise > 0) i *= 1 + rng.gauss() * 0.002 * p.noise;
      const mode = ['pc', 'pv', 'tia'].indexOf(String(first(inp.mode, p.mode))) >= 0 ? String(first(inp.mode, p.mode)) : 'pc';
      const rl = pos(inp.rLoad, p.rLoad), rf = pos(inp.rf, p.rf);
      let u, sat = false;
      if (mode === 'pv') { u = 0.0259 * Math.log(1 + i / p.isat); if (u > 0.5) { u = 0.5; sat = true; } }
      else if (mode === 'tia') u = i * rf;
      else u = i * rl;
      const uMax = mode === 'pv' ? 0.5 : Math.max(0, vcc - (mode === 'tia' ? 0.1 : 0));
      if (u > uMax) { u = uMax; sat = true; }
      last = { iPhoto: iph, iDark: id, i: i, u: u, mode: mode, lux: lux, saturated: sat, faults: sat ? ['saettigung'] : [] };
      return last;
    }
    function reset() { iF = 0; rng.reset(); step(0, { lux: 0 }); iF = p.id25; }
    const s = { kind: 'photodiode', params: p, curve: (a, b, n) => curveOf(l => l * p.sens * 1e-6 + p.id25, num(a, 0), num(b, 10000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Fototransistor ---------- */
  function phototransistor(params) {
    const p = mixParams({ sens: 0.05, hfe: 300, iceo: 5e-8, vceSat: 0.2, rLoad: 10000, tauMs: 0.02, noise: 0, seed: 1 }, params);
    let last = null, iF = 0;
    function step(dtMs, inp) {
      inp = obj(inp);
      const lux = Math.max(0, num(inp.lux, 100)) + Math.max(0, num(inp.ambient, 0)), T = clamp(num(inp.T, 25), -40, 125), vcc = clamp(num(inp.vcc, 5), 0, 50), rl = pos(inp.rLoad, p.rLoad);
      const iph = lux * p.sens * 1e-6, icTarget = p.hfe * iph + p.iceo * Math.pow(2, (T - 25) / 10);
      const tau = Math.max(1e-6, p.tauMs / 1000 + 20e-12 * rl), dt = clamp(num(dtMs, 0), 0, 600000) / 1000;
      iF += (icTarget - iF) * (1 - Math.exp(-dt / tau));
      const icMax = Math.max(0, vcc - p.vceSat) / rl; let ic = iF, sat = false;
      if (ic > icMax) { ic = icMax; sat = true; }
      last = { iPhoto: iph, ic: ic, icFree: iF, u: vcc - ic * rl, saturated: sat, lux: lux, faults: sat ? ['saettigung'] : [] };
      return last;
    }
    function reset() { iF = p.iceo; step(0, { lux: 0 }); }
    const s = { kind: 'phototransistor', params: p, curve: (a, b, n) => curveOf(l => p.hfe * l * p.sens * 1e-6 + p.iceo, num(a, 0), num(b, 1000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Lichtschranke (Gabel / Reflex) ---------- */
  function lightBarrier(params) {
    const p = mixParams({ kind: 'gabel', thresh: 0.5, hyst: 0.1, range: 100, ambientImmune: false, ambientMax: 20000 }, params);
    let state = 0, last = null;
    function step(dtMs, inp) {
      inp = obj(inp);
      const reflex = String(p.kind) === 'reflex', th = clamp(num(inp.thresh, p.thresh), 0, 1), hy = clamp(num(inp.hyst, p.hyst), 0, 1);
      let own;
      if (reflex) { const d = Math.max(0, num(inp.dist, 50)), rf = clamp(num(inp.reflect, 0.9), 0, 1); own = rf / (1 + Math.pow(d / pos(p.range, 100), 2)) * (d > 1.5 * p.range * 2 ? 0 : 1); }
      else own = 1 - clamp(num(inp.blocked, 0), 0, 1);
      const interference = p.ambientImmune ? 0 : clamp(Math.max(0, num(inp.ambient, 0)) / pos(p.ambientMax, 20000), 0, 2);
      const raw = own + interference, sig = clamp(raw, 0, 1), sat = raw > 1;
      const prev = state;
      if (!state && sig >= th + hy / 2) state = 1; else if (state && sig <= th - hy / 2) state = 0;
      const faults = [];
      if (interference > 0.2) faults.push('fremdlicht'); if (sat) faults.push('saettigung'); if (hy < 0.02) faults.push('flattern');
      last = { signal: sig, signalOwn: own, interference: interference, state: state, edge: state > prev ? 'on' : state < prev ? 'off' : null, saturated: sat, flutterRisk: hy < 0.02, faults: faults };
      return last;
    }
    function reset() { state = 0; step(0, { blocked: 0 }); }
    const s = { kind: 'lightBarrier', params: p, step: step, reset: reset, state: () => last, curve: (a, b, n) => curveOf(d => 1 / (1 + Math.pow(d / p.range, 2)), num(a, 0), num(b, 300), n) };
    reset();
    return s;
  }

  /* ---------- Naeherungsschalter ---------- */
  const INDUCTIVE_FACTORS = { stahl: 1, edelstahl: 0.7, messing: 0.4, alu: 0.4, aluminium: 0.4, kupfer: 0.3, kunststoff: 0, wasser: 0, holz: 0, glas: 0, luft: 0 };
  const CAPACITIVE_FACTORS = { metall: 1, stahl: 1, alu: 1, kupfer: 1, wasser: 1, glas: 0.5, kunststoff: 0.5, pvc: 0.5, holz: 0.4, papier: 0.25, oel: 0.2, luft: 0 };
  function proximity(kind, params) {
    const cap = kind === 'capacitive', factors = cap ? CAPACITIVE_FACTORS : INDUCTIVE_FACTORS;
    const p = mixParams({ sn: cap ? 8 : 4, hyst: cap ? 0.15 : 0.1, tempDrift: 0.001, sens: 1, type: 'pnp', dropV: 0.5, noise: 0, seed: 1 }, params);
    p.sn = pos(p.sn, cap ? 8 : 4); p.hyst = clamp(p.hyst, 0, 0.5);
    const rng = makeRng(p.seed); let state = 0, toggles = 0, last = null;
    function step(dtMs, inp) {
      inp = obj(inp);
      const mat = String(first(inp.material, cap ? 'wasser' : 'stahl')).toLowerCase(), f = factors[mat] === undefined ? 0 : factors[mat];
      const size = clamp(num(inp.size, 1), 0, 1), T = clamp(num(inp.T, 23), -40, 120);
      const d = Math.max(0, num(inp.dist, 10)) + (p.noise > 0 ? rng.gauss() * 0.1 * p.noise : 0);
      let sr = p.sn * f * Math.min(1, size) * (1 + p.tempDrift * (T - 23)); if (cap) sr *= clamp(p.sens, 0.3, 1.3);
      sr = Math.max(0, sr);
      const srOff = sr * (1 + p.hyst), prev = state;
      if (f > 0) { if (!state && d <= sr) state = 1; else if (state && d > srOff) state = 0; } else state = 0;
      if (state !== prev) toggles++;
      const vcc = clamp(num(inp.vcc, 24), 0, 60), rl = pos(inp.rLoad, 10000);
      const high = p.type === 'npn' ? !state : !!state;
      const uOut = p.type === 'npn' ? (state ? Math.min(p.dropV, vcc) : vcc) : (state ? Math.max(0, vcc - p.dropV) : 0);
      const faults = []; if (f === 0) faults.push('bereich'); if (p.hyst < 0.02) faults.push('flattern');
      last = { state: state, edge: state > prev ? 'on' : state < prev ? 'off' : null, factor: f, sr: sr, srOn: sr, srOff: srOff, hystMm: srOff - sr, hystPct: p.hyst * 100,
        signal: f > 0 && sr > 0 ? clamp(1 - d / (1.5 * sr), 0, 1) : 0, uOut: uOut, iOut: uOut / rl, high: high, dist: d, toggles: toggles, material: mat, faults: faults };
      return last;
    }
    function reset() { state = 0; toggles = 0; rng.reset(); step(0, { dist: 1000 }); }
    const s = { kind: kind, params: p, factors: factors, step: step, reset: reset, state: () => last,
      curve: (a, b, n) => curveOf(d => (d <= p.sn ? 1 : 0), num(a, 0), num(b, 3 * p.sn), n) };
    reset();
    return s;
  }

  /* ---------- Ultraschall ---------- */
  function ultrasonic(params) {
    const p = mixParams({ minMm: 20, maxMm: 4000, tempComp: true, timerUs: 1, periodMs: 60, sigmaMm: 0.3, noise: 0, seed: 1 }, params);
    p.timerUs = pos(p.timerUs, 1); p.periodMs = pos(p.periodMs, 60);
    const rng = makeRng(p.seed); let acc = 1e9, hold = null, last = null;
    function measure(inp) {
      const T = clamp(num(inp.T, 20), -40, 120), d = Math.max(0, num(inp.dist, 500)) + (p.noise > 0 ? rng.gauss() * p.sigmaMm * p.noise : 0);
      const c = F.speedOfSound(T), cA = p.tempComp ? c : F.speedOfSound(20), tofExact = 2 * d / c * 1e3;
      let status = 'ok', valid = true; const faults = [];
      if (d < p.minMm) { status = 'zu nah'; valid = false; faults.push('zu_nah'); }
      else if (d > p.maxMm) { status = 'kein Echo'; valid = false; faults.push('kein_echo'); }
      const tof = Math.floor(tofExact / p.timerUs) * p.timerUs, ds = cA * tof * 1e-3 / 2;
      return { tofUs: valid ? tof : 0, tofExact: tofExact, echoUs: valid ? tof : 0, c: c, cAssumed: cA, distShown: valid ? ds : 0, distTrue: Math.max(0, num(inp.dist, 500)), error: valid ? ds - Math.max(0, num(inp.dist, 500)) : 0, valid: valid, status: status, faults: faults };
    }
    function step(dtMs, inp) {
      inp = obj(inp); acc += clamp(num(dtMs, 0), 0, 600000); let updated = false;
      if (acc >= p.periodMs || !hold) { hold = measure(inp); acc = acc >= p.periodMs ? acc % p.periodMs : 0; updated = true; }
      last = Object.assign({}, hold, { updated: updated });
      return last;
    }
    function reset() { rng.reset(); last = Object.assign({}, measure({ dist: 500, T: 20 }), { updated: true }); rng.reset(); acc = 1e9; hold = null; }
    const s = { kind: 'ultrasonic', params: p, curve: (a, b, n) => curveOf(d => F.ultrasonicTof(d, 20), num(a, 0), num(b, 4000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Dehnungsmessstreifen ---------- */
  function bridgeArms(type, xm, xt, unb, over) {
    let r1 = 1, r2 = 1, r3 = 1, r4 = 1;
    if (type === 'quarter') { r2 = 1 + xm + xt; }
    else if (type === 'half') { r1 = 1 - xm + xt; r2 = 1 + xm + xt; }
    else { r1 = 1 - xm + xt; r2 = 1 + xm + xt; r3 = 1 + xm + xt; r4 = 1 - xm + xt; }
    r1 *= 1 + unb;
    return [r1, r2, r3, r4].map(x => Math.max(1e-6, x));
  }
  function ratioOfArms(a) { return a[1] / (a[0] + a[1]) - a[3] / (a[2] + a[3]); }
  function strainGauge(params) {
    const p = mixParams({ k: 2, r0: 350, bridge: 'full', epsMax: 1000, fMax: 100, ue: 5, alphaR: 1e-5, kTc: -1e-4, tRef: 23, tauT: 30, hys: 0.005, creep: 0.002, tauCreep: 120, overload: 1.5, unbalance: 0, pMaxGauge: 0.05, tInit: 23 }, params);
    p.k = pos(p.k, 2); p.r0 = pos(p.r0, 350); p.fMax = pos(p.fMax, 100);
    if (['quarter', 'half', 'full'].indexOf(p.bridge) < 0) p.bridge = 'full';
    let yHyst = 0, creepS = 0, plastic = 0, tg = p.tInit, last = null;
    function step(dtMs, inp) {
      inp = obj(inp);
      const dt = clamp(num(dtMs, 0), 0, 600000) / 1000;
      const type = ['quarter', 'half', 'full'].indexOf(inp.bridge) >= 0 ? inp.bridge : p.bridge;
      const fmax = pos(inp.fMax, p.fMax), ue = clamp(num(inp.ue, p.ue), 0, 50), xin = clamp(num(first(inp.force, inp.load, inp.pressure), 0) / fmax, -5, 5);
      const tAmb = clamp(num(inp.temp, p.tRef), -60, 250);
      tg += (tAmb - tg) * (p.tauT > 0 ? 1 - Math.exp(-dt / p.tauT) : 1);
      const half = Math.max(0, p.hys) / 2;
      if (xin > yHyst + half) yHyst = xin - half; else if (xin < yHyst - half) yHyst = xin + half;
      creepS += (p.creep * yHyst - creepS) * (p.tauCreep > 0 ? 1 - Math.exp(-dt / p.tauCreep) : 1);
      if (Math.abs(xin) > p.overload) plastic = Math.max(plastic, (Math.abs(xin) - p.overload) * 0.2);
      const epsMech = (yHyst + creepS + plastic) * p.epsMax;
      const kEff = p.k * (1 + p.kTc * (tg - p.tRef)), xt = p.alphaR * (tg - p.tRef), xm = kEff * epsMech * 1e-6;
      const arms = bridgeArms(type, xm, xt, p.unbalance), ratio = ratioOfArms(arms);
      const uBr = ratio * ue * 1000, pg = ue * ue / (4 * p.r0), faults = [];
      if (Math.abs(xin) > 1.2) faults.push('uebersteuerung');
      if (Math.abs(xin) > p.overload) faults.push('ueberlast'); if (plastic > 0) pushUnique(faults, 'ueberlast_bleibend');
      if (pg > p.pMaxGauge) faults.push('speisung_hoch');
      last = { strain: epsMech + xt / kEff * 1e6, strainMech: epsMech, apparentStrain: xt / kEff * 1e6, dROverR: xm + xt, dR: p.r0 * (xm + xt), ratio: ratio, mVperV: ratio * 1000, uBridge: uBr, ue: ue,
        load: xin, tGauge: tg, hysteresis: p.hys * 100, creepPct: creepS * 100, permanentSet: plastic * p.epsMax, pGauge: pg, bridge: type,
        overrange: Math.abs(xin) > 1.2, overload: Math.abs(xin) > p.overload, faults: faults };
      return last;
    }
    function reset() { yHyst = 0; creepS = 0; plastic = 0; tg = p.tInit; step(0, { force: 0, temp: p.tInit }); }
    const s = { kind: 'strainGauge', params: p, bridgeRatio: (type, x) => ratioOfArms(bridgeArms(type, x, 0, 0)),
      curve: (a, b, n) => curveOf(f => ratioOfArms(bridgeArms(p.bridge, p.k * f / p.fMax * p.epsMax * 1e-6, 0, p.unbalance)) * 1000, num(a, 0), num(b, p.fMax), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- MEMS-Beschleunigungssensor ---------- */
  function mems(params) {
    const p = mixParams({ range: 2, res: 10, rate: 100, noise: 0, seed: 1, offsetMg: [0, 0, 0], sensErr: 0, noiseDensity: 290 }, params);
    const ranges = [2, 4, 8, 16]; let best = 2;
    for (const r of ranges) if (Math.abs(r - p.range) < Math.abs(best - p.range)) best = r;
    p.range = best; p.res = p.res >= 12 ? 13 : 10; p.rate = clamp(p.rate, 0.1, 3200);
    const bits = p.res === 13 ? 10 + Math.round(Math.log(p.range / 2) / Math.LN2) : 10;
    const lsbG = 2 * p.range / Math.pow(2, bits), bw = p.rate / 2, rng = makeRng(p.seed), nMax = Math.pow(2, bits - 1);
    let t = 0, acc = 0, last = null;
    function rawOf(g) { return clamp(Math.round(g / lsbG), -nMax, nMax - 1); }
    function step(dtMs, inp) {
      inp = obj(inp);
      const dtS = clamp(num(dtMs, 0), 0, 600000) / 1000; t += dtS; acc += dtS;
      const tx = clamp(num(inp.tiltX, 0), -90, 90) * PI / 180, ty = clamp(num(inp.tiltY, 0), -180, 180) * PI / 180;
      let gx = Math.sin(tx), gy = Math.cos(tx) * Math.sin(ty), gz = Math.cos(tx) * Math.cos(ty);
      const vf = Math.max(0, num(inp.vibFreq, 0)), va = Math.max(0, num(inp.vibAmp, 0));
      const vib = va * Math.sin(TWO_PI * vf * t) / Math.sqrt(1 + Math.pow(vf / bw, 2));
      gz += clamp(num(inp.shock, 0), -200, 200) + vib; gx += clamp(num(inp.ax, 0), -200, 200); gy += clamp(num(inp.ay, 0), -200, 200); gz += clamp(num(inp.az, 0), -200, 200);
      const sg = p.noise > 0 ? p.noise * p.noiseDensity * 1e-6 * Math.sqrt(bw) : 0;
      const sens = 1 + p.sensErr, off = p.offsetMg;
      const ax = gx * sens + num(off[0], 0) / 1000 + (sg ? rng.gauss() * sg : 0);
      const ay = gy * sens + num(off[1], 0) / 1000 + (sg ? rng.gauss() * sg : 0);
      const az = gz * sens + num(off[2], 0) / 1000 + (sg ? rng.gauss() * sg * 1.5 : 0);
      const raw = [rawOf(ax), rawOf(ay), rawOf(az)], g = [raw[0] * lsbG, raw[1] * lsbG, raw[2] * lsbG];
      const clip = { x: Math.abs(ax) >= p.range, y: Math.abs(ay) >= p.range, z: Math.abs(az) >= p.range };
      clip.any = clip.x || clip.y || clip.z;
      const regs = []; for (const v of raw) { const u16 = v & 0xFFFF; regs.push(u16 & 255, (u16 >> 8) & 255); }
      const period = 1 / p.rate, ready = acc >= period; if (ready) acc %= period;
      const pitch = Math.atan2(g[0], Math.hypot(g[1], g[2])) * 180 / PI, roll = Math.atan2(g[1], g[2]) * 180 / PI;
      const pT = Math.atan2(gx, Math.hypot(gy, gz)) * 180 / PI, rT = Math.atan2(gy, gz) * 180 / PI;
      last = { ax: g[0], ay: g[1], az: g[2], ms2: { x: g[0] * G0, y: g[1] * G0, z: g[2] * G0 }, raw: raw, regs: regs, hex: regs.map(hex2), pitch: pitch, roll: roll, pitchTrue: pT, rollTrue: rT,
        tiltErr: Math.hypot(pitch - pT, ((roll - rT + 540) % 360) - 180), norm: Math.hypot(g[0], g[1], g[2]), lsbG: lsbG, bits: bits, bw: bw, noiseG: sg, clipped: clip, sampleReady: ready,
        range: p.range, faults: clip.any ? ['clipping'] : [] };
      return last;
    }
    function reset() { t = 0; acc = 0; rng.reset(); step(0, {}); }
    const s = { kind: 'mems', params: p, lsb: () => lsbG, bits: bits, curve: (a, b, n) => curveOf(d => rawOf(Math.sin(d * PI / 180)), num(a, -90), num(b, 90), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Feuchte (SHT3x-aehnlich) ---------- */
  function humidity(params) {
    const p = mixParams({ tauT: 5, tauRH: 8, rhOff: 0, tOff: 0, noise: 0, seed: 1, tInit: 25, rhInit: 50 }, params);
    const rng = makeRng(p.seed); let T = p.tInit, RH = p.rhInit, last = null;
    function step(dtMs, inp) {
      inp = obj(inp);
      const dt = clamp(num(dtMs, 0), 0, 600000) / 1000, tm = clamp(num(inp.T, 25), -40, 125), rm = clamp(num(inp.rh, 50), 0, 100);
      T += (tm - T) * (p.tauT > 0 ? 1 - Math.exp(-dt / p.tauT) : 1); RH += (rm - RH) * (p.tauRH > 0 ? 1 - Math.exp(-dt / p.tauRH) : 1);
      const tn = p.noise > 0 ? rng.gauss() * 0.04 * p.noise : 0, rn = p.noise > 0 ? rng.gauss() * 0.08 * p.noise : 0;
      const rawT = clamp(Math.round((T + p.tOff + tn + 45) / 175 * 65535), 0, 65535), rawRH = clamp(Math.round((RH + p.rhOff + rn) / 100 * 65535), 0, 65535);
      const Ts = F.shtTemperature(rawT), Rs = F.shtHumidity(rawRH);
      const e = Rs / 100 * 6.112 * Math.exp(17.62 * Ts / (243.12 + Ts)), ah = 216.7 * e / (273.15 + Ts);
      const bt = [rawT >> 8, rawT & 255], br = [rawRH >> 8, rawRH & 255];
      last = { T: Ts, rh: Rs, tTrue: tm, rhTrue: rm, tSensor: T, rhSensor: RH, rawT: rawT, rawRH: rawRH, bytes: [bt[0], bt[1], crc8(bt, 0x31, 0xFF), br[0], br[1], crc8(br, 0x31, 0xFF)],
        dewPoint: dewPoint(Ts, Rs), absHum: ah, faults: [] };
      return last;
    }
    function reset() { T = p.tInit; RH = p.rhInit; rng.reset(); step(0, { T: p.tInit, rh: p.rhInit }); }
    const s = { kind: 'humidity', params: p, curve: (a, b, n) => curveOf(r => Math.round(r / 100 * 65535), num(a, 0), num(b, 100), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- Gas (MQ-aehnlich) ---------- */
  const GAS_TABLE = {
    lpg: { name: 'Flüssiggas', ppmRef: 1000, ratioRef: 0.7, n: 0.45 },
    co: { name: 'Kohlenmonoxid', ppmRef: 200, ratioRef: 1.6, n: 0.5 },
    methane: { name: 'Methan', ppmRef: 5000, ratioRef: 0.8, n: 0.38 },
    alkohol: { name: 'Alkohol', ppmRef: 1000, ratioRef: 0.55, n: 0.55 },
    h2: { name: 'Wasserstoff', ppmRef: 1000, ratioRef: 0.6, n: 0.42 },
    rauch: { name: 'Rauch', ppmRef: 1000, ratioRef: 0.65, n: 0.5 }
  };
  function gasRatioOf(g, ppm, rClean) {
    const x = Math.max(0, ppm) / g.ppmRef, inv = 1 / rClean + Math.pow(x, g.n) / g.ratioRef;
    return 1 / inv;
  }
  function gas(params) {
    const p = mixParams({ gas: 'lpg', r0: 10000, rClean: 9.8, rLoad: 10000, tauHeat: 45, tempCoeff: 0.008, heaterW: 0.75, noise: 0, seed: 1, warmInit: 1 }, params);
    const g = GAS_TABLE[p.gas] || GAS_TABLE.lpg; p.r0 = pos(p.r0, 10000); p.rClean = pos(p.rClean, 9.8);
    const rng = makeRng(p.seed); let h = clamp(p.warmInit, 0, 1), last = null;
    function ppmFrom(ratio) {
      const v = g.ratioRef * (1 / Math.max(1e-6, ratio) - 1 / p.rClean);
      return v <= 0 ? 0 : g.ppmRef * Math.pow(v, 1 / g.n);
    }
    function step(dtMs, inp) {
      inp = obj(inp);
      const dt = clamp(num(dtMs, 0), 0, 600000) / 1000, heat = inp.heater === undefined ? true : bool(inp.heater);
      h += ((heat ? 1 : 0) - h) * (p.tauHeat > 0 ? 1 - Math.exp(-dt / p.tauHeat) : 1);
      const ppm = clamp(num(inp.gas, 0), 0, 1e5), T = clamp(num(inp.T, 20), -20, 60), vcc = clamp(num(inp.vcc, 5), 0, 24);
      let ratio = gasRatioOf(g, ppm * h, p.rClean) * clamp(1 - p.tempCoeff * (T - 20), 0.3, 3);
      ratio *= 1 + 9 * Math.pow(1 - h, 2); if (p.noise > 0) ratio *= 1 + rng.gauss() * 0.01 * p.noise;
      const rs = ratio * p.r0, uOut = vcc * p.rLoad / (rs + p.rLoad), faults = [];
      if (h < 0.95) faults.push('warm');
      last = { rs: rs, ratio: ratio, uOut: uOut, ppmEst: ppmFrom(ratio), ppmTrue: ppm, warm: h, ready: h >= 0.95, heaterW: heat ? p.heaterW * clamp(vcc / 5, 0, 5) : 0, gas: p.gas, faults: faults };
      return last;
    }
    function reset() { h = clamp(p.warmInit, 0, 1); rng.reset(); step(0, { gas: 0 }); }
    const s = { kind: 'gas', params: p, curveDef: g, ppmFromRatio: ppmFrom, curve: (a, b, n) => curveOf(x => gasRatioOf(g, x, p.rClean), num(a, 1), num(b, 10000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  /* ---------- ToF-Abstand ---------- */
  function tof(params) {
    const p = mixParams({ maxRange: 2000, minMm: 30, budgetMs: 33, sigmaLimit: 18, offsetMm: 0, noise: 0, seed: 1 }, params);
    p.budgetMs = pos(p.budgetMs, 33);
    const rng = makeRng(p.seed); let acc = 1e9, hold = null, last = null;
    function measure(inp) {
      const d = Math.max(0, num(inp.dist, 500)), rf = clamp(num(inp.reflect, 0.5), 0.02, 1), amb = clamp(num(inp.ambient, 0), 0, 200);
      const maxEff = Math.max(100, p.maxRange * Math.sqrt(rf / 0.88) * (1 - 0.5 * Math.min(amb, 100) / 100));
      const sigma = (1 + 6 * Math.pow(d / maxEff, 2)) * Math.sqrt(33 / p.budgetMs) * Math.sqrt(0.5 / rf);
      let status = 0; const faults = [];
      if (d < p.minMm) { status = 3; faults.push('zu_nah'); } else if (d > maxEff) { status = 4; faults.push('ausser_bereich'); } else if (sigma > p.sigmaLimit) { status = 1; faults.push('sigma'); }
      const raw = d + p.offsetMm + (p.noise > 0 ? rng.gauss() * sigma * p.noise : 0);
      return { distShown: status === 4 ? 8190 : Math.max(0, Math.round(raw)), distRaw: raw, distTrue: d, sigma: sigma, status: status, valid: status === 0, maxEff: maxEff, faults: faults };
    }
    function step(dtMs, inp) {
      inp = obj(inp); acc += clamp(num(dtMs, 0), 0, 600000); let updated = false;
      if (acc >= p.budgetMs || !hold) { hold = measure(inp); acc = acc >= p.budgetMs ? acc % p.budgetMs : 0; updated = true; }
      last = Object.assign({}, hold, { updated: updated }); return last;
    }
    function reset() { rng.reset(); last = Object.assign({}, measure({ dist: 500 }), { updated: true }); rng.reset(); acc = 1e9; hold = null; }
    const s = { kind: 'tof', params: p, curve: (a, b, n) => curveOf(d => (1 + 6 * Math.pow(d / p.maxRange, 2)), num(a, 0), num(b, 2000), n), step: step, reset: reset, state: () => last };
    reset();
    return s;
  }

  sensors.ntc = ntc; sensors.pt = pt; sensors.lm35 = lm35; sensors.tmp36 = function (p) { return lm35(Object.assign({}, obj(p), { type: 'tmp36' })); };
  sensors.thermocouple = thermocouple; sensors.ldr = ldr; sensors.photodiode = photodiode; sensors.phototransistor = phototransistor; sensors.lightBarrier = lightBarrier;
  sensors.inductive = function (p) { return proximity('inductive', p); }; sensors.capacitive = function (p) { return proximity('capacitive', p); };
  sensors.ultrasonic = ultrasonic; sensors.strainGauge = strainGauge; sensors.mems = mems; sensors.humidity = humidity; sensors.gas = gas; sensors.tof = tof;

  presets.ntc = [{ id: 'ntc10k', name: 'NTC 10 kΩ, B 3950', params: { r25: 10000, b: 3950 } }, { id: 'ntc100k', name: 'NTC 100 kΩ, B 3950', params: { r25: 100000, b: 3950 } }, { id: 'ntc4k7', name: 'NTC 4,7 kΩ, B 3435', params: { r25: 4700, b: 3435 } }];
  presets.pt = [{ id: 'pt100', name: 'Pt100', params: { type: 'pt100' } }, { id: 'pt1000', name: 'Pt1000', params: { type: 'pt1000' } }];
  presets.ldr = [{ id: 'gl5528', name: 'LDR 5528 (ca. 15 kΩ bei 10 lx)', params: { r10: 15000, gamma: 0.7 } }, { id: 'gl5516', name: 'LDR 5516 (ca. 8 kΩ bei 10 lx)', params: { r10: 8000, gamma: 0.6 } }];
  presets.inductive = [{ id: 'm8', name: 'induktiv M8, sn 2 mm', params: { sn: 2 } }, { id: 'm12', name: 'induktiv M12, sn 4 mm', params: { sn: 4 } }, { id: 'm18', name: 'induktiv M18, sn 8 mm', params: { sn: 8 } }];
  presets.capacitive = [{ id: 'm18c', name: 'kapazitiv M18, sn 8 mm', params: { sn: 8 } }, { id: 'm30c', name: 'kapazitiv M30, sn 15 mm', params: { sn: 15 } }];
  presets.strain = [{ id: 'dms120', name: 'DMS 120 Ω', params: { r0: 120 } }, { id: 'dms350', name: 'DMS 350 Ω', params: { r0: 350 } }, { id: 'dms1000', name: 'DMS 1000 Ω', params: { r0: 1000 } }];
  presets.mems = [2, 4, 8, 16].map(r => ({ id: 'g' + r, name: '±' + r + ' g', params: { range: r } }));
  presets.gas = Object.keys(GAS_TABLE).map(k => ({ id: k, name: GAS_TABLE[k].name, params: { gas: k } }));

  /* =====================================================================================================
   * SCHALTUNGEN
   * ===================================================================================================== */
  const circuits = {};

  circuits.divider = function (uin, r1, r2, rLoad) {
    const ue = num(uin, 0), a = Math.max(0, num(r1, 0)), b = Math.max(0, num(r2, 0)), l = num(rLoad, Infinity), lOk = l > 0 && isFinite(l);
    const be = lOk ? (b === 0 ? 0 : b * l / (b + l)) : b, rt = a + be, uOut = rt === 0 ? 0 : ue * be / rt, i = rt === 0 ? 0 : ue / rt;
    return { uOut: uOut, i: i, iLoad: lOk ? uOut / l : 0, ratio: rt === 0 ? 0 : be / rt, rTh: (a + b) === 0 ? 0 : a * b / (a + b), pR1: i * i * a, pR2: b > 0 ? uOut * uOut / b : 0, rEff: be, rTotal: rt };
  };
  function bridgeFn(type, params) {
    const p = obj(params), ue = clamp(num(p.ue, 5), -1000, 1000), r = clamp(pos(p.r, 350), 1e-3, 1e9), k = pos(p.k, 2);
    type = ['quarter', 'half', 'full', 'general'].indexOf(type) >= 0 ? type : 'quarter';
    let arms, xm = 0;
    if (type === 'general') {
      arms = [pos(p.r1, r) / r, pos(p.r2, r) / r, pos(p.r3, r) / r, pos(p.r4, r) / r];
    } else {
      xm = p.eps !== undefined ? k * num(p.eps, 0) * 1e-6 : num(p.x, 0);
      xm = clamp(xm, -0.9, 5);
      arms = bridgeArms(type, xm, num(p.xt, 0), num(p.unbalance, 0));
    }
    const ratio = ratioOfArms(arms), uA = ue * arms[1] / (arms[0] + arms[1]), uB = ue * arms[3] / (arms[2] + arms[3]);
    const lin = type === 'quarter' ? ue * xm / 4 : type === 'half' ? ue * xm / 2 : type === 'full' ? ue * xm : ratio * ue;
    const iB = ue / ((arms[0] + arms[1]) * r) + ue / ((arms[2] + arms[3]) * r);
    return { type: type, ua: ratio * ue, ratio: ratio, mVperV: ratio * 1000, uA: uA, uB: uB, x: xm, linear: lin, nonlinPct: lin !== 0 ? (ratio * ue - lin) / lin * 100 : 0, iBridge: iB, pBridge: ue * iB };
  }
  circuits.bridge = bridgeFn;
  circuits.bridge.quarter = p => bridgeFn('quarter', p); circuits.bridge.half = p => bridgeFn('half', p); circuits.bridge.full = p => bridgeFn('full', p);

  circuits.instrAmp = function (params) {
    const p = mixParams({ gain: 0, rg: 0, kOhm: 49400, vccP: 5, vccN: 0, margin: 1, vref: 0, cmrrDb: 100, vos: 0, gbw: 1e6 }, params);
    p.kOhm = pos(p.kOhm, 49400);
    const gain = clamp(p.gain > 0 ? p.gain : (p.rg > 0 ? 1 + p.kOhm / p.rg : 1), 1, 10000);
    const hi = p.vccP - p.margin, lo = p.vccN + p.margin; let y = null;
    function ev(up, um) {
      const u1 = num(up, 0), u2 = num(um, 0), diff = u1 - u2, cm = (u1 + u2) / 2, cmErr = gain * cm / Math.pow(10, p.cmrrDb / 20);
      const ideal = gain * (diff + p.vos) + p.vref, out0 = ideal + cmErr; let out = out0, clip = null;
      if (out > hi) { out = hi; clip = 'high'; } else if (out < lo) { out = lo; clip = 'low'; }
      return { out: out, outIdeal: ideal, gain: gain, diff: diff, cm: cm, cmErr: cmErr, saturated: !!clip, clip: clip, railHigh: hi, railLow: lo, fBw: p.gbw / gain };
    }
    function step(dtMs, inp) {
      inp = obj(inp); const r = ev(inp.up, inp.um), dt = clamp(num(dtMs, 0), 0, 600000) / 1000, tau = 1 / (TWO_PI * (p.gbw / gain));
      if (y === null) y = r.out; y += (r.out - y) * (1 - Math.exp(-dt / tau)); r.out = y; return r;
    }
    return { params: p, gain: gain, eval: ev, step: step, rgFor: g => (num(g, 1) > 1 ? p.kOhm / (num(g, 1) - 1) : Infinity), reset: () => { y = null; } };
  };
  circuits.opampGain = function (params) {
    const p = mixParams({ mode: 'inv', rin: 1000, rf: 10000, vccP: 5, vccN: 0, margin: 0.1, gbw: 1e6 }, params);
    p.rin = pos(p.rin, 1000); p.rf = pos(p.rf, 10000);
    const inv = String(p.mode) !== 'noninv', gain = inv ? -p.rf / p.rin : 1 + p.rf / p.rin, hi = p.vccP - p.margin, lo = p.vccN + p.margin, fc = p.gbw / Math.abs(gain === 0 ? 1 : (inv ? 1 + p.rf / p.rin : gain));
    let y = null;
    function ev(u, vref) {
      const vr = num(vref, 0), ideal = vr + gain * (num(u, 0) - vr); let out = ideal, clip = null;
      if (out > hi) { out = hi; clip = 'high'; } else if (out < lo) { out = lo; clip = 'low'; }
      return { out: out, outIdeal: ideal, gain: gain, saturated: !!clip, clip: clip, fBw: fc };
    }
    function step(dtMs, inp) { inp = obj(inp); const r = ev(inp.u, inp.vref), dt = clamp(num(dtMs, 0), 0, 600000) / 1000, tau = 1 / (TWO_PI * fc); if (y === null) y = r.out; y += (r.out - y) * (1 - Math.exp(-dt / tau)); r.out = y; return r; }
    return { params: p, gain: gain, fBw: fc, eval: ev, step: step, reset: () => { y = null; } };
  };
  circuits.lowpass = function (params) {
    const p = mixParams({ fc: 0, r: 0, c: 0, order: 1, init: 'first' }, params);
    const fc = p.fc > 0 ? p.fc : (p.r > 0 && p.c > 0 ? 1 / (TWO_PI * p.r * p.c) : 10), n = clamp(Math.floor(p.order), 1, 4), tau = 1 / (TWO_PI * fc);
    let ys = null;
    const o = {
      params: p, fc: fc, tau: tau, order: n, riseTime: 2.2 * tau,
      step(dtMs, u) {
        u = num(u, 0); const dt = clamp(num(dtMs, 0), 0, 600000) / 1000, k = 1 - Math.exp(-dt / tau);
        if (ys === null) ys = new Array(n).fill(String(p.init) === 'first' ? u : 0);
        let x = u; for (let i = 0; i < n; i++) { ys[i] += (x - ys[i]) * k; x = ys[i]; }
        return x;
      },
      gain: f => Math.pow(1 / Math.sqrt(1 + Math.pow(num(f, 0) / fc, 2)), n),
      phase: f => -n * Math.atan(num(f, 0) / fc) * 180 / PI,
      reset(y) { ys = y === undefined ? null : new Array(n).fill(num(y, 0)); },
      value: () => (ys ? ys[n - 1] : 0)
    };
    return o;
  };
  circuits.comparator = function (params) {
    const p = mixParams({ vth: 2.5, hyst: 0.2, invert: false, vcc: 5, state: false }, params);
    const hy = Math.max(0, p.hyst), upper = p.vth + hy / 2, lower = p.vth - hy / 2; let st = !!p.state;
    return {
      params: p, upper: upper, lower: lower,
      step(u) {
        u = num(u, 0); const prev = st;
        if (!st && u >= upper) st = true; else if (st && u <= lower) st = false;
        const q = p.invert ? !st : st;
        return { state: q ? 1 : 0, internal: st ? 1 : 0, out: q ? p.vcc : 0, upper: upper, lower: lower, switched: st !== prev };
      },
      reset(s) { st = !!s; }
    };
  };
  circuits.schmitt = function (rin, rfb, usat) {
    const a = pos(rin, 1000), b = pos(rfb, 10000), u = pos(usat, 5), th = u * a / b;
    return { upper: th, lower: -th, hyst: 2 * th };
  };
  circuits.constCurrent = function (params) {
    const p = mixParams({ iSet: 0, uRef: 1, rSense: 1000, vcc: 5, drop: 0.5 }, params);
    const iSet = p.iSet > 0 ? p.iSet : p.uRef / pos(p.rSense, 1000), uMax = Math.max(0, p.vcc - p.drop);
    return {
      params: p, iSet: iSet, uMax: uMax,
      eval(rLoad) {
        const r = Math.max(0, num(rLoad, 0)), iMax = r > 0 ? uMax / r : Infinity, i = Math.min(iSet, iMax);
        return { i: i, uLoad: i * r, iSet: iSet, limited: iMax < iSet, uMax: uMax, pLoad: i * i * r, rMax: iSet > 0 ? uMax / iSet : Infinity };
      }
    };
  };

  const NORM = {
    '4-20': { id: '4-20', unit: 'mA', lo: 4, hi: 20, kind: 'current', liveZero: true, iMin: 3.8, iMax: 20.5, name: '4…20 mA' },
    '0-20': { id: '0-20', unit: 'mA', lo: 0, hi: 20, kind: 'current', liveZero: false, iMin: 0, iMax: 21, name: '0…20 mA' },
    '0-10': { id: '0-10', unit: 'V', lo: 0, hi: 10, kind: 'voltage', liveZero: false, iMin: 0, iMax: 10.5, name: '0…10 V' },
    '1-5': { id: '1-5', unit: 'V', lo: 1, hi: 5, kind: 'voltage', liveZero: true, iMin: 0.8, iMax: 5.25, name: '1…5 V' }
  };
  function normKey(t) { t = String(t === undefined ? '4-20' : t).replace(/[…\s]/g, '-').replace(/mA|V/g, '').replace(/--+/g, '-').replace(/^-|-$/g, ''); return NORM[t] ? t : '4-20'; }
  circuits.normSignals = NORM;
  circuits.normSignal = (type, frac) => { const s = NORM[normKey(type)]; return s.lo + num(frac, 0) * (s.hi - s.lo); };
  circuits.normFraction = (type, val) => { const s = NORM[normKey(type)]; return (num(val, s.lo) - s.lo) / (s.hi - s.lo); };
  circuits.normChain = function (params) {
    const p = mixParams({ signal: '4-20', value: 50, lo: 0, hi: 100, uSupply: 24, uMin: 12, rBurden: 250, rLine: 0, rOut: 100, rIn: 1e6, adcBits: 12, vref: 3.3, att: 0, emi: 0, t: 0, wireBreak: false, short: false }, params);
    const sg = NORM[normKey(p.signal)], span = (p.hi - p.lo) || 1, frac = (num(p.value, 0) - p.lo) / span;
    const rb = Math.max(0, p.rBurden), rl = Math.max(0, p.rLine), faults = [];
    const noiseV = p.emi * (p.t > 0 ? Math.sin(TWO_PI * 50 * p.t / 1000) : 1);
    const adcObj = adc(p.adcBits, p.vref, {}); let iLoop = 0, uSig = 0, uBurden = 0, uAdc = 0, iSet = 0, headroom = 0, headroomActual = 0, iMaxCompl = 0, uTx = 0, sat = false, noise = 0, att = 1;
    const rBurdenMax = Math.max(0, (p.uSupply - p.uMin) / 0.020 - rl);
    if (sg.kind === 'current') {
      iSet = clamp(sg.lo + frac * (sg.hi - sg.lo), sg.iMin, sg.iMax);
      iMaxCompl = Math.max(0, (p.uSupply - p.uMin) / Math.max(1e-9, rb + rl) * 1000);
      headroom = p.uSupply - iSet / 1000 * (rb + rl) - p.uMin;
      iLoop = Math.min(iSet, iMaxCompl); sat = iSet > iMaxCompl + 1e-9;
      if (p.wireBreak) iLoop = 0;
      const rEffB = p.short ? 0 : rb;
      noise = rb > 0 ? noiseV * rEffB / 1e5 / Math.max(1, 1) : 0;
      uBurden = iLoop / 1000 * rEffB + noise;
      headroomActual = p.uSupply - iLoop / 1000 * (rb + rl) - p.uMin;
      uTx = p.uSupply - iLoop / 1000 * (rb + rl);
      uSig = uBurden; att = p.att > 0 ? p.att : 1; uAdc = uBurden * att;
    } else {
      uSig = clamp(sg.lo + frac * (sg.hi - sg.lo), sg.iMin, sg.iMax);
      const rin = pos(p.rIn, 1e6), drop = rin / (rin + p.rOut + rl);
      uBurden = p.wireBreak ? 0 : (p.short ? 0 : uSig * drop + noiseV);
      noise = noiseV; iLoop = p.wireBreak ? 0 : (p.short ? uSig / Math.max(1, p.rOut + rl) * 1000 : uSig / (rin + p.rOut + rl) * 1000);
      att = p.att > 0 ? p.att : Math.min(1, p.vref / (sg.hi * 1.05)); uAdc = uBurden * att; uTx = uSig;
      headroom = headroomActual = 0; iMaxCompl = 0;
    }
    const smp = adcObj.sample(uAdc), code = smp.code, uMeas = code * adcObj.lsb / att + (att > 0 ? adcObj.lsb / att / 2 : 0);
    let shown;
    if (sg.kind === 'current') { const mA = uMeas / Math.max(1e-9, rb) * 1000; shown = p.lo + (mA - sg.lo) / (sg.hi - sg.lo) * span; }
    else shown = p.lo + (uMeas - sg.lo) / (sg.hi - sg.lo) * span;
    if (rb <= 0 && sg.kind === 'current') shown = p.lo;
    const valueTrue = num(p.value, 0), errAbs = shown - valueTrue;
    let wbDet = false;
    if (sg.id === '4-20') wbDet = iLoop < 3.6; else if (sg.id === '1-5') wbDet = uBurden < 0.8;
    const under = frac < 0, over = frac > 1;
    if (p.wireBreak) faults.push('drahtbruch'); if (sat) faults.push('buerde_zu_gross'); if (smp.clipped === 'high') faults.push('adu_uebersteuert');
    if (Math.abs(noiseV) > 0.05 * (sg.kind === 'voltage' ? sg.hi : 1)) faults.push('stoerung'); if (over || under) faults.push(over ? 'uebersteuerung' : 'unterbereich');
    return { signal: sg.id, signalName: sg.name, unit: sg.unit, frac: frac, iSet: iSet, iLoop: iLoop, uSig: uSig, uBurden: uBurden, uAdc: uAdc, code: code, lsb: adcObj.lsb, att: att, shown: shown, valueTrue: valueTrue,
      error: errAbs / span * 100, errorAbs: errAbs, headroom: headroom, headroomActual: headroomActual, iMaxCompl: iMaxCompl, rBurdenMax: rBurdenMax, saturated: sat,
      wireBreak: !!p.wireBreak, wireBreakDetected: wbDet, ambiguousZero: !sg.liveZero, underrange: under, overrange: over, adcClipped: smp.clipped, noise: noise,
      pBurden: iLoop * iLoop * 1e-6 * rb, uTx: uTx, faults: faults };
  };
  circuits.loop420 = function (params) { return circuits.normChain(Object.assign({}, obj(params), { signal: '4-20' })); };

  /* =====================================================================================================
   * ADU, DFT, ALIAS
   * ===================================================================================================== */
  function adc(bits, vref, opts) {
    const n = clamp(Math.floor(num(bits, 10)), 1, 24), vr = pos(vref, 3.3), o = mixParams({ mode: 'floor', offsetLsb: 0, gainErr: 0, noiseLsb: 0, seed: 1 }, opts);
    const levels = Math.pow(2, n), lsb = vr / levels, rng = makeRng(o.seed);
    const a = {
      bits: n, vref: vr, levels: levels, lsb: lsb, opts: o,
      convert(u) { return a.sample(u).code; },
      sample(u) {
        u = num(u, 0);
        let v = (u + o.offsetLsb * lsb) * (1 + o.gainErr) + (o.noiseLsb > 0 ? rng.gauss() * o.noiseLsb * lsb : 0);
        let c = o.mode === 'round' ? Math.round(v / lsb) : Math.floor(v / lsb), clipped = null;
        if (c < 0) { c = 0; clipped = 'low'; } else if (c > levels - 1) { c = levels - 1; clipped = 'high'; }
        const uq = c * lsb, um = (c + 0.5) * lsb;
        return { code: c, uIn: u, uQuant: uq, uMid: um, err: um - u, errFloor: uq - u, lsb: lsb, frac: clamp(u / vr, 0, 1), clipped: clipped, levels: levels, bits: n, vref: vr };
      },
      toVoltage(code, mid) { return (clamp(num(code, 0), 0, levels - 1) + (mid ? 0.5 : 0)) * lsb; },
      quantErr(u) { return a.sample(u).err; },
      snr() { return 6.02 * n + 1.76; },
      staircase(k) { k = clamp(Math.floor(num(k, 200)), 2, 5000); const pts = []; for (let i = 0; i < k; i++) { const u = vr * 1.1 * i / (k - 1); pts.push([u, a.sample(u).code]); } return pts; }
    };
    return a;
  }

  function dft(samples, opts) {
    const o = mixParams({ fs: 1, window: 'rect' }, opts), x = Array.isArray(samples) ? samples.slice(0, 2048).map(v => num(v, 0)) : [], N = x.length;
    if (N === 0) return { n: 0, fs: o.fs, df: 0, freq: [], amp: [], phase: [], re: [], im: [], peak: { k: 0, f: 0, amp: 0 }, dc: 0 };
    const w = x.map((_, i) => o.window === 'hann' ? 0.5 - 0.5 * Math.cos(TWO_PI * i / N) : 1), cg = w.reduce((s, v) => s + v, 0) / N || 1;
    const xs = x.map((v, i) => v * w[i]), cs = new Array(N), sn = new Array(N);
    for (let i = 0; i < N; i++) { cs[i] = Math.cos(TWO_PI * i / N); sn[i] = Math.sin(TWO_PI * i / N); }
    const h = Math.floor(N / 2), re = [], im = [], amp = [], ph = [], fr = [];
    for (let k = 0; k <= h; k++) {
      let sr = 0, si = 0;
      for (let i = 0; i < N; i++) { const idx = (k * i) % N; sr += xs[i] * cs[idx]; si -= xs[i] * sn[idx]; }
      re.push(sr); im.push(si);
      const edge = (k === 0 || (N % 2 === 0 && k === h));
      amp.push(Math.hypot(sr, si) * (edge ? 1 : 2) / N / cg); ph.push(Math.atan2(si, sr)); fr.push(k * o.fs / N);
    }
    let pk = 1; for (let k = 1; k <= h; k++) if (amp[k] > amp[pk] || pk > h) pk = k;
    if (h < 1) pk = 0;
    return { n: N, fs: o.fs, df: o.fs / N, freq: fr, amp: amp, phase: ph, re: re, im: im, peak: { k: pk, f: fr[pk], amp: amp[pk] }, dc: amp[0] };
  }

  function alias(fSig, fs) {
    const f = Math.abs(num(fSig, 0)), s = num(fs, 0), fsp = s > 0 ? s : 0;
    if (fsp === 0) return { fAlias: 0, aliased: false, borderline: false, nyquist: 0, order: 0, minFs: 2 * f, fSig: f, fs: 0 };
    const k = Math.round(f / fsp), fa = Math.abs(f - k * fsp);
    return { fAlias: fa, aliased: f > fsp / 2 + 1e-9, borderline: Math.abs(f - fsp / 2) < 1e-9, nyquist: fsp / 2, order: k, minFs: 2 * f, fSig: f, fs: fsp };
  }

  function waveValue(kind, f, amp, offset, t) {
    f = num(f, 0); amp = num(amp, 0); offset = num(offset, 0); t = num(t, 0);
    const ph = (f * t) % 1, x = ph < 0 ? ph + 1 : ph; kind = String(kind || 'sin');
    if (kind === 'dc') return offset;
    if (kind === 'tri') return offset + amp * (x < 0.25 ? 4 * x : x < 0.75 ? 2 - 4 * x : 4 * x - 4);
    if (kind === 'square') return offset + (x < 0.5 ? amp : -amp);
    return offset + amp * Math.sin(TWO_PI * f * t);
  }

  function adcCapture(params) {
    const p = mixParams({ wave: 'sin', fSig: 100, amp: 1, offset: 1.65, noise: 0, bits: 10, vref: 3.3, fs: 1000, n: 256, aaf: null, seed: 1, window: 'rect', mode: 'floor' }, params);
    const n = clamp(Math.floor(p.n), 4, 1024), fs = pos(p.fs, 1000), fSig = Math.max(0, p.fSig), rng = makeRng(p.seed), conv = adc(p.bits, p.vref, { mode: p.mode });
    let order = 0, fcA = 0;
    if (p.aaf && typeof p.aaf === 'object') { order = clamp(Math.floor(num(p.aaf.order, 1)), 0, 4); fcA = Math.max(0, num(p.aaf.fc, 0)); }
    else if (num(p.aaf, 0) > 0) { order = 1; fcA = num(p.aaf, 0); }
    if (!(fcA > 0)) order = 0;
    const over = clamp(Math.ceil(Math.max(16, 20 * fSig / fs, 8 * (fcA / fs))), 1, 128), fine = fs * over, dtF = 1 / fine, steps = n * over;
    const tauA = fcA > 0 ? 1 / (TWO_PI * fcA) : 0, kA = tauA > 0 ? 1 - Math.exp(-dtF / tauA) : 1, ys = new Array(Math.max(1, order)).fill(0);
    const noiseF = p.noise > 0 ? new Array(steps).fill(0).map(() => rng.gauss() * p.noise) : null;
    let pre = order > 0 ? Math.min(20000, Math.ceil(6 * tauA * fine)) : 0, init = false;
    const t = [], vinRaw = [], vin = [], codes = [], vq = [], err = [], ref = { t: [], v: [] }, dec = Math.max(1, Math.floor(steps / 1024));
    function advance(tt, nz) { const x = waveValue(p.wave, fSig, p.amp, p.offset, tt) + nz; if (order === 0) return x; if (!init) { for (let i = 0; i < order; i++) ys[i] = x; init = true; } let z = x; for (let i = 0; i < order; i++) { ys[i] += (z - ys[i]) * kA; z = ys[i]; } return z; }
    for (let i = -pre; i < 0; i++) advance(i * dtF, 0);
    let clipped = 0;
    for (let i = 0; i < steps; i++) {
      const tt = i * dtF, nz = noiseF ? noiseF[i] : 0, y = advance(tt, nz);
      if (i % dec === 0) { ref.t.push(tt); ref.v.push(y); }
      if (i % over === 0) {
        const raw = waveValue(p.wave, fSig, p.amp, p.offset, tt) + nz, smp = conv.sample(y);
        t.push(tt); vinRaw.push(raw); vin.push(y); codes.push(smp.code); vq.push(smp.uMid); err.push(smp.uMid - y); if (smp.clipped) clipped++;
      }
    }
    const mean = vq.reduce((s, v) => s + v, 0) / vq.length, sigRms = Math.sqrt(vin.reduce((s, v) => s + Math.pow(v - vin.reduce((a, b) => a + b, 0) / vin.length, 2), 0) / vin.length);
    const errRms = Math.sqrt(err.reduce((s, v) => s + v * v, 0) / err.length), snrM = errRms > 0 && sigRms > 0 ? 20 * Math.log10(sigRms / errRms) : Infinity;
    const spectrum = dft(vq, { fs: fs, window: p.window }), al = alias(fSig, fs);
    let att = 1; if (fcA > 0) att = Math.pow(1 / Math.sqrt(1 + Math.pow(fSig / fcA, 2)), order);
    return { t: t, vinRaw: vinRaw, vin: vin, codes: codes, vq: vq, err: err, errRms: errRms, snrMeas: snrM, snrTheory: 6.02 * conv.bits + 1.76, enobMeas: isFinite(snrM) ? (snrM - 1.76) / 6.02 : conv.bits, lsb: conv.lsb,
      fs: fs, nyquist: fs / 2, alias: al, spectrum: spectrum, dominantF: spectrum.peak.f, aaf: { order: order, fc: fcA, attenuation: att }, clipped: clipped, ref: ref, mean: mean, sigRms: sigRms };
  }

  /* =====================================================================================================
   * I2C
   * ===================================================================================================== */
  const i2c = {};
  function crc8(bytes, poly, init) {
    let c = Math.floor(num(init, 0xFF)) & 255; const pl = Math.floor(num(poly, 0x31)) & 255;
    const arr = typeof bytes === 'number' ? [bytes] : (Array.isArray(bytes) ? bytes : []);
    for (const b0 of arr) { c ^= (Math.floor(num(b0, 0)) & 255); for (let i = 0; i < 8; i++) c = (c & 0x80) ? (((c << 1) ^ pl) & 255) : ((c << 1) & 255); }
    return c;
  }
  i2c.crc8 = crc8;
  i2c.checkCrc = (bytes, crc) => crc8(bytes, 0x31, 0xFF) === (Math.floor(num(crc, -1)) & 255) && num(crc, -1) >= 0;

  function normRw(x) {
    if (typeof x === 'string') { const s = x.trim().toLowerCase(); return (s === 'r' || s === 'read' || s === 'lesen' || s === '1') ? 'R' : 'W'; }
    return (x === 1 || x === true) ? 'R' : 'W';
  }
  function bytesOf(b) {
    if (typeof b === 'number') b = [b]; if (!Array.isArray(b)) return [];
    return b.slice(0, 64).map(v => ((Math.floor(num(v, 0)) % 256) + 256) % 256);
  }
  function bitsOf(v, n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push((v >> i) & 1); return a; }
  function transaction(addr, steps, opts) {
    const o = obj(opts), a7 = ((Math.floor(num(addr, 0)) % 128) + 128) % 128, present = o.present !== false, events = [], slots = [], all = [], conflictBytes = bytesOf(o.conflictBytes);
    let aborted = false, nackAt = null, gi = 0, txt = [];
    const stepList = Array.isArray(steps) && steps.length ? steps : [{ rw: 'W', bytes: [] }];
    function ev(e) { events.push(e); return events.length - 1; }
    function bitSlots(bits, field) { bits.forEach(b => slots.push({ kind: 'bit', value: b, field: field })); }
    for (let si = 0; si < stepList.length && !aborted; si++) {
      const st = obj(stepList[si]), rw = normRw(st.rw), bytes = bytesOf(st.bytes);
      ev({ type: si === 0 ? 'start' : 'rstart' }); slots.push({ kind: 'start', field: events.length - 1 }); txt.push(si === 0 ? 'S' : 'Sr');
      const bA = bitsOf(a7, 7), fA = ev({ type: 'addr', value: a7, byte: (a7 << 1) | (rw === 'R' ? 1 : 0), bits: bA }); bitSlots(bA, fA); txt.push(hex2(a7));
      const fR = ev({ type: 'rw', value: rw }); slots.push({ kind: 'bit', value: rw === 'R' ? 1 : 0, field: fR }); txt.push(rw);
      const ackA = present && !o.addrNack, fK = ev({ type: 'ack', ack: ackA, by: 'slave', for: 'addr' }); slots.push({ kind: 'bit', value: ackA ? 0 : 1, field: fK }); txt.push(ackA ? 'A' : 'N');
      if (!ackA) { aborted = true; nackAt = 'addr'; break; }
      for (let i = 0; i < bytes.length; i++) {
        let v = bytes[i]; if (rw === 'R' && i < conflictBytes.length) v &= conflictBytes[i];
        const bd = bitsOf(v, 8), fD = ev({ type: 'data', value: v, index: all.length, dir: rw, bits: bd }); bitSlots(bd, fD); all.push(v); txt.push(hex2(v));
        let ack;
        if (rw === 'W') ack = !(o.nackAt !== undefined && Math.floor(num(o.nackAt, -1)) === gi); else ack = i < bytes.length - 1;
        const fk = ev({ type: 'ack', ack: ack, by: rw === 'W' ? 'slave' : 'master', for: 'data' }); slots.push({ kind: 'bit', value: ack ? 0 : 1, field: fk }); txt.push(ack ? 'A' : 'N');
        gi++;
        if (rw === 'W' && !ack) { aborted = true; nackAt = gi - 1; break; }
      }
    }
    ev({ type: 'stop' }); slots.push({ kind: 'stop', field: events.length - 1 }); txt.push('P');
    const stretch = Math.max(0, num(o.stretchUs, 0));
    return { addr: a7, steps: stepList, events: events, slots: slots, bytes: all, ok: !aborted, nack: aborted, nackAt: nackAt, text: txt.join(' '), nBits: slots.length, stretchUs: stretch,
      durationUs: kHz => slots.length * 1000 / pos(kHz, 100) + stretch };
  }
  i2c.transaction = transaction;
  i2c.frame = (addr, rw, bytes, opts) => transaction(addr, [{ rw: rw, bytes: bytes }], opts);

  const SPEEDS = {
    100: { name: 'Standard', trMax: 1000e-9, cbMax: 400e-12, tHighMin: 4.0e-6 },
    400: { name: 'Fast', trMax: 300e-9, cbMax: 400e-12, tHighMin: 0.6e-6 },
    1000: { name: 'Fast-Plus', trMax: 120e-9, cbMax: 550e-12, tHighMin: 0.26e-6 }
  };
  function speedOf(kHz) { return kHz <= 150 ? SPEEDS[100] : kHz <= 600 ? SPEEDS[400] : SPEEDS[1000]; }
  i2c.busCap = (lengthM, nDevices, o) => { o = obj(o); return (Math.max(0, num(lengthM, 0.2)) * pos(o.pfPerM, 60) + Math.max(0, num(nDevices, 2)) * pos(o.pinPf, 10) + pos(o.basePf, 10)); };
  i2c.edge = function (rOhm, cPf, vcc, tUs) {
    const R = pos(rOhm, 4700), C = pos(cPf, 100) * 1e-12, V = pos(vcc, 3.3), tau = R * C, t = Math.max(0, num(tUs, 0)) * 1e-6;
    return { tau: tau, v: V * (1 - Math.exp(-t / tau)), tr: 0.8473 * tau, tr10_90: 2.1972 * tau, t70: -tau * Math.log(0.3), t30: -tau * Math.log(0.7) };
  };
  i2c.bus = function (params) {
    const p = mixParams({ pullup: 4700, cbusPf: 100, kHz: 100, vcc: 3.3, ronOhm: 100 }, params);
    const R = pos(p.pullup, 4700), C = pos(p.cbusPf, 100) * 1e-12, V = pos(p.vcc, 3.3), kHz = pos(p.kHz, 100), sp = speedOf(kHz), tau = R * C, tr = 0.8473 * tau, T = 1 / (kHz * 1000);
    const vol = V * p.ronOhm / (p.ronOhm + R), rMax = sp.trMax / (0.8473 * C), rMin = (V - 0.4) / 0.003, t70 = -tau * Math.log(0.3);
    const lim2 = (T / 4) * 0.8473 / 1.2040;
    let er = clamp((tr - sp.trMax) / Math.max(lim2 - sp.trMax, 1e-12), 0, 1); const hints = [];
    if (vol > 0.3 * V) er = 1; else if (vol > 0.4) er = Math.max(er, 0.1);
    if (tr > sp.trMax) hints.push('Anstiegszeit zu lang (' + (tr * 1e9).toFixed(0) + ' ns, erlaubt ' + (sp.trMax * 1e9).toFixed(0) + ' ns): Pull-up kleiner wählen oder Leitung kürzen.');
    if (R < rMin) hints.push('Pull-up zu klein: Low-Pegel wird nicht mehr sicher erreicht, Ausgangsstrom zu hoch (' + ((V - 0.4) / R * 1000).toFixed(1) + ' mA).');
    if (vol > 0.3 * V) hints.push('Low-Pegel nicht erkannt.');
    if (C > sp.cbMax) hints.push('Buskapazität größer als erlaubt (' + (sp.cbMax * 1e12).toFixed(0) + ' pF).');
    if (er >= 1) hints.push('SCL erreicht den High-Pegel nicht rechtzeitig: Datenfehler.');
    return { tau: tau, tr: tr, tr10_90: 2.1972 * tau, trMax: sp.trMax, t70: t70, rMax: rMax, rMin: rMin, vol: vol, errorRate: er, tHighUs: T / 2 * 1e6, bitUs: T * 1e6, mode: sp.name, cbMax: sp.cbMax,
      ok: tr <= sp.trMax && R >= rMin && vol <= 0.3 * V && C <= sp.cbMax, hints: hints };
  };
  function segBuild(evs, vcc, R, C, ron, tauMin) {
    const vLow = vcc * ron / (ron + R), tauR = Math.max(tauMin, R * C * 1e6), tauF = Math.max(tauMin, (ron * R / (ron + R)) * C * 1e6);
    const segs = [{ t0: -1e30, v0: vcc, tgt: vcc, tau: tauR }];
    function vAt(t, s) { return s.tgt + (s.v0 - s.tgt) * Math.exp(-(t - Math.max(s.t0, -1e12)) / s.tau); }
    evs.sort((a, b) => a.t - b.t);
    for (const e of evs) {
      const s = segs[segs.length - 1], vNow = s.t0 < -1e29 ? s.v0 : vAt(e.t, s);
      segs.push({ t0: e.t, v0: vNow, tgt: e.drive === 0 ? vLow : vcc, tau: e.drive === 0 ? tauF : tauR });
    }
    let ptr = 0;
    return { segs: segs, at(t) { if (ptr > 0 && t < segs[ptr].t0) ptr = 0; while (ptr + 1 < segs.length && segs[ptr + 1].t0 <= t) ptr++; const s = segs[ptr]; return s.t0 < -1e29 ? s.v0 : vAt(t, s); }, reset() { ptr = 0; } };
  }
  i2c.waveform = function (frame, params) {
    const p = mixParams({ pullup: 4700, cbusPf: 100, vcc: 3.3, kHz: 100, ronOhm: 100, stretchUs: 0, pts: 32 }, params);
    const fr = obj(frame), slots = Array.isArray(fr.slots) ? fr.slots : [], R = pos(p.pullup, 4700), C = pos(p.cbusPf, 100) * 1e-12, V = pos(p.vcc, 3.3), kHz = pos(p.kHz, 100), T = 1000 / kHz;
    const stretch = Math.max(0, num(p.stretchUs, num(fr.stretchUs, 0))), pts = clamp(Math.floor(p.pts), 8, 128);
    const sclE = [], sdaE = [], times = [], sampleAt = [];
    let t = T; // Leerlaufphase davor
    const stretchSlot = stretch > 0 ? slots.findIndex((s, i) => s.kind === 'bit' && i > 9) : -1;
    slots.forEach((s, i) => {
      const st = i === stretchSlot ? stretch : 0, t0 = t, dur = T + st; s.tStart = t0; s.tEnd = t0 + dur;
      if (s.kind === 'bit') {
        sdaE.push({ t: t0 + T / 8, drive: s.value ? 1 : 0 }); sclE.push({ t: t0 + T / 4 + st, drive: 1 }); sclE.push({ t: t0 + 3 * T / 4 + st, drive: 0 });
        sampleAt.push({ i: i, t: t0 + T / 2 + st, value: s.value });
      } else if (s.kind === 'start') {
        sdaE.push({ t: t0 + T / 8, drive: 1 }); sclE.push({ t: t0 + T / 4, drive: 1 }); sdaE.push({ t: t0 + T / 2, drive: 0 }); sclE.push({ t: t0 + 3 * T / 4, drive: 0 });
      } else { // stop
        sdaE.push({ t: t0 + T / 8, drive: 0 }); sclE.push({ t: t0 + T / 4, drive: 1 }); sdaE.push({ t: t0 + T / 2, drive: 1 });
      }
      t += dur;
    });
    const total = t + T, A = segBuild(sclE, V, R, C, p.ronOhm, 1e-4), B = segBuild(sdaE, V, R, C, p.ronOhm, 1e-4);
    const dt = T / pts, n = Math.ceil(total / dt) + 1, tt = new Array(n), scl = new Array(n), sda = new Array(n), sclD = new Array(n), sdaD = new Array(n);
    let ds = 1, dd = 1;
    for (let k = 0; k < n; k++) {
      const x = k * dt, a = A.at(x), b = B.at(x); tt[k] = x; scl[k] = a; sda[k] = b;
      if (ds && a < 0.3 * V) ds = 0; else if (!ds && a > 0.7 * V) ds = 1; if (dd && b < 0.3 * V) dd = 0; else if (!dd && b > 0.7 * V) dd = 1;
      sclD[k] = ds; sdaD[k] = dd;
    }
    A.reset(); B.reset();
    const bad = []; let sclFail = 0;
    sampleAt.forEach(sp => {
      const vs = A.at(sp.t), vd = B.at(sp.t), okS = vs >= 0.7 * V, okD = sp.value ? vd >= 0.7 * V : vd <= 0.3 * V;
      if (!okS) sclFail++; if (!okS || !okD) bad.push(sp.i);
    });
    const bus = i2c.bus({ pullup: R, cbusPf: C * 1e12, kHz: kHz, vcc: V, ronOhm: p.ronOhm });
    const marks = (Array.isArray(fr.events) ? fr.events : []).map((e, idx) => {
      const own = slots.filter(s => s.field === idx);
      const label = e.type === 'start' ? 'S' : e.type === 'rstart' ? 'Sr' : e.type === 'stop' ? 'P' : e.type === 'addr' ? 'Adr 0x' + hex2(e.value) : e.type === 'rw' ? e.value : e.type === 'ack' ? (e.ack ? 'ACK' : 'NACK') : '0x' + hex2(e.value);
      return { type: e.type, text: label, value: e.value, ack: e.ack, t0: own.length ? own[0].tStart : 0, t1: own.length ? own[own.length - 1].tEnd : 0 };
    });
    const nBits = sampleAt.length, er = nBits ? bad.length / nBits : 0;
    return { t: tt, scl: scl, sda: sda, sclD: sclD, sdaD: sdaD, T: T, vcc: V, duration: total, marks: marks, sampleTimes: sampleAt.map(s => s.t),
      analysis: { tau: bus.tau, tr: bus.tr, tr10_90: bus.tr10_90, trMax: bus.trMax, vol: bus.vol, volOk: bus.vol <= 0.3 * V, sclHighOk: sclFail === 0, badBits: bad, errorRate: er, errorRateModel: bus.errorRate,
        hints: bus.hints, ok: bad.length === 0 && bus.ok, busOk: bus.ok } };
  };
  i2c.decode = function (trace, params) {
    const tr = obj(trace), o = obj(params), sclIn = Array.isArray(tr.scl) ? tr.scl : [], sdaIn = Array.isArray(tr.sda) ? tr.sda : [], n = Math.min(sclIn.length, sdaIn.length), errors = [];
    let vmax = 0; for (let i = 0; i < n; i++) { vmax = Math.max(vmax, num(sclIn[i], 0), num(sdaIn[i], 0)); }
    const V = pos(first(o.vcc, tr.vcc), vmax > 1.5 ? vmax : 1);
    function dig(a) { const d = new Array(n); let s = n > 0 && num(a[0], 1) >= 0.5 * V ? 1 : 0; for (let i = 0; i < n; i++) { const v = num(a[i], 0); if (s && v < 0.3 * V) s = 0; else if (!s && v > 0.7 * V) s = 1; d[i] = s; } return d; }
    const c = dig(sclIn), d = dig(sdaIn), groups = []; let cur = null, complete = false, stopSeen = false, startSeen = false;
    for (let i = 1; i < n; i++) {
      if (c[i] && c[i - 1]) {
        if (d[i - 1] && !d[i]) { if (cur) { cur.bits.pop(); cur.rep = true; groups.push(cur); } cur = { bits: [], rep: false, start: startSeen ? 'rstart' : 'start' }; startSeen = true; stopSeen = false; }
        else if (!d[i - 1] && d[i]) { if (cur) { cur.bits.pop(); groups.push(cur); cur = null; stopSeen = true; } }
      }
      if (!c[i - 1] && c[i] && cur) cur.bits.push(d[i]);
    }
    if (cur) groups.push(cur);
    const events = [], bytes = [], acks = [], txt = []; let addr = null, rw = null, addrAck = null, nack = false, firstStart = true;
    groups.forEach((g, gi) => {
      events.push({ type: gi === 0 ? 'start' : 'rstart' }); txt.push(gi === 0 ? 'S' : 'Sr');
      const nb = Math.floor(g.bits.length / 9);
      if (g.bits.length % 9 !== 0) errors.push('unvollständiges Byte nach ' + g.bits.length + ' Taktflanken');
      for (let b = 0; b < nb; b++) {
        let v = 0; for (let k = 0; k < 8; k++) v = (v << 1) | g.bits[b * 9 + k]; const ack = g.bits[b * 9 + 8] === 0;
        if (b === 0) {
          const a7 = v >> 1, r = (v & 1) ? 'R' : 'W'; if (gi === 0) { addr = a7; rw = r; addrAck = ack; }
          events.push({ type: 'addr', value: a7, byte: v }); events.push({ type: 'rw', value: r }); events.push({ type: 'ack', ack: ack, for: 'addr' }); txt.push(hex2(a7), r, ack ? 'A' : 'N'); if (!ack) nack = true;
        } else {
          bytes.push(v); acks.push(ack); events.push({ type: 'data', value: v }); events.push({ type: 'ack', ack: ack, for: 'data' }); txt.push(hex2(v), ack ? 'A' : 'N');
          if (!ack && !(groups[gi].readLast)) { if (rw === 'W') nack = true; }
        }
      }
    });
    if (stopSeen) { events.push({ type: 'stop' }); txt.push('P'); } else if (groups.length) errors.push('kein Stopp erkannt');
    complete = startSeen && stopSeen && errors.length === 0;
    if (!groups.length) errors.push('keine Startbedingung erkannt');
    return { events: events, addr: addr, rw: rw, bytes: bytes, acks: acks, addrAck: addrAck, nack: nack, complete: complete, startSeen: startSeen, stopSeen: stopSeen, text: txt.join(' '), errors: errors };
  };
  i2c.devices = {
    sht3x: { name: 'SHT3x (Temperatur/Feuchte)', addr: 0x44, alt: [0x45] }, aht10: { name: 'AHT10/20', addr: 0x38, alt: [] }, adxl345: { name: 'ADXL345 (Beschleunigung)', addr: 0x53, alt: [0x1D] },
    vl53l0x: { name: 'VL53L0X (ToF)', addr: 0x29, alt: [] }, bmp280: { name: 'BMP280 (Druck)', addr: 0x76, alt: [0x77] }, mpu6050: { name: 'MPU-6050', addr: 0x68, alt: [0x69] },
    pcf8574: { name: 'PCF8574 (Portexpander)', addr: 0x20, alt: [0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27] }, lm75: { name: 'LM75 (Temperatur)', addr: 0x48, alt: [0x49, 0x4A, 0x4B] }
  };
  i2c.addrConflict = function (list) {
    const map = {}, arr = Array.isArray(list) ? list : [];
    arr.forEach((d, i) => { d = obj(d); const a = Math.floor(num(d.addr, -1)) & 0x7F; if (num(d.addr, -1) < 0) return; (map[a] = map[a] || []).push(String(d.name !== undefined ? d.name : 'Gerät ' + (i + 1))); });
    const conflicts = Object.keys(map).filter(k => map[k].length > 1).map(k => ({ addr: +k, names: map[k] })), free = [];
    for (let a = 0x08; a <= 0x77 && free.length < 8; a++) if (!map[a]) free.push(a);
    return { ok: conflicts.length === 0, conflicts: conflicts, free: free, used: Object.keys(map).map(Number) };
  };
  i2c.scan = function (devices, opts) {
    const o = obj(opts), arr = Array.isArray(devices) ? devices : [], found = [];
    for (let a = 0x08; a <= 0x77; a++) { const hit = arr.filter(d => obj(d).addr === a && obj(d).present !== false); if (hit.length) found.push({ addr: a, count: hit.length, ack: !o.busFault }); }
    return found;
  };
  i2c.sht3x = {
    addr: 0x44, cmd: { singleHighClk: [0x2C, 0x06], singleHighNoClk: [0x24, 0x00], reset: [0x30, 0xA2] },
    encode(T, rh) {
      const rawT = clamp(Math.round((num(T, 25) + 45) / 175 * 65535), 0, 65535), rawRH = clamp(Math.round(num(rh, 50) / 100 * 65535), 0, 65535);
      const bt = [rawT >> 8, rawT & 255], br = [rawRH >> 8, rawRH & 255];
      return { rawT: rawT, rawRH: rawRH, bytes: [bt[0], bt[1], crc8(bt), br[0], br[1], crc8(br)], crcT: crc8(bt), crcRH: crc8(br) };
    },
    decode(bytes) {
      const b = bytesOf(bytes); while (b.length < 6) b.push(0);
      const rawT = (b[0] << 8) | b[1], rawRH = (b[3] << 8) | b[4], c1 = crc8([b[0], b[1]]) === b[2], c2 = crc8([b[3], b[4]]) === b[5];
      return { T: F.shtTemperature(rawT), rh: F.shtHumidity(rawRH), rawT: rawT, rawRH: rawRH, crcOkT: c1, crcOkRH: c2, ok: c1 && c2 };
    },
    read(T, rh, opts) { const e = i2c.sht3x.encode(T, rh), o = obj(opts); return transaction(num(o.addr, 0x44), [{ rw: 'W', bytes: i2c.sht3x.cmd.singleHighClk }, { rw: 'R', bytes: e.bytes }], o); }
  };
  i2c.adxl345 = {
    addr: 0x53, regs: { DEVID: 0x00, BW_RATE: 0x2C, POWER_CTL: 0x2D, DATA_FORMAT: 0x31, DATAX0: 0x32, DATAX1: 0x33, DATAY0: 0x34, DATAY1: 0x35, DATAZ0: 0x36, DATAZ1: 0x37 }, devId: 0xE5,
    bwRate: rate => { const r = pos(rate, 100); return clamp(Math.round(15 - Math.log(3200 / r) / Math.LN2), 6, 15); },
    dataFormat: (range, full) => ({ 2: 0, 4: 1, 8: 2, 16: 3 }[range] || 0) | (full ? 8 : 0),
    encode(g, range, res) {
      const s = mems({ range: range, res: res }), lsb = s.lsb(), nm = Math.pow(2, s.bits - 1), a = Array.isArray(g) ? g : [0, 0, 1], out = [];
      for (let i = 0; i < 3; i++) { const v = clamp(Math.round(num(a[i], 0) / lsb), -nm, nm - 1), u = v & 0xFFFF; out.push(u & 255, (u >> 8) & 255); }
      return out;
    },
    decode(bytes, range, res) {
      const b = bytesOf(bytes); while (b.length < 6) b.push(0);
      const s = mems({ range: range, res: res }), lsb = s.lsb(), raw = [];
      for (let i = 0; i < 3; i++) { let v = b[2 * i] | (b[2 * i + 1] << 8); if (v & 0x8000) v -= 0x10000; raw.push(v); }
      const g = raw.map(v => v * lsb);
      return { raw: raw, g: g, lsb: lsb, pitch: F.tiltPitch(g[0], g[1], g[2]), roll: F.tiltRoll(g[1], g[2]) };
    },
    read(g, range, res, opts) { const o = obj(opts); return transaction(num(o.addr, 0x53), [{ rw: 'W', bytes: [0x32] }, { rw: 'R', bytes: i2c.adxl345.encode(g, range, res) }], o); }
  };
  i2c.aht = {
    addr: 0x38,
    decode(bytes) { const b = bytesOf(bytes); while (b.length < 6) b.push(0); const rh = ((b[1] << 12) | (b[2] << 4) | (b[3] >> 4)), t = (((b[3] & 15) << 16) | (b[4] << 8) | b[5]); return { rh: rh / 1048576 * 100, T: t / 1048576 * 200 - 50, rawRH: rh, rawT: t, busy: !!(b[0] & 0x80) }; },
    encode(T, rh) { const r = clamp(Math.round(num(rh, 50) / 100 * 1048576), 0, 1048575), t = clamp(Math.round((num(T, 25) + 50) / 200 * 1048576), 0, 1048575); return [0x1C, r >> 12, (r >> 4) & 255, ((r & 15) << 4) | (t >> 16), (t >> 8) & 255, t & 255]; }
  };
  i2c.vl53 = {
    addr: 0x29, resultReg: 0x1E,
    decodeRange(bytes) { const b = bytesOf(bytes); while (b.length < 2) b.push(0); return (b[0] << 8) | b[1]; },
    encodeRange(mm) { const v = clamp(Math.round(num(mm, 0)), 0, 65535); return [v >> 8, v & 255]; }
  };

  /* =====================================================================================================
   * ABLAUFPROGRAMM-LAEUFER
   * ===================================================================================================== */
  function runSeq(rigFactory, seq, tEndMs, opts) {
    opts = opts && typeof opts === 'object' ? opts : {};
    const out = { samples: [], final: null, events: [], faults: [], peaks: {}, errors: [] };
    let rig = null;
    try {
      if (typeof rigFactory === 'function') rig = rigFactory();
      else if (typeof rigFactory === 'string') {
        const Rg = root.SEN_RIGS;
        if (Rg && Rg.create) rig = Rg.create(rigFactory, opts.rigOpts); else out.errors.push('SEN_RIGS nicht geladen');
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
    function collect(st) { if (st && Array.isArray(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } }); }
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
    presets: presets,
    sensors: sensors,
    circuits: circuits,
    adc: adc, adcCapture: adcCapture, dft: dft, alias: alias, waveValue: waveValue,
    i2c: i2c,
    formulas: F,
    gasTable: GAS_TABLE, inductiveFactors: INDUCTIVE_FACTORS, capacitiveFactors: CAPACITIVE_FACTORS, media: MEDIA,
    runSeq: runSeq
  };
  root.SEN_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
