/* thmrig-bauteil.js - Thermik-Lab, Pruefstand bauteil (Diode, Zement-/Alu-Widerstand, Power-LED mit Treiber) (WP2b).
 * Erzeugt aus quelle/thmlab/ (Anlagenteil, node quelle/thmlab/build_thmrig_b.js); nicht von Hand aendern. Die gemeinsame Basis steht in thmrig-b-base.js
 * (THM_RIGS.bbase): im Browser NACH thmrig-b-base.js laden, in Node holt sich die Datei sie per require.
 * Abhaengigkeit: THM_CORE (thmcore.js: chain, steady, thermal, pzul, pulseTj, zth, mountControls, mountPresets); THM_DRAW (thmdraw.js) optional (Ansichten, Effekte).
 * Einheiten: Temperaturen in Grad C, Differenzen in K, Zeiten in Prozess-Sekunden (timeScale 30, Anzeige in Prozess-Minuten).
 * Deterministisch (kein Zufall); step, stepProcess und setControl werfen nie. Mit Node ladbar (module.exports = THM_RIGS).
 */
(function (root) {
  'use strict';
  const R = root.THM_RIGS = root.THM_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (typeof module !== 'undefined') module.exports = R;
  if (!R.bbase && typeof require === 'function') { try { require('./thmrig-b-base.js'); } catch (e) { /* Basis fehlt */ } }
  if (!R.bbase) { if (typeof console !== 'undefined') console.warn('thmrig-bauteil.js: thmrig-b-base.js (THM_RIGS.bbase) fehlt (bitte davor laden), der Prüfstand wird nicht registriert.'); return; }
  const {
    TAU, FONT, PALS, COL, MEMBER_COL, ink, themeName, applyTheme, clamp, fin, num, hash, TS, STEP, REC, MAX_FRAME_STEPS, MAX_PROC_STEPS, PMAX,
    MSG_NO, getCore, nk, pick, fmtWith, normChain, stateReader, normSteady, coerce, makeTrace, makeEvents, HEAT, HEAT_LUT, HEAT_STR, heatIdx, heat,
    heatA, heatLum, onHeat, rr, txt, tw, glow, arrow, flowArrow, badge, panel, SYM_FB, symOf, frame, toWorld, plumes, smokePuffs, flame, sparks,
    fxSmoke, fxSparks, fanWheel, HS_VIS, ML, finT, fz, vSchnitt, camLayout, camField, vKamera, ANALOGIE_FB, vErsatz, vBalken, VIEW_FN, drawView,
    KNOB_A0, localKnob, wKnob, localToggle, wToggle, localThermo, wThermo, MOUNT_KEYS, GRP_MOUNT, O, MOUNT_FB, MOUNT_PRESETS_FB, mountPresetList,
    mountDefs, HS_NAME, JOINT_NAME, PASTE_NAME, PKG_OF, SEV, layout, fitText, tmin, worldOf, cfgFrom, makeEngine, DIAG_TEXT, KNOB_SWEEP
  } = R.bbase;

  // ===== Pruefstand 4: bauteil – Diode, Zement-/Alu-Widerstand, Power-LED mit Treiber (SPEC 5.4) =====
  // Die Verlustleistung kommt aus THM_CORE.devices[id].elec (Diode: U0·I + rF·(FF·I)², Widerstand: U²/R, LED: η_th·n·UF·I mit Treiber Vorwiderstand
  // oder LM317-Konstantstrom); fehlt der Kern, rechnet der Pruefstand dieselben Formeln selbst (Rueckfall, test_thmrig_b.js vergleicht beide).
  // Waermekette aus THM_CORE (Diode und Zementwiderstand freistehend, Alu-Widerstand und LED auch am Kuehlkoerper). Uebungswerte: (A) in SPEC Abschnitt 10.
  const ID = 'bauteil';
  // Rueckfallwerte (1N4007 aus dslib-semi.js: UF 0,93 V bei 1 A und 1,05 V bei 3 A, IF(AV) 1 A, Tj,max 175 °C; Widerstaende und LED sind Uebungswerte A12, A13)
  const FB = {
    diode: { u0: 0.87, rf: 0.06, tjMax: 175, ifav: 1 }, zement: { pNom: 5, tMax: 200 }, ralu: { pNom: 50, tMax: 200 },
    led: { uf: 3.2, etaTh: 0.7, tjMax: 125, vref: 1.25, vdo0: 1.5, vdoK: 0.3333, nMax: 4 }, destroyOver: 25, hand: 70
  };
  let ELEC = FB;
  function elecOf(CORE) {
    const D = (id) => { try { return (CORE && CORE.devices && CORE.devices[id]) || {}; } catch (e) { return {}; } }, g = (v, d) => fin(v) ? v : d;
    const di = D('1n4007'), ze = D('r-zement5'), al = D('r-alu50'), le = D('led3w');
    return {
      diode: { u0: g(di.u0, FB.diode.u0), rf: g(di.rF, FB.diode.rf), tjMax: g(di.tjMax, FB.diode.tjMax), ifav: g(di.limits && di.limits.iRec, FB.diode.ifav) },
      zement: { pNom: g(ze.pNenn, g(ze.ptot, FB.zement.pNom)), tMax: g(ze.tjMax, FB.zement.tMax) },
      ralu: { pNom: g(al.pNenn, g(al.ptot, FB.ralu.pNom)), tMax: g(al.tjMax, FB.ralu.tMax) },
      led: { uf: g(le.uf, FB.led.uf), etaTh: g(le.etaTh, FB.led.etaTh), tjMax: g(le.tjMax, FB.led.tjMax), vref: FB.led.vref, vdo0: FB.led.vdo0, vdoK: FB.led.vdoK, nMax: g(le.limits && le.limits.nMax, FB.led.nMax) },
      destroyOver: FB.destroyOver, hand: FB.hand
    };
  }
  const DEVKEY = { diode: '1n4007', rzement: 'r-zement5', ralu: 'r-alu50', led: 'led3w' };
  const DEVNAME = { diode: 'Diode 1N4007 (axial)', rzement: 'Zementwiderstand 5 W', ralu: 'Alu-Gehäusewiderstand 50 W', led: 'Power-LED 3 W auf Sternplatine' };
  const SHAPE = { diode: 'axial', rzement: 'zement', ralu: 'alu', led: 'led' };
  const SHAPENAME = { diode: 'Diodengehäuse', rzement: 'Zementwiderstand', ralu: 'Alu-Gehäuse', led: 'Sternplatine' };
  const E12 = [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
  function e12ceil(r) {
    if (!(r > 0) || !fin(r)) return NaN;
    const dec = Math.pow(10, Math.floor(Math.log10(r))), m = r / dec;
    for (let i = 0; i < E12.length; i++) if (E12[i] >= m - 1e-9) return +(E12[i] * dec).toPrecision(6);
    return 10 * dec;
  }
  const isMount = (d) => d === 'ralu' || d === 'led';
  const devOf = (st) => st && st.device ? st.device : 'diode';
  const LIM = (c) => {
    const d = c.device;
    if (d === 'diode') return { tjMax: ELEC.diode.tjMax, destroyAt: ELEC.diode.tjMax + ELEC.destroyOver, noun: 'Sperrschicht', tempWord: 'Sperrschichttemperatur', pNom: Infinity, freeHint: 'Verkleinere den Strom oder wähle eine Diode mit größerem Gehäuse.' };
    if (d === 'rzement') return { tjMax: ELEC.zement.tMax, destroyAt: ELEC.zement.tMax + ELEC.destroyOver, noun: 'Oberfläche', tempWord: 'Oberflächentemperatur', pNom: ELEC.zement.pNom, freeHint: 'Verkleinere die Verlustleistung oder wähle einen Widerstand mit größerer Nennleistung.' };
    if (d === 'ralu') return { tjMax: ELEC.ralu.tMax, destroyAt: ELEC.ralu.tMax + ELEC.destroyOver, noun: 'Widerstandsschicht', tempWord: 'Schichttemperatur', pNom: ELEC.ralu.pNom, freeHint: 'Der Alu-Widerstand ist für den Betrieb am Kühlkörper gebaut: Montiere ihn auf einen Kühlkörper.' };
    return { tjMax: ELEC.led.tjMax, destroyAt: ELEC.led.tjMax + ELEC.destroyOver, noun: 'Sperrschicht', tempWord: 'Sperrschichttemperatur', pNom: Infinity };
  };
  // Rueckfall-Rechnung (gleiche Formeln wie THM_CORE.devices[id].elec); der LED-Treiberverlust ist wie im Kern der gesamte Verlust des Treibers (Vorwiderstand bzw. LM317 plus Messwiderstand)
  function localElec(c) {
    const d = c.device;
    if (d === 'diode') { const p = ELEC.diode.u0 * c.iF + ELEC.diode.rf * Math.pow(c.ff * c.iF, 2); return { p, uF: ELEC.diode.u0 + ELEC.diode.rf * c.iF, iRms: c.ff * c.iF, iAct: c.iF, pTreiber: 0, pReg: 0, pRs: 0, eta: 0, on: true }; }
    if (d === 'rzement' || d === 'ralu') { const p = c.uR * c.uR / c.rR; return { p, uF: 0, iRms: c.uR / c.rR, iAct: c.uR / c.rR, pTreiber: 0, pReg: 0, pRs: 0, eta: 0, on: true }; }
    const L = ELEC.led, n = c.n, I = c.iLed, ub = c.ub, avail = ub - n * L.uf;
    const o = { p: 0, uF: L.uf, iRms: 0, iAct: 0, pTreiber: 0, pReg: 0, pRs: 0, eta: 0, rv: NaN, rs: NaN, dropout: false, vdo: NaN, noLight: false, headroom: avail, iSet: I, on: false };
    if (!(avail > 0) || !(I > 0)) { o.noLight = true; return o; }
    let iAct = I;
    if (c.driver === 'lm317cc') {
      o.rs = L.vref / I; o.vdo = L.vdo0 + L.vdoK * I;
      if (avail - L.vref < o.vdo) { iAct = Math.max(0, (avail - L.vdo0) / (o.rs + L.vdoK)); o.dropout = true; }
      o.pRs = iAct * iAct * o.rs; o.pReg = (avail - iAct * o.rs) * iAct; o.pTreiber = o.pReg + o.pRs;
    } else { o.rv = e12ceil(avail / I); iAct = avail / o.rv; o.pRs = avail * iAct; o.pTreiber = o.pRs; }
    o.iAct = iAct; o.iRms = iAct; o.p = L.etaTh * n * L.uf * iAct; o.eta = ub * iAct > 0 ? n * L.uf * iAct / (ub * iAct) : 0; o.on = iAct > 0;
    return o;
  }
  const sel = (devs) => (s) => devs.indexOf(devOf(s)) >= 0;

  const OWN = [
    { key: 'device', label: 'Bauteil', type: 'select', value: 'diode', options: [O('diode', 'Diode 1N4007'), O('rzement', 'Zementwiderstand 5 W'), O('ralu', 'Alu-Widerstand 50 W'), O('led', 'Power-LED mit Treiber')], help: 'Welches Bauteil du untersuchst. Beim Wechsel startet der Prüfstand kalt mit den Werten des Bauteils.' },
    { key: 'iF', label: 'Durchlassstrom IF (Mittelwert)', type: 'slider', min: 0, max: 3, step: 0.05, unit: 'A', value: 1, visible: sel(['diode']), help: 'Mittelwert des Stromes durch die Diode. Die Verlustleistung wächst mit dem Strom, bei Impulsen auch mit dem Quadrat des Effektivwertes.' },
    { key: 'ff', label: 'Stromform (Formfaktor FF)', type: 'select', value: 1, options: [O(1, 'Gleichstrom (FF 1)'), O(Math.PI / 2, 'Sinus-Halbwelle (FF 1,571)'), O(3, 'Ladeelko-Impulse (FF 3)')], visible: sel(['diode']), help: 'Formfaktor = Effektivwert geteilt durch Mittelwert. Je spitzer der Strom, desto größer der Effektivwert und desto mehr Verlustleistung im Bahnwiderstand.' },
    { key: 'uR', label: 'Spannung am Widerstand', type: 'slider', min: 1, max: 48, step: 1, unit: 'V', value: 12, visible: sel(['rzement', 'ralu']), help: 'Spannung am Leistungswiderstand. Die Verlustleistung ist U² geteilt durch R.' },
    { key: 'rR', label: 'Widerstandswert R', type: 'slider', min: 1, max: 1000, step: 1, unit: 'Ω', scale: 'log', value: 47, visible: sel(['rzement', 'ralu']), help: 'Widerstandswert. Bei gleicher Spannung gibt ein kleinerer Widerstand mehr Verlustleistung.' },
    { key: 'n', label: 'Anzahl der LEDs in Reihe', type: 'slider', min: 1, max: 4, step: 1, unit: '', value: 3, visible: sel(['led']), help: 'LEDs in Reihe: Ihre Durchlassspannungen addieren sich, der Rest der Betriebsspannung fällt im Treiber ab.' },
    { key: 'ub', label: 'Betriebsspannung Ub', type: 'slider', min: 6, max: 24, step: 1, unit: 'V', value: 24, visible: sel(['led']), help: 'Versorgungsspannung des LED-Treibers. Alles, was nicht an den LEDs abfällt, wird im Treiber zu Wärme.' },
    { key: 'iLed', label: 'LED-Strom (Sollwert)', type: 'slider', min: 0.1, max: 1, step: 0.05, unit: 'A', value: 0.7, visible: sel(['led']), help: 'Gewünschter LED-Strom. Der Vorwiderstand wird nach der E12-Reihe aufgerundet, deshalb fließt etwas weniger.' },
    { key: 'driver', label: 'Treiber', type: 'select', value: 'vorwiderstand', options: [O('vorwiderstand', 'Vorwiderstand (E12)'), O('lm317cc', 'LM317 als Konstantstromquelle')], visible: sel(['led']), help: 'Vorwiderstand: einfach, aber der Strom hängt von der Durchlassspannung ab. LM317 mit Messwiderstand: Der Strom ist 1,25 V geteilt durch R_S, braucht aber Spannungsreserve (Dropout).' }
  ];
  const MET = (key, label, unit, digits, min, max, vis) => ({ key, label, unit, digits, min, max, visible: vis });
  const METERS = [
    MET('p', 'Verlustleistung P (Wärmequelle)', 'W', 2, 0, 60),
    MET('pTreiber', 'Treiberverlust P_Treiber', 'W', 2, 0, 30, sel(['led'])),
    MET('tj', 'Sperrschichttemperatur', '°C', 1, 0, 205),
    MET('tc', 'Gehäusetemperatur', '°C', 1, 0, 205),
    MET('tk', 'Kühlkörpertemperatur', '°C', 1, 0, 205, sel(['ralu', 'led'])),
    MET('tL', 'Temperatur des Anschlussdrahtes T_L', '°C', 1, 0, 205, sel(['diode'])),
    MET('rthTot', 'Gesamt-Wärmewiderstand', 'K/W', 2, 0, 120),
    MET('pzul', 'zulässige Verlustleistung', 'W', 2, 0, 100),
    MET('uF', 'Durchlassspannung U_F', 'V', 2, 0, 5, sel(['diode', 'led'])),
    MET('eta', 'Wirkungsgrad der LED-Schaltung', '%', 1, 0, 100, sel(['led'])),
    MET('dtJC', 'Temperaturabfall Chip–Gehäuse', 'K', 1, 0, 250, sel(['diode', 'ralu', 'led'])),
    MET('dtCK', 'Temperaturabfall Übergang', 'K', 1, 0, 250, sel(['ralu', 'led'])),
    MET('dtK', 'Temperaturabfall zur Luft', 'K', 1, 0, 250)
  ];
  const INFO = 'Übungsanlage: Vier Bauteile, bei denen Wärme entsteht. Die Diode erwärmt sich je nach Stromform stärker, als der Mittelwert vermuten lässt. Der Zementwiderstand und der Alu-Widerstand zeigen die zulässige Leistung über der Umgebungstemperatur (Derating). Bei der Power-LED vergleichst du Vorwiderstand und LM317-Konstantstromquelle als Treiber.';
  const MS = { heatsink: 'none', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus', orient: 'senkrecht', ta: 25 };
  const MSK = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus', orient: 'senkrecht', ta: 25 };
  const LED_JOINT = { direkt: 'direkt (Platine auf Kühlkörper)', glimmer: 'Isolierscheibe', silikon: 'Silikonfolie oder Klebeband' };

  function buildSpec(CORE) {
    ELEC = elecOf(CORE);
    const dvOf = (c) => { try { return CORE && CORE.devices && CORE.devices[DEVKEY[c.device]]; } catch (e) { return null; } };
    let memo = null, memoSig = '';
    function electric(c) {   // THM_CORE.devices[id].elec; Rueckfall: lokale Rechnung
      const sig = c.device + '|' + [c.iF, c.ff, c.uR, c.rR, c.n, c.ub, c.iLed, c.driver].join('|');
      if (memo && memoSig === sig) return memo;
      let out = null;
      const dv = dvOf(c);
      if (dv && typeof dv.elec === 'function') {
        let r = null;
        try {
          if (c.device === 'diode') r = dv.elec({ i: c.iF, ff: c.ff });
          else if (c.device === 'led') r = dv.elec({ n: c.n, ub: c.ub, iLed: c.iLed, driver: c.driver });
          else r = dv.elec({ u: c.uR, r: c.rR });
        } catch (e) { r = null; }
        if (r && r.ok) {
          if (c.device === 'diode') out = { p: r.p, uF: r.uF, iRms: r.irms, iAct: c.iF, pTreiber: 0, pReg: 0, pRs: 0, eta: 0, on: true };
          else if (c.device === 'led') out = { p: r.pTh, uF: ELEC.led.uf, iRms: r.i, iAct: r.i, pTreiber: r.pTreiber, pReg: r.pReg, pRs: r.pRs, eta: r.eta, rv: r.rV, rs: r.rS, dropout: !!r.dropout, vdo: r.vdo, noLight: !!r.noLight, headroom: r.headroom, iSet: c.iLed, on: !r.noLight && r.i > 0 };
          else out = { p: r.p, uF: 0, iRms: r.i, iAct: r.i, pTreiber: 0, pReg: 0, pRs: 0, eta: 0, on: true };
        }
      }
      if (!out) out = localElec(c);
      memo = out; memoSig = sig; return out;
    }
    const steadyP = (c) => ({ ok: true, p: electric(c).p, G: 0, parts: {} });
    const mp = mountPresetList(CORE).map(q => ({ id: q.id, name: 'Alu-Widerstand: ' + q.name, params: Object.assign({ device: 'ralu', uR: 12, rR: 20 }, q.values) }));
    const presets = [
      { id: 'diode1a', name: 'Diode 1 A Gleichstrom', params: Object.assign({ device: 'diode', iF: 1, ff: 1 }, MS) },
      { id: 'dioden-elko', name: 'Diode Ladeelko (FF 3, 1 A)', params: Object.assign({ device: 'diode', iF: 1, ff: 3 }, MS) },
      { id: 'zement47', name: 'Zementwiderstand 12 V an 47 Ω', params: Object.assign({ device: 'rzement', uR: 12, rR: 47 }, MS) },
      { id: 'alu-frei', name: 'Alu-Widerstand ohne Kühlkörper (Fehler)', params: Object.assign({ device: 'ralu', uR: 24, rR: 20 }, MS) },
      { id: 'led-vw', name: 'LED 3 W mit Vorwiderstand (24 V)', params: Object.assign({ device: 'led', n: 3, ub: 24, iLed: 0.7, driver: 'vorwiderstand' }, MSK) },
      { id: 'led-cc', name: 'LED mit LM317 Konstantstrom (24 V)', params: Object.assign({ device: 'led', n: 3, ub: 24, iLed: 0.7, driver: 'lm317cc' }, MSK) }
    ].concat(mp);
    const spec = {
      id: ID, title: 'Bauteil-Prüfstand: Diode, Widerstand, Power-LED (Übungsanlage)', shortTitle: 'Bauteil-Prüfstand', controls: OWN, meterDefs: METERS, presets, info: INFO,
      deviceKey: (c) => DEVKEY[c.device], deviceName: (c) => DEVNAME[c.device], shape: (c) => SHAPE[c.device], shapeName: (c) => SHAPENAME[c.device], singleNode: (c) => c.device === 'rzement',
      cfgOf: (c) => cfgFrom(CORE, c, DEVKEY[c.device], isMount(c.device) ? c.heatsink : 'none'),
      limits: LIM, deviceKeys: ['device'], tjDependent: false, EL: ELEC,
      mountVisible: (key, st) => key === 'ta' || isMount(devOf(st)),
      accept(key, v, c) {
        if (MOUNT_KEYS.indexOf(key) >= 0 && key !== 'ta') { if (!isMount(c.device)) return false; if (key === 'heatsink' && v === 'fahne') return false; }
        return true;
      },
      sync(c, def, key, old, E) {
        const d = c.device, m = isMount(d);
        if (!m) c.heatsink = 'none';
        else if (c.heatsink === 'fahne') c.heatsink = 'none';
        const hs = def.heatsink; if (hs && hs.optionsAll) hs.options = hs.optionsAll.filter(o => m ? o.value !== 'fahne' : o.value === 'none');
        const jt = def.joint; if (jt && jt.optionsAll) jt.options = jt.optionsAll.map(o => d === 'led' && LED_JOINT[o.value] ? Object.assign({}, o, { label: LED_JOINT[o.value] }) : o);
        const hi = LIM(c).tjMax + 30;
        if (E && E.meters) E.meters.forEach(q => { if (q.key === 'tj' || q.key === 'tc' || q.key === 'tk' || q.key === 'tL') q.max = hi; });
      },
      electric, steadyP,
      meterVals(E, S) { const e = E.eNow(); return { p: e.p, pTreiber: e.pTreiber, tL: S.tc, uF: e.uF, eta: e.eta * 100 }; },
      stateExtra(E, S) {
        const c = E.ctl, e = E.eNow(), lm = LIM(c);
        return { pv: e.p, p: e.p, pTreiber: e.pTreiber, pReg: e.pReg || 0, pRs: e.pRs || 0, tL: S.tc, uF: e.uF, eta: e.eta * 100, iAct: e.iAct, iRms: e.iRms, rv: fin(e.rv) ? e.rv : 0, rs: fin(e.rs) ? e.rs : 0, dropout: !!e.dropout, ledOn: c.device !== 'led' || !!e.on, pNom: lm.pNom === Infinity ? 0 : lm.pNom };
      },
      cells(E, S) {
        const c = E.ctl, e = E.eNow(), f = E.fmt, lm = LIM(c), sy = E.SYM;
        if (c.device === 'diode') return [['Verlustleistung P', f(e.p, 2) + ' W', COL.text], ['Durchlassspannung U_F', f(e.uF, 2) + ' V', COL.text], ['Anschlussdraht T_L', f(S.tc, 1) + ' °C', COL.text]];
        if (c.device === 'led') return [['LED-Wärme P_th', f(e.p, 2) + ' W', COL.text], ['Treiberverlust P_Treiber', f(e.pTreiber, 2) + ' W', COL.sw], ['Wirkungsgrad η', f(e.eta * 100, 1) + ' %', COL.text]];
        void sy;
        return [['Verlustleistung P', f(e.p, 2) + ' W', COL.text], ['Nennleistung P_nenn', f(lm.pNom, 0) + ' W', COL.dim], ['U · R', f(c.uR, 0) + ' V · ' + f(c.rR, 0) + ' Ω', COL.text]];
      },
      knobs(E) {
        const c = E.ctl, f = E.fmt;
        if (c.device === 'diode') return [{ key: 'iF', lo: 0, hi: 3, step: 0.05, label: 'Strom IF', unit: 'A', digits: 2, fmt: (v) => f(v, 2) + ' A' }];
        if (c.device === 'led') return [{ key: 'ub', lo: 6, hi: 24, step: 1, label: 'Spannung Ub', unit: 'V', digits: 0, fmt: (v) => f(v, 0) + ' V' }, { key: 'iLed', lo: 0.1, hi: 1, step: 0.05, label: 'LED-Strom', unit: 'A', digits: 2, fmt: (v) => f(v, 2) + ' A' }, { key: 'n', lo: 1, hi: 4, step: 1, label: 'LEDs', unit: '', digits: 0, fmt: (v) => f(v, 0) }];
        return [{ key: 'uR', lo: 1, hi: 48, step: 1, label: 'Spannung U', unit: 'V', digits: 0, fmt: (v) => f(v, 0) + ' V' }, { key: 'rR', lo: 1, hi: 1000, step: 1, log: true, label: 'Widerstand R', unit: 'Ω', digits: 0, fmt: (v) => f(v, 0) + ' Ω' }];
      },
      toggles(E) {
        const c = E.ctl, hs = c.heatsink !== 'none';
        const near = (a, b) => Math.abs(a - b) < 1e-3;
        if (c.device === 'diode') return [{ key: 'ff', label: 'Halbwelle', short: 'Halbw.', isOn: () => near(c.ff, Math.PI / 2), onVal: Math.PI / 2, offVal: 1 }, { key: 'ff', label: 'Ladeelko', short: 'Elko', isOn: () => near(c.ff, 3), onVal: 3, offVal: 1 }];
        if (c.device === 'rzement') return [];
        const out = [];
        if (c.device === 'led') out.push({ key: 'driver', label: 'Konstantstrom', short: 'Konst.', isOn: () => c.driver === 'lm317cc', onVal: 'lm317cc', offVal: 'vorwiderstand' });
        out.push({ key: 'heatsink', label: 'Kühlkörper', short: 'Kühlk.', isOn: () => hs, onVal: 'm', offVal: 'none' });
        if (hs) { out.push({ key: 'paste', label: 'Paste', short: 'Paste', isOn: () => c.paste !== 'keine', onVal: 'duenn', offVal: 'keine' }); if (c.device === 'ralu') out.push({ key: 'joint', label: 'Glimmer', short: 'Glimm.', isOn: () => c.joint !== 'direkt', onVal: 'glimmer', offVal: 'direkt' }); out.push({ key: 'fan', label: 'Lüfter', short: 'Lüfter', isOn: () => c.fan !== 'aus', onVal: 'mittel', offVal: 'aus' }); }
        return out.slice(0, 4);
      },
      // Kontext fuer THM_CORE.diagnose: nur die Diode hat einen Stromgrenzwert im Kern
      coreCtx(X, cx) { const c = X.ctl; if (c.device === 'diode') cx.op = { i: c.iF, ff: c.ff }; cx.tabV = 0; },
      diagPost(X, list, add, del, f, has) {
        const c = X.ctl, e = X.e || electric(c), lm = X.lim;
        if (c.device === 'diode' && c.iF > ELEC.diode.ifav + 1e-9 && !has('i-hoch')) add('i-hoch', 'warn', 'Der Strom liegt über dem empfohlenen Wert (' + f(ELEC.diode.ifav, 0) + ' A).');
        const fz = list.find(d => d.id === 'frei-zu-heiss');
        if (fz && lm.freeHint) fz.text = fz.text.replace(/ Du brauchst einen Kühlkörper\.$/, ' ' + lm.freeHint);
        if (c.device === 'rzement') { del('hand-heiss'); if (X.tj > ELEC.hand && !X.destroyed) add('hand-heiss', 'info', 'Zementwiderstand: Oberfläche ' + f(X.tj, 0) + ' °C: Berührungsgefahr, Nachbarbauteile und Platine werden geschädigt.'); }
        if (c.device === 'led') {
          if (e.noLight) add('led-aus', 'warn', 'Die Betriebsspannung reicht nicht für die Reihenschaltung: Mit ' + f(c.n, 0) + ' LEDs (' + f(c.n * ELEC.led.uf, 1) + ' V) leuchten sie bei ' + f(c.ub, 0) + ' V nicht.');
          else if (e.dropout) add('dropout', 'warn', 'Die Spannung reicht nicht für die Konstantstromquelle: Der LM317 braucht mindestens ' + f(e.vdo, 2) + ' V Differenz (Dropout) und regelt nicht mehr, der LED-Strom sinkt auf ' + f(e.iAct, 2) + ' A.');
          else if (c.driver === 'vorwiderstand' && e.iAct < e.iSet * 0.99) add('e12', 'info', 'Der Vorwiderstand ' + f(e.rv, 0) + ' Ω ist aus der E12-Reihe aufgerundet: Der LED-Strom beträgt ' + f(e.iAct, 3) + ' A statt ' + f(e.iSet, 2) + ' A.');
        }
      },
      curves(E, S) {
        const c = E.ctl, f = E.fmt, e = E.eNow(), ta = c.ta, out = [], lm = LIM(c), pz = E.pzulFor(c, E.cfg), d = c.device;
        // (1) P ueber I (Diode), Parabel (Widerstand) oder Waerme ueber dem LED-Strom
        if (d === 'diode') {
          const s = [], s2 = [];
          for (let i = 0; i <= 30; i++) { const I = 3 * i / 30; s.push([+I.toFixed(3), +electric(Object.assign({}, c, { iF: I })).p.toFixed(4)]); s2.push([+I.toFixed(3), +electric(Object.assign({}, c, { iF: I, ff: 1 })).p.toFixed(4)]); }
          out.push({ id: 'pi', title: 'Verlustleistung über dem Strom', xLabel: 'Strom IF (Mittelwert)', xUnit: 'A', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'Stromform FF = ' + f(c.ff, 3).replace(/0+$/, '').replace(/,$/, ''), points: s }, { name: 'Gleichstrom (FF 1)', points: s2, dashed: true }], marker: { x: c.iF, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        } else if (d === 'led') {
          const s = []; for (let i = 0; i <= 18; i++) { const I = 0.1 + 0.9 * i / 18; s.push([+I.toFixed(3), +electric(Object.assign({}, c, { iLed: I })).p.toFixed(4)]); }
          out.push({ id: 'pi', title: 'Wärmeleistung der LED über dem Strom', xLabel: 'LED-Strom (Sollwert)', xUnit: 'A', yLabel: 'Wärmeleistung P_th', yUnit: 'W', series: [{ name: 'P_th = η_th · n · U_F · I', points: s }], marker: { x: c.iLed, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        } else {
          const s = []; for (let i = 0; i <= 24; i++) { const U = 1 + 47 * i / 24; s.push([+U.toFixed(2), +(U * U / c.rR).toFixed(4)]); }
          out.push({ id: 'pi', title: 'Verlustleistung über der Spannung (Parabel)', xLabel: 'Spannung U', xUnit: 'V', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'P = U² / R bei R = ' + f(c.rR, 0) + ' Ω', points: s }], marker: { x: c.uR, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }, { y: lm.pNom, label: 'P_nenn' }] });
        }
        // (2) Derating ueber Ta
        { const s = []; const tEnd = lm.tjMax; for (let T = 0; T <= tEnd; T += Math.max(5, Math.round(tEnd / 40 / 5) * 5)) s.push([T, +E.pzulFor(Object.assign({}, c, { ta: T }), E.cfg).toFixed(4)]); s.push([tEnd, 0]);
          out.push({ id: 'derating', title: 'Derating: zulässige Verlustleistung über der Umgebungstemperatur', xLabel: 'Umgebungstemperatur Ta', xUnit: '°C', yLabel: 'zulässige Verlustleistung', yUnit: 'W', series: [{ name: 'P_zul(Ta) dieses Aufbaus', points: s }], marker: { x: ta, y: e.p }, hlines: lm.pNom < Infinity ? [{ y: lm.pNom, label: 'P_nenn' }] : [] }); }
        // (3) LED: Treiberverlust ueber Ub fuer beide Treiber; sonst Tj ueber P
        if (d === 'led') {
          const sv = [], sc = [];
          for (let ub = 6; ub <= 24; ub += 1) { sv.push([ub, +electric(Object.assign({}, c, { ub, driver: 'vorwiderstand' })).pTreiber.toFixed(4)]); sc.push([ub, +electric(Object.assign({}, c, { ub, driver: 'lm317cc' })).pTreiber.toFixed(4)]); }
          out.push({ id: 'treiber', title: 'Treiberverlust über der Betriebsspannung', xLabel: 'Betriebsspannung Ub', xUnit: 'V', yLabel: 'Treiberverlust', yUnit: 'W', series: [{ name: 'Vorwiderstand (Strom hängt von U_F ab)', points: sv }, { name: 'LM317 mit Messwiderstand (Konstantstrom ab Dropout)', points: sc, dashed: true }], marker: { x: c.ub, y: e.pTreiber } });
        } else {
          const pmax = Math.max(2, e.p * 1.6, pz * 1.2), chF = E.chainOf(Object.assign({}, c, { heatsink: 'none' })), a = [], rth = chF ? chF.rthTotal : E.ch.rthTotal;
          for (let i = 0; i <= 20; i++) { const P = pmax * i / 20; a.push([+P.toFixed(3), +(ta + P * rth).toFixed(3)]); }
          out.push({ id: 'tjp', title: 'Temperatur über der Verlustleistung', xLabel: 'Verlustleistung P', xUnit: 'W', yLabel: 'Sperrschichttemperatur Tj', yUnit: '°C', series: [{ name: 'freistehend', points: a }], marker: { x: e.p, y: S.tj }, hlines: [{ y: lm.tjMax, label: 'Tj,max' }] });
        }
        // (4) Aufheizkurve
        { const si = E.stNow(), s = []; let tauD = NaN; try { const t2 = E.CORE.thermal(E.cfg); const v = t2.tauDominant(); tauD = typeof v === 'number' ? v : pick(v, ['tau', 'value'], NaN); } catch (x) { tauD = NaN; }
          if (si.ok && fin(tauD)) { try { const t2 = E.CORE.thermal(E.cfg); if (typeof t2.reset === 'function') t2.reset(ta); const rd2 = stateReader(t2.state()), dt = Math.max(1, 5 * tauD / 40); let tt = 0; s.push([0, +ta.toFixed(3)]); for (let i = 0; i < 40; i++) { t2.step(dt, si.p, ta); tt += dt; s.push([+(tt / 60).toFixed(3), +rd2(t2.state())[0].toFixed(3)]); } } catch (x) { /* keine Kurve */ } }
          out.push({ id: 'aufheiz', title: 'Aufheizkurve der Sperrschicht (Prozesszeit)', xLabel: 'Prozesszeit', xUnit: 'min', yLabel: 'Sperrschichttemperatur Tj', yUnit: '°C', series: [{ name: 'Tj(t) aus kalt', points: s }], marker: { x: S.t / 60, y: S.tj }, hlines: [{ y: lm.tjMax, label: 'Tj,max' }] }); }
        return out;
      },
      params: () => ({ diode: ELEC.diode, zement: ELEC.zement, ralu: ELEC.ralu, led: ELEC.led }),
      scene: sceneBau
    };
    return spec;
  }

  // ---------- Szene: je Bauteil ein Bild mit Zahlen ----------
  function sceneRegions(R, L) {
    const w = R.w, h = R.h;
    if (L.portrait) return { art: { x: R.x + 6, y: R.y + 24, w: w * 0.45, h: h - 30 }, info: { x: R.x + w * 0.47 + 6, y: R.y + 26, w: w * 0.53 - 14, h: h - 32 } };
    return { art: { x: R.x + 8, y: R.y + 22, w: w - 16, h: h * 0.5 }, info: { x: R.x + 10, y: R.y + 22 + h * 0.5 + 6, w: w - 20, h: h - 22 - h * 0.5 - 12 } };
  }
  function infoLines(ctx, r, lines) {
    const rh = Math.min(22, r.h / Math.max(1, lines.length));
    lines.forEach((q, i) => {
      const y = r.y + rh * (i + 0.5);
      if (i % 2 === 0) { rr(ctx, r.x - 3, y - rh / 2 + 1, r.w + 6, rh - 2, 4); ctx.fillStyle = ink(0.06); ctx.fill(); }
      txt(ctx, q[0], r.x, y, 12, COL.dim, 'left', '600');
      txt(ctx, q[1], r.x + r.w, y, 12, q[2] || COL.text, 'right', '800');
    });
  }
  function bodyGlow(ctx, x, y, r, D, k) { glow(ctx, x, y, r, HEAT_LUT[heatIdx(D.tc, D.lo, D.hi)].join(','), clamp(k, 0, 1) * 0.7); }
  function waves(ctx, x0, x1, y, n, t, D, col) {
    if (D.reduced) n = Math.min(n, 2);
    for (let i = 0; i < n; i++) {
      const ph = D.reduced ? 0.3 + i * 0.2 : (t / 1500 + i / n) % 1, yy = y - ph * 40, a = (1 - ph) * 0.7;
      ctx.strokeStyle = col.replace('A', a.toFixed(3)); ctx.lineWidth = 2.4; ctx.beginPath();
      for (let k = 0; k <= 10; k++) { const xx = x0 + (x1 - x0) * k / 10, yv = yy + Math.sin(k * 1.3 + i * 2 + (D.reduced ? 0 : t / 300)) * 3; if (k === 0) ctx.moveTo(xx, yv); else ctx.lineTo(xx, yv); }
      ctx.stroke();
    }
  }
  function sceneBau(ctx, R, E, D, t, L) {
    const c = E.ctl, e = E.eNow(), f = E.fmt, g = sceneRegions(R, L), a = g.art, d = c.device, S = E.S, lm = LIM(c), sy = E.SYM;
    const hot = clamp((D.tc - D.ta) / ((D.hi - D.ta) || 1), 0, 1);
    txt(ctx, DEVNAME[d], R.x + 12, R.y + 14, 13, COL.text, 'left', '800');
    const cx = a.x + a.w / 2, cy = a.y + a.h * (d === 'diode' ? 0.34 : 0.5);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (d === 'diode') {
      bodyGlow(ctx, cx, cy, Math.min(a.w, 130) * 0.55, D, hot * 1.6);
      const bw = Math.min(a.w * 0.46, 92), bh = 24;
      ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, cy); ctx.lineTo(cx - bw / 2, cy); ctx.moveTo(cx + bw / 2, cy); ctx.lineTo(a.x + a.w, cy); ctx.stroke();
      ctx.fillStyle = '#c9d4de'; [a.x + 4, a.x + a.w - 4].forEach(x => { ctx.beginPath(); ctx.arc(x, cy, 3.5, 0, TAU); ctx.fill(); });
      const gb = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2); gb.addColorStop(0, '#3a424c'); gb.addColorStop(1, '#14181d');
      ctx.fillStyle = gb; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 8); ctx.fill();
      ctx.fillStyle = heatA(D.tc, D.lo, D.hi, 0.55); rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 8); ctx.fill();
      ctx.fillStyle = '#d7dee6'; ctx.fillRect(cx + bw / 2 - 14, cy - bh / 2 + 1, 8, bh - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 8); ctx.stroke();
      arrow(ctx, a.x + 8, cy - 22, a.x + 34, cy - 22, COL.acc, 3, 9); txt(ctx, 'I', a.x + 44, cy - 22, 13, COL.acc, 'left', '800');
      txt(ctx, 'Anode', a.x + 4, cy + 18, 12, COL.dim, 'left', '600'); txt(ctx, 'Kathode', a.x + a.w - 4, cy + 18, 12, COL.dim, 'right', '600');
      // Stromform: Gleichstrom, Halbwelle oder Ladeelko-Impulse (Mittelwert gleich, Effektivwert unterschiedlich)
      const wx = a.x + 4, ww = a.w - 8, wy = cy + 34, wh = Math.max(24, a.h * 0.38), ff = c.ff, base = wy + wh - 4, amp = wh - 14;
      ctx.fillStyle = ink(0.06); rr(ctx, wx, wy, ww, wh, 5); ctx.fill();
      ctx.strokeStyle = COL.text; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const u = i / 60 * 2 % 1; let v;
        if (ff < 1.2) v = 0.55; else if (ff < 2) v = u < 0.5 ? Math.sin(u * 2 * Math.PI) : 0; else v = u > 0.1 && u < 0.3 ? Math.sin((u - 0.1) / 0.2 * Math.PI) : 0;
        const x = wx + 4 + (ww - 8) * i / 60, y = base - v * amp;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      txt(ctx, fitText('Stromform: ' + (ff < 1.2 ? 'Gleichstrom' : ff < 2 ? 'Halbwelle' : 'Ladeelko-Impulse') + ', FF = ' + f(ff, 3).replace(/0+$/, '').replace(/,$/, ''), ww - 8, 12, '600'), wx + 4, wy + 10, 12, COL.dim, 'left', '600');
      infoLines(ctx, g.info, [['Mittelwert IF', f(c.iF, 2) + ' A'], ['Effektivwert FF · IF', f(e.iRms, 2) + ' A'], ['Durchlassspannung U_F', f(e.uF, 2) + ' V'], ['Verlustleistung P', f(e.p, 2) + ' W', COL.warn], [sy.tc + ' = T_L (Draht)', f(S.tc, 1) + ' °C']]);
    } else if (d === 'rzement' || d === 'ralu') {
      const alu = d === 'ralu', bw = Math.min(a.w * 0.62, alu ? 120 : 130), bh = alu ? a.h * 0.56 : 34;
      bodyGlow(ctx, cx, cy, Math.min(a.w, 140) * 0.6, D, hot * 1.5);
      ctx.strokeStyle = '#b9c2cc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, cy); ctx.lineTo(cx - bw / 2, cy); ctx.moveTo(cx + bw / 2, cy); ctx.lineTo(a.x + a.w, cy); ctx.stroke();
      if (alu) {
        const gb = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2); gb.addColorStop(0, '#aeb9c4'); gb.addColorStop(1, '#6f7c89');
        ctx.fillStyle = gb; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 5); ctx.fill();
        ctx.fillStyle = heatA(D.tc, D.lo, D.hi, 0.55); rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 5); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(cx - bw / 2 + 6, cy - bh / 2 + bh * i / 6); ctx.lineTo(cx + bw / 2 - 6, cy - bh / 2 + bh * i / 6); ctx.stroke(); }
        ctx.fillStyle = '#c9d4de'; [cx - bw / 2 - 8, cx + bw / 2 + 8].forEach(x => { ctx.beginPath(); ctx.arc(x, cy, 4, 0, TAU); ctx.fill(); });
      } else {
        const gb = ctx.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2); gb.addColorStop(0, '#e9dcc0'); gb.addColorStop(1, '#bda97c');
        ctx.fillStyle = gb; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 6); ctx.fill();
        ctx.fillStyle = heatA(D.tc, D.lo, D.hi, 0.5); rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 6); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; rr(ctx, cx - bw / 2, cy - bh / 2, bw, bh, alu ? 5 : 6); ctx.stroke();
      txt(ctx, f(c.rR, 0) + ' Ω', cx, cy - 4, 13, '#10151a', 'center', '800'); txt(ctx, (alu ? '50' : '5') + ' W', cx, cy + 11, 12, '#10151a', 'center', '800');
      if (e.p > 0) waves(ctx, cx - bw / 2 + 10, cx + bw / 2 - 10, cy - bh / 2 - 4, Math.min(6, 2 + Math.round(e.p / Math.max(1, lm.pNom) * 6)), t, D, 'rgba(255,170,90,A)');
      // Leistung gegen zulaessige Leistung (weisse Marke)
      const by = a.y + a.h - 24, bwid = a.w - 8, pz = E.pzulFor(c, E.cfg), top = Math.max(e.p, pz, lm.pNom) * 1.1 || 1;
      ctx.fillStyle = ink(0.08); rr(ctx, a.x + 4, by, bwid, 14, 5); ctx.fill();
      ctx.fillStyle = e.p > pz + 1e-9 ? COL.bad : COL.ok; rr(ctx, a.x + 4, by, Math.max(2, bwid * e.p / top), 14, 5); ctx.fill();
      ctx.strokeStyle = COL.text; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x + 4 + bwid * pz / top, by - 3); ctx.lineTo(a.x + 4 + bwid * pz / top, by + 17); ctx.stroke();
      txt(ctx, fitText('P gegen P_zul (Marke)', a.w - 8, 12, '600'), a.x + 4, by - 8, 12, COL.dim, 'left', '600');
      infoLines(ctx, g.info, [['Verlustleistung P', f(e.p, 2) + ' W', COL.warn], ['zulässig P_zul bei ' + f(c.ta, 0) + ' °C', f(pz, 2) + ' W', e.p > pz + 1e-9 ? COL.bad : COL.ok], ['Nennleistung', f(lm.pNom, 0) + ' W'], [alu ? 'Schichttemperatur' : 'Oberfläche', f(S.tj, 0) + ' °C'], ['Reserve zur Grenze', f(lm.tjMax - S.tj, 0) + ' K']]);
    } else {
      const m = e, b = m.on ? clamp(m.iAct / 1.0 * (1 - 0.0035 * Math.max(0, D.tj - 25)), 0, 1) : 0;
      // Lichtfaecher (Helligkeit nur optisch, ohne Zahl)
      const lr = Math.min(a.h * 0.3, 30), lcx = a.x + a.w * 0.32, lcy = a.y + a.h * 0.52;
      if (b > 0.02) { for (let i = -3; i <= 3; i++) { const an = -Math.PI / 2 + i * 0.32, r0 = lr + 4, r1 = lr + 10 + 30 * b; ctx.strokeStyle = 'rgba(255,214,90,' + (0.35 + 0.65 * b).toFixed(3) + ')'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(lcx + Math.cos(an) * r0, lcy + Math.sin(an) * r0); ctx.lineTo(lcx + Math.cos(an) * r1, lcy + Math.sin(an) * r1); ctx.stroke(); } glow(ctx, lcx, lcy, lr * 2.4, '255,226,120', 0.5 * b); }
      ctx.beginPath(); ctx.arc(lcx, lcy, lr + 8, 0, TAU); ctx.fillStyle = '#aab5c0'; ctx.fill(); ctx.fillStyle = heatA(D.tc, D.lo, D.hi, 0.6); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 1.4; ctx.stroke();
      ctx.beginPath(); ctx.arc(lcx, lcy, lr * 0.6, 0, TAU); ctx.fillStyle = b > 0.02 ? 'rgba(255,248,200,' + (0.5 + 0.5 * b).toFixed(3) + ')' : '#2c333b'; ctx.fill(); ctx.strokeStyle = '#e8eef4'; ctx.lineWidth = 1.6; ctx.stroke();
      txt(ctx, m.on ? 'LED leuchtet' : 'LED aus', lcx, lcy + lr + 22, 12, m.on ? COL.ok : COL.warn, 'center', '700');
      // Treiber als Reihenschaltung: Ub - Treiber - n LEDs
      const rx = a.x + a.w * 0.64, ry = a.y + a.h * 0.2, rw = a.w * 0.34;
      ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + rw, ry); ctx.moveTo(rx + rw / 2, ry); ctx.lineTo(rx + rw / 2, ry + 8); ctx.stroke();
      rr(ctx, rx + rw / 2 - 22, ry + 8, 44, 18, 3); ctx.fillStyle = COL.panel2; ctx.fill(); ctx.strokeStyle = c.driver === 'lm317cc' ? COL.acc : COL.sw; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, c.driver === 'lm317cc' ? 'LM317' : 'R_V', rx + rw / 2, ry + 17, 12, COL.text, 'center', '800');
      ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(rx + rw / 2, ry + 26); ctx.lineTo(rx + rw / 2, ry + 34); ctx.stroke();
      for (let i = 0; i < c.n; i++) { const yy = ry + 36 + i * 12; ctx.beginPath(); ctx.moveTo(rx + rw / 2 - 5, yy); ctx.lineTo(rx + rw / 2 + 5, yy); ctx.lineTo(rx + rw / 2, yy + 8); ctx.closePath(); ctx.fillStyle = m.on ? 'rgba(255,226,120,0.85)' : '#2c333b'; ctx.fill(); ctx.strokeStyle = '#e8eef4'; ctx.lineWidth = 1.2; ctx.stroke(); }
      txt(ctx, 'Ub ' + f(c.ub, 0) + ' V', rx, ry - 9, 12, COL.dim, 'left', '700');
      infoLines(ctx, g.info, [['LED-Strom', f(m.iAct, 3) + ' A' + (c.driver === 'vorwiderstand' && m.iAct < m.iSet * 0.99 ? ' (Soll ' + f(m.iSet, 2) + ')' : '')], [c.driver === 'lm317cc' ? 'Messwiderstand R_S' : 'Vorwiderstand R_V (E12)', c.driver === 'lm317cc' ? f(m.rs, 2) + ' Ω' : (fin(m.rv) ? f(m.rv, 0) + ' Ω' : '–')], ['Treiberverlust', f(m.pTreiber, 2) + ' W', COL.sw], ['LED-Wärme P_th', f(m.p, 2) + ' W', COL.warn], ['Wirkungsgrad η', f(m.eta * 100, 1) + ' %']]);
    }
    if (D.smoke > 0) fxSmoke(ctx, cx, cy - 14, t, D.smoke * 0.7, D.reduced);
    if (D.destroyed) flame(ctx, cx, cy, t, 0.8);
  }

  const SPEC0 = buildSpec({});
  R.register({ id: ID, name: 'Diode, Widerstand, Power-LED', icon: '💡', info: INFO, controls: SPEC0.controls.concat(mountDefs({}, SPEC0)), meters: METERS, presets: SPEC0.presets, create(opts) { const CORE = getCore(); return makeEngine(CORE, buildSpec(CORE), opts || {}); } });

})(typeof window !== 'undefined' ? window : globalThis);
