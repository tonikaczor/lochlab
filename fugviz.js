'use strict';
/* Tonfunk Füge-Lab: Visualisierungen (inline-SVG, ohne Bibliotheken). Datei fugviz.js, eingebunden VOR fugui.js.
   Alle Funktionen sind rein und liefern SVG-Text (für die Oberfläche und die Tests). Farben nur über CSS-Variablen (Hell/Dunkel);
   Bewegung nur über die Klasse .fz-pulse, die in fuglab.html nur ohne prefers-reduced-motion animiert wird.
   Verdeckte-Fehler-Prinzip: Aufgabengrafiken (spec.k) zeigen nur Gegebenes und Zusammenhänge, nie die gesuchte Größe (Felder wie showA:false setzen „?“).
   Alle Zahlen sind ÜBUNGSWERTE. window.FUG_VIZ bzw. module.exports. */
(function (root) {
  const C = root.FUG_CORE || (typeof require !== 'undefined' ? require('./fugcore.js') : null);
  const fin = Number.isFinite;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => (C && fin(v) ? C.fmtN(v, d == null ? 1 : d, true) : '–');
  const r1 = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, fin(v) ? v : a));
  const pos = v => fin(v) && v > 0;
  const svg = (w, h, inner, label) => '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '">' + inner + '</svg>';
  const T = (x, y, s, cls, anchor) => '<text class="g-lab' + (cls ? ' ' + cls : '') + '" x="' + r1(x) + '" y="' + r1(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(s) + '</text>';
  const FGC = 'var(--fg)', MUT = 'var(--mute)', ACC = 'var(--accent)', HI = 'var(--hi)', OK = 'var(--ok)', WARN = 'var(--warn)', BAD = 'var(--danger)';
  const plate = (x, y, w, h) => '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + r1(w) + '" height="' + r1(h) + '" fill="var(--mute)" fill-opacity=".3" stroke="var(--mute)" stroke-width="1.5"/>';
  const poly = (pts, fill, op, stroke) => '<polygon points="' + pts.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ') + '" fill="' + fill + '" fill-opacity="' + op + '" stroke="' + (stroke || fill) + '" stroke-width="1.5" stroke-linejoin="round"/>';
  function arrow(x1, y1, x2, y2, col, w) {
    w = w || 3; const a = Math.atan2(y2 - y1, x2 - x1), h = 8 + w, bx = x2 - Math.cos(a) * h * 0.9, by = y2 - Math.sin(a) * h * 0.9, dx = Math.cos(a + Math.PI / 2) * h * 0.45, dy = Math.sin(a + Math.PI / 2) * h * 0.45;
    return '<line x1="' + r1(x1) + '" y1="' + r1(y1) + '" x2="' + r1(bx) + '" y2="' + r1(by) + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/><polygon points="' + r1(x2) + ',' + r1(y2) + ' ' + r1(bx + dx) + ',' + r1(by + dy) + ' ' + r1(bx - dx) + ',' + r1(by - dy) + '" fill="' + col + '"/>';
  }
  const dimH = (x1, x2, y, label, col) => '<path d="M' + r1(x1) + ' ' + r1(y - 5) + 'V' + r1(y + 5) + 'M' + r1(x2) + ' ' + r1(y - 5) + 'V' + r1(y + 5) + 'M' + r1(x1) + ' ' + r1(y) + 'H' + r1(x2) + '" stroke="' + (col || MUT) + '" stroke-width="1.5" fill="none"/>' + T((x1 + x2) / 2, y + 17, label, '', 'middle');
  const dimV = (x, y1, y2, label, col, side) => '<path d="M' + r1(x - 5) + ' ' + r1(y1) + 'H' + r1(x + 5) + 'M' + r1(x - 5) + ' ' + r1(y2) + 'H' + r1(x + 5) + 'M' + r1(x) + ' ' + r1(y1) + 'V' + r1(y2) + '" stroke="' + (col || MUT) + '" stroke-width="1.5" fill="none"/>' + T(side === 'l' ? x - 9 : x + 9, (y1 + y2) / 2 + 4, label, '', side === 'l' ? 'end' : 'start');
  const pulse = inner => '<g class="fz-pulse">' + inner + '</g>';
  const stCol = (r) => (r > 1 ? BAD : r > 0.9 ? WARN : OK);

  /* ============================================================ Kehlnaht im Querschnitt mit a-Maß */
  function kehl(o) {
    o = o || {};
    const a = pos(o.a) ? o.a : pos(o.z) ? o.z / Math.SQRT2 : 4, z = pos(o.z) ? o.z : a * Math.SQRT2, zp = clamp(z * 16, 34, 120), cx = 190, by = 170;
    let s = plate(40, by, 300, 34) + plate(cx - 40, 40, 40, by - 40);
    s += '<rect x="' + (cx - 40) + '" y="' + (by - 1) + '" width="40" height="3" fill="var(--panel)"/>';
    s += poly([[cx, by], [cx, by - zp], [cx + zp, by]], WARN, 0.55);
    s += '<path d="M' + cx + ' ' + by + 'L' + r1(cx + zp / 2) + ' ' + r1(by - zp / 2) + '" stroke="' + FGC + '" stroke-width="2" stroke-dasharray="5 3" fill="none"/>';
    s += '<circle cx="' + r1(cx + zp / 2) + '" cy="' + r1(by - zp / 2) + '" r="3.5" fill="' + FGC + '"/>';
    s += T(cx + zp / 2 + 10, by - zp / 2 - 6, o.showA === false ? 'a = ?' : 'a = ' + f(a, 2) + ' mm', '', 'start');
    s += T(cx - 6, by - zp / 2 + 4, o.showZ === false ? 'z = ?' : 'z = ' + f(z, 2) + ' mm', '', 'end');
    s += T(cx + zp / 2, by + 24, 'z', 'm', 'middle');
    s += T(60, by + 26, 'Grundblech', 'm') + T(cx - 36, 56, 'Stegblech', 'm');
    s += T(40, 234, 'Schnitt durch die Kehlnaht: a ist die Höhe des Dreiecks', 'm');
    /* tragende Fläche a · l */
    const l = pos(o.l) ? o.l : 80, lw = clamp(l * 1.1, 50, 200), ah = clamp(a * 10, 16, 64), rx = 400, ry = 70;
    s += '<rect x="' + rx + '" y="' + ry + '" width="' + r1(lw) + '" height="' + r1(ah) + '" fill="' + ACC + '" fill-opacity=".3" stroke="' + ACC + '" stroke-width="2"/>';
    s += dimH(rx, rx + lw, ry + ah + 10, 'l' + (pos(o.l) ? ' = ' + f(o.l, 0) + ' mm' : ''), ACC);
    s += T(rx - 8, ry + ah / 2 + 4, 'a', '', 'end');
    s += T(rx, ry - 12, 'Tragende Fläche A = a · l', '', 'start');
    if (o.val) s += T(rx, ry + ah + 52, o.val, '', 'start');
    if (pos(o.F)) s += pulse(arrow(cx - 20, 14, cx - 20, 38, HI, 4)) + T(cx - 28, 30, 'F', '', 'end');
    return svg(640, 244, s, 'Kehlnaht im Querschnitt mit a-Maß, z-Maß und tragender Fläche a mal l');
  }

  /* ============================================================ Nahtsymbol und Fugenform */
  function symAt(sym, cx, y) {
    const st = 'fill="none" stroke="' + FGC + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"';
    if (sym === 'I') return '<path d="M' + (cx - 5) + ' ' + y + 'V' + (y - 22) + 'M' + (cx + 5) + ' ' + y + 'V' + (y - 22) + '" ' + st + '/>';
    if (sym === 'V') return '<path d="M' + (cx - 13) + ' ' + (y - 24) + 'L' + cx + ' ' + y + 'L' + (cx + 13) + ' ' + (y - 24) + '" ' + st + '/>';
    if (sym === 'Y') return '<path d="M' + (cx - 13) + ' ' + (y - 24) + 'L' + cx + ' ' + (y - 10) + 'L' + (cx + 13) + ' ' + (y - 24) + 'M' + cx + ' ' + (y - 10) + 'V' + y + '" ' + st + '/>';
    if (sym === 'U') return '<path d="M' + (cx - 13) + ' ' + (y - 24) + 'Q' + (cx - 13) + ' ' + y + ' ' + cx + ' ' + y + 'Q' + (cx + 13) + ' ' + y + ' ' + (cx + 13) + ' ' + (y - 24) + '" ' + st + '/>';
    if (sym === 'K') return '<path d="M' + (cx - 11) + ' ' + y + 'V' + (y - 22) + 'L' + (cx + 11) + ' ' + y + 'Z" ' + st + '/>';
    return '<circle cx="' + cx + '" cy="' + (y - 12) + '" r="10" ' + st + '/>';
  }
  function joint(sym, x0, y0) {
    const t = 26, cx = x0 + 80; let s = '';
    if (sym === 'I') s += poly([[x0, y0], [cx - 4, y0], [cx - 4, y0 + t], [x0, y0 + t]], MUT, 0.3) + poly([[cx + 4, y0], [x0 + 160, y0], [x0 + 160, y0 + t], [cx + 4, y0 + t]], MUT, 0.3) + poly([[cx - 4, y0], [cx + 4, y0], [cx + 4, y0 + t], [cx - 4, y0 + t]], WARN, 0.6);
    else if (sym === 'V') s += poly([[x0, y0], [cx - 22, y0], [cx - 4, y0 + t], [x0, y0 + t]], MUT, 0.3) + poly([[cx + 22, y0], [x0 + 160, y0], [x0 + 160, y0 + t], [cx + 4, y0 + t]], MUT, 0.3) + poly([[cx - 22, y0], [cx + 22, y0], [cx + 4, y0 + t], [cx - 4, y0 + t]], WARN, 0.6);
    else if (sym === 'Y') s += poly([[x0, y0], [cx - 20, y0], [cx - 2, y0 + t * 0.6], [cx - 2, y0 + t], [x0, y0 + t]], MUT, 0.3) + poly([[cx + 20, y0], [x0 + 160, y0], [x0 + 160, y0 + t], [cx + 2, y0 + t], [cx + 2, y0 + t * 0.6]], MUT, 0.3) + poly([[cx - 20, y0], [cx + 20, y0], [cx + 2, y0 + t * 0.6], [cx - 2, y0 + t * 0.6]], WARN, 0.6);
    else if (sym === 'U') s += '<path d="M' + x0 + ' ' + y0 + 'H' + (cx - 22) + 'Q' + (cx - 6) + ' ' + (y0 + t * 0.7) + ' ' + (cx - 2) + ' ' + (y0 + t) + 'H' + x0 + 'Z" fill="' + MUT + '" fill-opacity=".3" stroke="' + MUT + '" stroke-width="1.5"/><path d="M' + (x0 + 160) + ' ' + y0 + 'H' + (cx + 22) + 'Q' + (cx + 6) + ' ' + (y0 + t * 0.7) + ' ' + (cx + 2) + ' ' + (y0 + t) + 'H' + (x0 + 160) + 'Z" fill="' + MUT + '" fill-opacity=".3" stroke="' + MUT + '" stroke-width="1.5"/><path d="M' + (cx - 22) + ' ' + y0 + 'H' + (cx + 22) + 'Q' + (cx + 6) + ' ' + (y0 + t * 0.7) + ' ' + (cx + 2) + ' ' + (y0 + t) + 'H' + (cx - 2) + 'Q' + (cx - 6) + ' ' + (y0 + t * 0.7) + ' ' + (cx - 22) + ' ' + y0 + 'Z" fill="' + WARN + '" fill-opacity=".6" stroke="' + WARN + '" stroke-width="1.5"/>';
    else if (sym === 'K') s += plate(x0, y0 + 50, 160, t) + plate(cx - 13, y0 - 8, t, 58) + poly([[cx + 13, y0 + 50], [cx + 13, y0 + 26], [cx + 37, y0 + 50]], WARN, 0.6);
    else s += plate(x0, y0 + 4, 150, 16) + plate(x0 + 30, y0 + 20, 130, 16) + '<ellipse cx="' + (x0 + 95) + '" cy="' + (y0 + 20) + '" rx="16" ry="11" fill="' + WARN + '" fill-opacity=".6" stroke="' + WARN + '" stroke-width="1.5"/>';
    return s;
  }
  function naht(o) {
    o = o || {}; const sym = C && C.NAHT[o.sym] ? o.sym : 'V', N = C.NAHT[sym], yl = 120;
    let s = T(40, 24, 'Nahtsymbol an der Bezugslinie', 'm') + T(420, 24, 'Querschnitt der Naht', 'm');
    s += '<path d="M150 ' + yl + 'H340" stroke="' + FGC + '" stroke-width="2.5" fill="none"/>' + arrow(150, yl, 62, yl + 62, FGC, 2.5);
    s += symAt(sym, 245, yl);
    if (sym === 'K') {
      if (pos(o.a)) s += T(222, yl - 8, 'a' + f(o.a, 0), '', 'end');
      if (pos(o.l)) s += T(268, yl - 8, f(o.l, 0), '', 'start');
    }
    if (!o.plain) s += T(245, yl + 40, N.n, '', 'middle');
    s += joint(sym, 420, 70);
    return svg(640, 210, s, 'Nahtsymbol mit Bezugslinie und Pfeil, rechts der Querschnitt der Fuge');
  }

  /* ============================================================ Lötspalt */
  function loet(o) {
    o = o || {};
    const s = pos(o.s) ? o.s : (pos(o.D) && pos(o.d) ? (o.D - o.d) / 2 : 0.1), gp = clamp(s * 70, 4, 34), ox1 = 190, ox2 = 420, gy = 100;
    let h = '';
    h += plate(ox1, gy - 28, ox2 - ox1 + 40, 28);
    h += plate(40, gy + gp, ox2 - 40, 28);
    h += '<rect x="' + ox1 + '" y="' + gy + '" width="' + (ox2 - ox1) + '" height="' + r1(gp) + '" fill="var(--panel)"/>';
    if (o.fill) { const fr = o.fill === 'voll' ? 1 : o.fill === 'teil' ? 0.55 : 0.2; h += '<rect x="' + r1(ox2 - (ox2 - ox1) * fr) + '" y="' + gy + '" width="' + r1((ox2 - ox1) * fr) + '" height="' + r1(gp) + '" fill="' + WARN + '" fill-opacity=".85"/>'; }
    else h += pulse(arrow(ox2 + 40, gy + gp / 2, ox2 - 40, gy + gp / 2, WARN, 2.5));
    h += T(60, gy + gp + 46, 'Rohr', 'm') + T(ox1, gy - 36, 'Muffe', 'm');
    h += dimH(ox1, ox2, gy + gp + 50, 'Lötlänge l' + (pos(o.l) ? ' = ' + f(o.l, 0) + ' mm' : ''));
    h += '<path d="M' + (ox1 + 70) + ' ' + (gy + gp / 2) + 'L' + (ox1 + 70) + ' ' + (gy - 54) + '" stroke="' + FGC + '" stroke-width="1.5" fill="none"/><circle cx="' + (ox1 + 70) + '" cy="' + r1(gy + gp / 2) + '" r="2.5" fill="' + FGC + '"/>';
    h += T(ox1 + 76, gy - 52, o.hideS ? 'Spalt s = ?' : 'Spalt s = ' + f(s, 2) + ' mm', '', 'start');
    if (o.showD && pos(o.D) && pos(o.d)) h += T(40, 24, 'Muffe D = ' + f(o.D, 2) + ' mm, Rohr d = ' + f(o.d, 1) + ' mm', '', 'start');
    else h += T(40, 24, 'Rohr in der Muffe, Spalt stark vergrößert', 'm', 'start');
    if (o.kind && C.GAP[o.kind]) {
      const lim = C.GAP[o.kind], X = v => 60 + clamp(v, 0, 0.4) / 0.4 * 520, y = 226, st = C.gapState(o.kind, s);
      h += '<rect x="60" y="' + y + '" width="520" height="14" rx="7" fill="var(--panel)" stroke="' + MUT + '"/><rect x="' + r1(X(lim.lo)) + '" y="' + y + '" width="' + r1(X(lim.hi) - X(lim.lo)) + '" height="14" fill="' + OK + '" fill-opacity=".4"/>';
      h += '<path d="M' + r1(X(s)) + ' ' + (y - 8) + 'V' + (y + 22) + '" stroke="' + (st === 'ok' ? OK : st ? BAD : MUT) + '" stroke-width="4" stroke-linecap="round"/>';
      h += T(60, y + 34, '0', 'm', 'start') + T(580, y + 34, '0,4 mm', 'm', 'end') + T(X((lim.lo + lim.hi) / 2), y + 34, 'Übungsbereich ' + f(lim.lo, 2) + ' bis ' + f(lim.hi, 2), 'm', 'middle');
    }
    return svg(640, o.kind ? 280 : 220, h, 'Lötspalt im Längsschnitt: Rohr in Muffe mit Lot im Spalt');
  }

  /* ============================================================ Klebverbindung mit Scherkraft */
  function kleb(o) {
    o = o || {}; const l = pos(o.l) ? o.l : 12.5, b = pos(o.b) ? o.b : 25, lp = clamp(l * 6, 50, 170), cx = 260, ox1 = cx - lp / 2, ox2 = cx + lp / 2;
    let s = T(40, 24, 'Einfach überlappte Klebung, seitlich gesehen', 'm');
    s += plate(40, 100, ox2 - 40, 18) + plate(ox1, 118, 490 - ox1, 18);
    s += '<rect x="' + r1(ox1) + '" y="116" width="' + r1(lp) + '" height="4" fill="' + WARN + '"/>';
    s += pulse(arrow(ox1 + lp * 0.2, 110, ox1 + lp * 0.2 - 22, 110, HI, 2) + arrow(ox1 + lp * 0.8, 126, ox1 + lp * 0.8 + 22, 126, HI, 2));
    s += pulse(arrow(80, 109, 18, 109, ACC, 4) + arrow(450, 127, 512, 127, ACC, 4));
    s += T(14, 92, pos(o.F) ? 'F = ' + f(o.F, 0) + ' N' : 'F', '', 'start') + T(526, 150, pos(o.F) ? 'F' : '', '', 'end');
    s += dimH(ox1, ox2, 164, 'l = ' + f(l, 1) + ' mm');
    s += T(ox1 - 8, 88, 'Klebschicht (gelb)', 'm', 'end');
    /* Draufsicht der Klebfläche */
    const bh = clamp(b * 2.2, 28, 66), ty = 206;
    s += T(40, ty - 10, 'Draufsicht der Klebfläche', 'm');
    s += '<rect x="' + r1(ox1) + '" y="' + ty + '" width="' + r1(lp) + '" height="' + r1(bh) + '" fill="' + WARN + '" fill-opacity=".45" stroke="' + WARN + '" stroke-width="2"/>';
    s += dimV(ox1 - 12, ty, ty + bh, 'b = ' + f(b, 1), MUT, 'l');
    s += T(ox2 + 12, ty + bh / 2 + 4, 'A = b · l', '', 'start');
    if (o.val) s += T(ox2 + 12, ty + bh / 2 + 22, o.val, '', 'start');
    /* Schub und Schälen */
    const px = 400, py = 214;
    s += T(px, py - 14, 'Schub (günstig)', 'm') + plate(px, py, 70, 8) + plate(px + 30, py + 8, 70, 8) + arrow(px + 4, py + 4, px - 14, py + 4, ACC, 2.5) + arrow(px + 96, py + 12, px + 114, py + 12, ACC, 2.5);
    s += T(px, py + 46, 'Schälen (vermeiden)', 'm') + plate(px, py + 60, 70, 8) + '<path d="M' + (px + 70) + ' ' + (py + 68) + 'L' + (px + 112) + ' ' + (py + 92) + 'L' + (px + 112) + ' ' + (py + 84) + 'L' + (px + 70) + ' ' + (py + 60) + 'Z" fill="' + MUT + '" fill-opacity=".3" stroke="' + MUT + '" stroke-width="1.5"/>' + arrow(px + 112, py + 88, px + 130, py + 110, BAD, 2.5);
    if (fin(o.util)) {
      const u = clamp(o.util, 0, 1.4), y = 330;
      s += '<rect x="40" y="' + y + '" width="300" height="12" rx="6" fill="var(--panel)" stroke="' + MUT + '"/><rect x="40" y="' + y + '" width="' + r1(300 * u / 1.4) + '" height="12" rx="6" fill="' + stCol(u) + '" fill-opacity=".7"/><path d="M' + r1(40 + 300 / 1.4) + ' ' + (y - 5) + 'V' + (y + 17) + '" stroke="' + FGC + '" stroke-width="2"/>';
      s += T(40, y + 32, 'Auslastung ' + f(o.util * 100, 0) + ' % der zulässigen Spannung', 'm', 'start');
    }
    return svg(640, fin(o.util) ? 372 : 330, s, 'Klebverbindung mit Scherkraft, Klebfläche aus Breite mal Überlappung, Vergleich Schub und Schälen');
  }

  /* ============================================================ Nietverbindung */
  function niet(o) {
    o = o || {}; const t1 = pos(o.t1) ? o.t1 : 2, t2 = pos(o.t2) ? o.t2 : 3, d = pos(o.d) ? o.d : 4, s1 = clamp(t1 * 12, 14, 44), s2 = clamp(t2 * 12, 14, 44), dp = clamp(d * 6, 16, 46), cx = 250, y0 = 80, over = dp * 1.5;
    let s = T(40, 24, 'Halbrundniet vor dem Schließen', 'm');
    s += plate(60, y0, 360, s1) + plate(60, y0 + s1, 360, s2);
    s += '<rect x="' + (cx - dp / 2) + '" y="' + (y0 - 4) + '" width="' + dp + '" height="' + r1(s1 + s2 + 4 + over) + '" fill="' + ACC + '" fill-opacity=".45" stroke="' + ACC + '" stroke-width="2"/>';
    s += '<path d="M' + (cx - dp) + ' ' + (y0 - 4) + 'Q' + (cx - dp) + ' ' + (y0 - 4 - dp * 0.9) + ' ' + cx + ' ' + r1(y0 - 4 - dp * 0.9) + 'Q' + (cx + dp) + ' ' + (y0 - 4 - dp * 0.9) + ' ' + (cx + dp) + ' ' + (y0 - 4) + 'Z" fill="' + ACC + '" fill-opacity=".45" stroke="' + ACC + '" stroke-width="2"/>';
    s += '<path d="M' + (cx - dp / 2 - 6) + ' ' + r1(y0 + s1) + 'H' + (cx + dp / 2 + 6) + '" stroke="' + FGC + '" stroke-width="1.5" stroke-dasharray="4 3" fill="none"/>';
    s += T(cx + dp / 2 + 12, y0 + s1 + 4, 'Scherfläche', 'm', 'start');
    const xr = 450, yb = y0 + s1 + s2;
    s += dimV(xr, y0, y0 + s1 + s2, 'Σt = ' + f(t1 + t2, 1) + ' mm', MUT, 'r');
    s += dimV(xr + 130, y0 + s1 + s2, y0 + s1 + s2 + over, '1,5 · d', MUT, 'r');
    s += dimV(xr + 60, y0, y0 + s1 + s2 + over, o.showL ? 'L = ' + f(C.rivetLen(t1 + t2, d), 1) + ' mm' : 'L = ?', ACC, 'r');
    s += T(cx, yb + over + 26, 'Überstand bildet den Schließkopf', 'm', 'middle');
    s += T(cx - dp - 6, y0 - 12, 'd = ' + f(d, 0) + ' mm', '', 'end');
    if (o.F) s += pulse(arrow(90, y0 + s1 / 2, 30, y0 + s1 / 2, HI, 4) + arrow(390, y0 + s1 + s2 / 2, 450, y0 + s1 + s2 / 2, HI, 4));
    return svg(640, 240, s, 'Nietverbindung im Schnitt mit Blechdicken, Schaftdurchmesser und Überstand');
  }

  /* ============================================================ Schraubverbindung im Schnitt */
  function schraube(o) {
    o = o || {};
    const B = o.M && C.BOLT[o.M] ? C.BOLT[o.M] : null, dp = clamp((B ? B.d : 10) * 2.2, 14, 42), cx = 250, hasR = fin(o.ratio) && !o.neutral, r = hasR ? clamp(o.ratio, 0, 1.6) : 0.5, col = hasR ? stCol(r) : MUT;
    let s = T(40, 24, o.neutral ? 'Schraubverbindung im Schnitt' : 'Schraubverbindung im Schnitt: Vorspannkraft und Klemmkraft', 'm');
    s += plate(90, 118, 340, 38) + plate(90, 156, 340, 60);
    s += '<rect x="' + (cx - dp / 2 - 4) + '" y="118" width="' + (dp + 8) + '" height="38" fill="var(--panel)"/>';
    for (let k = 0; k < 7; k++) s += '<path d="M' + (cx - dp / 2) + ' ' + (162 + k * 7) + 'l' + dp + ' 3" stroke="' + MUT + '" stroke-width="1.5" fill="none"/>';
    s += '<rect x="' + (cx - dp / 2) + '" y="108" width="' + dp + '" height="' + 130 + '" fill="' + col + '" fill-opacity=".35" stroke="' + col + '" stroke-width="2.5"/>';
    s += '<rect x="' + (cx - dp * 1.6) + '" y="88" width="' + r1(dp * 3.2) + '" height="22" rx="3" fill="' + col + '" fill-opacity=".45" stroke="' + col + '" stroke-width="2.5"/>';
    s += poly([[cx - dp * 1.6, 110], [cx + dp * 1.6, 110], [cx + dp * 1.6 + 50, 216], [cx - dp * 1.6 - 50, 216]], ACC, 0.1, ACC);
    const L = 10 + r * 26;
    s += pulse(arrow(cx - dp * 2.4, 156 - L, cx - dp * 2.4, 156 - 2, ACC, 3) + arrow(cx - dp * 2.4, 156 + L, cx - dp * 2.4, 158, ACC, 3) + arrow(cx + dp * 2.4, 156 - L, cx + dp * 2.4, 154, ACC, 3) + arrow(cx + dp * 2.4, 156 + L, cx + dp * 2.4, 158, ACC, 3));
    s += T(632, 144, 'Klemmkraft', 'm', 'end');
    s += '<path d="M' + (cx - dp * 1.6) + ' 82A' + r1(dp * 1.6) + ' ' + r1(dp * 1.6) + ' 0 0 1 ' + (cx + dp * 1.6) + ' 82" stroke="' + HI + '" stroke-width="3" fill="none" stroke-linecap="round"/>' + arrow(cx + dp * 1.6 - 4, 76, cx + dp * 1.6 + 8, 84, HI, 3);
    s += T(cx + dp * 1.6 + 22, 72, o.Mnm != null && fin(o.Mnm) ? 'Anzugsmoment M = ' + f(o.Mnm, 1) + ' Nm' : 'Anzugsmoment M', '', 'start');
    s += T(110, 140, o.neutral || !B ? 'Durchgangsloch' : 'Durchgangsloch Ø ' + f(B.dh, 1), 'm', 'start') + T(110, 236, o.neutral || !B ? 'Gewindeloch (Kernloch gebohrt)' : 'Kernloch Ø ' + f(B.kern, 1) + ' (Gewinde ' + o.M + ')', 'm', 'start');
    if (hasR) {
      s += T(632, 104, 'Vorspannkraft ' + (fin(o.Fv) ? f(o.Fv, 1) + ' kN' : ''), '', 'end');
      const y = 262; s += '<rect x="60" y="' + y + '" width="520" height="14" rx="7" fill="var(--panel)" stroke="' + MUT + '"/><rect x="60" y="' + y + '" width="' + r1(520 * clamp(r / 1.3, 0, 1)) + '" height="14" rx="7" fill="' + col + '" fill-opacity=".7"/>';
      s += '<path d="M' + r1(60 + 520 * 0.9 / 1.3) + ' ' + (y - 5) + 'V' + (y + 19) + '" stroke="' + FGC + '" stroke-width="2" stroke-dasharray="3 3"/><path d="M' + r1(60 + 520 / 1.3) + ' ' + (y - 5) + 'V' + (y + 19) + '" stroke="' + BAD + '" stroke-width="2.5"/>';
      s += T(60, y + 36, 'Ausnutzung der Streckgrenze: ' + f(o.ratio * 100, 0) + ' %', 'm', 'start') + T(580, y + 36, '90 % | 100 %', 'm', 'end');
    }
    return svg(640, hasR ? 316 : 250, s, 'Schraubverbindung im Schnitt mit Durchgangsloch, Gewindeloch, Klemmkraft und Anzugsmoment');
  }

  /* ============================================================ Welle-Nabe: Passfeder */
  function pass(o) {
    o = o || {}; const d = pos(o.d) ? o.d : 30, K = C.keyFor(d) || C.KEYS[5], b = pos(o.b) ? o.b : K.b, h = pos(o.h) ? o.h : K.h, t1 = fin(o.t1) ? o.t1 : K.t1, t2 = fin(o.t2) ? o.t2 : K.t2, Rs = clamp(d * 2.4, 44, 100), k = Rs / (d / 2), cx = 170, cy = 152, Rh = Rs + 36;
    let s = T(40, 24, 'Querschnitt: Welle, Passfeder und Nabe', 'm');
    s += '<path fill-rule="evenodd" d="M' + (cx - Rh) + ' ' + cy + 'a' + Rh + ' ' + Rh + ' 0 1 0 ' + 2 * Rh + ' 0a' + Rh + ' ' + Rh + ' 0 1 0 ' + (-2 * Rh) + ' 0ZM' + (cx - Rs) + ' ' + cy + 'a' + Rs + ' ' + Rs + ' 0 1 0 ' + 2 * Rs + ' 0a' + Rs + ' ' + Rs + ' 0 1 0 ' + (-2 * Rs) + ' 0Z" fill="' + MUT + '" fill-opacity=".3" stroke="' + MUT + '" stroke-width="1.5"/>';
    s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r1(Rs) + '" fill="' + ACC + '" fill-opacity=".14" stroke="' + ACC + '" stroke-width="2"/>';
    const top = cy - Rs, bw = b * k, gW = clamp(bw, 8, 60), kh = h * k, khub = t2 * k;
    s += '<rect x="' + r1(cx - gW / 2) + '" y="' + r1(top - khub) + '" width="' + r1(gW) + '" height="' + r1(khub + t1 * k) + '" fill="var(--panel)" stroke="' + MUT + '" stroke-width="1.5"/>';
    s += '<rect x="' + r1(cx - gW / 2 + 1) + '" y="' + r1(top + t1 * k - kh) + '" width="' + r1(gW - 2) + '" height="' + r1(kh) + '" fill="' + WARN + '" fill-opacity=".6" stroke="' + WARN + '" stroke-width="2"/>';
    s += '<path d="M' + (cx - Rs) + ' ' + cy + 'H' + (cx + Rs) + '" stroke="' + FGC + '" stroke-width="1.5" stroke-dasharray="5 3" fill="none"/>' + T(cx, cy + 16, 'd = ' + f(d, 0) + ' mm', '', 'middle');
    s += '<path d="M' + (cx + Rh + 12) + ' ' + cy + 'A' + (Rh + 12) + ' ' + (Rh + 12) + ' 0 0 0 ' + r1(cx + (Rh + 12) * 0.7) + ' ' + r1(cy + (Rh + 12) * 0.7) + '" stroke="' + HI + '" stroke-width="3" fill="none" stroke-linecap="round"/>' + arrow(cx + (Rh + 12) * 0.74, cy + (Rh + 12) * 0.62, cx + (Rh + 12) * 0.66, cy + (Rh + 12) * 0.78, HI, 3);
    s += T(cx, cy + Rh + 26, 'Drehmoment', 'm', 'middle');
    const tx = 330; let y = 60;
    const lg = (c, t) => { const r = '<rect x="' + tx + '" y="' + (y - 11) + '" width="16" height="14" rx="3" fill="' + c + '" fill-opacity=".5" stroke="' + c + '"/>' + T(tx + 24, y, t, '', 'start'); y += 24; return r; };
    s += lg(ACC, 'Welle') + lg(MUT, 'Nabe') + lg(WARN, 'Passfeder');
    if (!o.hide) {
      y += 6; s += T(tx, y, 'b × h = ' + f(b, 0) + ' × ' + f(h, 0) + ' mm', '', 'start'); y += 22; s += T(tx, y, 't1 (Welle) = ' + f(t1, 1) + ' mm', '', 'start'); y += 22; s += T(tx, y, 't2 (Nabe) = ' + f(t2, 1) + ' mm', '', 'start'); y += 22;
    } else { y += 6; s += T(tx, y, 'Maße: siehe Tabelle', 'm', 'start'); y += 22; }
    (o.info || []).forEach(t => { s += T(tx, y, t, '', 'start'); y += 22; });
    return svg(640, 296, s, 'Querschnitt einer Passfederverbindung mit Welle, Nabe und Passfeder');
  }

  /* ============================================================ Welle-Nabe: Pressverband */
  function press(o) {
    o = o || {}; const U = fin(o.U) ? o.U : 0.04, pl = fin(o.play) ? o.play : 0, ex = clamp(U * 120, 5, 18), has = fin(o.dT), dT = has ? o.dT : 0, glow = clamp(dT / 400, 0, 0.6), bh = 80, cy = 130;
    let s = T(40, 24, 'Pressverband: Die Welle ist größer als die Bohrung', 'm');
    s += '<rect x="300" y="55" width="170" height="150" fill="' + HI + '" fill-opacity="' + r1(0.12 + glow) + '" stroke="' + MUT + '" stroke-width="2"/>';
    s += '<rect x="300" y="' + (cy - bh / 2) + '" width="170" height="' + bh + '" fill="var(--panel)" stroke="' + MUT + '" stroke-width="1.5"/>';
    s += '<rect x="40" y="' + (cy - bh / 2 - ex) + '" width="220" height="' + (bh + 2 * ex) + '" fill="' + ACC + '" fill-opacity=".25" stroke="' + ACC + '" stroke-width="2"/>';
    s += pulse(arrow(262, cy, 296, cy, HI, 3));
    if (has && dT > 0) { const g = clamp((U + pl) * 100, 4, 24); s += '<rect x="300" y="' + r1(cy - bh / 2 - g / 2) + '" width="170" height="' + r1(bh + g) + '" fill="none" stroke="' + HI + '" stroke-width="2" stroke-dasharray="6 4"/>'; }
    s += dimV(30, cy - bh / 2, cy + bh / 2, 'd', MUT, 'l');
    s += T(40, 214, 'Welle: d + Übermaß', 'm') + T(300, 224, 'Nabe (Bohrung d)', 'm') + T(40, 248, 'Übermaß U = ' + f(U, 2) + ' mm' + (pl > 0 ? ', Fügespiel ' + f(pl, 2) + ' mm' : ''), '', 'start');
    const th = 150, tx = 520;
    s += '<rect x="' + tx + '" y="55" width="22" height="' + th + '" rx="11" fill="var(--panel)" stroke="' + MUT + '" stroke-width="1.5"/><rect x="' + (tx + 3) + '" y="' + r1(55 + th - 6 - clamp(dT / 300, 0, 1) * (th - 12)) + '" width="16" height="' + r1(6 + clamp(dT / 300, 0, 1) * (th - 12)) + '" rx="8" fill="' + HI + '" fill-opacity=".8"/>';
    s += T(tx + 11, 46, has ? 'ΔT = ' + f(dT, 0) + ' K' : 'ΔT = ?', '', 'middle');
    return svg(640, 258, s, 'Pressverband: Welle mit Übermaß, Nabe wird zum Fügen erwärmt, Thermometer');
  }

  /* ============================================================ Stecken und Klemmen */
  function stecken() {
    let s = T(40, 24, 'Bolzen mit Sicherungsring und Klemmverbindung', 'm');
    s += plate(60, 70, 60, 110) + plate(220, 70, 60, 110) + plate(120, 100, 100, 50);
    s += '<rect x="30" y="118" width="280" height="14" fill="' + ACC + '" fill-opacity=".45" stroke="' + ACC + '" stroke-width="2"/>';
    s += '<path d="M60 108V142M280 108V142" stroke="' + WARN + '" stroke-width="5" stroke-linecap="round"/>';
    s += T(60, 60, 'Sicherungsring', 'm', 'middle') + T(280, 60, 'Sicherungsring', 'm', 'middle') + T(170, 196, 'Bolzen (Formschluss)', 'm', 'middle');
    s += '<circle cx="470" cy="125" r="44" fill="' + ACC + '" fill-opacity=".25" stroke="' + ACC + '" stroke-width="2"/><circle cx="470" cy="125" r="28" fill="var(--panel)" stroke="' + MUT + '" stroke-width="1.5"/>';
    s += '<rect x="456" y="64" width="28" height="12" fill="' + MUT + '" fill-opacity=".5" stroke="' + MUT + '"/>' + pulse(arrow(440, 52, 456, 70, HI, 3) + arrow(500, 52, 484, 70, HI, 3));
    s += T(470, 196, 'Klemmung (Reibung)', 'm', 'middle');
    return svg(640, 210, s, 'Bolzenverbindung mit Sicherungsringen und eine Klemmverbindung');
  }
  function schweiss() {
    let s = T(40, 24, 'Schweißen: Grundwerkstoff und Zusatz schmelzen zusammen', 'm');
    s += plate(60, 150, 300, 30) + plate(180, 60, 30, 90) + poly([[210, 150], [210, 120], [240, 150]], WARN, 0.7);
    s += '<path d="M300 60L232 128" stroke="' + FGC + '" stroke-width="5" stroke-linecap="round"/><path d="M250 112l-8 -6l12 -2l-6 -8" stroke="' + HI + '" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
    s += pulse('<path d="M236 118l-6 -10M242 114l2 -12M230 126l-12 -4" stroke="' + HI + '" stroke-width="2.5" stroke-linecap="round"/>');
    s += T(310, 60, 'Elektrode', 'm', 'start') + T(300, 220, 'Naht aus Dreiecksquerschnitt', 'm', 'middle');
    return svg(640, 240, s, 'Schweißen: Elektrode und Lichtbogen an einer Kehlnaht');
  }

  /* ============================================================ Verfahrenskarte, Schlussarten, DIN-8593-Gliederung */
  function verf(id) {
    if (id === 'sw') return schweiss();
    if (id === 'lo') return loet({ D: 22.2, d: 22, s: 0.1, l: 20, fill: 'voll' });
    if (id === 'kl') return kleb({ b: 25, l: 12.5 });
    if (id === 'ni') return niet({ t1: 2, t2: 3, d: 4, showL: true });
    if (id === 'sr') return schraube({ M: 'M10', c: '8.8', ratio: 0.66, Fv: 24.5, Mnm: 49 });
    if (id === 'wn') return pass({ d: 30 });
    if (id === 'pv') return press({ U: 0.04, play: 0.04, dT: 150 });
    return stecken();
  }
  function schluss(kind) {
    const L = [['Stoffschluss', 'Stoffschluss'], ['Formschluss', 'Formschluss'], ['Kraftschluss', 'Kraftschluss']];
    let s = '';
    L.forEach((x, i) => { const on = kind && String(kind).indexOf(x[0]) >= 0; s += '<rect x="' + (10 + i * 210) + '" y="6" width="200" height="40" rx="12" fill="' + (on ? ACC : 'var(--panel)') + '" fill-opacity="' + (on ? 0.3 : 1) + '" stroke="' + (on ? ACC : MUT) + '" stroke-width="' + (on ? 3 : 1.5) + '"/>' + T(110 + i * 210, 31, x[1], on ? '' : 'm', 'middle'); });
    return svg(640, 52, s, 'Schlussarten: Stoffschluss, Formschluss, Kraftschluss; die zutreffende ist hervorgehoben');
  }
  function din(hl) {
    let s = '';
    C.DIN8593.forEach((g, i) => {
      const x = 10 + (i % 3) * 210, y = 8 + Math.floor(i / 3) * 62, on = g.n === hl;
      s += '<rect x="' + x + '" y="' + y + '" width="200" height="54" rx="10" fill="' + (on ? ACC : 'var(--panel)') + '" fill-opacity="' + (on ? 0.3 : 1) + '" stroke="' + (on ? ACC : MUT) + '" stroke-width="' + (on ? 3 : 1.5) + '"/>' + T(x + 12, y + 22, g.n, '', 'start') + T(x + 52, y + 22, g.t, '', 'start') + T(x + 12, y + 42, g.ex.length > 30 ? g.ex.slice(0, 30) + '…' : g.ex, 'm', 'start');
    });
    return svg(640, 200, s, 'Gliederung des Fügens nach DIN 8593, Untergruppen 4.1 bis 4.9');
  }

  /* Aufgabengrafik aus einer Beschreibung q.viz */
  function render(v) {
    if (!v || !v.k) return '';
    if (v.k === 'kehl') return kehl(v);
    if (v.k === 'naht') return naht(v);
    if (v.k === 'loet') return loet(v);
    if (v.k === 'kleb') return kleb(v);
    if (v.k === 'niet') return niet(v);
    if (v.k === 'schraube') return schraube(v);
    if (v.k === 'pass') return pass(v);
    if (v.k === 'press') return press(v);
    if (v.k === 'verf') return verf(v.id);
    return '';
  }

  const api = { kehl, naht, symAt, joint, loet, kleb, niet, schraube, pass, press, stecken, schweiss, verf, schluss, din, render };
  root.FUG_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
