/* verbundnl.js - Hilfsbibliothek der Verbundprojekte: neutrale Netzliste (Netlist), Pin- und Footprint-Tabellen, Aequivalenzpruefung,
 * Netzliste -> Platine (PCB_CORE), Netzliste -> Simulationskern (LochSim), Logikauswertung, Teilerverhaeltnis.
 * Browser: window.VerbundNL (und Verbund.nl, falls Verbund da ist), Node: module.exports. Laeuft ohne Browser.
 * Benoetigt (nur wo gebraucht, beim Aufruf geladen): pcbcore.js (toBoard/fromBoard), simcore.js + simics.js (simulate, Logik mit ICs).
 *
 * Netlist = { v:1, name, parts:[ { ref, kind, value, pins:{ '1':'N3', ... }, fp?, label?, props? } ], nets:[ { name, cls:'power'|'signal', pins:['R1.2', ...] } ] }
 * Pin-Adresse: 'R1.2' (Bauteil.Anschluss). Anschlussnamen je Bauteilart: PINNAMES (Reihenfolge = Reihenfolge der Pins in KINDS des Schaltplans).
 * Optional je Bauteil: props { sw, pressed, pos, light, vr, n } (Schalterstellung, Poti-Stellung, Bauart, Pinzahl bei ICX/KL/SIP).
 * Alle Meldungen Deutsch. Die Funktionen werfen nie: Unsinn rein -> { ok:false, errs:[...] } bzw. leere Ergebnisse.
 * Annahmen sind mit (A) gekennzeichnet (Lehrwert, Abgleich mit Ausbilder offen). */
