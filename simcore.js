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
  ZD: [1, 200, '5.1'], FUSE: [1e-3, 100, '250mA'], MOTOR: [0.5, 48, '6V'], RLY: [1, 48, '12V'], NTC: [1, 1e8, '10k'], PTC: [0.1, 1e8, '100'], SPK: [1, 1e4, '8'], P: [1, 1e8, '10k'], TP: [1, 1e8, '10k'],
};
function sane(k, v) {
  const L = LIMITS[k];
  if (k === 'LAMP') {
    const q = String(v == null ? '' : v).replace(',', '.'), mv = q.match(/([0-9.]+)\s*V/), ma = q.match(/([0-9.]+)\s*(m?)A/);
    const un = mv ? parseFloat(mv[1]) : 6, ia = ma ? parseFloat(ma[1]) * (ma[2] ? 1e-3 : 1) : 0.1;
    return (un >= 0.1 && un <= 400 && ia >= 1e-3 && ia <= 20) ? { ok: true, v } : { ok: false, v: '6V 0.1A' };
  }
  if (k === 'SIG') { const g = parseGen(v); return (g.amp <= 1000 && g.freq <= 1e7) ? { ok: true, v } : { ok: false, v: '5V 1kHz' }; }
  if (!L || v == null || String(v).trim() === '') return { ok: true, v };
  const x = si(v, NaN);
  if (!isFinite(x)) return { ok: true, v };
  return (x >= L[0] && x <= L[1]) ? { ok: true, v } : { ok: false, v: L[2] };
}
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

  const nodeId = new Map(); let nn = 0;
  if (groundRoot) nodeId.set(groundRoot, 0);
  const nodeOfRoot = r => { if (!nodeId.has(r)) nodeId.set(r, ++nn); return nodeId.get(r); };
  const nodeOfKey = k => { if (!parent.has(k)) return -1; return nodeOfRoot(find(k)); };
  const N = (p, i) => nodeOfRoot(find(pinKey(p, i)));

  const elems = [], warnings = [];
  const rec = [];
  const add = e => { e.pi = rec.splice(0); elems.push(e); return e; };
  const R = (a, b, g, part, extra) => add(Object.assign({ type: 'R', a, b, g, part }, extra || {}));

  layout.parts.forEach(p => {
    { const s = sane(p.k, p.v); if (!s.ok) { warnings.push({ part: p, text: 'Wert „' + p.v + '“ ist unrealistisch, es wird der Standardwert ' + s.v + ' verwendet' }); p.v = s.v; }
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
        const q = String(p.v || '6V 0.1A').replace(',', '.'), mv = q.match(/([0-9.]+)\s*V/), ma = q.match(/([0-9.]+)\s*(m?)A/);
        const un = mv ? parseFloat(mv[1]) : 6, ia = ma ? parseFloat(ma[1]) * (ma[2] ? 1e-3 : 1) : 0.1;
        add({ type: 'R', a: n(0), b: n(1), g: ia / un, part: p, lamp: un * ia, lh: 0 });
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
        const un = Math.max(si(p.v, 12), 1), R = un * un / 0.4, rl = add({ type: 'RL', a: n(0), b: n(1), r: R, l: R * 0.03, emf: 0, iprev: 0, relay: true, on: false, ion: 0.7 * un / R, ioff: 0.2 * un / R, part: p });
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
      case 'SPST': add({ type: 'S', a: n(0), b: n(1), closed: !!p.sw, part: p, upd() { this.closed = !!this.part.sw; } }); break;
      case 'ZD': {
        const vz = Math.max(si(p.v, 5.1), 1);
        add({ type: 'D', a: n(0), b: n(1), is: 1e-9, nn: 1.8, vz, part: p, vj: 0 });
        break; }
      case 'BZ': add({ type: 'R', a: n(0), b: n(1), g: 1 / 100, part: p, buzzer: true }); break;
      case 'C': case 'CE': case 'CF': add({ type: 'C', a: n(0), b: n(1), c: Math.max(si(p.v, 100e-9), 1e-15), part: p, vprev: 0 }); break;
      case 'L': add({ type: 'L', a: n(0), b: n(1), l: Math.max(si(p.v, 10e-6), 1e-9), part: p, iprev: 0 }); break;
      case 'D': {
        const z = /z/i.test(p.v || '') || /^[0-9]+V[0-9]?$/.test(String(p.v || '').trim());
        if (z) {
          const m = String(p.v).match(/([0-9]+)V([0-9])?/);
          const vz = m ? parseFloat(m[1] + (m[2] ? '.' + m[2] : '')) : 5.1;
          add({ type: 'D', a: n(0), b: n(1), is: 1e-9, nn: 1.8, vz, part: p, vj: 0, vjz: 0 });
        } else {
          const schottky = /5819|BAT|SB|SS/i.test(p.v || '');
          add({ type: 'D', a: n(0), b: n(1), is: schottky ? 1e-6 : 1e-9, nn: schottky ? 1.1 : 1.8, part: p, vj: 0 });
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
  });

  // Eingänge, an denen sonst nichts hängt, sind „offen“ (TTL: High, CMOS: undefiniert -> Low)
  const touch = new Array(nn + 1).fill(0);
  elems.forEach(e => {
    if (e.type === 'IC') { for (let i = 1; i <= e.np; i++) touch[e.n[i]]++; }
    else ['a', 'b', 'c', 'e', 'ni', 'ng', 'no'].forEach(f => { if (typeof e[f] === 'number') touch[e[f]]++; });
  });
  elems.forEach(e => { if (e.type === 'IC') for (let i = 1; i <= e.np; i++) e.fl[i] = e.n[i] > 0 && touch[e.n[i]] === 1; });
  return { nn, elems, nodeOfKey, groundKnown: groundRoot !== null, warnings, parts: layout.parts };
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
  const ph = (t * e.freq) % 1;
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
    const prev = Float64Array.from(v);
    for (const e of elems) if (e.type === 'IC' && !burnt.has(e.part.id)) e.icupd(prev, dt);
    for (let it = 0; it < 80; it++) {
      for (let r = 0; r < N; r++) { A[r].fill(0); z[r] = 0; A[r][r] = GMIN; }
      let limited = false;
      for (const e of elems) {
        if (e.part && burnt.has(e.part.id) && (e.type !== 'S')) { if (e.type === 'V') {} else continue; }
        switch (e.type) {
          case 'R': stampG(e.a, e.b, e.g); break;
          case 'S': stampG(e.a, e.b, e.closed ? 1 / RON : 1 / ROFF); break;
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
      switch (e.type) {
        case 'RL': {
          if (e.part && burnt.has(e.part.id)) { e.i = 0; break; }
          const g = 1 / (e.r + e.l / dt); e.i = g * (v[e.a] - v[e.b] - (e.emf || 0) + (e.l / dt) * e.iprev); e.iprev = e.i;
          if (e.mech) {
            const m = e.mech; m.w = (m.w + dt * m.ke * e.i / m.J) / (1 + dt * (m.b + m.bx) / m.J); e.phase = (e.phase || 0) + m.w * dt; e.w = m.w;
            e.heat = Math.max(0, e.heat + dt * (e.i * e.i * e.r - 2.5) / 12);
            if (e.heat > 1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Motor überhitzt (blockiert)' }); }
          }
          if (e.relay) { const ia = Math.abs(e.i); if (!e.on && ia > e.ion) e.on = true; else if (e.on && ia < e.ioff) e.on = false; }
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
          if (e.lamp) { const rt = e.i * e.i / e.g / e.lamp; if (rt > 25) e.lh = 2; else e.lh = rt > 2 ? (e.lh || 0) + dt / 0.05 : Math.max(0, (e.lh || 0) - dt / 0.2); if (e.lh > 1) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Glühlampe durchgebrannt' }); } }
          if (e.speaker && Math.abs(e.i * e.i / e.g) > 2) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Lautsprecher überlastet' }); }
          if (e.res && !burnt.has(e.part.id)) { const pw = e.i * e.i / e.g; e.power = pw; if (pw > 1.5) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Widerstand überlastet' }); } } break;
        case 'S': e.i = (v[e.a] - v[e.b]) * (e.closed ? 1 / RON : 1 / ROFF); break;
        case 'C': { const vc = v[e.a] - v[e.b]; e.i = e.c / dt * (vc - e.vprev); e.vprev = vc; break; }
        case 'L': { const g = dt / e.l; e.i = e.iprev + g * (v[e.a] - v[e.b]); e.iprev = e.i; break; }
        case 'V': { const vs = waveform(e, t); let x = (vs - (v[e.a] - v[e.b])) / e.rint; if (e.imax > 0) { e.cc = !!e.cm; if (e.cm) x = e.cm * e.imax; } e.i = x; e.vs = vs; break; }
        case 'D': {
          if (burnt.has(e.part.id)) { e.i = 0; break; }
          const vj = v[e.a] - v[e.b], nvt = e.nn * VT;
          let i = e.is * (expSafe(vj / nvt) - 1);
          if (e.vz) i -= 1e-9 * expSafe((-vj - (e.vz - 0.45)) / (1.2 * VT));
          e.i = i;
          if (e.led && i > e.imax) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'LED durchgebrannt' }); }
          break; }
        case 'Q': {
          const s = e.s, vbe = s * (v[e.b] - v[e.e]), vbc = s * (v[e.b] - v[e.c]);
          const ibe = e.is * (expSafe(vbe / VT) - 1), ibc = e.is * (expSafe(vbc / VT) - 1);
          e.ic = s * (ibe - (1 + 1 / e.br) * ibc); e.ib = s * (ibe / e.bf + ibc / e.br); e.i = e.ic;
          e.power = Math.abs(e.ic * (v[e.c] - v[e.e]));
          if (e.power > 1.5 && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'Transistor überlastet' }); }
          break; }
        case 'REG': e.i = (e.vtar - (v[e.no] - v[e.ng])) / 0.05; break;
        case 'IC': {
          const vs = v[e.vcc] - v[e.gnd], lim = e.info.oa ? 45 : e.key[0] === '4' ? 20 : (e.key === '555' ? 18.5 : 7.5);
          e.i = vs * e.gq;
          if (vs > lim && !burnt.has(e.part.id)) { burnt.add(e.part.id); sim.events.push({ kind: 'burn', part: e.part, text: 'IC durch Überspannung zerstört (' + vs.toFixed(1) + ' V)' }); }
          break; }
      }
    }
    sim.t = t; sim.converged = converged;
    return converged;
  };

  sim.volt = (node) => (node < 0 ? NaN : v[node]);
  sim.reset = () => { elems.forEach(e => { e.cm = 0; }); v.fill(0); sim.t = 0; sim.events.length = 0; burnt.clear(); elems.forEach(e => { if (e.type === 'C') e.vprev = 0; if (e.type === 'L') e.iprev = 0; if (e.type === 'RL') { e.iprev = 0; e.heat = 0; e.on = false; e.phase = 0; if (e.mech) e.mech.w = 0; } if (e.type === 'THY') e.on = false; if (e.type === 'TRF') { e.i1p = e.i2p = 0; } if (e.fuse) e.heat = 0; if (e.lamp) e.lh = 0; if (e.type === 'D' || e.type === 'Q') { e.vj = 0; e.vbe = 0; e.vbc = 0; } }); };
  return sim;
}

const api = { si, sane, parseGen, buildCircuit, createSim, ledKey, LEDVF, REGV, ICS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LochSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
