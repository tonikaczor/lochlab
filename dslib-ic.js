/* Tonfunk Datenblatt-Lab: Übungsdatenblätter ICs (dslib-ic.js)
   Acht EIGENE Übungsdatenblätter, alle Texte in eigenen Worten. Werte angelehnt an typische Bauteile
   der jeweiligen Klasse; maßgeblich sind immer die Datenblätter des Herstellers. */
(function () {
'use strict';
var ROOT = (typeof window !== 'undefined') ? window : globalThis;
ROOT.DS_LIB = ROOT.DS_LIB || { list: [], byId: {}, add(ds) { if (this.byId[ds.id]) return; this.byId[ds.id] = ds; this.list.push(ds); } };

var MFR = 'Tonfunk Übung (fiktiv)';
var NOTE = 'Übungsdatenblatt, Werte angelehnt an typische Bauteile; maßgeblich sind immer die Datenblätter des Herstellers.';

/* ---------- Hilfsfunktionen (Kennlinienpunkte, Zeitdiagramme) ---------- */
function r(v, d) { var p = Math.pow(10, d == null ? 3 : d); return Math.round(v * p) / p; }
function sig(v, n) { return +Number(v).toPrecision(n || 4); }
function pts(xs, f, d) { return xs.map(function (x) { return [x, r(f(x), d)]; }); }
function ptsS(xs, f, n) { return xs.map(function (x) { return [x, sig(f(x), n || 4)]; }); }
function zip(xs, ys) { return xs.map(function (x, i) { return [x, ys[i]]; }); }
function log10(x) { return Math.log(x) / Math.LN10; }

/* I2C-Zeitdiagramm: items 'S','RS','P' oder {v:byte, nack:bool} */
function i2c(items) {
  var scl = '', sda = '';
  function t(c, d) { scl += c; sda += d; }
  items.forEach(function (it) {
    if (it === 'S') { t('1', '1'); t('1', '0'); }
    else if (it === 'RS') { t('0', '1'); t('1', '1'); t('1', '0'); }
    else if (it === 'P') { t('0', '0'); t('1', '0'); t('1', '1'); }
    else {
      var bits = (it.v & 255).toString(2).padStart(8, '0');
      for (var i = 0; i < 8; i++) { t('0', bits[i]); t('1', bits[i]); }
      var a = it.nack ? '1' : '0'; t('0', a); t('1', a);
    }
  });
  return { scl: scl, sda: sda };
}
/* SPI-Zeitdiagramm (Mode 0,0): Bytes MSB zuerst */
function spi(bytes) {
  var bits = '';
  bytes.forEach(function (b) { bits += (b & 255).toString(2).padStart(8, '0'); });
  var n = bits.length, d2 = '';
  for (var i = 0; i < n; i++) d2 += bits[i] + bits[i];
  return {
    cs: '1' + '0'.repeat(2 + 2 * n) + '1',
    sck: '00' + '01'.repeat(n) + '00',
    sdi: 'xx' + d2 + 'xx'
  };
}
/* NAND mit Laufzeit d (in Takten) */
function nandWave(a, b, d) {
  var y = '';
  for (var i = 0; i < a.length; i++) {
    var j = Math.max(0, i - d);
    y += (a[j] === '1' && b[j] === '1') ? '0' : '1';
  }
  return y;
}

/* Grundwortschatz, der in jedem Datenblatt-Glossar vorkommt */
var BASE_GLOSS = [
  ['absolute maximum ratings', 'Grenzwerte (dürfen auch kurzzeitig nicht überschritten werden)', 'Keine Betriebswerte!'],
  ['recommended operating conditions', 'empfohlene Betriebsbedingungen', 'Innerhalb dieser Grenzen gelten die Kenndaten.'],
  ['electrical characteristics', 'elektrische Kenndaten', 'Tabelle mit Min-, Typ- und Max-Werten'],
  ['test conditions', 'Messbedingungen', 'Ohne sie ist ein Tabellenwert nicht vergleichbar.'],
  ['typical (typ)', 'typischer Wert (nicht garantiert)', 'Gilt meist bei 25 °C.'],
  ['junction temperature', 'Sperrschichttemperatur (Chip-Temperatur)', 'Tj'],
  ['thermal resistance, junction to ambient', 'Wärmewiderstand Sperrschicht–Umgebung', 'RthJA in K/W'],
  ['supply voltage', 'Versorgungsspannung', ''],
  ['storage temperature', 'Lagertemperatur', 'Tstg, ohne Betrieb'],
  ['ordering information', 'Bestellinformation', 'Typ, Gehäuse, Verpackung']
];
function gloss(extra) {
  return BASE_GLOSS.concat(extra).map(function (g) { return { en: g[0], de: g[1], note: g[2] || '' }; });
}

/* ============================================================
   TF-LM317  (Vorbild: LM317)
   ============================================================ */
function lm317() {
  var xI = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0, 1.125, 1.25, 1.375, 1.5];
  var xT = [-50, -25, 0, 25, 50, 75, 100, 125, 150];
  var xF = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000];
  return {
    id: 'tf-lm317', part: 'TF-LM317', family: 'Spannungsregler', mfr: MFR, lang: 'en', ref: 'LM317',
    title: 'Adjustable 3-terminal positive voltage regulator, 1.5 A',
    desc: 'The TF-LM317 holds a constant reference voltage of about 1.25 V between its OUT and ADJ pins. Two external resistors set the output anywhere between 1.25 V and 37 V at up to 1.5 A. Current limit and thermal shutdown protect the device against overload.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Output voltage adjustable from 1.25 V to 37 V',
      'Output current up to 1.5 A',
      'Typical line regulation 0.01 %/V',
      'Internal current limiting and thermal overload protection',
      'Only two external resistors needed to set the output voltage',
      'Dropout voltage about 2 V at full load'
    ],
    pins: { pkg: 'TO-220', pins: [
      { n: 1, name: 'ADJ', type: 'in', desc: 'Adjust input. Connect to the tap of the R1/R2 divider.' },
      { n: 2, name: 'OUT', type: 'out', desc: 'Regulated output. The metal tab is internally connected to this pin.' },
      { n: 3, name: 'IN', type: 'pwr', desc: 'Unregulated input voltage.' }
    ] },
    abs: [
      { key: 'vdiff', param: 'Input-to-output voltage differential', sym: 'VI−VO', cond: '', min: null, max: 40, unit: 'V', note: 'Not an operating value' },
      { key: 'ptot', param: 'Power dissipation (free air, no heat sink)', sym: 'Ptot', cond: 'TA = 25 °C', min: null, max: 2000, unit: 'mW', note: 'Limited by the thermal resistance, see Thermal Information' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: 'The built-in shutdown protects the chip, it is not an operating point' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' },
      { key: 'tsol', param: 'Lead temperature', sym: 'Tsol', cond: '1.6 mm from case, 10 s', min: null, max: 260, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vdiff', param: 'Input-to-output voltage differential', sym: 'VI−VO', min: 3, max: 40, unit: 'V' },
      { key: 'vo', param: 'Output voltage setting range', sym: 'VO', min: 1.25, max: 37, unit: 'V' },
      { key: 'io', param: 'Output current', sym: 'IO', min: 0.01, max: 1.5, unit: 'A' },
      { key: 'tj', param: 'Operating junction temperature', sym: 'Tj', min: 0, max: 125, unit: '°C' }
    ],
    elec: [
      { key: 'vref', param: 'Reference voltage', sym: 'Vref', cond: '3 V ≤ VI−VO ≤ 40 V, 10 mA ≤ IO ≤ 1.5 A, P ≤ 2 W', min: 1.2, typ: 1.25, max: 1.3, unit: 'V', tj: 25 },
      { key: 'linereg', param: 'Line regulation', sym: 'ΔVO/ΔVI', cond: '3 V ≤ VI−VO ≤ 40 V, IO = 10 mA', min: null, typ: 0.01, max: 0.04, unit: '%/V', tj: 25 },
      { key: 'loadreg_lo', param: 'Load regulation, VO ≤ 5 V', sym: 'ΔVO', cond: '10 mA ≤ IO ≤ 1.5 A, VO ≤ 5 V', min: null, typ: 5, max: 25, unit: 'mV', tj: 25 },
      { key: 'loadreg_hi', param: 'Load regulation, VO ≥ 5 V', sym: 'ΔVO/VO', cond: '10 mA ≤ IO ≤ 1.5 A, VO ≥ 5 V', min: null, typ: 0.1, max: 0.5, unit: '%', tj: 25 },
      { key: 'iadj', param: 'Adjustment pin current', sym: 'Iadj', cond: 'VI−VO = 5 V, IO = 10 mA', min: null, typ: 50, max: 100, unit: 'µA', tj: 25 },
      { key: 'diadj', param: 'Change of adjustment pin current', sym: 'ΔIadj', cond: '3 V ≤ VI−VO ≤ 40 V, 10 mA ≤ IO ≤ 1.5 A', min: null, typ: 0.2, max: 5, unit: 'µA', tj: 25 },
      { key: 'ilmin', param: 'Minimum load current', sym: 'IL(min)', cond: 'VI−VO = 40 V', min: null, typ: 3.5, max: 10, unit: 'mA', tj: 25 },
      { key: 'iomax', param: 'Current limit', sym: 'IOmax', cond: 'VI−VO ≤ 15 V', min: 1.5, typ: 2.2, max: 3.4, unit: 'A', tj: 25 },
      { key: 'iolim40', param: 'Current limit at high differential', sym: 'IOmax', cond: 'VI−VO = 40 V', min: 0.15, typ: 0.4, max: null, unit: 'A', tj: 25 },
      { key: 'vdo', param: 'Dropout voltage', sym: 'VDO', cond: 'IO = 1.5 A, output 100 mV below nominal', min: null, typ: 2.0, max: 2.5, unit: 'V', tj: 25 },
      { key: 'rr_noc', param: 'Ripple rejection, ADJ not bypassed', sym: 'RR', cond: 'VO = 10 V, f = 120 Hz, CADJ = 0', min: 60, typ: 65, max: null, unit: 'dB', tj: 25 },
      { key: 'rr_c', param: 'Ripple rejection, ADJ bypassed', sym: 'RR', cond: 'VO = 10 V, f = 120 Hz, CADJ = 10 µF', min: 66, typ: 80, max: null, unit: 'dB', tj: 25 },
      { key: 'vn', param: 'Output noise voltage', sym: 'Vn', cond: '10 Hz ≤ f ≤ 10 kHz, as % of VO', min: null, typ: 0.003, max: null, unit: '%', tj: 25 },
      { key: 'tdrift', param: 'Temperature stability of output', sym: 'ΔVO/VO', cond: 'Tj = Tmin to Tmax', min: null, typ: 0.7, max: null, unit: '%', tj: 25 }
    ],
    graphs: [
      { id: 'dropout', title: 'Dropout voltage vs. output current', xLabel: 'Output current', xUnit: 'A', xScale: 'lin', yLabel: 'Dropout voltage', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'Tj = −40 °C', cond: 'output 100 mV below nominal', points: pts(xI, function (x) { return 1.4 + 0.3 * x; }, 3) },
          { name: 'Tj = 25 °C', cond: 'output 100 mV below nominal', points: pts(xI, function (x) { return 1.5 + 0.3333 * x; }, 3) },
          { name: 'Tj = 125 °C', cond: 'output 100 mV below nominal', points: pts(xI, function (x) { return 1.6 + 0.36 * x; }, 3) }
        ], note: 'The dropout voltage rises with load current and with temperature. Add it to VO for the minimum input voltage.' },
      { id: 'vref_t', title: 'Reference voltage vs. junction temperature', xLabel: 'Junction temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Reference voltage', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'IO = 10 mA', cond: 'VI−VO = 5 V', points: pts(xT, function (T) { return 1.25 - 0.00012 * (T - 25) - 0.0000003 * (T - 25) * (T - 25); }, 4) },
          { name: 'IO = 1 A', cond: 'VI−VO = 5 V', points: pts(xT, function (T) { return 1.252 - 0.00012 * (T - 25) - 0.0000003 * (T - 25) * (T - 25); }, 4) }
        ], note: 'Vref stays inside 1.2 V to 1.3 V over the whole temperature range.' },
      { id: 'rr', title: 'Ripple rejection vs. frequency', xLabel: 'Frequency', xUnit: 'Hz', xScale: 'log', yLabel: 'Ripple rejection', yUnit: 'dB', yScale: 'lin',
        series: [
          { name: 'CADJ = 0', cond: 'VO = 10 V, IO = 500 mA', points: pts(xF, function (f) { return 65 - 10 * log10(1 + Math.pow(f / 50000, 2)); }, 1) },
          { name: 'CADJ = 10 µF', cond: 'VO = 10 V, IO = 500 mA', points: pts(xF, function (f) { return 80 - 10 * log10(1 + Math.pow(f / 20000, 2)); }, 1) }
        ], note: 'A capacitor from ADJ to ground improves rejection by about 15 dB.' }
    ],
    thermal: { rthJA: 50, rthJC: 5, tjMax: 125, ptotMax: 2, note: 'Ptot(max) = (Tjmax − 25 °C) / RthJA = 2 W in free air at TA = 25 °C. With a heat sink: Tj = TA + P·(RthJC + RthCS + RthSA).' },
    pkgDraw: { name: 'TO-220', kind: 'to220', dims: [
      { label: 'A', min: 4.4, max: 4.6, unit: 'mm' },
      { label: 'B', min: 9.8, max: 10.4, unit: 'mm' },
      { label: 'C', min: 15, max: 16, unit: 'mm' },
      { label: 'D', min: 12.7, max: 14.5, unit: 'mm' },
      { label: 'e', min: 2.34, max: 2.74, unit: 'mm' },
      { label: 'b', min: 0.69, max: 0.91, unit: 'mm' },
      { label: 'ØP', min: 3.5, max: 3.9, unit: 'mm' }
    ] },
    app: [
      { title: 'Adjustable output voltage', text: 'R1 sits between OUT and ADJ and sets the divider current to Vref/R1 (about 5 mA with R1 = 240 Ω, above the minimum load). R2 adds the rest of the output voltage. The small adjust-pin current Iadj also flows through R2 and must be added for precise results.',
        circuit: [
          'Vin ──┬── IN  [LM317]  OUT ──┬──┬── Vout',
          '      C1                    │  C2 (≥ 1 µF)',
          '      │         ADJ         R1 (240 Ω)',
          '     GND         └──────────┤',
          '                            R2',
          '                            │',
          '                           GND'
        ],
        formulas: ['Vout = Vref · (1 + R2/R1) + Iadj · R2', 'Example: R1 = 240 Ω, R2 = 720 Ω: Vout = 1.25 V · 4 + 50 µA · 720 Ω = 5.04 V', 'Vin(min) = Vout + VDO ≈ Vout + 2 V', 'Pv = (Vin − Vout) · IO'] },
      { title: 'Dissipation check', text: 'A linear regulator turns the voltage difference into heat. Check Tj before using the circuit at high current.',
        circuit: ['Vin = 12 V, Vout = 5 V, IO = 0.5 A  →  Pv = 3.5 W'],
        formulas: ['Pv = (Vin − Vout) · IO', 'Tj = TA + Pv · RthJA  (needs a heat sink if Tj > 125 °C)'] }
    ],
    order: [
      { type: 'TF-LM317T', pkg: 'TO-220', note: 'Tube, 50 pieces' }
    ],
    glossary: gloss([
      ['dropout voltage', 'Mindest-Differenz zwischen Ein- und Ausgangsspannung', 'Darunter regelt der Regler nicht mehr.'],
      ['reference voltage', 'Referenzspannung (1,25 V zwischen OUT und ADJ)', 'Vref'],
      ['adjustment pin current', 'Strom aus dem Einstellanschluss (ADJ)', 'Iadj, wenige 10 µA'],
      ['line regulation', 'Netzregelung (Ausgangsänderung bei Eingangsänderung)', 'in %/V'],
      ['load regulation', 'Lastregelung (Ausgangsänderung bei Laständerung)', ''],
      ['minimum load current', 'Mindestlaststrom', 'Ohne Last kann die Ausgangsspannung steigen.'],
      ['ripple rejection', 'Brummunterdrückung', 'in dB'],
      ['current limit', 'Strombegrenzung', ''],
      ['thermal shutdown', 'thermische Abschaltung (Übertemperaturschutz)', ''],
      ['heat sink', 'Kühlkörper', ''],
      ['input-to-output differential', 'Spannungsdifferenz zwischen Eingang und Ausgang', 'VI−VO']
    ])
  };
}

