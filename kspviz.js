'use strict';
/* Tonfunk Kleinsteuerungs-Lab: Bilder (Kennung 'ksp'). Reine Zeichenfunktionen, liefern SVG-Text ohne DOM (testbar mit node quelle/ksp/test_kspviz.js).
   ALLE Zahlen (Spannungen, Zeiten, Schaltabstände) sind ÜBUNGSWERTE für die Ausbildung.
   sh:  Stromlaufplan der Selbsthaltung bzw. Wendeschaltung mit stromführenden Wegen
   fup: Funktionsbaustein mit Zeitdiagramm (Eingänge, Ausgang, Zählerstand)
   ep:  doppelt wirkender Zylinder mit 5/2-Magnetventil, Endlagensensoren und Luftwegen
   sen: Sensor, Werkstück, Aderfarben, Klemmen und LEDs der Kleinsteuerung mit Messwerten
   Farben nur über die CSS-Variablen der Seite. Bewegung (fließender Strom, drehender Motor) nur bei prefers-reduced-motion: no-preference;
   der Endzustand ist immer ohne Bewegung zu erkennen. Alle Bilder sind 380 Einheiten breit, die Schrift ist 13 Einheiten groß (am iPhone etwa 12 px). */
(function (root) {
  const C = root.KSP_CORE || (typeof require === 'function' ? require('./kspcore.js') : null);
  const W = 380, fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}">${esc(t)}</text>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const O = (x, y, r, cls) => `<circle class="${cls || ''}" cx="${q(x)}" cy="${q(y)}" r="${q(r)}"/>`;
  const pts = a => a.map(p => q(p[0]) + ',' + q(p[1])).join(' ');
  const svg = (H, label, body) => `<svg class="ks" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* Leitung; auf = stromführend (blau, mit laufenden Punkten), bad = Fehlerstelle */
  const wire = (a, auf, bad) => `<polyline class="w${auf ? ' on' : ''}${bad ? ' bad' : ''}" points="${pts(a)}"/>` + (auf ? `<polyline class="fl" points="${pts(a)}"/>` : '');
  const mark = (x, y) => `<g class="cut">${L(x - 7, y - 7, x + 7, y + 7, 'x')}${L(x - 7, y + 7, x + 7, y - 7, 'x')}</g>`;

  const CSS = `.ks{display:block;width:100%;height:auto;max-width:560px;margin:0 auto}
.ks text{font-family:system-ui,sans-serif;font-size:13px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.ks .m{fill:var(--mute)}.ks .b{font-weight:700}.ks .mid{text-anchor:middle}.ks .end{text-anchor:end}.ks .ac{fill:var(--accent)}.ks .bd{fill:var(--danger)}.ks .gr{fill:var(--ok)}
.ks .w{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ks .w.on{stroke:var(--accent);stroke-width:3.2}.ks .w.bad{stroke:var(--danger)}
.ks .fl{fill:none;stroke:var(--panel);stroke-width:1.8;stroke-linecap:round;stroke-dasharray:1 11;display:none}
.ks .sym{fill:none;stroke:var(--mute);stroke-width:2.2;stroke-linecap:round}.ks .sym.on{stroke:var(--accent);stroke-width:3}
.ks .cp{fill:none;stroke:var(--mute);stroke-width:1.4;stroke-dasharray:5 4}
.ks .box{fill:var(--panel);stroke:var(--mute);stroke-width:1.8}.ks .box.on{stroke:var(--accent)}.ks .box.bad{stroke:var(--danger)}
.ks .coil{fill:var(--panel2);stroke:var(--mute);stroke-width:2.2}.ks .coil.on{fill:var(--accent);fill-opacity:.28;stroke:var(--accent)}
.ks .led{fill:var(--panel2);stroke:var(--mute);stroke-width:1.6}.ks .led.on{fill:var(--ok);stroke:var(--ok)}.ks .led.bad{fill:var(--danger);stroke:var(--danger)}
.ks .fil{fill:var(--accent);fill-opacity:.22;stroke:none}.ks .fil.gr{fill:var(--ok);fill-opacity:.25}
.ks .grid{stroke:var(--line);stroke-width:1}.ks .ax{stroke:var(--mute);stroke-width:1.4}
.ks .cur{stroke:var(--hi);stroke-width:1.8;stroke-dasharray:4 4}
.ks .tr{fill:none;stroke:var(--fg);stroke-width:2.4;stroke-linejoin:round}.ks .tr.q{stroke:var(--ok);stroke-width:3}
.ks .pst{fill:var(--accent);stroke:var(--fg);stroke-width:1.4}.ks .rod{fill:var(--mute)}.ks .pip{fill:none;stroke:var(--mute);stroke-width:2.6;stroke-linejoin:round}
.ks .pip.on{stroke:var(--accent);stroke-width:3.2}.ks .pip.ex{stroke-dasharray:4 4}
.ks .obj{fill:var(--mute);fill-opacity:.55;stroke:var(--fg);stroke-width:1.6}.ks .obj.stahl{fill:#8e9aa6}.ks .obj.alu{fill:#c4cbd2}.ks .obj.kunst{fill:#e8a64a}
.ks .ader{fill:none;stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.ks .ader.braun{stroke:#8a5a2b}.ks .ader.blau{stroke:#2f6fdb}.ks .ader.schwarz{stroke:var(--fg)}
.ks .halo{fill:none;stroke:var(--accent);stroke-width:11;stroke-linecap:round;stroke-linejoin:round;opacity:.3}
.ks .x{stroke:var(--danger);stroke-width:3;stroke-linecap:round}
.ks .zone{stroke:var(--hi);stroke-width:1.8;stroke-dasharray:5 4}
@media (prefers-reduced-motion:no-preference){.ks .fl{display:block;animation:ksfl 1.1s linear infinite}.ks .spin{animation:ksspin 2.4s linear infinite;transform-box:fill-box;transform-origin:center}.ks .spin.l{animation-direction:reverse}}
@keyframes ksfl{to{stroke-dashoffset:-12}}@keyframes ksspin{to{transform:rotate(360deg)}}`;
  if (typeof document !== 'undefined' && document.head && document.createElement) { const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }

  /* ============================================================ Stromlaufplan */
  /* Schalter senkrecht: x, y = oberer Anschluss, 40 hoch. kind no (Schließer) oder nc (Öffner); closed = Kontakt geschlossen; hand = Taster mit Betätigung (pressed = gedrückt) */
  function sw(x, y, kind, closed, name, sub, hand, pressed) {
    const c = 'sym' + (closed ? ' on' : ''), b = kind === 'no' ? (closed ? [x, y + 28, x, y + 12] : [x, y + 28, x - 10, y + 13]) : (closed ? [x, y + 28, x, y + 12] : [x, y + 28, x + 10, y + 13]);
    return L(x, y, x, y + 12, c) + L(x, y + 28, x, y + 40, c) + L(b[0], b[1], b[2], b[3], c) + (kind === 'nc' ? L(x - 6, y + 12, x + 6, y + 12, c) : '') +
      (hand ? L(x, y + 20, x - 14 + (pressed ? 6 : 0), y + 20, 'cp') + L(x - 14 + (pressed ? 6 : 0), y + 12, x - 14 + (pressed ? 6 : 0), y + 28, 'sym' + (pressed ? ' on' : '')) : '') +
      T(x + 13, y + 19, name, 'b') + (sub ? T(x + 13, y + 34, sub, 'm') : '');
  }
  const coil = (x, y, name, sub, on) => R(x - 13, y, 26, 40, 'coil' + (on ? ' on' : ''), 3) + T(x + 19, y + 19, name, 'b') + (sub ? T(x + 19, y + 34, sub, 'm') : '');
  /* Welche Wege führen Strom? p: mode (sh, wende), vorrang (aus, ein), verr, netz, k1, k2, s1, s2, s3 */
  function shLive(p) {
    const n = p.netz !== false, a = n && !p.s2;
    if (p.mode === 'wende') {
      const v = p.verr !== false, b1 = a && !!(p.s1 || p.k1), b2 = a && !!(p.s3 || p.k2);
      return { n, a, b1, b2, c1: b1 && !(v && p.k2), c2: b2 && !(v && p.k1) };
    }
    if (p.vorrang === 'ein') { const r = a, s = n && !!p.s1, k = r && !!p.k1, b = s || k; return { n, a: r, s, k, b, c: b }; }
    const s = a && !!p.s1, k = a && !!p.k1, b = s || k; return { n, a, s, k, b, c: b };
  }
  const motor = (x, y, run, dir, bad) => O(x, y, 28, 'box' + (run ? ' on' : '') + (bad ? ' bad' : '')) + T(x, y + 5, 'M', 'b mid') +
    (run ? `<g class="spin${dir < 0 ? ' l' : ''}">${`<path class="w on" d="M ${q(x + 17)} ${q(y - 6)} A 18 18 0 1 1 ${q(x - 4)} ${q(y - 17.5)}" /><polygon class="ac" points="${q(x - 12)},${q(y - 22)} ${q(x - 2)},${q(y - 12)} ${q(x - 1)},${q(y - 25)}"/>`}</g>` : '');
  function sh(p) {
    const v = shLive(p), n = v.n;
    if (p.mode === 'wende') {
      const o = p.verr !== false, both = !!(p.k1 && p.k2), run = !!(p.k1 !== p.k2), dir = p.k1 ? 1 : -1;
      let b = wire([[30, 24], [300, 24]], n) + wire([[30, 276], [300, 276]], n) + T(30, 14, '+24 V', 'b') + T(30, 296, '0 V', 'b');
      b += wire([[165, 24], [165, 34]], n) + sw(165, 34, 'nc', !p.s2, 'S2', '', true, p.s2) + wire([[165, 74], [165, 88]], v.a) + wire([[40, 88], [290, 88]], v.a);
      [[40, 'S1', p.s1, 'no', 1], [235, 'S3', p.s3, 'no', 2]].forEach(s => { b += wire([[s[0], 88], [s[0], 100]], v.a) + sw(s[0], 100, 'no', !!s[2], s[1], '', true, !!s[2]) + wire([[s[0], 140], [s[0], 154]], v.a && !!s[2]); });
      [[95, 'K1', p.k1, 1], [290, 'K2', p.k2, 2]].forEach(s => { b += wire([[s[0], 88], [s[0], 100]], v.a) + sw(s[0], 100, 'no', !!s[2], s[1], '13/14') + wire([[s[0], 140], [s[0], 154]], v.a && !!s[2]); });
      [[67, v.b1, v.c1, 'K2', p.k2, 'K1', p.k1, 40, 95], [262, v.b2, v.c2, 'K1', p.k1, 'K2', p.k2, 235, 290]].forEach(s => {
        b += wire([[s[7], 154], [s[8], 154]], s[1]) + wire([[s[0], 154], [s[0], o ? 166 : 214]], s[1]);
        if (o) b += sw(s[0], 166, 'nc', !s[4], s[3], '21/22') + wire([[s[0], 206], [s[0], 214]], s[2]);
        b += coil(s[0], 214, s[5], '', s[6]) + wire([[s[0], 254], [s[0], 276]], s[2]);
      });
      b += motor(165, 200, run, dir, both) + T(165, 248, both ? 'Kurzschluss!' : run ? (dir > 0 ? 'Rechtslauf' : 'Linkslauf') : 'Stillstand', 'b mid' + (both ? ' bd' : '')) + (both ? T(165, 264, 'K1 und K2 zugleich', 'b mid bd') : '');
      b += T(20, 322, 'S1 Rechts, S2 Aus, S3 Links', 'm') + T(20, 340, 'K1 Rechtslauf, K2 Linkslauf', 'm');
      return svg(350, 'Stromlaufplan der Wendeschaltung mit Verriegelung', b);
    }
    const ein = p.vorrang === 'ein', k = !!p.k1;
    let b = wire([[40, 24], [170, 24]], n) + wire([[40, 276], [170, 276]], n) + T(40, 14, '+24 V', 'b') + T(40, 296, '0 V', 'b');
    if (!ein) {
      b += wire([[105, 24], [105, 36]], n) + sw(105, 36, 'nc', !p.s2, 'S2', 'Aus', true, p.s2) + wire([[105, 76], [105, 90]], v.a) + wire([[65, 90], [145, 90]], v.a) + wire([[65, 90], [65, 100]], v.a) + wire([[145, 90], [145, 100]], v.a);
      b += sw(65, 100, 'no', !!p.s1, 'S1', 'Ein', true, p.s1) + sw(145, 100, 'no', k, 'K1', '13/14') + wire([[65, 140], [65, 154]], v.s) + wire([[145, 140], [145, 154]], v.k) + wire([[65, 154], [145, 154]], v.b) + wire([[105, 154], [105, 190]], v.b);
    } else {
      b += wire([[105, 24], [105, 48]], n) + wire([[65, 48], [145, 48]], n) + wire([[65, 48], [65, 100]], n) + sw(65, 100, 'no', !!p.s1, 'S1', 'Ein', true, p.s1) + wire([[65, 140], [65, 172]], v.s);
      b += wire([[145, 48], [145, 60]], n) + sw(145, 60, 'nc', !p.s2, 'S2', 'Aus', true, p.s2) + wire([[145, 100], [145, 112]], v.a) + sw(145, 112, 'no', k, 'K1', '13/14') + wire([[145, 152], [145, 172]], v.k) + wire([[65, 172], [145, 172]], v.b) + wire([[105, 172], [105, 190]], v.b);
    }
    b += coil(105, 190, 'K1', 'Schütz', k) + wire([[105, 230], [105, 276]], v.c);
    b += T(290, 16, 'Hauptstromkreis', 'b mid') + T(300, 52, 'L1', 'm') + wire([[290, 26], [290, 70]], n) + sw(290, 70, 'no', k, 'K1', '1/2') + wire([[290, 110], [290, 144]], n && k) + motor(290, 172, n && k, 1, false) + wire([[290, 200], [290, 276]], n && k) + T(300, 262, 'N', 'm');
    b += `<polyline class="cp" points="${pts([[118, 210], [235, 210], [235, 90], [284, 90]])}"/>`;
    return svg(310, 'Stromlaufplan der Selbsthaltung mit ' + (ein ? 'Ein' : 'Aus') + '-Vorrang', b);
  }

  /* ============================================================ Funktionsbaustein mit Zeitdiagramm */
  const BNAME = { und: ['&', ''], oder: ['≥1', ''], sr: ['RS', 'Rücksetzen vorrangig'], ton: ['TON', 'Einschaltverzögerung'], tof: ['TOF', 'Ausschaltverzögerung'], wisch: ['Wischer', 'Impuls fester Länge'], zaehl: ['Zähler', ''] };
  const FPORT = { sr: ['S', 'R'], zaehl: ['+1', 'R'] };
  function fup(p) {
    const tEnd = p.tEnd || 16, tr = C.fupTrace(p.prog, { T: p.T, S: p.S, mode: p.mode }, p.ev, tEnd), dt = tr.dt, k = Math.min(tr.t.length - 1, Math.max(0, Math.round((p.tNow || 0) / dt)));
    const two = p.prog !== 'ton' && p.prog !== 'tof' && p.prog !== 'wisch', tim = !two, zz = p.prog === 'zaehl', nm = BNAME[p.prog] || ['?', ''];
    const i1 = tr.i1[k], i2 = tr.i2[k], qq = tr.q[k], e = tr.e[k], z = tr.z[k];
    let b = wire([[60, 45], [135, 45]], !!i1) + T(20, 50, 'I1', 'b') + R(135, 22, 110, 94, 'box' + (qq ? ' on' : ''), 8) + wire([[245, 69], [316, 69]], !!qq) + T(326, 74, 'Q', 'b') + O(316, 69, 4, 'led' + (qq ? ' on' : ''));
    if (two) b += wire([[60, 94], [135, 94]], !!i2) + T(20, 99, 'I2', 'b');
    const pr = FPORT[p.prog]; if (pr) b += T(142, 50, pr[0], 'm') + T(142, 99, pr[1], 'm');
    b += T(190, 58, nm[0], 'b mid ac') + T(190, 78, zz ? 'Z = ' + z + ' von ' + p.S : tim ? 'T = ' + f(p.T, 1) + ' s' : nm[1], 'mid');
    if (tim) b += R(147, 94, 86, 8, 'box') + R(147, 94, 86 * e, 8, 'fil gr') + R(147, 94, 86 * e, 8, 'fil');
    if (!tim && !zz) b += T(190, 98, p.prog === 'sr' ? 'S gegen R' : '', 'mid m');
    const x0 = 52, x1 = 362, px = t => x0 + t / tEnd * (x1 - x0), rows = [['I1', tr.i1, 142], ['I2', tr.i2, 184], ['Q', tr.q, 226]].filter(r => two || r[0] !== 'I2'), top = 134;
    for (let t = 0; t <= tEnd; t += 2) b += L(px(t), top, px(t), 296, 'grid');
    rows.forEach((r, i) => {
      const y = top + 8 + i * 42, hi = y, lo = y + 26; let a = [], last = null;
      for (let j = 0; j <= k; j++) { const v = r[1][j], yy = v ? hi : lo; if (last !== null && last !== yy) a.push([px(tr.t[j]), last]); a.push([px(tr.t[j]), yy]); last = yy; }
      b += T(14, y + 20, r[0], 'b') + L(x0, lo, x1, lo, 'ax');
      if (r[0] === 'Q' && r[1].slice(0, k + 1).some(Boolean)) b += `<polygon class="fil gr" points="${pts([[a[0][0], lo]].concat(a, [[a[a.length - 1][0], lo]]))}"/>`;
      if (a.length) b += `<polyline class="tr${r[0] === 'Q' ? ' q' : ''}" points="${pts(a)}"/>`;
    });
    if (zz) {
      let lastZ = null; const y = top + 8 + rows.length * 42; b += T(14, y + 20, 'Z', 'b') + L(x0, y + 26, x1, y + 26, 'ax');
      for (let j = 0; j <= k; j++) if (tr.z[j] !== lastZ) { b += T(px(tr.t[j]) + 2, y + 20, String(tr.z[j]), 'b'); lastZ = tr.z[j]; }
    }
    b += L(px(tr.t[k]), top - 4, px(tr.t[k]), 298, 'cur');
    for (let t = 0; t <= tEnd; t += 4) b += T(px(t), 316, t === tEnd ? t + ' s' : String(t), 'm mid');
    return svg(326, 'Funktionsbaustein ' + nm[0] + ' mit Zeitdiagramm', b);
  }

  /* ============================================================ Elektropneumatik */
  function ep(p) {
    const x = C.clamp(p.x, 0, 1), dir = p.dir ? 1 : 0, b1 = C.epB1(x), b2 = C.epB2(x), bi = p.ventil === 'bi', y1 = !!p.y1, y2 = !!p.y2;
    const x0 = 60, y0 = 70, bw = 180, bh = 40, xp = x0 + 4 + x * (bw - 18);
    let b = R(x0, y0, bw, bh, 'box', 5) + R(xp, y0 + 3, 10, bh - 6, 'pst', 2) + R(xp + 10, y0 + bh / 2 - 3, 100, 6, 'rod') + R(xp + 110, y0 + 5, 14, bh - 10, 'obj') + T(xp + 117, y0 - 6, 'Last', 'm mid');
    [[x0 + 14, 'B1', b1, 'B1 hinten'], [x0 + bw - 40, 'B2', b2, 'B2 vorn']].forEach(s => { b += R(s[0] - 10, 38, 22, 16, 'box' + (s[2] ? ' on' : ''), 3) + O(s[0] + 1, 46, 4, 'led' + (s[2] ? ' on' : '')) + L(s[0] + 1, 54, s[0] + 1, y0, 'cp') + T(s[0] + 1, 30, s[3], 'b mid'); });
    const vx = 100, vy = 152, rear = [[122, vy], [122, 132], [x0 + 16, 132], [x0 + 16, y0 + bh]], front = [[178, vy], [178, 132], [x0 + bw - 16, 132], [x0 + bw - 16, y0 + bh]];
    b += `<polyline class="pip${dir ? ' on' : ' ex'}" points="${pts(rear)}"/><polyline class="pip${dir ? ' ex' : ' on'}" points="${pts(front)}"/>`;
    b += R(vx, vy, 100, 50, 'box' + (y1 || y2 || (bi && dir) ? ' on' : ''), 4) + (dir ? `<polyline class="pip on" points="${pts([[150, 202], [150, 177], [122, 177], [122, 152]])}"/><polyline class="pip ex" points="${pts([[178, 152], [178, 202]])}"/>` : `<polyline class="pip on" points="${pts([[150, 202], [150, 177], [178, 177], [178, 152]])}"/><polyline class="pip ex" points="${pts([[122, 152], [122, 202]])}"/>`);
    b += T(122, 146, '4', 'm mid') + T(178, 146, '2', 'm mid') + T(122, 220, '5', 'm mid') + T(160, 222, '1', 'm') + T(178, 220, '3', 'm mid');
    b += R(66, vy + 8, 34, 34, 'coil' + (y1 || (bi && dir) ? ' on' : ''), 3) + T(83, vy + 30, 'Y1', 'b mid') + T(83, vy + 56, '14', 'm mid');
    b += bi ? R(200, vy + 8, 34, 34, 'coil' + (y2 || (bi && !dir) ? ' on' : ''), 3) + T(217, vy + 30, 'Y2', 'b mid') + T(217, vy + 56, '12', 'm mid') : `<polyline class="sym" points="${pts([[200, vy + 25], [208, vy + 15], [216, vy + 35], [224, vy + 15], [232, vy + 25]])}"/>` + T(216, vy + 56, 'Feder', 'm mid');
    b += wire([[150, 202], [150, 240]], true) + T(150, 258, 'Druckluft', 'b mid');
    b += T(20, 292, bi ? 'bistabil: merkt sich die Stellung' : 'monostabil: Feder stellt zurück', 'm');
    return svg(304, 'Doppelt wirkender Zylinder mit ' + (bi ? 'bistabilem' : 'monostabilem') + ' 5/2-Ventil, Kolben bei ' + f(x * 100, 0) + ' Prozent des Hubs', b);
  }

  /* ============================================================ Sensor am Eingang */
  function sen(p) {
    const pr = C.PRINZ[p.prinz] || C.PRINZ.ind, sr = C.srOf(p.prinz, p.mat), d = fin(p.d) ? p.d : 0, on = !!p.aktiv, s = C.sensorSim({ typ: p.typ, fkt: p.fkt, aktiv: on, fehler: p.fehler });
    const sc = 7, xs = 112, xo = xs + d * sc, bad = k => p.fehler === k;
    let b = R(30, 26, 82, 32, 'box' + (s.led ? ' on' : ''), 6) + R(112, 30, 6, 24, 'box on') + O(100, 42, 5, 'led' + (s.led ? ' on' : '')) + T(40, 47, (p.typ || 'pnp').toUpperCase() + (p.fkt === 'o' ? ' Ö' : ' S'), 'b');
    b += R(xo, 24, 34, 36, 'obj ' + (p.mat || '')) + T(xo + 17, 17, C.MAT[p.mat] || '', 'm mid');
    b += L(xs, 84, xs + 20 * sc, 84, 'ax');
    for (let m = 0; m <= 20; m += 5) b += L(xs + m * sc, 80, xs + m * sc, 88, 'ax') + T(xs + m * sc, 104, String(m), 'm mid');
    b += T(xs + 20 * sc + 8, 90, 'mm', 'm');
    if (sr > 0) b += L(xs + sr * sc, 62, xs + sr * sc, 94, 'zone') + T(xs + sr * sc, 122, 'Sr ' + f(sr, 1), 'b mid ac');
    else b += T(xs, 122, 'Dieser Werkstoff wird nicht erkannt', 'm');
    /* Adern: braun, blau, schwarz; jede Ader hat eine eigene Querlinie, dann gibt es keine Kreuzungen */
    const col = [['braun', 36, 70, 170], ['blau', 50, 150, 154], ['schwarz', 64, 230, 138]], my = { braun: 96, blau: 112, schwarz: 128 };
    const live = { braun: p.fehler !== 'braun', blau: p.fehler !== 'blau' && p.fehler !== 'braun', schwarz: s.schwarz > 0 && p.fehler !== 'schwarz' };
    col.forEach(c => {
      const pl = pts([[c[1], 58], [c[1], c[3]], [c[2], c[3]], [c[2], 190]]), on = live[c[0]] && !bad(c[0]);
      b += (on ? `<polyline class="halo" points="${pl}"/>` : '') + `<polyline class="ader ${c[0]}" points="${pl}"/>` + (on ? `<polyline class="fl" points="${pl}"/>` : '') + T(c[2] + 8, 184, c[0], 'm');
      if (bad(c[0])) b += mark(c[1], my[c[0]]);
    });
    b += R(20, 190, 340, 100, 'box', 8) + T(30, 208, 'Kleinsteuerung', 'b');
    [['+24 V', 70, 24], ['0 V', 150, 0], ['E1', 230, s.eingang]].forEach(t => { b += O(t[1], 190, 4, 'led on') + T(t[1], 232, t[0], 'b mid') + T(t[1], 252, f(t[2], 0) + ' V', 'mid' + (t[0] === 'E1' ? ' ac' : '')); });
    b += O(318, 232, 10, 'led' + (s.eingangLed ? ' on' : '')) + T(318, 264, 'LED E1', 'm mid') + T(318, 280, s.wert === 1 ? 'Pegel 1' : s.wert === 0 ? 'Pegel 0' : 'undefiniert', 'b mid');
    b += T(362, 122, s.led ? 'Sensor-LED an' : 'Sensor-LED aus', 'b end' + (s.led ? ' gr' : ' m'));
    return svg(300, 'Sensor mit Werkstück im Abstand von ' + f(d, 1) + ' Millimetern, Eingang ' + (s.eingangLed ? 'an' : 'aus'), b);
  }

  root.KSP_VIZ = { CSS, shLive, sh, fup, ep, sen };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.KSP_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
