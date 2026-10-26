/* regrig-drehz.js - Regelungstechnik-Lab, Pruefstand drehzahl (Drehzahlregelung: Gleichstrommotor mit Steller und Tachogenerator) (WP2c).
 * Erzeugt aus quelle/reglab/ (Anlagenteil, node quelle/reglab/build_regrig_c.js); nicht von Hand aendern. Die gemeinsame Basis steht in regrig-c-base.js
 * (REG_RIGS.cbase): im Browser NACH regrig-c-base.js laden, in Node holt sich die Datei sie per require.
 * Abhaengigkeit: REG_CORE (regcore.js: controller, rng, oscillation, TEXTS; freq/margins/identify nur fuer analysis und Diagnose).
 * Einheiten: Regler in Prozent des Messbereichs, Anzeige und Steuerwerte physikalisch, Zeiten in Prozess-Sekunden (timeScale 1).
 * Deterministisch (Rauschen nur ueber REG_CORE.rng, Seed 1); step, stepProcess und setControl werfen nie. Mit Node ladbar (module.exports = REG_RIGS).
 */
(function (root) {
  'use strict';
  const R = root.REG_RIGS = root.REG_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.cbase && typeof require === 'function') { try { require('./regrig-c-base.js'); } catch (e) { /* Basis fehlt */ } }
  if (!R.cbase) { if (typeof console !== 'undefined') console.warn('regrig-drehz.js: regrig-c-base.js (REG_RIGS.cbase) fehlt (bitte davor laden), der Prüfstand wird nicht registriert.'); return; }
  const {
    WW, FONT, MONO, C, TWO_PI, DIAG_EVERY, TR_CAP, DIAG_ORDER, ALL_CTRL, OSC_CLS, clamp, lerp, fin, fm, fmT, hasI, hasD, core, sel, sld, oscLocal,
    oscClassify, rr, txt, dial, sparks, simLin, DIAG_FALLBACK, tx, fitOf, buildRig, WH
  } = R.cbase;


  // ===== Pruefstand 5: drehzahl - Drehzahlregelung (Gleichstrommotor mit Steller und Tachogenerator) =====
  // Nur Regelstrecke (SPEC 1.2): keine H-Bruecke, keine Typenschildrechnung. Alle Werte sind Entwurfswerte einer Uebungsanlage (A8).
  //   Steller      PT1 Tact = 20 ms, U_a = 24 V * y_a / 100 (nur positive Spannung, Drehzahl n >= 0)
  //   Motor        L dI/dt = U_a - R I - Ke w ;  J dw/dt = Kt I - M_L ;  RK4 mit h = 1 ms
  //   Last         M_L = z/100 * Mmax (Lastbremse), Stromgrenze |I| <= Imax (harte Klemmung des Stromzustands), Drehzahl w >= 0
  //   Messglied    Tachogenerator PT1 Ts = 10 ms (im Block: sensorTau), Rauschen in % des Bereichs
  //   Bereich      n = 0 ... 3000 1/min (x = n / 30 in Prozent)
  // Abweichung von SPEC 4.7.5 (steht in ABWEICHUNGEN.md): Die Stromgrenze gilt in beiden Richtungen (-Imax ... +Imax, Bremsen durch negativen Strom).
  // Mit I >= 0 haette die reibungsfreie Anlage keine Moeglichkeit zu bremsen: Ein Ueberschwingen bliebe stehen, die bleibende Abweichung
  // haenge vom Weg ab und eine Dauerschwingung waere ohne Last nie zu sehen. Die Beharrungswerte (SPEC) bleiben unveraendert.
  const DZ = { U: 24, R: 1.0, L: 0.005, Ke: 0.1, Kt: 0.1, J: 0.002, Mmax: 0.5, Imax: 8, Tact: 0.02, sensorTau: 0.01, nMax: 3000 };
  const N2W = TWO_PI / 60;                                                  // 1/min -> rad/s
  const DZ_KS = (DZ.U / DZ.Ke) / N2W / DZ.nMax;                             // Streckenverstaerkung Ks in %/% (dimensionslos)
  const DZ_YOP = nRpm => 100 * nRpm * N2W / (DZ.U / DZ.Ke);                 // Stellgroesse im Leerlauf fuer eine Drehzahl, in %

  const DZ_CONTROLS = [
    sel('mode', 'Betrieb', 'auto', [{ value: 'hand', label: 'Hand' }, { value: 'auto', label: 'Automatik' }], 'Regler', 'Hand: Du stellst die Stellgröße selbst. Automatik: Der Regler stellt. Beim Umschalten springt die Stellgröße nicht (stoßfrei).'),
    sel('ctrl', 'Reglerart', 'P', [{ value: 'P', label: 'P' }, { value: 'I', label: 'I' }, { value: 'PI', label: 'PI' }, { value: 'PD', label: 'PD' }, { value: 'PID', label: 'PID' }], 'Regler', 'P stellt proportional zur Regeldifferenz, I summiert sie auf (beseitigt die bleibende Abweichung), D dämpft schnelle Änderungen.'),
    sel('dir', 'Wirkungssinn', 'direkt', [{ value: 'direkt', label: 'direkt' }, { value: 'invers', label: 'invers' }], 'Regler', 'Direkt: Ist der Istwert kleiner als der Sollwert, erhöht der Regler die Stellgröße. Dieser Prüfstand braucht den Wirkungssinn direkt.'),
    sld('kp', 'Kp (Verstärkung)', 0.1, 100, 0.1, '', 2, 'Regler', 'Kp: Verstärkung des Reglers (Xp = 100 % / Kp). Größer macht den Regler schneller und die bleibende Abweichung kleiner, aber der Kreis schwingt eher.', { scale: 'log' }),
    sld('tn', 'Tn (Nachstellzeit)', 0.02, 5, 0.01, 's', 0.2, 'Regler', 'Nachstellzeit Tn: Zeit, in der der I-Anteil so viel stellt wie der P-Anteil. Kleiner Tn ist ein stärkerer I-Anteil. Bei der Reglerart I ist Tn die Integrationszeit.', { scale: 'log', unitKind: 'time', visible: s => s.ctrl === 'I' || s.ctrl === 'PI' || s.ctrl === 'PID' }),
    sld('tv', 'Tv (Vorhaltzeit)', 0, 0.5, 0.005, 's', 0, 'Regler', 'Vorhaltzeit Tv: Der D-Anteil dämpft schnelle Änderungen, verstärkt aber das Messrauschen.', { unitKind: 'time', visible: s => s.ctrl === 'PD' || s.ctrl === 'PID' }),
    sld('u0', 'u0 (Arbeitspunkt)', 0, 100, 1, '%', 0, 'Regler', 'Arbeitspunkt u0: Die Stellgröße, die der P-Regler bei der Regeldifferenz 0 ausgibt.', { visible: s => s.ctrl === 'P' || s.ctrl === 'PD' }),
    sel('aw', 'Anti-Windup', 'rueck', [{ value: 'aus', label: 'aus' }, { value: 'klemmen', label: 'klemmen' }, { value: 'rueck', label: 'rueck' }], 'Regler', 'Anti-Windup verhindert, dass der I-Anteil weiterläuft, wenn die Stellgröße am Anschlag steht. aus: Windup sichtbar. klemmen: I-Anteil wird angehalten. rueck: I-Anteil wird zurückgerechnet.', { visible: s => s.ctrl === 'I' || s.ctrl === 'PI' || s.ctrl === 'PID' }),
    sld('ymax', 'Stellgröße max.', 20, 100, 1, '%', 100, 'Regler', 'Obere Stellgrößenbegrenzung (Stellglied-Grenze): Mehr als dieser Wert wird nicht gestellt.'),
    sel('ta', 'Abtastzeit Ta', 0.005, [{ value: 0.001, label: '1 ms' }, { value: 0.005, label: '5 ms' }, { value: 0.02, label: '20 ms' }, { value: 0.1, label: '100 ms' }], 'Regler', 'Abtastzeit Ta: Der Regler rechnet nur alle Ta, dazwischen hält er die Stellgröße. Eine große Ta kostet Phasenreserve.'),
    sld('w', 'Solldrehzahl w', 0, 3000, 10, '1/min', 1500, 'Regler', 'Sollwert w: Auf diese Drehzahl soll der Regler den Motor bringen.'),
    sld('wRamp', 'Sollwertrampe', 0, 6000, 50, '1/min/s', 0, 'Regler', 'Sollwertrampe: Der Sollwert läuft nur mit dieser Geschwindigkeit zum neuen Wert (0 = aus). Eine Rampe macht den Sprung weicher.'),
    sld('yHand', 'Stellgröße von Hand', 0, 100, 0.5, '%', 0, 'Regler', 'Handstellgröße y: wirkt nur im Handbetrieb. In der Automatik zeigt der Regler hier die aktuelle Stellgröße.'),
    sld('z', 'Lastmoment z', 0, 100, 1, '%', 0, 'Anlage und Störung', 'Störgröße z: Lastmoment der Lastbremse in Prozent von Mmax = ' + fm(DZ.Mmax, 1) + ' Nm.'),
    sld('noise', 'Messrauschen', 0, 5, 0.1, '%', 0, 'Anlage und Störung', 'Messrauschen des Tachogenerators in Prozent des Messbereichs (Standardabweichung).')
  ];
  const DZ_METERS = [
    { key: 'n', label: 'Drehzahl n', unit: '1/min', digits: 0, min: 0, max: 3000 },
    { key: 'w', label: 'Solldrehzahl w', unit: '1/min', digits: 0, min: 0, max: 3000 },
    { key: 'ua', label: 'Ankerspannung', unit: 'V', digits: 1, min: 0, max: DZ.U },
    { key: 'ia', label: 'Ankerstrom', unit: 'A', digits: 2, min: -(DZ.Imax + 1), max: DZ.Imax + 1, warnAbove: DZ.Imax - 0.05 },
    { key: 'torque', label: 'Motormoment', unit: 'Nm', digits: 2, min: -DZ.Kt * (DZ.Imax + 1), max: DZ.Kt * (DZ.Imax + 1) },
    { key: 'pMech', label: 'mechanische Leistung', unit: 'W', digits: 0, min: -200, max: 200 },
    { key: 'pElec', label: 'elektrische Leistung', unit: 'W', digits: 0, min: -200, max: 200 },
    { key: 'y', label: 'Stellgröße y', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'e', label: 'Regeldifferenz e', unit: '1/min', digits: 0, min: -3000, max: 3000 }
  ];
  const DZ_PRESETS = [
    { id: 'leerlauf', name: 'Leerlauf Hand', params: { mode: 'hand', yHand: 50, z: 0 }, op: { y: 50, z: 0 } },
    { id: 'p', name: 'P-Drehzahlregler', reset: true, params: { mode: 'auto', ctrl: 'P', kp: 5, u0: 0, aw: 'rueck', ymax: 100, ta: 0.005, w: 1500, wRamp: 0, z: 0, noise: 0 } },
    { id: 'pi', name: 'PI-Drehzahlregler', reset: true, params: { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, aw: 'rueck', ymax: 100, ta: 0.005, w: 1500, wRamp: 0, z: 0, noise: 0 } },
    { id: 'lastsprung', name: 'Lastsprung', params: { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, aw: 'rueck', ymax: 100, ta: 0.005, w: 1500, wRamp: 0, z: 60, noise: 0 }, op: { y: DZ_YOP(1500), z: 0 } },
    { id: 'windup', name: 'Stromgrenze/Windup', reset: true, params: { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, aw: 'aus', ymax: 60, ta: 0.005, w: 1200, wRamp: 0, z: 0, noise: 0 } }
  ];

  function makePlantDz(P, h, Cv) {
    const cA = P.Tact > 0 ? 1 - Math.exp(-h / P.Tact) : 1, wMax = P.nMax * N2W;
    const s = { ya: 0, I: 0, om: 0, clampRun: 0, clampMax: 0, clampNow: false, ang: 0, last: null };
    const mL = z => z / 100 * P.Mmax;
    const wSteady = (y, z) => Math.max(0, (P.U * y / 100 - P.R * mL(z) / P.Kt) / P.Ke);
    const Ks = () => (P.U / P.Ke) / N2W / P.nMax;
    return {
      s,
      reset() { s.ya = 0; s.I = 0; s.om = 0; s.clampRun = 0; s.clampMax = 0; s.clampNow = false; s.ang = 0; s.last = null; },
      step(y, z) {
        s.ya += cA * (y - s.ya);
        const Ua = P.U * s.ya / 100, ML = z / 100 * P.Mmax, R = P.R, L = P.L, Ke = P.Ke, Kt = P.Kt, J = P.J;
        const I0 = s.I, w0 = s.om;
        const k1i = (Ua - R * I0 - Ke * w0) / L, k1w = (Kt * I0 - ML) / J;
        const i2 = I0 + 0.5 * h * k1i, w2 = w0 + 0.5 * h * k1w;
        const k2i = (Ua - R * i2 - Ke * w2) / L, k2w = (Kt * i2 - ML) / J;
        const i3 = I0 + 0.5 * h * k2i, w3 = w0 + 0.5 * h * k2w;
        const k3i = (Ua - R * i3 - Ke * w3) / L, k3w = (Kt * i3 - ML) / J;
        const i4 = I0 + h * k3i, w4 = w0 + h * k3w;
        const k4i = (Ua - R * i4 - Ke * w4) / L, k4w = (Kt * i4 - ML) / J;
        let I = I0 + h / 6 * (k1i + 2 * k2i + 2 * k3i + k4i), om = w0 + h / 6 * (k1w + 2 * k2w + 2 * k3w + k4w);
        // Klemmung des Stromzustands: Der Strom bleibt im Schritt auf der Grenze, das Moment rechnet mit dem geklemmten Strom
        if (I >= P.Imax || I <= -P.Imax) { I = I > 0 ? P.Imax : -P.Imax; om = w0 + h * (Kt * I - ML) / J; s.clampNow = true; s.clampRun += h; if (s.clampRun > s.clampMax) s.clampMax = s.clampRun; }
        else { s.clampNow = false; s.clampRun = 0; }
        if (om < 0) { om = 0; if (I < 0) I = 0; }
        s.I = I; s.om = om > wMax * 1.5 ? wMax * 1.5 : om;
      },
      xPct() { return s.om / N2W / P.nMax * 100; },
      setOp(y, z) {
        const w = wSteady(y, z), Ua = P.U * y / 100;
        s.ya = y; s.om = w; s.I = w > 0 ? mL(z) / P.Kt : Math.min(Ua / P.R, mL(z) / P.Kt);
        s.clampRun = 0; s.clampMax = 0; s.clampNow = false;
      },
      steady(y, z) { return wSteady(y, z) / N2W; },
      linBlocks() {
        const Tm = P.J * P.R / (P.Ke * P.Kt), Te = P.L / P.R, b = [{ t: 'K', K: Ks() }];
        [Tm, Te, P.Tact, P.sensorTau].forEach(T => { if (T > 0) b.push({ t: 'PT1', T }); });
        return b;
      },
      V0(kp) { return kp * Ks(); },
      nonlinear() { return true; },
      Ks, mL
    };
  }

  function dzEbl(c) {
    const { S, Cv, P, plant } = c;
    const ePct = S.ws - S.xTrue;
    if (!(Math.abs(ePct) > 2)) return null;
    return (Cv.ctrl === 'PD' ? 'PD-Regler' : 'P-Regler') + ': bleibende Regelabweichung ' + fm(Math.abs(ePct) * (c.toPhys(100) - c.toPhys(0)) / 100, 0) + ' 1/min (V0 = Kp·Ks = ' + fm(plant.V0(Cv.kp), 1) + '). Sie wird mit größerem Kp kleiner, verschwindet aber nie. Nimm einen I-Anteil (' + (Cv.ctrl === 'PD' ? 'PID' : 'PI') + ').';
  }
  function dzDiag(c) {
    const { S, Cv, P, plant, held, add } = c, s = plant.s;
    if (s.clampMax >= 0.02) S.iLimT = S.t;
    s.clampMax = s.clampNow ? s.clampRun : 0;
    if (S.iLimT != null && S.t - S.iLimT < 0.3) add('stromgrenze', 'warn', 'Die Stromgrenze (' + fm(P.Imax, 1) + ' A) ist erreicht: Der Motor kann nicht mehr Drehmoment liefern als Kt·Imax = ' + fm(P.Kt * P.Imax, 2) + ' Nm, er beschleunigt oder bremst nur mit diesem Moment. Mit einer Sollwertrampe sinkt der Spitzenstrom.', 'stall');
    const nMaxHere = plant.steady(S.ymax, Cv.z);
    if (held('unreach', c.live && c.satHi && nMaxHere < c.toPhys(S.ws) - 0.01 * (c.toPhys(100) - c.toPhys(0)))) add('unreach', 'warn', 'Die Solldrehzahl ist nicht erreichbar: Bei y = ' + fm(S.ymax, 0) + ' % und dieser Last schafft der Motor höchstens ' + fm(nMaxHere, 0) + ' 1/min.');
  }

  function dzCurves(c) {
    const { S, Cv, P, plant } = c, y0 = S.y, n0 = c.toPhys(S.xTrue);
    const pts = [], ptsL = [];
    for (let y = 0; y <= 100.001; y += 5) { pts.push([y, plant.steady(y, Cv.z)]); ptsL.push([y, plant.steady(y, 0)]); }
    const nz = [];
    for (let z = 0; z <= 100.001; z += 5) nz.push([z, plant.steady(y0, z)]);
    const dy = 10, tEnd = 5 * plant.linBlocks().reduce((a, b) => a + (b.T || 0), 0), bl = plant.linBlocks();
    const resp = simLin(bl, tEnd, 120).map(q => [q[0], plant.steady(clamp(y0, 0, 90), Cv.z) + q[1] * dy / 100 * (c.toPhys(100) - c.toPhys(0))]);
    const series1 = [{ name: 'bei aktueller Last', points: pts }];
    if (Cv.z > 0) series1.push({ name: 'ohne Last', points: ptsL });
    return [
      { id: 'n-y', title: 'Drehzahl über Stellgröße', xLabel: 'Stellgröße y', xUnit: '%', yLabel: 'Drehzahl n', yUnit: '1/min', series: series1, marker: { x: y0, y: n0 } },
      { id: 'n-last', title: 'Drehzahl über Lastmoment (y fest)', xLabel: 'Lastmoment z', xUnit: '%', yLabel: 'Drehzahl n', yUnit: '1/min', series: [{ name: 'n(z) bei y = ' + fm(y0, 0) + ' %', points: nz }], marker: { x: Cv.z, y: plant.steady(y0, Cv.z) } },
      { id: 'sprung', title: 'Modell-Sprungantwort (y + ' + dy + ' %)', xLabel: 'Zeit', xUnit: 's', yLabel: 'Drehzahl n', yUnit: '1/min', series: [{ name: 'Modell aus linBlocks', points: resp }], marker: { x: 0, y: resp[0][1] } }
    ];
  }

  function dzDraw(ctx, t, c) {
    const { S, Cv, P, plant } = c, s = plant.s, st = c.state();
    const nowN = s.om / N2W, wMax = P.nMax;
    // Drehwinkel nur fuer die Optik (Anzeige langsamer als die Wirklichkeit ab 40 rad/s)
    if (s.last != null) { const dt = (t - s.last) / 1000; if (dt > 0 && dt < 0.25) s.ang += (s.om < 40 ? s.om : 40 + 0.15 * (s.om - 40)) * dt; }
    s.last = t;
    const ang = s.ang;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, WW, WH);
    txt(ctx, 'Drehzahlregelung – Übungsanlage', 24, 26, 18, C.text, 'left', true);
    txt(ctx, Cv.mode === 'hand' ? 'HAND' : 'AUTOMATIK', 976, 26, 15, Cv.mode === 'hand' ? C.warn : C.ok, 'right', true);
    // Grundplatte
    ctx.fillStyle = C.steel2; rr(ctx, 30, 414, 940, 16, 6); ctx.fill();
    ctx.fillStyle = C.line; for (let i = 0; i < 12; i++) ctx.fillRect(60 + i * 76, 419, 28, 4);
    // Steller
    ctx.fillStyle = C.panel; rr(ctx, 40, 190, 120, 170, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, 'Steller', 100, 208, 15, C.text, 'center', true);
    ctx.fillStyle = C.panel2; rr(ctx, 62, 224, 26, 112, 5); ctx.fill();
    const hy = 112 * clamp(s.ya, 0, 100) / 100; ctx.fillStyle = C.acc; rr(ctx, 62, 224 + 112 - hy, 26, Math.max(2, hy), 5); ctx.fill();
    txt(ctx, 'y_a', 75, 346, 11, C.dim, 'center');
    txt(ctx, fm(DZ.U * s.ya / 100, 1) + ' V', 124, 262, 15, C.text, 'center', true, MONO);
    txt(ctx, fm(s.I, 2) + ' A', 124, 292, 15, s.clampNow ? C.bad : C.text, 'center', true, MONO);
    // Kabel mit laufenden Punkten (Dichte ~ Strom)
    ctx.lineWidth = 4; ctx.strokeStyle = '#c0392b'; ctx.beginPath(); ctx.moveTo(160, 250); ctx.lineTo(222, 250); ctx.stroke();
    ctx.strokeStyle = '#2f6fb5'; ctx.beginPath(); ctx.moveTo(160, 300); ctx.lineTo(222, 300); ctx.stroke();
    const nd = Math.round(clamp(s.I, 0, DZ.Imax) / DZ.Imax * 5);
    for (let i = 0; i < nd; i++) { const f = ((t / 600 + i / Math.max(1, nd)) % 1); ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(160 + 62 * f, 250, 3.5, 0, TWO_PI); ctx.fill(); ctx.beginPath(); ctx.arc(222 - 62 * f, 300, 3.5, 0, TWO_PI); ctx.fill(); }
    // Motor
    ctx.fillStyle = '#4b5663'; rr(ctx, 222, 200, 220, 160, 14); ctx.fill(); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#38424d'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.moveTo(240 + i * 22, 208); ctx.lineTo(240 + i * 22, 352); ctx.stroke(); }
    ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(332, 280, 62, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = C.steel; ctx.lineWidth = 3; ctx.stroke();
    ctx.save(); ctx.translate(332, 280); ctx.rotate(ang);
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.fillStyle = i % 2 ? '#c0392b' : '#2f6fb5'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 52, -0.45, 0.45); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = C.steel; ctx.beginPath(); ctx.arc(332, 280, 11, 0, TWO_PI); ctx.fill();
    txt(ctx, 'Gleichstrommotor', 332, 378, 13, C.dim, 'center');
    // Welle, Kupplung
    ctx.fillStyle = C.steel; ctx.fillRect(442, 272, 358, 16);
    ctx.save(); ctx.translate(520, 280); ctx.rotate(ang); ctx.fillStyle = C.steel2; ctx.fillRect(-12, -30, 24, 60); ctx.fillStyle = C.warn; ctx.fillRect(-4, -30, 8, 12); ctx.restore();
    // Tachogenerator
    ctx.fillStyle = C.panel; rr(ctx, 596, 214, 104, 132, 10); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, 'Tacho', 648, 230, 14, C.text, 'center', true);
    const xmPhys = c.toPhys(S.xm);
    txt(ctx, fm(xmPhys, 0), 648, 292, 22, S.sigma > 0 ? C.warn : C.text, 'center', true, MONO);
    txt(ctx, '1/min (Messwert)', 648, 316, 11, C.dim, 'center');
    ctx.strokeStyle = C.ok; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(648, 214); ctx.lineTo(648, 150); ctx.lineTo(120, 150); ctx.lineTo(120, 190); ctx.stroke();
    txt(ctx, 'Messwert zum Regler', 380, 138, 12, C.ok, 'center');
    // Lastbremse: Scheibe mit Bremsbacken, Spalt ~ 1 - z
    const gap = 18 * (1 - Cv.z / 100);
    ctx.save(); ctx.translate(840, 280); ctx.rotate(ang);
    ctx.fillStyle = C.steel2; ctx.beginPath(); ctx.arc(0, 0, 84, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = C.steel; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#38424d'; ctx.lineWidth = 4; for (let i = 0; i < 4; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(70, 0); ctx.stroke(); }
    ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(60, 0, 6, 0, TWO_PI); ctx.fill();
    ctx.restore();
    const heat = clamp(Cv.z / 100 * clamp(nowN / 1500, 0, 1.5), 0, 1);
    ctx.fillStyle = 'rgb(' + Math.round(110 + 140 * heat) + ',' + Math.round(90 - 40 * heat) + ',' + Math.round(80 - 40 * heat) + ')';
    const padTop = 280 - 84 - gap - 22, padBot = 280 + 84 + gap;
    rr(ctx, 806, padTop, 68, 22, 5); ctx.fill();
    rr(ctx, 806, padBot, 68, 22, 5); ctx.fill();
    ctx.fillStyle = C.steel; ctx.fillRect(834, 140, 12, padTop - 140); ctx.fillRect(834, padBot + 22, 12, 414 - padBot - 22);
    txt(ctx, 'Lastbremse', 840, 126, 13, C.dim, 'center');
    txt(ctx, 'z = ' + fm(Cv.z, 0) + ' %  (' + fm(plant.mL(Cv.z), 2) + ' Nm)', 840, 436, 14, C.text, 'center', true);
    if (heat > 0.45) sparks(ctx, 840 - 84, 280, t, 4, C.warn);
    // Stromgrenze: Funken am Motor
    if (S.iLimT != null && S.t - S.iLimT < 0.3) { sparks(ctx, 332, 224, t, 7, C.bad); txt(ctx, 'Stromgrenze!', 332, 186, 15, C.bad, 'center', true); }
    // Zeigerinstrumente
    dial(ctx, 220, 494, 52, nowN, 0, wMax, { set: Cv.w, label: 'n in 1/min', text: fm(nowN, 0) });
    dial(ctx, 390, 494, 52, s.I, -(DZ.Imax + 1), DZ.Imax + 1, { label: 'I in A', text: fm(s.I, 2), warnFrom: DZ.Imax - 0.05, bad: s.clampNow });
    dial(ctx, 560, 494, 52, S.y, 0, 100, { label: 'y in %', text: fm(S.y, 1) });
    // Anzeigeblock
    const ts = ['Soll w = ' + fm(Cv.w, 0) + ' 1/min', 'Ist n = ' + fm(nowN, 0) + ' 1/min', 'e = ' + fm(st.e, 0) + ' 1/min', 'Regler: ' + Cv.ctrl + (Cv.mode === 'hand' ? ' (aus)' : ''), 'P_mech = ' + fm(DZ.Kt * s.I * s.om, 0) + ' W'];
    ts.forEach((q, i) => txt(ctx, q, 690, 462 + i * 20, 14, i === 2 && Math.abs(st.e) > 0.02 * 3000 ? C.warn : C.text, 'left', i < 2, MONO));
  }
  function dzHit(x, y, c) {
    if (Math.hypot(x - 840, y - 280) <= 100) { const v = c.Cv.z > 0 ? 0 : 60; return { key: 'z', kind: 'switch', to: v, value: v }; }
    if (x >= 222 && x <= 442 && y >= 200 && y <= 360) { const v = c.Cv.mode === 'hand' ? 'auto' : 'hand'; return { key: 'mode', kind: 'switch', to: v, value: v }; }
    return null;
  }

  R.register({
    id: 'drehzahl', name: 'Drehzahlregelung', icon: '🌀',
    info: 'Übungsanlage: Gleichstrommotor mit Steller und Tachogenerator. Die Drehzahl wird auf den Sollwert geregelt, die Lastbremse stört die Regelung. Stelle P, PI oder PID ein und beobachte die bleibende Abweichung, die Stromgrenze und den Windup.',
    controls: DZ_CONTROLS, meters: DZ_METERS, presets: DZ_PRESETS,
    create(opts) {
      return buildRig({
        id: 'drehzahl', range: { lo: 0, hi: DZ.nMax, unit: '1/min', digits: 0 }, timeScale: 1, tUnit: 's', h: 0.001, trEvery: 5, spanS: 3, tHold: 0.3, oscWin: 1.5, settleWin: 1.0,
        params: DZ, controls: DZ_CONTROLS, meters: DZ_METERS, presets: DZ_PRESETS, ctrlOk: ['P', 'I', 'PI', 'PD', 'PID'], requiredDir: 'direkt', symmetric: false, zToggle: 60,
        roles: { w: 'Solldrehzahl', x: 'Drehzahl n', y: 'Ankerspannung', z: 'Lastmoment', stell: 'Steller', mess: 'Tachogenerator' },
        makePlant: makePlantDz,
        extraTrace: [{ key: 'ia', fn: (S, p) => p.s.I }],
        meterValues: (S, p, Cv) => ({ n: S.xTrue * DZ.nMax / 100, ua: DZ.U * p.s.ya / 100, ia: p.s.I, torque: DZ.Kt * p.s.I, pMech: DZ.Kt * p.s.I * p.s.om, pElec: DZ.U * p.s.ya / 100 * p.s.I }),
        stateExtra: (S, p, Cv) => ({ n: S.xTrue * DZ.nMax / 100, omega: p.s.om, ua: DZ.U * p.s.ya / 100, ia: p.s.I, torque: DZ.Kt * p.s.I, loadTorque: p.mL(Cv.z), pMech: DZ.Kt * p.s.I * p.s.om, pElec: DZ.U * p.s.ya / 100 * p.s.I, iLimit: S.iLimT != null && S.t - S.iLimT < 0.3, iClamped: p.s.clampNow }),
        eblText: dzEbl, diagExtra: dzDiag, analysisInfo: Cv => 'Linearisiert im Arbeitspunkt (Stromgrenze und Anschlag der Stellgröße bleiben unberücksichtigt).',
        curves: dzCurves, draw: dzDraw, hitTest: dzHit
      }, opts);
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);
