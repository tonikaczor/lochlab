/* wsldraw.js - Wechselstrom-Lab Zeichenhelfer (WSL_DRAW, Version 1.0)
 * Zeitbild, Zeigerdiagramm, Dreiecke, Schaltbilder, Resonanzkurve, Bode-Diagramm, Leistungsverlauf, Kondensatorbank, Transformatorkern,
 * Drehstrom, Messgeraet, Sichtenleiste und Ampel. Vanilla-JS, keine Abhaengigkeiten, kein eval, offline.
 * Browser: window.WSL_DRAW, Node: module.exports / globalThis.WSL_DRAW. Reine Anzeige, keine Fachrechnung (Zahlen kommen aus WSL_CORE).
 *
 * ALLGEMEINES (Konventionen wie ntsdraw.js / enrdraw.js)
 *  - Zeichenfunktionen: f(ctx, rect, data, opts). rect = { x, y, w, h }. Zustandsfrei: gleiche Argumente ergeben gleiche Aufrufe.
 *    Animation nur ueber opts.t (Sekunden); die Zeitlupenphase fuehrt das Rig.
 *  - Rueckgabe true = gezeichnet, false = nichts gezeichnet (dann gab es auch KEINEN Aufruf am ctx): fehlender ctx, nicht endliche
 *    Pflichtwerte, Groesse 0 oder zu klein, ungueltige Pflichtdaten. Zahlen als Text gelten NICHT als Zahl. Eine Ausnahme im Zeichnen
 *    wird abgefangen (restore, Rueckgabe false).
 *  - opts: { theme:'dark'|'light', q:'hoch'|'mittel'|'niedrig', reduced:bool, t:Sekunden, bg:false (kein Hintergrund) }.
 *    reduced = Standbild (kein Umlauf, kein Puls). Qualitaetsstufe begrenzt Punktzahl.
 *  - Farben (je Thema, Kontrast >= 4,5:1 zu bg und panel, Skripttest): Spannung blau, Strom orange, Wirkleistung gruen, Blindanteil
 *    violett, Scheinleistung gelb. Nie nur Farbe: jede Groesse traegt Beschriftung UND eine eigene Strichart
 *    (u durchgezogen, i kurz gestrichelt, p lang gestrichelt, q gepunktet, s Strich-Punkt).
 *  - Konvention (SPEC 2): Zeiger drehen gegen den Uhrzeigersinn, phi = phi_u - phi_i, "eilt vor/nach"; Texte nennen Groesse und Einheit.
 *  - Achsen immer mit Groesse und Einheit ("t in ms"). Text: Dezimalkomma, echtes Minuszeichen, Mindestschrift 11 px, bleibt innerhalb
 *    von rect (gekuerzt mit Auslassungszeichen). Nichts blinkt: Puls hoechstens BLINK_MAX_HZ (3 Hz), Zeigerumlauf ROT_HZ (0,15 Hz).
 *
 * FUNKTIONEN (data-Formate; Eingabeformen passen zu rig.waveform(), rig.phasors(), rig.curves() und WSL_CORE)
 *  scope(ctx, rect, { t:[..] in tUnit, series:[{ name, unit, kind?:'u'|'i'|'p'|'q'|'s'|'ref', y:[..] }] (1 bis 4), tUnit?:'ms', cursor?:t,
 *        marks?:{ h?:[{ y, name, series? }], span?:[{ t0, t1, name }] } })      Raster, beschriftete Spitzenwerte (u^), Perioden (T), Zeitversatz (dt)
 *     Andere Einheit als die erste Reihe wird auf gleiche Hoehe skaliert und im Legendentext als "Massstab angepasst" gekennzeichnet.
 *  phasor(ctx, rect, { list:[{ name, len, angle° , kind? }] (1 bis 8), unit?, bezug?:'strom'|'spannung', arc?:{ a, b, label? },
 *        rotate?:bool, project?:bool })        arc: phi = angle(a) - angle(b), Bogen zwischen beiden Zeigern
 *     len: gemeinsamer Massstab fuer alle Zeiger (Spannungen und Stroeme gemischt: das Rig skaliert den Strom fuer die Anzeige und sagt es im Bild)
 *  triangle(ctx, rect, { kind:'spannung'|'impedanz'|'leistung', a, b (mit Vorzeichen: > 0 induktiv), ghost?:{ a, b } })   Hypotenuse aus Pythagoras
 *  schematic(ctx, rect, { kind, elems?, labels?:{ u, r, l, c, z, ... }, art?:'RC'|'RL', typ?:'tief'|'hoch' })
 *     kind: R L C RL RC RLC reihe(elems) parRLC parallel(elems) reihenkreis parallelkreis komp filter rcTief rcHoch rlTief rlHoch trafo stern dreieck
 *  resCurve(ctx, rect, { points:[[f, y]..], f0, fu?, fo?, art?:'reihe'|'parallel', yLabel?, yUnit?, fCursor?, xlog?:bool })
 *  bode(ctx, rect, { f:[..], a:[..] dB, phi?:[..] Grad, asymp?:[..]|[[f,a]..], fg?, typ?:'tief'|'hoch' })
 *  powerWave(ctx, rect, { t:[..], p:[..], pMean?, tUnit?, unit?:'W' })
 *  capBank(ctx, rect, { n 1..12, on 0..n, cStage?, cTotal?, state?:'unter'|'ziel'|'ueber' })
 *  trafoCore(ctx, rect, { n1, n2, u1?, u2?, i1?, i2?, dc?:bool, loss?:{ cu, fe } })
 *  threePhase(ctx, rect, { ustr, mode?:'zeiger'|'zeit' })
 *  meter(ctx, rect, { value, min?, max, unit, label?, kind?:'zeiger'|'digital', zone?:{ from, to } })
 *  chainBar(ctx, rect, { zeit, zeiger, formel, active?:'zeit'|'zeiger'|'formel' })    Sichtenleiste "Zeit - Zeiger - Formel" (Texte aus rig.sicht)
 *  ampel(ctx, x, y, state, { text?, size?, maxw?, theme? })     state gruen|gelb|rot|grau (auch ok|warn|bad|none)
 *  Reine Hilfen: ampelInfo, ariaText, palette, contrast, KINDS, fz, fe, fd, pulse, cssColors, reducedMotion, niceTicks, BLINK_MAX_HZ, ROT_HZ, fns, version
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Hilfen */
  const TAU = Math.PI * 2;
  const BLINK_MAX_HZ = 3;
  const ROT_HZ = 0.15;
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const rad = d => d * Math.PI / 180;
  function nz(o, k, def, lo, hi) { const v = o[k]; return fin(v) ? cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi) : def; }
  const goodColor = v => typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v);
  const numArr = (a, min, max) => Array.isArray(a) && a.length >= min && a.length <= (max || 20000) && a.every(fin);

  /* Farbpaletten (Kontrast zu bg und panel >= 4,5:1; Skripttest prueft jede Farbe) */
  const PAL = {
    dark: {
      bg: '#0f172a', panel: '#1e293b', fg: '#f1f5f9', mute: '#a9b6c9', grid: '#334155', line: '#64748b',
      u: '#60a5fa', i: '#fb923c', p: '#4ade80', q: '#c4b5fd', s: '#fde047', loss: '#f87171', gnd: '#a3b0c2',
      ok: '#4ade80', warn: '#fde047', bad: '#f87171', none: '#a9b6c9'
    },
    light: {
      bg: '#ffffff', panel: '#f1f5f9', fg: '#0f172a', mute: '#475569', grid: '#cbd5e1', line: '#64748b',
      u: '#1d4ed8', i: '#b45309', p: '#15803d', q: '#6d28d9', s: '#854d0e', loss: '#b91c1c', gnd: '#475569',
      ok: '#15803d', warn: '#854d0e', bad: '#b91c1c', none: '#475569'
    }
  };
  /* Groessen: Farbschluessel, Strichart (Zweitcodierung neben der Farbe) und Bezeichnung */
  const KINDS = {
    u: { key: 'u', dash: [], name: 'Spannung' },
    i: { key: 'i', dash: [6, 4], name: 'Strom' },
    p: { key: 'p', dash: [14, 5], name: 'Wirkleistung' },
    q: { key: 'q', dash: [2, 4], name: 'Blindanteil' },
    s: { key: 's', dash: [10, 3, 2, 3], name: 'Scheinleistung' },
    ref: { key: 'mute', dash: [4, 4], name: 'Vergleich' },
    l1: { key: 'u', dash: [], name: 'Außenleiter L1' },
    l2: { key: 'i', dash: [6, 4], name: 'Außenleiter L2' },
    l3: { key: 'p', dash: [2, 4], name: 'Außenleiter L3' }
  };
  function kindOf(kind, name) {
    if (typeof kind === 'string' && KINDS[kind]) return kind;
    const c = str(name).charAt(0);
    return c === 'U' || c === 'u' ? 'u' : c === 'I' || c === 'i' ? 'i' : c === 'P' || c === 'p' ? 'p' : c === 'Q' || c === 'q' ? 'q' : c === 'S' || c === 's' ? 's' : 'ref';
  }
  function palette(theme) { return theme === 'light' ? PAL.light : PAL.dark; }
  function parseHex(c) {
    if (typeof c !== 'string') return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c.trim());
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    return null;
  }
  function lum(c) {
    const p = parseHex(c); if (!p) return NaN;
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2]);
  }
  function contrast(a, b) { /* WCAG-Kontrastverhaeltnis */
    const la = lum(a), lb = lum(b); if (!(la >= 0) || !(lb >= 0)) return NaN;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function cssColors(el) {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return {};
    const out = {};
    try {
      const cs = getComputedStyle(el && el.nodeType === 1 ? el : document.documentElement);
      [['bg', '--bg'], ['panel', '--panel'], ['fg', '--fg'], ['mute', '--mute']].forEach(p => { const v = cs.getPropertyValue(p[1]).trim(); if (goodColor(v)) out[p[0]] = v; });
      const b = parseHex(out.bg);
      if (b && (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) > 150) out.theme = 'light';
    } catch (e) { /* ohne Stile: Standard */ }
    return out;
  }
  function reducedMotion() {
    try { if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignorieren */ }
    return false;
  }
  /* Puls 0..1, Frequenz hoechstens BLINK_MAX_HZ, bei reduced konstant 1 */
  function pulse(t, hz, reduced) {
    if (reduced || !fin(t)) return 1;
    const f = fin(hz) ? cl(hz, 0, BLINK_MAX_HZ) : 1;
    return 0.5 + 0.5 * Math.sin(t * TAU * f);
  }

  /* Anzeige: Dezimalkomma, Minuszeichen, nicht endlich = Gedankenstrich */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    const s = (Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d)).replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  const PREF = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  /* Zahl mit SI-Vorsatz und Einheit: fe(0.0227,'V') = '22,7 mV' */
  function fe(v, unit) {
    if (!fin(v)) return '–';
    const u = typeof unit === 'string' ? unit : '';
    if (v === 0) return '0' + (u ? ' ' + u : '');
    const a = Math.abs(v);
    let p = PREF[PREF.length - 1];
    for (let i = 0; i < PREF.length; i++) if (a >= PREF[i][0] * 0.9995) { p = PREF[i]; break; }
    const x = v / p[0];
    return fz(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) >= 10 ? 1 : 2) + (p[1] || u ? ' ' + p[1] + u : '');
  }
  /* Dekadenbeschriftung: fd(1000,'Hz') = '1 kHz', fd(100,'Hz') = '100 Hz' */
  function fd(v, unit) {
    if (!fin(v) || !(v > 0)) return '–';
    const u = typeof unit === 'string' ? unit : '';
    let p = PREF[PREF.length - 1];
    for (let i = 0; i < PREF.length; i++) if (v >= PREF[i][0] * 0.9995) { p = PREF[i]; break; }
    const x = v / p[0];
    return fz(x, Math.abs(x - Math.round(x)) < 1e-6 ? 0 : 1) + (p[1] || u ? ' ' + p[1] + u : '');
  }
  /* "schoene" Teilung 1-2-5 */
  function niceTicks(lo, hi, n) {
    if (!fin(lo) || !fin(hi) || !(hi > lo)) return [];
    const nn = fin(n) ? cl(Math.round(n), 1, 20) : 5, raw = (hi - lo) / nn, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9 && out.length < 60; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  const decOf = step => (step >= 1 ? 0 : cl(Math.ceil(-Math.log10(step) - 1e-9), 0, 4));

  /* Ampel: Symbol und Text (nie nur Farbe) */
  const AMPEL = {
    gruen: { sym: '✓', text: 'grün: Vorgabe erfüllt', key: 'ok' },
    gelb: { sym: '!', text: 'gelb: knapp', key: 'warn' },
    rot: { sym: '✗', text: 'rot: Vorgabe verfehlt', key: 'bad' },
    grau: { sym: '–', text: 'grau: keine Vorgabe gesetzt', key: 'none' }
  };
  const AMPEL_ALIAS = { ok: 'gruen', grün: 'gruen', green: 'gruen', warn: 'gelb', yellow: 'gelb', bad: 'rot', red: 'rot', none: 'grau', gray: 'grau', grey: 'grau' };
  function ampelInfo(state) {
    const s = typeof state === 'string' ? (AMPEL[state] ? state : AMPEL_ALIAS[state]) : null;
    const k = s || 'grau';
    return { state: k, sym: AMPEL[k].sym, text: AMPEL[k].text, key: AMPEL[k].key };
  }
  /* aria-label des Hauptbildes: Ampeltext zuerst (Spec 7) */
  function ariaText(state, text) {
    const a = ampelInfo(state), t = str(text);
    return 'Ampel ' + a.text + (t ? '. ' + t : '') + '. Grün heißt nicht: gefahrlos.';
  }

  /* ------------------------------------------------------------------ Zeichen-Grundlagen */
  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'stroke', 'fill', 'fillText', 'arc', 'fillRect', 'rect', 'translate', 'rotate'].every(k => typeof ctx[k] === 'function');
  }
  function rectOk(r, minW, minH) { return !!r && typeof r === 'object' && fin(r.x) && fin(r.y) && fin(r.w) && fin(r.h) && r.w >= (minW || 40) && r.h >= (minH || 30); }
  function draw(ctx, fn) {
    ctx.save();
    try { const r = fn(); ctx.restore(); return r === undefined ? true : r === true; } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorieren */ } return false; }
  }
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '') + (Math.round(size * 10) / 10) + 'px system-ui, sans-serif'; }
  function tw(ctx, t, size, bold) {
    if (typeof ctx.measureText === 'function') { const m = ctx.measureText(t); if (m && fin(m.width)) return m.width; }
    return t.length * size * (bold ? 0.6 : 0.56);
  }
  function fitText(ctx, t, maxw, size, bold) {
    if (t === '' || !(maxw > 0)) return '';
    if (tw(ctx, t, size, bold) <= maxw) return t;
    let s = t;
    while (s.length > 1 && tw(ctx, s + '…', size, bold) > maxw) s = s.slice(0, -1);
    return tw(ctx, s.replace(/\s+$/, '') + '…', size, bold) <= maxw ? s.replace(/\s+$/, '') + '…' : '';
  }
  function wrapText(ctx, t, maxw, size, bold, maxLines) {
    const words = t.split(/\s+/).filter(Boolean), lines = [];
    let cur = '';
    for (let i = 0; i < words.length; i++) {
      const trial = cur ? cur + ' ' + words[i] : words[i];
      if (tw(ctx, trial, size, bold) <= maxw || !cur) cur = trial;
      else { lines.push(cur); cur = words[i]; }
    }
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { const rest = lines.slice(maxLines - 1).join(' '); lines.length = maxLines - 1; lines.push(rest); }
    return lines.map(l => fitText(ctx, l, maxw, size, bold)).filter(Boolean);
  }
  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
    if (typeof ctx.arcTo === 'function') ctx.arcTo(x + w, y, x + w, y + r, r); else ctx.lineTo(x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    if (typeof ctx.arcTo === 'function') ctx.arcTo(x + w, y + h, x + w - r, y + h, r); else ctx.lineTo(x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    if (typeof ctx.arcTo === 'function') ctx.arcTo(x, y + h, x, y + h - r, r); else ctx.lineTo(x, y + h - r);
    ctx.lineTo(x, y + r);
    if (typeof ctx.arcTo === 'function') ctx.arcTo(x, y, x + r, y, r); else ctx.lineTo(x + r, y);
    ctx.closePath();
  }
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d || []); if (off !== undefined) ctx.lineDashOffset = off; }
  function line(ctx, x0, y0, x1, y1, color, w, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = w; setDash(ctx, dash || []);
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); setDash(ctx, []);
  }
  function polyline(ctx, pts, color, w, dash) {
    if (pts.length < 2) return;
    ctx.strokeStyle = color; ctx.lineWidth = w; setDash(ctx, dash || []); ctx.lineJoin = 'round';
    ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke(); setDash(ctx, []);
  }
  function dot(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.fill(); }
  function arrowHead(ctx, x0, y0, x1, y1, color, size) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (!(L > 0)) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, hl = Math.min(size, L), hw = hl * 0.45, bx = x1 - ux * hl, by = y1 - uy * hl;
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(bx - uy * hw, by + ux * hw); ctx.lineTo(bx + uy * hw, by - ux * hw); ctx.closePath(); ctx.fill();
  }
  function arrow(ctx, x0, y0, x1, y1, color, w, dash, head) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (!(L > 0)) return;
    const hl = Math.min(head || 8, L), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    if (L > hl) line(ctx, x0, y0, x1 - ux * hl * 0.6, y1 - uy * hl * 0.6, color, w, dash);
    arrowHead(ctx, x0, y0, x1, y1, color, hl);
  }

  /* Text innerhalb von box (Fenster = rect der Zeichenfunktion): gekuerzt, verschoben, Konturfarbe = Hintergrund */
  function T(ctx, box, P, text, x, y, o) {
    o = o || {};
    let t = typeof text === 'number' ? (fin(text) ? fz(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '' || !fin(x) || !fin(y)) return false;
    const size = Math.max(11, o.size || 12), bold = !!o.bold, pad = 2;
    font(ctx, size, bold);
    const maxw = Math.min(o.maxw > 0 ? o.maxw : Infinity, box.w - 2 * pad);
    t = fitText(ctx, t, maxw, size, bold);
    if (t === '') return false;
    const w = tw(ctx, t, size, bold), al = o.align === 'left' || o.align === 'right' ? o.align : 'center';
    let x0 = al === 'left' ? x : al === 'right' ? x - w : x - w / 2;
    x0 = cl(x0, box.x + pad, Math.max(box.x + pad, box.x + box.w - pad - w));
    const yy = cl(y, box.y + size / 2 + 1, Math.max(box.y + size / 2 + 1, box.y + box.h - size / 2 - 1));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    if (o.bg !== false && typeof ctx.strokeText === 'function') { ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = o.halo || P.bg; ctx.strokeText(t, x0, yy); }
    ctx.fillStyle = goodColor(o.color) ? o.color : P.fg; ctx.fillText(t, x0, yy);
    return { x0, x1: x0 + w, y: yy, w };
  }
  const qOf = o => (o && (o.q === 'niedrig' || o.q === 'mittel') ? o.q : 'hoch');
  const qFac = q => (q === 'niedrig' ? 0.3 : q === 'mittel' ? 0.6 : 1);
  /* Gemeinsamer Anfang: prueft ctx und rect, liefert Zeichenumgebung oder null (vor dem ersten Aufruf) */
  function env(ctx, rect, opts, minW, minH) {
    if (!okCtx(ctx) || !rectOk(rect, minW, minH)) return null;
    const o = obj(opts), P = palette(o.theme), q = qOf(o), reduced = o.reduced === true;
    return { P, q, qf: qFac(q), reduced, t: fin(o.t) ? o.t : 0, bgOn: o.bg !== false, box: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, narrow: rect.w < 460 };
  }
  function bgFill(ctx, E) { if (E.bgOn) { ctx.fillStyle = E.P.bg; ctx.fillRect(E.box.x, E.box.y, E.box.w, E.box.h); } }

  /* Achsenrahmen mit Raster, Beschriftung und Einheit. o: { x0, x1, y0, y1, xlog, xl, xu, yl, yu, top, left, right, xLabels, yticks } */
  function frame(ctx, E, rect, o) {
    const P = E.P, left = o.left || 48, bottom = o.xLabels === false ? 8 : 30, top = o.top || 20, right = o.right || 12;
    const pl = { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
    if (pl.w < 40 || pl.h < 24 || !fin(o.x0) || !fin(o.x1) || !fin(o.y0) || !fin(o.y1)) return null;
    if (o.xlog && !(o.x0 > 0 && o.x1 > o.x0 && Math.log10(o.x1 / o.x0) <= 12)) return null;
    const xa = o.xlog ? Math.log10(o.x0) : o.x0, xb = o.xlog ? Math.log10(o.x1) : o.x1;
    if (!(xb > xa) || !(o.y1 > o.y0)) return null;
    const X = x => pl.x + cl(((o.xlog ? Math.log10(Math.max(x, 1e-300)) : x) - xa) / (xb - xa), -0.02, 1.02) * pl.w;
    const Y = y => pl.y + pl.h - cl((y - o.y0) / (o.y1 - o.y0), -0.05, 1.05) * pl.h;
    ctx.fillStyle = P.panel; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    let xt, minor = [], xfmt;
    if (o.xlog) {
      xt = []; for (let k = Math.ceil(xa - 1e-9); k <= Math.floor(xb + 1e-9); k++) xt.push(Math.pow(10, k));
      for (let k = Math.floor(xa); k <= Math.ceil(xb); k++) for (let m = 2; m <= 9; m++) { const v = m * Math.pow(10, k); if (v > o.x0 && v < o.x1) minor.push(v); }
      xfmt = v => fd(v, o.xu || '');
    } else {
      xt = niceTicks(o.x0, o.x1, Math.max(2, Math.floor(pl.w / 70)));
      const st = xt.length > 1 ? xt[1] - xt[0] : 1, dd = decOf(st);
      xfmt = v => fz(v, dd);
    }
    const yt = Array.isArray(o.yticks) ? o.yticks : niceTicks(o.y0, o.y1, Math.max(2, Math.floor(pl.h / 38)));
    const yd = decOf(yt.length > 1 ? Math.abs(yt[1] - yt[0]) : 1);
    if (minor.length) { ctx.strokeStyle = P.grid; ctx.lineWidth = 0.5; ctx.beginPath(); minor.forEach(v => { const x = X(v); ctx.moveTo(x, pl.y); ctx.lineTo(x, pl.y + pl.h); }); ctx.stroke(); }
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
    xt.forEach(v => { const x = X(v); ctx.moveTo(x, pl.y); ctx.lineTo(x, pl.y + pl.h); });
    yt.forEach(v => { const y = Y(v); if (y >= pl.y - 0.5 && y <= pl.y + pl.h + 0.5) { ctx.moveTo(pl.x, y); ctx.lineTo(pl.x + pl.w, y); } });
    ctx.stroke(); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    if (o.xLabels !== false) {
      const spacing = xt.length > 1 ? Math.abs(X(xt[1]) - X(xt[0])) : pl.w, stride = Math.max(1, Math.ceil(56 / Math.max(spacing, 1)));
      xt.forEach((v, i) => { if (i % stride === 0) T(ctx, E.box, P, xfmt(v), X(v), rect.y + rect.h - 16, { size: 11, color: P.mute, bg: false }); });
      const xl = str(o.xl) ? str(o.xl) + (str(o.xu) ? ' in ' + str(o.xu) : '') : '';
      if (xl) T(ctx, E.box, P, xl, pl.x + pl.w, rect.y + rect.h - 5, { size: 11, color: P.fg, align: 'right', bg: false, maxw: pl.w });
    }
    yt.forEach(v => { const y = Y(v); if (y >= pl.y - 0.5 && y <= pl.y + pl.h + 0.5) T(ctx, E.box, P, fz(v, yd), pl.x - 4, y, { size: 11, color: P.mute, align: 'right', bg: false, maxw: left - 6 }); });
    const yl = str(o.yl) ? str(o.yl) + (str(o.yu) ? ' in ' + str(o.yu) : '') : '';
    if (yl) T(ctx, E.box, P, yl, rect.x + 3, rect.y + 8, { size: 11, color: P.fg, align: 'left', bg: false, maxw: rect.w - 6 });
    return { pl, X, Y };
  }

  /* ------------------------------------------------------------------ Ampel und Sichtenleiste */
  function ampel(ctx, x, y, state, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o);
    const a = ampelInfo(state), P = palette(o.theme), size = nz(o, 'size', 13, 11, 40), r = size * 0.62;
    const txt = typeof o.text === 'string' && o.text.trim() ? o.text.trim() : a.text;
    return draw(ctx, () => {
      ctx.fillStyle = P[a.key]; ctx.beginPath(); ctx.arc(x + r, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + r, y, r, 0, TAU); ctx.stroke();
      font(ctx, size, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.bg; ctx.fillText(a.sym, x + r, y + 0.5);
      const maxw = nz(o, 'maxw', 0, 0, 5000);
      font(ctx, size, false);
      const tt = maxw > 0 ? fitText(ctx, txt, Math.max(0, maxw - 2 * r - 6), size, false) : txt;
      ctx.textAlign = 'left'; ctx.fillStyle = P.fg;
      if (tt) ctx.fillText(tt, x + 2 * r + 6, y);
      return true;
    });
  }
  const SICHTEN = [{ id: 'zeit', name: 'Zeit', sym: '~', dash: [] }, { id: 'zeiger', name: 'Zeiger', sym: '↗', dash: [7, 3] }, { id: 'formel', name: 'Formel', sym: 'ƒ', dash: [2, 3] }];
  function chainBar(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 90, 40);
    if (!E) return false;
    const items = SICHTEN.filter(s => str(d[s.id])).map(s => ({ s, text: str(d[s.id]) }));
    if (!items.length) return false;
    const P = E.P, n = items.length, gap = 12, act = SICHTEN.some(s => s.id === d.active) ? d.active : null;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const stacked = E.narrow || rect.w < 520;
      items.forEach((it, i) => {
        let x0, y0, bw, bh;
        if (stacked) { bw = rect.w - 8; bh = (rect.h - 4 - gap * (n - 1) * 0.4) / n; x0 = rect.x + 4; y0 = rect.y + 2 + i * (bh + gap * 0.4); } else { bw = (rect.w - 8 - gap * (n - 1)) / n; bh = rect.h - 6; x0 = rect.x + 4 + i * (bw + gap); y0 = rect.y + 3; }
        ctx.fillStyle = P.panel; rrect(ctx, x0, y0, bw, bh, 6); ctx.fill();
        ctx.strokeStyle = it.s.id === act ? P.fg : P.line; ctx.lineWidth = it.s.id === act ? 3 : 1.5; setDash(ctx, it.s.dash); rrect(ctx, x0, y0, bw, bh, 6); ctx.stroke(); setDash(ctx, []);
        if (it.s.id === act) { ctx.lineWidth = 1.5; rrect(ctx, x0 + 4, y0 + 4, bw - 8, bh - 8, 4); ctx.stroke(); }
        T(ctx, E.box, P, it.s.sym + ' ' + it.s.name, x0 + 6, y0 + 10, { align: 'left', bold: true, bg: false, size: 11, maxw: bw - 12 });
        const lines = wrapText(ctx, it.text, bw - 12, 11, false, stacked ? 1 : Math.max(1, Math.min(3, Math.floor((bh - 22) / 13))));
        lines.forEach((l, k) => T(ctx, E.box, P, l, x0 + 6, y0 + 25 + k * 13, { align: 'left', bg: false, size: 11, color: P.mute, maxw: bw - 12 }));
      });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Zeitbild (Linienschreiber) */
  function scope(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 110);
    if (!E || !numArr(d.t, 2) || !Array.isArray(d.series) || d.series.length < 1 || d.series.length > 4) return false;
    const n = d.t.length, t = d.t;
    for (let i = 1; i < n; i++) if (t[i] < t[i - 1]) return false;
    if (!(t[n - 1] > t[0])) return false;
    const S = d.series.map(s => obj(s));
    if (!S.every(s => numArr(s.y, 0) && s.y.length === n && str(s.name))) return false;
    const P = E.P, tUnit = str(d.tUnit) || 's', unit0 = str(S[0].unit);
    const maxAbs = y => y.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    const ref = maxAbs(S[0].y) > 1e-12 ? maxAbs(S[0].y) : 1;
    const ser = S.map(s => {
      const mx = maxAbs(s.y), same = str(s.unit) === unit0, k = same || !(mx > 1e-12) ? 1 : ref / mx, kk = kindOf(s.kind, s.name);
      return { s, k, mx, kk, unit: str(s.unit), scaled: k !== 1 };
    });
    let ymin = 0, ymax = 0;
    ser.forEach(r => r.s.y.forEach(v => { const w = v * r.k; if (w < ymin) ymin = w; if (w > ymax) ymax = w; }));
    const lo = ymin < 0 ? ymin * 1.18 : 0, hi = ymax > 0 ? ymax * 1.18 : 1;
    const legend = ser.map(r => r.s.name + (r.unit ? ' in ' + r.unit : '') + (r.scaled ? ' (Spitze ' + fe(r.mx, r.unit) + ', Maßstab angepasst)' : ''));
    return draw(ctx, () => {
      bgFill(ctx, E);
      font(ctx, 11, false);
      const widths = legend.map(s => 30 + tw(ctx, s, 11, false)), rowMode = widths.reduce((a, b) => a + b, 0) + 12 <= rect.w - 8, legH = rowMode ? 16 : 15 * legend.length + 2;
      const F = frame(ctx, E, rect, { x0: t[0], x1: t[n - 1], y0: lo, y1: hi, xl: 't', xu: tUnit, yl: 'Augenblickswert', yu: unit0, top: 22 + legH });
      if (!F) return false;
      const pl = F.pl, zy = F.Y(0);
      line(ctx, pl.x, zy, pl.x + pl.w, zy, P.line, 1.5);
      /* Legende: Strichprobe in Farbe und Strichart plus Text */
      let lx = rect.x + 6, ly = rect.y + 30;
      ser.forEach((r, i) => {
        const kd = KINDS[r.kk], col = P[kd.key];
        line(ctx, lx, ly, lx + 22, ly, col, 3, kd.dash);
        T(ctx, E.box, P, legend[i], lx + 26, ly, { align: 'left', bg: false, size: 11, color: P.fg, maxw: rowMode ? widths[i] - 28 : rect.w - 40 });
        if (rowMode) lx += widths[i]; else ly += 15;
      });
      /* Kurven */
      const step = Math.max(1, Math.ceil(n / (400 * E.qf)));
      ser.forEach(r => {
        const kd = KINDS[r.kk], pts = [];
        for (let i = 0; i < n; i += step) pts.push([F.X(t[i]), F.Y(r.s.y[i] * r.k)]);
        if ((n - 1) % step !== 0) pts.push([F.X(t[n - 1]), F.Y(r.s.y[n - 1] * r.k)]);
        polyline(ctx, pts, P[kd.key], 2.5, kd.dash);
      });
      const mk = obj(d.marks);
      if (Array.isArray(mk.h)) mk.h.slice(0, 6).forEach(m => {
        m = obj(m); if (!fin(m.y) || !str(m.name)) return;
        const r = ser[fin(m.series) && ser[m.series | 0] ? m.series | 0 : 0], y = F.Y(m.y * r.k);
        if (y < pl.y || y > pl.y + pl.h) return;
        line(ctx, pl.x, y, pl.x + pl.w, y, P.mute, 1.2, [5, 4]);
        T(ctx, E.box, P, m.name + ' = ' + fz(m.y) + (r.unit ? ' ' + r.unit : ''), pl.x + pl.w - 4, y - 8, { size: 11, align: 'right', color: P.fg });
      });
      if (Array.isArray(mk.span)) mk.span.slice(0, 3).forEach((m, i) => {
        m = obj(m); if (!fin(m.t0) || !fin(m.t1) || !(m.t1 > m.t0) || !str(m.name)) return;
        const x0 = F.X(m.t0), x1 = F.X(m.t1), y = pl.y + pl.h - 14 - i * 20;
        line(ctx, x0, pl.y, x0, pl.y + pl.h, P.mute, 1, [3, 3]); line(ctx, x1, pl.y, x1, pl.y + pl.h, P.mute, 1, [3, 3]);
        arrow(ctx, (x0 + x1) / 2, y, x0, y, P.fg, 1.5, null, 7); arrow(ctx, (x0 + x1) / 2, y, x1, y, P.fg, 1.5, null, 7);
        T(ctx, E.box, P, m.name + ' = ' + fz(m.t1 - m.t0) + ' ' + tUnit, (x0 + x1) / 2, y - 9, { size: 11, bold: true });
      });
      if (fin(d.cursor) && d.cursor >= t[0] && d.cursor <= t[n - 1]) {
        const cx = F.X(d.cursor);
        line(ctx, cx, pl.y, cx, pl.y + pl.h, P.fg, 1.5, [2, 3]);
        T(ctx, E.box, P, 't = ' + fz(d.cursor) + ' ' + tUnit, cx + 4, pl.y + 9, { size: 11, align: 'left' });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Zeigerdiagramm */
  function phasor(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 120);
    if (!E || !Array.isArray(d.list) || d.list.length < 1 || d.list.length > 8) return false;
    const L = d.list.map(x => obj(x));
    if (!L.every(z => str(z.name) && fin(z.len) && z.len >= 0 && fin(z.angle))) return false;
    const maxLen = L.reduce((m, z) => Math.max(m, z.len), 0);
    if (!(maxLen > 0)) return false;
    const P = E.P, unit = str(d.unit), project = d.project !== false && rect.w >= 250;
    const rot = d.rotate === true && !E.reduced ? 360 * ROT_HZ * E.t : 0;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const areaW = project ? rect.w - 76 : rect.w, cx = rect.x + areaW / 2 + 2, cy = rect.y + 18 + (rect.h - 18) / 2;
      const R = Math.max(18, Math.min(areaW / 2 - 34, (rect.h - 18) / 2 - 12)), k = R * 0.9 / maxLen;
      const pos = (len, ang) => [cx + len * k * Math.cos(rad(ang + rot)), cy - len * k * Math.sin(rad(ang + rot))];
      /* Kreis, Achsen */
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1.5; setDash(ctx, [4, 4]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); setDash(ctx, []);
      line(ctx, cx - R - 6, cy, cx + R + 6, cy, P.grid, 1); line(ctx, cx, cy - R - 6, cx, cy + R + 6, P.grid, 1);
      const bz = d.bezug === 'strom' ? 'Bezugszeiger: Strom, φ = φ_u − φ_i' : d.bezug === 'spannung' ? 'Bezugszeiger: Spannung, φ = φ_u − φ_i' : 'Zeiger drehen gegen den Uhrzeigersinn';
      T(ctx, E.box, P, bz, rect.x + 4, rect.y + 8, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      /* Winkelbogen phi = angle(a) - angle(b) */
      const ar = obj(d.arc), za = L.find(z => z.name === ar.a), zb = L.find(z => z.name === ar.b);
      if (za && zb) {
        let phi = ((za.angle - zb.angle) % 360 + 540) % 360 - 180;
        const r0 = Math.max(14, Math.min(R * 0.42, 60)), lab = (str(ar.label) || 'φ') + ' = ' + fz(phi, 1) + '°';
        if (Math.abs(phi) >= 0.5) {
          ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r0, -rad(zb.angle + rot), -rad(za.angle + rot), phi > 0); ctx.stroke();
        }
        const mid = zb.angle + phi / 2 + rot;
        T(ctx, E.box, P, lab + (Math.abs(phi) < 0.5 ? ' (in Phase)' : phi > 0 ? ' (' + za.name + ' eilt vor)' : ' (' + za.name + ' eilt nach)'), cx + (r0 + 8) * Math.cos(rad(mid)), cy - (r0 + 8) * Math.sin(rad(mid)) + (Math.abs(Math.sin(rad(mid))) < 0.3 ? 14 : 0), { size: 11, bold: true, align: Math.cos(rad(mid)) >= 0 ? 'left' : 'right', maxw: areaW * 0.8 });
      }
      /* Zeiger mit Pfeil, Strichart und Beschriftung */
      L.forEach(z => {
        const kd = KINDS[kindOf(z.kind, z.name)], col = P[kd.key], tip = pos(z.len, z.angle);
        if (z.len * k < 1) { dot(ctx, cx, cy, 3, col); } else arrow(ctx, cx, cy, tip[0], tip[1], col, 3, kd.dash, 11);
        const ux = Math.cos(rad(z.angle + rot)), uy = -Math.sin(rad(z.angle + rot));
        T(ctx, E.box, P, z.name + (unit ? ' = ' + fe(z.len, unit) : ''), tip[0] + ux * 12, tip[1] + uy * 12, { size: 11, bold: true, color: col, align: ux > 0.2 ? 'left' : ux < -0.2 ? 'right' : 'center', maxw: areaW * 0.7 });
        if (project) {
          const px = rect.x + rect.w - 34;
          line(ctx, tip[0], tip[1], px, tip[1], col, 1, [2, 3]);
          dot(ctx, px, tip[1], 3.5, col);
        }
      });
      dot(ctx, cx, cy, 3, P.fg);
      if (project) {
        const px = rect.x + rect.w - 34;
        line(ctx, px, cy - R - 6, px, cy + R + 6, P.line, 1.5);
        T(ctx, E.box, P, 'Projektion', px, rect.y + 26, { size: 11, color: P.mute, bg: false, maxw: 72 });
        T(ctx, E.box, P, 'auf Zeitachse', px, rect.y + rect.h - 6, { size: 11, color: P.mute, bg: false, maxw: 76 });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Dreieck (Spannung, Impedanz, Leistung; vorher/nachher) */
  const TRI = {
    spannung: { names: ['U_R', 'U_X', 'U'], unit: ['V', 'V', 'V'], kinds: ['u', 'u', 'u'], formula: 'U² = U_R² + U_X²', title: 'Spannungsdreieck' },
    impedanz: { names: ['R', 'X', 'Z'], unit: ['Ω', 'Ω', 'Ω'], kinds: ['ref', 'ref', 'ref'], formula: 'Z² = R² + X²', title: 'Widerstandsdreieck' },
    leistung: { names: ['P', 'Q', 'S'], unit: ['W', 'var', 'VA'], kinds: ['p', 'q', 's'], formula: 'S² = P² + Q²', title: 'Leistungsdreieck' }
  };
  function triangle(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 120), tr = TRI[d.kind];
    if (!E || !tr || !fin(d.a) || d.a < 0 || !fin(d.b) || (d.a === 0 && d.b === 0)) return false;
    const g = d.ghost === undefined || d.ghost === null ? null : obj(d.ghost);
    if (g && !(fin(g.a) && g.a >= 0 && fin(g.b))) return false;
    const P = E.P, hyp = (a, b) => Math.hypot(a, b), A = d.a, B = d.b, C = hyp(A, B);
    const maxA = Math.max(A, g ? g.a : 0, 1e-12), yLo = Math.min(0, B, g ? g.b : 0), yHi = Math.max(0, B, g ? g.b : 0);
    return draw(ctx, () => {
      bgFill(ctx, E);
      const mx = 36, availW = rect.w - mx - 112, top = rect.y + 34, availH = rect.h - 34 - 40;
      const s = Math.min(availW / maxA, availH / Math.max(yHi - yLo, 1e-12));
      const ox = rect.x + mx, oy = top + yHi * s + (availH - (yHi - yLo) * s) / 2;
      const pt = (a, b) => [ox + a * s, oy - b * s];
      T(ctx, E.box, P, tr.title + (g ? ': vorher gestrichelt, nachher durchgezogen' : ''), rect.x + 4, rect.y + 9, { size: 11, bold: true, align: 'left', maxw: rect.w - 8 });
      const side = (a, b, ghost) => {
        const o = pt(0, 0), p1 = pt(a, 0), p2 = pt(a, b), col = ghost ? P.mute : null;
        const kd = i => KINDS[tr.kinds[i]];
        line(ctx, o[0], o[1], p1[0], p1[1], col || (tr.kinds[0] === 'ref' ? P.fg : P[kd(0).key]), ghost ? 1.5 : 3, ghost ? [4, 4] : kd(0).dash);
        line(ctx, p1[0], p1[1], p2[0], p2[1], col || (tr.kinds[1] === 'ref' ? P.fg : P[kd(1).key]), ghost ? 1.5 : 3, ghost ? [4, 4] : kd(1).dash);
        line(ctx, o[0], o[1], p2[0], p2[1], col || (tr.kinds[2] === 'ref' ? P.fg : P[kd(2).key]), ghost ? 1.5 : 3, ghost ? [4, 4] : kd(2).dash);
      };
      if (g) side(g.a, g.b, true);
      side(A, B, false);
      const o = pt(0, 0), p1 = pt(A, 0), p2 = pt(A, B), col = i => (tr.kinds[i] === 'ref' ? P.fg : P[KINDS[tr.kinds[i]].key]);
      const nm = (i) => (i === 1 && d.kind !== 'spannung' ? tr.names[1] : tr.names[i]);
      T(ctx, E.box, P, nm(0) + ' = ' + fe(A, tr.unit[0]), (o[0] + p1[0]) / 2, o[1] + (B >= 0 ? 14 : -14), { size: 11, bold: true, color: col(0), maxw: rect.w * 0.45 });
      T(ctx, E.box, P, nm(1) + ' = ' + fe(B, tr.unit[1]), p1[0] + 8, (p1[1] + p2[1]) / 2, { size: 11, bold: true, color: col(1), align: 'left', maxw: rect.w - (p1[0] - rect.x) - 12 });
      T(ctx, E.box, P, tr.names[2] + ' = ' + fe(C, tr.unit[2]), (o[0] + p2[0]) / 2 - 6, (o[1] + p2[1]) / 2 + (B >= 0 ? -14 : 14), { size: 11, bold: true, color: col(2), align: 'right', maxw: rect.w * 0.5 });
      if (g) T(ctx, E.box, P, 'vorher: ' + tr.names[2] + ' = ' + fe(hyp(g.a, g.b), tr.unit[2]), rect.x + rect.w - 6, rect.y + 22, { size: 11, align: 'right', color: P.mute, maxw: rect.w - 8 });
      /* Winkel phi und Art der Last */
      const phi = Math.atan2(B, A) * 180 / Math.PI, r0 = Math.max(16, Math.min(34, A * s * 0.4));
      if (Math.abs(phi) >= 0.5) { ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(o[0], o[1], r0, 0, -rad(phi), phi > 0); ctx.stroke(); }
      const art = Math.abs(phi) < 0.05 ? 'ohmsch' : phi > 0 ? 'induktiv' : 'kapazitiv';
      T(ctx, E.box, P, 'φ = ' + fz(phi, 1) + '° (' + art + ')' + (d.kind === 'leistung' && fin(A / C) ? ', cos φ = ' + fz(A / C, 3) : ''), rect.x + 4, rect.y + rect.h - 22, { size: 11, bold: true, align: 'left', maxw: rect.w - 8 });
      T(ctx, E.box, P, tr.formula + ' (Pythagoras)', rect.x + 4, rect.y + rect.h - 7, { size: 11, align: 'left', color: P.mute, maxw: rect.w - 8 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Schaltbild (DIN-Symbole) */
  /* Bauteil zwischen zwei Punkten, Anschlussdraehte inklusive: R Rechteck, Z Kasten, L Spule, C Platten, U Quelle */
  function elem(ctx, P, type, x0, y0, x1, y1, color, lw) {
    const Ln = Math.hypot(x1 - x0, y1 - y0);
    if (!(Ln > 10)) return;
    const ang = Math.atan2(y1 - y0, x1 - x0), xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
    const h = type === 'C' ? 4 : type === 'U' ? 13 : Math.min(Ln / 2 - 3, type === 'L' ? 22 : 20);
    ctx.save();
    try {
      ctx.translate(xm, ym); ctx.rotate(ang);
      ctx.fillStyle = P.panel; ctx.strokeStyle = color; ctx.lineWidth = lw; setDash(ctx, []);
      line(ctx, -Ln / 2, 0, -h, 0, color, lw); line(ctx, h, 0, Ln / 2, 0, color, lw);
      if (type === 'R' || type === 'Z') { const hh = type === 'R' ? 6 : 9; ctx.beginPath(); ctx.rect(-h, -hh, 2 * h, 2 * hh); ctx.fill(); ctx.stroke(); }
      else if (type === 'L') { const r = h / 4; ctx.beginPath(); for (let k = 0; k < 4; k++) ctx.arc(-h + r * (2 * k + 1), 0, r, Math.PI, 2 * Math.PI, false); ctx.stroke(); }
      else if (type === 'C') { line(ctx, -4, -11, -4, 11, color, lw + 1); line(ctx, 4, -11, 4, 11, color, lw + 1); }
      else if (type === 'U') { ctx.beginPath(); ctx.arc(0, 0, h, 0, TAU); ctx.fill(); ctx.stroke(); }
    } finally { ctx.restore(); }
    if (type === 'U') { /* Sinus im Kreis (nicht mitgedreht) */
      const pts = []; for (let k = 0; k <= 16; k++) pts.push([xm - 8 + k, ym - 5 * Math.sin(k / 16 * TAU)]);
      polyline(ctx, pts, color, 1.8);
    }
  }
  const ELEM_NAME = { R: 'r', L: 'l', C: 'c', Z: 'z' };
  const SCH_ALIAS = { R: ['R'], L: ['L'], C: ['C'], RL: ['R', 'L'], RC: ['R', 'C'], RLC: ['R', 'L', 'C'], reihenkreis: ['R', 'L', 'C'] };
  const SCH_KINDS = ['R', 'L', 'C', 'RL', 'RC', 'RLC', 'reihe', 'parRLC', 'parallel', 'reihenkreis', 'parallelkreis', 'komp', 'filter', 'rcTief', 'rcHoch', 'rlTief', 'rlHoch', 'trafo', 'stern', 'dreieck'];
  function schematic(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 100);
    if (!E || SCH_KINDS.indexOf(d.kind) < 0) return false;
    let kind = d.kind, elems = null;
    const okType = x => x === 'R' || x === 'L' || x === 'C' || x === 'Z';
    if (SCH_ALIAS[kind]) { elems = SCH_ALIAS[kind]; kind = 'reihe'; }
    else if (kind === 'reihe' || kind === 'parallel') { elems = Array.isArray(d.elems) ? d.elems.filter(okType).slice(0, 4) : []; if (!elems.length) return false; }
    else if (kind === 'parRLC') { elems = ['R', 'L', 'C']; kind = 'parallel'; }
    else if (kind === 'parallelkreis') { elems = ['L', 'C', 'R']; kind = 'parallel'; }
    else if (kind === 'komp') { elems = ['Z', 'C']; kind = 'parallel'; }
    let fil = null;
    if (kind === 'filter' || /^(rc|rl)(Tief|Hoch)$/.test(kind)) {
      const art = kind === 'filter' ? d.art : kind.slice(0, 2).toUpperCase(), typ = kind === 'filter' ? d.typ : kind.slice(2).toLowerCase() === 'tief' ? 'tief' : 'hoch';
      if ((art !== 'RC' && art !== 'RL') || (typ !== 'tief' && typ !== 'hoch')) return false;
      fil = art === 'RC' ? (typ === 'tief' ? ['R', 'C'] : ['C', 'R']) : (typ === 'tief' ? ['L', 'R'] : ['R', 'L']);
      kind = 'filter';
    }
    const lb = obj(d.labels), P = E.P, lab = k => str(lb[k]);
    return draw(ctx, () => {
      bgFill(ctx, E);
      const x0 = rect.x + 36, x1 = rect.x + rect.w - 30, yt = rect.y + 36, yb = rect.y + rect.h - 40, lw = 2.2, cu = P.u, ci = P.i, fgc = P.fg;
      const wire = (a, b, c, e) => line(ctx, a, b, c, e, fgc, lw);
      const qlab = (kk, x, y, o) => { const s = lab(kk); if (s) T(ctx, E.box, P, s, x, y, Object.assign({ size: 11, color: P.fg, bg: false }, o || {})); };
      const cur = (x, y, name) => { arrow(ctx, x, y, x + 26, y, ci, 2, [6, 3], 8); T(ctx, E.box, P, name || 'i', x + 36, y, { size: 11, color: ci, bold: true, bg: false }); };
      if (kind === 'reihe') {
        const n = elems.length, seg = (x1 - x0) / n;
        elem(ctx, P, 'U', x0, yb, x0, yt, cu, lw);
        elems.forEach((e, i) => { elem(ctx, P, e, x0 + i * seg, yt, x0 + (i + 1) * seg, yt, fgc, lw); qlab(ELEM_NAME[e], x0 + (i + 0.5) * seg, yt + 24, { maxw: seg - 4 }); });
        wire(x1, yt, x1, yb); wire(x1, yb, x0, yb);
        cur(x0 + 12, yt - 14, lab('i') || 'i');
        qlab('u', (x0 + x1) / 2, yb + 16, { color: cu, bold: true });
        T(ctx, E.box, P, 'Reihenschaltung: gleicher Strom i', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      } else if (kind === 'parallel') {
        const n = elems.length, seg = (x1 - x0) / (n + 1);
        elem(ctx, P, 'U', x0, yb, x0, yt, cu, lw);
        wire(x0, yt, x0 + n * seg, yt); wire(x0, yb, x0 + n * seg, yb);
        elems.forEach((e, i) => { const x = x0 + (i + 1) * seg; elem(ctx, P, e, x, yt, x, yb, fgc, lw); qlab(ELEM_NAME[e], x + 8, (yt + yb) / 2 + 26, { align: 'left', maxw: seg - 10 }); });
        qlab('u', (x0 + x1) / 2, yb + 16, { color: cu, bold: true });
        T(ctx, E.box, P, 'Parallelschaltung: gleiche Spannung u', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      } else if (kind === 'filter') {
        const xn = x0 + (x1 - x0) * 0.62;
        elem(ctx, P, 'U', x0, yb, x0, yt, cu, lw);
        elem(ctx, P, fil[0], x0, yt, xn, yt, fgc, lw); qlab(ELEM_NAME[fil[0]], (x0 + xn) / 2, yt + 24, { maxw: xn - x0 - 4 });
        wire(xn, yt, x1, yt); elem(ctx, P, fil[1], xn, yt, xn, yb, fgc, lw); qlab(ELEM_NAME[fil[1]], xn + 8, (yt + yb) / 2 + 26, { align: 'left', maxw: x1 - xn - 6 });
        wire(x0, yb, x1, yb); dot(ctx, xn, yt, 3, fgc); dot(ctx, xn, yb, 3, fgc);
        ctx.strokeStyle = fgc; ctx.lineWidth = 2; ctx.fillStyle = P.bg;
        [yt, yb].forEach(y => { ctx.beginPath(); ctx.arc(x1, y, 4, 0, TAU); ctx.fill(); ctx.stroke(); });
        T(ctx, E.box, P, 'u_e', x0 + 14, (yt + yb) / 2, { size: 11, bold: true, color: cu, align: 'left', bg: false });
        T(ctx, E.box, P, 'u_a', x1 - 6, (yt + yb) / 2, { size: 11, bold: true, color: cu, align: 'right' });
        arrow(ctx, x1 - 12, yt + 8, x1 - 12, yb - 8, cu, 1.5, null, 7);
        qlab('u', (x0 + x1) / 2, yb + 16, { color: cu, bold: true });
        T(ctx, E.box, P, 'Filter ohne Last (Leerlauf)', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      } else if (kind === 'trafo') {
        const xa = x0 + (x1 - x0) * 0.30, xb = x0 + (x1 - x0) * 0.62, xc = x1;
        elem(ctx, P, 'U', x0, yb, x0, yt, cu, lw);
        wire(x0, yt, xa, yt); wire(x0, yb, xa, yb); elem(ctx, P, 'L', xa, yt, xa, yb, P.u, lw);
        wire(xb, yt, xc, yt); wire(xb, yb, xc, yb); elem(ctx, P, 'L', xb, yt, xb, yb, P.p, lw);
        elem(ctx, P, 'R', xc, yt, xc, yb, fgc, lw);
        const xm = (xa + xb) / 2;
        line(ctx, xm - 3, yt + 8, xm - 3, yb - 8, fgc, 2); line(ctx, xm + 3, yt + 8, xm + 3, yb - 8, fgc, 2);
        qlab('n1', xa - 8, yb + 16, { color: P.u, bold: true, align: 'right' }); qlab('n2', xb + 8, yb + 16, { color: P.p, bold: true, align: 'left' });
        qlab('u', x0, yb + 16, { color: cu, bold: true, align: 'left' }); qlab('r', xc - 8, yb + 16, { align: 'right' });
        T(ctx, E.box, P, 'Primärseite – Kern – Sekundärseite – Last', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      } else { /* stern, dreieck */
        const cx = (rect.x + rect.x + rect.w) / 2, cy = rect.y + 24 + (rect.h - 54) / 2, R = Math.max(24, Math.min((rect.w - 90) / 2, (rect.h - 70) / 2));
        const pts = [90, 210, 330].map(a => [cx + R * Math.cos(rad(a)), cy - R * Math.sin(rad(a))]), names = ['L1', 'L2', 'L3'], cols = [P.u, P.i, P.p];
        if (kind === 'stern') {
          pts.forEach((p, i) => { elem(ctx, P, 'Z', cx, cy, p[0], p[1], cols[i], lw); T(ctx, E.box, P, names[i], p[0] + (p[0] - cx) * 0.25, p[1] + (p[1] - cy) * 0.25 + (i === 0 ? -4 : 6), { size: 11, bold: true, color: cols[i] }); });
          dot(ctx, cx, cy, 4, fgc); T(ctx, E.box, P, 'Sternpunkt', cx + 8, cy + 16, { size: 11, align: 'left', color: P.mute });
        } else {
          pts.forEach((p, i) => { const q = pts[(i + 1) % 3]; elem(ctx, P, 'Z', p[0], p[1], q[0], q[1], cols[i], lw); dot(ctx, p[0], p[1], 4, fgc); T(ctx, E.box, P, names[i], p[0] + (p[0] - cx) * 0.22, p[1] + (p[1] - cy) * 0.22 + (i === 0 ? -4 : 6), { size: 11, bold: true, color: cols[i] }); });
        }
        T(ctx, E.box, P, kind === 'stern' ? 'Sternschaltung' : 'Dreieckschaltung', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
        qlab('z', cx, rect.y + rect.h - 8, { bold: true });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Resonanzkurve mit Bandbreite */
  function interp(xs, ys, x, xlog) {
    const n = xs.length;
    if (!(n >= 2)) return NaN;
    for (let i = 1; i < n; i++) {
      const a = xs[i - 1], b = xs[i];
      if ((x >= a && x <= b) || (x <= a && x >= b)) {
        const u = b === a ? 0 : (xlog ? Math.log(x / a) / Math.log(b / a) : (x - a) / (b - a));
        return ys[i - 1] + (ys[i] - ys[i - 1]) * u;
      }
    }
    return NaN;
  }
  function resCurve(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 120);
    if (!E || !Array.isArray(d.points) || d.points.length < 3 || d.points.length > 5000 || !fin(d.f0) || !(d.f0 > 0)) return false;
    if (!d.points.every(p => Array.isArray(p) && fin(p[0]) && p[0] > 0 && fin(p[1]) && p[1] >= 0)) return false;
    const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
    const xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymax = Math.max.apply(null, ys);
    if (!(xmax > xmin) || !(ymax > 0)) return false;
    const xlog = d.xlog !== false && Math.log10(xmax / xmin) <= 12, P = E.P, yl = str(d.yLabel) || 'Größe', yu = str(d.yUnit);
    const hasBand = fin(d.fu) && fin(d.fo) && d.fu > 0 && d.fo > d.fu;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const F = frame(ctx, E, rect, { x0: xmin, x1: xmax, y0: 0, y1: ymax * 1.18, xlog, xl: 'f', xu: 'Hz', yl, yu, top: 40 });
      if (!F) return false;
      const pl = F.pl, step = Math.max(1, Math.ceil(xs.length / (400 * E.qf)));
      const pts = []; for (let i = 0; i < xs.length; i += step) pts.push([F.X(xs[i]), F.Y(ys[i])]);
      pts.push([F.X(xs[xs.length - 1]), F.Y(ys[ys.length - 1])]);
      /* Band: Pegel Maximum / Wurzel 2 */
      const lvl = ymax / Math.SQRT2;
      if (hasBand) {
        ctx.fillStyle = P.panel; ctx.globalAlpha = 1;
        ctx.strokeStyle = P.q; ctx.lineWidth = 1.5; setDash(ctx, [2, 4]); ctx.beginPath();
        ctx.moveTo(F.X(d.fu), pl.y); ctx.lineTo(F.X(d.fu), pl.y + pl.h); ctx.moveTo(F.X(d.fo), pl.y); ctx.lineTo(F.X(d.fo), pl.y + pl.h); ctx.stroke(); setDash(ctx, []);
        const yb = F.Y(lvl);
        arrow(ctx, (F.X(d.fu) + F.X(d.fo)) / 2, yb, F.X(d.fu), yb, P.q, 2, null, 7); arrow(ctx, (F.X(d.fu) + F.X(d.fo)) / 2, yb, F.X(d.fo), yb, P.q, 2, null, 7);
        T(ctx, E.box, P, 'B = f_o − f_u = ' + fe(d.fo - d.fu, 'Hz'), (F.X(d.fu) + F.X(d.fo)) / 2, yb + 15, { size: 11, bold: true, color: P.q, maxw: pl.w * 0.8 });
      }
      line(ctx, pl.x, F.Y(lvl), pl.x + pl.w, F.Y(lvl), P.mute, 1, [5, 4]);
      T(ctx, E.box, P, 'Maximum / √2', pl.x + 4, F.Y(lvl) - 8, { size: 11, color: P.mute, align: 'left', bg: false, maxw: pl.w * 0.4 });
      polyline(ctx, pts, P.u, 3);
      /* Marker f0 (und fu, fo) */
      const mk = [['f_0', d.f0, P.fg, 0]];
      if (hasBand) { mk.push(['f_u', d.fu, P.q, 1]); mk.push(['f_o', d.fo, P.q, 1]); }
      mk.forEach(m => {
        const x = F.X(m[1]); line(ctx, x, pl.y, x, pl.y + pl.h, m[2], m[3] ? 1 : 2, [6, 3]);
        T(ctx, E.box, P, m[0] + ' = ' + fe(m[1], 'Hz'), x + (m[0] === 'f_u' ? -4 : 4), rect.y + (m[0] === 'f_0' ? 24 : 36), { size: 11, bold: true, color: m[2], align: m[0] === 'f_u' ? 'right' : 'left', maxw: rect.w * 0.45 });
      });
      const y0 = interp(xs, ys, d.f0, xlog);
      if (fin(y0)) { dot(ctx, F.X(d.f0), F.Y(y0), 5, P.fg); dot(ctx, F.X(d.f0), F.Y(y0), 3, P.u); }
      if (fin(d.fCursor) && d.fCursor >= xmin && d.fCursor <= xmax) {
        const yc = interp(xs, ys, d.fCursor, xlog), x = F.X(d.fCursor);
        line(ctx, x, pl.y, x, pl.y + pl.h, P.i, 2, [2, 3]);
        if (fin(yc)) { dot(ctx, x, F.Y(yc), 5, P.i); T(ctx, E.box, P, 'f = ' + fe(d.fCursor, 'Hz') + ', ' + yl + ' = ' + fe(yc, yu), x, F.Y(yc) - 12, { size: 11, color: P.i, bold: true, maxw: pl.w * 0.9 }); }
      }
      const art = d.art === 'reihe' ? 'Reihenkreis: Z minimal, I maximal' : d.art === 'parallel' ? 'Parallelkreis: Z maximal, I minimal' : '';
      if (art) T(ctx, E.box, P, art + ' bei f_0', rect.x + rect.w - 6, rect.y + rect.h - 40, { size: 11, align: 'right', color: P.mute, maxw: rect.w * 0.8 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Bode-Diagramm */
  function bode(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 130);
    if (!E || !numArr(d.f, 3, 5000) || !numArr(d.a, 3, 5000) || d.a.length !== d.f.length || !d.f.every(v => v > 0)) return false;
    if (d.phi !== undefined && d.phi !== null && !(numArr(d.phi, 3, 5000) && d.phi.length === d.f.length)) return false;
    const f = d.f, a = d.a, n = f.length, fmin = Math.min.apply(null, f), fmax = Math.max.apply(null, f);
    if (!(fmax > fmin) || Math.log10(fmax / fmin) > 12) return false;
    let asy = null;
    if (Array.isArray(d.asymp) && d.asymp.length === n) {
      if (d.asymp.every(fin)) asy = d.asymp.slice();
      else if (d.asymp.every(p => Array.isArray(p) && fin(p[1]))) asy = d.asymp.map(p => p[1]);
    }
    const P = E.P, typ = d.typ === 'hoch' ? 'hoch' : d.typ === 'tief' ? 'tief' : '', fg = fin(d.fg) && d.fg > 0 ? d.fg : NaN, ph = d.phi || null;
    const all = a.concat(asy || []), lo0 = Math.min.apply(null, all), hi0 = Math.max.apply(null, all), pad = 5;
    const lo = Math.floor((Math.min(lo0, 0) - 1) / pad) * pad, hi = Math.ceil((Math.max(hi0, 0) + 1) / pad) * pad;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const two = ph && rect.h >= 250, h1 = two ? Math.round(rect.h * 0.55) : rect.h;
      const r1 = { x: rect.x, y: rect.y, w: rect.w, h: h1 };
      const span = hi - lo, ds = span > 60 ? 20 : span > 30 ? 10 : 5, yt = []; for (let v = Math.ceil(lo / ds) * ds; v <= hi; v += ds) yt.push(v);
      const F1 = frame(ctx, E, r1, { x0: fmin, x1: fmax, y0: lo, y1: hi, xlog: true, xl: 'f', xu: 'Hz', yl: 'a', yu: 'dB', top: 22, xLabels: !two, yticks: yt });
      if (!F1) return false;
      const pl = F1.pl, step = Math.max(1, Math.ceil(n / (400 * E.qf)));
      line(ctx, pl.x, F1.Y(0), pl.x + pl.w, F1.Y(0), P.line, 1.5);
      if (asy) { const pa = []; for (let i = 0; i < n; i += step) pa.push([F1.X(f[i]), F1.Y(asy[i])]); polyline(ctx, pa, P.mute, 2, [7, 4]); }
      const pm = []; for (let i = 0; i < n; i += step) pm.push([F1.X(f[i]), F1.Y(a[i])]); pm.push([F1.X(f[n - 1]), F1.Y(a[n - 1])]);
      polyline(ctx, pm, P.u, 3);
      const lg = [['a(f)', P.u, []], asy ? ['Asymptoten', P.mute, [7, 4]] : null].filter(Boolean);
      lg.forEach((l, i) => { line(ctx, pl.x + 8 + i * 110, rect.y + 24 - 0, pl.x + 30 + i * 110, rect.y + 24, l[1], 3, l[2]); });
      lg.forEach((l, i) => T(ctx, E.box, P, l[0], pl.x + 34 + i * 110, rect.y + 24, { size: 11, align: 'left', color: l[1], bg: false, maxw: 80 }));
      if (fin(fg) && fg >= fmin && fg <= fmax) {
        const x = F1.X(fg), ag = interp(f, a, fg, true);
        line(ctx, x, pl.y, x, pl.y + pl.h, P.fg, 1.5, [6, 3]);
        T(ctx, E.box, P, 'Knick f_g = ' + fe(fg, 'Hz'), x + 5, pl.y + pl.h - 10, { size: 11, bold: true, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', maxw: pl.w * 0.6 });
        if (fin(ag)) { dot(ctx, x, F1.Y(ag), 5, P.fg); dot(ctx, x, F1.Y(ag), 3, P.u); T(ctx, E.box, P, 'a(f_g) = ' + fz(ag, 2) + ' dB', x + (x > pl.x + pl.w * 0.6 ? -8 : 8), F1.Y(ag) + (typ === 'hoch' ? -14 : 14), { size: 11, bold: true, color: P.u, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', maxw: pl.w * 0.5 }); }
      }
      if (typ) T(ctx, E.box, P, (typ === 'tief' ? 'Tiefpass: ' : 'Hochpass: ') + (typ === 'tief' ? '−20 dB' : '+20 dB') + ' je Dekade', pl.x + pl.w - 4, pl.y + 10, { size: 11, align: 'right', color: P.mute, maxw: pl.w * 0.6 });
      if (two) {
        const r2 = { x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 };
        const F2 = frame(ctx, E, r2, { x0: fmin, x1: fmax, y0: -100, y1: 100, xlog: true, xl: 'f', xu: 'Hz', yl: 'φ', yu: '°', top: 20, yticks: [-90, -45, 0, 45, 90] });
        if (F2) {
          line(ctx, F2.pl.x, F2.Y(0), F2.pl.x + F2.pl.w, F2.Y(0), P.line, 1.5);
          const pp = []; for (let i = 0; i < n; i += step) pp.push([F2.X(f[i]), F2.Y(ph[i])]); pp.push([F2.X(f[n - 1]), F2.Y(ph[n - 1])]);
          polyline(ctx, pp, P.i, 3, KINDS.i.dash);
          if (fin(fg) && fg >= fmin && fg <= fmax) {
            const x = F2.X(fg), pg = interp(f, ph, fg, true);
            line(ctx, x, F2.pl.y, x, F2.pl.y + F2.pl.h, P.fg, 1.5, [6, 3]);
            if (fin(pg)) { dot(ctx, x, F2.Y(pg), 5, P.fg); dot(ctx, x, F2.Y(pg), 3, P.i); T(ctx, E.box, P, 'φ(f_g) = ' + fz(pg, 1) + '°', x + (x > F2.pl.x + F2.pl.w * 0.6 ? -8 : 8), F2.Y(pg) + (pg < 0 ? -14 : 14), { size: 11, bold: true, color: P.i, align: x > F2.pl.x + F2.pl.w * 0.6 ? 'right' : 'left', maxw: F2.pl.w * 0.5 }); }
          }
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ p(t) mit positiven und negativen Flaechen */
  function powerWave(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 110);
    if (!E || !numArr(d.t, 4) || !numArr(d.p, 4) || d.p.length !== d.t.length) return false;
    const t = d.t, p = d.p, n = t.length;
    for (let i = 1; i < n; i++) if (t[i] < t[i - 1]) return false;
    if (!(t[n - 1] > t[0])) return false;
    const P = E.P, tUnit = str(d.tUnit) || 's', unit = str(d.unit) || 'W';
    let mean = fin(d.pMean) ? d.pMean : NaN;
    if (!fin(mean)) { let s = 0; for (let i = 1; i < n; i++) s += (p[i] + p[i - 1]) / 2 * (t[i] - t[i - 1]); mean = s / (t[n - 1] - t[0]); }
    const pmax = Math.max.apply(null, p), pmin = Math.min.apply(null, p), hasNeg = pmin < -1e-9 * Math.max(Math.abs(pmax), 1e-12);
    const hi = Math.max(pmax, mean, 0) * 1.2 || 1, lo = Math.min(pmin, mean, 0) * 1.2;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const F = frame(ctx, E, rect, { x0: t[0], x1: t[n - 1], y0: lo, y1: hi > lo ? hi : lo + 1, xl: 't', xu: tUnit, yl: 'p(t) = u · i', yu: unit, top: 22 });
      if (!F) return false;
      const pl = F.pl, zy = F.Y(0), step = Math.max(1, Math.ceil(n / (400 * E.qf)));
      /* Flaechen: Vorzeichenwechsel genau am Nulldurchgang */
      const xs = [], ys = [];
      for (let i = 0; i < n; i += step) { xs.push(t[i]); ys.push(p[i]); }
      if ((n - 1) % step !== 0) { xs.push(t[n - 1]); ys.push(p[n - 1]); }
      const fillRun = (run, col) => {
        if (run.length < 2) return;
        ctx.globalAlpha = 0.45; ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(F.X(run[0][0]), zy);
        run.forEach(q => ctx.lineTo(F.X(q[0]), F.Y(q[1]))); ctx.lineTo(F.X(run[run.length - 1][0]), zy); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      };
      let run = [], sign = 0;
      for (let i = 0; i < xs.length; i++) {
        const sg = ys[i] > 0 ? 1 : ys[i] < 0 ? -1 : 0;
        if (i > 0 && sg !== 0 && sign !== 0 && sg !== sign) {
          const u = ys[i - 1] / (ys[i - 1] - ys[i]), xc = xs[i - 1] + (xs[i] - xs[i - 1]) * u;
          run.push([xc, 0]); fillRun(run, sign > 0 ? P.p : P.q); run = [[xc, 0]]; sign = sg;
        }
        if (sign === 0 && sg !== 0) sign = sg;
        run.push([xs[i], ys[i]]);
      }
      fillRun(run, sign >= 0 ? P.p : P.q);
      line(ctx, pl.x, zy, pl.x + pl.w, zy, P.line, 1.5);
      polyline(ctx, xs.map((x, i) => [F.X(x), F.Y(ys[i])]), P.fg, 2);
      const ym = F.Y(mean);
      line(ctx, pl.x, ym, pl.x + pl.w, ym, P.s, 2.5, KINDS.s.dash);
      T(ctx, E.box, P, 'P = ' + fe(mean, unit) + ' (Mittelwert)', pl.x + pl.w - 4, ym + (ym < zy ? -10 : 12), { size: 11, bold: true, color: P.s, align: 'right', maxw: pl.w * 0.7 });
      T(ctx, E.box, P, '+ Energie fließt zum Verbraucher', pl.x + 6, pl.y + 10, { size: 11, color: P.p, bold: true, align: 'left', maxw: pl.w * 0.9 });
      if (hasNeg) T(ctx, E.box, P, '− Energie pendelt zurück (Blindanteil)', pl.x + 6, pl.y + pl.h - 10, { size: 11, color: P.q, bold: true, align: 'left', maxw: pl.w * 0.9 });
      else T(ctx, E.box, P, 'p(t) bleibt ≥ 0: kein Zurückpendeln', pl.x + 6, pl.y + pl.h - 10, { size: 11, color: P.mute, align: 'left', maxw: pl.w * 0.9 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Kondensatorbank mit Stufen */
  const CAP_STATE = { unter: ['!', 'unterkompensiert: cos φ unter dem Ziel', 'warn'], ziel: ['✓', 'Ziel erreicht: cos φ im Zielbereich', 'ok'], ueber: ['✗', 'überkompensiert: Last wird kapazitiv, cos φ sinkt wieder', 'bad'] };
  function capBank(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 160, 120);
    if (!E || !fin(d.n) || d.n < 1 || d.n > 12 || Math.floor(d.n) !== d.n || !fin(d.on) || d.on < 0 || d.on > d.n || Math.floor(d.on) !== d.on) return false;
    const P = E.P, n = d.n, on = d.on, cs = fin(d.cStage) && d.cStage >= 0 ? d.cStage : NaN;
    const cTot = fin(d.cTotal) && d.cTotal >= 0 ? d.cTotal : (fin(cs) ? cs * on : NaN), st = CAP_STATE[d.state] || null;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const x0 = rect.x + 14, x1 = rect.x + rect.w - 14, yt = rect.y + 42, yb = rect.y + rect.h - 62, bx = x0 + 60;
      T(ctx, E.box, P, 'Kondensatorbank parallel zur Last, ' + on + ' von ' + n + ' Stufen zugeschaltet', rect.x + 4, rect.y + 9, { size: 11, align: 'left', bold: true, maxw: rect.w - 8 });
      /* Last links */
      ctx.fillStyle = P.panel; rrect(ctx, x0, yt + 8, 44, yb - yt - 16, 6); ctx.fill(); ctx.strokeStyle = P.fg; ctx.lineWidth = 2; rrect(ctx, x0, yt + 8, 44, yb - yt - 16, 6); ctx.stroke();
      T(ctx, E.box, P, 'Last', x0 + 22, (yt + yb) / 2, { size: 11, bold: true, bg: false, maxw: 42 });
      line(ctx, x0 + 22, yt + 8, x0 + 22, yt, P.fg, 2); line(ctx, x0 + 22, yb - 8, x0 + 22, yb, P.fg, 2);
      const seg = (x1 - bx) / n;
      line(ctx, x0 + 22, yt, bx + seg * (n - 0.5), yt, P.fg, 2); line(ctx, x0 + 22, yb, bx + seg * (n - 0.5), yb, P.fg, 2);
      for (let i = 0; i < n; i++) {
        const x = bx + seg * (i + 0.5), isOn = i < on, col = isOn ? P.q : P.mute, mid = (yt + yb) / 2;
        line(ctx, x, yt, x, mid - 22, col, 2); line(ctx, x, mid + 4, x, yb, col, 2);
        /* Schalter: geschlossen = senkrecht, offen = schraeg */
        if (isOn) line(ctx, x, mid - 22, x, mid - 6, col, 2.5); else line(ctx, x, mid - 22, x + 9, mid - 8, col, 2.5);
        dot(ctx, x, mid - 22, 2.5, col);
        const pc = isOn ? P.q : P.mute;
        ctx.strokeStyle = pc; ctx.lineWidth = isOn ? 3 : 2; setDash(ctx, isOn ? [] : [3, 3]);
        ctx.beginPath(); ctx.moveTo(x - 9, mid + 4); ctx.lineTo(x + 9, mid + 4); ctx.moveTo(x - 9, mid + 12); ctx.lineTo(x + 9, mid + 12); ctx.stroke(); setDash(ctx, []);
        line(ctx, x, mid + 12, x, yb, pc, 2);
        if (n <= 8 || i % 2 === 0) T(ctx, E.box, P, (isOn ? '' : '') + 'C' + (i + 1), x, mid + 30, { size: 11, color: isOn ? P.q : P.mute, bold: isOn, bg: false, maxw: seg });
        if (isOn) T(ctx, E.box, P, 'ein', x, mid - 36, { size: 11, color: P.q, bold: true, bg: false, maxw: seg + 4 }); else if (n <= 8) T(ctx, E.box, P, 'aus', x, mid - 36, { size: 11, color: P.mute, bg: false, maxw: seg + 4 });
      }
      const parts = [];
      if (fin(cTot)) parts.push('C = ' + fe(cTot, 'F'));
      if (fin(cs)) parts.push('je Stufe ' + fe(cs, 'F'));
      if (parts.length) T(ctx, E.box, P, parts.join(', '), rect.x + 6, rect.y + rect.h - 42, { size: 11, bold: true, align: 'left', color: P.q, maxw: rect.w - 12 });
      if (st) T(ctx, E.box, P, st[0] + ' ' + st[1], rect.x + 6, rect.y + rect.h - 22, { size: 11, bold: true, align: 'left', color: P[st[2]], maxw: rect.w - 12 });
      else T(ctx, E.box, P, 'Zustand noch nicht bewertet', rect.x + 6, rect.y + rect.h - 22, { size: 11, align: 'left', color: P.mute, maxw: rect.w - 12 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Transformatorkern */
  function trafoCore(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 180, 130);
    if (!E || !fin(d.n1) || d.n1 <= 0 || !fin(d.n2) || d.n2 <= 0) return false;
    const P = E.P, dc = d.dc === true, lossOk = d.loss && fin(d.loss.cu) && d.loss.cu >= 0 && fin(d.loss.fe) && d.loss.fe >= 0 && rect.h >= 210;
    const pv = pulse(E.t, 1, E.reduced);
    return draw(ctx, () => {
      bgFill(ctx, E);
      const colW = Math.max(70, Math.min(110, rect.w * 0.26)), top = rect.y + 26, bot = rect.y + rect.h - (lossOk ? 58 : 38);
      const cx0 = rect.x + colW, cx1 = rect.x + rect.w - colW, cy0 = top, cy1 = bot, th = Math.max(14, Math.min(26, (cx1 - cx0) * 0.18));
      T(ctx, E.box, P, 'Transformator (Lehrmodell, Zeichnung schematisch)', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
      ctx.fillStyle = P.line; ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
      ctx.fillStyle = P.bg; ctx.fillRect(cx0 + th, cy0 + th, cx1 - cx0 - 2 * th, cy1 - cy0 - 2 * th);
      /* Wicklungen (Windungszahl nur als Zahl, Bild zeigt Verhaeltnis grob) */
      const lp = 8, ls = Math.max(2, Math.min(8, Math.round(8 * d.n2 / d.n1)));
      const coil = (legX, loops, col) => {
        const y0 = cy0 + th + 6, y1 = cy1 - th - 6;
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath();
        for (let k = 0; k < loops; k++) { const y = y0 + (y1 - y0) * (k + 0.5) / loops; ctx.moveTo(legX - th / 2 - 6, y + 3); ctx.lineTo(legX + th / 2 + 6, y - 3); }
        ctx.stroke();
      };
      coil(cx0 + th / 2, lp, P.u); coil(cx1 - th / 2, ls, P.p);
      if (!dc) {
        const fx0 = cx0 + th / 2, fx1 = cx1 - th / 2, fy0 = cy0 + th / 2, fy1 = cy1 - th / 2, lw = E.reduced ? 3 : 1.5 + 2.5 * pv;
        ctx.strokeStyle = P.s; ctx.lineWidth = lw; setDash(ctx, [8, 4]); ctx.beginPath(); ctx.rect(fx0, fy0, fx1 - fx0, fy1 - fy0); ctx.stroke(); setDash(ctx, []);
        const ah = E.reduced ? 9 : 6 + 5 * pv;
        arrowHead(ctx, fx0, fy0 + 20, fx0, fy0 + 4, P.s, ah); arrowHead(ctx, fx1, fy1 - 20, fx1, fy1 - 4, P.s, ah);
        arrowHead(ctx, (fx0 + fx1) / 2 - 10, fy0, (fx0 + fx1) / 2 + 10, fy0, P.s, ah); arrowHead(ctx, (fx0 + fx1) / 2 + 10, fy1, (fx0 + fx1) / 2 - 10, fy1, P.s, ah);
        T(ctx, E.box, P, 'Wechselfluss Φ', (cx0 + cx1) / 2, (cy0 + cy1) / 2, { size: 11, bold: true, color: P.s });
      } else {
        T(ctx, E.box, P, 'Gleichspannung: kein Wechselfluss', (cx0 + cx1) / 2, (cy0 + cy1) / 2 - 8, { size: 11, bold: true, color: P.bad, maxw: cx1 - cx0 - 2 * th - 4 });
        T(ctx, E.box, P, 'nur Wicklungswiderstand begrenzt den Strom', (cx0 + cx1) / 2, (cy0 + cy1) / 2 + 8, { size: 11, color: P.bad, maxw: cx1 - cx0 - 2 * th - 4 });
      }
      /* Zahlenspalten */
      const col = (side, lines, color) => lines.forEach((s, i) => { if (s) T(ctx, E.box, P, s, side === 'l' ? rect.x + 6 : rect.x + rect.w - 6, top + 14 + i * 18, { size: 11, bold: i === 0, color: i === 0 ? color : P.fg, align: side === 'l' ? 'left' : 'right', maxw: colW - 10 }); });
      col('l', ['Primärseite', 'N1 = ' + fz(d.n1, 0), fin(d.u1) ? 'U1 = ' + fe(d.u1, 'V') : '', fin(d.i1) ? 'I1 = ' + fe(d.i1, 'A') : ''], P.u);
      col('r', ['Sekundärseite', 'N2 = ' + fz(d.n2, 0), fin(d.u2) ? 'U2 = ' + fe(d.u2, 'V') : '', fin(d.i2) ? 'I2 = ' + fe(d.i2, 'A') : ''], P.p);
      T(ctx, E.box, P, 'ü = N1/N2 = ' + fz(d.n1 / d.n2, 2), rect.x + rect.w / 2, rect.y + rect.h - (lossOk ? 66 : 14), { size: 11, bold: true });
      if (lossOk) {
        const mx = Math.max(d.loss.cu, d.loss.fe, 1e-12), bw = rect.w - 24, y0 = rect.y + rect.h - 50;
        [['Kupfer P_Cu', d.loss.cu, P.i], ['Eisen P_Fe', d.loss.fe, P.q]].forEach((b, i) => {
          const y = y0 + i * 22; ctx.fillStyle = P.grid; ctx.fillRect(rect.x + 12, y, bw, 8);
          ctx.fillStyle = b[2]; ctx.fillRect(rect.x + 12, y, b[1] > 0 ? Math.max(3, bw * b[1] / mx) : 0, 8);
          T(ctx, E.box, P, b[0] + ' = ' + fe(b[1], 'W'), rect.x + 12, y + 14, { size: 11, align: 'left', color: b[2], maxw: bw });
        });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Drehstrom */
  function threePhase(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 130);
    if (!E || !fin(d.ustr) || d.ustr <= 0) return false;
    const P = E.P, mode = d.mode === 'zeit' ? 'zeit' : 'zeiger', U = d.ustr, names = ['L1', 'L2', 'L3'], ang = [0, -120, -240], kinds = ['l1', 'l2', 'l3'];
    const rot = mode === 'zeiger' && d.rotate === true && !E.reduced ? 360 * ROT_HZ * E.t : 0;
    return draw(ctx, () => {
      bgFill(ctx, E);
      if (mode === 'zeiger') {
        const cx = rect.x + rect.w / 2, cy = rect.y + 22 + (rect.h - 22) / 2, R = Math.max(18, Math.min(rect.w / 2 - 50, (rect.h - 22) / 2 - 14)), k = R / U;
        const tip = i => [cx + U * k * Math.cos(rad(ang[i] + rot)), cy - U * k * Math.sin(rad(ang[i] + rot))];
        ctx.strokeStyle = P.grid; ctx.lineWidth = 1.5; setDash(ctx, [4, 4]); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); setDash(ctx, []);
        T(ctx, E.box, P, 'drei Zeiger, je 120° versetzt, gleich lang', rect.x + 4, rect.y + 9, { size: 11, align: 'left', color: P.mute, bg: false, maxw: rect.w - 8 });
        const t0 = tip(0), t1 = tip(1);
        const ul = Math.hypot((t0[0] - t1[0]) / k, (t0[1] - t1[1]) / k);
        line(ctx, t0[0], t0[1], t1[0], t1[1], P.fg, 2.5, [6, 3]);
        for (let i = 0; i < 3; i++) {
          const kd = KINDS[kinds[i]], p = tip(i), ux = Math.cos(rad(ang[i] + rot)), uy = -Math.sin(rad(ang[i] + rot));
          arrow(ctx, cx, cy, p[0], p[1], P[kd.key], 3, kd.dash, 11);
          T(ctx, E.box, P, 'U_' + names[i] + ' = ' + fe(U, 'V'), p[0] + ux * 12, p[1] + uy * 12, { size: 11, bold: true, color: P[kd.key], align: ux > 0.2 ? 'left' : ux < -0.2 ? 'right' : 'center', maxw: rect.w * 0.45 });
        }
        dot(ctx, cx, cy, 3, P.fg);
        T(ctx, E.box, P, 'Außenleiterspannung U_L = ' + fe(ul, 'V') + ' (Abstand der Spitzen)', rect.x + 4, rect.y + rect.h - 22, { size: 11, bold: true, align: 'left', maxw: rect.w - 8 });
        T(ctx, E.box, P, 'U_L = √3 · U_Str (Stern), U_Str = ' + fe(U, 'V'), rect.x + 4, rect.y + rect.h - 7, { size: 11, align: 'left', color: P.mute, maxw: rect.w - 8 });
      } else {
        const N = Math.max(60, Math.round(240 * E.qf)), xs = [], ys = [[], [], []], sum = [];
        let sm = 0;
        for (let j = 0; j <= N; j++) {
          const x = j / N; xs.push(x); let s = 0;
          for (let i = 0; i < 3; i++) { const v = U * Math.SQRT2 * Math.cos(TAU * x + rad(ang[i])); ys[i].push(v); s += v; }
          sum.push(s); sm = Math.max(sm, Math.abs(s));
        }
        const ymax = U * Math.SQRT2 * 1.2;
        const F = frame(ctx, E, rect, { x0: 0, x1: 1, y0: -ymax, y1: ymax, xl: 'Zeit', xu: 'Perioden T', yl: 'u', yu: 'V', top: 40 });
        if (!F) return false;
        const pl = F.pl;
        line(ctx, pl.x, F.Y(0), pl.x + pl.w, F.Y(0), P.line, 1.5);
        for (let i = 0; i < 3; i++) { const kd = KINDS[kinds[i]]; polyline(ctx, xs.map((x, j) => [F.X(x), F.Y(ys[i][j])]), P[kd.key], 2.5, kd.dash); line(ctx, pl.x + 6 + i * 74, rect.y + 24, pl.x + 28 + i * 74, rect.y + 24, P[kd.key], 3, kd.dash); T(ctx, E.box, P, 'u_' + names[i], pl.x + 32 + i * 74, rect.y + 24, { size: 11, bold: true, color: P[kd.key], align: 'left', bg: false, maxw: 44 }); }
        polyline(ctx, xs.map((x, j) => [F.X(x), F.Y(sum[j])]), P.fg, 3.5, [1, 5]);
        const zero = sm < 1e-9 * Math.max(U, 1e-12);
        T(ctx, E.box, P, zero ? 'Summe u_L1 + u_L2 + u_L3 = 0 V (gepunktet auf der Nulllinie)' : 'Summe größer als 0 V: höchstens ' + fe(sm, 'V'), pl.x + 4, rect.y + 36, { size: 11, bold: true, align: 'left', maxw: pl.w - 6 });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Messgeraet */
  function meter(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 90, 70), mn = fin(d.min) ? d.min : 0;
    if (!E || !fin(d.value) || !fin(d.max) || !(d.max > mn)) return false;
    const P = E.P, unit = str(d.unit), label = str(d.label), digital = d.kind === 'digital', over = d.value < mn || d.value > d.max;
    const frac = cl((d.value - mn) / (d.max - mn), 0, 1);
    const zone = d.zone && fin(d.zone.from) && fin(d.zone.to) && d.zone.to > d.zone.from ? d.zone : null;
    return draw(ctx, () => {
      bgFill(ctx, E);
      if (label) T(ctx, E.box, P, label, rect.x + rect.w / 2, rect.y + 10, { size: 11, bold: true, maxw: rect.w - 8 });
      const txt = fe(d.value, unit) + (over ? ' (außerhalb der Skala)' : '');
      if (digital) {
        ctx.fillStyle = P.panel; rrect(ctx, rect.x + 6, rect.y + 22, rect.w - 12, rect.h - 28, 8); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; rrect(ctx, rect.x + 6, rect.y + 22, rect.w - 12, rect.h - 28, 8); ctx.stroke();
        T(ctx, E.box, P, txt, rect.x + rect.w / 2, rect.y + 22 + (rect.h - 28) / 2, { size: Math.max(14, Math.min(26, rect.h * 0.28)), bold: true, bg: false, maxw: rect.w - 20 });
        return true;
      }
      const cx = rect.x + rect.w / 2, R = Math.max(20, Math.min(rect.w / 2 - 14, rect.h - 52)), cy = rect.y + 24 + R;
      const a0 = 210, sweep = 240, pos = fr => rad(a0 - sweep * fr);
      ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, -pos(0), -pos(1), false); ctx.stroke();
      if (zone) { const f0 = cl((zone.from - mn) / (d.max - mn), 0, 1), f1 = cl((zone.to - mn) / (d.max - mn), 0, 1); ctx.strokeStyle = P.ok; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R - 6, -pos(f0), -pos(f1), false); ctx.stroke(); }
      for (let i = 0; i <= 5; i++) {
        const fr = i / 5, a = pos(fr), c = Math.cos(a), s = Math.sin(a);
        line(ctx, cx + (R - 8) * c, cy - (R - 8) * s, cx + R * c, cy - R * s, P.fg, 2);
        T(ctx, E.box, P, fz(mn + (d.max - mn) * fr, decOf((d.max - mn) / 5)), cx + (R + 11) * c * 0.92, cy - (R + 11) * s * 0.92, { size: 11, color: P.mute, bg: false, maxw: 44 });
      }
      const na = pos(frac);
      arrow(ctx, cx, cy, cx + (R - 4) * Math.cos(na), cy - (R - 4) * Math.sin(na), P.i, 3, null, 10);
      dot(ctx, cx, cy, 4, P.fg);
      T(ctx, E.box, P, txt, cx, rect.y + rect.h - 8, { size: 12, bold: true, maxw: rect.w - 8 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Programmierschnittstelle */
  /* Jede Zeichenfunktion faengt Ausnahmen ab (Rueckgabe false) */
  function safe(fn) { return function () { try { return fn.apply(null, arguments) === true; } catch (e) { return false; } }; }
  const DRAWERS = { scope, phasor, triangle, schematic, resCurve, bode, powerWave, capBank, trafoCore, threePhase, meter, chainBar, ampel };
  const FNS = Object.keys(DRAWERS);
  const API = {
    version: '1.0', fns: FNS, BLINK_MAX_HZ, ROT_HZ, PAL, KINDS, SCHEMATIC_KINDS: SCH_KINDS.slice(), TRIANGLES: Object.keys(TRI),
    palette, contrast, cssColors, reducedMotion, pulse, fz, fe, fd, niceTicks, ampelInfo, ariaText, kindOf
  };
  FNS.forEach(k => { API[k] = safe(DRAWERS[k]); });
  root.WSL_DRAW = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
