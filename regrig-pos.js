/* regrig-pos.js - Regelungstechnik-Lab, Pruefstand position (Positionsregelung: Spindelachse mit Haftreibung und Lose) (WP2c).
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
  if (!R.cbase) { if (typeof console !== 'undefined') console.warn('regrig-pos.js: regrig-c-base.js (REG_RIGS.cbase) fehlt (bitte davor laden), der Prüfstand wird nicht registriert.'); return; }
  const {
    WW, FONT, MONO, C, TWO_PI, DIAG_EVERY, TR_CAP, DIAG_ORDER, ALL_CTRL, OSC_CLS, clamp, lerp, fin, fm, fmT, hasI, hasD, core, sel, sld, oscLocal,
    oscClassify, rr, txt, dial, sparks, simLin, DIAG_FALLBACK, tx, fitOf, buildRig, WH
  } = R.cbase;


  // ===== Pruefstand 6: position - Positionsregelung (Spindelachse mit Haftreibung und Lose) =====
  // Nur Regelstrecke (SPEC 1.2): Der Antrieb ist ein Geschwindigkeitsstellglied. Alle Werte sind Entwurfswerte einer Uebungsanlage (A8).
  //   Stellgroesse y 0...100 % = Geschwindigkeitssollwert -100...+100 % (50 % = Stillstand, 0...10 V, 5 V = Halt)
  //   Strecke      Eingang y + z  ->  Totzeit Tt (Bus)  ->  Totzone/Haftreibung db um 50 %  ->  v_soll = Kis * u_eff  ->  PT1 Tm  ->  Integrator
  //                (Motorlage pm)  ->  Lose b  ->  Schlittenlage p, Endanschlaege bei 0 und 100 mm  (1 mm = 1 % des Bereichs)
  //   Messglied    Wegmesssystem PT1 Ts = 40 ms (im Block: sensorTau), Rauschen in % des Bereichs
  //   Stoerung     z (-20...+20 %) wirkt als aequivalenter Stellgroessenversatz am Streckeneingang (Last/Windkraft)
  // Abweichung von SPEC 4.7: Die obere Stellgroessenbegrenzung ymax gilt symmetrisch (ymin = 100 - ymax, 55...100 %), weil 50 % Stillstand bedeutet.
  const PS = { Kis: 1.0, Tm: 0.2, sensorTau: 0.04, Tt: 0.02, p0: 20, impactMin: 5, lo: 0, hi: 100 };
  const ANSCHLAG_HOLD = 1.0;          // Anschlag-Meldung bleibt so lange (s) als aktuell stehen

  const PS_CONTROLS = [
    sel('mode', 'Betrieb', 'auto', [{ value: 'hand', label: 'Hand' }, { value: 'auto', label: 'Automatik' }], 'Regler', 'Hand: Du stellst die Stellgröße selbst, 50 % ist Stillstand. Automatik: Der Regler stellt. Beim Umschalten springt die Stellgröße nicht (stoßfrei).'),
    sel('ctrl', 'Reglerart', 'P', [{ value: 'P', label: 'P' }, { value: 'I', label: 'I' }, { value: 'PI', label: 'PI' }, { value: 'PD', label: 'PD' }, { value: 'PID', label: 'PID' }], 'Regler', 'P stellt proportional zur Regeldifferenz, I summiert sie auf, D dämpft schnelle Änderungen. Die Achse ist eine I-Strecke (ohne Ausgleich): Ein P-Regler reicht für die Lage.'),
    sel('dir', 'Wirkungssinn', 'direkt', [{ value: 'direkt', label: 'direkt' }, { value: 'invers', label: 'invers' }], 'Regler', 'Direkt: Ist der Istwert kleiner als der Sollwert, erhöht der Regler die Stellgröße. Dieser Prüfstand braucht den Wirkungssinn direkt.'),
    sld('kp', 'Kp (Verstärkung)', 0.1, 100, 0.1, '', 2, 'Regler', 'Kp: Verstärkung des Reglers (Xp = 100 % / Kp). Größer macht die Achse schneller, aber der Kreis schwingt eher.', { scale: 'log' }),
    sld('tn', 'Tn (Nachstellzeit)', 0.1, 20, 0.1, 's', 2, 'Regler', 'Nachstellzeit Tn: Zeit, in der der I-Anteil so viel stellt wie der P-Anteil. Kleiner Tn ist ein stärkerer I-Anteil. Bei der Reglerart I ist Tn die Integrationszeit.', { scale: 'log', unitKind: 'time', visible: s => s.ctrl === 'I' || s.ctrl === 'PI' || s.ctrl === 'PID' }),
    sld('tv', 'Tv (Vorhaltzeit)', 0, 1, 0.01, 's', 0, 'Regler', 'Vorhaltzeit Tv: Der D-Anteil dämpft das Überschwingen, verstärkt aber das Messrauschen.', { unitKind: 'time', visible: s => s.ctrl === 'PD' || s.ctrl === 'PID' }),
    sld('u0', 'u0 (Arbeitspunkt)', 0, 100, 1, '%', 50, 'Regler', 'Arbeitspunkt u0: Die Stellgröße, die der P-Regler bei der Regeldifferenz 0 ausgibt. 50 % bedeutet Stillstand.', { visible: s => s.ctrl === 'P' || s.ctrl === 'PD' }),
    sel('aw', 'Anti-Windup', 'rueck', [{ value: 'aus', label: 'aus' }, { value: 'klemmen', label: 'klemmen' }, { value: 'rueck', label: 'rueck' }], 'Regler', 'Anti-Windup verhindert, dass der I-Anteil weiterläuft, wenn die Stellgröße am Anschlag steht. aus: Windup sichtbar. klemmen: I-Anteil wird angehalten. rueck: I-Anteil wird zurückgerechnet.', { visible: s => s.ctrl === 'I' || s.ctrl === 'PI' || s.ctrl === 'PID' }),
    sld('ymax', 'Stellgröße max.', 55, 100, 1, '%', 100, 'Regler', 'Obere Stellgrößenbegrenzung (Geschwindigkeitsgrenze): Die Stellgröße wird auf 100 % − ymax bis ymax begrenzt, 50 % ist Stillstand.'),
    sel('ta', 'Abtastzeit Ta', 0.002, [{ value: 0.002, label: '2 ms' }, { value: 0.01, label: '10 ms' }, { value: 0.02, label: '20 ms' }, { value: 0.05, label: '50 ms' }], 'Regler', 'Abtastzeit Ta: Der Regler rechnet nur alle Ta, dazwischen hält er die Stellgröße. Eine große Ta kostet Phasenreserve.'),
    sld('w', 'Sollposition w', 0, 100, 1, 'mm', 50, 'Regler', 'Sollwert w: Auf diese Position soll der Regler den Schlitten fahren.'),
    sld('wRamp', 'Sollwertrampe', 0, 200, 1, 'mm/s', 0, 'Regler', 'Sollwertrampe: Der Sollwert läuft nur mit dieser Geschwindigkeit zum neuen Wert (0 = aus). Eine Rampe macht den Sprung weicher.'),
    sld('yHand', 'Stellgröße von Hand', 0, 100, 0.5, '%', 50, 'Regler', 'Handstellgröße y: 50 % ist Stillstand, darüber fährt der Schlitten vor, darunter zurück. Wirkt nur im Handbetrieb; in der Automatik zeigt der Regler hier die aktuelle Stellgröße.'),
    sld('z', 'Last z', -20, 20, 1, '%', 0, 'Anlage und Störung', 'Störgröße z: Last oder Windkraft als Versatz der Stellgröße. Mit z = 10 % fährt die Achse bei y = 50 % mit ' + fm(PS.Kis * 10, 0) + ' mm/s davon.'),
    sld('friction', 'Haftreibung', 0, 10, 0.5, '%', 0, 'Anlage und Störung', 'Haftreibung (Totzone): Die Stellgröße muss mehr als diesen Wert von 50 % abweichen, sonst bleibt die Achse stehen.'),
    sld('backlash', 'Lose', 0, 3, 0.1, 'mm', 0, 'Anlage und Störung', 'Lose (Spiel) der Spindel: Bei Richtungswechsel fährt der Motor erst diese Strecke leer, bevor der Schlitten folgt.'),
    sld('noise', 'Messrauschen', 0, 5, 0.1, '%', 0, 'Anlage und Störung', 'Messrauschen des Wegmesssystems in Prozent des Messbereichs (Standardabweichung).')
  ];
  const PS_METERS = [
    { key: 'pos', label: 'Position p', unit: 'mm', digits: 1, min: 0, max: 100 },
    { key: 'w', label: 'Sollposition w', unit: 'mm', digits: 1, min: 0, max: 100 },
    { key: 'speed', label: 'Geschwindigkeit', unit: 'mm/s', digits: 1, min: -100, max: 100 },
    { key: 'posMotor', label: 'Motorlage (vor der Lose)', unit: 'mm', digits: 1, min: -2, max: 102 },
    { key: 'y', label: 'Stellgröße y', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'e', label: 'Regeldifferenz e', unit: 'mm', digits: 1, min: -100, max: 100 }
  ];
  const PS_PRESETS = [
    { id: 'hand', name: 'Hand Stillstand (50 %)', params: { mode: 'hand', yHand: 50, z: 0, friction: 0, backlash: 0, noise: 0 }, op: { y: 50, z: 0, x0: PS.p0 } },
    { id: 'p', name: 'P-Lageregler', reset: true, params: { mode: 'auto', ctrl: 'P', kp: 2, u0: 50, aw: 'rueck', ymax: 100, ta: 0.002, w: 60, wRamp: 0, z: 0, friction: 0, backlash: 0, noise: 0 } },
    { id: 'pd', name: 'PD-Lageregler', reset: true, params: { mode: 'auto', ctrl: 'PD', kp: 6, tv: 0.2, u0: 50, aw: 'rueck', ymax: 100, ta: 0.002, w: 60, wRamp: 0, z: 0, friction: 0, backlash: 0, noise: 0 } },
    { id: 'grenz', name: 'PI mit Reibung (Grenzzyklus)', reset: true, params: { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.5, aw: 'rueck', ymax: 100, ta: 0.002, w: 60, wRamp: 0, z: 0, friction: 5, backlash: 1, noise: 0 } }
  ];

  function makePlantPos(P, h, Cv) {
    const cM = P.Tm > 0 ? 1 - Math.exp(-h / P.Tm) : 1, cV = 1 - Math.exp(-h / 0.02);
    const N = Math.max(0, Math.round(P.Tt / h)), buf = new Float64Array(Math.max(1, N));
    const s = { bi: 0, v: 0, pm: P.p0, xo: P.p0, vS: 0, atLo: false, atHi: false, hits: [], flips: 0, contact: 0, stick: false, yin: 50, ang: 0, last: null };
    const dead = (u, db) => u > db ? u - db : u < -db ? u + db : 0;
    return {
      s,
      reset() { buf.fill(50); s.bi = 0; s.v = 0; s.pm = P.p0; s.xo = P.p0; s.vS = 0; s.atLo = false; s.atHi = false; s.hits.length = 0; s.flips = 0; s.contact = 0; s.stick = false; s.yin = 50; s.ang = 0; s.last = null; },
      step(y, z) {
        const uin = y + z;
        let ud; if (N > 0) { ud = buf[s.bi]; buf[s.bi] = uin; s.bi = (s.bi + 1) % N; } else ud = uin;
        s.yin = ud;
        const d = ud - 50, db = Cv.friction, ue = dead(d, db);
        s.stick = ue === 0 && Math.abs(d) > 0.05;
        const vOld = s.v; s.v += cM * (P.Kis * ue - s.v);
        let pm = s.pm + 0.5 * (vOld + s.v) * h, xo = s.xo;
        const b2 = Cv.backlash / 2, xoOld = xo;
        let contact = 0;
        if (pm - xo > b2) { xo = pm - b2; contact = 1; } else if (pm - xo < -b2) { xo = pm + b2; contact = -1; }
        if (contact !== 0 && s.contact !== 0 && contact !== s.contact && b2 > 0) s.flips++;
        if (contact !== 0) s.contact = contact;
        if (xo >= P.hi) {
          if (!s.atHi) { s.atHi = true; s.hits.push({ speed: Math.abs(s.v), side: 'hi' }); }
          xo = P.hi; if (pm > P.hi + b2) pm = P.hi + b2; if (s.v > 0) s.v = 0;
        } else s.atHi = false;
        if (xo <= P.lo) {
          if (!s.atLo) { s.atLo = true; s.hits.push({ speed: Math.abs(s.v), side: 'lo' }); }
          xo = P.lo; if (pm < P.lo - b2) pm = P.lo - b2; if (s.v < 0) s.v = 0;
        } else s.atLo = false;
        s.vS += cV * ((xo - xoOld) / h - s.vS);
        s.pm = pm; s.xo = xo;
      },
      xPct() { return s.xo; },
      setOp(y, z, x0) {
        const uin = y + z; buf.fill(uin); s.bi = 0; s.yin = uin;
        s.v = P.Kis * dead(uin - 50, Cv.friction); s.vS = s.v;
        if (x0 != null && isFinite(x0)) { s.xo = clamp(x0, P.lo, P.hi); s.pm = s.xo; s.contact = 0; }
        s.atLo = s.xo <= P.lo; s.atHi = s.xo >= P.hi; s.hits.length = 0;
      },
      steady(y, z) { const ue = dead(y + z - 50, Cv.friction); return ue > 0 ? P.hi : ue < 0 ? P.lo : s.xo; },
      linBlocks() {
        const b = [{ t: 'I', Ki: P.Kis }];
        if (P.Tm > 0) b.push({ t: 'PT1', T: P.Tm });
        if (P.sensorTau > 0) b.push({ t: 'PT1', T: P.sensorTau });
        if (N > 0) b.push({ t: 'Tt', Tt: N * h });
        return b;
      },
      V0(kp) { return kp * P.Kis; },
      nonlinear() { return Cv.friction > 0 || Cv.backlash > 0; },
      dead
    };
  }

  function psEbl(c) {
    const { S, Cv, P } = c;
    if (Cv.friction > 0) return null;
    const eMm = S.ws - S.xTrue, eExp = (50 - Cv.z - Cv.u0) / Cv.kp;
    if (!(Math.abs(eMm) > 2) || !(Math.abs(eMm - eExp) <= 0.5)) return null;     // nur behaupten, was die Rechnung bestaetigt
    return (Cv.ctrl === 'PD' ? 'PD-Regler' : 'P-Regler') + ': bleibende Regelabweichung ' + fm(Math.abs(eMm), 1) + ' mm. Die Last z = ' + fm(Cv.z, 0) + ' % und der Arbeitspunkt u0 = ' + fm(Cv.u0, 0) + ' % verschieben die Ruhelage: e = (50 % − z − u0) / Kp = ' + fm(eExp, 1) + ' mm. Nimm einen I-Anteil (' + (Cv.ctrl === 'PD' ? 'PID' : 'PI') + ').';
  }
  function psGrenz(c) { return (c.Cv.friction > 0 || c.Cv.backlash > 0) && c.osc.cls === 'dauerschwingung' && hasI(c.Cv.ctrl); }
  function psDiag(c) {
    const { S, plant, add } = c, s = plant.s;
    while (s.hits.length) { const q = s.hits.shift(); if (q.speed >= PS.impactMin) { S.hitT = S.t; S.hitTxt = 'Anschlag: Die Achse ist mit ' + fm(q.speed, 0) + ' mm/s gegen den Endanschlag bei ' + fm(q.side === 'hi' ? PS.hi : PS.lo, 0) + ' mm gefahren. Fahre langsamer an (kleineres Kp oder eine Sollwertrampe), sonst schlägt sie hart an.'; } }
    if (S.hitT != null && S.t - S.hitT < ANSCHLAG_HOLD) add('anschlag', 'warn', S.hitTxt, 'crash');
  }

  function psCurves(c) {
    const { S, Cv, P, plant } = c, bl = plant.linBlocks(), s = plant.s;
    const v1 = [], v0 = [];
    for (let y = 0; y <= 100.001; y += 2.5) { v1.push([y, P.Kis * plant.dead(y + Cv.z - 50, Cv.friction)]); v0.push([y, P.Kis * plant.dead(y + Cv.z - 50, 0)]); }
    const sv1 = [{ name: Cv.friction > 0 ? 'mit Haftreibung' : 'ohne Haftreibung', points: v1 }];
    if (Cv.friction > 0) sv1.push({ name: 'ohne Haftreibung', points: v0 });
    const A = 10, b2 = Cv.backlash / 2, fw = [], bw = [];
    let xo = 50 - A;
    for (let k = 0; k <= 2 * A; k++) { const xi = 50 - A + k; if (xi - xo > b2) xo = xi - b2; else if (xi - xo < -b2) xo = xi + b2; fw.push([xi, xo]); }
    for (let k = 0; k <= 2 * A; k++) { const xi = 50 + A - k; if (xi - xo > b2) xo = xi - b2; else if (xi - xo < -b2) xo = xi + b2; bw.push([xi, xo]); }
    const tEnd = 3, dy = 10, x0 = c.toPhys(S.xTrue);
    const resp = simLin(bl, tEnd, 120).map(q => [q[0], clamp(x0 + q[1] * dy, P.lo, P.hi)]);
    return [
      { id: 'v-y', title: 'Geschwindigkeit über Stellgröße (Haftreibung)', xLabel: 'Stellgröße y (+ z)', xUnit: '%', yLabel: 'Geschwindigkeit', yUnit: 'mm/s', series: sv1, marker: { x: clamp(S.y + Cv.z, 0, 100), y: s.vS } },
      { id: 'lose', title: 'Lose: Antrieb gegen Abtrieb', xLabel: 'Motorlage', xUnit: 'mm', yLabel: 'Schlittenlage', yUnit: 'mm', series: [{ name: 'Hinweg', points: fw }, { name: 'Rückweg', points: bw }], marker: { x: s.pm, y: s.xo } },
      { id: 'sprung', title: 'Modell-Sprungantwort (y + ' + dy + ' %, Rampe)', xLabel: 'Zeit', xUnit: 's', yLabel: 'Position', yUnit: 'mm', series: [{ name: 'Modell aus linBlocks', points: resp }], marker: { x: 0, y: resp[0][1] } }
    ];
  }

  function psDraw(ctx, t, c) {
    const { S, Cv, P, plant } = c, s = plant.s, st = c.state();
    if (s.last != null) { const dt = (t - s.last) / 1000; if (dt > 0 && dt < 0.25) s.ang += s.v * 0.5 * dt; }
    s.last = t;
    const shake = S.hitT != null && S.t - S.hitT < 0.4 ? Math.sin(t / 25) * 3 * (1 - (S.t - S.hitT) / 0.4) : 0;
    const X = mm => 100 + 8 * mm, xo = X(s.xo) + shake;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, WW, WH);
    txt(ctx, 'Positionsregelung – Spindelachse', 24, 26, 18, C.text, 'left', true);
    txt(ctx, Cv.mode === 'hand' ? 'HAND' : 'AUTOMATIK', 976, 26, 15, Cv.mode === 'hand' ? C.warn : C.ok, 'right', true);
    // Schiene und Massstab
    ctx.fillStyle = C.steel2; rr(ctx, 70, 322, 860, 26, 6); ctx.fill();
    ctx.strokeStyle = C.text; ctx.lineWidth = 1.5; ctx.font = '12px ' + FONT;
    for (let mm = 0; mm <= 100; mm += 10) { ctx.beginPath(); ctx.moveTo(X(mm), 348); ctx.lineTo(X(mm), 358); ctx.stroke(); txt(ctx, mm, X(mm), 372, 12, C.dim, 'center'); }
    txt(ctx, 'mm', 930, 372, 12, C.dim, 'left');
    // Spindel mit Gewinde (wandert mit der Motorlage)
    ctx.fillStyle = '#7f8c98'; ctx.fillRect(62, 296, 856, 14);
    ctx.strokeStyle = '#4b5663'; ctx.lineWidth = 2;
    const off = ((s.pm * 8) % 16 + 16) % 16;
    for (let x = 70 - 16 + off; x < 912; x += 16) { if (x < 62) continue; ctx.beginPath(); ctx.moveTo(x, 297); ctx.lineTo(x + 7, 309); ctx.stroke(); }
    // Motor mit Drehgeber
    ctx.fillStyle = '#4b5663'; rr(ctx, 14, 250, 60, 100, 10); ctx.fill(); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(44, 303); ctx.rotate(s.ang);
    ctx.fillStyle = C.panel; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = C.acc; ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(20, 0); ctx.stroke(); }
    ctx.restore();
    txt(ctx, 'Motor', 44, 268, 12, C.dim, 'center');
    // Endschalter
    [[P.lo, s.atLo], [P.hi, s.atHi]].forEach(q => { ctx.fillStyle = q[1] ? C.bad : C.panel2; rr(ctx, X(q[0]) - 8, 280, 16, 40, 4); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke(); });
    txt(ctx, 'Endschalter', X(P.hi), 268, 11, C.dim, 'center');
    // Schlitten mit Mutter; Lose als sichtbare Luecke zwischen Motor- und Schlittenmarke
    ctx.fillStyle = '#2f6fb5'; rr(ctx, xo - 36, 262, 72, 34, 6); ctx.fill(); ctx.strokeStyle = C.steel; ctx.lineWidth = 2; ctx.stroke();
    txt(ctx, 'Schlitten', xo, 279, 13, C.text, 'center', true);
    ctx.fillStyle = C.warn; rr(ctx, X(s.pm) - 6 + shake, 310, 12, 18, 3); ctx.fill();
    ctx.fillStyle = C.steel; ctx.beginPath(); ctx.moveTo(xo, 312); ctx.lineTo(xo - 6, 326); ctx.lineTo(xo + 6, 326); ctx.closePath(); ctx.fill();
    if (Cv.backlash > 0) txt(ctx, 'Lose ' + fm(Cv.backlash, 1) + ' mm', (xo + X(s.pm)) / 2, 398, 12, C.warn, 'center');
    // Sollmarke
    const xw = X(Cv.w);
    ctx.fillStyle = C.warn; ctx.beginPath(); ctx.moveTo(xw, 252); ctx.lineTo(xw - 8, 236); ctx.lineTo(xw + 8, 236); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.warn; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xw, 252); ctx.lineTo(xw, 322); ctx.stroke(); ctx.setLineDash([]);
    txt(ctx, 'Soll ' + fm(Cv.w, 0) + ' mm', xw, 222, 13, C.warn, 'center', true);
    // Reibungsfunken im Haftbereich, Anschlag
    if (s.stick && Cv.friction > 0) { sparks(ctx, xo, 330, t, 5, C.warn); txt(ctx, 'haftet', xo, 190, 12, C.warn, 'center'); }
    if (S.hitT != null && S.t - S.hitT < 0.6) { sparks(ctx, s.atHi ? X(P.hi) : X(P.lo), 300, t, 8, C.bad); txt(ctx, 'Anschlag!', s.atHi ? X(P.hi) - 40 : X(P.lo) + 50, 214, 15, C.bad, 'center', true); }
    // Balken: Geschwindigkeit (um 0) und Stellgroesse (um 50 %)
    const bar = (x, y, w, v, lo, hi, label, text, col) => {
      ctx.fillStyle = C.panel; rr(ctx, x, y, w, 16, 5); ctx.fill();
      const z0 = x + w * (0 - lo) / (hi - lo), vx = x + w * clamp((v - lo) / (hi - lo), 0, 1);
      ctx.fillStyle = col; ctx.fillRect(Math.min(z0, vx), y + 2, Math.abs(vx - z0), 12);
      ctx.strokeStyle = C.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(z0, y - 2); ctx.lineTo(z0, y + 18); ctx.stroke();
      txt(ctx, label, x, y - 12, 12, C.dim, 'left'); txt(ctx, text, x + w, y - 12, 13, C.text, 'right', true, MONO);
    };
    bar(70, 462, 380, st.y - 50, -50, 50, 'Stellgröße y (50 % = Stillstand)', fm(st.y, 1) + ' %', st.satHigh || st.satLow ? C.bad : C.acc);
    bar(520, 462, 380, s.vS, -100, 100, 'Geschwindigkeit', fm(s.vS, 1) + ' mm/s', C.ok);
    const ts = ['Ist p = ' + fm(s.xo, 1) + ' mm', 'Soll w = ' + fm(Cv.w, 1) + ' mm', 'e = ' + fm(st.e, 1) + ' mm', 'Regler: ' + Cv.ctrl + (Cv.mode === 'hand' ? ' (aus)' : ''), 'Last z = ' + fm(Cv.z, 0) + ' %'];
    ts.forEach((q, i) => txt(ctx, q, 70 + i * 180, 516, 14, i === 2 && Math.abs(st.e) > 2 ? C.warn : C.text, 'left', i < 2, MONO));
  }
  function psHit(x, y, c) {
    if (x >= 10 && x <= 80 && y >= 245 && y <= 355) { const v = c.Cv.mode === 'hand' ? 'auto' : 'hand'; return { key: 'mode', kind: 'switch', to: v, value: v }; }
    const xo = 100 + 8 * c.plant.s.xo;
    if (Math.abs(x - xo) <= 40 && y >= 258 && y <= 300) { const v = c.Cv.z !== 0 ? 0 : 10; return { key: 'z', kind: 'switch', to: v, value: v }; }
    return null;
  }

  R.register({
    id: 'position', name: 'Positionsregelung', icon: '📏',
    info: 'Übungsanlage: Spindelachse mit Motor, Haftreibung und Lose. Die Achse ist eine Strecke ohne Ausgleich (der Schlitten bleibt nur bei Stillstand stehen). Regle die Lage mit P, PD oder PI und beobachte Anschlag, Reibung und Grenzzyklus.',
    controls: PS_CONTROLS, meters: PS_METERS, presets: PS_PRESETS,
    create(opts) {
      return buildRig({
        id: 'position', range: { lo: 0, hi: 100, unit: 'mm', digits: 1 }, timeScale: 1, tUnit: 's', h: 0.002, trEvery: 5, spanS: 6, tHold: 0.5, oscWin: 30, settleWin: 1.5,
        params: PS, controls: PS_CONTROLS, meters: PS_METERS, presets: PS_PRESETS, ctrlOk: ['P', 'I', 'PI', 'PD', 'PID'], requiredDir: 'direkt', symmetric: true, zToggle: 10,
        roles: { w: 'Sollposition', x: 'Position p', y: 'Geschwindigkeitssollwert', z: 'Last (Windkraft)', stell: 'Antrieb mit Umrichter', mess: 'Wegmesssystem' },
        makePlant: makePlantPos,
        extraTrace: [{ key: 'pm', fn: (S, p) => p.s.pm }],
        meterValues: (S, p, Cv) => ({ pos: S.xTrue, speed: p.s.vS, posMotor: p.s.pm }),
        stateExtra: (S, p, Cv) => ({ pos: S.xTrue, speed: p.s.vS, posMotor: p.s.pm, friction: Cv.friction, backlash: Cv.backlash, atLow: p.s.atLo, atHigh: p.s.atHi, stick: p.s.stick, flips: p.s.flips }),
        eblText: psEbl, grenzCond: psGrenz, diagExtra: psDiag, analysisInfo: Cv => (Cv.friction > 0 || Cv.backlash > 0 ? 'Linearisiert im Arbeitspunkt (Haftreibung und Lose bleiben unberücksichtigt).' : 'Lineares Modell der Achse (Anschläge bleiben unberücksichtigt).'),
        curves: psCurves, draw: psDraw, hitTest: psHit
      }, opts);
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);
