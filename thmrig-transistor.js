/* thmrig-transistor.js - Thermik-Lab: Pruefstand 2 `transistor` (Leistungstransistor BD139 am Kuehlkoerper, SPEC 5.2)
 * Betriebsarten: Arbeitspunkt (Laengstransistor, P = UCE * IC) und Endstufe (Gegentakt-B, P(a) je Transistor), ein oder zwei Transistoren auf einem Kuehlkoerper
 * (THM_CORE.thermal rechnet bei count = 2 zwei Sperrschichtknoten und einen gemeinsamen Kuehlkoerperknoten), Defekt ab Tj,max + 25 K (Uebungsmodell, (A4)),
 * Vertiefung "Weglaufen" (feste Basisspannung, mit und ohne Emitterwiderstand, Formeln wie THM_CORE.coupled.runaway).
 * Die gemeinsame Basis (Kernschritt, Schreiber, Meldungen, Ansichten, Bedienpult im Bild) liegt in thmrig-linear.js (THM_RIGS.baseA): Diese Datei im Browser
 * NACH thmrig-linear.js laden (in Node holt sie sich die Basis per require).
 */
(function (root) {
  'use strict';
  const R = root.THM_RIGS = root.THM_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };
  if (!R.baseA && typeof require === 'function') { try { require('./thmrig-linear.js'); } catch (e) { /* Basis fehlt */ } }
  const B = R.baseA;
  if (!B) { if (typeof console !== 'undefined') console.warn('thmrig-transistor.js: Die Basis aus thmrig-linear.js fehlt (bitte davor laden).'); return; }
  const clamp = B.clamp, fn = B.fn, F0 = B.F.F0, F1 = B.F.F1, F2 = B.F.F2;
  const RANGE = { lo: 0, hi: 180, unit: '°C', digits: 0 };
  // Uebungsmodell des Weglaufens (A19): UBE sinkt um 2 mV/K; Ic verdoppelt sich je 10 K; der Strom wird von der Beschaltung auf ICMAX begrenzt (A)
  const K_UBE = 0.002, ICMAX = 2.0, LN2 = Math.LN2;

  // ---- Betriebspunkt eines Transistors (je Transistor); Zwischenspeicher ueber X.memo ----
  function opTr(X, tj, fl) {
    const c = X.ctl, CORE = X.CORE, ch = X.getChain(), n = ch.count || 1, rw = c.mode === 'ap' && c.runaway, tq = rw ? Math.round(tj * 20) / 20 : 0;
    const key = ['tr', c.mode, c.uce, c.ic, c.ub, c.rl, c.aus, n, rw ? 1 : 0, c.re, fl.destroyed ? 1 : 0, tq, ch.rthTotal].join('|');
    return X.memo(key, () => {
      const o = { mode: c.mode, uce: 0, ic: 0, ic0: 0, p1: 0, pTot: 0, pNode: 0, pOn: 0, G: 0, runaway: false, pMax: 0, a: c.aus / 100, uHat: 0, peak: 0, ok: true, tjUsed: tq };
      if (c.mode === 'endstufe') {
        const r = CORE.power.endstufe(c.ub, c.rl, c.aus / 100);
        o.uce = c.ub; o.pMax = r.ok ? r.pMax : 0; o.uHat = c.aus / 100 * c.ub; o.peak = o.uHat / c.rl; o.ic = o.uHat / (Math.PI * c.rl);
        o.p1 = r.ok ? r.p : 0;
      } else {
        o.uce = c.uce; o.ic0 = c.ic; let ic = c.ic;
        if (rw) { ic = c.re > 0 ? Math.max(0, c.ic + K_UBE * (tq - 25) / c.re) : c.ic * Math.pow(2, (tq - 25) / 10); ic = Math.min(ic, ICMAX); }
        o.ic = ic; o.p1 = c.uce * ic; o.peak = ic;
        if (rw) { o.G = c.re > 0 ? c.uce * K_UBE / c.re * ch.rthTotal : LN2 / 10 * o.p1 * ch.rthTotal; o.runaway = o.G >= 1 && c.ic > 0 && c.uce > 0; }
      }
      o.pOn = o.p1;
      if (fl.destroyed) { o.p1 = 0; o.ic = 0; o.uHat = 0; o.peak = 0; o.G = 0; o.runaway = false; }
      o.pTot = n * o.p1; o.pNode = o.p1;
      return o;
    });
  }

  // visible(s) bekommt von der Oberflaeche rig.state() (mode = frei|kk, Betriebsart in betrieb), von Tests auch die Steuerwerte (mode = ap|endstufe)
  const bm = s => !s ? 'ap' : (s.betrieb !== undefined ? s.betrieb : (s.mode === 'endstufe' ? 'endstufe' : 'ap'));
  const G_BL = 'Bauteil und Last';
  const CONTROLS_TR = [
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'ap', group: G_BL, options: [{ value: 'ap', label: 'Arbeitspunkt (Längstransistor)' }, { value: 'endstufe', label: 'Endstufe (Gegentakt-B)' }],
      help: 'Arbeitspunkt: Du stellst UCE und IC ein, die Verlustleistung ist UCE mal IC. Endstufe: zwei Transistoren im Gegentakt-B-Betrieb, die Verlustleistung hängt von der Aussteuerung ab.' },
    { key: 'uce', label: 'Spannung UCE', type: 'slider', scale: 'lin', min: 0, max: 40, step: 0.5, unit: 'V', value: 6, group: G_BL, visible: s => bm(s) === 'ap',
      help: 'Spannung zwischen Kollektor und Emitter. Beim Längstransistor fällt sie über dem Transistor ab und wird in Wärme umgesetzt.' },
    { key: 'ic', label: 'Kollektorstrom IC', type: 'slider', scale: 'lin', min: 0, max: 1.5, step: 0.05, unit: 'A', value: 0.3, group: G_BL, visible: s => bm(s) === 'ap',
      help: 'Kollektorstrom des Transistors. Die Verlustleistung ist UCE mal IC (der Basisstrom wird vernachlässigt).' },
    { key: 'ub', label: 'Betriebsspannung Ub', type: 'slider', scale: 'lin', min: 6, max: 30, step: 1, unit: 'V', value: 15, group: G_BL, visible: s => bm(s) === 'endstufe',
      help: 'Betriebsspannung der Endstufe. Die größte Verlustleistung je Transistor ist Ub² geteilt durch π² mal RL.' },
    { key: 'rl', label: 'Lastwiderstand RL', type: 'slider', scale: 'log', min: 4, max: 32, step: 0.5, unit: 'Ω', value: 8, group: G_BL, visible: s => bm(s) === 'endstufe',
      help: 'Lastwiderstand (Lautsprecher) der Endstufe. Ein kleinerer Widerstand ergibt mehr Strom und mehr Verlustleistung.' },
    { key: 'aus', label: 'Aussteuerung a', type: 'slider', scale: 'lin', min: 0, max: 100, step: 1, unit: '%', value: 64, group: G_BL, visible: s => bm(s) === 'endstufe',
      help: 'Aussteuerung der Endstufe in Prozent der Betriebsspannung. Die Verlustleistung je Transistor ist bei etwa 64 Prozent (2/π) am größten, nicht bei voller Aussteuerung.' },
    { key: 'count', label: 'Anzahl Transistoren auf dem Kühlkörper', type: 'select', value: 1, group: G_BL, options: [{ value: 1, label: '1 Transistor' }, { value: 2, label: '2 Transistoren' }],
      help: 'Zwei gleiche Transistoren teilen sich einen Kühlkörper. Der Kühlkörper trägt die Summe der beiden Verlustleistungen, jeder Transistor ist heißer als allein.' },
    { key: 'runaway', label: 'Feste Basisspannung (Weglaufen)', type: 'switch', value: false, group: G_BL, visible: s => bm(s) === 'ap',
      help: 'Vertiefung: Die Basisspannung ist fest, der Strom wächst mit der Temperatur (UBE sinkt um 2 mV je K). Ohne Emitterwiderstand kann die Temperatur davonlaufen.' },
    { key: 're', label: 'Emitterwiderstand re', type: 'slider', scale: 'lin', min: 0, max: 2, step: 0.05, unit: 'Ω', value: 0, group: G_BL, visible: s => bm(s) === 'ap' && !!(s.runawayMode !== undefined ? s.runawayMode : s.runaway),
      help: 'Ein Emitterwiderstand wirkt gegen: Steigt der Strom, sinkt die Spannung an der Basis-Emitter-Strecke. Das stabilisiert den Strom und verhindert das Weglaufen.' }
  ].concat(B.mountControls());
  const METERS_TR = B.meterList([
    ['p', 'Verlustleistung je Transistor', 'W', 2, 0, 20, 'P'], ['pTotal', 'Verlustleistung gesamt', 'W', 2, 0, 40], ['tj', 'Sperrschichttemperatur', '°C', 1, 0, 250, 'Tj', 150], ['tc', 'Gehäusetemperatur', '°C', 1, 0, 250, 'Tc'],
    ['tk', 'Kühlkörpertemperatur', '°C', 1, 0, 250, 'Tk'], ['rthTot', 'Gesamt-Wärmewiderstand', 'K/W', 2, 0, 130], ['pzul', 'Zulässige Verlustleistung je Transistor', 'W', 2, 0, 20], ['ic', 'Kollektorstrom IC', 'A', 3, 0, 8],
    ['uce', 'Spannung UCE', 'V', 1, 0, 40], ['dtJC', 'Temperaturabfall Sperrschicht–Gehäuse', 'K', 1, 0, 250], ['dtCK', 'Temperaturabfall Gehäuse–Kühlkörper', 'K', 1, 0, 250], ['dtK', 'Temperaturabfall Kühlkörper–Umgebung', 'K', 1, 0, 250],
    ['pEndMax', 'Größte Verlustleistung der Endstufe je Transistor', 'W', 2, 0, 30]
  ]);

  const MOUNT_M = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest' };
  const PRESETS_TR = (function () {
    const mk = (id, name, params) => ({ id, name, params, settle: false });
    const a = Object.assign({ mode: 'ap', uce: 6, ic: 0.3, count: 1 }, MOUNT_M);
    const b = { mode: 'ap', uce: 10, ic: 0.3, count: 1, heatsink: 'none' };
    const c = Object.assign({ mode: 'endstufe', ub: 15, rl: 8, aus: 64, count: 2 }, MOUNT_M);
    const d = Object.assign({ mode: 'ap', uce: 10, ic: 0.15, count: 1, runaway: true, re: 0 }, MOUNT_M);
    const e = Object.assign({}, d, { re: 1 });
    return [
      mk('laengs', 'Längstransistor ' + F0(a.uce) + ' V / ' + F1(a.ic) + ' A (' + F1(a.uce * a.ic) + ' W)', a),
      mk('ohne-kk', 'ohne Kühlkörper (kein Abschaltschutz: Defekt)', b),
      mk('endstufe-zwei', 'Endstufe zwei BD139 auf einem Kühlkörper (Ub ' + F0(c.ub) + ' V, ' + F0(c.rl) + ' Ω, a = ' + F0(c.aus) + ' %)', c),
      mk('weglaufen', 'Weglaufen ohne Gegenkopplung', d),
      mk('weglaufen-re', 'Weglaufen mit Emitterwiderstand', e)
    ].concat(B.mountPresets());
  })();

  const SW_TR = B.SWITCHES.concat([{ key: 'count', label: 'zwei Stück', on: c => +c.count === 2, to: c => +c.count === 2 ? 1 : 2, show: c => (+c.count === 2 ? 'zwei' : 'ein') + ' Stück' }]);

  const TR_DEF = {
    id: 'transistor', h: 0.25, timeScale: 30, tUnit: 'min', range: RANGE, world: { w: 1000, h: 560 },
    params: { icMax: ICMAX, kUbe: K_UBE },
    controls: CONTROLS_TR, meters: METERS_TR, presets: PRESETS_TR, metersLabel: B.metersLabel,
    deviceOf: () => 'bd139', deviceName: (id, X) => (X && X.devData(id).name) || id,
    cfg(c, CORE) { return CORE.cfgFromControls(c, 'bd139'); },
    fahne(X, op) { const c = X.ctl, d = X.devData('bd139'), tab = d.tab || {}; return { pot: tab.pot, label: tab.potText || '', v: c.mode === 'endstufe' ? c.ub : c.uce }; },
    op: opTr,
    model: { opTr },
    meters_(X, op) { const c = X.ctl; return { p: op.p1, pTotal: op.pTot, ic: c.mode === 'ap' ? op.ic : 0, uce: c.mode === 'ap' ? op.uce : 0, pEndMax: c.mode === 'endstufe' ? op.pMax : 0 }; },
    state_(X, op) {
      const c = X.ctl; return { betrieb: c.mode, uce: c.mode === 'ap' ? op.uce : 0, ic: c.mode === 'ap' ? op.ic : 0, ub: c.mode === 'endstufe' ? c.ub : 0, rl: c.mode === 'endstufe' ? c.rl : 0, a: c.mode === 'endstufe' ? c.aus / 100 : 0,
        pEndMax: c.mode === 'endstufe' ? op.pMax : 0, G: op.G, runaway: op.runaway, re: c.re, runawayMode: !!c.runaway && c.mode === 'ap', pOn: op.pOn, iPeak: op.peak };
    },
    // Zusatzangaben fuer THM_CORE.diagnose: Strom und Spannung am Kollektor, Weglaufen (Bipolartransistor)
    diagExtra(Sx, X) { const c = X.ctl, op = Sx.op; return { op: { uce: c.mode === 'ap' ? op.uce : c.ub, ic: op.peak }, runaway: op.runaway && !Sx.destroyed ? 'bip' : false, tabV: c.mode === 'endstufe' ? c.ub : c.uce }; },
    recipeOp(X) { const c = X.ctl; if (c.mode === 'endstufe') return { mode: 'endstufe', ub: c.ub, rl: c.rl, a: c.aus / 100 }; return c.runaway ? null : { mode: 'ap', uce: c.uce, ic: c.ic }; },
    scene(X, op, V) {
      const c = X.ctl, chips = [], endst = c.mode === 'endstufe';
      if (V.destroyed) chips.push({ text: 'DEFEKT', kind: 'error' });
      if (op.runaway && !V.destroyed) chips.push({ text: 'WEGLAUFEN', kind: 'error' });
      if (X.getChain().faults.indexOf('kurzschluss') >= 0) chips.push({ text: 'KURZSCHLUSS', kind: 'error' });
      const knobs = endst ? [{ key: 'ub', label: 'Betrieb Ub', lo: 6, hi: 30, step: 1, scale: 'lin', unit: 'V', digits: 0, show: v => fn(v, 0) + ' V' }, { key: 'aus', label: 'Aussteuerung', lo: 0, hi: 100, step: 1, scale: 'lin', unit: '%', digits: 0, show: v => fn(v, 0) + ' %' }]
        : [{ key: 'uce', label: 'Spannung UCE', lo: 0, hi: 40, step: 0.5, scale: 'lin', unit: 'V', digits: 1, show: v => fn(v, 1) + ' V' }, { key: 'ic', label: 'Strom IC', lo: 0, hi: 1.5, step: 0.05, scale: 'lin', unit: 'A', digits: 2, show: v => fn(v, 2) + ' A' }];
      const lamp = endst ? { kind: 'speaker', level: V.destroyed ? 0 : clamp(c.aus / 100, 0, 1), label: 'Lautsprecher', value: 'a = ' + fn(c.aus, 0) + ' %' } : { level: V.destroyed ? 0 : clamp(op.ic / 1.5, 0, 1), label: 'Last', value: fn(op.ic, 2) + ' A' };
      const lines = endst ? ['P_max = Ub²/(π²·RL) = ' + F2(op.pMax) + ' W'] : [];
      if (c.mode === 'ap' && c.runaway) lines.push('G = ' + F2(op.G) + (op.G >= 1 ? ' (läuft weg)' : ' (stabil)'));
      return { title: 'Transistor-Prüfstand BD139 (Übungsanlage)', titleShort: 'Transistor-Prüfstand BD139', knobs, lamp, chips, switches: SW_TR, lines };
    },
    curves(X, K) {
      const c = X.ctl, CORE = X.CORE, ta = c.ta, cfg = K.cfgNow(), tjMax = K.tjMaxOf('bd139'), nd = X.nodes(), op0 = opTr(X, nd.tj, X.flags()), pz = K.pzulOf(cfg, ta), out = [], ch = K.getChain();
      // (1) Derating-Kurve P_zul(Tc)
      { const dr = CORE.derating(cfg, ta, 26), pts = [];
        if (dr && dr.ok) { pts.push([0, +dr.pCase25.toFixed(3)]); dr.points.forEach(q => pts.push([+q.tc.toFixed(2), +q.p.toFixed(4)])); }
        out.push({ id: 'derating', title: 'Zulässige Verlustleistung über der Gehäusetemperatur', xLabel: 'Gehäusetemperatur ' + X.S('Tc'), xUnit: '°C', yLabel: 'Verlustleistung', yUnit: 'W', series: [{ name: 'P_zul(Tc)', points: pts }], marker: { x: +nd.tc.toFixed(2), y: +op0.p1.toFixed(4) }, note: 'bis 25 °C waagrecht, dann Steigung −1/Rth_JC' }); }
      // (2) P(a) der Endstufe
      { const pts = []; let pm = 0; for (let i = 0; i <= 40; i++) { const r = CORE.power.endstufe(c.ub, c.rl, i / 40); pts.push([+(i * 2.5).toFixed(1), +(r.ok ? r.p : 0).toFixed(4)]); }
        const rM = CORE.power.endstufe(c.ub, c.rl); pm = rM.ok ? rM.pMax : 0;
        out.push({ id: 'p-a', title: 'Verlustleistung je Transistor über der Aussteuerung', xLabel: 'Aussteuerung a', xUnit: '%', yLabel: 'Verlustleistung', yUnit: 'W', series: [{ name: 'P(a)', points: pts }, { name: 'P_max', points: [[0, +pm.toFixed(4)], [100, +pm.toFixed(4)]], style: 'limit' }], marker: { x: c.aus, y: +(CORE.power.endstufe(c.ub, c.rl, c.aus / 100).p || 0).toFixed(4) }, note: 'Maximum bei a = 2/π (etwa 64 %)' }); }
      // (3) Leistungshyperbel im UCE-IC-Diagramm (nur die Leistungsgrenze, nicht der echte sichere Arbeitsbereich)
      { const pts = [], iAbs = ((X.devData('bd139').limits || {}).iAbs) || 1.5; for (let i = 0; i <= 39; i++) { const u = 1 + i; pts.push([u, +Math.min(iAbs, pz / u).toFixed(4)]); }
        out.push({ id: 'hyperbel', title: 'Leistungsgrenze im UCE-IC-Diagramm', xLabel: 'Spannung UCE', xUnit: 'V', yLabel: 'Kollektorstrom IC', yUnit: 'A', series: [{ name: 'IC = P_zul / UCE', points: pts }, { name: 'IC,max', points: [[0, iAbs], [40, iAbs]], style: 'limit' }], marker: { x: c.mode === 'ap' ? c.uce : c.ub, y: c.mode === 'ap' ? +op0.ic.toFixed(4) : +op0.peak.toFixed(4) }, note: 'Nur die Leistungsgrenze, nicht der reale sichere Arbeitsbereich' }); }
      // (4) Tj(t) beim Einschalten: ein und zwei Transistoren, gleiche Verlustleistung je Transistor
      { const P1 = op0.pOn, ser = []; let tEnd = 600;
        [1, 2].forEach(nn => { const cfgN = Object.assign({}, cfg, { count: nn }), th = CORE.thermal(cfgN), tau = th.tauDominant(); if (isFinite(tau)) tEnd = Math.max(tEnd, 5 * tau); });
        [1, 2].forEach(nn => { const r = CORE.thermal.stepResponse(Object.assign({}, cfg, { count: nn }), tEnd, 60), pts = []; if (r && r.ok) for (let i = 0; i < r.t.length; i++) pts.push([+(r.t[i] / 60).toFixed(3), +(ta + P1 * r.tj[i]).toFixed(3)]); ser.push({ name: nn + (nn === 1 ? ' Transistor' : ' Transistoren') + (ch.mode === 'frei' ? ' (freistehend je eigener Kühlung)' : ''), points: pts }); });
        ser.push({ name: 'Tj,max', points: [[0, tjMax], [+(tEnd / 60).toFixed(2), tjMax]], style: 'limit' });
        out.push({ id: 'heat', title: 'Aufheizkurve der Sperrschicht: ein und zwei Transistoren', xLabel: 'Prozesszeit', xUnit: 'min', yLabel: 'Sperrschichttemperatur', yUnit: '°C', series: ser, marker: { x: +(K.tauOf() / 60).toFixed(3), y: +(ta + (nd.tj - ta) * 0.632).toFixed(2) } }); }
      return out;
    }
  };

  R.register({
    id: 'transistor', name: 'Leistungstransistor (BD139)', icon: '🔌',
    info: 'Übungsanlage: Ein Leistungstransistor BD139 am Kühlkörper. Als Längstransistor setzt er UCE mal IC in Wärme um, in der Gegentakt-Endstufe hängt die Verlustleistung von der Aussteuerung ab. Zwei Transistoren teilen sich einen Kühlkörper. Ohne Abschaltschutz zerstört Überhitzung das Bauteil (Übungsmodell).',
    controls: CONTROLS_TR, meters: METERS_TR, presets: PRESETS_TR,
    create(opts) { return B.makeRig(TR_DEF, opts); }
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
