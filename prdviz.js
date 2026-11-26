'use strict';
/* Tonfunk Produktions-Lab: Bilder (Lab-Kennung 'prd'). Wird in prdlab.html VOR prdui.js geladen.
   Reine Zeichenfunktionen: liefern SVG-Text ohne DOM (testbar mit node quelle/prd/test_prdviz.js), '' bei ungültigen Werten.
   Bewegung nur per CSS (Klassen pv-*, Keyframes in prdlab.html), bei prefers-reduced-motion: reduce steht alles still.
   Teile mit data-m="…" verschiebt prdui.js beim Verstellen weich (nur style="transform:…" wird ersetzt, CSS-Übergang).
   Farben nur über die CSS-Variablen der Seite (hell und dunkel). Alle Zahlen sind Übungswerte im Modellbetrieb. */
(function (root) {
  const C = root.PRD_CORE || (typeof require === 'function' ? require('./prdcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, anchor) => `<text class="${cls || 'g-lab'}" x="${q(x)}" y="${q(y)}"${anchor ? ' text-anchor="' + anchor + '"' : ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg class="prdv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  /* verschiebbares Teil: Lage über style, damit der CSS-Übergang greift */
  const mv = (id, x, y, body, sx) => `<g data-m="${id}" style="transform:translate(${q(x)}px,${q(y)}px)${sx != null ? ' scale(' + Math.max(0, Math.round(sx * 100) / 100) + ',1)' : ''}">${body}</g>`;
  const piece = (cls) => `<rect class="${cls || 'pv-pc'}" x="-7" y="-7" width="14" height="14" rx="2"/>`;
  const run = (x, y, len, dur, delay, cls) => `<g transform="translate(${q(x)} ${q(y)})"><g class="pv-run" style="--L:${q(len)}px;animation-duration:${q(dur)}s;animation-delay:${q(-delay)}s">${piece(cls)}</g></g>`;

  /* ============================================================ Hallen-Skizzen der Organisationstypen */
  /* Maschine als Kasten mit erkennbarem Werkzeug-Symbol statt Text (Bohrer, Lötkolben, Lupe, Schraube, Chip, Karton) */
  const P = d => `<path class="pv-sym" d="${d}"/>`, PF = d => `<path class="pv-sym f" d="${d}"/>`;
  const SYM = {
    Bohren: (x, y) => PF(`M${x + 20} ${y + 5}h16v7h-16z`) + P(`M${x + 28} ${y + 12}v11`) + PF(`M${x + 24} ${y + 23}h8l-4 7z`),
    'Löten': (x, y) => `<path class="pv-sym w" d="M${x + 10} ${y + 8}L${x + 30} ${y + 20}"/>` + P(`M${x + 30} ${y + 20}L${x + 44} ${y + 28}`) + `<circle class="pv-sym f" cx="${x + 46}" cy="${y + 30}" r="2"/>`,
    'Prüfen': (x, y) => `<circle class="pv-sym" cx="${x + 25}" cy="${y + 15}" r="8"/>` + `<path class="pv-sym w" d="M${x + 31} ${y + 21}L${x + 39} ${y + 29}"/>`,
    Montieren: (x, y) => `<circle class="pv-sym" cx="${x + 28}" cy="${y + 17}" r="11"/>` + P(`M${x + 21} ${y + 17}h14M${x + 28} ${y + 10}v14`),
    'Bestücken': (x, y) => PF(`M${x + 20} ${y + 9}h16v16h-16z`) + P(`M${x + 15} ${y + 12}h5M${x + 15} ${y + 17}h5M${x + 15} ${y + 22}h5M${x + 36} ${y + 12}h5M${x + 36} ${y + 17}h5M${x + 36} ${y + 22}h5`),
    Verpacken: (x, y) => P(`M${x + 17} ${y + 11}h22v18h-22zM${x + 28} ${y + 11}v18M${x + 17} ${y + 11}l4 -5h14l4 5`)
  };
  const MACH = (x, y, t, cls) => R(x, y, 56, 34, cls || 'pv-m', 5) + (SYM[t] ? SYM[t](x, y) : T(x + 28, y + 22, t, 'g-lab s', 'middle'));
  function hallSvg(type) {
    const W = 480, H = 230; let b = R(6, 6, W - 12, H - 12, 'pv-hall', 10), path = '', lab = '';
    if (type === 'werk') {
      const rooms = [[20, 22, 'Bohrerei', 'Bohren'], [250, 22, 'Lötraum', 'Löten'], [20, 126, 'Prüffeld', 'Prüfen'], [250, 126, 'Montage', 'Montieren']];
      rooms.forEach(r => { b += R(r[0], r[1], 210, 86, 'pv-room', 8) + T(r[0] + 10, r[1] + 16, r[2], 'g-lab m') + MACH(r[0] + 18, r[1] + 36, r[3]) + MACH(r[0] + 86, r[1] + 36, r[3]) + MACH(r[0] + 150, r[1] + 36, r[3]); });
      path = 'M60 80 C140 120 280 60 320 80 S120 190 90 170 S360 210 330 170';
      lab = 'Werkstattfertigung: gleiche Maschinen in einem Raum, der Auftrag wandert kreuz und quer';
    } else if (type === 'fliess') {
      b += L(20, 150, 460, 150, 'pv-belt') + L(20, 166, 460, 166, 'pv-belt');
      ['Bestücken', 'Löten', 'Prüfen', 'Montieren', 'Verpacken'].forEach((n, i) => { b += MACH(28 + i * 88, 82, n) + T(56 + i * 88, 72, (i + 1) + '.', 'g-lab m', 'middle') + T(56 + i * 88, 134, n, 'g-lab s', 'middle'); });
      for (let i = 0; i < 6; i++) b += run(26, 158, 430, 9, i * 1.5);
      b += T(240, 206, 'fester Takt, Plätze in der Reihenfolge der Arbeitsgänge', 'g-lab m', 'middle');
      lab = 'Fließfertigung: Arbeitsplätze in der Reihenfolge der Arbeitsgänge, das Band bringt jedes Stück im Takt weiter';
    } else if (type === 'gruppe') {
      b += `<circle class="pv-room" cx="240" cy="118" r="92"/>` + T(240, 40, 'Fertigungsinsel', 'g-lab m', 'middle');
      [[240, 52, 'Bestücken'], [318, 140, 'Löten'], [162, 140, 'Prüfen']].forEach(p => { b += MACH(p[0] - 28, p[1] - 17, p[2]) + T(p[0], p[1] + 32, p[2], 'g-lab s', 'middle'); });
      [[200, 100], [280, 100], [240, 178], [226, 118], [256, 128]].forEach(p => { b += `<circle class="pv-man" cx="${p[0]}" cy="${p[1]}" r="7"/>`; });
      path = 'M240 70 A60 60 0 1 1 239.9 70';
      b += T(410, 60, 'Team plant', 'g-lab', 'middle') + T(410, 78, 'selbst', 'g-lab', 'middle') + T(410, 180, 'ganzes Teil', 'g-lab', 'middle') + T(410, 198, 'aus einer Hand', 'g-lab', 'middle');
      lab = 'Gruppenfertigung: Ein Team fertigt an einer Insel das ganze Teil';
    } else if (type === 'bau') {
      b += R(180, 76, 120, 78, 'pv-big', 8) + T(240, 112, 'Schaltanlage', 'g-lab', 'middle') + T(240, 130, 'steht fest', 'g-lab m', 'middle');
      [[40, 40, 'Leute'], [40, 190, 'Material'], [440, 40, 'Werkzeug'], [440, 190, 'Prüfgerät']].forEach(p => { b += T(p[0], p[1], p[2], 'g-lab', 'middle') + `<path class="pv-flow" d="M${p[0]} ${p[1] + (p[1] < 100 ? 10 : -16)} L${p[0] < 240 ? 178 : 302} ${p[1] < 100 ? 84 : 146}"/>`; });
      b += T(240, 212, 'beim Kunden vor Ort: alles kommt zum Erzeugnis', 'g-lab m', 'middle');
      lab = 'Baustellenfertigung: Das Erzeugnis steht fest, Menschen, Maschinen und Material kommen zu ihm';
    } else return '';
    if (path) b += `<path class="pv-way" d="${path}"/><g class="pv-along" style="offset-path:path('${path}')">${piece('pv-pc hi')}</g>`;
    return svg(W, H, lab, b);
  }

  /* ============================================================ Fertigungslinie mit Engpass und Stau
     rows: [{n, bedarf (h), angebot (h)}] */
  function lineSvg(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 5 || !rows.every(r => fin(r.bedarf) && fin(r.angebot) && r.angebot > 0 && r.bedarf >= 0)) return '';
    const n = rows.length, W = 660, H = 250, gap = (W - 40) / n, bw = Math.min(112, gap - 26), y0 = 150;
    const g = rows.map(r => C.beschGrad(r.bedarf, r.angebot)), gmax = Math.max.apply(null, g), ei = g.indexOf(gmax);
    const cx = i => 20 + gap * i + gap / 2;
    let b = L(8, y0, W - 8, y0, 'pv-belt') + L(8, y0 + 16, W - 8, y0 + 16, 'pv-belt');
    /* Teile laufen; vor dem Engpass langsam und dicht, danach so viel, wie der Engpass durchlässt */
    const slow = Math.max(1, gmax / 100);
    for (let i = 0; i <= n; i++) {
      const xa = i === 0 ? 10 : cx(i - 1) + bw / 2 + 6, xb = i === n ? W - 10 : cx(i) - bw / 2 - 6, len = xb - xa;
      if (len < 20) continue;
      const before = i <= ei, k = before ? 3 : 2, dur = (before ? 3.2 * slow : 3.2) * len / 120;
      for (let j = 0; j < k; j++) b += run(xa, y0 + 8, len - 8, dur, dur * j / k, before ? 'pv-pc' : 'pv-pc ok');
    }
    rows.forEach((r, i) => {
      const x = cx(i) - bw / 2, gr = g[i], cls = gr > 100 ? 'bad' : gr >= 85 ? 'warn' : 'ok';
      b += R(x, 52, bw, 84, 'pv-st' + (i === ei ? ' eng' : ''), 8) + T(cx(i), 70, r.n, 'g-lab', 'middle');
      b += R(x + 10, 80, bw - 20, 12, 'pv-gbg', 6) + mv('g' + i, x + 10, 80, `<rect class="pv-g ${cls}" x="0" y="0" width="1" height="12"/>`, (bw - 20) * Math.min(gr, 130) / 130);
      b += T(cx(i), 112, f(gr, 0) + ' %', 'g-lab b', 'middle') + T(cx(i), 128, f(r.bedarf, 0) + ' / ' + f(r.angebot, 0) + ' h', 'g-lab m', 'middle');
    });
    /* Stau vor dem Engpass: je mehr Überlast, desto mehr wartende Stücke */
    const qn = Math.max(0, Math.min(10, Math.round((gmax - 75) / 5))), qx = cx(ei) - bw / 2 - 12;
    for (let j = 0; j < qn; j++) b += `<g transform="translate(${q(qx - (j % 5) * 15)} ${q(y0 + 8 + Math.floor(j / 5) * 22)})"><g class="pv-wait" style="animation-delay:${q(-j * 0.17)}s">${piece('pv-pc bad')}</g></g>`;
    if (qn) b += T(Math.max(36, qx - 30), y0 + 56, 'Stau', 'g-lab bad', 'middle');
    b += T(cx(ei), 40, gmax > 100 ? 'Engpass (Überlast)' : 'Engpass', 'g-lab ' + (gmax > 100 ? 'bad' : 'b'), 'middle');
    b += T(W / 2, H - 14, 'Die Linie schafft nur so viel wie die Station mit der höchsten Auslastung.', 'g-lab m', 'middle');
    return svg(W, H, 'Fertigungslinie: Stationen mit Auslastung, Werkstücke laufen, Stau vor dem Engpass ' + rows[ei].n, b);
  }

  /* ============================================================ Losgröße: Kostenkurven mit wanderndem Minimum
     Achsen springen nur in groben Stufen (1, 2, 5 · 10^n), damit das Minimum beim Verstellen sichtbar wandert */
  const nice = v => { const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(k => k * e).find(k => k >= v); };
  function costSvg(p) {
    if (!p || ![p.B, p.R, p.p, p.z, p.x].every(v => fin(v) && v > 0)) return '';
    const xo = C.andler(p.B, p.R, p.p, p.z); if (!fin(xo) || xo <= 0) return '';
    const W = 640, H = 300, x0 = 70, x1 = 620, y0 = 250, y1 = 22;
    const K = x => C.losKosten(p.B, p.R, p.p, p.z, x), xm = nice(Math.max(xo * 2, p.x) * 1.15), ym = nice(K(xo).ges * 2);
    const sx = x => x0 + x / xm * (x1 - x0), sy = v => y0 - Math.min(v, ym) / ym * (y0 - y1);
    let b = '';
    for (let i = 0; i <= 4; i++) { const v = ym * i / 4, y = sy(v); b += L(x0, y, x1, y, 'g-grid') + T(x0 - 6, y + 4, f(v, 0) + ' €', 'g-lab m', 'end'); }
    for (let i = 0; i <= 5; i++) { const x = xm * i / 5; b += T(sx(x), y0 + 18, f(x, 0), 'g-lab m', 'middle'); }
    b += L(x0, y0, x1, y0, 'g-ax') + L(x0, y0, x0, y1, 'g-ax');
    const pts = k => { const a = []; for (let i = 1; i <= 80; i++) { const x = xm * i / 80, v = K(x)[k]; a.push(q(sx(x)) + ',' + q(sy(v))); } return a.join(' '); };
    b += `<polyline data-p="r" class="g-cb" points="${pts('ruest')}"/><polyline data-p="l" class="g-cl" points="${pts('lager')}"/><polyline data-p="g" class="g-cg" points="${pts('ges')}"/>`;
    const ko = K(xo), kx = K(p.x);
    b += mv('opt', sx(xo), sy(ko.ges), `<line class="g-opt" x1="0" y1="0" x2="0" y2="${q(y0 - sy(ko.ges))}"/><circle class="pv-min" r="8"/><circle class="pv-ring" r="8"/>`);
    b += mv('cur', sx(p.x), sy(kx.ges), `<circle class="pv-cur" r="6"/>`);
    b += mv('optT', Math.min(sx(xo), x1 - 120), sy(ko.ges) - 16, T(0, 0, 'Minimum ' + f(xo, 0) + ' Stück', 'g-lab b', 'start'));
    b += `<g class="pv-leg">${R(x1 - 186, y1, 10, 10, 'pv-k r')}${T(x1 - 170, y1 + 9, 'Rüstkosten', 'g-lab')}${R(x1 - 186, y1 + 16, 10, 10, 'pv-k l')}${T(x1 - 170, y1 + 25, 'Lagerkosten', 'g-lab')}${R(x1 - 186, y1 + 32, 10, 10, 'pv-k g')}${T(x1 - 170, y1 + 41, 'Summe', 'g-lab')}</g>`;
    b += T((x0 + x1) / 2, H - 6, 'Losgröße in Stück (Punkt = deine Losgröße)', 'g-lab m', 'middle');
    return svg(W, H, 'Rüst-, Lager- und Gesamtkosten je Jahr über der Losgröße, Minimum bei ' + f(xo, 0) + ' Stück', b);
  }

  /* ============================================================ Balkenplan (Gantt), Balken verschieben sich
     ops wie PRD_CORE.durchlauf; mode 'v' (ab Start s) oder 'r' (bis Termin T) */
  function ganttSvg(ops, menge, mode, s, Tt) {
    if (!Array.isArray(ops) || !ops.length || ops.length > 5 || !(menge > 0) || !fin(Tt) || !fin(s)) return '';
    if (!ops.every(o => [o.tr, o.te, o.ue].every(v => fin(v) && v >= 0))) return '';
    const plan = mode === 'r' ? C.rueckwaerts(ops, menge, Tt) : C.vorwaerts(ops, menge, s);
    if (!plan || !plan.ops || !plan.ops.every(o => fin(o.ueStart) && fin(o.ende))) return '';
    const lo = Math.min(0, plan.ops[0].ueStart), hi = Math.max(Tt, plan.ops[plan.ops.length - 1].ende), span = Math.max(8, Math.ceil((hi - lo) / 8) * 8 + 8);
    const W = 660, x0 = 96, x1 = 640, rowH = 34, y0 = 34, H = y0 + ops.length * rowH + 46, sx = t => x0 + (t - lo) / span * (x1 - x0), k = (x1 - x0) / span;
    let b = '';
    const step = span > 64 ? 16 : 8;
    for (let t = Math.ceil(lo / step) * step; t <= lo + span; t += step) b += L(sx(t), y0 - 6, sx(t), y0 + ops.length * rowH, 'g-grid') + T(sx(t), y0 - 10, f(t, 0) + ' h', 'g-lab m', 'middle');
    plan.ops.forEach((o, i) => {
      const y = y0 + i * rowH + 6;
      b += T(x0 - 8, y + 16, o.n, 'g-lab', 'end');
      b += mv('u' + i, sx(o.ueStart), y + 6, `<rect class="pv-ue" x="0" y="0" width="1" height="12"/>`, (o.start - o.ueStart) * k);
      b += mv('b' + i, sx(o.start), y, `<rect class="pv-bar" x="0" y="0" width="1" height="24" rx="0"/>`, (o.ende - o.start) * k);
    });
    const end = plan.ops[plan.ops.length - 1].ende, beg = plan.ops[0].ueStart, puf = Tt - end, yb = y0 + ops.length * rowH;
    b += mv('dl', sx(Tt), 0, `<line class="pv-dl" x1="0" y1="${y0 - 4}" x2="0" y2="${yb + 4}"/>`) + mv('dlT', sx(Tt), 0, T(0, yb + 20, 'Liefertermin', 'g-lab bad', 'middle'));
    if (mode !== 'r') b += mv('pf', sx(Math.min(end, Tt)), yb - 8, `<rect class="pv-puf ${puf < 0 ? 'bad' : 'ok'}" x="0" y="0" width="1" height="6"/>`, Math.abs(puf) * k);
    else b += mv('st', sx(beg), 0, `<line class="pv-now" x1="0" y1="${y0 - 4}" x2="0" y2="${yb + 4}"/>`);
    b += `<g class="pv-scan" style="--L:${q(x1 - x0)}px"><line class="pv-sc" x1="${x0}" y1="${y0 - 4}" x2="${x0}" y2="${yb}"/></g>`;
    b += T(x0, H - 6, mode === 'r' ? 'Rückwärts: grüne Linie = spätester Beginn' : 'Vorwärts: Strich unten = Puffer', 'g-lab m', 'start');
    return svg(W, H, 'Balkenplan der Arbeitsgänge, ' + (mode === 'r' ? 'Rückwärtsterminierung' : 'Vorwärtsterminierung'), b);
  }

  /* ============================================================ Kanban-Kreislauf: Karten laufen im Kreis */
  function kanbanSvg(n, jeBeh) {
    if (!Number.isInteger(n) || n < 1 || !(jeBeh > 0)) return '';
    const W = 560, H = 250, cx = 280, cy = 125, r = 82, shown = Math.min(n, 12), dur = 14;
    let b = `<circle class="pv-loop" cx="${cx}" cy="${cy}" r="${r}"/>`;
    b += R(18, cy - 40, 150, 80, 'pv-st', 10) + T(93, cy - 14, 'Lieferplatz', 'g-lab b', 'middle') + T(93, cy + 6, '(Lager, Supermarkt)', 'g-lab m', 'middle') + T(93, cy + 26, 'füllt nach', 'g-lab m', 'middle');
    b += R(W - 168, cy - 40, 150, 80, 'pv-st', 10) + T(W - 93, cy - 14, 'Lötplatz', 'g-lab b', 'middle') + T(W - 93, cy + 6, 'verbraucht', 'g-lab m', 'middle') + T(W - 93, cy + 26, f(jeBeh, 0) + ' Stück je Behälter', 'g-lab m', 'middle');
    b += T(cx, cy - r - 12, 'voller Behälter mit Karte', 'g-lab m', 'middle') + T(cx, cy + r + 22, 'leerer Behälter: Karte holt Nachschub', 'g-lab m', 'middle');
    for (let i = 0; i < shown; i++) b += `<g transform="translate(${cx} ${cy})"><g class="pv-spin" style="animation-duration:${dur}s;animation-delay:${q(-dur * i / shown)}s"><g transform="translate(0 ${-r})"><g class="pv-unspin" style="animation-duration:${dur}s;animation-delay:${q(-dur * i / shown)}s"><rect class="pv-card" x="-13" y="-9" width="26" height="18" rx="3"/><line class="pv-cl" x1="-8" y1="-2" x2="8" y2="-2"/><line class="pv-cl" x1="-8" y1="3" x2="4" y2="3"/></g></g></g></g>`;
    b += T(cx, cy + 6, f(n, 0) + ' Karten', 'g-lab b', 'middle');
    if (n > shown) b += T(cx, cy + 24, '(12 gezeigt)', 'g-lab m', 'middle');
    return svg(W, H, 'Kanban-Kreislauf mit ' + n + ' Karten zwischen Lieferplatz und Lötplatz', b);
  }

  /* ============================================================ Bilder in der Aufgabenansicht (je Thema eines, ohne Ergebnis) */
  function taskPic(cat) {
    const W = 360, H = 120; let b = '', lab = '';
    if (cat === 0) {
      const box = (x, y) => R(x, y, 14, 14, 'pv-pc', 2);
      b += box(30, 50) + T(37, 100, 'Einzel', 'g-lab', 'middle');
      for (let i = 0; i < 4; i++) b += box(92 + (i % 2) * 18, 40 + Math.floor(i / 2) * 18); b += T(110, 100, 'Serie (Los)', 'g-lab', 'middle');
      ['pv-pc', 'pv-pc ok', 'pv-pc hi'].forEach((c, i) => { b += R(170 + i * 20, 40 + i * 6, 14, 30 - i * 6, c, 2); }); b += T(196, 100, 'Sorte', 'g-lab', 'middle');
      for (let i = 0; i < 4; i++) b += run(250, 56, 90, 3, i * 0.75); b += T(300, 100, 'Masse', 'g-lab', 'middle');
      lab = 'Einzel, Serie, Sorte und Masse im Vergleich';
    } else if (cat === 1) {
      b += R(40, 40, 280, 26, 'pv-gbg', 13) + `<g class="pv-fill"><rect class="pv-g warn" x="40" y="40" width="280" height="26" rx="13"/></g>` + L(264, 30, 264, 76, 'pv-dl') + T(264, 24, '100 %', 'g-lab', 'middle') + T(40, 96, 'Beschäftigungsgrad = Bedarf / Kapazität · 100', 'g-lab m', 'start');
      lab = 'Balken der Auslastung mit der 100-Prozent-Linie';
    } else if (cat === 2) {
      const sx = x => 40 + x * 280, sy = v => 96 - v * 70, pts = fn => { const a = []; for (let i = 1; i <= 30; i++) { const x = i / 30; a.push(q(sx(x)) + ',' + q(sy(fn(x)))); } return a.join(' '); };
      b += L(40, 96, 330, 96, 'g-ax') + L(40, 96, 40, 18, 'g-ax') + `<polyline class="g-cb" points="${pts(x => Math.min(1, 0.12 / x))}"/><polyline class="g-cl" points="${pts(x => x * 0.6)}"/><polyline class="g-cg" points="${pts(x => Math.min(1.1, 0.12 / x + x * 0.6))}"/>`;
      b += `<circle class="pv-min" cx="${q(sx(0.447))}" cy="${q(sy(0.537))}" r="6"/><circle class="pv-ring" cx="${q(sx(0.447))}" cy="${q(sy(0.537))}" r="6"/>` + T(200, 112, 'Losgröße', 'g-lab m', 'middle');
      lab = 'Rüstkosten fallen, Lagerkosten steigen, die Summe hat ein Minimum';
    } else if (cat === 3) {
      [['Übergang', 'pv-ue', 90], ['Rüsten', 'pv-bar r', 40], ['Bearbeiten', 'pv-bar', 120]].reduce((x, s) => { b += R(x, 44, s[2], s[1] === 'pv-ue' ? 16 : 24, s[1]) + T(x + s[2] / 2, 36, s[0], 'g-lab', 'middle'); return x + s[2]; }, 40);
      b += `<g class="pv-scan" style="--L:250px"><line class="pv-sc" x1="40" y1="28" x2="40" y2="76"/></g>` + T(40, 100, 'Durchlaufzeit = Summe aller Arbeitsgänge', 'g-lab m', 'start');
      lab = 'Ein Arbeitsgang besteht aus Übergangszeit, Rüstzeit und Bearbeitungszeit';
    } else if (cat === 4) {
      const node = (x, y, t) => R(x - 46, y - 13, 92, 26, 'pv-st', 6) + T(x, y + 5, t, 'g-lab', 'middle');
      b += node(70, 60, 'Funkmodul') + L(116, 60, 134, 60, 'g-ax') + node(180, 32, 'Platine') + node(180, 88, 'Gehäuse') + L(134, 32, 134, 88, 'g-ax') + L(134, 32, 134, 32, 'g-ax') + L(226, 32, 244, 32, 'g-ax') + node(290, 32, 'Kondensator') + T(180, 116, 'Stückliste: Stufe für Stufe nach unten rechnen', 'g-lab m', 'middle');
      lab = 'Strukturstückliste mit Erzeugnis, Baugruppe und Teil';
    } else if (cat === 5) {
      const P = ['Plan', 'Do', 'Check', 'Act'];
      b += `<circle class="pv-loop" cx="180" cy="60" r="40"/>` + P.map((t, i) => { const a = -Math.PI / 2 + i * Math.PI / 2, x = 180 + Math.cos(a) * 40, y = 60 + Math.sin(a) * 40; return `<circle class="pv-st" cx="${q(x)}" cy="${q(y)}" r="14"/>` + T(x, y + 4, t[0], 'g-lab b', 'middle'); }).join('');
      b += `<g transform="translate(180 60)"><g class="pv-spin" style="animation-duration:8s"><circle class="pv-pc hi" cx="0" cy="-40" r="5"/></g></g>` + T(300, 44, 'Plan, Do,', 'g-lab', 'middle') + T(300, 62, 'Check, Act', 'g-lab', 'middle') + T(300, 80, 'im Kreis', 'g-lab m', 'middle');
      lab = 'PDCA-Kreis: Plan, Do, Check, Act';
    } else return '';
    return svg(W, H, lab, b);
  }

  root.PRD_VIZ = { hallSvg, lineSvg, costSvg, ganttSvg, kanbanSvg, taskPic, HALLS: ['werk', 'fliess', 'gruppe', 'bau'] };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PRD_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
