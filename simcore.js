/* Tonfunk LochLab - Simulationskern (Knotenanalyse, Zeitschritte, Newton-Verfahren)
   Reine Rechenfunktionen ohne Zugriff auf die Oberfläche. */
(function (root) {
'use strict';
const ICS = (typeof module !== 'undefined' && module.exports) ? require('./simics.js') : root.LochSimICs;

const VT = 0.025852;           // Temperaturspannung bei 300 K
const GMIN = 1e-12;            // kleiner Leitwert gegen Masse, verhindert singuläre Matrizen
const RON = 1e-3, ROFF = 1e9;  // geschlossener / offener Schalter

/* ---------- Werte lesen (4k7, 100n, 10µ, 1M, 5V, 1kHz ...) ---------- */
/* Plausibilitätsprüfung der Bauteilwerte: unrealistische Eingaben werden durch Standardwerte ersetzt */
const LIMITS = {
  BAT: [0.01, 1000, '9'], R: [1e-3, 1e10, '1k'], C: [1e-15, 10, '100n'], CE: [1e-12, 10, '100u'], CF: [1e-15, 10, '100n'], L: [1e-9, 1e3, '10m'],
  NETZ: [50, 500, '230V'], NETZ3: [100, 1000, '400V'], ZD: [1, 200, '5.1'], FUSE: [1e-3, 100, '250mA'], MOTOR: [0.5, 48, '6V'], RLY: [1, 400, '12V'], NTC: [1, 1e8, '10k'], PTC: [0.1, 1e8, '100'], SPK: [1, 1e4, '8'], P: [1, 1e8, '10k'], TP: [1, 1e8, '10k'],
};
/* Spulenwerte: Gleichstromspulen (kleine Spannung) rein ohmsch-induktiv, Wechselstromspulen (230 V) über ihre Impedanz bei 50 Hz */
function coil(un, va, tau) {
  if (un < 100) { const R = un * un / va; return { r: R, l: R * tau, ion: 0.7 * un / R, ioff: 0.2 * un / R }; }
  const Z = un * un / va, R = 0.15 * Z, L = Math.sqrt(Z * Z - R * R) / 314.16;
  return { r: R, l: L, ion: 0.7 * un / Z, ioff: 0.2 * un / Z };
}
function sane(k, v) {
  const L = LIMITS[k];
  if (k === 'LAMP') {
    const q = String(v == null ? '' : v).replace(',', '.'), mv = q.match(/([0-9.]+)\s*V/), ma = q.match(/([0-9.]+)\s*(m?)A/), mw = q.match(/([0-9.]+)\s*W/);
    const un = mv ? parseFloat(mv[1]) : 6, ia = ma ? parseFloat(ma[1]) * (ma[2] ? 1e-3 : 1) : (mw ? parseFloat(mw[1]) / un : 0.1);
    if (un < 0.1 || ia < 1e-3) return { ok: false, v: '6V 0.1A' };
    return (un <= 400 && ia <= 20) ? { ok: true, v } : { ok: false, high: true, v };
  }
  if (k === 'SIG') { const g = parseGen(v); return (g.amp <= 1000 && g.freq <= 1e7) ? { ok: true, v } : { ok: false, high: true, v }; }
  if (!L || v == null || String(v).trim() === '') return { ok: true, v };
  const x = si(v, NaN);
  if (!isFinite(x)) return { ok: true, v };
  if (x < L[0]) return { ok: false, v: L[2] };
  return x <= L[1] ? { ok: true, v } : { ok: false, high: true, v, max: L[1] };
}
/* Übliche Werte zum schnellen Einsetzen (die Eingabe bleibt frei änderbar) */
const E12 = ['10', '22', '47', '100', '220', '330', '470', '680', '1k', '2.2k', '4.7k', '10k', '22k', '47k', '100k', '470k', '1M'];
const PRESETS = {
  R: E12, POT: ['1k', '4.7k', '10k', '47k', '100k', '470k'], P: ['1k', '4.7k', '10k', '47k', '100k', '470k'], TP: ['100', '1k', '10k', '47k', '100k', '1M'],
  C: ['22p', '100p', '1n', '10n', '47n', '100n', '220n', '470n', '1u'], CF: ['10n', '47n', '100n', '220n', '470n', '1u', '2.2u'], CE: ['1u', '4.7u', '10u', '47u', '100u', '220u', '470u', '1000u'],
  L: ['1u', '10u', '100u', '1m', '10m', '100m', '1'], ZD: ['3.3', '4.7', '5.1', '6.2', '9.1', '12', '15', '24'], D: ['1N4148', '1N4007', '1N5408', '1N5819', 'BAT43'],
  BAT: ['1.5', '3', '4.5', '5', '6', '9', '12', '24', '48'], AC: ['5V 50Hz', '5V 1kHz', '10V 50Hz', '12V 50Hz', '325V 50Hz'], NETZ: ['230V', '400V', '110V'],
  LAMP: ['6V 0.1A', '6V 0.3A', '12V 5W', '12V 21W', '24V 5W', '230V 25W', '230V 60W', '230V 100W'], HEAT: ['230V 500W', '230V 1000W', '230V 2000W'],
  FUSE: ['100mA', '250mA', '500mA', '1A', '2A', '5A', '10A'], LSS: ['B10', 'B16', 'B20', 'C16'], MOTOR: ['3V', '6V', '9V', '12V'], RLY: ['5V', '12V', '24V', '230V'],
  NETZ3: ['400V'], MOTOR3: ['400V 2.2kW', '400V 0.75kW', '400V 4kW', '230V 1.1kW D'], NTC: ['4.7k', '10k', '47k', '100k'], PTC: ['47', '100', '220'], SPK: ['4', '8', '16'], BZ: ['5V', '12V'], TRF: ['230V:6V', '230V:12V', '230V:24V'], SD: ['', '500W', '1000W', '2000W'],
  NPN: ['BC547', 'BC548', 'BC337', '2N3904'], PNP: ['BC557', 'BC327', '2N3906'], T: ['BC547', 'BC548', 'BC557', 'BC337', 'BC327', '2N3904', '2N3906'],
  U: ['7805', '7812', '7905', '78L05', 'LM317'], Q: ['32.768k', '4M', '8M', '16M', '20M'], THY: ['TIC106', '2N5062'], OPTO: ['PC817', '4N25'], IMP: ['230V', '24V'], FAULT: ['0.05', '100', '3300'],
  IC: ['NE555', 'SN7400', 'SN7404', 'SN7408', 'SN7432', 'SN7486', 'SN74HC14', 'CD4011', 'CD4017', 'CD4020', 'LM358', 'LM741', 'TL072', 'LM324'], ICX: ['NE555', 'SN7400', 'SN7404', 'CD4017', 'LM358', 'LM741'],
};
function si(str, def) {
  if (str == null || str === '') return def;
  let s = String(str).trim().replace(',', '.').replace(/µ/g, 'u').replace(/[Ωω]/g, '');
  s = s.replace(/(ohm|Ohm|OHM)$/, '').replace(/(Hz|hz|HZ)$/, '');
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*([pnumkKMGRr]?)([0-9]*)\s*[VAFHvafh]?$/);
  if (!m) return def;
  const mult = { p: 1e-12, n: 1e-9, u: 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, R: 1, r: 1 }[m[2]] || 1;
  const num = m[3] ? parseFloat(m[1].split('.')[0] + '.' + m[3]) : parseFloat(m[1]);
  const v = num * mult;
  return isFinite(v) ? v : def;
}
function parseGen(v) {
  const s = String(v || '').replace(',', '.');
  const f = s.match(/([0-9]*\.?[0-9]+)\s*([kM]?)\s*Hz/i);
  const a = s.match(/([0-9]*\.?[0-9]+)\s*(m?)\s*V/);
  const freq = f ? parseFloat(f[1]) * ({ k: 1e3, K: 1e3, M: 1e6 }[f[2]] || 1) : 1000;
  const amp = a ? parseFloat(a[1]) * (a[2] === 'm' ? 1e-3 : 1) : 5;
  return { freq, amp };
}

/* ---------- Dioden-Hilfen ---------- */
const vcrit = (is, nvt) => nvt * Math.log(nvt / (Math.SQRT2 * is));
function pnjlim(vnew, vold, vt, vc) {
  if (vnew > vc && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) {
      const arg = (vnew - vold) / vt;
      vnew = arg > 0 ? vold + vt * (2 + Math.log(arg - 2)) : vold - vt * (2 + Math.log(2 - arg));
    } else vnew = vt * Math.log(vnew / vt);
  }
  return vnew;
}
function expSafe(x) { return Math.exp(Math.min(x, 80)); }

const LEDVF = { rot: 1.9, gelb: 2.0, grün: 2.1, blau: 3.0, weiß: 3.1, orange: 2.0 };
function ledKey(v) {
  v = String(v || '').toLowerCase();
  if (/^(gr|green)/.test(v)) return 'grün';
  if (/^(ge|yel)/.test(v)) return 'gelb';
  if (/^bl/.test(v)) return 'blau';
  if (/^(we|wh)/.test(v)) return 'weiß';
  if (/^or/.test(v)) return 'orange';
  return 'rot';
}
const LEDIMAX = { '18': 0.03, '3': 0.045, '5': 0.06, '8': 0.08, '10': 0.1 };
const REGV = { '7805': 5, '7806': 6, '7808': 8, '7809': 9, '7810': 10, '7812': 12, '7815': 15, '7824': 24, 'LM7805': 5, 'LM7812': 12 };

