'use strict';
/* Tonfunk Lab "Signale und Systeme" (Kürzel sig): reine Rechenlogik, ohne Oberfläche, auch per Node testbar.
   Inhalt: Zahlen (deutsch), Signalformen und Kenngrößen, DFT (nach Definition) und FFT (Radix 2), Fenster, Abtastung und Aliasing,
   Filter 1. und 2. Ordnung (Frequenzgang, Sprungantwort), diskrete Faltung, Modulation (AM, FM).
   Alles ist eigenständig (keine Abhängigkeit von anderen Lab-Dateien). Winkel in Grad, Frequenzen in Hz, Zeiten in s.
   Konventionen:
   - Phase einer Welle in Perioden (0..1). Sinus startet bei 0 steigend, Dreieck ebenso (Spitze bei 1/4), Sägezahn steigt von -1 bis +1.
   - DFT: X[k] = Summe x[n] e^(-j 2 pi k n / N). Amplitudenspektrum einseitig: A[k] = 2|X[k]|/(N cg), DC und Nyquist nicht verdoppelt (cg = Fenster-Mittelwert).
   - Hann-Fenster periodisch (DFT-gerade): w[n] = 0,5 - 0,5 cos(2 pi n / N).
   - Filter: Tief-/Hochpass 1. Ordnung mit f0 = Grenzfrequenz; 2. Ordnung mit f0 und Güte Q (Q = 1/sqrt(2) ist Butterworth);
     Bandpass als Schwingkreis (order 2) mit Mittenfrequenz f0 und Güte Q; Bandpass aus Hochpass(fu) und Tiefpass(fo) (order 1 im Code; fachlich ebenfalls ein System 2. Ordnung mit Q unter 0,5), entkoppelt gedacht.
   Export: window.SIG_CORE bzw. module.exports (Node). */
