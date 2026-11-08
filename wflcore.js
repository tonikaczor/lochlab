'use strict';
/* Tonfunk Warenfluss-Lab: reine Rechenlogik (Kennung 'wfl'). window.WFL_CORE bzw. module.exports.
   ALLE Zahlen (Mengen, Fristen, Tarife, Tragfähigkeiten, Maße, Zeiten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Praxis.
   Themen: Wareneingang, Lagerstrategien, Kommissionierung, Flurförderzeuge, Inventur, Versand und Frachtpapiere.
   Nicht hier (siehe laglab/ladlab): Umschlagshäufigkeit, Meldebestand, ABC-Analyse, Zurren, Reibung, Gefahrgut, Verpackungssymbole.
   Konventionen: Längen im Kommissioniermodell in m, Stapler-Maße in mm, Paketmaße in cm, Massen in kg.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);
  const floorN = x => (fin(x) ? Math.floor(x + 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|stück|stk|kg|daN|dan|n|kn|mm|cm|m|°|grad|%|mal|paletten|pakete|min|sek|s|h|tage|tagen|plätze|picks)$/i, '');
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

  /* ============================================================ Wareneingang */
  /* Übungsartikel in Paaren (gerade/ungerade Nummer = ähnlich, Verwechslungsgefahr bei Falschlieferung) */
  const ARTS = [
    { nr: 'A-1043', n: 'Hydraulikschlauch DN 12, 2 m', p: 18.5 }, { nr: 'A-1044', n: 'Hydraulikschlauch DN 16, 2 m', p: 24.9 },
    { nr: 'B-2201', n: 'Sechskantschraube M10 x 40 (100er-Pack)', p: 6.8 }, { nr: 'B-2210', n: 'Sechskantschraube M10 x 60 (100er-Pack)', p: 7.9 },
    { nr: 'C-3305', n: 'Kugellager 6204 2RS', p: 4.5 }, { nr: 'C-3350', n: 'Kugellager 6304 2RS', p: 6.2 },
    { nr: 'D-4120', n: 'Dichtring NBR 40 x 52', p: 1.2 }, { nr: 'D-4125', n: 'Dichtring NBR 45 x 58', p: 1.6 },
    { nr: 'E-5018', n: 'Netzteil 24 V / 2,5 A', p: 21.4 }, { nr: 'E-5019', n: 'Netzteil 24 V / 5 A', p: 33.9 },
    { nr: 'F-6070', n: 'Kabelbinder 300 mm (100er-Pack)', p: 3.1 }, { nr: 'F-6071', n: 'Kabelbinder 450 mm (100er-Pack)', p: 4.8 }
  ];
  /* Befunde bei der Wareneingangsprüfung. act = Ablauf-Schritt (nur Ablauf, keine Rechtsberatung). */
  /* PRUEFEN P1: Abläufe je Befund (Vermerk auf Lieferschein/Frachtbrief vor Abfahrt des Fahrers, Ware sperren, Einkauf informieren) sind stark vereinfacht. Stimmt das mit eurem Wareneingangs-Ablauf überein? */
  const FIND = [
    { k: 'ok', n: 'In Ordnung', act: 'Ware annehmen, Menge und Zustand auf dem Lieferschein bestätigen und einlagern.' },
    { k: 'unter', n: 'Zu wenig geliefert', act: 'Fehlmenge auf dem Lieferschein vermerken und den Einkauf informieren (Nachlieferung oder Gutschrift klären).' },
    { k: 'ueber', n: 'Zu viel geliefert', act: 'Überschuss getrennt stellen und melden; der Einkauf entscheidet über Annahme oder Rücksendung.' },
    { k: 'falsch', n: 'Falsche Ware', act: 'Ware nicht einlagern, sperren und den Einkauf informieren; Rücksendung klären.' },
    { k: 'transport', n: 'Transportschaden', act: 'Schaden vor der Abfahrt des Fahrers auf Lieferschein bzw. Frachtbrief vermerken, Fotos machen, Tatbestand aufnehmen, Ware sperren.' },
    { k: 'quali', n: 'Qualitätsmangel', act: 'Ware sperren, Mangel beschreiben und fotografieren, Einkauf und Qualitätssicherung informieren (Mängelrüge nach betrieblichem Ablauf).' }
  ];
  const findOf = k => FIND.find(x => x.k === k) || FIND[0];
  /* Befund einer Zeile: Falschlieferung vor Schaden vor Mengenabweichung */
  function lineFinding(l) {
    if (!l || !(num(l.ordered) >= 0) || !(num(l.counted) >= 0)) return NAN;
    if (l.artL !== l.artO) return 'falsch';
    if (l.damage === 'transport') return 'transport';
    if (l.damage === 'quali') return 'quali';
    if (l.counted < l.ordered) return 'unter';
    if (l.counted > l.ordered) return 'ueber';
    return 'ok';
  }
  const NOTE_OK = ['Verpackung unversehrt', 'Verpackung unversehrt, Etikett lesbar', 'Karton trocken und unbeschädigt'];
  const NOTE_T = ['Karton eingedrückt, Ware zum Teil zerbrochen', 'Stretchfolie gerissen, Kartons nass und aufgeweicht', 'Palette schief, Ecken gestaucht, Inhalt verbogen'];
  const NOTE_Q = ['Verpackung unversehrt; Stichprobe: Oberfläche verkratzt, Beschichtung blättert ab', 'Verpackung unversehrt; Stichprobe: Maße außerhalb der Toleranz', 'Verpackung unversehrt; Stichprobe: Gewinde schief geschnitten'];
  /* Lieferung aus Seed: 5 Zeilen mit Bestellung, Lieferschein, Zählung und Zustandsvermerk */
  function makeDelivery(seed) {
    const R = rng('wfl-del-' + seed), idx = shuffle(R, ARTS.map((_, i) => i)), used = new Set(), sel = [];
    for (const i of idx) { if (sel.length < 5 && !used.has(i >> 1)) { used.add(i >> 1); sel.push(i); } }
    const kinds = shuffle(R, ['ok', pick(R, ['unter', 'ueber']), pick(R, ['transport', 'quali']), 'falsch', pick(R, ['ok', 'unter', 'ueber', 'transport', 'quali'])]);
    const qtys = [24, 36, 40, 48, 60, 72, 100, 120];
    const lines = sel.map((ai, j) => {
      const a = ARTS[ai], k = kinds[j], o = pick(R, qtys); let artL = a, counted = o, noted = o, damage = 'none', note = pick(R, NOTE_OK);
      if (k === 'unter') { counted = o - ri(R, 2, Math.max(2, Math.floor(o / 6))); noted = R() < 0.6 ? o : counted; }
      else if (k === 'ueber') { counted = o + ri(R, 2, Math.max(2, Math.floor(o / 6))); noted = R() < 0.5 ? o : counted; }
      else if (k === 'falsch') artL = ARTS[ai ^ 1];
      else if (k === 'transport') { damage = 'transport'; note = pick(R, NOTE_T); }
      else if (k === 'quali') { damage = 'quali'; note = pick(R, NOTE_Q); }
      return { artO: a.nr, nameO: a.n, artL: artL.nr, nameL: artL.n, ordered: o, noted, counted, damage, note, price: a.p };
    });
    return { seed: String(seed), lines };
  }
  /* Ablauf bei Beanstandung (Übungsablauf, nur als Reihenfolge) */
  /* PRUEFEN P2: Reihenfolge des Ablaufs (annehmen mit Vermerk, sperren, Tatbestand aufnehmen, melden, Mängelrüge nach Ablauf, Entscheidung abwarten). Stimmt sie mit eurem betrieblichen Ablauf überein? */
  const ABLAUF = ['Schaden bzw. Abweichung auf dem Lieferschein vermerken', 'Ware sperren und getrennt stellen', 'Tatbestand aufnehmen (Fotos, Mengen, Datum, Namen)', 'Vorgesetzten bzw. Einkauf informieren', 'Mängelrüge an den Lieferer nach betrieblichem Ablauf', 'Entscheidung abwarten (Nachlieferung, Gutschrift oder Rücksendung)'];
  /* Fristen als ÜBUNGSWERTE: der Ankunftstag zählt nicht mit, gezählt werden nur Werktage Montag bis Freitag */
  /* PRUEFEN P3: Die Übungsfristen (offener Mangel 3 Werktage, versteckter Mangel 7 Werktage, Ankunftstag zählt nicht, Samstag und Sonntag zählen nicht) sind frei gewählte Übungswerte, KEINE Rechtsaussage. In der Praxis gelten gesetzliche und vertragliche Regeln (z. B. HGB, AGB). Welche Fristen sollen wir im Unterricht nennen? */
  const FRIST = { offen: 3, versteckt: 7 };
  const WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  function addWorkdays(dow, n) {
    if (!(dow >= 1 && dow <= 7 && Number.isInteger(dow)) || !(n >= 0 && n <= 200 && Number.isInteger(n))) return { dow: NAN, cal: NAN };
    let d = dow, left = n, cal = 0;
    while (left > 0) { d = d % 7 + 1; cal++; if (d <= 5) left--; }
    return { dow: d, cal };
  }
  /* naiv: einfach n Kalendertage weiterzählen (Fehlerbild) */
  const naiveDow = (dow, n) => (num(dow) >= 1 && num(n) >= 0 ? (dow - 1 + n) % 7 + 1 : NAN);

  /* ============================================================ Lagerstrategien */
  const MON = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function dayStr(n) {
    if (!(Number.isInteger(n) && n >= 1 && n <= 365)) return '–';
    let m = 0; while (n > MON[m]) { n -= MON[m]; m++; }
    return (n < 10 ? '0' : '') + n + '.' + (m + 1 < 10 ? '0' : '') + (m + 1) + '.';
  }
  const STRATS = [{ k: 'fifo', n: 'FIFO (first in, first out)', d: 'zuerst eingelagert, zuerst entnommen' }, { k: 'lifo', n: 'LIFO (last in, first out)', d: 'zuletzt eingelagert, zuerst entnommen' }, { k: 'fefo', n: 'FEFO (first expired, first out)', d: 'zuerst ablaufend, zuerst entnommen' }];
  /* Charge: { id, ein (Tag der Einlagerung im Jahr), mhd (Tag des Ablaufs im Jahr), qty } */
  function orderBatches(batches, strat) {
    const cmp = { fifo: (x, y) => x.ein - y.ein || x.mhd - y.mhd, lifo: (x, y) => y.ein - x.ein || x.mhd - y.mhd, fefo: (x, y) => x.mhd - y.mhd || x.ein - y.ein }[strat];
    if (!cmp || !Array.isArray(batches)) return [];
    return batches.filter(b => num(b.qty) > 0).slice().sort(cmp);
  }
  function withdraw(batches, strat, q) {
    if (!(num(q) >= 0)) return { picks: [], missing: NAN };
    let rest = q; const picks = [];
    for (const b of orderBatches(batches, strat)) { if (rest <= 0) break; const t = Math.min(b.qty, rest); if (t > 0) picks.push({ id: b.id, qty: t }); rest -= t; }
    return { picks, missing: Math.max(0, rest) };
  }
  const pad2 = n => (n < 10 ? '0' : '') + n;
  const slotStr = (g, f, e) => pad2(g) + '-' + pad2(f) + '-' + e;
  function parseSlot(s) { const m = /^(\d{1,2})-(\d{1,2})-(\d)$/.exec(String(s || '').trim()); return m ? { g: +m[1], f: +m[2], e: +m[3] } : null; }
  /* Chaotische Lagerhaltung (Übung): nächster freier Platz in der Reihenfolge Gang, Fach, Ebene aufsteigend */
  function nextFreeSlot(occ, gangs, faecher, ebenen) {
    const set = new Set(occ || []);
    for (let g = 1; g <= gangs; g++) for (let f = 1; f <= faecher; f++) for (let e = 1; e <= ebenen; e++) { const s = slotStr(g, f, e); if (!set.has(s)) return s; }
    return null;
  }
  function allSlots(gangs, faecher, ebenen) { const o = []; for (let g = 1; g <= gangs; g++) for (let f = 1; f <= faecher; f++) for (let e = 1; e <= ebenen; e++) o.push(slotStr(g, f, e)); return o; }
  /* Platzbedarf: Zeilen = Artikel, Spalten = Monate (Paletten). Feste Plätze = Summe der Höchstbestände, freie Platzwahl = höchste Monatssumme. */
  function placeNeed(m) {
    if (!Array.isArray(m) || !m.length || !m.every(r => Array.isArray(r) && r.length === m[0].length && r.length > 0 && r.every(v => num(v) >= 0))) return null;
    const cols = m[0].length, fixed = m.reduce((s, r) => s + Math.max.apply(null, r), 0);
    const colSum = Array.from({ length: cols }, (_, j) => m.reduce((s, r) => s + r[j], 0)), free = Math.max.apply(null, colSum);
    const avg = colSum.reduce((s, v) => s + v, 0) / cols;
    return { fixed, free, saving: fixed - free, colSum, avg, utilFixed: fixed > 0 ? avg / fixed * 100 : NAN, utilFree: free > 0 ? avg / free * 100 : NAN };
  }

  /* ============================================================ Kommissionierung */
  /* Kommissioniermodell (Übungswerte): Gänge 1 bis 6 mit 20 m Länge, Abstand der Gänge 3 m, Quergänge vorn (y = 0) und hinten (y = 20 m).
     Die Basis (Start und Ziel, Ausgang) liegt vorn an Gang 0. Entnahmeplätze liegen bei 2, 6, 10, 14 und 18 m ab Vorderkante. */
  /* PRUEFEN P4: Lagermodell (6 Gänge, 20 m lang, 3 m Gangabstand, Quergänge vorn und hinten, Plätze alle 4 m) ist ein frei erfundenes Übungsmodell. Passt es zu den Lagern, die die Azubis kennen? */
  const LAYOUT = { L: 20, w: 3, aisles: 6, slots: [2, 6, 10, 14, 18] };
  /* Weg zwischen zwei Plätzen (Gang a, Meter p): im selben Gang direkt, sonst über den kürzeren Quergang (vorn oder hinten) */
  function dist(a1, p1, a2, p2, L, w) {
    L = L == null ? LAYOUT.L : L; w = w == null ? LAYOUT.w : w;
    if (![a1, p1, a2, p2].every(v => num(v) >= 0)) return NAN;
    if (a1 === a2) return Math.abs(p1 - p2);
    return Math.abs(a1 - a2) * w + Math.min(p1 + p2, 2 * L - p1 - p2);
  }
  const PICK0 = { a: 0, p: 0 };
  /* Wegstrecke der Pickliste in der angegebenen Reihenfolge: Basis, alle Plätze, zurück zur Basis */
  function routeLength(picks, L, w) {
    if (!Array.isArray(picks) || !picks.every(q => num(q.a) >= 0 && num(q.p) >= 0)) return NAN;
    let cur = PICK0, s = 0;
    for (const q of picks.concat([PICK0])) { s += dist(cur.a, cur.p, q.a, q.p, L, w); cur = q; }
    return s;
  }
  const aislesOf = picks => Array.from(new Set(picks.map(q => q.a))).sort((x, y) => x - y);
  /* S-Form (Schleifenstrategie): jeder Gang mit Positionen wird ganz durchlaufen, abwechselnd hin und zurück */
  function sShapeLength(picks, L, w) {
    L = L == null ? LAYOUT.L : L; w = w == null ? LAYOUT.w : w;
    if (!Array.isArray(picks) || !picks.every(q => num(q.a) >= 0 && num(q.p) >= 0)) return NAN;
    const A = aislesOf(picks).filter(a => a > 0), k = A.length; if (!k) return 0;
    return k * L + 2 * A[k - 1] * w + (k % 2 ? L : 0);
  }
  /* Stichstrategie: jeder Gang wird von vorn betreten und bis zum hintersten Platz gegangen und zurück */
  function stichLength(picks, L, w) {
    w = w == null ? LAYOUT.w : w;
    if (!Array.isArray(picks) || !picks.every(q => num(q.a) >= 0 && num(q.p) >= 0)) return NAN;
    const A = aislesOf(picks).filter(a => a > 0); if (!A.length) return 0;
    return 2 * A[A.length - 1] * w + A.reduce((s, a) => s + 2 * Math.max.apply(null, picks.filter(q => q.a === a).map(q => q.p)), 0);
  }
  /* Pickreihenfolge nach S-Form: nach Gang sortiert, im ersten Gang aufsteigend, im zweiten absteigend usw. */
  function sShapeOrder(picks) {
    const A = aislesOf(picks); let out = [];
    A.forEach((a, i) => { const g = picks.filter(q => q.a === a).slice().sort((x, y) => (i % 2 ? y.p - x.p : x.p - y.p)); out = out.concat(g); });
    return out;
  }
  /* kürzeste Reihenfolge durch Ausprobieren aller Reihenfolgen (höchstens 8 Plätze) */
  function bestOrder(picks, L, w) {
    const n = Array.isArray(picks) ? picks.length : -1; if (n < 0 || n > 8) return { order: [], len: NAN };
    if (!n) return { order: [], len: 0 };
    let best = Infinity, bo = null; const used = Array(n).fill(false), cur = [];
    (function rec(last, len) {
      if (len >= best) return;
      if (cur.length === n) { const t = len + dist(last.a, last.p, 0, 0, L, w); if (t < best) { best = t; bo = cur.slice(); } return; }
      for (let i = 0; i < n; i++) if (!used[i]) { used[i] = true; cur.push(picks[i]); rec(picks[i], len + dist(last.a, last.p, picks[i].a, picks[i].p, L, w)); cur.pop(); used[i] = false; }
    })(PICK0, 0);
    return { order: bo, len: best };
  }
  /* Streckenzug zwischen zwei Plätzen (Punkte in Metern: x = Gang · Abstand, y = Meter ab Vorderkante) */
  function legPath(a1, p1, a2, p2, L, w) {
    L = L == null ? LAYOUT.L : L; w = w == null ? LAYOUT.w : w;
    const x1 = a1 * w, x2 = a2 * w;
    if (a1 === a2) return [{ x: x1, y: p1 }, { x: x2, y: p2 }];
    const y = p1 + p2 <= 2 * L - p1 - p2 ? 0 : L;
    return [{ x: x1, y: p1 }, { x: x1, y }, { x: x2, y }, { x: x2, y: p2 }];
  }
  function routePath(picks, L, w) {
    const pts = [{ x: 0, y: 0 }]; let cur = PICK0;
    for (const q of picks.concat([PICK0])) { legPath(cur.a, cur.p, q.a, q.p, L, w).slice(1).forEach(pt => pts.push(pt)); cur = q; }
    return pts;
  }
  const pathLength = pts => { let s = 0; for (let i = 1; i < pts.length; i++) s += Math.abs(pts[i].x - pts[i - 1].x) + Math.abs(pts[i].y - pts[i - 1].y); return s; };
  /* Auftragsbündelung: ein gemeinsamer Rundgang statt getrennter Rundgänge (S-Form) */
  function bundleSaving(orders) {
    if (!Array.isArray(orders) || orders.length < 2) return { single: NAN, joint: NAN, saving: NAN, pct: NAN };
    const single = orders.reduce((s, o) => s + sShapeLength(o), 0), joint = sShapeLength([].concat.apply([], orders));
    return { single, joint, saving: single - joint, pct: single > 0 ? (single - joint) / single * 100 : NAN };
  }
  /* Pickleistung und Fehlerquote */
  /* PRUEFEN P5: Zeitmodell (Weg ÷ Gehgeschwindigkeit + Greifzeit je Position + Basiszeit je Auftrag) und die Übungswerte (Gehgeschwindigkeit 1 bis 2 m/s, Greifzeit 8 bis 12 s, Basiszeit 60 bis 120 s) sind vereinfacht. Welche Werte nennt ihr im Unterricht? */
  const pickSeconds = (weg, v, n, tg, tb) => (num(weg) >= 0 && num(v) > 0 && num(n) >= 0 && num(tg) >= 0 && num(tb) >= 0 ? weg / v + n * tg + tb : NAN);
  const pickRate = (n, sec) => (num(n) >= 0 && num(sec) > 0 ? n / sec * 3600 : NAN);
  const errorRate = (err, total) => (num(err) >= 0 && num(total) > 0 ? err / total * 100 : NAN);
  const pctChange = (a, b) => (num(a) > 0 && num(b) >= 0 ? (b - a) / a * 100 : NAN);

  /* ============================================================ Flurförderzeuge (Gabelstapler) */
  /* Übungs-Traglastdiagramm eines Frontstaplers: Nennlast gilt bei Lastschwerpunkt 500 mm und sinkt mit der Hubhöhe */
  /* PRUEFEN P6: Übungswerte für die Tragfähigkeit (Hubhöhe bis 3.000 mm: 2.400 kg, bis 4.000 mm: 2.100 kg, bis 5.000 mm: 1.800 kg bei Lastschwerpunkt 500 mm). Echte Werte stehen NUR auf dem Typenschild bzw. im Traglastdiagramm des jeweiligen Staplers. Ist der Hinweis im Lab deutlich genug? */
  const HUB = [{ bis: 3000, q: 2400 }, { bis: 4000, q: 2100 }, { bis: 5000, q: 1800 }];
  const C0 = 500;
  const hubQ = h => { if (!(num(h) > 0)) return NAN; const e = HUB.find(x => h <= x.bis); return e ? e.q : NAN; };
  /* Lastschwerpunkt bei gleichmäßig verteilter Last: halbe Tiefe in Gabelrichtung, gemessen vom Gabelrücken */
  /* PRUEFEN P7: Lastschwerpunkt = halbe Tiefe gilt nur für gleichmäßig verteilte, quaderförmige Ladung. Bei ungleichmäßiger Last muss der tatsächliche Schwerpunkt bestimmt werden. Ausreichend für den Unterricht? */
  const loadCentre = l => (num(l) > 0 ? l / 2 : NAN);
  /* Resttragfähigkeit bei Lastschwerpunkt c (mm): Q · 500 / c, abgerundet; bei c ≤ 500 gilt die Nenntragfähigkeit */
  /* PRUEFEN P8: Vereinfachte Umrechnung Q · 500 / c (Momentengleichgewicht, Hubhöhe bleibt gleich). Verbindlich ist immer das Traglastdiagramm des Herstellers, das Kurven für mehrere Hubhöhen und Anbaugeräte zeigt. Ist die Vereinfachung für die Ausbildung vertretbar? */
  const restCap = (Q, c) => (num(Q) > 0 && num(c) > 0 ? (c <= C0 ? Q : floorN(Q * C0 / c)) : NAN);
  const capacity = (h, c) => restCap(hubQ(h), c);
  const canLift = (m, h, c) => { const k = capacity(h, c); return num(m) >= 0 && fin(k) ? m <= k : false; };
  /* Standsicherheit (Übungsmodell): Kippen um die Vorderachse. Kippmoment = Last · (Lastabstand zur Vorderachse), Standmoment = Eigengewicht · Schwerpunktabstand */
  /* PRUEFEN P9: Das Kippmoment-Modell (nur statisch, ohne Mastneigung, Fahrbewegung, Bodenneigung und Sicherheitszuschlag) ist stark vereinfacht und gilt nur für die Rechenübung. Darf es so im Unterricht stehen? */
  const tipMoment = (mL, c, e) => (num(mL) >= 0 && num(c) >= 0 && num(e) >= 0 ? mL * (c + e) : NAN);
  const standMoment = (mS, b) => (num(mS) >= 0 && num(b) >= 0 ? mS * b : NAN);
  const tipLoad = (mS, b, c, e) => (num(mS) > 0 && num(b) > 0 && num(c) >= 0 && num(e) >= 0 && c + e > 0 ? mS * b / (c + e) : NAN);
  const tipRatio = (mS, b, mL, c, e) => { const k = tipMoment(mL, c, e); return fin(k) && k > 0 ? standMoment(mS, b) / k : NAN; };
  /* Prüfung vor Fahrtantritt (Sichtprüfung): Prüfpunkte mit in Ordnung- und Mangel-Befund */
  /* PRUEFEN P10: Prüfpunkte vor Fahrtantritt (Reifen, Hydraulik, Gabelzinken, Bremse, Hupe/Warnleuchte, Lenkung, Rückhaltesystem, Typenschild, Batterie/Stecker, Fahrerschutzdach) sind eine vereinfachte Auswahl. Maßgebend sind Betriebsanweisung und Herstellerangaben. Reicht diese Auswahl für den Unterricht, und wie lautet euer Wortlaut für "Stapler sperren"? */
  const INSPECT = [
    { k: 'reifen', n: 'Reifen', ok: 'Profil gleichmäßig, keine Schnitte', bad: 'Reifen eingeschnitten, Gewebe sichtbar' },
    { k: 'hydro', n: 'Hydraulikschläuche', ok: 'Schläuche trocken, keine Ölspur am Boden', bad: 'Schlauch feucht, Tropfen auf dem Boden' },
    { k: 'gabel', n: 'Gabelzinken', ok: 'Zinken gerade, keine Risse, Sicherung sitzt', bad: 'Zinken sichtbar verbogen, Riss am Zinkenrücken' },
    { k: 'bremse', n: 'Betriebsbremse', ok: 'Bremse greift gleichmäßig', bad: 'Bremspedal lässt sich fast bis zum Boden treten' },
    { k: 'hupe', n: 'Hupe und Warnleuchte', ok: 'Hupe und Warnleuchte arbeiten', bad: 'Hupe ohne Funktion' },
    { k: 'lenkung', n: 'Lenkung', ok: 'Lenkung leichtgängig ohne Spiel', bad: 'Lenkrad hat viel Spiel, Stapler zieht nach links' },
    { k: 'gurt', n: 'Rückhaltesystem', ok: 'Gurt vorhanden und gängig', bad: 'Gurt eingeklemmt und lässt sich nicht ausziehen' },
    { k: 'schild', n: 'Typenschild und Traglastdiagramm', ok: 'Typenschild und Diagramm lesbar', bad: 'Typenschild fehlt, Diagramm abgerissen' },
    { k: 'batt', n: 'Batterie und Stecker', ok: 'Batterie geladen, Stecker fest', bad: 'Stecker lose, Kabel an der Isolierung angeschmort' },
    { k: 'dach', n: 'Fahrerschutzdach', ok: 'Fahrerschutzdach unbeschädigt', bad: 'Fahrerschutzdach verbogen, Strebe angerissen' }
  ];
  function makeInspection(seed) {
    const R = rng('wfl-ins-' + seed), items = shuffle(R, INSPECT).slice(0, 8), nb = ri(R, 1, 3), badIdx = new Set(shuffle(R, items.map((_, i) => i)).slice(0, nb));
    return { seed: String(seed), items: items.map((it, i) => ({ k: it.k, n: it.n, bad: badIdx.has(i), text: badIdx.has(i) ? it.bad : it.ok })) };
  }
  const inspectionBad = ins => ins.items.filter(x => x.bad).length;

  /* ============================================================ Inventur */
  const invLine = (soll, ist, price) => (num(soll) >= 0 && num(ist) >= 0 && num(price) >= 0 ? { diff: ist - soll, wert: (ist - soll) * price } : null);
  function invTotals(rows) {
    if (!Array.isArray(rows) || !rows.length) return null; let plus = 0, minus = 0, nDiff = 0;
    for (const r of rows) { const l = invLine(r.soll, r.ist, r.price); if (!l) return null; if (l.wert > 0) plus += l.wert; else if (l.wert < 0) minus += -l.wert; if (l.diff !== 0) nDiff++; }
    return { plus, minus, saldo: plus - minus, nDiff, n: rows.length, quote: nDiff / rows.length * 100 };
  }
  /* Bestand zum Stichtag aus einer Zählung nach (after = true) oder vor (false) dem Stichtag */
  /* PRUEFEN P11: Rückrechnung/Fortschreibung des Bestands auf den Stichtag (Zählung nach dem Stichtag: gezählt − Zugänge + Abgänge) als Rechenübung. Zulässige Zeitfenster und Nachweise der Bewegungen nennen wir bewusst nicht. Soll das so bleiben? */
  const stichtagBestand = (count, zu, ab, after) => (num(count) >= 0 && num(zu) >= 0 && num(ab) >= 0 ? (after === false ? count + zu - ab : count - zu + ab) : NAN);
  /* Hochrechnung einer Stichprobe */
  /* PRUEFEN P12: Stichprobeninventur als reine Hochrechnung (Summe der Stichprobe ÷ Stichprobenumfang · Gesamtzahl der Artikel). Die Zulässigkeit des Verfahrens und die statistischen Anforderungen sind nicht Teil des Labs. Ist die Vereinfachung in Ordnung? */
  const extrapolate = (sum, n, N) => (num(sum) >= 0 && num(n) > 0 && num(N) >= num(n) ? sum / n * N : NAN);

  /* ============================================================ Versand und Frachtpapiere */
  /* Gurtmaß = längste Seite + 2 · (die beiden anderen Seiten), alle Maße in cm */
  const girth = (l, b, h) => { if (![l, b, h].every(v => num(v) > 0)) return NAN; const s = [l, b, h].sort((x, y) => y - x); return s[0] + 2 * (s[1] + s[2]); };
  const longest = (l, b, h) => ([l, b, h].every(v => num(v) > 0) ? Math.max(l, b, h) : NAN);
  /* PRUEFEN P13: Paketgrenzen (Gurtmaß höchstens 300 cm, längste Seite höchstens 120 cm, Gewicht höchstens 31,5 kg) sind Übungswerte, die sich an üblichen Paketdiensten orientieren. Echte Grenzen je Dienstleister und Produkt prüfen. Welche Werte nehmen wir im Unterricht? */
  const PAKET = { girthMax: 300, longMax: 120, kgMax: 31.5 };
  function parcelCheck(l, b, h, kg) {
    const g = girth(l, b, h), lg = longest(l, b, h); if (!fin(g) || !(num(kg) > 0)) return null;
    const r = { girth: g, longest: lg, okGirth: g <= PAKET.girthMax, okLong: lg <= PAKET.longMax, okKg: kg <= PAKET.kgMax };
    r.ok = r.okGirth && r.okLong && r.okKg; return r;
  }
  /* PRUEFEN P14: Versandart-Entscheidung (Paket, wenn alle Paketgrenzen eingehalten und keine Palette; Stückgut/Spedition sonst; Komplettladung ab 20 Paletten oder ab 10.000 kg) ist eine stark vereinfachte Übungsregel. Passen die Schwellen zu euren Versandarten? */
  const MODE_NAMES = { paket: 'Paketversand', stueck: 'Stückgutversand (Spedition)', komplett: 'Komplettladung' };
  function shipMode(o) {
    if (!o || !(num(o.kg) > 0) || !(num(o.pal) >= 0)) return NAN;
    if (o.pal >= 20 || o.kg >= 10000) return 'komplett';
    if (o.pal > 0) return 'stueck';
    const c = parcelCheck(o.l, o.b, o.h, o.kg); if (!c) return NAN;
    return c.ok ? 'paket' : 'stueck';
  }
  /* Raumgewicht: 1 m³ gilt als 200 kg (Übungswert), abgerechnet wird das größere von Gewicht und Raumgewicht */
  /* PRUEFEN P15: Raumgewicht 200 kg je m³ und die Tarifstufen/Zuschlag sind Übungswerte; echte Frachttarife und Umrechnungsfaktoren sind je Spedition verschieden. Als Übungswerte in Ordnung? */
  const RAUM = 200;
  const volKg = (l, b, h, f) => ([l, b, h].every(v => num(v) > 0) ? ceilN(l * b * h / 1e6 * (f == null ? RAUM : f)) : NAN);
  const billWeight = (kg, vol) => (num(kg) > 0 && num(vol) > 0 ? Math.max(ceilN(kg), vol) : NAN);
  const TARIF = [{ bis: 50, p: 22 }, { bis: 100, p: 34 }, { bis: 250, p: 58 }, { bis: 500, p: 96 }, { bis: 1000, p: 150 }];
  const freight = w => { if (!(num(w) > 0)) return NAN; const t = TARIF.find(x => w <= x.bis + 1e-9); return t ? t.p : NAN; };
  const withSurcharge = (p, pct) => (num(p) >= 0 && num(pct) >= 0 ? rd(p * (1 + pct / 100), 2) : NAN);
  /* Packstücke: Paletten + einzeln versendete Kartons + Gitterboxen (Kartons auf einer Palette zählen nicht einzeln) */
  const packCount = (pal, kart, gb) => ([pal, kart, gb].every(v => num(v) >= 0 && Number.isInteger(v)) ? pal + kart + gb : NAN);

  const API = { parseDe, fmtDe, fmtN, rd, num, ceilN, floorN, hashStr, rng, ri, pick, shuffle,
    ARTS, FIND, findOf, lineFinding, makeDelivery, ABLAUF, FRIST, WD, addWorkdays, naiveDow,
    STRATS, dayStr, orderBatches, withdraw, slotStr, parseSlot, nextFreeSlot, allSlots, placeNeed,
    LAYOUT, dist, routeLength, aislesOf, sShapeLength, stichLength, sShapeOrder, bestOrder, legPath, routePath, pathLength, bundleSaving, pickSeconds, pickRate, errorRate, pctChange,
    HUB, C0, hubQ, loadCentre, restCap, capacity, canLift, tipMoment, standMoment, tipLoad, tipRatio, INSPECT, makeInspection, inspectionBad,
    invLine, invTotals, stichtagBestand, extrapolate,
    girth, longest, PAKET, parcelCheck, MODE_NAMES, shipMode, RAUM, volKg, billWeight, TARIF, freight, withSurcharge, packCount };
  root.WFL_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
