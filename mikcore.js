'use strict';
/* Tonfunk Mikrocontroller-Lab: reine Rechenlogik (Kennung 'mik'). window.MIK_CORE bzw. module.exports.
   Ein allgemeiner 8-Bit-Mikrocontroller mit Registernamen wie TCNT, OCR, TCCR. ALLE Zahlen (Takt, Vorteiler, Ströme, Zeiten) sind ÜBUNGSWERTE.
   Themen: Timer und Vorteiler, PWM, AD-Wandler, Interrupts, millis() und Zustandsautomat, Energiesparen.
   Konventionen: Takt in Hz, Zeiten in s (Funktionen), im Zustandsautomat und bei Interrupts in ms, Ströme in µA, Kapazität in mAh.
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(%|khz|mhz|hz|ms|µs|us|mv|v|ma|µa|ua|mah|tage|tag|min⁻¹|1\/min|upm|kω|ω|ohm|k|s|d|werte|stufen|schritte|mal)$/i, '');
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
  /* Zeit in s als passende Einheit, Frequenz in Hz als Hz, kHz oder MHz */
  function fmtTime(s) {
    if (!fin(s)) return '-'; const a = Math.abs(s);
    if (a >= 1) return fmtN(s, 3, true) + ' s'; if (a >= 1e-3) return fmtN(s * 1e3, 3, true) + ' ms'; return fmtN(s * 1e6, 3, true) + ' µs';
  }
  function fmtHz(v) {
    if (!fin(v)) return '-'; const a = Math.abs(v);
    if (a >= 1e6) return fmtN(v / 1e6, 3, true) + ' MHz'; if (a >= 1e3) return fmtN(v / 1e3, 3, true) + ' kHz'; return fmtN(v, 3, true) + ' Hz';
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

  /* ============================================================ Timer und Vorteiler */
  const PRES = [1, 8, 64, 256, 1024];
  const FCPU = [1e6, 4e6, 8e6, 16e6];
  const pow2 = n => (Number.isInteger(n) && n >= 1 && n <= 24 ? Math.pow(2, n) : NAN);
  /* Zeit eines Zählschritts in s */
  const tick = (f, N) => (num(f) > 0 && num(N) > 0 ? N / f : NAN);
  /* Zeit bis zum Überlauf (0 bis 2^bits - 1, dann zurück auf 0) in s */
  const overflow = (f, N, bits) => (num(f) > 0 && num(N) > 0 && fin(pow2(bits)) ? N * pow2(bits) / f : NAN);
  /* Vergleichstreffer je Sekunde im CTC-Modus: Zähler läuft 0 bis OCR, das sind OCR + 1 Schritte */
  const cmpHz = (f, N, ocr) => (num(f) > 0 && num(N) > 0 && num(ocr) >= 0 ? f / (N * (ocr + 1)) : NAN);
  /* Rechteck am Ausgang: der Ausgang kippt bei jedem Treffer, eine Periode braucht zwei Treffer */
  const toggleHz = (f, N, ocr) => cmpHz(f, N, ocr) / 2;
  /* Vergleichswert aus Zielfrequenz der Treffer: OCR = f / (N · fz) - 1, als reelle Zahl */
  const ocrIdeal = (f, N, fz) => (num(f) > 0 && num(N) > 0 && num(fz) > 0 ? f / (N * fz) - 1 : NAN);
  /* gerundeter Vergleichswert, ob er in die Registerbreite passt, tatsächliche Frequenz und Abweichung in % */
  function ocrCalc(f, N, fz, bits) {
    const ideal = ocrIdeal(f, N, fz), max = pow2(bits) - 1;
    if (!fin(ideal) || !fin(max)) return null;
    const ocr = Math.round(ideal), fits = ocr >= 0 && ocr <= max, fReal = ocr >= 0 ? cmpHz(f, N, ocr) : NAN;
    return { ideal, ocr, max, fits, fReal, errPct: fin(fReal) ? Math.abs(fReal - fz) / fz * 100 : NAN };
  }
  /* kleinster Vorteiler, bei dem der Vergleichswert noch in die Registerbreite passt (feinste Auflösung); NaN wenn keiner reicht */
  function bestPre(f, fz, bits) {
    const max = pow2(bits) - 1;
    for (const N of PRES) { const i = ocrIdeal(f, N, fz); if (fin(i) && i >= 0 && i <= max + 1e-9) return N; }
    return NAN;
  }
  /* ============================================================ PWM */
  const pwmHz = (f, N, bits) => (num(f) > 0 && num(N) > 0 && fin(pow2(bits)) ? f / (N * pow2(bits)) : NAN);
  const duty = (ocr, bits) => (num(ocr) >= 0 && fin(pow2(bits)) && ocr <= pow2(bits) - 1 ? ocr / (pow2(bits) - 1) : NAN);
  const meanV = (d, vs) => (num(d) >= 0 && d <= 1 && num(vs) >= 0 ? d * vs : NAN);
  const ocrForU = (u, vs, bits) => (num(u) >= 0 && num(vs) > 0 && u <= vs && fin(pow2(bits)) ? Math.round(u / vs * (pow2(bits) - 1)) : NAN);
  /* ============================================================ AD-Wandler */
  const steps = n => pow2(n);
  const lsb = (uref, n) => (num(uref) > 0 && fin(pow2(n)) ? uref / pow2(n) : NAN);
  /* Rohwert: unterer Stufenwert, am Anschlag begrenzt */
  const rawOf = (u, uref, n) => (num(u) >= 0 && num(uref) > 0 && fin(pow2(n)) ? Math.min(pow2(n) - 1, Math.floor(u / uref * pow2(n) + 1e-9)) : NAN);
  const uOf = (raw, uref, n) => (num(raw) >= 0 && num(uref) > 0 && fin(pow2(n)) && raw <= pow2(n) - 1 ? raw * uref / pow2(n) : NAN);
  const binStr = (raw, n) => (Number.isInteger(raw) && raw >= 0 && fin(pow2(n)) && raw < pow2(n) ? raw.toString(2).padStart(n, '0') : '');
  const REFS = [1.1, 2.56, 3.3, 5];
  /* kleinste Referenz, die den Messbereich noch abdeckt */
  const refFor = umax => (num(umax) > 0 ? (REFS.find(r => r >= umax - 1e-9) || NAN) : NAN);
  const perDigit = (span, n) => (num(span) > 0 && fin(pow2(n)) ? span / pow2(n) : NAN);
  /* Spannungsteiler vor dem Eingang: oberer Widerstand R1 bei gegebenem unteren R2 */
  const r1For = (ue, ua, r2) => (num(ue) > num(ua) && num(ua) > 0 && num(r2) > 0 ? r2 * (ue / ua - 1) : NAN);
  /* ============================================================ Interrupts */
  /* Zeitstempel der fallenden Flanken (ms); ISR zählt, wenn seit der letzten gezählten Flanke mehr als dead ms vergangen sind (tLast beginnt bei 0) */
  function debounceTrace(times, dead) {
    if (!Array.isArray(times) || !(num(dead) >= 0) || !times.every(t => num(t) >= 0)) return [];
    let last = 0; return times.map(t => { const d = t - last, counted = d > dead; if (counted) last = t; return { t, d, counted }; });
  }
  const debounce = (times, dead) => (Array.isArray(times) && num(dead) >= 0 && times.every(t => num(t) >= 0) ? debounceTrace(times, dead).filter(x => x.counted).length : NAN);
  const rpm = (count, ppr, gateS) => (num(count) >= 0 && num(ppr) > 0 && num(gateS) > 0 ? count / ppr / gateS * 60 : NAN);
  const isrLoad = (tUs, fHz) => (num(tUs) >= 0 && num(fHz) >= 0 ? tUs * 1e-6 * fHz * 100 : NAN);
  /* ============================================================ millis() und Zustandsautomat */
  const AMPEL = [{ k: 'rot', n: 'ROT' }, { k: 'rotgelb', n: 'ROTGELB' }, { k: 'gruen', n: 'GRUEN' }, { k: 'gelb', n: 'GELB' }];
  const okDur = d => Array.isArray(d) && d.length === 4 && d.every(v => num(v) > 0);
  const cycle = d => (okDur(d) ? d.reduce((a, b) => a + b, 0) : NAN);
  /* Abschnitte eines Durchlaufs: [{i, from, to}] in ms */
  function segs(d) { if (!okDur(d)) return []; let t = 0; return d.map((v, i) => { const s = { i, from: t, to: t + v }; t += v; return s; }); }
  /* Zustand (0 bis 3) zum Zeitpunkt t ms nach dem Start im Zustand ROT */
  function stateAt(t, d) {
    if (!okDur(d) || !(num(t) >= 0)) return NAN;
    const m = t % cycle(d); return segs(d).find(s => m >= s.from && m < s.to).i;
  }
  const U32 = 4294967296;
  /* Zeitdifferenz in 32-Bit-Ganzzahl ohne Vorzeichen (unsigned long), auch über den Überlauf hinweg */
  const u32diff = (now, last) => (Number.isInteger(now) && Number.isInteger(last) && now >= 0 && last >= 0 && now < U32 && last < U32 ? ((now - last) % U32 + U32) % U32 : NAN);
  const toggles = (T, iv) => (num(T) >= 0 && num(iv) > 0 ? Math.floor(T / iv + 1e-9) : NAN);
  /* ============================================================ Energiesparen */
  /* Mittlerer Strom: aktiv ia µA für ta ms, sonst Schlaf is µA, Periode T ms */
  const avgI = (ia, ta, is, T) => (num(ia) >= 0 && num(ta) >= 0 && num(is) >= 0 && num(T) > 0 && ta <= T ? (ia * ta + is * (T - ta)) / T : NAN);
  /* Anteil der Ladung, den die Aktivphase braucht, in % */
  const shareActive = (ia, ta, is, T) => { const a = ia * ta, s = is * (T - ta); return fin(a + s) && a + s > 0 && ta <= T ? a / (a + s) * 100 : NAN; };
  const runDays = (cmAh, iUA) => (num(cmAh) > 0 && num(iUA) > 0 ? cmAh * 1000 / iUA / 24 : NAN);

  const API = { parseDe, fmtDe, fmtN, fmtTime, fmtHz, rd, num, hashStr, rng, ri, pick, shuffle,
    PRES, FCPU, pow2, tick, overflow, cmpHz, toggleHz, ocrIdeal, ocrCalc, bestPre,
    pwmHz, duty, meanV, ocrForU,
    steps, lsb, rawOf, uOf, binStr, REFS, refFor, perDigit, r1For,
    debounce, debounceTrace, rpm, isrLoad,
    AMPEL, cycle, segs, stateAt, U32, u32diff, toggles,
    avgI, shareActive, runDays };
  root.MIK_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
