'use strict';
/* Tonfunk Marketing-Lab: reine Rechenlogik (Kennung 'mkt'). window.MKT_CORE bzw. module.exports.
   Industriekaufleute, LF 9 "Marketingaktivitäten planen und durchführen" (2. Lehrjahr).
   ALLE Zahlen sind ÜBUNGSWERTE im frei erfundenen Modellbetrieb (Elektronik für Haus und Garten), keine echten Geschäftszahlen.
   Nicht hier (siehe kallab): Kalkulation mit Zuschlägen.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch (wie prdcore.js) ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|%|kontakte|aufträge|klicks)$/i, '');
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

  /* ---------- Zufall (seed-fähig, wie prdcore.js) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Marktforschung ---------- */
  const pct = (a, b) => (num(a) >= 0 && num(b) > 0 ? a / b * 100 : NAN);
  const marktAnteil = (eigen, volumen) => pct(eigen, volumen);
  const saettigung = (volumen, potenzial) => pct(volumen, potenzial);
  /* relativer Marktanteil = eigener Umsatz (oder Anteil) / Umsatz (Anteil) des größten Mitbewerbers, als Faktor */
  const relAnteil = (eigen, groesster) => (num(eigen) >= 0 && num(groesster) > 0 ? eigen / groesster : NAN);
  const wachstum = (alt, neu) => (num(alt) > 0 && num(neu) >= 0 ? (neu - alt) / alt * 100 : NAN);

  /* ---------- Produktlebenszyklus (Modellkurve, t von 0 bis 100) ---------- */
  const PLZ = [
    { k: 'ein', n: 'Einführung', von: 0, bis: 15, d: 'Umsatz wächst langsam, hohe Kosten für Werbung, meist Verlust.', m: 'Bekannt machen: viel Werbung, Einführungspreis.' },
    { k: 'wachs', n: 'Wachstum', von: 15, bis: 40, d: 'Umsatz steigt schnell, die Gewinnzone wird erreicht, Mitbewerber kommen dazu.', m: 'Vertrieb ausbauen, Marke stärken.' },
    { k: 'reife', n: 'Reife', von: 40, bis: 65, d: 'Umsatz wächst kaum noch, Gewinn am höchsten, starker Wettbewerb.', m: 'Kunden halten, Produkt pflegen, Preis anpassen.' },
    { k: 'saett', n: 'Sättigung', von: 65, bis: 82, d: 'Umsatz sinkt leicht, der Markt ist versorgt, Druck auf den Preis.', m: 'Relaunch oder Nachfolger vorbereiten.' },
    { k: 'rueck', n: 'Rückgang', von: 82, bis: 100, d: 'Umsatz und Gewinn sinken deutlich.', m: 'Kosten senken, Produkt vom Markt nehmen.' }
  ];
  /* Umsatz in % vom Höchstwert (glatte Glockenkurve); Gewinn: anfangs negativ, Höchstwert vor dem Umsatz-Höchstwert */
  const plzUmsatz = t => (num(t) >= 0 && t <= 100 ? 100 * Math.exp(-Math.pow((t - 55) / 24, 2)) : NAN);
  const plzGewinn = t => (num(t) >= 0 && t <= 100 ? 52 * Math.exp(-Math.pow((t - 45) / 20, 2)) - 22 * Math.exp(-t / 10) - 4 : NAN);
  const plzPhase = t => (num(t) >= 0 && t <= 100 ? PLZ.findIndex(p => t < p.bis || p.bis === 100) : -1);

  /* ---------- BCG-Matrix ---------- */
  /* PRUEFEN M1: Grenzen der Felder: relativer Marktanteil 1 (größer als 1 = Marktführer), Marktwachstum 10 % im Jahr. Lehrbuchwerte, manche Bücher setzen beim Wachstum eine andere Grenze. */
  const BCG = [
    { k: 'star', n: 'Star', d: 'Hoher relativer Marktanteil im wachsenden Markt. Braucht Geld für das Wachstum, bringt aber viel.', m: 'Fördern, investieren.' },
    { k: 'cash', n: 'Cash Cow', d: 'Hoher relativer Marktanteil im kaum wachsenden Markt. Bringt viel Geld und braucht wenig.', m: 'Halten, Geld abschöpfen.' },
    { k: 'frage', n: 'Question Mark', d: 'Kleiner relativer Marktanteil im wachsenden Markt. Die Zukunft ist offen, es wird viel Geld gebraucht.', m: 'Gezielt fördern oder aufgeben.' },
    { k: 'dog', n: 'Poor Dog', d: 'Kleiner relativer Marktanteil im kaum wachsenden Markt.', m: 'Eher aufgeben (abschöpfen oder vom Markt nehmen).' }
  ];
  const bcgFeld = (rel, w) => (num(rel) >= 0 && fin(w) ? (rel > 1 ? (w > 10 ? 0 : 1) : (w > 10 ? 2 : 3)) : -1);

  /* ---------- Preispolitik ---------- */
  const dbStueck = (p, kv) => (num(p) >= 0 && num(kv) >= 0 ? p - kv : NAN);
  const dbGesamt = (p, kv, x) => (num(x) >= 0 ? dbStueck(p, kv) * x : NAN);
  const ergebnis = (p, kv, x, kf) => (num(kf) >= 0 ? dbGesamt(p, kv, x) - kf : NAN);
  const pugKurz = kv => (num(kv) >= 0 ? kv : NAN);
  const pugLang = (kv, kf, x) => (num(kv) >= 0 && num(kf) >= 0 && num(x) > 0 ? kv + kf / x : NAN);
  const breakEven = (kf, p, kv) => (num(kf) >= 0 && num(p) >= 0 && num(kv) >= 0 && p > kv ? ceilN(kf / (p - kv)) : NAN);
  /* Preis-Absatz-Funktion (linear, einfach): Absatz x = a − b · p, nicht unter 0 */
  const absatz = (a, b, p) => (num(a) >= 0 && num(b) >= 0 && num(p) >= 0 ? Math.max(0, a - b * p) : NAN);

  /* ---------- Kommunikation und Werbeerfolg ---------- */
  const AIDA = [
    { k: 'A', n: 'Attention', de: 'Aufmerksamkeit', d: 'Der Kunde wird auf das Angebot aufmerksam.' },
    { k: 'I', n: 'Interest', de: 'Interesse', d: 'Der Kunde will mehr wissen.' },
    { k: 'D', n: 'Desire', de: 'Wunsch', d: 'Der Kunde möchte das Produkt haben.' },
    { k: 'A', n: 'Action', de: 'Handlung', d: 'Der Kunde kauft oder fragt an.' }
  ];
  const jeKontakt = (kosten, kontakte) => (num(kosten) >= 0 && num(kontakte) > 0 ? kosten / kontakte : NAN);
  const tkp = (kosten, kontakte) => (num(kosten) >= 0 && num(kontakte) > 0 ? kosten / kontakte * 1000 : NAN);
  /* PRUEFEN M2: Werberendite = Umsatzzuwachs / Werbekosten · 100 (ökonomischer Werbeerfolg). Manche Bücher ziehen die Werbekosten vorher ab oder rechnen mit dem Gewinnzuwachs. */
  const werberendite = (zuwachs, kosten) => (fin(zuwachs) && num(kosten) > 0 ? zuwachs / kosten * 100 : NAN);
  /* Reisender gegen Handelsvertreter: Kosten = Fixum + Provision in % vom Umsatz. Kritischer Umsatz: beide gleich teuer. */
  const vertriebsKosten = (fix, prov, u) => (num(fix) >= 0 && num(prov) >= 0 && num(u) >= 0 ? fix + prov / 100 * u : NAN);
  const kritUmsatz = (fixR, provR, fixH, provH) => (num(fixR) >= 0 && num(provR) >= 0 && num(fixH) >= 0 && num(provH) >= 0 && provH > provR ? (fixR - fixH) / ((provH - provR) / 100) : NAN);
  /* Budget-Planer je Kanal: Budget €, Kosten je 1.000 Kontakte (TKP) €, Reaktionsrate % (Klick, Anruf, Besuch je Kontakt), Konversionsrate % (Auftrag je Reaktion), Ø Auftragswert € */
  function kanal(budget, tkpW, rate, konv, wert) {
    if (!(num(budget) >= 0 && num(tkpW) > 0 && num(rate) >= 0 && num(konv) >= 0 && num(wert) >= 0)) return null;
    const kontakte = budget / tkpW * 1000, reakt = kontakte * rate / 100, auftr = reakt * konv / 100, umsatz = auftr * wert;
    return { kontakte, reakt, auftr, umsatz, jeKontakt: kontakte > 0 ? budget / kontakte : NAN, jeAuftrag: auftr > 0 ? budget / auftr : NAN, rendite: budget > 0 ? umsatz / budget * 100 : NAN };
  }

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    marktAnteil, saettigung, relAnteil, wachstum,
    PLZ, plzUmsatz, plzGewinn, plzPhase, BCG, bcgFeld,
    dbStueck, dbGesamt, ergebnis, pugKurz, pugLang, breakEven, absatz,
    AIDA, jeKontakt, tkp, werberendite, vertriebsKosten, kritUmsatz, kanal };
  root.MKT_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
