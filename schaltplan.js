/* Tonfunk SchaltLab - Stromlaufplan zeichnen und simulieren (Spannungsfarben, Stromweg, Graphen) */
(function () {
'use strict';
const LS = window.LochSim;
const LAB = window.LAB === 'sim' ? 'sim' : 'sch', LABNAME = LAB === 'sim' ? 'SimLab' : 'SchaltLab', SK = LAB === 'sim' ? 'sim.' : 'sch.';
const inLab = K => !K.lab || K.lab === LAB;
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
  LAMP:{ name: 'Glühlampe',       cat: 'Passiv', pins: T2, v: '6V 0.1A', core: 'LAMP', box: [0, -1, 4, 1], props: [['v', 'Nenndaten', 'text', 'z. B. 6V 0.1A']] },
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
  FUSE:{ name: 'Sicherung',   cat: 'Passiv', pins: T2, v: '250mA', core: 'FUSE', box: [0, -0.6, 4, 0.6], props: [['v', 'Nennstrom', 'text', 'z. B. 250mA']] },
  NTC: { name: 'NTC (Heißleiter)', cat: 'Passiv', pins: T2, v: '10k', core: 'NTC', box: [0, -1.3, 4, 1.3], pos: true, pos0: 0.32, props: [['v', 'Widerstand bei 25 °C', 'text', 'z. B. 10k'], ['pos', 'Temperatur (-20 … 120 °C)', 'range']] },
  PTC: { name: 'PTC (Kaltleiter)', cat: 'Passiv', pins: T2, v: '100', core: 'PTC', box: [0, -1.3, 4, 1.3], pos: true, pos0: 0.32, props: [['v', 'Widerstand bei 25 °C', 'text', 'z. B. 100'], ['pos', 'Temperatur (-20 … 120 °C)', 'range']] },
  MOTOR:{ name: 'Gleichstrommotor', cat: 'Passiv', pins: T2, v: '6V', core: 'MOTOR', box: [0, -1.2, 4, 1.2], pos: true, pos0: 0, props: [['v', 'Nennspannung', 'text', 'z. B. 6V'], ['pos', 'Bremse / Last', 'range']] },
  SPK: { name: 'Lautsprecher', cat: 'Passiv', pins: T2, v: '8', core: 'SPK', box: [0, -1.1, 4, 1.1], props: [['v', 'Impedanz (Ω)', 'text', 'z. B. 8']] },
  TRF: { name: 'Transformator', cat: 'Passiv', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: '230V:12V', core: 'TRF', box: [0, -0.4, 6, 4.4], props: [['v', 'Übersetzung', 'text', 'z. B. 230V:12V']] },
  RLY: { name: 'Relais', cat: 'Schalter', pins: [[0, 0], [0, 4], [5, 2], [8, 0], [8, 4]], v: '12V', core: 'RLY', box: [0, -0.4, 8, 4.4], props: [['v', 'Spulenspannung', 'text', 'z. B. 12V']] },
  THY: { name: 'Thyristor', cat: 'Halbleiter', pins: [[0, 0], [4, 0], [3, 2]], v: 'TIC106', core: 'THY', box: [0, -1, 4, 2.2], props: [] },
  PHT: { name: 'Fototransistor', cat: 'Halbleiter', pins: [[2, -2], [2, 2]], v: '', core: 'PHT', box: [-1, -2.2, 2.6, 2.2], pos: true, props: [['pos', 'Helligkeit', 'range']] },
  OPTO:{ name: 'Optokoppler', cat: 'Halbleiter', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: 'PC817', core: 'OPTO', box: [0, -0.4, 6, 4.4], props: [] },
  NETZ:{ name: 'Netz 230 V (L, N, PE)', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [2, 0], [4, 0]], v: '230V', core: 'NETZ', vr: 'ac', box: [-1, -3, 5, 0.3], props: [['v', 'Spannung', 'text', 'z. B. 230V'], ['vr', 'Darstellung', 'select', ['dc', 'ac'], { dc: 'Effektivwert (ruhig)', ac: 'Wechselspannung 50 Hz' }]] },
  LSS: { name: 'Sicherungsautomat', cat: 'Netz & Schutz', lab: 'sim', pins: T2, v: 'B16', core: 'LSS', box: [0, -1.3, 4, 1.1], toggle: true, sw0: 1, props: [['v', 'Typ und Nennstrom', 'text', 'z. B. B16 oder C10']] },
  RCD: { name: 'FI-Schutzschalter', cat: 'Netz & Schutz', lab: 'sim', pins: [[0, 0], [2, 0], [0, 4], [2, 4]], v: '30mA', core: 'RCD', box: [-0.6, -0.2, 2.6, 4.2], toggle: true, sw0: 1, props: [] },
  KREUZ:{ name: 'Kreuzschalter', cat: 'Schalter', lab: 'sim', pins: [[0, 0], [2, 0], [0, 4], [2, 4]], v: '', core: 'KREUZ', box: [-0.6, -0.2, 2.6, 4.2], toggle: true, props: [] },
  IMP: { name: 'Stromstoßschalter', cat: 'Schalter', lab: 'sim', pins: [[0, 0], [0, 4], [6, 0], [6, 4]], v: '230V', core: 'IMP', box: [0, -0.4, 6, 4.4], props: [['v', 'Spulenspannung', 'text', 'z. B. 230V']] },
  HEAT:{ name: 'Heizlüfter', cat: 'Verbraucher', lab: 'sim', pins: T2, v: '230V 2000W', core: 'LAMP', box: [0, -1.1, 4, 1.1], props: [['v', 'Spannung und Leistung', 'text', 'z. B. 230V 2000W']] },
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
};
const CATS = LAB === 'sim' ? ['Netz & Schutz', 'Schalter', 'Verbraucher', 'Quellen', 'Passiv', 'Halbleiter', 'Logik', 'Messen'] : ['Quellen', 'Passiv', 'Halbleiter', 'Schalter', 'Logik', 'Messen'];
const kindsOf = cat => Object.keys(KINDS).filter(k => KINDS[k].cat === cat && inLab(KINDS[k]));
const rot = (x, y, r) => { switch (r & 3) { case 0: return [x, y]; case 1: return [-y, x]; case 2: return [-x, -y]; default: return [y, -x]; } };
const KD = p => { const K = KINDS[p.k]; return K.dyn ? Object.assign({}, K, K.dyn(p)) : K; };
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

const PRE = { JUN5: 'X', FAULT: 'Z', NETZ: 'N', LSS: 'F', RCD: 'FI', KREUZ: 'S', IMP: 'K', HEAT: 'E', SD: 'X', FUSE: 'F', NTC: 'R', PTC: 'R', MOTOR: 'M', SPK: 'LS', TRF: 'TR', RLY: 'K', THY: 'V', PHT: 'T', OPTO: 'OK', AND: 'G', NAND: 'G', OR: 'G', NOR: 'G', XOR: 'G', NOT: 'G', SNOT: 'G', DFF: 'FF', OPA: 'OP', ICX: 'IC', R: 'R', POT: 'P', C: 'C', CE: 'C', L: 'L', LDR: 'R', LAMP: 'E', D: 'D', ZD: 'D', LED: 'LED', NPN: 'T', PNP: 'T', BAT: 'V', AC: 'G', SPST: 'S', PB: 'S', SPDT: 'S', VM: 'VM', AM: 'AM' };
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
let ghost = null, wireStart = null, cursor = null, act = null, dirtyDraw = true;
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
const snap = () => JSON.stringify({ name: sch.name, parts: sch.parts, wires: sch.wires, nid: sch.nid, scopes: sch.scopes });
function commit(noRebuild, noUI) {
  hist = hist.slice(0, hi + 1); hist.push(snap()); if (hist.length > 100) hist.shift(); hi = hist.length - 1;
  try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {}
  if (!noRebuild) rebuild();
  if (!noUI) refreshUI();
  draw();
}
function restore(i) { const s = JSON.parse(hist[i]); Object.assign(sch, s); hi = i; sel = null; rebuild(); refreshUI(); draw(); try { localStorage.setItem((SK + 'cur'), hist[i]); } catch (e) {} }
const undo = () => { if (hi > 0) restore(hi - 1); };
const redo = () => { if (hi < hist.length - 1) restore(hi + 1); };