(function (root) {
'use strict';

const isO = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const isA = Array.isArray;
const isN = x => typeof x === 'number' && isFinite(x);
const S = x => (x === null || x === undefined ? '' : String(x));
const clone = o => JSON.parse(JSON.stringify(o));
const r3 = x => Math.round(x * 1000) / 1000;
const msgOf = e => (e && e.message ? e.message : String(e));
function natCmp(a, b) {
  const ma = /^(\D*)(\d*)(.*)$/.exec(S(a)), mb = /^(\D*)(\d*)(.*)$/.exec(S(b));
  if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1;
  const na = ma[2] === '' ? -1 : +ma[2], nb = mb[2] === '' ? -1 : +mb[2];
  if (na !== nb) return na < nb ? -1 : 1;
  return ma[3] < mb[3] ? -1 : ma[3] > mb[3] ? 1 : 0;
}

/* Kerne beim Aufruf holen (Browser: window.*, Node: require relativ zu dieser Datei) */
function dep(name, file) {
  if (root[name]) return root[name];
  try { if (typeof require === 'function') return require('./' + file); } catch (e) { /* nicht vorhanden */ }
  return null;
}
const PCB = () => dep('PCB_CORE', 'pcbcore.js');
const SIM = () => dep('LochSim', 'simcore.js');
const ICS = () => root.LochSimICs || (SIM() && SIM().ICS) || dep('LochSimICs', 'simics.js');

/* ====================================================================== Werte lesen und schreiben */
const MULT = { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, T: 1e12, R: 1, r: 1 };
/* num('4k7') = 4700, '100n', '2,2µ', '1M', '10R', '4.7k', '16MHz', '10mA', '5V'; sonst NaN */
function num(v) {
  if (isN(v)) return v;
  let s = S(v).trim().replace(/[µμ]/g, 'u').replace(/Ω/g, 'ohm').replace(/\s+/g, '');
  if (s === '') return NaN;
  const m = /^([+-]?\d*[.,]?\d+(?:e[+-]?\d+)?)([pnumkKMGTRr]?)(\d*)(ohm|Ohm|OHM|Hz|HZ|hz|V|A|F|H|W|s)?$/.exec(s);
  if (!m) return NaN;
  if (m[3] && !m[2]) return NaN;
  const base = parseFloat((m[3] ? m[1].split(/[.,]/)[0] + '.' + m[3] : m[1]).replace(',', '.'));
  const x = base * (m[2] ? MULT[m[2]] : 1);
  return isFinite(x) ? x : NaN;
}
/* fmt(4700) = '4k7', fmt(0.0001) = '100u' (Schreibweise wie auf Bauteilen, E-Reihen-tauglich bis 3 Stellen) */
function fmt(x) {
  if (!isN(x)) return '';
  if (x === 0) return '0';
  const ax = Math.abs(x), sign = x < 0 ? '-' : '';
  const L = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']];
  let u = L[L.length - 1];
  for (const e of L) { if (ax >= e[0] * 0.9995) { u = e; break; } }
  let q = Math.round(ax / u[0] * 1000) / 1000;
  if (q >= 1000 && u[1] !== 'G') { const i = L.indexOf(u); if (i > 0) { u = L[i - 1]; q = Math.round(ax / u[0] * 1000) / 1000; } }
  const t = String(q), ip = t.split('.')[0], fp = t.split('.')[1] || '';
  return sign + (u[1] && fp ? ip + u[1] + fp : ip + u[1]);
}

/* ====================================================================== Tabellen */
const T2 = ['1', '2'];
const seq = (n, p) => Array.from({ length: n }, (_, i) => (p || '') + (i + 1));
const PINNAMES = {
  R: T2, POT: ['A', 'B', 'W'], C: T2, CE: T2, L: T2, LDR: T2, LAMP: T2, D: ['A', 'K'], ZD: ['A', 'K'], LED: ['A', 'K'],
  NPN: ['B', 'C', 'E'], PNP: ['B', 'C', 'E'], BAT: ['+', '-'], AC: ['+', '-'], GND: ['1'],
  SPST: T2, PB: T2, SPDT: ['COM', 'NC', 'NO'], CABLE: T2, FUSE: T2, NTC: T2, PTC: T2, MOTOR: T2, SPK: T2,
  TRF: ['P1', 'P2', 'S1', 'S2'], RLY: ['A1', 'A2', 'COM', 'NO', 'NC'], SCHOTTKY: ['A', 'K'],
  NMOS: ['G', 'D', 'S'], PMOS: ['G', 'D', 'S'], DIAC: T2, TRIAC: ['MT1', 'MT2', 'G'], VDR: T2,
  SEG8D: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'K1', 'K2'], THY: ['A', 'K', 'G'], PHT: ['C', 'E'], OPTO: ['A', 'K', 'C', 'E'],
  NETZ: ['L', 'N', 'PE'], LSS: T2, RCD4: ['L1', 'L2', 'L3', 'N', 'L1o', 'L2o', 'L3o', 'No'], RCD: ['L', 'N', 'Lo', 'No'],
  SCHUETZ: ['A1', 'A2', 'K1a', 'K1b', 'K2a', 'K2b', 'K3a', 'K3b', 'K4a', 'K4b'],
  UNO: ['5V', '3V3', 'VIN', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].concat(seq(14, 'D').map((d, i) => 'D' + i), ['GND2', '5V2']),
  I2CTEMP: ['VCC', 'SDA', 'SCL', 'GND'], I2CLUX: ['VCC', 'SDA', 'SCL', 'GND'], MCP3008: seq(16), PI: seq(40),
  DUOLED: ['R', 'COM', 'G'], RGBLED: ['R', 'G', 'B', 'COM'], TMP36: ['VCC', 'OUT', 'GND'], PIEZO: ['+', '-'], TOUCH: ['1'],
  PIR: ['VCC', 'OUT', 'GND'], HCSR04: ['VCC', 'TRIG', 'ECHO', 'GND'], SERVO: ['SIG', 'V+', 'GND'], LCDI2C: ['GND', 'VCC', 'SDA', 'SCL'],
  NETZ3: ['L1', 'L2', 'L3', 'N', 'PE'], MOTOR3: ['U', 'V', 'W', 'PE'], BRUECKE: ['AC1', 'AC2', '+', '-'], REG: ['IN', 'GND', 'OUT'],
  XTAL: T2, SEG8: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp', 'K'], PBC: T2, KREUZ: ['1', '2', '3', '4'], IMP: ['A1', 'A2', 'K1', 'K2'],
  HEAT: ['1', '2', 'PE'], SD: ['L', 'N', 'PE'], JUN5: seq(5), FAULT: T2,
  AND: ['A', 'B', 'Y'], NAND: ['A', 'B', 'Y'], OR: ['A', 'B', 'Y'], NOR: ['A', 'B', 'Y'], XOR: ['A', 'B', 'Y'], NOT: ['A', 'Y'], SNOT: ['A', 'Y'],
  DFF: ['D', 'CLK', 'Q', 'QN'], OPA: ['IN+', 'IN-', 'OUT', 'V+', 'V-'], ICX: null, VM: ['+', '-'], AM: ['+', '-'], OHM: T2, ISO: T2, ZS: T2,
  CLK: ['+', '-'], JKFF: ['J', 'CLK', 'K', 'Q', 'QN'], TFF: ['T', 'CLK', 'Q', 'QN'], CPU: seq(16),
  KL: null, SIP: null     /* Klemme / Stiftleiste mit props.n Anschluessen (Standard 2), Namen '1'..'n' */
};
/* Kern-Art im Rechenkern (simcore.js): [core-Schluessel, vr, map]. map[j] = Index des Netzlisten-Pins, der Kern-Pin j ist (wie KINDS.map) */
const CORE = {
  R: ['R'], POT: ['P', null, [0, 2, 1]], C: ['C'], CE: ['CE'], L: ['L'], LDR: ['LDR'], LAMP: ['LAMP'], D: ['D'], ZD: ['ZD'], LED: ['LED'],
  NPN: ['T', 'npn-cbe', [1, 0, 2]], PNP: ['T', 'pnp-cbe', [1, 0, 2]], BAT: ['BAT'], AC: ['SIG', 'sin'], GND: [null],
  SPST: ['SPST'], PB: ['SW'], SPDT: ['SCH', null, [1, 0, 2]], CABLE: ['CABLE'], FUSE: ['FUSE'], NTC: ['NTC'], PTC: ['PTC'], MOTOR: ['MOTOR'], SPK: ['SPK'],
  TRF: ['TRF'], RLY: ['RLY'], SCHOTTKY: ['SCHOTTKY'], NMOS: ['NMOS'], PMOS: ['PMOS'], DIAC: ['DIAC'], TRIAC: ['TRIAC'], VDR: ['VDR'],
  SEG8D: ['SEG8D', 'k'], THY: ['THY'], PHT: ['PHT'], OPTO: ['OPTO'], NETZ: ['NETZ', 'ac'], LSS: ['LSS'], RCD4: ['RCD4'], RCD: ['RCD'], SCHUETZ: ['SCHUETZ'],
  UNO: ['MCU'], I2CTEMP: ['I2CTEMP'], I2CLUX: ['I2CLUX'], MCP3008: ['MCP3008'], PI: ['PI40'], DUOLED: ['DUOLED'], RGBLED: ['RGBLED'],
  TMP36: ['TMP36'], PIEZO: ['PIEZO'], TOUCH: ['TOUCH'], PIR: ['PIR'], HCSR04: ['HCSR04'], SERVO: ['SERVO'], LCDI2C: ['LCDI2C'],
  NETZ3: ['NETZ3'], MOTOR3: ['MOTOR3'], BRUECKE: ['BRUECKE'], REG: ['U'], XTAL: ['XTAL'], SEG8: ['SEG8', 'k'], PBC: ['SWNC'], KREUZ: ['KREUZ'], IMP: ['IMP'],
  HEAT: ['LAMP'], SD: ['SD'], JUN5: ['JUN'], FAULT: ['FAULT'], AND: ['GATE', 'and'], NAND: ['GATE', 'nand'], OR: ['GATE', 'or'], NOR: ['GATE', 'nor'],
  XOR: ['GATE', 'xor'], NOT: ['GATE', 'not'], SNOT: ['GATE', 'snot'], DFF: ['DFF'], OPA: ['OPA'], ICX: ['IC'], VM: ['VM'], AM: ['AM'], OHM: ['VM'], ISO: ['VM'], ZS: ['VM'],
  CLK: ['CLK'], JKFF: ['JKFF'], TFF: ['TFF'], CPU: ['IC']
};
/* Standardwerte wie KINDS.v im Schaltplan */
const DEFV = {
  R: '1k', POT: '10k', C: '1u', CE: '100u', L: '10m', LAMP: '6V 0.1A', D: '1N4148', ZD: '5.1', LED: 'rot', NPN: 'BC547', PNP: 'BC557', BAT: '9', AC: '5V 1kHz',
  CABLE: '1.5mm2 20m', FUSE: '250mA', NTC: '10k', PTC: '100', MOTOR: '6V', SPK: '8', TRF: '230V:12V', RLY: '12V', SCHOTTKY: '1N5819', NMOS: 'IRLZ44N', PMOS: 'IRF9540',
  DIAC: '32V', TRIAC: 'BT136', VDR: '275V', SEG8D: 'rot', THY: 'TIC106', OPTO: 'PC817', NETZ: '230V', LSS: 'B16', SCHUETZ: '230V', NETZ3: '400V', MOTOR3: '400V 2.2kW',
  REG: '7805', XTAL: '4.1943M', SEG8: 'rot', IMP: '230V', HEAT: '230V 2000W', SD: '1000W', FAULT: '0.05', AND: '5V', NAND: '5V', OR: '5V', NOR: '5V', XOR: '5V', NOT: '5V',
  SNOT: '5V', DFF: '5V', OPA: 'LM358', ICX: 'NE555', CLK: '1Hz', JKFF: '5V', TFF: '5V', CPU: 'CPU4', DUOLED: 'Kathode', RGBLED: 'Kathode', RCD: '30mA', RCD4: '30mA'
};
/* Bauteile, die auf der Platine nicht vorkommen (Quellen, Messgeraete, Schalter, Lasten, fertige Module): toBoard und equiv(preset:'board') ueberspringen sie */
const OFFBOARD = ['BAT', 'AC', 'GND', 'NETZ', 'NETZ3', 'CLK', 'VM', 'AM', 'OHM', 'ISO', 'ZS', 'SPST', 'SPDT', 'PBC', 'KREUZ', 'IMP', 'MOTOR', 'MOTOR3', 'LAMP', 'HEAT', 'SD',
  'SPK', 'UNO', 'PI', 'SERVO', 'LCDI2C', 'PIR', 'HCSR04', 'TMP36', 'PIEZO', 'TOUCH', 'I2CTEMP', 'I2CLUX', 'FAULT', 'CABLE', 'JUN5', 'LSS', 'RCD', 'RCD4', 'SCHUETZ'];
/* Zweipolige Bauteile mit austauschbaren Anschluessen (Aequivalenz: Pin 1 und 2 duerfen vertauscht sein) */
const SYMMETRIC = ['R', 'C', 'L', 'FUSE', 'SPK', 'XTAL', 'LDR', 'NTC', 'PTC', 'VDR', 'CABLE', 'FAULT', 'SPST', 'PB', 'PBC', 'LAMP', 'DIAC', 'LSS', 'OHM', 'ISO', 'ZS'];
const GATE2 = { AND: 'and', NAND: 'nand', OR: 'or', NOR: 'nor', XOR: 'xor' };
const GATE1 = { NOT: 'not', SNOT: 'not' };

/* Footprints: Bauteilart -> Kandidaten { fp, map:{Anschluss:Pad|[Pads]} | fn(part), smd?, req?, stand? }.
   Die Auswahl nimmt den ersten Kandidaten, den PCB_CORE.footprints kennt (THT vor SMD, opts.pkg:'smd' umgekehrt).
   req = vom Leiterplatten-Lab erbeten, falls (noch) nicht vorhanden; stand = Notbehelf. Belegungen aus den Datenblaettern der Lab-Bibliothek (dslib-*.js): */
const TO92_CBE = { 1: 'C', 2: 'B', 3: 'E' };       // BC547, BC557, BC337, BC327 (Datenblatt TF-BC547: 1 C, 2 B, 3 E)
const BIPOLAR = part => {
  const v = S(part && part.value).toUpperCase();
  if (/^2N39(04|06)|^2N22(22|19)/.test(v)) return { E: '1', B: '2', C: '3' };    // (A) Auswahl 2N3904/2N3906: E-B-C (Standard-Belegung, nicht im Lab-Datenblatt)
  return { C: '1', B: '2', E: '3' };
};
const MOSFET92 = part => (/BS170|BS250/i.test(S(part && part.value)) ? { D: '1', G: '2', S: '3' } /* (A) */ : { S: '1', G: '2', D: '3' });   // 2N7000: 1 S, 2 G, 3 D (Datenblatt TF-2N7000)
const SMALLFET = /^(2N7000|BS170|BS250)/i;       // kleine MOSFETs im TO-92, sonst TO-220
const ID12 = { '1': '1', '2': '2' };
const DIODE = { A: '2', K: '1' };
const FPMAP = {
  R: [{ fp: 'R_AXIAL_10', map: ID12 }, { fp: 'R_AXIAL_7', map: ID12 }, { fp: 'R0805', map: ID12, smd: 1 }, { fp: 'R0603', map: ID12, smd: 1 }],
  C: [{ fp: 'C_RADIAL_2.5', map: ID12 }, { fp: 'C0805', map: ID12, smd: 1 }, { fp: 'C0603', map: ID12, smd: 1 }],
  CE: [{ fp: 'C_RADIAL_2.5', map: ID12, big: 0 }, { fp: 'C_RADIAL_5', map: ID12, big: 1 }],       // Anschluss '1' = Plus
  L: [{ fp: 'R_AXIAL_10', map: ID12, stand: 1 }],
  D: [{ fp: 'D_DO41', map: DIODE, req: 1 }, { fp: 'SOD-123', map: DIODE, smd: 1 }],
  ZD: [{ fp: 'D_DO41', map: DIODE, req: 1 }, { fp: 'SOD-123', map: DIODE, smd: 1 }],
  SCHOTTKY: [{ fp: 'D_DO41', map: DIODE, req: 1 }, { fp: 'SOD-123', map: DIODE, smd: 1 }],
  LED: [{ fp: 'LED_5MM', map: DIODE }, { fp: 'LED0603', map: DIODE, smd: 1 }],
  NPN: [{ fp: 'TO-92', map: BIPOLAR }, { fp: 'SOT-23', map: { B: '1', E: '2', C: '3' }, smd: 1 }],
  PNP: [{ fp: 'TO-92', map: BIPOLAR }, { fp: 'SOT-23', map: { B: '1', E: '2', C: '3' }, smd: 1 }],
  NMOS: [{ fp: 'TO-220', map: { G: '1', D: '2', S: '3' }, unless: SMALLFET }, { fp: 'TO-92', map: MOSFET92, when: SMALLFET }],    // IRLZ34-Datenblatt: 1 G, 2 D, 3 S
  PMOS: [{ fp: 'TO-220', map: { G: '1', D: '2', S: '3' }, unless: SMALLFET }, { fp: 'TO-92', map: MOSFET92, when: SMALLFET }],
  REG: [{ fp: 'TO-220', map: { IN: '1', GND: '2', OUT: '3' } }],
  PB: [{ fp: 'SWITCH_6MM', map: { '1': '1', '2': '3' } }],
  RLY: [{ fp: 'RELAY_SRD', map: { A1: '1', A2: '2', COM: '3', NO: '4', NC: '5' }, req: 1 }],       // Pad-Nummern so mit Paket A3 vereinbart (A)
  XTAL: [{ fp: 'XTAL_HC49', map: ID12, req: 1 }, { fp: 'HDR_1x2', map: ID12, stand: 1 }],
  SEG8: [{ fp: 'SEG7_10', map: { e: '1', d: '2', K: ['3', '8'], c: '4', dp: '5', b: '6', a: '7', f: '9', g: '10' }, req: 1 }],     // (A) gaengige 10-Pin-Norm wie im LochLab
  LDR: [{ fp: 'HDR_1x2', map: ID12, stand: 1 }], NTC: [{ fp: 'HDR_1x2', map: ID12, stand: 1 }], PTC: [{ fp: 'HDR_1x2', map: ID12, stand: 1 }],
  KL: [{ fp: 'TERMINAL_$n', map: 'seq', req: 1 }, { fp: 'HDR_1x$n', map: 'seq', stand: 1 }],
  SIP: [{ fp: 'HDR_1x$n', map: 'seq' }, { fp: 'HDR_2x5', map: 'seq', only: 10 }],
  ICX: [{ fp: 'DIP-$n', map: 'seq' }], CPU: [{ fp: 'DIP-16', map: 'seq' }], MCP3008: [{ fp: 'DIP-16', map: 'seq' }]
};
/* vom Leiterplatten-Lab erbetene Footprints (Pad-Nummer = Anschlussnummer in der Reihenfolge der Tabellen oben) */
const FP_REQUESTS = ['D_DO41', 'RELAY_SRD', 'XTAL_HC49', 'SEG7_10', 'TERMINAL_2', 'TERMINAL_3'];

const dynKinds = { ICX: 1, KL: 1, SIP: 1 };
const PINCOUNT = {};
Object.keys(PINNAMES).forEach(k => { if (PINNAMES[k]) PINCOUNT[k] = PINNAMES[k].length; });
function icNp(value) {
  const I = ICS(); if (!I) return null;
  const d = I.find(value); return d ? I.CATALOG[d.key].np : null;
}
function pinNamesOf(part) {
  if (!part || !isO(part)) return [];
  const k = S(part.kind);
  if (k === 'ICX') {
    const pr = part.props && isN(part.props.n) ? part.props.n : null;
    const np = pr || icNp(part.value) || maxNumPin(part) || 8; return seq(np);
  }
  if (k === 'KL' || k === 'SIP') return seq((part.props && isN(part.props.n) ? part.props.n : 0) || maxNumPin(part) || 2);
  if (k === 'LAMP' && /230\s*V/i.test(S(part.value))) return ['1', '2', 'PE'];
  return PINNAMES[k] ? PINNAMES[k].slice() : [];
}
function maxNumPin(part) {
  let m = 0; Object.keys(part.pins || {}).forEach(p => { if (/^\d+$/.test(p)) m = Math.max(m, +p); }); return m;
}
const pinNames = (kind, part) => pinNamesOf(Object.assign({ value: '' }, part || {}, { kind }));
const pinCount = (kind, part) => pinNames(kind, part).length;
function labelsOf(part) {            // Gehaeusebeschriftung eines ICX
  const I = ICS(); if (!I) return null;
  const d = I.find(part.value); return d ? I.CATALOG[d.key].labels : null;
}
/* Anschluss eines Bauteils kanonisch benennen (Gross-/Kleinschreibung, IC-Beschriftung wie '1Y' oder 'VDD'); null = gibt es nicht */
function resolvePin(part, name) {
  name = S(name).trim(); if (name === '') return null;
  const names = pinNamesOf(part);
  if (names.includes(name)) return name;
  const ci = names.find(n => n.toLowerCase() === name.toLowerCase()); if (ci) return ci;
  if (part.kind === 'ICX' || part.kind === 'CPU') {
    const L = part.kind === 'CPU' ? (ICS() && ICS().CATALOG.cpu4.labels) : labelsOf(part);
    if (L) {
      const hit = []; L.forEach((l, i) => { if (l.toLowerCase() === name.toLowerCase() && l !== 'NC') hit.push(i + 1); });
      if (hit.length === 1) return String(hit[0]);
    }
  }
  return null;
}
function parseAddr(a) {
  a = S(a); const i = a.indexOf('.');
  return i < 1 ? null : { ref: a.slice(0, i), pin: a.slice(i + 1) };
}
const addr = (ref, pin) => ref + '.' + pin;

/* ====================================================================== Normalisieren und pruefen */
const POWERN = /^(GND|VCC|VDD|VSS|VBAT|VIN|V\+|V-|V\d+|AGND|0V|\+\d+V\d*)$/i;
/* normalize(src, {lenient}) -> { ok, nl, errs, warns }. Macht die Netzliste eindeutig und sortiert (gleiche Schaltung = gleicher Text). */
function normalize(src, o) {
  o = o || {};
  const errs = [], warns = [];
  if (!isO(src) || !isA(src.parts)) return { ok: false, nl: null, errs: ['Netzliste fehlt oder hat keine Bauteilliste.'], warns };
  const parts = [], byRef = new Map(), gndNets = [];
  src.parts.forEach((p, i) => {
    if (!isO(p)) { errs.push('Bauteil ' + (i + 1) + ' ist ungültig.'); return; }
    const ref = S(p.ref).trim(), kind0 = S(p.kind).trim(), kind = PINNAMES[kind0] !== undefined ? kind0 : (PINNAMES[kind0.toUpperCase()] !== undefined ? kind0.toUpperCase() : kind0);
    if (ref === '' || /[\s.]/.test(ref)) { errs.push('Bauteil ' + (i + 1) + ': Bezeichnung "' + ref + '" ist leer oder enthält Leerzeichen/Punkt.'); return; }
    if (byRef.has(ref)) { errs.push('Bezeichnung ' + ref + ' kommt doppelt vor.'); return; }
    const q = { ref, kind, value: S(p.value), pins: {} };
    if (p.fp !== undefined && p.fp !== null) q.fp = S(p.fp);
    if (p.label) q.label = S(p.label);
    if (isO(p.props)) q.props = clone(p.props);
    if (!(kind in PINNAMES)) {
      if (!o.lenient) { errs.push(ref + ': unbekannte Bauteilart "' + kind0 + '".'); return; }
      warns.push(ref + ': unbekannte Bauteilart "' + kind0 + '".');
    }
    byRef.set(ref, q);
    if (kind === 'GND') { Object.keys(isO(p.pins) ? p.pins : {}).forEach(k => { if (S(p.pins[k])) gndNets.push(S(p.pins[k])); }); return; }
    parts.push({ q, rawPins: isO(p.pins) ? p.pins : {} });
  });
  /* Netzzuordnung sammeln: pin -> Netz, aus part.pins und nets[].pins */
  const P = new Map(), uf = new Map();
  const find = x => { if (!uf.has(x)) uf.set(x, x); let r = x; while (uf.get(r) !== r) r = uf.get(r); return r; };
  gndNets.forEach(n => { uf.set(find(n), find('GND')); });
  const setPin = (a, net, from) => {
    if (net === '') return;
    if (P.has(a) && P.get(a) !== net) {
      if (find(P.get(a)) !== find(net)) errs.push('Anschluss ' + a + ' steht in zwei Netzen (' + P.get(a) + ' und ' + net + ').');
      return;
    }
    P.set(a, net);
  };
  const resolveAddr = (a, ctx) => {
    const pa = parseAddr(a); if (!pa) { errs.push(ctx + ': Anschluss "' + a + '" ist keine Adresse (Bauteil.Anschluss).'); return null; }
    const q = byRef.get(pa.ref);
    if (!q) { errs.push(ctx + ': Bauteil ' + pa.ref + ' gibt es nicht.'); return null; }
    if (q.kind === 'GND') return null;
    const pin = resolvePin(q, pa.pin);
    if (pin === null) {
      if (o.lenient) { warns.push(ctx + ': ' + pa.ref + ' hat keinen Anschluss "' + pa.pin + '".'); return addr(pa.ref, pa.pin); }
      errs.push(ctx + ': ' + pa.ref + ' (' + q.kind + ') hat keinen Anschluss "' + pa.pin + '".'); return null;
    }
    return addr(pa.ref, pin);
  };
  parts.forEach(({ q, rawPins }) => {
    Object.keys(rawPins).forEach(k => {
      const net = S(rawPins[k]).trim(); if (net === '') return;
      const a = resolveAddr(addr(q.ref, k), q.ref); if (a) setPin(a, net, 'part');
    });
  });
  (isA(src.nets) ? src.nets : []).forEach((n, i) => {
    if (!isO(n)) { errs.push('Netz ' + (i + 1) + ' ist ungültig.'); return; }
    const name = S(n.name).trim(); if (name === '') { errs.push('Netz ' + (i + 1) + ' hat keinen Namen.'); return; }
    (isA(n.pins) ? n.pins : []).forEach(a0 => { const a = resolveAddr(a0, 'Netz ' + name); if (a) setPin(a, name, 'net'); });
  });
  /* Netze zusammensetzen (GND-Symbole verschmelzen ihre Netze zu GND) */
  const netPins = new Map(), cls = new Map();
  (isA(src.nets) ? src.nets : []).forEach(n => { if (isO(n) && S(n.name).trim()) cls.set(find(S(n.name).trim()), n.cls === 'power' || n.cls === 'signal' ? n.cls : null); });
  P.forEach((net, a) => { const f = find(net); if (!netPins.has(f)) netPins.set(f, []); netPins.get(f).push(a); });
  const nets = [...netPins.keys()].sort(natCmp).map(name => {
    const pins = netPins.get(name).sort((x, y) => { const a = parseAddr(x), b = parseAddr(y); return a.ref === b.ref ? natCmp(a.pin, b.pin) : natCmp(a.ref, b.ref); });
    let c = cls.get(name); if (!c) c = POWERN.test(name) ? 'power' : 'signal';
    return { name, cls: c, pins };
  });
  const netOfPin = new Map(); nets.forEach(n => n.pins.forEach(a => netOfPin.set(a, n.name)));
  const outParts = parts.map(x => x.q).sort((a, b) => natCmp(a.ref, b.ref));
  outParts.forEach(q => {
    q.pins = {};
    const names = pinNamesOf(q);
    names.forEach(pn => { const n = netOfPin.get(addr(q.ref, pn)); if (n) q.pins[pn] = n; });
    if (o.lenient) netOfPin.forEach((n, a) => { const pa = parseAddr(a); if (pa.ref === q.ref && !(pa.pin in q.pins)) q.pins[pa.pin] = n; });
    const open = names.filter(pn => !(pn in q.pins));
    if (open.length && o.warnOpen) warns.push(q.ref + ': nicht angeschlossen: ' + open.join(', '));
  });
  nets.forEach(n => { if (n.pins.length === 1 && !POWERN.test(n.name) && o.warnSingle !== false) warns.push('Netz ' + n.name + ' hat nur einen Anschluss (' + n.pins[0] + ').'); });
  const nl = { v: 1, name: S(src.name), parts: outParts, nets };
  return { ok: errs.length === 0, nl: errs.length ? null : nl, errs, warns };
}
function validate(nl, o) { const r = normalize(nl, o); return r.errs.slice(); }
/* nur Anschluesse, die an keinem Netz haengen: [ 'Q1.B', ... ] */
function floating(nl) {
  const out = [];
  (nl && isA(nl.parts) ? nl.parts : []).forEach(p => pinNamesOf(p).forEach(pn => { if (!(p.pins && p.pins[pn])) out.push(addr(p.ref, pn)); }));
  return out;
}

/* ====================================================================== Abfragen */
function index(nl) {
  const ix = { net: new Map(), byName: new Map(), part: new Map() };
  if (!nl) return ix;
  (isA(nl.parts) ? nl.parts : []).forEach(p => { if (isO(p)) ix.part.set(p.ref, p); });
  (isA(nl.nets) ? nl.nets : []).forEach(n => {
    if (!isO(n)) return;
    ix.byName.set(n.name, n);
    (isA(n.pins) ? n.pins : []).forEach(a => ix.net.set(a, n.name));
  });
  return ix;
}
function canonAddr(ix, a) {
  const pa = parseAddr(a); if (!pa) return S(a);
  const p = ix.part.get(pa.ref); if (!p) return S(a);
  const pin = resolvePin(p, pa.pin); return pin === null ? S(a) : addr(pa.ref, pin);
}
function netOf(nl, a) { const ix = index(nl), n = ix.net.get(canonAddr(ix, a)); return n === undefined ? null : n; }
function netPinsOf(nl, name) { const n = index(nl).byName.get(name); return n ? n.pins.slice() : []; }
function same(nl, a, b) {
  const ix = index(nl), x = canonAddr(ix, a), y = canonAddr(ix, b);
  if (x === y) return ix.net.has(x);
  const nx = ix.net.get(x); return nx !== undefined && nx === ix.net.get(y);
}
function partsOf(nl, sel) {
  const L = nl && isA(nl.parts) ? nl.parts : [];
  if (sel === undefined || sel === null) return L.slice();
  if (typeof sel === 'function') return L.filter(sel);
  const set = new Set(isA(sel) ? sel : [sel]); return L.filter(p => set.has(p.kind));
}
const partOf = (nl, ref) => index(nl).part.get(ref) || null;
function others(nl, a) {      // alle anderen Anschluesse im selben Netz
  const ix = index(nl), x = canonAddr(ix, a), n = ix.net.get(x); if (n === undefined) return [];
  return ix.byName.get(n).pins.filter(p => p !== x);
}
function bom(nl) {
  const m = new Map();
  partsOf(nl).forEach(p => { if (p.kind === 'GND') return; const k = p.kind + '|' + S(p.value); if (!m.has(k)) m.set(k, { kind: p.kind, value: S(p.value), refs: [] }); m.get(k).refs.push(p.ref); });
  return [...m.values()].map(e => ({ kind: e.kind, value: e.value, refs: e.refs.sort(natCmp), qty: e.refs.length })).sort((a, b) => natCmp(a.refs[0], b.refs[0]));
}

/* ====================================================================== Aufbau-Helfer (fuer Musterloesungen und Tests) */
function builder(name) {
  const parts = [], nets = new Map(), pinNet = new Map();
  let auto = 0;
  const b = {
    errors: [],
    add(ref, kind, value, props) {
      const p = { ref, kind, value: value === undefined || value === null ? S(DEFV[kind]) : S(value), pins: {} };
      if (isO(props)) { const pr = Object.assign({}, props); if (pr.fp) { p.fp = pr.fp; delete pr.fp; } if (Object.keys(pr).length) p.props = pr; }
      parts.push(p); return b;
    },
    net(nm, ...pins) {
      if (!nets.has(nm)) nets.set(nm, []);
      pins.forEach(a => { if (pinNet.has(a) && pinNet.get(a) !== nm) b.errors.push('Anschluss ' + a + ' steht schon in Netz ' + pinNet.get(a) + '.'); else if (!pinNet.has(a)) { pinNet.set(a, nm); nets.get(nm).push(a); } });
      return b;
    },
    wire(...pins) {
      let nm = null; pins.forEach(a => { if (!nm && pinNet.has(a)) nm = pinNet.get(a); });
      if (!nm) { do { nm = 'N' + (++auto); } while (nets.has(nm)); }
      return b.net(nm, ...pins);
    },
    gnd(...pins) { return b.net('GND', ...pins); },
    buildFull(o) {
      const r = normalize({ name, parts: parts.map(p => Object.assign({}, p)), nets: [...nets.entries()].map(([n, pins]) => ({ name: n, pins })) }, o);
      if (b.errors.length) { r.ok = false; r.nl = null; r.errs = b.errors.concat(r.errs); }
      return r;
    },
    build(o) { const r = b.buildFull(o); if (!r.ok) b.errors = r.errs.slice(); return r.nl; }
  };
  return b;
}

/* ====================================================================== Aequivalenz */
const NUMKINDS = new Set(['R', 'C', 'CE', 'L', 'POT', 'BAT', 'FUSE', 'NTC', 'PTC', 'SPK', 'XTAL', 'ZD']);
function sameValue(kind, a, b) {
  a = S(a).trim(); b = S(b).trim();
  if (a.toLowerCase() === b.toLowerCase()) return true;
  if (a === '' || b === '') return false;
  if (NUMKINDS.has(kind)) { const x = num(a), y = num(b); if (isN(x) && isN(y)) return Math.abs(x - y) <= 1e-6 * Math.max(Math.abs(x), Math.abs(y), 1e-30); }
  return false;
}
/* equiv(a, b, opts) -> { ok, errs:[..], notes:[..], stats }
   opts: refMap {refA:refB}, values (Standard true), ignoreKinds [..], preset 'board' (= OFFBOARD ueberspringen), extra 'error'|'allow' (Bauteile nur in b),
   missing 'error'|'allow' (Bauteile nur in a), swap (Standard true: R/C... Pin 1/2 vertauscht ist ok), names ['GND',..] (diese Netznamen muessen gleich belegt sein) */
function equiv(a, b, o) {
  o = o || {};
  const errs = [], notes = [];
  const A = normalize(a, { lenient: true, warnSingle: false }), B = normalize(b, { lenient: true, warnSingle: false });
  if (!A.ok) return { ok: false, errs: ['Netzliste A ist ungültig: ' + A.errs.join(' ')], notes, stats: {} };
  if (!B.ok) return { ok: false, errs: ['Netzliste B ist ungültig: ' + B.errs.join(' ')], notes, stats: {} };
  const ign = new Set(o.ignoreKinds || []); if (o.preset === 'board') OFFBOARD.forEach(k => ign.add(k));
  const ignRef = new Set(o.ignoreRefs || []);
  const rm = o.refMap || {}, back = {}; Object.keys(rm).forEach(k => { back[rm[k]] = k; });
  const pa = new Map(), pb = new Map();
  A.nl.parts.forEach(p => { if (!ign.has(p.kind) && !ignRef.has(p.ref)) pa.set(p.ref, p); });
  B.nl.parts.forEach(p => { if (!ign.has(p.kind) && !ignRef.has(p.ref)) pb.set(back[p.ref] || p.ref, p); });
  const common = [];
  pa.forEach((p, ref) => {
    const q = pb.get(ref);
    if (!q) { if (o.missing !== 'allow') errs.push('Bauteil ' + ref + ' (' + p.kind + ' ' + p.value + ') fehlt in B.'); else notes.push(ref + ' fehlt in B (erlaubt).'); return; }
    if (p.kind !== q.kind) { errs.push(ref + ': Bauteilart ' + p.kind + ' in A, aber ' + q.kind + ' in B.'); return; }
    if (o.values !== false && !sameValue(p.kind, p.value, q.value) && S(p.value) !== '' ) errs.push(ref + ': Wert ' + p.value + ' in A, aber ' + (S(q.value) || '(leer)') + ' in B.');
    common.push(ref);
  });
  pb.forEach((q, ref) => { if (!pa.has(ref)) { if (o.extra === 'allow') notes.push(ref + ' (' + q.kind + ') gibt es nur in B (erlaubt).'); else errs.push('Bauteil ' + ref + ' (' + q.kind + ' ' + q.value + ') gibt es nur in B.'); } });
  const cs = new Set(common);
  const pinsOfPart = ref => pinNamesOf(pa.get(ref));
  /* Netzzuordnung je Anschluss auf den gemeinsamen Bauteilen */
  const mapA = new Map(), mapB = new Map(), bOrient = new Map();
  A.nl.nets.forEach(n => n.pins.forEach(x => { const q = parseAddr(x); if (cs.has(q.ref)) mapA.set(x, n.name); }));
  B.nl.nets.forEach(n => n.pins.forEach(x => { const q = parseAddr(x), ra = back[q.ref] || q.ref; if (cs.has(ra)) mapB.set(addr(ra, q.pin), n.name); }));
  /* Fehlerzaehler fuer Vertauschungs-Optimierung: wie viele Netze sind in B zerrissen oder verschmolzen */
  const cost = () => {
    const ab = new Map(), ba = new Map();
    mapA.forEach((na, x) => { const nb = mapB.get(x); if (nb === undefined) return; if (!ab.has(na)) ab.set(na, new Set()); ab.get(na).add(nb); if (!ba.has(nb)) ba.set(nb, new Set()); ba.get(nb).add(na); });
    let c = 0; ab.forEach(s => { c += s.size - 1; }); ba.forEach(s => { c += s.size - 1; }); return c;
  };
  if (o.swap !== false) {
    let best = cost();
    for (let pass = 0; pass < 3 && best > 0; pass++) {
      let improved = false;
      common.forEach(ref => {
        const k = pa.get(ref).kind; if (!SYMMETRIC.includes(k)) return;
        const n = pinsOfPart(ref); if (n.length !== 2) return;
        const x1 = addr(ref, n[0]), x2 = addr(ref, n[1]), v1 = mapB.get(x1), v2 = mapB.get(x2);
        if (v1 === v2) return;
        const set = (v, w) => { if (v === undefined) mapB.delete(x1); else mapB.set(x1, v); if (w === undefined) mapB.delete(x2); else mapB.set(x2, w); };
        set(v2, v1); const c = cost();
        if (c < best) { best = c; improved = true; bOrient.set(ref, !bOrient.get(ref)); } else set(v1, v2);
      });
      if (!improved) break;
    }
    bOrient.forEach((sw, ref) => { if (sw) notes.push(ref + ': Anschlüsse 1 und 2 sind in B vertauscht (bei ' + pa.get(ref).kind + ' egal).'); });
  }
  /* Anschluss fuer Anschluss */
  const pinList = [...new Set([...mapA.keys(), ...mapB.keys()])].sort((x, y) => { const a1 = parseAddr(x), b1 = parseAddr(y); return a1.ref === b1.ref ? natCmp(a1.pin, b1.pin) : natCmp(a1.ref, b1.ref); });
  pinList.forEach(x => {
    const na = mapA.get(x), nb = mapB.get(x);
    if (na !== undefined && nb === undefined) errs.push(x + ': in A an Netz ' + na + ' angeschlossen, in B offen.');
    else if (na === undefined && nb !== undefined) errs.push(x + ': in B an Netz ' + nb + ' angeschlossen, in A offen.');
  });
  const grpA = new Map(), grpB = new Map();
  mapA.forEach((na, x) => { const nb = mapB.get(x); if (nb === undefined) return; if (!grpA.has(na)) grpA.set(na, new Map()); if (!grpA.get(na).has(nb)) grpA.get(na).set(nb, []); grpA.get(na).get(nb).push(x); if (!grpB.has(nb)) grpB.set(nb, new Map()); if (!grpB.get(nb).has(na)) grpB.get(nb).set(na, []); grpB.get(nb).get(na).push(x); });
  grpA.forEach((m, na) => { if (m.size > 1) errs.push('Netz ' + na + ' ist in B aufgetrennt: ' + [...m.entries()].map(([nb, pins]) => pins.join(', ') + ' an ' + nb).join(' | ') + '.'); });
  grpB.forEach((m, nb) => { if (m.size > 1) errs.push('In B sind verschiedene Netze verbunden (Kurzschluss): Netz ' + nb + ' enthält ' + [...m.entries()].map(([na, pins]) => pins.join(', ') + ' aus ' + na).join(' | ') + '.'); });
  (o.names || []).forEach(nm => {
    const x = A.nl.nets.find(n => n.name === nm); if (!x) return;
    const y = B.nl.nets.find(n => n.name === nm);
    if (!y) { errs.push('Netz ' + nm + ' gibt es in B nicht.'); return; }
    const sa = x.pins.filter(p => cs.has(parseAddr(p).ref)).sort().join(','), sb = y.pins.map(p => { const q = parseAddr(p); return addr(back[q.ref] || q.ref, q.pin); }).filter(p => cs.has(parseAddr(p).ref)).sort().join(',');
    if (sa !== sb) errs.push('Netz ' + nm + ' hat in B andere Anschlüsse als in A.');
  });
  return { ok: errs.length === 0, errs, notes, stats: { partsA: pa.size, partsB: pb.size, common: common.length, netsA: A.nl.nets.length, netsB: B.nl.nets.length } };
}

/* ====================================================================== Zusammenschluss */
/* merge(a, b, { tie:[[netOderPinA, netOderPinB], ..], share:['GND'], prefixB, name }) -> { ok, nl, errs, refB:{alt:neu}, netB:{alt:neu} }
   Gleichnamige Netze aus share werden verbunden, sonst bekommen Kollisionen ein Praefix (Standard 'B_'). tie verbindet je ein Netz aus a mit einem aus b. */
function merge(a, b, o) {
  o = o || {};
  const A = normalize(a, { lenient: true, warnSingle: false }), B = normalize(b, { lenient: true, warnSingle: false });
  if (!A.ok) return { ok: false, nl: null, errs: ['Netzliste A ist ungültig: ' + A.errs.join(' ')], refB: {}, netB: {} };
  if (!B.ok) return { ok: false, nl: null, errs: ['Netzliste B ist ungültig: ' + B.errs.join(' ')], refB: {}, netB: {} };
  const share = new Set(o.share || ['GND']), pre = S(o.prefixB || 'B_'), netPre = S(o.netPrefix || pre);
  const usedRef = new Set(A.nl.parts.map(p => p.ref)), refB = {}, netB = {}, errs = [];
  const parts = A.nl.parts.map(p => clone(p));
  B.nl.parts.forEach(p => {
    let nr = p.ref; if (usedRef.has(nr)) { nr = pre + p.ref; while (usedRef.has(nr)) nr += '_'; }
    usedRef.add(nr); refB[p.ref] = nr; const q = clone(p); q.ref = nr; q.pins = {}; parts.push(q);
  });
  const namesA = new Set(A.nl.nets.map(n => n.name)), used = new Set(namesA);
  const nets = A.nl.nets.map(n => ({ name: n.name, cls: n.cls, pins: n.pins.slice() }));
  const byName = new Map(nets.map(n => [n.name, n]));
  B.nl.nets.forEach(n => {
    let nn = n.name;
    if (namesA.has(nn) && !share.has(nn)) { nn = netPre + n.name; while (used.has(nn)) nn += '_'; }
    netB[n.name] = nn; used.add(nn);
    const pins = n.pins.map(x => { const q = parseAddr(x); return addr(refB[q.ref], q.pin); });
    if (byName.has(nn)) byName.get(nn).pins.push(...pins); else { const e = { name: nn, cls: n.cls, pins }; nets.push(e); byName.set(nn, e); }
  });
  const resolveIn = (spec, side) => {
    spec = S(spec);
    if (parseAddr(spec)) {
      const q = parseAddr(spec); const ref = side === 'b' ? refB[q.ref] : q.ref;
      const part = parts.find(p => p.ref === ref); if (!ref || !part) return null;
      const pin = resolvePin(part, q.pin); const hit = pin && nets.find(n => n.pins.includes(addr(ref, pin)));
      return hit ? hit.name : null;
    }
    if (side === 'b') return netB[spec] !== undefined ? netB[spec] : null;
    return byName.has(spec) ? spec : null;
  };
  (o.tie || []).forEach((t, i) => {
    const x = isA(t) ? t[0] : t && t.a, y = isA(t) ? t[1] : t && t.b;
    const na = resolveIn(x, 'a'), nb = resolveIn(y, 'b');
    if (na === null) { errs.push('tie ' + (i + 1) + ': "' + S(x) + '" gibt es in A nicht (oder ist nicht angeschlossen).'); return; }
    if (nb === null) { errs.push('tie ' + (i + 1) + ': "' + S(y) + '" gibt es in B nicht (oder ist nicht angeschlossen).'); return; }
    if (na === nb) return;
    const ea = byName.get(na), eb = byName.get(nb);
    ea.pins.push(...eb.pins); nets.splice(nets.indexOf(eb), 1); byName.delete(nb);
    Object.keys(netB).forEach(k => { if (netB[k] === nb) netB[k] = na; });
  });
  if (errs.length) return { ok: false, nl: null, errs, refB, netB };
  const r = normalize({ name: S(o.name || A.nl.name), parts, nets }, { lenient: true, warnSingle: false });
  return { ok: r.ok, nl: r.nl, errs: r.errs, refB, netB };
}

/* ====================================================================== Netzliste <-> Platine */
const expandN = (id, n) => id.replace('$n', String(n));
function nOf(part) { return pinNamesOf(part).length; }
/* waehlt Footprint + Anschluss->Pad-Zuordnung eines Bauteils: { fp, map, smd, stand, req } | null */
function fpOf(part, o) {
  o = o || {};
  const P = PCB(); if (!P) return null;
  const known = id => !!P.footprints[id];
  const names = pinNamesOf(part), n = names.length;
  const cands = (FPMAP[part.kind] || []).map(c => {
    const fp = expandN(c.fp, n);
    let map = c.map;
    if (map === 'seq') { map = {}; names.forEach((nm, i) => { map[nm] = String(i + 1); }); }
    else if (typeof map === 'function') map = map(part);
    return Object.assign({}, c, { fp, map });
  }).filter(c => !(c.only && c.only !== n) && (!c.when || c.when.test(S(part.value))) && (!c.unless || !c.unless.test(S(part.value))));
  const forced = (o.fp && o.fp[part.ref]) || part.fp;
  if (forced) {
    const c = cands.find(x => x.fp === forced);
    if (c && known(c.fp)) return c;
    if (known(forced)) {
      const f = P.footprints[forced];
      if (f.pads.length >= n) { const map = {}; names.forEach((nm, i) => { map[nm] = String(i + 1); }); return { fp: forced, map, generic: 1 }; }
    }
  }
  const pref = o.pkg === 'smd' ? c => (c.smd ? 0 : 1) : c => (c.smd ? 1 : 0);
  const big = part.kind === 'CE' && num(part.value) >= 220e-6;       // (A) ab 220 uF der groessere Elko
  const list = cands.map((c, i) => ({ c, i })).filter(x => known(x.c.fp)).sort((x, y) => (pref(x.c) - pref(y.c)) || (part.kind === 'CE' ? ((x.c.big ? 0 : 1) - (y.c.big ? 0 : 1)) * (big ? 1 : -1) : 0) || (x.c.stand ? 1 : 0) - (y.c.stand ? 1 : 0) || x.i - y.i);
  return list.length ? list[0].c : null;
}
/* toBoard(nl, opts) -> { ok, board, fpOf:{ref:fp}, placed:[ref], offboard:[ref], missing:[{ref,kind,want}], warnings:[..] }
   opts: w, h (mm; h fehlt = automatisch), layers (1|2), id, name, fp {ref:fpId}, at {ref:{x,y,rot}}, pkg 'tht'|'smd', margin, gap, offboard [kinds] */
function toBoard(nl, o) {
  o = o || {};
  const P = PCB(), warnings = [], missing = [], offboard = [], placed = [], fpMap = {};
  if (!P) return { ok: false, board: null, fpOf: fpMap, placed, offboard, missing, warnings: ['PCB_CORE (pcbcore.js) ist nicht geladen.'], errs: ['PCB_CORE fehlt'] };
  const N = normalize(nl, { lenient: true, warnSingle: false });
  if (!N.ok) return { ok: false, board: null, fpOf: fpMap, placed, offboard, missing, warnings, errs: N.errs };
  const off = new Set(o.offboard || OFFBOARD);
  const m = isN(o.margin) ? o.margin : 4, gap = isN(o.gap) ? o.gap : 2, W = isN(o.w) && o.w > 0 ? o.w : 100;
  const board = P.newBoard({ id: o.id || 'verbund', name: o.name || N.nl.name || 'Platine', w: W, h: isN(o.h) && o.h > 0 ? o.h : 100, layers: o.layers === 1 ? 1 : 2 });
  let x = m, y = m, rowH = 0, over = [];
  const padMap = {};       // ref -> { pin: [pads] }
  N.nl.parts.forEach((p, i) => {
    if (off.has(p.kind)) { offboard.push(p.ref); return; }
    const c = fpOf(p, o);
    if (!c) {
      const want = (FPMAP[p.kind] || []).filter(q => q.req).map(q => expandN(q.fp, nOf(p)))[0] || null;
      missing.push({ ref: p.ref, kind: p.kind, want }); warnings.push(p.ref + ' (' + p.kind + '): kein Footprint vorhanden' + (want ? ' (erbeten: ' + want + ')' : '') + ', Bauteil nicht platziert.'); return;
    }
    if (c.stand) warnings.push(p.ref + ' (' + p.kind + '): Notbehelf-Footprint ' + c.fp + '.');
    if (c.req === 1 && !PCB().footprints[c.fp]) warnings.push(p.ref + ': erbetener Footprint ' + c.fp + ' fehlt.');
    const fp = P.footprints[c.fp], cy = fp.courtyard;
    const pm = {}; Object.keys(c.map).forEach(k => { pm[k] = isA(c.map[k]) ? c.map[k] : [c.map[k]]; }); padMap[p.ref] = pm;
    let px, py, rot = 0;
    const at = o.at && o.at[p.ref];
    if (at) { px = at.x; py = at.y; rot = at.rot || 0; }
    else {
      if (x + cy.w > W - m && x > m) { x = m; y += rowH + gap; rowH = 0; }
      px = r3(x - cy.x); py = r3(y - cy.y); x += cy.w + gap; rowH = Math.max(rowH, cy.h);
      if (isN(o.h) && y + cy.h > o.h - m) over.push(p.ref);
    }
    board.parts.push({ id: 'p' + (board.parts.length + 1), ref: p.ref, fp: c.fp, value: S(p.value), x: px, y: py, rot, side: 'top' });
    fpMap[p.ref] = c.fp; placed.push(p.ref);
  });
  if (!isN(o.h) || !(o.h > 0)) board.h = Math.max(40, Math.ceil((y + rowH + m) / 5) * 5);
  if (over.length) warnings.push('Platine ' + W + ' × ' + o.h + ' mm ist zu klein: ' + over.join(', ') + ' liegen außerhalb.');
  board.nets = N.nl.nets.map(n => {
    const pins = []; n.pins.forEach(a => { const q = parseAddr(a), pm = padMap[q.ref]; if (!pm || !pm[q.pin]) return; pm[q.pin].forEach(pad => pins.push(addr(q.ref, pad))); });
    return { name: n.name, cls: n.cls, pins };
  }).filter(n => n.pins.length > 0);
  return { ok: true, board, fpOf: fpMap, placed, offboard, missing, warnings };
}
/* fromBoard(board, refNl) -> Netlist: Platine zurueck in Netzliste; Art/Anschlussnamen kommen aus refNl (gleiche Bezeichnung), sonst aus dem Footprint */
function fromBoard(board, refNl, o) {
  o = o || {};
  const P = PCB(); if (!P || !isO(board)) return null;
  const R = refNl ? normalize(refNl, { lenient: true, warnSingle: false }) : null, rix = R && R.ok ? index(R.nl) : index(null);
  const parts = [], padPin = {};
  (isA(board.parts) ? board.parts : []).forEach(bp => {
    const ref = S(bp.ref), rp = rix.part.get(ref);
    let kind = rp ? rp.kind : null;
    if (!kind) kind = /^HDR|^TERMINAL/.test(S(bp.fp)) ? 'KL' : /^DIP-/.test(S(bp.fp)) ? 'ICX' : 'R';
    const part = { ref, kind, value: S(bp.value), pins: {}, fp: S(bp.fp) };
    if (rp && rp.props) part.props = clone(rp.props);
    const names = pinNamesOf(rp ? Object.assign({}, rp, { value: rp.value }) : Object.assign({}, part, { props: { n: (P.footprints[bp.fp] ? P.footprints[bp.fp].pads.length : 2) } }));
    const c = fpOf(Object.assign({}, rp || part, { fp: S(bp.fp), ref }), { fp: { [ref]: S(bp.fp) } });
    const inv = {};
    if (c) Object.keys(c.map).forEach(k => (isA(c.map[k]) ? c.map[k] : [c.map[k]]).forEach(pad => { inv[pad] = k; }));
    else names.forEach((nm, i) => { inv[String(i + 1)] = nm; });
    padPin[ref] = inv; parts.push(part);
  });
  const nets = (isA(board.nets) ? board.nets : []).map(n => ({ name: n.name, cls: n.cls, pins: (isA(n.pins) ? n.pins : []).map(a => { const q = parseAddr(a); if (!q) return a; const pin = padPin[q.ref] && padPin[q.ref][q.pin]; return pin ? addr(q.ref, pin) : a; }) }));
  const r = normalize({ name: S(board.name), parts, nets }, { lenient: true, warnSingle: false });
  return r.ok ? r.nl : null;
}

/* ====================================================================== Netzliste -> Simulationskern */
function dcLevel(spec) {
  if (typeof spec === 'function') return spec;
  if (isN(spec)) return () => spec;
  if (isA(spec)) { const L = spec.slice().sort((a, b) => a[0] - b[0]); return t => { let v = L.length ? L[0][1] : 0; for (const e of L) { if (t >= e[0]) v = e[1]; else break; } return v; }; }
  if (isO(spec) && isN(spec.f)) {
    const hi = isN(spec.hi) ? spec.hi : isN(spec.v) ? spec.v : 5, lo = isN(spec.lo) ? spec.lo : 0, duty = isN(spec.duty) ? spec.duty : 0.5, t0 = isN(spec.t0) ? spec.t0 : 0;
    return t => { if (t < t0) return lo; const ph = ((t - t0) * spec.f) % 1; return ph < duty ? hi : lo; };
  }
  if (isO(spec) && isN(spec.v)) return () => spec.v;
  return () => 0;
}
/* toLayout(nl, opts) -> { ok, layout:{parts,tracks,wires,ground}, hubKey:{net:'x,y'}, partOf:{ref:corePart}, errs }
   Jedes Netz bekommt einen Knotenpunkt, jeder Pin einen eigenen Punkt mit Draht zum Netz (kein Raster, nur fuer den Rechenkern). */
function toLayout(nl, o) {
  o = o || {};
  const N = normalize(nl, { lenient: true, warnSingle: false });
  if (!N.ok) return { ok: false, layout: null, hubKey: {}, partOf: {}, errs: N.errs };
  const hubOf = new Map(); N.nl.nets.forEach((n, i) => hubOf.set(n.name, [i, 0]));
  const parts = [], wires = [], partOf = {}, errs = [];
  const sw = o.set || {};
  N.nl.parts.forEach((p, pi) => {
    const c = CORE[p.kind]; if (!c || !c[0]) return;
    const names = pinNamesOf(p), map = c[2] || names.map((_, i) => i);
    const pt = names.map((nm, j) => [1000 + pi, 1 + j]);
    names.forEach((nm, j) => { const net = p.pins[nm]; if (net) { const h = hubOf.get(net); wires.push({ x1: pt[j][0], y1: pt[j][1], x2: h[0], y2: h[1] }); } });
    const pr = Object.assign({}, p.props || {}, sw[p.ref] || {});
    const cp = { id: pi + 1, k: c[0], vr: pr.vr !== undefined ? pr.vr : c[1] || undefined, v: S(p.value) !== '' ? S(p.value) : S(DEFV[p.kind]), n: names.length,
      pins: map.map(i => pt[i]), sw: pr.sw ? 1 : 0, pos: isN(pr.pos) ? pr.pos : 0.5, light: isN(pr.light) ? pr.light : isN(pr.pos) ? pr.pos : 0.5, pressed: !!pr.pressed, rint: 0.01, item: {} };
    if (p.kind === 'CPU' || p.kind === 'ICX') cp.n = names.length;
    parts.push(cp); partOf[p.ref] = cp;
  });
  const gname = o.ground || 'GND', ground = [];
  if (hubOf.has(gname)) ground.push(hubOf.get(gname));
  const hubKey = {}; hubOf.forEach((h, n) => { hubKey[n] = h[0] + ',' + h[1]; });
  return { ok: true, layout: { parts, tracks: [], wires, ground }, hubKey, partOf, errs, nl: N.nl, hubOf };
}
/* simulate(nl, { drive, probe, T, dt, sample, set, ground }) -> { ok, T, steps, v:{netz:V}, i:{ref:A}, state:{ref:{..}}, series?, warnings, events, converged }
   drive: { netOderPin: Zahl | f(t) | [[t,V],..] | {f,hi,lo,duty} } speist das Netz ueber eine ideale Quelle (Innenwiderstand 1 mOhm) gegen GND;
   Batterien im Plan haben wie im Lab 0,6 Ohm (ueber 2 V) bzw. 0,3 Ohm, opts.ideal:true setzt alle Gleichspannungsquellen auf 1 mOhm.
   probe: Netze/Pins (Standard: alle Netze); sample: Abtastabstand in s -> series { t:[..], <Name>:[..] }; set: { ref:{sw,pos,pressed,light} }. Standard T = 0,05 s, dt = 0,1 ms. */
function simulate(nl, o) {
  o = o || {};
  const LS = SIM();
  const fail = (m, extra) => Object.assign({ ok: false, err: m, errs: [m], v: {}, i: {}, state: {}, warnings: [], events: [] }, extra || {});
  if (!LS) return fail('LochSim (simcore.js) ist nicht geladen.');
  try {
    const L0 = toLayout(nl, o);
    if (!L0.ok) return fail('Netzliste ungültig: ' + L0.errs.join(' '));
    const ix = index(L0.nl), hubOf = L0.hubOf, layout = L0.layout, warnings = [];
    const gname = o.ground || 'GND';
    const netFor = a => { a = S(a); if (ix.byName.has(a)) return a; const n = ix.net.get(canonAddr(ix, a)); return n === undefined ? null : n; };
    const drv = [];
    Object.keys(o.drive || {}).forEach((k, i) => {
      const net = netFor(k); if (net === null) { warnings.push('drive: ' + k + ' gibt es nicht.'); return; }
      if (!hubOf.has(gname)) { warnings.push('drive: Netz ' + gname + ' fehlt, Quelle für ' + k + ' hat keinen Bezug.'); return; }
      const ptA = [5000 + i, 1], ptB = [5000 + i, 2], hA = hubOf.get(net), hB = hubOf.get(gname);
      layout.wires.push({ x1: ptA[0], y1: ptA[1], x2: hA[0], y2: hA[1] }, { x1: ptB[0], y1: ptB[1], x2: hB[0], y2: hB[1] });
      const cp = { id: 9000 + i, k: 'BAT', v: '5', vr: undefined, n: 2, pins: [ptA, ptB], sw: 0, pos: 0.5, light: 0.5, pressed: false, rint: 0.01, item: {} };
      layout.parts.push(cp); drv.push({ cp, f: dcLevel(o.drive[k]) });
    });
    const circ = LS.buildCircuit(layout);
    circ.warnings.forEach(w => warnings.push((w.part && w.part.k ? w.part.k + ': ' : '') + w.text));
    drv.forEach(d => { d.el = circ.elems.find(e => e.part === d.cp && e.type === 'V'); if (d.el) { d.el.rint = 1e-3; d.el.imax = 0; } });
    if (o.ideal) circ.elems.forEach(e => { if (e.type === 'V' && e.wave === 'dc') e.rint = 1e-3; });
    const sim = LS.createSim(circ);
    const T = isN(o.T) && o.T > 0 ? o.T : 0.05, dt = isN(o.dt) && o.dt > 0 ? o.dt : 1e-4, steps = Math.round(T / dt);
    if (steps > 2e6) return fail('Zu viele Rechenschritte (' + steps + '): T oder dt anpassen.');
    const probeNets = o.probe ? [...new Set(o.probe.map(a => ({ a, n: netFor(a) })).filter(x => { if (x.n === null) warnings.push('probe: ' + x.a + ' gibt es nicht.'); return x.n !== null; }).map(x => x.n))] : L0.nl.nets.map(n => n.name);
    const nodeOf = n => circ.nodeOfKey(L0.hubKey[n]);
    const series = o.sample ? { t: [] } : null; if (series) probeNets.forEach(n => { series[n] = []; });
    let nextS = 0, conv = true, unconv = 0;
    for (let s = 0; s < steps; s++) {
      const t = s * dt; drv.forEach(d => { if (d.el) d.el.v0 = d.f(t); });
      if (!sim.step(dt)) { conv = false; unconv++; }
      if (series && sim.t >= nextS - 1e-12) { series.t.push(r3(sim.t * 1e6) / 1e6); probeNets.forEach(n => { const nd = nodeOf(n); series[n].push(nd === 0 ? 0 : nd > 0 ? sim.volt(nd) : NaN); }); nextS += o.sample; }
    }
    if (unconv > 0) warnings.push('Der Rechenkern ist in ' + unconv + ' von ' + steps + ' Schritten nicht konvergiert.');
    const v = {}; probeNets.forEach(n => { const nd = nodeOf(n); v[n] = nd === 0 ? 0 : nd > 0 ? sim.volt(nd) : NaN; });
    const i = {}, state = {};
    Object.keys(L0.partOf).forEach(ref => {
      const cp = L0.partOf[ref], els = circ.elems.filter(e => e.part === cp); if (!els.length) return;
      const e = els[0], st = { i: isN(e.i) ? e.i : 0 };
      if (isN(e.ic)) st.ic = e.ic; if (isN(e.ib)) st.ib = e.ib;
      if (e.relay) st.on = !!e.on; if (e.type === 'S') st.closed = !!e.closed;
      if (e.led) st.lit = Math.abs(e.i || 0) > 1e-4;
      if (e.a !== undefined && e.b !== undefined && e.type !== 'IC') st.vab = sim.volt(e.a) - sim.volt(e.b);
      els.forEach(x => { if (x.sub === 'NO') st.noClosed = !!x.closed; if (x.sub === 'NC') st.ncClosed = !!x.closed; });
      if (cp.k === 'T' && isN(e.ic)) st.ic = e.ic;
      state[ref] = st; i[ref] = st.i;
    });
    const events = sim.events.map(e => S(e.text || e.kind));
    return { ok: true, T, dt, steps, v, i, state, series, warnings, events, converged: conv, circ, sim, probe: probeNets };
  } catch (e) { return fail('Interner Fehler in simulate: ' + msgOf(e)); }
}

/* ====================================================================== Logik (kombinatorisch, 0/1/X) */
const LOWN = /^(GND|VSS|0V|V-|AGND|GNDA)$/i, HIGHN = /^(VCC|VDD|VBAT|V\+|\+\d+V\d*|\d+V\d)$/i;
const LF = {
  and: a => (a.includes(0) ? 0 : a.includes('X') ? 'X' : 1), or: a => (a.includes(1) ? 1 : a.includes('X') ? 'X' : 0),
  xor: a => (a.includes('X') ? 'X' : (a.reduce((s, x) => s + x, 0) & 1)), not: a => (a[0] === 'X' ? 'X' : 1 - a[0])
};
const inv3 = x => (x === 'X' ? 'X' : 1 - x);
const FN3 = { and: LF.and, or: LF.or, xor: LF.xor, not: LF.not, nand: a => inv3(LF.and(a)), nor: a => inv3(LF.or(a)), and4: LF.and, nor4: a => inv3(LF.or(a)) };
/* Netzliste fuer die Logik uebersetzen: Gatter, Schalter-Kurzschluesse, Versorgungsnetze */
function compileLogic(nl, o) {
  o = o || {};
  const N = normalize(nl, { lenient: true, warnSingle: false });
  if (!N.ok) return { ok: false, errs: N.errs };
  const nlz = N.nl, ix = index(nlz), uf = new Map(), warnings = [];
  const find = x => { if (!uf.has(x)) uf.set(x, x); let r = x; while (uf.get(r) !== r) r = uf.get(r); return r; };
  const sw = o.sw || {};
  nlz.parts.forEach(p => {
    if (p.kind !== 'SPST' && p.kind !== 'PB') return;
    const closed = sw[p.ref] !== undefined ? !!sw[p.ref] : !!(p.props && (p.props.sw || p.props.pressed));
    if (closed && p.pins['1'] && p.pins['2']) uf.set(find(p.pins['1']), find(p.pins['2']));
  });
  const rep = n => (n === undefined || n === null ? null : find(n));
  const pinNet = (p, pn) => rep(p.pins[pn]);
  const high = new Set(), low = new Set();
  nlz.nets.forEach(n => { if (HIGHN.test(n.name)) high.add(rep(n.name)); if (LOWN.test(n.name)) low.add(rep(n.name)); });
  nlz.parts.forEach(p => { if (p.kind === 'BAT' && p.pins['+'] && p.pins['-'] && low.has(rep(p.pins['-'])) && num(p.value) > 0) high.add(rep(p.pins['+'])); });
  (o.high || []).forEach(n => { const r = rep(n); if (r) high.add(r); }); (o.low || []).forEach(n => { const r = rep(n); if (r) low.add(r); });
  const gates = [], seqs = [], pw = [];
  nlz.parts.forEach(p => {
    if (GATE2[p.kind]) gates.push({ ref: p.ref, fn: GATE2[p.kind], ins: [pinNet(p, 'A'), pinNet(p, 'B')], inAddr: [addr(p.ref, 'A'), addr(p.ref, 'B')], out: pinNet(p, 'Y'), outAddr: addr(p.ref, 'Y') });
    else if (GATE1[p.kind]) gates.push({ ref: p.ref, fn: 'not', ins: [pinNet(p, 'A')], inAddr: [addr(p.ref, 'A')], out: pinNet(p, 'Y'), outAddr: addr(p.ref, 'Y') });
    else if (p.kind === 'ICX') {
      const I = ICS(), def = I && I.find(p.value), info = def && I.CATALOG[def.key];
      if (info && info.quad) {
        const vdd = pinNet(p, String(info.vcc)), vss = pinNet(p, String(info.gnd));
        pw.push({ ref: p.ref, vdd, vss, vddNet: p.pins[String(info.vcc)] || null, vssNet: p.pins[String(info.gnd)] || null });
        I.QUAD[info.quad].forEach((g, gi) => {
          const ins = g.slice(0, -1), out = g[g.length - 1];
          gates.push({ ref: p.ref, group: gi + 1, fn: info.fn, ins: ins.map(x => pinNet(p, String(x))), inAddr: ins.map(x => addr(p.ref, String(x))), out: pinNet(p, String(out)), outAddr: addr(p.ref, String(out)), ic: p.ref });
        });
      } else seqs.push(p.ref);
    } else if (p.kind === 'DFF' || p.kind === 'TFF' || p.kind === 'JKFF' || p.kind === 'CPU') seqs.push(p.ref);
  });
  const weak = [];
  nlz.parts.forEach(p => {
    if (p.kind !== 'R') return; const a = pinNet(p, '1'), b = pinNet(p, '2'); if (!a || !b || num(p.value) > 1e6) return;
    weak.push([a, b]);
  });
  return { ok: true, nl: nlz, ix, rep, high, low, gates, seqs, pw, weak, warnings };
}
function evalCompiled(c, inputs, o) {
  o = o || {};
  const vals = new Map(), fixed = new Map(), warnings = c.warnings.slice();
  c.high.forEach(n => fixed.set(n, 1)); c.low.forEach(n => fixed.set(n, 0));
  Object.keys(inputs || {}).forEach(k => {
    let net = c.ix.byName.has(k) ? k : c.ix.net.get(canonAddr(c.ix, k));
    if (net === undefined) { warnings.push('Eingang ' + k + ' gibt es nicht.'); return; }
    const v = inputs[k]; fixed.set(c.rep(net), v === 'X' ? 'X' : (v ? 1 : 0));
  });
  const weakV = new Map();
  for (let pass = 0; pass < 3; pass++) c.weak.forEach(([a, b]) => { const fa = fixed.has(a) ? fixed.get(a) : weakV.get(a), fb = fixed.has(b) ? fixed.get(b) : weakV.get(b); if (fa !== undefined && fb === undefined && (c.high.has(a) || c.low.has(a))) weakV.set(b, fa); if (fb !== undefined && fa === undefined && (c.high.has(b) || c.low.has(b))) weakV.set(a, fb); });
  const unpowered = new Set();
  c.pw.forEach(p => { if (!(p.vdd && c.high.has(p.vdd) && p.vss && c.low.has(p.vss))) unpowered.add(p.ref); });
  if (!o.noPowerCheck) unpowered.forEach(r => warnings.push('IC ' + r + ': Versorgung fehlt (VDD/VCC an Plus, VSS/GND an Masse anschließen).'));
  const get = n => (n === null || n === undefined ? 'X' : fixed.has(n) ? fixed.get(n) : vals.has(n) ? vals.get(n) : weakV.has(n) ? weakV.get(n) : 'X');
  let stable = false, conflicts = new Set();
  for (let it = 0; it < 64 && !stable; it++) {
    const drv = new Map();
    c.gates.forEach(g => {
      let v;
      if (!o.noPowerCheck && g.ic && unpowered.has(g.ic)) v = 'X'; else v = FN3[g.fn](g.ins.map(get));
      if (g.out === null) return;
      if (!drv.has(g.out)) drv.set(g.out, []); drv.get(g.out).push(v);
    });
    stable = true; const next = new Map();
    drv.forEach((vs, n) => { let v = vs[0]; if (vs.some(x => x !== v)) { v = 'X'; conflicts.add(n); } next.set(n, v); });
    next.forEach((v, n) => { if (vals.get(n) !== v) { stable = false; } });
    vals.clear(); next.forEach((v, n) => vals.set(n, v));
  }
  if (!stable) warnings.push('Die Schaltung schwingt oder hat eine Rückkopplung ohne stabilen Zustand.');
  conflicts.forEach(n => { const names = c.nl.nets.filter(x => c.rep(x.name) === n).map(x => x.name); warnings.push('Netz ' + (names[0] || n) + ': mehrere Ausgänge treiben es unterschiedlich (Kurzschluss).'); });
  return { get, vals, fixed, warnings, stable, unpowered: [...unpowered], conflicts: [...conflicts] };
}
function lintCompiled(c, inputsKeys) {
  const driven = new Set(); c.gates.forEach(g => { if (g.out) driven.add(g.out); });
  const cnt = new Map(); c.nl.nets.forEach(n => { cnt.set(c.rep(n.name), (cnt.get(c.rep(n.name)) || 0) + n.pins.length); });
  const inSet = new Set((inputsKeys || []).map(k => (c.ix.byName.has(k) ? c.rep(k) : c.rep(c.ix.net.get(canonAddr(c.ix, k))))));
  const open = [];
  c.gates.forEach(g => g.ins.forEach((n, i) => { if (n === null || (cnt.get(n) === 1 && !c.high.has(n) && !c.low.has(n) && !inSet.has(n))) open.push(g.inAddr[i]); }));
  return { openInputs: open, unpowered: c.pw.filter(p => !(p.vdd && c.high.has(p.vdd) && p.vss && c.low.has(p.vss))).map(p => p.ref), gates: c.gates.length, sequential: c.seqs.slice(), inputsKnown: inSet.size };
}
/* evalLogic(nl, inputs, opts) -> { ok, nets:{Name:0|1|'X'}, get(NetzOderPin), out:{..}, warnings, lint, seq } ; inputs: { NetzOderPin: 0|1 }; opts: probe [..], sw {ref:0|1}, high/low [..], noPowerCheck */
function evalLogic(nl, inputs, o) {
  o = o || {};
  const c = compileLogic(nl, o); if (!c.ok) return { ok: false, errs: c.errs, nets: {}, warnings: [], get: () => 'X', out: {} };
  const r = evalCompiled(c, inputs, o);
  const nets = {}; c.nl.nets.forEach(n => { nets[n.name] = r.get(c.rep(n.name)); });
  const get = a => { const net = c.ix.byName.has(a) ? a : c.ix.net.get(canonAddr(c.ix, a)); return net === undefined ? 'X' : r.get(c.rep(net)); };
  const out = {}; (o.probe || []).forEach(k => { out[k] = get(k); });
  return { ok: true, nets, get, out, warnings: r.warnings, stable: r.stable, lint: lintCompiled(c, Object.keys(inputs || {})), seq: c.seqs.slice() };
}
/* truthTable(nl, ins, outs, opts) -> { ok, n, rows:[{ in:[0/1..], out:[0|1|'X'..] }], warnings, lint } ; Bit 0 der Zeilennummer = ins[0] */
function truthTable(nl, ins, outs, o) {
  o = o || {};
  const c = compileLogic(nl, o); if (!c.ok) return { ok: false, errs: c.errs, rows: [], n: 0, warnings: [] };
  const n = ins.length; if (n > 16) return { ok: false, errs: ['Zu viele Eingänge (' + n + ') für eine Wahrheitstabelle.'], rows: [], n, warnings: [] };
  const rows = []; let warnings = null, lastStable = true;
  const getNet = a => (c.ix.byName.has(a) ? a : c.ix.net.get(canonAddr(c.ix, a)));
  const outNets = outs.map(a => getNet(a));
  const miss = outs.filter((a, i) => outNets[i] === undefined).map(a => 'Ausgang ' + a + ' gibt es nicht.');
  for (let m = 0; m < (1 << n); m++) {
    const inp = {}, bits = []; ins.forEach((k, i) => { const b = (m >> i) & 1; inp[k] = b; bits.push(b); });
    const r = evalCompiled(c, inp, o);
    if (!warnings) warnings = r.warnings.concat(miss); if (!r.stable) lastStable = false;
    rows.push({ in: bits, out: outNets.map(x => (x === undefined ? 'X' : r.get(c.rep(x)))) });
  }
  return { ok: true, n, rows, warnings: warnings || [], stable: lastStable, lint: lintCompiled(c, ins) };
}

/* ---------- Teilerverhaeltnis (Flipflop-Ketten, 4060, 4020, 4017, 4518) ---------- */
const HALF = { '4013': [{ clk: 3, d: 5, q: 1, qn: 2, s: 6, r: 4 }, { clk: 10, d: 9, q: 13, qn: 12, s: 8, r: 11 }], '7474': [{ clk: 3, d: 2, q: 5, qn: 6, s: 4, r: 1 }, { clk: 11, d: 12, q: 9, qn: 8, s: 10, r: 13 }] };
const BIT4020 = { 9: 1, 7: 4, 5: 5, 4: 6, 6: 7, 13: 8, 12: 9, 14: 10, 15: 11, 1: 12, 2: 13, 3: 14 };
const BIT4060 = { 7: 4, 5: 5, 4: 6, 6: 7, 14: 8, 13: 9, 15: 10, 1: 12, 2: 13, 3: 14 };
/* dividerRatio(nl, { out, clk?, fIn? }) -> { ok, ratio, stages:[{ref,type,ratio}], clkNet, source:'net'|'xtal', fIn, fOut, resets:[{ref,pin,state}], msg }
   Verfolgt von 'out' rueckwaerts bis zum Takt (Netz clk, sonst das erste Netz ohne Treiber oder der Quarz am 4060). */
function dividerRatio(nl, o) {
  o = o || {};
  const fail = (msg, extra) => Object.assign({ ok: false, ratio: null, stages: [], msg, resets: [] }, extra || {});
  const N = normalize(nl, { lenient: true, warnSingle: false });
  if (!N.ok) return fail('Netzliste ungültig: ' + N.errs.join(' '));
  const nlz = N.nl, ix = index(nlz), c = compileLogic(nlz, o);
  const netOf1 = a => { a = S(a); if (ix.byName.has(a)) return a; const n = ix.net.get(canonAddr(ix, a)); return n === undefined ? null : n; };
  const out = netOf1(o.out); if (out === null) return fail('Ausgang ' + S(o.out) + ' gibt es nicht oder ist nicht angeschlossen.');
  const clk = o.clk !== undefined ? netOf1(o.clk) : null; if (o.clk !== undefined && clk === null) return fail('Takt ' + S(o.clk) + ' gibt es nicht oder ist nicht angeschlossen.');
  const isHigh = n => n !== null && n !== undefined && c.ok && c.high.has(c.rep(n));
  const stages = [], resets = [], seen = new Set();
  const resetState = (ref, pin, net) => {
    const st = net === undefined || net === null ? 'open' : isHigh(net) ? 'high' : (c.ok && c.low.has(c.rep(net)) ? 'low' : (ix.byName.get(net).pins.length > 1 ? 'driven' : 'open'));
    resets.push({ ref, pin, net: net || null, state: st });
  };
  let source = 'net', fIn = isN(o.fIn) ? o.fIn : null, srcNet = null;
  function drivers(net) {
    const list = [];
    nlz.parts.forEach(p => {
      const P = pn => p.pins[pn];
      if (p.kind === 'DFF' || p.kind === 'TFF' || p.kind === 'JKFF') {
        ['Q', 'QN'].forEach(qn => {
          if (P(qn) !== net) return;
          let ok = false;
          if (p.kind === 'DFF') ok = P('D') !== undefined && P('D') === P('QN');
          else if (p.kind === 'TFF') ok = isHigh(P('T'));
          else ok = isHigh(P('J')) && isHigh(P('K'));
          list.push({ ref: p.ref, type: p.kind, ratio: 2, clkNet: P('CLK') || null, ok, why: p.kind === 'DFF' ? 'D ist nicht mit QN verbunden' : p.kind === 'TFF' ? 'T liegt nicht auf High' : 'J und K liegen nicht beide auf High' });
        });
      } else if (p.kind === 'ICX') {
        const I = ICS(), def = I && I.find(p.value), key = def && def.key;
        if (key === '4013' || key === '7474') {
          HALF[key].forEach((h, hi) => {
            const pq = P(String(h.q)), pqn = P(String(h.qn)); if (pq !== net && pqn !== net) return;
            const dTied = P(String(h.d)) !== undefined && P(String(h.d)) === pqn;
            list.push({ ref: p.ref, type: key + '/' + (hi + 1), ratio: 2, clkNet: P(String(h.clk)) || null, ok: dTied, why: 'D ist nicht mit Q̄ verbunden', half: h });
          });
        } else if (key === '4020') {
          Object.keys(BIT4020).forEach(pin => { if (P(pin) === net) list.push({ ref: p.ref, type: '4020/Q' + BIT4020[pin], ratio: Math.pow(2, BIT4020[pin]), clkNet: P('10') || null, ok: true, rst: [['RST', P('11')]] }); });
        } else if (key === '4060') {
          Object.keys(BIT4060).forEach(pin => { if (P(pin) === net) {
            const xt = nlz.parts.find(q => q.kind === 'XTAL' && ((q.pins['1'] === P('10') && q.pins['2'] === P('11')) || (q.pins['1'] === P('11') && q.pins['2'] === P('10'))) && q.pins['1'] && q.pins['2']);
            list.push({ ref: p.ref, type: '4060/Q' + BIT4060[pin], ratio: Math.pow(2, BIT4060[pin]), clkNet: xt ? null : (P('11') || null), xtal: xt || null, ok: true, rst: [['MR', P('12')]] });
          } });
        } else if (key === '4017') {
          ['3', '2', '4', '7', '10', '1', '5', '6', '9', '11', '12'].forEach(pin => { if (P(pin) === net) list.push({ ref: p.ref, type: '4017/' + (pin === '12' ? 'CO' : 'Q'), ratio: 10, clkNet: P('14') || null, ok: isHigh(P('13')) ? false : true, why: 'ENA (Pin 13) darf nicht auf High liegen', rst: [['RST', P('15')]] }); });
        } else if (key === '4518') {
          [[['3', 'Q0A', 2], ['6', 'Q3A', 10]], [['11', 'Q0B', 2], ['14', 'Q3B', 10]]].forEach((g, gi) => {
            g.forEach(([pin, nm, r]) => { if (P(pin) === net) list.push({ ref: p.ref, type: '4518/' + nm, ratio: r, clkNet: P(gi ? '9' : '1') || null, ok: isHigh(P(gi ? '10' : '2')), why: 'CP1 (Freigabe) muss auf High liegen', rst: [[gi ? 'MRB' : 'MRA', P(gi ? '15' : '7')]] }); });
          });
        }
      }
    });
    return list;
  }
  function trace(net, depth) {
    if (net === null || net === undefined) return { ok: false, msg: 'Eine Taktleitung ist nicht angeschlossen.' };
    if (clk !== null && net === clk) { srcNet = net; return { ok: true, ratio: 1 }; }
    if (depth > 40 || seen.has(net + '#' + depth)) return { ok: false, msg: 'Die Teilerkette ist zu lang oder hat eine Schleife.' };
    const dr = drivers(net);
    if (!dr.length) {
      if (clk === null) { srcNet = net; return { ok: true, ratio: 1 }; }
      return { ok: false, msg: 'Netz ' + net + ' wird von keinem Teiler getrieben und ist nicht der Takt ' + clk + '.' };
    }
    const d = dr[0];
    if (!d.ok) return { ok: false, msg: d.ref + ': ' + (d.why || 'kein Teiler') + '.' };
    stages.push({ ref: d.ref, type: d.type, ratio: d.ratio });
    if (d.rst) d.rst.forEach(([pin, n]) => resetState(d.ref, pin, n));
    else if (d.half) { resetState(d.ref, 'S', d.half.s ? (nlz.parts.find(q => q.ref === d.ref).pins[String(d.half.s)]) : undefined); resetState(d.ref, 'R', nlz.parts.find(q => q.ref === d.ref).pins[String(d.half.r)]); }
    if (d.xtal) {
      const f = num(d.xtal.value); source = 'xtal'; if (isN(f) && f > 0 && fIn === null) fIn = f; srcNet = null;
      return { ok: true, ratio: d.ratio };
    }
    const r = trace(d.clkNet, depth + 1);
    return r.ok ? { ok: true, ratio: d.ratio * r.ratio } : r;
  }
  const r = trace(out, 0);
  if (!r.ok) return fail(r.msg, { stages });
  const res = { ok: true, ratio: r.ratio, stages, clkNet: srcNet, source, fIn, fOut: fIn !== null ? fIn / r.ratio : null, resets, msg: '' };
  return res;
}

/* ====================================================================== Anbindung */
const api = {
  version: '1.0',
  PINNAMES, PINCOUNT, CORE, DEFV, FPMAP, FP_REQUESTS, OFFBOARD, SYMMETRIC,
  pinNames, pinCount, resolvePin, parseAddr, addr, natCmp,
  num, fmt,
  normalize, validate, floating, builder,
  index, netOf, netPins: netPinsOf, same, parts: partsOf, part: partOf, others, bom,
  equiv, merge,
  fpOf, toBoard, fromBoard,
  toLayout, simulate,
  evalLogic, truthTable, dividerRatio
};
api.attach = function (V) { if (V && typeof V === 'object') V.nl = api; return V; };
root.VerbundNL = api;
if (root.Verbund && typeof root.Verbund === 'object') api.attach(root.Verbund);
if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
  try { if (typeof require === 'function') { const K = require('./verbund.js'); if (K && K !== api) api.attach(K); } } catch (e) { /* Kern nicht vorhanden oder defekt: egal */ }
}
})(typeof window !== 'undefined' ? window : globalThis);
