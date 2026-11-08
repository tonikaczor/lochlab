'use strict';
/* Tonfunk Lager-Lab: reine Rechenlogik (Kennung 'lag'). window.LAG_CORE bzw. module.exports.
   Konventionen: Zinsjahr = 360 Tage (deutsche kaufmännische Zinsrechnung), Prozentwerte als Zahl (6 = 6 %).
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN, YEAR = 360;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|tage|tagen|%|mal)$/i, '');
    if (/^[+\-−]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');   /* 12.500,50 */
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
  /* Anzeige mit sinnvoller Stellenzahl (ganze Zahl ohne Komma, sonst bis dec Stellen ohne Nullen am Ende) */
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

  /* ---------- Lagerkennzahlen ---------- */
  /* Durchschnittlicher Lagerbestand aus Jahresanfangs- und Jahresendbestand */
  const avg2 = (anfang, ende) => { const a = num(anfang), e = num(ende); return a >= 0 && e >= 0 ? (a + e) / 2 : NAN; };
  /* Mittelwert beliebig vieler Werte */
  function avg(arr) { if (!Array.isArray(arr) || !arr.length) return NAN; let s = 0; for (const x of arr) { if (!(num(x) >= 0)) return NAN; s += x; } return s / arr.length; }
  /* Jahresanfangsbestand + 12 Monatsendbestände = 13 Werte */
  const avg13 = (anfang, monate) => (Array.isArray(monate) && monate.length === 12 ? avg([anfang].concat(monate)) : NAN);
  const turnover = (verbrauch, durchschn) => (num(verbrauch) >= 0 && num(durchschn) > 0 ? verbrauch / durchschn : NAN);
  const storageDays = u => (num(u) > 0 ? YEAR / u : NAN);
  /* Lagerzinssatz in % = Jahreszinssatz · Lagerdauer / 360 */
  const stockRate = (jahreszins, tage) => (num(jahreszins) >= 0 && num(tage) >= 0 ? jahreszins * tage / YEAR : NAN);
  /* Lagerzins in € für einen Warenwert (Basis) über die Lagerdauer: Basis · Zinssatz · Tage / (100 · 360) */
  const storageInterest = (basis, jahreszins, tage) => (num(basis) >= 0 ? basis * stockRate(jahreszins, tage) / 100 : NAN);
  /* Jahreszins auf den durchschnittlichen Lagerbestand (gleiches Ergebnis wie Wareneinsatz · Lagerzinssatz) */
  const interestYear = (durchschn, jahreszins) => (num(durchschn) >= 0 && num(jahreszins) >= 0 ? durchschn * jahreszins / 100 : NAN);
  /* Lagerkostensatz in % = Lagerkosten / Ø Lagerbestand · 100 */
  const costRate = (kosten, durchschn) => (num(kosten) >= 0 && num(durchschn) > 0 ? kosten / durchschn * 100 : NAN);
  /* Lagerhaltungskostensatz in % = (Lagerkosten + Lagerzinsen) / Ø Lagerbestand · 100 */
  const holdingRate = (kosten, zinsen, durchschn) => (num(kosten) >= 0 && num(zinsen) >= 0 ? costRate(kosten + zinsen, durchschn) : NAN);
  /* Alle Kennzahlen auf einmal. o: {mode:'ae'|'m12', ab, eb, months[12], use, rate, costs} */
  function kennzahlen(o) {
    const av = o.mode === 'm12' ? avg13(o.ab, o.months) : avg2(o.ab, o.eb), u = turnover(o.use, av), d = storageDays(u), lz = stockRate(o.rate, d);
    const zins = num(o.use) >= 0 ? o.use * lz / 100 : NAN, kr = costRate(o.costs, av);
    return { avg: av, turnover: u, days: d, stockRate: lz, interest: zins, costRate: kr, holdingRate: holdingRate(o.costs, zins, av) };
  }

  /* ---------- Disposition ---------- */
  const dailyUse = (jahresverbrauch, tage) => (num(jahresverbrauch) >= 0 ? jahresverbrauch / (tage > 0 ? tage : YEAR) : NAN);
  const safetyStock = (tagesverbrauch, sicherheitstage) => (num(tagesverbrauch) >= 0 && num(sicherheitstage) >= 0 ? tagesverbrauch * sicherheitstage : NAN);
  const reorderPoint = (tagesverbrauch, lieferzeit, sicherheit) => (num(tagesverbrauch) >= 0 && num(lieferzeit) >= 0 && num(sicherheit) >= 0 ? tagesverbrauch * lieferzeit + sicherheit : NAN);
  const maxStock = (sicherheit, bestellmenge) => (num(sicherheit) >= 0 && num(bestellmenge) >= 0 ? sicherheit + bestellmenge : NAN);
  const ordersPerYear = (bedarf, menge) => (num(bedarf) >= 0 && num(menge) > 0 ? bedarf / menge : NAN);
  /* Bestellrhythmus in Tagen = Bestellmenge / Tagesverbrauch */
  const rhythm = (menge, tagesverbrauch) => (num(menge) >= 0 && num(tagesverbrauch) > 0 ? menge / tagesverbrauch : NAN);
  /* Sägezahn: p {daily, lead, safety, qty}. Start direkt nach einer Lieferung (Höchstbestand), Bestellung bei Meldebestand,
     Lieferung nach der Lieferzeit. Ist die Bestellmenge kleiner als Tagesverbrauch · Lieferzeit, ist die Bestellung schon überfällig (ok = false). */
  function sawtooth(p, cycles) {
    const d = num(p.daily), L = num(p.lead), s = num(p.safety), q = num(p.qty), n = cycles || 3;
    if (!(d > 0) || !(q > 0) || !(L >= 0) || !(s >= 0)) return { ok: false, pts: [], orders: [], deliveries: [], meld: NAN, max: NAN, T: NAN };
    const T = q / d, meld = d * L + s, max = s + q, pts = [], orders = [], deliveries = [];
    for (let k = 0; k < n; k++) {
      const t0 = k * T; pts.push([t0, max]);
      if (L <= T) orders.push([t0 + T - L, meld]);
      pts.push([t0 + T, s]); deliveries.push([t0 + T, s]);
    }
    pts.push([n * T, max]);
    return { ok: L <= T, pts, orders, deliveries, meld, max, T };
  }

  /* ---------- Optimale Bestellmenge (Andler) ---------- */
  /* m_opt = √(200 · Jahresbedarf · Bestellkosten / (Einstandspreis · Lagerhaltungskostensatz in %)) */
  function andler(bedarf, bestellkosten, preis, satz) {
    if (!(num(bedarf) >= 0 && num(bestellkosten) >= 0 && num(preis) > 0 && num(satz) > 0)) return NAN;
    return Math.sqrt(200 * bedarf * bestellkosten / (preis * satz));
  }
  const costOrder = (bedarf, kosten, m) => (num(bedarf) >= 0 && num(kosten) >= 0 && num(m) > 0 ? bedarf / m * kosten : NAN);
  /* Lagerkosten je Jahr = durchschnittlicher Bestand (m/2) · Einstandspreis · Lagerhaltungskostensatz / 100 */
  const costStore = (m, preis, satz) => (num(m) >= 0 && num(preis) >= 0 && num(satz) >= 0 ? m / 2 * preis * satz / 100 : NAN);
  const costTotal = (bedarf, kosten, preis, satz, m) => costOrder(bedarf, kosten, m) + costStore(m, preis, satz);
  function costCurve(bedarf, kosten, preis, satz, mmin, mmax, n) {
    const pts = []; if (!(mmin > 0 && mmax > mmin)) return pts;
    for (let i = 0; i <= n; i++) { const m = mmin + (mmax - mmin) * i / n, b = costOrder(bedarf, kosten, m), l = costStore(m, preis, satz); pts.push({ m, b, l, g: b + l }); }
    return pts;
  }

  /* ---------- ABC-Analyse ---------- */
  /* items [{name, qty, price}]; lim {a, b} in % (Standard 80/15, Rest = C).
     Sortierung nach Jahreswert (Menge · Preis) absteigend; bei Gleichstand nach Eingabereihenfolge.
     Klasse nach dem kumulierten Wertanteil einschließlich des Artikels: ≤ a → A, ≤ a+b → B, sonst C (Grenze gehört zur besseren Klasse);
     der wertvollste Artikel ist immer A. Artikel ohne Wert sind C. */
  /* PRUEFEN: Lehrbücher behandeln den Artikel, der die Grenze überschreitet, unterschiedlich; hier gilt "kumuliert einschließlich ≤ Grenze". */
  function abc(items, lim) {
    let a = lim && num(lim.a) > 0 ? lim.a : 80, b = lim && num(lim.b) >= 0 ? lim.b : 15;
    if (a >= 100 || a + b > 100) { a = 80; b = 15; }
    const list = (Array.isArray(items) ? items : []).map((it, i) => { const q = num(it.qty), p = num(it.price); return { name: String(it.name == null ? '' : it.name), qty: q >= 0 ? q : 0, price: p >= 0 ? p : 0, i }; });
    list.forEach(r => { r.value = r.qty * r.price; });
    list.sort((x, y) => y.value - x.value || x.i - y.i);
    const total = list.reduce((s, r) => s + r.value, 0), eps = 1e-9; let cumV = 0;
    list.forEach((r, k) => {
      cumV += r.value; r.rank = k + 1; r.share = total > 0 ? r.value / total * 100 : 0; r.cum = total > 0 ? cumV / total * 100 : 0;
      r.cls = r.value <= 0 ? 'C' : (k === 0 || r.cum <= a + eps) ? 'A' : r.cum <= a + b + eps ? 'B' : 'C';
    });
    const classes = {};
    ['A', 'B', 'C'].forEach(c => { const rs = list.filter(r => r.cls === c), v = rs.reduce((s, r) => s + r.value, 0); classes[c] = { n: rs.length, nShare: list.length ? rs.length / list.length * 100 : 0, value: v, share: total > 0 ? v / total * 100 : 0 }; });
    return { rows: list, total, classes, lim: { a, b, c: 100 - a - b } };
  }

  const API = { parseDe, fmtDe, fmtN, rd, hashStr, rng, ri, pick, shuffle, YEAR,
    avg2, avg, avg13, turnover, storageDays, stockRate, storageInterest, interestYear, costRate, holdingRate, kennzahlen,
    dailyUse, safetyStock, reorderPoint, maxStock, ordersPerYear, rhythm, sawtooth,
    andler, costOrder, costStore, costTotal, costCurve, abc };
  root.LAG_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
