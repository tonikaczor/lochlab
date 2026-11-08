'use strict';
/* Tonfunk Hydraulik-Lab: reine Logik (ohne Oberfläche, auch per Node testbar). Lab-Kennung 'hyd'.
   Inhalt: Rechenfunktionen (Fläche, Kraft, Volumenstrom, Geschwindigkeit, Leistung, Übersetzung, Einheiten),
   Zufall (seed-fähig), Zahlenformat deutsch, Schaltungs-Solver (Druck/Volumenstrom, quasi-statisch), Ablauf-Simulation und Prüfung.

   Einheiten im ganzen Modul: Druck bar, Fläche cm², Volumenstrom l/min, Kraft N, Weg mm, Geschwindigkeit m/s, Leistung kW.
   Umrechnungen: 1 bar = 10 N/cm²; F[N] = p[bar]·A[cm²]·10; v[m/s] = Q[l/min] / (6·A[cm²]); P[kW] = p[bar]·Q[l/min] / 600.

   Solver-Modell (bewusst vereinfacht, inkompressible Flüssigkeit):
   - Leitungen, geöffnete Ventilwege und Filter sind verlustfrei und verbinden Anschlüsse zu einem Knoten (ein Druck).
   - Tank = 0 bar. Pumpe = fester Volumenstrom Q in den Knoten ihres Anschlusses P.
   - Druckbegrenzungsventil (DBV): öffnet ab Einstelldruck, Überstrom fließt zum Tank (kleine Druckerhöhung durch Steilheit).
   - Drossel: Q = K·√Δp (K aus qn = Volumenstrom bei 10 bar); Drosselrückschlagventil: gedrosselt 1→2, frei 2→1.
   - Rückschlagventil: frei 1→2, gesperrt 2→1; entsperrbar: Steueranschluss X öffnet stetig zwischen 3 und 10 bar.
   - Zylinder: Kolbengeschwindigkeit ergibt sich aus der Kräftebilanz p_A·A_A − p_B·A_B gegen Last und Reibung; Verdrängung (Q_B = Q_A·A_B/A_A).
   - Es gibt keine Leckage und keine Kompressibilität: gesperrte Kammern halten ihren Druck.
   Der Solver löst die Knotenbilanzen mit gedämpftem Newton-Verfahren (pseudo-instationär), deterministisch, ohne Zufall.
   Export: window.HYD_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(',', '.');
    s = s.replace(/(kn|n|bar|mpa|pa|kw|w|l\/min|m\/s|cm\/s|cm2|cm²|mm|cm|m|s|%)$/i, '');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, sign) {
    if (!fin(v)) return '–';
    let s = rd(v, dec == null ? 2 : dec).toFixed(dec == null ? 2 : dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    if (sign && v > 0) s = '+' + s;
    return s.replace('-', '−').replace('.', ',');
  }
  /* so viele Nachkommastellen wie nötig (höchstens max) */
  function fmtAuto(v, max) {
    if (!fin(v)) return '–';
    max = max == null ? 3 : max; let s = fmtDe(v, max);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); const t = o[j]; o[j] = o[k]; o[k] = t; } return o; }

  /* ---------------- Rechenfunktionen ---------------- */
  const areaCircle = d => Math.PI / 4 * d * d / 100;                 /* Kolbenfläche in cm² aus Durchmesser in mm */
  const ringArea = (D, d) => areaCircle(D) - areaCircle(d);           /* Ringfläche in cm² (D Kolben, d Stange in mm) */
  const force = (p, A) => p * A * 10;                                 /* Kraft in N aus p in bar und A in cm² */
  const pressureOf = (F, A) => F / (A * 10);                          /* Druck in bar aus F in N und A in cm² */
  const flowOf = (v, A) => 6 * A * v;                                 /* Volumenstrom l/min aus v in m/s und A in cm² */
  const speedOf = (Q, A) => Q / (6 * A);                              /* Geschwindigkeit m/s aus Q in l/min und A in cm² */
  const power = (p, Q) => p * Q / 600;                                /* hydraulische Leistung in kW (p bar, Q l/min) */
  const driveInPower = (Phyd, eta) => Phyd / eta;                     /* Antriebsleistung der Pumpe in kW */
  const pumpFlow = (Vg, n, etaV) => Vg * n * (etaV == null ? 1 : etaV) / 1000;   /* l/min aus Verdrängungsvolumen cm³/U und n in 1/min */
  const strokeTime = (s, v) => (s / 1000) / v;                        /* Hubzeit in s aus Hub in mm und v in m/s */
  const pressForce = (F1, A1, A2) => F1 * A2 / A1;                    /* hydraulische Presse: F2 aus F1, A1 (klein), A2 (groß) */
  const unit = {
    bar2MPa: p => p / 10, MPa2bar: p => p * 10, bar2Pa: p => p * 1e5, Pa2bar: p => p / 1e5,
    lmin2cm3s: q => q * 1000 / 60, cm3s2lmin: q => q * 60 / 1000, lmin2m3s: q => q / 60000, ms2mmin: v => v * 60
  };
  /* Zylinder-Rechner: alle Größen auf einmal */
  function cylinderCalc(o) {
    const AA = areaCircle(o.D), AB = ringArea(o.D, o.d), r = { AA, AB };
    if (fin(o.p)) { r.Fout = force(o.p, AA); r.Fin = force(o.p, AB); }
    if (fin(o.Q)) { r.vOut = speedOf(o.Q, AA); r.vIn = speedOf(o.Q, AB); if (fin(o.s)) { r.tOut = strokeTime(o.s, r.vOut); r.tIn = strokeTime(o.s, r.vIn); } }
    if (fin(o.p) && fin(o.Q)) r.Phyd = power(o.p, o.Q);
    return r;
  }

  /* ============================================================ Schaltungs-Solver */
  const PMAX = 400, PMIN = -1, FR = 100, KC = 5, GD = 300, GC = 300, VMAX = 0.3, PILOT_LO = 3, PILOT_HI = 10;
  const PORTS = {
    pump: ['P'], tank: ['T'], filter: ['1', '2'], dbv: ['P', 'T'], cyl: ['A', 'B'], cyle: ['A'],
    v43: ['P', 'T', 'A', 'B'], v42: ['P', 'T', 'A', 'B'], v32: ['P', 'T', 'A'], v22: ['P', 'A'],
    rv: ['1', '2'], rve: ['1', '2', 'X'], drossel: ['1', '2'], drv: ['1', '2'], mano: ['M']
  };
  const VALVE_POS = { v43: ['a', '0', 'b'], v42: ['a', '0'], v32: ['a', '0'], v22: ['a', '0'] };
  const MIDS = { sperr: [], umlauf: [['P', 'T']], H: [['P', 'T'], ['A', 'B'], ['A', 'T']] };   /* PRUEFEN: H = alle vier Anschlüsse verbunden */
  const isValve = p => !!VALVE_POS[p.kind];
  const isCyl = p => p.kind === 'cyl' || p.kind === 'cyle';
  function valveConn(p, pos) {
    switch (p.kind) {
      case 'v43': return pos === 'a' ? [['P', 'A'], ['B', 'T']] : pos === 'b' ? [['P', 'B'], ['A', 'T']] : (MIDS[p.mid || 'sperr'] || []);
      case 'v42': return pos === 'a' ? [['P', 'A'], ['B', 'T']] : [['P', 'B'], ['A', 'T']];
      case 'v32': return pos === 'a' ? [['P', 'A']] : [['A', 'T']];
      case 'v22': return ((pos === 'a') !== (p.rest === 'open')) ? [['P', 'A']] : [];
    }
    return [];
  }
  /* Kolbenflächen und Kraftschwellen (in bar·cm²; Reibung FR in N) */
  function cylGeom(p) {
    const D = p.D || 50, d = p.d || 28, AA = areaCircle(D), AB = p.kind === 'cyle' ? 0 : ringArea(D, d), load = p.load || { type: 'none', F: 0 }, F = load.F || 0;
    let Fa, Fb;   /* Fa: nötige Kraft zum Ausfahren, Fb: Kraft, unterhalb der der Zylinder einfährt (N, Kraft aus Druck gerechnet) */
    if (load.type === 'grav') { Fa = F + FR; Fb = F - FR; }
    else if (load.type === 'press') { Fa = F + FR; Fb = -FR; }
    else if (load.type === 'pull') { Fa = -F + FR; Fb = -F - FR; }
    else { Fa = FR; Fb = -FR; }
    if (p.kind === 'cyle') { const s = p.spring || 0; Fa += s; Fb += s; }
    return { AA, AB, Fa: Fa / 10, Fb: Fb / 10, stroke: p.stroke || 200 };
  }

  function makeState(circ) {
    const st = { v: {}, pos: {}, pset: {}, pumpOn: true, pw: {} };
    circ.parts.forEach(p => { if (isValve(p)) st.v[p.id] = p.pos0 || '0'; if (isCyl(p)) st.pos[p.id] = p.pos0 == null ? 0 : p.pos0; if (p.kind === 'dbv') st.pset[p.id] = p.pset == null ? 80 : p.pset; });
    return st;
  }
  const cloneState = st => JSON.parse(JSON.stringify(st));

  function solve(circ, lines, st) {
    lines = lines || []; st = st || makeState(circ);
    const parts = circ.parts, keys = [], idx = new Map(), byId = {};
    parts.forEach(p => { byId[p.id] = p; (PORTS[p.kind] || []).forEach(n => { idx.set(p.id + '.' + n, keys.length); keys.push(p.id + '.' + n); }); });
    const nP = keys.length, G = nP;   /* G = virtueller Masseknoten (Tank) */
    const uf = []; for (let i = 0; i <= nP; i++) uf.push(i);
    const find = i => { while (uf[i] !== i) { uf[i] = uf[uf[i]]; i = uf[i]; } return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) uf[a] = b; };
    const zero = [];   /* verlustfreie Kanten: {a,b,line} */
    lines.forEach((l, i) => { const a = idx.get(l[0]), b = idx.get(l[1]); if (a != null && b != null) { uni(a, b); zero.push({ a, b, line: i }); } else zero.push(null); });
    const L = lines.length; zero.length = L;
    const zeroInt = [];   /* innere Kanten (Ventilwege, Filter) */
    parts.forEach(p => {
      if (p.kind === 'tank') uni(idx.get(p.id + '.T'), G);
      if (p.kind === 'filter') { uni(idx.get(p.id + '.1'), idx.get(p.id + '.2')); zeroInt.push({ a: idx.get(p.id + '.1'), b: idx.get(p.id + '.2') }); }
      if (isValve(p)) valveConn(p, st.v[p.id] || '0').forEach(c => { const a = idx.get(p.id + '.' + c[0]), b = idx.get(p.id + '.' + c[1]); uni(a, b); zeroInt.push({ a, b }); });
    });
    /* Knotennummern */
    const node = new Array(nP + 1), rootNo = new Map(); let n = 0; const gRoot = find(G);
    for (let i = 0; i <= nP; i++) { const r = find(i); if (r === gRoot) node[i] = -1; else { if (!rootNo.has(r)) rootNo.set(r, n++); node[i] = rootNo.get(r); } }
    const nd = (id, port) => { const i = idx.get(id + '.' + port); return i == null ? -1 : node[i]; };
    /* Bauelemente */
    const els = [];
    parts.forEach(p => {
      if (p.kind === 'pump') els.push({ t: 'pump', p, n: nd(p.id, 'P'), Q: st.pumpOn === false ? 0 : (p.q == null ? 10 : p.q) });
      else if (p.kind === 'dbv') els.push({ t: 'dbv', p, nP: nd(p.id, 'P'), nT: nd(p.id, 'T'), pset: st.pset[p.id] == null ? (p.pset == null ? 80 : p.pset) : st.pset[p.id] });
      else if (p.kind === 'drossel') els.push({ t: 'orf', p, n1: nd(p.id, '1'), n2: nd(p.id, '2'), K: (p.qn == null ? 4 : p.qn) / Math.sqrt(10) });
      else if (p.kind === 'drv') els.push({ t: 'drv', p, n1: nd(p.id, '1'), n2: nd(p.id, '2'), K: (p.qn == null ? 4 : p.qn) / Math.sqrt(10) });
      else if (p.kind === 'rv') els.push({ t: 'rv', p, n1: nd(p.id, '1'), n2: nd(p.id, '2'), nX: -2 });
      else if (p.kind === 'rve') els.push({ t: 'rv', p, n1: nd(p.id, '1'), n2: nd(p.id, '2'), nX: nd(p.id, 'X') });
      else if (isCyl(p)) els.push({ t: 'cyl', p, g: cylGeom(p), nA: nd(p.id, 'A'), nB: p.kind === 'cyl' ? nd(p.id, 'B') : -3, pos: st.pos[p.id] || 0 });
    });
    /* Startdruck aus dem Speicher des letzten Zustands (gesperrte Kammern halten ihren Druck) */
    const P = new Array(n).fill(0), cnt = new Array(n).fill(0);
    keys.forEach((k, i) => { const nn = node[i]; if (nn >= 0 && st.pw && st.pw[k] != null) { P[nn] += st.pw[k]; cnt[nn]++; } });
    for (let i = 0; i < n; i++) if (cnt[i]) P[i] /= cnt[i];
    /* ohne Speicher: gesperrte Zylinderkammer startet mit dem Lastdruck (Haltezustand) */
    els.forEach(e => { if (e.t === 'cyl' && e.nA >= 0 && !cnt[e.nA] && e.pos > 1e-9) P[e.nA] = Math.max(0, (e.g.Fa + e.g.Fb) / 2 / e.g.AA); });
    const clampP = x => x < PMIN ? PMIN : x > PMAX ? PMAX : x;
    for (let i = 0; i < n; i++) P[i] = clampP(P[i]);
    const pv = (Pa, i) => i === -2 || i === -3 ? 0 : i < 0 ? 0 : Pa[i];
    const sat = (x, c) => x > c ? c : x < -c ? -c : x;
    /* geglättete Kennlinien (stetige Ableitung, damit das Newton-Verfahren sicher konvergiert) */
    const EPS = 0.01, smax = x => x <= -EPS ? 0 : x >= EPS ? x : (x + EPS) * (x + EPS) / (4 * EPS), smin = x => -smax(-x);
    const EG = 0.02, gate = x => { if (x <= -EG) return 0; if (x >= EG) return 1; const t = (x + EG) / (2 * EG); return t * t * (3 - 2 * t); };
    /* Fluss eines Elements: liefert {q1: Fluss aus Knoten 1 heraus, ...}; hier einheitlich über evalEl */
    function evalEl(e, Pa, out) {
      switch (e.t) {
        case 'pump': out.q = e.Q; break;
        case 'dbv': { const x = pv(Pa, e.nP) - pv(Pa, e.nT) - e.pset; out.q = GD * smax(x); break; }
        case 'orf': { const x = pv(Pa, e.n1) - pv(Pa, e.n2); out.q = e.K * x / Math.sqrt(Math.abs(x) + 0.02); break; }
        case 'drv': { const x = pv(Pa, e.n1) - pv(Pa, e.n2), g = gate(x); out.q = g * GC * x + (1 - g) * e.K * x / Math.sqrt(Math.abs(x) + 0.02); break; }
        case 'rv': {
          const x = pv(Pa, e.n1) - pv(Pa, e.n2);
          let f = 0; if (e.nX !== -2) f = Math.max(0, Math.min(1, (pv(Pa, e.nX) - PILOT_LO) / (PILOT_HI - PILOT_LO)));
          out.q = GC * x * (f + (1 - f) * gate(x));
          break;
        }
        case 'cyl': {
          const g = e.g, pA = pv(Pa, e.nA), pB = e.nB === -3 ? 0 : pv(Pa, e.nB), dF = pA * g.AA - pB * g.AB;
          let up = smax(dF - g.Fa), dn = smin(dF - g.Fb);
          if (e.pos >= 1 - 1e-9) up = 0;
          if (e.pos <= 1e-9) dn = 0;
          const qc = 6 * g.AA * VMAX, qa = sat(KC * (up + dn), qc);
          out.q = qa; out.qb = g.AB ? qa * g.AB / g.AA : 0; break;
        }
      }
    }
    const tmp = {};
    function resid(Pa, R) {
      for (let i = 0; i < n; i++) R[i] = 0;
      const add = (i, v) => { if (i >= 0) R[i] += v; };
      els.forEach(e => {
        evalEl(e, Pa, tmp);
        switch (e.t) {
          case 'pump': add(e.n, tmp.q); break;
          case 'dbv': add(e.nP, -tmp.q); add(e.nT, tmp.q); break;
          case 'orf': case 'drv': case 'rv': add(e.n1, -tmp.q); add(e.n2, tmp.q); break;
          case 'cyl': add(e.nA, -tmp.q); if (e.nB >= 0) add(e.nB, tmp.qb); break;
        }
      });
    }
    const normOf = R => { let m = 0; for (let i = 0; i < n; i++) m += R[i] * R[i]; return Math.sqrt(m); };
    /* lineares Gleichungssystem A·x = b (Gauß, Spaltenpivot); A wird verändert */
    function gauss(A, b) {
      for (let c = 0; c < n; c++) {
        let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
        if (piv !== c) { const t = A[c]; A[c] = A[piv]; A[piv] = t; const u = b[c]; b[c] = b[piv]; b[piv] = u; }
        const d = A[c][c] || 1e-12;
        for (let r = c + 1; r < n; r++) { const f = A[r][c] / d; if (f) { for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
      }
      const x = new Array(n).fill(0);
      for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / (A[r][r] || 1e-12); }
      return x;
    }
    /* Jacobi-Matrix von R numerisch (negativ: dR/dp ist negativ semidefinit, hier als -dR/dp geliefert) */
    function jac(Pa, R0) {
      const J = [], Pt = Pa.slice(), Rt = new Array(n), h = 1e-3;
      for (let i = 0; i < n; i++) J.push(new Array(n).fill(0));
      for (let j = 0; j < n; j++) { Pt[j] = Pa[j] + h; resid(Pt, Rt); Pt[j] = Pa[j]; for (let i = 0; i < n; i++) J[i][j] = -(Rt[i] - R0[i]) / h; }
      return J;
    }
    let iters = 0, converged = n === 0;
    if (n > 0) {
      /* Pseudo-Zeitverlauf: jeder Knoten hat die Kapazität 1; je Zeitschritt wird die implizite Gleichung
         (Pn − P)/dt = R(Pn) mit Newton und Schrittweitensuche exakt gelöst. Das ist robust bei Knicken und Sättigungen. */
      let R = new Array(n), dt = 0.02, Rn = new Array(n); resid(P, R);
      for (iters = 0; iters < 260; iters++) {
        if (normOf(R) < 1e-5) { converged = true; break; }
        let Pn = P.slice(), ok = false, Gn = 0;
        for (let k = 0; k < 14; k++) {
          resid(Pn, Rn);
          const G = Pn.map((x, i) => (x - P[i]) / dt - Rn[i]); Gn = normOf(G);
          if (Gn < 1e-7 * (1 + normOf(Rn))) { ok = true; break; }
          const J = jac(Pn, Rn); for (let i = 0; i < n; i++) J[i][i] += 1 / dt;
          const dp = gauss(J, G.map(x => -x)); let a = 1, acc = false;
          for (let l = 0; l < 8; l++) {
            const Pt = Pn.map((x, i) => clampP(x + a * dp[i])), Rt = new Array(n); resid(Pt, Rt);
            const Gt = normOf(Pt.map((x, i) => (x - P[i]) / dt - Rt[i]));
            if (Gt < Gn) { Pn = Pt; acc = true; break; }
            a /= 2;
          }
          if (!acc) break;
        }
        resid(Pn, Rn);
        if (ok || normOf(Pn.map((x, i) => (x - P[i]) / dt - Rn[i])) < 1e-4) { for (let i = 0; i < n; i++) P[i] = Pn[i]; R = Rn.slice(); dt = Math.min(dt * 2, 1e4); }
        else dt = Math.max(dt / 3, 1e-6);
      }
      if (normOf(R) < 0.02) converged = true;
    }
    /* ---- Ergebnisse ---- */
    const res = { converged, iters, portP: {}, cyl: {}, dbv: {}, pump: null, overp: false, kav: false, lineFlow: new Array(L).fill(0), lineP: new Array(L).fill(0), pset: {} };
    keys.forEach((k, i) => { res.portP[k] = pv(P, node[i]); });
    st.pw = {}; keys.forEach(k => { st.pw[k] = res.portP[k]; });
    const inj = new Array(nP + 1).fill(0);
    els.forEach(e => {
      const o = {}; evalEl(e, P, o); const id = e.p.id, I = pt => idx.get(id + '.' + pt);
      if (e.t === 'pump') { inj[I('P')] += o.q; res.pump = { id, p: res.portP[id + '.P'], q: o.q, kw: power(Math.max(0, res.portP[id + '.P']), o.q) }; }
      else if (e.t === 'dbv') { inj[I('P')] -= o.q; inj[I('T')] += o.q; res.dbv[id] = { q: o.q, open: o.q > 0.05, pset: e.pset }; }
      else if (e.t === 'orf' || e.t === 'drv' || e.t === 'rv') { inj[I('1')] -= o.q; inj[I('2')] += o.q; res[id] = { q: o.q }; }
      else if (e.t === 'cyl') {
        inj[I('A')] -= o.q; if (e.p.kind === 'cyl') inj[I('B')] += o.qb;
        const g = e.g, pA = res.portP[id + '.A'], pB = e.p.kind === 'cyl' ? res.portP[id + '.B'] : 0, v = o.q / (6 * g.AA);
        res.cyl[id] = { v: Math.abs(v) < 1e-3 ? 0 : v, vRaw: v, q: o.q, pA, pB, AA: g.AA, AB: g.AB, F: (pA * g.AA - pB * g.AB) * 10, dir: Math.abs(v) < 1e-3 ? 0 : v > 0 ? 1 : -1, pos: e.pos };
      }
    });
    const psets = Object.keys(res.dbv).map(k => res.dbv[k].pset), lim = psets.length ? Math.max.apply(null, psets) * 1.3 + 5 : 150;
    if (res.pump && res.pump.p > lim) res.overp = true;
    res.pset = {}; Object.keys(res.dbv).forEach(k => { res.pset[k] = res.dbv[k].pset; });
    for (let i = 0; i < n; i++) if (P[i] < -0.5) res.kav = true;
    /* Leitungsflüsse über Spannbaum der verlustfreien Kanten */
    const edges = []; zero.forEach((z, i) => { if (z) edges.push({ a: z.a, b: z.b, line: i }); }); zeroInt.forEach(z => edges.push({ a: z.a, b: z.b, line: -1 }));
    const adj = []; for (let i = 0; i <= nP; i++) adj.push([]);
    edges.forEach((e, k) => { adj[e.a].push([e.b, k, 1]); adj[e.b].push([e.a, k, -1]); });
    const seen = new Array(nP + 1).fill(false);
    parts.forEach(p => { if (p.kind === 'tank') { const t = idx.get(p.id + '.T'); inj[t] += 0; } });
    for (let s = 0; s < nP; s++) {
      if (seen[s]) continue;
      const order = [], par = {}; seen[s] = true; par[s] = null; const q = [s];
      while (q.length) { const u = q.shift(); order.push(u); adj[u].forEach(([v, k, sg]) => { if (!seen[v]) { seen[v] = true; par[v] = [u, k, sg]; q.push(v); } }); }
      let S = 0; order.forEach(u => { S += inj[u]; });
      const tankPort = order.find(u => keys[u].length && parts.some(pp => pp.kind === 'tank' && pp.id + '.T' === keys[u]));
      const sub = {}; order.forEach(u => { sub[u] = inj[u] + (u === tankPort ? -S : 0); });
      for (let i = order.length - 1; i > 0; i--) {
        const u = order[i], pr = par[u]; if (!pr) continue;
        const [pu, k, sg] = pr; sub[pu] += sub[u];
        /* Fluss child(u) -> parent(pu) = sub[u]; Kante gespeichert als a->b mit Vorzeichen sg aus Sicht pu->u (sg=1 wenn a=pu) */
        const e = edges[k];
        if (e.line >= 0) { res.lineFlow[e.line] = e.a === u ? sub[u] : -sub[u]; }
      }
    }
    lines.forEach((l, i) => { const a = idx.get(l[0]); res.lineP[i] = a == null ? 0 : res.portP[keys[a]]; });
    res.maxP = 0; for (let i = 0; i < n; i++) if (P[i] > res.maxP) res.maxP = P[i];
    return res;
  }

  /* ---------------- Ablauf-Simulation (Ventile stellen, Zylinder laufen bis zum Anschlag) ---------------- */
  function cylList(circ) { return circ.parts.filter(isCyl); }
  function runStep(circ, lines, st, set, opt) {
    opt = opt || {};
    if (set) Object.keys(set).forEach(k => { if (k === 'pumpOn') st.pumpOn = !!set[k]; else if (k.slice(0, 5) === 'pset:') st.pset[k.slice(5)] = set[k]; else st.v[k] = set[k]; });
    const cyls = cylList(circ), tr = { cyl: {}, legs: [], maxPump: 0, overp: false, kav: false, res: null, t: 0 };
    cyls.forEach(c => { tr.cyl[c.id] = { pos0: st.pos[c.id], pos1: st.pos[c.id], dist: 0, time: 0, vavg: 0 }; });
    let res;
    for (let it = 0; it < 14; it++) {
      res = solve(circ, lines, st);
      tr.maxPump = Math.max(tr.maxPump, res.pump ? res.pump.p : 0); if (res.overp) tr.overp = true; if (res.kav) tr.kav = true;
      const mov = cyls.filter(c => Math.abs(res.cyl[c.id].v) > 1e-3);
      if (!mov.length) break;
      let dt = Infinity; const lim = {};
      mov.forEach(c => {
        const v = res.cyl[c.id].v, s = (c.stroke || 200) / 1000, pos = st.pos[c.id];
        let dist = (v > 0 ? 1 - pos : pos) * s, t = dist / Math.abs(v);
        if (opt.stopAt && opt.stopAt.c === c.id) { const d2 = (opt.stopAt.pos - pos) * s * (v > 0 ? 1 : -1); if (d2 > 1e-9) { const t2 = d2 / Math.abs(v); if (t2 < t) { t = t2; lim[c.id] = true; } } }
        if (t < dt) dt = t;
      });
      if (!(dt < Infinity)) break;
      mov.forEach(c => {
        const v = res.cyl[c.id].v, s = (c.stroke || 200) / 1000, p0 = st.pos[c.id];
        let p1 = p0 + v * dt / s; if (p1 >= 1 - 1e-9) p1 = 1; if (p1 <= 1e-9) p1 = 0;
        if (opt.stopAt && opt.stopAt.c === c.id && Math.abs(p1 - opt.stopAt.pos) < 1e-6) p1 = opt.stopAt.pos;
        st.pos[c.id] = p1; const T = tr.cyl[c.id]; T.dist += Math.abs(p1 - p0) * s; T.time += dt;
      });
      tr.t += dt; tr.legs.push({ t: dt });
      if (opt.stopAt && Math.abs(st.pos[opt.stopAt.c] - opt.stopAt.pos) < 1e-6) { res = solve(circ, lines, st); break; }
    }
    cyls.forEach(c => { const T = tr.cyl[c.id]; T.pos1 = st.pos[c.id]; T.vavg = T.time > 0 ? T.dist / T.time : 0; });
    tr.res = res; tr.pEnd = res.pump ? res.pump.p : 0;
    return tr;
  }

  /* Prüfung einer Verschlauchung gegen den geforderten Ablauf.
     seq = { steps:[{ name, set:{V1:'a'}, stopAt:{c:'Z1',pos:.5}, expect:[{t:'ext'|'ret'|'hold'|'vmax'|'vmin'|'pmax'|'pmin', c, to, v, msg}] }] }
     Meldet nur WAS nicht funktioniert (Verhalten), nie welche Leitung. */
  function runSeq(circ, lines, seq, startSt) {
    const st = startSt || makeState(circ), steps = [], names = {}; cylList(circ).forEach(c => { names[c.id] = c.label || c.id; });
    let ok = true, overpMsg = false, kavMsg = false;
    seq.steps.forEach((step, si) => {
      const tr = runStep(circ, lines, st, step.set || {}, { stopAt: step.stopAt }), items = [];
      (step.expect || []).forEach(ex => {
        const T = ex.c ? tr.cyl[ex.c] : null, nm = ex.c ? names[ex.c] || ex.c : '', mv = T ? T.pos1 - T.pos0 : 0;
        let good = true, msg = ex.msg || '';
        switch (ex.t) {
          case 'ext': good = !!T && T.pos1 >= (ex.to == null ? 1 : ex.to) - 0.02; if (!good && !ex.msg) msg = mv < -0.005 ? nm + ' fährt in die falsche Richtung (ein statt aus).' : Math.abs(mv) < 0.005 ? nm + ' fährt nicht aus.' : nm + ' bleibt auf halbem Weg stehen.'; break;
          case 'ret': good = !!T && T.pos1 <= (ex.to == null ? 0 : ex.to) + 0.02; if (!good && !ex.msg) msg = mv > 0.005 ? nm + ' fährt in die falsche Richtung (aus statt ein).' : Math.abs(mv) < 0.005 ? nm + ' fährt nicht ein.' : nm + ' bleibt auf halbem Weg stehen.'; break;
          case 'hold': good = !!T && Math.abs(mv) <= 0.005; if (!good && !ex.msg) msg = nm + ' hält die Stellung nicht: Er bewegt sich von allein.'; break;
          case 'vmax': good = !!T && T.time > 0 && T.vavg <= ex.v; if (!good && !ex.msg) msg = T && T.time > 0 ? nm + ' fährt zu schnell: Die Geschwindigkeit ist nicht (oder in der falschen Richtung) gedrosselt.' : nm + ' fährt nicht.'; break;
          case 'vmin': good = !!T && T.time > 0 && T.vavg >= ex.v; if (!good && !ex.msg) msg = T && T.time > 0 ? nm + ' fährt zu langsam: Die Drossel wirkt hier, obwohl sie umgangen werden soll.' : nm + ' fährt nicht.'; break;
          case 'pmax': good = tr.pEnd <= ex.v; if (!good && !ex.msg) msg = 'Die Pumpe läuft in dieser Stellung unter Druck (' + fmtDe(tr.pEnd, 0) + ' bar), sie sollte drucklos in den Tank fördern.'; break;
          case 'pmin': good = tr.pEnd >= ex.v; if (!good && !ex.msg) msg = 'Der Druck baut sich nicht auf (nur ' + fmtDe(tr.pEnd, 0) + ' bar): Die Pumpe fördert drucklos in den Tank oder das Ventil schaltet nicht.'; break;
        }
        if (!good && (ex.t === 'vmax' || ex.t === 'vmin' || ex.t === 'pmin') && items.some(i => !i.ok && (i.t === 'ext' || i.t === 'ret'))) { ok = false; items.push({ ok: false, text: '', t: ex.t, hidden: true }); return; }
        items.push({ ok: good, text: good ? (ex.okText || '') : msg, t: ex.t });
        if (!good) ok = false;
      });
      if (tr.overp && !overpMsg) { overpMsg = true; ok = false; items.push({ ok: false, text: 'Der Druck steigt unzulässig an: Die Pumpe hat keinen Weg zum Tank, der den Druck begrenzt (Druckbegrenzungsventil fehlt oder falsch angeschlossen).', t: 'overp' }); }
      if (tr.kav && !kavMsg && step.noKav) { kavMsg = true; ok = false; items.push({ ok: false, text: 'In einer Kammer entsteht Unterdruck (Kavitation): Die Last läuft schneller, als die Pumpe nachfördert.', t: 'kav' }); }
      steps.push({ name: step.name || ('Schritt ' + (si + 1)), ok: items.every(i => i.ok), items, tr });
    });
    return { ok, steps, state: st };
  }

  const api = {
    parseDe, fmtDe, fmtAuto, rng, hashStr, ri, pick, shuffle,
    areaCircle, ringArea, force, pressureOf, flowOf, speedOf, power, driveInPower, pumpFlow, strokeTime, pressForce, unit, cylinderCalc,
    PORTS, VALVE_POS, MIDS, isValve, isCyl, valveConn, cylGeom, makeState, cloneState, solve, runStep, runSeq,
    CONST: { PMAX, PMIN, FR, KC, GD, GC, VMAX, PILOT_LO, PILOT_HI }
  };
  root.HYD_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
