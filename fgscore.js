'use strict';
/* Tonfunk Fachgespräch-Lab: reine Rechenlogik (Kennung 'fgs'). window.FGS_CORE bzw. module.exports.
   ALLE Zahlen (Zeiten, Puffer, Gewichte, Punkte) sind ÜBUNGSWERTE für die Ausbildung, keine Vorgaben einer Prüfung.
   Themen: Zeitplan mit Puffer und Kapazität, Vortragszeit und Folienzahl, Bewertungsraster mit Gewichtung, Selbstbewertung.
   Ungültige Eingaben (fehlende Zahlen, negative Werte, Division durch 0) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const floorN = x => (fin(x) ? Math.floor(x + 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(%|min|minuten|std|h|folien|aufträge|geräte|punkte|pkt)$/i, '');
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

  /* ---------- Zufall (seed-fähig) ---------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const o = arr.slice(); for (let j = o.length - 1; j > 0; j--) { const k = Math.floor(R() * (j + 1)); [o[j], o[k]] = [o[k], o[j]]; } return o; }

  /* ============================================================ Zeitplan */
  /* Uhrzeit als Minuten seit Mitternacht: 510 -> "08:30". Nur Zeiten innerhalb eines Tages. */
  function clock(min) {
    if (!(num(min) >= 0) || min >= 1440) return '-';
    const m = Math.round(min); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  }
  const sumSteps = arr => (Array.isArray(arr) && arr.length && arr.every(v => num(v) >= 0) ? arr.reduce((s, v) => s + v, 0) : NAN);
  const bufferMin = (sum, pct) => (num(sum) >= 0 && num(pct) >= 0 ? sum * pct / 100 : NAN);
  const totalWithBuffer = (sum, pct) => (num(sum) >= 0 && num(pct) >= 0 ? sum + sum * pct / 100 : NAN);
  const bufferPct = (sum, buf) => (num(sum) > 0 && num(buf) >= 0 ? buf / sum * 100 : NAN);
  /* Balkenplan: Schritte nacheinander ab start (Minuten seit Mitternacht), danach der Puffer. steps = [{n, d}] */
  function gantt(steps, start, pct) {
    if (!Array.isArray(steps) || !steps.length || !(num(start) >= 0) || !(num(pct) >= 0) || !steps.every(s => s && num(s.d) >= 0)) return null;
    let t = start; const rows = steps.map(s => { const r = { n: s.n, d: s.d, start: t, end: t + s.d }; t += s.d; return r; });
    const sum = t - start, buf = bufferMin(sum, pct);
    return { rows, sum, buf: { start: t, end: t + buf, d: buf }, total: sum + buf, end: t + buf, start };
  }
  /* Auftragsfenster: Schichtlänge minus Pausen und Rüstzeit, daraus die Zahl voller Aufträge */
  const netShift = (shift, pause, ruest) => (num(shift) > 0 && num(pause) >= 0 && num(ruest) >= 0 && shift - pause - ruest > 0 ? shift - pause - ruest : NAN);
  const jobsPerShift = (net, perJob) => (num(net) > 0 && num(perJob) > 0 ? floorN(net / perJob) : NAN);

  /* ============================================================ Vortrag */
  /* Anteile in Prozent: Einstieg pe, Schluss ps, Hauptteil der Rest */
  const okShares = (pe, ps) => num(pe) >= 0 && num(ps) >= 0 && pe + ps < 100;
  function partMinutes(total, pe, ps) {
    if (!(num(total) > 0) || !okShares(pe, ps)) return null;
    return { e: total * pe / 100, h: total * (100 - pe - ps) / 100, s: total * ps / 100 };
  }
  const slideCount = (total, perSlide) => (num(total) > 0 && num(perSlide) > 0 ? floorN(total / perSlide) : NAN);
  /* Folien auf die drei Teile verteilen: größter Rest zuerst, jeder Teil bekommt mindestens eine Folie (ab drei Folien) */
  function slideSplit(n, pe, ps) {
    if (!(num(n) >= 3) || !Number.isInteger(n) || !okShares(pe, ps)) return null;
    const sh = [pe, 100 - pe - ps, ps], ex = sh.map(p => n * p / 100), out = ex.map(v => Math.max(1, Math.floor(v + 1e-9)));
    let left = n - out.reduce((a, b) => a + b, 0);
    const order = ex.map((v, i) => [v - Math.floor(v + 1e-9), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; left > 0; k = (k + 1) % 3, left--) out[order[k][1]]++;
    for (; left < 0; left++) out[out.indexOf(Math.max.apply(null, out))]--;
    return { e: out[0], h: out[1], s: out[2] };
  }
  const talkMinutes = (slot, qPct) => (num(slot) > 0 && num(qPct) >= 0 && qPct < 100 ? slot * (100 - qPct) / 100 : NAN);

  /* ============================================================ Bewertung */
  /* items = [{pts, max, w}]: erreichte Punkte, höchste Punktzahl, Gewicht (beliebige Einheit, nur das Verhältnis zählt) */
  function weighted(items) {
    if (!Array.isArray(items) || !items.length || !items.every(i => i && num(i.pts) >= 0 && num(i.max) > 0 && i.pts <= i.max && num(i.w) > 0)) return NAN;
    const W = items.reduce((s, i) => s + i.w, 0);
    return items.reduce((s, i) => s + i.w * i.pts / i.max, 0) / W * 100;
  }
  const pctOf = (pts, max) => (num(pts) >= 0 && num(max) > 0 && pts <= max ? pts / max * 100 : NAN);
  const avg = arr => (Array.isArray(arr) && arr.length && arr.every(v => num(v) >= 0) ? arr.reduce((s, v) => s + v, 0) / arr.length : NAN);
  const gap = (a, b) => (num(a) >= 0 && num(b) >= 0 ? a - b : NAN);
  /* Selbstbewertung: je Kriterium 0 (nein), 1 (teilweise), 2 (ja); Ergebnis in Prozent der höchsten Punktzahl */
  const selfPct = r => (Array.isArray(r) && r.length && r.every(v => v === 0 || v === 1 || v === 2) ? r.reduce((s, v) => s + v, 0) / (2 * r.length) * 100 : NAN);
  /* Zeit im Übungsgespräch: nach der Vorstellung bleibt die Zeit gleichmäßig für die weiteren Phasen */
  const perPhase = (total, intro, n) => (num(total) > 0 && num(intro) >= 0 && num(n) > 0 && total > intro ? (total - intro) / n : NAN);

  const API = { parseDe, fmtN, rng, ri, pick, shuffle,
    clock, sumSteps, bufferMin, totalWithBuffer, bufferPct, gantt, netShift, jobsPerShift,
    partMinutes, slideCount, slideSplit, talkMinutes,
    weighted, pctOf, avg, gap, selfPct, perPhase };
  root.FGS_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
