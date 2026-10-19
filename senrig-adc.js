(function (root) {
  'use strict';
  const R = root.SEN_RIGS = root.SEN_RIGS || { list: [], defs: {},
    register(def) { if (this.defs[def.id]) return; this.defs[def.id] = def; this.list.push({ id: def.id, name: def.name, icon: def.icon, info: def.info, controls: def.controls, meters: def.meters, presets: def.presets }); },
    create(id, opts) { return this.defs[id].create(opts || {}); } };

  // ===== Pruefstand 7: ADU und Abtastung (Quantisierung, Abtasttheorem, Aliasing, Spektrum) =====
  // Eigenes, gekapseltes Modell (bei Bedarf gegen SEN_CORE.adc / SEN_CORE.dft / SEN_CORE.alias austauschbar):
  //   Eingang u(t) = offset + amp*wave(2*pi*fSig*t) + Rauschen, optional Anti-Aliasing-Filter (4. Ordnung Butterworth, fg = 0,4*fs)
  //   ADU:  N = floor(u/Uref * 2^n) (0 ... 2^n - 1), LSB = Uref/2^n, Quantisierungsfehler +-LSB/2 (Effektivwert LSB/sqrt(12))
  //   SNR = 20*log10(Signal-Effektivwert / Fehler-Effektivwert), ideal 6,02*n + 1,76 dB, ENOB = (SNR - 1,76)/6,02
  //   Aliasing: fAlias = |fSig - Runden(fSig/fs)*fs|; Spektrum: DFT (Hann-Fenster, 256 Abtastwerte) der quantisierten Folge
  //   Die Zeitachse der Animation laeuft in Zeitlupe (4 Abtastwerte pro Sekunde), damit man jeden Abtastpunkt sieht.
  const WW = 1000, WH = 560;
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  const MONO = '"Consolas", "SF Mono", Menlo, monospace';
  const C = { bg: '#14181c', panel: '#222830', panel2: '#2a323b', line: '#3a444f', acc: '#3b9eff', ok: '#4cd964', warn: '#ffb340', bad: '#ff5c5c', text: '#e6edf3', dim: '#8b98a5' };
  const TWO_PI = Math.PI * 2;
  const GREEN = [76, 217, 100], BLUE = [59, 158, 255], AMB = [255, 179, 64], RED = [255, 92, 92];
  const NB = 256, WINDOW_SAMPLES = 16, SLOW_SPS = 4;
  const Q1 = 0.5412, Q2 = 1.3066;

  const CONTROLS = [
    { key: 'wave', label: 'Signalform', type: 'select', value: 'sin', group: 'Eingangssignal', options: [{ value: 'sin', label: 'Sinus' }, { value: 'tri', label: 'Dreieck' }, { value: 'sq', label: 'Rechteck' }, { value: 'dc', label: 'Gleichspannung' }], help: 'Dreieck und Rechteck enthalten Oberwellen. Die können ebenfalls Aliasing verursachen.' },
    { key: 'fSig', label: 'Signalfrequenz', type: 'slider', min: 1, max: 3000, step: 1, unit: 'Hz', value: 100, group: 'Eingangssignal', help: 'Frequenz des Eingangssignals. Über der halben Abtastrate (Nyquist) entsteht Aliasing.' },
    { key: 'amp', label: 'Amplitude', type: 'slider', min: 0, max: 2.5, step: 0.05, unit: 'V', value: 1.5, group: 'Eingangssignal', help: 'Spitzenwert. Passt das Signal nicht in 0 … Uref, wird es abgeschnitten (Übersteuerung).' },
    { key: 'offset', label: 'Offset', type: 'slider', min: 0, max: 5, step: 0.05, unit: 'V', value: 1.65, group: 'Eingangssignal', help: 'Gleichanteil. Der Wandler misst nur positive Spannungen von 0 bis Uref.' },
    { key: 'noise', label: 'Rauschen', type: 'slider', min: 0, max: 300, step: 5, unit: 'mV', value: 0, group: 'Eingangssignal', help: 'Effektivwert eines Rauschsignals auf dem Eingang. Es begrenzt die nutzbare Auflösung (ENOB).' },
    { key: 'bits', label: 'Auflösung', type: 'slider', min: 4, max: 16, step: 1, unit: 'Bit', value: 8, group: 'ADU', help: 'Bei jedem Bit mehr halbiert sich die Stufenhöhe (LSB). Der Störabstand steigt um 6 dB.' },
    { key: 'vref', label: 'Referenzspannung', type: 'select', value: 3.3, group: 'ADU', options: [{ value: 2.5, label: '2,5 V' }, { value: 3.3, label: '3,3 V' }, { value: 5, label: '5 V' }], help: 'Der Messbereich des Wandlers geht von 0 V bis Uref.' },
    { key: 'fs', label: 'Abtastrate', type: 'slider', min: 100, max: 10000, step: 50, unit: 'Hz', value: 1000, group: 'ADU', help: 'Wie oft pro Sekunde gemessen wird. Nach Nyquist muss fs größer als 2 · fSig sein.' },
    { key: 'sampleHold', label: 'Halteglied (Sample & Hold)', type: 'switch', value: true, group: 'ADU', help: 'Ohne Halteglied ändert sich das Signal während der Wandlung. Bei schnellen Signalen wird das Ergebnis ungenau.' },
    { key: 'aaf', label: 'Anti-Aliasing-Filter', type: 'switch', value: false, group: 'ADU', help: 'Tiefpass (4. Ordnung, Grenzfrequenz 0,4 · fs) vor dem Wandler. Er dämpft alles, was über der halben Abtastrate liegt.' }
  ];
  const METERS = [
    { key: 'lsb', label: 'Stufenhöhe (LSB)', unit: 'mV', digits: 3, min: 0, max: 20 },
    { key: 'quantErr', label: 'Quantisierungsfehler (eff.)', unit: 'mV', digits: 3, min: 0, max: 6 },
    { key: 'snr', label: 'Störabstand (SNR)', unit: 'dB', digits: 1, min: 0, max: 110 },
    { key: 'fAlias', label: 'Erscheinungsfrequenz', unit: 'Hz', digits: 0, min: 0, max: 5000 },
    { key: 'enob', label: 'Effektive Bitzahl (ENOB)', unit: 'Bit', digits: 1, min: 0, max: 16 },
    { key: 'code', label: 'Zählwert (letzter)', unit: 'Digit', digits: 0, min: 0, max: 65535 },
    { key: 'uIn', label: 'Eingang (letzter)', unit: 'V', digits: 3, min: 0, max: 5 },
    { key: 'nyquist', label: 'Nyquist-Frequenz fs/2', unit: 'Hz', digits: 0, min: 0, max: 5000 }
  ];
  const PRESETS = [
    { id: 'gut', name: 'Sauber abgetastet (100 Hz, 1 kHz, 12 Bit)', params: { wave: 'sin', fSig: 100, amp: 1.6, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false } },
    { id: 'grob', name: 'Grobe Quantisierung (4 Bit)', params: { wave: 'sin', fSig: 50, amp: 1.6, offset: 1.65, noise: 0, bits: 4, vref: 3.3, fs: 2000, sampleHold: true, aaf: false } },
    { id: 'alias', name: 'Aliasing (900 Hz bei 1 kHz)', params: { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false } },
    { id: 'aaf', name: 'Aliasing mit Anti-Aliasing-Filter', params: { wave: 'sin', fSig: 900, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: true } },
    { id: 'nyq', name: 'Gerade an der Nyquist-Grenze', params: { wave: 'sin', fSig: 480, amp: 1.5, offset: 1.65, noise: 0, bits: 12, vref: 3.3, fs: 1000, sampleHold: true, aaf: false } },
    { id: 'rechteck', name: 'Rechteck mit Oberwellen', params: { wave: 'sq', fSig: 150, amp: 1.2, offset: 1.65, noise: 0, bits: 10, vref: 3.3, fs: 1000, sampleHold: true, aaf: false } },
    { id: 'rausch', name: 'Rauschen begrenzt die Auflösung', params: { wave: 'sin', fSig: 123, amp: 1.6, offset: 1.65, noise: 40, bits: 16, vref: 3.3, fs: 5000, sampleHold: true, aaf: false } },
    { id: 'uebersteuert', name: 'Übersteuerung (Signal zu groß)', params: { wave: 'sin', fSig: 100, amp: 2.4, offset: 1.65, noise: 0, bits: 10, vref: 3.3, fs: 2000, sampleHold: true, aaf: false } }
  ];

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const fr = x => x - Math.floor(x);
  const rnd = n => fr(Math.sin(n * 127.1 + 311.7) * 43758.5453);
  const gauss = k => (rnd(k * 1.3 + 1) + rnd(k * 2.7 + 5) + rnd(k * 0.7 + 9) - 1.5) * 2;
  const num = (v, d) => { v = +v; return isFinite(v) ? v : d; };
  const f1 = (v, d) => (+v).toFixed(d == null ? 1 : d).replace('.', ',');
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a + ')';
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
  const aliasF = (f, fs) => { if (!(fs > 0)) return 0; let m = f % fs; if (m < 0) m += fs; return m > fs / 2 ? fs - m : m; };

  // ---- Signalmodell (rein) ----
  // P = { wave, fSig, amp, offset, noise, bits, vref, fs, sampleHold, aaf }
  function butter4(x) {          // Butterworth 4. Ordnung als Kaskade zweier Glieder: Betrag und Phase bei f/fg = x
    const d = Q => [1 - x * x, x / Q];
    const a = d(Q1), b = d(Q2);
    const m1 = Math.hypot(a[0], a[1]), m2 = Math.hypot(b[0], b[1]);
    return { mag: 1 / (m1 * m2), ph: -(Math.atan2(a[1], a[0]) + Math.atan2(b[1], b[0])) };
  }
  function harmonics(P, kmax) {
    const H = [];
    if (P.wave === 'sin') H.push([1, 1]);
    else if (P.wave === 'sq') for (let k = 1; k <= kmax; k += 2) H.push([k, 4 / (Math.PI * k)]);
    else if (P.wave === 'tri') for (let k = 1; k <= Math.min(kmax, 21); k += 2) H.push([k, 8 / (Math.PI * Math.PI * k * k) * ((((k - 1) / 2) % 2) ? -1 : 1)]);
    return H;
  }
  function makeSignal(P) {
    const fc = 0.4 * P.fs;
    if (P.wave === 'dc') return t => P.offset;
    if (!P.aaf) {
      if (P.wave === 'sin') return t => P.offset + P.amp * Math.sin(TWO_PI * P.fSig * t);
      if (P.wave === 'sq') return t => P.offset + P.amp * (Math.sin(TWO_PI * P.fSig * t) >= 0 ? 1 : -1);
      return t => P.offset + P.amp * (2 / Math.PI) * Math.asin(clamp(Math.sin(TWO_PI * P.fSig * t), -1, 1));
    }
    const H = harmonics(P, 61).map(h => { const b = butter4(h[0] * P.fSig / fc); return [h[0], h[1] * b.mag, b.ph]; });
    return t => { let s = 0; for (let i = 0; i < H.length; i++) s += H[i][1] * Math.sin(TWO_PI * H[i][0] * P.fSig * t + H[i][2]); return P.offset + P.amp * s; };
  }
  const noiseAt = (P, t) => P.noise > 0 ? P.noise / 1000 * gauss(Math.round(t * 20000)) : 0;
  function makeAdc(P) {
    const sig = makeSignal(P), Ts = 1 / P.fs, n = Math.pow(2, P.bits), lsb = P.vref / n;
    const analog = t => sig(t) + noiseAt(P, t);
    function sampleAt(k) {
      const t = k * Ts;
      let v;
      if (P.sampleHold) v = analog(t);
      else { v = 0; for (let i = 0; i < 5; i++) v += analog(t + 0.3 * Ts * i / 4); v /= 5; }
      const code = clamp(Math.floor(v / P.vref * n), 0, n - 1);
      return { t, v, code, xq: (code + 0.5) * lsb, clean: sig(t), clip: v < -1e-9 || v > P.vref + 1e-9 };
    }
    return { sig, analog, sampleAt, Ts, n, lsb };
  }
  const cosT = new Float64Array(NB), sinT = new Float64Array(NB), hann = new Float64Array(NB);
  let hsum = 0;
  for (let i = 0; i < NB; i++) { cosT[i] = Math.cos(TWO_PI * i / NB); sinT[i] = Math.sin(TWO_PI * i / NB); hann[i] = 0.5 - 0.5 * Math.cos(TWO_PI * i / (NB - 1)); hsum += hann[i]; }
  function analyze(P, withSpec) {
    const A = makeAdc(P), x = new Float64Array(NB);
    let s1 = 0, s2 = 0, e2 = 0, clip = false, mean = 0, mn = 1e9, mx = -1e9;
    const cl = new Float64Array(NB);
    for (let k = 0; k < NB; k++) { const s = A.sampleAt(k); x[k] = s.xq; cl[k] = s.clean; mean += s.clean; if (s.clip) clip = true; mn = Math.min(mn, s.clean); mx = Math.max(mx, s.clean); e2 += (s.xq - s.clean) * (s.xq - s.clean); }
    mean /= NB; for (let k = 0; k < NB; k++) s2 += (cl[k] - mean) * (cl[k] - mean);
    const sigRms = Math.sqrt(s2 / NB), errRms = Math.sqrt(e2 / NB);
    const snr = sigRms > 1e-9 && errRms > 1e-12 ? 20 * Math.log10(sigRms / errRms) : 0;
    const out = { snr, sigRms, errRms, clip, enob: sigRms > 1e-9 ? Math.max(0, (snr - 1.76) / 6.02) : 0, min: mn, max: mx };
    if (withSpec) {
      let xm = 0; for (let k = 0; k < NB; k++) xm += x[k]; xm /= NB;
      const spec = [], ref = P.vref / 2, M = NB / 2;
      for (let m = 0; m <= M; m++) {
        let re = 0, im = 0;
        for (let i = 0; i < NB; i++) { const v = (x[i] - xm) * hann[i], ix = (m * i) % NB; re += v * cosT[ix]; im -= v * sinT[ix]; }
        const amp = 2 * Math.hypot(re, im) / hsum;
        spec.push([m * P.fs / NB, 20 * Math.log10(Math.max(amp, 1e-9) / ref), amp]);
      }
      let pk = 1; for (let m = 2; m <= M - 1; m++) if (spec[m][2] > spec[pk][2]) pk = m;
      let pf = spec[pk][0];
      if (pk > 1 && pk < M) { const a = Math.log(spec[pk - 1][2] + 1e-12), b = Math.log(spec[pk][2] + 1e-12), c = Math.log(spec[pk + 1][2] + 1e-12), d = a - 2 * b + c; if (d < 0) pf = (pk + 0.5 * (a - c) / d) * P.fs / NB; }
      out.spec = spec; out.peakHz = pf; out.peakDb = spec[pk][1]; out.peakAmp = spec[pk][2];
    }
    return out;
  }
  function aliasInfo(P) {
    if (P.wave === 'dc') return { aliasing: false, f: P.fSig, worst: 0, alias: 0 };
    const lsb = P.vref / Math.pow(2, P.bits), fc = 0.4 * P.fs, nyq = P.fs / 2;
    let found = false, worst = 0, wa = 0, wamp = 0;
    harmonics(P, 41).forEach(h => {
      const f = h[0] * P.fSig; if (f <= nyq) return;
      let a = Math.abs(h[1]) * P.amp; if (P.aaf) a *= butter4(f / fc).mag;
      if (a >= Math.max(lsb, 0.03 * P.vref) && a > wamp) { found = true; wamp = a; worst = f; wa = aliasF(f, P.fs); }
    });
    return { aliasing: found, f: P.fSig, worst, alias: wa, amp: wamp };
  }

  function create(opts) {
    opts = opts || {};
    const ctl = JSON.parse(JSON.stringify(CONTROLS));
    const defOf = {}; ctl.forEach(c => { defOf[c.key] = c; });
    const Cv = {}; ctl.forEach(c => { Cv[c.key] = c.value; });
    const events = [];
    let S, V, cache = { key: '', an: null, ai: null };

    const P = () => ({ wave: Cv.wave, fSig: Cv.fSig, amp: Cv.amp, offset: Cv.offset, noise: Cv.noise, bits: Cv.bits, vref: Cv.vref, fs: Cv.fs, sampleHold: Cv.sampleHold, aaf: Cv.aaf });
    function ensure() {
      const key = JSON.stringify(P());
      if (cache.key !== key) { const p = P(); cache = { key, an: analyze(p, true), ai: aliasInfo(p), adc: makeAdc(p) }; }
      return cache;
    }
    function resetState() {
      S = { t: 0, tv: 0, aliasAct: false, clipAct: false, fAct: false };
      V = {};
      events.length = 0;
      ensure();
    }
    function ev(text, kind, fx, x, y) {
      const e = { t: Math.round(S.t), text, kind: kind || 'info' };
      if (fx) { e.fx = fx; if (x != null) { e.x = x; e.y = y; } }
      events.push(e); if (events.length > 300) events.splice(0, events.length - 300);
    }
    function checkEvents() {
      const c = ensure(), ai = c.ai, an = c.an;
      if (ai.aliasing && !S.aliasAct) {
        S.aliasAct = true;
        ev('Aliasing erkannt! ' + f1(ai.worst, 0) + ' Hz liegt über der halben Abtastrate (' + f1(Cv.fs / 2, 0) + ' Hz). Der ADU sieht eine falsche, langsame Welle mit ' + f1(ai.alias, 0) + ' Hz (Frequenzspiegelung). Erhöhe fs auf mehr als ' + f1(2 * ai.worst, 0) + ' Hz oder schalte den Anti-Aliasing-Filter ein.', 'warn', 'tip', 330, 150);
      } else if (!ai.aliasing && S.aliasAct) { S.aliasAct = false; ev('Kein Aliasing mehr: Die Abtastrate ist hoch genug.', 'info'); }
      if (an.clip && !S.clipAct) { S.clipAct = true; ev('Übersteuerung! Das Eingangssignal reicht über 0 … ' + f1(Cv.vref, 1) + ' V hinaus. Der Wandler schneidet die Spitzen ab. Verkleinere Amplitude oder Offset.', 'warn', 'stall', 330, 120); }
      else if (!an.clip && S.clipAct) { S.clipAct = false; ev('Das Signal passt wieder in den Wandlerbereich.', 'info'); }
      const nyq = Cv.fs / 2 * 0.97, near = Cv.wave !== 'dc' && Cv.fSig > Cv.fs / 2 * 0.9 && Cv.fSig <= Cv.fs / 2;
      if (near && !S.fAct) { S.fAct = true; ev('Knapp an der Nyquist-Grenze: Es gibt nur noch etwas mehr als zwei Abtastwerte pro Periode. Die Form lässt sich kaum noch erkennen.', 'info'); }
      else if (!near) S.fAct = false;
    }
    function stepCore(dtMs) {
      S.t += dtMs;
      S.tv += dtMs / 1000 * SLOW_SPS / Cv.fs;
      checkEvents();
    }
    function setControl(key, value) {
      const d = defOf[key]; if (!d) return;
      let v;
      if (d.type === 'switch' || d.type === 'button') v = !!value && value !== 'false' && value !== '0';
      else if (d.type === 'slider') { v = clamp(num(value, d.value), d.min, d.max); if (d.step >= 1) v = Math.round(v); }
      else { const o = d.options.find(x => String(x.value) === String(value)); v = o ? o.value : d.value; }
      Cv[key] = v;
    }
    function applyPreset(id) {
      const p = PRESETS.find(x => x.id === id); if (!p) return false;
      Object.keys(p.params).forEach(k => setControl(k, p.params[k]));
      return true;
    }
    function last() { const c = ensure(), k = Math.floor(S.tv * Cv.fs); return c.adc.sampleAt(k); }
    function readMeters() {
      const c = ensure(), s = last(), an = c.an;
      return { lsb: Cv.vref / Math.pow(2, Cv.bits) * 1000, quantErr: Cv.vref / Math.pow(2, Cv.bits) / Math.sqrt(12) * 1000, snr: an.snr, fAlias: aliasF(Cv.fSig, Cv.fs), enob: an.enob, code: s.code, uIn: clamp(s.v, 0, 5), nyquist: Cv.fs / 2 };
    }
    function state() {
      const c = ensure(), s = last(), an = c.an, ai = c.ai, faults = [], lsb = Cv.vref / Math.pow(2, Cv.bits);
      if (ai.aliasing) faults.push('aliasing'); if (an.clip) faults.push('clip');
      return {
        wave: Cv.wave, fSig: Cv.fSig, fs: Cv.fs, bits: Cv.bits, vref: Cv.vref, levels: Math.pow(2, Cv.bits), lsb, quantErr: lsb / Math.sqrt(12), quantErrMax: lsb / 2, quantErrMeas: an.errRms,
        snr: an.snr, snrIdeal: 6.02 * Cv.bits + 1.76, enob: an.enob, sigRms: an.sigRms, fAlias: aliasF(Cv.fSig, Cv.fs), nyquist: Cv.fs / 2, nyquistOk: Cv.fs > 2 * Cv.fSig || Cv.wave === 'dc',
        aliasing: ai.aliasing, aliasFreq: ai.alias, aliasSource: ai.worst, clipping: an.clip, peakHz: an.peakHz, peakDb: an.peakDb, peakAmp: an.peakAmp,
        code: s.code, uIn: s.v, uQ: s.xq, sampleIndex: Math.floor(S.tv * Cv.fs), sampleHold: Cv.sampleHold, aaf: Cv.aaf, minIn: an.min, maxIn: an.max,
        fault: faults.length > 0, faults, t: S.t
      };
    }

    // ---- Kennlinien ----
    function curves() {
      const c = ensure(), p = P(), A = c.adc, an = c.an, s = last(), lsb = A.lsb, n = A.n;
      // Treppenkennlinie: bei wenigen Stufen komplett, sonst Ausschnitt um den Betriebspunkt
      let c0 = 0, c1 = n;
      if (n > 16) { const cm = clamp(Math.floor(s.v / lsb), 0, n - 1); c0 = clamp(cm - 3, 0, n - 8); c1 = c0 + 8; }
      const ideal = [], stair = [];
      for (let k = c0; k < c1; k++) { stair.push([k * lsb, k]); stair.push([(k + 1) * lsb, k]); }
      stair.push([c1 * lsb, c1 - 1]);
      ideal.push([c0 * lsb, c0]); ideal.push([c1 * lsb, c1]);
      const spec = an.spec.map(q => [q[0], q[1]]);
      const bs = [], bi = [];
      for (let b = 4; b <= 16; b++) { const pp = Object.assign({}, p, { bits: b }); bs.push([b, analyze(pp, false).snr]); bi.push([b, 6.02 * b + 1.76]); }
      const af = [], afi = []; for (let f = 0; f <= 2 * p.fs; f += p.fs / 40) af.push([f, aliasF(f, p.fs)]);
      return [
        { id: 'treppe', title: n > 16 ? 'ADU-Treppenkennlinie (Ausschnitt, ' + Cv.bits + ' Bit)' : 'ADU-Treppenkennlinie (' + Cv.bits + ' Bit)', xLabel: 'Eingangsspannung', xUnit: 'V', yLabel: 'Zählwert', yUnit: 'Digit',
          series: [{ name: 'ADU (Treppe)', points: stair }, { name: 'ideal', points: ideal }], marker: { x: clamp(s.v, c0 * lsb, c1 * lsb), y: s.code } },
        { id: 'spektrum', title: 'Spektrum (DFT der Abtastwerte)', xLabel: 'Frequenz', xUnit: 'Hz', yLabel: 'Pegel', yUnit: 'dBFS', series: [{ name: 'Spektrum', points: spec }], marker: { x: an.peakHz, y: an.peakDb } },
        { id: 'snrbits', title: 'Störabstand über die Bitzahl', xLabel: 'Bitzahl', xUnit: 'Bit', yLabel: 'SNR', yUnit: 'dB', series: [{ name: 'ideal 6,02·n + 1,76', points: bi }, { name: 'mit deinem Signal', points: bs }], marker: { x: Cv.bits, y: an.snr } },
        { id: 'alias', title: 'Frequenzspiegelung', xLabel: 'Signalfrequenz', xUnit: 'Hz', yLabel: 'erscheint als', yUnit: 'Hz', series: [{ name: 'fAlias', points: af }], marker: { x: Cv.fSig, y: aliasF(Cv.fSig, Cv.fs) } }
      ];
    }

    // ================= Zeichnen =================
    const TP = { x: 14, y: 14, w: 636, h: 322 };
    function drawTime(ctx, t) {
      const c = ensure(), A = c.adc, p = P(), Ts = A.Ts, lsb = A.lsb;
      panel(ctx, TP.x, TP.y, TP.w, TP.h, 'ZEITBEREICH  Eingangssignal, Abtastwerte, Treppe, Rekonstruktion');
      const px = TP.x + 54, pw = TP.w - 70, py = TP.y + 34, ph = 184;
      const tR = S.tv + 1.5 * Ts, Tw = WINDOW_SAMPLES * Ts, tL = tR - Tw;
      const vmax = Math.max(p.vref * 1.1, 0.5);
      const X = tt => px + pw * (tt - tL) / Tw, Y = v => py + ph - clamp(v / vmax, -0.1, 1.15) * ph;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 6); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      // Stufenraster
      const lpx = ph * lsb / vmax;
      if (lpx >= 4) { ctx.strokeStyle = lpx >= 8 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; for (let k = 0; k <= A.n; k++) { const yy = Y(k * lsb); ctx.beginPath(); ctx.moveTo(px, yy); ctx.lineTo(px + pw, yy); ctx.stroke(); } }
      else { ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; for (let v = 0; v <= vmax; v += 0.5) { ctx.beginPath(); ctx.moveTo(px, Y(v)); ctx.lineTo(px + pw, Y(v)); ctx.stroke(); } }
      // Wandlerbereich
      ctx.strokeStyle = 'rgba(255,92,92,0.6)'; ctx.lineWidth = 1.5; if (ctx.setLineDash) ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(px, Y(p.vref)); ctx.lineTo(px + pw, Y(p.vref)); ctx.moveTo(px, Y(0)); ctx.lineTo(px + pw, Y(0)); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      // Abtastraster senkrecht
      const k0 = Math.floor(tL / Ts) - 1, k1 = Math.ceil(tR / Ts) + 1;
      ctx.strokeStyle = 'rgba(59,158,255,0.10)'; ctx.lineWidth = 1;
      for (let k = k0; k <= k1; k++) { const xx = X(k * Ts); ctx.beginPath(); ctx.moveTo(xx, py); ctx.lineTo(xx, py + ph); ctx.stroke(); }
      // Quantisierungsfehler-Band um das Eingangssignal
      const N = Math.floor(pw / 2);
      const pts = []; for (let i = 0; i <= N; i++) { const tt = tL + Tw * i / N; pts.push([px + pw * i / N, c.adc.analog(tt)]); }
      const bw = Math.max(lpx, 0);
      if (bw >= 1.5) {
        ctx.fillStyle = 'rgba(59,158,255,0.22)'; ctx.beginPath(); pts.forEach((q, i) => { const yy = Y(q[1]) - bw / 2; if (i) ctx.lineTo(q[0], yy); else ctx.moveTo(q[0], yy); }); for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0], Y(pts[i][1]) + bw / 2); ctx.closePath(); ctx.fill();
      }
      // Treppe (Halteglied)
      const smp = []; for (let k = k0 - 8; k <= k1 + 8; k++) smp.push(A.sampleAt(k));
      const sAt = k => smp[k - (k0 - 8)];
      ctx.strokeStyle = rgba(AMB, 0.95); ctx.lineWidth = 2.6; ctx.lineJoin = 'miter'; ctx.beginPath();
      for (let k = k0; k <= k1; k++) { const s = sAt(k), xa = X(k * Ts), xb = X((k + 1) * Ts), yy = Y(s.xq); if (k === k0) ctx.moveTo(xa, yy); else ctx.lineTo(xa, yy); ctx.lineTo(xb, yy); }
      ctx.stroke();
      // Eingang
      ctx.strokeStyle = rgba(BLUE, 1); ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((q, i) => { if (i) ctx.lineTo(q[0], Y(q[1])); else ctx.moveTo(q[0], Y(q[1])); }); ctx.stroke();
      // Rekonstruktion (ideale Interpolation mit si-Funktion)
      ctx.strokeStyle = rgba(GREEN, 1); ctx.lineWidth = 2.6; ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const tt = tL + Tw * i / N, kc = tt / Ts; let v = 0;
        const ka = Math.max(k0 - 7, Math.floor(kc) - 7), kb = Math.min(k1 + 7, Math.floor(kc) + 8);
        for (let k = ka; k <= kb; k++) { const d = kc - k, sc = Math.abs(d) < 1e-9 ? 1 : Math.sin(Math.PI * d) / (Math.PI * d); v += sAt(k).xq * sc; }
        const xx = px + pw * i / N, yy = Y(v); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      // Abtastpunkte
      for (let k = k0; k <= k1; k++) {
        const s = sAt(k), xx = X(k * Ts); if (xx < px - 8 || xx > px + pw + 8) continue;
        ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xx, Y(0)); ctx.lineTo(xx, Y(s.xq)); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xx, Y(s.xq), 4.5, 0, TWO_PI); ctx.fill(); ctx.strokeStyle = '#14181c'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      // aktueller Abtastzeitpunkt
      const nk = Math.floor(S.tv / Ts), ns = A.sampleAt(nk), nx = X(nk * Ts);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(nx, py); ctx.lineTo(nx, py + ph); ctx.stroke();
      ctx.restore();
      // Achsenbeschriftung
      txt(ctx, f1(p.vref, 1) + ' V', px - 6, Y(p.vref), 11, C.bad, 'right', true); txt(ctx, '0 V', px - 6, Y(0), 11, C.dim, 'right');
      txt(ctx, 'U', px - 6, py - 8, 11, C.dim, 'right'); txt(ctx, 'Zeit →  (Zeitlupe, 1 Raster = 1 Abtastwert = ' + f1(Ts * 1000, Ts < 0.001 ? 2 : 1) + ' ms)', px + pw, py + ph + 11, 10, C.dim, 'right');
      // Fehlerstreifen
      const ey = py + ph + 26, eh = 52;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, ey, pw, eh, 6); ctx.fill();
      txt(ctx, 'Quantisierungsfehler  ±LSB/2 = ±' + f1(lsb * 500, 2) + ' mV', px + 8, ey + 10, 10, C.dim, 'left', true);
      const em = Math.max(lsb * 0.75, 1e-9), EY = e => ey + eh / 2 - clamp(e / em, -1, 1) * (eh / 2 - 4);
      ctx.save(); ctx.beginPath(); ctx.rect(px, ey, pw, eh); ctx.clip();
      ctx.fillStyle = 'rgba(76,217,100,0.08)'; ctx.fillRect(px, EY(lsb / 2), pw, EY(-lsb / 2) - EY(lsb / 2));
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath(); ctx.moveTo(px, ey + eh / 2); ctx.lineTo(px + pw, ey + eh / 2); ctx.stroke();
      ctx.strokeStyle = rgba(AMB, 0.8); ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= N; i++) { const tt = tL + Tw * i / N, kk = Math.floor(tt / Ts), s = sAt(clamp(kk, k0 - 8, k1 + 8)); const e = s.xq - c.adc.analog(tt); const xx = px + pw * i / N; if (i) ctx.lineTo(xx, EY(e)); else ctx.moveTo(xx, EY(e)); }
      ctx.stroke();
      for (let k = k0; k <= k1; k++) { const s = sAt(k), xx = X(k * Ts); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(xx, EY(s.xq - s.v), 3, 0, TWO_PI); ctx.fill(); }
      ctx.restore();
      // Legende
      const ly = ey + eh + 14;
      const leg = [[BLUE, 'Eingang'], [[255, 255, 255], 'Abtastwerte'], [AMB, 'Halteglied-Treppe'], [GREEN, 'Rekonstruktion']];
      let lx = px; leg.forEach(l => { ctx.fillStyle = rgba(l[0], 1); ctx.fillRect(lx, ly - 3, 16, 6); txt(ctx, l[1], lx + 22, ly, 11, C.dim, 'left', true); lx += 36 + l[1].length * 6.4; });
      // Aliasing-Hinweis
      const ai = c.ai;
      if (ai.aliasing) {
        const blink = Math.floor(t / 400) % 2;
        ctx.fillStyle = 'rgba(255,92,92,0.16)'; rr(ctx, px + 8, py + 8, 310, 44, 8); ctx.fill(); ctx.strokeStyle = blink ? C.bad : C.warn; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, 'ALIASING!', px + 20, py + 22, 15, blink ? C.bad : C.warn, 'left', true);
        txt(ctx, f1(ai.worst, 0) + ' Hz erscheint als ' + f1(ai.alias, 0) + ' Hz (grün)', px + 20, py + 41, 12, C.text, 'left', true);
      }
      if (c.an.clip) txt(ctx, 'ÜBERSTEUERUNG', px + pw - 10, py + 14, 12, Math.floor(t / 300) % 2 ? C.bad : C.warn, 'right', true);
    }
    function drawSpec(ctx, t) {
      const x0 = 14, y0 = 346, w = 636, h = 202, c = ensure(), an = c.an, p = P();
      panel(ctx, x0, y0, w, h, 'SPEKTRUM  (DFT der Abtastwerte in dBFS, 0 … fs/2)');
      const px = x0 + 54, pw = w - 70, py = y0 + 30, ph = h - 62;
      ctx.fillStyle = '#0c1014'; rr(ctx, px, py, pw, ph, 6); ctx.fill();
      const dbLo = -110, dbHi = 0, X = f => px + pw * f / (p.fs / 2), Y = d => py + ph - (clamp(d, dbLo, dbHi) - dbLo) / (dbHi - dbLo) * ph;
      ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
      for (let d = dbLo; d <= 0; d += 20) { ctx.beginPath(); ctx.moveTo(px, Y(d)); ctx.lineTo(px + pw, Y(d)); ctx.stroke(); txt(ctx, String(d), px - 6, Y(d), 10, C.dim, 'right'); }
      // Rauschboden (ideal)
      const nf = -(6.02 * p.bits + 1.76) - 10 * Math.log10(NB / 2) + 10 * Math.log10(1.5);
      ctx.strokeStyle = 'rgba(255,179,64,0.45)'; ctx.lineWidth = 1.5; if (ctx.setLineDash) ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(px, Y(nf)); ctx.lineTo(px + pw, Y(nf)); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
      txt(ctx, 'Quantisierungs-Rauschboden', px + 6, Y(nf) - 8, 10, rgba(AMB, 0.9), 'left');
      ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
      const sp = an.spec;
      ctx.fillStyle = 'rgba(59,158,255,0.22)'; ctx.beginPath(); ctx.moveTo(X(sp[0][0]), py + ph);
      sp.forEach(q => ctx.lineTo(X(q[0]), Y(q[1]))); ctx.lineTo(X(sp[sp.length - 1][0]), py + ph); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = rgba(BLUE, 1); ctx.lineWidth = 2; ctx.beginPath(); sp.forEach((q, i) => { if (i) ctx.lineTo(X(q[0]), Y(q[1])); else ctx.moveTo(X(q[0]), Y(q[1])); }); ctx.stroke();
      ctx.restore();
      // Spitze
      if (p.wave !== 'dc') {
        const ax = X(clamp(an.peakHz, 0, p.fs / 2)), ay = Y(an.peakDb), ali = c.ai.aliasing;
        ctx.fillStyle = ali ? rgba(RED, 1) : rgba(GREEN, 1); ctx.beginPath(); ctx.moveTo(ax, ay - 4); ctx.lineTo(ax - 6, ay - 16); ctx.lineTo(ax + 6, ay - 16); ctx.closePath(); ctx.fill();
        txt(ctx, f1(an.peakHz, 0) + ' Hz', clamp(ax + 14, px + 4, px + pw - 50), Math.max(ay - 6, py + 40), 13, ali ? C.bad : C.ok, 'left', true);
        if (p.fSig > p.fs / 2) {
          ctx.strokeStyle = rgba(RED, 0.9); ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(px + pw - 4, py + 24); ctx.bezierCurveTo(px + pw - 30, py + 10, ax + 30, py + 8, ax, ay - 22); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]);
          txt(ctx, 'wahre Frequenz ' + f1(p.fSig, 0) + ' Hz  →  gespiegelt', px + pw - 8, py + 10, 11, C.bad, 'right', true);
        }
      }
      const nyt = [0, 0.25, 0.5, 0.75, 1];
      nyt.forEach(f => txt(ctx, f1(p.fs / 2 * f, 0), px + pw * f, py + ph + 12, 10, C.dim, f === 0 ? 'left' : f === 1 ? 'right' : 'center'));
      txt(ctx, 'Frequenz in Hz   (rechter Rand = Nyquist-Frequenz fs/2 = ' + f1(p.fs / 2, 0) + ' Hz)', px + pw / 2, py + ph + 28, 11, C.dim, 'center');
    }
    function drawChain(ctx, t) {
      const x0 = 666, y0 = 14, w = 324, h = 214, p = P(), c = ensure();
      panel(ctx, x0, y0, w, h, 'MESSKETTE');
      const boxes = [['Signal', '~', C.acc], ['Filter', Cv.aaf ? 'AAF' : '—', Cv.aaf ? C.ok : C.dim], ['S&H', Cv.sampleHold ? 'an' : 'aus', Cv.sampleHold ? C.ok : C.warn], ['ADU', Cv.bits + ' Bit', C.warn]];
      const bw = 62, gap = 18, by = y0 + 32, bh = 56;
      boxes.forEach((b, i) => {
        const x = x0 + 14 + i * (bw + gap);
        ctx.fillStyle = '#1a2026'; rr(ctx, x, by, bw, bh, 8); ctx.fill(); ctx.strokeStyle = b[2]; ctx.lineWidth = 2; ctx.stroke();
        txt(ctx, b[0], x + bw / 2, by + 16, 12, C.text, 'center', true); txt(ctx, b[1], x + bw / 2, by + 38, 14, b[2], 'center', true, MONO);
        if (i < 3) { ctx.strokeStyle = '#8b98a5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + bw + 2, by + bh / 2); ctx.lineTo(x + bw + gap - 4, by + bh / 2); ctx.stroke(); ctx.fillStyle = '#8b98a5'; ctx.beginPath(); ctx.moveTo(x + bw + gap - 1, by + bh / 2); ctx.lineTo(x + bw + gap - 8, by + bh / 2 - 4); ctx.lineTo(x + bw + gap - 8, by + bh / 2 + 4); ctx.fill(); }
        const ph = fr(t / 700 - i * 0.18);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; if (i < 3) { ctx.beginPath(); ctx.arc(x + bw + 2 + (gap - 6) * ph, by + bh / 2, 2.5, 0, TWO_PI); ctx.fill(); }
      });
      // Nyquist-Skala
      const sx = x0 + 18, sw = w - 36, sy = y0 + 150;
      const fmax = Math.max(p.fs, p.fSig * 1.1, 1);
      const X = f => sx + sw * Math.min(f, fmax) / fmax;
      txt(ctx, 'Frequenzen im Vergleich', x0 + 14, y0 + 108, 11, C.dim, 'left', true);
      ctx.fillStyle = '#0c1014'; rr(ctx, sx, sy - 8, sw, 16, 8); ctx.fill();
      ctx.fillStyle = 'rgba(76,217,100,0.25)'; ctx.fillRect(sx + 1, sy - 6, X(p.fs / 2) - sx - 1, 12);
      ctx.fillStyle = 'rgba(255,92,92,0.22)'; ctx.fillRect(X(p.fs / 2), sy - 6, sx + sw - X(p.fs / 2) - 1, 12);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(p.fs / 2), sy - 14); ctx.lineTo(X(p.fs / 2), sy + 14); ctx.stroke();
      txt(ctx, 'fs/2 = ' + f1(p.fs / 2, 0), X(p.fs / 2), sy + 26, 11, C.text, 'center', true);
      const al = aliasF(p.fSig, p.fs), over = p.fSig > p.fs / 2 && p.wave !== 'dc';
      ctx.fillStyle = over ? rgba(RED, 1) : rgba(GREEN, 1); ctx.beginPath(); ctx.arc(X(p.fSig), sy, 7, 0, TWO_PI); ctx.fill();
      txt(ctx, 'fSig ' + f1(p.fSig, 0), X(p.fSig), sy - 24, 12, over ? C.bad : C.ok, 'center', true);
      if (over) { ctx.fillStyle = rgba(AMB, 1); ctx.beginPath(); ctx.arc(X(al), sy, 6, 0, TWO_PI); ctx.fill(); txt(ctx, 'fAlias ' + f1(al, 0), clamp(X(al), sx + 24, sx + sw - 24), sy + (Math.abs(X(al) - X(p.fs / 2)) < 70 ? 42 : 26), 12, C.warn, 'center', true); ctx.strokeStyle = rgba(AMB, 0.9); ctx.lineWidth = 2; if (ctx.setLineDash) ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(p.fSig) - 6, sy - 6); ctx.quadraticCurveTo((X(p.fSig) + X(al)) / 2, sy - 36, X(al) + 4, sy - 8); ctx.stroke(); if (ctx.setLineDash) ctx.setLineDash([]); }
      txt(ctx, over ? 'fSig liegt über fs/2: Frequenzspiegelung!' : p.wave === 'dc' ? 'Gleichspannung: keine Abtastfrage' : 'fs > 2 · fSig: Abtasttheorem erfüllt', x0 + w / 2, y0 + h - 14, 12, over ? C.bad : C.ok, 'center', true);
    }
    function drawWord(ctx, t) {
      const x0 = 666, y0 = 238, w = 324, h = 310, c = ensure(), an = c.an, s = last(), p = P();
      panel(ctx, x0, y0, w, h, 'DIGITALES WORT  (letzter Abtastwert)');
      const n = p.bits, per = n > 8 ? Math.ceil(n / 2) : n, rows = n > 8 ? 2 : 1, sz = Math.min(30, (w - 28) / per - 4);
      for (let i = 0; i < n; i++) {
        const bit = (s.code >> (n - 1 - i)) & 1, r2 = Math.floor(i / per), cc = i % per;
        const x = x0 + 14 + cc * (sz + 4), y = y0 + 30 + r2 * (sz + 6);
        ctx.fillStyle = bit ? '#1d6b33' : '#1a2026'; rr(ctx, x, y, sz, sz, 5); ctx.fill(); ctx.strokeStyle = bit ? C.ok : '#3a444f'; ctx.lineWidth = 1.5; ctx.stroke();
        txt(ctx, String(bit), x + sz / 2, y + sz / 2, Math.max(10, sz * 0.5), bit ? '#fff' : C.dim, 'center', true, MONO);
        if (i === 0) txt(ctx, 'MSB', x + sz / 2, y - 6 + 0, 8, C.dim, 'center'); if (i === n - 1) txt(ctx, 'LSB', x + sz / 2, y + sz + 8 + (rows - 1 - r2) * 0, 8, C.dim, 'center');
      }
      const ty = y0 + 30 + rows * (sz + 6) + 14;
      txt(ctx, 'Zählwert ' + s.code + '   (0x' + s.code.toString(16).toUpperCase() + ')', x0 + 14, ty, 15, C.text, 'left', true, MONO);
      txt(ctx, 'U = ' + f1(clamp(s.v, -9, 9), 3) + ' V → N = ⌊U/Uref · 2^' + n + '⌋', x0 + 14, ty + 20, 11, C.dim, 'left', false, MONO);
      const rows2 = [
        ['LSB', f1(p.vref / Math.pow(2, n) * 1000, 3), 'mV', C.text], ['Quantisierungsfehler (eff.)', f1(p.vref / Math.pow(2, n) / Math.sqrt(12) * 1000, 3), 'mV', C.text],
        ['SNR gemessen', f1(an.snr, 1), 'dB', C.ok], ['SNR ideal 6,02·n+1,76', f1(6.02 * n + 1.76, 1), 'dB', C.dim],
        ['ENOB', f1(an.enob, 1), 'Bit', an.enob < n - 1.5 ? C.warn : C.ok], ['erscheint als', f1(aliasF(p.fSig, p.fs), 0), 'Hz', c.ai.aliasing ? C.bad : C.text]
      ];
      rows2.forEach((r2, k) => {
        const y = ty + 52 + k * 25;
        ctx.fillStyle = k % 2 ? 'transparent' : 'rgba(255,255,255,0.03)'; ctx.fillRect(x0 + 8, y - 11, w - 16, 23);
        txt(ctx, r2[0], x0 + 14, y, 12, C.dim, 'left', true); txt(ctx, r2[1], x0 + w - 56, y, 15, r2[3], 'right', true, MONO); txt(ctx, r2[2], x0 + w - 50, y, 11, C.dim, 'left');
      });
    }
    function drawTitle(ctx) { /* Titel steckt in den Feldueberschriften (Platz) */ }

    function draw(ctx, w, h, t) {
      t = num(t, 0); w = num(w, 0); h = num(h, 0);
      ctx.save();
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, Math.max(w, 0), Math.max(h, 0));
      if (w > 0 && h > 0) {
        const sc = Math.min(w / WW, h / WH);
        ctx.translate((w - WW * sc) / 2, (h - WH * sc) / 2); ctx.scale(sc, sc);
        ctx.fillStyle = '#171c21'; rr(ctx, 0, 0, WW, WH, 10); ctx.fill();
        drawTime(ctx, t); drawSpec(ctx, t); drawChain(ctx, t); drawWord(ctx, t);
      }
      ctx.restore();
    }
    function hitTest(px, py, w, h) {
      w = num(w, 0); h = num(h, 0); if (!(w > 0 && h > 0)) return null;
      const sc = Math.min(w / WW, h / WH);
      const x = (px - (w - WW * sc) / 2) / sc, y = (py - (h - WH * sc) / 2) / sc;
      const bx = i => 666 + 14 + i * 80;
      if (y > 46 && y < 102) { if (x > bx(1) && x < bx(1) + 62) return { key: 'aaf', kind: 'switch' }; if (x > bx(2) && x < bx(2) + 62) return { key: 'sampleHold', kind: 'switch' }; }
      return null;
    }
    function reset() { ctl.forEach(c => { Cv[c.key] = c.value; }); resetState(); }

    resetState();
    const rig = {
      id: 'adu', controls: ctl, meters: METERS.map(m => Object.assign({}, m)), presets: PRESETS,
      setControl, getControl: k => Cv[k], step(dtMs) { dtMs = num(dtMs, 0); if (dtMs > 0) stepCore(Math.min(dtMs, 5000)); },
      readMeters, state, draw, hitTest, curves, reset, events, worldSize: () => ({ w: WW, h: WH }), applyPreset
    };
    if (opts.controls) { Object.keys(opts.controls).forEach(k => setControl(k, opts.controls[k])); ensure(); }
    return rig;
  }

  R.register({
    id: 'adu', name: 'ADU und Abtastung', icon: '📈',
    info: 'Ein Analog-Digital-Umsetzer tastet das Signal ab und rundet es auf Stufen. Du siehst Abtastpunkte, Halteglied-Treppe, die rekonstruierte Kurve, den Quantisierungsfehler und das Spektrum. Stelle fs unter 2 · fSig und beobachte Aliasing: eine schnelle Welle erscheint als falsche langsame.',
    controls: CONTROLS, meters: METERS, presets: PRESETS, create
  });
  if (typeof module !== 'undefined') module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