/* ---------- Netzliste aus dem Lochraster ----------
   layout: { parts:[{id,k,vr,v,n,pins:[[x,y]..],sw,pos,pressed,light}], tracks:[{x1,y1,x2,y2}], wires:[{x1,y1,x2,y2}] }
   Lötseite (tracks): alle Löcher auf dem Weg sind verbunden.
   Bestückungsseite (wires): nur die beiden Enden. */
function buildCircuit(layout) {
  const parent = new Map();
  const key = (x, y) => x + ',' + y;
  const find = k => { if (!parent.has(k)) parent.set(k, k); let r = k; while (parent.get(r) !== r) r = parent.get(r); let c = k; while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };

  (layout.tracks || []).forEach(t => {
    const dx = Math.sign(t.x2 - t.x1), dy = Math.sign(t.y2 - t.y1);
    const n = Math.max(Math.abs(t.x2 - t.x1), Math.abs(t.y2 - t.y1));
    const straight = t.x1 === t.x2 || t.y1 === t.y2 || Math.abs(t.x2 - t.x1) === Math.abs(t.y2 - t.y1);
    if (!straight) { union(key(t.x1, t.y1), key(t.x2, t.y2)); return; }
    for (let i = 0; i < n; i++) union(key(t.x1 + dx * i, t.y1 + dy * i), key(t.x1 + dx * (i + 1), t.y1 + dy * (i + 1)));
    if (n === 0) find(key(t.x1, t.y1));
  });
  (layout.wires || []).forEach(w => union(key(w.x1, w.y1), key(w.x2, w.y2)));
  const pinKey = (p, i) => key(p.pins[i][0], p.pins[i][1]);
  layout.parts.forEach(p => p.pins.forEach((_, i) => find(pinKey(p, i))));

  // Masse: Masse-Symbole (Schaltplan) oder Minuspol der ersten Spannungsquelle
  let groundRoot = null;
  if (layout.ground && layout.ground.length) {
    layout.ground.forEach(g => find(key(g[0], g[1])));
    for (let i = 1; i < layout.ground.length; i++) union(key(layout.ground[0][0], layout.ground[0][1]), key(layout.ground[i][0], layout.ground[i][1]));
    groundRoot = find(key(layout.ground[0][0], layout.ground[0][1]));
  } else for (const p of layout.parts) if ((p.k === 'BAT' || p.k === 'SIG') && p.pins.length > 1) { groundRoot = find(pinKey(p, 1)); break; }

  { const mcus = layout.parts.filter(p => p.k === 'MCU');
    if (mcus.length) { const g0 = pinKey(mcus[0], 3); mcus.forEach(p => { union(pinKey(p, 3), g0); union(pinKey(p, 24), g0); }); if (groundRoot) union(groundRoot, g0); groundRoot = find(g0); } }
  { const pis = layout.parts.filter(p => p.k === 'PI40');
    if (pis.length) { const GN = [5, 8, 13, 19, 24, 29, 33, 38], g0 = pinKey(pis[0], GN[0]); pis.forEach(p => GN.forEach(i => union(pinKey(p, i), g0))); if (groundRoot) union(groundRoot, g0); groundRoot = find(g0); } }
  const nodeId = new Map(); let nn = 0;
  if (groundRoot) nodeId.set(groundRoot, 0);
  const nodeOfRoot = r => { if (!nodeId.has(r)) nodeId.set(r, ++nn); return nodeId.get(r); };
  const nodeOfKey = k => { if (!parent.has(k)) return -1; return nodeOfRoot(find(k)); };
  const N = (p, i) => nodeOfRoot(find(pinKey(p, i)));

  const elems = [], warnings = [];
  const rec = [];
  const add = e => { e.pi = rec.splice(0); elems.push(e); return e; };
  // PE-Anschluss am Gehäuse (Schutzklasse I): Körperschluss simulierbar (Außenleiter über 2 kΩ zum Gehäuse); ohne PE steht das Gehäuse unter Spannung
  const bodyFault = (p, pe, warn) => {
    const r = find(pinKey(p, pe)); let cnt = 0; layout.parts.forEach(q => q.pins.forEach((_, i) => { if (find(pinKey(q, i)) === r) cnt++; }));
    const floating = cnt <= 1;
    if (floating && warn) warnings.push({ part: p, text: 'Schutzleiter (PE) nicht angeschlossen: Bei einem Körperschluss steht das Gehäuse unter Spannung (Lebensgefahr).' });
    add({ type: 'S', a: nodeOfRoot(find(pinKey(p, 0))), b: nodeOfRoot(r), closed: !!p.sw, ron: 2000, part: p, sub: 'body', peFloating: floating, upd() { this.closed = !!this.part.sw; } });
  };
  const R = (a, b, g, part, extra) => add(Object.assign({ type: 'R', a, b, g, part }, extra || {}));

  layout.parts.forEach(p => {
    const elemStart = elems.length;
    { const s = sane(p.k, p.v);
      if (!s.ok && s.high) { warnings.push({ part: p, text: 'Wert „' + p.v + '“ ist weit über dem üblichen Bereich' + (s.max ? ' (bis ' + s.max + ')' : '') + ': das Bauteil im Stromkreis wird zerstört. Übliche Werte stehen beim Bauteil zur Auswahl.' }); if ((p.k === 'BAT' || p.k === 'NETZ') && si(p.v, 0) > 1e6) p.v = '1000000'; }
      else if (!s.ok) { warnings.push({ part: p, text: 'Wert „' + p.v + '“ ist unrealistisch klein oder ungültig, es wird der Standardwert ' + s.v + ' verwendet' }); p.v = s.v; }
      if (p.imax && !(si(p.imax, 0) >= 1e-3 && si(p.imax, 0) <= 100)) { warnings.push({ part: p, text: 'Max. Strom „' + p.imax + '“ ist unrealistisch und wird ignoriert' }); p.imax = ''; } }
    const k = p.k, pins = p.pins, n = (i) => { rec.push(i); return N(p, i); };
    switch (k) {
      case 'R': add({ type: 'R', a: n(0), b: n(1), g: 1 / Math.max(si(p.v, 1000), 1e-3), part: p, rated: 0.25, res: true }); break;
      case 'LDR': {
        const pos = p.light == null ? 0.5 : p.light;
        add({ type: 'R', a: n(0), b: n(1), g: 1 / (1e6 * Math.pow(1e-3, pos)), part: p,
          upd() { const q = this.part.light == null ? 0.5 : this.part.light; this.g = 1 / (1e6 * Math.pow(1e-3, q)); } });
        break; }
      case 'VM': add({ type: 'R', a: n(0), b: n(1), g: 1e-7, part: p, meter: 'V' }); break;
      case 'AM': add({ type: 'R', a: n(0), b: n(1), g: 1e3, part: p, meter: 'A' }); break;
      case 'LAMP': {
        const q = String(p.v || '6V 0.1A').replace(',', '.'), mv = q.match(/([0-9.]+)\s*V/), ma = q.match(/([0-9.]+)\s*(m?)A/), mw = q.match(/([0-9.]+)\s*W/);
        const un = mv ? parseFloat(mv[1]) : 6, ia = ma ? parseFloat(ma[1]) * (ma[2] ? 1e-3 : 1) : (mw ? parseFloat(mw[1]) / un : 0.1);
        add({ type: 'R', a: n(0), b: n(1), g: ia / un, part: p, lamp: un * ia, lh: 0 });
        if (p.pins.length > 2) bodyFault(p, 2, un >= 50);
        break; }
      case 'FUSE': add({ type: 'R', a: n(0), b: n(1), g: 1 / 0.15, part: p, fuse: { ir: Math.max(si(p.v, 0.25), 1e-3), tau: 0.3 }, heat: 0 }); break;
      case 'NTC': case 'PTC': {
        const r25 = Math.max(si(p.v, 10000), 1), ntc = k === 'NTC';
        const gOf = q => { const T = -20 + 140 * (q == null ? 0.32 : q), r = ntc ? r25 * Math.exp(3950 * (1 / (T + 273.15) - 1 / 298.15)) : r25 * Math.exp(0.0225 * (T - 25)); return 1 / Math.max(r, 0.1); };
        add({ type: 'R', a: n(0), b: n(1), g: gOf(p.pos), part: p, upd() { this.g = gOf(this.part.pos); } });
        break; }
      case 'SPK': add({ type: 'R', a: n(0), b: n(1), g: 1 / Math.max(si(p.v, 8), 1), part: p, speaker: true }); break;
      case 'MOTOR': {
        const un = Math.max(si(p.v, 6), 0.5), R = un / 1.2, i0 = 0.12, w0 = 350, ke = (un - R * i0) / w0, tst = ke * un / R;
        const m = { ke, b: ke * i0 / w0, J: 3e-6, w: 0, tst, w0, bx: 0 };
        add({ type: 'RL', a: n(0), b: n(1), r: R, l: 1e-3, emf: 0, iprev: 0, mech: m, part: p, heat: 0,
          upd() { const q = this.part.pos == null ? 0 : this.part.pos; m.bx = q * 8 * m.tst / m.w0; this.emf = m.ke * m.w; } });
        break; }
      case 'RLY': {
        const un = Math.max(si(p.v, 12), 1), cl = coil(un, 0.4, 0.03), rl = add({ type: 'RL', a: n(0), b: n(1), r: cl.r, l: cl.l, emf: 0, iprev: 0, relay: true, on: false, ion: cl.ion, ioff: cl.ioff, part: p });
        add({ type: 'S', a: n(2), b: n(3), closed: false, part: p, sub: 'NO', upd() { this.closed = rl.on; } });
        add({ type: 'S', a: n(2), b: n(4), closed: true, part: p, sub: 'NC', upd() { this.closed = !rl.on; } });
        break; }
      case 'THY': {
        const gd = add({ type: 'D', a: n(2), b: n(1), is: 1e-9, nn: 1.8, part: p, vj: 0, sub: 'G' });
        add({ type: 'THY', a: n(0), b: n(1), on: false, gd, part: p, sub: 'AK' });
        break; }
      case 'TRF': {
        const m = String(p.v || '230V:12V').replace(',', '.').match(/([0-9.]+)\s*V?\s*[:/]\s*([0-9.]+)/), vp = m ? parseFloat(m[1]) : 230, vs = m ? parseFloat(m[2]) : 12, nr = vp / vs;
        const L1 = Math.max(vp / 9.4, 0.05), L2 = L1 / (nr * nr), M = 0.99 * Math.sqrt(L1 * L2), r1 = 0.01 * vp * vp, r2 = r1 / (nr * nr);
        add({ type: 'TRF', a: n(0), b: n(1), c: n(2), d: n(3), L1, L2, M, r1, r2, i1p: 0, i2p: 0, i1: 0, i2: 0, part: p });
        break; }
      case 'PHT': add({ type: 'CCS', a: n(0), b: n(1), ictl: 0, part: p, upd() { this.ictl = (this.part.pos == null ? 0.5 : this.part.pos) * 5e-3; } }); break;
      case 'OPTO': {
        const vf = 1.25, is = 0.01 * Math.exp(-vf / (2 * VT));
        const led = add({ type: 'D', a: n(0), b: n(1), is, nn: 2, led: true, color: 'rot', imax: 0.06, part: p, vj: 0, sub: 'LED' });
        add({ type: 'CCS', a: n(2), b: n(3), ictl: 0, part: p, sub: 'T', upd() { this.ictl = Math.min(0.05, 0.5 * Math.max(0, led.i || 0)); } });
        break; }
      case 'SEG7': {
        const vr = String(p.vr || 'mk');
        if (vr[0] === 'd') { warnings.push({ part: p, text: 'Doppelanzeige wird noch nicht simuliert (Pinbelegung ungeprüft)' }); break; }
        const anode = vr[1] === 'a', map = [4, 3, -1, 2, 7, 1, 0, -1, 5, 6], vf = LEDVF.rot, is = 0.01 * Math.exp(-vf / (2 * VT));
        add({ type: 'R', a: n(2), b: n(7), g: 1e3, part: p, sub: 'com' });
        for (let i = 0; i < 10; i++) {
          if (map[i] < 0) continue;
          add({ type: 'D', a: anode ? n(2) : n(i), b: anode ? n(i) : n(2), is, nn: 2, led: true, color: 'rot', imax: 0.04, part: p, vj: 0, seg: map[i], sub: 's' + map[i] });
        }
        break; }
      case 'MCU': {
        const nd = []; for (let i = 0; i < 26; i++) nd.push(n(i));
        const m = { mode: new Array(20).fill(0), out: new Array(20).fill(0), duty: new Array(20).fill(null), tone: new Array(20).fill(null), level: new Array(20).fill(0), lastDig: new Array(20).fill(0), pulse: {}, servo: {}, pinI: new Array(20).fill(0), burnt: false };
        const pn = q => (q < 14 ? 10 + q : 4 + (q - 14));
        const el = add({ type: 'MCU', nd, mcu: m, part: p, pi: Array.from({ length: 26 }, (_, i) => i) });
        el.tick = function (t) {
          for (let q = 0; q < 20; q++) {
            if (m.mode[q] !== 1) { m.level[q] = 0; continue; }
            const tn = m.tone[q];
            if (tn) { if (tn.until != null && t >= tn.until) { m.tone[q] = null; m.level[q] = m.out[q]; } else { m.level[q] = ((t * tn.f) % 1) < 0.5 ? 1 : 0; continue; } }
            if (m.duty[q] != null) { const fq = (q === 5 || q === 6) ? 980 : 490, dd = m.duty[q]; m.level[q] = dd <= 0 ? 0 : (dd >= 255 ? 1 : (((t * fq) % 1) < dd / 255 ? 1 : 0)); }
            else m.level[q] = m.out[q];
          }
        };
        el.pinNode = pn;
        break; }
      case 'PI40': {
        const nd = []; for (let i = 0; i < 40; i++) nd.push(n(i));
        const PHYS = { 2: 3, 3: 5, 4: 7, 14: 8, 15: 10, 17: 11, 18: 12, 27: 13, 22: 15, 23: 16, 24: 18, 10: 19, 9: 21, 25: 22, 11: 23, 8: 24, 7: 26, 0: 27, 1: 28, 5: 29, 6: 31, 12: 32, 13: 33, 19: 35, 16: 36, 26: 37, 20: 38, 21: 40 };
        const m = { npin: 28, isPi: true, mode: new Array(28).fill(0), out: new Array(28).fill(0), duty: new Array(28).fill(null), tone: new Array(28).fill(null), level: new Array(28).fill(0), lastDig: new Array(28).fill(0), pulse: {}, servo: {}, pinI: new Array(28).fill(0), burnt: false };
        const el = add({ type: 'PI40', nd, mcu: m, part: p, npin: 28 });
        el.pinNode = g => PHYS[g] - 1; el.hasPin = g => PHYS[g] != null;
        el.tick = function (t) {
          for (let q = 0; q < 28; q++) {
            if (m.mode[q] !== 1) { m.level[q] = 0; continue; }
            if (m.duty[q] != null) { const dd = m.duty[q]; m.level[q] = dd <= 0 ? 0 : (dd >= 1 ? 1 : (((t * 1000) % 1) < dd ? 1 : 0)); }
            else m.level[q] = m.out[q];
          }
        };
        break; }
      case 'MCP3008': { const nd = []; for (let i = 0; i < 16; i++) nd.push(n(i)); add({ type: 'ADC', nd, part: p }); break; }
      case 'I2CTEMP': case 'I2CLUX': { add({ type: 'I2C', dev: k, nd: [n(0), n(1), n(2), n(3)], part: p, st: { ptr: 0, mode: null } }); break; }
      case 'RGBLED': {
        const ck = ['rot', 'grün', 'blau'];
        ['r', 'g', 'b'].forEach((sub, i) => { const vf = LEDVF[ck[i]], is = 0.01 * Math.exp(-vf / (2 * VT)); add({ type: 'D', a: n(i), b: n(3), is, nn: 2, led: true, color: ck[i], imax: 0.03, part: p, vj: 0, sub }); });
        break; }
      case 'PIEZO': add({ type: 'PZ', a: n(0), g: n(1), part: p }); break;
      case 'TOUCH': add({ type: 'TCH', a: n(0), part: p }); break;
      case 'TMP36': case 'PIR': case 'HCSR04': {
        const dev = k;
        const pins4 = dev === 'HCSR04';
        const el = add({ type: 'SENS', dev, vcc: n(0), a: n(1), c: pins4 ? n(2) : -1, g: n(pins4 ? 3 : 2), part: p, outV: 0, echo: { start: -1, len: 0 }, lastEcho: null });
        el.tick = function (t) {
          const pos = this.part.pos == null ? 0.5 : this.part.pos, vv = (this.v0 && this.v0.get) ? 0 : 0;
          if (dev === 'TMP36') this.tC = -40 + 165 * pos;
          if (dev === 'HCSR04') {
            this.cm = 2 + pos * 398;
            const m = this.mcuTrig; if (m) { const pl = m.mcu.pulse[m.pin]; if (pl && pl.fall != null && !pl.used) { pl.used = true; if (pl.fall - pl.rise >= 8e-6 && this.powered) { this.echo.start = pl.fall + 200e-6; this.echo.len = this.cm * 58e-6; this.lastEcho = null; this.echoDone = false; } } }
            if (this.echo.len && t >= this.echo.start + this.echo.len && !this.echoDone) { this.echoDone = true; this.lastEcho = this.echo.len * 1e6; }
          }
        };
        break; }
      case 'SERVO': add({ type: 'SERVOD', sig: n(0), vcc: n(1), g: n(2), part: p }); break;
      case 'LCDI2C': add({ type: 'LCDD', g: n(0), vcc: n(1), sda: n(2), scl: n(3), part: p }); break;
      case 'NETZ3': {
        const u = Math.max(si(p.v, 400), 1), uph = u / Math.sqrt(3);
        for (let i = 0; i < 3; i++) add({ type: 'V', a: n(i), b: n(3), v0: 0, amp: uph * 1.4142, freq: 50, rint: 0.3, wave: 'sin', phase0: -i / 3, part: p, sub: 'L' + (i + 1) });
        add({ type: 'R', a: n(3), b: n(4), g: 1e3, part: p, sub: 'pe' });
        break; }
      case 'MOTOR3': {
        if (p.pins.length > 3) bodyFault(p, 3, true);
        const q = String(p.v || '400V 2.2kW').replace(',', '.'), mu = q.match(/([0-9.]+)\s*V/), mp = q.match(/([0-9.]+)\s*(k?)W/), dlt = /(^|\s)D(\s|$)|Δ|dreieck/i.test(q);
        const U = mu ? parseFloat(mu[1]) : 400, P = mp ? parseFloat(mp[1]) * (mp[2] ? 1000 : 1) : 2200;
        const uph = dlt ? U : U / Math.sqrt(3), Z = uph * uph / (P / 0.8 / 3), R = Z * 0.8, L = Z * 0.6 / 314.16, star = dlt ? null : nodeOfRoot('mstar' + p.id);
        const w = [[0, 1], [1, 2], [2, 0]];
        for (let i = 0; i < 3; i++) {
          const el = add({ type: 'RL', a: n(dlt ? w[i][0] : i), b: dlt ? n(w[i][1]) : star, r: R, l: L, emf: 0, iprev: 0, part: p, sub: 'w' + i });
          if (i === 0) el.m3 = { inom: uph / Z, i2: null };
        }
        break; }
      case 'BRUECKE':
        add({ type: 'D', a: n(0), b: n(2), is: 1e-9, nn: 1.8, part: p, vj: 0, vmax: 1000, sub: 'd1' });
        add({ type: 'D', a: n(1), b: n(2), is: 1e-9, nn: 1.8, part: p, vj: 0, vmax: 1000, sub: 'd2' });
        add({ type: 'D', a: n(3), b: n(0), is: 1e-9, nn: 1.8, part: p, vj: 0, vmax: 1000, sub: 'd3' });
        add({ type: 'D', a: n(3), b: n(1), is: 1e-9, nn: 1.8, part: p, vj: 0, vmax: 1000, sub: 'd4' });
        break;
      case 'SEG8': {
        const ca = /a/i.test(String(p.vr || '')), vf = LEDVF.rot, is = 0.01 * Math.exp(-vf / (2 * VT));
        for (let i = 0; i < 8; i++) add({ type: 'D', a: ca ? n(8) : n(i), b: ca ? n(i) : n(8), is, nn: 2, led: true, color: 'rot', imax: 0.04, part: p, vj: 0, seg: i, sub: 's' + i });
        break; }
      case 'NETZ': {
        const u = Math.max(si(p.v, 230), 1);
        add(p.vr === 'ac' ? { type: 'V', a: n(0), b: n(1), v0: 0, amp: u * 1.4142, freq: 50, rint: 0.3, wave: 'sin', part: p } : { type: 'V', a: n(0), b: n(1), v0: u, rint: 0.3, wave: 'dc', imax: 0, part: p });
        add({ type: 'R', a: n(1), b: n(2), g: 1e3, part: p, sub: 'pe' });
        break; }
      case 'LSS': {
        const ir = Math.max(si(String(p.v || 'B16').replace(/^[A-Za-z]+/, ''), 16), 1), mag = /^C/i.test(p.v || '') ? 10 : 5;
        add({ type: 'S', a: n(0), b: n(1), closed: !!p.sw, part: p, trip: { ir, mag, h: 0 }, upd() { this.closed = !!this.part.sw; } });
        break; }
      case 'RCD': add({ type: 'RCD', a: n(0), b: n(1), c: n(2), d: n(3), closed: !!p.sw, part: p, i: 0, iN: 0, upd() { this.closed = !!this.part.sw; } }); break;
      case 'KREUZ':
        add({ type: 'S', a: n(0), b: n(2), closed: true, part: p, sub: 'a', upd() { this.closed = !this.part.sw; } });
        add({ type: 'S', a: n(1), b: n(3), closed: true, part: p, sub: 'b', upd() { this.closed = !this.part.sw; } });
        add({ type: 'S', a: n(0), b: n(3), closed: false, part: p, sub: 'c', upd() { this.closed = !!this.part.sw; } });
        add({ type: 'S', a: n(1), b: n(2), closed: false, part: p, sub: 'd', upd() { this.closed = !!this.part.sw; } });
        break;
      case 'SCHUETZ': {
        const un = Math.max(si(p.v, 230), 1), cl = coil(un, 3, 0.02);
        const rl = add({ type: 'RL', a: n(0), b: n(1), r: cl.r, l: cl.l, emf: 0, iprev: 0, relay: true, on: false, ion: cl.ion, ioff: cl.ioff, part: p });
        add({ type: 'S', a: n(2), b: n(3), closed: false, part: p, sub: 'a1', upd() { this.closed = rl.on; } });
        add({ type: 'S', a: n(4), b: n(5), closed: true, part: p, sub: 'a2', upd() { this.closed = !rl.on; } });
        add({ type: 'S', a: n(6), b: n(7), closed: false, part: p, sub: 'h1', upd() { this.closed = rl.on; } });
        add({ type: 'S', a: n(8), b: n(9), closed: false, part: p, sub: 'h2', upd() { this.closed = rl.on; } });
        break; }
      case 'IMP': {
        const un = Math.max(si(p.v, 230), 1), cl = coil(un, 2, 0.01);
        const rl = add({ type: 'RL', a: n(0), b: n(1), r: cl.r, l: cl.l, emf: 0, iprev: 0, relay: true, imp: true, on: false, latch: false, ion: cl.ion * 0.9, ioff: cl.ioff, part: p });
        add({ type: 'S', a: n(2), b: n(3), closed: false, part: p, sub: 'K', upd() { this.closed = rl.latch; } });
        break; }
      case 'SD': {
        const w = si(String(p.v || '').replace(/\s*W$/i, ''), 0);
        if (w > 0) add({ type: 'R', a: n(0), b: n(1), g: w / (230 * 230), part: p, device: true });
        add({ type: 'S', a: n(0), b: n(2), closed: !!p.sw, ron: 3300, part: p, sub: 'fault', upd() { this.closed = !!this.part.sw; } });
        break; }
      case 'FAULT': add({ type: 'S', a: n(0), b: n(1), closed: !!p.sw, ron: Math.max(si(p.v, 3300), 1), part: p, upd() { this.closed = !!this.part.sw; } }); break;
      case 'JUN': for (let i = 1; i < pins.length; i++) add({ type: 'R', a: n(0), b: n(i), g: 1e3, part: p, sub: 'j' + i }); break;
      case 'SPST': add({ type: 'S', a: n(0), b: n(1), closed: !!p.sw, part: p, upd() { this.closed = !!this.part.sw; } }); break;
      case 'ZD': {
        const vz = Math.max(si(p.v, 5.1), 1);
        add({ type: 'D', a: n(0), b: n(1), is: 1e-9, nn: 1.8, vz, part: p, vj: 0 });
        break; }
      case 'BZ': add({ type: 'R', a: n(0), b: n(1), g: 1 / 100, part: p, buzzer: true }); break;
      case 'C': case 'CE': case 'CF': add({ type: 'C', a: n(0), b: n(1), c: Math.max(si(p.v, 100e-9), 1e-15), part: p, vprev: 0, vmax: ((String(p.v).match(/(\d+(?:\.\d+)?)\s*V/) || [])[1] * 1) || (k === 'CE' ? 35 : (k === 'CF' ? 250 : 100)) }); break;
      case 'L': add({ type: 'L', a: n(0), b: n(1), l: Math.max(si(p.v, 10e-6), 1e-9), part: p, iprev: 0 }); break;
      case 'D': {
        const z = /z/i.test(p.v || '') || /^[0-9]+V[0-9]?$/.test(String(p.v || '').trim());
        if (z) {
          const m = String(p.v).match(/([0-9]+)V([0-9])?/);
          const vz = m ? parseFloat(m[1] + (m[2] ? '.' + m[2] : '')) : 5.1;
          add({ type: 'D', a: n(0), b: n(1), is: 1e-9, nn: 1.8, vz, part: p, vj: 0, vjz: 0 });
        } else {
          const schottky = /5819|BAT|SB|SS/i.test(p.v || '');
          add({ type: 'D', a: n(0), b: n(1), is: schottky ? 1e-6 : 1e-9, nn: schottky ? 1.1 : 1.8, part: p, vj: 0, vmax: /4007|5408|4004/.test(p.v || '') ? 1000 : (schottky ? 40 : 100) });
        }
        break; }
      case 'LED': {
        const ck = ledKey(p.v), vf = LEDVF[ck], nl = 2, is = 0.01 * Math.exp(-vf / (nl * VT));
        add({ type: 'D', a: n(0), b: n(1), is, nn: nl, led: true, color: ck, imax: LEDIMAX[p.vr || '5'] || 0.06, part: p, vj: 0 });
        break; }
      case 'BAT': {
        const v = si(p.v, 9);
        const r = p.vr === 'psu' ? 0.1 : (v <= 2 ? 0.3 : 0.6);
        add({ type: 'V', a: n(0), b: n(1), v0: v, rint: r, wave: 'dc', imax: si(p.imax || (p.item && p.item.imax), 0) || 0, part: p });
        break; }
      case 'SIG': {
        const g = parseGen(p.v);
        add({ type: 'V', a: n(0), b: n(1), v0: 0, amp: g.amp, freq: g.freq, rint: 50, wave: p.vr === 'sq' ? 'sq' : (p.vr === 'tri' ? 'tri' : 'sin'), part: p });
        break; }
      case 'P': case 'TP': {
        const rt = Math.max(si(p.v, 10000), 1), pos = Math.min(Math.max(p.pos == null ? 0.5 : p.pos, 0.001), 0.999);
        const pp = q => Math.min(Math.max(q == null ? 0.5 : q, 0.001), 0.999);
        add({ type: 'R', a: n(0), b: n(1), g: 1 / (rt * pos), part: p, sub: 'AW', upd() { this.g = 1 / (rt * pp(this.part.pos)); } });
        add({ type: 'R', a: n(1), b: n(2), g: 1 / (rt * (1 - pos)), part: p, sub: 'WB', upd() { this.g = 1 / (rt * (1 - pp(this.part.pos))); } });
        break; }
      case 'SWNC': add({ type: 'S', a: n(0), b: n(1), closed: !p.pressed, part: p, upd() { this.closed = !this.part.pressed; } }); break;
      case 'SW': {
        const prs = !!p.pressed;
        const up = function () { this.closed = !!this.part.pressed; };
        if (pins.length === 2) add({ type: 'S', a: n(0), b: n(1), closed: prs, part: p, upd: up });
        else {
          add({ type: 'S', a: n(0), b: n(2), closed: true, part: p, fixed: true });
          add({ type: 'S', a: n(1), b: n(3), closed: true, part: p, fixed: true });
          add({ type: 'S', a: n(0), b: n(1), closed: prs, part: p, upd: up });
        }
        break; }
      case 'SCH': {
        const on = !!p.sw;
        const lo = function () { this.closed = !this.part.sw; }, hi = function () { this.closed = !!this.part.sw; };
        add({ type: 'S', a: n(1), b: n(0), closed: !on, part: p, upd: lo });
        add({ type: 'S', a: n(1), b: n(2), closed: on, part: p, upd: hi });
        if (pins.length === 6) {
          add({ type: 'S', a: n(4), b: n(3), closed: !on, part: p, upd: lo });
          add({ type: 'S', a: n(4), b: n(5), closed: on, part: p, upd: hi });
        }
        break; }
      case 'DSW': {
        const h = pins.length / 2;
        for (let i = 0; i < h; i++) add({ type: 'S', a: n(i), b: n(pins.length - 1 - i), closed: !!((p.sw || 0) >> i & 1), part: p, idx: i, upd() { this.closed = !!(((this.part.sw || 0) >> this.idx) & 1); } });
        break; }
      case 'T': {
        const vr = p.vr || 'npn-cbe', pnp = vr.startsWith('pnp'), ebc = vr.endsWith('ebc');
        const c = ebc ? n(2) : n(0), b = n(1), e = ebc ? n(0) : n(2);
        add({ type: 'Q', c, b, e, s: pnp ? -1 : 1, is: 1e-14, bf: 250, br: 4, part: p, vbe: 0, vbc: 0 });
        break; }
      case 'U': {
        const vset = REGV[String(p.v || '').toUpperCase().replace(/[^A-Z0-9]/g, '')] || 5;
        add({ type: 'REG', ni: n(0), ng: n(1), no: n(2), vset, part: p, vtar: 0 });
        break; }
      case 'GATE': add(ICS.makeIdeal(p, n, 'gate')); break;
      case 'DFF': add(ICS.makeIdeal(p, n, 'dff')); break;
      case 'OPA': add(ICS.make({ key: 'opa', fam: 'oa' }, p, n)); break;
      case 'IC': {
        const def = ICS && ICS.find(p.v);
        if (!def) { warnings.push({ part: p, text: 'IC-Typ wird nicht erkannt (Wert z. B. NE555, 7400, 4017, LM358)' }); break; }
        const need = ICS.CATALOG[def.key].np;
        if (need !== pins.length) { warnings.push({ part: p, text: 'Pinzahl passt nicht: ' + def.key + ' hat ' + need + ' Pins' }); break; }
        add(ICS.make(def, p, n));
        break; }
      default:
        if (['NANO', 'UNO'].includes(k)) warnings.push({ part: p, text: 'wird nicht simuliert' });
    }
    if (p.defect) for (let i = elemStart; i < elems.length; i++) elems[i].defect = p.defect;
  });

  // Eingänge, an denen sonst nichts hängt, sind „offen“ (TTL: High, CMOS: undefiniert -> Low)
  const touch = new Array(nn + 1).fill(0);
  elems.forEach(e => {
    if (e.type === 'IC') { for (let i = 1; i <= e.np; i++) touch[e.n[i]]++; }
    else ['a', 'b', 'c', 'e', 'ni', 'ng', 'no'].forEach(f => { if (typeof e[f] === 'number') touch[e[f]]++; });
  });
  elems.forEach(e => { if (e.type === 'IC') for (let i = 1; i <= e.np; i++) e.fl[i] = e.n[i] > 0 && touch[e.n[i]] === 1; });
  // Verknüpfung: Welcher Arduino-Pin hängt am selben Knoten wie ein Sensor-/Servo-/LCD-Anschluss?
  const mcuEl = elems.find(e => e.type === 'MCU' || e.type === 'PI40');
  const mcuPinOf = node => { if (!mcuEl || node <= 0) return -1; const np = mcuEl.mcu.npin || 20; for (let q = 0; q < np; q++) { if (mcuEl.type === 'PI40' && !mcuEl.hasPin(q)) continue; if (mcuEl.nd[mcuEl.pinNode(q)] === node) return q; } return -1; };
  elems.forEach(e => {
    if (!mcuEl) return;
    const viaR = node => { let q = mcuPinOf(node); if (q >= 0) return q; for (const r of elems) { if (r.type !== 'R' || r.meter || r.led) continue; const other = r.a === node ? r.b : (r.b === node ? r.a : null); if (other != null && other > 0) { const qq = mcuPinOf(other); if (qq >= 0) return qq; } } return -1; };
    if (e.type === 'SENS' && e.dev === 'HCSR04') { const tp = mcuPinOf(e.a), ep = viaR(e.c); e.mcuTrig = tp >= 0 ? { mcu: mcuEl.mcu, pin: tp } : null; e.echoPin = ep; }
    if (e.type === 'SERVOD') e.pin = mcuPinOf(e.sig);
    if (e.type === 'ADC') e.spi = { clk: mcuPinOf(e.nd[4]), miso: mcuPinOf(e.nd[5]), mosi: mcuPinOf(e.nd[6]), cs: mcuPinOf(e.nd[7]) };
    if (e.type === 'I2C') e.bus = { sda: mcuPinOf(e.nd[1]), scl: mcuPinOf(e.nd[2]) };
    if (e.type === 'LCDD') e.ok = mcuPinOf(e.sda) === 18 && mcuPinOf(e.scl) === 19;
  });
  // Weitere Spannungsquellen ohne Masse-Bezug (zum Beispiel ein zweiter Stromkreis, der Last von der Steuerung trennt):
  // Minuspol mit sehr hohem Widerstand an Masse legen, damit der Kreis rechenbar ist
  if (groundRoot !== null) { const tied = new Set([find(groundRoot)]); layout.parts.forEach(p => { if ((p.k === 'BAT' || p.k === 'SIG') && p.pins.length > 1) { const r = find(pinKey(p, 1)); if (!tied.has(r)) { tied.add(r); add({ type: 'R', a: nodeOfRoot(r), b: 0, g: 1e-9 }); } } }); }
  return { nn, elems, nodeOfKey, groundKnown: groundRoot !== null, warnings, parts: layout.parts, mcu: mcuEl || null };
}

