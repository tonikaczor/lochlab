/* rg2core.js - Regelungstechnik Aufbau (Studium): reine Rechenlogik, headless testbar (node), keine DOM-Zugriffe.
 * Inhalt: Polynome und Wurzeln, Übertragungsfunktionen (s-Bereich), Totzeit-Padé, Sprungantwort (exakte Zustandsraum-Diskretisierung),
 * Kenngrößen (Überschwingen, Anregelzeit, Ausregelzeit), Bode (Betrag, Phase, Asymptoten), Reserven, Nyquist (vereinfacht),
 * Wurzelortskurve, Reglerentwurf (Betragsoptimum, symmetrisches Optimum, Ziegler-Nichols, Chien-Hrones-Reswick), digitale Regelung (z-Bereich).
 * Konvention: Polynome als Koeffizientenfelder mit der höchsten Potenz zuerst, Komplexe Zahlen als {re, im}. Zeiten in s, Frequenzen in rad/s.
 * Alle Zahlen der Aufgaben kommen aus diesem Kern; der Test (quelle/rg2/test_rg2core.js, test_rg2data.js) rechnet sie unabhängig nach. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RG2 = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const PI = Math.PI, DEG = 180 / PI;
  const fin = x => typeof x === 'number' && isFinite(x);

  /* ===================================================================== Komplexe Zahlen */
  const cx = (re, im) => ({ re: re, im: im || 0 });
  const cadd = (a, b) => ({ re: a.re + b.re, im: a.im + b.im });
  const csub = (a, b) => ({ re: a.re - b.re, im: a.im - b.im });
  const cmul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d }; };
  const cabs = a => Math.hypot(a.re, a.im);
  const carg = a => Math.atan2(a.im, a.re);
  const cexp = a => { const e = Math.exp(a.re); return { re: e * Math.cos(a.im), im: e * Math.sin(a.im) }; };

  /* ===================================================================== Polynome (höchste Potenz zuerst) */
  const ptrim = p => { let i = 0; while (i < p.length - 1 && p[i] === 0) i++; return p.slice(i); };
  const padd = (a, b) => {
    const n = Math.max(a.length, b.length), r = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) r[n - a.length + i] += a[i];
    for (let i = 0; i < b.length; i++) r[n - b.length + i] += b[i];
    return ptrim(r);
  };
  const pscale = (a, k) => a.map(x => x * k);
  const pmul = (a, b) => {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
    return ptrim(r);
  };
  const ppow = (a, k) => { let r = [1]; for (let i = 0; i < k; i++) r = pmul(r, a); return r; };
  const pdeg = a => ptrim(a).length - 1;
  const peval = (p, z) => { let r = { re: 0, im: 0 }; for (let i = 0; i < p.length; i++) r = cadd(cmul(r, z), { re: p[i], im: 0 }); return r; };
  const pevalR = (p, x) => { let r = 0; for (let i = 0; i < p.length; i++) r = r * x + p[i]; return r; };
  const pder = p => { const n = p.length - 1; if (n < 1) return [0]; return p.slice(0, n).map((c, i) => c * (n - i)); };
  const pfromRoots = (rts, lead) => {   // reelles Polynom aus Wurzeln (komplexe Paare müssen beide enthalten sein)
    let r = [{ re: lead == null ? 1 : lead, im: 0 }];
    rts.forEach(z => {
      const n = r.length, o = new Array(n + 1).fill(null).map(() => ({ re: 0, im: 0 }));
      for (let i = 0; i < n; i++) { o[i] = cadd(o[i], r[i]); o[i + 1] = csub(o[i + 1], cmul(r[i], z)); }
      r = o;
    });
    return r.map(c => c.re);
  };

  /* Nullstellen (Aberth-Verfahren mit Skalierung; Grad 1 und 2 geschlossen; Nullstellen bei 0 exakt) */
  function roots(pIn) {
    let p = ptrim(pIn.slice());
    const out = [];
    while (p.length > 1 && p[p.length - 1] === 0) { out.push({ re: 0, im: 0 }); p.pop(); }
    const n = p.length - 1;
    if (n >= 1) {
      if (n === 1) out.push({ re: -p[1] / p[0], im: 0 });
      else if (n === 2) {
        const a = p[0], b = p[1], c = p[2], disc = b * b - 4 * a * c;
        if (disc >= 0) {
          const sq = Math.sqrt(disc), q = -0.5 * (b + (b >= 0 ? sq : -sq));
          const r1 = q / a, r2 = q !== 0 ? c / q : 0;
          out.push({ re: r1, im: 0 }, { re: r2, im: 0 });
        } else { const re = -b / (2 * a), im = Math.sqrt(-disc) / (2 * Math.abs(a)); out.push({ re: re, im: im }, { re: re, im: -im }); }
      } else {
        const r = Math.pow(Math.abs(p[n] / p[0]), 1 / n) || 1;
        const q = p.map((c, i) => c / (p[0] * Math.pow(r, i)));          // Wurzeln von q liegen etwa bei Betrag 1
        const dq = pder(q);
        let z = []; for (let k = 0; k < n; k++) { const a = 2 * PI * k / n + 0.4, rad = 0.9 + 0.2 * (k % 3) / 2; z.push({ re: rad * Math.cos(a), im: rad * Math.sin(a) }); }
        for (let it = 0; it < 500; it++) {
          let mx = 0;
          for (let k = 0; k < n; k++) {
            const pv = peval(q, z[k]), dv = peval(dq, z[k]);
            if (cabs(pv) === 0) continue;
            const ratio = cdiv(pv, dv);
            let s = { re: 0, im: 0 };
            for (let j = 0; j < n; j++) if (j !== k) s = cadd(s, cdiv({ re: 1, im: 0 }, csub(z[k], z[j])));
            const w = cdiv(ratio, csub({ re: 1, im: 0 }, cmul(ratio, s)));
            z[k] = csub(z[k], w);
            mx = Math.max(mx, cabs(w) / (1 + cabs(z[k])));
          }
          if (mx < 1e-15) break;
        }
        for (let k = 0; k < n; k++) {   // Newton-Nachschliff, kleine Imaginärteile von Mehrfachwurzeln und Rundung entfernen
          for (let it = 0; it < 3; it++) { const dv = peval(dq, z[k]); if (cabs(dv) > 0) { const st = cdiv(peval(q, z[k]), dv); if (cabs(st) < 1e-3) z[k] = csub(z[k], st); } }
          if (Math.abs(z[k].im) < 1e-9 * Math.max(1, Math.abs(z[k].re))) z[k].im = 0;
          out.push({ re: z[k].re * r, im: z[k].im * r });
        }
      }
    }
    out.sort((a, b) => (b.re - a.re) || (b.im - a.im));
    return out;
  }

  /* ===================================================================== Übertragungsfunktionen */
  const tf = (num, den, delay) => ({ num: ptrim(num.slice()), den: ptrim(den.slice()), delay: delay || 0 });
  const tfMul = (a, b) => ({ num: pmul(a.num, b.num), den: pmul(a.den, b.den), delay: (a.delay || 0) + (b.delay || 0) });
  const tfAdd = (a, b) => ({ num: padd(pmul(a.num, b.den), pmul(b.num, a.den)), den: pmul(a.den, b.den), delay: 0 });
  const tfGain = (a, k) => ({ num: pscale(a.num, k), den: a.den.slice(), delay: a.delay || 0 });
  const gainOf = a => { const n = ptrim(a.num), d = ptrim(a.den); return n[0] / d[0]; };
  const tfPoles = a => roots(a.den);
  const tfZeros = a => roots(a.num);
  /* statische Verstärkung G(0): Betrag unendlich, wenn Pol bei 0 */
  function dcGain(a) {
    const n = ptrim(a.num), d = ptrim(a.den);
    const n0 = n[n.length - 1], d0 = d[d.length - 1];
    if (d0 === 0) return n0 === 0 ? NaN : (n0 > 0 ? Infinity : -Infinity) * Math.sign(d[0] || 1);
    return n0 / d0;
  }

  /* Bausteine */
  const pt1 = (K, T) => tf([K], [T, 1]);
  const pt2 = (K, w0, D) => tf([K * w0 * w0], [1, 2 * D * w0, w0 * w0]);
  const integrator = Ki => tf([Ki], [1, 0]);
  const dt1 = (Kd, T1) => tf([Kd, 0], [T1, 1]);
  const ptn = (K, Ts) => tf([K], Ts.reduce((p, T) => pmul(p, [T, 1]), [1]));     // K / Π(1 + s T_i)
  const itn = (Ki, Ts) => tf([Ki], Ts.reduce((p, T) => pmul(p, [T, 1]), [1, 0])); // Ki / (s Π(1 + s T_i))
  const withDelay = (a, Td) => ({ num: a.num.slice(), den: a.den.slice(), delay: Td });

  /* Totzeit-Padé der Ordnung n: e^(-sT) ~ N(s)/D(s) */
  function padeCoeffs(n, T) {
    const fact = k => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
    const d = [], nu = [];
    for (let k = 0; k <= n; k++) { const c = fact(2 * n - k) * fact(n) / (fact(2 * n) * fact(k) * fact(n - k)) * Math.pow(T, k); d[k] = c; nu[k] = (k % 2 ? -c : c); }
    return { num: nu.slice().reverse(), den: d.slice().reverse() };
  }
  function withPade(a, n) {
    const Td = a.delay || 0; if (!(Td > 0)) return { num: a.num.slice(), den: a.den.slice(), delay: 0 };
    const pd = padeCoeffs(n || 2, Td);
    return { num: pmul(a.num, pd.num), den: pmul(a.den, pd.den), delay: 0 };
  }

  /* Regler */
  /* parallele (ideale) Form mit DT1-Filter: Kp (1 + 1/(Tn s) + Tv s/(1+Tf s)); Tn = Infinity oder 0 lässt den I-Anteil weg, Tv = 0 den D-Anteil */
  function pidTF(Kp, Tn, Tv, Tf) {
    let c = tf([1], [1]);
    if (Tn > 0 && isFinite(Tn)) c = tfAdd(c, tf([1], [Tn, 0]));
    if (Tv > 0) { const f = Tf > 0 ? Tf : Tv / 10; c = tfAdd(c, tf([Tv, 0], [f, 1])); }
    return tfGain(c, Kp);
  }
  /* Reihenform (für den Entwurf): Kp (1 + s Tn)(1 + s Tv)/(s Tn) */
  const pidSeries = (Kp, Tn, Tv) => tf(pscale(pmul([Tn, 1], [Tv, 1]), Kp), [Tn, 0]);
  const piTF = (Kp, Tn) => tf(pscale([Tn, 1], Kp), [Tn, 0]);

  /* Rückführung: Führung T = L/(1+L), Störung am Streckeneingang Tz = G/(1+C G) */
  function feedbackW(G, C, padeN) {
    const g = withPade(G, padeN), c = withPade(C, padeN);
    const num = pmul(g.num, c.num), den = padd(pmul(g.den, c.den), num);
    return { num: num, den: den, delay: 0 };
  }
  function feedbackZ(G, C, padeN) {
    const g = withPade(G, padeN), c = withPade(C, padeN);
    return { num: pmul(g.num, c.den), den: padd(pmul(g.den, c.den), pmul(g.num, c.num)), delay: 0 };
  }
  const closedLoop = (L, padeN) => { const l = withPade(L, padeN || 3); return { num: l.num, den: padd(l.den, l.num), delay: 0 }; };

  /* Stabilität aus den Polen: 'stabil' | 'grenzstabil' | 'instabil' */
  function stabilityOfPoles(ps) {
    if (!ps.length) return { cls: 'stabil', maxRe: -Infinity, nRhp: 0, nAxis: 0 };
    const sc = Math.max(1e-300, ...ps.map(cabs)), tol = 1e-7 * sc;
    let nRhp = 0, nAxis = 0, maxRe = -Infinity, zeroMult = 0;
    ps.forEach(p => {
      if (p.re > maxRe) maxRe = p.re;
      if (p.re > tol) nRhp++; else if (p.re >= -tol) { nAxis++; }
    });
    // auf der Achse: mehrfache Pole (gleiche Lage) sind instabil, einfache grenzstabil
    const axis = ps.filter(p => p.re <= tol && p.re >= -tol);
    let multi = false;
    for (let i = 0; i < axis.length; i++) for (let j = i + 1; j < axis.length; j++) if (Math.abs(axis[i].im - axis[j].im) < 1e-6 * sc && Math.abs(axis[i].im) >= 0) multi = true;
    // Paare ±jw zählen als einfach: Mehrfachheit nur, wenn gleiche Lage
    const cls = nRhp > 0 || multi ? 'instabil' : (nAxis > 0 ? 'grenzstabil' : 'stabil');
    return { cls: cls, maxRe: maxRe, nRhp: nRhp, nAxis: nAxis };
  }
  const stabilityOf = a => stabilityOfPoles(roots(a.den));

  /* ===================================================================== Zustandsraum, Matrix-Exponentialfunktion */
  function matMul(A, B) {
    const n = A.length, m = B[0].length, k = B.length, R = [];
    for (let i = 0; i < n; i++) { R.push(new Array(m).fill(0)); for (let j = 0; j < m; j++) { let s = 0; for (let l = 0; l < k; l++) s += A[i][l] * B[l][j]; R[i][j] = s; } }
    return R;
  }
  function expm(M) {
    const n = M.length;
    let nrm = 0; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += Math.abs(M[i][j]); nrm = Math.max(nrm, s); }
    let sq = 0; if (nrm > 0.5) sq = Math.max(0, Math.ceil(Math.log2(nrm / 0.5)));
    const sc = Math.pow(2, -sq), A = M.map(r => r.map(x => x * sc));
    let E = M.map((r, i) => r.map((_, j) => (i === j ? 1 : 0))), T = E.map(r => r.slice());
    for (let k = 1; k <= 20; k++) { T = matMul(T, A).map(r => r.map(x => x / k)); E = E.map((r, i) => r.map((x, j) => x + T[i][j])); }
    for (let i = 0; i < sq; i++) E = matMul(E, E);
    return E;
  }
  /* Regelungsnormalform; erlaubt Zählergrad = Nennergrad (Durchgriff D) */
  function toSS(a) {
    const den = ptrim(a.den.slice()), num = ptrim(a.num.slice());
    const n = den.length - 1;
    if (num.length > den.length) throw new Error('unecht: Zählergrad größer als Nennergrad');
    const a0 = den[0], d = den.map(x => x / a0);
    const b = new Array(n + 1).fill(0); for (let i = 0; i < num.length; i++) b[n + 1 - num.length + i] = num[i] / a0;
    const D = b[0];
    if (n === 0) return { n: 0, A: [], B: [], C: [], D: D };
    const A = []; for (let i = 0; i < n; i++) { A.push(new Array(n).fill(0)); if (i < n - 1) A[i][i + 1] = 1; }
    for (let j = 0; j < n; j++) A[n - 1][j] = -d[n - j];
    const B = new Array(n).fill(0); B[n - 1] = 1;
    const C = []; for (let j = 0; j < n; j++) C.push(b[n - j] - D * d[n - j]);
    return { n: n, A: A, B: B, C: C, D: D };
  }
  /* exakte Diskretisierung (Halteglied nullter Ordnung) eines Zustandsraummodells */
  function zohSS(ss, dt) {
    const n = ss.n, M = [];
    for (let i = 0; i < n + 1; i++) { M.push(new Array(n + 1).fill(0)); }
    for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) M[i][j] = ss.A[i][j] * dt; M[i][n] = ss.B[i] * dt; }
    const E = expm(M), Ad = [], Bd = [];
    for (let i = 0; i < n; i++) { Ad.push(E[i].slice(0, n)); Bd.push(E[i][n]); }
    return { Ad: Ad, Bd: Bd };
  }

  /* ===================================================================== Zeitbereich: Sprungantwort und Kenngrößen */
  function autoHorizon(a) {
    const ps = roots(a.den), sc = Math.max(1e-300, ...ps.map(cabs).concat([0]));
    const tol = 1e-7 * (sc > 0 ? sc : 1);
    const stable = ps.filter(p => p.re < -tol), unst = ps.filter(p => p.re > tol), axis = ps.filter(p => Math.abs(p.re) <= tol);
    let T;
    if (unst.length) T = 12 / Math.max(...unst.map(p => p.re));
    else if (stable.length) {
      T = 8 / Math.min(...stable.map(p => -p.re));
      if (axis.some(p => p.im !== 0)) T = Math.max(T, 6 * 2 * PI / Math.max(...axis.map(p => Math.abs(p.im))));
    } else if (axis.some(p => p.im !== 0)) T = 8 * 2 * PI / Math.min(...axis.filter(p => p.im !== 0).map(p => Math.abs(p.im)));
    else T = 10;
    return T + 2 * (a.delay || 0);
  }
  /* Sprungantwort auf einen Eingangssprung der Höhe amp. Rückgabe {t[], y[], dt}. Totzeit exakt als Verschiebung. */
  function stepResponse(a, opt) {
    opt = opt || {};
    const amp = opt.amp == null ? 1 : opt.amp, n0 = opt.n || 2000, Td = a.delay || 0;
    const tEnd = opt.tEnd > 0 ? opt.tEnd : autoHorizon(a);
    let dt = tEnd / n0, m = 0, N = n0;
    if (Td > 0) { m = Math.max(1, Math.round(Td / dt)); const dt2 = Td / m; const N2 = Math.ceil(tEnd / dt2); if (N2 <= 24000) { dt = dt2; N = N2; } else { m = 0; } }
    const base = { num: a.num, den: a.den, delay: 0 }, ss = toSS(base);
    const t = new Array(N + 1), y0 = new Array(N + 1);
    for (let k = 0; k <= N; k++) t[k] = k * dt;
    if (ss.n === 0) { for (let k = 0; k <= N; k++) y0[k] = ss.D * amp; }
    else {
      const ds = zohSS(ss, dt);
      let x = new Array(ss.n).fill(0);
      for (let k = 0; k <= N; k++) {
        let yv = ss.D * amp; for (let j = 0; j < ss.n; j++) yv += ss.C[j] * x[j];
        y0[k] = yv;
        const xn = new Array(ss.n).fill(0);
        for (let i = 0; i < ss.n; i++) { let s = ds.Bd[i] * amp; for (let j = 0; j < ss.n; j++) s += ds.Ad[i][j] * x[j]; xn[i] = s; }
        x = xn;
      }
    }
    let y = y0;
    if (Td > 0) {
      y = new Array(N + 1).fill(0);
      if (m > 0) { for (let k = 0; k <= N; k++) y[k] = k >= m ? y0[k - m] : 0; }
      else { for (let k = 0; k <= N; k++) { const tt = t[k] - Td; if (tt <= 0) { y[k] = 0; continue; } const f = tt / dt, i = Math.min(N - 1, Math.floor(f)); y[k] = y0[i] + (y0[i + 1] - y0[i]) * (f - i); } }
    }
    return { t: t, y: y, dt: dt, tEnd: N * dt };
  }
  /* Kenngrößen einer Sprungantwort. yFinal (Endwert) wird sonst aus dem letzten Wert genommen. */
  function stepInfo(r, opt) {
    opt = opt || {};
    const t = r.t, y = r.y, N = y.length;
    const yEnd = opt.yFinal != null && fin(opt.yFinal) ? opt.yFinal : y[N - 1];
    const out = { yEnd: yEnd, yMax: -Infinity, tPeak: null, overshootPct: 0, tRise: null, tRise1090: null, tSettle5: null, tSettle2: null, settled: false };
    for (let k = 0; k < N; k++) if (y[k] > out.yMax) { out.yMax = y[k]; out.tPeak = t[k]; }
    const yMin = Math.min(...y);
    if (!fin(yEnd) || Math.abs(yEnd) < 1e-12) return out;
    const sg = yEnd > 0 ? 1 : -1, ye = Math.abs(yEnd), ys = y.map(v => sg * v);
    let pk = -Infinity, pi = 0; for (let k = 0; k < N; k++) if (ys[k] > pk) { pk = ys[k]; pi = k; }
    out.yMax = sg > 0 ? pk : -pk; out.tPeak = t[pi];
    out.overshootPct = Math.max(0, (pk - ye) / ye * 100);
    const cross = lev => {   // erste Zeit, bei der ys den Pegel lev*ye erreicht
      for (let k = 1; k < N; k++) if (ys[k - 1] < lev * ye && ys[k] >= lev * ye) return t[k - 1] + (lev * ye - ys[k - 1]) / (ys[k] - ys[k - 1]) * (t[k] - t[k - 1]);
      return null;
    };
    out.tRise = cross(1);
    const t10 = cross(0.1), t90 = cross(0.9); out.tRise1090 = (t10 != null && t90 != null) ? t90 - t10 : null;
    const settle = band => {
      let last = -1; for (let k = N - 1; k >= 0; k--) if (Math.abs(ys[k] - ye) > band * ye) { last = k; break; }
      if (last < 0) return 0;
      if (last >= N - 1) return null;
      const e0 = Math.abs(ys[last] - ye) - band * ye, e1 = Math.abs(ys[last + 1] - ye) - band * ye;
      return t[last] + e0 / (e0 - e1) * (t[last + 1] - t[last]);
    };
    out.tSettle5 = settle(0.05); out.tSettle2 = settle(0.02);
    out.settled = out.tSettle5 != null;
    out.yMin = yMin;
    return out;
  }
  /* Regelfläche IAE = Integral |w - y| dt (Trapez), w = Sollwert */
  function iae(r, w) { let s = 0; for (let k = 1; k < r.t.length; k++) s += 0.5 * (Math.abs(w - r.y[k - 1]) + Math.abs(w - r.y[k])) * (r.t[k] - r.t[k - 1]); return s; }
  /* Streckenkennwerte Ks, Tu (Verzugszeit), Tg (Ausgleichszeit) aus der Wendetangente der Sprungantwort einer Strecke mit Ausgleich */
  function identifyTuTg(a, opt) {
    const r = stepResponse(a, Object.assign({ n: 6000 }, opt || {})), t = r.t, y = r.y, N = y.length;
    const Ks = dcGain(a);
    if (!fin(Ks) || Ks === 0) return null;
    let kmax = 1, smax = -Infinity;
    for (let k = 1; k < N - 1; k++) { const s = (y[k + 1] - y[k - 1]) / (t[k + 1] - t[k - 1]); if (s > smax) { smax = s; kmax = k; } }
    if (!(smax > 0)) return null;
    const tW = t[kmax], yW = y[kmax], Tu = tW - yW / smax, Tend = tW + (Ks - yW) / smax;
    return { Ks: Ks, Tu: Math.max(0, Tu), Tg: Tend - Math.max(0, Tu), tWende: tW, yWende: yW, slope: smax };
  }

  /* ===================================================================== Frequenzbereich */
  function factors(a) {
    const n = ptrim(a.num), d = ptrim(a.den);
    return { K: n[0] / d[0], z: roots(n), p: roots(d), delay: a.delay || 0 };
  }
  /* Betrag und Phase bei w (rad/s). Phase stetig aus den Wurzelfaktoren (jw - z): ohne Sprünge. */
  function respAt(F, w) {
    let lm = Math.log(Math.abs(F.K)), ph = F.K < 0 ? PI : 0;
    for (let i = 0; i < F.z.length; i++) { const z = F.z[i]; lm += 0.5 * Math.log((z.re * z.re) + (w - z.im) * (w - z.im)); ph += Math.atan2(w - z.im, -z.re); }
    for (let i = 0; i < F.p.length; i++) { const p = F.p[i]; lm -= 0.5 * Math.log((p.re * p.re) + (w - p.im) * (w - p.im)); ph -= Math.atan2(w - p.im, -p.re); }
    ph -= w * F.delay;
    const mag = Math.exp(lm);
    return { mag: mag, db: 20 * Math.log10(mag), lnmag: lm, ph: ph * DEG, re: mag * Math.cos(ph), im: mag * Math.sin(ph) };
  }
  function autoRange(a, F) {
    F = F || factors(a);
    const rs = F.z.concat(F.p).map(cabs).filter(x => x > 1e-12);
    if (F.delay > 0) rs.push(1 / F.delay);
    if (!rs.length) return { lo: 0.1, hi: 100 };
    let lo = Math.min(...rs) / 100, hi = Math.max(...rs) * 100;
    if (Math.log10(hi / lo) < 3) { const c = Math.sqrt(lo * hi); lo = c / 40; hi = c * 40; }
    return { lo: lo, hi: hi };
  }
  function bode(a, opt) {
    opt = opt || {}; const F = opt.F || factors(a), rg = autoRange(a, F);
    const lo = opt.wMin || rg.lo, hi = opt.wMax || rg.hi, n = opt.n || 400;
    const w = [], db = [], ph = [], l0 = Math.log(lo), l1 = Math.log(hi);
    for (let i = 0; i < n; i++) { const wi = Math.exp(l0 + (l1 - l0) * i / (n - 1)), r = respAt(F, wi); w.push(wi); db.push(r.db); ph.push(r.ph); }
    return { w: w, db: db, ph: ph, wMin: lo, wMax: hi };
  }
  /* Asymptoten des Betragsdiagramms und Eckfrequenzen. H ~ K0 s^k Π(1+s/|z|)/Π(1+s/|p|) */
  function bodeAsymptotes(a) {
    const F = factors(a);
    const zs = F.z.filter(z => cabs(z) > 1e-12 * (1 + cabs(z) * 0)), ps = F.p.filter(p => cabs(p) > 1e-12);
    const nz0 = F.z.length - zs.length, np0 = F.p.length - ps.length;
    // K0 aus dem Quotienten der niedrigsten Koeffizienten
    const n = ptrim(a.num), d = ptrim(a.den);
    const lowN = (() => { for (let i = n.length - 1; i >= 0; i--) if (n[i] !== 0) return n[i]; return 0; })();
    const lowD = (() => { for (let i = d.length - 1; i >= 0; i--) if (d[i] !== 0) return d[i]; return 1; })();
    const K0 = lowN / lowD, k = nz0 - np0;
    const corners = [];
    zs.forEach(z => corners.push({ w: cabs(z), kind: 'z', slope: z.im !== 0 ? 40 : 20, pair: z.im !== 0 }));
    ps.forEach(p => corners.push({ w: cabs(p), kind: 'p', slope: p.im !== 0 ? -40 : -20, pair: p.im !== 0 }));
    // komplexe Paare nur einmal als Ecke (Steigungsänderung 40 dB/Dek.), reelle Wurzeln einzeln
    const uniq = []; corners.forEach(c => { if (c.pair) { if (!uniq.some(u => u.kind === c.kind && u.pair && Math.abs(u.w - c.w) < 1e-9 * c.w)) uniq.push(c); } else uniq.push(c); });
    uniq.sort((x, y) => x.w - y.w);
    const db = w => {
      let s = 20 * Math.log10(Math.abs(K0)) + 20 * k * Math.log10(w);
      uniq.forEach(c => { const f = Math.max(0, Math.log10(w / c.w)); s += (c.kind === 'z' ? 1 : -1) * (c.pair ? 40 : 20) * f; });
      return s;
    };
    return { K0: K0, order0: k, corners: uniq, db: db, slopeAt: w => { let s = 20 * k; uniq.forEach(c => { if (w > c.w) s += c.slope; }); return s; } };
  }
  /* Durchtrittsfrequenz(en), Phasenreserve, Amplitudenreserve des offenen Kreises L */
  function margins(L, opt) {
    opt = opt || {}; const F = opt.F || factors(L), rg = autoRange(L, F);
    const lo = opt.wMin || rg.lo, hi = opt.wMax || rg.hi, n = opt.n || 6000, l0 = Math.log(lo), l1 = Math.log(hi);
    const W = i => Math.exp(l0 + (l1 - l0) * i / (n - 1));
    const lm = [], ph = [];
    for (let i = 0; i < n; i++) { const r = respAt(F, W(i)); lm.push(r.lnmag); ph.push(r.ph); }
    const bis = (f, ia, ib) => { let a = Math.log(W(ia)), b = Math.log(W(ib)), fa = f(Math.exp(a)); for (let k = 0; k < 80; k++) { const m = 0.5 * (a + b), fm = f(Math.exp(m)); if ((fm > 0) === (fa > 0)) { a = m; fa = fm; } else b = m; } return Math.exp(0.5 * (a + b)); };
    const wcs = [];
    for (let i = 0; i < n - 1; i++) if ((lm[i] > 0) !== (lm[i + 1] > 0) && !(lm[i] === 0 && lm[i + 1] === 0)) {
      const wc = bis(w => respAt(F, w).lnmag, i, i + 1), r = respAt(F, wc);
      wcs.push({ w: wc, phDeg: r.ph, pm: 180 + r.ph, dir: lm[i] > 0 ? 'ab' : 'auf' });
    }
    const q = i => Math.floor(Math.round((ph[i] + 180) * 1e8) / 1e8 / 360);
    const wpc = [];
    for (let i = 0; i < n - 1; i++) {
      const qa = q(i), qb = q(i + 1);
      if (qa !== qb && ph[i + 1] < ph[i]) {
        const target = -180 + 360 * Math.max(qa, qb);
        const wp = bis(w => respAt(F, w).ph - target, i, i + 1), r = respAt(F, wp);
        wpc.push({ w: wp, db: r.db, gm: -r.db, phDeg: target });
      }
    }
    let main = null; wcs.forEach(c => { if (c.dir === 'ab' && (!main || c.pm < main.pm)) main = c; });
    if (!main && wcs.length) main = wcs[0];
    const pc = wpc.length ? wpc[0] : null;
    return {
      wc: main ? main.w : null, pm: main ? main.pm : null,
      wpc: pc ? pc.w : null, gmDb: pc ? pc.gm : Infinity, gmLin: pc ? Math.pow(10, pc.gm / 20) : Infinity,
      crossings: wcs, phaseCrossings: wpc, multiCross: wcs.length > 1, range: { lo: lo, hi: hi }
    };
  }
  /* Nyquist-Kurve (w > 0); die Spiegelkurve (w < 0) ist die Konjugierte */
  function nyquist(L, opt) {
    opt = opt || {}; const F = opt.F || factors(L), rg = autoRange(L, F);
    const lo = opt.wMin || rg.lo, hi = opt.wMax || rg.hi, n = opt.n || 900, l0 = Math.log(lo), l1 = Math.log(hi);
    const w = [], re = [], im = [];
    for (let i = 0; i < n; i++) { const wi = Math.exp(l0 + (l1 - l0) * i / (n - 1)), r = respAt(F, wi); w.push(wi); re.push(r.re); im.push(r.im); }
    return { w: w, re: re, im: im };
  }
  /* Vereinfachtes Nyquist-Kriterium (Bode-Form): gilt für einen offenen Kreis ohne Pole in der rechten Halbebene (Integratoren, höchstens doppelt, sind erlaubt),
   * ohne Nullstellen in der rechten Halbebene, positiver Verstärkung und genau einem Durchtritt. Dann: geschlossen stabil genau dann, wenn Phasenreserve > 0. */
  function nyquistSimple(L, opt) {
    const F = factors(L), m = margins(L, opt);
    const why = [];
    const tol = 1e-7 * Math.max(1, ...F.p.concat(F.z).map(cabs));
    if (F.p.some(p => p.re > tol)) why.push('Pole in der rechten Halbebene');
    const axis = F.p.filter(p => Math.abs(p.re) <= tol);
    if (axis.some(p => p.im !== 0) || axis.filter(p => p.im === 0).length > 2) why.push('Pole auf der Achse außer Integratoren (höchstens zwei)');
    if (F.z.some(z => z.re > tol)) why.push('Nullstellen in der rechten Halbebene');
    if (F.K <= 0) why.push('negative Verstärkung');
    if (m.crossings.length !== 1) why.push(m.crossings.length === 0 ? 'kein Durchtritt durch 0 dB' : 'mehrere Durchtritte durch 0 dB');
    const ok = why.length === 0;
    return { applicable: ok, why: why, stable: ok ? m.pm > 0 : null, pm: m.pm, wc: m.wc };
  }

  /* ===================================================================== Wurzelortskurve: Nenner D(s) + K N(s) */
  const locusPoly = (N, D, K) => padd(D, pscale(N, K));
  function locusRoots(N, D, K) { return roots(locusPoly(N, D, K)); }
  function locusAssign(prev, cur) {   // Zuordnung: die Verfolgung einer Bahn über benachbarte K-Werte (gierig, nach Abstand)
    const n = prev.length, used = new Array(n).fill(false), res = new Array(n);
    const pairs = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) pairs.push([cabs(csub(prev[i], cur[j])), i, j]);
    pairs.sort((a, b) => a[0] - b[0]);
    const taken = new Array(n).fill(false);
    pairs.forEach(p => { if (!used[p[1]] && !taken[p[2]]) { used[p[1]] = true; taken[p[2]] = true; res[p[1]] = cur[p[2]]; } });
    return res;
  }
  /* Bahnen der Pole für die Verstärkungen Ks (aufsteigend). Rückgabe branches[i][k] = Pol i bei Ks[k] */
  function rootLocus(N, D, Ks) {
    const n = pdeg(D) + 0; let prev = null; const br = [];
    Ks.forEach((K, k) => {
      let cur = locusRoots(N, D, K);
      if (prev && cur.length === prev.length) cur = locusAssign(prev, cur);
      if (!br.length) for (let i = 0; i < cur.length; i++) br.push([]);
      cur.forEach((c, i) => { if (br[i]) br[i].push(c); });
      prev = cur;
    });
    return br;
  }
  /* Kenndaten: Asymptoten, Schwerpunkt, Ausgangswinkel entfallen; Verzweigungspunkte, kritische Verstärkung */
  function locusInfo(N, D) {
    N = ptrim(N); D = ptrim(D);
    const poles = roots(D), zeros = roots(N), n = poles.length, m = zeros.length, na = n - m;
    const info = { poles: poles, zeros: zeros, nAsym: na, centroid: null, asymAngles: [], breakaway: [], kcrit: null, wcrit: null };
    if (na > 0) {
      const sP = poles.reduce((s, p) => s + p.re, 0), sZ = zeros.reduce((s, z) => s + z.re, 0);
      info.centroid = (sP - sZ) / na;
      for (let k = 0; k < na; k++) info.asymAngles.push((2 * k + 1) * 180 / na);
    }
    // Verzweigungs- und Vereinigungspunkte: D' N - D N' = 0, nur reelle Lösungen mit K = -D/N > 0
    const br = padd(pmul(pder(D), N), pscale(pmul(D, pder(N)), -1));
    if (pdeg(br) >= 1) roots(br).forEach(r => {
      if (Math.abs(r.im) > 1e-7 * (1 + Math.abs(r.re))) return;
      const nv = pevalR(N, r.re), dv = pevalR(D, r.re); if (Math.abs(nv) < 1e-300) return;
      const K = -dv / nv; if (K > 1e-12 && fin(K)) info.breakaway.push({ s: r.re, K: K });
    });
    // kritische Verstärkung: kleinste K > 0, bei der ein Pol die imaginäre Achse erreicht (aus dem K-Raster, dann Bisektion)
    const kc = locusKcrit(N, D);
    if (kc) { info.kcrit = kc.K; info.wcrit = kc.w; }
    return info;
  }
  const maxRe = rts => Math.max(...rts.map(r => r.re));
  function locusKcrit(N, D) {
    const sc = (() => { const rs = roots(D).concat(roots(N)).map(cabs).filter(x => x > 0); return rs.length ? Math.max(...rs) : 1; })();
    const nn = ptrim(N), dd = ptrim(D);
    const kNorm = Math.abs(dd[dd.length - 1] / nn[nn.length - 1]) || 1;
    const tol = 1e-7 * sc;
    const st0 = stabilityOfPoles(locusRoots(N, D, 0));
    if (st0.nRhp > 0) return null;
    let kPrev = 0, rePrev = maxRe(locusRoots(N, D, 1e-12 * kNorm));
    const kmaxG = 1e6 * kNorm;
    for (let K = 1e-4 * kNorm; K <= kmaxG; K *= 1.05) {
      const re = maxRe(locusRoots(N, D, K));
      if (re > tol && rePrev <= tol) {
        let a = kPrev || 1e-12 * kNorm, b = K;
        for (let i = 0; i < 100; i++) { const mid = 0.5 * (a + b), rm = maxRe(locusRoots(N, D, mid)); if (rm > 0) b = mid; else a = mid; }
        const Kc = 0.5 * (a + b), rts = locusRoots(N, D, Kc);
        const imax = rts.reduce((bi, r, i) => (r.re > rts[bi].re ? i : bi), 0);
        return { K: Kc, w: Math.abs(rts[imax].im), s: rts[imax] };
      }
      kPrev = K; rePrev = re;
    }
    return null;
  }
  /* Verstärkung K, bei der das dominante komplexe Polpaar die Dämpfung D hat (Winkel zur negativen reellen Achse acos(D)). Rückgabe null, wenn es keins gibt. */
  function locusKforDamping(N, D, Dtarget) {
    const nn = ptrim(N), dd = ptrim(D), kNorm = Math.abs(dd[dd.length - 1] / nn[nn.length - 1]) || 1;
    const damp = K => {   // kleinste Dämpfung aller komplexen Pole; reelle Pole haben Dämpfung 1
      let dmin = 1; locusRoots(N, D, K).forEach(r => { if (Math.abs(r.im) > 1e-9 * (1 + Math.abs(r.re)) && r.re < 0) dmin = Math.min(dmin, -r.re / cabs(r)); else if (r.re >= 0 && Math.abs(r.im) > 1e-9) dmin = Math.min(dmin, -r.re / cabs(r)); });
      return dmin;
    };
    const kc = locusKcrit(N, D), kHi = kc ? kc.K : 1e4 * kNorm;
    let prevK = null, prevD = damp(1e-6 * kNorm);
    for (let K = 1e-6 * kNorm; K <= kHi; K *= 1.02) {
      const d = damp(K);
      if (prevD >= Dtarget && d < Dtarget) {
        let a = prevK == null ? K / 1.02 : prevK, b = K;
        for (let i = 0; i < 100; i++) { const mid = 0.5 * (a + b); if (damp(mid) >= Dtarget) a = mid; else b = mid; }
        return 0.5 * (a + b);
      }
      prevK = K; prevD = d;
    }
    return null;
  }

  /* Zeit, zu der die Antwort r den Pegel level (absolut) zum ersten Mal erreicht (linear interpoliert); null, wenn nie */
  function timeAtLevel(r, level) {
    const up = r.y[r.y.length - 1] >= r.y[0] ? true : false;
    for (let k = 1; k < r.y.length; k++) {
      const a = r.y[k - 1], b = r.y[k];
      if ((up && a < level && b >= level) || (!up && a > level && b <= level)) return r.t[k - 1] + (level - a) / (b - a) * (r.t[k] - r.t[k - 1]);
    }
    return null;
  }
  /* Resonanzüberhöhung: größter Betrag des Frequenzgangs (Suche auf feinem Raster, dann Verfeinerung) */
  function resonancePeak(a) {
    const F = factors(a), rg = autoRange(a, F), n = 4000, l0 = Math.log(rg.lo), l1 = Math.log(rg.hi);
    let bi = 0, bv = -Infinity;
    for (let i = 0; i < n; i++) { const v = respAt(F, Math.exp(l0 + (l1 - l0) * i / (n - 1))).lnmag; if (v > bv) { bv = v; bi = i; } }
    let lo = Math.exp(l0 + (l1 - l0) * Math.max(0, bi - 1) / (n - 1)), hi = Math.exp(l0 + (l1 - l0) * Math.min(n - 1, bi + 1) / (n - 1));
    for (let i = 0; i < 80; i++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (respAt(F, m1).lnmag < respAt(F, m2).lnmag) lo = m1; else hi = m2; }
    const w = 0.5 * (lo + hi);
    return { w: w, db: respAt(F, w).db };
  }
  /* Wurzelortskurve: Verstärkung K, bei der der reelle Punkt s auf der Kurve liegt (K = -D(s)/N(s)); gültig nur für K > 0 */
  function locusKatReal(N, D, s) { const nv = pevalR(N, s); return nv === 0 ? null : -pevalR(D, s) / nv; }
  function onLocusReal(N, D, s) { const K = locusKatReal(N, D, s); return K != null && K > 0; }

  /* ===================================================================== Reglerentwurf */
  /* Betragsoptimum (BO): Strecke Ks/((1+sT1)[(1+sT2)](1+sTs)) mit der Summe der kleinen Zeiten Ts. Regler kompensiert die großen Zeitkonstanten. */
  function boPI(Ks, T1, Ts) { return { Kp: T1 / (2 * Ks * Ts), Tn: T1 }; }
  function boPID(Ks, T1, T2, Ts) { return { Kp: T1 / (2 * Ks * Ts), Tn: T1, Tv: T2 }; }
  function boP_IT1(Kis, Ts) { return { Kp: 1 / (2 * Kis * Ts) }; }                  // Strecke Kis/(s(1+sTs)), P-Regler
  /* Symmetrisches Optimum (SO): Strecke Kis/(s(1+sTs)), PI-Regler. a = 2 ist der Standard (Tn = 4 Ts) */
  function soPI(Kis, Ts, a) { a = a || 2; return { Kp: 1 / (a * Kis * Ts), Tn: a * a * Ts, wc: 1 / (a * Ts), pm: (Math.atan(a) - Math.atan(1 / a)) * DEG }; }
  /* Ziegler-Nichols, Schwingversuch (Kcrit, Tcrit) */
  function znOsc(Kcrit, Tcrit, type) {
    if (type === 'P') return { Kp: 0.5 * Kcrit };
    if (type === 'PI') return { Kp: 0.45 * Kcrit, Tn: Tcrit / 1.2 };
    return { Kp: 0.6 * Kcrit, Tn: 0.5 * Tcrit, Tv: 0.125 * Tcrit };
  }
  /* Ziegler-Nichols, Sprungantwort (Ks, Tu, Tg) */
  function znStep(Ks, Tu, Tg, type) {
    const r = Tg / (Ks * Tu);
    if (type === 'P') return { Kp: r };
    if (type === 'PI') return { Kp: 0.9 * r, Tn: 3.33 * Tu };
    return { Kp: 1.2 * r, Tn: 2 * Tu, Tv: 0.5 * Tu };
  }
  /* Chien-Hrones-Reswick; mode 'fuehrung' | 'stoerung'; os 0 (aperiodisch) | 20 (20 % Überschwingen) */
  /* Einträge: [Faktor für Kp (mal Tg/(Ks Tu)), Faktor für Tn, Bezug von Tn ('g' = Tg, 'u' = Tu), Faktor für Tv (mal Tu)] */
  const CHR_TAB = {
    0: {
      fuehrung: { P: [0.3], PI: [0.35, 1.2, 'g'], PID: [0.6, 1, 'g', 0.5] },
      stoerung: { P: [0.3], PI: [0.6, 4, 'u'], PID: [0.95, 2.4, 'u', 0.42] }
    },
    20: {
      fuehrung: { P: [0.7], PI: [0.6, 1, 'g'], PID: [0.95, 1.35, 'g', 0.47] },
      stoerung: { P: [0.7], PI: [0.7, 2.3, 'u'], PID: [1.2, 2, 'u', 0.42] }
    }
  };
  function chr(Ks, Tu, Tg, type, mode, os) {
    const row = CHR_TAB[os === 20 ? 20 : 0][mode === 'stoerung' ? 'stoerung' : 'fuehrung'][type];
    const r = Tg / (Ks * Tu), out = { Kp: row[0] * r };
    if (type !== 'P') out.Tn = row[1] * (row[2] === 'g' ? Tg : Tu);
    if (type === 'PID') out.Tv = row[3] * Tu;
    return out;
  }
  /* Kritische Verstärkung und Periodendauer einer Strecke G unter P-Regelung (Stabilitätsgrenze) aus dem 180°-Durchgang */
  function ultimate(G) {
    const m = margins(G, {}), pc = m.phaseCrossings[0];
    if (!pc) return null;
    return { Kcrit: Math.pow(10, pc.gm / 20), wcrit: pc.w, Tcrit: 2 * PI / pc.w };
  }
  /* Regelkreis mit Regler C (tf), Strecke G (tf, auch mit Totzeit über Padé). kind 'w' (Führung) oder 'z' (Störung am Streckeneingang) */
  function loopStep(G, C, kind, opt) {
    opt = opt || {};
    const T = kind === 'z' ? feedbackZ(G, C, opt.padeN || 4) : feedbackW(G, C, opt.padeN || 4);
    const r = stepResponse(T, { tEnd: opt.tEnd, n: opt.n || 2000 });
    const st = stabilityOf(T);
    const out = { T: T, r: r, stable: st.cls === 'stabil' };
    if (kind === 'z') {
      const ym = r.y.reduce((m, v) => (Math.abs(v) > Math.abs(m) ? v : m), 0), tp = r.t[r.y.indexOf(ym)];
      out.peak = ym; out.tPeak = tp; out.iae = iae(r, 0);
    } else {
      out.info = stepInfo(r, { yFinal: out.stable ? dcGain(T) : undefined }); out.iae = iae(r, 1);
    }
    return out;
  }

  /* ===================================================================== Digitale Regelung (z-Bereich) */
  /* Pulsübertragungsfunktion G(z) mit Halteglied (ZOH), optional d Takte Totzeit. Rückgabe {num, den} in z (höchste Potenz zuerst), den = det(zI - Ad) z^d. */
  function c2dZOH(a, Ts, d) {
    const ss = toSS({ num: a.num, den: a.den, delay: 0 }), n = ss.n;
    d = d || 0;
    if (n === 0) return { num: [ss.D].concat(new Array(d).fill(0)).slice(0, 1), den: [1].concat(new Array(d).fill(0)), Ts: Ts, d: d };
    const ds = zohSS(ss, Ts), Ad = ds.Ad, Bd = ds.Bd;
    // Faddeev-LeVerrier: det(zI-Ad) = z^n + c1 z^(n-1) + ... ; adj(zI-Ad) = sum_k M_k z^(n-1-k)
    const I = Ad.map((r, i) => r.map((_, j) => (i === j ? 1 : 0)));
    const Ms = [I], cs = [1];
    let Mk = I;
    for (let k = 1; k <= n; k++) {
      const AM = matMul(Ad, Mk);
      let tr = 0; for (let i = 0; i < n; i++) tr += AM[i][i];
      const ck = -tr / k; cs.push(ck);
      if (k < n) { Mk = AM.map((r, i) => r.map((x, j) => x + (i === j ? ck : 0))); Ms.push(Mk); }
    }
    // Zähler: C adj(zI-Ad) Bd + D * den
    const numP = new Array(n + 1).fill(0);
    for (let k = 0; k < n; k++) {
      let s = 0; for (let i = 0; i < n; i++) { let t = 0; for (let j = 0; j < n; j++) t += Ms[k][i][j] * Bd[j]; s += ss.C[i] * t; }
      numP[1 + k] += s;    // Potenz z^(n-1-k) steht an Position (n) - (n-1-k) = k+1
    }
    for (let k = 0; k <= n; k++) numP[k] += ss.D * cs[k];
    const den = cs.concat(new Array(d).fill(0));
    return { num: ptrim(numP), den: den, Ts: Ts, d: d };
  }
  /* Tustin (bilineare Transformation) s = 2/Ts (z-1)/(z+1) */
  function tustin(a, Ts) {
    const sub = p => {   // p(s) -> p(z) mit gemeinsamem Nenner (z+1)^n
      const n = p.length - 1; let r = [0];
      for (let i = 0; i < p.length; i++) { const k = n - i; r = padd(r, pscale(pmul(ppow([1, -1], k), ppow([1, 1], n - k)), p[i] * Math.pow(2 / Ts, k))); }
      return { poly: r, n: n };
    };
    const nu = sub(ptrim(a.num)), de = sub(ptrim(a.den));
    let num = nu.poly, den = de.poly;
    const diff = de.n - nu.n;   // Zähler hat (z+1)^(nd - nn) mehr
    if (diff > 0) num = pmul(num, ppow([1, 1], diff)); else if (diff < 0) den = pmul(den, ppow([1, 1], -diff));
    const k = den[0];
    return { num: pscale(num, 1 / k), den: pscale(den, 1 / k), Ts: Ts };
  }
  /* Differenzengleichung: Antwort von num/den (z) auf die Folge u. */
  function dfilter(num, den, u) {
    const n = den.length - 1, b = new Array(n + 1).fill(0);
    for (let i = 0; i < num.length; i++) b[n + 1 - num.length + i] = num[i];
    const y = new Array(u.length).fill(0);
    for (let k = 0; k < u.length; k++) {
      let s = 0;
      for (let i = 0; i <= n; i++) if (k - i >= 0) s += b[i] * u[k - i];
      for (let i = 1; i <= n; i++) if (k - i >= 0) s -= den[i] * y[k - i];
      y[k] = s / den[0];
    }
    return y;
  }
  const dstep = (num, den, N) => dfilter(num, den, new Array(N).fill(1));
  /* Digitaler PI-Regler: u[k] = u[k-1] + Kp (1 + Ts/Tn) e[k] - Kp e[k-1]  (rückwärts) oder  + Kp e[k] - Kp (1 - Ts/Tn) e[k-1] (vorwärts, I-Anteil verzögert) */
  function piDigital(Kp, Tn, Ts, method) {
    if (method === 'vorwaerts') return { num: [Kp, -Kp * (1 - Ts / Tn)], den: [1, -1], Ts: Ts };
    return { num: [Kp * (1 + Ts / Tn), -Kp], den: [1, -1], Ts: Ts };
  }
  /* geschlossener Kreis aus Gz (Pulsübertragung der Strecke) und Cz */
  function dClosed(Gz, Cz) {
    const num = pmul(Gz.num, Cz.num), den = padd(pmul(Gz.den, Cz.den), num);
    return { num: num, den: den };
  }
  function zStability(den) {
    const ps = roots(den), mx = Math.max(...ps.map(cabs));
    const tol = 1e-9;
    return { poles: ps, maxAbs: mx, cls: mx < 1 - tol ? 'stabil' : (mx <= 1 + tol ? 'grenzstabil' : 'instabil') };
  }
  /* Abbildung eines s-Pols in die z-Ebene: z = e^(s Ts) */
  const sToZ = (s, Ts) => cexp({ re: s.re * Ts, im: s.im * Ts });
  /* Frequenzgang im z-Bereich bei w (rad/s) mit stetiger Phase (stückweise entfaltet über die Folge der Frequenzen) */
  function freqZ(num, den, Ts, ws) {
    const zr = roots(num), pr = roots(den), kn = ptrim(num)[0] / ptrim(den)[0];
    const lastZ = new Array(zr.length).fill(null), lastP = new Array(pr.length).fill(null), accZ = new Array(zr.length).fill(0), accP = new Array(pr.length).fill(0);
    const out = [];
    const unwrap = (arr, last, acc, i, v) => { if (last[i] != null) { let d = v - last[i]; while (d > PI) { acc[i] -= 2 * PI; d -= 2 * PI; } while (d < -PI) { acc[i] += 2 * PI; d += 2 * PI; } } last[i] = v; return v + acc[i]; };
    ws.forEach(w => {
      const z = cexp({ re: 0, im: w * Ts });
      let lm = Math.log(Math.abs(kn)), ph = kn < 0 ? PI : 0;
      zr.forEach((r, i) => { const d = csub(z, r); lm += Math.log(cabs(d)); ph += unwrap(zr, lastZ, accZ, i, carg(d)); });
      pr.forEach((r, i) => { const d = csub(z, r); lm -= Math.log(cabs(d)); ph -= unwrap(pr, lastP, accP, i, carg(d)); });
      out.push({ w: w, db: 20 * Math.log10(Math.exp(lm)), lnmag: lm, ph: ph * DEG });
    });
    return out;
  }
  /* Durchtrittsfrequenz und Phasenreserve des offenen Kreises im z-Bereich (exakt, ohne Näherung) */
  function marginsZ(num, den, Ts, opt) {
    const n = (opt && opt.n) || 4000, wN = PI / Ts, lo = wN * 1e-5, hi = wN * 0.99999;
    const ws = []; for (let i = 0; i < n; i++) ws.push(Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * i / (n - 1)));
    const r = freqZ(num, den, Ts, ws);
    let best = null;
    for (let i = 0; i < n - 1; i++) if (r[i].lnmag > 0 && r[i + 1].lnmag <= 0) {
      const f = r[i].lnmag / (r[i].lnmag - r[i + 1].lnmag), wc = ws[i] + f * (ws[i + 1] - ws[i]);
      const ph = r[i].ph + f * (r[i + 1].ph - r[i].ph), pm = 180 + ph;
      if (!best || pm < best.pm) best = { wc: wc, pm: pm };
    }
    // Feinabgleich durch erneute Auswertung
    if (best) { let a = best.wc * 0.97, b = best.wc * 1.03; const f = w => freqZ(num, den, Ts, [w])[0].lnmag; for (let i = 0; i < 60; i++) { const m = 0.5 * (a + b); if (f(m) > 0) a = m; else b = m; } best.wc = 0.5 * (a + b); }
    return best;
  }
  /* Näherung: Abtastung mit Halteglied und Rechenverzug kosten Phase: Teff = Ts/2 + d Ts. Totzeit ändert den Betrag nicht, also bleibt wc gleich. */
  function pmWithDelay(L, Teff, opt) {
    const m = margins(L, opt); if (m.wc == null) return null;
    return { wc: m.wc, pmCont: m.pm, loss: m.wc * Teff * DEG, pm: m.pm - m.wc * Teff * DEG };
  }
  /* Totzeit, bei der die Phasenreserve gerade 0 wird: Tt,max = PM/(wc) (im Bogenmaß) */
  const tdMax = (pmDeg, wc) => pmDeg / DEG / wc;
  /* Alias-Frequenz einer Sinusschwingung f bei Abtastfrequenz fs */
  const aliasFreq = (f, fs) => Math.abs(f - Math.round(f / fs) * fs);

  return {
    VERSION: '1.0', PI: PI,
    cx: cx, cadd: cadd, csub: csub, cmul: cmul, cdiv: cdiv, cabs: cabs, carg: carg, cexp: cexp,
    ptrim: ptrim, padd: padd, pmul: pmul, pscale: pscale, ppow: ppow, pdeg: pdeg, peval: peval, pevalR: pevalR, pder: pder, pfromRoots: pfromRoots, roots: roots,
    tf: tf, tfMul: tfMul, tfAdd: tfAdd, tfGain: tfGain, gainOf: gainOf, tfPoles: tfPoles, tfZeros: tfZeros, dcGain: dcGain,
    pt1: pt1, pt2: pt2, integrator: integrator, dt1: dt1, ptn: ptn, itn: itn, withDelay: withDelay, padeCoeffs: padeCoeffs, withPade: withPade,
    pidTF: pidTF, pidSeries: pidSeries, piTF: piTF, feedbackW: feedbackW, feedbackZ: feedbackZ, closedLoop: closedLoop,
    stabilityOfPoles: stabilityOfPoles, stabilityOf: stabilityOf,
    matMul: matMul, expm: expm, toSS: toSS, zohSS: zohSS,
    autoHorizon: autoHorizon, timeAtLevel: timeAtLevel, resonancePeak: resonancePeak, locusKatReal: locusKatReal, onLocusReal: onLocusReal, stepResponse: stepResponse, stepInfo: stepInfo, iae: iae, identifyTuTg: identifyTuTg,
    factors: factors, respAt: respAt, autoRange: autoRange, bode: bode, bodeAsymptotes: bodeAsymptotes, margins: margins, nyquist: nyquist, nyquistSimple: nyquistSimple,
    locusPoly: locusPoly, locusRoots: locusRoots, rootLocus: rootLocus, locusInfo: locusInfo, locusKcrit: locusKcrit, locusKforDamping: locusKforDamping,
    boPI: boPI, boPID: boPID, boP_IT1: boP_IT1, soPI: soPI, znOsc: znOsc, znStep: znStep, chr: chr, CHR_TAB: CHR_TAB, ultimate: ultimate, loopStep: loopStep,
    c2dZOH: c2dZOH, tustin: tustin, dfilter: dfilter, dstep: dstep, piDigital: piDigital, dClosed: dClosed, zStability: zStability, sToZ: sToZ,
    freqZ: freqZ, marginsZ: marginsZ, pmWithDelay: pmWithDelay, tdMax: tdMax, aliasFreq: aliasFreq
  };
});