/* ============================================================
   TF-7805  (Vorbild: 7805)
   ============================================================ */
function reg7805() {
  var xI = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
  var xT = [-40, -25, -10, 5, 25, 45, 65, 85, 105, 125];
  var xF = [10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000];
  return {
    id: 'tf-7805', part: 'TF-7805', family: 'Spannungsregler', mfr: MFR, lang: 'en', ref: '7805',
    title: '5 V fixed positive voltage regulator, 1 A',
    desc: 'The TF-7805 delivers a fixed 5 V output at up to 1 A from an unregulated input of roughly 7.5 V to 25 V. It contains current limiting, safe-area protection and thermal shutdown, and needs only two small capacitors.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Fixed output voltage 5 V, tolerance ±4 % at 25 °C',
      'Output current up to 1 A',
      'Input voltage up to 25 V in operation',
      'Internal current limit, safe-area protection and thermal shutdown',
      'Typical quiescent current 5 mA',
      'Needs no adjustment resistors'
    ],
    pins: { pkg: 'TO-220', pins: [
      { n: 1, name: 'IN', type: 'pwr', desc: 'Unregulated input voltage.' },
      { n: 2, name: 'GND', type: 'gnd', desc: 'Common ground. The metal tab is connected to this pin.' },
      { n: 3, name: 'OUT', type: 'out', desc: 'Regulated 5 V output.' }
    ] },
    abs: [
      { key: 'vi', param: 'Input voltage', sym: 'VI', cond: '', min: null, max: 35, unit: 'V', note: 'Not an operating value' },
      { key: 'ptot', param: 'Power dissipation (free air, no heat sink)', sym: 'Ptot', cond: 'TA = 25 °C', min: null, max: 2000, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' },
      { key: 'tsol', param: 'Lead temperature', sym: 'Tsol', cond: '1.6 mm from case, 10 s', min: null, max: 260, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vi', param: 'Input voltage', sym: 'VI', min: 7.5, max: 25, unit: 'V' },
      { key: 'io', param: 'Output current', sym: 'IO', min: 0.005, max: 1, unit: 'A' },
      { key: 'tj', param: 'Operating junction temperature', sym: 'Tj', min: 0, max: 125, unit: '°C' }
    ],
    elec: [
      { key: 'vo', param: 'Output voltage', sym: 'VO', cond: 'VI = 10 V, IO = 5 mA', min: 4.8, typ: 5.0, max: 5.2, unit: 'V', tj: 25 },
      { key: 'vo_full', param: 'Output voltage over load and line', sym: 'VO', cond: '7.5 V ≤ VI ≤ 20 V, 5 mA ≤ IO ≤ 1 A, P ≤ 15 W', min: 4.75, typ: 5.0, max: 5.25, unit: 'V', tj: 25 },
      { key: 'linereg', param: 'Line regulation', sym: 'ΔVO', cond: '7 V ≤ VI ≤ 25 V, IO = 500 mA', min: null, typ: 4, max: 50, unit: 'mV', tj: 25 },
      { key: 'loadreg', param: 'Load regulation', sym: 'ΔVO', cond: 'VI = 10 V, 5 mA ≤ IO ≤ 1 A', min: null, typ: 12, max: 60, unit: 'mV', tj: 25 },
      { key: 'iq', param: 'Quiescent current', sym: 'IQ', cond: 'VI = 10 V, IO = 0', min: null, typ: 5, max: 8, unit: 'mA', tj: 25 },
      { key: 'diq_line', param: 'Quiescent current change with line', sym: 'ΔIQ', cond: '7 V ≤ VI ≤ 25 V', min: null, typ: null, max: 1.0, unit: 'mA', tj: 25 },
      { key: 'diq_load', param: 'Quiescent current change with load', sym: 'ΔIQ', cond: '5 mA ≤ IO ≤ 1 A', min: null, typ: null, max: 0.5, unit: 'mA', tj: 25 },
      { key: 'vn', param: 'Output noise voltage', sym: 'Vn', cond: '10 Hz ≤ f ≤ 100 kHz, IO = 5 mA', min: null, typ: 40, max: null, unit: 'µV', tj: 25 },
      { key: 'rr', param: 'Ripple rejection', sym: 'RR', cond: '8 V ≤ VI ≤ 18 V, f = 120 Hz, IO = 100 mA', min: 62, typ: 73, max: null, unit: 'dB', tj: 25 },
      { key: 'vdo', param: 'Dropout voltage', sym: 'VDO', cond: 'IO = 1 A', min: null, typ: 2.0, max: 2.5, unit: 'V', tj: 25 },
      { key: 'dvdt', param: 'Output voltage drift', sym: 'ΔVO/ΔT', cond: 'IO = 5 mA, Tj = 0 °C to 125 °C', min: null, typ: -0.8, max: null, unit: 'mV/K', tj: 25 },
      { key: 'iopk', param: 'Peak output current', sym: 'IOpk', cond: 'short pulse', min: null, typ: 2.2, max: null, unit: 'A', tj: 25 },
      { key: 'iosc', param: 'Short-circuit output current', sym: 'IOS', cond: 'VI = 35 V', min: null, typ: 0.75, max: null, unit: 'A', tj: 25 }
    ],
    graphs: [
      { id: 'dropout', title: 'Dropout voltage vs. output current', xLabel: 'Output current', xUnit: 'A', xScale: 'lin', yLabel: 'Dropout voltage', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'Tj = 25 °C', cond: 'output 100 mV below 5 V', points: pts(xI, function (x) { return 1.7 + 0.3 * x; }, 3) },
          { name: 'Tj = 125 °C', cond: 'output 100 mV below 5 V', points: pts(xI, function (x) { return 1.8 + 0.35 * x; }, 3) }
        ], note: 'Minimum input voltage = 5 V + dropout voltage at the load current used.' },
      { id: 'vo_t', title: 'Output voltage vs. junction temperature', xLabel: 'Junction temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Output voltage', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'IO = 5 mA', cond: 'VI = 10 V', points: pts(xT, function (T) { return 5.0 - 0.0008 * (T - 25); }, 4) }
        ], note: 'Drift of about −0.8 mV/K, as in the table.' },
      { id: 'rr', title: 'Ripple rejection vs. frequency', xLabel: 'Frequency', xUnit: 'Hz', xScale: 'log', yLabel: 'Ripple rejection', yUnit: 'dB', yScale: 'lin',
        series: [
          { name: 'IO = 100 mA', cond: 'VI = 8 V to 18 V', points: pts(xF, function (f) { return 73 - 10 * log10(1 + Math.pow(f / 10000, 2)); }, 1) },
          { name: 'IO = 1 A', cond: 'VI = 8 V to 18 V', points: pts(xF, function (f) { return 70 - 10 * log10(1 + Math.pow(f / 8000, 2)); }, 1) }
        ], note: 'Above about 10 kHz the rejection falls off; use a ceramic capacitor at the output.' }
    ],
    thermal: { rthJA: 50, rthJC: 5, tjMax: 125, ptotMax: 2, note: 'Ptot(max) = (125 °C − 25 °C) / 50 K/W = 2 W without heat sink. Dissipation Pv = (VI − VO)·IO + VI·IQ.' },
    pkgDraw: { name: 'TO-220', kind: 'to220', dims: [
      { label: 'A', min: 4.4, max: 4.6, unit: 'mm' },
      { label: 'B', min: 9.8, max: 10.4, unit: 'mm' },
      { label: 'C', min: 15, max: 16, unit: 'mm' },
      { label: 'D', min: 12.7, max: 14.5, unit: 'mm' },
      { label: 'e', min: 2.34, max: 2.74, unit: 'mm' },
      { label: 'b', min: 0.69, max: 0.91, unit: 'mm' },
      { label: 'ØP', min: 3.5, max: 3.9, unit: 'mm' }
    ] },
    app: [
      { title: 'Fixed 5 V supply', text: 'Place a ceramic capacitor of 0.33 µF directly at the input and 0.1 µF at the output, close to the pins. They keep the regulator stable and absorb fast load steps.',
        circuit: [
          'Vin ──┬── IN  [7805]  OUT ──┬── +5 V',
          '      C1 0.33 µF   GND     C2 0.1 µF',
          '      │             │      │',
          '     GND ──────────┴──────GND'
        ],
        formulas: ['Vin(min) = 5 V + VDO ≈ 7 V (use ≥ 7.5 V)', 'Pv = (Vin − 5 V) · IO + Vin · IQ'] },
      { title: 'Raised output with Zener diode', text: 'A Zener diode between the GND pin and ground lifts the output by VZ. The quiescent current of 5 mA flows through the Zener.',
        circuit: ['GND pin ── Zener (VZ) ── GND'],
        formulas: ['VO = 5 V + VZ', 'Example: VZ = 4.7 V gives VO ≈ 9.7 V'] },
      { title: 'Heat check', text: 'Example: Vin = 12 V, IO = 0.3 A gives Pv = 7 V · 0.3 A + 12 V · 5 mA = 2.16 W. In free air Tj = 25 °C + 2.16 W · 50 K/W = 133 °C, above the limit. A heat sink or a lower Vin is required.',
        circuit: [], formulas: ['Tj = TA + Pv · RthJA'] }
    ],
    order: [
      { type: 'TF-7805T', pkg: 'TO-220', note: 'Tube, 50 pieces' }
    ],
    glossary: gloss([
      ['dropout voltage', 'Mindest-Differenz zwischen Ein- und Ausgangsspannung', ''],
      ['quiescent current', 'Ruhestrom (fließt ohne Last durch den Regler)', 'IQ'],
      ['line regulation', 'Netzregelung', ''],
      ['load regulation', 'Lastregelung', ''],
      ['ripple rejection', 'Brummunterdrückung', 'in dB'],
      ['output noise voltage', 'Rauschspannung am Ausgang', ''],
      ['short-circuit current', 'Kurzschlussstrom', ''],
      ['thermal shutdown', 'thermische Abschaltung', ''],
      ['heat sink', 'Kühlkörper', ''],
      ['fixed regulator', 'Festspannungsregler', '']
    ])
  };
}

/* ============================================================
   TF-NE555  (Vorbild: NE555)
   ============================================================ */
