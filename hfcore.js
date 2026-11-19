'use strict';
/* Tonfunk Lab "Funk- und HF-Lab" (Kürzel hf): reine Rechenlogik, ohne Oberfläche, auch per Node testbar.
   Inhalt: Zahlen (deutsch), Pegel und Dezibel, Leitung und Anpassung, Antenne und Funkstrecke, Modulation (AM, FM, digitale Verfahren),
   Empfänger und Rauschen, HF-Messtechnik. Alles ist eigenständig (keine Abhängigkeit von anderen Lab-Dateien).
   Konventionen:
   - Leistungen in W, Spannungen in V (Effektivwert, wenn nichts anderes dasteht), Frequenzen in Hz, Längen in m, Pegel in dB, dBm, dBµV.
   - Verstärkung positiv, Dämpfung als positive Zahl (wird im Pegelplan abgezogen). Rückflussdämpfung positiv.
   - Lichtgeschwindigkeit gerundet C0 = 300.000 km/s (so steht es in den Aufgaben). Exakter Wert: C_EXAKT.
   - Freiraumdämpfung mit der gerundeten Zahlenwertgleichung a = 32,44 + 20·lg(d/km) + 20·lg(f/MHz).
   - Thermisches Rauschen gerundet −174 dBm je Hz (Raumtemperatur 290 K). dBm nach dBµV an 50 Ω gerundet +107 dB.
   Export: window.HF_CORE bzw. module.exports (Node). */