/* ============ Simulation aufbauen ============ */
function toCore(p) {
  const K = KINDS[p.k];
  let pins = pinsOf(p); if (K.map) pins = K.map.map(i => pins[i]);
  return { id: p.id, k: K.core, vr: p.vr != null ? p.vr : K.vr, v: p.v, n: p.n || 2, pins, sw: p.sw ? 1 : 0, pos: p.pos == null ? 0.5 : p.pos, light: p.pos == null ? 0.5 : p.pos, pressed: !!p.pressed, rint: 0.01, item: p };
}
function rebuild() {
  const old = circ && sim ? { elems: circ.elems, t: sim.t } : null;
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
  scopeBuf = sch.scopes.map(() => ({ t: [], v: [], i: [] }));
  flows.clear();
}
const sv = key => { const n = circ ? circ.nodeOfKey(key) : -1; return n < 0 || !sim ? NaN : sim.v[n]; };
const hasGround = () => sch.parts.some(p => p.k === 'GND' || p.k === 'NETZ');

/* ============ Rechenschritte ============ */
function dtFor(rate) {            // Zeitschritt aus dem gewünschten Tempo (simulierte Sekunden je echte Sekunde)
  const perFrame = rate / 60, steps = clamp(Math.round(perFrame / 5e-6), 20, 400);
  return Math.max(perFrame / steps, 1e-9);
}
const rateOf = s => Math.pow(10, -6 + 8 * s);     // Regler 0..1 -> 1 µs/s ... 100 s/s
const LEDRGB = { rot: '255,59,47', 'grün': '47,224,90', gelb: '255,224,51', blau: '61,139,255', 'weiß': '255,255,255', orange: '255,154,47' };
function partCenter(p) { const K = KD(p), [a, b] = rot((K.box[0] + K.box[2]) / 2, (K.box[1] + K.box[3]) / 2, p.r); return [X(p.x + a), Y(p.y + b)]; }
function onBurn(ev) {
  const p = ev.part && ev.part.item; if (!p) return;
  toast(ev.text);
  if (!window.LochFX) return;
  if (ev.kind === 'trip') { const [tx, ty] = partCenter(p); LochFX.trip(tx, ty, p.k === 'RCD' ? 'FI! KLACK!' : 'KLACK!', view.s); draw(); refreshUI(); return; }
  const [x, y] = partCenter(p), led = p.k === 'LED';
  const TXT = { FUSE: 'ZACK!', MOTOR: 'BRRRZ!', LAMP: 'KLIRR!', SPK: 'KRAWUMM!' };
  LochFX.explode(x, y, { text: TXT[p.k], kind: led ? 'led' : (p.k === 'R' || p.k === 'POT' || p.k === 'FUSE' || p.k === 'LAMP' ? 'res' : (['NPN', 'PNP', 'THY', 'OPTO', 'ICX', 'AND', 'NAND', 'OR', 'NOR', 'XOR', 'NOT', 'SNOT', 'DFF', 'OPA'].includes(p.k) ? 'chip' : 'big')), color: led ? (LEDRGB[p.v] || '255,59,47') : '255,170,60', scale: view.s, at: () => partCenter(p) });
}
function advance(realDt) {
  if (!sim || circ.nn === 0) return;
  const target = rateOf(tempo) * realDt, dt = dtFor(rateOf(tempo));
  const n = Math.max(1, Math.round(target / dt)), t0 = performance.now();
  const every = graphWin / 400;
  for (let i = 0; i < n; i++) {
    sim.step(dt);
    sampleScopes(every);
    if ((i & 15) === 15 && performance.now() - t0 > 11) break;
  }
  while (sim.events.length) onBurn(sim.events.shift());
  computeFlows();
}
function termI(e) {
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
  let vm = 1e-3; for (let i = 1; i <= sim.N; i++) vm = Math.max(vm, Math.abs(sim.v[i])); vmax = vm;
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
    const lim = sim.t - graphWin * 1.05;
    while (b.t.length > 2 && b.t[0] < lim) { b.t.shift(); b.v.shift(); b.i.shift(); }
  });
}

/* ============ Zeichnen ============ */
const cv = $('#cv');
let cx = cv.getContext('2d');
let PRINT = false;
let dpr = 1;
function resize() { const r = cv.getBoundingClientRect(); dpr = window.devicePixelRatio || 1; cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); draw(); }
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
  c.fillStyle = '#ffe14d';
  for (let d = off; d <= L; d += sp) {
    let acc = 0, i = 0; while (i < seg.length - 1 && acc + seg[i] < d) { acc += seg[i]; i++; }
    const u = seg[i] ? (d - acc) / seg[i] : 0;
    const x = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, y = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u;
    c.beginPath(); c.arc(x, y, 0.13, 0, 7); c.fill();
  }
}
const phase = new Map();
function ph(id) { if (!phase.has(id)) phase.set(id, { v: 0 }); return phase.get(id); }
function stepPhases(realDt) {
  const sp = dotSpeed * 7;
  flows.forEach((f, id) => { if (Math.abs(f) >= 1e-6) ph('w' + id).v += (f / imax) * sp * realDt; });
  bodyI.forEach((o, id) => { if (Math.abs(o.I || 0) >= 1e-6) ph('b' + id).v += ((o.I || 0) / imax) * sp * realDt; });
}

