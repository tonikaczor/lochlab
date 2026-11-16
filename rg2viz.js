/* rg2viz.js - Regelungstechnik Aufbau: Zeichenfunktionen für Canvas (keine Bibliotheken). Jede Funktion bekommt einen 2D-Kontext, Breite/Höhe in CSS-Pixeln
 * und eine Farbtafel pal; sie läuft auch mit einem Attrappen-Kontext (Test). Schrift mindestens 14 px. Keine NaN-Koordinaten (unendliche/ungültige Werte werden übersprungen). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.RG2VIZ = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const FONT = '14px system-ui, -apple-system, "Segoe UI", sans-serif';
  const ok = v => typeof v === 'number' && isFinite(v);
  const DARK = { bg: '#161b21', panel: '#222830', fg: '#e8ecf0', mute: '#9aa6b2', grid: '#35404b', axis: '#7d8996', accent: '#5aa9ff', ok: '#4cd9a0', warn: '#ffb340', danger: '#ff7a7a', tint: 'rgba(76,217,160,.10)', tintBad: 'rgba(255,122,122,.10)', s: ['#5aa9ff', '#ffb347', '#4cd9a0', '#ff8ac8', '#e6e056', '#b3a3ff'] };
  const LIGHT = { bg: '#f7f9fb', panel: '#ffffff', fg: '#1c2329', mute: '#4f5b66', grid: '#dbe2e8', axis: '#8795a1', accent: '#0b5fa5', ok: '#0a7d52', warn: '#a85d00', danger: '#b3261e', tint: 'rgba(10,125,82,.09)', tintBad: 'rgba(179,38,30,.08)', s: ['#0b5fa5', '#b35a00', '#0a7d52', '#a3317a', '#6b6b00', '#5b4bb7'] };
  const DASHES = [[], [8, 4], [2, 4], [10, 4, 2, 4], [], [6, 3]];

  const fmt = (x, d) => { if (!ok(x)) return '–'; let s = Number(x).toFixed(d == null ? 2 : d).replace('.', ','); if (/^-0(,0*)?$/.test(s)) s = s.slice(1); return s.replace('-', '−'); };
  /* kompakte Zahl für Achsen: wenige Stellen, deutsches Komma */
  function fmtTick(x) {
    if (!ok(x)) return '–';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-4) return fmt(x, 0) === '0' ? x.toExponential(0).replace('e', 'E') : x.toExponential(1).replace('.', ',').replace('e', 'E');
    if (a >= 1e4) return fmt(x / 1e3, 0) + 'k';
    let d = 0; if (a < 100) d = a < 1 ? 3 : a < 10 ? 2 : 1;
    let s = fmt(x, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
  }
  function niceStep(span, target) {
    const raw = span / Math.max(1, target), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
  }
  function niceTicks(lo, hi, target) {
    if (!(hi > lo)) return [lo];
    const st = niceStep(hi - lo, target), out = []; let v = Math.ceil(lo / st - 1e-9) * st;
    for (let k = 0; k < 200 && v <= hi + st * 1e-9; k++, v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : v);
    return out;
  }

  /* ------------------------------------------------------------ Zeichenfläche */
  function plotArea(ctx, W, H, pal, o) {
    o = o || {};
    const padL = o.padL != null ? o.padL : 52, padR = o.padR != null ? o.padR : 12, padT = o.padT != null ? o.padT : 10, padB = o.padB != null ? o.padB : 34;
    const x0 = o.x0 != null ? o.x0 : padL, y0 = o.y0 != null ? o.y0 : padT, w = (o.w != null ? o.w : W - padL - padR), h = (o.h != null ? o.h : H - padT - padB);
    let xl = o.xmin, xh = o.xmax, yl = o.ymin, yh = o.ymax;
    if (!(xh > xl)) { xh = xl + 1; } if (!(yh > yl)) { yh = yl + 1; }
    const lx = o.xlog ? Math.log10 : (v => v), ly = o.ylog ? Math.log10 : (v => v);
    const X = v => x0 + (lx(v) - lx(xl)) / (lx(xh) - lx(xl)) * w, Y = v => y0 + h - (ly(v) - ly(yl)) / (ly(yh) - ly(yl)) * h;
    const P = { x0: x0, y0: y0, w: w, h: h, X: X, Y: Y, xl: xl, xh: xh, yl: yl, yh: yh, xlog: !!o.xlog };
    P.invX = px => { const t = (px - x0) / w; return o.xlog ? Math.pow(10, lx(xl) + t * (lx(xh) - lx(xl))) : xl + t * (xh - xl); };
    P.invY = py => { const t = 1 - (py - y0) / h; return o.ylog ? Math.pow(10, ly(yl) + t * (ly(yh) - ly(yl))) : yl + t * (yh - yl); };
    P.clip = () => { ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip(); };
    P.unclip = () => { ctx.restore(); };
    P.inside = (px, py) => px >= x0 && px <= x0 + w && py >= y0 && py <= y0 + h;
    return P;
  }
  function text(ctx, pal, s, x, y, o) {
    o = o || {}; ctx.font = o.font || FONT; ctx.fillStyle = o.color || pal.mute; ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic';
    if (o.rot) { ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot); ctx.fillText(s, 0, 0); ctx.restore(); } else ctx.fillText(s, x, y);
  }
  function gridXY(ctx, P, pal, o) {
    o = o || {};
    ctx.lineWidth = 1; ctx.strokeStyle = pal.grid; ctx.setLineDash([]);
    const xt = o.xticks || (P.xlog ? decadeTicks(P.xl, P.xh) : niceTicks(P.xl, P.xh, Math.max(2, Math.floor(P.w / 80))));
    const yt = o.yticks || (o.ylog ? decadeTicks(P.yl, P.yh) : niceTicks(P.yl, P.yh, Math.max(2, Math.floor(P.h / 38))));
    ctx.beginPath();
    xt.forEach(v => { const px = P.X(v); if (ok(px) && px >= P.x0 - 0.5 && px <= P.x0 + P.w + 0.5) { ctx.moveTo(px, P.y0); ctx.lineTo(px, P.y0 + P.h); } });
    yt.forEach(v => { const py = P.Y(v); if (ok(py) && py >= P.y0 - 0.5 && py <= P.y0 + P.h + 0.5) { ctx.moveTo(P.x0, py); ctx.lineTo(P.x0 + P.w, py); } });
    ctx.stroke();
    if (!o.noLabels) {
      xt.forEach((v, i) => { const px = P.X(v); if (ok(px) && px >= P.x0 - 1 && px <= P.x0 + P.w + 1 && (!P.xlog || i % (o.xskip || 1) === 0)) text(ctx, pal, o.xfmt ? o.xfmt(v) : fmtTick(v), px, P.y0 + P.h + 17, { align: 'center' }); });
      yt.forEach(v => { const py = P.Y(v); if (ok(py) && py >= P.y0 - 1 && py <= P.y0 + P.h + 1) text(ctx, pal, o.yfmt ? o.yfmt(v) : fmtTick(v), P.x0 - 6, py + 5, { align: 'right' }); });
    }
    ctx.strokeStyle = pal.axis; ctx.lineWidth = 1; ctx.strokeRect(P.x0 + 0.5, P.y0 + 0.5, P.w, P.h);
    return { xt: xt, yt: yt };
  }
  function decadeTicks(lo, hi) { const a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi)), out = []; for (let k = a; k <= b; k++) { const v = Math.pow(10, k); if (v >= lo * 0.9999 && v <= hi * 1.0001) out.push(v); } return out; }
  function polyline(ctx, P, xs, ys, color, width, dash, o) {
    o = o || {}; ctx.strokeStyle = color; ctx.lineWidth = width || 2; ctx.setLineDash(dash || []); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); let pen = false, prevY = 0;
    for (let i = 0; i < xs.length; i++) {
      const px = P.X(xs[i]), py = P.Y(ys[i]);
      if (!ok(px) || !ok(py) || Math.abs(py) > 1e5 || Math.abs(px) > 1e5) { pen = false; continue; }
      if (!pen) { ctx.moveTo(px, py); pen = true; }
      else if (o.stairs) { ctx.lineTo(px, prevY); ctx.lineTo(px, py); }
      else ctx.lineTo(px, py);
      prevY = py;
    }
    ctx.stroke(); ctx.setLineDash([]);
  }
  function cross(ctx, x, y, r, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w || 2.5; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x - r, y + r); ctx.lineTo(x + r, y - r); ctx.stroke(); }
  function ring(ctx, x, y, r, color, w, fill) { ctx.strokeStyle = color; ctx.lineWidth = w || 2.5; ctx.setLineDash([]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } ctx.stroke(); }
  function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function bg(ctx, W, H, pal) { ctx.setLineDash([]); ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, W, H); }
  const vline = (ctx, P, x, color, dash, w) => { const px = P.X(x); if (!ok(px) || px < P.x0 || px > P.x0 + P.w) return; ctx.strokeStyle = color; ctx.lineWidth = w || 1.5; ctx.setLineDash(dash || [5, 4]); ctx.beginPath(); ctx.moveTo(px, P.y0); ctx.lineTo(px, P.y0 + P.h); ctx.stroke(); ctx.setLineDash([]); };
  const hline = (ctx, P, y, color, dash, w) => { const py = P.Y(y); if (!ok(py) || py < P.y0 || py > P.y0 + P.h) return; ctx.strokeStyle = color; ctx.lineWidth = w || 1.5; ctx.setLineDash(dash || [5, 4]); ctx.beginPath(); ctx.moveTo(P.x0, py); ctx.lineTo(P.x0 + P.w, py); ctx.stroke(); ctx.setLineDash([]); };

  /* ------------------------------------------------------------ Sprungantwort */
  /* d: { series: [{t[], y[], ci, stairs, dots, label}], yFinal, band (0.05), marks: [{t, label, ci}], tMax, yClip: [lo, hi], xLabel, yLabel } */
  function drawStep(ctx, W, H, pal, d) {
    bg(ctx, W, H, pal);
    let tMax = d.tMax || 0, lo = Infinity, hi = -Infinity;
    d.series.forEach(s => { s.t.forEach((t, i) => { if (!d.tMax && ok(t)) tMax = Math.max(tMax, t); if (ok(s.y[i]) && (!d.tMax || t <= d.tMax)) { lo = Math.min(lo, s.y[i]); hi = Math.max(hi, s.y[i]); } }); });
    if (ok(d.yFinal)) { lo = Math.min(lo, d.yFinal); hi = Math.max(hi, d.yFinal); }
    lo = Math.min(lo, 0); if (!ok(lo)) lo = 0; if (!ok(hi)) hi = 1;
    if (d.yClip) { lo = Math.max(lo, d.yClip[0]); hi = Math.min(hi, d.yClip[1]); }
    const padY = (hi - lo) * 0.08 || 0.5; hi += padY; if (lo < 0) lo -= padY;
    const P = plotArea(ctx, W, H, pal, { xmin: 0, xmax: tMax || 1, ymin: lo, ymax: hi, padL: 56 });
    if (d.tint && ok(d.yFinal)) { /* Toleranzband */ }
    gridXY(ctx, P, pal);
    P.clip();
    if (ok(d.yFinal)) {
      const b = d.band || 0;
      if (b > 0) { const a = P.Y(d.yFinal * (1 + b)), c = P.Y(d.yFinal * (1 - b)); ctx.fillStyle = pal.tint; ctx.fillRect(P.x0, Math.min(a, c), P.w, Math.abs(c - a)); }
      hline(ctx, P, d.yFinal, pal.mute, [6, 4], 1.2);
    }
    (d.marks || []).forEach(m => { if (ok(m.t)) vline(ctx, P, m.t, pal.s[m.ci || 2], [3, 4], 1.5); });
    d.series.forEach((s, k) => {
      const ci = s.ci != null ? s.ci : k;
      polyline(ctx, P, s.t, s.y, pal.s[ci % pal.s.length], s.w || 2.4, s.dash || DASHES[ci % DASHES.length], { stairs: !!s.stairs });
      if (s.dots) s.t.forEach((t, i) => { const px = P.X(t), py = P.Y(s.y[i]); if (ok(px) && ok(py)) dot(ctx, px, py, 3, pal.s[ci % pal.s.length]); });
    });
    P.unclip();
    text(ctx, pal, d.xLabel || 't in s', P.x0 + P.w, H - 4, { align: 'right' });
    if (d.yLabel) text(ctx, pal, d.yLabel, 4, P.y0 + 12, { align: 'left', color: pal.mute });
    (d.marks || []).forEach((m, i) => { if (ok(m.t) && m.label) { const px = P.X(m.t); if (px >= P.x0 && px <= P.x0 + P.w) text(ctx, pal, m.label, Math.min(P.x0 + P.w - 2, px + 4), P.y0 + 16 + (i % 3) * 16, { color: pal.s[m.ci || 2] }); } });
    return P;
  }

  /* Ausschnitt aus Punkten: enthält alle Punkte samt Rand, die Imaginärachse immer, symmetrisch in Im; Maßstab in x und y wird später gleich gemacht */
  function fitSpan(pts) {
    let xmin = 0, xmax = 0, ymax = 0;
    pts.forEach(z => { if (ok(z.re) && ok(z.im)) { xmin = Math.min(xmin, z.re); xmax = Math.max(xmax, z.re); ymax = Math.max(ymax, Math.abs(z.im)); } });
    const base = Math.max(xmax - xmin, ymax * 2, 1e-6), m = 0.2 * base;
    let xl = xmin - m, xh = Math.max(xmax + m, 0.3 * (-xl)), yh = Math.max(ymax + m, 0.5 * (xh - xl) * 0.4);
    if (!(xh - xl > 1e-9)) { xl = -1; xh = 0.5; yh = 1; }
    if (xh - xl < 0.8 * 2 * yh) xl -= 0.8 * 2 * yh - (xh - xl);   // nicht zu schmal: Platz nach links (stabile Halbebene)
    return { xl: xl, xh: xh, yl: -yh, yh: yh };
  }
  /* ------------------------------------------------------------ s-Ebene / z-Ebene */
  /* d: { poles[], zeros[], extraPoles[] (andere Farbe), plane 's'|'z', range: [xmin, xmax, ymin, ymax] } */
  function drawPZ(ctx, W, H, pal, d) {
    bg(ctx, W, H, pal);
    const pts = (d.poles || []).concat(d.zeros || [], d.extra || []).filter(z => ok(z.re) && ok(z.im));
    let xl, xh, yl, yh;
    if (d.range) { xl = d.range[0]; xh = d.range[1]; yl = d.range[2]; yh = d.range[3]; }
    else { const sp = fitSpan(pts); xl = sp.xl; xh = sp.xh; yl = sp.yl; yh = sp.yh; if (d.plane === 'z') { const mx = Math.max(Math.abs(xl), Math.abs(xh), Math.abs(yh), 1.2); xl = -mx; xh = mx; yl = -mx; yh = mx; } }
    // gleiche Maßstäbe in x und y: Zeichenfläche an das Seitenverhältnis anpassen
    const padL = 46, padR = 10, padT = 10, padB = 30, aw = W - padL - padR, ah = H - padT - padB;
    const sx = aw / (xh - xl), sy = ah / (yh - yl), sc = Math.min(sx, sy);
    const w = (xh - xl) * sc, h = (yh - yl) * sc;
    const P = plotArea(ctx, W, H, pal, { xmin: xl, xmax: xh, ymin: yl, ymax: yh, x0: padL + (aw - w) / 2, y0: padT + (ah - h) / 2, w: w, h: h });
    if (d.plane !== 'z') { ctx.fillStyle = pal.tint; ctx.fillRect(P.x0, P.y0, Math.max(0, Math.min(P.w, P.X(0) - P.x0)), P.h); ctx.fillStyle = pal.tintBad; ctx.fillRect(Math.max(P.x0, P.X(0)), P.y0, Math.max(0, P.x0 + P.w - Math.max(P.x0, P.X(0))), P.h); }
    gridXY(ctx, P, pal, { xticks: niceTicks(xl, xh, Math.max(2, Math.floor(P.w / 70))), yticks: niceTicks(yl, yh, Math.max(2, Math.floor(P.h / 50))) });
    P.clip();
    ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(P.x0, P.Y(0)); ctx.lineTo(P.x0 + P.w, P.Y(0)); ctx.moveTo(P.X(0), P.y0); ctx.lineTo(P.X(0), P.y0 + P.h); ctx.stroke();
    if (d.plane === 'z') { ctx.strokeStyle = pal.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(P.X(0), P.Y(0), Math.abs(P.X(1) - P.X(0)), Math.abs(P.Y(1) - P.Y(0)), 0, 0, Math.PI * 2); ctx.stroke(); }
    (d.zeros || []).forEach(z => { if (ok(z.re) && ok(z.im)) ring(ctx, P.X(z.re), P.Y(z.im), 6, pal.s[1], 2.5); });
    (d.extra || []).forEach(z => { if (ok(z.re) && ok(z.im)) cross(ctx, P.X(z.re), P.Y(z.im), 6, pal.s[2], 2.5); });
    (d.poles || []).forEach(z => { if (ok(z.re) && ok(z.im)) { const bad = d.plane === 'z' ? Math.hypot(z.re, z.im) >= 1 - 1e-9 : z.re > 1e-9; cross(ctx, P.X(z.re), P.Y(z.im), 7, bad ? pal.danger : pal.s[0], 3); } });
    P.unclip();
    text(ctx, pal, d.plane === 'z' ? 'Re z' : 'Re s', P.x0 + P.w, P.y0 + P.h + 17 + 12, { align: 'right' });
    text(ctx, pal, d.plane === 'z' ? 'Im z' : 'Im s', P.x0 + 4, P.y0 + 14, { align: 'left' });
    return P;
  }

  /* ------------------------------------------------------------ Bode */
  /* d: { w[], db[], ph[], asym: {w[], db[]} | null, corners: [w], wc, wpc, pm, gmDb, phFloorStep (90), phBack?: ph2[] (zweite Phase, gestrichelt) } */
  function drawBode(ctx, W, H, pal, d) {
    bg(ctx, W, H, pal);
    const wMin = d.w[0], wMax = d.w[d.w.length - 1];
    const fin = a => a.filter(ok);
    let dbLo = Math.min(...fin(d.db)), dbHi = Math.max(...fin(d.db));
    if (d.asym) { dbLo = Math.min(dbLo, ...fin(d.asym.db)); dbHi = Math.max(dbHi, ...fin(d.asym.db)); }
    dbLo = Math.floor((Math.max(dbLo, -120) - 2) / 20) * 20; dbHi = Math.ceil((Math.min(dbHi, 160) + 2) / 20) * 20; if (dbHi - dbLo < 40) dbHi = dbLo + 40;
    const phs = fin(d.ph).concat(d.phBack ? fin(d.phBack).map(v => Math.max(v, -360)) : []);
    let phLo = Math.min(...phs, -90), phHi = Math.max(...phs, 0);
    /* F10: Mit Totzeit läuft die Phase ins Unendliche. Die Achse endet bei −720° (zwei Umläufe); der Rest wird abgeschnitten und beschriftet. */
    const PH_FLOOR = ok(d.phFloor) ? d.phFloor : -720, cut = phLo < PH_FLOOR;
    const st = d.phStep || 90; phLo = Math.floor((phLo - 1) / st) * st; phHi = Math.ceil((phHi + 1) / st) * st; if (cut) phLo = PH_FLOOR;
    const gap = 26, ph1 = Math.round((H - 10 - 34 - gap) * 0.56), ph2 = H - 10 - 34 - gap - ph1;
    const P1 = plotArea(ctx, W, H, pal, { xmin: wMin, xmax: wMax, ymin: dbLo, ymax: dbHi, xlog: true, padL: 52, y0: 10, h: ph1, w: W - 52 - 12 });
    const P2 = plotArea(ctx, W, H, pal, { xmin: wMin, xmax: wMax, ymin: phLo, ymax: phHi, xlog: true, padL: 52, y0: 10 + ph1 + gap, h: ph2, w: W - 52 - 12 });
    const xskip = Math.max(1, Math.ceil(decadeTicks(wMin, wMax).length / Math.max(2, Math.floor(P1.w / 70))));
    gridXY(ctx, P1, pal, { noLabels: false, xfmt: () => '', yticks: niceTicks(dbLo, dbHi, Math.max(2, Math.floor(ph1 / 38))) });
    gridXY(ctx, P2, pal, { xskip: xskip, yticks: niceTicks(phLo, phHi, Math.max(2, Math.floor(ph2 / 34))) });
    P1.clip();
    hline(ctx, P1, 0, pal.fg, [], 1.3);
    (d.corners || []).forEach(w => vline(ctx, P1, w, pal.mute, [2, 4], 1.2));
    if (d.asym) polyline(ctx, P1, d.asym.w, d.asym.db, pal.s[1], 2, [8, 4]);
    polyline(ctx, P1, d.w, d.db, pal.s[0], 2.6);
    if (ok(d.wc)) vline(ctx, P1, d.wc, pal.ok, [4, 3], 1.5);
    if (ok(d.wpc)) vline(ctx, P1, d.wpc, pal.danger, [4, 3], 1.5);
    P1.unclip();
    P2.clip();
    hline(ctx, P2, -180, pal.danger, [6, 4], 1.4);
    (d.corners || []).forEach(w => vline(ctx, P2, w, pal.mute, [2, 4], 1.2));
    if (d.phBack) polyline(ctx, P2, d.w, d.phBack, pal.s[1], 2, [8, 4]);
    polyline(ctx, P2, d.w, d.ph, pal.s[0], 2.6);
    if (ok(d.wc)) vline(ctx, P2, d.wc, pal.ok, [4, 3], 1.5);
    if (ok(d.wpc)) vline(ctx, P2, d.wpc, pal.danger, [4, 3], 1.5);
    // Phasenreserve als senkrechte Klammer bei ω_D (Rohwert, vom Ausschnitt begrenzt)
    if (ok(d.wc) && ok(d.pm)) { const pmN = d.pm; const px = P2.X(d.wc), a = P2.Y(-180), b = P2.Y(-180 + pmN); if (ok(px) && ok(a) && ok(b)) { ctx.strokeStyle = pal.ok; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(px, a); ctx.lineTo(px, b); ctx.stroke(); } }
    P2.unclip();
    // Amplitudenreserve bei ω_180
    if (ok(d.wpc) && ok(d.gmDb) && Math.abs(d.gmDb) < 200) { P1.clip(); const px = P1.X(d.wpc), a = P1.Y(0), b = P1.Y(-d.gmDb); if (ok(px) && ok(a) && ok(b)) { ctx.strokeStyle = pal.danger; ctx.lineWidth = 3; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(px, a); ctx.lineTo(px, b); ctx.stroke(); } P1.unclip(); }
    text(ctx, pal, '|L| in dB', P1.x0 + 6, P1.y0 + 16);
    text(ctx, pal, 'φ in °' + (cut ? ' (unter ' + fmt(PH_FLOOR, 0) + '° abgeschnitten)' : ''), P2.x0 + 6, P2.y0 + 16);
    text(ctx, pal, 'ω in 1/s', P2.x0 + P2.w, H - 3, { align: 'right' });
    return { P1: P1, P2: P2 };
  }

  /* ------------------------------------------------------------ Nyquist */
  /* d: { re[], im[], R (Ausschnittsradius), wcPoint {re, im}, wpcPoint {re, im} } */
  function drawNyquist(ctx, W, H, pal, d) {
    bg(ctx, W, H, pal);
    const Rr = d.R || 3, xl = -Rr, xh = Rr * 0.5, yl = -Rr * 0.75, yh = Rr * 0.75;
    const padL = 40, padR = 10, padT = 10, padB = 28, aw = W - padL - padR, ah = H - padT - padB, sc = Math.min(aw / (xh - xl), ah / (yh - yl));
    const w = (xh - xl) * sc, h = (yh - yl) * sc;
    const P = plotArea(ctx, W, H, pal, { xmin: xl, xmax: xh, ymin: yl, ymax: yh, x0: padL + (aw - w) / 2, y0: padT + (ah - h) / 2, w: w, h: h });
    gridXY(ctx, P, pal, { xticks: niceTicks(xl, xh, Math.max(2, Math.floor(P.w / 70))), yticks: niceTicks(yl, yh, Math.max(2, Math.floor(P.h / 50))) });
    P.clip();
    ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(P.x0, P.Y(0)); ctx.lineTo(P.x0 + P.w, P.Y(0)); ctx.moveTo(P.X(0), P.y0); ctx.lineTo(P.X(0), P.y0 + P.h); ctx.stroke();
    ctx.strokeStyle = pal.mute; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.ellipse(P.X(0), P.Y(0), Math.abs(P.X(1) - P.X(0)), Math.abs(P.Y(1) - P.Y(0)), 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    polyline(ctx, P, d.re, d.im.map(v => -v), pal.s[0], 1.6, [4, 4]);      // Spiegelkurve (w < 0)
    polyline(ctx, P, d.re, d.im, pal.s[0], 2.8);
    P.unclip();
    // kritischer Punkt −1
    cross(ctx, P.X(-1), P.Y(0), 8, pal.danger, 3);
    if (d.wcPoint && ok(d.wcPoint.re) && ok(d.wcPoint.im)) { ring(ctx, P.X(d.wcPoint.re), P.Y(d.wcPoint.im), 6, pal.ok, 3); }
    if (d.wpcPoint && ok(d.wpcPoint.re) && ok(d.wpcPoint.im)) { dot(ctx, P.X(d.wpcPoint.re), P.Y(d.wpcPoint.im), 5, pal.danger); }
    text(ctx, pal, 'Re L', P.x0 + P.w, P.y0 + P.h + 18, { align: 'right' });
    text(ctx, pal, 'Im L', P.x0 + 4, P.y0 + 14);
    text(ctx, pal, '−1', P.X(-1) + 8, P.Y(0) - 8, { color: pal.danger });
    return P;
  }

  /* ------------------------------------------------------------ Wurzelortskurve */
  /* d: { branches [[{re,im}..]..], poles0[], zeros[], now[] (Pole bei K), kcritPts[], breakaway[], centroid, asymAngles[], range? } */
  function drawLocus(ctx, W, H, pal, d) {
    bg(ctx, W, H, pal);
    const spts = (d.poles0 || []).concat(d.zeros || [], d.now || [], d.kcritPts || []);
    (d.breakaway || []).forEach(b => { if (ok(b.s)) spts.push({ re: b.s, im: 0 }); });
    const sp = fitSpan(spts), k = 1.5;
    const xl = sp.xl * k, xh = sp.xh * k, yl = sp.yl * k, yh = sp.yh * k, R = Math.max(Math.abs(xl), xh, yh);
    const padL = 40, padR = 10, padT = 10, padB = 28, aw = W - padL - padR, ah = H - padT - padB, sc = Math.min(aw / (xh - xl), ah / (yh - yl));
    const w = (xh - xl) * sc, h = (yh - yl) * sc;
    const P = plotArea(ctx, W, H, pal, { xmin: xl, xmax: xh, ymin: yl, ymax: yh, x0: padL + (aw - w) / 2, y0: padT + (ah - h) / 2, w: w, h: h });
    ctx.fillStyle = pal.tint; ctx.fillRect(P.x0, P.y0, Math.max(0, Math.min(P.w, P.X(0) - P.x0)), P.h);
    ctx.fillStyle = pal.tintBad; ctx.fillRect(Math.max(P.x0, P.X(0)), P.y0, Math.max(0, P.x0 + P.w - Math.max(P.x0, P.X(0))), P.h);
    gridXY(ctx, P, pal, { xticks: niceTicks(xl, xh, Math.max(2, Math.floor(P.w / 70))), yticks: niceTicks(yl, yh, Math.max(2, Math.floor(P.h / 50))) });
    P.clip();
    ctx.strokeStyle = pal.axis; ctx.lineWidth = 1.5; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(P.x0, P.Y(0)); ctx.lineTo(P.x0 + P.w, P.Y(0)); ctx.moveTo(P.X(0), P.y0); ctx.lineTo(P.X(0), P.y0 + P.h); ctx.stroke();
    if (ok(d.centroid) && d.asymAngles && d.asymAngles.length) d.asymAngles.forEach(a => { const rad = a * Math.PI / 180, L = R * 4; ctx.strokeStyle = pal.mute; ctx.lineWidth = 1.2; ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(P.X(d.centroid), P.Y(0)); ctx.lineTo(P.X(d.centroid + L * Math.cos(rad)), P.Y(L * Math.sin(rad))); ctx.stroke(); ctx.setLineDash([]); });
    (d.branches || []).forEach((b, i) => { polyline(ctx, P, b.map(z => z.re), b.map(z => z.im), pal.s[i % 2 === 0 ? 0 : 3], 2.2, []); });
    (d.zeros || []).forEach(z => ring(ctx, P.X(z.re), P.Y(z.im), 6, pal.s[1], 2.5));
    (d.poles0 || []).forEach(z => cross(ctx, P.X(z.re), P.Y(z.im), 6, pal.mute, 2.5));
    (d.kcritPts || []).forEach(z => { if (ok(z.re) && ok(z.im)) ring(ctx, P.X(z.re), P.Y(z.im), 7, pal.danger, 2.5); });
    (d.breakaway || []).forEach(b => { if (ok(b.s)) { ctx.fillStyle = pal.warn; ctx.beginPath(); ctx.rect(P.X(b.s) - 4, P.Y(0) - 4, 8, 8); ctx.fill(); } });
    (d.now || []).forEach(z => { if (ok(z.re) && ok(z.im)) { dot(ctx, P.X(z.re), P.Y(z.im), 6, z.re > 1e-9 ? pal.danger : pal.ok); } });
    P.unclip();
    text(ctx, pal, 'Re s', P.x0 + P.w, P.y0 + P.h + 18, { align: 'right' });
    text(ctx, pal, 'Im s', P.x0 + 4, P.y0 + 14);
    return P;
  }

  /* ------------------------------------------------------------ Hilfen für die Oberfläche */
  function palette(el) {
    try {
      const doc = el && el.ownerDocument || (typeof document !== 'undefined' ? document : null); if (!doc) return LIGHT;
      const cs = getComputedStyle(doc.documentElement), g = (n, d) => (cs.getPropertyValue(n) || '').trim() || d;
      const dark = g('--scheme', 'light') === 'dark', base = dark ? DARK : LIGHT;
      return Object.assign({}, base, { bg: g('--cv', base.bg), fg: g('--fg', base.fg), mute: g('--mute', base.mute), grid: g('--grid', base.grid), axis: g('--axis', base.axis), accent: g('--c0', base.accent), s: base.s.map((c, i) => g('--c' + i, c)) });
    } catch (e) { return LIGHT; }
  }
  /* Canvas auf die CSS-Größe bringen (scharf auf Hochauflösung); gibt {ctx, W, H} zurück */
  function fit(canvas) {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(3, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    const W = Math.max(60, Math.round(r.width)), H = Math.max(60, Math.round(r.height));
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) { canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, W: W, H: H };
  }
  /* Bildschirmtext der Linien: Linienart je Farbe, damit die Legende nicht nur von der Farbe abhängt */
  const dashFor = ci => DASHES[ci % DASHES.length];
  return { FONT: FONT, DARK: DARK, LIGHT: LIGHT, DASHES: DASHES, fmt: fmt, fmtTick: fmtTick, niceTicks: niceTicks, plotArea: plotArea, drawStep: drawStep, drawPZ: drawPZ, drawBode: drawBode, drawNyquist: drawNyquist, drawLocus: drawLocus, palette: palette, fit: fit, dashFor: dashFor };
});
