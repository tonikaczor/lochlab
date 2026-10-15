/* Tonfunk Lab - Modelle für integrierte Schaltungen (Logik, Zähler, 555, Operationsverstärker)
   Wird vom Rechenkern (simcore.js) benutzt. Pins werden mit ihrer Gehäusenummer (1-basiert) angesprochen. */
(function (root) {
'use strict';

const QUAD = {
  nand: [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]],
  nor:  [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]],
  c4:   [[1, 2, 3], [5, 6, 4], [8, 9, 10], [12, 13, 11]],          // CD4011 / 4001 / 4081 / 4071 / 4093
  hex:  [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]],
};
const F = {
  nand: (a, b) => !(a && b), nor: (a, b) => !(a || b), and: (a, b) => a && b,
  or: (a, b) => a || b, xor: (a, b) => a !== b, not: a => !a,
};
const SEG7 = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];

const L7400 = ['1A', '1B', '1Y', '2A', '2B', '2Y', 'GND', '3Y', '3A', '3B', '4Y', '4A', '4B', 'VCC'];
const L7402 = ['1Y', '1A', '1B', '2Y', '2A', '2B', 'GND', '3A', '3B', '3Y', '4A', '4B', '4Y', 'VCC'];
const L7404 = ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'GND', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VCC'];
const L4011 = ['1A', '1B', '1Y', '2Y', '2A', '2B', 'VSS', '3A', '3B', '3Y', '4Y', '4A', '4B', 'VDD'];

