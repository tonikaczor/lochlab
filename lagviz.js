'use strict';
/* Tonfunk Lager-Lab: Visualisierungen (Lab-Kennung 'lag'). Datei wird in laglab.html NACH lagui.js geladen.
   Reine Zeichenfunktionen (liefern SVG-Text, ohne DOM, testbar mit node quelle/lag/test_lagviz.js) plus ein kleiner Haken,
   der die Grafiken in die vorhandenen Reiter einfügt (MutationObserver, keine Änderung an lagui.js nötig):
     Kennzahlen:   Bestandsverlauf mit Ø-Linie, Lagerdauer-Zeitleiste (360-Tage-Balken)
     Disposition:  Regal-Füllstand mit Ampel (Regler "Bestand heute"), Reichweite in Tagen
     ABC-Analyse:  Doppelbalken Artikelanteil gegen Wertanteil
     Lager:        Schaubilder Blocklager, Regallager, Hochregallager, FIFO/LIFO (mit Einlagern/Entnehmen), chaotische Lagerhaltung, Festplatz, Flurförderzeuge
     Beispiele:    Bestandsverlauf bei den Kennzahlen-Beispielen
   Aufgaben und Trainer bleiben unberührt (Verdeckte-Fehler-Prinzip: Aufgaben bekommen keine Grafik, die Ergebnisse zeigt).
   Farben nur über die CSS-Variablen der Seite, Bewegung nur bei prefers-reduced-motion: no-preference, kein Hover nötig. */
