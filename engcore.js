'use strict';
/* Tonfunk Technisches-Englisch-Lab: reine Logik (Kennung 'eng'). window.ENG_CORE bzw. module.exports.
   Inhalt: Zahlenschreibweise (englisch/deutsch), Einheiten, Toleranz, Signalwörter, Buchstabiertafel, Stückliste und Lieferschein,
   Vokabelkarten (Filter, Auswahl, Boxen), Auswertung aller Aufgabentypen (Auswahl, Zahl, Zuordnung/Lücken).
   Ungültige Eingaben liefern NaN bzw. '' , nie Infinity. Alle Werte sind Übungswerte für die Ausbildung. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zufall (seed-fähig, wie in den anderen Labs) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ---------- Zahlenschreibweise ----------
     Englisch: Dezimalpunkt, Tausenderkomma (1,250.5). Deutsch: Dezimalkomma, Tausenderpunkt (1.250,5).
     PRUEFEN P1: In englischen Datenblättern steht oft auch ein dünnes Leerzeichen als Tausendertrenner (SI-Schreibweise) oder gar keiner. Soll das im Unterricht vorkommen? */
  const RE_EN = /^[+\-−]?(\d{1,3}(,\d{3})+|\d+)(\.\d+)?$/, RE_DE = /^[+\-−]?(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;
  const isNotation = (s, mode) => (mode === 'de' ? RE_DE : RE_EN).test(String(s == null ? '' : s).trim());
  const regroup = (digits, sep) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  /* Zahl aus Text lesen. mode 'en' (Komma = Tausender), 'de' (Punkt = Tausender) oder 'auto' (Standard).
     PRUEFEN P2: Im Modus auto gilt ein einzelnes Trennzeichen mit genau drei Ziffern danach als Tausendertrenner ("1.000" und "1,000" = 1000, nicht 1); "0.125" bleibt eine Dezimalzahl. Reicht diese Regel für Eingaben der Azubis? */
  function parseNum(s, mode) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/^[€$£]/, '').replace(/(eur|euro|usd|stück|stk|pcs|pieces|inches|inch|mm|cm|km|kg|lbs|lb|bar|psi|°c|°f|kω|mω|ω|ohm|in|m|g|v|a|k|c|f|°|%)$/i, '').replace('−', '-');
    const sm = /^([+\-]?)(.*)$/.exec(s), sign = sm[1] === '-' ? -1 : 1, b = sm[2];
    if (!/^[\d.,]+$/.test(b) || !/\d/.test(b)) return NAN;
    mode = mode || 'auto';
    let ip, fp = '';
    const hasD = b.indexOf('.') >= 0, hasC = b.indexOf(',') >= 0;
    const groupsOk = (str, sep) => { const p = str.split(sep); return p.every((g, i) => (i === 0 ? /^\d{1,3}$/.test(g) : /^\d{3}$/.test(g))); };
    if (mode === 'en' || mode === 'de') {
      if (!isNotation(b, mode)) return NAN;
      const dec = mode === 'en' ? '.' : ',', th = mode === 'en' ? ',' : '.', k = b.indexOf(dec);
      ip = (k >= 0 ? b.slice(0, k) : b).split(th).join(''); fp = k >= 0 ? b.slice(k + 1) : '';
    } else if (hasD && hasC) {
      const last = Math.max(b.lastIndexOf('.'), b.lastIndexOf(',')), dec = b[last], th = dec === '.' ? ',' : '.';
      const i0 = b.slice(0, last); fp = b.slice(last + 1);
      if (i0.indexOf(dec) >= 0 || !/^\d+$/.test(fp) || !groupsOk(i0, th)) return NAN;
      ip = i0.split(th).join('');
    } else if (hasD || hasC) {
      const sep = hasD ? '.' : ',', parts = b.split(sep);
      if (parts.length > 2) { if (!groupsOk(b, sep)) return NAN; ip = parts.join(''); }
      else {
        const a = parts[0], c = parts[1];
        if (c === '') return NAN;
        if (/^\d{3}$/.test(c) && /^[1-9]\d{0,2}$/.test(a)) ip = a + c; else { ip = a === '' ? '0' : a; fp = c; }
      }
    } else ip = b;
    if (!/^\d+$/.test(ip) || (fp && !/^\d+$/.test(fp))) return NAN;
    return sign * parseFloat(ip + (fp ? '.' + fp : ''));
  }
  function convertNotation(s, from, to) {
    s = String(s == null ? '' : s).trim(); if (!isNotation(s, from)) return '';
    const fs = from === 'en' ? ',' : '.', fd = from === 'en' ? '.' : ',', ts = to === 'en' ? ',' : '.', td = to === 'en' ? '.' : ',';
    let sign = ''; if (/^[+\-−]/.test(s)) { sign = s[0]; s = s.slice(1); }
    const grouped = s.indexOf(fs) >= 0, k = s.indexOf(fd), ipRaw = (k >= 0 ? s.slice(0, k) : s), fp = k >= 0 ? s.slice(k + 1) : null, digits = ipRaw.split(fs).join('');
    const ip = grouped || digits.length > 4 ? regroup(digits, ts) : digits;
    return sign + ip + (fp != null ? td + fp : '');
  }
  function fmtDe(v, dec, group) {
    if (!fin(v)) return '–'; dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 4) i = regroup(i, '.');
    return (neg ? '−' : '') + i + (f ? ',' + f : '');
  }
  function fmtEn(v, dec, group) {
    if (!fin(v)) return '-'; dec = dec == null ? 2 : dec; let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    let [i, f] = s.split('.'); const neg = i[0] === '-'; if (neg) i = i.slice(1);
    if (group && i.length > 3) i = regroup(i, ',');
    return (neg ? '-' : '') + i + (f ? '.' + f : '');
  }
  const trimZ = (s, dc) => (s.indexOf(dc) >= 0 ? s.replace(/0+$/, '').replace(new RegExp('\\' + dc + '$'), '') : s);
  const fmtN = (v, dec, group) => (fin(v) ? trimZ(fmtDe(v, dec == null ? 2 : dec, group), ',') : '–');
  const fmtEnN = (v, dec, group) => (fin(v) ? trimZ(fmtEn(v, dec == null ? 2 : dec, group), '.') : '-');

  /* ---------- Zahlen sprechen (englisch) ----------
     PRUEFEN P3: Es wird ohne "and" gesprochen (amerikanisch: "one hundred fifty"). Britisch wäre "one hundred and fifty". Welche Form gilt im Unterricht? */
  const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'], SCALE = ['', 'thousand', 'million', 'billion', 'trillion'];
  function say3(n) {
    const s = []; if (n >= 100) { s.push(ONES[Math.floor(n / 100)] + ' hundred'); n %= 100; }
    if (n > 0) s.push(n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
    return s.join(' ');
  }
  function sayInt(n) {
    if (!(fin(n) && n >= 0 && n < 1e15 && Math.floor(n) === n)) return '';
    if (n === 0) return 'zero';
    const g = []; let k = 0; while (n > 0) { const part = n % 1000; if (part) g.unshift(say3(part) + (SCALE[k] ? ' ' + SCALE[k] : '')); n = Math.floor(n / 1000); k++; }
    return g.join(' ');
  }
  /* sayNumber('0.05') = 'zero point zero five'; Eingabe in englischer Schreibweise */
  function sayNumber(s) {
    s = String(s == null ? '' : s).trim(); if (!isNotation(s, 'en')) return '';
    let neg = false; if (/^[+\-−]/.test(s)) { neg = s[0] !== '+'; s = s.slice(1); }
    const k = s.indexOf('.'), ip = (k >= 0 ? s.slice(0, k) : s).split(',').join(''), fp = k >= 0 ? s.slice(k + 1) : '';
    const w = sayInt(parseInt(ip, 10)); if (!w) return '';
    return (neg ? 'minus ' : '') + w + (fp ? ' point ' + fp.split('').map(d => ONES[+d]).join(' ') : '');
  }

  /* ---------- Einheiten ----------
     PRUEFEN P4: Faktoren: 1 in = 25,4 mm, 1 ft = 304,8 mm, 1 lb = 0,45359237 kg, 1 psi = 0,0689476 bar, 1 gal (US) = 3,785 l. Gallon ist je nach Land verschieden (UK 4,546 l). Reicht US-gallon? */
  const UNITS = {
    len: { n: 'Länge', u: { mm: 1, cm: 10, m: 1000, km: 1e6, in: 25.4, ft: 304.8, yd: 914.4, mi: 1609344 } },
    mass: { n: 'Masse', u: { g: 1, kg: 1000, t: 1e6, oz: 28.349523125, lb: 453.59237 } },
    press: { n: 'Druck', u: { bar: 1, kPa: 0.01, MPa: 10, psi: 0.0689475729 } },
    vol: { n: 'Volumen', u: { ml: 1, l: 1000, 'gal (US)': 3785.411784, 'fl oz (US)': 29.5735295625 } }
  };
  const TEMPS = ['°C', '°F', 'K'];
  const quantityOf = u => Object.keys(UNITS).find(q => Object.prototype.hasOwnProperty.call(UNITS[q].u, u)) || (TEMPS.indexOf(u) >= 0 ? 'temp' : '');
  function conv(v, from, to) {
    if (!(num(v) === v)) return NAN; const q = quantityOf(from);
    if (!q || q !== quantityOf(to)) return NAN;
    if (q === 'temp') { const k = from === '°C' ? v + 273.15 : from === '°F' ? (v - 32) * 5 / 9 + 273.15 : v; return to === '°C' ? k - 273.15 : to === '°F' ? (k - 273.15) * 9 / 5 + 32 : k; }
    const U = UNITS[q].u; return v * U[from] / U[to];
  }
  const cToF = c => (num(c) === c ? c * 9 / 5 + 32 : NAN), fToC = f => (num(f) === f ? (f - 32) * 5 / 9 : NAN);

  /* ---------- Toleranz ---------- */
  function tolRange(nominal, pct) { if (!(num(nominal) === nominal && num(pct) === pct && pct >= 0)) return { min: NAN, max: NAN }; return { min: nominal * (1 - pct / 100), max: nominal * (1 + pct / 100) }; }
  const inTol = (v, nominal, pct) => { const r = tolRange(nominal, pct); return num(v) === v && fin(r.min) ? v >= r.min - 1e-9 && v <= r.max + 1e-9 : false; };

  /* ---------- Signalwörter für Warnhinweise ----------
     PRUEFEN P5: Einteilung wie in ANSI Z535.6 / ISO 3864: DANGER = unmittelbare Gefahr, Tod oder schwere Verletzung; WARNING = mögliche Gefahr, Tod oder schwere Verletzung;
     CAUTION = leichte bis mittlere Verletzung; NOTICE = Sachschaden, keine Verletzung. Gilt diese Einteilung bei euch (Betriebsanleitungen deutscher Hersteller nutzen oft nur WARNING/CAUTION)? */
  const SIGNALS = [
    { w: 'DANGER', de: 'GEFAHR', color: '#e5484d', rule: 'Die Gefahr ist unmittelbar da. Wenn du sie nicht vermeidest, führt sie zu Tod oder schwerer Verletzung.' },
    { w: 'WARNING', de: 'WARNUNG', color: '#ff9f1c', rule: 'Die Gefahr ist möglich. Wenn du sie nicht vermeidest, kann sie zu Tod oder schwerer Verletzung führen.' },
    { w: 'CAUTION', de: 'VORSICHT', color: '#f5d90a', rule: 'Die Gefahr kann zu leichter oder mittlerer Verletzung führen.' },
    { w: 'NOTICE', de: 'HINWEIS', color: '#3b9eff', rule: 'Es droht nur ein Sachschaden (oder es ist eine wichtige Information). Niemand kann verletzt werden.' }
  ];
  /* injury: 'none' | 'minor' | 'serious'; imminent: Gefahr unmittelbar (nur bei serious wichtig) */
  function signalFor(info) {
    if (!info) return '';
    if (info.injury === 'none') return 'NOTICE';
    if (info.injury === 'minor') return 'CAUTION';
    if (info.injury === 'serious') return info.imminent ? 'DANGER' : 'WARNING';
    return '';
  }
  const signalWordOf = t => { const m = /^\s*(DANGER|WARNING|CAUTION|NOTICE)\b/.exec(String(t == null ? '' : t)); return m ? m[1] : ''; };

  /* ---------- Buchstabiertafel (ICAO) ----------
     PRUEFEN P6: Englisch wird nach ICAO buchstabiert (Alpha ... Zulu, "Juliett", "X-ray"). Im deutschen Betrieb gilt sonst die Tafel nach DIN 5009 (Anton, Berta, Cäsar). Passt ICAO für englische Telefonate? */
  const NATO = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
  function natoSpell(word) { const out = []; String(word == null ? '' : word).toUpperCase().split('').forEach(c => { if (NATO[c]) out.push(NATO[c]); }); return out.join(' – '); }

  /* ---------- Stückliste und Lieferschein (Beträge in Cent, damit nichts falsch rundet) ---------- */
  const cents = p => (num(p) === p ? Math.round(p * 100 + 1e-6) : NAN);
  const lineCents = (qty, price) => (num(qty) >= 0 && num(price) >= 0 ? qty * cents(price) : NAN);
  function bomTotal(lines, n) {
    if (!Array.isArray(lines) || !(num(n) >= 0)) return NAN; let s = 0;
    for (const l of lines) { const c = lineCents(l.qty, l.price); if (!fin(c)) return NAN; s += c; }
    return s * n / 100;
  }
  const bomQty = (lines, pos, n) => { const l = Array.isArray(lines) && lines.find(x => x.pos === pos); return l && num(n) >= 0 ? l.qty * n : NAN; };
  /* Bestellung gegen Lieferschein: [{pos, qty}] gegen [{pos, qty}] -> Abweichungen */
  function bomCheck(ordered, delivered) {
    const out = [], dm = {}; (delivered || []).forEach(d => { dm[d.pos] = d.qty; });
    (ordered || []).forEach(o => {
      const d = dm[o.pos];
      if (d === undefined || d === 0) out.push({ pos: o.pos, type: 'missing', diff: o.qty });
      else if (d < o.qty) out.push({ pos: o.pos, type: 'short', diff: o.qty - d });
      else if (d > o.qty) out.push({ pos: o.pos, type: 'over', diff: d - o.qty });
    });
    (delivered || []).forEach(d => { if (!(ordered || []).some(o => o.pos === d.pos)) out.push({ pos: d.pos, type: 'extra', diff: d.qty }); });
    return out;
  }

  /* ---------- Tonfall von Sätzen (formal / locker) ---------- */
  const INFORMAL = [/\bhey\b/i, /\bhi\b/i, /\bthx\b/i, /\bpls\b/i, /\bcheers\b/i, /\bgonna\b/i, /\bwanna\b/i, /\b(can't|won't|don't|didn't|I'm|we're|it's|here's|that's)\b/i, /!/, /\basap\b/i, /\bsorry, but\b/i, /\bcan't wait\b/i];
  const isFormal = t => !INFORMAL.some(re => re.test(String(t == null ? '' : t)));

  /* ---------- Vokabelkarten ----------
     Karte: { en, de, g (Gruppe), jobs [Berufskürzel] }. Boxen: { [en]: 0..2 } (0 = neu/unsicher, 2 = sicher). */
  const filterCards = (cards, job, group) => (cards || []).filter(c => (!job || job === 'all' || c.jobs.indexOf(job) >= 0) && (!group || group === 'all' || c.g === group));
  function makeChoices(R, cards, card, dir, n) {
    n = n || 4; const key = dir === 'de2en' ? 'en' : 'de', right = card[key];
    const same = shuffle(R, cards.filter(c => c !== card && c.g === card.g && c[key] !== right)), other = shuffle(R, cards.filter(c => c !== card && c.g !== card.g && c[key] !== right));
    const wrong = []; same.concat(other).forEach(c => { if (wrong.length < n - 1 && wrong.indexOf(c[key]) < 0) wrong.push(c[key]); });
    const ch = shuffle(R, [right].concat(wrong)); return { choices: ch, correct: ch.indexOf(right) };
  }
  const boxWeight = b => (b >= 2 ? 1 : b === 1 ? 2 : 4);
  function nextCard(R, cards, boxes, avoid) {
    const pool = (cards || []).filter(c => !avoid || c.en !== avoid); if (!pool.length) return (cards || [])[0] || null;
    const w = pool.map(c => boxWeight((boxes && boxes[c.en]) || 0)), sum = w.reduce((a, b) => a + b, 0); let r = R() * sum;
    for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r < 0) return pool[i]; } return pool[pool.length - 1];
  }
  const advance = (box, ok) => (ok ? Math.min(2, (box || 0) + 1) : 0);

  /* ---------- Auswertung ----------
     Frage q: ask.type 'choice' (correct = Index), 'num' (value, tol) oder 'multi' (rows [{label, options, correct}]).
     Antwort a: { c } | { v } | { m: [Index|null, ...] }. Ergebnis {incomplete, msg}, wenn unvollständig. */
  function evalAnswer(q, a) {
    a = a || {};
    if (q.ask.type === 'choice') { if (a.c == null) return { incomplete: true, msg: 'Wähle zuerst eine Antwort.' }; return { ok: a.c === q.ask.correct, given: q.ask.choices[a.c] }; }
    if (q.ask.type === 'multi') {
      const m = a.m || [], rows = q.ask.rows; if (rows.some((r, i) => m[i] == null || m[i] === '')) return { incomplete: true, msg: 'Wähle bei jeder Zeile eine Antwort.' };
      const rr = rows.map((r, i) => +m[i] === r.correct), n = rr.filter(Boolean).length;
      return { ok: n === rows.length, given: n + ' von ' + rows.length + ' richtig', rows: rr };
    }
    const v = parseNum(a.v); if (!fin(v)) return { incomplete: true, msg: 'Bitte gib eine Zahl ein (mit Komma oder Punkt).' };
    return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: fmtN(v, 3, true) + (q.ask.unit ? ' ' + q.ask.unit : '') };
  }
  /* Prüfmodus: jede Tipp-Stufe kostet 25 Prozent (höchstens zwei Stufen); beim normalen Üben nichts */
  const pctFor = (exam, tips) => (exam ? 100 - 25 * Math.min(2, Math.max(0, tips || 0)) : 100);

  const JOBS = [['egs', 'Elektroniker'], ['ige', 'Industrieelektriker'], ['im', 'Industriemechaniker'], ['tpd', 'Techn. Produktdesigner'], ['fll', 'Lagerlogistik'], ['ik', 'Industriekaufmann'], ['fi', 'Fachinformatiker']];

  const API = { rd, num, hashStr, rng, ri, pick, shuffle,
    isNotation, parseNum, convertNotation, fmtDe, fmtEn, fmtN, fmtEnN, sayInt, sayNumber,
    UNITS, TEMPS, quantityOf, conv, cToF, fToC, tolRange, inTol,
    SIGNALS, signalFor, signalWordOf, NATO, natoSpell,
    cents, lineCents, bomTotal, bomQty, bomCheck, isFormal,
    JOBS, filterCards, makeChoices, nextCard, advance, boxWeight, evalAnswer, pctFor };
  root.ENG_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