function drawPart(p, selected) {
  const K = KD(p), S = view.s, c = cx, pins = pinsOf(p);
  c.save(); c.translate(X(p.x), Y(p.y)); c.rotate(p.r * Math.PI / 2); c.scale(S, S);
  c.lineCap = 'round'; c.lineJoin = 'round';
  const pc = pins.map(q => keyV(gk(q[0], q[1])));
  const body = PRINT ? '#111' : '#e8eaed';
  const lead = (x0, y0, x1, y1, col) => { c.strokeStyle = col; c.lineWidth = 0.13; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  c.strokeStyle = body; c.fillStyle = body; c.lineWidth = 0.11;
  const line = (x0, y0, x1, y1) => { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
  const circle = (x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke(); };
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
    case 'OPA': {
      lead(0, 0, 1, 0, pc[1]); lead(0, 2, 1, 2, pc[0]); lead(3.4, 1, 4, 1, pc[2]); lead(2, -2, 2, -.2, pc[3]); lead(2, 4, 2, 2.2, pc[4]);
      c.beginPath(); c.moveTo(1, -1); c.lineTo(1, 3); c.lineTo(3.4, 1); c.closePath(); c.stroke();
      c.save(); c.fillStyle = body; c.font = '600 .9px sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
      [['−', 1.45, 0], ['+', 1.45, 2]].forEach(([t, x, y]) => { c.save(); c.translate(x, y); c.rotate(-p.r * Math.PI / 2); c.fillText(t, 0, 0); c.restore(); });
      c.restore(); break; }
    case 'ICX': {
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
      lead(0, 0, 0.8, 0, pc[0]); lead(3.2, 0, 4, 0, pc[1]); c.strokeRect(0.8, -0.8, 2.4, 1.6);
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
      lead(0, 0, 1.1, 0, pc[0]); lead(2.9, 0, 4, 0, pc[1]); circle(2, 0, 0.9); line(1.36, -0.64, 2.64, 0.64); line(2.64, -0.64, 1.36, 0.64); break; }
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
      if (p.k === 'LED') { b = Math.pow(clamp(o.e.i / 0.02, 0, 1), 0.6); hex = { rot: '#ff3b2f', 'grün': '#2fe05a', gelb: '#ffe033', blau: '#3d8bff', 'weiß': '#ffffff', orange: '#ff9a2f' }[p.v] || '#ff3b2f'; if (sim.burnt.has(p.id)) b = 0; }
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
  const [mx, my] = p.k === 'ICX' ? rot(3, 0, p.r) : rot(K.pins.length > 1 ? 2 : 0, 0, p.r);
  const lx = X(p.x + mx), ly = Y(p.y + my);
  c.fillStyle = PRINT ? '#111' : '#cfd5db'; c.font = `${Math.max(10, S * 0.62)}px -apple-system,Segoe UI,sans-serif`; c.textBaseline = 'middle';
  let txt = valueText(p);
  if (p.k === 'VM' && showSim()) txt = fmt(sv(gk(...pins[0])) - sv(gk(...pins[1])), 'V');
  if (p.k === 'AM' && showSim()) { const o = [...bodyI.entries()].find(([k]) => k === String(p.id)); txt = o ? fmt(o[1].e.i, 'A') : ''; }
  if (p.l && p.k !== 'GND') txt = p.l + (txt ? '  ' + txt : '');
  if (txt) {
    const vert = (p.r & 1) === 1;
    c.textAlign = vert ? 'left' : 'center';
    c.lineJoin = 'round'; c.lineWidth = 4; c.strokeStyle = PRINT ? '#fff' : '#080b0e';
    const _ft = c.fillText.bind(c); const fillText = (t, x, y) => { c.strokeText(t, x, y); _ft(t, x, y); };
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
    case 'L': return fmtVal(p.v, 'H');
    case 'FUSE': return fmtVal(p.v, 'A');
    case 'MOTOR': return fmtVal(p.v, 'V');
    case 'SPK': return fmtVal(p.v, 'Ω');
    case 'NTC': case 'PTC': return fmtVal(p.v, 'Ω');
    case 'TRF': case 'RLY': return p.v;
    case 'NETZ': case 'JUN5': return '';
    case 'FAULT': return p.sw ? 'Fehler aktiv' : 'Fehler aus';
    case 'LSS': case 'RCD': case 'IMP': return p.v;
    case 'SD': return p.v ? (p.sw ? p.v + ' (defekt)' : p.v) : 'leer';
    case 'HEAT': return p.v;
    case 'BAT': return fmtVal(p.v, 'V') + (p.imax ? '  ≤ ' + fmtVal(p.imax, 'A') : '');
    case 'ZD': return fmtVal(p.v, 'V');
    case 'AC': return p.v;
    case 'LED': case 'LAMP': return p.v;
    case 'NPN': case 'PNP': return p.v;
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
function drawCircuit() {
  // Drähte
  const ends = new Map(); const cnt = k => ends.set(k, (ends.get(k) || 0) + 1);
  sch.parts.forEach(p => pinsOf(p).forEach(q => cnt(gk(q[0], q[1]))));
  sch.wires.forEach(w => { cnt(gk(w.x1, w.y1)); cnt(gk(w.x2, w.y2)); });
  sch.wires.forEach(w => {
    const col = keyV(gk(w.x1, w.y1)), isSel = sel && sel.t === 'wire' && sel.id === w.id;
    cx.lineCap = 'round';
    if (isSel) { cx.strokeStyle = 'rgba(59,158,255,.6)'; cx.lineWidth = 9; cx.beginPath(); cx.moveTo(X(w.x1), Y(w.y1)); cx.lineTo(X(w.x2), Y(w.y2)); cx.stroke(); }
    if (LAB === 'sim' && w.c && WIRECOL[w.c]) {
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
  ends.forEach((n, k) => { if (n >= 3) { const [x, y] = k.split(',').map(Number); cx.fillStyle = keyV(k); cx.beginPath(); cx.arc(X(x), Y(y), Math.max(3.5, view.s * 0.18), 0, 7); cx.fill(); } });
  sch.parts.forEach(p => drawPart(p, sel && sel.t === 'part' && sel.id === p.id));
  sliderHits = [];
  if (simMode && !PRINT) sch.parts.forEach(p => {
    const K = KD(p); if (!K.pos) return;
    let y1 = -1e9, xc = 0, n = 0;
    [[K.box[0], K.box[1]], [K.box[2], K.box[1]], [K.box[2], K.box[3]], [K.box[0], K.box[3]]].forEach(([a, b]) => { const [ra, rb] = rot(a, b, p.r); y1 = Math.max(y1, p.y + rb); xc += p.x + ra; n++; });
    const w = Math.max(104, view.s * 3.8), r = drawPill(cx, X(xc / n), Y(y1) + 20, w, clamp(p.pos == null ? (K.pos0 != null ? K.pos0 : 0.5) : p.pos, 0, 1), p.k === 'MOTOR' ? 'Bremse' : (p.k === 'NTC' || p.k === 'PTC' ? 'Temp.' : (p.k === 'POT' ? 'Poti' : 'Licht')));
    sliderHits.push(Object.assign({ id: p.id }, r));
  });
}
function render() {
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = cv.width / dpr, H = cv.height / dpr;
  cx.fillStyle = '#080b0e'; cx.fillRect(0, 0, W, H);
  // Raster
  if (view.s >= 10) {
    cx.fillStyle = 'rgba(255,255,255,.13)';
    const x0 = Math.floor(-view.ox / view.s), x1 = Math.ceil((W - view.ox) / view.s), y0 = Math.floor(-view.oy / view.s), y1 = Math.ceil((H - view.oy) / view.s);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cx.fillRect(X(x) - 1, Y(y) - 1, 2, 2);
  }
  drawCircuit();
  // Vorschau
  if (ghost && tool === 'place' && placeKind) {
    cx.globalAlpha = 0.6; drawPart({ id: -1, k: placeKind, x: ghost[0], y: ghost[1], r: placeRot, v: KINDS[placeKind].v, sw: 0 }, false); cx.globalAlpha = 1;
  }
  if (wireStart && cursor) {
    const e = ortho(wireStart, cursor);
    cx.strokeStyle = 'rgba(255,225,77,.9)'; cx.lineWidth = 3; cx.setLineDash([8, 5]);
    cx.beginPath(); cx.moveTo(X(wireStart[0]), Y(wireStart[1])); cx.lineTo(X(e[0]), Y(e[1])); cx.stroke(); cx.setLineDash([]);
    cx.strokeStyle = '#3b9eff'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X(wireStart[0]), Y(wireStart[1]), 6, 0, 7); cx.stroke();
  }
  if (cursor && tool !== 'select') { cx.strokeStyle = 'rgba(59,158,255,.9)'; cx.lineWidth = 2; cx.beginPath(); cx.arc(X(cursor[0]), Y(cursor[1]), 7, 0, 7); cx.stroke(); }
  drawGraphs(W, H);
  if (window.LochFX) LochFX.draw(cx);
}
function drawGraphs(W, H) {
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
const ortho = (s, g) => (Math.abs(g[0] - s[0]) >= Math.abs(g[1] - s[1]) ? [g[0], s[1]] : [s[0], g[1]]);

/* ============ Eingabe ============ */
const ptrs = new Map(); let gest = null;
const rectOf = () => cv.getBoundingClientRect();
cv.addEventListener('pointerdown', e => {
  e.preventDefault();
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
cv.addEventListener('pointerup', pend); cv.addEventListener('pointercancel', pend);
cv.addEventListener('wheel', e => { e.preventDefault(); const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top, ns = clamp(view.s * Math.exp(-e.deltaY * 0.0015), 8, 80), f = ns / view.s; view.ox = x - (x - view.ox) * f; view.oy = y - (y - view.oy) * f; view.s = ns; draw(); }, { passive: false });
function rightClickExit() {
  if (simMode) return;
  wireStart = null; ghost = null; act = null;
  if (tool !== 'select') { setTool('select'); toast('Werkzeug beendet'); }
  draw();
}
cv.addEventListener('contextmenu', e => { e.preventDefault(); rightClickExit(); });
cv.addEventListener('auxclick', e => e.preventDefault());

function cancelAct() { if (act && act.t === 'move' && act.moved) { act.restore && act.restore(); } act = null; draw(); }
function onDown(p) {
  if (simMode && tool !== 'select' && tool !== 'scope') return;
  if (simMode) { const sh = sliderAt(p.x, p.y); if (sh) { act = { t: 'slide', sh }; setSlide(sh, p.x); return; } }
  const [fx, fy] = toGrid(p.x, p.y), g = snapG(fx, fy); cursor = g;
  switch (tool) {
    case 'select': {
      const part = partAt(fx, fy);
      if (part) {
        sel = { t: 'part', id: part.id };
        const pins = pinsOf(part).map(q => gk(q[0], q[1]));
        const att = []; sch.wires.forEach(w => { if (pins.includes(gk(w.x1, w.y1))) att.push([w, 1]); if (pins.includes(gk(w.x2, w.y2))) att.push([w, 2]); });
        act = { t: 'move', kind: 'part', id: part.id, g0: g, o: { x: part.x, y: part.y }, att: att.map(([w, e]) => [w, e, e === 1 ? w.x1 : w.x2, e === 1 ? w.y1 : w.y2]), moved: false, sx: p.x, sy: p.y };
        if (KINDS[part.k].momentary) { part.pressed = true; const w = wrapMap.get(part.id); if (w) w.pressed = true; act.press = part; }
      } else {
        const w = wireAt(fx, fy);
        if (w) { sel = { t: 'wire', id: w.id }; act = { t: 'move', kind: 'wire', id: w.id, g0: g, o: { x1: w.x1, y1: w.y1, x2: w.x2, y2: w.y2 }, moved: false }; }
        else { sel = null; act = { t: 'pan', lx: p.x, ly: p.y }; }
      }
      refreshUI(); break; }
    case 'wire':
      if (wireStart) {
        const e = ortho(wireStart, g);
        if (e[0] === wireStart[0] && e[1] === wireStart[1]) { wireStart = null; }
        else { addWire(wireStart, e); wireStart = e; }
        act = { t: 'none' };
      } else { wireStart = g; act = { t: 'wire', start: g }; }
      break;
    case 'place': ghost = g; act = { t: 'place' }; break;
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
      if ((dx || dy) && !act.moved) { act.moved = true; if (act.press) { act.press.pressed = false; const w = wrapMap.get(act.press.id); if (w) w.pressed = false; } }
      if (!act.moved) break;
      if (act.kind === 'part') {
        const part = byPart(act.id); part.x = act.o.x + dx; part.y = act.o.y + dy;
        act.att.forEach(([w, e, x, y]) => { if (e === 1) { w.x1 = x + dx; w.y1 = y + dy; } else { w.x2 = x + dx; w.y2 = y + dy; } });
      } else { const w = byWire(act.id); w.x1 = act.o.x1 + dx; w.y1 = act.o.y1 + dy; w.x2 = act.o.x2 + dx; w.y2 = act.o.y2 + dy; }
      break; }
    case 'place': ghost = g; break;
    case 'erase': eraseAt(fx, fy); break;
  }
  draw();
}
function onUp(p) {
  const a = act; act = null; if (!a) return;
  if (a.t === 'slide') { try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} refreshUI(); return; }
  switch (a.t) {
    case 'move':
      if (a.press) { a.press.pressed = false; const w = wrapMap.get(a.press.id); if (w) w.pressed = false; }
      if (a.moved) commit();
      else if (a.kind === 'part') {
        const part = byPart(a.id), K = KINDS[part.k];
        if (K.toggle) { part.sw = part.sw ? 0 : 1; const w = wrapMap.get(part.id); if (w) w.sw = part.sw; commit(true); }
      }
      break;
    case 'place': if (ghost) { const K = KINDS[placeKind]; sch.parts.push({ id: nid(), k: placeKind, x: ghost[0], y: ghost[1], r: placeRot, v: K.v, sw: K.sw0 || 0, pos: K.pos0 != null ? K.pos0 : 0.5, vr: K.vr, n: K.n, l: nextLabel(placeKind) }); commit(); } break;
    case 'wire': if (cursor && (cursor[0] !== a.start[0] || cursor[1] !== a.start[1])) { const e = ortho(a.start, cursor); addWire(a.start, e); wireStart = e; } break;
    case 'erase': if (a.did) commit(); break;
  }
  draw();
}
function addWire(a, b) {
  if (a[0] === b[0] && a[1] === b[1]) return;
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
  else if (e.key === 'r' || e.key === 'R') rotSel(1);
  else if (e.key === ' ') { e.preventDefault(); toggleRun(); }
  else if (e.key === 'Escape') { wireStart = null; sel = null; setTool('select'); }
});
function delSel() { if (simMode || !sel) return; if (sel.t === 'part') { sch.parts = sch.parts.filter(p => p.id !== sel.id); sch.scopes = sch.scopes.filter(s => !(s.t === 'part' && s.id === sel.id)); } else sch.wires = sch.wires.filter(w => w.id !== sel.id); sel = null; commit(); }
function rotSel(d) {
  if (simMode) return;
  if (tool === 'place' && !sel) { placeRot = (placeRot + d) & 3; draw(); refreshUI(); return; }
  if (sel && sel.t === 'part') { const p = byPart(sel.id); p.r = (p.r + d) & 3; commit(); }
}
function dupSel() { if (simMode || !sel || sel.t !== 'part') return; const p = JSON.parse(JSON.stringify(byPart(sel.id))); p.id = nid(); p.l = ''; p.x += 2; p.y += 2; p.l = nextLabel(p.k); sch.parts.push(p); sel = { t: 'part', id: p.id }; commit(); }

/* ============ Werkzeuge, Palette ============ */
function setTool(t, kind) {
  tool = t; placeKind = kind || null; wireStart = null; ghost = null; act = null;
  if (t !== 'select') sel = null;
  buildPalette(); refreshUI(); draw();
}
function buildPalette() {
  const chip = (id, label, on, data) => `<button class="chip ${on ? 'on' : ''}" data-t="${id}" ${data || ''}>${label}</button>`;
  let h;
  if (simMode) h = chip('select', '☝ Bedienen', tool === 'select') + chip('scope', '∿ Graph', tool === 'scope') + chip('reset', '↺ Zurück', false);
  else {
    h = chip('select', '☝ Auswahl', tool === 'select') + chip('wire', '✎ Draht', tool === 'wire') + chip('erase', '⌫ Löschen', tool === 'erase') + '<span class="sep"></span>';
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
  else if (show) CATS.forEach(cat => {
    if (!kindsOf(cat).length) return;
    lh += `<div class="pcat">${cat}</div>`;
    kindsOf(cat).forEach(k => { lh += `<button class="pit ${tool === 'place' && placeKind === k ? 'on' : ''}" data-t="place" data-k="${k}">${KINDS[k].name}</button>`; });
  });
  const keep = pl.scrollTop, was = pl.style.display;
  pl.innerHTML = lh; pl.dataset.h = simMode ? lh : ''; pl.style.display = show ? 'block' : 'none'; pl.scrollTop = keep;
  if (was !== pl.style.display) window.dispatchEvent(new Event('resize'));
}
/* Bedienfeld links in der Simulation: Schalter, Taster und Regler aller Bauteile an einer festen Stelle */
const CTLSTATE = { SD: ['ok', 'defekt'], FAULT: ['aus', 'Fehler'], SPDT: ['Stellung 1', 'Stellung 2'], KREUZ: ['gerade', 'gekreuzt'], LSS: ['aus', 'ein'], RCD: ['aus', 'ein'] };
function controlHtml() {
  const items = sch.parts.filter(p => { const K = KD(p); return K.toggle || K.momentary || K.pos; });
  let h = '<div class="pcat">Bedienfeld</div>';
  if (!items.length) return h + '<p class="hint2" style="padding:0 8px">Diese Schaltung hat keine Schalter oder Regler.</p>';
  items.forEach(p => {
    const K = KD(p), name = (p.l ? p.l + ' · ' : '') + K.name;
    if (K.toggle) { const st = CTLSTATE[p.k] || ['aus', 'ein']; h += `<button class="pit ctl ${p.sw ? 'on' : ''}" data-ctl="sw" data-id="${p.id}"><span>${esc(name)}</span><em>${st[p.sw ? 1 : 0]}</em></button>`; }
    else if (K.momentary) h += `<button class="pit ctl ${p.pressed ? 'on' : ''}" data-ctl="hold" data-id="${p.id}"><span>${esc(name)}</span><em>gedrückt halten</em></button>`;
    if (K.pos) { const v = p.pos == null ? (K.pos0 != null ? K.pos0 : 0.5) : p.pos; h += `<label class="ctl-sl"><span>${esc(name)}<em>${Math.round(v * 100)} %</em></span><input type="range" data-ctl="pos" data-id="${p.id}" min="0" max="1" step="0.01" value="${v}"></label>`; }
  });
  return h;
}
function refreshControls() {
  if (!simMode || !listMode()) return;
  const pl = $('#parts'), ae = document.activeElement; if (pl.contains(ae) && ae.type === 'range') return;
  const h = controlHtml(); if (pl.dataset.h !== h) { const keep = pl.scrollTop; pl.dataset.h = h; pl.innerHTML = h; pl.scrollTop = keep; }
}
(function () {
  const pl = $('#parts');
  const setP = (id, f) => { const p = byPart(+id); if (!p) return; f(p, wrapMap.get(p.id)); };
  pl.addEventListener('click', e => { const b = e.target.closest('[data-ctl="sw"]'); if (!b || !simMode) return; setP(b.dataset.id, (p, w) => { p.sw = p.sw ? 0 : 1; if (w) w.sw = p.sw; commit(true, true); draw(); refreshControls(); }); });
  pl.addEventListener('input', e => { const t = e.target; if (t.dataset.ctl !== 'pos' || !simMode) return; const v = parseFloat(t.value); setP(t.dataset.id, (p, w) => { p.pos = v; if (w) { w.pos = v; w.light = v; } draw(); const em = t.closest('label').querySelector('em'); if (em) em.textContent = Math.round(v * 100) + ' %'; }); });
  pl.addEventListener('change', e => { if (e.target.dataset.ctl === 'pos') { try { localStorage.setItem((SK + 'cur'), snap()); } catch (_) {} } });
  let held = null;
  pl.addEventListener('pointerdown', e => { const b = e.target.closest('[data-ctl="hold"]'); if (!b || !simMode) return; held = b.dataset.id; setP(held, (p, w) => { p.pressed = true; if (w) w.pressed = true; b.classList.add('on'); draw(); }); });
  const rel = () => { if (held == null) return; setP(held, (p, w) => { p.pressed = false; if (w) w.pressed = false; draw(); }); held = null; refreshControls(); };
  window.addEventListener('pointerup', rel); window.addEventListener('pointercancel', rel);
})();
const listMode = () => window.matchMedia('(min-width:720px)').matches;
window.matchMedia('(min-width:720px)').addEventListener && window.matchMedia('(min-width:720px)').addEventListener('change', () => buildPalette());
$('#parts').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { placeRot = 0; setTool('place', b.dataset.k); } });
$('#pal').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'place') { placeRot = 0; setTool('place', b.dataset.k); } else if (b.dataset.t === 'reset') resetSim(); else setTool(b.dataset.t); });
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
function setSimMode(on) {
  if (on && !sch.parts.length) { toast('Noch keine Bauteile gezeichnet'); return; }
  simMode = on; sel = null; wireStart = null; ghost = null; act = null;
  if (on) { tool = 'select'; rebuild(); sim.reset(); phase.clear(); lastSample = -1; running = true; lastFrame = performance.now(); }
  else { running = false; tool = 'select'; }
  const sw = $('#bSim'); if (sw) sw.setAttribute('aria-checked', on ? 'true' : 'false');
  $('#bRun').style.display = on ? '' : 'none';
  if (window.LochFX) { LochFX.showBtn(on); LochFX.clear(); if (on) LochFX.unlock(); }
  buildPalette(); refreshUI(); draw();
}
function resetSim() { if (window.LochFX) LochFX.clear(); rebuild(); sim.t = 0; sim.reset(); simTime = 0; phase.clear(); lastSample = -1; refreshUI(); draw(); }
function refreshUI() {
  const side = $('#side'); if (!side) return;
  $('#bRun').textContent = running ? '⏸ Stopp' : '▶ Start';
  $('#bRun').classList.toggle('on', running);
  $('#bUndo').disabled = simMode || hi <= 0; $('#bRedo').disabled = simMode || hi >= hist.length - 1;
  $('#title').textContent = sch.name;
  let h = '';
  if (simMode) {
    h += `<div class="card"><h4>Simulation</h4>
    <div class="row2"><button class="btn pri" data-a="run">${running ? '⏸ Stopp' : '▶ Start'}</button><button class="btn" data-a="reset">↺ Zurück</button></div>
    <div class="kv"><span>Zeit</span><b id="tLbl">${fmtT(sim ? sim.t : 0)}</b></div>
    <label class="sl"><span>Tempo<em id="tempoLbl">${tempoText()}</em></span><input type="range" id="slTempo" min="0" max="1" step="0.005" value="${tempo}"></label>
    <label class="sl"><span>Strompunkte</span><input type="range" id="slDot" min="0" max="1" step="0.01" value="${dotSpeed}"></label>
    <div class="kv"><span>Graph-Zeitfenster</span><span>${[0.001, 0.01, 0.1, 1, 10].map(w => `<button class="mini ${Math.abs(w - graphWin) < 1e-9 ? 'on' : ''}" data-win="${w}">${w >= 1 ? w + ' s' : w * 1000 + ' ms'}</button>`).join('')}</span></div>
  </div><div id="warn"></div>`;
  }
  if (!simMode && tool === 'place' && placeKind) {
    const K = KINDS[placeKind];
    h += `<div class="card"><h4>${esc(K.name)} setzen</h4><div class="row2"><button class="btn" data-a="rotl">↺</button><span class="sval">${placeRot * 90}°</span><button class="btn" data-a="rotr">↻</button></div><p class="hint2">Auf die Zeichenfläche tippen. Ausrichtung mit ↺ ↻ oder Taste R.</p></div>`;
  } else if (sel && sel.t === 'part') {
    const p = byPart(sel.id); if (p) {
      const K = KINDS[p.k];
      h += `<div class="card"><h4>${esc(p.l ? p.l + ' · ' : '')}${esc(K.name)}</h4>`;
      K.props.forEach(([key, label, type, opt, names]) => {
        if (type === 'ictype' && window.LochSimICs) { const cur = LochSimICs.find(p.v), ck = cur ? cur.key : ''; h += `<label class="f"><span>Typ</span><select data-ic="1">${ck ? '' : '<option value="">(eigener Wert)</option>'}${LochSimICs.SORT.map(q => `<option value="${q}" ${q === ck ? 'selected' : ''}>${esc(LochSimICs.CATALOG[q].name)}</option>`).join('')}</select></label><label class="f"><span>Wert</span><input data-p="v" value="${esc(p.v || '')}"></label>`; return; }
        if (type === 'text') h += `<label class="f"><span>${label}</span><input data-p="${key}" value="${esc(p[key] == null ? '' : p[key])}" placeholder="${esc(opt || '')}"></label>` + (key === 'v' && LS.PRESETS[p.k] ? `<div class="pre">${LS.PRESETS[p.k].filter(x => x !== '').map(x => `<button data-a="preset" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : '');
        else if (type === 'range') h += `<label class="sl"><span>${label}</span><input type="range" data-p="${key}" min="0" max="1" step="0.01" value="${p[key] == null ? 0.5 : p[key]}"></label>`;
        else if (type === 'select') h += `<label class="f"><span>${label}</span><select data-p="${key}">${opt.map(o => `<option value="${o}" ${(p[key] || K[key]) === o ? 'selected' : ''}>${names ? names[o] : o}</option>`).join('')}</select></label>`;
      });
      if (K.toggle) h += `<button class="btn" data-a="sw">Schalter umlegen (${p.sw ? 'an' : 'aus'})</button>`;
      if (!simMode) h += `<label class="f" style="margin-top:8px"><span>Bezeichnung</span><input data-p="l" value="${esc(p.l || '')}"></label><div class="row2" style="margin-top:8px"><button class="btn" data-a="rotl">↺</button><button class="btn" data-a="rotr">↻</button><button class="btn" data-a="dup">⧉</button><button class="btn danger" data-a="del">Löschen</button></div>`;
      if (simMode) h += '<div id="live"></div>';
      h += '</div>';
    }
  } else if (!simMode && sel && sel.t === 'wire') {
    h += `<div class="card"><h4>Draht</h4>${LAB === 'sim' ? `<div class="kv"><span>Aderfarbe</span></div><div class="wc">${Object.keys(WIRECOL).map(c => `<button class="chip ${(byWire(sel.id) || {}).c === c ? 'on' : ''}" data-a="wcol" data-c="${c}">${WIRENAME[c]}</button>`).join('')}</div>` : ''}<button class="btn danger" data-a="del" style="margin-top:8px">Löschen</button></div>`;
  } else if (LAB === 'sim' && !simMode && tool === 'wire') {
    h += `<div class="card"><h4>Aderfarbe</h4><div class="wc">${Object.keys(WIRECOL).map(c => `<button class="chip ${wireColor === c ? 'on' : ''}" data-a="wcol" data-c="${c}">${WIRENAME[c]}</button>`).join('')}</div><p class="hint2">Braun oder schwarz = Außenleiter L, blau = Neutralleiter N, grün-gelb = Schutzleiter PE.</p></div>`;
  } else if (!(simMode && !sel)) {
    h += `<div class="card"><h4>Hinweise</h4><p class="hint2">${{ select: 'Bauteil antippen zum Bearbeiten, ziehen zum Verschieben.', wire: 'Von Punkt zu Punkt ziehen oder nacheinander antippen. Gleichen Punkt nochmal antippen = Ende.', erase: 'Bauteil oder Draht antippen zum Löschen.', scope: 'Bauteil oder Draht antippen: Graph für Spannung und Strom.', place: 'Bauteil in der Leiste wählen.' }[tool]}</p></div>`;
  }
  if (simMode && !sel) h += `<div class="card"><h4>Hinweise</h4><p class="hint2">Schalter antippen = umlegen, Taster gedrückt halten. „Graph“ zeigt Spannung und Strom eines Bauteils.</p><p class="hint2">Grün = positive Spannung, Rot = negative, Grau = Masse. Gelbe Punkte zeigen den Stromweg.</p></div>`;
  if (!simMode) h += `<div class="card"><h4>Drucken und Simulieren</h4><p class="hint2">Oben den Schalter auf „Sim“ stellen, um die Schaltung laufen zu lassen. Im Menü findest du „Drucken“ für den Plan und die Bauteilliste.</p></div>`;
  side.innerHTML = h;
}
const fmtT = t => (t < 1e-3 ? (t * 1e6).toFixed(1) + ' µs' : t < 1 ? (t * 1e3).toFixed(2) + ' ms' : t.toFixed(3) + ' s');
const tempoText = () => { const r = rateOf(tempo); return r < 1e-3 ? (r * 1e6).toFixed(0) + ' µs/s' : r < 1 ? (r * 1e3).toFixed(1) + ' ms/s' : r.toFixed(1) + ' s/s'; };
$('#side').addEventListener('click', e => {
  const b = e.target.closest('[data-a],[data-win]'); if (!b) return;
  if (b.dataset.win) { graphWin = parseFloat(b.dataset.win); scopeBuf = sch.scopes.map(() => ({ t: [], v: [], i: [] })); lastSample = -1; refreshUI(); return; }
  const a = b.dataset.a;
  if (a === 'preset') { const p0 = sel && sel.t === 'part' && byPart(sel.id); if (p0) { p0.v = b.dataset.v; commit(true, true); rebuildKeep(); refreshUI(); } return; }
  if (a === 'wcol') { const w = sel && sel.t === 'wire' && byWire(sel.id); if (w) { w.c = b.dataset.c; wireColor = b.dataset.c; commit(true); } return; }
  if (a === 'run') toggleRun(); else if (a === 'reset') resetSim();
  else if (a === 'rotl') rotSel(3); else if (a === 'rotr') rotSel(1);
  else if (a === 'dup') dupSel(); else if (a === 'del') delSel();
  else if (a === 'sw') { const p = byPart(sel.id); p.sw = p.sw ? 0 : 1; const w = wrapMap.get(p.id); if (w) w.sw = p.sw; commit(true); }
});
$('#side').addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'slTempo') { tempo = parseFloat(t.value); $('#tempoLbl').textContent = tempoText(); return; }
  if (t.id === 'slDot') { dotSpeed = parseFloat(t.value); return; }
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
    if (running) { advance(rdt); stepPhases(rdt); dirtyDraw = true; }
    if (window.LochFX && LochFX.active()) dirtyDraw = true;
    if (dirtyDraw) { dirtyDraw = false; render(); }
    if (running || sel) updateLive();
  } catch (e) { console.error(e); running = false; toast('Fehler in der Simulation: ' + e.message); refreshUI(); }
  requestAnimationFrame(loop);
}
let lastLive = 0;
function updateLive() {
  const now = performance.now(); if (now - lastLive < 120) return; lastLive = now;
  refreshControls();
  const t = $('#tLbl'); if (t && sim) t.textContent = fmtT(sim.t);
  const w = $('#warn'); if (w) {
    const msgs = []; if (!sch.parts.some(p => p.k === 'BAT' || p.k === 'AC' || p.k === 'NETZ' || ['GATE', 'DFF'].includes(KINDS[p.k].core))) msgs.push('Keine Spannungsquelle in der Schaltung.');
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
    const rows = [['new', 'Neue Schaltung', 'Leere Fläche'], ['ex', 'Beispielschaltungen', `${EXAMPLES.length} Schaltungen zum Ausprobieren`], ['open', 'Gespeicherte Schaltungen', 'Auf diesem Gerät'], ['save', 'Speichern unter …', sch.name], ['export', 'Als Text sichern', 'Zum Weitergeben oder als Backup'], ['import', 'Aus Text laden', 'Gesicherten Text einfügen'], ['share', 'Teilen', 'Link zum Weitergeben (Schaltung steckt im Link)'], ['print', 'Drucken', 'Plan und Bauteilliste'], ['img', 'Als Bild exportieren', 'Gedrückt halten zum Sichern'], ['fit', 'Ansicht einpassen', ''], ['lab', 'Zum Lochraster-Layout', 'LochLab öffnen'], ['auto', 'Layout automatisch erzeugen', 'Nur mit Freigabe (Ausbilder)'], ['start', 'Zur Startseite', 'Layout oder Stromlaufplan wählen'], ['help', 'Hilfe', '']];
    b.innerHTML = rows.map(r => `<button class="row" data-m="${r[0]}"><div class="grow"><b>${r[1]}</b><small>${esc(r[2])}</small></div></button>`).join('');
    b.addEventListener('click', e => { const r = e.target.closest('.row'); if (!r) return; close(); menuAct(r.dataset.m); });
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
    case 'SPK': return { ll: { k: 'SPK', n: 4, v }, pm: [0, 1], ...two };
    case 'PB': return { ll: { k: 'SW', vr: 'k2', v: '' }, pm: [0, 1] };
    case 'NPN': case 'PNP': return { ll: { k: 'T', v }, pm: [1, 0, 2] };
    case 'THY': return { ll: { k: 'THY', v }, pm: [1, 0, 2] };
    case 'OPTO': return { ll: { k: 'OPTO', v }, pm: [0, 1, 3, 2] };
    case 'RLY': return { ll: { k: 'RLY', v: v || '12V', vr: /^5/.test(v) ? 'r5' : (/^24/.test(v) ? 'r24' : 'r12') }, pm: [0, 1, 2, 3, 4] };
    case 'TRF': return { ll: { k: 'TRF', v }, pm: [0, 1, 2, 3] };
    case 'ICX': { const n = p.n || 8; return { ll: { k: 'IC', n, v, sk: true }, pm: Array.from({ length: n }, (_, i) => i) }; }
    case 'BAT': case 'AC': case 'SPST': case 'SPDT': case 'LAMP': case 'MOTOR': case 'HEAT': case 'FUSE': { const n = KD(p).pins.length; return { ll: { k: 'KL', n, v: '' }, pm: Array.from({ length: n }, (_, i) => i), ext: true }; }
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
  const parts = [], skipped = {}, ext = [];
  sch.parts.forEach(p => {
    if (p.k === 'GND' || p.k === 'VM' || p.k === 'AM') return;
    if (GATE_IC[p.k]) return;
    const sp = llSpec(p), K = KINDS[p.k];
    if (!sp) { skipped[K.name] = (skipped[K.name] || 0) + 1; return; }
    const pw = pinsOf(p), pins = []; sp.pm.forEach((li, si) => { pins[li] = String(find(gk(...pw[si]))); });
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
  if (m === 'share') { if (!sch.parts.length) { toast('Noch nichts gezeichnet'); return; } shareNow(JSON.parse(snap()), sch.name); return; }
  if (m === 'auto') { makeLayout(); return; }
  if (m === 'new') confirmNew(() => loadCircuit({ name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] }));
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
  else if (m === 'help') sheet('Hilfe', b => { b.innerHTML = `<div class="help"><p style="color:var(--mute);font-size:12px">Programmstand: v42</p><p><b>Zeichnen:</b> Bauteil in der Leiste wählen, auf die Fläche tippen. <b>Draht</b> von Punkt zu Punkt ziehen. Bauteil-Anschlüsse müssen genau auf Drahtenden liegen.</p><p><b>Masse:</b> Das Massesymbol legt fest, wo 0 V ist. Ohne Masse wird der Minuspol der Quelle genommen.</p><p><b>Simulation:</b> Oben den Schalter auf „Sim“ stellen. Die Spannung ist grün (positiv), rot (negativ) oder grau (null). Gelbe Punkte zeigen den Stromweg und seine Richtung.</p><p><b>Bedienen:</b> Schalter antippen, Taster gedrückt halten. Poti, Fotowiderstand und Werte rechts einstellen.</p><p><b>Drucken:</b> Menü, dann „Drucken“: der Plan kommt schwarz auf weiß aufs Blatt, dazu die Bauteilliste.</p><p><b>Graph:</b> Werkzeug „Graph“, dann Bauteil oder Draht antippen. Gelb ist die Spannung, grün der Strom.</p><p><b>Tempo:</b> Der Regler legt fest, wie viele simulierte Sekunden pro echter Sekunde vergehen. Schnelle Signale brauchen ein kleines Tempo.</p></div>`; });
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
  running = false; sel = null; wireStart = null; simMode = false;
  if (d.tempo != null) tempo = d.tempo; if (d.win) graphWin = d.win;
  sch = { name: d.name || 'Schaltung', parts: JSON.parse(JSON.stringify(d.parts || [])), wires: JSON.parse(JSON.stringify(d.wires || [])), nid: d.nid || 1, scopes: d.scopes || [], sid: d.sid };
  assignLabels(sch.parts);
  sch.nid = Math.max(sch.nid, 1 + Math.max(0, ...sch.parts.map(p => p.id || 0), ...sch.wires.map(w => w.id || 0)));
  circ = null; sim = null; phase.clear(); lastSample = -1; rebuild(); hist = [snap()]; hi = 0;
  try { localStorage.setItem((SK + 'cur'), snap()); } catch (e) {}
  { const sw = $('#bSim'); if (sw) sw.setAttribute('aria-checked', 'false'); $('#bRun').style.display = 'none'; }
  setTool('select'); fit(); refreshUI(); draw();
}
function openExamples() {
  sheet('Beispielschaltungen', (b, close) => {
    let h = '', last = '';
    EXAMPLES.forEach((e, i) => {
      if (!exOk(e)) return;
      if (e.cat !== last) { last = e.cat; h += `<div class="gh">${esc(e.cat || 'Weitere')}</div>`; }
      h += `<button class="row" data-i="${i}"><div class="grow"><b>${esc(e.name)}</b><small>${esc(e.info)}</small></div></button>`;
    });
    b.innerHTML = h;
    b.addEventListener('click', ev => { const r = ev.target.closest('.row'); if (!r) return; close(); const ex = buildExample(EXAMPLES[+r.dataset.i]); loadCircuit(ex); if (ex.tempo != null) tempo = ex.tempo; if (ex.win) graphWin = ex.win; refreshUI(); });
  });
}
const exOk = e => LAB === 'sim' ? (e.lab === 'sim' || e.cat === 'Bauteile') : !e.lab;
const defEx = () => EXAMPLES.find(exOk) || EXAMPLES[0];
function buildExample(e) {
  const d = e.make(); let id = 1; const parts = [], wires = [];
  d.parts.forEach(([k, x, y, r, v, extra]) => { const K = KINDS[k]; parts.push(Object.assign({ id: id++, k, x, y, r: r || 0, v: v != null ? v : K.v, sw: K.sw0 || 0, pos: K.pos0 != null ? K.pos0 : 0.5, vr: K.vr }, extra || {})); });
  d.wires.forEach(poly => { let wc; if (typeof poly[0] === 'string') { wc = poly[0]; poly = poly.slice(1); } for (let i = 2; i < poly.length; i += 2) wires.push(Object.assign({ id: id++, x1: poly[i - 2], y1: poly[i - 1], x2: poly[i], y2: poly[i + 1] }, wc ? { c: wc } : {})); });
  assignLabels(parts);
  const scopes = (d.scopes || []).map(i => ({ t: 'part', id: i + 1 }));
  return { name: e.name, parts, wires, nid: id, scopes, tempo: d.tempo, win: d.win };
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
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -4, 6, -8, 6, -12, 6], ['blau', 3, 0, 3, 16, -4, 16, -8, 16, -12, 16], ['blau', -4, 14, -4, 16], ['blau', -8, 14, -8, 16], ['blau', -12, 14, -12, 16]], scopes: [0, 5], tempo: 0.6, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Kurzschluss löst den Sicherungsautomaten aus', info: 'Fehlerstelle antippen: ein Kurzschluss zieht sehr hohen Strom. Der Sicherungsautomat schaltet sofort ab.',
    make: () => ({ parts: [['NETZ', 1, 0], ['LSS', 1, 2, 1, 'B16'], ['LAMP', -3, 6, 1, '230V 60W'], ['FAULT', -7, 6, 1, '0.05']],
      wires: [['braun', 1, 0, 1, 2], ['braun', 1, 6, -3, 6, -7, 6], ['blau', 3, 0, 3, 12, -3, 12, -7, 12], ['blau', -3, 10, -3, 12], ['blau', -7, 10, -7, 12]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { lab: 'sim', cat: 'Hausinstallation', name: 'Verteilung mit zwei Stromkreisen (Flur und Bad)', info: 'Ein FI schützt beide Stromkreise, jeder hat einen eigenen Sicherungsautomaten. Schalter antippen.',
    make: () => ({ parts: [['NETZ', 1, 0], ['RCD', 1, 2], ['LSS', -4, 8, 1, 'B10'], ['LSS', -10, 8, 1, 'B10'], ['SPST', -4, 12, 1, '', { sw: 1 }], ['SPST', -10, 12, 1, '', { sw: 1 }], ['LAMP', -4, 16, 1, '230V 60W'], ['LAMP', -10, 16, 1, '230V 60W']],
      wires: [['braun', 1, 0, 1, 2], ['blau', 3, 0, 3, 2], ['braun', 1, 6, 1, 8, -4, 8, -10, 8], ['blau', 3, 6, 3, 22, -4, 22, -10, 22], ['blau', -4, 20, -4, 22], ['blau', -10, 20, -10, 22]], scopes: [], tempo: 0.55, win: 0.04 }) },
  { cat: 'Bauteile', name: 'Motor mit Bremse', info: 'Seitenleiste: „Bremse / Last“ hochziehen. Der Strom steigt, die Drehzahl fällt. Bei Blockade brennt der Motor durch.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '6'], ['SPST', 2, 2, 0, '', { sw: 1 }], ['MOTOR', 6, 2, 0, '6V', { pos: 0 }], ['GND', 2, 8]],
      wires: [[2, 4, 2, 2], [10, 2, 10, 8, 2, 8]], scopes: [2], tempo: 0.7, win: 1 }) },
  { cat: 'Bauteile', name: 'Sicherung schützt die Lampen', info: 'Dritten Schalter schließen: 0,3 A sind mehr als die 250-mA-Sicherung. Sie löst aus und alles geht aus.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['FUSE', 2, 2, 0, '250mA'], ['SPST', 8, 2, 1, '', { sw: 1 }], ['LAMP', 8, 6, 1, '9V 0.1A'], ['SPST', 12, 2, 1, '', { sw: 1 }], ['LAMP', 12, 6, 1, '9V 0.1A'], ['SPST', 16, 2, 1, '', { sw: 0 }], ['LAMP', 16, 6, 1, '9V 0.1A'], ['GND', 2, 8]],
      wires: [[6, 2, 8, 2, 12, 2, 16, 2], [2, 8, 2, 10, 8, 10, 12, 10, 16, 10]], scopes: [], tempo: 0.75 }) },
  { cat: 'Bauteile', name: 'Relais schaltet eine zweite Last', info: 'Taster drücken: das Relais zieht an und schaltet die Lampe um. Der Steuerstromkreis ist vom Lastkreis getrennt.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '12'], ['PB', 2, 2, 0, ''], ['RLY', 8, 2, 0, '12V'], ['LAMP', 16, 2, 0, '12V 0.1A'], ['LAMP', 16, 6, 0, '12V 0.1A'], ['BAT', 22, 2, 1, '12'], ['GND', 2, 8], ['GND', 22, 6]],
      wires: [[2, 4, 2, 2], [6, 2, 8, 2], [8, 6, 8, 8, 2, 8], [20, 2, 20, 6], [20, 2, 22, 2], [13, 4, 13, 10, 22, 10, 22, 6]], scopes: [], tempo: 0.75 }) },
  { cat: 'Bauteile', name: 'Thyristor zündet und hält', info: 'Taster kurz drücken: der Thyristor zündet und die Lampe bleibt an, auch wenn der Taster wieder loslässt. „Zurück“ löscht.',
    make: () => ({ parts: [['BAT', 2, 4, 1, '9'], ['LAMP', 2, 2, 0, '9V 0.1A'], ['THY', 6, 2, 0, 'TIC106'], ['R', 9, 4, 1, '1k'], ['PB', 5, 8, 0, ''], ['GND', 2, 8]],
      wires: [[5, 8, 4, 8, 4, 4, 2, 4], [10, 2, 16, 2, 16, 12, 2, 12, 2, 8]], scopes: [], tempo: 0.75 }) },
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
$('#bRun').style.display = 'none';
$('#bShare').onclick = () => menuAct('share'); $('#bEx').onclick = () => menuAct('ex'); $('#bOpen').onclick = () => menuAct('open'); $('#bPrint').onclick = () => menuAct('print');
$('#bRun').onclick = toggleRun; $('#bUndo').onclick = undo; $('#bRedo').onclick = redo; $('#bMenu').onclick = openMenu;
$('#title').onclick = () => form('Name', [{ l: 'Name der Schaltung', v: sch.name }], ([n]) => { sch.name = n.trim() || sch.name; commit(true); });
(function init() {
  let d = null; try { d = JSON.parse(localStorage.getItem((SK + 'cur')) || 'null'); } catch (e) {}
  buildPalette();
  if (/[?&]neu\b/.test(location.search)) { if (d && d.parts && (d.parts.length || (d.wires && d.wires.length))) { loadCircuit(d); confirmNew(() => loadCircuit({ name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] })); } else loadCircuit({ name: 'Neue Schaltung', parts: [], wires: [], nid: 1, scopes: [] }); }
  else if (/[?&]bsp\b/.test(location.search)) loadCircuit(buildExample(LAB === 'sim' ? defEx() : EXAMPLES[1]));
  else if (d && d.parts && d.parts.length) loadCircuit(d); else { loadCircuit(buildExample(LAB === 'sim' ? defEx() : EXAMPLES[1])); }
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
window.SchaltDebug = () => ({ view, sl: sliderHits, running, t: sim && sim.t, N: circ && circ.nn, flows: [...flows.entries()], imax, vmax, elems: circ && circ.elems.map(e => ({ t: e.type, part: e.part && e.part.k, i: e.i })) , sch });
})();
