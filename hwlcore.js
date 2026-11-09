'use strict';
/* Tonfunk PC-Hardware-Lab: reine Rechenlogik (Kennung 'hwl'). window.HWL_CORE bzw. module.exports.
   ALLE Leistungs-, Kapazitäts-, Datenraten- und Preiswerte sind ÜBUNGSWERTE für die Ausbildung, nicht für den Einkauf.
   Bauteile heißen neutral "Prozessor A" usw.; Sockelnamen (AM4, LGA 1700 ...) sind Fachbegriffe, keine Werbung.
   Konventionen: Leistung in W, Energie in kWh, Größen in Byte (dezimal kB/MB/GB/TB, binär KiB/MiB/GiB/TiB), Raten in MB/s (1 Byte = 8 Bit).
   Ungültige Eingaben (Division durch 0, negative Werte, fehlende Zahlen) liefern NaN, nie Infinity. */
(function (root) {
  const fin = Number.isFinite, NAN = NaN;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f + (v >= 0 ? 1e-9 : -1e-9)) / f; };
  const num = v => (typeof v === 'number' && fin(v) ? v : NAN);
  const ceilN = x => (fin(x) ? Math.ceil(x - 1e-9) : NAN);

  /* ---------- Zahlen deutsch ---------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NAN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|eur|euro|cent|ct|kwh|kw|w|tib|gib|mib|kib|tb|gb|mb|kb|gbit|mbit|bit|byte|b|stück|stk|platten|lanes|min|sek|s|h|std|%|°c|°|k)$/i, '');
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
  /* Dauer in Sekunden als Text: "45 s", "5 min 20 s", "1 h 2 min" */
  function fmtDur(sec) {
    if (!(num(sec) >= 0)) return '–';
    const s = Math.round(sec);
    if (s < 60) return s + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : '');
    return Math.floor(s / 3600) + ' h' + (Math.floor(s % 3600 / 60) ? ' ' + Math.floor(s % 3600 / 60) + ' min' : '');
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

  /* ---------- Speichergrößen: dezimal (SI) und binär (IEC) ---------- */
  const UNITS = { B: 1, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776 };
  const DEC = ['B', 'kB', 'MB', 'GB', 'TB'], BIN = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const BIN_OF = { kB: 'KiB', MB: 'MiB', GB: 'GiB', TB: 'TiB' };
  const convert = (v, from, to) => (num(v) >= 0 && UNITS[from] && UNITS[to] ? v * UNITS[from] / UNITS[to] : NAN);
  /* Festplattenangabe (dezimal, z. B. GB) wird vom Betriebssystem binär (GiB) angezeigt */
  const shown = (v, decUnit) => (BIN_OF[decUnit] ? convert(v, decUnit, BIN_OF[decUnit]) : NAN);
  const addrBytes = bits => (num(bits) >= 0 && bits <= 60 ? Math.pow(2, bits) : NAN);
  const addrBitsFor = bytes => (num(bytes) >= 1 ? Math.ceil(Math.log2(bytes) - 1e-9) : NAN);
  /* Sektoren mit "lba" Bit adressiert, Sektorgröße in Byte: größte Datenträgergröße in Byte */
  const lbaBytes = (lbaBits, sector) => (num(lbaBits) > 0 && num(sector) > 0 ? Math.pow(2, lbaBits) * sector : NAN);
  const toBase = (n, b) => (Number.isInteger(n) && n >= 0 && b >= 2 && b <= 36 ? n.toString(b).toUpperCase() : '');
  const fromBase = (s, b) => { s = String(s == null ? '' : s).replace(/\s+/g, ''); if (!s) return NAN; const ok = new RegExp('^[' + '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, b) + ']+$', 'i'); return ok.test(s) ? parseInt(s, b) : NAN; };

  /* ---------- Datenraten ---------- */
  const mbitToMB = m => (num(m) >= 0 ? m / 8 : NAN);
  const mbToMbit = m => (num(m) >= 0 ? m * 8 : NAN);
  /* Übertragungsdauer in s: Größe in MB (1 GB = 1000 MB), Rate in MB/s */
  const xferSec = (sizeMB, rateMBs) => (num(sizeMB) >= 0 && num(rateMBs) > 0 ? sizeMB / rateMBs : NAN);
  /* PRUEFEN P1: Übungswerte der Schnittstellen (höchste Nutz-Datenrate in MB/s): SATA 150/300/600 (8b/10b-Kodierung), USB 2.0 60 (480 Mbit/s durch 8, praktisch weniger), USB 3.2 Gen 1 500 (5 Gbit/s, 8b/10b), Gen 2 1.200 (10 Gbit/s, 128b/132b, gerundet), Gen 2x2 2.400, USB4 4.800 (40 Gbit/s, gerundet). Stimmen Werte und Rundung mit dem Lehrmaterial überein? */
  const IFACES = [
    { id: 'sata1', n: 'SATA 1.0 (SATA I)', gbit: 1.5, mbs: 150 },
    { id: 'sata2', n: 'SATA 2.0 (SATA II)', gbit: 3, mbs: 300 },
    { id: 'sata3', n: 'SATA 3.0 (SATA III)', gbit: 6, mbs: 600 },
    { id: 'usb2', n: 'USB 2.0 (High Speed)', gbit: 0.48, mbs: 60 },
    { id: 'usb32g1', n: 'USB 3.2 Gen 1 (früher USB 3.0)', gbit: 5, mbs: 500 },
    { id: 'usb32g2', n: 'USB 3.2 Gen 2', gbit: 10, mbs: 1200 },
    { id: 'usb32g22', n: 'USB 3.2 Gen 2x2', gbit: 20, mbs: 2400 },
    { id: 'usb4', n: 'USB4 (40 Gbit/s)', gbit: 40, mbs: 4800 }
  ];
  const ifaceOf = id => IFACES.find(x => x.id === id) || null;
  /* PRUEFEN P2: PCIe-Übungswerte je Lane und Richtung: Gen 2 = 0,5 GB/s, Gen 3 = 1 GB/s, Gen 4 = 2 GB/s, Gen 5 = 4 GB/s (gerundet aus 8 bzw. 16 bzw. 32 GT/s mit 128b/130b; Gen 3 genau 0,985 GB/s). Gerundet in Ordnung? */
  const LANE_GBS = { 1: 0.25, 2: 0.5, 3: 1, 4: 2, 5: 4 };
  const LANES = [1, 2, 4, 8, 16];
  const pcieRate = (gen, lanes) => (LANE_GBS[gen] && LANES.indexOf(lanes) >= 0 ? LANE_GBS[gen] * lanes : NAN);
  /* Flaschenhals: kleinste Rate der Kette */
  const bottleneck = list => { const v = list.filter(x => num(x) > 0); return v.length === list.length && v.length ? Math.min.apply(null, v) : NAN; };

  /* ---------- RAID ---------- */
  /* PRUEFEN P3: Mindestplatten RAID 0 und 1: 2, RAID 5: 3, RAID 6: 4, RAID 10: 4 (gerade Anzahl). Nutzkapazität: RAID 0 n·s, RAID 1 s (n Platten alle gespiegelt), RAID 5 (n−1)·s, RAID 6 (n−2)·s, RAID 10 n/2·s. Passt das zur Darstellung im Unterricht (gleich große Platten)? */
  const RAIDS = [
    { l: 0, n: 'RAID 0 (Striping)', min: 2, wp: 1 },
    { l: 1, n: 'RAID 1 (Spiegelung)', min: 2, wp: 2 },
    { l: 5, n: 'RAID 5 (Striping mit einfacher Parität)', min: 3, wp: 4 },
    { l: 6, n: 'RAID 6 (Striping mit doppelter Parität)', min: 4, wp: 6 },
    { l: 10, n: 'RAID 10 (gespiegelte Paare, dann Striping)', min: 4, wp: 2 }
  ];
  const raidOf = l => RAIDS.find(x => x.l === l) || null;
  function raidOk(level, n) {
    const r = raidOf(level); if (!r) return { ok: false, why: 'Diese RAID-Stufe gibt es im Lab nicht.' };
    if (!(Number.isInteger(n) && n >= 1 && n <= 24)) return { ok: false, why: 'Die Plattenzahl muss eine ganze Zahl zwischen 1 und 24 sein.' };
    if (n < r.min) return { ok: false, why: r.n.split(' (')[0] + ' braucht mindestens ' + r.min + ' Platten.' };
    if (level === 10 && n % 2) return { ok: false, why: 'RAID 10 braucht eine gerade Plattenzahl (gespiegelte Paare).' };
    return { ok: true, why: '' };
  }
  function raidUsable(level, n, s) {
    if (!raidOk(level, n).ok || !(num(s) > 0)) return NAN;
    return level === 0 ? n * s : level === 1 ? s : level === 5 ? (n - 1) * s : level === 6 ? (n - 2) * s : n / 2 * s;
  }
  const raidRaw = (n, s) => (num(s) > 0 && Number.isInteger(n) && n > 0 ? n * s : NAN);
  const raidEff = (level, n) => { const u = raidUsable(level, n, 1); return fin(u) ? u / n * 100 : NAN; };
  /* garantierte Ausfallsicherheit: so viele beliebige Platten dürfen ausfallen */
  const raidTol = (level, n) => (raidOk(level, n).ok ? (level === 0 ? 0 : level === 1 ? n - 1 : level === 5 ? 1 : level === 6 ? 2 : 1) : NAN);
  /* failed: Liste von Plattenindizes (ab 0). RAID 10: Paare (0,1), (2,3), ... */
  function raidSurvives(level, n, failed) {
    if (!raidOk(level, n).ok || !Array.isArray(failed)) return NAN;
    const f = Array.from(new Set(failed.filter(i => Number.isInteger(i) && i >= 0 && i < n)));
    if (level === 0) return f.length === 0;
    if (level === 1) return f.length < n;
    if (level === 5) return f.length <= 1;
    if (level === 6) return f.length <= 2;
    for (let p = 0; p < n; p += 2) if (f.indexOf(p) >= 0 && f.indexOf(p + 1) >= 0) return false;
    return true;
  }
  /* kleinste Plattenzahl, die mindestens needTB nutzbar liefert */
  function raidDisksFor(level, needTB, s) {
    if (!raidOf(level) || !(num(needTB) > 0) || !(num(s) > 0)) return NAN;
    for (let n = raidOf(level).min; n <= 64; n++) { if (!raidOk(level, n).ok) continue; if (raidUsable(level, n, s) >= needTB - 1e-9) return n; }
    return NAN;
  }
  const raidWP = level => (raidOf(level) ? raidOf(level).wp : NAN);

  /* ---------- Netzteil, Verlustleistung, Kühlung ---------- */
  /* PRUEFEN P4: Übungs-Zusatzlasten: Mainboard 40 W, RAM-Riegel je 4 W, SSD je 5 W, Festplatte je 8 W, Lüfter je 3 W. Prozessor und Grafikkarte mit ihrem TDP-Wert (in der Praxis kann die Spitzenleistung darüber liegen). Passt das als Faustregel? */
  const LOAD = { mb: 40, ram: 4, ssd: 5, hdd: 8, fan: 3 };
  /* PRUEFEN P5: Reserve von 30 % auf die Gesamtleistung (Faktor 1,3), danach nächste Normgröße aus 350, 400, 450, 500, 550, 650, 750, 850, 1000, 1200 W. In der Praxis wird oft ein Lastbereich von 40 bis 70 % angestrebt. Welche Regel gilt im Betrieb? */
  const RESERVE = 1.3;
  const PSU_SIZES = [350, 400, 450, 500, 550, 650, 750, 850, 1000, 1200];
  const loadSum = c => {
    const g = k => (num(c[k]) >= 0 ? c[k] : NAN);
    return g('cpu') + g('gpu') + g('mb') + g('ram') * LOAD.ram + g('ssd') * LOAD.ssd + g('hdd') * LOAD.hdd + g('fan') * LOAD.fan + (c.other == null ? 0 : g('other'));
  };
  const psuNeed = sum => (num(sum) >= 0 ? sum * RESERVE : NAN);
  const psuPick = sum => { const n = psuNeed(sum); if (!fin(n)) return NAN; const s = PSU_SIZES.find(x => x >= n - 1e-9); return s || NAN; };
  const psuUtil = (sum, psu) => (num(sum) >= 0 && num(psu) > 0 ? sum / psu * 100 : NAN);
  const inputPower = (pOut, effPct) => (num(pOut) >= 0 && num(effPct) > 0 && effPct <= 100 ? pOut / (effPct / 100) : NAN);
  const lossPower = (pOut, effPct) => { const i = inputPower(pOut, effPct); return fin(i) ? i - pOut : NAN; };
  /* PRUEFEN P6: Vereinfachtes Wärmemodell T = Umgebung + P · Rth (Rth in K/W, Wärmewiderstand des Kühlers). Alle elektrische Leistung des Prozessors wird zu Wärme. Ist dieses Modell für das 1.-2. Lehrjahr ausreichend? */
  const cpuTemp = (tamb, p, rth) => (fin(tamb) && num(p) >= 0 && num(rth) >= 0 ? tamb + p * rth : NAN);
  const THROTTLE = 90; /* °C, Übungswert für das Herunterregeln */

  /* ---------- Energie und Kosten ---------- */
  const kwh = (pW, hours) => (num(pW) >= 0 && num(hours) >= 0 ? pW * hours / 1000 : NAN);
  const costEUR = (kwhV, ctPerKwh) => (num(kwhV) >= 0 && num(ctPerKwh) >= 0 ? kwhV * ctPerKwh / 100 : NAN);
  const yearCost = (pW, hPerDay, days, ct) => costEUR(kwh(pW, hPerDay) * days, ct);

  /* ---------- Bauteil-Datenbank für den Konfigurator (Übungswerte, neutrale Namen) ---------- */
  /* PRUEFEN P7: Die Bauteile sind frei erfundene Übungsprodukte. Sockel und Speichertypen sind realistisch kombiniert (AM4/DDR4, AM5/DDR5, LGA 1700 mit DDR4- oder DDR5-Mainboards, LGA 1200/DDR4); Zusatzlast 50 W (Mainboard, Laufwerke, Lüfter) plus 4 W je RAM-Riegel. Passt das für den Unterricht? */
  const OVERHEAD = 50, RAM_W = 4;
  const CPUS = [
    { id: 'c1', l: 'A', sock: 'AM4', ram: ['DDR4'], tdp: 65 },
    { id: 'c2', l: 'B', sock: 'AM5', ram: ['DDR5'], tdp: 105 },
    { id: 'c3', l: 'C', sock: 'LGA 1700', ram: ['DDR4', 'DDR5'], tdp: 125 },
    { id: 'c4', l: 'D', sock: 'LGA 1200', ram: ['DDR4'], tdp: 95 }
  ];
  const MBS = [
    { id: 'b1', l: 'A', sock: 'AM4', ram: 'DDR4', ff: 'ATX', max: 128 },
    { id: 'b2', l: 'B', sock: 'AM5', ram: 'DDR5', ff: 'ATX', max: 192 },
    { id: 'b3', l: 'C', sock: 'AM5', ram: 'DDR5', ff: 'mATX', max: 128 },
    { id: 'b4', l: 'D', sock: 'LGA 1700', ram: 'DDR4', ff: 'ATX', max: 128 },
    { id: 'b5', l: 'E', sock: 'LGA 1700', ram: 'DDR5', ff: 'ITX', max: 64 },
    { id: 'b6', l: 'F', sock: 'LGA 1200', ram: 'DDR4', ff: 'mATX', max: 64 }
  ];
  const RAMS = [
    { id: 'r1', type: 'DDR4', gib: 16, mods: 2 }, { id: 'r2', type: 'DDR4', gib: 32, mods: 2 }, { id: 'r3', type: 'DDR5', gib: 32, mods: 2 },
    { id: 'r4', type: 'DDR5', gib: 64, mods: 2 }, { id: 'r5', type: 'DDR4', gib: 128, mods: 4 }, { id: 'r6', type: 'DDR5', gib: 128, mods: 4 }
  ];
  const GPUS = [
    { id: 'g0', l: '-', tdp: 0, len: 0 }, { id: 'g1', l: 'A', tdp: 75, len: 170 }, { id: 'g2', l: 'B', tdp: 200, len: 280 }, { id: 'g3', l: 'C', tdp: 320, len: 330 }
  ];
  const ALL_SOCK = ['AM4', 'AM5', 'LGA 1700', 'LGA 1200'];
  const COOLS = [
    { id: 'k1', n: 'Low-Profile-Kühler', tdp: 45, h: 37, socks: ALL_SOCK },
    { id: 'k2', n: 'Boxed-Kühler', tdp: 65, h: 55, socks: ALL_SOCK },
    { id: 'k3', n: 'Towerkühler mittel', tdp: 150, h: 155, socks: ALL_SOCK },
    { id: 'k4', n: 'Towerkühler groß', tdp: 220, h: 165, socks: ['AM4', 'AM5', 'LGA 1700'] }
  ];
  const PSUS = [350, 450, 550, 650, 750, 850, 1000].map(w => ({ id: 'p' + w, w }));
  const CASES = [
    { id: 't1', n: 'Midi-Tower', ff: ['ATX', 'mATX', 'ITX'], cool: 165, gpu: 350 },
    { id: 't2', n: 'Micro-Tower', ff: ['mATX', 'ITX'], cool: 160, gpu: 300 },
    { id: 't3', n: 'Mini-ITX-Gehäuse', ff: ['ITX'], cool: 70, gpu: 200 }
  ];
  const DB = { cpu: CPUS, mb: MBS, ram: RAMS, gpu: GPUS, cool: COOLS, psu: PSUS, case: CASES };
  const NAMES = {
    cpu: c => 'Prozessor ' + c.l + ' (Sockel ' + c.sock + ', ' + c.ram.join('/') + ', ' + c.tdp + ' W)',
    mb: b => 'Mainboard ' + b.l + ' (Sockel ' + b.sock + ', ' + b.ram + ', ' + b.ff + ', höchstens ' + b.max + ' GiB RAM)',
    ram: r => r.gib + ' GiB ' + r.type + ' (' + r.mods + ' Riegel)',
    gpu: g => (g.tdp ? 'Grafikkarte ' + g.l + ' (' + g.tdp + ' W, ' + g.len + ' mm lang)' : 'Keine Grafikkarte (Grafik im Prozessor)'),
    cool: k => k.n + ' (bis ' + k.tdp + ' W, ' + k.h + ' mm hoch' + (k.socks.length < 4 ? ', nur Sockel ' + k.socks.join(', ') : '') + ')',
    psu: p => 'Netzteil ' + p.w + ' W',
    case: c => c.n + ' (Mainboards ' + c.ff.join('/') + ', Kühler bis ' + c.cool + ' mm, Grafikkarte bis ' + c.gpu + ' mm)'
  };
  const SHORT = {
    cpu: c => 'Prozessor ' + c.l, mb: b => 'Mainboard ' + b.l, ram: r => r.gib + ' GiB ' + r.type, gpu: g => (g.tdp ? 'Grafikkarte ' + g.l : 'Keine Grafikkarte'),
    cool: k => k.n, psu: p => 'Netzteil ' + p.w + ' W', case: c => c.n
  };
  const part = (cat, id) => (DB[cat] || []).find(x => x.id === id) || null;
  const nameOf = (cat, id) => { const p = part(cat, id); return p ? NAMES[cat](p) : ''; };
  const shortOf = (cat, id) => { const p = part(cat, id); return p ? SHORT[cat](p) : ''; };
  /* Fehlerarten: Code, Verbindung in der Grafik, Kurzbeschreibung (für Auswahlaufgaben) */
  const CONFLICTS = {
    sock: { link: 'cpu-mb', t: 'Der Sockel von Prozessor und Mainboard passt nicht' },
    ram: { link: 'ram-mb', t: 'Der Speichertyp (DDR4 oder DDR5) passt nicht zum Mainboard' },
    ramMax: { link: 'ram-mb', t: 'Es steckt mehr Arbeitsspeicher im Rechner, als das Mainboard aufnehmen kann' },
    coolSock: { link: 'cool-cpu', t: 'Der Kühler lässt sich nicht auf dem Prozessorsockel befestigen' },
    coolTdp: { link: 'cool-cpu', t: 'Der Kühler schafft die Abwärme des Prozessors nicht' },
    ff: { link: 'mb-case', t: 'Das Mainboard passt nicht in das Gehäuse (Formfaktor)' },
    coolH: { link: 'cool-case', t: 'Der Kühler ist für das Gehäuse zu hoch' },
    gpuLen: { link: 'gpu-case', t: 'Die Grafikkarte ist für das Gehäuse zu lang' },
    psuLow: { link: 'psu-sys', t: 'Das Netzteil ist zu schwach' },
    psuMargin: { link: 'psu-sys', t: 'Das Netzteil hat zu wenig Reserve' }
  };
  const CONFLICT_ORDER = ['sock', 'ram', 'ramMax', 'coolSock', 'coolTdp', 'ff', 'coolH', 'gpuLen', 'psuLow', 'psuMargin'];
  /* Prüft eine Auswahl {cpu, mb, ram, gpu, cool, psu, case} (Ids). err = Konflikte (geht nicht), warn = knapp (geht, aber ohne Reserve).
     Der Speichercontroller sitzt im Prozessor: Prozessor und Mainboard müssen zum selben Sockel gehören, damit ist auch der Speichertyp des Mainboards passend zum Prozessor. */
  function checkBuild(sel) {
    const P = {}; let miss = false;
    Object.keys(DB).forEach(k => { P[k] = part(k, sel && sel[k]); if (!P[k]) miss = true; });
    if (miss) return { err: [], warn: [], watts: NAN, rec: NAN, links: {}, invalid: true };
    const err = [], warn = [], add = (list, k, t) => list.push({ k, link: CONFLICTS[k].link, t });
    if (P.cpu.sock !== P.mb.sock) add(err, 'sock', 'Der Prozessor hat den Sockel ' + P.cpu.sock + ', das Mainboard den Sockel ' + P.mb.sock + '.');
    if (P.ram.type !== P.mb.ram) add(err, 'ram', 'Der Arbeitsspeicher ist ' + P.ram.type + ', das Mainboard verlangt ' + P.mb.ram + '.');
    if (P.ram.gib > P.mb.max) add(err, 'ramMax', 'Der Arbeitsspeicher hat ' + P.ram.gib + ' GiB, das Mainboard nimmt höchstens ' + P.mb.max + ' GiB auf.');
    if (P.cool.socks.indexOf(P.cpu.sock) < 0) add(err, 'coolSock', 'Der Kühler ist nicht für den Sockel ' + P.cpu.sock + ' ausgelegt.');
    if (P.cool.tdp < P.cpu.tdp) add(err, 'coolTdp', 'Der Kühler ist für ' + P.cool.tdp + ' W ausgelegt, der Prozessor gibt ' + P.cpu.tdp + ' W ab.');
    if (P.case.ff.indexOf(P.mb.ff) < 0) add(err, 'ff', 'Das Mainboard hat das Format ' + P.mb.ff + ', das Gehäuse nimmt nur ' + P.case.ff.join(', ') + ' auf.');
    if (P.cool.h > P.case.cool) add(err, 'coolH', 'Der Kühler ist ' + P.cool.h + ' mm hoch, das Gehäuse erlaubt höchstens ' + P.case.cool + ' mm.');
    if (P.gpu.len > P.case.gpu) add(err, 'gpuLen', 'Die Grafikkarte ist ' + P.gpu.len + ' mm lang, das Gehäuse erlaubt höchstens ' + P.case.gpu + ' mm.');
    const watts = P.cpu.tdp + P.gpu.tdp + OVERHEAD + RAM_W * P.ram.mods, rec = watts * RESERVE;
    if (P.psu.w < watts - 1e-9) add(err, 'psuLow', 'Der Rechner braucht rechnerisch ' + fmtN(watts, 0) + ' W, das Netzteil liefert nur ' + P.psu.w + ' W.');
    else if (P.psu.w < rec - 1e-9) add(warn, 'psuMargin', 'Der Rechner braucht ' + fmtN(watts, 0) + ' W; mit 30 % Reserve wären es ' + fmtN(rec, 1) + ' W, das Netzteil liefert ' + P.psu.w + ' W.');
    const links = {}; warn.forEach(w => { links[w.link] = 'warn'; }); err.forEach(e => { links[e.link] = 'err'; });
    return { err, warn, watts, rec, links, ok: !err.length };
  }

  /* ---------- Diagnose-Entscheidungsbäume (Daten liegen in hwldata.js; hier nur die Logik) ---------- */
  /* tree = { start, nodes: { id: { q, chk, a: [{ t, to }] } }, leaves: { id: { cause, fix } } } */
  function treePath(tree, leafId) {
    if (!tree || !tree.leaves || !tree.leaves[leafId]) return null;
    const walk = (id, acc, depth) => {
      if (depth > 30) return null;
      if (tree.leaves[id]) return id === leafId ? acc : null;
      const nd = tree.nodes[id]; if (!nd) return null;
      for (let i = 0; i < nd.a.length; i++) { const r = walk(nd.a[i].to, acc.concat([{ id, i }]), depth + 1); if (r) return r; }
      return null;
    };
    return walk(tree.start, [], 0);
  }
  /* picks = Liste gewählter Antwortindizes ab dem Start; liefert die Schritte, den aktuellen Knoten und ob ein Ergebnis erreicht ist */
  function treeWalk(tree, picks) {
    let at = tree.start; const steps = [];
    for (const i of picks || []) {
      const nd = tree.nodes[at]; if (!nd || !nd.a[i]) break;
      steps.push({ id: at, i }); at = nd.a[i].to;
    }
    return { steps, at, leaf: !!tree.leaves[at] };
  }

  const API = { parseDe, fmtDe, fmtN, fmtDur, rd, num, ceilN, hashStr, rng, ri, pick, shuffle,
    UNITS, DEC, BIN, BIN_OF, convert, shown, addrBytes, addrBitsFor, lbaBytes, toBase, fromBase,
    mbitToMB, mbToMbit, xferSec, IFACES, ifaceOf, LANE_GBS, LANES, pcieRate, bottleneck,
    RAIDS, raidOf, raidOk, raidUsable, raidRaw, raidEff, raidTol, raidSurvives, raidDisksFor, raidWP,
    LOAD, RESERVE, PSU_SIZES, loadSum, psuNeed, psuPick, psuUtil, inputPower, lossPower, cpuTemp, THROTTLE,
    kwh, costEUR, yearCost,
    OVERHEAD, RAM_W, DB, NAMES, SHORT, part, nameOf, shortOf, CONFLICTS, CONFLICT_ORDER, checkBuild,
    treePath, treeWalk };
  root.HWL_CORE = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
