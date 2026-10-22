/* emvdraw.js - EMV-Lab Zeichenhelfer (EMV_DRAW, Version 1.0), Paket WP1b
 * Visualisierung des EMV-Labs (SPEC Abschnitt 6): Feldlinien E und H, Wellenringe, Stoerstrom-Partikel, animiertes Spektrum, Kurven, Zeitverlaeufe,
 * Vorher/Nachher-Wischer, Ampel mit Symbolen, Leiterplatte, Gehaeuse, Leitung, ESD-Pistole, Tastkopf, Netznachbildung, Geraet, Filterschaltbild,
 * Nahfeldkarte, Wirkungskette, Qualitaetsstufen. Vanilla-JS, keine Abhaengigkeiten, kein eval, offline.
 * Browser: window.EMV_DRAW, Node: module.exports / globalThis.EMV_DRAW (Zeichnen nur gegen einen Kontext-Mock).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Jede Funktion hat die Form f(ctx, ...), ctx = Canvas-2D-Kontext (im Test ein Mock). Koordinaten in CSS-Pixeln, der Aufrufer setzt Transform und loescht.
 *  - Rueckgabe: false = nichts gezeichnet (dann KEIN Aufruf am ctx: kein save, kein path). Sonst true oder ein Ergebnisobjekt (truthy), siehe unten.
 *    false bei: unbrauchbarem ctx, Daten mit NaN/Infinity/Betrag >= 1e7, Rechteck zu klein, fehlenden Pflichtdaten. Zahlen als Text sind KEINE Zahlen.
 *  - Alle Optionen optional; ungueltige fallen auf den Vorgabewert zurueck. Nach dem Aufruf sind save/restore ausgeglichen.
 *  - Farben: opts.palette (Objekt oder 'light'/'dark'; ueberschreibt einzelne Schluessel der Palette) vor opts.colors vor opts.theme ('dark' Standard).
 *    EMV_DRAW.palette(theme) liefert die Palette (Schluessel wie EMV_RIGS.base: bg panel panel2 line grid fg mute quelle senke pfad masse efeld hfeld grenz schutz
 *    schirm gruen gelb rot grau flaeche platine kupfer glow, dazu series[] und levers{}). EMV_DRAW.cssColors(el) liest CSS-Variablen der Seite.
 *    Alle Textfarben haben >= 4,5:1 Kontrast auf bg und panel (Test).
 *  - opts.quality 'hoch'|'mittel'|'niedrig' und opts.reduced (prefers-reduced-motion => niedrig, keine Bewegung) wirken auf Partikelpool (600/300/120),
 *    Feldlinien (24/16/8), Leuchten (lighter), Schatten und Verlaeufe. EMV_DRAW.createGovernor() ist der Regler der Bildzeit (SPEC 6.4).
 *  - Zahlen mit Dezimalkomma; Mindestschrift 12 px (11 px bei Breite < 420); Text ueber Linien immer mit Platte; Zahlen stehen immer zusaetzlich im Bild.
 *  - Nichts blinkt: Pulse hoechstens 0,8 Hz, der Funke ist eine einmalige Aufhellung (<= 200 ms).
 *
 * ===================================================================================================
 * FUNKTIONEN (Datenformate)
 *  fieldE(ctx, rect, src, opts)      src = { ratio } | { cm, cg } (ratio = Cm/(Cm+Cg)), s, h (Seitenverhaeltnis). opts = { lines<=24, phase, amp, caption }.
 *                                    Ergebnis { n, hits, ratio, target }: hits von n Linien erreichen das Opfer, round(n*target) +- 1. Cache: fieldECompute (stats().fieldE).
 *  fieldH(ctx, rect, wires, opts)    wires = [{ x, y, i }] (y > 0 ueber der Masseflaeche, i mit Vorzeichen), opts = { victim:{x,y}, ratio (M/Ls), lines, phase, amp }.
 *                                    Ergebnis { n, through, ratio, target }: through von n Linien laufen durch die Opferschleife.
 *  waves(ctx, x, y, o)               o = { t (ms), lambda (m), margin (dB), rings<=8, maxR, quarter }; waveSpacing(lambda), waveBrightness(margin) (Test/Rigs).
 *  createParticles(paths, opts)      -> { step(dtMs), draw(ctx), setRate(pfad, r), setPaths, count(), speedOf(pfad), positions(pfad), pool, reduced }
 *                                    paths = [{ id, pts, rate 0..1, dir +-1, color, size }]; opts = { quality, reduced, seed, speed }.
 *  spectrumBars(ctx, rect, lines, opts)  lines = [{ f, L }] | rig.spectrum(); opts = { unit, fMin, fMax, env, limits:[{id,name,pts}], floor, marker, ghost, ghostAlpha,
 *                                    anim: spectrumState(), t (ms), seed }. Tween 300 ms, Spitzenwert-Halten 6 dB/s, Farbe nach Marge; limitAt(pts, f).
 *  curveChart(ctx, rect, curves, opts)   curves = rig.curves()-Format. traceChart(ctx, rect, wave, opts)   wave = rig.waveform()-Format.
 *  ampel(ctx, x, y, state, o)        state = 'gruen'|'gelb'|'rot'|'grau' | assess-Objekt; ampelText(state, margin) fuer aria-label.
 *  wipe(ctx, rect, drawA, drawB, pos)  + wipeHit(rect, pos, px, py), wipePos(rect, px). Griff 44 px.
 *  layoutBoard(ctx, rect, model, o)  model siehe Kopfkommentar der Funktion (Welt in mm); shieldBox(ctx, rect, o); cable(ctx, pts, o); gun(ctx, x, y, o);
 *  probeScene(ctx, rect, o); lisn(ctx, x, y, o); device(ctx, x, y, w, h, o); filterSchematic(ctx, rect, cfg, o) + filterPaths(rect, 'GT'|'GG') (Partikelpfade); heatmap(ctx, rect, grid, o);
 *  chainBar(ctx, rect, chain, active, o).
 *  Hilfen: label, arrow, icon, palette, cssColors, fz, fzt, fHz, ticks, logTicks, mix, rgba, contrast, rng, version, fns, stats(), resetCache().
 *  Mindestgroessen: spectrumBars 200x120, curveChart 200x120, traceChart 200x120, layoutBoard 160x110, heatmap 120x90, chainBar 220x44, fieldE/fieldH 120x90.
 */
