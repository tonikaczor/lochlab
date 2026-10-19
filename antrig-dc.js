(function (root) {
  'use strict';
  const R = root.ANT_RIGS = root.ANT_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 1: Gleichstrommotor mit H-Bruecke und PWM =====
  // Physik kommt vollstaendig aus ANT_CORE (antcore.js), dieser Pruefstand rechnet selbst nichts mehr:
  //   Motor       ANT_CORE.dcMotor(Preset gm12 | antrieb24 | modell6), Zeit in ms, Thermik thermFactor = 20 (Vorfuehrung)
  //   Bruecke     ANT_CORE.hBridge (Zustaende, 0,2 V Abfall je Schalter), hBridgeTransition (Totzeit), shootCurrent (Querstrom)
  //   PWM         u = ANT_CORE.pwmAverage(duty als Anteil 0..1, U, 0,2 V), Stromrippel ANT_CORE.pwmRipple
  //   Last        'bremse' = Coulomb-Last load [Nm] (immer bremsend), 'luefter' = fan * w^2 (fan = load / wref^2)
  //   Kennlinien  ANT_CORE.dcDerived (Leerlauf, Kurzschluss) + stationaere Gleichung des Kerns
  // Die Bruecke speist nicht zurueck: Waere der mittlere Strom in Antriebsrichtung negativ, ist der Motor stromlos (open:true).
  // Meldungen deutsch; Weltmass 1000 x 560.
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const DROP_SW = 0.2;       // Bruecke: 0,2 V je Schalter (wie ANT_CORE.hBridge)
  const DROP = 2 * DROP_SW;  // zwei Schalter im Strompfad
  const T_AMB = 25, T_MAX = 130, T_BACK = 100;
  const THERM = 20;          // thermFactor des Kerns: Erwaermung/Abkuehlung 20-fach beschleunigt (Vorfuehrung)
  const I_LIMIT = 10;        // Strombegrenzung des Netzteils (A)
  const TWO_PI = Math.PI * 2;
  const core = () => {
    const c = root.ANT_CORE || (typeof require === 'function' ? require('./antcore.js') : null);
    if (!c) throw new Error('ANT_CORE (antcore.js) ist nicht geladen');
    return c;
  };

  // id/Name der Oberflaeche -> Preset des Kerns; mMax, Ra, Ke usw. kommen aus ANT_CORE.dcPresets
  // r = Anzeigebereiche der Messgeraete (rpm, i, ip, tq, pe, pm)
  const MOTORS = [
    { id: 'getriebe12', core: 'gm12', name: 'Getriebemotor 12 V', Mmax: 0.031, step: 0.001, r: { rpm: 12000, i: 4, ip: 5, tq: 0.06, pe: 75, pm: 25 } },
    { id: 'antrieb24', core: 'antrieb24', name: '24-V-Antrieb', Mmax: 2.9, step: 0.01, r: { rpm: 8000, i: 50, ip: 60, tq: 3, pe: 1000, pm: 300 } },
    { id: 'modell', core: 'modell6', name: 'Modellbau-Motor', Mmax: 0.015, step: 0.0005, r: { rpm: 30000, i: 15, ip: 18, tq: 0.06, pe: 300, pm: 80 } }
  ];
  const motorById = id => MOTORS.find(m => m.id === id) || MOTORS[0];
  // Motordaten aus dem Kern holen (Ra, La, Ke, Mc, B, uNom, mMax, Nennstrom)
  function motorData(def) {
    const cp = core().dcPresets[def.core], q = cp.params;
    // Nennstrom: stationaerer Strom bei Nennspannung und Nennlast (Gleichgewicht Kt*i = M + Mc + B*w, w = (u - Ra*i)/Ke)
    const i0 = (cp.nominal.load + q.Mc + q.B * cp.uNom / q.Ke) / (q.Ke + q.B * q.Ra / q.Ke);
    return Object.assign({}, def, { Ra: q.Ra, La: q.La, Ke: q.Ke, Mc: q.Mc, B: q.B, uNom: cp.uNom, Mmax: cp.mMax, iNom: i0, params: Object.assign({}, q) });
  }

  const CONTROLS = [
    { key: 'mode', label: 'Betriebsart', type: 'select', value: 'pwm', group: 'Steuerung', options: [{ value: 'manuell', label: 'manuell (vier Schalter)' }, { value: 'pwm', label: 'PWM (Richtung + Tastgrad)' }], help: 'Manuell schaltest du S1 bis S4 selbst. Im PWM-Betrieb übernimmt die Steuerung die Schalter.' },
    { key: 'S1', label: 'S1 (oben links)', type: 'switch', value: false, group: 'H-Brücke (manuell)', help: 'S1 und S4 zusammen: vorwärts. S2 und S3 zusammen: rückwärts.' },
    { key: 'S2', label: 'S2 (unten links)', type: 'switch', value: false, group: 'H-Brücke (manuell)', help: 'S1 und S2 gleichzeitig = Brückenkurzschluss!' },
    { key: 'S3', label: 'S3 (oben rechts)', type: 'switch', value: false, group: 'H-Brücke (manuell)', help: 'S3 und S4 gleichzeitig = Brückenkurzschluss!' },
    { key: 'S4', label: 'S4 (unten rechts)', type: 'switch', value: false, group: 'H-Brücke (manuell)', help: 'S2 und S4 zusammen: der Motor wird gebremst.' },
    { key: 'dir', label: 'Drehrichtung', type: 'select', value: 'vor', group: 'PWM', options: [{ value: 'vor', label: 'vor (rechts)' }, { value: 'rueck', label: 'zurück (links)' }], help: 'Beim Umschalten braucht die Brücke eine Totzeit.' },
    { key: 'duty', label: 'Tastgrad', type: 'slider', min: 0, max: 100, step: 1, unit: '%', value: 0, group: 'PWM', help: 'Anteil der Periode, in dem der Schalter eingeschaltet ist. Mittelwert der Spannung = Tastgrad mal Betriebsspannung.' },
    { key: 'freq', label: 'PWM-Frequenz', type: 'select', value: 5000, group: 'PWM', options: [{ value: 1000, label: '1 kHz' }, { value: 5000, label: '5 kHz' }, { value: 20000, label: '20 kHz' }], help: 'Hohe Frequenz: kleiner Stromrippel, kein Pfeifen. Niedrige Frequenz: mehr Welligkeit.' },
    { key: 'deadtime', label: 'Totzeit beim Umschalten', type: 'switch', value: true, group: 'PWM', help: 'Aus: beim Richtungswechsel schalten kurz beide Schalter einer Seite ein (Querstrom).' },
    { key: 'uSupply', label: 'Betriebsspannung', type: 'slider', min: 6, max: 24, step: 0.5, unit: 'V', value: 12, group: 'Netzteil', help: 'Netzteil 6 bis 24 V.' },
    { key: 'motor', label: 'Motor', type: 'select', value: 'getriebe12', group: 'Motor und Last', options: MOTORS.map(m => ({ value: m.id, label: m.name })), help: 'Wähle den Motortyp.' },
    { key: 'loadType', label: 'Last', type: 'select', value: 'bremse', group: 'Motor und Last', options: [{ value: 'bremse', label: 'Bremse (festes Moment)' }, { value: 'luefter', label: 'Lüfter (Moment wächst mit n²)' }], help: 'Bremse: konstantes Lastmoment. Lüfter: Moment steigt quadratisch mit der Drehzahl.' },
    { key: 'load', label: 'Lastmoment', type: 'slider', min: 0, max: 0.031, step: 0.001, unit: 'Nm', value: 0, group: 'Motor und Last', help: 'Ist das Lastmoment größer als das Anlaufmoment, blockiert der Motor.' },
    { key: 'brake', label: 'Bremsen (Wicklung kurzschließen)', type: 'button', value: false, group: 'Steuerung', help: 'Halten = bremsen: Die Wicklung wird kurzgeschlossen, der Motor arbeitet als Generator.' }
  ];
  const METERS = [
    { key: 'rpm', label: 'Drehzahl', unit: '1/min', digits: 0, min: 0, max: 12000 },
    { key: 'uMotor', label: 'Motorspannung (Mittelwert)', unit: 'V', digits: 1, min: 0, max: 24 },
    { key: 'iMotor', label: 'Motorstrom (Mittelwert)', unit: 'A', digits: 2, min: 0, max: 4 },
    { key: 'iPeak', label: 'Motorstrom (Spitze)', unit: 'A', digits: 2, min: 0, max: 5 },
    { key: 'torque', label: 'Wellenmoment', unit: 'Nm', digits: 3, min: 0, max: 0.06 },
    { key: 'pElec', label: 'Leistung elektrisch', unit: 'W', digits: 1, min: 0, max: 75 },
    { key: 'pMech', label: 'Leistung mechanisch', unit: 'W', digits: 1, min: 0, max: 25 },
    { key: 'eta', label: 'Wirkungsgrad', unit: '%', digits: 0, min: 0, max: 100 },
    { key: 'temp', label: 'Wicklungstemperatur', unit: '°C', digits: 0, min: 20, max: 160, warnAbove: 100 },
    { key: 'iSupply', label: 'Strom aus dem Netzteil', unit: 'A', digits: 2, min: 0, max: 4 }
  ];
  const PRESETS = [
    { id: 'getriebe12', name: 'Getriebemotor 12 V', params: { motor: 'getriebe12', uSupply: 12, load: 0 } },
    { id: 'antrieb24', name: '24-V-Antrieb', params: { motor: 'antrieb24', uSupply: 24, load: 0 } },
    { id: 'modell', name: 'Modellbau-Motor', params: { motor: 'modell', uSupply: 6, load: 0 } },
    { id: 'leerlauf', name: 'Leerlauf', params: { load: 0, loadType: 'bremse' } },
    // loadFrac = Anteil des Maximalmoments (mMax) des gewaehlten Motors, damit die Voreinstellungen bei jedem Motor passen
    { id: 'halblast', name: 'Halbe Last (Bremse)', params: { loadFrac: 0.25, loadType: 'bremse' } },
    { id: 'luefter', name: 'Lüfter als Last', params: { loadFrac: 0.2, loadType: 'luefter' } },
    { id: 'blockiert', name: 'Blockiert (Dauerlast)', params: { loadFrac: 1, loadType: 'bremse' } }
  ];

  // ---- kleine Helfer ----
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const COL = { vor: [76, 217, 100], rueck: [59, 158, 255], bremse: [255, 179, 64], frei: [200, 160, 70], kurzschluss: [255, 92, 92] };

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
  function sector(ctx, cx, cy, r1, r2, a0, a1) {
    ctx.beginPath(); ctx.arc(cx, cy, r2, a0, a1, false); ctx.arc(cx, cy, r1, a1, a0, true); ctx.closePath();
  }
  function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
  function polyAt(pts, d) {
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= l || i === pts.length - 1) { const k = l > 0 ? clamp(d / l, 0, 1) : 0; return [lerp(pts[i - 1][0], pts[i][0], k), lerp(pts[i - 1][1], pts[i][1], k)]; }
      d -= l;
    }
    return pts[0];
  }

  // ---- Geometrie des Schaltbilds (Weltkoordinaten) ----
  const SCH = { lx: 100, rx: 270, top: 190, bot: 395, mid: 292, mL: 158, mR: 212 };
  const SWPOS = { S1: [SCH.lx, 241], S2: [SCH.lx, 343], S3: [SCH.rx, 241], S4: [SCH.rx, 343] };
  const HOUSING = { x: 640, y: 195, w: 150, h: 110 };
  const DISC = { x: 915, y: 250, r: 58 };

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    const C0 = core();
    let M = motorData(motorById(Cv.motor));
    let mot = C0.dcMotor(Object.assign({}, M.params, { thermFactor: THERM }));   // Physikmodell des Kerns
    const rigMeters = METERS.map(m => Object.assign({}, m));
    let S;                 // dynamischer Zustand
    let H;                 // Verlauf fuer das Schreiber-Feld
    let V;                 // Zustand der Optik
    let drv;               // aktuelle Ansteuerung

    function resetState() {
      mot.reset();
      S = { t: 0, acc: 0, i: 0, w: 0, ra: M.Ra, theta: 0, T: T_AMB, tq: 0, rip: 0, peak: 0, uAvg: 0, ptotCu: 0, iSup: 0, pElec: 0, pMech: 0, eta: 0,
        trip: false, shootT: 0, shootAct: false, ovAct: false, stallAct: false, ocAct: false, stallT: 0, transT: 0, brakeAct: false, histAcc: 0, uShown: Cv.uSupply };
      H = [];
      V = { vis: 0, last: null, blink: 0 };
      events.length = 0;
      drv = computeDrive();
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    // Motorwechsel: Kernmodell bekommt die neuen Parameter (Zustand bleibt), Anzeigebereiche passen zum Motor
    function applyMotor(id) {
      M = motorData(motorById(id));
      mot.setParams(Object.assign({}, M.params, { thermFactor: THERM }));
      const c = defOf.load; c.max = M.Mmax; c.step = M.step; Cv.load = clamp(Cv.load, 0, M.Mmax);
      const r = M.r, mt = { rpm: r.rpm, iMotor: r.i, iSupply: r.i, iPeak: r.ip, torque: r.tq, pElec: r.pe, pMech: r.pm };
      rigMeters.forEach(m => { if (mt[m.key] !== undefined) m.max = mt[m.key]; });
    }
    // Lastvorgabe fuer den Kern: 'bremse' = Coulomb-Last load, 'luefter' = fan * w^2 mit fan = load / wref^2 (wref = 70 % der Nennleerlaufdrehzahl)
    function loadInput() {
      const l = clamp(Cv.load, 0, M.Mmax);
      if (Cv.loadType === 'luefter') { const wref = 0.7 * M.uNom / M.Ke; return { load: 0, fan: l / (wref * wref) }; }
      return { load: l, fan: 0 };
    }

    // Ansteuerung aus den Bedienelementen (Bruecke und PWM aus dem Kern)
    function computeDrive() {
      const U = clamp(Cv.uSupply, 6, 24);
      let mode = 'frei', sgn = 0, duty = 1, uAvg = 0, open = true, sw = [Cv.S1, Cv.S2, Cv.S3, Cv.S4].map(Boolean);
      if (Cv.mode === 'manuell') {
        const b = C0.hBridge(sw, U, DROP_SW); mode = b.mode; sgn = mode === 'vor' ? 1 : mode === 'rueck' ? -1 : 0; uAvg = b.uOut; open = b.open;
      } else {
        duty = clamp(Cv.duty / 100, 0, 1); sgn = Cv.dir === 'rueck' ? -1 : 1;
        mode = duty < 0.0005 ? 'frei' : (sgn > 0 ? 'vor' : 'rueck');
        sw = mode === 'frei' ? [false, false, false, false] : sgn > 0 ? [true, false, false, true] : [false, true, true, false];
        if (mode !== 'frei') { uAvg = C0.pwmAverage(sgn * duty, U, DROP_SW); open = false; }
      }
      let brake = false;
      if (Cv.brake && mode !== 'kurzschluss') { mode = 'bremse'; sgn = 0; duty = 1; brake = true; uAvg = 0; open = false; }
      if (S && S.transT > 0) { mode = 'kurzschluss'; sgn = 0; uAvg = 0; open = true; }
      if (S && S.trip) { mode = mode === 'kurzschluss' ? mode : 'frei'; sgn = 0; duty = 0; uAvg = 0; open = true; }
      const shoot = mode === 'kurzschluss';
      return { U, mode, sgn, duty, sw, shoot, brake, uAvg, open };
    }

    function stepCore(dtMs) {
      drv = computeDrive();
      const mp = mot.params, ld = loadInput();
      // nicht rueckspeisende Bruecke: Wuerde der mittlere Strom gegen die Antriebsrichtung fliessen, ist der Motor stromlos (Freilauf)
      let open = drv.open;
      if (!open && (drv.mode === 'vor' || drv.mode === 'rueck') && drv.sgn * (drv.uAvg - mp.Ke * S.w) < 0) open = true;
      const st = mot.step(dtMs, { u: drv.uAvg, load: ld.load, fan: ld.fan, open: open });
      S.i = st.i; S.w = st.w; S.theta = st.theta; S.T = st.temp; S.ra = st.ra; S.t = st.t;
      const iAvg = Math.abs(S.i);
      const driving = !open && (drv.mode === 'vor' || drv.mode === 'rueck');
      // Stromrippel (PWM): Kern berechnet Rippel und Spitzenstrom
      let rip = 0, peak = iAvg;
      if (Cv.mode === 'pwm' && driving && drv.duty > 0 && drv.duty < 1) {
        const pr = C0.pwmRipple({ duty: drv.duty, uSupply: drv.U, freq: Cv.freq, L: mp.La, R: st.ra, emf: drv.sgn * st.emf, iAvg: iAvg, drop: DROP_SW });
        rip = pr.ripple; peak = pr.iPeak;
      }
      S.rip = rip; S.peak = peak;
      // Spannungen, Strom und Leistungen
      S.uAvg = open ? st.emf : drv.uAvg;
      if (drv.shoot) { const sc = C0.shootCurrent(drv.U, { iLimit: I_LIMIT }); S.iSup = sc.i; S.uShown = sc.uBus; }
      else { S.uShown = drv.U; S.iSup = driving && S.i * drv.sgn > 0 ? drv.duty * iAvg : 0; }
      S.pElec = S.uShown * S.iSup;
      const Tl0 = Cv.loadType === 'luefter' ? 0 : clamp(Cv.load, 0, M.Mmax);
      S.tq = Math.abs(S.w) > 0.02 ? Math.abs(st.torque) : Math.min(Tl0, Math.max(0, Math.abs(st.torque)));
      S.pMech = Math.max(0, st.pMech);
      S.eta = S.pElec > 0.5 ? clamp(S.pMech / S.pElec * 100, 0, 100) : 0;
      // Verlauf fuer den Schreiber
      S.histAcc += dtMs;
      let hn = 0;
      while (S.histAcc >= 100 && hn++ < 100) { S.histAcc -= 100; H.push([S.w * 60 / TWO_PI, S.i]); if (H.length > 100) H.shift(); }
      if (S.histAcc > 100) S.histAcc = 0;
      if (S.transT > 0) S.transT = Math.max(0, S.transT - dtMs);
      // Ereignisse
      const sx = drv.sw[0] && drv.sw[1] ? SCH.lx : SCH.rx;
      if (drv.shoot) {
        S.shootT += dtMs;
        if (!S.shootAct) { S.shootAct = true; ev('Brückenkurzschluss! Die beiden Schalter einer Seite dürfen nie gleichzeitig an sein. Das Netzteil bricht zusammen und begrenzt den Strom auf ' + I_LIMIT + ' A.', 'error', 'shoot', sx, SCH.mid); }
      } else if (S.shootAct) { S.shootAct = false; S.shootT = 0; ev('Kurzschluss beseitigt, das Netzteil erholt sich.', 'info'); }
      if (!S.ovAct && S.T > T_MAX) {
        S.ovAct = true; S.trip = true;
        ev('Überhitzung! Die Wicklung hat ' + Math.round(S.T) + ' °C erreicht (Grenze ' + T_MAX + ' °C). Der Thermoschalter schaltet den Motor ab.', 'error', 'overheat', HOUSING.x + HOUSING.w / 2, HOUSING.y + 20);
      } else if (S.ovAct && S.T < T_BACK) {
        S.ovAct = false; S.trip = false; ev('Die Wicklung ist wieder unter ' + T_BACK + ' °C abgekühlt, der Motor ist wieder frei.', 'info');
      }
      const uDrive = Math.abs(drv.uAvg);
      const driven = (drv.mode === 'vor' || drv.mode === 'rueck') && uDrive > 1.0;
      if (driven && Math.abs(S.w) < 0.5) S.stallT += dtMs; else S.stallT = 0;
      if (!S.stallAct && S.stallT > 400) {
        S.stallAct = true;
        const tStart = mp.Ke * uDrive / S.ra - mp.Mc;
        const l = clamp(Cv.load, 0, M.Mmax);
        if (Cv.loadType !== 'luefter' && l > tStart) ev('Blockiert! Das Lastmoment (' + f1(l, 3) + ' Nm) ist größer als das Anlaufmoment (' + f1(Math.max(tStart, 0), 3) + ' Nm). Der Strom bleibt hoch und die Wicklung wird heiß.', 'warn', 'stall', DISC.x, DISC.y);
        else ev('Der Motor läuft nicht an: Die Spannung ist zu klein, um die Reibung zu überwinden.', 'warn', 'stall', HOUSING.x + HOUSING.w / 2, HOUSING.y + HOUSING.h / 2);
      } else if (S.stallAct && (!driven || Math.abs(S.w) > 2)) S.stallAct = false;
      if (!S.ocAct && driven && iAvg > 2.5 * M.iNom) {
        S.ocAct = true;
        ev('Anlaufstrom! I = ' + f1(iAvg, 1) + ' A, das ist mehr als das 2,5-fache des Nennstroms (' + f1(M.iNom, 1) + ' A). Beim Anlauf gilt I = U / R. Ein PWM-Anlauf mit Rampe hält den Strom klein.', 'warn');
      } else if (S.ocAct && iAvg < 1.5 * M.iNom) S.ocAct = false;
      if (drv.brake && !S.brakeAct) { S.brakeAct = true; ev('Bremsen: Die Wicklung ist kurzgeschlossen, der Motor arbeitet als Generator und bremst sich selbst.', 'info'); }
      if (!drv.brake) S.brakeAct = false;
    }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      let v;
      if (d.type === 'switch' || d.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (d.type === 'slider') v = clamp(num(value, d.value), d.min, d.max);
      else {
        const o = d.options.find(x => String(x.value) === String(value));
        v = o ? o.value : d.value;
      }
      if (/^S[1-4]$/.test(key) && Cv.mode === 'pwm') {
        // Tippen auf einen Schalter im PWM-Betrieb: auf manuell umschalten, Schalter uebernehmen
        const cur = computeDrive();
        Cv.S1 = cur.sw[0]; Cv.S2 = cur.sw[1]; Cv.S3 = cur.sw[2]; Cv.S4 = cur.sw[3];
        Cv.mode = 'manuell';
        ev('Betriebsart auf manuell umgeschaltet: Jetzt schaltest du S1 bis S4 selbst.', 'info');
      }
      const old = Cv[key];
      if (key === 'mode' && v === 'manuell' && old === 'pwm') { const cur = computeDrive(); Cv.S1 = cur.sw[0]; Cv.S2 = cur.sw[1]; Cv.S3 = cur.sw[2]; Cv.S4 = cur.sw[3]; }
      Cv[key] = v;
      if (key === 'motor') applyMotor(v);
      if (key === 'dir' && old !== v && Cv.mode === 'pwm' && Cv.duty > 0 && S) {
        const swOf = d => d === 'rueck' ? [0, 1, 1, 0] : [1, 0, 0, 1];
        const tr = C0.hBridgeTransition(swOf(old), swOf(v), Cv.deadtime ? 1 : 0);      // ohne Totzeit: Querstrom
        if (!tr.risk) ev('Richtungswechsel: Die Brücke wartet die Totzeit ab, bevor der andere Schalter einschaltet. So gibt es keinen Querstrom.', 'info');
        else S.transT = 400;
      }
      if (S) drv = computeDrive();
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      if (p.params.motor) setControl('motor', p.params.motor);
      Object.keys(p.params).forEach(k => { if (k !== 'motor' && k !== 'loadFrac') setControl(k, p.params[k]); });
      if (p.params.loadFrac !== undefined) setControl('load', p.params.loadFrac * M.Mmax);
      return true;
    }

    function readMeters() {
      return {
        rpm: Math.abs(S.w) * 60 / TWO_PI, uMotor: Math.abs(S.uAvg), iMotor: Math.abs(S.i), iPeak: S.peak,
        torque: S.tq, pElec: S.pElec, pMech: S.pMech, eta: S.eta, temp: S.T, iSupply: S.iSup
      };
    }
    function faultsList() {
      const f = [];
      if (drv.shoot) f.push('shoot');
      if (S.T > T_MAX || S.trip) f.push('overheat');
      if (S.stallAct) f.push('stall');
      if (S.ocAct) f.push('overcurrent');
      return f;
    }
    function state() {
      const f = faultsList();
      return {
        rpm: S.w * 60 / TWO_PI, omega: S.w, torque: S.tq, current: S.i, voltage: S.uAvg, power: S.pElec, pMech: S.pMech,
        eta: S.eta, temp: S.T, stalled: S.stallAct, fault: f.length > 0, faults: f, theta: S.theta,
        bridge: drv.mode, shoot: drv.shoot, duty: drv.duty, iPeak: S.peak, ripple: S.rip, iSupply: S.iSup,
        uSupply: S.uShown, iAvg: Math.abs(S.i), tripped: S.trip, motor: M.id, t: S.t, sw: drv.sw.slice()
      };
    }

    // ---- Kennlinien: aus dem Kern berechnet ----
    // Eckpunkte (Leerlauf, Kurzschluss) liefert ANT_CORE.dcDerived, dazwischen gilt die stationaere Gleichung des Kerns:
    //   Kt*i = M + Mc + B*w ,  w = (u - Ra*i)/Ke   (Ra mit aktueller Wicklungstemperatur)
    function curves() {
      const duty = Cv.mode === 'pwm' ? drv.duty : 1;
      const mp = Object.assign({}, mot.params, { Ra: S.ra });
      const uFull = C0.pwmAverage(1, drv.U, DROP_SW);
      let uAvg;
      if (Cv.mode === 'manuell') uAvg = (drv.mode === 'vor' || drv.mode === 'rueck') ? Math.abs(drv.uAvg) : 0;
      else uAvg = Math.abs(C0.pwmAverage(duty, drv.U, DROP_SW));
      const mk = (u, N) => {
        const pn = [], pi = [], pe = [];
        const d = C0.dcDerived(mp, u);
        const mEnd = Math.max(1e-6, (d.mStall - mp.Mc) * 0.99);          // Wellenmoment kurz vor dem Stillstand
        for (let k = 0; k <= N; k++) {
          const Msh = (k / N) * mEnd;
          const i = (Msh + mp.Mc + mp.B * u / mp.Ke) / (mp.Ke + mp.B * mp.Ra / mp.Ke);
          const w = Math.max(0, (u - mp.Ra * i) / mp.Ke);
          const iAvg = Math.max(0, (Msh + mp.Mc + mp.B * w) / mp.Ke);
          const pel = duty * drv.U * iAvg;
          pn.push([Msh, w * 60 / TWO_PI]); pi.push([Msh, iAvg]); pe.push([Msh, pel > 0.05 ? clamp(Msh * w / pel * 100, 0, 100) : 0]);
        }
        return { pn, pi, pe };
      };
      const cur = mk(Math.max(uAvg, 0.0001), 40), full = mk(uFull, 40);
      const rpm = Math.abs(S.w) * 60 / TWO_PI;
      return [
        { id: 'nM', title: 'Drehzahl über Moment (n–M)', xLabel: 'Wellenmoment', xUnit: 'Nm', yLabel: 'Drehzahl', yUnit: '1/min',
          series: [{ name: 'aktueller Tastgrad', points: cur.pn }, { name: '100 % (volle Spannung)', points: full.pn }], marker: { x: S.tq, y: rpm } },
        { id: 'IM', title: 'Strom über Moment (I–M)', xLabel: 'Wellenmoment', xUnit: 'Nm', yLabel: 'Motorstrom', yUnit: 'A',
          series: [{ name: 'aktueller Tastgrad', points: cur.pi }, { name: '100 % (volle Spannung)', points: full.pi }], marker: { x: S.tq, y: Math.abs(S.i) } },
        { id: 'etaM', title: 'Wirkungsgrad über Moment (η–M)', xLabel: 'Wellenmoment', xUnit: 'Nm', yLabel: 'Wirkungsgrad', yUnit: '%',
          series: [{ name: 'aktueller Tastgrad', points: cur.pe }, { name: '100 % (volle Spannung)', points: full.pe }], marker: { x: S.tq, y: S.eta } }
      ];
    }

    // ================= Zeichnen =================
    function visAdvance(t) {
      const dtv = V.last == null ? 0 : clamp(t - V.last, 0, 100); V.last = t;
      const n = Math.abs(S.w) * 60 / TWO_PI;
      const sg = Math.sign(S.w);
      const speed = n <= 240 ? S.w : sg * (240 + (n - 240) * 0.05) * TWO_PI / 60;
      V.vis += speed * dtv / 1000;
      V.blur = clamp((n - 200) / 900, 0, 1);
      V.dir = sg;
    }

    function drawSwitch(ctx, key, closed, t, col, partial) {
      const p = SWPOS[key], x = p[0], y = p[1], left = x < 200;
      // Zuleitungen
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = '#7d8996'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y - 51); ctx.lineTo(x, y - 20); ctx.moveTo(x, y + 20); ctx.lineTo(x, y + 51); ctx.stroke();
      // Antiparalleldiode (Leitrichtung nach oben)
      const dx = left ? 30 : -30;
      ctx.strokeStyle = '#5c6874'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y - 38); ctx.lineTo(x + dx, y - 38); ctx.lineTo(x + dx, y - 12); ctx.moveTo(x + dx, y + 12); ctx.lineTo(x + dx, y + 38); ctx.lineTo(x, y + 38); ctx.stroke();
      ctx.fillStyle = '#5c6874';
      ctx.beginPath(); ctx.moveTo(x + dx - 7, y + 10); ctx.lineTo(x + dx + 7, y + 10); ctx.lineTo(x + dx, y - 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + dx - 8, y - 8); ctx.lineTo(x + dx + 8, y - 8); ctx.stroke();
      // Kontakte
      const on = closed;
      const cc = on ? rgba(col, 1) : '#9aa6b2';
      ctx.fillStyle = '#0f1317'; ctx.strokeStyle = cc; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y - 20, 4.5, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y + 20, 4.5, 0, TWO_PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = cc; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x, y + 20);
      if (on) ctx.lineTo(x, y - 20); else ctx.lineTo(x + (left ? 17 : -17), y - 15);
      ctx.stroke();
      if (partial) { ctx.globalAlpha = 0.45; ctx.strokeStyle = rgba(col, 1); ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.lineTo(x, y - 20); ctx.stroke(); ctx.globalAlpha = 1; }
      // Beschriftung (antippbar)
      const bx = left ? x - 66 : x + 28, by = y - 17;
      ctx.fillStyle = on ? rgba(col, 0.22) : '#2a323b';
      rr(ctx, bx, by, 38, 34, 8); ctx.fill();
      ctx.strokeStyle = on ? rgba(col, 0.95) : '#4a5560'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, key, bx + 19, by + 17, 17, on ? '#ffffff' : C.dim, 'center', true);
    }

    function drawPath(ctx, pts, color, t, speed, width, dashed) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(color, 0.25); ctx.lineWidth = width + 7;
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      ctx.strokeStyle = rgba(color, 0.95); ctx.lineWidth = width;
      if (dashed && ctx.setLineDash) ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.stroke();
      if (ctx.setLineDash) ctx.setLineDash([]);
      const L = polyLen(pts); if (L < 1) return;
      const sp = 26, off = ((t / 1000) * speed) % sp;
      ctx.fillStyle = '#ffffff';
      for (let d = off; d < L; d += sp) { const q = polyAt(pts, d); ctx.beginPath(); ctx.arc(q[0], q[1], 3.6, 0, TWO_PI); ctx.fill(); }
    }

    function bridgePaths(vphase) {
      const L = SCH.lx, Rr = SCH.rx, tp = SCH.top, bt = SCH.bot, md = SCH.mid;
      const feed = [[60, 125], [60, tp], [L, tp]];
      const motor = [[SCH.mL, md], [SCH.mR, md]];
      const out = [];
      const sgn = S.i >= 0 ? 1 : -1;
      const flipIf = (pts) => sgn > 0 ? pts : pts.slice().reverse();
      const m = drv.mode;
      if (m === 'vor') {
        if (vphase) out.push({ pts: feed.concat([[L, md]], motor, [[Rr, md], [Rr, bt]]), col: COL.vor, dir: 1 });
        else if (Math.abs(S.i) > 0.05) out.push({ pts: [[SCH.mL, md], [SCH.mR, md], [Rr, md], [Rr, tp], [L, tp], [L, md]], col: COL.frei, dir: 1, dashed: true });
      } else if (m === 'rueck') {
        if (vphase) out.push({ pts: feed.concat([[Rr, tp], [Rr, md]], [[SCH.mR, md], [SCH.mL, md]], [[L, md], [L, bt]]), col: COL.rueck, dir: 1 });
        else if (Math.abs(S.i) > 0.05) out.push({ pts: flipIf([[SCH.mL, md], [SCH.mR, md], [Rr, md], [Rr, tp], [L, tp], [L, md]]), col: COL.frei, dir: 1, dashed: true });
      } else if (m === 'bremse') {
        const low = drv.sw[1] || drv.brake || !drv.sw[0];
        const loop = low ? [[SCH.mL, md], [SCH.mR, md], [Rr, md], [Rr, bt], [L, bt], [L, md], [SCH.mL, md]] : [[SCH.mL, md], [SCH.mR, md], [Rr, md], [Rr, tp], [L, tp], [L, md], [SCH.mL, md]];
        if (Math.abs(S.i) > 0.05) out.push({ pts: flipIf(loop), col: COL.bremse, dir: 1 });
      } else if (m === 'frei' && Math.abs(S.i) > 0.05) {
        out.push({ pts: flipIf([[SCH.mL, md], [SCH.mR, md], [Rr, md], [Rr, tp], [L, tp], [L, md]]), col: COL.frei, dir: 1, dashed: true });
      }
      return out;
    }

    function drawSchematic(ctx, t) {
      const L = SCH.lx, Rr = SCH.rx, tp = SCH.top, bt = SCH.bot, md = SCH.mid;
      // Tafel
      ctx.fillStyle = C.panel; rr(ctx, 14, 140, 332, 285, 12); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'H-BRÜCKE', 112, 157, 13, C.dim, 'left', true);
      // Zustandsschild
      const names = { vor: 'VOR', rueck: 'ZURÜCK', bremse: 'BREMSEN', frei: 'FREILAUF', kurzschluss: 'KURZSCHLUSS' };
      const col = COL[drv.mode];
      const blinkOn = drv.mode !== 'kurzschluss' || Math.floor(t / 140) % 2 === 0;
      ctx.fillStyle = rgba(col, blinkOn ? 0.28 : 0.1); rr(ctx, 196, 144, 140, 25, 12); ctx.fill();
      ctx.strokeStyle = rgba(col, blinkOn ? 1 : 0.4); ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, names[drv.mode], 266, 157, 14, blinkOn ? '#ffffff' : C.dim, 'center', true);
      // Grundleitungen (grau)
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#7d8996'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(60, 125); ctx.lineTo(60, tp); ctx.lineTo(Rr, tp);
      ctx.moveTo(L, tp); ctx.lineTo(L, tp + 0);
      ctx.moveTo(L, md); ctx.lineTo(SCH.mL, md); ctx.moveTo(SCH.mR, md); ctx.lineTo(Rr, md);
      ctx.moveTo(L, bt); ctx.lineTo(Rr, bt);
      ctx.stroke();
      ctx.fillStyle = '#7d8996';
      [[L, tp], [Rr, tp], [L, md], [Rr, md], [L, bt], [Rr, bt]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 4.5, 0, TWO_PI); ctx.fill(); });
      // Masse
      ctx.strokeStyle = '#7d8996'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(185, bt); ctx.lineTo(185, bt + 8); ctx.moveTo(172, bt + 8); ctx.lineTo(198, bt + 8); ctx.moveTo(177, bt + 13); ctx.lineTo(193, bt + 13); ctx.moveTo(182, bt + 18); ctx.lineTo(188, bt + 18); ctx.stroke();
      txt(ctx, '+U', 38, 190, 14, C.warn, 'center', true);
      txt(ctx, '0 V', 235, bt + 15, 12, C.dim, 'left');
      // Motor-Symbol
      const mc = [185, md];
      ctx.fillStyle = '#1a2026'; ctx.strokeStyle = '#c9d1d9'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(mc[0], mc[1], 29, 0, TWO_PI); ctx.fill(); ctx.stroke();
      txt(ctx, 'M', mc[0], mc[1] - 2, 24, C.text, 'center', true);
      txt(ctx, '+', SCH.mL - 3, md - 16, 11, C.dim, 'center', true);
      // Stromwege
      const pwm = Cv.mode === 'pwm' && !drv.brake;
      const phase = fr(t / 330);
      const vphase = pwm && drv.duty < 1 ? phase < drv.duty : true;
      const spd = 50 + Math.min(Math.abs(S.i), 12) * 14;
      const paths = bridgePaths(vphase);
      if (drv.shoot) {
        const left = drv.sw[0] && drv.sw[1];
        const x = left ? L : Rr;
        const bl = Math.floor(t / 110) % 2 === 0;
        const pts = [[60, 125], [60, tp], [L, tp]];
        const pp = left ? pts.concat([[L, bt]]) : [[60, 125], [60, tp], [Rr, tp], [Rr, bt]];
        drawPath(ctx, pp, bl ? COL.kurzschluss : [160, 50, 50], t, 200, 4, false);
      } else paths.forEach(p => drawPath(ctx, p.pts, p.col, t, spd, 4, p.dashed));
      // Schalter
      ['S1', 'S2', 'S3', 'S4'].forEach((k, ix) => {
        let on = drv.sw[ix];
        let partial = false;
        if (pwm && drv.duty > 0 && drv.duty < 1) {
          const isChop = (drv.sgn > 0 && k === 'S4') || (drv.sgn < 0 && k === 'S2');
          if (isChop) { on = phase < drv.duty; partial = false; }
        }
        let c = drv.shoot && on && ((ix < 2 && drv.sw[0] && drv.sw[1]) || (ix >= 2 && drv.sw[2] && drv.sw[3])) ? COL.kurzschluss : COL[drv.mode === 'frei' ? 'vor' : drv.mode] || COL.vor;
        if (drv.mode === 'kurzschluss') c = COL.kurzschluss;
        drawSwitch(ctx, k, on, t, c, partial);
      });
      // Funken
      if (drv.shoot) {
        const left = drv.sw[0] && drv.sw[1]; const x = left ? L : Rr;
        for (let k = 0; k < 14; k++) {
          const ph = fr(t / 380 + rnd(k) * 3), ang = rnd(k + 20) * TWO_PI, d = 8 + ph * 44;
          const px = x + Math.cos(ang) * d, py = md + Math.sin(ang) * d * 1.2;
          ctx.strokeStyle = 'rgba(255,' + (200 - ph * 120 | 0) + ',60,' + (1 - ph) + ')'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang) * 8, py + Math.sin(ang) * 8); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,230,120,' + (0.35 + 0.3 * Math.sin(t / 25)) + ')';
        ctx.beginPath(); ctx.arc(x, md, 16 + 5 * Math.sin(t / 30), 0, TWO_PI); ctx.fill();
      }
    }

    function drawPSU(ctx, t) {
      ctx.fillStyle = C.panel; rr(ctx, 14, 14, 332, 118, 12); ctx.fill();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'NETZTEIL', 28, 31, 13, C.dim, 'left', true);
      // LED
      const cc = drv.shoot ? C.bad : S.iSup > 0.8 * I_LIMIT ? C.warn : C.ok;
      ctx.fillStyle = drv.shoot && Math.floor(t / 120) % 2 ? '#5a1d1d' : cc; ctx.beginPath(); ctx.arc(320, 31, 6, 0, TWO_PI); ctx.fill();
      // Anzeigen
      const lcd = (x, y, w, h, val, unit, color) => {
        ctx.fillStyle = '#0c1014'; rr(ctx, x, y, w, h, 7); ctx.fill(); ctx.strokeStyle = '#37414c'; ctx.lineWidth = 1.5; ctx.stroke();
        txt(ctx, val, x + w - 38, y + h / 2 + 1, 30, color, 'right', true, MONO);
        txt(ctx, unit, x + w - 12, y + h / 2 + 5, 17, C.dim, 'right', true);
      };
      const uC = drv.shoot ? C.bad : '#7ee0ff';
      lcd(26, 44, 150, 50, f1(S.uShown, 1), 'V', uC);
      lcd(186, 44, 150, 50, f1(S.iSup, 2), 'A', drv.shoot ? C.bad : C.warn);
      if (drv.shoot) {
        const bl = Math.floor(t / 150) % 2 === 0;
        txt(ctx, 'Strombegrenzung! Spannung bricht zusammen', 180, 112, 13, bl ? C.bad : '#a04040', 'center', true);
      } else {
        txt(ctx, 'Einstellung ' + f1(drv.U, 1) + ' V   ·   max. ' + I_LIMIT + ' A   ·   P = ' + f1(S.pElec, 1) + ' W', 180, 112, 13, C.dim, 'center');
      }
      // Anschlussklemmen
      ctx.fillStyle = '#d33'; ctx.beginPath(); ctx.arc(60, 128, 6, 0, TWO_PI); ctx.fill();
      ctx.fillStyle = '#222'; ctx.strokeStyle = '#9aa'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(110, 128, 5, 0, TWO_PI); ctx.fill(); ctx.stroke();
    }

    function drawScope(ctx, t) {
      const x0 = 14, y0 = 436, w = 332, h = 114;
      ctx.fillStyle = C.panel; rr(ctx, x0, y0, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'PWM-SIGNAL  U(t)', x0 + 14, y0 + 16, 12, C.dim, 'left', true);
      const px = x0 + 14, pw = w - 28, py = y0 + 30, ph = 54, base = py + ph;
      ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, py - 6, pw + 8, ph + 12, 6); ctx.fill();
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
      for (let k = 0; k <= 4; k++) { const gx = px + pw * k / 4; ctx.beginPath(); ctx.moveTo(gx, py - 6); ctx.lineTo(gx, base + 6); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(px - 4, base); ctx.lineTo(px + pw + 4, base); ctx.moveTo(px - 4, py); ctx.lineTo(px + pw + 4, py); ctx.stroke();
      const dm = drv.mode;
      const c = dm === 'rueck' ? COL.rueck : COL.vor;
      const pwmOn = Cv.mode === 'pwm' && (dm === 'vor' || dm === 'rueck');
      const f = Cv.freq, N = 160;
      const off = (t / 1000) * 0.5;
      ctx.strokeStyle = rgba(c, 1); ctx.lineWidth = 2; ctx.beginPath();
      let lastY = null;
      for (let k = 0; k <= N; k++) {
        const x = px + pw * k / N, tm = 2 * k / N;     // 2 ms Fenster
        let lvl = 0;
        if (pwmOn) lvl = fr(tm * f / 1000 + off) < drv.duty ? 1 : 0;
        else if (dm === 'vor' || dm === 'rueck') lvl = 1;
        else if (dm === 'bremse') lvl = 0;
        const y = base - lvl * (ph - 4);
        if (k === 0) ctx.moveTo(x, y); else { if (lastY !== y) ctx.lineTo(x, lastY); ctx.lineTo(x, y); }
        lastY = y;
      }
      ctx.stroke();
      // Stromrippel
      if (pwmOn && S.rip > 0) {
        const iAv = Math.abs(S.i), iScale = Math.max(0.4, S.peak * 1.35);
        ctx.strokeStyle = rgba(COL.bremse, 0.95); ctx.lineWidth = 1.6; ctx.beginPath();
        for (let k = 0; k <= N; k++) {
          const x = px + pw * k / N, tm = 2 * k / N, ph2 = fr(tm * f / 1000 + off);
          const tri = ph2 < drv.duty ? -0.5 + ph2 / Math.max(drv.duty, 1e-6) : 0.5 - (ph2 - drv.duty) / Math.max(1 - drv.duty, 1e-6);
          const val = iAv + tri * 2 * (S.peak - iAv);
          const y = base - clamp(val / iScale, 0, 1) * (ph - 4);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      const tt = pwmOn ? 'f = ' + f / 1000 + ' kHz   T = ' + f1(1000000 / f, 0) + ' µs   Tastgrad ' + Math.round(drv.duty * 100) + ' %' : (Cv.mode === 'pwm' ? 'PWM aus (Tastgrad 0 %)' : 'manuell: Gleichspannung, kein PWM');
      txt(ctx, tt, x0 + 14, y0 + h - 14, 12.5, C.text, 'left', true);
      txt(ctx, '0,5 ms/Raster', x0 + w - 14, y0 + 16, 11, C.dim, 'right');
      if (pwmOn) txt(ctx, 'U̅ = ' + f1(Math.abs(S.uAvg), 1) + ' V', x0 + w - 14, y0 + h - 14, 12.5, rgba(c, 1), 'right', true);
      if (pwmOn && S.rip > 0) { ctx.fillStyle = rgba(COL.bremse, 1); txt(ctx, 'Strom, ΔI ≈ ' + f1(2 * (S.peak - Math.abs(S.i)), 2) + ' A', x0 + 150, y0 + 16, 11, rgba(COL.bremse, 1), 'left'); }
    }

    function drawSection(ctx, cx, cy, Rr, t) {
      const ang = V.vis, heat = clamp((S.T - 60) / 75, 0, 1), blur = V.blur, dirS = V.dir || 1;
      const hot = mix([196, 120, 60], [255, 70, 30], heat);
      const glow = clamp(Math.abs(S.i) / (M.iNom * 3), 0, 1) * 0.5 + heat * 0.6;
      // Staendergehaeuse
      const g = ctx.createRadialGradient(cx, cy, Rr - 18, cx, cy, Rr);
      g.addColorStop(0, '#3f4a55'); g.addColorStop(1, '#6b7782');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, Rr, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#10151a'; ctx.beginPath(); ctx.arc(cx, cy, Rr - 15, 0, TWO_PI); ctx.fill();
      if (heat > 0.05) { ctx.fillStyle = rgba([255, 80, 30], heat * 0.18); ctx.beginPath(); ctx.arc(cx, cy, Rr - 15, 0, TWO_PI); ctx.fill(); }
      // Magnete (links N, rechts S)
      sector(ctx, cx, cy, Rr - 46, Rr - 15, Math.PI - 0.85, Math.PI + 0.85); ctx.fillStyle = '#c64a47'; ctx.fill();
      sector(ctx, cx, cy, Rr - 46, Rr - 15, -0.85, 0.85); ctx.fillStyle = '#3aa157'; ctx.fill();
      txt(ctx, 'N', cx - Rr + 31, cy, 22, '#fff', 'center', true);
      txt(ctx, 'S', cx + Rr - 31, cy, 22, '#fff', 'center', true);
      // Rotor (mit Geisterbildern bei hoher Drehzahl)
      const drawRotor = (a, al) => {
        ctx.globalAlpha = al;
        ctx.fillStyle = '#8e99a6'; ctx.beginPath(); ctx.arc(cx, cy, 56, 0, TWO_PI); ctx.fill();
        for (let k = 0; k < 3; k++) {
          const a0 = a + k * TWO_PI / 3 + Math.PI / 3 - 0.5, a1 = a0 + 1.0;
          sector(ctx, cx, cy, 24, 52, a0, a1);
          ctx.fillStyle = rgba(mix([205, 120, 55], hot, heat), 1); ctx.fill();
          ctx.strokeStyle = rgba([255, 200, 120], 0.25 + glow * 0.6); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(cx, cy, 40, a0 + 0.08, a1 - 0.08); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      };
      if (blur > 0.02) {
        for (let k = 4; k >= 1; k--) drawRotor(ang - dirS * k * 0.17 * blur, 0.16);
        drawRotor(ang, 0.55 - 0.3 * blur);
      } else drawRotor(ang, 1);
      // Kommutator
      ctx.fillStyle = '#d6b27a'; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#3a2e1c'; ctx.lineWidth = 2.5;
      for (let k = 0; k < 3; k++) { const a = ang + k * TWO_PI / 3 + Math.PI / 3; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11); ctx.lineTo(cx + Math.cos(a) * 25, cy + Math.sin(a) * 25); ctx.stroke(); }
      // Welle und Markierung
      ctx.fillStyle = '#c9d1d9'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 1.5; ctx.stroke();
      const nT = blur > 0.02 ? 6 : 1;
      for (let k = nT - 1; k >= 0; k--) {
        const a = ang - dirS * k * 0.2 * blur, al = nT === 1 ? 1 : (k === 0 ? 0.95 : 0.55 * (1 - k / nT));
        ctx.globalAlpha = al; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3); ctx.lineTo(cx + Math.cos(a) * 60, cy + Math.sin(a) * 60); ctx.stroke();
        ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 49, cy + Math.sin(a) * 49, 5, 0, TWO_PI); ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Buersten oben und unten
      const bc = drv.mode === 'kurzschluss' ? COL.kurzschluss : (drv.mode === 'vor' || drv.mode === 'rueck') ? COL[drv.mode] : drv.mode === 'bremse' ? COL.bremse : [90, 100, 110];
      const live = Math.abs(S.i) > 0.05 || drv.mode === 'vor' || drv.mode === 'rueck';
      [-1, 1].forEach(sg => {
        const by = cy + sg * 30;
        ctx.strokeStyle = live ? rgba(bc, 0.95) : '#666f78'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, cy + sg * (Rr - 15)); ctx.lineTo(cx, cy + sg * (Rr + 9)); ctx.stroke();
        ctx.fillStyle = '#26211c'; rr(ctx, cx - 8, by - (sg > 0 ? 0 : 17), 16, 17, 3); ctx.fill();
        ctx.strokeStyle = '#7d8996'; ctx.lineWidth = 2; ctx.beginPath();
        for (let k = 0; k < 4; k++) { const yy = cy + sg * (48 + k * 6); ctx.moveTo(cx - 6, yy); ctx.lineTo(cx + 6, yy + 3); ctx.lineTo(cx - 6, yy + 6 * 0); }
        ctx.stroke();
        ctx.fillStyle = live ? rgba(bc, 1) : '#555'; ctx.beginPath(); ctx.arc(cx, cy + sg * (Rr + 11), 5, 0, TWO_PI); ctx.fill();
      });
      txt(ctx, '+', cx + 16, cy - Rr - 4, 13, C.dim, 'left', true);
      // Drehrichtungspfeil
      if (Math.abs(S.w) > 0.5 || drv.mode === 'vor' || drv.mode === 'rueck') {
        const ds = (Math.abs(S.w) > 0.5 ? Math.sign(S.w) : drv.sgn) || 1;
        const col = ds > 0 ? COL.vor : COL.rueck, r2 = Rr + 17;
        const a0 = Math.PI * 1.12, a1 = Math.PI * 1.88;
        ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, r2, a0, a1); ctx.stroke();
        const ae = ds > 0 ? a1 : a0, tdir = ds > 0 ? 1 : -1;
        const ex = cx + Math.cos(ae) * r2, ey = cy + Math.sin(ae) * r2;
        const tx = -Math.sin(ae) * tdir, ty = Math.cos(ae) * tdir, nx = Math.cos(ae), ny = Math.sin(ae);
        ctx.fillStyle = rgba(col, 1); ctx.beginPath();
        ctx.moveTo(ex + tx * 14, ey + ty * 14); ctx.lineTo(ex + nx * 9, ey + ny * 9); ctx.lineTo(ex - nx * 9, ey - ny * 9); ctx.closePath(); ctx.fill();
      }
    }

    function drawHousing(ctx, t) {
      const hx = HOUSING.x, hy = HOUSING.y, hw = HOUSING.w, hh = HOUSING.h, cy = hy + hh / 2;
      const heat = clamp((S.T - 60) / 75, 0, 1);
      // Welle
      const sx0 = hx + hw, sx1 = DISC.x;
      const gs = ctx.createLinearGradient(0, cy - 10, 0, cy + 10);
      gs.addColorStop(0, '#d9dee3'); gs.addColorStop(0.5, '#8e99a6'); gs.addColorStop(1, '#4a545e');
      ctx.fillStyle = gs; ctx.fillRect(sx0, cy - 10, sx1 - sx0, 20);
      const blur = V.blur;
      for (let k = 0; k < 4; k++) {
        const ph = V.vis + k * Math.PI / 2, yy = cy + 10 * Math.sin(ph), vis = Math.cos(ph) > -0.1;
        if (!vis) continue;
        ctx.strokeStyle = k === 0 ? 'rgba(255,255,255,' + (0.95 - 0.7 * blur) + ')' : 'rgba(30,38,46,' + (0.6 - 0.45 * blur) + ')';
        ctx.lineWidth = k === 0 ? 3.5 : 2; ctx.beginPath(); ctx.moveTo(sx0 + 12, yy); ctx.lineTo(sx1 - 56, yy); ctx.stroke();
      }
      // Lager
      ctx.fillStyle = '#39434d'; rr(ctx, sx0 - 2, cy - 17, 14, 34, 4); ctx.fill();
      // Gehaeuse
      const gg = ctx.createLinearGradient(0, hy, 0, hy + hh);
      gg.addColorStop(0, '#9aa5b0'); gg.addColorStop(0.18, '#7c8894'); gg.addColorStop(0.55, '#4f5964'); gg.addColorStop(1, '#2b333b');
      ctx.fillStyle = gg; rr(ctx, hx, hy, hw, hh, 14); ctx.fill();
      ctx.strokeStyle = '#1b2127'; ctx.lineWidth = 2.5; ctx.stroke();
      if (heat > 0.05) { ctx.fillStyle = rgba([255, 70, 30], heat * 0.5); rr(ctx, hx, hy, hw, hh, 14); ctx.fill(); }
      // Kuehlschlitze
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
      for (let k = 0; k < 6; k++) { const xx = hx + 38 + k * 14; ctx.beginPath(); ctx.moveTo(xx, hy + 14); ctx.lineTo(xx, hy + 36); ctx.stroke(); }
      // Typenschild
      ctx.fillStyle = '#d7dde3'; rr(ctx, hx + 30, hy + 54, 100, 36, 4); ctx.fill();
      txt(ctx, M.name.replace('Getriebemotor', 'Getr.-Motor'), hx + 80, hy + 66, 11, '#1b2127', 'center', true);
      txt(ctx, 'n0 ' + Math.round(M.uNom / M.Ke * 60 / TWO_PI / 10) * 10 + '/min · I ' + f1(M.iNom, 1) + ' A', hx + 80, hy + 80, 10, '#33404c', 'center');
      // Lagerschild mit Buerstenkappen
      ctx.fillStyle = '#3b444d'; rr(ctx, hx - 20, hy + 8, 24, hh - 16, 6); ctx.fill();
      ctx.strokeStyle = '#1b2127'; ctx.lineWidth = 2; ctx.stroke();
      [hy + 22, hy + hh - 22].forEach(yy => { ctx.fillStyle = '#b8864b'; ctx.beginPath(); ctx.arc(hx - 8, yy, 8, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#6b4a22'; ctx.lineWidth = 2; ctx.stroke(); });
      // Anschlusskabel (Farbe folgt dem Stromweg)
      const live = Math.abs(S.i) > 0.05;
      const cc = live ? (drv.mode === 'bremse' ? COL.bremse : drv.mode === 'kurzschluss' ? COL.kurzschluss : (S.i >= 0 ? COL.vor : COL.rueck)) : [110, 118, 126];
      ctx.strokeStyle = rgba(cc, live ? 0.95 : 1); ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx - 8, hy + 14); ctx.bezierCurveTo(hx - 8, hy - 30, hx + 60, hy - 30, hx + 60, hy + 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hx - 8, hy + hh - 14); ctx.bezierCurveTo(hx - 8, hy + hh + 30, hx + 60, hy + hh + 30, hx + 60, hy + hh - 4); ctx.stroke();
      // Schriftzug
      txt(ctx, 'Gleichstrommotor', hx + hw / 2, hy + hh + 14, 12, C.dim, 'center', true);
    }

    function drawLoad(ctx, t) {
      const cx = DISC.x, cy = DISC.y, r = DISC.r;
      const lf = clamp(Cv.load / M.Mmax, 0, 1);
      const ang = V.vis, blur = V.blur, dirS = V.dir || 1;
      if (Cv.loadType === 'luefter') {
        ctx.fillStyle = 'rgba(80,92,104,0.25)'; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, TWO_PI); ctx.fill();
        ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, r + 6, 0, TWO_PI); ctx.stroke();
        const blade = (a, al) => {
          ctx.globalAlpha = al;
          for (let k = 0; k < 5; k++) {
            const a0 = a + k * TWO_PI / 5;
            ctx.fillStyle = '#9fb4c8'; ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a0) * 8, cy + Math.sin(a0) * 8);
            ctx.quadraticCurveTo(cx + Math.cos(a0 - 0.55) * (r * 0.75), cy + Math.sin(a0 - 0.55) * (r * 0.75), cx + Math.cos(a0 - 0.15) * (r - 3), cy + Math.sin(a0 - 0.15) * (r - 3));
            ctx.quadraticCurveTo(cx + Math.cos(a0 + 0.5) * (r * 0.6), cy + Math.sin(a0 + 0.5) * (r * 0.6), cx + Math.cos(a0 + 0.1) * 8, cy + Math.sin(a0 + 0.1) * 8);
            ctx.closePath(); ctx.fill();
          }
          ctx.globalAlpha = 1;
        };
        if (blur > 0.02) { for (let k = 5; k >= 1; k--) blade(ang - dirS * k * 0.13 * blur, 0.14); blade(ang, 0.5 - 0.25 * blur); ctx.fillStyle = 'rgba(170,200,230,' + 0.1 * blur + ')'; ctx.beginPath(); ctx.arc(cx, cy, r - 2, 0, TWO_PI); ctx.fill(); }
        else blade(ang, 1);
        ctx.fillStyle = '#39434d'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, TWO_PI); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10); ctx.stroke();
        txt(ctx, 'Lüfter', cx, cy + r + 24, 13, C.dim, 'center', true);
        txt(ctx, 'M = ' + f1(S.tq, 2) + ' Nm', cx, cy + r + 42, 13, C.text, 'center', true);
        return;
      }
      // Bremsscheibe
      const heatB = clamp(S.pMech / 40, 0, 1);
      const disc = (a, al) => {
        ctx.globalAlpha = al;
        const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, r);
        g.addColorStop(0, '#aeb8c2'); g.addColorStop(1, rgba(mix([112, 124, 136], [255, 120, 40], heatB), 1));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.fill();
        ctx.fillStyle = '#1b2127';
        for (let k = 0; k < 8; k++) { const a0 = a + k * TWO_PI / 8; ctx.beginPath(); ctx.arc(cx + Math.cos(a0) * 36, cy + Math.sin(a0) * 36, 6.5, 0, TWO_PI); ctx.fill(); }
        ctx.globalAlpha = 1;
      };
      if (blur > 0.02) { for (let k = 3; k >= 1; k--) disc(ang - dirS * k * 0.12 * blur, 0.12); disc(ang, 0.7 - 0.2 * blur); }
      else disc(ang, 1);
      ctx.strokeStyle = '#2a323b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.stroke();
      ctx.fillStyle = '#39434d'; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TWO_PI); ctx.fill();
      const nT = blur > 0.02 ? 5 : 1;
      for (let k = nT - 1; k >= 0; k--) { const a = ang - dirS * k * 0.14 * blur; ctx.globalAlpha = nT === 1 ? 1 : 0.9 - k * 0.17; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14); ctx.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4)); ctx.stroke(); }
      ctx.globalAlpha = 1;
      // Bremssattel oben, Belaege pressen mit Lastmoment
      const gap = 12 - 10 * lf;
      const padc = rgba(mix([180, 140, 90], [255, 140, 40], heatB), 1);
      ctx.fillStyle = '#c0392b'; rr(ctx, cx - 28, cy - r - 24, 56, 18, 5); ctx.fill();
      ctx.fillStyle = padc; rr(ctx, cx - 18, cy - r + 2 - gap + 2, 36, 5, 2); ctx.fill();
      ctx.fillStyle = padc; rr(ctx, cx - 18, cy - r - 3, 36, 6, 2); ctx.fill();
      ctx.strokeStyle = '#7a2a22'; ctx.lineWidth = 2; ctx.strokeRect(cx - 28, cy - r - 24, 56, 18);
      if (heatB > 0.3 && Math.abs(S.w) > 1) {
        for (let k = 0; k < 5; k++) { const ph = fr(t / 300 + rnd(k) * 2); ctx.fillStyle = 'rgba(255,' + (190 - 80 * ph | 0) + ',70,' + (1 - ph) * heatB + ')'; ctx.fillRect(cx + (rnd(k + 3) - 0.5) * 30 + ph * 20 * dirS, cy - r + 4 + ph * 14, 3, 3); }
      }
      txt(ctx, 'Bremse', cx, cy + r + 24, 13, C.dim, 'center', true);
      txt(ctx, 'M = ' + f1(S.tq, 2) + ' Nm', cx, cy + r + 42, 13, C.text, 'center', true);
    }

    function drawSmoke(ctx, t) {
      if (!(S.T > T_MAX - 12 || S.trip)) return;
      const k0 = clamp((S.T - (T_MAX - 12)) / 25, 0.2, 1);
      for (let k = 0; k < 9; k++) {
        const age = fr(t / 2400 + k / 9), x = HOUSING.x + 55 + Math.sin(k * 5 + age * 5) * 22 + age * 20, y = HOUSING.y - 6 - age * 120;
        ctx.fillStyle = 'rgba(' + (120 - 50 * age | 0) + ',' + (120 - 50 * age | 0) + ',' + (126 - 50 * age | 0) + ',' + (1 - age) * 0.42 * k0 + ')';
        ctx.beginPath(); ctx.arc(x, y, 8 + age * 26, 0, TWO_PI); ctx.fill();
      }
    }

    function drawTemp(ctx, t) {
      const x = 395, y = 404, w = 360, h = 18;
      txt(ctx, 'Wicklungstemperatur', x, y - 12, 12, C.dim, 'left', true);
      ctx.fillStyle = '#0c1014'; rr(ctx, x, y, w, h, 9); ctx.fill(); ctx.strokeStyle = '#37414c'; ctx.lineWidth = 1.5; ctx.stroke();
      const f = clamp((S.T - 20) / 140, 0, 1);
      const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#4cd964'); g.addColorStop(0.6, '#ffb340'); g.addColorStop(1, '#ff5c5c');
      ctx.fillStyle = g; rr(ctx, x + 2, y + 2, Math.max(0, (w - 4) * f), h - 4, 7); ctx.fill();
      const xm = x + (w - 4) * ((T_MAX - 20) / 140) + 2;
      ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xm, y - 5); ctx.lineTo(xm, y + h + 5); ctx.stroke();
      txt(ctx, '130 °C', xm, y - 10, 11, C.bad, 'center');
      const hotC = S.T > T_MAX ? (Math.floor(t / 200) % 2 ? C.bad : C.warn) : S.T > 100 ? C.warn : C.text;
      txt(ctx, f1(S.T, 0) + ' °C', x + w + 12, y + 9, 20, hotC, 'left', true);
    }

    function drawMeterBar(ctx) {
      const items = [
        ['n', f1(Math.abs(S.w) * 60 / TWO_PI, 0), '1/min', C.acc],
        ['I', f1(Math.abs(S.i), 2), 'A', C.warn],
        ['U', f1(Math.abs(S.uAvg), 1), 'V', '#7ee0ff'],
        ['M', f1(S.tq, 2), 'Nm', C.ok],
        ['P mech', f1(S.pMech, 1), 'W', C.text],
        ['η', f1(S.eta, 0), '%', C.text]
      ];
      const x0 = 380, bw = 98, gp = 5;
      items.forEach((it, k) => {
        const x = x0 + k * (bw + gp);
        ctx.fillStyle = C.panel; rr(ctx, x, 14, bw, 66, 10); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
        txt(ctx, it[0], x + 10, 29, 12, C.dim, 'left', true);
        txt(ctx, it[1], x + bw - 10, 52, 24, it[3], 'right', true, MONO);
        txt(ctx, it[2], x + bw - 10, 71, 11, C.dim, 'right');
      });
    }

    function drawHistory(ctx) {
      const x0 = 380, y0 = 436, w = 608, h = 114;
      ctx.fillStyle = C.panel; rr(ctx, x0, y0, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'SCHREIBER  letzte 10 s', x0 + 14, y0 + 16, 12, C.dim, 'left', true);
      txt(ctx, 'Drehzahl', x0 + w - 150, y0 + 16, 12, C.acc, 'right', true);
      txt(ctx, 'Strom', x0 + w - 14, y0 + 16, 12, C.warn, 'right', true);
      const px = x0 + 14, pw = w - 28, py = y0 + 28, ph = h - 40;
      ctx.fillStyle = '#0c1014'; rr(ctx, px - 4, py - 3, pw + 8, ph + 6, 6); ctx.fill();
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
      for (let k = 0; k <= 5; k++) { const gx = px + pw * k / 5; ctx.beginPath(); ctx.moveTo(gx, py - 3); ctx.lineTo(gx, py + ph + 3); ctx.stroke(); }
      const nMax = Math.max(100, M.uNom / M.Ke * 60 / TWO_PI), iMax = Math.max(1, M.uNom / M.Ra);
      const line = (k, max, col) => {
        if (H.length < 2) return;
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath();
        for (let q = 0; q < H.length; q++) {
          const x = px + pw * (1 - (H.length - 1 - q) / 100), v = Math.abs(H[q][k]);
          const y = py + ph - clamp(v / max, 0, 1.02) * ph;
          if (q === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
      };
      line(0, nMax, C.acc); line(1, iMax, C.warn);
    }

    function drawStatusFlash(ctx, t) {
      if (drv.shoot && Math.floor(t / 130) % 2 === 0) { ctx.fillStyle = 'rgba(255,60,60,0.09)'; ctx.fillRect(0, 0, WW, WH); }
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, w, h);
      const sc = Math.min(w / WW, h / WH);
      ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
      visAdvance(t);
      ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
      drawPSU(ctx, t);
      drawSchematic(ctx, t);
      drawScope(ctx, t);
      drawMeterBar(ctx);
      // Drehrichtungstext
      drawSection(ctx, 500, 250, 98, t);
      txt(ctx, 'Schnitt durch Anker und Kommutator', 500, 374, 12, C.dim, 'center');
      drawHousing(ctx, t);
      drawLoad(ctx, t);
      drawSmoke(ctx, t);
      drawTemp(ctx, t);
      drawHistory(ctx);
      drawStatusFlash(ctx, t);
      ctx.restore();
    }

    function hitTest(px, py, w, h) {
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      for (const k of Object.keys(SWPOS)) {
        const p = SWPOS[k], left = p[0] < 200;
        const cx = left ? p[0] - 30 : p[0] + 20;
        if (Math.abs(x - cx) < 52 && Math.abs(y - p[1]) < 42) return { key: k, kind: 'switch' };
      }
      if (x > 850 && x < 995 && y > 170 && y < 330) return { key: 'brake', kind: 'button' };
      return null;
    }

    function reset() {
      ctl.forEach(c => { Cv[c.key] = c.value; });
      applyMotor(MOTORS[0].id);
      resetState();
    }

    resetState();
    const rig = {
      id: 'gleichstrom', controls: ctl, meters: rigMeters, presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 2000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k]));
    return rig;
  }

  R.register({
    id: 'gleichstrom', name: 'Gleichstrommotor mit H-Brücke und PWM', icon: '⚙️',
    info: 'Ein Gleichstrommotor an einer H-Brücke. Mit vier Schaltern oder mit PWM steuerst du Drehrichtung und Drehzahl. Beobachte Anlaufstrom, Stromrippel, Bremsen und Erwärmung.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
