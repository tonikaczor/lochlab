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
    let PLUSI = null; const plus = () => PLUSI || (PLUSI = root.DIGI_PLUS ? root.DIGI_PLUS(api, root.DIGI) : null);
    root.LAB_EXTRA_MENU = () => [['kv', 'KV-Diagramm', 'Gruppen bilden und die kürzeste Gleichung ablesen'], ['fsm', 'Zustandsautomat', 'Zustände und Übergänge, Simulation, Schaltung bauen'], ['gdw', 'Fehler-Würfel (Gatter)', 'Ein Gatter wird vertauscht, finde es'], ['wt', 'Wahrheitstabelle', 'Alle Eingangskombinationen prüfen, Gleichung herleiten'], ['synth', 'Schaltung aus Tabelle', 'Wahrheitstabelle eintragen, Schaltung bauen lassen'], ['zahl', 'Zahlenumrechner', 'Binär, Dezimal, Hex, BCD, Zweierkomplement, Üben'], ['cpu', 'Mini-CPU: Programm', 'Assembler-Editor, Register, Einzelschritt']];
    root.LAB_EXTRA_ACT = m => { if (m === 'kv' && plus()) { plus().openKV(); return true; } if (m === 'fsm' && plus()) { plus().openFSM(); return true; } if (m === 'gdw' && plus()) { plus().rollGate(); return true; } if (m === 'wt') { openTruth(); return true; } if (m === 'synth') { openSynth(); return true; } if (m === 'zahl') { openConv(); return true; } if (m === 'cpu') { if (root.CPU4) root.CPU4.openEditor(api); return true; } return false; };
    root.LAB_EXTRA_CARD = () => '<div class="card"><h4>Digitaltechnik</h4><div class="row2"><button class="btn" data-a="dwt">Wahrheitstabelle</button><button class="btn" data-a="dsy">Aus Tabelle bauen</button></div><div class="row2"><button class="btn" data-a="dkv">KV-Diagramm</button><button class="btn" data-a="dfs">Zustandsautomat</button></div><div class="row2"><button class="btn" data-a="dzn">Zahlenumrechner</button>' + (api.sch.parts.some(p => p.k === 'CPU' || (p.k === 'ICX' && /cpu4/i.test(p.v))) ? '<button class="btn" data-a="dcp">Mini-CPU</button>' : '') + '</div></div>' + (plus() ? plus().cardHtml() : '');
    root.LAB_EXTRA_CLICK = (a) => { if (a === 'dkv' && plus()) { plus().openKV(); return true; } if (a === 'dfs' && plus()) { plus().openFSM(); return true; } if (a === 'gdw' && plus()) { plus().rollGate(); return true; } if (a === 'gdr' && plus()) { plus().reportGate(); return true; } if (a === 'gdv' && plus()) { plus().reveal(); return true; } if (a === 'dwt') { openTruth(); return true; } if (a === 'dsy') { openSynth(); return true; } if (a === 'dzn') { openConv(); return true; } if (a === 'dcp') { if (root.CPU4) root.CPU4.openEditor(api); return true; } return false; };
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
        text: 'Der Binärzähler soll aufwärts zählen, aber die Folge stimmt nicht. Finde die falsche Verbindung zwischen den ersten beiden Flipflops und korrigiere sie.', hint: 'Jedes Flipflop muss den Q̄-Ausgang (mit dem Kreis) seines Vorgängers als Takt bekommen, nicht den Q-Ausgang.',
        check() {
          const leds = ledsOf(); if (leds.length < 4) return [RES(false, 'Vier LEDs werden erwartet')];
          const s = clocked(9, valOf), want = [1, 2, 3, 4, 5, 6, 7, 8, 9], ok = s.join() === want.join();
          return [RES(ok, ok ? 'Der Zähler zählt aufwärts' : 'Erwartet 1, 2, 3 … 9, die Schaltung liefert ' + s.join(', '))];
        } },
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
        text: 'Y soll genau dann 1 sein, wenn die Zahl ABCD die Werte 0, 3, 8 oder 11 hat (Dezimal). Trage die Einsen in das KV-Diagramm ein (Menü „KV-Diagramm“), lies die kürzeste Gleichung ab und baue die Schaltung. Vier Schalter A bis D und eine LED.', hint: 'Die Felder 0, 3, 8 und 11 bilden eine Gruppe aus vier Feldern über den Rand: B = 0 und C = D. Die Gleichung ist Y = ¬B · (¬C · ¬D + C · D). „Schaltung bauen“ im KV-Werkzeug erledigt den Bau.',
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
    ];
    T3.forEach(t => tasks.push({ id: t.id, cat: t.cat, title: t.title, level: t.level, text: t.text, hint: t.hint, start: () => cpuLayout(api, t.cpu), solMake: () => cpuLayout(api, Object.assign({}, t.cpu, { code: t.sol })), check: t.check }));
    api.addTasks(tasks);

    if (/[?&]zahl\b/.test(location.search)) setTimeout(() => { const t = setInterval(() => { const gt = document.getElementById('gate'); if (!gt || gt.offsetParent === null) { clearInterval(t); openConv(); } }, 500); }, 1200);
    root.DIGI = { layout: spec => layout(api, spec), SPECS, api, analyse: () => analyse(api), exprs, qm, exprOf, specFromTable, openTruth, openSynth, openConv };
  };
})(typeof window !== 'undefined' ? window : globalThis);
