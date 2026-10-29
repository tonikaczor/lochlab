/* Tonfunk SchaltLab - Stromlaufplan zeichnen und simulieren (Spannungsfarben, Stromweg, Graphen) */
(function () {
'use strict';
const LS = window.LochSim;
const LAB = ['sim', 'code', 'pi', 'digi', 'mess', 'haus'].includes(window.LAB) ? window.LAB : 'sch', LABNAME = { sim: 'SimLab', code: 'Arduino-Lab', pi: 'Pi-Lab', digi: 'DigiLab', mess: 'MessLab', haus: 'HausLab' }[LAB] || 'SchaltLab', SK = { sim: 'sim.', code: 'code.', pi: 'pi.', digi: 'digi.', mess: 'mess.', haus: 'haus.' }[LAB] || 'sch.';
const inLab = K => LAB === 'digi' ? !!K.digi : (!K.lab || K.lab.split(',').includes(LAB));
const PROGLAB = LAB === 'code' || LAB === 'pi';
const WIRECOL = { braun: '#9c6232', blau: '#3b82e0', gruen: '#34b24f', schwarz: '#2b2b2e', grau: '#aab0b8', rot: '#e0463a' };
const WIRENAME = { braun: 'braun (L)', blau: 'blau (N)', gruen: 'grün-gelb (PE)', schwarz: 'schwarz (Schaltdraht)', grau: 'grau', rot: 'rot' };
let wireColor = 'braun';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2000); }
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/* ============ Bauteilarten ============ */
const T2 = [[0, 0], [4, 0]];
const LEDC = ['rot', 'grün', 'gelb', 'blau', 'weiß', 'orange'];
const KINDS = {
  R:   { name: 'Widerstand',      cat: 'Passiv', pins: T2, v: '1k', core: 'R',  box: [0, -1, 4, 1], props: [['v', 'Widerstand', 'text', 'z. B. 4k7']] },
  POT: { name: 'Poti',            cat: 'Passiv', pins: [[0, 0], [4, 0], [2, -2]], v: '10k', core: 'P', map: [0, 2, 1], box: [0, -2.2, 4, 1], pos: true, props: [['v', 'Gesamtwiderstand', 'text', 'z. B. 10k'], ['pos', 'Schleifer', 'range']] },
  C:   { name: 'Kondensator',     cat: 'Passiv', pins: T2, v: '1u', core: 'C',  box: [0, -1.3, 4, 1.3], props: [['v', 'Kapazität', 'text', 'z. B. 100n']] },
  CE:  { name: 'Elko',            cat: 'Passiv', pins: T2, v: '100u', core: 'CE', box: [0, -1.3, 4, 1.3], props: [['v', 'Kapazität', 'text', 'z. B. 100u']] },
  L:   { name: 'Spule',           cat: 'Passiv', pins: T2, v: '10m', core: 'L',  box: [0, -1, 4, 1], props: [['v', 'Induktivität', 'text', 'z. B. 10m']] },
  LDR: { name: 'Fotowiderstand',  cat: 'Passiv', pins: T2, v: '', core: 'LDR', box: [0, -1.3, 4, 1.3], pos: true, props: [['pos', 'Helligkeit', 'range']] },
  LAMP:{ name: 'Glühlampe',       cat: 'Passiv', pins: T2, v: '6V 0.1A', core: 'LAMP', box: [0, -1, 4, 1], dyn: p => (/230\s*V/i.test(String(p.v || '')) ? { pins: [[0, 0], [4, 0], [2, 2]], box: [0, -1, 4, 2.6], toggle: true } : {}), props: [['v', 'Nenndaten', 'text', 'z. B. 6V 0.1A']] },
  D:   { name: 'Diode',           cat: 'Halbleiter', pins: T2, v: '1N4148', core: 'D', box: [0, -1, 4, 1], props: [] },
  ZD:  { name: 'Z-Diode',         cat: 'Halbleiter', pins: T2, v: '5.1', core: 'ZD', box: [0, -1, 4, 1], props: [['v', 'Z-Spannung (V)', 'text', 'z. B. 5.1']] },
  LED: { name: 'LED',             cat: 'Halbleiter', pins: T2, v: 'rot', core: 'LED', box: [0, -1.6, 4, 1], props: [['v', 'Farbe', 'select', LEDC]] },
  NPN: { name: 'NPN-Transistor',  cat: 'Halbleiter', pins: [[0, 0], [2, -2], [2, 2]], v: 'BC547', core: 'T', vr: 'npn-cbe', map: [1, 0, 2], box: [-.2, -2.2, 2.6, 2.2], props: [] },
  PNP: { name: 'PNP-Transistor',  cat: 'Halbleiter', pins: [[0, 0], [2, -2], [2, 2]], v: 'BC557', core: 'T', vr: 'pnp-cbe', map: [1, 0, 2], box: [-.2, -2.2, 2.6, 2.2], props: [] },
  BAT: { name: 'Gleichspannung',  cat: 'Quellen', pins: T2, v: '9', core: 'BAT', box: [0, -1.2, 4, 1.2], props: [['v', 'Spannung (V)', 'text', 'z. B. 9'], ['imax', 'Max. Strom', 'text', 'leer = unbegrenzt, z. B. 100mA']] },
  AC:  { name: 'Wechselspannung', cat: 'Quellen', pins: T2, v: '5V 1kHz', core: 'SIG', vr: 'sin', box: [0, -1.2, 4, 1.2], props: [['v', 'Amplitude und Frequenz', 'text', 'z. B. 5V 1kHz'], ['vr', 'Kurvenform', 'select', ['sin', 'sq', 'tri'], { sin: 'Sinus', sq: 'Rechteck', tri: 'Dreieck' }]] },
  GND: { name: 'Masse',           cat: 'Quellen', pins: [[0, 0]], v: '', core: null, box: [-.8, -.3, .8, 1.3], props: [] },
  SPST:{ name: 'Schalter',        cat: 'Schalter', pins: T2, v: '', core: 'SPST', box: [0, -1.2, 4, 1], toggle: true, props: [] },
  PB:  { name: 'Taster',          cat: 'Schalter', pins: T2, v: '', core: 'SW', box: [0, -1.4, 4, 1], momentary: true, props: [] },
  SPDT:{ name: 'Wechsler',        cat: 'Schalter', pins: [[0, 0], [4, -1], [4, 1]], v: '', core: 'SCH', map: [1, 0, 2], box: [0, -1.5, 4, 1.5], toggle: true, props: [] },
  CABLE: { name: 'Leitung (Kupfer)', cat: 'Netz & Schutz', lab: 'sim', pins: T2, v: '1.5mm2 20m', core: 'CABLE', box: [0, -0.7, 4, 0.7], props: [['v', 'Querschnitt und Länge', 'text', 'z. B. 2.5mm2 30m']] },
  FUSE:{ name: 'Sicherung',   cat: 'Passiv', pins: T2, v: '250mA', core: 'FUSE', box: [0, -0.6, 4, 0.6], props: [['v', 'Nennstrom', 'text', 'z. B. 250mA']] },
  NTC: { name: 'NTC (Heißleiter)', cat: 'Passiv', pins: T2, v: '10k', core: 'NTC', box: [0, -1.3, 4, 1.3], pos: true, pos0: 0.32, props: [['v', 'Widerstand bei 25 °C', 'text', 'z. B. 10k'], ['pos', 'Temperatur (-20 … 120 °C)', 'range']] },
  PTC: { name: 'PTC (Kaltleiter)', cat: 'Passiv', pins: T2, v: '100', core: 'PTC', box: [0, -1.3, 4, 1.3], pos: true, pos0: 0.32, props: [['v', 'Widerstand bei 25 °C', 'text', 'z. B. 100'], ['pos', 'Temperatur (-20 … 120 °C)', 'range']] },
  MOTOR:{ name: 'Gleichstrommotor', cat: 'Passiv', pins: T2, v: '6V', core: 'MOTOR', box: [0, -1.2, 4, 1.2], pos: true, pos0: 0, props: [['v', 'Nennspannung', 'text', 'z. B. 6V'], ['pos', 'Bremse / Last', 'range']] },
  SPK: { name: 'Lautsprecher', cat: 'Passiv', pins: T2, v: '8', core: 'SPK', box: [0, -1.1, 4, 1.1], props: [['v', 'Impedanz (Ω)', 'text', 'z. B. 8']] },
  TRF: { name: 'Transformator', cat: 'Passiv', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: '230V:12V', core: 'TRF', box: [0, -0.4, 6, 4.4], props: [['v', 'Übersetzung', 'text', 'z. B. 230V:12V']] },
  RLY: { name: 'Relais', cat: 'Schalter', pins: [[0, 0], [0, 4], [5, 2], [8, 0], [8, 4]], v: '12V', core: 'RLY', box: [0, -0.4, 8, 4.4], props: [['v', 'Spulenspannung', 'text', 'z. B. 12V']] },
  SCHOTTKY: { name: 'Schottky-Diode', cat: 'Halbleiter', pins: T2, v: '1N5819', core: 'SCHOTTKY', box: [0, -1, 4, 1], props: [['v', 'Typ', 'select', ['1N5819', 'BAT43', 'BAT85', 'SB140']]] },
  NMOS: { name: 'MOSFET N-Kanal', cat: 'Halbleiter', pins: [[0, 0], [2, -2], [2, 2]], v: 'IRLZ44N', core: 'NMOS', box: [-.2, -2.2, 2.6, 2.2], props: [['v', 'Typ', 'select', ['IRLZ44N', 'IRF540N', 'BS170', '2N7000']]] },
  PMOS: { name: 'MOSFET P-Kanal', cat: 'Halbleiter', pins: [[0, 0], [2, -2], [2, 2]], v: 'IRF9540', core: 'PMOS', box: [-.2, -2.2, 2.6, 2.2], props: [['v', 'Typ', 'select', ['IRF9540', 'BS250']]] },
  DIAC: { name: 'DIAC', cat: 'Halbleiter', pins: T2, v: '32V', core: 'DIAC', box: [0, -1, 4, 1], props: [['v', 'Kippspannung', 'select', ['28V', '32V', '35V']]] },
  TRIAC: { name: 'TRIAC', cat: 'Halbleiter', pins: [[0, 0], [4, 0], [3, 2]], v: 'BT136', core: 'TRIAC', box: [0, -1, 4, 2.2], props: [['v', 'Typ', 'select', ['BT136', 'BT138', 'TIC206']]] },
  VDR: { name: 'Varistor (VDR)', cat: 'Halbleiter', pins: T2, v: '275V', core: 'VDR', box: [0, -1, 4, 1], props: [['v', 'Betriebsspannung', 'select', ['14V', '25V', '60V', '275V', '320V']]] },
  SEG8D: { name: 'Duo-7-Segment (2 Ziffern)', cat: 'Halbleiter', pins: [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10], [0, 12], [0, 14], [10, 2], [10, 12]], v: 'rot', core: 'SEG8D', vr: 'k', box: [-0.6, -0.8, 10.6, 15], props: [['vr', 'Bauart', 'select', ['k', 'a'], { k: 'gemeinsame Kathode', a: 'gemeinsame Anode' }]] },
  THY: { name: 'Thyristor', cat: 'Halbleiter', pins: [[0, 0], [4, 0], [3, 2]], v: 'TIC106', core: 'THY', box: [0, -1, 4, 2.2], props: [] },
  PHT: { name: 'Fototransistor', cat: 'Halbleiter', pins: [[2, -2], [2, 2]], v: '', core: 'PHT', box: [-1, -2.2, 2.6, 2.2], pos: true, props: [['pos', 'Helligkeit', 'range']] },
  OPTO:{ name: 'Optokoppler', cat: 'Halbleiter', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: 'PC817', core: 'OPTO', box: [0, -0.4, 6, 4.4], props: [] },
  NETZ:{ name: 'Netz 230 V (L, N, PE)', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [2, 0], [4, 0]], v: '230V', core: 'NETZ', vr: 'ac', box: [-1, -3, 5, 0.3], props: [['v', 'Spannung', 'text', 'z. B. 230V'], ['vr', 'Darstellung', 'select', ['dc', 'ac'], { dc: 'Effektivwert (ruhig)', ac: 'Wechselspannung 50 Hz' }]] },
  LSS: { name: 'Sicherungsautomat', cat: 'Netz & Schutz', lab: 'sim', pins: T2, v: 'B16', core: 'LSS', box: [0, -1.3, 4, 1.1], toggle: true, sw0: 1, props: [['v', 'Typ und Nennstrom', 'text', 'z. B. B16 oder C10']] },
  RCD4:{ name: 'FI-Schutzschalter (vierpolig)', cat: 'Netz & Schutz', lab: 'haus', pins: [[0, 0], [2, 0], [4, 0], [6, 0], [0, 4], [2, 4], [4, 4], [6, 4]], v: '30mA', core: 'RCD4', box: [-0.6, -0.2, 6.6, 4.2], toggle: true, sw0: 1, props: [] },
  RCD: { name: 'FI-Schutzschalter', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [2, 0], [0, 4], [2, 4]], v: '30mA', core: 'RCD', box: [-0.6, -0.2, 2.6, 4.2], toggle: true, sw0: 1, props: [] },
  SCHUETZ:{ name: 'Schütz (2 Haupt- + 2 Hilfskontakte)', cat: 'Schalter', lab: 'sim', pins: [[0, 0], [0, 6], [5, 0], [9, 0], [5, 2], [9, 2], [5, 4], [9, 4], [5, 6], [9, 6]], v: '230V', core: 'SCHUETZ', box: [-0.2, -0.6, 9.4, 6.6], props: [['v', 'Spulenspannung', 'text', 'z. B. 230V']] },
  UNO: { name: 'Arduino Uno', cat: 'Arduino', lab: 'code', pins: [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10], [0, 12], [0, 14], [0, 16], [0, 18], [8, 0], [8, 2], [8, 4], [8, 6], [8, 8], [8, 10], [8, 12], [8, 14], [8, 16], [8, 18], [8, 20], [8, 22], [8, 24], [8, 26], [8, 28], [8, -2]], v: '', core: 'MCU', box: [0, -3, 8, 30], props: [] },
  I2CTEMP: { name: 'Temperatursensor LM75 (I²C)', cat: 'Raspberry Pi', lab: 'pi', pins: [[5, 0], [5, 2], [5, 4], [5, 6]], v: '', core: 'I2CTEMP', box: [0, -1, 5, 7.6], pos: true, pos0: 0.4, props: [['pos', 'Temperatur (−25 … 100 °C)', 'range']] },
  I2CLUX: { name: 'Lichtsensor BH1750 (I²C)', cat: 'Raspberry Pi', lab: 'pi', pins: [[5, 0], [5, 2], [5, 4], [5, 6]], v: '', core: 'I2CLUX', box: [0, -1, 5, 7.6], pos: true, pos0: 0.5, props: [['pos', 'Helligkeit (0 … 2000 lx)', 'range']] },
  MCP3008: { name: 'ADC MCP3008 (SPI, 8 Kanäle)', cat: 'Raspberry Pi', lab: 'pi', pins: [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10], [0, 12], [0, 14], [6, 0], [6, 2], [6, 4], [6, 6], [6, 8], [6, 10], [6, 12], [6, 14]], v: '', core: 'MCP3008', box: [0, -1.5, 6, 15.5], props: [] },
  PI: { name: 'Raspberry Pi (GPIO-Leiste)', cat: 'Raspberry Pi', lab: 'pi', pins: [[0, 0], [8, 0], [0, 2], [8, 2], [0, 4], [8, 4], [0, 6], [8, 6], [0, 8], [8, 8], [0, 10], [8, 10], [0, 12], [8, 12], [0, 14], [8, 14], [0, 16], [8, 16], [0, 18], [8, 18], [0, 20], [8, 20], [0, 22], [8, 22], [0, 24], [8, 24], [0, 26], [8, 26], [0, 28], [8, 28], [0, 30], [8, 30], [0, 32], [8, 32], [0, 34], [8, 34], [0, 36], [8, 36], [0, 38], [8, 38]], v: '', core: 'PI40', box: [0, -2, 8, 40], props: [] },
  DUOLED: { name: 'Duo-LED (rot/grün, 3 Beine)', cat: 'Halbleiter', pins: [[0, 0], [0, 2], [0, 4]], v: 'Kathode', core: 'DUOLED', box: [0, -1, 4, 5.4], props: [['v', 'Gemeinsamer Anschluss', 'select', ['Kathode', 'Anode']]] },
  RGBLED: { name: 'RGB-LED (4 Beine)', cat: 'Sensoren', lab: 'code', pins: [[0, 0], [0, 2], [0, 4], [4, 2]], v: 'Kathode', core: 'RGBLED', box: [0, -1, 4, 5], props: [['v', 'Gemeinsamer Anschluss', 'select', ['Kathode', 'Anode']]] },
  TMP36: { name: 'Temperatursensor TMP36', cat: 'Sensoren', lab: 'code,pi', pins: [[4, 0], [4, 2], [4, 4]], v: '', core: 'TMP36', box: [0, -1, 4, 5], pos: true, pos0: 0.394, props: [['pos', 'Temperatur (−40 … 125 °C)', 'range']] },
  PIEZO: { name: 'Klopfsensor (Piezo)', cat: 'Sensoren', lab: 'code', pins: [[4, 0], [4, 2]], v: '', core: 'PIEZO', box: [0, -1, 4, 3], pos: true, pos0: 0, props: [['pos', 'Klopfstärke (0 … 5 V)', 'range']] },
  TOUCH: { name: 'Berührungsfläche', cat: 'Sensoren', lab: 'code', pins: [[0, 0]], v: '', core: 'TOUCH', box: [0, -2, 5, 2], pos: true, pos0: 0, props: [['pos', 'Berührung (über 50 % = Finger drauf)', 'range']] },
  PIR: { name: 'Bewegungsmelder PIR', cat: 'Sensoren', lab: 'code,pi', pins: [[0, 0], [0, 2], [0, 4]], v: '', core: 'PIR', box: [0, -1, 5, 5], pos: true, pos0: 0, props: [['pos', 'Bewegung (über 50 % = erkannt)', 'range']] },
  HCSR04: { name: 'Ultraschall HC-SR04', cat: 'Sensoren', lab: 'code,pi', pins: [[0, 0], [0, 2], [0, 4], [0, 6]], v: '', core: 'HCSR04', box: [0, -1.2, 6, 7.2], pos: true, pos0: 0.246, props: [['pos', 'Abstand (2 … 400 cm)', 'range']] },
  SERVO: { name: 'Servo', cat: 'Sensoren', lab: 'code,pi', pins: [[0, 0], [0, 2], [0, 4]], v: '', core: 'SERVO', box: [0, -1, 6, 5], props: [] },
  LCDI2C: { name: 'LCD 16×2 (I²C)', cat: 'Sensoren', lab: 'code', pins: [[9, 0], [9, 2], [9, 4], [9, 6]], v: '', core: 'LCDI2C', box: [0, -1.2, 9, 7.2], props: [] },
  NETZ3:{ name: 'Drehstrom 400 V (L1, L2, L3, N, PE)', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0]], v: '400V', core: 'NETZ3', box: [-1, -3, 9, 0.3], props: [['v', 'Außenleiterspannung', 'text', 'z. B. 400V']] },
  MOTOR3:{ name: 'Drehstrommotor', cat: 'Verbraucher', lab: 'sim', pins: [[0, 0], [2, 0], [4, 0], [6, 3]], v: '400V 2.2kW', core: 'MOTOR3', box: [-0.6, -0.4, 6.6, 4.8], toggle: true, props: [['v', 'Spannung, Leistung (D = Dreieck)', 'text', 'z. B. 400V 2.2kW']] },
  BRUECKE:{ name: 'Brückengleichrichter', cat: 'Halbleiter', pins: [[0, 2], [4, 2], [2, 0], [2, 4]], v: '', core: 'BRUECKE', box: [0, -0.4, 4, 4.4], props: [] },
  REG: { name: 'Spannungsregler 78xx', cat: 'Halbleiter', pins: [[0, 0], [2, 2], [4, 0]], v: '7805', core: 'U', box: [0, -1, 4, 2.4], props: [['v', 'Typ', 'text', 'z. B. 7805 oder 7812']] },
  XTAL:{ name: 'Schwingquarz', cat: 'Passiv', pins: T2, v: '4.1943M', core: 'XTAL', box: [0, -1.1, 4, 1.1], props: [['v', 'Frequenz', 'text', 'z. B. 4.1943M, 32768 oder 16M']] },
  SEG8:{ name: '7-Segment-Anzeige', cat: 'Halbleiter', pins: [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8], [0, 10], [0, 12], [0, 14], [6, 14]], v: 'rot', core: 'SEG8', vr: 'k', box: [-0.6, -0.8, 6.6, 15], props: [['vr', 'Bauart', 'select', ['k', 'a'], { k: 'gemeinsame Kathode', a: 'gemeinsame Anode' }]] },
  PBC: { name: 'Taster (Öffner)', cat: 'Schalter', lab: 'sim', pins: T2, v: '', core: 'SWNC', box: [0, -1.4, 4, 1], momentary: true, props: [] },
  KREUZ:{ name: 'Kreuzschalter', cat: 'Schalter', lab: 'sim', pins: [[0, 0], [2, 0], [0, 4], [2, 4]], v: '', core: 'KREUZ', box: [-0.6, -0.2, 2.6, 4.2], toggle: true, props: [] },
  IMP: { name: 'Stromstoßschalter', cat: 'Schalter', lab: 'sim', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: '230V', core: 'IMP', box: [0, -0.4, 6, 4.4], props: [['v', 'Spulenspannung', 'text', 'z. B. 230V']] },
  HEAT:{ name: 'Heizlüfter', cat: 'Verbraucher', lab: 'sim', pins: [[0, 0], [4, 0], [2, 2]], v: '230V 2000W', core: 'LAMP', box: [0, -1.1, 4, 2.6], toggle: true, props: [['v', 'Spannung und Leistung', 'text', 'z. B. 230V 2000W']] },
  SD:  { name: 'Steckdose', cat: 'Verbraucher', lab: 'sim', pins: [[4, 0], [4, 2], [4, 4]], v: '1000W', core: 'SD', box: [0, -0.9, 4, 4.9], toggle: true, props: [['v', 'Angeschlossenes Gerät (Leistung)', 'text', 'z. B. 2000W, leer = nichts angesteckt']] },
  JUN5:{ name: 'Verteilerklemme 5-polig', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [0, 2], [0, 4], [0, 6], [0, 8]], v: '', core: 'JUN', box: [-0.6, -0.8, 1.4, 8.8], props: [] },
  FAULT:{ name: 'Fehlerstelle (Kurzschluss)', cat: 'Verbraucher', lab: 'sim', pins: T2, v: '0.05', core: 'FAULT', box: [0, -1.4, 4, 1.2], toggle: true, props: [['v', 'Widerstand der Fehlerstelle (Ω)', 'text', 'z. B. 0.05 = Kurzschluss']] },
  AND: { name: 'UND-Gatter',   cat: 'Logik', pins: [[0, 0], [0, 2], [4, 1]], v: '5V', core: 'GATE', vr: 'and',  box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  NAND:{ name: 'NAND-Gatter',  cat: 'Logik', pins: [[0, 0], [0, 2], [4, 1]], v: '5V', core: 'GATE', vr: 'nand', box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  OR:  { name: 'ODER-Gatter',  cat: 'Logik', pins: [[0, 0], [0, 2], [4, 1]], v: '5V', core: 'GATE', vr: 'or',   box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  NOR: { name: 'NOR-Gatter',   cat: 'Logik', pins: [[0, 0], [0, 2], [4, 1]], v: '5V', core: 'GATE', vr: 'nor',  box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  XOR: { name: 'XOR-Gatter',   cat: 'Logik', pins: [[0, 0], [0, 2], [4, 1]], v: '5V', core: 'GATE', vr: 'xor',  box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  NOT: { name: 'NICHT-Gatter', cat: 'Logik', pins: [[0, 1], [4, 1]], v: '5V', core: 'GATE', vr: 'not',  box: [0, .2, 4, 1.8], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  SNOT:{ name: 'NICHT (Schmitt)', cat: 'Logik', pins: [[0, 1], [4, 1]], v: '5V', core: 'GATE', vr: 'snot', box: [0, .2, 4, 1.8], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  DFF: { name: 'D-Flipflop',   cat: 'Logik', pins: [[0, 0], [0, 2], [4, 0], [4, 2]], v: '5V', core: 'DFF', box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] },
  OPA: { name: 'Operationsverstärker', cat: 'Logik', pins: [[0, 2], [0, 0], [4, 1], [2, -2], [2, 4]], v: 'LM358', core: 'OPA', map: null, box: [0, -2.2, 4, 4.2], props: [] },
  ICX: { name: 'IC (Kästchen)', cat: 'Logik', pins: [[0, 0]], v: 'NE555', n: 8, core: 'IC', box: [0, -1, 6, 7],
         dyn: p => icDyn(p), props: [['ic', 'Typ', 'ictype']] },
  VM:  { name: 'Voltmeter',       cat: 'Messen', pins: T2, v: '', core: 'VM', box: [0, -1.1, 4, 1.1], props: [] },
  AM:  { name: 'Amperemeter',     cat: 'Messen', pins: T2, v: '', core: 'AM', box: [0, -1.1, 4, 1.1], props: [] },
  OHM: { name: 'Durchgangsprüfer (Ω)', cat: 'Messen', lab: 'sim', pins: T2, v: '', core: 'VM', box: [0, -1.1, 4, 1.1], props: [] },
  ISO: { name: 'Isolationsmessgerät (500 V)', cat: 'Messen', lab: 'sim', pins: T2, v: '', core: 'VM', box: [0, -1.1, 4, 1.1], props: [] },
  ZS:  { name: 'Schleifenimpedanz (Zs)', cat: 'Messen', lab: 'sim', pins: T2, v: '', core: 'VM', box: [0, -1.1, 4, 1.1], props: [] },
};

/* ---- DigiLab: zusätzliche Bausteine und Auswahl ---- */
KINDS.CLK = { name: 'Taktgeber', cat: 'Quellen', lab: 'digi', pins: T2, v: '1Hz', core: 'CLK', box: [0, -1.2, 4, 1.2], props: [['v', 'Takt (z. B. 2Hz, 100Hz)', 'text', 'z. B. 2Hz']] };
KINDS.JKFF = { name: 'JK-Flipflop', cat: 'Logik', lab: 'digi', pins: [[0, 0], [0, 2], [0, 4], [4, 0], [4, 4]], v: '5V', core: 'JKFF', box: [0, -.6, 4, 4.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] };
KINDS.TFF = { name: 'T-Flipflop', cat: 'Logik', lab: 'digi', pins: [[0, 0], [0, 2], [4, 0], [4, 2]], v: '5V', core: 'TFF', box: [0, -.6, 4, 2.6], props: [['v', 'Logikpegel', 'text', 'z. B. 5V']] };
KINDS.CPU = Object.assign({}, KINDS.ICX, { name: 'Mini-CPU (4 Bit)', lab: 'digi', v: 'CPU4', n: 16, props: [] });
['BAT', 'GND', 'CLK', 'SPST', 'PB', 'LED', 'SEG8', 'R', 'C', 'AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT', 'SNOT', 'DFF', 'JKFF', 'TFF', 'ICX', 'CPU', 'VM', 'POT', 'XTAL'].forEach(k => { if (KINDS[k]) KINDS[k].digi = true; });
const CATS = LAB === 'digi' ? ['Quellen', 'Schalter', 'Logik', 'Halbleiter', 'Passiv', 'Messen'] : LAB === 'pi' ? ['Raspberry Pi', 'Sensoren', 'Quellen', 'Passiv', 'Halbleiter', 'Schalter', 'Messen'] : LAB === 'code' ? ['Arduino', 'Sensoren', 'Quellen', 'Passiv', 'Halbleiter', 'Schalter', 'Messen'] : LAB === 'sim' ? ['Quellen', 'Netz & Schutz', 'Schalter', 'Verbraucher', 'Passiv', 'Halbleiter', 'Logik', 'Messen'] : ['Quellen', 'Passiv', 'Halbleiter', 'Schalter', 'Logik', 'Messen'];
/* SimLab: Spannungsquellen und Masse stehen ganz oben, dazu die Netzquellen (Netz 230 V, Drehstrom 400 V) */
const SRC_FIRST = LAB === 'sim' ? ['NETZ', 'NETZ3'] : [];
const kindsOf = cat => {
  const all = Object.keys(KINDS).filter(k => KINDS[k].cat === cat && inLab(KINDS[k]));
  if (cat === 'Netz & Schutz') return all.filter(k => !SRC_FIRST.includes(k));
  if (cat === 'Quellen') return SRC_FIRST.filter(k => KINDS[k] && inLab(KINDS[k])).concat(all);
  return all;
};
const rot = (x, y, r) => { switch (r & 3) { case 0: return [x, y]; case 1: return [-y, x]; case 2: return [-x, -y]; default: return [y, -x]; } };
// Zweipolige Bauteile mit gezogenen Beinen: p.len ist der Abstand der beiden Anschlüsse (mindestens die Körperlänge 4), der Körper bleibt gleich groß
const KD = p => { const K = KINDS[p.k]; let r = K.dyn ? Object.assign({}, K, K.dyn(p)) : K; if (p.len > 4 && r.pins === T2) r = Object.assign({}, r, { pins: [[0, 0], [p.len, 0]], box: [r.box[0], r.box[1], p.len, r.box[3]] }); return r; };
const pinsOf = p => KD(p).pins.map(([x, y]) => { const [a, b] = rot(x, y, p.r); return [p.x + a, p.y + b]; });
const gk = (x, y) => x + ',' + y;
// IC-Kästchen: 555 mit Funktionsschaltbild, sonst DIP-Kästchen (Pins 1..n/2 links von oben nach unten, Rest rechts von unten nach oben)
function icDyn(p) {
  const I = window.LochSimICs, def = I && I.find(p.v);
  if (def && def.key === '555' && (p.n || 8) === 8)
    return { pins: [[3, 10], [0, 6], [6, 6], [2, -2], [0, 2], [0, 4], [6, 2], [4, -2]], box: [0, -2.4, 6, 10.4], sym555: true };
  const n = p.n || 8, h = n / 2, pins = [];
  for (let i = 0; i < h; i++) pins.push([0, 2 * i]);
  for (let j = 0; j < h; j++) pins.push([6, 2 * (h - 1 - j)]);
  return { pins, box: [0, -1, 6, 2 * (h - 1) + 1] };
}

const PRE = { XTAL: 'Q', I2CTEMP: 'B', I2CLUX: 'B', MCP3008: 'IC', PI: 'A', PIEZO: 'B', TOUCH: 'B', UNO: 'A', RGBLED: 'LED', DUOLED: 'LED', SCHOTTKY: 'D', NMOS: 'Q', PMOS: 'Q', DIAC: 'V', TRIAC: 'V', VDR: 'RV', SEG8D: 'DS', TMP36: 'B', PIR: 'B', HCSR04: 'B', SERVO: 'M', LCDI2C: 'LCD', NETZ3: 'N', MOTOR3: 'M', BRUECKE: 'B', REG: 'U', SEG8: 'DS', PBC: 'S', SCHUETZ: 'K', JUN5: 'X', FAULT: 'Z', NETZ: 'N', LSS: 'F', RCD: 'FI', KREUZ: 'S', IMP: 'K', HEAT: 'E', SD: 'X', FUSE: 'F', NTC: 'R', PTC: 'R', MOTOR: 'M', SPK: 'LS', TRF: 'TR', RLY: 'K', THY: 'V', PHT: 'T', OPTO: 'OK', AND: 'G', NAND: 'G', OR: 'G', NOR: 'G', XOR: 'G', NOT: 'G', SNOT: 'G', DFF: 'FF', OPA: 'OP', ICX: 'IC', R: 'R', POT: 'P', C: 'C', CE: 'C', L: 'L', LDR: 'R', LAMP: 'E', D: 'D', ZD: 'D', LED: 'LED', NPN: 'T', PNP: 'T', BAT: 'V', AC: 'G', SPST: 'S', PB: 'S', SPDT: 'S', VM: 'VM', AM: 'AM' };
function nextLabel(k, parts) {
  const pre = PRE[k]; if (!pre) return '';
  let m = 0; (parts || sch.parts).forEach(q => { if (q.l && q.l.startsWith(pre) && /^\d+$/.test(q.l.slice(pre.length))) m = Math.max(m, parseInt(q.l.slice(pre.length), 10)); });
  return pre + (m + 1);
}
function assignLabels(parts) { parts.forEach(q => { if (!q.l && PRE[q.k]) q.l = nextLabel(q.k, parts); }); }
/* ============ Zustand ============ */
let sch = { name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] };
let hist = [], hi = -1;
let view = { s: 22, ox: 60, oy: 60 };
let tool = 'select', placeKind = null, placeRot = 0;
let sel = null;                // {t:'part'|'wire', id}
let leg1 = null, ghost = null, wireStart = null, cursor = null, act = null, dirtyDraw = true;
let running = false, sim = null, circ = null, wrapMap = new Map();
let simMode = false;
let tempo = 0.45, dotSpeed = 0.5, graphWin = 0.02;
let simTime = 0, lastFrame = 0, imax = 1e-9, vmax = 1;
const flows = new Map();       // wire id -> Strom (Ende 1 -> Ende 2)
const bodyI = new Map();       // part id -> [Pfade mit Strom]
let scopeBuf = [];             // je Graph: {t:[],v:[],i:[]}
const nid = () => sch.nid++;
const byPart = id => sch.parts.find(p => p.id === id);
const byWire = id => sch.wires.find(w => w.id === id);

/* ============ Verlauf, Speicher ============ */
const snap = () => JSON.stringify({ name: sch.name, parts: sch.parts, wires: sch.wires, nid: sch.nid, scopes: sch.scopes, task: sch.task, code: sch.code, dice: sch.dice, haus: sch.haus });
function commit(noRebuild, noUI) {
  hist = hist.slice(0, hi + 1); hist.push(snap()); if (hist.length > 100) hist.shift(); hi = hist.length - 1;
  try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {}
  if (!noRebuild) rebuild();
  if (!noUI) refreshUI();
  draw();
}
function restore(i) { const s = JSON.parse(hist[i]); Object.assign(sch, s); sch.task = s.task; sch.code = s.code; syncCode(); hi = i; sel = null; rebuild(); refreshUI(); draw(); try { localStorage.setItem((SK + 'cur'), hist[i]); } catch (e) {} }
const undo = () => { if (hi > 0) restore(hi - 1); };
const redo = () => { if (hi < hist.length - 1) restore(hi + 1); };

/* ============ Simulation aufbauen ============ */

/* ---- Messen im spannungsfreien oder Netz-Zustand: Durchgang, Isolation, Schleifenimpedanz (statische Rechnung am Plan) ---- */
const INSTR = { OHM: 1, ISO: 1, ZS: 1 };
const instrPeak = new Map();                                       // Teil-ID -> [{t, v}] (Spannung zwischen den Messspitzen in den letzten 40 ms)
function trackInstr() {
  if (LAB !== 'sim') return;
  sch.parts.forEach(p => { if (!INSTR[p.k]) return; const pn = pinsOf(p), v = Math.abs(sv(gk(...pn[0])) - sv(gk(...pn[1]))); let a = instrPeak.get(p.id); if (!a) instrPeak.set(p.id, a = []); a.push({ t: sim.t, v }); while (a.length && a[0].t < sim.t - 0.04) a.shift(); });
}
const instrVolt = p => { const a = instrPeak.get(p.id); return a && a.length ? Math.max(...a.map(x => x.v)) : 0; };
function staticR(a, b, vtest, mode) {                              // Widerstand zwischen den Punkten a und b bei abgeschalteten Quellen (Netz nur mit Innenwiderstand)
  const parts = []; let nid = 100000;
  sch.parts.forEach(p => {
    if (p.k === 'GND' || INSTR[p.k] || p.k === 'VM' || p.k === 'AM') return;
    const pn = pinsOf(p);
    if ((p.k === 'NETZ' || p.k === 'NETZ3') && mode !== 'zs') return;                          // freigeschaltet: Netz abgeklemmt
    if (p.k === 'NETZ' || p.k === 'NETZ3') { const n3 = p.k === 'NETZ3', ln = n3 ? 3 : 1, nIdx = n3 ? 3 : 1, pe = n3 ? 4 : 2; for (let i = 0; i < ln; i++) parts.push({ id: nid++, k: 'R', v: '0.3', pins: [pn[i], pn[nIdx]], n: 2, sw: 0, pos: 0.5, light: 0.5, pressed: false, vr: undefined, item: {} }); parts.push({ id: nid++, k: 'R', v: '0.01', pins: [pn[nIdx], pn[pe]], n: 2, sw: 0, pos: 0.5, light: 0.5, pressed: false, vr: undefined, item: {} }); return; }
    if (p.k === 'BAT' || p.k === 'SIG' || p.k === 'AC') { parts.push({ id: nid++, k: 'R', v: '0.001', pins: [pn[0], pn[1]], n: 2, sw: 0, pos: 0.5, light: 0.5, pressed: false, item: {} }); return; }
    parts.push(toCore(p));
  });
  const T = { id: nid++, k: 'BAT', v: String(vtest), pins: [a, b], n: 2, sw: 0, pos: 0.5, light: 0.5, pressed: false, item: {} }; parts.push(T);
  const c = LS.buildCircuit({ parts, tracks: [], wires: sch.wires, ground: [b] }), s = LS.createSim(c);
  for (let i = 0; i < 6; i++) s.step(1e-4);
  const e = c.elems.find(x => x.part === T && x.type === 'V'); const I = e ? Math.abs(e.i) : 0;
  return I < 1e-12 ? Infinity : vtest / I;
}
const instrCache = new Map();
function instrRaw(p) {
  const pn = pinsOf(p), a = pn[0], b = pn[1], live = instrVolt(p);
  if (p.k === 'ZS') { if (live < 30) return { warn: 'Keine Spannung' }; return { v: staticR(a, b, 1, 'zs'), kind: 'zs' }; }
  if (live > 30) return { warn: 'Spannung! Erst freischalten' };
  if (p.k === 'ISO') return { v: staticR(a, b, 500, 'iso'), kind: 'iso' };
  return { v: staticR(a, b, 1, 'ohm'), kind: 'ohm' };
}
const fmtOhm = v => (v >= 1000 ? (v / 1000).toFixed(2).replace('.', ',') + ' kΩ' : (v < 10 ? v.toFixed(2) : v.toFixed(1)).replace('.', ',') + ' Ω');
function instrText(p) {
  const now = performance.now(), c = instrCache.get(p.id); let r;
  if (c && now - c.t < 350) r = c.r; else { try { r = instrRaw(p); } catch (e) { r = { warn: '–' }; } instrCache.set(p.id, { t: now, r }); }
  if (r.warn) return '⚡ ' + r.warn;
  const v = r.v;
  if (r.kind === 'iso') { if (!isFinite(v) || v > 5e8) return '> 500 MΩ'; if (v < 1e5) return fmtOhm(v); const M = v / 1e6; return (M < 10 ? M.toFixed(2) : M.toFixed(1)).replace('.', ',') + ' MΩ'; }
  if (!isFinite(v) || v > 1e9) return '∞ Ω (kein Durchgang)';
  return fmtOhm(v);
}
window.SchaltInstr = { staticR: (a, b, v, m) => staticR(a, b, v, m), text: p => instrText(p) };

function toCore(p) {
  const K = KINDS[p.k];
  let pins = pinsOf(p); if (K.map) pins = K.map.map(i => pins[i]);
  return { id: p.id, k: K.core, vr: p.vr != null ? p.vr : K.vr, v: p.v, n: p.n || 2, pins, sw: p.sw ? 1 : 0, pos: p.pos == null ? 0.5 : p.pos, light: p.pos == null ? 0.5 : p.pos, pressed: !!p.pressed, rint: 0.01, defect: p.defect || undefined, item: p };
}
function rebuild() {
  instrPeak.clear(); instrCache.clear();
  const old = circ && sim ? { elems: circ.elems, t: sim.t } : null, oldBuf = scopeBuf;
  wrapMap.clear();
  const parts = [], ground = [];
  sch.parts.forEach(p => {
    if (p.k === 'GND') { ground.push(pinsOf(p)[0]); return; }
    const w = toCore(p); wrapMap.set(p.id, w); parts.push(w);
  });
  circ = LS.buildCircuit({ parts, tracks: [], wires: sch.wires, ground });
  sim = LS.createSim(circ);
  if (old) {                                      // Kondensator- und Spulenzustände übernehmen
    const find = e => old.elems.find(o => o.part && e.part && o.part.id === e.part.id && o.type === e.type && (o.sub || '') === (e.sub || ''));
    circ.elems.forEach(e => { const o = find(e); if (!o) return; if (e.type === 'C') e.vprev = o.vprev; if (e.type === 'L') e.iprev = o.iprev; });
    sim.t = old.t;
  }
  /* Beim Bearbeiten (Absetzen, Verschieben, Draht) bleiben Kurven und Anzeige erhalten, sonst blitzt für einen Moment ein zurückgesetztes Bild auf */
  const keep = old && oldBuf && oldBuf.length === sch.scopes.length;
  scopeBuf = sch.scopes.map((_, i) => (keep ? oldBuf[i] : { t: [], v: [], i: [] }));
  flows.clear();
  if (old && !prog) { try { for (let k = 0; k < 6; k++) sim.step(1e-6); computeFlows(); } catch (e) {} }
}
const sv = key => { const n = circ ? circ.nodeOfKey(key) : -1; return n < 0 || !sim ? NaN : sim.v[n]; };
const hasGround = () => sch.parts.some(p => p.k === 'GND' || p.k === 'NETZ' || p.k === 'NETZ3' || p.k === 'UNO' || p.k === 'PI');

/* ============ Rechenschritte ============ */
function dtFor(rate) {            // Zeitschritt aus dem gewünschten Tempo (simulierte Sekunden je echte Sekunde)
  const perFrame = rate / 60, steps = clamp(Math.round(perFrame / 5e-6), 20, 400);
  return Math.max(perFrame / steps, 1e-9);
}
const rateOf = s => Math.pow(10, -6 + 8 * s);     // Regler 0..1 -> 1 µs/s ... 100 s/s
const LEDRGB = { rot: '255,59,47', 'grün': '47,224,90', gelb: '255,224,51', blau: '61,139,255', 'weiß': '255,255,255', orange: '255,154,47' };
function partCenter(p) { const K = KD(p), [a, b] = rot((K.box[0] + K.box[2]) / 2, (K.box[1] + K.box[3]) / 2, p.r); return [X(p.x + a), Y(p.y + b)]; }

/* ============ Nachbesprechung: nach Kurzschluss, Durchbrennen oder Auslösen gibt es auf Wunsch eine Erklärung ============ */
let incident = null;
const LEDVF_UI = { rot: 1.9, gelb: 2.0, grün: 2.1, blau: 3.0, weiß: 3.1, orange: 2.0 };
const srcMax = () => Math.max(0, ...sch.parts.filter(q => ['BAT', 'AC', 'SIG', 'NETZ'].includes(q.k)).map(q => { const m = String(q.v == null ? '' : q.v).replace(',', '.').match(/([0-9]*\.?[0-9]+)/); return m ? parseFloat(m[1]) : 0; }));
function explainIncident(inc) {
  const ev = inc.ev, p = ev.part && ev.part.item, k = p ? p.k : '', s = (ev.snap && ev.snap.els && ev.snap.els[0]) || {}, I = Math.abs(s.i || s.ic || 0), U = srcMax() || (ev.snap && ev.snap.net) || vmax, name = p ? nm(p) : 'Das Bauteil';
  const sc = x => fmt(x, 'V'); let why = '', fix = '';
  if (ev.kind === 'shock') { why = 'Das Gehäuse von ' + name + ' stand unter Spannung, weil der Schutzleiter (PE) nicht angeschlossen war und ein Körperschluss auftrat. Wer das Gehäuse berührt, bekommt einen Schlag.'; fix = 'Schutzleiter (grün-gelb) vom Gerät an PE des Netzes anschließen. Dann löst bei einem Körperschluss der Automat oder FI aus, bevor jemand gefährdet wird.'; }
  else if (ev.kind === 'trip') {
    if (k === 'RCD') { why = 'Der FI-Schutzschalter hat ausgelöst, weil ein Strom nicht über den Neutralleiter zurückfloss, sondern woanders hin (Fehlerstrom über ca. 30 mA, zum Beispiel über das Gehäuse oder einen Menschen).'; fix = 'Fehlerstelle suchen: ein Gerät mit Körperschluss oder Isolationsfehler, N und PE vertauscht oder verbunden. Danach den FI wieder einschalten (Schaltschrank-Ansicht).'; }
    else { why = 'Der Sicherungsautomat hat bei ' + fmt(I, 'A') + ' ausgelöst. Das ist ein Kurzschluss (sofortiges Auslösen) oder eine Überlast (Strom dauerhaft über dem Nennstrom, Auslösen nach einigen Sekunden).'; fix = 'Erst den Fehler beseitigen (Kurzschluss zwischen L und N oder zu viele Verbraucher an einem Stromkreis), dann den Automaten wieder einschalten. Sonst löst er gleich wieder aus.'; }
  } else if (k === 'LED') {
    const vf = LEDVF_UI[p.v] || 2, R = U > vf ? (U - vf) / 0.015 : NaN;
    why = 'Durch ' + name + ' floss ' + fmt(I, 'A') + '. Erlaubt sind etwa ' + fmt(s.imax || 0.02, 'A') + '. Eine LED begrenzt ihren Strom nicht selbst: Der Vorwiderstand fehlt oder ist viel zu klein.';
    fix = 'Vorwiderstand einbauen: R = (U − Uf) / If.' + (isFinite(R) ? ' Bei ' + sc(U) + ' Versorgung, Uf ≈ ' + vf + ' V und 15 mA ergibt das etwa ' + fmt(R, 'Ω') + ' (nächster Normwert nehmen, lieber etwas größer).' : '');
  } else if (['R', 'POT', 'NTC', 'PTC', 'LDR'].includes(k)) {
    const Rv = protoNum(p.v), P = isFinite(Rv) ? I * I * Rv : (s.power || 0);
    why = name + ' wurde mit ' + fmt(P, 'W') + ' belastet (Strom ' + fmt(I, 'A') + '). In der Simulation hält ein Widerstand etwa 1,5 W aus. Die Leistung wird zu Wärme: P = I² · R.';
    fix = 'Strom verkleinern (größerer Widerstandswert im Kreis, Kurzschluss nebenan beseitigen) oder einen Leistungswiderstand mit höherer Wattzahl nehmen.';
  } else if (['C', 'CE', 'CF'].includes(k)) {
    why = 'Am Kondensator ' + name + ' lagen ' + sc(Math.abs(s.vj || U)) + ' an' + (s.vmax ? ', zugelassen sind ' + sc(s.vmax) : '') + '. Bei Überspannung schlägt das Dielektrikum durch, Elkos platzen auch bei falscher Polung.';
    fix = 'Kondensator mit höherer Spannungsfestigkeit nehmen (mindestens das 1,5-Fache der Betriebsspannung) und bei Elkos auf die Polung (Minus-Streifen) achten.';
  } else if (['D', 'ZD', 'SCHOTTKY'].includes(k)) {
    why = ev.text + '. Eine Diode sperrt nur bis zu ihrer Grenzspannung, darüber bricht sie durch.';
    fix = 'Diode mit höherer Sperrspannung wählen (zum Beispiel 1N4007 statt 1N4148 bei Netzteilen) oder bei Z-Dioden den Strom mit dem Vorwiderstand begrenzen.';
  } else if (['NPN', 'PNP', 'NMOS', 'PMOS'].includes(k)) {
    why = ev.text + '. Strom (' + fmt(I, 'A') + ') und Spannung am Transistor ergaben zu viel Verlustleistung, oder die Steuerspannung war zu hoch.';
    fix = 'Basis- bzw. Gatewiderstand prüfen, Last verkleinern oder einen größeren Typ mit Kühlkörper nehmen. Bei MOSFETs das Gate nie über etwa 20 V treiben.';
  } else if (k === 'FUSE') {
    why = 'Die Sicherung hat bei ' + fmt(I, 'A') + ' angesprochen, weil der Strom über ihrem Nennwert lag. Genau dafür ist sie da: Sie opfert sich, bevor Leitung oder Gerät Schaden nehmen.';
    fix = 'Ursache der Überlast beseitigen, dann eine neue Sicherung mit demselben Nennwert einsetzen (nie überbrücken oder eine stärkere nehmen).';
  } else if (k === 'LAMP' || k === 'MOTOR' || k === 'SPK') {
    why = ev.text + '. Das Bauteil bekam mehr Spannung oder Leistung, als es verträgt (Strom ' + fmt(I, 'A') + ').';
    fix = 'Betriebsspannung und Nennleistung auf dem Bauteil prüfen und die Versorgung passend wählen. Bei Motoren: nicht blockieren, sonst überhitzt er.';
  } else if (['UNO', 'PI', 'ICX', 'IC', 'U', 'OPA'].includes(k)) {
    why = ev.text + '. Pins und Versorgung von ICs vertragen nur kleine Ströme und enge Spannungsgrenzen (Arduino 5 V, Pi 3,3 V, Pinstrom wenige mA).';
    fix = 'Immer einen Vorwiderstand oder Treiber (Transistor) einsetzen und die Pegel prüfen: Beim Pi nie 5 V auf einen GPIO-Pin geben.';
  } else { why = ev.text + '.'; fix = 'Prüfe Strom und Spannung am Bauteil mit dem Multimeter und vergleiche sie mit den Angaben des Bauteils.'; }
  return '<p style="margin:6px 0"><b>Was ist passiert?</b><br>' + esc(why) + '</p><p style="margin:6px 0"><b>Wie behebst du es?</b><br>' + esc(fix) + '</p>';
}
function incidentCardHtml() {
  if (!incident || !simMode) return '';
  const hold = sch.dice && !sch.dice.solved;                      // beim Detektiv-Fall und beim Fehler-Würfel keine Lösung verraten
  return `<div class="card" style="border-color:#c97a1a"><h4>⚠ Hinweis</h4><b>${esc(incident.ev.text)}</b>` + (hold ? '<p class="hint2">Die Erklärung gibt es, sobald du den Fehler gefunden hast.</p>' : incident.open ? explainIncident(incident) + '<div class="row2"><button class="btn" data-a="whyx">Schließen</button></div>' : '<div class="row2"><button class="btn" data-a="why">Warum? Erkläre mir das</button><button class="btn" data-a="whyx">Ausblenden</button></div>') + '</div>';
}
function onBurn(ev) {
  const p = ev.part && ev.part.item; if (!p) return;
  toast(ev.text); if (window.Feel) window.Feel.event(ev.kind);
  incident = { ev, open: false }; refreshUI();
  if (!window.LochFX) return;
  if (ev.kind === 'shock') { const [sx, sy] = partCenter(p); LochFX.trip(sx, sy, 'ZAP!', view.s, { kind: 'shock' }); draw(); refreshUI(); return; }
  if (ev.kind === 'trip') { const [tx, ty] = partCenter(p); LochFX.trip(tx, ty, p.k === 'RCD' ? 'FI! KLACK!' : 'KLACK!', view.s, { kind: 'trip', part: p.k }); draw(); refreshUI(); return; }
  const [x, y] = partCenter(p), led = p.k === 'LED';
  const TXT = { FUSE: 'ZACK!', MOTOR: 'BRRRZ!', LAMP: 'KLIRR!', SPK: 'KRAWUMM!' };
  LochFX.explode(x, y, { text: TXT[p.k], part: p.k, why: ev.text, kind: led ? 'led' : (p.k === 'R' || p.k === 'POT' || p.k === 'FUSE' || p.k === 'LAMP' ? 'res' : (['NPN', 'PNP', 'THY', 'OPTO', 'ICX', 'AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT', 'SNOT', 'DFF', 'OPA'].includes(p.k) ? 'chip' : 'big')), color: led ? (LEDRGB[p.v] || '255,59,47') : '255,170,60', scale: view.s, at: () => partCenter(p) });
}
/* Taster halten mindestens 100 ms Simulationszeit gedrückt: bei langsamem Tempo wäre ein kurzer Klick sonst für Relais und Stromstoßschalter unsichtbar */
const pressT0 = new Map(), relPend = new Set();
function pressPart(part) { if (window.Feel) window.Feel.tap('press'); part.pressed = true; const w = wrapMap.get(part.id); if (w) w.pressed = true; pressT0.set(part.id, sim ? sim.t : 0); relPend.delete(part.id); }
function releasePart(part, force) {
  if (!force && simMode && sim && sim.t - (pressT0.get(part.id) || 0) < 0.1) { relPend.add(part.id); return; }
  part.pressed = false; const w = wrapMap.get(part.id); if (w) w.pressed = false; relPend.delete(part.id); if (window.Feel) window.Feel.tap('release');
}

/* ============ Zeitreise: Simulation zurückspulen und Schritt für Schritt ansehen ============ */
const TL_MAX = 400; let tl = [], tlLast = 0, tlIdx = -1, tlLab = 0;          // tlIdx: -1 = live, sonst Nummer des gezeigten Zustands
function tlClear() { tl = []; tlIdx = -1; }
function tlSnap() {
  const els = circ.elems.map(e => {
    const o = {};
    for (const k in e) {
      const v = e[k]; if (k === 'part' || typeof v === 'function') continue;
      if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || v === null) o[k] = v;
      else if (Array.isArray(v) && v.every(x => typeof x === 'number')) o[k] = v.slice();
      else if (v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) { try { o[k] = JSON.parse(JSON.stringify(v)); } catch (x) {} }
    }
    return o;
  });
  return { t: sim.t, v: Float64Array.from(sim.v), els };
}
function tlCapture() {
  if (!sim || !circ || prog || tlIdx >= 0) return;
  const now = performance.now(); if (now - tlLast < 90) return; tlLast = now;
  tl.push(tlSnap()); if (tl.length > TL_MAX) tl.shift();
}
function tlLabel() {
  const r = $('#tlR'), t = $('#tlT'); if (!r) return;
  r.max = Math.max(0, tl.length - 1); r.value = tlIdx >= 0 ? tlIdx : tl.length - 1;
  if (t) t.textContent = tl.length ? (tlIdx >= 0 ? 'Zeitreise ' : 'live ') + fmtT(tl[tlIdx >= 0 ? tlIdx : tl.length - 1].t) : '–';
}
function tlGo(i) {
  if (!tl.length || !sim) return; i = Math.max(0, Math.min(tl.length - 1, i)); const sn = tl[i];
  if (sn.els.length !== circ.elems.length) { tlClear(); tlLabel(); return; }
  running = false; tlIdx = i; sim.v.set(sn.v); sim.t = sn.t; sn.els.forEach((o, k) => Object.assign(circ.elems[k], o)); sim.events.length = 0;
  scopeBuf.forEach(b => { while (b.t.length > 1 && b.t[b.t.length - 1] > sn.t) { b.t.pop(); b.v.pop(); b.i.pop(); } });
  computeFlows(); lastSample = sn.t; dirtyDraw = true; draw(); tlLabel();
  const br = $('#bRun'); if (br) { br.textContent = '▶'; br.classList.remove('on'); }
}
function tlLive() { if (tlIdx >= 0) { tl = tl.slice(0, tlIdx + 1); tlIdx = -1; } running = true; lastFrame = performance.now(); const br = $('#bRun'); if (br) { br.textContent = '⏸'; br.classList.add('on'); } }
function tlStepFwd() {
  if (tlIdx >= 0 && tlIdx < tl.length - 1) { tlGo(tlIdx + 1); return; }
  if (tlIdx >= 0) { tl = tl.slice(0, tlIdx + 1); tlIdx = -1; }
  running = false; advance(1 / 20); tlLast = 0; tlCapture(); tlLabel(); dirtyDraw = true; draw();
  const br = $('#bRun'); if (br) { br.textContent = '▶'; br.classList.remove('on'); }
}
function advance(realDt) {
  if (!sim || circ.nn === 0) return;
  const target = rateOf(tempo) * realDt, dt = dtFor(rateOf(tempo));
  const n = Math.max(1, Math.round(target / dt)), t0 = performance.now();
  const every = graphWin / 400;
  for (let i = 0; i < n; i++) {
    sim.step(dt);
    if (prog) stepProgram();
    sampleScopes(every); trackInstr(); if (window.LAB_STEP) window.LAB_STEP(dt);
    if (tool === 'meter') meterSample(dt);
    if ((i & 15) === 15 && performance.now() - t0 > 11) break;
  }
  if (relPend.size) relPend.forEach(id => { const p = byPart(id); if (!p || sim.t - (pressT0.get(id) || 0) >= 0.1) { if (p) releasePart(p, true); relPend.delete(id); if (refreshControls) refreshControls(); } });
  while (sim.events.length) onBurn(sim.events.shift());
  computeFlows(); tlCapture(); if (window.Feel) window.Feel.watch(circ.elems, running);
}
function termI(e) {
  if (e.tI) return e.tI;
  switch (e.type) {
    case 'Q': return [e.ic, e.ib, -(e.ic + e.ib)];
    case 'V': return [-e.i, e.i];
    case 'TRF': return [e.i1, -e.i1, e.i2, -e.i2];
    case 'RCD': return [e.i, e.iN, -e.i, -e.iN];
    default: return [e.i, -e.i];
  }
}
function computeFlows() {
  // Stromeinspeisung je Punkt (in die Bauteile hinein)
  const J = new Map(), pk = (p, i) => gk(...pinsOf(p)[i]);
  const tI = [];
  circ.elems.forEach(e => {
    const w = e.part && e.part.item; if (!w) return;
    const K = KINDS[w.k], map = K.map;
    const I = termI(e); const physPins = pinsOf(w);
    e.pi.forEach((ci, j) => {
      const oi = map ? map[ci] : ci;
      const key = gk(physPins[oi][0], physPins[oi][1]);
      J.set(key, (J.get(key) || 0) + (I[j] || 0));
    });
  });
  // Graph aus Drähten
  const adj = new Map();
  sch.wires.forEach(w => {
    const a = gk(w.x1, w.y1), b = gk(w.x2, w.y2);
    if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push({ w, to: b, dir: 1 }); adj.get(b).push({ w, to: a, dir: -1 });
  });
  flows.clear(); const seen = new Set(); let mx = 0;
  adj.forEach((_, root) => {
    if (seen.has(root)) return;
    const order = [], parent = new Map(); parent.set(root, null); seen.add(root);
    const st = [root];
    while (st.length) { const k = st.pop(); order.push(k); for (const ed of adj.get(k)) if (!seen.has(ed.to)) { seen.add(ed.to); parent.set(ed.to, { k, ed }); st.push(ed.to); } }
    const sub = new Map(); order.forEach(k => sub.set(k, J.get(k) || 0));
    for (let i = order.length - 1; i > 0; i--) {
      const k = order[i], pr = parent.get(k); sub.set(pr.k, sub.get(pr.k) + sub.get(k));
      // Strom von Elternknoten zu Kind = Summe der Einspeisung im Teilbaum
      const f = sub.get(k), ed = pr.ed;                // ed: Kante von Eltern zu Kind, dir=+1 wenn Eltern = Ende 1
      flows.set(ed.w.id, ed.dir === 1 ? f : -f); mx = Math.max(mx, Math.abs(f));
    }
  });
  // Körper-Ströme
  bodyI.clear();
  circ.elems.forEach(e => {
    const w = e.part && e.part.item; if (!w) return;
    let I;
    if (e.type === 'V') I = -e.i; else if (e.type === 'Q') I = e.ic; else I = e.i;
    bodyI.set(w.id + (e.sub ? e.sub : '') + (e.type === 'S' ? '|' + circ.elems.indexOf(e) : ''), { e, I });
    mx = Math.max(mx, Math.abs(I || 0));
  });
  imax = Math.max(mx, 1e-6);                       // Ströme unter ca. 1 µA gelten als "kein Strom"
  let vm = 0.05; for (let i = 1; i <= sim.N; i++) vm = Math.max(vm, Math.abs(sim.v[i])); vmax = vm;     // unter 0,5 % von 50 mV bleibt alles grau (kein Flackern durch Rauschen)
}

/* ============ Graphen ============ */
function scopeValues(sc) {
  if (sc.t === 'node') { const v = sv(sc.key); return [v, NaN]; }
  const p = byPart(sc.id); if (!p || !circ) return [NaN, NaN];
  const pins = pinsOf(p), K = KINDS[p.k], es = circ.elems.filter(e => e.part && e.part.id === p.id);
  const e = es.find(x => x.type !== 'S' || x.closed) || es[0]; if (!e) return [NaN, NaN];
  let v;
  if (e.type === 'Q') v = sv(gk(...pins[1])) - sv(gk(...pins[2]));
  else v = sv(gk(...pins[0])) - sv(gk(...pins[1]));
  const i = e.type === 'Q' ? e.ic : (e.type === 'V' ? -e.i : e.i);
  return [v, i];
}
let lastSample = -1;
function sampleScopes(every) {
  if (sim.t - lastSample < every && lastSample >= 0) return;
  lastSample = sim.t;
  sch.scopes.forEach((sc, k) => {
    const b = scopeBuf[k]; if (!b) return;
    const [v, i] = scopeValues(sc);
    b.t.push(sim.t); b.v.push(v); b.i.push(i);
    const lim = sim.t - graphWin * (window.GRAPH_KEEP || 1.05);
    while (b.t.length > 2 && b.t[0] < lim) { b.t.shift(); b.v.shift(); b.i.shift(); }
  });
}

/* ============ Zeichnen ============ */
const cv = $('#cv');
let cx = cv.getContext('2d');
let PRINT = false;
let dpr = 1;
/* Zeichenfläche nur bei echter Größenänderung neu setzen (das Setzen von width löscht die Fläche) und sofort neu zeichnen, sonst blitzt ein leeres Bild auf */
function resize() {
  const r = cv.getBoundingClientRect(), nd = window.devicePixelRatio || 1, w = Math.round(r.width * nd), h = Math.round(r.height * nd);
  if (w === cv.width && h === cv.height && nd === dpr) return;
  dpr = nd; cv.width = w; cv.height = h; dirtyDraw = true;
  try { render(); dirtyDraw = false; } catch (e) {}
}
new ResizeObserver(resize).observe(cv);
const X = x => view.ox + x * view.s, Y = y => view.oy + y * view.s;
const toGrid = (sx, sy) => [(sx - view.ox) / view.s, (sy - view.oy) / view.s];
const snapG = (gx, gy) => [Math.round(gx), Math.round(gy)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const GRAY = [150, 156, 164], GREEN = [20, 224, 80], RED = [255, 59, 48];
function vcol(v) {
  if (!running && !sim.t || !isFinite(v)) return '#bfc5cc';
  const t = clamp(Math.abs(v) / vmax, 0, 1);
  if (Math.abs(v) < 1e-6 * vmax || t < 0.01) return 'rgb(150,156,164)';
  const c = mix(GRAY, v > 0 ? GREEN : RED, Math.pow(t, 0.6));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const showSim = () => !PRINT && simMode && sim && (sim.t > 0 || running);
const keyV = key => (showSim() ? vcol(sv(key)) : (PRINT ? '#111' : '#bfc5cc'));
function fuseHot(p) {
  const o = showSim() && bodyI.get(String(p.id)), h = o && o.e ? o.e.hot || 0 : 0;
  return h > 0.05 ? `rgb(255,${Math.round(220 - 160 * h)},${Math.round(80 - 60 * h)})` : (PRINT ? '#111' : '#e8eaed');
}
function dotsOnPath(c, pts, I, ph) {
  if (!showSim() || !isFinite(I) || Math.abs(I) < 1e-6 || Math.abs(I) / imax < 0.003) return;
  // Länge
  let L = 0; const seg = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(l); L += l; }
  const sp = 1.0; let off = ((ph.v % sp) + sp) % sp;
  c.fillStyle = waterOn() ? '#d9f1ff' : '#ffe14d'; const dr = waterOn() ? 0.2 : 0.13;
  for (let d = off; d <= L; d += sp) {
    let acc = 0, i = 0; while (i < seg.length - 1 && acc + seg[i] < d) { acc += seg[i]; i++; }
    const u = seg[i] ? (d - acc) / seg[i] : 0;
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
    c.beginPath(); c.arc(x, y, dr, 0, 7); c.fill();
  }
}
const phase = new Map();
function ph(id) { if (!phase.has(id)) phase.set(id, { v: 0 }); return phase.get(id); }
function stepPhases(realDt) {
  const sp = dotSpeed * 7;
  flows.forEach((f, id) => { if (Math.abs(f) >= 1e-6) ph('w' + id).v += (f / imax) * sp * realDt; });
  bodyI.forEach((o, id) => { if (Math.abs(o.I || 0) >= 1e-6) ph('b' + id).v += ((o.I || 0) / imax) * sp * realDt; });
}

const partText = new Map();   // Rechteck des Bezeichnungs- und Werttextes je Bauteil (Pixel), damit die Pin-Anzeige nicht darauf schreibt
function drawPart(p, selected) {
  partText.delete(p.id);
  const K = KD(p), S = view.s, c = cx, pins = pinsOf(p);
  c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(p.r * Math.PI / 2); c.scale(S, S);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const pc = pins.map(q => keyV(gk(q[0], q[1])));
  const body = PRINT ? '#111' : '#e8eaed';
  const lead = (x0, y0, x1, y1, col) => { c.strokeStyle = col; c.lineWidth = 0.13; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  c.strokeStyle = body; c.fillStyle = body; c.lineWidth = 0.11;
  const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  const circle = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); };
  const peStub = (x0, y0, x1, y1, col, fault) => {        // Schutzleiter-Anschluss am Gehäuse (grün-gelb)
    lead(x0, y0, x1, y1, col); c.fillStyle = '#35c24a'; c.beginPath(); c.arc(x1, y1, 0.26, 0, 7); c.fill(); c.strokeStyle = '#f2d21b'; c.lineWidth = 0.1; c.setLineDash([0.18, 0.18]); c.beginPath(); c.arc(x1, y1, 0.26, 0, 7); c.stroke(); c.setLineDash([]);
    c.save(); c.translate(x1 === x0 ? x1 + 0.7 : x1 + 0.2, x1 === x0 ? y1 : y1 - 0.7); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .45px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('PE', 0, 0); c.restore();
    if (fault) { c.strokeStyle = '#ff4d3a'; c.lineWidth = 0.14; c.beginPath(); c.moveTo(x0 - 0.5, y0 - 0.2); c.lineTo(x0 - 0.1, y0 + 0.3); c.lineTo(x0 - 0.4, y0 + 0.3); c.lineTo(x0, y0 + 0.9); c.stroke(); }
  };
  if (p.len > 4 && KINDS[p.k].pins === T2) { const s = (p.len - 4) / 2; lead(0, 0, s, 0, pc[0]); lead(s + 4, 0, p.len, 0, pc[1]); c.translate(s, 0); }   // gezogene Beine: Körper mittig, Zuleitungen verlängert
  switch (p.k) {
    case 'R': lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.4, 2, 0.8); break;
    case 'POT':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.4, 2, 0.8);
      { const wx = 1 + 2 * clamp(p.pos == null ? 0.5 : p.pos, 0, 1);
        lead(2, -2, 2, -1.35, pc[2]); lead(2, -1.35, wx, -1.35, pc[2]); lead(wx, -1.35, wx, -0.8, pc[2]);
        c.beginPath(); c.moveTo(wx - 0.25, -0.95); c.lineTo(wx + 0.25, -0.95); c.lineTo(wx, -0.42); c.closePath(); c.fill(); }
      break;
    case 'LDR':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.4, 2, 0.8);
      line(0.9, -1.3, 1.5, -0.75); line(1.5, -1.3, 2.1, -0.75); break;
    case 'C': case 'CE':
      lead(0, 0, 1.8, 0, pc[0]); lead(2.2, 0, 4, 0, pc[1]); c.lineWidth = 0.16; line(1.8, -1, 1.8, 1); line(2.2, -1, 2.2, 1);
      if (p.k === 'CE') { c.lineWidth = 0.09; line(1.1, -0.75, 1.5, -0.75); line(1.3, -0.95, 1.3, -0.55); } break;
    case 'XTAL':
      lead(0, 0, 1.5, 0, pc[0]); lead(2.5, 0, 4, 0, pc[1]); c.lineWidth = 0.16; line(1.5, -0.9, 1.5, 0.9); line(2.5, -0.9, 2.5, 0.9); c.lineWidth = 0.12; c.strokeRect(1.75, -0.6, 0.5, 1.2); break;
    case 'L':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]);
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(1.25 + i * 0.5, 0, 0.25, Math.PI, 0); c.stroke(); } break;
    case 'D': case 'ZD': case 'LED':
      lead(0, 0, 1.4, 0, pc[0]); lead(2.6, 0, 4, 0, pc[1]);
      c.beginPath(); c.moveTo(1.4, -0.7); c.lineTo(1.4, 0.7); c.lineTo(2.6, 0); c.closePath(); c.stroke();
      line(2.6, -0.7, 2.6, 0.7);
      if (p.k === 'ZD') { line(2.6, -0.7, 2.3, -0.95); line(2.6, 0.7, 2.9, 0.95); }
      if (p.k === 'LED') {
        c.lineWidth = 0.09;
        [[1.7, -1.0], [2.4, -1.0]].forEach(([ax, ay]) => { line(ax, ay, ax + 0.55, ay - 0.55); c.beginPath(); c.moveTo(ax + 0.55, ay - 0.55); c.lineTo(ax + 0.2, ay - 0.5); c.lineTo(ax + 0.5, ay - 0.2); c.closePath(); c.fill(); });
      } break;
    case 'NPN': case 'PNP': {
      lead(0, 0, 1, 0, pc[0]); lead(2, -2, 2, -1.2, pc[1]); lead(2, 2, 2, 1.2, pc[2]);
      c.lineWidth = 0.2; line(1, -0.9, 1, 0.9); c.lineWidth = 0.11;
      line(1, -0.4, 2, -1.2); line(1, 0.4, 2, 1.2);
      c.lineWidth = 0.05; c.strokeStyle = PRINT ? 'rgba(0,0,0,.35)' : 'rgba(232,234,237,.45)'; circle(1.4, 0, 1.55); c.strokeStyle = body; c.lineWidth = 0.11;
      c.beginPath();
      if (p.k === 'NPN') { c.moveTo(2, 1.2); c.lineTo(1.45, 1.1); c.lineTo(1.8, 0.7); } else { c.moveTo(1, 0.4); c.lineTo(1.55, 0.5); c.lineTo(1.2, 0.9); }
      c.closePath(); c.fill(); break; }
    case 'BAT':
      lead(0, 0, 1.8, 0, pc[0]); lead(2.2, 0, 4, 0, pc[1]);
      c.lineWidth = 0.18; line(1.8, -0.95, 1.8, 0.95); line(2.2, -0.5, 2.2, 0.5);
      c.lineWidth = 0.09; line(1.0, -0.75, 1.4, -0.75); line(1.2, -0.95, 1.2, -0.55); break;
    case 'AC':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); circle(2, 0, 1);
      c.beginPath(); for (let i = 0; i <= 20; i++) { const x = 1.35 + i * 0.065, y = -Math.sin(i / 20 * Math.PI * 2) * 0.32; i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); break;
    case 'GND':
      lead(0, 0, 0, 0.55, pc[0]); line(-0.6, 0.55, 0.6, 0.55); line(-0.4, 0.8, 0.4, 0.8); line(-0.18, 1.05, 0.18, 1.05); break;
    case 'SPST': case 'PB': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]);
      circle(1, 0, 0.17); circle(3, 0, 0.17);
      if (p.k === 'SPST') { if (p.sw) line(1, 0, 3, 0); else line(1, 0, 2.85, -0.95); }
      else { const y = p.pressed ? -0.1 : -0.65; line(1.2, y, 2.8, y); line(2, y, 2, y - 0.6); line(1.6, y - 0.6, 2.4, y - 0.6); }
      break; }
    case 'SPDT':
      lead(0, 0, 1, 0, pc[0]); lead(3, -1, 4, -1, pc[1]); lead(3, 1, 4, 1, pc[2]);
      circle(1, 0, 0.17); circle(3, -1, 0.17); circle(3, 1, 0.17);
      line(1, 0, 3, p.sw ? 1 : -1); break;
    case 'AND': case 'NAND': case 'OR': case 'NOR': case 'XOR': case 'NOT': case 'SNOT': {
      const two = pins.length === 3, neg = p.k === 'NAND' || p.k === 'NOR' || p.k === 'NOT' || p.k === 'SNOT';
      const y0 = two ? -.5 : .2, y1 = two ? 2.5 : 1.8, yo = 1;
      if (two) { lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(neg ? 3.45 : 3, yo, 4, yo, pc[2]); }
      else { lead(0, 1, 1, 1, pc[0]); lead(3.45, yo, 4, yo, pc[1]); }
      c.strokeRect(1, y0, 2, y1 - y0);
      if (neg) { c.beginPath(); c.arc(3.22, yo, .22, 0, 7); c.stroke(); }
      c.save(); c.translate(2, yo); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = `600 ${p.k === 'OR' || p.k === 'NOR' ? .8 : 1}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText({ AND: '&', NAND: '&', OR: '≥1', NOR: '≥1', XOR: '=1', NOT: '1', SNOT: '1' }[p.k], 0, .08); c.restore();
      if (p.k === 'SNOT') { c.lineWidth = .08; c.beginPath(); c.moveTo(1.35, y1 - .35); c.lineTo(1.7, y1 - .35); c.lineTo(1.7, y1 - .75); c.lineTo(2.05, y1 - .75); c.stroke(); }
      break; }
    case 'DFF': {
      lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(3, 0, 3.55, 0, pc[2]); lead(3.45, 2, 4, 2, pc[3]); lead(3.55, 0, 4, 0, pc[2]);
      c.strokeRect(1, -.6, 2, 3.2); c.beginPath(); c.arc(3.22, 2, .22, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(1, 1.75); c.lineTo(1.4, 2); c.lineTo(1, 2.25); c.stroke();
      c.save(); c.fillStyle = body; c.font = '600 .8px sans-serif'; c.textBaseline = 'middle';
      [['D', 1.2, 0, 'left'], ['Q', 2.8, 0, 'right'], ['C', 1.5, 2, 'left'], ['Q̄', 2.8, 2, 'right']].forEach(([t, x, y, al]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.textAlign = al; c.fillText(t, 0, 0); c.restore(); });
      c.restore(); break; }
    case 'JKFF': case 'TFF': {
      const jk = p.k === 'JKFF', yq = jk ? 4 : 2, ycl = 2, ymax = jk ? 4.6 : 2.6;
      if (jk) { lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(0, 4, 1, 4, pc[2]); lead(3, 0, 4, 0, pc[3]); lead(3.45, 4, 4, 4, pc[4]); }
      else { lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(3, 0, 4, 0, pc[2]); lead(3.45, 2, 4, 2, pc[3]); }
      c.strokeRect(1, -.6, 2, ymax + .6); c.beginPath(); c.arc(3.22, yq, .22, 0, 7); c.stroke();
      c.beginPath(); c.moveTo(1, ycl - .25); c.lineTo(1.4, ycl); c.lineTo(1, ycl + .25); c.stroke();
      c.save(); c.fillStyle = body; c.font = '600 .8px sans-serif'; c.textBaseline = 'middle';
      (jk ? [['J', 1.2, 0, 'left'], ['C', 1.5, 2, 'left'], ['K', 1.2, 4, 'left'], ['Q', 2.8, 0, 'right'], ['Q̄', 2.8, 4, 'right']] : [['T', 1.2, 0, 'left'], ['C', 1.5, 2, 'left'], ['Q', 2.8, 0, 'right'], ['Q̄', 2.8, 2, 'right']]).forEach(([t, x, y, al]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.textAlign = al; c.fillText(t, 0, 0); c.restore(); });
      c.restore(); break; }
    case 'OPA': {
      lead(0, 0, 1, 0, pc[1]); lead(0, 2, 1, 2, pc[0]); lead(3.4, 1, 4, 1, pc[2]); lead(2, -2, 2, -.2, pc[3]); lead(2, 4, 2, 2.2, pc[4]);
      c.beginPath(); c.moveTo(1, -1); c.lineTo(1, 3); c.lineTo(3.4, 1); c.closePath(); c.stroke();
      c.save(); c.fillStyle = body; c.font = '600 .9px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
      [['−', 1.45, 0], ['+', 1.45, 2]].forEach(([t, x, y]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.fillText(t, 0, 0); c.restore(); });
      c.restore(); break; }
    case 'ICX': case 'CPU': {
      const I = window.LochSimICs, def = I && I.find(p.v), info = def && I.CATALOG[def.key], cfg = K.sym555;
      const nn = pins.length, labs = info && info.np === nn ? info.labels : null;
      const bx0 = 1, bx1 = 5, by0 = cfg ? -1 : K.box[1], by1 = cfg ? 9 : K.box[3];
      const kp = KD(p).pins;
      kp.forEach(([x, y], i) => {
        const left = x < 3 && y >= -1, top = y < 0, bottom = y > by1;
        if (top) lead(x, y, x, by0, pc[i]); else if (bottom) lead(x, y, x, by1, pc[i]); else if (x === 0) lead(0, y, bx0, y, pc[i]); else lead(x, y, bx1, y, pc[i]);
      });
      c.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      c.save(); c.fillStyle = body;
      const T = (t, x, y, size, al) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.font = `600 ${size}px sans-serif`; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 0); c.restore(); };
      kp.forEach(([x, y], i) => {
        const nm = labs ? labs[i] : '', top = y < 0, bottom = y > by1;
        T(String(i + 1), x + (top || bottom ? .45 : (x === 0 ? .45 : -.45)), top ? y + .45 : bottom ? y - .45 : y - .42, .5);
        if (nm) { if (top) T(nm, x, by0 + .55, .55); else if (bottom) T(nm, x, by1 - .55, .55); else if (x === 0) T(nm, bx0 + .2, y, .62, 'left'); else T(nm, bx1 - .2, y, .62, 'right'); }
      });
      if (cfg) T(def ? 'NE555' : (p.v || 'IC'), 3.9, 4, .55); else T(info ? info.name.split(' ')[0] : (p.v || 'IC'), 3, (by0 + by1) / 2, .8);
      c.restore(); break; }
    case 'SCHUETZ': {
      const o = showSim() && bodyI.get(String(p.id)), on = !!(o && o.e.on);
      lead(0, 0, 1, 0, pc[0]); lead(1, 0, 1, 1, pc[0]); lead(1, 5, 1, 6, pc[1]); lead(1, 6, 0, 6, pc[1]);
      c.strokeStyle = body; c.strokeRect(0.6, 1, 0.8, 4); c.beginPath(); c.moveTo(0.6, 5); c.lineTo(1.4, 1); c.stroke();
      [[0, 2, 3, true], [2, 4, 5, false], [4, 6, 7, true], [6, 8, 9, true]].forEach(([y, a, b2, no]) => {
        lead(5, y, 6, y, pc[a]); lead(8, y, 9, y, pc[b2]);
        const closed = no ? on : !on;
        c.strokeStyle = closed ? '#ffe14d' : body; c.lineWidth = 0.12; line(6, y, 8, closed ? y : y - 0.9);
        c.strokeStyle = body; c.lineWidth = 0.1; c.beginPath(); c.arc(6, y, 0.12, 0, 7); c.fill(); c.beginPath(); c.arc(8, y, 0.12, 0, 7); c.fill();
      });
      c.setLineDash([0.25, 0.2]); c.lineWidth = 0.07; line(1.4, 3, 5.6, 3); c.setLineDash([]);
      c.save(); c.translate(3.4, -0.1); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .6px sans-serif'; c.textAlign = 'center'; c.fillText('Schütz', 0, 0); c.restore();
      break; }
    case 'I2CTEMP': case 'I2CLUX': {
      for (let i = 0; i < 4; i++) lead(5, i * 2, 4, i * 2, pc[i]);
      c.strokeStyle = body; c.fillStyle = PRINT ? '#eceff2' : 'rgba(120,130,145,.25)'; c.fillRect(0, -0.8, 4, 7.6); c.strokeRect(0, -0.8, 4, 7.6);
      const T = (t, x, y, size, al) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.font = `600 ${size}px sans-serif`; c.textAlign = al; c.textBaseline = 'middle'; c.fillStyle = body; c.fillText(t, 0, 0); c.restore(); };
      ['VCC', 'SDA', 'SCL', 'GND'].forEach((t, i) => T(t, 3.8, i * 2, 0.5, 'right'));
      const pos = p.pos == null ? K.pos0 : p.pos;
      T(p.k === 'I2CTEMP' ? (-25 + 125 * pos).toFixed(1) + ' °C' : Math.round(pos * pos * 2000) + ' lx', 0.25, 6.1, 0.5, 'left');
      c.save(); c.translate(1.2, 2.2); c.rotate(-p.r * Math.PI / 2 - Math.PI / 2); c.font = '700 .75px sans-serif'; c.textAlign = 'center'; c.fillStyle = body; c.fillText(p.k === 'I2CTEMP' ? 'LM75' : 'BH1750', 0, 0); c.restore();
      break; }
    case 'MCP3008': {
      for (let i = 0; i < 16; i++) { const [px, py] = K.pins[i]; if (px === 0) lead(0, py, 1, py, pc[i]); else lead(6, py, 5, py, pc[i]); }
      c.strokeStyle = body; c.fillStyle = PRINT ? '#eceff2' : 'rgba(120,130,145,.25)'; c.fillRect(1, -1, 4, 16); c.strokeRect(1, -1, 4, 16);
      const T = (t, x, y, size, al) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.font = `600 ${size}px sans-serif`; c.textAlign = al; c.textBaseline = 'middle'; c.fillStyle = body; c.fillText(t, 0, 0); c.restore(); };
      ['VDD', 'VREF', 'AGND', 'DGND', 'CLK', 'DOUT', 'DIN', 'CS'].forEach((t, i) => T(t, 1.2, i * 2, 0.5, 'left'));
      for (let i = 0; i < 8; i++) T('CH' + i, 4.8, i * 2, 0.5, 'right');
      c.save(); c.translate(3, 7); c.rotate(-p.r * Math.PI / 2 - Math.PI / 2); c.font = '700 .8px sans-serif'; c.textAlign = 'center'; c.fillStyle = body; c.fillText('MCP3008', 0, 0); c.restore();
      break; }
    case 'PI': {
      const o = showSim() && bodyI.get(String(p.id)), mm = o && o.e.mcu;
      const T = (t, x, y, size, al, rotv) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2 + (rotv || 0)); c.font = `600 ${size}px sans-serif`; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 0); c.restore(); };
      for (let i = 0; i < 40; i++) { const [px, py] = K.pins[i]; if (px === 0) lead(0, py, 1, py, pc[i]); else lead(8, py, 7, py, pc[i]); }
      c.strokeStyle = body; c.fillStyle = PRINT ? '#f2f7ee' : 'rgba(60,150,60,.20)'; c.fillRect(1, -1.5, 6, 41); c.strokeRect(1, -1.5, 6, 41);
      c.fillStyle = body;
      PI_NAMES.forEach((nm, i) => { const [px, py] = K.pins[i]; if (px === 0) T(nm, 1.2, py, 0.5, 'left'); else T(nm, 6.8, py, 0.5, 'right'); });
      T('RASPBERRY PI', 4, 19, 0.95, 'center', -Math.PI / 2);
      if (mm) for (let g = 0; g < 28; g++) if (mm.mode[g] === 1 && mm.level[g]) { const [px, py] = K.pins[PI_PIN_OF[g]]; c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(px === 0 ? 0.7 : 7.3, py, 0.2, 0, 7); c.fill(); }
      if (o && o.e.part && sim.burnt.has(p.id)) { c.strokeStyle = '#ff5544'; c.lineWidth = 0.3; line(1, -1.5, 7, 39.5); line(7, -1.5, 1, 39.5); }
      break; }
    case 'UNO': {
      const o = showSim() && bodyI.get(String(p.id)), mm = o && o.e.mcu;
      const T = (t, x, y, size, al, rotv) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2 + (rotv || 0)); c.font = `600 ${size}px sans-serif`; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.fillText(t, 0, 0); c.restore(); };
      for (let i = 0; i < 26; i++) { const [px, py] = K.pins[i]; if (px === 0) lead(0, py, 1, py, pc[i]); else lead(8, py, 7, py, pc[i]); }
      c.strokeStyle = body; c.fillStyle = PRINT ? '#eef6f8' : 'rgba(14,110,131,.22)'; c.fillRect(1, -2.9, 6, 32.8); c.strokeRect(1, -2.9, 6, 32.8);
      c.fillStyle = body;
      ['5V', '3V3', 'VIN', 'GND', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].forEach((t, i) => T(t, 1.25, i * 2, 0.62, 'left'));
      for (let dn = 0; dn < 14; dn++) T('D' + dn + ([3, 5, 6, 9, 10, 11].includes(dn) ? '~' : ''), 6.75, dn * 2, 0.62, 'right');
      T('GND', 6.75, 28, 0.62, 'right'); T('5V', 6.75, -2, 0.62, 'right');
      T('ARDUINO UNO', 4, 13, 0.95, 'center', -Math.PI / 2);
      if (mm) for (let q = 0; q < 14; q++) if (mm.mode[q] === 1 && mm.level[q]) { c.fillStyle = '#ffe14d'; c.beginPath(); c.arc(5.9, q * 2, 0.2, 0, 7); c.fill(); }
      if (o && o.e.part && sim.burnt.has(p.id)) { c.strokeStyle = '#ff5544'; c.lineWidth = 0.3; line(1, -2.9, 7, 29.9); line(7, -2.9, 1, 29.9); }
      break; }
    case 'DUOLED': {
      lead(0, 0, 1.2, 0, pc[0]); lead(0, 2, 1.2, 2, pc[1]); lead(0, 4, 1.2, 4, pc[2]);
      const cur = nm => { const o = showSim() && bodyI.get(p.id + nm); return o ? Math.pow(clamp(Math.abs(o.e.iav != null ? o.e.iav : o.e.i) / 0.02, 0, 1), 0.6) : 0; };
      const r2 = cur('r'), g2 = cur('g'), R = Math.round(255 * Math.min(1, r2 * 1.0 + g2 * 0.15)), G = Math.round(255 * Math.min(1, g2 + r2 * 0.1)), B = Math.round(60 * Math.min(1, g2 * 0.5));
      c.strokeStyle = body; circle(2.3, 2, 1.1); line(2.3, 0.9, 2.3, 3.1);
      c.fillStyle = body; c.font = '600 .55px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); c.translate(1.2, 3.3); c.rotate(-p.r * Math.PI / 2); c.fillText(/^A/i.test(String(p.v || '')) ? 'gem. A' : 'gem. K', 0.2, 0); c.restore();
      if (r2 + g2 > 0.03) {
        const mx = Math.min(1, Math.max(r2, g2));
        c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(2.3, 2, 0, 2.3, 2, 3.4); gr.addColorStop(0, `rgba(${R},${G},${B},${0.9 * mx})`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`); c.fillStyle = gr; c.beginPath(); c.arc(2.3, 2, 3.4, 0, 7); c.fill(); c.restore();
        c.fillStyle = `rgb(${R},${G},${B})`; c.beginPath(); c.arc(2.3, 2, 0.95, 0, 7); c.fill();
        c.strokeStyle = body; line(2.3, 0.9, 2.3, 3.1);
      }
      break; }
    case 'RGBLED': {
      lead(0, 0, 1.2, 0, pc[0]); lead(0, 2, 1.2, 2, pc[1]); lead(0, 4, 1.2, 4, pc[2]); lead(4, 2, 3.4, 2, pc[3]);
      const cur = nm => { const o = showSim() && bodyI.get(p.id + nm); return o ? Math.pow(clamp(Math.abs(o.e.iav != null ? o.e.iav : o.e.i) / 0.02, 0, 1), 0.6) : 0; };
      const r2 = cur('r'), g2 = cur('g'), b2 = cur('b');
      c.strokeStyle = body; circle(2.3, 2, 1.1);
      if (r2 + g2 + b2 > 0.03) {
        const R = Math.round(255 * Math.min(1, r2)), G = Math.round(255 * Math.min(1, g2)), B = Math.round(255 * Math.min(1, b2)), mx = Math.min(1, Math.max(r2, g2, b2));
        c.save(); c.globalCompositeOperation = 'lighter'; const gr = c.createRadialGradient(2.3, 2, 0, 2.3, 2, 3.4); gr.addColorStop(0, `rgba(${R},${G},${B},${0.9 * mx})`); gr.addColorStop(1, `rgba(${R},${G},${B},0)`); c.fillStyle = gr; c.beginPath(); c.arc(2.3, 2, 3.4, 0, 7); c.fill(); c.restore();
        c.fillStyle = `rgb(${R},${G},${B})`; c.beginPath(); c.arc(2.3, 2, 0.95, 0, 7); c.fill();
      }
      c.save(); c.translate(2.3, 2); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '700 .5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('RGB', 0, 0); c.restore();
      c.save(); c.fillStyle = body; c.font = '600 .42px sans-serif'; c.textBaseline = 'middle'; [['R', 0.35, -0.5], ['G', 0.35, 1.5], ['B', 0.35, 3.5]].forEach(([t, x, y]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.textAlign = 'left'; c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'TMP36': {
      lead(4, 0, 3, 0, pc[0]); lead(4, 2, 3, 2, pc[1]); lead(4, 4, 3, 4, pc[2]);
      c.strokeStyle = body; c.strokeRect(0.5, -0.8, 2.5, 5.6);
      c.save(); c.fillStyle = body; c.textBaseline = 'middle';
      [['TMP36', 1.75, 1, 0.62, 'center'], [((-40 + 165 * (p.pos == null ? 0.394 : p.pos)).toFixed(0)) + ' °C', 1.75, 3.2, 0.62, 'center'], ['+5V', 2.85, -0.2, 0.42, 'right'], ['OUT', 2.85, 1.8, 0.42, 'right'], ['GND', 2.85, 3.8, 0.42, 'right']].forEach(([t, x, y, sz, al]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.font = `600 ${sz}px sans-serif`; c.textAlign = al; c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'PIEZO': {
      lead(4, 0, 3, 0, pc[0]); lead(4, 2, 3, 2, pc[1]);
      c.strokeStyle = body; c.fillStyle = 'rgba(214,170,90,.55)'; c.beginPath(); c.arc(1.6, 1, 1.35, 0, 7); c.fill(); c.stroke();
      c.fillStyle = body; c.font = '600 .45px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('+', 3.5, -0.35); c.fillText('Piezo', 1.6, 1);
      if ((p.pos || 0) > 0.05) { c.strokeStyle = 'rgba(255,225,77,.9)'; c.lineWidth = 0.1; c.beginPath(); c.arc(1.6, 1, 1.9, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(1.6, 1, 2.3, -0.9, 0.9); c.stroke(); }
      break; }
    case 'TOUCH': {
      lead(0, 0, 1, 0, pc[0]);
      const on = (p.pos || 0) > 0.5; c.fillStyle = on ? 'rgba(255,225,77,.8)' : 'rgba(232,234,237,.18)'; c.strokeStyle = body; c.lineWidth = 0.12; c.fillRect(1, -1.3, 3.6, 2.6); c.strokeRect(1, -1.3, 3.6, 2.6);
      c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(on ? 'berührt' : 'Fläche', 2.8, 0);
      break; }
    case 'PIR': {
      lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(0, 4, 1, 4, pc[2]);
      c.strokeStyle = body; c.strokeRect(1, -0.8, 4, 5.6); const act = (p.pos || 0) > 0.5;
      c.fillStyle = act ? 'rgba(255,225,77,.85)' : 'rgba(232,234,237,.15)'; c.beginPath(); c.arc(3.2, 2, 1.3, 0, 7); c.fill(); c.strokeStyle = body; circle(3.2, 2, 1.3);
      c.save(); c.translate(3.2, 4.2); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textAlign = 'center'; c.fillText('PIR', 0, 0); c.restore();
      break; }
    case 'HCSR04': {
      lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(0, 4, 1, 4, pc[2]); lead(0, 6, 1, 6, pc[3]);
      c.strokeStyle = body; c.strokeRect(1, -1.2, 5, 8.4); circle(3.5, 1.4, 1.1); circle(3.5, 4.8, 1.1);
      c.save(); c.fillStyle = body; c.textBaseline = 'middle';
      [['HC-SR04', 4.6, -0.5, 0.5, 'center'], [(2 + 398 * (p.pos == null ? 0.246 : p.pos)).toFixed(0) + ' cm', 3.5, 3.1, 0.55, 'center'], ['VCC', 1.2, 0, 0.35, 'left'], ['TRIG', 1.2, 2, 0.35, 'left'], ['ECHO', 1.2, 4, 0.35, 'left'], ['GND', 1.2, 6, 0.35, 'left']].forEach(([t, x, y, sz, al]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.font = `600 ${sz}px sans-serif`; c.textAlign = al; c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'SERVO': {
      lead(0, 0, 1, 0, pc[0]); lead(0, 2, 1, 2, pc[1]); lead(0, 4, 1, 4, pc[2]);
      c.strokeStyle = body; c.strokeRect(1, -0.8, 5, 5.6);
      const o = showSim() && bodyI.get(String(p.id)), mm = circ && circ.mcu && circ.mcu.mcu, pin = o && o.e.pin, ang = (mm && pin != null && pin >= 0 && mm.servo[pin] != null) ? mm.servo[pin] : 90;
      const a = (180 - ang) * Math.PI / 180; c.fillStyle = body; c.beginPath(); c.arc(4.4, 2, 0.35, 0, 7); c.fill(); c.strokeStyle = '#ffe14d'; c.lineWidth = 0.22; c.beginPath(); c.moveTo(4.4, 2); c.lineTo(4.4 + 1.9 * Math.cos(a), 2 - 1.9 * Math.sin(a)); c.stroke();
      c.save(); c.translate(2.4, 3.9); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textAlign = 'center'; c.fillText(Math.round(ang) + '°', 0, 0); c.restore();
      c.save(); c.fillStyle = body; c.font = '600 .38px sans-serif'; c.textBaseline = 'middle'; [['SIG', 0], ['V+', 2], ['GND', 4]].forEach(([t, y]) => { c.save(); c.translate(1.2, y); c.rotate(-p.r * Math.PI / 2); c.textAlign = 'left'; c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'LCDI2C': {
      lead(9, 0, 8, 0, pc[0]); lead(9, 2, 8, 2, pc[1]); lead(9, 4, 8, 4, pc[2]); lead(9, 6, 8, 6, pc[3]);
      const o = showSim() && bodyI.get(String(p.id)), ok = o && o.e.ok;
      c.fillStyle = '#1d6b3d'; c.fillRect(0, -1.2, 8, 8.4); c.strokeStyle = body; c.strokeRect(0, -1.2, 8, 8.4);
      c.fillStyle = ok && lcdState ? '#9fd18a' : '#4a6a4a'; c.fillRect(0.4, 0.4, 7.2, 3.6);
      if (ok && lcdState) { c.save(); c.fillStyle = '#1b3b12'; c.font = '600 .78px monospace'; c.textBaseline = 'middle'; c.textAlign = 'left'; lcdState.rows.forEach((r, i) => { c.save(); c.translate(0.55, 1.35 + i * 1.5); c.rotate(-p.r * Math.PI / 2); for (let k2 = 0; k2 < 16; k2++) c.fillText(r[k2] || ' ', k2 * 0.43, 0); c.restore(); }); c.restore(); }
      c.save(); c.fillStyle = '#e8eaed'; c.font = '600 .42px sans-serif'; c.textBaseline = 'middle'; [['GND', 0], ['VCC', 2], ['SDA', 4], ['SCL', 6]].forEach(([t, y]) => { c.save(); c.translate(7.8, y); c.rotate(-p.r * Math.PI / 2); c.textAlign = 'right'; c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'NETZ3': {
      [0, 1, 2, 3, 4].forEach(i => lead(i * 2, 0, i * 2, -0.9, pc[i])); c.strokeStyle = body; c.strokeRect(-1, -3, 10, 2.1);
      c.save(); c.fillStyle = body; c.textAlign = 'center'; c.textBaseline = 'middle';
      ['L1', 'L2', 'L3', 'N', 'PE'].forEach((t, i) => { c.save(); c.translate(i * 2, -1.25); c.rotate(-p.r * Math.PI / 2); c.font = '700 .55px sans-serif'; c.fillText(t, 0, 0); c.restore(); });
      c.save(); c.translate(4, -2.05); c.rotate(-p.r * Math.PI / 2); c.font = '700 .85px sans-serif'; c.fillText('3~ ' + (p.v || '400V'), 0, 0); c.restore(); c.restore();
      break; }
    case 'MOTOR3': {
      [0, 1, 2].forEach(i => lead(i * 2, 0, i * 2, 1.5, pc[i]));
      c.strokeStyle = body; circle(2, 3, 1.5); if (K.pins.length > 3) peStub(3.5, 3, 6, 3, pc[3], p.sw);
      c.save(); c.translate(2, 3); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '700 .9px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 0, -0.2); c.font = '600 .6px sans-serif'; c.fillText('3~', 0, 0.55); c.restore();
      { const o = showSim() && bodyI.get(p.id + 'w0'), ph0 = o && o.e && o.e.phase ? o.e.phase : 0;
        if (o && (o.e.w || 0) > 5) { c.strokeStyle = 'rgba(255,225,77,.9)'; c.lineWidth = 0.14; const a = ph0 % 6.2832; c.beginPath(); c.moveTo(2 + 0.9 * Math.cos(a), 3 + 0.9 * Math.sin(a)); c.lineTo(2 + 1.3 * Math.cos(a), 3 + 1.3 * Math.sin(a)); c.stroke(); } }
      break; }
    case 'BRUECKE': {
      lead(0, 2, 0.8, 2, pc[0]); lead(3.2, 2, 4, 2, pc[1]); lead(2, 0, 2, 0.8, pc[2]); lead(2, 3.2, 2, 4, pc[3]);
      c.strokeStyle = body; c.beginPath(); c.moveTo(0.8, 2); c.lineTo(2, 0.8); c.lineTo(3.2, 2); c.lineTo(2, 3.2); c.closePath(); c.stroke();
      const arrow = (x0, y0, x1, y1) => { const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, a = Math.atan2(y1 - y0, x1 - x0); c.save(); c.translate(mx, my); c.rotate(a); c.beginPath(); c.moveTo(-0.3, -0.28); c.lineTo(-0.3, 0.28); c.lineTo(0.3, 0); c.closePath(); c.fill(); line(0.3, -0.3, 0.3, 0.3); c.restore(); };
      arrow(0.8, 2, 2, 0.8); arrow(3.2, 2, 2, 0.8); arrow(2, 3.2, 0.8, 2); arrow(2, 3.2, 3.2, 2);
      c.save(); c.translate(0.45, 1.5); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textAlign = 'center'; c.fillText('~', 0, 0); c.restore();
      break; }
    case 'REG': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[2]); lead(2, 2, 2, 1.4, pc[1]); c.strokeStyle = body; c.strokeRect(1, -0.8, 2, 2.2);
      c.save(); c.translate(2, 0.3); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .62px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.v || '78xx', 0, 0); c.restore();
      c.save(); c.fillStyle = body; c.font = '600 .45px sans-serif'; c.textAlign = 'center'; [['IN', 1.35, -0.35], ['OUT', 2.65, -0.35], ['GND', 2, 1.15]].forEach(([t, x, y]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'SEG8': {
      [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => lead(0, i * 2, 1, i * 2, pc[i])); lead(5, 14, 6, 14, pc[8]);
      c.strokeStyle = body; c.fillStyle = '#23272c'; c.fillRect(1, -0.6, 4, 15); c.strokeRect(1, -0.6, 4, 15);
      const segs = [[1.9, 1.6, 4.1, 1.6], [4.5, 2.2, 4.5, 6], [4.5, 7.4, 4.5, 11.2], [1.9, 12.4, 4.1, 12.4], [1.5, 7.4, 1.5, 11.2], [1.5, 2.2, 1.5, 6], [1.9, 7, 4.1, 7]];
      segs.forEach((s2, i) => { const o = showSim() && bodyI.get(p.id + 's' + i), b2 = o ? Math.pow(clamp(Math.abs(o.e.i) / 0.02, 0, 1), 0.6) : 0; c.strokeStyle = b2 > 0.05 ? `rgba(255,${Math.round(60 + 40 * (1 - b2))},50,${0.45 + 0.55 * Math.min(b2, 1)})` : '#3a2a2c'; c.lineWidth = 0.55; c.lineCap = 'round'; c.beginPath(); c.moveTo(s2[0], s2[1]); c.lineTo(s2[2], s2[3]); c.stroke(); });
      { const o = showSim() && bodyI.get(p.id + 's7'), b2 = o ? Math.abs(o.e.i) / 0.02 : 0; c.fillStyle = b2 > 0.05 ? '#ff5a40' : '#3a2a2c'; c.beginPath(); c.arc(4.6, 12.4, 0.3, 0, 7); c.fill(); }
      c.save(); c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textAlign = 'right'; c.textBaseline = 'middle'; ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].forEach((t, i) => { c.save(); c.translate(0.9, i * 2 - 0.55); c.rotate(-p.r * Math.PI / 2); c.fillText(t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'PBC': {
      lead(0, 0, 1.1, 0, pc[0]); lead(2.9, 0, 4, 0, pc[1]);
      c.beginPath(); c.arc(1.1, 0, 0.1, 0, 7); c.fill(); c.beginPath(); c.arc(2.9, 0, 0.1, 0, 7); c.fill();
      { const y = p.pressed ? -0.65 : -0.1; line(1.2, y, 2.8, y); line(2, y, 2, y - 0.6); line(1.6, y - 0.6, 2.4, y - 0.6); line(1.5, 0.3, 2.5, -0.5); }
      break; }
    case 'JUN5': {
      c.strokeStyle = body; c.strokeRect(0, -0.6, 1, 9.2);
      [0, 2, 4, 6, 8].forEach((y, i) => { c.strokeStyle = pc[i]; c.lineWidth = 0.13; line(0, y, 0.5, y); c.fillStyle = pc[i]; c.beginPath(); c.arc(0.5, y, 0.18, 0, 7); c.fill(); });
      break; }
    case 'FAULT': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]);
      c.beginPath(); c.arc(1, 0, 0.1, 0, 7); c.fill(); c.beginPath(); c.arc(3, 0, 0.1, 0, 7); c.fill();
      c.strokeStyle = p.sw ? '#ff5544' : body; c.lineWidth = 0.13; line(1, 0, p.sw ? 3 : 2.9, p.sw ? 0 : -1.1);
      c.strokeStyle = '#ff5544'; c.lineWidth = 0.14; c.beginPath(); c.moveTo(2.2, -1.2); c.lineTo(1.7, -0.5); c.lineTo(2.3, -0.5); c.lineTo(1.8, 0.4); c.stroke();
      break; }
    case 'NETZ': {
      [0, 1, 2].forEach(i => lead(i * 2, 0, i * 2, -0.9, pc[i])); c.strokeStyle = body; c.strokeRect(-1, -3, 6, 2.1);
      c.save(); c.fillStyle = body; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 .85px sans-serif';
      [['L', 0], ['N', 2], ['PE', 4]].forEach(([t, x]) => { c.save(); c.translate(x, -1.25); c.rotate(-p.r * Math.PI / 2); c.font = '700 .6px sans-serif'; c.fillText(t, 0, 0); c.restore(); });
      c.save(); c.translate(2, -2.05); c.rotate(-p.r * Math.PI / 2); c.fillText('~ ' + (p.v || '230V'), 0, 0); c.restore(); c.restore();
      break; }
    case 'LSS': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]);
      line(1, 0, 1.1, 0); c.beginPath(); c.arc(1, 0, 0.1, 0, 7); c.fill(); c.beginPath(); c.arc(3, 0, 0.1, 0, 7); c.fill();
      c.strokeStyle = p.sw ? body : '#ff8a5c'; c.lineWidth = 0.13; line(1, 0, p.sw ? 2.9 : 2.7, p.sw ? 0 : -1.1); c.strokeStyle = body; c.lineWidth = 0.07;
      c.strokeRect(1.55, -0.95, 0.9, 0.5); line(1.8, -0.7, 2.2, -0.7);
      c.save(); c.translate(2, 0.75); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '700 .6px sans-serif'; c.textAlign = 'center'; c.fillText(p.v || '', 0, 0); c.restore();
      break; }
    case 'RCD': {
      lead(0, 0, 0, 1, pc[0]); lead(2, 0, 2, 1, pc[1]); lead(0, 3, 0, 4, pc[2]); lead(2, 3, 2, 4, pc[3]);
      c.strokeRect(-0.6, 1, 3.2, 2);
      c.strokeStyle = p.sw ? body : '#ff8a5c'; c.lineWidth = 0.1; if (p.sw) { line(0, 1, 0, 3); line(2, 1, 2, 3); } else { line(0, 1, 0.5, 2.2); line(2, 1, 2.5, 2.2); }
      c.save(); c.translate(1, 2); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '700 .65px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('FI ' + (p.v || ''), 0, 0); c.restore();
      break; }
    case 'KREUZ': {
      lead(0, 0, 0, 1, pc[0]); lead(2, 0, 2, 1, pc[1]); lead(0, 3, 0, 4, pc[2]); lead(2, 3, 2, 4, pc[3]);
      c.strokeRect(-0.6, 1, 3.2, 2); c.strokeStyle = p.sw ? '#ffe14d' : body; c.lineWidth = 0.12;
      if (p.sw) { line(0, 1, 2, 3); line(2, 1, 0, 3); } else { line(0, 1, 0, 3); line(2, 1, 2, 3); }
      break; }
    case 'IMP': {
      lead(0, 0, 1, 0, pc[0]); lead(1, 0, 1, 0.8, pc[0]); lead(1, 3.2, 1, 4, pc[1]); lead(1, 4, 0, 4, pc[1]);
      c.strokeRect(0.6, 0.8, 0.8, 2.4); line(0.6, 3.2, 1.4, 0.8);
      const o = showSim() && bodyI.get(String(p.id)), la = !!(o && o.e.latch);
      lead(6, 0, 6, 1, pc[2]); lead(6, 3, 6, 4, pc[3]);
      c.strokeStyle = la ? '#ffe14d' : body; c.lineWidth = 0.13; line(6, 1, la ? 6 : 5.2, la ? 3 : 2.6);
      c.strokeStyle = body; c.lineWidth = 0.07; c.setLineDash([0.25, 0.2]); line(1.4, 2, 4.9, 2); c.setLineDash([]);
      c.save(); c.translate(3.4, 3.4); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .6px sans-serif'; c.textAlign = 'center'; c.fillText('Stromstoß', 0, 0); c.restore();
      break; }
    case 'HEAT': {
      lead(0, 0, 0.8, 0, pc[0]); lead(3.2, 0, 4, 0, pc[1]); c.strokeRect(0.8, -0.8, 2.4, 1.6); peStub(2, 0.8, 2, 2, pc[2], p.sw);
      c.beginPath(); c.moveTo(1.1, 0.4); [0, 1, 2, 3].forEach(i => { c.lineTo(1.1 + (i + 0.5) * 0.5, i % 2 ? 0.4 : -0.4); }); c.lineTo(2.9, 0); c.stroke();
      break; }
    case 'SD': {
      lead(3, 0, 4, 0, pc[0]); lead(3, 2, 4, 2, pc[1]); lead(3, 4, 4, 4, pc[2]);
      c.strokeRect(0, -0.9, 3, 5.8); c.beginPath(); c.arc(1.5, 2, 1.05, 0, 7); c.stroke();
      c.beginPath(); c.arc(1.1, 1.5, 0.12, 0, 7); c.fill(); c.beginPath(); c.arc(1.9, 1.5, 0.12, 0, 7); c.fill(); line(1.1, 2.6, 1.9, 2.6);
      if (p.sw) { c.strokeStyle = '#ff5544'; c.lineWidth = 0.16; c.beginPath(); c.moveTo(1.8, 0.9); c.lineTo(1.2, 2.1); c.lineTo(1.9, 2.1); c.lineTo(1.3, 3.2); c.stroke(); }
      break; }
    case 'FUSE': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.4, 2, 0.8);
      if (showSim() && sim.burnt.has(p.id)) { c.strokeStyle = '#ff5544'; line(1.2, 0, 1.8, 0); line(2.2, 0, 2.8, 0); line(1.85, -0.3, 2.15, 0.3); line(1.85, 0.3, 2.15, -0.3); }
      else { c.strokeStyle = fuseHot(p); line(1, 0, 3, 0); }
      break; }
    case 'NTC': case 'PTC':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.4, 2, 0.8);
      c.beginPath(); c.moveTo(0.8, p.k === 'NTC' ? 1.1 : -1.1); c.lineTo(1.3, p.k === 'NTC' ? 1.1 : -1.1); c.lineTo(2.7, p.k === 'NTC' ? -1.1 : 1.1); c.stroke();
      c.save(); c.translate(3.0, p.k === 'NTC' ? -1.0 : 1.0); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '600 .8px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(p.k === 'NTC' ? '−ϑ' : '+ϑ', 0, 0); c.restore();
      break;
    case 'MOTOR': {
      lead(0, 0, 0.9, 0, pc[0]); lead(3.1, 0, 4, 0, pc[1]); circle(2, 0, 1.1);
      c.save(); c.translate(2, 0); c.rotate(-p.r * Math.PI / 2); c.fillStyle = body; c.font = '700 1.1px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 0, 0.06); c.restore();
      { const o = showSim() && bodyI.get(String(p.id)), ph0 = o && o.e && o.e.phase ? o.e.phase : 0, dead = showSim() && sim.burnt.has(p.id);
        if (o && !dead) { c.strokeStyle = 'rgba(255,225,77,.9)'; c.lineWidth = 0.14; const a = ph0 % 6.2832; c.beginPath(); c.moveTo(2 + 0.62 * Math.cos(a), 0.62 * Math.sin(a)); c.lineTo(2 + 0.98 * Math.cos(a), 0.98 * Math.sin(a)); c.stroke();
          if (Math.abs(o.e.w || 0) > 20) { c.strokeStyle = 'rgba(255,225,77,.35)'; c.lineWidth = 0.08; c.beginPath(); c.arc(2, 0, 1.25, a, a + 1.6); c.stroke(); } }
        if (dead) { c.strokeStyle = '#ff5544'; line(1.2, -0.7, 2.8, 0.7); line(2.8, -0.7, 1.2, 0.7); } }
      break; }
    case 'SPK': {
      lead(0, 0, 1.1, 0, pc[0]); lead(3.0, 0, 4, 0, pc[1]);
      { const o = showSim() && bodyI.get(String(p.id)), sh = o ? clamp(Math.abs(o.e.i) * 2, 0, 1) * 0.12 * Math.sin(performance.now() / 18) : 0;
        c.strokeRect(1.1 + sh, -0.5, 0.9, 1); c.beginPath(); c.moveTo(2 + sh, -0.5); c.lineTo(3 + sh, -1.1); c.lineTo(3 + sh, 1.1); c.lineTo(2 + sh, 0.5); c.stroke();
        if (o && Math.abs(o.e.i) > 1e-3) { c.lineWidth = 0.07; for (let k = 1; k <= 2; k++) { c.beginPath(); c.arc(3.1 + sh, 0, 0.55 * k, -0.9, 0.9); c.stroke(); } } }
      break; }
    case 'TRF': {
      lead(0, 0, 1.8, 0, pc[0]); lead(1.8, 0, 1.8, 0.4, pc[0]); lead(1.8, 3.6, 1.8, 4, pc[1]); lead(1.8, 4, 0, 4, pc[1]);
      lead(6, 0, 4.2, 0, pc[2]); lead(4.2, 0, 4.2, 0.4, pc[2]); lead(4.2, 3.6, 4.2, 4, pc[3]); lead(4.2, 4, 6, 4, pc[3]);
      for (let i = 0; i < 4; i++) { const cy = 0.8 + i * 0.8; c.beginPath(); c.arc(1.8, cy, 0.4, -Math.PI / 2, Math.PI / 2, true); c.stroke(); c.beginPath(); c.arc(4.2, cy, 0.4, -Math.PI / 2, Math.PI / 2, false); c.stroke(); }
      line(2.9, 0.3, 2.9, 3.7); line(3.1, 0.3, 3.1, 3.7); break; }
    case 'RLY': {
      lead(0, 0, 1, 0, pc[0]); lead(1, 0, 1, 0.8, pc[0]); lead(1, 3.2, 1, 4, pc[1]); lead(1, 4, 0, 4, pc[1]);
      c.strokeRect(0.6, 0.8, 0.8, 2.4); line(0.6, 3.2, 1.4, 0.8);
      const o = showSim() && bodyI.get(String(p.id)), on = !!(o && o.e.on);
      lead(5, 2, 5.7, 2, pc[2]); lead(8, 0, 7.2, 0, pc[3]); lead(7.2, 0, 7.2, 0.5, pc[3]); lead(8, 4, 7.2, 4, pc[4]); lead(7.2, 4, 7.2, 3.5, pc[4]);
      c.beginPath(); c.arc(7.2, 0.7, 0.15, 0, 7); c.stroke(); c.beginPath(); c.arc(7.2, 3.3, 0.15, 0, 7); c.stroke();
      c.strokeStyle = on ? '#ffe14d' : body; c.lineWidth = 0.13; line(5.7, 2, 7.1, on ? 0.8 : 3.2);
      c.strokeStyle = body; c.lineWidth = 0.07; c.setLineDash([0.25, 0.2]); line(1.4, 2, 5.4, 2); c.setLineDash([]);
      break; }
    case 'SCHOTTKY': {
      lead(0, 0, 1.4, 0, pc[0]); lead(2.6, 0, 4, 0, pc[1]);
      c.beginPath(); c.moveTo(1.4, -0.7); c.lineTo(1.4, 0.7); c.lineTo(2.6, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(2.25, -0.7); c.lineTo(2.6, -0.7); c.lineTo(2.6, 0.7); c.lineTo(2.95, 0.7); c.stroke();
      break; }
    case 'NMOS': case 'PMOS': {
      lead(0, 0, 0.9, 0, pc[0]); c.lineWidth = 0.16; line(0.9, -0.9, 0.9, 0.9); c.lineWidth = 0.11;
      line(1.25, -0.9, 1.25, -0.45); line(1.25, -0.2, 1.25, 0.2); line(1.25, 0.45, 1.25, 0.9);
      lead(1.25, -0.7, 2, -0.7, pc[1]); lead(2, -0.7, 2, -2, pc[1]); lead(1.25, 0.7, 2, 0.7, pc[2]); lead(2, 0.7, 2, 2, pc[2]);
      line(1.25, 0, 1.75, 0); line(1.75, 0, 1.75, 0.7);
      c.beginPath(); if (p.k === 'NMOS') { c.moveTo(1.25, 0); c.lineTo(1.6, -0.17); c.lineTo(1.6, 0.17); } else { c.moveTo(1.75, 0); c.lineTo(1.4, -0.17); c.lineTo(1.4, 0.17); } c.closePath(); c.fill();
      c.lineWidth = 0.05; c.strokeStyle = PRINT ? 'rgba(0,0,0,.35)' : 'rgba(232,234,237,.45)'; circle(1.4, 0, 1.55); c.strokeStyle = body; c.lineWidth = 0.11;
      break; }
    case 'DIAC': {
      lead(0, 0, 1.2, 0, pc[0]); lead(2.8, 0, 4, 0, pc[1]);
      c.beginPath(); c.moveTo(1.2, -0.7); c.lineTo(1.2, 0.7); c.lineTo(2, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(2.8, -0.7); c.lineTo(2.8, 0.7); c.lineTo(2, 0); c.closePath(); c.stroke();
      break; }
    case 'TRIAC': {
      lead(0, 0, 1.2, 0, pc[0]); lead(2.8, 0, 4, 0, pc[1]); lead(3, 2, 2.95, 1.2, pc[2]);
      c.beginPath(); c.moveTo(1.2, -0.8); c.lineTo(1.2, 0.8); c.lineTo(2, 0); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(2.8, -0.8); c.lineTo(2.8, 0.8); c.lineTo(2, 0); c.closePath(); c.stroke();
      line(2.95, 1.2, 2.8, 0.8);
      { const o = showSim() && bodyI.get(p.id + 'MT'); if (o && o.e.on) { c.fillStyle = 'rgba(255,225,77,.35)'; c.fillRect(1.2, -0.8, 1.6, 1.6); } }
      break; }
    case 'VDR': {
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); c.strokeRect(1, -0.45, 2, 0.9);
      line(0.9, 1.0, 1.3, 1.0); line(1.3, 1.0, 3.1, -1.0);
      break; }
    case 'SEG8D': {
      [0, 1, 2, 3, 4, 5, 6, 7].forEach(i => lead(0, i * 2, 1, i * 2, pc[i])); lead(9, 2, 10, 2, pc[8]); lead(9, 12, 10, 12, pc[9]);
      c.strokeStyle = body; c.fillStyle = '#23272c'; c.fillRect(1, -0.6, 8, 15); c.strokeRect(1, -0.6, 8, 15);
      [1.4, 5.2].forEach((ox, dg) => {
        const segs = [[ox + .6, 1.6, ox + 2.4, 1.6], [ox + 2.8, 2.2, ox + 2.8, 6], [ox + 2.8, 7.4, ox + 2.8, 11.2], [ox + .6, 12.4, ox + 2.4, 12.4], [ox + .2, 7.4, ox + .2, 11.2], [ox + .2, 2.2, ox + .2, 6], [ox + .6, 7, ox + 2.4, 7]];
        segs.forEach((s2, i) => { const o = showSim() && bodyI.get(p.id + 'd' + dg + 's' + i), b2 = o ? Math.pow(clamp(Math.abs(o.e.i) / 0.02, 0, 1), 0.6) : 0; c.strokeStyle = b2 > 0.05 ? `rgba(255,${Math.round(60 + 40 * (1 - b2))},50,${0.45 + 0.55 * Math.min(1, b2)})` : '#3a2a2c'; c.lineWidth = 0.5; line(s2[0], s2[1], s2[2], s2[3]); });
        { const o = showSim() && bodyI.get(p.id + 'd' + dg + 's7'), b2 = o ? Math.abs(o.e.i) / 0.02 : 0; c.fillStyle = b2 > 0.05 ? '#ff5a40' : '#3a2a2c'; c.beginPath(); c.arc(ox + 3.2, 12.4, 0.28, 0, 7); c.fill(); }
      });
      c.save(); c.fillStyle = body; c.font = '600 .5px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'right'; ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'dp'].forEach((t, i) => { c.save(); c.translate(0.9, i * 2 - 0.55); c.rotate(-p.r * Math.PI / 2); c.fillText(t, 0, 0); c.restore(); });
      c.textAlign = 'left'; [['K1', 2], ['K2', 12]].forEach(([t, y]) => { c.save(); c.translate(9.1, y - 0.6); c.rotate(-p.r * Math.PI / 2); c.fillText(/a/i.test(p.vr || '') ? t.replace('K', 'A') : t, 0, 0); c.restore(); }); c.restore();
      break; }
    case 'THY': {
      lead(0, 0, 1.4, 0, pc[0]); lead(2.6, 0, 4, 0, pc[1]); lead(3, 2, 2.95, 1.2, pc[2]);
      c.beginPath(); c.moveTo(1.4, -0.7); c.lineTo(1.4, 0.7); c.lineTo(2.6, 0); c.closePath(); c.stroke();
      line(2.6, -0.7, 2.6, 0.7); line(2.95, 1.2, 2.6, 0.5);
      { const o = showSim() && bodyI.get(p.id + 'AK'); if (o && o.e.on) { c.fillStyle = 'rgba(255,225,77,.35)'; c.beginPath(); c.moveTo(1.4, -0.7); c.lineTo(1.4, 0.7); c.lineTo(2.6, 0); c.closePath(); c.fill(); } }
      break; }
    case 'PHT': {
      lead(2, -2, 2, -1.2, pc[0]); lead(2, 2, 2, 1.2, pc[1]);
      c.lineWidth = 0.2; line(1, -0.9, 1, 0.9); c.lineWidth = 0.11; line(1, -0.4, 2, -1.2); line(1, 0.4, 2, 1.2);
      c.beginPath(); c.moveTo(2, 1.2); c.lineTo(1.45, 1.1); c.lineTo(1.8, 0.7); c.closePath(); c.fill();
      c.strokeStyle = PRINT ? 'rgba(0,0,0,.35)' : 'rgba(232,234,237,.45)'; c.lineWidth = 0.05; circle(1.4, 0, 1.55); c.strokeStyle = body; c.lineWidth = 0.09;
      [[-0.9, -0.9], [-0.9, 0.2]].forEach(([ax, ay]) => { line(ax, ay, ax + 0.65, ay + 0.65); c.beginPath(); c.moveTo(ax + 0.65, ay + 0.65); c.lineTo(ax + 0.28, ay + 0.6); c.lineTo(ax + 0.58, ay + 0.3); c.closePath(); c.fill(); });
      break; }
    case 'OPTO': {
      lead(0, 0, 1.8, 0, pc[0]); lead(1.8, 0, 1.8, 1.1, pc[0]); lead(1.8, 2.9, 1.8, 4, pc[1]); lead(1.8, 4, 0, 4, pc[1]);
      c.beginPath(); c.moveTo(1.3, 1.1); c.lineTo(2.3, 1.1); c.lineTo(1.8, 2.1); c.closePath(); c.stroke(); line(1.3, 2.1, 2.3, 2.1);
      lead(6, 0, 5.2, 0, pc[2]); lead(5.2, 0, 5.2, 1.1, pc[2]); lead(5.2, 2.9, 5.2, 4, pc[3]); lead(5.2, 4, 6, 4, pc[3]);
      c.lineWidth = 0.18; line(4.3, 1.2, 4.3, 2.8); c.lineWidth = 0.11; line(4.3, 1.6, 5.2, 1.1); line(4.3, 2.4, 5.2, 2.9);
      c.beginPath(); c.moveTo(5.2, 2.9); c.lineTo(4.75, 2.85); c.lineTo(5.0, 2.5); c.closePath(); c.fill();
      c.lineWidth = 0.08; [1.4, 2.2].forEach(ay => { line(2.7, ay, 3.7, ay + 0.0); c.beginPath(); c.moveTo(3.7, ay); c.lineTo(3.4, ay - 0.2); c.lineTo(3.4, ay + 0.2); c.closePath(); c.fill(); });
      c.setLineDash([0.2, 0.2]); c.lineWidth = 0.06; c.strokeRect(0.9, 0.3, 4.6, 3.4); c.setLineDash([]);
      break; }
    case 'LAMP': {
      lead(0, 0, 1.1, 0, pc[0]); lead(2.9, 0, 4, 0, pc[1]); circle(2, 0, 0.9); line(1.36, -0.64, 2.64, 0.64); line(2.64, -0.64, 1.36, 0.64); if (K.pins.length > 2) peStub(2, 0.9, 2, 2, pc[2], p.sw); break; }
    case 'CABLE': {
      lead(0, 0, 0.8, 0, pc[0]); lead(3.2, 0, 4, 0, pc[1]); c.strokeRect(0.8, -0.4, 2.4, 0.8);
      if (showSim() && sim.burnt.has(p.id)) { c.strokeStyle = '#ff5544'; line(1, 0, 1.6, 0); line(2.4, 0, 3, 0); line(1.75, -0.3, 2.25, 0.3); line(1.75, 0.3, 2.25, -0.3); }
      else { c.strokeStyle = fuseHot(p); line(0.8, 0, 3.2, 0); c.strokeStyle = body; line(1.5, -0.4, 1.2, 0.4); line(2.0, -0.4, 1.7, 0.4); line(2.5, -0.4, 2.2, 0.4); }
      break; }
    case 'OHM': case 'ISO': case 'ZS':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); circle(2, 0, 1);
      c.restore(); c.save();
      c.fillStyle = body; c.font = `600 ${S * (p.k === 'OHM' ? 1.1 : 0.8)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      { const [ax, ay] = rot(2, 0, p.r); c.fillText(p.k === 'OHM' ? 'Ω' : p.k === 'ISO' ? 'MΩ' : 'Zs', X(p.x + ax), Y(p.y + ay) + 1); }
      c.restore(); c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(p.r * Math.PI / 2); c.scale(S, S); break;
    case 'VM': case 'AM':
      lead(0, 0, 1, 0, pc[0]); lead(3, 0, 4, 0, pc[1]); circle(2, 0, 1);
      c.restore(); c.save();
      c.fillStyle = body; c.font = `600 ${S * 1.1}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      { const [ax, ay] = rot(2, 0, p.r); c.fillText(p.k === 'VM' ? 'V' : 'A', X(p.x + ax), Y(p.y + ay) + 1); }
      c.restore(); c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(p.r * Math.PI / 2); c.scale(S, S); break;
  }
  // Leuchten (LED, Lampe)
  if (showSim() && (p.k === 'LED' || p.k === 'LAMP' || p.k === 'HEAT')) {
    const o = bodyI.get(String(p.id));
    if (o) {
      let b = 0, hex = '#ffd27a';
      if (p.k === 'LED') { b = Math.pow(clamp((o.e.iav != null ? o.e.iav : o.e.i) / 0.02, 0, 1), 0.6); hex = { rot: '#ff3b2f', 'grün': '#2fe05a', gelb: '#ffe033', blau: '#3d8bff', 'weiß': '#ffffff', orange: '#ff9a2f' }[p.v] || '#ff3b2f'; if (sim.burnt.has(p.id)) b = 0; }
      else { const pw = o.e.pav != null ? o.e.pav : Math.abs(o.e.i * o.e.i / o.e.g); b = clamp(pw / (o.e.lamp || 0.6), 0, 1.2); if (p.k === 'HEAT') hex = '#ff6a2a'; }
      if (p.k === 'LED' && o.e.imax && !sim.burnt.has(p.id) && window.LochFX) { const ratio = o.e.i / o.e.imax; if (ratio > 0.85) { b = Math.min(b * (1 + (ratio - 0.85) * 4), 1.6); const [sx, sy] = partCenter(p); LochFX.stress(sx, sy, ratio, view.s); } }
      if (b > 0.02) {
        const n = parseInt(hex.slice(1), 16), R = (n >> 16) & 255, G = (n >> 8) & 255, B = n & 255;
        const cxx = p.k === 'LED' ? 2 : 2, cyy = p.k === 'LED' ? -0.2 : 0, rr = (p.k === 'LED' ? 2.3 : 2.1);
        const g = c.createRadialGradient(cxx, cyy, 0, cxx, cyy, rr);
        g.addColorStop(0, `rgba(${R},${G},${B},${0.9 * Math.min(b, 1)})`); g.addColorStop(0.45, `rgba(${R},${G},${B},${0.35 * Math.min(b, 1)})`); g.addColorStop(1, `rgba(${R},${G},${B},0)`);
        c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.beginPath(); c.arc(cxx, cyy, rr, 0, 7); c.fill(); c.restore();
      }
    }
  }
  // Strompunkte im Körper
  if (showSim()) {
    c.fillStyle = '#ffe14d';
    const bd = id => bodyI.get(id);
    const path = (pts, I, key) => dotsOnPath(c, pts, I, ph('b' + key));
    if (p.k === 'NPN' || p.k === 'PNP') {
      const o = bd(String(p.id)); if (o) { const e = o.e; path([[0, 0], [1, 0]], e.ib, p.id + 'b'); path([[2, -2], [2, -1.2], [1, -0.4]], e.ic, p.id + 'c'); path([[1, 0.4], [2, 1.2], [2, 2]], -(e.ic + e.ib), p.id + 'e'); }
    } else if (p.k === 'POT') {
      const a = bd(p.id + 'AW'), b = bd(p.id + 'WB');
      { const wx = 1 + 2 * clamp(p.pos == null ? 0.5 : p.pos, 0, 1);
        if (a) path([[0, 0], [wx, 0]], a.I, p.id + 'a'); if (b) path([[wx, 0], [4, 0]], b.I, p.id + 'b'); }
    } else if (p.k === 'SPDT') {
      const es = circ.elems.filter(e => e.part && e.part.id === p.id && e.closed);
      es.forEach(e => { const idx = circ.elems.indexOf(e), o = bodyI.get(p.id + '|' + idx); if (o) path([[0, 0], [2, p.sw ? 1 : -1], [4, p.sw ? 1 : -1]], -o.I, p.id + 'x'); });
    } else if (K.pins.length === 2) {
      let o = bd(String(p.id)) || [...bodyI.entries()].find(([k]) => k.startsWith(p.id + '|'));
      if (Array.isArray(o)) o = o[1];
      if (o) path([[0, 0], [4, 0]], o.I, p.id);
    }
  }
  c.restore();
  // Beschriftung und Werte
  const [mx, my] = (p.k === 'ICX' || p.k === 'CPU') ? rot(3, 0, p.r) : rot(K.pins.length > 1 ? 2 : 0, 0, p.r);
  const lx = X(p.x + mx), ly = Y(p.y + my);
  c.fillStyle = PRINT ? '#111' : '#cfd5db'; c.font = `${Math.max(10, S * 0.62)}px -apple-system,Segoe UI,sans-serif`; c.textBaseline = 'middle';
  let txt = valueText(p);
  if (p.k === 'VM' && showSim()) txt = fmt(sv(gk(...pins[0])) - sv(gk(...pins[1])), 'V');
  if (INSTR[p.k] && showSim()) txt = instrText(p);
  if (p.k === 'AM' && showSim()) { const o = [...bodyI.entries()].find(([k]) => k === String(p.id)); txt = o ? fmt(o[1].e.i, 'A') : ''; }
  if (p.l && p.k !== 'GND') txt = p.l + (txt ? '  ' + txt : '');
  if (txt) {
    const vert = (p.r & 1) === 1;
    c.textAlign = vert ? 'left' : 'center';
    c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = PRINT ? '#fff' : '#080b0e';
    const _ft = c.fillText.bind(c); const fillText = (t, x, y) => { c.strokeText(t, x, y); _ft(t, x, y); const tw = c.measureText(t).width, th = Math.max(10, S * 0.62) * 1.2; partText.set(p.id, vert ? [x, y - th / 2, x + tw, y + th / 2] : [x - tw / 2, y - th / 2, x + tw / 2, y + th / 2]); };
    const off = p.k === 'GND' ? 0 : (p.k === 'NPN' || p.k === 'PNP' ? 0 : 1.55);
    if (p.k === 'NPN' || p.k === 'PNP') fillText(txt, lx + (rot(2.9, 0, p.r)[0] - mx) * S + (vert ? 0 : 0), ly + (rot(2.9, 0, p.r)[1] - my) * S);
    else if (p.k !== 'GND') fillText(txt, vert ? lx + (p.k === 'LED' || p.k === 'LAMP' ? 2.1 : 1.3) * S : lx, vert ? ly : ly - off * S);
  }
  if (selected) {
    const [bx0, by0, bx1, by1] = K.box, cs = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]].map(([a, b]) => { const [ra, rb] = rot(a, b, p.r); return [X(p.x + ra), Y(p.y + rb)]; });
    const xs = cs.map(q => q[0]), ys = cs.map(q => q[1]);
    c.strokeStyle = '#3b9eff'; c.lineWidth = 2; c.setLineDash([6, 4]);
    c.strokeRect(Math.min(...xs) - 3, Math.min(...ys) - 3, Math.max(...xs) - Math.min(...xs) + 6, Math.max(...ys) - Math.min(...ys) + 6); c.setLineDash([]);
  }
}
function valueText(p) {
  const K = KINDS[p.k];
  switch (p.k) {
    case 'R': case 'POT': return fmtVal(p.v, 'Ω');
    case 'C': case 'CE': return fmtVal(p.v, 'F');
    case 'XTAL': return String(p.v || '').replace(/\s*hz$/i, '') + ' Hz';
    case 'L': return fmtVal(p.v, 'H');
    case 'FUSE': return fmtVal(p.v, 'A');
    case 'MOTOR': return fmtVal(p.v, 'V');
    case 'SPK': return fmtVal(p.v, 'Ω');
    case 'NTC': case 'PTC': return fmtVal(p.v, 'Ω');
    case 'TRF': case 'RLY': return p.v;
    case 'I2CTEMP': case 'I2CLUX': case 'NETZ': case 'JUN5': case 'UNO': case 'PI': case 'MCP3008': case 'RGBLED': case 'DUOLED': case 'SERVO': case 'LCDI2C': case 'PIR': case 'TMP36': case 'HCSR04': case 'PIEZO': case 'TOUCH': return '';
    case 'FAULT': return p.sw ? 'Fehler aktiv' : 'Fehler aus';
    case 'LSS': case 'RCD': case 'IMP': case 'SCHUETZ': return p.v;
    case 'SD': return p.v ? (p.sw ? p.v + ' (defekt)' : p.v) : 'leer';
    case 'HEAT': return p.v;
    case 'CABLE': return p.v;
    case 'BAT': return fmtVal(p.v, 'V') + (p.imax ? '  ≤ ' + fmtVal(p.imax, 'A') : '');
    case 'ZD': return fmtVal(p.v, 'V');
    case 'AC': return p.v;
    case 'LED': case 'LAMP': return p.v;
    case 'NPN': case 'PNP': case 'NMOS': case 'PMOS': case 'SCHOTTKY': case 'DIAC': case 'TRIAC': case 'VDR': return p.v;
    case 'D': return '';
    default: return '';
  }
}
function fmtVal(v, u) { v = String(v || '').trim(); if (!v) return ''; return /[A-Za-zΩµ]$/.test(v) && !/[kKMmuµnpGR]$/.test(v) ? v : v + ' ' + u; }
function fmt(v, unit) {
  if (!isFinite(v)) return '--';
  const a = Math.abs(v); if (a < 1e-12) return '0 ' + unit;
  const st = [[1e-9, 'n'], [1e-6, 'µ'], [1e-3, 'm'], [1, ''], [1e3, 'k'], [1e6, 'M']]; let b = st[3];
  for (const s of st) if (a >= s[0] * 0.9999) b = s;
  const x = v / b[0]; return x.toFixed(Math.abs(x) >= 100 ? 1 : Math.abs(x) >= 10 ? 2 : 3) + ' ' + b[1] + unit;
}

function draw() { dirtyDraw = true; }

function drawPill(cx, x, y, w, v, label) {
  const h = 22, x0 = x - w / 2;
  cx.save();
  cx.fillStyle = 'rgba(18,22,28,.92)'; cx.strokeStyle = 'rgba(120,140,160,.8)'; cx.lineWidth = 1.5;
  cx.beginPath(); cx.roundRect ? cx.roundRect(x0, y - h / 2, w, h, 11) : cx.rect(x0, y - h / 2, w, h); cx.fill(); cx.stroke();
  const tx0 = x0 + 12, tx1 = x0 + w - 12;
  cx.strokeStyle = '#5b6672'; cx.lineWidth = 4; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(tx0, y); cx.lineTo(tx1, y); cx.stroke();
  cx.strokeStyle = '#3b9eff'; cx.beginPath(); cx.moveTo(tx0, y); cx.lineTo(tx0 + (tx1 - tx0) * v, y); cx.stroke();
  cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(tx0 + (tx1 - tx0) * v, y, 8, 0, 7); cx.fill(); cx.strokeStyle = '#3b9eff'; cx.lineWidth = 2; cx.stroke();
  cx.fillStyle = '#cfd5db'; cx.font = '600 11px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'bottom'; cx.fillText(label + ' ' + Math.round(v * 100) + ' %', x, y - h / 2 - 2);
  cx.restore();
  return { x0: tx0, x1: tx1, y0: y - h / 2 - 8, y1: y + h / 2 + 8, xl: x0 - 8, xr: x0 + w + 8 };
}

let sliderHits = [];
const sliderAt = (px, py) => sliderHits.find(h => px >= h.xl && px <= h.xr && py >= h.y0 && py <= h.y1);
function setSlide(h, px) {
  const v = clamp((px - h.x0) / (h.x1 - h.x0), 0, 1), p = byPart(h.id); if (!p) return;
  p.pos = v; const w = wrapMap.get(p.id); if (w) { w.pos = v; w.light = v; } draw();
}


/* ============ Pins anzeigen: Anschlussbezeichnungen an den Bauteilen (rein optisch, Daten und Platzierung in pins.js) ============ */
const PINS = window.TfPins || null;
const pinsOn = () => !!(PINS && PINS.on());
let pinCache = { key: '', labs: [] };
function pinsKey(W, H, fs) {
  let k = view.s + '|' + Math.round(view.ox) + '|' + Math.round(view.oy) + '|' + W + 'x' + H + '|' + fs;
  sch.parts.forEach(p => { k += ';' + p.k + p.x + ',' + p.y + ',' + p.r + (p.len || '') + (p.k === 'LAMP' || p.k === 'DUOLED' || p.k === 'RGBLED' ? p.v : '') + (p.vr || ''); });
  partText.forEach((r, id) => { k += ';t' + id + ':' + Math.round(r[0]) + ',' + Math.round(r[1]) + ',' + Math.round(r[2]) + ',' + Math.round(r[3]); });
  sch.wires.forEach(w => { k += ';' + w.x1 + ',' + w.y1 + ',' + w.x2 + ',' + w.y2; });
  return k;
}
function drawPinLabels() {
  if (!pinsOn() || PRINT) return;
  const W = cv.width / dpr, H = cv.height / dpr, S = view.s;
  cx.save(); cx.font = '700 12px -apple-system,system-ui,Segoe UI,sans-serif';
  const meas = (t, fs) => cx.measureText(t).width * fs / 12;
  const key = pinsKey(W, H, 0);
  if (pinCache.key !== key) {
    const vis = p => { const x = X(p.x), y = Y(p.y); return x > -400 && x < W + 400 && y > -400 && y < H + 400; };
    const ids = new Set(sch.parts.map(p => p.id)), texts = [];
    partText.forEach((r, id) => { if (ids.has(id)) texts.push(r); });
    pinCache = { key, labs: PINS.schLabels({ parts: sch.parts.filter(vis), wires: sch.wires, KD, pinsOf, rot, X, Y, S, meas, texts }) };
  }
  cx.restore();
  PINS.paint(cx, pinCache.labs, { fill: '#ffd166', halo: '#080b0e' });
}

/* Schalter in der rechten Leiste */
function pinsCardHtml() {
  if (!PINS) return '';
  const on = pinsOn();
  return `<div class="card"><button class="btn ${on ? 'pri' : ''}" data-a="pins" role="switch" aria-checked="${on}" title="${PINS.TIP}" style="width:100%">📌 Pins anzeigen: ${on ? 'an' : 'aus'}</button><p class="hint2" style="margin-bottom:0">${PINS.TIP}. Zum Beispiel B, C, E am Transistor oder A1, A2, COM, NO, NC am Relais.</p></div>`;
}
function togglePins() { PINS.set(!pinsOn()); pinCache.key = ''; refreshUI(); draw(); }
/* ============ Wasser-Ansicht: Strom als Wasser im Rohr, Spannung als Druck ============ */
let water = false; try { water = localStorage.getItem('lm4.water') === '1'; } catch (e) {}
const waterOn = () => water && showSim();
function setWater(on) { water = on; try { localStorage.setItem('lm4.water', on ? '1' : '0'); } catch (e) {} const ws = $('#bWater'); if (ws) ws.setAttribute('aria-checked', on ? 'true' : 'false'); const b = $('[data-a="water"]'); if (b) b.textContent = on ? '💧 Wasser-Ansicht: an' : '💧 Wasser-Ansicht'; dirtyDraw = true; draw(); toast(on ? 'Wasser-Ansicht: Spannung = Druck, Strom = Strömung' : 'Normale Ansicht'); }
function waterPipe(x1, y1, x2, y2, v) {
  const f = Math.max(-1, Math.min(1, v / Math.max(vmax, 0.05))), a = 0.18 + 0.78 * Math.abs(f), lw = Math.max(7, view.s * 0.34);
  cx.lineCap = 'round'; cx.lineWidth = lw + 3; cx.strokeStyle = '#4a5560'; cx.beginPath(); cx.moveTo(X(x1), Y(y1)); cx.lineTo(X(x2), Y(y2)); cx.stroke();
  cx.lineWidth = lw; cx.strokeStyle = '#0d1319'; cx.stroke();
  cx.lineWidth = lw - 3; cx.strokeStyle = f >= 0 ? 'rgba(40,150,255,' + a + ')' : 'rgba(255,150,60,' + a + ')'; cx.stroke();
}
function waterBadges() {
  const rr = (x, y, w, h, r) => { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  sch.parts.forEach(p => {
    const K = KD(p); if (!K || !K.box) return;
    const [ra, rb] = rot((K.box[0] + K.box[2]) / 2, (K.box[1] + K.box[3]) / 2, p.r), px = X(p.x + ra), py = Y(p.y + rb), s = view.s, w = s * 1.9, h = s * 1.15;
    const kind = ['R', 'POT', 'NTC', 'PTC', 'LDR', 'LAMP', 'VDR'].includes(p.k) ? 'r' : (['C', 'CE', 'CF'].includes(p.k) ? 'c' : (p.k === 'BAT' ? 'p' : (p.k === 'L' ? 'l' : '')));
    if (!kind) return;
    cx.save(); cx.translate(px, py); cx.fillStyle = 'rgba(8,11,14,.92)'; cx.strokeStyle = '#6cb8ff'; cx.lineWidth = 2; rr(-w / 2, -h / 2, w, h, 6); cx.fill(); cx.stroke();
    if (kind === 'r') {                         // Engstelle: je enger, desto größer der Widerstand
      cx.fillStyle = '#6cb8ff'; cx.beginPath(); cx.moveTo(-w * .42, -h * .36); cx.lineTo(-w * .08, -h * .08); cx.lineTo(w * .08, -h * .08); cx.lineTo(w * .42, -h * .36); cx.lineTo(w * .42, -h * .42); cx.lineTo(-w * .42, -h * .42); cx.closePath(); cx.fill();
      cx.beginPath(); cx.moveTo(-w * .42, h * .36); cx.lineTo(-w * .08, h * .08); cx.lineTo(w * .08, h * .08); cx.lineTo(w * .42, h * .36); cx.lineTo(w * .42, h * .42); cx.lineTo(-w * .42, h * .42); cx.closePath(); cx.fill();
    } else if (kind === 'c') {                  // Tank: Füllstand = Spannung am Kondensator
      const sc = scopeValues({ t: 'part', id: p.id }), lv = isFinite(sc[0]) ? Math.min(1, Math.abs(sc[0]) / Math.max(vmax, 0.05)) : 0, tw = w * .56, th = h * .74;
      cx.fillStyle = 'rgba(40,150,255,.85)'; cx.fillRect(-tw / 2, th / 2 - th * lv, tw, th * lv); cx.strokeStyle = '#6cb8ff'; cx.strokeRect(-tw / 2, -th / 2, tw, th);
    } else if (kind === 'p') {                  // Pumpe
      cx.fillStyle = '#6cb8ff'; cx.font = 'bold ' + Math.round(h * .62) + 'px system-ui'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('⟳ Pumpe', 0, 1);
    } else {                                    // Spule: Schwungrad, träge Strömung
      const o = bodyI.get(String(p.id)), I = o ? o.I || 0 : 0, ang = ph('b' + p.id).v * 1.2, R = h * .4;       // Schwungrad: dreht sich mit dem Spulenstrom (Richtung = Stromrichtung)
      cx.strokeStyle = '#6cb8ff'; cx.fillStyle = '#6cb8ff'; cx.lineWidth = Math.max(2, h * .09); cx.beginPath(); cx.arc(0, 0, R, 0, 7); cx.stroke();
      for (let k = 0; k < 6; k++) { const a = ang + k * Math.PI / 3; cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(Math.cos(a) * R, Math.sin(a) * R); cx.stroke(); cx.beginPath(); cx.arc(Math.cos(a) * R * .8, Math.sin(a) * R * .8, Math.max(1.5, h * .07), 0, 7); cx.fill(); }
      cx.beginPath(); cx.arc(0, 0, Math.max(2, h * .1), 0, 7); cx.fill();
    }
    cx.restore();
  });
}
function drawCircuit() {
  // Drähte
  const ends = new Map(); const cnt = k => ends.set(k, (ends.get(k) || 0) + 1);
  sch.parts.forEach(p => pinsOf(p).forEach(q => cnt(gk(q[0], q[1]))));
  sch.wires.forEach(w => { cnt(gk(w.x1, w.y1)); cnt(gk(w.x2, w.y2)); });
  sch.wires.forEach(w => {
    const col = keyV(gk(w.x1, w.y1)), isSel = sel && sel.t === 'wire' && sel.id === w.id;
    cx.lineCap = 'round';
    if (isSel) { cx.strokeStyle = 'rgba(59,158,255,.6)'; cx.lineWidth = 9; cx.beginPath(); cx.moveTo(X(w.x1), Y(w.y1)); cx.lineTo(X(w.x2), Y(w.y2)); cx.stroke(); }
    if (waterOn()) waterPipe(w.x1, w.y1, w.x2, w.y2, sv(gk(w.x1, w.y1)));
    else if (LAB === 'sim' && w.c && WIRECOL[w.c]) {
      const lw = Math.max(3, view.s * 0.2); cx.lineWidth = lw + 2; cx.strokeStyle = PRINT ? 'rgba(0,0,0,.5)' : 'rgba(255,255,255,.3)'; cx.beginPath(); cx.moveTo(X(w.x1), Y(w.y1)); cx.lineTo(X(w.x2), Y(w.y2)); cx.stroke();
      cx.lineWidth = lw; cx.strokeStyle = WIRECOL[w.c]; cx.stroke();
      if (w.c === 'gruen') { cx.strokeStyle = '#f2d21b'; cx.setLineDash([lw * 1.4, lw * 1.4]); cx.stroke(); cx.setLineDash([]); }
    } else {
    cx.strokeStyle = col; cx.lineWidth = Math.max(2.5, view.s * 0.13); cx.beginPath(); cx.moveTo(X(w.x1), Y(w.y1)); cx.lineTo(X(w.x2), Y(w.y2)); cx.stroke();
    }
    // Strompunkte
    if (showSim()) {
      const f = flows.get(w.id);
      if (f != null) {
        cx.save(); cx.translate(X(w.x1), Y(w.y1)); const ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1); cx.rotate(ang); cx.scale(view.s, view.s);
        dotsOnPath(cx, [[0, 0], [Math.hypot(w.x2 - w.x1, w.y2 - w.y1), 0]], f, ph('w' + w.id)); cx.restore();
      }
    }
  });
  ends.forEach((n, k) => { if (n >= 3) { const [x, y] = k.split(',').map(Number); const rr = Math.max(4.5, view.s * 0.25); cx.beginPath(); cx.arc(X(x), Y(y), rr + 1.5, 0, 7); cx.fillStyle = PRINT ? '#fff' : '#080b0e'; cx.fill(); cx.beginPath(); cx.arc(X(x), Y(y), rr, 0, 7); cx.fillStyle = PRINT ? '#000' : keyV(k); cx.fill(); if (!PRINT) { cx.lineWidth = 1.5; cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.stroke(); } } });
  sch.parts.forEach(p => drawPart(p, sel && sel.t === 'part' && sel.id === p.id));
  drawPinLabels();
  if (waterOn() && !PRINT) waterBadges();
  drawMeterMarks();
  sliderHits = [];
  if (simMode && !PRINT) sch.parts.forEach(p => {
    const K = KD(p); if (!K.pos) return;
    let y1 = -1e9, xc = 0, n = 0;
    [[K.box[0], K.box[1]], [K.box[2], K.box[1]], [K.box[2], K.box[3]], [K.box[0], K.box[3]]].forEach(([a, b]) => { const [ra, rb] = rot(a, b, p.r); y1 = Math.max(y1, p.y + rb); xc += p.x + ra; n++; });
    const w = Math.max(104, view.s * 3.8), r = drawPill(cx, X(xc / n), Y(y1) + 20, w, clamp(p.pos == null ? (K.pos0 != null ? K.pos0 : 0.5) : p.pos, 0, 1), p.k === 'MOTOR' ? 'Bremse' : (p.k === 'NTC' || p.k === 'PTC' || p.k === 'TMP36' || p.k === 'I2CTEMP' ? 'Temp. ' + posText(posUnit(p), posVal(p)) : (p.k === 'POT' ? 'Poti ' + posText(posUnit(p), posVal(p)) : (p.k === 'HCSR04' ? 'Abstand ' + posText(posUnit(p), posVal(p)) : (p.k === 'PIEZO' ? 'Klopfen' : (p.k === 'TOUCH' ? 'Finger' : (p.k === 'PIR' ? 'Bewegung' : 'Licht')))))));
    sliderHits.push(Object.assign({ id: p.id }, r));
  });
}
function render() {
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cv.width / dpr, H = cv.height / dpr;
  cx.fillStyle = '#080b0e'; cx.fillRect(0, 0, W, H);
  if (LAB === 'haus' && window.HAUS_RENDER) { window.HAUS_RENDER(cx, W, H); return; }
  // Raster
  if (view.s >= 10) {
    cx.fillStyle = 'rgba(255,255,255,.13)';
    const x0 = Math.floor(-view.ox / view.s), x1 = Math.ceil((W - view.ox) / view.s), y0 = Math.floor(-view.oy / view.s), y1 = Math.ceil((H - view.oy) / view.s);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cx.fillRect(X(x) - 1, Y(y) - 1, 2, 2);
  }
  drawCircuit();
  // Vorschau
  if (ghost && tool === 'place' && placeKind) {
    const L = leg1 ? legShape(leg1, ghost) : null;
    cx.globalAlpha = 0.6; drawPart(L ? { id: -1, k: placeKind, x: leg1[0], y: leg1[1], r: L.r, len: L.len > 4 ? L.len : undefined, v: KINDS[placeKind].v, sw: 0 } : { id: -1, k: placeKind, x: ghost[0], y: ghost[1], r: placeRot, v: KINDS[placeKind].v, sw: 0 }, false); cx.globalAlpha = 1;
  }
  if (wireStart && cursor) {
    /* Vorschau: mit Auto-Weg der berechnete Weg mit 90°-Knicken (rot und gerade, wenn es keinen freien Weg gibt), sonst das gerade Stück */
    let pts = null, bad = false;
    if (autoRoute && (cursor[0] !== wireStart[0] || cursor[1] !== wireStart[1])) { const path = routePreview(wireStart, cursor); if (path) pts = path; else bad = true; }
    if (!pts) pts = [wireStart, autoRoute ? cursor : ortho(wireStart, cursor)];
    cx.strokeStyle = bad ? 'rgba(255,90,80,.95)' : 'rgba(255,225,77,.9)'; cx.lineWidth = 3; cx.setLineDash([8, 5]);
    cx.beginPath(); cx.moveTo(X(pts[0][0]), Y(pts[0][1])); for (let i = 1; i < pts.length; i++) cx.lineTo(X(pts[i][0]), Y(pts[i][1])); cx.stroke(); cx.setLineDash([]);
    cx.strokeStyle = '#3b9eff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X(wireStart[0]), Y(wireStart[1]), 6, 0, 7); cx.stroke();
  }
  if (cursor && tool !== 'select') { cx.strokeStyle = 'rgba(59,158,255,.9)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X(cursor[0]), Y(cursor[1]), 7, 0, 7); cx.stroke(); }
  drawGraphs(W, H);
  if (window.LochFX) LochFX.draw(cx);
}
/* DigiLab: Logikanalysator, jede Messstelle als Spur mit Rechteckverlauf (0 oder 1) und gemeinsamer Zeitachse */
const LANECOL = ['#6dff7a', '#ffe14d', '#4cc3ff', '#ff8a5c', '#d58cff', '#ff6b9a', '#a6ff6b', '#ffd23f'];
function drawLanes(W, H) {
  const n = sch.scopes.length; if (!n) return;
  const lane = 26, hd = 20, x0 = 96, gw = W - x0 - 10, gh = Math.min(H * 0.55, n * lane + hd + 6), y0 = H - gh;
  cx.fillStyle = 'rgba(0,0,0,.84)'; cx.fillRect(0, y0, W, gh);
  cx.strokeStyle = 'rgba(120,200,130,.25)'; cx.lineWidth = 1; cx.fillStyle = '#9aa6b2'; cx.font = '10px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) { const x = x0 + gw * i / 4; cx.beginPath(); cx.moveTo(x, y0 + hd - 2); cx.lineTo(x, y0 + gh); cx.stroke(); cx.fillText('−' + fmtT(graphWin * (4 - i) / 4).replace('−', ''), x, y0 + 4); }
  sch.scopes.forEach((sc, k) => {
    const b = scopeBuf[k], yb = y0 + hd + k * lane, col = LANECOL[k % LANECOL.length], p = sc.t === 'part' ? byPart(sc.id) : null;
    if (yb + lane > H) return;
    cx.fillStyle = col; cx.font = '600 12px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle';
    cx.fillText(String(p ? (p.l || KINDS[p.k].name) : (sc.t === 'node' ? 'Knoten' : '?')).slice(0, 11), 8, yb + lane / 2);
    cx.strokeStyle = 'rgba(255,255,255,.08)'; cx.beginPath(); cx.moveTo(x0, yb + lane - 2); cx.lineTo(x0 + gw, yb + lane - 2); cx.stroke();
    if (!b || b.t.length < 2) return;
    let hi = 1; b.v.forEach(v => { if (isFinite(v) && v > hi) hi = v; }); const thr = hi / 2, t1 = b.t[b.t.length - 1], t0 = t1 - graphWin;
    cx.strokeStyle = col; cx.lineWidth = 2; cx.beginPath(); let prevY = null;
    for (let i = 0; i < b.t.length; i++) {
      const x = x0 + (b.t[i] - t0) / graphWin * gw, yy = (b.v[i] > thr) ? yb + 4 : yb + lane - 7;
      if (x < x0) { prevY = yy; continue; }
      if (prevY == null) cx.moveTo(x, yy); else { if (yy !== prevY) { cx.lineTo(x, prevY); } cx.lineTo(x, yy); }
      prevY = yy;
    }
    cx.stroke();
  });
}
function drawGraphs(W, H) {
  if (LAB === 'digi') { drawLanes(W, H); return; }
  const n = sch.scopes.length; if (!n) return;
  const gh = Math.min(150, H * 0.34), gw = Math.min(W / n, 330);
  sch.scopes.forEach((sc, k) => {
    const b = scopeBuf[k], x0 = k * gw, y0 = H - gh;
    cx.fillStyle = 'rgba(0,0,0,.78)'; cx.fillRect(x0, y0, gw - 2, gh);
    cx.strokeStyle = 'rgba(120,200,130,.25)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x0, y0 + gh / 2); cx.lineTo(x0 + gw - 2, y0 + gh / 2); cx.stroke();
    const label = sc.t === 'node' ? 'Knoten ' + sc.key : (byPart(sc.id) ? (KINDS[byPart(sc.id).k].name + ' ' + valueText(byPart(sc.id))) : '?');
    cx.fillStyle = '#e8eaed'; cx.font = '12px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'top'; cx.fillText(label, x0 + 6, y0 + 5);
    if (!b || b.t.length < 2) return;
    const draw1 = (arr, col) => {
      let mn = Infinity, mxv = -Infinity; arr.forEach(v => { if (isFinite(v)) { mn = Math.min(mn, v); mxv = Math.max(mxv, v); } });
      if (!isFinite(mn)) return null;
      const m = Math.max(Math.abs(mn), Math.abs(mxv), 1e-12), t1 = b.t[b.t.length - 1], t0 = t1 - graphWin;
      cx.strokeStyle = col; cx.lineWidth = 1.8; cx.beginPath(); let first = true;
      for (let i = 0; i < arr.length; i++) { const x = x0 + (b.t[i] - t0) / graphWin * (gw - 2), y = y0 + gh / 2 - arr[i] / m * (gh / 2 - 18); if (x < x0) continue; if (first) { cx.moveTo(x, y); first = false; } else cx.lineTo(x, y); }
      cx.stroke(); return m;
    };
    const mv = draw1(b.v, '#ffe14d'), mi = sc.t === 'node' ? null : draw1(b.i, '#4cd964');
    cx.font = '11px sans-serif'; cx.textBaseline = 'bottom';
    if (mv != null) { cx.fillStyle = '#ffe14d'; cx.fillText('U max ' + fmt(mv, 'V'), x0 + 6, y0 + gh - 4); }
    if (mi != null) { cx.fillStyle = '#4cd964'; cx.textAlign = 'right'; cx.fillText('I max ' + fmt(mi, 'A'), x0 + gw - 8, y0 + gh - 4); }
  });
  cx.fillStyle = '#c8d0d8'; cx.font = '11px sans-serif'; cx.textAlign = 'right'; cx.textBaseline = 'bottom';
}

/* ============ Treffertest ============ */
function partAt(fx, fy) {
  for (let i = sch.parts.length - 1; i >= 0; i--) {
    const p = sch.parts[i], K = KD(p), [a, b] = rot(fx - p.x, fy - p.y, (4 - p.r) & 3);
    if (a >= K.box[0] - 0.2 && a <= K.box[2] + 0.2 && b >= K.box[1] - 0.2 && b <= K.box[3] + 0.2) return p;
  }
  return null;
}
function segDist(px, py, x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1, l = dx * dx + dy * dy; let t = l ? ((px - x1) * dx + (py - y1) * dy) / l : 0; t = clamp(t, 0, 1); return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)); }
function wireAt(fx, fy) { let best = null, bd = 0.45; sch.wires.forEach(w => { const d = segDist(fx, fy, w.x1, w.y1, w.x2, w.y2); if (d < bd) { bd = d; best = w; } }); return best; }

/* ============ Auto-Weg: Draht automatisch mit 90°-Knicken verlegen ============ */
let autoRoute = (() => { try { return localStorage.getItem('lm4.autoroute') !== '0'; } catch (e) { return true; } })();
/* Sucht den kürzesten Weg mit möglichst wenigen Knicken von a nach b. Bauteile sind Hindernisse, Anschlusspunkte und Drahtenden anderer Leitungen
   ebenfalls (sonst entstünde ungewollt eine Verbindung). Andere Drähte darf der Weg rechtwinklig kreuzen: ohne Lötpunkt bleibt das keine Verbindung. */
function routeWire(a, b) {
  const key = (x, y) => x + ',' + y, blocked = new Set(), hW = new Set(), vW = new Set();
  let minX = Math.min(a[0], b[0]), maxX = Math.max(a[0], b[0]), minY = Math.min(a[1], b[1]), maxY = Math.max(a[1], b[1]);
  const grow = (x, y) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  sch.parts.forEach(p => {
    const K = KD(p), cs = [[K.box[0], K.box[1]], [K.box[2], K.box[3]]].map(([x, y]) => { const [rx, ry] = rot(x, y, p.r); return [p.x + rx, p.y + ry]; });
    const x1 = Math.min(cs[0][0], cs[1][0]) - 0.3, x2 = Math.max(cs[0][0], cs[1][0]) + 0.3, y1 = Math.min(cs[0][1], cs[1][1]) - 0.3, y2 = Math.max(cs[0][1], cs[1][1]) + 0.3;
    grow(x1, y1); grow(x2, y2);
    for (let x = Math.ceil(x1); x <= Math.floor(x2); x++) for (let y = Math.ceil(y1); y <= Math.floor(y2); y++) blocked.add(key(x, y));
    pinsOf(p).forEach(q => blocked.add(key(q[0], q[1])));
  });
  sch.wires.forEach(w => {
    grow(w.x1, w.y1); grow(w.x2, w.y2); blocked.add(key(w.x1, w.y1)); blocked.add(key(w.x2, w.y2));
    const lo = (u, v) => Math.min(u, v), hi = (u, v) => Math.max(u, v);
    if (w.y1 === w.y2) for (let x = lo(w.x1, w.x2) + 1; x < hi(w.x1, w.x2); x++) { const k = key(x, w.y1); if (hW.has(k) || vW.has(k)) blocked.add(k); else hW.add(k); }
    else if (w.x1 === w.x2) for (let y = lo(w.y1, w.y2) + 1; y < hi(w.y1, w.y2); y++) { const k = key(w.x1, y); if (hW.has(k) || vW.has(k)) blocked.add(k); else vW.add(k); }
    else blocked.add(key((w.x1 + w.x2) >> 1, (w.y1 + w.y2) >> 1));
  });
  const P = 6; minX = Math.floor(minX) - P; maxX = Math.ceil(maxX) + P; minY = Math.floor(minY) - P; maxY = Math.ceil(maxY) + P;
  if ((maxX - minX) * (maxY - minY) > 90000) return null;
  const D = [[1, 0], [-1, 0], [0, 1], [0, -1]], W = maxX - minX + 1, kk = (x, y, d) => ((y - minY) * W + (x - minX)) * 4 + d;
  const dist = new Map(), prev = new Map(), heap = [[0, a[0], a[1], -1]];
  const push = it => { heap.push(it); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { let m = i; const x = 2 * i + 1, y = x + 1; if (x < heap.length && heap[x][0] < heap[m][0]) m = x; if (y < heap.length && heap[y][0] < heap[m][0]) m = y; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  dist.set(kk(a[0], a[1], 0), 0); let goal = null, steps = 0;
  while (heap.length && steps++ < 900000) {
    const [c, x, y, dd] = pop();
    if (x === b[0] && y === b[1]) { goal = [x, y, dd]; break; }
    if (c > (dist.get(kk(x, y, dd < 0 ? 0 : dd)) ?? 1e9)) continue;
    const here = hW.has(key(x, y)) || vW.has(key(x, y));
    for (let nd = 0; nd < 4; nd++) {
      if (dd >= 0 && (nd >> 1) === (dd >> 1) && nd !== dd) continue;                                  // keine Umkehr
      if (dd >= 0 && nd !== dd && here) continue;                                                     // auf einem fremden Draht nicht abbiegen
      const nx = x + D[nd][0], ny = y + D[nd][1]; if (nx < minX || nx > maxX || ny < minY || ny > maxY) continue;
      const k = key(nx, ny), goalCell = nx === b[0] && ny === b[1];
      if (!goalCell) { if (blocked.has(k)) continue; if (hW.has(k) && nd < 2) continue; if (vW.has(k) && nd >= 2) continue; }
      const nc = c + 1 + (dd >= 0 && nd !== dd ? 3 : 0) + (!goalCell && (hW.has(k) || vW.has(k)) ? 4 : 0), q = kk(nx, ny, nd);
      if (nc < (dist.get(q) ?? 1e9)) { dist.set(q, nc); prev.set(q, [x, y, dd < 0 ? 0 : dd]); push([nc, nx, ny, nd]); }
    }
  }
  if (!goal) return null;
  const path = [[goal[0], goal[1]]]; let q = kk(goal[0], goal[1], goal[2]);
  while (prev.has(q)) { const [px, py, pd] = prev.get(q); path.push([px, py]); q = kk(px, py, pd); if (px === a[0] && py === a[1]) break; }
  return path.reverse();
}
let prevKey = '', prevPath = null;
function routePreview(a, b) {
  const k = a + '|' + b + '|' + sch.wires.length + '|' + sch.parts.length + '|' + sch.parts.map(p => p.x + ',' + p.y + ',' + p.r).join(';');
  if (k !== prevKey) { prevKey = k; try { prevPath = routeWire(a, b); } catch (e) { prevPath = null; } }
  return prevPath;
}
/* Weg als Drähte eintragen (je gerader Strecke ein Draht), ein einziger Rückgängig-Schritt */
function addRoute(path) {
  const pts = [path[0]];
  for (let i = 1; i < path.length - 1; i++) { const dx1 = path[i][0] - path[i - 1][0], dy1 = path[i][1] - path[i - 1][1], dx2 = path[i + 1][0] - path[i][0], dy2 = path[i + 1][1] - path[i][1]; if (dx1 !== dx2 || dy1 !== dy2) pts.push(path[i]); }
  pts.push(path[path.length - 1]);
  for (let i = 0; i + 1 < pts.length; i++) {
    splitWiresAt(pts[i]); splitWiresAt(pts[i + 1]);
    sch.wires.push(Object.assign({ id: nid(), x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1] }, LAB === 'sim' ? { c: wireColor } : {}));
  }
  commit();
}
/* Draht von a nach b legen: mit Auto-Weg rechtwinklig um Hindernisse herum, sonst wie bisher ein gerades Stück. Liefert den Endpunkt. */
function wireTo(a, g) {
  if (autoRoute) {
    const path = routeWire(a, g);
    if (path && path.length > 1) { addRoute(path); return g; }
    toast('Kein freier Weg gefunden. Der Draht wird gerade gesetzt, setze Zwischenpunkte.');
  }
  const e = ortho(a, g); if (e[0] !== a[0] || e[1] !== a[1]) addWire(a, e); return e;
}
const ortho = (s, g) => (Math.abs(g[0] - s[0]) >= Math.abs(g[1] - s[1]) ? [g[0], s[1]] : [s[0], g[1]]);

/* ============ Eingabe ============ */
const ptrs = new Map(); let gest = null;
const rectOf = () => cv.getBoundingClientRect();
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
  if (LAB === 'haus' && window.HAUS_PTR && window.HAUS_PTR(e)) return;
  // Rechtsklick (oder Strg+Klick) beendet das aktive Werkzeug, andere Maustasten tun nichts
  if ((e.pointerType === 'mouse' && e.button !== 0) || (e.button === 0 && e.ctrlKey)) {
    if (e.button === 2 || e.ctrlKey) rightClickExit();
    return;
  }
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  const r = rectOf(); ptrs.set(e.pointerId, { x: e.clientX - r.left, y: e.clientY - r.top });
  if (ptrs.size === 2) { cancelAct(); const [a, b] = [...ptrs.values()]; gest = { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.hypot(a.x - b.x, a.y - b.y) || 1 }; return; }
  if (ptrs.size > 2) return;
  onDown(ptrs.get(e.pointerId));
});
cv.addEventListener('pointermove', e => {
  if (LAB === 'haus' && window.HAUS_PTR && window.HAUS_PTR(e)) return;
  const r = rectOf(), p = { x: e.clientX - r.left, y: e.clientY - r.top };
  if (!ptrs.has(e.pointerId)) { if (e.pointerType === 'mouse') { const [fx, fy] = toGrid(p.x, p.y); cursor = snapG(fx, fy); if (tool === 'place') ghost = cursor; draw(); } return; }
  ptrs.set(e.pointerId, p);
  if (gest) {
    const [a, b] = [...ptrs.values()]; if (!b) return;
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const ns = clamp(view.s * d / gest.d, 8, 80), f = ns / view.s;
    view.ox = c.x - (gest.cx - view.ox) * f; view.oy = c.y - (gest.cy - view.oy) * f; view.s = ns; gest = { cx: c.x, cy: c.y, d }; draw(); return;
  }
  onMove(p);
});
function pend(e) { if (e.pointerType === 'mouse' && e.button !== 0) return; if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (gest) { if (!ptrs.size) gest = null; return; } if (e.type === 'pointercancel') cancelAct(); else onUp(p); }
cv.addEventListener('pointerup', e => { if (LAB === 'haus' && window.HAUS_PTR && window.HAUS_PTR(e)) return; pend(e); }); cv.addEventListener('pointercancel', e => { if (LAB === 'haus' && window.HAUS_PTR && window.HAUS_PTR(e)) return; pend(e); });
cv.addEventListener('wheel', e => { e.preventDefault(); if (LAB === 'haus' && window.HAUS_WHEEL && window.HAUS_WHEEL(e)) return; const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top, ns = clamp(view.s * Math.exp(-e.deltaY * 0.0015), 8, 80), f = ns / view.s; view.ox = x - (x - view.ox) * f; view.oy = y - (y - view.oy) * f; view.s = ns; draw(); }, { passive: false });
function rightClickExit() {
  if (simMode) return;
  wireStart = null; ghost = null; act = null; leg1 = null;
  if (tool !== 'select') { setTool('select'); toast('Werkzeug beendet'); }
  draw();
}
cv.addEventListener('contextmenu', e => { e.preventDefault(); rightClickExit(); });
cv.addEventListener('auxclick', e => e.preventDefault());

function cancelAct() { if (act && act.t === 'move' && act.moved) { act.restore && act.restore(); } act = null; draw(); }
function onDown(p) {
  if (simMode && tool !== 'select' && tool !== 'scope' && tool !== 'meter') return;
  if (simMode && tool === 'meter') { meterTap(...toGrid(p.x, p.y)); act = { t: 'none' }; draw(); return; }
  if (simMode) { const sh = sliderAt(p.x, p.y); if (sh) { act = { t: 'slide', sh }; setSlide(sh, p.x); return; } }
  const [fx, fy] = toGrid(p.x, p.y), g = snapG(fx, fy); cursor = g;
  switch (tool) {
    case 'select': {
      const part = partAt(fx, fy);
      if (part) {
        sel = { t: 'part', id: part.id }; if (window.Speak && window.Speak.auto()) speakPart(part);
        const pins = pinsOf(part).map(q => gk(q[0], q[1]));
        const att = []; sch.wires.forEach(w => { if (pins.includes(gk(w.x1, w.y1))) att.push([w, 1]); if (pins.includes(gk(w.x2, w.y2))) att.push([w, 2]); });
        act = { t: 'move', kind: 'part', id: part.id, g0: g, o: { x: part.x, y: part.y }, att: att.map(([w, e]) => [w, e, e === 1 ? w.x1 : w.x2, e === 1 ? w.y1 : w.y2]), moved: false, sx: p.x, sy: p.y };
        if (KINDS[part.k].momentary) { pressPart(part); act.press = part; }
      } else {
        const w = wireAt(fx, fy);
        if (w) { sel = { t: 'wire', id: w.id }; act = { t: 'move', kind: 'wire', id: w.id, g0: g, o: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, moved: false }; }
        else { sel = null; act = { t: 'pan', lx: p.x, ly: p.y }; }
      }
      refreshUI(); break; }
    case 'wire':
      if (wireStart) {
        if (g[0] === wireStart[0] && g[1] === wireStart[1]) { wireStart = null; }
        else { const e = wireTo(wireStart, g); wireStart = e; }
        act = { t: 'none' };
      } else { wireStart = g; act = { t: 'wire', start: g }; }
      break;
    case 'place':
      if (twoLeg()) {   // zweistufig: erstes Bein setzen, dann Richtung und Länge ziehen, dann zweites Bein absetzen
        if (!leg1) { leg1 = g; ghost = g; act = { t: 'leg' }; toast('Erstes Bein gesetzt. Jetzt Richtung und Länge wählen und das zweite Bein absetzen.'); }
        else { ghost = g; act = { t: 'leg' }; }
        refreshUI(); break;
      }
      ghost = g; act = { t: 'place' }; break;
    case 'erase': eraseAt(fx, fy); act = { t: 'erase' }; break;
    case 'scope': { const part = partAt(fx, fy); if (part && part.k !== 'GND') toggleScope({ t: 'part', id: part.id }); else { const w = wireAt(fx, fy); if (w) toggleScope({ t: 'node', key: gk(w.x1, w.y1) }); } act = { t: 'none' }; break; }
  }
  draw();
}
function onMove(p) {
  const [fx, fy] = toGrid(p.x, p.y), g = snapG(fx, fy); cursor = g;
  if (act && act.t === 'slide') { setSlide(act.sh, p.x); return; }
  if (!act) { draw(); return; }
  switch (act.t) {
    case 'pan': view.ox += p.x - act.lx; view.oy += p.y - act.ly; act.lx = p.x; act.ly = p.y; break;
    case 'move': {
      if (simMode) break;
      const dx = g[0] - act.g0[0], dy = g[1] - act.g0[1];
      if ((dx || dy) && !act.moved) { act.moved = true; if (act.press) releasePart(act.press, true); }
      if (!act.moved) break;
      if (act.kind === 'part') {
        const part = byPart(act.id); part.x = act.o.x + dx; part.y = act.o.y + dy;
        act.att.forEach(([w, e, x, y]) => { if (e === 1) { w.x1 = x + dx; w.y1 = y + dy; } else { w.x2 = x + dx; w.y2 = y + dy; } });
      } else { const w = byWire(act.id); w.x1 = act.o.x1 + dx; w.y1 = act.o.y1 + dy; w.x2 = act.o.x2 + dx; w.y2 = act.o.y2 + dy; }
      break; }
    case 'place': ghost = g; break;
    case 'leg': ghost = g; break;
    case 'erase': eraseAt(fx, fy); break;
  }
  draw();
}
function onUp(p) {
  const a = act; act = null; if (!a) return;
  if (a.t === 'slide') { try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} refreshUI(); return; }
  switch (a.t) {
    case 'move':
      if (a.press) releasePart(a.press);
      if (a.moved) commit();
      else if (a.kind === 'part') {
        const part = byPart(a.id), K = KINDS[part.k];
        if (K.toggle) { part.sw = part.sw ? 0 : 1; const w = wrapMap.get(part.id); if (w) w.sw = part.sw; if (window.Feel) window.Feel.tap('switch'); commit(true); }
      }
      break;
    case 'leg': {   // Loslassen: war es ein Zug vom ersten Bein weg, wird das Bauteil gesetzt, sonst bleibt das erste Bein stehen
      if (leg1 && ghost && (ghost[0] !== leg1[0] || ghost[1] !== leg1[1])) { const L = legShape(leg1, ghost), K = KINDS[placeKind]; sch.parts.push({ id: nid(), k: placeKind, x: leg1[0], y: leg1[1], r: L.r, len: L.len > 4 ? L.len : undefined, v: K.v, sw: K.sw0 || 0, pos: K.pos0 != null ? K.pos0 : 0.5, vr: K.vr, n: K.n, l: nextLabel(placeKind) }); leg1 = null; ghost = null; commit(); refreshUI(); }
      break; }
    case 'place': if (ghost) { const K = KINDS[placeKind]; sch.parts.push({ id: nid(), k: placeKind, x: ghost[0], y: ghost[1], r: placeRot, v: K.v, sw: K.sw0 || 0, pos: K.pos0 != null ? K.pos0 : 0.5, vr: K.vr, n: K.n, l: nextLabel(placeKind) }); commit(); } break;
    case 'wire': if (cursor && (cursor[0] !== a.start[0] || cursor[1] !== a.start[1])) { wireStart = wireTo(a.start, cursor); } break;
    case 'erase': if (a.did) commit(); break;
  }
  draw();
}
// Endet ein Draht mitten auf einem anderen Draht, wird dieser dort geteilt: so entsteht eine echte Verbindung (Lötpunkt)
function splitWiresAt(pt) {
  const add = [];
  sch.wires.forEach(w => {
    if (w.fixed) return;   // feste Drähte (zum Beispiel Versorgungsschienen) werden nie geteilt
    const [x, y] = pt, onH = w.y1 === w.y2 && y === w.y1 && x > Math.min(w.x1, w.x2) && x < Math.max(w.x1, w.x2), onV = w.x1 === w.x2 && x === w.x1 && y > Math.min(w.y1, w.y2) && y < Math.max(w.y1, w.y2);
    if (!(onH || onV)) return;
    const w2 = Object.assign({}, w, { id: nid(), x1: x, y1: y }); w.x2 = x; w.y2 = y; add.push(w2);
  });
  add.forEach(w => sch.wires.push(w));
}
function addWire(a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
  splitWiresAt(a); splitWiresAt(b);
  sch.wires.push(Object.assign({ id: nid(), x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, LAB === 'sim' ? { c: wireColor } : {})); commit();
}
function eraseAt(fx, fy) {
  const part = partAt(fx, fy);
  if (part) { sch.parts = sch.parts.filter(p => p !== part); sch.scopes = sch.scopes.filter(s => !(s.t === 'part' && s.id === part.id)); sel = null; if (act) act.did = true; draw(); return; }
  const w = wireAt(fx, fy); if (w) { sch.wires = sch.wires.filter(x => x !== w); sel = null; if (act) act.did = true; draw(); }
}
function toggleScope(sc) {
  const i = sch.scopes.findIndex(s => s.t === sc.t && s.id === sc.id && s.key === sc.key);
  if (i >= 0) sch.scopes.splice(i, 1); else { if (sch.scopes.length >= 4) sch.scopes.shift(); sch.scopes.push(sc); }
  scopeBuf = sch.scopes.map(() => ({ t: [], v: [], i: [] })); lastSample = -1; commit(true);
}
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') delSel();
  else if (e.key === ' ') { e.preventDefault(); toggleRun(); }
  else if (e.key === 'Escape') { wireStart = null; leg1 = null; sel = null; setTool('select'); }
});
function delSel() { if (simMode || !sel) return; if (sel.t === 'part') { sch.parts = sch.parts.filter(p => p.id !== sel.id); sch.scopes = sch.scopes.filter(s => !(s.t === 'part' && s.id === sel.id)); } else sch.wires = sch.wires.filter(w => w.id !== sel.id); sel = null; commit(); }
function rotSel(d) {
  if (simMode) return;
  if (tool === 'place' && !sel) { placeRot = (placeRot + d) & 3; draw(); refreshUI(); return; }
  if (sel && sel.t === 'part') { const p = byPart(sel.id); p.r = (p.r + d) & 3; commit(); }
}
function dupSel() { if (simMode || !sel || sel.t !== 'part') return; const p = JSON.parse(JSON.stringify(byPart(sel.id))); p.id = nid(); p.l = ''; p.x += 2; p.y += 2; p.l = nextLabel(p.k); sch.parts.push(p); sel = { t: 'part', id: p.id }; commit(); }

/* ============ Werkzeuge, Palette ============ */
// Zweistufiges Absetzen für zweipolige Bauteile (Widerstand, Kondensator, LED …)
let twoLegOn = true; try { twoLegOn = localStorage.getItem('lm4.twoleg') !== '0'; } catch (e) {}   // Zweistufiges Absetzen (Beine ziehen) lässt sich in der Seitenleiste aus- und einschalten
const twoLeg = () => twoLegOn && tool === 'place' && placeKind && KINDS[placeKind].pins === T2 && !simMode;
function legShape(a, b) {   // aus erstem Bein und Mauszeiger: Ausrichtung (r) und Beinabstand (len, mindestens 4)
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (Math.abs(dx) >= Math.abs(dy)) return { r: dx >= 0 ? 0 : 2, len: Math.max(4, Math.abs(dx)) };
  return { r: dy >= 0 ? 1 : 3, len: Math.max(4, Math.abs(dy)) };
}
function setTool(t, kind) {
  tool = t; placeKind = kind || null; wireStart = null; ghost = null; act = null; leg1 = null;
  if (t !== 'select') sel = null;
  buildPalette(); refreshUI(); draw();
}
let partQuery = '';
{ const st = document.createElement('style'); st.textContent = '.psearch{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:6px;background:var(--panel);padding:6px 4px 4px;margin:0 -2px}.psearch input{flex:1;min-width:0;padding:6px 9px;font-size:14px;border-radius:14px;border:1px solid var(--line);background:var(--bg);color:var(--fg)}.pit[hidden],.pcat[hidden]{display:none}.pnone{padding:10px 8px;font-size:13px;color:var(--mute)}@media(max-width:600px){header{flex-wrap:wrap;row-gap:2px;padding-left:4px;padding-right:4px}header #logo{display:none}header .title{padding:0 4px}header::after{content:\"\";order:9;flex-basis:100%;height:0}header .hb,header #bUndo,header #bRedo{order:10}header .hb{flex:1;justify-content:center;margin:0 2px;padding:0 6px;height:34px}header #bUndo,header #bRedo{width:40px;height:34px}header .run{padding:0 12px}.simsw{margin:0 2px}}'; document.head.appendChild(st); }
function applyPartFilter() {
  const pl = $('#parts'); if (!pl || simMode) return;
  const q = partQuery.trim().toLowerCase().split(/\s+/).filter(Boolean); let cat = null, any = false, shown = 0;
  [...pl.children].forEach(el => {
    if (el.classList.contains('pcat')) { if (cat) cat.hidden = !any; cat = el; any = false; el.hidden = false; return; }
    if (!el.classList.contains('pit')) return;
    const ok = !q.length || q.every(w => (el.dataset.q || '').includes(w)); el.hidden = !ok; if (ok) { any = true; shown++; }
  });
  if (cat) cat.hidden = !any;
  let none = pl.querySelector('.pnone'); if (q.length && !shown) { if (!none) { none = document.createElement('div'); none.className = 'pnone'; none.textContent = 'Nichts gefunden'; pl.appendChild(none); } } else if (none) none.remove();
}
function buildPalette() {
  if (LAB === 'haus' && window.HAUS_PALETTE) { $('#pal').innerHTML = window.HAUS_PALETTE(simMode); const pl0 = $('#parts'); if (pl0) { if (window.HAUS_PARTS) window.HAUS_PARTS(pl0, simMode); else pl0.style.display = 'none'; } return; }
  const chip = (id, label, on, data) => `<button class="chip ${on ? 'on' : ''}" data-t="${id}" ${data || ''}>${label}</button>`;
  let h;
  if (simMode) h = chip('select', '☝ Bedienen', tool === 'select') + chip('meter', '🔌 Messen', tool === 'meter') + chip('scope', '∿ Oszilloskop', tool === 'scope') + chip('reset', '↺ Zurück', false);
  else {
    h = chip('select', '☝ Auswahl', tool === 'select') + chip('wire', '✎ Draht', tool === 'wire') + chip('autoroute', autoRoute ? '⤳ Auto-Weg an' : '⤳ Auto-Weg aus', autoRoute) + chip('erase', '⌫ Löschen', tool === 'erase') + '<span class="sep"></span>';
    if (!listMode()) CATS.forEach(cat => {
      kindsOf(cat).forEach(k => { h += chip('place', KINDS[k].name, tool === 'place' && placeKind === k, `data-k="${k}"`); });
      h += '<span class="sep"></span>';
    });
  }
  $('#pal').innerHTML = h;
  // Bauteilliste links (Tablet/Laptop), nur im Zeichenmodus
  const pl = $('#parts'), show = listMode();
  let lh = '';
  if (show && simMode) lh = controlHtml();
  else if (show) lh += `<div class="psearch"><svg class="i" viewBox="0 0 24 24" style="width:18px;height:18px;flex:none;opacity:.7"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg><input id="pq" type="search" placeholder="Bauteil suchen …" autocomplete="off" value="${esc(partQuery)}"></div>`;
  if (show && !simMode) CATS.forEach(cat => {
    if (!kindsOf(cat).length) return;
    lh += `<div class="pcat">${cat}</div>`;
    kindsOf(cat).forEach(k => { lh += `<button class="pit ${tool === 'place' && placeKind === k ? 'on' : ''}" data-t="place" data-k="${k}" data-q="${esc((KINDS[k].name + ' ' + k + ' ' + cat).toLowerCase())}">${KINDS[k].name}</button>`; });
  });
  const keep = pl.scrollTop, was = pl.style.display;
  pl.innerHTML = lh; pl.dataset.h = simMode ? lh : ''; applyPartFilter(); pl.style.display = show ? 'block' : 'none'; pl.scrollTop = keep;
  if (was !== pl.style.display) window.dispatchEvent(new Event('resize'));
}
/* Bedienfeld links in der Simulation: Schalter, Taster und Regler aller Bauteile an einer festen Stelle */
const CTLSTATE = { LAMP: ['ok', 'Körperschluss'], HEAT: ['ok', 'Körperschluss'], MOTOR3: ['ok', 'Körperschluss'], SD: ['ok', 'defekt'], FAULT: ['aus', 'Fehler'], SPDT: ['Stellung 1', 'Stellung 2'], KREUZ: ['gerade', 'gekreuzt'], LSS: ['aus', 'ein'], RCD: ['aus', 'ein'] };
function controlHtml() {
  const items = sch.parts.filter(p => { const K = KD(p); return K.toggle || K.momentary || K.pos || p.k === 'BAT' || p.k === 'AC'; });
  let h = '<div class="pcat">Bedienfeld</div>';
  if (!items.length) return h + '<p class="hint2" style="padding:0 8px">Diese Schaltung hat keine Schalter oder Regler.</p>';
  items.forEach(p => {
    const K = KD(p), name = (p.l ? p.l + ' · ' : '') + K.name;
    if (K.toggle) { const st = CTLSTATE[p.k] || ['aus', 'ein']; h += `<button class="pit ctl ${p.sw ? 'on' : ''}" data-ctl="sw" data-id="${p.id}"><span>${esc(name)}</span><em>${st[p.sw ? 1 : 0]}</em></button>`; }
    else if (K.momentary) h += `<button class="pit ctl ${p.pressed ? 'on' : ''}" data-ctl="hold" data-id="${p.id}"><span>${esc(name)}</span><em>gedrückt halten</em></button>`;
    if (p.k === 'BAT') {
      const v = srcVolt(p);
      h += `<div class="ctl-sl"><span>${esc(name)}<em>${fmtSrc(v)} V</em></span><div style="display:flex;gap:6px;align-items:center"><input type="range" data-ctl="vs" data-id="${p.id}" min="0" max="${Math.max(30, Math.ceil(v))}" step="0.5" value="${v}" style="flex:1;min-width:0"><input type="number" data-ctl="vsn" data-id="${p.id}" min="0" max="100" step="0.1" value="${fmtSrc(v)}" style="width:68px" aria-label="Spannung in Volt"></div></div>`;
    }
    if (p.k === 'AC') {
      const a = acParts(p);
      h += `<div class="ctl-sl"><span>${esc(name)}<em>${fmtSrc(a.amp)} V · ${fmtHz(a.hz)}</em></span><div style="display:flex;gap:6px;align-items:center"><input type="range" data-ctl="vs" data-id="${p.id}" min="0" max="${Math.max(30, Math.ceil(a.amp))}" step="0.5" value="${a.amp}" style="flex:1;min-width:0"><input type="number" data-ctl="vsn" data-id="${p.id}" min="0" max="400" step="0.1" value="${fmtSrc(a.amp)}" style="width:68px" aria-label="Amplitude in Volt"></div><div style="display:flex;gap:6px;align-items:center;margin-top:4px"><span style="flex:1;font-size:12px;color:var(--mute)">Frequenz</span><input type="number" data-ctl="vsf" data-id="${p.id}" min="1" max="1000000" step="1" value="${a.hz}" style="width:96px" aria-label="Frequenz in Hertz"> <span style="font-size:12px;color:var(--mute)">Hz</span></div></div>`;
    }
    if (K.pos) {
      const v = posVal(p), u = posUnit(p), multi = posUnits(p).length > 1;
      h += `<div class="ctl-sl"><span>${esc(name)}<em>${posText(u, v)}</em></span><div style="display:flex;gap:6px;align-items:center"><input type="range" data-ctl="pos" data-id="${p.id}" min="${u.min}" max="${u.max}" step="${u.step}" value="${posNum(u, v)}" style="flex:1;min-width:0"><input type="number" data-ctl="posn" data-id="${p.id}" min="${u.min}" max="${u.max}" step="${u.step}" value="${posNum(u, v)}" style="width:68px" aria-label="Wert"></div>${multi ? `<button class="btn" data-ctl="unit" data-id="${p.id}" style="margin-top:4px;padding:3px 10px;font-size:12px">Einheit wechseln: ${esc(u.u)} → ${esc(posUnits(p).find(x => x.id !== u.id).u)}</button>` : ''}</div>`;
    }
  });
  return h;
}
function refreshControls() {
  if (LAB === 'haus' || !simMode || !listMode()) return;
  const pl = $('#parts'), ae = document.activeElement; if (pl.contains(ae) && (ae.type === 'range' || ae.type === 'number')) return;
  const h = controlHtml(); if (pl.dataset.h !== h) { const keep = pl.scrollTop; pl.dataset.h = h; pl.innerHTML = h; pl.scrollTop = keep; }
}
(function () {
  const pl = $('#parts');
  const setP = (id, f) => { const p = byPart(+id); if (!p) return; f(p, wrapMap.get(p.id)); };
  pl.addEventListener('click', e => { const b = e.target.closest('[data-ctl="sw"]'); if (!b || !simMode) return; setP(b.dataset.id, (p, w) => { p.sw = p.sw ? 0 : 1; if (w) w.sw = p.sw; if (window.Feel) window.Feel.tap('switch'); commit(true, true); draw(); refreshControls(); }); });
  pl.addEventListener('input', e => {
    const t = e.target;
    if ((t.dataset.ctl === 'vs' || t.dataset.ctl === 'vsn' || t.dataset.ctl === 'vsf') && simMode) {
      const x = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(x) || x < 0) return;
      setP(t.dataset.id, p => {
        if (p.k === 'BAT') p.v = fmtSrc(Math.min(x, 100)); else { const a = acParts(p); if (t.dataset.ctl === 'vsf') a.hz = Math.max(1, x); else a.amp = Math.min(x, 400); p.v = fmtSrc(a.amp) + 'V ' + fmtHz(a.hz); }
        try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} rebuildKeep();
        const box = t.closest('.ctl-sl'), em = box.querySelector('em'); if (em) em.textContent = p.k === 'BAT' ? fmtSrc(srcVolt(p)) + ' V' : fmtSrc(acParts(p).amp) + ' V · ' + fmtHz(acParts(p).hz);
        if (t.dataset.ctl !== 'vsf') box.querySelectorAll('[data-ctl="vs"],[data-ctl="vsn"]').forEach(i => { if (i !== t) i.value = fmtSrc(p.k === 'BAT' ? srcVolt(p) : acParts(p).amp); });
      });
      return;
    }
    if ((t.dataset.ctl !== 'pos' && t.dataset.ctl !== 'posn') || !simMode) return;
    const x = parseFloat(String(t.value).replace(',', '.')); if (!isFinite(x)) return;
    setP(t.dataset.id, p => {
      const u = posUnit(p), v = clamp(u.from(clamp(x, u.min, u.max)), 0, 1); setPos(p, v); draw();
      const box = t.closest('.ctl-sl'), em = box.querySelector('em'); if (em) em.textContent = posText(u, v);
      box.querySelectorAll('input').forEach(i => { if (i !== t) i.value = posNum(u, v); });
    });
  });
  pl.addEventListener('click', e => { const b = e.target.closest('[data-ctl="unit"]'); if (!b || !simMode) return; setP(b.dataset.id, p => { posUnitNext(p); }); pl.dataset.h = ''; refreshControls(); });
  pl.addEventListener('change', e => { if (e.target.dataset.ctl === 'pos') { try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} } });
  let held = null;
  pl.addEventListener('pointerdown', e => { const b = e.target.closest('[data-ctl="hold"]'); if (!b || !simMode) return; held = b.dataset.id; setP(held, p => { pressPart(p); b.classList.add('on'); draw(); }); });
  const rel = () => { if (held == null) return; setP(held, p => { releasePart(p); draw(); }); held = null; refreshControls(); };
  window.addEventListener('pointerup', rel); window.addEventListener('pointercancel', rel);
})();
const listMode = () => window.matchMedia('(min-width:720px)').matches;
window.matchMedia('(min-width:720px)').addEventListener && window.matchMedia('(min-width:720px)').addEventListener('change', () => buildPalette());
$('#parts').addEventListener('input', e => { if (e.target.id === 'pq') { partQuery = e.target.value; applyPartFilter(); } });
$('#parts').addEventListener('keydown', e => { if (e.target.id !== 'pq') return; if (e.key === 'Enter') { const one = [...$('#parts').querySelectorAll('.pit:not([hidden])')]; if (one.length) { placeRot = 0; setTool('place', one[0].dataset.k); } } else if (e.key === 'Escape') { partQuery = ''; e.target.value = ''; applyPartFilter(); } });
$('#parts').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { placeRot = 0; setTool('place', b.dataset.k); } });
$('#pal').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'place') { placeRot = 0; setTool('place', b.dataset.k); } else if (b.dataset.t === 'reset') resetSim(); else if (b.dataset.t === 'autoroute') { autoRoute = !autoRoute; try { localStorage.setItem('lm4.autoroute', autoRoute ? '1' : '0'); } catch (e2) {} buildPalette(); toast(autoRoute ? 'Auto-Weg an: der Draht sucht den Weg mit 90°-Knicken selbst' : 'Auto-Weg aus: gerade Stücke, Knickpunkte selbst setzen'); } else setTool(b.dataset.t); });
$('#pal').addEventListener('wheel', e => { const el = e.currentTarget; if (el.scrollWidth <= el.clientWidth) return; el.scrollLeft += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY; e.preventDefault(); }, { passive: false });
(function () {
  const el = $('#pal'); let drag = null, sup = false;
  el.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, l: el.scrollLeft, m: false }; });
  window.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) > 4) drag.m = true; if (drag.m) el.scrollLeft = drag.l - dx; });
  window.addEventListener('pointerup', () => { if (drag && drag.m) { sup = true; setTimeout(() => { sup = false; }, 60); } drag = null; });
  el.addEventListener('click', e => { if (sup) { e.stopPropagation(); e.preventDefault(); } }, true);
})();

/* ============ Seitenleiste ============ */
function toggleRun() { if (!simMode) return; running = !running; lastFrame = performance.now(); refreshUI(); }

/* ============ Vorhersage-Modus: erst tippen, dann simulieren ============ */
function predictQuestions() {
  const q = [];
  sch.parts.forEach(p => {
    if (p.k === 'LED') q.push({ id: 'p' + p.id, k: 'led', pid: p.id, text: 'Leuchtet die LED ' + (p.l || '') + '?' });
    else if (p.k === 'LAMP') q.push({ id: 'p' + p.id, k: 'lamp', pid: p.id, text: 'Brennt die Lampe ' + (p.l || '') + '?' });
    else if (p.k === 'RLY') q.push({ id: 'p' + p.id, k: 'rly', pid: p.id, text: 'Zieht das Relais ' + (p.l || '') + ' an?' });
  });
  return q.slice(0, 3);
}
function predictRead(qs) {
  const out = {}; if (!circ) return out;
  qs.forEach(q => {
    const els = circ.elems.filter(e => e.part && e.part.id === q.pid);
    if (q.k === 'led') out[q.id] = els.some(e => e.led && Math.abs(e.i || 0) > 0.001);
    else if (q.k === 'lamp') out[q.id] = els.some(e => e.lamp && e.g && (e.i * e.i / e.g) >= 0.15 * e.lamp);
    else out[q.id] = els.some(e => e.relay && e.on);
  });
  return out;
}
function setSimMode(on) {
  if (on && !simMode && window.Predict && window.Predict.on() && sch.parts.length) {
    const qs = predictQuestions();
    if (qs.length) { window.Predict.run(qs, () => setSimModeNow(true), () => predictRead(qs), () => !!sim && sim.t >= 0.4); return; }
  }
  setSimModeNow(on);
}
function setSimModeNow(on) {
  tlClear(); if (!on) incident = null;
  if (on && !sch.parts.length) { toast('Noch keine Bauteile gezeichnet'); return; }
  simMode = on; sel = null; wireStart = null; ghost = null; act = null;
  if (on) { tool = 'select'; rebuild(); sim.reset(); phase.clear(); lastSample = -1; running = true; lastFrame = performance.now(); startProgram(); }
  else { running = false; tool = 'select'; prog = null; if (window.LochFX) LochFX.toneOff(); }
  const sw = $('#bSim'); if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  $('#bRun').style.display = on ? '' : 'none'; { const ws = $('#bWater'); if (ws) ws.style.display = on ? '' : 'none'; }
  if (window.LochFX) { LochFX.showBtn(on); LochFX.clear(); if (on) LochFX.unlock(); }
  buildPalette(); refreshUI(); draw();
}
function resetSim() { tlClear(); if (window.LochFX) LochFX.clear(); rebuild(); startProgram(); if (window.LochFX) LochFX.toneOff(); sim.t = 0; sim.reset(); simTime = 0; phase.clear(); lastSample = -1; refreshUI(); draw(); }
function refreshUI() {
  const side = $('#side'); if (!side) return;
  $('#bRun').textContent = running ? '⏸' : '▶';
  $('#bRun').classList.toggle('on', running);
  $('#bUndo').disabled = simMode || hi <= 0; $('#bRedo').disabled = simMode || hi >= hist.length - 1;
  $('#title').textContent = sch.name;
  let h = incidentCardHtml() + (window.LAB_EXTRA_CARD ? window.LAB_EXTRA_CARD() : '') + taskCardHtml() + diceCardHtml() + meterCardHtml();
  if (!(LAB === 'haus' && window.HAUS_SIDE)) h += pinsCardHtml();
  if (simMode) {
    h += `<div class="card"><h4>Simulation</h4>
    <div class="row2"><button class="btn pri" data-a="run">${running ? '⏸ Stopp' : '▶ Start'}</button><button class="btn" data-a="reset">↺ Zurück</button></div>
    <div class="kv"><span>Zeit</span><b id="tLbl">${fmtT(sim ? sim.t : 0)}</b></div>
    <label class="sl"><span>Tempo<em id="tempoLbl">${tempoText()}</em></span><input type="range" id="slTempo" min="0" max="1" step="0.005" value="${tempo}"></label>
    <div id="tempoHint">${tempoHintHtml()}</div>
    <div style="margin-top:8px"><div class="kv"><span>⏪ Zeitreise</span><b id="tlT">–</b></div><input type="range" id="tlR" min="0" max="0" value="0" step="1" aria-label="Zeitreise"><div class="row2"><button class="btn" data-a="tlback">◀ Schritt</button><button class="btn" data-a="tlfwd">Schritt ▶</button><button class="btn" data-a="tllive">Live</button></div><div class="row2" style="margin-top:6px"><button class="btn" data-a="water">${water ? '💧 Wasser-Ansicht: an' : '💧 Wasser-Ansicht'}</button></div>${prog ? '<p class="hint2">Bei Programmen (Arduino, Pi) gibt es keine Zeitreise.</p>' : ''}</div>
    <label class="sl"><span>Strompunkte</span><input type="range" id="slDot" min="0" max="1" step="0.01" value="${dotSpeed}"></label>
    <div class="kv"><span>Graph-Zeitfenster</span><span>${[0.001, 0.01, 0.1, 1, 10].map(w => `<button class="mini ${Math.abs(w - graphWin) < 1e-9 ? 'on' : ''}" data-win="${w}">${w >= 1 ? w + ' s' : w * 1000 + ' ms'}</button>`).join('')}</span></div>
  </div><div id="warn"></div>`;
  }
  if (LAB === 'haus' && window.HAUS_SIDE) { h = h.replace(/<button[^>]*data-a="water"[^>]*>[\s\S]*?<\/button>/, '').replace(/<label class="sl"><span>Strompunkte<\/span>[\s\S]*?<\/label>/, '').replace(/<div class="kv"><span>Graph-Zeitfenster<\/span>[\s\S]*?<\/span><\/div>/, ''); h += window.HAUS_SIDE(simMode); side.innerHTML = h; side.classList.toggle('quiet', false); return; }
  if (!simMode && tool === 'place' && placeKind) {
    const K = KINDS[placeKind];
    h += `<div class="card"><h4 data-wk="${placeKind}">${esc(K.name)} setzen</h4><div class="row2"><button class="btn" data-a="rotl">↺</button><span class="sval">${placeRot * 90}°</span><button class="btn" data-a="rotr">↻</button></div><p class="hint2">${K.pins === T2 ? (leg1 ? 'Erstes Bein steht. Jetzt Richtung und Länge wählen (Maus bewegen oder ziehen) und das zweite Bein absetzen. Der Körper bleibt gleich, nur die Anschlussdrähte werden länger. Esc bricht ab.' : 'Erstes Bein antippen, dann Richtung und Länge wählen und das zweite Bein absetzen. Oder vom ersten Bein zum zweiten ziehen.') : 'Auf die Zeichenfläche tippen. Ausrichtung mit ↺ ↻ oder Taste R.'}</p>${K.pins === T2 ? `<label class="chk"><input type="checkbox" data-a="tleg" ${twoLegOn ? 'checked' : ''}> Beine ziehen und ausrichten</label>` : ''}<button class="btn" data-a="keyhelp">⌨ Tastenkürzel (?)</button></div>`;
  } else if (sel && sel.t === 'part') {
    const p = byPart(sel.id); if (p) {
      const K = KINDS[p.k];
      h += `<div class="card"><h4 data-wk="${p.k}">${esc(p.l ? p.l + ' · ' : '')}${esc(K.name)}</h4>`;
      K.props.forEach(([key, label, type, opt, names]) => {
        if (type === 'ictype' && window.LochSimICs) { const cur = LochSimICs.find(p.v), ck = cur ? cur.key : ''; h += `<label class="f"><span>Typ</span><select data-ic="1">${ck ? '' : '<option value="">(eigener Wert)</option>'}${LochSimICs.SORT.map(q => `<option value="${q}" ${q === ck ? 'selected' : ''}>${esc(LochSimICs.CATALOG[q].name)}</option>`).join('')}</select></label><label class="f"><span>Wert</span><input data-p="v" value="${esc(p.v || '')}"></label>`; return; }
        if (type === 'text') h += `<label class="f"><span>${label}</span><input data-p="${key}" value="${esc(p[key] == null ? '' : p[key])}" placeholder="${esc(opt || '')}"></label>` + (key === 'v' && LS.PRESETS[p.k] ? `<div class="pre">${LS.PRESETS[p.k].filter(x => x !== '').map(x => `<button data-a="preset" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '');
        else if (type === 'range' && key === 'pos' && K.pos) { const u = posUnit(p), v = posVal(p), multi = posUnits(p).length > 1; h += `<div class="sl"><span>${label}<em id="posEm">${posText(u, v)}</em></span><div style="display:flex;gap:6px;align-items:center"><input type="range" data-p="pos" data-pu="1" min="${u.min}" max="${u.max}" step="${u.step}" value="${posNum(u, v)}" style="flex:1;min-width:0"><input type="number" data-pn="1" min="${u.min}" max="${u.max}" step="${u.step}" value="${posNum(u, v)}" style="width:72px" aria-label="Wert"></div>${multi ? `<button class="btn" data-a="posunit" style="margin-top:4px;padding:3px 10px;font-size:12px">Einheit wechseln: ${esc(u.u)} → ${esc(posUnits(p).find(x => x.id !== u.id).u)}</button>` : ''}</div>`; }
        else if (type === 'range') h += `<label class="sl"><span>${label}</span><input type="range" data-p="${key}" min="0" max="1" step="0.01" value="${p[key] == null ? 0.5 : p[key]}"></label>`;
        else if (type === 'select') h += `<label class="f"><span>${label}</span><select data-p="${key}">${opt.map(o => `<option value="${o}" ${(p[key] || K[key]) === o ? 'selected' : ''}>${names ? names[o] : o}</option>`).join('')}</select></label>`;
      });
      if (LAB === 'sim' && !simMode && isGod()) h += `<label class="f"><span>Fehler (Lehrer)</span><select data-p="defect">${[['', 'keiner'], ['open', 'unterbrochen'], ['short', 'Kurzschluss']].map(([v, l]) => `<option value="${v}" ${(p.defect || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`;
      if (K.toggle) h += `<button class="btn" data-a="sw">Schalter umlegen (${p.sw ? 'an' : 'aus'})</button>`;
      if (!simMode) h += `<label class="f" style="margin-top:8px"><span>Bezeichnung</span><input data-p="l" value="${esc(p.l || '')}"></label><div class="row2" style="margin-top:8px"><button class="btn" data-a="rotl">↺</button><button class="btn" data-a="rotr">↻</button><button class="btn" data-a="dup">⧉</button><button class="btn danger" data-a="del">Löschen</button></div>`;
      if (K.props.some(q => q[2] === 'ictype')) { const dt = String(p.v || '').replace(/[^A-Za-z0-9._-]/g, ''); if (dt) h += `<p class="hint2" style="margin-top:8px"><a href="https://www.google.com/search?q=${encodeURIComponent(dt + ' datasheet')}" target="_blank" rel="noopener noreferrer">Datenblatt im Web suchen</a> (${esc(dt)}, öffnet neuen Tab, braucht Internet)</p>`; }
      if (window.Speak && window.Speak.info(p.k)) h += '<div class="row2" style="margin-top:8px"><button class="btn" data-a="speak">🔊 Erkläre dich</button></div>';
      if (simMode) h += '<div id="live"></div>';
      h += '</div>';
    }
  } else if (!simMode && sel && sel.t === 'wire') {
    h += `<div class="card"><h4>Draht</h4>${LAB === 'sim' ? `<div class="kv"><span>Aderfarbe</span></div><div class="wc">${Object.keys(WIRECOL).map(c => `<button class="chip ${(byWire(sel.id) || {}).c === c ? 'on' : ''}" data-a="wcol" data-c="${c}">${WIRENAME[c]}</button>`).join('')}</div>` : ''}<button class="btn danger" data-a="del" style="margin-top:8px">Löschen</button></div>`;
  } else if (LAB === 'sim' && !simMode && tool === 'wire') {
    h += `<div class="card"><h4>Aderfarbe</h4><div class="wc">${Object.keys(WIRECOL).map(c => `<button class="chip ${wireColor === c ? 'on' : ''}" data-a="wcol" data-c="${c}">${WIRENAME[c]}</button>`).join('')}</div><p class="hint2">Braun oder schwarz = Außenleiter L, blau = Neutralleiter N, grün-gelb = Schutzleiter PE.</p></div>`;
  } else if (!(simMode && !sel)) {
    h += `<div class="card"><h4>Hinweise</h4><p class="hint2">${{ select: 'Bauteil antippen zum Bearbeiten, ziehen zum Verschieben.', wire: 'Start und Ziel antippen: mit „Auto-Weg“ sucht das Programm den Weg mit 90°-Knicken um Bauteile herum, Kreuzungen ohne Lötpunkt sind erlaubt. Gleichen Punkt nochmal antippen = Ende.', erase: 'Bauteil oder Draht antippen zum Löschen.', scope: 'Bauteil oder Draht antippen: Graph für Spannung und Strom.', place: 'Bauteil in der Leiste wählen.' }[tool]}</p></div>`;
  }
  if (simMode && !sel) h += `<div class="card"><h4>Hinweise</h4><p class="hint2">Schalter antippen = umlegen, Taster gedrückt halten. „Graph“ zeigt Spannung und Strom eines Bauteils.</p><p class="hint2">Grün = positive Spannung, Rot = negative, Grau = Masse. Gelbe Punkte zeigen den Stromweg.</p></div>`;
  if (!simMode) h += `<div class="card"><h4>Drucken und Simulieren</h4><p class="hint2">Oben den Schalter auf „Sim“ stellen, um die Schaltung laufen zu lassen. Im Menü findest du „Drucken“ für den Plan und die Bauteilliste.</p></div>`;
  side.innerHTML = h; side.classList.toggle('quiet', !sch.task && !simMode);
}
const fmtT = t => (t < 1e-3 ? (t * 1e6).toFixed(1) + ' µs' : t < 1 ? (t * 1e3).toFixed(2) + ' ms' : t.toFixed(3) + ' s');
/* Hinweis bei niedrigem Tempo: Relais, Schütze und Thyristoren brauchen einige Millisekunden Simulationszeit, bei 4 ms pro Sekunde also mehrere Sekunden */
function tempoHintHtml() {
  if (rateOf(tempo) >= 0.03 || !sch.parts.some(p => ['IMP', 'RLY', 'SCHUETZ', 'THY', 'TRIAC', 'TRF'].includes(p.k))) return '';
  return '<p class="hint2" style="margin:2px 0 8px">Das Tempo ist niedrig: Relais und Schütze brauchen etwas Simulationszeit und reagieren deshalb erst nach einigen Sekunden. <button class="btn" data-a="faster" style="margin-top:4px">Schneller stellen</button></p>';
}
const tempoText = () => { const r = rateOf(tempo); return r < 1e-3 ? (r * 1e6).toFixed(0) + ' µs/s' : r < 1 ? (r * 1e3).toFixed(1) + ' ms/s' : r.toFixed(1) + ' s/s'; };
$('#side').addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-win]'); if (!b) return;
  if (b.dataset.win) { graphWin = parseFloat(b.dataset.win); scopeBuf = sch.scopes.map(() => ({ t: [], v: [], i: [] })); lastSample = -1; refreshUI(); return; }
  const a = b.dataset.a;
  if (window.LAB_EXTRA_CLICK && window.LAB_EXTRA_CLICK(a, b)) return;
  if (a === 'pins') { togglePins(); return; }
  if (a === 'why') { if (incident) { incident.open = true; refreshUI(); } return; }
  if (a === 'whyx') { incident = null; refreshUI(); return; }
  if (a === 'mmD') { meterDial(b.dataset.v); refreshUI(); draw(); return; }
  if (a === 'mmJ') { meter.jack = b.dataset.v; refreshUI(); return; }
  if (a === 'mmFuse') { meter.fuse = false; meter.fuse10 = false; toast('Neue Messgerätesicherung eingesetzt'); refreshUI(); return; }
  if (a === 'posunit') { const p0 = sel && sel.t === 'part' && byPart(sel.id); if (p0) { posUnitNext(p0); refreshUI(); } return; }
  if (a === 'speak') { const p0 = sel && sel.t === 'part' && byPart(sel.id); if (p0) speakPart(p0); return; }
  if (a === 'water') { setWater(!water); return; }
  if (a === 'tlback') { tlGo((tlIdx >= 0 ? tlIdx : tl.length - 1) - 1); return; }
  if (a === 'tlfwd') { tlStepFwd(); return; }
  if (a === 'tllive') { tlLive(); return; }
  if (a === 'dreport') { diceReport(); return; }
  if (a === 'droll') { rollFault(); return; }
  if (a === 'ddet') { openDetective(); return; }
  if (a === 'dreveal') { const dc = sch.dice; if (!dc) return; if (dc.solved) { diceFix(); refreshUI(); } else { const pp = byPart(dc.id); sel = pp ? { t: 'part', id: pp.id } : null; dc.msg = 'Auflösung: ' + diceText(dc); dc.solved = true; dc.revealed = true; refreshUI(); draw(); } return; }
  if (a === 'trand') { const t = TASKS.find(x => x.id === sch.task); if (t && t.rand) { try { localStorage.setItem('sim.rs.' + t.id, String((+localStorage.getItem('sim.rs.' + t.id) || 0) + 1)); } catch (e) {} startTask(t.id); } return; }
  if (a === 'faster') { tempo = Math.min(1, Math.max(tempo + 0.1, 0.62)); refreshUI(); return; }
  if (a === 'think') { const t0 = TASKS.find(x => x.id === sch.task), q = t0 && window.THINK && window.THINK[t0.id]; if (q && thinkAns[t0.id] == null) { thinkAns[t0.id] = +b.dataset.i; if (thinkAns[t0.id] === q.right) { try { const m = JSON.parse(localStorage.getItem('lm4.think') || '{}'); m[t0.id] = 1; localStorage.setItem('lm4.think', JSON.stringify(m)); if (window.Badges) window.Badges.stat('denk', Object.keys(m).length, 'max'); } catch (e) {} } refreshUI(); } return; }
  if (a === 'tcheck') { runTaskCheck(); return; }
  if (a === 'treport') { reportFault(); return; }
  if (a === 'thand') { const t = TASKS.find(x => x.id === sch.task); if (t && window.Auswertung) window.Auswertung.handIn(t.id, taskDone()[t.id] || 0, t.title); return; }
  if (a === 'thint') { const t = TASKS.find(x => x.id === sch.task); if (t) taskHint(t); return; }
  if (a === 'tstop') { sch.task = undefined; taskRes = null; commit(true, true); refreshUI(); return; }
  if (a === 'preset') { const p0 = sel && sel.t === 'part' && byPart(sel.id); if (p0) { p0.v = b.dataset.v; commit(true, true); rebuildKeep(); refreshUI(); } return; }
  if (a === 'wcol') { const w = sel && sel.t === 'wire' && byWire(sel.id); wireColor = b.dataset.c; if (w) { w.c = wireColor; commit(true); } refreshUI(); draw(); return; }
  if (a === 'run') toggleRun(); else if (a === 'reset') resetSim();
  else if (a === 'keyhelp') { if (window.LochKeys) window.LochKeys.help(); } else if (a === 'tleg') { twoLegOn = !twoLegOn; try { localStorage.setItem('lm4.twoleg', twoLegOn ? '1' : '0'); } catch (e) {} leg1 = null; ghost = null; refreshUI(); }
  else if (a === 'rotl') rotSel(3); else if (a === 'rotr') rotSel(1);
  else if (a === 'dup') dupSel(); else if (a === 'del') delSel();
  else if (a === 'sw') { const p = byPart(sel.id); p.sw = p.sw ? 0 : 1; const w = wrapMap.get(p.id); if (w) w.sw = p.sw; commit(true); }
});
$('#side').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'tlR') { tlGo(+t.value); return; }
  if (t.id === 'slTempo') { tempo = parseFloat(t.value); $('#tempoLbl').textContent = tempoText(); const th = $('#tempoHint'); if (th) th.innerHTML = tempoHintHtml(); return; }
  if (t.id === 'slDot') { dotSpeed = parseFloat(t.value); return; }
  if ((t.dataset.pu || t.dataset.pn) && sel && sel.t === 'part') {
    const p = byPart(sel.id), x = parseFloat(String(t.value).replace(',', '.')); if (!p || !isFinite(x)) return;
    const u = posUnit(p), v = clamp(u.from(clamp(x, u.min, u.max)), 0, 1); setPos(p, v); try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} draw();
    const box = t.closest('.sl'), em = box.querySelector('em'); if (em) em.textContent = posText(u, v); box.querySelectorAll('input').forEach(i => { if (i !== t) i.value = posNum(u, v); });
    return;
  }
  if (t.dataset.p && sel && sel.t === 'part') {
    const p = byPart(sel.id), key = t.dataset.p; let v = t.value;
    if (key === 'l') { p.l = v; commit(true, true); draw(); return; }
    if (t.type === 'range') { v = parseFloat(v); p[key] = v; const w = wrapMap.get(p.id); if (w) { w.pos = v; w.light = v; } try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} draw(); return; }
    p[key] = v; commit(true, true); rebuildKeep();
  }
});
const ICDEF = { '555': 'NE555', '7400': 'SN7400', '7402': 'SN7402', '7404': 'SN7404', '7408': 'SN7408', '7432': 'SN7432', '7486': 'SN7486', '7414': 'SN74HC14', '4011': 'CD4011', '4001': 'CD4001', '4081': 'CD4081', '4071': 'CD4071', '4093': 'CD4093', '4069': 'CD4069', '7474': 'SN7474', '4013': 'CD4013', '4017': 'CD4017', '4020': 'CD4020', '7490': 'SN7490', '7447': 'SN7447', '4511': 'CD4511', '741': 'LM741', '358': 'LM358', '072': 'TL072', '324': 'LM324' };
$('#side').addEventListener('change', e => {
  const t0 = e.target;
  if (t0.dataset && t0.dataset.p && t0.type !== 'range' && sel && sel.t === 'part' && t0.tagName === 'INPUT') {
    const p1 = byPart(sel.id), K1 = KINDS[p1.k];
    if (t0.dataset.p === 'v') { const s = LS.sane(K1.core, t0.value); if (!s.ok && !s.high) { toast('Wert unrealistisch, Standardwert ' + s.v + ' übernommen'); p1.v = s.v; t0.value = s.v; commit(true, true); rebuildKeep(); } }
    else if (t0.dataset.p === 'imax' && t0.value) { const x = LS.si(t0.value, 0); if (!(x >= 1e-3 && x <= 100)) { toast('Max. Strom unrealistisch, Eingabe gelöscht'); p1.imax = ''; t0.value = ''; commit(true, true); rebuildKeep(); } }
  }
  if (t0.dataset && t0.dataset.ic && sel && sel.t === 'part') { const p0 = byPart(sel.id), C = window.LochSimICs && LochSimICs.CATALOG[t0.value]; if (p0 && C) { p0.v = ICDEF[t0.value] || t0.value; p0.n = C.np; commit(); } return; } const t = e.target; if (t.tagName === 'SELECT' && t.dataset.p && sel) { const p = byPart(sel.id); p[t.dataset.p] = t.value; commit(); } });
function rebuildKeep() { rebuild(); draw(); }

/* ============ Hauptschleife ============ */
function loop(now) {
  const rdt = Math.min((now - lastFrame) / 1000, 0.1); lastFrame = now;
  try {
    if (running && tlIdx >= 0) { tl = tl.slice(0, tlIdx + 1); tlIdx = -1; }
    if (running) { advance(rdt); stepPhases(rdt); dirtyDraw = true; if (now - tlLab > 300) { tlLab = now; tlLabel(); } }
    if (window.LochFX && LochFX.active()) dirtyDraw = true;
    if (dirtyDraw) { dirtyDraw = false; render(); }
    if (running || sel) updateLive();
  } catch (e) { console.error(e); running = false; toast('Fehler in der Simulation: ' + e.message); refreshUI(); }
  requestAnimationFrame(loop);
}
let lastLive = 0;
function updateLive() {
  const now = performance.now(); if (now - lastLive < 120) return; lastLive = now;
  refreshControls(); codeTick();
  if (simMode && tool === 'meter') { const mv = $('#mmVal'); if (mv) { const t = meterText(); mv.textContent = t.main; const ms = $('#mmSub'); if (ms) ms.textContent = t.sub; const fb = $('#mmFuseBtn'); if (fb) fb.disabled = !(meter.fuse || meter.fuse10); const fs = $('#mmFuseSt'); if (fs) fs.textContent = meter.fuse || meter.fuse10 ? 'defekt' : 'in Ordnung'; } }
  const t = $('#tLbl'); if (t && sim) t.textContent = fmtT(sim.t);
  const w = $('#warn'); if (w) {
    const msgs = []; if (!sch.parts.some(p => p.k === 'BAT' || p.k === 'AC' || p.k === 'NETZ' || p.k === 'NETZ3' || p.k === 'UNO' || p.k === 'PI' || ['GATE', 'DFF'].includes(KINDS[p.k].core))) msgs.push('Keine Spannungsquelle in der Schaltung.');
    else if (!hasGround()) msgs.push('Keine Masse gesetzt. Es wird der Minuspol der Quelle als Masse genommen.');
    circ && circ.warnings.forEach(x => { const it = x.part && x.part.item; if (it) msgs.push((it.l || KINDS[it.k].name) + ': ' + x.text); });
    circ && circ.elems.forEach(e => { if (e.type === 'V' && e.cc && e.part && e.part.item) msgs.push((e.part.item.l || 'Quelle') + ' begrenzt den Strom auf ' + fmt(e.imax, 'A') + ': die Spannung bricht ein.'); });
    sim && sim.burnt.forEach(id => { const p = byPart(id); if (p) msgs.push(KINDS[p.k].name + ' ist durchgebrannt (mit „Zurück“ wiederherstellen).'); });
    const html = msgs.length ? `<div class="card warn"><ul>${msgs.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div>` : '';
    if (w.innerHTML !== html) w.innerHTML = html;
  }
  const L = $('#live'); if (L && sel && sel.t === 'part' && circ) {
    const p = byPart(sel.id); if (!p) return;
    const pins = pinsOf(p), es = circ.elems.filter(e => e.part && e.part.id === p.id), rows = [];
    const e0 = es.find(x => x.type !== 'S' || x.closed) || es[0];
    if (e0 && showSim()) {
      if (e0.type === 'Q') { rows.push(['Uce', fmt(sv(gk(...pins[1])) - sv(gk(...pins[2])), 'V')], ['Ic', fmt(e0.ic, 'A')], ['Ib', fmt(e0.ib, 'A')]); }
      else { const u = sv(gk(...pins[0])) - sv(gk(...pins[1])); rows.push(['Spannung', fmt(u, 'V')], ['Strom', fmt(e0.type === 'V' ? -e0.i : e0.i, 'A')], ['Leistung', fmt(Math.abs(u * (e0.type === 'V' ? -e0.i : e0.i)), 'W')]); }
    } else rows.push(['', 'Start drücken']);
    const html = rows.map(([a, b]) => `<div class="kv"><span>${a}</span><b>${b}</b></div>`).join('');
    if (L.innerHTML !== html) L.innerHTML = html;
  }
}

/* ============ Menü, Dateien, Beispiele ============ */
function sheet(title, build) {
  const bd = document.createElement('div'); bd.className = 'backdrop';
  bd.innerHTML = `<div class="sheet"><div class="sh-h"><b>${esc(title)}</b><button class="x">✕</button></div><div class="sh-b"></div></div>`;
  document.body.appendChild(bd); const close = () => bd.remove();
  bd.addEventListener('pointerdown', e => { if (e.target === bd) close(); });
  bd.querySelector('.x').onclick = close; build(bd.querySelector('.sh-b'), close); return close;
}
function openMenu() {
  sheet('Menü', (b, close) => {
    const rows = [['new', 'Neue Schaltung', 'Leere Fläche'], ['tasks', 'Aufgaben', 'Aufgaben bearbeiten und prüfen lassen'], ['open', 'Gespeicherte Schaltungen', 'Auf diesem Gerät'], ['print', 'Drucken', 'Plan und Bauteilliste'], ['lern', 'Lernstand sichern oder laden', 'Fortschritt als Code oder Datei mitnehmen'], ...(window.LAB_EXTRA_MENU ? window.LAB_EXTRA_MENU() : []), ['ex', 'Beispielschaltungen', `${EXAMPLES.filter(exOk).length} Schaltungen zum Ausprobieren`], ['save', 'Speichern unter …', sch.name], ['export', 'Als Text sichern', 'Zum Weitergeben oder als Backup'], ['import', 'Aus Text laden', 'Gesicherten Text einfügen'], ['share', 'Teilen', 'Link zum Weitergeben (Schaltung steckt im Link)'], ...(LAB === 'sim' ? [['cab', 'Schaltschrank-Ansicht', 'Sicherungsautomaten und FI wie im Verteiler bedienen']] : []), ['teacher', 'Lehrer-Bereich', 'Aufgaben verteilen, Abgaben prüfen (nur mit Freigabe)'], ['img', 'Als Bild exportieren', 'Gedrückt halten zum Sichern'], ['fit', 'Ansicht einpassen', ''], ['lab', 'Zum Lochraster-Layout', 'LochLab öffnen'], ['auto', 'Layout automatisch erzeugen', 'Nur mit Freigabe (Ausbilder)'], ['start', 'Zur Startseite', 'Layout oder Stromlaufplan wählen'], ['calc', 'Rechner', 'Ohm, Farbcode, LED-Vorwiderstand, Teiler, RC, Leitung'], ['proto', 'Messprotokoll', 'Soll berechnen, messen, vergleichen, drucken'], ['tag', 'Tagesaufgabe', 'Jeden Tag neue Zahlen, mit Serie'], ['duell', 'Duell', 'Gleiche Aufgabe, schnellste Zeit gewinnt'], ['escape', 'Escape-Room', 'Aufgaben lösen, Türcode finden'], ['abz', 'Abzeichen', 'Deine Sammlung und was noch fehlt'], ['speak', 'Bauteile sprechen automatisch', 'Antippen = Steckbrief per Sprachausgabe (an/aus)'], ...(window.WikiLabs ? [['wikih', 'Wiki-Hilfe (?) anzeigen', 'Kleine ?-Knöpfe an Bauteilen und Messgeräten (an/aus)']] : []), ['ton', 'Tonwerkstatt', 'Klaviertasten, tone()-Code und 555-Sirene zum Hören'], ['trainer', 'Trainer: Erste Schritte', 'Kurze Einführung zum Mitmachen'], ['det', 'Schaltungs-Detektiv', 'Acht Fälle: Fehler per Messung finden'], ['loet', 'Lötübung', 'Löten üben und schlechte Lötstellen finden'], ['oszi', 'Oszilloskop-Trainer', 'Ablesen üben und Kurven-Rätsel'], ['voice', 'Sprachsteuerung an/aus', 'Befehle mit dem Mikrofon (Zustimmung nötig)'], ['feel', 'Bauteile fühlen an/aus', 'Klicks und Vibration: Relais, Schalter, Motor, Kurzschluss'], ['fun', 'Sprüche und Effekte an/aus', 'Lustige Sprüche, Konfetti und Rauchringe (Ton: Lautsprecher-Knopf)'], ['kamp', 'Kampagne: Das Abschlussgerät', 'Lernpfad mit Geschichte über alle Labs'], ['neu', 'Neu in dieser Version', 'Was zuletzt dazukam und wo du es findest'], ['water', 'Wasser-Ansicht an/aus', 'Strom als Wasser, Spannung als Druck (in der Simulation)'], ['dice', 'Fehler-Würfel', 'Würfelt einen versteckten Fehler in die Schaltung'], ['predict', 'Vorhersage-Modus an/aus', 'Vor dem Start tippen, was passiert'], ['png', 'Bild speichern (PNG)', 'Aktuelle Ansicht als Bilddatei'], ['gif', 'Animation als GIF', 'Laufende Simulation aufnehmen und teilen'], ['csv', 'Oszilloskop-Daten (CSV)', 'Messkurven als Tabelle für Excel'], ['erg', 'Ergebnis senden', 'Code für den Ausbilder: meine bearbeiteten Aufgaben'], ['keys', 'Tastenkürzel', 'Alle Tasten, zum Beispiel R für Widerstand (Taste ? drücken)'], ['help', 'Hilfe', '']];
    b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b><small>${esc(r[2])}</small></div></button>`).join('');
    b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
  });
}


/* ============ CodeLab: Arduino-Programm ausführen ============ */
let prog = null, serLog = '', serLine = '', serSeries = [[], [], []], serMode = 'text', serRx = [], lcdState = null, serDirty = true, lastCodeStatus = '';
const AR = window.Arduino;
function codeStatus(msg, bad) { if (bad && /^Fehler/.test(msg) && window.LochFX) LochFX.sound('sad', 0.55); const s = $('#codeStatus'); if (!s) return; s.textContent = msg; s.style.color = bad ? '#ff8a7a' : 'var(--mute)'; lastCodeStatus = msg; }
function serAppend(s) {
  serLog += s; if (serLog.length > 6000) serLog = serLog.slice(-4500); serDirty = true; serLine += s;
  let i; while ((i = serLine.indexOf('\n')) >= 0) { const ln = serLine.slice(0, i); serLine = serLine.slice(i + 1); const nums = ln.match(/-?\d+(?:\.\d+)?/g); if (nums) nums.slice(0, 3).forEach((x, k) => { serSeries[k].push(parseFloat(x)); if (serSeries[k].length > 300) serSeries[k].shift(); }); }
}
function lcdCmd(name, a) {
  if (!lcdState) lcdState = { rows: ['                ', '                '], col: 0, row: 0 };
  const L = lcdState;
  if (name === 'setCursor') { L.col = Math.max(0, Math.min(15, a[0] | 0)); L.row = Math.max(0, Math.min(1, a[1] | 0)); }
  else if (name === 'clear') { L.rows = ['                ', '                ']; L.col = 0; L.row = 0; }
  else if (name === 'print' || name === 'println' || name === 'write') { const t = String(a[0] == null ? '' : a[0]); for (const ch of t) { if (L.col > 15) break; const r = L.rows[L.row]; L.rows[L.row] = r.slice(0, L.col) + ch + r.slice(L.col + 1); L.col++; } }
  serDirty = true; return 0;
}
function makeIO(el) {
  return LochMcuIO.ard(el, { get S() { return sim; }, get C() { return circ; }, print: serAppend, get rx() { return serRx; }, lcd: lcdCmd });
}
function makeIOPi(el, ctx) {
  return LochMcuIO.pi(el, ctx ? { S: ctx.sim, C: ctx.circ, print: ctx.print } : { get S() { return sim; }, get C() { return circ; }, print: serAppend });
}
function startPyProgram() {
  const PY = window.PyRun; if (!PY) return;
  const c = PY.compile(sch.code || '');
  if (!c.ok) { const e = c.errors[0]; codeStatus('Fehler in Zeile ' + e.line + ': ' + e.msg, true); serAppend('⚠ Fehler in Zeile ' + e.line + ': ' + e.msg + '\n'); return; }
  const el = circ && circ.mcu; if (!el) { codeStatus('Im Schaltplan fehlt der Raspberry Pi.', true); return; }
  const runner = PY.createRunner(c.program, makeIOPi(el)); runner.start(); prog = { runner, err: null, el, py: true };
  codeStatus('Programm läuft');
}
function startProgram() {
  prog = null; serLog = ''; serLine = ''; serSeries = [[], [], []]; serRx = []; lcdState = null; serDirty = true;
  if (LAB === 'pi') { startPyProgram(); return; }
  if (LAB !== 'code' || !AR) return;
  const c = AR.compile(sch.code || '');
  if (!c.ok) { const e = c.errors[0]; codeStatus('Fehler in Zeile ' + e.line + ': ' + e.msg, true); serAppend('⚠ Fehler in Zeile ' + e.line + ': ' + e.msg + '\n'); return; }
  const el = circ && circ.mcu; if (!el) { codeStatus('Im Schaltplan fehlt ein Arduino.', true); return; }
  const runner = AR.createRunner(c.program, makeIO(el)); runner.start(); prog = { runner, err: null, el };
  codeStatus('Programm läuft');
}
function stepProgram() {
  if (!prog) return;
  if (sim.burnt.has(prog.el.part.id)) { if (!prog.err) { prog.err = { msg: 'zerstört' }; codeStatus(prog.py ? 'Der Raspberry Pi ist zerstört (↻ Neu starten).' : 'Der Arduino ist zerstört (↻ Neu starten).', true); } return; }
  prog.runner.step(sim.t);
  const er = prog.runner.error; if (er && !prog.err) { prog.err = er; if (prog.py) codeStatus('Fehler in Zeile ' + er.line + ': ' + er.type + (er.msg ? ': ' + er.msg : ''), true); else { codeStatus('Fehler in Zeile ' + er.line + ': ' + er.msg, true); serAppend('\n⚠ Laufzeitfehler in Zeile ' + er.line + ': ' + er.msg + '\n'); } }
  else if (prog.runner.done && !prog.err) { prog.err = { msg: 'Programmende' }; codeStatus('Programm beendet'); }
}
function codeTick() {                                              // regelmäßig: Serial-Anzeige, Ton, Plotter
  if (!PROGLAB) return;
  const out = $('#serOut');
  if (serDirty && out) { out.textContent = serLog; out.scrollTop = out.scrollHeight; serDirty = false; if (serMode === 'plot') drawPlot(); }
  const mm = circ && circ.mcu && circ.mcu.mcu; let f = 0;
  if (mm && simMode && running) for (let q = 0; q < (mm.npin || 20); q++) if (mm.tone[q]) { f = mm.tone[q].f; break; }
  if (window.LochFX) { if (f) LochFX.tone(f); else LochFX.toneOff(); }
}
function drawPlot() {
  const cv2 = $('#serPlot'); if (!cv2) return; const g = cv2.getContext('2d'), W = cv2.width = cv2.clientWidth || 300, H = cv2.height = cv2.clientHeight || 120;
  g.clearRect(0, 0, W, H); g.fillStyle = '#0b0f13'; g.fillRect(0, 0, W, H);
  let mn = Infinity, mx = -Infinity; serSeries.forEach(s => s.forEach(v => { mn = Math.min(mn, v); mx = Math.max(mx, v); }));
  if (!isFinite(mn)) { g.fillStyle = '#8d99a6'; g.font = '12px sans-serif'; g.fillText('Keine Zahlen in der Ausgabe. Mit Serial.println(Wert) einen Messwert ausgeben.', 10, 20); return; }
  if (mx - mn < 1e-9) { mx += 1; mn -= 1; }
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { const y = 8 + (H - 16) * i / 4; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.fillStyle = '#8d99a6'; g.font = '10px sans-serif'; g.fillText((mx - (mx - mn) * i / 4).toFixed(mx - mn > 50 ? 0 : 1), 3, y - 2); }
  ['#ffe14d', '#4cd964', '#35d0ff'].forEach((col, k) => { const s = serSeries[k]; if (s.length < 2) return; g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); s.forEach((v, i) => { const x = 34 + (W - 40) * i / Math.max(299, s.length - 1), y = 8 + (H - 16) * (1 - (v - mn) / (mx - mn)); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke(); });
}
function syncCode() { const ta = $('#codeTa'); if (!ta) return; ta.value = sch.code || ''; gutter(); }
function gutter() { const ta = $('#codeTa'), gu = $('#codeGut'); if (!ta || !gu) return; const n = ta.value.split('\n').length; let s = ''; for (let i = 1; i <= n; i++) s += i + '\n'; gu.textContent = s; gu.scrollTop = ta.scrollTop; }
function initDock() {
  const ta = $('#codeTa'); if (!ta) return;
  ta.addEventListener('input', () => { sch.code = ta.value; gutter(); try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {} codeStatus('Änderung gilt ab dem nächsten Start (↻).'); });
  ta.addEventListener('scroll', () => { const gu = $('#codeGut'); if (gu) gu.scrollTop = ta.scrollTop; });
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart, en = ta.selectionEnd; ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(en); ta.selectionStart = ta.selectionEnd = s + 2; ta.dispatchEvent(new Event('input')); } });
  const startAll = () => { if (!simMode) setSimMode(true); else { resetSim(); running = true; lastFrame = performance.now(); refreshUI(); } };
  $('#cdRun').onclick = startAll; $('#cdNew').onclick = startAll;
  $('#cdStop').onclick = () => { running = false; refreshUI(); codeStatus('Angehalten'); };
  $('#cdEx').onclick = () => menuAct('ex');
  $('#cdSave').onclick = () => { const b = new Blob([sch.code || ''], { type: 'text/plain' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = (sch.name.replace(/[^\w\-]+/g, '_') || 'programm') + (LAB === 'pi' ? '.py' : '.ino'); document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); };
  $('#cdCopy').onclick = async () => { try { await navigator.clipboard.writeText(sch.code || ''); toast('Code kopiert'); } catch (e) { ta.select(); toast('Bitte markieren und kopieren'); } };
  [['#cdT1', 0.75], ['#cdT10', 0.875], ['#cdT100', 1]].forEach(([id, v]) => { $(id).onclick = () => { tempo = v; refreshUI(); }; });
  const tab = m => { serMode = m; $('#serOut').style.display = m === 'text' ? '' : 'none'; $('#serPlot').style.display = m === 'plot' ? '' : 'none'; $('#serTabT').classList.toggle('on', m === 'text'); $('#serTabP').classList.toggle('on', m === 'plot'); serDirty = true; if (m === 'plot') drawPlot(); };
  $('#serTabT').onclick = () => tab('text'); $('#serTabP').onclick = () => tab('plot'); tab('text');
  $('#serClr').onclick = () => { serLog = ''; serSeries = [[], [], []]; serDirty = true; };
  const send = () => { const i = $('#serIn'); const t = i.value; i.value = ''; for (const ch of t + '\n') serRx.push(ch.charCodeAt(0)); serAppend('> ' + t + '\n'); };
  $('#serSend').onclick = send; $('#serIn').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  syncCode();
}



/* Spannungsquellen in der Simulation verstellen: Gleichspannung (Volt) und Wechselspannung (Amplitude und Frequenz) */
const srcVolt = p => { const m = String(p.v == null ? '' : p.v).replace(',', '.').match(/([0-9]*\.?[0-9]+)/); return m ? parseFloat(m[1]) : 0; };
function acParts(p) {
  const t = String(p.v || '5V 1kHz').replace(',', '.'), a = t.match(/([0-9]*\.?[0-9]+)\s*V/i), f = t.match(/([0-9]*\.?[0-9]+)\s*(k?)Hz/i);
  return { amp: a ? parseFloat(a[1]) : 5, hz: f ? parseFloat(f[1]) * (f[2] ? 1000 : 1) : 1000 };
}
const fmtHz = hz => hz >= 1000 && hz % 100 === 0 ? String(hz / 1000).replace(/\.0+$/, '') + 'kHz' : String(Math.round(hz * 100) / 100) + 'Hz';
const fmtSrc = x => String(Math.round(x * 100) / 100);

/* ============ Regler in echten Einheiten ============ */
/* Jeder Regler speichert intern 0 bis 1 (pos). Angezeigt und eingestellt wird wahlweise in der echten Größe (°C, cm, lx, V, Ω) oder in Prozent. */
const PCT = { id: 'pct', u: '%', min: 0, max: 100, step: 1, to: v => v * 100, from: x => x / 100 };
const POSU = {
  NTC: { id: 't', u: '°C', min: -20, max: 120, step: 1, to: v => -20 + 140 * v, from: x => (x + 20) / 140 },
  TMP36: { id: 't', u: '°C', min: -40, max: 125, step: 1, to: v => -40 + 165 * v, from: x => (x + 40) / 165 },
  I2CTEMP: { id: 't', u: '°C', min: -25, max: 100, step: 0.5, to: v => -25 + 125 * v, from: x => (x + 25) / 125 },
  HCSR04: { id: 'cm', u: 'cm', min: 2, max: 400, step: 1, to: v => 2 + 398 * v, from: x => (x - 2) / 398 },
  I2CLUX: { id: 'lx', u: 'lx', min: 0, max: 2000, step: 10, to: v => 2000 * v * v, from: x => Math.sqrt(Math.max(x, 0) / 2000) },
  PIEZO: { id: 'v', u: 'V', min: 0, max: 5, step: 0.1, to: v => 5 * v, from: x => x / 5 },
};
POSU.PTC = POSU.NTC;
function posUnits(p) {
  if (p.k === 'POT') { const R = protoNum(p.v); if (isFinite(R) && R > 0) { const kk = R >= 1000, sc = kk ? 1000 : 1; return [{ id: 'r', u: kk ? 'kΩ' : 'Ω', min: 0, max: R / sc, step: R / sc / 100, to: v => v * R / sc, from: x => x * sc / R }, PCT]; } }
  return POSU[p.k] ? [POSU[p.k], PCT] : [PCT];
}
function posUnit(p) { const us = posUnits(p); let m = {}; try { m = JSON.parse(localStorage.getItem('lm4.posunit') || '{}'); } catch (e) {} return us.find(x => x.id === m[p.k]) || us[0]; }
function posUnitNext(p) { const us = posUnits(p), cur = posUnit(p), nx = us[(us.findIndex(x => x.id === cur.id) + 1) % us.length]; let m = {}; try { m = JSON.parse(localStorage.getItem('lm4.posunit') || '{}'); } catch (e) {} m[p.k] = nx.id; try { localStorage.setItem('lm4.posunit', JSON.stringify(m)); } catch (e) {} }
const posVal = p => clamp(p.pos == null ? (KINDS[p.k].pos0 != null ? KINDS[p.k].pos0 : 0.5) : p.pos, 0, 1);
const posNum = (u, v) => { const x = u.to(v), dg = u.step >= 1 ? 0 : (u.step >= 0.1 ? 1 : 2); return x.toFixed(dg); };
const posText = (u, v) => posNum(u, v).replace('.', ',') + ' ' + u.u;
function setPos(p, v) { p.pos = v; const w = wrapMap.get(p.id); if (w) { w.pos = v; w.light = v; } }

/* ============ Multimeter (Spannung und Strom messen) ============ */
let meter = { mode: 'V', dial: 'V=', jack: 'V', fuse: false, fuse10: false, a: null, b: null, part: null, dc: 0, ac: 0, init: false };
const MM_DIALS = [['V=', 'V ⎓'], ['V~', 'V ∿'], ['A', 'A'], ['R', 'Ω']], MM_JACKS = [['V', 'VΩ'], ['mA', 'mA'], ['10A', '10 A']];
function meterDial(dl) { meter.dial = dl; meter.mode = dl === 'A' ? 'A' : 'V'; meterReset(); }
function meterValue() {
  if (!circ || !sim) return NaN;
  if (meter.mode === 'A') {
    if (meter.part == null) return NaN;
    const es = circ.elems.filter(e => e.part && e.part.id === meter.part); if (!es.length) return NaN;
    const e = es.find(x => x.type !== 'S' || x.closed) || es[0];
    return e.type === 'Q' ? e.ic : (e.type === 'V' ? -e.i : (e.i || 0));
  }
  if (!meter.a) return NaN;
  const va = sv(meter.a.key), vb = meter.b ? sv(meter.b.key) : 0; return va - vb;
}
function meterSample(dt) {
  const m = meterValue(); if (!isFinite(m)) return;
  if (!meter.init) { meter.dc = m; meter.ac = 0; meter.init = true; return; }
  const al = 1 - Math.exp(-dt / 0.05);
  meter.dc += al * (m - meter.dc); meter.ac += al * ((m - meter.dc) * (m - meter.dc) - meter.ac);
}
function meterReset() { meter.init = false; meter.dc = 0; meter.ac = 0; }
function meterTap(fx, fy) {
  if (!circ) return;
  if (meter.mode === 'A') { const p = partAt(fx, fy); if (p && p.k !== 'GND') { meter.part = p.id; meterReset(); } else toast('Bauteil antippen, durch das der Strom gemessen wird'); draw(); refreshUI(); return; }
  // nächster Anschlusspunkt (Bauteilpin oder Drahtende)
  let best = null, bd = 1.1;
  const cand = []; sch.parts.forEach(p => pinsOf(p).forEach(q => cand.push(q))); sch.wires.forEach(w => { cand.push([w.x1, w.y1]); cand.push([w.x2, w.y2]); });
  cand.forEach(q => { const dd = Math.hypot(q[0] - fx, q[1] - fy); if (dd < bd && circ.nodeOfKey(gk(q[0], q[1])) >= 0) { bd = dd; best = q; } });
  if (!best) { const w = wireAt(fx, fy); if (w) best = [w.x1, w.y1]; }
  if (!best) { toast('Einen Anschlusspunkt oder Draht antippen'); return; }
  const pt = { key: gk(best[0], best[1]), x: best[0], y: best[1] };
  if (!meter.a || (meter.a && meter.b)) { meter.a = pt; meter.b = null; } else meter.b = pt;
  meterReset(); draw(); refreshUI();
}
let rCache = { k: '', t: 0, v: NaN }; const mmSeen = {};
function mmStat(k) { if (mmSeen[k]) return; mmSeen[k] = 1; if (window.Badges) window.Badges.stat(k, 1, 'max'); }
function mmBlow(which, msg) {
  if (which === 'mA') meter.fuse = true; else meter.fuse10 = true;
  toast(msg); if (window.Badges) window.Badges.stat('mmerr', 1);
}
function meterText() {
  const d = meter.dial, jack = meter.jack, ok = (main, sub) => ({ main, sub });
  const have = d === 'A' ? meter.part != null : (d === 'R' ? !!(meter.a && meter.b) : !!meter.a);
  if (!have || !circ || !sim) return ok('--', d === 'A' ? 'Bauteil antippen, durch das der Strom fließt.' : d === 'R' ? 'Rote und schwarze Messspitze an die zwei Punkte setzen, zwischen denen du den Widerstand messen willst.' : 'Erst die rote, dann die schwarze Messspitze setzen (ohne schwarze: gegen Masse).');
  const dv = meter.a ? Math.abs(sv(meter.a.key) - (meter.b ? sv(meter.b.key) : 0)) : 0;
  if (d === 'A') {
    if (jack === 'V') return ok('0,000 A', 'Falsche Buchse: Strom misst du in der mA- oder der 10-A-Buchse, nicht in VΩ.');
    if (jack === 'mA' ? meter.fuse : meter.fuse10) return ok('OL', 'Die Messgerätesicherung ist durchgebrannt. Unten „Sicherung tauschen“.');
    const I = meterValue(); if (!isFinite(I)) return ok('--', 'Bauteil antippen, durch das der Strom fließt.');
    if (Math.abs(I) > (jack === 'mA' ? 0.5 : 10)) { mmBlow(jack, jack === 'mA' ? 'Zu viel Strom: Die Sicherung der mA-Buchse (0,5 A) ist durchgebrannt. Für große Ströme die 10-A-Buchse nehmen.' : 'Mehr als 10 A: Die Sicherung der 10-A-Buchse ist durchgebrannt.'); return ok('F ✗', 'Messgerätesicherung durchgebrannt.'); }
    if (Math.abs(I) > 1e-9) mmStat('mmA');
    return ok(fmt(meter.dc, 'A'), 'Strom durch das Bauteil (von Pin 1 nach Pin 2). Das Messgerät liegt dabei in Reihe.');
  }
  if (d === 'V=' || d === 'V~') {
    if (jack !== 'V') {
      if (jack === 'mA' ? meter.fuse : meter.fuse10) return ok('OL', 'Die Messgerätesicherung ist schon durchgebrannt. Unten „Sicherung tauschen“.');
      if (dv > 3) { mmBlow(jack, 'Kurzschluss! Du hast Spannung mit der Strombuchse gemessen: Die Messgerätesicherung ist durchgebrannt. Spannung gehört in die VΩ-Buchse.'); return ok('F ✗', 'Messgerätesicherung durchgebrannt.'); }
      return ok('0,000 V', 'Falsche Buchse: Spannung misst du in der VΩ-Buchse. In der Strombuchse wäre das ein Kurzschluss.');
    }
    const acr = Math.sqrt(Math.max(meter.ac, 0)), hasAc = acr > 0.02 * Math.max(Math.abs(meter.dc), 1e-9) && acr > 1e-6;
    if (d === 'V=') { if (!hasAc && Math.abs(meter.dc) > 1e-6) mmStat('mmV'); return ok(fmt(meter.dc, 'V'), hasAc ? 'Hier liegt Wechselspannung an. Ein Gleichspannungsmessbereich zeigt nur den Gleichanteil. Für Wechselspannung auf V∿ stellen.' : (meter.b ? 'Gleichspannung rot gegen schwarz' : 'Gleichspannung gegen Masse')); }
    if (hasAc) { mmStat('mmAC'); return ok('~ ' + fmt(acr, 'V'), 'Wechselspannung, Effektivwert · Gleichanteil ' + fmt(meter.dc, 'V')); }
    return ok('0,000 V', Math.abs(meter.dc) > 1e-6 ? 'Das ist Gleichspannung (' + fmt(meter.dc, 'V') + '). Im Bereich V∿ siehst du nur Wechselspannung. Für Gleichspannung auf V⎓ stellen.' : 'Keine Wechselspannung zwischen den Punkten.');
  }
  // Widerstand: nur spannungsfrei
  if (jack !== 'V') return ok('0,000 Ω', 'Falsche Buchse: Widerstand misst du in der VΩ-Buchse.');
  if (running && vmax > 0.5) return ok('Err', 'Die Schaltung steht unter Spannung. Widerstand misst du nur spannungsfrei: erst die Simulation anhalten (Pause), das entspricht dem Freischalten.');
  const k = meter.a.key + '|' + meter.b.key + '|' + sch.parts.map(p => p.id + p.v + (p.sw || 0)).join(';') + sch.wires.length, now = performance.now();
  if (rCache.k !== k || now - rCache.t > 600) { let v = NaN; try { v = staticR([meter.a.x, meter.a.y], [meter.b.x, meter.b.y], 1, 'ohm'); } catch (e) {} rCache = { k, t: now, v }; }
  const R = rCache.v;
  if (!isFinite(R) || R > 1e9) return ok('OL', 'Kein Durchgang: Zwischen den Punkten gibt es keine Verbindung (offen).');
  mmStat('mmR');
  return ok(fmtOhm(R), R < 1 ? 'Durchgang: fast kein Widerstand' : 'Widerstand zwischen rot und schwarz (spannungsfrei gemessen)');
}
function drawMeterMarks() {
  if (!simMode || tool !== 'meter') return;
  const ring = (pt, col, lbl) => { if (!pt) return; cx.strokeStyle = col; cx.lineWidth = 3; cx.beginPath(); cx.arc(X(pt.x), Y(pt.y), Math.max(8, view.s * 0.45), 0, 7); cx.stroke(); cx.fillStyle = col; cx.font = '700 12px sans-serif'; cx.textAlign = 'left'; cx.textBaseline = 'middle'; cx.fillText(lbl, X(pt.x) + 12, Y(pt.y) - 12); };
  ring(meter.a, '#ff4d4d', meter.b ? '+' : 'rot'); ring(meter.b, '#ffffff', '−');
  if (meter.mode === 'A' && meter.part != null) { const p = byPart(meter.part); if (p) { const K = KD(p), cs = [[K.box[0], K.box[1]], [K.box[2], K.box[3]]].map(([a, b]) => { const [ra, rb] = rot(a, b, p.r); return [X(p.x + ra), Y(p.y + rb)]; }); cx.strokeStyle = '#7dff7d'; cx.lineWidth = 2; cx.setLineDash([6, 4]); cx.strokeRect(Math.min(cs[0][0], cs[1][0]) - 4, Math.min(cs[0][1], cs[1][1]) - 4, Math.abs(cs[1][0] - cs[0][0]) + 8, Math.abs(cs[1][1] - cs[0][1]) + 8); cx.setLineDash([]); } }
}
function meterCardHtml() {
  if (!simMode || tool !== 'meter') return '';
  const t = meterText(), bt = (a, dat, on, txt) => `<button class="btn ${on ? 'pri' : ''}" data-a="${a}" data-v="${dat}" style="flex:1;min-width:0">${txt}</button>`;
  const blown = meter.jack === 'mA' ? meter.fuse : meter.jack === '10A' ? meter.fuse10 : (meter.fuse || meter.fuse10);
  return `<div class="card"><h4>Multimeter</h4>
    <div class="hint2" style="margin:0 0 4px">Drehschalter</div><div style="display:flex;gap:6px">${MM_DIALS.map(x => bt('mmD', x[0], meter.dial === x[0], x[1])).join('')}</div>
    <div class="hint2" style="margin:8px 0 4px">Buchse für die rote Leitung</div><div style="display:flex;gap:6px">${MM_JACKS.map(x => bt('mmJ', x[0], meter.jack === x[0], x[1])).join('')}</div>
    <div class="lcd" id="mmVal" style="margin-top:10px">${esc(t.main)}</div><div class="mmsub" id="mmSub">${esc(t.sub)}</div>
    <div class="kv"><span>Messgerätesicherung</span><b id="mmFuseSt">${meter.fuse || meter.fuse10 ? 'defekt' : 'in Ordnung'}</b></div>
    <button class="btn" id="mmFuseBtn" data-a="mmFuse" style="margin-top:6px"${meter.fuse || meter.fuse10 ? '' : ' disabled'}>Sicherung tauschen</button></div>`;
}


/* ============ Schaltschrank-Ansicht (SimLab) ============ */
function openCabinet() {
  sheet('Schaltschrank', (b) => {
    b.innerHTML = '<p class="hint2" style="margin-top:0">Wie im echten Verteiler: Hebel antippen zum Ein- und Ausschalten. Beim FI löst die Prüftaste „T“ aus. Der Balken zeigt die Belastung des Automaten.</p><canvas id="cabCv" width="640" height="440" style="width:100%;border-radius:10px;background:#1a1f26;touch-action:none;display:block"></canvas>';
    const cvs = b.querySelector('#cabCv'), g = cvs.getContext('2d'); let hits = [];
    const mods = () => sch.parts.filter(p => p.k === 'RCD').sort(byPos).concat(sch.parts.filter(p => p.k === 'LSS').sort(byPos));
    const curOf = p => { const e = circ && circ.elems.find(x => x.part && x.part.id === p.id && (x.type === 'S' || x.type === 'RCD')); return e ? Math.abs(e.i || 0) : 0; };
    const rated = p => (p.k === 'LSS' ? (parseFloat(String(p.v || 'B16').replace(/^[A-Za-z]+/, '')) || 16) : 40);
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    function frame() {
      if (!document.body.contains(cvs)) return;
      g.clearRect(0, 0, 640, 440);
      const list = mods(); hits = [];
      g.fillStyle = '#2a313a'; rr(10, 10, 620, 420, 10); g.fill(); g.strokeStyle = '#46505c'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#9aa3ad'; g.font = '600 13px sans-serif'; g.textAlign = 'left'; g.fillText('Verteilerkasten · Hutschiene', 24, 30);
      if (!list.length) { g.fillStyle = '#c0c6cd'; g.font = '15px sans-serif'; g.textAlign = 'center'; g.fillText('Noch keine Sicherungsautomaten oder FI in der Schaltung.', 320, 220); requestAnimationFrame(frame); return; }
      let x = 28, y = 48; const rowH = 205;
      list.forEach(p => {
        const fi = p.k === 'RCD', w = fi ? 78 : 52;
        if (x + w > 620) { x = 28; y += rowH; }
        // Hutschiene
        g.fillStyle = '#6f7882'; g.fillRect(x - 6, y + 46, w + 12, 8);
        // Gehaeuse
        g.fillStyle = '#e4e7ea'; rr(x, y, w, 122, 6); g.fill(); g.strokeStyle = '#8b939c'; g.lineWidth = 1.5; g.stroke();
        g.fillStyle = '#b9bfc6'; g.fillRect(x + 4, y + 4, w - 8, 16);
        g.fillStyle = '#333'; g.font = '700 11px sans-serif'; g.textAlign = 'center'; g.fillText(p.l || (fi ? 'FI' : 'LS'), x + w / 2, y + 16);
        // Hebel
        const on = !!p.sw, lx = x + w / 2 - (fi ? 20 : 11), lw = 22, ly = on ? y + 30 : y + 62;
        g.fillStyle = '#16191d'; rr(lx - 3, y + 26, lw + 6, 66, 4); g.fill();
        g.fillStyle = on ? '#3aa655' : '#c04a3a'; rr(lx, ly, lw, 28, 3); g.fill();
        g.fillStyle = '#fff'; g.font = '700 12px sans-serif'; g.fillText(on ? 'I' : '0', lx + lw / 2, ly + 19);
        hits.push({ x: lx - 6, y: y + 24, w: lw + 12, h: 72, p, kind: 'lever' });
        if (fi) { g.fillStyle = '#2d6cdf'; rr(x + w - 28, y + 38, 20, 20, 3); g.fill(); g.fillStyle = '#fff'; g.font = '700 12px sans-serif'; g.fillText('T', x + w - 18, y + 53); hits.push({ x: x + w - 32, y: y + 34, w: 28, h: 28, p, kind: 'test' }); }
        // Beschriftung
        g.fillStyle = '#333'; g.font = '700 12px sans-serif'; g.fillText(fi ? 'FI ' + (p.v || '30mA') : (p.v || 'B16'), x + w / 2, y + 112);
        // Belastung
        const i = curOf(p), ir = rated(p), q = Math.min(i / ir, 1.3);
        g.fillStyle = '#12161b'; g.fillRect(x, y + 132, w, 10);
        g.fillStyle = q < 0.7 ? '#3aa655' : (q < 1 ? '#e6a820' : '#d94a3a'); g.fillRect(x, y + 132, Math.min(w, w * q), 10);
        g.fillStyle = '#c0c6cd'; g.font = '12px sans-serif'; g.fillText(i < 0.005 ? '0 A' : i.toFixed(1) + ' A', x + w / 2, y + 160);
        if (!on) { g.fillStyle = '#ff8a7a'; g.font = '700 11px sans-serif'; g.fillText('AUS', x + w / 2, y + 178); }
        x += w + 10;
      });
      // N- und PE-Klemmen
      const ry = Math.min(y + 190, 395);
      g.fillStyle = '#3b82e0'; rr(28, ry, 270, 22, 4); g.fill(); g.fillStyle = '#34b24f'; rr(330, ry, 270, 22, 4); g.fill(); g.fillStyle = '#f2d21b'; for (let k = 0; k < 14; k++) g.fillRect(332 + k * 19, ry + 15, 9, 5);
      g.fillStyle = '#fff'; g.font = '700 12px sans-serif'; g.textAlign = 'left'; g.fillText('N-Klemmen', 36, ry + 15); g.fillText('PE-Klemmen', 340, ry + 12);
      requestAnimationFrame(frame);
    }
    cvs.addEventListener('pointerdown', e => {
      const r = cvs.getBoundingClientRect(), px = (e.clientX - r.left) * 640 / r.width, py = (e.clientY - r.top) * 440 / r.height;
      const h = hits.find(q => px >= q.x && px <= q.x + q.w && py >= q.y && py <= q.y + q.h); if (!h) return;
      const p = h.p, w = wrapMap.get(p.id);
      if (h.kind === 'lever') p.sw = p.sw ? 0 : 1; else { if (!p.sw) { toast('Der FI ist schon aus'); return; } p.sw = 0; toast('Prüftaste: der FI löst aus'); }
      if (w) w.sw = p.sw; commit(true, true); draw(); refreshControls();
      if (window.LochFX) LochFX.sound('click');
    });
    frame();
  });
}

/* ============ Aufgaben, Prüfung und Fehlersuche (SimLab) ============ */
let taskRes = null;     // letzte Prüfung {id, lines:[{ok,text}], pct}
const byPos = (a, b) => a.y - b.y || a.x - b.x;
const SWK = ['SPST', 'SPDT', 'KREUZ'];
const swList = () => sch.parts.filter(p => SWK.includes(p.k)).sort(byPos);
const lampList = () => sch.parts.filter(p => p.k === 'LAMP' || p.k === 'HEAT').sort(byPos);
const nm = p => p.l || KINDS[p.k].name;
const RES = (ok, text, why) => (why ? { ok, text, why } : { ok, text });
/* Schaltung ohne Rückwirkung auf die Zeichnung durchrechnen (Schalterstellungen und Taster vorgebbar) */
function simEval(o) {
  o = o || {};
  const parts = [], ground = [];
  sch.parts.forEach(p => {
    if (p.k === 'GND') { ground.push(pinsOf(p)[0]); return; }
    const w = toCore(p); w.item = Object.assign({}, p);
    if (o.set && o.set[p.id] != null) { w.sw = o.set[p.id] ? 1 : 0; w.item.sw = w.sw; }
    w.pressed = !!(o.press && o.press.includes(p.id));
    parts.push(w);
  });
  const c = LS.buildCircuit({ parts, tracks: [], wires: sch.wires, ground }), s = LS.createSim(c), wm = new Map(parts.map(w => [w.id, w])), ev = [], dt = 2e-4;
  const run = (t, press) => { if (press) wm.forEach((w, id) => { w.pressed = press.includes(id); }); const n = Math.round(t / dt); for (let i = 0; i < n; i++) { s.step(dt); while (s.events.length) ev.push(s.events.shift()); } };
  const lamps = () => { const m = new Map(); c.elems.forEach(e => { if (e.lamp && e.part) m.set(e.part.id, (e.pav || 0) / e.lamp > 0.25); }); return m; };
  return { c, s, run, lamps, ev, wm };
}
const combos = n => Array.from({ length: 1 << n }, (_, m) => Array.from({ length: n }, (_, i) => (m >> i) & 1));
function evalCombo(sws, vals, extra) { const set = Object.assign({}, extra || {}); sws.forEach((p, i) => { set[p.id] = vals[i]; }); const E = simEval({ set }); E.run(0.12); return E; }
const valTxt = (sws, vals) => sws.map((p, i) => nm(p) + (vals[i] ? ' an' : ' aus')).join(', ');
const evTxt = E => E.ev.filter(e => e.kind === 'burn' || e.kind === 'trip').map(e => e.text);

/* Bausteine für Prüfungen */
function needKinds(list) {   // [[Text, [Arten], Mindestanzahl]]
  return list.map(([text, kinds, n]) => { const have = sch.parts.filter(p => kinds.includes(p.k)).length; return RES(have >= n, have >= n ? text + ' vorhanden' : text + ' fehlt (' + have + ' von ' + n + ')'); });
}
function chkLogic(mode, sws, lamp) {
  const out = []; let bad = 0;
  combos(sws.length).forEach(vals => {
    const E = evalCombo(sws, vals), st = E.lamps().get(lamp.id), want = mode === 'and' ? vals.every(Boolean) : (mode === 'or' ? vals.some(Boolean) : !!vals[0]);
    const evs = evTxt(E);
    if (evs.length) { bad++; if (bad <= 3) out.push(RES(false, valTxt(sws, vals) + ': ' + evs[0])); }
    else if (!!st !== want) { bad++; if (bad <= 3) out.push(RES(false, valTxt(sws, vals) + ': Lampe soll ' + (want ? 'leuchten' : 'aus sein') + ', ist aber ' + (st ? 'an' : 'aus') + '.')); }
  });
  return out.length ? out : [RES(true, 'Die Lampe schaltet in allen ' + (1 << sws.length) + ' Schalterstellungen richtig.')];
}
function chkToggle(sws, lamp) {
  const res = new Map(), out = [];
  combos(sws.length).forEach(vals => { const E = evalCombo(sws, vals), evs = evTxt(E); res.set(vals.join(''), E.lamps().get(lamp.id)); if (evs.length && out.length < 3) out.push(RES(false, valTxt(sws, vals) + ': ' + evs[0])); });
  let bad = 0;
  res.forEach((st, key) => { sws.forEach((p, i) => { const k2 = key.slice(0, i) + (key[i] === '1' ? '0' : '1') + key.slice(i + 1); if (key < k2 && res.get(k2) === st) { bad++; if (bad <= 3) out.push(RES(false, 'Wird nur ' + nm(p) + ' umgelegt (Stellung ' + key.split('').map((x, j) => nm(sws[j]) + '=' + (x === '1' ? 'an' : 'aus')).join(', ') + '), ändert sich die Lampe nicht.')); } }); });
  return out.length ? out : [RES(true, 'Jedes Umlegen eines einzelnen Schalters ändert den Zustand der Lampe.')];
}
function chkProtect(lamp) {
  const lss = sch.parts.filter(p => p.k === 'LSS'); if (!lss.length) return [RES(false, 'Kein Sicherungsautomat im Stromkreis.')];
  const sws = swList(), on = {}; sws.forEach(p => { on[p.id] = 1; });
  let ok = true;
  // mit ausgeschaltetem Automaten darf die Lampe in keiner Schalterstellung leuchten
  const set = Object.assign({}, on); lss.forEach(p => { set[p.id] = 0; });
  const E = simEval({ set }); E.run(0.1); if (E.lamps().get(lamp.id)) ok = false;
  return [RES(ok, ok ? 'Der Sicherungsautomat liegt im Stromkreis der Lampe.' : 'Die Lampe leuchtet auch bei ausgeschaltetem Sicherungsautomaten: er liegt nicht im Stromkreis.')];
}
function chkSequence(steps, lamp, pressMap) {
  // steps: [{press:[Teile], erwartet:true/false, text}]
  const E = simEval({}); const out = [], dev = lamp.k === 'HEAT' ? 'Heizlüfter' : 'Lampe';   // das Gerät beim richtigen Namen nennen
  steps.forEach(st => { E.run(st.t || 0.25, st.press.map(p => p.id)); const on = !!E.lamps().get(lamp.id); out.push(RES(on === st.expect, st.text + ': ' + dev + ' ist ' + (on ? 'an' : 'aus') + (on === st.expect ? '' : ', soll ' + (st.expect ? 'an' : 'aus') + ' sein') + '.')); const evs = evTxt(E); if (evs.length) { out.push(RES(false, evs[evs.length - 1])); E.ev.length = 0; } });
  return out;
}
const firstLamp = () => lampList()[0];
const noLamp = () => [RES(false, 'Es ist keine Lampe oder kein Heizlüfter vorhanden.')];

/* Aufgabenliste */
const NETZ_LSS_LAMP = () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['LAMP', -3, 12, 1, '230V 60W']], wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 18, -3, 18, -3, 16]], scopes: [], tempo: 0.55, win: 0.04 });
const NETZ_LAMP = () => ({ parts: [['NETZ', 1, 0], ['LAMP', -3, 12, 1, '230V 60W']], wires: [['blau', 3, 0, 3, 18, -3, 18, -3, 16]], scopes: [], tempo: 0.55, win: 0.04 });

/* ---- Aufbau-Aufgaben: Verdrahtung mit der Musterlösung vergleichen (Netze, gleiche Bauteil-Nummern) ---- */
function netsOfDoc(d) {
  const parts = d.parts.filter(p => p.k !== 'GND' && !INSTR[p.k]).map(p => toCore(p)), ground = d.parts.filter(p => p.k === 'GND').map(p => pinsOf(p)[0]);
  const c = LS.buildCircuit({ parts, tracks: [], wires: d.wires, ground }), m = new Map();
  d.parts.forEach(p => pinsOf(p).forEach(([x, y], i) => { const nd = c.nodeOfKey(gk(x, y)); if (nd < 0) return; if (!m.has(nd)) m.set(nd, []); m.get(nd).push(p.id + '.' + i); }));
  return { c, list: [...m.values()].filter(a => a.length > 1) };
}
function schNetCheck(makeFn, opt) {   // opt.sep = Anschlüsse, die zusammen getrennt von der übrigen Masse liegen dürfen; opt.optional = Teile-Nummern, die fehlen dürfen
  const sol = buildExample({ name: 'Lösung', make: makeFn }), S = netsOfDoc(sol), M = netsOfDoc({ parts: sch.parts, wires: sch.wires });
  const nm = key => { const [id, pin] = key.split('.'), p = sol.parts.find(q => q.id === +id); return p ? (p.l || KINDS[p.k].name) + ' Pin ' + (+pin + 1) : key; }, lt = ks => ks.slice(0, 3).map(nm).join(', ') + (ks.length > 3 ? ' …' : '');
  const where = new Map(); M.list.forEach((ks, ni) => ks.forEach(k => where.set(k, ni)));
  const out = [], hit = new Map();
  S.list.forEach((ks, si) => {
    const groups = new Map(); ks.forEach(k => { if (opt && opt.optional && opt.optional.includes(+k.split('.')[0]) && !sch.parts.some(q => q.id === +k.split('.')[0])) return; const g = where.has(k) ? where.get(k) : 'x' + k; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(k); });
    const sepG = groups.size === 2 && ((opt && opt.sep) || []).map(sp => [...groups.values()].find(g => g.length === sp.length && sp.every(k => g.includes(k)))).find(Boolean);
    if (groups.size <= 1) out.push(RES(true, 'Verbunden: ' + lt(ks))); else if (sepG) out.push(RES(true, 'Getrennter Stromkreis: ' + lt(sepG) + ' liegen zusammen und haben keine Verbindung zur übrigen Masse. Das ist ebenfalls richtig.')); else { const gs = [...groups.values()]; out.push(RES(false, 'Es fehlt eine Verbindung: ' + lt(gs[0]) + ' ist nicht mit ' + lt(gs[1]) + ' verbunden.')); }
    groups.forEach((_, g) => { if (typeof g === 'number') { if (!hit.has(g)) hit.set(g, new Set()); hit.get(g).add(si); } });
  });
  hit.forEach(sis => { if (sis.size > 1) { const a = [...sis]; out.push(RES(false, 'Kurzschluss: ' + lt(S.list[a[0]]) + ' ist mit ' + lt(S.list[a[1]]) + ' verbunden. Das gehört nicht zusammen.')); } });
  const miss = sol.parts.filter(p => !sch.parts.some(q => q.id === p.id) && !((opt && opt.optional) || []).includes(p.id)).map(p => p.l || KINDS[p.k].name); if (miss.length) out.unshift(RES(false, 'Bauteil fehlt: ' + miss.join(', ') + '. Lass die vorgegebenen Bauteile stehen.'));
  return out;
}
const exLike = part => { const e = EXAMPLES.find(x => x.name.includes(part)); return e ? e.make : null; };
const wiresOff = fn => () => Object.assign({}, fn(), { wires: [], scopes: [] });
const totalI = E => { const v = E.c.elems.find(e => e.type === 'V'); return v ? Math.abs(v.i) * 1000 : 0; };

const exOf = name => (EXAMPLES.find(e => e.name === name) || {}).make;
const withDefect = (make, label, defect) => () => { const d = make(); d.parts = d.parts.map(a => (a[5] && a[5].l === label) ? a : a); const idx = d.parts.findIndex(a => a[5] && a[5].l === label); if (idx >= 0) d.parts[idx][5].defect = defect; return d; };
const TASKS = [
  { id: 'aus', cat: 'Grundlagen', title: 'Ausschaltung', level: 1, start: NETZ_LAMP, sol: 'Ausschaltung mit Sicherungsautomat',
    text: 'Baue eine Ausschaltung: Eine Lampe wird mit einem Schalter ein- und ausgeschaltet. Der Stromkreis wird mit einem Sicherungsautomaten B16 abgesichert. Netz und Lampe sind schon platziert, die Aderfarben wählst du beim Draht-Werkzeug.',
    hint: 'Reihenfolge im Außenleiter (braun): Netz L → Sicherungsautomat → Schalter → Lampe. Der Neutralleiter (blau) geht direkt zur Lampe.',
    check() { const L = firstLamp(); if (!L) return noLamp(); const sw = swList().filter(p => p.k === 'SPST'); return needKinds([['Sicherungsautomat', ['LSS'], 1], ['Schalter', ['SPST'], 1]]).concat(sw.length ? chkLogic('single', [sw[0]], L).concat(chkProtect(L)) : []); } },
  { id: 'reihe', cat: 'Grundlagen', title: 'Zwei Schalter in Reihe (UND)', level: 1, start: NETZ_LSS_LAMP, sol: 'Zwei Schalter in Reihe (UND)',
    text: 'Die Lampe soll nur leuchten, wenn beide Schalter geschlossen sind. Baue die Schaltung zwischen Sicherungsautomat und Lampe auf.',
    hint: 'Bei einer Reihenschaltung hängen die Schalter hintereinander im selben Draht.',
    check() { const L = firstLamp(), sw = swList().filter(p => p.k === 'SPST'); if (!L) return noLamp(); if (sw.length < 2) return needKinds([['Schalter', ['SPST'], 2]]); return chkLogic('and', sw.slice(0, 2), L); } },
  { id: 'parallel', cat: 'Grundlagen', title: 'Zwei Schalter parallel (ODER)', level: 1, start: NETZ_LSS_LAMP, sol: 'Zwei Schalter parallel (ODER)',
    text: 'Die Lampe soll leuchten, wenn mindestens einer der beiden Schalter geschlossen ist.',
    hint: 'Bei einer Parallelschaltung liegen die Schalter nebeneinander, jeder verbindet Anfang und Ende des Zweiges.',
    check() { const L = firstLamp(), sw = swList().filter(p => p.k === 'SPST'); if (!L) return noLamp(); if (sw.length < 2) return needKinds([['Schalter', ['SPST'], 2]]); return chkLogic('or', sw.slice(0, 2), L); } },
  { id: 'wechsel', cat: 'Hausinstallation', title: 'Wechselschaltung', level: 2, start: NETZ_LSS_LAMP, sol: 'Wechselschaltung (zwei Orte)',
    text: 'Eine Lampe soll von zwei Orten aus mit je einem Wechselschalter ein- und ausgeschaltet werden. Verdrahte die beiden Wechselschalter mit den zwei Wechseldrähten (schwarz).',
    hint: 'Jeder Wechselschalter hat einen gemeinsamen Anschluss (COM) und zwei Schaltkontakte. Die beiden Kontakte des ersten Schalters werden mit den beiden Kontakten des zweiten verbunden. COM des ersten kommt vom Sicherungsautomaten, COM des zweiten geht zur Lampe.',
    check() { const L = firstLamp(), sw = swList().filter(p => p.k === 'SPDT'); if (!L) return noLamp(); const r = needKinds([['Wechselschalter', ['SPDT'], 2]]); return sw.length < 2 ? r : r.concat(chkToggle(sw.slice(0, 2), L), chkProtect(L)); } },
  { id: 'kreuz', cat: 'Hausinstallation', title: 'Kreuzschaltung (drei Orte)', level: 3, start: NETZ_LSS_LAMP, sol: 'Kreuzschaltung (drei Orte)',
    text: 'Eine Lampe soll von drei Orten aus geschaltet werden: zwei Wechselschalter außen und ein Kreuzschalter in der Mitte.',
    hint: 'Zwischen den beiden Wechselschaltern liegt der Kreuzschalter. Die zwei Adern vom ersten Wechselschalter gehen in die beiden oberen Anschlüsse des Kreuzschalters, die beiden unteren zum zweiten Wechselschalter.',
    check() { const L = firstLamp(), sw = swList(); if (!L) return noLamp(); const r = needKinds([['Wechselschalter', ['SPDT'], 2], ['Kreuzschalter', ['KREUZ'], 1]]); return (sw.length < 3 || !r.every(x => x.ok)) ? r : r.concat(chkToggle(sw.slice(0, 3), L), chkProtect(L)); } },
  { id: 'impuls', cat: 'Hausinstallation', title: 'Treppenhaus mit Stromstoßschalter', level: 3, sol: 'Stromstoßschalter (Treppenhaus)',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B10'], ['IMP', -6, 12, 0, '230V'], ['LAMP', -2, 20, 1, '230V 60W']], wires: [['blau', 3, 0, 3, 24, 3, 26], ['blau', -2, 24, 3, 24], ['blau', -6, 16, -6, 26, 3, 26], ['braun', 1, 0, 1, 2]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Das Licht im Treppenhaus soll von zwei Tastern aus umgeschaltet werden: jeder Druck schaltet das Licht um (Stromstoßschalter). Ergänze die zwei Taster und die fehlenden Leitungen.',
    hint: 'Die Taster liegen parallel in der Steuerleitung zur Spule (A1) des Stromstoßschalters. Der Lastkontakt (K1/K2) schaltet die Lampe.',
    check() { const L = firstLamp(), pb = sch.parts.filter(p => p.k === 'PB').sort(byPos); if (!L) return noLamp(); const r = needKinds([['Stromstoßschalter', ['IMP'], 1], ['Taster', ['PB'], 2]]); if (pb.length < 2 || !r.every(x => x.ok)) return r;
      return r.concat(chkSequence([{ press: [], expect: false, t: 0.15, text: 'Ohne Betätigung' }, { press: [pb[0]], expect: true, text: 'Taster 1 gedrückt' }, { press: [], expect: true, text: 'Taster 1 losgelassen' }, { press: [pb[1]], expect: false, text: 'Taster 2 gedrückt' }, { press: [], expect: false, text: 'Taster 2 losgelassen' }], L)); } },
  { id: 'schutz', cat: 'Hausinstallation', title: 'Kurzschluss und Sicherungsautomat', level: 2, sol: 'Kurzschluss löst den Sicherungsautomaten aus',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['LAMP', -3, 6, 1, '230V 60W'], ['FAULT', -7, 6, 1, '0.05']], wires: [['blau', 3, 0, 3, 12, -3, 12, -7, 12], ['blau', -3, 10, -3, 12], ['blau', -7, 10, -7, 12]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Lampe und Fehlerstelle (Kurzschluss) sind platziert. Verdrahte den Außenleiter über den Sicherungsautomaten so, dass er bei einem Kurzschluss auslöst, die Lampe aber normal leuchtet.',
    hint: 'Beide Teile hängen parallel am Außenleiter hinter dem Sicherungsautomaten und zwischen Außen- und Neutralleiter.',
    check() { const L = firstLamp(), F = sch.parts.find(p => p.k === 'FAULT'), S = sch.parts.find(p => p.k === 'LSS'); if (!L || !F || !S) return needKinds([['Lampe', ['LAMP', 'HEAT'], 1], ['Fehlerstelle', ['FAULT'], 1], ['Sicherungsautomat', ['LSS'], 1]]);
      const E0 = simEval({ set: { [F.id]: 0 } }); E0.run(0.12); const E1 = simEval({ set: { [F.id]: 1 } }); E1.run(0.12); const trip = E1.ev.some(e => e.kind === 'trip');
      return [RES(!!E0.lamps().get(L.id) && !evTxt(E0).length, 'Ohne Fehler leuchtet die Lampe und nichts löst aus.'), RES(trip, trip ? 'Beim Kurzschluss löst der Sicherungsautomat aus.' : 'Beim Kurzschluss löst nichts aus: der Sicherungsautomat liegt nicht im Stromkreis.')]; } },
  { id: 'fi', cat: 'Hausinstallation', title: 'Steckdose mit FI-Schutzschalter', level: 3, sol: 'FI-Schutzschalter an der Steckdose',
    start: () => ({ parts: [['NETZ', 1, 0], ['SD', -3, 10, 0, '2000W']], wires: [], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Schließe die Steckdose (mit 2-kW-Gerät) über FI-Schutzschalter und Sicherungsautomat an das Netz an. Schutzleiter (PE, grün-gelb) nicht vergessen! Ist das Gerät defekt (Steckdose antippen), muss der FI auslösen.',
    hint: 'Der FI wird mit Außen- und Neutralleiter durchgeschleift (L und N durch den FI), der Schutzleiter geht am FI vorbei direkt zur Steckdose.',
    check() { const SD = sch.parts.find(p => p.k === 'SD'), FI = sch.parts.find(p => p.k === 'RCD'); const r = needKinds([['FI-Schutzschalter', ['RCD'], 1], ['Sicherungsautomat', ['LSS'], 1], ['Steckdose', ['SD'], 1]]); if (!SD || !FI || !r.every(x => x.ok)) return r;
      const E0 = simEval({ set: { [SD.id]: 0 } }); E0.run(0.15); const dev = E0.c.elems.find(e => e.device); let mx = 0; for (let k = 0; k < 120; k++) { E0.s.step(2e-4); if (dev) mx = Math.max(mx, Math.abs(dev.i)); } const run = mx > 5; const E1 = simEval({ set: { [SD.id]: 1 } }); E1.run(0.15); const trip = E1.ev.some(e => e.kind === 'trip' && /FI/.test(e.text));
      return r.concat([RES(run && !E0.ev.some(e => e.kind === 'trip'), run ? 'Das Gerät läuft und der FI bleibt ruhig.' : 'Das Gerät an der Steckdose bekommt keinen Strom.'), RES(trip, trip ? 'Bei defektem Gerät löst der FI aus.' : 'Bei defektem Gerät löst der FI nicht aus (Schutzleiter prüfen).')]); } },
  { id: 'schuetz', cat: 'Hausinstallation', title: 'Schütz-Steuerung', level: 3, sol: 'Schütz schaltet einen Heizlüfter',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PB', -1, 6, 1, ''], ['SCHUETZ', -12, 10, 0, '230V'], ['HEAT', -9, 18, 1, '230V 2000W']], wires: [['blau', 3, 0, 3, 22, -9, 22], ['braun', 1, 0, 1, 2]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Ein Taster schaltet über die Spule des Schützes einen Heizlüfter: Taster gedrückt = Heizlüfter an. Verdrahte Steuerstromkreis (Taster, Spule A1/A2) und Laststromkreis (Hauptkontakt 1/2, Heizlüfter).',
    hint: 'Steuerkreis: L → Taster → Spule A1, Spule A2 → N. Laststromkreis: L → Kontakt 2 → Kontakt 1 → Heizlüfter → N.',
    check() { const L = firstLamp(), pb = sch.parts.find(p => p.k === 'PB'); if (!L) return noLamp(); if (!pb) return needKinds([['Taster', ['PB'], 1]]);
      return chkSequence([{ press: [], expect: false, t: 0.2, text: 'Taster nicht gedrückt' }, { press: [pb], expect: true, text: 'Taster gedrückt' }, { press: [], expect: false, text: 'Taster losgelassen' }], L); } },
  { id: 'selbst', cat: 'Hausinstallation', title: 'Selbsthaltung (Start und Stopp)', level: 4, sol: 'Selbsthaltung (Start und Stopp)',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PB', -1, 6, 1, '', { l: 'S1' }], ['PBC', -5, 6, 1, '', { l: 'S2' }], ['SCHUETZ', -14, 10, 0, '230V'], ['LAMP', -10, 20, 1, '230V 60W']], wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 28]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Ein Start-Taster (S1) schaltet das Schütz ein, es hält sich über seinen eigenen Hilfskontakt (13/14) selbst. Der Stopp-Taster (S2, Öffner) schaltet aus. Verdrahte Steuer- und Laststromkreis (Lampe).',
    hint: 'Den Hilfskontakt 13/14 parallel zum Start-Taster legen. Den Stopp-Taster (Öffner) vor beide in Reihe schalten.',
    check() { const L = firstLamp(), st = sch.parts.find(p => p.k === 'PB'), sp = sch.parts.find(p => p.k === 'PBC'); if (!L) return noLamp(); if (!st || !sp) return needKinds([['Start-Taster', ['PB'], 1], ['Stopp-Taster (Öffner)', ['PBC'], 1]]);
      return chkSequence([{ press: [], expect: false, t: 0.2, text: 'Ruhezustand' }, { press: [st], expect: true, text: 'Start gedrückt' }, { press: [], expect: true, text: 'Start losgelassen (Selbsthaltung)' }, { press: [sp], expect: false, text: 'Stopp gedrückt' }, { press: [], expect: false, text: 'Stopp losgelassen' }], L); } },
  // ---- Fehlersuche ----
  { id: 'f1', cat: 'Fehlersuche', title: 'Wechselschaltung: Lampe bleibt dunkel', level: 2, debug: true, faultLabel: 'S2', sol: 'Wechselschaltung (zwei Orte)',
    start: () => { const d = exOf('Wechselschaltung (zwei Orte)')(); d.parts[2][5] = { l: 'S1' }; d.parts[3][5] = { l: 'S2', defect: 'open' }; return d; },
    text: 'Die Lampe leuchtet in keiner Schalterstellung. Die Verdrahtung wurde schon kontrolliert und ist in Ordnung. Finde das defekte Bauteil mit Spannungs- und Strommessung. Wähle das Bauteil aus und tippe auf „Fehler melden“.',
    hint: 'Miss die Spannung hinter jedem Schalter in der Simulation (Messen). Wo die Spannung verschwindet, liegt der Fehler davor.' },
  { id: 'f2', cat: 'Fehlersuche', title: 'Heizlüfter: der Automat fliegt sofort', level: 2, debug: true, faultLabel: 'E2', sol: 'Überlast: drei Heizlüfter',
    start: () => { const d = exOf('Überlast: drei Heizlüfter')(); d.parts.forEach(a => { if (a[0] === 'SPST') { a[5] = { sw: 0 }; } }); d.parts[5][5] = { l: 'E1' }; d.parts[6][5] = { l: 'E2', defect: 'short' }; d.parts[7][5] = { l: 'E3' }; return d; },
    text: 'Sobald ein bestimmter Heizlüfter eingeschaltet wird, löst der Sicherungsautomat sofort aus. Einer der drei Heizlüfter hat einen Kurzschluss. Schalte sie einzeln zu und finde den defekten.',
    hint: 'Schalte die Heizlüfter nacheinander einzeln ein. Der Automat muss dazwischen wieder eingeschaltet werden (Bedienfeld links).' },
  { id: 'f3', cat: 'Fehlersuche', title: 'Schütz zieht nicht an', level: 3, debug: true, faultLabel: 'S1', sol: 'Schütz schaltet einen Heizlüfter',
    start: () => { const d = exOf('Schütz schaltet einen Heizlüfter')(); d.parts[2][5] = { l: 'S1', defect: 'open' }; d.parts[4][5] = { l: 'E1' }; return d; },
    text: 'Der Taster wird gedrückt, aber der Heizlüfter bleibt kalt. Das Schütz zieht nicht an. Finde das defekte Bauteil im Steuerkreis.',
    hint: 'Miss die Spannung an der Schützspule (A1/A2). Liegt sie nicht an, ist der Fehler davor im Steuerkreis.' },
  { id: 'f4', cat: 'Fehlersuche', title: 'Treppenhaus: Licht geht nicht', level: 3, debug: true, faultLabel: 'E1', sol: 'Stromstoßschalter (Treppenhaus)',
    start: () => { const d = exOf('Stromstoßschalter (Treppenhaus)')(); d.parts[5][5] = { l: 'E1', defect: 'open' }; return d; },
    text: 'Das Stromstoßrelais schaltet hörbar (Klack), aber das Licht geht nicht an. Finde das defekte Bauteil.',
    hint: 'Misst du an der Lampe die volle Netzspannung, ist die Lampe selbst unterbrochen.' },
  { id: 'f5', cat: 'Fehlersuche', title: 'Spannungsteiler zeigt 9 V', level: 1, debug: true, faultLabel: 'R2', sol: 'Spannungsteiler',
    start: () => ({ parts: [['BAT', 4, 4, 1, '9'], ['R', 8, 2, 1, '1k', { l: 'R1' }], ['R', 8, 6, 1, '2k', { l: 'R2', defect: 'open' }], ['GND', 4, 10], ['VM', 12, 2, 1, '']], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 2, 12, 2], [12, 6, 12, 10, 8, 10]], scopes: [], tempo: 0.7 }),
    text: 'Das Voltmeter soll 6 V anzeigen (Spannung über R2), zeigt aber 9 V. Welcher Widerstand ist defekt?',
    hint: 'Wenn kein Strom fließt, liegt an dem Teil die ganze Spannung an.' },
];
/* ---- Messhelfer für Aufgaben (SchaltLab, CodeLab) ---- */
const labTasks = () => TASKS.filter(t => (t.lab || 'sim') === LAB);
const vAt = (E, x, y) => { const n = E.c.nodeOfKey(x + ',' + y); return n < 0 ? NaN : E.s.v[n]; };
const pinV = (E, p, i) => { const w = E.wm.get(p.id), q = w && w.pins[i]; return q ? vAt(E, q[0], q[1]) : NaN; };
const vAcross = (E, p) => pinV(E, p, 0) - pinV(E, p, 1);
const ledElem = E => E.c.elems.find(e => e.led);
const burnTxt = E => E.ev.filter(e => e.kind === 'burn').map(e => e.text);
const fmt1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');
/* Mit kleiner Schrittweite weiterrechnen (Wechselspannung); fn(t) wird nach jedem Schritt aufgerufen */
function stepFine(E, T, dt, fn) { const n = Math.round(T / dt); for (let i = 1; i <= n; i++) { E.s.step(dt); while (E.s.events.length) E.ev.push(E.s.events.shift()); if (fn) fn(i * dt); } }

/* ---- Arduino-Programm im Hintergrund ausführen und beobachten ---- */
function codeEval(o) {
  o = o || {};
  const E = simEval({ set: o.set }), c = E.c, s = E.s, mcu = c.mcu, res = { E, ser: '', err: null, samples: [] };
  if (!mcu || !AR) { res.err = 'Kein Arduino in der Schaltung.'; return res; }
  const m = mcu.mcu;
  if (o.pos) Object.keys(o.pos).forEach(id => { const w = E.wm.get(+id); if (w) { w.pos = o.pos[id]; w.light = o.pos[id]; } });
  const comp = AR.compile(o.code != null ? o.code : (sch.code || ''));
  if (!comp.ok) { res.err = 'Fehler in Zeile ' + comp.errors[0].line + ': ' + comp.errors[0].msg; return res; }
  const SIMT = () => s.t, node = q => mcu.nd[mcu.pinNode(q)], ok = q => q >= 0 && q < 20, rx = (o.rx || '').split('');
  const io = {
    pinMode: (q, md) => { if (ok(q)) { m.mode[q] = md; if (md === 2) m.lastDig[q] = 1; } },
    digitalWrite: (q, v, vt) => { if (!ok(q)) return; m.out[q] = v; m.duty[q] = null; const pl = m.pulse[q] || (m.pulse[q] = {}); if (v) { pl.rise = vt == null ? s.t : vt; pl.fall = null; pl.used = false; } else if (pl.rise != null && pl.fall == null) pl.fall = vt == null ? s.t : vt; },
    digitalRead: q => { if (!ok(q)) return 0; if (m.mode[q] === 1) return m.level[q]; if (m.mode[q] === 2 && SIMT() < 2e-3) return 1; const vv = s.v[node(q)]; if (vv > 3) m.lastDig[q] = 1; else if (vv < 1.5) m.lastDig[q] = 0; return m.lastDig[q]; },
    analogRead: q => (ok(q) ? s.v[node(q)] / 5 * 1023 : 0),
    analogWrite: (q, v) => { if (!ok(q)) return; m.mode[q] = 1; if ([3, 5, 6, 9, 10, 11].includes(q)) m.duty[q] = v; else { m.duty[q] = null; m.out[q] = v >= 128 ? 1 : 0; } },
    tone: (q, f, dd) => { if (!ok(q)) return; m.mode[q] = 1; m.tone[q] = { f: Math.max(1, f), until: dd ? s.t + dd / 1000 : null }; },
    noTone: q => { if (ok(q)) m.tone[q] = null; },
    serialPrint: x => { res.ser += x; }, serialAvailable: () => rx.length, serialRead: () => (rx.length ? rx.shift().charCodeAt(0) : -1),
    servo: (q, cmd, a) => { if (cmd === 'detach') delete m.servo[q]; else m.servo[q] = a; },
    lcd: () => {}, object: () => {}, touch: () => 0,
    pulseHint: q => { const e = c.elems.find(x => x.type === 'SENS' && x.dev === 'HCSR04' && x.echoPin === q); return e ? e.lastEcho : null; },
  };
  const runner = AR.createRunner(comp.program, io); runner.start();
  const dt = 5e-5, n = Math.round((o.T || 2) / dt), script = (o.script || []).slice().sort((a, b) => a.t - b.t); let si = 0;
  const leds = c.elems.filter(e => e.led && e.part);
  for (let i = 0; i < n; i++) {
    s.step(dt); const t = s.t;
    while (si < script.length && t >= script[si].t) { const st = script[si++]; E.wm.forEach((w, id) => { w.pressed = !!(st.press && st.press.includes(id)); }); }
    runner.step(t); if (runner.error) { res.err = 'Laufzeitfehler: ' + runner.error.msg; break; }
    while (s.events.length) E.ev.push(s.events.shift());
    if (i % 20 === 0) res.samples.push({ t, lv: m.level.slice(), duty: m.duty.slice(), tone: m.tone.map(x => x && x.f), servo: Object.assign({}, m.servo), led: leds.map(e => [e.part.id, (e.iav || 0) * 1000]) });
  }
  res.m = m; return res;
}
const sampleAt = (R, t) => R.samples.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b), R.samples[0] || { t: 0, lv: [], duty: [], tone: [], servo: {}, led: [] });
const ledMA = (smp, id) => { const l = smp.led.find(x => x[0] === id); return l ? l[1] : 0; };
const codeFail = R => (R.err ? [RES(false, R.err)] : null);
const risingEdges = (R, pin) => { let n = 0, prev = 0; R.samples.forEach(x => { if (x.lv[pin] && !prev) n++; prev = x.lv[pin]; }); return n; };
const dutyShare = (R, pin, t0) => { const a = R.samples.filter(x => x.t >= (t0 || 0)); return a.length ? a.filter(x => x.lv[pin]).length / a.length : 0; };
const ct = (parts, wires, code) => () => ({ parts, wires, scopes: [], tempo: 0.75, code });
const CP_LED13 = [['UNO', 12, 0], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_LED13 = [[20, 26, 22, 26]];
const CP_BTN = [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_BTN = [[20, 4, 24, 4], [20, 26, 22, 26]];
const CP_TWO = [['UNO', 12, 0], ['R', 22, 8, 0, '220'], ['LED', 26, 8, 0, 'rot'], ['GND', 30, 8], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'grün'], ['GND', 30, 16]], CW_TWO = [[20, 8, 22, 8], [20, 16, 22, 16]];
const CP_POT = [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_POT = [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 26, 22, 26]];
const CP_SERVO = [['UNO', 12, 0], ['SERVO', 24, 18], ['GND', 24, 22]], CW_SERVO = [[20, 18, 24, 18], [24, 20, 26, 20, 26, -2, 20, -2]];
const CP_SPK = [['UNO', 12, 0], ['R', 22, 16, 0, '100'], ['SPK', 26, 16, 0, '8'], ['GND', 30, 16]], CW_SPK = [[20, 16, 22, 16]];
const CP_PWM = [['UNO', 12, 0], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'gelb'], ['GND', 30, 18]], CW_PWM = [[20, 18, 22, 18]];
const CP_US = [['UNO', 12, 0], ['HCSR04', 24, 10, 0, '', { pos: 0.5 }], ['GND', 24, 16], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_US = [[24, 10, 22, 10, 22, -2, 20, -2], [20, 12, 24, 12], [20, 14, 24, 14], [20, 26, 22, 26]];
const CP_LEDS4 = [['UNO', 12, 0], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'grün'], ['GND', 30, 14], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'blau'], ['GND', 30, 18]], CW_LEDS4 = [[20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14], [20, 18, 22, 18]];
const CP_POTPWM = [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'gelb'], ['GND', 30, 18]], CW_POTPWM = [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 18, 22, 18]];
const CP_TMP = [['UNO', 12, 0], ['TMP36', 6, 8, 0, '', { pos: 0.394 }], ['GND', 10, 12], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_TMP = [[10, 10, 11, 10, 11, 8, 12, 8], [10, 8, 9, 8, 9, 0, 12, 0], [20, 26, 22, 26]];
const theLed = () => sch.parts.find(p => p.k === 'LED');
function chkBlink(minEdges) {
  const L = theLed(); if (!L) return [RES(false, 'Keine LED vorhanden.')];
  const R = codeEval({ T: 5 }); if (R.err) return codeFail(R);
  const e = risingEdges(R, 13), sh = dutyShare(R, 13), burn = burnTxt(R.E);
  return [RES(e >= minEdges, e >= minEdges ? 'Die LED blinkt (' + e + '× in 5 s).' : 'Die LED blinkt nicht oft genug (' + e + '× in 5 s, mindestens ' + minEdges + ').'), RES(sh > 0.15 && sh < 0.85, 'Die LED ist ' + Math.round(sh * 100) + ' % der Zeit an (sinnvoll sind 20 bis 80 %).'), RES(!burn.length, burn.length ? burn[0] : 'Pin und LED bleiben heil.')];
}
function chkTaster() {
  const L = theLed(), pb = sch.parts.find(p => p.k === 'PB'); if (!L || !pb) return [RES(false, 'LED oder Taster fehlt.')];
  const R = codeEval({ T: 1.2, script: [{ t: 0.4, press: [pb.id] }, { t: 0.8, press: [] }] }); if (R.err) return codeFail(R);
  const a = ledMA(sampleAt(R, 0.3), L.id) > 2, b = ledMA(sampleAt(R, 0.7), L.id) > 2, c = ledMA(sampleAt(R, 1.1), L.id) > 2;
  return [RES(!a, 'Taster nicht gedrückt: LED ist ' + (a ? 'an, soll aber aus sein' : 'aus') + '.'), RES(b, 'Taster gedrückt: LED ist ' + (b ? 'an' : 'aus, soll aber an sein') + '.'), RES(!c, 'Taster losgelassen: LED ist ' + (c ? 'an, soll aber aus sein' : 'aus') + '.')];
}

/* Prüfungspraxis (Arduino): Schaltungen für die Aufgaben cp1 bis cp4 (Pin 2 Taster, Pin 3 rot, 5 gelb, 7 grün, 8 Lautsprecher, 13 LED) */
const CP_COUNT = [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8], ['R', 22, 16, 0, '100'], ['SPK', 26, 16, 0, '8'], ['GND', 30, 16], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], CW_COUNT = [[20, 4, 24, 4], [20, 16, 22, 16], [20, 26, 22, 26]];
const CP_LUFT = [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'grün'], ['GND', 30, 14]], CW_LUFT = [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14]];
const CP_STUFE = [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8], ['R', 22, 6, 0, '220'], ['LED', 26, 6, 0, 'rot'], ['GND', 30, 6], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10], ['R', 22, 14, 0, '220'], ['LED', 26, 14, 0, 'grün'], ['GND', 30, 14]], CW_STUFE = [[20, 4, 24, 4], [20, 6, 22, 6], [20, 10, 22, 10], [20, 14, 22, 14]];
const CP_DICE = [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8]], CW_DICE = [[20, 4, 24, 4]];
/* Taster mit Prellen: drei kurze Kontakte, dann gedrückt bis t1 */
const bounceScript = (pb, t0, t1) => [{ t: t0, press: [pb] }, { t: t0 + 0.002, press: [] }, { t: t0 + 0.005, press: [pb] }, { t: t0 + 0.007, press: [] }, { t: t0 + 0.010, press: [pb] }, { t: t1, press: [] }];
const serLines = R => R.ser.split('\n').map(x => x.trim()).filter(x => x.length);
const CODE_TASKS = [
  { id: 'c1', lab: 'code', cat: 'Grundlagen', title: 'Dreimal blinken', level: 1,
    start: ct(CP_LED13, CW_LED13, 'void setup() {\n  pinMode(13, OUTPUT);\n  // Hier: LED dreimal blinken lassen (je 300 ms an und aus)\n}\n\nvoid loop() {\n  // bleibt leer: danach passiert nichts mehr\n}\n'),
    solMake: ct(CP_LED13, CW_LED13, 'void setup() {\n  pinMode(13, OUTPUT);\n  for (int i = 0; i < 3; i++) {\n    digitalWrite(13, HIGH);\n    delay(300);\n    digitalWrite(13, LOW);\n    delay(300);\n  }\n}\n\nvoid loop() {\n}\n'),
    text: 'Die LED an Pin 13 soll nach dem Start genau dreimal blinken (je etwa 300 ms an und aus) und danach dunkel bleiben. Schreibe das Programm in setup().',
    hint: 'Mit einer for-Schleife kannst du Anweisungen wiederholen: for (int i = 0; i < 3; i++) { ... }',
    check() { const L = theLed(); if (!L) return [RES(false, 'Keine LED vorhanden.')]; const R = codeEval({ T: 6 }); if (R.err) return codeFail(R); const e = risingEdges(R, 13), last = R.samples[R.samples.length - 1].lv[13], burn = burnTxt(R.E);
      return [RES(e === 3, 'Die LED blinkt ' + e + '× (soll genau 3×).'), RES(!last, last ? 'Am Ende leuchtet die LED noch, sie soll aus sein.' : 'Nach dem Blinken bleibt die LED aus.'), RES(!burn.length, burn.length ? burn[0] : 'Pin und LED bleiben heil.')]; } },
  { id: 'c2', lab: 'code', cat: 'Grundlagen', title: 'Taster schaltet die LED', level: 1,
    start: ct(CP_BTN, CW_BTN, 'void setup() {\n  pinMode(2, INPUT_PULLUP);   // Taster gegen Masse\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  // Hier: LED an, solange der Taster gedrückt ist\n}\n'),
    solMake: ct(CP_BTN, CW_BTN, 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n}\n'),
    text: 'Die LED soll genau dann leuchten, wenn der Taster gedrückt ist. Der Taster liegt zwischen Pin 2 und Masse, Pin 2 nutzt den internen Pull-up-Widerstand.',
    hint: 'Mit Pull-up liest digitalRead(2) im Ruhezustand HIGH und bei gedrücktem Taster LOW.',
    check: chkTaster },
  { id: 'c3', lab: 'code', cat: 'Grundlagen', title: 'Hallo im Serial-Monitor', level: 1,
    start: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // Hier: jede Sekunde "Hallo Azubi" ausgeben\n}\n'),
    solMake: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  Serial.println("Hallo Azubi");\n  delay(1000);\n}\n'),
    text: 'Gib im Serial-Monitor jede Sekunde die Zeile „Hallo Azubi“ aus (nach dem Text soll ein Zeilenumbruch kommen).',
    hint: 'Serial.println("...") schreibt Text mit Zeilenumbruch, delay(1000) wartet eine Sekunde.',
    check() { const R = codeEval({ T: 3.6 }); if (R.err) return codeFail(R); const lines = R.ser.split('\n').filter(x => x.length), allOk = lines.length > 0 && lines.every(x => x.trim() === 'Hallo Azubi');
      return [RES(lines.length >= 3 && lines.length <= 4, 'In 3,6 s kamen ' + lines.length + ' Zeilen an (erwartet: 3 bis 4).'), RES(allOk, allOk ? 'Der Text stimmt.' : 'Der Text stimmt nicht. Erwartet: Hallo Azubi')]; } },
  { id: 'c4', lab: 'code', cat: 'Grundlagen', title: 'Wechselblinker', level: 2,
    start: ct(CP_TWO, CW_TWO, 'void setup() {\n  pinMode(4, OUTPUT);   // rote LED\n  pinMode(8, OUTPUT);   // grüne LED\n}\n\nvoid loop() {\n  // Hier: die beiden LEDs wechselweise blinken lassen\n}\n'),
    solMake: ct(CP_TWO, CW_TWO, 'void setup() {\n  pinMode(4, OUTPUT);\n  pinMode(8, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(4, HIGH);\n  digitalWrite(8, LOW);\n  delay(400);\n  digitalWrite(4, LOW);\n  digitalWrite(8, HIGH);\n  delay(400);\n}\n'),
    text: 'Die rote LED (Pin 4) und die grüne LED (Pin 8) sollen abwechselnd leuchten, etwa im Takt von einer halben Sekunde. Es darf nie eine Zeit geben, in der beide gleichzeitig leuchten.',
    hint: 'Schalte in jedem Schritt eine LED ein und die andere aus, dann warte (delay), dann umgekehrt.',
    check() { const R = codeEval({ T: 4 }); if (R.err) return codeFail(R); const both = R.samples.filter(x => x.lv[4] && x.lv[8]).length / R.samples.length, a = dutyShare(R, 4), b = dutyShare(R, 8), ea = risingEdges(R, 4), eb = risingEdges(R, 8);
      return [RES(ea >= 3 && eb >= 3, 'Beide LEDs blinken (rot ' + ea + '×, grün ' + eb + '× in 4 s).'), RES(a > 0.25 && a < 0.75 && b > 0.25 && b < 0.75, 'Jede LED ist etwa die Hälfte der Zeit an (rot ' + Math.round(a * 100) + ' %, grün ' + Math.round(b * 100) + ' %).'), RES(both < 0.03, both < 0.03 ? 'Nie leuchten beide gleichzeitig.' : 'Zeitweise leuchten beide gleichzeitig (' + Math.round(both * 100) + ' % der Zeit).')]; } },
  { id: 'c5', lab: 'code', cat: 'Sensoren und Töne', title: 'Poti-Schwelle', level: 2,
    start: ct(CP_POT, CW_POT, 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  int wert = analogRead(A0);   // 0 bis 1023\n  // Hier: LED an, wenn wert größer als 511 ist, sonst aus\n}\n'),
    solMake: ct(CP_POT, CW_POT, 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  int wert = analogRead(A0);\n  if (wert > 511) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n}\n'),
    text: 'Das Programm liest das Poti an A0 (Werte 0 bis 1023). Die LED an Pin 13 soll leuchten, wenn der Messwert größer als 511 ist, sonst aus sein. Verstelle das Poti mit dem Regler unter dem Bauteil.',
    hint: 'if (wert > 511) { digitalWrite(13, HIGH); } else { digitalWrite(13, LOW); }',
    check() { const L = theLed(), P = sch.parts.find(p => p.k === 'POT'); if (!L || !P) return [RES(false, 'LED oder Poti fehlt.')];
      const hi = codeEval({ T: 0.6, pos: { [P.id]: 0.1 } }), lo = codeEval({ T: 0.6, pos: { [P.id]: 0.9 } }); if (hi.err) return codeFail(hi);
      const on = ledMA(sampleAt(hi, 0.55), L.id) > 2, off = ledMA(sampleAt(lo, 0.55), L.id) > 2;
      return [RES(on, 'Messwert etwa 920 (über 511): LED ist ' + (on ? 'an' : 'aus, soll aber an sein') + '.'), RES(!off, 'Messwert etwa 100 (unter 511): LED ist ' + (off ? 'an, soll aber aus sein' : 'aus') + '.')]; } },
  { id: 'c6', lab: 'code', cat: 'Sensoren und Töne', title: 'Servo auf 90 Grad', level: 1,
    start: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  // Hier: Servo an Pin 9 anschließen und auf 90 Grad fahren\n}\n\nvoid loop() {\n}\n'),
    solMake: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  meinServo.attach(9);\n  meinServo.write(90);\n}\n\nvoid loop() {\n}\n'),
    text: 'Der Servo hängt an Pin 9. Fahre ihn nach dem Start auf die Mittelstellung (90 Grad).',
    hint: 'Mit meinServo.attach(9) verbindest du den Servo mit dem Pin, mit meinServo.write(90) stellst du den Winkel ein.',
    check() { const R = codeEval({ T: 1.5 }); if (R.err) return codeFail(R); const a = R.samples[R.samples.length - 1].servo[9];
      return [RES(a != null, a != null ? 'Der Servo ist an Pin 9 angeschlossen.' : 'Der Servo ist nicht an Pin 9 angeschlossen (attach fehlt).'), RES(a != null && Math.abs(a - 90) <= 3, a != null ? 'Winkel: ' + Math.round(a) + ' Grad (soll 90).' : 'Kein Winkel eingestellt.')]; } },
  { id: 'c7', lab: 'code', cat: 'Sensoren und Töne', title: 'Kammerton a', level: 1,
    start: ct(CP_SPK, CW_SPK, 'void setup() {\n  // Hier: den Ton a (440 Hz) auf dem Lautsprecher an Pin 8 spielen\n}\n\nvoid loop() {\n}\n'),
    solMake: ct(CP_SPK, CW_SPK, 'void setup() {\n  tone(8, 440);\n}\n\nvoid loop() {\n}\n'),
    text: 'Spiele auf dem Lautsprecher an Pin 8 dauerhaft den Kammerton a mit 440 Hz.',
    hint: 'tone(Pin, Frequenz) startet einen Ton, zum Beispiel tone(8, 262) für das tiefe c.',
    check() { const R = codeEval({ T: 1 }); if (R.err) return codeFail(R); const f = R.samples[R.samples.length - 1].tone[8];
      return [RES(f != null, f != null ? 'Auf Pin 8 wird ein Ton gespielt.' : 'Auf Pin 8 ist kein Ton zu hören.'), RES(f != null && Math.abs(f - 440) <= 5, f != null ? 'Frequenz: ' + Math.round(f) + ' Hz (soll 440 Hz).' : 'Keine Frequenz.')]; } },
  { id: 'c8', lab: 'code', cat: 'Sensoren und Töne', title: 'Halbe Helligkeit (PWM)', level: 1,
    start: ct(CP_PWM, CW_PWM, 'void setup() {\n  pinMode(9, OUTPUT);\n  // Hier: LED an Pin 9 mit halber Helligkeit leuchten lassen\n}\n\nvoid loop() {\n}\n'),
    solMake: ct(CP_PWM, CW_PWM, 'void setup() {\n  pinMode(9, OUTPUT);\n  analogWrite(9, 128);\n}\n\nvoid loop() {\n}\n'),
    text: 'Die LED an Pin 9 soll mit etwa halber Helligkeit leuchten. Pin 9 kann PWM (analogWrite, Wert 0 bis 255).',
    hint: 'analogWrite(9, 128) ergibt ein Tastverhältnis von 50 %.',
    check() { const R = codeEval({ T: 0.5 }); if (R.err) return codeFail(R); const d = R.samples[R.samples.length - 1].duty[9];
      return [RES(d != null, d != null ? 'Pin 9 gibt ein PWM-Signal aus.' : 'Pin 9 gibt kein PWM-Signal aus (analogWrite fehlt).'), RES(d != null && d >= 115 && d <= 140, d != null ? 'PWM-Wert: ' + d + ' (soll etwa 128).' : 'Kein Wert.')]; } },
  { id: 'c9', lab: 'code', cat: 'Grundlagen', title: 'Zählen bis 10', level: 2,
    start: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n  // Hier: die Zahlen 1 bis 10 ausgeben, jede in einer eigenen Zeile\n}\n\nvoid loop() {\n}\n'),
    solMake: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n  for (int i = 1; i <= 10; i++) {\n    Serial.println(i);\n  }\n}\n\nvoid loop() {\n}\n'),
    text: 'Gib im Serial-Monitor einmalig die Zahlen von 1 bis 10 aus, jede Zahl in einer eigenen Zeile. Danach soll nichts mehr kommen.',
    hint: 'Eine for-Schleife zählt für dich: for (int i = 1; i <= 10; i++) { Serial.println(i); }',
    check() { const R = codeEval({ T: 2 }); if (R.err) return codeFail(R); const want = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n';
      return [RES(R.ser === want, R.ser === want ? 'Die Zahlen 1 bis 10 stehen richtig im Serial-Monitor.' : 'Ausgabe stimmt nicht. Erhalten: ' + JSON.stringify(R.ser.slice(0, 40)))]; } },
  { id: 'c10', lab: 'code', cat: 'Sensoren und Töne', title: 'Abstandswarner', level: 3,
    start: ct(CP_US, CW_US, 'const int triggerPin = 6;\nconst int echoPin = 7;\nconst int ledPin = 13;\n\nlong messeDauer() {\n  pinMode(triggerPin, OUTPUT);\n  digitalWrite(triggerPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(triggerPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(triggerPin, LOW);\n  pinMode(echoPin, INPUT);\n  return pulseIn(echoPin, HIGH);\n}\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  float cm = 0.01723 * messeDauer();\n  // Hier: LED an, wenn das Hindernis näher als 50 cm ist\n  delay(60);\n}\n'),
    solMake: ct(CP_US, CW_US, 'const int triggerPin = 6;\nconst int echoPin = 7;\nconst int ledPin = 13;\n\nlong messeDauer() {\n  pinMode(triggerPin, OUTPUT);\n  digitalWrite(triggerPin, LOW);\n  delayMicroseconds(2);\n  digitalWrite(triggerPin, HIGH);\n  delayMicroseconds(10);\n  digitalWrite(triggerPin, LOW);\n  pinMode(echoPin, INPUT);\n  return pulseIn(echoPin, HIGH);\n}\n\nvoid setup() {\n  pinMode(ledPin, OUTPUT);\n}\n\nvoid loop() {\n  float cm = 0.01723 * messeDauer();\n  if (cm < 50) {\n    digitalWrite(ledPin, HIGH);\n  } else {\n    digitalWrite(ledPin, LOW);\n  }\n  delay(60);\n}\n'),
    text: 'Der Ultraschallsensor misst den Abstand (die Funktion messeDauer ist schon fertig). Die LED an Pin 13 soll leuchten, wenn ein Hindernis näher als 50 cm ist, sonst aus sein. Den Abstand stellst du mit dem Regler am Sensor ein.',
    hint: 'Die Variable cm enthält schon den Abstand. Vergleiche sie mit 50 und schalte die LED mit digitalWrite.',
    check() { const L = theLed(), U = sch.parts.find(p => p.k === 'HCSR04'); if (!L || !U) return [RES(false, 'LED oder Ultraschallsensor fehlt.')];
      const near = codeEval({ T: 1, pos: { [U.id]: 0.045 } }), far = codeEval({ T: 1, pos: { [U.id]: 0.4 } }); if (near.err) return codeFail(near);
      const a = ledMA(sampleAt(near, 0.95), L.id) > 2, b = ledMA(sampleAt(far, 0.95), L.id) > 2;
      return [RES(a, 'Hindernis bei etwa 20 cm: LED ist ' + (a ? 'an' : 'aus, soll aber an sein') + '.'), RES(!b, 'Hindernis bei etwa 160 cm: LED ist ' + (b ? 'an, soll aber aus sein' : 'aus') + '.')]; } },
  { id: 'cf1', lab: 'code', cat: 'Fehlersuche im Code', title: 'Die LED bleibt dunkel', level: 1,
    start: ct(CP_LED13, CW_LED13, 'void setup() {\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'),
    solMake: ct(CP_LED13, CW_LED13, 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'),
    text: 'Das Programm soll die LED an Pin 13 blinken lassen, aber sie bleibt dunkel. Das Programm ist fehlerfrei geschrieben, trotzdem fehlt etwas Wichtiges. Finde und behebe den Fehler.',
    hint: 'Ein Pin muss erst mit pinMode als Ausgang (OUTPUT) eingestellt werden, sonst treibt er keinen Strom.',
    check: () => chkBlink(4) },
  { id: 'cf2', lab: 'code', cat: 'Fehlersuche im Code', title: 'Der Taster arbeitet verkehrt herum', level: 1,
    start: ct(CP_BTN, CW_BTN, 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(2) == HIGH) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n}\n'),
    solMake: ct(CP_BTN, CW_BTN, 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n}\n'),
    text: 'Die LED soll leuchten, solange der Taster gedrückt ist. Im Moment leuchtet sie aber, wenn der Taster NICHT gedrückt ist. Behebe den Fehler im Programm.',
    hint: 'Der Taster liegt gegen Masse. Mit Pull-up liest der Pin im Ruhezustand HIGH und beim Drücken LOW.',
    check: chkTaster },
  { id: 'cf3', lab: 'code', cat: 'Fehlersuche im Code', title: 'Fehlermeldung lesen', level: 1,
    start: ct(CP_LED13, CW_LED13, 'void setup() {\n  pinMode(13, OUTPUT)\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'),
    solMake: ct(CP_LED13, CW_LED13, 'void setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(500);\n  digitalWrite(13, LOW);\n  delay(500);\n}\n'),
    text: 'Das Programm lässt sich nicht starten. Starte es mit ▶ Start, lies die Fehlermeldung (Zeilennummer!) und behebe den Fehler, so dass die LED blinkt.',
    hint: 'Jede Anweisung in C++ endet mit einem Semikolon. Schau in die Zeile, die die Fehlermeldung nennt.',
    check: () => chkBlink(4) },
  { id: 'c11', lab: 'code', cat: 'Mehrere LEDs', title: 'Lauflicht', level: 2,
    start: ct(CP_LEDS4, CW_LEDS4, 'int ledPins[] = {3, 5, 7, 9};\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) {\n    pinMode(ledPins[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  // Hier: eine LED nach der anderen einschalten (von links nach rechts),\n  // dann wieder von vorn. Es leuchtet immer nur eine.\n}\n'),
    solMake: ct(CP_LEDS4, CW_LEDS4, 'int ledPins[] = {3, 5, 7, 9};\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) {\n    pinMode(ledPins[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  for (int i = 0; i < 4; i++) {\n    digitalWrite(ledPins[i], HIGH);\n    delay(200);\n    digitalWrite(ledPins[i], LOW);\n  }\n}\n'),
    text: 'Vier LEDs hängen an den Pins 3, 5, 7 und 9 (von oben nach unten). Programmiere ein Lauflicht: Es leuchtet immer nur eine LED, und das Licht wandert von oben nach unten durch und beginnt dann wieder oben. Ein Schritt soll höchstens eine halbe Sekunde dauern.',
    hint: 'Eine for-Schleife über das Feld ledPins: LED einschalten, kurz warten, wieder ausschalten, dann die nächste.',
    check() { const R = codeEval({ T: 4 }); if (R.err) return codeFail(R); const seq = []; let multi = 0; const exp = [3, 5, 7, 9, 3, 5, 7, 9];
      R.samples.forEach(x => { const lit = [3, 5, 7, 9].filter(p => x.lv[p]); if (lit.length > 1) multi++; if (lit.length === 1 && seq[seq.length - 1] !== lit[0]) seq.push(lit[0]); });
      const ok = seq.length >= 6 && seq.slice(0, 8).every((p, i) => p === exp[i]);
      return [RES(multi === 0, multi === 0 ? 'Es leuchtet nie mehr als eine LED.' : 'Zeitweise leuchten mehrere LEDs gleichzeitig.'), RES(seq.length >= 6, seq.length >= 6 ? 'Das Licht wandert durch (' + seq.length + ' Schritte in 4 s).' : 'Zu wenige Schritte (' + seq.length + ' in 4 s): Das Licht muss schneller wandern.'), RES(ok, ok ? 'Die Reihenfolge stimmt (Pin 3, 5, 7, 9, dann von vorn).' : 'Die Reihenfolge stimmt nicht. Erwartet: Pin 3, 5, 7, 9, dann wieder 3.')]; } },
  { id: 'c12', lab: 'code', cat: 'Mehrere LEDs', title: 'Binärzähler', level: 3,
    start: ct(CP_LEDS4, CW_LEDS4, 'int ledPins[] = {3, 5, 7, 9};   // Pin 3 ist das niedrigste Bit\nint zahl = 0;\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) {\n    pinMode(ledPins[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  // Hier: die Zahl als Dualzahl auf den LEDs anzeigen,\n  // dann um 1 erhöhen (nach 15 wieder 0) und kurz warten\n}\n'),
    solMake: ct(CP_LEDS4, CW_LEDS4, 'int ledPins[] = {3, 5, 7, 9};\nint zahl = 0;\n\nvoid setup() {\n  for (int i = 0; i < 4; i++) {\n    pinMode(ledPins[i], OUTPUT);\n  }\n}\n\nvoid loop() {\n  for (int bit = 0; bit < 4; bit++) {\n    digitalWrite(ledPins[bit], (zahl >> bit) & 1);\n  }\n  zahl = (zahl + 1) % 16;\n  delay(300);\n}\n'),
    text: 'Die vier LEDs sollen eine Zahl als Dualzahl anzeigen (leuchtet = 1). Pin 3 ist das niedrigste Bit, Pin 9 das höchste. Die Zahl zählt von 0 bis 15 hoch und beginnt dann wieder bei 0. Ein Schritt soll höchstens eine Sekunde dauern.',
    hint: 'Bit Nummer b der Zahl bekommst du mit (zahl >> b) & 1. Das schreibst du mit digitalWrite auf den Pin ledPins[b]. Danach zahl = (zahl + 1) % 16.',
    check() { const R = codeEval({ T: 6 }); if (R.err) return codeFail(R); const vals = []; R.samples.forEach(x => { const v = [3, 5, 7, 9].reduce((s, p, i) => s + (x.lv[p] ? 1 << i : 0), 0); if (vals[vals.length - 1] !== v) vals.push(v); });
      let steps = 0, bad = 0; for (let i = 1; i < vals.length; i++) { steps++; if (vals[i] !== (vals[i - 1] + 1) % 16) bad++; }
      return [RES(steps >= 4, steps >= 4 ? 'Die Anzeige ändert sich (' + steps + ' Schritte in 6 s).' : 'Die Anzeige ändert sich zu selten oder gar nicht (' + steps + ' Schritte in 6 s).'), RES(steps >= 4 && bad === 0, bad === 0 ? 'Jeder Schritt erhöht die Zahl um genau 1.' : bad + '× springt die Anzeige falsch. Gesehen: ' + vals.slice(0, 8).join(', '))]; } },
  { id: 'c13', lab: 'code', cat: 'Grundlagen', title: 'Tastendrücke zählen', level: 3,
    start: ct(CP_BTN, CW_BTN, 'int anzahl = 0;\nint letzterZustand = HIGH;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int zustand = digitalRead(2);\n  // Hier: bei jedem neuen Tastendruck (HIGH -> LOW) hochzählen\n  // und "Anzahl: 1", "Anzahl: 2", ... ausgeben.\n  letzterZustand = zustand;\n}\n'),
    solMake: ct(CP_BTN, CW_BTN, 'int anzahl = 0;\nint letzterZustand = HIGH;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int zustand = digitalRead(2);\n  if (zustand == LOW && letzterZustand == HIGH) {\n    anzahl++;\n    Serial.print("Anzahl: ");\n    Serial.println(anzahl);\n  }\n  letzterZustand = zustand;\n}\n'),
    text: 'Zähle die Tastendrücke an Pin 2 (Taster gegen Masse, Pull-up). Bei jedem neuen Druck soll im Serial-Monitor „Anzahl: 1“, „Anzahl: 2“ und so weiter stehen. Wird der Taster gedrückt gehalten, darf nur einmal gezählt werden.',
    hint: 'Merke dir den letzten Zustand des Tasters. Nur wenn er jetzt LOW und vorher HIGH war, ist es ein neuer Tastendruck (Flanke).',
    check() { const pb = sch.parts.find(p => p.k === 'PB'); if (!pb) return [RES(false, 'Der Taster fehlt.')]; const id = pb.id;
      const R = codeEval({ T: 2, script: [{ t: 0.3, press: [id] }, { t: 0.5, press: [] }, { t: 0.8, press: [id] }, { t: 1.0, press: [] }, { t: 1.3, press: [id] }, { t: 1.5, press: [] }] }); if (R.err) return codeFail(R);
      const lines = R.ser.split('\n').map(x => x.trim()).filter(Boolean), want = ['Anzahl: 1', 'Anzahl: 2', 'Anzahl: 3'], ok = lines.length === 3 && want.every((w, i) => lines[i] === w);
      return [RES(ok, ok ? 'Drei Tastendrücke ergeben die Ausgabe „Anzahl: 1“, „Anzahl: 2“, „Anzahl: 3“.' : 'Erwartet bei drei Tastendrücken: Anzahl: 1, Anzahl: 2, Anzahl: 3. Erhalten: ' + JSON.stringify(lines.slice(0, 6)))]; } },
  { id: 'c14', lab: 'code', cat: 'Sensoren und Töne', title: 'Poti dimmt die LED', level: 2,
    start: ct(CP_POTPWM, CW_POTPWM, 'void setup() {\n  pinMode(9, OUTPUT);\n}\n\nvoid loop() {\n  int wert = analogRead(A0);   // 0 bis 1023\n  // Hier: die LED an Pin 9 so hell machen, wie das Poti steht\n}\n'),
    solMake: ct(CP_POTPWM, CW_POTPWM, 'void setup() {\n  pinMode(9, OUTPUT);\n}\n\nvoid loop() {\n  int wert = analogRead(A0);\n  analogWrite(9, wert / 4);\n}\n'),
    text: 'Das Poti an A0 liefert Werte von 0 bis 1023, analogWrite erwartet 0 bis 255. Rechne um, so dass die LED an Pin 9 umso heller leuchtet, je größer der Messwert ist.',
    hint: 'Teile den Messwert durch 4 (1023 / 4 ≈ 255) und gib das Ergebnis an analogWrite(9, …) weiter. Oder nutze map(wert, 0, 1023, 0, 255).',
    check() { const P = sch.parts.find(p => p.k === 'POT'); if (!P) return [RES(false, 'Das Poti fehlt.')]; const hi = codeEval({ T: 0.5, pos: { [P.id]: 0.1 } }), lo = codeEval({ T: 0.5, pos: { [P.id]: 0.9 } }); if (hi.err) return codeFail(hi);
      const a = hi.samples[hi.samples.length - 1].duty[9], b = lo.samples[lo.samples.length - 1].duty[9];
      return [RES(a != null && a >= 215 && a <= 245, 'Messwert etwa 920: PWM-Wert ' + (a == null ? 'fehlt' : a) + ' (soll etwa 230).'), RES(b != null && b >= 14 && b <= 38, 'Messwert etwa 100: PWM-Wert ' + (b == null ? 'fehlt' : b) + ' (soll etwa 25).')]; } },
  { id: 'c15', lab: 'code', cat: 'Sensoren und Töne', title: 'Sirene', level: 2,
    start: ct(CP_SPK, CW_SPK, 'void setup() {\n}\n\nvoid loop() {\n  // Hier: abwechselnd 440 Hz und 660 Hz auf Pin 8 spielen (je etwa 300 ms)\n}\n'),
    solMake: ct(CP_SPK, CW_SPK, 'void setup() {\n}\n\nvoid loop() {\n  tone(8, 440);\n  delay(300);\n  tone(8, 660);\n  delay(300);\n}\n'),
    text: 'Der Lautsprecher hängt an Pin 8. Spiele eine Sirene: abwechselnd 440 Hz und 660 Hz, jeder Ton etwa 300 ms lang, immer wieder.',
    hint: 'tone(8, 440); delay(300); tone(8, 660); delay(300); in loop() ergibt schon eine Sirene.',
    check() { const R = codeEval({ T: 3 }); if (R.err) return codeFail(R); const seq = []; R.samples.forEach(x => { const f = x.tone[8]; if (f != null && seq[seq.length - 1] !== Math.round(f)) seq.push(Math.round(f)); });
      const lo = seq.some(f => Math.abs(f - 440) <= 8), hi = seq.some(f => Math.abs(f - 660) <= 8);
      return [RES(lo && hi, 'Gespielte Töne: ' + (seq.slice(0, 6).join(', ') || 'keine') + (lo && hi ? ' – beide Frequenzen sind dabei.' : ' – es fehlen 440 Hz und 660 Hz.')), RES(seq.length >= 4, seq.length >= 4 ? 'Die Töne wechseln sich ab (' + seq.length + ' Wechsel in 3 s).' : 'Zu wenige Tonwechsel (' + seq.length + ' in 3 s).')]; } },
  { id: 'c16', lab: 'code', cat: 'Sensoren und Töne', title: 'Temperaturwarnung', level: 3,
    start: ct(CP_TMP, CW_TMP, 'void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int roh = analogRead(A0);\n  float volt = roh * 5.0 / 1023.0;\n  // Hier: Temperatur in Grad Celsius ausrechnen (TMP36: 0,5 V bei 0 Grad, 10 mV pro Grad)\n  // und die LED an Pin 13 einschalten, wenn es wärmer als 30 Grad ist\n  delay(100);\n}\n'),
    solMake: ct(CP_TMP, CW_TMP, 'void setup() {\n  pinMode(13, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int roh = analogRead(A0);\n  float volt = roh * 5.0 / 1023.0;\n  float celsius = (volt - 0.5) * 100.0;\n  Serial.println(celsius);\n  if (celsius > 30) {\n    digitalWrite(13, HIGH);\n  } else {\n    digitalWrite(13, LOW);\n  }\n  delay(100);\n}\n'),
    text: 'Der Temperatursensor TMP36 liefert 0,5 V bei 0 °C und 10 mV pro Grad. Rechne die Spannung in °C um. Die LED an Pin 13 soll leuchten, wenn es wärmer als 30 °C ist. Die Temperatur stellst du mit dem Regler am Sensor ein.',
    hint: 'celsius = (volt - 0.5) * 100.0. Danach if (celsius > 30) { LED an } else { LED aus }.',
    check() { const L = theLed(), T = sch.parts.find(p => p.k === 'TMP36'); if (!L || !T) return [RES(false, 'LED oder Temperatursensor fehlt.')];
      const cold = codeEval({ T: 0.8, pos: { [T.id]: 0.3636 } }), hot = codeEval({ T: 0.8, pos: { [T.id]: 0.4848 } }); if (cold.err) return codeFail(cold);
      const a = ledMA(sampleAt(cold, 0.75), L.id) > 2, b = ledMA(sampleAt(hot, 0.75), L.id) > 2;
      return [RES(!a, 'Bei 20 °C ist die LED ' + (a ? 'an, soll aber aus sein' : 'aus') + '.'), RES(b, 'Bei 40 °C ist die LED ' + (b ? 'an' : 'aus, soll aber an sein') + '.')]; } },
  { id: 'c17', lab: 'code', cat: 'Grundlagen', title: 'Würfel', level: 3,
    start: ct(CP_BTN, CW_BTN, 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n  randomSeed(analogRead(A5));\n}\n\nvoid loop() {\n  // Hier: wenn der Taster gedrückt wird, eine Zufallszahl von 1 bis 6\n  // würfeln und als "Wurf: 4" ausgeben. Pro Tastendruck nur ein Wurf.\n}\n'),
    solMake: ct(CP_BTN, CW_BTN, 'int letzter = HIGH;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n  randomSeed(analogRead(A5));\n}\n\nvoid loop() {\n  int zustand = digitalRead(2);\n  if (zustand == LOW && letzter == HIGH) {\n    Serial.print("Wurf: ");\n    Serial.println(random(1, 7));\n  }\n  letzter = zustand;\n}\n'),
    text: 'Baue einen elektronischen Würfel: Bei jedem Druck auf den Taster an Pin 2 wird eine Zufallszahl von 1 bis 6 gewürfelt und im Serial-Monitor als „Wurf: 4“ ausgegeben (mit der gewürfelten Zahl). Gehalten zählt nur als ein Druck.',
    hint: 'random(1, 7) liefert Zahlen von 1 bis 6 (die obere Grenze ist ausgeschlossen). Nur bei einem neuen Druck (vorher HIGH, jetzt LOW) würfeln.',
    check() { const pb = sch.parts.find(p => p.k === 'PB'); if (!pb) return [RES(false, 'Der Taster fehlt.')]; const id = pb.id;
      const R = codeEval({ T: 2, script: [{ t: 0.3, press: [id] }, { t: 0.5, press: [] }, { t: 0.8, press: [id] }, { t: 1.0, press: [] }, { t: 1.3, press: [id] }, { t: 1.5, press: [] }] }); if (R.err) return codeFail(R);
      const lines = R.ser.split('\n').map(x => x.trim()).filter(Boolean), ok = lines.length === 3 && lines.every(l => /^Wurf: [1-6]$/.test(l));
      return [RES(lines.length === 3, 'Bei drei Tastendrücken kamen ' + lines.length + ' Würfe an (erwartet: 3).'), RES(ok, ok ? 'Format und Zahlen stimmen (Wurf: 1 bis 6).' : 'Erwartetes Format: „Wurf: 4“ mit einer Zahl von 1 bis 6. Erhalten: ' + JSON.stringify(lines.slice(0, 3)))]; } },
  { id: 'c18', lab: 'code', cat: 'Sensoren und Töne', title: 'Servo fährt hin und her', level: 2,
    start: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  meinServo.attach(9);\n}\n\nvoid loop() {\n  // Hier: den Servo langsam von 0 auf 180 Grad fahren und wieder zurück\n}\n'),
    solMake: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  meinServo.attach(9);\n}\n\nvoid loop() {\n  for (int w = 0; w <= 180; w += 2) {\n    meinServo.write(w);\n    delay(15);\n  }\n  for (int w = 180; w >= 0; w -= 2) {\n    meinServo.write(w);\n    delay(15);\n  }\n}\n'),
    text: 'Der Servo an Pin 9 soll ständig langsam von 0 bis 180 Grad und wieder zurück fahren (Schleife mit kleinen Schritten und delay).',
    hint: 'Zwei for-Schleifen hintereinander: eine zählt w von 0 bis 180 hoch, die andere von 180 bis 0 herunter. In jedem Schritt meinServo.write(w) und kurz warten.',
    check() { const R = codeEval({ T: 7 }); if (R.err) return codeFail(R); const a = R.samples.map(x => x.servo[9]).filter(x => x != null); if (!a.length) return [RES(false, 'Der Servo bewegt sich nicht (attach oder write fehlt).')];
      const mn = Math.min(...a), mx = Math.max(...a); let up = 0, down = 0; for (let i = 1; i < a.length; i++) { if (a[i] > a[i - 1]) up++; else if (a[i] < a[i - 1]) down++; }
      return [RES(mx >= 170, 'Größter Winkel: ' + Math.round(mx) + ' Grad (soll 180 erreichen).'), RES(mn <= 10, 'Kleinster Winkel: ' + Math.round(mn) + ' Grad (soll 0 erreichen).'), RES(up > 5 && down > 5, up > 5 && down > 5 ? 'Der Servo fährt hin und zurück.' : 'Der Servo fährt nur in eine Richtung.')]; } },
  { id: 'cf4', lab: 'code', cat: 'Fehlersuche im Code', title: 'Der Servo rührt sich nicht', level: 1,
    start: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  meinServo.write(90);\n}\n\nvoid loop() {\n}\n'),
    solMake: ct(CP_SERVO, CW_SERVO, '#include <Servo.h>\n\nServo meinServo;\n\nvoid setup() {\n  meinServo.attach(9);\n  meinServo.write(90);\n}\n\nvoid loop() {\n}\n'),
    text: 'Der Servo soll auf 90 Grad fahren, bleibt aber ruhig. Das Programm ist formal richtig. Finde heraus, was fehlt.',
    hint: 'Der Servo muss erst mit einem Pin verbunden werden: meinServo.attach(9).',
    check() { const R = codeEval({ T: 1.5 }); if (R.err) return codeFail(R); const a = R.samples[R.samples.length - 1].servo[9];
      return [RES(a != null, a != null ? 'Der Servo ist an Pin 9 angeschlossen.' : 'Der Servo ist nicht an Pin 9 angeschlossen (attach fehlt).'), RES(a != null && Math.abs(a - 90) <= 3, a != null ? 'Winkel: ' + Math.round(a) + ' Grad (soll 90).' : 'Kein Winkel eingestellt.')]; } },
  { id: 'cf5', lab: 'code', cat: 'Fehlersuche im Code', title: 'Zählt falsch', level: 2,
    start: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n  for (int i = 0; i < 10; i++) {\n    Serial.println(i);\n  }\n}\n\nvoid loop() {\n}\n'),
    solMake: ct([['UNO', 12, 0]], [], 'void setup() {\n  Serial.begin(9600);\n  for (int i = 1; i <= 10; i++) {\n    Serial.println(i);\n  }\n}\n\nvoid loop() {\n}\n'),
    text: 'Das Programm soll die Zahlen 1 bis 10 ausgeben, zählt aber von 0 bis 9. Finde die zwei Stellen in der for-Schleife, die geändert werden müssen.',
    hint: 'Die Schleife beginnt bei 0 und läuft nur, solange i kleiner als 10 ist. Sie soll bei 1 beginnen und bis einschließlich 10 laufen.',
    check() { const R = codeEval({ T: 2 }); if (R.err) return codeFail(R); const want = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n';
      return [RES(R.ser === want, R.ser === want ? 'Die Zahlen 1 bis 10 stehen richtig im Serial-Monitor.' : 'Ausgabe stimmt nicht. Erhalten: ' + JSON.stringify(R.ser.slice(0, 40)))]; } },
  /* ---- Prüfungspraxis (Arduino-Lab), angelehnt an die praktischen Prüfungsteile ---- */
  { id: 'cp1', lab: 'code', cat: 'Prüfungspraxis', title: 'Countdown mit Warnton', level: 2,
    start: ct(CP_COUNT, CW_COUNT, 'void setup() {\n  pinMode(2, INPUT_PULLUP);   // Taster gegen Masse\n  pinMode(13, OUTPUT);        // LED: Countdown läuft\n  pinMode(8, OUTPUT);         // Lautsprecher\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // Hier: Nach einem Tastendruck 10 Sekunden herunterzählen\n}\n'),
    solMake: ct(CP_COUNT, CW_COUNT, 'void setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(13, OUTPUT);\n  pinMode(8, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    digitalWrite(13, HIGH);\n    for (int s = 10; s >= 0; s--) {\n      Serial.println(s);\n      if (s >= 1 && s <= 3) {\n        tone(8, 1000, 100);\n      }\n      if (s == 0) {\n        tone(8, 1000, 1000);\n      }\n      delay(1000);\n    }\n    digitalWrite(13, LOW);\n  }\n}\n'),
    text: 'Nach einem Tastendruck (Pin 2, gegen Masse) soll ein Countdown von 10 Sekunden laufen: Die LED an Pin 13 leuchtet während des Countdowns, und im Serial-Monitor erscheint jede Sekunde die Zahl 10, 9, … bis 0. Bei 3, 2 und 1 piept der Lautsprecher (Pin 8) einmal kurz (etwa 100 ms), bei 0 ertönt ein Dauerton von einer Sekunde. Danach geht die LED aus und das Programm wartet auf den nächsten Tastendruck.',
    hint: 'Mit einer for-Schleife von 10 bis 0 zählen (s--). Serial.println(s) gibt die Zahl aus, tone(8, 1000, 100) piept 100 ms, delay(1000) wartet eine Sekunde. Die if-Bedingung für 1 bis 3 lautet: s >= 1 && s <= 3.',
    check() { const pb = sch.parts.find(p => p.k === 'PB'), L = theLed(); if (!pb || !L) return [RES(false, 'Taster oder LED fehlt.')];
      const R = codeEval({ T: 14, script: [{ t: 0.4, press: [pb.id] }, { t: 0.7, press: [] }] }); if (R.err) return codeFail(R);
      const nums = serLines(R).map(Number), ok = nums.length === 11 && nums.every((v, i) => v === 10 - i);
      let beeps = 0, prev = false; R.samples.forEach(x => { if (x.t > 6.5 && x.t < 10.3) { const on = !!x.tone[8]; if (on && !prev) beeps++; prev = on; } });
      const l0 = ledMA(sampleAt(R, 0.2), L.id) > 2, l1 = ledMA(sampleAt(R, 5), L.id) > 2, l2 = ledMA(sampleAt(R, 13.5), L.id) > 2, longTone = !!sampleAt(R, 10.9).tone[8], quiet = !sampleAt(R, 3).tone[8];
      return [RES(ok, ok ? 'Die Zahlen 10 bis 0 stehen in der richtigen Reihenfolge im Serial-Monitor.' : 'Serial-Monitor: erwartet die Zahlen 10 bis 0, je eine pro Zeile (erhalten: ' + JSON.stringify(R.ser.slice(0, 40)) + ').'),
        RES(!l0, 'Vor dem Tastendruck ist die LED ' + (l0 ? 'an, soll aber aus sein' : 'aus') + '.'), RES(l1, 'Während des Countdowns ist die LED ' + (l1 ? 'an' : 'aus, soll aber an sein') + '.'), RES(!l2, 'Nach dem Countdown ist die LED ' + (l2 ? 'noch an, soll aber aus sein' : 'aus') + '.'),
        RES(beeps === 3, 'Bei 3, 2 und 1 piept es ' + beeps + '× (erwartet: 3×).'), RES(longTone, 'Bei 0 ertönt ein Dauerton: ' + (longTone ? 'ja' : 'nein')), RES(quiet, 'Zu Beginn ist der Lautsprecher ' + (quiet ? 'still' : 'nicht still')) ]; } },
  { id: 'cp2', lab: 'code', cat: 'Prüfungspraxis', title: 'Luftampel mit Poti', level: 2,
    start: ct(CP_LUFT, CW_LUFT, 'void setup() {\n  pinMode(3, OUTPUT);   // rot\n  pinMode(5, OUTPUT);   // gelb\n  pinMode(7, OUTPUT);   // grün\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int prozent = map(analogRead(A0), 0, 1023, 0, 100);\n  // Hier: passende LED einschalten, Prozentwert ausgeben\n}\n'),
    solMake: ct(CP_LUFT, CW_LUFT, 'void setup() {\n  pinMode(3, OUTPUT);\n  pinMode(5, OUTPUT);\n  pinMode(7, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int prozent = map(analogRead(A0), 0, 1023, 0, 100);\n  digitalWrite(3, prozent > 70);\n  digitalWrite(5, prozent >= 30 && prozent <= 70);\n  digitalWrite(7, prozent < 30);\n  Serial.println(prozent);\n  delay(500);\n}\n'),
    text: 'Das Poti an A0 simuliert die Luftbelastung in einem Tunnel (0 bis 1023 entspricht 0 bis 100 %). Unter 30 % soll die grüne LED (Pin 7) leuchten, von 30 bis 70 % die gelbe (Pin 5), über 70 % die rote (Pin 3). Es darf immer nur eine LED leuchten. Gib außerdem alle halbe Sekunde den Prozentwert als ganze Zahl im Serial-Monitor aus. Verstelle das Poti mit dem Regler unter dem Bauteil.',
    hint: 'map(wert, 0, 1023, 0, 100) rechnet den Messwert in Prozent um. digitalWrite(pin, bedingung) schaltet den Pin je nach Ergebnis des Vergleichs. Die Grenzen sind 30 und 70.',
    check() { const P = sch.parts.find(p => p.k === 'POT'), leds = sch.parts.filter(p => p.k === 'LED').sort(byPos); if (!P || leds.length < 3) return [RES(false, 'Poti oder drei LEDs fehlen.')];
      const out = [], cases = [[0.9, 10, 2, 'unter 30 % (etwa 10 %)', 'grün'], [0.5, 50, 1, 'von 30 bis 70 % (etwa 50 %)', 'gelb'], [0.1, 90, 0, 'über 70 % (etwa 90 %)', 'rot']];
      for (const [pos, pc, want, label, color] of cases) {
        const R = codeEval({ T: 1.3, pos: { [P.id]: pos } }); if (R.err) return codeFail(R);
        const sm = sampleAt(R, 1.25), on = leds.map(l => ledMA(sm, l.id) > 2), ok = on.filter(Boolean).length === 1 && on[want], nums = serLines(R).map(Number).filter(n => !isNaN(n)), last = nums[nums.length - 1];
        out.push(RES(ok, 'Belastung ' + label + ': ' + (ok ? 'nur die ' + color + 'e LED leuchtet' : 'es soll nur die ' + color + 'e LED leuchten (an: ' + on.map((b, i) => b ? ['rot', 'gelb', 'grün'][i] : '').filter(Boolean).join(', ') + ')') + '.'));
        out.push(RES(nums.length >= 2 && Math.abs(last - pc) <= 6, 'Serial-Monitor: ' + (nums.length >= 2 && Math.abs(last - pc) <= 6 ? 'der Prozentwert stimmt (' + last + ' %)' : 'der Prozentwert fehlt oder stimmt nicht (erwartet etwa ' + pc + ' %, ' + nums.length + ' Werte erhalten)') + '.'));
      }
      return out; } },
  { id: 'cp3', lab: 'code', cat: 'Prüfungspraxis', title: 'Heizstufen mit entprelltem Taster', level: 3,
    start: ct(CP_STUFE, CW_STUFE, 'int stufe = 0;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(3, OUTPUT);\n  pinMode(5, OUTPUT);\n  pinMode(7, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  // Hier: Tastendruck erkennen, Stufe erhöhen (0 bis 3), LEDs setzen, "Stufe n" ausgeben\n}\n'),
    solMake: ct(CP_STUFE, CW_STUFE, 'int stufe = 0;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  pinMode(3, OUTPUT);\n  pinMode(5, OUTPUT);\n  pinMode(7, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    delay(50);\n    stufe = (stufe + 1) % 4;\n    digitalWrite(3, stufe >= 1);\n    digitalWrite(5, stufe >= 2);\n    digitalWrite(7, stufe >= 3);\n    Serial.print("Stufe ");\n    Serial.println(stufe);\n    while (digitalRead(2) == LOW) {\n    }\n    delay(50);\n  }\n}\n'),
    text: 'Drei LEDs (Pin 3, 5, 7) zeigen die Heizstufe. Jeder Tastendruck (Pin 2) schaltet eine Stufe weiter: Stufe 1 = eine LED, Stufe 2 = zwei LEDs, Stufe 3 = drei LEDs, dann Stufe 0 = alle aus, danach wieder Stufe 1. Gib bei jedem Tastendruck „Stufe n“ im Serial-Monitor aus. Der Taster prellt: Ein Druck darf nur eine Stufe weiterschalten, auch wenn der Kontakt mehrfach schnell schließt.',
    hint: 'Merke dir die Stufe in einer Variablen und erhöhe sie mit (stufe + 1) % 4. Nach dem ersten LOW wartest du etwa 50 ms (delay), schaltest weiter und wartest, bis der Taster losgelassen ist (while-Schleife), damit das Prellen nicht zählt.',
    check() { const pb = sch.parts.find(p => p.k === 'PB'), leds = sch.parts.filter(p => p.k === 'LED').sort(byPos); if (!pb || leds.length < 3) return [RES(false, 'Taster oder drei LEDs fehlen.')];
      const script = []; [0.3, 0.9, 1.5, 2.1, 2.7].forEach(t => bounceScript(pb.id, t, t + 0.2).forEach(x => script.push(x)));
      const R = codeEval({ T: 3.6, script }); if (R.err) return codeFail(R);
      const want = ['Stufe 1', 'Stufe 2', 'Stufe 3', 'Stufe 0', 'Stufe 1'], got = serLines(R), okSer = got.length === 5 && want.every((w, i) => got[i] === w);
      const checks = [[0.75, 1], [1.35, 2], [1.95, 3], [2.55, 0], [3.3, 1]], out = [RES(okSer, okSer ? 'Der Serial-Monitor zeigt Stufe 1, 2, 3, 0, 1 (ein Druck = eine Stufe, trotz Prellen).' : 'Serial-Monitor: erwartet 5 Zeilen Stufe 1, 2, 3, 0, 1, erhalten ' + got.length + ': ' + JSON.stringify(got.join(' | ').slice(0, 60)) + '. Zählt das Prellen mit?')];
      checks.forEach(([t, n], i) => { const sm = sampleAt(R, t), on = leds.map(l => ledMA(sm, l.id) > 2), cnt = on.filter(Boolean).length, ord = on.every((b, k) => b === (k < n)); out.push(RES(cnt === n && ord, 'Nach Druck ' + (i + 1) + ' leuchten ' + cnt + ' LED(s)' + (cnt === n && ord ? '.' : ', erwartet ' + n + ' (von Pin 3 an aufwärts).'))); });
      return out; } },
  { id: 'cp4', lab: 'code', cat: 'Prüfungspraxis', title: 'Fehlersuche: Würfel ohne Wiederholung', level: 3,
    start: ct(CP_DICE, CW_DICE, 'int letzter = 0;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    int wurf = random(1, 6);\n    Serial.println(wurf);\n    letzter = wurf;\n  }\n}\n'),
    solMake: ct(CP_DICE, CW_DICE, 'int letzter = 0;\n\nvoid setup() {\n  pinMode(2, INPUT_PULLUP);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  if (digitalRead(2) == LOW) {\n    delay(30);\n    int wurf = random(1, 7);\n    while (wurf == letzter) {\n      wurf = random(1, 7);\n    }\n    Serial.println(wurf);\n    letzter = wurf;\n    while (digitalRead(2) == LOW) {\n    }\n    delay(30);\n  }\n}\n'),
    text: 'Der Sketch soll bei jedem Tastendruck eine Zahl von 1 bis 6 würfeln und im Serial-Monitor ausgeben. Zwei gleiche Zahlen hintereinander sind nicht erlaubt, und pro Tastendruck darf genau eine Zahl kommen (auch wenn der Taster prellt oder gedrückt bleibt). Der Sketch enthält drei Fehler: Finde und behebe sie.',
    hint: 'Fehler 1: random(1, 6) liefert nur 1 bis 5 (die obere Grenze zählt nicht mit). Fehler 2: Es wird nie geprüft, ob der Wurf gleich dem letzten ist (while-Schleife). Fehler 3: Der Taster wird nicht entprellt und nicht auf Loslassen gewartet, deshalb kommen mehrere Zahlen pro Druck.',
    check() { const pb = sch.parts.find(p => p.k === 'PB'); if (!pb) return [RES(false, 'Der Taster fehlt.')];
      const script = []; for (let i = 0; i < 40; i++) bounceScript(pb.id, 0.2 + 0.3 * i, 0.2 + 0.3 * i + 0.12).forEach(x => script.push(x));
      const R = codeEval({ T: 12.4, script }); if (R.err) return codeFail(R);
      const nums = serLines(R).map(Number), valid = nums.every(n => n >= 1 && n <= 6), rep = nums.some((n, i) => i > 0 && n === nums[i - 1]);
      return [RES(nums.length === 40, 'Bei 40 Tastendrücken kamen ' + nums.length + ' Zahlen (erwartet: genau 40, eine je Druck).'), RES(valid && nums.length > 0, valid && nums.length > 0 ? 'Alle Zahlen liegen zwischen 1 und 6.' : 'Es kommen Zahlen außerhalb von 1 bis 6 vor oder gar keine.'), RES(nums.includes(6), nums.includes(6) ? 'Die Zahl 6 kommt vor.' : 'Die Zahl 6 kam nie vor: Die obere Grenze von random() zählt nicht mit.'), RES(nums.length > 1 && !rep, rep ? 'Zwei gleiche Zahlen kamen hintereinander.' : 'Keine zwei gleichen Zahlen hintereinander.')]; } },
];

/* ---- Pi-Lab: Python-Programm im Hintergrund ausführen und beobachten ---- */
function piEval(o) {
  o = o || {};
  const E = simEval({ set: o.set }), c = E.c, s = E.s, el = c.mcu, res = { E, out: '', err: null, samples: [] };
  const PY = window.PyRun; if (!el || !PY) { res.err = 'Kein Raspberry Pi in der Schaltung.'; return res; }
  const m = el.mcu;
  if (o.pos) Object.keys(o.pos).forEach(id => { const w = E.wm.get(+id); if (w) { w.pos = o.pos[id]; w.light = o.pos[id]; } });
  const comp = PY.compile(o.code != null ? o.code : (sch.code || ''));
  if (!comp.ok) { res.err = 'Fehler in Zeile ' + comp.errors[0].line + ': ' + comp.errors[0].msg; return res; }
  const io = makeIOPi(el, { sim: s, circ: c, print: t => { res.out += t; } });
  const runner = PY.createRunner(comp.program, io); runner.start();
  const dt = 5e-5, n = Math.round((o.T || 2) / dt), script = (o.script || []).slice().sort((a, b) => a.t - b.t); let si = 0;
  const leds = c.elems.filter(e => e.led && e.part);
  for (let i = 0; i < n; i++) {
    s.step(dt); const t = s.t;
    while (si < script.length && t >= script[si].t) { const st = script[si++]; E.wm.forEach((w, id) => { w.pressed = !!(st.press && st.press.includes(id)); }); }
    runner.step(t); if (runner.error) { res.err = 'Fehler in Zeile ' + runner.error.line + ': ' + runner.error.type + (runner.error.msg ? ': ' + runner.error.msg : ''); break; }
    while (s.events.length) E.ev.push(s.events.shift());
    if (i % 20 === 0) res.samples.push({ t, lv: m.level.slice(), duty: m.duty.slice(), tone: m.tone.map(x => x && x.f), servo: Object.assign({}, m.servo), led: leds.map(e => [e.part.id, (e.iav || 0) * 1000]) });
  }
  res.m = m; return res;
}
const PC_LED17 = [['PI', 12, 0], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], PW_LED17 = [[12, 10, 10, 10]];
const PC_BTN = [['PI', 12, 0], ['PB', 8, 2, 1, ''], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], PW_BTN = [[12, 10, 10, 10], [8, 2, 12, 2], [8, 6, 8, 8, 12, 8]];
const PC_AMP = [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16], ['R', 22, 22, 0, '220'], ['LED', 26, 22, 0, 'grün'], ['GND', 30, 22]], PW_AMP = [[20, 10, 22, 10], [20, 16, 22, 16], [20, 22, 22, 22]];
const PC_BUZZ = [['PI', 12, 0], ['R', 22, 14, 0, '220'], ['SPK', 26, 14, 0, '8'], ['GND', 30, 14]], PW_BUZZ = [[20, 14, 22, 14]];
const PC_PWM = [['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'gelb'], ['GND', 30, 10]], PW_PWM = [[20, 10, 22, 10]];
const PC_SERVO = [['PI', 12, 0], ['SERVO', 24, 14], ['GND', 24, 18]], PW_SERVO = [[20, 14, 24, 14], [24, 16, 26, 16, 26, 0, 20, 0]];
const PC_ULT = [['PI', 12, 0], ['HCSR04', 30, 10, 0, '', { pos: 0.5 }], ['R', 22, 16, 0, '1k'], ['R', 22, 18, 1, '2k'], ['GND', 22, 22], ['GND', 30, 16], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], PW_ULT = [[30, 10, 26, 10, 26, 0, 20, 0], [20, 14, 24, 14, 24, 12, 30, 12], [20, 16, 22, 16], [22, 16, 22, 18], [30, 14, 28, 14, 28, 16, 26, 16], [12, 10, 10, 10]];
const PC_ULT_BAD = [['PI', 12, 0], ['HCSR04', 30, 10, 0, '', { pos: 0.246 }], ['GND', 30, 16]], PW_ULT_BAD = [[30, 10, 26, 10, 26, 0, 20, 0], [20, 14, 24, 14, 24, 12, 30, 12], [30, 14, 28, 14, 28, 16, 20, 16]];
const PC_ULT_OK = [['PI', 12, 0], ['HCSR04', 30, 10, 0, '', { pos: 0.246 }], ['R', 22, 16, 0, '1k'], ['R', 22, 18, 1, '2k'], ['GND', 22, 22], ['GND', 30, 16]], PW_ULT_OK = [[30, 10, 26, 10, 26, 0, 20, 0], [20, 14, 24, 14, 24, 12, 30, 12], [20, 16, 22, 16], [22, 16, 22, 18], [30, 14, 28, 14, 28, 16, 26, 16]];
const MCP_SPI_W = [[28, 8, 26, 8, 26, 6, 26, -2, 26, -4, 10, -4, 10, 0, 12, 0], [28, 6, 26, 6], [20, 14, 28, 14], [20, 16, 28, 16], [28, 18, 24, 18, 24, 20, 20, 20], [20, 12, 26, 12, 28, 12], [28, 10, 26, 10, 26, 12]], MCP_CS_W = [[28, 20, 26, 20, 26, 22, 20, 22]];
const PC_MCP_POT = [['PI', 12, 0], ['MCP3008', 28, 6], ['POT', 40, 6, 1, '10k', { pos: 0.4 }], ['GND', 40, 10]], POTW = [[40, 6, 40, -2, 26, -2], [42, 8, 44, 8, 44, 4, 36, 4, 36, 6, 34, 6]];
const PW_MCP_POT = MCP_SPI_W.concat(MCP_CS_W, POTW), PW_MCP_POT_NOCS = MCP_SPI_W.concat(POTW);
const PC_MCP_LDR = [['PI', 12, 0], ['MCP3008', 28, 6], ['LDR', 40, 6, 1, '', { pos: 0.5 }], ['R', 40, 10, 1, '10k'], ['GND', 40, 14], ['R', 10, 10, 2, '220'], ['LED', 6, 10, 2, 'rot'], ['GND', 2, 10]], PW_MCP_LDR = MCP_SPI_W.concat(MCP_CS_W, [[40, 6, 40, -2, 26, -2], [40, 10, 38, 10, 38, 6, 34, 6], [12, 10, 10, 10]]);
const PC_MCP_TMP = [['PI', 12, 0], ['MCP3008', 28, 6], ['TMP36', 44, 8, 2, '', { pos: 0.394 }], ['GND', 40, 4]], PW_MCP_TMP = MCP_SPI_W.concat(MCP_CS_W, [[40, 8, 38, 8, 38, -2, 26, -2], [40, 6, 34, 6]]);
const pct = (parts, wires, code) => () => ({ parts, wires, scopes: [], tempo: 0.75, code });
const PYH = 'from gpiozero import LED, Button\nfrom time import sleep\nfrom signal import pause\n';
function chkPiBlink(n) {
  const L = theLed(); if (!L) return [RES(false, 'Keine LED vorhanden.')];
  const R = piEval({ T: 6 }); if (R.err) return codeFail(R); const e = risingEdges(R, 17), sh = dutyShare(R, 17), burn = burnTxt(R.E);
  return [RES(e >= n, e >= n ? 'Die LED blinkt (' + e + '× in 6 s).' : 'Die LED blinkt nicht oft genug (' + e + '× in 6 s, mindestens ' + n + '). Hängt sie wirklich an GPIO17?'), RES(sh > 0.15 && sh < 0.85, 'Die LED ist ' + Math.round(sh * 100) + ' % der Zeit an.'), RES(!burn.length, burn.length ? burn[0] : 'Pin und LED bleiben heil.')];
}
function chkPiTaster() {
  const L = theLed(), pb = sch.parts.find(p => p.k === 'PB'); if (!L || !pb) return [RES(false, 'LED oder Taster fehlt.')];
  const R = piEval({ T: 1.2, script: [{ t: 0.4, press: [pb.id] }, { t: 0.8, press: [] }] }); if (R.err) return codeFail(R);
  const a = ledMA(sampleAt(R, 0.3), L.id) > 2, b = ledMA(sampleAt(R, 0.7), L.id) > 2, c2 = ledMA(sampleAt(R, 1.1), L.id) > 2;
  return [RES(!a, 'Taster nicht gedrückt: LED ist ' + (a ? 'an, soll aber aus sein' : 'aus') + '.'), RES(b, 'Taster gedrückt: LED ist ' + (b ? 'an' : 'aus, soll aber an sein') + '.'), RES(!c2, 'Taster losgelassen: LED ist ' + (c2 ? 'an, soll aber aus sein' : 'aus') + '.')];
}
const PI_TASKS = [
  { id: 'p1', lab: 'pi', cat: 'Grundlagen', title: 'Dreimal blinken', level: 1,
    start: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(17)\n\n# Hier: die LED dreimal blinken lassen (je 0,3 Sekunden an und aus)\n'),
    solMake: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(17)\n\nfor i in range(3):\n    led.on()\n    sleep(0.3)\n    led.off()\n    sleep(0.3)\n'),
    text: 'Die LED hängt an GPIO17. Sie soll nach dem Start genau dreimal blinken (je etwa 0,3 Sekunden an und aus) und danach aus bleiben.',
    hint: 'Eine for-Schleife wiederholt Anweisungen: for i in range(3): … (Doppelpunkt und Einrückung nicht vergessen).',
    check() { const L = theLed(); if (!L) return [RES(false, 'Keine LED vorhanden.')]; const R = piEval({ T: 6 }); if (R.err) return codeFail(R); const e = risingEdges(R, 17), last = R.samples[R.samples.length - 1].lv[17], burn = burnTxt(R.E);
      return [RES(e === 3, 'Die LED blinkt ' + e + '× (soll genau 3×).'), RES(!last, last ? 'Am Ende leuchtet die LED noch, sie soll aus sein.' : 'Nach dem Blinken bleibt die LED aus.'), RES(!burn.length, burn.length ? burn[0] : 'Pin und LED bleiben heil.')]; } },
  { id: 'p2', lab: 'pi', cat: 'Grundlagen', title: 'Taster schaltet die LED', level: 1,
    start: pct(PC_BTN, PW_BTN, PYH + '\nled = LED(17)\ntaster = Button(2)    # Taster zwischen GPIO2 und Masse\n\n# Hier: LED an, solange der Taster gedrückt ist\n\npause()\n'),
    solMake: pct(PC_BTN, PW_BTN, PYH + '\nled = LED(17)\ntaster = Button(2)\n\ntaster.when_pressed = led.on\ntaster.when_released = led.off\n\npause()\n'),
    text: 'Die LED (GPIO17) soll genau dann leuchten, wenn der Taster (GPIO2) gedrückt ist. Du kannst Rückrufe (when_pressed) oder eine Schleife mit is_pressed nutzen.',
    hint: 'taster.when_pressed = led.on und taster.when_released = led.off. Danach pause(), damit das Programm weiterläuft. Ohne Klammern: led.on ist die Funktion selbst.',
    check: chkPiTaster },
  { id: 'p3', lab: 'pi', cat: 'Grundlagen', title: 'Hallo im Terminal', level: 1,
    start: pct([['PI', 12, 0]], [], 'from time import sleep\n\nwhile True:\n    # Hier: jede Sekunde "Hallo Azubi" ausgeben\n    sleep(1)\n'),
    solMake: pct([['PI', 12, 0]], [], 'from time import sleep\n\nwhile True:\n    print("Hallo Azubi")\n    sleep(1)\n'),
    text: 'Gib im Terminal jede Sekunde die Zeile „Hallo Azubi“ aus.',
    hint: 'print("Hallo Azubi") schreibt eine Zeile. sleep(1) wartet eine Sekunde.',
    check() { const R = piEval({ T: 3.6 }); if (R.err) return codeFail(R); const lines = R.out.split('\n').filter(x => x.length), ok = lines.length > 0 && lines.every(x => x.trim() === 'Hallo Azubi');
      return [RES(lines.length >= 3 && lines.length <= 4, 'In 3,6 s kamen ' + lines.length + ' Zeilen an (erwartet: 3 bis 4).'), RES(ok, ok ? 'Der Text stimmt.' : 'Der Text stimmt nicht. Erwartet: Hallo Azubi')]; } },
  { id: 'p4', lab: 'pi', cat: 'Grundlagen', title: 'Ampel', level: 2,
    start: pct(PC_AMP, PW_AMP, 'from gpiozero import TrafficLights\nfrom time import sleep\n\nampel = TrafficLights(18, 24, 8)    # rot, gelb, grün\n\nwhile True:\n    # Hier: rot (3 s), grün (3 s), gelb (1 s), immer wieder\n    sleep(1)\n'),
    solMake: pct(PC_AMP, PW_AMP, 'from gpiozero import TrafficLights\nfrom time import sleep\n\nampel = TrafficLights(18, 24, 8)\n\nwhile True:\n    ampel.red.on()\n    sleep(3)\n    ampel.red.off()\n    ampel.green.on()\n    sleep(3)\n    ampel.green.off()\n    ampel.amber.on()\n    sleep(1)\n    ampel.amber.off()\n'),
    text: 'Drei LEDs bilden eine Ampel (rot GPIO18, gelb GPIO24, grün GPIO8). Schalte nacheinander rot, grün und gelb ein, jede Farbe einige Sekunden, und das immer wieder. Es soll nie rot und grün gleichzeitig leuchten.',
    hint: 'ampel.red.on() schaltet rot ein, ampel.red.off() aus. Eine while True-Schleife wiederholt alles.',
    check() { const R = piEval({ T: 12 }); if (R.err) return codeFail(R); const seen = new Set(); let bad = 0; R.samples.forEach(x => { const v = [18, 24, 8].map(g => x.lv[g]).join(''); seen.add(v); if (v === '101' || v === '011' || v === '111') bad++; });
      const r = seen.has('100'), g = seen.has('001'), a = seen.has('010') || seen.has('110');
      return [RES(r, r ? 'Rot leuchtet.' : 'Rot leuchtet nie.'), RES(g, g ? 'Grün leuchtet.' : 'Grün leuchtet nie.'), RES(a, a ? 'Gelb leuchtet.' : 'Gelb leuchtet nie.'), RES(bad === 0, bad === 0 ? 'Rot und Grün leuchten nie gleichzeitig.' : 'Zeitweise leuchten Rot und Grün zusammen.')]; } },
  { id: 'p5', lab: 'pi', cat: 'Sensoren und Töne', title: 'Summer piept', level: 1,
    start: pct(PC_BUZZ, PW_BUZZ, 'from gpiozero import Buzzer\nfrom time import sleep\n\nsummer = Buzzer(23)\n\nwhile True:\n    # Hier: den Summer immer wieder kurz piepen lassen\n    sleep(1)\n'),
    solMake: pct(PC_BUZZ, PW_BUZZ, 'from gpiozero import Buzzer\nfrom time import sleep\n\nsummer = Buzzer(23)\n\nwhile True:\n    summer.on()\n    sleep(0.2)\n    summer.off()\n    sleep(0.8)\n'),
    text: 'Der Summer hängt an GPIO23. Er soll immer wieder kurz piepen (etwa 0,2 Sekunden an, dann Pause).',
    hint: 'summer.on() schaltet ein, summer.off() aus. Oder einfacher: summer.beep(0.2, 0.8) gefolgt von pause().',
    check() { const R = piEval({ T: 3 }); if (R.err) return codeFail(R); const e = risingEdges(R, 23), sh = dutyShare(R, 23);
      return [RES(e >= 3, e >= 3 ? 'Der Summer piept (' + e + '× in 3 s).' : 'Zu wenige Pieptöne (' + e + ' in 3 s, mindestens 3).'), RES(sh > 0.05 && sh < 0.7, 'Der Summer ist ' + Math.round(sh * 100) + ' % der Zeit an (er soll kurz piepen, nicht dauern).')]; } },
  { id: 'p6', lab: 'pi', cat: 'Sensoren und Töne', title: 'LED pulsiert', level: 2,
    start: pct(PC_PWM, PW_PWM, 'from gpiozero import PWMLED\nfrom time import sleep\n\nled = PWMLED(18)\n\n# Hier: die LED langsam heller und wieder dunkler werden lassen\nsleep(1)\n'),
    solMake: pct(PC_PWM, PW_PWM, 'from gpiozero import PWMLED\nfrom time import sleep\n\nled = PWMLED(18)\n\nwhile True:\n    for i in range(0, 101, 5):\n        led.value = i / 100\n        sleep(0.05)\n    for i in range(100, -1, -5):\n        led.value = i / 100\n        sleep(0.05)\n'),
    text: 'Die gelbe LED hängt an GPIO18. Sie soll mit PWM langsam von dunkel bis hell und wieder zurück pulsieren. PWMLED nimmt Werte von 0.0 bis 1.0.',
    hint: 'led.value = 0.5 ist halbe Helligkeit. In einer Schleife von 0 bis 100 geteilt durch 100 bekommst du alle Zwischenwerte.',
    check() { const R = piEval({ T: 5 }); if (R.err) return codeFail(R); const v = R.samples.map(x => (x.duty[18] != null ? x.duty[18] : (x.lv[18] ? 1 : 0))); const mn = Math.min(...v), mx = Math.max(...v), steps = new Set(v.map(x => Math.round(x * 10))).size;
      return [RES(mx >= 0.85, 'Hellster Wert: ' + Math.round(mx * 100) + ' % (soll bis fast 100 % gehen).'), RES(mn <= 0.15, 'Dunkelster Wert: ' + Math.round(mn * 100) + ' % (soll bis fast 0 % gehen).'), RES(steps >= 6, steps >= 6 ? 'Die Helligkeit ändert sich stufenweise.' : 'Die LED springt nur zwischen wenigen Helligkeiten.')]; } },
  { id: 'p7', lab: 'pi', cat: 'Sensoren und Töne', title: 'Abstandswarner', level: 3,
    start: pct(PC_ULT, PW_ULT, 'from gpiozero import DistanceSensor, LED\nfrom time import sleep\n\nsensor = DistanceSensor(echo=24, trigger=23, max_distance=2)\nled = LED(17)\n\nwhile True:\n    cm = sensor.distance * 100      # distance ist in Metern\n    # Hier: LED an, wenn das Hindernis näher als 50 cm ist, sonst aus\n    sleep(0.1)\n'),
    solMake: pct(PC_ULT, PW_ULT, 'from gpiozero import DistanceSensor, LED\nfrom time import sleep\n\nsensor = DistanceSensor(echo=24, trigger=23, max_distance=2)\nled = LED(17)\n\nwhile True:\n    cm = sensor.distance * 100\n    if cm < 50:\n        led.on()\n    else:\n        led.off()\n    sleep(0.1)\n'),
    text: 'Der Ultraschallsensor misst den Abstand (Echo-Pin über Spannungsteiler an GPIO24, Trigger an GPIO23). Die LED an GPIO17 soll leuchten, wenn ein Hindernis näher als 50 cm ist, sonst aus sein. Den Abstand stellst du mit dem Regler am Sensor ein.',
    hint: 'Die Variable cm enthält den Abstand schon in Zentimetern. Vergleiche sie mit 50 und schalte die LED mit led.on() oder led.off().',
    check() { const L = theLed(), U = sch.parts.find(p => p.k === 'HCSR04'); if (!L || !U) return [RES(false, 'LED oder Ultraschallsensor fehlt.')];
      const near = piEval({ T: 1.2, pos: { [U.id]: 0.045 } }), far = piEval({ T: 1.2, pos: { [U.id]: 0.4 } }); if (near.err) return codeFail(near);
      const a = ledMA(sampleAt(near, 1.15), L.id) > 2, b = ledMA(sampleAt(far, 1.15), L.id) > 2;
      return [RES(a, 'Hindernis bei etwa 20 cm: LED ist ' + (a ? 'an' : 'aus, soll aber an sein') + '.'), RES(!b, 'Hindernis bei etwa 160 cm: LED ist ' + (b ? 'an, soll aber aus sein' : 'aus') + '.')]; } },
  { id: 'p8', lab: 'pi', cat: 'Grundlagen', title: 'Tastendrücke zählen', level: 3,
    start: pct(PC_BTN, PW_BTN, 'from gpiozero import Button\nfrom signal import pause\n\ntaster = Button(2)\nanzahl = 0\n\ndef gedrueckt():\n    # Hier: hochzählen und "Anzahl: 1", "Anzahl: 2" ... ausgeben\n    pass\n\ntaster.when_pressed = gedrueckt\npause()\n'),
    solMake: pct(PC_BTN, PW_BTN, 'from gpiozero import Button\nfrom signal import pause\n\ntaster = Button(2)\nanzahl = 0\n\ndef gedrueckt():\n    global anzahl\n    anzahl += 1\n    print("Anzahl:", anzahl)\n\ntaster.when_pressed = gedrueckt\npause()\n'),
    text: 'Zähle die Tastendrücke an GPIO2. Bei jedem neuen Druck soll im Terminal „Anzahl: 1“, „Anzahl: 2“ und so weiter stehen. Gehalten zählt nur als ein Druck (when_pressed löst nur einmal aus).',
    hint: 'In der Funktion muss die Variable mit global anzahl als global markiert werden, sonst ist sie nur lokal.',
    check() { const pb = sch.parts.find(p => p.k === 'PB'); if (!pb) return [RES(false, 'Der Taster fehlt.')]; const id = pb.id;
      const R = piEval({ T: 2, script: [{ t: 0.3, press: [id] }, { t: 0.5, press: [] }, { t: 0.8, press: [id] }, { t: 1.0, press: [] }, { t: 1.3, press: [id] }, { t: 1.5, press: [] }] }); if (R.err) return codeFail(R);
      const lines = R.out.split('\n').map(x => x.trim()).filter(Boolean), want = ['Anzahl: 1', 'Anzahl: 2', 'Anzahl: 3'], ok = lines.length === 3 && want.every((w, i) => lines[i] === w);
      return [RES(ok, ok ? 'Drei Tastendrücke ergeben „Anzahl: 1“, „Anzahl: 2“, „Anzahl: 3“.' : 'Erwartet bei drei Tastendrücken: Anzahl: 1, Anzahl: 2, Anzahl: 3. Erhalten: ' + JSON.stringify(lines.slice(0, 6)))]; } },
  { id: 'p9', lab: 'pi', cat: 'Sensoren und Töne', title: 'Servo auf 90 Grad', level: 1,
    start: pct(PC_SERVO, PW_SERVO, 'from gpiozero import AngularServo\nfrom time import sleep\n\nservo = AngularServo(23, min_angle=0, max_angle=180)\n\n# Hier: den Servo auf 90 Grad stellen\nsleep(1)\n'),
    solMake: pct(PC_SERVO, PW_SERVO, 'from gpiozero import AngularServo\nfrom time import sleep\n\nservo = AngularServo(23, min_angle=0, max_angle=180)\n\nservo.angle = 90\nsleep(1)\n'),
    text: 'Der Servo hängt an GPIO23 (Signal), die rote Leitung an 5 V. Stelle ihn auf 90 Grad.',
    hint: 'servo.angle = 90 stellt den Winkel ein.',
    check() { const R = piEval({ T: 1.5 }); if (R.err) return codeFail(R); const a = R.samples[R.samples.length - 1].servo[23];
      return [RES(a != null, a != null ? 'Der Servo bekommt ein Signal an GPIO23.' : 'Der Servo bekommt kein Signal (angle oder value setzen).'), RES(a != null && Math.abs(a - 90) <= 3, a != null ? 'Winkel: ' + Math.round(a) + ' Grad (soll 90).' : 'Kein Winkel eingestellt.')]; } },
  { id: 'pf1', lab: 'pi', cat: 'Fehlersuche im Code', title: 'Die LED bleibt dunkel', level: 1,
    start: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(11)          # LED ist an Pin 11 angeschlossen\n\nwhile True:\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n'),
    solMake: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(17)\n\nwhile True:\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n'),
    text: 'Die LED hängt an Pin 11 der Leiste. Das Programm läuft ohne Fehlermeldung, aber die LED bleibt dunkel. Der Fehler liegt nicht an der Schaltung.',
    hint: 'gpiozero zählt nicht mit den Pin-Nummern der Leiste (1 bis 40), sondern mit den GPIO-Nummern. Welche GPIO-Nummer steht an Pin 11? Schau im Plan an die Beschriftung neben dem Anschluss.',
    check: () => chkPiBlink(4) },
  { id: 'pf2', lab: 'pi', cat: 'Fehlersuche im Code', title: 'Fehlermeldung lesen', level: 1,
    start: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(17)\n\nwhile True:\nled.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n'),
    solMake: pct(PC_LED17, PW_LED17, 'from gpiozero import LED\nfrom time import sleep\n\nled = LED(17)\n\nwhile True:\n    led.on()\n    sleep(0.5)\n    led.off()\n    sleep(0.5)\n'),
    text: 'Das Programm lässt sich nicht starten. Starte es mit ▶ Start, lies die Fehlermeldung (mit Zeilennummer!) und behebe den Fehler, so dass die LED blinkt.',
    hint: 'In Python entscheidet die Einrückung, was zu einer Schleife gehört. Alles im Schleifenrumpf muss gleich weit eingerückt sein.',
    check: () => chkPiBlink(4) },
  { id: 'pf3', lab: 'pi', cat: 'Fehlersuche im Code', title: 'Ultraschall zerstört den Pi', level: 3,
    start: pct(PC_ULT_BAD, PW_ULT_BAD, 'from gpiozero import DistanceSensor\nfrom time import sleep\n\nsensor = DistanceSensor(echo=24, trigger=23, max_distance=3)\n\nwhile True:\n    print(round(sensor.distance * 100), "cm")\n    sleep(0.5)\n'),
    solMake: pct(PC_ULT_OK, PW_ULT_OK, 'from gpiozero import DistanceSensor\nfrom time import sleep\n\nsensor = DistanceSensor(echo=24, trigger=23, max_distance=3)\n\nwhile True:\n    print(round(sensor.distance * 100), "cm")\n    sleep(0.5)\n'),
    text: 'Sobald der Ultraschallsensor misst, geht der Raspberry Pi kaputt (Meldung „zerstört“). Das Programm ist in Ordnung, die Schaltung nicht. Baue die fehlende Schutzschaltung am Echo-Pin ein (GPIO24).',
    hint: 'Der Echo-Pin des HC-SR04 liefert 5 V, der GPIO-Pin verträgt nur 3,3 V. Ein Spannungsteiler aus 1 kΩ (vom Echo zum GPIO) und 2 kΩ (vom GPIO nach Masse) macht aus 5 V etwa 3,3 V.',
    check() { const R = piEval({ T: 1.5 }); if (R.err) return codeFail(R); const burn = burnTxt(R.E), lines = R.out.split('\n').filter(x => /cm/.test(x)); const nR = sch.parts.filter(p => p.k === 'R').length;
      return [RES(!burn.length, burn.length ? burn[0] : 'Der Pi bleibt heil.'), RES(nR >= 2, nR >= 2 ? 'Zwei Widerstände bilden den Spannungsteiler.' : 'Für den Spannungsteiler fehlen Widerstände (' + nR + ' von 2).'), RES(lines.length >= 2, lines.length >= 2 ? 'Der Sensor liefert Messwerte.' : 'Es kommen keine Messwerte an.')]; } },
  { id: 'p10', lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', title: 'Poti über den MCP3008 lesen', level: 2,
    start: pct(PC_MCP_POT, PW_MCP_POT, 'from gpiozero import MCP3008\nfrom time import sleep\n\npoti = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    # Hier: den Poti-Wert in Prozent ausgeben, zum Beispiel "Poti: 40 %"\n    sleep(0.5)\n'),
    solMake: pct(PC_MCP_POT, PW_MCP_POT, 'from gpiozero import MCP3008\nfrom time import sleep\n\npoti = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    print("Poti:", round(poti.value * 100), "%")\n    sleep(0.5)\n'),
    text: 'Der Raspberry Pi hat keine analogen Eingänge. Der Wandler MCP3008 misst das Poti an Kanal 0. Gib den Wert in Prozent aus, genau in der Form „Poti: 40 %“. Den Regler stellst du am Poti ein.',
    hint: 'poti.value liefert eine Zahl von 0.0 bis 1.0. Mit 100 malnehmen und mit round() auf eine ganze Zahl runden: print("Poti:", round(poti.value * 100), "%").',
    check() { const P = sch.parts.find(p => p.k === 'POT'); if (!P) return [RES(false, 'Das Poti fehlt.')];
      const a = piEval({ T: 1.2, pos: { [P.id]: 0.1 } }), b = piEval({ T: 1.2, pos: { [P.id]: 0.9 } }); if (a.err) return codeFail(a);
      const val = r => { const m = r.out.trim().split('\n').pop().match(/^Poti: (\d+) %$/); return m ? +m[1] : null; }, x = val(a), y = val(b);
      return [RES(x != null && y != null, x != null && y != null ? 'Die Ausgabe hat das richtige Format.' : 'Erwartet wird eine Zeile wie „Poti: 40 %“. Erhalten: ' + JSON.stringify(a.out.slice(-30))), RES(x != null && y != null && Math.abs(x - y) > 60, x != null && y != null ? 'Poti unten ' + x + ' %, Poti oben ' + y + ' % (sie sollen sich deutlich unterscheiden).' : 'Kein Messwert.')]; } },
  { id: 'p11', lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', title: 'Dunkelheits-Anzeige', level: 3,
    start: pct(PC_MCP_LDR, PW_MCP_LDR, 'from gpiozero import MCP3008, LED\nfrom time import sleep\n\nlicht = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\nled = LED(17)\n\nwhile True:\n    # Hier: LED an, wenn der Messwert unter 0.3 liegt (dunkel), sonst aus\n    sleep(0.2)\n'),
    solMake: pct(PC_MCP_LDR, PW_MCP_LDR, 'from gpiozero import MCP3008, LED\nfrom time import sleep\n\nlicht = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\nled = LED(17)\n\nwhile True:\n    if licht.value < 0.3:\n        led.on()\n    else:\n        led.off()\n    sleep(0.2)\n'),
    text: 'Fotowiderstand und 10-kΩ-Widerstand bilden einen Spannungsteiler, der MCP3008 misst ihn an Kanal 0. Je dunkler, desto kleiner der Messwert. Die LED an GPIO17 soll leuchten, wenn der Wert unter 0.3 liegt (dunkel), sonst aus sein. Das Licht stellst du am Fotowiderstand ein.',
    hint: 'licht.value ist eine Zahl zwischen 0.0 und 1.0. if licht.value < 0.3: led.on() else: led.off().',
    check() { const L = theLed(), P = sch.parts.find(p => p.k === 'LDR'); if (!L || !P) return [RES(false, 'LED oder Fotowiderstand fehlt.')];
      const dark = piEval({ T: 1, pos: { [P.id]: 0.15 } }), bright = piEval({ T: 1, pos: { [P.id]: 0.9 } }); if (dark.err) return codeFail(dark);
      const a = ledMA(sampleAt(dark, 0.95), L.id) > 2, b = ledMA(sampleAt(bright, 0.95), L.id) > 2;
      return [RES(a, 'Dunkel: LED ist ' + (a ? 'an' : 'aus, soll aber an sein') + '.'), RES(!b, 'Hell: LED ist ' + (b ? 'an, soll aber aus sein' : 'aus') + '.')]; } },
  { id: 'p12', lab: 'pi', cat: 'Analoge Sensoren (MCP3008)', title: 'Temperatur ausgeben', level: 3,
    start: pct(PC_MCP_TMP, PW_MCP_TMP, 'from gpiozero import MCP3008\nfrom time import sleep\n\ntemp = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    volt = temp.voltage        # Spannung in Volt (bei 3,3 V Referenz)\n    # Hier: in Grad Celsius umrechnen und als "Temperatur: 25.0 °C" ausgeben\n    #       (TMP36: 0,5 V bei 0 Grad, 10 mV pro Grad)\n    sleep(0.5)\n'),
    solMake: pct(PC_MCP_TMP, PW_MCP_TMP, 'from gpiozero import MCP3008\nfrom time import sleep\n\ntemp = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    volt = temp.voltage\n    celsius = (volt - 0.5) * 100\n    print("Temperatur:", round(celsius, 1), "°C")\n    sleep(0.5)\n'),
    text: 'Der Temperatursensor TMP36 liefert 0,5 V bei 0 °C und 10 mV pro Grad. Rechne die Spannung in Grad Celsius um und gib sie aus, genau in der Form „Temperatur: 25.0 °C“. Die Temperatur stellst du am Sensor ein.',
    hint: 'celsius = (volt - 0.5) * 100. Mit round(celsius, 1) auf eine Nachkommastelle runden.',
    check() { const T = sch.parts.find(p => p.k === 'TMP36'); if (!T) return [RES(false, 'Der Temperatursensor fehlt.')];
      const a = piEval({ T: 1.2, pos: { [T.id]: 0.394 } }), b = piEval({ T: 1.2, pos: { [T.id]: 0.6 } }); if (a.err) return codeFail(a);
      const val = r => { const m = r.out.trim().split('\n').pop().match(/^Temperatur: (-?\d+(?:\.\d+)?) °C$/); return m ? +m[1] : null; }, x = val(a), y = val(b);
      return [RES(x != null && y != null, x != null && y != null ? 'Die Ausgabe hat das richtige Format.' : 'Erwartet wird eine Zeile wie „Temperatur: 25.0 °C“. Erhalten: ' + JSON.stringify(a.out.slice(-34))), RES(x != null && Math.abs(x - 25) <= 1.5, x != null ? 'Bei 25 °C zeigt das Programm ' + x + ' °C.' : 'Kein Wert.'), RES(y != null && Math.abs(y - 59) <= 1.5, y != null ? 'Bei 59 °C zeigt das Programm ' + y + ' °C.' : 'Kein Wert.')]; } },
  { id: 'p13', lab: 'pi', cat: 'Grundlagen', title: 'Eigene Klasse: der Blinker', level: 3,
    start: pct([['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16]], [[20, 10, 22, 10], [20, 16, 22, 16]], `from gpiozero import LED
from signal import pause

class Blinker:
    def __init__(self, pin):
        self.led = LED(pin)

    # Hier: Methode start(self, takt), die die LED im Takt blinken lässt

rot = Blinker(18)
gelb = Blinker(24)
rot.start(0.5)
gelb.start(0.2)
pause()
`),
    solMake: pct([['PI', 12, 0], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16]], [[20, 10, 22, 10], [20, 16, 22, 16]], `from gpiozero import LED
from signal import pause

class Blinker:
    def __init__(self, pin):
        self.led = LED(pin)

    def start(self, takt):
        self.led.blink(on_time=takt, off_time=takt)

rot = Blinker(18)
gelb = Blinker(24)
rot.start(0.5)
gelb.start(0.2)
pause()
`),
    text: 'Eine Klasse ist ein Bauplan für eigene Objekte. Die Klasse Blinker steht schon da und legt in __init__ eine LED an. Schreibe die Methode start(self, takt), die die LED im Takt blinken lässt (takt Sekunden an, takt Sekunden aus). Die rote LED soll im Takt 0,5 s blinken, die gelbe im Takt 0,2 s.',
    hint: 'Eine Methode hat immer self als ersten Parameter: def start(self, takt):. Darin: self.led.blink(on_time=takt, off_time=takt). Eingerückt unter class Blinker.',
    check() { const Ls = sch.parts.filter(p => p.k === 'LED'), R = Ls.find(p => /rot/i.test(String(p.v))), G = Ls.find(p => /gelb/i.test(String(p.v))); if (!R || !G) return [RES(false, 'Die rote und die gelbe LED fehlen.')];
      const e = piEval({ T: 2.6 }); if (e.err) return codeFail(e); const edges = id => { let n = 0, prev = false; e.samples.forEach(sm => { const on = ledMA(sm, id) > 2; if (on && !prev) n++; prev = on; }); return n; }, a = edges(R.id), b = edges(G.id);
      return [RES(/class\s+Blinker/.test(sch.code || ''), 'Das Programm benutzt die Klasse Blinker.'), RES(a >= 2 && a <= 3, 'Rote LED: ' + a + ' Blinkzyklen in 2,6 s (erwartet: 2 bis 3 bei Takt 0,5 s).'), RES(b >= 5 && b <= 7, 'Gelbe LED: ' + b + ' Blinkzyklen in 2,6 s (erwartet: 5 bis 7 bei Takt 0,2 s).')]; } },
  { id: 'p14', lab: 'pi', cat: 'I²C-Sensoren', title: 'Temperatur über I²C lesen', level: 3,
    start: pct([['PI', 12, 0], ['I2CTEMP', 2, 0, 0, '', { pos: 0.4 }], ['GND', 7, 8]], [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8]], `from smbus2 import SMBus
from time import sleep

ADRESSE = 0x48            # I2C-Adresse des LM75
bus = SMBus(1)            # Bus 1 = GPIO2 (SDA) und GPIO3 (SCL)

while True:
    daten = bus.read_i2c_block_data(ADRESSE, 0, 2)    # Register 0 = Temperatur, 2 Bytes
    # Hier: aus den zwei Bytes die Temperatur berechnen und als "Temperatur: 25.0 °C" ausgeben
    #       (daten[0] ist das obere Byte, daten[1] das untere. Der 9-Bit-Wert zählt in 0,5-Grad-Schritten)
    sleep(1)
`),
    solMake: pct([['PI', 12, 0], ['I2CTEMP', 2, 0, 0, '', { pos: 0.4 }], ['GND', 7, 8]], [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8]], `from smbus2 import SMBus
from time import sleep

ADRESSE = 0x48            # I2C-Adresse des LM75
bus = SMBus(1)            # Bus 1 = GPIO2 (SDA) und GPIO3 (SCL)

while True:
    daten = bus.read_i2c_block_data(ADRESSE, 0, 2)    # Register 0 = Temperatur, 2 Bytes
    wert = (daten[0] << 1) | (daten[1] >> 7)            # 9-Bit-Wert, 0,5 Grad pro Schritt
    if wert > 255:
        wert = wert - 512                               # negative Temperaturen
    print("Temperatur:", wert * 0.5, "°C")
    sleep(1)
`),
    text: 'Der LM75 liefert die Temperatur als 9-Bit-Wert in zwei Bytes: Das obere Byte hat die Bits 8 bis 1, vom unteren Byte zählt nur das oberste Bit. Ein Schritt sind 0,5 Grad. Gib die Temperatur genau in der Form „Temperatur: 25.0 °C“ aus. Den Regler am Sensor stellst du ein.',
    hint: 'wert = (daten[0] << 1) | (daten[1] >> 7) ergibt den 9-Bit-Wert. Mal 0.5 sind es Grad Celsius. Bei Werten über 255 ist die Temperatur negativ (minus 512).',
    check() { const T = sch.parts.find(p => p.k === 'I2CTEMP'); if (!T) return [RES(false, 'Der Temperatursensor fehlt.')];
      const a = piEval({ T: 1.2, pos: { [T.id]: 0.4 } }), b = piEval({ T: 1.2, pos: { [T.id]: 0.6 } }); if (a.err) return codeFail(a);
      const val = r => { const m = r.out.trim().split('\n').pop().match(/^Temperatur: (-?\d+(?:\.?\d+)?) °C$/); return m ? +m[1] : null; }, x = val(a), y = val(b);
      return [RES(x != null && y != null, x != null && y != null ? 'Die Ausgabe hat das richtige Format.' : 'Erwartet wird eine Zeile wie „Temperatur: 25.0 °C“. Erhalten: ' + JSON.stringify(a.out.slice(-34))), RES(x != null && Math.abs(x - 25) <= 0.6, x != null ? 'Bei 25 °C zeigt das Programm ' + x + ' °C.' : 'Kein Wert.'), RES(y != null && Math.abs(y - 50) <= 0.6, y != null ? 'Bei 50 °C zeigt das Programm ' + y + ' °C.' : 'Kein Wert.')]; } },
  { id: 'p15', lab: 'pi', cat: 'I²C-Sensoren', title: 'Dunkelheits-LED über I²C', level: 3,
    start: pct([['PI', 12, 0], ['I2CLUX', 2, 0, 0, '', { pos: 0.5 }], ['GND', 7, 8], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10]], [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8], [20, 10, 22, 10]], `from smbus2 import SMBus
from gpiozero import LED
from time import sleep

BH1750 = 0x23
bus = SMBus(1)
led = LED(18)

bus.write_byte(BH1750, 0x10)      # Messung starten (dauernd, hohe Auflösung)
sleep(0.2)

while True:
    daten = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((daten[0] << 8) | daten[1]) / 1.2     # Helligkeit in Lux
    # Hier: LED an, wenn es dunkel ist (unter 100 Lux), sonst aus
    sleep(0.5)
`),
    solMake: pct([['PI', 12, 0], ['I2CLUX', 2, 0, 0, '', { pos: 0.5 }], ['GND', 7, 8], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10]], [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8], [20, 10, 22, 10]], `from smbus2 import SMBus
from gpiozero import LED
from time import sleep

BH1750 = 0x23
bus = SMBus(1)
led = LED(18)

bus.write_byte(BH1750, 0x10)      # Messung starten (dauernd, hohe Auflösung)
sleep(0.2)

while True:
    daten = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((daten[0] << 8) | daten[1]) / 1.2
    print("Licht:", round(lux), "lx")
    if lux < 100:
        led.on()
    else:
        led.off()
    sleep(0.5)
`),
    text: 'Der Lichtsensor BH1750 liefert die Helligkeit in Lux. Die LED an GPIO18 soll leuchten, wenn es dunkel ist (unter 100 Lux), sonst aus sein. Die Helligkeit stellst du am Sensor ein.',
    hint: 'Die Variable lux ist schon berechnet. if lux < 100: led.on() else: led.off().',
    check() { const L = theLed(), S = sch.parts.find(p => p.k === 'I2CLUX'); if (!L || !S) return [RES(false, 'LED oder Lichtsensor fehlt.')];
      const dark = piEval({ T: 1.2, pos: { [S.id]: 0.1 } }), bright = piEval({ T: 1.2, pos: { [S.id]: 0.9 } }); if (dark.err) return codeFail(dark);
      const a = ledMA(sampleAt(dark, 1.1), L.id) > 2, b = ledMA(sampleAt(bright, 1.1), L.id) > 2;
      return [RES(a, 'Dunkel: LED ist ' + (a ? 'an' : 'aus, soll aber an sein') + '.'), RES(!b, 'Hell: LED ist ' + (b ? 'an, soll aber aus sein' : 'aus') + '.')]; } },
  { id: 'pf5', lab: 'pi', cat: 'Fehlersuche im Code', title: 'Der I²C-Sensor antwortet nicht', level: 3,
    start: pct([['PI', 12, 0], ['I2CLUX', 2, 0, 0, '', { pos: 0.5 }], ['GND', 7, 8], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10]], [[12, 0, 7, 0], [12, 2, 7, 2], [7, 6, 7, 8], [20, 10, 22, 10]], `from smbus2 import SMBus
from gpiozero import LED
from time import sleep

BH1750 = 0x23
bus = SMBus(1)
led = LED(18)

bus.write_byte(BH1750, 0x10)      # Messung starten (dauernd, hohe Auflösung)
sleep(0.2)

while True:
    daten = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((daten[0] << 8) | daten[1]) / 1.2
    print("Licht:", round(lux), "lx")
    if lux < 100:
        led.on()
    else:
        led.off()
    sleep(0.5)
`),
    solMake: pct([['PI', 12, 0], ['I2CLUX', 2, 0, 0, '', { pos: 0.5 }], ['GND', 7, 8], ['R', 22, 10, 0, '220'], ['LED', 26, 10, 0, 'rot'], ['GND', 30, 10]], [[12, 0, 7, 0], [12, 2, 7, 2], [12, 4, 7, 4], [7, 6, 7, 8], [20, 10, 22, 10]], `from smbus2 import SMBus
from gpiozero import LED
from time import sleep

BH1750 = 0x23
bus = SMBus(1)
led = LED(18)

bus.write_byte(BH1750, 0x10)      # Messung starten (dauernd, hohe Auflösung)
sleep(0.2)

while True:
    daten = bus.read_i2c_block_data(BH1750, 0x10, 2)
    lux = ((daten[0] << 8) | daten[1]) / 1.2
    print("Licht:", round(lux), "lx")
    if lux < 100:
        led.on()
    else:
        led.off()
    sleep(0.5)
`),
    text: 'Das Programm ist richtig, aber die Konsole meldet „Remote I/O error“: Der Lichtsensor antwortet nicht. Lies die Meldung (der Tipp am Ende sagt, was fehlt) und ergänze die Verdrahtung.',
    hint: 'I²C braucht vier Leitungen: 3,3 V, Masse, SDA (GPIO2, Pin 3) und SCL (GPIO3, Pin 5). Welche fehlt?',
    check() { const R = piEval({ T: 1.2 }); if (R.err) return [RES(false, R.err)]; const ok = /Licht: \d+ lx/.test(R.out);
      return [RES(true, 'Das Programm läuft ohne Fehlermeldung.'), RES(ok, ok ? 'Der Sensor liefert Messwerte.' : 'Es kommen keine Messwerte an.')]; } },
  { id: 'pf4', lab: 'pi', cat: 'Fehlersuche im Code', title: 'Der Wandler antwortet nicht', level: 3,
    start: pct(PC_MCP_POT, PW_MCP_POT_NOCS, 'from gpiozero import MCP3008\nfrom time import sleep\n\npoti = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    print("Poti:", round(poti.value * 100), "%")\n    sleep(0.5)\n'),
    solMake: pct(PC_MCP_POT, PW_MCP_POT, 'from gpiozero import MCP3008\nfrom time import sleep\n\npoti = MCP3008(channel=0, clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8)\n\nwhile True:\n    print("Poti:", round(poti.value * 100), "%")\n    sleep(0.5)\n'),
    text: 'Das Programm ist richtig, aber die Konsole meldet, dass der MCP3008 nicht antwortet. Lies die Fehlermeldung: Sie sagt, welche Leitung fehlt oder falsch liegt. Ergänze die Verdrahtung im Plan.',
    hint: 'Der Chip braucht vier Signalleitungen: Takt (CLK), Daten vom Chip (DOUT/MISO), Daten zum Chip (DIN/MOSI) und Chip-Select (CS). Die Pins stehen im Programm: clock_pin=23, miso_pin=24, mosi_pin=25, select_pin=8. Welche Leitung fehlt?',
    check() { const R = piEval({ T: 1.2 }); if (R.err) return [RES(false, R.err)]; const ok = /Poti: \d+ %/.test(R.out);
      return [RES(true, 'Das Programm läuft ohne Fehlermeldung.'), RES(ok, ok ? 'Der Wandler liefert Messwerte.' : 'Es kommen keine Messwerte an.')]; } },
];

/* ---- SchaltLab: Aufgaben mit Messung ---- */


/* ============ Tagesaufgabe mit Serie: jeden Tag eine neue Zufallsaufgabe, für alle mit denselben Zahlen ============ */
let dailyMode = false;
const withDaily = f => { dailyMode = true; try { return f(); } finally { dailyMode = false; } };
function localDate(off) { const t = new Date(); t.setDate(t.getDate() + (off || 0)); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); }
const dayNum = () => Math.floor(new Date(localDate() + 'T12:00:00').getTime() / 86400000);
const dateDE = () => new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const dbase = () => TASKS.find(t => t.id === ['r1', 'r2', 'r3', 'r4'][dayNum() % 4]);
const dget = () => { try { return JSON.parse(localStorage.getItem('lm4.daily') || '{}'); } catch (e) { return {}; } };
function dailyInfo() { const s = dget(), today = localDate(), live = s.last === today || s.last === localDate(-1); return { streak: live ? (s.streak || 0) : 0, best: s.best || 0, doneToday: s.last === today, days: s.days || {} }; }
function dailySolved() {
  const s = dget(), today = localDate(); if (s.last === today) return;
  s.streak = s.last === localDate(-1) ? (s.streak || 0) + 1 : 1; s.last = today; s.best = Math.max(s.best || 0, s.streak); s.days = Object.assign({}, s.days, { [today]: 1 });
  try { localStorage.setItem('lm4.daily', JSON.stringify(s)); } catch (e) {}
  toast('🔥 Tagesaufgabe geschafft! Serie: ' + s.streak + (s.streak === 1 ? ' Tag' : ' Tage'));
  if (window.Badges) { window.Badges.stat('dailyBest', s.streak, 'max'); window.Badges.confetti(false); window.Badges.chime(false); }
}
function openDaily() {
  if (LAB !== 'sch') { location.href = 'schaltplan.html?aufgabe=tag'; return; }
  const inf = dailyInfo(), base = withDaily(() => dbase());
  sheet('Tagesaufgabe', b => {
    let cal = ''; for (let i = 13; i >= 0; i--) { const dt = localDate(-i); cal += `<span title="${dt}" style="display:inline-block;width:22px;height:22px;line-height:22px;text-align:center;border-radius:6px;margin:2px;font-size:13px;background:${inf.days[dt] ? '#ff7a00' : 'var(--panel2,#2c343e)'};color:${inf.days[dt] ? '#fff' : 'var(--mute,#8d99a6)'}">${inf.days[dt] ? '🔥' : ''}</span>`; }
    b.innerHTML = `<p style="margin-top:0"><b>${esc(dateDE())}</b><br>Heute: ${esc(base ? base.title.replace('Zufall: ', '') : '')} mit den Zahlen des Tages. Alle in der Gruppe haben heute dieselben Zahlen.</p>
      <div class="card" style="padding:10px"><div style="font-size:26px;font-weight:700">🔥 ${inf.streak} ${inf.streak === 1 ? 'Tag' : 'Tage'} in Folge</div><div class="hint2" style="margin:2px 0 8px">Beste Serie: ${inf.best} · ${inf.doneToday ? 'Heute schon geschafft ✓' : 'Heute noch offen'}</div><div>${cal}</div></div>
      <div class="row2"><button class="btn pri" id="dStart">${inf.doneToday ? 'Nochmal ansehen' : 'Heute starten'}</button></div><p class="hint2">Wer jeden Tag eine Aufgabe löst, baut eine Serie auf. Verpasst du einen Tag, beginnt sie wieder bei eins.</p>`;
    b.querySelector('#dStart').onclick = () => { const bd = document.querySelector('.backdrop'); if (bd) bd.remove(); const go = () => startTask('tag'); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); };
  });
}


/* ============ Duell: Dialog, Chip, Zeiten und Speicher liegen in duell.js/duellui.js (Duell.open); hier bleiben nur die Zufallsaufgabe und die Anbindung ============ */
let duelSeed = null;
const withDuel = (seed, f) => { const o = duelSeed; duelSeed = seed; try { return f(); } finally { duelSeed = o; } };
const dcur = () => (window.Duell && window.Duell.rechnen ? window.Duell.rechnen.cur() : {});
const dbaseDuel = () => { const sd = String(dcur().seed || '0000'); return TASKS.find(t => t.id === ['r1', 'r2', 'r3', 'r4'][(parseInt(sd, 10) || 0) % 4]); };
const fmtDuel = ms => { const s = ms / 1000, m = Math.floor(s / 60); return (m ? m + ':' : '') + (s - m * 60).toFixed(1).padStart(m ? 4 : 1, '0').replace('.', ',') + (m ? '' : ' s'); };
function duelSolved() { if (window.Duell && window.Duell.loadUi) window.Duell.loadUi(u => u.rechnenSolved(dbaseDuel() ? dbaseDuel().id : '')); }
function openDuel() {
  if (LAB !== 'sch') { location.href = 'schaltplan.html?duell'; return; }
  if (!window.Duell) { window.addEventListener('load', () => { if (window.Duell) openDuel(); }, { once: true }); return; }   /* duell.js laedt nach schaltplan.js */
  window.Duell.open({ lab: 'sch', art: 'rechnen', start: () => startTask('duell'), hasWork: () => !!(sch.parts.length || sch.wires.length), confirmNew });
}

/* ============ Escape-Room: gelöste Aufgaben verraten die Ziffern des Türcodes ============ */
const ESC_STEPS = [
  { id: 's6', d: 7, room: 'Heizungsraum', story: 'Der Strom ist ausgefallen und die Tür ist zu. An der Wand hängt ein Zettel: „Reihenschaltung, 6 mA fließen.“ Baue sie, dann zeigt dir die Anzeige die erste Ziffer.' },
  { id: 's2', d: 3, room: 'Lampenlager', story: 'Eine Notleuchte braucht einen Vorwiderstand, sonst verglüht sie. Berechne und baue ihn, dann leuchtet die zweite Ziffer auf.' },
  { id: 's13', d: 1, room: 'Pförtnerloge', story: 'Die Hofbeleuchtung soll bei Dämmerung von selbst angehen. Verdrahte den Dämmerungsschalter, dann hängt die dritte Ziffer am Schlüsselbrett.' },
  { id: 's12', d: 9, room: 'Schaltwarte', story: 'Zuletzt blinkt die Warnleuchte der Schaltwarte nicht mehr. Verdrahte den 555-Blinker, dann ist die letzte Ziffer frei.' }];
const ESC_CODE = ESC_STEPS.map(s => s.d).join('');
const escOpen = () => { try { return localStorage.getItem('lm4.escape') === '1'; } catch (e) { return false; } };
const escDigits = () => { const dn = taskDone(); return ESC_STEPS.map(s => (dn[s.id] || 0) >= 100); };
function escMark(id) { const k = ESC_STEPS.findIndex(s => s.id === id); if (k < 0) return; const ok = escDigits(); if (ok.every(Boolean)) toast('🔑 Letzte Ziffer gefunden! Öffne im Menü den Escape-Room und tippe den Code ein.'); else toast('🔑 Ziffer ' + (k + 1) + ' gefunden: ' + ESC_STEPS[k].d); }
function openEscape() {
  if (LAB !== 'sch') { location.href = 'schaltplan.html?escape'; return; }
  sheet('🗝️ Escape-Room', b => {
    const ok = escDigits(), won = escOpen(), dn = ok.map((v, i) => v ? ESC_STEPS[i].d : '_');
    b.innerHTML = `<p style="margin-top:0">Der Strom ist weg und du bist im Technikkeller eingeschlossen. Die Tür öffnet sich mit einem vierstelligen Code. <b>Jede gelöste Aufgabe verrät eine Ziffer.</b></p>
      <div class="card" style="padding:10px;text-align:center"><div style="font:700 38px monospace;letter-spacing:10px">${dn.join(' ')}</div><div class="hint2">${won ? 'Tür offen ✓' : (ok.filter(Boolean).length + ' von 4 Ziffern')}</div></div>
      ${ESC_STEPS.map((s, i) => `<div class="card" style="padding:10px;margin-top:8px"><b>Raum ${i + 1}: ${esc(s.room)}</b> ${ok[i] ? '✅' : '🔒'}<div class="hint2" style="margin:4px 0 8px">${esc(s.story)}</div>${ok[i] ? '<div>Ziffer: <b>' + s.d + '</b></div>' : '<button class="btn" data-esc="' + s.id + '">Aufgabe starten</button>'}</div>`).join('')}
      ${won ? '<p><b>Geschafft!</b> Du bist raus. Tür auf, Licht an.</p>' : `<div class="card" style="padding:10px;margin-top:10px"><b>Tür-Schloss</b><div style="display:flex;gap:8px;margin-top:6px"><input id="escIn" inputmode="numeric" maxlength="4" placeholder="Code" style="flex:1;font-size:22px;letter-spacing:6px;text-align:center"><button class="btn pri" id="escGo">Öffnen</button></div><div class="hint2" id="escMsg"></div></div>`}`;
    b.querySelectorAll('[data-esc]').forEach(x => { x.onclick = () => { const bd = document.querySelector('.backdrop'); if (bd) bd.remove(); const go = () => startTask(x.dataset.esc); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); }; });
    const gb = b.querySelector('#escGo'); if (gb) gb.onclick = () => {
      const v = b.querySelector('#escIn').value.trim();
      if (v === ESC_CODE && escDigits().every(Boolean)) { try { localStorage.setItem('lm4.escape', '1'); } catch (e) {} if (window.Badges) { window.Badges.stat('escape', 1, 'max'); window.Badges.confetti(true); window.Badges.chime(true); } const bd = document.querySelector('.backdrop'); if (bd) bd.remove(); openEscape(); }
      else b.querySelector('#escMsg').textContent = v.length === 4 ? (escDigits().every(Boolean) ? 'Das Schloss klemmt. Prüfe die Ziffern.' : 'Das Schloss klemmt. Dir fehlen noch Ziffern.') : 'Der Code hat vier Ziffern.';
    };
  });
}

/* ============ Zufallsaufgaben: jeder Azubi bekommt eigene Zahlen (aus Name, Aufgabe und „Neue Zahlen“) ============ */
function rng(id) {
  let a = 0; const str = duelSeed ? 'DUEL|' + duelSeed + '|' + id : dailyMode ? 'TAG|' + localDate() + '|' + id : (userName() || 'Azubi') + '|' + id + '|' + (localStorage.getItem('sim.rs.' + id) || '0'); for (const ch of str) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const rpick = (r, arr) => arr[Math.floor(r() * arr.length)];
const E12S = [1, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2];
function e12(x) { const dec = Math.pow(10, Math.floor(Math.log10(x))); let best = 1, bd = 1e9; [...E12S, 10].forEach(m => { const d2 = Math.abs(Math.log(x / (m * dec))); if (d2 < bd) { bd = d2; best = m * dec; } }); return best; }
const RP = {
  r1: () => { const r = rng('r1'), U = rpick(r, [5, 6, 9, 12, 15]), col = rpick(r, ['rot', 'grün', 'gelb']), I = rpick(r, [5, 10, 15, 20]); return { U, col, I, R: (U - 2) / (I / 1000) }; },
  r2: () => { const r = rng('r2'), U = rpick(r, [5, 9, 12, 24]), R1 = rpick(r, [1000, 2200, 4700, 10000]), k = rpick(r, [1 / 3, 1 / 2, 2 / 3, 3 / 4]), U2 = Math.round(U * k * 10) / 10; return { U, R1, U2, R2: R1 * U2 / (U - U2) }; },
  r3: () => { const r = rng('r3'), U = rpick(r, [6, 9, 12, 24]), R1 = rpick(r, [330, 470, 680, 1000]); const Is = [4, 6, 8, 10, 12].filter(i => U / i * 1000 > R1 * 1.25), I = rpick(r, Is.length ? Is : [4]); return { U, R1, I, R2: U / (I / 1000) - R1 }; },
  r4: () => { const r = rng('r4'), R = rpick(r, [1000, 2200, 4700, 10000, 22000]), tau = rpick(r, [0.5, 1, 2, 5]); return { R, tau, C: tau / 1000 / R }; },
};
const noun = c => ({ rot: 'rote', grün: 'grüne', gelb: 'gelbe' }[c] || c);
const SCH_TASKS = [
  { id: 's1', lab: 'sch', cat: 'Grundlagen', title: 'Spannungsteiler für 6 V', level: 1, solMake: () => ({ parts: [['BAT', 4, 4, 1, '9'], ['R', 8, 2, 1, '1k'], ['R', 8, 6, 1, '2k'], ['GND', 4, 10], ['VM', 12, 6, 1, '']], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 6, 12, 6], [12, 10, 8, 10]], scopes: [] }),
    start: () => ({ parts: [['BAT', 4, 4, 1, '9'], ['R', 8, 2, 1, '1k'], ['GND', 4, 10], ['VM', 12, 6, 1, '']], wires: [[4, 4, 4, 2, 8, 2]], scopes: [] }),
    text: 'Das Voltmeter soll 6 V anzeigen. R1 (1 kΩ) und die 9-V-Batterie sind schon platziert. Ergänze den zweiten Widerstand R2 so, dass an R2 genau 6 V liegen, und verdrahte alles: R2 zwischen R1 und Masse, das Voltmeter parallel zu R2.',
    hint: 'Beim Spannungsteiler verhalten sich die Spannungen wie die Widerstände: U2 / U = R2 / (R1 + R2). Für 6 von 9 V muss R2 doppelt so groß sein wie R1.',
    check() { const vm = sch.parts.find(p => p.k === 'VM'); const r = needKinds([['Zweiter Widerstand', ['R'], 2]]); if (!vm) return r.concat([RES(false, 'Das Voltmeter fehlt.')]);
      const E = simEval({}); E.run(0.05); const v = vAcross(E, vm);
      return r.concat([RES(Math.abs(v - 6) < 0.3, isNaN(v) ? 'Das Voltmeter ist nicht angeschlossen.' : 'Das Voltmeter zeigt ' + fmt1(v) + ' V (soll 6 V).')]); } },
  { id: 's2', lab: 'sch', cat: 'Grundlagen', title: 'Vorwiderstand für die LED', level: 1, solMake: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 2, 0, '470'], ['LED', 10, 2, 1, 'rot'], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }),
    start: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['LED', 10, 2, 1, 'rot'], ['GND', 2, 8]], wires: [[10, 6, 10, 8, 2, 8], [2, 4, 2, 2]], scopes: [] }),
    text: 'Betreibe die rote LED an der 9-V-Batterie. Wähle einen passenden Vorwiderstand: Der LED-Strom soll zwischen 8 und 20 mA liegen (typisch 15 mA, die LED hat etwa 2 V Spannungsabfall). Ohne Widerstand würde die LED durchbrennen.',
    hint: 'R = (9 V − 2 V) / 0,015 A ≈ 470 Ω. Nimm einen Wert aus der Normreihe (zum Beispiel 470 Ω).',
    check() { const r = needKinds([['Vorwiderstand', ['R'], 1]]); const E = simEval({}); E.run(0.05); const e = ledElem(E), burn = burnTxt(E);
      if (burn.length) return r.concat([RES(false, burn[0])]); const i = e ? Math.abs(e.i) * 1000 : 0;
      return r.concat([RES(i >= 8 && i <= 20, 'LED-Strom: ' + fmt1(i) + ' mA' + (i >= 8 && i <= 20 ? '' : (i < 8 ? ' (zu klein, LED fast dunkel)' : ' (zu groß)')) + '.')]); } },
  { id: 's3', lab: 'sch', cat: 'Transistoren', title: 'Transistor als Schalter', level: 2, sol: 'Transistor als Schalter',
    start: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 10, 2, 1, '470'], ['LED', 10, 6, 1, 'grün'], ['NPN', 8, 12, 0, 'BC547'], ['R', 4, 12, 0, '10k'], ['SPST', 4, 6, 1, '', { sw: 1 }], ['GND', 2, 16]], wires: [[2, 4, 2, 2, 10, 2], [2, 8, 2, 16, 10, 16, 10, 14]], scopes: [] }),
    text: 'Ein Schalter soll über einen Transistor die LED ein- und ausschalten. Batterie, LED mit Vorwiderstand, Transistor, Basiswiderstand (10 kΩ) und Schalter sind platziert. Verdrahte den Schalter und den Basiswiderstand mit der Batterie und der Basis.',
    hint: 'Plus → Schalter → Basiswiderstand → Basis des Transistors. Der Transistor schaltet den LED-Zweig nach Masse (Emitter an Masse).',
    check() { const sw = sch.parts.find(p => p.k === 'SPST'); if (!sw) return needKinds([['Schalter', ['SPST'], 1]]); const out = [];
      [[1, true], [0, false]].forEach(([st, want]) => { const E = evalCombo([sw], [st]), e = ledElem(E), i = e ? Math.abs(e.i) * 1000 : 0, evs = evTxt(E).concat(burnTxt(E)); if (evs.length) out.push(RES(false, 'Schalter ' + (st ? 'ein' : 'aus') + ': ' + evs[0])); else out.push(RES(want ? i > 5 : i < 0.5, 'Schalter ' + (st ? 'ein' : 'aus') + ': LED-Strom ' + fmt1(i) + ' mA, die LED soll ' + (want ? 'leuchten' : 'aus sein') + '.')); });
      return out; } },
  { id: 's4', lab: 'sch', cat: 'Filter und Gleichrichter', title: 'Tiefpass mit 1 kHz Grenzfrequenz', level: 3, solMake: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['R', 2, 2, 0, '1k'], ['C', 6, 2, 1, '160n'], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2] }),
    start: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['R', 2, 2, 0, '1k'], ['GND', 2, 8]], wires: [[2, 4, 2, 2]], scopes: [0] }),
    text: 'Ergänze einen Kondensator, so dass die Schaltung mit R = 1 kΩ einen Tiefpass mit der Grenzfrequenz 1 kHz bildet. Bei der Grenzfrequenz ist die Spannung am Kondensator auf 70 % der Eingangsspannung gesunken. Die Quelle liefert 1 kHz.',
    hint: 'fg = 1 / (2 · π · R · C). Umgestellt: C = 1 / (2 · π · 1000 Hz · 1000 Ω) ≈ 160 nF. Kondensator zwischen Widerstand und Masse legen.',
    check() { const cap = sch.parts.find(p => p.k === 'C' || p.k === 'CE'), src = sch.parts.find(p => p.k === 'AC'); if (!cap || !src) return needKinds([['Kondensator', ['C', 'CE'], 1], ['Wechselspannungsquelle', ['AC'], 1]]);
      const E = simEval({}); let pc = 0, ps = 0; stepFine(E, 0.012, 2e-6, t => { if (t > 0.006) { pc = Math.max(pc, Math.abs(vAcross(E, cap))); ps = Math.max(ps, Math.abs(vAcross(E, src))); } }); const q = ps > 0 ? pc / ps : 0;
      return [RES(q > 0.58 && q < 0.82, 'Bei 1 kHz erreicht ' + Math.round(q * 100) + ' % der Eingangsspannung den Kondensator (soll etwa 70 %).')]; } },
  { id: 's5', lab: 'sch', cat: 'Filter und Gleichrichter', title: 'Netzteil: Einweggleichrichter', level: 3, sol: 'Einweggleichrichter mit Glättung',
    start: () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz'], ['R', 10, 2, 1, '1k'], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [10, 6, 10, 8], [2, 8, 10, 8]], scopes: [] }),
    text: 'Aus der Wechselspannung (10 V, 50 Hz) soll eine möglichst glatte Gleichspannung am Lastwiderstand (1 kΩ) entstehen. Baue einen Einweggleichrichter mit Diode und Ladeelko. Die Spannung an der Last soll im Mittel über 5,5 V liegen und um weniger als 2 V schwanken.',
    hint: 'Diode in Reihe (Ring zur Last), Elko parallel zur Last (Plus zur Diode). Ein größerer Elko glättet besser.',
    check() { const d = sch.parts.find(p => p.k === 'D'), ce = sch.parts.find(p => p.k === 'CE'), rl = sch.parts.find(p => p.k === 'R'); const r = needKinds([['Diode', ['D'], 1], ['Elko', ['CE'], 1]]); if (!d || !ce || !rl) return r;
      const E = simEval({}); let mn = 99, mx = -99, sum = 0, cnt = 0; stepFine(E, 0.3, 1e-4, t => { if (t > 0.15) { const v = vAcross(E, rl); mn = Math.min(mn, v); mx = Math.max(mx, v); sum += v; cnt++; } }); const avg = cnt ? sum / cnt : 0, rip = mx - mn;
      return r.concat([RES(avg > 5.5, 'Mittlere Spannung an der Last: ' + fmt1(avg) + ' V (soll über 5,5 V).'), RES(rip < 2, 'Restwelligkeit: ' + fmt1(rip) + ' V (soll unter 2 V).')]); } },
  { id: 'sf1', lab: 'sch', cat: 'Fehlersuche', title: 'Transistorschalter: die LED bleibt aus', level: 2, debug: true, faultLabel: 'R2', sol: 'Transistor als Schalter',
    start: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 10, 2, 1, '470', { l: 'R1' }], ['LED', 10, 6, 1, 'grün'], ['NPN', 8, 12, 0, 'BC547'], ['R', 4, 12, 0, '10k', { l: 'R2', defect: 'open' }], ['SPST', 4, 6, 1, '', { sw: 1 }], ['GND', 2, 16]], wires: [[2, 4, 2, 2, 4, 2, 10, 2], [4, 6, 4, 2], [4, 10, 4, 12], [2, 8, 2, 16, 10, 16, 10, 14]], scopes: [] }),
    text: 'Der Schalter ist geschlossen, aber die LED leuchtet nicht. Die Verdrahtung ist in Ordnung. Finde mit den Messgeräten das defekte Bauteil. Wähle es aus und tippe auf „Fehler melden“.',
    hint: 'Miss die Spannung an der Basis des Transistors. Ist sie 0 V, obwohl der Schalter geschlossen ist, kommt kein Strom aus dem Basiszweig.' },
  { id: 'sf2', lab: 'sch', cat: 'Fehlersuche', title: 'Netzteil liefert keine Gleichspannung', level: 2, debug: true, faultLabel: 'D1', sol: 'Einweggleichrichter mit Glättung',
    start: () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz'], ['D', 2, 2, 0, '1N4007', { l: 'D1', defect: 'open' }], ['CE', 6, 2, 1, '100u', { l: 'C1' }], ['R', 10, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 8]], wires: [[2, 4, 2, 2], [6, 2, 10, 2], [6, 6, 6, 8], [10, 6, 10, 8], [2, 8, 6, 8, 10, 8]], scopes: [0, 3] }),
    text: 'Der Lastwiderstand R1 bekommt keine Spannung, obwohl die Quelle 10 V liefert. Welches Bauteil ist defekt?',
    hint: 'Vergleiche die Spannung vor und hinter der Diode. Hinter dem defekten Bauteil bleibt die Spannung aus.' },

  { id: 's6', lab: 'sch', cat: 'Grundlagen', title: 'Reihenschaltung: 6 mA fließen', level: 1,
    start: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 2, 0, '1k', { l: 'R1' }], ['AM', 10, 2, 0, ''], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10]], scopes: [] }),
    solMake: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 2, 0, '1k', { l: 'R1' }], ['AM', 10, 2, 0, ''], ['GND', 2, 10], ['R', 14, 4, 1, '500', { l: 'R2' }]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10], [14, 2, 14, 4], [14, 8, 14, 10, 2, 10]], scopes: [] }),
    text: 'An der 9-V-Batterie hängen R1 = 1 kΩ und ein Amperemeter. Das Amperemeter soll 6 mA anzeigen. Ergänze einen zweiten Widerstand R2 in Reihe und wähle seinen Wert so, dass genau 6 mA fließen.',
    hint: 'I = U / R_gesamt. Für 6 mA bei 9 V muss R_gesamt = 9 V / 0,006 A = 1,5 kΩ sein. Bei einer Reihenschaltung addieren sich die Widerstände: R2 = 1,5 kΩ − 1 kΩ.',
    check() { const rs = sch.parts.filter(p => p.k === 'R'); const r = needKinds([['Zweiter Widerstand (in Reihe)', ['R'], 2]]); if (rs.length < 2) return r; const E = simEval({}); E.run(0.05); const i = totalI(E); return r.concat([RES(Math.abs(i - 6) <= 0.35, 'Es fließen ' + fmt1(i) + ' mA (soll 6 mA).')]); } },
  { id: 's7', lab: 'sch', cat: 'Grundlagen', title: 'Parallelschaltung: 20 mA', level: 1,
    start: () => ({ parts: [['BAT', 2, 4, 1, '10'], ['R', 6, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [6, 6, 6, 8, 2, 8], [2, 8, 2, 10]], scopes: [] }),
    solMake: () => ({ parts: [['BAT', 2, 4, 1, '10'], ['R', 6, 2, 1, '1k', { l: 'R1' }], ['GND', 2, 10], ['R', 10, 2, 1, '1k', { l: 'R2' }]], wires: [[2, 4, 2, 2, 6, 2, 10, 2], [6, 6, 6, 8, 2, 8, 10, 8, 10, 6], [2, 8, 2, 10]], scopes: [] }),
    text: 'An 10 V liegt R1 = 1 kΩ. Die Batterie soll insgesamt 20 mA liefern. Schalte einen zweiten Widerstand R2 parallel zu R1 und wähle seinen Wert passend.',
    hint: 'Parallel liegen beide Widerstände an derselben Spannung. 10 V / 1 kΩ = 10 mA durch R1. Es fehlen noch 10 mA durch R2: R2 = 10 V / 10 mA = 1 kΩ.',
    check() { const r = needKinds([['Zweiter Widerstand (parallel)', ['R'], 2]]); if (sch.parts.filter(p => p.k === 'R').length < 2) return r; const E = simEval({}); E.run(0.05); const i = totalI(E); return r.concat([RES(Math.abs(i - 20) <= 1, 'Die Batterie liefert ' + fmt1(i) + ' mA (soll 20 mA).')]); } },
  { id: 's8', lab: 'sch', cat: 'Grundlagen', title: 'Belasteter Spannungsteiler: 3 V an der Last', level: 2,
    start: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 2, 0, '1k', { l: 'R1' }], ['R', 10, 2, 1, '1k', { l: 'RL' }], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8], [2, 8, 2, 10]], scopes: [] }),
    solMake: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 6, 2, 0, '1k', { l: 'R1' }], ['R', 10, 2, 1, '1k', { l: 'RL' }], ['GND', 2, 10], ['R', 14, 2, 1, '1k', { l: 'R2' }]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8, 14, 8, 14, 6], [2, 8, 2, 10], [10, 2, 14, 2]], scopes: [] }),
    text: 'Die Last RL (1 kΩ) hängt hinter R1 (1 kΩ) an 9 V. An RL sollen genau 3 V liegen. Ergänze einen Widerstand R2 parallel zur Last und wähle seinen Wert. Denke daran: R2 und die Last liegen parallel.',
    hint: 'Für 3 von 9 V muss der Widerstand unter dem Abgriff halb so groß sein wie R1: R2 ‖ RL = 500 Ω. Zwei gleiche Widerstände parallel ergeben die Hälfte.',
    check() { const rl = sch.parts.find(p => p.l === 'RL'); const r = needKinds([['Widerstand R2 (parallel zur Last)', ['R'], 3]]); if (!rl || sch.parts.filter(p => p.k === 'R').length < 3) return r; const E = simEval({}); E.run(0.05); const v = vAcross(E, rl); return r.concat([RES(Math.abs(v) >= 2.85 && Math.abs(v) <= 3.15, 'An der Last liegen ' + fmt1(Math.abs(v)) + ' V (soll 3 V).')]); } },
  { id: 's9', lab: 'sch', cat: 'Halbleiter', title: 'Z-Diode stabilisiert 5,1 V', level: 2,
    start: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 6, 2, 0, '470', { l: 'R1' }], ['R', 10, 2, 1, '1k', { l: 'RL' }], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8], [2, 8, 2, 10]], scopes: [] }),
    solMake: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 6, 2, 0, '470', { l: 'R1' }], ['R', 10, 2, 1, '1k', { l: 'RL' }], ['GND', 2, 10], ['ZD', 14, 6, 3, '5.1', { l: 'D1' }]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8, 14, 8, 14, 6], [2, 8, 2, 10], [10, 2, 14, 2]], scopes: [] }),
    text: 'Die Last RL (1 kΩ) hängt an 12 V hinter einem Vorwiderstand. Dort sollen stabile 5,1 V liegen. Setze eine Z-Diode (5,1 V) parallel zur Last, in Sperrrichtung (Kathode zum Pluspol).',
    hint: 'Eine Z-Diode wird in Sperrrichtung betrieben: Der Strich (Kathode) zeigt zum höheren Potenzial. Wenn die Spannung an der Last nur etwa 0,7 V beträgt, liegt die Diode falsch herum (Durchlassrichtung).',
    check() { const rl = sch.parts.find(p => p.l === 'RL'), z = sch.parts.find(p => p.k === 'ZD'); const r = needKinds([['Z-Diode', ['ZD'], 1]]); if (!rl || !z) return r; const E = simEval({}); E.run(0.05); const v = vAcross(E, rl); return r.concat([RES(Math.abs(v - 5.1) <= 0.35, 'An der Last liegen ' + fmt1(v) + ' V (soll 5,1 V)' + (v < 1 ? ': Die Z-Diode ist falsch herum eingebaut.' : '.'))]); } },
  { id: 's10', lab: 'sch', cat: 'Filter und Gleichrichter', title: 'RC-Glied: Zeitkonstante 1 ms', level: 2,
    start: () => ({ parts: [['BAT', 2, 4, 1, '5'], ['R', 6, 2, 0, '10k', { l: 'R1' }], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10]], scopes: [] }),
    solMake: () => ({ parts: [['BAT', 2, 4, 1, '5'], ['R', 6, 2, 0, '10k', { l: 'R1' }], ['GND', 2, 10], ['C', 10, 2, 1, '100n', { l: 'C1' }]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10], [10, 6, 10, 8, 2, 8]], scopes: [] }),
    text: 'Ergänze einen Kondensator so, dass sich der Kondensator mit R1 = 10 kΩ an 5 V nach genau 1 ms auf etwa 63 % der Batteriespannung (3,2 V) geladen hat. Das ist die Zeitkonstante τ = R · C = 1 ms.',
    hint: 'τ = R · C. Umgestellt: C = τ / R = 1 ms / 10 kΩ = 100 nF. Der Kondensator liegt zwischen dem Widerstand und Masse.',
    check() { const c = sch.parts.find(p => p.k === 'C' || p.k === 'CE'); const r = needKinds([['Kondensator', ['C', 'CE'], 1]]); if (!c) return r; const E = simEval({}); let v = 0; stepFine(E, 0.001, 5e-6, () => { v = vAcross(E, c); }); return r.concat([RES(Math.abs(Math.abs(v) - 3.16) <= 0.4, 'Nach 1 ms liegen ' + fmt1(Math.abs(v)) + ' V am Kondensator (soll etwa 3,2 V).')]); } },
  { id: 's11', lab: 'sch', cat: 'Aufbau nach Plan', title: 'Brückengleichrichter verdrahten', level: 3, sol: 'Brückengleichrichter mit Glättung',
    start: () => wiresOff(exLike('Brückengleichrichter mit Glättung'))(),
    text: 'Die Bauteile für ein Netzteil mit Brückengleichrichter und Glättung stehen schon im Plan. Verdrahte sie wie im Beispiel „Brückengleichrichter mit Glättung“: Wechselspannung auf die Brücke, Elko und Last an Plus und Minus.',
    hint: 'Die Wechselspannungs-Anschlüsse (~) der Brücke gehen an die Quelle, Plus und Minus der Brücke an den Elko (Polung) und den Lastwiderstand.',
    check() { return schNetCheck(exLike('Brückengleichrichter mit Glättung')); } },
  { id: 's12', lab: 'sch', cat: 'Aufbau nach Plan', title: '555-Blinker verdrahten', level: 3, sol: '555-Blinker (astabil)',
    start: () => wiresOff(exLike('555-Blinker'))(),
    text: 'Verdrahte den NE555 als astabilen Multivibrator (Blinker) nach dem Beispiel „555-Blinker (astabil)“: zwei Widerstände, Kondensator, LED mit Vorwiderstand und die Batterie.',
    hint: 'Pin 2 und Pin 6 sind verbunden, der Kondensator liegt an Pin 6 nach Masse, Pin 7 liegt zwischen den beiden Widerständen. Pin 4 und 8 an Plus, Pin 1 an Masse.',
    check() { return schNetCheck(exLike('555-Blinker')); } },
  { id: 's13', lab: 'sch', cat: 'Aufbau nach Plan', title: 'Dämmerungsschalter verdrahten', level: 2, sol: 'Dämmerungsschalter (LDR)',
    start: () => wiresOff(exLike('Dämmerungsschalter (LDR)'))(),
    text: 'Verdrahte den Dämmerungsschalter nach dem Beispiel: Fotowiderstand und Widerstand bilden einen Spannungsteiler, der Transistor schaltet die LED.',
    hint: 'Der Mittelpunkt des Spannungsteilers geht an die Basis des Transistors. Die LED mit Vorwiderstand liegt im Kollektorkreis.',
    check() { return schNetCheck(exLike('Dämmerungsschalter (LDR)')); } },
  { id: 's14', lab: 'sch', cat: 'Aufbau nach Plan', title: 'Relais mit Transistor verdrahten', level: 3, sol: 'Relais mit Transistor und Freilaufdiode',
    start: () => wiresOff(exLike('Relais mit Transistor und Freilaufdiode'))(),
    text: 'Der Transistor soll die Relaisspule schalten, die Freilaufdiode schützt ihn. Verdrahte Steuer- und Laststromkreis wie im Beispiel „Relais mit Transistor und Freilaufdiode“.',
    hint: 'Die Diode liegt in Sperrrichtung parallel zur Spule. Die beiden Stromkreise (Steuerung und Last) sind nur über die Spule und den Relaiskontakt gekoppelt. Laststromkreis: Plus der zweiten Batterie an die Lampe, die Lampe an den Schließer, der Relaiskontakt Mitte an Minus der zweiten Batterie. Dieses Minus darf an einem Masse-Symbol des Steuerkreises liegen oder für sich bleiben, beides ist richtig. Die beiden Pluspole dürfen nicht verbunden werden.',
    check() { return schNetCheck(exLike('Relais mit Transistor und Freilaufdiode'), { sep: [['5.2', '8.1']], optional: [11] }); } },   // Relaiskontakt Mitte (K1 Pin 3) und Minus V2 dürfen für sich liegen; das dritte Masse-Symbol neben V2 darf fehlen
  { id: 's15', lab: 'sch', cat: 'Aufbau nach Plan', title: 'Komparator mit Operationsverstärker', level: 3, sol: 'Operationsverstärker als Komparator',
    start: () => wiresOff(exLike('Operationsverstärker als Komparator'))(),
    text: 'Verdrahte den Operationsverstärker als Komparator nach dem Beispiel: Poti und Referenzspannung an die beiden Eingänge, LED am Ausgang.',
    hint: 'Der Ausgang schaltet auf Plus, wenn der Pluseingang höher liegt als der Minuseingang. Achte auf die Versorgung des Operationsverstärkers.',
    check() { return schNetCheck(exLike('Operationsverstärker als Komparator')); } },
  { id: 's16', lab: 'sch', cat: 'Aufbau nach Plan', title: 'Festspannung 5 V mit Regler 7805', level: 2, sol: 'Festspannung 5 V mit Spannungsregler 7805',
    start: () => wiresOff(exLike('Festspannung 5 V mit Spannungsregler'))(),
    text: 'Verdrahte die Festspannungsquelle: Der Regler 7805 macht aus 9 V stabile 5 V für die LED mit Vorwiderstand.',
    hint: 'Eingang des Reglers an Plus, gemeinsamer Anschluss an Masse, Ausgang zur Last.',
    check() { return schNetCheck(exLike('Festspannung 5 V mit Spannungsregler')); } },
  { id: 's17', lab: 'sch', cat: 'Projekt: Ampel', title: 'Ampel: Taktgeber und Zähler verdrahten', level: 3, sol: 'Ampel mit 555-Takt und Zähler (CD4017)', loch: 'l15',
    start: () => wiresOff(exLike('Ampel mit 555-Takt'))(),
    text: 'Projekt Ampel, Teil 1 (Plan): Ein NE555 als astabile Kippstufe liefert den Takt, der CD4017 zählt und schaltet nacheinander die LEDs rot, grün und gelb. Verdrahte den Stromlaufplan. Danach baust du die Schaltung im LochLab auf.',
    hint: 'Der 555 arbeitet wie im Blinker: R1 von Plus an Pin 7, R2 von Pin 7 an Pin 6, Pin 2 und 6 verbinden, Kondensator an Pin 6 nach Masse, Pin 3 (Ausgang) an CLK (Pin 14) des CD4017. Beim CD4017: Pin 16 an Plus, Pin 8 und Pin 13 (ENA) an Masse, Q0 (Pin 3) rot, Q1 (Pin 2) grün, Q2 (Pin 4) gelb, jeweils über 470 Ω gegen Masse, und Q3 (Pin 7) an RST (Pin 15).',
    check() { return schNetCheck(exLike('Ampel mit 555-Takt')); } },
  { id: 's18', lab: 'sch', cat: 'Projekt: Dämmerungsschalter', title: 'Dämmerungsschalter mit Relais verdrahten', level: 3, sol: 'Dämmerungsschalter mit Relais und Lampe', loch: 'l16',
    start: () => wiresOff(exLike('Dämmerungsschalter mit Relais'))(),
    text: 'Projekt Dämmerungsschalter, Teil 1 (Plan): Ein Fotowiderstand und ein Widerstand steuern einen Transistor, der ein Relais schaltet. Das Relais schaltet im zweiten Stromkreis die Lampe. Der zweite Stromkreis ist vom Steuerkreis getrennt: Sein Minus darf mit der Masse des Steuerkreises verbunden sein oder für sich bleiben, beides wird als richtig gewertet. Verdrahte den Stromlaufplan. Danach baust du die Schaltung im LochLab auf.',
    hint: 'Steuerkreis: 12 V Plus über 47 kΩ an den Mittelpunkt, der Fotowiderstand vom Mittelpunkt nach Masse, der Mittelpunkt an die Basis. Transistor: Emitter an Masse, Kollektor an Relaisspule, die andere Spulenseite an Plus, Freilaufdiode parallel zur Spule (Ring zur Plusseite). Laststromkreis: Plus der zweiten Batterie an die Lampe, die Lampe an den Schließer des Relais, der Relaiskontakt Mitte an Minus der zweiten Batterie. Minus der zweiten Batterie darf an einem Masse-Symbol des Steuerkreises liegen oder für sich bleiben, beides ist richtig. Die beiden Pluspole dürfen nicht verbunden werden.',
    check() { return schNetCheck(exLike('Dämmerungsschalter mit Relais'), { sep: [['5.2', '8.1']], optional: [12] }); } },   // Mitte des Relaiskontakts (K1 Pin 3) und Minus V2 dürfen für sich liegen; das vierte Masse-Symbol neben V2 darf fehlen
  { id: 's19', lab: 'sch', cat: 'Projekt: Netzteil', title: 'Netzteil 5 V verdrahten', level: 3, sol: 'Netzteil 5 V: Brücke, Elko und Spannungsregler', loch: 'l17',
    start: () => wiresOff(exLike('Netzteil 5 V: Brücke'))(),
    text: 'Projekt Netzteil, Teil 1 (Plan): Aus 12 V Wechselspannung soll eine stabile Gleichspannung von 5 V werden: Vier Dioden als Brücke, ein Elko zum Glätten, der Spannungsregler 7805 und ein Elko am Ausgang. Eine LED mit Vorwiderstand zeigt den Betrieb. Verdrahte den Stromlaufplan. Danach baust du die Schaltung im LochLab auf.',
    hint: 'Brücke: die Wechselspannungsquelle zwischen die beiden Diodenmitten, die Ringe (Kathoden) der oberen Dioden zum Plus-Ausgang, die unteren Dioden zur Masse. Plus: Elko 1000 µF nach Masse (Pluspol oben), dann an IN des 7805. Der 7805 hat IN links, GND unten, OUT rechts. Am Ausgang ein Elko 10 µF nach Masse, dann 330 Ω und LED nach Masse.',
    check() { return schNetCheck(exLike('Netzteil 5 V: Brücke')); } },
  { id: 'r1', lab: 'sch', cat: 'Zufallsaufgaben', title: 'Zufall: Vorwiderstand für die LED', level: 1, rand: true,
    get text() { const p = RP.r1(); return 'Betreibe die ' + noun(p.col) + ' LED an ' + p.U + ' V so, dass etwa ' + p.I + ' mA fließen (die LED hat etwa 2 V Spannungsabfall). Berechne den Vorwiderstand, wähle einen passenden Wert und baue ihn ein. Deine Zahlen sind nur deine: „Neue Zahlen“ würfelt andere.'; },
    get hint() { const p = RP.r1(); return 'R = (U − 2 V) / I = (' + p.U + ' V − 2 V) / ' + p.I + ' mA ≈ ' + Math.round(p.R) + ' Ω. Nimm den nächsten Wert der Normreihe E12.'; },
    start: () => { const p = RP.r1(); return { parts: [['BAT', 2, 4, 1, String(p.U)], ['LED', 10, 2, 1, p.col], ['GND', 2, 8]], wires: [[10, 6, 10, 8, 2, 8], [2, 4, 2, 2]], scopes: [] }; },
    solMake: () => { const p = RP.r1(); return { parts: [['BAT', 2, 4, 1, String(p.U)], ['R', 6, 2, 0, fmtSI(e12(p.R))], ['LED', 10, 2, 1, p.col], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }; },
    check() { const p = RP.r1(), r = needKinds([['Vorwiderstand', ['R'], 1]]); const E = simEval({}); E.run(0.05); const e = ledElem(E), burn = burnTxt(E); if (burn.length) return r.concat([RES(false, burn[0])]);
      const i = e ? Math.abs(e.i) * 1000 : 0, ok = Math.abs(i - p.I) <= p.I * 0.2; return r.concat([RES(ok, 'LED-Strom: ' + fmt1(i) + ' mA (Ziel etwa ' + p.I + ' mA, erlaubt ±20 %).')]); } },
  { id: 'r2', lab: 'sch', cat: 'Zufallsaufgaben', title: 'Zufall: Spannungsteiler', level: 2, rand: true,
    get text() { const p = RP.r2(); return 'Das Voltmeter soll ' + String(p.U2).replace('.', ',') + ' V anzeigen. Die Batterie hat ' + p.U + ' V, R1 ist ' + fmtSI(p.R1) + ' Ω. Berechne R2, wähle den nächsten Normwert und verdrahte alles: R2 zwischen R1 und Masse, das Voltmeter parallel zu R2.'; },
    get hint() { const p = RP.r2(); return 'U2 / U = R2 / (R1 + R2). Umgestellt: R2 = R1 · U2 / (U − U2) = ' + fmtSI(p.R1) + ' Ω · ' + p.U2 + ' V / ' + fmt1(p.U - p.U2) + ' V ≈ ' + Math.round(p.R2) + ' Ω.'; },
    start: () => { const p = RP.r2(); return { parts: [['BAT', 4, 4, 1, String(p.U)], ['R', 8, 2, 1, fmtSI(p.R1)], ['GND', 4, 10], ['VM', 12, 6, 1, '']], wires: [[4, 4, 4, 2, 8, 2]], scopes: [] }; },
    solMake: () => { const p = RP.r2(); return { parts: [['BAT', 4, 4, 1, String(p.U)], ['R', 8, 2, 1, fmtSI(p.R1)], ['R', 8, 6, 1, fmtSI(e12(p.R2))], ['GND', 4, 10], ['VM', 12, 6, 1, '']], wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 6, 12, 6], [12, 10, 8, 10]], scopes: [] }; },
    check() { const p = RP.r2(), vm = sch.parts.find(q => q.k === 'VM'), r = needKinds([['Zweiter Widerstand', ['R'], 2]]); if (!vm) return r.concat([RES(false, 'Das Voltmeter fehlt.')]);
      const E = simEval({}); E.run(0.05); const v = vAcross(E, vm), tol = Math.max(0.07 * p.U2, 0.15);
      return r.concat([RES(Math.abs(v - p.U2) <= tol, isNaN(v) ? 'Das Voltmeter ist nicht angeschlossen.' : 'Das Voltmeter zeigt ' + fmt1(v) + ' V (Ziel ' + String(p.U2).replace('.', ',') + ' V).')]); } },
  { id: 'r3', lab: 'sch', cat: 'Zufallsaufgaben', title: 'Zufall: Reihenschaltung, Strom einstellen', level: 2, rand: true,
    get text() { const p = RP.r3(); return 'An ' + p.U + ' V liegen R1 = ' + fmtSI(p.R1) + ' Ω und ein zweiter Widerstand R2 in Reihe. Es sollen ' + p.I + ' mA fließen. Berechne R2, wähle den nächsten Normwert, baue ihn ein und verdrahte: R1 → R2 → Masse.'; },
    get hint() { const p = RP.r3(); return 'R gesamt = U / I = ' + p.U + ' V / ' + p.I + ' mA = ' + Math.round(p.U / p.I * 1000) + ' Ω. R2 = R gesamt − R1 = ' + Math.round(p.R2) + ' Ω.'; },
    start: () => { const p = RP.r3(); return { parts: [['BAT', 2, 4, 1, String(p.U)], ['R', 6, 2, 0, fmtSI(p.R1)], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2]], scopes: [] }; },
    solMake: () => { const p = RP.r3(); return { parts: [['BAT', 2, 4, 1, String(p.U)], ['R', 6, 2, 0, fmtSI(p.R1)], ['R', 10, 2, 1, fmtSI(e12(p.R2))], ['GND', 2, 8]], wires: [[2, 4, 2, 2, 6, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }; },
    check() { const p = RP.r3(), r = needKinds([['Zweiter Widerstand', ['R'], 2]]); const E = simEval({}); E.run(0.05); const e = E.c.elems.find(x => x.type === 'V'), i = e ? Math.abs(e.i) * 1000 : 0, burn = burnTxt(E);
      if (burn.length) return r.concat([RES(false, burn[0])]); return r.concat([RES(Math.abs(i - p.I) <= p.I * 0.1, 'Der Strom beträgt ' + fmt1(i) + ' mA (Ziel ' + p.I + ' mA, erlaubt ±10 %).')]); } },
  { id: 'r4', lab: 'sch', cat: 'Zufallsaufgaben', title: 'Zufall: RC-Glied, Zeitkonstante', level: 2, rand: true,
    get text() { const p = RP.r4(); return 'Ergänze einen Kondensator so, dass sich der Kondensator mit R1 = ' + fmtSI(p.R) + ' Ω an 5 V nach genau ' + String(p.tau).replace('.', ',') + ' ms auf etwa 63 % der Batteriespannung (3,2 V) geladen hat. Das ist die Zeitkonstante τ = R · C.'; },
    get hint() { const p = RP.r4(); return 'τ = R · C. Umgestellt: C = τ / R = ' + String(p.tau).replace('.', ',') + ' ms / ' + fmtSI(p.R) + ' Ω = ' + fmtSI(p.C) + 'F. Der Kondensator liegt zwischen dem Widerstand und Masse.'; },
    start: () => { const p = RP.r4(); return { parts: [['BAT', 2, 4, 1, '5'], ['R', 6, 2, 0, fmtSI(p.R), { l: 'R1' }], ['GND', 2, 10]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10]], scopes: [] }; },
    solMake: () => { const p = RP.r4(); return { parts: [['BAT', 2, 4, 1, '5'], ['R', 6, 2, 0, fmtSI(p.R), { l: 'R1' }], ['GND', 2, 10], ['C', 10, 2, 1, fmtSI(e12(p.C)), { l: 'C1' }]], wires: [[2, 4, 2, 2, 6, 2], [2, 8, 2, 10], [10, 6, 10, 8, 2, 8]], scopes: [] }; },
    check() { const p = RP.r4(), c = sch.parts.find(q => q.k === 'C' || q.k === 'CE'), r = needKinds([['Kondensator', ['C', 'CE'], 1]]); if (!c) return r; const E = simEval({}); let v = 0; stepFine(E, p.tau / 1000, p.tau / 1000 / 200, () => { v = vAcross(E, c); });
      return r.concat([RES(Math.abs(Math.abs(v) - 3.16) <= 0.45, 'Nach ' + String(p.tau).replace('.', ',') + ' ms liegen ' + fmt1(Math.abs(v)) + ' V am Kondensator (Ziel etwa 3,2 V).')]); } },
  { id: 'tag', lab: 'sch', cat: 'Tagesaufgabe', title: 'Tagesaufgabe: jeden Tag neue Zahlen', level: 2, daily: true,
    get text() { return 'Heute, ' + dateDE() + ': ' + withDaily(() => dbase().text) + ' (Die Zahlen gelten heute für alle.)'; },
    get hint() { return withDaily(() => dbase().hint); },
    start: () => withDaily(() => dbase().start()),
    solMake: () => withDaily(() => dbase().solMake()),
    check() { return withDaily(() => dbase().check()); } },
  { id: 'duell', lab: 'sch', cat: 'Duell', title: 'Duell: gleiche Aufgabe, schnellste Zeit', level: 2, duel: true,
    get text() { const sd = dcur().seed || '0000'; return 'Duell ' + sd + ': ' + withDuel(sd, () => dbaseDuel().text) + ' (Alle im Duell haben dieselben Zahlen.)'; },
    get hint() { return withDuel(dcur().seed || '0000', () => dbaseDuel().hint); },
    start: () => withDuel(dcur().seed || '0000', () => dbaseDuel().start()),
    solMake: () => withDuel(dcur().seed || '0000', () => dbaseDuel().solMake()),
    check() { return withDuel(dcur().seed || '0000', () => dbaseDuel().check()); } },
  { id: 'sf3', lab: 'sch', cat: 'Fehlersuche', title: 'Spannungsteiler zeigt falsche Spannung', level: 1, debug: true, faultLabel: 'R2', sol: 'Spannungsteiler',
    start: () => { const d = exOf('Spannungsteiler')(); d.parts[1] = ['R', 8, 2, 1, '1k', { l: 'R1' }]; d.parts[2] = ['R', 8, 6, 1, '2k', { l: 'R2', defect: 'open' }]; return d; },
    text: 'Der Spannungsteiler soll 6 V am Voltmeter liefern, zeigt aber etwas anderes. Welcher Widerstand ist defekt? Miss nach, wähle ihn aus und tippe auf „Fehler melden“.',
    hint: 'Fließt durch die Reihenschaltung kein Strom, fällt über dem unterbrochenen Widerstand die ganze Spannung ab.' },
  { id: 'sf4', lab: 'sch', cat: 'Fehlersuche', title: 'Z-Diode stabilisiert nicht', level: 2, debug: true, faultLabel: 'D1', sol: 'Z-Dioden-Stabilisierung',
    start: () => { const d = SCH_TASKS.find(t => t.id === 's9').solMake(); d.parts[4] = ['ZD', 14, 6, 3, '5.1', { l: 'D1', defect: 'open' }]; return d; },
    text: 'Die Last sollte 5,1 V bekommen, es liegen aber viel mehr an. Welches Bauteil ist defekt?',
    hint: 'Vergleiche die Spannung an der Last mit der erwarteten Stabilisierungsspannung. Eine unterbrochene Z-Diode begrenzt nichts mehr.' },
  { id: 'sf5', lab: 'sch', cat: 'Fehlersuche', title: 'Tiefpass filtert nicht', level: 2, debug: true, faultLabel: 'C1', sol: 'RC-Tiefpass',
    start: () => { const d = SCH_TASKS.find(t => t.id === 's10').solMake(); d.parts[3] = ['C', 10, 2, 1, '100n', { l: 'C1', defect: 'open' }]; return d; },
    text: 'Das RC-Glied lädt keinen Kondensator, die Spannung bleibt ganz oben. Welches Bauteil ist defekt?',
    hint: 'Ein unterbrochener Kondensator nimmt keine Ladung auf. Miss die Spannung am Kondensator über der Zeit.' },
];

/* ---- SimLab: weitere Aufgaben ---- */
const SIM_TASKS = [
  { id: 'zl', cat: 'Grundlagen', title: 'Zwei Lampen getrennt schalten', level: 1, sol: 'Zwei Lampen getrennt schaltbar',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', 1, 8, 1, '', { sw: 0 }], ['LAMP', 1, 12, 1, '230V 60W'], ['SPST', -3, 8, 1, '', { sw: 0 }], ['LAMP', -3, 12, 1, '230V 60W']], wires: [['blau', 3, 0, 3, 20, 1, 20, -3, 20, -3, 16], ['blau', 1, 16, 1, 20], ['braun', 1, 0, 1, 2]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Zwei Lampen sollen unabhängig voneinander mit je einem eigenen Schalter geschaltet werden. Beide Lampen hängen hinter dem Sicherungsautomaten. Verdrahte den Außenleiter (braun) über die Schalter zu den Lampen.',
    hint: 'Der Außenleiter verzweigt hinter dem Sicherungsautomaten in zwei Zweige: je Schalter und Lampe in Reihe. Beide Zweige liegen parallel.',
    check() { const sws = swList().filter(p => p.k === 'SPST'), lamps = lampList(); if (sws.length < 2 || lamps.length < 2) return needKinds([['Schalter', ['SPST'], 2], ['Lampen', ['LAMP'], 2]]);
      const out = [], seen = new Set(); const off = evalCombo(sws.slice(0, 2), [0, 0]).lamps(); out.push(RES(lamps.every(l => !off.get(l.id)), 'Beide Schalter aus: ' + (lamps.every(l => !off.get(l.id)) ? 'beide Lampen sind aus.' : 'eine Lampe leuchtet trotzdem.')));
      sws.slice(0, 2).forEach((s, i) => { const vals = [0, 0]; vals[i] = 1; const m = evalCombo(sws.slice(0, 2), vals).lamps(), lit = lamps.filter(l => m.get(l.id)); lit.forEach(l => seen.add(l.id)); out.push(RES(lit.length === 1, nm(s) + ' allein ein: ' + (lit.length === 1 ? 'genau eine Lampe leuchtet.' : lit.length + ' Lampen leuchten (soll genau 1).'))); });
      out.push(RES(seen.size === 2, seen.size === 2 ? 'Jeder Schalter gehört zu einer eigenen Lampe.' : 'Beide Schalter schalten dieselbe Lampe.')); return out.concat(chkProtect(lamps[0])); } },
  { id: 'oe', cat: 'Grundlagen', title: 'Öffner-Taster (Ruhestromkreis)', level: 1, sol: 'Öffner-Taster (Ruhekontakt)',
    start: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PBC', 1, 6, 1, ''], ['LAMP', 1, 10, 1, '230V 60W']], wires: [['blau', 3, 0, 3, 16, 1, 16, 1, 14]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Die Lampe soll im Ruhezustand leuchten und beim Drücken des Tasters ausgehen (Öffner). Verdrahte den Außenleiter vom Netz über Sicherungsautomat und Öffner-Taster zur Lampe.',
    hint: 'Der Öffner ist im Ruhezustand geschlossen. Außenleiter: Netz L → Sicherungsautomat → Öffner → Lampe.',
    check() { const L = firstLamp(), pb = sch.parts.find(p => p.k === 'PBC'); if (!L) return noLamp(); if (!pb) return needKinds([['Öffner-Taster', ['PBC'], 1]]);
      return chkSequence([{ press: [], expect: true, t: 0.2, text: 'Ruhezustand' }, { press: [pb], expect: false, text: 'Taster gedrückt' }, { press: [], expect: true, text: 'Taster losgelassen' }], L); } },
  { id: 'mo', cat: 'Drehstrom', title: 'Drehstrommotor schützen schalten', level: 4, sol: 'Drehstrommotor mit Schütz (Tippbetrieb)',
    start: () => ({ parts: [['NETZ3', 1, 0], ['PB', -9, 11, 0, '', { l: 'S1' }], ['SCHUETZ', -14, 14, 0, '230V'], ['MOTOR3', -12, 26, 0, '400V 2.2kW']], wires: [['blau', 7, 0, 7, 34, -17, 34, -17, 20, -14, 20]], scopes: [], tempo: 0.55, win: 0.04 }),
    text: 'Ein Drehstrommotor soll über ein Schütz geschaltet werden: Taster gedrückt = Motor läuft, losgelassen = Motor steht. Die Schützspule hängt an L1 und N. Verdrahte Steuerstromkreis (Taster, Spule) und Hauptstromkreis (drei Schließer, Motor). Die drei Außenleiter gehören jeweils auf einen eigenen Schließer.',
    hint: 'Steuerkreis: L1 → Taster → Spule A1, A2 → N (schon verdrahtet). Hauptstromkreis: je Außenleiter L1, L2, L3 durch einen Schließer des Schützes zu einer Klemme des Motors. Verwende die Schließer in den Reihen 1, 3 und 4 (der zweite Kontakt von oben ist ein Öffner).',
    check() { const pb = sch.parts.find(p => p.k === 'PB'), mo = sch.parts.find(p => p.k === 'MOTOR3'); if (!pb || !mo) return needKinds([['Taster', ['PB'], 1], ['Drehstrommotor', ['MOTOR3'], 1]]);
      const meas = press => { const E = simEval({ press: press ? [pb.id] : [] }); E.run(0.3, press ? [pb.id] : []); const w = E.c.elems.filter(e => e.type === 'RL' && /^w/.test(e.sub || '')); const pk = [0, 0, 0]; stepFine(E, 0.04, 2e-4, () => { w.forEach((e, i) => { pk[i] = Math.max(pk[i], Math.abs(e.i)); }); }); return pk; };
      const on = meas(true), off = meas(false), good = on.filter(x => x > 1).length;
      return [RES(good === 3, 'Taster gedrückt: ' + good + ' von 3 Motorwicklungen führen Strom' + (good === 3 ? '.' : ' (alle drei Außenleiter müssen am Motor ankommen).')), RES(off.every(x => x < 0.05), off.every(x => x < 0.05) ? 'Taster losgelassen: Der Motor steht.' : 'Der Motor bekommt auch ohne Tastendruck Strom.')]; } },
  { id: 'f6', cat: 'Fehlersuche', title: 'Zwei Lampen: eine bleibt dunkel', level: 2, debug: true, faultLabel: 'S2', sol: 'Zwei Lampen getrennt schaltbar',
    start: () => { const d = exOf('Zwei Lampen getrennt schaltbar')(); d.parts[2][5] = { l: 'S1', sw: 1 }; d.parts[4][5] = { l: 'S2', sw: 1, defect: 'open' }; return d; },
    text: 'Beide Schalter sind eingeschaltet, aber nur eine der beiden Lampen leuchtet. Finde das defekte Bauteil mit Spannungsmessung.',
    hint: 'Miss die Spannung vor und hinter dem Schalter der dunklen Lampe. Wo die Spannung verschwindet, liegt der Fehler.' },
  { id: 'pe1', cat: 'Hausinstallation', title: 'Schutzleiter nachrüsten (Lampen)', level: 2, sol: 'Zwei Lampen getrennt schaltbar',
    start: () => (EXAMPLES.find(e => e.name === 'Zwei Lampen getrennt schaltbar').raw)(),
    solMake: () => exOf('Zwei Lampen getrennt schaltbar')(),
    text: 'Die beiden Lampen funktionieren, aber bei der Abnahme fällt auf: Die Gehäuse sind nicht geerdet. Rüste den Schutzleiter (PE, grün-gelb) vom Netz zu beiden Lampen nach. Tipp: Tippe eine Lampe an und schalte „Körperschluss“ ein. Ohne PE gibt es einen lebensgefährlichen Schlag.',
    hint: 'Der PE-Anschluss der Lampe ist der kurze Anschluss unten am Gehäuse (grüner Punkt). Zieh eine grün-gelbe Ader vom PE des Netzes dorthin, am besten unterhalb der Schaltung entlang.',
    check() { const L = chkPE(); return L.length ? L : [RES(false, 'Es fehlt ein Netz oder ein Gerät.')]; } },
  { id: 'pe2', cat: 'Drehstrom', title: 'Schutzleiter nachrüsten (Motor)', level: 3, sol: 'Drehstrommotor mit Schütz (Tippbetrieb)',
    start: () => (EXAMPLES.find(e => e.name === 'Drehstrommotor mit Schütz (Tippbetrieb)').raw)(),
    solMake: () => exOf('Drehstrommotor mit Schütz (Tippbetrieb)')(),
    text: 'Der Drehstrommotor läuft über das Schütz, aber sein Gehäuse ist nicht geerdet. Verbinde den PE-Anschluss des Motors mit dem PE des Drehstromnetzes (grün-gelb).',
    hint: 'Der PE-Anschluss sitzt rechts neben dem Motor (grüner Punkt). Das Netz hat fünf Anschlüsse: L1, L2, L3, N und PE.',
    check() { const L = chkPE(); return L.length ? L : [RES(false, 'Es fehlt ein Netz oder ein Gerät.')]; } },

  { id: 'sl1', cat: 'Leitungen und Messen', title: 'Leitung auslegen: Spannungsfall', level: 2, sol: 'Leitung: Spannungsfall bei langer Zuleitung',
    start: () => houseLine({ cab: '1.5mm2 50m' }), solMake: () => houseLine({ cab: '2.5mm2 50m' }),
    text: 'Ein 2-kW-Heizlüfter hängt an 50 m Leitung mit 1,5 mm². Am Gerät sollen mindestens 97 % der Netzspannung ankommen (höchstens 3 % Spannungsfall). Ändere den Querschnitt beider Leitungen (W1 und W2: Leitung antippen, Wert ändern) so, dass es passt, aber nicht größer als nötig.',
    hint: 'Der Widerstand einer Leitung ist R = 0,0178 · Länge / Querschnitt (je Leiter, in Ω). Hin- und Rückleiter zählen. Probiere 2.5mm2 oder 4mm2 und schau auf das Oszilloskop oder miss mit dem Voltmeter.',
    check() { const W = sch.parts.filter(p => p.k === 'CABLE'), H = sch.parts.find(p => p.k === 'HEAT'), N = sch.parts.find(p => p.k === 'NETZ'); if (W.length < 2 || !H || !N) return [RES(false, 'Zwei Leitungen, Heizlüfter und Netz müssen vorhanden sein.')];
      const E = simEval({}), he = E.c.elems.find(e => e.type === 'R' && e.part && e.part.id === H.id && e.lamp), nl = E.c.nodeOfKey(gk(...pinsOf(N)[0])), nn = E.c.nodeOfKey(gk(...pinsOf(N)[1])); let mx = 0, vt = 1e-9; for (let i = 0; i < 400; i++) { E.s.step(2e-4); if (he) mx = Math.max(mx, Math.abs(he.i / he.g)); vt = Math.max(vt, Math.abs((nl > 0 ? E.s.v[nl] : 0) - (nn > 0 ? E.s.v[nn] : 0))); }
      const rel = mx / vt, As = W.slice(0, 2).map(p => LS.cableOf(p.v).A), same = Math.abs(As[0] - As[1]) < 1e-6;
      return [RES(rel >= 0.97, 'Spannung am Heizlüfter: ' + (rel * 100).toFixed(1) + ' % der Spannung am Netzanschluss (verlangt: mindestens 97 %).'), RES(same, same ? 'Hin- und Rückleiter haben denselben Querschnitt.' : 'Hin- und Rückleiter (W1, W2) sollen denselben Querschnitt haben.'), RES(As[0] <= 4.0001, As[0] <= 4.0001 ? 'Querschnitt ist nicht übertrieben groß.' : 'Der Querschnitt ist unnötig groß (4 mm² reichen).')]; } },
  { id: 'sl2', cat: 'Leitungen und Messen', title: 'Automat zur Leitung passend wählen', level: 2, sol: 'Leitungsschutz: Leitung zu schwach',
    start: () => houseLine({ cab: '2.5mm2 10m', ln: 'B32', lv: '230V 3000W' }), solMake: () => houseLine({ cab: '2.5mm2 10m', ln: 'B16', lv: '230V 3000W' }),
    text: 'Ein 3-kW-Heizlüfter hängt an einer Leitung mit 2,5 mm². Der Automat ist mit B32 viel zu groß. Wähle einen passenden Automaten (LSS antippen, Wert ändern): Er muss den Betriebsstrom des Geräts tragen, darf aber die Leitung nicht überfordern.',
    hint: 'Betriebsstrom: I = P / U = 3000 W / 230 V = 13 A. Die Leitung 2,5 mm² verträgt etwa 23 A. Der Nennstrom In des Automaten muss zwischen beiden liegen: B16 oder B20.',
    check() { const L = sch.parts.find(p => p.k === 'LSS'), C = sch.parts.find(p => p.k === 'CABLE'), H = sch.parts.find(p => p.k === 'HEAT'); if (!L || !C || !H) return [RES(false, 'Automat, Leitung und Heizlüfter fehlen.')];
      const In = lssIn(L), Iz = IZ_OF(C.v), Ibr = (parseFloat(String(H.v).replace(/^\D*\d+V\s*/, '')) || 3000) / 230;
      return [RES(In >= Ibr, 'Nennstrom ' + In + ' A ' + (In >= Ibr ? 'trägt' : 'trägt nicht') + ' den Betriebsstrom (' + Ibr.toFixed(1) + ' A).'), RES(In <= Iz, 'Nennstrom ' + In + ' A ' + (In <= Iz ? 'schützt' : 'schützt nicht') + ' die Leitung (Belastbarkeit ' + Iz + ' A).')]; } },
  { id: 'sl3', cat: 'Leitungen und Messen', title: 'Fehlersuche: Isolationsfehler finden', level: 3, debug: true, faultLabel: 'E2', sol: 'Messen: Isolation zwischen Gerät und Schutzleiter',
    start: () => { const d = exOfRaw3(); return d; },
    text: 'Sobald du den Automaten einschaltest, löst er sofort aus. Irgendwo hat ein Gerät Körperschluss. Schalte den Automaten aus (freischalten), schließe das Isolationsmessgerät zwischen den Außenleiter-Anschluss eines Heizlüfters und seinen PE-Anschluss und miss alle drei Geräte durch. Wähle das defekte Gerät aus und tippe auf „Fehler melden“.',
    hint: 'Das Messgerät steht bei Bauteile → Messen („Isolationsmessgerät“). Ein gesundes Gerät zeigt > 500 MΩ. Das defekte zeigt einen sehr kleinen Wert. Die Schalter der Heizlüfter müssen dabei geschlossen sein.' },
  { id: 'sl4', cat: 'Leitungen und Messen', title: 'Auslösebedingung: Schleifenimpedanz', level: 3, sol: 'Messen: Schleifenimpedanz am Verbraucher',
    start: () => houseLine({ cab: '1.5mm2 120m', pe: 'cable', inst: 'ZS' }), solMake: () => houseLine({ cab: '2.5mm2 120m', pe: 'cable', inst: 'ZS' }),
    text: 'Der Stromkreis mit Automat B16 ist über 120 m Leitung mit 1,5 mm² angeschlossen. Das Zs-Messgerät zeigt die Schleifenimpedanz. Der Automat löst im Fehlerfall nur schnell genug aus, wenn Zs ≤ 230 V / (5 · 16 A) = 2,9 Ω ist. Ändere die Querschnitte aller drei Leitungen (W1, W2, W3) so, dass die Bedingung erfüllt ist.',
    hint: 'Die Schleife besteht aus Außenleiter (W1) und Schutzleiter (W3), dazu kommt der Netzinnenwiderstand. Größerer Querschnitt, kleinerer Widerstand. Probiere 2.5mm2.',
    check() { const H = sch.parts.find(p => p.k === 'HEAT'), L = sch.parts.find(p => p.k === 'LSS'), C = sch.parts.filter(p => p.k === 'CABLE'); if (!H || !L || C.length < 3) return [RES(false, 'Der Stromkreis mit drei Leitungen (W1, W2, W3) fehlt.')];
      const pn = pinsOf(H); let z = NaN; try { z = window.SchaltInstr.staticR(pn[0], pn[2], 1, 'zs'); } catch (e) {}
      const lim = 230 / (5 * lssIn(L)); return [RES(isFinite(z) && z <= lim, 'Schleifenimpedanz am Heizlüfter: ' + (isFinite(z) ? z.toFixed(2) : '∞') + ' Ω (verlangt: höchstens ' + lim.toFixed(2) + ' Ω).'), RES(C.every(p => LS.cableOf(p.v).A <= 6.0001), 'Die Querschnitte sind nicht übertrieben groß (höchstens 6 mm²).')]; } },
  { id: 'sl5', cat: 'Leitungen und Messen', title: 'Fehlersuche: Schutzleiter unterbrochen', level: 3, debug: true, faultLabel: 'W3b', sol: 'Messen: Isolation zwischen Gerät und Schutzleiter',
    start: () => houseLine({ cab: '1.5mm2 10m', pe: 'chain', def: { W3b: 'open' } }),
    text: 'Beim Prüfen der Anlage stellt sich heraus: Der Schutzleiter des Heizlüfters hat keinen Durchgang. Er besteht aus drei Leitungsabschnitten (W3a, W3b, W3c). Schalte frei, miss mit dem Durchgangsprüfer abschnittsweise und finde den unterbrochenen Abschnitt. Wähle ihn aus und tippe auf „Fehler melden“.',
    hint: 'Der Durchgangsprüfer steht bei Bauteile → Messen. Setze ihn nacheinander über die Abschnitte (an ihre Anschlüsse). Ein intakter Abschnitt zeigt wenige Ohm, der unterbrochene „∞ Ω (kein Durchgang)“.' },
  { id: 'sl6', cat: 'Leitungen und Messen', title: 'Fehlersuche: Neutralleiter unterbrochen', level: 3, debug: true, faultLabel: 'W2', sol: 'Leitung: Spannungsfall bei langer Zuleitung',
    start: () => houseLine({ cab: '1.5mm2 10m', pe: 'cable', def: { W2: 'open' } }),
    text: 'Der Heizlüfter bleibt kalt, obwohl der Automat eingeschaltet ist und am Außenleiter Spannung anliegt. Eine der Leitungen ist unterbrochen. Miss mit dem Voltmeter, wo die Spannung verschwindet, wähle die defekte Leitung aus und tippe auf „Fehler melden“. Achtung: Hinter einer Unterbrechung im Neutralleiter steht das Gerät unter Spannung gegen Erde!',
    hint: 'Miss die Spannung zwischen dem Außenleiteranschluss des Heizlüfters und seinem Neutralleiteranschluss, dann zwischen N hinter der Leitung und PE. Wo 230 V anliegen müssten, aber nichts ankommt, liegt der Fehler.' },
];

// Drei Heizlüfter mit eigenem Schalter und Schutzleiter; E2 hat einen versteckten Körperschluss
const exOfRaw3 = () => {
  const d = { parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', -4, 6, 1, '', { sw: 1, l: 'S1' }], ['SPST', -8, 6, 1, '', { sw: 1, l: 'S2' }], ['SPST', -12, 6, 1, '', { sw: 1, l: 'S3' }], ['HEAT', -4, 10, 1, '230V 2000W', { l: 'E1' }], ['HEAT', -8, 10, 1, '230V 2000W', { l: 'E2', defect: 'body' }], ['HEAT', -12, 10, 1, '230V 2000W', { l: 'E3' }]],
    wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -4, 6, -8, 6, -12, 6], ['blau', 3, 0, 3, 16, -4, 16, -8, 16, -12, 16], ['blau', -4, 14, -4, 16], ['blau', -8, 14, -8, 16], ['blau', -12, 14, -12, 16]], scopes: [], tempo: 0.6, win: 0.04 };
  return window.addPE ? window.addPE(d) : d;
};
TASKS.push(...SIM_TASKS, ...SCH_TASKS, ...CODE_TASKS, ...PI_TASKS);


/* ---- Schutzleiter-Prüfung für Haus-Aufgaben ---- */
function chkPE() {
  const OFF = { LAMP: 2, HEAT: 2, MOTOR3: 3 }, devs = sch.parts.filter(p => OFF[p.k] != null && (p.k !== 'LAMP' || /230\s*V/i.test(String(p.v || '')))), src = sch.parts.find(p => p.k === 'NETZ' || p.k === 'NETZ3');
  if (!devs.length || !src) return [];
  const E = simEval({}), sp = pinsOf(src)[src.k === 'NETZ' ? 2 : 4], sn = E.c.nodeOfKey(gk(...sp)); const bad = devs.filter(p => { const q = pinsOf(p)[OFF[p.k]]; const n = E.c.nodeOfKey(gk(q[0], q[1])); if (n >= 0 && n === sn) return false; if (!sch.parts.some(c => c.k === 'CABLE')) return true; try { return !(window.SchaltInstr.staticR(q, sp, 1, 'ohm') < 5); } catch (e) { return true; } });
  return [RES(!bad.length, bad.length ? 'Schutzleiter (PE, grün-gelb) fehlt bei: ' + bad.map(nm).join(', ') + '. Das Gehäuse muss mit PE verbunden sein.' : 'Alle Geräte sind an den Schutzleiter (PE) angeschlossen.')];
}
['aus', 'reihe', 'parallel', 'wechsel', 'kreuz', 'impuls', 'schutz', 'schuetz', 'selbst', 'zl', 'oe', 'mo'].forEach(id => {
  const t = TASKS.find(x => x.id === id); if (!t || t.debug) return; const c0 = t.check;
  t.check = function () {
    const L = c0.call(this).concat(chkPE());
    if (L.every(l => l.ok)) return L;
    try {   // Hinweise zum Fortschritt: fehlende Verbindungen im Vergleich mit der Musterlösung, damit jede Änderung sichtbar etwas bringt
      const mk = t.solMake || exOf(t.sol); if (!mk) return L;
      const N = schNetCheck(mk), miss = N.filter(l => !l.ok && /fehlt eine Verbindung/.test(l.text)), done = N.filter(l => l.ok).length, tot = done + miss.length;
      if (tot && miss.length) { L.push(RES(false, 'Fortschritt der Verdrahtung: ' + done + ' von ' + tot + ' Verbindungen der Musterlösung sind da.')); miss.slice(0, 4).forEach(l => L.push(RES(false, 'Hinweis: ' + l.text))); }
    } catch (e) { /* Hinweise sind nur Zugabe */ }
    return L;
  };
  t.text += ' Vergiss den Schutzleiter (PE, grün-gelb) von den Geräten zum PE des Netzes nicht.';
});

window.TaskTestWith = (id, make) => { const t = labTasks().find(x => x.id === id); loadCircuit(Object.assign(buildExample({ name: t.title, make }), { task: id })); taskAns[id] = {}; const L = t.check(); return { pct: Math.round(100 * L.filter(l => l.ok).length / L.length), ok: L.every(l => l.ok), lines: L.map(l => (l.ok ? '+ ' : '- ') + l.text) }; };   // Testhilfe: eine Aufgabe gegen eine selbst gebaute Schaltung prüfen (Beispiel: node-/Browser-Test der Varianten)
window.TaskTest = only => labTasks().filter(t => !only || only.includes(t.id)).map(t => {
  const out = { id: t.id };
  try {
    if (!t.debug) { loadCircuit(Object.assign(buildExample({ name: t.title, make: t.solMake || exOf(t.sol) }), { task: t.id })); taskAns[t.id] = t.solAns ? t.solAns() : {}; const L = t.check(); out.pct = Math.round(100 * L.filter(l => l.ok).length / L.length); out.bad = L.filter(l => !l.ok).map(l => l.text);
      try { taskAns[t.id] = {}; loadCircuit(Object.assign(buildExample({ name: t.title, make: t.start }), { task: t.id })); const L2 = t.check(); out.startPct = Math.round(100 * L2.filter(l => l.ok).length / L2.length); } catch (e) { out.startErr = String(e.message || e).slice(0, 120); } }
    else { loadCircuit(Object.assign(buildExample({ name: t.title, make: t.start }), { task: t.id })); const L = lampList(); const E = simEval({}); E.run(0.2); out.lampsOn = L.filter(p => E.lamps().get(p.id)).length; out.events = E.ev.map(e => e.text); }
  } catch (e) { out.err = String(e.stack || e).slice(0, 300); }
  return out;
});
const taskDone = () => { try { return JSON.parse(localStorage.getItem('sim.done') || '{}'); } catch (e) { return {}; } };
function markDone(id, pct) { try { const d = taskDone(); if ((d[id] || 0) < pct) d[id] = pct; localStorage.setItem('sim.done', JSON.stringify(d)); } catch (e) {} if (window.Badges) window.Badges.result(id, pct); if (id === 'tag' && pct >= 100) dailySolved(); if (id === 'duell' && pct >= 100) duelSolved(); if (pct >= 100 && ESC_STEPS.some(s => s.id === id) && !escOpen()) escMark(id); }
function logResult(id, pct, extra) {
  try { const a = JSON.parse(localStorage.getItem('sim.results') || '[]'); a.push(Object.assign({ t: Date.now(), name: userName(), task: id, pct }, extra || {})); localStorage.setItem('sim.results', JSON.stringify(a.slice(-300))); } catch (e) {}
}

function speakPart(p) { if (!window.Speak) return; const vt = valueText(p); window.Speak.part(p.k, vt ? 'In dieser Schaltung habe ich den Wert ' + vt + '.' : ''); }

/* ============ Fehler-Würfel: ein zufälliger, versteckter Fehler in der aktuellen Schaltung ============ */
const DICE_KINDS = ['R', 'C', 'CE', 'L', 'LED', 'D', 'ZD', 'NPN', 'PNP', 'LAMP', 'SPST', 'SPDT', 'PB', 'LDR', 'NTC', 'PTC', 'FUSE', 'NMOS', 'PMOS'];
function fmtSI(x) { const u = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']]; for (const [f, sfx] of u) if (x >= f * 0.9995) return String(parseFloat((x / f).toPrecision(3))) + sfx; return String(x); }
function diceText(dc) {
  const p = byPart(dc.id), nmx = p ? nm(p) : 'das Bauteil';
  const how = dc.kind === 'open' ? 'war unterbrochen (kein Strom fließt hindurch)' : dc.kind === 'short' ? 'hatte einen Kurzschluss (leitet wie ein Draht)' : 'hatte einen falschen Wert: ' + (p ? p.v : '?') + ' statt ' + dc.orig.v;
  return nmx + ' (' + (p ? KD(p).name : '') + ') ' + how + '.';
}
function rollFault() {
  if (simMode) { toast('Zum Würfeln zurück in den Zeichenmodus'); return; }
  if (sch.dice) diceFix(true);
  const c = sch.parts.filter(p => DICE_KINDS.includes(p.k) && !p.defect);
  if (c.length < 2) { toast('Zu wenige Bauteile zum Würfeln. Lade ein Beispiel oder zeichne mehr.'); return; }
  const p = c[Math.floor(Math.random() * c.length)], kinds = ['open'];
  if (!['SPST', 'SPDT', 'PB', 'FUSE'].includes(p.k)) kinds.push('short');
  if (['R', 'C', 'CE', 'L', 'NTC', 'PTC'].includes(p.k) && isFinite(protoNum(p.v))) kinds.push('wert');
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  sch.dice = { id: p.id, kind, orig: { defect: p.defect, v: p.v }, tries: 0, solved: false, msg: '' };
  if (kind === 'wert') p.v = fmtSI(protoNum(p.v) * (Math.random() < 0.5 ? 10 : 0.1)); else p.defect = kind;
  sel = null; commit(); toast('🎲 Gewürfelt: In der Schaltung steckt jetzt ein Fehler. Starte die Simulation, miss nach und finde das Bauteil.');
}

/* ============ Schaltungs-Detektiv: acht Fälle mit Geschichte, der Fehler ist versteckt, gefunden wird mit dem Multimeter ============ */
const DET_CASES = [
  { ex: 'LED mit Vorwiderstand', part: 'LED1', kind: 'open', title: 'Die Notleuchte bleibt dunkel', story: 'Eine Notleuchte aus Batterie, Schalter, Vorwiderstand und LED soll leuchten. Der Schalter ist zu, die Batterie ist neu, aber die LED bleibt dunkel.' },
  { ex: 'LED mit Vorwiderstand', part: 'R1', kind: 'short', title: 'Ein kurzer Blitz und dann nichts', story: 'Beim Einschalten blitzt die LED einmal hell auf und ist danach dunkel. Der Kunde ärgert sich über die „kaputte LED“. Finde die eigentliche Ursache.' },
  { ex: 'Spannungsteiler', part: 'R2', kind: 'wert', title: 'Am Ausgang liegt zu viel Spannung', story: 'Der Spannungsteiler soll eine kleinere Spannung liefern. Am Ausgang liegt aber fast die ganze Batteriespannung an.' },
  { ex: 'Transistor als Schalter', part: 'T1', kind: 'open', title: 'Schalter an, LED aus', story: 'Der Schalter ist geschlossen, der Basiswiderstand ist angeschlossen, aber die LED im Kollektorkreis bleibt aus.' },
  { ex: 'Z-Dioden', part: 'D1', kind: 'short', title: 'Die Stabilisierung liefert 0 Volt', story: 'Die Z-Dioden-Schaltung soll 5,1 V für die Elektronik liefern. Am Ausgang liegt nichts an.' },
  { ex: 'Einweggleichrichter', part: 'D1', kind: 'open', title: 'Das Netzteil liefert keine Gleichspannung', story: 'Am Lastwiderstand eines kleinen Netzteils liegt keine Spannung an, obwohl der Generator läuft.' },
  { ex: 'RC-Tiefpass', part: 'C1', kind: 'open', title: 'Der Tiefpass filtert nichts', story: 'Der Tiefpass soll hohe Frequenzen dämpfen. Am Ausgang kommt aber immer das volle Signal an, egal wie hoch die Frequenz ist.' },
  { ex: 'Dämmerungsschalter (LDR)', part: 'T1', kind: 'short', title: 'Die Hoflampe leuchtet immer', story: 'Der Dämmerungsschalter soll die LED nur bei Dunkelheit einschalten. Sie leuchtet aber auch bei hellem Licht.' }];
function startCase(i) {
  const c = DET_CASES[i], e = EXAMPLES.filter(exOk).find(x => x.name.toLowerCase().includes(c.ex.toLowerCase())); if (!e) { toast('Beispiel nicht gefunden'); return; }
  const go = () => {
    loadCircuit(buildExample(e)); sch.name = 'Detektiv: Fall ' + (i + 1);
    const p = sch.parts.find(q => q.l === c.part); if (!p) { toast('Fall konnte nicht aufgebaut werden'); return; }
    sch.dice = { id: p.id, kind: c.kind, orig: { defect: p.defect, v: p.v }, tries: 0, solved: false, msg: '', case: i };
    if (c.kind === 'wert') p.v = fmtSI(protoNum(p.v) * 10); else p.defect = c.kind;
    sel = null; commit(); toast('🕵️ Fall ' + (i + 1) + ': ' + c.title);
  };
  if (sch.parts.length || sch.wires.length) { try { saveNamed(); } catch (x) {} }
  go();
}
function openDetective() {
  if (LAB !== 'sch') { location.href = 'schaltplan.html?detektiv'; return; }
  sheet('🕵️ Schaltungs-Detektiv', b => {
    const dn = taskDone();
    b.innerHTML = '<p style="margin-top:0">Acht Fälle. In jeder Schaltung steckt ein versteckter Fehler. Starte die Simulation, nutze das Multimeter („Messen“) und finde Bauteil <b>und</b> Fehlerart. Ohne Raten: Jeder falsche Versuch kostet Punkte.</p>' +
      DET_CASES.map((c, i) => `<button class="row" data-i="${i}"><div class="grow"><b>Fall ${i + 1}: ${esc(c.title)}</b><small>${(dn['det' + (i + 1)] || 0) > 0 ? '✓ gelöst, ' + dn['det' + (i + 1)] + ' %' : 'noch offen'}</small></div></button>`).join('');
    b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; const bd = document.querySelector('.backdrop'); if (bd) bd.remove(); startCase(+r.dataset.i); });
  });
}
function diceFix(silent) {
  const dc = sch.dice; if (!dc) return; const p = byPart(dc.id);
  if (p) { if (dc.kind === 'wert') p.v = dc.orig.v; else { if (dc.orig.defect) p.defect = dc.orig.defect; else delete p.defect; } }
  delete sch.dice; if (!silent) { commit(); toast('Fehler behoben, die Schaltung ist wieder in Ordnung'); }
}
function diceReport() {
  const dc = sch.dice; if (!dc) return;
  const p = sel && sel.t === 'part' && byPart(sel.id); if (!p) { toast('Erst das vermutete Bauteil antippen'); return; }
  if (dc.case != null) {                                          // Detektiv-Fall: auch die Fehlerart angeben
    sheet('Welche Fehlerart vermutest du bei ' + nm(p) + '?', (b, close) => {
      b.innerHTML = '<div class="btns" style="flex-direction:column;gap:8px"><button class="btn" data-k="open">Unterbrochen (kein Strom fließt hindurch)</button><button class="btn" data-k="short">Kurzschluss (leitet wie ein Draht)</button><button class="btn" data-k="wert">Falscher Wert (zu groß oder zu klein)</button></div>';
      b.querySelectorAll('[data-k]').forEach(x => { x.onclick = () => { close(); diceJudge(p, x.dataset.k); }; });
    });
    return;
  }
  diceJudge(p, null);
}
function diceJudge(p, kindGuess) {
  const dc = sch.dice; if (!dc) return;
  dc.tries++;
  if (p.id === dc.id && (kindGuess == null || kindGuess === dc.kind)) {
    dc.solved = true; dc.msg = '🎉 Gefunden nach ' + dc.tries + (dc.tries === 1 ? ' Versuch' : ' Versuchen') + '! ' + diceText(dc);
    const score = Math.max(30, 100 - 20 * (dc.tries - 1));
    try { const dn = taskDone(); dn['dice'] = Math.max(dn['dice'] || 0, score); if (dc.case != null) { const k = 'det' + (dc.case + 1); dn[k] = Math.max(dn[k] || 0, score); } localStorage.setItem('sim.done', JSON.stringify(dn)); } catch (e) {}
    if (window.LochFX) LochFX.pass(100);
    if (window.Badges) { window.Badges.stat('dice'); if (dc.case != null) { const dn = taskDone(); window.Badges.stat('detektiv', Object.keys(dn).filter(k => /^det\d+$/.test(k) && dn[k] > 0).length, 'max'); } window.Badges.confetti(false); window.Badges.chime(false); }
  } else if (p.id === dc.id) dc.msg = '✗ ' + nm(p) + ' ist das richtige Bauteil, aber die Fehlerart stimmt nicht. Miss genauer: Liegt Spannung an? Fließt Strom? (Versuch ' + dc.tries + ')';
  else dc.msg = '✗ ' + nm(p) + ' ist in Ordnung. Miss weiter. (Versuch ' + dc.tries + ')';
  if (!dc.solved && window.LochFX) { const v = LochFX.variant('fail', { vol: 0.6 }); if (v) LochFX.say(v.text); }
  refreshUI();
}
function diceCardHtml() {
  const dc = sch.dice; if (!dc) return '';
  const done = dc.solved;
  const cs = dc.case != null ? DET_CASES[dc.case] : null;
  return `<div class="card task"><h4>${cs ? '🕵️ Schaltungs-Detektiv · Fall ' + (dc.case + 1) : '🎲 Fehler-Würfel'}</h4>${cs ? '<b>' + esc(cs.title) + '</b><p class="hint2">' + esc(cs.story) + '</p>' : ''}<p class="hint2">${done ? esc(dc.msg) : (cs ? 'Starte die Simulation und wähle unten bei „Messen“ das Multimeter. Miss, vergleiche mit dem Erwartbaren, tippe das vermutete Bauteil an und melde es mit der Fehlerart.' : 'In dieser Schaltung steckt ein versteckter Fehler. Starte die Simulation, miss Spannungen und Ströme und vergleiche mit dem, was du erwartest. Tippe dann das vermutete Bauteil an und melde es.')}</p>`
    + (done ? '' : `<div class="row2"><button class="btn pri" data-a="dreport">Fehler melden (gewähltes Bauteil)</button></div>${dc.msg ? `<p class="hint2">${esc(dc.msg)}</p>` : ''}`)
    + `<div class="row2"><button class="btn" data-a="dreveal">${done ? 'Fehler beheben' : 'Auflösung zeigen'}</button>${cs ? '<button class="btn" data-a="ddet">Fälle</button>' : '<button class="btn" data-a="droll">Neu würfeln</button>'}</div></div>`;
}
/* Antworten zu Mess- und Auswahlaufgaben (Zahlenfelder und Auswahl), bleiben beim Neuzeichnen der Seitenleiste erhalten */
const taskAns = {}, thinkAns = {};
/* Denkfragen (denkfragen.js): eine Frage vor dem Start, sofortige Rückmeldung, kein Einfluss auf das Ergebnis */
function thinkHtml(t) {
  const q = window.THINK && window.THINK[t.id]; if (!q) return '';
  const a = thinkAns[t.id];
  let h = `<div style="margin:8px 0;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--panel)"><div style="font-size:12px;color:var(--accent);font-weight:700;margin-bottom:3px">🤔 Denkfrage: Was erwartest du?</div><div style="font-size:13px;margin-bottom:6px">${esc(q.q)}</div>`;
  q.opts.forEach((o, i) => {
    const on = a === i, col = a == null ? '' : (i === q.right ? 'border-color:#4cd964;' : (on ? 'border-color:#ff8a7a;' : 'opacity:.6;'));
    h += `<button class="btn" style="display:block;width:100%;height:auto;min-height:34px;margin:3px 0;padding:6px 10px;text-align:left;font-weight:500;${col}" data-a="think" data-i="${i}" ${a != null ? 'disabled' : ''}>${a != null && i === q.right ? '✓ ' : (on ? '✗ ' : '')}${esc(o)}</button>`;
  });
  if (a != null) h += `<div style="font-size:12px;margin-top:6px;color:${a === q.right ? '#4cd964' : '#ffb340'}"><b>${a === q.right ? 'Richtig gedacht.' : 'Nicht ganz.'}</b> ${esc(q.why)}</div>`;
  return h + '</div>';
}
window.TaskAns = { get: id => taskAns[id] || {}, set: (id, k, v) => { (taskAns[id] = taskAns[id] || {})[k] = v; }, setAll: (id, o) => { taskAns[id] = Object.assign({}, o); }, clear: id => { delete taskAns[id]; } };
function taskAnswerHtml(t) {
  const a = taskAns[t.id] || {};
  let h = '';
  (t.fields || []).forEach(f => { h += `<div class="kv" style="gap:6px"><span style="color:var(--fg)">${esc(f.label)}</span><span><input type="text" inputmode="decimal" autocomplete="off" style="width:84px;text-align:right;padding:6px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--fg)" value="${esc(a[f.id] == null ? '' : a[f.id])}" oninput="TaskAns.set('${t.id}','${f.id}',this.value)" data-tf="${f.id}"> ${esc(f.unit || '')}</span></div>`; });
  (t.choices || []).forEach(q => { h += `<div style="margin:6px 0"><div style="font-size:13px;margin-bottom:3px">${esc(q.q)}</div>` + q.opts.map((o, i) => `<label style="display:flex;gap:6px;align-items:flex-start;font-size:13px;padding:2px 0"><input type="radio" name="tc_${t.id}_${q.id}" ${a[q.id] === i ? 'checked' : ''} onchange="TaskAns.set('${t.id}','${q.id}',${i})"> <span>${esc(o)}</span></label>`).join('') + '</div>'; });
  return h;
}
function taskCardHtml() {
  if (!sch.task) return '';
  const t = TASKS.find(x => x.id === sch.task); if (!t) return '';
  let h = `<div class="card task"><h4>Aufgabe · ${esc(t.cat)}</h4><b>${esc(t.title)}</b><p class="hint2">${esc(t.text)}</p>`;
  h += thinkHtml(t);
  if (t.fields || t.choices) h += taskAnswerHtml(t);
  h += `<div class="row2"><button class="btn pri" data-a="${t.debug ? 'treport' : 'tcheck'}">${t.debug ? 'Fehler melden (gewähltes Bauteil)' : 'Lösung prüfen'}</button></div><div class="row2"><button class="btn" data-a="thint">Tipp</button><button class="btn" data-a="tstop">Aufgabe beenden</button></div><div class="row2"><button class="btn" data-a="thand">Abgeben (QR)</button></div>`;
  if (t.daily) { const di = dailyInfo(); h += '<p class="hint2">🔥 Serie: ' + di.streak + (di.streak === 1 ? ' Tag' : ' Tage') + (di.doneToday ? ' · heute geschafft ✓' : ' · heute noch offen') + '</p>'; }
  if (t.rand) h += '<div class="row2"><button class="btn" data-a="trand">🎲 Neue Zahlen würfeln</button></div>';
  if (t.loch) h += (taskDone()[t.id] || 0) >= 100 ? `<div class="row2"><a class="btn pri" href="layout.html?aufgabe=${t.loch}" style="text-decoration:none;text-align:center">Weiter: im LochLab aufbauen</a></div>` : '<p class="hint2">Wenn der Plan stimmt, geht es im LochLab weiter: dort baust du dieselbe Schaltung auf der Platine auf.</p>';
  if (taskRes && taskRes.id === t.id) h += `<ul class="tl">${taskRes.lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}${!l.ok && l.why ? `<details style="margin:3px 0 2px;color:var(--mute);font-size:12px"><summary style="cursor:pointer;color:var(--accent)">Warum?</summary>${esc(l.why)}</details>` : ''}</li>`).join('')}</ul>` + (taskRes.pct != null ? `<div class="score ${taskRes.pct === 100 ? 'ok' : ''}">${taskRes.pct === 100 ? '🎉 Geschafft!' : taskRes.pct + ' % richtig'}</div>` : '');
  return h + '</div>';
}
function runTaskCheck() {
  const t = TASKS.find(x => x.id === sch.task); if (!t) return;
  let lines; try { lines = t.check(); } catch (e) { console.error(e); lines = [RES(false, 'Die Prüfung konnte nicht ausgeführt werden: ' + e.message)]; }
  if (window.Warum) window.Warum.decorate(lines);
  const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1));
  taskRes = { id: t.id, lines, pct }; markDone(t.id, pct); logResult(t.id, pct); refreshUI();
  /* Fanfare, Konfetti oder Ding: übernimmt LochFX.pass über Badges.result in markDone */
}
let reports = 0;
function reportFault() {
  const t = TASKS.find(x => x.id === sch.task); if (!t || !t.debug) return;
  const p = sel && sel.t === 'part' && byPart(sel.id); if (!p) { toast('Erst das vermutete Bauteil antippen'); return; }
  reports++; const ok = (p.l || '') === t.faultLabel;
  taskRes = { id: t.id, lines: [RES(ok, ok ? nm(p) + ' ist tatsächlich defekt. Gut gefunden!' : nm(p) + ' ist in Ordnung. Miss weiter. (Versuch ' + reports + ')')], pct: ok ? 100 : null };
  if (ok) { markDone(t.id, Math.max(30, 100 - 20 * (reports - 1))); logResult(t.id, Math.max(30, 100 - 20 * (reports - 1)), { versuche: reports }); reports = 0; }
  else if (window.LochFX) LochFX.variant('fail');
  refreshUI();
}
/* Tipp-Stufen für Aufgaben: 1 Tipp, 2 konkreter Hinweis (erster offener Prüfpunkt bzw. Bauteiltyp des Fehlers), 3 Musterlösung bzw. defektes Bauteil */
function taskHint(t) {
  if (!window.Auswertung) { sheet('Tipp', bb => { bb.innerHTML = '<p style="margin-top:0">' + esc(t.hint) + '</p>'; }); return; }
  window.Auswertung.hint({
    id: t.id, hint: t.hint,
    concrete: () => {
      if (t.debug) { const p = sch.parts.find(q => q.l === t.faultLabel); return p ? 'Das defekte Bauteil ist vom Typ „' + KD(p).name + '“. Miss dort Spannung und Strom und vergleiche sie mit dem, was du erwartest.' : 'Miss Spannungen und Ströme an mehreren Stellen und vergleiche sie mit dem, was du erwartest.'; }
      const lines = t.check(), bad = lines.find(l => !l.ok);
      return bad ? 'Noch nicht erfüllt: ' + bad.text : 'Alle Prüfpunkte sind erfüllt. Tippe auf „Lösung prüfen“.';
    },
    reveal: t.debug ? () => 'Das defekte Bauteil ist ' + t.faultLabel + '.' : null,
    solution: t.debug ? null : () => { const go = () => startTask(t.id, true); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); },
  });
}
function startTask(id, solution) {
  const t = TASKS.find(x => x.id === id); if (!t) return;
  if (!solution && window.Auswertung) window.Auswertung.hintReset(id);
  if (!solution) { taskAns[id] = {}; delete thinkAns[id]; }
  const mk = solution ? (t.solMake || exOf(t.sol)) : t.start; if (!mk) { toast('Keine Musterlösung hinterlegt'); return; }
  const ex = buildExample({ name: t.title + (solution ? ' (Musterlösung)' : ''), make: mk }); ex.task = solution ? undefined : t.id; loadCircuit(ex); reports = 0;
  if (!solution) { tool = 'select'; buildPalette(); }
  refreshUI(); draw();
}
function openTasks() {
  sheet('Aufgaben', (b, close) => {
    const dn = taskDone(); let h = '<p class="hint2" style="margin-top:0">Wähle eine Aufgabe. Du bekommst eine Startschaltung und kannst deine Lösung vom Programm prüfen lassen.</p>', last = '';
    labTasks().forEach(t => { if (t.cat !== last) { last = t.cat; h += `<div class="gh">${esc(t.cat)}</div>`; } h += `<button class="row" data-t="${t.id}"><div class="grow"><b>${esc(t.title)}</b><small>${'●'.repeat(t.level)}${'○'.repeat(4 - t.level)} ${dn[t.id] != null ? ' · bisher ' + dn[t.id] + ' %' + (dn[t.id] === 100 ? ' ✓' : '') : ''}</small></div></button>`; });
    b.innerHTML = h;
    b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); const go = () => startTask(r.dataset.t); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); });
  });
}


/* ============ Lehrer-Bereich (nur mit Freigabe): Aufgaben verteilen, Abgaben prüfen, Fehler einbauen ============ */
const isGod = () => { try { return sessionStorage.getItem('lm4.god') === GODH; } catch (e) { return false; } };
const classList = () => { try { return JSON.parse(localStorage.getItem('sim.class') || '[]'); } catch (e) { return []; } };
function withSubmission(d, fn) {
  const keep = sch; sch = { name: d.name || 'Abgabe', parts: d.parts || [], wires: d.wires || [], nid: d.nid || 1, scopes: [], task: d.task, code: d.code };
  try { return fn(); } finally { sch = keep; }
}
function openTeacher() {
  godGate(() => sheet('Lehrer-Bereich', (b) => {
    const opts = labTasks().map(t => `<option value="${t.id}">${esc(t.cat)} · ${esc(t.title)}</option>`).join('');
    b.innerHTML = `
      <div class="card"><h4>Aufgabe verteilen</h4><label class="f"><span>Aufgabe</span><select id="tsel">${opts}</select></label>
        <div class="row2"><button class="btn pri" id="tLink">Aufgabe als Link teilen</button></div>
        <div class="row2"><button class="btn" id="tSol">Musterlösung öffnen</button><button class="btn" id="tStart">Startschaltung öffnen</button></div>
        <p class="hint2">Der Link öffnet die Aufgabe mit Startschaltung direkt bei den Azubis. Die Prüfung läuft dort per Knopfdruck.</p></div>
      <div class="card"><h4>Abgabe prüfen</h4><p class="hint2" style="margin-top:0">Den Teilen-Link der Azubis hier einfügen. Die Schaltung wird gegen die Aufgabe geprüft, ohne sie zu öffnen.</p>
        <label class="f"><span>Name des Azubis</span><input id="tName" placeholder="Vor- und Nachname"></label>
        <label class="f"><span>Link oder Text</span><textarea id="tSub" rows="3"></textarea></label>
        <div class="row2"><button class="btn pri" id="tCheck">Prüfen</button></div><div id="tRes"></div></div>
      <div class="card"><h4>Auswertung</h4><p class="hint2" style="margin-top:0">Alle Labs auf einen Blick: <a href="auswertung.html" target="_blank" rel="noopener">Auswertung öffnen</a> (Ergebnis-Codes der Azubis einsammeln, Tabelle, CSV).</p><div id="tCls"></div><div class="row2"><button class="btn" id="tCopy">Als Tabelle kopieren</button><button class="btn danger" id="tClr">Liste leeren</button></div></div>
      <div class="card"><h4>Fehler einbauen</h4><p class="hint2" style="margin-top:0">Im Zeichenmodus ein Bauteil antippen: unter den Eigenschaften steht jetzt „Fehler (Lehrer)“. Mit „unterbrochen“ oder „Kurzschluss“ lassen sich eigene Fehlersuche-Aufgaben bauen und per „Teilen“ verschicken. Azubis sehen den Fehler nicht.</p></div>`;
    const sel = () => b.querySelector('#tsel').value;
    b.querySelector('#tLink').onclick = () => { const t = TASKS.find(x => x.id === sel()); const ex = buildExample({ name: t.title, make: t.start }); ex.task = t.id; shareNow(ex, t.title); };
    b.querySelector('#tSol').onclick = () => { const id = sel(); const go = () => { startTask(id, true); }; document.querySelector('.backdrop') && document.querySelector('.backdrop').remove(); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); };
    b.querySelector('#tStart').onclick = () => { const id = sel(); document.querySelector('.backdrop') && document.querySelector('.backdrop').remove(); const go = () => startTask(id); if (sch.parts.length || sch.wires.length) confirmNew(go); else go(); };
    const showCls = () => { const a = classList(); b.querySelector('#tCls').innerHTML = a.length ? `<table style="width:100%;font-size:13px;border-collapse:collapse">${a.slice(-12).reverse().map(r => `<tr><td>${esc(r.name || '–')}</td><td>${esc((TASKS.find(t => t.id === r.task) || {}).title || r.task)}</td><td style="text-align:right"><b>${r.pct} %</b></td></tr>`).join('')}</table>` : '<p class="hint2" style="margin:0">Noch keine Abgaben gespeichert.</p>'; };
    showCls();
    let last = null;
    b.querySelector('#tCheck').onclick = async () => {
      const txt = b.querySelector('#tSub').value.trim(), res = b.querySelector('#tRes'); res.innerHTML = '';
      const hash = txt.includes('#') ? txt.slice(txt.indexOf('#')) : txt;
      let sub = null; try { sub = await unpackShare(hash.startsWith('#') ? hash : '#' + hash); } catch (e) {}
      if (!sub || !Array.isArray(sub.parts)) { res.innerHTML = '<p class="hint2">Der Link oder Text ist ungültig.</p>'; return; }
      const t = TASKS.find(x => x.id === (sub.task || sel())); if (!t) { res.innerHTML = '<p class="hint2">Die Abgabe gehört zu keiner Aufgabe.</p>'; return; }
      if (t.debug) { res.innerHTML = '<p class="hint2">Fehlersuche-Aufgaben werden direkt in der App beantwortet.</p>'; return; }
      let lines; try { lines = withSubmission(sub, () => t.check()); } catch (e) { lines = [RES(false, 'Prüfung fehlgeschlagen: ' + e.message)]; }
      const pct = Math.round(100 * lines.filter(l => l.ok).length / Math.max(lines.length, 1)); last = { name: b.querySelector('#tName').value.trim(), task: t.id, pct, t: Date.now() };
      res.innerHTML = `<p style="margin:8px 0 4px"><b>${esc(t.title)}</b></p><ul class="tl">${lines.map(l => `<li class="${l.ok ? 'ok' : 'bad'}">${l.ok ? '✓' : '✗'} ${esc(l.text)}</li>`).join('')}</ul><div class="score ${pct === 100 ? 'ok' : ''}">${pct} % richtig</div><div class="row2"><button class="btn" id="tSave">In Auswertung speichern</button></div>`;
      res.querySelector('#tSave').onclick = () => { last.name = b.querySelector('#tName').value.trim() || last.name; const a = classList(); a.push(last); try { localStorage.setItem('sim.class', JSON.stringify(a.slice(-500))); } catch (e) {} showCls(); toast('Gespeichert'); };
    };
    b.querySelector('#tCopy').onclick = async () => { const a = classList(), txt = 'Name\tAufgabe\tErgebnis\tZeit\n' + a.map(r => [r.name || '', (TASKS.find(t => t.id === r.task) || {}).title || r.task, r.pct + ' %', new Date(r.t).toLocaleString('de-DE')].join('\t')).join('\n'); try { await navigator.clipboard.writeText(txt); toast('Tabelle kopiert (in Excel einfügbar)'); } catch (e) { toast('Kopieren nicht möglich'); } };
    b.querySelector('#tClr').onclick = () => { try { localStorage.removeItem('sim.class'); } catch (e) {} showCls(); };
  }));
}



/* Oszilloskop-Daten als Tabelle (CSV mit Semikolon und Dezimalkomma, öffnet direkt in Excel) */
function exportScopeCsv() {
  if (!window.LabExport) return;
  const bufs = scopeBuf.map((b, k) => ({ b, k })).filter(x => x.b && x.b.t && x.b.t.length);
  if (!bufs.length) { toast('Noch keine Messkurven: Oszilloskop-Kanal wählen und die Simulation laufen lassen'); return; }
  const n = Math.max(...bufs.map(x => x.b.t.length)), f = v => (v == null || !isFinite(v) ? '' : String(+v.toPrecision(6)).replace('.', ','));
  let out = 'Zeit [s]' + bufs.map(x => ';Kanal ' + (x.k + 1) + ' Spannung [V];Kanal ' + (x.k + 1) + ' Strom [A]').join('') + '\n';
  for (let i = 0; i < n; i++) out += f(bufs[0].b.t[i]) + bufs.map(x => ';' + f(x.b.v[i]) + ';' + f(x.b.i[i])).join('') + '\n';
  window.LabExport.saveBlob(new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8' }), window.LabExport.fname('csv'));
}

/* ============ Messprotokoll: Soll berechnen, messen, vergleichen, drucken ============ */
const PROTO_KEY = 'sim.proto';
const protoLoad = () => { try { const o = JSON.parse(localStorage.getItem(PROTO_KEY) || '{}'); return { tol: o.tol || 5, rows: Array.isArray(o.rows) ? o.rows : [] }; } catch (e) { return { tol: 5, rows: [] }; } };
const protoSave = p => { try { localStorage.setItem(PROTO_KEY, JSON.stringify(p)); } catch (e) {} };
/* Zahl mit Komma und Vorsatz lesen: "4,7k" → 4700, "12m" → 0.012 (der Vorsatz ist hier immer ein Zehnerpotenz-Faktor) */
function protoNum(s) {
  const m = String(s == null ? '' : s).trim().replace(',', '.').match(/^(-?[0-9]*\.?[0-9]+(?:e-?[0-9]+)?)\s*([pnuµmkKMG]?)/);
  if (!m) return NaN;
  const f = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9 }[m[2]] || 1;
  return parseFloat(m[1]) * f;
}
function protoEval(r, tol) {
  const s = protoNum(r.s), i = protoNum(r.i);
  if (!isFinite(s) || !isFinite(i)) return null;
  const dev = s === 0 ? (Math.abs(i) <= 0.05 ? 0 : 100) : (i - s) / Math.abs(s) * 100;
  return { dev, ok: Math.abs(dev) <= tol };
}
const protoFmtN = v => { const a = Math.abs(v); return String(a >= 100 ? Math.round(v) : parseFloat(v.toPrecision(3))).replace('.', ','); };
function protoFromMeter() {
  if (!simMode || !circ) return null;
  const m = meterValue(); if (!isFinite(m)) return null;
  const val = meter.init ? Math.sqrt(Math.max(meter.dc * meter.dc + meter.ac, 0)) * (meter.dc < 0 && meter.ac < 1e-9 ? -1 : 1) : m;
  if (meter.mode === 'A') return Math.abs(val) < 1 ? { v: protoFmtN(val * 1000), u: 'mA' } : { v: protoFmtN(val), u: 'A' };
  return { v: protoFmtN(val), u: 'V' };
}
function protoPrint(p) {
  const e = s => esc(String(s == null ? '' : s)), who = userName(), t = sch.task && TASKS.find(x => x.id === sch.task);
  const rows = p.rows.slice(); while (rows.length < 8) rows.push({ w: '', u: '', s: '', i: '' });
  const html = `<div class="proto"><h1>Messprotokoll</h1>
    <table class="pi"><tr><td>Name</td><td>${e(who)}</td><td>Datum</td><td>${new Date().toLocaleDateString('de-DE')}</td></tr>
    <tr><td>Schaltung</td><td>${e(sch.name)}</td><td>Aufgabe</td><td>${e(t ? t.title : '')}</td></tr></table>
    <p>Toleranz für „in Ordnung“: ±${p.tol} %</p>
    <table class="pm"><tr><th>Nr.</th><th>Messpunkt</th><th>Soll</th><th>Ist</th><th>Einheit</th><th>Abweichung</th><th>Bewertung</th></tr>${rows.map((r, k) => { const v = protoEval(r, p.tol); return `<tr><td>${k + 1}</td><td>${e(r.w)}</td><td>${e(r.s)}</td><td>${e(r.i)}</td><td>${e(r.u)}</td><td>${v ? (v.dev >= 0 ? '+' : '') + protoFmtN(v.dev) + ' %' : ''}</td><td>${v ? (v.ok ? 'in Ordnung' : 'außerhalb') : ''}</td></tr>`; }).join('')}</table>
    <p><b>Auffälligkeiten und Fazit:</b></p><div class="ln"></div><div class="ln"></div><div class="ln"></div>
    <table class="ps"><tr><td>Unterschrift Azubi</td><td>Unterschrift Ausbilder</td></tr></table></div>`;
  const pa = document.getElementById('printArea'); if (!pa) return;
  const old = pa.innerHTML; pa.innerHTML = html;
  const done = () => { pa.innerHTML = old; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done); setTimeout(() => window.print(), 80);
}
function openProtocol() {
  sheet('Messprotokoll', (b, close) => {
    let p = protoLoad();
    const draw = () => {
      const unitOpts = u => ['V', 'mA', 'A', 'Ω', 'kΩ', 'Hz', 'W'].map(x => `<option${x === u ? ' selected' : ''}>${x}</option>`).join('');
      if (window.Badges) window.Badges.stat('protoOk', p.rows.filter(r0 => { const v0 = protoEval(r0, p.tol); return v0 && v0.ok; }).length, 'max');
      let h = `<p class="hint2" style="margin-top:0">So geht es: 1. Sollwert <b>berechnen</b> (Rechner im Menü hilft). 2. In der Simulation mit dem Multimeter messen. 3. Mit „⤓“ den angezeigten Messwert übernehmen. 4. Abweichung beurteilen, drucken.</p>
        <label class="f"><span>Toleranz „in Ordnung“</span><select id="pTol">${[2, 5, 10, 20].map(x => `<option value="${x}"${x === p.tol ? ' selected' : ''}>± ${x} %</option>`).join('')}</select></label>`;
      p.rows.forEach((r, k) => {
        const v = protoEval(r, p.tol);
        h += `<div class="card" data-k="${k}" style="padding:8px 10px;margin:8px 0"><div style="display:flex;gap:6px;align-items:center"><b style="min-width:20px">${k + 1}.</b><input data-f="w" value="${esc(r.w)}" placeholder="Messpunkt, z. B. U über R2" style="flex:1;min-width:0"><button class="btn" data-a="del" aria-label="Zeile löschen">✕</button></div>
          <div style="display:flex;gap:6px;margin-top:6px;align-items:center;flex-wrap:wrap"><input data-f="s" value="${esc(r.s)}" placeholder="Soll" inputmode="decimal" style="width:72px"><input data-f="i" value="${esc(r.i)}" placeholder="Ist" inputmode="decimal" style="width:72px"><select data-f="u">${unitOpts(r.u || 'V')}</select><button class="btn" data-a="take" title="Messwert aus dem Multimeter übernehmen">⤓ Messwert</button></div>
          <div style="margin-top:4px;font-size:13px;color:${v ? (v.ok ? '#2fae45' : '#e05050') : 'var(--mute)'}">${v ? (v.ok ? '✓ in Ordnung' : '✗ außerhalb der Toleranz') + ' · Abweichung ' + (v.dev >= 0 ? '+' : '') + protoFmtN(v.dev) + ' %' : 'Soll und Ist eintragen'}</div></div>`;
      });
      h += `<div class="row2"><button class="btn" data-a="add">+ Zeile</button><button class="btn pri" data-a="print">Drucken</button><button class="btn danger" data-a="clr">Alles leeren</button></div>`;
      b.innerHTML = h;
    };
    draw();
    b.addEventListener('change', ev => { const t = ev.target; if (t.id === 'pTol') { p.tol = +t.value; protoSave(p); draw(); return; } const c = t.closest('[data-k]'); if (!c || !t.dataset.f) return; p.rows[+c.dataset.k][t.dataset.f] = t.value; protoSave(p); draw(); });
    b.addEventListener('click', ev => {
      const t = ev.target.closest('[data-a]'); if (!t) return; const c = t.closest('[data-k]'), k = c ? +c.dataset.k : -1, a = t.dataset.a;
      if (a === 'add') { p.rows.push({ w: '', u: 'V', s: '', i: '' }); protoSave(p); draw(); }
      else if (a === 'del') { p.rows.splice(k, 1); protoSave(p); draw(); }
      else if (a === 'clr') { p = { tol: p.tol, rows: [] }; protoSave(p); draw(); }
      else if (a === 'print') protoPrint(p);
      else if (a === 'take') { const m = protoFromMeter(); if (!m) { toast('Starte die Simulation und miss mit dem Multimeter (Messen), dann übernimm den Wert'); return; } p.rows[k].i = m.v; p.rows[k].u = m.u; protoSave(p); draw(); }
    });
    if (!p.rows.length) { p.rows.push({ w: '', u: 'V', s: '', i: '' }); protoSave(p); draw(); }
  });
}

/* ---- Brücke zum Lochraster-Layout (nur mit Freigabe) ---- */
const GODH = 'a2fdecf55d194ed8cea8d52d7d0442778e86180b6d81c6c37e56278e55add6c6';
async function sha256(t) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
function godGate(then) {
  let ok = false; try { ok = sessionStorage.getItem('lm4.god') === GODH; } catch (e) {}
  if (ok) return then();
  form('Freigabe nötig', [{ l: 'Passwort (nur für Ausbilder)', v: '', type: 'password' }], async ([pw]) => {
    if (await sha256(pw.trim()) === GODH) { try { sessionStorage.setItem('lm4.god', GODH); } catch (e) {} then(); } else toast('Passwort falsch');
  });
}
const DSPEC = { '1N4007': 'd4007', '1N5819': 'd5819' };
// Arduino Uno: Schaltplan-Anschluss (5V, 3V3, VIN, GND, A0..A5, D0..D13, GND, 5V) -> Stift des LochLab-Moduls
const PI_NAMES = ["3V3", "5V", "GPIO2 SDA", "5V", "GPIO3 SCL", "GND", "GPIO4", "GPIO14 TX", "GND", "GPIO15 RX", "GPIO17", "GPIO18 PWM", "GPIO27", "GND", "GPIO22", "GPIO23", "3V3", "GPIO24", "GPIO10 MOSI", "GND", "GPIO9 MISO", "GPIO25", "GPIO11 SCLK", "GPIO8 CE0", "GND", "GPIO7 CE1", "GPIO0", "GPIO1", "GPIO5", "GND", "GPIO6", "GPIO12 PWM", "GPIO13 PWM", "GND", "GPIO19", "GPIO16", "GPIO26", "GPIO20", "GND", "GPIO21"];
const PI_PIN_OF = (() => { const ph = { 2: 3, 3: 5, 4: 7, 14: 8, 15: 10, 17: 11, 18: 12, 27: 13, 22: 15, 23: 16, 24: 18, 10: 19, 9: 21, 25: 22, 11: 23, 8: 24, 7: 26, 0: 27, 1: 28, 5: 29, 6: 31, 12: 32, 13: 33, 19: 35, 16: 36, 26: 37, 20: 38, 21: 40 }, r = []; for (const g in ph) r[+g] = ph[g] - 1; return r; })();
const UNO_PM = (() => { const m = [22, 21, 25, 23]; for (let a = 0; a < 6; a++) m.push(26 + a); for (let n = 0; n < 14; n++) m.push(17 - n); m.push(3, 22); return m; })();
function llSpec(p) {
  const v = p.v, two = { two: true };
  switch (p.k) {
    case 'R': return { ll: { k: 'R', n: 4, v }, pm: [0, 1], ...two };
    case 'POT': return { ll: { k: 'P', v }, pm: [0, 2, 1] };
    case 'C': return { ll: { k: 'C', n: 2, v }, pm: [0, 1], ...two };
    case 'CE': return { ll: { k: 'CE', n: 2, v, vr: 'e63' }, pm: [0, 1], ...two };
    case 'L': return { ll: { k: 'L', n: 4, v }, pm: [0, 1], ...two };
    case 'D': return { ll: { k: 'D', n: 4, v: v || '1N4148', vr: DSPEC[String(v).toUpperCase()] || 'd4148' }, pm: [0, 1], ...two };
    case 'ZD': return { ll: { k: 'D', n: 4, v: 'BZX55C' + String(v).replace('.', 'V'), vr: 'dz' }, pm: [0, 1], ...two };
    case 'LED': return { ll: { k: 'LED', n: 1, v, vr: '5' }, pm: [0, 1], ...two };
    case 'LDR': return { ll: { k: 'LDR', n: 2, v: 'LDR' }, pm: [0, 1], ...two };
    case 'NTC': case 'PTC': return { ll: { k: p.k, n: 2, v }, pm: [0, 1], ...two };
    case 'PHT': return { ll: { k: 'PHT', n: 1, v: v || 'BPW40' }, pm: [0, 1], ...two };
    case 'LAMP': return { ll: { k: 'LAMP', n: 3, v: v || '6V 0.1A' }, pm: [0, 1], ...two };
    case 'SPK': return { ll: { k: 'SPK', n: 4, v }, pm: [0, 1], ...two };
    case 'UNO': return { ll: { k: 'UNO', v: 'Uno R3' }, pm: UNO_PM };
    case 'PI': return { ll: { k: 'PI', v: 'Pi GPIO' }, pm: Array.from({ length: 40 }, (_, i) => i) };
    case 'MCP3008': return { ll: { k: 'IC', n: 16, v: 'MCP3008', sk: true }, pm: [15, 14, 13, 8, 12, 11, 10, 9, 0, 1, 2, 3, 4, 5, 6, 7] };
    case 'SERVO': return { ll: { k: 'SIP', n: 3, v: 'Servo' }, pm: [2, 1, 0] };          // Stecker: Masse, Plus, Signal
    case 'HCSR04': return { ll: { k: 'SIP', n: 4, v: 'HC-SR04' }, pm: [0, 1, 2, 3] };
    case 'I2CTEMP': return { ll: { k: 'SIP', n: 4, v: 'LM75 I2C' }, pm: [0, 1, 2, 3] };
    case 'I2CLUX': return { ll: { k: 'SIP', n: 4, v: 'BH1750 I2C' }, pm: [0, 1, 2, 3] };
    case 'LCDI2C': return { ll: { k: 'SIP', n: 4, v: 'LCD I2C' }, pm: [0, 1, 2, 3] };
    case 'PIR': return { ll: { k: 'SIP', n: 3, v: 'PIR' }, pm: [0, 1, 2] };
    case 'TMP36': return { ll: { k: 'SIP', n: 3, v: 'TMP36' }, pm: [0, 1, 2] };
    case 'RGBLED': return { ll: { k: 'SIP', n: 4, v: 'RGB-LED' }, pm: [0, 1, 2, 3] };
    case 'DUOLED': return { ll: { k: 'DUOLED', v: v || 'Kathode' }, pm: [0, 1, 2] };
    case 'PIEZO': return { ll: { k: 'BZ', n: 3, v: 'Piezo' }, pm: [0, 1], ...two };
    case 'TOUCH': return { ll: { k: 'PIN', n: 1, v: '' }, pm: [0] };
    case 'PB': case 'PBC': return { ll: { k: 'SW', vr: 'k2', v: '' }, pm: [0, 1] };
    case 'SPST': return { ll: { k: 'SCH', vr: 'k3', n: 3, v: '' }, pm: [1, 0] };
    case 'SPDT': return { ll: { k: 'SCH', vr: 'k3', n: 3, v: '' }, pm: [1, 0, 2] };
    case 'NPN': case 'PNP': return { ll: { k: 'T', v, vr: p.k === 'PNP' ? 'pnp-cbe' : 'npn-cbe' }, pm: [1, 0, 2] };
    case 'THY': return { ll: { k: 'THY', v }, pm: [1, 0, 2] };
    case 'REG': return { ll: { k: 'U', v: v || '7805' }, pm: [0, 1, 2] };
    case 'SCHOTTKY': return { ll: { k: 'D', n: 4, v: v || '1N5819', vr: 'd5819' }, pm: [0, 1], ...two };
    case 'NMOS': case 'PMOS': return { ll: { k: 'FET', v, vr: (p.k === 'PMOS' ? 'p-' : 'n-') + String(v).toLowerCase() }, pm: [0, 1, 2] };
    case 'DIAC': return { ll: { k: 'D', n: 4, v: 'DB3', vr: 'diac' }, pm: [0, 1], ...two };
    case 'TRIAC': return { ll: { k: 'TRIAC', v }, pm: [0, 1, 2] };
    case 'VDR': return { ll: { k: 'VDR', n: 2, v }, pm: [0, 1], ...two };
    case 'OPTO': return { ll: { k: 'OPTO', v }, pm: [0, 1, 3, 2] };
    case 'RLY': return { ll: { k: 'RLY', v: v || '12V', vr: /^5/.test(v) ? 'r5' : (/^24/.test(v) ? 'r24' : 'r12') }, pm: [0, 1, 2, 3, 4] };
    case 'TRF': return { ll: { k: 'TRF', v }, pm: [0, 1, 2, 3] };
    case 'SEG8': return { ll: { k: 'SEG7', vr: /a/i.test(String(p.vr || '')) ? 'ma' : 'mk', v: 'TDSO 3160 M' }, pm: [6, 5, 3, 1, 0, 8, 9, 4, 2] };   // a, b, c, d, e, f, g, dp, gemeinsam → Pin 7, 6, 4, 2, 1, 9, 10, 5, 3 der Anzeige
    case 'XTAL': return { ll: { k: 'Q', n: 2, v: String(p.v || '') }, pm: [0, 1], ...two };
    case 'ICX': { const n = p.n || 8; return { ll: { k: 'IC', n, v, sk: true }, pm: Array.from({ length: n }, (_, i) => i) }; }
    case 'BAT': { const n = parseFloat(p.v) || 9; return { ll: { k: 'BAT', v: n + 'V', vr: n === 9 ? 'blk' : 'psu' }, pm: [0, 1], ...two }; }
    case 'AC': return { ll: { k: 'SIG', v: p.v || '5V 1kHz', vr: 'sin' }, pm: [0, 1], ...two };
    case 'MOTOR': case 'HEAT': case 'FUSE': { const n = KD(p).pins.length; return { ll: { k: 'KL', n, v: '' }, pm: Array.from({ length: n }, (_, i) => i), ext: true }; }
    default: return null;
  }
}
const GATE_IC = { AND: ['7408', 'q'], NAND: ['7400', 'q'], OR: ['7432', 'q'], NOR: ['7402', 'n'], XOR: ['7486', 'q'], NOT: ['7404', 'h'], SNOT: ['7414', 'h'], DFF: ['7474', 'd'], OPA: ['LM358', 'o'] };
const SLOTS = {
  q: [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], n: [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]],
  h: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]],
  d: [[2, 3, 5, 6, 1, 4], [12, 11, 9, 8, 13, 10]],                 // D, CLK, Q, /Q, CLR, PRE
  o: [[3, 2, 1, 8, 4], [5, 6, 7, 8, 4]],                            // IN+, IN-, OUT, V+, V-
};
function addLogic(job, find, gnd) {
  const groups = {}; sch.parts.forEach(p => { if (GATE_IC[p.k]) (groups[GATE_IC[p.k][0] + '|' + GATE_IC[p.k][1]] = groups[GATE_IC[p.k][0] + '|' + GATE_IC[p.k][1]] || []).push(p); });
  const keys = Object.keys(groups); if (!keys.length) return;
  let uc = 0; const un = () => '__u' + (uc++), VCC = '__VCC', GN = gnd || '__GND';
  keys.forEach(key => {
    const [type, cls] = key.split('|'), slots = SLOTS[cls], list = groups[key];
    for (let i = 0; i < list.length; i += slots.length) {
      const chunk = list.slice(i, i + slots.length), np = cls === 'o' ? 8 : 14, pins = Array.from({ length: np }, () => un());
      if (cls !== 'o') { pins[13] = VCC; pins[6] = GN; }
      slots.forEach((slot, si) => {
        const p = chunk[si];
        if (p) { const pw = pinsOf(p); slot.slice(0, pw.length).forEach((pn, k) => { pins[pn - 1] = String(find(gk(...pw[k]))); }); }
        else if (cls === 'q') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; }
        else if (cls === 'n') { pins[slot[1] - 1] = GN; pins[slot[2] - 1] = GN; }
        else if (cls === 'h') { pins[slot[0] - 1] = GN; }
        else if (cls === 'd') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; pins[slot[4] - 1] = VCC; pins[slot[5] - 1] = VCC; }
        else if (cls === 'o') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; }
      });
      if (cls === 'd') chunk.forEach((p, si) => { const slot = slots[si], pw = pinsOf(p); pins[slot[4] - 1] = VCC; pins[slot[5] - 1] = VCC; });
      if (cls === 'o' && chunk.length === 1) { pins[slots[1][0] - 1] = GN; pins[slots[1][1] - 1] = GN; pins[6] = un(); }
      const first = chunk[0], pw0 = pinsOf(first);
      job.parts.push({ ll: { k: 'IC', n: np, v: type, sk: true }, l: first.l || type, sx: pw0[0][0], sy: pw0[0][1], sr: 0, two: false, pins });
      job.notes.logic = (job.notes.logic || []).concat((first.l || type) + ': ' + type + ' mit ' + chunk.length + ' Gatter(n) aus dem Plan');
    }
  });
  job.parts.push({ ll: { k: 'KL', n: 2, v: '' }, l: 'Vcc', sx: 0, sy: -3, sr: 0, two: false, pins: [VCC, GN] });
  job.notes.ext.push('Vcc (+5 V) und GND für die ICs');
}
function buildJob() {
  const par = new Map(), find = k => { if (!par.has(k)) par.set(k, k); while (par.get(k) !== k) { par.set(k, par.get(par.get(k))); k = par.get(k); } return k; }, uni = (a, b) => par.set(find(a), find(b));
  sch.wires.forEach(w => uni(gk(w.x1, w.y1), gk(w.x2, w.y2)));
  let g0 = null; sch.parts.forEach(p => { if (p.k === 'GND') { const k = gk(...pinsOf(p)[0]); if (g0) uni(g0, k); else g0 = k; find(k); } });
  sch.parts.forEach(p => { if (p.k === 'PI' || p.k === 'UNO') { const pw = pinsOf(p); (p.k === 'PI' ? [5, 8, 13, 19, 24, 29, 33, 38] : [3, 24]).forEach(si => { const k = gk(...pw[si]); find(k); if (g0) uni(g0, k); else g0 = k; }); } });   // Masse-Pins der Steuerung sind untereinander und mit den Masse-Symbolen verbunden
  sch.parts.forEach(p => { const sp = llSpec(p); if (!sp) return; const pw = pinsOf(p), first = new Map(); sp.pm.forEach((li, si) => { if (first.has(li)) uni(gk(...pw[first.get(li)]), gk(...pw[si])); else first.set(li, si); }); });   // Anschlüsse, die im Layout derselbe Pin sind (zum Beispiel die beiden 5V-Pins des Uno), gehören zum selben Netz
  const netCnt = new Map(); sch.parts.forEach(p => pinsOf(p).forEach(q => { const r = String(find(gk(...q))); netCnt.set(r, (netCnt.get(r) || 0) + 1); }));
  const parts = [], skipped = {}, ext = [];
  sch.parts.forEach(p => {
    if (p.k === 'GND' || p.k === 'VM' || p.k === 'AM') return;
    if (GATE_IC[p.k]) return;
    const sp = llSpec(p), K = KINDS[p.k];
    if (!sp) { skipped[K.name] = (skipped[K.name] || 0) + 1; return; }
    const pw = pinsOf(p), pins = []; sp.pm.forEach((li, si) => { const net = String(find(gk(...pw[si]))); if (pins[li] == null || (netCnt.get(net) || 0) > 1) pins[li] = net; });
    const cxs = pw.reduce((a, q) => a + q[0], 0) / pw.length, cys = pw.reduce((a, q) => a + q[1], 0) / pw.length;
    parts.push({ ll: sp.ll, l: p.l || '', sx: sp.two ? pw[0][0] : cxs, sy: sp.two ? pw[0][1] : cys, sr: p.r, two: !!sp.two, pins });
    if (sp.ext) ext.push((p.l || K.name) + ' (' + K.name + ')');
  });
  const job = { name: sch.name, parts, notes: { skipped: Object.keys(skipped).map(k => skipped[k] + '× ' + k), ext } };
  addLogic(job, find, g0 ? String(find(g0)) : null);
  return job;
}
function makeLayout() {
  if (!sch.parts.length) { toast('Noch keine Bauteile gezeichnet'); return; }
  godGate(() => {
    const job = buildJob();
    if (!job.parts.length) { toast('Keine Bauteile für das Layout vorhanden'); return; }
    try { localStorage.setItem('lm4.job', JSON.stringify(job)); } catch (e) { toast('Speichern nicht möglich'); return; }
    location.href = 'layout.html?auto';
  });
}

/* ---- Teilen: die ganze Schaltung steckt komprimiert im Link (wie ein Textdokument zum Einfügen) ---- */
async function packShare(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj)); let out = bytes, tag = 's';
  if (window.CompressionStream) { try { const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter(); w.write(bytes); w.close(); out = new Uint8Array(await new Response(cs.readable).arrayBuffer()); tag = 'z'; } catch (e) {} }
  let bin = ''; out.forEach(b => { bin += String.fromCharCode(b); });
  return tag + '=' + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function unpackShare(h) {
  const m = String(h).match(/^#?([sz])=([\w-]+)$/); if (!m) return null;
  let b64 = m[2].replace(/-/g, '+').replace(/_/g, '/'); while (b64.length % 4) b64 += '=';
  const bin = atob(b64), bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  let txt;
  if (m[1] === 'z') { const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(bytes); w.close(); txt = new TextDecoder().decode(await new Response(ds.readable).arrayBuffer()); }
  else txt = new TextDecoder().decode(bytes);
  return JSON.parse(txt);
}
async function shareNow(obj, title) {
  let url; try { url = location.href.split('#')[0] + '#' + await packShare(obj); } catch (e) { toast('Teilen nicht möglich'); return; }
  if (navigator.share) { try { await navigator.share({ title: 'Tonfunk Lab: ' + title, text: 'Schau dir „' + title + '“ an:', url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  sheet('Teilen', b => {
    b.innerHTML = '<p class="hint2" style="margin-top:0">Diesen Link weitergeben (zum Beispiel per WhatsApp oder E-Mail). Wer ihn öffnet, bekommt eine Kopie deiner Arbeit.</p><textarea id="shTx" rows="5" readonly></textarea><div class="btns"><button class="btn pri" id="shCp">Link kopieren</button></div>';
    const ta = b.querySelector('#shTx'); ta.value = url;
    b.querySelector('#shCp').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('Link kopiert'); } catch (e) { ta.select(); toast('Bitte Text markieren und kopieren'); } };
  });
}
window.addEventListener('hashchange', () => { loadShared(); });
async function loadShared() {
  if (!/^#[sz]=/.test(location.hash)) return false;
  let d = null; try { d = await unpackShare(location.hash); } catch (e) {}
  history.replaceState(null, '', location.pathname + location.search);
  if (!d || !Array.isArray(d.parts)) { toast('Der Link ist ungültig'); return false; }
  if (sch && (sch.parts.length || sch.wires.length)) { try { sch.name = sch.name || 'Schaltung'; saveNamed(); } catch (e) {} }
  d.name = (d.name || 'Schaltung') + ' (geteilt)'; delete d.sid; loadCircuit(d); toast('Geteilte Schaltung geladen'); return true;
}
function menuAct(m) {
  if (window.LAB_EXTRA_ACT && window.LAB_EXTRA_ACT(m)) return;
  if (m === 'lern') { const go = () => window.Lernstand && window.Lernstand.open(); if (window.Lernstand) go(); else { const sc = document.createElement('script'); sc.src = 'lernstand.js'; sc.onload = go; document.head.appendChild(sc); } return; }
  if (m === 'tasks') { openTasks(); return; }
  if (m === 'cab') { openCabinet(); return; }
  if (m === 'teacher') { openTeacher(); return; }
  if (m === 'share') { if (!sch.parts.length) { toast('Noch nichts gezeichnet'); return; } shareNow(JSON.parse(snap()), sch.name); return; }
  if (m === 'auto') { makeLayout(); return; }
  if (m === 'new') confirmNew(() => loadCircuit(LAB === 'haus' && window.HAUS_NEW ? window.HAUS_NEW() : { name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] }));
  else if (m === 'ex') openExamples();
  else if (m === 'open') openList();
  else if (m === 'save') form('Speichern unter', [{ l: 'Name', v: sch.name }], ([n]) => { sch.name = n.trim() || sch.name; commit(true); saveNamed(); toast('Gespeichert'); });
  else if (m === 'export') { sheet('Als Text sichern', b => { b.innerHTML = '<p class="hint2">Text kopieren und in einer Notiz oder Datei ablegen.</p><textarea id="tx" rows="8" readonly></textarea><div class="btns"><button class="btn pri" id="cp">Kopieren</button></div>'; const ta = b.querySelector('#tx'); ta.value = snap(); b.querySelector('#cp').onclick = async () => { try { await navigator.clipboard.writeText(ta.value); toast('Kopiert'); } catch (e) { ta.select(); } }; }); }
  else if (m === 'import') { sheet('Aus Text laden', (b, close) => { b.innerHTML = '<textarea id="tx" rows="8"></textarea><div class="btns"><button class="btn pri" id="ld">Laden</button></div>'; b.querySelector('#ld').onclick = () => { try { const d = JSON.parse(b.querySelector('#tx').value); if (!Array.isArray(d.parts)) throw 0; close(); loadCircuit(d); } catch (e) { toast('Text ungültig'); } }; }); }
  else if (m === 'print') openPrint();
  else if (m === 'img') { if (!sch.parts.length) toast('Noch nichts gezeichnet'); else outputCanvas(renderPlan(), false); }
  else if (m === 'fit') fit();
  else if (m === 'lab') location.href = 'layout.html';
  else if (m === 'start') location.href = 'index.html';
  else if (m === 'keys') { if (window.LochKeys) window.LochKeys.help(); }
  else if (m === 'calc') { if (window.Rechner) window.Rechner.open(); }
  else if (m === 'erg') { if (window.Auswertung) window.Auswertung.openSend(); }
  else if (m === 'proto') openProtocol();
  else if (m === 'tag') openDaily();
  else if (m === 'duell') openDuel();
  else if (m === 'escape') openEscape();
  else if (m === 'abz') { if (window.Badges) window.Badges.open(); }
  else if (m === 'speak') { if (window.Speak) window.Speak.toggleAuto(); }
  else if (m === 'wikih') { if (window.WikiLabs) window.WikiLabs.toggle(); }
  else if (m === 'water') setWater(!water);
  else if (m === 'neu') window.LabNeu();
  else if (m === 'det') openDetective();
  else if (m === 'kamp') { if (window.Kampagne) window.Kampagne.open(); }
  else if (m === 'feel') { if (window.Feel) window.Feel.toggle(); }
  else if (m === 'fun') { if (window.LochFX) { LochFX.setFun(!LochFX.isFun()); toast('Sprüche und Effekte: ' + (LochFX.isFun() ? 'an' : 'aus')); } }
  else if (m === 'voice') { if (window.Voice) window.Voice.toggle(); }
  else if (m === 'oszi') { if (window.Oszi) window.Oszi.open(); }
  else if (m === 'loet') { if (window.Loetuebung) window.Loetuebung.open(); }
  else if (m === 'trainer') { if (window.Trainer) window.Trainer.start(); }
  else if (m === 'ton') { if (window.Tonwerkstatt) window.Tonwerkstatt.open(); }
  else if (m === 'dice') rollFault();
  else if (m === 'predict') { if (window.Predict) window.Predict.toggle(); }
  else if (m === 'png') { if (window.LabExport) window.LabExport.png(); }
  else if (m === 'gif') { if (window.LabExport) window.LabExport.gif(); }
  else if (m === 'csv') exportScopeCsv();
  else if (m === 'help') sheet('Hilfe', b => { if (window.LAB_HELP) { b.innerHTML = `<div class="help"><p style="color:var(--mute);font-size:12px">Programmstand: ${window.LAB_VERSION || ''}</p>${window.LAB_HELP()}</div>`; return; } b.innerHTML = `<div class="help"><p style="color:var(--mute);font-size:12px">Programmstand: ${window.LAB_VERSION || ''}</p><p><b>Tastenkürzel:</b> Taste <b>?</b> drücken oder im Menü „Tastenkürzel“. Zum Beispiel <b>R</b> Widerstand, <b>D</b> Diode, <b>L</b> LED, <b>W</b> Draht, <b>Eingabe</b> oder <b>F5</b> Simulation ein und aus.</p><p><b>Zeichnen:</b> Bauteil in der Leiste wählen, auf die Fläche tippen. <b>Draht</b> von Punkt zu Punkt ziehen. Bauteil-Anschlüsse müssen genau auf Drahtenden liegen.</p><p><b>Masse:</b> Das Massesymbol legt fest, wo 0 V ist. Ohne Masse wird der Minuspol der Quelle genommen.</p><p><b>Simulation:</b> Oben den Schalter auf „Sim“ stellen. Die Spannung ist grün (positiv), rot (negativ) oder grau (null). Gelbe Punkte zeigen den Stromweg und seine Richtung.</p><p><b>Bedienen:</b> Schalter antippen, Taster gedrückt halten. Poti, Fotowiderstand und Werte rechts einstellen.</p><p><b>Drucken:</b> Menü, dann „Drucken“: der Plan kommt schwarz auf weiß aufs Blatt, dazu die Bauteilliste.</p><p><b>Graph:</b> Werkzeug „Graph“, dann Bauteil oder Draht antippen. Gelb ist die Spannung, grün der Strom.</p><p><b>Tempo:</b> Der Regler legt fest, wie viele simulierte Sekunden pro echter Sekunde vergehen. Schnelle Signale brauchen ein kleines Tempo.</p></div>`; });
}
function confirmNew(next) {
  const n = sch.parts.length + sch.wires.length;
  if (!n) { next(); return; }
  sheet('Aktuelle Schaltung sichern?', (b, close) => {
    b.innerHTML = `<p style="margin-top:0">„${esc(sch.name)}“ wird jetzt gespeichert und bleibt unter „Gespeicherte Schaltungen“ erhalten.</p><div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>Speichern und weiter</button></div>`;
    b.querySelector('[data-c]').onclick = close;
    b.querySelector('[data-ok]').onclick = () => { saveNamed(); close(); next(); };
  });
}
function form(title, fields, onOk) {
  sheet(title, (b, close) => {
    b.innerHTML = fields.map((f, i) => `<label class="f"><span>${esc(f.l)}</span><input id="ff${i}" type="${f.type || 'text'}" value="${esc(f.v)}"></label>`).join('') + '<div class="btns"><button class="btn" data-c>Abbrechen</button><button class="btn pri" data-ok>OK</button></div>';
    b.querySelector('[data-c]').onclick = close; b.querySelector('[data-ok]').onclick = () => { onOk(fields.map((f, i) => b.querySelector('#ff' + i).value)); close(); };
    setTimeout(() => b.querySelector('#ff0').focus(), 50);
  });
}
function saveNamed() {
  try {
    const idx = JSON.parse(localStorage.getItem((SK + 'index')) || '[]'), id = sch.sid || (sch.sid = uid());
    localStorage.setItem((SK + 'p.') + id, snap()); if (!idx.includes(id)) { idx.push(id); localStorage.setItem((SK + 'index'), JSON.stringify(idx)); }
  } catch (e) { toast('Speichern nicht möglich'); }
}
function openList() {
  sheet('Gespeicherte Schaltungen', (b, close) => {
    let idx = []; try { idx = JSON.parse(localStorage.getItem((SK + 'index')) || '[]'); } catch (e) {}
    const items = idx.map(id => { try { const d = JSON.parse(localStorage.getItem((SK + 'p.') + id)); return d && { id, name: d.name }; } catch (e) { return null; } }).filter(Boolean);
    if (!items.length) { b.innerHTML = '<p class="hint2">Noch nichts gespeichert.</p>'; return; }
    b.innerHTML = items.map(i => `<div class="row"><button class="grow" data-o="${i.id}" style="text-align:left"><b>${esc(i.name)}</b></button><button class="chip danger" data-d="${i.id}">Löschen</button></div>`).join('');
    b.addEventListener('click', e => {
      const o = e.target.closest('[data-o]'), d = e.target.closest('[data-d]');
      if (o) { close(); const dd = JSON.parse(localStorage.getItem((SK + 'p.') + o.dataset.o)); dd.sid = o.dataset.o; loadCircuit(dd); }
      else if (d) { const id = d.dataset.d; localStorage.removeItem((SK + 'p.') + id); localStorage.setItem((SK + 'index'), JSON.stringify(idx.filter(x => x !== id))); close(); openList(); }
    });
  });
}
function exportImage() {
  const W = cv.width, H = cv.height; const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').drawImage(cv, 0, 0);
  sheet('Bild sichern', b => { b.innerHTML = '<p class="hint2">Bild gedrückt halten, dann „Sichern“ oder „Drucken“ wählen.</p><img alt="" style="width:100%;border-radius:8px;background:#080b0e" src="' + c.toDataURL('image/png') + '">'; });
}
function fit() {
  if (LAB === 'haus' && window.HAUS_FIT) { window.HAUS_FIT(); draw(); return; }
  const r = rectOf();
  if (!sch.parts.length && !sch.wires.length) { view = { s: 24, ox: 80, oy: 80 }; draw(); return; }
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  sch.parts.forEach(p => { const K = KD(p); [[K.box[0], K.box[1]], [K.box[2], K.box[3]]].forEach(([a, b]) => { const [ra, rb] = rot(a, b, p.r); x0 = Math.min(x0, p.x + ra); x1 = Math.max(x1, p.x + ra); y0 = Math.min(y0, p.y + rb); y1 = Math.max(y1, p.y + rb); }); });
  sch.wires.forEach(w => { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2); });
  const pad = 2, W = x1 - x0 + 2 * pad, H = y1 - y0 + 2 * pad, gh = sch.scopes.length ? Math.min(150, r.height * 0.34) : 0;
  const s = clamp(Math.min(r.width / W, (r.height - gh) / H), 10, 50);
  view.s = s; view.ox = (r.width - (x1 - x0) * s) / 2 - x0 * s; view.oy = ((r.height - gh) - (y1 - y0) * s) / 2 - y0 * s; draw();
}
function loadCircuit(d) {
  incident = null; running = false; sel = null; wireStart = null; simMode = false;
  if (d.tempo != null) tempo = d.tempo; if (d.win) graphWin = d.win;
  sch = { name: d.name || 'Schaltung', parts: JSON.parse(JSON.stringify(d.parts || [])), wires: JSON.parse(JSON.stringify(d.wires || [])), nid: d.nid || 1, scopes: d.scopes || [], sid: d.sid, task: d.task, code: d.code, dice: d.dice, haus: d.haus ? JSON.parse(JSON.stringify(d.haus)) : undefined };
  if (LAB === 'haus' && sch.haus && window.HAUS_COMPILE) window.HAUS_COMPILE(sch);
  taskRes = null; prog = null; serLog = ''; lcdState = null;
  assignLabels(sch.parts);
  sch.nid = Math.max(sch.nid, 1 + Math.max(0, ...sch.parts.map(p => p.id || 0), ...sch.wires.map(w => w.id || 0)));
  circ = null; sim = null; phase.clear(); lastSample = -1; rebuild(); hist = [snap()]; hi = 0;
  try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {}
  { const sw = $('#bSim'); if (sw) sw.setAttribute('aria-checked', 'false'); $('#bRun').style.display = 'none'; const ws = $('#bWater'); if (ws) ws.style.display = 'none'; }
  setTool('select'); fit(); refreshUI(); draw(); syncCode();
}
function openExamples() {
  sheet('Beispielschaltungen', (b, close) => {
    let h = '', last = '';
    const cats = []; EXAMPLES.forEach(e => { if (exOk(e) && !cats.includes(e.cat)) cats.push(e.cat); });
    const order = EXAMPLES.map((e, i) => i).filter(i => exOk(EXAMPLES[i])).sort((p, q) => cats.indexOf(EXAMPLES[p].cat) - cats.indexOf(EXAMPLES[q].cat) || p - q);
    order.forEach(i => {
      const e = EXAMPLES[i];
      if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat || 'Weitere')}</div>`; }
      h += `<button class="row" data-i="${i}"><div class="grow"><b>${e.lock ? '🔒 ' : ''}${esc(e.name)}</b><small>${esc(e.info)}</small></div></button>`;
    });
    b.innerHTML = h;
    b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); const e0 = EXAMPLES[+r.dataset.i], go = () => { const ex = buildExample(e0); loadCircuit(ex); if (ex.tempo != null) tempo = ex.tempo; if (ex.win) graphWin = ex.win; refreshUI(); }; if (e0.lock) godGate(go); else go(); });   // gesperrte Beispiele (Ausbilder) nur nach Passwort
  });
}
const exOk = e => LAB === 'digi' ? e.lab === 'digi' : LAB === 'mess' ? e.lab === 'mess' : LAB === 'haus' ? e.lab === 'haus' : LAB === 'pi' ? e.lab === 'pi' : LAB === 'code' ? e.lab === 'code' : LAB === 'sim' ? (e.lab === 'sim' || e.cat === 'Bauteile') : !e.lab;
const defEx = () => EXAMPLES.find(exOk) || EXAMPLES[0];
function buildExample(e) {
  const d = e.make(); let id = 1; const parts = [], wires = [];
  d.parts.forEach(([k, x, y, r, v, extra]) => { const K = KINDS[k]; parts.push(Object.assign({ id: id++, k, x, y, r: r || 0, v: v != null ? v : K.v, sw: K.sw0 || 0, pos: K.pos0 != null ? K.pos0 : 0.5, vr: K.vr }, extra || {})); });
  d.wires.forEach(poly => { let wc; if (typeof poly[0] === 'string') { wc = poly[0]; poly = poly.slice(1); } for (let i = 2; i < poly.length; i += 2) wires.push(Object.assign({ id: id++, x1: poly[i - 2], y1: poly[i - 1], x2: poly[i], y2: poly[i + 1] }, wc ? { c: wc } : {})); });
  assignLabels(parts);
  const scopes = (d.scopes || []).map(i => ({ t: 'part', id: i + 1 }));
  return { name: e.name, parts, wires, nid: id, scopes, tempo: d.tempo, win: d.win, code: d.code, haus: d.haus };
}
/* Beispiele: Teile [Art, x, y, Drehung, Wert, Zusatz], Drähte als Linienzüge x1,y1,x2,y2,... */
const EXAMPLES = [
  { cat: 'Grundlagen', name: 'Spannungsteiler', info: 'Zwei Widerstände teilen 9 V im Verhältnis 1:2',
    make: () => ({ parts: [['BAT', 4, 4, 1, '9'], ['R', 8, 2, 1, '1k'], ['R', 8, 6, 1, '2k'], ['GND', 4, 10], ['VM', 12, 2, 1, '']],
      wires: [[4, 4, 4, 2, 8, 2], [8, 10, 4, 10, 4, 8], [8, 2, 12, 2], [12, 6, 12, 10, 8, 10]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'LED mit Vorwiderstand und Schalter', info: 'Schalter antippen. Ohne Vorwiderstand würde die LED durchbrennen.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['SPST', 2, 2, 0, '', { sw: 1 }], ['R', 6, 2, 0, '470'], ['LED', 10, 2, 1, 'rot'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [] }) },
  { cat: 'Filter und Schwingkreise', name: 'RC-Tiefpass', info: 'Wechselspannung 1 kHz: der Kondensator glättet das Signal',
    make: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['R', 2, 2, 0, '1k'], ['C', 6, 2, 1, '100n'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2] }) },
  { cat: 'Filter und Schwingkreise', name: 'RLC-Reihenschwingkreis', info: 'Resonanz bei etwa 160 Hz: Strom und Spannungen werden groß',
    make: () => ({ parts: [['AC', 2, 4, 1, '1V 160Hz'], ['L', 2, 2, 0, '10m'], ['R', 6, 2, 0, '10'], ['C', 10, 2, 1, '100u'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [10, 6, 10, 8, 2, 8]], scopes: [0, 3] }) },
  { cat: 'Dioden', name: 'Einweggleichrichter mit Glättung', info: 'Diode und Elko machen aus Wechsel- eine Gleichspannung',
    make: () => ({ parts: [['AC', 2, 4, 1, '10V 50Hz'], ['D', 2, 2, 0, '1N4007'], ['CE', 6, 2, 1, '100u'], ['R', 10, 2, 1, '1k'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [6, 2, 10, 2], [6, 6, 6, 8], [10, 6, 10, 8], [2, 8, 6, 8, 10, 8]], scopes: [0, 3] }) },
  { cat: 'Dioden', name: 'Z-Dioden-Stabilisierung', info: 'Die Z-Diode hält die Spannung am Verbraucher bei etwa 5,1 V',
    make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 2, 2, 0, '470'], ['ZD', 6, 6, 3, '5.1'], ['R', 10, 2, 1, '1k'], ['GND', 2, 8], ['VM', 14, 2, 1, '']],
      wires: [[2, 4, 2, 2], [6, 2, 10, 2, 14, 2], [6, 6, 6, 8], [10, 6, 10, 8], [14, 6, 14, 8, 10, 8, 6, 8, 2, 8]], scopes: [] }) },
  { cat: 'Transistoren', name: 'Transistor als Schalter', info: 'Schalter schließen: Der Basisstrom schaltet die LED',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['R', 10, 2, 1, '470'], ['LED', 10, 6, 1, 'grün'], ['NPN', 8, 12, 0, 'BC547'], ['R', 4, 12, 0, '10k'], ['SPST', 4, 6, 1, '', { sw: 1 }], ['GND', 2, 16]],
      wires: [[2, 4, 2, 2, 4, 2, 10, 2], [4, 6, 4, 2], [4, 10, 4, 12], [2, 8, 2, 16, 10, 16, 10, 14]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Lampen in Reihe und parallel', info: 'Links zwei Lampen in Reihe (dunkler), rechts zwei parallel (hell)',
    make: () => ({ parts: [['BAT', 2, 4, 1, '6'], ['LAMP', 8, 2, 1, '6V 0.1A'], ['LAMP', 8, 6, 1, '6V 0.1A'], ['LAMP', 14, 2, 1, '6V 0.1A'], ['LAMP', 18, 2, 1, '6V 0.1A'], ['GND', 2, 10]],
      wires: [[2, 4, 2, 2, 8, 2, 14, 2, 18, 2], [14, 6, 18, 6], [14, 6, 14, 10], [18, 6, 18, 10], [2, 8, 2, 10, 8, 10, 14, 10, 18, 10]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Reihenschaltung von Widerständen', info: '12 V an 1k + 2k + 3k: überall fließt derselbe Strom (2 mA)',
    make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 2, 2, 0, '1k'], ['R', 6, 2, 0, '2k'], ['R', 10, 2, 0, '3k'], ['AM', 14, 2, 0, ''], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [18, 2, 18, 8, 2, 8]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Parallelschaltung von Widerständen', info: 'An allen Zweigen liegt dieselbe Spannung, die Ströme addieren sich',
    make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['R', 4, 2, 1, '1k'], ['R', 8, 2, 1, '2k'], ['R', 12, 2, 1, '4k'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2, 4, 2, 8, 2, 12, 2], [4, 6, 4, 8], [8, 6, 8, 8], [12, 6, 12, 8], [2, 8, 4, 8, 8, 8, 12, 8]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Wheatstone-Brücke', info: 'Das Voltmeter zeigt die kleine Verstimmung der Brücke',
    make: () => ({ parts: [['BAT', 2, 2, 1, '10'], ['R', 6, 2, 1, '1k'], ['R', 6, 6, 1, '1k'], ['R', 12, 2, 1, '1k'], ['R', 12, 6, 1, '1.2k'], ['VM', 6, 6, 0, ''], ['GND', 2, 10]],
      wires: [[2, 2, 6, 2, 12, 2], [2, 6, 2, 10, 6, 10, 12, 10], [10, 6, 12, 6]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Potentiometer als Dimmer', info: 'Schleifer in der Seitenleiste verstellen: die LED wird heller oder dunkler',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['POT', 6, 2, 1, '1k', { pos: 0.6 }], ['R', 8, 4, 0, '330'], ['LED', 12, 4, 1, 'gelb'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2, 6, 2], [6, 6, 6, 8, 2, 8], [12, 8, 6, 8]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Lichtabhängiger Spannungsteiler (LDR)', info: 'Helligkeit des Fotowiderstands verändern: die Spannung am Voltmeter steigt und fällt',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['LDR', 6, 2, 1, '', { pos: 0.5 }], ['R', 6, 6, 1, '10k'], ['VM', 10, 6, 1, ''], ['GND', 2, 10]],
      wires: [[2, 4, 2, 2, 6, 2], [6, 6, 10, 6], [2, 8, 2, 10, 6, 10, 10, 10]], scopes: [] }) },
  { cat: 'Grundlagen', name: 'Wechselschaltung (Treppenhaus)', info: 'Die Lampe lässt sich von beiden Schaltern aus ein- und ausschalten',
    make: () => ({ parts: [['BAT', 2, 8, 3, '6'], ['SPDT', 4, 6, 0, ''], ['SPDT', 16, 6, 2, ''], ['LAMP', 16, 6, 1, '6V 0.1A'], ['GND', 0, 12]],
      wires: [[2, 8, 4, 8, 4, 6], [8, 5, 12, 5], [8, 7, 12, 7], [16, 10, 16, 12, 0, 12, 0, 4, 2, 4]], scopes: [] }) },
  { cat: 'Filter und Schwingkreise', name: 'RC-Hochpass', info: 'Tiefe Frequenzen werden gesperrt, hohe kommen durch (Grenzfrequenz ca. 1,6 kHz)',
    make: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['C', 2, 2, 0, '100n'], ['R', 6, 2, 1, '1k'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.5, win: 0.005 }) },
  { cat: 'Filter und Schwingkreise', name: 'LC-Schwingkreis', info: 'Wechsler umlegen: der geladene Kondensator schwingt mit der Spule (ca. 500 Hz)',
    make: () => ({ parts: [['BAT', 2, 5, 1, '10'], ['SPDT', 10, 6, 2, '', { sw: 1 }], ['C', 10, 6, 1, '10u'], ['L', 6, 7, 1, '10m'], ['GND', 2, 12]],
      wires: [[2, 5, 6, 5], [2, 9, 2, 12, 6, 12, 10, 12], [6, 11, 6, 12], [10, 10, 10, 12]], scopes: [2, 3], tempo: 0.55, win: 0.01 }) },
  { cat: 'Dioden', name: 'Brückengleichrichter mit Glättung', info: 'Vier Dioden richten beide Halbwellen gleich',
    make: () => ({ parts: [['AC', 6, 4, 0, '10V 50Hz'], ['D', 6, 4, 3, '1N4007'], ['D', 6, 8, 3, '1N4007'], ['D', 12, 4, 3, '1N4007'], ['D', 12, 8, 3, '1N4007'], ['R', 14, 0, 1, '1k'], ['CE', 18, 0, 1, '100u'], ['GND', 12, 8]],
      wires: [[10, 4, 12, 4], [6, 0, 12, 0, 14, 0, 18, 0], [6, 8, 12, 8], [14, 4, 14, 8, 12, 8], [18, 4, 18, 8, 14, 8]], scopes: [0, 5], tempo: 0.4, win: 0.1 }) },
  { cat: 'Dioden', name: 'Spannungsbegrenzer mit Dioden', info: 'Zwei gegenparallele Dioden begrenzen das Signal auf etwa ±0,7 V',
    make: () => ({ parts: [['AC', 2, 4, 1, '5V 1kHz'], ['R', 2, 2, 0, '1k'], ['D', 6, 2, 1, '1N4148'], ['D', 8, 6, 3, '1N4148'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [6, 2, 8, 2], [8, 6, 6, 6, 6, 8, 2, 8]], scopes: [0, 2], tempo: 0.5, win: 0.005 }) },
  { cat: 'Dioden', name: 'Spannungsverdoppler', info: 'Zwei Dioden und zwei Kondensatoren verdoppeln die Spitzenspannung',
    make: () => ({ parts: [['AC', 2, 4, 1, '5V 50Hz'], ['C', 2, 2, 0, '47u'], ['D', 6, 6, 3, '1N4148'], ['D', 6, 2, 0, '1N4148'], ['CE', 10, 2, 1, '47u'], ['R', 14, 2, 1, '10k'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [10, 2, 14, 2], [6, 6, 6, 8], [10, 6, 10, 8], [14, 6, 14, 8], [2, 8, 6, 8, 10, 8, 14, 8]], scopes: [0, 4], tempo: 0.4, win: 0.1 }) },
  { lab: 'code', cat: 'Grundlagen', name: 'Blink (LED an Pin 13)', info: 'Die LED an Pin 13 blinkt im Sekundentakt. Der Vorwiderstand schützt Pin und LED.',
    make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`// Blink: LED an Pin 13 ein- und ausschalten
void setup() {
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(13, HIGH);  // LED an
  delay(1000);             // eine Sekunde warten
  digitalWrite(13, LOW);   // LED aus
  delay(1000);
}
` }) },
  { lab: 'code', cat: 'Grundlagen', name: 'Taster schaltet LED (Pull-up)', info: 'Taster gedrückt halten: die LED leuchtet. Der Taster liegt zwischen Pin 2 und Masse, der interne Pull-up hält den Pin sonst auf HIGH.',
    make: () => ({ parts: [['UNO', 12, 0], ['PB', 24, 4, 1, ''], ['GND', 24, 8], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 4, 24, 4], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`const int tasterPin = 2;
const int ledPin = 13;

void setup() {
  pinMode(tasterPin, INPUT_PULLUP);  // Taster gegen Masse
  pinMode(ledPin, OUTPUT);
}

void loop() {
  if (digitalRead(tasterPin) == LOW) {   // gedrückt = LOW
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }
}
` }) },
  { lab: 'code', cat: 'Grundlagen', name: 'Poti dimmt LED (PWM)', info: 'Am Poti drehen (Regler unter dem Bauteil): die LED wird heller und dunkler. analogRead liest 0–1023, analogWrite schreibt 0–255.',
    make: () => ({ parts: [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['R', 22, 18, 0, '220'], ['LED', 26, 18, 0, 'gelb'], ['GND', 30, 18]], wires: [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 18, 22, 18]], scopes: [], tempo: 0.75,
      code: String.raw`const int potPin = A0;
const int ledPin = 9;       // Pin 9 kann PWM (~)

void setup() {
  pinMode(ledPin, OUTPUT);
}

void loop() {
  int wert = analogRead(potPin);   // 0 ... 1023
  analogWrite(ledPin, wert / 4);   // 0 ... 255
}
` }) },
  { lab: 'code', cat: 'Grundlagen', name: 'Poti-Schwelle mit Serial-Ausgabe', info: 'Das Programm gibt den Messwert aus und schaltet die LED ab 400. Unten im Serial-Monitor siehst du die Zahlen.',
    make: () => ({ parts: [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`// Conditionals: LED an, wenn der Poti-Wert über der Schwelle liegt
const int analogPin = A0;
const int ledPin = 13;
const int threshold = 400;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  int analogValue = analogRead(analogPin);

  if (analogValue > threshold) {
    digitalWrite(ledPin, HIGH);
  } else {
    digitalWrite(ledPin, LOW);
  }

  Serial.println(analogValue);
  delay(100);
}
` }) },
  { lab: 'code', cat: 'Grundlagen', name: 'Spannung messen (Serial-Plotter)', info: 'Poti drehen und im Serial-Monitor auf „Plotter“ umschalten: die Spannung erscheint als Kurve.',
    make: () => ({ parts: [['UNO', 12, 0], ['POT', 6, 4, 1, '10k', { pos: 0.4 }], ['GND', 6, 8]], wires: [[6, 4, 6, 0, 12, 0], [8, 6, 10, 6, 10, 8, 12, 8]], scopes: [], tempo: 0.75,
      code: String.raw`void setup() {
  Serial.begin(9600);
}

void loop() {
  int sensorValue = analogRead(A0);
  // 0 ... 1023 in 0 ... 5 V umrechnen
  float voltage = sensorValue * (5.0 / 1023.0);
  Serial.println(voltage);
  delay(50);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Melodie auf dem Lautsprecher', info: 'Die Melodie wird über den Lautsprecher abgespielt (Ton an, Lautsprecher-Symbol oben rechts). Der 100-Ω-Widerstand schützt den Pin.',
    make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 16, 0, '100'], ['SPK', 26, 16, 0, '8'], ['GND', 30, 16]], wires: [[20, 16, 22, 16]], scopes: [], tempo: 0.75,
      code: String.raw`#include "pitches.h"

// Noten der Melodie
int melody[] = {
  NOTE_C4, NOTE_G3, NOTE_G3, NOTE_A3, NOTE_G3, 0, NOTE_B3, NOTE_C4
};

// Notenlängen: 4 = Viertel, 8 = Achtel
int noteDurations[] = {
  4, 8, 8, 4, 4, 4, 4, 4
};

void setup() {
  for (int thisNote = 0; thisNote < 8; thisNote++) {
    int noteDuration = 1000 / noteDurations[thisNote];
    tone(8, melody[thisNote], noteDuration);
    int pauseBetweenNotes = noteDuration * 1.30;
    delay(pauseBetweenNotes);
    noTone(8);
  }
}

void loop() {
  // die Melodie nur einmal spielen
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Ultraschall-Abstandsmesser', info: 'Regler „Abstand“ am Sensor verändern: unter 100 cm leuchtet die rote LED, sonst die grüne. Messwerte im Serial-Monitor.',
    make: () => ({ parts: [['UNO', 12, 0], ['HCSR04', 24, 10, 0, '', { pos: 0.246 }], ['GND', 24, 16], ['R', 22, 22, 0, '220'], ['LED', 26, 22, 0, 'grün'], ['GND', 30, 22], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]],
      wires: [[24, 10, 22, 10, 22, -2, 20, -2], [20, 12, 24, 12], [20, 14, 24, 14], [20, 22, 22, 22], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`const int triggerPin = 6;
const int echoPin = 7;

// Misst die Echozeit des Ultraschall-Sensors (in Mikrosekunden)
long readUltrasonicDistance(int trigger, int echo) {
  pinMode(trigger, OUTPUT);
  digitalWrite(trigger, LOW);
  delayMicroseconds(2);
  digitalWrite(trigger, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigger, LOW);
  pinMode(echo, INPUT);
  return pulseIn(echo, HIGH);
}

void setup() {
  Serial.begin(9600);
  pinMode(11, OUTPUT);   // grüne LED
  pinMode(13, OUTPUT);   // rote LED
}

void loop() {
  float cm = 0.01723 * readUltrasonicDistance(triggerPin, echoPin);
  Serial.print(cm);
  Serial.println(" cm");
  if (cm < 100) {
    digitalWrite(13, HIGH);
    digitalWrite(11, LOW);
  } else {
    digitalWrite(13, LOW);
    digitalWrite(11, HIGH);
  }
  delay(100);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Servo Sweep', info: 'Der Servo fährt langsam hin und her (0° bis 180°).',
    make: () => ({ parts: [['UNO', 12, 0], ['SERVO', 24, 18], ['GND', 24, 22]], wires: [[20, 18, 24, 18], [24, 20, 26, 20, 26, -2, 20, -2]], scopes: [], tempo: 0.75,
      code: String.raw`#include <Servo.h>

Servo myservo;
int pos = 0;

void setup() {
  myservo.attach(9);
}

void loop() {
  for (pos = 0; pos <= 180; pos += 1) {
    myservo.write(pos);
    delay(15);
  }
  for (pos = 180; pos >= 0; pos -= 1) {
    myservo.write(pos);
    delay(15);
  }
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Temperatur mit dem TMP36', info: 'Regler „Temperatur“ am Sensor verändern und die Werte im Serial-Monitor beobachten. Beim TMP36 sind 0,5 V = 0 °C und 10 mV pro Grad.',
    make: () => ({ parts: [['UNO', 12, 0], ['TMP36', 6, 8, 0, '', { pos: 0.394 }], ['GND', 10, 12]], wires: [[10, 10, 11, 10, 11, 8, 12, 8], [10, 8, 9, 8, 9, 0, 12, 0]], scopes: [], tempo: 0.75,
      code: String.raw`void setup() {
  Serial.begin(9600);
}

void loop() {
  int raw = analogRead(A0);
  float volt = raw * 5.0 / 1023.0;
  float celsius = (volt - 0.5) * 100.0;   // TMP36: 10 mV pro Grad, 0,5 V bei 0 Grad
  Serial.print(celsius);
  Serial.println(" Grad C");
  delay(200);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Klopfsensor mit Piezo', info: 'Regler „Klopfen“ am Piezo hochziehen: Ab einem Messwert von 100 schaltet die LED um und der Serial-Monitor meldet „Knock!“. Regler wieder auf 0 stellen, damit nicht dauernd umgeschaltet wird.',
    make: () => ({ parts: [['UNO', 12, 0], ['PIEZO', 6, 8, 0, '', { pos: 0 }], ['GND', 10, 10], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[10, 8, 12, 8], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`const int ledPin = 13;
const int knockSensor = A0;
const int threshold = 100;

int sensorReading = 0;
int ledState = LOW;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  sensorReading = analogRead(knockSensor);
  if (sensorReading >= threshold) {
    ledState = !ledState;
    digitalWrite(ledPin, ledState);
    Serial.println("Knock!");
  }
  delay(100);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Touch-Lampe (Berührungssensor)', info: 'Regler „Finger“ an der Berührungsfläche hochziehen: Die LED leuchtet, solange berührt wird. Die Bibliothek CapacitiveSensor misst, wie lange sich die Fläche auflädt.',
    make: () => ({ parts: [['UNO', 12, 0], ['TOUCH', 24, 4, 0, '', { pos: 0 }], ['R', 22, 26, 0, '220'], ['LED', 26, 26, 0, 'rot'], ['GND', 30, 26]], wires: [[20, 4, 24, 4], [20, 26, 22, 26]], scopes: [], tempo: 0.75,
      code: String.raw`#include <CapacitiveSensor.h>

// Sendepin 4, Empfangspin 2 (dort hängt die Berührungsfläche)
CapacitiveSensor cs_4_2 = CapacitiveSensor(4, 2);

void setup() {
  pinMode(13, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  long total = cs_4_2.capacitiveSensor(30);
  Serial.println(total);
  if (total > 1000) {
    digitalWrite(13, HIGH);
  } else {
    digitalWrite(13, LOW);
  }
  delay(100);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'Ampel mit drei LEDs', info: 'Eine Fußgängerampel nur mit delay(): rot, rot-gelb, grün, gelb.',
    make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 8, 0, '220'], ['LED', 26, 8, 0, 'rot'], ['GND', 30, 8], ['R', 22, 16, 0, '220'], ['LED', 26, 16, 0, 'gelb'], ['GND', 30, 16], ['R', 22, 24, 0, '220'], ['LED', 26, 24, 0, 'grün'], ['GND', 30, 24]], wires: [[20, 8, 22, 8], [20, 16, 22, 16], [20, 24, 22, 24]], scopes: [], tempo: 0.75,
      code: String.raw`const int rot = 4;
const int gelb = 8;
const int gruen = 12;

void setup() {
  pinMode(rot, OUTPUT);
  pinMode(gelb, OUTPUT);
  pinMode(gruen, OUTPUT);
}

void loop() {
  digitalWrite(rot, HIGH);
  delay(3000);
  digitalWrite(gelb, HIGH);     // rot-gelb
  delay(1000);
  digitalWrite(rot, LOW);
  digitalWrite(gelb, LOW);
  digitalWrite(gruen, HIGH);
  delay(3000);
  digitalWrite(gruen, LOW);
  digitalWrite(gelb, HIGH);
  delay(1000);
  digitalWrite(gelb, LOW);
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'RGB-Farbwechsel', info: 'Die RGB-LED mischt Farben: jeder Kanal wird per PWM gedimmt.',
    make: () => ({ parts: [['UNO', 12, 0], ['R', 22, 18, 0, '220'], ['R', 22, 20, 0, '220'], ['R', 22, 22, 0, '220'], ['RGBLED', 30, 18], ['GND', 34, 20]], wires: [[20, 18, 22, 18], [20, 20, 22, 20], [20, 22, 22, 22], [26, 18, 30, 18], [26, 20, 30, 20], [26, 22, 30, 22]], scopes: [], tempo: 0.75,
      code: String.raw`const int redPin = 9;
const int greenPin = 10;
const int bluePin = 11;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  // von Rot über Grün nach Blau und zurück überblenden
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(redPin, 255 - i);
    analogWrite(greenPin, i);
    analogWrite(bluePin, 0);
    delay(30);
  }
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(greenPin, 255 - i);
    analogWrite(bluePin, i);
    delay(30);
  }
  for (int i = 0; i <= 255; i += 5) {
    analogWrite(bluePin, 255 - i);
    analogWrite(redPin, i);
    delay(30);
  }
}
` }) },
  { lab: 'code', cat: 'Töne und Sensoren', name: 'LCD mit Sekundenzähler', info: 'Das Display (I²C an A4/A5) zeigt Text und die vergangenen Sekunden.',
    make: () => ({ parts: [['UNO', 12, 0], ['LCDI2C', 1, 10], ['GND', 10, 10]], wires: [[10, 12, 11, 12, 11, 0, 12, 0], [10, 14, 11, 14, 11, 16, 12, 16], [10, 16, 10, 18, 12, 18]], scopes: [], tempo: 0.75,
      code: String.raw`#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("Hallo Tonfunk!");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Zaehler: ");
  lcd.print(millis() / 1000);
  lcd.print("   ");
  delay(200);
}
` }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Ausschaltung mit Sicherungsautomat', info: 'Schalter antippen: die Lampe geht an und aus. Der Sicherungsautomat schützt die Leitung.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', 1, 6, 1, '', { sw: 1 }], ['LAMP', -3, 12, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 10, 1, 12, -3, 12], ['blau', 3, 0, 3, 18, -3, 18, -3, 16]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Wechselschaltung (zwei Orte)', info: 'Die Lampe lässt sich von beiden Wechselschaltern aus ein- und ausschalten. Die schwarzen Adern sind die Wechseldrähte.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPDT', 1, 6, 1, ''], ['SPDT', 1, 22, 3, ''], ['LAMP', -3, 24, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['schwarz', 2, 10, 2, 18], ['schwarz', 0, 10, 0, 18], ['braun', 1, 22, 1, 24, -3, 24], ['blau', 3, 0, 3, 30, -3, 30, -3, 28]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Kreuzschaltung (drei Orte)', info: 'Zwei Wechselschalter und ein Kreuzschalter in der Mitte: von jedem der drei Orte lässt sich das Licht schalten.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPDT', 1, 6, 1, ''], ['KREUZ', 0, 12], ['SPDT', 1, 22, 3, ''], ['LAMP', -3, 24, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['schwarz', 2, 10, 2, 12], ['schwarz', 0, 10, 0, 12], ['schwarz', 0, 16, 0, 18], ['schwarz', 2, 16, 2, 18], ['braun', 1, 22, 1, 24, -3, 24], ['blau', 3, 0, 3, 30, -3, 30, -3, 28]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Stromstoßschalter (Treppenhaus)', info: 'Zwei Taster an verschiedenen Orten: jeder Druck schaltet das Licht um. Dauerhaft halten ist nicht nötig.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PB', -4, 6, 1, ''], ['PB', -8, 6, 1, ''], ['IMP', -6, 12, 0, '230V'], ['LAMP', -2, 20, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -4, 6, -8, 6], ['schwarz', -8, 10, -6, 10, -4, 10], ['schwarz', -6, 10, -6, 12], ['braun', 1, 6, 1, 12, 0, 12], ['schwarz', 0, 16, 0, 20, -2, 20],
              ['blau', 3, 0, 3, 24, 3, 26], ['blau', -2, 24, 3, 24], ['blau', -6, 16, -6, 26, 3, 26]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'FI-Schutzschalter an der Steckdose', info: 'Steckdose antippen = Gerät defekt (Körperschluss). Der FI misst den Fehlerstrom und schaltet innerhalb von Millisekunden ab.',
    make: () => ({ parts: [['NETZ', 1, 0], ['RCD', 1, 2], ['LSS', 1, 6, 1, 'B16'], ['SD', -3, 10, 0, '2000W']],
      wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 2], ['blau', 3, 6, 3, 12, 1, 12], ['gruen', 5, 0, 5, 14, 1, 14]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Überlast: drei Heizlüfter', info: 'Dritten Schalter einschalten: 26 A sind mehr als der Sicherungsautomat B16 erlaubt. Nach einigen Sekunden löst er aus.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', -4, 6, 1, '', { sw: 1 }], ['SPST', -8, 6, 1, '', { sw: 1 }], ['SPST', -12, 6, 1, '', { sw: 0 }], ['HEAT', -4, 10, 1, '230V 2000W'], ['HEAT', -8, 10, 1, '230V 2000W'], ['HEAT', -12, 10, 1, '230V 2000W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -4, 6, -8, 6, -12, 6], ['blau', 3, 0, 3, 16, -4, 16, -8, 16, -12, 16], ['blau', -4, 14, -4, 16], ['blau', -8, 14, -8, 16], ['blau', -12, 14, -12, 16]], scopes: [0, 5, 6, 7], tempo: 0.6, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Kurzschluss löst den Sicherungsautomaten aus', info: 'Fehlerstelle antippen: ein Kurzschluss zieht sehr hohen Strom. Der Sicherungsautomat schaltet sofort ab.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['LAMP', -3, 6, 1, '230V 60W'], ['FAULT', -7, 6, 1, '0.05']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -3, 6, -7, 6], ['blau', 3, 0, 3, 12, -3, 12, -7, 12], ['blau', -3, 10, -3, 12], ['blau', -7, 10, -7, 12]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Verteilung mit zwei Stromkreisen (Flur und Bad)', info: 'Ein FI schützt beide Stromkreise, jeder hat einen eigenen Sicherungsautomaten. Schalter antippen.',
    make: () => ({ parts: [['NETZ', 1, 0], ['RCD', 1, 2], ['LSS', -4, 8, 1, 'B10'], ['LSS', -10, 8, 1, 'B10'], ['SPST', -4, 12, 1, '', { sw: 1 }], ['SPST', -10, 12, 1, '', { sw: 1 }], ['LAMP', -4, 16, 1, '230V 60W'], ['LAMP', -10, 16, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 2], ['braun', 1, 6, 1, 8, -4, 8, -10, 8], ['blau', 3, 6, 3, 22, -4, 22, -10, 22], ['blau', -4, 20, -4, 22], ['blau', -10, 20, -10, 22]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Zwei Schalter in Reihe (UND)', info: 'Die Lampe leuchtet nur, wenn beide Schalter geschlossen sind.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', 1, 6, 1, '', { sw: 1 }], ['SPST', 1, 10, 1, '', { sw: 1 }], ['LAMP', 1, 14, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 22, 1, 22, 1, 18]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Zwei Schalter parallel (ODER)', info: 'Die Lampe leuchtet, wenn mindestens ein Schalter geschlossen ist.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['SPST', 1, 8, 1, '', { sw: 1 }], ['SPST', -3, 8, 1, ''], ['LAMP', 1, 14, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, 1, 8, -3, 8], ['braun', 1, 12, 1, 14], ['braun', -3, 12, -3, 14, 1, 14], ['blau', 3, 0, 3, 22, 1, 22, 1, 18]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Selbsthaltung (Start und Stopp)', info: 'Start drücken: das Schütz zieht an und hält sich über Hilfskontakt 13/14 selbst. Stopp (Öffner) schaltet aus.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PBC', -5, 7, 1, '', { l: 'S2' }], ['PB', -9, 11, 0, '', { l: 'S1' }], ['SCHUETZ', -14, 14, 0, '230V'], ['LAMP', -11, 22, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, 1, 7, -5, 7], ['schwarz', -9, 11, -9, 14, -14, 14], ['schwarz', -5, 11, -5, 14], ['braun', 1, 6, 1, 18, -5, 18], ['braun', -9, 18, -11, 18, -11, 22],
              ['blau', 3, 0, 3, 28, -11, 28, -14, 28, -14, 20], ['blau', -11, 26, -11, 28]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Drehstrom', name: 'Drehstrommotor am Netz 400 V', info: 'Drei Außenleiter L1, L2, L3 (je 120° versetzt) speisen den Motor. In den Graphen siehst du die drei Phasen, der Läufer dreht sich.',
    make: () => ({ parts: [['NETZ3', 1, 0], ['MOTOR3', 2, 10, 0, '400V 2.2kW']],
      wires: [['braun', 1, 0, 1, 8, 2, 8, 2, 10], ['schwarz', 3, 0, 3, 6, 4, 6, 4, 10], ['grau', 5, 0, 5, 4, 6, 4, 6, 10]], scopes: [0, 1], tempo: 0.55, win: 0.04 }) },
  { cat: 'Bauteile', name: 'Netzteil: Brückengleichrichter mit Glättung', info: 'Der Brückengleichrichter formt die Wechselspannung in pulsierende Gleichspannung um, der Elko glättet sie.',
    make: () => ({ parts: [['AC', 2, 4, 1, '12V 50Hz'], ['BRUECKE', 6, 2], ['CE', 14, 2, 1, '470u'], ['R', 18, 2, 1, '220'], ['GND', 8, 6]],
      wires: [[2, 4, 6, 4], [2, 8, 10, 8, 10, 4], [8, 2, 14, 2, 18, 2], [8, 6, 14, 6, 18, 6]], scopes: [0, 2], tempo: 0.45, win: 0.06 }) },
  { cat: 'Bauteile', name: 'Festspannung 5 V mit Spannungsregler 7805', info: 'Der 7805 macht aus 9 V eine stabile Ausgangsspannung von 5 V.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['REG', 6, 2, 0, '7805'], ['R', 10, 2, 0, '330'], ['LED', 14, 2, 1, 'grün'], ['VM', 18, 2, 1, ''], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2, 6, 2], [8, 4, 8, 8, 2, 8], [14, 6, 14, 8, 8, 8], [10, 2, 10, 0, 18, 0, 18, 2], [18, 6, 18, 8, 14, 8]], scopes: [], tempo: 0.7 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Schütz schaltet einen Heizlüfter', info: 'Taster gedrückt halten: das Schütz (Spule 230 V) zieht an und schaltet den Heizlüfter über seinen Hauptkontakt. Steuer- und Laststromkreis sind getrennt.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['PB', -1, 6, 1, ''], ['SCHUETZ', -12, 10, 0, '230V'], ['HEAT', -9, 18, 1, '230V 2000W']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -1, 6], ['schwarz', -1, 10, -1, 8, -12, 8, -12, 10], ['braun', 1, 6, 1, 14, -3, 14], ['braun', -7, 14, -9, 14, -9, 18],
              ['blau', 3, 0, 3, 22, -9, 22, -12, 22, -12, 16]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { cat: 'Bauteile', name: 'Motor mit Bremse', info: 'Seitenleiste: „Bremse / Last“ hochziehen. Der Strom steigt, die Drehzahl fällt. Bei Blockade brennt der Motor durch.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '6'], ['SPST', 2, 2, 0, '', { sw: 1 }], ['MOTOR', 6, 2, 0, '6V', { pos: 0 }], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [10, 2, 10, 8, 2, 8]], scopes: [2], tempo: 0.7, win: 1 }) },
  { cat: 'Bauteile', name: 'Sicherung schützt die Lampen', info: 'Dritten Schalter schließen: 0,3 A sind mehr als die 250-mA-Sicherung. Sie löst aus und alles geht aus.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['FUSE', 2, 2, 0, '250mA'], ['SPST', 8, 2, 1, '', { sw: 1 }], ['LAMP', 8, 6, 1, '9V 0.1A'], ['SPST', 12, 2, 1, '', { sw: 1 }], ['LAMP', 12, 6, 1, '9V 0.1A'], ['SPST', 16, 2, 1, '', { sw: 0 }], ['LAMP', 16, 6, 1, '9V 0.1A'], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [6, 2, 8, 2, 12, 2, 16, 2], [2, 8, 2, 10, 8, 10, 12, 10, 16, 10]], scopes: [], tempo: 0.75 }) },
  { cat: 'Bauteile', name: 'Relais schaltet eine zweite Last', info: 'Taster drücken: das Relais zieht an und schaltet die Lampe um. Der Steuerstromkreis ist vom Lastkreis getrennt.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['PB', 2, 2, 0, ''], ['RLY', 8, 2, 0, '12V'], ['LAMP', 16, 2, 0, '12V 0.1A'], ['LAMP', 16, 6, 0, '12V 0.1A'], ['BAT', 22, 2, 1, '12'], ['GND', 2, 8], ['GND', 22, 6]],
      wires: [[2, 4, 2, 2], [6, 2, 8, 2], [8, 6, 8, 8, 2, 8], [20, 2, 20, 6], [20, 2, 22, 2], [13, 4, 13, 10, 22, 10, 22, 6]], scopes: [], tempo: 0.75 }) },
  { cat: 'Bauteile', name: 'Thyristor zündet und hält', info: 'Taster kurz drücken: der Thyristor zündet und die Lampe bleibt an, auch wenn der Taster wieder loslässt. „Zurück“ löscht.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['LAMP', 2, 2, 0, '9V 0.1A'], ['THY', 6, 2, 0, 'TIC106'], ['R', 9, 4, 1, '1k'], ['PB', 5, 8, 0, ''], ['GND', 2, 8]],
      wires: [[5, 8, 4, 8, 4, 4, 2, 4, 2, 2], [10, 2, 16, 2, 16, 12, 2, 12, 2, 8]], scopes: [], tempo: 0.75 }) },
  { cat: 'Bauteile', name: 'Transformator 230 V : 12 V', info: 'Die Primärseite liegt an 230 V, sekundär kommen etwa 12 V heraus. Beide Seiten sind galvanisch getrennt.',
    make: () => ({ parts: [['AC', 2, 4, 1, '325V 50Hz'], ['TRF', 6, 2, 0, '230V:12V'], ['LAMP', 14, 2, 1, '12V 0.1A'], ['GND', 2, 8], ['GND', 12, 6]],
      wires: [[2, 4, 2, 2, 6, 2], [6, 6, 6, 10, 2, 10, 2, 8], [12, 2, 14, 2], [14, 6, 12, 6]], scopes: [0, 2], tempo: 0.4, win: 0.06 }) },
  { cat: 'Bauteile', name: 'NTC-Temperaturfühler mit LED', info: 'Seitenleiste: Temperatur des NTC erhöhen. Wird er warm, sinkt sein Widerstand und die LED geht an.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['NTC', 6, 2, 1, '10k', { pos: 0.3 }], ['R', 6, 6, 1, '680'], ['R', 8, 2, 0, '470'], ['LED', 12, 2, 1, 'rot'], ['NPN', 10, 8, 0, 'BC547'], ['GND', 2, 8], ['GND', 6, 10], ['GND', 12, 10]],
      wires: [[2, 4, 2, 2, 6, 2, 8, 2], [6, 6, 8, 6, 8, 8, 10, 8]], scopes: [], tempo: 0.75 }) },
  { cat: 'Logik', name: 'UND-Gatter mit zwei Schaltern', info: 'Die LED leuchtet nur, wenn beide Schalter geschlossen sind',
    make: () => ({ parts: [['BAT', 2, 4, 1, '5'], ['SPST', 6, 2, 1, '', { sw: 1 }], ['SPST', 8, 2, 1, '', { sw: 1 }], ['AND', 12, 8, 0, '5V'], ['R', 16, 9, 0, '470'], ['LED', 20, 9, 1, 'grün'], ['GND', 2, 8], ['GND', 20, 13]],
      wires: [[2, 4, 2, 2, 6, 2, 8, 2], [8, 6, 8, 8, 12, 8], [6, 6, 6, 10, 12, 10]], scopes: [], tempo: 0.75 }) },
  { cat: 'Logik', name: 'NOR-Flipflop (Speicher)', info: 'Taster S setzt, Taster R löscht: das Gatterpaar merkt sich den Zustand',
    make: () => ({ parts: [['BAT', 2, 2, 1, '5'], ['PB', 6, 0, 1, ''], ['PB', 8, 0, 1, ''], ['NOR', 14, 2, 0, '5V'], ['NOR', 14, 10, 0, '5V'], ['R', 21, 3, 0, '470'], ['LED', 25, 3, 1, 'rot'], ['GND', 2, 6], ['GND', 25, 7]],
      wires: [[2, 2, 2, 0, 6, 0, 8, 0], [8, 4, 10, 4, 10, 2, 14, 2], [6, 4, 6, 10, 14, 10],
              [18, 3, 21, 3, 21, 14, 12, 14, 12, 12, 14, 12], [18, 11, 19, 11, 19, 7, 12, 7, 12, 4, 14, 4]], scopes: [3, 4], tempo: 0.75, win: 5 }) },
  { cat: 'Logik', name: '555-Blinker (astabil)', info: 'Der 555 lädt und entlädt den Kondensator und lässt die LED etwa 1,4-mal pro Sekunde blinken',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['ICX', 14, 6, 0, 'NE555', { n: 8 }], ['R', 26, 2, 1, '10k'], ['R', 26, 8, 1, '47k'], ['C', 13, 16, 0, '10u'], ['R', 20, 12, 0, '470'], ['LED', 24, 12, 1, 'rot'], ['GND', 2, 8], ['GND', 17, 16], ['GND', 24, 16]],
      wires: [[2, 4, 2, 2, 16, 2, 18, 2, 26, 2], [16, 4, 16, 2], [18, 4, 18, 2], [26, 6, 26, 8], [20, 8, 26, 8],
              [14, 10, 12, 10, 12, 12, 14, 12], [12, 12, 12, 16, 13, 16], [26, 12, 26, 19, 12, 19, 12, 16]], scopes: [4, 6], tempo: 0.75, win: 3 }) },
  { cat: 'Logik', name: 'Operationsverstärker als Komparator', info: 'Poti drehen: liegt IN+ über der Referenz von 4,5 V, schaltet der Ausgang die LED ein',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['POT', 4, 2, 1, '10k', { pos: 0.4 }], ['R', 12, 2, 1, '10k'], ['R', 12, 6, 1, '10k'], ['OPA', 16, 8, 0, 'LM358'], ['R', 20, 9, 0, '470'], ['LED', 24, 9, 1, 'grün'], ['GND', 2, 8], ['GND', 4, 6], ['GND', 12, 10], ['GND', 18, 12], ['GND', 24, 13]],
      wires: [[2, 4, 2, 2, 4, 2, 12, 2, 18, 2, 18, 6], [12, 6, 14, 6, 14, 8, 16, 8], [6, 4, 6, 13, 14, 13, 14, 10, 16, 10]], scopes: [], tempo: 0.75 }) },
  { cat: 'Transistoren', name: 'Emitterschaltung (Verstärker)', info: 'Der Transistor verstärkt das kleine Wechselsignal etwa 100-fach',
    make: () => ({ parts: [['AC', 2, 6, 1, '10mV 1kHz'], ['C', 2, 6, 0, '10u'], ['R', 6, 0, 1, '47k'], ['R', 6, 6, 1, '10k'], ['NPN', 8, 6, 0, 'BC547'], ['R', 10, 0, 1, '2.2k'], ['R', 10, 8, 1, '470'], ['CE', 10, 4, 0, '10u'], ['R', 14, 4, 1, '10k'], ['BAT', 18, 4, 1, '12'], ['CE', 12, 8, 1, '100u'], ['GND', 2, 12]],
      wires: [[18, 4, 18, 0, 10, 0, 6, 0], [18, 8, 18, 12, 14, 12, 12, 12, 10, 12, 6, 12, 2, 12], [2, 10, 2, 12], [6, 10, 6, 12], [6, 4, 6, 6, 8, 6], [10, 8, 12, 8], [14, 8, 14, 12]], scopes: [0, 8], tempo: 0.62, win: 0.004 }) },
];

/* ---- Leitungen und Messen: Baukasten für Beispiele und Aufgaben ---- */
// Einfacher Stromkreis: Netz, Automat, Leitung L (W1) und N (W2), Verbraucher E1, Schutzleiter über Leitung W3 (pe: 'cable') oder Draht
const houseLine = (o = {}) => {
  const cab = o.cab || '1.5mm2 50m', pe = o.pe, P = [['NETZ', 1, 0], ['LSS', 1, 2, 1, o.ln || 'B16'], ['CABLE', 1, 8, 1, cab, Object.assign({ l: 'W1' }, (o.def || {}).W1 ? { defect: o.def.W1 } : {})], ['CABLE', 3, 8, 1, o.ncab || cab, Object.assign({ l: 'W2' }, (o.def || {}).W2 ? { defect: o.def.W2 } : {})], [o.load || 'HEAT', 1, 14, 1, o.lv || '230V 2000W', Object.assign({ l: 'E1' }, o.body ? { defect: 'body' } : {})]];
  const W = [['braun', 1, 0, 1, 2], ['braun', 1, 6, 1, 8], ['braun', 1, 12, 1, 14], ['blau', 3, 0, 3, 8], ['blau', 3, 12, 3, 18, 1, 18]];
  if (pe === 'cable') { P.push(['CABLE', 5, 8, 1, o.pcab || cab, Object.assign({ l: 'W3' }, (o.def || {}).W3 ? { defect: o.def.W3 } : {})]); W.push(['gruen', 5, 0, 5, 8], ['gruen', 5, 12, 5, 22, -1, 22, -1, 16]); }
  else if (pe === 'chain') { [[2, 'a'], [8, 'b'], [14, 'c']].forEach(([y, s]) => P.push(['CABLE', 5, y, 1, o.pcab || cab, Object.assign({ l: 'W3' + s }, (o.def || {})['W3' + s] ? { defect: o.def['W3' + s] } : {})])); W.push(['gruen', 5, 0, 5, 2], ['gruen', 5, 6, 5, 8], ['gruen', 5, 12, 5, 14], ['gruen', 5, 18, 5, 22, -1, 22, -1, 16]); }
  if (o.inst) { P.push([o.inst, 8, 14, 0, '']); W.push(['gelb', 8, 14, 1, 14], ['gelb', 12, 14, 12, 20, -1, 20, -1, 16]); }
  return { parts: P, wires: W, scopes: [], tempo: 0.6, win: 0.04 };
};
const IZ_OF = v => LS.cableOf(v).iz;
const lssIn = p => { const m = String(p.v || '').match(/(\d+(?:[.,]\d+)?)/); return m ? parseFloat(m[1].replace(',', '.')) : NaN; };
EXAMPLES.push(
  { lab: 'sim', cat: 'Hausinstallation', name: 'Leitung: Spannungsfall bei langer Zuleitung', info: 'Ein 2-kW-Heizlüfter hängt an 50 m Leitung mit 1,5 mm². Die Leitung hat Widerstand, deshalb kommt am Gerät weniger als 230 V an. Das Oszilloskop zeigt die Spannung am Heizlüfter. Probier 2.5mm2 aus (Leitung antippen, Wert ändern).',
    make: () => houseLine({ cab: '1.5mm2 50m' }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Leitungsschutz: Leitung zu schwach', info: 'Ein 4-kW-Heizlüfter an 1,5 mm² und B20: 17 A sind mehr als die Leitung (16,5 A) verträgt, der Automat löst aber nicht aus. Die Leitung wird heiß und brennt durch. Merke: Der Automat muss zur Leitung passen (In ≤ Iz).',
    make: () => houseLine({ cab: '1.5mm2 10m', ln: 'B20', lv: '230V 4000W' }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Messen: Isolation zwischen Gerät und Schutzleiter', info: 'Das Isolationsmessgerät hängt zwischen dem Außenleiter-Anschluss des Geräts und dem Schutzleiter. Bei gesundem Gerät zeigt es mehr als 500 MΩ. Schalte vorher den Automaten aus (freischalten!). Im Bedienfeld kannst du am Gerät einen Körperschluss einschalten und die Messung wiederholen.',
    make: () => houseLine({ cab: '1.5mm2 10m', pe: 'cable', inst: 'ISO' }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Messen: Schleifenimpedanz am Verbraucher', info: 'Das Zs-Messgerät misst die Schleife Außenleiter, Quelle, Schutzleiter. Der Wert entscheidet, ob der Automat im Fehlerfall schnell genug auslöst: für B16 darf Zs höchstens 2,9 Ω betragen. Mach die Leitungen länger oder dünner und beobachte den Wert.',
    make: () => houseLine({ cab: '1.5mm2 60m', pe: 'cable', inst: 'ZS' }) },
);
if (window.MORE_EX) EXAMPLES.push(...window.MORE_EX);
/* ---- DigiLab-Schnittstelle: Beispiele und Aufgaben werden in digi.js beschrieben, Verdrahtung läuft über den Auto-Weg ---- */
const mkPartsFromRows = rows => rows.map(([k, x, y, r, v, extra], i) => Object.assign({ id: i + 1, k, x, y, r: r || 0, v: v != null ? v : KINDS[k].v, sw: KINDS[k].sw0 || 0, pos: KINDS[k].pos0 != null ? KINDS[k].pos0 : 0.5, vr: KINDS[k].vr }, extra || {}));
window.LabDigiAPI = {
  KINDS, simEval, RES, needKinds, byPart, pinsOf, pinV, vAt, vAcross, ledElem, fmt1, fmt, nm, taskDone, markDone, loadCircuit, buildExample, rebuild, refreshUI, draw, commit, toast, saveNamed,
  get sch() { return sch; }, get sim() { return sim; }, get circ() { return circ; }, get simMode() { return simMode; }, get running() { return running; },
  mkParts: mkPartsFromRows,
  pinPts: rows => mkPartsFromRows(rows).map(p => pinsOf(p)),
  addExamples: list => { EXAMPLES.push(...list); },
  buildJob: () => buildJob(),
  addTasks: list => { TASKS.push(...list.map(t => Object.assign({ lab: LAB }, t))); },
  get tool() { return tool; }, setTool: (t, k) => setTool(t, k), toggleRun, setSimMode: on => setSimMode(on),
  get meter() { return meter; }, meterText, meterDial, meterReset, meterTap, scopeValues, toggleScope, sv, rebuildKeep, staticR: (a, b) => staticR(a, b, 1, 'ohm'),
  get scopeBuf() { return scopeBuf; }, get graphWin() { return graphWin; }, setGraphWin: w => { graphWin = w; scopeBuf = sch.scopes.map(() => ({ t: [], v: [], i: [] })); lastSample = -1; },
  tasksList: () => labTasks(),
  pressBtn: id => { const p = byPart(id); if (p) pressPart(p); }, releaseBtn: (id, force) => { const p = byPart(id); if (p) releasePart(p, !!force); },
  setSw: (id, v) => { const p = byPart(id); if (!p) return; p.sw = v ? 1 : 0; const w = wrapMap.get(id); if (w) w.sw = p.sw; },
  get canvas() { return cv; }, get dirty() { return dirtyDraw; }, rectOf: () => rectOf(), taskDoneMap: () => taskDone(), vAtKey: key => sv(key),
  withSch(tmp, fn) { const saved = sch; sch = tmp; try { return fn(); } finally { sch = saved; } },
  /* nets: Liste von Punktfolgen [[x,y],[x,y],...]; jedes Paar benachbarter Punkte wird per Auto-Weg als Draht gelegt. Ergebnis: Polylinien [x1,y1,x2,y2,...] */
  routeNets(rows, nets, pre) {   // pre: bereits feste Drähte als Polylinien [x1,y1,x2,y2,...]; der Auto-Weg weicht ihnen aus und liefert sie nicht mit zurück
    const saved = sch; let fails = 0;
    const fixed = []; (pre || []).forEach(pl => { for (let i = 0; i + 3 < pl.length; i += 2) fixed.push({ fixed: true, id: -1 - fixed.length, x1: pl[i], y1: pl[i + 1], x2: pl[i + 2], y2: pl[i + 3] }); });
    sch = { name: 'tmp', parts: mkPartsFromRows(rows), wires: fixed, nid: 5000, scopes: [] };
    const near = (p, q) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]), groups = new Map();
    try {
      nets.forEach(net => {
        const gk0 = net[0][0] + ',' + net[0][1]; if (!groups.has(gk0)) groups.set(gk0, { pins: [net[0]], wires: [] });
        const pins = groups.get(gk0).pins, myWires = groups.get(gk0).wires;     // Netze mit gleichem Startpunkt teilen ihre Drähte: Abzweige dürfen an sie anschließen
        for (let i = 1; i < net.length; i++) {
          const sink = net[i]; let done = false;
          if (pins.some(q => q[0] === sink[0] && q[1] === sink[1])) { pins.push(sink); continue; }
          const cand = pins.slice();
          myWires.forEach(w => { const dx = Math.sign(w.x2 - w.x1), dy = Math.sign(w.y2 - w.y1); let x = w.x1, y = w.y1; for (let k = 0; k < 80; k++) { cand.push([x, y]); if (x === w.x2 && y === w.y2) break; x += dx; y += dy; } });
          cand.sort((p, q) => near(p, sink) - near(q, sink));
          const seen = new Set();
          for (const t of cand) {
            if (seen.size >= 16) break; const k = t[0] + ',' + t[1]; if (seen.has(k)) continue; seen.add(k);
            let path = null; try { path = routeWire(sink, t); } catch (e) { path = null; }
            if (!path || path.length < 2) continue;
            const pts = [path[0]];
            for (let q = 1; q < path.length - 1; q++) { const dx1 = path[q][0] - path[q - 1][0], dy1 = path[q][1] - path[q - 1][1], dx2 = path[q + 1][0] - path[q][0], dy2 = path[q + 1][1] - path[q][1]; if (dx1 !== dx2 || dy1 !== dy2) pts.push(path[q]); }
            pts.push(path[path.length - 1]);
            splitWiresAt(pts[0]); splitWiresAt(pts[pts.length - 1]);
            for (let q = 0; q + 1 < pts.length; q++) { const w = { id: sch.nid++, x1: pts[q][0], y1: pts[q][1], x2: pts[q + 1][0], y2: pts[q + 1][1] }; sch.wires.push(w); myWires.push(w); }
            done = true; break;
          }
          if (!done) { fails++; console.warn('Kein Weg gefunden', sink, net[0]); }
          pins.push(sink);
        }
      });
      window.LabDigiAPI.routeFails = (window.LabDigiAPI.routeFails || 0) + fails;
      return sch.wires.filter(w => w.id >= 5000).map(w => [w.x1, w.y1, w.x2, w.y2]);
    } finally { sch = saved; }
  }
};
if (LAB === 'digi' && window.DIGI_DEF) window.DIGI_DEF(window.LabDigiAPI);
if (LAB === 'mess' && window.MESS_DEF) window.MESS_DEF(window.LabDigiAPI);
if (LAB === 'haus' && window.HAUS_DEF) window.HAUS_DEF(window.LabDigiAPI);

if (LAB === 'sim' && window.addPE) EXAMPLES.forEach(e => { if (!e.noPE && (e.lab === 'sim' || e.cat === 'Bauteile')) { const mk = e.make; e.raw = mk; e.make = () => window.addPE(mk()); } });
// Haus-Beispiele ohne eigene Oszilloskope: je Verbraucher (bis zu vier) eins, damit jede Schalterstellung sichtbar ist
if (LAB === 'sim') EXAMPLES.forEach(e => { if (e.noScopes) return; const mk = e.make; e.make = () => {
  const d = mk(); if ((d.scopes && d.scopes.length) || !d.parts) return d;
  const LOADS = ['LAMP', 'HEAT', 'MOTOR', 'MOTOR3', 'SD'], idx = []; d.parts.forEach((p, i) => { if (LOADS.includes(p[0])) idx.push(i); });
  const mains = d.parts.some(p => p[0] === 'NETZ' || p[0] === 'NETZ3');
  if (!idx.length || (!mains && e.name !== 'Sicherung schützt die Lampen')) return d;
  return Object.assign({}, d, { scopes: idx.slice(0, 4), win: d.win || (mains ? 0.04 : undefined) });
}; });

/* ============ Drucken ============ */
const userName = () => { try { return localStorage.getItem('lm4.name') || ''; } catch (e) { return ''; } };
function planBounds() {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  sch.parts.forEach(p => { const K = KD(p); [[K.box[0], K.box[1]], [K.box[2], K.box[1]], [K.box[2], K.box[3]], [K.box[0], K.box[3]]].forEach(([a, b]) => { const [ra, rb] = rot(a, b, p.r); x0 = Math.min(x0, p.x + ra); x1 = Math.max(x1, p.x + ra); y0 = Math.min(y0, p.y + rb); y1 = Math.max(y1, p.y + rb); }); });
  sch.wires.forEach(w => { x0 = Math.min(x0, w.x1, w.x2); x1 = Math.max(x1, w.x1, w.x2); y0 = Math.min(y0, w.y1, w.y2); y1 = Math.max(y1, w.y1, w.y2); });
  return [x0, y0, x1, y1];
}
function renderPlan(S) {
  S = S || 48;
  const [x0, y0, x1, y1] = planBounds(), pad = 3.2;
  const W = Math.max(1500, Math.round((x1 - x0 + 2 * pad) * S)), fp = Math.round(W * 0.02), foot = Math.round(fp * 3.6);
  const H = Math.round((y1 - y0 + 2 * pad) * S) + foot;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const sv = { cx, view, sel, ghost, wireStart, cursor };
  try {
    cx = c.getContext('2d'); PRINT = true; sel = null; ghost = null; wireStart = null; cursor = null;
    view = { s: S, ox: (W - (x1 - x0) * S) / 2 - x0 * S, oy: pad * S - y0 * S };
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, W, H);
    drawCircuit();
    const F = '-apple-system,Segoe UI,Arial,sans-serif', who = userName(), left = S * 1.2;
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    cx.fillStyle = '#111'; cx.font = '700 ' + fp + 'px ' + F; cx.fillText('Stromlaufplan · ' + sch.name + (who ? ' · ' + who : ''), left, H - foot + fp * 1.2);
    cx.fillStyle = '#444'; cx.font = '500 ' + Math.round(fp * 0.85) + 'px ' + F; cx.fillText('Tonfunk ' + LABNAME + ' · ' + new Date().toLocaleDateString('de-DE'), left, H - foot + fp * 2.4);
  } finally { cx = sv.cx; view = sv.view; sel = sv.sel; ghost = sv.ghost; wireStart = sv.wireStart; cursor = sv.cursor; PRINT = false; }
  return c;
}
function bomData() {
  const g = {};
  sch.parts.forEach(p => { if (p.k === 'GND') return; const K = KINDS[p.k], key = p.k + '|' + (p.v || ''); const o = g[key] || (g[key] = { name: K.name, v: valueText(p) || (p.k === 'D' ? p.v : ''), n: 0, l: [] }); o.n++; if (p.l) o.l.push(p.l); });
  return Object.values(g).sort((a, b) => a.name.localeCompare(b.name, 'de') || a.v.localeCompare(b.v, 'de'));
}
function renderBom() {
  const rows = bomData(), W = 2100, pad = 120, F = '-apple-system,Segoe UI,Arial,sans-serif', fn = 44, lh = 58, rp = 24;
  const m = document.createElement('canvas').getContext('2d');
  const cx0 = [pad + 90, pad + 90 + 190, pad + 90 + 190 + 760, pad + 90 + 190 + 760 + 420], wr = [0, 0, 740, 400, W - pad - 110 - (pad + 90 + 190 + 760 + 420)];
  const wrap = (t, w, f) => { m.font = f; const out = []; let cur = ''; String(t).split(' ').forEach(wd => { const x = cur ? cur + ' ' + wd : wd; if (m.measureText(x).width > w && cur) { out.push(cur); cur = wd; } else cur = x; }); if (cur) out.push(cur); return out.length ? out : ['']; };
  const R = rows.map(r => { const f = '500 ' + fn + 'px ' + F, L = [wrap(r.name, wr[2], f), wrap(r.v, wr[3], f), wrap(r.l.join(', '), wr[4], f)]; return { a: r.n + '×', L, h: Math.max(...L.map(l => l.length)) * lh + rp * 2 }; });
  const head = 430, H = Math.max(2970, head + 120 + R.reduce((t, r) => t + r.h, 0) + 170);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.textBaseline = 'alphabetic';
  x.fillStyle = '#111'; x.font = '700 92px ' + F; x.fillText('Bauteilliste', pad, pad + 60);
  x.font = '600 52px ' + F; x.fillText(sch.name, pad, pad + 140);
  x.fillStyle = '#444'; x.font = '500 40px ' + F; const who = userName(); x.fillText('Stromlaufplan' + (who ? ' · ' + who : '') + ' · ' + new Date().toLocaleDateString('de-DE'), pad, pad + 205);
  let y = head; x.fillStyle = '#111'; x.font = '700 38px ' + F; ['Anz.', 'Bauteil', 'Wert', 'Bezeichnung'].forEach((t, i) => x.fillText(t, cx0[i], y)); x.fillText('OK', W - pad - 50, y); x.fillRect(pad, y + 18, W - 2 * pad, 4); y += 22;
  R.forEach((r, i) => {
    if (i % 2 === 0) { x.fillStyle = '#f3f1ea'; x.fillRect(pad, y, W - 2 * pad, r.h); }
    x.fillStyle = '#111'; x.font = '700 ' + fn + 'px ' + F; x.fillText(r.a, cx0[0], y + rp + fn); x.font = '500 ' + fn + 'px ' + F;
    r.L.forEach((ls, ci) => ls.forEach((ln, li) => x.fillText(ln, cx0[ci + 1], y + rp + fn + li * lh)));
    x.strokeStyle = '#111'; x.lineWidth = 4; x.strokeRect(W - pad - 70, y + rp + 4, 44, 44); y += r.h;
  });
  x.fillStyle = '#777'; x.font = '500 34px ' + F; x.fillText('Tonfunk ' + LABNAME, pad, H - pad + 30);
  return c;
}
function outputCanvas(c, print) {
  if (print) { $('#printImg').src = c.toDataURL('image/png'); setTimeout(() => window.print(), 150); }
  else sheet('Bild sichern', b => { b.innerHTML = '<p class="hint2">Bild gedrückt halten, dann „Zu Fotos hinzufügen“ oder „Drucken“ wählen.</p><img alt="" style="width:100%;border-radius:8px;background:#fff" src="' + c.toDataURL('image/png') + '">'; });
}
function openPrint() {
  if (!sch.parts.length) { toast('Noch nichts gezeichnet'); return; }
  sheet('Drucken', (b, close) => {
    b.innerHTML = `<button class="row" data-m="plan"><div class="grow"><b>Stromlaufplan</b><small>Schwarz auf weiß, ohne Simulationsfarben</small></div></button>
      <button class="row" data-m="bom"><div class="grow"><b>Bauteilliste</b><small>Anzahl, Wert und Bezeichnung zum Abhaken</small></div></button>`;
    b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); outputCanvas(r.dataset.m === 'plan' ? renderPlan() : renderBom(), true); });
  });
}
/* ============ Start ============ */
const simsw = document.createElement('button');
simsw.className = 'simsw'; simsw.id = 'bSim'; simsw.setAttribute('role', 'switch'); simsw.setAttribute('aria-checked', 'false'); simsw.setAttribute('aria-label', 'Simulation');
simsw.innerHTML = '<span class="lL">Zeichnen</span><span class="trk"><span class="knob"></span></span><span class="lS">Sim</span>';
$('#bUndo').before(simsw);
simsw.addEventListener('click', () => setSimMode(!simMode));
/* Zweiter Schalter in der Kopfleiste: Wasser-Ansicht (blau), erscheint nur bei eingeschalteter Simulation */
{
  const st = document.createElement('style');
  st.textContent = '.watersw .trk{position:relative;width:38px;height:22px;border-radius:11px;background:#4a5561;transition:background .15s}.watersw .knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .15s}.watersw[aria-checked=true] .trk{background:#2f8dff}.watersw[aria-checked=true] .knob{left:18px}.watersw .lL{color:#8d99a6}.watersw[aria-checked=true] .lL{color:#fff;font-weight:600}@media(max-width:560px){.watersw .lL span{display:none}}';
  document.head.appendChild(st);
  const wsw = document.createElement('button');
  wsw.className = 'simsw watersw'; wsw.id = 'bWater'; wsw.setAttribute('role', 'switch'); wsw.setAttribute('aria-checked', water ? 'true' : 'false'); wsw.setAttribute('aria-label', 'Wasser-Ansicht'); wsw.title = 'Wasser-Ansicht: Strom als Wasser, Spannung als Druck'; wsw.style.display = 'none';
  wsw.innerHTML = '<span class="lL">💧<span> Wasser</span></span><span class="trk"><span class="knob"></span></span>';
  simsw.after(wsw); if (LAB === 'haus') wsw.remove();
  wsw.addEventListener('click', () => setWater(!water));
}
$('#bRun').style.display = 'none';
$('#bShare').onclick = () => menuAct('share'); $('#bTasks').style.display = ''; $('#bTasks').onclick = openTasks; if (LAB === 'sim') { $('#bCab').style.display = ''; $('#bCab').onclick = openCabinet; const pp = $('#bPP'); if (pp) { pp.style.display = ''; pp.onclick = () => window.Pruefplatz && window.Pruefplatz.open(); } } $('#bEx').onclick = () => menuAct('ex'); $('#bOpen').onclick = () => menuAct('open'); $('#bPrint').onclick = () => menuAct('print');
$('#bRun').onclick = toggleRun; $('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bMenu').onclick = openMenu;
$('#title').onclick = () => form('Name', [{ l: 'Name der Schaltung', v: sch.name }], ([n]) => { sch.name = n.trim() || sch.name; commit(true); });
(function init() {
  let d = null; try { d = JSON.parse(localStorage.getItem((SK + 'cur')) || 'null'); } catch (e) {}
  buildPalette();
  if (/[?&]neu\b/.test(location.search)) { if (d && d.parts && (d.parts.length || (d.wires && d.wires.length))) { loadCircuit(d); confirmNew(() => loadCircuit({ name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] })); } else loadCircuit({ name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] }); }
  else if (/[?&]ex=/.test(location.search)) { const q = decodeURIComponent(location.search.match(/[?&]ex=([^&]*)/)[1]).toLowerCase(), e = EXAMPLES.find(x => exOk(x) && x.name.toLowerCase().includes(q)); if (e && e.lock) { loadCircuit(buildExample(defEx())); godGate(() => loadCircuit(buildExample(e))); } else loadCircuit(buildExample(e || defEx())); }
  else if (/[?&]aufgabe=/.test(location.search) && TASKS.some(t => t.id === location.search.match(/[?&]aufgabe=(\w*)/)[1] && (t.lab || 'sim') === LAB)) startTask(location.search.match(/[?&]aufgabe=(\w*)/)[1]);
  else if (/[?&]escape\b/.test(location.search)) openEscape();
  else if (/[?&]detektiv\b/.test(location.search)) openDetective();
  else if (/[?&]duell(&|$)/.test(location.search)) openDuel();
  else if (/[?&]bsp\b/.test(location.search)) loadCircuit(buildExample(LAB !== 'sch' ? defEx() : EXAMPLES[1]));
  else if (d && d.parts && d.parts.length) loadCircuit(d); else { loadCircuit(buildExample(LAB !== 'sch' ? defEx() : EXAMPLES[1])); }
  if (PROGLAB) { initDock(); }
loadShared();
requestAnimationFrame(t => { lastFrame = t; loop(t); });
})();
window.SchaltTest = () => {
  const keep = sch, out = [];
  EXAMPLES.forEach(e => {
    sch = buildExample(e); rebuild(); sim.reset();
    let nc = 0; for (let i = 0; i < 4000; i++) { sim.step(1e-5); if (!sim.converged) nc++; }
    out.push({ name: e.name, nn: circ.nn, nonconv: nc, burnt: [...sim.burnt], v: Array.from(sim.v).map(v => +v.toPrecision(4)), el: circ.elems.map(x => (x.part ? x.part.k : '?') + ':' + (+(x.i || 0).toPrecision(4))) });
  });
  sch = keep; rebuild(); return out;
};
window.SchaltJob = i => { const ex = buildExample(EXAMPLES[i]); loadCircuit(ex); return { name: EXAMPLES[i].name, job: buildJob() }; };
window.SchaltExamples = () => EXAMPLES.map((e, i) => [i, e.name, e.lab || '']);
window.SchaltSweep = (a, b) => EXAMPLES.filter(exOk).slice(a || 0, b == null ? 999 : b).map(e => {                          // Testhilfe: alle Beispiele des Labs simulieren
  const r = { name: e.name };
  try {
    loadCircuit(buildExample(e));
    if (LAB === 'code' || LAB === 'pi') {
      const R = LAB === 'pi' ? piEval({ T: 6 }) : codeEval({ T: 6 }); r.err = R.err ? (R.err.msg || String(R.err)) : null; r.out = String(R.out || R.ser || '').slice(0, 60);
      r.events = R.E.ev.map(x => x.text); const ls = R.samples.flatMap(sm => (sm.led || []).map(l => l[1])); r.ledMax = ls.length ? +Math.max(...ls).toFixed(1) : 0; r.tone = R.samples.some(sm => sm.tone && sm.tone.some(Boolean)); r.pins = R.samples.length && R.samples.some(sm => sm.lv && sm.lv.some(Boolean));
    } else {
      const E = simEval({}); E.run(1.5); r.events = E.ev.map(x => x.text); r.lamps = [...E.lamps().values()].filter(Boolean).length; const il = E.c.elems.filter(x => x.led).map(x => Math.abs(x.iav || x.i || 0) * 1000); r.ledMax = il.length ? +Math.max(...il).toFixed(1) : 0; r.conv = E.s.converged !== false;
      const sws = sch.parts.filter(p => { const K = KINDS[p.k]; return (K.toggle || K.momentary) && !['LAMP', 'HEAT', 'MOTOR3', 'SD', 'LSS', 'RCD'].includes(p.k); });
      if (sws.length) { const set = {}, press = []; sws.forEach(p => { if (KINDS[p.k].momentary) press.push(p.id); else set[p.id] = 1; });
        const E2 = simEval({ set, press }); E2.run(1.5); const il2 = E2.c.elems.filter(x => x.led).map(x => Math.abs(x.iav || x.i || 0) * 1000); const mot = E2.c.elems.filter(x => /MOTOR|M3/i.test(x.type || '')).map(x => Math.abs(x.i || 0));
        r.sw = sws.length; r.on = { lamps: [...E2.lamps().values()].filter(Boolean).length, ledMax: il2.length ? +Math.max(...il2).toFixed(1) : 0, motor: mot.length ? +Math.max(...mot).toFixed(2) : 0, events: E2.ev.map(x => x.text) }; }
    }
  } catch (x) { r.exc = String(x && x.message || x); }
  return r;
});
window.SchaltRun = (name, T, setAll) => {                                          // Testhilfe: ein Beispiel gezielt laufen lassen
  const e = EXAMPLES.find(x => x.name.toLowerCase().includes(name.toLowerCase())); loadCircuit(buildExample(e));
  const set = {}, press = []; if (setAll) sch.parts.forEach(p => { const K = KINDS[p.k]; if ((K.toggle || K.momentary) && !['LAMP', 'HEAT', 'MOTOR3', 'SD', 'LSS', 'RCD'].includes(p.k)) { if (K.momentary) press.push(p.id); else set[p.id] = 1; } });
  const E = simEval({ set, press }); E.run(T || 2); let nonConv = 0; for (let i = 0; i < 5000; i++) { E.s.step(2e-4); if (E.s.converged === false) nonConv++; }
  return { name: e.name, nonConv, events: E.ev.map(x => x.text), elems: E.c.elems.filter(x => x.part).map(x => [x.type, x.part.k, x.part.v, +(x.i || 0).toFixed(3), x.part.sw, x.blown ? 'DEFEKT' : '']) };
};
window.SchaltTrace = (name, T, step) => {                                          // Testhilfe: Strom der LEDs über die Zeit (Blinker prüfen)
  const e = EXAMPLES.find(x => x.name.toLowerCase().includes(name.toLowerCase())); loadCircuit(buildExample(e));
  const E = simEval({}), dt = 2e-4, out = []; const leds = E.c.elems.filter(x => x.led);
  for (let t = 0, i = 0; t < T; t += dt, i++) { E.s.step(dt); if (i % Math.round((step || 0.05) / dt) === 0) out.push(+(Math.max(0, ...leds.map(x => Math.abs(x.i || 0))) * 1000).toFixed(1)); }
  return { name: e.name, leds: leds.length, trace: out };
};
window.SchaltLive = {                                                                // Testhilfe: laufende Simulation von außen treiben und die Oszilloskope auslesen
  load: name => { const e = EXAMPLES.find(x => x.name.toLowerCase().includes(name.toLowerCase())); loadCircuit(buildExample(e)); return { parts: sch.parts.map(p => [p.id, p.k, p.l || '', p.sw || 0]), scopes: sch.scopes }; },
  set: (id, o) => { Object.assign(sch.parts.find(p => p.id === id), o); rebuild(); },
  run: (T, press, ev) => { simMode = true; rebuild(); const dt = 2e-4, n = Math.round(T / dt); for (let i = 0; i < n; i++) { sim.step(dt); if (i % (ev || 50) === 0) { sampleScopes(0); } trackInstr(); if (window.LAB_STEP) window.LAB_STEP(dt); } return sch.scopes.map((sc, k) => { const b = scopeBuf[k], m = a => a.length ? [Math.min(...a), Math.max(...a)].map(v => +v.toFixed(2)) : []; return { v: m(b.v), i: m(b.i) }; }); },
  instr: () => sch.parts.filter(p => INSTR[p.k]).map(p => [p.k, instrText(p)]),
  events: () => (sim ? sim.events.splice(0).map(e => e.text || e.kind) : []),
  pinV: (id, i) => sv(gk(...pinsOf(byPart(id))[i])),
  stepN: n => { for (let k = 0; k < n; k++) sim.step(2e-4); return sim.t; },
  csv: () => exportScopeCsv(), scopeLen: () => scopeBuf.map(b => b.t.length), route: (a, b) => routeWire(a, b), wireTo: (a, b) => wireTo(a, b), wires: () => sch.wires.map(w => [w.x1, w.y1, w.x2, w.y2]), mm: { text: () => meterText(), dial: meterDial, jack: j => { meter.jack = j; }, pt: (which, id, i) => { const q = pinsOf(byPart(id))[i]; meter[which] = { key: gk(q[0], q[1]), x: q[0], y: q[1] }; meterReset(); }, part: id => { meter.part = id; meterReset(); }, sample: n => { for (let k = 0; k < n; k++) { meterSample(0.01); } }, fuse: () => [meter.fuse, meter.fuse10], fix: () => { meter.fuse = false; meter.fuse10 = false; }, tool: t => { setTool(t); }, clear: () => { meter.a = meter.b = null; meter.part = null; } }, water: on => setWater(on), det: { cases: DET_CASES, start: startCase, report: diceJudge, dice: () => sch.dice }, done: markDone, daily: openDaily, openEscape, openDuel, duel: { solved: duelSolved, cur: dcur, set: (sd) => { if (window.Duell) window.Duell.rechnen.start(sd); }, base: dbaseDuel, fmt: fmtDuel }, esc: { steps: ESC_STEPS, code: ESC_CODE, digits: escDigits }, render: () => { try { render(); return "ok"; } catch (e) { return String(e.stack || e); } }, tl: { n: () => tl.length, idx: () => tlIdx, go: tlGo, live: tlLive, fwd: tlStepFwd, adv: n => { for (let k = 0; k < n; k++) { tlLast = 0; advance(0.05); } return tl.length; }, t: () => sim.t, v: () => Array.from(sim.v).slice(0, 6) }, vmax: () => vmax, pend: () => [[...relPend], [...pressT0], sim && sim.t],
};

/* Schnittstelle für den Trainer (trainer.js): liest den Zustand und lädt Beispiele, ohne etwas zu zerstören (die aktuelle Schaltung wird vorher gesichert) */
window.LabTrainerAPI = {
  lab: LAB,
  examples: () => EXAMPLES.filter(exOk).map(e => e.name),
  load: name => { const e = EXAMPLES.filter(exOk).find(x => x.name.toLowerCase().includes(String(name).toLowerCase())); if (!e) return false; if (sch.parts.length || sch.wires.length) { try { saveNamed(); } catch (x) {} } loadCircuit(buildExample(e)); return true; },
  simMode: () => simMode, running: () => running, prog: () => !!prog, water: () => water,
  parts: () => sch.parts.length, wires: () => sch.wires.length, code: () => sch.code || '',
  sel: () => (sel && sel.t === 'part' ? byPart(sel.id) || null : null),
  part: k => sch.parts.find(p => p.k === k) || null,
  switchState: () => { const p = sch.parts.find(q => KINDS[q.k] && KINDS[q.k].toggle); return p ? (p.sw ? 1 : 0) : -1; },
  tlLen: () => tl.length, tlIdx: () => tlIdx,
};

/* Schnittstelle für die Sprachsteuerung (voice.js) */
window.LabVoiceAPI = {
  place: k => { if (!k || !KINDS[k] || !inLab(KINDS[k])) return false; if (simMode) { toast('Zum Setzen erst oben auf „Zeichnen“ umschalten'); return 'sim'; } setTool('place', k); toast(KINDS[k].name + ': Tippe auf die Fläche zum Absetzen'); return KINDS[k].name; },
  setValue: v => { const p = sel && sel.t === 'part' && byPart(sel.id); if (!p || !(KINDS[p.k].props || []).some(q => q[0] === 'v')) return false; p.v = v; commit(true, true); rebuildKeep(); refreshUI(); draw(); return true; },
  toggleWater: () => { if (!simMode) { toast('Die Wasser-Ansicht gibt es in der Simulation'); return water; } setWater(!water); return water; },
  tlBack: () => { if (!simMode || !tl.length) return false; tlGo((tlIdx >= 0 ? tlIdx : tl.length - 1) - 1); return true; },
  tlFwd: () => { if (!simMode || !tl.length) return false; tlStepFwd(); return true; },
  speakSel: () => { const p = sel && sel.t === 'part' && byPart(sel.id); if (!p) return false; speakPart(p); return true; },
  fit: () => { fit(); return true; },
  menu: id => { if (LAB !== 'sch') return false; menuAct(id); return true; },
};
window.LabUI = { sheet, esc, toast, userName, LAB };
window.LabKeysAdapter = {                                                           // Tastenkürzel (keys.js)
  lab: LAB, sheet, esc, toast, has: k => !!KINDS[k] && inLab(KINDS[k]),
  part: k => { placeRot = 0; setTool('place', k); }, tool: t => setTool(t), rotate: () => rotSel(1), rotateKey: 'Tab', dup: () => dupSel(), fit: () => fit(),
  search: () => { const q = $('#pq'); if (q) q.focus(); }, sim: () => { const s = $('#bSim'); if (s) s.click(); }, busy: () => simMode,
};                                    // kleine Schnittstelle für Zusatzmodule (Prüfplatz)
window.SchaltPECheck = () => EXAMPLES.filter(exOk).map(e => {                      // Testhilfe: PE-Anschluss in allen Beispielen prüfen
  loadCircuit(buildExample(e));
  const OFF = { LAMP: 2, HEAT: 2, MOTOR3: 3 }, devs = sch.parts.filter(p => OFF[p.k] != null && (p.k !== 'LAMP' || /230\s*V/i.test(String(p.v || '')))), src = sch.parts.find(p => p.k === 'NETZ' || p.k === 'NETZ3');
  if (!devs.length || !src) return null;
  const E = simEval({}); E.run(0.4); const nd = i => E.c.nodeOfKey(gk(...pinsOf(src)[i])), pe = nd(src.k === 'NETZ' ? 2 : 4), act = (src.k === 'NETZ' ? [0, 1] : [0, 1, 2, 3]).map(nd);
  const bad = devs.filter(p => { const q = pinsOf(p)[OFF[p.k]]; if (E.c.nodeOfKey(gk(q[0], q[1])) === pe) return false; if (!sch.parts.some(c => c.k === 'CABLE')) return true; try { return !(window.SchaltInstr.staticR(q, pinsOf(src)[src.k === 'NETZ' ? 2 : 4], 1, 'ohm') < 5); } catch (e) { return true; } });
  return { name: e.name, devs: devs.length, notOnPE: bad.map(nm), peShortedToL: act.includes(pe), warn: (E.c.warnings || []).map(w => w.text).filter(t => /Schutzleiter/.test(t)), events: E.s.events.map(x => x.text || x.kind) };
}).filter(Boolean);
/* ============ Verbund-Hook (Paket A1, Verbundprojekte, SPEC 5.3): window.LabVerbund ============
   Schnittstelle für verbundad-eng.js (gilt für sch, sim, digi, mess, haus, code, pi). Rein additiv: Lesen (snap, netlist, simMeas, proto, code, haus) ändert nichts;
   load sichert die Arbeit vorher (saveNamed) und ersetzt dann den Plan (auch eine offene Aufgabe); setCode beendet eine offene Aufgabe (vorher gesichert), load und setHaus ersetzen sie; setPart und setProto sind im Aufgaben-Prüfmodus (sch.task) gesperrt.
   Alles in try/catch: bei Fehler null bzw. false. Bezeichnung (ref) = Beschriftung p.l, sonst Vorsilbe + Nummer (wie assignLabels), eindeutig, ohne Leerzeichen und Punkt. */
window.LabVerbund = (() => {
  const nlib = () => (window.Verbund && window.Verbund.nl) || window.VerbundNL || null;
  const locked = () => !!(sch && sch.task);
  const copy = o => JSON.parse(JSON.stringify(o));
  const natCmp = (a, b) => { const ma = /^(\D*)(\d*)(.*)$/.exec(String(a)), mb = /^(\D*)(\d*)(.*)$/.exec(String(b)); if (ma[1] !== mb[1]) return ma[1] < mb[1] ? -1 : 1; const na = ma[2] === '' ? -1 : +ma[2], nb = mb[2] === '' ? -1 : +mb[2]; if (na !== nb) return na < nb ? -1 : 1; return ma[3] < mb[3] ? -1 : ma[3] > mb[3] ? 1 : 0; };
  function refs() {                                   // Teil-ID -> Bezeichnung
    const m = new Map(), used = new Set(), todo = [];
    sch.parts.forEach(p => { if (p.k === 'GND') return; const l = String(p.l == null ? '' : p.l).trim().replace(/[\s.]+/g, '_'); if (l && !used.has(l)) { used.add(l); m.set(p.id, l); } else todo.push(p); });
    todo.forEach(p => { const pre = PRE[p.k] || p.k; let n = 1; while (used.has(pre + n)) n++; used.add(pre + n); m.set(p.id, pre + n); });
    return m;
  }
  const partByRef = ref => { let hit = null; refs().forEach((r, id) => { if (r === ref) hit = byPart(id); }); return hit; };
  /* Anschlussnamen des Teils (Verbund.nl.pinNames) oder null, wenn die Netzlisten-Bibliothek fehlt */
  function namesOf(p) { const L = nlib(); if (!L || !L.pinNames) return null; const n = KD(p).pins.length; return L.pinNames(p.k, { value: p.v, props: p.k === 'ICX' || p.k === 'CPU' ? { n } : undefined }); }
  function pinIndex(p, pin) {                         // Zahl = Nummer ab 0, Text = Anschlussname wie in der Netzliste
    const n = KD(p).pins.length; if (typeof pin === 'number') return pin >= 0 && pin < n ? pin : -1;
    const names = namesOf(p), s = String(pin);
    if (names) { let i = names.indexOf(s); if (i < 0) i = names.findIndex(x => x.toLowerCase() === s.toLowerCase()); return i >= 0 && i < n ? i : -1; }
    return /^\d+$/.test(s) && +s >= 1 && +s <= n ? +s - 1 : -1;
  }
  function topo() {                                   // Verbindungen wie im Rechenkern: Drähte, Masse-Symbole, Masse-Pins von Uno und Pi
    const par = new Map(), find = k => { if (!par.has(k)) par.set(k, k); let r = k; while (par.get(r) !== r) r = par.get(r); par.set(k, r); return r; }, uni = (a, b) => par.set(find(a), find(b)), wired = new Set();
    sch.wires.forEach(w => { const a = gk(w.x1, w.y1), b = gk(w.x2, w.y2); wired.add(a); wired.add(b); uni(a, b); });
    let g0 = null; const gnd = k => { find(k); wired.add(k); if (g0 !== null) uni(g0, k); else g0 = k; };
    sch.parts.forEach(p => { if (p.k === 'GND') gnd(gk(...pinsOf(p)[0])); });
    sch.parts.forEach(p => { if (p.k === 'PI' || p.k === 'UNO') { const pw = pinsOf(p); (p.k === 'PI' ? [5, 8, 13, 19, 24, 29, 33, 38] : [3, 24]).forEach(si => gnd(gk(...pw[si]))); } });
    return { find, wired, g0 };
  }
  /* Rohe Netzliste: Anschlussnamen aus names(p) (null: '1'..'n'); nicht angeschlossene Anschlüsse fehlen (offen) */
  function rawNet(names) {
    const T = topo(), R = refs(), ps = sch.parts.filter(p => p.k !== 'GND').map(p => ({ p, ref: R.get(p.id) })).sort((a, b) => natCmp(a.ref, b.ref)), cnt = new Map();
    const key = (p, i) => { const q = pinsOf(p)[i]; return gk(q[0], q[1]); };
    ps.forEach(({ p }) => pinsOf(p).forEach((q, i) => { const r = T.find(key(p, i)); cnt.set(r, (cnt.get(r) || 0) + 1); }));
    const conn = (p, i) => T.wired.has(key(p, i)) || cnt.get(T.find(key(p, i))) > 1;
    const nm = new Map(), gr = T.g0 !== null ? T.find(T.g0) : null; if (gr !== null) nm.set(gr, 'GND');
    const sup = []; ps.forEach(({ p }) => { if (p.k === 'BAT' && conn(p, 0)) { const r = T.find(key(p, 0)); if (r !== gr && !sup.includes(r)) sup.push(r); } });
    sup.forEach((r, i) => nm.set(r, sup.length === 1 ? 'VCC' : 'V' + (i + 1)));
    let nn = 0; const nameOf = r => { if (!nm.has(r)) nm.set(r, 'N' + (++nn)); return nm.get(r); }, nets = new Map();
    const parts = ps.map(({ p, ref }) => {
      const K = KD(p), pn = (names && names(p)) || KD(p).pins.map((_, i) => String(i + 1)), pins = {}, props = {};
      pinsOf(p).forEach((_, i) => { if (!conn(p, i) || i >= pn.length) return; const net = nameOf(T.find(key(p, i))); pins[pn[i]] = net; if (!nets.has(net)) nets.set(net, []); nets.get(net).push(ref + '.' + pn[i]); });
      if (KINDS[p.k].toggle) props.sw = p.sw ? 1 : 0; if (KINDS[p.k].momentary) props.pressed = !!p.pressed; if (KINDS[p.k].pos && p.pos != null) props.pos = p.pos;
      if (p.vr != null && p.vr !== KINDS[p.k].vr) props.vr = p.vr; if (p.k === 'ICX' || p.k === 'CPU') props.n = K.pins.length;
      const o = { ref, kind: p.k, value: String(p.v == null ? '' : p.v), pins }; if (Object.keys(props).length) o.props = props; return o;
    });
    return { v: 1, name: sch.name, parts, nets: [...nets.keys()].map(name => ({ name, pins: nets.get(name) })) };
  }
  function netlist() {
    const L = nlib(); if (!L || !L.normalize) return null;
    const raw = rawNet(namesOf), r = L.normalize(raw);
    if (r.ok) return r.nl;
    const r2 = L.normalize(raw, { lenient: true }); return r2.ok ? r2.nl : null;
  }
  function simMeas(specs, T) {
    T = T > 0 ? +T : 0.3;
    const E = simEval({}); E.run(T);
    const J = new Map(), byRef = new Map(), out = {};
    E.c.elems.forEach(e => { const w = e.part && e.part.item; if (!w) return; const K = KINDS[w.k], I = termI(e); e.pi.forEach((ci, j) => { const k = w.id + ':' + (K.map ? K.map[ci] : ci); J.set(k, (J.get(k) || 0) + (I[j] || 0)); }); });
    refs().forEach((r, id) => byRef.set(r, byPart(id)));
    const vAt = (p, i) => { const q = pinsOf(p)[i], n = E.c.nodeOfKey(gk(q[0], q[1])); return n < 0 ? NaN : E.s.v[n]; };
    (Array.isArray(specs) ? specs : []).forEach(sp => {
      try {
        let ref = sp.ref, a = sp.pin; const m = typeof ref === 'string' && !byRef.has(ref) && /^(.*)\.([^.]+)$/.exec(ref);
        if (m && byRef.has(m[1])) { ref = m[1]; if (a === undefined) a = m[2]; }                    // 'R1.2' als Kurzform
        const p = byRef.get(ref); if (!p) return;
        let v = NaN;
        if (sp.kind === 'vdiff') { const pr = sp.pins || [0, 1], i = pinIndex(p, pr[0]), j = pinIndex(p, pr[1]); v = i < 0 || j < 0 ? NaN : vAt(p, i) - vAt(p, j); }
        else { const i = pinIndex(p, a === undefined ? 0 : a); v = i < 0 ? NaN : (sp.kind === 'i' ? (J.get(p.id + ':' + i) || 0) : vAt(p, i)); }
        if (isFinite(v)) out[String(sp.label)] = v;
      } catch (e) {}
    });
    return out;
  }
  function endTask() { if (!sch.task) return; try { saveNamed(); } catch (e) {} sch.task = undefined; taskRes = null; commit(true, true); refreshUI(); }      // wie „Aufgabe beenden“ (tstop), vorher gesichert
  const W = fn => (...a) => { try { return fn(...a); } catch (e) { return false; } };      // schreibende Hooks: bei Fehler false
  const api = {
    lab: LAB,
    ready: () => !!sch && Array.isArray(sch.parts),
    canWrite: () => !locked(),
    snap: () => { try { return JSON.parse(snap()); } catch (e) { return null; } },
    load: W((d, name) => {
      if (!d || typeof d !== 'object') return false;
      if (sch.parts.length || sch.wires.length) { try { saveNamed(); } catch (e) {} }
      const c = copy(d); delete c.sid; if (name) c.name = String(name);
      loadCircuit(c); return true;
    }),
    netlist: () => { try { return netlist(); } catch (e) { return null; } },
    rawNetlist: () => { try { return rawNet(null); } catch (e) { return null; } },
    parts: () => { try { const R = refs(); return sch.parts.filter(p => p.k !== 'GND').map(p => ({ ref: R.get(p.id), id: p.id, kind: p.k, value: String(p.v == null ? '' : p.v) })); } catch (e) { return null; } },
    simMeas: (specs, T) => { try { return simMeas(specs, T); } catch (e) { return null; } },
    setPart: W((ref, props) => {
      if (locked() || !props || typeof props !== 'object') return false;
      const p = partByRef(ref); if (!p) return false;
      ['v', 'sw', 'pos', 'pressed', 'vr', 'imax', 'defect'].forEach(k => { if (props[k] !== undefined) p[k] = (k === 'sw' ? (props[k] ? 1 : 0) : k === 'pressed' ? !!props[k] : props[k]); });
      if (props.l !== undefined) p.l = String(props.l).trim().replace(/[\s.]+/g, '_');
      commit(false); return true;
    }),
    proto: () => { try { return protoLoad().rows.map(r => Object.assign({}, r)); } catch (e) { return null; } },
    protoTol: () => { try { return protoLoad().tol; } catch (e) { return null; } },
    setProto: W((rows, tol) => {
      if (locked() || !Array.isArray(rows)) return false;
      const s = x => String(x == null ? '' : x);
      protoSave({ tol: tol > 0 ? +tol : protoLoad().tol, rows: rows.map(r => ({ w: s(r.w), u: s(r.u || 'V'), s: s(r.s), i: s(r.i) })) }); return true;
    }),
    code: () => { try { return sch.code || ''; } catch (e) { return null; } },
    setCode: W(src => {
      if (!PROGLAB) return false;
      endTask();                                    // eine offene Aufgabe wird beendet (Arbeit vorher gesichert), sonst bliebe die Station im Prüfmodus unlösbar
      sch.code = String(src == null ? '' : src); syncCode(); try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {} return true;
    }),
    haus: () => { try { return sch.haus ? copy(sch.haus) : null; } catch (e) { return null; } },
    setHaus: W((model, name) => {
      if (LAB !== 'haus' || !model || typeof model !== 'object') return false;
      if (sch.parts.length || sch.wires.length || sch.haus) { try { saveNamed(); } catch (e) {} }
      loadCircuit({ name: name ? String(name) : (model.name || sch.name), parts: [], wires: [], nid: 1, scopes: [], haus: copy(model) }); return true;
    })
  };
  return api;
})();
window.SchaltDebug = () => ({ prog: prog && { err: prog.err, t: prog.runner.t }, serLog, view, sl: sliderHits, running, t: sim && sim.t, N: circ && circ.nn, flows: [...flows.entries()], imax, vmax, elems: circ && circ.elems.map(e => ({ t: e.type, part: e.part && e.part.k, i: e.i })) , sch });
})();
