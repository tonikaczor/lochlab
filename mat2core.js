'use strict';
/* Tonfunk Mathe-Brücke: reine Rechenlogik (Kennung 'mat2'). window.MAT2_CORE bzw. module.exports.
   Themen: komplexe Wechselstromrechnung, Matrizen und Knotenpotenzialverfahren, Differenzialgleichungen RC/RL/RLC,
   Laplace-Einstieg (Übertragungsfunktion, Pole), Fourier-Reihe (Rechteck, Dreieck, Sägezahn).
   Konventionen: Winkel in Grad (Zeiger) bzw. Radiant (Fourier-Argument x = ω·t), Effektivwerte bei Wechselgrößen,
   imaginäre Einheit j. Ungültige Eingaben liefern NaN, nie Infinity.
   Unter MAT2_CORE.chk stehen unabhängige Zweitrechnungen (anderer Rechenweg: numerisch, über Admittanz, Bisektion, RK4 ...);
   die Tests und die Aufgaben-Generatoren (q.alt) vergleichen die Hauptrechnung damit. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN, PI = Math.PI;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(°|grad|ms|µs|us|khz|hz|mv|kv|ma|µa|ua|v|a|ω|ohm|%|db)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?([eE][+\-]?\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  /* B01: Ein Punkt mit genau drei Stellen danach (3.393, 0.125) kann Dezimalzahl oder Tausenderzahl sein: beide Lesarten, zuerst wie parseDe */
  function parseDeAll(s) {
    const a = parseDe(s), out = fin(a) ? [a] : [];
    if (typeof s !== 'number') {
      const r = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(°|grad|ms|µs|us|khz|hz|mv|kv|ma|µa|ua|v|a|ω|ohm|%|db)$/i, '');
      if (/^[+\-−]?\d{1,3}\.\d{3}$/.test(r)) { const b = parseFloat(r.replace('−', '-')); if (fin(b) && b !== a) out.push(b); }
    }
    return out;
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  /* Zahl mit n gültigen Ziffern (für Ergebnisse mit sehr unterschiedlicher Größe) */
  function fmtSig(v, n) {
    if (!fin(v)) return '–'; if (v === 0) return '0'; n = n || 3;
    const e = Math.floor(Math.log10(Math.abs(v))), d = Math.max(0, n - 1 - e);
    return fmtN(v, Math.min(d, 9), true);
  }

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ================================================================ 1. Komplexe Zahlen */
  const cx = (re, im) => ({ re: num(re), im: num(im) });
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const csub = (a, b) => cx(a.re - b.re, a.im - b.im);
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  function cdiv(a, b) { const d = b.re * b.re + b.im * b.im; return d > 0 ? cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d) : cx(NAN, NAN); }
  const cconj = a => cx(a.re, -a.im);
  const cabs = a => Math.hypot(a.re, a.im);
  const cargRad = a => (a.re === 0 && a.im === 0 ? NAN : Math.atan2(a.im, a.re));
  const carg = a => cargRad(a) * 180 / PI;                                  /* Grad, (−180, 180] */
  const cpolar = (r, deg) => cx(r * Math.cos(deg * PI / 180), r * Math.sin(deg * PI / 180));
  const cscale = (a, k) => cx(a.re * k, a.im * k);
  const cinv = a => cdiv(cx(1, 0), a);
  /* Winkel in (−180, 180] bringen */
  function wrap180(d) { if (!fin(d)) return NAN; let x = ((d + 180) % 360 + 360) % 360 - 180; if (x === -180) x = 180; return x; }
  const angDiff = (a, b) => Math.abs(wrap180(a - b));
  /* Anzeige: kartesisch "3 + j4", polar "5 ∠ 53,13°" */
  function fmtCart(z, d) { if (!fin(z.re) || !fin(z.im)) return '–'; const im = fmtN(Math.abs(z.im), d == null ? 2 : d, true); return fmtN(z.re, d == null ? 2 : d, true) + (z.im < 0 ? ' − j' : ' + j') + im; }
  function fmtPolar(z, d) { if (!fin(z.re) || !fin(z.im)) return '–'; const r = cabs(z); return fmtN(r, d == null ? 2 : d, true) + ' ∠ ' + (r === 0 ? '0' : fmtN(carg(z), d == null ? 2 : d, true)) + '°'; }
  /* Eingabe lesen: "3+4j", "3-j4", "j2", "-2,5", "5∠53,13", "5<-30°" */
  function parseComplex(s) {
    const bad = cx(NAN, NAN); s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/−/g, '-').replace(/,/g, '.').replace(/°/g, '');
    if (!s) return bad;
    const pm = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)[∠<@]([+-]?\d*\.?\d+(?:e[+-]?\d+)?)$/i.exec(s);
    if (pm) return cpolar(parseFloat(pm[1]), parseFloat(pm[2]));
    const t = s.replace(/i/gi, 'j');
    if (!/^[+\-\d.ej]+$/i.test(t) || (t.match(/j/g) || []).length > 1) return bad;
    const num0 = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:e[+-]?\\d+)?';
    let m = new RegExp('^(' + num0 + ')$', 'i').exec(t); if (m) return cx(parseFloat(m[1]), 0);
    m = /^([+-]?)j$/.exec(t); if (m) return cx(0, m[1] === '-' ? -1 : 1);
    m = new RegExp('^(' + num0 + ')j$', 'i').exec(t); if (m) return cx(0, parseFloat(m[1]));
    m = new RegExp('^j(' + num0 + ')$', 'i').exec(t); if (m) return cx(0, parseFloat(m[1]));
    m = new RegExp('^(' + num0 + ')([+-])(?:j(' + num0.replace('[+-]?', '') + ')|(' + num0.replace('[+-]?', '') + ')j|j)$', 'i').exec(t);
    if (m) { const sg = m[2] === '-' ? -1 : 1, v = m[3] != null ? parseFloat(m[3]) : m[4] != null ? parseFloat(m[4]) : 1; return cx(parseFloat(m[1]), sg * v); }
    return bad;
  }

  /* ---------- Wechselstrom-Bauteile ---------- */
  const omega = f => (num(f) >= 0 ? 2 * PI * f : NAN);
  const XL = (f, L) => (num(f) >= 0 && num(L) >= 0 ? 2 * PI * f * L : NAN);
  const XC = (f, C) => (num(f) > 0 && num(C) > 0 ? 1 / (2 * PI * f * C) : NAN);
  const ZR = R => cx(R, 0), ZL = (f, L) => cx(0, XL(f, L)), ZC = (f, C) => cx(0, -XC(f, C));
  /* Reihenschaltung R, L, C (Teile mit Wert 0 oder null werden weggelassen: L = 0 heißt keine Spule, C = Infinity oder 0/null keinen Kondensator) */
  function zSeries(R, L, C, f) {
    let z = cx(R, 0);
    if (L > 0) z = cadd(z, ZL(f, L));
    if (C > 0) z = cadd(z, ZC(f, C));
    return z;
  }
  const zPar = (a, b) => cdiv(cmul(a, b), cadd(a, b));
  const zParList = list => cinv(list.reduce((s, z) => cadd(s, cinv(z)), cx(0, 0)));
  /* Resonanz */
  const f0 = (L, C) => (num(L) > 0 && num(C) > 0 ? 1 / (2 * PI * Math.sqrt(L * C)) : NAN);
  const qSeries = (R, L, C) => (num(R) > 0 && num(L) > 0 && num(C) > 0 ? Math.sqrt(L / C) / R : NAN);
  const bandwidth = (fr, Q) => (num(fr) > 0 && num(Q) > 0 ? fr / Q : NAN);
  const iMag = (U, R, L, C, f) => { const z = zSeries(R, L, C, f); return cabs(z) > 0 ? U / cabs(z) : NAN; };
  /* Leistungen bei Effektivwerten: S = U · I*, Rückgabe {S, P, Q, Sabs, cosphi} */
  function power(U, I) {
    const S = cmul(U, cconj(I));
    return { S, P: S.re, Q: S.im, Sabs: cabs(S), cosphi: cabs(S) > 0 ? S.re / cabs(S) : NAN };
  }

  /* ================================================================ 2. Matrizen, Gauss, Knotenpotenzialverfahren */
  const cloneM = A => A.map(r => r.slice());
  const isSq = A => Array.isArray(A) && A.length > 0 && A.every(r => Array.isArray(r) && r.length === A.length && r.every(v => fin(v)));
  /* Determinante über Gauss mit Spaltenpivot */
  function det(A) {
    if (!isSq(A)) return NAN; const n = A.length, M = cloneM(A); let d = 1;
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-14) return 0;
      if (p !== k) { const t = M[p]; M[p] = M[k]; M[k] = t; d = -d; }
      d *= M[k][k];
      for (let i = k + 1; i < n; i++) { const f = M[i][k] / M[k][k]; for (let j = k; j < n; j++) M[i][j] -= f * M[k][j]; }
    }
    return d;
  }
  /* Determinante nach Laplace (Entwicklung nach der ersten Zeile): unabhängiger Weg */
  function detLaplace(A) {
    if (!isSq(A)) return NAN; const n = A.length;
    if (n === 1) return A[0][0];
    if (n === 2) return A[0][0] * A[1][1] - A[0][1] * A[1][0];
    let s = 0;
    for (let j = 0; j < n; j++) { const minor = A.slice(1).map(r => r.filter((_, c) => c !== j)); s += (j % 2 ? -1 : 1) * A[0][j] * detLaplace(minor); }
    return s;
  }
  /* Gauss-Verfahren mit Schritten. Rückgabe {ok, x, steps[], singular}. steps: {kind, text, A, b} */
  function gauss(A, b) {
    const n = Array.isArray(A) ? A.length : 0;
    if (!isSq(A) || !Array.isArray(b) || b.length !== n || !b.every(fin)) return { ok: false, x: [], steps: [], singular: false };
    const M = cloneM(A), v = b.slice(), steps = [];
    const snap = (kind, text) => steps.push({ kind, text, A: cloneM(M), b: v.slice() });
    snap('start', 'Ausgangssystem');
    for (let k = 0; k < n; k++) {
      let p = k; if (Math.abs(M[k][k]) < 1e-12) { for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i; }
      if (Math.abs(M[p][k]) < 1e-12) return { ok: false, x: [], steps, singular: true };
      if (p !== k) { const t = M[p]; M[p] = M[k]; M[k] = t; const tb = v[p]; v[p] = v[k]; v[k] = tb; snap('swap', 'Zeile ' + (k + 1) + ' und Zeile ' + (p + 1) + ' vertauschen (Pivot war 0)'); }
      for (let i = k + 1; i < n; i++) {
        if (M[i][k] === 0) continue;
        const f = M[i][k] / M[k][k];
        for (let j = k; j < n; j++) M[i][j] -= f * M[k][j];
        v[i] -= f * v[k]; M[i][k] = 0;
        snap('elim', 'Zeile ' + (i + 1) + ' − (' + fmtN(f, 4, true) + ') · Zeile ' + (k + 1));
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) { let s = v[i]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
    return { ok: x.every(fin), x, steps, singular: false, U: M, c: v };
  }
  /* Cramersche Regel: unabhängiger Weg */
  function cramer(A, b) {
    if (!isSq(A) || !Array.isArray(b) || b.length !== A.length) return [];
    const D = detLaplace(A); if (Math.abs(D) < 1e-12) return [];
    return A.map((_, k) => detLaplace(A.map((r, i) => r.map((v, j) => (j === k ? b[i] : v)))) / D);
  }
  function inverse(A) {
    if (!isSq(A)) return null; const n = A.length, M = A.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))));
    for (let k = 0; k < n; k++) {
      let p = k; for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
      if (Math.abs(M[p][k]) < 1e-12) return null;
      const t = M[p]; M[p] = M[k]; M[k] = t; const d = M[k][k]; for (let j = 0; j < 2 * n; j++) M[k][j] /= d;
      for (let i = 0; i < n; i++) if (i !== k) { const f = M[i][k]; for (let j = 0; j < 2 * n; j++) M[i][j] -= f * M[k][j]; }
    }
    return M.map(r => r.slice(n));
  }
  const matVec = (A, x) => A.map(r => r.reduce((s, v, j) => s + v * x[j], 0));
  const matMul = (A, B) => A.map(r => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));

  /* Netzwerk für das Knotenpotenzialverfahren.
     net = { n: Anzahl Knoten (1..n, Knoten 0 = Bezugsknoten), br: [{a, b, R, E}], cs: [{a, b, I}] }
     br: Zweig von Knoten a nach Knoten b mit Widerstand R und in Reihe liegender Spannungsquelle E (Pluspol zeigt zum Knoten a, E = 0: nur Widerstand).
     cs: Stromquelle, die I in den Knoten a hinein und aus dem Knoten b heraus treibt.
     Stromrichtung im Zweig: I_ab = (V_a − V_b − E) / R, positiv von a nach b. */
  function netCheck(net) {
    if (!net || !(net.n >= 1) || !Array.isArray(net.br) || !net.br.length) return false;
    const ok = k => Number.isInteger(k) && k >= 0 && k <= net.n;
    return net.br.every(z => ok(z.a) && ok(z.b) && z.a !== z.b && num(z.R) > 0 && fin(z.E == null ? 0 : z.E)) && (net.cs || []).every(z => ok(z.a) && ok(z.b) && z.a !== z.b && fin(z.I));
  }
  function nodalSystem(net) {
    if (!netCheck(net)) return null; const n = net.n, G = Array.from({ length: n }, () => new Array(n).fill(0)), I = new Array(n).fill(0);
    net.br.forEach(z => {
      const g = 1 / z.R, E = z.E || 0;
      if (z.a > 0) { G[z.a - 1][z.a - 1] += g; I[z.a - 1] += g * E; }
      if (z.b > 0) { G[z.b - 1][z.b - 1] += g; I[z.b - 1] -= g * E; }
      if (z.a > 0 && z.b > 0) { G[z.a - 1][z.b - 1] -= g; G[z.b - 1][z.a - 1] -= g; }
    });
    (net.cs || []).forEach(z => { if (z.a > 0) I[z.a - 1] += z.I; if (z.b > 0) I[z.b - 1] -= z.I; });
    return { G, I };
  }
  /* Lösung: {ok, V[1..n] (Index 0 = Knoten 1), Ibr[], sys, gauss} */
  function nodalSolve(net) {
    const sys = nodalSystem(net); if (!sys) return { ok: false, V: [], Ibr: [], sys: null, gauss: null };
    const g = gauss(sys.G, sys.I); if (!g.ok) return { ok: false, V: [], Ibr: [], sys, gauss: g };
    const V = g.x, vv = k => (k === 0 ? 0 : V[k - 1]);
    const Ibr = net.br.map(z => (vv(z.a) - vv(z.b) - (z.E || 0)) / z.R);
    return { ok: true, V, Ibr, sys, gauss: g };
  }
  /* Kontrollen am Netzwerk (ohne Matrix): Knotenregel an jedem Knoten und Leistungsbilanz */
  function nodalChecks(net, sol) {
    if (!sol.ok) return { kcl: NAN, power: NAN };
    const res = new Array(net.n).fill(0), add = (k, v) => { if (k > 0) res[k - 1] += v; };
    net.br.forEach((z, i) => { add(z.a, -sol.Ibr[i]); add(z.b, sol.Ibr[i]); });      /* in den Knoten hinein positiv */
    (net.cs || []).forEach(z => { add(z.a, z.I); add(z.b, -z.I); });
    const vv = k => (k === 0 ? 0 : sol.V[k - 1]);
    let pDiss = 0, pSrc = 0;
    net.br.forEach((z, i) => { pDiss += sol.Ibr[i] * sol.Ibr[i] * z.R; pSrc += -(z.E || 0) * sol.Ibr[i]; });
    (net.cs || []).forEach(z => { pSrc += z.I * (vv(z.a) - vv(z.b)); });
    return { kcl: Math.max.apply(null, res.map(Math.abs)), power: Math.abs(pSrc - pDiss), pSrc, pDiss };
  }
  /* Wheatstone-Brücke ohne Quelle: Knoten 1 oben (Quellenspannung U, wird mit nodalFixed als bekanntes Potenzial gesetzt), 2 = linke Mitte, 3 = rechte Mitte,
     R1: 1-2, R2: 1-3, R3: 2-Masse, R4: 3-Masse, R5: Brückenzweig 2-3. */
  const bridgeNet = (R1, R2, R3, R4, R5) => ({ n: 3, br: [{ a: 1, b: 2, R: R1 }, { a: 1, b: 3, R: R2 }, { a: 2, b: 0, R: R3 }, { a: 3, b: 0, R: R4 }, { a: 2, b: 3, R: R5 }], cs: [] });  function nodalFixed(net, fixedNode, Vfix) {
    /* Knoten fixedNode hat das bekannte Potenzial Vfix; die übrigen n−1 Knoten werden gelöst. Rückgabe wie nodalSolve, V enthält alle n Werte. */
    const sys = nodalSystem(net); if (!sys) return { ok: false, V: [], Ibr: [] };
    const idx = []; for (let k = 0; k < net.n; k++) if (k + 1 !== fixedNode) idx.push(k);
    const A = idx.map(i => idx.map(j => sys.G[i][j])), b = idx.map(i => sys.I[i] - sys.G[i][fixedNode - 1] * Vfix);
    const g = gauss(A, b); if (!g.ok) return { ok: false, V: [], Ibr: [], gauss: g, sys };
    const V = new Array(net.n).fill(0); idx.forEach((i, k) => { V[i] = g.x[k]; }); V[fixedNode - 1] = Vfix;
    const vv = k => (k === 0 ? 0 : V[k - 1]);
    const Ibr = net.br.map(z => (vv(z.a) - vv(z.b) - (z.E || 0)) / z.R);
    return { ok: true, V, Ibr, gauss: g, sys: { G: A, I: b }, idx };
  }
  /* Quellenstrom bei festem Knoten: Summe der Zweigströme, die den festen Knoten verlassen */
  function sourceCurrent(net, sol, node) {
    let s = 0; net.br.forEach((z, i) => { if (z.a === node) s += sol.Ibr[i]; else if (z.b === node) s -= sol.Ibr[i]; }); return s;
  }

  /* ================================================================ 3. Differenzialgleichungen */
  const tauRC = (R, C) => (num(R) > 0 && num(C) > 0 ? R * C : NAN);
  const tauRL = (R, L) => (num(R) > 0 && num(L) > 0 ? L / R : NAN);
  /* Lösung einer linearen DGL 1. Ordnung  τ·y' + y = y∞  mit y(0) = y0 */
  const firstOrder = (y0, yInf, tau, t) => (num(tau) > 0 && num(t) >= 0 ? yInf + (y0 - yInf) * Math.exp(-t / tau) : NAN);
  /* Zeit, bis der Anteil p (0 < p < 1) des Gesamthubs erreicht ist */
  const timeTo = (p, tau) => (num(tau) > 0 && p > 0 && p < 1 ? -tau * Math.log(1 - p) : NAN);
  /* RLC-Reihenschwingkreis, Sprung U am Eingang, Spannung am Kondensator, Anfangswerte 0.
     LC·u'' + RC·u' + u = U */
  function rlcInfo(R, L, C) {
    if (!(num(R) >= 0 && num(L) > 0 && num(C) > 0)) return { ok: false };
    const alpha = R / (2 * L), w0 = 1 / Math.sqrt(L * C), zeta = alpha / w0, disc = alpha * alpha - w0 * w0;
    let cas = 'grenz', wd = 0, s1, s2;
    if (Math.abs(zeta - 1) < 1e-9) { cas = 'grenz'; s1 = s2 = cx(-alpha, 0); }
    else if (zeta < 1) { cas = 'schwing'; wd = Math.sqrt(-disc); s1 = cx(-alpha, wd); s2 = cx(-alpha, -wd); }
    else { cas = 'kriech'; const r = Math.sqrt(disc); s1 = cx(-alpha + r, 0); s2 = cx(-alpha - r, 0); }
    const os = cas === 'schwing' && zeta > 0 ? Math.exp(-PI * zeta / Math.sqrt(1 - zeta * zeta)) * 100 : (zeta === 0 ? 100 : 0);
    return { ok: true, alpha, w0, zeta, case: cas, wd, fd: wd / (2 * PI), f0: w0 / (2 * PI), s1, s2, overshoot: os, Rkrit: 2 * Math.sqrt(L / C), Q: zeta > 0 ? 1 / (2 * zeta) : Infinity, tpeak: cas === 'schwing' ? PI / wd : NAN };
  }
  function rlcStep(R, L, C, U, t) {
    const I = rlcInfo(R, L, C); if (!I.ok || !(num(t) >= 0) || !fin(U)) return NAN;
    const a = I.alpha;
    if (I.case === 'schwing') return U * (1 - Math.exp(-a * t) * (Math.cos(I.wd * t) + a / I.wd * Math.sin(I.wd * t)));
    if (I.case === 'grenz') return U * (1 - (1 + a * t) * Math.exp(-a * t));
    const s1 = I.s1.re, s2 = I.s2.re;
    return U * (1 + (s2 * Math.exp(s1 * t) - s1 * Math.exp(s2 * t)) / (s1 - s2));
  }
  function sampleFn(fn, t0, t1, n) { const o = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; o.push([t, fn(t)]); } return o; }
  /* Klassischer Runge-Kutta 4. Ordnung (unabhängiger numerischer Weg). f(t, y[]) -> dy[] */
  function rk4(f, y0, t0, t1, steps) {
    let y = y0.slice(), t = t0; const h = (t1 - t0) / steps, out = [[t, y.slice()]];
    for (let i = 0; i < steps; i++) {
      const k1 = f(t, y), k2 = f(t + h / 2, y.map((v, j) => v + h / 2 * k1[j])), k3 = f(t + h / 2, y.map((v, j) => v + h / 2 * k2[j])), k4 = f(t + h, y.map((v, j) => v + h * k3[j]));
      y = y.map((v, j) => v + h / 6 * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j])); t += h; out.push([t, y.slice()]);
    }
    return out;
  }
  /* ================================================================ 4. Laplace, Übertragungsfunktion */
  /* Polynome: Koeffizienten mit der höchsten Potenz zuerst, [1, 2, 5] = s² + 2s + 5 */
  const trimP = p => { let i = 0; while (i < p.length - 1 && p[i] === 0) i++; return p.slice(i); };
  const polyEvalC = (p, s) => p.reduce((acc, c) => cadd(cmul(acc, s), cx(c, 0)), cx(0, 0));
  function polyDer(p) { const n = p.length - 1; return n < 1 ? [0] : p.slice(0, n).map((c, i) => c * (n - i)); }
  /* Nullstellen: Grad 1 und 2 geschlossen, sonst Durand-Kerner */
  function roots(p) {
    p = trimP(p); const n = p.length - 1; if (n < 1 || !p.every(fin)) return [];
    if (n === 1) return [cx(-p[1] / p[0], 0)];
    if (n === 2) {
      const a = p[0], b = p[1], c = p[2], d = b * b - 4 * a * c;
      if (d >= 0) { const q = Math.sqrt(d); return [cx((-b + q) / (2 * a), 0), cx((-b - q) / (2 * a), 0)]; }
      const q = Math.sqrt(-d); return [cx(-b / (2 * a), q / (2 * a)), cx(-b / (2 * a), -q / (2 * a))];
    }
    return rootsDK(p);
  }
  function rootsDK(p) {
    p = trimP(p); const n = p.length - 1; if (n < 1) return [];
    const a = p.map(c => c / p[0]); let z = []; const rad = 1 + Math.max.apply(null, a.slice(1).map(Math.abs));
    for (let k = 0; k < n; k++) z.push(cpolar(rad * 0.7, 360 * k / n + 17));
    for (let it = 0; it < 600; it++) {
      let mx = 0;
      z = z.map((zk, k) => { let den = cx(1, 0); z.forEach((zj, j) => { if (j !== k) den = cmul(den, csub(zk, zj)); }); const d = cdiv(polyEvalC(a, zk), den); mx = Math.max(mx, cabs(d)); return csub(zk, d); });
      if (mx < 1e-13) break;
    }
    return z.map(c => cx(Math.abs(c.re) < 1e-10 ? 0 : c.re, Math.abs(c.im) < 1e-10 ? 0 : c.im)).sort((x, y) => x.re - y.re || x.im - y.im);
  }
  /* Übertragungsfunktion tf = {num: [...], den: [...]} */
  const tfEval = (tf, s) => cdiv(polyEvalC(tf.num, s), polyEvalC(tf.den, s));
  const tfPoles = tf => roots(tf.den), tfZeros = tf => roots(tf.num);
  const tfDC = tf => { const d = trimP(tf.den)[trimP(tf.den).length - 1], n0 = trimP(tf.num)[trimP(tf.num).length - 1]; return d !== 0 ? n0 / d : NAN; };
  const tfAt = (tf, w) => tfEval(tf, cx(0, w));
  const dB = m => (m > 0 ? 20 * Math.log10(m) : NAN);
  /* Stabilität aus den Polen: alle Re < 0 stabil, ein Pol mit Re = 0 (einfach) grenzstabil, sonst instabil */
  function stability(poles, tol) {
    tol = tol == null ? 1e-9 : tol; if (!poles.length) return 'stabil';
    if (poles.some(p => p.re > tol)) return 'instabil';
    const on = poles.filter(p => Math.abs(p.re) <= tol);
    if (!on.length) return 'stabil';
    for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) if (cabs(csub(on[i], on[j])) < 1e-7) return 'instabil';
    return 'grenzstabil';
  }
  /* Sprungantwort über Partialbruch-Residuen (nur bei einfachen Polen von H(s)/s); sonst NaN */
  function stepAnalytic(tf, t) {
    const den = trimP(tf.den), num_ = trimP(tf.num), Y = den.concat([0]), P = roots(Y);
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (cabs(csub(P[i], P[j])) < 1e-6) return NAN;
    const dY = polyDer(Y); let y = 0;
    P.forEach(p => { const r = cdiv(polyEvalC(num_, p), polyEvalC(dY, p)); const e = Math.exp(p.re * t); y += (r.re * Math.cos(p.im * t) - r.im * Math.sin(p.im * t)) * e; });
    return y;
  }
  /* Zustandsraum (Regelungsnormalform) und Sprungantwort mit RK4: unabhängige Zweitrechnung.
     Zähler und Nenner werden mit dem höchsten Nennerkoeffizienten normiert; x_i ist die (i−1)-te Ableitung der Hilfsgröße z mit Nenner(s)·Z = U. */
  function stepNumeric(tf, t1, steps) {
    const dn = trimP(tf.den), n = dn.length - 1; if (n < 1) return [];
    const d = dn.slice().reverse().map(c => c / dn[0]);                           /* aufsteigend, d[n] = 1 */
    const nu = new Array(n + 1).fill(0), np = trimP(tf.num).slice().reverse().map(c => c / dn[0]); np.forEach((c, i) => { nu[i] = c; });
    const f = (t, x) => { const dx = new Array(n); for (let i = 0; i < n - 1; i++) dx[i] = x[i + 1]; let s = 1; for (let k = 0; k < n; k++) s -= d[k] * x[k]; dx[n - 1] = s; return dx; };
    return rk4(f, new Array(n).fill(0), 0, t1, steps).map(([t, x]) => { let y = nu[n]; for (let k = 0; k < n; k++) y += (nu[k] - nu[n] * d[k]) * x[k]; return [t, y]; });
  }  /* Korrespondenztabelle: f(t) für t ≥ 0 und F(s); fn(t, p) mit Parametern p = {a, b, w}; Fn(s, p) mit reellem s */
  const TABLE = [
    { id: 'delta', f: 'δ(t)', F: '1', imp: true, note: 'Einheitsimpuls (Dirac-Stoß)' },
    { id: 'sigma', f: 'σ(t)  (Sprung)', F: '1/s', fn: () => 1, Fn: s => 1 / s },
    { id: 'ramp', f: 't', F: '1/s²', fn: t => t, Fn: s => 1 / (s * s) },
    { id: 'par', f: 't²', F: '2/s³', fn: t => t * t, Fn: s => 2 / (s * s * s) },
    { id: 'exp', f: 'e^(−a·t)', F: '1/(s + a)', fn: (t, p) => Math.exp(-p.a * t), Fn: (s, p) => 1 / (s + p.a) },
    { id: 'one-exp', f: '1 − e^(−a·t)', F: 'a / (s·(s + a))', fn: (t, p) => 1 - Math.exp(-p.a * t), Fn: (s, p) => p.a / (s * (s + p.a)) },
    { id: 'sin', f: 'sin(ω·t)', F: 'ω / (s² + ω²)', fn: (t, p) => Math.sin(p.w * t), Fn: (s, p) => p.w / (s * s + p.w * p.w) },
    { id: 'cos', f: 'cos(ω·t)', F: 's / (s² + ω²)', fn: (t, p) => Math.cos(p.w * t), Fn: (s, p) => s / (s * s + p.w * p.w) },
    { id: 'texp', f: 't · e^(−a·t)', F: '1 / (s + a)²', fn: (t, p) => t * Math.exp(-p.a * t), Fn: (s, p) => 1 / ((s + p.a) * (s + p.a)) },
    { id: 'expsin', f: 'e^(−a·t) · sin(ω·t)', F: 'ω / ((s + a)² + ω²)', fn: (t, p) => Math.exp(-p.a * t) * Math.sin(p.w * t), Fn: (s, p) => p.w / ((s + p.a) * (s + p.a) + p.w * p.w) },
    { id: 'expcos', f: 'e^(−a·t) · cos(ω·t)', F: '(s + a) / ((s + a)² + ω²)', fn: (t, p) => Math.exp(-p.a * t) * Math.cos(p.w * t), Fn: (s, p) => (s + p.a) / ((s + p.a) * (s + p.a) + p.w * p.w) },
    { id: 'diff2', f: '(e^(−a·t) − e^(−b·t)) / (b − a)', F: '1 / ((s + a)(s + b))', fn: (t, p) => (Math.exp(-p.a * t) - Math.exp(-p.b * t)) / (p.b - p.a), Fn: (s, p) => 1 / ((s + p.a) * (s + p.b)) }
  ];
  /* Numerische Laplace-Transformierte (Simpson), nur für reelles s > 0: unabhängiger Weg zur Tabelle */
  function laplaceNumeric(fn, s, Tmax, n) {
    n = n || 40000; if (n % 2) n++; const h = Tmax / n; let sum = fn(0) + fn(Tmax) * Math.exp(-s * Tmax);
    for (let i = 1; i < n; i++) { const t = i * h; sum += (i % 2 ? 4 : 2) * fn(t) * Math.exp(-s * t); }
    return sum * h / 3;
  }
  const tableValue = (id, s, p) => { const e = TABLE.find(x => x.id === id); return e && e.Fn ? e.Fn(s, p || {}) : NAN; };

  /* ================================================================ 5. Fourier-Reihe */
  /* Signale mit der Periode 2π im Argument x = ω·t, Amplitude A (Spitzenwert). Alle drei sind ungerade: nur Sinusglieder b_n. */
  const SHAPES = { square: 'Rechteck', triangle: 'Dreieck', saw: 'Sägezahn' };
  const wrapPi = x => { let y = (x + PI) % (2 * PI); if (y < 0) y += 2 * PI; return y - PI; };
  function signal(kind, A, x) {
    if (kind === 'square') { const s = Math.sin(x); return s > 1e-12 ? A : s < -1e-12 ? -A : 0; }
    if (kind === 'triangle') return 2 * A / PI * Math.asin(Math.max(-1, Math.min(1, Math.sin(x))));
    if (kind === 'saw') return A * wrapPi(x) / PI;
    return NAN;
  }
  /* Koeffizient b_n (Amplitude der n-ten Harmonischen, mit Vorzeichen) */
  function bn(kind, A, n) {
    if (!(Number.isInteger(n) && n >= 1) || !fin(A)) return NAN;
    if (kind === 'square') return n % 2 ? 4 * A / (n * PI) : 0;
    if (kind === 'triangle') return n % 2 ? 8 * A / (PI * PI * n * n) * (((n - 1) / 2) % 2 ? -1 : 1) : 0;
    if (kind === 'saw') return 2 * A / (n * PI) * (n % 2 ? 1 : -1);
    return NAN;
  }
  const partial = (kind, A, N, x) => { let s = 0; for (let n = 1; n <= N; n++) s += bn(kind, A, n) * Math.sin(n * x); return s; };
  const harmonics = (kind, N) => { const o = []; for (let n = 1; n <= N; n++) o.push(n); return o.filter(n => bn(kind, 1, n) !== 0); };
  const rmsTotal = (kind, A) => (kind === 'square' ? Math.abs(A) : kind === 'triangle' || kind === 'saw' ? Math.abs(A) / Math.sqrt(3) : NAN);
  /* Effektivwert der Teilsumme bis N: Quadratsumme der Effektivwerte der Sinusglieder (Spitzenwert / √2) */
  function rmsPartial(kind, A, N) { let s = 0; for (let n = 1; n <= N; n++) { const b = bn(kind, A, n); s += b * b / 2; } return Math.sqrt(s); }
  /* Oberschwingungsgehalt (THD, bezogen auf die Grundschwingung) bis zur Ordnung N */
  function thd(kind, N) { let s = 0; for (let n = 2; n <= N; n++) { const b = bn(kind, 1, n); s += b * b; } const b1 = bn(kind, 1, 1); return Math.sqrt(s) / Math.abs(b1); }
  /* Klirrfaktor k (bezogen auf den Gesamteffektivwert) bis zur Ordnung N */
  function klirr(kind, N) { let s = 0, t = 0; for (let n = 1; n <= N; n++) { const b = bn(kind, 1, n); t += b * b; if (n > 1) s += b * b; } return t > 0 ? Math.sqrt(s / t) : NAN; }
  /* Grenzwerte für unendlich viele Glieder (geschlossene Formeln) */
  const thdInf = kind => (kind === 'square' ? Math.sqrt(PI * PI / 8 - 1) : kind === 'triangle' ? Math.sqrt(Math.pow(PI, 4) / 96 - 1) : kind === 'saw' ? Math.sqrt(PI * PI / 6 - 1) : NAN);
  const klirrInf = kind => { const t = thdInf(kind); return t / Math.sqrt(1 + t * t); };
  /* Integralsinus Si(x) über die Reihe (genau für x bis etwa 10) */
  function Si(x) { let s = 0, term = x; for (let k = 0; k < 60; k++) { s += term / (2 * k + 1); term *= -x * x / ((2 * k + 2) * (2 * k + 3)); } return s; }
  /* Gibbssches Phänomen: Überschwinger der Teilsummen an der Sprungstelle (Rechteck, N → ∞): Spitzenwert A·(2/π)·Si(π) */
  const gibbsFactor = () => 2 / PI * Si(PI);                       /* ≈ 1,1790 */
  const gibbsOvershoot = A => (fin(A) ? Math.abs(A) * (gibbsFactor() - 1) : NAN);   /* absolut, über dem Dachwert A */
  const gibbsPercentOfJump = () => (gibbsFactor() - 1) / 2 * 100;   /* ≈ 8,95 % des Sprungs 2A */

  /* ---------- unabhängige Zweitrechnungen ---------- */
  function simpson(fn, a, b, n) { n = n || 4096; if (n % 2) n++; const h = (b - a) / n; let s = fn(a) + fn(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fn(a + i * h); return s * h / 3; }
  function bisect(fn, a, b, it) { let fa = fn(a), fb = fn(b); if (!(fa * fb <= 0)) return NAN; for (let i = 0; i < (it || 200); i++) { const m = (a + b) / 2, fm = fn(m); if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; } } return (a + b) / 2; }
  const chk = {
    simpson, bisect, rk4,
    /* Impedanz einer Reihenschaltung über die Admittanz: Y = 1 / Z (anderer Weg als die direkte Summe), |Z| = 1 / |Y| */
    zSeriesAbsViaY(R, L, C, f) { const w = 2 * PI * f; const re = R, im = (L > 0 ? w * L : 0) - (C > 0 ? 1 / (w * C) : 0); const Y = cdiv(cx(1, 0), cx(re, im)); return 1 / Math.hypot(Y.re, Y.im); },
    /* Resonanzfrequenz: Nullstelle des Imaginärteils von Z (Bisektion) */
    f0Bisect(L, C) { const f0c = 1 / (2 * PI * Math.sqrt(L * C)); return bisect(fr => 2 * PI * fr * L - 1 / (2 * PI * fr * C), f0c / 10, f0c * 10, 300); },
    /* Bandbreite aus den −3-dB-Punkten der Stromresonanzkurve */
    bandwidthBisect(R, L, C) {
      const fr = 1 / (2 * PI * Math.sqrt(L * C)), imax = 1 / R, tgt = imax / Math.SQRT2, mag = fr_ => 1 / cabs(zSeries(R, L, C, fr_)) - tgt;
      const fu = bisect(mag, fr * 1e-3, fr, 300), fo = bisect(mag, fr, fr * 1e3, 300); return fo - fu;
    },
    /* Parallelschaltung R || C: über Admittanz Y = 1/R + jωC */
    zParRCAbs(R, C, f) { const w = 2 * PI * f; return 1 / Math.hypot(1 / R, w * C); },
    zParRLAbs(R, L, f) { const w = 2 * PI * f; return 1 / Math.hypot(1 / R, 1 / (w * L)); },
    /* Phase aus dem Kosinus: cos φ = R / |Z|, Vorzeichen aus dem Blindanteil */
    phaseViaCos(re, im) { const a = Math.acos(re / Math.hypot(re, im)) * 180 / PI; return im < 0 ? -a : a; },
    /* Betrag über z · z* */
    absViaConj(z) { return Math.sqrt(cmul(z, cconj(z)).re); },
    /* Einschwingen: RC- bzw. RL-Glied numerisch (RK4) */
    rc(R, C, U, u0, t) { const sim = rk4((_, y) => [(U - y[0]) / (R * C)], [u0], 0, t, 4000); return sim[sim.length - 1][1][0]; },
    rl(R, L, U, i0, t) { const sim = rk4((_, y) => [(U - R * y[0]) / L], [i0], 0, t, 4000); return sim[sim.length - 1][1][0]; },
    rcDischarge(R, C, U0, t) { const sim = rk4((_, y) => [-y[0] / (R * C)], [U0], 0, t, 4000); return sim[sim.length - 1][1][0]; },
    /* Zeit bis zum Anteil p: Bisektion auf der numerisch gelösten Kurve */
    timeToNumeric(p, tau) { const f = t => chk.rc(tau, 1, 1, 0, t) - p; return bisect(f, 1e-9 * tau, 40 * tau, 80); },
    rlc(R, L, C, U, t, steps) { const sim = rk4((_, y) => [y[1] / C, (U - R * y[1] - y[0]) / L], [0, 0], 0, t, steps || 20000); return sim[sim.length - 1][1][0]; },
    rlcMaxNumeric(R, L, C, U, t1) { const sim = rk4((_, y) => [y[1] / C, (U - R * y[1] - y[0]) / L], [0, 0], 0, t1, 40000); return Math.max.apply(null, sim.map(q => q[1][0])); },
    /* Dämpfungsgrad aus dem Wurzelpaar der charakteristischen Gleichung s² + (R/L)s + 1/(LC) = 0 */
    zetaFromRoots(R, L, C) { const r = roots([1, R / L, 1 / (L * C)]); const w0 = Math.sqrt(r[0].re * r[0].re + r[0].im * r[0].im); if (r[0].im !== 0) return -r[0].re / w0; const a = Math.min(Math.abs(r[0].re), Math.abs(r[1].re)), b = Math.max(Math.abs(r[0].re), Math.abs(r[1].re)); return (a + b) / (2 * Math.sqrt(a * b)); },
    fdFromRoots(R, L, C) { const r = roots([1, R / L, 1 / (L * C)]); return Math.abs(r[0].im) / (2 * PI); },
    /* kritischer Widerstand: kleinster R, bei dem die Wurzeln reell werden (Bisektion) */
    RkritBisect(L, C) { const rk = 2 * Math.sqrt(L / C); return bisect(R => (roots([1, R / L, 1 / (L * C)])[0].im !== 0 ? -1 : 1), rk * 0.05, rk * 5, 200); },
    /* Fourier: Koeffizienten numerisch (Simpson) */
    bnNumeric(kind, A, n) { return 1 / PI * simpson(x => signal(kind, A, x) * Math.sin(n * x), -PI, PI, 8192) ; },
    rmsNumeric(kind, A) { return Math.sqrt(simpson(x => Math.pow(signal(kind, A, x), 2), -PI, PI, 16384) / (2 * PI)); },
    rmsPartialNumeric(kind, A, N) { return Math.sqrt(simpson(x => Math.pow(partial(kind, A, N, x), 2), -PI, PI, 8192) / (2 * PI)); },
    /* THD aus der Teilsumme: Grundschwingung per Integral herausgezogen, Rest-Effektivwert aus der Zeitfunktion */
    thdNumeric(kind, N) {
      const f = x => partial(kind, 1, N, x), b1 = 1 / PI * simpson(x => f(x) * Math.sin(x), -PI, PI, 8192), rms = Math.sqrt(simpson(x => f(x) * f(x), -PI, PI, 8192) / (2 * PI));
      return Math.sqrt(Math.max(0, rms * rms - b1 * b1 / 2)) * Math.SQRT2 / Math.abs(b1);
    },
    klirrNumeric(kind, N) {
      const f = x => partial(kind, 1, N, x), b1 = 1 / PI * simpson(x => f(x) * Math.sin(x), -PI, PI, 8192), rms2 = simpson(x => f(x) * f(x), -PI, PI, 8192) / (2 * PI);
      return Math.sqrt(Math.max(0, rms2 - b1 * b1 / 2) / rms2);
    },
    thdSeries(kind, N) { let s = 0; const b1 = bn(kind, 1, 1); for (let n = 2; n <= N; n++) s += Math.pow(bn(kind, 1, n) / b1, 2); return Math.sqrt(s); },
    gibbsNumeric(A, N) { let mx = 0; for (let i = 1; i <= 6000; i++) { const x = 4 * PI * i / (6000 * N); mx = Math.max(mx, partial('square', A, N, x)); } return mx - A; },
    /* Netz: Spannungsteiler-Formel der Brücke */
    bridgeUd(U, R1, R2, R3, R4) { return U * (R3 / (R1 + R3) - R4 / (R2 + R4)); }
  };

  const API = { parseDe, parseDeAll, fmtDe, fmtN, fmtSig, rd, hashStr, rng, ri, pick, shuffle, PI,
    cx, cadd, csub, cmul, cdiv, cconj, cabs, carg, cargRad, cpolar, cscale, cinv, wrap180, angDiff, fmtCart, fmtPolar, parseComplex,
    omega, XL, XC, ZR, ZL, ZC, zSeries, zPar, zParList, f0, qSeries, bandwidth, iMag, power,
    det, detLaplace, gauss, cramer, inverse, matVec, matMul, netCheck, nodalSystem, nodalSolve, nodalFixed, nodalChecks, sourceCurrent, bridgeNet,
    tauRC, tauRL, firstOrder, timeTo, rlcInfo, rlcStep, sampleFn, rk4,
    trimP, polyEvalC, roots, rootsDK, tfEval, tfPoles, tfZeros, tfDC, tfAt, dB, stability, stepAnalytic, stepNumeric, TABLE, laplaceNumeric, tableValue,
    SHAPES, signal, bn, partial, harmonics, rmsTotal, rmsPartial, thd, klirr, thdInf, klirrInf, Si, gibbsFactor, gibbsOvershoot, gibbsPercentOfJump, chk };
  root.MAT2_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