(function (root) {
  'use strict';
  const VERSION = '1.0';

  /* =================================================================================================================
   *  A. Grundlagen: Pruefungen, Zahlen, Farben, Qualitaetsstufen, Text
   * ================================================================================================================= */
  /* endlich und vernuenftig gross (Betrag < 1e7): schuetzt vor Endlosschleifen und Ueberlauf bei Unsinnswerten (SPEC 6.2) */
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e7;
  const afin = v => typeof v === 'number' && isFinite(v);
  /* Messdaten (Frequenzen bis GHz, Zeiten): weiter gefasst als Pixelkoordinaten */
  const dfin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e13;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  function nz(o, k, def, lo, hi) {
    const v = o[k];
    if (!fin(v)) return def;
    return cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  }
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 80 && !/NaN|undefined|null|Infinity/i.test(v);
  const isRect = r => !!r && typeof r === 'object' && fin(r.x) && fin(r.y) && fin(r.w) && fin(r.h) && r.w > 0 && r.h > 0;

  /* Zufall: mulberry32, deterministisch (Partikelstart, Funke, Rauschteppich) */
  function rng(seed) {
    let a = (afin(seed) ? Math.floor(seed) : 1) >>> 0 || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------------------------------------------------------------- Palette (SPEC 6.1; Schluessel wie EMV_RIGS.base) */
  const PAL = {
    dark: {
      theme: 'dark', bg: '#0e1621', panel: '#16212f', panel2: '#1d2b3d', line: '#34475c', grid: '#26364a', fg: '#e8eef5', mute: '#9fb2c6',
      quelle: '#ff7a3d', senke: '#35c6ff', pfad: '#b79cff', masse: '#34d6a4', efeld: '#a78bfa', hfeld: '#ffc233', grenz: '#ffffff',
      schutz: '#5b9bff', schirm: '#9aa6b2', gruen: '#4cd964', gelb: '#ffcc3d', rot: '#ff6b6b', grau: '#8d99a6',
      flaeche: 'rgba(52,214,164,0.16)', platine: '#123a2f', kupfer: '#d9a441', glow: true
    },
    light: {
      theme: 'light', bg: '#f4f7fa', panel: '#ffffff', panel2: '#e8eef4', line: '#b7c5d3', grid: '#dde3e9', fg: '#14202c', mute: '#445568',
      quelle: '#b3390a', senke: '#0369a1', pfad: '#6d3fd6', masse: '#0b6e5b', efeld: '#6d28d9', hfeld: '#8f5b00', grenz: '#14202c',
      schutz: '#1d4ed8', schirm: '#566371', gruen: '#13732f', gelb: '#8f5b00', rot: '#b91c1c', grau: '#566371',
      flaeche: 'rgba(11,110,91,0.16)', platine: '#cfe8df', kupfer: '#a8741a', glow: false
    }
  };
  /* Textfarben, die der Kontrastpruefung (>= 4,5:1 auf bg und panel) unterliegen */
  const TEXT_KEYS = ['fg', 'mute', 'quelle', 'senke', 'pfad', 'masse', 'efeld', 'hfeld', 'grenz', 'schutz', 'schirm', 'gruen', 'gelb', 'rot', 'grau'];

  function parseColor(c) {
    if (typeof c !== 'string') return null;
    const s = c.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), 1];
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16), 1];
    m = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(s);
    if (m) return [cl(+m[1], 0, 255), cl(+m[2], 0, 255), cl(+m[3], 0, 255), m[4] === undefined ? 1 : cl(+m[4], 0, 1)];
    return null;
  }
  const hex2 = v => ('0' + Math.round(cl(v, 0, 255)).toString(16)).slice(-2);
  /* Farbmischung a -> b (t 0..1) */
  function mix(a, b, t) {
    const A = parseColor(a), B = parseColor(b);
    if (!B) return typeof b === 'string' && goodColor(b) ? b : '#888888';
    if (!A || !fin(t)) return '#' + hex2(B[0]) + hex2(B[1]) + hex2(B[2]);
    t = cl(t, 0, 1);
    return '#' + hex2(A[0] + (B[0] - A[0]) * t) + hex2(A[1] + (B[1] - A[1]) * t) + hex2(A[2] + (B[2] - A[2]) * t);
  }
  /* Farbe mit Deckkraft als rgba-Text; nicht lesbare Farben bleiben unveraendert */
  function rgba(c, a) {
    const A = parseColor(c);
    if (!A) return goodColor(c) ? c : '#888888';
    return 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + (Math.round(cl(fin(a) ? a : 1, 0, 1) * 1000) / 1000) + ')';
  }
  function lum(c) {
    const A = parseColor(c); if (!A) return NaN;
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(A[0]) + 0.7152 * f(A[1]) + 0.0722 * f(A[2]);
  }
  /* Kontrastverhaeltnis nach WCAG (>= 4,5 fuer Text) */
  function contrast(a, b) {
    const x = lum(a), y = lum(b);
    if (!(x >= 0) || !(y >= 0)) return NaN;
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  /* palette(theme | Objekt): immer eine neue, vollstaendige Palette; Objekt ueberschreibt einzelne Farben (z. B. aus cssColors) */
  function palette(c) {
    let base = PAL.dark;
    if (c === 'light') base = PAL.light;
    else if (c && typeof c === 'object') {
      if (c.theme === 'light') base = PAL.light;
      else if (c.theme !== 'dark' && goodColor(c.bg) && lum(c.bg) > 0.45) base = PAL.light;
    }
    const out = Object.assign({}, base);
    if (c && typeof c === 'object') Object.keys(base).forEach(k => { if (typeof base[k] === 'string' && k !== 'theme' && goodColor(c[k])) out[k] = c[k]; });
    out.glow = base.glow;
    out.series = [out.quelle, out.senke, out.masse, out.efeld, out.hfeld, out.schirm];
    out.levers = { quelle: out.quelle, pfad: out.pfad, senke: out.senke };
    return out;
  }
  /* Palette aus den Optionen: opts.palette (Objekt oder Text) vor opts.colors vor opts.theme */
  function pal(o) {
    o = obj(o);
    if (o.palette && (typeof o.palette === 'object' || typeof o.palette === 'string')) return palette(o.palette);
    if (o.colors) return palette(o.colors);
    return palette(o.theme);
  }
  /* liest die CSS-Variablen der Seite (--bg --panel --panel2 --fg --mute --line ...); ohne DOM leeres Objekt */
  function cssColors(el) {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return {};
    const out = {};
    try {
      const cs = getComputedStyle(el && el.nodeType === 1 ? el : document.documentElement);
      [['bg', '--bg'], ['panel', '--panel'], ['panel2', '--panel2'], ['fg', '--fg'], ['mute', '--mute'], ['line', '--line'], ['grid', '--grid'],
        ['quelle', '--emv-quelle'], ['senke', '--emv-senke'], ['pfad', '--emv-pfad'], ['masse', '--emv-masse'], ['efeld', '--emv-efeld'], ['hfeld', '--emv-hfeld'],
        ['gruen', '--ok'], ['gelb', '--warn'], ['rot', '--danger']].forEach(p => {
        const v = cs.getPropertyValue(p[1]).trim();
        if (goodColor(v) && parseColor(v)) out[p[0]] = v;
      });
      if (out.bg && lum(out.bg) > 0.45) out.theme = 'light'; else if (out.bg) out.theme = 'dark';
    } catch (e) { /* ohne Stile: Standardpalette */ }
    return out;
  }
  function ampelColor(pl, state) { return pl[state === 'gruen' || state === 'gelb' || state === 'rot' ? state : 'grau']; }

  /* ---------------------------------------------------------------- Qualitaetsstufen (SPEC 6.4) */
  const QUAL = {
    hoch: { name: 'hoch', particles: 600, fieldLines: 24, glow: true, shadow: true, gradients: true },
    mittel: { name: 'mittel', particles: 300, fieldLines: 16, glow: true, shadow: false, gradients: true },
    niedrig: { name: 'niedrig', particles: 120, fieldLines: 8, glow: false, shadow: false, gradients: false }
  };
  const QORDER = ['niedrig', 'mittel', 'hoch'];
  /* opts = { quality, reduced }: reduced (prefers-reduced-motion) erzwingt niedrig */
  function qualityOf(o) {
    o = obj(o);
    const q = o.quality && QUAL[o.quality] ? o.quality : 'hoch';
    return QUAL[o.reduced === true ? 'niedrig' : q];
  }
  /* Regler fuer die Qualitaetsstufe (SPEC 6.4): gleitender Mittelwert der Bildzeit ueber 30 Bilder; > 22 ms: EINE Stufe zurueck,
   * < 10 ms ueber 3 s: eine Stufe hoch. frame(dtMs) liefert den Namen der aktuellen Stufe. reduced -> immer niedrig. */
  function createGovernor(opts) {
    opts = obj(opts);
    const N = 30, slow = nz(opts, 'slowMs', 22, 1, 5000), fast = nz(opts, 'fastMs', 10, 0.1, 5000), upMs = nz(opts, 'upAfterMs', 3000, 100, 600000);
    const buf = new Float64Array(N);
    let q = QUAL[opts.start] ? opts.start : 'hoch', cnt = 0, idx = 0, sum = 0, fastFor = 0, reduced = opts.reduced === true;
    function reset() { cnt = 0; idx = 0; sum = 0; fastFor = 0; buf.fill(0); }
    const g = {
      frame(dtMs) {
        if (!afin(dtMs) || dtMs < 0) return reduced ? 'niedrig' : q;
        dtMs = Math.min(dtMs, 1000);
        sum += dtMs - buf[idx]; buf[idx] = dtMs; idx = (idx + 1) % N; if (cnt < N) cnt++;
        if (reduced) return 'niedrig';
        const mean = sum / cnt;
        if (cnt >= N && mean > slow) { const i = QORDER.indexOf(q); if (i > 0) q = QORDER[i - 1]; reset(); return q; }
        if (cnt >= N && mean < fast) fastFor += dtMs; else fastFor = 0;
        if (fastFor >= upMs) { const i = QORDER.indexOf(q); if (i < QORDER.length - 1) q = QORDER[i + 1]; reset(); }
        return q;
      },
      quality() { return reduced ? 'niedrig' : q; },
      mean() { return cnt ? sum / cnt : 0; },
      set(name) { if (QUAL[name]) { q = name; reset(); } return g.quality(); },
      setReduced(f) { reduced = !!f; return g.quality(); }
    };
    return g;
  }

  /* ---------------------------------------------------------------- Zahlen und Text */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    let s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d);
    s = s.replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  /* wie fz, aber ohne nachgestellte Nullen (",50" -> ",5") */
  function fzt(v, d) { let s = fz(v, d); if (s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, ''); return s; }
  /* Frequenz mit Einheitenvorsatz: 150 kHz, 30 MHz, 1,5 GHz */
  function fHz(f) {
    if (!fin(f) && !(afin(f) && Math.abs(f) < 1e12)) return '–';
    const a = Math.abs(f);
    if (a >= 1e9) return fzt(f / 1e9, a >= 1e10 ? 1 : 2) + ' GHz';
    if (a >= 1e6) return fzt(f / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + ' MHz';
    if (a >= 1e3) return fzt(f / 1e3, a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2) + ' kHz';
    return fzt(f, a >= 100 ? 0 : 1) + ' Hz';
  }
  function ticks(lo, hi, n) {
    if (!fin(lo) || !fin(hi) || !(hi > lo)) return { t: [], s: NaN };
    n = fin(n) ? Math.max(2, Math.min(20, Math.round(n))) : 4;
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const s = (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
    const k0 = Math.ceil(lo / s - 1e-9), t = [];
    for (let k = k0; t.length < 60; k++) { const v = k * s; if (v > hi + s * 1e-9) break; t.push(+v.toPrecision(12)); }
    return { t, s };
  }
  /* Ticks einer Logarithmusachse im 1-2-5-Raster: so dicht wie moeglich, hoechstens maxN Stueck */
  function logTicks(lo, hi, maxN) {
    if (!(lo > 0) || !(hi > lo) || !dfin(lo) || !dfin(hi)) return [];
    maxN = fin(maxN) ? Math.max(2, Math.floor(maxN)) : 8;
    const e0 = Math.floor(Math.log10(lo)), e1 = Math.ceil(Math.log10(hi));
    const gen = set => { const r = []; for (let e = e0; e <= e1 && e - e0 < 40; e++) set.forEach(m => { const v = m * Math.pow(10, e); if (v >= lo * 0.9999 && v <= hi * 1.0001) r.push(v); }); return r; };
    const sets = [[1, 2, 3, 5, 7], [1, 2, 5], [1, 3], [1]];
    for (let i = 0; i < sets.length; i++) { const r = gen(sets[i]); if (r.length <= maxN) return r; }
    const r = gen([1]), step = Math.ceil(r.length / maxN);
    return r.filter((v, i) => i % step === 0);
  }
  const digitsOfStep = s => (fin(s) && s > 0 ? Math.max(0, Math.min(4, Math.ceil(-Math.log10(s) - 1e-9))) : 0);
  const fsz = w => (w < 420 ? 11 : 12);      /* Mindestschrift: 12 px, bei 390 px Breite 11 px (SPEC 6.1) */

  /* ---------------------------------------------------------------- Zeichenbasis */
  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && typeof ctx.save === 'function' && typeof ctx.restore === 'function' &&
      typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function' &&
      typeof ctx.stroke === 'function' && typeof ctx.fill === 'function';
  }
  /* save, zeichnen, restore; Ausnahme im Zeichenteil -> restore und false */
  function draw(ctx, fn) {
    ctx.save();
    try { const r = fn(); ctx.restore(); return r === undefined ? true : r; } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorieren */ } return false; }
  }
  const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '') + (Math.round(size * 10) / 10) + 'px ' + FONT; }
  function tw(ctx, t, size, bold) {
    if (typeof ctx.measureText === 'function') { const m = ctx.measureText(t); if (m && fin(m.width)) return m.width; }
    return t.length * size * (bold ? 0.6 : 0.56);
  }
  function fitText(ctx, t, maxw, size, bold) {
    if (t === '' || !(maxw > 0)) return '';
    if (tw(ctx, t, size, bold) <= maxw) return t;
    let s = t;
    while (s.length > 1 && tw(ctx, s + '…', size, bold) > maxw) s = s.slice(0, -1);
    return s.length > 1 || tw(ctx, s + '…', size, bold) <= maxw ? s.replace(/\s+$/, '') + '…' : '';
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function poly(ctx, pts, close) {
    ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); if (close) ctx.closePath();
  }
  function normPts(pts, minN, chk) {
    chk = chk || fin;
    if (!Array.isArray(pts) || pts.length < (minN || 2) || pts.length > 4000) return null;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; let x, y;
      if (Array.isArray(p)) { x = p[0]; y = p[1]; } else if (p && typeof p === 'object') { x = p.x; y = p.y; } else return null;
      if (!chk(x) || !chk(y)) return null;
      out.push([x, y]);
    }
    return out;
  }
  function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  const NODASH = [];
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d); if (off !== undefined) ctx.lineDashOffset = off; }
  /* Rechteck pruefen und Mindestgroesse (SPEC 6.2): sonst null */
  function rectMin(rect, minW, minH) { return isRect(rect) && rect.w >= minW && rect.h >= minH ? rect : null; }

  /* ---------------------------------------------------------------- Pfeil und Beschriftung */
  function arrowRaw(ctx, x0, y0, x1, y1, head, color, width, dash) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (!(L > 0)) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(head, L), hw = hl * 0.42;
    const bx = x1 - ux * hl, by = y1 - uy * hl;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = 'butt';
    setDash(ctx, dash || NODASH);
    if (L > hl * 0.8) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx + ux * hl * 0.2, by + uy * hl * 0.2); ctx.stroke(); }
    setDash(ctx, NODASH);
    poly(ctx, [[x1, y1], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, o) {
    if (!okCtx(ctx) || !fin(x0) || !fin(y0) || !fin(x1) || !fin(y1) || !(Math.hypot(x1 - x0, y1 - y0) > 0)) return false;
    o = obj(o); const P = pal(o);
    const dash = Array.isArray(o.dash) && o.dash.length && o.dash.every(v => fin(v) && v >= 0) && o.dash.some(v => v > 0) ? o.dash.slice(0, 6) : null;
    return draw(ctx, () => arrowRaw(ctx, x0, y0, x1, y1, nz(o, 'head', 8, 2, 60), goodColor(o.color) ? o.color : P.fg, nz(o, 'width', 2, 0.5, 20), dash));
  }
  /* Textplatte + Text. align left|center|right, Grundlinie mittig; bg = Plattenfarbe (kein Text ueber Linien ohne Platte, SPEC 6.1) */
  function labelRaw(ctx, text, x, y, align, size, bold, color, bg, maxw) {
    font(ctx, size, bold);
    const t = maxw > 0 ? fitText(ctx, text, maxw, size, bold) : text;
    if (t === '') return false;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    const w = tw(ctx, t, size, bold);
    if (bg) {
      const pw = w + 8, x0 = align === 'left' ? x - 4 : align === 'right' ? x - pw + 4 : x - pw / 2;
      ctx.fillStyle = bg; rrect(ctx, x0, y - size * 0.78, pw, size * 1.56, 4); ctx.fill();
    }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
    return w;
  }
  function label(ctx, text, x, y, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y)) return false;
    const t = typeof text === 'number' ? (fin(text) ? fzt(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '') return false;
    o = obj(o); const P = pal(o);
    const align = o.align === 'left' || o.align === 'right' ? o.align : 'center';
    return draw(ctx, () => labelRaw(ctx, t, x, y, align, nz(o, 'size', 12, 6, 80), !!o.bold, goodColor(o.color) ? o.color : P.fg,
      goodColor(o.bg) ? o.bg : null, nz(o, 'maxw', 0, 0, 5000)) !== false);
  }
  /* interne Kurzform ohne Pruefung (Ausnahmen faengt der aeussere draw): liefert Textbreite */
  function lab(ctx, text, x, y, align, size, color, bg, bold, maxw) {
    return labelRaw(ctx, String(text), x, y, align, size, !!bold, color, bg, maxw || 0);
  }

  /* =================================================================================================================
   *  B. Symbole, Feldlinien E und H, Wellenringe, Partikelsystem
   * ================================================================================================================= */
  const STATS = { fieldE: 0, fieldH: 0 };            /* Zaehler der Neuberechnungen (Cache-Test, SPEC 6.4) */

  /* Vektorsymbole (kein Font noetig): check, warn, cross, dash, bolt, earth, dotout (⊙), dotin (⊗), plus, minus */
  function sym(ctx, kind, cx, cy, r, color, lw) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; setDash(ctx, NODASH);
    switch (kind) {
      case 'check': ctx.beginPath(); ctx.moveTo(cx - r * 0.55, cy + r * 0.02); ctx.lineTo(cx - r * 0.12, cy + r * 0.45); ctx.lineTo(cx + r * 0.6, cy - r * 0.42); ctx.stroke(); break;
      case 'warn': ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.55); ctx.lineTo(cx, cy + r * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy + r * 0.52, Math.max(0.8, lw * 0.62), 0, Math.PI * 2); ctx.fill(); break;
      case 'cross': ctx.beginPath(); ctx.moveTo(cx - r * 0.48, cy - r * 0.48); ctx.lineTo(cx + r * 0.48, cy + r * 0.48);
        ctx.moveTo(cx + r * 0.48, cy - r * 0.48); ctx.lineTo(cx - r * 0.48, cy + r * 0.48); ctx.stroke(); break;
      case 'dash': ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy); ctx.lineTo(cx + r * 0.45, cy); ctx.stroke(); break;
      case 'plus': ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.moveTo(cx, cy - r * 0.5); ctx.lineTo(cx, cy + r * 0.5); ctx.stroke(); break;
      case 'minus': ctx.beginPath(); ctx.moveTo(cx - r * 0.5, cy); ctx.lineTo(cx + r * 0.5, cy); ctx.stroke(); break;
      case 'bolt': poly(ctx, [[cx + r * 0.15, cy - r * 0.7], [cx - r * 0.4, cy + r * 0.1], [cx - r * 0.02, cy + r * 0.1], [cx - r * 0.18, cy + r * 0.7], [cx + r * 0.42, cy - r * 0.15], [cx + r * 0.04, cy - r * 0.15]], true); ctx.fill(); break;
      case 'earth': ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.6); ctx.lineTo(cx, cy - r * 0.05);
        ctx.moveTo(cx - r * 0.5, cy - r * 0.05); ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
        ctx.moveTo(cx - r * 0.33, cy + r * 0.25); ctx.lineTo(cx + r * 0.33, cy + r * 0.25);
        ctx.moveTo(cx - r * 0.16, cy + r * 0.55); ctx.lineTo(cx + r * 0.16, cy + r * 0.55); ctx.stroke(); break;
      case 'dotout': ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, Math.max(1, r * 0.2), 0, Math.PI * 2); ctx.fill(); break;
      case 'dotin': ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.3); ctx.lineTo(cx + r * 0.3, cy + r * 0.3);
        ctx.moveTo(cx + r * 0.3, cy - r * 0.3); ctx.lineTo(cx - r * 0.3, cy + r * 0.3); ctx.stroke(); break;
      default: return false;
    }
    return true;
  }
  const SYMS = ['check', 'warn', 'cross', 'dash', 'plus', 'minus', 'bolt', 'earth', 'dotout', 'dotin'];
  /* icon(ctx, kind, x, y, w, h, {color}): Symbol in der Box (x,y,w,h links oben). Unbekannte Art: false, nichts gezeichnet. */
  function icon(ctx, kind, x, y, w, h, o) {
    if (!okCtx(ctx) || SYMS.indexOf(kind) < 0 || !fin(x) || !fin(y) || !fin(w) || !fin(h) || !(w > 0) || !(h > 0)) return false;
    o = obj(o); const P = pal(o), r = Math.min(w, h) / 2;
    return draw(ctx, () => sym(ctx, kind, x + w / 2, y + h / 2, r, goodColor(o.color) ? o.color : P.fg, nz(o, 'width', Math.max(1.5, r * 0.18), 0.5, 12)));
  }

  /* Weltkoordinaten -> Pixel: Welt x0..x1, y0..y1 (y nach oben) in den freien Bereich des Rechtecks, gleicher Massstab */
  function fitWorld(rect, x0, x1, y0, y1, padL, padR, padT, padB) {
    const aw = rect.w - padL - padR, ah = rect.h - padT - padB;
    const s = Math.min(aw / (x1 - x0), ah / (y1 - y0));
    const ox = rect.x + padL + (aw - s * (x1 - x0)) / 2 - s * x0;
    const oy = rect.y + padT + (ah - s * (y1 - y0)) / 2 + s * y1;
    return { s, px: x => ox + x * s, py: y => oy - y * s };
  }
  /* Polylinie mit Mindestabstand ausduennen und durch Mittelpunkte glatt zeichnen (wenig Aufrufe) */
  function smoothPath(ctx, pts, minD) {
    if (pts.length < 2) return;
    const q = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) { const l = q[q.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= minD) q.push(pts[i]); }
    q.push(pts[pts.length - 1]);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]);
    if (q.length === 2) { ctx.lineTo(q[1][0], q[1][1]); return; }
    for (let i = 1; i < q.length - 1; i++) ctx.quadraticCurveTo(q[i][0], q[i][1], (q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2);
    ctx.lineTo(q[q.length - 1][0], q[q.length - 1][1]);
  }
  function hatch(ctx, x, y, w, h, step, color) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
    for (let k = -h; k < w; k += step) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
    ctx.stroke(); ctx.restore();
  }
  function dot(ctx, x, y, r, fill, stroke, lw) {
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1.5; ctx.stroke(); }
  }

  /* ----------------------------------------------------------------- E-Feldlinien */
  const ECACHE = new Map();
  /* Rechnet die Feldlinien (Weltmass: Hoehe der Leitungen h = 1, Masseflaeche y = 0, Stoerer bei (0,1), Opfer bei (aspect,1), Drahtradius 0,09).
   * Linienladungen: Stoerer +1, Spiegelbild -1; Opfer -k (influenzierte Ladung), Spiegelbild +k. k wird so gewaehlt, dass die Zahl der Linien,
   * die das Opfer erreichen, gleich round(n * ratio) ist (ratio = Cm/(Cm + Cg), Abweichung hoechstens 1 Linie).
   * Rueckgabe { n, hits, kappa, aspect, ratio, lines:[{pts:Float32Array, end:'opfer'|'masse'|'fern'}] }. Ergebnis wird gecacht. */
  const RW = 0.09;
  function traceE(kappa, aspect, n, keep) {
    const lines = []; let hits = 0;
    const qs = [[0, 1, 1], [0, -1, -1], [aspect, 1, -kappa], [aspect, -1, kappa]];
    const field = (x, y, out) => {
      let ex = 0, ey = 0;
      for (let i = 0; i < 4; i++) { const dx = x - qs[i][0], dy = y - qs[i][1], d2 = dx * dx + dy * dy + 1e-9; ex += qs[i][2] * dx / d2; ey += qs[i][2] * dy / d2; }
      const m = Math.hypot(ex, ey) || 1; out[0] = ex / m; out[1] = ey / m;
    };
    const e = [0, 0], em = [0, 0], ds = 0.035;
    for (let i = 0; i < n; i++) {
      const th = 2 * Math.PI * (i + 0.5) / n;
      let x = RW * Math.cos(th), y = 1 + RW * Math.sin(th), end = 'fern';
      const pts = keep ? [x, y] : null;
      for (let st = 0; st < 700; st++) {
        field(x, y, e);
        field(x + 0.5 * ds * e[0], y + 0.5 * ds * e[1], em);
        const nx = x + ds * em[0], ny = y + ds * em[1];
        const dv = Math.hypot(nx - aspect, ny - 1);
        if (dv <= RW) { x = aspect + (nx - aspect) * RW / (dv || 1); y = 1 + (ny - 1) * RW / (dv || 1); end = 'opfer'; if (keep) pts.push(x, y); break; }
        if (ny <= 0) { const u = y / (y - ny || 1); x = x + (nx - x) * u; y = 0; end = 'masse'; if (keep) pts.push(x, y); break; }
        x = nx; y = ny;
        if (keep && st % 3 === 0) pts.push(x, y);
        if (Math.abs(x) > 9 || y > 9) { if (keep) pts.push(x, y); break; }
      }
      if (end === 'opfer') hits++;
      if (keep) lines.push({ pts: Float32Array.from(pts), end });
    }
    return { hits, lines };
  }
  function fieldECompute(ratio, aspect, n) {
    ratio = cl(afin(ratio) ? ratio : 0, 0, 1); aspect = cl(afin(aspect) ? aspect : 2, 0.7, 6); n = Math.round(cl(afin(n) ? n : 24, 4, 24));
    const key = ratio.toFixed(3) + '|' + aspect.toFixed(2) + '|' + n;
    const hit = ECACHE.get(key);
    if (hit) return hit;
    STATS.fieldE++;
    const target = Math.round(n * ratio);
    let lo = 0, hi = 60, kBest = 0, hBest = traceE(0, aspect, n, false).hits;
    if (hBest >= target) kBest = 0;
    else {
      const hMax = traceE(hi, aspect, n, false).hits;
      if (hMax < target) kBest = hi;
      else {
        for (let it = 0; it < 18; it++) { const mid = (lo + hi) / 2; if (traceE(mid, aspect, n, false).hits >= target) hi = mid; else lo = mid; }
        const hl = traceE(lo, aspect, n, false).hits, hh = traceE(hi, aspect, n, false).hits;
        kBest = Math.abs(hl - target) < Math.abs(hh - target) ? lo : hi;
      }
    }
    const tr = traceE(kBest, aspect, n, true);
    const res = { n, hits: tr.hits, kappa: kBest, aspect, ratio, target, lines: tr.lines };
    if (ECACHE.size >= 8) ECACHE.delete(ECACHE.keys().next().value);
    ECACHE.set(key, res);
    return res;
  }
  function ratioOf(src) {
    src = obj(src);
    if (fin(src.ratio)) return cl(src.ratio, 0, 1);
    if (fin(src.cm) && fin(src.cg) && src.cm >= 0 && src.cg >= 0 && src.cm + src.cg > 0) return src.cm / (src.cm + src.cg);
    return NaN;
  }
  /* fieldE(ctx, rect, src, opts): Querschnitt zweier Leitungen ueber der Masseflaeche.
   *  src  = { ratio } oder { cm, cg } (ratio = Cm/(Cm+Cg)), optional s, h (Abstand, Hoehe, gleiche Einheit: Seitenverhaeltnis der Leitungen im Bild,
   *           begrenzt auf 0,7...6 hoch)
   *  opts = { lines (Anzahl, <= 24 und <= Stufe), phase (Zyklen, Dashfluss), amp (0..1 Staerke, z. B. |Is| normiert), quality, reduced, theme/palette,
   *           caption (false = ohne Text), victim: 'Opfer' }
   *  Rueckgabe: false oder { n, hits, ratio (hits/n), target (Cm/(Cm+Cg)), kappa } (truthy). Mindestgroesse 120 x 90. */
  function fieldE(ctx, rect, src, opts) {
    if (!okCtx(ctx) || !rectMin(rect, 120, 90)) return false;
    const ratio = ratioOf(src); if (!fin(ratio)) return false;
    src = obj(src); opts = obj(opts);
    const P = pal(opts), Q = qualityOf(opts);
    const aspect = fin(src.s) && fin(src.h) && src.s > 0 && src.h > 0 ? cl(src.s / src.h, 0.7, 6) : 2;
    const n = Math.round(cl(fin(opts.lines) ? opts.lines : 24, 4, Math.min(24, Q.fieldLines)));
    const res = fieldECompute(ratio, aspect, n);
    const cap = opts.caption !== false, two = rect.w < 460 && rect.h >= 150, capH = cap ? (two ? 34 : 18) : 4;
    const amp = nz(opts, 'amp', 1, 0, 1), phase = opts.reduced === true ? 0 : (afin(opts.phase) ? opts.phase : 0);
    return draw(ctx, () => {
      const X0 = -1.5, X1 = aspect + 1.5, Y0 = -0.35, Y1 = Math.max(2.3, aspect * 0.55 + 1.2);
      const T = fitWorld(rect, X0, X1, Y0, Y1, 6, 6, 4, capH);
      const px = T.px, py = T.py;
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      // Masseflaeche
      const gy = py(0);
      ctx.fillStyle = rgba(P.masse, 0.14); ctx.fillRect(rect.x, gy, rect.w, rect.y + rect.h - gy);
      hatch(ctx, rect.x, gy, rect.w, Math.min(10, rect.y + rect.h - gy), 6, rgba(P.masse, 0.55));
      ctx.strokeStyle = P.masse; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(rect.x, gy); ctx.lineTo(rect.x + rect.w, gy); ctx.stroke();
      // Feldlinien (violett, gestrichelt, Fluss zum Ziel)
      const dl = 12 * 1;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < res.lines.length; i++) {
          const L = res.lines[i]; if ((L.end === 'opfer') !== (pass === 1)) continue;
          const p = L.pts, q = [];
          for (let k = 0; k < p.length; k += 2) q.push([px(p[k]), py(p[k + 1])]);
          if (q.length < 2) continue;
          // eigener Teilpfad je Linie: smoothPath beginnt mit beginPath, daher je Linie stroken
        }
        for (let i = 0; i < res.lines.length; i++) {
          const L = res.lines[i]; if ((L.end === 'opfer') !== (pass === 1)) continue;
          const p = L.pts, q = [];
          for (let k = 0; k < p.length; k += 2) q.push([px(p[k]), py(p[k + 1])]);
          if (q.length < 2) continue;
          ctx.strokeStyle = pass === 1 ? mix(P.efeld, P.fg, 0.25) : P.efeld;
          ctx.globalAlpha = (pass === 1 ? 0.95 : 0.55) * (0.35 + 0.65 * amp);
          ctx.lineWidth = pass === 1 ? 2 : 1.3;
          setDash(ctx, [dl * 0.6, dl * 0.5], -phase * dl * 1.1 * 4);
          smoothPath(ctx, q, 14); ctx.stroke();
        }
      }
      setDash(ctx, NODASH, 0); ctx.globalAlpha = 1;
      // Leitungen
      const ax = px(0), ay = py(1), vx = px(aspect), vy = py(1), r = Math.max(5, RW * T.s * 1.25);
      dot(ctx, ax, ay, r, P.quelle, P.fg, 1.5); sym(ctx, 'plus', ax, ay, r * 1.3, P.bg, 1.6);
      dot(ctx, vx, vy, r, P.senke, P.fg, 1.5); sym(ctx, 'minus', vx, vy, r * 1.3, P.bg, 1.6);
      const fs = fsz(rect.w);
      lab(ctx, 'Störer', ax, ay - r - fs * 0.9, 'center', fs, P.quelle, rgba(P.bg, 0.8), true);
      lab(ctx, opts.victim && typeof opts.victim === 'string' ? opts.victim : 'Opfer', vx, vy - r - fs * 0.9, 'center', fs, P.senke, rgba(P.bg, 0.8), true);
      lab(ctx, 'Masse', rect.x + 8, gy + fs, 'left', fs, P.masse, rgba(P.bg, 0.8), true);
      if (afin(opts.phase) && opts.reduced !== true && opts.slow !== false) lab(ctx, 'Animation verlangsamt', rect.x + rect.w - 6, rect.y + fs * 1.1, 'right', fs, P.mute, rgba(P.bg, 0.8), false, rect.w * 0.6);
      ctx.restore();
      if (cap) {
        const pct = Math.round(res.hits / res.n * 1000) / 10, tp = Math.round(res.ratio * 1000) / 10;
        const l1 = res.hits + ' von ' + res.n + ' Linien erreichen das Opfer', l2 = 'Cm/(Cm+Cg) = ' + fzt(tp, 1) + ' %' + (two ? '' : '  ·  gezeichnet ' + fzt(pct, 1) + ' %');
        const by = rect.y + rect.h - capH;
        if (two) { lab(ctx, l1, rect.x + rect.w / 2, by + 9, 'center', fs, P.efeld, null, true, rect.w - 8); lab(ctx, l2, rect.x + rect.w / 2, by + 25, 'center', fs, P.fg, null, false, rect.w - 8); }
        else lab(ctx, l1 + '  ·  ' + l2, rect.x + rect.w / 2, by + 9, 'center', fs, P.fg, null, false, rect.w - 8);
      }
      return { n: res.n, hits: res.hits, ratio: res.hits / res.n, target: res.ratio, kappa: res.kappa };
    });
  }

  /* ----------------------------------------------------------------- H-Feldlinien */
  const HCACHE = new Map();
  /* Kreise um einen Draht ueber der Masseflaeche (Spiegelstrom -I bei y = -y0): die Linien gleichen Flusses sind die Apollonius-Kreise
   * psi = ln(rho'/rho) = const (exakt). Linie j hat psi_j = psiS * (j + 0,5)/n, Dichte also ~ 1/rho. Linien mit psi_j < psi(Opfer) laufen
   * durch die Opferschleife (Opfer-Draht bis Masse); ihre Zahl ist round(n * ratio) mit ratio = psi(Opfer)/psiS = M/Ls.
   * Die Drahtflaeche psiS wird aus ratio gerechnet (symbolischer Drahtradius), so stimmt der Massstab immer. */
  function hCircles(ax, ay, vx, vy, ratio, n) {
    const key = [ax, ay, vx, vy, ratio, n].map(v => (Math.round(v * 1000) / 1000)).join('|');
    const hit = HCACHE.get(key); if (hit) return hit;
    STATS.fieldH++;
    const d2 = (vx - ax) * (vx - ax), psiV = 0.5 * Math.log((d2 + (vy + ay) * (vy + ay)) / Math.max(1e-9, d2 + (vy - ay) * (vy - ay)));
    let psiS = fin(ratio) && ratio > 0 && ratio <= 1 && psiV > 0 ? psiV / ratio : Math.log(2 / 0.08);
    if (!(psiS > 0.01)) psiS = Math.log(2 / 0.08);
    const lines = []; let through = 0;
    for (let j = 0; j < n; j++) {
      const c = psiS * (j + 0.5) / n, K = Math.exp(c), den = K * K - 1;
      if (!(den > 1e-6)) continue;
      const cy = ay * (K * K + 1) / den, rad = 2 * ay * K / den, thru = c < psiV;
      if (thru) through++;
      lines.push({ cx: ax, cy, r: rad, thru, c });
    }
    const res = { lines, n, through, psiV, psiS, rWire: 2 * ay / Math.exp(psiS) };
    if (HCACHE.size >= 8) HCACHE.delete(HCACHE.keys().next().value);
    HCACHE.set(key, res);
    return res;
  }
  /* fieldH(ctx, rect, wires, opts): Querschnitt, wires = [{ x, y, i }] (Modelleinheit, y = Hoehe ueber der Masseflaeche, i = Strom mit Vorzeichen,
   *  i > 0 aus der Zeichenebene heraus ⊙, i < 0 hinein ⊗). Der Draht mit dem groessten |i| ist der Stoerer (Kreise exakt, mit Spiegelstrom).
   *  opts = { victim: {x, y} (Opferleitung; die Schleife ist die Strecke Opfer-Masse), ratio (M/Ls), lines (<= 24), phase, amp, quality, reduced,
   *           theme/palette, caption }
   *  Rueckgabe: false oder { n, through (Linien durch die Opferschleife), ratio (through/n), target (M/Ls) }. Mindestgroesse 120 x 90. */
  function fieldH(ctx, rect, wires, opts) {
    if (!okCtx(ctx) || !rectMin(rect, 120, 90) || !Array.isArray(wires) || !wires.length || wires.length > 8) return false;
    opts = obj(opts);
    const W = [];
    for (let k = 0; k < wires.length; k++) { const w = obj(wires[k]); if (!fin(w.x) || !fin(w.y) || !(w.y > 0) || !fin(w.i)) return false; if (w.i !== 0) W.push({ x: w.x, y: w.y, i: w.i }); }
    if (!W.length) return false;
    const vic = obj(opts.victim);
    if (!fin(vic.x) || !fin(vic.y) || !(vic.y > 0)) return false;
    const target = fin(opts.ratio) ? cl(opts.ratio, 0, 1) : NaN;
    const P = pal(opts), Q = qualityOf(opts);
    const n = Math.round(cl(fin(opts.lines) ? opts.lines : 24, 4, Math.min(24, Q.fieldLines)));
    let main = W[0]; W.forEach(w => { if (Math.abs(w.i) > Math.abs(main.i)) main = w; });
    const res = hCircles(main.x, main.y, vic.x, vic.y, target, n);
    const amp = nz(opts, 'amp', 1, 0, 1), phase = opts.reduced === true ? 0 : (afin(opts.phase) ? opts.phase : 0);
    const cap = opts.caption !== false, two = rect.w < 460 && rect.h >= 150, capH = cap ? (two ? 34 : 18) : 4, fs = fsz(rect.w);
    return draw(ctx, () => {
      let x0 = Infinity, x1 = -Infinity, y1 = 0;
      W.concat([vic]).forEach(w => { x0 = Math.min(x0, w.x); x1 = Math.max(x1, w.x); y1 = Math.max(y1, w.y); });
      const span = Math.max(x1 - x0, y1 * 1.4, 1e-6), padW = span * 0.9;
      const T = fitWorld(rect, x0 - padW, x1 + padW, -0.4 * y1, y1 * 2.6, 6, 6, 4, capH);
      const px = T.px, py = T.py;
      ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, rect.w, rect.h); ctx.clip();
      const gy = py(0);
      ctx.fillStyle = rgba(P.masse, 0.14); ctx.fillRect(rect.x, gy, rect.w, rect.y + rect.h - gy);
      hatch(ctx, rect.x, gy, rect.w, Math.min(10, rect.y + rect.h - gy), 6, rgba(P.masse, 0.55));
      ctx.strokeStyle = P.masse; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(rect.x, gy); ctx.lineTo(rect.x + rect.w, gy); ctx.stroke();
      // Kreise (Linien durch die Opferschleife hell und dick)
      const dir = main.i > 0 ? 1 : -1, dl = 12;
      for (let pass = 0; pass < 2; pass++) {
        for (let j = 0; j < res.lines.length; j++) {
          const L = res.lines[j]; if (L.thru !== (pass === 1)) continue;
          const cx = px(L.cx), cy = py(L.cy), r = L.r * T.s;
          if (!(r > 1) || r > 1e5) continue;
          ctx.strokeStyle = pass === 1 ? mix(P.hfeld, P.fg, 0.2) : P.hfeld;
          ctx.globalAlpha = (pass === 1 ? 0.95 : 0.5) * (0.35 + 0.65 * amp);
          ctx.lineWidth = pass === 1 ? 2.1 : 1.3;
          setDash(ctx, [dl * 0.7, dl * 0.5], dir * -phase * dl * 4);
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
        }
      }
      setDash(ctx, NODASH, 0); ctx.globalAlpha = 1;
      // Richtungspfeile auf je einem Kreis (Rechte-Hand-Regel: i > 0 -> gegen den Uhrzeigersinn)
      ctx.fillStyle = P.hfeld;
      for (let j = 0; j < res.lines.length; j += 4) {
        const L = res.lines[j], cx = px(L.cx), cy = py(L.cy), r = L.r * T.s; if (!(r > 6) || r > 1e5) continue;
        const X = cx, Y = cy - r, ux = dir > 0 ? -1 : 1, h = 6;     /* oberster Punkt: i > 0 (gegen den Uhrzeigersinn) zeigt dort nach links */
        poly(ctx, [[X + ux * h, Y], [X - ux * h * 0.2, Y - 3.2], [X - ux * h * 0.2, Y + 3.2]], true); ctx.fill();
      }
      // Spiegelstrom (gestrichelt, unter der Flaeche) und Drahtsymbole
      W.forEach(w => {
        const X = px(w.x), Y = py(w.y), Yi = py(-w.y), r = Math.max(6, Math.min(11, T.s * span * 0.04));
        ctx.globalAlpha = 0.55; setDash(ctx, [3, 3]);
        sym(ctx, w.i > 0 ? 'dotin' : 'dotout', X, Yi, r * 1.25, P.hfeld, 1.4); setDash(ctx, NODASH); ctx.globalAlpha = 1;
        if (w === main) { const rd = cl(res.rWire * T.s, r * 0.95, 34); dot(ctx, X, Y, rd, rgba(P.quelle, 0.2), rgba(P.quelle, 0.9), 1.6); } else dot(ctx, X, Y, r * 0.95, P.bg, null);
        sym(ctx, w.i > 0 ? 'dotout' : 'dotin', X, Y, r * 1.4, w === main ? P.quelle : P.hfeld, 1.8);
      });
      // Opferschleife: Opferdraht bis Masse
      const vX = px(vic.x), vY = py(vic.y), r = Math.max(5, Math.min(9, T.s * span * 0.03));
      ctx.strokeStyle = P.senke; ctx.lineWidth = 2.2; setDash(ctx, [5, 4]); ctx.beginPath(); ctx.moveTo(vX, vY + r); ctx.lineTo(vX, gy); ctx.stroke(); setDash(ctx, NODASH);
      dot(ctx, vX, vY, r, P.senke, P.fg, 1.4);
      lab(ctx, 'Opferschleife', vX + r + 4, (vY + gy) / 2, 'left', fs, P.senke, rgba(P.bg, 0.8), true, Math.max(60, rect.x + rect.w - vX - r - 8));
      lab(ctx, 'Störer', px(main.x), py(main.y) - 16, 'center', fs, P.quelle, rgba(P.bg, 0.8), true);
      if (afin(opts.phase) && opts.reduced !== true && opts.slow !== false) lab(ctx, 'Animation verlangsamt', rect.x + rect.w - 6, rect.y + fs * 1.1, 'right', fs, P.mute, rgba(P.bg, 0.8), false, rect.w * 0.6);
      ctx.restore();
      if (cap) {
        const tp = Math.round(res.through / res.n * 1000) / 10;
        const l1 = res.through + ' von ' + res.n + ' Linien durch die Opferschleife', l2 = fin(target) ? 'M/Ls = ' + fzt(Math.round(target * 1000) / 10, 1) + ' %' : 'gezeichnet ' + fzt(tp, 1) + ' %';
        const by = rect.y + rect.h - capH;
        if (two) { lab(ctx, l1, rect.x + rect.w / 2, by + 9, 'center', fs, P.hfeld, null, true, rect.w - 8); lab(ctx, l2, rect.x + rect.w / 2, by + 25, 'center', fs, P.fg, null, false, rect.w - 8); }
        else lab(ctx, l1 + '  ·  ' + l2, rect.x + rect.w / 2, by + 9, 'center', fs, P.fg, null, false, rect.w - 8);
      }
      return { n: res.n, through: res.through, ratio: res.through / res.n, target: fin(target) ? target : res.through / res.n };
    });
  }

  /* ----------------------------------------------------------------- Wellenringe */
  /* Ringabstand in Pixeln aus der Wellenlaenge (logarithmisch skaliert, sonst unsichtbar): 0,3 m (1 GHz) ~ 10 px ... >= 1 km ~ 60 px (SPEC 6.2) */
  function waveSpacing(lambdaM) {
    if (!(afin(lambdaM) && lambdaM > 0)) return NaN;
    return cl(10 + 12 * (Math.log10(lambdaM) + 0.5), 10, 60);
  }
  /* Helligkeit 0,12...1 aus der Marge (dB, positiv = unter der Grenzlinie): je weiter ueber der Grenzlinie, desto heller */
  function waveBrightness(marginDb) {
    if (!afin(marginDb)) return 0.5;
    return cl(0.5 - marginDb / 40, 0.12, 1);
  }
  const fLen = m => (!fin(m) ? '–' : m >= 1 ? fzt(m, m >= 100 ? 0 : m >= 10 ? 1 : 2) + ' m' : m >= 0.01 ? fzt(m * 100, 1) + ' cm' : fzt(m * 1000, 1) + ' mm');
  /* waves(ctx, x, y, o): Wellenringe um ein Geraet bei (x, y).
   *  o = { t (ms), lambda (m), margin (dB zur Grenzlinie, >= 0 gruen, < 0 rot), rings (<= 8), maxR (px), speed (Ringabstaende je s, Vorgabe 0,35),
   *        quarter (true: lambda/4-Marke), labels (false: ohne Zahlen), quality, reduced, theme/palette }
   *  Die Ringe sind Symbolik (keine Strahlungskeule): Rueckgabe false oder { spacing, rings, brightness, color }. */
  function waves(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), Q = qualityOf(o);
    const lambda = fin(o.lambda) && o.lambda > 0 ? o.lambda : NaN;
    if (!(lambda > 0) && o.lambda !== undefined) return false;
    const L = lambda > 0 ? lambda : 3, sp = waveSpacing(L);
    const margin = fin(o.margin) ? o.margin : NaN, bright = waveBrightness(margin);
    const col = !(margin === margin) ? P.senke : margin < 0 ? P.rot : P.gruen;
    const maxR = nz(o, 'maxR', 150, 30, 2000), nRing = Math.max(1, Math.min(8, Math.round(nz(o, 'rings', 8, 1, 8)), Math.floor(maxR / sp)));
    const t = afin(o.t) ? o.t : 0, speed = nz(o, 'speed', 0.35, 0, 3);
    const ph = o.reduced === true ? 0.4 : (t / 1000 * speed) % 1;
    return draw(ctx, () => {
      ctx.lineCap = 'round';
      if (Q.glow) ctx.globalCompositeOperation = 'lighter';
      for (let j = 0; j < nRing; j++) {
        const r = (j + ph) * sp; if (!(r > 1)) continue;
        const fade = (1 - (j + ph) / nRing) * Math.min(1, (j + ph) * 1.6);
        ctx.strokeStyle = col; ctx.globalAlpha = cl(bright * fade, 0, 1) * (Q.glow ? 0.9 : 1);
        ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
        if (Q.shadow) { ctx.lineWidth = 6; ctx.globalAlpha = cl(bright * fade, 0, 1) * 0.18; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke(); }
      }
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
      dot(ctx, x, y, 6, col, P.fg, 1.5);
      const fs = nz(o, 'fs', 12, 11, 24);
      if (o.quarter === true) {
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sp / 4, y); ctx.stroke(); setDash(ctx, NODASH);
        ctx.beginPath(); ctx.moveTo(x + sp / 4, y - 4); ctx.lineTo(x + sp / 4, y + 4); ctx.stroke();
        lab(ctx, 'λ/4', x + sp / 8, y - fs - 4, 'center', fs, P.fg, rgba(P.bg, 0.8), true);
      }
      if (o.labels !== false && nRing >= 2) {
        const yy = y + Math.min(maxR, (nRing + 0.2) * sp) * 0.72 + fs * 0.4;
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x + sp, y - 2); ctx.lineTo(x + 2 * sp, y - 2); ctx.moveTo(x + sp, y - 6); ctx.lineTo(x + sp, y + 2); ctx.moveTo(x + 2 * sp, y - 6); ctx.lineTo(x + 2 * sp, y + 2); ctx.stroke();
        lab(ctx, 'λ = ' + fLen(L), x + 1.5 * sp, y + fs + 4, 'center', fs, P.fg, rgba(P.bg, 0.8), true);
        lab(ctx, 'Symbolik', x + 1.5 * sp, y + fs * 2.9 + 6, 'center', fs, P.mute, rgba(P.bg, 0.8), false);
        void yy;
      }
    }) && { spacing: sp, rings: nRing, brightness: bright, color: col };
  }

  /* ----------------------------------------------------------------- Partikelsystem (Pool fester Groesse) */
  /* createParticles(paths, opts) -> { step(dtMs), draw(ctx, o), setRate(pfad, r), setPaths(paths), count(), speedOf(pfad), pool, quality, reduced }
   *  paths = [{ id?, pts:[[x,y]...] (Polylinie), color?, rate 0..1 (Strom normiert), dir 1|-1, size (px), label? }]
   *  opts  = { quality ('hoch' 600 | 'mittel' 300 | 'niedrig' 120 Teilchen), reduced (statische Pfeile, keine Bewegung), seed, speed (px/s bei rate 1) }
   *  Geschwindigkeit = speed * rate, Dichte = rate * Grundichte (Teilchen je Pixel), Richtung: Farbe (Hin warm, Rueck gruencyan) und kleine Pfeile.
   *  Der Pool (Float32Array) wird einmal angelegt; step und draw erzeugen keine Objekte je Teilchen. */
  function createParticles(paths, opts) {
    opts = obj(opts);
    const Q = qualityOf(opts), cap = Math.max(8, Math.min(Q.particles, fin(opts.max) ? Math.floor(opts.max) : Q.particles));
    const rnd = rng(opts.seed), vmax = nz(opts, 'speed', 120, 1, 2000);
    const pos = new Float32Array(cap), spd = new Float32Array(cap);
    for (let i = 0; i < cap; i++) { pos[i] = rnd(); spd[i] = 0.9 + 0.2 * rnd(); }
    let P = [], reduced = opts.reduced === true;
    const pl = pal(opts);
    function prep(list) {
      P = []; if (!Array.isArray(list)) return;
      for (let k = 0; k < list.length && k < 32; k++) {
        const p = obj(list[k]), pts = normPts(p.pts); if (!pts) continue;
        const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const len = cum[cum.length - 1]; if (!(len > 0)) continue;
        const dir = p.dir === -1 ? -1 : 1;
        P.push({ id: typeof p.id === 'string' ? p.id : String(P.length), pts, cum, len, dir, a: 0, n: 0, rate: nz(p, 'rate', 0, 0, 1), size: nz(p, 'size', 3, 1, 12),
          color: goodColor(p.color) ? p.color : (dir > 0 ? pl.quelle : pl.masse) });
      }
      const tot = P.reduce((s, q) => s + q.len, 0) || 1, rho = Math.min(cap / tot, 0.2);
      let used = 0;
      P.forEach(q => { q.n = Math.max(2, Math.floor(q.len * rho)); if (used + q.n > cap) q.n = Math.max(0, cap - used); q.a = used; used += q.n; });
    }
    prep(paths);
    const find = ref => (typeof ref === 'number' ? P[ref] : P.find(q => q.id === ref));
    const act = q => (q.rate > 0 ? Math.min(q.n, Math.ceil(q.n * q.rate - 1e-9)) : 0);
    const tmp = [0, 0, 0];
    function locate(q, s, out) {
      const d = s * q.len; let i = 1;
      while (i < q.cum.length - 1 && q.cum[i] < d) i++;
      const a = q.pts[i - 1], b = q.pts[i], seg = (q.cum[i] - q.cum[i - 1]) || 1, u = cl((d - q.cum[i - 1]) / seg, 0, 1);
      out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const sys = {
      pool: cap, quality: Q.name,
      get reduced() { return reduced; },
      setReduced(f) { reduced = !!f; },
      setRate(ref, r) { const q = find(ref); if (!q || !afin(r)) return false; q.rate = cl(r, 0, 1); return true; },
      setPaths(list) { prep(list); },
      count() { let c = 0; P.forEach(q => { c += act(q); }); return c; },
      speedOf(ref) { const q = find(ref); return q ? vmax * q.rate : NaN; },
      step(dtMs) {
        if (!afin(dtMs) || reduced) return;
        const dt = cl(dtMs, 0, 100) / 1000;
        P.forEach(q => {
          const na = act(q); if (!na) return;
          const v = vmax * q.rate * dt / q.len * q.dir;
          for (let j = 0; j < na; j++) { const k = q.a + j; let s = pos[k] + v * spd[k]; s -= Math.floor(s); pos[k] = s; }
        });
      },
      /* Lage der Teilchen eines Pfades (Test und Rigs): [[x, y], ...] der aktiven Teilchen */
      positions(ref) { const q = find(ref), out = []; if (!q) return out; for (let j = 0; j < act(q); j++) { locate(q, pos[q.a + j], tmp); out.push([tmp[0], tmp[1]]); } return out; },
      draw(ctx, o) {
        if (!okCtx(ctx)) return false;
        o = obj(o);
        return draw(ctx, () => {
          const glow = Q.glow && !reduced && o.glow !== false;
          P.forEach(q => {
            // Richtungspfeile (statisch, auch bei reduzierter Bewegung): Richtung zusaetzlich zur Farbe
            ctx.fillStyle = q.color; ctx.globalAlpha = q.rate > 0 ? 0.95 : 0.35;
            const na = Math.max(1, Math.min(3, Math.floor(q.len / 90)));
            for (let k = 1; k <= na; k++) {
              locate(q, k / (na + 1), tmp);
              const ang = tmp[2] + (q.dir === -1 ? Math.PI : 0), hs = 5 + q.size;
              poly(ctx, [[tmp[0] + hs * Math.cos(ang), tmp[1] + hs * Math.sin(ang)], [tmp[0] + hs * Math.cos(ang + 2.45), tmp[1] + hs * Math.sin(ang + 2.45)],
                [tmp[0] + hs * Math.cos(ang - 2.45), tmp[1] + hs * Math.sin(ang - 2.45)]], true); ctx.fill();
            }
            ctx.globalAlpha = 1;
            if (reduced) return;
            const na2 = act(q); if (!na2) return;
            if (glow) ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = q.color; ctx.globalAlpha = glow ? 0.85 : 1;
            ctx.beginPath();
            for (let j = 0; j < na2; j++) { locate(q, pos[q.a + j], tmp); ctx.rect(tmp[0] - q.size / 2, tmp[1] - q.size / 2, q.size, q.size); }
            ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
          });
        });
      }
    };
    return sys;
  }

  /* =================================================================================================================
   *  C. Diagramme: Spektrum-Balken, Kurven, Zeitverlaeufe, Waermebild; Ampel, Wischer, Wirkungskette
   * ================================================================================================================= */
  const LEVERS = {
    quelle: { key: 'quelle', name: 'Quelle entschärfen', short: 'Quelle' },
    pfad: { key: 'pfad', name: 'Kopplung verringern', short: 'Pfad' },
    senke: { key: 'senke', name: 'Senke härten', short: 'Senke' }
  };
  const AMPEL = {
    gruen: { id: 'gruen', name: 'grün', sym: 'check', text: 'grün' },
    gelb: { id: 'gelb', name: 'gelb', sym: 'warn', text: 'gelb' },
    rot: { id: 'rot', name: 'rot', sym: 'cross', text: 'rot' },
    grau: { id: 'grau', name: 'grau', sym: 'dash', text: 'noch nicht geprüft' }
  };
  function ampelKey(a) {
    if (a && typeof a === 'object') a = a.ampel;
    a = typeof a === 'string' ? a.toLowerCase().replace('ü', 'ue') : '';
    return a === 'gruen' || a === 'gelb' || a === 'rot' || a === 'grau' ? a : null;
  }
  /* Text fuer aria-label des Hauptbildes (SPEC Zusatz i): "Ampel grün, Marge +8,2 dB" */
  function ampelText(state, margin) {
    const k = ampelKey(state); if (!k) return '';
    const m = fin(margin) ? margin : (state && typeof state === 'object' && fin(state.margin) ? state.margin : NaN);
    return 'Ampel ' + AMPEL[k].name + (k === 'grau' ? ': noch nicht geprüft' : '') + (fin(m) ? ', Marge ' + (m > 0 ? '+' : '') + fz(m, 1) + ' dB' : '');
  }

  /* Rahmen eines Diagramms: Plattenhintergrund, Plotbereich, Rand; liefert die Plotflaeche */
  function chartPlot(rect, o, extraR) {
    const small = rect.w < 420, ml = small ? 38 : 44, mr = (extraR || 0) + 10, mt = 22, mb = small ? 34 : 38;
    return { x: rect.x + ml, y: rect.y + mt, w: rect.w - ml - mr, h: rect.h - mt - mb };
  }
  function drawPlotBg(ctx, P, rect, plot) {
    ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = P.panel; ctx.fillRect(plot.x, plot.y, plot.w, plot.h);
  }
  function drawPlotFrame(ctx, P, plot) {
    ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; setDash(ctx, NODASH); ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);
  }
  /* Frequenzanzeige-Einheit der Achse: { unit:'MHz', div:1e6 } nach dem oberen Ende */
  function freqAxisUnit(hi) { return hi >= 1e6 ? { unit: 'MHz', div: 1e6 } : hi >= 1e3 ? { unit: 'kHz', div: 1e3 } : { unit: 'Hz', div: 1 }; }
  function fTickText(f, au) { const v = f / au.div; return fzt(v, v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : 3); }
  /* Legende rechts oben im Kopfstreifen: items = [{ text, color, dash, kind:'line'|'box' }], was nicht passt, entfaellt */
  function drawLegend(ctx, P, items, xRight, yMid, xLeftMin, fs) {
    let x = xRight;
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i]; font(ctx, fs, false);
      const w = tw(ctx, it.text, fs, false) + 26;
      if (x - w < xLeftMin) break;
      x -= w;
      ctx.strokeStyle = it.color; ctx.fillStyle = it.color; ctx.lineWidth = 2;
      if (it.kind === 'box') { ctx.globalAlpha = it.alpha || 1; ctx.fillRect(x, yMid - 4, 14, 8); ctx.globalAlpha = 1; }
      else { setDash(ctx, it.dash || NODASH); ctx.beginPath(); ctx.moveTo(x, yMid); ctx.lineTo(x + 14, yMid); ctx.stroke(); setDash(ctx, NODASH); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.fg; ctx.fillText(it.text, x + 18, yMid);
      x -= 6;
    }
  }
  const SDASH = [null, [7, 4], [2, 4], [10, 3, 2, 3]];

  /* ----------------------------------------------------------------- Spektrum-Balken */
  /* limitAt(pts, f): Grenzwert der Stufenlinie pts = [[f, L]...] (aufsteigend nach f) bei f, logarithmisch interpoliert; gleiche f = Sprung
   * (rechtsstetig). Ausserhalb des Frequenzbereichs der Linie: NaN (kein Grenzwert, nie "bestanden"). */
  function limitAt(pts, f) {
    if (!Array.isArray(pts) || pts.length < 2 || !(f > 0)) return NaN;
    const n = pts.length;
    if (!(f >= pts[0][0] * 0.99999) || !(f <= pts[n - 1][0] * 1.00001)) return NaN;
    let r = NaN;
    for (let i = 0; i < n - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (b[0] === a[0]) { if (f >= a[0]) r = b[1]; continue; }
      if (f >= a[0] && f <= b[0]) { r = a[1] + (b[1] - a[1]) * Math.log(f / a[0]) / Math.log(b[0] / a[0]); if (f === b[0]) { /* Sprungstelle folgt */ } }
    }
    return r;
  }
  function cleanLimit(l) {
    const o = obj(l); const pts = normPts(o.pts, 2, dfin);
    if (!pts) return null;
    for (let i = 0; i < pts.length; i++) { if (!(pts[i][0] > 0)) return null; if (i && pts[i][0] < pts[i - 1][0]) return null; }
    return { id: typeof o.id === 'string' ? o.id : 'g' + 0, name: typeof o.name === 'string' ? o.name : '', pts };
  }
  /* Zustand der Animation (Tween der Balken in 300 ms, Spitzenwert-Halten faellt mit 6 dB/s) */
  function spectrumState() { return { sig: '', n: 0, from: null, to: null, cur: null, peak: null, t0: 0, lastT: NaN, cols: null, colKey: '', frame: 0 }; }
  const TWEEN_MS = 300, PEAK_DB_S = 6;
  function specInput(lines, opts) {
    let spec = null;
    if (lines && !Array.isArray(lines) && typeof lines === 'object') { spec = lines; lines = spec.lines; }
    if (!Array.isArray(lines)) return null;
    const f = [], L = [];
    for (let i = 0; i < lines.length && f.length < 3000; i++) {
      const q = lines[i];
      if (q && typeof q === 'object' && dfin(q.f) && q.f > 0 && dfin(q.L)) { f.push(q.f); L.push(q.L); }
    }
    return { spec: spec || {}, f, L, lines };
  }
  /* spectrumBars(ctx, rect, lines, opts): Analysator-Balkenbild.
   *  lines = [{ f (Hz), L }] oder das Objekt von rig.spectrum() ({ unit, fMin, fMax, lines, env, limits, floor })
   *  opts  = { unit, fMin, fMax, yMin, yMax, env:[[f,L]], limits:[{id,name,pts}], limitId, floor (Eigenrauschen), seed,
   *            marker (Hz | { f } | 'peak' | false; Vorgabe 'peak'), ghost (Linien des gemerkten Zustands), ghostAlpha (0..1, Vorgabe 1),
   *            anim (spectrumState(), fuer Tween und Spitzenwert-Halten), t (ms), reduced, quality, theme/palette, title }
   *  Balkenfarbe nach Marge zur Grenzlinie (>= 6 dB gruen, 0...6 gelb, < 0 rot mit Schraffur); Frequenz ohne Grenzlinie: neutral.
   *  Rueckgabe false oder { plot, xAt(f), yAt(L), fAt(px), peak:{f, L, margin}, marker:{f, L, margin}|null, bars, reds } (Mindestgroesse 200 x 120). */
  function spectrumBars(ctx, rect, lines, opts) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 120)) return false;
    opts = obj(opts);
    const inp = specInput(lines, opts); if (!inp || !inp.f.length) return false;
    const sp = inp.spec, P = pal(opts), n = inp.f.length;
    const unit = typeof opts.unit === 'string' ? opts.unit : typeof sp.unit === 'string' ? sp.unit : 'dBµV';
    const limsRaw = Array.isArray(opts.limits) ? opts.limits : Array.isArray(sp.limits) ? sp.limits : [];
    const lims = limsRaw.map(cleanLimit).filter(Boolean);
    const envPts = normPts(opts.env || sp.env, 2, dfin);
    const floorL = fin(opts.floor) ? opts.floor : fin(sp.floor) ? sp.floor : NaN;
    let fMin = dfin(opts.fMin) && opts.fMin > 0 ? opts.fMin : dfin(sp.fMin) && sp.fMin > 0 ? sp.fMin : Math.min.apply(null, inp.f) / 1.4;
    let fMax = dfin(opts.fMax) && opts.fMax > 0 ? opts.fMax : dfin(sp.fMax) && sp.fMax > 0 ? sp.fMax : Math.max.apply(null, inp.f) * 1.4;
    if (!(fMax > fMin * 1.01)) { fMin = fMin / 2; fMax = fMax * 2; }
    let maxL = -Infinity; inp.L.forEach(v => { if (v > maxL) maxL = v; });
    lims.forEach(l => l.pts.forEach(p => { if (p[1] > maxL) maxL = p[1]; }));
    const ghostIn = opts.ghost ? specInput(opts.ghost, opts) : null;
    if (ghostIn) ghostIn.L.forEach(v => { if (v > maxL) maxL = v; });
    const yMax = fin(opts.yMax) ? opts.yMax : Math.ceil((maxL + 6) / 10) * 10;
    let minL = Infinity; inp.L.forEach(v => { if (v < minL) minL = v; });
    const yMin = fin(opts.yMin) && opts.yMin < yMax ? opts.yMin : Math.max(-60, yMax - 130, Math.floor((Math.min(0, minL, fin(floorL) ? floorL : 0) - 5) / 10) * 10);
    const t = afin(opts.t) ? opts.t : NaN, reduced = opts.reduced === true;
    const fs = fsz(rect.w), plot = chartPlot(rect, opts), lx0 = Math.log(fMin), lxs = plot.w / (Math.log(fMax) - lx0);
    const xAt = f => plot.x + (Math.log(f) - lx0) * lxs, yAt = L => plot.y + plot.h * (1 - (L - yMin) / (yMax - yMin));
    const fAt = x => Math.exp(lx0 + (x - plot.x) / lxs);
    const limFor = f => { let best = NaN; lims.forEach(l => { const v = limitAt(l.pts, f); if (v === v && (best !== best || v < best)) best = v; }); return best; };
    // Animationszustand
    const st = opts.anim && typeof opts.anim === 'object' && 'cur' in opts.anim ? opts.anim : null;
    let sig = n + ':' + Math.round(inp.f[0]) + ':' + Math.round(inp.f[n - 1]) + ':' + Math.round(inp.f.reduce((s, v, i) => s + v * ((i % 7) + 1), 0) % 1e9);
    let cur = Float64Array.from(inp.L), peakA = cur;
    if (st) {
      if (st.sig !== sig || !st.cur || st.cur.length !== n) { st.sig = sig; st.n = n; st.to = Float64Array.from(inp.L); st.cur = Float64Array.from(inp.L); st.from = Float64Array.from(inp.L); st.peak = Float64Array.from(inp.L); st.t0 = afin(t) ? t : 0; st.lastT = NaN; st.cols = null; }
      else {
        let ch = false; for (let i = 0; i < n; i++) if (Math.abs(st.to[i] - inp.L[i]) > 1e-4) { ch = true; break; }
        if (ch) { st.from.set(st.cur); st.to = Float64Array.from(inp.L); st.t0 = afin(t) ? t : 0; }
      }
      const frac = reduced || !afin(t) ? 1 : cl((t - st.t0) / TWEEN_MS, 0, 1), e = 1 - Math.pow(1 - frac, 3);
      for (let i = 0; i < n; i++) st.cur[i] = st.from[i] + (st.to[i] - st.from[i]) * e;
      const dt = afin(t) && afin(st.lastT) ? cl((t - st.lastT) / 1000, 0, 30) : 0;
      for (let i = 0; i < n; i++) { const pv = st.peak[i] - PEAK_DB_S * dt; st.peak[i] = pv > st.cur[i] ? pv : st.cur[i]; }
      if (afin(t)) st.lastT = t;
      cur = st.cur; peakA = st.peak;
    }
    // Spalten (Balken je 3 bis 7 px, je Spalte der groesste Pegel)
    const cw = n > 60 ? cl(plot.w / 200, 3, 7) : cl(plot.w / Math.max(16, n * 2.2), 3, 9), nc = Math.max(1, Math.floor(plot.w / cw));
    const colOf = f => cl(Math.floor((Math.log(f) - lx0) * lxs / cw), 0, nc - 1);
    const colLevel = new Float32Array(nc).fill(-1e9), colPeak = new Float32Array(nc).fill(-1e9), colF = new Float32Array(nc);
    for (let i = 0; i < n; i++) {
      const c = colOf(inp.f[i]);
      if (cur[i] > colLevel[c]) { colLevel[c] = cur[i]; colF[c] = inp.f[i]; }
      if (peakA[i] > colPeak[c]) colPeak[c] = peakA[i];
    }
    let pk = { f: NaN, L: -1e9, margin: NaN };
    for (let i = 0; i < n; i++) if (cur[i] > pk.L) { pk = { f: inp.f[i], L: cur[i], margin: NaN }; }
    { const lv = limFor(pk.f); if (lv === lv) pk.margin = lv - pk.L; }
    let bars = 0, reds = 0, markerOut = null;
    return draw(ctx, () => {
      drawPlotBg(ctx, P, rect, plot);
      const au = freqAxisUnit(fMax);
      // Raster und Achsen
      const yt = ticks(yMin, yMax, Math.max(3, Math.floor(plot.h / 34))), xt = logTicks(fMin, fMax, Math.max(2, Math.floor(plot.w / 54)));
      ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.beginPath();
      yt.t.forEach(v => { const y = yAt(v); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); });
      xt.forEach(f => { const x = xAt(f); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y + plot.h); });
      ctx.stroke();
      // Eigenrauschen als Teppich
      if (fin(floorL) && floorL > yMin) {
        const rnd = rng(fin(opts.seed) ? opts.seed : 1), step = 5, yb = plot.y + plot.h;
        ctx.beginPath(); ctx.moveTo(plot.x, yb);
        for (let x = 0; x <= plot.w + 0.01; x += step) ctx.lineTo(plot.x + Math.min(x, plot.w), cl(yAt(floorL + (rnd() - 0.5) * 2.4), plot.y, yb));
        ctx.lineTo(plot.x + plot.w, yb); ctx.closePath();
        ctx.fillStyle = rgba(P.mute, 0.26); ctx.fill();
        lab(ctx, 'Eigenrauschen ' + fz(floorL, 0) + ' ' + unit, plot.x + 6, Math.min(yb - fs * 0.9, yAt(floorL) - fs * 0.9), 'left', fs, P.mute, rgba(P.panel, 0.85), false, plot.w * 0.6);
      }
      ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
      // Geisterbalken (Vorher, 30 % Deckkraft)
      if (ghostIn && ghostIn.f.length) {
        const gl = new Float32Array(nc).fill(-1e9);
        for (let i = 0; i < ghostIn.f.length; i++) { const c = colOf(ghostIn.f[i]); if (ghostIn.L[i] > gl[c]) gl[c] = ghostIn.L[i]; }
        ctx.fillStyle = P.fg; ctx.globalAlpha = 0.3 * nz(opts, 'ghostAlpha', 1, 0, 1); ctx.beginPath();
        for (let c = 0; c < nc; c++) if (gl[c] > yMin) { const y = Math.max(plot.y, yAt(gl[c])); ctx.rect(plot.x + c * cw + 0.5, y, Math.max(1, cw - 1), plot.y + plot.h - y); }
        ctx.fill(); ctx.globalAlpha = 1;
      }
      // Balken nach Marge: gruen, gelb, rot, ohne Grenzlinie
      const cls = [[], [], [], []];
      for (let c = 0; c < nc; c++) {
        const L = colLevel[c]; if (!(L > yMin)) continue;
        const lv = limFor(colF[c]), m = lv === lv ? lv - L : NaN;
        cls[m !== m ? 3 : m < 0 ? 2 : m < 6 ? 1 : 0].push(c);
      }
      const colors = [P.gruen, P.gelb, P.rot, P.senke];
      for (let k = 0; k < 4; k++) {
        if (!cls[k].length) continue;
        const useGrad = k < 3 && qualityOf(opts).gradients && typeof ctx.createLinearGradient === 'function';
        if (useGrad) { const g = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.h); g.addColorStop(0, colors[k]); g.addColorStop(1, mix(colors[k], P.panel, 0.55)); ctx.fillStyle = g; } else ctx.fillStyle = colors[k];
        ctx.beginPath();
        cls[k].forEach(c => { const y = Math.max(plot.y, yAt(colLevel[c])); ctx.rect(plot.x + c * cw + 0.5, y, Math.max(1, cw - 1), plot.y + plot.h - y); bars++; });
        ctx.fill();
      }
      // Schraffur der Balken ueber der Grenzlinie (nicht nur Farbe)
      if (cls[2].length) {
        reds = cls[2].length;
        ctx.save(); ctx.beginPath();
        cls[2].forEach(c => { const y = Math.max(plot.y, yAt(colLevel[c])); ctx.rect(plot.x + c * cw + 0.5, y, Math.max(1, cw - 1), plot.y + plot.h - y); });
        ctx.clip();
        ctx.strokeStyle = rgba(P.bg, 0.5); ctx.lineWidth = 1.3; ctx.beginPath();
        for (let k = -plot.h; k < plot.w; k += 7) { ctx.moveTo(plot.x + k, plot.y + plot.h); ctx.lineTo(plot.x + k + plot.h, plot.y); }
        ctx.stroke(); ctx.restore();
      }
      // Spitzenwert-Halten: fallender Schatten und Marke
      if (st) {
        ctx.fillStyle = P.fg; ctx.beginPath(); let any = false;
        for (let c = 0; c < nc; c++) if (colPeak[c] - colLevel[c] > 0.4 && colPeak[c] > yMin) { const y = yAt(colPeak[c]); ctx.rect(plot.x + c * cw + 0.5, y, Math.max(1, cw - 1), 2); any = true; }
        ctx.globalAlpha = 0.8; if (any) ctx.fill(); ctx.globalAlpha = 1;
      }
      // Einhuellende
      if (envPts) {
        ctx.strokeStyle = P.hfeld; ctx.lineWidth = 1.8; setDash(ctx, [6, 4]); ctx.beginPath();
        envPts.forEach((p, i) => { const x = xAt(Math.max(p[0], 1e-9)), y = yAt(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); setDash(ctx, NODASH);
      }
      // Grenzlinien (weiss gestrichelt, Stufen sauber)
      lims.forEach((l, li) => {
        ctx.strokeStyle = P.grenz; ctx.lineWidth = li ? 1.6 : 2.2; setDash(ctx, li ? [2, 3] : [9, 5]); ctx.beginPath();
        l.pts.forEach((p, i) => { const x = xAt(p[0]), y = yAt(p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); setDash(ctx, NODASH);
      });
      ctx.restore();
      // Marker mit Wert
      let mk = opts.marker === undefined ? 'peak' : opts.marker;
      if (mk !== false && mk !== null) {
        let mf = mk === 'peak' ? pk.f : dfin(mk) ? mk : (mk && typeof mk === 'object' && dfin(mk.f) ? mk.f : NaN);
        if (mf === mf && mf >= fMin && mf <= fMax) {
          let bi = 0, bd = Infinity; for (let i = 0; i < n; i++) { const d = Math.abs(Math.log(inp.f[i] / mf)); if (d < bd) { bd = d; bi = i; } }
          const mfx = inp.f[bi], mL = cur[bi], mx = xAt(mfx), lv = limFor(mfx), mm = lv === lv ? lv - mL : NaN;
          markerOut = { f: mfx, L: mL, margin: mm };
          ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(mx, plot.y); ctx.lineTo(mx, plot.y + plot.h); ctx.stroke(); setDash(ctx, NODASH);
          poly(ctx, [[mx - 5, plot.y - 1], [mx + 5, plot.y - 1], [mx, plot.y + 7]], true); ctx.fillStyle = P.fg; ctx.fill();
          const txt = fHz(mfx) + ' · ' + fz(mL, 1) + ' ' + unit + (mm === mm ? ' · Marge ' + (mm > 0 ? '+' : '') + fz(mm, 1) + ' dB' : '');
          font(ctx, fs, true); const w = Math.min(plot.w - 8, tw(ctx, txt, fs, true) + 8);
          const al = mx + w / 2 > plot.x + plot.w - 4 ? 'right' : mx - w / 2 < plot.x + 4 ? 'left' : 'center';
          lab(ctx, txt, al === 'right' ? plot.x + plot.w - 6 : al === 'left' ? plot.x + 6 : mx, plot.y + 16, al, fs, P.fg, rgba(P.bg, 0.88), true, plot.w - 12);
        }
      }
      drawPlotFrame(ctx, P, plot);
      // Achsenbeschriftung: Groesse und Einheit
      ctx.fillStyle = P.mute; font(ctx, fs, false); ctx.textBaseline = 'middle';
      ctx.textAlign = 'right'; yt.t.forEach(v => { ctx.fillText(fz(v, digitsOfStep(yt.s)), plot.x - 5, yAt(v)); });
      ctx.textAlign = 'center'; xt.forEach(f => { ctx.fillText(fTickText(f, au), xAt(f), plot.y + plot.h + fs); });
      lab(ctx, typeof opts.title === 'string' && opts.title ? opts.title : 'Pegel in ' + unit, rect.x + 4, rect.y + 10, 'left', fs, P.fg, null, true, rect.w * 0.5);
      lab(ctx, 'Frequenz in ' + au.unit, plot.x + plot.w / 2, rect.y + rect.h - fs * 0.8, 'center', fs, P.fg, null, true);
      const items = [];
      if (opts.legend !== false) {
        items.push({ text: 'Messwerte', color: P.gruen, kind: 'box' });
        if (envPts) items.push({ text: 'Einhüllende', color: P.hfeld, dash: [6, 4] });
        lims.forEach((l, i2) => { if (l.name) items.push({ text: l.name, color: P.grenz, dash: i2 ? [2, 3] : [9, 5] }); });
        if (ghostIn) items.push({ text: 'Vorher', color: P.fg, kind: 'box', alpha: 0.3 });
      }
      drawLegend(ctx, P, items, rect.x + rect.w - 6, rect.y + 10, rect.x + rect.w * 0.42, fs);
      return { plot, xAt, yAt, fAt, peak: pk, marker: markerOut, bars, reds, bins: nc, yMin, yMax, fMin, fMax };
    });
  }

  /* ----------------------------------------------------------------- Kurven (Bode-artig) */
  function seriesOf(curves) {
    const arr = Array.isArray(curves) ? curves : curves && typeof curves === 'object' ? [curves] : null;
    if (!arr || !arr.length) return null;
    let base = null; const series = []; const extra = { markers: [], limit: null };
    arr.forEach(c => {
      c = obj(c);
      const list = Array.isArray(c.series) ? c.series : Array.isArray(c.points) ? [c] : [];
      if (!base && list.length) base = c;
      if (!base || (c !== base && (c.yUnit !== base.yUnit || c.xUnit !== base.xUnit))) return;
      list.forEach(s => {
        s = obj(s); const pts = [];
        if (Array.isArray(s.points)) s.points.forEach(p => { if (Array.isArray(p) && dfin(p[0]) && dfin(p[1])) pts.push([p[0], p[1]]); });
        if (pts.length >= 2) series.push({ name: typeof s.name === 'string' ? s.name : '', pts });
      });
      if (c.marker && typeof c.marker === 'object' && dfin(c.marker.x) && dfin(c.marker.y)) extra.markers.push({ x: c.marker.x, y: c.marker.y, label: typeof c.marker.label === 'string' ? c.marker.label : '' });
      if (c.limit !== undefined && c.limit !== null && !extra.limit) extra.limit = c.limit;
    });
    if (!base || !series.length) return null;
    return { base, series, markers: extra.markers, limit: extra.limit };
  }
  function limitLine(l) {
    if (fin(l)) return { y: l, name: '' };
    if (Array.isArray(l)) { const p = normPts(l, 2, dfin); return p ? { pts: p, name: '' } : null; }
    if (l && typeof l === 'object') { if (fin(l.y)) return { y: l.y, name: typeof l.name === 'string' ? l.name : '' }; const p = normPts(l.pts, 2, dfin); if (p) return { pts: p, name: typeof l.name === 'string' ? l.name : '' }; }
    return null;
  }
  function decimate(pts, maxN) {
    if (pts.length <= maxN) return pts;
    const out = [], step = (pts.length - 1) / (maxN - 1);
    for (let i = 0; i < maxN; i++) out.push(pts[Math.round(i * step)]);
    return out;
  }
  /* curveChart(ctx, rect, curves, opts): Kurven ueber der Frequenz oder einer anderen Groesse.
   *  curves = [ { title, xLabel, xUnit, xScale:'log'|'lin', yLabel, yUnit, series:[{ name, points:[[x,y]...] }], marker:{x,y,label?}, limit } ] (Format von rig.curves())
   *  oder eine einzelne Kurve; mehrere Kurven mit gleichen Einheiten werden zusammengelegt.
   *  limit = Zahl (waagerecht) | [[x,y]...] | { y|pts, name }; opts = { xMin, xMax, yMin, yMax, bands:[{ y0, y1, color, label }], markers:[{x,y,label}],
   *  ghost (Reihen des gemerkten Zustands, gestrichelt, 30 %), title, quality, theme/palette }. Rueckgabe false oder { plot, xAt, yAt } (Mindestgroesse 200 x 120). */
  function curveChart(ctx, rect, curves, opts) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 120)) return false;
    opts = obj(opts);
    const S = seriesOf(curves); if (!S) return false;
    const P = pal(opts), base = S.base, isLog = base.xScale === 'log', xUnit = typeof base.xUnit === 'string' ? base.xUnit : '', yUnit = typeof base.yUnit === 'string' ? base.yUnit : '';
    const ghostS = opts.ghost ? seriesOf(opts.ghost) : null;
    let xs = [], ys = [];
    S.series.forEach(s => s.pts.forEach(p => { if (!isLog || p[0] > 0) { xs.push(p[0]); ys.push(p[1]); } }));
    if (!xs.length) return false;
    const lim = limitLine(S.limit), allM = S.markers.concat(Array.isArray(opts.markers) ? opts.markers.filter(m => m && dfin(m.x) && dfin(m.y)) : []);
    let xMin = dfin(opts.xMin) ? opts.xMin : Math.min.apply(null, xs), xMax = dfin(opts.xMax) ? opts.xMax : Math.max.apply(null, xs);
    if (isLog && !(xMin > 0)) xMin = Math.min.apply(null, xs.filter(v => v > 0));
    if (!(xMax > xMin)) xMax = xMin + 1;
    let yLo = Math.min.apply(null, ys), yHi = Math.max.apply(null, ys);
    if (lim) { if (lim.y !== undefined) { yLo = Math.min(yLo, lim.y); yHi = Math.max(yHi, lim.y); } else lim.pts.forEach(p => { yLo = Math.min(yLo, p[1]); yHi = Math.max(yHi, p[1]); }); }
    allM.forEach(m => { yLo = Math.min(yLo, m.y); yHi = Math.max(yHi, m.y); });
    if (!(yHi > yLo)) { yHi = yLo + 1; }
    const padY = (yHi - yLo) * 0.08;
    const yt0 = ticks(yLo - padY, yHi + padY, 5);
    let yMin = fin(opts.yMin) ? opts.yMin : (yt0.t.length ? Math.min(yt0.t[0], yLo - padY) : yLo - padY), yMax = fin(opts.yMax) ? opts.yMax : (yt0.t.length ? Math.max(yt0.t[yt0.t.length - 1], yHi + padY) : yHi + padY);
    if (!(yMax > yMin)) yMax = yMin + 1;
    const fs = fsz(rect.w), plot = chartPlot(rect, opts);
    const lx0 = Math.log(xMin), lxs = plot.w / (Math.log(xMax) - lx0 || 1);
    const xAt = isLog ? (x => plot.x + (Math.log(Math.max(x, 1e-300)) - lx0) * lxs) : (x => plot.x + plot.w * (x - xMin) / (xMax - xMin));
    const yAt = y => plot.y + plot.h * (1 - (y - yMin) / (yMax - yMin));
    const isHz = xUnit === 'Hz', au = isHz ? freqAxisUnit(xMax) : null;
    return draw(ctx, () => {
      drawPlotBg(ctx, P, rect, plot);
      const yt = ticks(yMin, yMax, Math.max(3, Math.floor(plot.h / 34)));
      const xt = isLog ? logTicks(xMin, xMax, Math.max(2, Math.floor(plot.w / 54))) : ticks(xMin, xMax, Math.max(3, Math.floor(plot.w / 64))).t;
      ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.beginPath();
      yt.t.forEach(v => { const y = yAt(v); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); });
      xt.forEach(v => { const x = xAt(v); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y + plot.h); });
      ctx.stroke();
      // Baender
      (Array.isArray(opts.bands) ? opts.bands : []).slice(0, 6).forEach(b => {
        b = obj(b); if (!fin(b.y0) || !fin(b.y1)) return;
        const ya = cl(yAt(Math.max(b.y0, b.y1)), plot.y, plot.y + plot.h), yb = cl(yAt(Math.min(b.y0, b.y1)), plot.y, plot.y + plot.h);
        ctx.fillStyle = rgba(goodColor(b.color) ? b.color : P.gruen, 0.16); ctx.fillRect(plot.x, ya, plot.w, yb - ya);
        if (typeof b.label === 'string' && b.label) lab(ctx, b.label, plot.x + 6, ya + fs * 0.9, 'left', fs, P.fg, rgba(P.panel, 0.85), false, plot.w * 0.5);
      });
      ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const maxPts = Math.max(30, Math.min(260, Math.floor(plot.w / 2)));
      if (ghostS) {
        ctx.globalAlpha = 0.3; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, [5, 4]);
        ghostS.series.forEach(s => { ctx.beginPath(); decimate(s.pts.filter(p => !isLog || p[0] > 0), maxPts).forEach((p, i) => { if (i) ctx.lineTo(xAt(p[0]), yAt(p[1])); else ctx.moveTo(xAt(p[0]), yAt(p[1])); }); ctx.stroke(); });
        setDash(ctx, NODASH); ctx.globalAlpha = 1;
      }
      if (lim) {
        ctx.strokeStyle = P.grenz; ctx.lineWidth = 2; setDash(ctx, [9, 5]); ctx.beginPath();
        if (lim.y !== undefined) { ctx.moveTo(plot.x, yAt(lim.y)); ctx.lineTo(plot.x + plot.w, yAt(lim.y)); }
        else lim.pts.forEach((p, i) => { if (i) ctx.lineTo(xAt(p[0]), yAt(p[1])); else ctx.moveTo(xAt(p[0]), yAt(p[1])); });
        ctx.stroke(); setDash(ctx, NODASH);
      }
      S.series.forEach((s, si) => {
        ctx.strokeStyle = P.series[si % P.series.length]; ctx.lineWidth = 2.4; setDash(ctx, SDASH[si % SDASH.length] || NODASH);
        ctx.beginPath(); decimate(s.pts.filter(p => !isLog || p[0] > 0), maxPts).forEach((p, i) => { if (i) ctx.lineTo(xAt(p[0]), yAt(p[1])); else ctx.moveTo(xAt(p[0]), yAt(p[1])); }); ctx.stroke();
      });
      setDash(ctx, NODASH);
      ctx.restore();
      // Marker mit Wert
      allM.slice(0, 4).forEach((m, mi) => {
        const mx = xAt(m.x), my = yAt(m.y); if (mx < plot.x - 1 || mx > plot.x + plot.w + 1 || my < plot.y - 1 || my > plot.y + plot.h + 1) return;
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(mx, plot.y); ctx.lineTo(mx, plot.y + plot.h); ctx.stroke(); setDash(ctx, NODASH);
        dot(ctx, mx, my, 5, P.fg, P.bg, 1.5);
        const xt2 = isHz ? fHz(m.x) : fzt(m.x, 2) + (xUnit ? ' ' + xUnit : '');
        const txt = (m.label ? m.label + ': ' : '') + xt2 + ' · ' + fz(m.y, 1) + (yUnit ? ' ' + yUnit : '');
        font(ctx, fs, true); const w = tw(ctx, txt, fs, true) + 8, right = mx + w / 2 > plot.x + plot.w - 4, left = mx - w / 2 < plot.x + 4;
        lab(ctx, txt, right ? plot.x + plot.w - 6 : left ? plot.x + 6 : mx, my + (my < plot.y + plot.h * 0.5 ? 18 : -16) + mi * 0, right ? 'right' : left ? 'left' : 'center', fs, P.fg, rgba(P.bg, 0.88), true, plot.w - 12);
      });
      if (lim && lim.name) {
        const ly = lim.y !== undefined ? yAt(lim.y) : yAt(lim.pts[lim.pts.length - 1][1]);
        lab(ctx, lim.name, plot.x + plot.w - 6, cl(ly - fs * 0.9, plot.y + fs, plot.y + plot.h - fs), 'right', fs, P.fg, rgba(P.bg, 0.85), false, plot.w * 0.6);
      }
      drawPlotFrame(ctx, P, plot);
      ctx.fillStyle = P.mute; font(ctx, fs, false); ctx.textBaseline = 'middle';
      ctx.textAlign = 'right'; yt.t.forEach(v => { ctx.fillText(fz(v, digitsOfStep(yt.s)), plot.x - 5, yAt(v)); });
      ctx.textAlign = 'center'; xt.forEach(v => { ctx.fillText(isHz ? fTickText(v, au) : fzt(v, digitsOfStep((xt.length > 1 ? Math.abs(xt[1] - xt[0]) : 1))), xAt(v), plot.y + plot.h + fs); });
      const yl = (typeof base.yLabel === 'string' && base.yLabel ? base.yLabel : 'Wert') + (yUnit ? ' in ' + yUnit : '');
      lab(ctx, typeof opts.title === 'string' && opts.title ? opts.title : yl, rect.x + 4, rect.y + 10, 'left', fs, P.fg, null, true, rect.w * 0.5);
      const xl = (typeof base.xLabel === 'string' && base.xLabel ? base.xLabel : 'x') + ' in ' + (isHz ? au.unit : xUnit || '–');
      lab(ctx, xl, plot.x + plot.w / 2, rect.y + rect.h - fs * 0.8, 'center', fs, P.fg, null, true);
      const items = S.series.map((s, i) => ({ text: s.name || ('Reihe ' + (i + 1)), color: P.series[i % P.series.length], dash: SDASH[i % SDASH.length] }));
      if (lim) items.push({ text: lim.name || 'Grenzlinie', color: P.grenz, dash: [9, 5] });
      if (ghostS) items.push({ text: 'Vorher', color: P.fg, dash: [5, 4] });
      drawLegend(ctx, P, items.filter(it => it.text), rect.x + rect.w - 6, rect.y + 10, rect.x + rect.w * 0.3, fs);
      return { plot, xAt, yAt, yMin, yMax, xMin, xMax };
    });
  }

  /* ----------------------------------------------------------------- Zeitverlaeufe */
  function waveOf(w) {
    w = obj(w); if (!Array.isArray(w.t) || w.t.length < 2 || w.t.length > 20000 || !Array.isArray(w.series)) return null;
    const t = w.t; for (let i = 0; i < t.length; i++) if (!dfin(t[i])) return null;
    const series = [];
    w.series.forEach(s => {
      s = obj(s); if (!Array.isArray(s.y) || s.y.length !== t.length) return;
      for (let i = 0; i < s.y.length; i++) if (!afin(s.y[i])) return;
      series.push({ name: typeof s.name === 'string' ? s.name : '', y: s.y, unit: typeof s.unit === 'string' ? s.unit : '' });
    });
    if (!series.length) return null;
    return { t, series, unit: typeof w.tUnit === 'string' ? w.tUnit : 's', marks: Array.isArray(w.marks) ? w.marks.filter(m => m && dfin(m.t) && typeof m.text === 'string') : [] };
  }
  function interp(t, y, tc) {
    if (tc <= t[0]) return y[0]; if (tc >= t[t.length - 1]) return y[y.length - 1];
    let lo = 0, hi = t.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (t[m] <= tc) lo = m; else hi = m; }
    const u = (tc - t[lo]) / ((t[hi] - t[lo]) || 1); return y[lo] + (y[hi] - y[lo]) * u;
  }
  /* traceChart(ctx, rect, wave, opts): Zeitverlaeufe (ns, us, ms) mit Geisterspur, Marken und Zeitlupe-Cursor.
   *  wave = { tUnit:'ns'|'µs'|'ms'|'s', t:[], series:[{ name, y:[], unit }], marks:[{ t, text }] } (rig.waveform())
   *  Reihen mit der Einheit der ersten Reihe stehen an der linken Achse, Reihen mit anderer Einheit an der rechten.
   *  opts = { ghost (wave, gestrichelt), cursor (Zeit in tUnit: Fadenkreuz mit Werten), hlines:[{ y, name }], t0, t1, yMin, yMax, theme/palette, title }
   *  Rueckgabe false oder { plot, xAt, yAt, t0, t1, timeAt(px) } (Mindestgroesse 200 x 120). */
  function traceChart(ctx, rect, wave, opts) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 120)) return false;
    opts = obj(opts);
    const W = waveOf(wave); if (!W) return false;
    const G = opts.ghost ? waveOf(opts.ghost) : null;
    const P = pal(opts), fs = fsz(rect.w);
    const u1 = W.series[0].unit, left = W.series.filter(s => s.unit === u1), right = W.series.filter(s => s.unit !== u1), u2 = right.length ? right[0].unit : '';
    const rw = right.length ? 36 : 0, plot = chartPlot(rect, opts, rw);
    const t0 = dfin(opts.t0) ? opts.t0 : W.t[0], t1 = dfin(opts.t1) && opts.t1 > t0 ? opts.t1 : W.t[W.t.length - 1];
    if (!(t1 > t0)) return false;
    const ext = (list, extra) => {
      let lo = Infinity, hi = -Infinity;
      list.forEach(s => s.y.forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; }));
      (extra || []).forEach(v => { if (v < lo) lo = v; if (v > hi) hi = v; });
      if (!(hi > lo)) { hi = lo + 1; } const pad = (hi - lo) * 0.08; const tk = ticks(lo - pad, hi + pad, 5);
      return [tk.t.length ? Math.min(tk.t[0], lo - pad) : lo - pad, tk.t.length ? Math.max(tk.t[tk.t.length - 1], hi + pad) : hi + pad];
    };
    const hl = (Array.isArray(opts.hlines) ? opts.hlines : []).filter(h => h && fin(h.y)).slice(0, 4);
    const lg = left.concat(G ? G.series.filter(s => s.unit === u1) : []);
    let [yL0, yL1] = ext(lg, hl.map(h => h.y));
    if (fin(opts.yMin)) yL0 = opts.yMin; if (fin(opts.yMax) && opts.yMax > yL0) yL1 = opts.yMax;
    const [yR0, yR1] = right.length ? ext(right.concat(G ? G.series.filter(s => s.unit === u2) : [])) : [0, 1];
    const xAt = t => plot.x + plot.w * (t - t0) / (t1 - t0), yAt = y => plot.y + plot.h * (1 - (y - yL0) / (yL1 - yL0)), yAtR = y => plot.y + plot.h * (1 - (y - yR0) / (yR1 - yR0));
    const timeAt = px => t0 + (px - plot.x) / plot.w * (t1 - t0);
    return draw(ctx, () => {
      drawPlotBg(ctx, P, rect, plot);
      const yt = ticks(yL0, yL1, Math.max(3, Math.floor(plot.h / 34))), xt = ticks(t0, t1, Math.max(3, Math.floor(plot.w / 70)));
      ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.beginPath();
      yt.t.forEach(v => { const y = yAt(v); ctx.moveTo(plot.x, y); ctx.lineTo(plot.x + plot.w, y); });
      xt.t.forEach(v => { const x = xAt(v); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y + plot.h); });
      ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(plot.x, plot.y, plot.w, plot.h); ctx.clip();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const maxPts = Math.max(40, Math.min(320, Math.floor(plot.w)));
      const pathOf = (t, y, f) => {
        ctx.beginPath(); const step = Math.max(1, Math.floor(t.length / maxPts));
        let first = true; for (let i = 0; i < t.length; i += step) { const x = xAt(t[i]), yy = f(y[i]); if (first) { ctx.moveTo(x, yy); first = false; } else ctx.lineTo(x, yy); }
        const li = t.length - 1; if (li % step) ctx.lineTo(xAt(t[li]), f(y[li]));
      };
      if (G) {
        ctx.globalAlpha = 0.35; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, [5, 4]);
        G.series.forEach(s => { pathOf(G.t, s.y, s.unit === u1 ? yAt : yAtR); ctx.stroke(); });
        setDash(ctx, NODASH); ctx.globalAlpha = 1;
      }
      hl.forEach(h => {
        ctx.strokeStyle = P.grenz; ctx.lineWidth = 1.6; setDash(ctx, [9, 5]); ctx.beginPath(); ctx.moveTo(plot.x, yAt(h.y)); ctx.lineTo(plot.x + plot.w, yAt(h.y)); ctx.stroke(); setDash(ctx, NODASH);
      });
      W.series.forEach((s, si) => {
        ctx.strokeStyle = P.series[si % P.series.length]; ctx.lineWidth = 2.4; setDash(ctx, SDASH[si % SDASH.length] || NODASH);
        pathOf(W.t, s.y, s.unit === u1 ? yAt : yAtR); ctx.stroke();
      });
      setDash(ctx, NODASH);
      ctx.restore();
      hl.forEach(h => { if (typeof h.name === 'string' && h.name) lab(ctx, h.name + ' ' + fz(h.y, 1) + (u1 ? ' ' + u1 : ''), plot.x + plot.w - 6, cl(yAt(h.y) - fs * 0.9, plot.y + fs, plot.y + plot.h - fs), 'right', fs, P.fg, rgba(P.bg, 0.85), false, plot.w * 0.6); });
      W.marks.slice(0, 5).forEach(m => {
        const x = xAt(m.t); if (x < plot.x || x > plot.x + plot.w) return;
        ctx.strokeStyle = P.mute; ctx.lineWidth = 1; setDash(ctx, [2, 3]); ctx.beginPath(); ctx.moveTo(x, plot.y); ctx.lineTo(x, plot.y + plot.h); ctx.stroke(); setDash(ctx, NODASH);
        const right2 = x > plot.x + plot.w * 0.7;
        lab(ctx, m.text, right2 ? x - 4 : x + 4, plot.y + fs * 2.9 + (W.marks.indexOf(m) % 2) * fs * 1.7, right2 ? 'right' : 'left', fs, P.fg, rgba(P.bg, 0.85), false, plot.w * 0.45);
      });
      if (fin(opts.cursor) && opts.cursor >= t0 && opts.cursor <= t1) {
        const cx = xAt(opts.cursor);
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(cx, plot.y); ctx.lineTo(cx, plot.y + plot.h); ctx.stroke();
        let line = 0;
        W.series.forEach((s, si) => {
          const v = interp(W.t, s.y, opts.cursor), cy = (s.unit === u1 ? yAt : yAtR)(v);
          dot(ctx, cx, cl(cy, plot.y, plot.y + plot.h), 4, P.series[si % P.series.length], P.bg, 1.4);
          const txt = (s.name ? s.name + ' ' : '') + fz(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) + (s.unit ? ' ' + s.unit : '');
          const rightSide = cx > plot.x + plot.w * 0.6;
          lab(ctx, txt, rightSide ? cx - 6 : cx + 6, plot.y + plot.h - fs * (1.1 + 1.7 * line), rightSide ? 'right' : 'left', fs, P.series[si % P.series.length], rgba(P.bg, 0.88), true, plot.w * 0.5);
          line++;
        });
        lab(ctx, 't = ' + fzt(opts.cursor, 2) + ' ' + W.unit, cx > plot.x + plot.w * 0.6 ? cx - 6 : cx + 6, plot.y + fs * 1.1, cx > plot.x + plot.w * 0.6 ? 'right' : 'left', fs, P.fg, rgba(P.bg, 0.88), true, plot.w * 0.5);
      }
      drawPlotFrame(ctx, P, plot);
      ctx.fillStyle = P.mute; font(ctx, fs, false); ctx.textBaseline = 'middle';
      ctx.textAlign = 'right'; yt.t.forEach(v => { ctx.fillText(fz(v, digitsOfStep(yt.s)), plot.x - 5, yAt(v)); });
      ctx.textAlign = 'center'; xt.t.forEach(v => { ctx.fillText(fzt(v, digitsOfStep(xt.s)), xAt(v), plot.y + plot.h + fs); });
      if (right.length) { const ytr = ticks(yR0, yR1, 4); ctx.textAlign = 'left'; ytr.t.forEach(v => { ctx.fillText(fz(v, digitsOfStep(ytr.s)), plot.x + plot.w + 4, yAtR(v)); }); }
      lab(ctx, typeof opts.title === 'string' && opts.title ? opts.title : (u1 ? 'Wert in ' + u1 : 'Wert') + (u2 ? ' und ' + u2 : ''), rect.x + 4, rect.y + 10, 'left', fs, P.fg, null, true, rect.w * 0.5);
      lab(ctx, 'Zeit in ' + W.unit, plot.x + plot.w / 2, rect.y + rect.h - fs * 0.8, 'center', fs, P.fg, null, true);
      const items = W.series.map((s, i) => ({ text: s.name || ('Reihe ' + (i + 1)), color: P.series[i % P.series.length], dash: SDASH[i % SDASH.length] }));
      if (G) items.push({ text: 'Vorher', color: P.fg, dash: [5, 4] });
      drawLegend(ctx, P, items.filter(it => it.text), rect.x + rect.w - 6, rect.y + 10, rect.x + rect.w * 0.3, fs);
      return { plot, xAt, yAt, t0, t1, timeAt };
    });
  }

  /* ----------------------------------------------------------------- Ampel */
  /* ampel(ctx, x, y, state, o): Ampel mit Symbol (✓ ! ✗ –) und Text; (x, y) links oben.
   *  state = 'gruen'|'gelb'|'rot'|'grau' oder rig.assess()-Objekt ({ ampel, text, margin })
   *  o = { size (Hoehe des Gehaeuses, 28...160, Vorgabe 64), margin (dB), text (Vorgabe: Name der Stufe), maxw, pulse (0..1: einmaliger Puls nach dem Wechsel;
   *        ohne reduced), reduced, theme/palette }. Rueckgabe false oder { w, h, key } */
  function ampel(ctx, x, y, state, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    const key = ampelKey(state); if (!key) return false;
    o = obj(o); const P = pal(o), A = AMPEL[key];
    const size = nz(o, 'size', 64, 28, 160), lw = size * 0.46, lr = size / 6.4, fs = Math.max(12, Math.min(18, Math.round(size / 4.4)));
    const margin = fin(o.margin) ? o.margin : (state && typeof state === 'object' && fin(state.margin) ? state.margin : NaN);
    const mainText = typeof o.text === 'string' && o.text ? o.text : (state && typeof state === 'object' && typeof state.text === 'string' && state.text ? state.text : A.text);
    const color = ampelColor(P, key), pulse = o.reduced !== true && fin(o.pulse) && o.pulse >= 0 && o.pulse <= 1 ? o.pulse : -1;
    const sc = pulse > 0 && pulse < 1 ? 1 + 0.16 * Math.sin(Math.PI * pulse) : 1;
    const maxw = nz(o, 'maxw', 0, 0, 5000);
    return draw(ctx, () => {
      const cx = x + lw / 2, cy = y + size / 2;
      if (sc !== 1) { ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
      ctx.fillStyle = P.panel2; rrect(ctx, x, y, lw, size, lw * 0.3); ctx.fill();
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; ctx.stroke();
      const order = ['rot', 'gelb', 'gruen'];
      order.forEach((k, i) => {
        const lx = x + lw / 2, ly = y + size * (0.2 + 0.3 * i), lit = k === key;
        dot(ctx, lx, ly, lr, rgba(ampelColor(P, k), lit ? 1 : 0.16), lit ? P.fg : P.line, lit ? 1.6 : 1);
        if (lit) {
          if (qualityOf(o).shadow) { ctx.globalAlpha = 0.22; dot(ctx, lx, ly, lr * 1.55, ampelColor(P, k), null); ctx.globalAlpha = 1; }
          sym(ctx, A.sym === 'dash' ? 'dash' : A.sym, lx, ly, lr * 1.5, P.bg, Math.max(1.8, lr * 0.28));
        }
      });
      if (key === 'grau') { dot(ctx, x + lw / 2, y + size * 0.5, lr, rgba(P.grau, 0.9), P.fg, 1.6); sym(ctx, 'dash', x + lw / 2, y + size * 0.5, lr * 1.5, P.bg, Math.max(1.8, lr * 0.28)); }
      return true;
    }) && draw(ctx, () => {
      const tx = x + lw + size * 0.18, wMax = maxw > 0 ? maxw - lw - size * 0.18 : 0;
      const lines = [{ t: mainText, b: true, c: color }];
      if (fin(margin) && key !== 'grau') lines.push({ t: 'Marge ' + (margin > 0 ? '+' : '') + fz(margin, 1) + ' dB', b: false, c: P.fg });
      const gap = fs * 1.5, y0 = y + size / 2 - (lines.length - 1) * gap / 2;
      let wmax = 0;
      lines.forEach((l, i) => { const w = lab(ctx, l.t, tx, y0 + i * gap, 'left', fs, l.c, null, l.b, wMax); if (w) wmax = Math.max(wmax, w); });
      return { w: lw + size * 0.18 + wmax, h: size, key };
    });
  }

  /* ----------------------------------------------------------------- Wischer */
  const HANDLE_W = 44;     /* Griff >= 40 px (SPEC 6.2) */
  /* wipe(ctx, rect, drawA, drawB, pos): A links, B rechts der Teilungslinie (pos 0..1). drawA und drawB = function (ctx, rect).
   *  Rueckgabe false oder { x (Teilung), handle:{ x, y, w, h } }. */
  function wipe(ctx, rect, drawA, drawB, pos, o) {
    if (!okCtx(ctx) || !isRect(rect) || typeof drawA !== 'function' || typeof drawB !== 'function') return false;
    o = obj(o); const P = pal(o);
    const p = cl(fin(pos) ? pos : 0.5, 0, 1), sx = rect.x + rect.w * p;
    const names = Array.isArray(o.labels) ? o.labels : ['Vorher', 'Nachher'];
    return draw(ctx, () => {
      if (sx > rect.x) { ctx.save(); ctx.beginPath(); ctx.rect(rect.x, rect.y, sx - rect.x, rect.h); ctx.clip(); try { drawA(ctx, rect); } finally { ctx.restore(); } }
      if (sx < rect.x + rect.w) { ctx.save(); ctx.beginPath(); ctx.rect(sx, rect.y, rect.x + rect.w - sx, rect.h); ctx.clip(); try { drawB(ctx, rect); } finally { ctx.restore(); } }
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, NODASH); ctx.beginPath(); ctx.moveTo(sx, rect.y); ctx.lineTo(sx, rect.y + rect.h); ctx.stroke();
      const hh = Math.max(HANDLE_W, 1), hy = rect.y + rect.h / 2, hx = cl(sx, rect.x + HANDLE_W / 2, rect.x + rect.w - HANDLE_W / 2);
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; dot(ctx, hx, hy, HANDLE_W / 2 - 2, P.panel2, P.fg, 2);
      ctx.fillStyle = P.fg; poly(ctx, [[hx - 15, hy], [hx - 7, hy - 6], [hx - 7, hy + 6]], true); ctx.fill(); poly(ctx, [[hx + 15, hy], [hx + 7, hy - 6], [hx + 7, hy + 6]], true); ctx.fill();
      const fs = fsz(rect.w);
      if (typeof names[0] === 'string' && hx - HANDLE_W / 2 - rect.x > 80) lab(ctx, names[0], hx - HANDLE_W / 2 - 6, hy, 'right', fs, P.fg, rgba(P.bg, 0.88), true);
      if (typeof names[1] === 'string' && rect.x + rect.w - hx - HANDLE_W / 2 > 80) lab(ctx, names[1], hx + HANDLE_W / 2 + 6, hy, 'left', fs, P.fg, rgba(P.bg, 0.88), true);
      return { x: sx, handle: { x: hx - HANDLE_W / 2, y: hy - hh / 2, w: HANDLE_W, h: hh } };
    });
  }
  /* Treffer auf den Griff (Beruehrungsflaeche mindestens 44 px breit, ueber die ganze Hoehe der Teilungslinie) */
  function wipeHit(rect, pos, px, py) {
    if (!isRect(rect) || !fin(pos) || !fin(px) || !fin(py)) return false;
    const sx = rect.x + rect.w * cl(pos, 0, 1);
    return Math.abs(px - sx) <= HANDLE_W / 2 && py >= rect.y && py <= rect.y + rect.h;
  }
  function wipePos(rect, px) { if (!isRect(rect) || !fin(px)) return NaN; return cl((px - rect.x) / rect.w, 0.02, 0.98); }

  /* ----------------------------------------------------------------- Wirkungskette */
  /* chainBar(ctx, rect, chain, active, o): Quelle - Pfad - Senke mit den drei Hebeln. chain = { quelle, pfad, senke } (Texte, rig.chain),
   *  active = 'quelle'|'pfad'|'senke'|null (zuletzt bedientes Element, faerbt seinen Hebel). Mindestgroesse 220 x 44. */
  function chainBar(ctx, rect, chain, active, o) {
    if (!okCtx(ctx) || !rectMin(rect, 220, 44) || !chain || typeof chain !== 'object') return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w);
    const gap = 14, bw = (rect.w - 2 * gap) / 3, keys = ['quelle', 'pfad', 'senke'];
    return draw(ctx, () => {
      keys.forEach((k, i) => {
        const x = rect.x + i * (bw + gap), col = P.levers[k], on = active === k, txt = typeof chain[k] === 'string' && chain[k] ? chain[k] : '–';
        ctx.fillStyle = on ? rgba(col, 0.22) : P.panel; rrect(ctx, x, rect.y, bw, rect.h, 7); ctx.fill();
        ctx.strokeStyle = col; ctx.lineWidth = on ? 3 : 1.4; ctx.globalAlpha = on ? 1 : 0.75; ctx.stroke(); ctx.globalAlpha = 1;
        const name = bw >= 128 ? LEVERS[k].name : LEVERS[k].short;
        lab(ctx, name, x + 8, rect.y + rect.h * 0.3, 'left', fs, col, null, true, bw - 14);
        lab(ctx, txt, x + 8, rect.y + rect.h * 0.7, 'left', fs, P.fg, null, false, bw - 14);
        if (i < 2) { const ax = x + bw + 2, ay = rect.y + rect.h / 2; ctx.fillStyle = P.mute; poly(ctx, [[ax, ay - 6], [ax + gap - 4, ay], [ax, ay + 6]], true); ctx.fill(); }
      });
      return true;
    });
  }

  /* ----------------------------------------------------------------- Nahfeldkarte */
  const HEATSTOPS = [[0, [7, 10, 20]], [0.3, [107, 74, 0]], [0.62, [245, 196, 0]], [1, [255, 255, 255]]];
  /* Farbskala dunkel - gelb - weiss, t 0..1 -> [r, g, b] */
  function heatRGB(t) {
    t = cl(afin(t) ? t : 0, 0, 1);
    for (let i = 1; i < HEATSTOPS.length; i++) {
      if (t <= HEATSTOPS[i][0]) { const a = HEATSTOPS[i - 1], b = HEATSTOPS[i], u = (t - a[0]) / (b[0] - a[0]); return [a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u, a[1][2] + (b[1][2] - a[1][2]) * u]; }
    }
    return HEATSTOPS[HEATSTOPS.length - 1][1].slice();
  }
  const heatCss = t => { const c = heatRGB(t); return 'rgb(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ')'; };
  const HEATOFF = typeof WeakMap === 'function' ? new WeakMap() : null;
  function gridOf(g) {
    g = obj(g);
    if (Array.isArray(g.data) || (g.data && typeof g.data.length === 'number' && typeof g.data !== 'string')) {
      if (fin(g.w) && fin(g.h) && g.w >= 2 && g.h >= 2 && g.data.length === g.w * g.h && g.w * g.h <= 40000) return { w: g.w | 0, h: g.h | 0, d: g.data, min: g.min, max: g.max };
    }
    return null;
  }
  /* heatmap(ctx, rect, grid, o): grid = { w, h, data (Zeilen von oben, relative dB), min?, max? } (z. B. 40 x 28).
   *  o = { range:[lo, hi] (dB, Vorgabe: max - 40 ... max), probe:{ x, y } (0..1), peak (true: Maximum markieren), unit (Vorgabe 'dB'), theme/palette }.
   *  Rueckgabe false oder { plot, max:{ x, y, v }, probe:{ v }|null }. Mindestgroesse 120 x 90. */
  function heatmap(ctx, rect, grid, o) {
    if (!okCtx(ctx) || !rectMin(rect, 120, 90)) return false;
    const G = gridOf(grid); if (!G) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w);
    let mx = -Infinity, mn = Infinity, mi = 0;
    for (let i = 0; i < G.d.length; i++) { const v = G.d[i]; if (!afin(v)) return false; if (v > mx) { mx = v; mi = i; } if (v < mn) mn = v; }
    let hi = Array.isArray(o.range) && fin(o.range[1]) ? o.range[1] : (fin(G.max) ? G.max : mx), lo = Array.isArray(o.range) && fin(o.range[0]) ? o.range[0] : (fin(G.min) ? G.min : Math.max(mn, hi - 40));
    if (!(hi > lo)) lo = hi - 1;
    const legH = fs * 2.6 + 6, plot = { x: rect.x + 4, y: rect.y + 4, w: rect.w - 8, h: rect.h - legH - 8 };
    if (!(plot.w > 40 && plot.h > 30)) return false;
    const cw = plot.w / G.w, ch = plot.h / G.h, unit = typeof o.unit === 'string' ? o.unit : 'dB';
    const unitOf = v => cl((v - lo) / (hi - lo), 0, 1);
    const sample = (px, py) => { const gx = cl(Math.floor(px * G.w), 0, G.w - 1), gy = cl(Math.floor(py * G.h), 0, G.h - 1); return G.d[gy * G.w + gx]; };
    let probeOut = null;
    return draw(ctx, () => {
      ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      let done = false;
      if (typeof document !== 'undefined' && typeof ctx.drawImage === 'function' && HEATOFF && typeof G.d === 'object') {
        try {
          const ck = lo + ':' + hi + ':' + G.w + ':' + G.h; let ent = HEATOFF.get(G.d);
          if (!ent || ent.key !== ck) {
            const cv = document.createElement('canvas'); cv.width = G.w; cv.height = G.h;
            const c2 = cv.getContext('2d'), im = c2.createImageData(G.w, G.h);
            for (let i = 0; i < G.d.length; i++) { const c = heatRGB(unitOf(G.d[i])); im.data[4 * i] = c[0]; im.data[4 * i + 1] = c[1]; im.data[4 * i + 2] = c[2]; im.data[4 * i + 3] = 255; }
            c2.putImageData(im, 0, 0); ent = { key: ck, cv }; HEATOFF.set(G.d, ent);
          }
          ctx.imageSmoothingEnabled = true; ctx.drawImage(ent.cv, plot.x, plot.y, plot.w, plot.h); done = true;
        } catch (e) { done = false; }
      }
      if (!done) {      /* Rueckfall: 24 Stufen, waagerechte Laeufe gleicher Stufe zu einem Rechteck */
        const NL = 24, rows = [];
        for (let gy = 0; gy < G.h; gy++) {
          let gx = 0;
          while (gx < G.w) {
            const lv = Math.round(unitOf(G.d[gy * G.w + gx]) * (NL - 1)); let e = gx + 1;
            while (e < G.w && Math.round(unitOf(G.d[gy * G.w + e]) * (NL - 1)) === lv) e++;
            rows.push([lv, gx, gy, e - gx]); gx = e;
          }
        }
        for (let lv = 0; lv < NL; lv++) {
          ctx.fillStyle = heatCss(lv / (NL - 1)); ctx.beginPath(); let any = false;
          rows.forEach(r => { if (r[0] === lv) { ctx.rect(plot.x + r[1] * cw, plot.y + r[2] * ch, r[3] * cw + 0.6, ch + 0.6); any = true; } });
          if (any) ctx.fill();
        }
      }
      ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.strokeRect(plot.x, plot.y, plot.w, plot.h);
      const peak = { x: ((mi % G.w) + 0.5) / G.w, y: (Math.floor(mi / G.w) + 0.5) / G.h, v: mx };
      if (o.peak === true) {
        const px = plot.x + peak.x * plot.w, py = plot.y + peak.y * plot.h;
        dot(ctx, px, py, 9, null, P.rot, 2.2); ctx.strokeStyle = P.rot; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px - 9, py); ctx.moveTo(px + 9, py); ctx.lineTo(px + 14, py); ctx.stroke();
        lab(ctx, 'Maximum ' + fz(0, 0) + ' ' + unit, cl(px, plot.x + 52, plot.x + plot.w - 52), py + (py > plot.y + plot.h * 0.5 ? -20 : 20), 'center', fs, P.fg, rgba(P.bg, 0.85), true);
      }
      const pr = obj(o.probe);
      if (fin(pr.x) && fin(pr.y)) {
        const qx = cl(pr.x, 0, 1), qy = cl(pr.y, 0, 1), px = plot.x + qx * plot.w, py = plot.y + qy * plot.h, v = sample(qx, qy) - (hi === mx ? 0 : 0);
        probeOut = { v: v - mx };
        ctx.strokeStyle = P.senke; ctx.lineWidth = 2.2; dot(ctx, px, py, 11, rgba(P.bg, 0.25), P.senke, 2.4);
        ctx.beginPath(); ctx.moveTo(px - 18, py); ctx.lineTo(px - 11, py); ctx.moveTo(px + 11, py); ctx.lineTo(px + 18, py); ctx.moveTo(px, py - 18); ctx.lineTo(px, py - 11); ctx.moveTo(px, py + 11); ctx.lineTo(px, py + 18); ctx.stroke();
        lab(ctx, 'Sonde ' + fz(v - mx, 1) + ' ' + unit, cl(px, plot.x + 52, plot.x + plot.w - 52), py + (py > plot.y + plot.h * 0.5 ? -24 : 24), 'center', fs, P.senke, rgba(P.bg, 0.88), true);
      }
      // Legende: Farbskala dunkel - gelb - weiss
      const lx = plot.x, lw = plot.w, ly = plot.y + plot.h + 8, lh = 10, NS = 32;
      for (let i = 0; i < NS; i++) { ctx.fillStyle = heatCss(i / (NS - 1)); ctx.fillRect(lx + lw * i / NS, ly, lw / NS + 0.6, lh); }
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(lx, ly, lw, lh);
      ctx.fillStyle = P.mute; font(ctx, fs, false); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(fz(lo - mx, 0) + ' ' + unit, lx, ly + lh + fs * 0.9);
      ctx.textAlign = 'right'; ctx.fillText(fz(hi - mx, 0) + ' ' + unit, lx + lw, ly + lh + fs * 0.9);
      ctx.textAlign = 'center'; ctx.fillStyle = P.fg; ctx.fillText('Nahfeld relativ zum Maximum', lx + lw / 2, ly + lh + fs * 0.9);
      return { plot, max: peak, probe: probeOut };
    });
  }

  /* =================================================================================================================
   *  D. Bauteile der Szenen: Leiterplatte, Gehaeuse, Leitung, ESD-Pistole, Tastkopf, Netznachbildung, Geraet, Filterschaltbild
   * ================================================================================================================= */
  /* Wert mit Einheitenvorsatz: engU(100e-9, 'F') = "100 nF", Text bleibt Text */
  function engU(v, unit) {
    if (typeof v === 'string') return v;
    if (!afin(v)) return '–';
    if (v === 0) return '0 ' + unit;
    const a = Math.abs(v), P = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
    for (let i = 0; i < P.length; i++) if (a >= P[i][0] * 0.9995) { const x = v / P[i][0]; return fzt(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2) + ' ' + P[i][1] + unit; }
    return fzt(v * 1e12, 2) + ' p' + unit;
  }
  const num4 = a => Array.isArray(a) && a.length >= 4 && a.slice(0, 4).every(fin);

  /* ----------------------------------------------------------------- Leiterplatte von oben */
  function shapePts(sh) {
    if (!sh || typeof sh !== 'object') return null;
    if (num4(sh.rect)) return [[sh.rect[0], sh.rect[1]], [sh.rect[0] + sh.rect[2], sh.rect[1]], [sh.rect[0] + sh.rect[2], sh.rect[1] + sh.rect[3]], [sh.rect[0], sh.rect[1] + sh.rect[3]]];
    return normPts(sh.poly, 3);
  }
  /* layoutBoard(ctx, rect, model, o): Leiterplatte von oben (Weltmass in mm, y nach unten, Ursprung links oben).
   *  model = { w, h (Vorgabe 100 x 70), planes:[{ rect:[x,y,w,h] } | { poly }], slots:[...], tracks:[{ pts, w, role:'signal'|'clock'|'power'|'return' }],
   *            pads:[{ x, y, r }], vias:[{ x, y }], parts:[{ kind:'ic'|'xtal'|'conn'|'cap'|'res', x, y, w, h, label }],
   *            loop:{ poly } (oder loopPoly), defects:[{ x, y, text }] }
   *  o = { loopRel (Schleifenflaeche / Referenzflaeche: Helligkeit), t (ms, Puls hoechstens 0,8 Hz), reduced, plane (false: Flaeche ausblenden),
   *        marks (false: ohne Fehlermarken), found:[Index der gefundenen Fehler], quality, theme/palette }
   *  Rueckgabe false oder { scale, board:{x,y,w,h}, px(x, y) -> [X, Y], toWorld(X, Y) -> [x, y] } (Mindestgroesse 160 x 110). */
  function layoutBoard(ctx, rect, model, o) {
    if (!okCtx(ctx) || !rectMin(rect, 160, 110)) return false;
    model = obj(model); o = obj(o);
    const W = fin(model.w) && model.w > 0 ? model.w : 100, H = fin(model.h) && model.h > 0 ? model.h : 70;
    const P = pal(o), fs = fsz(rect.w), s = Math.min((rect.w - 12) / W, (rect.h - 12) / H);
    const bx = rect.x + (rect.w - W * s) / 2, by = rect.y + (rect.h - H * s) / 2;
    const px = (x, y) => [bx + x * s, by + y * s];
    const toWorld = (X, Y) => [(X - bx) / s, (Y - by) / s];
    const loopPoly = normPts(model.loop && model.loop.poly ? model.loop.poly : model.loopPoly, 3);
    const rel = fin(o.loopRel) ? cl(o.loopRel, 0, 3) : 1, t = afin(o.t) ? o.t : 0;
    const pulse = o.reduced === true ? 1 : 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.8 * t / 1000);
    return draw(ctx, () => {
      ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = P.platine; rrect(ctx, bx, by, W * s, H * s, 6); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); rrect(ctx, bx, by, W * s, H * s, 6); ctx.clip();
      // Masseflaeche (transparent tuerkis), Schlitze dunkel
      if (o.plane !== false) (Array.isArray(model.planes) ? model.planes : []).slice(0, 6).forEach(pl => {
        const pp = shapePts(pl); if (!pp) return;
        poly(ctx, pp.map(p => px(p[0], p[1])), true); ctx.fillStyle = P.flaeche; ctx.fill();
        ctx.strokeStyle = rgba(P.masse, 0.7); ctx.lineWidth = 1.2; setDash(ctx, [5, 4]); ctx.stroke(); setDash(ctx, NODASH);
      });
      (Array.isArray(model.slots) ? model.slots : []).slice(0, 6).forEach(sl => {
        const pp = shapePts(sl); if (!pp) return;
        poly(ctx, pp.map(p => px(p[0], p[1])), true); ctx.fillStyle = rgba('#000000', P.theme === 'light' ? 0.55 : 0.85); ctx.fill();
        ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.stroke();
      });
      // Schleifenflaeche (pulsierend, Helligkeit ~ Flaeche)
      if (loopPoly) {
        poly(ctx, loopPoly.map(p => px(p[0], p[1])), true);
        ctx.fillStyle = rgba(P.quelle, cl((0.1 + 0.3 * rel) * pulse, 0.05, 0.75)); ctx.fill();
        ctx.strokeStyle = rgba(P.quelle, 0.9); ctx.lineWidth = 1.8; setDash(ctx, [6, 4]); ctx.stroke(); setDash(ctx, NODASH);
      }
      // Bahnen
      const roleColor = { signal: P.kupfer, clock: P.hfeld, power: P.quelle, return: P.masse };
      (Array.isArray(model.tracks) ? model.tracks : []).slice(0, 40).forEach(tr => {
        tr = obj(tr); const pp = normPts(tr.pts, 2); if (!pp) return;
        ctx.strokeStyle = roleColor[tr.role] || P.kupfer; ctx.lineWidth = Math.max(2, (fin(tr.w) && tr.w > 0 ? tr.w : 0.4) * s); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        poly(ctx, pp.map(p => px(p[0], p[1])), false); ctx.stroke();
      });
      ctx.restore();
      (Array.isArray(model.vias) ? model.vias : []).slice(0, 60).forEach(v => { v = obj(v); if (!fin(v.x) || !fin(v.y)) return; const q = px(v.x, v.y); dot(ctx, q[0], q[1], Math.max(3, 0.5 * s), P.kupfer, null); dot(ctx, q[0], q[1], Math.max(1.4, 0.22 * s), P.platine, null); });
      (Array.isArray(model.pads) ? model.pads : []).slice(0, 60).forEach(p => { p = obj(p); if (!fin(p.x) || !fin(p.y)) return; const q = px(p.x, p.y); dot(ctx, q[0], q[1], Math.max(3, (fin(p.r) ? p.r : 0.7) * s), P.kupfer, null); });
      // Bauteile
      (Array.isArray(model.parts) ? model.parts : []).slice(0, 30).forEach(pt => {
        pt = obj(pt); if (!fin(pt.x) || !fin(pt.y) || !fin(pt.w) || !fin(pt.h) || !(pt.w > 0) || !(pt.h > 0)) return;
        const q = px(pt.x, pt.y), w = pt.w * s, h = pt.h * s, k = pt.kind;
        if (k === 'ic') {
          ctx.fillStyle = '#1b1f26'; ctx.fillRect(q[0], q[1], w, h); ctx.strokeStyle = P.schirm; ctx.lineWidth = 1.2; ctx.strokeRect(q[0], q[1], w, h);
          ctx.beginPath(); const np = Math.max(2, Math.floor(h / 6));
          for (let i = 0; i < np; i++) { const yy = q[1] + h * (i + 0.5) / np; ctx.moveTo(q[0] - 3, yy); ctx.lineTo(q[0], yy); ctx.moveTo(q[0] + w, yy); ctx.lineTo(q[0] + w + 3, yy); }
          ctx.stroke(); dot(ctx, q[0] + 4, q[1] + 4, 1.8, P.schirm, null);
        } else if (k === 'xtal') { ctx.fillStyle = P.schirm; rrect(ctx, q[0], q[1], w, h, Math.min(w, h) / 2.2); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.stroke(); }
        else if (k === 'conn') { ctx.fillStyle = P.panel2; ctx.fillRect(q[0], q[1], w, h); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.strokeRect(q[0], q[1], w, h); }
        else if (k === 'cap') { ctx.fillStyle = P.schutz; ctx.fillRect(q[0], q[1], w, h); ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.strokeRect(q[0], q[1], w, h); }
        else { ctx.fillStyle = '#c9b690'; ctx.fillRect(q[0], q[1], w, h); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(q[0], q[1], w, h); }
        if (typeof pt.label === 'string' && pt.label) lab(ctx, pt.label, q[0] + w / 2, q[1] + h + fs * 0.9, 'center', fs, P.fg, rgba(P.bg, 0.8), false, Math.max(40, w * 2.5));
      });
      // Fehlermarken
      if (o.marks !== false) (Array.isArray(model.defects) ? model.defects : []).slice(0, 12).forEach((d, i) => {
        d = obj(d); if (!fin(d.x) || !fin(d.y)) return; const q = px(d.x, d.y), found = Array.isArray(o.found) && o.found.indexOf(i) >= 0;
        dot(ctx, q[0], q[1], 11, rgba(found ? P.gruen : P.rot, 0.25), found ? P.gruen : P.rot, 2.4);
        sym(ctx, found ? 'check' : 'warn', q[0], q[1], 13, found ? P.gruen : P.rot, 2);
        if (found && typeof d.text === 'string' && d.text) lab(ctx, d.text, cl(q[0], bx + 60, bx + W * s - 60), q[1] - 18, 'center', fs, P.fg, rgba(P.bg, 0.88), true, W * s * 0.6);
      });
      return { scale: s, board: { x: bx, y: by, w: W * s, h: H * s }, px, toWorld };
    });
  }

  /* ----------------------------------------------------------------- Gehaeuse im Schnitt */
  /* Helligkeit der Wellenfronten hinter dem Schirm aus der Schirmdaempfung: 1 bei 0 dB, 0,06 ... bei grosser SE (monoton fallend) */
  function shieldBrightness(seDb) { return afin(seDb) ? cl(0.06 + 0.94 * Math.pow(10, -Math.max(0, seDb) / 40), 0.06, 1) : 1; }
  /* shieldBox(ctx, rect, o): Gehaeuse im Schnitt mit Schlitz, Loechern und Kabeldurchfuehrung; Wellenfronten von links.
   *  o = { se (dB gesamt: Helligkeit innen), slot (Schlitzlaenge mm, 0 = keiner), holes (Anzahl), kabel:'360'|'pigtail', lp (Litzenlaenge mm), thickness (mm),
   *        t (ms), reduced, quality, theme/palette, labels (false) }
   *  Rueckgabe false oder { inner:{x,y,w,h}, slot:{x0,x1,y}|null, cable:[[x,y]...], pigtail:[[x,y]...]|null, bright } (Mindestgroesse 200 x 120). */
  function shieldBox(ctx, rect, o) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 120)) return false;
    o = obj(o); const P = pal(o), Q = qualityOf(o), fs = fsz(rect.w);
    const se = fin(o.se) ? o.se : 40, slotMm = nz(o, 'slot', 0, 0, 500), holes = Math.round(nz(o, 'holes', 0, 0, 100)), pig = o.kabel === 'pigtail', lp = nz(o, 'lp', 30, 0, 300);
    const wall = cl(2.5 + nz(o, 'thickness', 0.5, 0, 3) * 2.2, 3, 10);
    const bw = rect.w * 0.52, bh = Math.min(rect.h * 0.62, bw * 0.75), bx = rect.x + rect.w * 0.34, by = rect.y + (rect.h - bh) / 2 - 4;
    const bright = shieldBrightness(se), t = afin(o.t) ? o.t : 0, ph = o.reduced === true ? 0.3 : (t / 1000 * 0.4) % 1;
    const slotW = slotMm > 0 ? cl(slotMm / 200 * bw, 6, bw * 0.8) : 0, sx0 = bx + (bw - slotW) / 2;
    const cableY = by + bh * 0.7;
    return draw(ctx, () => {
      ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      // Wellenfronten aussen (von links), innen gedaempft
      ctx.lineCap = 'round'; ctx.lineWidth = 2;
      const gapX = 22, n = Math.floor((bx - rect.x - 8) / gapX);
      for (let i = 0; i < n; i++) {
        const x = rect.x + 8 + ((i + ph) % n) * gapX, fade = 0.35 + 0.65 * ((i + ph) / n);
        ctx.strokeStyle = rgba(P.efeld, 0.85 * fade); ctx.beginPath(); ctx.moveTo(x, by - 6); ctx.quadraticCurveTo(x + 6, by + bh / 2, x, by + bh + 6); ctx.stroke();
      }
      const ni = Math.max(1, Math.floor((bw - 2 * wall) / gapX));
      for (let i = 0; i < ni; i++) {
        const x = bx + wall + 6 + ((i + ph) % ni) * gapX;
        ctx.strokeStyle = rgba(P.efeld, 0.85 * bright); ctx.beginPath(); ctx.moveTo(x, by + wall + 4); ctx.quadraticCurveTo(x + 5, by + bh / 2, x, by + bh - wall - 4); ctx.stroke();
      }
      // Leckbogen durch den Schlitz (Faustformel-Symbolik): Bogen innen unter dem Schlitz
      if (slotW > 0) {
        for (let k = 1; k <= 3; k++) { ctx.strokeStyle = rgba(P.rot, (0.9 - 0.22 * k) * (o.reduced === true ? 0.8 : 1)); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx + bw / 2, by + wall, slotW * 0.28 * k + 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
      }
      // Gehaeuse: Schirm grau-metall
      ctx.fillStyle = P.schirm;
      ctx.fillRect(bx, by, wall, bh); ctx.fillRect(bx, by + bh - wall, bw, wall);
      if (slotW > 0) { ctx.fillRect(bx, by, sx0 - bx, wall); ctx.fillRect(sx0 + slotW, by, bx + bw - sx0 - slotW, wall); } else ctx.fillRect(bx, by, bw, wall);
      // rechte Wand mit Loechern
      const nh = Math.min(holes, 10);
      if (nh > 0) {
        const hd = cl(nz(o, 'dhole', 5, 1, 20) * bh / 150, 4, 12), seg = (bh - 2 * wall) / (nh + 1);
        let yy = by; ctx.fillRect(bx + bw - wall, by, wall, wall);
        for (let i = 0; i < nh; i++) { const cy2 = by + wall + seg * (i + 1); ctx.fillRect(bx + bw - wall, yy, wall, Math.max(0, cy2 - hd / 2 - yy)); yy = cy2 + hd / 2; }
        ctx.fillRect(bx + bw - wall, yy, wall, Math.max(0, by + bh - yy));
        ctx.strokeStyle = rgba(P.efeld, 0.8 * bright); ctx.lineWidth = 1.6; for (let i = 0; i < nh; i++) { const cy2 = by + wall + seg * (i + 1); ctx.beginPath(); ctx.moveTo(bx + bw - wall - 6, cy2); ctx.lineTo(bx + bw + 8, cy2); ctx.stroke(); }
      } else ctx.fillRect(bx + bw - wall, by, wall, bh);
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1; setDash(ctx, NODASH); ctx.strokeRect(bx, by, bw, bh);
      // Elektronik innen
      const ex = bx + bw * 0.28, ey = by + bh * 0.3, ew = bw * 0.32, eh = bh * 0.3;
      ctx.fillStyle = P.platine; ctx.fillRect(ex, ey, ew, eh); ctx.strokeStyle = P.masse; ctx.lineWidth = 1.2; ctx.strokeRect(ex, ey, ew, eh);
      ctx.fillStyle = '#1b1f26'; ctx.fillRect(ex + ew * 0.3, ey + eh * 0.25, ew * 0.4, eh * 0.5);
      // Kabel: 360 Grad (Schirmring rundum) gegen Pigtail (Litze)
      const cablePts = [[rect.x + 6, cableY], [bx + bw - 1, cableY], [ex + ew, cableY], [ex + ew, ey + eh]];
      ctx.strokeStyle = P.senke; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(rect.x + 6, cableY); ctx.lineTo(bx + wall, cableY); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx + wall, cableY); ctx.lineTo(ex + ew * 0.5, cableY); ctx.lineTo(ex + ew * 0.5, ey + eh); ctx.stroke();
      let pigPts = null;
      ctx.fillStyle = P.schirm; ctx.fillRect(bx - 8, cableY - 9, wall + 8, 18);
      if (!pig) { ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.strokeRect(bx - 8, cableY - 9, wall + 8, 18); }
      else {
        const L = cl(lp * 0.9, 4, bw * 0.45);
        pigPts = [[bx - 18, cableY], [bx - 18 - L * 0.3, cableY - 24], [bx - 18 - L * 0.7, cableY - 24], [bx - 8, cableY - 9]];
        ctx.strokeStyle = P.hfeld; ctx.lineWidth = 2.4; poly(ctx, pigPts, false); ctx.stroke();
      }
      if (o.labels !== false) {
        lab(ctx, 'SE = ' + fz(se, 1) + ' dB', bx + bw / 2, by + bh + fs * 1.6, 'center', fs, P.fg, rgba(P.bg, 0.85), true);
        lab(ctx, 'außen', rect.x + 8, by - fs * 0.9, 'left', fs, P.efeld, null, true);
        lab(ctx, 'innen', bx + wall + 8, by + bh - wall - fs, 'left', fs, rgba(P.efeld, 1), null, true);
        lab(ctx, pig ? 'Pigtail ' + fz(lp, 0) + ' mm' : 'Schirm 360°', bx - 14, cableY + 20, 'right', fs, P.hfeld, rgba(P.bg, 0.85), true, bx - rect.x - 20);
        if (slotW > 0) lab(ctx, 'Schlitz ' + fz(slotMm, 0) + ' mm', bx + bw / 2, by - fs * 1.1, 'center', fs, P.rot, rgba(P.bg, 0.85), true);
        if (nh > 0) lab(ctx, holes + ' Löcher', bx + bw + 6, by + bh / 2, 'left', fs, P.fg, rgba(P.bg, 0.85), false, rect.x + rect.w - bx - bw - 8);
      }
      void Q;
      return { inner: { x: bx + wall, y: by + wall, w: bw - 2 * wall, h: bh - 2 * wall }, slot: slotW > 0 ? { x0: sx0, x1: sx0 + slotW, y: by + wall / 2 } : null, cable: cablePts, pigtail: pigPts, bright };
    });
  }

  /* ----------------------------------------------------------------- Leitung */
  /* cable(ctx, pts, o): Leitung entlang der Polylinie pts. o = { shield (Schirmgeflecht, Erdsymbole), earth:'both'|'start'|'end'|'none' (Vorgabe both),
   *  twisted (Zopf), pair (zwei parallele Adern), color, width (px), phase (Verdrillung wandert nicht, nur Zopf-Versatz), theme/palette } */
  function cable(ctx, pts, o) {
    if (!okCtx(ctx)) return false;
    const p = normPts(pts, 2); if (!p || !(polyLen(p) > 4)) return false;
    o = obj(o); const P = pal(o), w = nz(o, 'width', 4, 1, 40), col = goodColor(o.color) ? o.color : P.senke, len = polyLen(p);
    return draw(ctx, () => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (o.shield === true) {
        ctx.strokeStyle = P.schirm; ctx.lineWidth = w * 2.6 + 4; poly(ctx, p, false); ctx.stroke();
        ctx.strokeStyle = P.bg; ctx.lineWidth = w * 2.6 + 1; poly(ctx, p, false); ctx.stroke();
        ctx.strokeStyle = rgba(P.schirm, 0.9); ctx.lineWidth = w * 2.6 + 1; setDash(ctx, [3, 3]); poly(ctx, p, false); ctx.stroke(); setDash(ctx, NODASH);
      }
      // Punkt auf der Polylinie bei Abstand d (Position und Normale)
      const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      const at = d => { let i = 1; while (i < p.length - 1 && cum[i] < d) i++; const a = p[i - 1], b = p[i], sg = (cum[i] - cum[i - 1]) || 1, u = cl((d - cum[i - 1]) / sg, 0, 1), L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, -(b[1] - a[1]) / L, (b[0] - a[0]) / L]; };
      if (o.twisted === true) {
        const N = Math.min(160, Math.max(12, Math.floor(len / 3))), per = Math.max(14, w * 4), amp = w * 0.95;
        for (let k = 0; k < 2; k++) {
          ctx.strokeStyle = k ? mix(col, P.fg, 0.55) : col; ctx.lineWidth = Math.max(1.6, w * 0.55); ctx.beginPath();
          for (let i = 0; i <= N; i++) { const q = at(len * i / N), s = Math.sin(2 * Math.PI * (len * i / N) / per + k * Math.PI) * amp; if (i) ctx.lineTo(q[0] + q[2] * s, q[1] + q[3] * s); else ctx.moveTo(q[0] + q[2] * s, q[1] + q[3] * s); }
          ctx.stroke();
        }
      } else if (o.pair === true) {
        for (let k = -1; k <= 1; k += 2) {
          ctx.strokeStyle = k < 0 ? col : mix(col, P.fg, 0.55); ctx.lineWidth = Math.max(1.6, w * 0.6); ctx.beginPath();
          for (let i = 0; i < p.length; i++) { const q = at(cum[i]), off = k * w * 0.7; if (i) ctx.lineTo(q[0] + q[2] * off, q[1] + q[3] * off); else ctx.moveTo(q[0] + q[2] * off, q[1] + q[3] * off); }
          ctx.stroke();
        }
      } else { ctx.strokeStyle = col; ctx.lineWidth = w; poly(ctx, p, false); ctx.stroke(); }
      if (o.shield === true && o.earth !== 'none') {
        const e = o.earth === 'start' || o.earth === 'end' ? o.earth : 'both', r = Math.max(8, w * 2.4);
        if (e !== 'end') { const a = p[0], b = p[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; sym(ctx, 'earth', a[0] - (b[0] - a[0]) / L * 0 + (b[1] - a[1]) / L * r * 1.9, a[1] - (b[0] - a[0]) / L * r * 1.9, r, P.masse, 1.8); }
        if (e !== 'start') { const a = p[p.length - 1], b = p[p.length - 2], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; sym(ctx, 'earth', a[0] + (b[1] - a[1]) / L * r * 1.9, a[1] - (b[0] - a[0]) / L * r * 1.9, r, P.masse, 1.8); }
      }
    });
  }

  /* ----------------------------------------------------------------- ESD-Pistole */
  /* gun(ctx, x, y, o): ESD-Pistole, (x, y) = Spitze. o = { angle (rad, Richtung Spitze -> Griff, Vorgabe 0,6 = rechts oben), size (Laenge px, Vorgabe 120),
   *  spark (ms seit der Entladung; nur 0...200 ms leuchtet, einmalig), target:{x, y} (Ziel des Lichtbogens), seed, reduced (kein Funke, nur Symbol), theme/palette } */
  function gun(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), a = afin(o.angle) ? o.angle : 0.6, size = nz(o, 'size', 120, 40, 600), ux = Math.cos(a), uy = -Math.sin(a), nx = -uy, ny = ux;
    const sp = fin(o.spark) && o.spark >= 0 ? o.spark : -1, b = sp >= 0 && sp <= 200 ? 1 - sp / 200 : 0, tg = obj(o.target);
    const T = (d, s) => [x + ux * d + nx * s, y + uy * d + ny * s];
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      // Spitze, Konus, Koerper, Griff
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); const t0 = T(0, 0), t1 = T(size * 0.12, 0); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
      poly(ctx, [T(size * 0.12, -2), T(size * 0.38, -size * 0.1), T(size * 0.38, size * 0.1), T(size * 0.12, 2)], true); ctx.fillStyle = P.schirm; ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; ctx.stroke();
      poly(ctx, [T(size * 0.38, -size * 0.1), T(size * 0.95, -size * 0.11), T(size * 0.95, size * 0.11), T(size * 0.38, size * 0.1)], true); ctx.fillStyle = P.panel2; ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.schutz; poly(ctx, [T(size * 0.55, -size * 0.11), T(size * 0.64, -size * 0.11), T(size * 0.64, size * 0.11), T(size * 0.55, size * 0.11)], true); ctx.fill();
      const lp = T(size * 0.98, size * 0.22);
      lab(ctx, 'ESD-Pistole', lp[0], lp[1], 'center', nz(o, 'fs', 12, 11, 24), P.fg, rgba(P.bg, 0.85), true);
      if (b > 0 && o.reduced !== true) {
        // einmalige Aufhellung (<= 200 ms), Lichtbogen aus Segmenten mit Zufall aus dem Seed
        const rnd = rng((fin(o.seed) ? o.seed : 1) + Math.floor(sp / 70));
        if (typeof ctx.createRadialGradient === 'function' && qualityOf(o).gradients) {
          const g = ctx.createRadialGradient(x, y, 1, x, y, 34); g.addColorStop(0, rgba('#ffffff', 0.7 * b)); g.addColorStop(1, rgba('#ffffff', 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
        } else { ctx.fillStyle = rgba('#ffffff', 0.3 * b); ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fill(); }
        if (fin(tg.x) && fin(tg.y)) {
          const dx = tg.x - x, dy = tg.y - y, L = Math.hypot(dx, dy) || 1, N = Math.max(3, Math.min(14, Math.floor(L / 10))), pts = [[x, y]];
          for (let i = 1; i < N; i++) { const u = i / N, j = (rnd() - 0.5) * 14; pts.push([x + dx * u - dy / L * j, y + dy * u + dx / L * j]); }
          pts.push([tg.x, tg.y]);
          ctx.strokeStyle = rgba(P.senke, 0.5 * b); ctx.lineWidth = 6; poly(ctx, pts, false); ctx.stroke();
          ctx.strokeStyle = rgba('#ffffff', Math.min(1, 0.4 + b)); ctx.lineWidth = 2; poly(ctx, pts, false); ctx.stroke();
        }
      } else if (sp >= 0 && o.reduced === true) {
        sym(ctx, 'bolt', x - 14 * ux + 4, y - 14 * uy - 12, 14, P.hfeld, 2);
        lab(ctx, 'Entladung', x - 14 * ux - 12, y - 14 * uy - 30, 'center', nz(o, 'fs', 12, 11, 24), P.hfeld, rgba(P.bg, 0.85), true);
      }
    });
  }

  /* ----------------------------------------------------------------- Tastkopf */
  const LEADS = { klemme: 150, kurz: 50, feder: 12 };
  /* probeScene(ctx, rect, o): Platine mit Signalleitung, Tastkopf, Masseleitung als Schleife (Flaeche gefuellt), Nachbarleiter mit Feldlinien.
   *  o = { lead:'klemme'|'kurz'|'feder' (oder leadMm), loopRel (Schleifenflaeche relativ, Fuellung), pick (0..1: Zahl der Feldlinien durch die Schleife),
   *        phase, reduced, theme/palette }. Rueckgabe false oder { loop:[[x,y]...], leadMm, lines } (Mindestgroesse 200 x 120). */
  function probeScene(ctx, rect, o) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 120)) return false;
    o = obj(o); const P = pal(o), fs = fsz(rect.w);
    const mm = fin(o.leadMm) && o.leadMm > 0 ? o.leadMm : (LEADS[o.lead] || LEADS.klemme), rel = fin(o.loopRel) ? cl(o.loopRel, 0, 3) : cl(mm / 150, 0.05, 1), pick = nz(o, 'pick', 0.5, 0, 1);
    const ph = o.reduced === true ? 0 : (afin(o.phase) ? o.phase : 0);
    const lines = Math.round(pick * 6);
    const bx = rect.x + 6, by = rect.y + rect.h * 0.34, bw = rect.w - 12, bh = rect.h * 0.62;
    const sigY = by + bh * 0.46, gndY = by + bh * 0.86, tipX = rect.x + rect.w * 0.42, Lw = cl(mm / 150, 0.1, 1) * rect.w * 0.34 + 10, gX = tipX + Lw;
    const loop = [[tipX, sigY], [tipX + 18, sigY - 34 * Math.max(0.35, rel)], [gX - 10, sigY - 34 * Math.max(0.35, rel)], [gX, gndY], [tipX, gndY]];
    return draw(ctx, () => {
      ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.fillStyle = P.platine; rrect(ctx, bx, by, bw, bh, 6); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.2; ctx.stroke();
      // Leiterbahnen: Signal und Masse
      ctx.lineCap = 'round'; ctx.strokeStyle = P.kupfer; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + 8, sigY); ctx.lineTo(bx + bw - 8, sigY); ctx.stroke();
      ctx.strokeStyle = P.masse; ctx.beginPath(); ctx.moveTo(bx + 8, gndY); ctx.lineTo(bx + bw - 8, gndY); ctx.stroke();
      // Nachbarleiter oben mit Feldlinien (gelb-orange, gestrichelt, wandern)
      const nY = rect.y + rect.h * 0.1, nX = tipX + Lw * 0.6;
      ctx.strokeStyle = P.quelle; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx + 8, nY); ctx.lineTo(bx + bw - 8, nY); ctx.stroke();
      dot(ctx, nX, nY, 8, P.bg, P.quelle, 2); sym(ctx, 'dotout', nX, nY, 12, P.quelle, 1.8);
      for (let i = 1; i <= lines; i++) {
        const r = 14 + i * Math.min(20, (gndY - nY) / (lines + 2));
        ctx.strokeStyle = rgba(P.hfeld, 0.9); ctx.lineWidth = 1.6; setDash(ctx, [6, 5], -ph * 22); ctx.beginPath(); ctx.arc(nX, nY, r, 0.05 * Math.PI, 0.95 * Math.PI); ctx.stroke(); setDash(ctx, NODASH);
      }
      // Schleifenflaeche (gefuellt)
      poly(ctx, loop, true); ctx.fillStyle = rgba(P.senke, cl(0.12 + 0.3 * rel, 0.08, 0.7)); ctx.fill();
      ctx.strokeStyle = P.senke; ctx.lineWidth = 1.6; setDash(ctx, [5, 4]); ctx.stroke(); setDash(ctx, NODASH);
      // Masseleitung als Draht (Klemme: lang, Feder: kurz) und Tastkopf
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(tipX + 18, sigY - 34 * Math.max(0.35, rel)); ctx.lineTo(gX - 10, sigY - 34 * Math.max(0.35, rel)); ctx.lineTo(gX, gndY); ctx.stroke();
      poly(ctx, [[tipX, sigY], [tipX + 10, sigY - 18], [tipX + 32, sigY - 30], [tipX + 22, sigY - 10]], true); ctx.fillStyle = P.schirm; ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; ctx.stroke();
      const bodyA = [tipX + 24, sigY - 28]; ctx.strokeStyle = P.panel2; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(bodyA[0], bodyA[1]); ctx.lineTo(bx + bw * 0.62, rect.y + rect.h * 0.22 - 2); ctx.stroke();
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bodyA[0], bodyA[1] - 6); ctx.lineTo(bx + bw * 0.62, rect.y + rect.h * 0.22 - 8); ctx.stroke();
      dot(ctx, tipX, sigY, 3.5, P.fg, null); dot(ctx, gX, gndY, 4.5, P.fg, null);
      lab(ctx, 'Masseleitung ' + fz(mm, 0) + ' mm', bx + 10, gndY + fs * 1.4, 'left', fs, P.fg, rgba(P.bg, 0.85), true, bw - 20);
      lab(ctx, 'Schleifenfläche', tipX + Lw * 0.5, sigY - 34 * Math.max(0.35, rel) - fs * 1.2, 'center', fs, P.senke, rgba(P.bg, 0.85), true);
      lab(ctx, 'Nachbarleiter', bx + 10, nY + fs * 1.3, 'left', fs, P.quelle, rgba(P.bg, 0.85), true);
      return { loop, leadMm: mm, lines };
    });
  }

  /* ----------------------------------------------------------------- Netznachbildung, Geraet, Filterschaltbild */
  /* lisn(ctx, x, y, o): Netznachbildung (V-Netznachbildung, vereinfacht), (x, y) links oben. o = { w, h, active (Messausgang aktiv), theme/palette } */
  function lisn(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), w = nz(o, 'w', 132, 90, 600), h = nz(o, 'h', 64, 44, 300), fs = nz(o, 'fs', 12, 11, 24);
    return draw(ctx, () => {
      ctx.fillStyle = P.panel2; rrect(ctx, x, y, w, h, 7); ctx.fill(); ctx.strokeStyle = P.senke; ctx.lineWidth = 1.8; ctx.stroke();
      lab(ctx, 'Netznachbildung', x + w / 2, y + fs * 0.95, 'center', fs, P.senke, null, true, w - 8);
      lab(ctx, '50 Ω ∥ 50 µH', x + w / 2, y + h * 0.55, 'center', fs, P.fg, null, false, w - 8);
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 10, y + h * 0.3); ctx.lineTo(x, y + h * 0.3); ctx.moveTo(x - 10, y + h * 0.78); ctx.lineTo(x, y + h * 0.78);
      ctx.moveTo(x + w, y + h * 0.3); ctx.lineTo(x + w + 10, y + h * 0.3); ctx.moveTo(x + w, y + h * 0.78); ctx.lineTo(x + w + 10, y + h * 0.78); ctx.stroke();
      const ox = x + w * 0.5; ctx.strokeStyle = o.active === false ? P.mute : P.hfeld; ctx.beginPath(); ctx.moveTo(ox, y + h); ctx.lineTo(ox, y + h + 10); ctx.stroke();
      dot(ctx, ox, y + h + 13, 3.5, o.active === false ? P.mute : P.hfeld, null);
      lab(ctx, 'Messausgang 50 Ω', ox + 8, y + h + 13, 'left', fs, P.mute, null, false);
    });
  }
  /* device(ctx, x, y, w, h, o): Geraet mit Statusanzeige. o = { status:'ok'|'reset'|'defekt'|'grau', t (ms), reduced, label, resets, glitches, theme/palette } */
  function device(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || !(w >= 40) || !(h >= 30)) return false;
    o = obj(o); const P = pal(o), fs = nz(o, 'fs', 12, 11, 24), st = o.status === 'reset' || o.status === 'defekt' || o.status === 'grau' ? o.status : 'ok';
    const col = st === 'ok' ? P.gruen : st === 'reset' ? P.gelb : st === 'defekt' ? P.rot : P.grau, name = st === 'ok' ? 'Läuft' : st === 'reset' ? 'Neustart' : st === 'defekt' ? 'Defekt' : 'Aus';
    const t = afin(o.t) ? o.t : 0;
    return draw(ctx, () => {
      ctx.fillStyle = P.panel; rrect(ctx, x, y, w, h, 8); ctx.fill(); ctx.strokeStyle = P.schirm; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = P.platine; ctx.fillRect(x + w * 0.08, y + h * 0.42, w * 0.5, h * 0.4); ctx.fillStyle = '#1b1f26'; ctx.fillRect(x + w * 0.2, y + h * 0.52, w * 0.22, h * 0.2);
      // Status-LED mit Symbol (nicht nur Farbe)
      const lx = x + w - Math.min(26, w * 0.2), ly = y + Math.min(22, h * 0.26), lr = Math.min(11, w * 0.1);
      dot(ctx, lx, ly, lr, col, P.fg, 1.6);
      if (st === 'ok') sym(ctx, 'check', lx, ly, lr * 1.5, P.bg, 2);
      else if (st === 'defekt') sym(ctx, 'cross', lx, ly, lr * 1.5, P.bg, 2);
      else if (st === 'reset') { ctx.strokeStyle = P.bg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(lx, ly, lr * 0.55, 0.4, Math.PI * 1.7); ctx.stroke(); }
      else sym(ctx, 'dash', lx, ly, lr * 1.5, P.bg, 2);
      lab(ctx, typeof o.label === 'string' && o.label ? o.label : 'Prüfling', x + 8, y + fs * 1.1, 'left', fs, P.fg, null, true, w - 44);
      lab(ctx, name, x + w - 8, y + h - fs * 1.1, 'right', fs, col, rgba(P.bg, 0.8), true, w - 16);
      if (st === 'defekt') {     /* Rauchzeichen: ruhig (< 1 Hz), kein Blinken */
        ctx.strokeStyle = rgba(P.mute, 0.8); ctx.lineWidth = 2; ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) { const sx = x + w * (0.3 + 0.12 * k), ph = o.reduced === true ? 0 : (t / 1800 + k * 0.33) % 1; ctx.beginPath(); ctx.moveTo(sx, y + h * 0.4 - ph * 6); ctx.bezierCurveTo(sx - 6, y + h * 0.3 - ph * 6, sx + 6, y + h * 0.2 - ph * 6, sx, y + h * 0.1 - ph * 6); ctx.stroke(); }
      }
      if (fin(o.resets) || fin(o.glitches)) lab(ctx, (fin(o.resets) ? 'Neustarts ' + Math.round(o.resets) : '') + (fin(o.resets) && fin(o.glitches) ? ' · ' : '') + (fin(o.glitches) ? 'Fehler ' + Math.round(o.glitches) : ''), x + w / 2, y + h + fs * 1.1, 'center', fs, P.fg, null, false, w + 40);
    });
  }
  /* filterSchematic(ctx, rect, cfg, o): Netzfilter-Schaltbild mit Bauteilwerten; Rueckgabe { geo:{ L, N, E } (Pfade fuer Partikel) }.
   *  cfg = { topo:'kein'|'C'|'LC'|'pi', cx, cy, drossel (Text oder H), ld, ferrit } (Werte als Text oder SI-Zahl); o = { mode:'GT'|'GG' (Pfeile: Gleichtakt
   *  beide Leitungen gleich, Gegentakt gegenlaeufig), theme/palette }. Mindestgroesse 200 x 100. */
  function filterGeo(rect) {
    const x0 = rect.x + 14, x1 = rect.x + rect.w - 14, yL = rect.y + rect.h * 0.28, yN = rect.y + rect.h * 0.5, yE = rect.y + rect.h * 0.86;
    return { x0, x1, yL, yN, yE, W: x1 - x0, L: [[x0, yL], [x1, yL]], N: [[x0, yN], [x1, yN]], E: [[x0, yE], [x1, yE]] };
  }
  /* filterPaths(rect, mode, o): Pfade fuer createParticles passend zu filterSchematic (rect gleich): Gleichtakt ('GT'): L und N gleich gerichtet, Rueckweg ueber PE
   *  (entgegengesetzt); Gegentakt ('GG'): N gegenlaeufig zu L. o = { rate (0..1), palette/theme }. Rueckgabe null bei zu kleinem Rechteck. */
  function filterPaths(rect, mode, o) {
    if (!rectMin(rect, 200, 100)) return null;
    o = obj(o); const P = pal(o), g = filterGeo(rect), r = nz(o, 'rate', 1, 0, 1);
    const out = [{ id: 'L', pts: g.L, dir: 1, rate: r, color: P.quelle }, { id: 'N', pts: g.N, dir: mode === 'GG' ? -1 : 1, rate: r, color: P.senke }];
    if (mode !== 'GG') out.push({ id: 'E', pts: g.E, dir: -1, rate: r, color: P.masse });
    return out;
  }
  function filterSchematic(ctx, rect, cfg, o) {
    if (!okCtx(ctx) || !rectMin(rect, 200, 100)) return false;
    cfg = obj(cfg); o = obj(o); const P = pal(o), fs = fsz(rect.w);
    const topo = cfg.topo === 'C' || cfg.topo === 'LC' || cfg.topo === 'pi' ? cfg.topo : 'kein';
    const G = filterGeo(rect), x0 = G.x0, x1 = G.x1, yL = G.yL, yN = G.yN, yE = G.yE, W = G.W;
    const hasChoke = (topo === 'LC' || topo === 'pi') && cfg.drossel !== 'ohne' && cfg.drossel !== undefined && cfg.drossel !== null;
    const cxTxt = cfg.cx === undefined || cfg.cx === 0 ? '' : engU(cfg.cx, 'F'), cyTxt = cfg.cy === undefined || cfg.cy === 0 ? '' : engU(cfg.cy, 'F');
    const drTxt = hasChoke ? engU(cfg.drossel, 'H') : '', ldTxt = fin(cfg.ld) && cfg.ld > 0 ? engU(cfg.ld, 'H') : typeof cfg.ld === 'string' && cfg.ld && !/^0/.test(cfg.ld) ? cfg.ld : '';
    const geo = { L: G.L, N: G.N, E: G.E };
    return draw(ctx, () => {
      ctx.fillStyle = P.bg; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.4;
      ctx.strokeStyle = P.quelle; ctx.beginPath(); ctx.moveTo(x0, yL); ctx.lineTo(x1, yL); ctx.stroke();
      ctx.strokeStyle = P.senke; ctx.beginPath(); ctx.moveTo(x0, yN); ctx.lineTo(x1, yN); ctx.stroke();
      ctx.strokeStyle = P.masse; ctx.beginPath(); ctx.moveTo(x0, yE); ctx.lineTo(x1, yE); ctx.stroke();
      lab(ctx, 'L', x0 + 2, yL - fs, 'left', fs, P.quelle, null, true); lab(ctx, 'N', x0 + 2, yN + fs * 1.1, 'left', fs, P.senke, null, true); lab(ctx, 'PE', x0 + 2, yE + fs * 1.1, 'left', fs, P.masse, null, true);
      lab(ctx, 'Gerät', x0 + W * 0.04, rect.y + fs, 'left', fs, P.mute, null, true); lab(ctx, 'Netznachbildung', x1, rect.y + fs, 'right', fs, P.mute, null, true, W * 0.45);
      const capX = (x, txt, tag) => {
        ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x, yL); ctx.lineTo(x, yL + (yN - yL) / 2 - 3); ctx.moveTo(x - 9, yL + (yN - yL) / 2 - 3); ctx.lineTo(x + 9, yL + (yN - yL) / 2 - 3);
        ctx.moveTo(x - 9, yL + (yN - yL) / 2 + 3); ctx.lineTo(x + 9, yL + (yN - yL) / 2 + 3); ctx.moveTo(x, yL + (yN - yL) / 2 + 3); ctx.lineTo(x, yN); ctx.stroke();
        dot(ctx, x, yL, 2.6, P.quelle, null); dot(ctx, x, yN, 2.6, P.senke, null);
        if (txt) lab(ctx, tag + ' ' + txt, x + 12, yL + (yN - yL) / 2, 'left', fs, P.schutz, rgba(P.bg, 0.85), true, W * 0.3);
      };
      const capY = (x, yy, txt) => {
        ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.2; const m = yN + (yE - yN) * 0.5; ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x, m - 3); ctx.moveTo(x - 8, m - 3); ctx.lineTo(x + 8, m - 3);
        ctx.moveTo(x - 8, m + 3); ctx.lineTo(x + 8, m + 3); ctx.moveTo(x, m + 3); ctx.lineTo(x, yE); ctx.stroke(); dot(ctx, x, yy, 2.6, P.fg, null); dot(ctx, x, yE, 2.6, P.masse, null);
        if (txt) lab(ctx, 'Cy ' + txt, x + 11, m, 'left', fs, P.schutz, rgba(P.bg, 0.85), true, W * 0.25);
      };
      const coil = (xa, xb, y) => { const n = 4, r = (xb - xa) / n / 2; ctx.beginPath(); ctx.moveTo(xa, y); for (let i = 0; i < n; i++) ctx.arc(xa + r + i * 2 * r, y, r, Math.PI, 0, false); ctx.stroke(); };
      if (topo !== 'kein') {
        if (topo === 'C') { if (cxTxt) capX(x0 + W * 0.5, cxTxt, 'Cx'); }
        else {
          if (topo === 'pi' && cxTxt) capX(x0 + W * 0.22, cxTxt, 'Cx');
          if (hasChoke) {
            const a = x0 + W * 0.36, b = x0 + W * 0.56; ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.4;
            ctx.strokeStyle = P.bg; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a, yL); ctx.lineTo(b, yL); ctx.moveTo(a, yN); ctx.lineTo(b, yN); ctx.stroke();
            ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.4; coil(a, b, yL); coil(a, b, yN);
            ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(a, yL + (yN - yL) / 2 - 2); ctx.lineTo(b, yL + (yN - yL) / 2 - 2); ctx.moveTo(a, yL + (yN - yL) / 2 + 2); ctx.lineTo(b, yL + (yN - yL) / 2 + 2); ctx.stroke();
            lab(ctx, 'Drossel ' + drTxt, (a + b) / 2, yN + (yE - yN) * 0.28, 'center', fs, P.schutz, rgba(P.bg, 0.85), true, W * 0.35);
          }
          if (ldTxt) { ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.4; const a = x0 + W * 0.6, b = x0 + W * 0.74; ctx.strokeStyle = P.bg; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(a, yL); ctx.lineTo(b, yL); ctx.stroke(); ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.4; coil(a, b, yL); lab(ctx, 'Ld ' + ldTxt, (a + b) / 2, yL - fs, 'center', fs, P.schutz, rgba(P.bg, 0.85), true, W * 0.25); }
          if (cxTxt) capX(x0 + W * (topo === 'pi' ? 0.82 : 0.78), topo === 'pi' ? '' : cxTxt, 'Cx');
        }
        if (cyTxt) { capY(x0 + W * 0.7, yN, cyTxt); ctx.strokeStyle = P.schutz; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x0 + W * 0.7, yN); ctx.lineTo(x0 + W * 0.7, yN); ctx.stroke(); }
      }
      if (cfg.ferrit === true) {
        ctx.fillStyle = rgba(P.schirm, 0.55); rrect(ctx, x0 + W * 0.08, yL - 9, W * 0.08, yN - yL + 18, 5); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 1.2; ctx.stroke();
        lab(ctx, 'Ferrit', x0 + W * 0.12, yN + 22 + fs * 0.4, 'center', fs, P.fg, rgba(P.bg, 0.85), true);
      }
      // Stromrichtung: Gleichtakt = beide Leitungen gleich, Gegentakt = gegenlaeufig
      if (o.mode === 'GT' || o.mode === 'GG') {
        const ax = x0 + W * 0.9, dirL = 1, dirN = o.mode === 'GT' ? 1 : -1;
        arrowRaw(ctx, ax - dirL * 12, yL - 8, ax + dirL * 12, yL - 8, 9, P.quelle, 2.4, null);
        arrowRaw(ctx, ax - dirN * 12, yN + 9, ax + dirN * 12, yN + 9, 9, P.senke, 2.4, null);
        lab(ctx, o.mode === 'GT' ? 'Gleichtakt: beide gleich' : 'Gegentakt: gegenläufig', x1 - 4, rect.y + rect.h - 6, 'right', fs, P.fg, rgba(P.bg, 0.85), true, W * 0.6);
      }
      return { geo, ok: true };
    });
  }

  /* =================================================================================================================
   *  E. Oeffentliche Schnittstelle
   * ================================================================================================================= */
  const api = {
    version: VERSION,
    // Bausteine (SPEC 6.2)
    fieldE, fieldH, waves, createParticles, spectrumBars, curveChart, traceChart, ampel, wipe, layoutBoard, shieldBox, cable, gun, probeScene,
    lisn, device, filterSchematic, filterPaths, heatmap, chainBar,
    // Hilfen
    label, arrow, icon, palette, cssColors, fz, fzt, fHz, fLen, engU, ticks, logTicks, mix, rgba, contrast, lum, rng, fsz,
    // Zusatz fuer Rigs und Tests
    spectrumState, limitAt, ampelText, ampelKey, wipeHit, wipePos, waveSpacing, waveBrightness, shieldBrightness, fieldECompute, heatRGB,
    QUAL, qualityOf, createGovernor, LEVERS, AMPEL, TEXT_KEYS, TWEEN_MS, PEAK_DB_S, HANDLE_W, LEADS,
    stats() { return { fieldE: STATS.fieldE, fieldH: STATS.fieldH }; },
    resetCache() { ECACHE.clear(); HCACHE.clear(); STATS.fieldE = 0; STATS.fieldH = 0; }
  };
  api.fns = ['fieldE', 'fieldH', 'waves', 'createParticles', 'spectrumBars', 'curveChart', 'traceChart', 'ampel', 'wipe', 'layoutBoard', 'shieldBox', 'cable', 'gun',
    'probeScene', 'lisn', 'device', 'filterSchematic', 'heatmap', 'chainBar', 'label', 'arrow', 'icon', 'palette', 'cssColors', 'fz', 'ticks', 'mix', 'version'];
  root.EMV_DRAW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
