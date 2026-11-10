'use strict';
/* Tonfunk DigiLab: Bilder zur Digitaltechnik (window.DIGI_VIZ bzw. module.exports). Reine Anzeige, inline-SVG, keine Bibliothek, offline.
   - gateSvg(art, stil, a, b):  Gatter-Schaltzeichen einheitlich im Kästchen-Stil (DIN EN 60617: &, ≥1, 1, =1, Kreis = Negation) oder im Formstil (USA),
                                Leitungen zeigen 0 und 1 (Linienart und Beschriftung, nicht nur Farbe)
   - gateTable(art, a, b):      Wahrheitstabelle mit hervorgehobener aktueller Zeile
   - ffSim / timingSvg:         Flipflops (D, JK, T mit steigender Taktflanke, RS-Latch aus NOR) als Zeitdiagramm; die Eingänge stellt die Person selbst
   - counterSim / counterSvg:   Zählerstände und Zeitdiagramm eines n-Bit-Dualzählers (aufwärts oder abwärts)
   - sevenSvg(ziffer):          7-Segment-Anzeige mit Segmentnamen a bis g und Code
   - cpu85Svg / cpu4Svg:        Register- und Busbild für die Prozessor-Editoren (cpu85.js, cpu4.js), geänderte Register sind umrandet
   - open():                    Fenster "Bilder zur Digitaltechnik" mit fünf Reitern (Aufruf aus der Seitenkarte in digi.js; nur ohne offene Aufgabe)
   Nichts hier berechnet Aufgabenlösungen. Farben nur über die CSS-Variablen der Seite; keine Animation. */
