/* thmrig-mosfet.js - Thermik-Lab, Pruefstand mosfet (MOSFET als Schalter, IRLZ34N) (WP2b).
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
  if (!R.bbase) { if (typeof console !== 'undefined') console.warn('thmrig-mosfet.js: thmrig-b-base.js (THM_RIGS.bbase) fehlt (bitte davor laden), der Prüfstand wird nicht registriert.'); return; }
  const {
    TAU, FONT, PALS, COL, MEMBER_COL, ink, themeName, applyTheme, clamp, fin, num, hash, TS, STEP, REC, MAX_FRAME_STEPS, MAX_PROC_STEPS, PMAX,
    MSG_NO, getCore, nk, pick, fmtWith, normChain, stateReader, normSteady, coerce, makeTrace, makeEvents, HEAT, HEAT_LUT, HEAT_STR, heatIdx, heat,
    heatA, heatLum, onHeat, rr, txt, tw, glow, arrow, flowArrow, badge, panel, SYM_FB, symOf, frame, toWorld, plumes, smokePuffs, flame, sparks,
    fxSmoke, fxSparks, fanWheel, HS_VIS, ML, finT, fz, vSchnitt, camLayout, camField, vKamera, ANALOGIE_FB, vErsatz, vBalken, VIEW_FN, drawView,
    KNOB_A0, localKnob, wKnob, localToggle, wToggle, localThermo, wThermo, MOUNT_KEYS, GRP_MOUNT, O, MOUNT_FB, MOUNT_PRESETS_FB, mountPresetList,
    mountDefs, HS_NAME, JOINT_NAME, PASTE_NAME, PKG_OF, SEV, layout, fitText, tmin, worldOf, cfgFrom, makeEngine, DIAG_TEXT, KNOB_SWEEP
  } = R.bbase;

  // ===== Pruefstand 3: mosfet – MOSFET als Schalter (IRLZ34N), SPEC 5.3 =====
  // Verlustleistung: P_leit = D·I²·RDS(on)(Tj), P_sw = ½·U·I·(tr + tf)·f (nur beim Schalten, 0 < D < 1), P = P_leit + P_sw.
  // Waerme: THM_CORE.chain/steady/thermal (exakter Schritt); die Rueckkopplung RDS(on)(Tj) wird im Kernschritt h = 0,25 s nachgefuehrt,
  // der Beharrungswert ist die geschlossene Loesung P = (P_leit,25·(1 + α·(Ta − 25)) + P_sw)/(1 − G), G = P_leit,25·α·Rth_ges (G >= 1: Weglaufen).
  const ID = 'mosfet';
  // Zahlen aus dslib-semi.js (tf-irlz): RDS(on) typ/max bei VGS 4,5/5/10 V, tr, tf bei VDD 28 V, RG 4,5 Ω; α aus dem Faktor 1,65 bei 125 °C (test_thmrig_b.js prueft)
  const FB = {
    rds: { typ: { '4.5': 0.040, '5': 0.037, '10': 0.028 }, max: { '4.5': 0.050, '5': 0.046, '10': 0.035 } },
    alpha: 0.65 / 100, tr: 100e-9, tf: 45e-9, tjMax: 175, destroyAt: 200, idRec: 20, idm: 100, idmTp: 80e-6, vdsRec: 44, vdsAbs: 55
  };
  // Werte aus THM_CORE.devices.irlz34n (einzige Quelle); fehlt der Kern, gelten die Datenblattwerte FB (test_thmrig_b.js vergleicht beide)
  function elecOf(CORE) {
    let dv = {}; try { dv = (CORE && CORE.devices && CORE.devices.irlz34n) || {}; } catch (e) { dv = {}; }
    const lim = dv.limits || {}, g = (v, d) => fin(v) ? v : d;
    return {
      rds: { typ: Object.assign({}, FB.rds.typ, dv.rdsTyp), max: Object.assign({}, FB.rds.max, dv.rdsMax) },
      alpha: g(dv.alpha, FB.alpha), tr: g(dv.tr, FB.tr), tf: g(dv.tf, FB.tf), tjMax: g(dv.tjMax, FB.tjMax), destroyAt: g(dv.destroyAt, FB.destroyAt),
      idRec: g(lim.iRec, FB.idRec), idm: FB.idm, idmTp: FB.idmTp, vdsRec: g(lim.vdsRec, FB.vdsRec), vdsAbs: g(lim.vdsAbs, FB.vdsAbs)
    };
  }
  let ELEC = FB;
  const VGS_OPT = [O(4.5, '4,5 V'), O(5, '5 V'), O(10, '10 V')];
  const F_OPT = [O(100, '100 Hz'), O(1000, '1 kHz'), O(20000, '20 kHz'), O(100000, '100 kHz')];
  const TP_OPT = [O(0.001, '1 ms'), O(0.01, '10 ms'), O(0.1, '100 ms'), O(1, '1 s')];
  const TP_PER = [O(0.01, '10 ms'), O(0.1, '100 ms'), O(1, '1 s'), O(10, '10 s')];
  const OWN = [
    { key: 'id', label: 'Laststrom ID', type: 'slider', min: 0, max: 20, step: 0.5, unit: 'A', value: 5, help: 'Strom durch den eingeschalteten MOSFET. Die Leitverluste wachsen mit dem Quadrat des Stromes: Doppelter Strom gibt vierfache Verlustleistung.' },
    { key: 'u', label: 'Betriebsspannung U', type: 'slider', min: 5, max: 44, step: 1, unit: 'V', value: 24, help: 'Spannung am Schalter im ausgeschalteten Zustand. Sie bestimmt die Schaltverluste, nicht die Leitverluste.' },
    { key: 'duty', label: 'Tastgrad D', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 100, visible: (s) => !s.pulse, help: 'Anteil der Periode, in dem der MOSFET leitet. 100 % ist Dauerlast ohne Schalten, darunter schaltet er mit der gewählten Frequenz.' },
    { key: 'f', label: 'Schaltfrequenz f', type: 'select', value: 20000, options: F_OPT, visible: (s) => !s.pulse && s.duty < 100, help: 'Schaltfrequenz der PWM. Bei jedem Schaltvorgang entstehen Verluste: Die Schaltverluste wachsen linear mit f.' },
    { key: 'vgs', label: 'Gate-Spannung VGS', type: 'select', value: 5, options: VGS_OPT, help: 'Steuerspannung am Gate (Betriebswert, nicht die Schwellspannung). Je größer VGS, desto kleiner RDS(on).' },
    { key: 'spec', label: 'RDS(on) aus dem Datenblatt', type: 'select', value: 'typ', options: [O('typ', 'typisch (typ.)'), O('max', 'Höchstwert (max.), Prüfungsauslegung')], help: 'Typischer Wert oder Höchstwert aus dem Datenblatt. Mit dem Höchstwert rechnest du auf der sicheren Seite.' },
    { key: 'hot', label: 'RDS(on) steigt mit Tj', type: 'switch', value: true, help: 'An: RDS(on) wächst mit der Sperrschichttemperatur (Faktor 1,65 bei 125 °C). Aus: Du rechnest mit dem kalten Wert.' },
    { key: 'pulse', label: 'Impulsbetrieb', type: 'switch', value: false, help: 'Vertiefung: Die Last kommt als Impuls (Dauer tp, Periode T) statt als Dauerbetrieb. Die Simulation läuft mit der mittleren Leistung, die Spitze steht im Messgerät.' },
    { key: 'tp', label: 'Impulsdauer tp', type: 'select', value: 0.001, options: TP_OPT, visible: (s) => !!s.pulse, help: 'Dauer eines Impulses.' },
    { key: 'T', label: 'Periode T', type: 'select', value: 0.1, options: TP_PER, visible: (s) => !!s.pulse, help: 'Zeit von Impuls zu Impuls. Ist tp so lang wie T, ist es Dauerbetrieb.' }
  ];
  const METERS = [
    { key: 'pLeit', label: 'Leitverluste P_leit', unit: 'W', digits: 2, min: 0, max: 40 },
    { key: 'pSw', label: 'Schaltverluste P_sw', unit: 'W', digits: 2, min: 0, max: 10 },
    { key: 'pTotal', label: 'Verlustleistung P', unit: 'W', digits: 2, min: 0, max: 40 },
    { key: 'rdsHot', label: 'RDS(on) bei Tj', unit: 'Ω', digits: 3, min: 0, max: 0.2 },
    { key: 'tj', label: 'Sperrschichttemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'tc', label: 'Gehäusetemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'tk', label: 'Kühlkörpertemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30 },
    { key: 'rthTot', label: 'Gesamt-Wärmewiderstand', unit: 'K/W', digits: 2, min: 0, max: 100 },
    { key: 'pzul', label: 'zulässige Verlustleistung', unit: 'W', digits: 2, min: 0, max: 100 },
    { key: 'G', label: 'Schleifenverstärkung G', unit: '', digits: 2, min: 0, max: 3 },
    { key: 'dtJC', label: 'Temperaturabfall Chip–Gehäuse', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'dtCK', label: 'Temperaturabfall Übergang', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'dtK', label: 'Temperaturabfall Kühlkörper–Luft', unit: 'K', digits: 1, min: 0, max: 250 },
    { key: 'tjPeak', label: 'Spitzen-Sperrschichttemperatur', unit: '°C', digits: 1, min: 0, max: FB.tjMax + 30, visible: (s) => !!s.pulse }
  ];
  const INFO = 'Übungsanlage: MOSFET IRLZ34N als Schalter. Verlustleistung = Leitverluste (Strom² · RDS(on), RDS(on) steigt mit der Temperatur) plus Schaltverluste (wachsen mit der Frequenz). Zu wenig Kühlung führt zur thermischen Mitkopplung: Die Temperatur läuft weg. Probiere Strom, Frequenz, Kühlkörper und den Impulsbetrieb.';
  const MS = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus', orient: 'senkrecht', ta: 25 };
  const P_BASE = (o) => Object.assign({ id: 10, u: 24, duty: 100, f: 20000, vgs: 5, spec: 'typ', hot: true, pulse: false }, MS, o);

  // Betriebspunkt (Strom, Tastgrad, Frequenz) aus den Steuerwerten; Impulsbetrieb = Tastgrad tp/T und Frequenz 1/T
  function opPoint(c) {
    if (c.pulse) { const D = Math.min(1, c.tp / c.T); return { I: c.id, D, f: 1 / c.T, U: c.u, cont: c.tp >= c.T }; }
    return { I: c.id, D: clamp(c.duty / 100, 0, 1), f: c.f, U: c.u, cont: c.duty >= 100 };
  }
  const rds25Of = (c) => ELEC.rds[c.spec === 'max' ? 'max' : 'typ'][String(c.vgs)] || ELEC.rds.typ['5'];
  const alphaOf = (c) => c.hot ? ELEC.alpha : 0;
  function pSwOf(c, op) { return op.D > 0 && op.D < 1 ? 0.5 * op.U * op.I * (ELEC.tr + ELEC.tf) * op.f : 0; }
  function electric(c, tj) {
    const op = opPoint(c), r25 = rds25Of(c), rds = r25 * Math.max(0.1, 1 + alphaOf(c) * (tj - 25));
    const pLeit = op.D * op.I * op.I * rds, pSw = pSwOf(c, op);
    return { p: pLeit + pSw, pLeit, pSw, rds, op };
  }
  function steadyP(c, ta, rth) {
    const op = opPoint(c), r25 = rds25Of(c), al = alphaOf(c), pl25 = op.D * op.I * op.I * r25, pSw = pSwOf(c, op), G = pl25 * al * rth;
    if (G >= 1) return { ok: false, runaway: true, G, p: 0, why: 'Thermische Mitkopplung' };
    const p = (pl25 * (1 + al * (ta - 25)) + pSw) / (1 - G);
    return { ok: true, p, G, parts: { pLeit: p - pSw, pSw } };
  }

  function buildSpec(CORE) {
    ELEC = elecOf(CORE);
    const mp = mountPresetList(CORE).map(q => ({ id: q.id, name: q.name, params: Object.assign({ id: 5, u: 24, duty: 100, vgs: 5, spec: 'typ', hot: true, pulse: false }, q.values) }));
    const presets = [
      { id: 'dauer10', name: 'Dauerlast 10 A, 5 V Gate', params: P_BASE({ u: 12 }) },
      { id: 'pwm20k', name: 'PWM 20 kHz, 10 A, 24 V', params: P_BASE({ duty: 50, f: 20000, u: 24 }) },
      { id: 'rdsmax', name: 'RDS(on) max statt typ', params: P_BASE({ spec: 'max', u: 12 }) },
      { id: 'mitkopplung', name: 'Mitkopplung (kleiner Kühlkörper, 18 A)', params: P_BASE({ id: 18, u: 12, heatsink: 's' }) },
      { id: 'impuls100', name: 'Impuls 100 A, 1 ms, 100 ms', params: P_BASE({ pulse: true, id: 100, u: 24, tp: 0.001, T: 0.1 }) }
    ].concat(mp);
    const spec = {
      id: ID, title: 'MOSFET-Prüfstand: IRLZ34N als Schalter (Übungsanlage)', shortTitle: 'MOSFET-Prüfstand', controls: OWN, meterDefs: METERS, presets, info: INFO,
      deviceKey: () => 'irlz34n', deviceName: () => 'IRLZ34N (TO-220)', shape: () => 'to220', shapeName: () => 'TO-220-Gehäuse', singleNode: () => false,
      cfgOf: (c) => cfgFrom(CORE, c, 'irlz34n', c.heatsink),
      limits: () => ({ tjMax: ELEC.tjMax, destroyAt: ELEC.destroyAt, noun: 'Sperrschicht', tempWord: 'Sperrschichttemperatur', pNom: Infinity }),
      mountVisible: () => true,
      fahneV: (c) => c.u,
      potText: (c) => 'am Drain (bis zu ' + fmtWith(CORE)(c.u, 0) + ' V) und berührt den Kühlkörper, der an Masse liegt',
      electric, steadyP, tjDependent: true, EL: ELEC,
      noSteadyText: (si, f) => si.runaway ? 'Es gibt keinen Beharrungszustand: Mit G = ' + f(si.G, 2) + ' (mindestens 1) läuft die Temperatur weg.' : 'Es gibt keinen Beharrungszustand.',
      sync(c, def) { const mx = c.pulse ? ELEC.idm : ELEC.idRec; def.id.max = mx; def.id.step = c.pulse ? 5 : 0.5; if (c.id > mx) c.id = mx; },
      resetDefs(c, def) { def.id.max = ELEC.idRec; def.id.step = 0.5; },
      meterVals(E, S) {
        const c = E.ctl, e = E.eNow(), si = E.stNow();
        let peak = S.tj;
        if (c.pulse && si.ok) {
          const op = opPoint(c), ppk = op.I * op.I * rds25Of(c) * (1 + alphaOf(c) * (si.tj - 25));
          try { const r = CORE.pulseTj(E.cfg, ppk, c.tp, c.T, c.ta); const v = typeof r === 'number' ? r : pick(r, ['tj', 'value'], NaN); if (fin(v)) peak = v; } catch (x) { peak = S.tj; }
        }
        return { pLeit: e.pLeit, pSw: e.pSw, pTotal: e.p, rdsHot: e.rds, G: si.G || 0, tjPeak: peak };
      },
      stateExtra(E, S) {
        const c = E.ctl, e = E.eNow(), op = opPoint(c), si = E.stNow(), m = E.readMeters();
        return { pv: e.p, pLeit: e.pLeit, pSw: e.pSw, pTotal: e.p, rdsHot: e.rds, rds25: rds25Of(c), alpha: alphaOf(c), G: si.G || 0, dEff: op.D, fEff: op.f, tjAvg: S.tj, tjPeak: m.tjPeak, ip: op.I, spec: c.spec };
      },
      cells(E, S) { const e = E.eNow(), f = E.fmt; return [['Verlustleistung P', f(e.p, 2) + ' W', COL.text], ['Leitverluste P_leit', f(e.pLeit, 2) + ' W', COL.leit], ['Schaltverluste P_sw', f(e.pSw, 2) + ' W', COL.sw]]; },
      knobs(E) {
        const c = E.ctl, f = E.fmt, k = [{ key: 'id', lo: 0, hi: E.def.id.max, step: E.def.id.step, label: 'Strom I_D', unit: 'A', digits: c.pulse ? 0 : 1, fmt: (v) => f(v, c.pulse ? 0 : 1) + ' A' }, { key: 'u', lo: 5, hi: 44, step: 1, label: 'Spannung U', unit: 'V', digits: 0, fmt: (v) => f(v, 0) + ' V' }];
        if (!c.pulse) k.push({ key: 'duty', lo: 0, hi: 100, step: 1, label: 'Tastgrad D', unit: '%', digits: 0, fmt: (v) => f(v, 0) + ' %' });
        return k;
      },
      toggles(E) {
        const c = E.ctl, hs = c.heatsink !== 'none', out = [{ key: 'heatsink', label: 'Kühlkörper', short: 'Kühlk.', isOn: () => hs, onVal: 'm', offVal: 'none' }];
        if (hs) out.push({ key: 'paste', label: 'Paste', short: 'Paste', isOn: () => c.paste !== 'keine', onVal: 'duenn', offVal: 'keine' }, { key: 'joint', label: 'Glimmer', short: 'Glimmer', isOn: () => c.joint !== 'direkt', onVal: 'glimmer', offVal: 'direkt' }, { key: 'fan', label: 'Lüfter', short: 'Lüfter', isOn: () => c.fan !== 'aus', onVal: 'mittel', offVal: 'aus' });
        return out;
      },
      // Kontext fuer THM_CORE.diagnose: Betriebspunkt (Grenzwerte), Fahnenspannung nur bei Kontakt, Mitkopplung
      coreCtx(X, cx) {
        const c = X.ctl, op = opPoint(c);
        cx.op = { i: c.id, d: op.D, u: c.u, f: op.f, vgs: c.vgs, spec: c.spec, tj: X.tj, hot: c.hot };
        cx.tabV = X.cfg.heatsink !== 'none' && (c.joint === 'direkt' || c.bushing === false) ? c.u : 0;
        if (X.steady && X.steady.runaway) cx.runaway = true;
      },
      diagPost(X, list, add, del, f, has) {
        const c = X.ctl, si = X.steady, sy = X.sym || {};
        if (si && si.runaway && !X.destroyed && !has('runaway')) add('runaway', 'error', 'Thermische Mitkopplung: RDS(on) steigt mit der Temperatur schneller, als der Kühlkörper die zusätzliche Wärme abführt. Die Temperatur läuft weg.');
        if (c.pulse) {
          del('i-hoch');
          if (c.id > ELEC.idRec + 1e-9) add('puls-idm', 'info', 'Der Impulsstrom liegt über dem empfohlenen Dauerwert (' + f(ELEC.idRec, 0) + ' A): Der Datenblattwert IDM = ' + f(ELEC.idm, 0) + ' A gilt nur für Impulse bis ' + f(ELEC.idmTp * 1e6, 0) + ' µs.');
          if (c.tp >= c.T) add('puls-dauer', 'info', 'Der Impuls ist so lang wie die Periode: Das ist Dauerbetrieb.');
        } else if (!has('i-hoch') && c.id > ELEC.idRec + 1e-9) add('i-hoch', 'warn', 'Der Strom liegt über dem empfohlenen Wert (' + f(ELEC.idRec, 0) + ' A).');
        if (c.u > ELEC.vdsAbs + 1e-9) { if (!has('ue-abs')) add('ue-abs', 'error', 'Die Spannung am Schalter (' + f(c.u, 0) + ' V) liegt über dem absoluten Grenzwert (' + f(ELEC.vdsAbs, 0) + ' V): Das Bauteil kann beschädigt werden.'); }
        else if (c.u > ELEC.vdsRec + 1e-9 && !has('ue-hoch')) add('ue-hoch', 'warn', 'Die Spannung am Schalter (' + f(c.u, 0) + ' V) liegt über dem empfohlenen Wert (' + f(ELEC.vdsRec, 0) + ' V).');
        if (c.spec === 'typ' && !(si && si.runaway) && !X.destroyed) {
          let s2 = null; try { s2 = X.steadyOf ? X.steadyOf(Object.assign({}, c, { spec: 'max' })) : null; } catch (e) { s2 = null; }
          if (s2 && s2.ok && s2.tj > X.lim.tjMax && X.tj <= X.lim.tjMax) add('spec', 'info', 'Mit RDS(on,max) rechnest du auf der sicheren Seite: Dann läge ' + (sy.tj || 'Tj') + ' bei ' + f(s2.tj, 1) + ' °C.');
        }
      },
      curves(E, S) {
        const c = E.ctl, f = E.fmt, op = opPoint(c), r25 = rds25Of(c), al = alphaOf(c) || ELEC.alpha, e = E.eNow(), ta = c.ta;
        const out = [], nI = 40, imax = E.def.id.max, pz = E.pzulFor(c, E.cfg);
        const pAt = (I, rds, ff) => { const o2 = Object.assign({}, op, { I }); return o2.D * I * I * rds + pSwOf(c, Object.assign({}, o2, { f: ff == null ? op.f : ff })); };
        const s1 = [], s2 = [], s3 = [];
        for (let i = 0; i <= nI; i++) { const I = imax * i / nI; s1.push([+I.toFixed(3), +pAt(I, r25).toFixed(4)]); s2.push([+I.toFixed(3), +pAt(I, r25 * (1 + al * 100)).toFixed(4)]); }
        out.push({ id: 'pi', title: 'Verlustleistung über dem Strom', xLabel: 'Strom I_D', xUnit: 'A', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'RDS(on) bei 25 °C', points: s1 }, { name: 'RDS(on) heiß (125 °C, Faktor ' + f(1 + ELEC.alpha * 100, 2) + ')', points: s2, dashed: true }], marker: { x: op.I, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        const sf = [], rdsNow = e.rds;
        for (let i = 0; i <= 20; i++) { const ff = 100000 * i / 20; sf.push([+(ff / 1000).toFixed(2), +(op.D * op.I * op.I * rdsNow + (op.D > 0 && op.D < 1 ? 0.5 * op.U * op.I * (ELEC.tr + ELEC.tf) * ff : 0)).toFixed(4)]); }
        out.push({ id: 'pf', title: 'Verlustleistung über der Frequenz', xLabel: 'Schaltfrequenz f', xUnit: 'kHz', yLabel: 'Verlustleistung P', yUnit: 'W', series: [{ name: 'P_leit + P_sw (Schaltverluste wachsen linear mit f)', points: sf }], marker: { x: op.f / 1000, y: e.p }, hlines: [{ y: pz, label: 'P_zul' }] });
        const pmax = Math.max(4, e.p * 1.6, pz * 1.2), chF = E.chainOf(Object.assign({}, c, { heatsink: 'none' })), chB = E.ch, chC = E.chainOf(Object.assign({}, c, { fan: 'stark' }));
        const lineTj = (chx) => { const a = []; for (let i = 0; i <= 20; i++) { const P = pmax * i / 20; a.push([+P.toFixed(3), +(ta + P * (chx ? chx.rthTotal : 0)).toFixed(3)]); } return a; };
        out.push({ id: 'tjp', title: 'Sperrschichttemperatur über der Verlustleistung', xLabel: 'Verlustleistung P', xUnit: 'W', yLabel: 'Sperrschichttemperatur Tj', yUnit: '°C', series: [{ name: 'freistehend', points: lineTj(chF) }, { name: 'aktueller Aufbau', points: lineTj(chB) }, { name: 'aktuell mit Lüfter (stark)', points: lineTj(chC), dashed: true }], marker: { x: e.p, y: S.tj }, hlines: [{ y: ELEC.tjMax, label: 'Tj,max' }] });
        let zs = [];
        try { const ts = []; for (let i = 0; i <= 36; i++) ts.push(Math.pow(10, -3 + 7 * i / 36)); const z = E.CORE.zth(E.cfg, ts); const za = Array.isArray(z) ? z : (z && Array.isArray(z.zth) ? z.zth : (z && Array.isArray(z.z) ? z.z : [])); zs = za.length === ts.length ? ts.map((t2, i) => [+t2.toPrecision(4), +za[i].toPrecision(5)]) : []; } catch (x) { zs = []; }
        out.push({ id: 'zth', title: 'Wärmeimpedanz über der Zeit (Prozesszeit)', xLabel: 'Zeit', xUnit: 's', xScale: 'log', xLog: true, yLabel: 'Zth', yUnit: 'K/W', series: [{ name: 'Zth(t) der Wärmekette', points: zs }], marker: c.pulse && zs.length ? { x: c.tp, y: zs.reduce((b, q) => Math.abs(Math.log(q[0] / c.tp)) < Math.abs(Math.log(b[0] / c.tp)) ? q : b, zs[0])[1] } : null, hlines: [{ y: E.ch.rthTotal, label: 'Rth_ges' }], ref: zs.length ? null : { why: 'THM_CORE.zth fehlt.' } });
        const sr = []; for (let T = 25; T <= ELEC.tjMax + 25; T += 5) sr.push([T, +(r25 * (1 + al * (T - 25))).toFixed(5)]);
        out.push({ id: 'rds', title: 'RDS(on) über der Sperrschichttemperatur', xLabel: 'Sperrschichttemperatur Tj', xUnit: '°C', yLabel: 'RDS(on)', yUnit: 'Ω', series: [{ name: (c.spec === 'max' ? 'max.' : 'typ.') + ', VGS ' + f(c.vgs, 1).replace(',0', '') + ' V', points: sr }], marker: { x: S.tj, y: e.rds } });
        return out;
      },
      params: () => ({ rds: ELEC.rds, alpha: ELEC.alpha, tr: ELEC.tr, tf: ELEC.tf, idRec: ELEC.idRec, idm: ELEC.idm, vdsRec: ELEC.vdsRec, vdsAbs: ELEC.vdsAbs }),
      scene: sceneMos
    };
    return spec;
  }

  // Szene: Schaltung mit Last, MOSFET, Gate-Signal und getrennten Verlustbalken (Aufteilung nach Platz: Hochformat hat weniger Hoehe)
  function sceneMos(ctx, R, E, D, t, L) {
    const c = E.ctl, e = E.eNow(), f = E.fmt, op = opPoint(c), w = R.w, h = R.h, ox = R.x, oy = R.y, port = L.portrait;
    txt(ctx, 'Schalter mit Last', ox + 12, oy + 14, 13, COL.text, 'left', '800');
    const barsH = port ? 46 : 54, aTop = oy + 26, aBot = oy + h - barsH - 8, ah = aBot - aTop, cwid = port ? w * 0.42 : w * 0.47;
    const sc = clamp(Math.min(ah / 128, cwid / 120), 0.6, 1.3), cxc = ox + w - cwid / 2 - 6;
    const X = (lx) => cxc + lx * sc, Y = (ly) => aTop + ly * sc;
    ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // Schiene mit Betriebsspannung
    ctx.beginPath(); ctx.moveTo(X(-40), Y(4)); ctx.lineTo(X(14), Y(4)); ctx.moveTo(X(0), Y(4)); ctx.lineTo(X(0), Y(16)); ctx.stroke();
    txt(ctx, '+' + f(c.u, 0) + ' V', X(18), Y(4), 13, COL.text, 'left', '800');
    // Last: Lampe leuchtet nach Strom und Tastgrad
    const lv = clamp(op.D * Math.min(1, op.I / 20) * 1.4, 0, 1), lyC = Y(32), lr = 14 * sc;
    glow(ctx, X(0), lyC, 38 * sc + 14 * lv, '255,210,90', 0.15 + 0.6 * lv);
    ctx.beginPath(); ctx.arc(X(0), lyC, lr, 0, TAU); ctx.fillStyle = 'rgba(255,225,140,' + (0.2 + 0.7 * lv).toFixed(3) + ')'; ctx.fill(); ctx.strokeStyle = '#c9d4de'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(0) - lr * 0.65, lyC - lr * 0.65); ctx.lineTo(X(0) + lr * 0.65, lyC + lr * 0.65); ctx.moveTo(X(0) - lr * 0.65, lyC + lr * 0.65); ctx.lineTo(X(0) + lr * 0.65, lyC - lr * 0.65); ctx.stroke();
    txt(ctx, 'Last', X(0) - lr - 8, lyC, 12, COL.dim, 'right', '600');
    // Drain, Kanal, Gate, Source, Masse
    const yD = Y(62), yS = Y(98), yG = Y(80), yGnd = Y(112);
    ctx.strokeStyle = '#8fa3b5'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(X(0), lyC + lr); ctx.lineTo(X(0), yD); ctx.lineTo(X(16), yD); ctx.moveTo(X(16), yS); ctx.lineTo(X(0), yS); ctx.lineTo(X(0), yGnd); ctx.stroke();
    ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(X(16), yD - 6); ctx.lineTo(X(16), yS + 6); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(8), yD - 8); ctx.lineTo(X(8), yS + 8); ctx.stroke();
    ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(8), yG); ctx.lineTo(X(-22), yG); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(-10), yGnd); ctx.lineTo(X(10), yGnd); ctx.moveTo(X(-6), yGnd + 4); ctx.lineTo(X(6), yGnd + 4); ctx.moveTo(X(-2.5), yGnd + 8); ctx.lineTo(X(2.5), yGnd + 8); ctx.stroke();
    txt(ctx, 'D', X(26), yD - 3, 12, COL.dim, 'left', '700'); txt(ctx, 'S', X(26), yS + 7, 12, COL.dim, 'left', '700'); txt(ctx, 'G', X(-26), yG, 12, COL.dim, 'right', '700');
    // Strom im Kanal: blau Leitverluste, orange Schaltverluste (Breite nach Anteil an P)
    const pt = Math.max(1e-9, e.pLeit + e.pSw), wl = 2 + 6 * e.pLeit / pt, ws = e.pSw > 0 ? 2 + 6 * e.pSw / pt : 0;
    ctx.save(); ctx.lineCap = 'butt'; ctx.setLineDash([8, 5]); ctx.lineDashOffset = D.reduced ? 0 : -(t / 1000) * (30 + 3 * op.I);
    ctx.strokeStyle = COL.leit; ctx.lineWidth = wl; ctx.beginPath(); ctx.moveTo(X(30) + 8, yD + 2); ctx.lineTo(X(30) + 8, yS + 2); ctx.stroke();
    if (ws > 0) { ctx.strokeStyle = COL.sw; ctx.lineWidth = ws; ctx.beginPath(); ctx.moveTo(X(30) + 18, yD + 2); ctx.lineTo(X(30) + 18, yS + 2); ctx.stroke(); }
    ctx.setLineDash([]); ctx.restore();
    // Gate-Signal links (zwei Perioden, Flanken stark vergroessert)
    const gx0 = ox + 12, gw = Math.max(70, cxc - cwid / 2 - gx0 - 6), gy0 = aTop + 20, gh = Math.min(44, ah * 0.36);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; rr(ctx, gx0, gy0 - 8, gw, gh + 16, 6); ctx.fill();
    txt(ctx, fitText(port && op.D > 0 && op.D < 1 ? 'Gate-Signal (Flanken ×50)' : 'Gate-Signal', gw, 12, '700'), gx0 + 2, aTop + 4, 12, COL.dim, 'left', '700');
    const period = op.cont ? gw : gw / 2, ed = clamp(op.f * (ELEC.tr + ELEC.tf) * 50, 0.012, 0.22) * period;
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.beginPath();
    const yHi = gy0, yLo = gy0 + gh;
    if (op.D >= 1 || op.cont) { ctx.moveTo(gx0 + 3, yHi); ctx.lineTo(gx0 + gw - 3, yHi); }
    else if (op.D <= 0) { ctx.moveTo(gx0 + 3, yLo); ctx.lineTo(gx0 + gw - 3, yLo); }
    else {
      const per = c.pulse ? gw - 6 : (gw - 6) / 2, np = c.pulse ? 1 : 2;
      for (let k = 0; k < np; k++) {
        const x0 = gx0 + 3 + k * per, on = Math.max(per * op.D, ed * 2.2), x1 = x0 + ed, x2 = x0 + on, x3 = x2 + ed;
        if (k === 0) ctx.moveTo(x0, yLo); else ctx.lineTo(x0, yLo);
        ctx.lineTo(x1, yHi); ctx.lineTo(x2, yHi); ctx.lineTo(x3, yLo); ctx.lineTo(x0 + per, yLo);
      }
    }
    ctx.stroke();
    const tms = (v) => v >= 1 ? f(v, 0) + ' s' : f(v * 1000, 0) + ' ms';
    const l1 = c.pulse ? 'tp ' + tms(c.tp) : (op.D >= 1 ? 'Dauerlast' : 'D = ' + f(c.duty, 0) + ' %'), l2 = c.pulse ? 'T ' + tms(c.T) : (op.D >= 1 ? 'D = 100 %' : 'f = ' + (c.f >= 1000 ? f(c.f / 1000, 0) + ' kHz' : f(c.f, 0) + ' Hz'));
    if (port) txt(ctx, fitText(c.pulse ? l1 + ' · ' + l2 : (op.D >= 1 ? 'Dauerlast 100 %' : 'D ' + f(c.duty, 0) + ' % · ' + (c.f >= 1000 ? f(c.f / 1000, 0) + ' kHz' : f(c.f, 0) + ' Hz')), gw, 12, '700'), gx0 + 2, gy0 + gh + 20, 12, COL.text, 'left', '700');
    else { txt(ctx, fitText(l1, gw, 12, '700'), gx0 + 2, gy0 + gh + 22, 12, COL.text, 'left', '700'); txt(ctx, fitText(l2, gw, 12, '700'), gx0 + 2, gy0 + gh + 38, 12, COL.text, 'left', '700'); }
    if (!port && op.D > 0 && op.D < 1) txt(ctx, fitText('Flanken ×50 gedehnt', gw, 12, '600'), gx0 + 2, gy0 + gh + 54, 12, COL.dim, 'left', '600');
    // Verlustbalken (gleicher Massstab fuer beide)
    const bx = ox + 12, bw = w - 24, by = oy + h - barsH + 2, scl = (bw - 112) / Math.max(pt, 0.5);
    [['P_leit', e.pLeit, COL.leit, 0], ['P_sw', e.pSw, COL.sw, 1]].forEach(q => {
      const y = by + q[3] * 22;
      txt(ctx, q[0], bx, y + 8, 12, COL.dim, 'left', '700');
      rr(ctx, bx + 44, y, Math.max(2, q[1] * scl), 16, 4); ctx.fillStyle = q[2]; ctx.fill();
      txt(ctx, f(q[1], 2) + ' W', bx + 44 + Math.max(2, q[1] * scl) + 6, y + 8, 12, COL.text, 'left', '800');
    });
    if (D.destroyed) { ctx.strokeStyle = COL.bad; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(X(-14), yD - 10); ctx.lineTo(X(44), yS + 10); ctx.moveTo(X(44), yD - 10); ctx.lineTo(X(-14), yS + 10); ctx.stroke(); }
    if (D.smoke > 0) fxSmoke(ctx, X(16), yD - 6, t, D.smoke * 0.6, D.reduced);
  }

  const SPEC0 = buildSpec({});
  R.register({ id: ID, name: 'MOSFET als Schalter (IRLZ34N)', icon: '🔌', info: INFO, controls: SPEC0.controls.concat(mountDefs({}, SPEC0)), meters: METERS, presets: SPEC0.presets, create(opts) { const CORE = getCore(); return makeEngine(CORE, buildSpec(CORE), opts || {}); } });

})(typeof window !== 'undefined' ? window : globalThis);
