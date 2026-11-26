'use strict';
/* Tonfunk Produktions-Lab: reine Rechenlogik (Kennung 'prd'). window.PRD_CORE bzw. module.exports.
   Industriekaufleute, LF 6 "Leistungserstellung planen, steuern und kontrollieren" (2. Lehrjahr).
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronikfertigung), keine echten Geschäftszahlen.
   Nicht hier (siehe kallab): Kalkulation mit Zuschlägen. Nicht hier (siehe laglab): Meldebestand, optimale Bestellmenge.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch (wie wflcore.js) ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|%|min|h|std|tage|tag|lose|kanban)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NAN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '-';
    dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = i.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtN(v, dec, group) {
    if (!fin(v)) return '-'; dec = dec == null ? 2 : dec;
    let s = fmtDe(rd(v, dec), dec, group);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }

  /* ---------- Zufall (seed-fähig, wie wflcore.js) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Kapazität und Auslastung */
  /* Kapazität (Kapazitätsangebot) in Stunden: Maschinen · Arbeitstage · Stunden je Tag */
  const kapAngebot = (m, tage, hTag) => (num(m) >= 0 && num(tage) >= 0 && num(hTag) >= 0 ? m * tage * hTag : NAN);
  /* Kapazitätsbedarf in Stunden: Rüstzeit (h) + Menge · Stückzeit (min) / 60 */
  const kapBedarf = (menge, teMin, trH) => (num(menge) >= 0 && num(teMin) >= 0 && num(trH) >= 0 ? trH + menge * teMin / 60 : NAN);
  /* Beschäftigungsgrad (Auslastung) in Prozent: genutzte (benötigte) Kapazität / vorhandene Kapazität · 100 */
  const beschGrad = (ist, kap) => (num(ist) >= 0 && num(kap) > 0 ? ist / kap * 100 : NAN);
  /* Engpass: die Stelle mit dem höchsten Beschäftigungsgrad. rows: [{n, bedarf, angebot}] */
  function engpass(rows) {
    if (!Array.isArray(rows) || !rows.length) return null;
    let best = null;
    for (const r of rows) { const g = beschGrad(r.bedarf, r.angebot); if (!fin(g)) return null; if (!best || g > best.grad) best = { n: r.n, grad: g }; }
    return best;
  }

  /* ============================================================ Losgröße */
  /* B = Jahresbedarf (Stück), R = Rüstkosten je Los (€), p = Herstellkosten je Stück (€), z = Lagerhaltungskostensatz (% im Jahr), x = Losgröße (Stück).
     Durchschnittlicher Lagerbestand = x / 2 (gleichmäßiger Verbrauch, kein Sicherheitsbestand). */
  /* PRUEFEN P1: Andler-Formel x_opt = Wurzel(200 · B · R / (p · z)) mit Lagerkosten auf Basis der Herstellkosten je Stück und durchschnittlichem Lagerbestand x/2 (ohne Sicherheitsbestand, ohne Fertigungsgeschwindigkeit). So im Unterricht? */
  const ok4 = (B, R, p, z) => num(B) > 0 && num(R) >= 0 && num(p) > 0 && num(z) > 0;
  const ruestJahr = (B, R, x) => (num(B) >= 0 && num(R) >= 0 && num(x) > 0 ? B / x * R : NAN);
  const lagerJahr = (x, p, z) => (num(x) >= 0 && num(p) >= 0 && num(z) >= 0 ? x / 2 * p * z / 100 : NAN);
  function losKosten(B, R, p, z, x) {
    if (!ok4(B, R, p, z) || !(num(x) > 0)) return null;
    const r = ruestJahr(B, R, x), l = lagerJahr(x, p, z);
    return { lose: B / x, ruest: r, lager: l, ges: r + l };
  }
  const andler = (B, R, p, z) => (ok4(B, R, p, z) ? Math.sqrt(200 * B * R / (p * z)) : NAN);

  /* ============================================================ Durchlaufzeit und Terminplanung */
  /* Auftragszeit eines Arbeitsgangs in Stunden: Rüstzeit (h) + Menge · Stückzeit (min) / 60 (wie Kapazitätsbedarf) */
  const auftragsZeit = kapBedarf;
  /* Arbeitsgang: {n, tr (h Rüsten), te (min je Stück), ue (h Übergangszeit VOR dem Arbeitsgang: Liegen und Transport)} */
  /* PRUEFEN P2: Übergangszeit (Liege- und Transportzeit) steht im Lab VOR jedem Arbeitsgang; Zeiten in Arbeitsstunden ab Auftragsbeginn, ohne Kalender, Schichten und Überlappung. Reicht das Modell für das 2. Lehrjahr? */
  const okOp = o => o && num(o.tr) >= 0 && num(o.te) >= 0 && num(o.ue) >= 0;
  function durchlauf(ops, menge) {
    if (!Array.isArray(ops) || !ops.length || !ops.every(okOp) || !(num(menge) >= 0)) return null;
    let ruest = 0, bearb = 0, ue = 0;
    ops.forEach(o => { ruest += o.tr; bearb += menge * o.te / 60; ue += o.ue; });
    return { ruest, bearb, ue, dlz: ruest + bearb + ue, anteilUe: ruest + bearb + ue > 0 ? ue / (ruest + bearb + ue) * 100 : NAN };
  }
  /* Vorwärtsterminierung: ab Starttermin s (h) frühestmögliche Anfangs- und Endtermine */
  function vorwaerts(ops, menge, s) {
    if (!durchlauf(ops, menge) || !(num(s) >= 0)) return null;
    let t = s; const out = [];
    ops.forEach(o => { const a0 = t; t += o.ue; const b = t; t += auftragsZeit(menge, o.te, o.tr); out.push({ n: o.n, ueStart: a0, start: b, ende: t }); });
    return { ops: out, ende: t };
  }
  /* Rückwärtsterminierung: vom Liefertermin T (h) zurück, spätestmögliche Termine */
  function rueckwaerts(ops, menge, T) {
    if (!durchlauf(ops, menge) || !(num(T) >= 0)) return null;
    let t = T; const out = [];
    for (let i = ops.length - 1; i >= 0; i--) { const o = ops[i], e = t; t -= auftragsZeit(menge, o.te, o.tr); const b = t; t -= o.ue; out.unshift({ n: o.n, ueStart: t, start: b, ende: e }); }
    return { ops: out, start: t };
  }
  /* Puffer (Zeitreserve) = Liefertermin − frühestes Ende; negativ = Termin nicht zu halten */
  const puffer = (T, ende) => (num(T) >= 0 && num(ende) >= 0 ? T - ende : NAN);

  /* ============================================================ Kennzahlen */
  const produktivitaet = (aus, ein) => (num(aus) >= 0 && num(ein) > 0 ? aus / ein : NAN);
  const wirtschaftlichkeit = (ertrag, kosten) => (num(ertrag) >= 0 && num(kosten) > 0 ? ertrag / kosten : NAN);
  /* PRUEFEN P3: Rentabilität nur als Eigenkapitalrentabilität (Gewinn / Eigenkapital · 100) und Umsatzrentabilität (Gewinn / Umsatz · 100), ohne Gesamtkapitalrentabilität mit Fremdkapitalzinsen. Genügt das für LF 6? */
  const ekRent = (gewinn, ek) => (fin(num(gewinn)) && num(ek) > 0 ? gewinn / ek * 100 : NAN);
  const umsRent = (gewinn, ums) => (fin(num(gewinn)) && num(ums) > 0 ? gewinn / ums * 100 : NAN);

  /* ============================================================ Bedarfsermittlung (Stückliste) */
  /* PRUEFEN P4: Nettobedarf = Bruttobedarf − Lagerbestand + Sicherheitsbestand − offene Bestellungen (Bestellbestand), nicht kleiner als 0; Vormerkbestand (reservierte Menge) wird nicht verwendet. Ist das die Fassung aus eurem Unterricht? */
  const netto = (br, lager, sich, offen) => ([br, lager, sich, offen].every(v => num(v) >= 0) ? Math.max(0, br - lager + sich - offen) : NAN);

  /* ============================================================ Qualität und Lean */
  const ausschussQuote = (aus, ges) => (num(aus) >= 0 && num(ges) > 0 && aus <= ges ? aus / ges * 100 : NAN);
  /* Startmenge, damit nach Ausschuss (q in %) die Gutmenge übrig bleibt: Gutmenge / (1 − q/100), aufgerundet */
  const startMenge = (gut, q) => (num(gut) >= 0 && num(q) >= 0 && q < 100 ? ceilN(gut / (1 - q / 100)) : NAN);
  /* PRUEFEN P5: Kanban-Anzahl = Verbrauch je Tag · Wiederbeschaffungszeit (Tage) · (1 + Sicherheitszuschlag) / Menge je Behälter, aufgerundet. Diese Lehrbuchformel ist vereinfacht. So stehen lassen? */
  const kanbanAnzahl = (vTag, wbz, sich, jeBeh) => (num(vTag) >= 0 && num(wbz) >= 0 && num(sich) >= 0 && num(jeBeh) > 0 ? ceilN(vTag * wbz * (1 + sich / 100) / jeBeh) : NAN);
  const PDCA = [{ k: 'P', n: 'Plan (planen)', d: 'Problem beschreiben, Ursache suchen, Ziel und Maßnahme festlegen' }, { k: 'D', n: 'Do (ausführen)', d: 'Maßnahme im Kleinen ausprobieren' }, { k: 'C', n: 'Check (prüfen)', d: 'Ergebnis messen und mit dem Ziel vergleichen' }, { k: 'A', n: 'Act (handeln)', d: 'Bewährtes als Standard einführen oder neu planen' }];

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    kapAngebot, kapBedarf, beschGrad, engpass,
    ruestJahr, lagerJahr, losKosten, andler,
    auftragsZeit, durchlauf, vorwaerts, rueckwaerts, puffer,
    produktivitaet, wirtschaftlichkeit, ekRent, umsRent, netto,
    ausschussQuote, startMenge, kanbanAnzahl, PDCA };
  root.PRD_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
