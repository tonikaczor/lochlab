'use strict';
/* Tonfunk IT-Systeme-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei sysviz.js, eingebunden NACH sysui.js.
   Reiter Bus und Speicher: Verdopplungsleiter der Adressen (jede Leitung mehr = doppelt so viele Adressen) und Bus mit einzelnen Adress-, Daten- und Steuerleitungen,
   die live den Zustand des Buszugriffs zeigen (Bits der Adresse und des Datenworts, aktives Steuersignal, Datenrichtung).
   Reiter Zahlen und Flags: Bit-Raster dual/hex mit Stellenwerten und Nibble-Gruppen; Rechenwerk mit Übertragskette und Flag-Lampen.
   Reiter Mikroprozessor: Speicherplan als Adressraum-Balken mit Bausteinen, Adresse zerlegt und Adressdecoder; Blockbild des 8085 (vereinfacht) mit den Phasen Holen, Dekodieren, Ausführen.
   Die Bilder lesen nur den Zustand aus localStorage (lm4.sys.*) und rechnen mit SYS_CORE; sie ändern keine Eingaben und erscheinen nicht in Aufgaben und Trainer (Lösungen bleiben verdeckt).
   Alle Zahlen sind ÜBUNGSWERTE. Theme nur über CSS-Variablen; Bewegung nur per CSS bei prefers-reduced-motion: no-preference.
   window.SYS_VIZ bzw. module.exports: reine Funktionen, die SVG-Text liefern (für Tests). */
