/* ntsdraw.js - Netzteil-Lab Zeichenhelfer (NTS_DRAW, Version 1.0)
 * Blockschaltbild mit Leistungsbilanz, Transformatorkern, Gleichrichter-Szene, Oszilloskop-Anzeige, Z-Dioden-Kennlinie, Linearregler,
 * Wandler-Szene (Tiefsetzsteller, Hochsetzsteller, Inverswandler, Sperrwandler), Drosselstrom, Gate-Szene, Regelkreis, CV/CC-Kennlinie,
 * Platine mit Messpunkten, Stufenkette und Ampel. Vanilla-JS, keine Abhaengigkeiten, kein eval, offline.
 * Browser: window.NTS_DRAW, Node: module.exports / globalThis.NTS_DRAW. Reine Anzeige, keine Fachrechnung (Zahlen kommen aus NTS_CORE).
 *
 * ALLGEMEINES (Konventionen wie enrdraw.js)
 *  - Zeichenfunktionen: f(ctx, rect, data, opts). rect = { x, y, w, h } (mindestens 40 x 30 px). Zustandsfrei: gleiche Argumente ergeben
 *    gleiche Aufrufe. Animation nur ueber opts.t (Sekunden); der Schreibstrahl des Oszilloskops ist data.beam (0..1) und wird vom Rig gefuehrt.
 *  - Rueckgabe true = gezeichnet, false = nichts gezeichnet (dann gab es auch KEINEN Aufruf am ctx): fehlender ctx, nicht endliche Pflichtwerte,
 *    Groesse 0 oder zu klein, ungueltige Pflichtdaten. Optionen fallen bei Unsinn auf Vorgaben zurueck, Zahlen werden geklemmt, Zahlen als Text
 *    gelten NICHT als Zahl. Eine Ausnahme im Zeichnen wird abgefangen (restore, Rueckgabe false).
 *  - opts: { theme:'dark'|'light', q:'hoch'|'mittel'|'niedrig', reduced:bool, t:Sekunden, bg:false (kein Hintergrund) }.
 *    Qualitaetsstufe begrenzt Punktzahl und Bewegungsteilchen; reduced = Standbild (keine Bewegung, kein Puls).
 *  - Farben (je Thema, Kontrast >= 4,5:1 zu bg und panel, Skripttest): Eingang orange, Ausgang gruen, Verlust rot, Masse grau,
 *    Schaltknoten violett, Drosselstrom blau, Gate gelb. Nie nur Farbe: jede Linie traegt Text, Symbol oder Strichart.
 *  - Texte: Dezimalkomma, echtes Minuszeichen, Einheit an jeder Zahl, Mindestschrift 11 px, Text bleibt immer innerhalb von rect
 *    (gekuerzt mit Auslassungszeichen), Konturfarbe = Hintergrund. Nichts blinkt: Puls hoechstens BLINK_MAX_HZ (3 Hz).
 *
 * FUNKTIONEN (data-Formate)
 *  blockDiagram(ctx, rect, { pIn W, pOut W, eta 0..1?, blocks:[{ stufe, name?, pLoss W, text? }] })       1 bis 8 Bloecke
 *  trafoCore(ctx, rect, { n1, n2, u1?, u2?, i1?, i2?, dc?:bool })
 *  rectifierScene(ctx, rect, { kind:'bruecke'|'einweg', half:+1|-1, uf?, uPeak?, c?:bool, rl?:text })       bridgePath(kind, half) = leitende Dioden
 *  scope(ctx, rect, { traces:[{ name, unit, color, points:[[t,v]..] | { t0, dt, y:[] } }], ghost?:[{ name, points }], cursor?:t, beam?:0..1, tRange?:[a,b] })
 *     bis vier Spuren (je eine Zeile), gemeinsame Zeitachse; scopeLayout(rect, data) -> { plot, lanes, t0, t1, xAt, tAt }
 *  zenerChart(ctx, rect, { uz, rz?, iz?, izMin?, izMax? })                    Kennlinie in Sperrrichtung, Arbeitspunkt und Grenzen
 *  linearReg(ctx, rect, { uIn, uOut, i, pV?, eta?, name?, dropout?, cool?:bool })   keine Temperatur
 *  converterScene(ctx, rect, { topo:'buck'|'boost'|'invers'|'sperr', phase:'on'|'off', d?, uIn?, uOut?, iL? })   phasePath(topo, phase)
 *  inductorCurrent(ctx, rect, { iAvg, dI, d?, mode:'ccm'|'dcm'|'grenz', tf? })    inductorShape(data, n) -> Punkte
 *  gateScene(ctx, rect, { ug, uplat, uth?, uds, id, qgs?, qgd?, psw? })
 *  loopBlock(ctx, rect, { uRef, r1, r2, uOut?, step?:{ t[], u[] }, state? })
 *  cvccChart(ctx, rect, { uSet, iSet, rLoad?, op?:{ u, i, mode:'cv'|'cc' } })
 *  benchPcb(ctx, rect, { points:[{ id, label?, x 0..1, y 0..1, v?:text, state?:'ok'|'fault', selected? }], parts?:[{ stufe, name, x, y, w, h }], reveal?:bool })
 *     pcbPoints(rect, data) -> Punkte in Pixeln fuer Treffertest
 *  chainBar(ctx, rect, { steps:[{ stufe, text?, state? }] })
 *  ampel(ctx, x, y, state, { text?, size?, maxw?, theme?, align? })           state gruen|gelb|rot|grau (auch ok|warn|bad|none)
 *  Reine Hilfen: ampelInfo, ariaText, palette, contrast, STUFEN, fz, fe, pulse, cssColors, reducedMotion, BLINK_MAX_HZ, fns, version
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Hilfen */
  const TAU = Math.PI * 2;
  const BLINK_MAX_HZ = 3;
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  const lerp = (a, b, t) => a + (b - a) * t;
  const str = v => (typeof v === 'string' ? v.trim() : '');
  function nz(o, k, def, lo, hi) { const v = o[k]; return fin(v) ? cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi) : def; }
  const goodColor = v => typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v);

  /* Farbpaletten (Kontrast zu bg und panel >= 4,5:1; Skripttest prueft jede Farbe) */
  const PAL = {
    dark: {
      bg: '#0f172a', panel: '#1e293b', fg: '#f1f5f9', mute: '#a9b6c9', grid: '#334155', line: '#64748b', beamHalo: '#f1f5f9',
      in: '#fb923c', out: '#4ade80', loss: '#f87171', gnd: '#a3b0c2', sw: '#c4b5fd', il: '#60a5fa', gate: '#fde047',
      ok: '#4ade80', warn: '#fde047', bad: '#f87171', none: '#a9b6c9',
      s_trafo: '#fbbf24', s_gleich: '#2dd4bf', s_sieb: '#38bdf8', s_regel: '#c084fc', s_schalt: '#f472b6', s_last: '#a3e635'
    },
    light: {
      bg: '#ffffff', panel: '#f1f5f9', fg: '#0f172a', mute: '#475569', grid: '#cbd5e1', line: '#64748b', beamHalo: '#0f172a',
      in: '#b45309', out: '#15803d', loss: '#b91c1c', gnd: '#475569', sw: '#6d28d9', il: '#1d4ed8', gate: '#854d0e',
      ok: '#15803d', warn: '#854d0e', bad: '#b91c1c', none: '#475569',
      s_trafo: '#92400e', s_gleich: '#0f766e', s_sieb: '#0369a1', s_regel: '#7e22ce', s_schalt: '#be185d', s_last: '#4d7c0f'
    }
  };
  /* Stufen (eine Tabelle fuer Name, Kurzzeichen und Farbschluessel; Kurzzeichen = Zweitcodierung neben der Farbe) */
  const STUFEN = {
    trafo: { name: 'Transformator', sym: 'T', key: 's_trafo' },
    gleich: { name: 'Gleichrichtung', sym: 'G', key: 's_gleich' },
    sieb: { name: 'Glättung', sym: 'C', key: 's_sieb' },
    regel: { name: 'Regelung', sym: 'R', key: 's_regel' },
    schalt: { name: 'Schalten', sym: 'S', key: 's_schalt' },
    last: { name: 'Last', sym: 'L', key: 's_last' }
  };
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
  /* Zahl mit SI-Vorsatz und Einheit: fe(0.0227,'V') = '22,7 mV' ; ohne Einheit nur Zahl mit Vorsatz */
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

  /* Ampel: Symbol und Text (nie nur Farbe) */
  const AMPEL = {
    gruen: { sym: '✓', text: 'grün: Auslegung trägt', key: 'ok' },
    gelb: { sym: '!', text: 'gelb: knapp', key: 'warn' },
    rot: { sym: '✗', text: 'rot: Grenze verletzt', key: 'bad' },
    grau: { sym: '–', text: 'grau: noch nicht bewertet', key: 'none' }
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
    return 'Ampel ' + a.text + (t ? '. ' + t : '') + '. Grün heißt nicht: gefahrlos anfassen.';
  }

  /* ------------------------------------------------------------------ Zeichen-Grundlagen */
  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && typeof ctx.save === 'function' && typeof ctx.restore === 'function' &&
      typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function' &&
      typeof ctx.stroke === 'function' && typeof ctx.fill === 'function' && typeof ctx.fillText === 'function';
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
    const o = obj(opts), P = palette(o.theme), q = qOf(o);
    return { P, q, qf: qFac(q), reduced: o.reduced === true, t: fin(o.t) ? o.t : 0, bgOn: o.bg !== false, box: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, narrow: rect.w < 460 };
  }
  function bgFill(ctx, E) { if (E.bgOn) { ctx.fillStyle = E.P.bg; ctx.fillRect(E.box.x, E.box.y, E.box.w, E.box.h); } }
  function stufeOf(id, P) {
    const s = STUFEN[id] || null;
    return s ? { name: s.name, sym: s.sym, color: P[s.key] } : { name: 'Stufe', sym: '?', color: P.gnd };
  }
  const nums = (d, keys) => keys.every(k => fin(d[k]));

  /* ------------------------------------------------------------------ Ampel und Stufenkette */
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
  function chainBar(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 60, 24);
    if (!E || !Array.isArray(d.steps) || d.steps.length < 1 || d.steps.length > 10) return false;
    const steps = d.steps.filter(s => s && typeof s === 'object' && STUFEN[s.stufe]);
    if (!steps.length) return false;
    const P = E.P, n = steps.length, gap = 14, bw = (rect.w - 8 - gap * (n - 1)) / n, bh = Math.min(rect.h - 6, 40), y0 = rect.y + (rect.h - bh) / 2;
    return draw(ctx, () => {
      bgFill(ctx, E);
      steps.forEach((s, i) => {
        const x0 = rect.x + 4 + i * (bw + gap), st = stufeOf(s.stufe, P), a = ampelInfo(s.state);
        ctx.fillStyle = P.panel; rrect(ctx, x0, y0, bw, bh, 6); ctx.fill();
        ctx.strokeStyle = st.color; ctx.lineWidth = s.state === 'rot' ? 3 : 2; rrect(ctx, x0, y0, bw, bh, 6); ctx.stroke();
        const tag = st.sym + ' ' + (str(s.text) || st.name);
        T(ctx, E.box, P, tag, x0 + bw / 2, y0 + bh / 2 - (s.state ? 7 : 0), { maxw: bw - 6, color: P.fg, bold: true, bg: false, size: 11 });
        if (s.state) T(ctx, E.box, P, a.sym + ' ' + a.text.split(':')[0], x0 + bw / 2, y0 + bh / 2 + 9, { maxw: bw - 6, color: P[a.key], bg: false, size: 11 });
        if (i < n - 1) arrow(ctx, x0 + bw + 1, y0 + bh / 2, x0 + bw + gap - 1, y0 + bh / 2, P.gnd, 2, null, 7);
      });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Blockschaltbild mit Leistungsbilanz */
  function blockDiagram(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 120, 90);
    if (!E || !fin(d.pIn) || d.pIn < 0 || !fin(d.pOut) || d.pOut < 0 || !Array.isArray(d.blocks) || d.blocks.length < 1 || d.blocks.length > 8) return false;
    const bl = d.blocks.map(b => obj(b));
    if (!bl.every(b => STUFEN[b.stufe] && fin(b.pLoss) && b.pLoss >= 0)) return false;
    const P = E.P, n = bl.length, pIn = Math.max(d.pIn, 1e-9);
    const eta = fin(d.eta) ? cl(d.eta, 0, 1.5) : (d.pIn > 0 ? d.pOut / d.pIn : NaN);
    const sumLoss = bl.reduce((s, b) => s + b.pLoss, 0);
    const widthOf = p => 2 + 5 * cl(p / pIn, 0, 1);
    return draw(ctx, () => {
      bgFill(ctx, E);
      const b0 = E.box;
      if (!E.narrow) {
        const mx = 8, topY = rect.y + 34, gap = 22, bw = (rect.w - 2 * mx - gap * (n + 1) + gap) / n, bh = Math.min(54, rect.h * 0.34);
        const by = topY + 10, bar0 = by + bh + 18, barH = 9;
        let p = d.pIn;
        T(ctx, b0, P, 'P_zu ' + fe(d.pIn, 'W'), rect.x + mx, rect.y + 12, { align: 'left', color: P.in, bold: true });
        T(ctx, b0, P, 'P_ab ' + fe(d.pOut, 'W'), rect.x + rect.w - mx, rect.y + 12, { align: 'right', color: P.out, bold: true });
        for (let i = 0; i < n; i++) {
          const b = bl[i], st = stufeOf(b.stufe, P), x0 = rect.x + mx + gap + i * (bw + gap);
          arrow(ctx, x0 - gap, by + bh / 2, x0, by + bh / 2, i === 0 ? P.in : P.gnd, widthOf(p), null, 8);
          ctx.fillStyle = P.panel; rrect(ctx, x0, by, bw, bh, 7); ctx.fill();
          ctx.strokeStyle = st.color; ctx.lineWidth = 2.5; rrect(ctx, x0, by, bw, bh, 7); ctx.stroke();
          T(ctx, b0, P, st.sym + ' ' + (str(b.name) || st.name), x0 + bw / 2, by + 15, { maxw: bw - 6, bold: true, bg: false, size: 11 });
          if (str(b.text)) T(ctx, b0, P, b.text, x0 + bw / 2, by + 33, { maxw: bw - 6, bg: false, size: 11, color: P.mute });
          p = Math.max(0, p - b.pLoss);
          /* Verlustbalken */
          ctx.fillStyle = P.grid; ctx.fillRect(x0, bar0, bw, barH);
          const frac = cl(b.pLoss / pIn, 0, 1), fw = b.pLoss > 0 ? Math.max(3, bw * frac) : 0;
          if (fw > 0) { ctx.fillStyle = P.loss; ctx.fillRect(x0, bar0, Math.min(bw, fw), barH); }
          arrow(ctx, x0 + bw / 2, by + bh + 1, x0 + bw / 2, bar0 - 1, P.loss, 1.5, [3, 2], 6);
          T(ctx, b0, P, 'P_V ' + fe(b.pLoss, 'W'), x0 + bw / 2, bar0 + barH + 11, { maxw: bw, color: P.loss, size: 11 });
        }
        const lx = rect.x + mx + gap + (n - 1) * (bw + gap) + bw;
        arrow(ctx, lx, by + bh / 2, lx + gap - 2, by + bh / 2, P.out, widthOf(p), null, 8);
        T(ctx, b0, P, 'η = ' + (fin(eta) ? fz(eta * 100, 1) + ' %' : '–') + '   Σ P_V = ' + fe(sumLoss, 'W'), rect.x + rect.w / 2, rect.y + rect.h - 10, { bold: true });
      } else {
        const topH = 22, botH = 22, rowH = Math.max(30, Math.min(48, (rect.h - topH - botH - 6) / n)), mx = 6, bw = rect.w * 0.52;
        let p = d.pIn;
        T(ctx, b0, P, 'P_zu ' + fe(d.pIn, 'W'), rect.x + mx, rect.y + 10, { align: 'left', color: P.in, bold: true });
        T(ctx, b0, P, 'P_ab ' + fe(d.pOut, 'W'), rect.x + rect.w - mx, rect.y + 10, { align: 'right', color: P.out, bold: true });
        for (let i = 0; i < n; i++) {
          const b = bl[i], st = stufeOf(b.stufe, P), y0 = rect.y + topH + i * rowH, h = rowH - 8, x0 = rect.x + mx;
          arrow(ctx, x0 + bw / 2, y0 - 6, x0 + bw / 2, y0, i === 0 ? P.in : P.gnd, widthOf(p), null, 6);
          ctx.fillStyle = P.panel; rrect(ctx, x0, y0, bw, h, 6); ctx.fill();
          ctx.strokeStyle = st.color; ctx.lineWidth = 2.5; rrect(ctx, x0, y0, bw, h, 6); ctx.stroke();
          T(ctx, b0, P, st.sym + ' ' + (str(b.name) || st.name), x0 + bw / 2, y0 + h / 2, { maxw: bw - 6, bold: true, bg: false, size: 11 });
          p = Math.max(0, p - b.pLoss);
          const lx = x0 + bw + 10, lw = rect.x + rect.w - mx - lx, frac = cl(b.pLoss / pIn, 0, 1);
          ctx.fillStyle = P.grid; ctx.fillRect(lx, y0 + h / 2 + 2, lw, 8);
          if (b.pLoss > 0) { ctx.fillStyle = P.loss; ctx.fillRect(lx, y0 + h / 2 + 2, Math.min(lw, Math.max(3, lw * frac)), 8); }
          T(ctx, b0, P, 'P_V ' + fe(b.pLoss, 'W'), lx, y0 + h / 2 - 8, { align: 'left', maxw: lw, color: P.loss, size: 11 });
        }
        T(ctx, b0, P, 'η = ' + (fin(eta) ? fz(eta * 100, 1) + ' %' : '–') + '  Σ P_V = ' + fe(sumLoss, 'W'), rect.x + rect.w / 2, rect.y + rect.h - 10, { bold: true });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Transformator */
  function trafoCore(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 120, 100);
    if (!E || !fin(d.n1) || !fin(d.n2) || d.n1 <= 0 || d.n2 <= 0) return false;
    const P = E.P, dc = d.dc === true, b0 = E.box;
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2 - 6;
    const cw = Math.min(rect.w * 0.62, 260), ch = Math.min(rect.h * 0.56, 150), x0 = cx - cw / 2, y0 = cy - ch / 2, th = Math.max(14, cw * 0.14);
    const nmax = Math.max(d.n1, d.n2), loops = n => cl(Math.round(n / nmax * 8), 2, 8);
    return draw(ctx, () => {
      bgFill(ctx, E);
      ctx.fillStyle = P.panel; ctx.fillRect(x0, y0, cw, ch);
      ctx.strokeStyle = P.gnd; ctx.lineWidth = 2; ctx.strokeRect(x0, y0, cw, ch);
      ctx.fillStyle = P.bg; ctx.fillRect(x0 + th, y0 + th, cw - 2 * th, ch - 2 * th);
      ctx.strokeStyle = P.gnd; ctx.strokeRect(x0 + th, y0 + th, cw - 2 * th, ch - 2 * th);
      /* Wicklungen auf den Schenkeln */
      function coil(xc, n, color) {
        const k = loops(n), top = y0 + th + 4, hh = ch - 2 * th - 8, step = hh / k;
        ctx.strokeStyle = color; ctx.lineWidth = 3;
        for (let i = 0; i < k; i++) { ctx.beginPath(); ctx.moveTo(xc - th * 0.62, top + i * step + step * 0.2); ctx.lineTo(xc + th * 0.62, top + i * step + step * 0.8); ctx.stroke(); }
      }
      coil(x0 + th / 2, d.n1, P.in); coil(x0 + cw - th / 2, d.n2, P.out);
      /* Feldlinien */
      if (!dc) {
        const off = E.reduced ? 0 : -E.t * 18;
        const fx0 = x0 + th / 2 + th * 0.0, fx1 = x0 + cw - th / 2, fy0 = y0 + th / 2, fy1 = y0 + ch - th / 2;
        ctx.strokeStyle = P.il; ctx.lineWidth = 2; setDash(ctx, [7, 5], off);
        ctx.beginPath(); ctx.moveTo(fx0, fy0); ctx.lineTo(fx1, fy0); ctx.lineTo(fx1, fy1); ctx.lineTo(fx0, fy1); ctx.closePath(); ctx.stroke(); setDash(ctx, [], 0);
        arrowHead(ctx, fx0 + 20, fy0, fx0 + 34, fy0, P.il, 9);
        T(ctx, b0, P, 'Wechselfluss Φ', cx, y0 + ch / 2, { color: P.il, bold: true, maxw: cw - 2 * th - 8 });
      } else {
        const mw = cw - 2 * th - 6;
        T(ctx, b0, P, 'Gleichspannung:', cx, y0 + ch / 2 - 21, { color: P.loss, bold: true, maxw: mw, size: 11 });
        T(ctx, b0, P, 'kein Wechselfluss', cx, y0 + ch / 2 - 7, { color: P.loss, bold: true, maxw: mw, size: 11 });
        T(ctx, b0, P, 'Strom nur durch', cx, y0 + ch / 2 + 9, { color: P.mute, maxw: mw, size: 11 });
        T(ctx, b0, P, 'Wicklungswiderstand', cx, y0 + ch / 2 + 23, { color: P.mute, maxw: mw, size: 11 });
      }
      const side = (xc, tag, n, u, i, color, al) => {
        T(ctx, b0, P, tag + ' = ' + fz(n, 0) + ' Wdg.', xc, y0 + ch + 12, { color, bold: true, maxw: rect.w * 0.45, align: al });
        const l2 = (fin(u) ? 'U = ' + fe(u, 'V') : '') + (fin(u) && fin(i) ? '   ' : '') + (fin(i) ? 'I = ' + fe(i, 'A') : '');
        if (l2) T(ctx, b0, P, l2, xc, y0 - 10, { color, maxw: rect.w * 0.45, align: al });
      };
      side(rect.x + 6, 'N1', d.n1, d.u1, d.i1, P.in, 'left');
      side(rect.x + rect.w - 6, 'N2', d.n2, d.u2, d.i2, P.out, 'right');
      T(ctx, b0, P, 'ü = N1/N2 = ' + fz(d.n1 / d.n2, 2), cx, rect.y + rect.h - 8, { bold: true });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Gleichrichter */
  function bridgePath(kind, half) {
    const h = half === -1 ? -1 : 1;
    if (kind === 'einweg') return h === 1 ? ['D1'] : [];
    return h === 1 ? ['D1', 'D4'] : ['D2', 'D3'];
  }
  function diodeGlyph(ctx, x0, y0, x1, y1, on, P, size) {
    /* Diode von (x0,y0) nach (x1,y1), Pfeilrichtung = Durchlassrichtung */
    const L = Math.hypot(x1 - x0, y1 - y0); if (!(L > 0)) return;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, mx = (x0 + x1) / 2, my = (y0 + y1) / 2, s = size, col = on ? P.out : P.gnd, w = on ? 3.5 : 2;
    line(ctx, x0, y0, mx - ux * s * 0.6, my - uy * s * 0.6, col, w);
    line(ctx, mx + ux * s * 0.6, my + uy * s * 0.6, x1, y1, col, w);
    ctx.fillStyle = on ? P.out : P.panel; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(mx - ux * s * 0.6 - uy * s * 0.6, my - uy * s * 0.6 + ux * s * 0.6); ctx.lineTo(mx - ux * s * 0.6 + uy * s * 0.6, my - uy * s * 0.6 - ux * s * 0.6);
    ctx.lineTo(mx + ux * s * 0.6, my + uy * s * 0.6); ctx.closePath(); ctx.fill(); ctx.stroke();
    line(ctx, mx + ux * s * 0.6 - uy * s * 0.7, my + uy * s * 0.6 + ux * s * 0.7, mx + ux * s * 0.6 + uy * s * 0.7, my + uy * s * 0.6 - ux * s * 0.7, col, w + 0.5);
  }
  function rectifierScene(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 110);
    if (!E) return false;
    const kind = d.kind === 'einweg' ? 'einweg' : 'bruecke', half = d.half === -1 ? -1 : 1, on = bridgePath(kind, half), P = E.P, b0 = E.box;
    const cx = rect.x + rect.w * 0.42, cy = rect.y + rect.h * 0.46, R = Math.min(rect.w * 0.2, rect.h * 0.26, 60), ds = Math.max(6, R * 0.2);
    const lx = rect.x + rect.w * 0.82;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const lead = (pts, hot) => polyline(ctx, pts, hot ? P.out : P.gnd, hot ? 3.5 : 2);
      const sx = rect.x + rect.w * 0.08;
      if (kind === 'bruecke') {
        const A = [cx - R, cy], B = [cx + R, cy], Tp = [cx, cy - R], Bt = [cx, cy + R];
        /* Quelle links an A und B (Quelle als Kreis, Rueckleiter unten) */
        ctx.strokeStyle = P.in; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, cy, 13, 0, TAU); ctx.stroke();
        T(ctx, b0, P, '~', sx, cy, { color: P.in, bold: true, bg: false, size: 14 });
        line(ctx, sx + 13, cy, A[0], A[1], P.in, 2);
        line(ctx, B[0], B[1], B[0] + 14, B[1], P.in, 2);
        diodeGlyph(ctx, A[0], A[1], Tp[0], Tp[1], on.indexOf('D1') >= 0, P, ds);   /* D1: A nach plus */
        diodeGlyph(ctx, B[0], B[1], Tp[0], Tp[1], on.indexOf('D2') >= 0, P, ds);   /* D2: B nach plus */
        diodeGlyph(ctx, Bt[0], Bt[1], A[0], A[1], on.indexOf('D3') >= 0, P, ds);   /* D3: minus nach A */
        diodeGlyph(ctx, Bt[0], Bt[1], B[0], B[1], on.indexOf('D4') >= 0, P, ds);   /* D4: minus nach B */
        [[A, 'D1', -1, -1], [B, 'D2', 1, -1], [A, 'D3', -1, 1], [B, 'D4', 1, 1]].forEach(q => T(ctx, b0, P, q[1], cx + q[2] * R * 0.62 + (q[2] > 0 ? 10 : -10), cy + q[3] * R * 0.62 + (q[3] > 0 ? 6 : -6), { color: on.indexOf(q[1]) >= 0 ? P.out : P.mute, bold: on.indexOf(q[1]) >= 0, size: 11 }));
        lead([[Tp[0], Tp[1]], [Tp[0], rect.y + 12], [lx, rect.y + 12], [lx, cy - 22]], false);
        lead([[Bt[0], Bt[1]], [Bt[0], rect.y + rect.h - 26], [lx, rect.y + rect.h - 26], [lx, cy + 22]], false);
        T(ctx, b0, P, '+', Tp[0] + 9, Tp[1] - 4, { color: P.out, bold: true, size: 12 });
        T(ctx, b0, P, '−', Bt[0] + 9, Bt[1] + 4, { color: P.gnd, bold: true, size: 12 });
      } else {
        const ax = cx - R * 0.6, bx = cx + R * 0.6;
        ctx.strokeStyle = P.in; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, cy, 13, 0, TAU); ctx.stroke();
        T(ctx, b0, P, '~', sx, cy, { color: P.in, bold: true, bg: false, size: 14 });
        line(ctx, sx + 13, cy - 6, ax, cy - 6, P.in, 2);
        diodeGlyph(ctx, ax, cy - 6, bx, cy - 6, on.length > 0, P, ds);
        T(ctx, b0, P, 'D1', cx, cy - 22, { color: on.length ? P.out : P.mute, bold: on.length > 0, size: 11 });
        lead([[bx, cy - 6], [lx, cy - 6], [lx, cy - 22]], false);
        lead([[sx, cy + 13], [sx, rect.y + rect.h - 26], [lx, rect.y + rect.h - 26], [lx, cy + 22]], false);
      }
      /* Last (und Ladekondensator) rechts */
      const hasC = d.c !== false;
      ctx.fillStyle = P.panel; ctx.strokeStyle = P.out; ctx.lineWidth = 2; ctx.fillRect(lx - 9, cy - 22, 18, 44); ctx.strokeRect(lx - 9, cy - 22, 18, 44);
      T(ctx, b0, P, str(d.rl) || 'Last', lx, cy, { color: P.fg, size: 11, maxw: 30, bg: false });
      if (hasC) { const px = lx - 22; line(ctx, px - 8, cy - 4, px + 8, cy - 4, P.il, 2.5); line(ctx, px - 8, cy + 4, px + 8, cy + 4, P.il, 2.5); T(ctx, b0, P, 'C', px - 12, cy - 12, { color: P.il, bold: true, size: 11, align: 'right' }); }
      /* Text */
      const path = on.length ? 'Strompfad über ' + on.join(' und ') : 'Halbwelle sperrt: Strom fließt aus dem Kondensator';
      T(ctx, b0, P, (half === 1 ? 'positive' : 'negative') + ' Halbwelle: ' + path, rect.x + rect.w / 2, rect.y + rect.h - 9, { maxw: rect.w - 8, color: on.length ? P.out : P.mute, bold: true, size: 11 });
      const ul = [];
      if (fin(d.uf)) ul.push('U_F je Diode ' + fe(d.uf, 'V') + ', im Pfad ' + (kind === 'bruecke' ? 2 : 1) + '×');
      if (fin(d.uPeak)) ul.push('Û = ' + fe(d.uPeak, 'V'));
      if (ul.length) T(ctx, b0, P, ul.join('   '), rect.x + rect.w / 2, rect.y + 10, { maxw: rect.w - 8, size: 11, color: P.mute });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Oszilloskop-Anzeige (Spuren) */
  const TRACE_COLORS = ['in', 'out', 'il', 'sw', 'gate', 'loss', 'gnd'];
  const TRACE_DASH = [[], [7, 3], [2, 3], [9, 3, 2, 3]];
  function tracePts(tr, maxN) {
    if (!tr || typeof tr !== 'object') return null;
    let pts = null;
    if (Array.isArray(tr.points)) {
      pts = [];
      for (let i = 0; i < tr.points.length && i < 50000; i++) {
        const p = tr.points[i];
        if (!Array.isArray(p) || !fin(p[0]) || !fin(p[1])) return null;
        pts.push([p[0], p[1]]);
      }
    } else if (Array.isArray(tr.y) && fin(tr.dt) && tr.dt > 0) {
      const t0 = fin(tr.t0) ? tr.t0 : 0; pts = [];
      for (let i = 0; i < tr.y.length && i < 50000; i++) { if (!fin(tr.y[i])) return null; pts.push([t0 + i * tr.dt, tr.y[i]]); }
    }
    if (!pts || pts.length < 2) return null;
    if (pts.length > maxN) { const out = [], step = (pts.length - 1) / (maxN - 1); for (let i = 0; i < maxN; i++) out.push(pts[Math.round(i * step)]); pts = out; }
    return pts;
  }
  function interp(pts, t) {
    if (t <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const a = pts[i - 1], b = pts[i], f = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], f); }
    return pts[pts.length - 1][1];
  }
  function scopeLayout(rect, data, opts) {
    const d = obj(data), o = obj(opts), maxN = Math.round(600 * qFac(qOf(o)));
    if (!rectOk(rect, 80, 60) || !Array.isArray(d.traces)) return null;
    const tr = [];
    d.traces.slice(0, 4).forEach((t, i) => { const pts = tracePts(t, maxN); if (pts) tr.push({ src: t, pts, i }); });
    if (!tr.length) return null;
    let t0 = Infinity, t1 = -Infinity;
    tr.forEach(q => { t0 = Math.min(t0, q.pts[0][0]); t1 = Math.max(t1, q.pts[q.pts.length - 1][0]); });
    if (Array.isArray(d.tRange) && fin(d.tRange[0]) && fin(d.tRange[1]) && d.tRange[1] > d.tRange[0]) { t0 = d.tRange[0]; t1 = d.tRange[1]; }
    if (!(t1 > t0)) return null;
    const left = 44, right = 8, top = 6, bottom = 20;
    const plot = { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
    if (plot.w < 30 || plot.h < 30) return null;
    const lh = plot.h / tr.length, lanes = tr.map((q, k) => {
      let lo = Infinity, hi = -Infinity; q.pts.forEach(p => { lo = Math.min(lo, p[1]); hi = Math.max(hi, p[1]); });
      if (hi - lo < 1e-12 * Math.max(1, Math.abs(hi))) { const m = Math.abs(hi) > 0 ? Math.abs(hi) * 0.2 : 1; lo -= m; hi += m; }
      const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
      return Object.assign(q, { y0: plot.y + k * lh, y1: plot.y + (k + 1) * lh, min: lo, max: hi });
    });
    return { plot, lanes, t0, t1, xAt: t => plot.x + (t - t0) / (t1 - t0) * plot.w, tAt: x => t0 + (x - plot.x) / plot.w * (t1 - t0) };
  }
  function scope(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 80, 60);
    if (!E) return false;
    const L = scopeLayout(rect, d, opts);
    if (!L) return false;
    const P = E.P, b0 = E.box, pl = L.plot;
    return draw(ctx, () => {
      bgFill(ctx, E);
      ctx.fillStyle = P.panel; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
      /* Raster: zehn Zeitteilungen, Mittellinie je Spur */
      ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const x = pl.x + pl.w * i / 10; ctx.moveTo(x, pl.y); ctx.lineTo(x, pl.y + pl.h); }
      L.lanes.forEach(l => { const ym = (l.y0 + l.y1) / 2; ctx.moveTo(pl.x, ym); ctx.lineTo(pl.x + pl.w, ym); ctx.moveTo(pl.x, l.y1); ctx.lineTo(pl.x + pl.w, l.y1); });
      ctx.stroke();
      ctx.strokeStyle = P.line; ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
      /* Zeitachse */
      for (let i = 0; i <= 5; i++) T(ctx, b0, P, fe(L.t0 + (L.t1 - L.t0) * i / 5, 's'), pl.x + pl.w * i / 5, rect.y + rect.h - 8, { size: 11, color: P.mute, bg: false });
      const ghost = Array.isArray(d.ghost) ? d.ghost : [];
      L.lanes.forEach((l, k) => {
        const colKey = TRACE_COLORS.indexOf(l.src.color) >= 0 ? l.src.color : TRACE_COLORS[k % TRACE_COLORS.length], col = P[colKey], dash = TRACE_DASH[k % TRACE_DASH.length];
        const yOf = v => l.y1 - (v - l.min) / (l.max - l.min) * (l.y1 - l.y0);
        ctx.save(); ctx.beginPath(); ctx.rect(pl.x, l.y0, pl.w, l.y1 - l.y0); ctx.clip();
        const g = ghost.find(q => q && q.name === l.src.name), gp = g ? tracePts(g, 600) : null;
        if (gp) polyline(ctx, gp.map(p => [L.xAt(p[0]), cl(yOf(p[1]), l.y0, l.y1)]), P.gnd, 1.5, [2, 4]);
        polyline(ctx, l.pts.map(p => [L.xAt(p[0]), cl(yOf(p[1]), l.y0 - 1, l.y1 + 1)]), col, 2, dash);
        ctx.restore();
        /* Spurkopf: Strichprobe, Name, Einheit; Werte-Ticks links */
        const nm = (str(l.src.name) || 'Spur ' + (k + 1)) + (str(l.src.unit) ? ' in ' + l.src.unit : '') + (gp ? ' (gestrichelt grau: vorher)' : '');
        line(ctx, pl.x + 5, l.y0 + 9, pl.x + 21, l.y0 + 9, col, 2, dash);
        T(ctx, b0, P, nm, pl.x + 25, l.y0 + 9, { align: 'left', color: col, bold: true, size: 11, maxw: pl.w - 30 });
        T(ctx, b0, P, fe(l.max, ''), pl.x - 3, l.y0 + 8, { align: 'right', size: 11, color: P.mute, bg: false, maxw: 40 });
        T(ctx, b0, P, fe(l.min, ''), pl.x - 3, l.y1 - 8, { align: 'right', size: 11, color: P.mute, bg: false, maxw: 40 });
      });
      if (fin(d.cursor) && d.cursor >= L.t0 && d.cursor <= L.t1) {
        const cx = L.xAt(d.cursor);
        line(ctx, cx, pl.y, cx, pl.y + pl.h, P.fg, 1, [4, 3]);
        L.lanes.forEach((l, k) => {
          const v = interp(l.pts, d.cursor), colKey = TRACE_COLORS.indexOf(l.src.color) >= 0 ? l.src.color : TRACE_COLORS[k % TRACE_COLORS.length];
          const yy = l.y1 - (v - l.min) / (l.max - l.min) * (l.y1 - l.y0);
          dot(ctx, cx, cl(yy, l.y0, l.y1), 3, P[colKey]);
          const right = cx > pl.x + pl.w * 0.7;
          T(ctx, b0, P, fe(v, str(l.src.unit)), cx + (right ? -6 : 6), l.y0 + 24, { align: right ? 'right' : 'left', size: 11, color: P[colKey], bold: true });
        });
        T(ctx, b0, P, 't = ' + fe(d.cursor, 's'), cx, pl.y + pl.h - 9, { size: 11, bold: true });
      }
      if (fin(d.beam)) { /* Schreibstrahl: Punkt auf der ersten Spur, Halo statt Blinken */
        const l = L.lanes[0], tb = L.t0 + cl(d.beam, 0, 1) * (L.t1 - L.t0), v = interp(l.pts, tb), yy = l.y1 - (v - l.min) / (l.max - l.min) * (l.y1 - l.y0);
        dot(ctx, L.xAt(tb), cl(yy, l.y0, l.y1), 5, P.beamHalo); dot(ctx, L.xAt(tb), cl(yy, l.y0, l.y1), 3, P[TRACE_COLORS.indexOf(l.src.color) >= 0 ? l.src.color : 'in']);
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ gemeinsames Achsengeruest fuer Kennlinien */
  function axes(ctx, E, rect, xmax, ymax, xl, yl, xu, yu) {
    const P = E.P, left = 44, bottom = 28, top = 14, right = 12;
    const pl = { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
    if (pl.w < 30 || pl.h < 20) return null;
    const X = x => pl.x + cl(x / xmax, -0.05, 1.1) * pl.w, Y = y => pl.y + pl.h - cl(y / ymax, -0.05, 1.1) * pl.h;
    ctx.fillStyle = P.panel; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < 5; i++) { ctx.moveTo(pl.x + pl.w * i / 5, pl.y); ctx.lineTo(pl.x + pl.w * i / 5, pl.y + pl.h); ctx.moveTo(pl.x, pl.y + pl.h * i / 5); ctx.lineTo(pl.x + pl.w, pl.y + pl.h * i / 5); }
    ctx.stroke(); ctx.strokeStyle = P.line; ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
    for (let i = 0; i <= 5; i++) {
      T(ctx, E.box, P, fz(xmax * i / 5, xmax >= 20 ? 0 : 1), pl.x + pl.w * i / 5, rect.y + rect.h - 15, { size: 11, color: P.mute, bg: false });
      T(ctx, E.box, P, fz(ymax * i / 5, ymax >= 20 ? 0 : 1), pl.x - 4, pl.y + pl.h - pl.h * i / 5, { size: 11, color: P.mute, align: 'right', bg: false, maxw: 38 });
    }
    T(ctx, E.box, P, xl + ' in ' + xu, pl.x + pl.w, rect.y + rect.h - 4, { size: 11, color: P.fg, align: 'right', bg: false, maxw: pl.w });
    T(ctx, E.box, P, yl + ' in ' + yu, rect.x + 3, rect.y + 7, { size: 11, color: P.fg, align: 'left', bg: false, maxw: rect.w - 6 });
    return { pl, X, Y };
  }

  /* ------------------------------------------------------------------ Z-Diode */
  function zenerChart(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 120, 100);
    if (!E || !fin(d.uz) || d.uz <= 0) return false;
    const rz = fin(d.rz) && d.rz > 0 ? d.rz : 10, izMin = fin(d.izMin) && d.izMin >= 0 ? d.izMin : 0.005;
    const izMax = fin(d.izMax) && d.izMax > izMin ? d.izMax : Math.max(izMin * 8, 0.05);
    const yTop = izMax * 1.35, uMax = d.uz + rz * yTop * 1.2 + d.uz * 0.1, P = E.P, b0 = E.box;
    const iAt = u => (u < d.uz ? izMin * 0.02 * Math.exp((u - d.uz) / (0.04 * d.uz)) : izMin * 0.02 + (u - d.uz) / rz);
    return draw(ctx, () => {
      bgFill(ctx, E);
      const A = axes(ctx, E, { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, uMax, yTop * 1000, 'I', 'U', 'mA', 'V');
      if (!A) return false;
      /* Arbeitsbereich zwischen I_Z,min und I_Z,max */
      ctx.fillStyle = P.panel; ctx.globalAlpha = 1;
      const ya = A.Y(izMax * 1000), yb = A.Y(izMin * 1000);
      ctx.strokeStyle = P.ok; ctx.lineWidth = 6; setDash(ctx, []);
      line(ctx, A.pl.x + 2, ya, A.pl.x + 2, yb, P.ok, 6);
      line(ctx, A.pl.x, yb, A.pl.x + A.pl.w, yb, P.warn, 1.5, [6, 3]);
      line(ctx, A.pl.x, ya, A.pl.x + A.pl.w, ya, P.bad, 1.5, [6, 3]);
      const n = Math.max(20, Math.round(120 * E.qf)), pts = [];
      for (let i = 0; i <= n; i++) { const u = uMax * i / n; pts.push([A.X(u), A.Y(iAt(u) * 1000)]); }
      polyline(ctx, pts, P.sw, 2.5);
      T(ctx, b0, P, 'I_Z,max ' + fe(izMax, 'A'), A.pl.x + A.pl.w - 4, ya - 8, { align: 'right', color: P.bad, size: 11 });
      T(ctx, b0, P, 'I_Z,min ' + fe(izMin, 'A'), A.pl.x + A.pl.w - 4, yb + 9, { align: 'right', color: P.warn, size: 11 });
      T(ctx, b0, P, 'U_Z = ' + fe(d.uz, 'V'), A.X(d.uz), A.pl.y + A.pl.h - 8, { color: P.sw, bold: true, size: 11, align: d.uz / uMax > 0.5 ? 'right' : 'left' });
      line(ctx, A.X(d.uz), A.pl.y + A.pl.h, A.X(d.uz), A.pl.y + A.pl.h - 14, P.sw, 2);
      if (fin(d.iz)) {
        const u = d.uz + (d.iz - izMin * 0.02) * rz;
        const status = d.iz < izMin ? 'unter I_Z,min: Z-Diode stabilisiert nicht' : d.iz > izMax ? 'über I_Z,max: Diode überlastet' : 'im Arbeitsbereich';
        dot(ctx, A.X(u), A.Y(d.iz * 1000), 5, P.fg); dot(ctx, A.X(u), A.Y(d.iz * 1000), 3, d.iz < izMin || d.iz > izMax ? P.bad : P.ok);
        T(ctx, b0, P, 'I_Z = ' + fe(d.iz, 'A') + ': ' + status, rect.x + rect.w / 2, rect.y + 24, { size: 11, bold: true, color: d.iz < izMin || d.iz > izMax ? P.bad : P.ok, maxw: rect.w - 8 });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Linearregler */
  function linearReg(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 160, 110);
    if (!E || !nums(d, ['uIn', 'uOut', 'i']) || d.uIn < 0 || d.uOut < 0 || d.i < 0) return false;
    const P = E.P, b0 = E.box, pV = fin(d.pV) ? d.pV : Math.max(0, (d.uIn - d.uOut) * d.i), pIn = d.uIn * d.i;
    const eta = fin(d.eta) ? d.eta : (d.uIn > 0 ? d.uOut / d.uIn : NaN);
    const bw = Math.min(rect.w * 0.3, 120), bh = Math.min(rect.h * 0.34, 60), bx = rect.x + rect.w / 2 - bw / 2, by = rect.y + 34;
    const dropped = fin(d.dropout) && d.uIn - d.uOut < d.dropout;
    return draw(ctx, () => {
      bgFill(ctx, E);
      T(ctx, b0, P, 'U_ein ' + fe(d.uIn, 'V'), rect.x + 6, by + bh / 2 - 12, { align: 'left', color: P.in, bold: true });
      T(ctx, b0, P, 'U_aus ' + fe(d.uOut, 'V'), rect.x + rect.w - 6, by + bh / 2 - 12, { align: 'right', color: P.out, bold: true });
      arrow(ctx, rect.x + 6, by + bh / 2, bx, by + bh / 2, P.in, 2 + 5 * cl(pIn / Math.max(pIn, 1e-9), 0, 1), null, 9);
      arrow(ctx, bx + bw, by + bh / 2, rect.x + rect.w - 6, by + bh / 2, P.out, 2 + 5 * cl(d.uOut * d.i / Math.max(pIn, 1e-9), 0, 1), null, 9);
      ctx.fillStyle = P.panel; rrect(ctx, bx, by, bw, bh, 7); ctx.fill();
      ctx.strokeStyle = P.s_regel; ctx.lineWidth = 2.5; rrect(ctx, bx, by, bw, bh, 7); ctx.stroke();
      T(ctx, b0, P, str(d.name) || 'Linearregler', bx + bw / 2, by + bh / 2 - 6, { maxw: bw - 6, bold: true, bg: false, size: 11 });
      T(ctx, b0, P, 'I = ' + fe(d.i, 'A'), bx + bw / 2, by + bh / 2 + 11, { maxw: bw - 6, bg: false, size: 11, color: P.mute });
      /* Masse und Verlustleistung als Waerme (Balken), keine Temperatur */
      line(ctx, bx + bw / 2, by + bh, bx + bw / 2, by + bh + 12, P.gnd, 2); line(ctx, bx + bw / 2 - 9, by + bh + 12, bx + bw / 2 + 9, by + bh + 12, P.gnd, 2);
      const hx = bx + bw + 10, tr = Math.min(rect.w * 0.25, 120), hy = by + bh + 22;
      const frac = pIn > 0 ? cl(pV / pIn, 0, 1) : 0;
      ctx.fillStyle = P.grid; ctx.fillRect(rect.x + 8, hy, rect.w - 16, 10);
      if (pV > 0) { ctx.fillStyle = P.loss; ctx.fillRect(rect.x + 8, hy, Math.max(3, (rect.w - 16) * frac), 10); }
      T(ctx, b0, P, 'P_V = (U_ein − U_aus) · I = ' + fe(pV, 'W') + ' als Wärme', rect.x + rect.w / 2, hy + 24, { color: P.loss, bold: true, maxw: rect.w - 8 });
      T(ctx, b0, P, 'η = ' + (fin(eta) ? fz(eta * 100, 1) + ' %' : '–') + '   P_zu = ' + fe(pIn, 'W'), rect.x + rect.w / 2, hy + 41, { maxw: rect.w - 8 });
      if (dropped) T(ctx, b0, P, '✗ Dropout: U_ein − U_aus ' + fe(d.uIn - d.uOut, 'V') + ' unter ' + fe(d.dropout, 'V'), rect.x + rect.w / 2, rect.y + 12, { color: P.bad, bold: true, maxw: rect.w - 8 });
      else if (d.cool === true) T(ctx, b0, P, 'Kühlung: siehe Thermik-Lab', rect.x + rect.w / 2, rect.y + 12, { color: P.warn, bold: true, maxw: rect.w - 8 });
      void hx; void tr;
      return true;
    });
  }

  /* ------------------------------------------------------------------ Wandler-Szene */
  /* Schaltbilder in Einheitskoordinaten 0..100 x 0..60; e = { t, p:[[x,y]..], ph:'on'|'off'|'both'|null, name? } (ph = Strom in dieser Phase) */
  const TOPO = {
    buck: [
      { t: 'src', p: [[10, 12], [10, 50]], ph: 'both' }, { t: 'wire', p: [[10, 12], [18, 12]], ph: 'on' }, { t: 'switch', p: [[18, 12], [34, 12]], ph: 'on', name: 'S' },
      { t: 'wire', p: [[34, 12], [40, 12]], ph: 'on' }, { t: 'coil', p: [[40, 12], [62, 12]], ph: 'both', name: 'L' }, { t: 'wire', p: [[62, 12], [88, 12]], ph: 'both' },
      { t: 'diode', p: [[40, 50], [40, 12]], ph: 'off', name: 'D' }, { t: 'cap', p: [[72, 12], [72, 50]], ph: null, name: 'C' }, { t: 'load', p: [[88, 12], [88, 50]], ph: 'both', name: 'Last' },
      { t: 'wire', p: [[10, 50], [88, 50]], ph: 'both' }
    ],
    boost: [
      { t: 'src', p: [[10, 12], [10, 50]], ph: 'both' }, { t: 'coil', p: [[10, 12], [32, 12]], ph: 'both', name: 'L' }, { t: 'wire', p: [[32, 12], [44, 12]], ph: 'both' },
      { t: 'switch', p: [[44, 12], [44, 50]], ph: 'on', name: 'S' }, { t: 'diode', p: [[44, 12], [64, 12]], ph: 'off', name: 'D' }, { t: 'wire', p: [[64, 12], [88, 12]], ph: 'off' },
      { t: 'cap', p: [[72, 12], [72, 50]], ph: null, name: 'C' }, { t: 'load', p: [[88, 12], [88, 50]], ph: 'off', name: 'Last' }, { t: 'wire', p: [[10, 50], [88, 50]], ph: 'both' }
    ],
    invers: [
      { t: 'src', p: [[10, 12], [10, 50]], ph: 'both' }, { t: 'wire', p: [[10, 12], [18, 12]], ph: 'on' }, { t: 'switch', p: [[18, 12], [34, 12]], ph: 'on', name: 'S' },
      { t: 'wire', p: [[34, 12], [44, 12]], ph: 'both' }, { t: 'coil', p: [[44, 12], [44, 50]], ph: 'both', name: 'L' }, { t: 'diode', p: [[68, 12], [44, 12]], ph: 'off', name: 'D' },
      { t: 'wire', p: [[68, 12], [88, 12]], ph: 'off' }, { t: 'cap', p: [[72, 12], [72, 50]], ph: null, name: 'C' }, { t: 'load', p: [[88, 12], [88, 50]], ph: 'off', name: 'Last' },
      { t: 'wire', p: [[10, 50], [88, 50]], ph: 'both' }
    ],
    sperr: [
      { t: 'src', p: [[10, 12], [10, 50]], ph: 'on' }, { t: 'wire', p: [[10, 12], [32, 12]], ph: 'on' }, { t: 'coil', p: [[32, 12], [32, 34]], ph: 'on', name: 'N1' },
      { t: 'switch', p: [[32, 34], [32, 50]], ph: 'on', name: 'S' }, { t: 'coil', p: [[46, 12], [46, 34]], ph: 'off', name: 'N2' }, { t: 'wire', p: [[46, 34], [46, 50]], ph: 'off' },
      { t: 'diode', p: [[46, 12], [66, 12]], ph: 'off', name: 'D' }, { t: 'wire', p: [[66, 12], [88, 12]], ph: 'off' }, { t: 'cap', p: [[72, 12], [72, 50]], ph: null, name: 'C' },
      { t: 'load', p: [[88, 12], [88, 50]], ph: 'off', name: 'Last' }, { t: 'wire', p: [[10, 50], [88, 50]], ph: 'both' }
    ]
  };
  const TOPO_NAME = { buck: 'Tiefsetzsteller', boost: 'Hochsetzsteller', invers: 'Inverswandler', sperr: 'Sperrwandler' };
  function phasePath(topo, phase) { /* Namen der stromfuehrenden Bauteile in der Phase */
    const t = TOPO[topo]; if (!t || (phase !== 'on' && phase !== 'off')) return [];
    return t.filter(e => e.name && (e.ph === phase || e.ph === 'both')).map(e => e.name);
  }
  function glyph(ctx, e, X, Y, hot, P, on, size) {
    const x0 = X(e.p[0][0]), y0 = Y(e.p[0][1]), x1 = X(e.p[1][0]), y1 = Y(e.p[1][1]);
    const col = hot ? P.il : P.gnd, w = hot ? 3.5 : 2, L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / (L || 1), uy = (y1 - y0) / (L || 1), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (e.t === 'wire') { line(ctx, x0, y0, x1, y1, col, w); return; }
    if (e.t === 'src') {
      line(ctx, x0, y0, x0, y0 + 10, P.in, 2); line(ctx, x1, y1, x1, y1 - 10, P.in, 2);
      ctx.strokeStyle = P.in; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, my, 12, 0, TAU); ctx.stroke();
      line(ctx, mx, y0 + 10, mx, my - 12, P.in, 2); line(ctx, mx, my + 12, mx, y1 - 10, P.in, 2);
      return;
    }
    if (e.t === 'switch') {
      const g = L * 0.2;
      line(ctx, x0, y0, mx - ux * g, my - uy * g, col, w); line(ctx, mx + ux * g, my + uy * g, x1, y1, col, w);
      dot(ctx, mx - ux * g, my - uy * g, 3, P.sw); dot(ctx, mx + ux * g, my + uy * g, 3, P.sw);
      if (on) line(ctx, mx - ux * g, my - uy * g, mx + ux * g, my + uy * g, P.sw, 3.5);
      else line(ctx, mx - ux * g, my - uy * g, mx + ux * g * 0.7 - uy * g * 0.9, my + uy * g * 0.7 + ux * g * 0.9, P.sw, 3.5);
      return;
    }
    if (e.t === 'diode') { diodeGlyph(ctx, x0, y0, x1, y1, hot, { out: P.il, gnd: P.gnd, panel: P.panel }, size); return; }
    if (e.t === 'coil') {
      const k = 4, g = L * 0.1, a = g + L * 0.0, seg = (L - 2 * g) / k;
      line(ctx, x0, y0, x0 + ux * g, y0 + uy * g, col, w); line(ctx, x1, y1, x1 - ux * g, y1 - uy * g, col, w);
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
      for (let i = 0; i < k; i++) { const sx = x0 + ux * (a + i * seg), sy = y0 + uy * (a + i * seg); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + ux * seg * 0.5 - uy * seg * 0.7, sy + uy * seg * 0.5 + ux * seg * 0.7, sx + ux * seg, sy + uy * seg); }
      ctx.stroke(); return;
    }
    if (e.t === 'cap') {
      const g = L * 0.06;
      line(ctx, x0, y0, mx - ux * g, my - uy * g, P.gnd, 2); line(ctx, mx + ux * g, my + uy * g, x1, y1, P.gnd, 2);
      line(ctx, mx - ux * g - uy * 9, my - uy * g + ux * 9, mx - ux * g + uy * 9, my - uy * g - ux * 9, P.il, 3);
      line(ctx, mx + ux * g - uy * 9, my + uy * g + ux * 9, mx + ux * g + uy * 9, my + uy * g - ux * 9, P.il, 3);
      return;
    }
    if (e.t === 'load') {
      const g = L * 0.28;
      line(ctx, x0, y0, mx - ux * g, my - uy * g, col, w); line(ctx, mx + ux * g, my + uy * g, x1, y1, col, w);
      ctx.fillStyle = P.panel; ctx.strokeStyle = P.out; ctx.lineWidth = 2;
      ctx.fillRect(mx - 7, my - g, 14, 2 * g); ctx.strokeRect(mx - 7, my - g, 14, 2 * g);
    }
  }
  function converterScene(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 160, 130);
    if (!E || !TOPO[d.topo] || (d.phase !== 'on' && d.phase !== 'off')) return false;
    const P = E.P, b0 = E.box, els = TOPO[d.topo], ph = d.phase;
    const textH = 40, areaH = rect.h - textH, s = Math.min(rect.w / 100, areaH / 62), ox = rect.x + (rect.w - 100 * s) / 2, oy = rect.y + 4 + (areaH - 62 * s) / 2;
    const X = x => ox + x * s, Y = y => oy + y * s, size = Math.max(7, 4.5 * s);
    return draw(ctx, () => {
      bgFill(ctx, E);
      els.forEach(e => glyph(ctx, e, X, Y, e.ph === ph || e.ph === 'both', P, ph === 'on', size));
      /* Strom-Pfeile (Richtung nur als Teilchen, bei reduced ruhig) */
      const hot = els.filter(e => e.ph === ph || e.ph === 'both');
      const nDots = E.reduced ? 0 : Math.round(3 * E.qf);
      hot.forEach(e => {
        const a = [X(e.p[0][0]), Y(e.p[0][1])], b = [X(e.p[1][0]), Y(e.p[1][1])], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (L < 12 || e.t === 'src' || e.t === 'cap') return;
        const k = Math.max(1, nDots);
        for (let i = 0; i < k; i++) { const f = nDots ? ((E.t * 0.5 + i / k) % 1) : (i + 0.5) / k; dot(ctx, lerp(a[0], b[0], f), lerp(a[1], b[1], f), 2.4, P.fg); }
      });
      els.forEach(e => {
        if (!e.name) return;
        const x = X((e.p[0][0] + e.p[1][0]) / 2), y = Y((e.p[0][1] + e.p[1][1]) / 2), vert = Math.abs(e.p[0][0] - e.p[1][0]) < 1;
        const isHot = e.ph === ph || e.ph === 'both', c = e.name === 'S' ? P.sw : e.name === 'Last' ? P.out : isHot ? P.il : P.mute;
        T(ctx, b0, P, e.name, vert ? x + (e.name === 'C' ? -12 : 14) : x, vert ? y : y - 14, { color: c, bold: true, size: 11, align: 'center' });
      });
      const nm = TOPO_NAME[d.topo], on = ph === 'on';
      const phTxt = d.topo === 'sperr' ? (on ? 'Schalter geschlossen: Übertrager speichert Energie' : 'Schalter offen: Übertrager gibt Energie ab')
        : (on ? 'Schalter geschlossen (Einschaltphase)' : 'Schalter offen (Ausschaltphase)');
      T(ctx, b0, P, nm + ': ' + phTxt, rect.x + rect.w / 2, rect.y + rect.h - 28, { bold: true, color: P.sw, maxw: rect.w - 8, size: 11 });
      const vals = [];
      if (fin(d.d)) vals.push('D = ' + fz(cl(d.d, 0, 1) * 100, 1) + ' %');
      if (fin(d.uIn)) vals.push('U_ein ' + fe(d.uIn, 'V'));
      if (fin(d.uOut)) vals.push('U_aus ' + fe(d.uOut, 'V'));
      if (fin(d.iL)) vals.push('I_L ' + fe(d.iL, 'A'));
      if (vals.length) T(ctx, b0, P, vals.join('   '), rect.x + rect.w / 2, rect.y + rect.h - 12, { maxw: rect.w - 8, size: 11, color: P.fg });
      /* Zweitcodierung neben der Farbe: Strompfad in Blau mit Text */
      T(ctx, b0, P, 'blau: Strompfad ' + phasePath(d.topo, ph).join('–'), rect.x + rect.w / 2, rect.y + rect.h - 44 + 10, { maxw: rect.w - 8, size: 11, color: P.il, bg: true });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Drosselstrom */
  function inductorShape(data, n) {
    const d = obj(data);
    if (!nums(d, ['iAvg', 'dI']) || d.dI < 0) return null;
    const dd = fin(d.d) ? cl(d.d, 0.01, 0.99) : 0.5, N = Math.max(4, Math.round(fin(n) ? n : 80)), mode = d.mode === 'dcm' ? 'dcm' : d.mode === 'grenz' ? 'grenz' : 'ccm';
    const pts = []; let lo, hi;
    if (mode === 'ccm') { lo = d.iAvg - d.dI / 2; hi = d.iAvg + d.dI / 2; }
    else if (mode === 'grenz') { lo = 0; hi = d.dI; } else { lo = 0; hi = d.dI; }
    const tf = mode === 'dcm' ? (fin(d.tf) ? cl(d.tf, 0.01, 1 - dd - 0.01) : Math.max(0.01, (1 - dd) / 2)) : 1 - dd;
    /* zwei Perioden: Anstieg D, Abfall tf, Rest Null (nur lueckend) */
    for (let k = 0; k <= N; k++) {
      const tt = 2 * k / N, ph = tt % 1;
      let i;
      if (ph < dd) i = lerp(lo, hi, ph / dd);
      else if (ph < dd + tf) i = lerp(hi, lo, (ph - dd) / tf);
      else i = 0;
      pts.push([tt, tt >= 2 ? (mode === 'dcm' ? 0 : lo) : i]);
    }
    return { pts, lo, hi, mode, d: dd, tf };
  }
  function inductorCurrent(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 120, 100);
    if (!E) return false;
    const sh = inductorShape(d, Math.round(160 * E.qf));
    if (!sh) return false;
    const P = E.P, b0 = E.box, ymax = Math.max(sh.hi, d.iAvg) * 1.25 || 1;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const A = axes(ctx, E, rect, 2, ymax, 't', 'I_L', 'T', 'A');
      if (!A) return false;
      polyline(ctx, sh.pts.map(p => [A.X(p[0]), A.Y(p[1])]), P.il, 2.5);
      /* Mittelwert */
      let sum = 0; for (let i = 1; i < sh.pts.length; i++) sum += (sh.pts[i][1] + sh.pts[i - 1][1]) / 2 * (sh.pts[i][0] - sh.pts[i - 1][0]);
      const mean = sum / 2;
      line(ctx, A.pl.x, A.Y(mean), A.pl.x + A.pl.w, A.Y(mean), P.out, 1.5, [6, 3]);
      line(ctx, A.pl.x, A.Y(sh.hi), A.pl.x + A.pl.w, A.Y(sh.hi), P.mute, 1, [2, 4]);
      if (sh.mode === 'ccm') line(ctx, A.pl.x, A.Y(sh.lo), A.pl.x + A.pl.w, A.Y(sh.lo), P.mute, 1, [2, 4]);
      line(ctx, A.X(sh.d), A.pl.y, A.X(sh.d), A.pl.y + A.pl.h, P.sw, 1, [3, 3]);
      T(ctx, b0, P, 'Schalter ein', A.X(sh.d / 2), A.pl.y + 10, { size: 11, color: P.sw });
      T(ctx, b0, P, 'Mittelwert ' + fe(mean, 'A'), A.pl.x + A.pl.w - 4, A.Y(mean) + (mean > ymax * 0.4 ? 10 : -10), { align: 'right', size: 11, color: P.out, bold: true });
      T(ctx, b0, P, 'ΔI_L = ' + fe(sh.mode === 'ccm' ? d.dI : sh.hi, 'A') + '   Spitze ' + fe(sh.hi, 'A'), rect.x + rect.w / 2, rect.y + 24, { size: 11, color: P.il, bold: true, maxw: rect.w - 8 });
      const mt = sh.mode === 'ccm' ? 'nicht lückend: Strom bleibt über 0 A' : sh.mode === 'grenz' ? 'Grenzfall: Strom erreicht gerade 0 A' : 'lückend: Strom fällt auf 0 A';
      T(ctx, b0, P, mt, A.pl.x + A.pl.w / 2, A.pl.y + A.pl.h - 9, { size: 11, bold: true, color: sh.mode === 'dcm' ? P.warn : P.fg, maxw: A.pl.w - 6 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Gate-Szene */
  function gateScene(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 160, 150);
    if (!E || !nums(d, ['ug', 'uplat', 'uds', 'id']) || d.ug <= 0 || d.uplat <= 0 || d.uds <= 0 || d.id <= 0) return false;
    const P = E.P, b0 = E.box, uth = fin(d.uth) && d.uth > 0 && d.uth < d.uplat ? d.uth : d.uplat * 0.6, works = d.ug > d.uplat;
    const qgs = fin(d.qgs) && d.qgs > 0 ? d.qgs : 3, qgd = fin(d.qgd) && d.qgd > 0 ? d.qgd : 4;
    const tot = qgs + qgd + 3, t1 = 0.12 + 0.28 * qgs / tot, t2 = t1 + 0.1 + 0.4 * qgd / tot, t3 = Math.min(0.9, t2 + 0.14);
    const gate = t => (t < 0.05 ? 0 : t < t1 ? lerp(0, uth, (t - 0.05) / (t1 - 0.05)) : t < t2 ? lerp(uth, d.uplat, (t - t1) / (t2 - t1) * 0.15) : works ? (t < t3 ? lerp(d.uplat, d.ug, (t - t2) / (t3 - t2)) : d.ug) : d.uplat * 0.0 + Math.min(d.ug, d.uplat * 0.95));
    const idf = t => (!works ? 0 : t < t1 ? 0 : t < t2 ? d.id * cl((t - t1) / (t2 - t1) * 0.9, 0, 0.9) + (t > (t1 + t2) / 2 ? 0 : 0) : d.id);
    const udsf = t => (!works ? d.uds : t < (t1 + t2) / 2 ? d.uds : t < t3 ? lerp(d.uds, 0.02 * d.uds, (t - (t1 + t2) / 2) / (t3 - (t1 + t2) / 2)) : 0.02 * d.uds);
    const N = Math.max(40, Math.round(160 * E.qf));
    return draw(ctx, () => {
      bgFill(ctx, E);
      const left = 44, plx = rect.x + left, plw = rect.w - left - 10, top = rect.y + 24, lane = (rect.h - 24 - 30) / 3;
      const X = t => plx + t * plw, lanes = [['U_GS', P.gate, d.ug * 1.15, v => v], ['U_DS und I_D', P.sw, d.uds * 1.15, v => v], ['P = U_DS · I_D', P.loss, d.uds * d.id * 0.5, v => v]];
      lanes.forEach((l, k) => {
        const y0 = top + k * lane;
        ctx.fillStyle = P.panel; ctx.fillRect(plx, y0 + 1, plw, lane - 3);
        ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(plx, y0 + 1, plw, lane - 3);
        T(ctx, b0, P, l[0], plx + 4, y0 + 10, { align: 'left', size: 11, color: l[1], bold: true, bg: true });
      });
      /* Lane 1: Gate-Spannung mit Plateau */
      const Y1 = v => top + lane - 3 - cl(v / lanes[0][2], 0, 1.05) * (lane - 16);
      const g = []; for (let i = 0; i <= N; i++) { const t = i / N; g.push([X(t), Y1(gate(t))]); }
      polyline(ctx, g, P.gate, 2.5);
      line(ctx, plx, Y1(d.uplat), plx + plw, Y1(d.uplat), P.mute, 1, [2, 4]);
      T(ctx, b0, P, 'Plateau ' + fe(d.uplat, 'V'), plx + plw - 4, Y1(d.uplat) + (works ? 10 : -9), { align: 'right', size: 11, color: P.mute });
      T(ctx, b0, P, 'U_G ' + fe(d.ug, 'V'), plx + 4, Y1(d.ug) - 1 < top + 22 ? top + 22 : Y1(d.ug) - 1, { align: 'left', size: 11, color: P.gate });
      /* Lane 2: Drain-Source-Spannung (violett, durchgezogen) und Drainstrom (blau, gestrichelt) */
      const y2 = top + lane, Y2u = v => y2 + lane - 3 - cl(v / lanes[1][2], 0, 1.05) * (lane - 16), Y2i = v => y2 + lane - 3 - cl(v / (d.id * 1.15), 0, 1.05) * (lane - 16);
      const u2 = [], i2 = []; for (let i = 0; i <= N; i++) { const t = i / N; u2.push([X(t), Y2u(udsf(t))]); i2.push([X(t), Y2i(idf(t))]); }
      polyline(ctx, u2, P.sw, 2.5); polyline(ctx, i2, P.il, 2, [6, 3]);
      T(ctx, b0, P, 'I_D = ' + fe(d.id, 'A') + ' (gestrichelt blau)', plx + plw - 4, y2 + 10, { align: 'right', size: 11, color: P.il, maxw: plw * 0.6 });
      /* Lane 3: Verlustflaeche */
      const y3 = top + 2 * lane, pmax = lanes[2][2] * 2, Y3 = v => y3 + lane - 3 - cl(v / (pmax * 0.55), 0, 1) * (lane - 16);
      const p3 = [[X(0), y3 + lane - 3]]; for (let i = 0; i <= N; i++) { const t = i / N; p3.push([X(t), Y3(udsf(t) * idf(t))]); } p3.push([X(1), y3 + lane - 3]);
      ctx.fillStyle = P.loss; ctx.globalAlpha = 0.55; ctx.beginPath(); p3.forEach((p, k) => { if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      polyline(ctx, p3.slice(1, -1), P.loss, 2);
      if (fin(d.psw)) T(ctx, b0, P, 'Schaltverlust im Mittel P_sw = ' + fe(d.psw, 'W'), plx + plw - 4, y3 + 10, { align: 'right', size: 11, color: P.loss, bold: true, maxw: plw * 0.7 });
      if (!works) T(ctx, b0, P, '✗ U_G unter Plateau: MOSFET schaltet nicht durch', rect.x + rect.w / 2, rect.y + 11, { color: P.bad, bold: true, maxw: rect.w - 8 });
      else T(ctx, b0, P, 'Miller-Plateau: U_DS fällt, Verlustfläche rot', rect.x + rect.w / 2, rect.y + 11, { color: P.mute, maxw: rect.w - 8, size: 11 });
      T(ctx, b0, P, 'Zeit (Lehrmodell, nicht maßstäblich)', rect.x + rect.w / 2, rect.y + rect.h - 9, { size: 11, color: P.mute });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Regelkreis */
  function loopBlock(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 200, 150);
    if (!E || !fin(d.uRef) || d.uRef <= 0 || !fin(d.r1) || d.r1 <= 0 || !fin(d.r2) || d.r2 < 0) return false;
    const P = E.P, b0 = E.box, n = 4, mx = 8, gap = 14, bw = (rect.w - 2 * mx - gap * n) / n, bh = Math.min(48, rect.h * 0.2), by = rect.y + 30;
    const st = obj(d.step), hasStep = Array.isArray(st.t) && Array.isArray(st.u) && st.t.length === st.u.length && st.t.length >= 2 && st.t.every(fin) && st.u.every(fin) && rect.h >= 210;
    const names = [['Vergleich', 'Σ'], ['Fehler-', 'verstärker'], ['PWM', 'Schalter'], ['Drossel', 'Kondensator']];
    return draw(ctx, () => {
      bgFill(ctx, E);
      T(ctx, b0, P, 'U_ref = ' + fe(d.uRef, 'V'), rect.x + mx, rect.y + 12, { align: 'left', color: P.in, bold: true });
      T(ctx, b0, P, 'U_aus' + (fin(d.uOut) ? ' = ' + fe(d.uOut, 'V') : ''), rect.x + rect.w - mx, rect.y + 12, { align: 'right', color: P.out, bold: true, maxw: rect.w * 0.5 });
      for (let i = 0; i < n; i++) {
        const x0 = rect.x + mx + gap / 2 + i * (bw + gap), col = i === 2 ? P.s_schalt : i === 3 ? P.s_sieb : P.s_regel;
        ctx.fillStyle = P.panel; rrect(ctx, x0, by, bw, bh, 6); ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = 2.5; rrect(ctx, x0, by, bw, bh, 6); ctx.stroke();
        T(ctx, b0, P, names[i][0], x0 + bw / 2, by + bh / 2 - 8, { maxw: bw - 4, bold: true, bg: false, size: 11 });
        T(ctx, b0, P, names[i][1], x0 + bw / 2, by + bh / 2 + 9, { maxw: bw - 4, bg: false, size: 11, color: P.mute });
        arrow(ctx, x0 - gap + 1, by + bh / 2, x0 - 1, by + bh / 2, i === 0 ? P.in : P.gnd, 2, null, 7);
        if (i === n - 1) arrow(ctx, x0 + bw + 1, by + bh / 2, x0 + bw + gap / 2 + mx - 2, by + bh / 2, P.out, 2, null, 7);
      }
      /* Rueckkopplung: Teiler R1/R2 */
      const fy = by + bh + 22, xl = rect.x + mx + gap / 2 + bw / 2, xr = rect.x + rect.w - mx - gap / 2 - bw / 2;
      polyline(ctx, [[xr, by + bh], [xr, fy], [xl, fy], [xl, by + bh + 2]], P.gnd, 2, [6, 3]); arrowHead(ctx, xl, fy, xl, by + bh + 1, P.gnd, 7);
      const uTeil = d.uRef, ratio = 1 + d.r2 / d.r1;
      T(ctx, b0, P, 'Teiler R1 = ' + fe(d.r1, 'Ω') + ', R2 = ' + fe(d.r2, 'Ω') + ': U_aus = U_ref·(1 + R2/R1) = ' + fe(uTeil * ratio, 'V'), rect.x + rect.w / 2, fy + 12, { maxw: rect.w - 8, size: 11, color: P.fg, bold: true });
      if (fin(d.r2) && d.r2 === 0) T(ctx, b0, P, 'R2 = 0: Ausgang gleich Referenz', rect.x + rect.w / 2, fy + 28, { maxw: rect.w - 8, size: 11, color: P.mute });
      if (str(d.state)) T(ctx, b0, P, d.state, rect.x + rect.w / 2, by - 8 + 0, { maxw: rect.w - 8, size: 11, color: P.warn, bold: true });
      if (hasStep) {
        const py = fy + 44, ph = rect.y + rect.h - py - 22, px = rect.x + 44, pw = rect.w - 44 - 10;
        if (ph > 30 && pw > 40) {
          let t0 = Infinity, t1 = -Infinity, lo = Infinity, hi = -Infinity; st.t.forEach((v, i) => { t0 = Math.min(t0, v); t1 = Math.max(t1, v); lo = Math.min(lo, st.u[i]); hi = Math.max(hi, st.u[i]); });
          if (t1 > t0) {
            if (hi - lo < 1e-9) { lo -= 1; hi += 1; } const pad = (hi - lo) * 0.1; lo -= pad; hi += pad;
            ctx.fillStyle = P.panel; ctx.fillRect(px, py, pw, ph); ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(px, py, pw, ph);
            const maxN = Math.round(300 * E.qf), idx = []; for (let i = 0; i < Math.min(st.t.length, maxN); i++) idx.push(Math.round(i * (st.t.length - 1) / (Math.min(st.t.length, maxN) - 1)));
            polyline(ctx, idx.map(i => [px + (st.t[i] - t0) / (t1 - t0) * pw, py + ph - (st.u[i] - lo) / (hi - lo) * ph]), P.out, 2.2);
            T(ctx, b0, P, 'Sprungantwort U_aus', px + 4, py + 10, { align: 'left', size: 11, color: P.out, bold: true });
            T(ctx, b0, P, fe(hi, ''), px - 3, py + 8, { align: 'right', size: 11, color: P.mute, bg: false, maxw: 40 });
            T(ctx, b0, P, fe(lo, ''), px - 3, py + ph - 8, { align: 'right', size: 11, color: P.mute, bg: false, maxw: 40 });
            T(ctx, b0, P, fe(t0, 's') + ' bis ' + fe(t1, 's'), px + pw / 2, rect.y + rect.h - 9, { size: 11, color: P.mute });
          }
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ CV/CC-Kennlinie */
  function cvccChart(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 110);
    if (!E || !fin(d.uSet) || d.uSet <= 0 || !fin(d.iSet) || d.iSet <= 0) return false;
    const P = E.P, b0 = E.box, rk = d.uSet / d.iSet, xmax = d.iSet * 1.3, ymax = d.uSet * 1.2;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const A = axes(ctx, E, rect, xmax, ymax, 'I_aus', 'U_aus', 'A', 'V');
      if (!A) return false;
      /* Kennlinie: CV waagerecht, CC senkrecht */
      polyline(ctx, [[A.X(0), A.Y(d.uSet)], [A.X(d.iSet), A.Y(d.uSet)], [A.X(d.iSet), A.Y(0)]], P.out, 3);
      T(ctx, b0, P, 'CV: Spannung geregelt', A.X(d.iSet * 0.5), A.Y(d.uSet) - 10, { size: 11, color: P.out, bold: true, maxw: A.pl.w * 0.6 });
      T(ctx, b0, P, 'CC: Strom begrenzt', A.X(d.iSet) - 5, A.Y(d.uSet * 0.35), { size: 11, color: P.out, bold: true, align: 'right', maxw: A.pl.w * 0.5 });
      dot(ctx, A.X(d.iSet), A.Y(d.uSet), 5, P.fg); dot(ctx, A.X(d.iSet), A.Y(d.uSet), 3, P.sw);
      T(ctx, b0, P, 'Knick R_krit = U/I = ' + fe(rk, 'Ω'), A.X(d.iSet) + 8, A.Y(d.uSet) + 14, { size: 11, color: P.sw, bold: true, align: 'left', maxw: A.pl.w * 0.7 });
      if (fin(d.rLoad) && d.rLoad > 0) {
        const iEnd = Math.min(xmax, ymax / d.rLoad);
        polyline(ctx, [[A.X(0), A.Y(0)], [A.X(iEnd), A.Y(iEnd * d.rLoad)]], P.in, 2, [7, 3]);
        const op = obj(d.op);
        const mode = op.mode === 'cc' || op.mode === 'cv' ? op.mode : (d.rLoad >= rk ? 'cv' : 'cc');
        const oi = fin(op.i) ? op.i : (mode === 'cv' ? d.uSet / d.rLoad : d.iSet), ou = fin(op.u) ? op.u : (mode === 'cv' ? d.uSet : d.iSet * d.rLoad);
        dot(ctx, A.X(oi), A.Y(ou), 6, P.fg); dot(ctx, A.X(oi), A.Y(ou), 4, P.in);
        T(ctx, b0, P, 'Last ' + fe(d.rLoad, 'Ω') + ': ' + (mode === 'cv' ? 'Spannungsregelung (CV)' : 'Strombegrenzung (CC)') + ', ' + fe(ou, 'V') + ' / ' + fe(oi, 'A'), rect.x + rect.w / 2, rect.y + 24, { size: 11, bold: true, color: P.in, maxw: rect.w - 8 });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Platine mit Messpunkten */
  const PCB_PARTS = [
    { stufe: 'trafo', name: 'Trafo', x: 0.03, y: 0.25, w: 0.2, h: 0.5 }, { stufe: 'gleich', name: 'Gleichrichter', x: 0.28, y: 0.3, w: 0.17, h: 0.4 },
    { stufe: 'sieb', name: 'Elko', x: 0.5, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'regel', name: 'Regler', x: 0.68, y: 0.3, w: 0.13, h: 0.4 }, { stufe: 'last', name: 'Last', x: 0.86, y: 0.3, w: 0.11, h: 0.4 }
  ];
  function pcbPoints(rect, data) {
    const d = obj(data);
    if (!rectOk(rect, 120, 80) || !Array.isArray(d.points)) return [];
    const pad = 14;
    return d.points.slice(0, 24).filter(p => p && typeof p === 'object' && fin(p.x) && fin(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1 && str(p.id))
      .map(p => ({ id: p.id, label: str(p.label), x: rect.x + pad + p.x * (rect.w - 2 * pad), y: rect.y + 26 + p.y * (rect.h - 26 - pad), r: 11, state: p.state, selected: p.selected === true, v: typeof p.v === 'string' ? p.v.trim() : fin(p.v) ? fz(p.v) : '' }));
  }
  function benchPcb(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 120, 80);
    if (!E) return false;
    const pts = pcbPoints(rect, d);
    if (!pts.length) return false;
    const P = E.P, b0 = E.box, parts = Array.isArray(d.parts) && d.parts.length ? d.parts.filter(p => p && STUFEN[p.stufe] && fin(p.x) && fin(p.y) && fin(p.w) && fin(p.h)) : PCB_PARTS;
    const ix = rect.x + 4, iy = rect.y + 22, iw = rect.w - 8, ih = rect.h - 26;
    return draw(ctx, () => {
      bgFill(ctx, E);
      ctx.fillStyle = P.panel; rrect(ctx, ix, iy, iw, ih, 8); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; rrect(ctx, ix, iy, iw, ih, 8); ctx.stroke();
      T(ctx, b0, P, 'Platine (Simulation, Messpunkte nur auf der Gleichspannungsseite)', rect.x + rect.w / 2, rect.y + 10, { size: 11, color: P.mute, maxw: rect.w - 8 });
      /* Leiterbahnen zwischen den Bauteilen */
      for (let i = 0; i < parts.length - 1; i++) {
        const a = parts[i], b = parts[i + 1];
        line(ctx, ix + (a.x + a.w) * iw, iy + (a.y + a.h / 2) * ih, ix + b.x * iw, iy + (b.y + b.h / 2) * ih, P.gnd, 2.5);
      }
      parts.forEach(pt => {
        const st = stufeOf(pt.stufe, P), x0 = ix + pt.x * iw, y0 = iy + pt.y * ih, w = pt.w * iw, h = pt.h * ih;
        ctx.fillStyle = P.bg; rrect(ctx, x0, y0, w, h, 5); ctx.fill(); ctx.strokeStyle = st.color; ctx.lineWidth = 2; rrect(ctx, x0, y0, w, h, 5); ctx.stroke();
        T(ctx, b0, P, st.sym + ' ' + (str(pt.name) || st.name), x0 + w / 2, y0 + h / 2, { maxw: w - 2, bold: true, bg: false, size: 11 });
      });
      pts.forEach(p => {
        const fault = p.state === 'fault' && d.reveal === true, sel = p.selected;
        ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = fault ? P.bad : sel ? P.gate : P.fg; ctx.lineWidth = sel || fault ? 3.5 : 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
        T(ctx, b0, P, fault ? '✗' : p.id.replace(/^MP/, ''), p.x, p.y, { size: 11, bold: true, bg: false, color: fault ? P.bad : P.fg });
        const lab = (p.label ? p.label + ' ' : '') + p.v;
        if (lab.trim()) T(ctx, b0, P, lab.trim(), p.x, p.y + p.r + 9, { size: 11, color: fault ? P.bad : P.mute, maxw: 110 });
      });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Programmierschnittstelle */
  /* Jede Zeichenfunktion faengt Ausnahmen ab (Rueckgabe false) */
  function safe(fn) { return function () { try { return fn.apply(null, arguments) === true; } catch (e) { return false; } }; }
  const DRAWERS = { blockDiagram, trafoCore, rectifierScene, scope, zenerChart, linearReg, converterScene, inductorCurrent, gateScene, loopBlock, cvccChart, benchPcb, chainBar, ampel };
  const FNS = Object.keys(DRAWERS);
  const API = {
    version: '1.0', fns: FNS, BLINK_MAX_HZ, PAL, STUFEN, TOPO_NAMES: TOPO_NAME,
    palette, contrast, cssColors, reducedMotion, pulse, fz, fe, ampelInfo, ariaText,
    bridgePath, phasePath, inductorShape, scopeLayout, pcbPoints
  };
  FNS.forEach(k => { API[k] = safe(DRAWERS[k]); });
  root.NTS_DRAW = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