/* Katalog: Schlüssel -> Gehäuse, Pinbeschriftung, Versorgungspins */
const CATALOG = {
  '555':    { name: 'NE555 Timer', np: 8, vcc: 8, gnd: 1, labels: ['GND', 'TRIG', 'OUT', 'RST', 'CTRL', 'THR', 'DIS', 'VCC'] },
  '7400':   { name: '7400 4×NAND', np: 14, vcc: 14, gnd: 7, labels: L7400, quad: 'nand', fn: 'nand' },
  '7402':   { name: '7402 4×NOR', np: 14, vcc: 14, gnd: 7, labels: L7402, quad: 'nor', fn: 'nor' },
  '7404':   { name: '7404 6×NICHT', np: 14, vcc: 14, gnd: 7, labels: L7404, quad: 'hex', fn: 'not' },
  '7408':   { name: '7408 4×UND', np: 14, vcc: 14, gnd: 7, labels: L7400, quad: 'nand', fn: 'and' },
  '7432':   { name: '7432 4×ODER', np: 14, vcc: 14, gnd: 7, labels: L7400, quad: 'nand', fn: 'or' },
  '7486':   { name: '7486 4×XOR', np: 14, vcc: 14, gnd: 7, labels: L7400, quad: 'nand', fn: 'xor' },
  '7414':   { name: '74xx14 6×NICHT (Schmitt)', np: 14, vcc: 14, gnd: 7, labels: L7404, quad: 'hex', fn: 'not', schmitt: true },
  '4011':   { name: '4011 4×NAND', np: 14, vcc: 14, gnd: 7, labels: L4011, quad: 'c4', fn: 'nand' },
  '4001':   { name: '4001 4×NOR', np: 14, vcc: 14, gnd: 7, labels: L4011, quad: 'c4', fn: 'nor' },
  '4081':   { name: '4081 4×UND', np: 14, vcc: 14, gnd: 7, labels: L4011, quad: 'c4', fn: 'and' },
  '4071':   { name: '4071 4×ODER', np: 14, vcc: 14, gnd: 7, labels: L4011, quad: 'c4', fn: 'or' },
  '4093':   { name: '4093 4×NAND (Schmitt)', np: 14, vcc: 14, gnd: 7, labels: L4011, quad: 'c4', fn: 'nand', schmitt: true },
  '4069':   { name: '4069 6×NICHT', np: 14, vcc: 14, gnd: 7, labels: ['1A', '1Y', '2A', '2Y', '3A', '3Y', 'VSS', '4Y', '4A', '5Y', '5A', '6Y', '6A', 'VDD'], quad: 'hex', fn: 'not' },
  '7474':   { name: '7474 2×D-Flipflop', np: 14, vcc: 14, gnd: 7, labels: ['1CLR', '1D', '1CLK', '1PRE', '1Q', '1Q̄', 'GND', '2Q̄', '2Q', '2PRE', '2CLK', '2D', '2CLR', 'VCC'] },
  '4013':   { name: '4013 2×D-Flipflop', np: 14, vcc: 14, gnd: 7, labels: ['1Q', '1Q̄', '1CLK', '1R', '1D', '1S', 'VSS', '2S', '2D', '2CLK', '2R', '2Q̄', '2Q', 'VDD'] },
  '4017':   { name: '4017 Dezimalzähler', np: 16, vcc: 16, gnd: 8, labels: ['Q5', 'Q1', 'Q0', 'Q2', 'Q6', 'Q7', 'Q3', 'VSS', 'Q8', 'Q4', 'Q9', 'CO', 'ENA', 'CLK', 'RST', 'VDD'] },
  '4020':   { name: '4020 14-Bit-Zähler', np: 16, vcc: 16, gnd: 8, labels: ['Q12', 'Q13', 'Q14', 'Q6', 'Q5', 'Q7', 'Q4', 'VSS', 'Q1', 'CLK', 'RST', 'Q9', 'Q8', 'Q10', 'Q11', 'VDD'] },
  '7490':   { name: '7490 Dezimalzähler', np: 14, vcc: 5, gnd: 10, labels: ['CKB', 'R01', 'R02', 'NC', 'VCC', 'R91', 'R92', 'QC', 'QB', 'GND', 'QD', 'QA', 'NC', 'CKA'] },
  '7447':   { name: '7447 BCD→7-Segment (Anode)', np: 16, vcc: 16, gnd: 8, labels: ['B', 'C', 'LT', 'BI', 'RBI', 'D', 'A', 'GND', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VCC'] },
  '4511':   { name: '4511 BCD→7-Segment (Kathode)', np: 16, vcc: 16, gnd: 8, labels: ['B', 'C', 'LT', 'BI', 'LE', 'D', 'A', 'VSS', 'e', 'd', 'c', 'b', 'a', 'g', 'f', 'VDD'] },
  '741':    { name: 'LM741 Operationsverstärker', np: 8, vcc: 7, gnd: 4, labels: ['N1', 'IN−', 'IN+', 'V−', 'N2', 'OUT', 'V+', 'NC'], oa: [{ p: 3, n: 2, o: 6 }], rail: 1.5 },
  '358':    { name: 'LM358 2×Operationsverstärker', np: 8, vcc: 8, gnd: 4, labels: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], oa: [{ p: 3, n: 2, o: 1 }, { p: 5, n: 6, o: 7 }], rail: 1.5, rlow: 0.05 },
  '072':    { name: 'TL072 2×Operationsverstärker', np: 8, vcc: 8, gnd: 4, labels: ['1OUT', '1IN−', '1IN+', 'V−', '2IN+', '2IN−', '2OUT', 'V+'], oa: [{ p: 3, n: 2, o: 1 }, { p: 5, n: 6, o: 7 }], rail: 1.5 },
  '324':    { name: 'LM324 4×Operationsverstärker', np: 14, vcc: 4, gnd: 11, labels: ['1OUT', '1IN−', '1IN+', 'V+', '2IN+', '2IN−', '2OUT', '3OUT', '3IN−', '3IN+', 'V−', '4IN+', '4IN−', '4OUT'], oa: [{ p: 3, n: 2, o: 1 }, { p: 5, n: 6, o: 7 }, { p: 10, n: 9, o: 8 }, { p: 12, n: 13, o: 14 }], rail: 1.5, rlow: 0.05 },
};
CATALOG.opa = { name: 'Operationsverstärker', np: 5, vcc: 4, gnd: 5, labels: ['IN+', 'IN−', 'OUT', 'V+', 'V−'], oa: [{ p: 1, n: 2, o: 3 }], rail: 1.5, hidden: true };
const SORT = ['555', '7400', '7402', '7404', '7408', '7432', '7486', '7414', '4011', '4001', '4081', '4071', '4093', '4069', '7474', '4013', '4017', '4020', '7490', '7447', '4511', '741', '358', '072', '324'];

/* Typ aus der Wertangabe erkennen (NE555, SN74HC00N, CD4017, LM358 ...) */
function find(v) {
  const s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return null;
  if (/555/.test(s)) return { key: '555', fam: /TLC|LMC|7555|ICM/.test(s) ? 'cmos' : 'bip' };
  if (/^(LM|UA|MC|NE)?741[A-Z]*$/.test(s)) return { key: '741', fam: 'oa' };
  if (/(LM|NE)?358/.test(s)) return { key: '358', fam: 'oa' };
  if (/(LM)?324/.test(s)) return { key: '324', fam: 'oa' };
  if (/TL072|TL082/.test(s)) return { key: '072', fam: 'oa' };
  let m = s.match(/^(?:SN|DM|MC|HD)?74(HCT|HC|LS|ALS|AC|F|S)?(\d{2,3})/);
  if (m) {
    const num = m[2].slice(0, 2) === '14' ? '14' : m[2].slice(0, 2);
    const key = { '00': '7400', '02': '7402', '04': '7404', '08': '7408', '32': '7432', '86': '7486', '14': '7414', '74': '7474', '90': '7490', '47': '7447' }[num];
    if (key) return { key, fam: /HC|AC/.test(m[1] || '') ? 'cmos' : 'ttl' };
  }
  m = s.match(/^(?:CD|HEF|HCF|MC|TC)?(4\d{3}|45\d{2})/);
  if (m && CATALOG[m[1]]) return { key: m[1], fam: 'cmos' };
  return null;
}

/* ---------- Element-Erzeugung ---------- */
function make(def, part, n) {
  const info = CATALOG[def.key];
  const e = { type: 'IC', key: def.key, fam: def.fam, info, part, np: info.np, n: [0], outs: new Map(), oas: [], st: {}, hs: [], fl: [] };
  for (let i = 1; i <= info.np; i++) e.n[i] = n(i - 1);
  e.vcc = e.n[info.vcc]; e.gnd = e.n[info.gnd];
  e.gq = def.fam === 'ttl' ? 1 / 400 : def.fam === 'oa' ? 1 / 4000 : def.fam === 'bip' ? 1 / 2500 : 1e-6;
  if (info.oa) info.oa.forEach(o => e.oas.push({ p: e.n[o.p], n: e.n[o.n], o: e.n[o.o], mid: 0, half: 1, vd: 0 }));
  e.icupd = (vp, dt) => update(e, vp, dt);
  return e;
}

/* Ideale Logik ohne Versorgungspins (SchaltLab): Pegel 0 V / Vh, Schwelle bei Vh/2 */
function makeIdeal(part, n, kind) {
  const np = kind === 'dff' ? 4 : (part.vr === 'not' || part.vr === 'snot' ? 2 : 3);
  const e = { type: 'IC', key: 'ideal', ideal: true, kind, fn: part.vr, vh: parseFloat(String(part.v || '5').replace(',', '.')) || 5, part, np, n: [0], outs: new Map(), st: {}, hs: [], fl: [], oas: [], info: {}, vcc: 0, gnd: 0, gq: 0 };
  e.ins = kind === 'dff' ? [1, 2] : (np === 2 ? [1] : [1, 2]);
  for (let i = 1; i <= np; i++) e.n[i] = n(i - 1);
  e.icupd = (vp) => updateIdeal(e, vp);
  return e;
}
function updateIdeal(e, vp) {
  e.outs.clear();
  const vh = e.vh;
  const hi = i => { const x = vp[e.n[i]] / vh; if (e.fn === 'snot') { if (x > 0.65) e.hs[i] = 1; else if (x < 0.35) e.hs[i] = 0; return e.hs[i] || 0; } return x > 0.5 ? 1 : 0; };
  const O = (pin, l) => e.outs.set(pin, { level: l, rh: 50, rl: 50 });
  if (e.kind === 'dff') { const edge = rise(e, 'clk', hi(2)); let Q = e.st.q || 0; if (edge) Q = hi(1); e.st.q = Q; O(3, Q); O(4, Q ? 0 : 1); return; }
  const F2 = { and: (a, b) => a && b, nand: (a, b) => !(a && b), or: (a, b) => a || b, nor: (a, b) => !(a || b), xor: (a, b) => a !== b, xnor: (a, b) => a === b }[e.fn];
  if (e.fn === 'not' || e.fn === 'snot') O(2, hi(1) ? 0 : 1);
  else if (F2) O(3, F2(!!hi(1), !!hi(2)) ? 1 : 0);
}
const powered = (e, vp) => (vp[e.vcc] - vp[e.gnd]) >= (e.fam === 'ttl' ? 3.5 : e.fam === 'bip' ? 4.0 : 2.0);
function lv(e, vp, pin, hyst) {
  const g = vp[e.gnd], vs = vp[e.vcc] - g;
  if (e.fl[pin]) return e.fam === 'ttl' ? 1 : 0;           // offener TTL-Eingang liegt auf High
  const x = (vp[e.n[pin]] - g) / (vs || 1);
  if (hyst) { if (x > 0.65) e.hs[pin] = 1; else if (x < 0.35) e.hs[pin] = 0; return e.hs[pin] || 0; }
  return x > (e.fam === 'ttl' ? 0.4 : 0.5) ? 1 : 0;
}
const rise = (e, key, now) => { const was = e.st[key] || 0; e.st[key] = now; return now === 1 && was === 0; };
const fall = (e, key, now) => { const was = e.st[key] == null ? now : e.st[key]; e.st[key] = now; return now === 0 && was === 1; };

function update(e, vp, dt) {
  e.outs.clear();
  const info = e.info;
  e.burnCheck = (vp[e.vcc] - vp[e.gnd]);
  if (info.oa) { e.oas.forEach((o, i) => { o.vsup = vp[e.vcc] - vp[e.gnd]; }); return; }
  if (!powered(e, vp)) { e.st = {}; return; }
  const key = e.key, O = (pin, level, extra) => e.outs.set(pin, Object.assign({ level }, extra || {}));
  if (info.quad) {
    const f = F[info.fn];
    QUAD[info.quad].forEach(g => {
      const ins = g.slice(0, -1), out = g[g.length - 1];
      O(out, f(...ins.map(p => !!lv(e, vp, p, info.schmitt))) ? 1 : 0);
    });
    return;
  }
  switch (key) {
    case '555': {
      const g = vp[e.gnd], vres = vp[e.n[4]] - g, vctrl = vp[e.n[5]] - g, vtr = vp[e.n[2]] - g, vth = vp[e.n[6]] - g;
      let q = e.st.q == null ? 0 : e.st.q;
      if (vres < 0.7) q = 0;
      else if (vtr < vctrl / 2) q = 1;
      else if (vth > vctrl) q = 0;
      e.st.q = q;
      O(3, q, e.fam === 'cmos' ? { rh: 40, rl: 40, drop: 0 } : { rh: 20, rl: 12, drop: 1.5 });
      O(7, q ? null : 0, { rl: 12 });                                    // Entladetransistor
      return; }
    case '7474': {
      [[1, 2, 3, 4, 5, 6, 'a'], [13, 12, 11, 10, 9, 8, 'b']].forEach(([clr, d, clk, pre, q, qn, id]) => {
        const c = lv(e, vp, clr), p = lv(e, vp, pre), D = lv(e, vp, d), edge = rise(e, 'clk' + id, lv(e, vp, clk));
        let Q = e.st['q' + id] || 0;
        if (!c && !p) { O(q, 1); O(qn, 1); return; }
        if (!c) Q = 0; else if (!p) Q = 1; else if (edge) Q = D;
        e.st['q' + id] = Q; O(q, Q); O(qn, Q ? 0 : 1);
      });
      return; }
    case '4013': {
      [[3, 5, 6, 4, 1, 2, 'a'], [10, 9, 8, 11, 13, 12, 'b']].forEach(([clk, d, s, r, q, qn, id]) => {
        const S = lv(e, vp, s), R = lv(e, vp, r), D = lv(e, vp, d), edge = rise(e, 'clk' + id, lv(e, vp, clk));
        let Q = e.st['q' + id] || 0;
        if (S && R) { O(q, 1); O(qn, 1); return; }
        if (R) Q = 0; else if (S) Q = 1; else if (edge) Q = D;
        e.st['q' + id] = Q; O(q, Q); O(qn, Q ? 0 : 1);
      });
      return; }
    case '4017': {
      const clk = lv(e, vp, 14), ena = lv(e, vp, 13), rst = lv(e, vp, 15), edge = rise(e, 'clk', clk);
      let c = e.st.c || 0;
      if (rst) c = 0; else if (edge && !ena) c = (c + 1) % 10;
      e.st.c = c;
      [3, 2, 4, 7, 10, 1, 5, 6, 9, 11].forEach((pin, i) => O(pin, i === c ? 1 : 0));
      O(12, c < 5 ? 1 : 0);
      return; }
    case '4020': {
      const clk = lv(e, vp, 10), rst = lv(e, vp, 11), edge = fall(e, 'clk', clk);
      let c = e.st.c || 0;
      if (rst) c = 0; else if (edge) c = (c + 1) & 0x3FFF;
      e.st.c = c;
      Object.entries({ 9: 1, 7: 4, 5: 5, 4: 6, 6: 7, 13: 8, 12: 9, 14: 10, 15: 11, 1: 12, 2: 13, 3: 14 }).forEach(([pin, bit]) => O(+pin, (c >> (bit - 1)) & 1));
      return; }
    case '7490': {
      const r0 = lv(e, vp, 2) && lv(e, vp, 3), r9 = lv(e, vp, 6) && lv(e, vp, 7);
      const ea = fall(e, 'a', lv(e, vp, 14)), eb = fall(e, 'b', lv(e, vp, 1));
      let a = e.st.a || 0, b = e.st.b || 0;
      if (r9) { a = 1; b = 4; }
      else if (r0) { a = 0; b = 0; }
      else { if (ea) a ^= 1; if (eb) b = (b + 1) % 5; }
      e.st.a = a; e.st.b = b;
      O(12, a); O(9, b & 1); O(8, (b >> 1) & 1); O(11, (b >> 2) & 1);
      return; }
    case '7447': case '4511': {
      const act = key === '7447';
      const A = lv(e, vp, 7), B = lv(e, vp, 1), C = lv(e, vp, 2), D = lv(e, vp, 6), lt = lv(e, vp, 3), bi = lv(e, vp, 4);
      let val = A | (B << 1) | (C << 2) | (D << 3);
      if (!act) { const le = lv(e, vp, 5); if (le) val = e.st.val == null ? val : e.st.val; else e.st.val = val; }
      const pins = [13, 12, 11, 10, 9, 15, 14];
      pins.forEach((pin, i) => {
        let on = val <= 9 ? SEG7[val][i] === '1' : false;
        if (!lt) on = true;
        if (!bi && lt) on = false;
        if (act) O(pin, on ? 0 : null, { rl: 22 });             // aktiv Low, offener Kollektor
        else O(pin, on ? 1 : 0, { rh: 120, rl: 60 });
      });
      return; }
  }
}

/* Aufruf aus dem Rechenkern: Ausgangsstufen und Analogteile einstempeln */
function stamp(e, S, v) {
  if (e.ideal) {
    e.ins.forEach(i => S.stampG(e.n[i], 0, 1e-6));                          // offene Eingänge liegen auf Low
    e.outs.forEach((o, pin) => {
      const node = e.n[pin];
      if (o.level === 1) { const g = 1 / o.rh; S.stampG(node, 0, g); S.inj(node, g * e.vh); } else S.stampG(node, 0, 1 / o.rl);
    });
    return;
  }
  const gnd = e.gnd;
  S.stampG(e.vcc, gnd, e.gq);
  if (e.key === '555') {                                           // interner Spannungsteiler (5k - 5k - 5k)
    S.stampG(e.vcc, e.n[5], 1 / 5000); S.stampG(e.n[5], gnd, 1 / 10000);
  }
  e.outs.forEach((o, pin) => {
    const node = e.n[pin];
    if (o.level == null) return;
    if (o.level === 0) { S.stampG(node, gnd, 1 / (o.rl || (e.fam === 'ttl' ? 25 : 40))); return; }
    const gh = 1 / (o.rh || (e.fam === 'ttl' ? 70 : 40));
    const vg = v[gnd], target = vg + Math.max(0, (v[e.vcc] - vg) - (o.drop != null ? o.drop : (e.fam === 'ttl' ? 1.6 : 0)));
    S.stampG(node, gnd, gh); S.inj(node, gh * target);
  });
  e.oas.forEach(o => {
    const vp = v[e.vcc], vn = v[e.gnd], info = e.info;
    const hi = vp - (info.rail || 1.5), lo = vn + (info.rlow != null ? info.rlow : (info.rail || 1.5));
    o.mid = (hi + lo) / 2; o.half = Math.max((hi - lo) / 2, 0);
    let vd = v[o.p] - v[o.n];
    vd = Math.max(o.vd - 0.5, Math.min(o.vd + 0.5, vd)); o.vd = vd;               // Schrittbegrenzung
    const A = 2000, rout = 75, g = 1 / rout;
    let f, df;
    if (o.half < 1e-3) { f = o.mid; df = 0; }
    else { const t = Math.tanh(A * vd / o.half); f = o.mid + o.half * t; df = A * (1 - t * t); }
    const gm = df * g, ieq = f * g - gm * vd;
    S.stampG(o.o, 0, g);
    S.addA(o.o, o.p, -gm); S.addA(o.o, o.n, gm); S.rhs(o.o, ieq);
  });
}

const api = { find, make, makeIdeal, stamp, update, CATALOG, SORT, QUAD };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LochSimICs = api;
})(typeof window !== 'undefined' ? window : globalThis);
