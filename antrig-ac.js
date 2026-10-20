(function (root) {
  'use strict';
  const R = root.ANT_RIGS = root.ANT_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 4: Drehstrom-Asynchronmotor mit Stern-Dreieck und Frequenzumrichter =====
  // Physik: ANT_CORE.induction (Kloss-Kennlinie mit Rotorfrequenz, Stern/Dreieck, FU mit U/f, Strom, cos phi, Verluste, Thermik).
  // Dieser Pruefstand liefert Schuetzlogik, Messgeraete, Kennlinien, Ereignisse und die Animation.
  const W = 1000, H = 560, TAU = Math.PI * 2, SQ3 = Math.sqrt(3), POLES = 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const fmt = (v, d) => (+v).toFixed(d).replace('.', ',');
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // U/f-Kennlinie des Umrichters (relative Spannung zur relativen Frequenz), wie ANT_CORE.induction
  function ufRel(vf, fr, boost) {
    fr = Math.abs(fr); const bo = boost == null ? 0.07 : boost;
    if (vf === 'boost') return Math.min(1, bo + (1 - bo) * fr);
    if (vf === 'quadratisch' || vf === 'quad') return Math.min(1, 0.04 + 0.96 * fr * fr);
    return Math.min(1, fr);
  }

  const CONTROLS = [
    { key: 'source', label: 'Speisung', type: 'select', value: 'netz', options: [{ value: 'netz', label: 'Netz 400 V / 50 Hz fest' }, { value: 'fu', label: 'Frequenzumrichter' }], group: 'Speisung', help: 'Netz: feste 50 Hz über die Schütze. FU: Frequenz und Spannung stellbar.' },
    { key: 'K1', label: 'K1 Netzschütz', type: 'switch', value: false, group: 'Schütze', help: 'Schaltet die Netzspannung zum Motor (bzw. zum Umrichter).' },
    { key: 'K2', label: 'K2 Sternschütz', type: 'switch', value: false, group: 'Schütze', help: 'Schließt den Sternpunkt (W2, U2, V2 verbunden).' },
    { key: 'K3', label: 'K3 Dreieckschütz', type: 'switch', value: false, group: 'Schütze', help: 'Legt die Wicklung in Dreieck. K2 und K3 niemals zugleich!' },
    { key: 'connection', label: 'Schaltung ohne Schütz-Logik', type: 'select', value: 'dreieck', options: [{ value: 'stern', label: 'Stern (Y)' }, { value: 'dreieck', label: 'Dreieck (Δ)' }], group: 'Schütze', help: 'Gilt, wenn weder K2 noch K3 an ist, und beim Umrichter.' },
    { key: 'freq', label: 'Frequenz (FU)', type: 'slider', min: 0, max: 87, step: 0.5, unit: 'Hz', value: 50, group: 'Frequenzumrichter' },
    { key: 'vf', label: 'U/f-Kennlinie', type: 'select', value: 'konstant', options: [{ value: 'konstant', label: 'U/f konstant' }, { value: 'boost', label: 'Boost (mehr U bei kleinem f)' }, { value: 'quadratisch', label: 'Quadratisch (Lüfter)' }], group: 'Frequenzumrichter' },
    { key: 'ramp', label: 'Hochlaufzeit (0 bis 50 Hz)', type: 'slider', min: 0.2, max: 20, step: 0.1, unit: 's', value: 3, group: 'Frequenzumrichter' },
    { key: 'load', label: 'Lastmoment', type: 'slider', min: 0, max: 80, step: 0.1, unit: 'Nm', value: 0, group: 'Last', help: 'Bremse an der Welle. Nennmoment des Motors siehe Typenschild.' },
    { key: 'reverse', label: 'Drehrichtung links (L1/L2 getauscht)', type: 'switch', value: false, group: 'Last' },
    { key: 'phaseLoss', label: 'Phasenausfall (L3 weg)', type: 'switch', value: false, group: 'Fehler' }
  ];
  const METERS = [
    { key: 'rpm', label: 'Drehzahl', unit: '1/min', digits: 0, min: 0, max: 2700 },
    { key: 'slip', label: 'Schlupf', unit: '%', digits: 1, min: 0, max: 100 },
    { key: 'iLine', label: 'Leiterstrom', unit: 'A', digits: 2, min: 0, max: 70 },
    { key: 'cosphi', label: 'cos φ', unit: '', digits: 2, min: 0, max: 1 },
    { key: 'pElec', label: 'P elektrisch', unit: 'W', digits: 0, min: 0, max: 8000 },
    { key: 'pMech', label: 'P mechanisch', unit: 'W', digits: 0, min: 0, max: 6000 },
    { key: 'torque', label: 'Drehmoment', unit: 'Nm', digits: 1, min: 0, max: 80 },
    { key: 'eta', label: 'Wirkungsgrad', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'temp', label: 'Wicklungstemperatur', unit: '°C', digits: 0, min: 20, max: 200, warnAbove: 140 },
    { key: 'uMotor', label: 'Spannung am Motor', unit: 'V', digits: 0, min: 0, max: 420 },
    { key: 'fMotor', label: 'Frequenz am Motor', unit: 'Hz', digits: 1, min: 0, max: 90 }
  ];
  const PRESETS = [
    { id: 'm055', name: 'Motor 0,55 kW (4-polig)', params: { motor: 'm055' } },
    { id: 'm15', name: 'Motor 1,5 kW (4-polig)', params: { motor: 'm15' } },
    { id: 'm4', name: 'Motor 4 kW (4-polig)', params: { motor: 'm4' } },
    { id: 'last0', name: 'Last: Leerlauf', params: { loadRel: 0 } },
    { id: 'last50', name: 'Last: halbe Nennlast', params: { loadRel: 0.5 } },
    { id: 'last100', name: 'Last: Nennlast (M_N)', params: { loadRel: 1 } },
    { id: 'last130', name: 'Last: Überlast (1,3 · M_N)', params: { loadRel: 1.3 } },
    { id: 'last200', name: 'Last: sehr hoch (2,5 · M_N)', params: { loadRel: 2.5 } }
  ];

  R.register({
    id: 'drehstrom', name: 'Drehstrommotor', icon: '🌀',
    info: 'Drehstrom-Asynchronmotor mit Klemmenbrett, Schützen für Stern-Dreieck-Anlauf und Frequenzumrichter. Schalte erst K1 und K2 (Stern), dann K2 aus und K3 an (Dreieck) und vergleiche den Anlaufstrom.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return createRig(opts || {}); }
  });

  function getCore() {
    const c = root.ANT_CORE || (typeof require === 'function' ? require('./antcore.js') : null);
    if (!c || !c.induction) throw new Error('ANT_CORE (antcore.js) ist nicht geladen.');
    return c;
  }
  const THERM = 6; // Zeitraffer der Erwaermung fuer die Vorfuehrung (Zeitkonstante ca. 1 Minute)
  const ALIAS_VF = { konst: 'konstant', quad: 'quadratisch' };

  function createRig(opts) {
    const CORE = getCore();
    let motorId = (opts && opts.motor) || 'm15';
    let ac = null, d = null, pr = null, m = null;
    const ctl = {}; CONTROLS.forEach(c => { ctl[c.key] = c.value; });
    const ev = [];
    let S;
    function newMotor() {
      ac = CORE.induction({ preset: motorId, thermFactor: THERM });
      d = ac.derived; pr = CORE.acPresets[motorId];
      m = { id: motorId, name: pr.name, P: pr.plate.P, IN: pr.plate.iDelta, cos: pr.plate.cosphi, nN: pr.plate.n, eta: pr.plate.eta, MN: d.MN, wN: d.wN, plate: pr.plate };
    }
    function initState() {
      newMotor();
      S = { t: 0, w: 0, thRot: 0, thField: 0, fe: 0, temp: 25, kc: [0, 0, 0], live: false, supply: false, fuse: false, fuTrip: false, conn: 'offen',
        Mmot: 0, Iline: 0, cos: 0, Pel: 0, Pmech: 0, eta: 0, uLine: 0, MKnow: 0, stallFlag: false, shootFlag: false, heatFlag: false, phaseFlag: false,
        inrushFlag: false, lastConn: 'dreieck', k1Prev: false, revPrev: false, startT: -1, limFlag: false, fuFlag: false, st: null };
      ev.length = 0;
      sync(ac.step(0, buildInp(false)));
    }
    function say(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; e.x = x == null ? 450 : x; e.y = y == null ? 200 : y; }
      ev.push(e); if (ev.length > 80) ev.shift();
    }
    const netz = () => ctl.source === 'netz';
    // Eingang fuer den Kern: Ohne K2/K3 gilt die gewaehlte Schaltung ("connection")
    function buildInp() {
      const shoot = netz() && ctl.K2 && ctl.K3;
      const inp = { source: ctl.source, freq: ctl.freq, vf: ctl.vf, ramp: ctl.ramp, load: ctl.load, reverse: !!ctl.reverse, phaseLoss: !!ctl.phaseLoss, connection: ctl.connection };
      if (netz()) {
        inp.K1 = !!ctl.K1 && !S.fuse;
        inp.K2 = !!ctl.K2 || (!ctl.K3 && ctl.connection === 'stern');
        inp.K3 = !!ctl.K3 || (!ctl.K2 && ctl.connection === 'dreieck');
        if (shoot && (S.fuse || !inp.K1)) { inp.K2 = false; inp.K3 = false; }
      } else { inp.enable = !!ctl.K1; }
      return inp;
    }
    function sync(st) {
      S.st = st;
      S.w = st.w; S.fe = st.fSigned; S.Mmot = st.torque; S.Iline = st.iLine; S.cos = st.cosphi; S.Pel = st.pElec; S.Pmech = st.pMech; S.eta = st.eta;
      S.uLine = st.uMotor; S.MKnow = st.mk; S.temp = st.temp; S.stallFlag = !!st.tipped; S.fuTrip = !!st.fuFault; S.live = !!st.on; S.thRot = st.theta;
      S.conn = st.connection;
      S.supply = !!ctl.K1 && !S.fuse;
    }

    function setControl(key, value) {
      if (key === 'motor') { if (CORE.acPresets[value] && value !== motorId) { motorId = value; initState(); } return; }
      if (key === 'loadRel') { ctl.load = clamp(Math.round(num(value, 0) * d.MN * 10) / 10, 0, 80); return; }
      const def = CONTROLS.find(c => c.key === key); if (!def) return;
      if (def.type === 'switch') value = !!value;
      else if (def.type === 'slider') value = clamp(num(value, def.value), def.min, def.max);
      else if (def.type === 'select') { if (key === 'vf' && ALIAS_VF[value]) value = ALIAS_VF[value]; if (!def.options.some(o => o.value === value)) return; }
      ctl[key] = value;
    }
    function getControl(key) { return ctl[key]; }

    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      dtMs = Math.min(dtMs, 120000);
      let remain = dtMs;
      const chunk = dtMs > 3000 ? 50 : 10;
      while (remain > 1e-9) {
        const c = Math.min(chunk, remain); remain -= c;
        // Sicherung: Kurzschluss durch K2 + K3 bei geschlossenem K1 (nur Netzbetrieb)
        if (netz() && ctl.K1 && ctl.K2 && ctl.K3 && !S.fuse) {
          S.fuse = true;
          say('Stern und Dreieck gleichzeitig: Kurzschluss! Die Sicherung F1 ist gefallen. Schalte K1 aus, um sie zurückzusetzen, und schalte niemals K2 und K3 zugleich ein.', 'error', 'shoot', 130, 250);
        }
        if (!ctl.K1 && S.fuse) { S.fuse = false; say('Sicherung F1 wieder eingeschaltet.', 'info'); }
        const wasOn = S.st ? S.st.on : false;
        const st = ac.step(c, buildInp());
        S.t += c; S.thField += TAU * st.fSigned * c / 1000;
        for (let i = 0; i < 3; i++) { const tgt = [ctl.K1, ctl.K2, ctl.K3][i] ? 1 : 0; S.kc[i] += clamp(tgt - S.kc[i], -c / 40, c / 40); }
        sync(st);
        monitor(st, wasOn);
      }
    }

    function monitor(st, wasOn) {
      const wr = netz() && ctl.K2 && ctl.K3;
      if (wr && !ctl.K1 && !S.shootFlag) { S.shootFlag = true; say('Stern und Dreieck gleichzeitig! K2 und K3 dürfen nie zusammen an sein. Sobald K1 einschaltet, gibt es einen Kurzschluss.', 'error', 'shoot', 130, 250); }
      if (!wr) S.shootFlag = false;
      if (ctl.K1 && !S.k1Prev) { S.startT = S.t; S.inrushFlag = false; }
      S.k1Prev = !!ctl.K1;
      if (st.on && netz() && !S.inrushFlag && S.t - S.startT >= 6 && Math.abs(st.w) < 0.6 * d.wN) {
        S.inrushFlag = true;
        if (st.connection === 'dreieck') say('Direktanlauf im Dreieck: Anlaufstrom ' + fmt(st.iLine, 1) + ' A, das ist das ' + fmt(st.iLine / m.IN, 1) + '-fache des Nennstroms (' + fmt(m.IN, 1) + ' A).', 'warn');
        else if (st.connection === 'stern') say('Anlauf im Stern: Anlaufstrom nur ' + fmt(st.iLine, 1) + ' A, das ist ein Drittel des Dreieck-Anlaufstroms. Das Moment ist dabei auch nur ein Drittel.', 'info');
      }
      if (netz() && st.on && S.lastConn === 'stern' && st.connection === 'dreieck') {
        const nn = Math.abs(st.rpm), frac = nn / m.nN;
        say(frac < 0.8 ? 'Umschaltung Stern auf Dreieck bei ' + Math.round(nn) + ' 1/min: noch zu früh, es gibt einen großen Stromstoß (' + fmt(st.iLine, 1) + ' A). Warte, bis der Motor fast Nenndrehzahl hat.' : 'Umschaltung auf Dreieck bei ' + Math.round(nn) + ' 1/min: sanfter Übergang.', frac < 0.8 ? 'warn' : 'info');
      }
      if (st.connection === 'stern' || st.connection === 'dreieck') S.lastConn = st.on ? st.connection : S.lastConn;
      if (!ctl.K1) S.lastConn = st.connection === 'stern' ? 'stern' : 'dreieck';
      if (!!ctl.reverse !== S.revPrev) {
        if (st.on && Math.abs(st.rpm) > 150 && netz()) say('Drehrichtung im Lauf umgeschaltet: Der Motor wird mit Gegenstrom abgebremst, dabei fließt ein sehr hoher Strom (' + fmt(st.iLine, 1) + ' A).', 'warn');
        S.revPrev = !!ctl.reverse;
      }
      if (st.tipped && !S.stuckFlag) {
        S.stuckFlag = true;
        const TL = num(ctl.load, 0);
        say(Math.abs(st.rpm) < 30 ? 'Der Motor läuft nicht an: Das Lastmoment (' + fmt(TL, 1) + ' Nm) ist größer als das Anzugsmoment. Er brummt, der Strom bleibt hoch (' + fmt(st.iLine, 1) + ' A) und die Wicklung wird heiß.'
          : 'Kippmoment überschritten! Last ' + fmt(TL, 1) + ' Nm > Kippmoment ' + fmt(st.mk, 1) + ' Nm. Der Motor bleibt stehen und brummt, der Strom ist hoch.', 'error', 'stall', 450, 210);
      } else if (!st.tipped) S.stuckFlag = false;
      if (st.phaseLost && !S.phaseFlag) { S.phaseFlag = true; say('Phasenausfall! Der Motor läuft nur einphasig: er brummt, zieht deutlich mehr Strom und läuft von allein nicht an. Er wird schnell heiß.', 'error'); }
      if (!ctl.phaseLoss) S.phaseFlag = false;
      if (st.fuLimiting && !S.limFlag) { S.limFlag = true; say('Der Umrichter begrenzt den Strom (150 % von I_N) und hält die Rampe an. Wähle eine längere Hochlaufzeit oder weniger Last.', 'warn'); }
      if (!st.fuLimiting) S.limFlag = false;
      if (st.fuFault && !S.fuFlag) { S.fuFlag = true; say('FU-Störung: Überstrom! Der Umrichter hat abgeschaltet, weil er zu lange begrenzen musste. Schalte K1 aus und wieder ein.', 'error'); }
      if (!st.fuFault) S.fuFlag = false;
      if (st.overheat && !S.heatFlag) { S.heatFlag = true; say('Überhitzung! Die Wicklung ist ' + Math.round(st.temp) + ' °C heiß. Last verringern, Motor abschalten oder abkühlen lassen.', 'error', 'overheat', 450, 190); }
      else if (S.heatFlag && st.temp < 110) { S.heatFlag = false; say('Motor ist wieder unter 110 °C.', 'info'); }
    }

    function readMeters() {
      const st = S.st;
      return {
        rpm: Math.abs(st.rpm), slip: st.on ? st.slipPct : 0, iLine: st.iLine, cosphi: st.on ? st.cosphi : 0, pElec: st.pElec, pMech: st.pMech,
        torque: Math.abs(st.torque), eta: st.eta * 100, temp: st.temp, uMotor: st.uMotor, fMotor: st.fMotor
      };
    }
    function state() {
      const st = S.st;
      const faults = [];
      if (netz() && ctl.K2 && ctl.K3) faults.push('Stern und Dreieck gleichzeitig');
      if (S.fuse) faults.push('Sicherung gefallen');
      if (st.tipped) faults.push('Kippmoment überschritten');
      if (st.overheat) faults.push('Überhitzung');
      if (st.phaseLost) faults.push('Phasenausfall');
      if (st.fuFault) faults.push('FU-Störung Überstrom');
      return {
        t: S.t, rpm: st.rpm, speed: Math.abs(st.rpm), n: st.rpm, omega: st.w, slip: st.on ? st.slipPct : 0, iLine: st.iLine, current: st.iLine, iWinding: st.iPhase,
        cosphi: st.on ? st.cosphi : 0, pElec: st.pElec, power: st.pElec, pMech: st.pMech, torque: st.torque, loadTorque: num(ctl.load, 0), eta: st.eta * 100, temp: st.temp,
        uMotor: st.uMotor, voltage: st.uMotor, fMotor: st.fMotor, fieldFreq: st.fSigned, nSync: st.nSync,
        conn: st.connection, live: st.on, supply: S.supply, contacts: S.kc.map(v => v > 0.5), kippMoment: st.mk, stalled: !!st.tipped, hum: !!st.hum, fuse: S.fuse, fuTrip: !!st.fuFault,
        fuLimiting: !!st.fuLimiting, motor: motorId, nameplate: nameplate(), ratedCurrent: m.IN, ratedTorque: m.MN, ratedSpeed: m.nN, startRatio: st.iLine / m.IN,
        overheat: !!st.overheat, fault: faults.length > 0, faults
      };
    }
    function nameplate() { const p = m.plate; return { id: m.id, name: m.name, P: p.P, U: p.uDelta + ' V Δ / ' + p.uStar + ' V Y', f: p.f, I: p.iDelta, IStern: p.iStar, cosphi: p.cosphi, n: p.n, eta: p.eta, poles: p.poles, MN: +m.MN.toFixed(2), IP: 'IP 54' }; }
    function reset() { initState(); }

    // ----- Kennlinien -----
    function curveSet() {
      const FU = !netz();
      const fFu = Math.max(2, num(ctl.freq, 50));
      const pl = { phaseLoss: !!ctl.phaseLoss };
      const D = ac.curves(Object.assign({ connection: 'dreieck', source: 'netz', n: 80 }, pl)), Y = ac.curves(Object.assign({ connection: 'stern', source: 'netz', n: 80 }, pl));
      const conn = ctl.connection;
      const F = FU ? ac.curves({ source: 'fu', f: fFu, vf: ctl.vf, connection: conn, n: 80 }) : null;
      const rd = (a) => a.map(p => [+p[0].toFixed(1), +p[1].toFixed(3)]);
      const TL = num(ctl.load, 0);
      const nOp = Math.abs(S.st.rpm);
      const nmax = Math.max(D.nSync, F ? F.nSync : 0) * 1.02;
      const sM = [{ name: 'Dreieck (Netz)', points: rd(D.torque) }, { name: 'Stern (Netz)', points: rd(Y.torque) }];
      const sI = [{ name: 'Dreieck (Netz)', points: rd(D.current) }, { name: 'Stern (Netz)', points: rd(Y.current) }];
      if (F) { sM.push({ name: 'FU ' + fmt(fFu, 1) + ' Hz', points: rd(F.torque) }); sI.push({ name: 'FU ' + fmt(fFu, 1) + ' Hz', points: rd(F.current) }); }
      sM.push({ name: 'Last', points: [[0, TL], [nmax, TL]] });
      const fr = [];
      const b = ac.params.boost;
      for (let f = 0; f <= 87.01; f += 1.5) fr.push([+f.toFixed(1), +(ufRel(ctl.vf, f / 50, b) * 400).toFixed(1)]);
      return [
        { id: 'mn', title: 'Drehmoment über Drehzahl', xLabel: 'Drehzahl', xUnit: '1/min', yLabel: 'Drehmoment', yUnit: 'Nm', series: sM, marker: { x: nOp, y: Math.abs(S.st.torque) } },
        { id: 'in', title: 'Leiterstrom über Drehzahl', xLabel: 'Drehzahl', xUnit: '1/min', yLabel: 'Leiterstrom', yUnit: 'A', series: sI, marker: { x: nOp, y: S.st.iLine } },
        { id: 'uf', title: 'U/f-Kennlinie des Umrichters', xLabel: 'Frequenz', xUnit: 'Hz', yLabel: 'Spannung', yUnit: 'V', series: [{ name: 'U(f)', points: fr }], marker: { x: S.st.fMotor, y: S.st.uMotor } }
      ];
    }
    function curves() { return curveSet(); }
    initState();

    // ---------- Zeichnen ----------
    const L = {
      K1: [24, 480, 90, 44], K2: [127, 480, 90, 44], K3: [230, 480, 90, 44],
      reverse: [346, 316, 150, 34], phaseLoss: [504, 316, 150, 34]
    };
    function hitTest(px, py, w, h) {
      const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
      const x = (px - ox) / s, y = (py - oy) / s;
      for (const k of ['K1', 'K2', 'K3', 'reverse', 'phaseLoss']) { const r = L[k]; if (x >= r[0] - 4 && x <= r[0] + r[2] + 4 && y >= r[1] - 4 && y <= r[1] + r[3] + 4) return { key: k, kind: 'switch' }; }
      return null;
    }
    function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
    function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
    function panel(ctx, x, y, w, h, title) { rr(ctx, x, y, w, h, 12); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke(); if (title) txt(ctx, title, x + 14, y + 18, 13, C.dim, 'left', '700'); }
    function glow(ctx, x, y, r, rgb, a) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    function toggle(ctx, r, on, label, col) {
      rr(ctx, r[0], r[1], r[2], r[3], 8); ctx.fillStyle = on ? col : '#1a2026'; ctx.globalAlpha = on ? 0.92 : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? '#ffffff55' : C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, label, r[0] + r[2] / 2, r[1] + r[3] / 2, 13, on ? '#10161a' : C.dim, 'center', '800');
    }
    function gauge(ctx, cx, cy, r, val, max, warn, label, unitTxt, col) {
      ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, TAU); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
      if (warn != null) { ctx.strokeStyle = 'rgba(255,92,92,0.65)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0 + (a1 - a0) * clamp(warn / max, 0, 1), a1); ctx.stroke(); }
      ctx.strokeStyle = '#33404c'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r - 4, a0, a0 + (a1 - a0) * clamp(warn != null ? warn / max : 1, 0, 1)); ctx.stroke();
      for (let i = 0; i <= 10; i++) { const a = a0 + (a1 - a0) * i / 10; ctx.strokeStyle = i % 5 === 0 ? C.text : '#64717e'; ctx.lineWidth = i % 5 === 0 ? 2 : 1; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (r - 14), cy + Math.sin(a) * (r - 14)); ctx.lineTo(cx + Math.cos(a) * (r - 8), cy + Math.sin(a) * (r - 8)); ctx.stroke(); }
      const a = a0 + (a1 - a0) * clamp(val / max, 0, 1.03);
      ctx.strokeStyle = col; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * (r - 10), cy + Math.sin(a) * (r - 10)); ctx.stroke();
      ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
      txt(ctx, label, cx, cy - r * 0.38, 11, C.dim, 'center', '700');
      txt(ctx, unitTxt, cx, cy + r * 0.52, 13, C.text, 'center', '800');
    }

    // Zwischenspeicher fuer die Mini-Kennlinie
    const mini = { key: '', data: null, boost: 0.07 };
    const vis = { cb: 0, connBlend: 1, prevT: -1 };

    function drawClemmen(ctx, t) {
      panel(ctx, 14, 14, 316, 208, 'Klemmenbrett');
      const connShown = (ctl.source === 'netz' && ctl.K2 && ctl.K3) ? 'kurzschluss' : (S.conn === 'stern' ? 'stern' : 'dreieck');
      const lbl = connShown === 'stern' ? 'STERN (Y)' : connShown === 'dreieck' ? 'DREIECK (Δ)' : 'KURZSCHLUSS';
      const wcol = connShown === 'kurzschluss' ? C.bad : C.acc;
      txt(ctx, lbl, 316, 18, 14, wcol, 'right', '800');
      const xs = [78, 172, 266], yT = 112, yB = 176;
      const wireC = ['#b5772f', '#e6edf3', '#8b98a5'], wireN = ['L1', 'L2', 'L3'];
      const cur = S.live ? clamp(S.Iline / (m.IN * 3), 0, 1) : 0;
      // Zuleitungen
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = wireC[i]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(xs[i], 58); ctx.lineTo(xs[i], yT - 12); ctx.stroke();
        txt(ctx, wireN[i], xs[i], 47, 12, wireC[i], 'center', '800');
        if (S.live) { for (let k = 0; k < 3; k++) { const p = ((t * 0.0008 * (0.5 + cur * 2) + k / 3 + i / 9) % 1); ctx.fillStyle = 'rgba(255,230,120,0.9)'; ctx.beginPath(); ctx.arc(xs[i], 58 + p * (yT - 70), 2.6, 0, TAU); ctx.fill(); } }
      }
      // Brett
      rr(ctx, 36, 78, 272, 128, 10); ctx.fillStyle = '#2d3640'; ctx.fill(); ctx.strokeStyle = '#46525e'; ctx.lineWidth = 2; ctx.stroke();
      // Bruecken
      const hot = S.live ? 0.5 + 0.5 * cur : 0;
      const bridge = (x0, y0, x1, y1) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgb(200,140,70)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,225,170,0.75)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y0 - 2); ctx.lineTo(x1, y1 - 2); ctx.stroke();
        if (hot > 0) { ctx.strokeStyle = 'rgba(255,170,60,' + (0.25 * hot) + ')'; ctx.lineWidth = 20; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
      };
      if (connShown === 'stern') bridge(xs[0], yB, xs[2], yB);
      else if (connShown === 'dreieck') for (let i = 0; i < 3; i++) bridge(xs[i], yT, xs[i], yB);
      else { bridge(xs[0], yB, xs[2], yB); for (let i = 0; i < 3; i++) bridge(xs[i], yT, xs[i], yB); }
      // Klemmen
      const names = [['U1', 'V1', 'W1'], ['W2', 'U2', 'V2']];
      for (let r2 = 0; r2 < 2; r2++) for (let i = 0; i < 3; i++) {
        const y = r2 ? yB : yT;
        ctx.fillStyle = '#a7b2bd'; ctx.beginPath(); ctx.arc(xs[i], y, 13, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6d7885'; ctx.beginPath(); ctx.arc(xs[i], y, 8, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#2d3640'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xs[i] - 6, y); ctx.lineTo(xs[i] + 6, y); ctx.stroke();
        txt(ctx, names[r2][i], xs[i], y + (r2 ? 24 : -20), 13, C.text, 'center', '800');
      }
      const Uwv = (connShown === 'stern' ? 1 / SQ3 : 1) * S.uLine;
      txt(ctx, 'Strangspannung ' + Math.round(Uwv) + ' V', 172, 215, 12, S.live ? C.warn : C.dim, 'center', '700');
      if (connShown === 'kurzschluss' && Math.floor(t / 120) % 2 === 0) { glow(ctx, 172, 140, 110, '255,200,60', 0.35); }
    }

    function drawContactor(ctx, x, label, sub, kc, coilOn, idx, t, warn) {
      const w = 96;
      ctx.save(); ctx.translate(0, 8);
      rr(ctx, x, 252, w, 204, 8); ctx.fillStyle = '#2a323b'; ctx.fill(); ctx.strokeStyle = warn ? C.bad : C.line; ctx.lineWidth = warn ? 2.5 : 1.5; ctx.stroke();
      txt(ctx, label, x + w / 2, 268, 15, C.text, 'center', '800');
      txt(ctx, sub, x + w / 2, 284, 11, C.dim, 'center', '600');
      // Hauptkontakte
      for (let i = 0; i < 3; i++) {
        const cx2 = x + 22 + i * 26;
        ctx.strokeStyle = '#99a5b1'; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(cx2, 296); ctx.lineTo(cx2, 306); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx2, 360); ctx.lineTo(cx2, 372); ctx.stroke();
        ctx.fillStyle = '#c0cad4'; ctx.beginPath(); ctx.arc(cx2, 306, 3.5, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(cx2, 360, 3.5, 0, TAU); ctx.fill();
        // Schaltmesser: geschlossen = senkrecht, offen = abgeklappt
        const a = (1 - kc) * 0.45;
        ctx.strokeStyle = kc > 0.5 ? (S.live ? '#ffd24a' : '#e6edf3') : '#99a5b1'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx2, 360); ctx.lineTo(cx2 - Math.sin(a) * 56, 360 - Math.cos(a) * 56); ctx.stroke();
      }
      // Anker / Gestaenge
      ctx.setLineDash([4, 4]); ctx.strokeStyle = '#6a7784'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 14, 384); ctx.lineTo(x + 14, 340); ctx.lineTo(x + 20, 340); ctx.stroke(); ctx.setLineDash([]);
      // Spule
      const coilY = 388;
      rr(ctx, x + 20, coilY, 56, 44, 6); ctx.fillStyle = coilOn ? 'rgba(255,170,60,0.9)' : '#1a2026'; ctx.fill(); ctx.strokeStyle = coilOn ? '#ffe0a0' : C.line; ctx.lineWidth = 2; ctx.stroke();
      if (coilOn) glow(ctx, x + 48, coilY + 22, 42, '255,170,60', 0.35);
      ctx.strokeStyle = coilOn ? '#3a2208' : '#566270'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(x + 31 + i * 11, coilY + 22, 5.5, Math.PI, 0); ctx.stroke(); }
      txt(ctx, 'A1', x + 28, coilY + 9, 9, coilOn ? '#5a3508' : C.dim, 'center', '700'); txt(ctx, 'A2', x + 68, coilY + 36, 9, coilOn ? '#5a3508' : C.dim, 'center', '700');
      txt(ctx, label.slice(0, 2), x + 48, coilY + 56, 12, coilOn ? C.warn : C.dim, 'center', '800');
      ctx.restore();
    }

    function drawSchuetz(ctx, t) {
      panel(ctx, 14, 232, 316, 328, 'Schütz-Schaltung (antippen)');
      const w2 = { shoot: !!(ctl.K2 && ctl.K3) };
      drawContactor(ctx, 22, 'K1 Netz', '3 Hauptkontakte', S.kc[0], !!ctl.K1, 0, t, false);
      drawContactor(ctx, 127, 'K2 Stern', 'Sternpunkt', S.kc[1], !!ctl.K2, 1, t, w2.shoot && ctl.source === 'netz');
      drawContactor(ctx, 232, 'K3 Dreieck', 'Dreieckbrücken', S.kc[2], !!ctl.K3, 2, t, w2.shoot && ctl.source === 'netz');
      const dead = ctl.source !== 'netz';
      ['K1', 'K2', 'K3'].forEach((k, i) => {
        const on = !!ctl[k];
        toggle(ctx, L[k], on, k + (on ? ' EIN' : ' AUS'), k === 'K1' ? C.ok : k === 'K2' ? C.warn : C.acc);
      });
      if (dead) txt(ctx, 'Umrichter-Betrieb: K2/K3 ohne Wirkung', 172, 538, 11, C.dim, 'center', '600');
      else if (w2.shoot) { txt(ctx, 'K2 + K3 zugleich: KURZSCHLUSS!', 172, 538, 13, C.bad, 'center', '900'); }
      else txt(ctx, 'Stern erst K1+K2, dann K2 aus, K3 an', 172, 538, 11, C.dim, 'center', '600');
      if (w2.shoot && ctl.K1 && Math.floor(t / 90) % 2 === 0) {
        for (let i = 0; i < 7; i++) { const sx = 150 + hash(Math.floor(t / 90) + i) * 150, sy = 300 + hash(i * 3 + Math.floor(t / 90)) * 70; ctx.strokeStyle = 'rgba(255,230,120,0.95)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 14 * (hash(i + 7) - 0.5), sy - 14); ctx.lineTo(sx + 6, sy - 8); ctx.lineTo(sx + 18 * (hash(i + 5) - 0.5), sy - 24); ctx.stroke(); }
      }
    }

    function drawMotor(ctx, t) {
      const heat = clamp((S.temp - 60) / 90, 0, 1);
      const ang = S.thRot * 0.04;
      const stall = S.stallFlag;
      let sx = 0, sy = 0;
      if (stall || (ctl.phaseLoss && S.live)) { sx = Math.sin(t * 0.11) * 2; sy = Math.cos(t * 0.13) * 1.5; }
      ctx.save(); ctx.translate(sx, sy);
      // Sockel
      ctx.fillStyle = '#2a323b'; rr(ctx, 372, 262, 170, 12, 3); ctx.fill();
      // Luefterhaube
      rr(ctx, 342, 150, 36, 100, 8); ctx.fillStyle = '#394450'; ctx.fill(); ctx.strokeStyle = '#4b5865'; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = '#242c34'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(346, 162 + i * 15); ctx.lineTo(374, 162 + i * 15); ctx.stroke(); }
      // Gehaeuse
      const body = (x, y, w, h) => { rr(ctx, x, y, w, h, 14); };
      glow(ctx, 460, 200, 190, '255,100,40', heat * 0.5);
      body(378, 126, 170, 134);
      const g = ctx.createLinearGradient(0, 126, 0, 260);
      const hc = (v) => Math.round(v);
      g.addColorStop(0, 'rgb(' + hc(78 + heat * 170) + ',' + hc(92 - heat * 20) + ',' + hc(106 - heat * 60) + ')');
      g.addColorStop(0.5, 'rgb(' + hc(52 + heat * 170) + ',' + hc(62 - heat * 10) + ',' + hc(74 - heat * 40) + ')');
      g.addColorStop(1, 'rgb(' + hc(38 + heat * 120) + ',' + hc(46) + ',' + hc(54 - heat * 20) + ')');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = heat > 0.3 ? 'rgba(255,170,70,' + (0.4 + heat * 0.5) + ')' : '#5a6876'; ctx.lineWidth = 2.5; ctx.stroke();
      // Kuehlrippen
      ctx.lineWidth = 3;
      for (let i = 0; i < 12; i++) { ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.moveTo(392 + i * 12.5, 132); ctx.lineTo(392 + i * 12.5, 254); ctx.stroke(); }
      // Klemmkasten
      rr(ctx, 440, 98, 74, 34, 5); ctx.fillStyle = '#3d4854'; ctx.fill(); ctx.strokeStyle = '#5a6876'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'Klemmkasten', 477, 115, 10, C.dim, 'center', '700');
      // Schnittfenster: Ruecken-Ansicht Rotor und Stator
      rr(ctx, 394, 150, 138, 90, 8); ctx.fillStyle = '#0d1115'; ctx.fill(); ctx.strokeStyle = '#6a7784'; ctx.lineWidth = 1.5; ctx.stroke();
      // Stator oben/unten mit Wickelkoepfen
      const act = S.live ? clamp(S.Iline / (m.IN * 2.5), 0.2, 1) : 0;
      for (const yy of [152, 222]) {
        ctx.fillStyle = '#5b6672'; ctx.fillRect(398, yy, 130, 15);
        for (let i = 0; i < 9; i++) {
          const ph = i % 3; const on = S.live ? 0.55 + 0.35 * Math.sin(S.thField * 0.04 - ph * TAU / 3 + (yy > 190 ? 1 : 0)) : 0;
          ctx.fillStyle = S.live ? 'rgba(' + (190 + Math.round(60 * on * act)) + ',' + (120 + Math.round(70 * on)) + ',50,1)' : '#8a5f33';
          rr(ctx, 402 + i * 14, yy + 2, 10, 11, 3); ctx.fill();
        }
      }
      // Rotor: Zylinder mit schraeg stehenden Staeben (Kaefiglaeufer), dreht in Zeitlupe
      const rcy = 195, rR = 21;
      const gr = ctx.createLinearGradient(0, rcy - rR, 0, rcy + rR); gr.addColorStop(0, '#9aa7b4'); gr.addColorStop(0.5, '#d6dee6'); gr.addColorStop(1, '#6d7885');
      ctx.fillStyle = gr; ctx.fillRect(404, rcy - rR, 118, rR * 2);
      ctx.save(); ctx.beginPath(); ctx.rect(404, rcy - rR, 118, rR * 2); ctx.clip();
      const NB = 14;
      for (let k = 0; k < NB; k++) {
        const a = ang + k * TAU / NB, y = rcy + Math.sin(a) * rR, vis2 = Math.cos(a);
        if (vis2 > 0) {
          ctx.strokeStyle = 'rgba(40,48,58,' + (0.25 + 0.6 * vis2) + ')'; ctx.lineWidth = 3 * vis2 + 0.6;
          ctx.beginPath(); ctx.moveTo(404, y + 6); ctx.lineTo(522, y - 6); ctx.stroke();
        }
      }
      ctx.restore();
      // Welle
      ctx.fillStyle = '#c0cad4'; ctx.fillRect(542, 188, 72, 14);
      ctx.fillStyle = '#8b98a5'; ctx.fillRect(542, 188, 72, 4);
      ctx.fillStyle = '#e6edf3'; ctx.fillRect(560, 186, 14, 18); // Passfeder-Andeutung
      ctx.fillStyle = '#c0cad4'; ctx.fillRect(378, 188, -30, 14);
      // Luefterrad (links) als Stern
      ctx.save(); ctx.translate(361, 200); ctx.rotate(ang);
      ctx.strokeStyle = 'rgba(200,210,220,0.7)'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -22); ctx.stroke(); ctx.rotate(Math.PI / 2); }
      ctx.restore();
      // Typenschild
      rr(ctx, 378, 270, 164, 36, 4); ctx.fillStyle = '#c8d0d8'; ctx.fill(); ctx.strokeStyle = '#7c8794'; ctx.lineWidth = 1; ctx.stroke();
      txt(ctx, fmt(m.P / 1000, 2) + ' kW · 400 V Δ · ' + fmt(m.IN, 1) + ' A', 460, 281, 10, '#1b2128', 'center', '800');
      txt(ctx, 'cos φ ' + fmt(m.cos, 2) + ' · ' + m.nN + '/min · 50 Hz', 460, 296, 10, '#1b2128', 'center', '700');
      ctx.restore();
      // Rauch
      if (S.temp > 120 || (S.live && S.Iline > 3 * m.IN && S.temp > 100)) {
        const a = clamp((S.temp - 100) / 60, 0.2, 1);
        for (let i = 0; i < 9; i++) {
          const ph = ((t * 0.00035 * (0.6 + hash(i)) + hash(i + 9)) % 1);
          const px = 420 + hash(i + 3) * 110 + Math.sin(t * 0.002 + i) * 12 * ph, py = 96 - ph * 80;
          ctx.fillStyle = 'rgba(' + (S.temp > 150 ? '60,60,64' : '170,176,186') + ',' + (0.55 * (1 - ph) * a) + ')';
          ctx.beginPath(); ctx.arc(px, py, 8 + ph * 24, 0, TAU); ctx.fill();
        }
      }
      if (S.temp > 160 && Math.floor(t / 130) % 2 === 0) { glow(ctx, 470, 130, 38, '255,120,40', 0.5); }
      // Brumm-Wellen
      if (stall) {
        ctx.strokeStyle = 'rgba(255,92,92,0.6)'; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const r2 = 12 + ((t * 0.04 + i * 18) % 54); ctx.globalAlpha = 1 - r2 / 70; ctx.beginPath(); ctx.arc(460, 195, 120 + r2, -0.5, 0.5); ctx.stroke(); ctx.beginPath(); ctx.arc(460, 195, 120 + r2, Math.PI - 0.5, Math.PI + 0.5); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
      // Bremse (Last) rechts: Scheibe auf der Welle
      const TL = num(ctl.load, 0);
      const bx = 626, by = 195, br = 38;
      const brk = clamp(TL / Math.max(30, m.MN * 1.6), 0, 1);
      glow(ctx, bx, by, 70, '255,140,50', clamp(brk * (0.4 + Math.abs(S.w) / m.wN * 0.8) , 0, 1) * 0.5);
      ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2f3943'; ctx.beginPath(); ctx.arc(bx, by, br - 6, 0, TAU); ctx.fill();
      ctx.save(); ctx.translate(bx, by); ctx.rotate(ang);
      for (let i = 0; i < 6; i++) { ctx.fillStyle = '#4a5663'; ctx.beginPath(); ctx.arc(0, -22, 5, 0, TAU); ctx.fill(); ctx.rotate(TAU / 6); }
      ctx.restore();
      ctx.fillStyle = '#e6edf3'; ctx.beginPath(); ctx.arc(bx, by, 7, 0, TAU); ctx.fill();
      // Bremssattel
      const gap = 5 - brk * 4;
      rr(ctx, bx - 20, by - br - 24 - gap, 40, 24, 5); ctx.fillStyle = '#d24f3d'; ctx.fill();
      rr(ctx, bx - 20, by + br + gap, 40, 24, 5); ctx.fillStyle = '#d24f3d'; ctx.fill();
      ctx.fillStyle = '#6d3a31'; ctx.fillRect(bx - 16, by - br - gap, 32, 6); ctx.fillRect(bx - 16, by + br + gap - 6, 32, 6);
      txt(ctx, 'Last-Bremse', bx, by + br + 50, 11, C.dim, 'center', '700');
      txt(ctx, fmt(TL, 1) + ' Nm', bx, by + br + 66, 13, C.warn, 'center', '800');
      // Welle zur Bremse
      ctx.fillStyle = '#c0cad4'; ctx.fillRect(614, 188, 8, 14);
      // Pfeile Moment/Drehzahl
      const n = Math.abs(S.w) * 30 / Math.PI;
      txt(ctx, 'Motor: n = ' + Math.round(S.w * 30 / Math.PI) + ' 1/min', 460, 70, 15, C.text, 'center', '800');
      txt(ctx, 'M = ' + fmt(Math.abs(S.Mmot), 1) + ' Nm', 460, 88, 13, C.acc, 'center', '800');
      // Drehpfeil (Bogen ueber der Welle, Pfeilspitze je nach Drehrichtung am rechten oder linken Ende)
      const dirw = S.w >= 0 ? 1 : -1;
      if (n > 5) {
        ctx.strokeStyle = 'rgba(59,158,255,0.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(560, 150, 22, -2.2, -0.2, false); ctx.stroke();
        const ae = dirw > 0 ? -0.2 : -2.2, ex = 560 + Math.cos(ae) * 22, ey = 150 + Math.sin(ae) * 22, tx = -Math.sin(ae) * dirw, ty = Math.cos(ae) * dirw, nx = Math.cos(ae), ny = Math.sin(ae);
        ctx.fillStyle = 'rgba(59,158,255,0.9)'; ctx.beginPath(); ctx.moveTo(ex + tx * 11, ey + ty * 11); ctx.lineTo(ex + nx * 7, ey + ny * 7); ctx.lineTo(ex - nx * 7, ey - ny * 7); ctx.closePath(); ctx.fill();
        txt(ctx, dirw > 0 ? 'rechts' : 'links', 560, 122, 10, C.dim, 'center', '700');
      }
      // Temperaturbalken unter dem Typenschild
      rr(ctx, 378, 309, 136, 7, 3.5); ctx.fillStyle = '#1a2026'; ctx.fill();
      const th = clamp((S.temp - 20) / 140, 0, 1);
      rr(ctx, 378, 309, Math.max(7, 136 * th), 7, 3.5); ctx.fillStyle = S.st.overheat ? C.bad : S.temp > 105 ? C.warn : C.ok; ctx.fill();
      ctx.fillStyle = C.bad; ctx.fillRect(378 + 136 * (110 / 140) - 1, 306, 2, 13);
      txt(ctx, Math.round(S.temp) + ' °C', 524, 313, 11, S.st.overheat ? C.bad : C.dim, 'left', '700');
    }

    function drawField(ctx, t) {
      panel(ctx, 664, 14, 322, 232, 'Drehfeld und Rotor (Zeitlupe)');
      const cx = 760, cy = 140, r = 76;
      const fa = S.thField * 0.04, ra = S.thRot * 0.04; // Zeitlupe: Feld und Rotor gleich skaliert
      const live = S.live && Math.abs(S.fe) > 0.25;
      // Farbkreis (Feld)
      const seg = 72;
      for (let i = 0; i < seg; i++) {
        const a0 = i * TAU / seg, hue = ((a0 - fa) / TAU * 360 % 360 + 360) % 360;
        ctx.strokeStyle = live ? 'hsl(' + Math.round(hue) + ',70%,' + (45 + 12 * Math.cos(a0 - fa)) + '%)' : '#2f3943';
        ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(cx, cy, r, a0, a0 + TAU / seg + 0.03); ctx.stroke();
      }
      ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, TAU); ctx.fill();
      // Rotor-Scheibe mit Markierung
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ra);
      ctx.fillStyle = '#4a5663'; ctx.beginPath(); ctx.arc(0, 0, 48, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8b98a5'; for (let i = 0; i < 4; i++) { ctx.fillRect(40, -4, 8, 8); ctx.rotate(Math.PI / 2); }
      ctx.fillStyle = C.acc; ctx.beginPath(); ctx.arc(34, 0, 7, 0, TAU); ctx.fill();
      txt(ctx, 'R', 34, 0, 10, '#06141f', 'center', '900');
      ctx.restore();
      // Feldpfeil
      if (live) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(fa);
        ctx.strokeStyle = '#ffd24a'; ctx.fillStyle = '#ffd24a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(r - 2, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r + 10, 0); ctx.lineTo(r - 10, -9); ctx.lineTo(r - 10, 9); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#e6edf3'; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
      // Phasenmarken U V W
      ['U', 'V', 'W'].forEach((s, i) => { const a = -Math.PI / 2 + i * TAU / 3; txt(ctx, s, cx + Math.cos(a) * (r + 18), cy + Math.sin(a) * (r + 18), 13, ['#ffd24a', '#4cd964', '#b08cff'][i], 'center', '800'); });
      const ns = 60 * Math.abs(S.fe) / POLES, n = Math.abs(S.w) * 30 / Math.PI;
      const tx = 850;
      const slip = live && ns > 1 ? (ns - n) / ns * 100 : 0;
      const rows = [
        ['Drehfeld (synchron)', Math.round(ns) + ' 1/min', '#ffd24a', C.text], ['Rotor', Math.round(n) + ' 1/min', C.acc, C.text],
        ['Schlupf', fmt(slip, 1) + ' %', C.dim, slip > 12 ? C.warn : C.text], ['Frequenz', fmt(Math.abs(S.fe), 1) + ' Hz', C.dim, C.text],
        ['Strangspannung', Math.round((S.conn === 'stern' ? 1 / SQ3 : 1) * S.uLine) + ' V', C.dim, C.text]];
      rows.forEach((r, i) => { const y = 54 + i * 34; txt(ctx, r[0], tx, y, 10.5, r[2], 'left', '700'); txt(ctx, r[1], 976, y + 14, 15, r[3], 'right', '800'); });
      txt(ctx, 'Rotor bleibt hinter dem Feld zurück: Schlupf', 825, 232, 10.5, C.dim, 'center', '600');
    }

    function drawFU(ctx, t) {
      const active = ctl.source === 'fu';
      panel(ctx, 664, 256, 322, 304, 'Frequenzumrichter und Messwerte');
      // FU-Kasten
      rr(ctx, 678, 278, 294, 118, 10); ctx.fillStyle = active ? '#2e3a46' : '#242b32'; ctx.fill(); ctx.strokeStyle = active ? '#5a6d80' : '#33404c'; ctx.lineWidth = 2; ctx.stroke();
      // Anzeige
      rr(ctx, 690, 290, 160, 60, 6); ctx.fillStyle = active ? '#0c2a1a' : '#10151a'; ctx.fill(); ctx.strokeStyle = '#1f4a30'; ctx.lineWidth = 1.5; ctx.stroke();
      const lcd = active ? '#6df08c' : '#3a4a44';
      txt(ctx, 'f ' + fmt(Math.abs(S.fe), 1) + ' Hz', 700, 307, 15, lcd, 'left', '800');
      txt(ctx, 'U ' + Math.round(S.uLine) + ' V', 700, 327, 15, lcd, 'left', '800');
      txt(ctx, 'I ' + fmt(S.live ? S.Iline : 0, 1) + ' A', 780, 327, 12, lcd, 'left', '800');
      txt(ctx, active ? (S.fuTrip ? 'STÖRUNG' : (S.supply ? (Math.abs(S.fe) < clamp(ctl.freq, 0, 87) - 0.3 ? 'RAMPE' : 'LÄUFT') : 'BEREIT')) : 'AUS (Netz)', 700, 342, 10, lcd, 'left', '700');
      // LEDs
      const led = (x, y, on, col, lab) => { if (on) glow(ctx, x, y, 16, col, 0.5); ctx.fillStyle = on ? 'rgb(' + col + ')' : '#1a2026'; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.fill(); txt(ctx, lab, x, y + 15, 9, C.dim, 'center', '700'); };
      led(868, 302, active && S.supply && !S.fuTrip, '76,217,100', 'RUN');
      led(900, 302, active && S.fuTrip, '255,92,92', 'FEHLER');
      led(934, 302, active && S.supply && Math.abs(S.fe) < clamp(ctl.freq, 0, 87) - 0.3, '255,179,64', 'RAMPE');
      // U/f-Diagramm
      const dx0 = 864, dy0 = 384, dw = 100, dh = 36;
      ctx.strokeStyle = '#4a5663'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(dx0, dy0 - dh - 14); ctx.lineTo(dx0, dy0 - 14); ctx.lineTo(dx0 + dw, dy0 - 14); ctx.stroke();
      ctx.strokeStyle = active ? C.acc : '#4a5663'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i <= 29; i++) { const f = i * 3; const u2 = ufRel(ctl.vf, f / 50, mini.boost); const px = dx0 + f / 87 * dw, py = dy0 - 14 - u2 * dh; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      if (active) { const px = dx0 + clamp(Math.abs(S.fe) / 87, 0, 1) * dw, py = dy0 - 14 - clamp(S.uLine / 400, 0, 1) * dh; ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(px, py, 4, 0, TAU); ctx.fill(); }
      txt(ctx, 'U/f', dx0 + 4, dy0 - dh - 6, 9, C.dim, 'left', '700');
      // Klemmen
      ['L1', 'L2', 'L3'].forEach((s, i) => { ctx.fillStyle = '#a7b2bd'; ctx.beginPath(); ctx.arc(700 + i * 30, 270, 4, 0, TAU); ctx.fill(); });
      ['U', 'V', 'W'].forEach((s, i) => { ctx.fillStyle = '#a7b2bd'; ctx.beginPath(); ctx.arc(700 + i * 30, 404, 4, 0, TAU); ctx.fill(); });
      txt(ctx, 'Netz', 745, 267, 9, C.dim, 'left', '700'); txt(ctx, 'Motor', 745, 407, 9, C.dim, 'left', '700');
      // Zeiger
      const gI = Math.max(10, Math.ceil(m.IN * 7 / 5) * 5);
      gauge(ctx, 740, 478, 54, S.live ? S.Iline : 0, gI, m.IN * 1.5, 'Strom', fmt(S.live ? S.Iline : 0, 1) + ' A', S.Iline > 1.15 * m.IN ? C.warn : C.ok);
      gauge(ctx, 902, 478, 54, Math.abs(S.w) * 30 / Math.PI, 2000, null, 'Drehzahl', Math.round(Math.abs(S.w) * 30 / Math.PI) + '', C.acc);
      txt(ctx, 'IN ' + fmt(m.IN, 1) + ' A', 740, 540, 11, C.dim, 'center', '700');
      txt(ctx, 'n 1/min', 902, 540, 11, C.dim, 'center', '700');
      txt(ctx, 'P ' + Math.round(S.Pmech) + ' W · η ' + Math.round(S.eta * 100) + ' % · cos φ ' + fmt(S.live ? S.cos : 0, 2), 825, 554, 10, C.dim, 'center', '600');
    }

    function drawMini(ctx, t) {
      const x0 = 346, y0 = 360, w = 306, h = 192;
      panel(ctx, x0 - 8, y0 - 8, w + 16, h + 16, null);
      txt(ctx, 'M–n-Kennlinie und Betriebspunkt', x0 + 4, y0 + 8, 12, C.dim, 'left', '700');
      const key = [m.id, ctl.source, ctl.freq, ctl.vf, ctl.load, S.conn === 'stern' ? 1 : 0].join('|');
      if (mini.key !== key) { mini.key = key; mini.data = curveSet()[0]; }
      const cv = mini.data;
      const px0 = x0 + 34, py0 = y0 + h - 22, pw = w - 44, ph = h - 76;
      let xm = 0, ym = 0; cv.series.forEach(s => s.points.forEach(p => { xm = Math.max(xm, p[0]); ym = Math.max(ym, p[1]); }));
      ym = Math.max(ym, 1) * 1.08;
      ctx.strokeStyle = '#3a444f'; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) { const y = py0 - ph * i / 4; ctx.beginPath(); ctx.moveTo(px0, y); ctx.lineTo(px0 + pw, y); ctx.stroke(); }
      const cols = ['#4cd964', '#ffb340', '#3b9eff', '#ff5c5c'];
      cv.series.forEach((s, si) => {
        ctx.strokeStyle = s.name === 'Last' ? '#ff5c5c' : cols[si % 3]; ctx.lineWidth = s.name === 'Last' ? 2 : 2.4;
        ctx.setLineDash(s.name === 'Last' ? [6, 5] : []); ctx.beginPath();
        s.points.forEach((p, i) => { const px = px0 + p[0] / xm * pw, py = py0 - clamp(p[1], 0, ym) / ym * ph; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke(); ctx.setLineDash([]);
      });
      // Legende
      let lx = px0 + 4;
      cv.series.forEach((s, si) => { ctx.fillStyle = s.name === 'Last' ? '#ff5c5c' : cols[si % 3]; ctx.fillRect(lx, y0 + 22, 10, 4); txt(ctx, s.name, lx + 14, y0 + 25, 10, C.dim, 'left', '600'); lx += 22 + s.name.length * 5.4; });
      // Betriebspunkt
      const mx = px0 + clamp(cv.marker.x / xm, 0, 1) * pw, my = py0 - clamp(cv.marker.y, 0, ym) / ym * ph;
      glow(ctx, mx, my, 16, '255,255,255', 0.35); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(mx, my, 5, 0, TAU); ctx.fill(); ctx.strokeStyle = '#10151a'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, 'n [1/min]', px0 + pw, py0 + 26, 10, C.dim, 'right', '600');
      txt(ctx, 'M [Nm]', x0 + 4, py0 - ph - 10, 10, C.dim, 'left', '600');
      txt(ctx, '0', px0, py0 + 12, 10, C.dim, 'center', '600'); txt(ctx, String(Math.round(xm)), px0 + pw - 28, py0 + 12, 10, C.dim, 'center', '600');
      txt(ctx, fmt(ym / 1.08, 0), px0 - 6, py0 - ph + 2, 10, C.dim, 'right', '600');
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      const s = Math.min(w / W, h / H);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
      txt(ctx, 'Drehstrom-Asynchronmotor', 346, 30, 20, C.text, 'left', '800');
      txt(ctx, m.name + ' · ' + (ctl.source === 'netz' ? 'Netzbetrieb' : 'Umrichterbetrieb') + ' · ' + (S.conn === 'stern' ? 'Stern' : S.conn === 'dreieck' ? 'Dreieck' : 'Kurzschluss'), 346, 52, 12, C.dim, 'left', '600');
      drawClemmen(ctx, t);
      drawSchuetz(ctx, t);
      drawMotor(ctx, t);
      toggle(ctx, L.reverse, !!ctl.reverse, ctl.reverse ? 'Drehrichtung links' : 'Drehrichtung rechts', C.acc);
      toggle(ctx, L.phaseLoss, !!ctl.phaseLoss, ctl.phaseLoss ? 'Phase L3 FEHLT' : 'Phasen intakt', C.bad);
      drawMini(ctx, t);
      drawField(ctx, t);
      drawFU(ctx, t);
      // Warnbanner
      const blink = Math.floor(t / 300) % 2 === 0;
      let b = null;
      if (S.fuse || (ctl.source === 'netz' && ctl.K2 && ctl.K3)) b = ['KURZSCHLUSS: Stern + Dreieck gleichzeitig!', C.bad, '#2a0a0a'];
      else if (S.stallFlag) b = ['KIPPT · Last über Kippmoment (' + fmt(S.MKnow, 1) + ' Nm)', C.bad, '#2a0a0a'];
      else if (S.st.overheat) b = ['ÜBERHITZT · ' + Math.round(S.temp) + ' °C', C.bad, '#2a0a0a'];
      else if (S.fuTrip) b = ['FU-Störung: Überstrom', C.bad, '#2a0a0a'];
      else if (ctl.phaseLoss && S.live) b = ['PHASENAUSFALL · einphasiger Lauf', C.warn, '#2a1a05'];
      if (b && blink) { rr(ctx, 346, 62, 306, 30, 8); ctx.fillStyle = b[1]; ctx.globalAlpha = 0.92; ctx.fill(); ctx.globalAlpha = 1; txt(ctx, b[0], 499, 77, 14, b[2], 'center', '900'); }
      ctx.restore();
    }

    return {
      id: 'drehstrom', controls: CONTROLS, meters: METERS, presets: PRESETS, events: ev,
      setControl, getControl, step, readMeters, state, draw, hitTest, curves, reset,
      worldSize() { return { w: W, h: H }; },
      nameplate,
      applyPreset(id) { const p = PRESETS.find(q => q.id === id); if (p) Object.keys(p.params).forEach(k => setControl(k, p.params[k])); }
    };
  }

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