function ne555() {
  var xRB = [1000, 2200, 4700, 10000, 22000, 47000, 100000, 220000, 470000, 1000000];
  var RA = 1000;
  function fa(C) { return function (RB) { return 1.44 / ((RA + 2 * RB) * C); }; }
  var xmA = [1, 2, 5, 10, 20, 50, 100, 150, 200];
  return {
    id: 'tf-ne555', part: 'TF-NE555', family: 'Timer / Oszillator', mfr: MFR, lang: 'en', ref: 'NE555',
    title: 'Precision timer, astable and monostable operation',
    desc: 'The TF-NE555 combines two comparators, a flip-flop, a discharge transistor and a push-pull output stage. With one capacitor and one or two resistors it makes clean single pulses (monostable) or a continuous square wave (astable). The output can source or sink up to 200 mA.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Supply voltage 4.5 V to 16 V',
      'Output current up to ±200 mA (source and sink)',
      'Thresholds at 2/3 and 1/3 of the supply voltage',
      'Timing from microseconds to hours',
      'Astable and monostable operation, adjustable duty cycle',
      'Active-low RESET input overrides all other inputs',
      'Initial timing accuracy typically 1 %'
    ],
    pins: { pkg: 'DIP-8', pins: [
      { n: 1, name: 'GND', type: 'gnd', desc: 'Ground.' },
      { n: 2, name: 'TRIG', type: 'in', desc: 'Trigger. A level below 1/3 VCC sets the output high and starts the timing.' },
      { n: 3, name: 'OUT', type: 'out', desc: 'Output, push-pull, up to ±200 mA.' },
      { n: 4, name: 'RESET', type: 'in', desc: 'Active-low reset. Connect to VCC if unused.' },
      { n: 5, name: 'CTRL', type: 'io', desc: 'Control voltage, internal 2/3 VCC node. Decouple with 10 nF to ground if unused.' },
      { n: 6, name: 'THR', type: 'in', desc: 'Threshold. A level above 2/3 VCC ends the timing and sets the output low.' },
      { n: 7, name: 'DISCH', type: 'io', desc: 'Discharge. Open-collector transistor that discharges the timing capacitor.' },
      { n: 8, name: 'VCC', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', cond: '', min: null, max: 18, unit: 'V', note: '' },
      { key: 'vin', param: 'Input voltage at TRIG, THR, RESET, CTRL', sym: 'VI', cond: '', min: -0.3, max: 18, unit: 'V', note: 'Never above VCC + 0.3 V in practice' },
      { key: 'iout', param: 'Output current (source or sink)', sym: 'IO', cond: '', min: null, max: 225, unit: 'mA', note: '' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, DIP-8', min: null, max: 1000, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' },
      { key: 'tsol', param: 'Lead temperature', sym: 'Tsol', cond: '1.6 mm from case, 10 s', min: null, max: 260, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', min: 4.5, max: 16, unit: 'V' },
      { key: 'vin', param: 'Input voltage at TRIG, THR, RESET', sym: 'VI', min: 0, max: 16, unit: 'V' },
      { key: 'iout', param: 'Output current (source or sink)', sym: 'IO', min: -200, max: 200, unit: 'mA' },
      { key: 'rt', param: 'Timing resistance RA + RB', sym: 'RT', min: 1000, max: 3300000, unit: 'Ω' },
      { key: 'ta', param: 'Ambient temperature', sym: 'TA', min: 0, max: 70, unit: '°C' }
    ],
    elec: [
      { key: 'icc_5', param: 'Supply current, output low, no load', sym: 'ICC', cond: 'VCC = 5 V, RL = ∞', min: null, typ: 3, max: 6, unit: 'mA', tj: 25 },
      { key: 'icc_15', param: 'Supply current, output low, no load', sym: 'ICC', cond: 'VCC = 15 V, RL = ∞', min: null, typ: 10, max: 15, unit: 'mA', tj: 25 },
      { key: 'err', param: 'Initial timing error', sym: 'Δt/t', cond: 'RA, RB = 2 kΩ to 100 kΩ, C = 0.1 µF', min: null, typ: 1, max: 3, unit: '%', tj: 25 },
      { key: 'drift_t', param: 'Timing drift with temperature', sym: 'Δt/ΔT', cond: 'RA, RB = 2 kΩ to 100 kΩ, C = 0.1 µF', min: null, typ: 50, max: null, unit: 'ppm/°C', tj: 25 },
      { key: 'drift_v', param: 'Timing drift with supply voltage', sym: 'Δt/ΔVCC', cond: 'RA, RB = 2 kΩ to 100 kΩ, C = 0.1 µF', min: null, typ: 0.1, max: 0.5, unit: '%/V', tj: 25 },
      { key: 'vctrl_15', param: 'Control voltage level (2/3 VCC)', sym: 'VCTRL', cond: 'VCC = 15 V', min: 9, typ: 10, max: 11, unit: 'V', tj: 25 },
      { key: 'vctrl_5', param: 'Control voltage level (2/3 VCC)', sym: 'VCTRL', cond: 'VCC = 5 V', min: 2.6, typ: 3.33, max: 4, unit: 'V', tj: 25 },
      { key: 'vtrig_15', param: 'Trigger voltage level (1/3 VCC)', sym: 'VTRIG', cond: 'VCC = 15 V', min: 4.5, typ: 5, max: 5.6, unit: 'V', tj: 25 },
      { key: 'vtrig_5', param: 'Trigger voltage level (1/3 VCC)', sym: 'VTRIG', cond: 'VCC = 5 V', min: 1.1, typ: 1.67, max: 2.2, unit: 'V', tj: 25 },
      { key: 'ithr', param: 'Threshold current', sym: 'ITHR', cond: '', min: null, typ: 0.1, max: 0.25, unit: 'µA', tj: 25 },
      { key: 'itrig', param: 'Trigger current', sym: 'ITRIG', cond: 'VTRIG = 0 V', min: null, typ: 0.5, max: 2, unit: 'µA', tj: 25 },
      { key: 'vreset', param: 'Reset voltage', sym: 'VRESET', cond: '', min: 0.3, typ: 0.7, max: 1, unit: 'V', tj: 25 },
      { key: 'ireset', param: 'Reset current', sym: 'IRESET', cond: 'VRESET = 0.4 V', min: null, typ: 0.1, max: 0.4, unit: 'mA', tj: 25 },
      { key: 'idis', param: 'Discharge pin leakage current (output high)', sym: 'IDISCH', cond: 'VCC = 15 V, VDISCH = 15 V', min: null, typ: 20, max: 100, unit: 'nA', tj: 25 },
      { key: 'vol_15_10', param: 'Output voltage low', sym: 'VOL', cond: 'VCC = 15 V, ISINK = 10 mA', min: null, typ: 0.1, max: 0.25, unit: 'V', tj: 25 },
      { key: 'vol_15_50', param: 'Output voltage low', sym: 'VOL', cond: 'VCC = 15 V, ISINK = 50 mA', min: null, typ: 0.4, max: 0.75, unit: 'V', tj: 25 },
      { key: 'vol_15_100', param: 'Output voltage low', sym: 'VOL', cond: 'VCC = 15 V, ISINK = 100 mA', min: null, typ: 2.0, max: 2.5, unit: 'V', tj: 25 },
      { key: 'vol_5_5', param: 'Output voltage low', sym: 'VOL', cond: 'VCC = 5 V, ISINK = 5 mA', min: null, typ: 0.25, max: 0.35, unit: 'V', tj: 25 },
      { key: 'voh_15_100', param: 'Output voltage high', sym: 'VOH', cond: 'VCC = 15 V, ISOURCE = 100 mA', min: 12.75, typ: 13.3, max: null, unit: 'V', tj: 25 },
      { key: 'voh_15_200', param: 'Output voltage high', sym: 'VOH', cond: 'VCC = 15 V, ISOURCE = 200 mA', min: 12, typ: 12.5, max: null, unit: 'V', tj: 25 },
      { key: 'voh_5_100', param: 'Output voltage high', sym: 'VOH', cond: 'VCC = 5 V, ISOURCE = 100 mA', min: 2.75, typ: 3.3, max: null, unit: 'V', tj: 25 },
      { key: 'tr', param: 'Output rise time', sym: 'tr', cond: 'CL = 15 pF, VCC = 5 V', min: null, typ: 100, max: 200, unit: 'ns', tj: 25 },
      { key: 'tf', param: 'Output fall time', sym: 'tf', cond: 'CL = 15 pF, VCC = 5 V', min: null, typ: 100, max: 200, unit: 'ns', tj: 25 }
    ],
    graphs: [
      { id: 'f_rb', title: 'Astable frequency vs. RB', xLabel: 'Resistance RB', xUnit: 'Ω', xScale: 'log', yLabel: 'Output frequency', yUnit: 'Hz', yScale: 'log',
        series: [
          { name: 'C = 10 nF', cond: 'RA = 1 kΩ, f = 1.44 / ((RA + 2·RB)·C)', points: ptsS(xRB, fa(10e-9), 4) },
          { name: 'C = 100 nF', cond: 'RA = 1 kΩ, f = 1.44 / ((RA + 2·RB)·C)', points: ptsS(xRB, fa(100e-9), 4) }
        ], note: 'Both axes are logarithmic. Ideal components: add the 1 % initial error and the capacitor tolerance.' },
      { id: 'voh', title: 'Output voltage high vs. source current', xLabel: 'Source current', xUnit: 'mA', xScale: 'log', yLabel: 'Output voltage high', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'VCC = 15 V', cond: 'Tj = 25 °C', points: zip(xmA, [1.30, 1.32, 1.38, 1.45, 1.52, 1.60, 1.70, 2.10, 2.50].map(function (d) { return r(15 - d, 2); })) },
          { name: 'VCC = 5 V', cond: 'Tj = 25 °C', points: zip(xmA, [1.30, 1.32, 1.38, 1.45, 1.52, 1.60, 1.70, 1.95, 2.30].map(function (d) { return r(5 - d, 2); })) }
        ], note: 'At 100 mA the output is about 1.7 V below VCC. Do not expect rail-to-rail output.' },
      { id: 'vol', title: 'Output voltage low vs. sink current', xLabel: 'Sink current', xUnit: 'mA', xScale: 'log', yLabel: 'Output voltage low', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'VCC = 15 V', cond: 'Tj = 25 °C', points: zip(xmA, [0.02, 0.04, 0.06, 0.10, 0.18, 0.40, 2.00, 2.30, 2.60]) },
          { name: 'VCC = 5 V', cond: 'Tj = 25 °C', points: zip(xmA, [0.05, 0.10, 0.25, 0.50, 0.80, 1.30, 2.00, 2.40, 2.70]) }
        ], note: 'The low-side saturation voltage rises quickly above 50 mA.' }
    ],
    thermal: { rthJA: 100, rthJC: 40, tjMax: 125, ptotMax: 1, note: 'Ptot(max) = (125 °C − 25 °C) / 100 K/W = 1 W for DIP-8 in free air. Mind the dissipation at high VCC and heavy output current.' },
    pkgDraw: { name: 'DIP-8', kind: 'dip8', dims: [
      { label: 'A (length)', min: 9.2, max: 9.8, unit: 'mm' },
      { label: 'B (body width)', min: 6.1, max: 6.6, unit: 'mm' },
      { label: 'C (row spacing)', min: 7.4, max: 7.9, unit: 'mm' },
      { label: 'e (pitch)', min: 2.44, max: 2.64, unit: 'mm' },
      { label: 'b (lead width)', min: 0.36, max: 0.56, unit: 'mm' },
      { label: 'H (height)', min: 3.2, max: 4.4, unit: 'mm' }
    ] },
    timing: [
      { title: 'Monostable operation (one pulse)', signals: [
        { name: 'TRIG', wave: '1111000111111111' },
        { name: 'OUT', wave: '0000011111110000' },
        { name: 'THR reached', wave: '0000000000010000' }
      ], note: 'A falling TRIG below 1/3 VCC starts the pulse. The output goes low again after T = 1.1 · R · C when the capacitor voltage reaches 2/3 VCC.' }
    ],
    app: [
      { title: 'Astable multivibrator', text: 'The capacitor charges through RA + RB up to 2/3 VCC and discharges through RB down to 1/3 VCC. The output is high while charging and low while discharging, so the duty cycle is always above 50 %.',
        circuit: [
          'VCC ──┬── RA ──┬── DISCH(7)',
          '      │        RB',
          '      │        ├── THR(6) ─ TRIG(2)',
          '      │        C ── GND',
          'RESET(4)=VCC   CTRL(5) ─ 10 nF ─ GND   OUT(3) ──► square wave'
        ],
        formulas: ['f = 1.44 / ((RA + 2·RB) · C)', 'tH = 0.693 · (RA + RB) · C', 'tL = 0.693 · RB · C', 'Duty = tH/(tH + tL) = (RA + RB)/(RA + 2·RB)', 'Example: RA = 1 kΩ, RB = 68 kΩ, C = 10 nF gives f ≈ 1.05 kHz'] },
      { title: 'Monostable multivibrator', text: 'A short low pulse at TRIG starts one output pulse of fixed length. TRIG must go high again before the pulse ends.',
        circuit: [
          'VCC ── R ──┬── DISCH(7) ─ THR(6)',
          '            C ── GND',
          'TRIG(2) ◄── input pulse     OUT(3) ──► one pulse of length T'
        ],
        formulas: ['T = 1.1 · R · C', 'Example: R = 100 kΩ, C = 10 µF gives T ≈ 1.1 s'] }
    ],
    order: [
      { type: 'TF-NE555P', pkg: 'DIP-8', note: 'Tube, 50 pieces' }
    ],
    glossary: gloss([
      ['threshold voltage', 'Schwellspannung (Ende der Zeitspanne bei 2/3 VCC)', ''],
      ['trigger voltage', 'Triggerspannung (Start bei 1/3 VCC)', ''],
      ['astable', 'astabil (schwingt frei)', ''],
      ['monostable', 'monostabil (ein Impuls pro Auslösung)', ''],
      ['duty cycle', 'Tastverhältnis', 'Anteil der High-Zeit an der Periode'],
      ['discharge transistor', 'Entladetransistor', 'Pin 7'],
      ['control voltage', 'Steuerspannung (Pin 5)', 'Verschiebt die Schwellen.'],
      ['reset', 'Rücksetzeingang (aktiv low)', ''],
      ['sink current', 'Senkstrom (fließt in den Ausgang hinein)', 'ISINK'],
      ['source current', 'Quellstrom (fließt aus dem Ausgang heraus)', 'ISOURCE'],
      ['timing accuracy', 'Zeitgenauigkeit', '']
    ])
  };
}

/* ============================================================
   TF-LM358  (Vorbild: LM358)
   ============================================================ */
