'use strict';
/* Tonfunk Mathe-Brücke: Visualisierungen (Lab-Kennung 'mat2'). Reine Zeichenfunktionen: liefern SVG-Text, ohne DOM, testbar mit
   node quelle/mat2/test_mat2viz.js. Die Breite W (in Pixeln) kommt von der Oberfläche; dadurch entspricht 1 Einheit im SVG einem Bildschirm-Pixel
   und die Schrift bleibt überall 14 px groß (viewBox = Breite × Höhe, Anzeige width:100%). Farben nur über CSS-Klassen der Seite
   (g-ax, g-grid, g-lab, g-c1 ... g-c4, g-fill), keine externen Ressourcen, keine Bewegung. */
(function (root) {
  const C = root.MAT2_CORE || (typeof require === 'function' ? require('./mat2core.js') : null);
  const fin = Number.isFinite, PI = Math.PI, q = v => (fin(v) ? Math.round(v * 10) / 10 : 0);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (v, d) => C.fmtN(v, d == null ? 2 : d, true);
  const T = (x, y, t, cls, extra) => `<text class="g-lab ${cls || ''}" x="${q(x)}" y="${q(y)}"${extra || ''}>${esc(t)}</text>`;
  const L = (x1, y1, x2, y2, cls, extra) => `<line class="${cls || ''}" x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2)}" y2="${q(y2)}"${extra || ''}/>`;
  const svg = (W, H, label, body) => `<svg viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" width="100%" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const okW = W => (fin(W) && W >= 200 ? Math.min(W, 1200) : 320);
  function arrow(x1, y1, x2, y2, cls, w) {
    const a = Math.atan2(y2 - y1, x2 - x1), s = 10, p1 = [x2 - s * Math.cos(a - 0.38), y2 - s * Math.sin(a - 0.38)], p2 = [x2 - s * Math.cos(a + 0.38), y2 - s * Math.sin(a + 0.38)];
    return `<g class="${cls || ''}"><line x1="${q(x1)}" y1="${q(y1)}" x2="${q(x2 - 4 * Math.cos(a))}" y2="${q(y2 - 4 * Math.sin(a))}" style="stroke:currentColor;stroke-width:${w || 2.4}"/><polygon points="${q(x2)},${q(y2)} ${q(p1[0])},${q(p1[1])} ${q(p2[0])},${q(p2[1])}" style="fill:currentColor"/></g>`;
  }
  /* "schöne" Teilung */
  function niceStep(range, n) { const s = range / n, p = Math.pow(10, Math.floor(Math.log10(s))), m = s / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  const axf = v => { if (!fin(v)) return ''; if (v === 0) return '0'; const a = Math.abs(v); return (a >= 10000 || a < 0.01) ? C.fmtSig(v, 2) : f(v, a >= 100 ? 0 : a >= 10 ? 1 : a >= 1 ? 2 : 3); };

  /* Allgemeines Diagramm. o = {H, x0, x1, y0, y1, xlog, xl, yl, series:[{pts, cls, dash}], vlines:[{x, label, cls}], hlines:[{y, label, cls}], dots:[{x, y, cls}]} */
  function plot(o, W, label) {
    W = okW(W); const H = o.H || Math.round(Math.max(200, Math.min(330, W * 0.55))), g = { l: 58, r: 14, t: 14, b: 46 };
    if (!(fin(o.x0) && fin(o.x1) && fin(o.y0) && fin(o.y1)) || !(o.x1 > o.x0) || !(o.y1 > o.y0) || (o.xlog && !(o.x0 > 0))) return '';
    const pw = W - g.l - g.r, ph = H - g.t - g.b, lg = v => Math.log10(v);
    const X = v => g.l + (o.xlog ? (lg(v) - lg(o.x0)) / (lg(o.x1) - lg(o.x0)) : (v - o.x0) / (o.x1 - o.x0)) * pw, Y = v => g.t + ph - (v - o.y0) / (o.y1 - o.y0) * ph;
    let s = '';
    const ys = niceStep(o.y1 - o.y0, Math.max(2, Math.floor(ph / 46)));
    for (let v = Math.ceil(o.y0 / ys - 1e-9) * ys; v <= o.y1 + ys * 1e-9; v += ys) { s += L(g.l, Y(v), W - g.r, Y(v), 'g-grid') + T(g.l - 6, Y(v) + 5, axf(v), 'm', ' text-anchor="end"'); }
    if (o.xlog) { for (let e = Math.ceil(lg(o.x0) - 1e-9); e <= lg(o.x1) + 1e-9; e++) { const v = Math.pow(10, e); s += L(X(v), g.t, X(v), g.t + ph, 'g-grid') + T(X(v), g.t + ph + 18, axf(v), 'm', ' text-anchor="middle"'); } }
    else { const xs = niceStep(o.x1 - o.x0, Math.max(2, Math.floor(pw / 90))); for (let v = Math.ceil(o.x0 / xs - 1e-9) * xs; v <= o.x1 + xs * 1e-9; v += xs) s += L(X(v), g.t, X(v), g.t + ph, 'g-grid') + T(X(v), g.t + ph + 18, axf(v), 'm', ' text-anchor="middle"'); }
    s += L(g.l, g.t + ph, W - g.r, g.t + ph, 'g-ax') + L(g.l, g.t, g.l, g.t + ph, 'g-ax');
    if (o.y0 < 0 && o.y1 > 0) s += L(g.l, Y(0), W - g.r, Y(0), 'g-ax');
    (o.hlines || []).forEach(h => { if (h.y >= o.y0 && h.y <= o.y1) s += L(g.l, Y(h.y), W - g.r, Y(h.y), 'g-ref ' + (h.cls || '')) + (h.label ? T(W - g.r - 4, Y(h.y) - 5, h.label, h.cls || '', ' text-anchor="end"') : ''); });
    (o.vlines || []).forEach(v => { if (v.x >= o.x0 && v.x <= o.x1) s += L(X(v.x), g.t, X(v.x), g.t + ph, 'g-ref ' + (v.cls || '')) + (v.label ? T(X(v.x) + 5, g.t + 14 + (v.dy || 0), v.label, v.cls || '') : ''); });
    (o.series || []).forEach(se => {
      const pts = se.pts.filter(p => fin(p[0]) && fin(p[1]) && (!o.xlog || p[0] > 0)); if (pts.length < 2) return;
      s += `<polyline class="g-line ${se.cls || 'g-c1'}${se.dash ? ' g-dash' : ''}" points="${pts.map(p => q(X(p[0])) + ',' + q(Math.max(g.t - 4, Math.min(g.t + ph + 4, Y(p[1]))))).join(' ')}"/>`;
    });
    (o.dots || []).forEach(d => { if (fin(d.x) && fin(d.y)) s += `<circle class="g-dot ${d.cls || 'g-c2'}" cx="${q(X(d.x))}" cy="${q(Y(d.y))}" r="5"/>`; });
    if (o.xl) s += T((g.l + W - g.r) / 2, H - 6, o.xl, 'm', ' text-anchor="middle"');
    if (o.yl) s += T(14, g.t + ph / 2, o.yl, 'm', ` text-anchor="middle" transform="rotate(-90 14 ${q(g.t + ph / 2)})"`);
    return svg(W, H, label || 'Diagramm', s);
  }
  const legend = items => '<div class="lgd">' + items.map(i => `<span class="lg"><i class="sw ${i[0]}"></i>${esc(i[1])}</span>`).join('') + '</div>';

  /* ============================================================ 1. Komplex: Zeigerdiagramm und Resonanzkurve */
  /* p = {R, L, C, f, U}: Reihenschaltung, Strom ist die Bezugsgröße (waagerecht) */
  /* o.fix = {sc, ox, oy}: Maßstab und Ursprung festhalten (beim Ziehen der Zeigerspitze, sonst wandert die Spitze unter dem Finger weg).
     Die Spitze des Summenzeigers U ist ein Griff (g.tip, Tippfläche 48 px); die Zahlen für das Umrechnen von Bildpunkten in Volt stehen als data-Werte am Griff. */
  function phasorSvg(p, W, o) {
    W = okW(W); const z = C.zSeries(p.R, p.L, p.C, p.f); if (!fin(z.re) || !fin(z.im) || !(p.U > 0) || C.cabs(z) === 0) return '';
    const I = p.U / C.cabs(z), ur = I * p.R, ul = p.L > 0 ? I * C.XL(p.f, p.L) : 0, uc = p.C > 0 ? I * C.XC(p.f, p.C) : 0, ut = ul - uc, phi = C.carg(z);
    const leg = [['g-c1', 'U_R = ' + f(ur, 2) + ' V (Widerstand)']];
    if (ul > 0) leg.push(['g-c2', 'U_L = ' + f(ul, 2) + ' V (Spule, eilt vor)']); if (uc > 0) leg.push(['g-c4', 'U_C = ' + f(uc, 2) + ' V (Kondensator, eilt nach)']);
    leg.push(['g-c3', 'U = ' + f(p.U, 2) + ' V (Summe), φ = ' + f(phi, 1) + '°']);
    const side = W >= 640, legW = side ? 330 : 0, legH = side ? 0 : leg.length * 22 + 10, PW = W - legW;
    const pts = [[0, 0], [ur, 0], [ur, ul], [ur, ut]], xs = pts.map(a => a[0]), ys = pts.map(a => a[1]), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    const H0 = Math.round(Math.max(230, Math.min(340, W * 0.5))), H = H0 + legH, padX = 34, padY = 30, sx = (PW - 2 * padX - 60) / Math.max(1e-9, x1 - x0), sy = (H0 - 2 * padY) / Math.max(1e-9, y1 - y0), sc = Math.min(sx, sy);
    const fx0 = o && o.fix, scF = fx0 ? fx0.sc : sc, ox = fx0 ? fx0.ox : padX + 14 - x0 * sc, oy = fx0 ? fx0.oy : padY + y1 * sc, X = v => ox + v * scF, Y = v => oy - v * scF;
    let s = L(padX - 6, Y(0), PW - 8, Y(0), 'g-grid') + L(X(0), 10, X(0), H0 - 6, 'g-grid') + T(PW - 8, Y(0) - 6, 'Re (I)', 'm', ' text-anchor="end"') + T(X(0) + 6, 20, 'Im', 'm');
    const tag = (x, y, t, dx, dy, cls) => T(X(x) + dx, Y(y) + dy, t, cls, ' text-anchor="middle"');
    if (ur > 0) s += arrow(X(0), Y(0), X(ur), Y(0), 'g-c1') + tag(ur / 2, 0, 'U_R', 0, ut < 0 ? -10 : 20, 'g-c1');
    if (ul > 0) s += arrow(X(ur), Y(0), X(ur), Y(ul), 'g-c2') + tag(ur, ul / 2, 'U_L', 26, 5, 'g-c2');
    if (uc > 0) s += arrow(X(ur), Y(ul), X(ur), Y(ut), 'g-c4') + tag(ur, ul - uc / 2, 'U_C', -26, 5, 'g-c4');
    if (Math.abs(ut) > 1e-9 * Math.max(1, ur)) s += arrow(X(0), Y(0), X(ur), Y(ut), 'g-c3', 3.4) + tag(ur / 2, ut / 2, 'U', -14, ut >= 0 ? -8 : 20, 'g-c3');
    else s += tag(ur, 0, 'U', 0, -12, 'g-c3');
    if (Math.abs(phi) > 0.5 && ur > 0) { const r = Math.min(34, Math.abs(X(ur) - X(0)) * 0.6 + 14), a = Math.atan2(ut, ur); s += `<path class="g-arc" d="M ${q(X(0) + r)} ${q(Y(0))} A ${r} ${r} 0 0 ${a > 0 ? 0 : 1} ${q(X(0) + r * Math.cos(a))} ${q(Y(0) - r * Math.sin(a))}"/>`; }
    if (o && o.drag) s += `<g class="tip" tabindex="0" role="group" aria-label="Zeigerspitze von U. Pfeil rauf oder runter ändert den Winkel, Pfeil links oder rechts den Betrag. Jetzt ${f(p.U, 2)} Volt, ${f(phi, 1)} Grad." data-sc="${scF}" data-ox="${q(ox)}" data-oy="${q(oy)}" data-vb="${W}" data-ph="${PW}" data-h="${H0}" style="touch-action:none"><circle class="tip-hit" cx="${q(X(ur))}" cy="${q(Y(ut))}" r="26"/><circle class="tip-k" cx="${q(X(ur))}" cy="${q(Y(ut))}" r="9"/></g>`;
    leg.forEach((l, i) => { const lx = side ? PW + 10 : 14, ly = side ? 34 + i * 26 : H0 + 22 + i * 22; s += `<rect class="g-bar" x="${q(lx)}" y="${q(ly - 11)}" width="14" height="14" rx="2" style="fill:var(--c)" ${''}/>`.replace('class="g-bar"', 'class="g-bar ' + l[0] + '"') + T(lx + 22, ly + 1, l[1], l[0]); });
    return svg(W, H, 'Zeigerdiagramm der Reihenschaltung: Teilspannungen an R, L und C und Gesamtspannung', s);
  }  /* Resonanzkurve |I|(f) in logarithmischer Frequenzachse */
  function resonanceSvg(p, W) {
    const f0 = C.f0(p.L, p.C); if (!(f0 > 0) || !(p.R > 0) || !(p.U > 0)) return '';
    const x0 = f0 / 20, x1 = f0 * 20, pts = [], n = 240; for (let i = 0; i <= n; i++) { const fr = x0 * Math.pow(x1 / x0, i / n); pts.push([fr, C.iMag(p.U, p.R, p.L, p.C, fr) * 1000]); }
    const imax = p.U / p.R * 1000, Q = C.qSeries(p.R, p.L, p.C);
    return plot({ x0, x1, xlog: true, y0: 0, y1: imax * 1.12, xl: 'Frequenz f in Hz', yl: 'Strom I in mA', series: [{ pts, cls: 'g-c1' }], vlines: [{ x: f0, label: 'f₀ = ' + f(f0, 0) + ' Hz', cls: 'g-c3' }, { x: Math.min(x1, Math.max(x0, p.f)), label: 'f = ' + f(p.f, 0), cls: 'g-c2', dy: 18 }], hlines: [{ y: imax / Math.SQRT2, label: 'I_max/√2', cls: 'g-c4' }], dots: [{ x: Math.min(x1, Math.max(x0, p.f)), y: C.iMag(p.U, p.R, p.L, p.C, p.f) * 1000, cls: 'g-c2' }] }, W, 'Resonanzkurve: Strom über der Frequenz, Güte Q = ' + f(Q, 2));
  }

  /* ============================================================ 2. Netzwerke für das Knotenpotenzialverfahren */
  /* Voreinstellungen: Positionen als Anteile von Breite/Höhe, Bezugsknoten unten */
  const NETS = {
    div2: { k: 'div2', name: 'Spannungsteiler mit Quelle (2 Knoten)', params: [['E', 'Quellenspannung E', 'V', 12], ['R1', 'R₁ (Innenwiderstand)', 'kΩ', 1], ['R2', 'R₂', 'kΩ', 2.2], ['R3', 'R₃', 'kΩ', 4.7]],
      pos: [[0.3, 0.3], [0.75, 0.3]], build: p => ({ n: 2, br: [{ a: 1, b: 0, R: p.R1, E: p.E }, { a: 1, b: 2, R: p.R2 }, { a: 2, b: 0, R: p.R3 }], cs: [] }), names: { br: ['R₁', 'R₂', 'R₃'] } },
    bridge: { k: 'bridge', name: 'Brückenschaltung (3 Knoten)', params: [['U', 'Speisespannung U', 'V', 10], ['R1', 'R₁', 'kΩ', 1], ['R2', 'R₂', 'kΩ', 2.2], ['R3', 'R₃', 'kΩ', 2.2], ['R4', 'R₄', 'kΩ', 1], ['R5', 'R₅ (Brücke)', 'kΩ', 4.7]],
      pos: [[0.5, 0.1], [0.24, 0.5], [0.76, 0.5]], fixed: { node: 1, key: 'U' }, build: p => C.bridgeNet(p.R1, p.R2, p.R3, p.R4, p.R5), names: { br: ['R₁', 'R₂', 'R₃', 'R₄', 'R₅'] } },
    ladder: { k: 'ladder', name: 'Leiternetzwerk mit Stromquelle (3 Knoten)', params: [['I', 'Quellenstrom I', 'mA', 5], ['R1', 'R₁', 'kΩ', 2.2], ['R2', 'R₂', 'kΩ', 1], ['R3', 'R₃', 'kΩ', 4.7], ['R4', 'R₄', 'kΩ', 1], ['R5', 'R₅', 'kΩ', 2.2]],
      pos: [[0.28, 0.3], [0.58, 0.3], [0.86, 0.3]], build: p => ({ n: 3, br: [{ a: 1, b: 0, R: p.R1 }, { a: 1, b: 2, R: p.R2 }, { a: 2, b: 0, R: p.R3 }, { a: 2, b: 3, R: p.R4 }, { a: 3, b: 0, R: p.R5 }], cs: [{ a: 1, b: 0, I: p.I }] }), names: { br: ['R₁', 'R₂', 'R₃', 'R₄', 'R₅'] } }
  };
  /* Zeichnet das Netz; sol = {V[], Ibr[]} (Ibr in der Zählrichtung a→b des Zweigs); preset = Eintrag aus NETS, p = Parameterwerte */
  function netSvg(preset, p, sol, W) {
    W = okW(W); if (!preset || !p) return ''; const net = preset.build(p); if (!C.netCheck(net)) return '';
    const compact = W < 560, H = compact ? 300 : Math.round(Math.max(250, Math.min(380, W * 0.6))), gy = H - 28, left = 34, right = W - 20, nodeP = k => (k === 0 ? null : [left + preset.pos[k - 1][0] * (right - left), 16 + preset.pos[k - 1][1] * (gy - 16)]);
    const V = k => (k === 0 ? 0 : (sol && sol.ok && fin(sol.V[k - 1]) ? sol.V[k - 1] : NaN));
    let s = L(left, gy, right, gy, 'g-ax', ' style="stroke-width:2.4"') + T(left, gy + 20, 'Bezugsknoten 0 (Masse, 0 V)', 'm');
    const R = (x, y, ang, cls) => `<rect class="g-res ${cls || ''}" x="${q(-17)}" y="${q(-7)}" width="34" height="14" rx="2" transform="translate(${q(x)} ${q(y)}) rotate(${q(ang)})"/>`;
    const src = (x, y, t) => `<circle class="g-src" cx="${q(x)}" cy="${q(y)}" r="11"/>` + T(x, y + 5, t, '', ' text-anchor="middle"');
    const side = (x, y, ang, off) => { const a = (ang + 90) * PI / 180; return [x + off * Math.cos(a), y + off * Math.sin(a)]; };
    net.br.forEach((z, i) => {
      let a = nodeP(z.a), b = nodeP(z.b); if (!a) a = [b[0], gy]; if (!b) b = [a[0], gy];
      s += L(a[0], a[1], b[0], b[1], 'g-wire');
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy), ang0 = Math.atan2(dy, dx) * 180 / PI; let ang = ang0; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const tR = z.E ? 0.68 : 0.5, mx = a[0] + dx * tR, my = a[1] + dy * tR;
      s += R(mx, my, ang, 'g-c1');
      const lp = side(mx, my, ang, ang === 90 || ang === -90 ? 0 : (compact ? 22 : -22)); let lx = lp[0], ly = lp[1];
      const rlab = (preset.names.br[i] || 'R') + (compact ? '' : ' = ' + f(z.R, 2) + ' kΩ');
      if (Math.abs(Math.abs(ang) - 90) < 15) s += T(mx + 24, my + 5, rlab, 'g-c1'); else s += T(lx, ly + (ly < my ? 0 : 14), rlab, 'g-c1', ' text-anchor="middle"');
      if (z.E) { const t2 = 0.3, sx = a[0] + dx * t2, sy = a[1] + dy * t2; s += src(sx, sy, '+') + T(sx + 20, sy + 5, (compact ? 'E' : 'E = ' + f(z.E, 1) + ' V'), 'g-c2'); }
      if (!compact && sol && sol.ok && fin(sol.Ibr[i])) { const ix = a[0] + dx * 0.5, iy = a[1] + dy * 0.5, up = Math.abs(Math.abs(ang) - 90) < 15; s += T(up ? ix - 24 : ix, up ? iy + 5 : iy + (dy >= 0 ? 34 : -22), 'I = ' + f(sol.Ibr[i], 3) + ' mA', 'g-c3', up ? ' text-anchor="end"' : ' text-anchor="middle"'); }
    });
    (net.cs || []).forEach(z => {
      const nd = nodeP(z.a), x = nd[0] - 0.09 * (right - left), y = (nd[1] + gy) / 2;
      s += L(x, gy, x, nd[1], 'g-wire') + L(x, nd[1], nd[0], nd[1], 'g-wire') + `<circle class="g-src" cx="${q(x)}" cy="${q(y)}" r="13"/>` + arrow(x, y + 7, x, y - 7, 'g-c2', 2) + T(x - 18, y + 5, 'I = ' + f(z.I, 1) + ' mA', 'g-c2', ' text-anchor="end"');
    });
    if (preset.fixed) {
      const nd = nodeP(preset.fixed.node), x = left + 4, y = (nd[1] + gy) / 2;
      s += L(nd[0], nd[1], x, nd[1], 'g-wire') + L(x, nd[1], x, gy, 'g-wire') + src(x, y, '+') + T(x + 20, y + 5, 'U = ' + f(p[preset.fixed.key], 1) + ' V', 'g-c2');
    }
    const SUBN = ['', '₁', '₂', '₃', '₄', '₅', '₆'];
    for (let k = 1; k <= net.n; k++) {
      const nd = nodeP(k), txt = 'V' + SUBN[k] + (fin(V(k)) ? ' = ' + f(V(k), 3) + ' V' : ''), len = txt.length * 8.4 + 6; let x = nd[0], y = nd[1] - 12 - (compact && k % 2 === 0 ? 24 : 0), an = 'middle';
      if (!compact && nd[0] < W * 0.4 && nd[0] - len - 12 > 6) { x = nd[0] - 10; y = nd[1] + 5; an = 'end'; } else if (!compact && nd[0] > W * 0.6 && nd[0] + len + 12 < W - 4) { x = nd[0] + 10; y = nd[1] + 5; an = 'start'; } else x = Math.max(len / 2 + 4, Math.min(W - len / 2 - 4, nd[0]));
      s += `<circle class="g-node" cx="${q(nd[0])}" cy="${q(nd[1])}" r="6"/>` + T(x, y, txt, 'g-c3', ` text-anchor="${an}"`);
    }    return svg(W, H, 'Schaltbild des Netzwerks mit Knotenpotenzialen und Zweigströmen', s);
  }

  /* ============================================================ 3. Differenzialgleichungen */
  function rlcHorizon(I) {
    if (!I.ok) return NaN; const slow = I.case === 'kriech' ? Math.abs(I.s1.re) : I.alpha;
    return I.case === 'schwing' ? Math.min(7 / Math.max(I.alpha, 1e-9), 30 * 2 * PI / I.wd) : 6 / Math.max(slow, 1e-9);
  }
  /* mode: 'rc' | 'rl' | 'rlc'; p: {R, L, C, U}; Zeiten in Sekunden, Anzeige in ms */
  function deSvg(mode, p, W) {
    const n = 300; let tEnd, fn, yl, yEnd, tau, series = [], vl = [], hl = [];
    if (mode === 'rc') { tau = C.tauRC(p.R, p.C); if (!(tau > 0)) return ''; tEnd = 6 * tau; fn = t => C.firstOrder(0, p.U, tau, t); yEnd = p.U; yl = 'Spannung u_C in V'; }
    else if (mode === 'rl') { tau = C.tauRL(p.R, p.L); if (!(tau > 0)) return ''; tEnd = 6 * tau; fn = t => C.firstOrder(0, p.U / p.R, tau, t) * 1000; yEnd = p.U / p.R * 1000; yl = 'Strom i in mA'; }
    else { const I = C.rlcInfo(p.R, p.L, p.C); if (!I.ok) return ''; tEnd = rlcHorizon(I); fn = t => C.rlcStep(p.R, p.L, p.C, p.U, t); yEnd = p.U; yl = 'Spannung u_C in V'; }
    if (!fin(tEnd) || tEnd <= 0) return '';
    const pts = []; for (let i = 0; i <= n; i++) { const t = tEnd * i / n; pts.push([t * 1000, fn(t)]); }
    series.push({ pts, cls: 'g-c1' });
    let ymax = Math.max.apply(null, pts.map(a => a[1])) * 1.1, ymin = 0;
    hl.push({ y: yEnd, label: 'Endwert ' + f(yEnd, 2), cls: 'g-c3' });
    if (mode === 'rlc') {
      const I = C.rlcInfo(p.R, p.L, p.C);
      if (I.case === 'schwing' && I.alpha > 0) { series.push({ pts: pts.map(a => [a[0], yEnd * (1 + Math.exp(-I.alpha * a[0] / 1000))]), cls: 'g-c2', dash: true }); series.push({ pts: pts.map(a => [a[0], yEnd * (1 - Math.exp(-I.alpha * a[0] / 1000))]), cls: 'g-c2', dash: true }); ymax = Math.max(ymax, yEnd * 1.05); }
      if (I.case === 'schwing' && I.overshoot > 0) hl.push({ y: yEnd * (1 + I.overshoot / 100), label: 'Maximum +' + f(I.overshoot, 1) + ' %', cls: 'g-c4' });
    } else { vl.push({ x: tau * 1000, label: 'τ = ' + f(tau * 1000, 3) + ' ms', cls: 'g-c2' }); hl.push({ y: yEnd * (1 - Math.exp(-1)), label: '63,2 %', cls: 'g-c4' }); }
    return plot({ x0: 0, x1: tEnd * 1000, y0: ymin, y1: Math.max(ymax, yEnd * 1.15), xl: 'Zeit t in ms', yl, series, vlines: vl, hlines: hl }, W, mode === 'rlc' ? 'Sprungantwort des RLC-Kreises' : 'Sprungantwort des Glieds erster Ordnung');
  }

  /* ============================================================ 4. Laplace: Pol-Nullstellen-Plan, Sprungantwort, Betragsgang */
  function polesSvg(tf, W) {
    W = okW(W); const P = C.tfPoles(tf), Z = C.tfZeros(tf), all = P.concat(Z); if (!P.length) return '';
    const ext = Math.max(1, Math.max.apply(null, all.map(z => Math.max(Math.abs(z.re), Math.abs(z.im))))) * 1.35, H = Math.round(Math.max(230, Math.min(340, W * 0.6))), g = { l: 20, r: 20, t: 14, b: 30 };
    const xr = ext * 0.35, ph = H - g.t - g.b, pw = W - g.l - g.r, ys = ph / (2 * ext), xs = pw / (ext + xr), X = v => g.l + (v + ext) * xs, Y = v => g.t + ph / 2 - v * ys;
    let s = `<rect class="g-fill-ok" x="${q(g.l)}" y="${q(g.t)}" width="${q(X(0) - g.l)}" height="${q(ph)}"/><rect class="g-fill-bad" x="${q(X(0))}" y="${q(g.t)}" width="${q(W - g.r - X(0))}" height="${q(ph)}"/>`;
    s += L(g.l, Y(0), W - g.r, Y(0), 'g-ax') + L(X(0), g.t, X(0), g.t + ph, 'g-ax') + T(W - g.r - 4, Y(0) - 6, 'σ = Re(s)', 'm', ' text-anchor="end"') + T(X(0) + 6, g.t + 14, 'jω = Im(s)', 'm');
    s += T(g.l + 6, g.t + ph - 8, 'stabil', 'g-c3') + T(W - g.r - 6, g.t + ph - 8, 'instabil', 'g-c4', ' text-anchor="end"');
    const xm = (cx, cy, c) => `<g class="g-cross ${c}"><line x1="${q(cx - 6)}" y1="${q(cy - 6)}" x2="${q(cx + 6)}" y2="${q(cy + 6)}"/><line x1="${q(cx - 6)}" y1="${q(cy + 6)}" x2="${q(cx + 6)}" y2="${q(cy - 6)}"/></g>`;
    const lbl = (z, t, c) => T(X(z.re) + 9, Y(z.im) - 8, t, c);
    P.forEach((z, i) => { s += xm(X(z.re), Y(z.im), 'g-c4') + (P.length <= 4 ? lbl(z, 's' + (i + 1) + ' = ' + f(z.re, 2) + (z.im !== 0 ? (z.im > 0 ? ' + j' : ' − j') + f(Math.abs(z.im), 2) : ''), 'g-c4') : ''); });
    Z.forEach(z => { s += `<circle class="g-ring g-c1" cx="${q(X(z.re))}" cy="${q(Y(z.im))}" r="6"/>` + lbl(z, 'Nullstelle ' + f(z.re, 2), 'g-c1'); });
    return svg(W, H, 'Pol-Nullstellen-Plan in der s-Ebene: Kreuze sind Pole, Kreise sind Nullstellen', s);
  }
  function tfHorizon(tf) {
    const P = C.tfPoles(tf); if (!P.length) return 1; const re = P.map(z => Math.abs(z.re)).filter(v => v > 1e-9), w = P.map(z => Math.abs(z.im)).filter(v => v > 1e-9);
    const slow = re.length ? Math.min.apply(null, re) : NaN, st = C.stability(P);
    if (st === 'stabil' && fin(slow)) return Math.min(7 / slow, w.length ? 60 * 2 * PI / Math.max.apply(null, w) : 1e9);
    const wm = w.length ? Math.min.apply(null, w) : 1; return 6 * 2 * PI / wm;
  }
  function stepSvg(tf, W, U, ulab) {
    const tEnd = tfHorizon(tf); if (!fin(tEnd) || tEnd <= 0) return ''; const sim = C.stepNumeric(tf, tEnd, 1200); if (!sim.length) return '';
    const pts = sim.map(a => [a[0], a[1] * (U == null ? 1 : U)]); let mx = Math.max.apply(null, pts.map(a => a[1])), mn = Math.min.apply(null, pts.map(a => a[1]));
    if (!fin(mx) || !fin(mn)) return ''; if (mx > 1e6 || mn < -1e6) { mx = Math.min(mx, 1e6); mn = Math.max(mn, -1e6); }
    const dc = C.tfDC(tf) * (U == null ? 1 : U), span = (mx - mn) || 1, y0 = Math.min(0, mn - span * 0.05), y1 = Math.max(0, mx + span * 0.08);
    const hl = []; if (fin(dc) && C.stability(C.tfPoles(tf)) === 'stabil') hl.push({ y: dc, label: 'Endwert ' + f(dc, 3), cls: 'g-c3' });
    return plot({ x0: 0, x1: tEnd, y0, y1: y1 > y0 ? y1 : y0 + 1, xl: 'Zeit t in s', yl: ulab || 'Ausgang y(t)', series: [{ pts, cls: 'g-c1' }], hlines: hl }, W, 'Sprungantwort der Übertragungsfunktion');
  }
  function bodeSvg(tf, W) {
    const P = C.tfPoles(tf).concat(C.tfZeros(tf)), mags = P.map(z => C.cabs(z)).filter(v => v > 1e-9); let w0 = mags.length ? Math.min.apply(null, mags) / 30 : 0.1, w1 = mags.length ? Math.max.apply(null, mags) * 30 : 1000;
    if (!(w1 > w0)) { w0 = 0.1; w1 = 1000; } w0 = Math.pow(10, Math.floor(Math.log10(w0))); w1 = Math.pow(10, Math.ceil(Math.log10(w1)));
    const pts = [], n = 300; for (let i = 0; i <= n; i++) { const w = w0 * Math.pow(w1 / w0, i / n), m = C.dB(C.cabs(C.tfAt(tf, w))); pts.push([w, m]); }
    const ok = pts.filter(a => fin(a[1])); if (ok.length < 10) return ''; const mx = Math.ceil(Math.max.apply(null, ok.map(a => a[1])) / 20) * 20 + 20, mn = Math.floor(Math.min.apply(null, ok.map(a => a[1])) / 20) * 20 - 0;
    return plot({ x0: w0, x1: w1, xlog: true, y0: Math.max(mn, mx - 140), y1: mx, xl: 'Kreisfrequenz ω in rad/s', yl: '|H(jω)| in dB', series: [{ pts: ok, cls: 'g-c1' }], hlines: [{ y: 0, label: '0 dB', cls: 'g-c3' }] }, W, 'Betragsfrequenzgang in Dezibel');
  }

  /* ============================================================ 5. Fourier */
  /* Zeitverlauf: ideales Signal und Teilsumme bis N über zwei Perioden */
  function fourierSvg(kind, A, N, W) {
    W = okW(W); if (!C.SHAPES[kind] || !(A > 0) || !(N >= 1)) return ''; const n = Math.max(500, Math.round(W * 2.4)), a = [], b = [];
    for (let i = 0; i <= n; i++) { const t = 2 * i / n, x = 2 * PI * t - PI * 0; a.push([t, C.signal(kind, A, x)]); b.push([t, C.partial(kind, A, N, x)]); }
    /* Sprungstellen im idealen Signal als senkrechte Linien darstellen: Punkte unmittelbar vor und nach dem Sprung einfügen */
    const ideal = []; for (let i = 0; i <= n; i++) { const t = 2 * i / n; if (kind !== 'triangle' && i > 0) { const prev = a[i - 1][1], cur = a[i][1]; if (Math.abs(cur - prev) > A * 0.9) { ideal.push([t - 1e-9, prev]); } } ideal.push(a[i]); }
    const mx = Math.max.apply(null, b.map(p => p[1]).concat([A])) * 1.08;
    return plot({ x0: 0, x1: 2, y0: -mx, y1: mx, xl: 'Zeit t / T (zwei Perioden)', yl: 'Amplitude in V', series: [{ pts: ideal, cls: 'g-c2', dash: true }, { pts: b, cls: 'g-c1' }], hlines: kind === 'square' ? [{ y: A, label: '+A', cls: 'g-c3' }, { y: -A, label: '−A', cls: 'g-c3' }] : [] }, W, 'Fourier-Teilsumme mit ' + N + ' Gliedern im Vergleich zum idealen Signal');
  }
  /* Amplitudenspektrum bis Ordnung min(N, 25) */
  function spectrumSvg(kind, A, N, W) {
    W = okW(W); if (!C.SHAPES[kind] || !(A > 0) || !(N >= 1)) return ''; const M = Math.min(N, 25), H = Math.round(Math.max(190, Math.min(260, W * 0.42))), g = { l: 58, r: 12, t: 14, b: 44 }, pw = W - g.l - g.r, ph = H - g.t - g.b;
    const bs = []; for (let k = 1; k <= M; k++) bs.push(Math.abs(C.bn(kind, A, k))); const mx = Math.max.apply(null, bs) * 1.12; if (!(mx > 0)) return '';
    const bw = pw / M, Y = v => g.t + ph - v / mx * ph; let s = '';
    const ys = niceStep(mx, 3); for (let v = 0; v <= mx; v += ys) s += L(g.l, Y(v), W - g.r, Y(v), 'g-grid') + T(g.l - 6, Y(v) + 5, axf(v), 'm', ' text-anchor="end"');
    s += L(g.l, g.t + ph, W - g.r, g.t + ph, 'g-ax') + L(g.l, g.t, g.l, g.t + ph, 'g-ax');
    const every = bw >= 22 ? 1 : bw >= 11 ? 2 : 5;
    bs.forEach((v, i) => { const x = g.l + i * bw + bw * 0.15; s += `<rect class="g-bar" x="${q(x)}" y="${q(Y(v))}" width="${q(bw * 0.7)}" height="${q(Math.max(0, g.t + ph - Y(v)))}"/>`; if ((i + 1) % every === 0 || i === 0) s += T(x + bw * 0.35, g.t + ph + 18, String(i + 1), 'm', ' text-anchor="middle"'); });
    s += T((g.l + W - g.r) / 2, H - 6, 'Ordnung n der Harmonischen', 'm', ' text-anchor="middle"') + T(14, g.t + ph / 2, '|b_n| in V', 'm', ` text-anchor="middle" transform="rotate(-90 14 ${q(g.t + ph / 2)})"`);
    return svg(W, H, 'Amplitudenspektrum der Harmonischen', s);
  }

  const API = { plot, legend, phasorSvg, resonanceSvg, NETS, netSvg, deSvg, rlcHorizon, polesSvg, stepSvg, bodeSvg, tfHorizon, fourierSvg, spectrumSvg, niceStep, axf };
  root.MAT2_VIZ = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
