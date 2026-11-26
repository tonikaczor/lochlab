'use strict';
/* Tonfunk Marketing-Lab: Bilder (Lab-Kennung 'mkt'). Wird in mktlab.html VOR mktui.js geladen.
   Reine Zeichenfunktionen: liefern SVG-Text ohne DOM (testbar mit node quelle/mkt/test_mktviz.js), '' bei ungültigen Werten.
   Bewegung nur per CSS (Klassen pv-*, Keyframes in mktlab.html), bei prefers-reduced-motion: reduce steht alles still.
   Teile mit data-m="…" führt mktui.js beim Verstellen weich nach (nur das style-Attribut wird ersetzt, CSS-Übergang).
   Farben nur über die CSS-Variablen der Seite (hell und dunkel). Alle Zahlen sind Übungswerte im Modellbetrieb. */
(function (root) {
  const C = root.MKT_CORE || (typeof require === 'function' ? require('./mktcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, anchor) => `<text class="${cls || 'g-lab'}" x="${q(x)}" y="${q(y)}"${anchor ? ' text-anchor="' + anchor + '"' : ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg class="mktv" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const sc = v => Math.max(0, Math.round(v * 1000) / 1000);
  /* verschiebbares Teil: Lage (und Breite) über style, damit der CSS-Übergang greift */
  const mv = (id, x, y, body, sx, sy) => `<g data-m="${id}" style="transform:translate(${q(x)}px,${q(y)}px)${sx != null ? ' scale(' + sc(sx) + ',' + (sy != null ? sc(sy) : 1) + ')' : ''}">${body}</g>`;
  /* Tortenstück als dicker Kreisbogen: Länge und Anfang über style (stroke-dasharray/-offset gleiten weich) */
  const arc = (id, cx, cy, r, frac, start, cls) => { const U = 2 * Math.PI * r; return `<circle data-m="${id}" class="${cls}" cx="${cx}" cy="${cy}" r="${q(r)}" transform="rotate(-90 ${cx} ${cy})" style="stroke-dasharray:${q(U * frac)}px ${q(U)}px;stroke-dashoffset:${q(-U * start)}px"/>`; };
  const okNum = (...a) => a.every(v => fin(v) && v >= 0);

  /* ============================================================ Markt: Potenzial, Volumen und Marktanteil als Tortenstück */
  function marktSvg(p) {
    if (!p || !okNum(p.pot, p.vol, p.eigen, p.comp) || !(p.pot > 0) || !(p.vol > 0) || p.vol > p.pot || p.eigen + p.comp > p.vol) return '';
    const W = 640, H = 270, satt = p.vol / p.pot, a = p.eigen / p.vol, b = p.comp / p.vol;
    let s = '';
    /* links: Potenzial (gestrichelt) und Volumen (gefüllte Fläche, Fläche ~ Menge) */
    const cx1 = 150, cy = 128, r1 = 96;
    s += `<circle class="pv-pot" cx="${cx1}" cy="${cy}" r="${r1}"/>` + mv('vol', cx1, cy, `<circle class="pv-vol" r="${r1}"/>`, Math.sqrt(satt), Math.sqrt(satt));
    for (let i = 0; i < 6; i++) s += `<g transform="translate(${cx1} ${cy})"><g class="pv-spin" style="animation-duration:${18 + i * 3}s;animation-delay:${q(-i * 4)}s"><circle class="pv-buyer" cx="0" cy="${q(-r1 * (0.55 + i * 0.08))}" r="4"/></g></g>`;
    s += T(cx1, 22, 'Marktpotenzial ' + f(p.pot, 0), 'g-lab m', 'middle') + T(cx1, cy + 5, 'Volumen', 'g-lab b', 'middle') + T(cx1, cy + 23, f(satt * 100, 1) + ' % gesättigt', 'g-lab', 'middle');
    /* rechts: Torte des Marktvolumens, eigenes Stück hervorgehoben */
    const cx2 = 470, r2 = 40;
    s += `<circle class="pv-rest" cx="${cx2}" cy="${cy}" r="${r2}"/>`;
    s += arc('comp', cx2, cy, r2, b, a, 'pv-sl comp') + arc('own', cx2, cy, r2, a, 0, 'pv-sl own');
    s += T(cx2, 22, 'Marktvolumen ' + f(p.vol, 0), 'g-lab m', 'middle');
    s += R(372, 220, 12, 12, 'pv-k own') + T(390, 231, 'wir ' + f(a * 100, 1) + ' %', 'g-lab') + R(486, 220, 12, 12, 'pv-k comp') + T(504, 231, 'Größter ' + f(b * 100, 1) + ' %', 'g-lab');
    s += `<path class="pv-flow" d="M${cx1 + r1 * Math.sqrt(satt) + 6} ${cy} L${cx2 - 2 * r2 - 14} ${cy}"/>`;
    s += T(W / 2, H - 8, 'Links: wie voll der Markt ist. Rechts: wer wie viel vom Markt hat.', 'g-lab m', 'middle');
    return svg(W, H, 'Marktpotenzial und Marktvolumen, Sättigungsgrad ' + f(satt * 100, 1) + ' %, eigener Marktanteil ' + f(a * 100, 1) + ' % als Tortenstück', s);
  }

  /* ============================================================ Produktlebenszyklus mit wanderndem Punkt (t von 0 bis 100) */
  function plzSvg(t) {
    if (!fin(t) || t < 0 || t > 100) return '';
    const W = 660, H = 300, x0 = 46, x1 = 640, yT = 40, yZ = 210, sx = v => x0 + v / 100 * (x1 - x0), sy = v => yZ - v / 100 * (yZ - yT);
    let s = '';
    C.PLZ.forEach((p, i) => { s += R(sx(p.von), yT - 16, sx(p.bis) - sx(p.von), yZ - yT + 66, 'pv-band' + (i % 2 ? ' alt' : '')) + T((sx(p.von) + sx(p.bis)) / 2, yT - 2, p.n, 'g-lab s', 'middle'); });
    const ph = C.plzPhase(t), P = C.PLZ[ph];
    s += mv('ph', sx(P.von), yT - 16, `<rect class="pv-band on" x="0" y="0" width="1" height="${yZ - yT + 66}"/>`, sx(P.bis) - sx(P.von));
    s += L(x0, yZ, x1, yZ, 'g-ax') + L(x0, yT - 16, x0, yZ + 50, 'g-ax') + T(x0 - 4, yZ + 4, '0', 'g-lab m', 'end');
    const path = fn => { let d = ''; for (let i = 0; i <= 100; i += 2) d += (i ? ' L' : 'M') + q(sx(i)) + ' ' + q(sy(fn(i))); return d; };
    const dU = path(C.plzUmsatz), dG = path(C.plzGewinn);
    s += `<path class="g-cu" d="${dU}"/><path class="g-cw" d="${dG}"/>`;
    s += `<g class="pv-along slow" style="offset-path:path('${dU}')"><circle class="pv-ghost" r="5"/></g>`;
    s += mv('vl', sx(t), 0, L(0, yT - 16, 0, yZ + 50, 'g-opt'));
    s += mv('pu', sx(t), sy(C.plzUmsatz(t)), `<circle class="pv-min" r="8"/><circle class="pv-ring" r="8"/>`) + mv('pg', sx(t), sy(C.plzGewinn(t)), `<circle class="pv-cur" r="6"/>`);
    s += R(x1 - 150, yZ + 22, 12, 12, 'pv-k own') + T(x1 - 134, yZ + 33, 'Umsatz', 'g-lab') + R(x1 - 70, yZ + 22, 12, 12, 'pv-k w') + T(x1 - 54, yZ + 33, 'Gewinn', 'g-lab');
    s += T(sx(22), yZ + 33, 'Zeit', 'g-lab m', 'start') + T(sx(52), yZ - 6, 'Gewinnschwelle (0)', 'g-lab m', 'middle');
    s += T(W / 2, H - 6, 'Phase jetzt: ' + P.n, 'g-lab b', 'middle');
    return svg(W, H, 'Produktlebenszyklus mit Umsatz- und Gewinnkurve, Punkt in der Phase ' + P.n, s);
  }

  /* ============================================================ BCG-Matrix mit Blasen
     items: [{n, rel (Faktor), w (% Wachstum), u (Umsatz, für die Blasengröße), sel}] */
  function bcgSvg(items) {
    if (!Array.isArray(items) || !items.length || items.length > 6 || !items.every(it => it && fin(it.rel) && it.rel > 0 && fin(it.w) && fin(it.u) && it.u > 0)) return '';
    const W = 560, H = 400, x0 = 60, x1 = 540, y0 = 350, y1 = 20, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const sx = r => x0 + (Math.log10(Math.min(10, Math.max(0.1, r))) + 1) / 2 * (x1 - x0), sy = w => y0 - (Math.min(30, Math.max(-10, w)) + 10) / 40 * (y0 - y1);
    let s = R(x0, y1, xm - x0, ym - y1, 'pv-q frage') + R(xm, y1, x1 - xm, ym - y1, 'pv-q star') + R(x0, ym, xm - x0, y0 - ym, 'pv-q dog') + R(xm, ym, x1 - xm, y0 - ym, 'pv-q cash');
    s += T(x0 + 10, y1 + 22, '? Question Mark', 'g-lab b') + T(x1 - 10, y1 + 22, '★ Star', 'g-lab b', 'end') + T(x0 + 10, y0 - 10, 'Poor Dog', 'g-lab b') + T(x1 - 10, y0 - 10, 'Cash Cow', 'g-lab b', 'end');
    s += L(x0, y0, x1, y0, 'g-ax') + L(x0, y0, x0, y1, 'g-ax') + L(xm, y1, xm, y0, 'g-opt') + L(x0, ym, x1, ym, 'g-opt');
    [[0.1, '0,1'], [0.3, '0,3'], [1, '1'], [3, '3'], [10, '10']].forEach(v => { s += T(sx(v[0]), y0 + 18, v[1], 'g-lab m', 'middle'); });
    [-10, 0, 10, 20, 30].forEach(v => { s += T(x0 - 6, sy(v) + 4, v + ' %', 'g-lab m', 'end'); });
    s += T((x0 + x1) / 2, H - 8, 'waagerecht: relativer Marktanteil', 'g-lab m', 'middle');
    const umax = Math.max.apply(null, items.map(it => it.u));
    items.forEach((it, i) => {
      const r = 10 + 26 * Math.sqrt(it.u / umax);
      s += mv('b' + i, sx(it.rel), sy(it.w), `<g class="pv-breath" style="animation-delay:${q(-i * 0.7)}s"><circle class="pv-bub${it.sel ? ' sel' : ''}" r="${q(r)}"/></g>`);
      s += mv('t' + i, sx(it.rel), sy(it.w) + 5, T(0, 0, it.n, 'g-lab b', 'middle'));
    });
    return svg(W, H, 'BCG-Matrix mit ' + items.length + ' Produkten als Blasen: ' + items.map(it => it.n + ' im Feld ' + C.BCG[C.bcgFeld(it.rel, it.w)].n).join(', '), s);
  }

  /* ============================================================ AIDA-Trichter: Kontakte rieseln und werden weniger
     n0 = Kontakte, rates = 4 Anteile in % (Aufmerksamkeit von den Kontakten, Interesse, Wunsch, Kauf jeweils von der Stufe davor) */
  function aidaSvg(n0, rates) {
    if (!(fin(n0) && n0 > 0) || !Array.isArray(rates) || rates.length !== 4 || !rates.every(r => fin(r) && r >= 0 && r <= 100)) return '';
    const W = 600, H = 330, cx = 190, top = 46, sh = 64, wTop = 340, wBot = 60;
    const ns = []; rates.reduce((n, r) => { const m = n * r / 100; ns.push(m); return m; }, n0);
    const wAt = y => wTop - (wTop - wBot) * (y - top) / (4 * sh);
    let s = T(cx, 22, f(n0, 0) + ' Kontakte', 'g-lab b', 'middle');
    const dots = n => (n <= 0 ? 0 : Math.max(1, Math.min(12, Math.round(12 * Math.sqrt(n / n0)))));
    let prev = 12;
    C.AIDA.forEach((a, i) => {
      const y = top + i * sh, wa = wAt(y), wb = wAt(y + sh), k = dots(ns[i]);
      s += `<path class="pv-fun s${i}" d="M${q(cx - wa / 2)} ${y} L${q(cx + wa / 2)} ${y} L${q(cx + wb / 2)} ${y + sh - 4} L${q(cx - wb / 2)} ${y + sh - 4} Z"/>`;
      const lx = cx + wa / 2 + 12; s += T(lx, y + 26, a.k + ': ' + a.de, 'g-lab b') + T(lx, y + 46, f(ns[i], 0) + ' (' + f(rates[i], 1) + ' %)', 'g-lab');
      /* durchlaufende Tropfen */
      for (let j = 0; j < k; j++) { const x = cx - wb / 2 + 12 + (wb - 24) * (k > 1 ? j / (k - 1) : 0.5); s += `<g transform="translate(${q(x)} ${y + 2})"><g class="pv-drop" style="--H:${sh - 8}px;animation-delay:${q(-(j * 0.37 + i * 0.5) % 2.4)}s"><circle class="pv-dot" r="3.5"/></g></g>`; }
      /* Tropfen, die hier aussteigen */
      const out = Math.max(0, prev - k);
      for (let j = 0; j < Math.min(out, 8); j++) { const side = j % 2 ? 1 : -1, x = cx + side * (wa / 2 - 8); s += `<g transform="translate(${q(x)} ${y + 8})"><g class="pv-out" style="--X:${side * 16}px;animation-delay:${q(-(j * 0.53 + i * 0.3) % 2.6)}s"><circle class="pv-dot out" r="3"/></g></g>`; }
      prev = k;
    });
    s += T(W / 2, H - 8, 'Aus ' + f(n0, 0) + ' Kontakten werden ' + f(ns[3], 0) + ' Käufe (' + f(ns[3] / n0 * 100, 2) + ' %)', 'g-lab b', 'middle');
    return svg(W, H, 'AIDA-Trichter: aus ' + f(n0, 0) + ' Kontakten werden ' + f(ns[3], 0) + ' Käufe', s);
  }

  /* ============================================================ Werbe-Budget je Kanal: Balken wachsen live mit
     rows: [{n, budget, umsatz, auftr}] */
  function budgetSvg(rows) {
    if (!Array.isArray(rows) || !rows.length || rows.length > 6 || !rows.every(r => r && okNum(r.budget, r.umsatz, r.auftr))) return '';
    const W = 640, x0 = 16, x1 = 470, rh = 72, y0 = 42, H = y0 + rows.length * rh + 36;
    const mx = Math.max(1, Math.max.apply(null, rows.map(r => Math.max(r.budget, r.umsatz)))), k = (x1 - x0) / mx;
    let s = R(x0, 14, 12, 12, 'pv-k b') + T(x0 + 16, 25, 'Budget', 'g-lab') + R(x0 + 120, 14, 12, 12, 'pv-k u') + T(x0 + 136, 25, 'erwarteter Umsatz', 'g-lab');
    rows.forEach((r, i) => {
      const y = y0 + i * rh;
      s += T(x0, y + 20, r.n, 'g-lab b');
      s += mv('b' + i, x0, y + 26, `<rect class="pv-bb" x="0" y="0" width="1" height="16"/>`, r.budget * k) + mv('u' + i, x0, y + 46, `<rect class="pv-bu" x="0" y="0" width="1" height="16"/>`, r.umsatz * k);
      if (r.budget > 0) s += `<g transform="translate(${x0} ${y + 34})"><g class="pv-run" style="--L:${q(Math.max(8, r.budget * k - 8))}px;animation-duration:2.6s;animation-delay:${q(-i * 0.6)}s"><circle class="pv-coin" r="4"/></g></g>`;
      s += mv('v' + i, x0 + Math.max(r.budget, r.umsatz) * k + 8, y + 50, T(0, 0, f(r.auftr, 0) + ' Aufträge', 'g-lab s'));
    });
    s += T(W / 2, H - 8, 'Schiebe die Regler: Die Balken wachsen mit.', 'g-lab m', 'middle');
    return svg(W, H, 'Werbebudget und erwarteter Umsatz je Kanal: ' + rows.map(r => r.n + ' ' + f(r.budget, 0) + ' € Budget').join(', '), s);
  }

  /* ============================================================ Preis-Absatz einfach: Gerade, Punkt und Deckungsbeitrag als Fläche
     p: {a, b, kv, p} mit Absatz x = a − b · p */
  function preisSvg(o) {
    if (!o || !okNum(o.a, o.b, o.kv, o.p) || !(o.a > 0) || !(o.b > 0)) return '';
    const pMax = o.a / o.b; if (o.p > pMax || o.kv > pMax) return '';
    const W = 620, H = 300, x0 = 70, x1 = 600, y0 = 250, y1 = 24, sx = x => x0 + x / o.a * (x1 - x0), sy = p => y0 - p / pMax * (y0 - y1);
    const x = C.absatz(o.a, o.b, o.p), db = (o.p - o.kv) * x;
    let s = L(x0, y0, x1, y0, 'g-ax') + L(x0, y0, x0, y1, 'g-ax');
    for (let i = 0; i <= 4; i++) { const v = pMax * i / 4; s += L(x0, sy(v), x1, sy(v), 'g-grid') + T(x0 - 6, sy(v) + 4, f(v, 0) + ' €', 'g-lab m', 'end'); }
    for (let i = 0; i <= 4; i++) { const v = o.a * i / 4; s += T(sx(v), y0 + 18, f(v, 0), 'g-lab m', 'middle'); }
    s += mv('kvA', x0, sy(o.kv), `<rect class="pv-kv" x="0" y="0" width="1" height="1"/>`, sx(x) - x0, y0 - sy(o.kv));
    s += mv('dbA', x0, sy(Math.max(o.p, o.kv)), `<rect class="pv-db${o.p < o.kv ? ' bad' : ''}" x="0" y="0" width="1" height="1"/>`, sx(x) - x0, Math.abs(sy(o.kv) - sy(o.p)));
    s += L(sx(0), sy(pMax), sx(o.a), sy(0), 'g-cu');
    s += mv('kvL', 0, sy(o.kv), L(x0, 0, x1, 0, 'g-opt')) + mv('kvT', x1 - 4, sy(o.kv) - 6, T(0, 0, 'variable Kosten ' + f(o.kv, 2) + ' €', 'g-lab m', 'end'));
    s += mv('pt', sx(x), sy(o.p), `<circle class="pv-min" r="8"/><circle class="pv-ring" r="8"/>`) + mv('ptT', Math.min(sx(x) + 12, x1 - 170), sy(o.p) - 12, T(0, 0, f(x, 0) + ' Stück zu ' + f(o.p, 2) + ' €', 'g-lab b'));
    s += mv('dbT', x0 + 8, (sy(o.p) + sy(o.kv)) / 2 + 5, T(0, 0, (o.p - o.kv) * x > 0 ? 'Deckungsbeitrag ' + f(db, 0) + ' €' : '', 'g-lab b'));
    s += T((x0 + x1) / 2, H - 6, 'Absatzmenge (je höher der Preis, desto weniger Stück)', 'g-lab m', 'middle');
    return svg(W, H, 'Preis-Absatz-Gerade, beim Preis ' + f(o.p, 2) + ' € werden ' + f(x, 0) + ' Stück abgesetzt, Deckungsbeitrag ' + f(db, 0) + ' €', s);
  }

  /* ============================================================ Bilder in der Aufgabenansicht (je Thema eines, ohne Ergebnis) */
  function taskPic(cat) {
    const W = 360, H = 120; let b = '', lab = '';
    if (cat === 0) {
      b += `<circle class="pv-pot" cx="70" cy="60" r="44"/><circle class="pv-vol" cx="70" cy="60" r="34"/>` + T(70, 64, 'Volumen', 'g-lab', 'middle') + T(70, 114, 'im Potenzial', 'g-lab m', 'middle');
      b += `<circle class="pv-rest" cx="250" cy="58" r="22"/>` + arc('a', 250, 58, 22, 0.18, 0, 'pv-sl own') + T(250, 114, 'Marktanteil = Stück vom Kuchen', 'g-lab m', 'middle');
      lab = 'Marktpotenzial, Marktvolumen und Marktanteil';
    } else if (cat === 1) {
      const sx = t => 30 + t * 3, sy = v => 96 - v * 0.7; let d = ''; for (let i = 0; i <= 100; i += 4) d += (i ? ' L' : 'M') + q(sx(i)) + ' ' + q(sy(C.plzUmsatz(i)));
      b += L(30, 96, 334, 96, 'g-ax') + `<path class="g-cu" d="${d}"/><g class="pv-along" style="offset-path:path('${d}')"><circle class="pv-min" r="5"/></g>` + T(sx(8), 112, 'Einführung', 'g-lab m', 'middle') + T(sx(55), 112, 'Reife', 'g-lab m', 'middle') + T(sx(92), 112, 'Rückgang', 'g-lab m', 'middle');
      lab = 'Produktlebenszyklus: Ein Punkt läuft über die Umsatzkurve';
    } else if (cat === 2) {
      b += L(40, 100, 330, 100, 'g-ax') + L(40, 100, 40, 12, 'g-ax') + L(40, 16, 320, 100, 'g-cu') + R(40, 50, 140, 26, 'pv-db') + R(40, 76, 140, 24, 'pv-kv') + T(110, 68, 'Deckungsbeitrag', 'g-lab', 'middle') + T(110, 92, 'variable Kosten', 'g-lab m', 'middle');
      b += `<circle class="pv-min" cx="180" cy="58" r="5"/><circle class="pv-ring" cx="180" cy="58" r="5"/>` + T(250, 40, 'Preis − variable Kosten', 'g-lab m', 'middle');
      lab = 'Preis-Absatz-Gerade mit Deckungsbeitrag als Fläche';
    } else if (cat === 3) {
      [[150, 'A'], [118, 'I'], [86, 'D'], [54, 'A']].forEach((w, i) => { b += R(130 - w[0] / 2, 8 + i * 26, w[0], 22, 'pv-fun s' + i, 4) + T(130, 24 + i * 26, w[1], 'g-lab b', 'middle'); });
      for (let j = 0; j < 4; j++) b += `<g transform="translate(${118 + j * 8} 6)"><g class="pv-drop" style="--H:96px;animation-delay:${q(-j * 0.6)}s"><circle class="pv-dot" r="3"/></g></g>`;
      b += T(270, 50, 'Viele sehen es,', 'g-lab', 'middle') + T(270, 70, 'wenige kaufen', 'g-lab m', 'middle');
      lab = 'AIDA-Trichter: Aufmerksamkeit, Interesse, Wunsch, Handlung';
    } else if (cat === 4) {
      b += T(70, 80, '§', 'g-lab big', 'middle') + `<g class="pv-blink"><circle class="pv-okc" cx="200" cy="44" r="16"/>${T(200, 50, '✓', 'g-lab b', 'middle')}</g><g class="pv-blink b2"><circle class="pv-badc" cx="270" cy="44" r="16"/>${T(270, 50, '✕', 'g-lab b', 'middle')}</g>`;
      b += T(235, 96, 'Einwilligung? Wahr? Preis richtig?', 'g-lab m', 'middle');
      lab = 'Paragrafenzeichen mit erlaubt und nicht erlaubt';
    } else return '';
    return svg(W, H, lab, b);
  }

  root.MKT_VIZ = { marktSvg, plzSvg, bcgSvg, aidaSvg, budgetSvg, preisSvg, taskPic };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MKT_VIZ;
})(typeof window !== 'undefined' ? window : globalThis);
