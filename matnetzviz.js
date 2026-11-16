'use strict';
/* Tonfunk Rechen-Lab: Schaltbild der Widerstandsnetzwerke (window.MAT_NETZVIZ, per Node testbar).
   Zeichnet den Baum aus matnetz.js (Reihen- und Parallelgruppen) als SVG: Widerstände als Rechtecke nach DIN EN 60617 / IEC 60617,
   Gleichspannungsquelle als Batteriezeichen (langer Strich = Plus), Leitungen rechtwinklig, Knotenpunkte als Punkte,
   Beschriftung Name und Wert. Reihenschaltungen laufen nach rechts, Parallelzweige untereinander.
   Farben nur über CSS-Klassen (.nz-*, in matlab.html) und damit über die Variablen des Labs; Schrift mindestens 12 px. Keine Animation.
   schaltbild(baum, opt): opt = { U: 'U = 12 V', hl: 'R23' (Name des hervorgehobenen Widerstands oder der Gruppe), titel: 'Alternativtext' } */
(function (root) {
  const N = root.MAT_NETZ || (typeof require !== 'undefined' ? require('./matnetz.js') : null);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f1 = v => (Math.round(v * 10) / 10).toString();

  const LW = 72, LH = 64, LCY = 32, BW = 44, BH = 16, PAD = 12;   /* Zelle eines Widerstands: Breite, Höhe, Mittellinie; Körper; seitlicher Rand der Parallelgruppen */

  /* Größe messen: n.L = { w, h, cy } (cy = Höhe der Mittellinie, an der die Gruppe außen angeschlossen wird) */
  function messe(n) {
    if (n.t === 'R') return (n.L = { w: LW, h: LH, cy: LCY });
    n.kids.forEach(messe);
    if (n.t === 'S') {
      const cy = Math.max.apply(null, n.kids.map(k => k.L.cy)), un = Math.max.apply(null, n.kids.map(k => k.L.h - k.L.cy));
      return (n.L = { w: n.kids.reduce((a, k) => a + k.L.w, 0), h: cy + un, cy });
    }
    let y = 0; n.kids.forEach(k => { k.L.oy = y; y += k.L.h; });
    const c0 = n.kids[0].L.oy + n.kids[0].L.cy, c1 = n.kids[n.kids.length - 1].L.oy + n.kids[n.kids.length - 1].L.cy;
    return (n.L = { w: Math.max.apply(null, n.kids.map(k => k.L.w)) + 2 * PAD, h: y, cy: (c0 + c1) / 2 });
  }
  const gesucht = (n, name) => n.name === name;
  function zeichne(n, x, y, hl, out) {
    const L = n.L, cy = y + L.cy;
    if (hl && gesucht(n, hl)) out.hl.push(`<rect class="nz-hl" x="${f1(x + 2)}" y="${f1(y + 2)}" width="${f1(L.w - 4)}" height="${f1(L.h - 4)}" rx="8"/>`);
    if (n.t === 'R') {
      const bx = x + (L.w - BW) / 2, heiss = hl && gesucht(n, hl);
      out.w.push(`M${f1(x)} ${f1(cy)}H${f1(bx)}M${f1(bx + BW)} ${f1(cy)}H${f1(x + L.w)}`);
      out.k.push(`<rect class="nz-r${heiss ? ' nz-hot' : ''}" x="${f1(bx)}" y="${f1(cy - BH / 2)}" width="${BW}" height="${BH}"/>`);
      out.t.push(`<text class="nz-n" x="${f1(x + L.w / 2)}" y="${f1(cy - 14)}" text-anchor="middle">${esc(n.name)}</text><text class="nz-v" x="${f1(x + L.w / 2)}" y="${f1(cy + 29)}" text-anchor="middle">${esc(N.fw(n.r, 'R'))}</text>`);
      return;
    }
    if (n.t === 'S') {
      let cx = x; n.kids.forEach(k => { zeichne(k, cx, y + L.cy - k.L.cy, hl, out); cx += k.L.w; });
      return;
    }
    const bl = x + PAD / 2 + 2, br = x + L.w - PAD / 2 - 2, c0 = y + n.kids[0].L.oy + n.kids[0].L.cy, c1 = y + n.kids[n.kids.length - 1].L.oy + n.kids[n.kids.length - 1].L.cy;
    out.w.push(`M${f1(x)} ${f1(cy)}H${f1(bl)}M${f1(br)} ${f1(cy)}H${f1(x + L.w)}M${f1(bl)} ${f1(c0)}V${f1(c1)}M${f1(br)} ${f1(c0)}V${f1(c1)}`);
    out.d.push(`<circle class="nz-p" cx="${f1(bl)}" cy="${f1(cy)}" r="3.5"/><circle class="nz-p" cx="${f1(br)}" cy="${f1(cy)}" r="3.5"/>`);
    n.kids.forEach((k, i) => {
      const kx = x + (L.w - k.L.w) / 2, ky = y + k.L.oy, kc = ky + k.L.cy;
      out.w.push(`M${f1(bl)} ${f1(kc)}H${f1(kx)}M${f1(kx + k.L.w)} ${f1(kc)}H${f1(br)}`);
      if (i > 0 && i < n.kids.length - 1) out.d.push(`<circle class="nz-p" cx="${f1(bl)}" cy="${f1(kc)}" r="3.5"/><circle class="nz-p" cx="${f1(br)}" cy="${f1(kc)}" r="3.5"/>`);
      zeichne(k, kx, ky, hl, out);
    });
  }
  /* Beschreibung für Bildschirmleser */
  function beschreibe(n, top) {
    if (n.t === 'R') return n.name + ' (' + N.fw(n.r, 'R') + ')';
    const t = n.kids.map(k => beschreibe(k)).join(n.t === 'S' ? ', dann ' : ' parallel zu ');
    return top ? t : (n.t === 'S' ? 'Reihe aus ' : 'Parallelgruppe aus ') + '[' + t + ']';
  }

  function schaltbild(baum, opt) {
    opt = opt || {};
    if (!baum || !N) return '';
    messe(baum);
    const L = baum.L, mx = 12, sx = mx + 14, nx = sx + 76, ny = 12, yc = ny + L.cy;
    const yb = Math.max(yc + 76, ny + L.h + 16), rx = nx + L.w + 14, W = rx + mx, H = yb + 12, y0 = (yc + yb) / 2;
    const out = { hl: [], w: [], k: [], t: [], d: [] };
    zeichne(baum, nx, ny, opt.hl, out);
    out.w.push(`M${f1(sx)} ${f1(y0 - 6)}V${f1(yc)}H${f1(nx)}M${f1(nx + L.w)} ${f1(yc)}H${f1(rx)}V${f1(yb)}H${f1(sx)}V${f1(y0 + 6)}`);
    const quelle = `<line class="nz-q1" x1="${f1(sx - 14)}" x2="${f1(sx + 14)}" y1="${f1(y0 - 6)}" y2="${f1(y0 - 6)}"/><line class="nz-q2" x1="${f1(sx - 8)}" x2="${f1(sx + 8)}" y1="${f1(y0 + 6)}" y2="${f1(y0 + 6)}"/>`
      + `<text class="nz-plus" x="${f1(sx + 20)}" y="${f1(y0 - 3)}">+</text><text class="nz-n" x="${f1(sx + 20)}" y="${f1(y0 + 17)}">${esc(opt.U || 'U')}</text>`;
    const titel = opt.titel || ('Schaltbild: Spannungsquelle ' + (opt.U || 'U') + ' mit ' + beschreibe(baum, true));
    return `<svg class="nz-svg" viewBox="0 0 ${f1(W)} ${f1(H)}" width="${f1(W)}" height="${f1(H)}" role="img" aria-label="${esc(titel)}">${out.hl.join('')}<path class="nz-w" d="${out.w.join('')}"/>${out.k.join('')}${out.d.join('')}${quelle}${out.t.join('')}</svg>`;
  }

  const api = { schaltbild, messe, LW, LH };
  root.MAT_NETZVIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
