'use strict';
/* Tonfunk Mechanik-Lab: reine Rechenlogik (Kennung 'mch'). window.MCH_CORE bzw. module.exports.
   Alle Werkstoffkennwerte, Reibungszahlen, E-Module, Sicherheiten und Tabellenwerte sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Bauteile.
   Maßgebend sind Tabellenbuch, Datenblatt, Normen und die Vorgaben des Betriebs.
   Einheiten (durchgehend): Kraft in N, Länge je nach Funktion in m oder mm (steht an der Funktion), Moment in Nm bzw. Nmm, Spannung in N/mm², Fläche in mm², Winkel in Grad (math. positiv = gegen den Uhrzeigersinn, 0° = nach rechts), Arbeit in J (= Nm), Leistung in W.
   Ungültige Eingaben (Division durch 0, negative Längen, fehlende Zahlen) liefern NaN, nie Infinity.
   Träger: { L, a, b, loads: [ { t: 'F', F, x } oder { t: 'q', q, x1, x2 } ] }: L Länge in m, a und b Lage von Fest- und Loslager in m, Lasten zeigen nach unten (positiv), Eigengewicht des Trägers bleibt unberücksichtigt. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const RAD = Math.PI / 180;

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(n\/mm²|n\/mm2|mm²|mm2|mm³|mm|nmm|nm|kn|kw|°|%|m\/s|mm\/s|j|w|n|m|s)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
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

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Kraft als Vektor */
  /* PRUEFEN P1: Fallbeschleunigung g = 9,81 m/s² (Gewichtskraft G = m · g). Manche Lehrbücher rechnen zum Überschlagen mit 10 m/s²; wir rechnen durchgehend mit 9,81, die Aufgaben nennen die Masse in kg und lassen etwa 1 % Abweichung zu. Passt das, oder soll zum Überschlag g = 10 geübt werden? */
  const G = 9.81;
  const weight = m => (num(m) >= 0 ? m * G : NAN);
  const comp = (F, deg) => (num(F) >= 0 && num(deg) === deg ? { x: F * Math.cos(deg * RAD), y: F * Math.sin(deg * RAD) } : { x: NAN, y: NAN });
  /* Summe zweier Kräfte aus Betrag und Winkel: x, y, Betrag R und Winkel der Resultierenden in Grad (−180 bis 180) */
  function resultant(F1, a1, F2, a2) {
    const u = comp(F1, a1), v = comp(F2, a2), x = u.x + v.x, y = u.y + v.y, R = Math.hypot(x, y);
    return { x, y, R, ang: R < 1e-9 ? 0 : Math.atan2(y, x) / RAD };
  }
  /* Betrag der Resultierenden aus zwei Beträgen und dem eingeschlossenen Winkel γ zwischen den Kraftrichtungen (Kosinussatz): R² = F1² + F2² + 2 · F1 · F2 · cos γ */
  const resMag = (F1, F2, gam) => (num(F1) >= 0 && num(F2) >= 0 && num(gam) === gam ? Math.sqrt(Math.max(0, F1 * F1 + F2 * F2 + 2 * F1 * F2 * Math.cos(gam * RAD))) : NAN);
  /* Zerlegen nach x und y (Winkel gegen die x-Achse) */
  const decomposeXY = (F, deg) => comp(F, deg);
  /* Zerlegen in zwei Richtungen: Die Wirkungslinien schließen die Winkel a1 und a2 mit der Kraft F ein (auf verschiedenen Seiten), Sinussatz im Kräftedreieck. */
  function decomp2(F, a1, a2) {
    if (!(num(F) >= 0) || !(a1 > 0) || !(a2 > 0) || a1 + a2 >= 180) return { F1: NAN, F2: NAN };
    const s = Math.sin((a1 + a2) * RAD); return { F1: F * Math.sin(a2 * RAD) / s, F2: F * Math.sin(a1 * RAD) / s };
  }
  /* PRUEFEN P2: Seilkräfte für eine hängende Last (Gleichgewicht, Sinussatz): Die Seile bilden die Winkel a1 und a2 gegen die Waagerechte; S1 = F · cos a2 / sin(a1 + a2), S2 = F · cos a1 / sin(a1 + a2). Bei zwei gleichen Winkeln von 30° trägt jedes Seil genau die Gewichtskraft. Passt die Darstellung zum Lehrmaterial, und soll das Dreieck der Kräfte (Kräfteck) auch für drei Kräfte gezeichnet werden? */
  function ropes(F, a1, a2) {
    if (!(num(F) >= 0) || !(a1 > 0 && a1 < 90) || !(a2 > 0 && a2 < 90)) return { S1: NAN, S2: NAN };
    const s = Math.sin((a1 + a2) * RAD); return { S1: F * Math.cos(a2 * RAD) / s, S2: F * Math.cos(a1 * RAD) / s };
  }

  /* ============================================================ Hebel und Drehmoment */
  /* PRUEFEN P3: Drehsinn: Im Uhrzeigersinn wirkende Momente zählen positiv (Kraft nach unten rechts vom Drehpunkt = positiv). Gleichgewicht heißt Summe der Momente = 0 um jeden Punkt. Der Balken selbst ist gewichtslos angenommen. Passt diese Vorzeichenvereinbarung zum Unterricht? */
  const moment = (F, l) => (num(F) >= 0 && num(l) >= 0 ? F * l : NAN);
  const leverF2 = (F1, l1, l2) => (num(F1) >= 0 && num(l1) >= 0 && num(l2) > 0 ? F1 * l1 / l2 : NAN);
  const leverL2 = (F1, l1, F2) => (num(F1) >= 0 && num(l1) >= 0 && num(F2) > 0 ? F1 * l1 / F2 : NAN);
  /* Moment mehrerer senkrechter Kräfte (nach unten positiv) um einen Drehpunkt: Σ F · (x − xp); positiv = im Uhrzeigersinn */
  const momentSum = (items, xp) => items.reduce((s, it) => s + it.F * (it.x - xp), 0);

  /* ============================================================ Träger auf zwei Stützen */
  /* PRUEFEN P4: Träger auf zwei Stützen (Festlager A, Loslager B), nur senkrechte Lasten, Eigengewicht und Reibung in den Lagern vernachlässigt, nur statisch bestimmte Fälle. Streckenlast q in N/m mit der Resultierenden q · Länge im Mittelpunkt des belasteten Stücks. Lager dürfen innerhalb des Trägers sitzen (Überstände erlaubt). Reicht das für Industriemechaniker im ersten und zweiten Jahr? */
  const beamOk = bm => !!bm && num(bm.L) > 0 && num(bm.a) >= 0 && num(bm.b) > num(bm.a) && Array.isArray(bm.loads);
  const loadForce = l => (l.t === 'q' ? l.q * (l.x2 - l.x1) : l.F);
  const loadArm = l => (l.t === 'q' ? (l.x1 + l.x2) / 2 : l.x);
  const totalLoad = bm => bm.loads.reduce((s, l) => s + loadForce(l), 0);
  function reactions(bm) {
    if (!beamOk(bm)) return { FA: NAN, FB: NAN, sum: NAN };
    const span = bm.b - bm.a, M = bm.loads.reduce((s, l) => s + loadForce(l) * (loadArm(l) - bm.a), 0), FB = M / span, sum = totalLoad(bm);
    return { FA: sum - FB, FB, sum };
  }
  /* Querkraft V(x) und Biegemoment M(x) an der Stelle x (Betrachtung der linken Seite, positives Moment = untere Faser gezogen) */
  function shear(bm, x) {
    const r = reactions(bm); let v = 0;
    if (x >= bm.a) v += r.FA; if (x >= bm.b) v += r.FB;
    bm.loads.forEach(l => { if (l.t === 'F') { if (x >= l.x) v -= l.F; } else { v -= l.q * Math.max(0, Math.min(x, l.x2) - l.x1); } });
    return v;
  }
  function bending(bm, x) {
    const r = reactions(bm); let m = 0;
    if (x > bm.a) m += r.FA * (x - bm.a); if (x > bm.b) m += r.FB * (x - bm.b);
    bm.loads.forEach(l => { if (l.t === 'F') { if (x > l.x) m -= l.F * (x - l.x); } else { const ln = Math.max(0, Math.min(x, l.x2) - l.x1); m -= l.q * ln * (x - l.x1 - ln / 2); } });
    return m;
  }
  /* größtes Biegemoment (Betrag) mit Ort: Prüfung an allen Knickstellen und an den Nullstellen der Querkraft */
  function mmax(bm) {
    if (!beamOk(bm)) return { M: NAN, x: NAN };
    const pts = [0, bm.L, bm.a, bm.b]; bm.loads.forEach(l => { if (l.t === 'F') pts.push(l.x); else { pts.push(l.x1, l.x2); } });
    const xs = Array.from(new Set(pts.filter(p => p >= 0 && p <= bm.L))).sort((p, q) => p - q), cand = xs.slice();
    for (let i = 0; i + 1 < xs.length; i++) {
      const x0 = xs[i], x1 = xs[i + 1]; if (x1 - x0 < 1e-12) continue;
      const v0 = shear(bm, x0 + 1e-9 * (x1 - x0)), v1 = shear(bm, x1 - 1e-9 * (x1 - x0));
      if (v0 * v1 < 0) cand.push(x0 + (x1 - x0) * v0 / (v0 - v1));
    }
    let best = { M: 0, x: 0 }; cand.forEach(x => { const m = bending(bm, x); if (Math.abs(m) > Math.abs(best.M) + 1e-12) best = { M: m, x }; });
    return best;
  }
  /* Verlauf als Punktliste für die Zeichnung (n Teilstücke) */
  function diagram(bm, n) {
    n = n || 120; const xs = [], V = [], M = [];
    if (!beamOk(bm)) return { xs, V, M };
    for (let i = 0; i <= n; i++) { const x = bm.L * i / n; xs.push(x); V.push(shear(bm, x + (i === n ? -1e-9 : 1e-9))); M.push(bending(bm, x)); }
    return { xs, V, M };
  }
  /* Biegemoment der Einzellast F im Abstand a vom linken Lager bei Stützweite l (Lager an den Enden): M = F · a · (l − a) / l */
  const mbSingle = (F, a, l) => (num(F) >= 0 && num(a) >= 0 && num(l) > 0 && a <= l ? F * a * (l - a) / l : NAN);

  /* ============================================================ Schwerpunkt */
  /* PRUEFEN P5: Flächenschwerpunkt zusammengesetzter Flächen: x_s = Σ(A_i · x_i) / ΣA_i, Aussparungen zählen mit negativer Fläche. Teilschwerpunkte: Rechteck in der Mitte, Dreieck im Drittel der Höhe über der Grundlinie (h/3), Kreis im Mittelpunkt. Der Halbkreis kommt nicht vor. Genügt das? */
  const rectPart = (b, h, x0, y0) => ({ A: b * h, x: x0 + b / 2, y: y0 + h / 2 });
  function centroid(parts) {
    const A = parts.reduce((s, p) => s + p.A, 0); if (!(Math.abs(A) > 1e-12)) return { A: NAN, x: NAN, y: NAN };
    return { A, x: parts.reduce((s, p) => s + p.A * p.x, 0) / A, y: parts.reduce((s, p) => s + p.A * p.y, 0) / A };
  }
  const triCentroidH = h => (num(h) >= 0 ? h / 3 : NAN);

  /* ============================================================ Reibung */
  /* PRUEFEN P6: Reibungszahlen (Übungswerte, trocken, mittlere Tabellenwerte, Haftreibungszahl μ0 größer als Gleitreibungszahl μ): Stahl auf Stahl 0,15 / 0,12, Stahl auf Stahl geschmiert 0,10 / 0,05, Stahl auf Holz 0,50 / 0,40, Gummi auf Beton trocken 0,80 / 0,70, Bremsbelag auf Stahl 0,45 / 0,40. Tabellenbücher nennen Bereiche; stimmen eure Werte? */
  const MU = [
    { id: 'ss', n: 'Stahl auf Stahl, trocken', mu0: 0.15, mu: 0.12 },
    { id: 'sg', n: 'Stahl auf Stahl, geschmiert', mu0: 0.10, mu: 0.05 },
    { id: 'sh', n: 'Stahl auf Holz', mu0: 0.50, mu: 0.40 },
    { id: 'gb', n: 'Gummi auf Beton, trocken', mu0: 0.80, mu: 0.70 },
    { id: 'bs', n: 'Bremsbelag auf Stahl', mu0: 0.45, mu: 0.40 }
  ];
  const muOf = id => MU.find(m => m.id === id) || null;
  const fricMax = (mu, FN) => (num(mu) >= 0 && num(FN) >= 0 ? mu * FN : NAN);
  const incFH = (Gk, a) => (num(Gk) >= 0 && a >= 0 && a <= 90 ? Gk * Math.sin(a * RAD) : NAN);
  const incFN = (Gk, a) => (num(Gk) >= 0 && a >= 0 && a <= 90 ? Gk * Math.cos(a * RAD) : NAN);
  /* PRUEFEN P7: Ein Körper auf der schiefen Ebene bleibt liegen, solange tan α ≤ μ0 (Hangabtrieb ≤ größte Haftreibung); der Grenzwinkel ist der Reibwinkel ρ0 = arctan μ0 (Reibkegel). Beim Gleiten gilt die kleinere Gleitreibungszahl μ. Stimmt diese Darstellung, und ist der Begriff Reibkegel im Unterricht üblich? */
  const critAngle = mu0 => (num(mu0) > 0 ? Math.atan(mu0) / RAD : NAN);
  const holds = (a, mu0) => Math.tan(a * RAD) <= mu0 + 1e-12;
  /* Zugkraft parallel zur Ebene, um den Körper mit gleichbleibender Geschwindigkeit hinaufzuziehen: F = G · (sin α + μ · cos α) */
  const rampUp = (Gk, a, mu) => (num(Gk) >= 0 && num(mu) >= 0 && a >= 0 && a <= 90 ? Gk * (Math.sin(a * RAD) + mu * Math.cos(a * RAD)) : NAN);
  /* Haltekraft parallel zur Ebene, damit der Körper nicht hinabgleitet (Haftreibung hilft mit, nicht unter 0) */
  const rampHold = (Gk, a, mu0) => (num(Gk) >= 0 && num(mu0) >= 0 && a >= 0 && a <= 90 ? Math.max(0, Gk * (Math.sin(a * RAD) - mu0 * Math.cos(a * RAD))) : NAN);

  /* ============================================================ Spannung und Dehnung */
  /* PRUEFEN P8: Elastizitätsmodule (Übungswerte): Stahl 210 000 N/mm², Aluminium 70 000, Gusseisen mit Lamellengraphit 100 000 (streut stark). Das Hookesche Gesetz σ = E · ε gilt nur im elastischen Bereich (unterhalb der Streckgrenze). Stimmen die Werte? */
  /* PRUEFEN P9: Werkstoffkennwerte (Übungswerte, Streckgrenze Re bzw. Dehngrenze Rp0,2 und Zugfestigkeit Rm in N/mm²): S235JR 235 / 360, S355J2 355 / 510, C45 vergütet 490 / 700 (grob), Aluminium EN AW-6082 T6 250 / 290, Gusseisen EN-GJL-200 nur Rm 200 (spröde, keine Streckgrenze). Stimmen die Zahlen mit eurem Tabellenbuch? */
  const MAT = [
    { id: 's235', n: 'S235JR (Baustahl)', E: 210000, Re: 235, Rm: 360, zaeh: true },
    { id: 's355', n: 'S355J2 (Baustahl)', E: 210000, Re: 355, Rm: 510, zaeh: true },
    { id: 'c45', n: 'C45 vergütet', E: 210000, Re: 490, Rm: 700, zaeh: true },
    { id: 'alu', n: 'Aluminium EN AW-6082 T6', E: 70000, Re: 250, Rm: 290, zaeh: true },
    { id: 'gj', n: 'Gusseisen EN-GJL-200', E: 100000, Re: NAN, Rm: 200, zaeh: false }
  ];
  const matOf = id => MAT.find(m => m.id === id) || null;
  const areaCirc = d => (num(d) >= 0 ? Math.PI * d * d / 4 : NAN);
  const areaRect = (b, h) => (num(b) >= 0 && num(h) >= 0 ? b * h : NAN);
  const areaRing = (D, d) => (num(D) >= 0 && num(d) >= 0 && D >= d ? Math.PI * (D * D - d * d) / 4 : NAN);
  const diaOfArea = A => (num(A) >= 0 ? Math.sqrt(4 * A / Math.PI) : NAN);
  const sigma = (F, A) => (num(F) >= 0 && num(A) > 0 ? F / A : NAN);
  const strain = (dL, L) => (num(dL) >= 0 && num(L) > 0 ? dL / L : NAN);
  const strainOf = (sg, E) => (num(sg) >= 0 && num(E) > 0 ? sg / E : NAN);
  const dLen = (F, L, E, A) => (num(F) >= 0 && num(L) >= 0 && num(E) > 0 && num(A) > 0 ? F * L / (E * A) : NAN);

  /* ============================================================ Flächenpressung und Abscheren */
  /* PRUEFEN P10: Flächenpressung im Bolzen-Loch-Kontakt: p = F / (d · t) mit der projizierten Fläche d · t (Bolzendurchmesser mal tragende Blechdicke), vereinfacht gleichmäßig verteilt. Zulässige Pressungen stehen in den Aufgaben nur im Text, nicht als Tabelle. Reicht das? */
  const pressure = (F, d, t) => (num(F) >= 0 && num(d) > 0 && num(t) > 0 ? F / (d * t) : NAN);
  /* PRUEFEN P11: Abscherspannung am Bolzen: τ = F / (n · A) mit n = Zahl der belasteten Scherflächen (einschnittig n = 1, zweischnittig n = 2), A = Bolzenquerschnitt. Abscherfestigkeit τaB ≈ 0,8 · Rm (Faustwert für Stahl). Lochen und Schneiden: F = τaB · Umfang · Blechdicke, bei Rundloch π · d · s. Passt der Faktor 0,8 zu eurem Tabellenbuch? */
  const shearTau = (F, d, n) => (num(F) >= 0 && num(d) > 0 && (n === 1 || n === 2) ? F / (n * areaCirc(d)) : NAN);
  const tauAB = Rm => (num(Rm) > 0 ? 0.8 * Rm : NAN);
  const punchF = (tau, d, s) => (num(tau) > 0 && num(d) > 0 && num(s) > 0 ? tau * Math.PI * d * s : NAN);
  const shearDia = (F, tau, n) => (num(F) >= 0 && num(tau) > 0 && (n === 1 || n === 2) ? Math.sqrt(4 * F / (n * Math.PI * tau)) : NAN);

  /* ============================================================ Biegung und Sicherheit */
  /* PRUEFEN P12: Biegung grob: σb = Mb / W (Normalspannung am Rand), Widerstandsmoment Rechteck W = b · h² / 6 (h in Lastrichtung), Vollkreis W = π · d³ / 32, Kreisring W = π · (D⁴ − d⁴) / (32 · D), Mb in Nmm, W in mm³. Querkraftschub, Durchbiegung und Knicken bleiben außen vor. Ist das für dieses Lab genug? */
  const Wrect = (b, h) => (num(b) > 0 && num(h) > 0 ? b * h * h / 6 : NAN);
  const Wcirc = d => (num(d) > 0 ? Math.PI * d * d * d / 32 : NAN);
  const Wring = (D, d) => (num(D) > 0 && num(d) >= 0 && d < D ? Math.PI * (Math.pow(D, 4) - Math.pow(d, 4)) / (32 * D) : NAN);
  const Irect = (b, h) => (num(b) > 0 && num(h) > 0 ? b * h * h * h / 12 : NAN);
  const sigmaB = (Mb, W) => (num(Mb) >= 0 && num(W) > 0 ? Mb / W : NAN);
  /* PRUEFEN P13: Sicherheitsfaktor S = Grenzspannung / vorhandene Spannung: bei zähen Werkstoffen die Streckgrenze Re, bei spröden die Zugfestigkeit Rm. Übungswerte für die geforderte Sicherheit: 1,5 bei ruhender Last mit gut bekannten Kräften, 2 bei wechselnder, 3 bei stoßartiger Last. Dauerfestigkeit bleibt bewusst ausgespart. Passen diese Richtwerte? */
  const safety = (lim, sg) => (num(lim) > 0 && num(sg) > 0 ? lim / sg : NAN);
  const sigZul = (lim, S) => (num(lim) > 0 && num(S) > 0 ? lim / S : NAN);
  const limOf = m => (m ? (m.zaeh ? m.Re : m.Rm) : NAN);
  const S_REQ = { ruhig: 1.5, wechselnd: 2, stoss: 3 };

  /* ============================================================ Arbeit, Leistung, Wirkungsgrad */
  /* PRUEFEN P14: Arbeit W = F · s in J (1 J = 1 Nm), Hubarbeit W = m · g · h, Leistung P = W / t = F · v, bei Drehbewegung P = M · 2π · n (hier n in 1/min: P = M · 2π · n / 60). Wirkungsgrad η = P_ab / P_zu, hintereinander geschaltete Stufen multiplizieren sich. Stimmt die Darstellung, und genügt Hubarbeit ohne Reibung? */
  const work = (F, s) => (num(F) >= 0 && num(s) >= 0 ? F * s : NAN);
  const workLift = (m, h) => (num(m) >= 0 && num(h) >= 0 ? m * G * h : NAN);
  const powerW = (W, t) => (num(W) >= 0 && num(t) > 0 ? W / t : NAN);
  const powerFv = (F, v) => (num(F) >= 0 && num(v) >= 0 ? F * v : NAN);
  const powerRot = (M, n) => (num(M) >= 0 && num(n) >= 0 ? M * 2 * Math.PI * n / 60 : NAN);
  const eta = (Pab, Pzu) => (num(Pab) >= 0 && num(Pzu) > 0 ? Pab / Pzu : NAN);
  const etaChain = arr => arr.reduce((p, e) => p * e, 1);

  const api = {
    fin, rd, num, parseDe, fmtDe, fmtN, hashStr, rng, ri, pick, shuffle, RAD,
    G, weight, comp, resultant, resMag, decomposeXY, decomp2, ropes,
    moment, leverF2, leverL2, momentSum,
    beamOk, loadForce, loadArm, totalLoad, reactions, shear, bending, mmax, diagram, mbSingle,
    rectPart, centroid, triCentroidH,
    MU, muOf, fricMax, incFH, incFN, critAngle, holds, rampUp, rampHold,
    MAT, matOf, areaCirc, areaRect, areaRing, diaOfArea, sigma, strain, strainOf, dLen,
    pressure, shearTau, tauAB, punchF, shearDia,
    Wrect, Wcirc, Wring, Irect, sigmaB, safety, sigZul, limOf, S_REQ,
    work, workLift, powerW, powerFv, powerRot, eta, etaChain
  };
  root.MCH_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