(function (root) {
  const TAU = 2 * Math.PI;
  const fin = v => typeof v === 'number' && isFinite(v);

  /* ---------------- Zahlen deutsch ---------------- */
  const rd = (v, d) => { const f = Math.pow(10, d); const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * f + 1e-9) / f; };
  /* "1.234,5", "12,5 %", "3 kHz", "-2.5" -> Zahl; sonst NaN. Punkte sind Tausendertrenner, wenn ein Komma vorkommt oder mehrere Punkte da sind. */
  function parseDe(s, unit) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).replace(/[\s  ]+/g, '').replace('−', '-').replace('µ', 'u');
    const strip = ['%', 'db', '°', 'grad'].concat(unit ? [String(unit).replace('µ', 'u').replace(/\s+/g, '').toLowerCase()] : []);
    for (const u of strip) { if (u && s.toLowerCase().endsWith(u) && s.length > u.length) { s = s.slice(0, s.length - u.length); break; } }
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$|^[+\-]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  /* feste Nachkommastellen, Tausenderpunkt, echtes Minuszeichen */
  function fmtDe(v, dec) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    const neg = s[0] === '-'; if (neg) s = s.slice(1);
    const pp = s.split('.'); pp[0] = pp[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + pp.join(',');
  }
  /* gültige Stellen, überflüssige Nullen weg: fmt(1234.5678) = "1.235", fmt(0.0123456) = "0,01235" */
  function fmt(v, sig) {
    if (!fin(v)) return '–';
    if (v === 0) return '0';
    sig = sig || 4;
    const e = Math.floor(Math.log10(Math.abs(v)));
    const dec = Math.max(0, Math.min(12, sig - 1 - e));
    let s = fmtDe(v, dec);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  /* Frequenz mit passender Einheit */
  function fmtHz(f, sig) { if (!fin(f)) return '–'; const a = Math.abs(f); return a >= 1e6 ? fmt(f / 1e6, sig) + ' MHz' : a >= 1e3 ? fmt(f / 1e3, sig) + ' kHz' : fmt(f, sig) + ' Hz'; }
  function fmtS(t, sig) { if (!fin(t)) return '–'; const a = Math.abs(t); return a === 0 ? '0 s' : a >= 1 ? fmt(t, sig) + ' s' : a >= 1e-3 ? fmt(t * 1e3, sig) + ' ms' : a >= 1e-6 ? fmt(t * 1e6, sig) + ' µs' : fmt(t * 1e9, sig) + ' ns'; }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const pick = (R, a) => a[Math.floor(R() * a.length)];
  function gauss(R) { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * R()); }

  /* ---------------- Antworten prüfen ---------------- */
  /* Toleranz: größerer Wert aus relativ (Standard 1 %) und absolut (Einheit dB 0,1; Grad 0,5; Prozent 0,1; sonst 0) */
  function tolFor(v, unit, o) {
    o = o || {};
    const rel = o.rel == null ? 0.01 : o.rel;
    const abs = o.abs != null ? o.abs : (unit === 'dB' ? 0.1 : unit === '°' ? 0.5 : unit === '%' ? 0.1 : 0);
    return Math.max(rel * Math.abs(v), abs, 1e-9);
  }
  /* Ein einzelner Punkt mit genau drei Stellen danach (1.539) kann Dezimalpunkt oder Tausenderpunkt sein: beide Lesarten werden geprüft. */
  function checkNum(inp, v, tol, unit) {
    const x = parseDe(inp, unit);
    if (!fin(x)) return { ok: false, empty: String(inp == null ? '' : inp).trim() === '', nan: true };
    const tl = (tol == null ? 0 : tol) + 1e-12;
    if (Math.abs(x - v) <= tl) return { ok: true, x };
    const raw = String(inp).replace(/[\s  ]+/g, '').replace(/[^\d.,+\-−]+$/, '');
    if (/^[+\-−]?\d{1,3}\.\d{3}$/.test(raw)) { const y = x * 1000; if (Math.abs(y - v) <= tl) return { ok: true, x: y }; }
    return { ok: false, x };
  }

  /* ---------------- 1. Signalformen und Kenngrößen ---------------- */
  /* Einheitswelle: Phase p in Perioden; d = Tastverhältnis (nur Rechteck) */
  function wave(w, p, d) {
    p = p - Math.floor(p);
    switch (w) {
      case 'sin': return Math.sin(TAU * p);
      case 'rect': return p < (d == null ? 0.5 : d) ? 1 : -1;
      case 'tri': return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
      case 'saw': return 2 * p - 1;
      case 'dc': return 1;
    }
    return 0;
  }
  /* spec = { dc, comps:[{w,a,f,ph,d}], noise:{sigma,seed} }; continuous value (ohne Rauschen) */
  function valueAt(spec, t) {
    let v = spec.dc || 0;
    for (const c of spec.comps || []) v += (c.a || 0) * wave(c.w, (c.f || 0) * t + (c.ph || 0) / 360, c.d);
    return v;
  }
  /* N Abtastwerte bei fs; Rauschen deterministisch je Seed */
  function synth(spec, fs, N) {
    const x = new Float64Array(N), nz = spec.noise && spec.noise.sigma > 0 ? spec.noise : null, R = nz ? rng(nz.seed == null ? 1 : nz.seed) : null;
    for (let n = 0; n < N; n++) { let v = valueAt(spec, n / fs); if (nz) v += nz.sigma * gauss(R); x[n] = v; }
    return x;
  }
  /* Kenngrößen einer Welle (Amplitude a, optional Offset dc, Tastverhältnis d) analytisch.
     abs (Gleichrichtwert = Mittelwert von |u|) nur ohne Offset, sonst null. */
  function statWave(w, a, o) {
    o = o || {}; const dc = o.dc || 0, d = o.d == null ? 0.5 : o.d;
    let m0, q0, abs0;
    if (w === 'sin') { m0 = 0; q0 = a * a / 2; abs0 = 2 * a / Math.PI; }
    else if (w === 'rect') { m0 = a * (2 * d - 1); q0 = a * a; abs0 = Math.abs(a); }
    else if (w === 'tri' || w === 'saw') { m0 = 0; q0 = a * a / 3; abs0 = a / 2; }
    else return null;
    const mean = m0 + dc, ms = q0 + 2 * dc * m0 + dc * dc, rms = Math.sqrt(ms);
    const peak = Math.max(Math.abs(dc + a), Math.abs(dc - a));
    const abs = dc === 0 ? abs0 : null;
    return { mean, rms, abs, peak, crest: rms > 0 ? peak / rms : NaN, form: abs && abs > 0 ? rms / abs : null };
  }
  /* unipolarer Rechteckpuls 0..U mit Tastverhältnis D */
  function statPulse(U, D) {
    const mean = U * D, rms = U * Math.sqrt(D);
    return { mean, rms, abs: mean, peak: U, crest: 1 / Math.sqrt(D), form: Math.sqrt(D) / D };
  }
  /* Summe aus Gleichanteil und Sinus verschiedener Frequenzen: Effektivwert nach Parseval */
  function rmsMulti(dc, amps) { let s = (dc || 0) * (dc || 0); for (const a of amps) s += a * a / 2; return Math.sqrt(s); }
  /* numerisch aus Abtastwerten */
  function statNum(x) {
    const N = x.length; let s = 0, q = 0, ab = 0, mn = Infinity, mx = -Infinity;
    for (let i = 0; i < N; i++) { const v = x[i]; s += v; q += v * v; ab += Math.abs(v); if (v < mn) mn = v; if (v > mx) mx = v; }
    const mean = s / N, rms = Math.sqrt(q / N), abs = ab / N, peak = Math.max(Math.abs(mn), Math.abs(mx));
    return { mean, rms, abs, min: mn, max: mx, peak, crest: rms > 0 ? peak / rms : NaN, form: abs > 0 ? rms / abs : NaN };
  }
  /* genau eine Periode, Mittelpunktregel (sehr genau für stückweise lineare Wellen) */
  function statPeriodNum(w, a, o, N) {
    o = o || {}; N = N || 20000; const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = (o.dc || 0) + a * wave(w, (i + 0.5) / N, o.d);
    return statNum(x);
  }

  /* ---------------- 2. DFT, FFT, Fenster ---------------- */
  /* DFT nach Definition, O(N^2): Eingang re (und optional im), Ausgang {re, im} */
  function dft(xr, xi) {
    const N = xr.length, re = new Float64Array(N), im = new Float64Array(N), c = new Float64Array(N), s = new Float64Array(N);
    for (let m = 0; m < N; m++) { c[m] = Math.cos(TAU * m / N); s[m] = Math.sin(TAU * m / N); }
    for (let k = 0; k < N; k++) {
      let a = 0, b = 0;
      for (let n = 0; n < N; n++) {
        const m = (k * n) % N, vr = xr[n], vi = xi ? xi[n] : 0;
        a += vr * c[m] + vi * s[m]; b += vi * c[m] - vr * s[m];
      }
      re[k] = a; im[k] = b;
    }
    return { re, im };
  }
  const isPow2 = n => n > 0 && (n & (n - 1)) === 0;
  const twCache = {};
  function tw(N) {
    if (twCache[N]) return twCache[N];
    const c = new Float64Array(N / 2), s = new Float64Array(N / 2);
    for (let k = 0; k < N / 2; k++) { c[k] = Math.cos(TAU * k / N); s[k] = -Math.sin(TAU * k / N); }
    return (twCache[N] = { c, s });
  }
  /* FFT in place (Radix 2, Zeitbereich-Dezimation), Länge muss Zweierpotenz sein */
  function fft(re, im) {
    const N = re.length;
    if (!isPow2(N) || im.length !== N) throw new RangeError('FFT: Länge muss eine Zweierpotenz sein');
    for (let i = 1, j = 0; i < N; i++) {
      let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    const T = tw(N);
    for (let len = 2; len <= N; len <<= 1) {
      const half = len >> 1, step = N / len;
      for (let i = 0; i < N; i += len) {
        for (let k = 0, ti = 0; k < half; k++, ti += step) {
          const wr = T.c[ti], wi = T.s[ti], a = i + k, b = a + half;
          const xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
    return { re, im };
  }
  function ifft(re, im) {
    const N = re.length; for (let i = 0; i < N; i++) im[i] = -im[i];
    fft(re, im);
    for (let i = 0; i < N; i++) { re[i] /= N; im[i] = -im[i] / N; }
    return { re, im };
  }
  function fftReal(x) { const re = Float64Array.from(x), im = new Float64Array(x.length); return fft(re, im); }
  function win(type, N) {
    const w = new Float64Array(N);
    for (let n = 0; n < N; n++) w[n] = type === 'hann' ? 0.5 - 0.5 * Math.cos(TAU * n / N) : 1;
    return w;
  }
  const cgOf = w => { let s = 0; for (let i = 0; i < w.length; i++) s += w[i]; return s / w.length; };
  const enbwOf = w => { let s = 0, q = 0; for (let i = 0; i < w.length; i++) { s += w[i]; q += w[i] * w[i]; } return w.length * q / (s * s); };
  /* einseitiges Amplitudenspektrum (Länge N/2+1), auf die Amplitude einer Sinuslinie normiert */
  function ampSpec(x, wtype) {
    const N = x.length, w = win(wtype || 'rect', N), cg = cgOf(w), re = new Float64Array(N), im = new Float64Array(N);
    for (let n = 0; n < N; n++) re[n] = x[n] * w[n];
    fft(re, im);
    const a = new Float64Array(N / 2 + 1);
    for (let k = 0; k <= N / 2; k++) { const m = Math.hypot(re[k], im[k]) / (N * cg); a[k] = (k === 0 || k === N / 2) ? m : 2 * m; }
    return { a, cg, enbw: enbwOf(w), N };
  }
  /* Spektrum bei gebrochenem Bin kf direkt aus der Definition (DTFT-Auswertung), gleiche Normierung wie ampSpec (zweiseitig-halbiert wie k>0) */
  function dtftAmp(x, wtype, kf) {
    const N = x.length, w = win(wtype || 'rect', N), cg = cgOf(w); let a = 0, b = 0;
    for (let n = 0; n < N; n++) { const ph = TAU * kf * n / N, v = x[n] * w[n]; a += v * Math.cos(ph); b -= v * Math.sin(ph); }
    return 2 * Math.hypot(a, b) / (N * cg);
  }
  /* Lokale Maxima (a[k] > Nachbarn) über Schwelle, absteigend nach Amplitude */
  function peaks(a, fs, N, thr, maxn) {
    const out = [];
    for (let k = 1; k < a.length - 1; k++) if (a[k] >= thr && a[k] > a[k - 1] && a[k] >= a[k + 1]) out.push({ k, f: k * fs / N, a: a[k] });
    if (a[0] >= thr && a[0] > a[1]) out.push({ k: 0, f: 0, a: a[0] });
    out.sort((p, q) => q.a - p.a);
    return out.slice(0, maxn || 8);
  }
  const db20 = (r, floor) => { const v = 20 * Math.log10(Math.max(r, 1e-300)); return floor != null ? Math.max(v, floor) : v; };
  /* Dirichlet-Betrag: Rechteckfenster, Abstand delta (in Bins) von der Linie, N Punkte */
  function dirichlet(N, delta) { const s = Math.sin(Math.PI * delta / N); return Math.abs(delta) < 1e-12 ? 1 : Math.abs(Math.sin(Math.PI * delta) / (N * s)); }
  /* Amplitudenverlust (positiv, dB) einer Linie mit Abstand delta Bins vom Raster. Rechteck analytisch, Hann numerisch aus der Fensterdefinition. */
  function scallopDB(wtype, N, delta) {
    if (wtype === 'rect') return -db20(dirichlet(N, delta));
    const kb = N / 8, x = new Float64Array(N); for (let n = 0; n < N; n++) x[n] = Math.cos(TAU * (kb + delta) * n / N);
    return -db20(dtftAmp(x, wtype, kb));   /* Anzeige im Bin kb, Linie liegt delta Bins daneben */
  }
  /* Amplitude der n-ten Oberschwingung (Fourier-Reihe) für Rechteck (Tastverhältnis d), Dreieck, Sägezahn */
  function harm(w, a, n, d) {
    if (w === 'rect') return Math.abs(4 * a / (n * Math.PI) * Math.sin(n * Math.PI * (d == null ? 0.5 : d)));
    if (w === 'tri') return n % 2 === 1 ? 8 * a / (n * n * Math.PI * Math.PI) : 0;
    if (w === 'saw') return 2 * a / (n * Math.PI);
    if (w === 'sin') return n === 1 ? a : 0;
    return 0;
  }

  /* ---------------- 3. Abtastung, Aliasing, Quantisierung ---------------- */
  const nyquist = fs => fs / 2;
  /* Scheinbare Frequenz einer Abtastung (vorzeichenbehaftet: Minus = Umlaufsinn/Phase gedreht) */
  const aliasSigned = (f, fs) => f - Math.round(f / fs) * fs;
  const alias = (f, fs) => Math.abs(aliasSigned(f, fs));
  const sinc = x => Math.abs(x) < 1e-12 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
  /* Rekonstruktion: xs[i] liegt bei t = (i + i0)/fs; mode 'sinc' (ideal, endlich viele Terme), 'zoh' (Treppe), 'lin' (Linienzug) */
  function reconstruct(xs, fs, t, mode, i0) {
    i0 = i0 || 0; const u = t * fs - i0;
    if (mode === 'zoh') { const i = Math.floor(u + 1e-9); return i < 0 || i >= xs.length ? NaN : xs[i]; }
    if (mode === 'lin') { const i = Math.floor(u); if (i < 0 || i + 1 >= xs.length) return NaN; const q = u - i; return xs[i] * (1 - q) + xs[i + 1] * q; }
    let s = 0; for (let i = 0; i < xs.length; i++) s += xs[i] * sinc(u - i);
    return s;
  }
  const snrIdeal = bits => 6.02 * bits + 1.76;
  const lsb = (vref, bits) => vref / Math.pow(2, bits);
  /* idealer Mid-Tread-Quantisierer für +-vpk mit 2^bits Stufen */
  function quant(v, bits, vpk) { const q = 2 * vpk / Math.pow(2, bits); return q * Math.round(v / q); }

  /* ---------------- 4. Filter ---------------- */
  /* Filterbeschreibung: type 'lp'|'hp'|'bp', order 1|2; lp/hp Ordnung 1: f0 = Grenzfrequenz; Ordnung 2: f0, Q; bp Ordnung 2: f0, Q; bp Ordnung 1: fu, fo */
  function mkFilter(type, order, o) {
    o = o || {};
    const F = { type, order };
    if (type === 'bp' && order === 1) { F.fu = o.fu; F.fo = o.fo; } else { F.f0 = o.f0; if (order === 2) F.Q = o.Q == null ? Math.SQRT1_2 : o.Q; }
    return F;
  }
  const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  function H1(kind, x) { const d = 1 + x * x; return kind === 'lp' ? { re: 1 / d, im: -x / d } : { re: x * x / d, im: x / d }; }
  /* komplexer Frequenzgang */
  function H(F, f) {
    if (F.type === 'bp' && F.order === 1) return cmul(H1('hp', f / F.fu), H1('lp', f / F.fo));
    const x = f / F.f0;
    if (F.order === 1) return H1(F.type, x);
    const dr = 1 - x * x, di = x / F.Q, den = dr * dr + di * di;
    if (F.type === 'lp') return { re: dr / den, im: -di / den };
    if (F.type === 'hp') return { re: -x * x * dr / den, im: x * x * di / den };
    return { re: x / F.Q * di / den, im: x / F.Q * dr / den };   /* bp: j x/Q / (dr + j di) */
  }
  const mag = (F, f) => { const h = H(F, f); return Math.hypot(h.re, h.im); };
  const magDB = (F, f) => db20(mag(F, f), -300);
  function phase(F, f) {
    if (f <= 0) return F.type === 'lp' ? 0 : F.type === 'hp' ? 90 * F.order : 90;   /* Grenzwert f -> 0 */
    const h = H(F, f); return Math.atan2(h.im, h.re) * 180 / Math.PI;
  }
  /* -3-dB-Frequenzen (bezogen auf die Durchlassverstärkung), aufsteigend sortiert, analytisch */
  function cutoffs(F) {
    if (F.type === 'bp' && F.order === 1) {
      const fu = F.fu, fo = F.fo, g = fo / (fu + fo), h2 = g * g / 2;
      const a = h2, b = h2 * (fu * fu + fo * fo) - fo * fo, c = h2 * fu * fu * fo * fo, dd = Math.sqrt(b * b - 4 * a * c);
      return [Math.sqrt((-b - dd) / (2 * a)), Math.sqrt((-b + dd) / (2 * a))];
    }
    if (F.order === 1) return [F.f0];
    const Q = F.Q;
    if (F.type === 'bp') { const s = Math.sqrt(1 + 1 / (4 * Q * Q)), q = 1 / (2 * Q); return [F.f0 * (s - q), F.f0 * (s + q)]; }
    const k = 1 / (Q * Q) - 2, x2 = (-k + Math.sqrt(k * k + 4)) / 2, r = Math.sqrt(x2);
    return [F.type === 'lp' ? F.f0 * r : F.f0 / r];
  }
  /* Maximalverstärkung im Durchlassbereich (Betrag): lp/hp 1; 2. Ordnung lp/hp mit Überhöhung bei Q > 1/sqrt2 */
  function peakGain(F) {
    if (F.type === 'bp') return F.order === 1 ? F.fo / (F.fu + F.fo) : 1;
    if (F.order === 1) return 1;
    const Q = F.Q; if (Q <= Math.SQRT1_2) return 1;
    return Q / Math.sqrt(1 - 1 / (4 * Q * Q));
  }
  /* Frequenzraster (logarithmisch) mit Betrag in dB und Phase */
  function bode(F, fmin, fmax, n) {
    const f = new Float64Array(n), db = new Float64Array(n), ph = new Float64Array(n), l0 = Math.log10(fmin), l1 = Math.log10(fmax);
    for (let i = 0; i < n; i++) { f[i] = Math.pow(10, l0 + (l1 - l0) * i / (n - 1)); db[i] = magDB(F, f[i]); ph[i] = phase(F, f[i]); }
    return { f, db, ph };
  }
  /* Tiefpass 1. Ordnung: Frequenz, bei der die Dämpfung att dB erreicht */
  const lp1FreqForAtt = (fg, att) => fg * Math.sqrt(Math.pow(10, att / 10) - 1);
  /* Übergangsgrößen */
  const overshoot = Q => { if (Q <= 0.5) return 0; const z = 1 / (2 * Q); return Math.exp(-Math.PI * z / Math.sqrt(1 - z * z)); };
  const riseLP1 = f0 => Math.log(9) / (TAU * f0);
  /* Sprungantwort (Einheitssprung bei t = 0) auf gleichmäßigem Zeitraster t_i = i*dt (i = 0..n-1), numerisch mit RK4.
     u(t) darf eine beliebige Eingangsfunktion sein (Standard: Einheitssprung). Gibt Float64Array(n) zurück. */
  function respond(F, n, dt, u) {
    u = u || (() => 1);
    const out = new Float64Array(n);
    let w0, order = F.order;
    const bp1 = F.type === 'bp' && order === 1;
    if (bp1) w0 = TAU * Math.max(F.fu, F.fo); else w0 = TAU * F.f0;
    const m = Math.max(1, Math.ceil(dt * w0 / 0.04)), h = dt / m;
    let s = bp1 ? [0, 0] : order === 1 ? [0] : [0, 0];
    /* Ableitung der Zustände; Ausgang y */
    const w = bp1 ? 0 : TAU * F.f0, Q = F.Q, wu = bp1 ? TAU * F.fu : 0, wo = bp1 ? TAU * F.fo : 0;
    const der = (st, t) => {
      const ut = u(t);
      if (bp1) return [wu * (ut - st[0]), wo * ((ut - st[0]) - st[1])];
      if (order === 1) return [w * (ut - st[0])];
      return [st[1], w * w * (ut - st[0]) - (w / Q) * st[1]];
    };
    const outOf = (st, t) => {
      const ut = u(t);
      if (bp1) return st[1];
      if (order === 1) return F.type === 'lp' ? st[0] : ut - st[0];
      if (F.type === 'lp') return st[0];
      if (F.type === 'bp') return st[1] / (Q * w);
      return (ut - st[0]) - st[1] / (Q * w);
    };
    let t = 0;
    for (let i = 0; i < n; i++) {
      out[i] = outOf(s, t);
      for (let j = 0; j < m; j++) {
        const k1 = der(s, t), k2 = der(s.map((v, q) => v + h / 2 * k1[q]), t + h / 2), k3 = der(s.map((v, q) => v + h / 2 * k2[q]), t + h / 2), k4 = der(s.map((v, q) => v + h * k3[q]), t + h);
        s = s.map((v, q) => v + h / 6 * (k1[q] + 2 * k2[q] + 2 * k3[q] + k4[q]));
        t += h;
      }
    }
    return out;
  }
  /* Tiefpass 1. Ordnung für Abtastwerte (exakte Diskretisierung), z. B. für die Hüllkurvendemodulation */
  function lp1Samples(x, dt, f0) {
    const a = 1 - Math.exp(-TAU * f0 * dt), y = new Float64Array(x.length); let s = x.length ? x[0] : 0;
    for (let i = 0; i < x.length; i++) { s += a * (x[i] - s); y[i] = s; }
    return y;
  }
  /* Kennwerte einer Sprungantwort y(t_i): Endwert (letzter Wert), Maximum, Überschwingen bezogen auf den Endwert, Zeit 10..90 % */
  function stepMetrics(y, dt) {
    const fv = y[y.length - 1]; let mx = -Infinity, t10 = null, t90 = null;
    for (let i = 0; i < y.length; i++) { if (y[i] > mx) mx = y[i]; if (t10 == null && y[i] >= 0.1 * fv) t10 = i * dt; if (t90 == null && y[i] >= 0.9 * fv) t90 = i * dt; }
    return { final: fv, max: mx, over: fv > 1e-9 ? Math.max(0, mx / fv - 1) : 0, rise: t10 != null && t90 != null ? t90 - t10 : null };
  }

  /* ---------------- 5. Diskrete Faltung ---------------- */
  function conv(x, h) {
    const N = x.length, M = h.length; if (!N || !M) return [];
    const y = new Array(N + M - 1).fill(0);
    for (let n = 0; n < y.length; n++) for (let k = 0; k < N; k++) { const j = n - k; if (j >= 0 && j < M) y[n] += x[k] * h[j]; }
    return y;
  }
  /* Summanden von y[n] = Summe x[k] h[n-k] (nur Terme mit gültigen Indizes) */
  function convTerms(x, h, n) {
    const t = [];
    for (let k = 0; k < x.length; k++) { const j = n - k; if (j >= 0 && j < h.length) t.push({ k, j, x: x[k], h: h[j], p: x[k] * h[j] }); }
    return t;
  }
  /* Schnelle Faltung über FFT (Nullenergänzung auf Zweierpotenz) */
  function convFFT(x, h) {
    const L = x.length + h.length - 1; let N = 1; while (N < L) N <<= 1;
    const ar = new Float64Array(N), ai = new Float64Array(N), br = new Float64Array(N), bi = new Float64Array(N);
    x.forEach((v, i) => { ar[i] = v; }); h.forEach((v, i) => { br[i] = v; });
    fft(ar, ai); fft(br, bi);
    for (let i = 0; i < N; i++) { const r = ar[i] * br[i] - ai[i] * bi[i], q = ar[i] * bi[i] + ai[i] * br[i]; ar[i] = r; ai[i] = q; }
    ifft(ar, ai);
    return Array.from(ar.slice(0, L));
  }

  /* ---------------- 6. Modulation ---------------- */
  const amAt = (p, t) => p.Ac * (1 + p.m * Math.cos(TAU * p.fm * t)) * Math.cos(TAU * p.fc * t);
  const fmAt = (p, t) => p.Ac * Math.cos(TAU * p.fc * t + (p.df / p.fm) * Math.sin(TAU * p.fm * t));
  const amLines = p => [{ f: p.fc - p.fm, a: p.m * p.Ac / 2, name: 'unteres Seitenband' }, { f: p.fc, a: p.Ac, name: 'Träger' }, { f: p.fc + p.fm, a: p.m * p.Ac / 2, name: 'oberes Seitenband' }];
  const amEta = m => m * m / (2 + m * m);
  const carson = (df, fm) => 2 * (df + fm);
  /* Besselfunktion J_n(x), Potenzreihe (für |x| bis ca. 20 gut genug) */
  function besselJ(n, x) {
    n = Math.abs(n); let term = Math.pow(x / 2, n), fac = 1; for (let i = 2; i <= n; i++) fac *= i; term /= fac;
    let s = term; for (let m = 1; m < 80; m++) { term *= -(x * x / 4) / (m * (m + n)); s += term; if (Math.abs(term) < 1e-17 * Math.abs(s) && m > 3) break; }
    return s;
  }
  /* Seitenlinien eines FM-Signals: n = -nmax..nmax, a = Ac |J_n(beta)| */
  function fmLines(p, nmax) {
    const beta = p.df / p.fm, out = [];
    for (let n = -nmax; n <= nmax; n++) out.push({ n, f: p.fc + n * p.fm, a: p.Ac * Math.abs(besselJ(n, beta)) });
    return out;
  }
  /* Hüllkurvendemodulation: Gleichrichten, Tiefpass 1. Ordnung (fg etwa zwischen fm und fc) */
  function envelope(x, fs, fg) { const r = new Float64Array(x.length); for (let i = 0; i < x.length; i++) r[i] = Math.abs(x[i]); const y = lp1Samples(r, 1 / fs, fg); for (let i = 0; i < y.length; i++) y[i] *= Math.PI / 2; return y; }

  const api = {
    TAU, fin, rd, parseDe, fmtDe, fmt, fmtHz, fmtS, hashStr, rng, ri, pick, gauss, tolFor, checkNum,
    wave, valueAt, synth, statWave, statPulse, rmsMulti, statNum, statPeriodNum,
    dft, fft, ifft, fftReal, isPow2, win, cgOf, enbwOf, ampSpec, dtftAmp, peaks, db20, dirichlet, scallopDB, harm,
    nyquist, alias, aliasSigned, sinc, reconstruct, snrIdeal, lsb, quant,
    mkFilter, H, mag, magDB, phase, cutoffs, peakGain, bode, lp1FreqForAtt, overshoot, riseLP1, respond, lp1Samples, stepMetrics,
    conv, convTerms, convFFT,
    amAt, fmAt, amLines, amEta, carson, besselJ, fmLines, envelope
  };
  root.SIG_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