(function (root) {
  const C = root.SYS_CORE || (typeof require !== 'undefined' ? require('./syscore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 0 : d, true) : '–');
  const P = s => (C ? C.parseDe(s) : NaN);
  const num = v => (fin(v) ? Math.round(v * 100) / 100 : 0);
  const fl = (col, op) => `fill="var(--${col})"${op != null ? ` fill-opacity="${op}"` : ''}`;
  const svg = (w, h, label, body) => `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${num(x)}" y="${num(y)}"${extra || ''}>${esc(t)}</text>`;
  const msg = (t, w) => svg(w || 480, 44, 'Hinweis', T((w || 480) / 2, 26, t, 'vz-s m', ' text-anchor="middle"'));
  const hexIn = (s, max) => { const v = C.fromBase(s, 16); return C.isInt(v) && v >= 0 && v <= max ? v : NaN; };
  const bitsOf = (v, n) => Array.from({ length: n }, (_, i) => (Math.floor(v / Math.pow(2, n - 1 - i)) % 2));

  /* ============================================================ Bus: Verdopplungsleiter */
  /* n Adressleitungen, d Datenleitungen: Zeilen für n−4 … n+1 (Bereich 1 … 32), Balken im echten Verhältnis (jede Zeile halb so lang) */
  function addrLadder(n, d) {
    if (!C || !C.isInt(n) || n < 1 || n > 32 || !C.isInt(d) || d < 1 || d > 64) return msg('Gib 1 bis 32 Adressleitungen und 1 bis 64 Datenleitungen ein.');
    const lo = Math.max(1, n - 4), hi = Math.min(32, Math.max(n + 1, lo + 1)), W = 480, bx = 78, bw = 210, rh = 28;
    let s = T(14, 16, 'Jede Adressleitung mehr verdoppelt die Zahl der Adressen', 'vz-t b'), y = 26;
    for (let m = hi; m >= lo; m--) {
      const cur = m === n, cnt = Math.pow(2, m), w = Math.max(3, Math.pow(2, m - hi) * bw), by = y + (hi - m) * rh;
      s += T(14, by + 17, m + (m === 1 ? ' Leitung' : ' Leitungen'), 'vz-s' + (cur ? ' b' : ' m'), ' style="font-size:11px"');
      s += `<rect x="${bx + 26}" y="${by + 3}" width="${num(w)}" height="18" rx="4" ${fl(cur ? 'accent' : 'mute', cur ? .85 : .5)}${cur ? ' stroke="var(--fg)" stroke-width="1.5"' : ''}/>`;
      const lab = f(cnt, 0) + ' Adressen' + (d % 8 === 0 ? ' · ' + C.sizeText(cnt * d / 8) : '');
      s += T(bx + 26 + num(w) + 8, by + 17, lab, 'vz-s' + (cur ? ' b' : ''), ' style="font-size:11.5px"');
    }
    const H = y + (hi - lo + 1) * rh + 8;
    return svg(W, H, 'Balken: Zahl der Adressen bei ' + lo + ' bis ' + hi + ' Adressleitungen, jede Zeile doppelt so lang', s);
  }

  /* ============================================================ Bus: einzelne Leitungen */
  /* o: { bits: 8|16, sig: IOW|IOR|MEMW|MEMR, addrV, dataV } — ungültige Werte (NaN) zeigen alle Leitungen ruhig */
  function busLines(o) {
    const W = 480, bits = o.bits === 16 ? 16 : 8, sig = C.CTRL[o.sig] ? o.sig : 'IOW', c = C.CTRL[sig], aOk = C.isInt(o.addrV) && o.addrV >= 0 && o.addrV <= C.maxVal(bits), dOk = C.isInt(o.dataV) && o.dataV >= 0 && o.dataV <= 255;
    const x1 = 84, x2 = 396, aTop = 40, aH = 100, dTop = 198, dH = 92, cTop = 346, cH = 60, isMem = sig.indexOf('MEM') === 0, wr = c.dir === 'out';
    const ab = aOk ? bitsOf(o.addrV, bits) : null, db = dOk ? bitsOf(o.dataV, 8) : null;
    let s = '';
    /* Bausteine rechts: Speicher und E/A */
    s += `<rect x="${x2 + 12}" y="${aTop - 14}" width="72" height="${dTop + dH - aTop + 22}" rx="8" ${fl(isMem ? 'accent' : 'panel', isMem ? .22 : null)} stroke="${isMem ? 'var(--accent)' : 'var(--mute)'}" stroke-width="${isMem ? 3 : 1.5}"/>`;
    s += `<rect x="${x2 + 12}" y="${cTop - 14}" width="72" height="${cH + 22}" rx="8" ${fl(!isMem ? 'accent' : 'panel', !isMem ? .22 : null)} stroke="${!isMem ? 'var(--accent)' : 'var(--mute)'}" stroke-width="${!isMem ? 3 : 1.5}"/>`;
    s += T(x2 + 48, aTop + 60, 'Speicher', 'vz-s b', ' text-anchor="middle"') + T(x2 + 48, aTop + 76, isMem ? 'angesprochen' : 'ruht', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    s += T(x2 + 48, cTop + 26, 'E/A', 'vz-s b', ' text-anchor="middle"') + T(x2 + 48, cTop + 42, !isMem ? 'angesprochen' : 'ruht', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    s += `<rect x="6" y="${aTop - 14}" width="62" height="${cTop + cH - aTop + 22}" rx="8" ${fl('panel')} stroke="var(--mute)" stroke-width="2"/>` + T(37, (aTop + cTop + cH) / 2, 'CPU', 'vz-t b', ' text-anchor="middle"');
    /* Adressbus */
    const aStep = aH / (bits - 1);
    s += T(x1, aTop - 20, 'Adressbus ' + bits + ' Leitungen' + (aOk ? ': ' + C.hex(o.addrV, bits / 4) + ' hex' : ''), 'vz-s b');
    for (let i = 0; i < bits; i++) {
      const y = aTop + i * aStep, on = ab && ab[i] === 1, idx = bits - 1 - i;
      s += `<line x1="${x1}" x2="${x2}" y1="${num(y)}" y2="${num(y)}" stroke="var(--${on ? 'accent' : 'mute'})" stroke-width="${on ? 3.5 : 1.5}" stroke-opacity="${on ? 1 : .55}"/>`;
      if (bits === 8 || idx % 4 === 3 || idx === 0) s += T(x1 - 4, y + 4, 'A' + idx, 'vz-s m', ' text-anchor="end" style="font-size:10.5px"');
    }
    s += T(x2 - 4, aTop + aH + 16, ab ? ab.join('').replace(/(.{4})(?=.)/g, '$1 ') : 'Adresse ungültig', 'vz-s', ' text-anchor="end" style="fill:var(--accent);font-family:ui-monospace,Consolas,monospace"');
    /* Datenbus */
    const dStep = dH / 7;
    s += T(x1, dTop - 20, 'Datenbus 8 Leitungen' + (dOk ? ': ' + C.hex(o.dataV, 2) + ' hex' : ''), 'vz-s b');
    for (let i = 0; i < 8; i++) {
      const y = dTop + i * dStep, on = db && db[i] === 1;
      s += `<line x1="${x1}" x2="${x2}" y1="${num(y)}" y2="${num(y)}" stroke="var(--${on ? 'hi' : 'mute'})" stroke-width="${on ? 3.5 : 1.5}" stroke-opacity="${on ? 1 : .55}"/>`;
      if (on) s += `<line class="vz-flow${wr ? '' : ' vz-rev'}" x1="${x1}" x2="${x2}" y1="${num(y)}" y2="${num(y)}" stroke="var(--bg)" stroke-width="1.5"/>`;
      s += T(x1 - 4, y + 4, 'D' + (7 - i), 'vz-s m', ' text-anchor="end" style="font-size:10.5px"');
    }
    s += T(x2 - 4, dTop + dH + 16, db ? db.join('').replace(/(.{4})(?=.)/g, '$1 ') : 'Datenwort ungültig', 'vz-s', ' text-anchor="end" style="fill:var(--hi);font-family:ui-monospace,Consolas,monospace"');
    /* Pfeil der Datenrichtung */
    const my = dTop + dH / 2, ax = (x1 + x2) / 2;
    s += `<g style="color:var(--fg)"><path d="${wr ? `M${ax - 16} ${my - 18}h28m-8 -6 8 6 -8 6` : `M${ax + 16} ${my - 18}h-28m8 -6 -8 6 8 6`}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></g>`;
    s += T(ax, my - 28, wr ? 'CPU gibt aus' : 'CPU liest ein', 'vz-s b', ' text-anchor="middle" style="paint-order:stroke;stroke:var(--panel2);stroke-width:4px"');
    /* Steuerbus */
    s += T(x1, cTop - 20, 'Steuerbus', 'vz-s b');
    Object.keys(C.CTRL).forEach((k, i) => {
      const y = cTop + 6 + i * 16, on = k === sig;
      s += `<line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="var(--${on ? 'ok' : 'mute'})" stroke-width="${on ? 4 : 1.5}" stroke-opacity="${on ? 1 : .55}"/>` + T(x1 - 4, y + 4, k, 'vz-s' + (on ? ' b' : ' m'), ' text-anchor="end" style="font-size:10.5px"');
    });
    s += T(x2 - 4, cTop + cH + 16, c.t, 'vz-s b', ' text-anchor="end"');
    return svg(W, cTop + cH + 30, 'Bus mit einzelnen Adress-, Daten- und Steuerleitungen; aktives Steuersignal ' + sig, s);
  }

  /* ============================================================ Zahlen: Bit-Raster */
  function bitGrid(v) {
    if (!C || !(C.isInt(v) && v >= 0 && v <= 65535)) return msg('Gib eine Zahl von 0 bis 65.535 ein, dann erscheint das Bit-Raster.');
    const bits = v > 255 ? 16 : 8, bs = bitsOf(v, bits), W = 480, cw = bits === 8 ? 46 : 25, gap = 12, total = bits * cw + (bits / 4 - 1) * gap, x0 = (W - total) / 2;
    const xOf = i => x0 + i * cw + Math.floor(i / 4) * gap;
    let s = T(14, 16, bits + ' Bit: Stellenwert · Bit · Hex-Ziffer', 'vz-t b');
    for (let i = 0; i < bits; i++) {
      const idx = bits - 1 - i, on = bs[i] === 1, x = xOf(i);
      s += T(x + cw / 2, 40, bits === 8 ? String(Math.pow(2, idx)) : '2^' + idx, 'vz-s m', ` text-anchor="middle" style="font-size:${bits === 8 ? 12 : 9.5}px"`);
      s += `<rect x="${num(x + 1)}" y="48" width="${cw - 2}" height="${bits === 8 ? 46 : 40}" rx="6" ${fl(on ? 'accent' : 'panel', on ? .8 : null)} stroke="var(--${on ? 'accent' : 'mute'})" stroke-width="${i === 0 ? 2.5 : 1.5}"/>`;
      s += T(x + cw / 2, bits === 8 ? 79 : 76, on ? '1' : '0', 'vz-t b', ` text-anchor="middle" style="font-size:${bits === 8 ? 24 : 18}px;fill:var(${on ? '--bg' : '--mute'})"`);
      s += T(x + cw / 2, (bits === 8 ? 94 : 88) + 14, 'Bit ' + idx, 'vz-s m', ' text-anchor="middle" style="font-size:9.5px"');
    }
    const yh = bits === 8 ? 132 : 126;
    for (let g = 0; g < bits / 4; g++) {
      const xa = xOf(g * 4) + 1, xb = xOf(g * 4 + 3) + cw - 1, val = bs.slice(g * 4, g * 4 + 4).reduce((a, b) => a * 2 + b, 0);
      s += `<path d="M${num(xa)} ${yh - 12}v8h${num(xb - xa)}v-8" fill="none" stroke="var(--mute)" stroke-width="1.5"/>`;
      s += T((xa + xb) / 2, yh + 22, C.hex(val, 1), 'vz-t b', ' text-anchor="middle" style="font-size:24px;fill:var(--accent)"') + T((xa + xb) / 2, yh + 40, '= ' + val + ' dezimal', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    }
    const terms = bs.map((b, i) => (b ? Math.pow(2, bits - 1 - i) : 0)).filter(x => x > 0), half = Math.ceil(terms.length / 2), line = a => a.map(f).join(' + ');
    let y = yh + 66;
    if (!terms.length) s += T(W / 2, y, 'Alle Bits 0: Summe = 0', 'vz-s b', ' text-anchor="middle"'), y += 8;
    else if (terms.length <= 8) s += T(W / 2, y, line(terms) + ' = ' + f(v, 0), 'vz-s b', ' text-anchor="middle"'), y += 8;
    else { s += T(W / 2, y, line(terms.slice(0, half)) + ' +', 'vz-s b', ' text-anchor="middle"') + T(W / 2, y + 18, line(terms.slice(half)) + ' = ' + f(v, 0), 'vz-s b', ' text-anchor="middle"'); y += 26; }
    s += T(W / 2, y + 14, 'Hex: eine Ziffer je vier Bit (Nibble). Das Bit ganz rechts ist das niedrigste (LSB).', 'vz-s m', ' text-anchor="middle"');
    return svg(W, y + 26, 'Bit-Raster der Zahl ' + v + ': ' + bs.join('') + ', hexadezimal ' + C.hex(v, bits / 4), s);
  }

  /* ============================================================ Rechenwerk: Übertragskette und Flags */
  /* op '+' oder '-'; a, b: 0 … 255. Subtraktion als Addition des Zweierkomplements */
  /* Daten der Rechnung: Bits von A, B (bei Subtraktion das Zweierkomplement von B) und Ergebnis (jeweils Bit 7 zuerst); cin[k+1] = Übertrag aus Bit k; r = Ergebnis und Flags aus dem Kern */
  function chainData(a, b, op) {
    const add = op !== '-', bb = add ? b : C.twos(b, 8), r = add ? C.add8(a, b) : C.sub8(a, b), A = bitsOf(a, 8), B = bitsOf(bb, 8), R = bitsOf(r.r, 8);
    const cin = [0]; for (let k = 0; k < 8; k++) { const sm = A[7 - k] + B[7 - k] + cin[k]; cin.push(sm >> 1); }
    return { add, A, B, R, cin, r };
  }
  function carryChain(a, b, op) {
    if (!C || !C.isInt(a) || !C.isInt(b) || a < 0 || a > 255 || b < 0 || b > 255) return msg('Gib A und B hexadezimal ein (00 bis FF), dann erscheint die Rechnung Bit für Bit.');
    const W = 480, cw = 44, gap = 12, x0 = (W - (8 * cw + gap)) / 2 + 20, { add, A, B, R, cin, r } = chainData(a, b, op);
    const xOf = i => x0 + i * cw + (i >= 4 ? gap : 0);
    let s = T(14, 16, add ? 'A + B, Bit für Bit mit Übertrag' : 'A − B als A + Zweierkomplement von B', 'vz-t b');
    const rows = [['Übertrag', null, 52], ['A', A, 84], [add ? 'B' : '−B (2er-Kompl.)', B, 116], ['Ergebnis', R, 156]];
    s += `<line x1="${x0 - 8}" x2="${num(xOf(7) + cw - 2)}" y1="136" y2="136" stroke="var(--fg)" stroke-width="2"/>`;
    for (let i = 0; i < 8; i++) {
      const x = xOf(i), k = 7 - i;
      s += T(x + cw / 2, 38, 'Bit ' + k, 'vz-s m', ' text-anchor="middle" style="font-size:10px"');
      [[A, 84], [B, 116], [R, 156]].forEach((r, j) => {
        const on = r[0][i] === 1; s += `<rect x="${num(x + 2)}" y="${r[1] - 20}" width="${cw - 4}" height="26" rx="5" ${fl(on ? (j === 2 ? 'ok' : 'accent') : 'panel', on ? .8 : null)} stroke="var(--${on ? (j === 2 ? 'ok' : 'accent') : 'mute'})" stroke-width="1.2"/>` + T(x + cw / 2, r[1] - 2, on ? '1' : '0', 'vz-t b', ` text-anchor="middle" style="fill:var(${on ? '--bg' : '--mute'})"`);
      });
    }
    rows.forEach(r => { if (r[1]) s += T(x0 - 14, r[2] - 2, r[0], 'vz-s m', ' text-anchor="end" style="font-size:10.5px"'); });
    /* Übertrag-Marken: Übertrag aus Bit k steht an der linken Kante der Spalte von Bit k (er geht in Bit k+1) */
    for (let i = 0; i < 8; i++) { const k = 7 - i; if (cin[k + 1] === 1) { const cx = xOf(i) - (i === 4 ? gap / 2 : 2); s += `<circle cx="${num(cx)}" cy="52" r="7" ${fl('warn', .95)}/>` + T(cx, 56, '1', 'vz-s b', ' text-anchor="middle" style="fill:var(--bg);font-size:11px"'); } }
    s += T(x0 - 14, 56, 'Übertrag', 'vz-s m', ' text-anchor="end" style="font-size:10.5px"');
    /* Flag-Lampen */
    const flags = add ? [['CY', r.cy, 'Übertrag aus Bit 7'], ['AC', r.ac, 'Übertrag Bit 3 → 4'], ['Z', r.z, 'Ergebnis 0'], ['S', r.s, 'Bit 7 = 1'], ['P', r.p, 'gerade Einsen']] : [['CY', r.cy, 'Entleihung'], ['Z', r.z, 'Ergebnis 0'], ['S', r.s, 'Bit 7 = 1'], ['P', r.p, 'gerade Einsen']];
    const fw = 86, fx = (W - flags.length * fw) / 2;
    flags.forEach((q, i) => { const x = fx + i * fw, on = q[1] === 1 || q[1] === true; s += `<rect x="${num(x + 3)}" y="182" width="${fw - 6}" height="44" rx="8" ${fl(on ? 'warn' : 'panel', on ? .3 : null)} stroke="var(--${on ? 'warn' : 'mute'})" stroke-width="${on ? 2.5 : 1.5}"/>` + T(x + fw / 2, 201, q[0] + ' = ' + (on ? 1 : 0), 'vz-s b', ' text-anchor="middle"') + T(x + fw / 2, 217, q[2], 'vz-s m', ' text-anchor="middle" style="font-size:10px"'); });
    s += T(W / 2, 246, 'Ergebnis ' + C.hex(r.r, 2) + ' hex = ' + f(r.r, 0) + ' dezimal', 'vz-s b', ' text-anchor="middle"');
    return svg(W, 256, (add ? 'Addition' : 'Subtraktion') + ' im Akkumulator, Bit für Bit, mit Übertragskette und Flags', s);
  }

  /* ============================================================ Mikroprozessor: Speicherplan */
  const TYPE_COL = { ROM: 'accent', RAM: 'ok', 'E/A': 'hi', frei: 'mute' };
  /* m: { k: 1…3, map: Typen je Block, addr: Hex-Text } (16 Adressleitungen, Decoder an den obersten k Bits) */
  function memMap(m) {
    const k = m.k, W = 480, n = C.pow2(k);
    if (![1, 2, 3].includes(k) || !Array.isArray(m.map) || m.map.length !== n) return msg('Speicherplan: ungültige Einstellung.');
    const a = hexIn(m.addr, 65535), z = C.isInt(a) ? C.blockOf(a, 16, k) : -1, bx = 14, bw = 452, cwid = bw / n, size = C.blockSize(16, k);
    let s = T(14, 16, 'Adressraum 0000 bis FFFF (64 KiB) in ' + n + ' Blöcken', 'vz-t b');
    /* Adresse als 16 Bit, oberste k Bit an den Decoder */
    const ab = a >= 0 && C.isInt(a) ? bitsOf(a, 16) : null, cell = 24, gx = (W - (16 * cell + 3 * 8)) / 2, gOf = i => gx + i * cell + Math.floor(i / 4) * 8;
    for (let i = 0; i < 16; i++) { const top = i < k, x = gOf(i); s += `<rect x="${num(x + 1)}" y="30" width="${cell - 2}" height="24" rx="4" ${fl(top ? 'accent' : 'panel', top ? .75 : null)} stroke="var(--${top ? 'accent' : 'mute'})"/>` + T(x + cell / 2, 47, ab ? String(ab[i]) : '–', 'vz-s b', ` text-anchor="middle" style="fill:var(${top ? '--bg' : '--fg'})"`); }
    s += T(gOf(0), 70, 'A15 … A' + (16 - k) + ' → Decoder', 'vz-s', ' style="fill:var(--accent)"') + T(gOf(15) + cell - 2, 70, 'A' + (15 - k) + ' … A0 → Baustein', 'vz-s m', ' text-anchor="end"');
    /* Decoder und Ausgänge */
    const dx = W / 2 - 60;
    s += `<path d="M${num(gOf(0) + 2)} 56v14" stroke="var(--accent)" stroke-width="2" fill="none"/>`;
    s += `<rect x="${dx}" y="80" width="120" height="26" rx="6" ${fl('panel')} stroke="var(--accent)" stroke-width="2"/>` + T(W / 2, 98, 'Decoder 1 aus ' + n, 'vz-s b', ' text-anchor="middle"');
    for (let i = 0; i < n; i++) {
      const cx = bx + i * cwid + cwid / 2, on = i === z;
      const xd = dx + 12 + i * (96 / Math.max(1, n - 1));
      s += `<path d="M${num(xd)} 106V${118 + (i % 2) * 5}H${num(cx)}V126" fill="none" stroke="var(--${on ? 'accent' : 'mute'})" stroke-width="${on ? 3.5 : 1.2}" stroke-opacity="${on ? 1 : .6}"/>`;
      s += T(cx, 138, 'Z' + i, 'vz-s' + (on ? ' b' : ' m'), ' text-anchor="middle"' + (on ? ' style="fill:var(--accent)"' : ''));
    }
    /* Balken der Blöcke */
    for (let i = 0; i < n; i++) {
      const t = m.map[i], x = bx + i * cwid, on = i === z, col = TYPE_COL[t] || 'mute', free = t === 'frei';
      s += `<rect x="${num(x + 1.5)}" y="142" width="${num(cwid - 3)}" height="54" rx="6" ${fl(col, free ? .12 : .6)} stroke="var(--${on ? 'fg' : col})" stroke-width="${on ? 3.5 : 1.5}"${free ? ' stroke-dasharray="5 4"' : ''}/>`;
      s += T(x + cwid / 2, 166, t, 'vz-s b', ' text-anchor="middle"') + T(x + cwid / 2, 184, C.sizeText(size), 'vz-s', ` text-anchor="middle" style="font-size:${n > 4 ? 10.5 : 12}px"`);
      s += T(x + 2, 214, C.hex(C.blockStart(i, 16, k), 4), 'vz-s m', ' style="font-size:11px;font-family:ui-monospace,Consolas,monospace"');
    }
    s += T(bx + bw, 214, 'FFFF', 'vz-s m', ' text-anchor="end" style="font-size:11px;font-family:ui-monospace,Consolas,monospace"');
    /* Marke der CPU-Adresse */
    if (z >= 0) { const mx = bx + a / 65536 * bw; s += `<path d="M${num(mx)} 198l-6 10h12z" ${fl('accent')} stroke="var(--fg)" stroke-width="1"/>` + T(Math.min(Math.max(mx, 40), W - 40), 238, C.hex(a, 4) + ' hex in Z' + z + ' (' + m.map[z] + ')', 'vz-s b', ' text-anchor="middle"'); }
    else s += T(W / 2, 238, 'Gib oben eine gültige Adresse ein, dann erscheint ihre Marke im Plan.', 'vz-s m', ' text-anchor="middle"');
    s += T(W / 2, 258, 'Beschriftung der Blöcke nach deiner Auswahl; die Bausteine sind Übungsannahmen.', 'vz-s m', ' text-anchor="middle" style="font-size:10.5px"');
    return svg(W, 266, 'Speicherplan: Adressraum in ' + n + ' Blöcke geteilt, Decoder wählt Block Z' + (z >= 0 ? z : '–'), s);
  }

  /* ============================================================ 8085, vereinfacht */
  const PHASES = { fetch: ['Holen', 'Der Programmzähler (PC) liefert die Adresse des nächsten Befehls über den Adresspuffer auf den Adressbus. Mit dem Steuersignal MEMR kommt das Befehlsbyte über den Datenbus in das Befehlsregister. Der PC wird um 1 erhöht.'], dec: ['Dekodieren', 'Der Befehlsdecoder wertet das Befehlsregister aus und meldet dem Steuerwerk, was zu tun ist. Das Steuerwerk erzeugt daraus die Steuersignale und den Takt der folgenden Schritte.'], exec: ['Ausführen (Beispiel ADD B)', 'Das Steuerwerk leitet Register B und Akkumulator zur ALU. Die ALU addiert, das Ergebnis geht zurück in den Akkumulator und die Flags werden gesetzt.'] };
  /* hi: Menge der hervorgehobenen Wege */
  function cpuBlock(phase) {
    const ph = PHASES[phase] ? phase : 'fetch', W = 480, H = 322, on = { fetch: ['pc', 'abuf', 'abus', 'cbus', 'dbus', 'ir'], dec: ['ir', 'dec', 'ctl'], exec: ['ctl', 'regs', 'alu', 'acc', 'flag'] }[ph], hl = k => on.indexOf(k) >= 0;
    const hh = k => [].concat(k).some(hl), st = k => `stroke="var(--${hh(k) ? 'accent' : 'mute'})" stroke-width="${hh(k) ? 3 : 1.5}"`, ln = (k, d) => `<path ${hh(k) ? 'class="vz-flow" ' : ''}d="${d}" fill="none" ${st(k)} stroke-linecap="round"/>`;
    const bx = (k, x, y, w, h, t1, t2) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${fl(hl(k) ? 'accent' : 'panel', hl(k) ? .28 : null)} ${st(k)}/>${T(x + w / 2, y + h / 2 + (t2 ? -2 : 4), t1, 'vz-s b', ' text-anchor="middle"')}${t2 ? T(x + w / 2, y + h / 2 + 12, t2, 'vz-s m', ' text-anchor="middle" style="font-size:10px"') : ''}</g>`;
    let s = `<rect x="6" y="6" width="388" height="${H - 36}" rx="10" fill="none" stroke="var(--fg)" stroke-width="2"/>` + T(14, 24, 'Prozessor (8085, vereinfacht)', 'vz-s b');
    /* Register */
    s += bx('regs', 14, 34, 84, 26, 'B', 'C') + bx('regs', 14, 64, 84, 26, 'D', 'E') + bx('regs', 14, 94, 84, 26, 'H', 'L');
    s += bx('acc', 14, 130, 84, 30, 'Akku A') + bx('flag', 14, 164, 84, 30, 'Flags', 'S Z AC P CY');
    s += bx('sp', 14, 204, 84, 26, 'SP', 'Stapelzeiger') + bx('pc', 14, 236, 84, 26, 'PC', 'Programmzähler');
    /* ALU */
    s += bx('alu', 120, 130, 66, 64, 'ALU');
    /* Steuerung */
    s += bx('ir', 214, 34, 82, 30, 'Befehlsreg.') + bx('dec', 214, 74, 82, 30, 'Decoder') + bx('ctl', 214, 114, 82, 44, 'Steuerwerk', 'Takt, Signale');
    /* Puffer */
    s += bx('abuf', 214, 204, 82, 30, 'Adresspuffer', '16 Bit') + bx('dbuf', 214, 244, 82, 26, 'Datenpuffer', '8 Bit');
    /* Verbindungen */
    s += ln('regs', 'M98 47H108V150H120') + ln('acc', 'M98 145H120') + ln('flag', 'M98 179H108V176H120') + ln('pc', 'M98 249H106V219H214') + ln('abuf', 'M296 219H402');
    s += ln('ir', 'M255 64V74') + ln('dec', 'M255 104V114') + ln(['ctl', 'cbus'], 'M296 136H340V132H402');
    s += ln('dbus', 'M296 257H402') + (ph === 'fetch' ? ln('ir', 'M306 257V49H296') : '');
    /* Busse rechts */
    s += T(406, 126, 'Steuerbus', 'vz-s' + (hl('cbus') ? ' b' : ' m'), ' style="font-size:10.5px"') + T(406, 213, 'Adressbus', 'vz-s' + (hl('abus') ? ' b' : ' m'), ' style="font-size:10.5px"') + T(406, 251, 'Datenbus', 'vz-s' + (hl('dbus') ? ' b' : ' m'), ' style="font-size:10.5px"');
    s += T(406, 232, '16 Leitungen', 'vz-s m', ' style="font-size:10px"') + T(406, 270, '8 Leitungen', 'vz-s m', ' style="font-size:10px"');
    s += T(14, H - 12, 'Speicher und E/A hängen außerhalb des Prozessors an den drei Bussen.', 'vz-s m', ' style="font-size:10.5px"');
    return svg(W, H, 'Blockbild eines 8085 (vereinfacht): Register, ALU, Befehlsregister, Decoder, Steuerwerk, Puffer und Busse; Phase ' + PHASES[ph][0], s);
  }

  /* ============================================================ Einbindung in die Seite */
  const CSS = '.vz-card{margin-bottom:10px}.vz-card .vz-svg{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;margin:8px 0}' +
    '.vz-svg svg{display:block;width:100%;height:auto;touch-action:manipulation}.vz-svg text{font-family:system-ui,sans-serif;fill:var(--fg);-webkit-user-select:none;user-select:none}' +
    '.vz-t{font-size:13.5px}.vz-s{font-size:12px}.vz-svg .m{fill:var(--mute)}.vz-svg .b{font-weight:700}' +
    '.vz-seg{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.vz-seg button{min-height:44px;padding:0 14px;border-radius:22px;background:var(--panel2);border:1px solid var(--line);font:600 14px system-ui;color:var(--fg)}.vz-seg button.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}' +
    '@media(prefers-reduced-motion:no-preference){.vz-flow{stroke-dasharray:3 9;animation:vzf 1.4s linear infinite}.vz-flow.vz-rev{animation-direction:reverse}@keyframes vzf{to{stroke-dashoffset:-24}}}';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem('lm4.sys.' + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const card = (t, body, extra) => `<div class="card pl vz-card"><h4>${esc(t)}</h4>${extra || ''}<div class="vz-svg">${body}</div></div>`;
  let phase = 'fetch';
  const VIEWS = [
    { id: 'adr', view: '#busView', anchor: v => v.querySelector('#adrOut'), mode: 'cardAfter', html() { const b = Object.assign({ n: '16', d: '8' }, lsGet('bus', {})); return card('Adressen verdoppeln sich', addrLadder(P(b.n), P(b.d))); } },
    { id: 'bus', view: '#busView', anchor: v => v.querySelector('#cycOut'), mode: 'cardAfter', html() { const b = Object.assign({ sig: 'IOW', addr: '5B', data: '0E', bits: 8 }, lsGet('bus', {})), bits = +b.bits === 16 ? 16 : 8; return card('Der Bus Leitung für Leitung', busLines({ bits, sig: b.sig, addrV: hexIn(b.addr, C.maxVal(bits)), dataV: hexIn(b.data, 255) }), '<p class="hint2" style="margin:0 0 4px">Eine hell gezeichnete Leitung führt in diesem Augenblick eine 1, eine graue eine 0. Die Werte kommen aus dem Zugriff oben.</p>'); } },
    { id: 'bits', view: '#zsView', anchor: v => v.querySelector('#zsOut'), mode: 'cardAfter', html() { const z = Object.assign({ v: '91' }, lsGet('zs', {})); return card('Bit-Raster', bitGrid(P(z.v))); } },
    { id: 'chain', view: '#zsView', anchor: v => v.querySelector('#rechOut'), mode: 'cardAfter', html() { const r = Object.assign({ a: 'C6', b: '61', op: '+' }, lsGet('rech', {})); return card('Rechnen Bit für Bit', carryChain(hexIn(r.a, 255), hexIn(r.b, 255), r.op)); } },
    { id: 'map', view: '#mpsView', anchor: v => v.querySelector('#mpsOut'), mode: 'before', html() { const m = Object.assign({ k: 2, map: ['ROM', 'RAM', 'E/A', 'frei'], addr: '5A00' }, lsGet('mps', {})); return card('Speicherplan als Adressraum', memMap({ k: +m.k, map: m.map, addr: m.addr })); } },
    { id: 'cpu', view: '#mpsView', anchor: v => v.querySelector('#mpsOut'), mode: 'after', html() { return card('Blockbild des 8085', cpuBlock(phase), '<div class="vz-seg" role="group" aria-label="Phase">' + Object.keys(PHASES).map(k => `<button data-vzp="${k}" class="${k === phase ? 'on' : ''}" aria-pressed="${k === phase}">${esc(PHASES[k][0])}</button>`).join('') + '</div><p class="hint2" style="margin:2px 0 0">' + esc(PHASES[phase][1]) + '</p>'); } }
  ];
  function paint(d) {
    const view = document.querySelector(d.view), a = view && d.anchor(view); if (!view || !a) return;
    const at = d.mode.indexOf('card') === 0 ? a.closest('.card') || a : a;
    let box = view.querySelector('.vz-box[data-vz="' + d.id + '"]');
    if (!box) { box = document.createElement('div'); box.className = 'vz-box'; box.setAttribute('data-vz', d.id); at.parentNode.insertBefore(box, d.mode === 'before' ? at : at.nextSibling); }
    let html = ''; try { html = d.html(); } catch (e) { html = ''; }
    if (box.__h !== html) { box.innerHTML = html; box.__h = html; }
  }
  function boot() {
    if (!C || typeof document === 'undefined') return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    ['#busView', '#zsView', '#mpsView'].forEach(sel => {
      const view = document.querySelector(sel); if (!view) return;
      const mine = VIEWS.filter(d => d.view === sel); let q = 0;
      const go = () => { clearTimeout(q); q = setTimeout(() => mine.forEach(paint), 0); };
      new MutationObserver(go).observe(view, { childList: true });
      ['input', 'change', 'click'].forEach(ev => view.addEventListener(ev, e => {
        const p = e.target.closest && e.target.closest('[data-vzp]'); if (p && PHASES[p.dataset.vzp]) phase = p.dataset.vzp;
        go();
      }));
      mine.forEach(paint);
    });
  }
  const API = { addrLadder, busLines, bitGrid, chainData, carryChain, memMap, cpuBlock, PHASES };
  root.SYS_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot(); }
})(typeof window !== 'undefined' ? window : globalThis);
