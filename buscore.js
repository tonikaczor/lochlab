'use strict';
/* Tonfunk Bus-Lab: reine Rechenlogik (Kennung 'bus'). window.BUS_CORE bzw. module.exports.
   ALLE Zahlen (Baudraten, Längen, Pegel, Zeiten) sind ÜBUNGSWERTE für die Ausbildung. Keine Hersteller, keine Bauteilnummern.
   Themen: UART-Rahmen, RS-232/RS-485 (Abschluss, Reflexion, Laufzeit), CAN (Arbitrierung, Rahmenlänge), Datenmengen, Funkpegel (dBm),
   Fehlererkennung (Parität, Summe, Hamming-Abstand) und der I²C-Vergleich.
   Fachannahmen stehen als PRUEFEN-Kommentare im Code und gesammelt in quelle/bus/PRUEFEN.md.
   Ungültige Eingaben (Division durch 0, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(µs|us|ms|ns|s|kbit\/s|Mbit\/s|bit\/s|Bit|Byte|MB|kB|mW|dB|dBm|Ω|kΩ|MΩ|µF|mA|A|V|W|Hz|kHz|m|%|°C)$/i, '');
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
  /* Zeit in Sekunden als Text mit passender Einheit */
  function fmtZeit(s) {
    if (!fin(s)) return '-';
    if (s < 1e-3) return fmtN(s * 1e6, 2, true) + ' µs';
    if (s < 1) return fmtN(s * 1e3, 2, true) + ' ms';
    return fmtN(s, 2, true) + ' s';
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

  /* ============================================================ UART */
  /* Rahmen: 1 Startbit, d Datenbits, Paritätsbit (par 'E' gerade, 'O' ungerade, 'N' keins), stop Stoppbits */
  const frameBits = (d, par, stop) => 1 + d + (par === 'N' ? 0 : 1) + stop;
  const bitTime = baud => (baud > 0 ? 1 / baud : NAN);
  const frameTime = (baud, d, par, stop) => frameBits(d, par, stop) * bitTime(baud);
  const netRate = (baud, d, par, stop) => baud * d / frameBits(d, par, stop);
  const onesCount = (v, d) => { let k = 0; for (let i = 0; i < d; i++) k += (v >> i) & 1; return k; };
  /* Paritätsbit: gerade Parität macht die Zahl der Einsen (Daten plus Paritätsbit) gerade */
  const parityBit = (v, d, mode) => (mode === 'E' ? onesCount(v, d) % 2 : 1 - onesCount(v, d) % 2);
  /* Bitfolge auf der Leitung, Datenbit D0 zuerst (LSB first) */
  function frameList(v, d, par, stop) {
    const a = [{ k: 'S', v: 0 }];
    for (let i = 0; i < d; i++) a.push({ k: 'D' + i, v: (v >> i) & 1 });
    if (par !== 'N') a.push({ k: 'P', v: parityBit(v, d, par) });
    for (let i = 0; i < stop; i++) a.push({ k: 'E', v: 1 });
    return a;
  }
  /* PRUEFEN P1: Abtastung in Bitmitte. Läuft der Empfänger um abw Prozent falsch, ist der Abtastpunkt des letzten Bits eines Rahmens
     aus n Bit nach (n - 0,5) Bitzeiten um (n - 0,5) · abw / 100 Bitzeiten verschoben. Über 0,5 Bitzeiten liest er das Nachbarbit. */
  const abtastVersatz = (n, abw) => (n - 0.5) * abw / 100;

  /* ============================================================ RS-232 / RS-485 */
  /* PRUEFEN P2: Modellleitung mit Wellenwiderstand 120 Ω, Sender mit 30 Ω Innenwiderstand, verlustfrei, 5 ns Laufzeit je Meter. */
  const Z0 = 120, RSRC = 30, NS_PRO_M = 5;
  const laufzeit = l => l * NS_PRO_M * 1e-9;
  /* Parallelschaltung über Kehrwerte */
  const parR = (...r) => (r.every(x => x > 0) ? 1 / r.reduce((s, x) => s + 1 / x, 0) : NAN);
  const reflexion = (rl, z0) => (rl > 0 && z0 > 0 ? (rl - z0) / (rl + z0) : NAN);
  /* Spannung am Leitungsende nach k Hin- und Rückläufen, bezogen auf den Endwert (Endwert = 1) */
  function lineRise(gL, gS, k) {
    const v = []; let s = 0, p = 1;
    for (let j = 0; j <= k; j++) { s += p; p *= gL * gS; v.push((1 + gL) * s); }
    const fin1 = (1 + gL) / (1 - gL * gS);
    return v.map(x => x / fin1);
  }
  /* Abschluss: 'none' keiner, 'end' nur rechtes Ende, 'both' beide Enden. Sender links oder rechts.
     Liefert die Reflexionsfaktoren am Empfangsende (gL) und am Sendeende (gS). */
  function rsModel(term, senderLeft) {
    const rTerm = term !== 'none', lTerm = term === 'both', loadT = senderLeft ? rTerm : lTerm, srcT = senderLeft ? lTerm : rTerm;
    const gL = loadT ? reflexion(Z0, Z0) : 1, gS = reflexion(srcT ? parR(RSRC, Z0) : RSRC, Z0);
    return { gL, gS, steps: lineRise(gL, gS, 5) };
  }
  const overshoot = steps => Math.max(0, Math.max.apply(null, steps) - 1) * 100;

  /* ============================================================ CAN */
  const CAN_STUFEN = [[40, 1000], [100, 500], [250, 250], [500, 125]]; /* PRUEFEN P3: Faustwerte Länge in m, höchste Bitrate in kbit/s */
  const canMaxRate = l => { const s = CAN_STUFEN.find(x => l <= x[0]); return s ? s[1] : NAN; };
  const idBits = (id, bits) => { let s = ''; for (let i = bits - 1; i >= 0; i--) s += (id >> i) & 1; return s; };
  /* Arbitrierung: dominant = 0 setzt sich durch. Knoten, die 1 senden, während der Bus 0 hat, hören auf.
     rows[i][b] = Bit, das Knoten i sendet (null = hört nur noch zu), bus[b] = Pegel auf dem Bus, lost[i] = Bit des Ausscheidens (-1 = Sieger) */
  function arbitrate(ids, bits) {
    if (new Set(ids).size !== ids.length || ids.some(x => !(x >= 0 && x < Math.pow(2, bits)))) return null;
    let act = ids.map((_, i) => i); const rows = ids.map(() => []), bus = [], lost = ids.map(() => -1);
    for (let b = 0; b < bits; b++) {
      const bit = i => (ids[i] >> (bits - 1 - b)) & 1, lvl = Math.min.apply(null, act.map(bit));
      ids.forEach((_, i) => rows[i].push(act.includes(i) ? bit(i) : null)); bus.push(lvl);
      act.filter(i => bit(i) > lvl).forEach(i => { lost[i] = b; }); act = act.filter(i => bit(i) === lvl);
    }
    return { rows, bus, lost, winner: act[0] };
  }
  /* PRUEFEN P4: Standardrahmen mit 11-Bit-ID: 44 Bit ohne Daten (SOF, ID, RTR, IDE, r0, DLC, CRC mit Trenner, ACK mit Trenner, EOF) plus 3 Bit Pause, ohne Stopfbits */
  const canFrameBits = n => 47 + 8 * n;
  const canNutz = n => 8 * n / canFrameBits(n) * 100;

  /* ============================================================ Daten, Funk, Fehler, I²C */
  const dbm = mw => (mw > 0 ? 10 * Math.log10(mw) : NAN);
  /* PRUEFEN P5: Funkband 868 MHz mit Sendezeitbegrenzung (Duty Cycle), je nach Teilband 0,1 % bis 10 %. Hier Übungswerte. */
  const dutySek = pct => 3600 * pct / 100;
  /* Zeit für Adresse plus n Datenbytes bei I²C: 9 Takte je Byte (8 Bit plus Quittung), ohne Start und Stopp. f in kHz. */
  const i2cZeit = (n, fk) => (fk > 0 ? (1 + n) * 9 / (fk * 1000) : NAN);
  const hamming = (a, b) => { let x = a ^ b, k = 0; while (x) { k += x & 1; x >>>= 1; } return k; };
  const checksum8 = bytes => bytes.reduce((s, x) => s + x, 0) % 256;

  const API = { parseDe, fmtDe, fmtN, fmtZeit, rd, rng, ri, pick, shuffle,
    frameBits, bitTime, frameTime, netRate, onesCount, parityBit, frameList, abtastVersatz,
    Z0, laufzeit, parR, reflexion, lineRise, rsModel, overshoot,
    canMaxRate, idBits, arbitrate, canFrameBits, canNutz,
    dbm, dutySek, i2cZeit, hamming, checksum8 };
  root.BUS_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
