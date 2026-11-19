'use strict';
/* Tonfunk Lab "Funk- und HF-Lab": Zeichnen und Modelle der Visualisierungen (Canvas 2D, ohne Bibliotheken).
   plot(ctx, w, h, P, o): allgemeiner Linien-/Stab-Zeichner (lineare und logarithmische x-Achse, Bänder, Markierungen, Texte).
   MODELS.<block>(state) liefert { plots: { <canvas-Schlüssel>: o }, metrics: [{k, v, u, f, t}], aria } und ist reine Rechnung (ohne DOM, per Node testbar).
   Schrift 14 px (CSS-Pixel); Farben nur aus den Variablen --c1..--c4, --fg, --mute, --line, --panel2 (hell/dunkel) mit Rückfall.
   Robust: Achsen mit ungültigen Grenzen werden ersetzt, nicht endliche Punkte werden übersprungen; höchstens 1601 Punkte je Kurve.
   Export: window.HF_VIZ bzw. module.exports. */
(function (root) {
  const C = root.HF_CORE || (typeof require === 'function' ? require('./hfcore.js') : null);
  const TAU = 2 * Math.PI, fin = v => typeof v === 'number' && isFinite(v);
  const FS = 14;
  const FONT = FS + 'px system-ui,-apple-system,"Segoe UI",sans-serif';
  const clamp = (v, a, b) => Math.min(b, Math.max(a, fin(v) ? v : a));

  /* ---------------- Farben ---------------- */
  function pal() {
    let cs = null;
    try { if (typeof document !== 'undefined' && root.getComputedStyle) cs = root.getComputedStyle(document.documentElement); } catch (e) {}
    const g = (n, fb) => { let v = ''; try { v = cs ? cs.getPropertyValue(n).trim() : ''; } catch (e) {} return v || fb; };
    return { bg: g('--panel2', '#2c343e'), fg: g('--fg', '#e8ecf0'), mute: g('--mute', '#8d99a6'), line: g('--line', '#38424d'), c1: g('--c1', '#5ab0ff'), c2: g('--c2', '#ffb340'), c3: g('--c3', '#5fd38d'), c4: g('--c4', '#ff7ab6') };
  }

  /* ---------------- Skalen und Ticks ---------------- */
  function niceTicks(lo, hi, target) {
    if (!fin(lo) || !fin(hi) || !(hi > lo)) return fin(lo) ? [lo] : [];
    const raw = (hi - lo) / Math.max(1, target || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9 && out.length < 200; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  }
  function logTicks(lo, hi) {
    if (!(lo > 0) || !(hi > lo)) return [];
    const out = [], a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
    for (let e = a; e <= b && out.length < 60; e++) { const v = Math.pow(10, e); if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); }
    return out;
  }
  const fmtF = f => f >= 1e9 ? C.fmt(f / 1e9, 3) + 'G' : f >= 1e6 ? C.fmt(f / 1e6, 3) + 'M' : f >= 1e3 ? C.fmt(f / 1e3, 3) + 'k' : C.fmt(f, 3);
  const fmtN = v => C.fmt(v, 3);

  /* Achsen absichern: nie Division durch null, nie Logarithmus von null */
  function safeAxes(o) {
    const r = Object.assign({}, o);
    if (!fin(r.x0)) r.x0 = r.xlog ? 1 : 0;
    if (r.xlog && !(r.x0 > 0)) r.x0 = 1e-3;
    if (!fin(r.x1) || !(r.x1 > r.x0)) r.x1 = r.xlog ? r.x0 * 10 : r.x0 + 1;
    if (!fin(r.y0)) r.y0 = 0;
    if (!fin(r.y1) || !(r.y1 > r.y0)) r.y1 = r.y0 + 1;
    return r;
  }

  /* ---------------- allgemeiner Zeichner ---------------- */
  /* o: { x0,x1,y0,y1, xlog, xticks, yticks, xfmt, yfmt, xlabel, title, ml, mb, mt, mr,
          series:[{x,y,color,lw,dash,stem,dots,dotsOnly,base,step,r}], vlines:[{x,color,dash,label,ly}], hlines:[{y,color,dash,label}],
          bands:[{x0,x1,color,alpha}], texts:[{x,y,text,color,align}] }
     Rückgabe: { X, Y, invX, box }. */
  function plot(ctx, w, h, P, o0) {
    const o = safeAxes(o0 || {});
    w = fin(w) && w > 0 ? w : 320; h = fin(h) && h > 0 ? h : 200;
    const ml = o.ml == null ? 58 : o.ml, mr = o.mr == null ? 12 : o.mr, mt = o.mt == null ? (o.title ? 28 : 10) : o.mt, mb = o.mb == null ? (o.xlabel ? 44 : 28) : o.mb;
    const box = { x: ml, y: mt, w: Math.max(10, w - ml - mr), h: Math.max(10, h - mt - mb) };
    const l0 = o.xlog ? Math.log10(o.x0) : o.x0, l1 = o.xlog ? Math.log10(o.x1) : o.x1;
    const X = v => box.x + box.w * ((o.xlog ? Math.log10(Math.max(v, 1e-300)) : v) - l0) / (l1 - l0);
    const Y = v => box.y + box.h * (1 - (v - o.y0) / (o.y1 - o.y0));
    const invX = px => { const q = l0 + (px - box.x) / box.w * (l1 - l0); return o.xlog ? Math.pow(10, q) : q; };
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    ctx.save();
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    ctx.font = o.font || FONT; ctx.textBaseline = 'alphabetic';
    for (const b of o.bands || []) { if (!fin(b.x0) || !fin(b.x1)) continue; const xa = cl(X(b.x0), box.x, box.x + box.w), xb = cl(X(b.x1), box.x, box.x + box.w); ctx.globalAlpha = b.alpha == null ? 0.14 : b.alpha; ctx.fillStyle = b.color || P.c1; ctx.fillRect(xa, box.y, Math.max(0, xb - xa), box.h); ctx.globalAlpha = 1; }
    /* Gitter und Beschriftung */
    const xt = o.xticks || (o.xlog ? logTicks(o.x0, o.x1) : niceTicks(o.x0, o.x1, Math.max(3, Math.floor(box.w / 90)))), yt = o.yticks || niceTicks(o.y0, o.y1, Math.max(3, Math.floor(box.h / 46)));
    ctx.lineWidth = 1; ctx.strokeStyle = P.line; ctx.fillStyle = P.mute;
    ctx.textAlign = 'center';
    let lastX = -1e9;
    for (const v of xt) { const px = X(v); if (!fin(px) || px < box.x - 0.5 || px > box.x + box.w + 0.5) continue; ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); const s = String((o.xfmt || (o.xlog ? fmtF : fmtN))(v)), tw = ctx.measureText ? ctx.measureText(s).width : s.length * 7; if (px - tw / 2 > lastX + 6 && px + tw / 2 < w - 2 && px - tw / 2 > 0) { ctx.fillText(s, px, box.y + box.h + 18); lastX = px + tw / 2; } }
    ctx.textAlign = 'right';
    for (const v of yt) { const py = Y(v); if (!fin(py) || py < box.y - 0.5 || py > box.y + box.h + 0.5) continue; ctx.beginPath(); ctx.moveTo(box.x, py); ctx.lineTo(box.x + box.w, py); ctx.stroke(); ctx.fillText(String((o.yfmt || fmtN)(v)), box.x - 6, py + 5); }
    ctx.strokeStyle = P.mute; ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillStyle = P.mute; ctx.fillText(o.xlabel, box.x + box.w, h - 6); }
    /* Zeichenfläche beschneiden */
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const dash = d => { if (ctx.setLineDash) ctx.setLineDash(d || []); };
    for (const hl of o.hlines || []) { if (!fin(hl.y)) continue; const py = Y(hl.y); ctx.strokeStyle = hl.color || P.mute; ctx.lineWidth = 1.5; dash(hl.dash == null ? [6, 4] : hl.dash); ctx.beginPath(); ctx.moveTo(box.x, py); ctx.lineTo(box.x + box.w, py); ctx.stroke(); }
    for (const vl of o.vlines || []) { if (!fin(vl.x)) continue; const px = X(vl.x); ctx.strokeStyle = vl.color || P.mute; ctx.lineWidth = vl.lw || 1.5; dash(vl.dash == null ? [6, 4] : vl.dash); ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); }
    dash([]);
    for (const s of o.series || []) {
      if (!s || !s.x || !s.y) continue;
      const n = Math.min(s.x.length, s.y.length); ctx.strokeStyle = s.color || P.c1; ctx.fillStyle = s.color || P.c1; ctx.lineWidth = s.lw || 2; ctx.lineJoin = 'round'; dash(s.dash);
      if (s.stem) {
        const by = Y(s.base == null ? 0 : s.base);
        for (let i = 0; i < n; i++) { if (!fin(s.y[i]) || !fin(s.x[i])) continue; const px = X(s.x[i]), py = cl(Y(s.y[i]), box.y - 4, box.y + box.h + 4); ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px, py); ctx.stroke(); if (s.dots) { ctx.beginPath(); ctx.arc(px, py, s.r || 4, 0, TAU); ctx.fill(); } }
      } else if (s.dotsOnly) {
        for (let i = 0; i < n; i++) { if (!fin(s.y[i]) || !fin(s.x[i])) continue; ctx.beginPath(); ctx.arc(X(s.x[i]), cl(Y(s.y[i]), box.y - 50, box.y + box.h + 50), s.r || 4, 0, TAU); ctx.fill(); }
      } else {
        ctx.beginPath(); let pen = false, py0 = 0;
        for (let i = 0; i < n; i++) {
          if (!fin(s.y[i]) || !fin(s.x[i])) { pen = false; continue; }
          const px = X(s.x[i]), py = cl(Y(s.y[i]), box.y - 50, box.y + box.h + 50);
          if (!pen) { ctx.moveTo(px, py); pen = true; } else { if (s.step) ctx.lineTo(px, py0); ctx.lineTo(px, py); }
          py0 = py;
        }
        ctx.stroke();
        if (s.dots) { for (let i = 0; i < n; i++) { if (!fin(s.y[i]) || !fin(s.x[i])) continue; ctx.beginPath(); ctx.arc(X(s.x[i]), cl(Y(s.y[i]), box.y - 50, box.y + box.h + 50), s.r || 3.5, 0, TAU); ctx.fill(); } }
      }
      dash([]);
    }
    ctx.restore(); ctx.save(); ctx.font = o.font || FONT; ctx.textBaseline = 'alphabetic';
    /* Beschriftungen mit Umrandung für Lesbarkeit */
    const halo = (s, x, y, color, al) => { ctx.textAlign = al || 'left'; ctx.lineWidth = 4; ctx.strokeStyle = P.bg; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y); };
    if (o.title) { ctx.textAlign = 'left'; ctx.fillStyle = P.fg; ctx.fillText(o.title, box.x, 19); }
    for (const hl of o.hlines || []) if (hl.label && fin(hl.y)) { const py = Y(hl.y); if (py > box.y && py < box.y + box.h) halo(hl.label, hl.left ? box.x + 4 : box.x + box.w - 4, py - 5 < box.y + 14 ? py + 16 : py - 5, hl.color || P.mute, hl.left ? 'left' : 'right'); }
    for (const vl of o.vlines || []) if (vl.label && fin(vl.x)) { const px = X(vl.x); if (px > box.x && px < box.x + box.w) halo(vl.label, Math.min(Math.max(px + 4, box.x + 2), box.x + box.w - 2 - (ctx.measureText ? ctx.measureText(vl.label).width : 40)), box.y + (vl.ly || 36), vl.color || P.mute, 'left'); }
    for (const tx of o.texts || []) { const px = X(tx.x), py = Y(tx.y); if (fin(px) && fin(py)) halo(String(tx.text), px, cl(py, box.y + 14, box.y + box.h - 4), tx.color || P.fg, tx.align || 'center'); }
    ctx.restore();
    return { X, Y, invX, box };
  }

  /* ============================================================ Modelle der Reiter */
  const lin = (a, b, n) => { const x = new Float64Array(n); for (let i = 0; i < n; i++) x[i] = a + (b - a) * i / (n - 1); return x; };
  const facTxt = k => k >= 1 ? '× ' + C.fmt(k, 4) : '× ' + C.fmt(k, 3);

  /* 1. Pegel und Dezibel: s = { db, l }  (db: dB-Zahl, l: Pegel in dBm) */
  function peg(s) {
    const db = clamp(s.db, -40, 40), l = clamp(s.l, -120, 50);
    const kp = C.ratioP(db), ku = C.ratioU(db), p = C.wFromDbm(l), u = C.uFromPower(p, 50), lu = C.dbuvFromV(u);
    const xs = [-40, 40];
    const pot = v => { const e = Math.round(v); return e === 0 ? '× 1' : e > 0 ? '× ' + C.fmt(Math.pow(10, e), 7) : '× 1/' + C.fmt(Math.pow(10, -e), 7); };
    return {
      plots: { fac: { x0: -40, x1: 40, y0: -4, y1: 4, xlabel: 'Pegeländerung in dB', title: 'Faktor (jede Linie: eine Zehnerpotenz)', xticks: [-40, -30, -20, -10, 0, 10, 20, 30, 40], yticks: [-4, -3, -2, -1, 0, 1, 2, 3, 4], yfmt: pot, ml: 78,
        series: [{ x: xs, y: [-4, 4], color: 'c1', lw: 2.5 }, { x: xs, y: [-2, 2], color: 'c2', lw: 2.5 }, { x: [db], y: [db / 10], color: 'c1', dotsOnly: true, r: 6 }, { x: [db], y: [db / 20], color: 'c2', dotsOnly: true, r: 6 }],
        vlines: [{ x: db, color: 'mute', label: C.fmtSgn(db, 3) + ' dB', ly: 20 }],
        texts: [{ x: 30, y: 3.25, text: 'Leistung', color: 'c1', align: 'right' }, { x: 30, y: 1.05, text: 'Spannung', color: 'c2', align: 'right' }] } },
      metrics: [
        { k: 'Leistungsfaktor', t: facTxt(kp), v: kp, f: '10^(dB / 10)' },
        { k: 'Spannungsfaktor', t: facTxt(ku), v: ku, f: '10^(dB / 20)' },
        { k: 'Pegel', v: l, u: 'dBm', f: 'bezogen auf 1 mW' },
        { k: 'Leistung', v: p, u: 'W', f: '1 mW · 10^(L / 10)' },
        { k: 'Spannung an 50 Ω', v: u, u: 'V', f: '√(P · 50 Ω)' },
        { k: 'Spannungspegel', v: lu, u: 'dBµV', f: 'an 50 Ω rund dBm + 107' }
      ],
      kp, ku, p, u, lu,
      aria: `${C.fmtSgn(db, 3)} dB bedeuten den Leistungsfaktor ${C.fmt(kp, 4)} und den Spannungsfaktor ${C.fmt(ku, 4)}. Der Pegel ${C.fmt(l, 4)} dBm entspricht ${C.fmtW(p, 4)} und an 50 Ω ${C.fmtV(u, 4)}.`
    };
  }

  /* 2. Leitung: stehende Welle. s = { rl, ph }  (rl: Abschlusswiderstand in Ω an 50 Ω, ph: Zeitpunkt als Bruchteil der Periode) */
  const Z0 = 50, LEN = 1.5;
  function ltg(s) {
    const rl = clamp(s.rl, 0, 1e6), ph = fin(s.ph) ? s.ph - Math.floor(s.ph) : 0;
    const r = C.gamma(rl, Z0), ar = Math.abs(r), swr = ar < 1 - 1e-9 ? C.swrFromGamma(ar) : Infinity, rf = C.reflFrac(r) * 100, rlo = ar > 1e-6 ? C.returnLoss(r) : Infinity;
    const n = 601, xs = new Float64Array(n), env = new Float64Array(n), envn = new Float64Array(n), inst = new Float64Array(n), fw = new Float64Array(n), bw = new Float64Array(n);
    for (let i = 0; i < n; i++) { const d = LEN * (1 - i / (n - 1)); xs[i] = -d; env[i] = C.standEnv(r, d); envn[i] = -env[i]; inst[i] = C.standInst(r, d, ph); fw[i] = Math.cos(TAU * (ph + d)); bw[i] = r * Math.cos(TAU * (ph - d)); }
    return {
      plots: { wave: { x0: -LEN, x1: 0, y0: -2.2, y1: 2.2, xlabel: 'Abstand von der Last in Wellenlängen (Last rechts)', title: 'Spannung auf der Leitung (hinlaufende Welle = 1)', xticks: [-1.5, -1.25, -1, -0.75, -0.5, -0.25, 0], xfmt: v => C.fmt(Math.abs(v), 3), yticks: [-2, -1, 0, 1, 2],
        series: [{ x: xs, y: fw, color: 'c3', lw: 1.5, dash: [5, 4] }, { x: xs, y: bw, color: 'c4', lw: 1.5, dash: [5, 4] }, { x: xs, y: env, color: 'c2', lw: 2 }, { x: xs, y: envn, color: 'c2', lw: 2 }, { x: xs, y: inst, color: 'c1', lw: 3 }],
        texts: [{ x: -1.47, y: 2.0, text: 'Summe', color: 'c1', align: 'left' }, { x: -1.15, y: 2.0, text: 'Hüllkurve', color: 'c2', align: 'left' }, { x: -1.47, y: -1.95, text: 'hin', color: 'c3', align: 'left' }, { x: -1.3, y: -1.95, text: 'zurück', color: 'c4', align: 'left' }] } },
      metrics: [
        { k: 'Reflexionsfaktor r', v: r, u: '', f: '(R − 50 Ω) / (R + 50 Ω)' },
        { k: 'Stehwellenverhältnis s', v: swr, u: '', f: '(1 + |r|) / (1 − |r|)', t: fin(swr) && swr < 1e4 ? null : 'unendlich groß' },
        { k: 'Reflektierte Leistung', v: rf, u: '%', f: 'r² · 100 %' },
        { k: 'Leistung in der Last', v: 100 - rf, u: '%', f: '(1 − r²) · 100 %' },
        { k: 'Rückflussdämpfung', v: rlo, u: 'dB', f: '−20 · lg(|r|)', t: fin(rlo) ? null : 'unendlich groß (angepasst)' },
        { k: 'Größte / kleinste Spannung', v: [1 + ar, 1 - ar], u: '', f: '1 + |r| und 1 − |r|' }
      ],
      r, swr, rf, rlo,
      aria: `Leitung mit 50 Ω, Abschluss ${C.fmt(rl, 4)} Ω: Reflexionsfaktor ${C.fmt(r, 3)}, ${fin(swr) && swr < 1e4 ? 'Stehwellenverhältnis ' + C.fmt(swr, 3) : 'Stehwellenverhältnis unendlich groß'}, reflektierte Leistung ${C.fmt(rf, 3)} Prozent.`
    };
  }

  /* 3. Funkstrecke: Pegelplan. s = { ptx, gv, ad, ktx, gtx, d, f, grx, krx, sens } */
  const STAGES = ['Verstärker', 'Dämpfungsglied', 'Kabel', 'Sendeantenne', 'Luft', 'Empfangsantenne', 'Kabel'];
  const STAGE_SHORT = ['V', 'D', 'K', 'A', 'Luft', 'A', 'K'];
  function ant(s) {
    const ptx = clamp(s.ptx, -30, 60), gv = clamp(s.gv, 0, 60), ad = clamp(s.ad, 0, 60), ktx = clamp(s.ktx, 0, 40), gtx = clamp(s.gtx, 0, 40), d = clamp(s.d, 0.001, 1e5), f = clamp(s.f, 1, 1e5), grx = clamp(s.grx, 0, 40), krx = clamp(s.krx, 0, 40), sens = clamp(s.sens, -160, 0);
    const a = C.fspl(d, f), steps = [gv, -ad, -ktx, gtx, -a, grx, -krx], lv = C.levelChain(ptx, steps), eirp = lv[4], rx = lv[7], mar = C.linkMargin(rx, sens);
    const xs = [], ys = []; for (let i = 0; i <= 7; i++) { xs.push(i); ys.push(lv[i]); } xs.push(8); ys.push(lv[7]);
    const top = Math.max.apply(null, lv), bot = Math.min(Math.min.apply(null, lv), sens);
    const y1 = Math.ceil((top + 12) / 10) * 10, y0 = Math.floor((bot - 8) / 10) * 10, dy = (y1 - y0) * 0.035;
    return {
      plots: { plan: { x0: 0, x1: 8, y0, y1, title: 'Pegelplan in dBm', xlabel: 'V Verstärker, D Dämpfungsglied, K Kabel, A Antenne', xticks: [1, 2, 3, 4, 5, 6, 7], xfmt: v => STAGE_SHORT[Math.round(v) - 1] || '',
        bands: [{ x0: 5, x1: 8, color: mar >= 0 ? 'c3' : 'c4', alpha: 0.1 }],
        series: [{ x: xs, y: ys, color: 'c1', lw: 3, step: true }, { x: [4.5], y: [eirp], color: 'c2', dotsOnly: true, r: 5 }, { x: [7.5], y: [rx], color: 'c1', dotsOnly: true, r: 5 }],
        hlines: [{ y: sens, color: 'c4', label: 'Empfindlichkeit ' + C.fmt(sens, 4) + ' dBm', left: true }],
        texts: [{ x: 0.1, y: lv[0] + dy, text: 'Sender ' + C.fmt(lv[0], 3), color: 'fg', align: 'left' }, { x: 4.5, y: eirp + dy, text: 'EIRP ' + C.fmt(eirp, 4), color: 'c2', align: 'center' }, { x: 7.9, y: rx + dy, text: C.fmt(rx, 4), color: 'c1', align: 'right' }] } },
      metrics: [
        { k: 'EIRP', v: eirp, u: 'dBm', f: 'Sender + Verstärker − Dämpfung − Kabel + Gewinn' },
        { k: 'Freiraumdämpfung', v: a, u: 'dB', f: '32,44 + 20 · lg(d) + 20 · lg(f)' },
        { k: 'Empfangspegel', v: rx, u: 'dBm', f: 'EIRP − a + Gewinn − Kabel' },
        { k: 'Streckenreserve', v: mar, u: 'dB', f: 'Empfangspegel − Empfindlichkeit' },
        { k: 'Wellenlänge', v: C.wavelength(f * 1e6), u: 'm', f: 'c / f' },
        { k: 'Sendeleistung', v: C.wFromDbm(ptx), u: 'W', f: '1 mW · 10^(L / 10)' }
      ],
      levels: lv, steps, stages: STAGES, a, eirp, rx, mar,
      aria: `Pegelplan: Sender ${C.fmt(ptx, 3)} dBm, EIRP ${C.fmt(eirp, 4)} dBm, Freiraumdämpfung ${C.fmt(a, 4)} dB, Empfangspegel ${C.fmt(rx, 4)} dBm, Reserve ${C.fmt(mar, 3)} dB.`
    };
  }

  /* 4. Modulation: s = { kind:'am'|'fm'|'ask'|'fsk', fc, fm, m, df, rb, n, h }
        analog: fc Träger, fm Nachricht (Hz), m Modulationsgrad, df Hub; digital: rb Bitrate, n Trägerschwingungen je Bit, h Frequenzabstand / Bitrate */
  const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
  const KNAME = { am: 'AM', fm: 'FM', ask: 'ASK', fsk: 'FSK' };
  const sinc = x => Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
  const dfMax = fc => Math.min(800, Math.max(10, Math.floor(0.4 * fc / 10) * 10));
  function mod(s) {
    const kind = KNAME[s.kind] ? s.kind : 'am';
    const fc0 = clamp(s.fc, 200, 5000), fm = clamp(s.fm, 10, 1000), m = clamp(s.m, 0, 1.5), df = clamp(s.df, 0, dfMax(fc0)), rb = clamp(s.rb, 10, 5000), nC = clamp(Math.round(s.n), 3, 12), h = clamp(s.h, 0.5, 4);
    const digital = kind === 'ask' || kind === 'fsk', fc = digital ? nC * rb : fc0;
    const T = digital ? BITS.length / rb : 2 / fm, N = 1601, tx = new Float64Array(N), ty = new Float64Array(N), my = new Float64Array(N);
    const p = { fc, fm, m, df, bits: BITS, rb, shift: h * rb };
    for (let i = 0; i < N; i++) {
      const t = T * i / (N - 1), te = Math.min(t, T * (1 - 1e-9)); tx[i] = t * 1000;
      if (kind === 'am') { ty[i] = C.amAt(p, t); my[i] = 1 + m * Math.cos(TAU * fm * t); }
      else if (kind === 'fm') { ty[i] = C.fmAt(p, t); my[i] = 1.75 + 0.45 * Math.cos(TAU * fm * t); }
      else { const b = C.bitAt(BITS, rb, te); ty[i] = kind === 'ask' ? C.askAt(p, te) : C.fskAt(p, te); my[i] = 1.4 + 0.7 * b; }
    }
    const ym = kind === 'am' ? 2.7 : 2.5;
    const time = { x0: 0, x1: T * 1000, y0: -ym, y1: ym, xlabel: 'Zeit in ms', title: KNAME[kind] + ': Signal über der Zeit', yticks: kind === 'am' ? [-2, -1, 0, 1, 2] : [-1, 0, 1],
      series: [{ x: tx, y: ty, color: 'c1', lw: 1.8 }, { x: tx, y: my, color: 'c2', lw: 2, dash: kind === 'am' ? [5, 4] : null }], texts: [] };
    if (digital) BITS.forEach((b, i) => time.texts.push({ x: (i + 0.5) / rb * 1000, y: -2.0, text: String(b), color: 'c2' }));
    else time.texts.push({ x: T * 1000 * 0.02, y: -ym * 0.82, text: kind === 'am' ? 'gestrichelt: Hüllkurve' : 'oben: Nachricht', color: 'c2', align: 'left' });
    let spec, metrics, bw;
    if (kind === 'am') {
      bw = C.amBandwidth(fm);
      spec = { x0: Math.max(0, fc - 3 * fm), x1: fc + 3 * fm, y0: 0, y1: 1.2, series: [{ x: [fc - fm, fc, fc + fm], y: [m / 2, 1, m / 2], color: 'c1', lw: 4, stem: true, dots: true }],
        texts: [{ x: fc, y: 1.08, text: 'Träger', color: 'fg' }, { x: fc + fm, y: m / 2 + 0.08, text: 'm/2 = ' + C.fmt(m / 2, 3), color: 'c1', align: 'left' }] };
      metrics = [{ k: 'Modulationsgrad m', v: m * 100, u: '%', f: '(U_max − U_min) / (U_max + U_min)' }, { k: 'Bandbreite', v: bw, u: 'Hz', f: '2 · f_m' }, { k: 'Seitenlinien bei', v: [fc - fm, fc + fm], u: 'Hz', f: 'f_T − f_m und f_T + f_m' }, { k: 'Höhe einer Seitenlinie', v: m / 2, u: '', f: 'm / 2 (Träger = 1)' }, { k: 'Leistung in den Seitenbändern', v: C.amSidebandPower(100, m), u: '%', f: 'm² / 2 der Trägerleistung' }, { k: 'Hüllkurve größter / kleinster Wert', v: [1 + m, Math.abs(1 - m)], u: '', f: '1 + m und 1 − m' }];
    } else if (kind === 'fm') {
      const beta = C.fmIndex(df, fm); bw = C.carson(df, fm);
      const K = Math.min(24, Math.ceil(beta) + 3), fx = [], fy = [];
      for (let k = -K; k <= K; k++) { const f = fc + k * fm; if (f <= 0) continue; fx.push(f); fy.push(Math.abs(C.besselJ(k, beta))); }
      spec = { x0: Math.max(0, fc - (K + 1) * fm), x1: fc + (K + 1) * fm, y0: 0, y1: 1.1, series: [{ x: fx, y: fy, color: 'c1', lw: 3, stem: true, dots: true, r: 3 }],
        bands: [{ x0: fc - bw / 2, x1: fc + bw / 2, color: 'c2', alpha: 0.14 }], texts: [{ x: fc, y: 1.0, text: 'Carson-Bandbreite', color: 'c2' }] };
      metrics = [{ k: 'Modulationsindex η', v: beta, u: '', f: 'Δf / f_m' }, { k: 'Carson-Bandbreite', v: bw, u: 'Hz', f: '2 · (Δf + f_m)' }, { k: 'Frequenzhub Δf', v: df, u: 'Hz', f: 'größte Abweichung vom Träger' }, { k: 'Momentanfrequenz', v: [fc - df, fc + df], u: 'Hz', f: 'f_T − Δf bis f_T + Δf' }, { k: 'Höhe der Trägerlinie', v: Math.abs(C.besselJ(0, beta)), u: '', f: '|J₀(η)|' }, { k: 'Abstand der Linien', v: fm, u: 'Hz', f: 'f_m' }];
    } else {
      const sh = h * rb, f0 = fc - sh / 2, f1 = fc + sh / 2, half = (kind === 'fsk' ? h / 2 : 0) + 3.5, M = 801, fx = lin(Math.max(0, fc - half * rb), fc + half * rb, M), fy = new Float64Array(M);
      for (let i = 0; i < M; i++) fy[i] = kind === 'ask' ? Math.abs(sinc((fx[i] - fc) / rb)) : Math.max(Math.abs(sinc((fx[i] - f0) / rb)), Math.abs(sinc((fx[i] - f1) / rb)));
      bw = kind === 'ask' ? 2 * rb : sh + 2 * rb;
      spec = { x0: fx[0], x1: fx[M - 1], y0: 0, y1: 1.2, series: [{ x: fx, y: fy, color: 'c1', lw: 2.5 }],
        vlines: kind === 'ask' ? [{ x: fc, color: 'c2', label: 'Träger', ly: 20 }] : [{ x: f0, color: 'c2', label: 'f₀ (Bit 0)', ly: 20 }, { x: f1, color: 'c3', label: 'f₁ (Bit 1)', ly: 40 }],
        bands: [{ x0: fc - bw / 2, x1: fc + bw / 2, color: 'c2', alpha: 0.1 }] };
      metrics = kind === 'ask'
        ? [{ k: 'Bitrate', v: rb, u: 'bit/s', f: 'Bits je Sekunde' }, { k: 'Dauer eines Bits', v: 1000 / rb, u: 'ms', f: '1 / Bitrate' }, { k: 'Trägerfrequenz', v: fc, u: 'Hz', f: 'Schwingungen je Bit · Bitrate' }, { k: 'Breite der Hauptkeule', v: bw, u: 'Hz', f: '2 · Bitrate' }]
        : [{ k: 'Bitrate', v: rb, u: 'bit/s', f: 'Bits je Sekunde' }, { k: 'Frequenzen f₀ und f₁', v: [f0, f1], u: 'Hz', f: 'Bit 0 und Bit 1' }, { k: 'Frequenzabstand (Shift)', v: sh, u: 'Hz', f: 'f₁ − f₀' }, { k: 'Modulationsindex h', v: C.fskIndex(sh, rb), u: '', f: 'Shift / Bitrate' }, { k: 'Belegte Breite (Skizze)', v: bw, u: 'Hz', f: 'Shift + 2 · Bitrate' }, { k: 'Dauer eines Bits', v: 1000 / rb, u: 'ms', f: '1 / Bitrate' }];
    }
    spec.xlabel = 'Frequenz in Hz'; spec.title = digital ? 'Spektrum (Skizze für zufällige Daten, größter Wert = 1)' : 'Spektrum (Träger ohne Modulation = 1)'; spec.yticks = [0, 0.25, 0.5, 0.75, 1]; spec.xfmt = v => C.fmt(v, 4);
    return { plots: { time, spec }, metrics, kind, fc, bw, bits: BITS,
      aria: `${KNAME[kind]} mit Träger ${C.fmt(fc, 4)} Hz: belegte Bandbreite etwa ${C.fmtHz(bw, 3)}.` };
  }

  /* 5. Empfänger: s = { b, nf, snr, pin }  (b in Hz) */
  const BMIN = 100, BMAX = 2e7;
  function rx(s) {
    const b = clamp(s.b, BMIN, BMAX), nf = clamp(s.nf, 0, 30), snr = clamp(s.snr, 0, 40), pin = clamp(s.pin, -160, 0);
    const kt = C.noiseDbm(b), fl = C.noiseFloor(b, nf), se = C.sensitivity(b, nf, snr), act = pin - fl, mar = pin - se;
    const xs = [BMIN, BMAX], line = off => xs.map(x => C.noiseDbm(x) + off);
    return {
      plots: { lev: { x0: BMIN, x1: BMAX, xlog: true, y0: -160, y1: -40, xlabel: 'Bandbreite in Hz', title: 'Pegel in dBm', yticks: [-160, -140, -120, -100, -80, -60, -40],
        bands: [{ x0: BMIN, x1: b, color: 'c1', alpha: 0.07 }],
        series: [{ x: xs, y: line(0), color: 'c3', lw: 1.5, dash: [5, 4] }, { x: xs, y: line(nf), color: 'c1', lw: 2.5 }, { x: xs, y: line(nf + snr), color: 'c2', lw: 2.5 }, { x: [b, b, b], y: [kt, fl, se], color: 'fg', dotsOnly: true, r: 5 }],
        vlines: [{ x: b, color: 'mute', label: 'B = ' + C.fmtHz(b, 3), ly: 20 }], hlines: [{ y: pin, color: 'c4', label: 'Eingangspegel ' + C.fmt(pin, 4) + ' dBm', left: true }],
        texts: [{ x: BMAX * 0.8, y: C.noiseDbm(BMAX) + nf + snr + 5, text: 'Empfindlichkeit', color: 'c2', align: 'right' }, { x: BMAX * 0.8, y: C.noiseDbm(BMAX) - 9, text: 'Rauschboden (darunter: thermisch)', color: 'c1', align: 'right' }] } },
      metrics: [
        { k: 'Thermisches Rauschen', v: kt, u: 'dBm', f: '−174 + 10 · lg(B)' },
        { k: 'Rauschboden', v: fl, u: 'dBm', f: 'thermisch + Rauschmaß' },
        { k: 'Empfindlichkeit', v: se, u: 'dBm', f: 'Rauschboden + nötiger Abstand' },
        { k: 'Signal-Rausch-Abstand', v: act, u: 'dB', f: 'Eingangspegel − Rauschboden' },
        { k: 'Reserve', v: mar, u: 'dB', f: 'Eingangspegel − Empfindlichkeit' },
        { k: 'Eingangsspannung an 50 Ω', v: C.uFromPower(C.wFromDbm(pin), 50), u: 'V', f: '√(P · 50 Ω)' }
      ],
      kt, fl, se, act, mar,
      aria: `Empfänger mit ${C.fmtHz(b, 3)} Bandbreite und ${C.fmt(nf, 3)} dB Rauschmaß: Rauschboden ${C.fmt(fl, 4)} dBm, Empfindlichkeit ${C.fmt(se, 4)} dBm, Reserve ${C.fmt(mar, 3)} dB.`
    };
  }

  /* 6. Messen: Durchlasskurve. s = { f0, q, dv }  (f0 in Hz, dv: Verstimmung der Messfrequenz in Prozent) */
  function mes(s) {
    const f0 = clamp(s.f0, 1e3, 1e10), q = clamp(s.q, 2, 1000), dv = clamp(s.dv, -10, 10), fmess = f0 * (1 + dv / 100);
    const e = C.resEdges(f0, q), fu = e[0], fo = e[1], bw = C.bw3dB(fu, fo), mag = C.resMag(fmess, f0, q), adb = C.dbU(mag);
    const unit = f0 >= 1e6 ? ['MHz', 1e6] : ['kHz', 1e3], n = 801, xs = lin(f0 * 0.9, f0 * 1.1, n), ys = new Float64Array(n);
    for (let i = 0; i < n; i++) ys[i] = Math.max(-60, C.dbU(C.resMag(xs[i], f0, q)));
    return {
      plots: { res: { x0: f0 * 0.9, x1: f0 * 1.1, y0: -40, y1: 4, xlabel: 'Frequenz in ' + unit[0], title: 'Durchlasskurve in dB (Maximum = 0 dB)', xticks: [0.9, 0.95, 1, 1.05, 1.1].map(k => f0 * k), xfmt: v => C.fmt(v / unit[1], 4), yticks: [-40, -30, -20, -10, -3, 0],
        bands: [{ x0: fu, x1: fo, color: 'c3', alpha: 0.14 }],
        series: [{ x: xs, y: ys, color: 'c1', lw: 2.5 }, { x: [fmess], y: [Math.max(-60, adb)], color: 'c2', dotsOnly: true, r: 6 }],
        hlines: [{ y: -3.01, color: 'c3', label: '−3 dB', left: true }], vlines: [{ x: fmess, color: 'c2', label: C.fmt(adb, 3) + ' dB', ly: 20 }] } },
      metrics: [
        { k: 'Bandbreite B', v: bw, u: 'Hz', f: 'f₀ / Q' },
        { k: 'Untere Grenze f_u', v: fu, u: 'Hz', f: '−3 dB' },
        { k: 'Obere Grenze f_o', v: fo, u: 'Hz', f: '−3 dB' },
        { k: 'Messfrequenz', v: fmess, u: 'Hz', f: 'f₀ · (1 + Verstimmung)' },
        { k: 'Pegel bei der Messfrequenz', v: adb, u: 'dB', f: 'bezogen auf das Maximum' },
        { k: 'Spannung bei der Messfrequenz', v: mag * 100, u: '%', f: 'vom Maximum' }
      ],
      fu, fo, bw, adb, fmess,
      aria: `Filter mit Mittenfrequenz ${C.fmtHz(f0, 4)} und Güte ${C.fmt(q, 3)}: Bandbreite ${C.fmtHz(bw, 3)}, Pegel bei der Messfrequenz ${C.fmt(adb, 3)} dB.`
    };
  }

  /* ---------------- Canvas vorbereiten und zeichnen ---------------- */
  function prep(canvas, hCss) {
    hCss = fin(hCss) && hCss > 40 ? Math.round(hCss) : 220;
    const w = Math.max(160, Math.round(canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 320)), dpr = Math.min(2, Math.max(1, root.devicePixelRatio || 1));
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(hCss * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(hCss * dpr); canvas.style.height = hCss + 'px'; }
    const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h: hCss };
  }
  /* Farbnamen (c1..c4, fg, mute) aus o in echte Farben umsetzen */
  function resolve(o, P) {
    const col = c => (c && P[c]) ? P[c] : c;
    const r = Object.assign({}, o);
    r.series = (o.series || []).map(s => Object.assign({}, s, { color: col(s.color) }));
    r.vlines = (o.vlines || []).map(v => Object.assign({}, v, { color: col(v.color) }));
    r.hlines = (o.hlines || []).map(v => Object.assign({}, v, { color: col(v.color) }));
    r.bands = (o.bands || []).map(v => Object.assign({}, v, { color: col(v.color) }));
    r.texts = (o.texts || []).map(v => Object.assign({}, v, { color: col(v.color) }));
    return r;
  }
  function draw(canvas, o, hCss) { const P = pal(), g = prep(canvas, hCss); return plot(g.ctx, g.w, g.h, P, resolve(o, P)); }

  const api = { FS, FONT, pal, niceTicks, logTicks, safeAxes, plot, resolve, prep, draw, fmtF, BITS, KNAME, STAGES, STAGE_SHORT, BMIN, BMAX, Z0, dfMax, MODELS: { peg, ltg, ant, mod, rx, mes } };
  root.HF_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
