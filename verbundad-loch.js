/* verbundad-loch.js - Adapter des LochLab fuer die Verbundprojekte (Paket A2).
   Arbeitet mit dem Hook window.LochVerbund aus layout.html (doc, load, env, boards, ribbons, placeFromNetlist).
   Die Umrechnung Lochraster <-> neutrale Netzliste steht in `pure` (Node-tauglich, Test: quelle/verbund/test_verbundad_loch.js):
     netlistFromDoc(doc, env, N)    LochLab-Dokument -> { ok, nl, bom, unmapped, warns, refs }
     jobFromNetlist(nl, env, N, o)  Netzliste -> Auftrag fuer autoLayout() von layout.html (Bauteile, Netze; Stufe 1 mit Verdrahtung)
   env = { PARTS, pinsOf(item), variantOf(item), LochSim } aus layout.html; N = Verbund.nl (verbundnl.js).
   Annahmen sind mit (A) gekennzeichnet. */
(function (root) {
'use strict';
const isA = Array.isArray, isO = x => x !== null && typeof x === 'object' && !isA(x), S = x => (x === null || x === undefined ? '' : String(x));
const T2 = ['1', '2'], AK = ['A', 'K'], seq = (n, p) => Array.from({ length: n }, (_, i) => (p || '') + (i + 1));
const clone = o => JSON.parse(JSON.stringify(o));
const natCmp = (a, b) => { const x = /^(\D*)(\d*)(.*)$/.exec(S(a)), y = /^(\D*)(\d*)(.*)$/.exec(S(b)); if (x[1] !== y[1]) return x[1] < y[1] ? -1 : 1; const m = x[2] === '' ? -1 : +x[2], n = y[2] === '' ? -1 : +y[2]; return m !== n ? (m < n ? -1 : 1) : (x[3] < y[3] ? -1 : x[3] > y[3] ? 1 : 0); };

/* ====================================================================== Tabelle LochLab-Bauteil -> Netzlisten-Bauteil */
const vOf = (it, env) => { if (it.v !== undefined && it.v !== null && it.v !== '') return S(it.v); const V = env.variantOf && env.variantOf(it); return V && V.val != null ? S(V.val) : S((env.PARTS[it.k] || {}).val); };
const two = kind => () => ({ kind, names: T2 });
const fixed = (kind, names) => () => ({ kind, names });
const zv = v => { const m = /(\d+)V(\d*)\s*$/i.exec(S(v)); return m ? m[1] + (m[2] ? '.' + m[2] : '') : S(v); };       /* BZX55C5V1 -> 5.1 */
/* Arduino-Module: Beschriftung auf dem Lochraster-Modul -> Anschlussname der Netzliste ('' = hat keine Entsprechung) */
const modName = l => (/^(GND|VIN|5V|3V3)$/.test(l) ? l : /^D\d+$/.test(l) ? l : /^A[0-5]$/.test(l) ? l : l === 'SCL' ? 'A5' : l === 'SDA' ? 'A4' : l === 'TX1' ? 'D1' : l === 'RX0' ? 'D0' : '');   /* SCL/SDA = A5/A4 beim Uno R3 */
const modNames = (it, env) => (env.PARTS[it.k].labels || []).map(modName);
/* Ergebnis: { kind, names:[Name je LochLab-Pin ('' = nicht abgebildet; gleiche Namen = im Bauteil verbunden)], value?, props? } oder { subs:[{ suf, kind, idx:[Pins], names }] }; null = nur mechanisch (Sockel) */
const FWD = {
  R: two('R'), C: two('C'), CF: two('C'), CE: two('CE'), L: two('L'), LDR: two('LDR'), NTC: two('NTC'), PTC: two('PTC'), SPK: two('SPK'), VDR: two('VDR'), FUSE: two('FUSE'), Q: two('XTAL'), LAMP: two('LAMP'),
  D: (it, env) => { const V = (env.variantOf && env.variantOf(it)) || {}, kind = V.id === 'dz' ? 'ZD' : V.id === 'd5819' ? 'SCHOTTKY' : V.id === 'diac' ? 'DIAC' : 'D'; return { kind, names: kind === 'DIAC' ? T2 : AK, value: kind === 'ZD' ? zv(vOf(it, env)) : undefined }; },
  LED: fixed('LED', AK), DUOLED: fixed('DUOLED', ['R', 'COM', 'G']), PHT: fixed('PHT', ['C', 'E']), RLY: fixed('RLY', ['A1', 'A2', 'COM', 'NO', 'NC']),
  THY: fixed('THY', ['K', 'A', 'G']), TRIAC: fixed('TRIAC', ['MT1', 'MT2', 'G']), OPTO: fixed('OPTO', ['A', 'K', 'E', 'C']), TRF: fixed('TRF', ['P1', 'P2', 'S1', 'S2']),
  FET: (it, env) => ({ kind: /^p-/.test(((env.variantOf && env.variantOf(it)) || {}).id || '') ? 'PMOS' : 'NMOS', names: ['G', 'D', 'S'] }),
  T: (it, env) => { const id = ((env.variantOf && env.variantOf(it)) || {}).id || 'npn-cbe'; return { kind: /^pnp/.test(id) ? 'PNP' : 'NPN', names: /ebc$/.test(id) ? ['E', 'B', 'C'] : ['C', 'B', 'E'] }; },
  U: fixed('REG', ['IN', 'GND', 'OUT']), P: fixed('POT', ['A', 'W', 'B']), TP: fixed('POT', ['A', 'W', 'B']), GL: fixed('BRUECKE', ['AC1', 'AC2', '+', '-']),   /* GL: Reihenfolge (A), im Lab nicht simuliert */
  BAT: fixed('BAT', ['+', '-']), SIG: fixed('AC', ['+', '-']), BZ: () => ({ kind: 'PIEZO', names: ['+', '-'], value: '' }),
  SEG7: (it, env) => { const V = env.variantOf(it) || {}; if (V.id === 'dk') return undefined;    /* Doppelanzeige: nicht abgebildet */
    return { kind: 'SEG8', names: ['e', 'd', 'K', 'c', 'dp', 'b', 'a', 'K', 'f', 'g'], value: 'rot', props: /^.a$/.test(V.id || '') ? { vr: 'a' } : undefined }; },
  SW: (it, env) => ({ kind: 'PB', names: env.pinsOf(it).length === 4 ? ['1', '2', '1', '2'] : T2, value: '' }),
  SCH: (it, env) => { const n = env.pinsOf(it).length, p = ['NC', 'COM', 'NO'];
    return n >= 6 ? { subs: [{ suf: '', kind: 'SPDT', idx: [0, 1, 2], names: p, alt: 1 }, { suf: 'b', kind: 'SPDT', idx: [3, 4, 5], names: p, alt: 1 }], value: '' } : { kind: 'SPDT', names: p, value: '', alt: 1 }; },
  DSW: (it, env) => { const n = env.pinsOf(it).length, subs = []; for (let i = 0; i < n / 2; i++) subs.push({ suf: '_' + (i + 1), kind: 'SPST', idx: [i, n - 1 - i], names: T2 }); return { subs, value: '' }; },
  IC: (it, env) => { const n = env.pinsOf(it).length, cls = GATECLS[S(it.v)];
    if (isA(it.gates) && cls) {      /* von der Platzierung erzeugter Gatter-IC (7408 ...): wieder in die Gatter des Schaltplans aufloesen */
      const subs = []; it.gates.forEach((g, si) => { if (g && GNAMES[g.kind] && SLOTS[cls][si]) subs.push({ ref: g.ref, suf: '', kind: g.kind, idx: SLOTS[cls][si].slice(0, GNAMES[g.kind].length).map(x => x - 1), names: GNAMES[g.kind], value: '5V' }); });
      if (subs.length) return { subs, value: '5V' };
    }
    return { kind: 'ICX', names: seq(n), props: { n } }; },
  SOCK: () => null,
  KL: (it, env) => ({ kind: 'KL', names: seq(env.pinsOf(it).length), props: { n: env.pinsOf(it).length } }), KL5: (it, env) => ({ kind: 'KL', names: seq(env.pinsOf(it).length), props: { n: env.pinsOf(it).length } }),
  SIP: (it, env) => ({ kind: 'SIP', names: seq(env.pinsOf(it).length), props: { n: env.pinsOf(it).length } }), BU: (it, env) => ({ kind: 'SIP', names: seq(env.pinsOf(it).length), props: { n: env.pinsOf(it).length } }),
  PIN: () => ({ kind: 'SIP', names: ['1'], props: { n: 1 }, value: '' }),
  UNO: (it, env) => ({ kind: 'UNO', names: modNames(it, env), value: '' }), NANO: (it, env) => ({ kind: 'UNO', names: modNames(it, env), value: '', props: { board: 'nano' } }),
  PI: (it, env) => ({ kind: 'PI', names: seq(env.pinsOf(it).length), value: '' })
};
const fwd = (it, env) => { const f = FWD[it.k]; if (!f) return undefined; const r = f(it, env); if (r === undefined) return undefined; if (r === null) return null; if (r.subs) return r; return { subs: [{ suf: '', kind: r.kind, idx: null, names: r.names, value: r.value, props: r.props, alt: r.alt }], value: r.value }; };

/* ====================================================================== LochLab-Dokument -> Netzliste */
function refsOf(parts, env) {
  const ref = new Map(), used = new Set(), cnt = {};
  parts.forEach(i => { const l = S(i.l).trim().replace(/[\s.]+/g, '_'); if (l && !used.has(l)) { used.add(l); ref.set(i.id, l); } });
  parts.forEach(i => { if (ref.has(i.id)) return; const pre = (env.PARTS[i.k] && env.PARTS[i.k].pre) || i.k; let n = cnt[pre] || 0, l; do { l = pre + (++n); } while (used.has(l)); cnt[pre] = n; used.add(l); ref.set(i.id, l); });
  return ref;
}
function netlistFromDoc(doc, env, N) {
  const out = { ok: false, nl: null, bom: [], unmapped: [], warns: [], errs: [], refs: {} };
  try {
    const items = doc && isA(doc.items) ? doc.items : [], all = items.filter(i => i.t === 'part'), parts = all.filter(i => env.PARTS[i.k]), LS = env.LochSim;
    all.forEach(i => { if (!env.PARTS[i.k]) out.unmapped.push(S(i.l) + ' (' + i.k + ')'); });
    if (!LS) { out.errs.push('Rechenkern (LochSim) fehlt.'); return out; }
    const lp = parts.map(i => ({ id: i.id, k: i.k, vr: i.vr, v: i.v, n: i.n, pins: env.pinsOf(i), sw: 0, pos: 0.5, light: 0.5, pressed: false, item: i }));
    const c = LS.buildCircuit({ parts: lp, tracks: items.filter(t => t.t === 'track'), wires: items.filter(t => t.t === 'wire').concat(LS.ribbonWires(items)) });
    const ref = refsOf(parts, env), uf = new Map(), find = x => { if (!uf.has(x)) uf.set(x, x); let r = x; while (uf.get(r) !== r) r = uf.get(r); return r; }, uni = (a, b) => { uf.set(find(a), find(b)); };
    const dropped = [], list = [];   /* { ref, kind, value, props, pins: { Name: Knotenschluessel } } */
    parts.forEach((it, pi) => {
      const f = fwd(it, env), pw = lp[pi].pins, base = ref.get(it.id); out.refs[it.id] = base;
      if (f === undefined) { out.unmapped.push(base + ' (' + ((env.PARTS[it.k] || {}).name || it.k) + ')'); return; }
      if (f === null) return;
      f.subs.forEach(sb => {
        const idx = sb.idx || pw.map((_, j) => j), q = { ref: sb.ref || base + sb.suf, alt: sb.alt, kind: sb.kind, value: sb.value !== undefined ? sb.value : (f.value !== undefined ? f.value : vOf(it, env)), pins: {} };
        if (sb.props) q.props = sb.props;
        if (q.kind === 'LDR' && q.value === 'LDR') q.value = '';
        idx.forEach((j, a) => {
          const nm = sb.names[a], nd = c.nodeOfKey(pw[j][0] + ',' + pw[j][1]), key = nd < 0 ? 'p' + it.id + '_' + j : 'n' + nd;
          if (!nm) { dropped.push({ ref: base, pin: j + 1, key }); return; }
          if (q.pins[nm] !== undefined) uni(q.pins[nm], key); else q.pins[nm] = key;      /* gleicher Name = im Bauteil verbunden (Anzeige, Taster, GND-Pins) */
        });
        list.push(q);
      });
    });
    list.sort((a, b) => natCmp(a.ref, b.ref));
    const cnt = new Map(); list.forEach(q => Object.keys(q.pins).forEach(nm => { const r = find(q.pins[nm]); cnt.set(r, (cnt.get(r) || 0) + 1); }));
    list.forEach(q => { if (q.alt && q.kind === 'SPDT' && q.pins.NO !== undefined && (cnt.get(find(q.pins.NO)) || 0) < 2) { q.kind = 'SPST'; q.pins = { '1': q.pins.COM, '2': q.pins.NC }; } });   /* Wechsler ohne Anschluss am Schliesser = Ein/Aus-Schalter (A) */
    const members = new Map();
    list.forEach(q => Object.keys(q.pins).forEach(nm => { const r = find(q.pins[nm]); if (!members.has(r)) members.set(r, []); members.get(r).push(q.ref + '.' + nm); }));
    dropped.forEach(d => { const m = members.get(find(d.key)); if (m && m.length) out.warns.push(d.ref + ': Pin ' + d.pin + ' ist angeschlossen, hat aber keine Entsprechung in der Netzliste (nicht übernommen).'); });
    const name = new Map(), used = new Set();
    if (c.groundKnown) name.set(find('n0'), 'GND');
    let vi = 0; list.forEach(q => { if (q.kind !== 'BAT' || !q.pins['+']) return; const r = find(q.pins['+']); if (!name.has(r)) { vi++; name.set(r, vi === 1 ? 'VCC' : 'V' + vi); } });
    if (![...name.values()].includes('GND')) { const g = list.find(q => q.kind === 'UNO' && q.pins.GND !== undefined) || list.find(q => q.kind === 'PI' && q.pins['6'] !== undefined); if (g) name.set(find(g.pins.GND !== undefined ? g.pins.GND : g.pins['6']), 'GND'); }   /* Masse des Arduino/Pi, wenn keine Quelle da ist */
    name.forEach(n => used.add(n));
    let k = 0; const nets = [];
    members.forEach((pins, r) => { if (!name.has(r) && pins.length >= 2) { let n; do { n = 'N' + (++k); } while (used.has(n)); name.set(r, n); } });
    members.forEach((pins, r) => { if (name.has(r) && pins.length >= 2) nets.push({ name: name.get(r), pins: pins.slice() }); });
    const keep = new Set(nets.map(n => n.name));
    const nl0 = { v: 1, name: S(doc && doc.name) || 'Lochraster', parts: list.map(q => { const p = { ref: q.ref, kind: q.kind, value: q.value, pins: {} }; if (q.props) p.props = q.props; Object.keys(q.pins).forEach(nm => { const nt = name.get(find(q.pins[nm])); if (nt && keep.has(nt)) p.pins[nm] = nt; }); return p; }), nets };
    let nl = nl0;
    if (N && typeof N.normalize === 'function') { const r = N.normalize(nl0, { lenient: true, warnSingle: false }); if (!r.ok) { out.errs = r.errs; return out; } nl = r.nl; }
    out.nl = nl; out.bom = nl.parts.map(p => ({ ref: p.ref, kind: p.kind, value: S(p.value) })); out.ok = true;
  } catch (e) { out.errs.push('Netzliste nicht lesbar: ' + (e && e.message ? e.message : e)); }
  return out;
}

/* ====================================================================== Netzliste -> Auftrag fuer autoLayout (Stufe 1 / Startdaten) */
const DIODE_VR = { '1N4007': 'd4007', '1N5819': 'd5819' };
/* Ergebnis: { ll, two, map? } ; map = { Netzlistenname: LochLab-Pin } nur, wenn nicht aus FWD ableitbar */
const REV = {
  R: p => ({ ll: { k: 'R', n: 4, v: p.value }, two: true }), C: p => ({ ll: { k: 'C', n: 2, v: p.value }, two: true }), CE: p => ({ ll: { k: 'CE', n: 2, v: p.value, vr: 'e63' }, two: true }),
  L: p => ({ ll: { k: 'L', n: 4, v: p.value }, two: true }), LDR: () => ({ ll: { k: 'LDR', n: 2, v: 'LDR' }, two: true }), NTC: p => ({ ll: { k: 'NTC', n: 2, v: p.value }, two: true }), PTC: p => ({ ll: { k: 'PTC', n: 2, v: p.value }, two: true }),
  D: p => ({ ll: { k: 'D', n: 4, v: p.value || '1N4148', vr: DIODE_VR[S(p.value).toUpperCase()] || 'd4148' }, two: true }), ZD: p => ({ ll: { k: 'D', n: 4, v: 'BZX55C' + S(p.value).replace('.', 'V'), vr: 'dz' }, two: true }),
  SCHOTTKY: p => ({ ll: { k: 'D', n: 4, v: p.value || '1N5819', vr: 'd5819' }, two: true }), DIAC: () => ({ ll: { k: 'D', n: 4, v: 'DB3', vr: 'diac' }, two: true }),
  LED: p => ({ ll: { k: 'LED', n: 1, v: p.value, vr: '5' }, two: true }), PHT: p => ({ ll: { k: 'PHT', n: 1, v: p.value || 'BPW40' }, two: true }), LAMP: p => ({ ll: { k: 'LAMP', n: 3, v: p.value || '6V 0.1A' }, two: true }),
  SPK: p => ({ ll: { k: 'SPK', n: 4, v: p.value }, two: true }), VDR: p => ({ ll: { k: 'VDR', n: 2, v: p.value }, two: true }), XTAL: p => ({ ll: { k: 'Q', n: 2, v: p.value }, two: true }), PIEZO: () => ({ ll: { k: 'BZ', n: 3, v: 'Piezo' }, two: true }),
  FUSE: p => ({ ll: { k: 'FUSE', n: 5, v: p.value }, two: true }), DUOLED: p => ({ ll: { k: 'DUOLED', v: p.value || 'Kathode' } }),
  POT: p => ({ ll: { k: 'P', v: p.value } }), NPN: p => ({ ll: { k: 'T', v: p.value, vr: 'npn-cbe' } }), PNP: p => ({ ll: { k: 'T', v: p.value, vr: 'pnp-cbe' } }), THY: p => ({ ll: { k: 'THY', v: p.value } }),
  REG: p => ({ ll: { k: 'U', v: p.value || '7805' } }), TRIAC: p => ({ ll: { k: 'TRIAC', v: p.value } }), OPTO: p => ({ ll: { k: 'OPTO', v: p.value } }), TRF: p => ({ ll: { k: 'TRF', v: p.value } }),
  NMOS: (p, env) => ({ ll: fet('n-', p, env) }), PMOS: (p, env) => ({ ll: fet('p-', p, env) }),
  RLY: p => ({ ll: { k: 'RLY', v: p.value || '12V', vr: /^5/.test(p.value) ? 'r5' : /^24/.test(p.value) ? 'r24' : 'r12' } }),
  SEG8: p => ({ ll: { k: 'SEG7', vr: p.props && /a/i.test(S(p.props.vr)) ? 'ma' : 'mk', v: 'TDSO 3160 M' } }),
  PB: () => ({ ll: { k: 'SW', vr: 'k2', v: '' } }), SPST: () => ({ ll: { k: 'SCH', vr: 'k3', n: 3, v: '' }, map: { '1': 1, '2': 0 } }), SPDT: () => ({ ll: { k: 'SCH', vr: 'k3', n: 3, v: '' } }),
  ICX: (p, env, np) => ({ ll: { k: 'IC', n: np, v: p.value, sk: true } }), KL: (p, env, np) => ({ ll: { k: 'KL', n: np, v: '' } }), MOTOR: (p, env, np) => ({ ll: { k: 'KL', n: np, v: '' } }),
  SIP: (p, env, np) => ({ ll: { k: 'SIP', n: np, v: p.value } }), UNO: () => ({ ll: { k: 'UNO', v: 'Uno R3' } }), PI: () => ({ ll: { k: 'PI', v: 'Pi GPIO' } }),
  BAT: (p, env, np, N) => { const x = N && N.num ? N.num(p.value) : parseFloat(p.value), n = isFinite(x) && x > 0 ? x : 9; return { ll: { k: 'BAT', v: n + 'V', vr: n === 9 ? 'blk' : 'psu' }, two: true }; },
  AC: p => ({ ll: { k: 'SIG', v: p.value || '5V 1kHz', vr: 'sin' }, two: true })
};
function fet(pre, p, env) { const id = pre + S(p.value).toLowerCase(), has = ((env.PARTS.FET || {}).variants || []).some(v => v.id === id); return { k: 'FET', v: p.value, vr: has ? id : undefined }; }
/* Gatter -> Standard-ICs (wie addLogic des Schaltplans): 7408 UND, 7400 NAND, 7432 ODER, 7402 NOR, 7486 XOR, 7404 NICHT, 7474 D-Flipflop, LM358 */
const GATE_IC = { AND: ['7408', 'q'], NAND: ['7400', 'q'], OR: ['7432', 'q'], NOR: ['7402', 'n'], XOR: ['7486', 'q'], NOT: ['7404', 'h'], SNOT: ['7414', 'h'], DFF: ['7474', 'd'], OPA: ['LM358', 'o'] };
const SLOTS = { q: [[1, 2, 3], [4, 5, 6], [9, 10, 8], [12, 13, 11]], n: [[2, 3, 1], [5, 6, 4], [8, 9, 10], [11, 12, 13]], h: [[1, 2], [3, 4], [5, 6], [9, 8], [11, 10], [13, 12]], d: [[2, 3, 5, 6, 1, 4], [12, 11, 9, 8, 13, 10]], o: [[3, 2, 1, 8, 4], [5, 6, 7, 8, 4]] };
const GATECLS = {}; Object.keys(GATE_IC).forEach(k => { GATECLS[GATE_IC[k][0]] = GATE_IC[k][1]; });
const GNAMES = { AND: ['A', 'B', 'Y'], NAND: ['A', 'B', 'Y'], OR: ['A', 'B', 'Y'], NOR: ['A', 'B', 'Y'], XOR: ['A', 'B', 'Y'], NOT: ['A', 'Y'], SNOT: ['A', 'Y'], DFF: ['D', 'CLK', 'Q', 'QN'], OPA: ['IN+', 'IN-', 'OUT', 'V+', 'V-'] };

function jobFromNetlist(nl0, env, N, o) {
  o = o || {};
  const job = { name: S(nl0 && nl0.name) || 'Schaltung', parts: [], notes: { skipped: [], ext: [], logic: [] }, ok: false, errs: [] };
  const r = N && N.normalize ? N.normalize(nl0, { lenient: true, warnSingle: false }) : { ok: isO(nl0) && isA(nl0.parts), nl: nl0, errs: ['Netzliste ungültig'] };
  if (!r.ok) { job.errs = r.errs; return job; }
  const nl = r.nl, cand = [], gates = {}, netNames = new Set(nl.nets.map(n => n.name));
  const netOf = (p, nm) => (o.route === false ? null : (p.pins && p.pins[nm] ? p.pins[nm] : null));
  nl.parts.forEach(p => {
    if (GATE_IC[p.kind]) { const key = GATE_IC[p.kind][0] + '|' + GATE_IC[p.kind][1]; (gates[key] = gates[key] || []).push(p); return; }
    const rv = REV[p.kind];
    if (!rv) { job.notes.skipped.push(p.ref + ' (' + p.kind + ')'); return; }
    const np = (N && N.pinCount) ? N.pinCount(p.kind, p) : Math.max(2, (p.props && p.props.n) || 0), x = rv(p, env, np, N), ll = x.ll;
    if (ll.v === undefined || ll.v === '') delete ll.v; if (ll.vr === undefined) delete ll.vr;
    const f = fwd(Object.assign({ x: 0, y: 0, r: 0 }, ll), env), names = f && f.subs && f.subs[0].names || [], map = x.map || {}, pins = new Array(names.length).fill(null), nm0 = Object.keys(p.pins || {});
    nm0.forEach(nm => { const j = nm in map ? map[nm] : names.indexOf(nm); if (j >= 0 && pins[j] === null) pins[j] = netOf(p, nm); else if (j < 0) job.notes.skipped.push(p.ref + '.' + nm + ' (Anschluss gibt es im Lochraster-Bauteil nicht)'); });
    if (ll.k === 'KL' || ll.k === 'SIP') job.notes.ext.push(p.ref);
    cand.push({ p, ll, two: !!x.two, pins, nets: new Set(pins.filter(Boolean)) });
  });
  /* Reihenfolge: zusammenhaengende Bauteile nebeneinander (gierig nach gemeinsamen Netzen; Netze mit vielen Anschluessen wie GND zaehlen nicht) */
  const deg = {}; cand.forEach(c => c.nets.forEach(n => { deg[n] = (deg[n] || 0) + 1; }));
  const seqd = [], rest = cand.slice().sort((a, b) => (b.pins.length - a.pins.length) || natCmp(a.p.ref, b.p.ref)), placed = new Set();
  while (rest.length) {
    let bi = 0, bs = -1; rest.forEach((c, i) => { let s = 0; c.nets.forEach(n => { if (placed.has(n) && deg[n] <= 6) s++; }); if (s > bs) { bs = s; bi = i; } });
    const c = rest.splice(bi, 1)[0]; seqd.push(c); c.nets.forEach(n => placed.add(n));
  }
  const total = seqd.length + Object.keys(gates).length * 2, per = Math.max(2, Math.ceil(Math.sqrt(total * 1.4)));
  const pos = i => { const row = Math.floor(i / per), col = row % 2 ? per - 1 - (i % per) : i % per; return [col * 9, row * 7]; };
  seqd.forEach((c, i) => { const [sx, sy] = pos(i); job.parts.push({ ll: c.ll, l: c.p.ref, sx, sy, sr: 0, two: c.two, pins: c.pins }); });
  /* Gatter */
  const gkeys = Object.keys(gates); let uc = 0; const un = () => '__u' + (uc++);
  const b5 = nl.parts.find(p => p.kind === 'BAT' && p.pins && p.pins['+'] && Math.abs((N && N.num ? N.num(p.value) : parseFloat(p.value)) - 5) < 0.01);      /* +5-V-Quelle des Plans versorgt die Gatter-ICs */
  const vNet = netNames.has('VCC') ? 'VCC' : (b5 ? b5.pins['+'] : null), gNet = netNames.has('GND') ? 'GND' : (b5 && b5.pins['-'] ? b5.pins['-'] : null), hasV = !!vNet, hasG = !!gNet, VCC = hasV ? vNet : '__VCC', GN = hasG ? gNet : '__GND';
  gkeys.forEach(key => {
    const [type, cls] = key.split('|'), slots = SLOTS[cls], lst = gates[key];
    for (let i = 0; i < lst.length; i += slots.length) {
      const chunk = lst.slice(i, i + slots.length), np = cls === 'o' ? 8 : 14, pins = Array.from({ length: np }, () => un());
      if (cls !== 'o') { pins[13] = VCC; pins[6] = GN; }
      slots.forEach((slot, si) => {
        const g = chunk[si];
        if (g) GNAMES[g.kind].forEach((nm, a) => { pins[slot[a] - 1] = (g.pins && g.pins[nm]) || un(); });
        else if (cls === 'q') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; } else if (cls === 'n') { pins[slot[1] - 1] = GN; pins[slot[2] - 1] = GN; }
        else if (cls === 'h') pins[slot[0] - 1] = GN; else if (cls === 'd') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; pins[slot[4] - 1] = VCC; pins[slot[5] - 1] = VCC; } else if (cls === 'o') { pins[slot[0] - 1] = GN; pins[slot[1] - 1] = GN; }
      });
      if (cls === 'o' && chunk.length === 1) { pins[slots[1][0] - 1] = GN; pins[slots[1][1] - 1] = GN; pins[6] = un(); }
      const [sx, sy] = pos(job.parts.length);
      job.parts.push({ ll: { k: 'IC', n: np, v: type, sk: true }, l: 'IC' + (job.parts.length + 1) + '_' + type, sx, sy, sr: 0, two: false, pins: o.route === false ? pins.map(() => null) : pins, gates: chunk.map(g => ({ ref: g.ref, kind: g.kind })) });
      job.notes.logic.push(chunk.map(g => g.ref).join(', ') + ': ' + type + ' mit ' + chunk.length + ' Gatter(n)');
    }
  });
  if (gkeys.length && (!hasV || !hasG)) { const [sx, sy] = pos(job.parts.length); job.parts.push({ ll: { k: 'KL', n: 2, v: '' }, l: 'Vcc', sx, sy, sr: 0, two: false, pins: o.route === false ? [null, null] : [VCC, GN] }); job.notes.ext.push('Vcc und GND für die Gatter-ICs'); }
  job.ok = true; return job;
}