(function (root) {
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (fin(v) ? String(Math.round(v * 10) / 10) : '0');
  const hex = (v, n) => (fin(v) ? (v >>> 0).toString(16).toUpperCase().padStart(n, '0') : '0'.repeat(n));
  const svg = (w, h, body, label, cls) => `<svg class="dvs${cls ? ' ' + cls : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label || '')}" focusable="false">${body}</svg>`;

  const CSS = `.dv{--dv-hi:#4ea8ff;--dv-seg:#ff5a4d}
@media(prefers-color-scheme:light){:root:not([data-theme=dark]) .dv{--dv-hi:#0a5bd0;--dv-seg:#d62d20}}
:root[data-theme=light] .dv{--dv-hi:#0a5bd0;--dv-seg:#d62d20}
.dv .dvs{display:block;width:100%;max-width:420px;height:auto;margin:6px auto}
.dv svg text{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;fill:var(--fg,#e8ecf0);font-size:11px}
.dv svg .m{fill:var(--mute,#8d99a6)}.dv svg .b{font-weight:700}
.dv svg .w0{stroke:var(--mute,#8d99a6);stroke-width:2;fill:none;stroke-dasharray:5 3}.dv svg .w1{stroke:var(--dv-hi);stroke-width:3;fill:none}
.dv svg .sy{stroke:var(--fg,#e8ecf0);stroke-width:2;fill:var(--panel,#222830)}.dv svg .ln{stroke:var(--mute,#8d99a6);stroke-width:1.2;fill:none}
.dv svg .gd{stroke:var(--line,#38424d);stroke-width:1;stroke-dasharray:2 4;fill:none}
.dv svg .wv{stroke:var(--fg,#e8ecf0);stroke-width:2;fill:none;stroke-linejoin:miter}.dv svg .wq{stroke:var(--dv-hi);stroke-width:2.4;fill:none}
.dv svg .bx{fill:var(--panel,#222830);stroke:var(--line,#38424d);stroke-width:1.4}.dv svg .bxc{fill:var(--panel,#222830);stroke:var(--dv-hi);stroke-width:2.6}
.dv svg .on{fill:var(--dv-seg)}.dv svg .off{fill:var(--line,#38424d)}.dv svg .hit{fill:var(--dv-hi)}
.dv svg .bus{stroke:var(--mute,#8d99a6);stroke-width:5;stroke-linecap:round;fill:none;opacity:.55}.dv svg .hat{stroke:var(--mute,#8d99a6);stroke-width:1;fill:none}
.dv .dvs.sm{max-width:190px}.dv .tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 8px}.dv .tabs button,.dv .chs button,.dv .cell{min-height:44px;min-width:44px;padding:0 12px;border-radius:12px;background:var(--panel,#222830);border:1px solid var(--line,#38424d);color:var(--fg,#e8ecf0);font-weight:600}
.dv .tabs button[aria-pressed=true],.dv .chs button[aria-pressed=true],.dv .cell[aria-pressed=true]{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.dv .chs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}.dv .cells{display:flex;gap:4px;flex-wrap:wrap;margin:4px 0}.dv .cell{min-width:44px;padding:0}
.dv .cells .lab{width:34px;align-self:center;color:var(--mute,#8d99a6);font-size:12px}
.dv table.tt{border-collapse:collapse;margin:6px auto;font-variant-numeric:tabular-nums}.dv table.tt th,.dv table.tt td{padding:4px 12px;text-align:center;border-bottom:1px solid var(--line,#38424d)}
.dv table.tt th{color:var(--mute,#8d99a6);font-size:12px}.dv table.tt tr.now td{background:var(--accent-bg,#1a6fd4);color:#fff;font-weight:700}
.dv .note{margin:6px 0;font-size:12.5px;color:var(--mute,#8d99a6);line-height:1.4}.dv .eq{font-weight:700;text-align:center;margin:4px 0}`;

  /* ================= Gatter ================= */
  const GATES = {
    AND: { n: 'UND (AND)', box: '&', ins: 2, neg: false, f: (a, b) => a & b, eq: 'Y = A · B' },
    OR: { n: 'ODER (OR)', box: '≥1', ins: 2, neg: false, f: (a, b) => a | b, eq: 'Y = A + B' },
    NOT: { n: 'NICHT (NOT)', box: '1', ins: 1, neg: true, f: a => a ^ 1, eq: 'Y = Ā' },
    NAND: { n: 'NAND', box: '&', ins: 2, neg: true, f: (a, b) => (a & b) ^ 1, eq: 'Y = A · B negiert' },
    NOR: { n: 'NOR', box: '≥1', ins: 2, neg: true, f: (a, b) => (a | b) ^ 1, eq: 'Y = A + B negiert' },
    XOR: { n: 'XOR (Antivalenz)', box: '=1', ins: 2, neg: false, f: (a, b) => a ^ b, eq: 'Y = A ⊕ B' },
    XNOR: { n: 'XNOR (Äquivalenz)', box: '=1', ins: 2, neg: true, f: (a, b) => (a ^ b) ^ 1, eq: 'Y = A ⊕ B negiert' }
  };
  const GORDER = ['AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR', 'XNOR'];
  const bit = v => (v ? 1 : 0);
  /* Formstil: Pfade im Feld 0..60 x 0..44 (ohne Negationskreis) */
  function shapePath(art) {
    if (art === 'AND' || art === 'NAND') return 'M0 0 H30 A22 22 0 0 1 30 44 H0 Z';
    if (art === 'OR' || art === 'NOR') return 'M0 0 Q26 0 58 22 Q26 44 0 44 Q14 22 0 0 Z';
    if (art === 'XOR' || art === 'XNOR') return 'M6 0 Q32 0 58 22 Q32 44 6 44 Q20 22 6 0 Z M-4 0 Q10 22 -4 44';
    return 'M0 0 L48 22 L0 44 Z';   // NOT
  }
  function gateSvg(art, style, a, b) {
    const g = GATES[art]; if (!g) return '';
    a = bit(a); b = bit(b); const y = g.f(a, b), W = 300, H = 112, bx = 100, by = 34, bw = 70, bh = 44, form = style === 'form';
    let s = '';
    const wire = (x1, y1, x2, y2, v) => `<path class="${v ? 'w1' : 'w0'}" d="M${x1} ${y1} L${x2} ${y2}"/>`;
    const yA = g.ins === 2 ? by + 11 : by + 22, yB = by + 33;
    s += wire(30, yA, bx - (form && g.ins === 2 && (art === 'OR' || art === 'NOR' || art === 'XOR' || art === 'XNOR') ? -6 : 0), yA, a);
    if (g.ins === 2) s += wire(30, yB, bx - (form && (art === 'OR' || art === 'NOR' || art === 'XOR' || art === 'XNOR') ? -6 : 0), yB, b);
    const outX = bx + bw + (g.neg ? 12 : 0);
    s += wire(outX, by + 22, 262, by + 22, y);
    if (form) {
      s += `<g transform="translate(${bx} ${by})"><path class="sy" d="${shapePath(art)}" style="fill:var(--panel,#222830)"/></g>`;
      const tipX = art === 'NOT' ? bx + 48 : bx + 58;
      if (g.neg) s += `<circle class="sy" cx="${tipX + 6}" cy="${by + 22}" r="5"/>`;
      if (art === 'NOT') s += '';
    } else {
      s += `<rect class="sy" x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="3"/><text class="b" x="${bx + bw / 2}" y="${by + 28}" text-anchor="middle" style="font-size:20px">${esc(g.box)}</text>`;
      if (g.neg) s += `<circle class="sy" cx="${bx + bw + 6}" cy="${by + 22}" r="5"/>`;
    }
    s += `<text class="b" x="22" y="${yA + 4}" text-anchor="end">A</text>${g.ins === 2 ? `<text class="b" x="22" y="${yB + 4}" text-anchor="end">B</text>` : ''}<text class="b" x="270" y="${by + 26}">Y</text>`;
    s += `<text class="${a ? 'b' : 'm'}" x="36" y="${yA - 5}" style="font-size:11px">${a}</text>${g.ins === 2 ? `<text class="${b ? 'b' : 'm'}" x="36" y="${yB - 5}" style="font-size:11px">${b}</text>` : ''}<text class="${y ? 'b' : 'm'}" x="250" y="${by + 14}" text-anchor="end">${y}</text>`;
    s += `<text class="m" x="150" y="${H - 8}" text-anchor="middle">${esc(g.n)} · ${esc(g.eq)} · ${form ? 'Formzeichen (USA)' : 'Kästchen (DIN EN 60617)'}</text>`;
    return svg(W, H, s, g.n + ' mit A=' + a + (g.ins === 2 ? ', B=' + b : '') + ', Y=' + y);
  }
  function gateTable(art, a, b) {
    const g = GATES[art]; if (!g) return '';
    const rows = g.ins === 2 ? [[0, 0], [0, 1], [1, 0], [1, 1]] : [[0], [1]];
    return `<table class="tt"><thead><tr><th>A</th>${g.ins === 2 ? '<th>B</th>' : ''}<th>Y</th></tr></thead><tbody>${rows.map(r => `<tr${(r[0] === bit(a) && (g.ins === 1 || r[1] === bit(b))) ? ' class="now"' : ''}><td>${r[0]}</td>${g.ins === 2 ? `<td>${r[1]}</td>` : ''}<td>${g.f(r[0], r[1])}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ================= Flipflops ================= */
  /* Eingaben je Takt: D: d[], T: t[], JK: j[] k[], RS: s[] r[]. Steigende Taktflanke in der Mitte jedes Taktes (die Eingänge liegen davor an).
     Rückgabe: q[] = Zustand nach der Flanke (RS: nach dem Pegel), q0 = Zustand vorher; null = unbestimmt (RS: beide 1 gewesen, danach beide 0). */
  function ffSim(type, inp, n) {
    const q = [], qBefore = []; let cur = 0;
    for (let k = 0; k < n; k++) {
      qBefore.push(cur);
      if (type === 'D') cur = bit(inp.d[k]);
      else if (type === 'T') cur = cur === null ? null : (bit(inp.t[k]) ? cur ^ 1 : cur);
      else if (type === 'JK') { const j = bit(inp.j[k]), kk = bit(inp.k[k]); if (cur !== null) cur = j && kk ? cur ^ 1 : j ? 1 : kk ? 0 : cur; else cur = j && !kk ? 1 : kk && !j ? 0 : null; }
      else if (type === 'RS') { const s = bit(inp.s[k]), r = bit(inp.r[k]); if (s && r) cur = 'x'; else if (s) cur = 1; else if (r) cur = 0; else if (cur === 'x') cur = null; }
      q.push(cur);
    }
    return { q, qBefore };
  }
  /* Eine Zeile des Zeitdiagramms: samples = Werte je halbem Takt (0, 1, null = unbestimmt, 'x' = unzulässig) */
  function waveRow(name, samples, y, cw, x0, cls, opt) {
    const hh = 22, hi = y, lo = y + hh; let d = '', s = '';
    const lv = v => (v === 1 ? hi : lo);
    let prev = null;
    samples.forEach((v, i) => {
      const xa = x0 + i * cw, xb = xa + cw;
      if (v === null || v === 'x') {
        s += `<rect x="${f1(xa)}" y="${hi}" width="${f1(cw)}" height="${hh}" fill="none" class="hat"/><line class="hat" x1="${f1(xa)}" y1="${hi}" x2="${f1(xb)}" y2="${lo}"/><line class="hat" x1="${f1(xa)}" y1="${lo}" x2="${f1(xb)}" y2="${hi}"/>`;
        prev = null; return;
      }
      if (prev === null || prev === undefined) d += `M${f1(xa)} ${lv(v)} `; else if (prev !== v) d += `L${f1(xa)} ${lv(prev)} L${f1(xa)} ${lv(v)} `;
      d += `L${f1(xb)} ${lv(v)} `; prev = v;
    });
    s += `<path class="${cls || 'wv'}" d="${d}"/><text class="b" x="${x0 - 8}" y="${y + 15}" text-anchor="end">${esc(name)}</text>`;
    return s;
  }
  function timingSvg(rows, n, opt) {
    opt = opt || {}; const x0 = 52, cw = Math.min(26, (340 - x0 - 8) / (2 * n)), rowH = 34, top = 16, H = top + rows.length * rowH + 22, W = x0 + 2 * n * cw + 8;
    let s = '';
    for (let k = 0; k < n; k++) { const xe = x0 + (2 * k + 1) * cw; s += `<line class="gd" x1="${f1(xe)}" y1="${top - 6}" x2="${f1(xe)}" y2="${H - 18}"/>`; s += `<text class="m" x="${f1(x0 + 2 * k * cw + cw)}" y="${H - 5}" text-anchor="middle" style="font-size:9.5px">${k + 1}</text>`; }
    rows.forEach((r, i) => { s += waveRow(r.name, r.samples, top + i * rowH, cw, x0, r.q ? 'wq' : 'wv'); });
    if (opt.labels) opt.labels.forEach((t, k) => { s += `<text class="b" x="${f1(x0 + (2 * k + 1) * cw + cw)}" y="${top - 5}" text-anchor="middle" style="font-size:10px">${esc(t)}</text>`; });
    return svg(W, H, s, opt.label || 'Zeitdiagramm');
  }
  const clkSamples = n => { const a = []; for (let k = 0; k < n; k++) a.push(0, 1); return a; };
  const dbl = a => { const o = []; a.forEach(v => { o.push(v, v); }); return o; };
  function ffRows(type, inp, n) {
    const r = ffSim(type, inp, n), qs = [], qn = [];
    r.q.forEach((v, k) => { const b = r.qBefore[k]; qs.push(b, v); });
    qs.forEach(v => qn.push(v === 0 ? 1 : v === 1 ? 0 : v));
    const rows = [];
    if (type !== 'RS') rows.push({ name: 'CLK', samples: clkSamples(n) });
    if (type === 'D') rows.push({ name: 'D', samples: dbl(inp.d.slice(0, n)) });
    if (type === 'T') rows.push({ name: 'T', samples: dbl(inp.t.slice(0, n)) });
    if (type === 'JK') { rows.push({ name: 'J', samples: dbl(inp.j.slice(0, n)) }); rows.push({ name: 'K', samples: dbl(inp.k.slice(0, n)) }); }
    if (type === 'RS') {
      rows.push({ name: 'S', samples: dbl(inp.s.slice(0, n)) }); rows.push({ name: 'R', samples: dbl(inp.r.slice(0, n)) });
      // Latch: reagiert auf den Pegel, nicht auf die Flanke: Zustand gilt ab Periodenbeginn
      const lq = []; let cur = 0; for (let k = 0; k < n; k++) { const s = bit(inp.s[k]), rr = bit(inp.r[k]); if (s && rr) cur = 'x'; else if (s) cur = 1; else if (rr) cur = 0; else if (cur === 'x') cur = null; lq.push(cur, cur); }
      rows.push({ name: 'Q', samples: lq.map(v => v), q: 1 }); rows.push({ name: '¬Q', samples: lq.map(v => (v === 0 ? 1 : v === 1 ? 0 : v)) });
      return rows;
    }
    rows.push({ name: 'Q', samples: qs, q: 1 }); rows.push({ name: '¬Q', samples: qn });
    return rows;
  }
  /* Symbol des Flipflops */
  function ffSymbol(type) {
    const ins = { D: ['D', '>'], T: ['T', '>'], JK: ['J', '>', 'K'], RS: ['S', '', 'R'] }[type], nm = { D: 'D-Flipflop', T: 'T-Flipflop', JK: 'JK-Flipflop', RS: 'RS-Latch (NOR)' }[type];
    const x = 58, y = 10, w = 70, h = 70; let s = `<rect class="sy" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>`;
    const ys = ins.length === 2 ? [y + 18, y + 52] : [y + 14, y + 35, y + 56];
    ins.forEach((t, i) => {
      s += `<line class="ln" x1="${x - 22}" y1="${ys[i]}" x2="${x}" y2="${ys[i]}"/>`;
      if (t === '>') s += `<path class="ln" d="M${x} ${ys[i] - 7} L${x + 10} ${ys[i]} L${x} ${ys[i] + 7}"/><text class="m" x="${x - 24}" y="${ys[i] + 4}" text-anchor="end">CLK</text>`;
      else if (t) s += `<text class="b" x="${x + 8}" y="${ys[i] + 4}">${t}</text>`;
    });
    s += `<line class="ln" x1="${x + w}" y1="${y + 18}" x2="${x + w + 22}" y2="${y + 18}"/><text class="b" x="${x + w - 8}" y="${y + 22}" text-anchor="end">Q</text><line class="ln" x1="${x + w}" y1="${y + 52}" x2="${x + w + 22}" y2="${y + 52}"/><text class="b" x="${x + w - 8}" y="${y + 56}" text-anchor="end">Q̄</text>`;
    s += `<text class="m" x="${x + w / 2}" y="${y + h + 16}" text-anchor="middle">${nm}</text>`;
    return svg(200, 108, s, nm + ' Schaltzeichen');
  }
  /* Kennlinientabelle mit der Zeile des gewählten Taktes hervorgehoben */
  function ffTable(type, inp, k) {
    const cl = (x, hl) => (hl ? ' class="now"' : '');
    if (type === 'D') { const d = bit(inp.d[k]); return `<table class="tt"><thead><tr><th>D</th><th>Q danach</th></tr></thead><tbody>${[0, 1].map(v => `<tr${cl(0, d === v)}><td>${v}</td><td>${v}</td></tr>`).join('')}</tbody></table>`; }
    if (type === 'T') { const t = bit(inp.t[k]); return `<table class="tt"><thead><tr><th>T</th><th>Q danach</th></tr></thead><tbody><tr${cl(0, t === 0)}><td>0</td><td>unverändert</td></tr><tr${cl(0, t === 1)}><td>1</td><td>kippt um</td></tr></tbody></table>`; }
    if (type === 'JK') { const j = bit(inp.j[k]), kk = bit(inp.k[k]); const R = [[0, 0, 'unverändert'], [0, 1, '0 (rücksetzen)'], [1, 0, '1 (setzen)'], [1, 1, 'kippt um']]; return `<table class="tt"><thead><tr><th>J</th><th>K</th><th>Q danach</th></tr></thead><tbody>${R.map(r => `<tr${cl(0, r[0] === j && r[1] === kk)}><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table>`; }
    const s = bit(inp.s[k]), r = bit(inp.r[k]); const R = [[0, 0, 'unverändert (speichert)'], [1, 0, 'Q = 1 (setzen)'], [0, 1, 'Q = 0 (rücksetzen)'], [1, 1, 'unzulässig: Q und Q̄ beide 0']];
    return `<table class="tt"><thead><tr><th>S</th><th>R</th><th>Q</th></tr></thead><tbody>${R.map(x => `<tr${cl(0, x[0] === s && x[1] === r)}><td>${x[0]}</td><td>${x[1]}</td><td>${x[2]}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ================= Zähler ================= */
  function counterSim(bits, n, down) {
    const mod = Math.pow(2, bits), vals = []; let v = 0;
    for (let k = 0; k < n; k++) { v = down ? (v - 1 + mod) % mod : (v + 1) % mod; vals.push(v); }
    return vals;
  }
  function counterSvg(bits, n, down) {
    const vals = counterSim(bits, n, down), rows = [{ name: 'CLK', samples: clkSamples(n) }];
    for (let i = 0; i < bits; i++) {
      const s = []; let prev = down ? (Math.pow(2, bits) - 1) & 0 : 0; prev = 0;
      vals.forEach(v => { s.push((prev >> i) & 1, (v >> i) & 1); prev = v; });
      rows.push({ name: 'Q' + i, samples: s, q: i === 0 });
    }
    return timingSvg(rows, n, { labels: vals.map(String), label: bits + '-Bit-Zähler ' + (down ? 'abwärts' : 'aufwärts') + ': Zeitdiagramm' });
  }

  /* ================= 7-Segment ================= */
  const SEG7 = ['1111110', '0110000', '1101101', '1111001', '0110011', '1011011', '1011111', '1110000', '1111111', '1111011'];   // abcdefg wie simics.js
  function sevenSvg(digit) {
    const d = Math.max(0, Math.min(9, Math.floor(+digit || 0))), code = SEG7[d], W = 200, H = 186;
    const P = { a: '40,16 52,8 128,8 140,16 128,24 52,24', b: '144,20 152,28 152,70 144,78 134,70 134,28', c: '144,84 152,92 152,134 144,142 134,134 134,92', d: '40,138 52,130 128,130 140,138 128,146 52,146', e: '36,84 46,92 46,134 36,142 28,134 28,92', f: '36,20 46,28 46,70 36,78 28,70 28,28', g: '40,80 52,72 128,72 140,80 128,88 52,88' };
    const TX = { a: [90, 0], b: [170, 52], c: [170, 116], d: [90, 163], e: [10, 116], f: [10, 52], g: [10, 83] };
    let s = '<g transform="translate(14 12)">';
    'abcdefg'.split('').forEach((k, i) => { s += `<polygon class="${code[i] === '1' ? 'on' : 'off'}" points="${P[k]}"/>`; });
    'abcdefg'.split('').forEach((k, i) => { const t = TX[k]; s += `<text class="${code[i] === '1' ? 'b' : 'm'}" x="${t[0]}" y="${t[1] + 4}" text-anchor="middle">${k}</text>`; });
    s += '</g>';
    return svg(W, H, s, 'Siebensegmentanzeige zeigt ' + d + ', Segmente ' + 'abcdefg'.split('').filter((k, i) => code[i] === '1').join(''), 'sm');
  }
  const segCode = d => SEG7[Math.max(0, Math.min(9, Math.floor(+d || 0)))];

  /* ================= Prozessor: Register- und Busbild ================= */
  const box = (x, y, w, h, name, val, ch) => `<rect class="${ch ? 'bxc' : 'bx'}" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/><text class="m" x="${x + 5}" y="${y + 11}" style="font-size:9.5px">${esc(name)}</text><text class="b" x="${x + w / 2}" y="${y + h - 6}" text-anchor="middle" style="font-size:13px;font-family:ui-monospace,Consolas,monospace">${esc(val)}</text>`;
  function cpu85Svg(r, prev) {
    r = r || {}; prev = prev || {}; const ch = k => prev[k] != null && prev[k] !== r[k];
    let s = `<text class="b" x="170" y="12" text-anchor="middle">Prozessor 8085: Register und Busse</text>`;
    // Busse
    s += `<line class="bus" x1="14" y1="112" x2="326" y2="112"/><text class="m" x="326" y="106" text-anchor="end" style="font-size:9.5px">Datenbus 8 Bit</text>`;
    s += `<line class="bus" x1="14" y1="196" x2="326" y2="196"/><text class="m" x="326" y="190" text-anchor="end" style="font-size:9.5px">Adressbus 16 Bit</text>`;
    // Akku und ALU
    s += box(14, 24, 52, 32, 'A (Akku)', hex(r.A, 2) + 'H', ch('A'));
    s += `<path class="bx" d="M80 24 L132 24 L124 56 L88 56 Z"/><text class="b" x="106" y="44" text-anchor="middle">ALU</text><line class="ln" x1="66" y1="40" x2="80" y2="40"/>`;
    s += `<line class="hat" x1="40" y1="56" x2="40" y2="112"/><line class="hat" x1="106" y1="56" x2="106" y2="112"/>`;
    // Flags
    ['S', 'Z', 'AC', 'P', 'CY'].forEach((k, i) => { const on = r[k] ? 1 : 0, x = 146 + i * 36; s += `<rect class="${ch(k) ? 'bxc' : 'bx'}" x="${x}" y="24" width="32" height="32" rx="4" ${on ? 'style="fill:var(--accent-bg,#1a6fd4)"' : ''}/><text class="m" x="${x + 16}" y="35" text-anchor="middle" style="font-size:9.5px;${on ? 'fill:#fff' : ''}">${k}</text><text class="b" x="${x + 16}" y="50" text-anchor="middle" style="font-size:13px;${on ? 'fill:#fff' : ''}">${on}</text>`; });
    s += `<text class="m" x="236" y="68" text-anchor="middle" style="font-size:9.5px">Flags (Zustandsbits)</text>`;
    // Registerpaare
    [['B', 'C'], ['D', 'E'], ['H', 'L']].forEach((p, i) => { const x = 14 + i * 108; s += box(x, 78 - 0, 46, 28, p[0], hex(r[p[0]], 2), ch(p[0])) + box(x + 50, 78, 46, 28, p[1], hex(r[p[1]], 2), ch(p[1])); s += `<line class="hat" x1="${x + 23}" y1="106" x2="${x + 23}" y2="112"/><line class="hat" x1="${x + 73}" y1="106" x2="${x + 73}" y2="112"/>`; });
    // Ein- und Ausgabe
    s += box(14, 126, 96, 30, 'Eingabe FBH (Schalter)', '·', false).replace('>·<', '>Port FBH<');
    s += box(120, 126, 96, 30, 'Ausgabe FBH (LEDs)', 'Port FBH', false);
    s += `<line class="hat" x1="62" y1="126" x2="62" y2="112"/><line class="hat" x1="168" y1="126" x2="168" y2="112"/>`;
    // PC und SP am Adressbus
    s += box(14, 160, 90, 28, 'PC (Befehlszähler)', hex(r.PC, 4) + 'H', ch('PC')) + box(112, 160, 90, 28, 'SP (Stapelzeiger)', hex(r.SP, 4) + 'H', ch('SP'));
    s += `<line class="hat" x1="59" y1="188" x2="59" y2="196"/><line class="hat" x1="157" y1="188" x2="157" y2="196"/>`;
    s += `<text class="m" x="256" y="168" style="font-size:9.5px">Speicher 64 KB</text><rect class="bx" x="212" y="172" width="114" height="16" rx="3"/><line class="hat" x1="268" y1="188" x2="268" y2="196"/><text class="m" x="269" y="184" text-anchor="middle" style="font-size:9.5px">0000H … FFFFH</text>`;
    s += `<text class="m" x="170" y="214" text-anchor="middle" style="font-size:10px">Umrandet: Register hat sich beim letzten Schritt geändert</text>`;
    return svg(340, 222, s, 'Registerbild des Prozessors 8085');
  }
  function cpu4Svg(st, prev) {
    st = st || {}; prev = prev || {}; const ch = k => prev[k] != null && prev[k] !== st[k], b4 = v => ((v >>> 0) & 15).toString(2).padStart(4, '0');
    let s = `<text class="b" x="170" y="12" text-anchor="middle">Mini-CPU TF-4: Register und Bus</text><line class="bus" x1="14" y1="96" x2="326" y2="96"/><text class="m" x="326" y="90" text-anchor="end" style="font-size:9.5px">Datenbus 4 Bit</text>`;
    s += box(14, 24, 64, 32, 'A (Akku)', b4(st.a), ch('a')) + box(110, 24, 64, 32, 'B', b4(st.b), ch('b'));
    s += `<path class="bx" d="M188 24 L246 24 L238 56 L196 56 Z"/><text class="b" x="217" y="44" text-anchor="middle">ALU</text><line class="ln" x1="78" y1="40" x2="110" y2="40"/><line class="ln" x1="174" y1="40" x2="188" y2="40"/>`;
    s += `<line class="hat" x1="46" y1="56" x2="46" y2="96"/><line class="hat" x1="142" y1="56" x2="142" y2="96"/><line class="hat" x1="217" y1="56" x2="217" y2="96"/>`;
    ['Z', 'C'].forEach((k, i) => { const on = (k === 'Z' ? st.z : st.c) ? 1 : 0, x = 262 + i * 34, key = k.toLowerCase(); s += `<rect class="${ch(key) ? 'bxc' : 'bx'}" x="${x}" y="24" width="30" height="32" rx="4" ${on ? 'style="fill:var(--accent-bg,#1a6fd4)"' : ''}/><text class="m" x="${x + 15}" y="35" text-anchor="middle" style="font-size:9.5px;${on ? 'fill:#fff' : ''}">${k}</text><text class="b" x="${x + 15}" y="50" text-anchor="middle" style="font-size:13px;${on ? 'fill:#fff' : ''}">${on}</text>`; });
    s += box(14, 110, 70, 32, 'IN (Pins)', b4(st.inp), ch('inp')) + box(96, 110, 70, 32, 'OUT (LEDs)', b4(st.out), ch('out')) + box(178, 110, 62, 32, 'PC (6 Bit)', String(st.pc == null ? 0 : st.pc), ch('pc'));
    s += `<line class="hat" x1="49" y1="110" x2="49" y2="96"/><line class="hat" x1="131" y1="110" x2="131" y2="96"/>`;
    s += `<text class="m" x="14" y="162" style="font-size:9.5px">RAM: 16 Halbbytes (Adresse 0 bis 15)</text>`;
    const ram = st.ram || []; for (let i = 0; i < 16; i++) { const x = 14 + (i % 16) * 19.5; s += `<rect class="bx" x="${f1(x)}" y="168" width="18" height="22" rx="2"/><text class="m" x="${f1(x + 9)}" y="178" text-anchor="middle" style="font-size:8px">${i}</text><text class="b" x="${f1(x + 9)}" y="187" text-anchor="middle" style="font-size:10px">${hex(ram[i] || 0, 1)}</text>`; }
    s += `<text class="m" x="170" y="206" text-anchor="middle" style="font-size:10px">Umrandet: Register hat sich beim letzten Schritt geändert</text>`;
    return svg(340, 212, s, 'Registerbild der Mini-CPU');
  }

  const api = { GATES, GORDER, gateSvg, gateTable, ffSim, ffRows, ffSymbol, ffTable, timingSvg, counterSim, counterSvg, sevenSvg, segCode, SEG7, cpu85Svg, cpu4Svg, CSS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DIGI_VIZ = api;
  if (typeof document === 'undefined') return;
  if (!document.getElementById('dvCss')) { const st0 = document.createElement('style'); st0.id = 'dvCss'; st0.textContent = CSS; (document.head || document.documentElement).appendChild(st0); }

  /* ================= Fenster ================= */
  api.open = function () {
    if (!root.LabUI || !root.LabUI.sheet) return;
    if (!document.getElementById('dvCss')) { const st = document.createElement('style'); st.id = 'dvCss'; st.textContent = CSS; document.head.appendChild(st); }
    root.LabUI.sheet('Bilder zur Digitaltechnik', b => {
      b.classList.add('dv');
      const N = 8, S = { tab: 'gate', gate: 'AND', style: 'box', a: 0, b: 0, ff: 'D', cnt: 3, down: 0, dig: 5, sel: 0, inp: { d: [0, 1, 1, 0, 1, 0, 0, 1], t: [1, 1, 0, 1, 1, 0, 1, 1], j: [1, 0, 1, 1, 0, 0, 1, 0], k: [0, 1, 1, 0, 1, 0, 1, 0], s: [1, 0, 0, 1, 0, 0, 1, 0], r: [0, 0, 1, 0, 0, 1, 0, 0] } };
      const pr = (v) => (v ? 'true' : 'false');
      const chips = (items, cur, key) => `<div class="chs">${items.map(([v, t]) => `<button type="button" data-k="${key}" data-v="${esc(v)}" aria-pressed="${pr(String(cur) === String(v))}">${esc(t)}</button>`).join('')}</div>`;
      const cells = (name, arr, key) => `<div class="cells"><span class="lab">${esc(name)}</span>${arr.slice(0, N).map((v, i) => `<button type="button" class="cell" data-c="${key}" data-i="${i}" aria-pressed="${pr(v)}" aria-label="${esc(name)} Takt ${i + 1}: ${v}">${v}</button>`).join('')}</div>`;
      const draw = () => {
        const tabs = [['gate', 'Gatter'], ['ff', 'Flipflops'], ['cnt', 'Zähler'], ['seg', '7-Segment']];
        let h = `<div class="tabs" role="tablist">${tabs.map(([k, t]) => `<button type="button" data-k="tab" data-v="${k}" aria-pressed="${pr(S.tab === k)}">${t}</button>`).join('')}</div>`;
        if (S.tab === 'gate') {
          h += chips(GORDER.map(k => [k, k]), S.gate, 'gate') + chips([['box', 'Kästchen (Norm)'], ['form', 'Formzeichen (USA)']], S.style, 'style');
          const g = GATES[S.gate];
          h += `<div class="cells"><span class="lab">A</span><button type="button" class="cell" data-k="a" data-v="${S.a ^ 1}" aria-pressed="${pr(S.a)}" aria-label="Eingang A: ${S.a}">${S.a}</button>${g.ins === 2 ? `<span class="lab" style="margin-left:10px">B</span><button type="button" class="cell" data-k="b" data-v="${S.b ^ 1}" aria-pressed="${pr(S.b)}" aria-label="Eingang B: ${S.b}">${S.b}</button>` : ''}</div>`;
          h += gateSvg(S.gate, S.style === 'form' ? 'form' : 'box', S.a, S.b) + gateTable(S.gate, S.a, S.b);
          h += '<p class="note">Antippen schaltet die Eingänge. Durchgezogen und dick = 1 (High), gestrichelt = 0 (Low). Der Kreis am Ausgang bedeutet: Das Ergebnis wird negiert.</p>';
        } else if (S.tab === 'ff') {
          h += chips([['D', 'D'], ['T', 'T'], ['JK', 'JK'], ['RS', 'RS-Latch']], S.ff, 'ff');
          const keys = { D: [['D', 'd']], T: [['T', 't']], JK: [['J', 'j'], ['K', 'k']], RS: [['S', 's'], ['R', 'r']] }[S.ff];
          h += ffSymbol(S.ff);
          h += keys.map(([nm, k]) => cells(nm, S.inp[k], k)).join('');
          h += timingSvg(ffRows(S.ff, S.inp, N), N, { label: 'Zeitdiagramm ' + S.ff });
          h += `<div class="chs">${Array.from({ length: N }, (_, i) => `<button type="button" data-k="sel" data-v="${i}" aria-pressed="${pr(S.sel === i)}" aria-label="Takt ${i + 1} in der Tabelle zeigen">${i + 1}</button>`).join('')}</div>` + ffTable(S.ff, S.inp, S.sel);
          h += `<p class="note">${S.ff === 'RS' ? 'Der RS-Latch reagiert auf den Pegel, nicht auf eine Taktflanke. Schraffiert: Zustand unzulässig oder unbestimmt.' : 'Das Flipflop übernimmt die Eingänge bei der steigenden Taktflanke (gestrichelte Linien). Dazwischen bleibt Q unverändert.'} Die Tabelle zeigt die Zeile des gewählten Taktes.</p>`;
        } else if (S.tab === 'cnt') {
          h += chips([[3, '3 Bit'], [4, '4 Bit']], S.cnt, 'cnt') + chips([[0, 'aufwärts'], [1, 'abwärts']], S.down, 'down');
          h += counterSvg(S.cnt, N + (S.cnt === 4 ? 4 : 0), !!S.down);
          h += `<p class="note">Ein ${S.cnt}-Bit-Dualzähler hat ${Math.pow(2, S.cnt)} Zustände (0 bis ${Math.pow(2, S.cnt) - 1}) und beginnt danach von vorn. Q0 ist das niederwertigste Bit und wechselt mit jedem Takt, jedes weitere Bit wechselt halb so oft.</p>`;
        } else {
          h += chips(SEG7.map((_, i) => [i, String(i)]), S.dig, 'dig');
          h += sevenSvg(S.dig) + `<p class="eq">Segmente a b c d e f g = ${segCode(S.dig).split('').join(' ')}</p>`;
          h += '<p class="note">Bei der Anzeige mit gemeinsamer Kathode leuchtet ein Segment, wenn sein Eingang High (1) hat. Jedes Segment ist eine LED und braucht einen eigenen Vorwiderstand.</p>';
        }
        b.innerHTML = h;
      };
      b.addEventListener('click', e => {
        const t = e.target.closest('button'); if (!t) return;
        if (t.dataset.c) { const arr = S.inp[t.dataset.c], i = +t.dataset.i; arr[i] = arr[i] ? 0 : 1; draw(); return; }
        const k = t.dataset.k; if (!k) return; let v = t.dataset.v;
        if (['a', 'b', 'cnt', 'down', 'dig', 'sel'].indexOf(k) >= 0) v = +v;
        S[k] = v; draw();
      });
      draw();
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
