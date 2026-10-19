(function (root) {
  'use strict';
  const R = root.ANT_RIGS = root.ANT_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 2: Servo mit Lageregelung =====
  // Physik kommt vollstaendig aus ANT_CORE (antcore.js), dieser Pruefstand rechnet selbst nichts mehr:
  //   Servo       ANT_CORE.servo(Preset 'standard' = Standard-Servo 6 kg*cm, Anschlaege +-182 Grad, thermFactor 20 fuer die Vorfuehrung)
  //   Regler      u = kp*e + ki*Integral(e) - kd*w   (e in rad, kp in V/rad, ki in V/(rad*s), kd in V*s/rad), Stellgroesse begrenzt auf uMax
  //   RC-Servo    ANT_CORE.servoPulse (Sollwinkel = (Puls - 1,5 ms) * 90 Grad/ms); der Pruefstand uebernimmt neue Pulse erst bei der naechsten
  //               steigenden Flanke (Periode), die Regelung des Servos selbst rechnet der Kern
  //   Kennlinien  ANT_CORE.servoPulse und ANT_CORE.servoStepResponse
  // Last: positives load [Nm] zieht den Arm zurueck (in negative Richtung), wie tLoad im Kern. Stoerstoss = ANT_CORE-Kick (negativer Kick = Schlag in + Richtung).
  // Ueberlast: ab 100 Grad C wird uMax auf 30 % gedrosselt (Pruefstand), der Kern liefert die Temperatur.
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  // PL.Tmax = Stillstandsmoment des Servos am Abtrieb (Ke*uMax/Ra*N*etaG, wird in create() aus dem Kern gesetzt), stop = Anschlag
  const PL = { Tmax: 0.61, stop: 182 * D2R };
  const SERVO_PARAMS = { preset: 'standard', limits: [-182, 182], thermFactor: 20 };
  const T_AMB = 25, T_OVER = 100, T_BACK = 85;
  const DIST_MS = 120;       // Dauer des Stoerstosses (wie ANT_CORE.servo kick)
  const HIT_W = 0.5;         // rad/s am Abtrieb: schneller als das gilt als harter Anschlag
  const core = () => {
    const c = root.ANT_CORE || (typeof require === 'function' ? require('./antcore.js') : null);
    if (!c) throw new Error('ANT_CORE (antcore.js) ist nicht geladen');
    return c;
  };

  const CONTROLS = [
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'regler', group: 'Steuerung', options: [{ value: 'rc', label: 'Modellbau-Servo (Pulsbreite)' }, { value: 'regler', label: 'PID-Lageregelung' }], help: 'Beim Modellbau-Servo bestimmt die Pulsbreite den Winkel. Bei der Lageregelung gibst du den Sollwinkel vor und stellst den Regler selbst ein.' },
    { key: 'pulse', label: 'Pulsbreite', type: 'slider', min: 0.5, max: 2.5, step: 0.01, unit: 'ms', value: 1.5, group: 'Modellbau-Servo', help: '0,5 ms = −90°, 1,5 ms = Mitte, 2,5 ms = +90°.' },
    { key: 'period', label: 'Periodendauer', type: 'select', value: 20, group: 'Modellbau-Servo', options: [{ value: 10, label: '10 ms' }, { value: 20, label: '20 ms' }, { value: 50, label: '50 ms' }], help: 'Alle 20 ms kommt ein neuer Puls. Bei langer Periode reagiert der Servo träger.' },
    { key: 'setpoint', label: 'Sollwinkel', type: 'slider', min: -180, max: 180, step: 1, unit: '°', value: 0, group: 'Regler', help: 'Jede Änderung ist ein Sprung. Die Sprungantwort wird ausgewertet.' },
    { key: 'kp', label: 'kp (P-Anteil)', type: 'slider', min: 0, max: 200, step: 0.5, unit: 'V/rad', value: 20, group: 'Regler', help: 'Verstärkung: Zu klein ist träge, zu groß schwingt der Regler.' },
    { key: 'ki', label: 'ki (I-Anteil)', type: 'slider', min: 0, max: 100, step: 0.5, unit: 'V/(rad·s)', value: 0, group: 'Regler', help: 'Der I-Anteil beseitigt die bleibende Regelabweichung unter Last.' },
    { key: 'kd', label: 'kd (D-Anteil)', type: 'slider', min: 0, max: 5, step: 0.05, unit: 'V·s/rad', value: 1, group: 'Regler', help: 'Der D-Anteil dämpft das Schwingen (wie eine Bremse).' },
    { key: 'load', label: 'Lastmoment', type: 'slider', min: 0, max: 0.8, step: 0.01, unit: 'Nm', value: 0, group: 'Last', help: 'Konstantes Moment, das den Arm zurückzieht. Über 0,6 Nm schafft der Motor es nicht mehr.' },
    { key: 'disturb', label: 'Störstoß', type: 'button', value: false, group: 'Last', help: 'Ein kurzer Stoß gegen den Arm. Wie gut regelt der Regler aus?' }
  ];
  const METERS = [
    { key: 'angle', label: 'Istwinkel', unit: '°', digits: 1, min: -180, max: 180 },
    { key: 'error', label: 'Regelabweichung', unit: '°', digits: 1, min: -180, max: 180 },
    { key: 'rpm', label: 'Drehzahl (Abtrieb)', unit: '1/min', digits: 1, min: 0, max: 100 },
    { key: 'current', label: 'Motorstrom', unit: 'A', digits: 2, min: 0, max: 1.5 },
    { key: 'torque', label: 'Motormoment', unit: 'Nm', digits: 2, min: 0, max: 0.8 },
    { key: 'temp', label: 'Wicklungstemperatur', unit: '°C', digits: 0, min: 20, max: 160, warnAbove: 100 },
    { key: 'overshoot', label: 'Überschwingen', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'settle', label: 'Ausregelzeit', unit: 's', digits: 2, min: 0, max: 5 }
  ];
  const PRESETS = [
    { id: 'gut', name: 'Gut eingestellt (PD)', params: { mode: 'regler', kp: 20, ki: 0, kd: 1, load: 0 } },
    { id: 'zuviel', name: 'kp zu hoch (schwingt)', params: { mode: 'regler', kp: 150, ki: 0, kd: 0, load: 0 } },
    { id: 'nurp', name: 'Nur P mit Last (Dauerfehler)', params: { mode: 'regler', kp: 6, ki: 0, kd: 0.05, load: 0.12 } },
    { id: 'pi', name: 'PI-Regler mit Last', params: { mode: 'regler', kp: 6, ki: 5, kd: 0.05, load: 0.12 } },
    { id: 'rc', name: 'Modellbau-Servo (Puls)', params: { mode: 'rc', pulse: 1.5, period: 20, load: 0 } }
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const GREEN = [76, 217, 100], BLUE = [59, 158, 255], AMB = [255, 179, 64], RED = [255, 92, 92];

  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    const C0 = core();
    let sv = C0.servo(SERVO_PARAMS);                 // Physikmodell des Kerns
    const sp0 = sv.params, mp0 = sp0.motor;
    const UMAX = sp0.uMax, KP_RC = sp0.kp, KD_RC = sp0.kd;
    PL.Tmax = Math.round(mp0.Ke * UMAX / mp0.Ra * sp0.N * sp0.etaG * 100) / 100;      // Stillstandsmoment am Abtrieb
    const kickNm = () => sp0.kickNm > 0 ? sp0.kickNm : 0.5 * mp0.Ke * (UMAX / mp0.Ra) * sp0.N * sp0.etaG;   // Stoerstoss wie im Kern
    const pulseToDeg = pl => C0.servoPulse.toAngle(pl);
    let S, V;

    function resetState() {
      sv.reset();
      S = { t: 0, acc: 0, p: { th: 0, w: 0, T: T_AMB, tq: 0 }, rcTarget: pulseToDeg(Cv.pulse), phaseOld: 0, sp: 0, step: null, hist: [], histAcc: 0,
        overshoot: 0, settle: 0, derate: 1, ovAct: false, oscAct: false, oscQ: 0, stopAct: false, stopPrev: false, stallAct: false,
        btn: false, cur: 0, pulseHigh: false, tqAvg: 0, sat: false, distAnim: 0 };
      S.sp = Cv.mode === 'rc' ? S.rcTarget : Cv.setpoint;
      V = { trail: [], last: null, flash: 0 };
      events.length = 0;
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t * 1000), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    const tipPos = () => { const a = (S.p.th * R2D - 90) * D2R; return [DIAL.x + Math.cos(a) * 150, DIAL.y + Math.sin(a) * 150]; };

    function startStep(tgt) {
      const y0 = S.p.th * R2D;
      if (Math.abs(tgt - y0) < 1) { S.step = null; return; }
      S.step = { y0, tgt, t0: S.t, peak: 0 };
    }

    // ein Zeitstueck ms: Pulsflanken (RC) im Pruefstand, Regelkreis im Kern
    function sub(ms) {
      const rc = Cv.mode === 'rc';
      if (rc) {
        const per = Cv.period / 1000;
        const ph = fr((S.t + ms / 1000 + 1e-9) / per) * per;      // Phase am Ende des Zeitstuecks
        S.pulseHigh = ph < clamp(Cv.pulse, 0.5, 2.5) / 1000;
        if (ph < S.phaseOld) {                       // neue Periode = steigende Flanke: Puls wird abgetastet
          const nt = pulseToDeg(Cv.pulse);
          if (Math.abs(nt - S.rcTarget) > 0.01) { const old = S.rcTarget; S.rcTarget = nt; if (Math.abs(nt - old) >= 1) startStep(nt); }
        }
        S.phaseOld = ph;
      }
      S.sp = rc ? S.rcTarget : Cv.setpoint;
      const uMax = UMAX * S.derate;
      const inp = rc ? { mode: 'rc', pulse: C0.servoPulse.fromAngle(S.rcTarget), period: Cv.period, load: Cv.load, uMax: uMax }
        : { mode: 'regler', setpoint: Cv.setpoint, kp: Cv.kp, ki: Cv.ki, kd: Cv.kd, load: Cv.load, uMax: uMax };
      const wPre = Math.abs(S.p.w);
      const st = sv.step(ms, inp);
      S.p.th = st.theta; S.p.w = st.w; S.p.T = st.temp; S.p.tq = st.torque; S.t = st.t;
      S.cur = Math.abs(st.i); S.tqAvg = Math.abs(st.torque); S.sat = st.saturated;
      S.overshoot = st.overshoot; S.settle = st.settle;
      const th = st.angle;
      if (S.step) { const dirS = Math.sign(S.step.tgt - S.step.y0), over = (th - S.step.tgt) * dirS; if (over > S.step.peak) S.step.peak = over; }
      // Verlauf: [Zeit s, Ist Grad, Soll Grad, Moment Nm]
      S.histAcc += ms;
      if (S.histAcc >= 10) { S.histAcc = S.histAcc % 10; S.hist.push([S.t, th, S.sp, S.p.tq]); if (S.hist.length > 700) S.hist.shift(); }
      // Schwingen (Erkennung im Kern)
      if (st.oscillating) {
        S.oscQ = 0;
        if (!S.oscAct) {
          S.oscAct = true;
          const tp = tipPos(), kpNow = rc ? KP_RC : Cv.kp;
          ev('Der Regler schwingt! Die Verstärkung kp = ' + f1(kpNow, 1) + ' ist zu hoch. Verkleinere kp oder erhöhe den D-Anteil kd, dann beruhigt sich der Arm.', 'warn', 'stall', tp[0], tp[1]);
        }
      } else if (S.oscAct) {
        S.oscQ += ms;
        if (S.oscQ > 1200) { S.oscAct = false; ev('Der Arm hat sich beruhigt.', 'info'); }
      }
      // Anschlag
      if (st.atStop && !S.stopPrev && wPre > HIT_W && !S.stopAct) { S.stopAct = true; const tp = tipPos(); ev('Anschlag! Der Arm ist mit ' + f1(wPre * 60 / TWO_PI, 0) + ' 1/min gegen den mechanischen Anschlag gefahren.', 'warn', 'crash', tp[0], tp[1]); }
      S.stopPrev = st.atStop;
      if (S.stopAct && Math.abs(th) < 170) S.stopAct = false;
      // Ueberlast
      if (!S.ovAct && S.p.T > T_OVER) {
        S.ovAct = true; S.derate = 0.3;
        ev('Überlast! Die Wicklung hat ' + f1(S.p.T, 0) + ' °C erreicht. Der Servo drosselt sein Moment auf 30 %. Mögliche Ursache: Last zu groß oder Dauerschwingen.', 'error', 'overheat', DIAL.x, DIAL.y - 60);
      } else if (S.ovAct && S.p.T < T_BACK) { S.ovAct = false; S.derate = 1; ev('Die Wicklung ist abgekühlt, der Servo hat wieder volles Moment.', 'info'); }
      // Blockiert: voll ausgesteuert, steht aber und Abweichung gross (Erkennung im Kern)
      if (!S.stallAct && st.stalled) { S.stallAct = true; ev('Der Servo schafft die Last nicht: Das Lastmoment ist größer als das Motormoment (' + f1(PL.Tmax * S.derate, 2) + ' Nm). Der Strom bleibt am Anschlag.', 'warn'); }
      else if (S.stallAct && !st.stalled) S.stallAct = false;
    }
    function stepCore(dtMs) {
      const piece = Cv.mode === 'rc' ? 1 : 10;           // RC: 1-ms-Raster fuer die Pulsflanken
      const n = Math.max(1, Math.ceil(dtMs / piece - 1e-9)), h = dtMs / n;
      for (let k = 0; k < n; k++) sub(h);
    }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      let v;
      if (d.type === 'switch' || d.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (d.type === 'slider') v = clamp(num(value, d.value), d.min, d.max);
      else { const o = d.options.find(x => String(x.value) === String(value)); v = o ? o.value : d.value; }
      const old = Cv[key];
      Cv[key] = v;
      if (key === 'setpoint' && Cv.mode === 'regler' && old !== v) { startStep(v); S.sp = v; }
      if (key === 'mode' && old !== v) {
        if (v === 'rc') { S.rcTarget = pulseToDeg(Cv.pulse); S.sp = S.rcTarget; startStep(S.rcTarget); }
        else { S.sp = Cv.setpoint; startStep(Cv.setpoint); }
      }
      if (key === 'disturb') {
        if (v && !S.btn) {
          S.btn = true; S.distAnim = 600;
          const nm = kickNm();
          sv.kick(-nm, DIST_MS);                       // Schlag in + Richtung (positiver Kick des Kerns wirkt in - Richtung)
          const tp = tipPos(); ev('Störstoß! Ein kurzer Schlag von ' + f1(nm, 2) + ' Nm trifft den Arm. Beobachte, wie schnell der Regler ihn zurückholt.', 'info', null, tp[0], tp[1]);
        }
        if (!v) S.btn = false;
      }
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      const keys = Object.keys(p.params);
      if (p.params.mode) setControl('mode', p.params.mode);
      keys.forEach(k => { if (k !== 'mode') setControl(k, p.params[k]); });
      return true;
    }

    function readMeters() {
      const th = S.p.th * R2D;
      return { angle: th, error: S.sp - th, rpm: Math.abs(S.p.w) * 60 / TWO_PI, current: S.cur, torque: S.tqAvg, temp: S.p.T, overshoot: S.overshoot, settle: S.settle };
    }
    function state() {
      const th = S.p.th * R2D;
      const faults = [];
      if (S.ovAct) faults.push('overload');
      if (S.oscAct) faults.push('oscillation');
      if (S.stopAct || Math.abs(th) >= PL.stop * R2D - 0.01) faults.push('stop');
      return {
        angle: th, pos: th, theta: S.p.th, setpoint: S.sp, error: S.sp - th, rpm: S.p.w * 60 / TWO_PI, omega: S.p.w,
        current: S.cur, torque: S.tqAvg, torqueCmd: S.p.tq, temp: S.p.T, overshoot: S.overshoot, settle: S.settle,
        stalled: S.stallAct, oscillating: S.oscAct, atStop: faults.indexOf('stop') >= 0, fault: faults.length > 0, faults,
        mode: Cv.mode, pulse: Cv.pulse, derate: S.derate, t: S.t * 1000, stepActive: !!S.step
      };
    }

    // ---- Kennlinien (aus dem Kern) ----
    function curves() {
      const rc = Cv.mode === 'rc';
      const pts = [0.5, 1.5, 2.5].map(pl => [pl, C0.servoPulse.toAngle(pl)]);
      // Dauerabweichung unter Last (RC-Servo: P-Regler mit kp = Kernwert, Totband db): Motormoment = Last/(N*etaG) - Haftreibung,
      // Spannung u = Ra*i, Abweichung e = u/kp, mindestens das Totband
      const motorNm = Math.max(0, Cv.load / (sp0.N * sp0.etaG) - mp0.Mc);
      const eLoad = Math.min(180, Math.max(sp0.db, mp0.Ra * (motorNm / mp0.Ke) / KP_RC * R2D));
      const lim = Cv.load > 0.005 ? eLoad : 0;
      const wl = pts.map(q => [q[0], q[1] - lim]);
      const th = S.p.th * R2D;
      // Sprungantwort aus dem Kern
      const stepAmp = S.step ? S.step.tgt - S.step.y0 : (Math.abs(S.sp) >= 5 ? S.sp : 90);
      const g = rc ? { kp: KP_RC, ki: 0, kd: KD_RC } : { kp: Cv.kp, ki: Cv.ki, kd: Cv.kd };
      const tEnd = 3;
      const sr = C0.servoStepResponse(SERVO_PARAMS, { kp: g.kp, ki: g.ki, kd: g.kd, load: Cv.load }, stepAmp, tEnd * 1000);
      const ist = sr.points.filter((q, k) => k % 4 === 0 || k === sr.points.length - 1);
      const sollSeries = [[0, 0], [0.0001, stepAmp], [tEnd, stepAmp]];
      const mx = S.step ? { x: clamp(S.t - S.step.t0, 0, tEnd), y: th - S.step.y0 } : { x: 0, y: 0 };
      return [
        { id: 'puls', title: 'Pulsbreite → Winkel', xLabel: 'Pulsbreite', xUnit: 'ms', yLabel: 'Winkel', yUnit: '°',
          series: [{ name: 'Sollwinkel (ideal)', points: pts }, { name: 'Istwinkel mit Last', points: wl }], marker: { x: clamp(Cv.pulse, 0.5, 2.5), y: rc ? th : pulseToDeg(Cv.pulse) } },
        { id: 'sprung', title: 'Sprungantwort', xLabel: 'Zeit', xUnit: 's', yLabel: 'Winkel', yUnit: '°',
          series: [{ name: 'Sollwert', points: sollSeries }, { name: 'Istwinkel', points: ist }], marker: mx }
      ];
    }

    // ================= Zeichnen =================
    const DIAL = { x: 385, y: 292, R: 172 };
    const degAng = d => (d - 90) * D2R;

    function drawDial(ctx, t) {
      const { x, y, R: Rd } = DIAL;
      // Skalenscheibe
      const g = ctx.createRadialGradient(x, y, 40, x, y, Rd);
      g.addColorStop(0, '#222a31'); g.addColorStop(1, '#171d22');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, Rd, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#3a444f'; ctx.lineWidth = 3; ctx.stroke();
      // RC-Bereich +-90 Grad
      ctx.strokeStyle = 'rgba(59,158,255,0.45)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(x, y, Rd - 8, degAng(-90), degAng(90)); ctx.stroke();
      // Anschlagblock unten
      ctx.fillStyle = '#7a2a2a'; ctx.beginPath(); ctx.arc(x, y, Rd - 2, degAng(177), degAng(183)); ctx.arc(x, y, Rd - 20, degAng(183), degAng(177), true); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = RED_S; ctx.lineWidth = 1.5; ctx.stroke();
      // Teilstriche
      for (let d = -180; d < 180; d += 10) {
        const major = d % 30 === 0, a = degAng(d), r1 = Rd - (major ? 22 : 14), r2 = Rd - 8;
        ctx.strokeStyle = major ? '#c4ccd4' : '#6a7480'; ctx.lineWidth = major ? 2.5 : 1.5;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.lineTo(x + Math.cos(a) * r2, y + Math.sin(a) * r2); ctx.stroke();
        if (major && d !== -180) txt(ctx, d === 180 ? '±180' : String(d), x + Math.cos(a) * (Rd - 38), y + Math.sin(a) * (Rd - 38), d === 0 ? 15 : 12, d === 0 ? C.text : C.dim, 'center', d === 0);
      }
      txt(ctx, '°', x, y - Rd + 24, 11, C.dim, 'center');
    }
    const RED_S = '#ff5c5c';

    function drawServoBody(ctx, t) {
      const { x, y } = DIAL;
      const heat = clamp((S.p.T - 55) / 55, 0, 1);
      // Befestigungsohren
      ctx.fillStyle = '#2d353d'; rr(ctx, x - 92, y + 42, 184, 22, 5); ctx.fill();
      ctx.strokeStyle = '#11161b'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#12171b'; [x - 78, x + 78].forEach(px => { ctx.beginPath(); ctx.arc(px, y + 53, 5, 0, TWO_PI); ctx.fill(); });
      // Gehaeuse
      const gg = ctx.createLinearGradient(x - 62, 0, x + 62, 0);
      gg.addColorStop(0, '#242b32'); gg.addColorStop(0.5, '#3a444e'); gg.addColorStop(1, '#1d242a');
      ctx.fillStyle = gg; rr(ctx, x - 62, y - 70, 124, 140, 12); ctx.fill();
      ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2.5; ctx.stroke();
      if (heat > 0.03) { ctx.fillStyle = rgba([255, 70, 30], heat * 0.45); rr(ctx, x - 62, y - 70, 124, 140, 12); ctx.fill(); }
      // Aufkleber
      ctx.fillStyle = '#d7dde3'; rr(ctx, x - 46, y + 12, 92, 38, 4); ctx.fill();
      txt(ctx, 'SERVO', x, y + 25, 15, '#16202a', 'center', true);
      txt(ctx, 'Pulsbreite 0,5…2,5 ms', x, y + 41, 10, '#33404c', 'center');
      // Sichtfenster mit Poti-Andeutung
      ctx.fillStyle = '#0c1014'; ctx.beginPath(); ctx.arc(x - 30, y + 90 - 52, 0.1, 0, TWO_PI); ctx.fill();
    }

    function drawPointers(ctx, t) {
      const { x, y, R: Rd } = DIAL;
      const th = S.p.th * R2D, sp = S.sp;
      // Fehlerkeil
      const e = sp - th;
      if (Math.abs(e) > 0.3) {
        ctx.fillStyle = rgba(Math.abs(e) > 10 ? AMB : GREEN, 0.18);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, Rd - 56, degAng(th), degAng(sp), e < 0); ctx.closePath(); ctx.fill();
      }
      // Sollzeiger (gruen, duenn, mit Pfeil am Rand)
      const a = degAng(sp);
      ctx.strokeStyle = rgba(GREEN, 0.9); ctx.lineWidth = 3; ctx.lineCap = 'round';
      if (ctx.setLineDash) ctx.setLineDash([10, 7]);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * 24, y + Math.sin(a) * 24); ctx.lineTo(x + Math.cos(a) * (Rd - 24), y + Math.sin(a) * (Rd - 24)); ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      const tx = Math.cos(a), ty = Math.sin(a), nx = -ty, ny = tx;
      ctx.fillStyle = rgba(GREEN, 1); ctx.beginPath();
      ctx.moveTo(x + tx * (Rd - 6), y + ty * (Rd - 6));
      ctx.lineTo(x + tx * (Rd - 28) + nx * 10, y + ty * (Rd - 28) + ny * 10);
      ctx.lineTo(x + tx * (Rd - 28) - nx * 10, y + ty * (Rd - 28) - ny * 10); ctx.closePath(); ctx.fill();
      // Schleppspur des Arms
      V.trail.push(th); if (V.trail.length > 6) V.trail.shift();
      const moving = Math.abs(S.p.w) > 1.2;
      if (moving) for (let k = 0; k < V.trail.length - 1; k++) drawArm(ctx, V.trail[k], 0.06 + 0.05 * k, false);
      drawArm(ctx, th, 1, true);
      // Istmarke am Rand
      const ai = degAng(th), ix = Math.cos(ai), iy = Math.sin(ai);
      ctx.fillStyle = rgba(AMB, 1); ctx.beginPath();
      ctx.moveTo(x + ix * (Rd - 6), y + iy * (Rd - 6));
      ctx.lineTo(x + ix * (Rd - 24) - iy * 8, y + iy * (Rd - 24) + ix * 8);
      ctx.lineTo(x + ix * (Rd - 24) + iy * 8, y + iy * (Rd - 24) - ix * 8); ctx.closePath(); ctx.fill();
    }
    function drawArm(ctx, deg, alpha, detail) {
      const { x, y } = DIAL, a = degAng(deg), L = 150;
      ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(a);
      const g = ctx.createLinearGradient(0, -14, 0, 14); g.addColorStop(0, '#7cc0ff'); g.addColorStop(0.5, '#3b9eff'); g.addColorStop(1, '#1f5fa8');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(L - 6, -11); ctx.arc(L - 6, 0, 11, -Math.PI / 2, Math.PI / 2); ctx.lineTo(0, 17); ctx.arc(0, 0, 17, Math.PI / 2, -Math.PI / 2); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#143f6e'; ctx.lineWidth = 2; ctx.stroke();
      if (detail) {
        ctx.fillStyle = '#0c1014'; ctx.beginPath(); ctx.arc(L - 6, 0, 5, 0, TWO_PI); ctx.fill();
        for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(40 + k * 24, 0, 3.2, 0, TWO_PI); ctx.fill(); }
        ctx.fillStyle = '#e9eef3'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, TWO_PI); ctx.fill();
        ctx.strokeStyle = '#555'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      }
      ctx.restore();
    }

    function drawDisturb(ctx, t) {
      if (!(S.distAnim > 0)) return;
      const u = 1 - S.distAnim / 600;
      const tp = tipPos(), a = degAng(S.p.th * R2D), tx = -Math.sin(a), ty = Math.cos(a);   // Tangente (Drehrichtung +)
      // Hammer faehrt von der negativen Seite gegen die Spitze
      const hit = 0.35;
      const off = u < hit ? -(1 - u / hit) * 90 - 18 : -18 - (u - hit) / (1 - hit) * 70;
      const hx = tp[0] + tx * off, hy = tp[1] + ty * off;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(Math.atan2(ty, tx));
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(-90, -4, 76, 8);
      ctx.fillStyle = '#b8c2cc'; rr(ctx, -16, -20, 30, 40, 5); ctx.fill(); ctx.strokeStyle = '#4a545e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      if (u >= hit) {
        const k = (u - hit) / (1 - hit);
        ctx.strokeStyle = 'rgba(255,200,80,' + (1 - k) + ')'; ctx.lineWidth = 3;
        for (let r = 0; r < 3; r++) { const rad = 10 + k * 60 + r * 14; ctx.beginPath(); ctx.arc(tp[0], tp[1], rad, 0, TWO_PI); ctx.stroke(); }
        txt(ctx, 'STÖRSTOSS!', tp[0], tp[1] - 36 - k * 14, 17, 'rgba(255,200,80,' + (1 - k * 0.7) + ')', 'center', true);
      }
    }

    function drawLeft(ctx, t) {
      txt(ctx, 'Servo mit Lageregelung', 20, 26, 18, C.text, 'left', true);
      // Steuergeraet
      ctx.fillStyle = C.panel; rr(ctx, 14, 52, 176, 120, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      const rc = Cv.mode === 'rc';
      txt(ctx, rc ? 'PULSGEBER' : 'REGLER', 28, 68, 12, C.dim, 'left', true);
      ctx.fillStyle = (rc ? S.pulseHigh : true) ? C.ok : '#24402b'; ctx.beginPath(); ctx.arc(172, 68, 6, 0, TWO_PI); ctx.fill();
      if (rc) {
        txt(ctx, f1(Cv.pulse, 2) + ' ms', 100, 100, 28, '#7ee0ff', 'center', true, MONO);
        txt(ctx, 'alle ' + Cv.period + ' ms', 100, 128, 14, C.dim, 'center');
        txt(ctx, '= ' + f1(S.rcTarget, 0) + '°', 100, 150, 15, C.ok, 'center', true);
      } else {
        txt(ctx, 'kp ' + f1(Cv.kp, 1), 28, 96, 15, C.text, 'left', true, MONO);
        txt(ctx, 'ki ' + f1(Cv.ki, 1), 28, 118, 15, C.text, 'left', true, MONO);
        txt(ctx, 'kd ' + f1(Cv.kd, 2), 28, 140, 15, C.text, 'left', true, MONO);
        txt(ctx, 'Soll', 178, 96, 12, C.dim, 'right');
        txt(ctx, f1(Cv.setpoint, 0) + '°', 178, 118, 22, C.ok, 'right', true, MONO);
      }
      // Kabel zum Servo (drei Adern)
      const sx = 190, sy = 150, ex = DIAL.x - 62, ey = DIAL.y + 20;
      const cols = [['#7a4b22', 0], ['#d03030', 10], [S.pulseHigh && rc ? '#fff2a0' : '#e8a020', 20]];
      cols.forEach(cc => { ctx.strokeStyle = cc[0]; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy + cc[1] - 10); ctx.bezierCurveTo(sx + 80, sy + cc[1] + 80, ex - 80, ey + cc[1] + 20, ex, ey + cc[1] - 10); ctx.stroke(); });
      ctx.fillStyle = '#12171b'; rr(ctx, ex - 4, ey - 14, 10, 38, 3); ctx.fill();
    }

    function drawStoerButton(ctx, t) {
      const x = 30, y = 440, w = 136, h = 52, on = S.distAnim > 0;
      ctx.fillStyle = on ? 'rgba(255,92,92,0.35)' : '#2a323b'; rr(ctx, x, y, w, h, 12); ctx.fill();
      ctx.strokeStyle = on ? C.bad : '#556270'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, '⚡ Störstoß', x + w / 2, y + h / 2, 17, on ? '#fff' : C.text, 'center', true);
    }

    function drawScopeTop(ctx, t) {
      const x0 = 590, y0 = 14, w = 396, h = 168;
      ctx.fillStyle = C.panel; rr(ctx, x0, y0, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      const rc = Cv.mode === 'rc';
      const px = x0 + 16, pw = w - 32, py = y0 + 34, ph = 58, base = py + ph;
      ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, py - 6, pw + 8, ph + 14, 6); ctx.fill();
      if (rc) {
        txt(ctx, 'STEUERSIGNAL  Pulsfolge', x0 + 16, y0 + 17, 12, C.dim, 'left', true);
        const per = Cv.period, win = 2 * per;
        ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
        for (let k = 0; k <= 4; k++) { const gx = px + pw * k / 4; ctx.beginPath(); ctx.moveTo(gx, py - 6); ctx.lineTo(gx, base + 8); ctx.stroke(); }
        ctx.strokeStyle = rgba(AMB, 1); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(px, base);
        for (let k = 0; k < 2; k++) {
          const xa = px + pw * (k * per) / win, xb = px + pw * (k * per + Cv.pulse) / win;
          ctx.lineTo(xa, base); ctx.lineTo(xa, py); ctx.lineTo(xb, py); ctx.lineTo(xb, base);
        }
        ctx.lineTo(px + pw, base); ctx.stroke();
        // Zeitmarke
        const tm = (S.t * 1000) % win;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px + pw * tm / win, py - 6); ctx.lineTo(px + pw * tm / win, base + 8); ctx.stroke();
        txt(ctx, '0', px, base + 18, 11, C.dim, 'center'); txt(ctx, per + ' ms', px + pw / 2, base + 18, 11, C.dim, 'center'); txt(ctx, 2 * per + ' ms', px + pw, base + 18, 11, C.dim, 'right');
        // Lineal 0..3 ms
        const ry = y0 + h - 34, rx = px, rw = pw;
        txt(ctx, 'Pulsbreite ' + f1(Cv.pulse, 2) + ' ms', rx, ry - 12, 14, '#ffd27a', 'left', true);
        txt(ctx, '→ ' + f1(S.rcTarget, 0) + '°', rx + rw, ry - 12, 14, C.ok, 'right', true);
        ctx.fillStyle = '#0c1014'; rr(ctx, rx, ry, rw, 14, 7); ctx.fill();
        const k0 = (v) => rx + rw * v / 3;
        ctx.fillStyle = rgba(AMB, 0.9); rr(ctx, rx + 1, ry + 1, Math.max(2, k0(Cv.pulse) - rx - 2), 12, 6); ctx.fill();
        [[0.5, '−90°'], [1.5, '0°'], [2.5, '+90°']].forEach(q => { ctx.strokeStyle = '#c4ccd4'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(k0(q[0]), ry - 2); ctx.lineTo(k0(q[0]), ry + 16); ctx.stroke(); txt(ctx, q[0] + ' ms ' + q[1], k0(q[0]), ry + 27, 10.5, C.dim, 'center'); });
      } else {
        txt(ctx, 'STELLGRÖSSE  Motormoment der letzten 5 s', x0 + 16, y0 + 17, 12, C.dim, 'left', true);
        const hh = S.hist, nT = 5;
        ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
        [0, 0.5, 1].forEach(f => { ctx.beginPath(); ctx.moveTo(px - 4, py + ph * f); ctx.lineTo(px + pw + 4, py + ph * f); ctx.stroke(); });
        ctx.strokeStyle = rgba(RED, 0.5); ctx.setLineDash && ctx.setLineDash([5, 5]);
        ctx.beginPath(); ctx.moveTo(px, py + 2); ctx.lineTo(px + pw, py + 2); ctx.moveTo(px, base - 2); ctx.lineTo(px + pw, base - 2); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
        txt(ctx, '+' + PL.Tmax + ' Nm', px + pw - 2, py + 12, 10, C.dim, 'right'); txt(ctx, '−' + PL.Tmax + ' Nm', px + pw - 2, base - 12, 10, C.dim, 'right');
        if (hh.length > 1) {
          ctx.strokeStyle = rgba(AMB, 1); ctx.lineWidth = 2; ctx.beginPath();
          const tn = S.t;
          let first = true;
          for (let q = 0; q < hh.length; q++) {
            const age = tn - hh[q][0]; if (age > nT) continue;
            const x = px + pw * (1 - age / nT), y = py + ph / 2 - clamp(hh[q][3] / PL.Tmax, -1, 1) * (ph / 2 - 2);
            if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        const sat = !!S.sat;
        txt(ctx, sat ? 'Der Motor ist voll ausgesteuert (Begrenzung)' : 'Moment ' + f1(S.p.tq, 2) + ' Nm', x0 + 16, y0 + h - 32, 14, sat ? C.warn : C.text, 'left', true);
        txt(ctx, 'Reglerausgang = kp·e + ki·∫e − kd·ω', x0 + 16, y0 + h - 12, 12, C.dim, 'left');
      }
    }

    function drawStepPanel(ctx, t) {
      const x0 = 590, y0 = 196, w = 396, h = 216;
      ctx.fillStyle = C.panel; rr(ctx, x0, y0, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'SPRUNGANTWORT', x0 + 16, y0 + 17, 12, C.dim, 'left', true);
      const px = x0 + 48, pw = w - 66, py = y0 + 32, ph = h - 70;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 6); ctx.fill();
      const hh = S.hist;
      let tA, tB;
      if (S.step && S.t - S.step.t0 < 4.7) { tA = S.step.t0 - 0.3; tB = tA + 5; } else { tB = S.t; tA = tB - 5; }
      let lo = 1e9, hi = -1e9;
      for (let q = 0; q < hh.length; q++) if (hh[q][0] >= tA && hh[q][0] <= tB) { lo = Math.min(lo, hh[q][1], hh[q][2]); hi = Math.max(hi, hh[q][1], hh[q][2]); }
      if (lo > hi) { lo = -10; hi = 10; }
      lo = Math.min(lo, S.sp, S.p.th * R2D); hi = Math.max(hi, S.sp, S.p.th * R2D);
      let span = Math.max(30, hi - lo); const mid = (hi + lo) / 2; lo = mid - span * 0.6; hi = mid + span * 0.6;
      const X = tt => px + pw * (tt - tA) / (tB - tA), Y = v => py + ph - (v - lo) / (hi - lo) * ph;
      // Raster
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
      for (let k = 0; k <= 5; k++) { const gx = px + pw * k / 5; ctx.beginPath(); ctx.moveTo(gx, py); ctx.lineTo(gx, py + ph); ctx.stroke(); }
      const stepV = span > 150 ? 50 : span > 60 ? 20 : 10;
      ctx.font = '10px ' + FONT;
      for (let v = Math.ceil(lo / stepV) * stepV; v <= hi; v += stepV) { const gy = Y(v); ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); ctx.stroke(); txt(ctx, String(v), px - 6, gy, 10, C.dim, 'right'); }
      // Toleranzband
      if (S.step) {
        const size = Math.abs(S.step.tgt - S.step.y0), band = Math.max(0.02 * size, 0.5);
        ctx.fillStyle = 'rgba(76,217,100,0.10)'; ctx.fillRect(px, Y(S.step.tgt + band), pw, Math.max(1, Y(S.step.tgt - band) - Y(S.step.tgt + band)));
      }
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      // Soll
      ctx.strokeStyle = rgba(GREEN, 0.95); ctx.lineWidth = 2; ctx.setLineDash && ctx.setLineDash([7, 5]); ctx.beginPath();
      let first = true, lastY = 0;
      for (let q = 0; q < hh.length; q++) { if (hh[q][0] < tA - 0.1) continue; const x = X(hh[q][0]), y = Y(hh[q][2]); if (first) { ctx.moveTo(x, y); first = false; } else { ctx.lineTo(x, lastY); ctx.lineTo(x, y); } lastY = y; }
      ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
      // Ist
      ctx.strokeStyle = rgba(BLUE, 1); ctx.lineWidth = 2.6; ctx.beginPath(); first = true;
      for (let q = 0; q < hh.length; q++) { if (hh[q][0] < tA - 0.1) continue; const x = X(hh[q][0]), y = Y(hh[q][1]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
      ctx.stroke();
      // Spitzenwert
      if (S.step && S.step.peak > 0.3) {
        const yy = Y(S.step.tgt + Math.sign(S.step.tgt - S.step.y0) * S.step.peak);
        ctx.strokeStyle = rgba(AMB, 0.9); ctx.lineWidth = 1.5; ctx.setLineDash && ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + pw, yy); ctx.stroke(); ctx.setLineDash && ctx.setLineDash([]);
      }
      // Cursor
      const nowX = X(S.t);
      if (nowX >= px && nowX <= px + pw) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(nowX, Y(S.p.th * R2D), 4, 0, TWO_PI); ctx.fill(); }
      ctx.restore();
      txt(ctx, S.step && S.t - S.step.t0 < 4.7 ? '0' : '−5 s', px, py + ph + 12, 10, C.dim, 'left');
      txt(ctx, 'Zeit', px + pw / 2, py + ph + 12, 10, C.dim, 'center');
      // Kennzahlen
      const oc = S.overshoot > 25 ? C.bad : S.overshoot > 10 ? C.warn : C.ok;
      txt(ctx, 'Überschwingen ' + f1(S.overshoot, 0) + ' %', x0 + 16, y0 + h - 14, 14, oc, 'left', true);
      txt(ctx, 'Ausregelzeit ' + f1(S.settle, 2) + ' s', x0 + w - 16, y0 + h - 14, 14, C.text, 'right', true);
      txt(ctx, 'Soll', x0 + w - 98, y0 + 17, 12, rgba(GREEN, 1), 'left', true); txt(ctx, 'Ist', x0 + w - 48, y0 + 17, 12, rgba(BLUE, 1), 'left', true);
    }

    function drawInfo(ctx, t) {
      const x0 = 590, y0 = 426, w = 396, h = 124;
      ctx.fillStyle = C.panel; rr(ctx, x0, y0, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      const th = S.p.th * R2D;
      const items = [['Ist', f1(th, 1), '°', C.acc], ['Abweichung', f1(S.sp - th, 1), '°', Math.abs(S.sp - th) > 5 ? C.warn : C.ok], ['Strom', f1(S.cur, 2), 'A', C.warn], ['Moment', f1(S.tqAvg, 2), 'Nm', C.text]];
      const bw = 88;
      items.forEach((it, k) => {
        const x = x0 + 12 + k * (bw + 8);
        ctx.fillStyle = '#1a2026'; rr(ctx, x, y0 + 12, bw, 54, 8); ctx.fill();
        txt(ctx, it[0], x + 8, y0 + 25, 11, C.dim, 'left', true);
        txt(ctx, it[1], x + bw - 24, y0 + 49, 20, it[3], 'right', true, MONO);
        txt(ctx, it[2], x + bw - 7, y0 + 53, 11, C.dim, 'right');
      });
      // Temperatur
      const bx = x0 + 16, by = y0 + 82, bwid = w - 110;
      txt(ctx, 'Wicklung', bx, by - 6, 11, C.dim, 'left', true);
      ctx.fillStyle = '#0c1014'; rr(ctx, bx, by + 2, bwid, 14, 7); ctx.fill();
      const f = clamp((S.p.T - 20) / 140, 0, 1);
      const g = ctx.createLinearGradient(bx, 0, bx + bwid, 0); g.addColorStop(0, '#4cd964'); g.addColorStop(0.55, '#ffb340'); g.addColorStop(1, '#ff5c5c');
      ctx.fillStyle = g; rr(ctx, bx + 2, by + 4, Math.max(0, (bwid - 4) * f), 10, 5); ctx.fill();
      const xm = bx + (bwid - 4) * ((T_OVER - 20) / 140) + 2; ctx.strokeStyle = RED_S; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, by - 2); ctx.lineTo(xm, by + 20); ctx.stroke();
      txt(ctx, f1(S.p.T, 0) + ' °C', x0 + w - 16, by + 9, 18, S.p.T > T_OVER ? (Math.floor(t / 200) % 2 ? C.bad : C.warn) : C.text, 'right', true);
      // Warnzeile
      let msg = '', col = C.dim;
      if (S.oscAct) { msg = 'SCHWINGT: kp zu hoch!'; col = Math.floor(t / 250) % 2 ? C.bad : C.warn; }
      else if (S.ovAct) { msg = 'ÜBERLAST: Moment gedrosselt'; col = C.bad; }
      else if (S.stallAct) { msg = 'Last zu groß für den Motor'; col = C.warn; }
      else if (S.stopAct) { msg = 'Arm am Anschlag'; col = C.warn; }
      else if (Math.abs(S.sp - th) < 1 && Math.abs(S.p.w) < 0.1) { msg = 'Soll erreicht'; col = C.ok; }
      txt(ctx, msg, x0 + 16, y0 + h - 12, 13, col, 'left', true);
    }

    function drawSmoke(ctx, t) {
      if (!(S.p.T > T_OVER - 10 || S.ovAct)) return;
      for (let k = 0; k < 8; k++) {
        const age = fr(t / 2400 + k / 8), x = DIAL.x - 20 + Math.sin(k * 5 + age * 5) * 20 + age * 30, y = DIAL.y - 70 - age * 90;
        ctx.fillStyle = 'rgba(' + (130 - 60 * age | 0) + ',' + (130 - 60 * age | 0) + ',' + (136 - 60 * age | 0) + ',' + (1 - age) * 0.4 + ')';
        ctx.beginPath(); ctx.arc(x, y, 7 + age * 24, 0, TWO_PI); ctx.fill();
      }
    }

    function drawLoadMark(ctx, t) {
      if (Cv.load < 0.01) return;
      const { x, y } = DIAL;
      // gestrichelter Pfeil im Gegenuhrzeigersinn am Arm: Last zieht zurueck
      const th = S.p.th * R2D, a = degAng(th), r = 118;
      const a1 = a - 0.1, a0 = a - 0.1 - 0.45;
      ctx.strokeStyle = rgba(RED, 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke();
      const ex = x + Math.cos(a0) * r, ey = y + Math.sin(a0) * r, tx = Math.sin(a0), ty = -Math.cos(a0), nx = Math.cos(a0), ny = Math.sin(a0);
      ctx.fillStyle = rgba(RED, 1); ctx.beginPath(); ctx.moveTo(ex + tx * 14, ey + ty * 14); ctx.lineTo(ex + nx * 8, ey + ny * 8); ctx.lineTo(ex - nx * 8, ey - ny * 8); ctx.closePath(); ctx.fill();
      txt(ctx, 'Last ' + f1(Cv.load, 2) + ' Nm', x + Math.cos(a0 - 0.25) * (r + 16), y + Math.sin(a0 - 0.25) * (r + 16), 12, rgba(RED, 1), 'center', true);
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      const sc = Math.min(w / WW, h / WH);
      ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
      ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
      if (S.distAnim > 0) { S.distAnim = Math.max(0, S.distAnim - (V.last == null ? 0 : clamp(t - V.last, 0, 100))); }
      V.last = t;
      drawLeft(ctx, t);
      drawDial(ctx, t);
      drawServoBody(ctx, t);
      drawLoadMark(ctx, t);
      drawPointers(ctx, t);
      drawDisturb(ctx, t);
      drawSmoke(ctx, t);
      drawStoerButton(ctx, t);
      drawScopeTop(ctx, t);
      drawStepPanel(ctx, t);
      drawInfo(ctx, t);
      txt(ctx, '■ Ist (Arm)  ' + f1(S.p.th * R2D, 1) + '°', 214, 512, 14, C.acc, 'left', true); txt(ctx, '▬ Soll  ' + f1(S.sp, 1) + '°', 214, 534, 14, rgba(GREEN, 1), 'left', true);
      ctx.restore();
    }

    function hitTest(px, py, w, h) {
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      if (x > 20 && x < 176 && y > 430 && y < 502) return { key: 'disturb', kind: 'button' };
      return null;
    }

    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'servo', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k]));
    return rig;
  }

  R.register({
    id: 'servo', name: 'Servo mit Lageregelung', icon: '🎯',
    info: 'Ein Modellbau-Servo (Pulsbreite 0,5 bis 2,5 ms) und eine frei einstellbare PID-Lageregelung. Sieh dir Sprungantwort, Überschwingen und Schwingen bei zu hohem kp an und gib einen Störstoß.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
