(function (root) {
  'use strict';
  const R = root.SEN_RIGS = root.SEN_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 4: MEMS-Beschleunigungssensor und Neigung (ADXL345-aehnlich, I2C 0x53) =====
  // Eigenes, gekapseltes Modell (bei Bedarf gegen SEN_CORE.sensors.mems / SEN_CORE.i2c austauschbar):
  //   Lage:   ax = sin(tiltX), ay = cos(tiltX)*sin(tiltY), az = cos(tiltX)*cos(tiltY)   (in g, Ruhelage; wie SEN_CORE.sensors.mems)
  //   Zusatz: Schwingung vibAmp*sin(2*pi*vibFreq*t) in z, Stoss = Halbsinus 8 ms in z
  //   Sensor: Tiefpass (filter), Abtastung mit Datenrate (rate), Rauschen, Quantisierung (10 Bit fest oder 13 Bit Vollaufloesung),
  //           Messbereich +-range g (Clipping), Register 0x32..0x37 (little endian, 16 Bit Zweierkomplement), Adresse 0x53
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2, D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const G0 = 9.80665, SUB = 0.5, SHOCK_MS = 8, ADDR = 0x53;
  const GREEN = [76, 217, 100], BLUE = [59, 158, 255], AMB = [255, 179, 64], RED = [255, 92, 92];

  const CONTROLS = [
    { key: 'tiltX', label: 'Neigung X (Nick)', type: 'slider', min: -90, max: 90, step: 1, unit: '°', value: 0, group: 'Lage', help: 'Hebt die x-Achse an. Die Schwerkraft verteilt sich dann auf x und z: ax = sin(Neigung X).' },
    { key: 'tiltY', label: 'Neigung Y (Roll)', type: 'slider', min: -90, max: 90, step: 1, unit: '°', value: 0, group: 'Lage', help: 'Rollt den Sensor um die x-Achse. Die Schwerkraft verteilt sich dann auf y und z: ay = cos(X) · sin(Y).' },
    { key: 'shock', label: 'Stoßstärke', type: 'slider', min: 0, max: 16, step: 0.5, unit: 'g', value: 6, group: 'Stoß und Schwingung', help: 'Spitzenwert des Stoßes (Halbsinus, 8 ms). Ist er größer als der Messbereich, läuft der Sensor ins Clipping.' },
    { key: 'hit', label: 'Stoß auslösen', type: 'button', value: false, group: 'Stoß und Schwingung', help: 'Ein Hammerschlag auf den Sensor. Bei kleiner Datenrate kann der Sensor die Spitze sogar verpassen.' },
    { key: 'vibFreq', label: 'Schwingfrequenz', type: 'slider', min: 0, max: 400, step: 1, unit: 'Hz', value: 0, group: 'Stoß und Schwingung', help: 'Der Sensor sitzt auf einem Rüttler (Schwingung in z-Richtung).' },
    { key: 'vibAmp', label: 'Schwingamplitude', type: 'slider', min: 0, max: 4, step: 0.05, unit: 'g', value: 0, group: 'Stoß und Schwingung', help: 'Spitzenwert der Schwingbeschleunigung.' },
    { key: 'range', label: 'Messbereich', type: 'select', value: 2, group: 'Sensor (I²C 0x53)', options: [{ value: 2, label: '±2 g' }, { value: 4, label: '±4 g' }, { value: 8, label: '±8 g' }, { value: 16, label: '±16 g' }], help: 'Kleiner Bereich = feine Auflösung, aber Clipping bei starken Stößen.' },
    { key: 'res', label: 'Auflösung', type: 'select', value: 10, group: 'Sensor (I²C 0x53)', options: [{ value: 10, label: '10 Bit (fest)' }, { value: 13, label: '13 Bit (Vollauflösung)' }], help: '10 Bit: Auflösung hängt vom Messbereich ab. 13 Bit: immer etwa 3,9 mg pro Digit.' },
    { key: 'rate', label: 'Datenrate', type: 'select', value: 100, group: 'Sensor (I²C 0x53)', options: [{ value: 25, label: '25 Hz' }, { value: 50, label: '50 Hz' }, { value: 100, label: '100 Hz' }, { value: 200, label: '200 Hz' }, { value: 400, label: '400 Hz' }, { value: 800, label: '800 Hz' }], help: 'Wie oft der Sensor einen neuen Wert in die Register schreibt. Schwingungen über der halben Datenrate werden verfälscht (Aliasing).' },
    { key: 'filter', label: 'Tiefpassfilter', type: 'select', value: 0, group: 'Sensor (I²C 0x53)', options: [{ value: 0, label: 'aus' }, { value: 5, label: '5 Hz' }, { value: 20, label: '20 Hz' }, { value: 50, label: '50 Hz' }], help: 'Filtert Rauschen und Schwingungen, macht aber auch Stöße flacher.' }
  ];
  const METERS = [
    { key: 'ax', label: 'Beschleunigung x', unit: 'g', digits: 3, min: -2, max: 2 },
    { key: 'ay', label: 'Beschleunigung y', unit: 'g', digits: 3, min: -2, max: 2 },
    { key: 'az', label: 'Beschleunigung z', unit: 'g', digits: 3, min: -2, max: 2 },
    { key: 'axMs2', label: 'Beschleunigung x', unit: 'm/s²', digits: 2, min: -20, max: 20 },
    { key: 'ayMs2', label: 'Beschleunigung y', unit: 'm/s²', digits: 2, min: -20, max: 20 },
    { key: 'azMs2', label: 'Beschleunigung z', unit: 'm/s²', digits: 2, min: -20, max: 20 },
    { key: 'roll', label: 'Neigung Roll (atan2)', unit: '°', digits: 1, min: -90, max: 90 },
    { key: 'pitch', label: 'Neigung Nick (atan2)', unit: '°', digits: 1, min: -90, max: 90 },
    { key: 'rawX', label: 'Zählwert x', unit: 'Digit', digits: 0, min: -4096, max: 4095 },
    { key: 'rawY', label: 'Zählwert y', unit: 'Digit', digits: 0, min: -4096, max: 4095 },
    { key: 'rawZ', label: 'Zählwert z', unit: 'Digit', digits: 0, min: -4096, max: 4095 },
    { key: 'lsb', label: 'Auflösung', unit: 'mg/Digit', digits: 2, min: 0, max: 32 },
    { key: 'noise', label: 'Rauschen', unit: 'mg', digits: 2, min: 0, max: 20 },
    { key: 'peak', label: 'Spitze seit Stoß', unit: 'g', digits: 2, min: 0, max: 16 }
  ];
  const PRESETS = [
    { id: 'ruhe', name: 'Ruhelage (flach)', params: { tiltX: 0, tiltY: 0, vibFreq: 0, vibAmp: 0, range: 2, res: 10, rate: 100, filter: 0 } },
    { id: 'neigung', name: 'Neigungsmesser 30° / 20°', params: { tiltX: 30, tiltY: 20, vibFreq: 0, vibAmp: 0, range: 2, res: 13, rate: 100, filter: 0 } },
    { id: 'schwing', name: 'Schwingung 50 Hz', params: { tiltX: 0, tiltY: 0, vibFreq: 50, vibAmp: 0.6, range: 2, res: 13, rate: 400, filter: 0 } },
    { id: 'alias', name: 'Aliasing (180 Hz bei 100 Hz Rate)', params: { tiltX: 0, tiltY: 0, vibFreq: 180, vibAmp: 0.6, range: 2, res: 13, rate: 100, filter: 0 } },
    { id: 'stoss', name: 'Stoß übersteuert den Bereich', params: { tiltX: 0, tiltY: 0, vibFreq: 0, vibAmp: 0, shock: 8, range: 2, res: 10, rate: 800, filter: 0 } },
    { id: 'stossok', name: 'Stoß mit ±16 g sauber messen', params: { tiltX: 0, tiltY: 0, vibFreq: 0, vibAmp: 0, shock: 8, range: 16, res: 13, rate: 800, filter: 0 } }
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const gauss = k => (rnd(k * 1.3 + 1) + rnd(k * 2.7 + 5) + rnd(k * 0.7 + 9) - 1.5) * 2;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const sg = (v, d) => (v >= 0 ? '+' : '−') + f1(Math.abs(v), d);
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
  const hx = (v, n) => { let s = (v >>> 0).toString(16).toUpperCase(); while (s.length < n) s = '0' + s; return '0x' + s; };
  function rr(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function txt(ctx, s, x, y, size, color, align, bold, font) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (font || FONT);
    ctx.fillStyle = color || C.text; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(s, x, y);
  }
  function panel(ctx, x, y, w, h, title) {
    ctx.fillStyle = C.panel; rr(ctx, x, y, w, h, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
    if (title) txt(ctx, title, x + 14, y + 16, 12, C.dim, 'left', true);
  }
  const mmul = (A, B) => A.map((r, i) => [0, 1, 2].map(j => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  // Drehmatrix Sensor -> Welt: Spalten = Sensorachsen in Weltkoordinaten (Welt: x rechts, y vor, z oben)
  function rotMat(txd, tyd) {
    const a = tyd * D2R, b = -txd * D2R, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    return mmul([[cb, 0, sb], [0, 1, 0], [-sb, 0, cb]], [[1, 0, 0], [0, ca, -sa], [0, sa, ca]]);
  }
  const gravity = (txd, tyd) => { const tx = txd * D2R, ty = tyd * D2R; return [Math.sin(tx), Math.cos(tx) * Math.sin(ty), Math.cos(tx) * Math.cos(ty)]; };
  const alias = (f, fs) => { if (!(fs > 0)) return 0; let m = f % fs; if (m < 0) m += fs; return m > fs / 2 ? fs - m : m; };
  const lsbOf = (range, res) => res === 13 ? 1 / 256 : 2 * range / 1024;   // 13 Bit Vollaufloesung: 3,9 mg/Digit (1/256 g)
  const limOf = (range, res) => Math.min(4096, Math.round(range / lsbOf(range, res)));
  const quant = (a, range, res) => { const l = lsbOf(range, res), lim = limOf(range, res); return clamp(Math.round(a / l), -lim, lim - 1); };

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    let S, V;

    function resetState() {
      const g = gravity(Cv.tiltX, Cv.tiltY);
      S = { t: 0, acc: 0, sampAcc: 0, k: 0, lp: g.slice(), lp0: g.slice(), raw: [0, 0, 0], a: [0, 0, 0], regs: [0, 0, 0, 0, 0, 0], shockT: -1, shockA: 0, hitAnim: 0, btn: false,
        hist: [], peak: 0, clip: [false, false, false], clipAct: false, aliasAct: false, steepAct: false, tele: 0 };
      doSample(true);
      V = { last: null };
      events.length = 0;
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    const analog = (tSec) => {
      const g = gravity(Cv.tiltX, Cv.tiltY);
      let az = g[2];
      if (Cv.vibAmp > 0 && Cv.vibFreq > 0) az += Cv.vibAmp * Math.sin(TWO_PI * Cv.vibFreq * tSec);
      if (S.shockT >= 0 && S.shockT <= SHOCK_MS) az += S.shockA * Math.sin(Math.PI * S.shockT / SHOCK_MS);
      return [g[0], g[1], az];
    };
    const noiseG = () => { const bw = Math.min(Cv.rate / 2, Cv.filter > 0 ? Cv.filter * 1.57 : 1e9); return 0.0025 * Math.sqrt(bw / 50); };
    function doSample(initial) {
      const l = lsbOf(Cv.range, Cv.res), lim = limOf(Cv.range, Cv.res), sig = noiseG();
      const raw = [];
      const cl = [false, false, false];
      for (let i = 0; i < 3; i++) {
        const v = S.lp[i] + (initial ? 0 : gauss(S.k * 3 + i) * sig);
        let q = Math.round(v / l);
        if (q >= lim - 1 || q <= -lim) cl[i] = true;
        q = clamp(q, -lim, lim - 1); raw.push(q);
      }
      S.raw = raw; S.a = raw.map(q => q * l); S.clip = cl; S.k++;
      for (let i = 0; i < 3; i++) { const v = raw[i] & 0xFFFF; S.regs[2 * i] = v & 255; S.regs[2 * i + 1] = (v >> 8) & 255; }
      const mag = Math.max(Math.abs(S.a[0]), Math.abs(S.a[1]), Math.abs(S.a[2]));
      if (!initial) {
        if (S.shockT >= 0 || S.hitHold > 0) S.peak = Math.max(S.peak, Math.abs(S.a[2]));
        S.hist.push([S.t, S.a[0], S.a[1], S.a[2]]); if (S.hist.length > 900) S.hist.shift();
      }
      return mag;
    }
    function stepCore(dtMs) {
      S.acc += dtMs;
      while (S.acc >= SUB - 1e-9) {
        S.acc -= SUB; S.t += SUB;
        const a = analog(S.t / 1000);
        const a0 = SUB / 1000 / (SUB / 1000 + 1 / (TWO_PI * Cv.rate / 2));   // interne Bandbreite = halbe Datenrate
        const al = Cv.filter > 0 ? SUB / 1000 / (SUB / 1000 + 1 / (TWO_PI * Cv.filter)) : 1;
        for (let i = 0; i < 3; i++) { S.lp0[i] += (a[i] - S.lp0[i]) * a0; S.lp[i] += (S.lp0[i] - S.lp[i]) * al; }
        if (S.shockT >= 0) { S.shockT += SUB; if (S.shockT > SHOCK_MS) { S.shockT = -1; S.hitHold = 300; } }
        else if (S.hitHold > 0) S.hitHold = Math.max(0, S.hitHold - SUB);
        S.sampAcc += SUB;
        const Ts = 1000 / Cv.rate;
        if (S.sampAcc >= Ts - 1e-9) { S.sampAcc -= Ts; doSample(false); checkEvents(a); }
      }
      if (S.hitAnim > 0) S.hitAnim = Math.max(0, S.hitAnim - dtMs);
    }
    function checkEvents(a) {
      const anyClip = S.clip[0] || S.clip[1] || S.clip[2];
      const truthOver = Math.abs(S.lp[0]) > Cv.range || Math.abs(S.lp[1]) > Cv.range || Math.abs(S.lp[2]) > Cv.range;
      if (anyClip && !S.clipAct) {
        S.clipAct = true;
        ev('Messbereich überschritten! Der Sensor misst nur bis ±' + Cv.range + ' g, die Beschleunigung war größer. Der Zählwert bleibt am Anschlag (Clipping). Wähle einen größeren Messbereich.', 'warn', 'stall', CUBE.x, CUBE.y - 60);
      } else if (S.clipAct && !anyClip && !truthOver) { S.clipAct = false; }
      const aliased = Cv.vibAmp > 0.02 && Cv.vibFreq > Cv.rate / 2 && !(Cv.filter > 0 && Cv.filter < Cv.vibFreq / 4);
      if (aliased && !S.aliasAct) {
        S.aliasAct = true;
        ev('Aliasing! Die Schwingung mit ' + f1(Cv.vibFreq, 0) + ' Hz liegt über der halben Datenrate (' + f1(Cv.rate / 2, 0) + ' Hz). Der Sensor sieht eine falsche, langsame Welle mit ' + f1(alias(Cv.vibFreq, Cv.rate), 0) + ' Hz.', 'warn', 'tip', CUBE.x, CUBE.y - 60);
      } else if (!aliased) S.aliasAct = false;
      const steep = Math.abs(Cv.tiltX) >= 80;
      if (steep && !S.steepAct) { S.steepAct = true; ev('Fast senkrecht: Die Neigung ändert sich hier kaum noch in der Beschleunigung (die Sinuskurve ist flach), der Winkel wird ungenau.', 'info'); }
      else if (!steep) S.steepAct = false;
    }

    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      let v;
      if (d.type === 'switch' || d.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (d.type === 'slider') v = clamp(num(value, d.value), d.min, d.max);
      else { const o = d.options.find(x => String(x.value) === String(value)); v = o ? o.value : d.value; }
      Cv[key] = v;
      if (key === 'hit') {
        if (v && !S.btn) {
          S.btn = true; S.shockT = 0; S.shockA = Cv.shock; S.hitAnim = 900; S.peak = 0;
          ev('Stoß! Ein Hammerschlag mit ' + f1(Cv.shock, 1) + ' g trifft den Sensor' + (Cv.shock > Cv.range ? ' – mehr als der Messbereich ±' + Cv.range + ' g.' : '.'), 'info', 'crash', CUBE.x, CUBE.y - 80);
        }
        if (!v) S.btn = false;
      }
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      Object.keys(p.params).forEach(k => setControl(k, p.params[k]));
      return true;
    }

    function angles(a) { return { roll: Math.atan2(a[1], a[2]) * R2D, pitch: Math.atan2(a[0], Math.sqrt(a[1] * a[1] + a[2] * a[2])) * R2D }; }
    function readMeters() {
      const an = angles(S.a), l = lsbOf(Cv.range, Cv.res) * 1000;
      return { ax: S.a[0], ay: S.a[1], az: S.a[2], axMs2: S.a[0] * G0, ayMs2: S.a[1] * G0, azMs2: S.a[2] * G0, roll: an.roll, pitch: an.pitch,
        rawX: S.raw[0], rawY: S.raw[1], rawZ: S.raw[2], lsb: l, noise: noiseG() * 1000, peak: S.peak };
    }
    function state() {
      const an = angles(S.a), g = gravity(Cv.tiltX, Cv.tiltY), faults = [];
      if (S.clipAct || S.clip.some(Boolean)) faults.push('clip');
      if (S.aliasAct) faults.push('aliasing');
      const lim = limOf(Cv.range, Cv.res);
      return {
        ax: S.a[0], ay: S.a[1], az: S.a[2], axTrue: g[0], ayTrue: g[1], azTrue: g[2], raw: S.raw.slice(), rawX: S.raw[0], rawY: S.raw[1], rawZ: S.raw[2],
        regs: S.regs.slice(), regsHex: S.regs.map(b => hx(b, 2)), regAddr: [0x32, 0x33, 0x34, 0x35, 0x36, 0x37], i2cAddr: ADDR,
        roll: an.roll, pitch: an.pitch, rollTrue: Cv.tiltY, pitchTrue: Cv.tiltX, lsb: lsbOf(Cv.range, Cv.res), limit: lim,
        range: Cv.range, res: Cv.res, rate: Cv.rate, filter: Cv.filter, noise: noiseG(), peak: S.peak, clip: S.clip.slice(), clipping: S.clip.some(Boolean),
        aliasFreq: alias(Cv.vibFreq, Cv.rate), aliasing: S.aliasAct, shockActive: S.shockT >= 0, samples: S.k, t: S.t,
        mag: Math.sqrt(S.a[0] * S.a[0] + S.a[1] * S.a[1] + S.a[2] * S.a[2]),
        telegram: ['S', hx((ADDR << 1) | 0, 2) + ' W', 'A', '0x32', 'A', 'Sr', hx((ADDR << 1) | 1, 2) + ' R', 'A'].concat(S.regs.map((b, i) => hx(b, 2) + (i < 5 ? ' A' : ' N')), ['P']),
        fault: faults.length > 0, faults
      };
    }

    // ---- Kennlinien (aus dem Modell, ohne Rauschen) ----
    function curves() {
      const l = lsbOf(Cv.range, Cv.res), c1 = { ax: [], ay: [], az: [] }, e1 = [];
      for (let d = -90; d <= 90; d += 5) {
        const g = gravity(d, Cv.tiltY);
        c1.ax.push([d, g[0]]); c1.ay.push([d, g[1]]); c1.az.push([d, g[2]]);
        const q = [quant(g[0], Cv.range, Cv.res), quant(g[1], Cv.range, Cv.res), quant(g[2], Cv.range, Cv.res)].map(v => v * l);
        e1.push([d, angles(q).pitch - d]);
      }
      const gq = gravity(Cv.tiltX, Cv.tiltY), qq = gq.map(v => quant(v, Cv.range, Cv.res) * l);
      const cnt = [], lim = limOf(Cv.range, Cv.res), top = Cv.range * 1.4;
      for (let k = -60; k <= 60; k++) { const a = top * k / 60; cnt.push([a, quant(a, Cv.range, Cv.res)]); }
      return [
        { id: 'accTilt', title: 'Beschleunigung über Neigung X', xLabel: 'Neigung X', xUnit: '°', yLabel: 'Beschleunigung', yUnit: 'g',
          series: [{ name: 'ax = sin(Neigung X)', points: c1.ax }, { name: 'ay = cos(X)·sin(Y)', points: c1.ay }, { name: 'az = cos(X)·cos(Y)', points: c1.az }], marker: { x: Cv.tiltX, y: gq[0] } },
        { id: 'angErr', title: 'Winkelfehler durch Quantisierung', xLabel: 'Neigung X', xUnit: '°', yLabel: 'Fehler Nick', yUnit: '°',
          series: [{ name: 'Fehler (ohne Rauschen)', points: e1 }], marker: { x: Cv.tiltX, y: angles(qq).pitch - Cv.tiltX } },
        { id: 'counts', title: 'Zählwert über Beschleunigung (Clipping)', xLabel: 'Beschleunigung', xUnit: 'g', yLabel: 'Zählwert', yUnit: 'Digit',
          series: [{ name: 'Zählwert', points: cnt }, { name: 'Obergrenze', points: [[-top, lim - 1], [top, lim - 1]] }, { name: 'Untergrenze', points: [[-top, -lim], [top, -lim]] }],
          marker: { x: S.lp[2], y: S.raw[2] } }
      ];
    }

    // ================= Zeichnen =================
    const CUBE = { x: 290, y: 232 };
    const YAW = -0.55, ELEV = 0.5;
    const cam = p => {
      const c = Math.cos(YAW), s = Math.sin(YAW), x1 = p[0] * c - p[1] * s, y1 = p[0] * s + p[1] * c;
      return [x1, -(p[2] * Math.cos(ELEV) + y1 * Math.sin(ELEV)), y1 * Math.cos(ELEV) - p[2] * Math.sin(ELEV)];
    };
    const mulv = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];

    function jolt() {
      if (!(S.hitAnim > 0)) return 0;
      const u = (900 - S.hitAnim) / 900, hitAt = 0.33;
      if (u < hitAt) return 0;
      const k = (u - hitAt) / (1 - hitAt);
      return Math.exp(-k * 4.5) * Math.cos(k * 22) * 14 * clamp(S.shockA / 8, 0.3, 1.6);
    }

    function drawPlate(ctx, t) {
      const M = rotMat(Cv.tiltX, Cv.tiltY), HX = 105, HY = 105, HZ = 15, jo = jolt();
      const ox = CUBE.x, oy = CUBE.y + jo;
      // Schatten und Standfuss
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(ox, CUBE.y + 170, 150, 34, 0, 0, TWO_PI); ctx.fill();
      const gp = ctx.createLinearGradient(ox - 20, 0, ox + 20, 0); gp.addColorStop(0, '#2b333b'); gp.addColorStop(0.5, '#56626e'); gp.addColorStop(1, '#232a31');
      ctx.fillStyle = gp; ctx.fillRect(ox - 12, oy, 24, CUBE.y + 165 - oy);
      ctx.fillStyle = '#39434d'; ctx.beginPath(); ctx.ellipse(ox, CUBE.y + 168, 70, 16, 0, 0, TWO_PI); ctx.fill();
      ctx.strokeStyle = '#11161b'; ctx.lineWidth = 2; ctx.stroke();
      const V8 = []; for (let i = 0; i < 8; i++) V8.push([(i & 1 ? 1 : -1) * HX, (i & 2 ? 1 : -1) * HY, (i & 4 ? 1 : -1) * HZ]);
      const P = V8.map(v => { const w = mulv(M, v), c = cam(w); return [ox + c[0], oy + c[1], c[2]]; });
      const faces = [
        { n: [0, 0, 1], v: [4, 5, 7, 6], col: [34, 98, 86] }, { n: [0, 0, -1], v: [0, 2, 3, 1], col: [24, 60, 54] },
        { n: [1, 0, 0], v: [1, 3, 7, 5], col: [30, 70, 66] }, { n: [-1, 0, 0], v: [0, 4, 6, 2], col: [30, 70, 66] },
        { n: [0, 1, 0], v: [2, 6, 7, 3], col: [28, 66, 62] }, { n: [0, -1, 0], v: [0, 1, 5, 4], col: [28, 66, 62] }
      ];
      faces.forEach(f => { const wn = mulv(M, f.n), cn = cam(wn); f.dn = cn[2] - cam([0, 0, 0])[2]; f.wn = wn; f.dep = f.v.reduce((s, i) => s + P[i][2], 0) / 4; });
      faces.sort((a, b) => b.dep - a.dep);
      const L = [-0.35, -0.55, 0.76];
      faces.forEach(f => {
        if (f.dn > 0.001) return;   // abgewandte Seiten nicht zeichnen
        const sh = 0.55 + 0.6 * Math.max(0, f.wn[0] * L[0] + f.wn[1] * L[1] + f.wn[2] * L[2]);
        ctx.fillStyle = 'rgb(' + (f.col[0] * sh | 0) + ',' + (f.col[1] * sh | 0) + ',' + (f.col[2] * sh | 0) + ')';
        ctx.beginPath(); ctx.moveTo(P[f.v[0]][0], P[f.v[0]][1]); for (let i = 1; i < 4; i++) ctx.lineTo(P[f.v[i]][0], P[f.v[i]][1]); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(8,14,12,0.9)'; ctx.lineWidth = 2; ctx.stroke();
        if (f.n[2] === 1) drawTop(ctx, M, ox, oy, HZ, P);
      });
      return { M, ox, oy };
    }
    function drawTop(ctx, M, ox, oy, HZ) {
      // Beschriftung auf der Oberseite: affine Abbildung der Plattenebene
      const ex = cam(mulv(M, [1, 0, 0])), ey = cam(mulv(M, [0, 1, 0])), c0 = cam(mulv(M, [0, 0, HZ])), z0 = cam([0, 0, 0]);
      ctx.save();
      ctx.transform(ex[0] - z0[0], ex[1] - z0[1], ey[0] - z0[0], ey[1] - z0[1], ox + c0[0], oy + c0[1]);
      // Leiterbahnen
      ctx.strokeStyle = 'rgba(180,230,200,0.22)'; ctx.lineWidth = 2.5;
      for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(-95, k * 20); ctx.lineTo(-40, k * 20); ctx.lineTo(-24, k * 20 + (k > 0 ? -10 : 10)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(95, k * 20); ctx.lineTo(40, k * 20); ctx.lineTo(24, k * 20 + (k > 0 ? -10 : 10)); ctx.stroke(); }
      // Chip
      const gc = ctx.createLinearGradient(-26, -26, 26, 26); gc.addColorStop(0, '#3a3f46'); gc.addColorStop(1, '#14171b');
      ctx.fillStyle = gc; rr(ctx, -26, -26, 52, 52, 4); ctx.fill(); ctx.strokeStyle = '#080a0c'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#9aa4ae'; ctx.beginPath(); ctx.arc(-18, -18, 3, 0, TWO_PI); ctx.fill();
      ctx.font = 'bold 11px ' + MONO; ctx.fillStyle = '#c4ccd4'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('MEMS', 0, -4); ctx.fillText('±g', 0, 10);
      // Achsen-Beschriftung
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.strokeStyle = rgba(RED, 0.95); ctx.beginPath(); ctx.moveTo(-70, 80); ctx.lineTo(-34, 80); ctx.stroke(); ctx.fillStyle = rgba(RED, 1); ctx.beginPath(); ctx.moveTo(-26, 80); ctx.lineTo(-38, 74); ctx.lineTo(-38, 86); ctx.fill();
      ctx.font = 'bold 15px ' + FONT; ctx.fillText('X', -16, 80);
      ctx.strokeStyle = rgba(GREEN, 0.95); ctx.beginPath(); ctx.moveTo(-82, 68); ctx.lineTo(-82, 32); ctx.stroke(); ctx.fillStyle = rgba(GREEN, 1); ctx.beginPath(); ctx.moveTo(-82, 24); ctx.lineTo(-88, 36); ctx.lineTo(-76, 36); ctx.fill();
      ctx.fillStyle = rgba(GREEN, 1); ctx.fillText('Y', -82, 12);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = 'bold 9px ' + FONT; ctx.fillText('ADXL-ähnlich · I²C 0x53', 40, -86);
      ctx.restore();
    }
    function arrow3(ctx, ox, oy, M, axis, val, col, label) {
      const dir = mulv(M, axis), z0 = cam([0, 0, 0]), c = cam(dir);
      const dx = c[0] - z0[0], dy = c[1] - z0[1], len = val * 120;
      const ex = ox + dx * len, ey = oy + dy * len;
      if (Math.abs(len) < 2) return;
      ctx.strokeStyle = rgba(col, 0.95); ctx.lineWidth = 5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
      const L = Math.hypot(ex - ox, ey - oy) || 1, ux = (ex - ox) / L, uy = (ey - oy) / L;
      ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.moveTo(ex + ux * 12, ey + uy * 12); ctx.lineTo(ex - uy * 8, ey + ux * 8); ctx.lineTo(ex + uy * 8, ey - ux * 8); ctx.closePath(); ctx.fill();
      txt(ctx, label, ex + ux * 26, ey + uy * 26, 14, rgba(col, 1), 'center', true);
    }
    function drawCubeScene(ctx, t) {
      ctx.fillStyle = C.panel; rr(ctx, 14, 52, 556, 392, 12); ctx.fill(); ctx.strokeStyle = C.line; ctx.lineWidth = 1.5; ctx.stroke();
      // Boden-Raster
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
      for (let k = -4; k <= 4; k++) { ctx.beginPath(); ctx.moveTo(CUBE.x + k * 56 - 140, CUBE.y + 190); ctx.lineTo(CUBE.x + k * 36 - 90, CUBE.y + 150); ctx.stroke(); }
      const pl = drawPlate(ctx, t), M = pl.M;
      // Pfeile in Sensorachsen (Laenge ~ gemessene Beschleunigung)
      const c = [CUBE.x, CUBE.y + jolt()];
      arrow3(ctx, c[0], c[1], M, [1, 0, 0], S.a[0], RED, 'x ' + sg(S.a[0], 2) + ' g');
      arrow3(ctx, c[0], c[1], M, [0, 1, 0], S.a[1], GREEN, 'y ' + sg(S.a[1], 2) + ' g');
      arrow3(ctx, c[0], c[1], M, [0, 0, 1], S.a[2], BLUE, 'z ' + sg(S.a[2], 2) + ' g');
      // Messvektor (Summe) gestrichelt = zeigt "nach oben"
      const g = gravity(Cv.tiltX, Cv.tiltY), up = mulv(M, g), cu = cam(up), z0 = cam([0, 0, 0]);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(c[0], c[1]); ctx.lineTo(c[0] + (cu[0] - z0[0]) * 150, c[1] + (cu[1] - z0[1]) * 150); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      txt(ctx, '1 g nach oben (Schwerkraft-Gegenkraft)', c[0] + (cu[0] - z0[0]) * 150, c[1] + (cu[1] - z0[1]) * 150 - 14, 11, 'rgba(255,255,255,0.7)', 'center');
      drawHammer(ctx, t);
      txt(ctx, 'Zum Kippen auf das Bild tippen und ziehen', 292, 432, 12, C.dim, 'center');
    }
    function drawHammer(ctx, t) {
      if (!(S.hitAnim > 0)) return;
      const u = (900 - S.hitAnim) / 900, hitAt = 0.33;
      const px = CUBE.x + 190, py = CUBE.y - 130;                       // Drehpunkt
      const ang = u < hitAt ? -(1 - u / hitAt) * 1.35 : 0.12 * Math.exp(-(u - hitAt) * 6);
      const top = CUBE.y + jolt() - 62;
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
      const L = Math.hypot(px - CUBE.x, py - top) + 6;
      ctx.rotate(Math.atan2(top - py, CUBE.x - px) - Math.PI / 2 * 0 + 0);
      ctx.fillStyle = '#8a5a2b'; ctx.fillRect(0, -5, L - 30, 10);
      ctx.fillStyle = '#b8c2cc'; rr(ctx, L - 44, -24, 36, 48, 6); ctx.fill(); ctx.strokeStyle = '#4a545e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.restore();
      if (u >= hitAt) {
        const k = (u - hitAt) / (1 - hitAt);
        for (let r = 0; r < 3; r++) { ctx.strokeStyle = 'rgba(255,200,80,' + clamp(1 - k - r * 0.1, 0, 1) + ')'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(CUBE.x, CUBE.y - 20, 30 + k * 150 + r * 22, 0, TWO_PI); ctx.stroke(); }
        txt(ctx, 'BAMM! ' + f1(S.shockA, 1) + ' g', CUBE.x - 150, CUBE.y - 120 - k * 16, 22, 'rgba(255,200,80,' + clamp(1.2 - k, 0, 1) + ')', 'center', true);
      }
    }
    function drawLevel(ctx, t) {
      const x0 = 14, y0 = 454, w = 556, h = 94;
      panel(ctx, x0, y0, w, h, null);
      // Dosenlibelle
      const cx = 66, cy = y0 + 47, r = 38;
      const gl = ctx.createRadialGradient(cx - 8, cy - 10, 4, cx, cy, r); gl.addColorStop(0, '#6c8a7a'); gl.addColorStop(1, '#2a4136');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      [12, 24].forEach(rr2 => { ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, TWO_PI); ctx.stroke(); });
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy); ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r); ctx.stroke();
      const bx = cx + clamp(S.a[0] * 2.2, -1, 1) * (r - 10), by = cy - clamp(S.a[1] * 2.2, -1, 1) * (r - 10);
      const gb = ctx.createRadialGradient(bx - 3, by - 3, 1, bx, by, 10); gb.addColorStop(0, 'rgba(255,255,255,0.95)'); gb.addColorStop(1, 'rgba(200,230,255,0.45)');
      ctx.fillStyle = gb; ctx.beginPath(); ctx.arc(bx, by, 9, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
      txt(ctx, 'Wasserwaage', cx, y0 + h - 6, 10, C.dim, 'center');
      // Roehrenlibelle (x)
      const lx = 120, ly = y0 + 22, lw = 150, lh = 22;
      ctx.fillStyle = '#35523f'; rr(ctx, lx, ly, lw, lh, 11); ctx.fill(); ctx.strokeStyle = '#0f1317'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.moveTo(lx + lw / 2 - 12, ly + 2); ctx.lineTo(lx + lw / 2 - 12, ly + lh - 2); ctx.moveTo(lx + lw / 2 + 12, ly + 2); ctx.lineTo(lx + lw / 2 + 12, ly + lh - 2); ctx.stroke();
      const bb = lx + lw / 2 + clamp(S.a[0] * 2.2, -1, 1) * (lw / 2 - 20);
      ctx.fillStyle = 'rgba(220,240,255,0.85)'; rr(ctx, bb - 14, ly + 3, 28, lh - 6, 8); ctx.fill();
      // Winkelanzeige
      const an = angles(S.a);
      txt(ctx, 'Roll', 290, y0 + 20, 12, C.dim, 'left', true); txt(ctx, f1(an.roll, 1) + '°', 420, y0 + 20, 22, C.ok, 'right', true, MONO);
      txt(ctx, 'Nick', 290, y0 + 52, 12, C.dim, 'left', true); txt(ctx, f1(an.pitch, 1) + '°', 420, y0 + 52, 22, C.ok, 'right', true, MONO);
      txt(ctx, 'Roll = atan2(ay, az)', 120, y0 + 62, 11, C.dim, 'left'); txt(ctx, 'Nick = atan2(ax, √(ay²+az²))', 120, y0 + 78, 11, C.dim, 'left');
      // Stoss-Taster
      const bx0 = 436, by0 = y0 + 18, bw = 120, bh = 58, on = S.hitAnim > 0;
      ctx.fillStyle = on ? 'rgba(255,92,92,0.35)' : '#2a323b'; rr(ctx, bx0, by0, bw, bh, 12); ctx.fill(); ctx.strokeStyle = on ? C.bad : '#556270'; ctx.lineWidth = 2; ctx.stroke();
      txt(ctx, '🔨 Stoß', bx0 + bw / 2, by0 + 22, 17, on ? '#fff' : C.text, 'center', true);
      txt(ctx, f1(Cv.shock, 1) + ' g', bx0 + bw / 2, by0 + 44, 13, C.dim, 'center');
    }
    function drawBars(ctx, t) {
      const x0 = 586, y0 = 14, w = 400, h = 150;
      panel(ctx, x0, y0, w, h, 'MESSWERTE  Bereich ±' + Cv.range + ' g · ' + f1(lsbOf(Cv.range, Cv.res) * 1000, 2) + ' mg/Digit');
      const names = ['x', 'y', 'z'], cols = [RED, GREEN, BLUE];
      for (let i = 0; i < 3; i++) {
        const y = y0 + 32 + i * 38, bx = x0 + 34, bw = 190, a = S.a[i], clip = S.clip[i];
        txt(ctx, names[i], x0 + 16, y + 11, 17, rgba(cols[i], 1), 'left', true);
        ctx.fillStyle = '#0c1014'; rr(ctx, bx, y, bw, 22, 6); ctx.fill();
        const sc = (bw / 2 - 3) / Cv.range, mid = bx + bw / 2, len = clamp(a, -Cv.range, Cv.range) * sc;
        ctx.fillStyle = rgba(clip ? RED : cols[i], 0.9); ctx.fillRect(Math.min(mid, mid + len), y + 4, Math.abs(len), 14);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(mid, y + 1); ctx.lineTo(mid, y + 21); ctx.stroke();
        ctx.fillStyle = 'rgba(255,92,92,0.65)'; ctx.fillRect(bx + 1, y + 1, 3, 20); ctx.fillRect(bx + bw - 4, y + 1, 3, 20);
        txt(ctx, sg(a, 3) + ' g', x0 + 236, y + 11, 15, clip ? (Math.floor(t / 200) % 2 ? C.bad : C.warn) : C.text, 'left', true, MONO);
        txt(ctx, sg(a * G0, 2) + ' m/s²', x0 + w - 12, y + 11, 13, C.dim, 'right', false, MONO);
      }
      if (S.clip.some(Boolean)) txt(ctx, 'CLIPPING – Messbereich überschritten', x0 + 16, y0 + h - 10, 12, Math.floor(t / 250) % 2 ? C.bad : C.warn, 'left', true);
      else txt(ctx, 'Rauschen ' + f1(noiseG() * 1000, 1) + ' mg · Datenrate ' + Cv.rate + ' Hz', x0 + 16, y0 + h - 10, 12, C.dim, 'left');
    }
    function drawScope(ctx, t) {
      const x0 = 586, y0 = 174, w = 400, h = 140;
      panel(ctx, x0, y0, w, h, 'SCHREIBER  letzte Sekunde');
      const px = x0 + 40, pw = w - 56, py = y0 + 28, ph = h - 40;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 6); ctx.fill();
      const hh = S.hist; let mx = 1.2;
      for (let q = 0; q < hh.length; q++) if (S.t - hh[q][0] <= 1000) mx = Math.max(mx, Math.abs(hh[q][1]), Math.abs(hh[q][2]), Math.abs(hh[q][3]));
      mx = Math.min(mx * 1.1, Cv.range * 1.15 + 0.01); mx = Math.max(mx, 1.2);
      const Y = v => py + ph / 2 - clamp(v / mx, -1, 1) * (ph / 2 - 2);
      ctx.strokeStyle = '#1f2830'; ctx.lineWidth = 1;
      [-1, -0.5, 0, 0.5, 1].forEach(f => { const gy = py + ph / 2 - f * (ph / 2 - 2); ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px + pw, gy); ctx.stroke(); });
      txt(ctx, f1(mx, 1), px - 4, py + 6, 10, C.dim, 'right'); txt(ctx, '0', px - 4, py + ph / 2, 10, C.dim, 'right'); txt(ctx, '−' + f1(mx, 1), px - 4, py + ph - 6, 10, C.dim, 'right');
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      [[1, RED], [2, GREEN], [3, BLUE]].forEach(sr => {
        ctx.strokeStyle = rgba(sr[1], 0.95); ctx.lineWidth = 2; ctx.beginPath(); let first = true;
        for (let q = 0; q < hh.length; q++) { const age = S.t - hh[q][0]; if (age > 1000) continue; const x = px + pw * (1 - age / 1000), y = Y(hh[q][sr[0]]); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); }
        ctx.stroke();
        if (hh.length > 1) { ctx.fillStyle = rgba(sr[1], 1); ctx.beginPath(); ctx.arc(px + pw - 2, Y(S.a[sr[0] - 1]), 3.5, 0, TWO_PI); ctx.fill(); }
      });
      ctx.restore();
      txt(ctx, '−1 s', px, py + ph + 10, 10, C.dim, 'left'); txt(ctx, 'jetzt', px + pw, py + ph + 10, 10, C.dim, 'right');
    }
    function drawRegs(ctx, t) {
      const x0 = 586, y0 = 324, w = 400, h = 118;
      panel(ctx, x0, y0, w, h, 'REGISTER  (Zählwerte hexadezimal, little endian)');
      const names = ['DATAX0', 'DATAX1', 'DATAY0', 'DATAY1', 'DATAZ0', 'DATAZ1'];
      for (let i = 0; i < 6; i++) {
        const col = Math.floor(i / 2), row = i % 2, x = x0 + 12 + col * 130, y = y0 + 28 + row * 22;
        ctx.fillStyle = '#1a2026'; rr(ctx, x, y, 122, 19, 5); ctx.fill();
        txt(ctx, hx(0x32 + i, 2), x + 6, y + 10, 11, C.dim, 'left', false, MONO);
        txt(ctx, names[i], x + 44, y + 10, 10, C.dim, 'left');
        txt(ctx, hx(S.regs[i], 2), x + 117, y + 10, 13, [RED, GREEN, BLUE].map(c => rgba(c, 1))[col], 'right', true, MONO);
      }
      for (let i = 0; i < 3; i++) {
        const x = x0 + 12 + i * 130, y = y0 + 78;
        const word = ((S.regs[2 * i + 1] << 8) | S.regs[2 * i]);
        txt(ctx, ['X', 'Y', 'Z'][i] + ' = ' + hx(word, 4), x, y + 2, 12, C.text, 'left', true, MONO);
        txt(ctx, S.raw[i] + ' Digit', x, y + 18, 12, C.dim, 'left', false, MONO);
        txt(ctx, '= ' + sg(S.a[i], 3) + ' g', x + 122, y + 18, 11, C.dim, 'right', false, MONO);
      }
    }
    function drawTele(ctx, t) {
      const x0 = 586, y0 = 452, w = 400, h = 96;
      panel(ctx, x0, y0, w, h, 'I²C-TELEGRAMM  Adresse 0x53 (ALT-Pin = Low)');
      const hh2 = v => hx(v, 2).slice(2);
      const items = [['S', 0], [hh2(ADDR << 1) + ' W', 1], ['A', 2], ['32', 1], ['A', 2], ['Sr', 0]];
      const items2 = [[hh2((ADDR << 1) | 1) + ' R', 1], ['A', 2]];
      for (let i = 0; i < 6; i++) items2.push([hh2(S.regs[i]), 3], [i < 5 ? 'A' : 'N', i < 5 ? 2 : 4]);
      items2.push(['P', 0]);
      const cur = Math.floor(t / 130) % (items.length + items2.length + 6);
      const colors = { 0: '#36424e', 1: '#2a5a8a', 2: '#2c6b3c', 3: '#3b4652', 4: '#7a2a2a' };
      function row(list, y, off) {
        let x = x0 + 12;
        list.forEach((it, i) => {
          const wdt = it[0].length > 3 ? 42 : it[0].length > 1 ? 26 : 18, act = (cur - off) === i;
          ctx.fillStyle = colors[it[1]]; rr(ctx, x, y, wdt, 22, 5); ctx.fill();
          if (act) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
          txt(ctx, it[0], x + wdt / 2, y + 11, it[0].length > 3 ? 11 : 12, '#fff', 'center', true, MONO);
          x += wdt + 3;
        });
      }
      row(items, y0 + 28, 0);
      txt(ctx, '← Registerzeiger 0x32 setzen', x0 + 200, y0 + 39, 11, C.dim, 'left');
      row(items2, y0 + 58, items.length);
      txt(ctx, 'A = ACK (Sensor antwortet), N = NACK (letztes Byte), S/P = Start/Stopp', x0 + 12, y0 + h - 6, 10, C.dim, 'left');
    }
    function drawTitle(ctx, t) {
      txt(ctx, 'Beschleunigung und Neigung', 20, 26, 18, C.text, 'left', true);
      txt(ctx, 'MEMS-Sensor mit Registern und I²C', 20, 44, 11, C.dim, 'left');
      const f = S.clip.some(Boolean);
      ctx.fillStyle = f ? C.bad : C.ok; ctx.beginPath(); ctx.arc(552, 30, 7, 0, TWO_PI); ctx.fill();
      txt(ctx, f ? 'Clipping' : 'ok', 540, 30, 12, f ? C.bad : C.ok, 'right', true);
    }

    function draw(ctx, w, h, t) {
      t = num(t, 0); w = num(w, 0); h = num(h, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Math.max(w, 0), Math.max(h, 0));
      if (w > 0 && h > 0) {
        const sc = Math.min(w / WW, h / WH);
        ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
        ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
        drawTitle(ctx, t);
        drawCubeScene(ctx, t);
        drawLevel(ctx, t);
        drawBars(ctx, t);
        drawScope(ctx, t);
        drawRegs(ctx, t);
        drawTele(ctx, t);
      }
      ctx.restore();
    }

    function hitTest(px, py, w, h) {
      w = num(w, 0); h = num(h, 0); if (!(w > 0 && h > 0)) return null;
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      if (x > 436 && x < 556 && y > 472 && y < 530) return { key: 'hit', kind: 'button' };
      if (x > 14 && x < 570 && y > 52 && y < 444) {
        return { key: 'tilt', kind: 'drag', set: { tiltX: Math.round(clamp((x - CUBE.x) / 220 * 90, -90, 90)), tiltY: Math.round(clamp((CUBE.y - y) / 150 * 90, -90, 90)) } };
      }
      return null;
    }

    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'beschleunigung', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k]));
    // Anfangsstand der Register passend zur Lage (nach opts.controls)
    S.lp = gravity(Cv.tiltX, Cv.tiltY); S.lp0 = S.lp.slice(); doSample(true);
    return rig;
  }

  R.register({
    id: 'beschleunigung', name: 'Beschleunigung und Neigung', icon: '📐',
    info: 'Ein MEMS-Beschleunigungssensor (ADXL345-ähnlich, I²C-Adresse 0x53) misst die Schwerkraft in x, y und z. Aus den Zählwerten rechnest du mit atan2 die Neigung. Gib Stöße und Schwingungen ein, wähle Messbereich und Datenrate und lies die Register.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
