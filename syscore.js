'use strict';
/* Tonfunk IT-Systeme-Lab: reine Rechenlogik (Kennung 'sys'). window.SYS_CORE bzw. module.exports.
   Inhalt: einfache IT-Systeme (EVA), Geräteklassen, Busse, Adressraum und Speichergröße, Zahlensysteme im Rechner, Mikroprozessorsystem mit Adressdecoder, 8-Bit-Rechnen mit Flags (nur als Begriffe).
   ALLE Zahlen (Adressbreiten, Speichergrößen, Taktraten) sind ÜBUNGSWERTE für die Ausbildung, nicht für die Auswahl echter Bauteile.
   Konventionen: Speichergrößen binär (1 KiB = 1.024 Byte); Adressen und Daten hexadezimal mit Endung "hex" im Text, Bit 0 ist das niederwertigste Bit (A0, D0).
   Ungültige Eingaben (negative Werte, fehlende Zahlen, zu breite Werte) liefern NaN bzw. null, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(kibibyte|mibibyte|kib|mib|gib|byte|bit|stück|stk|kbyte|kb|mb|gb|b|leitungen|leitung|bausteine|baustein|%|mhz|hz)$/i, '');
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

  /* ---------- Zahlensysteme ---------- */
  const isInt = n => typeof n === 'number' && Number.isInteger(n);
  const toBase = (n, b) => (isInt(n) && n >= 0 && b >= 2 && b <= 36 ? n.toString(b).toUpperCase() : '');
  /* Text mit Ziffern der Basis b (Leerzeichen, Unterstriche, 0x-Vorsatz und h/b-Endung erlaubt) -> Zahl oder NaN */
  function fromBase(s, b) {
    s = String(s == null ? '' : s).replace(/[\s_]+/g, '');
    if (b === 16) s = s.replace(/^0x/i, '').replace(/h$/i, '');
    else if (b === 2) s = s.replace(/^0b/i, '').replace(/b$/i, '');
    if (!s) return NAN;
    const ok = new RegExp('^[' + '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, b) + ']+$', 'i');
    return ok.test(s) && s.length <= 12 ? parseInt(s, b) : NAN;
  }
  const hex = (n, digits) => (isInt(n) && n >= 0 ? toBase(n, 16).padStart(digits || 1, '0') : '');
  /* Dualzahl mit führenden Nullen auf "bits" Stellen, in Vierergruppen: 0101 1011 */
  function bin(n, bits) { if (!(isInt(n) && n >= 0)) return ''; const s = n.toString(2).padStart(bits || 1, '0'); return s.replace(/(?=(\d{4})+$)/g, ' ').trim(); }
  const binRaw = (n, bits) => bin(n, bits).replace(/ /g, '');
  const maxVal = bits => (isInt(bits) && bits >= 1 && bits <= 32 ? Math.pow(2, bits) - 1 : NAN);
  /* Zweierkomplement: Muster von -n bzw. Wert eines Musters */
  const twos = (n, bits) => (isInt(n) && n >= 0 && n <= maxVal(bits) ? ((Math.pow(2, bits) - n) % Math.pow(2, bits)) : NAN);
  const signedOf = (pat, bits) => (isInt(pat) && pat >= 0 && pat <= maxVal(bits) ? (pat >= Math.pow(2, bits - 1) ? pat - Math.pow(2, bits) : pat) : NAN);
  /* Anzahl 1-Bits */
  const ones = n => { let c = 0; while (n > 0) { c += n & 1; n = Math.floor(n / 2); } return c; };

  /* ---------- Adressraum und Speichergröße ---------- */
  /* PRUEFEN P1: Adressraum = 2^n bei n Adressleitungen (n = 16 -> 65.536 Adressen = 64 KiB bei einem Byte je Adresse); Speichergrößen im Lab binär (1 KiB = 1.024 Byte, KiB statt KB). Wird in der Berufsschule "KByte" mit 1.024 gerechnet? */
  const pow2 = n => (isInt(n) && n >= 0 && n <= 40 ? Math.pow(2, n) : NAN);
  const addrCount = n => pow2(n);
  const addrLines = count => (isInt(count) && count >= 1 && count <= Math.pow(2, 40) ? Math.ceil(Math.log2(count) - 1e-9) : NAN);
  const isPow2 = n => isInt(n) && n >= 1 && (Math.pow(2, Math.round(Math.log2(n))) === n);
  const log2i = n => (isPow2(n) ? Math.round(Math.log2(n)) : NAN);
  /* Speicherkapazität in Bit: 2^Adressleitungen · Datenleitungen */
  const memBits = (a, d) => (isInt(a) && a >= 0 && a <= 32 && isInt(d) && d >= 1 && d <= 64 ? pow2(a) * d : NAN);
  const memBytes = (a, d) => { const b = memBits(a, d); return fin(b) ? b / 8 : NAN; };
  const lastAddr = (start, size) => (isInt(start) && start >= 0 && isInt(size) && size >= 1 ? start + size - 1 : NAN);
  /* Größe als Text mit binären Einheiten: 65536 -> "64 KiB" */
  function sizeText(bytes) {
    if (!(num(bytes) >= 0)) return '–';
    const U = ['Byte', 'KiB', 'MiB', 'GiB']; let v = bytes, i = 0;
    while (i < U.length - 1 && v >= 1024 && Math.abs(v / 1024 - Math.round(v / 1024 * 1000) / 1000) < 1e-9) { v /= 1024; i++; }
    return fmtN(v, 3, true) + ' ' + U[i];
  }
  /* Datenrate des Busses: Breite in Bit, Takt in MHz, 1 Übertragung je Takt -> MB/s (1 MB = 10^6 Byte) */
  const busMBs = (widthBits, mhz) => (isInt(widthBits) && widthBits >= 1 && num(mhz) > 0 ? widthBits / 8 * mhz : NAN);

  /* ---------- Bus: Adresse, Daten, Steuersignale (Zyklen als Schrittliste) ---------- */
  /* PRUEFEN P2: Steuersignale MEMR (Speicher lesen), MEMW (Speicher schreiben), IOR (Eingabe lesen), IOW (Ausgabe schreiben) wie in der Mitschrift; echte 8085-Systeme nutzen RD, WR und IO/M. Passt die vereinfachte Darstellung? */
  const CTRL = {
    MEMR: { n: 'MEMR', t: 'Memory Read', d: 'Der Speicher schaltet seine Information auf den Datenbus.', dir: 'in' },
    MEMW: { n: 'MEMW', t: 'Memory Write', d: 'Der Speicher übernimmt die Information vom Datenbus.', dir: 'out' },
    IOR: { n: 'IOR', t: 'Input Output Read', d: 'Die Eingabeeinheit schaltet ihre Information auf den Datenbus.', dir: 'in' },
    IOW: { n: 'IOW', t: 'Input Output Write', d: 'Die Ausgabeeinheit übernimmt die Information vom Datenbus an ihre Ausgangsleitungen.', dir: 'out' }
  };
  function busCycle(sig, addr, data, addrBits) {
    const c = CTRL[sig]; if (!c || !isInt(addr) || !isInt(data) || data < 0 || data > 255 || addr < 0 || addr > maxVal(addrBits)) return null;
    const ad = Math.ceil(addrBits / 4), A = hex(addr, ad) + 'hex = ' + bin(addr, addrBits) + ', D = ' + hex(data, 2) + 'hex = ' + bin(data, 8);
    const steps = c.dir === 'out'
      ? [{ bus: 'Adressbus', t: 'Die CPU legt die Adresse ' + hex(addr, ad) + 'hex (' + bin(addr, addrBits) + ') auf den Adressbus.' },
        { bus: 'Datenbus', t: 'Die CPU legt das Datenwort ' + hex(data, 2) + 'hex (' + bin(data, 8) + ') auf den Datenbus.' },
        { bus: 'Steuerbus', t: 'Die CPU gibt das Steuersignal ' + sig + ' aus: ' + c.d }]
      : [{ bus: 'Adressbus', t: 'Die CPU legt die Adresse ' + hex(addr, ad) + 'hex (' + bin(addr, addrBits) + ') auf den Adressbus.' },
        { bus: 'Steuerbus', t: 'Die CPU gibt das Steuersignal ' + sig + ' aus: ' + c.d }, { bus: 'Datenbus', t: 'Der angesprochene Baustein legt sein Datenwort ' + hex(data, 2) + 'hex (' + bin(data, 8) + ') auf den Datenbus.' },
        { bus: 'Datenbus', t: 'Die CPU übernimmt das Datenwort vom Datenbus.' }];
    return { sig, steps, A };
  }

  /* ---------- 8-Bit-Rechnen mit Flags ---------- */
  /* PRUEFEN P3: Flags nach dem 8085: CY (Übertrag aus Bit 7), AC (Übertrag von Bit 3 nach Bit 4), Z (Ergebnis 0), S (Bit 7 des Ergebnisses), P (1, wenn die Zahl der Einsen gerade ist). Entspricht das der Darstellung im Unterricht? Bei Subtraktion wird nur CY (Borrow) betrachtet. */
  const par = r => (ones(r) % 2 === 0 ? 1 : 0);
  function add8(a, b) {
    if (!(isInt(a) && isInt(b) && a >= 0 && a <= 255 && b >= 0 && b <= 255)) return null;
    const s = a + b, r = s & 255;
    return { r, cy: s > 255 ? 1 : 0, ac: ((a & 15) + (b & 15)) > 15 ? 1 : 0, z: r === 0 ? 1 : 0, s: r >= 128 ? 1 : 0, p: par(r) };
  }
  function sub8(a, b) {
    if (!(isInt(a) && isInt(b) && a >= 0 && a <= 255 && b >= 0 && b <= 255)) return null;
    const r = (a - b + 256) & 255;
    return { r, cy: a < b ? 1 : 0, z: r === 0 ? 1 : 0, s: r >= 128 ? 1 : 0, p: par(r) };
  }
  const flagText = f => ['CY', 'AC', 'Z', 'S', 'P'].filter(k => f[k.toLowerCase()] === 1).join(', ') || 'kein Flag';

  /* ---------- Adressdecoder und Speicherplan ---------- */
  /* PRUEFEN P4: Adressdecoder: die höchsten k Adressbits wählen mit einem 1-aus-2^k-Decoder (Ausgang Z_i aktiv, wenn die Bits den Wert i haben) einen Baustein; die übrigen Bits adressieren innerhalb des Bausteins. Ausgänge hier als "aktiv" (nicht als low-aktiv /CS) dargestellt. Soll low-aktiv gezeigt werden? */
  const blockOf = (addr, totalBits, k) => (isInt(addr) && addr >= 0 && addr <= maxVal(totalBits) && isInt(k) && k >= 1 && k <= totalBits ? Math.floor(addr / pow2(totalBits - k)) : NAN);
  const blockStart = (i, totalBits, k) => i * pow2(totalBits - k);
  const blockSize = (totalBits, k) => pow2(totalBits - k);
  /* Wahrheitstabelle 1-aus-n: Eingangswert -> Ausgangsmuster */
  const decodeRow = (val, nOut) => Array.from({ length: nOut }, (_, i) => (i === val ? 1 : 0));
  /* Speicherplan aus Einträgen { n, start, size }: welche Bausteine antworten auf addr? */
  const hits = (map, addr) => map.filter(m => addr >= m.start && addr < m.start + m.size);
  function overlaps(map) {
    const out = [];
    for (let i = 0; i < map.length; i++) for (let j = i + 1; j < map.length; j++) {
      const a = map[i], b = map[j], lo = Math.max(a.start, b.start), hi = Math.min(a.start + a.size, b.start + b.size);
      if (lo < hi) out.push({ a: a.n, b: b.n, from: lo, to: hi - 1 });
    }
    return out;
  }

  /* ---------- Fehlerbilder am Bus (Daten- und Adressleitungen) ---------- */
  /* PRUEFEN P5: Fehlermodell "Leitung hängt fest": Datenleitung Dk liest immer 0 oder immer 1; Adressleitung Ak hängt auf 0, dadurch erscheinen die Zellen doppelt (Spiegelung). Kurzschluss zweier Leitungen und Wackelkontakt kommen nicht vor. Reicht das für das 1.-2. Lehrjahr? */
  const stuckData = (val, line, lvl) => (isInt(val) && isInt(line) && line >= 0 && line < 8 ? (lvl ? (val | (1 << line)) : (val & ~(1 << line))) & 255 : NAN);
  const stuckAddr = (addr, line) => (isInt(addr) && isInt(line) && line >= 0 && line < 31 ? addr & ~(1 << line) : NAN);

  /* ---------- Geräteklassen und Konfigurator ---------- */
  /* PRUEFEN P6: Merkmale der Geräteklassen nach der Mitschrift: Desktop (Hauptplatine mit Anschlüssen, Peripherie getrennt), Notebook (alles im Gehäuse, Dockingstation), Tablet (flach, ohne Maus und Tastatur), Smartphone (Kleinstcomputer mit Betriebssystem und Apps), Barebone (würfelförmiges Gehäuse), Industrie-PC (Temperatur, Schock, Wasser, EMV, Ausfallsicherheit, Langzeitverfügbarkeit), Small-Form-Factor (Nettop, All-in-One, Ultra-Mobile-PC, E-Book-Reader, Wearable). Die Zuordnung "Anforderung -> Gerät" in der Tabelle ist vereinfacht. Stimmt sie so? */
  const REQS = [
    { id: 'mob', t: 'Muss unterwegs ohne Steckdose arbeiten (Akku, tragbar)' },
    { id: 'tast', t: 'Tastatur und Bildschirm sollen fest im Gerät eingebaut sein' },
    { id: 'touch', t: 'Bedienung ohne Maus und Tastatur, sehr flaches Gehäuse' },
    { id: 'tel', t: 'Telefonieren und Nachrichten, dazu GPS und Sensoren (z. B. Fingerabdruck)' },
    { id: 'gross', t: 'Bildschirm mindestens so groß wie eine Heftseite' },
    { id: 'ind', t: 'Einsatz in der Werkhalle: Hitze und Kälte, Stöße, Spritzwasser, Störstrahlung, Dauerbetrieb, Ersatz noch in vielen Jahren' },
    { id: 'erw', t: 'Viele Steckplätze für Erweiterungen auf der Hauptplatine, Monitor, Tastatur und Maus getrennt' },
    { id: 'klein', t: 'Kleiner würfelförmiger Rechner ohne Akku, der wenig Platz braucht' },
    { id: 'aio', t: 'Bildschirm und Rechner in einem Gehäuse, fest am Platz' },
    { id: 'dock', t: 'Soll an einer Dockingstation weitere Anschlüsse und Steckplätze bekommen' }
  ];
  const DEVICES = [
    { id: 'desk', n: 'Desktop-PC', has: ['erw', 'gross'], d: 'Hauptplatine mit den wichtigsten Verarbeitungseinheiten und Anschlüssen; Monitor, Tastatur und Maus sind getrennte Geräte. Steht fest am Platz und ist erweiterbar.' },
    { id: 'note', n: 'Notebook', has: ['mob', 'tast', 'gross', 'dock'], d: 'Tragbarer PC: alle nötigen Komponenten, Laufwerke, Tastatur und Bildschirm im Gehäuse. Eine Dockingstation bietet zusätzliche Erweiterungssteckplätze und Anschlüsse für Peripherie.' },
    { id: 'tab', n: 'Tablet', has: ['mob', 'touch', 'gross'], d: 'Mobiler PC in einem sehr flachen Gehäuse ohne Maus und Tastatur, bedient über den Touchscreen. Konvertible Tablets (Hybrid, Two-in-One) bekommen eine Tastatur.' },
    { id: 'phone', n: 'Smartphone', has: ['mob', 'touch', 'tel'], d: 'Kleinstcomputer mit Betriebssystem, auf dem man eigene Anwendungen installiert. Kommunikation, Datenverbindung, Sensoren, Organizer und Navigation sind eingebaut.' },
    { id: 'bare', n: 'Barebone-PC', has: ['klein'], d: 'PC im würfelförmigen Gehäuse: braucht wenig Platz.' },
    { id: 'indu', n: 'Industrie-PC', has: ['ind'], d: 'Computer für Aufgaben im industriellen Bereich: temperaturresistent, schockresistent, wasserdicht, EMV-geschützt, ausfallsicher und langzeitverfügbar.' },
    { id: 'sff', n: 'Small-Form-Factor-PC (z. B. All-in-One)', has: ['aio', 'gross'], d: 'Kleine Bauformen wie Nettop, All-in-One-PC, Ultra-Mobile-PC, E-Book-Reader oder Wearable-Computer. Beim All-in-One-PC sitzt der Rechner im Bildschirmgehäuse.' }
  ];
  const deviceOf = id => DEVICES.find(d => d.id === id) || null;
  /* Anzahl erfüllter Anforderungen je Gerät, sortiert: wer alle erfüllt, steht oben */
  function rank(reqIds) {
    const ids = (reqIds || []).filter(r => REQS.some(q => q.id === r));
    return DEVICES.map(d => ({ id: d.id, n: d.n, met: ids.filter(r => d.has.indexOf(r) >= 0), miss: ids.filter(r => d.has.indexOf(r) < 0), all: ids.length > 0 && ids.every(r => d.has.indexOf(r) >= 0) }))
      .sort((a, b) => b.met.length - a.met.length || DEVICES.findIndex(d => d.id === a.id) - DEVICES.findIndex(d => d.id === b.id));
  }
  const fitting = reqIds => rank(reqIds).filter(x => x.all).map(x => x.id);

  const API = { parseDe, fmtDe, fmtN, rd, num, hashStr, rng, ri, pick, shuffle,
    isInt, toBase, fromBase, hex, bin, binRaw, maxVal, twos, signedOf, ones,
    pow2, addrCount, addrLines, isPow2, log2i, memBits, memBytes, lastAddr, sizeText, busMBs,
    CTRL, busCycle, par, add8, sub8, flagText,
    blockOf, blockStart, blockSize, decodeRow, hits, overlaps, stuckData, stuckAddr,
    REQS, DEVICES, deviceOf, rank, fitting };
  root.SYS_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