/* ---------- Lösen ---------- */
function solve(A, z, n) {
  for (let c = 0; c < n; c++) {
    let p = c, mx = Math.abs(A[c][c]);
    for (let r = c + 1; r < n; r++) { const a = Math.abs(A[r][c]); if (a > mx) { mx = a; p = r; } }
    if (mx < 1e-300) return false;
    if (p !== c) { const t = A[p]; A[p] = A[c]; A[c] = t; const tz = z[p]; z[p] = z[c]; z[c] = tz; }
    const d = A[c][c], row = A[c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / d; if (f === 0) continue;
      const rr = A[r];
      for (let j = c; j < n; j++) rr[j] -= f * row[j];
      z[r] -= f * z[c];
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = z[r]; const row = A[r];
    for (let j = r + 1; j < n; j++) s -= row[j] * z[j];
    z[r] = s / row[r];
  }
  return true;
}

function waveform(e, t) {
  if (e.wave === 'dc') return e.v0;
  const ph = (((t * e.freq + (e.phase0 || 0)) % 1) + 1) % 1;
  if (e.wave === 'sin') return e.v0 + e.amp * Math.sin(2 * Math.PI * ph);
  if (e.wave === 'sq') return e.v0 + (ph < 0.5 ? e.amp : -e.amp);
  return e.v0 + e.amp * (ph < 0.5 ? (4 * ph - 1) : (3 - 4 * ph));
}

function createSim(circ) {
  const N = circ.nn, elems = circ.elems;
  const A = Array.from({ length: N }, () => new Float64Array(N));
  const z = new Float64Array(N);
  const v = new Float64Array(N + 1);
  const sim = { t: 0, v, circ, events: [], N };
  const burnt = new Set();
  sim.burnt = burnt;

  function stampG(a, b, g) {
    if (a > 0) A[a - 1][a - 1] += g;
    if (b > 0) A[b - 1][b - 1] += g;
    if (a > 0 && b > 0) { A[a - 1][b - 1] -= g; A[b - 1][a - 1] -= g; }
  }
  const cur = (a, b, ieq) => { if (a > 0) z[a - 1] -= ieq; if (b > 0) z[b - 1] += ieq; };       // Element-Strom a->b hat konstanten Anteil ieq
  const inj = (a, i) => { if (a > 0) z[a - 1] += i; };                                           // Strom in Knoten a hinein
  const addA = (r, c, val) => { if (r > 0 && c > 0) A[r - 1][c - 1] += val; };
  const vd = (a, b) => v[a] - v[b];
  const S = { stampG, inj, addA, rhs: (r, val) => { if (r > 0) z[r - 1] += val; } };

  function diodeEval(e, vj) {
    const nvt = e.nn * VT;
    const ex = expSafe(vj / nvt);
    let i = e.is * (ex - 1), g = e.is / nvt * ex;
    if (e.vz) {
      const nz = 1.2 * VT, vz2 = e.vz - 0.45;
      const w = (-vj - vz2) / nz, ez = expSafe(w);
      i -= 1e-9 * ez; g += 1e-9 / nz * ez;
    }
    return { i, g: g + GMIN };
  }

  sim.step = function (dt) {
    const t = sim.t + dt;
    let converged = false;
    for (const e of elems) if (e.upd) e.upd();
    for (const e of elems) if (e.tick) e.tick(t, dt);
    const prev = Float64Array.from(v);
    for (const e of elems) if (e.type === 'IC' && !burnt.has(e.part.id)) e.icupd(prev, dt);
    for (let it = 0; it < 80; it++) {
      for (let r = 0; r < N; r++) { A[r].fill(0); z[r] = 0; A[r][r] = GMIN; }
      let limited = false;
      for (const e of elems) {
        if (e.part && burnt.has(e.part.id) && (e.type !== 'S')) { if (e.type === 'V') {} else continue; }
        if (e.defect === 'open' && e.type !== 'V') continue;
        if (e.defect === 'short' && e.b !== undefined && e.type !== 'V' && e.type !== 'TRF' && e.type !== 'RCD') { stampG(e.a, e.b, 1e3); continue; }
        switch (e.type) {
          case 'R': stampG(e.a, e.b, e.g); break;
          case 'S': stampG(e.a, e.b, e.closed ? 1 / (e.ron || RON) : 1 / ROFF); break;
          case 'RCD': { const g = e.closed ? 1 / RON : 1 / ROFF; stampG(e.a, e.c, g); stampG(e.b, e.d, g); break; }
          case 'C': { const g = e.c / dt; stampG(e.a, e.b, g); inj(e.a, g * e.vprev); inj(e.b, -g * e.vprev); break; }
          case 'L': { const g = dt / e.l; stampG(e.a, e.b, g); cur(e.a, e.b, e.iprev); break; }
          case 'V': {
            const g = 1 / e.rint, vs = waveform(e, t);
            if (e.imax > 0) {                                                   // Strombegrenzung (CC): Modus linear oder konstanter Strom
              const x = (vs - vd(e.a, e.b)) * g; let cm = e.cm || 0;
              if (cm === 0) { if (Math.abs(x) > e.imax) { cm = x > 0 ? 1 : -1; limited = true; } }
              else if (cm * x < e.imax) { cm = 0; limited = true; }
              e.cm = cm;
              if (cm) { stampG(e.a, e.b, GMIN); inj(e.a, cm * e.imax); inj(e.b, -cm * e.imax); } else { stampG(e.a, e.b, g); inj(e.a, vs * g); inj(e.b, -vs * g); }
            } else { stampG(e.a, e.b, g); inj(e.a, vs * g); inj(e.b, -vs * g); }
            break; }
          case 'D': {
            const nvt = e.nn * VT, vc = vcrit(e.is, nvt);
            let vj = vd(e.a, e.b);
            const lim = pnjlim(vj, e.vj, nvt, vc);
            if (lim !== vj) limited = true;
            vj = lim; e.vj = vj;
            const ev = diodeEval(e, vj);
            stampG(e.a, e.b, ev.g); cur(e.a, e.b, ev.i - ev.g * vj);
            break; }
          case 'Q': {
            const s = e.s, vtq = VT, vc = vcrit(e.is, vtq);
            let vbe = s * vd(e.b, e.e), vbc = s * vd(e.b, e.c);
            const lbe = pnjlim(vbe, e.vbe, vtq, vc), lbc = pnjlim(vbc, e.vbc, vtq, vc);
            if (lbe !== vbe || lbc !== vbc) limited = true;
            vbe = lbe; vbc = lbc; e.vbe = vbe; e.vbc = vbc;
            const ebe = expSafe(vbe / vtq), ebc = expSafe(vbc / vtq);
            const ibe = e.is * (ebe - 1), ibc = e.is * (ebc - 1);
            const gbe = e.is / vtq * ebe + GMIN, gbc = e.is / vtq * ebc + GMIN;
            const ieBe = ibe - gbe * vbe, ieBc = ibc - gbc * vbc;
            const rows = [[e.c, 1, -(1 + 1 / e.br)], [e.b, 1 / e.bf, 1 / e.br], [e.e, -(1 + 1 / e.bf), 1]];
            for (const [r, ae, ac] of rows) {
              addA(r, e.b, ae * gbe + ac * gbc); addA(r, e.e, -ae * gbe); addA(r, e.c, -ac * gbc);
              if (r > 0) z[r - 1] -= s * (ae * ieBe + ac * ieBc);
            }
            break; }
          case 'MCU': {
            const m = e.mcu;
            stampG(e.nd[0], 0, 2); inj(e.nd[0], 10); stampG(e.nd[25], 0, 2); inj(e.nd[25], 10); stampG(e.nd[1], 0, 1); inj(e.nd[1], 3.3); stampG(e.nd[3], 0, 1e3); stampG(e.nd[24], 0, 1e3); stampG(e.nd[2], 0, 1e-9);
            for (let q = 0; q < 20; q++) {
              const nd = e.nd[e.pinNode(q)];
              if (m.mode[q] === 1) { stampG(nd, 0, 1 / 25); if (m.level[q]) inj(nd, 5 / 25); }
              else if (m.mode[q] === 2) { stampG(nd, 0, 1 / 30000); inj(nd, 5 / 30000); }
              else stampG(nd, 0, 1e-9);
            }
            break; }
          case 'PI40': {
            const m = e.mcu; [0, 16].forEach(i => { stampG(e.nd[i], 0, 1); inj(e.nd[i], 3.3); }); [1, 3].forEach(i => { stampG(e.nd[i], 0, 1); inj(e.nd[i], 5); });
            for (let q = 0; q < 28; q++) {
              if (e.pinNode(q) == null || isNaN(e.pinNode(q))) continue; const nd = e.nd[e.pinNode(q)];
              if (m.mode[q] === 1) { stampG(nd, 0, 1 / 30); if (m.level[q]) inj(nd, 3.3 / 30); }
              else if (m.mode[q] === 2) { stampG(nd, 0, 1 / 50000); inj(nd, 3.3 / 50000); }
              else if (m.mode[q] === 3) stampG(nd, 0, 1 / 50000);
              else stampG(nd, 0, 1e-9);
            }
            break; }
          case 'ADC': { stampG(e.nd[0], e.nd[3], 1 / 6000); for (let i = 8; i < 16; i++) stampG(e.nd[i], e.nd[2], 1e-8); for (let i = 1; i < 8; i++) stampG(e.nd[i], 0, 1e-9); break; }
          case 'I2C': { stampG(e.nd[0], e.nd[3], 1 / 8000); stampG(e.nd[1], 0, 1e-9); stampG(e.nd[2], 0, 1e-9); break; }
          case 'PZ': { const pz = e.part.pos || 0, vo = pz * 5, gg = 1 / 2000; stampG(e.a, e.g, gg); inj(e.a, vo * gg); inj(e.g, -vo * gg); e.vo = vo; break; }
          case 'TCH': stampG(e.a, 0, 1e-9); break;
          case 'SENS': {
            const vc = v[e.vcc] - v[e.g], pw = vc > (e.dev === 'PIR' ? 4.0 : 2.7); e.powered = pw;
            let drv = null;
            if (e.dev === 'TMP36') drv = pw ? [e.a, 0.5 + (e.tC || 25) / 100, 100] : null;
            else if (e.dev === 'PIR') drv = pw ? [e.a, (e.part.pos || 0) > 0.5 ? 3.3 : 0, 100] : null;
            else if (e.dev === 'HCSR04') { const high = pw && e.echo.len && t >= e.echo.start && t < e.echo.start + e.echo.len; drv = [e.c, high ? 5 : 0, 100]; if (!pw) drv = null; }
            stampG(e.vcc, e.g, pw ? 1 / 5000 : 1e-9);
            e.drive = drv ? { nd: drv[0], vo: drv[1], gg: 1 / drv[2] } : null;
            if (drv) { const [nd, vo, rr] = drv, gg = 1 / rr; stampG(nd, e.g, gg); inj(nd, vo * gg); inj(e.g, -vo * gg); }
            break; }
          case 'SERVOD': stampG(e.vcc, e.g, (v[e.vcc] - v[e.g]) > 3 ? 1 / 200 : 1e-9); stampG(e.sig, e.g, 1e-9); break;
          case 'LCDD': stampG(e.vcc, e.g, 1 / 1000); stampG(e.sda, e.g, 1e-9); stampG(e.scl, e.g, 1e-9); break;
          case 'RL': { const g = 1 / (e.r + e.l / dt + (e.mech ? 0 : 0)); stampG(e.a, e.b, g); cur(e.a, e.b, g * ((e.l / dt) * e.iprev - (e.emf || 0))); break; }
          case 'THY': { if (e.on) { stampG(e.a, e.b, 2); cur(e.a, e.b, -1.6); } else stampG(e.a, e.b, 1e-9); break; }
          case 'CCS': { const vce = vd(e.a, e.b), th = Math.tanh(vce / 0.3), i = e.ictl * th, gd = e.ictl / 0.3 * (1 - th * th) + GMIN; stampG(e.a, e.b, gd); cur(e.a, e.b, i - gd * vce); break; }
          case 'TRF': {
            const a11 = e.r1 + e.L1 / dt, a22 = e.r2 + e.L2 / dt, a12 = e.M / dt, det = a11 * a22 - a12 * a12;
            const y11 = a22 / det, y22 = a11 / det, y12 = -a12 / det;
            const b1 = (e.L1 * e.i1p + e.M * e.i2p) / dt, b2 = (e.M * e.i1p + e.L2 * e.i2p) / dt;
            const tg = (r1, r2, c1, c2, g) => { addA(r1, c1, g); addA(r1, c2, -g); addA(r2, c1, -g); addA(r2, c2, g); };
            tg(e.a, e.b, e.a, e.b, y11); tg(e.a, e.b, e.c, e.d, y12); tg(e.c, e.d, e.a, e.b, y12); tg(e.c, e.d, e.c, e.d, y22);
            cur(e.a, e.b, y11 * b1 + y12 * b2); cur(e.c, e.d, y12 * b1 + y22 * b2);
            e.y = [y11, y12, y22, y11 * b1 + y12 * b2, y12 * b1 + y22 * b2];
            break; }
          case 'IC': ICS.stamp(e, S, v); break;
          case 'REG': {
            const vin = v[e.ni] - v[e.ng];
            e.vtar = Math.max(0, Math.min(e.vset, vin - 2));
            const gout = 1 / 0.05;
            stampG(e.no, e.ng, gout); inj(e.no, e.vtar * gout); inj(e.ng, -e.vtar * gout);
            stampG(e.ni, e.ng, 1 / 1000);                                                          // Ruhestrom (~5 mA bei 5 V)
            break; }
        }
      }
      const x = Float64Array.from(z);
      const Ac = A.map(r => Float64Array.from(r));
      if (!solve(Ac, x, N)) break;
      let maxd = 0;
      for (let i = 0; i < N; i++) {
        const nv = x[i], d = Math.abs(nv - v[i + 1]);
        if (!(d <= maxd)) maxd = d;
        v[i + 1] = nv;
      }
      let vmaxabs = 0; for (let i = 1; i <= N; i++) vmaxabs = Math.max(vmaxabs, Math.abs(v[i]));
      if (!limited && maxd < 1e-6 + 1e-6 * vmaxabs) { converged = true; break; }
      if (!isFinite(maxd)) { v.set(prev); break; }
    }
    // Zustände übernehmen, Ströme berechnen
    for (const e of elems) {
      if (e.defect === 'open' && e.type !== 'V') { e.i = 0; if (e.type === 'Q') { e.ic = 0; e.ib = 0; } if (e.type === 'RL') e.iprev = 0; continue; }
      if (e.defect === 'short' && e.b !== undefined && e.type !== 'V' && e.type !== 'TRF' && e.type !== 'RCD') { e.i = (v[e.a] - v[e.b]) * 1e3; continue; }
      switch (e.type) {
        case 'MCU': {
          const m = e.mcu; if (burnt.has(e.part.id)) break;
          for (let q = 0; q < 20; q++) { if (m.mode[q] === 1) { const i = ((m.level[q] ? 5 : 0) - v[e.nd[e.pinNode(q)]]) / 25; m.pinI[q] = i; if (Math.abs(i) > 0.1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Arduino-Pin ' + (q < 14 ? 'D' + q : 'A' + (q - 14)) + ' überlastet (' + (Math.abs(i) * 1000).toFixed(0) + ' mA): Vorwiderstand vergessen?' }); break; } } else m.pinI[q] = 0; }
          { const t2 = new Array(26).fill(0); let sum = 0; for (let q = 0; q < 20; q++) { const idx = e.pinNode(q); t2[idx] = -m.pinI[q]; sum += t2[idx]; }
            const i5 = (5 - v[e.nd[0]]) * 2, i52 = (5 - v[e.nd[25]]) * 2, i33 = (3.3 - v[e.nd[1]]) * 1; t2[0] = -i5; t2[25] = -i52; t2[1] = -i33; sum += t2[0] + t2[25] + t2[1]; t2[3] = -sum; e.tI = t2; e.i = i5; }
          break; }
        case 'PI40': {
          const m = e.mcu; if (burnt.has(e.part.id)) break;
          for (let q = 0; q < 28; q++) {
            const nd = e.nd[e.pinNode(q)], vq = v[nd], name = 'GPIO' + q;
            if (vq > 3.8 || vq < -0.6) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Raspberry-Pi-Pin ' + name + ' bekam ' + vq.toFixed(1) + ' V: Die GPIO-Pins vertragen nur 3,3 V! Bei 5-V-Signalen (zum Beispiel Echo-Pin des Ultraschallsensors) gehört ein Spannungsteiler davor.' }); break; }
            if (m.mode[q] === 1) { const i = ((m.level[q] ? 3.3 : 0) - vq) / 30; m.pinI[q] = i; if (Math.abs(i) > 0.04) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Raspberry-Pi-Pin ' + name + ' überlastet (' + (Math.abs(i) * 1000).toFixed(0) + ' mA, empfohlen sind höchstens 16 mA): Vorwiderstand vergessen?' }); break; } } else m.pinI[q] = 0;
          }
          { const t2 = new Array(40).fill(0); let sum = 0; for (let q = 0; q < 28; q++) { const idx = e.pinNode(q); t2[idx] = -m.pinI[q]; sum += t2[idx]; }
            [0, 16].forEach(i => { const ii = (3.3 - v[e.nd[i]]); t2[i] = -ii; sum += -ii; }); [1, 3].forEach(i => { const ii = (5 - v[e.nd[i]]); t2[i] = -ii; sum += -ii; }); t2[5] = -sum; e.tI = t2; e.i = 0; }
          break; }
        case 'ADC': { const i = (v[e.nd[0]] - v[e.nd[3]]) / 6000, t2 = new Array(16).fill(0); t2[0] = i; t2[3] = -i; e.tI = t2; e.i = i; break; }
        case 'I2C': { const i = (v[e.nd[0]] - v[e.nd[3]]) / 8000; e.tI = [i, 0, 0, -i]; e.i = i; break; }
        case 'PZ': { const i = (e.vo - (v[e.a] - v[e.g])) / 2000; e.tI = [-i, i]; e.i = i; break; }
        case 'TCH': e.tI = [0]; e.i = 0; break;
        case 'SENS': {
          const dv = e.drive, ivcc = (v[e.vcc] - v[e.g]) / 5000, iOut = dv ? (dv.vo - (v[dv.nd] - v[e.g])) * dv.gg : 0, tI = e.c >= 0 ? [ivcc, 0, -iOut, -ivcc + iOut] : [ivcc, -iOut, -ivcc + iOut];
          if (dv && e.c >= 0 && dv.nd !== e.c) tI[2] = 0;
          e.tI = tI; e.i = ivcc; break; }
        case 'SERVOD': { const i = (v[e.vcc] - v[e.g]) > 3 ? (v[e.vcc] - v[e.g]) / 200 : 0; e.tI = [0, i, -i]; e.i = i; break; }
        case 'LCDD': { const i = (v[e.vcc] - v[e.g]) / 1000; e.tI = [-i, i, 0, 0]; e.i = i; break; }
        case 'RL': {
          if (e.part && burnt.has(e.part.id)) { e.i = 0; break; }
          if (e.m3) { const m = e.m3; const ei = e.i || 0; m.i2 = m.i2 == null ? ei * ei : m.i2 + (ei * ei - m.i2) * Math.min(1, dt / 0.03); const run = Math.sqrt(m.i2) > 0.4 * m.inom ? 157 : 0; e.w = (e.w || 0) + (run - (e.w || 0)) * Math.min(1, dt / 0.3); e.phase = (e.phase || 0) + e.w * dt; }
          const g = 1 / (e.r + e.l / dt); e.i = g * (v[e.a] - v[e.b] - (e.emf || 0) + (e.l / dt) * e.iprev); e.iprev = e.i;
          if (e.mech) {
            const m = e.mech; m.w = (m.w + dt * m.ke * e.i / m.J) / (1 + dt * (m.b + m.bx) / m.J); e.phase = (e.phase || 0) + m.w * dt; e.w = m.w;
            e.heat = Math.max(0, e.heat + dt * (e.i * e.i * e.r - 2.5) / 12);
            if (e.heat > 1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Motor überhitzt (blockiert)' }); }
          }
          if (e.relay) { e.ir2 = e.ir2 == null ? e.i * e.i : e.ir2 + (e.i * e.i - e.ir2) * Math.min(1, dt / 0.015); const ia = Math.sqrt(e.ir2); if (!e.on && ia > e.ion) { e.on = true; if (e.imp) e.latch = !e.latch; } else if (e.on && ia < e.ioff) e.on = false; }
          break; }
        case 'THY': {
          const vak = v[e.a] - v[e.b], ia = e.on ? (vak - 0.8) * 2 : 0; e.i = ia;
          if (!e.on && (e.gd.i || 0) > 2e-4 && vak > 0.6) e.on = true; else if (e.on && ia < 0.005) e.on = false;
          break; }
        case 'CCS': { const vce = v[e.a] - v[e.b]; e.i = e.ictl * Math.tanh(vce / 0.3); break; }
        case 'TRF': {
          const vp = v[e.a] - v[e.b], vs = v[e.c] - v[e.d], y = e.y; if (!y) break;
          e.i1 = y[0] * vp + y[1] * vs + y[3]; e.i2 = y[1] * vp + y[2] * vs + y[4]; e.i1p = e.i1; e.i2p = e.i2; e.i = e.i1;
          break; }
        case 'R': if (e.part && burnt.has(e.part.id)) { e.i = 0; break; }
          e.i = (v[e.a] - v[e.b]) * e.g;
          if (e.fuse) { const r = e.i / e.fuse.ir; e.heat = Math.max(0, e.heat + dt * (r * r - 1) / e.fuse.tau); e.hot = Math.min(1, e.heat); if (e.heat > 1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Sicherung hat ausgelöst' }); } }
          if (e.lamp) { const pw0 = e.i * e.i / e.g; e.pav = e.pav == null ? pw0 : e.pav + (pw0 - e.pav) * Math.min(1, dt / 0.02); const rt = e.pav / e.lamp; if (rt > 25) e.lh = 2; else e.lh = rt > 2.2 ? (e.lh || 0) + dt / 0.05 : Math.max(0, (e.lh || 0) - dt / 0.2); if (e.lh > 1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Glühlampe durchgebrannt' }); } }
          if (e.speaker && Math.abs(e.i * e.i / e.g) > 2) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Lautsprecher überlastet' }); }
          if (e.res && !burnt.has(e.part.id)) { const pw = e.i * e.i / e.g; e.power = pw; if (pw > 1.5) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Widerstand überlastet' }); } } break;
        case 'S': {
          e.i = (v[e.a] - v[e.b]) * (e.closed ? 1 / (e.ron || RON) : 1 / ROFF);
          if (e.trip && e.closed) {
            const r = Math.abs(e.i) / e.trip.ir; e.trip.h = Math.max(0, e.trip.h + dt * (r * r - 1.15) / 1);
            if (r > e.trip.mag * 1.4142 || e.trip.h > 1) { e.part.sw = 0; if (e.part.item) e.part.item.sw = 0; e.closed = false; e.trip.h = 0; sim.events.push({ kind: 'trip', part: e.part, text: 'Sicherungsautomat ausgelöst' + (r > e.trip.mag * 1.4142 ? ' (Kurzschluss)' : ' (Überlast)') }); }
          }
          break; }
        case 'RCD': {
          const g = e.closed ? 1 / RON : 1 / ROFF; e.i = (v[e.a] - v[e.c]) * g; e.iN = (v[e.b] - v[e.d]) * g; e.leak = e.i + e.iN;
          if (e.closed && Math.abs(e.leak) > 0.0424) { e.part.sw = 0; if (e.part.item) e.part.item.sw = 0; e.closed = false; sim.events.push({ kind: 'trip', part: e.part, text: 'FI-Schutzschalter ausgelöst (Fehlerstrom ' + (Math.abs(e.leak) * 1000).toFixed(0) + ' mA)' }); }
          break; }
        case 'C': { const vc = v[e.a] - v[e.b]; e.i = e.c / dt * (vc - e.vprev); e.vprev = vc; if (e.vmax && Math.abs(vc) > e.vmax * 1.2 && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Kondensator überspannt (' + vc.toFixed(0) + ' V bei ' + e.vmax + ' V)' }); } break; }
        case 'L': { const g = dt / e.l; e.i = e.iprev + g * (v[e.a] - v[e.b]); e.iprev = e.i; break; }
        case 'V': { const vs = waveform(e, t); let x = (vs - (v[e.a] - v[e.b])) / e.rint; if (e.imax > 0) { e.cc = !!e.cm; if (e.cm) x = e.cm * e.imax; } e.i = x; e.vs = vs; break; }
        case 'D': {
          if (burnt.has(e.part.id)) { e.i = 0; break; }
          const vj = v[e.a] - v[e.b], nvt = e.nn * VT;
          let i = e.is * (expSafe(vj / nvt) - 1);
          if (e.vz) i -= 1e-9 * expSafe((-vj - (e.vz - 0.45)) / (1.2 * VT));
          e.i = i;
          if (e.led) e.iav = e.iav == null ? i : e.iav + (i - e.iav) * Math.min(1, dt / 0.015);
          if (e.led && i > e.imax) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'LED durchgebrannt' }); }
          if (e.vmax && -vj > e.vmax * 1.1 && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Diode zerstört (Sperrspannung ' + (-vj).toFixed(0) + ' V zu hoch)' }); }
          break; }
        case 'Q': {
          const s = e.s, vbe = s * (v[e.b] - v[e.e]), vbc = s * (v[e.b] - v[e.c]);
          const ibe = e.is * (expSafe(vbe / VT) - 1), ibc = e.is * (expSafe(vbc / VT) - 1);
          e.ic = s * (ibe - (1 + 1 / e.br) * ibc); e.ib = s * (ibe / e.bf + ibc / e.br); e.i = e.ic;
          e.power = Math.abs(e.ic * (v[e.c] - v[e.e]));
          if ((e.power > 1.5 || Math.abs(v[e.c] - v[e.e]) > 70) && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: Math.abs(v[e.c] - v[e.e]) > 70 ? 'Transistor durchgeschlagen (Spannung zu hoch)' : 'Transistor überlastet' }); }
          break; }
        case 'REG': e.i = (e.vtar - (v[e.no] - v[e.ng])) / 0.05; break;
        case 'IC': {
          const vs = v[e.vcc] - v[e.gnd], lim = e.info.oa ? 45 : e.key[0] === '4' ? 20 : (e.key === '555' ? 18.5 : 7.5);
          e.i = vs * e.gq;
          if (vs > lim && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'IC durch Überspannung zerstört (' + vs.toFixed(1) + ' V)' }); }
          break; }
      }
    }
    elems.forEach(e => { if (e.sub === 'body') { if (e.closed && e.peFloating && !e.shock) { e.shock = true; sim.events.push({ kind: 'shock', part: e.part, text: 'Körperschluss ohne Schutzleiter: Das Gehäuse steht unter Spannung. Wer es berührt, bekommt einen lebensgefährlichen Schlag!' }); } else if (!e.closed) e.shock = false; } });
    sim.t = t; sim.converged = converged;
    return converged;
  };

  sim.volt = (node) => (node < 0 ? NaN : v[node]);
  sim.reset = () => { elems.forEach(e => { e.cm = 0; }); v.fill(0); sim.t = 0; sim.events.length = 0; burnt.clear(); elems.forEach(e => { if (e.type === 'C') e.vprev = 0; if (e.type === 'L') e.iprev = 0; if (e.type === 'RL') { e.iprev = 0; e.ir2 = null; e.heat = 0; e.on = false; e.latch = false; e.phase = 0; if (e.mech) e.mech.w = 0; } if (e.type === 'THY') e.on = false; if (e.type === 'TRF') { e.i1p = e.i2p = 0; } if (e.fuse) e.heat = 0; if (e.lamp) { e.lh = 0; e.pav = null; } if (e.type === 'D' || e.type === 'Q') { e.vj = 0; e.vbe = 0; e.vbc = 0; } }); };
  return sim;
}


/* I2C-Bus (Pi): Geräte-Modelle LM75 (Temperatur, 0x48) und BH1750 (Licht, 0x23). wr = zu schreibende Bytes, nrd = zu lesende Bytes. */
const I2C_ADDR = { I2CTEMP: 0x48, I2CLUX: 0x23 }, I2C_NAME = { I2CTEMP: 'LM75', I2CLUX: 'BH1750' };
function i2cXfer(circ, sim, addr, wr, nrd) {
  const hex = a => '0x' + a.toString(16).padStart(2, '0');
  const nack = hint => ({ err: '[Errno 121] Remote I/O error (das Gerät mit der Adresse ' + hex(addr) + ' antwortet nicht). Tipp: ' + hint });
  const devs = circ.elems.filter(x => x.type === 'I2C');
  if (!devs.length) return nack('Im Schaltplan ist kein I2C-Gerät.');
  const e = devs.find(x => I2C_ADDR[x.dev] === addr);
  if (!e) return nack('Die I2C-Geräte im Plan haben die Adresse ' + devs.map(x => hex(I2C_ADDR[x.dev])).join(' und ') + '.');
  const v = i => sim.v[e.nd[i]], nm = I2C_NAME[e.dev], b = e.bus || {};
  if (!(v(0) - v(3) > 2.4)) return nack(nm + ' ohne Versorgung: VCC an 3,3 V und GND an Masse anschließen.');
  if (b.sda !== 2) return nack(nm + ': SDA ' + (b.sda >= 0 ? 'liegt an GPIO' + b.sda : 'ist mit keinem GPIO verbunden') + ', erwartet wird GPIO2 (Pin 3).');
  if (b.scl !== 3) return nack(nm + ': SCL ' + (b.scl >= 0 ? 'liegt an GPIO' + b.scl : 'ist mit keinem GPIO verbunden') + ', erwartet wird GPIO3 (Pin 5).');
  const st = e.st, pos = e.part.pos == null ? 0.5 : e.part.pos, out = [];
  if (e.dev === 'I2CTEMP') {
    if (wr.length) st.ptr = wr[0] & 3;
    const t = Math.round((-25 + 125 * pos) * 2) / 2, raw = Math.round(t * 2) & 0x1ff, reg = [[(raw >> 1) & 0xff, (raw & 1) << 7], [0], [75, 0], [80, 0]][st.ptr];
    for (let i = 0; i < nrd; i++) out.push(reg[i % reg.length]);
  } else {
    if (wr.length) { const c0 = wr[0]; if ([0x10, 0x11, 0x13, 0x20, 0x21, 0x23].includes(c0)) st.mode = c0; else if (c0 === 0x00) st.mode = null; }
    const lux = Math.round(pos * pos * 2000), raw = st.mode == null ? 0 : Math.min(65535, Math.round(lux * 1.2));
    for (let i = 0; i < nrd; i++) out.push(i % 2 === 0 ? raw >> 8 : raw & 255);
  }
  return { data: out };
}
const api = { si, sane, PRESETS, parseGen, buildCircuit, createSim, ledKey, LEDVF, REGV, ICS, i2cXfer };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LochSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
