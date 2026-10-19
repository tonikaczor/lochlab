(function (root) {
  'use strict';
  const R = root.ANT_RIGS = root.ANT_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 5: Getriebe und Mechanik =====
  // Physik: ANT_CORE.gearbox (Uebersetzung, Wirkungsgrad je Stufe und Bauart, Schleppverluste, Grenzmoment mit Zahnbruch, Thermik).
  // Ein- oder zweistufig: Stirnrad, Zahnriemen oder Schnecke (zweite Stufe bei Schnecke: Stirnrad).
  //   i = z2/z1 (Schnecke: z2/Gangzahl)   n_aus = n_ein/i   M_aus = (M_ein - M_Schlepp) * i * eta   P_aus = M_aus * w_aus
  const W = 1000, H = 560, TAU = Math.PI * 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const fmt = (v, d) => (+v).toFixed(d).replace('.', ',');
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const TYPE_NAME = { stirnrad: 'Stirnrad', riemen: 'Zahnriemen', schnecke: 'Schnecke' };
  const TYPE_DEFAULT = { stirnrad: [20, 40, 20, 40], riemen: [20, 40, 20, 40], schnecke: [1, 30, 20, 40] };

  const CONTROLS = [
    { key: 'type', label: 'Getriebeart', type: 'select', value: 'stirnrad', options: [{ value: 'stirnrad', label: 'Stirnrad' }, { value: 'riemen', label: 'Zahnriemen' }, { value: 'schnecke', label: 'Schnecke' }], group: 'Getriebe', help: 'Beim Umschalten werden passende Zähnezahlen gesetzt. Die zweite Stufe der Schnecke ist ein Stirnradpaar.' },
    { key: 'stages', label: 'Stufen', type: 'select', value: 1, options: [{ value: 1, label: 'einstufig' }, { value: 2, label: 'zweistufig' }], group: 'Getriebe' },
    { key: 'z1', label: 'z1 Antriebsrad (Schnecke: Gangzahl)', type: 'slider', min: 1, max: 80, step: 1, unit: '', value: 20, group: 'Zähnezahlen', help: 'Bei der Schnecke ist z1 die Gangzahl (1 bis 4).' },
    { key: 'z2', label: 'z2 Abtriebsrad', type: 'slider', min: 8, max: 80, step: 1, unit: '', value: 40, group: 'Zähnezahlen' },
    { key: 'z3', label: 'z3 Antriebsrad Stufe 2', type: 'slider', min: 8, max: 80, step: 1, unit: '', value: 20, group: 'Zähnezahlen' },
    { key: 'z4', label: 'z4 Abtriebsrad Stufe 2', type: 'slider', min: 8, max: 80, step: 1, unit: '', value: 40, group: 'Zähnezahlen' },
    { key: 'nIn', label: 'Eingangsdrehzahl', type: 'slider', min: 0, max: 7000, step: 10, unit: '1/min', value: 1000, group: 'Antrieb' },
    { key: 'mIn', label: 'Eingangsmoment', type: 'slider', min: 0, max: 40, step: 0.1, unit: 'Nm', value: 2, group: 'Antrieb', help: 'Das Moment, das der Motor an der Eingangswelle liefert (bei Last: größtes mögliches Moment).' },
    { key: 'load', label: 'Lastmoment am Ausgang', type: 'slider', min: 0, max: 400, step: 0.5, unit: 'Nm', value: 0, group: 'Last', help: '0 = Ausgangsmoment ergibt sich aus Eingangsmoment · i · η. Sonst verlangt die Last genau dieses Moment.' },
    { key: 'eta', label: 'Wirkungsgrad', type: 'select', value: 'auto', options: [{ value: 'auto', label: 'automatisch nach Bauart' }, { value: 'e95', label: '95 %' }, { value: 'e90', label: '90 %' }, { value: 'e80', label: '80 %' }, { value: 'e60', label: '60 %' }], group: 'Getriebe' },
    { key: 'lube', label: 'Schmierung', type: 'switch', value: true, group: 'Getriebe', help: 'Ohne Schmierung steigen Reibung, Verluste und Temperatur.' }
  ];
  const METERS = [
    { key: 'ratio', label: 'Übersetzung i', unit: '', digits: 2, min: 0, max: 100 },
    { key: 'nOut', label: 'Ausgangsdrehzahl', unit: '1/min', digits: 0, min: 0, max: 7000 },
    { key: 'mOut', label: 'Ausgangsmoment', unit: 'Nm', digits: 1, min: 0, max: 300 },
    { key: 'pIn', label: 'P Eingang', unit: 'W', digits: 0, min: 0, max: 6000 },
    { key: 'pOut', label: 'P Ausgang', unit: 'W', digits: 0, min: 0, max: 6000 },
    { key: 'pLoss', label: 'Verlustleistung', unit: 'W', digits: 0, min: 0, max: 1500, warnAbove: 600 },
    { key: 'eta', label: 'Wirkungsgrad', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'temp', label: 'Getriebetemperatur', unit: '°C', digits: 0, min: 20, max: 160, warnAbove: 90 }
  ];
  const PRESETS = [
    { id: 'unter2', name: 'Untersetzung 2:1 (Stirnrad 20/40)', params: { type: 'stirnrad', stages: 1, z1: 20, z2: 40 } },
    { id: 'uebers2', name: 'Übersetzung ins Schnelle 1:2 (40/20)', params: { type: 'stirnrad', stages: 1, z1: 40, z2: 20 } },
    { id: 'zwei9', name: 'Zweistufig i = 9 (20/60 und 20/60)', params: { type: 'stirnrad', stages: 2, z1: 20, z2: 60, z3: 20, z4: 60 } },
    { id: 'riemen3', name: 'Zahnriemen 20/60 (i = 3)', params: { type: 'riemen', stages: 1, z1: 20, z2: 60 } },
    { id: 'schnecke30', name: 'Schnecke eingängig, Rad 30 (i = 30)', params: { type: 'schnecke', stages: 1, z1: 1, z2: 30 } },
    { id: 'schnecke4', name: 'Schnecke viergängig, Rad 40 (i = 10)', params: { type: 'schnecke', stages: 1, z1: 4, z2: 40 } },
    { id: 'ueberlast', name: 'Überlast-Versuch (Zahnbruch)', params: { type: 'stirnrad', stages: 1, z1: 20, z2: 40, mIn: 35, load: 0 } }
  ];

  R.register({
    id: 'getriebe', name: 'Getriebe und Mechanik', icon: '⚙️',
    info: 'Zahnräder, Riemen und Schnecke: Stelle Zähnezahlen ein und beobachte Drehzahl, Drehmoment, Leistung und Wirkungsgrad. Ohne Schmierung wird das Getriebe heiß, bei Überlast bricht ein Zahn.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return createRig(opts || {}); }
  });

  function getCore() {
    const c = root.ANT_CORE || (typeof require === 'function' ? require('./antcore.js') : null);
    if (!c || !c.gearbox) throw new Error('ANT_CORE (antcore.js) ist nicht geladen.');
    return c;
  }
  const THERM = 8; // Zeitraffer der Erwaermung fuer die Vorfuehrung (Zeitkonstante ca. 30 s)
  const LIMS = { stirnrad: { mLimit: 60, nMax: 6000, mDrag: 0.01 }, riemen: { mLimit: 20, nMax: 4000, mDrag: 0.008 }, schnecke: { mLimit: 80, nMax: 3000, mDrag: 0.03 } };
  const TYPE_ALIAS = { stirn: 'stirnrad' };

  function createRig(opts) {
    const CORE = getCore();
    const ctl = {}; CONTROLS.forEach(c => { ctl[c.key] = c.value; });
    const ev = [];
    let S, gb = null;

    function gbParams() {
      const worm = ctl.type === 'schnecke';
      const etaOv = { e95: 0.95, e90: 0.9, e80: 0.8, e60: 0.6 }[ctl.eta];
      const ns = +ctl.stages === 2 ? 2 : 1;
      return Object.assign({ type: ctl.type, stages: ns, z1: ctl.z1, z2: ctl.z2, z3: ctl.z3, z4: ctl.z4, gaenge: clamp(Math.round(ctl.z1), 1, 4), lube: !!ctl.lube,
        eta: etaOv ? Math.pow(etaOv, 1 / ns) : 0, thermFactor: THERM }, LIMS[ctl.type]);
    }
    function applyParams() { gb.setParams(gbParams()); }
    function initState() {
      gb = CORE.gearbox(gbParams());
      S = { t: 0, wIn: 0, a1: 0, temp: 25, broken: false, brokenStage: 0, brokenT: -1e9, stalled: false, overHeat: false, overSpeed: false, overload: false,
        stallFlag: false, nOut: 0, mOut: 0, pIn: 0, pOut: 0, pLoss: 0, eta: 0, mInEff: 0, lubeWarn: false, lubeOffT: 0, st: null, nSet: 0, mAvail: 0 };
      ev.length = 0;
      calc(0);
    }
    function say(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; e.x = x == null ? 330 : x; e.y = y == null ? 235 : y; }
      ev.push(e); if (ev.length > 80) ev.shift();
    }

    // Gesamtansicht der Stufen fuer Zeichnung und Zustand
    function view() {
      const inf = gb.info(), gp = gb.params;
      const worm = ctl.type === 'schnecke';
      const zs = [[worm ? gp.gaenge : gp.z1, gp.z2], [gp.z3, gp.z4]];
      const stages = inf.stages.map((s, k) => ({ type: s.type === 'stirnrad' ? 'stirnrad' : s.type, zIn: zs[k][0], zOut: zs[k][1], i: s.i, eta: s.eta }));
      return { a: { stages, lube: gp.lube, lim: gp.mLimit }, i: inf.ratio, eta0: inf.eta, dirOut: inf.dirOut, selfLocking: inf.selfLocking, nMax: gp.nMax };
    }

    // Eingangsmoment und Last: load = 0 -> M_aus = (M_ein - Schlepp) * i * eta; load > 0 -> die Last verlangt genau dieses Moment (Eingang passt sich an, falls moeglich)
    function calc(c) {
      const nSet = clamp(num(ctl.nIn, 0), 0, 7000), mInCtl = clamp(num(ctl.mIn, 0), 0, 100), load = clamp(num(ctl.load, 0), 0, 1000);
      let mIn = mInCtl, stalled = false;
      const lube = !!ctl.lube;
      if (load > 0) {
        const req = gb.apply({ nIn: Math.max(nSet, 1), mIn: 0, mLoad: load, lube }).mInRequired;
        if (req <= mInCtl + 1e-9) mIn = req; else stalled = true;
      }
      const nEff = stalled ? 0 : S.wIn * 30 / Math.PI;
      const st = c > 0 ? gb.step(c, { nIn: nEff, mIn, mLoad: stalled ? undefined : (load > 0 ? load : undefined), lube }) : gb.apply({ nIn: nEff, mIn, lube });
      const av = gb.apply({ nIn: Math.max(nSet, 1), mIn: mInCtl, lube });
      S.st = st; S.stalled = stalled; S.nSet = nSet; S.mAvail = av.mOut; S.mInCmd = mIn;
      return st;
    }

    function setControl(key, value) {
      const def = CONTROLS.find(c => c.key === key); if (!def) return;
      if (def.type === 'switch') value = !!value;
      else if (def.type === 'slider') { value = clamp(num(value, def.value), def.min, def.max); if (['z1', 'z2', 'z3', 'z4'].includes(key)) value = Math.round(value); }
      else if (def.type === 'select') {
        if (key === 'stages') value = +value === 2 ? 2 : 1;
        else { if (key === 'type' && TYPE_ALIAS[value]) value = TYPE_ALIAS[value]; if (!def.options.some(o => o.value === value)) return; }
      }
      const old = ctl[key];
      ctl[key] = value;
      if (key === 'type' && old !== value) { const dflt = TYPE_DEFAULT[value]; ctl.z1 = dflt[0]; ctl.z2 = dflt[1]; ctl.z3 = dflt[2]; ctl.z4 = dflt[3]; }
      if (['type', 'stages', 'z1', 'z2', 'z3', 'z4', 'eta', 'lube'].includes(key)) applyParams();
    }
    function getControl(key) { return ctl[key]; }

    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      dtMs = Math.min(dtMs, 120000);
      let remain = dtMs / 1000;
      const chunk = dtMs > 3000 ? 0.05 : 0.01;
      while (remain > 1e-9) {
        const hs = Math.min(chunk, remain); remain -= hs; S.t += hs * 1000;
        const v = view();
        const nSet = clamp(num(ctl.nIn, 0), 0, 7000), wSet = nSet * Math.PI / 30;
        // Antriebsdrehzahl folgt dem Sollwert mit Traegheit; Zahnbruch und Ueberlast bremsen sie
        const stalledNow = S.stalled;
        const wT = (S.broken || stalledNow) ? 0 : wSet;
        const tau = S.broken ? 0.03 : stalledNow ? 0.12 : 0.25;
        S.wIn += (wT - S.wIn) * (1 - Math.exp(-hs / tau));
        if (Math.abs(S.wIn) < 1e-4) S.wIn = 0;
        S.a1 += S.wIn * hs;
        const st = calc(hs * 1000);
        S.temp = st.temp;
        S.nOut = st.broken ? 0 : st.nOut; S.mOut = st.mOut;
        S.pIn = st.pIn; S.pOut = st.pOut; S.pLoss = Math.max(0, st.pLoss); S.eta = st.pIn > 1 ? clamp(st.pOut / st.pIn, 0, 1) : 0;
        S.mInEff = S.mInCmd;
        monitor(st, v);
      }
    }

    function monitor(st, v) {
      const lim = v.a.lim;
      if (st.overload && !st.broken && !S.overload) { S.overload = true; say('Überlast! Das Ausgangsmoment (' + fmt(Math.max(st.mOut, num(ctl.load, 0)), 1) + ' Nm) liegt über dem Grenzmoment von ' + fmt(lim, 1) + ' Nm. Gleich bricht ein Zahn.', 'warn'); }
      if (!st.overload) S.overload = false;
      if (st.broken && !S.broken) {
        S.broken = true; S.brokenT = S.t; S.brokenStage = v.a.stages.length - 1;
        const stg = v.a.stages[S.brokenStage];
        const g = geomPositions(v.a.stages, S.brokenStage);
        say(stg.type === 'riemen' ? 'Überlast! Der Zahnriemen springt über und reißt. Das Moment war größer als das Grenzmoment von ' + fmt(lim, 1) + ' Nm.'
          : stg.type === 'schnecke' ? 'Überlast! Am Schneckenrad bricht ein Zahn: Das Moment war größer als das Grenzmoment von ' + fmt(lim, 1) + ' Nm.'
          : 'Überlast! Am Ritzel (z = ' + stg.zIn + ') bricht ein Zahn: Das Moment war größer als das Grenzmoment von ' + fmt(lim, 1) + ' Nm. Das Getriebe blockiert.', 'error', 'crash', g.mx, g.my);
      }
      if (S.stalled && !S.stallFlag && !S.broken) { S.stallFlag = true; say('Das Eingangsmoment reicht nicht: Die Last verlangt ' + fmt(num(ctl.load, 0), 1) + ' Nm am Ausgang, möglich sind nur ' + fmt(S.mAvail, 1) + ' Nm. Die Welle bleibt stehen. Erhöhe das Eingangsmoment oder senke die Last.', 'warn', 'stall', 330, 235); }
      else if (!S.stalled) S.stallFlag = false;
      if (st.overspeed && !S.overSpeed) { S.overSpeed = true; say('Überdrehzahl! ' + Math.round(S.nSet) + ' 1/min liegen über der zulässigen Eingangsdrehzahl von ' + Math.round(v.nMax) + ' 1/min. Das Getriebe wird zu laut und verschleißt.', 'warn'); }
      if (!st.overspeed) S.overSpeed = false;
      if (!v.a.lube && S.nSet > 100) { S.lubeOffT += 0.01; if (!S.lubeWarn && S.lubeOffT > 0.4) { S.lubeWarn = true; say('Keine Schmierung! Die Reibung steigt, der Wirkungsgrad sinkt und das Getriebe wird heiß.', 'warn'); } }
      if (v.a.lube) { S.lubeWarn = false; S.lubeOffT = 0; }
      if (st.overheat && !S.overHeat) { S.overHeat = true; say('Überhitzung! Das Getriebe ist ' + Math.round(S.temp) + ' °C heiß' + (v.a.lube ? '.' : ' – ohne Schmierung entstehen große Reibungsverluste. Schmierung einschalten und abkühlen lassen.'), 'error', 'overheat', 330, 150); }
      else if (S.overHeat && S.temp < 70) { S.overHeat = false; say('Das Getriebe ist wieder abgekühlt.', 'info'); }
    }

    function readMeters() {
      const v = view();
      return { ratio: v.i, nOut: S.nOut, mOut: S.mOut, pIn: S.pIn, pOut: S.pOut, pLoss: S.pLoss, eta: S.eta * 100, temp: S.temp };
    }
    function state() {
      const v = view(), st = S.st;
      const faults = [];
      if (S.broken) faults.push(v.a.stages[S.brokenStage] && v.a.stages[S.brokenStage].type === 'riemen' ? 'Riemenriss' : 'Zahnbruch');
      else if (st.overload) faults.push('Überlast');
      if (st.overheat) faults.push('Überhitzung');
      if (st.overspeed) faults.push('Überdrehzahl');
      if (S.stalled) faults.push('Last zu groß');
      return {
        t: S.t, ratio: v.i, i: v.i, stages: v.a.stages.map(s => ({ type: s.type, zIn: s.zIn, zOut: s.zOut, i: s.i, eta: s.eta })),
        nIn: S.wIn * 30 / Math.PI, nOut: S.nOut, rpm: S.nOut, mIn: S.broken ? 0 : S.mInEff, mOut: S.mOut, torque: S.mOut,
        pIn: S.pIn, pOut: S.pOut, power: S.pOut, pLoss: S.pLoss, eta: S.eta, etaMesh: v.eta0, temp: S.temp, drag: st.mDrag,
        mLimit: v.a.lim, overload: S.broken || st.overload, broken: S.broken, brokenStage: S.brokenStage, overSpeed: !!st.overspeed, stalled: S.stalled, dirOut: v.dirOut,
        selfLocking: v.selfLocking, nSet: S.nSet, mOutAvail: S.mAvail, fault: faults.length > 0, faults
      };
    }
    function reset() { initState(); }

    function curves() {
      const v = view(), gp = gb.params;
      const nIn = S.nSet, i = v.i, eta0 = v.eta0, lim = Math.min(Math.max(v.a.lim, 10), 400);
      const pe = [];
      const mInMax = lim * 1.2 / (i * eta0);
      for (let k = 1; k <= 60; k++) {
        const mIn = mInMax * k / 60;
        const r = gb.apply({ nIn: Math.max(nIn, 1), mIn });
        pe.push([+r.mOut.toFixed(2), +(Math.max(0, r.eta) * 100).toFixed(2)]);
      }
      const dragIn = gb.apply({ nIn: Math.max(nIn, 1), mIn: 0 }).mDrag;
      const mIv = [], nOv = [];
      for (let k = 0; k <= 60; k++) {
        const ii = 0.25 * Math.pow(40, k / 60);
        nOv.push([+ii.toFixed(3), +(nIn / ii).toFixed(1)]);
        mIv.push([+ii.toFixed(3), +(Math.max(0, num(ctl.mIn, 0) - dragIn) * ii * eta0).toFixed(2)]);
      }
      return [
        { id: 'eta-last', title: 'Wirkungsgrad über Last', xLabel: 'Moment am Ausgang', xUnit: 'Nm', yLabel: 'Wirkungsgrad', yUnit: '%', series: [{ name: 'η (mit Leerlaufverlusten)', points: pe }, { name: 'η Verzahnung', points: [[0, eta0 * 100], [lim * 1.2, eta0 * 100]] }], marker: { x: S.mOut, y: S.eta * 100 } },
        { id: 'n-i', title: 'Ausgangsdrehzahl über Übersetzung', xLabel: 'Übersetzung i', xUnit: '', yLabel: 'Ausgangsdrehzahl', yUnit: '1/min', series: [{ name: 'n_aus = n_ein / i', points: nOv }], marker: { x: i, y: S.nOut } },
        { id: 'm-i', title: 'Ausgangsmoment über Übersetzung', xLabel: 'Übersetzung i', xUnit: '', yLabel: 'Ausgangsmoment', yUnit: 'Nm', series: [{ name: 'M_aus = M_ein · i · η', points: mIv }], marker: { x: i, y: S.mOut } }
      ];
    }

    initState();
    function lastView() { return view(); }

    // ---------- Zeichnen ----------
    const L = { lube: [30, 470, 170, 54] };
    function hitTest(px, py, w, h) {
      const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
      const x = (px - ox) / s, y = (py - oy) / s;
      const r = L.lube;
      if (x >= r[0] - 4 && x <= r[0] + r[2] + 4 && y >= r[1] - 4 && y <= r[1] + r[3] + 4) return { key: 'lube', kind: 'switch' };
      return null;
    }
    function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
    function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
    function panel(ctx, x, y, w, h, title) { rr(ctx, x, y, w, h, 12); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke(); if (title) txt(ctx, title, x + 14, y + 18, 13, C.dim, 'left', '700'); }
    function glow(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

    const CX = 327, CY = 214, VK = 0.04; // Zeitlupe ~ x25

    // Module in Pixel je Zahn und Positionen
    function geomPositions(stages, which) {
      const worm = stages[0].type === 'schnecke', belt = stages[0].type === 'riemen';
      const out = { mod: 3, gears: [], mx: CX, my: CY };
      if (belt) {
        const mod = Math.min(5, 240 / (Math.max(stages[0].zIn, stages[0].zOut) + 2) / 0.9);
        if (stages.length === 1) {
          const r1 = stages[0].zIn * mod / 2 * 0.9, r2 = stages[0].zOut * mod / 2 * 0.9, d = 300;
          const x1 = CX - d / 2, x2 = CX + d / 2;
          out.mod = mod; out.gears = [{ x: x1, y: CY, r: r1, z: stages[0].zIn }, { x: x2, y: CY, r: r2, z: stages[0].zOut }]; out.mx = CX; out.my = CY - Math.max(r1, r2) - 6;
        } else {
          const m2 = Math.min(mod, 2.6);
          const r = (z) => z * m2 / 2 * 0.9;
          const d1 = 200, d2 = 200; const x1 = 90 + r(stages[0].zIn) - 0, x2 = x1 + d1, x4 = x2 + d2;
          out.mod = m2; out.gears = [{ x: x1, y: CY, r: r(stages[0].zIn), z: stages[0].zIn }, { x: x2, y: CY, r: r(stages[0].zOut), z: stages[0].zOut }, { x: x2, y: CY, r: r(stages[1].zIn), z: stages[1].zIn }, { x: x4, y: CY, r: r(stages[1].zOut), z: stages[1].zOut }];
          out.mx = x2; out.my = CY - 40;
        }
        return out;
      }
      if (worm) {
        const z2 = stages[0].zOut, g = stages[0].zIn;
        let mod = Math.min(5, 200 / z2);
        if (stages.length === 2) mod = Math.min(mod, 3.4, 150 / z2);
        const r2 = z2 * mod / 2, rw = 26;
        const wx = stages.length === 1 ? CX : 160, wy = CY - 34;
        out.mod = mod; out.gears = [{ x: wx, y: wy, r: r2, z: z2 }];
        out.worm = { x: wx, y: wy + r2 + rw - 2, r: rw, g, len: Math.max(220, 2 * r2 * 0.9) };
        out.mx = wx; out.my = wy + r2;
        if (stages.length === 2) {
          const z3 = stages[1].zIn, z4 = stages[1].zOut;
          const r3 = z3 * mod / 2, r4 = z4 * mod / 2, x3 = wx + 0, x4 = x3 + r3 + r4;
          out.gears.push({ x: x3, y: wy, r: r3, z: z3 }, { x: x4, y: wy, r: r4, z: z4 });
          out.mx = (which === 1) ? (x3 + r3) : wx; out.my = (which === 1) ? wy : wy + r2;
        }
        return out;
      }
      // Stirnrad
      if (stages.length === 1) {
        const z1 = stages[0].zIn, z2 = stages[0].zOut;
        const mod = Math.min(7.5, 580 / (z1 + z2), 240 / (Math.max(z1, z2) + 2));
        const r1 = z1 * mod / 2, r2 = z2 * mod / 2;
        const x1 = CX - r2, x2 = CX + r1;
        out.mod = mod; out.gears = [{ x: x1, y: CY, r: r1, z: z1 }, { x: x2, y: CY, r: r2, z: z2 }]; out.mx = x1 + r1; out.my = CY;
      } else {
        const z1 = stages[0].zIn, z2 = stages[0].zOut, z3 = stages[1].zIn, z4 = stages[1].zOut;
        const mod = Math.min(6, 590 / ((2 * z1 + z2 + z3 + 2 * z4) / 2), 240 / (Math.max(z1, z2, z3, z4) + 2));
        const r = (z) => z * mod / 2;
        const span = r(z1) * 2 + (z1 + z2) * mod / 2 - r(z1) + (z3 + z4) * mod / 2 + r(z4) - 0;
        const total = (z1 + z2) * mod / 2 + (z3 + z4) * mod / 2 + r(z1) + r(z4);
        const x1 = CX - total / 2 + r(z1), x2 = x1 + (z1 + z2) * mod / 2, x4 = x2 + (z3 + z4) * mod / 2;
        out.mod = mod; out.gears = [{ x: x1, y: CY, r: r(z1), z: z1 }, { x: x2, y: CY, r: r(z2), z: z2 }, { x: x2, y: CY, r: r(z3), z: z3 }, { x: x4, y: CY, r: r(z4), z: z4 }];
        out.mx = which === 1 ? x2 + r(z3) : x1 + r(z1); out.my = CY;
      }
      return out;
    }

    function gearPath(ctx, cx, cy, z, mod, ang, missing) {
      const r = z * mod / 2, ra = r + mod, rf = r - 1.25 * mod;
      const ph = Math.PI / (2 * z);
      ctx.beginPath();
      for (let k = 0; k < z; k++) {
        const a = ang + k * TAU / z;
        if (missing === k) {
          // abgebrochener Zahn: nur Stumpf
          const hr = ph * 1.8, rs = rf + 0.6 * mod;
          ctx.lineTo(cx + Math.cos(a - hr) * rf, cy + Math.sin(a - hr) * rf);
          ctx.lineTo(cx + Math.cos(a - ph) * rs, cy + Math.sin(a - ph) * rs);
          ctx.lineTo(cx + Math.cos(a + ph) * (rs - 0.3 * mod), cy + Math.sin(a + ph) * (rs - 0.3 * mod));
          ctx.lineTo(cx + Math.cos(a + hr) * rf, cy + Math.sin(a + hr) * rf);
          continue;
        }
        const pts = [[-1.8, rf], [-0.355, ra], [0.355, ra], [1.8, rf]];
        for (let j = 0; j < 4; j++) { const aa = a + pts[j][0] * ph, rr2 = pts[j][1]; const px = cx + Math.cos(aa) * rr2, py = cy + Math.sin(aa) * rr2; if (k === 0 && j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py); }
      }
      ctx.closePath();
    }
    function drawGear(ctx, g, mod, ang, rim, missing, spokes, alpha) {
      ctx.save(); ctx.globalAlpha = alpha == null ? 1 : alpha;
      gearPath(ctx, g.x, g.y, g.z, mod, ang, missing);
      const gr = ctx.createRadialGradient(g.x - g.r * 0.3, g.y - g.r * 0.3, g.r * 0.1, g.x, g.y, g.r + mod);
      gr.addColorStop(0, '#a9b6c3'); gr.addColorStop(0.6, '#7d8b99'); gr.addColorStop(1, '#5d6a77');
      ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = rim; ctx.lineWidth = 2; ctx.stroke();
      // Teilkreis
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      // Scheibe mit Aussparungen
      const rb = g.r - 1.25 * mod;
      ctx.fillStyle = '#2b333c'; ctx.beginPath(); ctx.arc(g.x, g.y, Math.max(rb - 8, 4), 0, TAU); ctx.fill();
      ctx.fillStyle = '#8f9cab'; ctx.beginPath(); ctx.arc(g.x, g.y, Math.max(rb - 10, 3), 0, TAU); ctx.fill();
      if (spokes && rb > 40) {
        const n = 5, ri = rb * 0.62, ro = rb * 0.2;
        for (let k = 0; k < n; k++) { const a = ang + k * TAU / n; ctx.fillStyle = '#2b333c'; ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * (rb * 0.5), g.y + Math.sin(a) * (rb * 0.5), rb * 0.17, 0, TAU); ctx.fill(); }
      }
      // Nabe + Passfeder
      ctx.fillStyle = '#c9d3dd'; ctx.beginPath(); ctx.arc(g.x, g.y, Math.min(14, rb * 0.3), 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a444f'; ctx.beginPath(); ctx.arc(g.x, g.y, Math.min(7, rb * 0.15), 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a444f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(g.x, g.y); ctx.lineTo(g.x + Math.cos(ang) * Math.min(14, rb * 0.3), g.y + Math.sin(ang) * Math.min(14, rb * 0.3)); ctx.stroke();
      // Markierung auf der Radscheibe (Drehung sichtbar)
      ctx.fillStyle = rim; ctx.beginPath(); ctx.arc(g.x + Math.cos(ang) * (rb - 14), g.y + Math.sin(ang) * (rb - 14), 4, 0, TAU); ctx.fill();
      ctx.restore();
    }
    function zLabel(ctx, label, g, mod, below) {
      const rb = g.r - 1.25 * mod, sz = clamp(rb * 0.2, 11, 19), y = g.y + (below ? 1 : -1) * Math.max(rb * 0.42, 22);
      ctx.font = '800 ' + sz + 'px ' + FONT; const tw = ctx.measureText(label).width + 12;
      rr(ctx, g.x - tw / 2, y - sz * 0.8, tw, sz * 1.6, 6); ctx.fillStyle = 'rgba(16,21,26,0.82)'; ctx.fill();
      txt(ctx, label, g.x, y, sz, '#ffffff', 'center', '800');
    }
    function curvedArrow(ctx, x, y, r, dir, col, label, sub, capY) {
      if (!(Math.abs(dir) > 0)) return;
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 4; ctx.lineCap = 'round';
      const a0 = -2.6, a1 = -0.55;
      ctx.beginPath();
      if (dir > 0) ctx.arc(x, y, r, a0, a1, false); else ctx.arc(x, y, r, a1, a0, true);
      ctx.stroke();
      const ae = dir > 0 ? a1 : a0, tx = x + Math.cos(ae) * r, ty = y + Math.sin(ae) * r;
      const tang = ae + (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(tx + Math.cos(tang) * 9, ty + Math.sin(tang) * 9);
      ctx.lineTo(tx + Math.cos(tang + 2.5) * 9, ty + Math.sin(tang + 2.5) * 9); ctx.lineTo(tx + Math.cos(tang - 2.5) * 9, ty + Math.sin(tang - 2.5) * 9); ctx.closePath(); ctx.fill();
      if (sub) txt(ctx, sub, x, y + capY, 12, col, 'center', '800');
    }
    function drops(ctx, x, y, t, n, col) {
      for (let i = 0; i < n; i++) {
        const ph = ((t * 0.0006 * (0.7 + hash(i * 3)) + hash(i + 17)) % 1);
        const dx = x + (hash(i + 5) - 0.5) * 60, dy = y - 70 + ph * 70;
        ctx.fillStyle = col.replace('A', String(0.9 * Math.sin(ph * Math.PI)));
        ctx.beginPath(); ctx.moveTo(dx, dy - 6); ctx.quadraticCurveTo(dx + 4, dy + 1, dx, dy + 4); ctx.quadraticCurveTo(dx - 4, dy + 1, dx, dy - 6); ctx.fill();
      }
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      const s = Math.min(w / W, h / H);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
      const c = view();
      const a = c.a, stages = a.stages;
      const worm = ctl.type === 'schnecke', belt = ctl.type === 'riemen';
      panel(ctx, 14, 14, 626, 440, null);
      txt(ctx, 'Getriebe-Prüfstand · ' + TYPE_NAME[ctl.type] + (stages.length === 2 ? ', zweistufig' : ', einstufig'), 30, 34, 18, C.text, 'left', '800');
      txt(ctx, 'Zeitlupe ×25 · gleiches Modul: Zahnteilung gleich', 30, 54, 11, C.dim, 'left', '600');
      const pos = geomPositions(stages, S.broken ? S.brokenStage : 0);
      const mod = pos.mod;
      const a1 = S.a1 * VK;
      const dir = S.wIn > 0.05 ? 1 : 0;
      const shake = S.broken && S.t - S.brokenT < 1500 ? (1 - (S.t - S.brokenT) / 1500) * 3 : 0;
      ctx.save(); if (shake > 0) ctx.translate(Math.sin(t * 0.09) * shake, Math.cos(t * 0.11) * shake);
      const heat = clamp((S.temp - 45) / 50, 0, 1);
      // Winkel der Raeder
      const ang = [];
      let inCol = '#3b9eff', outCol = '#4cd964';
      if (!belt && !worm) {
        const g = pos.gears;
        // Stufe 1
        const z1 = stages[0].zIn, z2 = stages[0].zOut;
        ang[0] = a1;
        ang[1] = Math.PI - Math.PI / z2 - (z1 / z2) * a1;
        if (stages.length === 2) {
          const z3 = stages[1].zIn, z4 = stages[1].zOut;
          ang[2] = ang[1] - (Math.PI - Math.PI / z2);
          ang[3] = Math.PI - Math.PI / z4 - (z3 / z4) * ang[2];
        }
        const brokenIdx = S.broken ? { gi: S.brokenStage === 0 ? 0 : 2, tooth: 0 } : null;
        // Zeichenreihenfolge: Rad 2, Rad 3 oben, Rad 4, Rad 1
        const order = stages.length === 2 ? [1, 3, 2, 0] : [1, 0];
        const drawing = (gi) => {
          const rim = gi === 0 ? inCol : (gi === stages.length * 2 - 1 ? outCol : '#ffb340');
          drawGear(ctx, g[gi], mod, ang[gi], rim, brokenIdx && brokenIdx.gi === gi ? 0 : null, g[gi].r > 40);
        };
        order.forEach(drawing);
        // Hinweis Wellen
        // Pfeile
        const gOut = g[g.length - 1];
        const dOut = S.wIn > 0.05 ? (stages.reduce((d, st) => d * -1, 1)) : 0;
        curvedArrow(ctx, g[0].x, g[0].y, Math.min(g[0].r * 0.7, 54), dir ? 1 : 0, inCol, Math.round(S.wIn * 30 / Math.PI) + ' 1/min', 'Antrieb', g[0].r + mod + 16);
        curvedArrow(ctx, gOut.x, gOut.y, Math.min(gOut.r * 0.7, 54), dOut, outCol, Math.round(S.nOut) + ' 1/min', 'Abtrieb', gOut.r + mod + 16);
        // Zaehnezahlen
        g.forEach((gg, gi) => zLabel(ctx, 'z' + (gi + 1) + ' = ' + gg.z, gg, mod, gi === 2));
        // Schmierung am Eingriff
        const meshes = stages.length === 2 ? [[g[0], g[1]], [g[2], g[3]]] : [[g[0], g[1]]];
        meshes.forEach(([A, B], mi) => {
          const mx = A.x + A.r, my = A.y;
          if (a.lube) {
            if (!S.broken) { glow(ctx, mx, my, 22, '255,200,70', 0.18); drops(ctx, mx, my - 6, t, 5, 'rgba(255,205,70,A)'); }
          } else if (S.wIn > 0.5) { glow(ctx, mx, my, 34, '255,90,40', 0.25 + 0.3 * heat + 0.1 * Math.sin(t * 0.03)); }
          // Eingriffsmarke
          ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(mx, my - Math.max(A.r, B.r) * 0.9); ctx.lineTo(mx, my + Math.max(A.r, B.r) * 0.9); ctx.stroke(); ctx.setLineDash([]);
        });
        // Teilung
        if (stages.length === 1) txt(ctx, 'Zahnteilung p = π · m (gleich bei beiden Rädern)', CX, 76, 11, C.dim, 'center', '600');
      } else if (belt) {
        const g = pos.gears;
        // einfacher: Riemen aus zwei Tangenten und zwei Boegen
        const beltPath = (A, B) => {
          const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy), ang0 = Math.atan2(dy, dx);
          const off = Math.acos(clamp((A.r - B.r) / d, -1, 1));
          const pA1 = [A.x + Math.cos(ang0 + off) * (A.r + 5), A.y + Math.sin(ang0 + off) * (A.r + 5)];
          const pB1 = [B.x + Math.cos(ang0 + off) * (B.r + 5), B.y + Math.sin(ang0 + off) * (B.r + 5)];
          const pA2 = [A.x + Math.cos(ang0 - off) * (A.r + 5), A.y + Math.sin(ang0 - off) * (A.r + 5)];
          const pB2 = [B.x + Math.cos(ang0 - off) * (B.r + 5), B.y + Math.sin(ang0 - off) * (B.r + 5)];
          ctx.beginPath();
          ctx.moveTo(pA1[0], pA1[1]); ctx.lineTo(pB1[0], pB1[1]);
          ctx.arc(B.x, B.y, B.r + 5, ang0 + off, ang0 - off + 0, true);
          ctx.lineTo(pA2[0], pA2[1]);
          ctx.arc(A.x, A.y, A.r + 5, ang0 - off, ang0 + off + 0, true);
          ctx.closePath();
        };
        const drawBeltPair = (A, B, aA, aB, z1, z2, brokenB) => {
          if (brokenB) {
            // gerissenes Band: haengt herunter
            ctx.strokeStyle = '#1e242a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(A.x + A.r * 0.3, A.y - A.r - 5); ctx.quadraticCurveTo(A.x + 40, A.y - A.r + 40, A.x + 70, A.y + A.r + 40); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(B.x - B.r * 0.3, B.y - B.r - 5); ctx.quadraticCurveTo(B.x - 40, B.y - B.r + 30, B.x - 60, B.y + B.r + 40); ctx.stroke();
          } else {
            beltPath(A, B);
            ctx.lineWidth = 10; ctx.strokeStyle = '#1e242a'; ctx.lineJoin = 'round'; ctx.stroke();
            const phase = aA * A.r;
            ctx.setLineDash([5, 6]); ctx.lineDashOffset = -phase; ctx.lineWidth = 7; ctx.strokeStyle = '#59636f'; ctx.stroke(); ctx.setLineDash([]);
          }
          [[A, aA, z1], [B, aB, z2]].forEach(([P, ap, z], k) => {
            const cm = Math.max(1.2, P.r * 0.1);
            ctx.save(); ctx.beginPath(); ctx.arc(P.x, P.y, P.r, 0, TAU); const gr = ctx.createRadialGradient(P.x - P.r * 0.3, P.y - P.r * 0.3, 4, P.x, P.y, P.r); gr.addColorStop(0, '#b0bcc8'); gr.addColorStop(1, '#5d6a77'); ctx.fillStyle = gr; ctx.fill(); ctx.strokeStyle = k ? outCol : inCol; ctx.lineWidth = 3; ctx.stroke();
            // Zaehne der Scheibe (Teilung am Umfang)
            ctx.strokeStyle = 'rgba(30,36,42,0.8)'; ctx.lineWidth = 2;
            const nT = Math.min(z, 60);
            for (let q = 0; q < nT; q++) { const aa = ap + q * TAU / nT; ctx.beginPath(); ctx.moveTo(P.x + Math.cos(aa) * (P.r - 7), P.y + Math.sin(aa) * (P.r - 7)); ctx.lineTo(P.x + Math.cos(aa) * (P.r - 1), P.y + Math.sin(aa) * (P.r - 1)); ctx.stroke(); }
            ctx.fillStyle = '#2b333c'; ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(P.r - 12, 4), 0, TAU); ctx.fill();
            ctx.fillStyle = '#8f9cab'; ctx.beginPath(); ctx.arc(P.x, P.y, Math.max(P.r - 14, 3), 0, TAU); ctx.fill();
            ctx.fillStyle = '#c9d3dd'; ctx.beginPath(); ctx.arc(P.x, P.y, 10, 0, TAU); ctx.fill();
            ctx.fillStyle = k ? outCol : inCol; ctx.beginPath(); ctx.arc(P.x + Math.cos(ap) * (P.r - 22 > 8 ? P.r - 22 : P.r * 0.5), P.y + Math.sin(ap) * (P.r - 22 > 8 ? P.r - 22 : P.r * 0.5), 4, 0, TAU); ctx.fill();
            ctx.restore();
          });
        };
        const z = (k) => stages[k];
        const a2 = a1 * z(0).zIn / z(0).zOut;
        const brokenBelt = S.broken && S.brokenStage === 0;
        drawBeltPair(g[0], g[1], a1, a2, z(0).zIn, z(0).zOut, brokenBelt);
        if (stages.length === 2) {
          const a3 = a2, a4 = a3 * z(1).zIn / z(1).zOut;
          drawBeltPair(g[2], g[3], a3, a4, z(1).zIn, z(1).zOut, S.broken && S.brokenStage === 1);
        }
        zLabel(ctx, 'z1 = ' + z(0).zIn, g[0], 2, false);
        zLabel(ctx, 'z2 = ' + z(0).zOut, g[1], 2, false);
        if (stages.length === 2) { zLabel(ctx, 'z3 = ' + z(1).zIn, g[2], 2, true); zLabel(ctx, 'z4 = ' + z(1).zOut, g[3], 2, false); }
        curvedArrow(ctx, g[0].x, g[0].y, Math.min(g[0].r * 0.6, 40), dir ? 1 : 0, inCol, Math.round(S.wIn * 30 / Math.PI) + ' 1/min', 'Antrieb', g[0].r + mod + 16);
        const go = g[g.length - 1];
        curvedArrow(ctx, go.x, go.y, Math.min(go.r * 0.6, 40), S.wIn > 0.05 ? 1 : 0, outCol, Math.round(S.nOut) + ' 1/min', 'Abtrieb', go.r + mod + 16);
        txt(ctx, 'Zahnriemen: kein Schlupf, Drehrichtung bleibt gleich', CX, 76, 11, C.dim, 'center', '600');
      } else {
        // Schnecke
        const g = pos.gears, wo = pos.worm;
        const aw = a1, a2 = a1 * stages[0].zIn / stages[0].zOut;
        // Schneckenrad: Zaehne drehen sich
        const brokenW = S.broken && S.brokenStage === 0 ? 0 : null;
        if (stages.length === 2) {
          // Rad 2 (Schneckenrad) und Ritzel 3 auf der gleichen Welle; Ritzel 3 wird darueber gezeichnet
          const g3 = g[1], g4 = g[2];
          const a3 = a2, a4 = Math.PI - Math.PI / stages[1].zOut - (stages[1].zIn / stages[1].zOut) * a3;
          drawGear(ctx, g[0], mod, a2, '#ffb340', S.broken && S.brokenStage === 0 ? 0 : null, g[0].r > 40);
          drawGear(ctx, g4, mod, a4, '#4cd964', null, g4.r > 40);
          drawGear(ctx, g3, mod, a3, '#ffb340', S.broken && S.brokenStage === 1 ? 0 : null, g3.r > 40, 1);
          txt(ctx, 'z3 = ' + stages[1].zIn, g3.x, g3.y, 12, '#10151a', 'center', '900'); txt(ctx, 'z4 = ' + stages[1].zOut, g4.x, g4.y, 12, '#10151a', 'center', '900');
          curvedArrow(ctx, g4.x, g4.y, Math.min(g4.r * 0.6, 50), S.wIn > 0.05 ? 1 : 0, '#4cd964', Math.round(S.nOut) + ' 1/min', 'Abtrieb', -g4.r - mod - 10);
        } else {
          drawGear(ctx, g[0], mod, a2, '#4cd964', brokenW, g[0].r > 40);
          curvedArrow(ctx, g[0].x, g[0].y, Math.min(g[0].r * 0.6, 50), S.wIn > 0.05 ? 1 : 0, '#4cd964', Math.round(S.nOut) + ' 1/min', 'Abtrieb', -g[0].r - mod - 10);
        }
        txt(ctx, 'z2 = ' + stages[0].zOut, g[0].x, g[0].y + (stages.length === 2 ? 26 : 0), 14, '#10151a', 'center', '900');
        // Schnecke (waagerechte Welle)
        const x0 = wo.x - wo.len / 2, x1 = wo.x + wo.len / 2;
        const lead = Math.PI * mod; // axialer Teilungsabstand je Zahnteilung
        const gr = ctx.createLinearGradient(0, wo.y - wo.r, 0, wo.y + wo.r); gr.addColorStop(0, '#d0dae3'); gr.addColorStop(0.5, '#8d9aa8'); gr.addColorStop(1, '#505c68');
        ctx.fillStyle = gr; ctx.fillRect(x0, wo.y - wo.r, wo.len, wo.r * 2);
        ctx.save(); ctx.beginPath(); ctx.rect(x0, wo.y - wo.r, wo.len, wo.r * 2); ctx.clip();
        const pitch = lead; const shift = (aw * wo.g * pitch / TAU) % pitch;
        const nl = Math.ceil(wo.len / (pitch / wo.g)) + 2;
        ctx.strokeStyle = 'rgba(25,32,40,0.75)'; ctx.lineWidth = 4;
        for (let k = -2; k < nl; k++) {
          const xs = x0 + k * pitch / wo.g + (shift % (pitch / wo.g));
          ctx.beginPath(); ctx.moveTo(xs, wo.y - wo.r); ctx.lineTo(xs + pitch * 0.35, wo.y + wo.r); ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = inCol; ctx.lineWidth = 3; ctx.strokeRect(x0, wo.y - wo.r, wo.len, wo.r * 2);
        ctx.fillStyle = '#c9d3dd'; ctx.fillRect(x0 - 30, wo.y - 6, 30, 12); ctx.fillRect(x1, wo.y - 6, 20, 12);
        // Pfeil Eingang
        if (S.wIn > 0.05) {
          ctx.strokeStyle = inCol; ctx.fillStyle = inCol; ctx.lineWidth = 5; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x0 - 70, wo.y + 38); ctx.lineTo(x0 - 20, wo.y + 38); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x0 - 8, wo.y + 38); ctx.lineTo(x0 - 24, wo.y + 30); ctx.lineTo(x0 - 24, wo.y + 46); ctx.closePath(); ctx.fill();
        }
        txt(ctx, 'Schnecke · ' + wo.g + ' Gang' + (wo.g > 1 ? 'änge' : '') + ' · ' + Math.round(S.wIn * 30 / Math.PI) + ' 1/min', wo.x, wo.y + wo.r + 22, 13, inCol, 'center', '800');
        txt(ctx, 'i = z2 / Gangzahl = ' + stages[0].zOut + ' / ' + stages[0].zIn, wo.x, wo.y + wo.r + 40, 12, C.dim, 'center', '700');
        if (a.lube && !S.broken) { glow(ctx, wo.x, wo.y - wo.r, 24, '255,200,70', 0.2); drops(ctx, wo.x, wo.y - wo.r - 2, t, 5, 'rgba(255,205,70,A)'); }
        else if (!a.lube && S.wIn > 0.5) glow(ctx, wo.x, wo.y - wo.r, 40, '255,90,40', 0.3 + 0.3 * heat);
      }
      // Zahnbruch: Funken und Splitter
      if (S.broken) {
        const age = S.t - S.brokenT;
        const mx = pos.mx, my = pos.my;
        if (age < 2500) {
          const k = 1 - age / 2500;
          glow(ctx, mx, my, 50 + 30 * k, '255,200,80', 0.5 * k);
          for (let i = 0; i < 18; i++) {
            const an = hash(i * 7) * TAU, sp = 40 + hash(i * 3 + 1) * 160, tt = age / 1000;
            const px = mx + Math.cos(an) * sp * tt, py = my + Math.sin(an) * sp * tt + 120 * tt * tt;
            ctx.fillStyle = 'rgba(255,' + Math.round(150 + hash(i) * 100) + ',60,' + (k * (0.4 + 0.6 * hash(i + 2))) + ')';
            ctx.beginPath(); ctx.arc(px, py, 2 + hash(i + 4) * 2, 0, TAU); ctx.fill();
          }
        }
        if (Math.floor(t / 300) % 2 === 0) { rr(ctx, CX - 130, 70, 260, 34, 8); ctx.fillStyle = 'rgba(255,92,92,0.92)'; ctx.fill(); txt(ctx, (stages[S.brokenStage].type === 'riemen' ? 'RIEMEN GERISSEN' : 'ZAHNBRUCH · Getriebe blockiert'), CX, 87, 15, '#2a0a0a', 'center', '900'); }
      }
      if (S.overHeat || heat > 0.5) {
        for (let i = 0; i < 7; i++) {
          const ph = ((t * 0.00035 * (0.6 + hash(i)) + hash(i + 9)) % 1);
          const px = CX - 100 + hash(i + 3) * 200, py = 110 - ph * 70;
          ctx.fillStyle = 'rgba(190,196,206,' + (0.5 * (1 - ph) * clamp(heat, 0.3, 1)) + ')'; ctx.beginPath(); ctx.arc(px + Math.sin(t * 0.002 + i) * 10, py, 8 + ph * 22, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();

      // Eingangs-/Ausgangskaesten oben
      const boxW = 196;
      rr(ctx, 26, 366, boxW, 76, 10); ctx.fillStyle = 'rgba(59,158,255,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(59,158,255,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'EINGANG (Motor)', 38, 382, 12, C.acc, 'left', '800');
      txt(ctx, 'n₁ = ' + Math.round(S.wIn * 30 / Math.PI) + ' 1/min', 38, 402, 14, C.text, 'left', '800');
      txt(ctx, 'M₁ = ' + fmt(S.broken ? 0 : S.mInEff, 1) + ' Nm   P = ' + Math.round(S.pIn) + ' W', 38, 424, 13, C.text, 'left', '700');
      rr(ctx, 640 - 26 - boxW, 366, boxW, 76, 10); ctx.fillStyle = 'rgba(76,217,100,0.12)'; ctx.fill(); ctx.strokeStyle = 'rgba(76,217,100,0.6)'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'AUSGANG (Last)', 640 - 14 - boxW, 382, 12, C.ok, 'left', '800');
      txt(ctx, 'n₂ = ' + Math.round(S.nOut) + ' 1/min', 640 - 14 - boxW, 402, 14, C.text, 'left', '800');
      txt(ctx, 'M₂ = ' + fmt(S.mOut, 1) + ' Nm   P = ' + Math.round(S.pOut) + ' W', 640 - 14 - boxW, 424, 13, C.text, 'left', '700');
      // Mittelfeld: i
      txt(ctx, 'i = ' + fmt(c.i, 2), CX, 396, 24, C.warn, 'center', '900');
      txt(ctx, c.i > 1 ? 'Untersetzung: langsamer, mehr Moment' : c.i < 1 ? 'Übersetzung ins Schnelle: schneller, weniger Moment' : 'Übersetzung 1:1', CX, 420, 11, C.dim, 'center', '600');

      // Rechenweg
      panel(ctx, 652, 14, 334, 276, 'Rechenweg');
      let y = 52;
      const line = (lbl, formula, val, col) => { txt(ctx, lbl, 668, y, 11, C.dim, 'left', '700'); y += 17; txt(ctx, formula, 668, y, 12, C.text, 'left', '600'); txt(ctx, val, 970, y, 15, col || C.text, 'right', '800'); y += 27; };
      const st0 = stages[0];
      if (stages.length === 1) line('Übersetzung', 'i = ' + (worm ? 'z2 / Gangzahl' : 'z2 / z1') + ' = ' + st0.zOut + ' / ' + st0.zIn, fmt(c.i, 2), C.warn);
      else line('Übersetzung', 'i = (z2/z1) · (z4/z3) = ' + fmt(st0.i, 2) + ' · ' + fmt(stages[1].i, 2), fmt(c.i, 2), C.warn);
      line('Ausgangsdrehzahl', 'n₂ = n₁ / i = ' + Math.round(S.wIn * 30 / Math.PI) + ' / ' + fmt(c.i, 2), Math.round(S.nOut) + ' 1/min', C.ok);
      line('Ausgangsmoment', 'M₂ = M₁ · i · η = ' + fmt(S.broken ? 0 : S.mInEff, 1) + ' · ' + fmt(c.i, 2) + ' · ' + fmt(c.eta0, 2), fmt(S.mOut, 1) + ' Nm', C.ok);
      line('Wirkungsgrad', 'η = P₂ / P₁ = ' + Math.round(S.pOut) + ' / ' + Math.round(S.pIn), fmt(S.eta * 100, 1) + ' %', S.eta > 0.85 ? C.ok : S.eta > 0.6 ? C.warn : C.bad);
      line('Verlustleistung', 'P_V = P₁ − P₂', Math.round(S.pLoss) + ' W', S.pLoss > 400 ? C.bad : C.warn);
      // Leistungsfluss
      panel(ctx, 652, 300, 334, 246, 'Leistungsfluss und Grenzen');
      const bx = 668, bw = 302;
      const pmax = Math.max(S.pIn, 50);
      rr(ctx, bx, 330, bw, 22, 6); ctx.fillStyle = '#1a2026'; ctx.fill();
      const wOutBar = clamp(S.pOut / pmax, 0, 1) * bw, wLossBar = clamp(S.pLoss / pmax, 0, 1) * bw;
      ctx.fillStyle = C.ok; ctx.fillRect(bx, 330, wOutBar, 22); ctx.fillStyle = C.warn; ctx.fillRect(bx + wOutBar, 330, wLossBar, 22);
      txt(ctx, 'P₁ = ' + Math.round(S.pIn) + ' W  →  P₂ ' + Math.round(S.pOut) + ' W + Verlust ' + Math.round(S.pLoss) + ' W', bx, 366, 12, C.text, 'left', '700');
      // Grenzmoment
      const lim = Math.min(a.lim, 500);
      const mo = S.broken ? S.mOut : S.mOut;
      const maxs = Math.max(lim * 1.4, mo * 1.1, 1);
      rr(ctx, bx, 398, bw, 18, 6); ctx.fillStyle = '#1a2026'; ctx.fill();
      const fill = clamp(mo / maxs, 0, 1) * bw;
      ctx.fillStyle = mo > lim ? C.bad : mo > 0.8 * lim ? C.warn : C.ok; ctx.fillRect(bx, 398, Math.max(fill, 1), 18);
      const lx = bx + clamp(lim / maxs, 0, 1) * bw; ctx.fillStyle = C.bad; ctx.fillRect(lx - 2, 392, 4, 30);
      txt(ctx, 'M₂ ' + fmt(mo, 1) + ' Nm', bx, 436, 12, C.text, 'left', '700');
      txt(ctx, 'Grenzmoment ' + fmt(lim, 1) + ' Nm', bx + bw, 436, 12, C.bad, 'right', '700');
      // Temperatur
      rr(ctx, bx, 462, bw, 14, 6); ctx.fillStyle = '#1a2026'; ctx.fill();
      const tf = clamp((S.temp - 20) / 140, 0, 1);
      ctx.fillStyle = S.overHeat ? C.bad : S.temp > 80 ? C.warn : C.ok; rr(ctx, bx, 462, Math.max(tf * bw, 8), 14, 6); ctx.fill();
      ctx.fillStyle = C.bad; ctx.fillRect(bx + (90 - 20) / 140 * bw - 1, 458, 3, 22);
      txt(ctx, 'Temperatur ' + Math.round(S.temp) + ' °C', bx, 494, 12, S.overHeat ? C.bad : C.text, 'left', '700');
      txt(ctx, 'Wirkungsgrad Bauart ' + fmt(c.eta0 * 100, 0) + ' %', bx + bw, 494, 12, C.dim, 'right', '700');
      txt(ctx, 'z. B. Stirnrad 98 %, Riemen 96 %, Schnecke 50–85 %', bx, 520, 10.5, C.dim, 'left', '600');

      // Schmierung (antippen)
      const lr = L.lube;
      rr(ctx, lr[0], lr[1], lr[2], lr[3], 10); ctx.fillStyle = a.lube ? 'rgba(255,205,70,0.2)' : 'rgba(255,92,92,0.18)'; ctx.fill(); ctx.strokeStyle = a.lube ? C.warn : C.bad; ctx.lineWidth = 2; ctx.stroke();
      // Oelkaennchen
      ctx.fillStyle = a.lube ? '#ffd24a' : '#7a6a4a'; rr(ctx, lr[0] + 12, lr[1] + 20, 28, 20, 4); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(lr[0] + 40, lr[1] + 26); ctx.lineTo(lr[0] + 54, lr[1] + 16); ctx.stroke();
      if (a.lube) { ctx.fillStyle = '#ffd24a'; ctx.beginPath(); ctx.arc(lr[0] + 56, lr[1] + 24 + ((t * 0.04) % 16), 3, 0, TAU); ctx.fill(); }
      txt(ctx, a.lube ? 'Schmierung AN' : 'Schmierung AUS', lr[0] + 66, lr[1] + 20, 13, a.lube ? C.warn : C.bad, 'left', '800');
      txt(ctx, 'antippen zum Umschalten', lr[0] + 66, lr[1] + 38, 10, C.dim, 'left', '600');
      // Stufen-Info
      stages.forEach((st, k) => {
        const x = 220 + k * 210;
        rr(ctx, x, 470, 200, 54, 8); ctx.fillStyle = C.panel2; ctx.fill();
        txt(ctx, 'Stufe ' + (k + 1) + ': ' + TYPE_NAME[st.type] + ' ' + st.zIn + '/' + st.zOut, x + 10, 486, 12, C.text, 'left', '800');
        txt(ctx, 'i = ' + fmt(st.i, 2) + ' · η = ' + fmt(st.eta * 100, 0) + ' %', x + 10, 504, 12, C.dim, 'left', '700');
        txt(ctx, st.type === 'schnecke' && c.selfLocking ? 'selbsthemmend' : 'Zähnezahl-Verhältnis ' + st.zOut + ' : ' + st.zIn, x + 10, 518, 10.5, C.dim, 'left', '600');
      });
      if (S.stalled && !S.broken && Math.floor(t / 400) % 2 === 0) { rr(ctx, CX - 150, 70, 300, 30, 8); ctx.fillStyle = 'rgba(255,179,64,0.92)'; ctx.fill(); txt(ctx, 'LAST ZU GROSS · Welle steht', CX, 85, 14, '#2a1a05', 'center', '900'); }
      if (S.overHeat && Math.floor(t / 400) % 2 === 1) { txt(ctx, 'ÜBERHITZT', 560, 34, 15, C.bad, 'right', '900'); }
      ctx.restore();
    }

    return {
      id: 'getriebe', controls: CONTROLS, meters: METERS, presets: PRESETS, events: ev,
      setControl, getControl, step, readMeters, state, draw, hitTest, curves, reset,
      worldSize() { return { w: W, h: H }; },
      applyPreset(id) { const p = PRESETS.find(q => q.id === id); if (p) Object.keys(p.params).forEach(k => setControl(k, p.params[k])); }
    };
  }

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
