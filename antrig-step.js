(function (root) {
  'use strict';
  const R = root.ANT_RIGS = root.ANT_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 3: Schrittmotor =====
  // Physik: ANT_CORE.stepper (Moment-Winkel-Sinusmodell, Pull-out/Pull-in, Resonanz, Schrittverlust aus der Dynamik).
  // Dieser Pruefstand liefert Steuerung, Messgeraete, Kennlinien, Ereignisse und die Animation.
  //   Lageeinheit = Vollschritt (1 Schritt = 1,8 Grad mechanisch = 90 Grad elektrisch, 4 Schritte = 1 elektrische Periode).
  //   Te = -Mh * ik * g(f) * k_Feld * sin(pi/2 * (theta - phi_soll))
  //   g(f) = 1/(1 + f/fc): Das Moment faellt mit der Schrittfrequenz (Induktivitaet begrenzt den Spulenstrom).
  //   Schrittverlust ergibt sich aus der Bewegungsgleichung (Pull-in/Pull-out), nicht aus einer Schwelle.
  const STEP_DEG = 1.8, STEP_RAD = STEP_DEG * Math.PI / 180;
  const W = 1000, H = 560;
  const TAU = Math.PI * 2;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };

  // Ansteuermuster [A1,A2,B1,B2]
  const PATTERNS = {
    voll: [[1, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 1], [1, 0, 0, 1]],
    halb: [[1, 0, 0, 0], [1, 0, 1, 0], [0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 1], [0, 0, 0, 1], [1, 0, 0, 1]],
    wave: [[1, 0, 0, 0], [0, 0, 1, 0], [0, 1, 0, 0], [0, 0, 0, 1]]
  };
  const MODE_NAME = { voll: 'Vollschritt', halb: 'Halbschritt', wave: 'Wave-Drive' };
  const UNIT = { voll: 1, halb: 0.5, wave: 1 };

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const fmt = (v, d) => (+v).toFixed(d).replace('.', ',');
  const mod = (a, n) => ((a % n) + n) % n;
  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function phiOf(b) { // Bits -> { iA, iB, phi (Vollschritte), k (Feldstaerke 0..1) }
    const iA = b[0] - b[1], iB = b[2] - b[3];
    const k = Math.hypot(iA, iB) / Math.SQRT2;
    return { iA, iB, k, phi: k > 0 ? Math.atan2(iB, iA) / (Math.PI / 2) : 0 };
  }

  const CONTROLS = [
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'auto', options: [{ value: 'auto', label: 'Automatik (Takt)' }, { value: 'manuell', label: 'Manuell (Schalter)' }], group: 'Ansteuerung', help: 'Automatik: der Treiber erzeugt das Muster aus dem Takt. Manuell: du schaltest die Spulen selbst.' },
    { key: 'stepMode', label: 'Schrittart', type: 'select', value: 'voll', options: [{ value: 'voll', label: 'Vollschritt' }, { value: 'halb', label: 'Halbschritt' }, { value: 'wave', label: 'Wave-Drive' }], group: 'Ansteuerung', help: 'Vollschritt: 2 Spulen, 1,8° je Schritt. Halbschritt: 0,9° je Schritt. Wave: nur 1 Spule, weniger Moment.' },
    { key: 'dir', label: 'Drehrichtung', type: 'select', value: 'vor', options: [{ value: 'vor', label: 'Vorwärts (links herum)' }, { value: 'zurueck', label: 'Rückwärts (rechts herum)' }], group: 'Ansteuerung' },
    { key: 'rate', label: 'Schrittfrequenz', type: 'slider', min: 1, max: 2000, step: 1, unit: 'Schritte/s', value: 100, group: 'Ansteuerung', help: 'Bei hoher Frequenz fällt das Moment ab und der Motor verliert Schritte.' },
    { key: 'run', label: 'Lauf (Takt an)', type: 'switch', value: false, group: 'Ansteuerung' },
    { key: 'go', label: 'Einzelschritt', type: 'button', value: false, group: 'Ansteuerung', help: 'Ein Schritt in die gewählte Richtung.' },
    { key: 'current', label: 'Spulenstrom', type: 'slider', min: 0.1, max: 3, step: 0.05, unit: 'A', value: 1.0, group: 'Treiber', help: 'Mehr Strom gibt mehr Moment, aber auch mehr Wärme.' },
    { key: 'load', label: 'Lastmoment', type: 'slider', min: 0, max: 1.5, step: 0.01, unit: 'Nm', value: 0.05, group: 'Last' },
    { key: 'A1', label: 'Spule A, Anschluss 1', type: 'switch', value: false, group: 'Spulen (manuell)', help: 'A1 und A2 gleichzeitig = Spule stromlos (Kurzschluss im Treiber).' },
    { key: 'A2', label: 'Spule A, Anschluss 2', type: 'switch', value: false, group: 'Spulen (manuell)' },
    { key: 'B1', label: 'Spule B, Anschluss 1', type: 'switch', value: false, group: 'Spulen (manuell)' },
    { key: 'B2', label: 'Spule B, Anschluss 2', type: 'switch', value: false, group: 'Spulen (manuell)' }
  ];
  const METERS = [
    { key: 'angle', label: 'Winkel', unit: '°', digits: 1, min: 0, max: 360 },
    { key: 'steps', label: 'Schritte (Soll)', unit: '', digits: 0, min: -400, max: 400 },
    { key: 'rpm', label: 'Drehzahl', unit: '1/min', digits: 0, min: -700, max: 700 },
    { key: 'lostSteps', label: 'Verlorene Schritte', unit: '', digits: 0, min: 0, max: 200, warnAbove: 0.5 },
    { key: 'torqueAvail', label: 'Verfügbares Moment', unit: 'Nm', digits: 3, min: 0, max: 1.5 },
    { key: 'current', label: 'Strom', unit: 'A', digits: 2, min: 0, max: 3 },
    { key: 'temp', label: 'Temperatur', unit: '°C', digits: 0, min: 20, max: 160, warnAbove: 130 }
  ];
  const PRESETS = [
    { id: 'nema14', name: 'Motor NEMA 14 (klein, 0,13 Nm)', params: { motor: 'nema14', current: 0.8, load: 0.02 } },
    { id: 'nema17', name: 'Motor NEMA 17 (0,4 Nm)', params: { motor: 'nema17', current: 1.0, load: 0.05 } },
    { id: 'nema23', name: 'Motor NEMA 23 (1,3 Nm)', params: { motor: 'nema23', current: 2.0, load: 0.15 } },
    { id: 'last0', name: 'Last: Leerlauf (0 Nm)', params: { load: 0 } },
    { id: 'last1', name: 'Last: leicht (0,05 Nm)', params: { load: 0.05 } },
    { id: 'last2', name: 'Last: mittel (0,2 Nm)', params: { load: 0.2 } },
    { id: 'last3', name: 'Last: schwer (0,35 Nm)', params: { load: 0.35 } }
  ];

  R.register({
    id: 'schritt', name: 'Schrittmotor', icon: '🔩',
    info: 'Schrittmotor mit Treiber: 200 Schritte je Umdrehung (1,8° je Schritt). Probiere Voll-, Halb- und Wave-Drive, erhöhe die Schrittfrequenz und beobachte, wann der Motor Schritte verliert.',
    controls: CONTROLS, meters: METERS, presets: PRESETS,
    create(opts) { return createRig(opts || {}); }
  });

  function getCore() {
    const c = root.ANT_CORE || (typeof require === 'function' ? require('./antcore.js') : null);
    if (!c || !c.stepper) throw new Error('ANT_CORE (antcore.js) ist nicht geladen.');
    return c;
  }
  const THERM = 20; // Zeitraffer der Erwaermung fuer die Vorfuehrung (Zeitkonstante ca. 15 s)

  function createRig(opts) {
    const CORE = getCore();
    const ctl = {};
    CONTROLS.forEach(c => { ctl[c.key] = c.value; });
    let motorId = (opts && opts.motor) || 'nema17';
    let mot = null, mp = null;
    const ev = [];
    let S;
    function newMotor() { mot = CORE.stepper({ preset: motorId, thermFactor: THERM }); mp = mot.params; }

    function initState() {
      newMotor();
      S = { t: 0, theta: 0.5, thRel: 0, phiU: 0.5, pi: 0, bits: [1, 0, 1, 0], cmdCount: 0, rpm: 0, temp: 25, devAmp: 0, avail: 0, Te: 0, hold: 0,
        winDt: 0, winTh: 0, lost: 0, lostPrev: 0, lastSlipEv: -1e9, recentSlipT: -1e9, stallFlag: false, heatFlag: false, resFlag: false, stuckT: 0, st: null, pos: 0, fRes: 100, fEst: 0 };
      ev.length = 0;
      sync(mot.step(0, buildInp()));
    }
    function say(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; e.x = x == null ? 300 : x; e.y = y == null ? 290 : y; }
      ev.push(e); if (ev.length > 80) ev.shift();
    }
    const dirNum = () => ctl.dir === 'zurueck' ? -1 : 1;
    function buildInp() {
      const base = { load: num(ctl.load, 0), current: num(ctl.current, 1) };
      if (ctl.mode === 'auto') return Object.assign(base, { rate: num(ctl.rate, 100), run: !!ctl.run, dir: dirNum(), stepMode: ctl.stepMode });
      return Object.assign(base, { pattern: [ctl.A1 ? 1 : 0, ctl.A2 ? 1 : 0, ctl.B1 ? 1 : 0, ctl.B2 ? 1 : 0] });
    }
    function unit() { return ctl.mode === 'auto' && ctl.stepMode === 'halb' ? 0.5 : (S && S.st && S.st.stepMode === 'halb' ? 0.5 : 1); }
    function pulseRate() { return ctl.mode === 'auto' && ctl.run ? clamp(num(ctl.rate, 100), 1, 2000) : 0; }
    const availAt = () => S.avail;
    function lostSigned() {
      const l = S.lost; if (!l) return 0;
      const d = Math.round((S.phiU - S.theta) / 4);
      return (d < 0 ? -1 : 1) * l;
    }
    function idxOf(bits, mode) { const tab = CORE.stepPatterns[mode] || CORE.stepPatterns.voll; for (let i = 0; i < tab.length; i++) if (tab[i].join('') === bits.join('')) return i; return 0; }
    function sync(st) {
      S.st = st;
      S.thRel = st.theta; S.theta = st.theta / STEP_RAD + 0.5;
      S.phiU = 0.5 + st.fieldSteps;
      S.bits = st.pattern.slice();
      S.cmdCount = st.steps; S.temp = st.temp; S.devAmp = st.vibration; S.lost = st.lostSteps; S.pos = st.pos;
      S.fRes = st.fRes; S.fEst = st.rate;
      const wave = st.stepMode === 'wave' && ctl.mode === 'auto' ? Math.SQRT1_2 : 1;
      S.avail = st.torqueAvail * wave; S.hold = st.torqueHold; S.Te = st.torque;
      if (ctl.mode === 'auto') S.pi = idxOf(st.pattern, st.stepMode);
    }

    function setControl(key, value) {
      if (key === 'motor') { if (CORE.stepperPresets[value] && value !== motorId) { motorId = value; initState(); } return; }
      const def = CONTROLS.find(c => c.key === key); if (!def) return;
      if (def.type === 'switch') value = !!value;
      else if (def.type === 'button') {
        value = !!value;
        if (value && !ctl.go) {
          if (ctl.mode === 'auto') { mot.step(0, buildInp()); sync(mot.pulse(dirNum())); }
          else {
            const tab = CORE.stepPatterns[ctl.stepMode];
            const cur = [ctl.A1 ? 1 : 0, ctl.A2 ? 1 : 0, ctl.B1 ? 1 : 0, ctl.B2 ? 1 : 0];
            let ix = tab.findIndex(r => r.join('') === cur.join(''));
            if (ix < 0) ix = 0; else ix = mod(ix + dirNum(), tab.length);
            const b = tab[ix]; ctl.A1 = !!b[0]; ctl.A2 = !!b[1]; ctl.B1 = !!b[2]; ctl.B2 = !!b[3];
            sync(mot.step(0, buildInp()));
          }
        }
        ctl[key] = value; return;
      } else if (def.type === 'slider') value = clamp(num(value, def.value), def.min, def.max);
      else if (def.type === 'select') { if (!def.options.some(o => o.value === value)) return; }
      ctl[key] = value;
      if (key === 'A1' || key === 'A2' || key === 'B1' || key === 'B2') {
        if (ctl.mode === 'auto') { // Schalter antippen: automatisch auf manuell wechseln, die anderen Spulen behalten ihren Zustand
          const b = S.bits; ctl.A1 = !!b[0]; ctl.A2 = !!b[1]; ctl.B1 = !!b[2]; ctl.B2 = !!b[3]; ctl[key] = value; ctl.mode = 'manuell';
        }
      } else if (key === 'mode' && value === 'manuell') { const b = S.bits; ctl.A1 = !!b[0]; ctl.A2 = !!b[1]; ctl.B1 = !!b[2]; ctl.B2 = !!b[3]; }
    }
    function getControl(key) { return ctl[key]; }

    function step(dtMs) {
      dtMs = num(dtMs, 0); if (dtMs <= 0) return;
      dtMs = Math.min(dtMs, 120000);
      const inp = buildInp();
      let remain = dtMs, slipEv = false, st = S.st;
      const chunk = dtMs > 2000 ? 40 : 10;
      while (remain > 1e-9) {
        const c = Math.min(chunk, remain); remain -= c;
        st = mot.step(c, inp); S.t += c; if (st.slipEvent) slipEv = true;
        sync(st);
        S.winDt += c;
        if (S.winDt >= 200) { const r = (st.theta - S.winTh) / S.winDt * 1000 * 30 / Math.PI; S.rpm = Math.abs(r) < 0.05 ? 0 : (Math.abs(S.rpm - r) > 30 ? r : 0.5 * S.rpm + 0.5 * r); S.winTh = st.theta; S.winDt = 0; }
        if (remain > 1e-9 && st.slipEvent) monitor(true);
      }
      monitor(slipEv);
    }

    function monitor(slipEv) {
      const st = S.st, lost = S.lost, rate = pulseRate();
      if (lost > S.lostPrev && S.t - S.lastSlipEv > 700) {
        S.lastSlipEv = S.t;
        say(rate > 0
          ? 'Schrittverlust! Das Lastmoment (' + fmt(num(ctl.load, 0), 2) + ' Nm) ist größer als das verfügbare Moment (' + fmt(S.avail, 2) + ' Nm) bei ' + Math.round(rate) + ' Schritten/s, oder die Beschleunigung war zu hart. Bisher ' + lost + ' Schritte verloren.'
          : 'Schrittverlust! Der Rotor wurde vom Lastmoment aus der Rastlage gezogen (' + lost + ' Schritte).', 'warn', 'stepslip', 300, 290);
      }
      if (lost > S.lostPrev || slipEv) S.recentSlipT = S.t;
      S.lostPrev = lost;
      // Stehen und Brummen
      if (st.stalled && !S.stallFlag) { S.stallFlag = true; say('Der Motor steht still und brummt: Er kann dem Takt nicht folgen. Lastmoment zu hoch oder Frequenz zu hoch. Senke die Frequenz oder die Last und drücke Reset.', 'error', 'stall', 300, 290); }
      else if (S.stallFlag && !st.stalled && Math.abs(S.rpm) > 20) S.stallFlag = false;
      if (S.stallFlag && !ctl.run && ctl.mode === 'auto') S.stallFlag = false;
      // Resonanz
      if (st.resonance && !S.resFlag && rate > 0) { S.resFlag = true; say('Resonanz! Bei etwa ' + Math.round(st.fRes) + ' Schritten/s schwingt der Rotor stark und der Motor dröhnt. Gehe schnell durch diesen Bereich oder nutze Halbschritt.', 'warn'); }
      else if (S.resFlag && !st.resonance) S.resFlag = false;
      // Hitze
      if (st.overheat && !S.heatFlag) { S.heatFlag = true; say('Überhitzung! Die Wicklung ist ' + Math.round(S.temp) + ' °C heiß. Strom verringern oder Spulen abschalten, auch im Stillstand fließt der volle Strom.', 'error', 'overheat', 300, 290); }
      else if (S.heatFlag && S.temp < 110) { S.heatFlag = false; say('Der Motor ist wieder abgekühlt.', 'info'); }
    }

    function readMeters() {
      const st = S.st, f = CORE.stepPatterns.decode(S.bits);
      return {
        angle: mod(st.angle, 360), steps: S.cmdCount, rpm: S.rpm, lostSteps: S.lost, torqueAvail: S.avail,
        current: f.on ? num(ctl.current, 1) : 0, temp: S.temp
      };
    }
    function state() {
      const m = readMeters(), st = S.st;
      const faults = [];
      if (S.lost > 0) faults.push('Schrittverlust');
      if (st.overheat) faults.push('Überhitzung');
      if (S.stallFlag) faults.push('Motor steht');
      return {
        t: S.t, rpm: S.rpm, rate: pulseRate(), angle: m.angle, theta: st.angle, pos: S.pos, steps: S.cmdCount, lostSteps: S.lost, lostSigned: lostSigned(),
        torque: Math.min(Math.abs(num(ctl.load, 0)), S.avail), torqueAvail: S.avail, holdTorque: S.hold, current: m.current, voltage: mp.uSupply, power: 0, temp: S.temp,
        stalled: S.stallFlag, resonance: st.resonance, fRes: S.fRes, dev: S.theta - S.phiU, devAmp: S.devAmp,
        bits: S.bits.slice(), patIndex: ctl.mode === 'auto' ? S.pi : -1, stepMode: st.stepMode, mode: ctl.mode, run: !!ctl.run,
        stepAngle: st.stepAngle, stepsPerRev: 360 / st.stepAngle, motor: motorId, slips: st.slips, fault: faults.length > 0, faults
      };
    }
    function reset() { initState(); }

    function curves() {
      const spf = ctl.mode === 'auto' && ctl.stepMode === 'halb' ? 2 : 1;
      const wave = ctl.stepMode === 'wave' && ctl.mode === 'auto' ? Math.SQRT1_2 : 1;
      const cv = mot.curve({ fMax: 2000 / spf, n: 80, current: num(ctl.current, 1) });
      const po = cv.pullOut.map(p => [Math.round(p[0] * spf), +(p[1] * wave).toFixed(4)]);
      const pi = cv.pullIn.map(p => [Math.round(p[0] * spf), +(p[1] * wave).toFixed(4)]);
      const L = num(ctl.load, 0);
      const rate = pulseRate() || num(ctl.rate, 0);
      const hold = mp.Mh;
      const dv = [];
      for (let d = -2; d <= 2.0001; d += 0.1) dv.push([+d.toFixed(2), +(S.hold * Math.sin(Math.PI / 2 * d)).toFixed(4)]);
      return [
        { id: 'moment-frequenz', title: 'Drehmoment über Schrittfrequenz', xLabel: 'Schrittfrequenz', xUnit: 'Schritte/s', yLabel: 'Drehmoment', yUnit: 'Nm',
          series: [{ name: 'Pull-out (Ausfallmoment)', points: po }, { name: 'Pull-in (Anlaufgrenze)', points: pi }, { name: 'Lastmoment', points: [[0, L], [2000, L]] }],
          marker: { x: rate, y: L } },
        { id: 'moment-winkel', title: 'Moment über Lagefehler (Statik)', xLabel: 'Lagefehler', xUnit: 'Schritte', yLabel: 'Drehmoment', yUnit: 'Nm',
          series: [{ name: 'Rückstellmoment', points: dv }], marker: { x: clamp(S.theta - S.phiU, -2, 2), y: clamp(-S.Te, -hold * 2, hold * 2) } }
      ];
    }

    const model = { get Mh() { return mp.Mh; } };
    initState();

    // ---------- Zeichnen ----------
    const vis = { prevTheta: null, prevT: -1, sweep: 0, smoke: [], sparkT: 0 };
    const L = { // Hit-Bereiche (Weltkoordinaten)
      A1: [632, 292, 56, 38], A2: [694, 292, 56, 38], B1: [756, 292, 56, 38], B2: [818, 292, 56, 38],
      go: [872, 340, 102, 36], run: [632, 340, 104, 36]
    };
    function hitTest(px, py, w, h) {
      const s = Math.min(w / W, h / H), ox = (w - W * s) / 2, oy = (h - H * s) / 2;
      const x = (px - ox) / s, y = (py - oy) / s;
      for (const k of ['A1', 'A2', 'B1', 'B2', 'go', 'run']) {
        const r = L[k]; if (x >= r[0] - 4 && x <= r[0] + r[2] + 4 && y >= r[1] - 4 && y <= r[1] + r[3] + 4) return { key: k, kind: k === 'go' ? 'button' : 'switch' };
      }
      return null;
    }

    function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath(); }
    function txt(ctx, s, x, y, size, col, align, weight) { ctx.font = (weight || '600') + ' ' + size + 'px ' + FONT; ctx.fillStyle = col; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y); }
    function panel(ctx, x, y, w, h, title) {
      rr(ctx, x, y, w, h, 12); ctx.fillStyle = C.panel; ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      if (title) txt(ctx, title, x + 16, y + 20, 14, C.dim, 'left', '700');
    }
    function glow(ctx, x, y, r, rgb, a) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(' + rgb + ',' + a + ')'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
    function toggle(ctx, r, on, label, col, hot) {
      rr(ctx, r[0], r[1], r[2], r[3], 8);
      ctx.fillStyle = on ? (col || C.ok) : '#1a2026'; ctx.globalAlpha = on ? 0.9 : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = on ? '#ffffff55' : C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, label, r[0] + r[2] / 2, r[1] + r[3] / 2, 15, on ? '#0b1a10' : C.dim, 'center', '800');
    }

    function drawRotor(ctx, ang, alpha, R0) {
      // Magnetrotor: N rot, S blau; ang in Grad (gegen den Uhrzeigersinn)
      ctx.save(); ctx.rotate(-ang * Math.PI / 180); ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.arc(0, 0, R0, -Math.PI / 2, Math.PI / 2, false); ctx.closePath();
      let g = ctx.createLinearGradient(0, -R0, R0, R0); g.addColorStop(0, '#ff8a8a'); g.addColorStop(1, '#c23a3a'); ctx.fillStyle = g; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, R0, Math.PI / 2, Math.PI * 1.5, false); ctx.closePath();
      g = ctx.createLinearGradient(0, -R0, -R0, R0); g.addColorStop(0, '#7cc0ff'); g.addColorStop(1, '#2a6fc0'); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      const s = Math.min(w / W, h / H);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      ctx.translate((w - W * s) / 2, (h - H * s) / 2); ctx.scale(s, s);
      const f = phiOf(S.bits);
      const heat = clamp((S.temp - 70) / 70, 0, 1);
      const lostNow = Math.abs(lostSigned());
      const slipRecent = S.t - S.recentSlipT < 1800 || S.stallFlag;
      const pat = PATTERNS[ctl.stepMode];
      const curRow = ctl.mode === 'auto' ? mod(S.pi, pat.length) : pat.findIndex(r => r.join('') === S.bits.join(''));
      const ur = unit();

      // Bild-Rotationsgeschwindigkeit
      if (vis.prevTheta == null || t < vis.prevT || t - vis.prevT > 500) { vis.prevTheta = S.theta; vis.prevT = t; vis.sweep = 0; }
      else if (t - vis.prevT >= 1) { vis.sweep = (S.theta - vis.prevTheta) * 90; vis.prevTheta = S.theta; vis.prevT = t; }
      const sweep = vis.sweep, aSweep = Math.abs(sweep);

      // Titel
      txt(ctx, 'Schrittmotor-Prüfstand', 22, 26, 20, C.text, 'left', '800');
      txt(ctx, MODE_NAME[ctl.stepMode] + ' · ' + fmt(STEP_DEG * ur, 1) + '° je Schritt · ' + (200 / ur) + ' Schritte/U', 22, 48, 13, C.dim, 'left', '600');

      // ---------- Motor ----------
      const cx = 300, cy = 290;
      ctx.save();
      let shakeX = 0, shakeY = 0;
      if (S.resFlag || (pulseRate() > 30 && S.devAmp > 0.45 && !slipRecent)) { const a = clamp(S.devAmp, 0, 1.5) * 2.2; shakeX = Math.sin(t * 0.09) * a; shakeY = Math.cos(t * 0.11) * a; }
      if (slipRecent) { shakeX += Math.sin(t * 0.13) * 2.2; shakeY += Math.cos(t * 0.17) * 1.8; }
      ctx.translate(cx + shakeX, cy + shakeY);
      // Gehaeuse
      glow(ctx, 0, 0, 280, '255,90,40', heat * 0.55);
      let g = ctx.createRadialGradient(0, 0, 120, 0, 0, 212);
      g.addColorStop(0, '#2d3641'); g.addColorStop(1, '#1b2128');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 208, 0, TAU); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = heat > 0.05 ? 'rgba(255,' + Math.round(170 - heat * 110) + ',60,' + (0.35 + heat * 0.6) + ')' : '#3a444f'; ctx.stroke();
      // Kuehlrippen aussen
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 2;
      for (let i = 0; i < 36; i++) { const a = i * TAU / 36; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 196, Math.sin(a) * 196); ctx.lineTo(Math.cos(a) * 207, Math.sin(a) * 207); ctx.stroke(); }
      // Spulenkoerper A (links/rechts) und B (oben/unten)
      const coils = [
        { ang: 0, i: f.iA, name: 'A' }, { ang: 180, i: -f.iA, name: 'A' },
        { ang: 90, i: f.iB, name: 'B' }, { ang: 270, i: -f.iB, name: 'B' }
      ];
      const curK = clamp(num(ctl.current, 1) / 1.5, 0.15, 1.4);
      coils.forEach(c => {
        ctx.save(); ctx.rotate(-c.ang * Math.PI / 180);
        // Polkoerper
        ctx.fillStyle = '#586573'; ctx.fillRect(112, -26, 82, 52);
        // Polschuh
        ctx.fillStyle = '#6a7886'; ctx.beginPath(); ctx.moveTo(112, -44); ctx.lineTo(130, -44); ctx.lineTo(130, 44); ctx.lineTo(112, 44); ctx.closePath(); ctx.fill();
        const on = c.i !== 0;
        // Wicklung
        for (let k = 0; k < 6; k++) {
          const x0 = 142 + k * 9;
          ctx.fillStyle = on ? 'rgb(' + Math.round(210 + 40 * Math.min(1, curK)) + ',' + Math.round(120 + 40 * curK) + ',50)' : '#9a6a3a';
          rr(ctx, x0, -38, 7, 76, 3); ctx.fill();
          if (on) { ctx.fillStyle = 'rgba(255,230,160,' + (0.25 + 0.12 * Math.sin(t * 0.01 + k)) + ')'; rr(ctx, x0 + 1, -36, 2.5, 72, 1); ctx.fill(); }
        }
        if (on) {
          // Polaritaet am Polschuh: i>0 -> N (rot), i<0 -> S (blau)
          const north = c.i > 0;
          const col = north ? '255,92,92' : '59,158,255';
          glow(ctx, 112, 0, 64, col, 0.55 + 0.1 * Math.sin(t * 0.012));
          ctx.fillStyle = north ? '#ff6b6b' : '#4aa8ff'; ctx.fillRect(108, -44, 6, 88);
          ctx.save(); ctx.translate(100, 0); ctx.rotate(c.ang * Math.PI / 180); txt(ctx, north ? 'N' : 'S', 0, 0, 20, north ? '#ff9a9a' : '#9cd0ff', 'center', '900'); ctx.restore();
          // Stromrichtungspfeil
          ctx.strokeStyle = 'rgba(255,240,200,0.9)'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(150, 44); ctx.lineTo(188, 44); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(188, 44); ctx.lineTo(180, 39); ctx.moveTo(188, 44); ctx.lineTo(180, 49); ctx.stroke();
        }
        ctx.save(); ctx.translate(199, 0); ctx.rotate(c.ang * Math.PI / 180); txt(ctx, c.name, 0, 0, 14, C.text, 'center', '800'); ctx.restore();
        ctx.restore();
      });
      // Luftspalt und Rotorgrund
      ctx.fillStyle = '#0f1317'; ctx.beginPath(); ctx.arc(0, 0, 108, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#3a444f'; ctx.lineWidth = 2; ctx.stroke();
      // Feldvektor des Stators
      const fa = S.phiU * 90 * Math.PI / 180;
      if (f.k > 0) {
        ctx.save(); ctx.globalAlpha = 0.5 + 0.2 * f.k;
        ctx.strokeStyle = C.acc; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.setLineDash([2, 10]);
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(fa) * 104, -Math.sin(fa) * 104); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
      }
      // Rotor
      const rotAng = S.theta * 90;
      if (aSweep > 40) {
        // Verschmiert: Hoehere Frequenz
        const a = clamp((aSweep - 40) / 120, 0, 1);
        drawRotor(ctx, 0, 0.55, 98); drawRotor(ctx, 180, 0.55, 98);
        ctx.fillStyle = 'rgba(160,110,200,' + (0.25 + 0.3 * a) + ')'; ctx.beginPath(); ctx.arc(0, 0, 98, 0, TAU); ctx.fill();
        ctx.lineWidth = 7; ctx.lineCap = 'round';
        const dirS = sweep >= 0 ? 1 : -1;
        for (let k = 0; k < 4; k++) {
          const a0 = (t * 0.35 * dirS + k * 90) * Math.PI / 180;
          ctx.strokeStyle = 'rgba(230,237,243,' + (0.35 + 0.2 * a) + ')';
          ctx.beginPath(); ctx.arc(0, 0, 70 + (k % 2) * 16, -a0, -a0 - dirS * 0.9, dirS > 0); ctx.stroke();
        }
      } else {
        const nGhost = aSweep > 4 ? Math.min(7, Math.round(aSweep / 6)) : 0;
        for (let k = nGhost; k >= 1; k--) drawRotor(ctx, rotAng - sweep * k / (nGhost + 1), 0.16, 98);
        drawRotor(ctx, rotAng, 1, 98);
      }
      // Rotorbeschriftung, Naben
      if (aSweep <= 40) {
      ctx.save(); ctx.rotate(-rotAng * Math.PI / 180);
      txt(ctx, 'N', 56, 0, 30, 'rgba(255,255,255,0.85)', 'center', '900'); txt(ctx, 'S', -56, 0, 30, 'rgba(255,255,255,0.85)', 'center', '900');
      ctx.fillStyle = '#e6edf3'; ctx.beginPath(); ctx.moveTo(98, 0); ctx.lineTo(70, -9); ctx.lineTo(70, 9); ctx.closePath(); ctx.fill();
      ctx.restore();
      }
      ctx.fillStyle = '#9aa7b4'; ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
      ctx.fillStyle = '#3a444f'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, TAU); ctx.fill();
      // Feldpfeil (durchgezogen, kurz) am Rotor
      ctx.strokeStyle = 'rgba(59,158,255,0.95)'; ctx.lineWidth = 3; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(Math.cos(fa) * 112, -Math.sin(fa) * 112); ctx.lineTo(Math.cos(fa) * 126, -Math.sin(fa) * 126); ctx.stroke();
      // Heiss: Dampf
      if (heat > 0.25) {
        for (let i = 0; i < 6; i++) {
          const ph = ((t * 0.0004 * (0.6 + hash(i)) + hash(i + 9)) % 1);
          const sx = -140 + hash(i + 3) * 280, sy = -215 - ph * 60;
          ctx.fillStyle = 'rgba(200,205,215,' + (0.30 * (1 - ph) * heat) + ')';
          ctx.beginPath(); ctx.arc(sx + Math.sin(t * 0.003 + i) * 8, sy, 10 + ph * 22, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
      txt(ctx, 'Modell: 1 Schritt = 90° im Bild (in Wirklichkeit 1,8°)', cx, 515, 12, C.dim, 'center', '600');

      // Balken unter dem Motor
      const avail = availAt(), loadV = num(ctl.load, 0);
      const bx = 60, bw = 480;
      rr(ctx, bx, 530, bw, 12, 6); ctx.fillStyle = '#1a2026'; ctx.fill();
      const fullScale = Math.max(model.Mh * 1.15, loadV * 1.1, 0.05);
      const bwA = clamp(avail / fullScale, 0, 1) * bw;
      rr(ctx, bx, 530, Math.max(bwA, 8), 12, 6); ctx.fillStyle = avail >= loadV ? C.ok : C.bad; ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
      const lx = bx + clamp(loadV / fullScale, 0, 1) * bw;
      ctx.fillStyle = C.warn; ctx.fillRect(lx - 2, 524, 4, 24);
      txt(ctx, 'Moment: verfügbar ' + fmt(avail, 2) + ' Nm', bx, 553, 11, avail >= loadV ? C.ok : C.bad, 'left', '700');
      txt(ctx, 'Last ' + fmt(loadV, 2) + ' Nm', bx + bw, 553, 11, C.warn, 'right', '700');
      // Temperatur
      rr(ctx, 570, 100, 14, 260, 7); ctx.fillStyle = '#1a2026'; ctx.fill();
      const th = clamp((S.temp - 20) / 140, 0, 1);
      rr(ctx, 570, 100 + 260 * (1 - th), 14, 260 * th, 7); ctx.fillStyle = S.st.overheat ? C.bad : S.temp > 85 ? C.warn : C.ok; ctx.fill();
      ctx.fillStyle = C.bad; ctx.fillRect(566, 100 + 260 * (1 - (130 - 20) / 140) - 1, 22, 2);
      txt(ctx, Math.round(S.temp) + ' °C', 577, 378, 12, S.st.overheat ? C.bad : C.dim, 'center', '700');
      txt(ctx, 'Temp.', 577, 88, 11, C.dim, 'center', '700');

      // ---------- Ansteuermuster ----------
      panel(ctx, 612, 14, 372, 238, 'Ansteuermuster · ' + MODE_NAME[ctl.stepMode]);
      const cols = [646, 726, 782, 838, 894, 954];
      ['Nr', 'A1', 'A2', 'B1', 'B2', 'Lage'].forEach((hh, i) => txt(ctx, hh, cols[i], 62, 12, C.dim, 'center', '700'));
      const rh = pat.length > 4 ? 21 : 36, y0 = 76;
      for (let i = 0; i < pat.length; i++) {
        const y = y0 + i * rh, on = i === curRow;
        if (on) { rr(ctx, 622, y, 352, rh - 3, 6); ctx.fillStyle = 'rgba(59,158,255,0.22)'; ctx.fill(); ctx.strokeStyle = C.acc; ctx.lineWidth = 2; ctx.stroke(); }
        txt(ctx, String(i + 1), cols[0], y + (rh - 3) / 2, 13, on ? C.text : C.dim, 'center', '700');
        for (let j = 0; j < 4; j++) {
          const bitOn = pat[i][j] === 1, cxx = cols[j + 1], cyy = y + (rh - 3) / 2;
          ctx.fillStyle = bitOn ? (on ? C.ok : '#2f7a45') : '#1a2026'; ctx.beginPath(); ctx.arc(cxx, cyy, rh > 30 ? 11 : 8, 0, TAU); ctx.fill();
          if (on && bitOn) glow(ctx, cxx, cyy, 22, '76,217,100', 0.45);
          txt(ctx, bitOn ? '1' : '0', cxx, cyy, 11, bitOn ? '#0b1a10' : '#566270', 'center', '800');
        }
        const ph = phiOf(pat[i]);
        txt(ctx, fmt(mod(ph.phi * 90, 360), 0) + '°', cols[5], y + (rh - 3) / 2, 12, on ? C.text : C.dim, 'center', '600');
      }
      if (ctl.mode === 'manuell') txt(ctx, 'Manuell: Spulenschalter unten', 800, 236, 12, C.warn, 'center', '700');
      else txt(ctx, 'Zeile ' + (curRow + 1) + ' von ' + pat.length + ' aktiv · ' + (ctl.run ? Math.round(num(ctl.rate, 0)) + ' Schritte/s ' + (ctl.dir === 'zurueck' ? 'rückwärts' : 'vorwärts') : 'Takt steht'), 800, 236, 12, C.dim, 'center', '600');

      // ---------- Schalter ----------
      panel(ctx, 612, 262, 372, 124, 'Treiber (antippen)');
      [['A1', 0], ['A2', 1], ['B1', 2], ['B2', 3]].forEach(([k, i]) => {
        const on = S.bits[i] === 1;
        toggle(ctx, L[k], on, k, ctl.mode === 'auto' ? '#2f9a58' : C.ok);
        if (on) glow(ctx, L[k][0] + 28, L[k][1] + 19, 40, '76,217,100', 0.25);
      });
      toggle(ctx, L.run, !!ctl.run, ctl.run ? 'LAUF an' : 'LAUF aus', C.acc);
      toggle(ctx, L.go, !!ctl.go, 'Schritt', C.warn);
      

      // ---------- Winkelskala ----------
      panel(ctx, 612, 396, 372, 156, null);
      txt(ctx, 'Winkel und Zähler', 790, 412, 13, C.dim, 'left', '700');
      const dx = 690, dy = 478, dr = 66;
      ctx.fillStyle = '#0f1317'; ctx.beginPath(); ctx.arc(dx, dy, dr + 10, 0, TAU); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
      for (let i = 0; i < 200; i++) {
        const a = i * TAU / 200 - Math.PI / 2, big = i % 50 === 0, mid = i % 10 === 0;
        const r0 = dr - (big ? 12 : mid ? 7 : 3.5);
        ctx.strokeStyle = big ? C.text : mid ? '#8b98a5' : '#4a5663'; ctx.lineWidth = big ? 2 : 1;
        ctx.beginPath(); ctx.moveTo(dx + Math.cos(a) * r0, dy + Math.sin(a) * r0); ctx.lineTo(dx + Math.cos(a) * dr, dy + Math.sin(a) * dr); ctx.stroke();
      }
      [['0°', 0], ['90°', 1], ['180°', 2], ['270°', 3]].forEach(([s2, i]) => { const a = i * Math.PI / 2 - Math.PI / 2; txt(ctx, s2, dx + Math.cos(a) * (dr - 24), dy + Math.sin(a) * (dr - 24), 10, C.dim, 'center', '700'); });
      const pa = S.thRel - Math.PI / 2;
      ctx.strokeStyle = slipRecent ? C.bad : C.acc; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(dx - Math.cos(pa) * 10, dy - Math.sin(pa) * 10); ctx.lineTo(dx + Math.cos(pa) * (dr - 2), dy + Math.sin(pa) * (dr - 2)); ctx.stroke();
      ctx.fillStyle = C.text; ctx.beginPath(); ctx.arc(dx, dy, 5, 0, TAU); ctx.fill();
      // Sollmarke
      const sa = (S.phiU - 0.5) * STEP_RAD - Math.PI / 2;
      ctx.fillStyle = C.warn; ctx.beginPath(); ctx.arc(dx + Math.cos(sa) * (dr + 4), dy + Math.sin(sa) * (dr + 4), 4, 0, TAU); ctx.fill();
      const ang = mod(S.thRel * 180 / Math.PI, 360);
      txt(ctx, fmt(ang, 1) + '°', dx, dy + 30, 14, C.text, 'center', '800');
      const tx = 790;
      const ist = S.cmdCount - lostSigned();
      txt(ctx, 'Soll-Schritte', tx, 428, 12, C.dim, 'left', '600'); txt(ctx, String(S.cmdCount), 972, 428, 17, C.text, 'right', '800');
      txt(ctx, 'Ist-Schritte', tx, 454, 12, C.dim, 'left', '600'); txt(ctx, String(ist), 972, 454, 17, lostNow ? C.bad : C.text, 'right', '800');
      txt(ctx, 'Abweichung', tx, 480, 12, C.dim, 'left', '600'); txt(ctx, (lostNow ? '−' : '') + lostNow, 972, 480, 17, lostNow ? C.bad : C.ok, 'right', '800');
      txt(ctx, 'Drehzahl', tx, 506, 12, C.dim, 'left', '600'); txt(ctx, Math.round(S.rpm) + ' 1/min', 972, 506, 15, C.text, 'right', '800');
      txt(ctx, 'Pull-out bei ' + Math.round(pulseRate()) + '/s', tx, 530, 11, C.dim, 'left', '600');
      txt(ctx, fmt(avail, 2) + ' Nm', 972, 530, 13, avail >= loadV ? C.ok : C.bad, 'right', '800');

      // Ruckeln / Stehen
      if (slipRecent && Math.floor(t / 280) % 2 === 0) {
        rr(ctx, 120, 62, 360, 38, 10); ctx.fillStyle = 'rgba(255,92,92,0.9)'; ctx.fill();
        txt(ctx, S.stallFlag ? 'MOTOR STEHT · Schritte verloren' : 'RUCKELN · Schrittverlust', 300, 82, 17, '#2a0a0a', 'center', '900');
      } else if (S.resFlag && Math.floor(t / 300) % 2 === 0) {
        rr(ctx, 150, 62, 300, 34, 10); ctx.fillStyle = 'rgba(255,179,64,0.9)'; ctx.fill();
        txt(ctx, 'RESONANZ · Motor dröhnt', 300, 80, 16, '#2a1a05', 'center', '900');
      }
      if (S.st.overheat) { txt(ctx, 'ÜBERHITZT', 577, 410, 12, C.bad, 'center', '900'); }
      ctx.restore();
    }

    return {
      id: 'schritt', controls: CONTROLS, meters: METERS, presets: PRESETS, events: ev,
      setControl, getControl, step, readMeters, state, draw, hitTest, curves, reset,
      worldSize() { return { w: W, h: H }; },
      applyPreset(id) { const p = PRESETS.find(q => q.id === id); if (p) Object.keys(p.params).forEach(k => setControl(k, p.params[k])); }
    };
  }

  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