(function (root) {
  const TAU = 2 * Math.PI;
  const C0 = 3e8, C_EXAKT = 299792458, K_FSPL = 32.44, N0_DBM = -174, DBD_DBI = 2.15;
  const fin = v => typeof v === 'number' && isFinite(v);
  const lg = x => Math.log10(x);

  /* ---------------- Zahlen deutsch ---------------- */
  const rd = (v, d) => { const f = Math.pow(10, d); const s = v < 0 ? -1 : 1; return s * Math.round(Math.abs(v) * f + 1e-9) / f; };
  /* "1.234,5", "12,5 %", "−3 dBm", "-2.5" -> Zahl; sonst NaN. Punkte sind Tausendertrenner, wenn ein Komma vorkommt oder mehrere Punkte da sind. */
  function parseDe(s, unit) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).replace(/[\s  ]+/g, '').replace(/−/g, '-').replace(/[µμ]/g, 'u');
    const strip = (unit ? [String(unit).replace(/[µμ]/g, 'u').replace(/\s+/g, '').toLowerCase()] : []).concat(['dbm', 'dbuv', 'dbi', 'dbd', 'db', '%', '°', 'grad']);
    for (const u of strip) { if (u && s.toLowerCase().endsWith(u) && s.length > u.length) { s = s.slice(0, s.length - u.length); break; } }
    if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.'); else if ((s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
    if (!/^[+\-]?\d+(\.\d+)?([eE][+\-]?\d+)?$|^[+\-]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  /* feste Nachkommastellen, echtes Minuszeichen. Nie ein Tausenderpunkt (1.299 MHz läse sich wie 1,299 MHz):
     bis vier Stellen ohne Gliederung (1299), ab fünf Stellen Dreiergruppen mit schmalem, festem Leerzeichen (12 500). */
  const GRP = ' ';
  function fmtDe(v, dec) {
    if (!fin(v)) return '?';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    const neg = s[0] === '-'; if (neg) s = s.slice(1);
    const pp = s.split('.'); if (pp[0].length > 4) pp[0] = pp[0].replace(/\B(?=(\d{3})+(?!\d))/g, GRP);
    return (neg ? '−' : '') + pp.join(',');
  }
  /* gültige Stellen, überflüssige Nullen weg: fmt(1234.5678) = "1235", fmt(12500) = "12 500", fmt(0.0123456) = "0,01235" */
  function fmt(v, sig) {
    if (!fin(v)) return '?';
    if (v === 0) return '0';
    sig = sig || 4;
    const e = Math.floor(Math.log10(Math.abs(v)));
    const dec = Math.max(0, Math.min(12, sig - 1 - e));
    let s = fmtDe(v, dec);
    if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  /* Pegel mit Vorzeichen: "+3", "−12,5", "0" */
  function fmtSgn(v, sig) { if (!fin(v)) return '?'; const s = fmt(v, sig); return v > 0 && s !== '0' ? '+' + s : s; }
  function fmtHz(f, sig) { if (!fin(f)) return '?'; const a = Math.abs(f); return a >= 1e9 ? fmt(f / 1e9, sig) + ' GHz' : a >= 1e6 ? fmt(f / 1e6, sig) + ' MHz' : a >= 1e3 ? fmt(f / 1e3, sig) + ' kHz' : fmt(f, sig) + ' Hz'; }
  function fmtW(p, sig) { if (!fin(p)) return '?'; const a = Math.abs(p); return a === 0 ? '0 W' : a >= 1e3 ? fmt(p / 1e3, sig) + ' kW' : a >= 1 ? fmt(p, sig) + ' W' : a >= 1e-3 ? fmt(p * 1e3, sig) + ' mW' : a >= 1e-6 ? fmt(p * 1e6, sig) + ' µW' : a >= 1e-9 ? fmt(p * 1e9, sig) + ' nW' : a >= 1e-12 ? fmt(p * 1e12, sig) + ' pW' : fmt(p * 1e15, sig) + ' fW'; }
  function fmtV(u, sig) { if (!fin(u)) return '?'; const a = Math.abs(u); return a === 0 ? '0 V' : a >= 1 ? fmt(u, sig) + ' V' : a >= 1e-3 ? fmt(u * 1e3, sig) + ' mV' : a >= 1e-6 ? fmt(u * 1e6, sig) + ' µV' : fmt(u * 1e9, sig) + ' nV'; }
  function fmtM(l, sig) { if (!fin(l)) return '?'; const a = Math.abs(l); return a === 0 ? '0 m' : a >= 1e3 ? fmt(l / 1e3, sig) + ' km' : a >= 1 ? fmt(l, sig) + ' m' : a >= 1e-2 ? fmt(l * 1e2, sig) + ' cm' : fmt(l * 1e3, sig) + ' mm'; }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b, s) => { s = s || 1; return a + s * Math.floor(R() * (Math.floor((b - a) / s) + 1)); };
  const pick = (R, a) => a[Math.floor(R() * a.length)];

  /* ---------------- Antworten prüfen ---------------- */
  /* Toleranz: Pegel (Einheit beginnt mit dB) fest ±0,1 dB; Prozent: größerer Wert aus 1 % relativ und 0,1; sonst 1 % relativ.
     o.rel und o.abs überschreiben das (größerer Wert gilt). */
  function tolFor(v, unit, o) {
    o = o || {};
    const isDb = /^dB/.test(unit || '');
    const rel = o.rel != null ? o.rel : (isDb ? 0 : 0.01);
    const abs = o.abs != null ? o.abs : (isDb ? 0.1 : unit === '%' ? 0.1 : 0);
    return Math.max(rel * Math.abs(v), abs, 1e-9);
  }
  /* Ein einzelner Punkt mit genau drei Stellen danach (1.539) kann Dezimalpunkt oder Tausenderpunkt sein: beide Lesarten werden geprüft. */
  function checkNum(inp, v, tol, unit) {
    const x = parseDe(inp, unit);
    if (!fin(x)) return { ok: false, empty: String(inp == null ? '' : inp).trim() === '', nan: true };
    const tl = (tol == null ? 0 : tol) + 1e-9;
    if (Math.abs(x - v) <= tl) return { ok: true, x };
    const raw = String(inp).replace(/[\s  ]+/g, '').replace(/[^\d.,+\-−]+$/, '');
    if (/^[+\-−]?\d{1,3}\.\d{3}$/.test(raw)) { const y = x * 1000; if (Math.abs(y - v) <= tl) return { ok: true, x: y }; }
    return { ok: false, x };
  }

  /* ---------------- 1. Pegel und Dezibel ---------------- */
  const dbP = ratio => 10 * lg(ratio);                 /* Leistungsverhältnis -> dB */
  const dbU = ratio => 20 * lg(ratio);                 /* Spannungsverhältnis (gleicher Widerstand) -> dB */
  const ratioP = db => Math.pow(10, db / 10);
  const ratioU = db => Math.pow(10, db / 20);
  const dbmFromW = p => 10 * lg(p / 1e-3);
  const wFromDbm = l => 1e-3 * Math.pow(10, l / 10);
  const dbuvFromV = u => 20 * lg(u / 1e-6);
  const vFromDbuv = l => 1e-6 * Math.pow(10, l / 20);
  /* Zuschlag dBm -> dBµV am Widerstand z: exakt 90 + 10·lg(z); an 50 Ω: 106,99, in der Praxis 107 */
  const dbuvOffset = z => 90 + 10 * lg(z);
  const K50 = 107;
  const dbmToDbuv50 = l => l + K50;
  const dbuvToDbm50 = l => l - K50;
  /* Pegelplan: Startpegel und Liste von Änderungen in dB (Verstärkung +, Dämpfung −) -> Pegel nach jeder Stufe (Länge n + 1) */
  function levelChain(start, steps) { const out = [start]; let l = start; for (const s of steps || []) { l += s; out.push(l); } return out; }
  /* Summe mehrerer Leistungspegel (unkorrelierte Signale): über die Leistungen addieren */
  function sumDbm(list) { let p = 0; for (const l of list) p += Math.pow(10, l / 10); return 10 * lg(p); }
  const snrDb = (sig, noise) => sig - noise;

  /* ---------------- 2. Leitung und Anpassung ---------------- */
  /* Wellenlänge: f in Hz, vk = Verkürzungsfaktor (1 in Luft), c wahlweise */
  const wavelength = (f, vk, c) => (c || C0) * (vk == null ? 1 : vk) / f;
  const quarterWave = (f, vk, c) => wavelength(f, vk, c) / 4;
  /* Wellenwiderstand der verlustlosen Leitung aus den Belägen L' (H/m) und C' (F/m) */
  const z0FromLC = (l, c) => Math.sqrt(l / c);
  /* Verkürzungsfaktor aus den Belägen: v = 1/sqrt(L'C') */
  const vkFromLC = (l, c) => 1 / (Math.sqrt(l * c) * C0);
  /* Reflexionsfaktor bei reellem Abschluss (mit Vorzeichen) */
  const gamma = (zl, z0) => (zl - z0) / (zl + z0);
  const swrFromGamma = r => { r = Math.abs(r); return r >= 1 ? Infinity : (1 + r) / (1 - r); };
  const gammaFromSwr = s => (s - 1) / (s + 1);
  const reflFrac = r => r * r;                          /* reflektierter Leistungsanteil 0..1 */
  const returnLoss = r => { r = Math.abs(r); return r <= 0 ? Infinity : -20 * lg(r); };
  const gammaFromRL = a => Math.pow(10, -a / 20);
  const swrFromRL = a => swrFromGamma(gammaFromRL(a));
  const mismatchLoss = r => { const q = 1 - r * r; return q <= 0 ? Infinity : -10 * lg(q); };
  const cableLoss = (dbPer100, len) => dbPer100 * len / 100;
  const powerAfterLoss = (p, db) => p * Math.pow(10, -db / 10);
  /* Stehwelle: Betrag der Spannung im Abstand d (in Wellenlängen) vor der Last, bezogen auf die hinlaufende Welle */
  const standEnv = (r, d) => Math.sqrt(1 + r * r + 2 * r * Math.cos(2 * TAU * d));
  /* Momentanwert im Abstand d (Wellenlängen) zur Phase ph (Perioden): hinlaufende plus rücklaufende Welle */
  const standInst = (r, d, ph) => Math.cos(TAU * (ph + d)) + r * Math.cos(TAU * (ph - d));

  /* ---------------- 3. Antenne und Funkstrecke ---------------- */
  /* Länge eines Halbwellendipols mit Verkürzungsfaktor k (typisch 0,95 bis 0,97) */
  const dipoleLen = (f, k, c) => (k == null ? 1 : k) * (c || C0) / (2 * f);
  const dbiFromDbd = g => g + DBD_DBI;
  const dbdFromDbi = g => g - DBD_DBI;
  const eirpDbm = (ptx, loss, gain) => ptx - loss + gain;
  /* Freiraumdämpfung in dB (Zahlenwertgleichung): d in km, f in MHz */
  const fspl = (dKm, fMHz) => K_FSPL + 20 * lg(dKm) + 20 * lg(fMHz);
  const rxLevel = (eirp, pathLoss, grx, lossRx) => eirp - pathLoss + (grx || 0) - (lossRx || 0);
  const linkMargin = (rx, sens) => rx - sens;
  /* größte Entfernung in km für eine zulässige Streckendämpfung */
  const maxDistKm = (aMax, fMHz) => Math.pow(10, (aMax - K_FSPL - 20 * lg(fMHz)) / 20);
  /* Pegeländerung im Freiraum, wenn die Entfernung auf das k-Fache wächst (negativ) */
  const distChange = k => -20 * lg(k);

  /* ---------------- 4. Modulation ---------------- */
  const amDepth = (umax, umin) => (umax - umin) / (umax + umin);
  const amBandwidth = fmMax => 2 * fmMax;
  const amSidebandPower = (pc, m) => pc * m * m / 2;     /* beide Seitenbänder zusammen */
  const amTotalPower = (pc, m) => pc * (1 + m * m / 2);
  const amEta = m => m * m / (2 + m * m);
  const fmIndex = (df, fm) => df / fm;
  const carson = (df, fm) => 2 * (df + fm);
  const bitsPerSymbol = M => Math.log2(M);
  const bitRate = (symRate, M) => symRate * Math.log2(M);
  const symRate = (bitrate, M) => bitrate / Math.log2(M);
  const bwRolloff = (rs, alpha) => rs * (1 + alpha);
  const fskShift = (f0, f1) => Math.abs(f1 - f0);
  const fskIndex = (shift, rb) => shift / rb;
  /* Besselfunktion J_n(x), Potenzreihe (für |x| bis etwa 20 genau genug) */
  function besselJ(n, x) {
    n = Math.abs(n); let term = Math.pow(x / 2, n), fac = 1; for (let i = 2; i <= n; i++) fac *= i; term /= fac;
    let s = term; for (let m = 1; m < 80; m++) { term *= -(x * x / 4) / (m * (m + n)); s += term; if (Math.abs(term) < 1e-17 * Math.abs(s) && m > 3) break; }
    return s;
  }
  /* Zeitsignale (Trägeramplitude 1): t in s */
  const amAt = (p, t) => (1 + p.m * Math.cos(TAU * p.fm * t)) * Math.cos(TAU * p.fc * t);
  const fmAt = (p, t) => Math.cos(TAU * p.fc * t + (p.df / p.fm) * Math.sin(TAU * p.fm * t));
  /* bits: Folge aus 0 und 1, rb = Bitrate. ASK: Träger an/aus. FSK: phasenkontinuierlich, 0 -> fc − shift/2, 1 -> fc + shift/2 */
  const bitAt = (bits, rb, t) => { const i = Math.floor(t * rb + 1e-9); return bits[((i % bits.length) + bits.length) % bits.length]; };
  const askAt = (p, t) => bitAt(p.bits, p.rb, t) ? Math.cos(TAU * p.fc * t) : 0;
  function fskAt(p, t) {
    const tb = 1 / p.rb, n = Math.floor(t / tb + 1e-9); let ph = 0;
    for (let i = 0; i < n; i++) ph += (p.bits[i % p.bits.length] ? 1 : -1) * p.shift / 2 * tb;
    ph += (p.bits[n % p.bits.length] ? 1 : -1) * p.shift / 2 * (t - n * tb);
    return Math.cos(TAU * (p.fc * t + ph));
  }

  /* ---------------- 5. Empfänger und Rauschen ---------------- */
  const noiseDbm = b => N0_DBM + 10 * lg(b);                        /* thermische Rauschleistung in der Bandbreite b (Hz) */
  const noiseFloor = (b, nf) => noiseDbm(b) + (nf || 0);            /* mit Rauschmaß des Empfängers */
  const sensitivity = (b, nf, snr) => noiseFloor(b, nf) + (snr || 0);
  const chainGain = list => list.reduce((p, q) => p + q, 0);
  /* Überlagerungsempfänger: side 'oben' = Oszillator über der Empfangsfrequenz, 'unten' = darunter */
  const loFreq = (frx, fif, side) => side === 'unten' ? frx - fif : frx + fif;
  const imageFreq = (frx, fif, side) => side === 'unten' ? frx - 2 * fif : frx + 2 * fif;
  const mixSum = (f1, f2) => f1 + f2;
  const mixDiff = (f1, f2) => Math.abs(f1 - f2);
  /* kleinste Zwischenfrequenz, damit die Spiegelfrequenz mindestens den Abstand d zur Empfangsfrequenz hat */
  const ifMin = d => d / 2;
  const dynRange = (lmax, floor) => lmax - floor;
  const attNeeded = (level, maxIn) => level - maxIn;

  /* ---------------- 6. Messen in der HF-Technik ---------------- */
  const saTrue = (reading, att) => reading + att;                   /* wahrer Pegel vor dem externen Dämpfungsglied */
  const rbwChange = (b1, b2) => 10 * lg(b2 / b1);                   /* Änderung des angezeigten Rauschbodens */
  const powerFromU = (u, r) => u * u / (r == null ? 50 : r);
  const uFromPower = (p, r) => Math.sqrt(p * (r == null ? 50 : r));
  const peakFromPower = (p, r) => Math.sqrt(2 * p * (r == null ? 50 : r));
  const swrFromPowers = (pf, pr) => swrFromGamma(Math.sqrt(pr / pf));
  const harmonic = (f, n) => n * f;
  const bw3dB = (fu, fo) => fo - fu;
  const qFromBw = (f0, b) => f0 / b;
  /* Schwingkreis als Bandpass: Betrag bei f (bezogen auf das Maximum) und die −3-dB-Grenzen */
  const resMag = (f, f0, q) => { const v = f / f0 - f0 / f; return 1 / Math.sqrt(1 + q * q * v * v); };
  const resEdges = (f0, q) => { const s = Math.sqrt(1 + 1 / (4 * q * q)), h = 1 / (2 * q); return [f0 * (s - h), f0 * (s + h)]; };

  const api = {
    TAU, C0, C_EXAKT, K_FSPL, N0_DBM, DBD_DBI, K50, fin, lg, rd, parseDe, fmtDe, fmt, fmtSgn, fmtHz, fmtW, fmtV, fmtM, hashStr, rng, ri, pick, tolFor, checkNum,
    dbP, dbU, ratioP, ratioU, dbmFromW, wFromDbm, dbuvFromV, vFromDbuv, dbuvOffset, dbmToDbuv50, dbuvToDbm50, levelChain, sumDbm, snrDb,
    wavelength, quarterWave, z0FromLC, vkFromLC, gamma, swrFromGamma, gammaFromSwr, reflFrac, returnLoss, gammaFromRL, swrFromRL, mismatchLoss, cableLoss, powerAfterLoss, standEnv, standInst,
    dipoleLen, dbiFromDbd, dbdFromDbi, eirpDbm, fspl, rxLevel, linkMargin, maxDistKm, distChange,
    amDepth, amBandwidth, amSidebandPower, amTotalPower, amEta, fmIndex, carson, bitsPerSymbol, bitRate, symRate, bwRolloff, fskShift, fskIndex, besselJ, amAt, fmAt, bitAt, askAt, fskAt,
    noiseDbm, noiseFloor, sensitivity, chainGain, loFreq, imageFreq, mixSum, mixDiff, ifMin, dynRange, attNeeded,
    saTrue, rbwChange, powerFromU, uFromPower, peakFromPower, swrFromPowers, harmonic, bw3dB, qFromBw, resMag, resEdges
  };
  root.HF_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
