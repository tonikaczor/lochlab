'use strict';
/* Tonfunk Lab "Signale und Systeme": Zeichnen und Modelle der Visualisierungen (Canvas 2D, ohne Bibliotheken).
   plot(ctx, w, h, P, o): ein allgemeiner Linien-/Stab-Zeichner (lineare und logarithmische Achsen, Bänder, Markierungen, Texte).
   MODELS.<block>(state) liefert { plots: { <canvas-Schlüssel>: o }, metrics: [{k, v, u, note}], aria } und ist reine Rechnung (ohne DOM, per Node testbar).
   Schrift mindestens 14 px (CSS-Pixel); Farben nur aus den Variablen --c1..--c4, --fg, --mute, --line, --panel2 (hell/dunkel) mit Rückfall.
   Leistung: höchstens 2048 Punkte je Kurve, FFT-Länge höchstens 4096; Zeichnen nur auf Anforderung (kein Dauerlauf).
   Export: window.SIG_VIZ bzw. module.exports. */
(function (root) {
  const C = root.SIG_CORE || (typeof require === 'function' ? require('./sigcore.js') : null);
  const TAU = 2 * Math.PI, fin = v => typeof v === 'number' && isFinite(v);
  const FS = 14;
  const FONT = FS + 'px system-ui,-apple-system,"Segoe UI",sans-serif';

  /* ---------------- Farben ---------------- */
  function pal() {
    let cs = null;
    try { if (typeof document !== 'undefined' && root.getComputedStyle) cs = root.getComputedStyle(document.documentElement); } catch (e) {}
    const g = (n, fb) => { let v = ''; try { v = cs ? cs.getPropertyValue(n).trim() : ''; } catch (e) {} return v || fb; };
    return { bg: g('--panel2', '#2c343e'), fg: g('--fg', '#e8ecf0'), mute: g('--mute', '#8d99a6'), line: g('--line', '#38424d'), c1: g('--c1', '#5ab0ff'), c2: g('--c2', '#ffb340'), c3: g('--c3', '#5fd38d'), c4: g('--c4', '#ff7ab6') };
  }

  /* ---------------- Skalen und Ticks ---------------- */
  function niceTicks(lo, hi, target) {
    if (!(hi > lo)) return [lo];
    const raw = (hi - lo) / Math.max(1, target || 5), mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  }
  function logTicks(lo, hi) {
    const out = [], a = Math.floor(Math.log10(lo)), b = Math.ceil(Math.log10(hi));
    for (let e = a; e <= b; e++) { const v = Math.pow(10, e); if (v >= lo * 0.999 && v <= hi * 1.001) out.push(v); }
    return out;
  }
  const fmtF = f => f >= 1e6 ? C.fmt(f / 1e6, 3) + 'M' : f >= 1e3 ? C.fmt(f / 1e3, 3) + 'k' : C.fmt(f, 3);
  const fmtN = v => C.fmt(v, 3);
  /* Zeitachse: Einheit nach Bereich */
  function timeUnit(T) { return T >= 1 ? { u: 's', k: 1 } : T >= 1e-3 ? { u: 'ms', k: 1e3 } : T >= 1e-6 ? { u: 'µs', k: 1e6 } : { u: 'ns', k: 1e9 }; }

  /* ---------------- allgemeiner Zeichner ---------------- */
  /* o: { x0,x1,y0,y1, xlog, xticks, yticks, xfmt, yfmt, xlabel, title, ml, mb, mt, mr,
          series:[{x,y,color,lw,dash,stem,dots,base,step,fill}], vlines:[{x,color,dash,label}], hlines:[{y,color,dash,label}],
          bands:[{x0,x1,color,alpha}], texts:[{x,y,text,color,align}] }
     Rückgabe: { X, Y, invX, box } für Zeigerbedienung. */
  function plot(ctx, w, h, P, o) {
    const ml = o.ml == null ? 54 : o.ml, mr = o.mr == null ? 12 : o.mr, mt = o.mt == null ? (o.title ? 28 : 10) : o.mt, mb = o.mb == null ? (o.xlabel ? 44 : 28) : o.mb;
    const box = { x: ml, y: mt, w: Math.max(10, w - ml - mr), h: Math.max(10, h - mt - mb) };
    const l0 = o.xlog ? Math.log10(o.x0) : o.x0, l1 = o.xlog ? Math.log10(o.x1) : o.x1;
    const X = v => box.x + box.w * ((o.xlog ? Math.log10(Math.max(v, 1e-300)) : v) - l0) / (l1 - l0);
    const Y = v => box.y + box.h * (1 - (v - o.y0) / (o.y1 - o.y0));
    const invX = px => { const q = l0 + (px - box.x) / box.w * (l1 - l0); return o.xlog ? Math.pow(10, q) : q; };
    const cl = (v, a, b) => Math.min(b, Math.max(a, v));
    ctx.save();
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, w, h);
    ctx.font = o.font || FONT; ctx.textBaseline = 'alphabetic';
    for (const b of o.bands || []) { const xa = cl(X(b.x0), box.x, box.x + box.w), xb = cl(X(b.x1), box.x, box.x + box.w); ctx.globalAlpha = b.alpha == null ? 0.14 : b.alpha; ctx.fillStyle = b.color || P.c1; ctx.fillRect(xa, box.y, Math.max(0, xb - xa), box.h); ctx.globalAlpha = 1; }
    /* Gitter und Beschriftung */
    const xt = o.xticks || (o.xlog ? logTicks(o.x0, o.x1) : niceTicks(o.x0, o.x1, Math.max(3, Math.floor(box.w / 90)))), yt = o.yticks || niceTicks(o.y0, o.y1, Math.max(3, Math.floor(box.h / 46)));
    ctx.lineWidth = 1; ctx.strokeStyle = P.line; ctx.fillStyle = P.mute;
    ctx.textAlign = 'center';
    let lastX = -1e9;
    for (const v of xt) { const px = X(v); if (px < box.x - 0.5 || px > box.x + box.w + 0.5) continue; ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); const s = (o.xfmt || (o.xlog ? fmtF : fmtN))(v), tw = ctx.measureText ? ctx.measureText(s).width : s.length * 7; if (px - tw / 2 > lastX + 6 && px + tw / 2 < w - 2 && px - tw / 2 > 0) { ctx.fillText(s, px, box.y + box.h + 18); lastX = px + tw / 2; } }
    ctx.textAlign = 'right';
    for (const v of yt) { const py = Y(v); if (py < box.y - 0.5 || py > box.y + box.h + 0.5) continue; ctx.beginPath(); ctx.moveTo(box.x, py); ctx.lineTo(box.x + box.w, py); ctx.stroke(); ctx.fillText((o.yfmt || fmtN)(v), box.x - 6, py + 5); }
    ctx.strokeStyle = P.mute; ctx.strokeRect(box.x + 0.5, box.y + 0.5, box.w, box.h);
    if (o.xlabel) { ctx.textAlign = 'right'; ctx.fillStyle = P.mute; ctx.fillText(o.xlabel, box.x + box.w, h - 6); }
    /* Zeichenfläche beschneiden */
    ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
    const dash = d => { if (ctx.setLineDash) ctx.setLineDash(d || []); };
    for (const hl of o.hlines || []) { const py = Y(hl.y); ctx.strokeStyle = hl.color || P.mute; ctx.lineWidth = 1.5; dash(hl.dash == null ? [6, 4] : hl.dash); ctx.beginPath(); ctx.moveTo(box.x, py); ctx.lineTo(box.x + box.w, py); ctx.stroke(); }
    for (const vl of o.vlines || []) { const px = X(vl.x); ctx.strokeStyle = vl.color || P.mute; ctx.lineWidth = vl.lw || 1.5; dash(vl.dash == null ? [6, 4] : vl.dash); ctx.beginPath(); ctx.moveTo(px, box.y); ctx.lineTo(px, box.y + box.h); ctx.stroke(); }
    dash([]);
    for (const s of o.series || []) {
      const n = Math.min(s.x.length, s.y.length); ctx.strokeStyle = s.color || P.c1; ctx.fillStyle = s.color || P.c1; ctx.lineWidth = s.lw || 2; ctx.lineJoin = 'round'; dash(s.dash);
      if (s.stem) {
        const by = Y(s.base == null ? 0 : s.base);
        for (let i = 0; i < n; i++) { if (!fin(s.y[i]) || !fin(s.x[i])) continue; const px = X(s.x[i]), py = cl(Y(s.y[i]), box.y - 4, box.y + box.h + 4); ctx.beginPath(); ctx.moveTo(px, by); ctx.lineTo(px, py); ctx.stroke(); if (s.dots) { ctx.beginPath(); ctx.arc(px, py, s.r || 4, 0, TAU); ctx.fill(); } }
      } else if (s.dotsOnly) {
        for (let i = 0; i < n; i++) { if (!fin(s.y[i]) || !fin(s.x[i])) continue; ctx.beginPath(); ctx.arc(X(s.x[i]), Y(s.y[i]), s.r || 4, 0, TAU); ctx.fill(); }
      } else {
        ctx.beginPath(); let pen = false, px0 = 0, py0 = 0;
        for (let i = 0; i < n; i++) {
          if (!fin(s.y[i]) || !fin(s.x[i])) { pen = false; continue; }
          const px = X(s.x[i]), py = cl(Y(s.y[i]), box.y - 50, box.y + box.h + 50);
          if (!pen) { ctx.moveTo(px, py); pen = true; } else { if (s.step) ctx.lineTo(px, py0); ctx.lineTo(px, py); }
          px0 = px; py0 = py;
        }
        ctx.stroke();
        if (s.fill != null) { ctx.lineTo(px0, Y(s.fill)); ctx.stroke(); }
        if (s.dots) { for (let i = 0; i < n; i++) { if (!fin(s.y[i])) continue; ctx.beginPath(); ctx.arc(X(s.x[i]), Y(s.y[i]), s.r || 3.5, 0, TAU); ctx.fill(); } }
      }
      dash([]);
    }
    ctx.restore(); ctx.save(); ctx.font = o.font || FONT; ctx.textBaseline = 'alphabetic';
    /* Beschriftungen mit Umrandung für Lesbarkeit */
    const halo = (s, x, y, color, al) => { ctx.textAlign = al || 'left'; ctx.lineWidth = 4; ctx.strokeStyle = P.bg; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y); };
    if (o.title) { ctx.textAlign = 'left'; ctx.fillStyle = P.fg; ctx.fillText(o.title, box.x, 19); }
    for (const hl of o.hlines || []) if (hl.label) { const py = Y(hl.y); if (py > box.y && py < box.y + box.h) halo(hl.label, box.x + box.w - 4, py - 5, hl.color || P.mute, 'right'); }
    for (const vl of o.vlines || []) if (vl.label) { const px = X(vl.x); if (px > box.x && px < box.x + box.w) halo(vl.label, Math.min(Math.max(px + 4, box.x + 2), box.x + box.w - 2 - (ctx.measureText ? ctx.measureText(vl.label).width : 40)), box.y + (vl.ly || 36), vl.color || P.mute, 'left'); }
    for (const tx of o.texts || []) { const px = X(tx.x), py = Y(tx.y); if (fin(px) && fin(py)) halo(tx.text, px, py, tx.color || P.fg, tx.align || 'center'); }
    ctx.restore();
    return { X, Y, invX, box };
  }

  /* ---------------- Modelle der Reiter ---------------- */
  const WNAME = { sin: 'Sinus', rect: 'Rechteck', tri: 'Dreieck', saw: 'Sägezahn' };
  const FORM = { sin: ['0', 'û/√2', '2û/π', '√2'], tri: ['0', 'û/√3', 'û/2', '√3'], saw: ['0', 'û/√3', 'û/2', '√3'], rect: ['û·(2D−1)', 'û', 'û', '1'] };

  /* 1. Kenngrößen: s = { w, a, dc, d } */
  function kenn(s) {
    const w = s.w, a = s.a, dc = s.dc || 0, d = s.d == null ? 0.5 : s.d, n = 800, xs = new Float64Array(n), ys = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = 2 * i / (n - 1); xs[i] = p; ys[i] = dc + a * C.wave(w, p, d); }
    const an = C.statWave(w, a, { dc, d }), num = C.statPeriodNum(w, a, { dc, d }, 8000);
    const abs = an.abs != null ? an.abs : num.abs, ym = Math.max(1, (Math.abs(dc) + a) * 1.3);
    return {
      plots: { time: { x0: 0, x1: 2, y0: -ym, y1: ym, xlabel: 'Zeit in Perioden', title: 'u in V', series: [{ x: xs, y: ys, color: 'c1', lw: 2.5 }],
        hlines: [{ y: an.mean, color: 'c3', label: 'Mittelwert' }, { y: Math.sign(an.mean || 1) * an.rms, color: 'c2', label: 'Effektivwert' }], xticks: [0, 0.5, 1, 1.5, 2] } },
      metrics: [
        { k: 'Mittelwert', v: an.mean, u: 'V', f: FORM[w][0] },
        { k: 'Gleichrichtwert', v: abs, u: 'V', f: dc === 0 ? FORM[w][2] : 'numerisch' },
        { k: 'Effektivwert', v: an.rms, u: 'V', f: FORM[w][1] },
        { k: 'Scheitelwert', v: an.peak, u: 'V', f: 'Maximum von |u|' },
        { k: 'Crest-Faktor', v: an.crest, u: '', f: 'Scheitel / Effektiv' },
        { k: 'Formfaktor', v: an.rms / abs, u: '', f: 'Effektiv / Gleichricht' }
      ],
      num, an,
      aria: `${WNAME[w]} mit Scheitelwert ${C.fmt(a)} V, Offset ${C.fmt(dc)} V: Mittelwert ${C.fmt(an.mean)} V, Effektivwert ${C.fmt(an.rms)} V, Crest-Faktor ${C.fmt(an.crest)}.`
    };
  }

  /* 2. Spektrum: s = { fs, N, win, db, comps:[{on,w,a,f}], noise } */
  function spek(s) {
    const fs = s.fs, N = s.N, spec = { dc: 0, comps: s.comps.filter(c => c.on && c.a > 0).map(c => ({ w: c.w, a: c.a, f: c.f })), noise: s.noise > 0 ? { sigma: s.noise, seed: 7 } : null };
    const x = C.synth(spec, fs, N), S = C.ampSpec(x, s.win), df = fs / N, show = Math.min(N, 64);
    const tx = new Float64Array(show), ty = new Float64Array(show); for (let i = 0; i < show; i++) { tx[i] = i / fs; ty[i] = x[i]; }
    let ym = 0.5; for (let i = 0; i < show; i++) ym = Math.max(ym, Math.abs(ty[i]) * 1.2);
    const fx = new Float64Array(N / 2 + 1), fy = new Float64Array(N / 2 + 1);
    let amax = 0; for (let k = 0; k <= N / 2; k++) { fx[k] = k * df; if (S.a[k] > amax) amax = S.a[k]; }
    const db = !!s.db;
    let ytop, ybot, yt;
    if (db) { const t0 = Math.ceil(C.db20(Math.max(amax, 1e-9)) / 20) * 20; ytop = Math.max(20, t0); ybot = ytop - 120; for (let k = 0; k <= N / 2; k++) fy[k] = Math.max(C.db20(S.a[k]), ybot); yt = niceTicks(ybot, ytop, 6); }
    else { ytop = Math.max(0.5, Math.ceil(amax * 1.2 * 2) / 2); ybot = 0; for (let k = 0; k <= N / 2; k++) fy[k] = S.a[k]; yt = niceTicks(0, ytop, 5); }
    const pks = C.peaks(S.a, fs, N, Math.max(amax * 0.05, 1e-6), 4);
    const texts = pks.map((p, i) => ({ x: p.f, y: (db ? C.db20(p.a) : p.a), text: `${C.fmt(p.f, 4)} Hz, ${db ? C.fmt(C.db20(p.a), 3) + ' dB' : C.fmt(p.a, 3) + ' V'}`, color: 'fg', align: p.f > fs / 4 ? 'right' : 'left' })).map((t, i) => (t.y > ytop ? Object.assign(t, { y: ytop }) : t));
    texts.forEach((t, i) => { t.y += (db ? -(i * 9 + 3) : 0); });
    const hl = db ? [] : spec.comps.filter(c => c.w === 'sin').map(c => ({ y: c.a, color: 'c3', dash: [4, 4], label: '' }));
    const off = spec.comps.filter(c => Math.abs(c.f / df - Math.round(c.f / df)) > 1e-6);
    const c0 = spec.comps.find(c => c.w === 'sin'); let loss = null;   /* Anzeige im besten Bin gegen die wahre Amplitude (nur sinnvoll ohne weitere Linien in der Nähe) */
    if (c0) { const mx = Math.max(S.a[Math.max(0, Math.floor(c0.f / df))], S.a[Math.min(N / 2, Math.ceil(c0.f / df))]); loss = mx > 0 ? C.db20(c0.a / mx) : null; }
    return {
      plots: {
        time: { x0: 0, x1: (show - 1) / fs, y0: -ym, y1: ym, xlabel: 'Zeit (die ersten ' + show + ' von ' + N + ' Werten)', title: 'x[n] in V', xfmt: v => C.fmt(v * 1e3, 3) + ' ms', series: [{ x: tx, y: ty, color: 'c1', lw: 1.5, dots: true, r: 2.6 }], xticks: niceTicks(0, (show - 1) / fs, 4) },
        spec: { x0: 0, x1: fs / 2, y0: ybot, y1: ytop, xlabel: 'Frequenz in Hz', title: db ? 'Amplitude in dB (re 1 V)' : 'Amplitude in V', xfmt: fmtF, yticks: yt, yfmt: v => C.fmt(v, 3), series: [{ x: fx, y: fy, color: 'c1', lw: Math.max(1.2, Math.min(3, 520 / N * 3)), stem: true, base: ybot }], hlines: hl, texts: texts }
      },
      metrics: [
        { k: 'Frequenzraster Δf', v: df, u: 'Hz', f: 'f_s / N' },
        { k: 'Messdauer T', v: N / fs, u: 's', f: '1 / Δf' },
        { k: 'Fenster-Mittelwert', v: S.cg, u: '', f: s.win === 'hann' ? 'Hann: 0,5' : 'Rechteck: 1' },
        { k: 'Rauschbandbreite', v: S.enbw, u: 'Bins', f: 'Fensterbreite' }
      ],
      leak: off.length > 0, loss, S, x,
      aria: `Spektrum mit ${pks.length} auffälligen Linien, größte bei ${pks[0] ? C.fmt(pks[0].f, 4) : '–'} Hz. Raster ${C.fmt(df)} Hz, Fenster ${s.win === 'hann' ? 'Hann' : 'Rechteck'}.`
    };
  }

  /* 3. Abtastung: s = { f, fs, rec } (rec: 'sinc' | 'zoh' | 'none') */
  function abt(s) {
    const f = s.f, fs = s.fs, nS = 32, Tw = nS / fs, ph = 0.6, g = t => Math.sin(TAU * f * t + ph), nC = 1000;
    const ct = new Float64Array(nC), cy = new Float64Array(nC); for (let i = 0; i < nC; i++) { ct[i] = Tw * i / (nC - 1); cy[i] = g(ct[i]); }
    const pad = 40, xs = []; for (let i = -pad; i < nS + pad; i++) xs.push(g(i / fs));
    const sx = new Float64Array(nS), sy = new Float64Array(nS); for (let i = 0; i < nS; i++) { sx[i] = i / fs; sy[i] = g(i / fs); }
    const series = [{ x: ct, y: cy, color: 'c1', lw: 2 }];
    let rx = null, ry = null;
    if (s.rec === 'sinc') { rx = new Float64Array(nC); ry = new Float64Array(nC); for (let i = 0; i < nC; i++) { rx[i] = ct[i]; ry[i] = C.reconstruct(xs, fs, ct[i], 'sinc', -pad); } series.push({ x: rx, y: ry, color: 'c2', lw: 2.5, dash: [7, 5] }); }
    else if (s.rec === 'zoh') { series.push({ x: Float64Array.from([...sx, Tw]), y: Float64Array.from([...sy, sy[nS - 1]]), color: 'c2', lw: 2.5, step: true }); }
    series.push({ x: sx, y: sy, color: 'c4', stem: true, dots: true, lw: 1.5, r: 4 });
    const fa = C.alias(f, fs), fsg = C.aliasSigned(f, fs), al = f > fs / 2;
    /* Spektrum: wahre Linie, Spiegelungen (Images) bei ±f + k fs; Achse bis max(1,25 fs; 1,1 f) */
    const xmax = Math.max(1.55 * fs, f * 1.1, fs); const lines = []; const seen = [];
    for (let k = -3; k <= 4; k++) for (const sg of [1, -1]) { const v = sg * f + k * fs; if (v >= 0 && v <= xmax + 1e-9 && !seen.some(q => Math.abs(q - v) < 1e-9)) { seen.push(v); lines.push({ f: v, true: Math.abs(v - f) < 1e-9, inband: v <= fs / 2 + 1e-9 }); } }
    const sxL = new Float64Array(lines.length), syL = new Float64Array(lines.length); lines.forEach((l, i) => { sxL[i] = l.f; syL[i] = 1; });
    const trueL = lines.filter(l => l.true), imgL = lines.filter(l => !l.true && !l.inband), inL = lines.filter(l => !l.true && l.inband);
    const mk = (arr, color) => ({ x: Float64Array.from(arr.map(l => l.f)), y: Float64Array.from(arr.map(() => 1)), color, stem: true, dots: true, lw: 3, r: 4 });
    const sser = [mk(imgL, 'c2'), mk(trueL, 'c1')]; if (inL.length) sser.push(mk(inL, 'c4'));
    const err = s.rec === 'sinc' ? (() => { let m = 0, c = 0; for (let i = 0; i < nC; i++) { const tt = ct[i]; if (tt < 6 / fs || tt > Tw - 6 / fs) continue; m = Math.max(m, Math.abs(ry[i] - cy[i])); c++; } return c ? m : null; })() : null;
    return {
      plots: {
        time: { x0: 0, x1: Tw, y0: -1.3, y1: 1.3, xlabel: 'Zeit', title: 'Signal, Abtastwerte, Rekonstruktion', xfmt: v => C.fmt(v * 1e3, 3) + ' ms', series, xticks: niceTicks(0, Tw, 4), yticks: [-1, 0, 1] },
        spec: { x0: 0, x1: xmax, y0: 0, y1: 1.45, xlabel: 'Frequenz', title: 'Spektrum der Abtastwerte', xfmt: fmtF, series: sser, bands: [{ x0: 0, x1: fs / 2, color: 'c3', alpha: 0.13 }], vlines: [{ x: fs / 2, color: 'c3', label: 'f_s/2', ly: 16 }, { x: fs, color: 'c2', label: 'f_s', ly: 16 }], yticks: [], texts: [{ x: f, y: 1.18, text: 'f', color: 'c1' }].concat(fa !== f ? [{ x: fa, y: 1.18, text: 'Alias', color: 'c4' }] : []) }
      },
      metrics: [
        { k: 'Nyquist-Frequenz', v: fs / 2, u: 'Hz', f: 'f_s / 2' },
        { k: 'Verhältnis f / f_s', v: f / fs, u: '', f: 'muss unter 0,5 liegen' },
        { k: 'Scheinfrequenz', v: fa, u: 'Hz', f: '|f − n·f_s|' },
        { k: 'Rekonstruktionsfehler', v: err, u: 'V', f: s.rec === 'sinc' ? 'größter Abstand zum Original' : '' }
      ],
      aliasing: al, fa, fsg, err,
      aria: al ? `Abtastfrequenz ${C.fmt(fs)} Hz ist zu klein für ${C.fmt(f)} Hz. Die Abtastwerte zeigen eine Scheinfrequenz von ${C.fmt(fa)} Hz.` : `Abtastfrequenz ${C.fmt(fs)} Hz reicht für ${C.fmt(f)} Hz, kein Aliasing.`
    };
  }

  /* 4. Filter: s = { type, order, f0, Q, fu, fo, fm } */
  const FMIN = 10, FMAX = 100000;
  function fil(s) {
    const F = C.mkFilter(s.type, s.order, { f0: s.f0, Q: s.Q, fu: s.fu, fo: s.fo }), B = C.bode(F, FMIN, FMAX, 220), cut = C.cutoffs(F), pg = C.peakGain(F), pgdb = C.db20(pg);
    const dbs = Float64Array.from(B.db, v => Math.max(v, -90));
    const ytop = Math.max(6, Math.ceil((pgdb + 3) / 6) * 6), ybot = ytop - 66, fm = s.fm;
    /* Sprungantwort */
    const bp1 = s.type === 'bp' && s.order === 1, wref = bp1 ? Math.min(s.fu, s.fo) : s.f0, T = (s.order === 2 && !bp1 ? Math.max(8, 16 * s.Q) : 6) / (TAU * wref), nT = 360, dt = T / (nT - 1);
    const yr = C.respond(F, nT, dt), tt = Float64Array.from({ length: nT }, (_, i) => i * dt), M = C.stepMetrics(yr, dt), tu = timeUnit(T);
    let lo = Infinity, hi = -Infinity; for (let i = 0; i < nT; i++) { lo = Math.min(lo, yr[i]); hi = Math.max(hi, yr[i]); }
    const yl0 = Math.min(-0.1, lo - 0.1), yl1 = Math.max(1.1, hi + 0.1);
    const hm = C.H(F, fm), mm = C.db20(Math.hypot(hm.re, hm.im), -300), pm = C.phase(F, fm);
    const vlc = cut.map((c, i) => ({ x: c, color: 'c3', dash: [3, 4], label: (cut.length > 1 ? (i ? 'f_o ' : 'f_u ') : 'f_g ') + C.fmtHz(c, 3), ly: 18 + 18 * i }));
    const vlm = { x: fm, color: 'c2', dash: [], lw: 2 };
    return {
      plots: {
        mag: { x0: FMIN, x1: FMAX, xlog: true, y0: ybot, y1: ytop, xlabel: 'Frequenz in Hz', title: '|H| in dB', series: [{ x: B.f, y: dbs, color: 'c1', lw: 2.5 }], hlines: [{ y: (s.type === 'bp' ? pgdb : 0) - 3.0103, color: 'c3', label: s.type === 'bp' ? '−3 dB zum Maximum' : '−3 dB' }], vlines: vlc.concat([vlm]), yticks: niceTicks(ybot, ytop, 6), yfmt: v => C.fmt(v, 3) },
        pha: { x0: FMIN, x1: FMAX, xlog: true, y0: -200, y1: 200, xlabel: 'Frequenz in Hz', title: 'Phase in Grad', series: [{ x: B.f, y: B.ph, color: 'c4', lw: 2.5 }], vlines: [vlm], yticks: [-180, -90, 0, 90, 180], yfmt: v => C.fmt(v, 3) },
        step: { x0: 0, x1: T, y0: yl0, y1: yl1, xlabel: 'Zeit in ' + tu.u, title: 'Sprungantwort', xfmt: v => C.fmt(v * tu.k, 3), series: [{ x: tt, y: yr, color: 'c1', lw: 2.5 }], hlines: [{ y: 1, color: 'c3', label: '' }, { y: 0, color: 'c3', dash: [2, 5], label: '' }], xticks: niceTicks(0, T * tu.k, 5).map(v => v / tu.k) }
      },
      metrics: [
        { k: cut.length > 1 ? 'Grenzfrequenzen (−3 dB)' : 'Grenzfrequenz (−3 dB)', v: cut, u: 'Hz', f: '' },
        { k: 'Flankensteilheit', v: s.type === 'bp' ? 20 : 20 * s.order, u: 'dB/Dekade', f: s.type === 'bp' ? 'je Flanke' : 'Ordnung × 20' },
        { k: 'Höchste Verstärkung', v: pgdb, u: 'dB', f: '' },
        { k: 'Überschwingen', v: s.type === 'lp' ? M.over * 100 : null, u: '%', f: s.type === 'lp' ? 'Sprungantwort' : 'nur Tiefpass' },
        { k: 'Anstiegszeit 10…90 %', v: s.type === 'lp' ? M.rise : null, u: 's', f: s.type === 'lp' ? '' : 'nur Tiefpass' },
        { k: 'Bei Messfrequenz ' + C.fmtHz(fm, 3), v: mm, u: 'dB', f: C.fmt(pm, 3) + '°' }
      ],
      F, cut, M, mm, pm,
      aria: `${s.type === 'bp' ? (s.order === 1 ? 'Bandpass aus Hochpass und Tiefpass' : 'Bandpass als Schwingkreis mit Güte Q') : (s.type === 'lp' ? 'Tiefpass' : 'Hochpass') + ' ' + s.order + '. Ordnung'}, Grenzfrequenz ${cut.map(c => C.fmtHz(c, 3)).join(' und ')}. Bei ${C.fmtHz(fm, 3)} beträgt der Betrag ${C.fmt(mm, 3)} dB und die Phase ${C.fmt(pm, 3)} Grad.`
    };
  }

  /* 5. Faltung: s = { x:[], h:[], n } */
  function fal(s) {
    const x = s.x, h = s.h, y = C.conv(x, h), L = y.length, n = Math.max(0, Math.min(L - 1, s.n | 0)), T = C.convTerms(x, h, n);
    const lo = -(h.length - 1), hi = Math.max(x.length - 1, L - 1);
    const ks = Float64Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const mx = Math.max(1, ...x.map(Math.abs), ...h.map(Math.abs)), my = Math.max(1, ...y.map(Math.abs)), pr = T.map(q => q.p), mp = Math.max(1, ...pr.map(Math.abs));
    const base = { x0: lo - 0.7, x1: hi + 0.7, xticks: ks.length > 20 ? niceTicks(lo, hi, 10) : Array.from(ks), xfmt: v => String(Math.round(v)), mb: 26, ml: 44 };
    const xArr = Float64Array.from(x.map((_, i) => i)), yArr = Float64Array.from(y.map((_, i) => i));
    /* h gespiegelt und verschoben: Wert h[n-k] an Position k */
    const hf = ks.map(k => { const j = n - k; return j >= 0 && j < h.length ? h[j] : NaN; });
    const prod = ks.map(k => { const j = n - k; return k >= 0 && k < x.length && j >= 0 && j < h.length ? x[k] * h[j] : NaN; });
    const panel = (title, ser, yr, extra) => Object.assign({}, base, { title, y0: -yr, y1: yr, series: ser, yticks: niceTicks(-yr, yr, 3), yfmt: v => C.fmt(v, 3) }, extra || {});
    return {
      plots: {
        px: panel('x[k]', [{ x: xArr, y: Float64Array.from(x), color: 'c1', stem: true, dots: true, lw: 3 }], mx * 1.25),
        ph: panel('h[n − k] (gespiegelt, um n = ' + n + ' verschoben)', [{ x: ks, y: Float64Array.from(hf), color: 'c2', stem: true, dots: true, lw: 3 }], mx * 1.25, { vlines: [{ x: n, color: 'c2', dash: [3, 4] }] }),
        pp: panel('Produkte x[k]·h[n − k]', [{ x: ks, y: Float64Array.from(prod), color: 'c4', stem: true, dots: true, lw: 3 }], mp * 1.25),
        py: panel('y[n] = Summe der Produkte', [{ x: yArr, y: Float64Array.from(y), color: 'c3', stem: true, dots: true, lw: 3 }, { x: Float64Array.of(n), y: Float64Array.of(y[n]), color: 'c2', stem: true, dots: true, lw: 5, r: 6 }], my * 1.25, { vlines: [{ x: n, color: 'c2', dash: [3, 4] }] })
      },
      y, n, terms: T, value: y[n],
      metrics: [{ k: 'y[' + n + ']', v: y[n], u: '', f: T.length ? T.map(q => C.fmt(q.x, 3) + '·' + C.fmt(q.h, 3)).join(' + ') : 'keine Überdeckung' }, { k: 'Länge von y', v: L, u: '', f: 'M + K − 1' }, { k: 'Summe aller y', v: y.reduce((p, q) => p + q, 0), u: '', f: 'Σx · Σh' }],
      aria: `Faltung, Ausgangswert y[${n}] = ${C.fmt(y[n], 4)}.`
    };
  }

  /* 6. Modulation: s = { kind:'am'|'fm', fc, fm, m, df, env } */
  const MFS = 8192, MN = 4096;
  function mod(s) {
    const isAm = s.kind === 'am', p = { Ac: 1, fc: s.fc, fm: s.fm, m: s.m, df: s.df };
    const Tw = Math.min(3 / s.fm, 60 / s.fc), nT = 1500, tt = new Float64Array(nT), yy = new Float64Array(nT), mm = new Float64Array(nT);
    for (let i = 0; i < nT; i++) { tt[i] = Tw * i / (nT - 1); yy[i] = isAm ? C.amAt(p, tt[i]) : C.fmAt(p, tt[i]); mm[i] = isAm ? Math.cos(TAU * s.fm * tt[i]) : Math.sin(TAU * s.fm * tt[i]); }
    const x = new Float64Array(MN); for (let i = 0; i < MN; i++) x[i] = isAm ? C.amAt(p, i / MFS) : C.fmAt(p, i / MFS);
    const S = C.ampSpec(x, 'rect'), df = MFS / MN;
    const car = isAm ? C.carson(0, s.fm) : C.carson(s.df, s.fm), span = isAm ? 5 * s.fm : Math.max(3.2 * s.fm, 0.85 * car), f0 = Math.max(0, s.fc - span), f1 = Math.min(MFS / 2, s.fc + span);
    const k0 = Math.max(0, Math.floor(f0 / df)), k1 = Math.min(MN / 2, Math.ceil(f1 / df)), fx = [], fy = [];
    for (let k = k0; k <= k1; k++) { fx.push(k * df); fy.push(S.a[k]); }
    const series = [{ x: tt, y: yy, color: 'c1', lw: 1.3 }];
    const hl = [];
    let env = null;
    if (isAm) {
      const e = new Float64Array(nT); for (let i = 0; i < nT; i++) e[i] = 1 + s.m * Math.cos(TAU * s.fm * tt[i]);
      const neg = Float64Array.from(e, v => -v); series.push({ x: tt, y: e, color: 'c2', lw: 2 }, { x: tt, y: neg, color: 'c2', lw: 2 });
      if (s.env) { const dem = C.envelope(yy, (nT - 1) / Tw, Math.sqrt(s.fm * s.fc)); const dd = new Float64Array(nT); for (let i = 0; i < nT; i++) dd[i] = dem[i]; series.push({ x: tt, y: dd, color: 'c3', lw: 2.5, dash: [8, 4] }); env = dd; }
    } else series.push({ x: tt, y: Float64Array.from(mm, v => 1.6 * v), color: 'c2', lw: 1.5, dash: [6, 4] });
    const ymax = isAm ? Math.max(1.4, 1 + s.m + 0.2) : 1.8;
    const texts = [];
    if (isAm) { texts.push({ x: s.fc, y: 1.04, text: 'Träger', color: 'fg' }); }
    const nLines = isAm ? 3 : C.fmLines(p, 12).filter(l => l.a > 0.01).length;
    const lines = isAm ? C.amLines(p) : null;
    return {
      plots: {
        time: { x0: 0, x1: Tw, y0: -ymax, y1: ymax, xlabel: 'Zeit', title: isAm ? 'AM: Signal und Hüllkurve' : 'FM: Signal (gestrichelt: Nachricht)', xfmt: v => C.fmt(v * 1e3, 3) + ' ms', series, xticks: niceTicks(0, Tw, 4), yticks: [-1, 0, 1] },
        spec: { x0: f0, x1: f1, y0: 0, y1: 1.25, xlabel: 'Frequenz', title: 'Spektrum', xfmt: v => C.fmt(v, 4), series: [{ x: Float64Array.from(fx), y: Float64Array.from(fy), color: 'c1', stem: true, lw: 3 }], yticks: [0, 0.5, 1], texts, hlines: hl, vlines: isAm ? [] : [{ x: s.fc - car / 2, color: 'c3', dash: [4, 4], label: 'Carson', ly: 16 }, { x: s.fc + car / 2, color: 'c3', dash: [4, 4], label: '', ly: 16 }] }
      },
      metrics: isAm ? [
        { k: 'Modulationsgrad m', v: s.m * 100, u: '%', f: s.m > 1 ? 'Übermodulation!' : 'Â_m / Â_T' },
        { k: 'Bandbreite', v: 2 * s.fm, u: 'Hz', f: '2 · f_m' },
        { k: 'Seitenlinie', v: lines[0].a, u: 'V', f: 'm · Â_T / 2 (bei Â_T = 1 V)' },
        { k: 'Anteil Seitenbänder', v: C.amEta(s.m) * 100, u: '%', f: 'm² / (2 + m²)' }
      ] : [
        { k: 'Modulationsindex β', v: s.df / s.fm, u: '', f: 'Δf / f_m' },
        { k: 'Bandbreite (Carson)', v: car, u: 'Hz', f: '2 · (Δf + f_m)' },
        { k: 'Linien über 1 %', v: nLines, u: '', f: 'Besselfunktionen J_n(β)' },
        { k: 'Träger-Linie', v: Math.abs(C.besselJ(0, s.df / s.fm)), u: 'V', f: 'J₀(β)' }
      ],
      S, x, env,
      aria: isAm ? `Amplitudenmodulation mit Träger ${s.fc} Hz, Modulationsfrequenz ${s.fm} Hz und Modulationsgrad ${C.fmt(s.m * 100)} Prozent.` : `Frequenzmodulation mit Träger ${s.fc} Hz, Hub ${s.df} Hz, Modulationsindex ${C.fmt(s.df / s.fm)}.`
    };
  }

  /* ---------------- Zeichnen ---------------- */
  /* Canvas auf CSS-Größe bringen (Geräte-Pixel höchstens 2x, wegen Leistung auf dem Handy) */
  function prep(canvas, hCss) {
    const w = Math.max(160, Math.round(canvas.clientWidth || (canvas.parentNode && canvas.parentNode.clientWidth) || 320)), dpr = Math.min(2, root.devicePixelRatio || 1);
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

  const api = { FS, FONT, pal, niceTicks, logTicks, plot, resolve, prep, draw, timeUnit, fmtF, WNAME, FORM, FMIN, FMAX, MFS, MN, MODELS: { kenn, spek, abt, fil, fal, mod } };
  root.SIG_VIZ = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
