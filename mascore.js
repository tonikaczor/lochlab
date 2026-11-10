'use strict';
/* Tonfunk Maschinenelemente-Lab: reine Rechenlogik (Kennung 'mas'). window.MAS_CORE bzw. module.exports.
   Alle Wirkungsgrade, Werkstoffwerte und Zuordnungen sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auslegung echter Antriebe.
   Maßgebend sind Herstellerkataloge, Normen und die Vorgaben des Betriebs.
   Konventionen: Länge in mm, Drehzahl in 1/min, Drehmoment in Nm, Leistung in kW (Moment und Drehzahl: P = M · n / 9550), Kraft in N, Federrate in N/mm.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const pos = v => (num(v) > 0 ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm²|mm2|m\/s|1\/min|n\/mm|nm|kw|mm|°|rpm|min|kn|n|v|a|w|k|m|%)$/i, '');
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

  /* ============================================================ Zahnräder */
  /* PRUEFEN P1: Maße am Stirnrad ohne Profilverschiebung: Teilkreis d = m · z, Kopfkreis da = d + 2m, Fußkreis df = d − 2,5m (Kopfhöhe m, Fußhöhe 1,25 m), Zahnhöhe h = 2,25 m, Teilung p = π · m, Achsabstand a = m · (z1 + z2) / 2. Stimmen die Faktoren (1,25 m Fußhöhe) mit eurem Tabellenbuch überein? */
  const gD = (m, z) => (pos(m) && pos(z) ? m * z : NAN);
  const gDa = (m, z) => (pos(m) && pos(z) ? m * z + 2 * m : NAN);
  const gDf = (m, z) => (pos(m) && pos(z) ? m * z - 2.5 * m : NAN);
  const gP = m => (pos(m) ? Math.PI * m : NAN);
  const gH = m => (pos(m) ? 2.25 * m : NAN);
  const axis = (m, z1, z2) => (pos(m) && pos(z1) && pos(z2) ? m * (z1 + z2) / 2 : NAN);
  /* Zähnezahl-Summe aus Soll-Achsabstand: z1 + z2 = 2a / m */
  const zSum = (a, m) => (pos(a) && pos(m) ? 2 * a / m : NAN);
  /* Übersetzung i = Antriebsdrehzahl / Abtriebsdrehzahl = z2 / z1 (Rad 1 treibt, Rad 2 wird getrieben); i > 1: ins Langsame */
  const ratio = (z1, z2) => (pos(z1) && pos(z2) ? z2 / z1 : NAN);
  const trainRatio = st => { let r = 1; for (const s of st) { const x = ratio(s[0], s[1]); if (!fin(x)) return NAN; r *= x; } return st.length ? r : NAN; };
  const nOut = (n, i) => (num(n) >= 0 && pos(i) ? n / i : NAN);
  /* PRUEFEN P2: Wirkungsgrad einer Stirnradstufe im Übungsmodell 0,97 (Katalogwerte liegen je nach Ausführung bei etwa 0,95 bis 0,99; Schnecken deutlich niedriger). */
  const ETA_STAGE = 0.97;
  const etaTot = (eta, k) => (num(eta) > 0 && eta <= 1 && num(k) >= 0 ? Math.pow(eta, k) : NAN);
  const mOut = (M, i, eta) => (num(M) >= 0 && pos(i) && num(eta) > 0 && eta <= 1 ? M * i * eta : NAN);
  /* Leistung aus Moment und Drehzahl: P in kW = M in Nm · n in 1/min / 9550 (aus P = M · ω mit ω = 2π · n / 60, gerundet) */
  const power = (M, n) => (num(M) >= 0 && num(n) >= 0 ? M * n / 9550 : NAN);
  const torque = (P, n) => (num(P) >= 0 && pos(n) ? 9550 * P / n : NAN);
  /* Drehrichtung: jede Zahnradpaarung (außenverzahnt) kehrt die Drehrichtung um; k Eingriffe: gerade Zahl gleich, ungerade entgegengesetzt */
  const dirSame = k => (Number.isInteger(k) && k >= 0 ? k % 2 === 0 : null);

  /* ============================================================ Riemen und Ketten */
  /* PRUEFEN P3: Riemengeschwindigkeit v = π · d · n / 60 (d in m). Übersetzung ohne Schlupf i = d2 / d1; beim Keilriemen kommt ein kleiner Schlupf hinzu (im Lab nur qualitativ, kein Zahlenwert). Länge als Näherung L = 2a + π/2 (d1 + d2) + (d2 − d1)² / (4a). */
  const beltV = (d, n) => (pos(d) && num(n) >= 0 ? Math.PI * d / 1000 * n / 60 : NAN);
  const beltLen = (d1, d2, a) => (pos(d1) && pos(d2) && pos(a) && Math.abs(d2 - d1) < 2 * a ? 2 * a + Math.PI / 2 * (d1 + d2) + (d2 - d1) * (d2 - d1) / (4 * a) : NAN);
  /* Umschlingungswinkel der kleinen Scheibe: β = 180° − 2 · asin(|d2 − d1| / (2a)) in Grad */
  const wrap = (d1, d2, a) => { if (!(pos(d1) && pos(d2) && pos(a))) return NAN; const dd = Math.abs(d2 - d1); if (dd >= 2 * a) return NAN; return 180 - 2 * Math.asin(dd / (2 * a)) * 180 / Math.PI; };
  /* PRUEFEN P4: Kettenglieder X = 2a/p + (z1 + z2)/2 + ((z2 − z1) / 2π)² · p / a; man rundet auf eine gerade Zahl auf (gerade Gliederzahl vermeidet ein Kropfglied). */
  const chainX = (z1, z2, p, a) => (pos(z1) && pos(z2) && pos(p) && pos(a) ? 2 * a / p + (z1 + z2) / 2 + Math.pow((z2 - z1) / (2 * Math.PI), 2) * p / a : NAN);
  const chainXEven = X => (fin(X) ? 2 * Math.ceil(X / 2 - 1e-9) : NAN);
  const chainR = (z, p) => (pos(z) && z >= 3 && pos(p) ? p / (2 * Math.sin(Math.PI / z)) : NAN);
  const chainV = (z, p, n) => (pos(z) && pos(p) && num(n) >= 0 ? z * p * n / 60000 : NAN);

  /* ============================================================ Wellen */
  /* PRUEFEN P5: Torsion einer Vollwelle: polares Widerstandsmoment Wp = π · d³ / 16, Schubspannung τ = M / Wp. Zulässige Spannung im Lab nur als gegebene Übungszahl. */
  const wp = d => (pos(d) ? Math.PI * d * d * d / 16 : NAN);
  const tau = (M, d) => (num(M) >= 0 && pos(d) ? M * 1000 / wp(d) : NAN);
  const dMin = (M, tz) => (num(M) >= 0 && pos(tz) ? Math.cbrt(16 * M * 1000 / (Math.PI * tz)) : NAN);
  /* PRUEFEN P6: Wärmedehnung ΔL = α · L · ΔT mit α = 12 · 10⁻⁶ 1/K für Stahl (Übungswert; Tabellenwerte liegen bei etwa 11 bis 12). */
  const ALPHA = 12e-6;
  const dLen = (L, dT, al) => (pos(L) && num(dT) >= 0 ? (al == null ? ALPHA : al) * L * dT : NAN);

  /* ============================================================ Wälzlager */
  /* PRUEFEN P7: Kurzzeichen (grob): Ziffer(n) vorn für die Bauform (6 Rillenkugellager, 7 Schrägkugellager, NU Zylinderrollenlager, 3 Kegelrollenlager, 5 Axial-Rillenkugellager, 22 Pendelrollenlager), die zwei letzten Ziffern geben die Bohrung: 00 = 10 mm, 01 = 12, 02 = 15, 03 = 17, ab 04 mal 5 (bis 96). Die Ziffer der Reihe (0 bis 4) steht für extraleicht bis schwer. Bei Kurzzeichen mit Schrägstrich (Bohrung ab 500 mm oder Sondermaße) gilt die Regel nicht. Gilt das so bei euren Katalogen? */
  const BORE = c => (Number.isInteger(c) && c >= 0 && c <= 3 ? [10, 12, 15, 17][c] : Number.isInteger(c) && c >= 4 && c <= 96 ? c * 5 : NAN);
  const SERIES = { 0: 'extraleicht', 1: 'extraleicht', 2: 'leicht', 3: 'mittel', 4: 'schwer' };
  /* PRUEFEN P8: Eigenschaften der Bauformen (qualitativ, in eigenen Worten): Rillenkugellager radial und beidseitig axial mäßig belastbar; Zylinderrollenlager NU radial sehr hoch, aber ohne axiale Führung (Loslager); Kegelrollenlager und Schrägkugellager nehmen Axialkraft in nur einer Richtung auf und werden paarweise angestellt; Axial-Rillenkugellager nur axial; Pendelrollenlager radial sehr hoch, axial mäßig und gleichen Fluchtungsfehler aus. */
  const BEAR = {
    rill: { n: 'Rillenkugellager', ball: true, rad: 'gut', ax: 'mäßig, in beide Richtungen', use: 'Universallager für hohe Drehzahlen; als Fest- oder Loslager', pic: 'ball' },
    schraeg: { n: 'Schrägkugellager', ball: true, rad: 'gut', ax: 'gut, aber nur in eine Richtung', use: 'paarweise angestellt, wenn Radial- und Axialkräfte zugleich wirken', pic: 'schraeg' },
    zyl: { n: 'Zylinderrollenlager', ball: false, rad: 'sehr hoch', ax: 'keine (Bauform NU)', use: 'Loslager, das Längenänderungen der Welle zulässt', pic: 'zyl' },
    kegel: { n: 'Kegelrollenlager', ball: false, rad: 'sehr hoch', ax: 'hoch, nur in eine Richtung', use: 'immer paarweise gegeneinander angestellt (z. B. Radlager, Getriebewellen)', pic: 'kegel' },
    axial: { n: 'Axial-Rillenkugellager', ball: true, rad: 'keine', ax: 'nur Axialkraft in eine Richtung', use: 'nimmt reine Längskräfte auf, nicht für Radialkraft geeignet', pic: 'axial' },
    pendel: { n: 'Pendelrollenlager', ball: false, rad: 'sehr hoch', ax: 'mäßig, in beide Richtungen', use: 'gleicht Fluchtungsfehler und Durchbiegung der Welle aus; bei hohen Lasten', pic: 'pendel' }
  };
  const SUFFIX = { '2RS': 'beidseitig berührende Dichtscheiben (Fettfüllung, nicht nachschmierbar)', '2RS1': 'beidseitig berührende Dichtscheiben (Fettfüllung, nicht nachschmierbar)', '2RSR': 'beidseitig berührende Dichtscheiben (Fettfüllung, nicht nachschmierbar)', RS: 'einseitig eine berührende Dichtscheibe', RSR: 'einseitig eine berührende Dichtscheibe', '2Z': 'beidseitig Deckscheiben (berührungsfrei, Fettfüllung)', Z: 'einseitig eine Deckscheibe', C3: 'Radialspiel größer als normal (für Wärmedehnung, Presssitz)', C2: 'Radialspiel kleiner als normal', C4: 'Radialspiel noch größer als C3' };
  function parseBearing(s) {
    s = String(s == null ? '' : s).toUpperCase().replace(/[\s_]+/g, '');
    if (!s) return { ok: false, err: 'Bitte ein Kurzzeichen eingeben, z. B. 6205-2RS oder NU208.' };
    const m = /^(NUP|NU|NJ|N)?(\d{3,5})(.*)$/.exec(s);
    if (!m) return { ok: false, err: 'Das Kurzzeichen beginnt weder mit Ziffern noch mit NU, NJ oder N.' };
    const pre = m[1] || '', dg = m[2], rest = m[3].replace(/^[-\/]+/, '');
    let type = null, rank = NAN;
    if (pre) { if (dg.length !== 3 && dg.length !== 4) return { ok: false, err: 'Bei NU und NJ erwarte ich drei oder vier Ziffern, z. B. NU208.' }; type = 'zyl'; rank = +dg[0]; }
    else if (dg.length === 4) { const f = dg[0]; type = f === '6' ? 'rill' : f === '7' ? 'schraeg' : null; rank = +dg[1]; if (!type) return { ok: false, err: 'Vierstellige Kurzzeichen kenne ich hier nur mit 6 (Rillenkugellager) oder 7 (Schrägkugellager).' }; }
    else if (dg.length === 5) { const f = dg[0]; type = f === '3' ? 'kegel' : f === '5' ? 'axial' : f === '2' ? 'pendel' : null; rank = +dg[2]; if (!type) return { ok: false, err: 'Fünfstellige Kurzzeichen kenne ich hier nur mit 3 (Kegelrollenlager), 5 (Axiallager) oder 2 (Pendelrollenlager).' }; }
    else return { ok: false, err: 'Dreistellige Kurzzeichen ohne NU kenne ich hier nicht.' };
    const d = BORE(+dg.slice(-2));
    if (!fin(d)) return { ok: false, err: 'Die Bohrungskennzahl (letzte zwei Ziffern) liegt außerhalb von 00 bis 96.' };
    rank = Math.max(0, Math.min(4, rank));
    const suf = [], rawSuf = rest ? rest.split(/[-\/]+/).filter(Boolean) : [], unk = [];
    rawSuf.forEach(t => { if (SUFFIX[t]) suf.push([t, SUFFIX[t]]); else unk.push(t); });
    return { ok: true, type, name: BEAR[type].n + (pre === 'NU' ? ' (Bauform NU)' : pre === 'NJ' ? ' (Bauform NJ)' : ''), pre, d, rank, series: SERIES[rank] || '', suffix: suf, unknown: unk, info: BEAR[type] };
  }
  /* PRUEFEN P9: Nominelle Lebensdauer L10 = (C / P)^p in Millionen Umdrehungen, p = 3 für Kugellager, 10/3 für Rollenlager; in Stunden L10h = 10⁶ · L10 / (60 · n). C dynamische Tragzahl, P äquivalente Last (beides aus dem Katalog). Der Lab-Rechner nutzt nur diese Grundgleichung ohne Korrekturfaktoren. */
  const lifeExp = ball => (ball ? 3 : 10 / 3);
  const L10 = (C, P, ball) => (pos(C) && pos(P) ? Math.pow(C / P, lifeExp(ball)) : NAN);
  const L10h = (C, P, n, ball) => { const l = L10(C, P, ball); return fin(l) && pos(n) ? l * 1e6 / (60 * n) : NAN; };

  /* ============================================================ Federn */
  /* PRUEFEN P10: Federkennlinie F = c · s (Federrate c in N/mm). Reihenschaltung 1/c = Σ 1/ci (jede Feder trägt die volle Kraft, die Wege addieren sich); Parallelschaltung c = Σ ci (die Kräfte addieren sich, der Weg ist gleich). Federarbeit W = ½ · c · s² (in N·mm). Zylindrische Druckfeder: c = G · d⁴ / (8 · D³ · n) mit G = 81 000 N/mm² für Federstahl (Übungswert), d Drahtdurchmesser, D mittlerer Windungsdurchmesser, n federnde Windungen. */
  const SPR_G = 81000;
  const sF = (c, s) => (pos(c) && num(s) >= 0 ? c * s : NAN);
  const sW = (c, s) => (pos(c) && num(s) >= 0 ? 0.5 * c * s * s : NAN);
  const sSer = l => { if (!l.length || l.some(c => !pos(c))) return NAN; return 1 / l.reduce((a, c) => a + 1 / c, 0); };
  const sPar = l => { if (!l.length || l.some(c => !pos(c))) return NAN; return l.reduce((a, c) => a + c, 0); };
  const sGeom = (G, d, D, n) => (pos(G) && pos(d) && pos(D) && pos(n) ? G * Math.pow(d, 4) / (8 * Math.pow(D, 3) * n) : NAN);

  const api = {
    fin, rd, num, parseDe, fmtDe, fmtN, hashStr, rng, ri, pick, shuffle,
    gD, gDa, gDf, gP, gH, axis, zSum, ratio, trainRatio, nOut, ETA_STAGE, etaTot, mOut, power, torque, dirSame,
    beltV, beltLen, wrap, chainX, chainXEven, chainR, chainV,
    wp, tau, dMin, ALPHA, dLen,
    BORE, SERIES, BEAR, SUFFIX, parseBearing, lifeExp, L10, L10h,
    SPR_G, sF, sW, sSer, sPar, sGeom
  };
  root.MAS_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
