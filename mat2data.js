'use strict';
/* Tonfunk Mathe-Brücke: Daten (Themen, Erklärtexte, Aufgaben-Generatoren). Kennung 'mat2'.
   window.MAT2_DATA { topics, explain, tasks, gens, make(t, R), makeTask(t), randomQ(R, level, topic) }
   window.MAT2_TASKS Kurzliste für Karriere/Lernpfad: [{id, cat, title, level}] (Status in localStorage 'lm4.mat2.done' = {id:true})
   Alle Zahlen entstehen aus MAT2_CORE: jede Aufgabe hat einen Generator mit festem Seed (id), q.value ist die Hauptrechnung,
   q.alt eine unabhängige Zweitrechnung (anderer Rechenweg), die der Test dagegen prüft. Keine Zahl der Lösung steht von Hand im Text.
   Stufe des Labs: 'studium' (siehe LAB-META.json). */
(function (root) {
  const C = () => root.MAT2_CORE;
  const f = (v, d) => C().fmtN(v, d == null ? 2 : d, true);
  const sg = (v, n) => C().fmtSig(v, n == null ? 3 : n);
  const PI = Math.PI;
  /* Zahl mit Vorsatz, z. B. eng(4.7e-6, 'F') = "4,7 µF" */
  function eng(v, u) {
    const P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']], a = Math.abs(v);
    const p = P.find(x => a >= x[0] * 0.9999999) || P[P.length - 1];
    return f(v / p[0], 3) + ' ' + p[1] + u;
  }
  const CATS = ['Komplexe Wechselstromrechnung', 'Matrizen und Knotenpotenzial', 'Differenzialgleichungen RC, RL, RLC', 'Laplace-Einstieg', 'Fourier-Reihe'];
  const TOPICS = [
    { k: 'cx', icon: '∠', name: 'Komplexe Wechselstromrechnung', short: 'Komplex' },
    { k: 'mx', icon: '▦', name: 'Matrizen und Knotenpotenzial', short: 'Matrizen' },
    { k: 'de', icon: '∫', name: 'Differenzialgleichungen RC, RL, RLC', short: 'DGL' },
    { k: 'lp', icon: 'ℒ', name: 'Laplace-Einstieg', short: 'Laplace' },
    { k: 'fo', icon: '∿', name: 'Fourier-Reihe', short: 'Fourier' }
  ];

  const numQ = o => ({ text: o.text, ask: { type: 'num', unit: o.unit, label: o.label }, value: o.value, alt: o.alt, tol: o.tol, expl: o.expl, tips: o.tips, mod360: !!o.mod360 });
  function choiceQ(R, o) {
    const ch = C().shuffle(R, [o.right].concat(o.wrong));
    return { text: o.text, ask: { type: 'choice', choices: ch, correct: ch.indexOf(o.right) }, value: ch.indexOf(o.right), alt: ch.indexOf(o.altRight == null ? o.right : o.altRight), tol: 0, expl: o.expl, tips: o.tips };
  }
  const tolOf = (v, rel, min) => Math.max(min, Math.abs(v) * rel);
  const sgn = s => (s < 0 ? '−' : '+');
  const pk = (R, a) => C().pick(R, a), ri = (R, a, b) => C().ri(R, a, b);
  const mm = (M, d) => M.map(r => '(' + r.map(v => f(v, d == null ? 0 : d)).join('  ') + ')').join('   ');
  const ng = v => (v < 0 ? '(−' + f(-v, 0) + ')' : f(v, 0));   /* negative Zahl in Klammern, echtes Minuszeichen */
  const par = (v, d) => (v < 0 ? '(' + f(v, d) + ')' : f(v, d));
  const jn = (a, s) => a.map(v => f(v, 3)).join(s);
  const tri = (A, a, b, c) => ng(A[0][a]) + '·' + ng(A[1][b]) + '·' + ng(A[2][c]);

  /* ================================================================ Komplex (cx) */
  const FS = [50, 400, 1000, 2000, 5000, 10000], LS = [1e-3, 2.2e-3, 4.7e-3, 10e-3, 47e-3, 100e-3], CS = [47e-9, 100e-9, 220e-9, 470e-9, 1e-6, 4.7e-6, 10e-6];
  function seriesQ(R, o) {
    /* gemeinsamer Aufbau für Reihen-RLC: R, L, C, f */
    const Rr = pk(R, [10, 22, 47, 100, 220, 470]), L = pk(R, LS), Cc = pk(R, CS), fr = pk(R, [500, 1000, 2000, 3000, 5000]);
    return { Rr, L, Cc, fr };
  }
  const G = {};
  G.cx1 = R => {
    const c = C(), Rr = ri(R, 2, 24) * 5, X = ri(R, 2, 24) * 5, s = pk(R, [1, -1]), v = c.cabs(c.cx(Rr, s * X));
    return numQ({ text: 'Eine Impedanz hat den Wirkanteil R = ' + Rr + ' Ω und den Blindanteil X = ' + (s * X < 0 ? '−' : '') + X + ' Ω, also Z = ' + Rr + ' Ω ' + sgn(s) + ' j' + X + ' Ω. Wie groß ist der Betrag |Z|?', unit: 'Ω', label: 'Betrag |Z|', value: v, alt: c.chk.absViaConj(c.cx(Rr, s * X)), tol: tolOf(v, 0.005, 0.02),
      expl: ['Der Betrag ist die Länge des Zeigers in der komplexen Ebene (Satz des Pythagoras): |Z| = √(R² + X²).', 'Einsetzen: |Z| = √(' + Rr + '² + ' + X + '²) = √(' + (Rr * Rr) + ' + ' + (X * X) + ') = √' + (Rr * Rr + X * X) + '.', 'Ergebnis: |Z| = ' + f(v, 2) + ' Ω. Das Vorzeichen von X spielt für den Betrag keine Rolle.'],
      tips: ['Skizziere Z als Zeiger: R nach rechts, X nach oben (induktiv) oder unten (kapazitiv). Der Betrag ist die Zeigerlänge.', '|Z| = √(R² + X²). Das Vorzeichen von X fällt beim Quadrieren weg.', 'Rechne ' + Rr + '² + ' + X + '² = ' + (Rr * Rr + X * X) + ' und ziehe die Wurzel.'] });
  };
  G.cx2 = R => {
    const c = C(), Rr = ri(R, 2, 24) * 5, X = ri(R, 2, 24) * 5, s = pk(R, [1, -1]), z = c.cx(Rr, s * X), v = c.carg(z);
    return numQ({ text: 'Für die Impedanz Z = ' + Rr + ' Ω ' + sgn(s) + ' j' + X + ' Ω: Wie groß ist der Phasenwinkel φ = arg(Z) in Grad (zwischen −180° und 180°)?', unit: '°', label: 'Phasenwinkel φ', value: v, alt: c.chk.phaseViaCos(z.re, z.im), tol: 0.2, mod360: true,
      expl: ['Der Phasenwinkel ist der Winkel des Zeigers zur reellen Achse: tan φ = X / R (bei R > 0).', 'tan φ = ' + (s < 0 ? '−' : '') + X + ' / ' + Rr + ' = ' + f(s * X / Rr, 4) + '.', 'φ = arctan(' + f(s * X / Rr, 4) + ') = ' + f(v, 2) + '°. ' + (s < 0 ? 'Negativ: die Spannung eilt dem Strom nach, die Impedanz ist kapazitiv.' : 'Positiv: die Spannung eilt dem Strom vor, die Impedanz ist induktiv.')],
      tips: ['Der Winkel hängt nur vom Verhältnis Blindanteil zu Wirkanteil ab. Das Vorzeichen sagt, ob induktiv (+) oder kapazitiv (−).', 'φ = arctan(X / R) mit dem Vorzeichen von X, bei positivem R im Bereich −90° bis +90°.', 'X / R = ' + f(s * X / Rr, 4) + '. Davon den arctan bilden (Rechner im Gradmaß).'] });
  };
  G.cx3 = R => {
    const c = C(), r = pk(R, [20, 50, 100, 200]), ph = pk(R, [30, 45, 60, -30, -45, -60]), z = c.cpolar(r, ph), v = z.im, re = z.re;
    const alt = (Math.sin(ph * PI / 180) >= 0 ? 1 : -1) * Math.sqrt(Math.max(0, r * r - re * re));
    return numQ({ text: 'Eine Impedanz ist in Polarform gegeben: Z = ' + r + ' Ω ∠ ' + f(ph, 0) + '°. Wie groß ist der Blindanteil X (Imaginärteil) in kartesischer Form Z = R + jX?', unit: 'Ω', label: 'Blindanteil X', value: v, alt, tol: tolOf(v, 0.005, 0.02),
      expl: ['Umrechnung polar → kartesisch: R = |Z|·cos φ und X = |Z|·sin φ.', 'X = ' + r + ' Ω · sin(' + f(ph, 0) + '°) = ' + r + ' · ' + f(Math.sin(ph * PI / 180), 4) + ' = ' + f(v, 2) + ' Ω.', 'Zur Kontrolle: R = ' + r + ' · cos(' + f(ph, 0) + '°) = ' + f(re, 2) + ' Ω; es gilt R² + X² = |Z|² = ' + (r * r) + ' Ω².'],
      tips: ['Zeichne den Zeiger mit Länge |Z| unter dem Winkel φ. Der Imaginärteil ist seine Höhe über der reellen Achse.', 'X = |Z| · sin φ (der Wirkanteil wäre R = |Z| · cos φ).', 'Rechner auf Grad stellen und ' + r + ' · sin(' + f(ph, 0) + '°) eintippen.'] });
  };
  G.cx4 = R => {
    const c = C(), fr = pk(R, FS), L = pk(R, LS), v = c.XL(fr, L);
    return numQ({ text: 'Eine ideale Spule mit L = ' + eng(L, 'H') + ' liegt an einer Wechselspannung mit f = ' + eng(fr, 'Hz') + '. Wie groß ist der induktive Blindwiderstand X_L? (Als Impedanz: Z_L = jX_L.)', unit: 'Ω', label: 'Blindwiderstand X_L', value: v, alt: L * 2 * PI / (1 / fr), tol: tolOf(v, 0.005, 0.005),
      expl: ['Kreisfrequenz: ω = 2π·f = 2π · ' + f(fr, 0) + ' Hz = ' + f(2 * PI * fr, 2) + ' 1/s.', 'X_L = ω·L = ' + f(2 * PI * fr, 2) + ' · ' + sg(L, 4) + ' H = ' + f(v, 3) + ' Ω.', 'In komplexer Schreibweise: Z_L = jωL = j' + f(v, 2) + ' Ω (Spannung eilt dem Strom um 90° vor).'],
      tips: ['Ein Blindwiderstand wächst bei der Spule mit der Frequenz. Zuerst die Kreisfrequenz bilden.', 'X_L = ω·L mit ω = 2π·f.', 'ω = 2π · ' + f(fr, 0) + ' = ' + f(2 * PI * fr, 2) + ' 1/s, dann mal L in Henry.'] });
  };
  G.cx5 = R => {
    const c = C(), fr = pk(R, FS), Cc = pk(R, CS), v = c.XC(fr, Cc);
    return numQ({ text: 'Ein idealer Kondensator mit C = ' + eng(Cc, 'F') + ' liegt an einer Wechselspannung mit f = ' + eng(fr, 'Hz') + '. Wie groß ist der Betrag des kapazitiven Blindwiderstands X_C?', unit: 'Ω', label: 'Blindwiderstand X_C', value: v, alt: 1 / fr / (2 * PI * Cc), tol: tolOf(v, 0.005, 0.02),
      expl: ['Kreisfrequenz: ω = 2π·f = ' + f(2 * PI * fr, 2) + ' 1/s.', 'X_C = 1 / (ω·C) = 1 / (' + f(2 * PI * fr, 2) + ' · ' + sg(Cc, 4) + ') Ω = ' + f(v, 3) + ' Ω.', 'In komplexer Schreibweise: Z_C = 1/(jωC) = −j/(ωC) = −j' + f(v, 2) + ' Ω (der Strom eilt der Spannung um 90° vor).'],
      tips: ['Beim Kondensator sinkt der Blindwiderstand mit steigender Frequenz und steigender Kapazität.', 'X_C = 1 / (ω·C) mit ω = 2π·f. In komplexer Form hat Z_C ein Minuszeichen vor dem j.', 'Nenner: 2π · ' + f(fr, 0) + ' Hz · ' + sg(Cc, 3) + ' F, davon der Kehrwert.'] });
  };
  G.cx6 = R => {
    const c = C(), o = seriesQ(R), z = c.zSeries(o.Rr, o.L, o.Cc, o.fr), v = c.cabs(z), xl = c.XL(o.fr, o.L), xc = c.XC(o.fr, o.Cc);
    return numQ({ text: 'Reihenschaltung aus R = ' + o.Rr + ' Ω, L = ' + eng(o.L, 'H') + ' und C = ' + eng(o.Cc, 'F') + ' bei f = ' + eng(o.fr, 'Hz') + '. Wie groß ist der Betrag der Gesamtimpedanz |Z|?', unit: 'Ω', label: 'Betrag |Z|', value: v, alt: c.chk.zSeriesAbsViaY(o.Rr, o.L, o.Cc, o.fr), tol: tolOf(v, 0.005, 0.02),
      expl: ['Blindwiderstände: X_L = 2πfL = ' + f(xl, 2) + ' Ω, X_C = 1/(2πfC) = ' + f(xc, 2) + ' Ω.', 'In Reihe addieren sich die Impedanzen: Z = R + jX_L − jX_C = ' + o.Rr + ' Ω ' + sgn(xl - xc) + ' j' + f(Math.abs(xl - xc), 2) + ' Ω (X = ' + f(xl - xc, 2) + ' Ω).', '|Z| = √(R² + X²) = √(' + o.Rr + '² + ' + par(xl - xc, 2) + '²) = ' + f(v, 2) + ' Ω.'],
      tips: ['Bei der Reihenschaltung addierst du die komplexen Impedanzen. Spule und Kondensator wirken gegeneinander.', 'Z = R + j(X_L − X_C) und danach der Betrag √(R² + X²).', 'Erst X_L = 2πfL und X_C = 1/(2πfC) einzeln ausrechnen, dann die Differenz bilden.'] });
  };
  G.cx7 = R => {
    const c = C(), Rr = pk(R, [47, 100, 220, 470]), L = pk(R, [10e-3, 22e-3, 47e-3, 100e-3]), fr = pk(R, [50, 100, 400, 1000]), U = pk(R, [5, 12, 24, 230]);
    const z = c.zSeries(Rr, L, 0, fr), I = c.cdiv(c.cx(U, 0), z), v = c.cabs(I) * 1000;
    return numQ({ text: 'Eine Reihenschaltung aus R = ' + Rr + ' Ω und L = ' + eng(L, 'H') + ' liegt an U = ' + U + ' V (Effektivwert) bei f = ' + f(fr, 0) + ' Hz. Wie groß ist der Effektivwert des Stroms?', unit: 'mA', label: 'Strom I', value: v, alt: U / c.chk.zSeriesAbsViaY(Rr, L, 0, fr) * 1000, tol: tolOf(v, 0.005, 0.02),
      expl: ['X_L = 2πfL = ' + f(c.XL(fr, L), 2) + ' Ω, also Z = ' + Rr + ' Ω + j' + f(c.XL(fr, L), 2) + ' Ω = ' + f(c.cabs(z), 2) + ' Ω ∠ ' + f(c.carg(z), 1) + '°.', 'Ohmsches Gesetz für Effektivwerte: I = U / |Z| = ' + U + ' V / ' + f(c.cabs(z), 2) + ' Ω = ' + f(c.cabs(I), 5) + ' A.', 'I = ' + f(v, 2) + ' mA. Der Strom eilt der Spannung um ' + f(c.carg(z), 1) + '° nach (induktive Last, φ = +' + f(c.carg(z), 1) + '°).'],
      tips: ['Ohm gilt auch im Wechselstromkreis, aber mit dem Betrag der Impedanz.', 'I = U / |Z| mit |Z| = √(R² + X_L²).', 'X_L = 2π · ' + f(fr, 0) + ' · L ausrechnen, dann |Z| bilden, dann U durch |Z| teilen. Ergebnis in mA umrechnen.'] });
  };
  G.cx8 = R => {
    const c = C(), Rr = pk(R, [100, 220, 470, 1000, 4700]), Cc = pk(R, [47e-9, 100e-9, 220e-9, 470e-9, 1e-6]), fr = pk(R, [500, 1000, 2000, 5000]);
    const z = c.zPar(c.ZR(Rr), c.ZC(fr, Cc)), v = c.cabs(z), w = 2 * PI * fr, B = w * Cc, Y = Math.hypot(1 / Rr, B);
    return numQ({ text: 'Ein Widerstand R = ' + Rr + ' Ω liegt parallel zu einem Kondensator C = ' + eng(Cc, 'F') + ' bei f = ' + eng(fr, 'Hz') + '. Wie groß ist der Betrag der Gesamtimpedanz |Z|?', unit: 'Ω', label: 'Betrag |Z|', value: v, alt: c.chk.zParRCAbs(Rr, Cc, fr), tol: tolOf(v, 0.005, 0.02),
      expl: ['Parallel addieren sich die Admittanzen (Leitwerte): Y = 1/R + jωC.', 'G = 1/R = ' + sg(1 / Rr, 4) + ' S, B = ωC = ' + sg(B, 4) + ' S, |Y| = √(G² + B²) = ' + sg(Y, 4) + ' S.', '|Z| = 1 / |Y| = ' + f(v, 2) + ' Ω. (Kontrolle: Z = ' + c.fmtCart(z, 2) + ' Ω, der Betrag ist kleiner als R.)'],
      tips: ['Bei Parallelschaltung rechnest du mit den Kehrwerten, im Komplexen also mit der Admittanz Y.', 'Y = 1/R + jωC, dann |Z| = 1 / |Y|. Der Betrag von Y ist √(G² + B²).', 'G = 1/' + Rr + ' S und B = 2π · ' + f(fr, 0) + ' · C. Beide quadrieren, addieren, Wurzel, Kehrwert.'] });
  };
  G.cx9 = R => {
    const c = C(), L = pk(R, [1e-3, 2.2e-3, 4.7e-3, 10e-3, 22e-3]), Cc = pk(R, [10e-9, 22e-9, 47e-9, 100e-9, 220e-9]), v = c.f0(L, Cc) / 1000;
    return numQ({ text: 'Ein Reihenschwingkreis besteht aus L = ' + eng(L, 'H') + ' und C = ' + eng(Cc, 'F') + ' (dazu ein kleiner Verlustwiderstand). Bei welcher Frequenz liegt die Resonanz?', unit: 'kHz', label: 'Resonanzfrequenz f₀', value: v, alt: c.chk.f0Bisect(L, Cc) / 1000, tol: tolOf(v, 0.005, 0.005),
      expl: ['Resonanz heißt: Der Blindanteil der Impedanz verschwindet, X_L = X_C, also ωL = 1/(ωC).', 'Das liefert ω₀² = 1/(LC) und die Thomson-Formel f₀ = 1 / (2π·√(LC)).', 'f₀ = 1 / (2π · √(' + sg(L, 4) + ' · ' + sg(Cc, 4) + ')) = ' + f(v * 1000, 1) + ' Hz = ' + f(v, 3) + ' kHz.'],
      tips: ['Bei Resonanz heben sich der induktive und der kapazitive Blindwiderstand auf.', 'f₀ = 1 / (2π·√(L·C)) (Thomson).', 'L·C in Henry mal Farad ausrechnen (Zehnerpotenzen beachten), Wurzel ziehen, mit 2π multiplizieren, Kehrwert, durch 1000 für kHz.'] });
  };
  G.cx10 = R => {
    const c = C(), Rr = pk(R, [5, 10, 20, 50]), L = pk(R, [1e-3, 2.2e-3, 4.7e-3, 10e-3]), Cc = pk(R, [10e-9, 22e-9, 47e-9, 100e-9]), fr = c.f0(L, Cc), Q = c.qSeries(Rr, L, Cc), v = c.bandwidth(fr, Q);
    return numQ({ text: 'Ein Reihenschwingkreis: R = ' + Rr + ' Ω, L = ' + eng(L, 'H') + ', C = ' + eng(Cc, 'F') + '. Wie groß ist die Bandbreite B zwischen den beiden Frequenzen, bei denen der Strom auf 1/√2 seines Maximalwerts gefallen ist?', unit: 'Hz', label: 'Bandbreite B', value: v, alt: c.chk.bandwidthBisect(Rr, L, Cc), tol: tolOf(v, 0.01, 0.1),
      expl: ['Resonanzfrequenz: f₀ = 1/(2π√(LC)) = ' + f(fr, 1) + ' Hz.', 'Güte: Q = (1/R)·√(L/C) = ' + f(Q, 3) + '.', 'Bandbreite: B = f₀ / Q = ' + f(fr, 1) + ' Hz / ' + f(Q, 3) + ' = ' + f(v, 1) + ' Hz. (Gleichwertig: B = R / (2πL).)'],
      tips: ['Die Bandbreite beschreibt, wie scharf die Resonanzkurve ist. Je größer die Güte Q, desto kleiner B.', 'B = f₀ / Q mit f₀ = 1/(2π√(LC)) und Q = (1/R)·√(L/C).', 'Rechne zuerst f₀ und Q einzeln aus und teile dann.'] });
  };
  G.cx11 = R => {
    const c = C(), Rr = pk(R, [47, 100, 220, 470]), L = pk(R, [10e-3, 22e-3, 47e-3, 100e-3]), fr = pk(R, [50, 100, 400, 1000]), U = pk(R, [12, 24, 230]);
    const z = c.zSeries(Rr, L, 0, fr), Uc = c.cx(U, 0), I = c.cdiv(Uc, z), pw = c.power(Uc, I), v = pw.P, zabs = c.chk.zSeriesAbsViaY(Rr, L, 0, fr);
    return numQ({ text: 'Reihenschaltung aus R = ' + Rr + ' Ω und L = ' + eng(L, 'H') + ' an U = ' + U + ' V (Effektivwert, f = ' + f(fr, 0) + ' Hz). Wie groß ist die Wirkleistung P?', unit: 'W', label: 'Wirkleistung P', value: v, alt: Math.pow(U / zabs, 2) * Rr, tol: tolOf(v, 0.005, 0.0005),
      expl: ['Z = R + jωL = ' + Rr + ' Ω + j' + f(c.XL(fr, L), 2) + ' Ω, |Z| = ' + f(c.cabs(z), 2) + ' Ω, φ = ' + f(c.carg(z), 2) + '°.', 'Strom: I = U / |Z| = ' + f(c.cabs(I), 4) + ' A.', 'Wirkleistung: P = U·I·cos φ = ' + U + ' · ' + f(c.cabs(I), 4) + ' · ' + f(Math.cos(c.carg(z) * PI / 180), 4) + ' = ' + f(v, 3) + ' W. Kontrolle: P = I²·R = ' + f(Math.pow(c.cabs(I), 2) * Rr, 3) + ' W (nur der Widerstand setzt Wirkleistung um).'],
      tips: ['Wirkleistung entsteht nur im ohmschen Anteil. Der Blindanteil pendelt Energie hin und her.', 'P = I²·R mit I = U / |Z| (oder P = U·I·cos φ).', 'Berechne |Z| = √(R² + (ωL)²), dann I = U/|Z|, dann I²·R.'] });
  };

  /* ================================================================ Matrizen (mx) */
  const RK = [1, 2, 2.2, 3.3, 4.7, 10];       /* kΩ */
  function intMatrix(R, n, lo, hi, minDet) {
    const c = C();
    for (let k = 0; k < 400; k++) {
      const A = Array.from({ length: n }, () => Array.from({ length: n }, () => ri(R, lo, hi)));
      if (Math.abs(c.detLaplace(A)) >= minDet) return A;
    }
    return n === 2 ? [[2, 1], [1, 3]] : [[2, 1, 0], [1, 3, 1], [0, 1, 2]];
  }
  const eqLine = (row, vars, rhs) => { const t = []; row.forEach((v, j) => { if (v === 0) return; t.push((t.length === 0 ? (v < 0 ? '−' : '') : (v < 0 ? ' − ' : ' + ')) + (Math.abs(v) === 1 ? '' : Math.abs(v)) + vars[j]); }); return (t.join('') || '0') + ' = ' + f(rhs, 3); };
  G.mx1 = R => {
    const c = C(), A = intMatrix(R, 2, -6, 9, 4), x = [ri(R, 1, 8), ri(R, 1, 8)], b = c.matVec(A, x), k = ri(R, 0, 1), g = c.gauss(A, b), v = g.x[k], d = c.det(A);
    const vars = ['I₁', 'I₂'];
    return numQ({ text: 'Gegeben sind zwei lineare Gleichungen für die Ströme I₁ und I₂ (Koeffizienten als Zahlenwerte, Ströme in A):  I) ' + eqLine(A[0], vars, b[0]) + '   II) ' + eqLine(A[1], vars, b[1]) + '.  Wie groß ist ' + vars[k] + '?', unit: 'A', label: 'Strom ' + vars[k], value: v, alt: c.cramer(A, b)[k], tol: 0.01,
      expl: ['Matrixform A·x = b mit A = ' + mm(A) + ' und b = (' + jn(b, '  ') + ').', 'Determinante: det A = ' + ng(A[0][0]) + '·' + ng(A[1][1]) + ' − ' + ng(A[0][1]) + '·' + ng(A[1][0]) + ' = ' + f(d, 0) + ' (ungleich 0, also eindeutig lösbar).', 'Cramer: I₁ = det(A₁)/det A = ' + ng(c.detLaplace([[b[0], A[0][1]], [b[1], A[1][1]]])) + ' / ' + ng(d) + ' = ' + f(g.x[0], 3) + ' A und I₂ = ' + ng(c.detLaplace([[A[0][0], b[0]], [A[1][0], b[1]]])) + ' / ' + ng(d) + ' = ' + f(g.x[1], 3) + ' A. (Gauss liefert dasselbe.)'],
      tips: ['Schreibe das System als Matrix A·x = b. Zwei Gleichungen, zwei Unbekannte: Gauss-Verfahren oder Cramersche Regel.', 'Cramer: x_k = det(A_k) / det(A), wobei in A_k die k-te Spalte durch b ersetzt ist.', 'det A = a₁₁·a₂₂ − a₁₂·a₂₁. Für I₁ ersetzt du die erste Spalte durch (' + jn(b, ', ') + ').'] });
  };
  G.mx2 = R => {
    const c = C(), A = intMatrix(R, 2, -9, 9, 1), v = c.det(A);
    return numQ({ text: 'Berechne die Determinante der Matrix A = ' + mm(A) + ' (Zeile 1: ' + jn(A[0], ', ') + '; Zeile 2: ' + jn(A[1], ', ') + ').', unit: '', label: 'det A (ohne Einheit)', value: v, alt: c.detLaplace(A), tol: 0.01,
      expl: ['Bei einer 2×2-Matrix gilt: det A = a₁₁·a₂₂ − a₁₂·a₂₁ (Hauptdiagonale minus Nebendiagonale).', 'det A = (' + f(A[0][0], 0) + ')·(' + f(A[1][1], 0) + ') − (' + f(A[0][1], 0) + ')·(' + f(A[1][0], 0) + ') = ' + f(A[0][0] * A[1][1], 0) + ' − (' + f(A[0][1] * A[1][0], 0) + ').', 'Ergebnis: det A = ' + f(v, 0) + '.'],
      tips: ['Hauptdiagonale mal Hauptdiagonale, minus Nebendiagonale mal Nebendiagonale.', 'det A = a₁₁·a₂₂ − a₁₂·a₂₁. Achte auf die Vorzeichen der Einträge.', 'Produkt der Hauptdiagonale: ' + f(A[0][0] * A[1][1], 0) + '. Produkt der Nebendiagonale: ' + f(A[0][1] * A[1][0], 0) + '. Differenz bilden.'] });
  };
  G.mx3 = R => {
    const c = C(), A = intMatrix(R, 3, -5, 9, 0), v = c.det(A);
    const sar = A[0][0] * A[1][1] * A[2][2] + A[0][1] * A[1][2] * A[2][0] + A[0][2] * A[1][0] * A[2][1], sar2 = A[0][2] * A[1][1] * A[2][0] + A[0][0] * A[1][2] * A[2][1] + A[0][1] * A[1][0] * A[2][2];
    return numQ({ text: 'Berechne die Determinante der 3×3-Matrix mit den Zeilen  (' + jn(A[0], ', ') + ')  (' + jn(A[1], ', ') + ')  (' + jn(A[2], ', ') + ').', unit: '', label: 'det A (ohne Einheit)', value: v, alt: c.detLaplace(A), tol: 0.01,
      expl: ['Regel von Sarrus: Summe der drei Produkte in Richtung der Hauptdiagonale minus Summe der drei Produkte in Richtung der Nebendiagonale.', 'Positiv: ' + tri(A, 0, 1, 2) + ' + ' + tri(A, 1, 2, 0) + ' + ' + tri(A, 2, 0, 1) + ' = ' + f(sar, 0) + '.', 'Negativ: ' + tri(A, 2, 1, 0) + ' + ' + tri(A, 0, 2, 1) + ' + ' + tri(A, 1, 0, 2) + ' = ' + f(sar2, 0) + '. Ergebnis: det A = ' + f(sar, 0) + ' − (' + f(sar2, 0) + ') = ' + f(v, 0) + '.'],
      tips: ['Für 3×3 hilft die Regel von Sarrus (Spalten 1 und 2 rechts noch einmal anfügen) oder die Entwicklung nach einer Zeile.', 'Drei Diagonalprodukte von links oben nach rechts unten addieren, drei von rechts oben nach links unten subtrahieren.', 'Erstes Produkt: ' + tri(A, 0, 1, 2) + ' = ' + f(A[0][0] * A[1][1] * A[2][2], 0) + '.'] });
  };
  G.mx4 = R => {
    const c = C(), A = intMatrix(R, 3, -3, 6, 3), x = [ri(R, 1, 6), ri(R, 1, 6), ri(R, 1, 6)], b = c.matVec(A, x), g = c.gauss(A, b), v = g.x[2];
    const vars = ['I₁', 'I₂', 'I₃'];
    return numQ({ text: 'Gegeben sind drei lineare Gleichungen für die Ströme I₁, I₂ und I₃ (Koeffizienten als Zahlenwerte): I) ' + eqLine(A[0], vars, b[0]) + '  II) ' + eqLine(A[1], vars, b[1]) + '  III) ' + eqLine(A[2], vars, b[2]) + '. (Ströme in A.) Wie groß ist I₃?', unit: 'A', label: 'Strom I₃', value: v, alt: c.cramer(A, b)[2], tol: 0.01,
      expl: ['Gauss-Verfahren: Das System wird auf Dreiecksform gebracht (unterhalb der Hauptdiagonale Nullen).', (g.steps.filter(s => s.kind === 'elim' || s.kind === 'swap').map(s => s.text).join('; ') || 'Die Matrix hat bereits Dreiecksform') + '.' + (g.steps.some(s => s.kind === 'swap') && !g.steps.some(s => s.kind === 'elim') ? ' Danach hat das System Dreiecksform.' : ''), 'Rückwärts einsetzen (von unten nach oben) liefert I₃ = ' + f(g.x[2], 3) + ' A, I₂ = ' + f(g.x[1], 3) + ' A, I₁ = ' + f(g.x[0], 3) + ' A. Probe in Gleichung I: ' + f(A[0][0] * g.x[0] + A[0][1] * g.x[1] + A[0][2] * g.x[2], 2) + ' = ' + f(b[0], 0) + '.'],
      tips: ['Drei Gleichungen, drei Unbekannte: Gauss-Verfahren (Eliminieren, dann Rückwärtseinsetzen) oder Cramer mit vier Determinanten.', 'Zuerst x₁ aus den Zeilen II und III eliminieren, dann x₂ aus Zeile III. Die letzte Zeile liefert direkt I₃.', 'Probe am Ende: Setze alle drei Ströme in eine der Ausgangsgleichungen ein.'] });
  };
  G.mx5 = R => {
    const c = C(), E = pk(R, [6, 9, 12, 24]), r1 = pk(R, RK), r2 = pk(R, RK), r3 = pk(R, RK);
    const net = { n: 2, br: [{ a: 1, b: 0, R: r1, E }, { a: 1, b: 2, R: r2 }, { a: 2, b: 0, R: r3 }], cs: [] }, s = c.nodalSolve(net), v = s.V[1], gG = s.sys.G;
    return numQ({ text: 'Spannungsquelle E = ' + E + ' V in Reihe mit R₁ = ' + f(r1, 1) + ' kΩ speist den Knoten 1. Zwischen Knoten 1 und Knoten 2 liegt R₂ = ' + f(r2, 1) + ' kΩ, von Knoten 2 nach Masse R₃ = ' + f(r3, 1) + ' kΩ. Bestimme mit dem Knotenpotenzialverfahren die Spannung V₂ von Knoten 2 gegen Masse.', unit: 'V', label: 'Potenzial V₂', value: v, alt: E * r3 / (r1 + r2 + r3), tol: tolOf(v, 0.005, 0.005),
      expl: ['Leitwerte in mS (1/kΩ): G₁ = ' + f(1 / r1, 4) + ', G₂ = ' + f(1 / r2, 4) + ', G₃ = ' + f(1 / r3, 4) + '. Die Quelle mit R₁ wird zur Stromquelle E/R₁ = ' + f(E / r1, 4) + ' mA.', 'Knoten 1: (G₁ + G₂)·V₁ − G₂·V₂ = E/R₁ → ' + f(gG[0][0], 4) + '·V₁ ' + (gG[0][1] < 0 ? '− ' : '+ ') + f(Math.abs(gG[0][1]), 4) + '·V₂ = ' + f(s.sys.I[0], 4) + '.   Knoten 2: −G₂·V₁ + (G₂ + G₃)·V₂ = 0 → ' + f(gG[1][0], 4) + '·V₁ + ' + f(gG[1][1], 4) + '·V₂ = 0.', 'Gauss/Cramer liefert V₁ = ' + f(s.V[0], 4) + ' V und V₂ = ' + f(v, 4) + ' V. Kontrolle über den Spannungsteiler: V₂ = E·R₃/(R₁+R₂+R₃) = ' + f(E * r3 / (r1 + r2 + r3), 4) + ' V.'],
      tips: ['Stelle für jeden Knoten (außer Masse) die Knotengleichung auf: Summe der Leitwerte mal Potenzial = eingespeiste Ströme. Die Quelle mit Reihenwiderstand wird zur Stromquelle E/R₁.', 'Matrix: Hauptdiagonale = Summe der Leitwerte am Knoten, Nebendiagonale = −Leitwert zwischen den Knoten; rechte Seite = Quellenströme in den Knoten.', 'Knoten 1: (G₁+G₂)·V₁ − G₂·V₂ = E/R₁; Knoten 2: −G₂·V₁ + (G₂+G₃)·V₂ = 0. Rechne alles in mS, V und mA.'] });
  };
  G.mx6 = R => {
    const c = C(), E = pk(R, [6, 9, 12, 24]), r1 = pk(R, RK), r2 = pk(R, RK), r3 = pk(R, RK);
    const net = { n: 2, br: [{ a: 1, b: 0, R: r1, E }, { a: 1, b: 2, R: r2 }, { a: 2, b: 0, R: r3 }], cs: [] }, s = c.nodalSolve(net), v = (s.V[0] - s.V[1]) / r2;
    return numQ({ text: 'Spannungsquelle E = ' + E + ' V mit Innenwiderstand R₁ = ' + f(r1, 1) + ' kΩ speist Knoten 1. Zwischen Knoten 1 und 2 liegt R₂ = ' + f(r2, 1) + ' kΩ, von Knoten 2 nach Masse R₃ = ' + f(r3, 1) + ' kΩ. Wie groß ist der Strom durch R₂ (von Knoten 1 nach Knoten 2)?', unit: 'mA', label: 'Strom I₂', value: v, alt: E / (r1 + r2 + r3), tol: tolOf(v, 0.005, 0.0005),
      expl: ['Knotenpotenziale mit dem Knotenpotenzialverfahren: V₁ = ' + f(s.V[0], 4) + ' V, V₂ = ' + f(s.V[1], 4) + ' V (Leitwertmatrix ' + mm(s.sys.G.map(r => r.map(x => Math.round(x * 1e4) / 1e4)), 4) + ' mS, rechte Seite (' + s.sys.I.map(x => f(x, 4)).join('  ') + ') mA).', 'Strom durch R₂: I₂ = (V₁ − V₂) / R₂ = (' + f(s.V[0], 4) + ' − ' + f(s.V[1], 4) + ') V / ' + f(r2, 1) + ' kΩ = ' + f(v, 4) + ' mA.', 'Kontrolle: Es ist ein unverzweigter Kreis, also I = E / (R₁ + R₂ + R₃) = ' + f(E / (r1 + r2 + r3), 4) + ' mA.'],
      tips: ['Mit dem Knotenpotenzialverfahren bekommst du erst die Potenziale, den Strom danach aus der Spannungsdifferenz am Widerstand.', 'I₂ = (V₁ − V₂) / R₂. Potenziale aus der Leitwertmatrix, wie bei den vorigen Aufgaben.', 'Es geht auch schneller: Alle drei Widerstände liegen in einer Reihe, also fließt derselbe Strom überall.'] });
  };
  G.mx7 = R => {
    const c = C(); let net, sol, v, U, rs;
    for (let k = 0; k < 100; k++) {
      U = pk(R, [5, 10, 12]); rs = [0, 1, 2, 3, 4].map(() => pk(R, RK)); net = c.bridgeNet.apply(null, rs); sol = c.nodalFixed(net, 1, U); v = sol.Ibr[4];
      if (Math.abs(v) > 0.02) break;
    }
    const ud0 = c.chk.bridgeUd(U, rs[0], rs[1], rs[2], rs[3]), rth = c.zPar(c.ZR(rs[0]), c.ZR(rs[2])).re + c.zPar(c.ZR(rs[1]), c.ZR(rs[3])).re, alt = ud0 / (rth + rs[4]);
    return numQ({ text: 'Brückenschaltung an U = ' + U + ' V: R₁ = ' + f(rs[0], 1) + ' kΩ (Quelle nach Knoten 2), R₂ = ' + f(rs[1], 1) + ' kΩ (Quelle nach Knoten 3), R₃ = ' + f(rs[2], 1) + ' kΩ (Knoten 2 nach Masse), R₄ = ' + f(rs[3], 1) + ' kΩ (Knoten 3 nach Masse) und die Brücke R₅ = ' + f(rs[4], 1) + ' kΩ zwischen Knoten 2 und 3. Wie groß ist der Brückenstrom I₅ von Knoten 2 nach Knoten 3?', unit: 'mA', label: 'Brückenstrom I₅', value: v, alt, tol: tolOf(v, 0.01, 0.0005),
      expl: ['Knoten 1 liegt auf V₁ = ' + U + ' V (bekannt). Unbekannt sind V₂ und V₃. Leitwerte in mS: G₁ = ' + f(1 / rs[0], 4) + ', G₂ = ' + f(1 / rs[1], 4) + ', G₃ = ' + f(1 / rs[2], 4) + ', G₄ = ' + f(1 / rs[3], 4) + ', G₅ = ' + f(1 / rs[4], 4) + '.', 'Gleichungssystem: ' + mm(sol.sys.G.map(r => r.map(x => Math.round(x * 1e4) / 1e4)), 4) + ' mS · (V₂ V₃) = (' + sol.sys.I.map(x => f(x, 4)).join('  ') + ') mA. Lösung: V₂ = ' + f(sol.V[1], 4) + ' V, V₃ = ' + f(sol.V[2], 4) + ' V.', 'I₅ = (V₂ − V₃) / R₅ = ' + f(sol.V[1] - sol.V[2], 4) + ' V / ' + f(rs[4], 1) + ' kΩ = ' + f(v, 4) + ' mA. Gegenprobe (Ersatzspannungsquelle): U₀ = ' + f(ud0, 4) + ' V, R_i = ' + f(rth, 4) + ' kΩ, I₅ = U₀/(R_i + R₅) = ' + f(alt, 4) + ' mA.'],
      tips: ['Knoten 1 ist durch die Quelle festgelegt (V₁ = U). Du brauchst nur Gleichungen für die Knoten 2 und 3.', 'Knoten 2: (G₁+G₃+G₅)·V₂ − G₅·V₃ = G₁·U. Knoten 3: −G₅·V₂ + (G₂+G₄+G₅)·V₃ = G₂·U. Dann I₅ = (V₂ − V₃)/R₅.', 'Löse das 2×2-System mit Cramer oder Gauss und bilde die Differenz V₂ − V₃.'] });
  };
  G.mx8 = R => {
    const c = C(), Is = pk(R, [1, 2, 5, 10]), r = [0, 1, 2, 3, 4].map(() => pk(R, RK));
    const net = { n: 3, br: [{ a: 1, b: 0, R: r[0] }, { a: 1, b: 2, R: r[1] }, { a: 2, b: 0, R: r[2] }, { a: 2, b: 3, R: r[3] }, { a: 3, b: 0, R: r[4] }], cs: [{ a: 1, b: 0, I: Is }] };
    const s = c.nodalSolve(net), v = s.V[2];
    const par = (a, b) => a * b / (a + b), r45 = r[3] + r[4], rb = par(r[2], r45), rc = r[1] + rb, ra = par(r[0], rc), v1 = Is * ra, v2 = v1 * rb / rc, v3 = v2 * r[4] / r45;
    return numQ({ text: 'Eine Stromquelle I = ' + Is + ' mA speist Knoten 1. Es liegen: R₁ = ' + f(r[0], 1) + ' kΩ von 1 nach Masse, R₂ = ' + f(r[1], 1) + ' kΩ von 1 nach 2, R₃ = ' + f(r[2], 1) + ' kΩ von 2 nach Masse, R₄ = ' + f(r[3], 1) + ' kΩ von 2 nach 3 und R₅ = ' + f(r[4], 1) + ' kΩ von 3 nach Masse. Wie groß ist das Potenzial V₃?', unit: 'V', label: 'Potenzial V₃', value: v, alt: v3, tol: tolOf(v, 0.005, 0.0005),
      expl: ['Leitwertmatrix (mS) mit Zeilen für die Knoten 1, 2, 3: ' + mm(s.sys.G.map(r_ => r_.map(x => Math.round(x * 1e4) / 1e4)), 4) + '; rechte Seite (' + s.sys.I.map(x => f(x, 3)).join('  ') + ') mA (nur Knoten 1 bekommt den Quellenstrom).', 'Gauss-Eliminierung: ' + s.gauss.steps.filter(x => x.kind === 'elim' || x.kind === 'swap').map(x => x.text).join('; ') + '. Rückwärts: V₃ = ' + f(s.V[2], 4) + ' V, V₂ = ' + f(s.V[1], 4) + ' V, V₁ = ' + f(s.V[0], 4) + ' V.', 'Gegenprobe über Reihen-/Parallelschaltung: R_in = ' + f(ra, 4) + ' kΩ, V₁ = I·R_in = ' + f(v1, 4) + ' V, dann zweimal Spannungsteiler: V₃ = ' + f(v3, 4) + ' V.'],
      tips: ['Drei Knoten (ohne Masse) ergeben ein 3×3-System. Quellenstrom steht nur in der Zeile von Knoten 1.', 'Diagonale: Summe aller Leitwerte am Knoten; Nebendiagonale: negativer Leitwert des Zweigs zwischen beiden Knoten (0, wenn keiner da ist).', 'Zeile 1: (G₁+G₂)·V₁ − G₂·V₂ = I; Zeile 2: −G₂·V₁ + (G₂+G₃+G₄)·V₂ − G₄·V₃ = 0; Zeile 3: −G₄·V₂ + (G₄+G₅)·V₃ = 0.'] });
  };
  G.mx9 = R => {
    const c = C(), E = pk(R, [6, 9, 12, 24]), r = [0, 1, 2, 3].map(() => pk(R, RK));
    const net = { n: 2, br: [{ a: 1, b: 0, R: r[0], E }, { a: 1, b: 2, R: r[1] }, { a: 2, b: 0, R: r[2] }, { a: 2, b: 0, R: r[3] }], cs: [] }, s = c.nodalSolve(net), ck = c.nodalChecks(net, s), v = ck.pSrc;
    const r34 = r[2] * r[3] / (r[2] + r[3]), rt = r[0] + r[1] + r34;
    return numQ({ text: 'Eine Quelle E = ' + E + ' V mit Innenwiderstand R₁ = ' + f(r[0], 1) + ' kΩ speist Knoten 1. Von 1 nach 2 liegt R₂ = ' + f(r[1], 1) + ' kΩ, von Knoten 2 nach Masse liegen parallel R₃ = ' + f(r[2], 1) + ' kΩ und R₄ = ' + f(r[3], 1) + ' kΩ. Wie groß ist die Leistung, die die Spannungsquelle E abgibt?', unit: 'mW', label: 'Leistung P der Quelle', value: v, alt: E * E / rt, tol: tolOf(v, 0.005, 0.005),
      expl: ['Knotenpotenziale: V₁ = ' + f(s.V[0], 4) + ' V, V₂ = ' + f(s.V[1], 4) + ' V.', 'Der Quellenstrom ist der Strom durch R₁: I = (E − V₁) / R₁ = ' + f(-s.Ibr[0], 4) + ' mA. Leistung der Quelle: P = E·I = ' + f(v, 4) + ' mW.', 'Gegenprobe: R₃‖R₄ = ' + f(r34, 4) + ' kΩ, R_ges = ' + f(rt, 4) + ' kΩ, P = E²/R_ges = ' + f(E * E / rt, 4) + ' mW. Leistungsbilanz: Summe der Verluste I²R = ' + f(ck.pDiss, 4) + ' mW.'],
      tips: ['Die Quelle gibt P = E·I ab, wobei I der Strom durch die Quelle ist (derselbe wie durch R₁).', 'Aus den Knotenpotenzialen: I = (E − V₁) / R₁. Dann P = E·I.', 'Zur Kontrolle: Gesamtwiderstand R₁ + R₂ + (R₃‖R₄) und P = E² / R_ges. Beides muss passen.'] });
  };
  G.mx10 = R => {
    const c = C(), sing = R() < 0.5; let A;
    if (sing) { const r1 = [ri(R, 1, 5), ri(R, -3, 4), ri(R, 1, 4)], r2 = [ri(R, 0, 4), ri(R, 1, 5), ri(R, -2, 3)], k = ri(R, 1, 2); A = [r1, r2, r1.map((v, i) => v + k * r2[i])]; } else A = intMatrix(R, 3, -3, 6, 3);
    const b = [ri(R, 1, 9), ri(R, 1, 9), ri(R, 1, 9)], d = c.det(A), singular = Math.abs(d) < 1e-9, g = c.gauss(A, b);
    const yes = 'Ja, genau eine Lösung (det A ≠ 0)', no = 'Nein, keine eindeutige Lösung (det A = 0, Zeilen linear abhängig)', dep = 'Das hängt von der rechten Seite b ab: Nur wenn b passt, gibt es genau eine Lösung';
    return choiceQ(R, { text: 'Das lineare Gleichungssystem A·x = b hat die Koeffizientenmatrix mit den Zeilen (' + jn(A[0], ', ') + '), (' + jn(A[1], ', ') + '), (' + jn(A[2], ', ') + ') und die rechte Seite b = (' + jn(b, ', ') + '). Hat es genau eine Lösung?', right: singular ? no : yes, wrong: singular ? [yes, dep] : [no, dep], altRight: g.singular ? no : yes,
      expl: ['Ein quadratisches System A·x = b ist genau dann eindeutig lösbar, wenn det A ≠ 0 ist. Es hängt nur von der Koeffizientenmatrix ab, nicht von b.', 'Hier: det A = ' + f(d, 0) + (singular ? ' = 0. Die dritte Zeile ist eine Linearkombination der ersten beiden: Beim Gauss-Verfahren entsteht eine Nullzeile.' : ' ≠ 0, also genau eine Lösung (x = ' + g.x.map(x => f(x, 3)).join(', ') + ').'), 'Im Netzwerk bedeutet det G = 0, dass die Leitwertmatrix singulär ist: zum Beispiel ein Teilnetz ohne Verbindung zur Masse (Bezugsknoten fehlt).'],
      tips: ['Frage: Wann ist ein lineares Gleichungssystem eindeutig lösbar? Die Antwort steckt in einer Kennzahl der Matrix.', 'Eindeutige Lösung genau dann, wenn det A ≠ 0 ist. Die rechte Seite b spielt dafür keine Rolle.', 'Berechne det A (Sarrus) oder erkenne, ob eine Zeile die Summe/ein Vielfaches anderer Zeilen ist.'] });
  };

  /* ================================================================ DGL (de) */
  const RKO = [1e3, 2.2e3, 4.7e3, 10e3, 22e3], CUF = [1e-6, 2.2e-6, 4.7e-6, 10e-6, 47e-6];
  G.de1 = R => {
    const c = C(), Rr = pk(R, RKO), Cc = pk(R, CUF), tau = c.tauRC(Rr, Cc) * 1000;
    return numQ({ text: 'Ein RC-Glied hat R = ' + eng(Rr, 'Ω') + ' und C = ' + eng(Cc, 'F') + '. Wie groß ist die Zeitkonstante τ?', unit: 'ms', label: 'Zeitkonstante τ', value: tau, alt: c.chk.timeToNumeric(1 - Math.exp(-1), tau), tol: tolOf(tau, 0.005, 0.005),
      expl: ['Die DGL des RC-Glieds lautet RC·u_C′ + u_C = U. Der Faktor vor der Ableitung ist die Zeitkonstante.', 'τ = R·C = ' + sg(Rr, 4) + ' Ω · ' + sg(Cc, 4) + ' F = ' + sg(tau / 1000, 4) + ' s = ' + f(tau, 3) + ' ms.', 'Nach t = τ ist die Kondensatorspannung auf 63,2 % des Endwerts gestiegen (1 − 1/e).'],
      tips: ['Die Zeitkonstante ergibt sich direkt aus den Bauteilwerten des Glieds.', 'τ = R·C (beim RL-Glied wäre es L/R).', 'Ω mal F ergibt Sekunden. Rechne in Grundeinheiten und rechne am Ende in ms um.'] });
  };
  G.de2 = R => {
    const c = C(), L = pk(R, [10e-3, 22e-3, 47e-3, 100e-3, 470e-3]), Rr = pk(R, [47, 100, 220, 470, 1000]), tau = c.tauRL(Rr, L) * 1000;
    const alt = c.chk.bisect(t => c.chk.rl(Rr, L, 1, 0, t / 1000) - (1 / Rr) * (1 - Math.exp(-1)), 1e-6 * tau, 20 * tau, 70);
    return numQ({ text: 'Eine Spule mit L = ' + eng(L, 'H') + ' liegt in Reihe mit R = ' + Rr + ' Ω (RL-Glied). Wie groß ist die Zeitkonstante τ?', unit: 'µs', label: 'Zeitkonstante τ', value: tau * 1000, alt: alt * 1000, tol: tolOf(tau * 1000, 0.005, 0.05),
      expl: ['Die DGL des RL-Glieds lautet (L/R)·i′ + i = U/R.', 'τ = L / R = ' + sg(L, 4) + ' H / ' + Rr + ' Ω = ' + sg(tau / 1000, 4) + ' s = ' + f(tau * 1000, 1) + ' µs.', 'Merke: Beim RL-Glied steht L im Zähler (größeres L heißt langsamer), beim RC-Glied steht R·C.'],
      tips: ['Bei der Spule wirkt die Induktivität wie eine Trägheit: größere Induktivität, langsamerer Stromanstieg.', 'Formel der Zeitkonstante beim RL-Glied: τ = L / R.', 'Henry geteilt durch Ohm ergibt Sekunden; für Mikrosekunden mal 10⁶.'] });
  };
  G.de3 = R => {
    const c = C(), U = pk(R, [5, 9, 12, 24]), Rr = pk(R, RKO), Cc = pk(R, CUF), tau = c.tauRC(Rr, Cc), tms = Math.round(tau * 1000 * pk(R, [0.5, 1, 1.5, 2, 3]) * 10) / 10, v = c.firstOrder(0, U, tau, tms / 1000);
    return numQ({ text: 'Ein ungeladener Kondensator C = ' + eng(Cc, 'F') + ' wird über R = ' + eng(Rr, 'Ω') + ' an eine Gleichspannung U = ' + U + ' V geschaltet. Wie groß ist die Kondensatorspannung ' + f(tms, 1) + ' ms nach dem Einschalten?', unit: 'V', label: 'Spannung u_C(t)', value: v, alt: c.chk.rc(Rr, Cc, U, 0, tms / 1000), tol: tolOf(v, 0.005, 0.005),
      expl: ['Lösung der DGL mit u_C(0) = 0: u_C(t) = U·(1 − e^(−t/τ)).', 'τ = R·C = ' + f(tau * 1000, 3) + ' ms, also t/τ = ' + f(tms, 1) + ' / ' + f(tau * 1000, 3) + ' = ' + f(tms / 1000 / tau, 4) + '.', 'u_C = ' + U + ' V · (1 − e^(−' + f(tms / 1000 / tau, 4) + ')) = ' + U + ' · ' + f(1 - Math.exp(-tms / 1000 / tau), 4) + ' = ' + f(v, 3) + ' V.'],
      tips: ['Beim Aufladen nähert sich die Spannung exponentiell dem Endwert U.', 'u_C(t) = U·(1 − e^(−t/τ)) mit τ = R·C.', 'Berechne zuerst τ in ms und das Verhältnis t/τ, dann e hoch minus dieses Verhältnis.'] });
  };
  G.de4 = R => {
    const c = C(), Rr = pk(R, RKO), Cc = pk(R, CUF), tau = c.tauRC(Rr, Cc) * 1000, p = pk(R, [0.9, 0.95, 0.99]), v = c.timeTo(p, tau);
    return numQ({ text: 'Ein RC-Glied (R = ' + eng(Rr, 'Ω') + ', C = ' + eng(Cc, 'F') + ') wird mit einem Spannungssprung aufgeladen. Nach welcher Zeit hat die Kondensatorspannung ' + f(p * 100, 0) + ' % ihres Endwerts erreicht?', unit: 'ms', label: 'Zeit t', value: v, alt: c.chk.timeToNumeric(p, tau), tol: tolOf(v, 0.005, 0.01),
      expl: ['Ansatz: u_C(t)/U = 1 − e^(−t/τ) = ' + f(p, 2) + '.', 'Umstellen: e^(−t/τ) = ' + f(1 - p, 2) + ' ⇒ t = −τ·ln(' + f(1 - p, 2) + ') = τ · ' + f(-Math.log(1 - p), 4) + '.', 'τ = R·C = ' + f(tau, 3) + ' ms ⇒ t = ' + f(v, 3) + ' ms (das sind ' + f(v / tau, 2) + ' Zeitkonstanten).'],
      tips: ['Setze die Ladekurve gleich dem gesuchten Anteil und löse nach t auf. Dafür brauchst du den natürlichen Logarithmus.', 't = −τ·ln(1 − p) mit p als Anteil (0,9 für 90 %).', 'Erst τ = R·C in ms, dann ln(' + f(1 - p, 2) + ') berechnen und mit −τ multiplizieren.'] });
  };
  G.de5 = R => {
    const c = C(), U = pk(R, [5, 12, 24]), Rr = pk(R, [47, 100, 220, 470]), L = pk(R, [10e-3, 22e-3, 47e-3, 100e-3]), tau = c.tauRL(Rr, L), tms = Math.round(tau * 1000 * pk(R, [0.5, 1, 2, 3]) * 100) / 100, v = c.firstOrder(0, U / Rr, tau, tms / 1000) * 1000;
    return numQ({ text: 'Ein RL-Glied (R = ' + Rr + ' Ω, L = ' + eng(L, 'H') + ') wird zum Zeitpunkt t = 0 an U = ' + U + ' V Gleichspannung geschaltet. Wie groß ist der Strom ' + f(tms, 2) + ' ms später?', unit: 'mA', label: 'Strom i(t)', value: v, alt: c.chk.rl(Rr, L, U, 0, tms / 1000) * 1000, tol: tolOf(v, 0.005, 0.01),
      expl: ['Endwert des Stroms: I∞ = U / R = ' + U + ' V / ' + Rr + ' Ω = ' + f(U / Rr * 1000, 3) + ' mA. Zeitkonstante: τ = L/R = ' + f(tau * 1000, 3) + ' ms.', 'Lösung mit i(0) = 0: i(t) = I∞·(1 − e^(−t/τ)).', 'i = ' + f(U / Rr * 1000, 3) + ' mA · (1 − e^(−' + f(tms / 1000 / tau, 4) + ')) = ' + f(v, 3) + ' mA.'],
      tips: ['Die Spule verhindert einen Stromsprung: Der Strom steigt exponentiell auf den Endwert U/R.', 'i(t) = (U/R)·(1 − e^(−t/τ)) mit τ = L/R.', 'Zuerst I∞ und τ ausrechnen, dann t/τ bilden.'] });
  };
  G.de6 = R => {
    const c = C(), U0 = pk(R, [5, 12, 24, 50]), Rr = pk(R, RKO), Cc = pk(R, CUF), tau = c.tauRC(Rr, Cc), tms = Math.round(tau * 1000 * pk(R, [0.5, 1, 2, 3, 5]) * 10) / 10, v = c.firstOrder(U0, 0, tau, tms / 1000);
    return numQ({ text: 'Ein auf U₀ = ' + U0 + ' V geladener Kondensator C = ' + eng(Cc, 'F') + ' entlädt sich über R = ' + eng(Rr, 'Ω') + '. Welche Spannung liegt nach ' + f(tms, 1) + ' ms am Kondensator?', unit: 'V', label: 'Spannung u_C(t)', value: v, alt: c.chk.rcDischarge(Rr, Cc, U0, tms / 1000), tol: tolOf(v, 0.005, 0.0005),
      expl: ['Entladen: Die DGL RC·u′ + u = 0 hat die Lösung u_C(t) = U₀·e^(−t/τ).', 'τ = R·C = ' + f(tau * 1000, 3) + ' ms, t/τ = ' + f(tms / 1000 / tau, 4) + '.', 'u_C = ' + U0 + ' V · e^(−' + f(tms / 1000 / tau, 4) + ') = ' + f(v, 3) + ' V (' + f(v / U0 * 100, 1) + ' % der Anfangsspannung).'],
      tips: ['Beim Entladen fällt die Spannung exponentiell auf null.', 'u_C(t) = U₀·e^(−t/τ) mit τ = R·C.', 'Rechne t/τ aus und bilde e hoch minus diesen Wert.'] });
  };
  /* RLC-Parameter: L, C aus Reihen, R aus Zieldämpfung (ganzzahlig gerundet) */
  function rlcSet(R, zetas) {
    const L = pk(R, [1e-3, 2.2e-3, 4.7e-3, 10e-3, 22e-3]), Cc = pk(R, [100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6]), z = pk(R, zetas), Rr = Math.max(1, Math.round(2 * z * Math.sqrt(L / Cc)));
    return { L, Cc, Rr, U: pk(R, [5, 10, 12]) };
  }
  G.de7 = R => {
    const c = C(), o = rlcSet(R, [0.1, 0.2, 0.3, 0.5, 0.7, 1.5, 2.5]), I = c.rlcInfo(o.Rr, o.L, o.Cc), v = I.zeta;
    return numQ({ text: 'Ein Reihen-RLC-Kreis mit R = ' + o.Rr + ' Ω, L = ' + eng(o.L, 'H') + ' und C = ' + eng(o.Cc, 'F') + ' wird mit einem Spannungssprung angeregt. Wie groß ist der Dämpfungsgrad D (auch ζ genannt)?', unit: '', label: 'Dämpfungsgrad D (ohne Einheit)', value: v, alt: c.chk.zetaFromRoots(o.Rr, o.L, o.Cc), tol: tolOf(v, 0.005, 0.002),
      expl: ['DGL: L·C·u″ + R·C·u′ + u = U, also u″ + (R/L)·u′ + (1/LC)·u = U/(LC). Verglichen mit u″ + 2α·u′ + ω₀²·u: α = R/(2L) = ' + f(I.alpha, 2) + ' 1/s und ω₀ = 1/√(LC) = ' + f(I.w0, 2) + ' 1/s.', 'Dämpfungsgrad: D = α/ω₀ = R/2 · √(C/L) = ' + f(v, 4) + '.', v < 1 ? 'D < 1: Schwingfall, die Spannung überschwingt und klingt ab.' : v > 1 ? 'D > 1: Kriechfall, die Spannung nähert sich ohne Überschwingen.' : 'D = 1: aperiodischer Grenzfall.'],
      tips: ['Bring die DGL auf die Normalform u″ + 2α·u′ + ω₀²·u = … und lies α und ω₀ ab.', 'D = α / ω₀ = (R/2)·√(C/L).', 'Berechne R/2 und √(C/L) getrennt (C und L in Grundeinheiten) und multipliziere.'] });
  };
  G.de8 = R => {
    const c = C(), o = rlcSet(R, [0.1, 0.2, 0.3, 0.5, 0.7]), I = c.rlcInfo(o.Rr, o.L, o.Cc), v = I.fd / 1000;
    return numQ({ text: 'Ein Reihen-RLC-Kreis (R = ' + o.Rr + ' Ω, L = ' + eng(o.L, 'H') + ', C = ' + eng(o.Cc, 'F') + ') schwingt nach einem Spannungssprung gedämpft. Mit welcher Frequenz f_d schwingt er (Frequenz der gedämpften Schwingung)?', unit: 'kHz', label: 'Frequenz f_d', value: v, alt: c.chk.fdFromRoots(o.Rr, o.L, o.Cc) / 1000, tol: tolOf(v, 0.005, 0.002),
      expl: ['Charakteristische Gleichung s² + (R/L)·s + 1/(LC) = 0 mit α = R/(2L) = ' + f(I.alpha, 2) + ' 1/s und ω₀ = 1/√(LC) = ' + f(I.w0, 2) + ' 1/s.', 'Die Wurzeln sind s = −α ± jω_d mit ω_d = √(ω₀² − α²) = ' + f(I.wd, 2) + ' 1/s.', 'f_d = ω_d / (2π) = ' + f(I.fd, 2) + ' Hz = ' + f(v, 3) + ' kHz (etwas kleiner als f₀ = ' + f(I.f0, 2) + ' Hz).'],
      tips: ['Die gedämpfte Schwingung ist langsamer als die ungedämpfte Eigenfrequenz.', 'ω_d = √(ω₀² − α²) mit ω₀ = 1/√(LC) und α = R/(2L); f_d = ω_d/(2π).', 'Bilde ω₀² = 1/(LC) und α², subtrahiere, ziehe die Wurzel, teile durch 2π.'] });
  };
  G.de9 = R => {
    const c = C(), o = rlcSet(R, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]), I = c.rlcInfo(o.Rr, o.L, o.Cc), v = I.overshoot;
    const alt = (c.chk.rlcMaxNumeric(o.Rr, o.L, o.Cc, o.U, 3 * I.tpeak) / o.U - 1) * 100;
    return numQ({ text: 'Ein Reihen-RLC-Kreis (R = ' + o.Rr + ' Ω, L = ' + eng(o.L, 'H') + ', C = ' + eng(o.Cc, 'F') + ') wird durch einen Spannungssprung auf ' + o.U + ' V angeregt. Um wie viel Prozent überschwingt die Kondensatorspannung über den Endwert?', unit: '%', label: 'Überschwingweite', value: v, alt, tol: tolOf(v, 0.01, 0.05),
      expl: ['D = (R/2)·√(C/L) = ' + f(I.zeta, 4) + ' (Schwingfall, da D < 1).', 'Überschwingweite: ü = e^(−π·D/√(1 − D²)) = e^(−π · ' + f(I.zeta, 4) + ' / ' + f(Math.sqrt(1 - I.zeta * I.zeta), 4) + ') = ' + f(v / 100, 5) + '.', 'Das sind ' + f(v, 2) + ' % oder ' + f(o.U * v / 100, 3) + ' V über dem Endwert ' + o.U + ' V (Maximum bei t = π/ω_d = ' + f(I.tpeak * 1e6, 1) + ' µs).'],
      tips: ['Das Überschwingen hängt nur vom Dämpfungsgrad D ab, nicht von R, L, C einzeln.', 'ü = e^(−π·D / √(1 − D²)); in Prozent mal 100.', 'D = (R/2)·√(C/L) zuerst berechnen, dann in die Formel einsetzen.'] });
  };
  G.de10 = R => {
    const c = C(), L = pk(R, [1e-3, 2.2e-3, 4.7e-3, 10e-3, 22e-3, 47e-3]), Cc = pk(R, [100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6, 4.7e-6]), v = c.rlcInfo(1, L, Cc).Rkrit;
    return numQ({ text: 'Ein Reihen-RLC-Kreis hat L = ' + eng(L, 'H') + ' und C = ' + eng(Cc, 'F') + '. Bei welchem Widerstand R liegt der aperiodische Grenzfall vor (kritische Dämpfung, ab dort keine Schwingung mehr)?', unit: 'Ω', label: 'Widerstand R_krit', value: v, alt: c.chk.RkritBisect(L, Cc), tol: tolOf(v, 0.005, 0.01),
      expl: ['Der Grenzfall liegt bei D = 1, also (R/2)·√(C/L) = 1.', 'Umgestellt: R_krit = 2·√(L/C) = 2 · √(' + sg(L, 4) + ' / ' + sg(Cc, 4) + ') Ω = 2 · ' + f(Math.sqrt(L / Cc), 3) + ' Ω = ' + f(v, 2) + ' Ω.', 'Für R < R_krit schwingt der Kreis (Schwingfall), für R > R_krit kriecht er (Kriechfall).'],
      tips: ['Kritische Dämpfung heißt D = 1: Die Wurzel der charakteristischen Gleichung wird doppelt.', 'Setze D = (R/2)·√(C/L) = 1 und löse nach R: R_krit = 2·√(L/C).', 'L/C in Grundeinheiten berechnen, Wurzel ziehen, mal 2.'] });
  };
  const GP = [[10e-3, 1e-6], [100e-3, 10e-6], [4e-3, 10e-6], [9e-3, 10e-6], [1e-3, 10e-6], [16e-3, 10e-6]];
  G.de11 = R => {
    const c = C(), gp = pk(R, GP), L = gp[0], Cc = gp[1], rk = 2 * Math.sqrt(L / Cc), k = pk(R, [0.25, 0.5, 1, 2, 4]), Rr = Math.round(rk * k * 100) / 100;
    const I = c.rlcInfo(Rr, L, Cc), A = 'Schwingfall (D < 1): gedämpfte Schwingung mit Überschwingen', B = 'Aperiodischer Grenzfall (D = 1): schnellster Anstieg ohne Überschwingen', Kc = 'Kriechfall (D > 1): langsamer Anstieg ohne Überschwingen';
    const z = c.chk.zetaFromRoots(Rr, L, Cc), alt = z < 1 - 1e-6 ? A : z > 1 + 1e-6 ? Kc : B, right = I.case === 'schwing' ? A : I.case === 'kriech' ? Kc : B;
    return choiceQ(R, { text: 'Ein Reihen-RLC-Kreis mit R = ' + f(Rr, 2) + ' Ω, L = ' + eng(L, 'H') + ' und C = ' + eng(Cc, 'F') + ' wird mit einem Spannungssprung angeregt. Welches Verhalten zeigt die Kondensatorspannung?', right, wrong: [A, B, Kc].filter(x => x !== right), altRight: alt,
      expl: ['Maßgeblich ist der Vergleich von R mit dem kritischen Widerstand R_krit = 2·√(L/C) = ' + f(rk, 2) + ' Ω.', 'Hier ist R = ' + f(Rr, 2) + ' Ω, also R/R_krit = ' + f(Rr / rk, 3) + ' = D.', 'D < 1: Schwingfall, D = 1: aperiodischer Grenzfall, D > 1: Kriechfall. Ergebnis: ' + right + '.'],
      tips: ['Entscheidend ist der Dämpfungsgrad D = (R/2)·√(C/L) bzw. der Vergleich mit R_krit.', 'R_krit = 2·√(L/C). Kleinerer Widerstand schwingt, größerer kriecht.', 'Berechne R_krit = 2·√(' + sg(L / Cc, 4) + ') = ' + f(rk, 2) + ' Ω und vergleiche mit R.'] });
  };

  /* ================================================================ Laplace (lp) */
  const PRM = { a: 2, w: 3, b: 5 }, S0 = 1.7;
  const FTXT = { delta: 'δ(t)', sigma: 'σ(t) (Sprung)', ramp: 't', par: 't²', exp: 'e^(−a·t)', 'one-exp': '1 − e^(−a·t)', sin: 'sin(ω·t)', cos: 'cos(ω·t)', texp: 't·e^(−a·t)', expsin: 'e^(−a·t)·sin(ω·t)', expcos: 'e^(−a·t)·cos(ω·t)', diff2: '(e^(−a·t) − e^(−b·t)) / (b − a)' };
  G.lp1 = R => {
    const c = C(), T = c.TABLE.filter(e => e.fn && e.id !== 'sigma'), e = pk(R, T), others = c.shuffle(R, T.filter(x => x.F !== e.F)).slice(0, 3);
    const ch = [e].concat(others), num = c.laplaceNumeric(t => e.fn(t, PRM), S0, 60, 60000);
    let altE = ch[0]; ch.forEach(x => { if (Math.abs(x.Fn(S0, PRM) - num) < Math.abs(altE.Fn(S0, PRM) - num)) altE = x; });
    return choiceQ(R, { text: 'Für t ≥ 0 sei f(t) = ' + e.f + ' (a, ω, b sind positive Konstanten). Welche Bildfunktion F(s) gehört dazu?', right: e.F, wrong: others.map(x => x.F), altRight: altE.F,
      expl: ['Das ist ein Standardfall der Korrespondenztabelle: ' + e.f + '  ∘—•  ' + e.F + '.', 'Herleitung allgemein: F(s) = ∫₀^∞ f(t)·e^(−st) dt.', 'Zahlenprobe mit a = 2, ω = 3, b = 5 bei s = ' + f(S0, 1) + ': das numerische Integral ergibt ' + f(num, 5) + ', die Formel ' + e.F + ' ergibt ' + f(e.Fn(S0, PRM), 5) + '.'],
      tips: ['Schau in die Korrespondenztabelle. Achte auf das Verhalten: Exponentialfunktionen verschieben die Nenner-Nullstelle nach −a.', 'Die Dämpfung e^(−a·t) im Zeitbereich ersetzt s durch s + a im Bildbereich (Dämpfungssatz).', 'Prüfe an den Polen: e^(−a·t) hat einen Pol bei s = −a, sin und cos ein Polpaar bei ±jω, t und t² einen mehrfachen Pol bei s = 0, δ(t) gar keinen (F = 1).'] });
  };
  G.lp2 = R => {
    const c = C(), eid = pk(R, ['texp', 'expsin', 'expcos', 'sin', 'cos', 'one-exp']), e = c.TABLE.find(x => x.id === eid), p = { a: pk(R, [1, 2, 3]), w: pk(R, [1, 2, 4]), b: 5 }, s0 = pk(R, [1, 2, 3, 4]), v = c.tableValue(e.id, s0, p), hasA = /a·t/.test(e.f), hasW = /ω/.test(e.f), pl = [hasA ? 'a = ' + p.a : '', hasW ? 'ω = ' + p.w : '', 's = ' + s0].filter(Boolean), pr = [hasA ? 'a = ' + p.a + ' 1/s' : '', hasW ? 'ω = ' + p.w + ' rad/s' : ''].filter(Boolean).join(' und ');
    return numQ({ text: 'Für t ≥ 0 ist f(t) = ' + e.f + ' mit ' + pr + '. Berechne den Wert der Laplace-Transformierten F(s) = ℒ{f(t)} an der Stelle s = ' + s0 + ' 1/s (Zahl ohne Einheit).', unit: '', label: 'F(s) bei s = ' + s0 + ' (ohne Einheit)', value: v, alt: c.laplaceNumeric(t => e.fn(t, p), s0, 80 / Math.min(s0, p.a || 1) + 20, 80000), tol: Math.max(1e-4, Math.abs(v) * 0.005),
      expl: ['Aus der Tabelle: ℒ{' + e.f + '} = ' + e.F + '.', 'Einsetzen von ' + pl.join(', ') + ' in F(s) = ' + e.F + '.', 'Ergebnis: F(' + s0 + ') = ' + f(v, 5) + '.'],
      tips: ['Suche f(t) in der Korrespondenztabelle und lies F(s) ab.', 'F(s) = ' + e.F + '.', 'Setze ' + pl.join(', ') + ' ein (nur Zahlenwerte, die Einheiten kürzen sich).'] });
  };
  G.lp3 = R => {
    const c = C(), K = pk(R, [1, 2, 5, 10]), T = pk(R, [0.5, 1, 2, 5, 10, 20]), tf = { num: [K], den: [T / 1000, 1] }, v = c.tfPoles(tf)[0].re, alt = c.rootsDK(tf.den)[0].re;
    return numQ({ text: 'Ein Verzögerungsglied hat die Übertragungsfunktion H(s) = ' + K + ' / (1 + s·' + f(T, 1) + ' ms). Wo liegt der Pol in der s-Ebene (Realteil in 1/s)?', unit: '1/s', label: 'Pol s_p', value: v, alt, tol: tolOf(v, 0.005, 0.01),
      expl: ['Pole sind die Nullstellen des Nenners: 1 + s·T = 0.', 'Daraus s_p = −1/T = −1/(' + f(T, 1) + ' ms) = −1 / ' + sg(T / 1000, 3) + ' s.', 's_p = ' + f(v, 2) + ' 1/s. Der Pol liegt auf der negativen reellen Achse, das Glied ist stabil. Die Zeitkonstante ist der Kehrwert des Polbetrags.'],
      tips: ['Ein Pol ist ein Wert von s, bei dem der Nenner null wird.', 'Nenner 1 + s·T = 0 nach s auflösen: s_p = −1/T.', 'T in Sekunden umrechnen (' + f(T, 1) + ' ms = ' + sg(T / 1000, 3) + ' s) und den Kehrwert mit negativem Vorzeichen bilden.'] });
  };
  G.lp4 = R => {
    const c = C(), Rr = pk(R, [1e3, 2.2e3, 4.7e3, 10e3, 22e3]), Cc = pk(R, [1e-9, 4.7e-9, 10e-9, 47e-9, 100e-9]), tau = Rr * Cc, tf = { num: [1], den: [tau, 1] }, v = 1 / (2 * PI * tau);
    const alt = c.chk.bisect(w => c.cabs(c.tfAt(tf, w)) - Math.SQRT1_2, 1 / tau / 100, 1 / tau * 100, 200) / (2 * PI);
    return numQ({ text: 'Ein RC-Tiefpass (R = ' + eng(Rr, 'Ω') + ', C = ' + eng(Cc, 'F') + ') hat die Übertragungsfunktion H(s) = 1/(1 + s·R·C). Wie groß ist seine Grenzfrequenz f_g (Betrag fällt auf 1/√2, −3 dB)?', unit: 'Hz', label: 'Grenzfrequenz f_g', value: v, alt, tol: tolOf(v, 0.005, 0.05),
      expl: ['Frequenzgang: s = jω ⇒ H(jω) = 1/(1 + jωRC), |H| = 1/√(1 + (ωRC)²).', '|H| = 1/√2 gilt bei ω_g·R·C = 1, also ω_g = 1/(RC) = 1/' + sg(tau, 4) + ' s = ' + f(1 / tau, 1) + ' 1/s.', 'f_g = ω_g/(2π) = 1/(2π·R·C) = ' + f(v, 2) + ' Hz. (Der Pol liegt bei s = −1/(RC), f_g ist sein Betrag geteilt durch 2π.)'],
      tips: ['Setze s = jω und suche die Frequenz, bei der der Nenner-Betrag √2 ist.', 'Bei ω·R·C = 1 ist |H| = 1/√2. Also f_g = 1/(2π·R·C).', 'R·C in Sekunden (' + sg(tau, 4) + ' s), dann 2π mal das Produkt, davon den Kehrwert.'] });
  };
  G.lp5 = R => {
    const c = C(), K = pk(R, [1, 2, 5, 10]), z = pk(R, [2, 5, 10, 20, 50]), p1 = pk(R, [1, 3, 4, 8]), p2 = p1 + pk(R, [2, 5, 10, 30]);
    const tf = { num: [K, K * z], den: [1, p1 + p2, p1 * p2] }, zs = c.tfZeros(tf), v = zs[0].re;
    return numQ({ text: 'Gegeben ist H(s) = (' + K + '·s + ' + (K * z) + ') / (s² + ' + (p1 + p2) + '·s + ' + (p1 * p2) + ') (s in 1/s, Koeffizienten als Zahlenwerte). Wo liegt die Nullstelle des Systems (Wert von s in 1/s)?', unit: '1/s', label: 'Nullstelle s_z', value: v, alt: c.rootsDK(tf.num)[0].re, tol: 0.01,
      expl: ['Nullstellen sind die Nullstellen des Zählerpolynoms: ' + K + '·s + ' + (K * z) + ' = 0.', 's_z = −' + (K * z) + ' / ' + K + ' = ' + f(v, 2) + ' 1/s.', 'Zur Einordnung: Die Pole sind die Wurzeln von s² + ' + (p1 + p2) + '·s + ' + (p1 * p2) + ' = 0, nämlich ' + f(-p1, 0) + ' und ' + f(-p2, 0) + ' 1/s.'],
      tips: ['Nullstelle heißt: Zähler gleich null (Pole: Nenner gleich null).', 'Löse ' + K + '·s + ' + (K * z) + ' = 0 nach s auf.', 'Der Faktor ' + K + ' kürzt sich heraus, übrig bleibt s + ' + z + ' = 0.'] });
  };
  G.lp6 = R => {
    const c = C(), p1 = pk(R, [1, 2, 3, 4, 5]), p2 = p1 + pk(R, [3, 5, 10, 15, 25]), tf = { num: [p1 * p2], den: [1, p1 + p2, p1 * p2] }, poles = c.tfPoles(tf), v = Math.max.apply(null, poles.map(p => p.re));
    const alt = Math.max.apply(null, c.rootsDK(tf.den).map(p => p.re));
    return numQ({ text: 'Ein System hat die Übertragungsfunktion H(s) = ' + (p1 * p2) + ' / (s² + ' + (p1 + p2) + '·s + ' + (p1 * p2) + ') (s in 1/s, Koeffizienten als Zahlenwerte). Es hat zwei reelle Pole. Welcher Pol ist der dominante, also der näher an der imaginären Achse (Wert in 1/s)?', unit: '1/s', label: 'Dominanter Pol', value: v, alt, tol: 0.01,
      expl: ['Pole: s² + ' + (p1 + p2) + '·s + ' + (p1 * p2) + ' = 0 ⇒ s = −' + f((p1 + p2) / 2, 2) + ' ± √(' + f(Math.pow((p1 + p2) / 2, 2), 2) + ' − ' + (p1 * p2) + ') = −' + f((p1 + p2) / 2, 2) + ' ± ' + f(Math.sqrt(Math.pow((p1 + p2) / 2, 2) - p1 * p2), 2) + '.', 'Also s₁ = ' + f(-p1, 0) + ' 1/s und s₂ = ' + f(-p2, 0) + ' 1/s.', 'Dominant ist der Pol mit dem kleineren Betrag: ' + f(v, 2) + ' 1/s. Er bestimmt das langsame Einschwingen (Zeitkonstante ' + f(1000 / Math.abs(v), 1) + ' ms), der andere klingt schneller ab.'],
      tips: ['Berechne beide Pole als Nullstellen des Nenners (p-q-Formel oder quadratische Ergänzung).', 'Der dominante Pol hat den kleinsten Betrag des Realteils; sein Zeitverhalten e^(−|s|·t) klingt am langsamsten ab.', 's = −b/2 ± √((b/2)² − c) mit b = ' + (p1 + p2) + ' und c = ' + (p1 * p2) + '.'] });
  };
  G.lp7 = R => {
    const c = C(), sig = pk(R, [2, 5, 10, 20]), wd = pk(R, [10, 20, 30, 50, 100]), a1 = 2 * sig, a0 = sig * sig + wd * wd, tf = { num: [a0], den: [1, a1, a0] }, v = Math.abs(c.tfPoles(tf)[0].im);
    return numQ({ text: 'Ein Schwingungsglied hat H(s) = ' + a0 + ' / (s² + ' + a1 + '·s + ' + a0 + ') (s in 1/s, Koeffizienten als Zahlenwerte). Die Pole sind ein komplex konjugiertes Paar s = σ ± jω_d. Wie groß ist ω_d (Betrag des Imaginärteils, in rad/s)?', unit: 'rad/s', label: 'Imaginärteil ω_d', value: v, alt: Math.sqrt(a0 - Math.pow(a1 / 2, 2)), tol: tolOf(v, 0.005, 0.01),
      expl: ['Nenner null setzen: s² + ' + a1 + '·s + ' + a0 + ' = 0 ⇒ s = −' + f(a1 / 2, 2) + ' ± √(' + f(Math.pow(a1 / 2, 2), 2) + ' − ' + a0 + ').', 'Die Diskriminante ist negativ (' + f(Math.pow(a1 / 2, 2) - a0, 2) + '), also s = −' + f(a1 / 2, 2) + ' ± j·√(' + a0 + ' − ' + f(Math.pow(a1 / 2, 2), 2) + ') = −' + f(sig, 2) + ' ± j' + f(v, 3) + '.', 'ω_d = ' + f(v, 3) + ' rad/s (Eigenkreisfrequenz der gedämpften Schwingung), Realteil σ = −' + f(sig, 2) + ' 1/s (Abklingkonstante δ = ' + f(sig, 2) + ' 1/s).'],
      tips: ['Bei negativer Diskriminante bilden die Pole ein komplex konjugiertes Paar. Der Realteil ist −b/2, der Imaginärteil kommt aus der Wurzel.', 'ω_d = √(c − (b/2)²) mit b = ' + a1 + ' und c = ' + a0 + '.', '(b/2)² = ' + f(Math.pow(a1 / 2, 2), 2) + ' von ' + a0 + ' abziehen und die Wurzel ziehen.'] });
  };
  G.lp8 = R => {
    const c = C(), K = pk(R, [1, 2, 5, 10]), Tm = pk(R, [1, 2, 5, 10]), w = pk(R, [100, 200, 500, 1000, 2000]), tf = { num: [K], den: [Tm / 1000, 1] }, v = c.dB(c.cabs(c.tfAt(tf, w)));
    const alt = 20 * Math.log10(K) - 10 * Math.log10(1 + Math.pow(w * Tm / 1000, 2));
    return numQ({ text: 'Ein PT1-Glied hat H(s) = ' + K + ' / (1 + s·' + Tm + ' ms). Wie groß ist der Betrag des Frequenzgangs |H(jω)| bei ω = ' + w + ' rad/s in Dezibel?', unit: 'dB', label: 'Betrag |H(jω)|', value: v, alt, tol: 0.05,
      expl: ['Frequenzgang: s = jω ⇒ |H(jω)| = K / √(1 + (ω·T)²).', 'ω·T = ' + w + ' · ' + sg(Tm / 1000, 3) + ' = ' + f(w * Tm / 1000, 3) + ', also |H| = ' + K + ' / √(1 + ' + f(Math.pow(w * Tm / 1000, 2), 4) + ') = ' + f(c.cabs(c.tfAt(tf, w)), 4) + '.', 'In dB: 20·log₁₀(|H|) = ' + f(v, 3) + ' dB.'],
      tips: ['Setze s = jω ein und bilde den Betrag. Dezibel sind 20·log₁₀ des Betragsverhältnisses.', '|H(jω)| = K / √(1 + (ωT)²), danach 20·log₁₀.', 'Berechne ω·T mit T in Sekunden, dann die Wurzel, dann K durch die Wurzel.'] });
  };
  G.lp9 = R => {
    const c = C(), sig = pk(R, [2, 5, 10, 20]), wd = pk(R, [10, 20, 30, 50]), a1 = 2 * sig, a0 = sig * sig + wd * wd, b1 = pk(R, [0, 0, 5, 10]), b0 = pk(R, [20, 50, 100, 200, 400]), U = pk(R, [1, 2, 5, 10]);
    const tf = { num: b1 ? [b1, b0] : [b0], den: [1, a1, a0] }, v = U * c.tfDC(tf), sim = c.stepNumeric(tf, 40 / sig, 40000), alt = U * sim[sim.length - 1][1];
    return numQ({ text: 'Ein stabiles System hat H(s) = ' + (b1 ? '(' + b1 + '·s + ' + b0 + ')' : b0) + ' / (s² + ' + a1 + '·s + ' + a0 + ') (s in 1/s, Koeffizienten als Zahlenwerte). Es wird mit einem Spannungssprung der Höhe ' + U + ' V angeregt. Gegen welchen Wert strebt der Ausgang für t → ∞ (Endwertsatz)?', unit: 'V', label: 'Endwert y(∞)', value: v, alt, tol: tolOf(v, 0.005, 0.0005),
      expl: ['Der Endwertsatz: y(∞) = lim_{s→0} s·Y(s) mit Y(s) = H(s)·U/s (Sprung).', 'Dann ist y(∞) = U·H(0) = U·' + b0 + ' / ' + a0 + ' (der s-Term im Zähler fällt bei s = 0 weg).', 'y(∞) = ' + U + ' V · ' + f(b0 / a0, 5) + ' = ' + f(v, 4) + ' V. Der Endwertsatz gilt, weil alle Pole links der imaginären Achse liegen (stabil).'],
      tips: ['Beim Sprung ist Y(s) = H(s)·U/s. Der Endwertsatz verbindet t → ∞ mit s → 0.', 'y(∞) = lim s·Y(s) = U·H(0): Zähler und Nenner bei s = 0 auswerten.', 'H(0) = ' + b0 + ' / ' + a0 + '. Mit dem Sprung ' + U + ' V multiplizieren.'] });
  };
  G.lp10 = R => {
    const c = C(), K = pk(R, [1, 2, 5, 10]), Tm = pk(R, [1, 2, 5, 10]), tms = Math.round(Tm * pk(R, [0.5, 1, 2, 3]) * 10) / 10, U = pk(R, [1, 2, 5]), tf = { num: [K], den: [Tm, 1] };
    const v = U * c.stepAnalytic(tf, tms), sim = c.stepNumeric(tf, tms, 4000), alt = U * sim[sim.length - 1][1];
    return numQ({ text: 'Ein PT1-Glied mit H(s) = ' + K + ' / (1 + s·' + Tm + ' ms) wird zum Zeitpunkt t = 0 mit einem Spannungssprung von ' + U + ' V angeregt. Wie groß ist der Ausgang ' + f(tms, 1) + ' ms später?', unit: 'V', label: 'Ausgang y(t)', value: v, alt, tol: tolOf(v, 0.005, 0.005),
      expl: ['Y(s) = H(s)·U/s = K·U / (s·(1 + sT)). Partialbruchzerlegung liefert K·U·(1/s − 1/(s + 1/T)).', 'Rücktransformation mit der Tabelle: y(t) = K·U·(1 − e^(−t/T)).', 'y = ' + K + ' · ' + U + ' V · (1 − e^(−' + f(tms / Tm, 4) + ')) = ' + f(v, 3) + ' V (Endwert K·U = ' + (K * U) + ' V).'],
      tips: ['Sprung im Bildbereich heißt Multiplikation mit 1/s. Danach Partialbruchzerlegung und Tabelle.', 'y(t) = K·U·(1 − e^(−t/T)).', 't/T = ' + f(tms, 1) + ' ms / ' + Tm + ' ms = ' + f(tms / Tm, 3) + '. Davon e^(−…) bilden und einsetzen.'] });
  };
  G.lp11 = R => {
    const c = C(), kind = pk(R, ['stabil', 'stabil', 'grenzstabil', 'instabil']), a0 = pk(R, [4, 9, 25, 100]); let a1;
    if (kind === 'stabil') a1 = pk(R, [2, 4, 6, 10]); else if (kind === 'grenzstabil') a1 = 0; else a1 = -pk(R, [2, 4, 6]);
    const den = [1, a1, a0], poles = c.roots(den), S = 'Stabil: alle Pole links der imaginären Achse (Re < 0)', M = 'Grenzstabil: Pole auf der imaginären Achse, ungedämpfte Dauerschwingung', Ins = 'Instabil: mindestens ein Pol rechts der imaginären Achse (Re > 0), die Antwort wächst unbegrenzt an';
    const m = { stabil: S, grenzstabil: M, instabil: Ins }, hu = a1 > 0 && a0 > 0 ? 'stabil' : a1 === 0 && a0 > 0 ? 'grenzstabil' : 'instabil';
    const pt = poles.map(p => (p.im === 0 ? f(p.re, 2) : f(p.re, 2) + (p.im > 0 ? ' + j' : ' − j') + f(Math.abs(p.im), 2))).join(' und ');
    return choiceQ(R, { text: 'Ein System hat den Nenner s² ' + (a1 === 0 ? '' : (a1 < 0 ? '− ' : '+ ') + Math.abs(a1) + '·s ') + '+ ' + a0 + ' (s in 1/s, Koeffizienten als Zahlenwerte). Wie ist sein Stabilitätsverhalten?', right: m[c.stability(poles)], wrong: [S, M, Ins].filter(x => x !== m[c.stability(poles)]), altRight: m[hu],
      expl: ['Pole = Nullstellen des Nenners: s² ' + (a1 === 0 ? '' : (a1 < 0 ? '− ' : '+ ') + Math.abs(a1) + '·s ') + '+ ' + a0 + ' = 0 ⇒ s = ' + pt + '.', 'Ein System ist stabil, wenn alle Pole einen negativen Realteil haben. Pole auf der imaginären Achse (einfach) bedeuten Grenzstabilität, ein Pol mit positivem Realteil bedeutet Instabilität.', 'Hier: ' + m[kind] + '. (Bei einem Nenner 2. Grades genügt auch: a₁ > 0 und a₀ > 0 ⇒ stabil.)'],
      tips: ['Stabilität liest man an den Polen ab, also an den Nullstellen des Nenners.', 'Realteil aller Pole negativ: stabil. Realteil 0: Grenzfall. Realteil positiv: instabil.', 'Löse s² + a₁·s + a₀ = 0 und betrachte den Realteil −a₁/2.'] });
  };
  G.lp12 = R => {
    const c = C(), p1 = pk(R, [5, 10, 20]), p2 = p1 + pk(R, [10, 20, 30]), b = pk(R, [10, 20, 50, 100]), t0 = pk(R, [0.02, 0.05, 0.1]);
    const e = c.TABLE.find(x => x.id === 'diff2'), v = b * e.fn(t0, { a: p1, b: p2 });
    const sim = c.rk4((t, y) => [y[1], -(p1 + p2) * y[1] - p1 * p2 * y[0]], [0, b], 0, t0, 20000), alt = sim[sim.length - 1][1][0];
    return numQ({ text: 'Die Bildfunktion ist F(s) = ' + b + ' / ((s + ' + p1 + ')(s + ' + p2 + ')) (s in 1/s, Koeffizienten als Zahlenwerte). Wie groß ist die Zeitfunktion f(t) = ℒ⁻¹{F(s)} bei t = ' + f(t0, 2) + ' s (Zahl ohne Einheit)?', unit: '', label: 'f(t₀) (ohne Einheit)', value: v, alt, tol: Math.max(1e-4, Math.abs(v) * 0.005),
      expl: ['Partialbruchzerlegung: ' + b + ' / ((s + ' + p1 + ')(s + ' + p2 + ')) = ' + f(b / (p2 - p1), 4) + ' · (1/(s + ' + p1 + ') − 1/(s + ' + p2 + ')).', 'Tabelle: 1/(s + a) ∘—• e^(−a·t). Also f(t) = ' + f(b / (p2 - p1), 4) + ' · (e^(−' + p1 + '·t) − e^(−' + p2 + '·t)).', 'Bei t = ' + f(t0, 2) + ' s: f = ' + f(b / (p2 - p1), 4) + ' · (' + f(Math.exp(-p1 * t0), 5) + ' − ' + f(Math.exp(-p2 * t0), 5) + ') = ' + f(v, 4) + '.'],
      tips: ['Zerlege F(s) in Partialbrüche, dann liest du jeden Summanden in der Tabelle ab.', 'Ansatz: A/(s + ' + p1 + ') + B/(s + ' + p2 + '). A = ' + b + '/(' + p2 + ' − ' + p1 + '), B = −A.', 'f(t) = A·(e^(−' + p1 + '·t) − e^(−' + p2 + '·t)). Setze t = ' + f(t0, 2) + ' s ein.'] });
  };

  /* ================================================================ Fourier (fo) */
  const FN = { square: 'Rechtecksignal (symmetrisch, Werte ±A)', triangle: 'Dreiecksignal (ungerade, Werte −A bis +A)', saw: 'Sägezahnsignal (steigt in jeder Periode von −A auf +A, ungerade)' };
  const FSH = { square: 'Rechteck', triangle: 'Dreieck', saw: 'Sägezahn' };
  const bnFormula = { square: 'b_n = 4A / (n·π) für ungerades n, sonst 0', triangle: 'b_n = ± 8A / (n²·π²) für ungerades n (abwechselndes Vorzeichen), sonst 0', saw: 'b_n = ± 2A / (n·π) für alle n (abwechselndes Vorzeichen)' };
  const rmsFormula = { square: 'A', triangle: 'A/√3', saw: 'A/√3' };
  const AS = [1, 2, 3, 5, 10, 12];
  G.fo1 = R => {
    const c = C(), A = pk(R, AS), v = c.bn('square', A, 1);
    return numQ({ text: 'Ein symmetrisches Rechtecksignal wechselt zwischen +' + A + ' V und −' + A + ' V (Mittelwert 0). Wie groß ist die Amplitude b₁ der Grundschwingung in seiner Fourier-Reihe?', unit: 'V', label: 'Amplitude b₁', value: v, alt: c.chk.bnNumeric('square', A, 1), tol: tolOf(v, 0.005, 0.005),
      expl: ['Das Signal ist ungerade (f(−t) = −f(t)): Nur Sinusglieder b_n·sin(nωt) treten auf.', 'Koeffizienten: b_n = 2/T·∫ f(t)·sin(nωt) dt. Für das Rechteck ergibt sich b_n = 4A / (n·π) (n ungerade).', 'b₁ = 4·' + A + ' V / π = ' + f(v, 4) + ' V (das ist mehr als der Dachwert ' + A + ' V des Rechtecks).'],
      tips: ['Das Rechteck hat nur Sinusglieder und nur ungerade Harmonische. Die Grundschwingung ist die erste davon.', 'b_n = 4A / (n·π) für ungerades n.', 'Setze n = 1 und A = ' + A + ' V ein und teile durch π.'] });
  };
  G.fo2 = R => {
    const c = C(), A = pk(R, AS), n = pk(R, [3, 5, 7, 9]), v = c.bn('square', A, n);
    return numQ({ text: 'Ein symmetrisches Rechtecksignal mit dem Spitzenwert A = ' + A + ' V (Werte +A und −A) wird in eine Fourier-Reihe entwickelt. Wie groß ist die Amplitude der ' + n + '. Harmonischen (Frequenz ' + n + '·f₁)?', unit: 'V', label: 'Amplitude b' + n, value: v, alt: c.chk.bnNumeric('square', A, n), tol: tolOf(v, 0.005, 0.002),
      expl: ['Rechteck: b_n = 4A / (n·π) für ungerades n.', 'b' + n + ' = 4·' + A + ' V / (' + n + '·π) = ' + f(4 * A, 2) + ' V / ' + f(n * PI, 4) + '.', 'b' + n + ' = ' + f(v, 4) + ' V. Das ist ' + f(1 / n * 100, 1) + ' % der Grundschwingung (Amplitude fällt mit 1/n).'],
      tips: ['Die Amplituden der Harmonischen sinken beim Rechteck mit 1/n.', 'b_n = 4A / (n·π).', 'Schreibe 4·' + A + ' / (' + n + '·π) in den Rechner.'] });
  };
  G.fo3 = R => {
    const c = C(), A = pk(R, AS), n = pk(R, [3, 5, 7]), v = Math.abs(c.bn('triangle', A, n));
    return numQ({ text: 'Ein Dreiecksignal (ungerade, Werte zwischen −' + A + ' V und +' + A + ' V) wird in eine Fourier-Reihe entwickelt. Wie groß ist der Betrag der Amplitude der ' + n + '. Harmonischen?', unit: 'V', label: 'Betrag |b' + n + '|', value: v, alt: Math.abs(c.chk.bnNumeric('triangle', A, n)), tol: tolOf(v, 0.005, 0.0002),
      expl: ['Dreieck: b_n = ±8A / (n²·π²) für ungerades n (Vorzeichen wechselt von Harmonischer zu Harmonischer), geradzahlige fehlen.', '|b' + n + '| = 8·' + A + ' V / (' + n + '²·π²) = ' + f(8 * A, 2) + ' V / ' + f(n * n * PI * PI, 4) + '.', '|b' + n + '| = ' + f(v, 5) + ' V. Die Amplituden fallen mit 1/n², also viel schneller als beim Rechteck: Das Dreieck ist spektral „sauberer“.'],
      tips: ['Beim Dreieck fallen die Amplituden mit dem Quadrat von n.', '|b_n| = 8A / (n²·π²) für ungerades n.', 'n² = ' + (n * n) + ', π² = ' + f(PI * PI, 4) + '. Dann 8·' + A + ' durch das Produkt teilen.'] });
  };
  G.fo4 = R => {
    const c = C(), A = pk(R, AS), n = pk(R, [1, 2, 3, 4, 5]), v = Math.abs(c.bn('saw', A, n));
    return numQ({ text: 'Ein Sägezahnsignal steigt in jeder Periode von −' + A + ' V auf +' + A + ' V und springt dann zurück. Wie groß ist der Betrag der Amplitude der ' + n + '. Harmonischen in der Fourier-Reihe?', unit: 'V', label: 'Betrag |b' + n + '|', value: v, alt: Math.abs(c.chk.bnNumeric('saw', A, n)), tol: tolOf(v, 0.005, 0.002),
      expl: ['Sägezahn (ungerade): b_n = ±2A / (n·π) mit alternierendem Vorzeichen, alle Harmonischen (gerade und ungerade) sind vorhanden.', '|b' + n + '| = 2·' + A + ' V / (' + n + '·π) = ' + f(2 * A, 2) + ' V / ' + f(n * PI, 4) + '.', '|b' + n + '| = ' + f(v, 4) + ' V (fällt mit 1/n).'],
      tips: ['Der Sägezahn enthält alle Harmonischen, nicht nur die ungeraden. Das Vorzeichen wechselt, der Betrag fällt mit 1/n.', '|b_n| = 2A / (n·π).', 'Rechne 2·' + A + ' / (' + n + '·π).'] });
  };
  G.fo5 = R => {
    const c = C(), kind = pk(R, ['square', 'triangle', 'saw']), A = pk(R, AS), v = c.rmsTotal(kind, A);
    return numQ({ text: 'Ein ' + FN[kind] + ' hat den Spitzenwert A = ' + A + ' V. Wie groß ist sein Effektivwert (Wurzel aus dem Mittelwert des Quadrats über eine Periode)?', unit: 'V', label: 'Effektivwert U_eff', value: v, alt: c.chk.rmsNumeric(kind, A), tol: tolOf(v, 0.005, 0.005),
      expl: [kind === 'square' ? 'Das Quadrat des Rechtecks ist immer A², der Mittelwert also A²: U_eff = A.' : kind === 'triangle' ? 'Auf einer Viertelperiode steigt der Wert linear von 0 auf A: u = A·x/x₀. Mittelwert des Quadrats = A²/3.' : 'Beim Sägezahn ändert sich der Betrag in jeder halben Periode linear zwischen 0 und A: u = A·x/x₀ mit x von 0 bis x₀ = T/2. Mittelwert des Quadrats = A²/3.', 'U_eff = ' + rmsFormula[kind] + ' = ' + (kind === 'square' ? A + ' V' : A + ' V / √3 = ' + A + ' / ' + f(Math.sqrt(3), 4) + ' V') + '.', 'U_eff = ' + f(v, 4) + ' V. (Kontrolle über Parseval: Quadratsumme der Harmonischen b_n²/2 ergibt dasselbe.)'],
      tips: ['Effektivwert = Wurzel aus dem quadratischen Mittelwert über eine Periode. Beim Rechteck ist das Quadrat konstant.', kind === 'square' ? 'Beim Rechteck gilt U_eff = A (der Spitzenwert).' : 'Linearer Verlauf: Mittelwert von (A·x)² ist A²/3, daher U_eff = A/√3.', kind === 'square' ? 'Setze A = ' + A + ' V ein.' : 'Rechne ' + A + ' / √3.'] });
  };
  G.fo6 = R => {
    const c = C(), A = pk(R, AS), N = pk(R, [3, 5, 7, 9]), v = c.rmsPartial('square', A, N), hs = c.harmonics('square', N), bs = hs.map(n => c.bn('square', A, n));
    return numQ({ text: 'Von einem Rechtecksignal (Spitzenwert A = ' + A + ' V) werden nur die Harmonischen bis zur Ordnung n = ' + N + ' verwendet (Teilsumme, also ' + hs.join('., ') + '. Harmonische). Wie groß ist der Effektivwert dieser Teilsumme?', unit: 'V', label: 'Effektivwert der Teilsumme', value: v, alt: c.chk.rmsPartialNumeric('square', A, N), tol: tolOf(v, 0.005, 0.005),
      expl: ['Amplituden: ' + hs.map((n, i) => 'b' + n + ' = ' + f(bs[i], 4) + ' V').join(', ') + '.', 'Effektivwert eines Sinusglieds: b_n/√2. Verschiedene Frequenzen addieren sich leistungsmäßig: U_eff² = Σ b_n² / 2.', 'U_eff = √(' + bs.map(b => f(b * b, 4)).join(' + ') + ') / √2 = ' + f(v, 4) + ' V (der volle Rechteck-Effektivwert wäre ' + A + ' V).'],
      tips: ['Sinusglieder unterschiedlicher Frequenz sind orthogonal: Die Quadrate der Effektivwerte addieren sich.', 'U_eff² = (b₁² + b₃² + …) / 2 (Satz von Parseval).', 'Berechne die Amplituden b_n = 4A/(n·π), quadriere, addiere, teile durch 2, ziehe die Wurzel.'] });
  };
  G.fo7 = R => {
    const c = C(), N = pk(R, [5, 7, 9, 11]), v = c.thd('square', N) * 100, hs = c.harmonics('square', N);
    return numQ({ text: 'Ein Rechtecksignal wird durch seine Harmonischen bis zur Ordnung n = ' + N + ' angenähert (Teilsumme). Wie groß ist der Oberschwingungsgehalt THD = √(Σ b_n², n ≥ 2) / b₁ dieser Teilsumme in Prozent?', unit: '%', label: 'THD', value: v, alt: c.chk.thdNumeric('square', N) * 100, tol: tolOf(v, 0.005, 0.02),
      expl: ['Beim Rechteck gilt b_n/b₁ = 1/n (nur ungerades n).', 'THD² = ' + hs.slice(1).map(n => '(1/' + n + ')²').join(' + ') + ' = ' + f(hs.slice(1).reduce((s, n) => s + 1 / (n * n), 0), 5) + '.', 'THD = √' + f(hs.slice(1).reduce((s, n) => s + 1 / (n * n), 0), 5) + ' = ' + f(v / 100, 4) + ' = ' + f(v, 2) + ' %. Mit allen Gliedern (n → ∞) wären es ' + f(c.thdInf('square') * 100, 2) + ' %.'],
      tips: ['Der THD vergleicht die Oberschwingungen mit der Grundschwingung. Die Amplitude b₁ kürzt sich heraus, nur die Verhältnisse b_n/b₁ zählen.', 'Beim Rechteck ist b_n/b₁ = 1/n. THD = √(1/3² + 1/5² + … + 1/N²).', 'Quadriere die Kehrwerte (1/9, 1/25, …), addiere sie, ziehe die Wurzel, mal 100.'] });
  };
  G.fo8 = R => {
    const c = C(), kind = pk(R, ['square', 'triangle', 'saw']), v = c.klirrInf(kind) * 100;
    return numQ({ text: 'Ein ' + FN[kind] + ' wird mit allen unendlich vielen Gliedern seiner Fourier-Reihe betrachtet. Wie groß ist der Klirrfaktor k = (Effektivwert aller Oberschwingungen) / (Gesamteffektivwert) in Prozent?', unit: '%', label: 'Klirrfaktor k', value: v, alt: c.klirr(kind, 200000) * 100, tol: tolOf(v, 0.005, 0.02),
      expl: ['Der Effektivwert der Grundschwingung ist b₁/√2, der Gesamteffektivwert ist U_eff = ' + rmsFormula[kind] + ' (hier mit A = 1: ' + f(c.rmsTotal(kind, 1), 5) + ').', 'Oberschwingungsanteil: U_OS² = U_eff² − U₁² = ' + f(Math.pow(c.rmsTotal(kind, 1), 2), 5) + ' − ' + f(Math.pow(c.bn(kind, 1, 1), 2) / 2, 5) + ' = ' + f(Math.pow(c.rmsTotal(kind, 1), 2) - Math.pow(c.bn(kind, 1, 1), 2) / 2, 5) + '.', 'k = U_OS / U_eff = ' + f(v / 100, 5) + ' = ' + f(v, 2) + ' %. (Der THD bezogen auf die Grundschwingung ist ' + f(c.thdInf(kind) * 100, 2) + ' %.)'],
      tips: ['Klirrfaktor: Verhältnis von Oberschwingungs-Effektivwert zum Gesamt-Effektivwert (nicht zur Grundschwingung).', 'k = √(U_eff² − U₁²) / U_eff mit U₁ = b₁/√2.', 'Setze A = 1: Gesamt-Effektivwert ' + rmsFormula[kind] + ', b₁ = ' + f(c.bn(kind, 1, 1), 4) + ', damit die Quadrate bilden.'] });
  };
  G.fo9 = R => {
    const c = C(), A = pk(R, AS), v = c.gibbsOvershoot(A);
    return numQ({ text: 'Ein Rechtecksignal mit den Werten ±' + A + ' V wird durch eine Fourier-Teilsumme mit sehr vielen Gliedern (N → ∞) angenähert. An der Sprungstelle schießt die Teilsumme über den Dachwert hinaus (Gibbs-Phänomen). Wie viele Volt liegt das Maximum über ' + A + ' V? (Der Überschwinger beträgt rund ' + f(c.gibbsPercentOfJump(), 2) + ' % des Sprungs von −' + A + ' V auf +' + A + ' V.)', unit: 'V', label: 'Überschwinger', value: v, alt: c.chk.gibbsNumeric(A, 401), tol: tolOf(v, 0.01, 0.002),
      expl: ['Der Sprung hat die Höhe 2A = ' + (2 * A) + ' V. Der Überschwinger geht nicht mit N gegen null, sondern bleibt bei rund ' + f(c.gibbsPercentOfJump(), 2) + ' % des Sprungs (Integralsinus: (2/π)·Si(π) = ' + f(c.gibbsFactor(), 4) + ').', 'Überschwinger = ' + f(c.gibbsPercentOfJump() / 100, 4) + ' · 2A = ' + f(c.gibbsPercentOfJump() / 100, 4) + ' · ' + (2 * A) + ' V = ' + f(v, 4) + ' V.', 'Maximum der Teilsumme ≈ ' + f(A + v, 4) + ' V. Mehr Glieder machen den Überschwinger nur schmaler, nicht niedriger.'],
      tips: ['Das Gibbs-Phänomen: Der Überschwinger verschwindet nicht, wenn N wächst. Er hängt nur von der Sprunghöhe ab.', 'Überschwinger ≈ ' + f(c.gibbsPercentOfJump(), 2) + ' % der Sprunghöhe. Die Sprunghöhe ist 2A (von −A nach +A).', 'Rechne ' + f(c.gibbsPercentOfJump() / 100, 4) + ' · ' + (2 * A) + ' V.'] });
  };
  G.fo10 = R => {
    const c = C(), kind = pk(R, ['square', 'triangle', 'saw']), O = 'Nur ungerade Harmonische (1., 3., 5., …)', Al = 'Alle Harmonischen (1., 2., 3., 4., …)', Ev = 'Nur geradzahlige Harmonische (2., 4., 6., …)';
    const hs = c.harmonics(kind, 8), right = hs.length === 4 ? O : Al;
    const alt = [1, 2, 3, 4, 5, 6].every(n => (n % 2 === 0) === (Math.abs(c.chk.bnNumeric(kind, 1, n)) < 1e-5)) ? O : Al;
    return choiceQ(R, { text: 'Welche Harmonischen enthält die Fourier-Reihe des Signals „' + FN[kind] + '“?', right, wrong: [O, Al, Ev].filter(x => x !== right), altRight: alt,
      expl: [kind === 'saw' ? 'Der Sägezahn ist weder halbwellensymmetrisch noch gerade: Er hat alle Harmonischen.' : 'Das Signal ist halbwellensymmetrisch (f(t + T/2) = −f(t)). Das hat zur Folge, dass die geradzahligen Harmonischen verschwinden.', bnFormula[kind] + '.', 'Alle drei Signale sind ungerade Funktionen: In der Reihe stehen nur Sinusglieder, keine Kosinusglieder und kein Gleichanteil.'],
      tips: ['Halbwellensymmetrie (die zweite Halbwelle ist das negative Spiegelbild der ersten) bedeutet: nur ungerade Harmonische.', 'Rechteck und Dreieck sind halbwellensymmetrisch. Der Sägezahn springt nach einer Periode zurück und ist es nicht.', 'Prüfe, ob b_2 ≠ 0 ist: Beim Sägezahn ist b₂ = −A/π, bei Rechteck und Dreieck null.'] });
  };
  G.fo11 = R => {
    const c = C(), kind = pk(R, ['square', 'triangle', 'saw']), n = kind === 'saw' ? pk(R, [2, 3, 4, 5]) : pk(R, [3, 5, 7, 9]), v = Math.abs(c.bn(kind, 1, n) / c.bn(kind, 1, 1)) * 100;
    return numQ({ text: 'Bei einem ' + FN[kind] + ' soll die Amplitude der ' + n + '. Harmonischen im Verhältnis zur Grundschwingung angegeben werden. Wie groß ist |b' + n + ' / b₁| in Prozent?', unit: '%', label: 'Verhältnis |b' + n + '/b₁|', value: v, alt: Math.abs(c.chk.bnNumeric(kind, 1, n) / c.chk.bnNumeric(kind, 1, 1)) * 100, tol: tolOf(v, 0.005, 0.01),
      expl: [bnFormula[kind] + '.', 'Verhältnis: |b' + n + '/b₁| = ' + (kind === 'triangle' ? '1/n² = 1/' + n + '²' : '1/n = 1/' + n) + ' = ' + f(v / 100, 5) + '.', 'Das sind ' + f(v, 2) + ' %. ' + (kind === 'triangle' ? 'Die Amplituden fallen mit 1/n² (schnelle Konvergenz).' : 'Die Amplituden fallen mit 1/n (langsame Konvergenz, deshalb starkes Gibbs-Phänomen).')],
      tips: ['Bilde das Verhältnis zweier Koeffizienten: Die gemeinsamen Faktoren (A, π, 8 bzw. 4 bzw. 2) kürzen sich.', kind === 'triangle' ? '|b_n/b₁| = 1/n².' : '|b_n/b₁| = 1/n.', 'Setze n = ' + n + ' ein und multipliziere mit 100.'] });
  };

  /* ================================================================ Aufgabenliste */
  const defs = [
    ['cx', 1, 'Betrag aus kartesischer Form', 'cx1'], ['cx', 1, 'Phasenwinkel aus kartesischer Form', 'cx2'], ['cx', 1, 'Polar nach kartesisch', 'cx3'], ['cx', 1, 'Induktiver Blindwiderstand', 'cx4'], ['cx', 1, 'Kapazitiver Blindwiderstand', 'cx5'],
    ['cx', 2, 'Reihenschaltung R, L, C', 'cx6'], ['cx', 2, 'Strom im RL-Glied', 'cx7'], ['cx', 2, 'Parallelschaltung R und C', 'cx8'], ['cx', 2, 'Resonanzfrequenz', 'cx9'], ['cx', 3, 'Bandbreite des Reihenschwingkreises', 'cx10'], ['cx', 3, 'Wirkleistung im RL-Glied', 'cx11'],
    ['mx', 1, 'Zwei Gleichungen (Cramer)', 'mx1'], ['mx', 1, 'Determinante 2×2', 'mx2'], ['mx', 2, 'Determinante 3×3', 'mx3'], ['mx', 2, 'Drei Gleichungen (Gauss)', 'mx4'], ['mx', 2, 'Knotenpotenzial mit zwei Knoten', 'mx5'], ['mx', 2, 'Strom durch einen Zweig', 'mx6'],
    ['mx', 3, 'Brückenstrom', 'mx7'], ['mx', 3, 'Leiternetzwerk mit Stromquelle', 'mx8'], ['mx', 3, 'Leistung der Quelle', 'mx9'], ['mx', 2, 'Eindeutig lösbar?', 'mx10'],
    ['de', 1, 'Zeitkonstante RC', 'de1'], ['de', 1, 'Zeitkonstante RL', 'de2'], ['de', 2, 'Aufladen: Spannung nach der Zeit t', 'de3'], ['de', 2, 'Zeit bis 90 %, 95 %, 99 %', 'de4'], ['de', 2, 'RL-Strom nach dem Einschalten', 'de5'], ['de', 2, 'Entladen: Spannung nach der Zeit t', 'de6'],
    ['de', 3, 'Dämpfungsgrad RLC', 'de7'], ['de', 3, 'Gedämpfte Eigenfrequenz', 'de8'], ['de', 3, 'Überschwingweite', 'de9'], ['de', 3, 'Kritischer Widerstand', 'de10'], ['de', 2, 'Schwingfall, Grenzfall oder Kriechfall?', 'de11'],
    ['lp', 1, 'Korrespondenztabelle lesen', 'lp1'], ['lp', 2, 'Bildfunktion an einer Stelle auswerten', 'lp2'], ['lp', 1, 'Pol eines PT1-Glieds', 'lp3'], ['lp', 2, 'Grenzfrequenz des RC-Tiefpasses', 'lp4'], ['lp', 1, 'Nullstelle ablesen', 'lp5'], ['lp', 2, 'Dominanter Pol', 'lp6'],
    ['lp', 2, 'Komplexes Polpaar', 'lp7'], ['lp', 2, 'Betrag des Frequenzgangs in dB', 'lp8'], ['lp', 3, 'Endwertsatz', 'lp9'], ['lp', 3, 'Sprungantwort eines PT1-Glieds', 'lp10'], ['lp', 2, 'Stabilität aus den Polen', 'lp11'], ['lp', 3, 'Rücktransformation per Partialbruch', 'lp12'],
    ['fo', 1, 'Rechteck: Grundschwingung', 'fo1'], ['fo', 1, 'Rechteck: Oberschwingung', 'fo2'], ['fo', 2, 'Dreieck: Oberschwingung', 'fo3'], ['fo', 2, 'Sägezahn: Oberschwingung', 'fo4'], ['fo', 1, 'Effektivwert der Signalformen', 'fo5'], ['fo', 3, 'Effektivwert einer Teilsumme', 'fo6'],
    ['fo', 3, 'Oberschwingungsgehalt (THD) einer Teilsumme', 'fo7'], ['fo', 3, 'Klirrfaktor der vollen Reihe', 'fo8'], ['fo', 2, 'Gibbs-Überschwinger', 'fo9'], ['fo', 1, 'Welche Harmonischen treten auf?', 'fo10'], ['fo', 2, 'Amplitudenverhältnis der Harmonischen', 'fo11']
  ];
  const cnt = {};
  const tasks = defs.map(d => { cnt[d[0]] = (cnt[d[0]] || 0) + 1; return { id: 'mat2' + d[0] + cnt[d[0]], topic: d[0], cat: CATS[TOPICS.findIndex(t => t.k === d[0])], level: d[1], title: d[2], gen: d[3] }; });

  function make(t, R) { const q = G[t.gen](R); q.id = t.id; q.topic = t.topic; q.cat = t.cat; q.level = t.level; q.title = t.title; return q; }
  const makeTask = t => make(t, C().rng('mat2-' + t.id));
  function randomQ(R, level, topic) {
    const pool = tasks.filter(t => (!level || t.level === level) && (!topic || t.topic === topic)), t = pool[Math.floor(R() * pool.length)];
    return make(t, C().rng(Math.floor(R() * 4294967296)));
  }

  /* ================================================================ Erklärtexte (HTML, eigene Formulierung) */
  const fr = (n, d) => '<span class="fr"><span>' + n + '</span><span>' + d + '</span></span>';
  const sq = x => '√<span class="ov">' + x + '</span>';
  const eq = h => '<span class="eq">' + h + '</span>';
  const pc = k => f(C().thdInf(k) * 100, 1);
  const EXPLAIN = {
    cx: `<p>Bei sinusförmigen Größen mit fester Frequenz genügt ein <b>Zeiger</b> aus Betrag und Phasenwinkel. In der komplexen Ebene ist das eine Zahl <i>z</i> = <i>a</i> + j<i>b</i> (kartesisch) oder <i>z</i> = <i>r</i>∠<i>φ</i> (polar). Die imaginäre Einheit heißt in der Elektrotechnik j (j² = −1), weil i schon der Strom ist.</p>
      ${eq('Umrechnung: <i>r</i> = ' + sq('<i>a</i>² + <i>b</i>²') + ' &nbsp; <i>φ</i> = arctan(' + fr('<i>b</i>', '<i>a</i>') + ') (Quadrant beachten) &nbsp; <i>a</i> = <i>r</i>·cos <i>φ</i> &nbsp; <i>b</i> = <i>r</i>·sin <i>φ</i>')}
      <p><b>Rechnen:</b> Addieren und Subtrahieren geht kartesisch (Real- und Imaginärteil einzeln). Multiplizieren und Dividieren ist polar am einfachsten: Beträge malnehmen bzw. teilen, Winkel addieren bzw. subtrahieren.</p>
      ${eq('<i>z</i>₁·<i>z</i>₂ = <i>r</i>₁<i>r</i>₂ ∠ (<i>φ</i>₁ + <i>φ</i>₂) &nbsp; <i>z</i>₁/<i>z</i>₂ = ' + fr('<i>r</i>₁', '<i>r</i>₂') + ' ∠ (<i>φ</i>₁ − <i>φ</i>₂)')}
      <p><b>Impedanzen:</b> Mit <i>ω</i> = 2π<i>f</i> gilt für die drei Grundbauteile:</p>
      ${eq('<i>Z</i><sub>R</sub> = <i>R</i> &nbsp; <i>Z</i><sub>L</sub> = j<i>ωL</i> &nbsp; <i>Z</i><sub>C</sub> = ' + fr('1', 'j<i>ωC</i>') + ' = −j' + fr('1', '<i>ωC</i>'))}
      <p>Reihenschaltung: Impedanzen addieren. Parallelschaltung: Admittanzen <i>Y</i> = 1/<i>Z</i> addieren. Das Ohmsche Gesetz <i>U</i> = <i>Z</i>·<i>I</i> gilt mit komplexen Größen; der Winkel von <i>Z</i> ist der Phasenverschiebungswinkel zwischen Spannung und Strom.</p>
      <p><b>Resonanz</b> (Reihenschwingkreis): Der Blindanteil verschwindet, <i>X</i><sub>L</sub> = <i>X</i><sub>C</sub>. Dann ist die Impedanz minimal (nur <i>R</i>) und der Strom maximal.</p>
      ${eq('<i>f</i><sub>0</sub> = ' + fr('1', '2π' + sq('<i>LC</i>')) + ' &nbsp; <i>Q</i> = ' + fr('1', '<i>R</i>') + sq(fr('<i>L</i>', '<i>C</i>')) + ' &nbsp; <i>B</i> = ' + fr('<i>f</i><sub>0</sub>', '<i>Q</i>'))}
      <p><b>Leistung:</b> Die komplexe Scheinleistung <i>S</i> = <i>U</i>·<i>I</i>* (Strom konjugiert) hat den Realteil <i>P</i> (Wirkleistung) und den Imaginärteil <i>Q</i><sub>B</sub> (Blindleistung, nicht mit der Güte <i>Q</i> verwechseln); |<i>S</i>|² = <i>P</i>² + <i>Q</i><sub>B</sub>².</p>`,
    mx: `<p>Ein lineares Gleichungssystem lässt sich als <b>Matrixgleichung</b> <i>A</i>·<i>x</i> = <i>b</i> schreiben: <i>A</i> enthält die Koeffizienten, <i>x</i> die Unbekannten, <i>b</i> die rechte Seite. Es ist genau dann eindeutig lösbar, wenn die Determinante det <i>A</i> ≠ 0 ist.</p>
      ${eq('2×2: det <i>A</i> = <i>a</i>₁₁<i>a</i>₂₂ − <i>a</i>₁₂<i>a</i>₂₁ &nbsp; &nbsp; Cramer: <i>x</i><sub>k</sub> = ' + fr('det <i>A</i><sub>k</sub>', 'det <i>A</i>'))}
      <p>Das <b>Gauss-Verfahren</b> bringt das System durch Zeilenoperationen auf Dreiecksform (Eliminieren) und liefert die Unbekannten dann von unten nach oben (Rückwärtseinsetzen). Es ist für Rechner und Hand der Standardweg; Cramer lohnt nur bei kleinen Systemen.</p>
      <p><b>Knotenpotenzialverfahren:</b> Ein Knoten wird als Bezugsknoten (Masse, 0 V) gewählt. Für jeden weiteren Knoten gilt die Knotenregel in Leitwerten <i>G</i> = 1/<i>R</i>:</p>
      ${eq('<b>G</b>·<b>V</b> = <b>I</b><sub>q</sub> &nbsp; mit &nbsp; <i>G</i><sub>kk</sub> = Summe der Leitwerte am Knoten k, &nbsp; <i>G</i><sub>kl</sub> = −Leitwert zwischen k und l')}
      <p>Die rechte Seite enthält die Quellenströme, die in den Knoten hinein fließen. Eine Spannungsquelle <i>E</i> mit Reihenwiderstand <i>R</i> wird zur Stromquelle <i>E</i>/<i>R</i> mit parallelem Leitwert 1/<i>R</i>. Aus den Potenzialen folgen alle Zweigströme: <i>I</i> = (<i>V</i><sub>a</sub> − <i>V</i><sub>b</sub>)/<i>R</i>. Die Probe: Summe der Ströme an jedem Knoten gleich null, abgegebene gleich verbrauchte Leistung.</p>`,
    de: `<p>Kondensator und Spule speichern Energie, deshalb enthalten ihre Gleichungen Ableitungen: <i>i</i> = <i>C</i>·d<i>u</i>/d<i>t</i> und <i>u</i> = <i>L</i>·d<i>i</i>/d<i>t</i>. Eine Schaltung mit einem Speicher führt auf eine <b>Differenzialgleichung 1. Ordnung</b>, mit zwei Speichern (RLC) auf eine <b>2. Ordnung</b>.</p>
      <p><b>RC-Glied</b> am Spannungssprung <i>U</i>: <i>RC</i>·<i>u</i><sub>C</sub>′ + <i>u</i><sub>C</sub> = <i>U</i>. Mit <i>τ</i> = <i>RC</i> und <i>u</i><sub>C</sub>(0) = 0:</p>
      ${eq('<i>u</i><sub>C</sub>(<i>t</i>) = <i>U</i>·(1 − e<sup>−<i>t</i>/<i>τ</i></sup>) &nbsp; Entladen: <i>u</i><sub>C</sub>(<i>t</i>) = <i>U</i><sub>0</sub>·e<sup>−<i>t</i>/<i>τ</i></sup> &nbsp; <i>t</i><sub>p</sub> = −<i>τ</i>·ln(1 − <i>p</i>)')}
      <p>Nach 1·<i>τ</i> sind 63,2 % erreicht, nach 3·<i>τ</i> etwa 95 %, nach 5·<i>τ</i> über 99 %. <b>RL-Glied:</b> <i>τ</i> = <i>L</i>/<i>R</i>, der Strom steigt wie <i>i</i>(<i>t</i>) = (<i>U</i>/<i>R</i>)·(1 − e<sup>−<i>t</i>/<i>τ</i></sup>).</p>
      <p><b>Reihen-RLC</b> (Spannung am Kondensator): <i>LC</i>·<i>u</i>″ + <i>RC</i>·<i>u</i>′ + <i>u</i> = <i>U</i>. Kenngrößen:</p>
      ${eq('<i>α</i> = ' + fr('<i>R</i>', '2<i>L</i>') + ' &nbsp; <i>ω</i><sub>0</sub> = ' + fr('1', sq('<i>LC</i>')) + ' &nbsp; <i>D</i> = ' + fr('<i>α</i>', '<i>ω</i><sub>0</sub>') + ' = ' + fr('<i>R</i>', '2') + sq(fr('<i>C</i>', '<i>L</i>')) + ' &nbsp; <i>ω</i><sub>d</sub> = ' + sq('<i>ω</i><sub>0</sub>² − <i>α</i>²'))}
      <p>Die charakteristische Gleichung <i>s</i>² + 2<i>α</i>·<i>s</i> + <i>ω</i><sub>0</sub>² = 0 entscheidet: <b>D &lt; 1</b> Schwingfall (komplexe Wurzeln <i>s</i> = −<i>α</i> ± j<i>ω</i><sub>d</sub>, gedämpft schwingend), <b>D = 1</b> aperiodischer Grenzfall (<i>R</i><sub>krit</sub> = 2·√(<i>L</i>/<i>C</i>), schnellster Anstieg ohne Überschwingen), <b>D &gt; 1</b> Kriechfall (zwei reelle Wurzeln). Die Überschwingweite im Schwingfall ist <i>ü</i> = e<sup>−π<i>D</i>/√(1−<i>D</i>²)</sup>, unabhängig von der Größe der Sprunghöhe.</p>`,
    lp: `<p>Die <b>Laplace-Transformation</b> verwandelt eine Zeitfunktion <i>f</i>(<i>t</i>) für <i>t</i> ≥ 0 in eine Bildfunktion <i>F</i>(<i>s</i>) mit der komplexen Frequenz <i>s</i> = <i>σ</i> + j<i>ω</i>. Der Nutzen: Differenzieren wird zum Multiplizieren mit <i>s</i>, Integrieren zum Teilen durch <i>s</i>, und Differenzialgleichungen werden zu algebraischen Gleichungen.</p>
      ${eq('<i>F</i>(<i>s</i>) = ∫<sub>0</sub><sup>∞</sup> <i>f</i>(<i>t</i>)·e<sup>−<i>st</i></sup> d<i>t</i> &nbsp; ℒ{<i>f</i>′} = <i>s</i>·<i>F</i>(<i>s</i>) − <i>f</i>(0) &nbsp; ℒ{∫<i>f</i>} = ' + fr('<i>F</i>(<i>s</i>)', '<i>s</i>'))}
      <p>Die <b>Übertragungsfunktion</b> <i>H</i>(<i>s</i>) = <i>Y</i>(<i>s</i>)/<i>U</i>(<i>s</i>) ist ein Bruch aus Zähler- und Nennerpolynom in <i>s</i>. Die Nullstellen des Zählers heißen <b>Nullstellen</b>, die des Nenners <b>Pole</b>. Ihre Lage in der <i>s</i>-Ebene bestimmt das Verhalten:</p>
      <ul><li><b>stabil</b>: alle Pole mit Re(<i>s</i>) &lt; 0 (links der imaginären Achse), Einschwingen klingt ab;</li><li><b>grenzstabil</b>: einfache Pole auf der imaginären Achse und keiner rechts davon (Dauerschwingung bei ±j<i>ω</i>, Integrierverhalten bei <i>s</i> = 0);</li><li><b>instabil</b>: mindestens ein Pol mit Re(<i>s</i>) &gt; 0 (oder ein mehrfacher Pol auf der imaginären Achse), die Antwort wächst unbegrenzt an.</li></ul>
      <p>Setzt man <i>s</i> = j<i>ω</i>, erhält man den <b>Frequenzgang</b> <i>H</i>(j<i>ω</i>) mit Betrag (Verstärkung) und Phase. Der <b>Endwertsatz</b> liefert das Ergebnis für <i>t</i> → ∞ ohne Rücktransformation: <i>y</i>(∞) = lim<sub><i>s</i>→0</sub> <i>s</i>·<i>Y</i>(<i>s</i>) (gilt nur, wenn alle Pole von <i>s</i>·<i>Y</i>(<i>s</i>) links der imaginären Achse liegen, also bei einem stabilen System). Zurück in den Zeitbereich kommt man mit Partialbruchzerlegung und der Tabelle.</p>`,
    fo: `<p>Jedes technisch übliche periodische Signal lässt sich als Gleichanteil plus Summe von Sinusschwingungen schreiben: einer Grundschwingung mit <i>f</i>₁ = 1/<i>T</i> und ihren ganzzahligen Vielfachen, den <b>Harmonischen</b>. Das ist die Fourier-Reihe:</p>
      ${eq('<i>f</i>(<i>t</i>) = <i>a</i><sub>0</sub> + Σ<sub><i>n</i>≥1</sub> [<i>a</i><sub><i>n</i></sub>·cos(<i>nωt</i>) + <i>b</i><sub><i>n</i></sub>·sin(<i>nωt</i>)] &nbsp; <i>b</i><sub><i>n</i></sub> = ' + fr('2', '<i>T</i>') + '∫<sub>0</sub><sup><i>T</i></sup> <i>f</i>(<i>t</i>)·sin(<i>nωt</i>) d<i>t</i>')}
      <p>Symmetrien sparen Arbeit: Eine <b>ungerade</b> Funktion (f(−t) = −f(t)) hat nur Sinusglieder, eine <b>gerade</b> nur Kosinusglieder; bei <b>Halbwellensymmetrie</b> fehlen die geradzahligen Harmonischen. Die drei Standardsignale (Spitzenwert <i>A</i>, ungerade):</p>
      <table><tr><th>Signal</th><th>Koeffizienten</th><th>Effektivwert</th><th>THD (n → ∞)</th></tr><tr><td>Rechteck</td><td><i>b</i><sub>n</sub> = 4<i>A</i>/(<i>n</i>π), <i>n</i> ungerade</td><td><i>A</i></td><td>${pc('square')} %</td></tr><tr><td>Dreieck</td><td><i>b</i><sub>n</sub> = ±8<i>A</i>/(<i>n</i>²π²), <i>n</i> ungerade</td><td><i>A</i>/√3</td><td>${pc('triangle')} %</td></tr><tr><td>Sägezahn</td><td><i>b</i><sub>n</sub> = ±2<i>A</i>/(<i>n</i>π), alle <i>n</i></td><td><i>A</i>/√3</td><td>${pc('saw')} %</td></tr></table>
      <p><b>Effektivwert und Klirrfaktor:</b> Nach Parseval addieren sich die Quadrate: <i>U</i><sub>eff</sub>² = Σ <i>b</i><sub>n</sub>²/2. Der Oberschwingungsgehalt (THD) vergleicht die Oberschwingungen mit der Grundschwingung, der Klirrfaktor <i>k</i> mit dem Gesamtwert:</p>
      ${eq('THD = ' + fr(sq('Σ<sub><i>n</i>≥2</sub> <i>b</i><sub>n</sub>²'), '|<i>b</i><sub>1</sub>|') + ' &nbsp; <i>k</i> = ' + fr(sq('Σ<sub><i>n</i>≥2</sub> <i>b</i><sub>n</sub>²'), sq('Σ<sub><i>n</i>≥1</sub> <i>b</i><sub>n</sub>²')) + ' &nbsp; <i>k</i> = ' + fr('THD', sq('1 + THD²')))}
      <p><b>Gibbs-Phänomen:</b> An Sprungstellen schießen die Teilsummen um etwa ${f(C().gibbsPercentOfJump(), 2)} % der Sprunghöhe über. Mehr Glieder machen den Überschwinger schmaler, aber nicht niedriger. Stetige Signale wie das Dreieck zeigen das nicht.</p>`
  };

  root.MAT2_DATA = { topics: TOPICS, cats: CATS, explain: EXPLAIN, tasks, gens: G, make, makeTask, randomQ, eng };
  root.MAT2_TASKS = tasks.map(t => ({ id: t.id, cat: t.cat, title: t.title, level: t.level }));
  if (typeof module !== 'undefined' && module.exports) module.exports = { DATA: root.MAT2_DATA, TASKS: root.MAT2_TASKS };
})(typeof window !== 'undefined' ? window : globalThis);