function lm358() {
  var xF = [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000, 100000, 300000, 1000000, 3000000, 10000000];
  var xIs = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 20];
  var xT = [-40, -25, -10, 0, 25, 40, 55, 70, 85, 100, 115, 125];
  var xIo = [0.1, 0.3, 1, 3, 5, 10, 20, 30, 40];
  return {
    id: 'tf-lm358', part: 'TF-LM358', family: 'Operationsverstärker', mfr: MFR, lang: 'en', ref: 'LM358',
    title: 'Dual low-power operational amplifier, single supply',
    desc: 'The TF-LM358 contains two independent, internally compensated operational amplifiers that work from a single supply of 3 V to 32 V. The input range includes ground and the output can swing close to ground, which makes it a good choice for single-supply sensor and control circuits.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Single supply 3 V to 32 V, or dual supply ±1.5 V to ±16 V',
      'Input common-mode range includes ground',
      'Output swings down to nearly 0 V with a load to ground',
      'Gain-bandwidth product about 1 MHz',
      'Low supply current, nearly independent of supply voltage',
      'Internal frequency compensation, unity-gain stable',
      'Short-circuit protected outputs'
    ],
    pins: { pkg: 'DIP-8', pins: [
      { n: 1, name: 'OUT A', type: 'out', desc: 'Output of amplifier A.' },
      { n: 2, name: 'IN− A', type: 'in', desc: 'Inverting input of amplifier A.' },
      { n: 3, name: 'IN+ A', type: 'in', desc: 'Non-inverting input of amplifier A.' },
      { n: 4, name: 'GND', type: 'gnd', desc: 'Negative supply or ground.' },
      { n: 5, name: 'IN+ B', type: 'in', desc: 'Non-inverting input of amplifier B.' },
      { n: 6, name: 'IN− B', type: 'in', desc: 'Inverting input of amplifier B.' },
      { n: 7, name: 'OUT B', type: 'out', desc: 'Output of amplifier B.' },
      { n: 8, name: 'VCC', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', cond: '', min: null, max: 32, unit: 'V', note: 'Dual supplies: ±16 V' },
      { key: 'vid', param: 'Differential input voltage', sym: 'VID', cond: '', min: -32, max: 32, unit: 'V', note: '' },
      { key: 'vi', param: 'Input voltage', sym: 'VI', cond: '', min: -0.3, max: 32, unit: 'V', note: '' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, DIP-8', min: null, max: 800, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' },
      { key: 'tsol', param: 'Lead temperature', sym: 'Tsol', cond: '1.6 mm from case, 10 s', min: null, max: 260, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', min: 3, max: 32, unit: 'V' },
      { key: 'vicm', param: 'Common-mode input voltage (VCC = 5 V)', sym: 'VICM', min: 0, max: 3.5, unit: 'V' },
      { key: 'ta', param: 'Ambient temperature', sym: 'TA', min: 0, max: 70, unit: '°C' }
    ],
    elec: [
      { key: 'vio', param: 'Input offset voltage', sym: 'VIO', cond: 'VCC = 5 V to 30 V, VO = 1.4 V', min: null, typ: 2, max: 7, unit: 'mV', tj: 25 },
      { key: 'dvio', param: 'Offset voltage drift', sym: 'ΔVIO/ΔT', cond: 'VO = 1.4 V', min: null, typ: 7, max: null, unit: 'µV/°C', tj: 25 },
      { key: 'iib', param: 'Input bias current', sym: 'IIB', cond: 'VO = 1.4 V', min: null, typ: 20, max: 100, unit: 'nA', tj: 25 },
      { key: 'iio', param: 'Input offset current', sym: 'IIO', cond: 'VO = 1.4 V', min: null, typ: 2, max: 30, unit: 'nA', tj: 25 },
      { key: 'vicr', param: 'Common-mode input voltage range', sym: 'VICR', cond: 'VCC = 30 V, 0 V to VCC − 1.5 V', min: 0, typ: null, max: 28.5, unit: 'V', tj: 25 },
      { key: 'avd', param: 'Large-signal open-loop gain', sym: 'AVD', cond: 'VCC = 15 V, RL ≥ 2 kΩ, VO = 1 V to 11 V', min: 88, typ: 100, max: null, unit: 'dB', tj: 25 },
      { key: 'gbw', param: 'Gain-bandwidth product', sym: 'GBW', cond: 'VCC = 15 V, f = 100 kHz', min: null, typ: 1.0, max: null, unit: 'MHz', tj: 25 },
      { key: 'sr', param: 'Slew rate', sym: 'SR', cond: 'VCC = 15 V, unity gain, RL = 2 kΩ', min: null, typ: 0.3, max: null, unit: 'V/µs', tj: 25 },
      { key: 'cmrr', param: 'Common-mode rejection ratio', sym: 'CMRR', cond: 'VCC = 30 V, DC', min: 65, typ: 80, max: null, unit: 'dB', tj: 25 },
      { key: 'psrr', param: 'Supply voltage rejection ratio', sym: 'PSRR', cond: 'VCC = 5 V to 30 V, DC', min: 65, typ: 100, max: null, unit: 'dB', tj: 25 },
      { key: 'sep', param: 'Channel separation', sym: 'αcs', cond: 'f = 1 kHz to 20 kHz, input referred', min: null, typ: 120, max: null, unit: 'dB', tj: 25 },
      { key: 'icc_5', param: 'Supply current, both amplifiers, no load', sym: 'ICC', cond: 'VCC = 5 V', min: null, typ: 0.5, max: 1.2, unit: 'mA', tj: 25 },
      { key: 'icc_30', param: 'Supply current, both amplifiers, no load', sym: 'ICC', cond: 'VCC = 30 V', min: null, typ: 0.7, max: 2, unit: 'mA', tj: 25 },
      { key: 'vol', param: 'Output voltage low', sym: 'VOL', cond: 'VCC = 5 V, ISINK = 1 mA, load to GND', min: null, typ: 0.1, max: 0.25, unit: 'V', tj: 25 },
      { key: 'voh_10k', param: 'Output voltage high', sym: 'VOH', cond: 'VCC = 30 V, RL = 10 kΩ to GND', min: 27, typ: 28, max: null, unit: 'V', tj: 25 },
      { key: 'voh_2k', param: 'Output voltage high', sym: 'VOH', cond: 'VCC = 30 V, RL = 2 kΩ to GND', min: 26, typ: 27, max: null, unit: 'V', tj: 25 },
      { key: 'isrc', param: 'Output source current', sym: 'IOH', cond: 'VCC = 15 V, VID = 1 V, VO = 2 V', min: 20, typ: 40, max: null, unit: 'mA', tj: 25 },
      { key: 'isnk', param: 'Output sink current', sym: 'IOL', cond: 'VCC = 15 V, VID = −1 V, VO = 2 V', min: 10, typ: 20, max: null, unit: 'mA', tj: 25 }
    ],
    graphs: [
      { id: 'gain', title: 'Open-loop gain vs. frequency', xLabel: 'Frequency', xUnit: 'Hz', xScale: 'log', yLabel: 'Open-loop gain', yUnit: 'dB', yScale: 'lin',
        series: [
          { name: 'AVD', cond: 'VCC = 15 V, RL = 2 kΩ', points: pts(xF, function (f) { return 100 - 10 * log10(1 + Math.pow(f / 10, 2)); }, 1) }
        ], note: 'Dominant pole near 10 Hz, unity gain at 1 MHz. Closed-loop bandwidth = GBW / gain.' },
      { id: 'phase', title: 'Open-loop phase vs. frequency', xLabel: 'Frequency', xUnit: 'Hz', xScale: 'log', yLabel: 'Phase', yUnit: '°', yScale: 'lin',
        series: [
          { name: 'Phase', cond: 'VCC = 15 V, RL = 2 kΩ', points: pts(xF, function (f) { return -(Math.atan(f / 10) + Math.atan(f / 1500000)) * 180 / Math.PI; }, 1) }
        ], note: 'The phase margin at the unity-gain frequency is about 56°.' },
      { id: 'vol', title: 'Output voltage low vs. sink current', xLabel: 'Sink current', xUnit: 'mA', xScale: 'log', yLabel: 'Output voltage low', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'VCC = 5 V', cond: 'Tj = 25 °C', points: zip(xIs, [0.005, 0.01, 0.03, 0.06, 0.10, 0.20, 0.50, 0.90]) }
        ], note: 'The output sinks only little current at small voltages; it is not a power stage.' },
      { id: 'vcc_voh', title: 'Voltage drop to supply vs. source current', xLabel: 'Source current', xUnit: 'mA', xScale: 'log', yLabel: 'VCC − VOH', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'VCC = 15 V', cond: 'Tj = 25 °C', points: zip(xIo, [1.2, 1.25, 1.3, 1.4, 1.5, 1.65, 1.9, 2.1, 2.3]) }
        ], note: 'The positive output swing stays about 1.2 V to 2.3 V below VCC.' },
      { id: 'vio_t', title: 'Input offset voltage vs. temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Input offset voltage', yUnit: 'mV', yScale: 'lin',
        series: [
          { name: 'Typical unit', cond: 'VCC = 5 V, VO = 1.4 V', points: pts(xT, function (T) { return 2 + 0.007 * (T - 25); }, 3) }
        ], note: 'Drift about 7 µV/°C, as in the table.' }
    ],
    thermal: { rthJA: 125, rthJC: 45, tjMax: 125, ptotMax: 0.8, note: 'Ptot(max) = (125 °C − 25 °C) / 125 K/W = 0.8 W for DIP-8 in free air. For the SOIC-8 version use the derating given with the order codes.' },
    pkgDraw: { name: 'DIP-8', kind: 'dip8', dims: [
      { label: 'A (length)', min: 9.2, max: 9.8, unit: 'mm' },
      { label: 'B (body width)', min: 6.1, max: 6.6, unit: 'mm' },
      { label: 'C (row spacing)', min: 7.4, max: 7.9, unit: 'mm' },
      { label: 'e (pitch)', min: 2.44, max: 2.64, unit: 'mm' },
      { label: 'b (lead width)', min: 0.36, max: 0.56, unit: 'mm' },
      { label: 'H (height)', min: 3.2, max: 4.4, unit: 'mm' }
    ] },
    app: [
      { title: 'Non-inverting amplifier', text: 'The gain is set by two resistors. With a single supply the input signal must stay inside the common-mode range, and the output cannot reach VCC.',
        circuit: [
          'Vin ───── IN+ (3) ──┐',
          '                     [½ LM358] ── OUT (1) ──┬── Vout',
          '        ┌── IN− (2) ──┘                     │',
          '        ├───────────────── Rf ──────────────┤',
          '        Rg',
          '        │',
          '       GND'
        ],
        formulas: ['Av = 1 + Rf/Rg', 'fc(−3 dB) ≈ GBW / Av', 'Example: Rf = 9 kΩ, Rg = 1 kΩ gives Av = 10, fc ≈ 1 MHz / 10 = 100 kHz', 'Output limit: VO ≤ VCC − 1.5 V (typ.)'] },
      { title: 'Voltage follower for a sensor', text: 'Output tied to IN− gives unity gain and a low-impedance output. The input bias current of 20 nA flows through the source resistance and creates an offset.',
        circuit: ['Vsensor ── IN+     OUT ──┬── Vout', '            IN− ───────────┘'],
        formulas: ['ΔV = IIB · Rsource', 'Example: Rsource = 100 kΩ gives ΔV = 20 nA · 100 kΩ = 2 mV'] }
    ],
    order: [
      { type: 'TF-LM358P', pkg: 'DIP-8', note: 'Tube, 50 pieces' },
      { type: 'TF-LM358D', pkg: 'SOIC-8', note: 'Tape and reel, 2500 pieces' }
    ],
    glossary: gloss([
      ['operational amplifier', 'Operationsverstärker', 'OPV'],
      ['input offset voltage', 'Eingangs-Offsetspannung', 'VIO, in mV'],
      ['input bias current', 'Eingangsruhestrom (Eingangsstrom)', 'IIB'],
      ['input offset current', 'Eingangs-Offsetstrom', 'Differenz der Eingangsströme'],
      ['gain-bandwidth product', 'Verstärkungs-Bandbreite-Produkt', 'GBW'],
      ['slew rate', 'Anstiegsgeschwindigkeit der Ausgangsspannung', 'in V/µs'],
      ['open-loop gain', 'Leerlaufverstärkung (ohne Gegenkopplung)', 'AVD'],
      ['common-mode rejection ratio', 'Gleichtaktunterdrückung', 'CMRR'],
      ['common-mode input voltage range', 'Gleichtakt-Eingangsspannungsbereich', ''],
      ['unity gain', 'Verstärkung eins', ''],
      ['phase margin', 'Phasenreserve', ''],
      ['single supply', 'unsymmetrische Versorgung (nur eine Spannung)', '']
    ])
  };
}

/* ============================================================
   TF-74HC00  (Vorbild: 74HC00)
   ============================================================ */