/* ====================================================================== Hilfen */
const cleanDoc = d => { const c = clone(d); delete c.id; delete c.updated; return c; };      /* deterministisch (Pruefsumme der Huelle) */
const ribbonCount = d => (d && isA(d.items) ? d.items.filter(i => i.t === 'ribbon').reduce((a, r) => a + (r.n || 0), 0) : 0);
const hook = () => root.LochVerbund || null;
const NL = () => (root.Verbund && root.Verbund.nl) || root.VerbundNL || (typeof require === 'function' ? (() => { try { return require('./verbundnl.js'); } catch (e) { return null; } })() : null);
const firstNetlist = (st, ctx) => { const L = (st && st.in) || []; for (const s of L) { let d = null; try { d = ctx.get(s); } catch (e) {} if (d && d.netlist) return { slot: s, nl: d.netlist, data: d }; } return null; };

const adapter = {
  lab: 'loch',
  ready() { const h = hook(); return !!(h && h.env && root.LochSim); },
  apply(st, ctx) {
    const h = hook(); if (!h) return { ok: false, msg: 'LochLab ist noch nicht bereit.' };
    if (ctx.solution && ctx.solution.data) {
      const d = ctx.solution.data;
      const items = d.doc && Array.isArray(d.doc.items) ? d.doc.items : [], wired = items.some(i => i && i.t && i.t !== 'part');   // Musterlösungen mancher Projekte tragen nur Bauteile oder gar kein Dokument: dann verdrahtet das Lab selbst
      if (items.length && (wired || !d.netlist)) return h.load(d.doc, d.name || 'Musterlösung') ? { ok: true, msg: 'Musterlösung geladen. Deine Arbeit ist gesichert.' } : { ok: false, msg: 'Die Musterlösung konnte nicht geladen werden.' };
      if (d.netlist) { const r = h.placeFromNetlist(d.netlist, { route: true }); if (!r || !r.ok) return { ok: false, msg: 'Die Musterlösung konnte nicht platziert werden.' };
        const nr = (r.notRouted || []).concat(r.notPlaced || []);
        return { ok: true, msg: 'Musterlösung (Bauteile platziert, vom Lab automatisch verdrahtet) geladen. Deine Arbeit ist gesichert.' + (nr.length ? ' Nicht vollständig: ' + nr.slice(0, 4).join(', ') + (nr.length > 4 ? ' u. a.' : '') + '. Ergänze von Hand.' : '') + (d.boards > 1 ? ' Die Platinen und Flachbandkabel richtest du selbst ein.' : '') }; }
      return { ok: false, msg: 'Die Musterlösung enthält kein Layout.' };
    }
    const inp = firstNetlist(st, ctx);
    if (!inp) return { ok: false, msg: 'Die Netzliste aus der Vorstation fehlt (Eingang). Bitte zuerst die Vorstation bestehen.' };
    const r = h.placeFromNetlist(inp.nl, { route: !!ctx.assist });
    if (!r || !r.ok) return { ok: false, msg: (r && r.err) || 'Die Bauteile konnten nicht auf die Platine gelegt werden.' };
    const bad = (r.notPlaced || []).concat((r.notRouted || []).map(n => 'Netz ' + n));
    return { ok: true, msg: (ctx.assist ? 'Bauteile liegen auf der Platine, Verbindungen sind als Vorschlag gezogen. ' : 'Bauteile liegen auf der Platine, die Verbindungen ziehst du selbst. ') + 'Deine Arbeit ist gesichert.' + (bad.length ? ' Nicht untergebracht: ' + bad.slice(0, 4).join(', ') + '.' : '') };
  },
  collect(st, ctx) {
    const h = hook(); if (!h) return { error: 'LochLab ist noch nicht bereit.' };
    const doc = h.doc(); if (!doc) return { error: 'Das Lochraster-Dokument konnte nicht gelesen werden.' };
    const r = netlistFromDoc(doc, h.env(), NL());
    if (!r.ok) return { error: 'Die Netzliste konnte nicht gelesen werden: ' + (r.errs[0] || 'unbekannter Fehler') };
    if (!r.nl.parts.length) return { error: 'Auf der Platine liegen noch keine Bauteile.' };
    const data = { name: S(doc.name) || 'Lochraster', netlist: r.nl, boards: h.boards() || 1, bom: r.bom, doc: cleanDoc(doc), wiresRibbon: ribbonCount(doc) };
    if (r.unmapped.length) data.unmapped = r.unmapped;
    return { type: 'loch.layout', data };
  },
  live(st, ctx) {
    const h = hook(), rows = []; if (!h) return rows;
    const doc = h.doc(); if (!doc) return rows;
    try { if (root.LochTasks && root.LochTasks.layoutCheck) root.LochTasks.layoutCheck(doc).forEach(l => rows.push({ ok: !!l.ok, text: l.text })); } catch (e) { /* ohne Layout-Check */ }
    const inp = firstNetlist(st, ctx), N = NL();
    if (inp && N && N.equiv) {
      const r = netlistFromDoc(doc, h.env(), N);
      if (r.ok) { const q = N.equiv(inp.nl, r.nl, { ignoreKinds: ['GND', 'VM', 'AM', 'OHM', 'ISO', 'ZS'] }); if (q.ok) rows.push({ ok: true, text: 'Netze stimmen mit dem Schaltplan überein.' }); else q.errs.slice(0, 3).forEach(e => rows.push({ ok: false, text: e })); }
    }
    return rows;
  },
  pure: { netlistFromDoc, jobFromNetlist, cleanDoc, ribbonCount, FWD, REV, fwd, vOf }
};

root.VerbundAdLoch = adapter;
try {
  if (root.Verbund && typeof root.Verbund.registerAdapter === 'function') root.Verbund.registerAdapter('loch', adapter);
  else if (typeof require === 'function' && typeof module !== 'undefined') { try { require('./verbund.js').registerAdapter('loch', adapter); } catch (e) { /* ohne Kern */ } }
  else { root.VERBUND_ADAPTERS = root.VERBUND_ADAPTERS || {}; root.VERBUND_ADAPTERS.loch = adapter; }
} catch (e) { /* Anmeldung nicht moeglich */ }
if (typeof module !== 'undefined' && module.exports) module.exports = adapter;
})(typeof window !== 'undefined' ? window : globalThis);
