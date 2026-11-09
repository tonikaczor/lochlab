'use strict';
/* Tonfunk DigiLab: Beispiele, Aufgaben und Werkzeuge der Digitaltechnik.
   Die Schaltungen werden aus einer logischen Beschreibung (Eingänge, Gatter, Ausgänge) automatisch platziert und per Auto-Weg verdrahtet.
   schaltplan.js ruft DIGI_DEF(api) auf, bevor das Lab startet. */
(function (root) {
  const OUTPIN = { AND: 2, NAND: 2, OR: 2, NOR: 2, XOR: 2, NOT: 1, SNOT: 1, DFF: 2, JKFF: 3, TFF: 2 };
  const QNPIN = { DFF: 3, JKFF: 4, TFF: 3 };
  const INPINS = { AND: [0, 1], NAND: [0, 1], OR: [0, 1], NOR: [0, 1], XOR: [0, 1], NOT: [0], SNOT: [0], DFF: [0, 1], JKFF: [0, 2, 1], TFF: [0, 1] };   // JK: Eingabereihenfolge J, K, Takt
  const HEIGHT = { AND: 3, NAND: 3, OR: 3, NOR: 3, XOR: 3, NOT: 2, SNOT: 2, DFF: 3, JKFF: 5, TFF: 3 };

  /* ---------- automatische Platzierung und Verdrahtung ---------- */
  /* Mehrere Abstände probieren und die Anordnung mit den wenigsten Verdrahtungsproblemen nehmen */
  function layout(api, spec) {
    let best = null, bf = 1e9;
    for (const sp of [1, 1.4, 1.8]) {
      const before = api.routeFails || 0, L = layoutOnce(api, spec, sp), f = (api.routeFails || 0) - before;
      api.routeFails = before; if (f < bf) { best = L; bf = f; } if (f === 0) break;
    }
    api.routeFails = (api.routeFails || 0) + bf; if (best) best.fails = bf; return best;
  }
  function layoutOnce(api, spec, sp) {
    sp = sp || 1;
    const rows = [], add = r => { rows.push(r); return rows.length - 1; };
    const ins = spec.inputs || [], gates = spec.gates || [], outs = spec.outputs || [];
    const iBat = add(['BAT', 2, 3, 1, '5']); add(['GND', 2, 7]);
    const inIdx = {}; ins.forEach((nm, i) => { inIdx[nm] = add(['SPST', 6, 3 + 4 * i, 0, '', { sw: (spec.on || []).includes(nm) ? 1 : 0, l: nm }]); });
    let iClk = -1; if (spec.clk) { const yc = Math.max(12, 3 + 4 * ins.length + 2); iClk = add(['CLK', 2, yc, 1, spec.clk]); add(['GND', 2, yc + 4]); }
    const gid = {}; gates.forEach((g, i) => { gid[g.id] = i; });
    const refName = r => String(r).replace(/\.n$/, '');
    // Tiefe der Gatter (Rückkopplungen werden übergangen)
    const depth = {}, visiting = new Set();
    const dep = id => {
      if (depth[id] != null) return depth[id]; if (visiting.has(id)) return 0; visiting.add(id);
      let m = 0; (gates[gid[id]].in || []).forEach(r => { const n = refName(r); if (gid[n] != null) m = Math.max(m, dep(n)); });
      visiting.delete(id); depth[id] = m + 1; return depth[id];
    };
    gates.forEach(g => dep(g.id));
    const maxD = gates.reduce((m, g) => Math.max(m, depth[g.id]), 1);
    const gy = {}, gRow = {};
    const srcY = r => { const n = refName(r); if (gy[n] != null) return gy[n] + 1; if (inIdx[n] != null) return rows[inIdx[n]][2]; if (n === 'CLK') return iClk >= 0 ? rows[iClk][2] : 3; return 3; };
    for (let dd = 1; dd <= maxD; dd++) {
      const col = gates.filter(g => depth[g.id] === dd).map(g => ({ g, pref: (g.in || []).reduce((s, r) => s + srcY(r), 0) / Math.max(1, (g.in || []).length) - 1 }));
      col.sort((a, b) => a.pref - b.pref); let last = -99, lastH = 0;
      col.forEach(({ g, pref }) => { const y = Math.max(Math.round(pref * sp), last + lastH + Math.round(2 * sp + 0.5), 2); gy[g.id] = y; last = y; lastH = HEIGHT[g.t]; gRow[g.id] = add([g.t, 16 + Math.round((dd - 1) * 10 * sp), y, 0, '5V', g.l ? { l: g.l } : undefined]); });
    }
    // Ausgänge: Widerstand und LED rechts der letzten Spalte
    const xo = 16 + Math.round(maxD * 10 * sp), outRows = []; let lastYo = -99;
    outs.forEach(o => {
      const src = refName(o.src); let y = Math.round(srcY(o.src) - (gy[src] != null ? 0 : 0)); if (gy[src] != null) y = gy[src] + (o.src.endsWith('.n') && QNPIN[gates[gid[src]].t] === 4 ? 4 : (o.src.endsWith('.n') ? 2 : (OUTPIN[gates[gid[src]].t] === 1 ? 1 : (gates[gid[src]].t === 'JKFF' ? 0 : (gates[gid[src]].t === 'DFF' || gates[gid[src]].t === 'TFF' ? 0 : 1)))));
      y = Math.max(y, lastYo + 5); lastYo = y;
      const r = add(['R', xo, y, 0, '330']), l = add(['LED', xo + 4, y, 1, o.color || 'rot', { l: o.name }]); add(['GND', xo + 4, y + 4]); outRows.push({ o, r, l });
    });
    const P = api.pinPts(rows);
    const pt = (idx, k) => P[idx][k];
    const srcPt = r => {
      const n = refName(r), qn = /\.n$/.test(r);
      if (n === 'CLK') return pt(iClk, 0);
      if (inIdx[n] != null) return pt(inIdx[n], 1);
      const g = gates[gid[n]]; return pt(gRow[n], qn ? QNPIN[g.t] : OUTPIN[g.t]);
    };
    // Netze: Quelle -> alle Senken
    const sinks = new Map(), constH = [], extra = [];
    const addSink = (r, p) => { if (r === 'H') { constH.push(p); return; } if (r === 'L') { extra.push(['GND', p[0], p[1]]); return; } const k = r; if (!sinks.has(k)) sinks.set(k, []); sinks.get(k).push(p); };
    gates.forEach(g => (g.in || []).forEach((r, i) => addSink(r, pt(gRow[g.id], INPINS[g.t][i]))));
    outRows.forEach(({ o, r }) => addSink(o.src, pt(r, 0)));
    const near = (from, list) => { const rest = list.slice(), out = []; let cur = from; while (rest.length) { let bi = 0, bd = 1e9; rest.forEach((q, i) => { const dd = Math.abs(q[0] - cur[0]) + Math.abs(q[1] - cur[1]); if (dd < bd) { bd = dd; bi = i; } }); cur = rest.splice(bi, 1)[0]; out.push(cur); } return out; };
    const nets = [];
    const sup = []; ins.forEach(nm => sup.push(pt(inIdx[nm], 0))); constH.forEach(p => sup.push(p));
    if (sup.length) nets.push([pt(iBat, 0)].concat(near(pt(iBat, 0), sup)));
    sinks.forEach((list, r) => { nets.push([srcPt(r)].concat(near(srcPt(r), list))); });
    extra.forEach(e => rows.push(e));
    const wires = api.routeNets(rows, nets);
    const ledIds = outRows.map(x => x.l);
    return { parts: rows, wires, scopes: (spec.scope || ledIds.slice(0, 4)), tempo: spec.tempo != null ? spec.tempo : 0.75, win: spec.win || 4, code: spec.code };
  }

  /* ---------- Beispiele (logische Beschreibung) ---------- */
  const SPECS = [
    { cat: 'Grundlagen', name: 'Grundgatter: UND, ODER, NICHT', info: 'Zwei Schalter, drei Gatter, drei LEDs: Probiere alle vier Eingangskombinationen aus.',
      inputs: ['A', 'B'], gates: [{ id: 'g1', t: 'AND', in: ['A', 'B'] }, { id: 'g2', t: 'OR', in: ['A', 'B'] }, { id: 'g3', t: 'NOT', in: ['A'] }], outputs: [{ name: 'UND', src: 'g1', color: 'grün' }, { name: 'ODER', src: 'g2', color: 'gelb' }, { name: 'NICHT A', src: 'g3', color: 'rot' }] },
    { cat: 'Grundlagen', name: 'NAND ist universell', info: 'Aus NAND-Gattern lassen sich NICHT, UND und ODER bauen.',
      inputs: ['A', 'B'], gates: [{ id: 'n1', t: 'NAND', in: ['A', 'A'] }, { id: 'n2', t: 'NAND', in: ['A', 'B'] }, { id: 'n3', t: 'NAND', in: ['n2', 'n2'] }, { id: 'n5', t: 'NAND', in: ['A', 'A'] }, { id: 'n6', t: 'NAND', in: ['B', 'B'] }, { id: 'n7', t: 'NAND', in: ['n5', 'n6'] }],
      outputs: [{ name: 'NICHT A', src: 'n1', color: 'rot' }, { name: 'UND', src: 'n3', color: 'grün' }, { name: 'ODER', src: 'n7', color: 'gelb' }] },
    { cat: 'Rechenwerke', name: 'Halbaddierer', info: 'Addiert zwei Bits: Summe ist XOR, Übertrag ist UND.',
      inputs: ['A', 'B'], gates: [{ id: 'x', t: 'XOR', in: ['A', 'B'] }, { id: 'u', t: 'AND', in: ['A', 'B'] }], outputs: [{ name: 'Summe', src: 'x', color: 'grün' }, { name: 'Übertrag', src: 'u', color: 'gelb' }] },
    { cat: 'Rechenwerke', name: 'Volladdierer', info: 'Addiert drei Bits (A, B und Übertrag davor) aus zwei Halbaddierern und einem ODER.',
      inputs: ['A', 'B', 'Cin'], gates: [{ id: 'x1', t: 'XOR', in: ['A', 'B'] }, { id: 'a1', t: 'AND', in: ['A', 'B'] }, { id: 'x2', t: 'XOR', in: ['x1', 'Cin'] }, { id: 'a2', t: 'AND', in: ['x1', 'Cin'] }, { id: 'co', t: 'OR', in: ['a1', 'a2'] }],
      outputs: [{ name: 'Summe', src: 'x2', color: 'grün' }, { name: 'Cout', src: 'co', color: 'gelb' }] },
    { cat: 'Schaltnetze', name: '2:1-Multiplexer', info: 'Der Schalter S wählt, ob A oder B am Ausgang Y erscheint.',
      inputs: ['A', 'B', 'S'], gates: [{ id: 'ns', t: 'NOT', in: ['S'] }, { id: 'a1', t: 'AND', in: ['A', 'ns'] }, { id: 'a2', t: 'AND', in: ['B', 'S'] }, { id: 'y', t: 'OR', in: ['a1', 'a2'] }], outputs: [{ name: 'Y', src: 'y', color: 'grün' }] },
    { cat: 'Schaltnetze', name: 'Mehrheitsfunktion (2 aus 3)', info: 'Der Ausgang ist 1, wenn mindestens zwei der drei Eingänge 1 sind. Gut für die Wahrheitstabelle.',
      inputs: ['A', 'B', 'C'], gates: [{ id: 'g1', t: 'AND', in: ['A', 'B'] }, { id: 'g2', t: 'AND', in: ['A', 'C'] }, { id: 'g3', t: 'AND', in: ['B', 'C'] }, { id: 'o1', t: 'OR', in: ['g1', 'g2'] }, { id: 'o2', t: 'OR', in: ['o1', 'g3'] }], outputs: [{ name: 'M', src: 'o2', color: 'grün' }] },
    { cat: 'Speicher', name: 'SR-Speicher aus NOR-Gattern', info: 'S setzt, R löscht. Bei S = R = 0 merkt sich das Gatterpaar den letzten Zustand.',
      inputs: ['S', 'R'], gates: [{ id: 'g1', t: 'NOR', in: ['R', 'g2'] }, { id: 'g2', t: 'NOR', in: ['S', 'g1'] }], outputs: [{ name: 'Q', src: 'g1', color: 'grün' }, { name: 'Q̄', src: 'g2', color: 'rot' }], scope: [] },
    { cat: 'Speicher', name: 'D-Flipflop teilt den Takt durch 2', info: 'Der Ausgang Q̄ geht zurück an D: Bei jeder steigenden Taktflanke kippt Q. Q blinkt halb so schnell wie der Takt.',
      inputs: [], clk: '2Hz', gates: [{ id: 'ff', t: 'DFF', in: ['ff.n', 'CLK'] }], outputs: [{ name: 'Takt', src: 'CLK', color: 'gelb' }, { name: 'Q', src: 'ff', color: 'grün' }], tempo: 0.75, win: 4 },
    { cat: 'Zähler', name: '4-Bit-Binärzähler', info: 'Vier T-Flipflops in Reihe zählen die Takte binär von 0 bis 15. Das Zeitdiagramm zeigt die Teilerkette.',
      inputs: [], clk: '4Hz', gates: [{ id: 'f0', t: 'TFF', in: ['H', 'CLK'] }, { id: 'f1', t: 'TFF', in: ['H', 'f0.n'] }, { id: 'f2', t: 'TFF', in: ['H', 'f1.n'] }, { id: 'f3', t: 'TFF', in: ['H', 'f2.n'] }],
      outputs: [{ name: 'Q0', src: 'f0', color: 'grün' }, { name: 'Q1', src: 'f1', color: 'grün' }, { name: 'Q2', src: 'f2', color: 'gelb' }, { name: 'Q3', src: 'f3', color: 'rot' }], scope: [], win: 8 },
    { cat: 'Schieberegister', name: '4-Bit-Schieberegister', info: 'Bei jeder Taktflanke rutscht das Bit eine Stelle weiter. Schalter D legt fest, was von links hineinläuft.',
      inputs: ['D'], clk: '1Hz', gates: [{ id: 'f1', t: 'DFF', in: ['D', 'CLK'] }, { id: 'f2', t: 'DFF', in: ['f1', 'CLK'] }, { id: 'f3', t: 'DFF', in: ['f2', 'CLK'] }, { id: 'f4', t: 'DFF', in: ['f3', 'CLK'] }],
      outputs: [{ name: 'Q1', src: 'f1', color: 'grün' }, { name: 'Q2', src: 'f2', color: 'grün' }, { name: 'Q3', src: 'f3', color: 'gelb' }, { name: 'Q4', src: 'f4', color: 'rot' }], scope: [], win: 8 },
    { cat: 'Speicher', name: 'JK-Flipflop: Setzen, Rücksetzen, Kippen', info: 'Bei jeder steigenden Taktflanke gilt: J = 1 und K = 0 setzt, J = 0 und K = 1 setzt zurück, J = K = 1 kippt, J = K = 0 speichert. Stelle J und K um und beobachte Q im Zeitdiagramm.',
      inputs: ['J', 'K'], clk: '1Hz', gates: [{ id: 'ff', t: 'JKFF', in: ['J', 'K', 'CLK'] }], outputs: [{ name: 'Takt', src: 'CLK', color: 'gelb' }, { name: 'Q', src: 'ff', color: 'grün' }], tempo: 0.75, win: 6 },
    { cat: 'Zähler', name: 'Asynchroner Rückwärtszähler (3 Bit)', info: 'Drei T-Flipflops, jedes wird vom Ausgang Q seines Vorgängers getaktet: Die Kette zählt 7, 6, 5 … 0 rückwärts. Mit Q̄ als Takt (wie beim Binärzähler) zählt sie aufwärts.',
      inputs: [], clk: '2Hz', gates: [{ id: 'f0', t: 'TFF', in: ['H', 'CLK'] }, { id: 'f1', t: 'TFF', in: ['H', 'f0'] }, { id: 'f2', t: 'TFF', in: ['H', 'f1'] }],
      outputs: [{ name: 'Q0', src: 'f0', color: 'grün' }, { name: 'Q1', src: 'f1', color: 'gelb' }, { name: 'Q2', src: 'f2', color: 'rot' }], scope: [], win: 8 },
  ];

  /* ---------- Vereinfachen (Quine-McCluskey) ---------- */
  const VARS = ['A', 'B', 'C', 'D', 'E'];
  function qm(minterms, n) {
    if (!minterms.length) return [];
    let cur = minterms.map(m => ({ s: m.toString(2).padStart(n, '0'), used: false })), primes = [];
    const ones = x => (x.s.match(/1/g) || []).length;
    while (cur.length) {
      const next = new Map();
      cur.forEach(a => cur.forEach(b => {
        if (ones(b) !== ones(a) + 1) return; let diff = -1, ok = true;
        for (let i = 0; i < n; i++) if (a.s[i] !== b.s[i]) { if (diff >= 0 || a.s[i] === '-' || b.s[i] === '-') { ok = false; break; } diff = i; }
        if (ok && diff >= 0) { a.used = b.used = true; const s = a.s.slice(0, diff) + '-' + a.s.slice(diff + 1); next.set(s, { s, used: false }); }
      }));
      cur.forEach(x => { if (!x.used && !primes.includes(x.s)) primes.push(x.s); });
      cur = [...next.values()];
    }
    const covers = (p, m) => { const b = m.toString(2).padStart(n, '0'); for (let i = 0; i < n; i++) if (p[i] !== '-' && p[i] !== b[i]) return false; return true; };
    const chosen = [], left = new Set(minterms);
    minterms.forEach(m => { const c = primes.filter(p => covers(p, m)); if (c.length === 1 && !chosen.includes(c[0])) chosen.push(c[0]); });
    chosen.forEach(p => minterms.forEach(m => { if (covers(p, m)) left.delete(m); }));
    while (left.size) {
      let best = null, bc = -1; primes.forEach(p => { const k = [...left].filter(m => covers(p, m)).length; if (k > bc) { bc = k; best = p; } });
      chosen.push(best); [...left].forEach(m => { if (covers(best, m)) left.delete(m); });
    }
    return chosen;
  }
  const termText = (t, names) => { const a = []; for (let i = 0; i < t.length; i++) if (t[i] !== '-') a.push((t[i] === '0' ? '¬' : '') + names[i]); return a.length ? a.join(' · ') : '1'; };
  function exprOf(minterms, n, names) {
    if (!minterms.length) return { text: '0', terms: [] };
    if (minterms.length === (1 << n)) return { text: '1', terms: ['-'.repeat(n)] };
    const terms = qm(minterms, n); return { text: terms.map(t => termText(t, names)).join(' + '), terms };
  }

  /* ---------- Wahrheitstabelle der aktuellen Schaltung ---------- */
  const labelOf = (p, i, pre) => p.l || pre + (i + 1);
  function analyse(api) {
    const sch = api.sch, ins = sch.parts.filter(p => p.k === 'SPST'), outs = sch.parts.filter(p => p.k === 'LED');
    if (!ins.length || !outs.length) return { error: 'Für eine Wahrheitstabelle brauchst du Schalter als Eingänge und LEDs als Ausgänge.' };
    if (ins.length > 5) return { error: 'Mehr als fünf Eingänge sind zu viele für die Tabelle (32 Zeilen).' };
    const SEQ = ['DFF', 'JKFF', 'TFF', 'CLK', 'CPU'], seqIC = sch.parts.some(p => p.k === 'ICX' && !/^(SN|DM)?74(HC|LS|HCT)?(00|02|04|08|32|86|14)|^(CD|HEF)?40(01|11|69|71|81|93)/i.test(String(p.v || '').replace(/[^A-Za-z0-9]/g, '')));
    if (sch.parts.some(p => SEQ.includes(p.k)) || seqIC) return { error: 'Die Schaltung enthält Takt oder Speicher (Flipflops, Zähler). Eine reine Wahrheitstabelle gibt es nur für Schaltnetze; schau dir stattdessen das Zeitdiagramm an.' };
    const n = ins.length, N = 1 << n, idx = [...Array(N).keys()];
    const on = (E, o) => E.c.elems.some(e => e.led && e.part && e.part.id === o.id && Math.abs(e.i || 0) > 0.002);
    const run = order => { const res = []; order.forEach(c => { const set = {}; ins.forEach((p, i) => { set[p.id] = (c >> (n - 1 - i)) & 1; }); const E = api.simEval({ set }); E.run(0.06); res[c] = outs.map(o => on(E, o) ? 1 : 0); }); return res; };
    const f = run(idx), b = run(idx.slice().reverse()), mem = idx.some(c => f[c].join() !== b[c].join());
    const inNames = ins.map((p, i) => labelOf(p, i, 'S')), outNames = outs.map((p, i) => labelOf(p, i, 'LED'));
    return { ins, outs, inNames, outNames, rows: f, mem, n, N };
  }
  /* aus der Analyse die Funktionsgleichungen */
  function exprs(an) {
    const names = an.inNames.map((x, i) => (x.length === 1 ? x : VARS[i]));
    return an.outNames.map((nm, j) => { const mt = []; for (let c = 0; c < an.N; c++) if (an.rows[c][j]) mt.push(c); return Object.assign({ name: nm }, exprOf(mt, an.n, names)); });
  }

  /* ---------- Schaltung aus Tabelle bauen ---------- */
  function specFromTable(n, outsCols, names) {
    const inputs = names.slice(0, n), gates = [], outputs = [], used = new Set();
    const inv = x => { const id = 'n_' + x; if (!used.has(id)) { used.add(id); gates.push({ id, t: 'NOT', in: [x] }); } return id; };
    outsCols.forEach((col, j) => {
      const mt = []; col.forEach((v, c) => { if (v) mt.push(c); });
      const e = exprOf(mt, n, names); if (e.text === '0' || e.text === '1') return;
      const termRefs = e.terms.map((t, k) => {
        const lits = []; for (let i = 0; i < n; i++) if (t[i] !== '-') lits.push(t[i] === '1' ? names[i] : inv(names[i]));
        let ref = lits[0]; for (let q = 1; q < lits.length; q++) { const id = 'y' + j + 'a' + k + '_' + q; gates.push({ id, t: 'AND', in: [ref, lits[q]] }); ref = id; }
        return ref;
      });
      let ref = termRefs[0]; for (let q = 1; q < termRefs.length; q++) { const id = 'y' + j + 'o' + q; gates.push({ id, t: 'OR', in: [ref, termRefs[q]] }); ref = id; }
      outputs.push({ name: 'Y' + (j + 1), src: ref, color: j ? 'gelb' : 'grün' });
    });
    return { inputs, gates, outputs, scope: [] };
  }

  /* ---------- Zahlenumrechner ---------- */
  const pad = (s, n) => String(s).padStart(n, '0');
  function conv(v, base) { const n = parseInt(String(v).trim().replace(/^0[xb]/i, ''), base); return isNaN(n) ? null : n; }

  /* ---------- Mini-CPU-Beispiele ---------- */
  function cpuLayout(api, o) {
    const rows = [], add = r => { rows.push(r); return rows.length - 1; };
    const iBat = add(['BAT', 2, 3, 1, '5']); add(['GND', 2, 7]);
    const iClk = add(['CLK', 2, 12, 1, o.clk || '4Hz']); add(['GND', 2, 16]);
    const nIn = o.inputs || 0, iSw = [], iPd = []; for (let i = 0; i < nIn; i++) { iSw.push(add(['SPST', 8, 20 + 8 * i, 0, '', { l: 'IN' + i }])); iPd.push(add(['R', 18, 22 + 8 * i, 1, '10k'])); add(['GND', 18, 26 + 8 * i]); }
    const iCpu = add(['CPU', 22, 2, 0, 'CPU4', { n: 16 }]), iRst = add(['GND', 18, 4]);
    const ledRows = []; for (let i = 0; i < 4; i++) { const y = 4 + 3 * i, r = add(['R', 34, y, 0, '330']), l = add(['LED', 38, y, 0, i === 3 ? 'rot' : (i === 2 ? 'gelb' : 'grün'), { l: 'Q' + i }]); add(['GND', 42, y]); ledRows.push([r, l]); }
    const P = api.pinPts(rows), cp = k => (k <= 8 ? [22, 2 + 2 * (k - 1)] : [28, 2 + 2 * (16 - k)]);
    const nets = [[P[iBat][0], cp(16)], [P[iClk][0], cp(1)], [cp(2), [18, 4]]];
    const supply = iSw.map(i => P[i][0]); if (supply.length) nets.push([P[iBat][0]].concat(supply));
    iSw.forEach((i, k) => nets.push([P[i][1], P[iPd[k]][0], cp(3 + k)]));
    ledRows.forEach(([r], i) => nets.push([cp(14 - i), P[r][0]]));
    rows.push(['GND', 22, 16]);
    const wires = api.routeNets(rows, nets);
    return { parts: rows, wires, scopes: ledRows.map(([, l]) => l), tempo: 0.75, win: 6, code: o.code };
  }
  const CPU_EX = [
    { cat: 'Mini-CPU', name: 'Mini-CPU: Zähler', info: 'Die CPU zählt mit jedem Takt von 0 bis 15 und zeigt die Zahl binär auf vier LEDs. Öffne das Programm im Menü „Mini-CPU: Programm“.', o: { clk: '4Hz', code: 'start:  LDI 0\nloop:   OUT\n        INC\n        JMP loop\n' } },
    { cat: 'Mini-CPU', name: 'Mini-CPU: Lauflicht', info: 'Ein einzelnes Licht wandert durch die vier LEDs. SHL schiebt das Bit nach links, JNC prüft den Übertrag.', o: { clk: '6Hz', code: 'start:  LDI 1\nloop:   OUT\n        SHL\n        JNC loop      ; C wird 1, wenn das Bit links herausfällt\n        JMP start\n' } },
    { cat: 'Mini-CPU', name: 'Mini-CPU: Eingabe plus 3', info: 'Die vier Schalter IN0 bis IN3 sind eine Zahl (die 10-kΩ-Widerstände ziehen offene Eingänge auf Low: Pull-down). Die CPU liest sie, addiert 3 und zeigt das Ergebnis auf den LEDs.', o: { clk: '20Hz', inputs: 4, code: 'loop:   IN\n        ADDI 3\n        OUT\n        JMP loop\n' } },
    { cat: 'Mini-CPU', name: 'Mini-CPU: Unterprogramm', info: 'CALL ruft ein Unterprogramm auf, RET springt zurück. Das Hauptprogramm gibt 5 und 10 aus, die Ausgabe selbst steckt in einem Unterprogramm. Im Editor siehst du den Rücksprung-Stapel.', o: { clk: '8Hz', code: 'start:  LDI 5\n        CALL zeige    ; Unterprogramm aufrufen\n        LDI 10\n        CALL zeige\n        JMP start\nzeige:  OUT           ; Unterprogramm: Wert ausgeben ...\n        NOP\n        NOP\n        RET           ; ... und zurück\n' } },
    { cat: 'Mini-CPU', name: 'Mini-CPU: Fibonacci', info: 'Die Zahlenfolge 1, 1, 2, 3, 5, 8, 13 entsteht durch Addieren der letzten beiden Zahlen (RAM als Zwischenspeicher).', o: { clk: '3Hz', code: '        LDI 0\n        STA 0\n        LDI 1\n        STA 1\nloop:   LDA 1\n        OUT\n        LDB 0\n        ADD\n        JC reset\n        LDB 1\n        STB 0\n        STA 1\n        JMP loop\nreset:  JMP 0\n' } },
  ];
  /* ---------- Prozessor-Modus 8085: Layout und Beispiele (Baustein siehe cpu85.js, 24 Pins) ---------- */
  function cpu85Layout(api, o) {
    const rows = [], add = r => { rows.push(r); return rows.length - 1; };
    const iBat = add(['BAT', 2, 3, 1, '5']); add(['GND', 2, 7]);
    const iClk = add(['CLK', 2, 12, 1, o.clk || '4Hz']); add(['GND', 2, 16]);
    const nIn = o.inputs == null ? 8 : o.inputs, iSw = [], iPd = [], swY = [];
    for (let i = 0; i < nIn; i++) { const y = 20 + 8 * (nIn - 1 - i); swY.push(y); iSw.push(add(['SPST', 8, y, 0, '', { l: 'IN' + i }])); iPd.push(add(['R', 18, y + 2, 1, '10k'])); add(['GND', 18, y + 6]); }
    const iCpu = add(['CPU', 22, 2, 0, 'CPU85', { n: 24 }]), iRst = add(['GND', 18, 4]);
    const ledRows = []; for (let i = 7; i >= 0; i--) { const y = 4 + 3 * (7 - i), r = add(['R', 34, y, 0, '330']), l = add(['LED', 38, y, 0, i >= 4 ? 'gelb' : 'grün', { l: 'Q' + i }]); add(['GND', 42, y]); ledRows.push([r, l, i]); }
    const P = api.pinPts(rows), cp = k => (k <= 12 ? [22, 2 + 2 * (k - 1)] : [28, 2 + 2 * (24 - k)]);
    const nets = [[P[iBat][0], cp(24)], [P[iClk][0], cp(1)], [cp(2), [18, 4]]];
    const supply = iSw.map(i => P[i][0]); if (supply.length) nets.push([P[iBat][0]].concat(supply));
    iSw.forEach((i, k) => nets.push([P[i][1], P[iPd[k]][0], cp(3 + k)]));
    ledRows.forEach(([r, , bit]) => nets.push([cp(13 + bit), P[r][0]]));
    rows.push(['GND', 22, 24]);
    const wires = api.routeNets(rows, nets);
    return { parts: rows, wires, scopes: ledRows.map(([, l]) => l), tempo: 0.75, win: 6, code: o.code };
  }
  const P85 = k => (root.CPU85 && root.CPU85.PROGRAMS[k]) || '';
  const CPU85_EX = [
    { cat: 'Prozessor 8085', name: '8085: Eingabe lesen und anzeigen', info: 'Wie im Unterricht: IN liest die Eingabebaugruppe (Schalter, Adresse FBH) in den Akku, OUT schreibt den Akku auf die Ausgabebaugruppe (LED-Reihe, ebenfalls FBH). Im Menü „Prozessor 8085: Programm“ siehst du Register in Hex und Binär.', o: { clk: '10Hz', code: null, key: 'Eingabe lesen und anzeigen' } },
    { cat: 'Prozessor 8085', name: '8085: Maske mit ANI', info: 'ANI 0F0H löscht die unteren vier Bit: Die Schalter 3 bis 0 haben keine Wirkung mehr auf die LEDs.', o: { clk: '10Hz', code: null, key: 'Maske: nur die oberen vier Schalter' } },
    { cat: 'Prozessor 8085', name: '8085: Dualzähler mit Wartezeit', info: 'Der Zähler C wird mit INR erhöht und mit MOV A,C ausgegeben. Die kleine Schleife aus DCR B und JNZ ist die Wartezeit.', o: { clk: '30Hz', inputs: 0, code: null, key: 'Dualzähler mit Wartezeit' } },
    { cat: 'Prozessor 8085', name: '8085: Zähler erst nach Schalter 7', info: 'Wie die Übung aus dem Unterricht: Das Programm wartet in einer Schleife, bis Schalter 7 geschlossen ist (ANI 80H, JZ), und zählt dann los.', o: { clk: '30Hz', code: null, key: 'Zähler erst nach Schalter 7' } },
    { cat: 'Prozessor 8085', name: '8085: Stapel mit PUSH und POP', info: 'LXI SP richtet den Stapel ein. PUSH B legt das Registerpaar BC ab, POP B holt es zurück. Der Stapel arbeitet nach dem LIFO-Prinzip.', o: { clk: '10Hz', inputs: 0, code: null, key: 'Stapel: PUSH und POP' } },
    { cat: 'Prozessor 8085', name: '8085: Unterprogramm mit CALL und RET', info: 'CALL legt die Rücksprungadresse auf den Stapel und springt, RET holt sie zurück. Das Hauptprogramm zeigt abwechselnd 55H und AAH.', o: { clk: '10Hz', inputs: 0, code: null, key: 'Unterprogramm: CALL und RET' } },
    { cat: 'Prozessor 8085', name: '8085: Addition und Carry-Flag', info: 'ADI 80H addiert 128. Passt die Summe nicht in acht Bit, wird CY gesetzt, und JC springt zur Warnung (alle LEDs an).', o: { clk: '10Hz', code: null, key: 'Addition mit Übertrag (Carry)' } },
  ];
  /* ---------- Beispiele mit echten ICs ---------- */
  function icExample(api, which) {
    const rows = [], add = r => { rows.push(r); return rows.length - 1; }, nets = [], gnd = [];
    const iBat = add(['BAT', 2, 3, 1, '5']); add(['GND', 2, 7]);
    const hi = [];                                           // Pins, die auf +5 V liegen
    const sw = (x, y, name) => { const i = add(['SPST', x, y, 0, '', { l: name }]), p = add(['R', x + 8, y + 2, 1, '10k']); add(['GND', x + 8, y + 6]); return { i, p }; };
    const led = (x, y, name, col) => { const r = add(['R', x, y, 0, '330']), l = add(['LED', x + 4, y, 0, col || 'grün', { l: name }]); add(['GND', x + 8, y]); return { r, l }; };
    let spec;
    if (which === '4011') {
      const A = sw(6, 12, 'A'), B = sw(6, 24, 'B'), ic = add(['ICX', 24, 2, 0, 'CD4011', { n: 14 }]), L1 = led(36, 6, 'NAND', 'grün'), L2 = led(36, 12, 'UND', 'gelb');
      spec = { A, B, ic, L1, L2, build: P => {
        const ip = k => P[ic][k - 1];
        nets.push([P[iBat][0], ip(14), P[A.i][0], P[B.i][0]]);
        nets.push([P[A.i][1], P[A.p][0], ip(1)]); nets.push([P[B.i][1], P[B.p][0], ip(2)]);
        nets.push([ip(3), ip(5), ip(6), P[L1.r][0]]); nets.push([ip(4), P[L2.r][0]]);
        gnd.push(ip(7));
      }, scope: [L1.l, L2.l] };
    } else if (which === '7474') {
      const clk = add(['CLK', 2, 12, 1, '2Hz']); add(['GND', 2, 16]);
      const swh = (x, y, name, on) => { const i = add(['SPST', x, y, 0, '', { l: name, sw: on ? 1 : 0 }]), q = add(['R', x + 8, y + 2, 1, '10k']); add(['GND', x + 8, y + 6]); return { i, p: q }; };
      const Dd = swh(6, 22, 'D', 1), Cl = swh(6, 32, 'CLR', 1), Pr = swh(6, 42, 'PRE', 1);
      const ic = add(['ICX', 24, 2, 0, 'SN7474', { n: 14 }]), L1 = led(36, 6, 'Q', 'grün'), L2 = led(36, 12, 'Q̄', 'rot');
      spec = { build: P => {
        const ip = k => P[ic][k - 1];
        nets.push([P[iBat][0], ip(14), ip(13), ip(10), P[Dd.i][0], P[Cl.i][0], P[Pr.i][0]]);
        nets.push([P[Dd.i][1], P[Dd.p][0], ip(2)]); nets.push([P[Cl.i][1], P[Cl.p][0], ip(1)]); nets.push([P[Pr.i][1], P[Pr.p][0], ip(4)]);
        nets.push([P[clk][0], ip(3)]); nets.push([ip(5), P[L1.r][0]]); nets.push([ip(6), P[L2.r][0]]);
        gnd.push(ip(7)); gnd.push(ip(11)); gnd.push(ip(12));
      }, scope: [L1.l, L2.l] };
    } else if (which === '4017') {
      const clk = add(['CLK', 2, 12, 1, '3Hz']); add(['GND', 2, 16]);
      const ic = add(['ICX', 20, 2, 0, 'CD4017', { n: 16 }]), Ls = [0, 1, 2, 3, 4].map(i => led(34, 4 + 3 * i, 'Q' + i, i % 2 ? 'gelb' : 'grün'));
      spec = { ic, build: P => {
        const ip = k => P[ic][k - 1];
        nets.push([P[iBat][0], ip(16)]); nets.push([P[clk][0], ip(14)]); nets.push([ip(1), ip(15)]);
        [3, 2, 4, 7, 10].forEach((pin, i) => nets.push([ip(pin), P[Ls[i].r][0]]));
        gnd.push(ip(8)); gnd.push(ip(13));
      }, scope: Ls.map(x => x.l) };
    } else {
      const clk = add(['CLK', 2, 12, 1, '2Hz']); add(['GND', 2, 16]);
      const c7 = add(['ICX', 14, 2, 0, 'SN7490', { n: 14 }]), d4 = add(['ICX', 30, 2, 0, 'CD4511', { n: 16 }]), seg = add(['SEG8', 46, 2, 0, 'rot', { vr: 'k' }]);
      spec = { build: P => {
        const a = k => P[c7][k - 1], b = k => P[d4][k - 1], sg = i => P[seg][i];
        nets.push([P[iBat][0], a(5), b(16), b(3), b(4)]);
        nets.push([P[clk][0], a(14)]); nets.push([a(12), a(1)]);
        nets.push([a(12), b(7)]); nets.push([a(9), b(1)]); nets.push([a(8), b(2)]); nets.push([a(11), b(6)]);
        [[13, 0], [12, 1], [11, 2], [10, 3], [9, 4], [15, 5], [14, 6]].forEach(([pin, i]) => nets.push([b(pin), sg(i)]));
        if (which === '7490m6') { nets.push([a(9), a(2)]); nets.push([a(8), a(3)]); } else { gnd.push(a(2)); gnd.push(a(3)); }
        gnd.push(a(10)); gnd.push(a(6)); gnd.push(a(7)); gnd.push(b(8)); gnd.push(b(5)); gnd.push(sg(8));
      }, scope: [] };
    }
    const P0 = api.pinPts(rows); spec.build(P0);
    gnd.forEach(p => rows.push(['GND', p[0], p[1]]));
    const wires = api.routeNets(rows, nets);
    return { parts: rows, wires, scopes: spec.scope || [], tempo: 0.75, win: 6 };
  }
  const IC_EX = [
    { cat: 'ICs', name: 'IC CD4011: vier NAND-Gatter', info: 'Ein echter CMOS-Baustein mit Pinbelegung. Gatter 1 ist NAND(A, B), Gatter 2 kehrt das Ergebnis um und macht daraus UND. Die 10-kΩ-Widerstände ziehen offene Eingänge auf Low (Pull-down).', which: '4011' },
    { cat: 'ICs', name: 'IC CD4017: Lauflicht', info: 'Der Dezimalzähler 4017 schaltet mit jedem Takt den nächsten Ausgang ein. Q5 setzt ihn zurück, so laufen fünf LEDs im Kreis.', which: '4017' },
    { cat: 'ICs', name: 'IC 7474: D-Flipflop mit Clear und Preset', info: 'Clear (CLR) ist der asynchrone Rücksetz-Eingang, Preset (PRE) der asynchrone Setz-Eingang: Beide wirken sofort, ohne auf den Takt zu warten, und sind aktiv bei Low. Die Schalter stehen auf geschlossen (High, nicht aktiv). Öffne CLR: Q wird sofort 0. Öffne PRE: Q wird sofort 1.', which: '7474' },
    { cat: 'ICs', name: 'ICs 7490 und 4511: Zähler 0 bis 5 durch Rücksetzen', info: 'Der 7490 zählt dezimal. Mit QB und QC an den Reset-Eingängen R0 wird er beim Wert 6 sofort auf 0 zurückgesetzt: Er zählt nur 0 bis 5 (Modulo 6, zum Beispiel für Zehner der Minuten).', which: '7490m6' },
    { cat: 'ICs', name: 'ICs 7490, 4511 und 7-Segment: Dezimalzähler', info: 'Der 7490 zählt Takte dezimal (BCD), der 4511 macht daraus die Segmente der Anzeige. Im echten Aufbau gehört vor jedes Segment ein Vorwiderstand.', which: '7490' },
  ];
  root.DIGI_DEF = function (api) {
    api.addExamples(SPECS.map(sp => ({ lab: 'digi', cat: sp.cat, name: sp.name, info: sp.info, make: () => layout(api, sp) })));
    api.addExamples(IC_EX.map(x => ({ lab: 'digi', cat: x.cat, name: x.name, info: x.info, make: () => icExample(api, x.which) })));
    api.addExamples(CPU_EX.map(x => ({ lab: 'digi', cat: x.cat, name: x.name, info: x.info, make: () => cpuLayout(api, x.o) })));
    api.addExamples(CPU85_EX.map(x => ({ lab: 'digi', cat: x.cat, name: x.name, info: x.info, make: () => cpu85Layout(api, Object.assign({}, x.o, { code: P85(x.o.key) })) })));
    const sheet = (t, f) => root.LabUI.sheet(t, f), esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const stat = (k, v, m) => { if (root.Badges) root.Badges.stat(k, v, m); };

    function openTruth() {
      const an = analyse(api);
      sheet('Wahrheitstabelle', b => {
        if (an.error) { b.innerHTML = '<p style="margin-top:0">' + esc(an.error) + '</p>'; return; }
        const ex = exprs(an);
        let h = '<p class="hint2" style="margin-top:0">' + (an.mem ? '<b>Achtung:</b> Das Ergebnis hängt von der Vorgeschichte ab (die Schaltung hat Gedächtnis). Die Tabelle zeigt die Werte beim Durchprobieren.<br>' : '') + 'Tippe auf eine Zeile, dann stellt das Lab die Schalter so ein.</p><div style="overflow:auto"><table style="border-collapse:collapse;width:100%;text-align:center"><thead><tr>' +
          an.inNames.map(x => `<th style="border-bottom:2px solid var(--line);padding:4px 8px">${esc(x)}</th>`).join('') + '<th style="width:10px"></th>' + an.outNames.map(x => `<th style="border-bottom:2px solid var(--line);padding:4px 8px;color:#6dff7a">${esc(x)}</th>`).join('') + '</tr></thead><tbody>';
        for (let c = 0; c < an.N; c++) {
          h += `<tr data-c="${c}" style="cursor:pointer">` + an.ins.map((p, i) => `<td style="padding:4px 8px">${(c >> (an.n - 1 - i)) & 1}</td>`).join('') + '<td></td>' + an.rows[c].map(v => `<td style="padding:4px 8px;background:${v ? 'rgba(109,255,122,.22)' : 'transparent'};font-weight:${v ? 700 : 400}">${v}</td>`).join('') + '</tr>';
        }
        h += '</tbody></table></div><div style="margin-top:10px">' + ex.map(e => `<div style="margin:4px 0"><b>${esc(e.name)}</b> = <span style="font-family:monospace">${esc(e.text)}</span></div>`).join('') + '</div><p class="hint2">Die Gleichung ist vereinfacht (Quine-McCluskey): · heißt UND, + heißt ODER, ¬ heißt NICHT.</p>';
        b.innerHTML = h; stat('wt', 1, 'max');
        b.querySelectorAll('tr[data-c]').forEach(tr => { tr.onclick = () => { const c = +tr.dataset.c; an.ins.forEach((p, i) => { p.sw = (c >> (an.n - 1 - i)) & 1; }); api.commit(true, true); api.rebuild(); api.refreshUI(); api.draw(); api.toast('Schalter gesetzt: ' + an.inNames.map((x, i) => x + '=' + ((c >> (an.n - 1 - i)) & 1)).join(' ')); }; });
      });
    }

    function openSynth(pre) {
      let n = 2, m = 1, cols = [new Array(4).fill(0)];
      if (pre) { n = pre.n; cols = pre.cols; m = cols.length; }
      const names = VARS;
      const TEMPL = { 'leer': null, 'XOR (A ungleich B)': { n: 2, cols: [[0, 1, 1, 0]] }, 'UND': { n: 2, cols: [[0, 0, 0, 1]] }, 'Mehrheit aus 3': { n: 3, cols: [[0, 0, 0, 1, 0, 1, 1, 1]] }, 'Gerade Parität (3 Bit)': { n: 3, cols: [[1, 0, 0, 1, 0, 1, 1, 0]] }, 'Halbaddierer (Summe, Übertrag)': { n: 2, cols: [[0, 1, 1, 0], [0, 0, 0, 1]] }, '2-Bit-Vergleich A = B': { n: 4, cols: [[1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]] } };
      sheet('Schaltung aus Wahrheitstabelle', (b, close) => {
        const draw = () => {
          const N = 1 << n; cols = cols.slice(0, m).map(c => { const a = c.slice(0, N); while (a.length < N) a.push(0); return a; }); while (cols.length < m) cols.push(new Array(N).fill(0));
          const ex = cols.map((c, j) => { const mt = []; c.forEach((v, k) => { if (v) mt.push(k); }); return exprOf(mt, n, names); });
          b.innerHTML = `<p class="hint2" style="margin-top:0">Lege fest, wann der Ausgang 1 sein soll (Zelle antippen). Das Lab leitet die kürzeste Gleichung her und baut die Gatterschaltung mit Schaltern und LEDs.</p>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px"><label class="hint2">Eingänge <select id="sn">${[2, 3, 4].map(k => `<option${k === n ? ' selected' : ''}>${k}</option>`).join('')}</select></label><label class="hint2">Ausgänge <select id="sm">${[1, 2].map(k => `<option${k === m ? ' selected' : ''}>${k}</option>`).join('')}</select></label><label class="hint2">Vorlage <select id="st"><option>wählen …</option>${Object.keys(TEMPL).map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div>
            <div style="overflow:auto"><table style="border-collapse:collapse;text-align:center"><thead><tr>${names.slice(0, n).map(x => `<th style="padding:4px 10px;border-bottom:2px solid var(--line)">${x}</th>`).join('')}<th style="width:12px"></th>${cols.map((c, j) => `<th style="padding:4px 10px;border-bottom:2px solid var(--line);color:#6dff7a">Y${j + 1}</th>`).join('')}</tr></thead><tbody>` +
            Array.from({ length: N }, (_, k) => `<tr>${names.slice(0, n).map((x, i) => `<td style="padding:4px 10px">${(k >> (n - 1 - i)) & 1}</td>`).join('')}<td></td>${cols.map((c, j) => `<td><button data-j="${j}" data-k="${k}" style="min-width:42px;height:32px;border-radius:7px;border:1px solid var(--line);background:${c[k] ? 'rgba(109,255,122,.3)' : 'var(--panel2)'};color:inherit;font-weight:700;cursor:pointer">${c[k]}</button></td>`).join('')}</tr>`).join('') +
            `</tbody></table></div><div style="margin:10px 0">${ex.map((e, j) => `<div><b>Y${j + 1}</b> = <span style="font-family:monospace">${esc(e.text)}</span></div>`).join('')}</div><div class="btns"><button class="btn pri" id="sb">Schaltung bauen</button></div>`;
          b.querySelector('#sn').onchange = e => { n = +e.target.value; draw(); }; b.querySelector('#sm').onchange = e => { m = +e.target.value; draw(); };
          b.querySelector('#st').onchange = e => { const t = TEMPL[e.target.value]; if (t) { n = t.n; cols = t.cols.map(c => c.slice()); m = cols.length; draw(); } };
          b.querySelectorAll('button[data-k]').forEach(x => { x.onclick = () => { cols[+x.dataset.j][+x.dataset.k] ^= 1; draw(); }; });
          b.querySelector('#sb').onclick = () => {
            const spec = specFromTable(n, cols, names); if (!spec.outputs.length) { api.toast('Die Funktion ist konstant (immer 0 oder immer 1), dafür braucht es keine Gatter.'); return; }
            spec.name = 'Aus Wahrheitstabelle'; close();
            const go = () => { const L = layout(api, spec); api.loadCircuit(api.buildExample({ name: 'Aus Wahrheitstabelle', make: () => L })); stat('synth', 1, 'max'); api.toast(L.fails ? 'Achtung: ' + L.fails + ' Verbindung(en) waren zu eng für den Auto-Weg. Ergänze sie von Hand.' : 'Schaltung gebaut. Prüfe sie mit der Wahrheitstabelle.'); };
            if (api.sch.parts.length) { try { api.saveNamed(); } catch (e) {} } go();
          };
        };
        draw();
      });
    }

    function openConv() {
      sheet('Zahlenumrechner', b => {
        b.innerHTML = `<div style="display:flex;gap:8px;margin-bottom:8px"><button class="btn pri" id="zc">Umrechnen</button><button class="btn" id="zq">Üben</button></div><div id="zb"></div>`;
        const zb = b.querySelector('#zb');
        const calc = () => {
          zb.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px"><label class="hint2">Dezimal<input id="zd" inputmode="numeric" style="width:100%" value="10"></label><label class="hint2">Binär<input id="zbi" style="width:100%;font-family:monospace"></label><label class="hint2">Hexadezimal<input id="zh" style="width:100%;font-family:monospace"></label></div><div id="zo" style="margin-top:10px;font-size:14px;line-height:1.7"></div><p class="hint2">Tippe in ein Feld, die anderen ziehen nach.</p>`;
          const set = n => {
            if (n == null || n < 0) return; const bin = n.toString(2), hex = n.toString(16).toUpperCase(); zb.querySelector('#zd').value = n; zb.querySelector('#zbi').value = bin; zb.querySelector('#zh').value = hex;
            const bcd = String(n).split('').map(c => pad(parseInt(c, 10).toString(2), 4)).join(' '), gray = (n ^ (n >> 1)).toString(2), tc8 = n < 128 ? '' : '', neg = (-n & 255).toString(2).padStart(8, '0');
            zb.querySelector('#zo').innerHTML = `BCD: <span style="font-family:monospace">${bcd}</span><br>Gray-Code: <span style="font-family:monospace">${gray.padStart(bin.length, '0')}</span><br>8 Bit: <span style="font-family:monospace">${pad(bin, 8).slice(-8)}</span>${n <= 127 ? ' · Zweierkomplement von −' + n + ': <span style="font-family:monospace">' + neg + '</span>' : ''}<br>Stellen: ${bin.length} Bit, Wertebereich bis ${(1 << Math.max(bin.length, 1)) - 1}`;
          };
          zb.querySelector('#zd').oninput = e => set(conv(e.target.value, 10)); zb.querySelector('#zbi').oninput = e => set(conv(e.target.value, 2)); zb.querySelector('#zh').oninput = e => set(conv(e.target.value, 16)); set(10);
        };
        const quiz = () => {
          let qi = 0, ok = 0, cur = null;
          const mk = () => {
            const r = (a, c) => a + Math.floor(Math.random() * (c - a + 1)), t = r(0, 5);
            if (t === 0) { const v = r(5, 60); return { q: 'Binär ' + v.toString(2) + ' = Dezimal ?', a: String(v), kind: 'dec' }; }
            if (t === 1) { const v = r(5, 60); return { q: 'Dezimal ' + v + ' = Binär ?', a: v.toString(2), kind: 'bin' }; }
            if (t === 2) { const v = r(16, 255); return { q: 'Hex ' + v.toString(16).toUpperCase() + ' = Dezimal ?', a: String(v), kind: 'dec' }; }
            if (t === 3) { const v = r(16, 255); return { q: 'Dezimal ' + v + ' = Hex ?', a: v.toString(16).toUpperCase(), kind: 'hex' }; }
            if (t === 4) { const v = r(10, 99); return { q: 'BCD ' + String(v).split('').map(c => pad(parseInt(c, 10).toString(2), 4)).join(' ') + ' = Dezimal ?', a: String(v), kind: 'dec' }; }
            const v = r(1, 100); return { q: 'Zweierkomplement (8 Bit) von −' + v + ' ?', a: (-v & 255).toString(2).padStart(8, '0'), kind: 'bin' };
          };
          const show = () => {
            cur = mk(); zb.innerHTML = `<div class="hint2">Aufgabe ${qi + 1} von 6</div><p style="font-size:18px;margin:6px 0"><b>${esc(cur.q)}</b></p><div style="display:flex;gap:8px"><input id="za" style="flex:1;font-family:monospace;font-size:18px" autocomplete="off"><button class="btn pri" id="zk">Prüfen</button></div><div id="zm" style="margin-top:8px;min-height:44px"></div>`;
            zb.querySelector('#zk').onclick = () => {
              const v = zb.querySelector('#za').value.trim().replace(/\s/g, '').toUpperCase(), good = v.replace(/^0+(?=.)/, '') === cur.a.replace(/^0+(?=.)/, '') || (cur.kind === 'bin' && cur.a.length === 8 && v === cur.a);
              if (good) ok++; zb.querySelector('#zm').innerHTML = `<span style="color:${good ? '#5ee27d' : '#ffb020'}"><b>${good ? 'Richtig!' : 'Nicht ganz. Richtig ist ' + esc(cur.a)}</b></span> <button class="btn" id="zn" style="margin-left:8px">${qi + 1 < 6 ? 'Weiter' : 'Ergebnis'}</button>`;
              zb.querySelector('#zn').onclick = () => { qi++; if (qi >= 6) { if (ok) stat('zahl', ok); if (ok === 6) stat('zahlPerfekt', 1, 'max'); zb.innerHTML = `<p style="font-size:20px"><b>${ok} von 6</b> richtig</p><button class="btn pri" id="zr">Nochmal</button>`; zb.querySelector('#zr').onclick = quiz; } else show(); };
            };
          }; show();
        };
        b.querySelector('#zc').onclick = calc; b.querySelector('#zq').onclick = quiz; calc();
      });
    }

    /* Menüeinträge, Seitenkarte und Klicks des Labs */
    const is85 = p => (p.k === 'CPU' || p.k === 'ICX') && /^(CPU85|TF85|8085)/i.test(String(p.v || '').replace(/[^A-Za-z0-9]/g, ''));
    let PLUSI = null; const plus = () => PLUSI || (PLUSI = root.DIGI_PLUS ? root.DIGI_PLUS(api, root.DIGI) : null);
    root.LAB_EXTRA_MENU = () => [['kv', 'KV-Diagramm', 'Gruppen bilden und die kürzeste Gleichung ablesen'], ['fsm', 'Zustandsautomat', 'Zustände und Übergänge, Simulation, Schaltung bauen'], ['gdw', 'Fehler-Würfel (Gatter)', 'Ein Gatter wird vertauscht, finde es'], ['wt', 'Wahrheitstabelle', 'Alle Eingangskombinationen prüfen, Gleichung herleiten'], ['synth', 'Schaltung aus Tabelle', 'Wahrheitstabelle eintragen, Schaltung bauen lassen'], ['zahl', 'Zahlenumrechner', 'Binär, Dezimal, Hex, BCD, Zweierkomplement, Üben'], ['cpu', 'Mini-CPU: Programm', 'Assembler-Editor, Register, Einzelschritt'], ['cpu85', 'Prozessor 8085: Programm', '8-Bit-Assembler, Register in Hex und Binär, Port FBH, Einzelschritt und Lauf']];
    root.LAB_EXTRA_ACT = m => { if (m === 'kv' && plus()) { plus().openKV(); return true; } if (m === 'fsm' && plus()) { plus().openFSM(); return true; } if (m === 'gdw' && plus()) { plus().rollGate(); return true; } if (m === 'wt') { openTruth(); return true; } if (m === 'synth') { openSynth(); return true; } if (m === 'zahl') { openConv(); return true; } if (m === 'cpu') { if (root.CPU4) root.CPU4.openEditor(api); return true; } if (m === 'cpu85') { if (root.CPU85) root.CPU85.openEditor(api); return true; } return false; };
    root.LAB_EXTRA_CARD = () => '<div class="card"><h4>Digitaltechnik</h4><div class="row2"><button class="btn" data-a="dwt">Wahrheitstabelle</button><button class="btn" data-a="dsy">Aus Tabelle bauen</button></div><div class="row2"><button class="btn" data-a="dkv">KV-Diagramm</button><button class="btn" data-a="dfs">Zustandsautomat</button></div><div class="row2"><button class="btn" data-a="dzn">Zahlenumrechner</button>' + (api.sch.parts.some(p => (p.k === 'CPU' || (p.k === 'ICX' && /cpu4/i.test(p.v))) && !is85(p)) ? '<button class="btn" data-a="dcp">Mini-CPU</button>' : '') + (api.sch.parts.some(is85) ? '<button class="btn" data-a="dp85">Prozessor 8085</button>' : '') + '</div></div>' + (plus() ? plus().cardHtml() : '');
    root.LAB_EXTRA_CLICK = (a) => { if (a === 'dkv' && plus()) { plus().openKV(); return true; } if (a === 'dfs' && plus()) { plus().openFSM(); return true; } if (a === 'gdw' && plus()) { plus().rollGate(); return true; } if (a === 'gdr' && plus()) { plus().reportGate(); return true; } if (a === 'gdv' && plus()) { plus().reveal(); return true; } if (a === 'dwt') { openTruth(); return true; } if (a === 'dsy') { openSynth(); return true; } if (a === 'dzn') { openConv(); return true; } if (a === 'dcp') { if (root.CPU4) root.CPU4.openEditor(api); return true; } if (a === 'dp85') { if (root.CPU85) root.CPU85.openEditor(api); return true; } return false; };
    /* ---------- Aufgaben ---------- */
    const RES = api.RES;
    const ledsOf = () => api.sch.parts.filter(p => p.k === 'LED');
    const ledOn = (E, id) => E.c.elems.some(e => e.led && e.part && e.part.id === id && Math.abs(e.i || 0) > 0.002);
    const clkHz = () => { const c = api.sch.parts.find(p => p.k === 'CLK'), m = c && String(c.v).replace(',', '.').match(/([\d.]+)\s*(k?)Hz/i); return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : 4; };
    const strip = spec => { const L = layout(api, spec); L.wires = []; return L; };
    const gateSkeleton = (inputs, outNames) => ({ inputs, gates: [], outputs: outNames.map((n, i) => ({ name: n, src: inputs[0], color: i ? 'gelb' : 'grün' })), scope: [] });
    const SK = (inputs, outNames) => () => strip(gateSkeleton(inputs, outNames));
    const bitsOf = (c, n) => Array.from({ length: n }, (_, i) => (c >> (n - 1 - i)) & 1);
    /* Wahrheitstabelle gegen eine Funktion prüfen */
    function ttCheck(n, m, fn, extra) {
      return () => {
        const an = analyse(api); if (an.error) return [RES(false, an.error)];
        const L = [RES(an.n === n, an.n === n ? 'Eingänge: ' + n + ' Schalter' : 'Es sollen genau ' + n + ' Schalter als Eingänge da sein (jetzt ' + an.n + ')'), RES(an.outs.length === m, an.outs.length === m ? 'Ausgänge: ' + m + ' LED' + (m > 1 ? 's' : '') : 'Es sollen genau ' + m + ' LED' + (m > 1 ? 's' : '') + ' als Ausgang da sein (jetzt ' + an.outs.length + ')')];
        if (an.n !== n || an.outs.length !== m) return L;
        const bad = []; for (let c = 0; c < an.N; c++) { const b = bitsOf(c, n), ex = fn(b); if (ex.join() !== an.rows[c].join()) bad.push({ c, b, ex, got: an.rows[c] }); }
        const f = bad[0];
        L.push(RES(!bad.length, bad.length ? 'Falsch bei ' + an.inNames.map((x, i) => x + '=' + f.b[i]).join(', ') + ': ' + an.outNames.map((x, j) => x + ' soll ' + f.ex[j] + ' sein, ist ' + f.got[j]).join('; ') + (bad.length > 1 ? ' (und ' + (bad.length - 1) + ' weitere Zeilen)' : '') : 'Wahrheitstabelle stimmt in allen ' + an.N + ' Zeilen'));
        if (extra) extra.forEach(f2 => L.push(f2(an)));
        return L;
      };
    }
    /* Takt-Abfragen: nach der k-ten steigenden Flanke (die erste ist die bei t = 1 Periode) */
    function clocked(nEdges, read, setup) {
      const T = 1 / clkHz(), E = api.simEval({ set: setup || {} }), out = [];
      for (let k = 1; k <= nEdges; k++) { E.run(k === 1 ? 1.3 * T : T); out.push(read(E)); }
      return out;
    }
    const valOf = E => ledsOf().reduce((s, l, i) => s + (ledOn(E, l.id) ? 1 << i : 0), 0);
    const wire = (txt) => RES(true, txt);
    /* Adressdecoder 2 auf 4 (Berufsschule Lernfeld 7: Adressdecoder entwickeln); Muster für d28 und die Fehlersuche df4 */
    const DEC24 = { inputs: ['A1', 'A0'], gates: [{ id: 'nA1', t: 'NOT', in: ['A1'] }, { id: 'nA0', t: 'NOT', in: ['A0'] }, { id: 'z0', t: 'AND', in: ['nA1', 'nA0'] }, { id: 'z1', t: 'AND', in: ['nA1', 'A0'] }, { id: 'z2', t: 'AND', in: ['A1', 'nA0'] }, { id: 'z3', t: 'AND', in: ['A1', 'A0'] }],
      outputs: [{ name: 'Z0', src: 'z0', color: 'grün' }, { name: 'Z1', src: 'z1', color: 'gelb' }, { name: 'Z2', src: 'z2', color: 'rot' }, { name: 'Z3', src: 'z3', color: 'blau' }] };
    /* Gemeinsame Muster für d33/df5 (Zweierkomplement, 3 Bit) und d36 (Bus mit Freigaben) */
    const NEG3 = { inputs: ['A2', 'A1', 'A0'], gates: [{ id: 'o', t: 'OR', in: ['A1', 'A0'] }, { id: 'x1', t: 'XOR', in: ['A1', 'A0'] }, { id: 'x2', t: 'XOR', in: ['A2', 'o'] }], outputs: [{ name: 'N2', src: 'x2', color: 'grün' }, { name: 'N1', src: 'x1', color: 'gelb' }, { name: 'N0', src: 'A0', color: 'rot' }] };
    const BUS2 = { inputs: ['DA', 'DB', 'EA', 'EB'], gates: [{ id: 'a1', t: 'AND', in: ['DA', 'EA'] }, { id: 'a2', t: 'AND', in: ['DB', 'EB'] }, { id: 'b', t: 'OR', in: ['a1', 'a2'] }, { id: 'k', t: 'AND', in: ['EA', 'EB'] }], outputs: [{ name: 'BUS', src: 'b', color: 'grün' }, { name: 'KON', src: 'k', color: 'rot' }] };
    /* Neue Aufgaben nach dem Berufsschulstoff E2/E3 (Wahrheitstabelle mit Hilfsgrößen, NOR-Technik) und E9.1/E9.2 (Flipflop-Arten, asynchrone Zähler, Dekodieren): d38 bis d45, df8, df9 */
    const swByL = l => api.sch.parts.find(p => p.k === 'SPST' && p.l === l);
    const ledByL = l => ledsOf().find(p => p.l === l);
    const readL = (E, names) => names.map(n => { const l = ledByL(n); return l && ledOn(E, l.id) ? 1 : 0; }).join('');
    const setSw = (E, st) => Object.keys(st).forEach(l => { const p = swByL(l), w = p && E.wm && E.wm.get(p.id); if (w) w.sw = st[l]; });
    /* Schritte mit Takt: vor jeder steigenden Flanke die Schalter stellen, danach die LEDs lesen */
    function stepClocked(steps, names) { const T = 1 / clkHz(), E = api.simEval({ set: {} }), out = []; steps.forEach((st, k) => { setSw(E, st); E.run(k ? T : 1.3 * T); out.push(readL(E, names)); }); return out; }
    /* Schritte ohne Takt (Speicher aus Gattern): Schalter stellen, kurz laufen lassen, LEDs lesen */
    function stepLatch(steps, names) { const E = api.simEval({}), out = []; steps.forEach(st => { setSw(E, st); E.run(0.05); out.push(readL(E, names)); }); return out; }
    const need = (labels, nLed) => { const miss = labels.filter(l => !swByL(l)); return miss.length ? 'Es fehlen die Schalter ' + miss.join(', ') : (ledsOf().length < nLed ? 'Es werden ' + nLed + ' LEDs erwartet' : ''); };
    const JK1 = { inputs: ['J', 'K'], clk: '1Hz', gates: [{ id: 'ff', t: 'JKFF', in: ['J', 'K', 'CLK'] }], outputs: [{ name: 'Q', src: 'ff', color: 'grün' }, { name: 'Q̄', src: 'ff.n', color: 'rot' }], scope: [] };
    const JKT = { inputs: [], clk: '2Hz', gates: [{ id: 'f0', t: 'JKFF', in: ['H', 'H', 'CLK'] }, { id: 'f1', t: 'JKFF', in: ['H', 'H', 'f0.n'] }], outputs: [{ name: 'Q0', src: 'f0', color: 'grün' }, { name: 'Q1', src: 'f1', color: 'gelb' }], scope: [], win: 8 };
    const ABW3 = { inputs: [], clk: '2Hz', gates: [{ id: 'f0', t: 'TFF', in: ['H', 'CLK'] }, { id: 'f1', t: 'TFF', in: ['H', 'f0'] }, { id: 'f2', t: 'TFF', in: ['H', 'f1'] }], outputs: [{ name: 'Q0', src: 'f0', color: 'grün' }, { name: 'Q1', src: 'f1', color: 'gelb' }, { name: 'Q2', src: 'f2', color: 'rot' }], scope: [], win: 8 };
    const DEK5 = { inputs: [], clk: '2Hz', gates: [{ id: 'f0', t: 'TFF', in: ['H', 'CLK'] }, { id: 'f1', t: 'TFF', in: ['H', 'f0.n'] }, { id: 'f2', t: 'TFF', in: ['H', 'f1.n'] }, { id: 'z1', t: 'AND', in: ['f0', 'f1.n'] }, { id: 'z', t: 'AND', in: ['z1', 'f2'] }], outputs: [{ name: 'Q0', src: 'f0', color: 'grün' }, { name: 'Q1', src: 'f1', color: 'grün' }, { name: 'Q2', src: 'f2', color: 'gelb' }, { name: 'Z', src: 'z', color: 'rot' }], scope: [], win: 8 };
    const SVOR = { inputs: ['S', 'R'], gates: [{ id: 'nS', t: 'NOT', in: ['S'] }, { id: 'r2', t: 'AND', in: ['R', 'nS'] }, { id: 'g1', t: 'NOR', in: ['r2', 'g2'] }, { id: 'g2', t: 'NOR', in: ['S', 'g1'] }], outputs: [{ name: 'Q', src: 'g1', color: 'grün' }, { name: 'Q̄', src: 'g2', color: 'rot' }], scope: [] };
    const DLAT = { inputs: ['D', 'E'], gates: [{ id: 'nD', t: 'NOT', in: ['D'] }, { id: 's', t: 'AND', in: ['D', 'E'] }, { id: 'r', t: 'AND', in: ['nD', 'E'] }, { id: 'g1', t: 'NOR', in: ['r', 'g2'] }, { id: 'g2', t: 'NOR', in: ['s', 'g1'] }], outputs: [{ name: 'Q', src: 'g1', color: 'grün' }, { name: 'Q̄', src: 'g2', color: 'rot' }], scope: [] };
    const NOR2 = { inputs: ['A', 'B'], gates: [{ id: 'n1', t: 'NOR', in: ['A', 'B'] }, { id: 'o', t: 'NOR', in: ['n1', 'n1'] }, { id: 'na', t: 'NOR', in: ['A', 'A'] }, { id: 'nb', t: 'NOR', in: ['B', 'B'] }, { id: 'u', t: 'NOR', in: ['na', 'nb'] }], outputs: [{ name: 'U', src: 'u', color: 'grün' }, { name: 'O', src: 'o', color: 'gelb' }] };
    const HILF = { inputs: ['A', 'B', 'C'], gates: [{ id: 'v', t: 'NAND', in: ['A', 'B'], l: 'V' }, { id: 'w', t: 'NOR', in: ['B', 'C'], l: 'W' }, { id: 'x', t: 'AND', in: ['v', 'C'], l: 'X' }, { id: 'z', t: 'OR', in: ['x', 'w'], l: 'Z' }], outputs: [{ name: 'Z', src: 'z', color: 'grün' }] };
    const hilfFn = b => { const v = (b[0] & b[1]) ? 0 : 1, w = (b[1] | b[2]) ? 0 : 1, x = v & b[2]; return [(x | w) ? 1 : 0]; };
    /* Pruefung der Zaehler-Aufgaben: Zaehlerstand aus den LEDs Q0 (niedrigstes Bit) bis Qn */
    const cntOf = s => s.split('').reduce((a, c, i) => a + (c === '1' ? 1 << i : 0), 0);
    function checkCount(nBits, want, withZ) {
      const q = Array.from({ length: nBits }, (_, i) => 'Q' + i), miss = q.concat(withZ ? ['Z'] : []).filter(n => !ledByL(n));
      if (miss.length) return [RES(false, 'Es fehlen die LEDs ' + miss.join(', '))];
      const ff = api.sch.parts.filter(p => p.k === 'TFF' || p.k === 'JKFF' || p.k === 'DFF').length;
      const seq = clocked(want.length, E => readL(E, q.concat(withZ ? ['Z'] : []))), vals = seq.map(s => cntOf(s.slice(0, nBits))), ok = vals.join() === want.join();
      const L = [RES(ff >= nBits, ff >= nBits ? nBits + ' Flipflops vorhanden' : 'Es werden ' + nBits + ' Flipflops gebraucht'), RES(ok, ok ? 'Der Zähler zählt ' + want.slice(0, 4).join(', ') + ' …' : 'Nach den ersten ' + want.length + ' Taktflanken sollte ' + want.join(', ') + ' dastehen (ist: ' + vals.join(', ') + ')')];
      if (withZ) { const z = seq.map(s => s[nBits]).join(''), zw = want.map(v => (v === withZ ? '1' : '0')).join(''); L.push(RES(z === zw, z === zw ? 'Z leuchtet genau beim Zählerstand ' + withZ : 'Z soll nur beim Zählerstand ' + withZ + ' leuchten (Z nach den Flanken: ' + z + ', erwartet ' + zw + ')')); }
      return L;
    }
    const T1 = [
      { id: 'd1', cat: 'Grundgatter', title: 'UND-Gatter verdrahten', level: 1, spec: { inputs: ['A', 'B'], gates: [{ id: 'g', t: 'AND', in: ['A', 'B'] }], outputs: [{ name: 'Y', src: 'g' }] },
        text: 'Verdrahte Batterie, zwei Schalter, das UND-Gatter und die LED so, dass die LED nur leuchtet, wenn beide Schalter geschlossen sind. Die Bauteile stehen schon, es fehlen die Drähte.', hint: 'Plus der Batterie geht an beide Schalter. Hinter jedem Schalter geht ein Draht an einen Eingang des Gatters. Der Ausgang des Gatters geht an den Widerstand, dahinter die LED nach Masse.', check: ttCheck(2, 1, b => [b[0] & b[1]]) },
      { id: 'd2', cat: 'Grundgatter', title: 'ODER-Gatter verdrahten', level: 1, spec: { inputs: ['A', 'B'], gates: [{ id: 'g', t: 'OR', in: ['A', 'B'] }], outputs: [{ name: 'Y', src: 'g' }] },
        text: 'Die LED soll leuchten, wenn mindestens einer der beiden Schalter geschlossen ist. Verdrahte die Schaltung mit dem ODER-Gatter.', hint: 'Genau wie beim UND-Gatter, nur mit dem ODER-Gatter in der Mitte.', check: ttCheck(2, 1, b => [b[0] | b[1]]) },
      { id: 'd3', cat: 'Grundgatter', title: 'NICHT-Gatter: der Umkehrer', level: 1, spec: { inputs: ['A'], gates: [{ id: 'g', t: 'NOT', in: ['A'] }], outputs: [{ name: 'Y', src: 'g' }] },
        text: 'Ein Schalter und ein NICHT-Gatter: Die LED soll leuchten, wenn der Schalter offen ist, und aus sein, wenn er geschlossen ist.', hint: 'Der Schalter geht an den Eingang des NICHT-Gatters, der Ausgang an die LED-Seite.', check: ttCheck(1, 1, b => [b[0] ? 0 : 1]) },
      { id: 'd4', cat: 'Grundgatter', title: 'NAND aus UND und NICHT', level: 1, spec: { inputs: ['A', 'B'], gates: [{ id: 'u', t: 'AND', in: ['A', 'B'] }, { id: 'n', t: 'NOT', in: ['u'] }], outputs: [{ name: 'Y', src: 'n' }] },
        text: 'Schalte ein UND-Gatter und ein NICHT-Gatter hintereinander. Zusammen verhalten sie sich wie ein NAND: Die LED ist immer an, nur bei A = 1 und B = 1 geht sie aus.', hint: 'Die Schalter gehen an das UND-Gatter, dessen Ausgang an das NICHT-Gatter, dessen Ausgang an die LED.', check: ttCheck(2, 1, b => [(b[0] & b[1]) ? 0 : 1]) },
      { id: 'd5', cat: 'Schaltnetze', title: 'XOR nur aus NAND-Gattern', level: 2, spec: { inputs: ['A', 'B'], gates: [{ id: 'n1', t: 'NAND', in: ['A', 'B'] }, { id: 'n2', t: 'NAND', in: ['A', 'n1'] }, { id: 'n3', t: 'NAND', in: ['B', 'n1'] }, { id: 'n4', t: 'NAND', in: ['n2', 'n3'] }], outputs: [{ name: 'Y', src: 'n4' }] },
        text: 'Mit vier NAND-Gattern lässt sich ein XOR bauen. Die LED soll leuchten, wenn A und B verschieden sind.', hint: 'Gatter 1: NAND(A, B). Gatter 2: NAND(A, Gatter 1). Gatter 3: NAND(B, Gatter 1). Gatter 4: NAND(Gatter 2, Gatter 3) geht an die LED.', check: ttCheck(2, 1, b => [b[0] ^ b[1]]) },
      { id: 'd6', cat: 'Schaltnetze', title: 'Halbaddierer verdrahten', level: 2, spec: SPECS[2],
        text: 'Addiere zwei Bits. Die erste LED zeigt die Summe (A xor B), die zweite den Übertrag (A und B). Verdrahte die Bauteile.', hint: 'Beide Schalter gehen an beide Gatter (XOR und UND). Das XOR liefert die Summe, das UND den Übertrag.', check: ttCheck(2, 2, b => [b[0] ^ b[1], b[0] & b[1]]) },
      { id: 'd7', cat: 'Schaltnetze', title: 'Gleichheit (XNOR) bauen', level: 2, spec: { inputs: ['A', 'B'], gates: [{ id: 'x', t: 'XOR', in: ['A', 'B'] }, { id: 'n', t: 'NOT', in: ['x'] }], outputs: [{ name: 'Y', src: 'n' }] },
        text: 'Die LED soll leuchten, wenn A und B gleich sind (beide 0 oder beide 1). Nimm dafür ein XOR und kehre sein Ergebnis um.', hint: 'XOR liefert 1, wenn die Eingänge verschieden sind. Gleichheit ist das Gegenteil davon.', check: ttCheck(2, 1, b => [b[0] === b[1] ? 1 : 0]) },
      { id: 'd8', cat: 'Schaltnetze', title: '2:1-Multiplexer verdrahten', level: 2, spec: SPECS[4],
        text: 'Der Schalter S wählt: Bei S = 0 soll die LED den Zustand von A zeigen, bei S = 1 den von B. Verdrahte NICHT, zwei UND und ein ODER.', hint: 'Y = (A und nicht S) oder (B und S). Das NICHT-Gatter bekommt S, ein UND bekommt A und nicht-S, das andere B und S, das ODER fasst beide zusammen.', check: ttCheck(3, 1, b => [b[2] ? b[1] : b[0]]) },
      { id: 'd9', cat: 'Schaltnetze', title: 'Mehrheit: mindestens zwei von drei', level: 3, spec: SPECS[5], start: SK(['A', 'B', 'C'], ['M']),
        text: 'Baue von Grund auf eine Schaltung mit drei Schaltern, die die LED einschaltet, wenn mindestens zwei Schalter geschlossen sind. Nutze UND- und ODER-Gatter (oder das Werkzeug „Schaltung aus Tabelle“).', hint: 'M = (A und B) oder (A und C) oder (B und C). Drei UND-Gatter und zwei ODER-Gatter. Im Menü „Schaltung aus Tabelle“ baut das Lab sie dir auch.', check: ttCheck(3, 1, b => [b[0] + b[1] + b[2] >= 2 ? 1 : 0]) },
      { id: 'd10', cat: 'Schaltnetze', title: 'Volladdierer bauen', level: 3, spec: SPECS[3], start: SK(['A', 'B', 'Cin'], ['Summe', 'Cout']),
        text: 'Addiere drei Bits (A, B und den Übertrag davor). Die erste LED zeigt die Summe, die zweite den Übertrag nach vorn. Baue den Volladdierer aus Gattern.', hint: 'Summe = A xor B xor Cin. Cout = (A und B) oder ((A xor B) und Cin). Zwei XOR, zwei UND und ein ODER genügen.', check: ttCheck(3, 2, b => [b[0] ^ b[1] ^ b[2], ((b[0] & b[1]) | ((b[0] ^ b[1]) & b[2])) ? 1 : 0]) },
      { id: 'd11', cat: 'Speicher und Zähler', title: 'SR-Speicher aus NOR verdrahten', level: 3, spec: SPECS[6],
        text: 'Verdrahte zwei NOR-Gatter über Kreuz zu einem Speicher: S setzt die obere LED (Q) an, R löscht sie. Lässt du beide Schalter los, merkt sich die Schaltung den letzten Zustand.', hint: 'Q = NOR(R, Q̄) und Q̄ = NOR(S, Q). Der Ausgang jedes Gatters geht an einen Eingang des anderen Gatters.',
        check() {
          const L = [], ins = api.sch.parts.filter(p => p.k === 'SPST'), leds = ledsOf(); if (ins.length !== 2 || leds.length !== 2) return [RES(false, 'Es werden zwei Schalter (S, R) und zwei LEDs (Q, Q̄) erwartet')];
          const E = api.simEval({}), set = (s, r) => { E.wm.get(ins[0].id).sw = s; E.wm.get(ins[1].id).sw = r; E.run(0.05); return leds.map(l => ledOn(E, l.id) ? 1 : 0).join(''); };
          const a = set(1, 0), b = set(0, 0), c = set(0, 1), d = set(0, 0);
          L.push(RES(a === '10', a === '10' ? 'S = 1 setzt Q auf 1' : 'Mit S = 1 und R = 0 sollte Q leuchten und Q̄ aus sein (ist: ' + a + ')'));
          L.push(RES(b === '10', b === '10' ? 'Nach dem Loslassen bleibt Q gesetzt (Speicher)' : 'Nach S = 0 sollte Q gesetzt bleiben (ist: ' + b + ')'));
          L.push(RES(c === '01', c === '01' ? 'R = 1 löscht Q' : 'Mit R = 1 sollte Q aus und Q̄ an sein (ist: ' + c + ')'));
          L.push(RES(d === '01', d === '01' ? 'Auch der gelöschte Zustand bleibt erhalten' : 'Nach R = 0 sollte der gelöschte Zustand bleiben (ist: ' + d + ')'));
          return L;
        } },
      { id: 'd12', cat: 'Speicher und Zähler', title: 'Taktteiler mit D-Flipflop', level: 3, spec: SPECS[7],
        text: 'Ein D-Flipflop soll den Takt durch zwei teilen: Q blinkt halb so schnell wie der Takt. Verdrahte Q̄ zurück an den Eingang D und den Takt an den Takteingang.', hint: 'Der Taktgeber geht an den Takteingang (C). Der Ausgang Q̄ geht an den Dateneingang D. So kippt Q bei jeder steigenden Flanke.',
        check() {
          const leds = ledsOf(); if (!leds.length) return [RES(false, 'Eine LED fehlt')]; const q = leds[leds.length - 1];
          const s = clocked(4, E => ledOn(E, q.id) ? 1 : 0), ok = s.join('') === '1010';
          return [RES(api.sch.parts.some(p => p.k === 'CLK') && api.sch.parts.some(p => p.k === 'DFF'), 'Taktgeber und D-Flipflop vorhanden'), RES(ok, ok ? 'Q kippt bei jeder steigenden Taktflanke (Folge ' + s.join('') + ')' : 'Q sollte nach den ersten vier Taktflanken 1, 0, 1, 0 zeigen (ist: ' + s.join(', ') + ')')];
        } },
      { id: 'd13', cat: 'Speicher und Zähler', title: '4-Bit-Zähler verdrahten', level: 3, spec: SPECS[8],
        text: 'Vier T-Flipflops sollen die Takte binär zählen (Q0 ist das niedrigste Bit). Verdrahte die Kette: Der Takt geht an das erste Flipflop, jedes weitere bekommt den Q̄-Ausgang seines Vorgängers als Takt. Alle T-Eingänge liegen auf 1 (an die Batterie).', hint: 'T-Eingang aller vier Flipflops an Plus. Takt an Flipflop 1. Q̄ von Flipflop 1 an den Takt von Flipflop 2, Q̄ von 2 an Takt 3, Q̄ von 3 an Takt 4.',
        check() {
          const leds = ledsOf(); if (leds.length < 4) return [RES(false, 'Vier LEDs (Q0 bis Q3) werden erwartet')];
          const s = clocked(9, valOf), want = [1, 2, 3, 4, 5, 6, 7, 8, 9], ok = s.join() === want.join();
          return [RES(api.sch.parts.filter(p => p.k === 'TFF').length >= 4, 'Vier T-Flipflops vorhanden'), RES(ok, ok ? 'Der Zähler zählt aufwärts (1, 2, 3 …)' : 'Nach den ersten neun Taktflanken sollte 1, 2, 3 … 9 dastehen (ist: ' + s.join(', ') + ')')];
        } },
      { id: 'd14', cat: 'Speicher und Zähler', title: 'Schieberegister verdrahten', level: 3, spec: SPECS[9],
        text: 'Vier D-Flipflops hintereinander bilden ein Schieberegister: Bei jeder Taktflanke rutscht das Bit eine Stelle weiter. Schalter D bestimmt, was von links hineinläuft. Verdrahte es.', hint: 'Takt an alle vier Takteingänge. D-Schalter an D von Flipflop 1, Q von Flipflop 1 an D von Flipflop 2 und so weiter.',
        check() {
          const sw = api.sch.parts.find(p => p.k === 'SPST'), leds = ledsOf(); if (!sw || leds.length < 4) return [RES(false, 'Ein Schalter D und vier LEDs werden erwartet')];
          const s = clocked(5, E => leds.map(l => ledOn(E, l.id) ? 1 : 0).join(''), { [sw.id]: 1 }), want = ['1000', '1100', '1110', '1111', '1111'], ok = s.join() === want.join();
          return [RES(api.sch.parts.filter(p => p.k === 'DFF').length >= 4, 'Vier D-Flipflops vorhanden'), RES(ok, ok ? 'Das Bit wandert durch alle vier Stellen' : 'Mit D = 1 sollten die LEDs nacheinander angehen: 1000, 1100, 1110, 1111 (ist: ' + s.join(', ') + ')')];
        } },
      { id: 'df1', cat: 'Fehlersuche', title: 'Fehlersuche: der Halbaddierer rechnet falsch', level: 2, spec: SPECS[2], faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'x' ? Object.assign({}, g, { t: 'OR' }) : g) }),
        text: 'Der Halbaddierer ist fertig verdrahtet, aber bei 1 + 1 zeigt die Summen-LED 1 statt 0. Finde das falsche Bauteil und ersetze es.', hint: 'Die Summe muss 1 sein, wenn die Eingänge verschieden sind, und 0, wenn sie gleich sind. Welches Gatter liefert das?', check: ttCheck(2, 2, b => [b[0] ^ b[1], b[0] & b[1]]) },
      { id: 'df2', cat: 'Fehlersuche', title: 'Fehlersuche: der Zähler zählt falsch', level: 3, spec: SPECS[8], faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'f1' ? Object.assign({}, g, { in: ['H', 'f0'] }) : g) }),
        text: 'Der Binärzähler soll aufwärts zählen, aber die Folge stimmt nicht. Sieh dir im Zeitdiagramm an, bei welcher Flanke von Q0 das nächste Bit kippt, und korrigiere die Verbindung.', hint: 'Ein aufwärts zählendes Flipflop muss kippen, wenn das vorige Bit von 1 auf 0 geht. Welcher Ausgang des Vorgängers hat dort eine steigende Flanke?',
        check() {
          const leds = ledsOf(); if (leds.length < 4) return [RES(false, 'Vier LEDs werden erwartet')];
          const s = clocked(9, valOf), want = [1, 2, 3, 4, 5, 6, 7, 8, 9], ok = s.join() === want.join();
          return [RES(ok, ok ? 'Der Zähler zählt aufwärts' : 'Erwartet 1, 2, 3 … 9, die Schaltung liefert ' + s.join(', '))];
        } },
      { id: 'd21', cat: 'Grundgatter', title: 'NOR-Gatter verdrahten', level: 1, spec: { inputs: ['A', 'B'], gates: [{ id: 'g', t: 'NOR', in: ['A', 'B'] }], outputs: [{ name: 'Y', src: 'g' }] },
        text: 'Die LED soll nur leuchten, wenn beide Schalter offen sind (A = 0 und B = 0). Sobald ein Schalter geschlossen ist, geht sie aus. Verdrahte die Schaltung mit einem NOR-Gatter.', hint: 'Ein NOR ist ein ODER mit umgekehrtem Ausgang: Es liefert nur dann 1, wenn kein Eingang 1 ist. Beide Schalter gehen an die zwei Eingänge, der Ausgang an die LED-Seite.', check: ttCheck(2, 1, b => [(b[0] | b[1]) ? 0 : 1]) },
      { id: 'd22', cat: 'Grundgatter', title: 'NICHT-Gatter aus einem NAND', level: 1, spec: { inputs: ['A'], gates: [{ id: 'g', t: 'NAND', in: ['A', 'A'] }], outputs: [{ name: 'Y', src: 'g' }] },
        text: 'Du hast nur ein NAND-Gatter und einen Schalter. Verdrahte beide so, dass die LED leuchtet, wenn der Schalter offen ist, und aus ist, wenn er geschlossen ist (also wie ein NICHT-Gatter).', hint: 'Beide Eingänge des NAND liegen am selben Schalter. Was liefert ein UND, wenn beide Eingänge gleich sind, und was daher das umgekehrte UND?', check: ttCheck(1, 1, b => [b[0] ? 0 : 1]) },
      { id: 'd23', cat: 'Schaltnetze', title: 'Ungerade Anzahl Einsen erkennen', level: 2, spec: { inputs: ['A', 'B', 'C'], gates: [{ id: 'x1', t: 'XOR', in: ['A', 'B'] }, { id: 'x2', t: 'XOR', in: ['x1', 'C'] }], outputs: [{ name: 'P', src: 'x2' }] },
        text: 'Drei Schalter A, B und C: Die LED soll leuchten, wenn eine ungerade Anzahl davon geschlossen ist (genau einer oder alle drei). Bei null oder zwei geschlossenen Schaltern bleibt sie aus. Das ist die Grundlage eines Paritätsbits. Verdrahte die Schaltung aus XOR-Gattern.', hint: 'Ein XOR liefert 1, wenn seine zwei Eingänge verschieden sind. Verkette zwei XOR: Das erste bekommt A und B, das zweite dessen Ausgang und C.', check: ttCheck(3, 1, b => [(b[0] + b[1] + b[2]) % 2]) },
      { id: 'd24', cat: 'Schaltnetze', title: 'Vergleicher: zwei 2-Bit-Zahlen gleich', level: 3, spec: { inputs: ['A1', 'A0', 'B1', 'B0'], gates: [{ id: 'x1', t: 'XOR', in: ['A1', 'B1'] }, { id: 'x0', t: 'XOR', in: ['A0', 'B0'] }, { id: 'n', t: 'NOR', in: ['x1', 'x0'] }], outputs: [{ name: 'Y', src: 'n' }] }, start: SK(['A1', 'A0', 'B1', 'B0'], ['Y']),
        text: 'Die Zahl A (Schalter A1, A0) und die Zahl B (Schalter B1, B0) sind je zwei Bit lang. Baue von Grund auf eine Schaltung, deren LED nur leuchtet, wenn A und B gleich sind (alle vier Bit passen paarweise zusammen).', hint: 'Zwei Bits sind gleich, wenn ihr XOR 0 ist. Vergleiche A1 mit B1 und A0 mit B0 je mit einem XOR. Die LED soll an sein, wenn beide XOR-Ausgänge 0 sind: Welches Gatter liefert das?', check: ttCheck(4, 1, b => [(b[0] === b[2] && b[1] === b[3]) ? 1 : 0]) },
      { id: 'd25', cat: 'Schaltnetze', title: 'Alarmanlage mit Panik-Taste', level: 2, spec: { inputs: ['F', 'S', 'P'], gates: [{ id: 'a', t: 'AND', in: ['F', 'S'] }, { id: 'o', t: 'OR', in: ['a', 'P'] }], outputs: [{ name: 'Sirene', src: 'o' }] },
        text: 'Eine kleine Alarmanlage hat drei Schalter: F (Fenster offen), S (Anlage scharf) und P (Panik-Taste). Die Sirene (LED) soll heulen, wenn das Fenster offen ist und die Anlage scharf ist, oder wenn die Panik-Taste gedrückt wird, egal ob scharf oder nicht. Verdrahte die Schaltung.', hint: 'Zerlege den Satz: „Fenster offen UND scharf“ ist ein UND. „… ODER Panik“ ist ein ODER hinter dem UND.', check: ttCheck(3, 1, b => [((b[0] & b[1]) | b[2]) ? 1 : 0]) },
      { id: 'df3', cat: 'Fehlersuche', title: 'Fehlersuche: der Multiplexer wählt falsch', level: 2, spec: SPECS[4], faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'a1' ? Object.assign({}, g, { in: ['A', 'S'] }) : g) }),
        text: 'Der 2:1-Multiplexer ist fertig verdrahtet. Bei S = 1 zeigt die LED richtig den Zustand von B, aber bei S = 0 bleibt sie dunkel, auch wenn A geschlossen ist. Finde die falsche Verbindung und korrigiere sie.', hint: 'Bei S = 0 soll A durchgelassen werden. Das UND-Gatter für A braucht dafür „nicht S“. Woher bekommt es seinen zweiten Eingang jetzt, und woher müsste er kommen?', check: ttCheck(3, 1, b => [b[2] ? b[1] : b[0]]) },
      { id: 'd26', cat: 'Speicher und Zähler', title: 'SR-Speicher mit Freigabe', level: 3, spec: { inputs: ['S', 'R', 'E'], gates: [{ id: 'a1', t: 'AND', in: ['S', 'E'] }, { id: 'a2', t: 'AND', in: ['R', 'E'] }, { id: 'g1', t: 'NOR', in: ['a2', 'g2'] }, { id: 'g2', t: 'NOR', in: ['a1', 'g1'] }], outputs: [{ name: 'Q', src: 'g1', color: 'grün' }, { name: 'Q̄', src: 'g2', color: 'rot' }] },
        text: 'Erweitere den SR-Speicher aus zwei NOR-Gattern um einen Freigabe-Schalter E: Nur bei E = 1 wirken S und R auf den Speicher. Bei E = 0 bleibt der gespeicherte Zustand erhalten, egal wie S und R stehen. Verdrahte die Schaltung mit zwei UND-Gattern vor dem NOR-Paar.', hint: 'Jeder der Schalter S und R geht zuerst an ein UND-Gatter, dessen zweiter Eingang E ist. Die Ausgänge der UND-Gatter gehen an die NOR-Gatter, die über Kreuz verbunden sind: Q = NOR(R-Teil, Q̄) und Q̄ = NOR(S-Teil, Q).',
        check() {
          const sws = api.sch.parts.filter(p => p.k === 'SPST'), S = sws.find(p => p.l === 'S'), R = sws.find(p => p.l === 'R'), En = sws.find(p => p.l === 'E'), leds = ledsOf();
          if (!S || !R || !En || leds.length !== 2) return [RES(false, 'Es werden drei Schalter (S, R, E) und zwei LEDs (Q, Q̄) erwartet')];
          const E = api.simEval({}), set = (s, r, e) => { E.wm.get(S.id).sw = s; E.wm.get(R.id).sw = r; E.wm.get(En.id).sw = e; E.run(0.05); return leds.map(l => ledOn(E, l.id) ? 1 : 0).join(''); };
          const a = set(1, 0, 1), b = set(0, 1, 0), c = set(0, 1, 1), d = set(1, 0, 0);
          return [RES(a === '10', a === '10' ? 'Mit E = 1 setzt S den Speicher (Q = 1)' : 'Mit E = 1 und S = 1 sollte Q leuchten (ist: ' + a + ')'), RES(b === '10', b === '10' ? 'Mit E = 0 wird R ignoriert, Q bleibt gesetzt' : 'Mit E = 0 sollte R wirkungslos sein und Q gesetzt bleiben (ist: ' + b + ')'), RES(c === '01', c === '01' ? 'Mit E = 1 löscht R den Speicher' : 'Mit E = 1 und R = 1 sollte Q aus und Q̄ an sein (ist: ' + c + ')'), RES(d === '01', d === '01' ? 'Mit E = 0 wird auch S ignoriert' : 'Mit E = 0 sollte S wirkungslos sein und der gelöschte Zustand bleiben (ist: ' + d + ')')];
        } },
      { id: 'd27', cat: 'Schaltnetze', title: 'Binär in Gray-Code umwandeln', level: 2, spec: { inputs: ['B2', 'B1', 'B0'], gates: [{ id: 'x1', t: 'XOR', in: ['B2', 'B1'] }, { id: 'x0', t: 'XOR', in: ['B1', 'B0'] }], outputs: [{ name: 'G2', src: 'B2', color: 'grün' }, { name: 'G1', src: 'x1', color: 'gelb' }, { name: 'G0', src: 'x0', color: 'rot' }] },
        text: 'Im Gray-Code unterscheiden sich benachbarte Zahlen in genau einem Bit. Drei Schalter B2, B1, B0 stellen eine Binärzahl von 0 bis 7 ein, drei LEDs G2, G1, G0 sollen den Gray-Code zeigen. Das höchste Bit bleibt gleich, jedes weitere Gray-Bit entsteht aus dem eigenen Bit und dem Bit links davon.', hint: 'G2 ist direkt B2. G1 ist B2 xor B1. G0 ist B1 xor B0. Zwei XOR-Gatter genügen. Probiere durch, ob zwischen zwei aufeinanderfolgenden Zahlen immer nur eine LED wechselt.', check: ttCheck(3, 3, b => [b[0], b[0] ^ b[1], b[1] ^ b[2]]) },
      /* Neue Aufgaben nach dem Berufsschulstoff Lernfeld 7 (Rechnerbausteine, Synthese von Logikschaltungen) */
      /* PRUEFEN P1: Der Adressdecoder wählt mit 1 (aktiv-high): genau eine Ausgangsleitung ist 1. Echte Decoder-ICs (74138/74139) und Chip-Select-Eingänge arbeiten oft aktiv-low. Soll das Lab auch die invertierte Form zeigen? */
      { id: 'd28', cat: 'Rechnerbausteine', title: 'Adressdecoder: eine von vier Leitungen wählen', level: 2, spec: DEC24,
        text: 'In einem Rechner wählt eine Adresse genau einen Baustein aus. Der Decoder hat zwei Adressschalter A1 und A0 und vier Ausgänge Z0 bis Z3 (vier LEDs). Immer genau eine LED soll leuchten: bei der Adresse 00 die LED Z0, bei 01 die LED Z1, bei 10 die LED Z2 und bei 11 die LED Z3. Verdrahte die Schaltung aus den vorhandenen Gattern.',
        hint: 'Jeder Ausgang gehört zu genau einer Schalterkombination. Z0 braucht beide Schalter im Zustand 0, also beide invertiert, Z3 braucht beide im Zustand 1. Pro Ausgang ein UND-Gatter; davor kommt je Eingang entweder der Schalter selbst oder sein NICHT-Gatter.',
        check: ttCheck(2, 4, b => { const k = 2 * b[0] + b[1]; return [0, 1, 2, 3].map(i => (i === k ? 1 : 0)); }) },
      { id: 'df4', cat: 'Fehlersuche', title: 'Fehlersuche: der Adressdecoder wählt falsch', level: 2, spec: DEC24, faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'z2' ? Object.assign({}, g, { in: ['A1', 'A0'] }) : g) }),
        text: 'Ein Adressdecoder ist fertig verdrahtet: Zwei Schalter A1 und A0 sollen bei jeder der vier Adressen genau eine der LEDs Z0 bis Z3 einschalten. Bei einer Adresse stimmt aber etwas nicht. Gehe alle vier Schalterstellungen durch, finde die falsche Verbindung und korrigiere sie.',
        hint: 'Schreibe zu jeder Adresse auf, welche LEDs leuchten. Der Fehler zeigt sich bei einer Adresse, bei der nicht genau eine LED leuchtet. Prüfe dann beim zugehörigen UND-Gatter, ob beide Eingänge von der passenden Leitung kommen (Schalter selbst oder sein NICHT-Gatter).',
        check: ttCheck(2, 4, b => { const k = 2 * b[0] + b[1]; return [0, 1, 2, 3].map(i => (i === k ? 1 : 0)); }) },
      /* PRUEFEN P2: Not-Aus ist hier ein Schalter, der bei 1 gedrückt ist. In echten Anlagen ist der Not-Aus ein Öffner (Ruhestrom, drahtbruchsicher). Ist die vereinfachte Logik für die Synthese-Aufgabe in Ordnung? */
      { id: 'd29', cat: 'Schaltnetze', title: 'Synthese: Schutztür an der Bohrmaschine', level: 3, spec: { inputs: ['T', 'N', 'S', 'J'], gates: [{ id: 'nN', t: 'NOT', in: ['N'] }, { id: 'sj', t: 'OR', in: ['S', 'J'] }, { id: 'a1', t: 'AND', in: ['T', 'nN'] }, { id: 'm', t: 'AND', in: ['a1', 'sj'] }], outputs: [{ name: 'M', src: 'm' }] }, start: SK(['T', 'N', 'S', 'J'], ['M']),
        text: 'Eine Standbohrmaschine hat eine Schutztür vor dem Bohrer (Schalter T: geschlossen = 1), einen Not-Aus-Taster (Schalter N: gedrückt = 1), einen Startschalter S und einen Tippschalter J. Der Motor (LED M) darf nur laufen, wenn die Schutztür geschlossen ist und der Not-Aus nicht gedrückt ist und zusätzlich Start oder Tippen betätigt wird. Gehe wie bei der Synthese vor: Eingänge und Ausgang festlegen, Wahrheitstabelle aufstellen, Gleichung bestimmen, Schaltung bauen.',
        hint: 'Zerlege den Satz in Teilbedingungen: „Tür zu“ UND „nicht Not-Aus“ UND („Start“ ODER „Tippen“). Das Wort „nicht“ braucht ein NICHT-Gatter, die Klammer ein ODER-Gatter. Mit dem Werkzeug „Wahrheitstabelle“ siehst du, ob alle 16 Zeilen stimmen.',
        check: ttCheck(4, 1, b => [(b[0] === 1 && b[1] === 0 && (b[2] === 1 || b[3] === 1)) ? 1 : 0]) },
      /* PRUEFEN P3: Die Übung im Unterricht (zwei von drei Pumpen im Normalbetrieb) ist hier mit eigenem Beispiel (drei Lüfter) und als Wahrheitstabelle für „genau zwei“ umgesetzt. Passt die Auslegung „genau zwei“ und nicht „mindestens zwei“? */
      { id: 'd30', cat: 'Schaltnetze', title: 'Genau zwei von drei Lüftern', level: 3, spec: { inputs: ['L1', 'L2', 'L3'], gates: [{ id: 'g12', t: 'AND', in: ['L1', 'L2'] }, { id: 'g13', t: 'AND', in: ['L1', 'L3'] }, { id: 'g23', t: 'AND', in: ['L2', 'L3'] }, { id: 'o1', t: 'OR', in: ['g12', 'g13'] }, { id: 'o2', t: 'OR', in: ['o1', 'g23'] }, { id: 'all', t: 'AND', in: ['g12', 'L3'] }, { id: 'nall', t: 'NOT', in: ['all'] }, { id: 'ok', t: 'AND', in: ['o2', 'nall'] }], outputs: [{ name: 'OK', src: 'ok' }] }, start: SK(['L1', 'L2', 'L3'], ['OK']),
        text: 'Ein Schaltschrank wird von drei Lüftern L1, L2 und L3 gekühlt (Schalter geschlossen = Lüfter läuft). Im Normalbetrieb sollen immer genau zwei Lüfter laufen. Die Kontrollleuchte OK (LED) soll nur dann leuchten, wenn genau zwei Lüfter laufen, nicht bei keinem, einem oder allen dreien. Stelle die Wahrheitstabelle auf und baue die Schaltung.',
        hint: 'Genau zwei heißt: mindestens zwei, aber nicht alle drei. „Mindestens zwei“ liefert die Mehrheitsschaltung aus drei UND-Gattern und zwei ODER-Gattern. Den Fall „alle drei“ erkennst du mit einem weiteren UND und sperrst ihn mit einem NICHT und einem UND vor der LED.',
        check: ttCheck(3, 1, b => [(b[0] + b[1] + b[2]) === 2 ? 1 : 0]) },
      /* PRUEFEN P4: Der 2-Bit-Multiplizierer wird als reine Gatterschaltung gebaut (vier UND, zwei XOR, zwei UND). Im Unterricht kommt er auch als PROM- oder PAL-Aufgabe vor (Programmierung der Verbindungen). Soll dafür eine eigene Aufgabe mit Verbindungsmatrix dazukommen? */
      { id: 'd31', cat: 'Rechnerbausteine', title: 'Multiplizierer für zwei 2-Bit-Zahlen', level: 3, spec: { inputs: ['A1', 'A0', 'B1', 'B0'], gates: [{ id: 'p0', t: 'AND', in: ['A0', 'B0'] }, { id: 'a10', t: 'AND', in: ['A1', 'B0'] }, { id: 'a01', t: 'AND', in: ['A0', 'B1'] }, { id: 'a11', t: 'AND', in: ['A1', 'B1'] }, { id: 'x1', t: 'XOR', in: ['a10', 'a01'] }, { id: 'c', t: 'AND', in: ['a10', 'a01'] }, { id: 'x2', t: 'XOR', in: ['a11', 'c'] }, { id: 'p3', t: 'AND', in: ['a11', 'c'] }],
        outputs: [{ name: 'P3', src: 'p3', color: 'blau' }, { name: 'P2', src: 'x2', color: 'rot' }, { name: 'P1', src: 'x1', color: 'gelb' }, { name: 'P0', src: 'p0', color: 'grün' }] }, start: SK(['A1', 'A0', 'B1', 'B0'], ['P3', 'P2', 'P1', 'P0']),
        text: 'Die Zahl A (Schalter A1, A0) und die Zahl B (Schalter B1, B0) sind je zwei Bit lang, also 0 bis 3. Die vier LEDs P3, P2, P1, P0 sollen das Produkt A mal B als Binärzahl zeigen (zum Beispiel 3 mal 3 = 9 = 1001, 2 mal 3 = 6 = 0110). Baue die Schaltung aus Gattern.',
        hint: 'Rechne schriftlich wie im Dezimalsystem: Es entstehen vier Teilprodukte A0·B0, A1·B0, A0·B1 und A1·B1, jedes ist ein UND. P0 ist A0·B0. Die beiden mittleren Teilprodukte stehen in derselben Stelle: die Summe der beiden (XOR) ist P1, ihr Übertrag (UND) wird zu A1·B1 addiert und ergibt P2 und P3.',
        check: ttCheck(4, 4, b => { const p = (2 * b[0] + b[1]) * (2 * b[2] + b[3]); return [(p >> 3) & 1, (p >> 2) & 1, (p >> 1) & 1, p & 1]; }) },
      /* Neue Aufgaben nach dem Berufsschulstoff Lernfeld E3 (Zahlensysteme, Hexadezimalzahlen) und E9.1 (Pegel, positive und negative Logik, Open-Kollektor, Tri-State) */
      /* PRUEFEN P6: Aufgabe d32 nimmt die Hexadezimalziffer als vier Schalter D3 (höchstes Bit) bis D0 und meldet Buchstaben (A bis F = 10 bis 15). Eigene Aufgabe mit eigenen Zahlen (die Mitschriften behandeln die Umrechnung durch Division mit 16). Ist die Aufgabe für den Unterricht (Hex als Vierergruppe von Bits) passend? */
      { id: 'd32', cat: 'Zahlen und Codes', title: 'Hexadezimalziffer: Zahl oder Buchstabe', level: 2, spec: { inputs: ['D3', 'D2', 'D1', 'D0'], gates: [{ id: 'o', t: 'OR', in: ['D2', 'D1'] }, { id: 'y', t: 'AND', in: ['D3', 'o'] }], outputs: [{ name: 'B', src: 'y' }] }, start: SK(['D3', 'D2', 'D1', 'D0'], ['B']),
        text: 'Eine Hexadezimalziffer wird als vierstellige Binärzahl an den Schaltern D3 (höchstes Bit) bis D0 eingestellt. Die LED B soll leuchten, wenn die Ziffer ein Buchstabe ist (A bis F, also Dezimalwert 10 bis 15), und aus bleiben bei den Ziffern 0 bis 9. Stelle die Wahrheitstabelle auf, suche die einfachste Gleichung und baue die Schaltung.',
        hint: 'Schreibe die Werte 8 bis 15 als Binärzahl auf. Die Buchstaben 10 bis 15 haben alle D3 = 1, genau wie 8 und 9. Was unterscheidet 10 bis 15 von 8 und 9? Suche ein Bit oder eine Verknüpfung zweier Bits, die bei 8 und 9 immer 0 ist. Mit dem Werkzeug „Wahrheitstabelle“ prüfst du alle 16 Zeilen.',
        check: ttCheck(4, 1, b => [(8 * b[0] + 4 * b[1] + 2 * b[2] + b[3]) >= 10 ? 1 : 0]) },
      /* PRUEFEN P7: Aufgabe d33 (Zweierkomplement in 3 Bit) geht über die Hexadezimal- und Dualzahlen der Mitschriften hinaus; das Zweierkomplement mit 8 Bit kommt im Zahlenumrechner vor. Ist die 3-Bit-Schaltung zum Verständnis geeignet, oder soll sie die 4-Bit-Form (mit 16 Zeilen) sein? */
      { id: 'd33', cat: 'Zahlen und Codes', title: 'Zweierkomplement in drei Bit bilden', level: 3, spec: NEG3, start: SK(['A2', 'A1', 'A0'], ['N2', 'N1', 'N0']),
        text: 'Drei Schalter A2, A1, A0 stellen eine Zahl von 0 bis 7 ein. Die drei LEDs N2, N1, N0 sollen das Zweierkomplement dieser Zahl in drei Bit zeigen, also den Wert −A modulo 8. Beispiele: A = 3 (011) ergibt 101, A = 4 (100) ergibt 100, A = 0 ergibt 000. Das Zweierkomplement entsteht, indem man alle Bits kippt und eins addiert. Baue die Schaltung aus Gattern.',
        hint: 'Zweierkomplement = Einerkomplement + 1. Rechne die acht Fälle von Hand und vergleiche A mit dem Ergebnis: Das niedrigste Bit bleibt immer gleich. Ein höheres Bit wird genau dann gekippt, wenn mindestens eines der Bits unter ihm 1 ist. Kippen ist eine XOR-Verknüpfung mit 1.',
        check: ttCheck(3, 3, b => { const a = 4 * b[0] + 2 * b[1] + b[2], n = (8 - a) & 7; return [(n >> 2) & 1, (n >> 1) & 1, n & 1]; }) },
      /* PRUEFEN P8: Aufgabe d34 (negative Logik): Ein gedrückter Taster liefert 0 am Eingang, unbetätigt liefert er 1 (Schalter geschlossen). Das ist hier so gewählt, weil im Lab die Schalter bei geschlossen 1 liefern. Entspricht das der Schreibweise im Unterricht (positive Logik: H = 1, negative Logik: L = 1)? */
      { id: 'd34', cat: 'Logikfamilien', title: 'Drei Taster mit Low als Meldung', level: 2, spec: { inputs: ['A', 'B', 'C'], gates: [{ id: 'u', t: 'AND', in: ['B', 'C'] }, { id: 'y', t: 'NAND', in: ['A', 'u'] }], outputs: [{ name: 'Y', src: 'y' }] }, start: SK(['A', 'B', 'C'], ['Y']),
        text: 'Drei Taster A, B und C arbeiten mit Low als Meldepegel: Im Ruhezustand liefert jeder Taster H (Schalter geschlossen = 1), wird er gedrückt, liegt L (Schalter offen = 0) am Eingang. Die LED Y soll leuchten, sobald mindestens ein Taster gedrückt ist. Im Lab gibt es nur Gatter mit zwei Eingängen. Stelle die Wahrheitstabelle auf und baue die Schaltung mit möglichst wenigen Gattern.',
        hint: 'Gedrückt heißt 0. Y soll 1 sein, wenn A oder B oder C gleich 0 ist, also nur dann 0, wenn alle drei 1 sind. Welches Gatter liefert genau bei lauter Einsen eine 0? Mit zwei Eingängen pro Gatter kannst du zwei Eingänge zuerst zusammenfassen.',
        check: ttCheck(3, 1, b => [(b[0] & b[1] & b[2]) ? 0 : 1]) },
      /* PRUEFEN P9: Aufgabe d35 bildet das Phantom-UND (Wired-AND) der Open-Kollektor-Ausgänge nach: Im Lab gibt es keine Open-Kollektor-Ausgänge, die gemeinsame Leitung mit dem Pull-up-Widerstand wird als UND-Gatter gezeichnet. Ist diese Darstellung für den Unterricht in Ordnung? */
      { id: 'd35', cat: 'Logikfamilien', title: 'Zwei Ausgänge auf einer Sammelleitung', level: 2, spec: { inputs: ['A', 'B', 'C', 'D'], gates: [{ id: 'n1', t: 'NAND', in: ['A', 'B'] }, { id: 'n2', t: 'NAND', in: ['C', 'D'] }, { id: 'q', t: 'AND', in: ['n1', 'n2'] }], outputs: [{ name: 'Q', src: 'q' }] }, start: SK(['A', 'B', 'C', 'D'], ['Q']),
        text: 'Zwei NAND-Gatter mit Open-Kollektor-Ausgang (A und B am ersten, C und D am zweiten) arbeiten gemeinsam auf eine Leitung Q mit einem Pull-up-Widerstand an +UB. Jeder Ausgang, der L führt, zieht die Leitung nach Masse. Nur wenn beide Ausgänge H liefern, bleibt Q auf H. Im Lab gibt es keine Open-Kollektor-Ausgänge: Bilde die Sammelleitung mit einem UND-Gatter hinter den beiden NAND-Gattern nach (Phantom-UND). Baue die Schaltung und prüfe die Tabelle.',
        hint: 'Der Pull-up-Widerstand allein verknüpft nichts. Die Verknüpfung entsteht dadurch, dass jeder leitende Ausgangstransistor die Leitung auf L zieht: Q ist nur H, wenn n1 = H und n2 = H. Das ist ein UND der beiden NAND-Ausgänge.',
        check: ttCheck(4, 1, b => [(!(b[0] & b[1]) && !(b[2] & b[3])) ? 1 : 0]) },
      /* PRUEFEN P10: Aufgabe d36 bildet einen Bus mit Tri-State-Ausgängen logisch nach. Den hochohmigen Zustand kann das Lab nicht darstellen: Sind beide Sender gesperrt, bleibt die LED BUS aus; sind beide freigegeben, ist BUS = DA ODER DB, und die LED KON meldet den Buskonflikt (in einer echten Schaltung wäre der Pegel dann undefiniert, es fließt ein hoher Strom). Ist diese Vereinfachung in Ordnung? */
      { id: 'd36', cat: 'Logikfamilien', title: 'Zwei Sender teilen sich eine Datenleitung', level: 3, spec: BUS2, start: SK(['DA', 'DB', 'EA', 'EB'], ['BUS', 'KON']),
        text: 'Zwei Sender A und B teilen sich eine Datenleitung (Bus). Jeder Sender hat einen Datenschalter (DA, DB) und einen Freigabeschalter (EA, EB), wie der Freigabe-Eingang EN eines Tri-State-Ausgangs: Nur ein freigegebener Sender legt seinen Pegel auf die Leitung, ein gesperrter Sender ist hochohmig und stört nicht. Die LED BUS zeigt den Pegel der Leitung (leuchtet = H). Sind beide Sender gesperrt, bleibt die LED aus, sind beide freigegeben, soll BUS leuchten, wenn mindestens ein Datenschalter 1 ist. Die LED KON leuchtet, wenn beide Sender gleichzeitig freigegeben sind (Buskonflikt). Baue die Schaltung.',
        hint: 'Ein Sender bringt seine Daten nur durch, wenn seine Freigabe 1 ist: Daten UND Freigabe. Die beiden Ergebnisse treffen auf der Leitung zusammen (ODER). Der Konflikt ist die gleichzeitige Freigabe beider Sender. Prüfe mit der Wahrheitstabelle alle 16 Zeilen.',
        check: ttCheck(4, 2, b => [((b[2] & b[0]) | (b[3] & b[1])) ? 1 : 0, (b[2] & b[3]) ? 1 : 0]) },
      /* PRUEFEN P11: Aufgabe d37 (BCD-Korrektur): Bei der Addition zweier BCD-Ziffern ist eine Korrektur (plus 6) nötig, wenn die Dualsumme größer als 9 ist (Übertrag K = 1 oder Summe 1010 bis 1111). Kommt die BCD-Addition im Unterricht vor, oder soll die Aufgabe ersetzt werden? */
      { id: 'd37', cat: 'Zahlen und Codes', title: 'BCD-Summe: wann ist eine Korrektur nötig', level: 3, spec: { inputs: ['K', 'S3', 'S2', 'S1', 'S0'], gates: [{ id: 'o', t: 'OR', in: ['S2', 'S1'] }, { id: 'a', t: 'AND', in: ['S3', 'o'] }, { id: 'y', t: 'OR', in: ['K', 'a'] }], outputs: [{ name: 'KOR', src: 'y' }] }, start: SK(['K', 'S3', 'S2', 'S1', 'S0'], ['KOR']),
        text: 'Zwei BCD-Ziffern (je 0 bis 9) wurden mit einem gewöhnlichen Dualaddierer addiert. Das Ergebnis besteht aus dem Übertrag K und den vier Summenbits S3 bis S0. Ist die Summe größer als 9, ist sie keine gültige BCD-Ziffer, und es muss 6 dazuaddiert werden (Korrektur). Die LED KOR soll leuchten, wenn eine Korrektur nötig ist. Stelle fest, bei welchen Werten das der Fall ist, und baue die Schaltung. Fünf Schalter, eine LED.',
        hint: 'Eine Korrektur ist nötig, wenn K = 1 ist (Summe ab 16) oder wenn S3 S2 S1 S0 zwischen 1010 und 1111 liegt (Summe 10 bis 15). Der zweite Fall ist derselbe wie bei der Hexziffer, die ein Buchstabe ist: S3 UND (S2 ODER S1). Beide Fälle werden mit ODER zusammengefasst.',
        check: ttCheck(5, 1, b => [(b[0] === 1 || (8 * b[1] + 4 * b[2] + 2 * b[3] + b[4]) >= 10) ? 1 : 0]) },
      /* PRUEFEN P12: Fehlersuche df5 (Zweierkomplement in drei Bit): Im Start ist das ODER-Gatter für „unter dem Bit steht eine 1“ durch ein UND ersetzt. Ist das ein typischer Denkfehler (Übertrag nur bei zwei Einsen), oder soll ein anderer Fehler eingebaut werden? */
      { id: 'df5', cat: 'Fehlersuche', title: 'Fehlersuche: das Zweierkomplement stimmt nicht', level: 3, spec: NEG3, faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'o' ? Object.assign({}, g, { t: 'AND' }) : g) }),
        text: 'Eine Schaltung soll das Zweierkomplement einer dreistelligen Dualzahl A2, A1, A0 bilden (die Zahl −A modulo 8, zum Beispiel A = 1 (001) ergibt 111, A = 2 (010) ergibt 110). Die Schaltung ist fertig verdrahtet, aber bei einigen Zahlen zeigen die LEDs ein falsches Ergebnis. Rechne einige Fälle nach, finde das falsche Bauteil und ersetze es.',
        hint: 'Stelle die Tabelle der Schaltung auf und vergleiche sie mit der Rechnung „alle Bits kippen, eins addieren“. Der Fehler liegt im höchsten Bit N2, es wird bei manchen Zahlen nicht gekippt. Ein Bit kippt, wenn mindestens eines der Bits darunter 1 ist: Welches Gatter prüft das?',
        check: ttCheck(3, 3, b => { const a = 4 * b[0] + 2 * b[1] + b[2], n = (8 - a) & 7; return [(n >> 2) & 1, (n >> 1) & 1, n & 1]; }) },
      /* Neue Aufgaben nach dem Berufsschulstoff E9.1 (Flipflop-Arten, asynchrone Zähler, Dekodieren) und E2/E3 (NOR-Technik, Wahrheitstabelle mit Hilfsgrößen) */
      /* PRUEFEN P18: Aufgabe d38 (JK-Flipflop) prüft die Folge J/K = 10, 00, 01, 11, 11, 00 an steigenden Flanken (Q: 1, 1, 0, 1, 0, 0). Im Lab ist das JK-Flipflop ein einfaches flankengesteuertes Bauteil ohne Master-Slave und ohne Setz- und Rücksetzeingänge. Reicht das für den Unterricht? */
      { id: 'd38', cat: 'Speicher und Zähler', title: 'JK-Flipflop: Setzen, Rücksetzen, Kippen', level: 2, spec: JK1,
        text: 'Ein JK-Flipflop hat die Eingänge J und K und einen Takteingang. Bei jeder steigenden Taktflanke gilt: J = 1 und K = 0 setzt Q auf 1, J = 0 und K = 1 setzt Q auf 0, J = K = 0 speichert, und J = K = 1 kippt Q in den anderen Zustand. Verdrahte die Schalter J und K, den Taktgeber und die LEDs Q und Q̄ mit dem JK-Flipflop. Die Prüfung stellt nacheinander J und K vor jeder Flanke ein.',
        hint: 'Schalter J an den oberen Eingang J, Schalter K an den unteren Eingang K, der Taktgeber an den mittleren Takteingang. Der Ausgang Q geht über den Widerstand an die LED Q, der Ausgang Q̄ an die LED Q̄. Das Flipflop reagiert nur im Moment der steigenden Flanke, nicht solange der Takt 1 ist.',
        check() {
          const nd = need(['J', 'K'], 2); if (nd) return [RES(false, nd)];
          if (!api.sch.parts.some(p => p.k === 'JKFF') || !api.sch.parts.some(p => p.k === 'CLK')) return [RES(false, 'JK-Flipflop und Taktgeber werden gebraucht')];
          const steps = [{ J: 1, K: 0 }, { J: 0, K: 0 }, { J: 0, K: 1 }, { J: 1, K: 1 }, { J: 1, K: 1 }, { J: 0, K: 0 }], s = stepClocked(steps, ['Q', 'Q̄']), q = s.map(x => x[0]).join(''), inv = s.every(x => x[0] !== x[1]);
          return [RES(true, 'JK-Flipflop und Taktgeber vorhanden'), RES(q === '110100', q === '110100' ? 'Setzen, Speichern, Rücksetzen und Kippen stimmen (Q: 1, 1, 0, 1, 0, 0)' : 'Mit J/K = 10, 00, 01, 11, 11, 00 sollte Q nach den Flanken 1, 1, 0, 1, 0, 0 zeigen (ist: ' + q.split('').join(', ') + ')'), RES(inv, inv ? 'Q̄ ist immer das Gegenteil von Q' : 'Die LED Q̄ soll immer das Gegenteil von Q zeigen')];
        } },
      { id: 'd39', cat: 'Speicher und Zähler', title: 'Frequenzteiler aus zwei JK-Flipflops', level: 2, spec: JKT,
        text: 'Zwei JK-Flipflops sollen den Takt durch 4 teilen. Liegen J und K beide fest auf 1, kippt das Flipflop bei jeder steigenden Flanke (es teilt durch 2). Das zweite Flipflop bekommt seinen Takt vom ersten. Die LED Q0 soll mit dem halben Takt blinken, die LED Q1 mit einem Viertel. Verdrahte die Schaltung.',
        hint: 'J und K beider Flipflops gehen an Plus der Batterie (fest 1). Der Taktgeber geht an den Takteingang des ersten Flipflops. Das zweite soll kippen, wenn Q0 von 1 auf 0 fällt: Bei einem Flipflop mit steigender Flanke nimmst du dafür den Ausgang Q̄ des ersten als Takt.',
        check() {
          const q0 = ledByL('Q0'), q1 = ledByL('Q1'); if (!q0 || !q1) return [RES(false, 'Die LEDs Q0 und Q1 werden erwartet')];
          const s = clocked(8, E => readL(E, ['Q0', 'Q1'])), a = s.map(x => x[0]).join(''), b = s.map(x => x[1]).join('');
          return [RES(api.sch.parts.filter(p => p.k === 'JKFF').length >= 2, 'Zwei JK-Flipflops vorhanden'), RES(a === '10101010', a === '10101010' ? 'Q0 kippt bei jeder Flanke (Takt durch 2)' : 'Q0 sollte nach jeder Flanke kippen: 1, 0, 1, 0 … (ist: ' + a + ')'), RES(b === '01100110', b === '01100110' ? 'Q1 kippt bei jeder zweiten Flanke (Takt durch 4)' : 'Q1 sollte nach den Flanken 0, 1, 1, 0, 0, 1, 1, 0 zeigen (ist: ' + b + ')')];
        } },
      /* PRUEFEN P19: Aufgabe d40 (asynchroner Rückwärtszähler): Die Flipflops des Labs schalten bei steigender Flanke, deshalb zählt die Kette mit Q als Takt rückwärts und mit Q̄ als Takt aufwärts (d13). Die Signallaufzeit (Beispiel 25 ns je Stufe) steht nur im Text, das Lab simuliert keine Gatterlaufzeiten. Passt das? */
      { id: 'd40', cat: 'Speicher und Zähler', title: 'Asynchroner Rückwärtszähler mit drei Flipflops', level: 3, spec: ABW3,
        text: 'Drei T-Flipflops (T fest auf 1) sollen als asynchroner Zähler rückwärts zählen: Nach dem Start (000) zeigen die LEDs Q2 Q1 Q0 nach jeder Taktflanke 7, 6, 5 … 0 und dann wieder 7. Beim asynchronen Zähler bekommt nur das erste Flipflop den Takt, jedes weitere wird vom Ausgang seines Vorgängers getaktet. Deshalb schalten die Stufen nacheinander: Braucht jedes Flipflop zum Beispiel 25 ns, steht der neue Zählerstand beim Übergang von 000 auf 111 erst nach 75 ns sicher an, dazwischen erscheinen kurz falsche Werte. Verdrahte die Kette.',
        hint: 'T-Eingänge aller drei Flipflops an Plus. Der Taktgeber geht an das erste Flipflop. Die Flipflops kippen bei steigender Flanke am Takteingang. Vergleiche mit dem Aufwärtszähler (Aufgabe „4-Bit-Zähler verdrahten“): Dort ist Q̄ des Vorgängers der Takt. Welcher Ausgang hat eine steigende Flanke, wenn das niedrigere Bit von 0 auf 1 geht?',
        check() { return checkCount(3, [7, 6, 5, 4, 3, 2, 1, 0, 7]); } },
      /* PRUEFEN P20: Aufgabe d41 und Fehlersuche df8 (Zählerstand 5 dekodieren): Der Zählerstand wird mit zwei UND-Gattern aus Q0, Q̄1 und Q2 erkannt (im Unterricht mit einem NAND mit vier Eingängen, zum Beispiel 7420). Das Lab hat nur Gatter mit zwei Eingängen. In df8 ist ein Eingang an Q1 statt an Q̄1 angeschlossen (erkennt 7 statt 5). Ist der Fehler passend? */
      { id: 'd41', cat: 'Speicher und Zähler', title: 'Zählerstand 5 erkennen', level: 3, spec: DEK5,
        text: 'Ein 3-Bit-Zähler aus drei T-Flipflops zählt aufwärts (Q0 ist das niedrigste Bit). Zusätzlich soll die LED Z genau dann leuchten, wenn der Zählerstand 5 ist (binär 101). Verdrahte den Zähler wie beim 4-Bit-Zähler und baue die Erkennung aus den zwei UND-Gattern. Die Flipflops haben auch einen Ausgang Q̄, ein NICHT-Gatter brauchst du nicht.',
        hint: 'Zähler: T-Eingänge an Plus, Takt an das erste Flipflop, Q̄ jedes Flipflops an den Takt des nächsten. Erkennung: 5 = 101 heißt Q2 = 1, Q1 = 0, Q0 = 1. Das erste UND-Gatter verknüpft Q0 und Q̄1, das zweite verknüpft dessen Ausgang mit Q2 und geht an die LED Z.',
        check() { return checkCount(3, [1, 2, 3, 4, 5, 6, 7, 0], 5); } },
      { id: 'df8', cat: 'Fehlersuche', title: 'Fehlersuche: die Anzeige des Zählerstands', level: 3, spec: DEK5, faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'z1' ? Object.assign({}, g, { in: ['f0', 'f1'] }) : g) }),
        text: 'Ein 3-Bit-Aufwärtszähler aus T-Flipflops ist fertig verdrahtet. Die LED Z soll genau beim Zählerstand 5 (binär 101) leuchten. Beobachte im Zeitdiagramm, bei welchem Zählerstand Z wirklich leuchtet, finde die falsche Verbindung und korrigiere sie.',
        hint: 'Schreibe für jeden Zählerstand auf, welche LEDs Q2, Q1, Q0 leuchten und ob Z an ist. Vergleiche das Bitmuster beim Aufleuchten von Z mit 101. Prüfe dann bei den UND-Gattern, ob jedes Bit vom passenden Ausgang kommt (Q oder Q̄).',
        check() { return checkCount(3, [1, 2, 3, 4, 5, 6, 7, 0], 5); } },
      /* PRUEFEN P21: Aufgabe d42 (Setzvorrang): Der Vorrang entsteht durch ein UND-Gatter, das R nur bei S = 0 durchlässt. Im Unterricht kommen RS-Flipflops mit dominantem Setz- oder Rücksetzeingang als Symbol vor. Ist der Aufbau aus Gattern passend? */
      { id: 'd42', cat: 'Speicher und Zähler', title: 'Speicher mit Vorrang für Setzen', level: 3, spec: SVOR, start: () => strip(SVOR),
        text: 'Beim SR-Speicher aus zwei NOR-Gattern ist S = R = 1 verboten. Ein Speicher mit Setzvorrang löst das: Sind S und R gleichzeitig 1, gewinnt S, und Q wird 1. Baue ihn aus den zwei NOR-Gattern im Kreuz und einem Vorschaltgatter: R darf nur dann wirken, wenn S nicht betätigt ist. Die Prüfung schaltet S und R nacheinander, auch beide zugleich.',
        hint: 'Q = NOR(R′, Q̄) und Q̄ = NOR(S, Q) wie beim SR-Speicher. R′ ist R UND (NICHT S): Das NICHT-Gatter bekommt S, das UND-Gatter bekommt R und den Ausgang des NICHT-Gatters. Sind S und R beide 1, ist R′ = 0, und S setzt den Speicher.',
        check() {
          const nd = need(['S', 'R'], 2); if (nd) return [RES(false, nd)];
          const s = stepLatch([{ S: 1, R: 0 }, { S: 0, R: 0 }, { S: 0, R: 1 }, { S: 1, R: 1 }, { S: 0, R: 1 }, { S: 0, R: 0 }], ['Q', 'Q̄']), q = s.map(x => x[0]).join('');
          return [RES(q.slice(0, 3) === '110', q.slice(0, 3) === '110' ? 'Setzen, Speichern und Rücksetzen arbeiten' : 'S = 1 soll setzen, S = R = 0 speichern, R = 1 löschen (Q ist: ' + q.slice(0, 3).split('').join(', ') + ')'), RES(q[3] === '1' && s[3][1] === '0', q[3] === '1' && s[3][1] === '0' ? 'Bei S = R = 1 hat Setzen Vorrang (Q = 1, Q̄ = 0)' : 'Bei S = R = 1 soll Q = 1 und Q̄ = 0 sein (ist: Q = ' + q[3] + ', Q̄ = ' + s[3][1] + ')'), RES(q.slice(4) === '00', q.slice(4) === '00' ? 'Lässt man S los, löscht R den Speicher wieder' : 'Nach dem Loslassen von S soll R = 1 löschen (Q ist: ' + q.slice(4).split('').join(', ') + ')')];
        } },
      /* PRUEFEN P22: Aufgabe d43 (D-Speicher, pegelgesteuert): Die Unterscheidung pegelgesteuert / flankengesteuert wird am Gatteraufbau gezeigt (d43) und am D-Flipflop des Labs (d12, d14). Sollen die Schaltzeichen (Dreieck am Takteingang) zusätzlich abgefragt werden? */
      { id: 'd43', cat: 'Speicher und Zähler', title: 'D-Speicher mit Freigabe (pegelgesteuert)', level: 3, spec: DLAT, start: () => strip(DLAT),
        text: 'Ein pegelgesteuerter D-Speicher hat einen Dateneingang D und einen Freigabeeingang E. Solange E = 1 ist, folgt Q dem Eingang D; bei E = 0 hält Q den letzten Wert, egal wie D steht. Im Gegensatz dazu übernimmt ein flankengesteuertes D-Flipflop D nur im Moment der Taktflanke. Baue den D-Speicher aus einem NICHT-Gatter, zwei UND-Gattern und zwei NOR-Gattern im Kreuz.',
        hint: 'Aus D wird S = D UND E, aus dem umgekehrten D wird R = (NICHT D) UND E. Diese beiden gehen an den SR-Speicher aus zwei NOR-Gattern: Q = NOR(R, Q̄), Q̄ = NOR(S, Q). So kann der verbotene Fall S = R = 1 nie auftreten.',
        check() {
          const nd = need(['D', 'E'], 2); if (nd) return [RES(false, nd)];
          const s = stepLatch([{ D: 1, E: 1 }, { D: 0, E: 1 }, { D: 1, E: 1 }, { D: 1, E: 0 }, { D: 0, E: 0 }, { D: 0, E: 1 }, { D: 0, E: 0 }, { D: 1, E: 0 }], ['Q', 'Q̄']), q = s.map(x => x[0]).join(''), inv = s.every(x => x[0] !== x[1]);
          return [RES(q.slice(0, 3) === '101', q.slice(0, 3) === '101' ? 'Bei E = 1 folgt Q dem Eingang D' : 'Bei E = 1 soll Q dem Eingang D folgen: 1, 0, 1 (ist: ' + q.slice(0, 3).split('').join(', ') + ')'), RES(q.slice(3, 5) === '11', q.slice(3, 5) === '11' ? 'Bei E = 0 hält Q den Wert, auch wenn D wechselt' : 'Bei E = 0 soll Q bei 1 bleiben, obwohl D auf 0 geht (ist: ' + q.slice(3, 5).split('').join(', ') + ')'), RES(q[5] === '0', q[5] === '0' ? 'Mit E = 1 übernimmt der Speicher wieder D' : 'Mit E = 1 und D = 0 soll Q wieder 0 werden'), RES(q.slice(6) === '00', q.slice(6) === '00' ? 'Bei E = 0 bleibt Q auch dann 0, wenn D auf 1 geht' : 'Bei E = 0 darf D = 1 den Speicher nicht setzen (Q ist: ' + q.slice(6).split('').join(', ') + ')'), RES(inv, inv ? 'Q̄ ist immer das Gegenteil von Q' : 'Die LED Q̄ soll immer das Gegenteil von Q zeigen')];
        } },
      { id: 'd44', cat: 'Grundgatter', title: 'UND und ODER nur aus NOR-Gattern', level: 2, spec: NOR2,
        text: 'Mit NOR-Gattern allein lässt sich jede Verknüpfung bauen. Verdrahte die fünf NOR-Gatter so, dass die LED U wie ein UND-Gatter (A und B) und die LED O wie ein ODER-Gatter (A oder B) arbeitet. Andere Gatter sind nicht erlaubt.',
        hint: 'Ein NOR mit zusammengelegten Eingängen ist ein NICHT. ODER: Kehre das NOR von A und B noch einmal um. UND: Kehre A und B je einzeln um (zwei NOR als NICHT) und verknüpfe die beiden Ergebnisse mit einem NOR. Das ist die Regel von De Morgan: A · B = NICHT(NICHT A + NICHT B).',
        check: ttCheck(2, 2, b => [b[0] & b[1], b[0] | b[1]], [() => { const fremd = api.sch.parts.filter(p => ['AND', 'OR', 'NAND', 'XOR', 'NOT', 'SNOT'].includes(p.k)).length; return RES(fremd === 0, fremd === 0 ? 'Nur NOR-Gatter verwendet' : 'Es sollen nur NOR-Gatter verwendet werden (' + fremd + ' andere Gatter gefunden)'); }]) },
      /* PRUEFEN P23: Aufgabe d45 und Fehlersuche df9 (Gatternetz mit Hilfsgrößen V, W, X wie im Unterricht E2/E3): eigenes Netz mit Z = (V UND C) ODER W, V = A NAND B, W = B NOR C; vereinfacht Z = NICHT B ODER (NICHT A UND C). In df9 ist das NOR für W durch ein ODER ersetzt. Passt die Schwierigkeit? */
      { id: 'd45', cat: 'Schaltnetze', title: 'Gatternetz mit Hilfsgrößen nachbauen', level: 2, spec: HILF,
        text: 'Ein Gatternetz ist mit Hilfsgrößen beschrieben: V = A NAND B, W = B NOR C, X = V UND C und der Ausgang Z = X ODER W. Die vier Gatter tragen die Namen V, W, X und Z. Verdrahte die Schalter A, B, C, die Gatter und die LED Z nach dieser Beschreibung. Stelle zur Kontrolle die Wahrheitstabelle mit den Hilfsspalten V, W und X auf.',
        hint: 'Gehe Spalte für Spalte vor: V hängt nur von A und B ab, W nur von B und C, X von V und C, Z von X und W. In der Tabelle mit acht Zeilen trägst du zuerst V und W ein, dann X, zuletzt Z. Zur Probe: Z ist 0 genau bei den Eingängen 010, 110 und 111 (A B C).',
        check: ttCheck(3, 1, hilfFn) },
      { id: 'df9', cat: 'Fehlersuche', title: 'Fehlersuche: das Gatternetz mit Hilfsgrößen', level: 2, spec: HILF, faulty: spec => Object.assign({}, spec, { gates: spec.gates.map(g => g.id === 'w' ? Object.assign({}, g, { t: 'OR' }) : g) }),
        text: 'Ein fertig verdrahtetes Gatternetz soll Z nach dieser Beschreibung bilden: V = A NAND B, W = B NOR C, X = V UND C, Z = X ODER W. In einigen Zeilen der Wahrheitstabelle stimmt Z aber nicht. Stelle die Tabelle mit den Hilfsspalten auf, vergleiche sie mit der Schaltung, finde das falsche Bauteil und ersetze es.',
        hint: 'Rechne die Hilfsspalten von Hand aus und miss dann in der Schaltung nach (Werkzeug „Wahrheitstabelle“). Die erste Hilfsspalte, die nicht passt, zeigt dir das Gatter mit dem Fehler. Achte darauf, welche Gatter ein umgekehrtes Ergebnis liefern sollen.',
        check: ttCheck(3, 1, hilfFn) },
    ];
    /* Mini-CPU-Aufgaben: Programm schreiben, Prüfung läuft den Prozessor */
    const cpuRun = (nClocks, setInputs) => {
      const e0 = api.sch, T = 1 / clkHz(), sw = api.sch.parts.filter(p => p.k === 'SPST'), set = {}; if (setInputs != null) sw.forEach((p, i) => { set[p.id] = (setInputs >> i) & 1; });
      const E = api.simEval({ set }), cpu = () => E.c.elems.find(x => x.type === 'IC' && x.key === 'cpu4'), seq = [];
      for (let k = 0; k < nClocks; k++) { E.run(k ? T : 1.3 * T); const c = cpu(); seq.push(c ? c.st.out : -1); }
      return { seq, err: root.CPU4.program().errors, cpu: cpu() };
    };
    const changes = seq => seq.filter((v, i) => i === 0 || v !== seq[i - 1]);
    const cpuHas = () => api.sch.parts.some(p => p.k === 'CPU');
    const T2 = [
      { id: 'dc1', cat: 'Mini-CPU', title: 'Programmiere einen Aufwärtszähler', level: 2, cpu: { clk: '40Hz', code: '; Schreibe dein Programm: Zähle von 0 an aufwärts und zeige die Zahl mit OUT.\n' }, sol: 'start:  LDI 0\nloop:   OUT\n        INC\n        JMP loop\n',
        text: 'Die Mini-CPU ist verdrahtet, ihr Programm ist leer. Schreibe im Menü „Mini-CPU: Programm“ ein Programm, das bei 0 beginnt und endlos aufwärts zählt: die LEDs zeigen die Zahl binär.', hint: 'Starte mit LDI 0. In einer Schleife: OUT zeigt A, INC zählt eins hoch, JMP springt zurück zur Marke der Schleife.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(60), ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const ok = ch.length >= 6 && ch.slice(0, 6).every((v, i) => v === i + 1); return [RES(true, 'Programm ist fehlerfrei'), RES(ok, ok ? 'Die Ausgabe zählt 1, 2, 3, 4 … aufwärts' : 'Die Ausgabe sollte 0, 1, 2, 3 … zählen (gesehen: ' + changes(r.seq).slice(0, 8).join(', ') + ')')]; } },
      { id: 'dc2', cat: 'Mini-CPU', title: 'Programmiere ein Lauflicht', level: 3, cpu: { clk: '40Hz', code: '; Ein Licht soll durch die vier LEDs wandern.\n' }, sol: 'start:  LDI 1\nloop:   OUT\n        SHL\n        JNC loop\n        JMP start\n',
        text: 'Programmiere die Mini-CPU so, dass ein einzelnes Licht durch die vier LEDs wandert: 1, 2, 4, 8 und wieder von vorn.', hint: 'LDI 1 setzt das niedrigste Bit. SHL schiebt es um eine Stelle nach links. Das Bit, das links herausfällt, landet im Übertrag C: Mit JNC bleibst du in der Schleife, solange es nicht passiert ist.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(80), ch = changes(r.seq).filter(v => v !== 0); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const ok = ch.length >= 8 && ch.every((v, i) => i === 0 || v === (ch[i - 1] === 8 ? 1 : ch[i - 1] * 2)) && [1, 2, 4, 8].includes(ch[0]); return [RES(true, 'Programm ist fehlerfrei'), RES(ok, ok ? 'Das Licht wandert 1, 2, 4, 8 und beginnt wieder von vorn' : 'Erwartet wird die Folge 1, 2, 4, 8, 1, 2 … (gesehen: ' + changes(r.seq).slice(0, 8).join(', ') + ')')]; } },
      { id: 'dc3', cat: 'Mini-CPU', title: 'Programmiere: Eingabe verdoppeln', level: 3, cpu: { clk: '60Hz', inputs: 4, code: '; Lies die Schalter, verdopple die Zahl und zeige sie an.\n' }, sol: 'loop:   IN\n        TAB\n        ADD\n        OUT\n        JMP loop\n',
        text: 'Die vier Schalter IN0 bis IN3 sind eine Zahl von 0 bis 15. Die Mini-CPU soll sie lesen, verdoppeln und auf den LEDs anzeigen (bei Überlauf bleiben nur die unteren vier Bit).', hint: 'IN lädt die Schalter in A. TAB kopiert A nach B. ADD addiert B zu A (also A + A). OUT zeigt das Ergebnis. JMP zurück zum Anfang.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const bad = []; let err = null; [0, 1, 3, 5, 7, 9].forEach(v => { const r = cpuRun(30, v); if (r.err.length) err = r.err[0]; const last = r.seq[r.seq.length - 1]; if (last !== ((2 * v) & 15)) bad.push(v + ' → ' + last + ' (soll ' + ((2 * v) & 15) + ')'); }); if (err) return [RES(false, 'Das Programm hat Fehler: Zeile ' + err.line + ', ' + err.msg)]; return [RES(true, 'Programm ist fehlerfrei'), RES(!bad.length, !bad.length ? 'Alle geprüften Eingaben werden richtig verdoppelt' : 'Falsch bei: ' + bad.slice(0, 3).join('; '))]; } },
      { id: 'dc4', cat: 'Mini-CPU', title: 'Programmiere einen Dekadenzähler (0 bis 9)', level: 3, cpu: { clk: '40Hz', code: '; Zähle 0 bis 9 und beginne dann wieder bei 0.\n' }, sol: 'start:  LDI 0\nloop:   OUT\n        INC\n        CMPI 10\n        JNZ loop\n        JMP start\n',
        text: 'Schreibe ein Programm, das von 0 bis 9 zählt und danach wieder bei 0 beginnt (wie ein Dezimalzähler).', hint: 'Zähle wie beim Aufwärtszähler, aber vergleiche nach INC mit CMPI 10. Das Flag Z zeigt, ob A gleich 10 ist: JNZ bleibt in der Schleife, solange das nicht so ist.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(120), ch = changes(r.seq); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const s = ch.join(','), ok = /(^|,)0,1,2,3,4,5,6,7,8,9,0,1,2/.test(',' + s) || s.startsWith('0,1,2,3,4,5,6,7,8,9,0'); const over = ch.some(v => v > 9); return [RES(true, 'Programm ist fehlerfrei'), RES(ok && !over, ok && !over ? 'Die Ausgabe zählt 0 bis 9 und beginnt neu' : 'Erwartet 0, 1 … 9, 0, 1 … (gesehen: ' + ch.slice(0, 14).join(', ') + ')')]; } },
    ];
    /* Aufgaben zu den Werkzeugen KV-Diagramm, Zustandsautomat und Reset */
    const PL = () => root.DIGI_PLUS && root.DIGI_PLUS(api);
    const fsmCheck = (tmpl, bitsSeq, want, withReset) => () => {
      const P = PL(); const sws = api.sch.parts.filter(p => p.k === 'SPST'), X = sws.find(p => p.l === 'X'), R = sws.find(p => p.l === 'R'), dffs = api.sch.parts.filter(p => p.k === 'DFF');
      if (!dffs.length) return [RES(false, 'Es fehlen D-Flipflops (der Zustandsspeicher). Nutze das Werkzeug „Zustandsautomat“ im Menü und baue die Schaltung.')];
      if (!X) return [RES(false, 'Es fehlt der Eingangsschalter X')];
      if (withReset && !R) return [RES(true, 'Zustandsspeicher aus D-Flipflops vorhanden'), RES(false, 'Es fehlt der Reset-Schalter R (im Werkzeug „Reset-Schalter R einbauen“ ankreuzen)')];
      const leds = api.sch.parts.filter(p => p.k === 'LED'), led = n => leds.find(l => l.l === n) || null;
      const T = 1 / clkHz(), E = api.simEval({ set: Object.assign({ [X.id]: 0 }, R ? { [R.id]: 0 } : {}) }), got = []; let t = 0;
      for (let k = 0; k < bitsSeq.length; k++) { E.wm.get(X.id).sw = bitsSeq[k]; const target = (k + 1) * T + 0.3 * T; E.run(target - t); t = target; got.push(want.read(E, led, ledOn)); }
      const L = [RES(true, 'Zustandsspeicher aus D-Flipflops vorhanden'), RES(got.join('') === want.seq.join(''), got.join('') === want.seq.join('') ? want.ok : want.bad + ' (erwartet ' + want.seq.join('') + ', gesehen ' + got.join('') + ')')];
      if (withReset) { E.wm.get(R.id).sw = 1; E.wm.get(X.id).sw = 1; E.run(T); const st = want.read(E, led, ledOn); L.push(RES(st === 0, st === 0 ? 'Mit R = 1 geht der Automat beim nächsten Takt in den Startzustand' : 'Mit R = 1 sollte der Automat beim nächsten Takt im Startzustand sein')); }
      return L;
    };
    const readQ = (E, led, on) => { const q0 = led('Q0'), q1 = led('Q1'); return (q1 && on(E, q1.id) ? 2 : 0) + (q0 && on(E, q0.id) ? 1 : 0); };
    const readZ = (E, led, on) => { const ls = api.sch.parts.filter(p => p.k === 'LED'), z = led('Z') || ls.find(l => !/^Q\d$/.test(l.l || '')) || ls.slice(-1)[0]; return z && on(E, z.id) ? 1 : 0; };
    const SCHRANKE = { x: true, outs: ['Auf'], states: [{ n: 'Zu', o: [0], t: [0, 1] }, { n: 'Offen1', o: [1], t: [2, 2] }, { n: 'Offen2', o: [1], t: [0, 0] }] };
    const tasksPlus = [
      { id: 'd20', cat: 'Kundenauftrag', title: 'Kundenauftrag: Schranke mit Münzeinwurf', level: 3, start: () => strip({ inputs: ['X'], gates: [], outputs: [{ name: 'Auf', src: 'X' }], scope: [] }),
        solFn: () => PL().fsmSpec(SCHRANKE, false),
        text: 'Eine Schranke öffnet, wenn eine Münze eingeworfen wird (X = 1, ein Takt lang), bleibt zwei Takte offen und schließt dann von allein. Der Ausgang Auf ist 1, solange die Schranke offen ist. Entwirf den Automaten mit dem Werkzeug „Zustandsautomat“ (Menü) und lass die Schaltung bauen. Sie wird mit der Eingabe 0, 1, 0, 0, 0, 0 geprüft.',
        hint: 'Drei Zustände: Zu (Auf = 0), Offen1 und Offen2 (Auf = 1). Von Zu geht es bei X = 1 nach Offen1, danach ohne Bedingung nach Offen2 und von dort zurück nach Zu. Starte mit der Vorlage „Treppenlicht“ und entferne den letzten Zustand: Der zweite offene Zustand muss nach Zu führen.',
        check: fsmCheck('schranke', [0, 1, 0, 0, 0, 0], { seq: [0, 1, 1, 0, 0, 0], read: readZ, ok: 'Die Schranke öffnet nach der Münze, bleibt zwei Takte offen und schließt', bad: 'Der Ausgang Auf folgt nicht dem Ablauf (Zu, Offen, Offen, Zu)' }) },
      { id: 'd15', cat: 'Vereinfachen', title: 'KV-Diagramm: Funktion mit vier Variablen', level: 3, start: SK(['A', 'B', 'C', 'D'], ['Y']),
        solSpec: { inputs: ['A', 'B', 'C', 'D'], gates: [{ id: 'nB', t: 'NOT', in: ['B'] }, { id: 'nC', t: 'NOT', in: ['C'] }, { id: 'nD', t: 'NOT', in: ['D'] }, { id: 'a1', t: 'AND', in: ['nC', 'nD'] }, { id: 'a2', t: 'AND', in: ['C', 'D'] }, { id: 'o', t: 'OR', in: ['a1', 'a2'] }, { id: 'y', t: 'AND', in: ['nB', 'o'] }], outputs: [{ name: 'Y', src: 'y', color: 'grün' }] },
        text: 'Y soll genau dann 1 sein, wenn die Zahl ABCD die Werte 0, 3, 8 oder 11 hat (Dezimal). Trage die Einsen in das KV-Diagramm ein (Menü „KV-Diagramm“), lies die kürzeste Gleichung ab und baue die Schaltung. Vier Schalter A bis D und eine LED.', hint: 'Die Felder 0 und 8 sowie 3 und 11 bilden je eine Zweiergruppe über den oberen/unteren Rand: Y = ¬B · ¬C · ¬D + ¬B · C · D. Ausgeklammert: Y = ¬B · (¬C · ¬D + C · D). „Schaltung bauen“ im KV-Werkzeug erledigt den Bau.',
        check: ttCheck(4, 1, b => [(b[1] === 0 && b[2] === b[3]) ? 1 : 0]) },
      { id: 'd16', cat: 'Vereinfachen', title: 'KV mit Don’t-Care: Ziffern 5 bis 9', level: 3, start: SK(['A', 'B', 'C', 'D'], ['Y']),
        solSpec: { inputs: ['A', 'B', 'C', 'D'], gates: [{ id: 'a1', t: 'AND', in: ['B', 'C'] }, { id: 'a2', t: 'AND', in: ['B', 'D'] }, { id: 'o1', t: 'OR', in: ['a1', 'a2'] }, { id: 'o2', t: 'OR', in: ['A', 'o1'] }], outputs: [{ name: 'Y', src: 'o2', color: 'grün' }] },
        text: 'Eine BCD-Ziffer (0 bis 9, vier Schalter ABCD) soll erkannt werden: Y = 1 für die Ziffern 5 bis 9. Die Werte 10 bis 15 kommen bei BCD nie vor: Sie sind Don\'t-Care. Trage im KV-Diagramm 1 für 5 bis 9 und X für 10 bis 15 ein und baue die einfachste Schaltung. Nur die Zeilen 0 bis 9 werden geprüft.', hint: 'Mit den Don\'t-Care-Feldern werden die Gruppen groß: Y = A + B · C + B · D (drei Gruppen). Tippe auf ein Feld mehrmals: 0, 1, X.',
        check() { const an = analyse(api); if (an.error) return [RES(false, an.error)]; if (an.n !== 4 || an.outs.length !== 1) return [RES(false, 'Es werden vier Schalter (A bis D) und eine LED erwartet')]; const bad = []; for (let c = 0; c < 10; c++) if (an.rows[c][0] !== (c >= 5 ? 1 : 0)) bad.push(c); return [RES(!bad.length, !bad.length ? 'Für die Ziffern 0 bis 9 stimmt die Tabelle' : 'Falsch bei der Ziffer ' + bad[0] + (bad.length > 1 ? ' (und ' + (bad.length - 1) + ' weiteren)' : ''))]; } },
      { id: 'd17', cat: 'Zustandsautomaten', title: 'Zustandsautomat: Zähler 0 bis 3 mit Freigabe', level: 3, start: () => strip({ inputs: ['X'], gates: [], outputs: [{ name: 'Q1', src: 'X' }, { name: 'Q0', src: 'X' }], scope: [] }),
        solFn: () => { const P = PL(); return P.fsmSpec(P.FSM_T['Zähler 0 bis 3 mit Freigabe'], false); },
        text: 'Ein Zähler soll bei jedem Takt weiterzählen (00, 01, 10, 11, 00 …), solange der Schalter X (Freigabe) geschlossen ist. Bei X = 0 bleibt er stehen. Öffne im Menü das Werkzeug „Zustandsautomat“, wähle die Vorlage „Zähler 0 bis 3 mit Freigabe“, sieh dir Diagramm und Gleichungen an und lass die Schaltung bauen.', hint: 'Das Werkzeug zeigt Zustandsdiagramm, Zustandstabelle und die Gleichungen für D0 und D1. „Schaltung bauen“ erzeugt zwei D-Flipflops, die Gatter und die LEDs Q1 und Q0.',
        check: fsmCheck('count', [1, 1, 1, 1, 0, 0], { seq: [1, 2, 3, 0, 0, 0], read: readQ, ok: 'Mit X = 1 zählt er 1, 2, 3, 0 und bleibt bei X = 0 stehen', bad: 'Zählfolge falsch' }) },
      { id: 'd18', cat: 'Zustandsautomaten', title: 'Zustandsautomat: Folge 101 erkennen', level: 3, start: () => strip({ inputs: ['X'], gates: [], outputs: [{ name: 'Z', src: 'X' }], scope: [] }),
        solFn: () => { const P = PL(); return P.fsmSpec(P.FSM_T['Folge 101 erkennen'], false); },
        text: 'Ein Automat soll die Bitfolge 1, 0, 1 am Eingang X erkennen: Nach jeder Taktflanke wird X gelesen. Der Ausgang Z soll 1 sein, solange der Automat nach „101“ im letzten Zustand steht. Wähle im Werkzeug „Zustandsautomat“ die Vorlage „Folge 101 erkennen“ und baue die Schaltung. Die Prüfung füttert sie mit 1,0,1,1,0,1,0,0.', hint: 'Zustände: Start, 1, 10, 101. Z gehört zum Zustand 101. Im Werkzeug sind Tabelle und Diagramm schon eingetragen, du musst die Schaltung nur bauen lassen und mit X und dem Takt prüfen.',
        check: fsmCheck('seq', [1, 0, 1, 1, 0, 1, 0, 0], { seq: [0, 0, 1, 0, 0, 1, 0, 0], read: readZ, ok: 'Z wird nach 1, 0, 1 zu 1 und sonst 0 (beide Treffer erkannt)', bad: 'Der Ausgang Z folgt nicht der Folge 101' }) },
      { id: 'd19', cat: 'Zustandsautomaten', title: 'Reset-Eingang: Zähler mit Rücksetzen', level: 3, start: () => strip({ inputs: ['X', 'R'], gates: [], outputs: [{ name: 'Q1', src: 'X' }, { name: 'Q0', src: 'X' }], scope: [] }),
        solFn: () => { const P = PL(); return P.fsmSpec(P.FSM_T['Zähler 0 bis 3 mit Freigabe'], true); },
        text: 'Ein Reset-Eingang bringt den Automaten in einen bekannten Startzustand. Baue den Zähler 0 bis 3 mit Freigabe noch einmal, diesmal mit angekreuztem „Reset-Schalter R einbauen“: Bei R = 1 geht er mit dem nächsten Takt auf 0, egal wie X steht. (Das ist ein synchroner Reset; asynchron arbeiten Clear und Preset der ICs.)', hint: 'Im Werkzeug „Zustandsautomat“: Vorlage „Zähler 0 bis 3 mit Freigabe“, Haken bei „Reset-Schalter R“, dann bauen. Jeder D-Eingang wird mit ¬R verundet: Ist R = 1, wird D = 0.',
        check: fsmCheck('countr', [1, 1, 1, 1, 0, 0], { seq: [1, 2, 3, 0, 0, 0], read: readQ, ok: 'Der Zähler zählt mit Freigabe', bad: 'Zählfolge falsch' }, true) },
    ];
    const tasks = [];
    T1.forEach(t => {
      const sp = t.spec, mk = t.start || (() => strip(sp)), sol = () => layout(api, sp), f = t.faulty;
      tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: f ? () => layout(api, f(sp)) : mk, solMake: sol, check: t.check });
    });
    T2.forEach(t => tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: () => cpuLayout(api, t.cpu), solMake: () => cpuLayout(api, Object.assign({}, t.cpu, { code: t.sol })), check: t.check }));
    tasksPlus.forEach(t => tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: t.start, solMake: t.solFn ? () => layout(api, t.solFn()) : () => layout(api, t.solSpec), check: t.check }));
    /* Mini-CPU: Unterprogramme */
    const hasOp = op => root.CPU4.program().prog.some(i => i.op === op);
    const T3 = [
      { id: 'dc5', cat: 'Mini-CPU', title: 'Programmiere ein Unterprogramm (CALL und RET)', level: 3, cpu: { clk: '40Hz', code: '; Hauptprogramm: gib mit einem Unterprogramm erst 5, dann 10 aus.\n' }, sol: 'start:  LDI 5\n        CALL zeige\n        LDI 10\n        CALL zeige\n        JMP start\nzeige:  OUT\n        NOP\n        RET\n',
        text: 'Schreibe ein Programm, das mit einem <b>Unterprogramm</b> zuerst 5 und dann 10 ausgibt und endlos wiederholt. Das Unterprogramm „zeige“ gibt den Wert in A mit OUT aus. Rufe es mit CALL zeige auf und springe mit RET zurück.'.replace(/<\/?b>/g, ''), hint: 'CALL merkt sich die Adresse hinter dem Befehl und springt zur Marke. RET springt dorthin zurück. Das Unterprogramm steht hinter dem Hauptprogramm (nach JMP start), sonst läuft es versehentlich mit.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(100), ch = changes(r.seq); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const usesSub = hasOp('CALL') && hasOp('RET'); const ok = ch.filter(v => v !== 0).slice(0, 6).every((v, i) => v === (i % 2 ? 10 : 5)) && ch.filter(v => v !== 0).length >= 4; return [RES(true, 'Programm ist fehlerfrei'), RES(usesSub, usesSub ? 'Das Programm nutzt CALL und RET' : 'Nutze CALL zum Aufrufen und RET zum Zurückspringen'), RES(ok, ok ? 'Die Ausgabe wechselt 5, 10, 5, 10 …' : 'Erwartet wird 5, 10, 5, 10 … (gesehen: ' + ch.slice(0, 8).join(', ') + ')')]; } },
      { id: 'dc6', cat: 'Mini-CPU', title: 'Programmiere ein Blinklicht mit Warte-Unterprogramm', level: 3, cpu: { clk: '60Hz', code: '; Blinklicht: alle vier LEDs an, warten, aus, warten. Das Warten steckt in einem Unterprogramm.\n' }, sol: 'start:  OUTI 15\n        CALL warte\n        OUTI 0\n        CALL warte\n        JMP start\nwarte:  LDI 5\nw1:     DEC\n        JNZ w1\n        RET\n',
        text: 'Alle vier LEDs sollen abwechselnd an (15) und aus (0) gehen, dazwischen wartet ein Unterprogramm „warte“ mit einer Zählschleife. Nutze CALL und RET und schreibe die Wartezeit nur einmal.', hint: 'Das Unterprogramm zählt A herunter: LDI 5, dann DEC und JNZ zurück zur Schleifenmarke, am Ende RET. Das Hauptprogramm ruft es zweimal auf.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(150), ch = changes(r.seq); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const calls = root.CPU4.program().prog.filter(i => i.op === 'CALL').length; const ok = ch.length >= 5 && ch.slice(0, 6).every((v, i) => v === (i % 2 ? 0 : 15)); return [RES(true, 'Programm ist fehlerfrei'), RES(calls >= 1 && hasOp('RET'), calls >= 1 && hasOp('RET') ? 'Das Programm nutzt ein Unterprogramm' : 'Nutze CALL und RET'), RES(ok, ok ? 'Alle LEDs gehen im Wechsel an und aus' : 'Erwartet wird 15, 0, 15, 0 … (gesehen: ' + ch.slice(0, 8).join(', ') + ')')]; } },
      /* Neue Mini-CPU-Aufgaben nach dem Berufsschulstoff Lernfeld 7 und 11 (Maske und Zero-Flag, Stapel nach dem LIFO-Prinzip, Carry-Flag) */
      /* PRUEFEN P5: Die Mini-CPU TF-4 hat vier Bit und einen eigenen, kleinen Befehlssatz (LDI, ADDI, JZ, PUSH, POP ...), der Unterricht nutzt echte 8-Bit-Assembler (IN, OUT, MVI, MOV, JMP, JZ). Die Aufgaben dc7 (Schalter abfragen und zählen), dc8 (Stapel, LIFO) und dc9 (Carry-Flag) gehen von den Beispielen dort aus. Wie nah soll die Syntax am Unterrichts-Assembler liegen? Hinweis: INC und DEC setzen im TF-4 das Carry-Flag, beim 8085 (INR, DCR) bleibt Carry unverändert. */
      { id: 'dc7', cat: 'Mini-CPU', title: 'Programmiere: Zähler mit Startschalter', level: 3, cpu: { clk: '60Hz', inputs: 4, code: '; Zähle erst, wenn der Schalter IN0 geschlossen ist. Bis dahin bleiben die LEDs aus.\n' }, sol: 'warte:  LDBI 1\n        IN\n        AND           ; nur Bit 0 bleibt übrig\n        JZ warte      ; Z = 1: Schalter offen, weiter warten\n        LDI 0\nzaehl:  OUT\n        INC\n        JMP zaehl\n',
        text: 'Die Mini-CPU soll erst zu zählen beginnen, wenn der Schalter IN0 geschlossen ist. Solange er offen ist, bleiben alle LEDs aus. Die anderen drei Schalter sollen keine Rolle spielen. Danach zählt sie von 0 an aufwärts und zeigt die Zahl binär an.',
        hint: 'IN lädt alle vier Schalter nach A. Mit einer Maske (LDBI 1, dann AND) bleibt nur das Bit von IN0 übrig. Ist das Ergebnis 0, ist das Flag Z gesetzt: JZ springt dann zurück zum Lesen. Erst wenn der Sprung ausbleibt, beginnt der Zählteil.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const off = [0, 2, 4, 14].map(v => cpuRun(60, v)), on = [1, 3].map(v => cpuRun(90, v)); const err = off.concat(on).map(r => r.err[0]).find(Boolean); if (err) return [RES(false, 'Das Programm hat Fehler: Zeile ' + err.line + ', ' + err.msg)]; const quiet = off.every(r => r.seq.every(v => v === 0)), cnt = on.every(r => { const ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); return ch.length >= 6 && ch.slice(0, 6).every((v, i) => v === i + 1); }); return [RES(true, 'Programm ist fehlerfrei'), RES(quiet, quiet ? 'Ohne IN0 bleiben alle LEDs aus (auch wenn andere Schalter geschlossen sind)' : 'Solange IN0 offen ist, sollen die LEDs aus bleiben (geprüft mit den Schalterstellungen 0, 2, 4 und 14)'), RES(cnt, cnt ? 'Mit IN0 zählt die Ausgabe 1, 2, 3 … aufwärts' : 'Mit geschlossenem IN0 sollte die Ausgabe 0, 1, 2, 3 … zählen')]; } },
      { id: 'dc8', cat: 'Mini-CPU', title: 'Programmiere: Zahlen umgekehrt ausgeben', level: 3, cpu: { clk: '40Hz', code: '; Lege die Zahlen 3, 5 und 9 ab und gib sie in umgekehrter Reihenfolge aus (9, 5, 3).\n' }, sol: 'start:  LDI 3\n        PUSH\n        LDI 5\n        PUSH\n        LDI 9\n        PUSH\n        POP\n        OUT\n        POP\n        OUT\n        POP\n        OUT\n        HLT\n',
        text: 'Gib die Zahlen 3, 5 und 9 auf den LEDs in umgekehrter Reihenfolge aus: erst 9, dann 5, dann 3. Die Zahlen sollen dazu nacheinander im Programm geladen und im Datenstapel zwischengespeichert werden. Es zählt nur, was nach dem Start auf den LEDs erscheint.',
        hint: 'PUSH legt A oben auf den Stapel, POP holt den obersten Wert wieder in A zurück. Der zuletzt abgelegte Wert kommt als erster wieder heraus. Lade und lege also 3, 5, 9 ab, dann dreimal POP, jeweils gefolgt von OUT.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const r = cpuRun(60), ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); if (r.err.length) return [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)]; const ok = ch.length >= 3 && ch[0] === 9 && ch[1] === 5 && ch[2] === 3, st = hasOp('PUSH') && hasOp('POP'); return [RES(true, 'Programm ist fehlerfrei'), RES(st, st ? 'Das Programm nutzt PUSH und POP' : 'Nutze PUSH zum Ablegen und POP zum Zurückholen'), RES(ok, ok ? 'Die LEDs zeigen nacheinander 9, 5 und 3' : 'Erwartet wird die Folge 9, 5, 3 (gesehen: ' + changes(r.seq).slice(0, 6).join(', ') + ')')]; } },
      { id: 'dc9', cat: 'Mini-CPU', title: 'Programmiere: Überlauf erkennen', level: 3, cpu: { clk: '60Hz', inputs: 4, code: '; Schalter lesen, 8 addieren, bei Überlauf alle LEDs an.\n' }, sol: 'loop:   IN\n        ADDI 8\n        JC ueber      ; C = 1: Summe passt nicht in vier Bit\n        OUT\n        JMP loop\nueber:  OUTI 15\n        JMP loop\n',
        text: 'Die vier Schalter sind eine Zahl von 0 bis 15. Die Mini-CPU soll 8 dazuzählen und das Ergebnis anzeigen. Passt die Summe nicht mehr in vier Bit (größer als 15), soll stattdessen als Warnung jede der vier LEDs leuchten (15).',
        hint: 'ADDI 8 addiert 8 zu A. Entsteht dabei ein Übertrag über das höchste Bit hinaus, setzt die CPU das Carry-Flag C. Mit JC springst du nur dann zu einer Marke, an der du alle LEDs einschaltest, sonst gibst du die Summe mit OUT aus.',
        check() { if (!cpuHas()) return [RES(false, 'Die Mini-CPU fehlt')]; const bad = []; let err = null; [0, 3, 5, 7, 8, 11, 15].forEach(v => { const r = cpuRun(40, v); if (r.err.length) err = r.err[0]; const last = r.seq[r.seq.length - 1], want = v + 8 > 15 ? 15 : v + 8; if (last !== want) bad.push(v + ' → ' + last + ' (soll ' + want + ')'); }); if (err) return [RES(false, 'Das Programm hat Fehler: Zeile ' + err.line + ', ' + err.msg)]; return [RES(true, 'Programm ist fehlerfrei'), RES(!bad.length, !bad.length ? 'Summe und Überlauf-Warnung stimmen bei allen geprüften Eingaben' : 'Falsch bei: ' + bad.slice(0, 3).join('; '))]; } },
    ];
    T3.forEach(t => tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: () => cpuLayout(api, t.cpu), solMake: () => cpuLayout(api, Object.assign({}, t.cpu, { code: t.sol })), check: t.check }));
    /* Prozessor-Modus 8085: Programmieraufgaben und Fehlersuche. Die Prüfung lässt den Baustein im Schaltplan laufen (ein Takt = ein Befehl) und liest die LED-Reihe. */
    const cpuRun85 = (nClocks, setInputs) => {
      const T = 1 / clkHz(), sw = api.sch.parts.filter(p => p.k === 'SPST'), set = {}; if (setInputs != null) sw.forEach((p, i) => { set[p.id] = (setInputs >> i) & 1; });
      const E = api.simEval({ set }), cpu = () => E.c.elems.find(x => x.type === 'IC' && x.key === 'cpu85'), seq = [];
      for (let k = 0; k < nClocks; k++) { E.run(k ? T : 1.3 * T); const c = cpu(); seq.push(c ? c.st.out : -1); }
      return { seq, err: root.CPU85.program().errors, cpu: cpu() };
    };
    const cpuHas85 = () => api.sch.parts.some(is85);
    const has85 = op => root.CPU85.program().prog.some(i => i.op === op);
    const isJcc85 = () => root.CPU85.program().prog.some(i => /^J(NZ|Z|NC|C|PO|PE|P|M)$/.test(i.op));
    const err85 = r => [RES(false, 'Das Programm hat Fehler: Zeile ' + r.err[0].line + ', ' + r.err[0].msg)];
    const hx2 = v => v.toString(16).toUpperCase().padStart(2, '0') + 'H';
    /* Eingaben durchprobieren: fun(v) liefert den Sollwert der LED-Reihe nach dem Einschwingen */
    const sweep85 = (vals, n, fun) => { const bad = []; let err = null; vals.forEach(v => { const r = cpuRun85(n, v); if (r.err.length) err = err || r.err[0]; const last = r.seq[r.seq.length - 1], want = fun(v); if (last !== want) bad.push(hx2(v) + ' → ' + (last < 0 ? '?' : hx2(last)) + ' (soll ' + hx2(want) + ')'); }); return { bad, err }; };
    const swRes = (sw, okTxt, badTxt) => sw.err ? err85({ err: [sw.err] }) : [RES(true, 'Programm ist fehlerfrei'), RES(!sw.bad.length, !sw.bad.length ? okTxt : badTxt + ': ' + sw.bad.slice(0, 3).join('; '))];
    /* PRUEFEN P13: Der 8085-Modus schreibt Zahlen so, wie echte Assembler es tun: 10 ist dezimal, 10H hexadezimal (mit 0 davor, wenn die Zahl mit einem Buchstaben beginnt: 0FBH). In den Mitschriften stehen Hexzahlen ohne Zusatz (IN FB, MVI C, 00). Soll der Modus Zahlen ohne H lieber als Hex lesen, wie im Trainer? Das Lab meldet bei FB ohne H einen Fehler mit Hinweis; bei 10 ohne H liest es still dezimal (genau das ist der Fehler in df7). */
    /* PRUEFEN P14: Ein- und Ausgabebaugruppe haben die Adresse FBH (wie in der Mitschrift 11.3). IN mit einer anderen Adresse liefert 0FFH, OUT tut nichts; das Programmfenster zeigt eine Meldung. Programme beginnen an der Adresse der ersten ORG-Zeile (Beispiele: 2000H wie in der Mitschrift), ohne ORG bei 0000H. Passt das zum Trainer? */
    /* PRUEFEN P15: Flags. INR und DCR lassen CY unverändert, ANA und ANI setzen CY = 0 und AC = 1, ORA und XRA setzen CY = 0 und AC = 0, SUB, SBB, CMP und CPI setzen AC so, wie der 8085 es mit der Zweierkomplement-Addition tut (AC = 1 heißt: kein Übertrag aus Bit 3 geborgt). Ungenutzte Bits des Flag-Bytes (PUSH PSW) sind immer 0. Reicht diese Genauigkeit für den Unterricht, oder soll AC nicht vorkommen? */
    /* PRUEFEN P16: Der Befehlsumfang ist eine Teilmenge (MOV, MVI, LXI, LDA, STA, INX, DCX, INR, DCR, ADD, ADC, SUB, SBB, ANA, XRA, ORA, CMP samt Direktformen, RLC, RRC, RAL, RAR, CMA, STC, CMC, alle Sprünge, CALL, RET, PUSH, POP, IN, OUT, NOP, HLT). Es fehlen unter anderem DAA, DAD, XCHG, LDAX, STAX, LHLD, SHLD, SPHL, XTHL, PCHL, RST und die Interrupt-Befehle. Welche davon braucht der Unterricht noch? */
    /* PRUEFEN P17: Aufgaben dc10 bis dc15 und die Fehlersuchen df6 (DCR ändert CY nicht, Abfrage mit JNC statt JNZ) und df7 (ADI 10 statt 10H) sind eigene Zahlen und Beispiele, an die Mitschrift 11.3 angelehnt. Passen Schwierigkeit und Stufe? Ist df7 fair, solange die Zahlenschreibweise (P13) nicht geklärt ist? */
    const T4 = [
      { id: 'dc10', cat: 'Prozessor 8085', title: '8085: Eingabe lesen und ausgeben', level: 1, cpu: { clk: '60Hz', inputs: 8, code: '; Lies die Schalter (Eingabebaugruppe FBH) und gib sie auf den LEDs aus (Ausgabebaugruppe FBH).\n' }, sol: 'start:  IN 0FBH\n        OUT 0FBH\n        JMP start\n',
        text: 'Die Eingabebaugruppe (acht Schalter IN7 bis IN0) und die Ausgabebaugruppe (acht LEDs Q7 bis Q0) haben beide die Adresse FBH. Schreibe für den Prozessor 8085 ein Programm, das die Schalter immer wieder einliest und genau so auf den LEDs ausgibt. Der Editor steht im Menü „Prozessor 8085: Programm“.',
        hint: 'IN holt das Datenwort der Eingabebaugruppe in den Akku (Register A), OUT schreibt den Akku auf die Ausgabebaugruppe. Hexzahlen schreibst du mit H am Ende, und mit einer 0 davor, wenn sie mit einem Buchstaben beginnen: 0FBH. Ein JMP zurück zur ersten Zeile wiederholt alles.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const sw = sweep85([0x00, 0x01, 0x5A, 0xA5, 0xFF, 0x80], 24, v => v), L = swRes(sw, 'Die LEDs zeigen jede geprüfte Schalterstellung unverändert', 'Die LEDs zeigen nicht die Schalter'); if (!sw.err) L.push(RES(has85('IN') && has85('OUT'), has85('IN') && has85('OUT') ? 'Das Programm nutzt IN und OUT' : 'Nutze IN zum Lesen und OUT zum Ausgeben')); return L; } },
      { id: 'dc11', cat: 'Prozessor 8085', title: '8085: Maske, nur die unteren vier Schalter', level: 2, cpu: { clk: '60Hz', inputs: 8, code: '; Zeige nur die Schalter 3 bis 0 auf den LEDs. Die LEDs 7 bis 4 bleiben immer aus.\n' }, sol: 'start:  IN 0FBH\n        ANI 0FH\n        OUT 0FBH\n        JMP start\n',
        text: 'Die LEDs Q3 bis Q0 sollen die Schalter IN3 bis IN0 zeigen. Die LEDs Q7 bis Q4 müssen immer aus bleiben, egal wie die oberen vier Schalter stehen. Das Programm läuft endlos.',
        hint: 'Mit einer Maske löschst du Bits: ANI verknüpft den Akku bitweise mit einer Zahl (UND). Wo die Maske eine 0 hat, wird das Bit gelöscht, wo sie eine 1 hat, bleibt es erhalten. Schreibe die Maske erst binär auf und mache dann Hex daraus.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const sw = sweep85([0xFF, 0xA5, 0x3C, 0xF0, 0x0F, 0x81, 0x00], 24, v => v & 0x0F); return swRes(sw, 'Nur die unteren vier Schalter wirken, die oberen LEDs bleiben aus', 'Falsch bei'); } },
      { id: 'dc12', cat: 'Prozessor 8085', title: '8085: Abwärtszähler mit Schleife', level: 2, cpu: { clk: '60Hz', inputs: 0, code: '; Zeige 10, 9, 8 ... 1, 0 (dezimal) auf den LEDs und halte dann an.\n' }, sol: 'start:  MVI A,10\nloop:   OUT 0FBH\n        DCR A\n        JNZ loop\n        OUT 0FBH\n        HLT\n',
        text: 'Die LEDs sollen nacheinander die Zahlen 10, 9, 8 … 1 und zuletzt 0 (dezimal, als Dualzahl) zeigen. Danach soll der Prozessor anhalten (HLT). Schreibe die Zählschleife nur einmal; die Zahlen sollen nicht einzeln im Programm stehen.',
        hint: 'Lade den Startwert mit MVI A,10 in den Akku. In der Schleife zeigt OUT den Akku an, DCR A zählt um 1 herunter und setzt das Zero-Flag Z, wenn A gleich 0 wird. JNZ springt zurück, solange Z = 0 ist. Beachte: Wird A zu 0, wird die Schleife verlassen, ohne dass die 0 schon angezeigt wurde.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const r = cpuRun85(100), ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); if (r.err.length) return err85(r); const ok = ch.join(',') === '10,9,8,7,6,5,4,3,2,1,0', loop = isJcc85(); return [RES(true, 'Programm ist fehlerfrei'), RES(loop, loop ? 'Das Programm nutzt eine Schleife mit bedingtem Sprung' : 'Nutze eine Schleife mit einem bedingten Sprung (zum Beispiel JNZ)'), RES(ok, ok ? 'Die LEDs zählen 10 bis 0 herunter' : 'Erwartet wird 10, 9 … 1, 0 (gesehen: ' + ch.slice(0, 13).join(', ') + ')'), RES(!!(r.cpu && r.cpu.st.halt && !r.cpu.st.err), r.cpu && r.cpu.st.halt && !r.cpu.st.err ? 'Der Prozessor hält am Ende an' : 'Am Ende soll der Prozessor mit HLT anhalten')]; } },
      { id: 'dc13', cat: 'Prozessor 8085', title: '8085: Verzweigung nach Flag, kleiner als 100', level: 3, cpu: { clk: '60Hz', inputs: 8, code: '; Zahl an den Schaltern kleiner als 100 (dezimal): alle LEDs aus, sonst alle an.\n' }, sol: 'start:  IN 0FBH\n        CPI 64H\n        JC klein\n        MVI A,0FFH\n        OUT 0FBH\n        JMP start\nklein:  MVI A,00H\n        OUT 0FBH\n        JMP start\n',
        text: 'Lies die Schalter als Zahl von 0 bis 255 (dezimal). Ist die Zahl kleiner als 100, sollen alle LEDs aus sein, ist sie 100 oder größer, sollen alle LEDs an sein (FFH). Das Programm läuft endlos.',
        hint: 'CPI vergleicht den Akku mit einer Zahl, ohne den Akku zu ändern. Ist A kleiner als die Zahl, wird das Carry-Flag CY gesetzt (A − Zahl müsste „borgen“). JC springt, wenn CY = 1 ist. Denke an die Zahl 100 selbst: 100 ist 64H.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const sw = sweep85([0, 1, 50, 99, 100, 101, 200, 255], 30, v => v < 100 ? 0x00 : 0xFF); return swRes(sw, 'Unter 100 bleiben die LEDs aus, ab 100 gehen alle an', 'Falsch bei'); } },
      { id: 'dc14', cat: 'Prozessor 8085', title: '8085: Stapel, Werte umgekehrt ausgeben', level: 3, cpu: { clk: '60Hz', inputs: 0, code: '; Lege 0A1H, 0B2H, 0C3H auf den Stapel und gib sie umgekehrt aus.\n' }, sol: 'start:  LXI SP,20FFH\n        MVI A,0A1H\n        PUSH PSW\n        MVI A,0B2H\n        PUSH PSW\n        MVI A,0C3H\n        PUSH PSW\n        POP PSW\n        OUT 0FBH\n        POP PSW\n        OUT 0FBH\n        POP PSW\n        OUT 0FBH\n        HLT\n',
        text: 'Lege nacheinander die Zahlen 0A1H, 0B2H und 0C3H auf den Stapel (Akku mit MVI A laden, dann mit PUSH PSW ablegen). Hole sie danach zurück und gib sie in umgekehrter Reihenfolge auf den LEDs aus: erst 0C3H, dann 0B2H, dann 0A1H. Richte vorher den Stapel mit LXI SP,20FFH ein.',
        hint: 'PUSH PSW legt den Akku samt Flags oben auf den Stapel, POP PSW holt beides zurück. Was zuletzt abgelegt wurde, kommt als Erstes wieder heraus (LIFO, last in first out). Du brauchst dreimal PUSH PSW, dann dreimal POP PSW, nach jedem POP ein OUT 0FBH.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const r = cpuRun85(60), ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); if (r.err.length) return err85(r); const ok = ch.length >= 3 && ch[0] === 0xC3 && ch[1] === 0xB2 && ch[2] === 0xA1, st = has85('PUSH') && has85('POP'); return [RES(true, 'Programm ist fehlerfrei'), RES(st, st ? 'Das Programm nutzt PUSH und POP' : 'Nutze PUSH zum Ablegen und POP zum Zurückholen'), RES(ok, ok ? 'Die LEDs zeigen nacheinander C3H, B2H und A1H' : 'Erwartet wird die Folge C3H, B2H, A1H (gesehen: ' + changes(r.seq).slice(0, 5).map(hx2).join(', ') + ')')]; } },
      { id: 'dc15', cat: 'Prozessor 8085', title: '8085: Unterprogramm, Wert verdoppeln', level: 3, cpu: { clk: '60Hz', inputs: 8, code: '; Hauptprogramm: Schalter lesen, Unterprogramm mal2 aufrufen (A verdoppeln), Ergebnis ausgeben.\n' }, sol: 'start:  LXI SP,20FFH\nloop:   IN 0FBH\n        CALL mal2\n        OUT 0FBH\n        JMP loop\nmal2:   ADD A\n        RET\n',
        text: 'Das Hauptprogramm liest die Schalter, ruft ein Unterprogramm „mal2“ auf, das den Akku verdoppelt, und gibt das Ergebnis auf den LEDs aus. Ist das Ergebnis größer als 255, bleiben nur die unteren acht Bit. Das Programm läuft endlos. Richte den Stapel mit LXI SP,20FFH ein, damit CALL die Rücksprungadresse ablegen kann.',
        hint: 'Das Unterprogramm steht hinter dem Hauptprogramm (also hinter dem JMP, sonst läuft es mit) und endet mit RET. Zum Verdoppeln addierst du den Akku zu sich selbst: ADD A. Mit CALL mal2 rufst du es auf.',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const sw = sweep85([0, 1, 3, 0x40, 0x7F, 0x80, 0xC8], 40, v => (2 * v) & 255), sub = has85('CALL') && has85('RET'), L = swRes(sw, 'Das Ergebnis ist bei allen geprüften Eingaben verdoppelt', 'Falsch bei'); if (!sw.err) L.push(RES(sub, sub ? 'Das Programm nutzt CALL und RET' : 'Nutze CALL zum Aufrufen und RET zum Zurückspringen')); return L; } },
      { id: 'df6', cat: 'Fehlersuche', title: 'Fehlersuche (8085): der Zähler stimmt nicht', level: 3, cpu: { clk: '60Hz', inputs: 0, code: '; Soll: die LEDs zeigen 5, 4, 3, 2, 1 (als Dualzahl), danach hält der Prozessor an.\n        MVI A,05H\nloop:   OUT 0FBH\n        DCR A\n        JNC loop\n        HLT\n' }, sol: '        MVI A,05H\nloop:   OUT 0FBH\n        DCR A\n        JNZ loop\n        HLT\n',
        text: 'Dieses Programm soll die Zahlen 5, 4, 3, 2 und 1 nacheinander auf den LEDs zeigen und dann anhalten. Das Verhalten stimmt aber nicht. Öffne das Programmfenster („Prozessor 8085: Programm“), lass es laufen oder gehe Schritt für Schritt vor, beobachte Register und Flags, finde den Fehler und korrigiere ihn.',
        hint: 'Schau im Einzelschritt auf die Flags, während DCR A läuft. Beim 8085 lassen INR und DCR das Carry-Flag CY unverändert (anders als ADD und SUB). Welches Flag zeigt an, dass das Ergebnis 0 ist, und welche Abfrage nutzt das Programm stattdessen?',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const r = cpuRun85(60), ch = changes(r.seq).filter((v, i) => !(i === 0 && v === 0)); if (r.err.length) return err85(r); const ok = ch.join(',') === '5,4,3,2,1'; return [RES(true, 'Programm ist fehlerfrei'), RES(ok, ok ? 'Die LEDs zeigen 5, 4, 3, 2, 1' : 'Erwartet wird genau die Folge 5, 4, 3, 2, 1 (gesehen: ' + ch.slice(0, 8).join(', ') + ')'), RES(!!(r.cpu && r.cpu.st.halt && !r.cpu.st.err), r.cpu && r.cpu.st.halt && !r.cpu.st.err ? 'Der Prozessor hält danach an' : 'Danach soll der Prozessor anhalten')]; } },
      { id: 'df7', cat: 'Fehlersuche', title: 'Fehlersuche (8085): die Summe stimmt nicht', level: 2, cpu: { clk: '60Hz', inputs: 8, code: '; Soll: Schalterwert plus 16 auf den LEDs anzeigen (Überlauf über 255 ignorieren).\nloop:   IN 0FBH\n        ADI 10\n        OUT 0FBH\n        JMP loop\n' }, sol: 'loop:   IN 0FBH\n        ADI 10H\n        OUT 0FBH\n        JMP loop\n',
        text: 'Das Programm soll zum Wert der Schalter die Zahl 16 (dezimal) dazuzählen und das Ergebnis auf den LEDs zeigen. Ein Überlauf über 255 wird ignoriert. Die Anzeige stimmt aber nicht. Rechne einige Schalterstellungen nach, finde den Fehler und korrigiere ihn.',
        hint: 'Vergleiche das Ergebnis mit deiner Rechnung: Um wie viel ist es falsch? Prüfe, wie der Assembler die Zahl hinter ADI liest. Eine Zahl ohne Zusatz ist dezimal, mit H am Ende hexadezimal. Welche der beiden meinst du mit „16“?',
        check() { if (!cpuHas85()) return [RES(false, 'Der Prozessor 8085 fehlt')]; const sw = sweep85([0, 1, 5, 0x20, 0xF0, 0xFF], 24, v => (v + 16) & 255); return swRes(sw, 'Die Summe ist bei allen geprüften Eingaben richtig', 'Falsch bei'); } },
    ];
    T4.forEach(t => tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: () => cpu85Layout(api, t.cpu), solMake: () => cpu85Layout(api, Object.assign({}, t.cpu, { code: t.sol })), check: t.check }));
    api.addTasks(tasks);

    if (/[?&]zahl\b/.test(location.search)) setTimeout(() => { const t = setInterval(() => { const gt = document.getElementById('gate'); if (!gt || gt.offsetParent === null) { clearInterval(t); openConv(); } }, 500); }, 1200);
    root.DIGI = { T1, layout: spec => layout(api, spec), SPECS, api, analyse: () => analyse(api), exprs, qm, exprOf, specFromTable, openTruth, openSynth, openConv };
  };
})(typeof window !== 'undefined' ? window : globalThis);
