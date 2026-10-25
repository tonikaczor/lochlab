/* anadraw.js - Analogtechnik-Lab Zeichenhelfer (ANA_DRAW, Version 1.0)
 * Schaltbild, Kennlinie, Ausgangskennlinienfeld, Zeitbild, Hysterese-Schleife, Bode-Diagramm, Balken, Messgeraet, Sichtenleiste und Ampel.
 * Vanilla-JS, keine Abhaengigkeiten (auch nicht von anacore*.js), kein eval, offline.
 * Browser: window.ANA_DRAW, Node: module.exports / globalThis.ANA_DRAW. Reine Anzeige, keine Fachrechnung (Zahlen kommen aus ANA_CORE
 * bzw. rig.curves() / rig.waveform() / rig.readMeters()); gerechnet wird hoechstens Anzeigehilfe (Ablesen auf der Kurve, Spanne U_o - U_u).
 *
 * ALLGEMEINES (Konventionen wie wsldraw.js / ntsdraw.js)
 *  - Zeichenfunktionen: f(ctx, rect, data, opts). rect = { x, y, w, h }. Zustandsfrei: gleiche Argumente ergeben gleiche Aufrufe.
 *    Animation nur ueber opts.wipe (0..1, Kurve wird bis zu diesem Anteil gezeichnet; Zeitlupenphase fuehrt das Rig) und opts.t.
 *  - Rueckgabe true = gezeichnet, false = nichts gezeichnet (dann gab es auch KEINEN Aufruf am ctx): fehlender ctx, nicht endliche
 *    Pflichtwerte, Groesse 0 oder zu klein, ungueltige Pflichtdaten (Fehlerfall zeichnet nichts). Zahlen als Text gelten NICHT als Zahl.
 *    Eine Ausnahme im Zeichnen wird abgefangen (restore, Rueckgabe false).
 *  - opts: { theme:'dark'|'light', q|quality:'hoch'|'mittel'|'niedrig', reduced:bool (Standbild, wipe wird ignoriert), t:Sekunden,
 *    ghost:false (Geisterlinien aus), wipe:0..1, bg:false (kein Hintergrund) }.
 *  - Farben (je Thema, Kontrast >= 4,5:1 zu bg und panel, Skripttest): Spannung blau, Strom orange, Ausgang gruen, Fehler/Begrenzen rot,
 *    Arbeitspunkt weiss mit dunklem Rand, Hintergrund neutral. Nie nur Farbe: jede Groesse traegt Beschriftung UND eine eigene Strichart
 *    (u durchgezogen, i kurz gestrichelt, out lang gestrichelt, err gepunktet, line Strich-Punkt).
 *  - Achsen immer mit Groesse und Einheit ("U_CE in V"). Text: Dezimalkomma, echtes Minuszeichen, Mindestschrift 11 px, bleibt innerhalb
 *    von rect (gekuerzt mit Auslassungszeichen). Nichts blinkt (BLINK_MAX_HZ = 3 Hz als Obergrenze fuer pulse()).
 *
 * FUNKTIONEN (data-Formate)
 *  schematic(ctx, rect, { kind, values?:{ r1:'47 kΩ', ... }, labels?:{ uq:'U_q = 5 V', id:'I_D = 4,3 mA', ... }, typ?, rev?, art?, last?, freilauf?,
 *        hide?:[id], fault?:id|{id,type}|[..], faultText?:string })
 *     kind: diode schalter emitter kollektor basis zfolger konstantstrom opv_inv opv_nin opv_folger summierer differenz schmitt osc
 *           integrierer differenzierer tp hp. values = Bauteilwerte (Name kommt aus SCH_NAMES), labels = fertige Strom-/Spannungstexte aus dem Kern.
 *     Fehlerstelle (fault) wird rot gezeichnet; bei verdecktem Fehler uebergibt das Rig KEIN fault (nie im Text oder aria-label).
     Schluessel je Art (values = Bauteilwert; labels = fertiger Strom-/Spannungstext; fault-Ids = dieselben Namen, dazu 'q' Transistor, 'op' OPV, 'uv'/'uvn' Versorgung):
       diode          values rv rlast diode | labels uq id ur ud il | typ si|schottky|led|led_*|z, rev (verpolt)
       schalter       values rb rv uf rspule lspule rlast | labels ub ust ib ic uce ube | last led|relais|ohm, freilauf
       emitter        values r1 r2 rc re1 re2 rg rl c1 c2 ce | labels ub ue ua ib ic uce | hide:['ce'] oder ce:false (ohne Emitterkondensator), hide:['rl'] (Leerlauf)
       kollektor      values r1 r2 re1 re2 rg rl c1 c2 | labels ub ue ua ib                 basis: values r1 r2 rc re1 re2 rl c1 c2 cb | labels ub ue ua ib ic
       zfolger        values rv rl uz | labels ub ua ib ube           konstantstrom: values rv rl re uz | labels ub ic ib ure
       opv_inv        values r1 rf rl | labels ue ua uv uvn i1 if     opv_nin: values rg rf rl | labels ue ua uv uvn if      opv_folger: values rl | labels ue ua uv uvn
       summierer      values r1 r2 r3 rf rl | labels u1 u2 u3 ua uv uvn     differenz: values r1 r2 r3 r4 rl | labels u1 u2 ua uv uvn
       schmitt        art inv|nin, values r1 (nur nin) r2 r3 (nur inv) rl | labels ue ua uref uv uvn     osc: values r c r2 r3 rl | labels ua uv uvn
       integrierer    values r c rp rl | labels ue ua i1 if      differenzierer: values c rf rl      tp: values r1 rf c rl      hp: values c r1 rf rl (labels wie integrierer)
 *  curve(ctx, rect, { title?, xLabel, xUnit, xScale?:'lin'|'log', yLabel, yUnit, series:[{ name, points:[[x,y]..], kind?:'u'|'i'|'out'|'err'|'line'|'tangent'|'ghost', ghost?:bool }],
 *        marker?:{ x, y, label? }, limit?:number|{ y?|x?, name?, sym? }, zones?:[{ x0, x1, y0?, y1?, name, kind:'sperr'|'saett'|'begr' }], cursor?:x, xRange?, yRange? })
 *     Eingabe entspricht einem Eintrag von rig.curves(). Widerstandsgerade/Arbeitsgerade = Serie mit kind 'line'.
 *  family(ctx, rect, { uce:[..] V, series:[{ ib A, ic:[..] A }] (1 bis 12), ucesat?, sperr?, lines?:[{ name, kind:'dc'|'ac', points }], marker?:{ x, y, label? } })
 *     Ausgangskennlinienfeld I_C(U_CE) mit Arbeitsgeraden, Arbeitspunkt, getoentem Saettigungs- und Sperrbereich (Format von ANA_CORE.tr.family).
 *  scope(ctx, rect, { t:[..] in tUnit, series:[{ name, unit, kind?, y:[..] }] (1 bis 4), tUnit?, cursor?:t, marks?:{ h?:[{ y, name, series? }], span?:[{ t0, t1, name }] },
 *        clip?:[{ t0, t1, name? }], slew?:[{ t0, t1, name? }] })     Raster, Cursor mit Ablesung, Begrenzen rot, Slew-Rate-Abschnitte
 *  hyst(ctx, rect, { uo, uu, usat, usatN?, art?:'inv'|'nin', uemax?, ue?, ua? })       Hysterese-Schleife mit Pfeilen, Schaltschwellen, Aussteuergrenzen
 *  bode(ctx, rect, { f:[..] Hz, a:[..] dB, phi?:[..] Grad, open?:[..] dB, asymp?:[..]|[[f,a]..], fg?, gbw?, fA?, slope?:dB je Dekade, typ?:'tief'|'hoch'|'int'|'diff'|'ver' })
 *  bar(ctx, rect, { items:[{ name, value, unit?, kind? }] (1 bis 16), label, unit?, title?, mark?:{ value, name }, dir?:'v'|'h' })   Spektrum, Offset, Verlustleistung
 *  meter(ctx, rect, { value, min?, max, unit, label?, kind?:'zeiger'|'digital', zone?:{ from, to }, text?, inf?:bool, infAbove? })    Anzeige "∞" ab infAbove (1e11)
 *  chainBar(ctx, rect, { kennlinie, signal, formel, active?:'kennlinie'|'signal'|'formel' })    Sichtenleiste "Kennlinie - Signal - Formel" (Texte aus rig.sicht)
 *  ampel(ctx, x, y, state, { text?, size?, maxw?, theme? })     state gruen|gelb|rot|grau (auch ok|warn|bad|none)
 *  Reine Hilfen: ampelInfo, ariaText, palette, contrast, KINDS, fz, fe, fd, pulse, cssColors, reducedMotion, niceTicks, BLINK_MAX_HZ, fns, version, SCH_NAMES, SCHEMATIC_KINDS
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Hilfen */
  const TAU = Math.PI * 2;
  const BLINK_MAX_HZ = 3;
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e15;
  const finS = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9;
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const rad = d => d * Math.PI / 180;
  const goodColor = v => typeof v === 'string' && /^#[0-9a-f]{3,6}$/i.test(v);
  const numArr = (a, min, max) => Array.isArray(a) && a.length >= min && a.length <= (max || 20000) && a.every(finS);
  const ptsOk = a => Array.isArray(a) && a.length >= 2 && a.length <= 20000 && a.every(p => Array.isArray(p) && p.length >= 2 && finS(p[0]) && finS(p[1]));

  /* Farbpaletten (Kontrast zu bg und panel >= 4,5:1; Skripttest prueft jede Textfarbe) */
  const PAL = {
    dark: {
      bg: '#0f172a', panel: '#1e293b', fg: '#f1f5f9', mute: '#a9b6c9', grid: '#334155', line: '#64748b',
      u: '#60a5fa', i: '#fb923c', out: '#4ade80', err: '#f87171', gnd: '#a3b0c2',
      ok: '#4ade80', warn: '#fde047', bad: '#f87171', none: '#a9b6c9', mark: '#ffffff', markEdge: '#0f172a'
    },
    light: {
      bg: '#ffffff', panel: '#f1f5f9', fg: '#0f172a', mute: '#475569', grid: '#cbd5e1', line: '#64748b',
      u: '#1d4ed8', i: '#b45309', out: '#15803d', err: '#b91c1c', gnd: '#475569',
      ok: '#15803d', warn: '#854d0e', bad: '#b91c1c', none: '#475569', mark: '#ffffff', markEdge: '#0f172a'
    }
  };
  /* Groessen: Farbschluessel, Strichart (Zweitcodierung neben der Farbe) und Bezeichnung */
  const KINDS = {
    u: { key: 'u', dash: [], name: 'Spannung' },
    i: { key: 'i', dash: [6, 4], name: 'Strom' },
    out: { key: 'out', dash: [14, 5], name: 'Ausgang' },
    err: { key: 'err', dash: [2, 4], name: 'Fehler oder Begrenzen' },
    line: { key: 'fg', dash: [9, 3, 2, 3], name: 'Gerade' },
    ref: { key: 'mute', dash: [4, 4], name: 'Vergleich' }
  };
  function kindOf(kind, name) {
    if (typeof kind === 'string' && KINDS[kind]) return kind;
    const s = str(name), c = s.charAt(0), c2 = s.charAt(2);
    if ((c === 'U' || c === 'u') && (c2 === 'a' || c2 === 'A') && s.charAt(1) === '_') return 'out';
    return c === 'U' || c === 'u' ? 'u' : c === 'I' || c === 'i' ? 'i' : 'ref';
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
    if (reduced || !finS(t)) return 1;
    const f = finS(hz) ? cl(hz, 0, BLINK_MAX_HZ) : 1;
    return 0.5 + 0.5 * Math.sin(t * TAU * f);
  }

  /* Anzeige: Dezimalkomma, Minuszeichen, nicht endlich = Gedankenstrich */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(finS(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
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
  /* Zahl mit Einheit: SI-Basiseinheiten bekommen einen Vorsatz, andere Einheiten ('%', 'dB', 'mV', 'V/µs') bleiben, wie sie sind */
  const SI_BASE = ['A', 'V', 'W', 'Ω', 'F', 'H', 's', 'S', 'Hz', 'var', 'VA'];
  function fv(v, unit) {
    const u = typeof unit === 'string' ? unit : '';
    return SI_BASE.indexOf(u) >= 0 || u === '' ? fe(v, u) : (fin(v) ? fz(v) + ' ' + u : '–');
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
    const nn = finS(n) ? cl(Math.round(n), 1, 20) : 5, raw = (hi - lo) / nn, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag, out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9 && out.length < 60; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
    return out;
  }
  const decOf = step => (step >= 1 ? 0 : cl(Math.ceil(-Math.log10(step) - 1e-9), 0, 4));
  /* Achsen-Vorsatz fuer SI-Basiseinheiten: 0,004 A wird 4 mA (Faktor k, Einheit u) */
  const SI_UNITS = ['A', 'V', 'W', 'Ω', 'F', 'H', 's', 'S'];
  function prefixFor(maxAbs, unit) {
    if (SI_UNITS.indexOf(unit) < 0 || !(maxAbs > 0)) return { k: 1, u: unit };
    if (unit === 'V' && maxAbs >= 0.1 && maxAbs < 1) return { k: 1, u: unit };
    for (let i = 0; i < PREF.length; i++) if (maxAbs >= PREF[i][0] * 0.9995) return PREF[i][0] === 1 ? { k: 1, u: unit } : { k: 1 / PREF[i][0], u: PREF[i][1] + unit };
    return { k: 1e12, u: 'p' + unit };
  }

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
  /* aria-label des Hauptbildes: Ampeltext zuerst (Spec 7); nennt nie einen verdeckten Fehler, nur was der Aufrufer als text uebergibt */
  function ariaText(state, text) {
    const a = ampelInfo(state), t = str(text);
    return 'Ampel ' + a.text + (t ? '. ' + t : '') + '. Grün heißt nicht: für jeden Einsatz geeignet.';
  }

  /* ------------------------------------------------------------------ Zeichen-Grundlagen */
  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && ['save', 'restore', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'stroke', 'fill', 'fillText', 'arc', 'fillRect', 'rect', 'translate', 'rotate'].every(k => typeof ctx[k] === 'function');
  }
  function rectOk(r, minW, minH) { return !!r && typeof r === 'object' && finS(r.x) && finS(r.y) && finS(r.w) && finS(r.h) && r.w >= (minW || 40) && r.h >= (minH || 30); }
  function draw(ctx, fn) {
    ctx.save();
    try { const r = fn(); ctx.restore(); return r === undefined ? true : r === true; } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorieren */ } return false; }
  }
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '') + (Math.round(size * 10) / 10) + 'px system-ui, sans-serif'; }
  function tw(ctx, t, size, bold) {
    if (typeof ctx.measureText === 'function') { const m = ctx.measureText(t); if (m && finS(m.width)) return m.width; }
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
  function ring(ctx, x, y, r, color, w) { ctx.strokeStyle = color; ctx.lineWidth = w || 2; ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, TAU); ctx.stroke(); }
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
  /* schraffierte, getoente Flaeche (Sperren/Saettigung): Tonung plus Schraffur in eigener Richtung (nie nur Farbe) */
  function tint(ctx, x, y, w, h, color, dir) {
    if (!(w > 1) || !(h > 1)) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.globalAlpha = 0.16; ctx.fillStyle = color; ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 0.5; ctx.strokeStyle = color; ctx.lineWidth = 1; setDash(ctx, []);
    const gap = Math.max(8, (w + h) / 40);
    ctx.beginPath();
    for (let k = -h; k <= w; k += gap) { if (dir > 0) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); } else { ctx.moveTo(x + k, y); ctx.lineTo(x + k + h, y + h); } }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* Text innerhalb von box (Fenster = rect der Zeichenfunktion): gekuerzt, verschoben, Konturfarbe = Hintergrund */
  function T(ctx, box, P, text, x, y, o) {
    o = o || {};
    let t = typeof text === 'number' ? (fin(text) ? fz(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '' || !finS(x) || !finS(y)) return false;
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
  const qOf = o => { const q = o && (o.q || o.quality); return q === 'niedrig' || q === 'mittel' ? q : 'hoch'; };
  const qFac = q => (q === 'niedrig' ? 0.3 : q === 'mittel' ? 0.6 : 1);
  /* Gemeinsamer Anfang: prueft ctx und rect, liefert Zeichenumgebung oder null (vor dem ersten Aufruf) */
  function env(ctx, rect, opts, minW, minH) {
    if (!okCtx(ctx) || !rectOk(rect, minW, minH)) return null;
    const o = obj(opts), P = palette(o.theme), q = qOf(o), reduced = o.reduced === true;
    const wipe = !reduced && finS(o.wipe) && o.wipe >= 0 && o.wipe < 1 ? o.wipe : 1;
    return { P, q, qf: qFac(q), reduced, wipe, ghost: o.ghost !== false, t: finS(o.t) ? o.t : 0, bgOn: o.bg !== false, box: { x: rect.x, y: rect.y, w: rect.w, h: rect.h }, narrow: rect.w < 460 };
  }
  function bgFill(ctx, E) { if (E.bgOn) { ctx.fillStyle = E.P.bg; ctx.fillRect(E.box.x, E.box.y, E.box.w, E.box.h); } }
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

  /* Achsenrahmen mit Raster, Beschriftung und Einheit.
   * o: { x0, x1, y0, y1, xlog, xl, xu, yl, yu, top, left, right, xLabels, yticks, xticks } */
  function frame(ctx, E, rect, o) {
    const P = E.P, left = o.left || 52, bottom = o.xLabels === false ? 8 : 30, top = o.top || 22, right = o.right || 12;
    const pl = { x: rect.x + left, y: rect.y + top, w: rect.w - left - right, h: rect.h - top - bottom };
    if (pl.w < 40 || pl.h < 24 || !finS(o.x0) || !finS(o.x1) || !finS(o.y0) || !finS(o.y1)) return null;
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
      xt = Array.isArray(o.xticks) ? o.xticks : niceTicks(o.x0, o.x1, Math.max(2, Math.floor(pl.w / 70)));
      const st = xt.length > 1 ? xt[1] - xt[0] : 1, dd = decOf(Math.abs(st));
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
    if (yl) T(ctx, E.box, P, yl, rect.x + 3, rect.y + top - 9, { size: 11, color: P.fg, align: 'left', bg: false, maxw: rect.w - 6 });
    return { pl, X, Y };
  }
  /* Legende: Strichprobe (Farbe und Strichart) plus Text; liefert Hoehe, zeichnet ab Zeile y0 */
  function legendH(ctx, rect, items) {
    if (!items.length) return 0;
    font(ctx, 11, false);
    const widths = items.map(it => 32 + tw(ctx, it.text, 11, false)), rowMode = widths.reduce((a, b) => a + b, 0) + 12 <= rect.w - 8;
    return rowMode ? 16 : 15 * items.length + 2;
  }
  function legendDraw(ctx, E, rect, items, y0) {
    if (!items.length) return;
    const P = E.P;
    font(ctx, 11, false);
    const widths = items.map(it => 32 + tw(ctx, it.text, 11, false)), rowMode = widths.reduce((a, b) => a + b, 0) + 12 <= rect.w - 8;
    let lx = rect.x + 6, ly = y0 + 8;
    items.forEach((it, i) => {
      line(ctx, lx, ly, lx + 22, ly, P[it.key] || P.fg, 3, it.dash);
      T(ctx, E.box, P, it.text, lx + 26, ly, { align: 'left', bg: false, size: 11, color: P.fg, maxw: rowMode ? widths[i] - 28 : rect.w - 40 });
      if (rowMode) lx += widths[i]; else ly += 15;
    });
  }
  /* Zeichenflaeche gross genug? Vor dem ersten ctx-Aufruf pruefen (kein Halbbild) */
  const plFits = (rect, left, top, right, bottom) => rect.w - left - right >= 40 && rect.h - top - bottom >= 24;
  const thin = (n, E, per) => Math.max(1, Math.ceil(n / ((per || 400) * E.qf)));

  /* ------------------------------------------------------------------ Ampel und Sichtenleiste */
  function ampel(ctx, x, y, state, o) {
    if (!okCtx(ctx) || !finS(x) || !finS(y)) return false;
    o = obj(o);
    const a = ampelInfo(state), P = palette(o.theme), size = finS(o.size) ? cl(o.size, 11, 40) : 13, r = size * 0.62;
    const txt = typeof o.text === 'string' && o.text.trim() ? o.text.trim() : a.text;
    return draw(ctx, () => {
      ctx.fillStyle = P[a.key]; ctx.beginPath(); ctx.arc(x + r, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + r, y, r, 0, TAU); ctx.stroke();
      font(ctx, size, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.bg; ctx.fillText(a.sym, x + r, y + 0.5);
      const maxw = finS(o.maxw) ? cl(o.maxw, 0, 5000) : 0;
      font(ctx, size, false);
      const tt = maxw > 0 ? fitText(ctx, txt, Math.max(0, maxw - 2 * r - 6), size, false) : txt;
      ctx.textAlign = 'left'; ctx.fillStyle = P.fg;
      if (tt) ctx.fillText(tt, x + 2 * r + 6, y);
      return true;
    });
  }
  const SICHTEN = [{ id: 'kennlinie', name: 'Kennlinie', sym: '↗', dash: [] }, { id: 'signal', name: 'Signal', sym: '~', dash: [7, 3] }, { id: 'formel', name: 'Formel', sym: 'ƒ', dash: [2, 3] }];
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

  /* ------------------------------------------------------------------ Kennlinie mit Arbeitspunkt */
  const ZONE = {
    sperr: { key: 'mute', dir: 1, name: 'Sperren' },
    saett: { key: 'err', dir: -1, name: 'Sättigung' },
    begr: { key: 'err', dir: -1, name: 'Begrenzen' }
  };
  function defaultKind(yUnit) { return yUnit === 'A' || yUnit === 'mA' || yUnit === 'µA' ? 'i' : yUnit === 'V' || yUnit === 'mV' ? 'u' : 'out'; }
  const CYCLE = ['u', 'i', 'out', 'err'];
  function curve(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 160, 130);
    if (!E || !Array.isArray(d.series) || d.series.length < 1 || d.series.length > 6) return false;
    const xl = str(d.xLabel), yl = str(d.yLabel);
    if (!xl || !yl) return false;
    const S = d.series.map(s => Object.assign({}, obj(s)));
    if (!S.every(s => ptsOk(s.points) && str(s.name))) return false;
    const xlog = d.xScale === 'log', xu0 = str(d.xUnit), yu0 = str(d.yUnit);
    if (xlog && !S.every(s => s.points.every(p => p[0] > 0))) return false;
    const mk = d.marker && finS(obj(d.marker).x) && finS(obj(d.marker).y) ? obj(d.marker) : null;
    const lim = finS(d.limit) ? { y: Math.abs(d.limit), sym: true } : (d.limit && typeof d.limit === 'object' ? obj(d.limit) : null);
    const limY = lim && finS(lim.y) ? lim.y : NaN, limX = lim && finS(lim.x) ? lim.x : NaN;
    const mains = S.filter(s => !(s.ghost === true || s.kind === 'ghost' || s.kind === 'line' || s.kind === 'tangent'));
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    S.forEach(s => s.points.forEach(p => { if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0]; if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }));
    if (mk) { xmin = Math.min(xmin, mk.x); xmax = Math.max(xmax, mk.x); ymin = Math.min(ymin, mk.y); ymax = Math.max(ymax, mk.y); }
    if (finS(limY)) { ymax = Math.max(ymax, limY); if (lim.sym !== false) ymin = Math.min(ymin, -limY); }
    if (d.xRange && finS(d.xRange[0]) && finS(d.xRange[1]) && d.xRange[1] > d.xRange[0]) { xmin = d.xRange[0]; xmax = d.xRange[1]; }
    if (d.yRange && finS(d.yRange[0]) && finS(d.yRange[1]) && d.yRange[1] > d.yRange[0]) { ymin = d.yRange[0]; ymax = d.yRange[1]; } else {
      if (!(ymax > ymin)) { ymax = ymin + 1; }
      const span = ymax - ymin; ymax += span * 0.06; ymin = ymin >= 0 && ymin < 0.25 * ymax ? 0 : ymin - span * 0.06;
    }
    if (!(xmax > xmin)) return false;
    if (xlog && Math.log10(xmax / xmin) > 12) return false;
    const px = xlog ? { k: 1, u: xu0 } : prefixFor(Math.max(Math.abs(xmin), Math.abs(xmax)), xu0), py = prefixFor(Math.max(Math.abs(ymin), Math.abs(ymax)), yu0);
    const legend = [];
    S.forEach((s, i) => {
      const gh = s.ghost === true || s.kind === 'ghost';
      if (gh && !E.ghost) return;
      let kk = typeof s.kind === 'string' && KINDS[s.kind] ? s.kind : null;
      let style;
      if (gh) style = { key: 'mute', dash: [3, 4], w: 2 };
      else if (s.kind === 'line') style = { key: KINDS.line.key, dash: KINDS.line.dash, w: 2 };
      else if (s.kind === 'tangent') style = { key: 'mute', dash: [2, 3], w: 2 };
      else { if (!kk) kk = mains.length > 1 ? CYCLE[mains.indexOf(s) % CYCLE.length] : defaultKind(yu0); style = { key: KINDS[kk].key, dash: KINDS[kk].dash, w: 3 }; }
      s._st = style; s._gh = gh;
      legend.push({ text: s.name + (gh ? ' (Vergleich)' : ''), key: style.key, dash: style.dash });
    });
    if (mk) legend.push({ text: 'Arbeitspunkt', key: 'fg', dash: [] });
    const title = str(d.title), legH = legendH(ctx, rect, legend);
    if (!plFits(rect, 52, 24 + (title ? 16 : 0) + legH, 12, 30)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const P = E.P, top = 24 + (title ? 16 : 0) + legH;
      const F = frame(ctx, E, rect, { x0: xmin * px.k, x1: xmax * px.k, y0: ymin * py.k, y1: ymax * py.k, xlog, xl: xl, xu: px.u, yl: yl, yu: py.u, top });
      if (!F) return false;
      const pl = F.pl, X = x => F.X(x * px.k), Y = y => F.Y(y * py.k);
      if (title) T(ctx, E.box, P, title, rect.x + 4, rect.y + 9, { size: 12, bold: true, align: 'left', bg: false, maxw: rect.w - 8 });
      legendDraw(ctx, E, rect, legend, rect.y + 4 + (title ? 16 : 0));
      /* getoente Bereiche */
      if (Array.isArray(d.zones)) d.zones.slice(0, 4).forEach(z => {
        z = obj(z); const zk = ZONE[z.kind] || ZONE.sperr, x0 = finS(z.x0) ? z.x0 : xmin, x1 = finS(z.x1) ? z.x1 : xmax, y0 = finS(z.y0) ? z.y0 : ymin, y1 = finS(z.y1) ? z.y1 : ymax;
        if (!(x1 > x0) || !(y1 > y0)) return;
        const ax = cl(X(x0), pl.x, pl.x + pl.w), bx = cl(X(x1), pl.x, pl.x + pl.w), ay = cl(Y(y1), pl.y, pl.y + pl.h), by = cl(Y(y0), pl.y, pl.y + pl.h);
        tint(ctx, ax, ay, bx - ax, by - ay, P[zk.key], zk.dir);
        T(ctx, E.box, P, str(z.name) || zk.name, ax + 4, ay + 9, { size: 11, align: 'left', color: P[zk.key], bold: true });
      });
      /* Grenzen (Aussteuergrenze) */
      if (finS(limY)) {
        const nm = str(lim.name) || 'Grenze';
        [limY].concat(lim.sym !== false ? [-limY] : []).forEach((v, i) => {
          const y = Y(v); if (y < pl.y || y > pl.y + pl.h) return;
          line(ctx, pl.x, y, pl.x + pl.w, y, P.err, 2, KINDS.err.dash);
          T(ctx, E.box, P, (v < 0 ? '−' : '') + nm + ' = ' + fv(Math.abs(v), yu0), pl.x + pl.w - 4, y + (v < 0 ? 9 : -9), { size: 11, align: 'right', color: P.err, bold: true, maxw: pl.w - 8 });
        });
      }
      if (finS(limX)) {
        const x = X(limX);
        if (x >= pl.x && x <= pl.x + pl.w) { line(ctx, x, pl.y, x, pl.y + pl.h, P.err, 2, KINDS.err.dash); T(ctx, E.box, P, (str(lim.name) || 'Grenze') + ' = ' + fv(limX, xu0), x + 4, pl.y + pl.h - 9, { size: 11, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', color: P.err, bold: true, maxw: pl.w * 0.7 }); }
      }
      /* Kurven: erst Geisterlinien und Geraden, dann die Hauptkurven */
      const order = S.filter(s => s._st && s._gh).concat(S.filter(s => s._st && !s._gh && s.kind === 'line')).concat(S.filter(s => s._st && !s._gh && s.kind !== 'line'));
      order.forEach(s => {
        const n = s.points.length, st = thin(n, E), m = s._gh || s.kind === 'line' ? n : Math.max(2, Math.ceil(n * E.wipe)), pts = [];
        for (let i = 0; i < m; i += st) pts.push([X(s.points[i][0]), Y(s.points[i][1])]);
        if ((m - 1) % st !== 0) pts.push([X(s.points[m - 1][0]), Y(s.points[m - 1][1])]);
        polyline(ctx, pts, P[s._st.key], s._st.w, s._st.dash);
      });
      /* Cursor mit Ablesung der ersten Hauptkurve */
      if (finS(d.cursor) && d.cursor >= xmin && d.cursor <= xmax) {
        const cx = X(d.cursor), m0 = mains[0] || S[0], yv = interp(m0.points.map(p => p[0]), m0.points.map(p => p[1]), d.cursor, xlog);
        line(ctx, cx, pl.y, cx, pl.y + pl.h, P.fg, 1.5, [2, 3]);
        T(ctx, E.box, P, (xlog ? fd(d.cursor, xu0) : fv(d.cursor, xu0)) + (finS(yv) ? ', ' + fv(yv, yu0) : ''), cx + 4, pl.y + 9, { size: 11, align: cx > pl.x + pl.w * 0.6 ? 'right' : 'left', bold: true });
      }
      /* Arbeitspunkt: weiss mit dunklem Rand, Fadenkreuz zu den Achsen */
      if (mk) {
        const mx = X(mk.x), my = Y(mk.y);
        if (mx >= pl.x - 1 && mx <= pl.x + pl.w + 1 && my >= pl.y - 1 && my <= pl.y + pl.h + 1) {
          line(ctx, mx, my, mx, pl.y + pl.h, P.mute, 1, [3, 3]); line(ctx, pl.x, my, mx, my, P.mute, 1, [3, 3]);
          dot(ctx, mx, my, 8, P.fg); dot(ctx, mx, my, 6.5, P.markEdge); dot(ctx, mx, my, 5, P.mark);
          const lab = str(mk.label) || 'AP: ' + fv(mk.x, xu0) + ' | ' + fv(mk.y, yu0), right = mx > pl.x + pl.w * 0.55, below = my < pl.y + pl.h * 0.5;
          T(ctx, E.box, P, lab, mx + (right ? -10 : 10), my + (below ? 16 : -16), { size: 11, bold: true, align: right ? 'right' : 'left', maxw: pl.w * 0.8 });
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Ausgangskennlinienfeld */
  function family(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 170, 140);
    if (!E || !numArr(d.uce, 3, 2000) || !Array.isArray(d.series) || d.series.length < 1 || d.series.length > 12) return false;
    const n = d.uce.length, u = d.uce;
    for (let i = 1; i < n; i++) if (u[i] < u[i - 1]) return false;
    if (!(u[n - 1] > u[0])) return false;
    const S = d.series.map(s => obj(s));
    if (!S.every(s => finS(s.ib) && s.ib >= 0 && numArr(s.ic, n, n))) return false;
    const mk = d.marker && finS(obj(d.marker).x) && finS(obj(d.marker).y) ? obj(d.marker) : null;
    const L = Array.isArray(d.lines) ? d.lines.slice(0, 3).map(l => obj(l)).filter(l => ptsOk(l.points)) : [];
    let ymax = 0;
    S.forEach(s => s.ic.forEach(v => { if (v > ymax) ymax = v; }));
    L.forEach(l => l.points.forEach(p => { if (p[1] > ymax) ymax = p[1]; }));
    if (mk && mk.y > ymax) ymax = mk.y;
    if (!(ymax > 0)) ymax = 1;
    ymax *= 1.08;
    const xmax = Math.max(u[n - 1], mk ? mk.x : 0, L.reduce((m, l) => Math.max(m, l.points.reduce((a, p) => Math.max(a, p[0]), 0)), 0));
    const xmin = Math.min(u[0], 0), py = prefixFor(ymax, 'A'), px = prefixFor(xmax, 'V');
    const legend = [{ text: 'I_C(U_CE) je I_B', key: 'i', dash: KINDS.i.dash }];
    L.forEach(l => { const ac = l.kind === 'ac'; legend.push({ text: str(l.name) || (ac ? 'Wechselstrom-Arbeitsgerade' : 'Arbeitsgerade'), key: ac ? 'u' : 'fg', dash: ac ? [5, 3] : KINDS.line.dash }); });
    if (mk) legend.push({ text: 'Arbeitspunkt', key: 'fg', dash: [] });
    const legH = legendH(ctx, rect, legend);
    if (!plFits(rect, 52, 24 + legH, 12, 30)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const P = E.P;
      const F = frame(ctx, E, rect, { x0: xmin * px.k, x1: xmax * px.k, y0: 0, y1: ymax * py.k, xl: 'U_CE', xu: px.u, yl: 'I_C', yu: py.u, top: 24 + legH });
      if (!F) return false;
      const pl = F.pl, X = x => F.X(x * px.k), Y = y => F.Y(y * py.k);
      legendDraw(ctx, E, rect, legend, rect.y + 4);
      if (finS(d.ucesat) && d.ucesat > 0) {
        const x1 = cl(X(d.ucesat), pl.x, pl.x + pl.w);
        tint(ctx, pl.x, pl.y, x1 - pl.x, pl.h, P.err, -1);
        T(ctx, E.box, P, 'Sättigung', pl.x + 4, pl.y + 9, { size: 11, align: 'left', color: P.err, bold: true });
      }
      if (d.sperr === true || S.some(s => s.ib === 0)) {
        const y0 = Y(0), y1 = Y(ymax * 0.04);
        tint(ctx, pl.x, y1, pl.w, y0 - y1, P.mute, 1);
        T(ctx, E.box, P, 'Sperren (I_B = 0)', pl.x + pl.w * 0.3, y1 - 9, { size: 11, align: 'left', color: P.mute, bold: true });
      }
      const st = thin(n, E, 300);
      let lastY = Infinity;
      S.slice().sort((a, b) => b.ib - a.ib).forEach(s => {
        const m = Math.max(2, Math.ceil(n * E.wipe)), pts = [];
        for (let i = 0; i < m; i += st) pts.push([X(u[i]), Y(s.ic[i])]);
        if ((m - 1) % st !== 0) pts.push([X(u[m - 1]), Y(s.ic[m - 1])]);
        polyline(ctx, pts, P.i, 2.5, []);
        const ye = Y(s.ic[m - 1]) - 8;
        if (E.wipe >= 1 && s.ib > 0 && Math.abs(ye - lastY) >= 14 && ye > pl.y + 4) { T(ctx, E.box, P, 'I_B = ' + fe(s.ib, 'A'), pl.x + pl.w - 4, ye, { size: 11, align: 'right', color: P.i, maxw: pl.w * 0.6 }); lastY = ye; }
      });
      L.forEach(l => polyline(ctx, l.points.map(p => [X(p[0]), Y(p[1])]), l.kind === 'ac' ? P.u : P.fg, 2.5, l.kind === 'ac' ? [5, 3] : KINDS.line.dash));
      if (mk) {
        const mx = X(mk.x), my = Y(mk.y);
        if (mx >= pl.x - 1 && mx <= pl.x + pl.w + 1 && my >= pl.y - 1 && my <= pl.y + pl.h + 1) {
          line(ctx, mx, my, mx, pl.y + pl.h, P.mute, 1, [3, 3]); line(ctx, pl.x, my, mx, my, P.mute, 1, [3, 3]);
          dot(ctx, mx, my, 8, P.fg); dot(ctx, mx, my, 6.5, P.markEdge); dot(ctx, mx, my, 5, P.mark);
          const right = mx > pl.x + pl.w * 0.55;
          T(ctx, E.box, P, str(mk.label) || 'AP: ' + fe(mk.x, 'V') + ' | ' + fe(mk.y, 'A'), mx + (right ? -10 : 10), my - 16, { size: 11, bold: true, align: right ? 'right' : 'left', maxw: pl.w * 0.8 });
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Zeitbild (Linienschreiber, zwei Kanaele) */
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
    const legend = ser.map(r => ({ text: r.s.name + (r.unit ? ' in ' + r.unit : '') + (r.scaled ? ' (Spitze ' + fv(r.mx, r.unit) + ', Maßstab angepasst)' : ''), key: KINDS[r.kk].key, dash: KINDS[r.kk].dash }));
    const mkk = obj(d.marks), legH = legendH(ctx, rect, legend), curOk = finS(d.cursor) && d.cursor >= t[0] && d.cursor <= t[n - 1];
    const curRead = curOk ? ['t = ' + fz(d.cursor) + ' ' + tUnit].concat(ser.slice(0, 3).map(r => { const v = interp(t, r.s.y, d.cursor, false); return finS(v) ? r.s.name + ' = ' + fv(v, r.unit) : ''; }).filter(Boolean)).join('  |  ') : '';
    const topS = 24 + legH + (curOk ? 16 : 0);
    if (!plFits(rect, 52, topS, 12, 30)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const F = frame(ctx, E, rect, { x0: t[0], x1: t[n - 1], y0: lo, y1: hi, xl: 't', xu: tUnit, yl: 'Augenblickswert', yu: unit0, top: topS });
      if (!F) return false;
      if (curRead) T(ctx, E.box, P, curRead, rect.x + 6, rect.y + 4 + legH + 9, { size: 11, bold: true, align: 'left', bg: false, maxw: rect.w - 12 });
      const pl = F.pl, zy = F.Y(0);
      line(ctx, pl.x, zy, pl.x + pl.w, zy, P.line, 1.5);
      legendDraw(ctx, E, rect, legend, rect.y + 4);
      /* Begrenzen (rot) und Slew-Abschnitte */
      const band = (list, key, dir, nm) => { if (Array.isArray(list)) list.slice(0, 4).forEach(c => { c = obj(c); if (!finS(c.t0) || !finS(c.t1) || !(c.t1 > c.t0)) return; const a = cl(F.X(c.t0), pl.x, pl.x + pl.w), b = cl(F.X(c.t1), pl.x, pl.x + pl.w); if (b - a < 1) return; tint(ctx, a, pl.y, b - a, pl.h, P[key], dir); T(ctx, E.box, P, str(c.name) || nm, (a + b) / 2, pl.y + 9, { size: 11, bold: true, color: P[key], maxw: Math.max(40, b - a + 40) }); }); };
      band(d.clip, 'err', -1, 'Begrenzen');
      band(d.slew, 'u', 1, 'Slew-Rate');
      /* Kurven */
      const step = thin(n, E);
      ser.forEach(r => {
        const kd = KINDS[r.kk], pts = [], m = Math.max(2, Math.ceil(n * E.wipe));
        for (let i = 0; i < m; i += step) pts.push([F.X(t[i]), F.Y(r.s.y[i] * r.k)]);
        if ((m - 1) % step !== 0) pts.push([F.X(t[m - 1]), F.Y(r.s.y[m - 1] * r.k)]);
        polyline(ctx, pts, P[kd.key], 2.5, kd.dash);
      });
      if (Array.isArray(mkk.h)) mkk.h.slice(0, 6).forEach(m => {
        m = obj(m); if (!finS(m.y) || !str(m.name)) return;
        const r = ser[finS(m.series) && ser[m.series | 0] ? m.series | 0 : 0], y = F.Y(m.y * r.k);
        if (y < pl.y || y > pl.y + pl.h) return;
        line(ctx, pl.x, y, pl.x + pl.w, y, P.mute, 1.2, [5, 4]);
        T(ctx, E.box, P, m.name + ' = ' + fz(m.y) + (r.unit ? ' ' + r.unit : ''), pl.x + pl.w - 4, y - 8, { size: 11, align: 'right', color: P.fg });
      });
      if (Array.isArray(mkk.span)) mkk.span.slice(0, 3).forEach((m, i) => {
        m = obj(m); if (!finS(m.t0) || !finS(m.t1) || !(m.t1 > m.t0) || !str(m.name)) return;
        const x0 = F.X(m.t0), x1 = F.X(m.t1), y = pl.y + pl.h - 14 - i * 20;
        line(ctx, x0, pl.y, x0, pl.y + pl.h, P.mute, 1, [3, 3]); line(ctx, x1, pl.y, x1, pl.y + pl.h, P.mute, 1, [3, 3]);
        arrow(ctx, (x0 + x1) / 2, y, x0, y, P.fg, 1.5, null, 7); arrow(ctx, (x0 + x1) / 2, y, x1, y, P.fg, 1.5, null, 7);
        T(ctx, E.box, P, m.name + ' = ' + fz(m.t1 - m.t0) + ' ' + tUnit, (x0 + x1) / 2, y - 9, { size: 11, bold: true });
      });
      if (curOk) {
        const cx = F.X(d.cursor);
        line(ctx, cx, pl.y, cx, pl.y + pl.h, P.fg, 1.5, [2, 3]);
        ser.slice(0, 3).forEach(r => { const v = interp(t, r.s.y, d.cursor, false); if (finS(v)) dot(ctx, cx, F.Y(v * r.k), 4, P[KINDS[r.kk].key]); });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Hysterese-Schleife */
  function hyst(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 170, 140);
    if (!E || !finS(d.uo) || !finS(d.uu) || !finS(d.usat) || !(d.usat > 0) || d.uo < d.uu) return false;
    const usN = finS(d.usatN) && d.usatN > 0 ? d.usatN : d.usat, art = d.art === 'nin' ? 'nin' : 'inv';
    const uo = d.uo, uu = d.uu, hasH = uo > uu;
    const xm0 = Math.max(Math.abs(uo), Math.abs(uu), finS(d.ue) ? Math.abs(d.ue) : 0), xm = finS(d.uemax) && d.uemax > xm0 ? d.uemax : (xm0 > 0 ? xm0 * 1.5 : d.usat);
    const ym = Math.max(d.usat, usN) * 1.3;
    if (!plFits(rect, 52, 24, 12, 30)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const P = E.P;
      const F = frame(ctx, E, rect, { x0: -xm, x1: xm, y0: -ym, y1: ym, xl: 'U_e', xu: 'V', yl: 'U_a', yu: 'V', top: 24 });
      if (!F) return false;
      const pl = F.pl, X = F.X, Y = F.Y, H = d.usat, Lo = -usN;
      line(ctx, X(0), pl.y, X(0), pl.y + pl.h, P.line, 1.5); line(ctx, pl.x, Y(0), pl.x + pl.w, Y(0), P.line, 1.5);
      /* Aussteuergrenzen */
      line(ctx, pl.x, Y(H), pl.x + pl.w, Y(H), P.err, 1.5, KINDS.err.dash); line(ctx, pl.x, Y(Lo), pl.x + pl.w, Y(Lo), P.err, 1.5, KINDS.err.dash);
      T(ctx, E.box, P, '+U_sat = ' + fe(H, 'V'), pl.x + 4, Y(H) - 9, { size: 11, align: 'left', color: P.err, bold: true });
      T(ctx, E.box, P, '−U_sat = ' + fe(usN, 'V'), pl.x + 4, Y(Lo) + 9, { size: 11, align: 'left', color: P.err, bold: true });
      /* Aeste: inv: oben bis U_o, unten ab U_u; nin: unten bis U_o, oben ab U_u */
      const col = P.out, w = 3.5, yA = art === 'inv' ? H : Lo, yB = art === 'inv' ? Lo : H;
      const xa0 = -xm, xa1 = uo, xb0 = uu, xb1 = xm;
      polyline(ctx, [[X(xa0), Y(yA)], [X(xa1), Y(yA)]], col, w, []);
      polyline(ctx, [[X(xb0), Y(yB)], [X(xb1), Y(yB)]], col, w, KINDS.out.dash);
      polyline(ctx, [[X(uo), Y(yA)], [X(uo), Y(yB)]], col, w, []);
      if (hasH) polyline(ctx, [[X(uu), Y(yB)], [X(uu), Y(yA)]], col, w, KINDS.out.dash);
      const ah = 11;
      arrowHead(ctx, X(xa1) - 30, Y(yA), X(xa1) - 30 + 12, Y(yA), P.fg, ah);
      arrowHead(ctx, X(xb1) - 12, Y(yB), X(xb1) - 12 - 12, Y(yB), P.fg, ah);
      const goDown = yB < yA;
      arrowHead(ctx, X(uo), Y((yA + yB) / 2) - (goDown ? 8 : -8), X(uo), Y((yA + yB) / 2) + (goDown ? 8 : -8), P.fg, ah);
      if (hasH) arrowHead(ctx, X(uu), Y((yA + yB) / 2) + (goDown ? 8 : -8), X(uu), Y((yA + yB) / 2) - (goDown ? 8 : -8), P.fg, ah);
      /* Schaltschwellen */
      const right = X(uo) > pl.x + pl.w * 0.65;
      line(ctx, X(uo), Y(Lo), X(uo), pl.y + pl.h, P.u, 1.5, [5, 3]);
      T(ctx, E.box, P, 'U_o = ' + fe(uo, 'V'), X(uo) + (right ? -6 : 6), Y(0) + (art === 'inv' ? 16 : -16), { size: 11, bold: true, color: P.u, align: right ? 'right' : 'left' });
      if (hasH) {
        T(ctx, E.box, P, 'U_u = ' + fe(uu, 'V'), X(uu) + (X(uu) < pl.x + pl.w * 0.35 ? 6 : -6), Y(0) + (art === 'inv' ? -16 : 16), { size: 11, bold: true, color: P.u, align: X(uu) < pl.x + pl.w * 0.35 ? 'left' : 'right' });
        const yh = Y(0) + (art === 'inv' ? 34 : -34);
        arrow(ctx, X(uu), yh, X(uo), yh, P.fg, 1.5, null, 7); arrow(ctx, X(uo), yh, X(uu), yh, P.fg, 1.5, null, 7);
        T(ctx, E.box, P, 'U_H = ' + fe(finS(d.uh) ? d.uh : uo - uu, 'V'), (X(uu) + X(uo)) / 2, yh + (art === 'inv' ? 12 : -12), { size: 11, bold: true });
      } else {
        T(ctx, E.box, P, 'keine Hysterese: U_H = 0 V', pl.x + pl.w / 2, pl.y + pl.h - 10, { size: 11, bold: true, color: P.err });
      }
      T(ctx, E.box, P, art === 'inv' ? 'invertierend (Pfeile: Umlaufsinn)' : 'nichtinvertierend (Pfeile: Umlaufsinn)', pl.x + pl.w - 4, pl.y + 9, { size: 11, align: 'right', color: P.mute, bg: false, maxw: pl.w * 0.8 });
      if (finS(d.ue) && finS(d.ua)) {
        const mx = X(d.ue), my = Y(d.ua);
        dot(ctx, mx, my, 8, P.fg); dot(ctx, mx, my, 6.5, P.markEdge); dot(ctx, mx, my, 5, P.mark);
        T(ctx, E.box, P, 'U_e = ' + fe(d.ue, 'V') + ', U_a = ' + fe(d.ua, 'V'), mx + (mx > pl.x + pl.w * 0.55 ? -10 : 10), my + (my < pl.y + pl.h * 0.5 ? 16 : -16), { size: 11, bold: true, align: mx > pl.x + pl.w * 0.55 ? 'right' : 'left', maxw: pl.w * 0.8 });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Bode-Diagramm */
  const BODE_TYP = { tief: 'Tiefpass: −20 dB je Dekade', hoch: 'Hochpass: +20 dB je Dekade', int: 'Integrierer: −20 dB je Dekade', diff: 'Differenzierer: +20 dB je Dekade', ver: 'Verstärker mit Gegenkopplung' };
  function bode(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 150, 130);
    if (!E || !numArr(d.f, 3, 5000) || !numArr(d.a, 3, 5000) || d.a.length !== d.f.length || !d.f.every(v => v > 0)) return false;
    if (d.phi !== undefined && d.phi !== null && !(numArr(d.phi, 3, 5000) && d.phi.length === d.f.length)) return false;
    if (d.open !== undefined && d.open !== null && !(numArr(d.open, 3, 5000) && d.open.length === d.f.length)) return false;
    const f = d.f, a = d.a, n = f.length, fmin = Math.min.apply(null, f), fmax = Math.max.apply(null, f);
    if (!(fmax > fmin) || Math.log10(fmax / fmin) > 12) return false;
    let asy = null;
    if (Array.isArray(d.asymp) && d.asymp.length === n) {
      if (d.asymp.every(finS)) asy = d.asymp.slice();
      else if (d.asymp.every(p => Array.isArray(p) && finS(p[1]))) asy = d.asymp.map(p => p[1]);
    }
    const P = E.P, typ = BODE_TYP[d.typ] ? d.typ : '', fg = finS(d.fg) && d.fg > 0 ? d.fg : NaN, ph = d.phi || null, op = d.open || null;
    const gbw = finS(d.gbw) && d.gbw > 0 ? d.gbw : NaN, fA = finS(d.fA) && d.fA > 0 ? d.fA : NaN;
    const all = a.concat(asy || [], op || []), lo0 = Math.min.apply(null, all), hi0 = Math.max.apply(null, all), pad = 10;
    const lo = Math.floor((Math.min(lo0, 0) - 1) / pad) * pad, hi = Math.ceil((Math.max(hi0, 0) + 1) / pad) * pad;
    const legend = [{ text: 'a(f)', key: 'u', dash: [] }];
    if (op) legend.push({ text: 'Leerlauf', key: 'out', dash: KINDS.out.dash });
    if (asy) legend.push({ text: 'Asymptoten', key: 'mute', dash: [7, 4] });
    const two = ph && rect.h >= 270, h1 = two ? Math.round(rect.h * 0.58) : rect.h, legH = legendH(ctx, rect, legend);
    if (!plFits({ w: rect.w, h: h1 }, 52, 24 + legH, 12, two ? 8 : 30)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const r1 = { x: rect.x, y: rect.y, w: rect.w, h: h1 };
      const span = hi - lo, ds = span > 120 ? 40 : span > 60 ? 20 : span > 30 ? 10 : 5, yt = []; for (let v = Math.ceil(lo / ds) * ds; v <= hi; v += ds) yt.push(v);
      const F1 = frame(ctx, E, r1, { x0: fmin, x1: fmax, y0: lo, y1: hi, xlog: true, xl: 'f', xu: 'Hz', yl: 'a', yu: 'dB', top: 24 + legH, xLabels: !two, yticks: yt });
      if (!F1) return false;
      const pl = F1.pl, step = thin(n, E), m = Math.max(3, Math.ceil(n * E.wipe));
      line(ctx, pl.x, F1.Y(0), pl.x + pl.w, F1.Y(0), P.line, 1.5);
      legendDraw(ctx, E, rect, legend, rect.y + 4);
      if (op) { const po = []; for (let i = 0; i < n; i += step) po.push([F1.X(f[i]), F1.Y(op[i])]); po.push([F1.X(f[n - 1]), F1.Y(op[n - 1])]); polyline(ctx, po, P.out, 2.5, KINDS.out.dash); }
      if (asy) { const pa = []; for (let i = 0; i < n; i += step) pa.push([F1.X(f[i]), F1.Y(asy[i])]); polyline(ctx, pa, P.mute, 2, [7, 4]); }
      const pm = []; for (let i = 0; i < m; i += step) pm.push([F1.X(f[i]), F1.Y(a[i])]); pm.push([F1.X(f[m - 1]), F1.Y(a[m - 1])]);
      polyline(ctx, pm, P.u, 3);
      if (finS(gbw) && gbw >= fmin && gbw <= fmax) {
        const x = F1.X(gbw);
        line(ctx, x, pl.y, x, pl.y + pl.h, P.i, 1.5, KINDS.i.dash); dot(ctx, x, F1.Y(0), 5, P.fg); dot(ctx, x, F1.Y(0), 3, P.i);
        T(ctx, E.box, P, 'GBW = ' + fe(gbw, 'Hz'), x + (x > pl.x + pl.w * 0.6 ? -6 : 6), pl.y + 24, { size: 11, bold: true, color: P.i, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', maxw: pl.w * 0.5 });
      }
      if (finS(fA) && fA >= fmin && fA <= fmax) {
        const x = F1.X(fA);
        line(ctx, x, pl.y, x, pl.y + pl.h, P.out, 1.5, KINDS.out.dash);
        T(ctx, E.box, P, 'f_A = ' + fe(fA, 'Hz'), x + (x > pl.x + pl.w * 0.6 ? -8 : 8), pl.y + 10, { size: 11, bold: true, color: P.out, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', maxw: pl.w * 0.5 });
      }
      if (finS(fg) && fg >= fmin && fg <= fmax) {
        const x = F1.X(fg), ag = interp(f, a, fg, true), dwn = interp(f, a, fg * 1.4, true) <= interp(f, a, fg / 1.4, true);
        line(ctx, x, pl.y, x, pl.y + pl.h, P.fg, 1.5, [6, 3]);
        T(ctx, E.box, P, 'Knick f_g = ' + fe(fg, 'Hz'), x + 5, pl.y + pl.h - 10, { size: 11, bold: true, align: x > pl.x + pl.w * 0.6 ? 'right' : 'left', maxw: pl.w * 0.6 });
        if (finS(ag)) { dot(ctx, x, F1.Y(ag), 5, P.fg); dot(ctx, x, F1.Y(ag), 3, P.u); T(ctx, E.box, P, 'a(f_g) = ' + fz(ag, 2) + ' dB', x - 8, F1.Y(ag) + (dwn ? 14 : -14), { size: 11, bold: true, color: P.u, align: 'right', maxw: pl.w * 0.5 }); }
      }
      const sl = finS(d.slope) ? (d.slope < 0 ? '−' : d.slope > 0 ? '+' : '') + fz(Math.abs(d.slope), 0) + ' dB je Dekade' : (typ ? BODE_TYP[typ] : '');
      if (sl) T(ctx, E.box, P, sl, pl.x + pl.w - 4, pl.y + pl.h - 10, { size: 11, align: 'right', color: P.mute, maxw: pl.w * 0.6 });
      if (two) {
        const r2 = { x: rect.x, y: rect.y + h1, w: rect.w, h: rect.h - h1 };
        const F2 = frame(ctx, E, r2, { x0: fmin, x1: fmax, y0: -200, y1: 200, xlog: true, xl: 'f', xu: 'Hz', yl: 'φ', yu: '°', top: 20, yticks: [-180, -90, 0, 90, 180] });
        if (F2) {
          line(ctx, F2.pl.x, F2.Y(0), F2.pl.x + F2.pl.w, F2.Y(0), P.line, 1.5);
          const pp = []; for (let i = 0; i < m; i += step) pp.push([F2.X(f[i]), F2.Y(ph[i])]); pp.push([F2.X(f[m - 1]), F2.Y(ph[m - 1])]);
          polyline(ctx, pp, P.i, 3, KINDS.i.dash);
          if (finS(fg) && fg >= fmin && fg <= fmax) {
            const x = F2.X(fg), pg = interp(f, ph, fg, true), dwp = interp(f, ph, fg * 1.4, true) <= interp(f, ph, fg / 1.4, true);
            line(ctx, x, F2.pl.y, x, F2.pl.y + F2.pl.h, P.fg, 1.5, [6, 3]);
            if (finS(pg)) { dot(ctx, x, F2.Y(pg), 5, P.fg); dot(ctx, x, F2.Y(pg), 3, P.i); T(ctx, E.box, P, 'φ(f_g) = ' + fz(pg, 1) + '°', x - 8, F2.Y(pg) + (dwp ? 14 : -14), { size: 11, bold: true, color: P.i, align: 'right', maxw: F2.pl.w * 0.5 }); }
          }
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Balken (Spektrum, Offset, Verlustleistung) */
  function bar(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 110);
    if (!E || !Array.isArray(d.items) || d.items.length < 1 || d.items.length > 16 || !str(d.label)) return false;
    const it = d.items.map(x => obj(x));
    if (!it.every(x => str(x.name) && fin(x.value))) return false;
    const unit0 = str(d.unit) || str(it[0].unit), n = it.length;
    const mk = d.mark && finS(obj(d.mark).value) ? obj(d.mark) : null;
    let lo = 0, hi = 0;
    it.forEach(x => { if (x.value < lo) lo = x.value; if (x.value > hi) hi = x.value; });
    if (mk) { hi = Math.max(hi, mk.value); lo = Math.min(lo, mk.value); }
    if (!(hi > lo)) hi = lo + 1;
    const span = hi - lo; if (hi > 0) hi += span * 0.14; if (lo < 0) lo -= span * 0.14;
    const pf = prefixFor(Math.max(Math.abs(lo), Math.abs(hi)), unit0);
    const horiz = d.dir === 'h' || (d.dir !== 'v' && (n > 10 || rect.w / n < 26));
    const title = str(d.title), top = 24 + (title ? 14 : 0);
    if (!horiz ? !plFits(rect, 54, top, 12, 34) : !(rect.w - Math.min(rect.w * 0.34, 110) - 70 >= 30 && rect.h - top - 10 >= 7 * n && rect.h - top - 10 >= 14)) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const P = E.P;
      if (title) T(ctx, E.box, P, title, rect.x + 4, rect.y + 9, { size: 12, bold: true, align: 'left', bg: false, maxw: rect.w - 8 });
      const yl = str(d.label) + (pf.u ? ' in ' + pf.u : '');
      const val = x => fv(x.value, str(x.unit) || unit0);
      if (!horiz) {
        const left = 54, pl = { x: rect.x + left, y: rect.y + top, w: rect.w - left - 12, h: rect.h - top - 34 };
        if (pl.w < 40 || pl.h < 24) return false;
        const Y = v => pl.y + pl.h - (v * pf.k - lo * pf.k) / ((hi - lo) * pf.k) * pl.h;
        ctx.fillStyle = P.panel; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        const yt = niceTicks(lo * pf.k, hi * pf.k, Math.max(2, Math.floor(pl.h / 36))), yd = decOf(yt.length > 1 ? yt[1] - yt[0] : 1);
        ctx.strokeStyle = P.grid; ctx.lineWidth = 1; ctx.beginPath(); yt.forEach(v => { const y = Y(v / pf.k); ctx.moveTo(pl.x, y); ctx.lineTo(pl.x + pl.w, y); }); ctx.stroke();
        ctx.strokeStyle = P.line; ctx.strokeRect(pl.x, pl.y, pl.w, pl.h);
        yt.forEach(v => T(ctx, E.box, P, fz(v, yd), pl.x - 4, Y(v / pf.k), { size: 11, color: P.mute, align: 'right', bg: false, maxw: left - 6 }));
        T(ctx, E.box, P, yl, rect.x + 3, rect.y + top - 9, { size: 11, align: 'left', bg: false, maxw: rect.w - 6 });
        const slot = pl.w / n, bw = Math.max(4, Math.min(48, slot * 0.58)), z = Y(0);
        line(ctx, pl.x, z, pl.x + pl.w, z, P.fg, 1.5);
        font(ctx, 11, false);
        const strideN = Math.max(1, Math.ceil(Math.max.apply(null, it.map(x => tw(ctx, x.name, 11, false))) / Math.max(slot, 1))), strideV = Math.max(1, Math.ceil(Math.max.apply(null, it.map(x => tw(ctx, val(x), 11, true))) / Math.max(slot, 1)));
        it.forEach((x, i) => {
          const kk = typeof x.kind === 'string' && KINDS[x.kind] ? x.kind : 'u', st = KINDS[kk], cx = pl.x + slot * (i + 0.5), y = Y(x.value), x0 = cx - bw / 2;
          const yt0 = Math.min(y, z), hh = Math.abs(y - z);
          ctx.globalAlpha = 0.35; ctx.fillStyle = P[st.key]; ctx.fillRect(x0, yt0, bw, Math.max(hh, 0)); ctx.globalAlpha = 1;
          ctx.strokeStyle = P[st.key]; ctx.lineWidth = 2.5; setDash(ctx, st.dash); ctx.strokeRect(x0, yt0, bw, Math.max(hh, 0)); setDash(ctx, []);
          if (i % strideV === 0) T(ctx, E.box, P, val(x), cx, x.value >= 0 ? y - 9 : y + 9, { size: 11, bold: true, maxw: Math.max(slot * strideV, 40) });
          if (i % strideN === 0) T(ctx, E.box, P, x.name, cx, rect.y + rect.h - 14, { size: 11, color: P.mute, bg: false, maxw: Math.max(slot * strideN, 30) });
        });
        if (mk) { const y = Y(mk.value); line(ctx, pl.x, y, pl.x + pl.w, y, P.err, 2, KINDS.err.dash); T(ctx, E.box, P, str(mk.name) + ' = ' + fv(mk.value, unit0), pl.x + pl.w - 4, y - 9, { size: 11, align: 'right', color: P.err, bold: true }); }
      } else {
        const nameW = Math.min(rect.w * 0.34, 110), pl = { x: rect.x + nameW + 6, y: rect.y + top, w: rect.w - nameW - 70, h: rect.h - top - 10 };
        if (pl.w < 30 || pl.h < 14 * n * 0.5) return false;
        const X = v => pl.x + (v - lo) / (hi - lo) * pl.w, slot = pl.h / n, bh = Math.max(4, Math.min(24, slot * 0.6)), z = X(0);
        T(ctx, E.box, P, yl, rect.x + 3, rect.y + top - 9, { size: 11, align: 'left', bg: false, maxw: rect.w - 6 });
        ctx.fillStyle = P.panel; ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
        line(ctx, z, pl.y, z, pl.y + pl.h, P.fg, 1.5);
        it.forEach((x, i) => {
          const kk = typeof x.kind === 'string' && KINDS[x.kind] ? x.kind : 'u', st = KINDS[kk], cy = pl.y + slot * (i + 0.5), xv = X(x.value), x0 = Math.min(xv, z), ww = Math.abs(xv - z);
          ctx.globalAlpha = 0.35; ctx.fillStyle = P[st.key]; ctx.fillRect(x0, cy - bh / 2, ww, bh); ctx.globalAlpha = 1;
          ctx.strokeStyle = P[st.key]; ctx.lineWidth = 2.5; setDash(ctx, st.dash); ctx.strokeRect(x0, cy - bh / 2, ww, bh); setDash(ctx, []);
          T(ctx, E.box, P, x.name, pl.x - 4 - 0, cy, { size: 11, color: P.mute, align: 'right', bg: false, maxw: nameW });
          T(ctx, E.box, P, val(x), x.value >= 0 ? xv + 5 : xv - 5, cy, { size: 11, bold: true, align: x.value >= 0 ? 'left' : 'right', maxw: 66 });
        });
        if (mk) { const x = X(mk.value); line(ctx, x, pl.y, x, pl.y + pl.h, P.err, 2, KINDS.err.dash); T(ctx, E.box, P, str(mk.name) + ' = ' + fv(mk.value, unit0), x, pl.y + pl.h + 1, { size: 11, color: P.err, bold: true }); }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Messgeraet (Zeiger oder Ziffern, "∞") */
  function meter(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 90, 70), mn = finS(d.min) ? d.min : 0, text = str(d.text);
    if (!E || !finS(d.max) || !(d.max > mn)) return false;
    const infAbove = fin(d.infAbove) ? d.infAbove : 1e11;
    const isInf = d.inf === true || (fin(d.value) && d.value >= infAbove);
    if (!text && !isInf && !finS(d.value)) return false;
    const P = E.P, unit = str(d.unit), label = str(d.label), digital = d.kind === 'digital' || !!text, value = isInf ? d.max : (finS(d.value) ? d.value : mn);
    const over = !isInf && !text && (value < mn || value > d.max);
    const frac = cl((value - mn) / (d.max - mn), 0, 1);
    const zone = d.zone && finS(d.zone.from) && finS(d.zone.to) && d.zone.to > d.zone.from ? d.zone : null;
    return draw(ctx, () => {
      bgFill(ctx, E);
      if (label) T(ctx, E.box, P, label, rect.x + rect.w / 2, rect.y + 10, { size: 11, bold: true, maxw: rect.w - 8 });
      const txt = text || (isInf ? '∞' + (unit ? ' ' + unit : '') : fv(value, unit) + (over ? ' (außerhalb der Skala)' : ''));
      if (digital) {
        ctx.fillStyle = P.panel; rrect(ctx, rect.x + 6, rect.y + 22, rect.w - 12, rect.h - 28, 8); ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 2; rrect(ctx, rect.x + 6, rect.y + 22, rect.w - 12, rect.h - 28, 8); ctx.stroke();
        T(ctx, E.box, P, txt, rect.x + rect.w / 2, rect.y + 22 + (rect.h - 28) / 2, { size: Math.max(14, Math.min(26, rect.h * 0.28)), bold: true, bg: false, maxw: rect.w - 20 });
        return true;
      }
      const cx = rect.x + rect.w / 2, R = Math.max(20, Math.min(rect.w / 2 - 34, (rect.h - 48) / 1.5)), cy = rect.y + 26 + R, pf = prefixFor(Math.max(Math.abs(mn), Math.abs(d.max)), unit);
      const a0 = 210, sweep = 240, pos = fr => rad(a0 - sweep * fr);
      ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, -pos(0), -pos(1), false); ctx.stroke();
      if (zone) { const f0 = cl((zone.from - mn) / (d.max - mn), 0, 1), f1 = cl((zone.to - mn) / (d.max - mn), 0, 1); ctx.strokeStyle = P.ok; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, R - 6, -pos(f0), -pos(f1), false); ctx.stroke(); }
      for (let i = 0; i <= 5; i++) {
        const fr = i / 5, a = pos(fr), c = Math.cos(a), s = Math.sin(a);
        line(ctx, cx + (R - 8) * c, cy - (R - 8) * s, cx + R * c, cy - R * s, P.fg, 2);
        T(ctx, E.box, P, fz((mn + (d.max - mn) * fr) * pf.k, decOf((d.max - mn) * pf.k / 5)), cx + (R + 12) * c * 0.94, cy - (R + 12) * s * 0.94, { size: 11, color: P.mute, bg: false, maxw: 44 });
      }
      const na = pos(frac);
      arrow(ctx, cx, cy, cx + (R - 4) * Math.cos(na), cy - (R - 4) * Math.sin(na), P.i, 3, null, 10);
      dot(ctx, cx, cy, 4, P.fg);
      T(ctx, E.box, P, txt, cx, rect.y + rect.h - 8, { size: 12, bold: true, maxw: rect.w - 8 });
      return true;
    });
  }

  /* ------------------------------------------------------------------ Schaltbild */
  const SCH_NAMES = {
    uq: 'U_q', ub: 'U_B', ue: 'U_e', ua: 'U_a', ust: 'U_St', uz: 'U_Z', uref: 'U_ref', u1: 'U_1', u2: 'U_2', u3: 'U_3',
    rv: 'R_V', rb: 'R_B', r: 'R', r1: 'R_1', r2: 'R_2', r3: 'R_3', r4: 'R_4', rc: 'R_C', re: 'R_E', re1: 'R_E1', re2: 'R_E2', rg: 'R_G', rl: 'R_L', rf: 'R_f', rp: 'R_p',
    rlast: 'R_L', uf: 'U_F', rspule: 'R_Spule', lspule: 'L', c: 'C', c1: 'C_1', c2: 'C_2', ce: 'C_E', cb: 'C_B', diode: 'Diode', led: 'LED', z: 'Z-Diode'
  };
  const SCHEMATIC_KINDS = ['diode', 'schalter', 'emitter', 'kollektor', 'basis', 'zfolger', 'konstantstrom', 'opv_inv', 'opv_nin', 'opv_folger', 'summierer', 'differenz', 'schmitt', 'osc', 'integrierer', 'differenzierer', 'tp', 'hp'];
  const DW = 440, DH = 300;

  /* Zeichner: alle Koordinaten in Entwurfsraum 440 x 300, Text immer mit fester Pixelgroesse in Bildkoordinaten */
  function makeG(ctx, E, rect, d) {
    const P = E.P, s = Math.max(0.3, Math.min((rect.w - 8) / DW, (rect.h - 8) / DH, 2));
    const ox = rect.x + (rect.w - DW * s) / 2, oy = rect.y + (rect.h - DH * s) / 2;
    const X = x => ox + x * s, Y = y => oy + y * s;
    const vals = obj(d.values), labs = obj(d.labels);
    const fl = [].concat(d.fault === undefined || d.fault === null ? [] : d.fault).map(f => (typeof f === 'string' ? f : obj(f).id)).filter(x => typeof x === 'string' && x);
    const hid = Array.isArray(d.hide) ? d.hide.filter(x => typeof x === 'string') : [];
    const G = { P, s, X, Y, d, faults: fl };
    G.isF = id => fl.indexOf(id) >= 0;
    G.hide = id => hid.indexOf(id) >= 0;
    G.has = id => !G.hide(id) && str(vals[id]) !== '';
    G.ink = id => (G.isF(id) ? P.err : P.fg);
    G.val = id => str(vals[id]);
    G.lab = id => { const v = str(vals[id]); return /=/.test(v) ? v : (SCH_NAMES[id] || id) + (v ? ' = ' + v : ''); };
    G.L = id => str(labs[id]);
    G.t = (text, x, y, o) => { o = o || {}; return T(ctx, E.box, P, text, X(x), Y(y), { size: 11, align: o.align || 'left', color: o.color, bold: o.bold, bg: o.bg }); };
    G.wire = function () { const pts = [].slice.call(arguments); if (pts.length < 2) return; ctx.strokeStyle = P.fg; ctx.lineWidth = 2; setDash(ctx, []); ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach((p, i) => { if (i) ctx.lineTo(X(p[0]), Y(p[1])); else ctx.moveTo(X(p[0]), Y(p[1])); }); ctx.stroke(); };
    G.node = (x, y) => dot(ctx, X(x), Y(y), 3.2, P.fg);
    G.gnd = (x, y) => {
      ctx.strokeStyle = P.gnd; ctx.lineWidth = 2; setDash(ctx, []);
      ctx.beginPath(); ctx.moveTo(X(x), Y(y)); ctx.lineTo(X(x), Y(y + 6));
      [[7, 8], [4.5, 12], [2, 16]].forEach(p => { ctx.moveTo(X(x - p[0]), Y(y + p[1] - 2)); ctx.lineTo(X(x + p[0]), Y(y + p[1] - 2)); });
      ctx.stroke();
    };
    /* Anschlussring (Messpunkt, Klemme) mit Beschriftung */
    G.ring = (x, y) => { ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(X(x), Y(y), 4.5, 0, TAU); ctx.fill(); ring(ctx, X(x), Y(y), 4.5, P.fg, 2); };
    /* Fehlerstelle: Kreuz */
    G.cross = (x, y) => { const r = 7; ctx.strokeStyle = P.err; ctx.lineWidth = 3; setDash(ctx, []); ctx.beginPath(); ctx.moveTo(X(x) - r, Y(y) - r); ctx.lineTo(X(x) + r, Y(y) + r); ctx.moveTo(X(x) + r, Y(y) - r); ctx.lineTo(X(x) - r, Y(y) + r); ctx.stroke(); };
    /* Zweipol: Mitte (x, y), Winkel o in Grad, Anschluesse bei +-22. body zeichnet im lokalen System mit c = Mass */
    G.two = (id, x, y, o, body) => {
      const col = G.ink(id), c = k => k * s;
      ctx.save(); ctx.translate(X(x), Y(y)); ctx.rotate(rad(o)); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; setDash(ctx, []); ctx.lineJoin = 'round';
      body(c, col);
      ctx.restore();
      if (G.isF(id)) G.cross(x, y);
    };
    /* Beschriftung neben einem Zweipol: Seite a (ueber), b (unter), l (links), r (rechts) */
    G.name = (id, x, y, o, side, text) => {
      const t = text || G.lab(id); if (!t) return;
      const col = G.isF(id) ? P.err : P.fg;
      if (side === 'a') G.t(t, x, y - 20, { align: 'center', color: col });
      else if (side === 'b') G.t(t, x, y + 20, { align: 'center', color: col });
      else if (side === 'l') G.t(t, x - 16, y, { align: 'right', color: col });
      else G.t(t, x + 16, y, { align: 'left', color: col });
    };
    G.res = (id, x, y, o, side, text) => {
      if (G.hide(id)) return;
      G.two(id, x, y, o === 'v' ? 90 : 0, (c) => { ctx.beginPath(); ctx.moveTo(c(-22), 0); ctx.lineTo(c(-14), 0); ctx.moveTo(c(14), 0); ctx.lineTo(c(22), 0); ctx.stroke(); ctx.strokeRect(c(-14), c(-6), c(28), c(12)); });
      G.name(id, x, y, o, side || 'a', text);
    };
    G.cap = (id, x, y, o, side, text) => {
      if (G.hide(id)) return;
      G.two(id, x, y, o === 'v' ? 90 : 0, (c) => { ctx.beginPath(); ctx.moveTo(c(-22), 0); ctx.lineTo(c(-3), 0); ctx.moveTo(c(3), 0); ctx.lineTo(c(22), 0); ctx.moveTo(c(-3), c(-10)); ctx.lineTo(c(-3), c(10)); ctx.moveTo(c(3), c(-10)); ctx.lineTo(c(3), c(10)); ctx.stroke(); });
      G.name(id, x, y, o, side || 'a', text);
    };
    G.coil = (id, x, y, o, side, text) => {
      if (G.hide(id)) return;
      G.two(id, x, y, o === 'v' ? 90 : 0, (c) => { ctx.beginPath(); ctx.moveTo(c(-22), 0); ctx.lineTo(c(-12), 0); for (let i = 0; i < 4; i++) ctx.arc(c(-9 + 6 * i), 0, c(3), Math.PI, 0, false); ctx.moveTo(c(12), 0); ctx.lineTo(c(22), 0); ctx.stroke(); });
      G.name(id, x, y, o, side || 'a', text);
    };
    G.relay = (id, x, y, o, side, text) => {
      if (G.hide(id)) return;
      G.two(id, x, y, o === 'v' ? 90 : 0, (c) => { ctx.beginPath(); ctx.moveTo(c(-22), 0); ctx.lineTo(c(-14), 0); ctx.moveTo(c(14), 0); ctx.lineTo(c(22), 0); ctx.moveTo(c(-8), c(5)); ctx.lineTo(c(8), c(-5)); ctx.stroke(); ctx.strokeRect(c(-14), c(-7), c(28), c(14)); });
      G.name(id, x, y, o, side || 'a', text);
    };
    /* Diode: o Winkel der Durchlassrichtung (0 = nach rechts, 90 = nach unten, 270 = nach oben); typ si, schottky, led, z */
    G.diode = (id, x, y, o, typ, side, text) => {
      if (G.hide(id)) return;
      G.two(id, x, y, o, (c, col) => {
        ctx.beginPath(); ctx.moveTo(c(-22), 0); ctx.lineTo(c(-6), 0); ctx.moveTo(c(7), 0); ctx.lineTo(c(22), 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c(-6), c(-8)); ctx.lineTo(c(-6), c(8)); ctx.lineTo(c(7), 0); ctx.closePath(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c(7), c(-8)); ctx.lineTo(c(7), c(8));
        if (typ === 'z') { ctx.moveTo(c(4), c(-10)); ctx.lineTo(c(7), c(-8)); ctx.moveTo(c(7), c(8)); ctx.lineTo(c(10), c(10)); }
        if (typ === 'schottky') { ctx.moveTo(c(4), c(-5)); ctx.lineTo(c(4), c(-8)); ctx.moveTo(c(10), c(5)); ctx.lineTo(c(10), c(8)); ctx.moveTo(c(7), c(8)); ctx.lineTo(c(10), c(8)); ctx.moveTo(c(7), c(-8)); ctx.lineTo(c(4), c(-8)); }
        ctx.stroke();
        if (typ === 'led') { [[-3, 3], [3, 3]].forEach(p => { const ax = c(p[0]), ay = c(-9), bx = ax + c(6), by = ay - c(7); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); arrowHead(ctx, ax, ay, bx, by, col, c(5)); }); }
      });
      const tt = text || (G.has(id) ? G.lab(id) : '');
      if (tt) G.t(tt, side === 'l' ? x - 26 : x + 26, y, { align: side === 'l' ? 'right' : 'left', color: G.isF(id) ? P.err : P.fg });
    };
    /* Spannungsquelle (Mitte, Anschluesse oben/unten bei +-14); ac: Sinus */
    G.src = (id, x, y, ac) => {
      const col = G.ink(id), r = 14 * s;
      ctx.strokeStyle = col; ctx.lineWidth = 2; setDash(ctx, []);
      ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, TAU); ctx.stroke();
      ctx.beginPath();
      if (ac) { for (let i = 0; i <= 12; i++) { const px = X(x) + (i / 12 * 16 - 8) * s, py = Y(y) - Math.sin(i / 12 * TAU) * 4 * s; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } } else {
        ctx.moveTo(X(x) - 3 * s, Y(y) - 5 * s); ctx.lineTo(X(x) + 3 * s, Y(y) - 5 * s); ctx.moveTo(X(x), Y(y) - 8 * s); ctx.lineTo(X(x), Y(y) - 2 * s); ctx.moveTo(X(x) - 3 * s, Y(y) + 5 * s); ctx.lineTo(X(x) + 3 * s, Y(y) + 5 * s);
      }
      ctx.stroke();
      if (G.isF(id)) G.cross(x, y);
    };
    /* npn: Mitte (x, y); Anschluesse b (x-22, y), c (x+8, y-22), e (x+8, y+22) */
    G.npn = (x, y, id) => {
      const col = G.ink(id || 'q'), c = k => k * s, px = X(x), py = Y(y);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2; setDash(ctx, []); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.arc(px, py, c(22), 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - c(22), py); ctx.lineTo(px - c(8), py); ctx.moveTo(px - c(8), py - c(12)); ctx.lineTo(px - c(8), py + c(12));
      ctx.moveTo(px - c(8), py - c(5)); ctx.lineTo(px + c(8), py - c(16)); ctx.lineTo(px + c(8), py - c(22));
      ctx.moveTo(px - c(8), py + c(5)); ctx.lineTo(px + c(8), py + c(16)); ctx.lineTo(px + c(8), py + c(22)); ctx.stroke();
      arrowHead(ctx, px - c(8), py + c(5), px + c(7), py + c(15.5), col, c(8));
      if (G.isF(id || 'q')) G.cross(x, y);
      return { b: [x - 22, y], c: [x + 8, y - 22], e: [x + 8, y + 22] };
    };
    /* Operationsverstaerker: Mitte (x, y); normal: - oben, + unten; flip: + oben, - unten. Anschluesse enden bei x-48 (Eingaenge), x+52 (Ausgang), Versorgung bei y-36 / y+36 */
    G.opamp = (x, y, flip, id) => {
      const col = G.ink(id || 'op'), c = k => k * s, px = X(x), py = Y(y);
      ctx.strokeStyle = col; ctx.lineWidth = 2; setDash(ctx, []); ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(px - c(28), py - c(32)); ctx.lineTo(px - c(28), py + c(32)); ctx.lineTo(px + c(32), py); ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - c(48), py - c(15)); ctx.lineTo(px - c(28), py - c(15)); ctx.moveTo(px - c(48), py + c(15)); ctx.lineTo(px - c(28), py + c(15));
      ctx.moveTo(px + c(32), py); ctx.lineTo(px + c(52), py);
      ctx.moveTo(px, py - c(16)); ctx.lineTo(px, py - c(36)); ctx.moveTo(px, py + c(16)); ctx.lineTo(px, py + c(36)); ctx.stroke();
      G.t(flip ? '+' : '−', x - 21, y - 15, { align: 'left', bold: true, bg: false });
      G.t(flip ? '−' : '+', x - 21, y + 15, { align: 'left', bold: true, bg: false });
      if (G.isF(id || 'op')) G.cross(x, y);
      return flip ? { inm: [x - 48, y + 15], inp: [x - 48, y - 15], out: [x + 52, y], up: [x, y - 36], un: [x, y + 36] } : { inm: [x - 48, y - 15], inp: [x - 48, y + 15], out: [x + 52, y], up: [x, y - 36], un: [x, y + 36] };
    };
    /* Pfeile: Strom (orange, gestrichelt) und Spannung (blau; gruen fuer Ausgang) mit fertigem Text aus dem Kern */
    G.ia = (text, x, y, dir, tx, ty, al) => {
      if (!text) return;
      const dx = dir === 'r' ? 1 : dir === 'l' ? -1 : 0, dy = dir === 'd' ? 1 : dir === 'u' ? -1 : 0, h = 12 * s;
      arrow(ctx, X(x) - dx * h, Y(y) - dy * h, X(x) + dx * h, Y(y) + dy * h, P.i, 2.5, [4, 3], 9);
      G.t(text, tx, ty, { align: al, color: P.i, bold: true });
    };
    G.ua = (text, xa, ya, xb, yb, tx, ty, al, kind) => {
      if (!text) return;
      const key = kind === 'out' ? 'out' : 'u';
      arrow(ctx, X(xa), Y(ya), X(xb), Y(yb), P[key], 2, kind === 'out' ? KINDS.out.dash : [], 9);
      G.t(text, tx, ty, { align: al, color: P[key], bold: true });
    };
    return G;
  }

  /* Schaltungsbausteine. Jeder Baustein liest nur values/labels/flags aus d und zeichnet; keine Rechnung. */
  const SCH = {};
  const DIODE_TYP = { si: 'si', schottky: 'schottky', led: 'led', led_rot: 'led', led_gelb: 'led', led_gruen: 'led', led_blau: 'led', z: 'z' };
  SCH.diode = (G, d) => {
    const typ = DIODE_TYP[d.typ] || 'si', rev = d.rev === true, o = ((typ === 'z') !== rev) ? 270 : 90, TY = 60, BY = 250;
    G.src('uq', 50, 155, false);
    G.wire([50, 141], [50, TY], [100, TY]);
    G.res('rv', 120, TY, 'h', 'a');
    G.wire([140, TY], [230, TY]); G.node(230, TY);
    G.wire([230, TY], [230, 133]); G.diode('diode', 230, 155, o, typ, 'r', G.val('diode'));
    G.wire([230, 177], [230, BY]); G.node(230, BY);
    const load = G.has('rlast');
    if (load) { G.wire([230, TY], [330, TY], [330, 133]); G.res('rlast', 330, 155, 'v', 'r'); G.wire([330, 177], [330, BY], [230, BY]); G.node(330, BY); G.node(330, TY); }
    G.wire([50, 169], [50, BY], [230, BY]);
    G.gnd(140, BY); G.node(140, BY);
    G.t(G.L('uq') || (G.has('uq') ? G.lab('uq') : ''), 60, 205, { align: 'left', color: G.P.u, bold: true });
    G.ia(G.L('id'), 185, TY, 'r', 192, 42, 'left');
    if (G.L('ur')) { G.ua(G.L('ur'), 100, 78, 140, 78, 120, 94, 'center'); }
    G.ua(G.L('ud'), 200, 133, 200, 177, 194, 155, 'right');
    if (load && G.L('il')) G.ia(G.L('il'), 330, 100, 'd', 344, 100, 'left');
  };
  SCH.schalter = (G, d) => {
    const last = d.last === 'relais' || d.last === 'ohm' ? d.last : 'led', fr = d.freilauf !== false, TY = 40, BY = 262;
    G.src('ub', 40, 150, false);
    G.wire([40, 136], [40, TY], [248, TY]); G.wire([40, 164], [40, BY], [350, BY]);
    G.t(G.L('ub') || (G.has('ub') ? G.lab('ub') : ''), 52, 100, { align: 'left', color: G.P.u, bold: true });
    G.src('ust', 110, 232, false); G.wire([110, 246], [110, BY]); G.wire([110, 218], [110, 170]);
    G.t(G.L('ust') || (G.has('ust') ? G.lab('ust') : ''), 134, 244, { align: 'left', color: G.P.u, bold: true });
    G.wire([110, 170], [148, 170]); G.res('rb', 170, 170, 'h', 'b'); G.wire([192, 170], [218, 170]);
    G.ia(G.L('ib'), 130, 170, 'r', 122, 152, 'left');
    const tr = G.npn(240, 170, 'q');
    G.node(248, TY);
    if (last === 'led') {
      G.wire([248, TY], [248, 42]); G.res('rv', 248, 64, 'v', 'l'); G.wire([248, 86], [248, 90]); G.diode('led', 248, 112, 90, 'led', 'l', G.has('uf') ? G.lab('uf') : '');
      G.wire([248, 134], [248, tr.c[1]]);
    } else if (last === 'relais') {
      G.wire([248, TY], [248, 72]); G.relay('rspule', 248, 94, 'v', 'l'); G.wire([248, 116], [248, tr.c[1]]);
      if (G.has('lspule')) G.t(G.lab('lspule'), 232, 112, { align: 'right' });
      if (fr) { G.wire([248, TY], [350, TY], [350, 72]); G.diode('freilauf', 350, 94, 270, 'si', 'l', 'Freilauf'); G.wire([350, 116], [350, tr.c[1]], [248, tr.c[1]]); G.node(350, tr.c[1]); }
    } else {
      G.wire([248, TY], [248, 72]); G.res('rlast', 248, 94, 'v', 'l'); G.wire([248, 116], [248, tr.c[1]]);
    }
    G.node(248, tr.c[1] > 0 ? tr.c[1] : 148);
    G.wire(tr.e, [248, BY]); G.node(248, BY); G.gnd(195, BY); G.node(195, BY); G.node(110, BY);
    G.ia(G.L('ic'), 266, 118, 'd', 276, 118, 'left');
    G.ua(G.L('uce'), 292, tr.c[1], 292, tr.e[1], 300, 170, 'left');
    G.ua(G.L('ube'), 210, 170, 210, BY, 204, 214, 'right');
  };
  /* Transistorstufe: mode emitter | kollektor | basis */
  function stage(G, d, mode) {
    const TY = 30, BY = 280, tr = G.npn(270, 140, 'q'), cx = tr.c[0];
    G.ring(400, TY); G.t(G.L('ub') || (G.has('ub') ? G.lab('ub') : ''), 392, 12, { align: 'right', color: G.P.u, bold: true });
    G.wire([400, TY], [150, TY]); G.wire([mode === 'basis' ? 150 : 30, BY], [400, BY]); G.gnd(130, BY); G.wire([130, BY], [150, BY]); G.node(150, BY);
    /* Basisteiler */
    G.wire([150, TY], [150, 63]); G.res('r1', 150, 85, 'v', 'l'); G.wire([150, 107], [150, 188]); G.res('r2', 150, 210, 'v', 'l'); G.wire([150, 232], [150, BY]);
    G.node(150, 140); G.node(150, TY);
    G.wire([150, 140], [tr.b[0], 140]);
    if (mode === 'basis') { G.node(185, 140); G.wire([185, 140], [185, 183]); G.cap('cb', 185, 205, 'v', 'r'); G.wire([185, 227], [185, BY]); G.node(185, BY); }
    /* Eingang */
    if (mode !== 'basis') {
      G.src('ue', 30, 215, true); G.wire([30, 201], [30, 140], [38, 140]); G.wire([30, 229], [30, BY]); G.node(30, BY);
      G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 44, 252, { align: 'left', color: G.P.u, bold: true });
      G.res('rg', 60, 140, 'h', 'b'); G.wire([82, 140], [90, 140]); G.cap('c1', 112, 140, 'h', 'a'); G.wire([134, 140], [150, 140]);
      G.ia(G.L('ib'), 200, 140, 'r', 200, 122, 'center');
    } else {
      G.ia(G.L('ib'), 215, 140, 'r', 222, 122, 'center');
    }
    /* Kollektor */
    if (mode === 'kollektor') { G.wire([cx, TY], [cx, tr.c[1]]); G.node(cx, TY); } else {
      G.wire([cx, TY], [cx, 48]); G.res('rc', cx, 70, 'v', 'r'); G.wire([cx, 92], [cx, tr.c[1]]); G.node(cx, TY);
      G.ia(G.L('ic'), 262, 70, 'd', 256, 70, 'right');
    }
    /* Emitter und Ausgang */
    if (mode === 'kollektor') {
      G.wire(tr.e, [cx, 168]); G.node(cx, 164 + 4);
      G.res('re1', cx, 190, 'v', 'l'); G.wire([cx, 212], [cx, 218]); G.res('re2', cx, 240, 'v', 'l'); G.wire([cx, 262], [cx, BY]); G.node(cx, BY);
      G.wire([cx, 168], [318, 168]); G.cap('c2', 340, 168, 'h', 'b'); G.wire([362, 168], [400, 168]); G.ring(400, 168);
      G.t(G.L('ua') || (G.has('ua') ? G.lab('ua') : ''), 408, 150, { align: 'right', color: G.P.out, bold: true });
      if (G.has('rl')) { G.wire([400, 168], [400, 200]); G.res('rl', 400, 222, 'v', 'l'); G.wire([400, 244], [400, BY]); G.node(400, BY); }
    } else if (mode === 'emitter') {
      G.wire(tr.e, [cx, 166]); G.res('re1', cx, 188, 'v', 'l'); G.wire([cx, 210], [cx, 222]); G.node(cx, 222);
      G.wire([cx, 222], [250, 222], [250, 229]); G.res('re2', 250, 251, 'v', 'l'); G.wire([250, 273], [250, BY]); G.node(250, BY);
      if (!G.hide('ce') && d.ce !== false) { G.wire([cx, 222], [306, 222], [306, 229]); G.cap('ce', 306, 251, 'v', 'r'); G.wire([306, 273], [306, BY]); G.node(306, BY); };
      G.node(cx, 105); G.wire([cx, 105], [318, 105]); G.cap('c2', 340, 105, 'h', 'b'); G.wire([362, 105], [400, 105]); G.ring(400, 105);
      G.t(G.L('ua') || (G.has('ua') ? G.lab('ua') : ''), 408, 88, { align: 'right', color: G.P.out, bold: true });
      if (G.has('rl')) { G.wire([400, 105], [400, 163]); G.res('rl', 400, 185, 'v', 'l'); G.wire([400, 207], [400, BY]); G.node(400, BY); }
      G.ua(G.L('uce'), 310, tr.c[1], 310, tr.e[1], 318, 152, 'left');
    } else {
      G.wire(tr.e, [cx, 166]); G.res('re1', cx, 188, 'v', 'l'); G.wire([cx, 210], [cx, 214]); G.node(cx, 214); G.res('re2', cx, 240, 'v', 'l'); G.wire([cx, 262], [cx, BY]); G.node(cx, BY);
      G.wire([cx, 214], [300, 214]); G.cap('c1', 322, 214, 'h', 'a'); G.wire([344, 214], [372, 214]); G.ring(372, 214);
      G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 366, 238, { align: 'right', color: G.P.u, bold: true });
      G.node(cx, 105); G.wire([cx, 105], [318, 105]); G.cap('c2', 340, 105, 'h', 'b'); G.wire([362, 105], [400, 105]); G.ring(400, 105);
      G.t(G.L('ua') || (G.has('ua') ? G.lab('ua') : ''), 408, 88, { align: 'right', color: G.P.out, bold: true });
      if (G.has('rl')) { G.wire([400, 105], [400, 133]); G.res('rl', 400, 155, 'v', 'l'); G.wire([400, 177], [400, BY]); G.node(400, BY); }
    }
  }
  SCH.emitter = (G, d) => stage(G, d, 'emitter');
  SCH.kollektor = (G, d) => stage(G, d, 'kollektor');
  SCH.basis = (G, d) => stage(G, d, 'basis');
  /* Referenz aus Z-Diode am Basisanschluss: zfolger und konstantstrom */
  function zref(G, tr) {
    const TY = 30, BY = 280;
    G.ring(400, TY); G.t(G.L('ub') || (G.has('ub') ? G.lab('ub') : ''), 392, 12, { align: 'right', color: G.P.u, bold: true });
    G.wire([400, TY], [150, TY]); G.wire([150, BY], [400, BY]); G.node(150, TY); G.gnd(215, BY); G.node(215, BY);
    G.wire([150, TY], [150, 63]); G.res('rv', 150, 85, 'v', 'l'); G.wire([150, 107], [150, 188]);
    G.node(150, 140); G.wire([150, 140], [tr.b[0], 140]);
    G.diode('z', 150, 210, 270, 'z', 'r', G.has('uz') ? G.lab('uz') : 'Z-Diode'); G.wire([150, 232], [150, BY]); G.node(150, BY);
    G.ia(G.L('ib'), 200, 140, 'r', 200, 122, 'center');
  }
  SCH.zfolger = (G) => {
    const tr = G.npn(270, 140, 'q'), cx = tr.c[0], BY = 280;
    zref(G, tr);
    G.wire([cx, 30], [cx, tr.c[1]]); G.node(cx, 30);
    G.wire(tr.e, [cx, 175]); G.node(cx, 175); G.wire([cx, 175], [370, 175]); G.ring(370, 175);
    G.t(G.L('ua') || (G.has('ua') ? G.lab('ua') : ''), 378, 157, { align: 'right', color: G.P.out, bold: true });
    G.wire([370, 175], [370, 208]); G.res('rl', 370, 230, 'v', 'l'); G.wire([370, 252], [370, BY]); G.node(370, BY);
    G.ua(G.L('ube'), 296, 140, 296, 175, 304, 160, 'left');
  };
  SCH.konstantstrom = (G) => {
    const tr = G.npn(270, 140, 'q'), cx = tr.c[0], BY = 280;
    zref(G, tr);
    G.wire([cx, 30], [cx, 48]); G.res('rl', cx, 70, 'v', 'r'); G.wire([cx, 92], [cx, tr.c[1]]); G.node(cx, 30);
    G.wire(tr.e, [cx, 168]); G.res('re', cx, 190, 'v', 'l'); G.wire([cx, 212], [cx, BY]); G.node(cx, BY);
    G.ia(G.L('ic'), 262, 70, 'd', 256, 70, 'right');
    G.ua(G.L('ure'), 318, 168, 318, 260, 326, 215, 'left');
  };
  /* Operationsverstaerker-Rahmen: Versorgung, Ausgang mit Klemme und Last; liefert Anschluesse */
  function opFrame(G, d, flip) {
    const op = G.opamp(240, 150, flip, 'op'), out = op.out;
    G.wire(op.out, [420, 150]); G.node(306, 150); G.ring(420, 150);
    G.t(G.L('ua') || (G.has('ua') ? G.lab('ua') : ''), 428, 132, { align: 'right', color: G.P.out, bold: true });
    if (G.has('rl')) { G.node(350, 150); G.wire([350, 150], [350, 193]); G.res('rl', 350, 215, 'v', 'r'); G.wire([350, 237], [350, 252]); G.gnd(350, 252); }
    const upText = G.L('uv') || (G.has('uv') ? G.lab('uv') : ''), unText = G.L('uvn') || (G.has('uvn') ? G.lab('uvn') : '');
    if (upText) G.t(upText, 248, 108, { align: 'left', color: G.isF('uv') ? G.P.err : G.P.fg });
    if (unText) G.t(unText, 248, 192, { align: 'left', color: G.isF('uvn') ? G.P.err : G.P.fg });
    return { op, out };
  }
  /* Parallele Rueckkopplungselemente: Liste von { t:'res'|'cap', id } zwischen Ausgangsknoten (x=306) und Knoten x=150 */
  function feedback(G, ys, elems, toY) {
    const top = Math.min.apply(null, ys.slice(0, elems.length));
    G.wire([306, 150], [306, top]); G.wire([150, toY], [150, top]);
    ys.slice(0, elems.length).forEach((y, i) => {
      const e = elems[i];
      G.wire([306, y], [257, y]); (e.t === 'cap' ? G.cap : G.res)(e.id, 235, y, 'h', 'a'); G.wire([213, y], [150, y]);
      if (y !== top) { G.node(306, y); G.node(150, y); }
    });
  }
  /* invertierende Grundstruktur: Eingangskette (Elemente in Reihe) am - Eingang, Rueckkopplung parallel */
  function opvInv(G, d, inEl, fbEl) {
    const { op } = opFrame(G, d, false), inm = op.inm, inp = op.inp;
    G.src('ue', 30, 215, true); G.wire([30, 201], [30, inm[1]]); G.wire([30, 229], [30, 262]); G.gnd(30, 262);
    G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 44, 252, { align: 'left', color: G.P.u, bold: true });
    if (inEl.length === 1) { G.wire([30, inm[1]], [58, inm[1]]); (inEl[0].t === 'cap' ? G.cap : G.res)(inEl[0].id, 80, inm[1], 'h', 'a'); G.wire([102, inm[1]], [150, inm[1]]); } else {
      G.wire([30, inm[1]], [40, inm[1]]); G.cap(inEl[0].id, 62, inm[1], 'h', 'a'); G.wire([84, inm[1]], [96, inm[1]]); G.res(inEl[1].id, 118, inm[1], 'h', 'b'); G.wire([140, inm[1]], [150, inm[1]]);
    }
    G.wire([150, inm[1]], inm); G.node(150, inm[1]);
    G.wire(inp, [165, inp[1]], [165, 180]); G.gnd(165, 180);
    const two = fbEl.length > 1; feedback(G, two ? [95, 50] : [70], fbEl, inm[1]);
    G.ia(G.L('i1'), 30, 170, 'u', 40, 170, 'left');
    G.ia(G.L('if'), 290, two ? 95 : 70, 'l', 290, (two ? 95 : 70) + 18, 'center');
  }
  SCH.opv_inv = (G, d) => opvInv(G, d, [{ t: 'res', id: 'r1' }], [{ t: 'res', id: 'rf' }]);
  SCH.integrierer = (G, d) => opvInv(G, d, [{ t: 'res', id: 'r' }], G.has('rp') ? [{ t: 'cap', id: 'c' }, { t: 'res', id: 'rp' }] : [{ t: 'cap', id: 'c' }]);
  SCH.differenzierer = (G, d) => opvInv(G, d, [{ t: 'cap', id: 'c' }], [{ t: 'res', id: 'rf' }]);
  SCH.tp = (G, d) => opvInv(G, d, [{ t: 'res', id: 'r1' }], [{ t: 'res', id: 'rf' }, { t: 'cap', id: 'c' }]);
  SCH.hp = (G, d) => opvInv(G, d, [{ t: 'cap', id: 'c' }, { t: 'res', id: 'r1' }], [{ t: 'res', id: 'rf' }]);
  /* nichtinvertierend und Folger: + oben, - unten */
  function opvNin(G, d, folger) {
    const { op } = opFrame(G, d, true), inm = op.inm, inp = op.inp;
    G.src('ue', 30, 215, true); G.wire([30, 201], [30, inp[1]], inp); G.wire([30, 229], [30, 262]); G.gnd(30, 262);
    G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 44, 252, { align: 'left', color: G.P.u, bold: true });
    if (folger) {
      G.wire([306, 150], [306, 205], [170, 205], [170, inm[1]], inm); G.node(306, 150);
    } else {
      G.wire(inm, [165, inm[1]]); G.node(165, inm[1]);
      G.wire([306, 150], [306, 235], [257, 235]); G.res('rf', 235, 235, 'h', 'b'); G.wire([213, 235], [165, 235], [165, inm[1]]);
      G.wire([165, inm[1]], [130, inm[1]]); G.res('rg', 108, inm[1], 'h', 'b'); G.wire([86, inm[1]], [75, inm[1]], [75, 192]); G.gnd(75, 192);
      G.ia(G.L('if'), 290, 235, 'l', 290, 217, 'center');
    }
  }
  SCH.opv_nin = (G, d) => opvNin(G, d, false);
  SCH.opv_folger = (G, d) => opvNin(G, d, true);
  SCH.summierer = (G, d) => {
    const { op } = opFrame(G, d, false), inm = op.inm, inp = op.inp, rows = [85, 135, 185], ids = [['r1', 'u1'], ['r2', 'u2'], ['r3', 'u3']];
    ids.forEach((p, i) => {
      const y = rows[i];
      G.ring(22, y); G.t(G.L(p[1]) || (G.has(p[1]) ? G.lab(p[1]) : ''), 12, y - 16, { align: 'left', color: G.P.u, bold: true });
      G.wire([26, y], [56, y]); G.res(p[0], 78, y, 'h', 'b'); G.wire([100, y], [150, y]);
    });
    G.wire([150, 50], [150, 185]); G.node(150, 135); G.wire([150, 135], inm);
    G.wire([306, 150], [306, 50], [257, 50]); G.res('rf', 235, 50, 'h', 'a'); G.wire([213, 50], [150, 50]);
    G.wire(inp, [175, inp[1]], [175, 215]); G.gnd(175, 215);
    G.node(150, 85); G.node(150, 185);
  };
  SCH.differenz = (G, d) => {
    const { op } = opFrame(G, d, false), inm = op.inm, inp = op.inp;
    G.ring(22, inm[1]); G.t(G.L('u1') || (G.has('u1') ? G.lab('u1') : ''), 12, inm[1] - 16, { align: 'left', color: G.P.u, bold: true });
    G.wire([26, inm[1]], [56, inm[1]]); G.res('r1', 78, inm[1], 'h', 'b'); G.wire([100, inm[1]], inm); G.node(150, inm[1]);
    G.wire([306, 150], [306, 70], [257, 70]); G.res('r3', 235, 70, 'h', 'a'); G.wire([213, 70], [150, 70], [150, inm[1]]);
    G.ring(22, 195); G.t(G.L('u2') || (G.has('u2') ? G.lab('u2') : ''), 12, 179, { align: 'left', color: G.P.u, bold: true });
    G.wire([26, 195], [56, 195]); G.res('r2', 78, 195, 'h', 'b'); G.wire([100, 195], [150, 195]); G.node(150, 195);
    G.wire([150, 195], [150, inp[1]], inp);
    G.wire([150, 195], [150, 218]); G.res('r4', 150, 240, 'v', 'l'); G.wire([150, 262], [150, 275]); G.gnd(150, 275);
  };
  SCH.schmitt = (G, d) => {
    const inv = d.art !== 'nin', { op } = opFrame(G, d, false), inm = op.inm, inp = op.inp;
    const ref = (x, y) => { if (G.L('uref')) { G.wire([x, y], [x, y + 12]); G.ring(x, y + 16); G.t(G.L('uref'), x + 10, y + 16, { align: 'left', color: G.P.u, bold: true }); } else G.gnd(x, y); };
    if (inv) {
      G.src('ue', 30, 215, true); G.wire([30, 201], [30, inm[1]], inm); G.wire([30, 229], [30, 262]); G.gnd(30, 262);
      G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 44, 252, { align: 'left', color: G.P.u, bold: true });
      G.node(160, inp[1]); G.wire(inp, [160, inp[1]]);
      G.wire([306, 150], [306, 70], [257, 70]); G.res('r2', 235, 70, 'h', 'a'); G.wire([213, 70], [160, 70], [160, inp[1]]);
      G.wire([160, inp[1]], [160, 188]); G.res('r3', 160, 210, 'v', 'l'); G.wire([160, 232], [160, 244]); ref(160, 244);
    } else {
      G.src('ue', 30, 215, true); G.wire([30, 201], [30, inp[1]], [56, inp[1]]); G.res('r1', 78, inp[1], 'h', 'a'); G.wire([100, inp[1]], inp); G.node(150, inp[1]);
      G.wire([30, 229], [30, 262]); G.gnd(30, 262);
      G.t(G.L('ue') || (G.has('ue') ? G.lab('ue') : ''), 44, 252, { align: 'left', color: G.P.u, bold: true });
      G.wire([306, 150], [306, 235], [257, 235]); G.res('r2', 235, 235, 'h', 'b'); G.wire([213, 235], [150, 235], [150, inp[1]]);
      G.wire(inm, [170, inm[1]], [170, 100]); ref(170, 100);
    }
  };
  SCH.osc = (G, d) => {
    const { op } = opFrame(G, d, true), inm = op.inm, inp = op.inp;
    /* + oben: Mitkopplung R_2 ueber den Ausgang, R_3 gegen Masse; - unten: R und C */
    G.wire(inp, [160, inp[1]]); G.node(160, inp[1]);
    G.wire([306, 150], [306, 70], [257, 70]); G.res('r2', 235, 70, 'h', 'a'); G.wire([213, 70], [160, 70], [160, inp[1]]);
    G.wire([160, inp[1]], [120, inp[1]]); G.res('r3', 98, inp[1], 'h', 'a'); G.wire([76, inp[1]], [60, inp[1]], [60, 158]); G.gnd(60, 158);
    G.wire(inm, [178, inm[1]]); G.node(178, inm[1]);
    G.wire([306, 150], [306, 235], [263, 235]); G.res('r', 241, 235, 'h', 'b'); G.wire([219, 235], [178, 235], [178, inm[1]]); G.node(306, 150);
    G.wire([178, inm[1]], [130, inm[1]], [130, 200]); G.cap('c', 130, 222, 'v', 'l'); G.wire([130, 244], [130, 262]); G.gnd(130, 262);
    G.node(130, inm[1]);
  };

  function schematic(ctx, rect, data, opts) {
    const d = obj(data), E = env(ctx, rect, opts, 140, 110), fn = SCH[d.kind];
    if (!E || typeof fn !== 'function' || SCHEMATIC_KINDS.indexOf(d.kind) < 0) return false;
    return draw(ctx, () => {
      bgFill(ctx, E);
      const G = makeG(ctx, E, rect, d);
      fn(G, d);
      if (G.faults.length) {
        const ft = str(d.faultText);
        G.t('✗ ' + (ft || 'Fehlerstelle (rot)'), 4, 292, { align: 'left', color: E.P.err, bold: true });
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Programmierschnittstelle */
  /* Jede Zeichenfunktion faengt Ausnahmen ab (Rueckgabe false) */
  function safe(fn) { return function () { try { return fn.apply(null, arguments) === true; } catch (e) { return false; } }; }
  const DRAWERS = { schematic, curve, family, scope, hyst, bode, bar, meter, chainBar, ampel };
  const FNS = Object.keys(DRAWERS);
  const API = {
    version: '1.0', fns: FNS, BLINK_MAX_HZ, PAL, KINDS, SCH_NAMES, SCHEMATIC_KINDS: SCHEMATIC_KINDS.slice(), SICHTEN: SICHTEN.map(s => s.id),
    palette, contrast, cssColors, reducedMotion, pulse, fz, fe, fv, fd, niceTicks, ampelInfo, ariaText, kindOf
  };
  FNS.forEach(k => { API[k] = safe(DRAWERS[k]); });
  root.ANA_DRAW = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