(function (root) {
  const C = root.LAG_CORE || (typeof require === 'function' ? require('./lagcore.js') : null);
  const fin = Number.isFinite, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 0 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const R = (x, y, w, h, cls, rx) => `<rect class="${cls || ''}" x="${q(x)}" y="${q(y)}" width="${q(Math.max(0, w))}" height="${q(Math.max(0, h))}"${rx ? ' rx="' + rx + '"' : ''}/>`;
  const L = (x1, y1, x2, y2, cls) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const nice = (r, n) => { const s = r / n, p = Math.pow(10, Math.floor(Math.log10(s))), m = s / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };
  /* Pfeil mit Spitze, Farbe über currentColor (Klasse bestimmt color) */
  function arrow(x1, y1, x2, y2, cls) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 8, p1 = [x2 - s * Math.cos(a - 0.4), y2 - s * Math.sin(a - 0.4)], p2 = [x2 - s * Math.cos(a + 0.4), y2 - s * Math.sin(a + 0.4)];
    return `<g class="ar ${cls || ''}"><line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"/><polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}"/></g>`;
  }
  /* Palette: Ladung (Box) mit Holzfuß. y = Oberkante der Box, Gesamthöhe h + 7 */
  function pallet(x, y, w, h, cls, label) {
    let s = R(x, y, w, h, 'pb ' + (cls || ''), 2) + R(x - 2, y + h, w + 4, 3, 'pw') + R(x + 1, y + h + 3, 7, 4, 'pw') + R(x + w / 2 - 3.5, y + h + 3, 7, 4, 'pw') + R(x + w - 8, y + h + 3, 7, 4, 'pw');
    if (label != null) s += T(x + w / 2, y + h / 2 + 4, label, 's b mid');
    return s;
  }
  const PB = 7;

  /* ============================================================ Kennzahlen: Bestandsverlauf */
  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  /* p: {mode:'ae'|'m12', ab, eb, months[12], use, rate, costs} als Zahlen. Liefert '' bei ungültigen Werten. */
  function kzSvg(p) {
    if (!p) return '';
    const k = C.kennzahlen(p); if (!(k.avg >= 0)) return '';
    const ae = p.mode !== 'm12', vals = ae ? [p.ab, p.eb] : [p.ab].concat(p.months);
    if (!vals.every(v => fin(v) && v >= 0)) return '';
    const idx = ae ? [0, 12] : vals.map((_, i) => i);
    const W = 420, H = 250, l = 56, r = 12, t = 24, b = 34, ymax0 = Math.max.apply(null, vals.concat([k.avg, 1])), ys = nice(ymax0 * 1.12, 4), ymax = Math.ceil(ymax0 * 1.12 / ys) * ys;
    const X = i => l + i / 12 * (W - l - r), Y = v => H - b - v / ymax * (H - t - b);
    let s = '';
    for (let v = 0; v <= ymax + 1e-9; v += ys) s += L(l, Y(v), W - r, Y(v), 'gr') + T(l - 6, Y(v) + 4, f(v), 's m end');
    s += L(l, H - b, W - r, H - b, 'ax') + L(l, t, l, H - b, 'ax');
    const pts = vals.map((v, i) => [X(idx[i]), Y(v)]);
    s += `<polygon class="area" points="${q(pts[0][0])},${q(H - b)} ${pts.map(a => q(a[0]) + ',' + q(a[1])).join(' ')} ${q(pts[pts.length - 1][0])},${q(H - b)}"/>`;
    s += `<polyline class="ln" points="${pts.map(a => q(a[0]) + ',' + q(a[1])).join(' ')}"/>`;
    s += L(l, Y(k.avg), W - r, Y(k.avg), 'avg') + T(W - r - 4, Y(k.avg) - 6, 'Ø Lagerbestand ' + f(k.avg) + ' €', 's b end h hi');
    pts.forEach(a => { s += `<circle class="pt" cx="${q(a[0])}" cy="${q(a[1])}" r="3.6"/>`; });
    for (let i = 0; i <= 12; i++) { if (ae && i !== 0 && i !== 12) continue; s += T(X(i), H - b + 15, i === 0 ? 'Anfang' : MON[i - 1], 's m mid'); }
    s += T(l, 14, '€ im Lager', 's m');
    return svg(W, H, ae ? 'Lagerbestand vom Jahresanfang bis zum Jahresende mit durchschnittlichem Lagerbestand' : 'Lagerbestand am Jahresanfang und an den zwölf Monatsenden mit durchschnittlichem Lagerbestand', s);
  }
  /* Lagerdauer-Zeitleiste: 360 Tage, in Abschnitte der Lagerdauer geteilt */
  function umschlagSvg(p) {
    if (!p) return '';
    const k = C.kennzahlen(p); if (!(k.turnover > 0) || !(k.days > 0)) return '';
    const W = 420, H = 132, x0 = 14, x1 = 406, sc = (x1 - x0) / 360, by = 56, bh = 30, n = Math.ceil(k.turnover - 1e-9);
    let s = T(x0, 16, 'Ein Jahr = 360 Tage', 's m');
    if (n <= 90) for (let i = 0; i < n; i++) { const a = i * k.days, w = Math.min(k.days, 360 - a); if (w <= 0) break; s += R(x0 + a * sc, by, w * sc, bh, 'seg' + (i % 2), 0); }
    else s += R(x0, by, x1 - x0, bh, 'seg0', 0);
    s += R(x0, by, x1 - x0, bh, 'frame', 0);
    const dw = Math.min(k.days, 360) * sc;
    s += L(x0, by - 12, x0 + dw, by - 12, 'dim') + L(x0, by - 17, x0, by - 7, 'dim') + L(x0 + dw, by - 17, x0 + dw, by - 7, 'dim');
    const lab = 'Lagerdauer ' + f(k.days, 1) + ' Tage', lx = Math.min(Math.max(x0 + dw / 2, x0 + 52), x1 - 52);
    s += T(lx, by - 22, lab, 's b mid h');
    [0, 90, 180, 270, 360].forEach(d => { s += L(x0 + d * sc, by + bh, x0 + d * sc, by + bh + 5, 'ax') + T(x0 + d * sc, by + bh + 18, d + '', 's m mid'); });
    s += T(x0, H - 8, 'Umschlag: ' + f(k.turnover, 2) + ' mal pro Jahr (Bestand komplett erneuert)', 's m');
    return svg(W, H, 'Zeitleiste: ein Jahr mit 360 Tagen geteilt in Abschnitte der durchschnittlichen Lagerdauer', s);
  }
  const kzViz = p => { const a = kzSvg(p), b = umschlagSvg(p); return a ? `<div class="vzbox">${a}</div>` + (b ? `<div class="vzbox">${b}</div>` : '') + `<p class="hint2">Die Fläche zeigt den Lagerbestand im Jahr, die gestrichelte Linie den Durchschnitt. ${p.mode === 'm12' ? 'Gemessen wird am Jahresanfang und an jedem Monatsende.' : 'Zwischen Anfang und Ende ist ein gleichmäßiger Verlauf angenommen.'} Kurze Abschnitte in der Zeitleiste bedeuten schnellen Umschlag, wenig gebundenes Kapital.</p>` : ''; };

  /* ============================================================ Disposition: Regal-Füllstand mit Ampel */
  /* p: {daily, lead, safety, qty}, cur = Bestand heute (Stück) */
  function disZone(p, cur) {
    const meld = C.reorderPoint(p.daily, p.lead, p.safety), mx = C.maxStock(p.safety, p.qty);
    if (!fin(meld) || !fin(mx) || !(mx > 0) || !fin(cur)) return null;
    const z = cur < p.safety ? 'low' : cur <= meld ? 'order' : cur > mx ? 'over' : 'ok';
    return { z, meld, mx, reach: p.daily > 0 ? cur / p.daily : NaN };
  }
  const ZTXT = {
    low: 'Unter dem Sicherheitsbestand: Die eiserne Reserve wird angegriffen, Fehlmengen drohen.',
    order: 'Zwischen Sicherheits- und Meldebestand: Jetzt muss bestellt sein, die Lieferung ist unterwegs.',
    ok: 'Über dem Meldebestand: kein Handlungsbedarf, der Bestand reicht bis zur nächsten Bestellung.',
    over: 'Über dem Höchstbestand: Überbestand, mehr Kapital gebunden als nötig.'
  };
  function disFillSvg(p, cur) {
    const d = disZone(p, cur); if (!d) return '';
    const W = 420, H = 230, top = 40, bot = 206, ymax = Math.max(d.mx, cur, 1) * 1.08, Y = v => bot - Math.min(v, ymax) / ymax * (bot - top), tx = 150, tw = 60;
    const col = { low: 'var(--danger)', order: 'var(--hi)', ok: 'var(--ok)', over: 'var(--warn)' }[d.z];
    let s = R(tx, top, tw, bot - top, 'tank', 4);
    s += `<rect x="${tx}" y="${q(Y(cur))}" width="${tw}" height="${q(bot - Y(cur))}" rx="4" style="fill:${col};fill-opacity:.55;stroke:${col};stroke-width:2"/>`;
    [[d.mx, 'Höchstbestand', 'var(--ok)'], [d.meld, 'Meldebestand', 'var(--hi)'], [p.safety, 'Sicherheitsbestand', 'var(--danger)']].forEach(a => { s += `<line x1="${tx - 8}" x2="${tx + tw + 6}" y1="${q(Y(a[0]))}" y2="${q(Y(a[0]))}" style="stroke:${a[2]};stroke-width:1.5;stroke-dasharray:5 4"/>` + `<text class="s b h" x="${tx + tw + 12}" y="${q(Y(a[0]) + 4)}" style="fill:${a[2]}">${esc(a[1] + ' ' + f(a[0]))}</text>`; });
    s += `<text class="s b mid" x="${tx + tw / 2}" y="${q(Math.min(bot - 6, Math.max(Y(cur) + 16, top + 14)))}">${esc(f(cur))}</text>`;
    /* Regal: 4 x 3 Plätze (Paletten), gefüllt nach Anteil am Höchstbestand */
    const cols = 4, rows = 3, n = cols * rows, filled = Math.max(0, Math.min(n, Math.round(cur / d.mx * n)));
    s += T(14, 112, 'Regal: ' + filled + ' von ' + n + ' Plätzen', 's m');
    for (let i = 0; i < n; i++) { const c = i % cols, r = Math.floor(i / cols), x = 14 + c * 28, y = 120 + (rows - 1 - r) * 28, on = (r * cols + c) < filled; s += `<rect x="${x}" y="${y}" width="24" height="20" rx="2" style="fill:${on ? col : 'none'};fill-opacity:.55;stroke:${on ? col : 'var(--line)'};stroke-width:1.5"/>`; }
    s += L(10, 206, 124, 206, 'ax');
    s += T(14, 22, 'Reichweite ' + (fin(d.reach) ? f(d.reach, 1) + ' Tage' : '–'), 'b');
    return svg(W, H, 'Füllstand des Lagers im Vergleich zu Sicherheits-, Melde- und Höchstbestand', s);
  }

  /* ============================================================ ABC: Doppelbalken */
  function abcBarsSvg(r) {
    if (!r || !r.rows || !r.rows.length || !(r.total > 0)) return '';
    const W = 420, H = 150, x0 = 78, x1 = 410, w = x1 - x0;
    const row = (y, lab, key) => {
      let s = T(x0 - 8, y + 20, lab, 's b end'), x = x0;
      ['A', 'B', 'C'].forEach(c => { const v = r.classes[c][key], ww = Math.max(0, v) / 100 * w; if (ww <= 0) return; s += R(x, y, ww, 30, 'c' + c, 0); if (ww >= 36) s += T(x + ww / 2, y + 20, c + ' ' + f(v, 0) + ' %', 's b mid dk'); x += ww; });
      return s + R(x0, y, w, 30, 'frame', 0);
    };
    let s = row(22, 'Artikel', 'nShare') + row(74, 'Wert', 'share');
    s += T(x0, 14, 'Anteil an allen Artikeln', 's m') + T(x0, 66, 'Anteil am Jahreswert', 's m');
    s += T(x0, 128, 'Wenige A-Artikel machen den größten Wert aus (Pareto-Prinzip).', 's m');
    return svg(W, H, 'Doppelbalken: Anteil der Artikel und Anteil am Jahreswert je Klasse A, B und C', s);
  }


  /* ============================================================ Sägezahn (Disposition) und Pareto (ABC) in handlicher Größe */
  /* p: {daily, lead, safety, qty}. Bestellung bei Meldebestand, Lieferzeit als Streifen, Lieferung bei Sicherheitsbestand (Modell wie lagcore.sawtooth). */
  function sawSvg2(p) {
    if (!p) return '';
    const w = C.sawtooth(p, 3); if (!w.pts.length) return '';
    const W = 420, H = 250, l = 46, r = 10, t = 22, b = 34, ymax = w.max * 1.15, X = v => l + v / (w.T * 3) * (W - l - r), Y = v => H - b - v / ymax * (H - t - b);
    let s = L(l, H - b, W - r, H - b, 'ax') + L(l, t, l, H - b, 'ax');
    w.orders.forEach(o => { s += R(X(o[0]), t, Math.max(1, X(o[0] + p.lead) - X(o[0])), H - b - t, 'lead', 0); });
    [[w.max, 'Höchstbestand', 'var(--ok)'], [w.meld, 'Meldebestand', 'var(--hi)'], [p.safety, 'Sicherheitsbestand', 'var(--danger)']].forEach(a => { s += `<line x1="${l}" x2="${W - r}" y1="${q(Y(a[0]))}" y2="${q(Y(a[0]))}" style="stroke:${a[2]};stroke-width:1.5;stroke-dasharray:6 4"/>` + `<text class="s b h end" x="${W - r - 2}" y="${q(Y(a[0]) - 5)}" style="fill:${a[2]}">${esc(a[1] + ' ' + f(a[0]))}</text>`; });
    s += `<polyline class="ln" points="${w.pts.map(a => q(X(a[0])) + ',' + q(Y(a[1]))).join(' ')}"/>`;
    w.orders.forEach((o, i) => { s += `<circle class="pt" cx="${q(X(o[0]))}" cy="${q(Y(o[1]))}" r="5" style="fill:var(--hi)"/>`; if (i === 0) s += T(X(o[0]) + 8, Y(o[1]) - 8, 'Bestellung', 's b h', ' style="fill:var(--hi)"'); });
    s += T(l - 6, t + 4, 'Stück', 's m end') + T(l, H - b + 16, '0', 's m mid') + T(W - r, H - b + 16, f(w.T * 3, 0) + ' Tage', 's m end') + T((l + W - r) / 2, H - 6, 'Zeit in Tagen (Streifen = Lieferzeit ' + f(p.lead, 0) + ' Tage)', 's m mid');
    return svg(W, H, 'Lagerbestand als Sägezahn mit Höchst-, Melde- und Sicherheitsbestand, Bestellzeitpunkt und Lieferzeit', s);
  }
  /* r: Ergebnis von C.abc. Balken je Artikel (Rang), Linie kumuliert, Klassengrenzen */
  function paretoSvg(r) {
    if (!r || !r.rows || !r.rows.length || !(r.total > 0)) return '';
    const n = r.rows.length, W = 420, H = 250, l = 40, rt = 12, t = 22, b = 40, bw = (W - l - rt) / n, Y = v => H - b - v / 100 * (H - t - b);
    let s = '';
    [0, 25, 50, 75, 100].forEach(v => { s += L(l, Y(v), W - rt, Y(v), 'gr') + T(l - 6, Y(v) + 4, v + ' %', 's m end'); });
    s += L(l, H - b, W - rt, H - b, 'ax');
    [[r.lim.a, 'A'], [r.lim.a + r.lim.b, 'B']].forEach(a => { s += L(l, Y(a[0]), W - rt, Y(a[0]), 'avg'); });
    r.rows.forEach((x, i) => { const cx = l + i * bw + bw / 2; s += R(l + i * bw + bw * 0.14, Y(x.share), bw * 0.72, Y(0) - Y(x.share), 'c' + x.cls, 1) + (n <= 14 ? T(cx, H - b + 15, x.rank, 's m mid') : ''); });
    s += `<polyline class="ln" style="stroke:var(--fg)" points="${r.rows.map((x, i) => q(l + i * bw + bw / 2) + ',' + q(Y(x.cum))).join(' ')}"/>`;
    s += T(l, 14, 'Balken: Wertanteil je Artikel · Linie: kumuliert', 's m') + T(W / 2, H - 6, 'Artikel nach Jahreswert sortiert (Rang)', 's m mid');
    return svg(W, H, 'Pareto-Diagramm der ABC-Analyse: Balken für den Wertanteil je Artikel und Kumulationskurve', s);
  }

  /* ============================================================ Lager: Schaubilder */
  const W2 = 420, H2 = 240;
  function sceneBlock() {
    let s = L(14, 206, 406, 206, 'ax') + T(210, 18, 'Blocklager: Paletten stehen ohne Regal im Stapel', 's b mid');
    [[34, 'Block 1'], [150, 'Block 2'], [266, 'Block 3']].forEach((b, bi) => {
      for (let lv = 0; lv < 3; lv++) { const y = 206 - (lv + 1) * 46, top = lv === 2; s += pallet(b[0], y + 6, 100, 33, top ? 'pb' : 'dim'); }
      s += T(b[0] + 50, 224, b[1], 's m mid');
      s += arrow(b[0] + 50, 44, b[0] + 50, 70, 'acc');
    });
    s += T(210, 36, 'Zugriff nur auf die oberste Palette', 's b mid', ' style="fill:var(--accent)"');
    return svg(W2, H2, 'Blocklager: drei Stapel mit je drei Paletten', s);
  }
  function sceneRegal() {
    const x0 = 64, cw = 100, rh = 56, base = 204;
    let s = T(210, 20, 'Regallager: jede Palette einzeln erreichbar', 's b mid');
    const occ = [[1, 1, 0], [1, 0, 1], [1, 1, 1]];
    for (let c = 0; c <= 3; c++) s += R(x0 + c * cw - 3, base - 3 * rh - 6, 6, 3 * rh + 6, 'rk');
    for (let e = 0; e < 3; e++) {
      const y = base - e * rh;
      s += R(x0 - 3, y - 4, 3 * cw + 6, 4, 'rk');
      for (let c = 0; c < 3; c++) {
        if (occ[e][c]) s += pallet(x0 + c * cw + 10, y - rh + 10, cw - 20, rh - 26, c === 1 ? 'pb2' : 'pb');
        else s += R(x0 + c * cw + 8, y - rh + 8, cw - 16, rh - 14, 'free', 3);
      }
      s += T(x0 - 10, y - rh / 2 + 4, 'Ebene ' + (e + 1), 's m end');
    }
    for (let c = 0; c < 3; c++) s += T(x0 + c * cw + cw / 2, base + 18, 'Feld ' + (c + 1), 's m mid');
    s += T(x0 + 1.5 * cw, base - rh - rh / 2 + 4, 'frei', 's b mid', ' style="fill:var(--ok)"');
    return svg(W2, H2, 'Regallager mit drei Feldern und drei Ebenen', s);
  }
  function sceneHoch() {
    const cw = 22, rh = 20, cols = 5, rows = 8, base = 214, xl = 10, xr = 296, xa = xl + cols * cw;
    let s = T(210, 14, 'Hochregallager mit Regalbediengerät (RBG)', 's b mid');
    const fillAt = (c, e, k) => ((c * 7 + e * 3 + k) % 5) !== 0;
    [xl, xr].forEach((x0, k) => {
      for (let e = 0; e < rows; e++) for (let c = 0; c < cols; c++) { const x = x0 + c * cw, y = base - (e + 1) * rh; s += R(x, y, cw, rh, 'cell', 0); if (fillAt(c, e, k)) s += R(x + 3, y + 4, cw - 6, rh - 8, 'pb', 1.5); }
    });
    const mx = xa + (xr - xa) / 2;
    s += R(xa + 6, base, xr - xa - 12, 4, 'rk') + R(mx - 3, 30, 6, base - 30, 'mast') + R(xa + 6, 26, xr - xa - 12, 4, 'rk');
    s += R(mx - 14, base - 6 * rh - 6, 28, 16, 'cab', 2) + R(mx - 18, base - 6 * rh + 10, 36, 3, 'pw');
    s += arrow(mx, base - 6 * rh - 12, mx, base - 8 * rh + 6, 'acc') + arrow(mx - 24, base - 4 * rh, mx - 8, base - 4 * rh, 'ok');
    s += T(mx, base + 20, 'Gasse', 's m mid') + T(xl + cols * cw / 2, base + 20, 'Regal', 's m mid') + T(xr + cols * cw / 2, base + 20, 'Regal', 's m mid');
    return svg(W2, H2, 'Hochregallager mit zwei Regalen und einem Regalbediengerät in der Gasse', s);
  }
  /* FIFO/LIFO: Kanal (Lane) mit Paletten; queue = Nummern von vorn (links) nach hinten (rechts) */
  function sceneLane(kind, queue, nextId, last) {
    const fifo = kind === 'fifo', cw = 64, x0 = 60, y0 = 84;
    let s = T(210, 20, fifo ? 'FIFO: Durchlaufregal, hinten rein, vorn raus' : 'LIFO: Einschubregal oder Block, gleiche Seite rein und raus', 's b mid');
    s += R(x0 - 6, y0 + 56, 5 * cw + 12, 6, 'rk') + R(x0 - 6, y0 - 8, 5 * cw + 12, 4, 'rk');
    if (!fifo) s += R(x0 + 5 * cw + 2, y0 - 8, 5, 70, 'rk');
    for (let i = 0; i < 6; i++) s += `<circle class="roll" cx="${q(x0 + 6 + i * 52)}" cy="${y0 + 59}" r="2.6"/>`;
    s += T(x0 - 8, y0 + 82, fifo ? 'Entnahme (vorn)' : 'Ein- und Ausgang', 's m');
    s += T(x0 + 5 * cw + 6, y0 + 82, fifo ? 'Einlagern (hinten)' : 'geschlossenes Ende', 's m end');
    queue.forEach((id, i) => { const x = x0 + (fifo ? i : 5 - queue.length + i) * cw + 4; s += pallet(x, y0 + 12, cw - 12, 34, i === 0 ? 'pb2' : 'pb', id); });
    s += arrow(x0 + 6, 52, x0 - 34, 52, 'acc') + arrow(fifo ? x0 + 5 * cw + 30 : x0 - 34, fifo ? 52 : 70, fifo ? x0 + 5 * cw - 6 : x0 + 6, fifo ? 52 : 70, 'ok');
    s += T(x0 - 34, 46, 'raus', 's m') + (fifo ? T(x0 + 5 * cw + 30, 46, 'rein', 's m end') : T(x0 - 34, 90, 'rein', 's m'));
    s += T(210, 190, last || 'Tippe auf Einlagern und Entnehmen.', 's b mid');
    s += T(210, 208, 'Nummer = Reihenfolge der Einlagerung (1 ist die älteste Palette).', 's m mid');
    return svg(W2, H2, fifo ? 'Durchlaufregal nach dem FIFO-Prinzip' : 'Einschubkanal nach dem LIFO-Prinzip', s);
  }
  function sceneChaos(fest) {
    const cols = 5, rows = 3, cw = 60, rh = 42, x0 = 60, y0 = 38, cl = { A: 'pb', B: 'pb2', C: 'pb3' };
    const chaos = ['B', 'A', 'C', 'A', '', 'A', '', 'B', 'C', 'B', 'B', '', 'A', '', ''];
    const fixed = ['A', 'A', 'A', 'A', '', 'B', 'B', 'B', 'B', '', 'C', 'C', '', '', ''];
    let s = T(210, 20, fest ? 'Festplatzlagerung: jeder Artikel hat seinen Platz' : 'Chaotische Lagerhaltung: freier Platz, EDV merkt sich den Ort', 's b mid');
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = x0 + c * cw, y = y0 + r * rh, a = (fest ? fixed : chaos)[r * cols + c];
      if (a) s += pallet(x + 5, y + 5, cw - 14, rh - 19, cl[a], a);
      else if (fest) s += R(x + 4, y + 4, cw - 12, rh - 10, 'hatch', 2) + T(x + cw / 2 - 2, y + 26, 'ABC'[r], 's m mid');
      else s += R(x + 4, y + 4, cw - 12, rh - 10, 'free', 2);
    }
    for (let r = 0; r <= rows; r++) s += R(x0 - 2, y0 + r * rh - 2, cols * cw + 4, 3, 'rk');
    s += T(210, y0 + rows * rh + 22, fest ? 'schraffiert = leer, aber für diesen Artikel reserviert' : 'gestrichelt = frei, für jeden Artikel nutzbar', 's m mid');
    s += T(210, 218, fest ? '10 Paletten brauchen 15 Plätze: 5 bleiben reserviert und leer.' : 'Dieselben 10 Paletten, dazu 5 freie Plätze für beliebige Ware.', 's b mid');
    return svg(W2, H2, fest ? 'Regal mit festen Plätzen je Artikel' : 'Regal mit chaotisch verteilten Artikeln', s);
  }
  /* Flurförderzeuge (Seitenansicht, Fahrtrichtung nach links) */
  function sceneTruck(kind) {
    const gy = 196; let s = L(14, gy, 406, gy, 'ax');
    const wheel = (cx, r) => `<circle class="tyre" cx="${q(cx)}" cy="${q(gy - r)}" r="${r}"/><circle class="hub" cx="${q(cx)}" cy="${q(gy - r)}" r="${q(r / 2.6)}"/>`;
    if (kind === 'hub') {
      s += T(210, 20, 'Hubwagen: Paletten ebenerdig über kurze Strecken', 's b mid');
      s += R(90, gy - 10, 150, 6, 'fork') + `<circle class="tyre" cx="96" cy="${gy - 4}" r="4"/>` + R(232, gy - 22, 22, 18, 'bodyf', 3) + wheel(244, 8);
      s += pallet(100, gy - 90, 124, 76, 'pb');
      s += L(250, gy - 24, 306, gy - 120, 'bar') + R(298, gy - 128, 22, 8, 'cab', 3);
      s += arrow(150, 56, 100, 56, 'acc') + T(160, 60, 'Fahrtrichtung', 's m');
    } else if (kind === 'front') {
      s += T(210, 20, 'Gegengewichtsstapler (Frontstapler)', 's b mid');
      s += R(168, gy - 56, 130, 34, 'bodyf', 6) + R(262, gy - 78, 40, 56, 'cw', 5) + T(282, gy - 44, 'Gegen-', 's s2 mid dk') + T(282, gy - 33, 'gewicht', 's s2 mid dk');
      s += wheel(196, 17) + wheel(274, 13);
      s += `<polyline class="guard" points="196,${gy - 56} 196,${gy - 128} 262,${gy - 128} 262,${gy - 78}"/>` + R(190, gy - 134, 78, 6, 'cab', 2) + R(210, gy - 78, 36, 22, 'seat', 3);
      s += R(158, gy - 158, 8, 160, 'mast') + R(150, gy - 128, 6, 70, 'mast2');
      s += R(78, gy - 116, 84, 5, 'fork') + R(160, gy - 126, 6, 24, 'mast2');
      s += pallet(84, gy - 168, 74, 46, 'pb');
      s += arrow(170, 30, 170, 44, 'acc') + T(178, 44, 'Hub', 's m');
    } else {
      s += T(210, 20, 'Schubmaststapler: schmale Gänge, Mast schiebt nach vorn', 's b mid');
      s += R(190, gy - 52, 100, 30, 'bodyf', 6) + wheel(264, 12) + wheel(120, 8);
      s += R(70, gy - 14, 130, 6, 'rk') + R(70, gy - 8, 8, 8, 'rk');
      s += `<polyline class="guard" points="214,${gy - 52} 214,${gy - 130} 270,${gy - 130} 270,${gy - 52}"/>` + R(208, gy - 136, 68, 6, 'cab', 2) + R(228, gy - 76, 30, 22, 'seat', 3);
      s += R(122, gy - 150, 8, 140, 'mast') + R(122, gy - 124, 6, 20, 'mast2');
      s += R(54, gy - 104, 72, 5, 'fork');
      s += pallet(58, gy - 150, 62, 42, 'pb');
      s += R(128, gy - 62, 70, 5, 'mast2') + arrow(190, 104, 152, 104, 'acc') + T(150, 94, 'Mast fährt vor', 's m');
    }
    return svg(W2, H2, kind === 'hub' ? 'Hubwagen mit Palette' : kind === 'front' ? 'Gegengewichtsstapler mit Palette auf der Gabel' : 'Schubmaststapler mit ausgefahrenem Mast', s);
  }
  const KINDS = [
    ['block', 'Blocklager', 'Lagerarten', 'Blocklager'], ['regal', 'Regallager', 'Lagerarten', 'Regallager'], ['hoch', 'Hochregal', 'Lagerarten', 'Hochregallager'],
    ['fifo', 'FIFO', 'Prinzipien', 'FIFO'], ['lifo', 'LIFO', 'Prinzipien', 'LIFO'], ['chaos', 'Chaotisch', 'Prinzipien', 'Chaotische'], ['fest', 'Festplatz', 'Prinzipien', 'Festplatz'],
    ['hub', 'Hubwagen', 'Flurförderzeuge', 'Hubwagen'], ['front', 'Frontstapler', 'Flurförderzeuge', 'Gegengewichtsstapler'], ['schub', 'Schubmast', 'Flurförderzeuge', 'Schubmaststapler']
  ];
  /* Erläuterung unter dem Bild (nur Aussagen aus dem Lehrtext des Labs) */
  const NOTES = {
    block: 'Die unteren Paletten sind zugestellt: Zuletzt gestapelt, zuerst entnommen (LIFO). Für unten stehende Ware besteht Gefahr durch Stapeldruck.',
    regal: 'Lagerplatz = Feld und Ebene, zum Beispiel „Feld 2, Ebene 2“. Die Höhe wird genutzt, dafür brauchen die Gassen Platz.',
    hoch: 'Sehr hohe Regale, bedient vom Regalbediengerät in der Gasse: beste Raumausnutzung in der Höhe, aber hohe Investition.',
    fifo: 'Gut für verderbliche oder datierte Ware. Dafür sind Organisation und Platzbedarf höher.',
    lifo: 'Einfach und platzsparend, aber die älteste Ware bleibt hinten liegen: Verderb- und Alterungsrisiko.',
    chaos: 'Sehr gute Raumausnutzung und flexibel; ohne EDV nicht beherrschbar, bei Systemausfall unübersichtlich.',
    fest: 'Der Ort ist leicht zu merken und auch ohne EDV führbar; leere Plätze bleiben aber reserviert.',
    hub: 'Günstig, wendig und einfach zu bedienen. Er hebt nur wenige Zentimeter und lagert nicht in Regale ein.',
    front: 'Das Gegengewicht hinten gleicht die Last vorn aus. Vielseitig, braucht aber breite Gänge; Staplerschein nötig.',
    schub: 'Schmalere Gänge als beim Frontstapler und gute Hubhöhe; nur für ebenen Hallenboden.'
  };
  const lane0 = () => ({ fifo: { q: [1, 2, 3, 4], next: 5, msg: '' }, lifo: { q: [4, 3, 2, 1], next: 5, msg: '' } });
  function laneStep(L0, kind, act) {
    const s = L0[kind]; if (!s) return L0;
    if (act === 'reset') { L0[kind] = { q: kind === 'fifo' ? [1, 2, 3, 4] : [4, 3, 2, 1], next: 5, msg: '' }; return L0; }
    if (act === 'in') {
      if (s.q.length >= 5) { s.msg = 'Der Kanal ist voll (5 Paletten).'; return L0; }
      if (kind === 'fifo') s.q.push(s.next); else s.q.unshift(s.next);
      s.msg = 'Palette ' + s.next + ' eingelagert (' + (kind === 'fifo' ? 'hinten' : 'vorn am Eingang') + ').'; s.next++;
    } else if (act === 'out') {
      if (!s.q.length) { s.msg = 'Der Kanal ist leer.'; return L0; }
      const id = s.q.shift(); s.msg = 'Palette ' + id + ' entnommen' + (kind === 'fifo' ? ': die älteste zuerst.' : ': die zuletzt eingelagerte zuerst.');
    }
    return L0;
  }
  function artSvg(kind, L0) {
    if (kind === 'block') return sceneBlock(); if (kind === 'regal') return sceneRegal(); if (kind === 'hoch') return sceneHoch();
    if (kind === 'fifo' || kind === 'lifo') { const s = (L0 || lane0())[kind]; return sceneLane(kind, s.q, s.next, s.msg); }
    if (kind === 'chaos') return sceneChaos(false); if (kind === 'fest') return sceneChaos(true);
    return sceneTruck(kind);
  }

  const API = { NOTES, kzSvg, umschlagSvg, kzViz, disZone, disFillSvg, abcBarsSvg, sawSvg2, paretoSvg, artSvg, KINDS, lane0, laneStep, ZTXT };
  root.LAG_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;

  /* ============================================================ Einbau in die Seite (nur im Browser) */
  if (typeof document === 'undefined' || !C) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const LS = 'lm4.lag.';
  const lsGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(LS + k) || ''); return v == null ? d : v; } catch (e) { return d; } };
  const P = C.parseDe;
  const CSS = `.vzbox{background:var(--panel2);border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:640px;margin:8px auto}
.vzbox svg{display:block;width:100%;height:auto}
.vzc svg text,.vzbox svg text{font-family:system-ui,sans-serif;font-size:12.5px;fill:var(--fg);-webkit-user-select:none;user-select:none}
.vzbox svg text.s{font-size:12px}.vzbox svg text.s2{font-size:9px}.vzbox svg text.m{fill:var(--mute)}.vzbox svg text.b{font-weight:700}.vzbox svg text.mid{text-anchor:middle}.vzbox svg text.end{text-anchor:end}.vzbox svg text.dk{fill:#10151a}
.vzbox svg text.hi{fill:var(--hi)}.vzbox svg text.h{paint-order:stroke;stroke:var(--panel2);stroke-width:3px;stroke-linejoin:round}
.vzbox .gr{stroke:var(--line);stroke-width:.7}.vzbox .ax{stroke:var(--mute);stroke-width:1.2}
.vzbox .area{fill:var(--accent);fill-opacity:.2}.vzbox .ln{fill:none;stroke:var(--accent);stroke-width:2.4;stroke-linejoin:round}.vzbox .pt{fill:var(--accent);stroke:var(--panel2);stroke-width:1.5}
.vzbox .lead{fill:var(--hi);fill-opacity:.16}.vzbox .avg{stroke:var(--hi);stroke-width:1.8;stroke-dasharray:6 4}
.vzbox .seg0{fill:var(--accent);fill-opacity:.4}.vzbox .seg1{fill:var(--accent);fill-opacity:.22}.vzbox .frame{fill:none;stroke:var(--fg);stroke-width:1.2}.vzbox .dim{stroke:var(--fg);stroke-width:1.4}
.vzbox .tank{fill:none;stroke:var(--mute);stroke-width:1.5}
.vzbox .cA{fill:#e5484d}.vzbox .cB{fill:#f5a524}.vzbox .cC{fill:#3b9eff}
.vzbox .pb{fill:var(--accent);fill-opacity:.45;stroke:var(--accent);stroke-width:1.4}.vzbox .pb2{fill:var(--hi);fill-opacity:.5;stroke:var(--hi);stroke-width:1.4}.vzbox .pb3{fill:var(--ok);fill-opacity:.45;stroke:var(--ok);stroke-width:1.4}.vzbox .pb.dim{fill-opacity:.15;stroke-opacity:.5}
.vzbox .pw{fill:var(--mute);fill-opacity:.7}.vzbox .rk{fill:var(--mute);fill-opacity:.85}.vzbox .cell{fill:none;stroke:var(--line);stroke-width:.8}
.vzbox .free{fill:none;stroke:var(--mute);stroke-width:1.3;stroke-dasharray:4 3}.vzbox .hatch{fill:var(--mute);fill-opacity:.18;stroke:var(--mute);stroke-width:1}
.vzbox .roll{fill:var(--mute)}.vzbox .mast,.vzbox .mast2{fill:var(--mute)}.vzbox .cab{fill:var(--panel);stroke:var(--mute);stroke-width:1.5}
.vzbox .bodyf{fill:var(--hi);fill-opacity:.55;stroke:var(--hi);stroke-width:1.5}.vzbox .cw{fill:var(--mute);fill-opacity:.7;stroke:var(--mute);stroke-width:1.5}.vzbox .seat{fill:var(--panel);stroke:var(--mute);stroke-width:1.4}
.vzbox .fork{fill:var(--fg);fill-opacity:.75}.vzbox .guard{fill:none;stroke:var(--mute);stroke-width:3;stroke-linejoin:round}.vzbox .bar{stroke:var(--mute);stroke-width:5;stroke-linecap:round}
.vzbox .tyre{fill:var(--panel);stroke:var(--fg);stroke-width:2.5}.vzbox .hub{fill:var(--mute)}
.vzbox .ar{color:var(--fg)}.vzbox .ar line{stroke:currentColor;stroke-width:2.6;stroke-linecap:round}.vzbox .ar polygon{fill:currentColor}.vzbox .ar.acc{color:var(--accent)}.vzbox .ar.ok{color:var(--ok)}
.vzcard h4{margin:0 0 8px}
.vzchips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px}.vzchips .gl{flex:0 0 100%;font-size:12px;color:var(--mute);margin:6px 0 0}
.vzchips button{min-height:44px;padding:0 14px;border-radius:22px;background:var(--panel2);border:1px solid var(--line);font:600 14px system-ui;color:var(--fg)}
.vzchips button.on{background:var(--accent-bg,#1a6fd4);border-color:var(--accent-bg,#1a6fd4);color:#fff}
.vzctl{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.vzctl button{min-height:44px;padding:0 16px;border-radius:12px;background:var(--panel2);border:1px solid var(--line);font-weight:600;color:var(--fg)}
.vzzone{border-left:3px solid var(--accent);background:var(--bg);border-radius:0 8px 8px 0;padding:8px 12px;margin:8px 0;font-size:14px;line-height:1.45}
.vzzone.low{border-color:var(--danger)}.vzzone.order{border-color:var(--hi)}.vzzone.ok{border-color:var(--ok)}.vzzone.over{border-color:var(--warn)}
@media(prefers-reduced-motion:no-preference){.vzbox svg .ar{animation:vzpulse 2.4s ease-in-out infinite}@keyframes vzpulse{0%,100%{opacity:1}50%{opacity:.55}}}`;
  const st = document.createElement('style'); st.id = 'lagviz-css'; st.textContent = CSS; document.head.appendChild(st);

  const V = { dis: { cur: null }, art: 'block', lane: lane0() };
  const kzParams = s => ({ mode: s.mode, ab: P(s.ab), eb: P(s.eb), months: (s.months || []).map(P), use: P(s.use), rate: P(s.rate), costs: P(s.costs) });
  const kzState = () => Object.assign({ mode: 'ae', ab: '60000', eb: '100000', months: new Array(12).fill(''), use: '480000', rate: '6', costs: '12000' }, lsGet('kz', {}));
  const disState = () => Object.assign({ daily: 40, lead: 8, safety: 120, qty: 800 }, lsGet('dis', {}));

  /* Karte einfügen und bei Änderungen der Ansicht neu zeichnen. place(view, card) fügt die Karte ein; upd(card) zeichnet den Inhalt. */
  function hook(viewId, id, place, init, upd) {
    const view = $(viewId); if (!view) return;
    const ensure = () => {
      let card = document.getElementById(id);
      if (!card || !view.contains(card)) { card = document.createElement('div'); card.id = id; card.className = 'card pl vzcard'; init(card); place(view, card); }
      try { upd(card); } catch (e) {}
    };
    new MutationObserver(() => { if (!document.getElementById(id) || !view.contains(document.getElementById(id))) ensure(); }).observe(view, { childList: true });
    ['input', 'change'].forEach(ev => view.addEventListener(ev, () => setTimeout(() => { const c = document.getElementById(id); if (c) { try { upd(c); } catch (e) {} } }, 0)));
    if (view.firstChild) ensure();
  }

  /* Kennzahlen */
  hook('#kzView', 'vzKz', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Das Lagerjahr als Bild</h4><div class="vzout"></div>'; },
    c => { const h = kzViz(kzParams(kzState())); $('.vzout', c).innerHTML = h || '<p class="hint2">Gib Anfangs- und Endbestand sowie den Jahresverbrauch ein, dann erscheinen hier der Bestandsverlauf und die Lagerdauer-Zeitleiste.</p>'; });

  /* Disposition: Regal-Füllstand */
  hook('#disView', 'vzDis', (v, c) => { const o = $('#disOut', v); if (o && o.nextSibling) v.insertBefore(c, o.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Regal-Füllstand: Wo steht der Bestand heute?</h4><div class="vzbox" data-vz="svg"></div><label class="f" style="margin-top:8px"><span>Bestand heute: <b data-vz="val"></b> Stück</span><input type="range" data-vz="cur" min="0" max="100" step="1" value="0"></label><div data-vz="zone"></div>'; $('[data-vz=cur]', c).addEventListener('input', e => { V.dis.cur = +e.target.value; updDis(c); }); },
    c => updDis(c));
  function updDis(c) {
    const p = disState(), mx = C.maxStock(p.safety, p.qty), sl = $('[data-vz=cur]', c); if (!fin(mx) || !(mx > 0)) return;
    const top = Math.ceil(mx * 1.2 / 10) * 10; sl.max = top; sl.step = mx > 400 ? 10 : 1;
    if (V.dis.cur == null || V.dis.cur > top) V.dis.cur = mx; sl.value = V.dis.cur;
    $('[data-vz=val]', c).textContent = f(V.dis.cur);
    $('[data-vz=svg]', c).innerHTML = disFillSvg(p, V.dis.cur);
    const d = disZone(p, V.dis.cur); $('[data-vz=zone]', c).innerHTML = d ? `<div class="vzzone ${d.z}">${esc(ZTXT[d.z])}</div><p class="hint2">Reichweite = Bestand / Tagesverbrauch = ${esc(f(V.dis.cur))} / ${esc(f(p.daily, 1))} = ${esc(fin(d.reach) ? f(d.reach, 1) : '–')} Tage. Zum Vergleich die Lieferzeit: ${esc(f(p.lead, 0))} Tage.</p>` : '';
  }

  /* ABC */
  hook('#abcView', 'vzAbc', (v, c) => v.appendChild(c), c => { c.innerHTML = '<h4>Wenige Artikel, viel Wert</h4><div class="vzbox" data-vz="svg"></div><h4 style="margin:14px 0 4px">Pareto-Diagramm</h4><div class="vzbox" data-vz="par"></div>'; },
    c => {
      const view = $('#abcView'), rows = {};
      view.querySelectorAll('input[data-i][data-f]').forEach(i => { (rows[i.dataset.i] = rows[i.dataset.i] || {})[i.dataset.f] = i.value; });
      const items = Object.keys(rows).map(k => ({ name: rows[k].n, qty: P(rows[k].q), price: P(rows[k].p) }));
      const ga = $('input[data-g=a]', view), gb = $('input[data-g=b]', view), a = ga ? P(ga.value) : 80, b = gb ? P(gb.value) : 95, lim = a > 0 && b > a && b <= 100 ? { a, b: b - a } : { a: 80, b: 15 };
      const res = C.abc(items, lim); $('[data-vz=svg]', c).innerHTML = abcBarsSvg(res); $('[data-vz=par]', c).innerHTML = paretoSvg(res);
    });
  /* Disposition: Sägezahn nach den Reglern */
  hook('#disView', 'vzSaw', (v, c) => { const d = document.getElementById('vzDis'); if (d && d.nextSibling) v.insertBefore(c, d.nextSibling); else v.appendChild(c); },
    c => { c.innerHTML = '<h4>Bestandsverlauf als Sägezahn</h4><div class="vzbox" data-vz="svg"></div><p class="hint2">Bei Erreichen des Meldebestands wird bestellt (Punkt), während der Lieferzeit (Streifen) sinkt der Bestand weiter bis zum Sicherheitsbestand, dann kommt die Lieferung. Werte aus den Reglern oben.</p>'; },
    c => { $('[data-vz=svg]', c).innerHTML = sawSvg2(disState()); });

  /* Lager: Schaubilder */
  hook('#orgView', 'vzOrg', (v, c) => { const first = v.firstElementChild; if (first && first.nextSibling) v.insertBefore(c, first.nextSibling); else v.appendChild(c); },
    c => {
      let h = '<h4>Lager im Bild</h4><div class="vzchips">', g = '';
      KINDS.forEach(k => { if (k[2] !== g) { g = k[2]; h += `<span class="gl">${esc(g)}</span>`; } h += `<button data-vz="kind" data-kind="${k[0]}">${esc(k[1])}</button>`; });
      c.innerHTML = h + '</div><div class="vzbox" data-vz="svg"></div><div class="vzctl" data-vz="ctl"></div><p class="hint2" data-vz="cap"></p>';
      c.addEventListener('click', e => {
        const b = e.target.closest('[data-vz=kind]'), a = e.target.closest('[data-vz=lane]');
        if (b) { V.art = b.dataset.kind; updArt(c); } else if (a) { laneStep(V.lane, V.art, a.dataset.act); updArt(c); }
      });
    }, c => updArt(c));
  function updArt(c) {
    const kind = V.art, D = root.LAG_DATA;
    c.querySelectorAll('[data-vz=kind]').forEach(b => { const on = b.dataset.kind === kind; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    $('[data-vz=svg]', c).innerHTML = artSvg(kind, V.lane);
    $('[data-vz=ctl]', c).innerHTML = kind === 'fifo' || kind === 'lifo' ? '<button data-vz="lane" data-act="in">＋ Einlagern</button><button data-vz="lane" data-act="out">− Entnehmen</button><button data-vz="lane" data-act="reset">Zurücksetzen</button>' : '';
    const meta = KINDS.find(k => k[0] === kind), o = D && D.org ? D.org.find(x => x.n.indexOf(meta[3]) === 0) : null;
    $('[data-vz=cap]', c).textContent = (o ? o.d + ' ' : '') + (NOTES[kind] || '');
  }

  /* Beispiele: Bestandsverlauf bei den Kennzahlen-Beispielen */
  (function () {
    const view = $('#bspView'), D = root.LAG_DATA; if (!view || !D || !D.examples) return;
    const run = () => D.examples.forEach(e => {
      if (e.tab !== 'kz') return; const card = document.getElementById('ex_' + e.id); if (!card || card.querySelector('.vzout')) return;
      const h = kzViz({ mode: e.p.mode, ab: e.p.ab, eb: e.p.eb, months: e.p.months || [], use: e.p.use, rate: e.p.rate, costs: e.p.costs }); if (!h) return;
      const w = document.createElement('div'); w.className = 'vzout'; w.innerHTML = h; const btn = card.querySelector('.btns'); card.insertBefore(w, btn || null);
    });
    new MutationObserver(() => { if (!view.querySelector('.vzout')) run(); }).observe(view, { childList: true });
    if (view.firstChild) run();
  })();
})(typeof window !== 'undefined' ? window : globalThis);
