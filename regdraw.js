/* regdraw.js - Regelungstechnik-Lab Zeichenhelfer (REG_DRAW, Version 1.0)
 * Zeichen-Primitiven fuer die Pruefstaende (Rohr, Ventil, Pumpe, Tank, Heizkoerper, Thermometer, Zeigerinstrument,
 * Bimetall, Zahnrad-Motor, Schlitten, Funke, Pfeil, Beschriftung), den Wirkungsplan und den Messschreiber.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval, offline. Browser: window.REG_DRAW, Node: module.exports / globalThis.REG_DRAW.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Jede Funktion hat die Form f(ctx, ...). ctx ist ein Canvas-2D-Kontext (im Test ein Mock). Die Funktionen sind
 *    zustandsfrei: gleiche Argumente ergeben gleiche Aufrufe. Animation kommt nur ueber Parameter (rot, phase, wave, t, angle).
 *  - Alle Optionen sind optional. Ungueltige Optionen (kein endlicher Zahlenwert) fallen auf den Vorgabewert zurueck,
 *    Zahlen werden auf ihren Bereich geklemmt. Zahlen als Text gelten NICHT als Zahl.
 *  - Rueckgabe: true = gezeichnet, false = nichts gezeichnet (dann gab es auch KEINEN Aufruf am ctx: kein save, kein path).
 *    false kommt bei: fehlendem/unbrauchbarem ctx, nicht endlichen Pflichtkoordinaten, Groesse 0 oder zu klein.
 *    traceChart liefert statt true ein Layout-Objekt (siehe dort), wirkungsplan true/false.
 *  - Koordinaten in CSS-Pixeln des uebergebenen Kontexts. Der Aufrufer setzt Transform und Loeschen (devicePixelRatio).
 *  - Zahlen in Beschriftungen: Dezimalkomma (fz), Minus als echtes Minuszeichen, nicht endliche Werte als Gedankenstrich.
 *  - Farben: opts.colors = 'light' | 'dark' | Objekt mit einzelnen Farben (Schluessel siehe PAL_DARK, optional theme:'light').
 *    REG_DRAW.cssColors(element) liest die CSS-Variablen der Seite (--bg --panel --panel2 --fg --mute --line --accent --danger --ok --warn).
 *    Ohne Angabe gilt die dunkle Standardpalette (wie antlab.html).
 *
 * ===================================================================================================
 * FUNKTIONEN (Einheiten, Ursprung)
 *  pipe(ctx, pts, {flow, phase, width, color})      pts = [[x,y],...] oder [{x,y},...] (mind. 2 Punkte). flow -1..1: Betrag =
 *                                                     Dichte der Stroemungspunkte, Vorzeichen = Richtung (negativ gegen pts-Reihenfolge),
 *                                                     0 = Rohr leer/ruhend. phase in px: waechst der Wert, wandern die Punkte entlang pts.
 *  valve(ctx, x, y, {open, size, kind})             (x,y) Mitte des Ventilkoerpers. open 0..1 (Hub, 1 = voll auf; NICHT Prozent).
 *                                                     size = Breite des Koerpers in px (Vorgabe 48). kind 'regel' (Membranantrieb, Hubanzeige),
 *                                                     'hand' (Handrad, dreht mit open), 'thermo' (Thermostatkopf). Unbekannt = 'regel'.
 *  pump(ctx, x, y, {rot, size})                     (x,y) Mitte, size = Durchmesser (Vorgabe 56), rot = Laufradwinkel in rad.
 *  tank(ctx, x, y, w, h, {level, wave, overflow, setpoint, ticks})   (x,y) links oben. level 0..1 (Fuellstand/Hoehe). wave = Phase
 *                                                     der Oberflaechenwelle in rad (nicht endlich = glatt). overflow true = es laeuft ueber.
 *                                                     setpoint 0..1 = gestrichelte Sollmarke. ticks false = keine Teilstriche.
 *  radiator(ctx, x, y, w, h, {power})               (x,y) links oben. power 0..1 (Anteil der Maximalleistung), Farbe und Konvektionspfeile.
 *  thermometer(ctx, x, y, h, {value, lo, hi, setpoint, unit, digits})   (x,y) = Mitte oben der Roehre (Roehre h hoch), Kugel darunter.
 *                                                     value/lo/hi/setpoint in physikalischen Einheiten, hi > lo noetig.
 *  gauge(ctx, x, y, r, {value, lo, hi, setpoint, warnFrom, unit, digits})   (x,y) Mitte, r Radius, 270-Grad-Skala. hi > lo noetig.
 *  bimetal(ctx, x, y, w, {bend, contactOpen})       (x,y) Einspannstelle, w Laenge nach rechts. bend -1..1 (positiv = Spitze nach oben).
 *                                                     Der Kontakt ist immer stimmig gezeichnet: geschlossen = Streifen liegt am Gegenkontakt an,
 *                                                     offen = sichtbarer Spalt (Streifen biegt hoechstens bis zum Spalt).
 *  motor(ctx, x, y, {angle, size})                  (x,y) = Zahnradmitte (Wellenende), Gehaeuse links davon, size = Gehaeusehoehe (Vorgabe 60).
 *  slide(ctx, x, y, w, {pos, target, rot})          (x,y) linkes Ende der Spindel (Mitte), w Laenge, pos/target 0..1, rot = Spindelphase in px.
 *  spark(ctx, x, y, {t, size})                      Funke, t = Zeit in s (bestimmt die Form deterministisch, flackert mit t).
 *  arrow(ctx, x0, y0, x1, y1, {head, width, color, dash})   Laenge 0 zeichnet nichts.
 *  label(ctx, text, x, y, {align, size, bold, color, bg, maxw})   text String oder Zahl, align 'left'|'center'|'right', Grundlinie mittig.
 *  icon(ctx, kind, x, y, w, h, {color})             Symbolskizze (Sprungantwort-Schema) in der Box (x,y,w,h links oben).
 *                                                     kind: p i pi pd pid 2p 3p pt1 pt2 pt3 pt1tt pt2tt it1 pt2d. Unbekannt = false.
 *  wirkungsplan(ctx, w, h, data)                    Flaeche (0,0,w,h), mindestens 280 x 160, sonst false. data siehe unten.
 *  traceChart(ctx, rect, tr, opts)                  Messschreiber in rect = {x,y,w,h} (mindestens 200 x 120), tr = Ergebnis von rig.trace().
 *  Hilfen: fz(v, digits), ticks(lo, hi, n), palette(colorsOpt), cssColors(el), mix(c1, c2, t), fns (Namensliste), version.
 *
 * ===================================================================================================
 * WIRKUNGSPLAN (data)
 *  { roles:{w,x,y,z,stell,mess}   Texte aus rig.roles (nur Strings werden verwendet)
 *    values:{w,e,y,z,x,xm}        Livewerte (Zahl, sonst Gedankenstrich); w,x,e,xm in Anzeigeeinheit, y in %, z in Anlageneinheit
 *    units:{w,x,e,y,z,xm}         Einheiten (Vorgabe: w,e,xm folgen units.x; y = '%')
 *    digits:{w,x,e,y,z,xm}        Nachkommastellen (Vorgabe automatisch nach Betrag)
 *    ctrl:'P'|'I'|'PI'|'PD'|'PID'|'2P'|'3P', dir:'direkt'|'invers', mode:'auto'|'hand'
 *    plant:'Text', plantKind:'p'|'pt1'|'pt2'|... (Symbol)   colors, fill:true (Hintergrund fuellen) }
 *  Vorzeichen an der Vergleichsstelle folgen e = dir*(w - x): direkt  w +, xm -;  invers  w -, xm +.
 *  Ring: Vergleichsstelle -> Regler -> Stellglied -> (+z) -> Regelstrecke -> x -> Messglied -> zurueck zur Vergleichsstelle.
 *
 * MESSSCHREIBER (opts)
 *  tr = { t:[], w:[], x:[], y:[], z:[], e:[] }  t in Prozess-Sekunden, x/w physikalisch, y in %, z in Anlageneinheit.
 *  opts: tUnit 's'|'min'|'h' (Achse), t0,t1 (Fenster in Prozess-s, Vorgabe alles), xRange [lo,hi] (Achse von x/w; Vorgabe automatisch),
 *        xUnit, zUnit, digits, names {x,w,y,z}, bands [{lo,hi,color,label}] (Toleranzbaender in x-Einheit), marks [{t,label,color}],
 *        ref {t,x} (Vergleichskurve, blass), cursorT (Fadenkreuz, Prozess-s), zRange [lo,hi], colors.
 *  Rueckgabe: { plot:{x,y,w,h}, upper:{x,y,w,h,lo,hi}, lower:{x,y,w,h}|null, t0, t1, unit, k, timeAt(px)->Prozess-s, pxAt(t)->px }.
 *  Die Achse heisst immer "Prozesszeit in <Einheit>" (kein Echtzeit-Anspruch).
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Palette */
  const PAL_DARK = {
    theme: 'dark', bg: '#14181c', panel: '#222830', panel2: '#2c343e', fg: '#e8ecf0', mute: '#8d99a6', line: '#38424d', grid: '#26303a',
    accent: '#3b9eff', danger: '#ff5c5c', ok: '#4cd964', warn: '#ffb340', water: '#3b9eff', hot: '#ff7a45', cold: '#5ac8fa',
    metal: '#8d99a6', metalDark: '#5b6672',
    sig: { w: '#3b9eff', x: '#4cd964', y: '#ffb340', z: '#ff5c5c', e: '#c792ea', xm: '#8d99a6' }
  };
  const PAL_LIGHT = {
    theme: 'light', bg: '#f4f6f8', panel: '#ffffff', panel2: '#e9edf1', fg: '#1c232b', mute: '#5b6672', line: '#c4ccd4', grid: '#dde3e8',
    accent: '#0a6fd6', danger: '#d0312d', ok: '#1f9d3a', warn: '#c77700', water: '#2a86d8', hot: '#e0531f', cold: '#2f9ccf',
    metal: '#7a8794', metalDark: '#4a5663',
    sig: { w: '#0a6fd6', x: '#1f9d3a', y: '#c77700', z: '#d0312d', e: '#8e44ad', xm: '#5b6672' }
  };
  const SIG_KEYS = ['w', 'x', 'y', 'z', 'e', 'xm'];

  /* endlich und vernuenftig gross (Betrag < 1e7): schuetzt vor Endlosschleifen und Ueberlauf bei Unsinnswerten */
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e7;
  /* Winkel/Phasen: jede endliche Zahl (nur in sin/cos/Modulo benutzt, keine Schleife) */
  const afin = v => typeof v === 'number' && isFinite(v);
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  /* Zahl aus Option o[k]: nur endliche Zahlen, geklemmt auf [lo,hi], sonst Vorgabe */
  function nz(o, k, def, lo, hi) {
    const v = o[k];
    if (!fin(v)) return def;
    return cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  }
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 64 && !/NaN|undefined|null/i.test(v);

  function palette(c) {
    let base = PAL_DARK;
    if (c === 'light' || (c && typeof c === 'object' && c.theme === 'light')) base = PAL_LIGHT;
    const out = Object.assign({}, base, { sig: Object.assign({}, base.sig) });
    if (c && typeof c === 'object') {
      Object.keys(base).forEach(k => { if (k !== 'sig' && k !== 'theme' && goodColor(c[k])) out[k] = c[k]; });
      if (c.sig && typeof c.sig === 'object') SIG_KEYS.forEach(k => { if (goodColor(c.sig[k])) out.sig[k] = c.sig[k]; });
    }
    return out;
  }
  const pal = o => palette(o && o.colors);

  function parseHex(c) {
    if (typeof c !== 'string') return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c.trim());
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    m = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(c.trim());
    if (m) return [cl(+m[1], 0, 255), cl(+m[2], 0, 255), cl(+m[3], 0, 255)];
    return null;
  }
  /* Farbmischung a -> b (t 0..1). Nicht lesbare Farben: Ergebnis ist b. */
  function mix(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    if (!B) return typeof b === 'string' ? b : '#888888';
    if (!A || !fin(t)) return b;
    t = cl(t, 0, 1);
    const h = i => ('0' + Math.round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2);
    return '#' + h(0) + h(1) + h(2);
  }
  function cssColors(el) {
    if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return {};
    const out = {};
    try {
      const cs = getComputedStyle(el && el.nodeType === 1 ? el : document.documentElement);
      [['bg', '--bg'], ['panel', '--panel'], ['panel2', '--panel2'], ['fg', '--fg'], ['mute', '--mute'], ['line', '--line'],
        ['accent', '--accent'], ['danger', '--danger'], ['ok', '--ok'], ['warn', '--warn']].forEach(p => {
        const v = cs.getPropertyValue(p[1]).trim();
        if (goodColor(v)) out[p[0]] = v;
      });
      const b = parseHex(out.bg);
      if (b && (0.299 * b[0] + 0.587 * b[1] + 0.114 * b[2]) > 150) out.theme = 'light';
    } catch (e) { /* ohne Stile: Standardpalette */ }
    return out;
  }

  /* ------------------------------------------------------------------ Hilfen */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    let s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d);
    s = s.replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
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
  const digitsOfStep = s => (fin(s) && s > 0 ? Math.max(0, Math.min(4, Math.ceil(-Math.log10(s) - 1e-9))) : 0);

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
  function font(ctx, size, bold) { ctx.font = (bold ? '600 ' : '') + (Math.round(size * 10) / 10) + 'px system-ui, sans-serif'; }
  function tw(ctx, t, size, bold) {
    if (typeof ctx.measureText === 'function') { const m = ctx.measureText(t); if (m && fin(m.width)) return m.width; }
    return t.length * size * (bold ? 0.6 : 0.56);
  }
  /* Text kuerzen (mit …), so dass er in maxw passt; Schrift ist vorher zu setzen */
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
  function normPts(pts) {
    if (!Array.isArray(pts) || pts.length < 2 || pts.length > 4000) return null;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; let x, y;
      if (Array.isArray(p)) { x = p[0]; y = p[1]; } else if (p && typeof p === 'object') { x = p.x; y = p.y; } else return null;
      if (!fin(x) || !fin(y)) return null;
      out.push([x, y]);
    }
    return out;
  }
  function polyLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return l; }
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d); if (off !== undefined) ctx.lineDashOffset = off; }
  const NODASH = [];

  /* ------------------------------------------------------------------ Pfeil, Beschriftung */
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
  function labelRaw(ctx, P, text, x, y, align, size, bold, color, bg, maxw) {
    font(ctx, size, bold);
    let t = text;
    if (maxw > 0) t = fitText(ctx, t, maxw, size, bold);
    if (t === '') return false;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (bg) {
      const w = tw(ctx, t, size, bold) + 8, x0 = align === 'left' ? x - 4 : align === 'right' ? x - w + 4 : x - w / 2;
      ctx.fillStyle = bg; rrect(ctx, x0, y - size * 0.75, w, size * 1.5, 4); ctx.fill();
    }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
    return true;
  }
  function label(ctx, text, x, y, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y)) return false;
    let t = typeof text === 'number' ? (fin(text) ? fz(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '') return false;
    o = obj(o); const P = pal(o);
    const align = o.align === 'left' || o.align === 'right' ? o.align : 'center';
    return draw(ctx, () => labelRaw(ctx, P, t, x, y, align, nz(o, 'size', 12, 6, 80), !!o.bold, goodColor(o.color) ? o.color : P.fg,
      goodColor(o.bg) ? o.bg : null, nz(o, 'maxw', 0, 0, 5000)));
  }

  /* ------------------------------------------------------------------ Rohr */
  function pipe(ctx, pts, o) {
    if (!okCtx(ctx)) return false;
    const p = normPts(pts); if (!p || !(polyLen(p) > 0)) return false;
    o = obj(o); const P = pal(o);
    const wd = nz(o, 'width', 14, 2, 80), flow = nz(o, 'flow', 0, -1, 1), ph = afin(o.phase) ? o.phase : 0;
    const fluid = goodColor(o.color) ? o.color : P.water;
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      ctx.strokeStyle = P.line; ctx.lineWidth = wd + 4; poly(ctx, p, false); ctx.stroke();
      ctx.strokeStyle = P.panel2; ctx.lineWidth = wd; poly(ctx, p, false); ctx.stroke();
      ctx.strokeStyle = fluid; ctx.lineWidth = wd * 0.56; ctx.globalAlpha = Math.abs(flow) > 0.01 ? 0.45 : 0.18;
      poly(ctx, p, false); ctx.stroke(); ctx.globalAlpha = 1;
      if (Math.abs(flow) > 0.01) {
        const dot = wd * 0.3, gap = wd * (2.8 - 1.9 * Math.abs(flow)), period = dot + gap;
        const off = -(((ph % period) + period) % period) * (flow < 0 ? -1 : 1);
        ctx.strokeStyle = mix(fluid, '#ffffff', 0.55); ctx.lineWidth = wd * 0.3; ctx.lineCap = 'round';
        setDash(ctx, [0.1, period - 0.1], off); poly(ctx, p, false); ctx.stroke(); setDash(ctx, NODASH, 0);
      }
    });
  }

  /* ------------------------------------------------------------------ Ventil */
  function valve(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const s = nz(o, 'size', 48, 8, 400), open = nz(o, 'open', 0, 0, 1);
    const kind = o.kind === 'hand' || o.kind === 'thermo' ? o.kind : 'regel';
    return draw(ctx, () => {
      const hh = s * 0.32, g = open * s * 0.16;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.04);
      /* Spindel und Antrieb (hinter dem Koerper) */
      const stemTop = y - s * 0.55 - (kind === 'regel' ? 0 : 0);
      ctx.strokeStyle = P.metalDark; ctx.lineWidth = Math.max(2, s * 0.07);
      ctx.beginPath(); ctx.moveTo(x, y - g * 0.5); ctx.lineTo(x, stemTop - open * s * 0.1); ctx.stroke();
      ctx.lineWidth = Math.max(1.5, s * 0.04);
      if (kind === 'regel') {
        ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal;
        ctx.beginPath(); ctx.arc(x, stemTop - s * 0.1, s * 0.3, Math.PI, 2 * Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = P.metal; ctx.fillRect(x - s * 0.34, stemTop - s * 0.1, s * 0.68, s * 0.06);
        /* Hubanzeige */
        const bx = x + s * 0.5, bh = s * 0.5, by = y + hh;
        ctx.strokeStyle = P.line; ctx.strokeRect(bx, by - bh, s * 0.08, bh);
        ctx.fillStyle = P.accent; ctx.fillRect(bx, by - bh * open, s * 0.08, bh * open);
      } else if (kind === 'hand') {
        const wy = stemTop - s * 0.06, a = open * Math.PI * 4;
        ctx.strokeStyle = P.metal; ctx.fillStyle = P.panel2;
        ctx.beginPath(); ctx.arc(x, wy, s * 0.14, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.lineWidth = Math.max(2, s * 0.07); ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const an = a + i * Math.PI / 3 * 2, c = Math.cos(an) * s * 0.4, sn = Math.sin(an) * s * 0.12;
          ctx.beginPath(); ctx.moveTo(x - c * 0.5, wy - sn * 0.5); ctx.lineTo(x + c, wy + sn); ctx.stroke();
        }
      } else {
        const hw = s * 0.34, hx = x - hw / 2, hy = stemTop - s * 0.34;
        ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal; rrect(ctx, hx, hy, hw, s * 0.4, 4); ctx.fill(); ctx.stroke();
        const a0 = 0.75 * Math.PI + open * 1.5 * Math.PI, cx = x, cy = hy + s * 0.2, rr = s * 0.13;
        ctx.strokeStyle = P.mute; ctx.beginPath(); ctx.arc(cx, cy, rr, 0.75 * Math.PI, 2.25 * Math.PI); ctx.stroke();
        ctx.strokeStyle = P.hot; ctx.lineWidth = Math.max(2, s * 0.05);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr); ctx.stroke();
      }
      /* Gehaeuse: zwei Dreiecke, Spitzen laufen mit dem Hub auseinander */
      ctx.lineWidth = Math.max(1.5, s * 0.04); ctx.strokeStyle = P.metal;
      ctx.fillStyle = mix(P.panel2, P.water, 0.18 + 0.5 * open);
      poly(ctx, [[x - s / 2, y - hh], [x - s / 2, y + hh], [x - g / 2, y]], true); ctx.fill(); ctx.stroke();
      poly(ctx, [[x + s / 2, y - hh], [x + s / 2, y + hh], [x + g / 2, y]], true); ctx.fill(); ctx.stroke();
    });
  }

  /* ------------------------------------------------------------------ Pumpe */
  function pump(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const s = nz(o, 'size', 56, 8, 400), rot = afin(o.rot) ? o.rot : 0, r = s / 2;
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.045);
      /* Druckstutzen oben rechts */
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal;
      ctx.fillRect(x + r * 0.45, y - r - s * 0.22, s * 0.3, s * 0.34); ctx.strokeRect(x + r * 0.45, y - r - s * 0.22, s * 0.3, s * 0.34);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      /* Laufrad: sechs gekruemmte Schaufeln */
      ctx.strokeStyle = P.water; ctx.lineWidth = Math.max(2, s * 0.06); ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = rot + i * Math.PI / 3, a2 = a + 0.5;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.12, y + Math.sin(a) * r * 0.12);
        ctx.quadraticCurveTo(x + Math.cos(a + 0.35) * r * 0.55, y + Math.sin(a + 0.35) * r * 0.55, x + Math.cos(a2) * r * 0.78, y + Math.sin(a2) * r * 0.78);
        ctx.stroke();
      }
      ctx.fillStyle = P.metalDark; ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, 2 * Math.PI); ctx.fill();
      /* Marke auf dem Laufrad, damit auch langsame Drehung sichtbar ist */
      ctx.fillStyle = P.warn; ctx.beginPath(); ctx.arc(x + Math.cos(rot) * r * 0.78, y + Math.sin(rot) * r * 0.78, Math.max(1.5, s * 0.04), 0, 2 * Math.PI); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ Tank */
  function tank(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 10 || h < 10) return false;
    o = obj(o); const P = pal(o);
    const level = nz(o, 'level', 0, 0, 1), wave = afin(o.wave) ? o.wave : null, over = !!o.overflow;
    const sp = fin(o.setpoint) ? cl(o.setpoint, 0, 1) : null, showTicks = o.ticks !== false;
    return draw(ctx, () => {
      const wt = Math.max(3, w * 0.035), ix = x + wt, iw = w - 2 * wt, ib = y + h - wt, ih = h - wt;
      ctx.lineJoin = 'round';
      ctx.fillStyle = mix(P.bg, P.panel, 0.7); ctx.fillRect(ix, y, iw, ih);
      if (level > 0.0005) {
        const top = Math.max(y, ib - ih * level), amp = wave === null ? 0 : Math.min(3, ih * 0.02), n = cl(Math.floor(iw / 6), 4, 60);
        ctx.fillStyle = P.water; ctx.globalAlpha = 0.75; ctx.beginPath(); ctx.moveTo(ix, ib);
        for (let i = 0; i <= n; i++) ctx.lineTo(ix + iw * i / n, Math.max(y, top + amp * Math.sin(i * 0.7 + (wave === null ? 0 : wave))));
        ctx.lineTo(ix + iw, ib); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = mix(P.water, '#ffffff', 0.5); ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i <= n; i++) { const yy = Math.max(y, top + amp * Math.sin(i * 0.7 + (wave === null ? 0 : wave))); if (i) ctx.lineTo(ix + iw * i / n, yy); else ctx.moveTo(ix, yy); }
        ctx.stroke();
      }
      if (showTicks && iw > 24) {
        ctx.strokeStyle = P.mute; ctx.lineWidth = 1;
        for (let i = 1; i < 10; i++) { const yy = Math.round(ib - ih * i / 10) + 0.5, l = i === 5 ? 10 : 6; ctx.beginPath(); ctx.moveTo(ix, yy); ctx.lineTo(ix + l, yy); ctx.stroke(); }
      }
      if (sp !== null) {
        const yy = ib - ih * sp;
        ctx.strokeStyle = P.sig.w; ctx.fillStyle = P.sig.w; ctx.lineWidth = 1.5; setDash(ctx, [6, 4]);
        ctx.beginPath(); ctx.moveTo(ix, yy); ctx.lineTo(ix + iw, yy); ctx.stroke(); setDash(ctx, NODASH);
        poly(ctx, [[x + w + 2, yy], [x + w + 10, yy - 5], [x + w + 10, yy + 5]], true); ctx.fill();
      }
      ctx.strokeStyle = P.metal; ctx.lineWidth = wt; ctx.lineCap = 'butt';
      poly(ctx, [[x + wt / 2, y], [x + wt / 2, y + h - wt / 2], [x + w - wt / 2, y + h - wt / 2], [x + w - wt / 2, y]], false); ctx.stroke();
      if (over) {
        const ph = wave === null ? 0 : wave;
        ctx.strokeStyle = P.water; ctx.fillStyle = P.water; ctx.lineWidth = 3; ctx.lineCap = 'round';
        [[x + wt / 2, -1], [x + w - wt / 2, 1]].forEach(s => {
          ctx.beginPath(); ctx.moveTo(s[0], y + 2); ctx.quadraticCurveTo(s[0] + s[1] * 10, y - 6, s[0] + s[1] * 14, y + 14); ctx.stroke();
          for (let i = 0; i < 3; i++) { const dy = ((ph * 7 + i * 11) % 24 + 24) % 24; ctx.beginPath(); ctx.arc(s[0] + s[1] * (14 + i), y + 16 + dy, 2, 0, 2 * Math.PI); ctx.fill(); }
        });
        ctx.fillStyle = P.danger; poly(ctx, [[x + w / 2, y - 18], [x + w / 2 - 8, y - 4], [x + w / 2 + 8, y - 4]], true); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2 - 1, y - 14, 2, 6); ctx.fillRect(x + w / 2 - 1, y - 7, 2, 2);
      }
    });
  }

  /* ------------------------------------------------------------------ Heizkoerper */
  function radiator(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 16 || h < 16) return false;
    o = obj(o); const P = pal(o);
    const pw = nz(o, 'power', 0, 0, 1);
    return draw(ctx, () => {
      const n = cl(Math.floor(w / 13), 3, 30), cw = w / n, col = mix(mix(P.metal, P.cold, 0.2), P.hot, pw);
      ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = P.metalDark; ctx.fillStyle = col;
      for (let i = 0; i < n; i++) { rrect(ctx, x + i * cw + 1.5, y, cw - 3, h, Math.min(6, cw / 2 - 1)); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = P.metalDark; ctx.fillRect(x, y + h * 0.12, w, 3); ctx.fillRect(x, y + h * 0.82, w, 3);
      if (pw > 0.02) {
        ctx.strokeStyle = P.hot; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.25 + 0.6 * pw;
        const len = 8 + pw * 22, m = cl(Math.floor(w / 36), 2, 8);
        for (let i = 0; i < m; i++) {
          const px = x + w * (i + 0.5) / m, y0 = y - 6;
          ctx.beginPath(); ctx.moveTo(px, y0); ctx.quadraticCurveTo(px + 6, y0 - len * 0.5, px, y0 - len * 0.7); ctx.quadraticCurveTo(px - 6, y0 - len * 0.85, px, y0 - len); ctx.stroke();
          poly(ctx, [[px, y0 - len - 5], [px - 4, y0 - len + 1], [px + 4, y0 - len + 1]], true); ctx.fillStyle = P.hot; ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    });
  }

  /* ------------------------------------------------------------------ Thermometer */
  function thermometer(ctx, x, y, h, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y) || !fin(h) || h < 24) return false;
    o = obj(o); const P = pal(o);
    const lo = fin(o.lo) ? o.lo : 0, hi = fin(o.hi) ? o.hi : 100;
    if (!(hi > lo)) return false;
    const val = fin(o.value) ? o.value : null, sp = fin(o.setpoint) ? o.setpoint : null, unit = str(o.unit), dg = fin(o.digits) ? o.digits : undefined;
    const f = v => cl((v - lo) / (hi - lo), 0, 1);
    return draw(ctx, () => {
      const tw0 = 9, br = 10, by = y + h + br - 3, fs = 11;
      ctx.lineJoin = 'round'; ctx.lineWidth = 1.5; ctx.strokeStyle = P.metal; ctx.fillStyle = P.panel2;
      rrect(ctx, x - tw0 / 2, y, tw0, h + 4, tw0 / 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, by, br, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.danger; ctx.beginPath(); ctx.arc(x, by, br - 3, 0, 2 * Math.PI); ctx.fill();
      const fh = val === null ? 0 : (h - 4) * f(val);
      ctx.fillRect(x - 2, y + h - fh, 4, fh + 6);
      ctx.strokeStyle = P.mute; ctx.lineWidth = 1; ctx.fillStyle = P.mute; font(ctx, fs, false); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      [[lo, h], [(lo + hi) / 2, h / 2], [hi, 0]].forEach(p => {
        const yy = Math.round(y + p[1] - (p[1] === h ? 4 : 0)) + 0.5;
        ctx.beginPath(); ctx.moveTo(x + tw0 / 2 + 2, yy); ctx.lineTo(x + tw0 / 2 + 7, yy); ctx.stroke();
        ctx.fillText(fz(p[0], dg), x + tw0 / 2 + 10, yy);
      });
      if (sp !== null) {
        const yy = y + h - 4 - (h - 4) * f(sp);
        ctx.fillStyle = P.sig.w; poly(ctx, [[x - tw0 / 2 - 2, yy], [x - tw0 / 2 - 9, yy - 5], [x - tw0 / 2 - 9, yy + 5]], true); ctx.fill();
      }
      if (val !== null) {
        const yy = y + h - 4 - (h - 4) * f(val);
        font(ctx, fs, true); ctx.textAlign = 'right'; ctx.fillStyle = P.fg;
        ctx.fillText(fz(val, dg) + (unit ? ' ' + unit : ''), x - tw0 / 2 - (sp !== null ? 12 : 4), cl(yy, y + 6, y + h));
      }
    });
  }

  /* ------------------------------------------------------------------ Zeigerinstrument */
  function gauge(ctx, x, y, r, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y) || !fin(r) || r < 12) return false;
    o = obj(o); const P = pal(o);
    const lo = fin(o.lo) ? o.lo : 0, hi = fin(o.hi) ? o.hi : 100;
    if (!(hi > lo)) return false;
    const val = fin(o.value) ? o.value : null, sp = fin(o.setpoint) ? o.setpoint : null, wf = fin(o.warnFrom) ? o.warnFrom : null;
    const unit = str(o.unit), dg = fin(o.digits) ? o.digits : undefined;
    const A0 = 0.75 * Math.PI, SW = 1.5 * Math.PI, f = v => cl((v - lo) / (hi - lo), 0, 1), ang = v => A0 + SW * f(v);
    return draw(ctx, () => {
      const fs = Math.max(9, Math.min(14, r * 0.2));
      ctx.lineJoin = 'round'; ctx.fillStyle = P.panel; ctx.strokeStyle = P.line; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.grid; ctx.lineWidth = Math.max(3, r * 0.12); ctx.lineCap = 'butt';
      ctx.beginPath(); ctx.arc(x, y, r * 0.84, A0, A0 + SW); ctx.stroke();
      if (wf !== null && wf < hi) {
        ctx.strokeStyle = P.danger; ctx.beginPath(); ctx.arc(x, y, r * 0.84, ang(Math.max(wf, lo)), A0 + SW); ctx.stroke();
      }
      ctx.strokeStyle = P.mute; ctx.lineWidth = 1.5;
      for (let i = 0; i <= 10; i++) {
        const a = A0 + SW * i / 10, r0 = r * (i % 5 === 0 ? 0.66 : 0.72), r1 = r * 0.78;
        ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
      }
      if (r >= 28) {
        font(ctx, Math.max(8, fs * 0.8), false); ctx.fillStyle = P.mute; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [[lo, 0], [(lo + hi) / 2, 5], [hi, 10]].forEach(p => {
          const a = A0 + SW * p[1] / 10; ctx.fillText(fz(p[0], dg), x + Math.cos(a) * r * 0.52, y + Math.sin(a) * r * 0.52);
        });
      }
      if (sp !== null) {
        const a = ang(sp), ux = Math.cos(a), uy = Math.sin(a), tx = x + ux * r * 0.98, ty = y + uy * r * 0.98;
        ctx.fillStyle = P.sig.w; poly(ctx, [[tx, ty], [tx + ux * 7 - uy * 4.5, ty + uy * 7 + ux * 4.5], [tx + ux * 7 + uy * 4.5, ty + uy * 7 - ux * 4.5]], true); ctx.fill();
      }
      if (val !== null) {
        const a = ang(val);
        ctx.strokeStyle = P.fg; ctx.lineWidth = Math.max(2, r * 0.06); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); ctx.stroke();
      }
      ctx.fillStyle = P.fg; ctx.beginPath(); ctx.arc(x, y, Math.max(3, r * 0.09), 0, 2 * Math.PI); ctx.fill();
      font(ctx, fs, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = val === null ? P.mute : P.fg;
      ctx.fillText(fz(val === null ? NaN : val, dg) + (unit && val !== null ? ' ' + unit : ''), x, y + r * 0.62);
    });
  }

  /* ------------------------------------------------------------------ Bimetall */
  function bimetal(ctx, x, y, w, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || w < 20) return false;
    o = obj(o); const P = pal(o);
    const bend = nz(o, 'bend', 0, -1, 1), open = o.contactOpen === undefined ? true : !!o.contactOpen;
    return draw(ctx, () => {
      const th = Math.max(3, w * 0.05), ct = Math.max(3, w * 0.045), dy0 = w * 0.2, gp = Math.max(5, w * 0.07);
      const touch = dy0 - ct - th / 2;
      let up = bend * 0.35 * w;
      if (!open) up = touch; else up = Math.min(up, touch - gp);
      const N = 16, top = [], bot = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N, yy = y - up * u * u;
        top.push([x + w * u, yy - th / 2]); bot.push([x + w * u, yy + th / 2]);
      }
      ctx.lineJoin = 'round'; ctx.lineWidth = 1;
      /* Einspannung */
      ctx.fillStyle = P.metalDark; ctx.fillRect(x - w * 0.12, y - th * 2.2, w * 0.12, th * 4.4);
      /* zwei Metallschichten */
      const mid = top.map((p, i) => [(p[0]), (p[1] + bot[i][1]) / 2]);
      ctx.fillStyle = P.warn; poly(ctx, top.concat(mid.slice().reverse()), true); ctx.fill();
      ctx.fillStyle = P.metal; poly(ctx, mid.concat(bot.slice().reverse()), true); ctx.fill();
      ctx.strokeStyle = P.metalDark; poly(ctx, top.concat(bot.slice().reverse()), true); ctx.stroke();
      /* beweglicher Kontakt auf der Spitze, Gegenkontakt an festem Arm */
      const tipY = y - up, ex = x + w;
      ctx.fillStyle = P.fg; rrect(ctx, ex - ct * 1.6, tipY - th / 2 - ct, ct * 3.2, ct, 1.5); ctx.fill();
      const yF = y - dy0;
      ctx.strokeStyle = P.metalDark; ctx.lineWidth = Math.max(2, ct * 0.7);
      ctx.beginPath(); ctx.moveTo(ex, yF - ct); ctx.lineTo(ex, yF - ct - w * 0.22); ctx.lineTo(ex + w * 0.18, yF - ct - w * 0.22); ctx.stroke();
      ctx.fillStyle = open ? P.fg : P.ok; rrect(ctx, ex - ct * 1.6, yF - ct, ct * 3.2, ct, 1.5); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ Zahnrad-Motor */
  function motor(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const s = nz(o, 'size', 60, 10, 600), ang = afin(o.angle) ? o.angle : 0;
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.03);
      const bx = x - s * 1.9, bw = s * 1.35;
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal; rrect(ctx, bx, y - s / 2, bw, s, s * 0.08); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.metalDark; ctx.lineWidth = Math.max(1, s * 0.025);
      for (let i = 1; i < 6; i++) { const xx = bx + bw * i / 6; ctx.beginPath(); ctx.moveTo(xx, y - s / 2 + 3); ctx.lineTo(xx, y + s / 2 - 3); ctx.stroke(); }
      ctx.fillStyle = P.metal; ctx.fillRect(bx + bw, y - s * 0.3, s * 0.2, s * 0.6);
      ctx.fillStyle = P.metalDark; ctx.fillRect(bx + bw + s * 0.2, y - s * 0.05, s * 0.35, s * 0.1);
      /* Zahnrad: 12 Zaehne */
      const n = 12, ro = s * 0.38, ri = s * 0.29, st = 2 * Math.PI / n, pts = [];
      for (let i = 0; i < n; i++) {
        const a = ang + i * st;
        [[ri, 0], [ro, 0.16], [ro, 0.5 - 0.16], [ri, 0.5]].forEach(q => { const aa = a + q[1] * st; pts.push([x + Math.cos(aa) * q[0], y + Math.sin(aa) * q[0]]); });
      }
      ctx.fillStyle = P.metal; ctx.strokeStyle = P.metalDark; ctx.lineWidth = Math.max(1, s * 0.025); poly(ctx, pts, true); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.panel2; ctx.beginPath(); ctx.arc(x, y, ri * 0.55, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.warn; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * ri * 0.78, y + Math.sin(ang) * ri * 0.78, Math.max(1.5, s * 0.04), 0, 2 * Math.PI); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ Schlitten auf Spindel */
  function slide(ctx, x, y, w, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || w < 40) return false;
    o = obj(o); const P = pal(o);
    const pos = nz(o, 'pos', 0, 0, 1), tg = fin(o.target) ? cl(o.target, 0, 1) : null, rot = afin(o.rot) ? o.rot : 0;
    return draw(ctx, () => {
      const cw = Math.max(16, Math.min(40, w * 0.1)), ch = 26, trav = w - cw, cx = x + cw / 2 + trav * pos;
      ctx.lineJoin = 'round';
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1.5; ctx.fillRect(x - 6, y - 6, w + 12, 12); ctx.strokeRect(x - 6, y - 6, w + 12, 12);
      ctx.strokeStyle = P.metal; ctx.lineWidth = 1.5;
      const off = ((rot % 6) + 6) % 6;
      const pitch = Math.max(6, w / 1500);
      for (let xx = x + off; xx < x + w; xx += pitch) { ctx.beginPath(); ctx.moveTo(xx, y - 4); ctx.lineTo(Math.min(xx + 3, x + w), y + 4); ctx.stroke(); }
      ctx.fillStyle = P.danger; ctx.fillRect(x - 12, y - 14, 6, 28); ctx.fillRect(x + w + 6, y - 14, 6, 28);
      ctx.strokeStyle = P.mute; ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { const xx = Math.round(x + cw / 2 + trav * i / 10) + 0.5, l = i % 5 === 0 ? 8 : 5; ctx.beginPath(); ctx.moveTo(xx, y + 20); ctx.lineTo(xx, y + 20 + l); ctx.stroke(); }
      ctx.fillStyle = P.accent; ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1.5; rrect(ctx, cx - cw / 2, y - ch / 2, cw, ch, 4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.fg; ctx.fillRect(cx - 1, y - ch / 2 - 6, 2, 8);
      if (tg !== null) {
        const tx = x + cw / 2 + trav * tg;
        ctx.fillStyle = P.sig.w; poly(ctx, [[tx, y - 16], [tx - 6, y - 28], [tx + 6, y - 28]], true); ctx.fill();
      }
    });
  }

  /* ------------------------------------------------------------------ Funke */
  function spark(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const t = afin(o.t) ? o.t : 0, s = nz(o, 'size', 14, 3, 200);
    return draw(ctx, () => {
      const k = Math.floor(Math.abs(t) * 14), hash = (i) => { const v = Math.sin((k + 1) * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
      const n = 6 + (k % 4);
      ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, s * 0.14);
      for (let i = 0; i < n; i++) {
        const a = (i + hash(i) * 0.8) * 2 * Math.PI / n, l = s * (0.45 + 0.55 * hash(i + 20)), c = i % 2 ? P.warn : '#fff7d6';
        ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * s * 0.18, y + Math.sin(a) * s * 0.18);
        ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
      }
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x, y, Math.max(1.5, s * 0.16), 0, 2 * Math.PI); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ Symbolskizzen (Schema, kein Messwert) */
  const ICONS = (function () {
    const E = (k, x) => 1 - Math.exp(-k * x);
    const sample = (fn, n, x0) => { const a = []; for (let i = 0; i <= n; i++) { const u = i / n; a.push([u, fn(u)]); } return a; };
    const lag = (u, d) => (u < d ? 0 : u - d);
    return {
      p: () => [[0, 0], [0.2, 0], [0.2, 0.8], [1, 0.8]],
      i: () => [[0, 0], [0.2, 0], [1, 1]],
      pi: () => [[0, 0], [0.2, 0], [0.2, 0.4], [1, 1]],
      pd: () => [[0, 0], [0.2, 0]].concat(sample(u => 0.4 + 0.6 * Math.exp(-14 * u), 16).map(p => [0.2 + p[0] * 0.8, p[1]])),
      pid: () => [[0, 0], [0.2, 0]].concat(sample(u => 0.35 + 0.65 * Math.exp(-14 * u) + 0.55 * u, 16).map(p => [0.2 + p[0] * 0.8, p[1] * 0.64])),
      '2p': () => [[0, 0.15], [0.3, 0.15], [0.3, 0.85], [0.6, 0.85], [0.6, 0.15], [1, 0.15]],
      '3p': () => [[0, 0.1], [0.25, 0.1], [0.25, 0.5], [0.5, 0.5], [0.5, 0.9], [0.75, 0.9], [0.75, 0.5], [1, 0.5]],
      pt1: () => sample(u => E(4, u), 24),
      pt2: () => sample(u => 1 - (1 + 6 * u) * Math.exp(-6 * u), 28),
      pt3: () => sample(u => 1 - (1 + 8 * u + 32 * u * u) * Math.exp(-8 * u), 32),
      pt1tt: () => sample(u => E(5, lag(u, 0.25)) , 28),
      pt2tt: () => sample(u => { const v = lag(u, 0.22); return 1 - (1 + 8 * v) * Math.exp(-8 * v); }, 32),
      it1: () => sample(u => { const k = 6; return (u - (1 - Math.exp(-k * u)) / k) * 1.15; }, 28),
      pt2d: () => sample(u => { const d = 0.28, w0 = 14, wd = w0 * Math.sqrt(1 - d * d); return 1 - Math.exp(-d * w0 * u) * (Math.cos(wd * u) + d / Math.sqrt(1 - d * d) * Math.sin(wd * u)); }, 56).map(p => [p[0], p[1] * 0.62])
    };
  })();
  function iconRaw(ctx, P, kind, x, y, w, h, color) {
    const pts = ICONS[kind](); let ymax = 1; pts.forEach(p => { if (p[1] > ymax) ymax = p[1]; });
    const X = u => x + w * u, Y = v => y + h - h * 0.9 * v / ymax - h * 0.05;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    poly(ctx, [[x, y], [x, y + h], [x + w, y + h]], false); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1.8; poly(ctx, pts.map(p => [X(p[0]), Y(p[1])]), false); ctx.stroke();
  }
  function icon(ctx, kind, x, y, w, h, o) {
    if (!okCtx(ctx) || typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(ICONS, kind.toLowerCase()) ||
      !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 6 || h < 6) return false;
    o = obj(o); const P = pal(o);
    return draw(ctx, () => iconRaw(ctx, P, kind.toLowerCase(), x, y, w, h, goodColor(o.color) ? o.color : P.accent));
  }

  /* ------------------------------------------------------------------ Wirkungsplan */
  function ctrlName(c, dir) {
    const m = { P: 'P-Regler', I: 'I-Regler', PI: 'PI-Regler', PD: 'PD-Regler', PID: 'PID-Regler', '2P': 'Zweipunktregler', '3P': 'Dreipunktregler' };
    return typeof c === 'string' && m[c] ? m[c] : '';
  }
  function wirkungsplan(ctx, W, H, data) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(W) || !fin(H) || W < 280 || H < 160) return false;
    const d = obj(data), P = pal(d), roles = obj(d.roles), vals = obj(d.values), units = obj(d.units), digs = obj(d.digits);
    const dirInv = d.dir === 'invers', hand = d.mode === 'hand';
    const ctrlKey = typeof d.ctrl === 'string' ? d.ctrl.toUpperCase() : '';
    const plantKind = typeof d.plantKind === 'string' ? d.plantKind.toLowerCase() : '';
    return draw(ctx, () => {
      if (d.fill === true) { ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H); }
      const M = 6, fs = cl(W / 34, 10, 14), nl = H >= 260 ? 2 : 1;
      const leftW = cl(W * 0.12, 36, 70), rightW = cl(W * 0.12, 30, 60), avail = W - leftW - rightW - M, minGap = 26;
      const bw = Math.min(150, (avail - 2 * minGap) / 3), gap = (avail - 3 * bw) / 2;
      const c0 = leftW + bw / 2, c1 = c0 + bw + gap, c2 = c1 + bw + gap;
      const labH = fs * (1.45 * nl + 0.7);
      const bh = cl(H * 0.2, 34, 74), rs = Math.max(10, Math.min(18, bh * 0.32));
      const y1 = Math.max(H * 0.3, bh / 2 + labH + 4), y2 = Math.min(H * 0.68, H - bh / 2 - labH - 4);
      const lw = bw + gap - 6;                        /* maximale Breite eines Signaltextes */
      const sg = P.sig;
      ctx.lineJoin = 'round';

      /* Boxen und Vergleichsstellen */
      const box = (cx, cy, title, sub, kind, dim, dashed) => {
        ctx.fillStyle = P.panel2; ctx.strokeStyle = dim ? P.mute : P.metal; ctx.lineWidth = 1.5; setDash(ctx, dashed ? [5, 4] : NODASH);
        rrect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, 8); ctx.fill(); ctx.stroke(); setDash(ctx, NODASH);
        const tall = bh >= 56, ty = tall ? cy - bh * 0.29 : cy - bh * 0.16, sy = tall ? cy + bh * 0.31 : cy + bh * 0.2;
        labelRaw(ctx, P, title, cx, ty, 'center', fs, true, dim ? P.mute : P.fg, null, bw - 8);
        if (sub) labelRaw(ctx, P, sub, cx, sy, 'center', Math.max(9, fs * 0.85), false, P.mute, null, bw - 8);
        if (tall && kind && ICONS[kind]) iconRaw(ctx, P, kind, cx - bw * 0.18, cy - bh * 0.1, bw * 0.36, bh * 0.28, dim ? P.mute : P.accent);
      };
      const sumCircle = (cx, cy) => {
        ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(cx, cy, rs, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        const q = rs * 0.7071; ctx.beginPath(); ctx.moveTo(cx - q, cy - q); ctx.lineTo(cx + q, cy + q); ctx.moveTo(cx - q, cy + q); ctx.lineTo(cx + q, cy - q); ctx.stroke();
      };
      /* Pfeile des Rings (zuerst, Boxen decken die Enden) */
      const hd = Math.max(6, fs * 0.7), aw = 2;
      arrowRaw(ctx, M, y1, c0 - rs, y1, hd, sg.w, aw);                                   /* w */
      arrowRaw(ctx, c0 + rs, y1, c1 - bw / 2, y1, hd, sg.e, aw);                         /* e */
      arrowRaw(ctx, c1 + bw / 2, y1, c2 - bw / 2, y1, hd, sg.y, aw, hand ? [5, 4] : null); /* y */
      arrowRaw(ctx, c2, y1 + bh / 2, c2, y2 - rs, hd, P.mute, aw);                        /* Stellglied -> +z */
      arrowRaw(ctx, W - M, y2, c2 + rs, y2, hd, sg.z, aw);                               /* z */
      arrowRaw(ctx, c2 - rs, y2, c1 + bw / 2, y2, hd, P.mute, aw);                       /* -> Strecke */
      const tapX = (c0 + c1) / 2;
      arrowRaw(ctx, c1 - bw / 2, y2, c0 + bw / 2, y2, hd, sg.x, aw);                     /* Strecke -> Messglied (x) */
      ctx.fillStyle = sg.x; ctx.beginPath(); ctx.arc(tapX, y2, 3, 0, 2 * Math.PI); ctx.fill();
      arrowRaw(ctx, tapX, y2, tapX, y2 + bh / 2 + 4, hd, sg.x, aw);                       /* x nach aussen */
      arrowRaw(ctx, c0, y2 - bh / 2, c0, y1 + rs, hd, sg.xm, aw);                        /* xm zurueck */
      box(c1, y1, 'Regler', hand ? 'Handbetrieb' : ctrlName(ctrlKey), hand ? '' : ctrlKey.toLowerCase(), hand, hand);
      box(c2, y1, 'Stellglied', str(roles.stell), '', false, false);
      box(c1, y2, 'Regelstrecke', str(d.plant), plantKind, false, false);
      box(c0, y2, 'Messglied', str(roles.mess), '', false, false);
      sumCircle(c0, y1); sumCircle(c2, y2);

      /* Vorzeichen der Vergleichsstelle und der Stoerstelle */
      const sgnFs = Math.max(11, fs);
      labelRaw(ctx, P, dirInv ? '−' : '+', c0 - rs - 9, y1 - 9, 'center', sgnFs, true, P.fg, null, 0);
      labelRaw(ctx, P, dirInv ? '+' : '−', c0 + 10, y1 + rs + 9, 'center', sgnFs, true, P.fg, null, 0);
      labelRaw(ctx, P, '+', c2 + 10, y2 - rs - 8, 'center', sgnFs, true, P.fg, null, 0);
      labelRaw(ctx, P, '+', c2 + rs + 9, y2 - 9, 'center', sgnFs, true, P.fg, null, 0);

      /* Signaltexte */
      const sig = (sym, role, cx, cy, align, unitKeys, mw) => {
        const v = vals[sym], unit = (unitKeys.map(k => str(units[k])).find(u => u !== '')) || (sym === 'y' ? '%' : '');
        const line = sym + ' = ' + fz(v, fin(digs[sym]) ? digs[sym] : undefined) + (unit && fin(v) ? ' ' + unit : '');
        labelRaw(ctx, P, line, cx, cy, align, fs, true, sg[sym], null, mw || lw);
        if (nl > 1 && role) labelRaw(ctx, P, role, cx, cy + fs * 1.3, align, Math.max(9, fs * 0.85), false, P.mute, null, mw || lw);
      };
      const ly1 = y1 - bh / 2 - labH + fs * 0.75, ly2 = y2 + bh / 2 + 6 + fs * 0.75 + (nl > 1 ? 0 : 6);
      sig('w', str(roles.w), M, ly1, 'left', ['w', 'x'], Math.max(20, (c0 + c1) / 2 + 2 - lw / 2 - M - 4));
      sig('e', 'Regeldifferenz', (c0 + c1) / 2 + 2, ly1, 'center', ['e', 'x']);
      sig('y', str(roles.y), (c1 + c2) / 2, ly1, 'center', ['y']);
      sig('x', str(roles.x), tapX, ly2, 'center', ['x']);
      sig('z', str(roles.z), c2, ly2, 'center', ['z']);
      sig('xm', 'Messwert', c0 + 8, (y1 + y2) / 2, 'left', ['xm', 'x']);
      /* kleines z am Pfeilanfang, damit die Stoerrichtung lesbar ist */
      return true;
    });
  }

  /* ------------------------------------------------------------------ Messschreiber */
  const TK = { s: 1, min: 60, h: 3600 };
  function seq(a) { return Array.isArray(a) || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(a) && typeof a.length === 'number') ? a : null; }
  function traceChart(ctx, rect, tr, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') return false;
    if (!rect || typeof rect !== 'object' || !fin(rect.x) || !fin(rect.y) || !fin(rect.w) || !fin(rect.h) || rect.w < 200 || rect.h < 120) return false;
    if (!tr || typeof tr !== 'object') return false;
    o = obj(o); const P = pal(o), names = obj(o.names);
    const unit = typeof o.tUnit === 'string' && Object.prototype.hasOwnProperty.call(TK, o.tUnit) ? o.tUnit : 's', k = TK[unit];
    const T = seq(tr.t) || [], n = T.length;
    const col = key => { const a = seq(tr[key]); return a && a.length >= n ? a : null; };
    const aX = col('x'), aW = col('w'), aY = col('y'), aZ = col('z');
    const xUnit = str(o.xUnit), zUnit = str(o.zUnit), dg = fin(o.digits) ? o.digits : undefined;
    /* Zeitfenster und Indexbereich */
    let first = -1, last = -1, tmin = Infinity, tmax = -Infinity;
    for (let i = 0; i < n; i++) if (fin(T[i])) { if (T[i] < tmin) tmin = T[i]; if (T[i] > tmax) tmax = T[i]; }
    const t0 = fin(o.t0) ? o.t0 : (fin(tmin) ? tmin : 0);
    let t1 = fin(o.t1) ? o.t1 : (fin(tmax) ? tmax : 1);
    if (!(t1 > t0)) t1 = t0 + 1;
    for (let i = 0; i < n; i++) if (fin(T[i]) && T[i] >= t0 && T[i] <= t1) { if (first < 0) first = i; last = i; }
    const hasData = first >= 0 && last > first;
    /* Layout */
    const L = rect.x + 46, R = rect.x + rect.w - 8, Tp = rect.y + 8, B = rect.y + rect.h - 28;
    const pw = R - L, ph = B - Tp;
    if (!(pw > 30) || !(ph > 30)) return false;
    const showY = !!aY, gapPx = 8;
    const uh = showY ? Math.round(ph * 0.66) : ph, lh = showY ? ph - uh - gapPx : 0;
    /* x-Achse */
    let xlo = Infinity, xhi = -Infinity;
    if (hasData) for (let i = first; i <= last; i++) [aX, aW].forEach(a => { if (a && fin(a[i])) { if (a[i] < xlo) xlo = a[i]; if (a[i] > xhi) xhi = a[i]; } });
    if (Array.isArray(o.xRange) && fin(o.xRange[0]) && fin(o.xRange[1]) && o.xRange[1] > o.xRange[0]) { xlo = o.xRange[0]; xhi = o.xRange[1]; }
    else if (fin(xlo) && fin(xhi)) { const pad = (xhi - xlo) * 0.08 || Math.max(1, Math.abs(xhi) * 0.05); xlo -= pad; xhi += pad; }
    else { xlo = 0; xhi = 1; }
    const X = t => L + pw * (t - t0) / (t1 - t0), YU = v => Tp + uh * (1 - (v - xlo) / (xhi - xlo)), YL = v => Tp + uh + gapPx + lh * (1 - v / 100);
    const layout = {
      plot: { x: L, y: Tp, w: pw, h: ph }, upper: { x: L, y: Tp, w: pw, h: uh, lo: xlo, hi: xhi },
      lower: showY ? { x: L, y: Tp + uh + gapPx, w: pw, h: lh } : null, t0, t1, unit, k,
      timeAt: px => t0 + (px - L) / pw * (t1 - t0), pxAt: t => X(t)
    };
    return draw(ctx, () => {
      const fs = 11;
      ctx.lineJoin = 'round';
      ctx.fillStyle = mix(P.bg, P.panel, 0.6); ctx.fillRect(L, Tp, pw, uh); if (showY) ctx.fillRect(L, Tp + uh + gapPx, pw, lh);
      /* Gitter und Achsenbeschriftung */
      font(ctx, fs, false); ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.fillStyle = P.mute;
      const tx = ticks(t0 / k, t1 / k, Math.max(3, Math.floor(pw / 80))), tdg = digitsOfStep(tx.s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      tx.t.forEach(v => {
        const xx = Math.round(X(v * k)) + 0.5; if (xx < L || xx > R) return;
        ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + uh); if (showY) { ctx.moveTo(xx, Tp + uh + gapPx); ctx.lineTo(xx, Tp + ph); } ctx.stroke();
        ctx.fillText(fz(v, tdg), xx, B + 3);
      });
      ctx.fillText('Prozesszeit in ' + unit, L + pw / 2, B + 3 + fs + 3);
      const ty = ticks(xlo, xhi, Math.max(3, Math.floor(uh / 40))), ydg = fin(dg) ? dg : digitsOfStep(ty.s);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ty.t.forEach(v => {
        const yy = Math.round(YU(v)) + 0.5; if (yy < Tp || yy > Tp + uh) return;
        ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); ctx.fillText(fz(v, ydg), L - 5, yy);
      });
      if (xUnit) { ctx.textAlign = 'left'; ctx.fillText(xUnit, rect.x + 2, Tp + 6); }
      if (showY) {
        (lh >= 44 ? [0, 50, 100] : lh >= 24 ? [0, 100] : []).forEach(v => { const yy = Math.round(YL(v)) + 0.5; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(v), L - 5, yy); });
        ctx.textAlign = 'left'; ctx.fillText('%', rect.x + 2, Tp + uh + gapPx + 6);
      }
      ctx.strokeStyle = P.metalDark; ctx.strokeRect(L + 0.5, Tp + 0.5, pw, uh); if (showY) ctx.strokeRect(L + 0.5, Tp + uh + gapPx + 0.5, pw, lh);
      /* Inhalt der Flaechen: auf die Plotflaechen begrenzt */
      const clipTo = (y, h) => { ctx.save(); ctx.beginPath(); ctx.rect(L, y, pw, h); ctx.clip(); };
      clipTo(Tp, uh);
      (Array.isArray(o.bands) ? o.bands.slice(0, 6) : []).forEach(b => {
        if (!b || !fin(b.lo) || !fin(b.hi) || !(b.hi > b.lo)) return;
        const c = goodColor(b.color) ? b.color : P.ok, y0 = YU(b.hi), y1 = YU(b.lo);
        ctx.globalAlpha = 0.13; ctx.fillStyle = c; ctx.fillRect(L, y0, pw, y1 - y0); ctx.globalAlpha = 0.7; ctx.strokeStyle = c; ctx.lineWidth = 1; setDash(ctx, [4, 4]);
        ctx.beginPath(); ctx.moveTo(L, y0); ctx.lineTo(R, y0); ctx.moveTo(L, y1); ctx.lineTo(R, y1); ctx.stroke(); setDash(ctx, NODASH); ctx.globalAlpha = 1;
        const lb = str(b.label); if (lb) { font(ctx, 10, false); ctx.fillStyle = c; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(fitText(ctx, lb, pw * 0.5, 10, false), R - 4, y0 - 1); }
      });
      const stride = Math.max(1, Math.floor((last - first + 1) / (pw * 2)));
      const trace = (tt, a, yf, color, width, dash, alpha) => {
        if (!tt || !a) return;
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.globalAlpha = alpha; setDash(ctx, dash || NODASH);
        ctx.beginPath(); let pen = false;
        const nn = Math.min(tt.length, a.length);
        for (let i = 0; i < nn; i += stride) {
          if (!(fin(tt[i]) && fin(a[i])) || tt[i] < t0 || tt[i] > t1) { pen = false; continue; }
          const px = X(tt[i]), py = yf(a[i]);
          if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
        }
        ctx.stroke(); setDash(ctx, NODASH); ctx.globalAlpha = 1;
      };
      const rf = o.ref && typeof o.ref === 'object' ? o.ref : null;
      if (rf) trace(seq(rf.t), seq(rf.x), YU, P.mute, 2, null, 0.5);
      if (hasData) { trace(T, aW, YU, P.sig.w, 1.8, [6, 4], 1); trace(T, aX, YU, P.sig.x, 2.2, null, 1); }
      ctx.restore();
      if (showY) {
        clipTo(Tp + uh + gapPx, lh);
        if (hasData) trace(T, aY, YL, P.sig.y, 2, null, 1);
        /* Stoergroesse: Streifen am unteren Rand, Deckkraft nach Wert; Dreiecke bei Aenderung */
        if (hasData && aZ) {
          let zlo = Infinity, zhi = -Infinity;
          for (let i = first; i <= last; i++) if (fin(aZ[i])) { if (aZ[i] < zlo) zlo = aZ[i]; if (aZ[i] > zhi) zhi = aZ[i]; }
          if (Array.isArray(o.zRange) && fin(o.zRange[0]) && fin(o.zRange[1]) && o.zRange[1] > o.zRange[0]) { zlo = o.zRange[0]; zhi = o.zRange[1]; }
          const by = Tp + uh + gapPx + lh - 5;
          ctx.fillStyle = P.sig.z;
          if (zhi > zlo) {
            let marks = 0;
            for (let i = first; i <= last; i += stride) {
              if (!(fin(aZ[i]) && fin(T[i]))) continue;
              const nx = i + stride <= last && fin(T[i + stride]) ? X(T[i + stride]) : R, px = X(T[i]);
              ctx.globalAlpha = 0.12 + 0.88 * cl((aZ[i] - zlo) / (zhi - zlo), 0, 1); ctx.fillRect(px, by, Math.max(1, nx - px + 0.5), 5);
              if (i > first && fin(aZ[i - stride]) && Math.abs(aZ[i] - aZ[i - stride]) > (zhi - zlo) * 1e-6 && marks < 20) { marks++; ctx.globalAlpha = 1; poly(ctx, [[px, by - 1], [px - 4, by - 8], [px + 4, by - 8]], true); ctx.fill(); }
            }
            ctx.globalAlpha = 1;
          }
        }
        ctx.restore();
      }
      /* Marken */
      (Array.isArray(o.marks) ? o.marks.slice(0, 12) : []).forEach(m => {
        if (!m || !fin(m.t) || m.t < t0 || m.t > t1) return;
        const xx = Math.round(X(m.t)) + 0.5, c = goodColor(m.color) ? m.color : P.warn;
        ctx.strokeStyle = c; ctx.lineWidth = 1; setDash(ctx, [3, 4]); ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + ph); ctx.stroke(); setDash(ctx, NODASH);
        const lb = str(m.label); if (lb) { font(ctx, 10, false); ctx.fillStyle = c; ctx.textAlign = xx > L + pw * 0.8 ? 'right' : 'left'; ctx.textBaseline = 'top'; ctx.fillText(fitText(ctx, lb, 110, 10, false), xx + (xx > L + pw * 0.8 ? -3 : 3), Tp + 2); }
      });
      /* Legende */
      font(ctx, 10, false); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      let lx = L + 6; const lyy = Tp + uh - 10;
      [['x', names.x || 'Regelgröße x', P.sig.x, null, aX], ['w', names.w || 'Sollwert w', P.sig.w, [6, 4], aW]].forEach(e => {
        if (!e[4]) return; const t = fitText(ctx, str(e[1]) || e[0], pw * 0.3, 10, false);
        ctx.globalAlpha = 0.8; ctx.fillStyle = P.panel; rrect(ctx, lx - 3, lyy - 8, 28 + tw(ctx, t, 10, false), 16, 4); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = e[2]; ctx.lineWidth = 2; setDash(ctx, e[3] || NODASH); ctx.beginPath(); ctx.moveTo(lx, lyy); ctx.lineTo(lx + 16, lyy); ctx.stroke(); setDash(ctx, NODASH);
        ctx.fillStyle = P.mute; ctx.fillText(t, lx + 20, lyy); lx += 28 + tw(ctx, t, 10, false);
      });
      if (showY) { const t = fitText(ctx, str(names.y) || 'Stellgröße y', pw * 0.3, 10, false); ctx.globalAlpha = 0.8; ctx.fillStyle = P.panel; rrect(ctx, L + 3, Tp + uh + gapPx + 1, tw(ctx, t, 10, false) + 6, 16, 4); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = P.sig.y; ctx.fillText(t, L + 6, Tp + uh + gapPx + 9); }
      if (!hasData) {
        font(ctx, 13, false); ctx.fillStyle = P.mute; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('Noch keine Daten', L + pw / 2, Tp + uh / 2);
      }
      /* Fadenkreuz mit Wertanzeige */
      if (hasData && fin(o.cursorT) && o.cursorT >= t0 && o.cursorT <= t1) {
        const xx = Math.round(X(o.cursorT)) + 0.5;
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + ph); ctx.stroke();
        let bi = first, bd = Infinity;
        for (let i = first; i <= last; i++) if (fin(T[i]) && Math.abs(T[i] - o.cursorT) < bd) { bd = Math.abs(T[i] - o.cursorT); bi = i; }
        const lines = [['t = ' + fz(T[bi] / k, Math.max(tdg, 1)) + ' ' + unit, P.fg]];
        if (aX) lines.push(['x = ' + fz(aX[bi], dg) + (xUnit ? ' ' + xUnit : ''), P.sig.x]);
        if (aW) lines.push(['w = ' + fz(aW[bi], dg) + (xUnit ? ' ' + xUnit : ''), P.sig.w]);
        if (aY) lines.push(['y = ' + fz(aY[bi], 1) + ' %', P.sig.y]);
        if (aZ) lines.push(['z = ' + fz(aZ[bi], dg) + (zUnit ? ' ' + zUnit : ''), P.sig.z]);
        font(ctx, 11, true);
        let bwid = 0; lines.forEach(l => { bwid = Math.max(bwid, tw(ctx, l[0], 11, true)); }); bwid = Math.min(bwid + 12, pw * 0.5);
        const bhh = lines.length * 15 + 6, onRight = xx < L + pw / 2, bx0 = onRight ? Math.min(xx + 6, R - bwid - 2) : Math.max(xx - 6 - bwid, L + 2);
        ctx.globalAlpha = 0.92; ctx.fillStyle = P.panel; rrect(ctx, bx0, Tp + 4, bwid, Math.min(bhh, uh - 8), 5); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = P.line; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        lines.forEach((l, i) => { if (Tp + 4 + 12 + i * 15 > Tp + uh) return; ctx.fillStyle = l[1]; ctx.fillText(fitText(ctx, l[0], bwid - 10, 11, true), bx0 + 6, Tp + 4 + 11 + i * 15); });
      }
      return layout;
    });
  }

  const api = { version: '1.0', pipe, valve, pump, tank, radiator, thermometer, gauge, bimetal, motor, slide, spark, arrow, label, icon, wirkungsplan, traceChart,
    fz, ticks, palette, cssColors, mix, PAL_DARK, PAL_LIGHT,
    fns: ['pipe', 'valve', 'pump', 'tank', 'radiator', 'thermometer', 'gauge', 'bimetal', 'motor', 'slide', 'spark', 'arrow', 'label', 'icon', 'wirkungsplan', 'traceChart'] };
  root.REG_DRAW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