function hc00() {
  var xV = [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6];
  var base = [30, 20, 14.5, 11.5, 9.3, 8.0, 7.6, 7.3, 7.0];
  function sc(T) { return 1 + 0.0033 * (T - 25); }
  var xT = [-40, -20, 0, 25, 45, 65, 85, 105, 125];
  function vAt(v) { return base[xV.indexOf(v)]; }
  var A1 = '0000111111110000', B1 = '1111111111111111';
  var A2 = '0011001100110011', B2 = '0000111111110000';
  return {
    id: 'tf-74hc00', part: 'TF-74HC00', family: 'Logik-IC', mfr: MFR, lang: 'en', ref: '74HC00',
    title: 'Quad 2-input NAND gate, high-speed CMOS',
    desc: 'The TF-74HC00 contains four independent 2-input NAND gates in high-speed CMOS technology. It combines the speed of low-power Schottky logic with the very low supply current and high input impedance of CMOS. The supply range is 2 V to 6 V.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Supply voltage 2 V to 6 V',
      'Typical propagation delay 8 ns at VCC = 4.5 V (CL = 50 pF)',
      'Output drive capability ±4 mA at VCC = 4.5 V',
      'Very high input impedance, input leakage below 0.1 µA',
      'Low quiescent supply current',
      'Inputs are CMOS level: switching thresholds scale with VCC'
    ],
    pins: { pkg: 'DIP-14', pins: [
      { n: 1, name: '1A', type: 'in', desc: 'Gate 1, input A.' },
      { n: 2, name: '1B', type: 'in', desc: 'Gate 1, input B.' },
      { n: 3, name: '1Y', type: 'out', desc: 'Gate 1, output.' },
      { n: 4, name: '2A', type: 'in', desc: 'Gate 2, input A.' },
      { n: 5, name: '2B', type: 'in', desc: 'Gate 2, input B.' },
      { n: 6, name: '2Y', type: 'out', desc: 'Gate 2, output.' },
      { n: 7, name: 'GND', type: 'gnd', desc: 'Ground.' },
      { n: 8, name: '3Y', type: 'out', desc: 'Gate 3, output.' },
      { n: 9, name: '3A', type: 'in', desc: 'Gate 3, input A.' },
      { n: 10, name: '3B', type: 'in', desc: 'Gate 3, input B.' },
      { n: 11, name: '4Y', type: 'out', desc: 'Gate 4, output.' },
      { n: 12, name: '4A', type: 'in', desc: 'Gate 4, input A.' },
      { n: 13, name: '4B', type: 'in', desc: 'Gate 4, input B.' },
      { n: 14, name: 'VCC', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', cond: '', min: -0.5, max: 7, unit: 'V', note: '' },
      { key: 'vi', param: 'Input voltage', sym: 'VI', cond: '', min: -0.5, max: 7.5, unit: 'V', note: 'VI ≤ VCC + 0.5 V' },
      { key: 'vo', param: 'Output voltage', sym: 'VO', cond: '', min: -0.5, max: 7.5, unit: 'V', note: 'VO ≤ VCC + 0.5 V' },
      { key: 'iik', param: 'Input clamp current', sym: 'IIK', cond: 'VI < −0.5 V or VI > VCC + 0.5 V', min: -20, max: 20, unit: 'mA', note: '' },
      { key: 'iok', param: 'Output clamp current', sym: 'IOK', cond: 'VO < −0.5 V or VO > VCC + 0.5 V', min: -20, max: 20, unit: 'mA', note: '' },
      { key: 'io', param: 'Output current per output', sym: 'IO', cond: '−0.5 V < VO < VCC + 0.5 V', min: -25, max: 25, unit: 'mA', note: '' },
      { key: 'icc', param: 'Supply or ground current', sym: 'ICC, IGND', cond: '', min: -50, max: 50, unit: 'mA', note: 'Total for the whole package' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, DIP-14', min: null, max: 500, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 150, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', min: 2, max: 6, unit: 'V' },
      { key: 'vi', param: 'Input voltage', sym: 'VI', min: 0, max: 6, unit: 'V' },
      { key: 'vo', param: 'Output voltage', sym: 'VO', min: 0, max: 6, unit: 'V' },
      { key: 'ta', param: 'Ambient temperature', sym: 'TA', min: -40, max: 125, unit: '°C' },
      { key: 'trf_2', param: 'Input transition time at VCC = 2.0 V', sym: 'tr, tf', min: null, max: 1000, unit: 'ns' },
      { key: 'trf_45', param: 'Input transition time at VCC = 4.5 V', sym: 'tr, tf', min: null, max: 500, unit: 'ns' },
      { key: 'trf_6', param: 'Input transition time at VCC = 6.0 V', sym: 'tr, tf', min: null, max: 400, unit: 'ns' }
    ],
    elec: [
      { key: 'vih_2', param: 'High-level input voltage', sym: 'VIH', cond: 'VCC = 2.0 V', min: 1.5, typ: null, max: null, unit: 'V', tj: 25 },
      { key: 'vih_45', param: 'High-level input voltage', sym: 'VIH', cond: 'VCC = 4.5 V', min: 3.15, typ: null, max: null, unit: 'V', tj: 25 },
      { key: 'vih_6', param: 'High-level input voltage', sym: 'VIH', cond: 'VCC = 6.0 V', min: 4.2, typ: null, max: null, unit: 'V', tj: 25 },
      { key: 'vil_2', param: 'Low-level input voltage', sym: 'VIL', cond: 'VCC = 2.0 V', min: null, typ: null, max: 0.5, unit: 'V', tj: 25 },
      { key: 'vil_45', param: 'Low-level input voltage', sym: 'VIL', cond: 'VCC = 4.5 V', min: null, typ: null, max: 1.35, unit: 'V', tj: 25 },
      { key: 'vil_6', param: 'Low-level input voltage', sym: 'VIL', cond: 'VCC = 6.0 V', min: null, typ: null, max: 1.8, unit: 'V', tj: 25 },
      { key: 'voh_20', param: 'High-level output voltage, light load', sym: 'VOH', cond: 'VCC = 4.5 V, IO = −20 µA', min: 4.4, typ: 4.5, max: null, unit: 'V', tj: 25 },
      { key: 'voh_4', param: 'High-level output voltage, 4 mA load', sym: 'VOH', cond: 'VCC = 4.5 V, IO = −4 mA', min: 4.18, typ: 4.32, max: null, unit: 'V', tj: 25 },
      { key: 'voh_52', param: 'High-level output voltage, 5.2 mA load', sym: 'VOH', cond: 'VCC = 6.0 V, IO = −5.2 mA', min: 5.68, typ: 5.81, max: null, unit: 'V', tj: 25 },
      { key: 'vol_20', param: 'Low-level output voltage, light load', sym: 'VOL', cond: 'VCC = 4.5 V, IO = 20 µA', min: null, typ: 0, max: 0.1, unit: 'V', tj: 25 },
      { key: 'vol_4', param: 'Low-level output voltage, 4 mA load', sym: 'VOL', cond: 'VCC = 4.5 V, IO = 4 mA', min: null, typ: 0.15, max: 0.26, unit: 'V', tj: 25 },
      { key: 'vol_52', param: 'Low-level output voltage, 5.2 mA load', sym: 'VOL', cond: 'VCC = 6.0 V, IO = 5.2 mA', min: null, typ: 0.16, max: 0.26, unit: 'V', tj: 25 },
      { key: 'ili', param: 'Input leakage current', sym: 'II', cond: 'VCC = 6.0 V, VI = VCC or GND', min: null, typ: null, max: 0.1, unit: 'µA', tj: 25 },
      { key: 'icc', param: 'Quiescent supply current', sym: 'ICC', cond: 'VCC = 6.0 V, VI = VCC or GND, IO = 0', min: null, typ: 0.01, max: 2, unit: 'µA', tj: 25 },
      { key: 'ci', param: 'Input capacitance', sym: 'CI', cond: '', min: null, typ: 3.5, max: 10, unit: 'pF', tj: 25 },
      { key: 'cpd', param: 'Power dissipation capacitance per gate', sym: 'CPD', cond: 'no load, VCC = 5 V', min: null, typ: 22, max: null, unit: 'pF', tj: 25 },
      { key: 'tpd_2', param: 'Propagation delay A, B to Y', sym: 'tpd', cond: 'VCC = 2.0 V, CL = 50 pF', min: null, typ: 30, max: 75, unit: 'ns', tj: 25 },
      { key: 'tpd_45', param: 'Propagation delay A, B to Y', sym: 'tpd', cond: 'VCC = 4.5 V, CL = 50 pF', min: null, typ: 8, max: 15, unit: 'ns', tj: 25 },
      { key: 'tpd_6', param: 'Propagation delay A, B to Y', sym: 'tpd', cond: 'VCC = 6.0 V, CL = 50 pF', min: null, typ: 7, max: 13, unit: 'ns', tj: 25 },
      { key: 'tt_2', param: 'Output transition time', sym: 'tTLH, tTHL', cond: 'VCC = 2.0 V, CL = 50 pF', min: null, typ: 19, max: 75, unit: 'ns', tj: 25 },
      { key: 'tt_45', param: 'Output transition time', sym: 'tTLH, tTHL', cond: 'VCC = 4.5 V, CL = 50 pF', min: null, typ: 7, max: 15, unit: 'ns', tj: 25 },
      { key: 'tt_6', param: 'Output transition time', sym: 'tTLH, tTHL', cond: 'VCC = 6.0 V, CL = 50 pF', min: null, typ: 6, max: 13, unit: 'ns', tj: 25 }
    ],
    graphs: [
      { id: 'tpd_vcc', title: 'Propagation delay vs. supply voltage', xLabel: 'Supply voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Propagation delay', yUnit: 'ns', yScale: 'lin',
        series: [-40, 25, 85, 125].map(function (T) {
          return { name: 'TA = ' + T + ' °C', cond: 'CL = 50 pF', points: xV.map(function (v, i) { return [v, r(base[i] * sc(T), 1)]; }) };
        }), note: 'The delay rises steeply below 3 V and with temperature. The table lists the 25 °C typical values.' },
      { id: 'tpd_t', title: 'Propagation delay vs. temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Propagation delay', yUnit: 'ns', yScale: 'lin',
        series: [3, 4.5, 6].map(function (v) {
          return { name: 'VCC = ' + v + ' V', cond: 'CL = 50 pF', points: xT.map(function (T) { return [T, r(vAt(v) * sc(T), 1)]; }) };
        }), note: 'About +0.33 % per kelvin relative to 25 °C.' }
    ],
    thermal: { rthJA: 250, rthJC: 90, tjMax: 150, ptotMax: 0.5, note: 'Ptot(max) = (150 °C − 25 °C) / 250 K/W = 0.5 W for DIP-14. Dynamic dissipation per gate: P = CPD · VCC² · f + CL · VCC² · f.' },
    pkgDraw: { name: 'DIP-14', kind: 'dip14', dims: [
      { label: 'A (length)', min: 18.5, max: 19.5, unit: 'mm' },
      { label: 'B (body width)', min: 6.1, max: 6.6, unit: 'mm' },
      { label: 'C (row spacing)', min: 7.4, max: 7.9, unit: 'mm' },
      { label: 'e (pitch)', min: 2.44, max: 2.64, unit: 'mm' },
      { label: 'b (lead width)', min: 0.36, max: 0.56, unit: 'mm' },
      { label: 'H (height)', min: 3.2, max: 4.4, unit: 'mm' }
    ] },
    truth: { inputs: ['A', 'B'], outputs: ['Y'], rows: [[0, 0, 1], [0, 1, 1], [1, 0, 1], [1, 1, 0]] },
    timing: [
      { title: 'Propagation delay of one gate (B = 1)', signals: [
        { name: 'A', wave: A1 }, { name: 'B', wave: B1 }, { name: 'Y', wave: nandWave(A1, B1, 2) }
      ], note: 'One tick = 4 ns. Y follows the inverse of A after tpd ≈ 2 ticks = 8 ns (VCC = 4.5 V, CL = 50 pF).' },
      { title: 'B as enable input', signals: [
        { name: 'A', wave: A2 }, { name: 'B', wave: B2 }, { name: 'Y', wave: nandWave(A2, B2, 2) }
      ], note: 'While B = 0 the output stays high regardless of A. Only with B = 1 does the gate invert A.' }
    ],
    app: [
      { title: 'NAND gate as inverter and as SR latch', text: 'Tying both inputs together turns a NAND gate into an inverter. Two cross-coupled NAND gates form an SR latch with active-low inputs. Unused inputs must never float: tie them to VCC or GND.',
        circuit: [
          'S̄ ──┤&├──┬── Q',
          '      ┌───┼──────┐',
          '      │   └──┐   │',
          'R̄ ──┤&├──── Q̄ ─┘'
        ],
        formulas: ['Y = ¬(A · B)', 'Inverter: Y = ¬A  (A and B tied together)', 'tpd(chain of n gates) = n · tpd', 'P(dyn) = (CPD + CL) · VCC² · f'] }
    ],
    order: [
      { type: 'TF-74HC00N', pkg: 'DIP-14', note: 'Tube, 25 pieces' },
      { type: 'TF-74HC00D', pkg: 'SOIC-14', note: 'Tape and reel, 2500 pieces' }
    ],
    glossary: gloss([
      ['NAND gate', 'NAND-Gatter (nicht-UND)', 'Ausgang nur 0, wenn beide Eingänge 1 sind'],
      ['propagation delay', 'Laufzeit (Verzögerung zwischen Eingang und Ausgang)', 'tpd'],
      ['high-level input voltage', 'Eingangsspannung für sicheres High', 'VIH, Mindestwert'],
      ['low-level input voltage', 'Eingangsspannung für sicheres Low', 'VIL, Höchstwert'],
      ['high-level output voltage', 'Ausgangsspannung im High-Zustand', 'VOH'],
      ['low-level output voltage', 'Ausgangsspannung im Low-Zustand', 'VOL'],
      ['output transition time', 'Anstiegs- bzw. Abfallzeit am Ausgang', 'tTLH, tTHL'],
      ['input leakage current', 'Eingangs-Leckstrom', ''],
      ['quiescent supply current', 'Ruhestrom der Versorgung', 'ICC'],
      ['input capacitance', 'Eingangskapazität', 'CI'],
      ['truth table', 'Wahrheitstabelle', ''],
      ['floating input', 'offener (unbeschalteter) Eingang', 'Darf nicht offen bleiben.']
    ])
  };
}

/* ============================================================
   TF-PCF8574  (Vorbild: PCF8574)
   ============================================================ */
function pcf8574() {
  var xI = [1, 2, 5, 10, 15, 20, 25, 30, 40];
  function vol(R) { return function (i) { return R * i * (1 + i / 80) / 1000; }; }
  var xT = [-40, -25, -10, 5, 25, 45, 60, 75, 85];
  var wr = i2c(['S', { v: 0x40 }, { v: 0xFE }, 'P']);
  var addrRegs = [];
  for (var a = 0; a < 8; a++) {
    var b = a.toString(2).padStart(3, '0');
    addrRegs.push({ addr: '0x' + (0x20 + a).toString(16).toUpperCase(), name: 'SLAVE ADDRESS, A2 A1 A0 = ' + b, bits: '6:0', rw: 'W',
      reset: '—', desc: '7-bit address 0100 ' + b + ' = 0x' + (0x20 + a).toString(16).toUpperCase() + '. Address byte on the bus: write 0x' + (0x40 + 2 * a).toString(16).toUpperCase() + ', read 0x' + (0x41 + 2 * a).toString(16).toUpperCase() + '.' });
  }
  return {
    id: 'tf-pcf8574', part: 'TF-PCF8574', family: 'Schnittstellen-IC', mfr: MFR, lang: 'en', ref: 'PCF8574',
    title: 'Remote 8-bit I/O expander for the I²C bus',
    desc: 'The TF-PCF8574 adds eight quasi-bidirectional I/O lines to any microcontroller through the two-wire I²C bus. Three address pins allow eight devices on one bus. An open-drain interrupt output reports input changes, so the host does not have to poll.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Supply voltage 2.5 V to 6 V',
      'I²C bus interface, standard mode up to 100 kHz',
      'Eight quasi-bidirectional ports: strong low, weak high',
      'Output sink current IOL min. 25 mA, but source current only about 100 µA (1 mA only during the low-to-high transition)',
      'Address range 0x20 to 0x27, selected by pins A0, A1, A2',
      'All ports are high (inputs) after power-on reset',
      'Open-drain interrupt output INT, active low',
      'Low standby current, typically 2.5 µA'
    ],
    pins: { pkg: 'DIP-16', pins: [
      { n: 1, name: 'A0', type: 'in', desc: 'Address input 0.' },
      { n: 2, name: 'A1', type: 'in', desc: 'Address input 1.' },
      { n: 3, name: 'A2', type: 'in', desc: 'Address input 2.' },
      { n: 4, name: 'P0', type: 'io', desc: 'Quasi-bidirectional port 0.' },
      { n: 5, name: 'P1', type: 'io', desc: 'Quasi-bidirectional port 1.' },
      { n: 6, name: 'P2', type: 'io', desc: 'Quasi-bidirectional port 2.' },
      { n: 7, name: 'P3', type: 'io', desc: 'Quasi-bidirectional port 3.' },
      { n: 8, name: 'VSS', type: 'gnd', desc: 'Ground.' },
      { n: 9, name: 'P4', type: 'io', desc: 'Quasi-bidirectional port 4.' },
      { n: 10, name: 'P5', type: 'io', desc: 'Quasi-bidirectional port 5.' },
      { n: 11, name: 'P6', type: 'io', desc: 'Quasi-bidirectional port 6.' },
      { n: 12, name: 'P7', type: 'io', desc: 'Quasi-bidirectional port 7.' },
      { n: 13, name: 'INT', type: 'out', desc: 'Interrupt output, open drain, active low. Needs a pull-up resistor.' },
      { n: 14, name: 'SCL', type: 'in', desc: 'I²C serial clock input.' },
      { n: 15, name: 'SDA', type: 'io', desc: 'I²C serial data, open drain. Needs a pull-up resistor.' },
      { n: 16, name: 'VDD', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vdd', param: 'Supply voltage', sym: 'VDD', cond: '', min: -0.5, max: 7, unit: 'V', note: '' },
      { key: 'vi', param: 'Input voltage', sym: 'VI', cond: '', min: -0.5, max: 7.5, unit: 'V', note: 'VI ≤ VDD + 0.5 V' },
      { key: 'iol', param: 'Output sink current per port pin', sym: 'IOL', cond: '', min: null, max: 50, unit: 'mA', note: 'Not an operating value; recommended maximum is 25 mA' },
      { key: 'idd', param: 'Total supply current and total ground current', sym: 'IDD, ISS', cond: '', min: -100, max: 100, unit: 'mA', note: 'All port pins together' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, DIP-16', min: null, max: 500, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vdd', param: 'Supply voltage', sym: 'VDD', min: 2.5, max: 6, unit: 'V' },
      { key: 'vi', param: 'Input voltage', sym: 'VI', min: 0, max: 6, unit: 'V' },
      { key: 'iol', param: 'Output sink current per port pin', sym: 'IOL', min: null, max: 25, unit: 'mA' },
      { key: 'fscl', param: 'SCL clock frequency', sym: 'fSCL', min: 0, max: 100, unit: 'kHz' },
      { key: 'ta', param: 'Ambient temperature', sym: 'TA', min: -40, max: 85, unit: '°C' }
    ],
    elec: [
      { key: 'isb', param: 'Standby supply current', sym: 'ISTB', cond: 'VDD = 5.5 V, VI = VDD or VSS, no I/O load', min: null, typ: 2.5, max: 10, unit: 'µA', tj: 25 },
      { key: 'idd_act', param: 'Operating supply current', sym: 'IDD', cond: 'VDD = 5.5 V, fSCL = 100 kHz', min: null, typ: 100, max: 200, unit: 'µA', tj: 25 },
      { key: 'vpor', param: 'Power-on reset voltage', sym: 'VPOR', cond: 'VDD rising', min: 1, typ: 1.5, max: 2.4, unit: 'V', tj: 25 },
      { key: 'vih', param: 'High-level input voltage (SCL, SDA, ports)', sym: 'VIH', cond: 'VDD = 5 V, 0.7 · VDD', min: 3.5, typ: null, max: null, unit: 'V', tj: 25 },
      { key: 'vil', param: 'Low-level input voltage (SCL, SDA, ports)', sym: 'VIL', cond: 'VDD = 5 V, 0.3 · VDD', min: null, typ: null, max: 1.5, unit: 'V', tj: 25 },
      { key: 'ili', param: 'Input leakage current (SCL, SDA, A0 to A2)', sym: 'IL', cond: 'VI = VDD or VSS', min: -1, typ: null, max: 1, unit: 'µA', tj: 25 },
      { key: 'ci', param: 'Input capacitance (SCL, SDA)', sym: 'CI', cond: '', min: null, typ: 5, max: 7, unit: 'pF', tj: 25 },
      { key: 'cio', param: 'Input/output capacitance (port pins)', sym: 'CIO', cond: '', min: null, typ: 6, max: 10, unit: 'pF', tj: 25 },
      { key: 'iol', param: 'Port output sink current', sym: 'IOL', cond: 'VDD = 4.5 V, VOL = 1.0 V', min: 25, typ: 37, max: null, unit: 'mA', tj: 25 },
      { key: 'vol', param: 'Port output voltage low', sym: 'VOL', cond: 'VDD = 4.5 V, IOL = 10 mA', min: null, typ: 0.2, max: 0.4, unit: 'V', tj: 25 },
      { key: 'ioh_w', param: 'Port source current, weak pull-up (steady state)', sym: 'IOH', cond: 'VDD = 5 V, VO = VSS', min: 30, typ: 100, max: 300, unit: 'µA', tj: 25 },
      { key: 'ioh_s', param: 'Port source current, strong pull-up (short boost)', sym: 'IOH(boost)', cond: 'VDD = 5 V, VO = VSS, during the low-to-high transition only', min: 1, typ: 1.5, max: null, unit: 'mA', tj: 25 },
      { key: 'vol_sda', param: 'SDA / INT output voltage low', sym: 'VOL', cond: 'VDD = 4.5 V, IOL = 3 mA', min: null, typ: 0.2, max: 0.4, unit: 'V', tj: 25 },
      { key: 'fscl', param: 'SCL clock frequency', sym: 'fSCL', cond: 'standard mode', min: 0, typ: null, max: 100, unit: 'kHz', tj: 25 },
      { key: 'tlow', param: 'SCL low time', sym: 'tLOW', cond: '', min: 4.7, typ: null, max: null, unit: 'µs', tj: 25 },
      { key: 'thigh', param: 'SCL high time', sym: 'tHIGH', cond: '', min: 4, typ: null, max: null, unit: 'µs', tj: 25 },
      { key: 'tsu_dat', param: 'Data set-up time', sym: 'tSU;DAT', cond: '', min: 250, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'thd_dat', param: 'Data hold time', sym: 'tHD;DAT', cond: '', min: 0, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'tsu_sta', param: 'Set-up time for a repeated START', sym: 'tSU;STA', cond: '', min: 4.7, typ: null, max: null, unit: 'µs', tj: 25 },
      { key: 'tiv', param: 'Port input change to INT low', sym: 'tiv', cond: 'CL = 100 pF', min: null, typ: 1, max: 4, unit: 'µs', tj: 25 },
      { key: 'tir', param: 'INT reset delay after a read or write', sym: 'tir', cond: 'CL = 100 pF', min: null, typ: 1, max: 4, unit: 'µs', tj: 25 }
    ],
    graphs: [
      { id: 'vol_iol', title: 'Port output voltage low vs. sink current', xLabel: 'Sink current', xUnit: 'mA', xScale: 'lin', yLabel: 'Output voltage low', yUnit: 'V', yScale: 'lin',
        series: [
          { name: 'VDD = 5.0 V', cond: 'Tj = 25 °C', points: pts(xI, vol(18), 3) },
          { name: 'VDD = 3.3 V', cond: 'Tj = 25 °C', points: pts(xI, vol(26), 3) }
        ], note: 'The pull-down is a resistive switch of about 20 Ω. Stay at or below 25 mA per pin and 100 mA in total.' },
      { id: 'isb_t', title: 'Standby supply current vs. temperature', xLabel: 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Standby current', yUnit: 'µA', yScale: 'lin',
        series: [
          { name: 'VDD = 5.5 V', cond: 'no I/O load', points: pts(xT, function (T) { return 2.5 * Math.exp((T - 25) / 55); }, 2) },
          { name: 'VDD = 3.3 V', cond: 'no I/O load', points: pts(xT, function (T) { return 1.4 * Math.exp((T - 25) / 55); }, 2) }
        ], note: 'The leakage doubles roughly every 40 K.' }
    ],
    thermal: { rthJA: 200, rthJC: 70, tjMax: 125, ptotMax: 0.5, note: 'Ptot(max) = (125 °C − 25 °C) / 200 K/W = 0.5 W for DIP-16. Each lit LED at 10 mA with VOL = 0.2 V dissipates only 2 mW inside the chip.' },
    pkgDraw: { name: 'DIP-16', kind: 'dip16', dims: [
      { label: 'A (length)', min: 19, max: 19.8, unit: 'mm' },
      { label: 'B (body width)', min: 6.1, max: 6.6, unit: 'mm' },
      { label: 'C (row spacing)', min: 7.4, max: 7.9, unit: 'mm' },
      { label: 'e (pitch)', min: 2.44, max: 2.64, unit: 'mm' },
      { label: 'b (lead width)', min: 0.36, max: 0.56, unit: 'mm' },
      { label: 'H (height)', min: 3.2, max: 4.4, unit: 'mm' }
    ] },
    timing: [
      { title: 'Write transaction: address 0x20 (write byte 0x40), data 0xFE, P0 low', signals: [
        { name: 'SCL', wave: wr.scl }, { name: 'SDA', wave: wr.sda }
      ], note: 'START: SDA falls while SCL is high. Address byte 0100 000 0 (R/W = 0), ACK from the slave (SDA low), data byte 1111 1110 sets P0 low and P1 to P7 high, ACK, STOP: SDA rises while SCL is high. The new port state appears after the second ACK.' },
      { title: 'Interrupt: input change on P0 until the next read', signals: [
        { name: 'P0 (input)', wave: '1111000000000000' },
        { name: 'INT', wave: '1111100000000111' },
        { name: 'Read cycle', wave: '0000000000110000' }
      ], note: 'INT goes low within tiv ≤ 4 µs after an input changes. A read (or write) of the port clears it after tir ≤ 4 µs. A new change sets it again.' }
    ],
    regs: [
      { addr: '0x00', name: 'PORT (single data byte, no pointer)', bits: '7:0', rw: 'R/W', reset: '0xFF', desc: 'There is no register map: every data byte after the address goes straight to the port. Write: bit = 0 pulls the pin low (strong), bit = 1 releases it to a weak pull-up, so the pin can be used as an input. Read: returns the real voltage level of each pin, not the written value. After power-on reset all ports are high (0xFF, weak pull-up, inputs).' },
      { addr: '0x40', name: 'ADDRESS BYTE layout (A2 A1 A0 = 000, write)', bits: '7:0', rw: 'W', reset: '0x40', desc: 'First byte of every transaction: 0 1 0 0 A2 A1 A0 R/W. Bits 7:4 are fixed to 0100, bits 3:1 equal A2 A1 A0, bit 0 is R/W (0 = write, 1 = read). The 8-bit write byte is 0x40 to 0x4E, the read byte 0x41 to 0x4F.' }
    ].concat(addrRegs),
    app: [
      { title: 'Driving LEDs: sink, not source', text: 'Because the high level is only a weak pull-up (IOH about 100 µA in steady state, 1 mA only during the low-to-high transition), LEDs are connected from VDD through a resistor to the port pin. A written 0 pulls the pin low and the LED lights. The IOL of 25 mA is the limit per pin.',
        circuit: [
          'VDD ── R ── LED(A→K) ── Pn   (Pn = 0: LED on, Pn = 1: LED off)',
          'SDA ──────┬───── SDA   (PCF8574)   INT ──┬── to MCU',
          'SCL ──────┼───── SCL                      Rp',
          'Rp (I²C pull-ups) to VDD                  VDD'
        ],
        formulas: ['R = (VDD − VF − VOL) / IF', 'Example: VDD = 5 V, VF = 2.0 V, VOL = 0.2 V, IF = 10 mA gives R = 280 Ω, choose 270 Ω (E12)', 'Rp(min) = (VDD − 0.4 V) / 3 mA', 'Rp(max) = tr / (0.8473 · Cb)', 'Example: tr = 1 µs, Cb = 100 pF gives Rp(max) = 11.8 kΩ; Rp(min) at 5 V = 1.53 kΩ'] },
      { title: 'Reading an input', text: 'To read a pin, first write a 1 to its bit so that the strong pull-down is off. Then read the port. A button to ground pulls the pin low against the weak pull-up.',
        circuit: ['VDD ──weak 100 µA──┬── Pn ── Button ── GND'],
        formulas: ['Write 0xFF, then read: bit = 0 means button pressed', 'Address: 0x20 + (A2 A1 A0)'] }
    ],
    order: [
      { type: 'TF-PCF8574P', pkg: 'DIP-16', note: 'Tube, 25 pieces' },
      { type: 'TF-PCF8574T', pkg: 'SOIC-16', note: 'Tape and reel, 1000 pieces' }
    ],
    glossary: gloss([
      ['I/O expander', 'Port-Erweiterung (zusätzliche Ein-/Ausgänge)', ''],
      ['quasi-bidirectional', 'quasi-bidirektional (starker Low-, schwacher High-Zustand)', 'Pin ist Ausgang und Eingang zugleich.'],
      ['sink current', 'Senkstrom (Strom in den Pin hinein)', 'IOL, hier bis 25 mA'],
      ['source current', 'Quellstrom (Strom aus dem Pin heraus)', 'IOH, hier nur etwa 100 µA im Dauerbetrieb (1 mA nur beim Übergang von Low nach High)'],
      ['weak pull-up', 'schwacher Pull-up-Widerstand (Stromquelle)', ''],
      ['power-on reset', 'Rücksetzen beim Einschalten', 'Alle Ports high.'],
      ['slave address', 'Slave-Adresse (Bus-Adresse des Bausteins)', '0x20 bis 0x27'],
      ['open drain', 'offener Drain (nur Low aktiv, High über Pull-up)', 'SDA, INT'],
      ['interrupt output', 'Interrupt-Ausgang (meldet Eingangsänderung)', 'INT'],
      ['acknowledge (ACK)', 'Quittierung (Empfänger zieht SDA auf Low)', ''],
      ['start condition', 'Startbedingung (SDA fällt bei SCL high)', ''],
      ['stop condition', 'Stoppbedingung (SDA steigt bei SCL high)', ''],
      ['standby current', 'Ruhestrom im Wartezustand', '']
    ])
  };
}

/* ============================================================
   TF-MCP4151  (Vorbild: MCP4151)
   ============================================================ */
function mcp4151() {
  var xN = [0, 16, 32, 48, 64, 80, 96, 112, 128];
  var xV = [2.7, 3.0, 3.3, 3.6, 4.0, 4.5, 5.0, 5.5];
  function rwb(RAB) { return function (n) { return 0.075 + n * RAB / 128; }; }
  var wr = spi([0x00, 0x40]);
  var inc = spi([0x04]);
  return {
    id: 'tf-mcp4151', part: 'TF-MCP4151', family: 'Digitalpotentiometer', mfr: MFR, lang: 'en', ref: 'MCP4151',
    title: '7-bit single SPI digital potentiometer with volatile wiper',
    desc: 'The TF-MCP4151 is a digitally controlled potentiometer with 129 wiper positions. The wiper is set through an SPI interface and can work as a voltage divider (potentiometer) or as a variable resistor (rheostat). Four resistance versions are available. The wiper is volatile: it is not stored when the supply is removed.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      '7-bit resolution, 129 steps (codes 0 to 128)',
      'End-to-end resistance 5 kΩ, 10 kΩ, 50 kΩ or 100 kΩ (nominal, ±20 %)',
      'SPI interface, mode 0,0 and 1,1, up to 10 MHz',
      'Supply voltage 2.7 V to 5.5 V',
      'Wiper resistance typically 75 Ω at 5.5 V',
      'Volatile wiper: power-on state is mid-scale (code 64)',
      'Commands: write, read, increment, decrement'
    ],
    pins: { pkg: 'DIP-8', pins: [
      { n: 1, name: 'CS', type: 'in', desc: 'Chip select, active low. Data is accepted while CS is low.' },
      { n: 2, name: 'SCK', type: 'in', desc: 'Serial clock input.' },
      { n: 3, name: 'SDI/SDO', type: 'io', desc: 'Serial data in and out (shared pin).' },
      { n: 4, name: 'VSS', type: 'gnd', desc: 'Ground.' },
      { n: 5, name: 'P0A', type: 'io', desc: 'Potentiometer terminal A.' },
      { n: 6, name: 'P0W', type: 'io', desc: 'Potentiometer wiper terminal W.' },
      { n: 7, name: 'P0B', type: 'io', desc: 'Potentiometer terminal B.' },
      { n: 8, name: 'VDD', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vdd', param: 'Supply voltage', sym: 'VDD', cond: '', min: null, max: 7, unit: 'V', note: '' },
      { key: 'vpin', param: 'Voltage on any pin', sym: 'VPIN', cond: 'with respect to VSS', min: -0.6, max: 7, unit: 'V', note: 'VDD + 1.0 V at most' },
      { key: 'iterm', param: 'Current into terminal A, W or B', sym: 'ITERM', cond: '', min: -2.5, max: 2.5, unit: 'mA', note: '' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, DIP-8', min: null, max: 400, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vdd', param: 'Supply voltage', sym: 'VDD', min: 2.7, max: 5.5, unit: 'V' },
      { key: 'vterm', param: 'Voltage on terminals A, W, B', sym: 'VA, VW, VB', min: 0, max: 5.5, unit: 'V' },
      { key: 'iw', param: 'Wiper current', sym: 'IW', min: -2.5, max: 2.5, unit: 'mA' },
      { key: 'fsck', param: 'SCK clock frequency', sym: 'fSCK', min: 0, max: 10, unit: 'MHz' },
      { key: 'ta', param: 'Ambient temperature', sym: 'TA', min: -40, max: 85, unit: '°C' }
    ],
    elec: [
      { key: 'rab_5', param: 'Nominal end-to-end resistance, -502 version', sym: 'RAB', cond: 'A to B, wiper unconnected', min: 4, typ: 5, max: 6, unit: 'kΩ', tj: 25 },
      { key: 'rab_10', param: 'Nominal end-to-end resistance, -103 version', sym: 'RAB', cond: 'A to B, wiper unconnected', min: 8, typ: 10, max: 12, unit: 'kΩ', tj: 25 },
      { key: 'rab_50', param: 'Nominal end-to-end resistance, -503 version', sym: 'RAB', cond: 'A to B, wiper unconnected', min: 40, typ: 50, max: 60, unit: 'kΩ', tj: 25 },
      { key: 'rab_100', param: 'Nominal end-to-end resistance, -104 version', sym: 'RAB', cond: 'A to B, wiper unconnected', min: 80, typ: 100, max: 120, unit: 'kΩ', tj: 25 },
      { key: 'rw_55', param: 'Wiper resistance', sym: 'RW', cond: 'VDD = 5.5 V, IW = 2 mA, code 0', min: null, typ: 75, max: 160, unit: 'Ω', tj: 25 },
      { key: 'rw_27', param: 'Wiper resistance', sym: 'RW', cond: 'VDD = 2.7 V, IW = 0.7 mA, code 0', min: null, typ: 160, max: 300, unit: 'Ω', tj: 25 },
      { key: 'dnl', param: 'Differential non-linearity (rheostat)', sym: 'DNL', cond: 'VDD = 5.5 V', min: -0.5, typ: 0, max: 0.5, unit: 'LSB', tj: 25 },
      { key: 'inl', param: 'Integral non-linearity (rheostat)', sym: 'INL', cond: 'VDD = 5.5 V', min: -1.5, typ: 0, max: 1.5, unit: 'LSB', tj: 25 },
      { key: 'tc', param: 'Resistance temperature coefficient', sym: 'TCR', cond: 'code 64, RAB = 10 kΩ', min: null, typ: 50, max: null, unit: 'ppm/°C', tj: 25 },
      { key: 'idd_st', param: 'Static supply current', sym: 'IDD', cond: 'VDD = 5.5 V, CS = VDD, SCK idle', min: null, typ: 1, max: 3, unit: 'µA', tj: 25 },
      { key: 'idd_act', param: 'Active supply current during a write', sym: 'IDD', cond: 'VDD = 5.5 V, fSCK = 10 MHz', min: null, typ: 0.35, max: 0.75, unit: 'mA', tj: 25 },
      { key: 'vih', param: 'High-level input voltage (% of VDD)', sym: 'VIH', cond: 'CS, SCK, SDI', min: 45, typ: null, max: null, unit: '%', tj: 25 },
      { key: 'vil', param: 'Low-level input voltage (% of VDD)', sym: 'VIL', cond: 'CS, SCK, SDI', min: null, typ: null, max: 20, unit: '%', tj: 25 },
      { key: 'cab', param: 'Terminal capacitance A and B', sym: 'CA, CB', cond: 'f = 1 MHz, wiper at mid-scale', min: null, typ: 75, max: null, unit: 'pF', tj: 25 },
      { key: 'cw', param: 'Wiper capacitance', sym: 'CW', cond: 'f = 1 MHz', min: null, typ: 120, max: null, unit: 'pF', tj: 25 },
      { key: 'bw_5', param: 'Bandwidth −3 dB, 5 kΩ version', sym: 'BW', cond: 'code 64, CL = 30 pF', min: null, typ: 2.0, max: null, unit: 'MHz', tj: 25 },
      { key: 'bw_100', param: 'Bandwidth −3 dB, 100 kΩ version', sym: 'BW', cond: 'code 64, CL = 30 pF', min: null, typ: 0.1, max: null, unit: 'MHz', tj: 25 },
      { key: 'fsck', param: 'SCK clock frequency', sym: 'fSCK', cond: 'VDD = 4.5 V to 5.5 V', min: null, typ: null, max: 10, unit: 'MHz', tj: 25 },
      { key: 'thi', param: 'SCK high and low time', sym: 'tHI, tLO', cond: 'VDD = 4.5 V to 5.5 V', min: 50, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'tsu', param: 'SDI set-up time before SCK rising edge', sym: 'tSU', cond: 'VDD = 4.5 V to 5.5 V', min: 15, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'thd', param: 'SDI hold time after SCK rising edge', sym: 'tHD', cond: 'VDD = 4.5 V to 5.5 V', min: 10, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'tcssc', param: 'CS fall to first SCK edge', sym: 'tCSSC', cond: 'VDD = 4.5 V to 5.5 V', min: 50, typ: null, max: null, unit: 'ns', tj: 25 },
      { key: 'tcsh', param: 'CS high time between commands', sym: 'tCSH', cond: 'VDD = 4.5 V to 5.5 V', min: 100, typ: null, max: null, unit: 'ns', tj: 25 }
    ],
    graphs: [
      { id: 'rwb_n', title: 'Resistance wiper to B vs. wiper code', xLabel: 'Wiper code', xUnit: 'LSB', xScale: 'lin', yLabel: 'Resistance RWB', yUnit: 'kΩ', yScale: 'lin',
        series: [
          { name: 'RAB = 5 kΩ', cond: 'VDD = 5.5 V, nominal values', points: pts(xN, rwb(5), 3) },
          { name: 'RAB = 100 kΩ', cond: 'VDD = 5.5 V, nominal values', points: pts(xN, rwb(100), 3) }
        ], note: 'RWB = RW + n · RAB/128. At code 0 only the wiper resistance of about 75 Ω remains. The step size is RAB/128.' },
      { id: 'rw_vdd', title: 'Wiper resistance vs. supply voltage', xLabel: 'Supply voltage', xUnit: 'V', xScale: 'lin', yLabel: 'Wiper resistance', yUnit: 'Ω', yScale: 'lin',
        series: [
          { name: 'TA = 25 °C', cond: 'code 0', points: pts(xV, function (v) { return 450.7 / v - 6.9; }, 1) },
          { name: 'TA = 85 °C', cond: 'code 0', points: pts(xV, function (v) { return 1.3 * (450.7 / v - 6.9); }, 1) }
        ], note: 'The wiper switch gets weaker at low supply voltage and at high temperature.' }
    ],
    thermal: { rthJA: 250, rthJC: 90, tjMax: 125, ptotMax: 0.4, note: 'Ptot(max) = (125 °C − 25 °C) / 250 K/W = 0.4 W for DIP-8. The wiper current is limited to ±2.5 mA, so the power in the wiper is small.' },
    pkgDraw: { name: 'DIP-8', kind: 'dip8', dims: [
      { label: 'A (length)', min: 9.2, max: 9.8, unit: 'mm' },
      { label: 'B (body width)', min: 6.1, max: 6.6, unit: 'mm' },
      { label: 'C (row spacing)', min: 7.4, max: 7.9, unit: 'mm' },
      { label: 'e (pitch)', min: 2.44, max: 2.64, unit: 'mm' },
      { label: 'b (lead width)', min: 0.36, max: 0.56, unit: 'mm' },
      { label: 'H (height)', min: 3.2, max: 4.4, unit: 'mm' }
    ] },
    timing: [
      { title: 'Write command: wiper = 0x40 (mid-scale)', signals: [
        { name: 'CS', wave: wr.cs }, { name: 'SCK', wave: wr.sck }, { name: 'SDI', wave: wr.sdi }
      ], note: 'Command byte 0x00: address 0000 (wiper), command 00 (write), D9 D8 = 00. Then data byte 0x40 = 64. The wiper moves when CS goes high. MSB first, data sampled at the rising SCK edge.' },
      { title: 'Increment command (one step up)', signals: [
        { name: 'CS', wave: inc.cs }, { name: 'SCK', wave: inc.sck }, { name: 'SDI', wave: inc.sdi }
      ], note: 'Command byte 0x04: address 0000, command 01 (increment). No data byte follows. The wiper moves up by one step, but not beyond code 128.' }
    ],
    regs: [
      { addr: '0x00', name: 'WIPER0', bits: '8:0', rw: 'R/W', reset: '0x040', desc: 'Volatile wiper register. Valid codes 0x000 (wiper at B) to 0x080 (wiper at A). 0x040 = mid-scale. Codes above 0x080 act as full scale. The value is lost when VDD is removed and is mid-scale after power-on.' },
      { addr: '0x04', name: 'TCON', bits: '3:0', rw: 'R/W', reset: '0x0F', desc: 'Terminal control. Bit 3 R0HW (hardware shutdown, read-only), bit 2 R0A, bit 1 R0W, bit 0 R0B: 1 = terminal connected, 0 = disconnected. All terminals are connected after power-on.' },
      { addr: '0x00', name: 'COMMAND byte field AD[3:0]', bits: '7:4', rw: 'W', reset: '—', desc: 'Field of the command byte, not a register. Memory address of the target register: 0x0 = wiper, 0x4 = TCON.' },
      { addr: '0x00', name: 'COMMAND byte field CMD[1:0]', bits: '3:2', rw: 'W', reset: '—', desc: '00 = write data, 01 = increment wiper, 10 = decrement wiper, 11 = read data.' },
      { addr: '0x00', name: 'COMMAND byte field D[9:8]', bits: '1:0', rw: 'W', reset: '—', desc: 'Two data MSBs for write and read commands. Only bit 0 (D8) is used for the 7-bit wiper.' },
      { addr: '0x00', name: 'DATA byte (after the command byte)', bits: '7:0', rw: 'W', reset: '—', desc: 'Low 8 bits of the value, sent after the command byte for write and read commands.' }
    ],
    app: [
      { title: 'Digitally adjustable voltage divider', text: 'With A at VDD, B at ground and the wiper as output, the output voltage is proportional to the wiper code. A high-impedance load (op-amp input) keeps the wiper current small.',
        circuit: [
          'VDD ── P0A',
          '       P0W ──┬── Vout (to op-amp input)',
          'GND ── P0B   (wiper code n = 0 to 128)'
        ],
        formulas: ['Vout = VDD · (n/128)  (high-impedance load)', 'Step: ΔV = VDD/128', 'Example: VDD = 5 V, n = 64 gives Vout = 2.5 V, step = 39 mV', 'RWB = RW + n · RAB/128', 'Example: RAB = 10 kΩ, n = 32 gives RWB = 75 Ω + 2.5 kΩ = 2.575 kΩ'] },
      { title: 'Variable resistor (rheostat) with power-on state', text: 'The wiper is volatile. After every power-on the wiper sits at mid-scale (code 64), so the circuit must work with this value until the microcontroller has written the wanted code.',
        circuit: ['P0W tied to P0A, resistor RWB between W and B'],
        formulas: ['Power-on: n = 64, RWB ≈ RAB/2 + RW', 'Step size: RAB/128 (10 kΩ version: 78 Ω)'] }
    ],
    order: [
      { type: 'TF-MCP4151-502E/P', pkg: 'DIP-8', note: '5 kΩ, tube' },
      { type: 'TF-MCP4151-103E/P', pkg: 'DIP-8', note: '10 kΩ, tube' },
      { type: 'TF-MCP4151-503E/P', pkg: 'DIP-8', note: '50 kΩ, tube' },
      { type: 'TF-MCP4151-104E/P', pkg: 'DIP-8', note: '100 kΩ, tube' }
    ],
    glossary: gloss([
      ['digital potentiometer', 'digital einstellbares Potentiometer', ''],
      ['wiper', 'Schleifer (Abgriff)', 'Anschluss W'],
      ['wiper resistance', 'Schleiferwiderstand (Restwiderstand des Abgriffs)', 'RW'],
      ['rheostat', 'Rheostat (als veränderlicher Widerstand betrieben)', ''],
      ['end-to-end resistance', 'Gesamtwiderstand zwischen den Enden A und B', 'RAB'],
      ['volatile memory', 'flüchtiger Speicher (Wert geht ohne Spannung verloren)', 'Hier: Schleiferstellung'],
      ['mid-scale', 'Mitte des Bereichs (Code 64 von 128)', 'Zustand nach dem Einschalten'],
      ['step / LSB', 'Stufe / niederwertigstes Bit', 'RAB/128 pro Stufe'],
      ['chip select', 'Chipauswahl (aktiv low)', 'CS'],
      ['serial clock', 'serieller Takt', 'SCK'],
      ['integral non-linearity', 'integrale Nichtlinearität', 'INL'],
      ['differential non-linearity', 'differentielle Nichtlinearität', 'DNL'],
      ['terminal', 'Anschluss (A, W oder B)', '']
    ])
  };
}

/* ============================================================
   TF-LM75  (Vorbild: LM75)
   ============================================================ */
function lm75() {
  var xT = [-55, -40, -25, 0, 25, 50, 75, 100, 125];
  var up = [3.0, 2.6, 2.0, 1.7, 1.5, 1.6, 1.8, 2.0, 3.0];
  var ty = [-1.0, -0.7, -0.4, -0.1, 0.2, 0.3, 0.2, -0.1, -0.8];
  var rd = i2c(['S', { v: 0x90 }, { v: 0x00 }, 'RS', { v: 0x91 }, { v: 0x19 }, { v: 0x00, nack: true }, 'P']);
  var addrRegs = [];
  for (var a = 0; a < 8; a++) {
    var b = a.toString(2).padStart(3, '0');
    addrRegs.push({ addr: '0x' + (0x48 + a).toString(16).toUpperCase(), name: 'SLAVE ADDRESS, A2 A1 A0 = ' + b, bits: '6:0', rw: 'W', reset: '—',
      desc: '7-bit address 1001 ' + b + ' = 0x' + (0x48 + a).toString(16).toUpperCase() + '. Address byte on the bus: write 0x' + (0x90 + 2 * a).toString(16).toUpperCase() + ', read 0x' + (0x91 + 2 * a).toString(16).toUpperCase() + '.' });
  }
  return {
    id: 'tf-lm75', part: 'TF-LM75', family: 'Sensor', mfr: MFR, lang: 'en', ref: 'LM75',
    title: 'Digital temperature sensor and thermal watchdog with I²C interface',
    desc: 'The TF-LM75 measures temperature with a built-in band-gap sensor and a 9-bit converter, and makes the result available over the I²C bus. A programmable limit pair (TOS and THYST) drives the open-drain O.S. output, so the device can also work as a stand-alone thermostat.',
    notes: NOTE, disclaimer: NOTE,
    features: [
      'Temperature range −55 °C to +125 °C',
      'Accuracy ±2 °C from −25 °C to +100 °C',
      '9-bit resolution, 0.5 °C per LSB',
      'I²C interface, up to 400 kHz, address range 0x48 to 0x4F (pins A0 to A2)',
      'Supply voltage 3 V to 5.5 V, typical supply current 250 µA',
      'Shutdown mode with about 1 µA',
      'Programmable overtemperature limit and hysteresis, open-drain O.S. output'
    ],
    pins: { pkg: 'SOIC-8', pins: [
      { n: 1, name: 'SDA', type: 'io', desc: 'I²C serial data, open drain. Needs a pull-up resistor.' },
      { n: 2, name: 'SCL', type: 'in', desc: 'I²C serial clock input.' },
      { n: 3, name: 'O.S.', type: 'out', desc: 'Overtemperature shutdown output, open drain. Needs a pull-up resistor.' },
      { n: 4, name: 'GND', type: 'gnd', desc: 'Ground.' },
      { n: 5, name: 'A2', type: 'in', desc: 'Address input 2.' },
      { n: 6, name: 'A1', type: 'in', desc: 'Address input 1.' },
      { n: 7, name: 'A0', type: 'in', desc: 'Address input 0.' },
      { n: 8, name: 'VCC', type: 'pwr', desc: 'Positive supply.' }
    ] },
    abs: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', cond: '', min: -0.3, max: 6.5, unit: 'V', note: '' },
      { key: 'vi', param: 'Voltage on any input or output pin', sym: 'VI', cond: '', min: -0.3, max: 6.5, unit: 'V', note: '' },
      { key: 'iol', param: 'Output sink current (SDA, O.S.)', sym: 'IOL', cond: '', min: null, max: 10, unit: 'mA', note: '' },
      { key: 'ptot', param: 'Power dissipation', sym: 'Ptot', cond: 'TA = 25 °C, SOIC-8', min: null, max: 500, unit: 'mW', note: '' },
      { key: 'tj', param: 'Junction temperature', sym: 'Tj', cond: '', min: null, max: 125, unit: '°C', note: '' },
      { key: 'tstg', param: 'Storage temperature', sym: 'Tstg', cond: '', min: -65, max: 150, unit: '°C', note: '' }
    ],
    rec: [
      { key: 'vcc', param: 'Supply voltage', sym: 'VCC', min: 3, max: 5.5, unit: 'V' },
      { key: 'ta', param: 'Operating temperature (measuring range)', sym: 'TA', min: -55, max: 125, unit: '°C' },
      { key: 'fscl', param: 'SCL clock frequency', sym: 'fSCL', min: 0, max: 400, unit: 'kHz' }
    ],
    elec: [
      { key: 'acc_1', param: 'Temperature error', sym: 'ΔT', cond: 'TA = −25 °C to +100 °C', min: -2, typ: null, max: 2, unit: '°C', tj: 25 },
      { key: 'acc_2', param: 'Temperature error', sym: 'ΔT', cond: 'TA = −55 °C to +125 °C', min: -3, typ: null, max: 3, unit: '°C', tj: 25 },
      { key: 'res', param: 'Resolution', sym: 'LSB', cond: '9 bit, two\'s complement', min: null, typ: 0.5, max: null, unit: '°C', tj: 25 },
      { key: 'tconv', param: 'Conversion time', sym: 'tCONV', cond: '', min: null, typ: 100, max: 150, unit: 'ms', tj: 25 },
      { key: 'icc_op', param: 'Operating supply current', sym: 'ICC', cond: 'VCC = 3.3 V, I²C bus inactive', min: null, typ: 0.25, max: 1, unit: 'mA', tj: 25 },
      { key: 'icc_sd', param: 'Shutdown supply current', sym: 'ISD', cond: 'VCC = 3.3 V, shutdown bit = 1', min: null, typ: 1, max: 5, unit: 'µA', tj: 25 },
      { key: 'vpor', param: 'Power-on reset threshold', sym: 'VPOR', cond: 'VCC rising', min: null, typ: 2.1, max: 2.6, unit: 'V', tj: 25 },
      { key: 'vih', param: 'High-level input voltage (SCL, SDA, A0 to A2)', sym: 'VIH', cond: 'VCC = 3 V to 5.5 V', min: 2.1, typ: null, max: null, unit: 'V', tj: 25 },
      { key: 'vil', param: 'Low-level input voltage (SCL, SDA, A0 to A2)', sym: 'VIL', cond: 'VCC = 3 V to 5.5 V', min: null, typ: null, max: 0.8, unit: 'V', tj: 25 },
      { key: 'vol', param: 'Output voltage low (SDA, O.S.)', sym: 'VOL', cond: 'IOL = 4 mA', min: null, typ: 0.2, max: 0.4, unit: 'V', tj: 25 },
      { key: 'fscl', param: 'SCL clock frequency', sym: 'fSCL', cond: '', min: 0, typ: null, max: 400, unit: 'kHz', tj: 25 },
      { key: 'tlow', param: 'SCL low time', sym: 'tLOW', cond: 'fast mode', min: 1.3, typ: null, max: null, unit: 'µs', tj: 25 },
      { key: 'thigh', param: 'SCL high time', sym: 'tHIGH', cond: 'fast mode', min: 0.6, typ: null, max: null, unit: 'µs', tj: 25 },
      { key: 'tsu_dat', param: 'Data set-up time', sym: 'tSU;DAT', cond: 'fast mode', min: 100, typ: null, max: null, unit: 'ns', tj: 25 }
    ],
    graphs: [
      { id: 'err_t', title: 'Temperature error vs. temperature', xLabel: 'Temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Temperature error', yUnit: '°C', yScale: 'lin',
        series: [
          { name: 'Upper limit', cond: 'VCC = 3.3 V', points: zip(xT, up) },
          { name: 'Typical', cond: 'VCC = 3.3 V', points: zip(xT, ty) },
          { name: 'Lower limit', cond: 'VCC = 3.3 V', points: zip(xT, up.map(function (v) { return -v; })) }
        ], note: 'Guaranteed band: ±2 °C from −25 °C to +100 °C, ±3 °C over the full range.' },
      { id: 'icc_t', title: 'Operating supply current vs. temperature', xLabel: 'Temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Supply current', yUnit: 'mA', yScale: 'lin',
        series: [
          { name: 'VCC = 3.3 V', cond: 'bus inactive', points: pts(xT, function (T) { return 0.25 + 0.0004 * (T - 25); }, 4) },
          { name: 'VCC = 5.0 V', cond: 'bus inactive', points: pts(xT, function (T) { return 0.31 + 0.0005 * (T - 25); }, 4) }
        ], note: 'The supply current is nearly flat. Self-heating is negligible.' },
      { id: 'isd_t', title: 'Shutdown supply current vs. temperature', xLabel: 'Temperature', xUnit: '°C', xScale: 'lin', yLabel: 'Shutdown current', yUnit: 'µA', yScale: 'lin',
        series: [
          { name: 'VCC = 3.3 V', cond: 'shutdown bit = 1', points: pts(xT, function (T) { return Math.exp((T - 25) / 45); }, 3) }
        ], note: 'The leakage rises with temperature. The 5 µA limit in the table applies at 25 °C; at 125 °C the leakage is about 9 µA.' }
    ],
    thermal: { rthJA: 200, rthJC: 55, tjMax: 125, ptotMax: 0.5, note: 'Ptot(max) = (125 °C − 25 °C) / 200 K/W = 0.5 W for SOIC-8. The device dissipates under 1 mW, so self-heating is below 0.2 K. The reading follows the board temperature.' },
    pkgDraw: { name: 'SOIC-8', kind: 'soic8', dims: [
      { label: 'A (body length)', min: 4.8, max: 5, unit: 'mm' },
      { label: 'B (body width)', min: 3.8, max: 4, unit: 'mm' },
      { label: 'C (overall width)', min: 5.8, max: 6.2, unit: 'mm' },
      { label: 'e (pitch)', min: 1.27, max: 1.27, unit: 'mm' },
      { label: 'b (lead width)', min: 0.33, max: 0.51, unit: 'mm' },
      { label: 'H (height)', min: 1.35, max: 1.75, unit: 'mm' }
    ] },
    timing: [
      { title: 'Read temperature (pointer = 0x00), device 0x48', signals: [
        { name: 'SCL', wave: rd.scl }, { name: 'SDA', wave: rd.sda }
      ], note: 'Write the address byte 0x90 and the pointer byte 0x00, then repeated START and the address byte 0x91 (read). The slave sends the MSB (here 0x19 = 25 °C) and, after the master ACK, the LSB 0x00; the master ends with NACK and STOP.' },
      { title: 'O.S. output in comparator mode', signals: [
        { name: 'T > TOS', wave: '0000011111000000' },
        { name: 'T < THYST', wave: '1111000000000011' },
        { name: 'O.S. (active low)', wave: '1111100000000011' }
      ], note: 'O.S. goes low when the temperature exceeds TOS and stays low until the temperature has fallen below THYST (hysteresis). Fault queue = 1.' }
    ],
    regs: [
      { addr: '0x00', name: 'POINTER (command byte, no own address)', bits: '1:0', rw: 'W', reset: '0x00', desc: 'Selects the data register for the next read: 00 = temperature, 01 = configuration, 10 = THYST, 11 = TOS. Bits 7:2 must be 0. The pointer keeps its value until it is written again.' },
      { addr: '0x00', name: 'TEMP', bits: '15:7', rw: 'R', reset: '0x0000', desc: 'Temperature, 9 bit two\'s complement, 0.5 °C per LSB. Two bytes are read, MSB first. Bits 6:0 read as 0. T = signed(bits 15:7) × 0.5 °C. Example: 0x1900 = +25 °C, 0xE700 = −25 °C.' },
      { addr: '0x01', name: 'CONF', bits: '7:0', rw: 'R/W', reset: '0x00', desc: 'Configuration, one byte. Bit 0 shutdown, bit 1 comparator/interrupt mode, bit 2 O.S. polarity, bits 4:3 fault queue, bits 7:5 reserved (0).' },
      { addr: '0x02', name: 'THYST', bits: '15:7', rw: 'R/W', reset: '0x4B00', desc: 'Hysteresis temperature, 9 bit two\'s complement. Default 0x4B00 = +75 °C.' },
      { addr: '0x03', name: 'TOS', bits: '15:7', rw: 'R/W', reset: '0x5000', desc: 'Overtemperature shutdown limit, 9 bit two\'s complement. Default 0x5000 = +80 °C.' },
      { addr: '0x01', name: 'CONF.SD', bits: '0', rw: 'R/W', reset: '0', desc: 'Shutdown: 1 = converter stopped, supply current about 1 µA; the I²C interface stays active.' },
      { addr: '0x01', name: 'CONF.CMP/INT', bits: '1', rw: 'R/W', reset: '0', desc: '0 = comparator mode (O.S. follows TOS/THYST), 1 = interrupt mode (O.S. is cleared by a read or by shutdown).' },
      { addr: '0x01', name: 'CONF.POL', bits: '2', rw: 'R/W', reset: '0', desc: 'O.S. polarity: 0 = active low, 1 = active high.' },
      { addr: '0x01', name: 'CONF.FQ', bits: '4:3', rw: 'R/W', reset: '00', desc: 'Fault queue: number of consecutive faults before O.S. is set (00 = 1, 01 = 2, 10 = 4, 11 = 6).' }
    ].concat(addrRegs),
    app: [
      { title: 'Reading the temperature', text: 'Read two bytes from the temperature register, combine them to a 16-bit word, shift right by 7 bits to get the 9-bit two\'s-complement value, and multiply by 0.5 °C. If bit 8 of the result is set, the temperature is negative: subtract 512 first.',
        circuit: [
          'MCU SDA ──┬──── SDA (1)   LM75   (8) VCC ── 3.3 V',
          'MCU SCL ──┼──── SCL (2)          A0..A2 ── GND or VCC',
          'Rp to VCC ┘     O.S. (3) ── Rp ── VCC, to MCU input'
        ],
        formulas: ['T = N · 0.5 °C, N = signed 9-bit value = (raw16 >> 7)', 'Examples: 0x1900 → N = 50 → +25.0 °C; 0x0080 → N = 1 → +0.5 °C; 0xE700 → N = −50 → −25.0 °C; 0xC900 → N = −110 → −55.0 °C', 'raw16 = (N mod 512) << 7  (N = T / 0.5 °C)', 'Address = 0x48 + (A2 A1 A0)'] },
      { title: 'Thermostat with O.S. output', text: 'Write the limits to TOS and THYST. In comparator mode O.S. switches a fan or heater driver by itself, with the hysteresis preventing chatter. Default limits are +80 °C and +75 °C.',
        circuit: ['O.S. (open drain) ── Rp ── VCC ── to fan driver input'],
        formulas: ['TOS raw = (T / 0.5 °C) << 7', 'Example: 80 °C → N = 160 → 0x5000, 75 °C → N = 150 → 0x4B00'] }
    ],
    order: [
      { type: 'TF-LM75D', pkg: 'SOIC-8', note: 'Tape and reel, 2500 pieces' }
    ],
    glossary: gloss([
      ['temperature sensor', 'Temperatursensor', ''],
      ['accuracy', 'Genauigkeit (maximaler Messfehler)', 'hier ±2 °C'],
      ['resolution', 'Auflösung (kleinste Stufe)', '0,5 °C pro Bit'],
      ['two\'s complement', 'Zweierkomplement (Darstellung negativer Zahlen)', ''],
      ['register pointer', 'Registerzeiger (wählt das zu lesende Register)', ''],
      ['overtemperature shutdown', 'Übertemperatur-Abschaltung', 'O.S.-Ausgang'],
      ['hysteresis', 'Hysterese (Abstand zwischen Ein- und Ausschaltpunkt)', 'THYST'],
      ['comparator mode', 'Komparatormodus', ''],
      ['interrupt mode', 'Interruptmodus', ''],
      ['fault queue', 'Fehlerzähler (Anzahl Überschreitungen bis zur Meldung)', ''],
      ['conversion time', 'Wandlungszeit', 'tCONV'],
      ['shutdown mode', 'Abschaltmodus (Stromsparbetrieb)', ''],
      ['repeated start', 'wiederholte Startbedingung', '']
    ])
  };
}

/* ---------- Registrierung ---------- */
[lm317, reg7805, ne555, lm358, hc00, pcf8574, mcp4151, lm75].forEach(function (f) { ROOT.DS_LIB.add(f()); });
if (typeof module !== 'undefined' && module.exports) module.exports = ROOT.DS_LIB;
})();
