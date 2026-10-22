/* enrdraw.js - Energie-Lab Zeichenhelfer und Tageslandschaft (ENR_DRAW, Version 1.0)
 * Himmel nach Sonnenhoehe, Sonne, Sonnenbahn, Wolken, Boden, Schatten, Haus, Modul mit Zellraster, Bypassdiode, Querschnitt,
 * Strahlen, Energiefluss-Pfeile, Akku, Regler, Wechselrichter, Zaehler, Mast und die gemeinsame Szene fuer insel/netz.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval, offline. Browser: window.ENR_DRAW, Node: module.exports / globalThis.ENR_DRAW.
 *
 * ===================================================================================================
 * ALLGEMEINES (Konventionen wie regdraw.js)
 *  - Jede Zeichenfunktion hat die Form f(ctx, ...). ctx ist ein Canvas-2D-Kontext (im Test ein Mock). Zustandsfrei: gleiche
 *    Argumente ergeben gleiche Aufrufe. Animation nur ueber die Zeit t (Sekunden) in den Optionen.
 *  - Rueckgabe true = gezeichnet, false = nichts gezeichnet (dann gab es auch KEINEN Aufruf am ctx). false kommt bei fehlendem
 *    ctx, nicht endlichen Pflichtkoordinaten, Groesse 0 oder zu klein, ungueltigen Pflichtdaten. Optionen fallen bei Unsinn
 *    auf Vorgaben zurueck, Zahlen werden geklemmt. Zahlen als Text gelten NICHT als Zahl.
 *  - Reine Hilfen (keine ctx-Aufrufe) liefern Daten: skyColors, sunPos, cloudLayout, houseGeom, houseShadow, moduleQuad,
 *    panelApparent, tempColor, socColor, flowWidth, fmtW, starCount, sceneLayout, reducedMotion.
 *  - Texte: Dezimalkomma (fz), echtes Minuszeichen, Einheit an jeder Zahl, Mindestschrift 11 px, Kontur auf Bildgrund.
 *  - prefers-reduced-motion: opts.reduced (true/false); die Szene fragt window.matchMedia, wenn data.reduced fehlt.
 *    Reduziert: keine Drehung, keine Pulse, Wolken stehen, Punkte langsam.
 *
 * ===================================================================================================
 * FUNKTIONEN
 *  skyColors(alt) -> { top, mid, bottom, stars 0..1, light 0..1 }   zentral fuer den Himmel (5.4 Nr. 2), stetig ueberblendet
 *  sky(ctx, w, h, { alt, stars, t, reduced })
 *  sun(ctx, x, y, { r, intensity 0..1, t, reduced, alt })            12 Strahlen, weicher Kranz
 *  sunPos(rect, alt, az) -> { x, y }                                  Blick nach Sueden: Osten links, Westen rechts, Horizont = Unterkante rect
 *  sunPathArc(ctx, rect, path, now)   path = { alt[], az[], t[]?, extra:[{alt[],az[],label}] }, now = { alt, az } | null
 *  clouds(ctx, rect, { c, t, seed, reduced, light }) ; cloudLayout(c, seed, t, w, h, reduced) -> Gruppen
 *  ground(ctx, rect, { light, snow, haze }) ; shadow(ctx, poly, { alpha, soft, color })
 *  house(ctx, x, y, w, h, { kind:'gartenhaus'|'wohnhaus', lit 0..1, light, cutaway }) ; houseGeom(x, y, w, h, opts)
 *  houseShadow(geom, alt, az, { maxLen, bounds }) -> Polygon | null
 *  moduleQuad(cx, yb, w, len, beta, az) -> [TL, TR, BR, BL]          Bildschirmviereck eines geneigten Moduls
 *  panelGrid(ctx, x, y, w, h, { cols, rows, subs, shade[], hot[], temp, glint, t, reduced, orient, bypass[], detail })
 *  panelQuad(ctx, quad, opts)                                          wie panelGrid, aber in einem Viereck (Neigung/Azimut)
 *     shade[i] = Besonnung der Zelle i = row*cols + col (Zeile 0 oben, Spalte 0 links, wie angezeigt): 1 = voll besonnt, 0 = Kernschatten
 *     hot[]    = Zellindizes oder { cell, level 0..1, error:bool } ; bypass[] = je Teilstrang { on, state:'ok'|'fehlt'|'kurz' }
 *     orient 'hochkant': Teilstraenge = Spaltengruppen; 'quer': Teilstraenge = waagerechte Baender (unterstes = letzter)
 *  cellIndex(xf, yf, cols, rows) -> Index    Zelle aus layout().xf/yf (yf von UNTEN) in die Anzeige-Reihenfolge
 *  bypass(ctx, x, y, { on, state, size, caption, t, reduced })
 *  crossSection(ctx, rect, build, { photons, t, reduced, labels })    build = ENR_CORE.pv.build ([{ id, name, mm, rolle }])
 *  rays(ctx, from, to, { gb, gd, gr, aoi, t, reduced, obstacle, budget, showAngle })   from {x,y}, to {x0,y0,x1,y1} (Modulflaeche)
 *  flow(ctx, pts, P, opts)   Energiefluss-Pfeil (5.4 Nr. 6): P in W, Vorzeichen = Richtung (negativ = gegen pts);
 *                            opts.kind 'solar'|'akku'|'akku-laden'|'akku-entl'|'last'|'netz'|'bezug'|'einsp'|'verlust'
 *                            ('akku': P>0 laedt; 'netz': P>0 speist ein, P<0 bezieht), Pref (W), t, reduced, name, label:false,
 *                            compact, at, off, maxDots, budget {n}
 *  flowWidth(P, Pref) -> px ; fmtW(P) -> '1,2 kW' | '850 W' ; FLOW_KINDS
 *  battery(ctx, x, y, w, h, { soc, gas, warn, temp, t, reduced, budget })
 *  controllerBox(ctx, x, y, w, h, { type:'pwm'|'mppt'|'direkt', stage 0..3, duty, uv, ii, mpp 0..1, dead, t, reduced })
 *  inverterBox(ctx, x, y, w, h, { on, pAc, eta, led:'ok'|'warn'|'error'|'off', t, reduced, caption })
 *  meterBox(ctx, x, y, w, h, { bezug, einsp, dir -1|0|1, t, reduced })   Zaehler (Scheibe, zwei Zaehlwerke in kWh)
 *  pole(ctx, x, y, h, { on, wires })                                   Freileitungsmast
 *  scene(ctx, w, h, data) ; sceneLayout(w, h, data)                    Tageslandschaft insel/netz (Beschreibung bei scene)
 *  label(ctx, text, x, y, opts) ; arrow(ctx, x0, y0, x1, y1, opts) ; legend(ctx, x, y, items, opts)
 *  cssColors(el), fns (Namensliste), version
 * ===================================================================================================
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Hilfen */
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e7;
  const afin = v => typeof v === 'number' && isFinite(v);
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  const lerp = (a, b, t) => a + (b - a) * t;
  function nz(o, k, def, lo, hi) {
    const v = o[k];
    if (!fin(v)) return def;
    return cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  }
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 64 && !/NaN|undefined|null/i.test(v);
  function rng(seed) { /* mulberry32 */
    let a = (seed >>> 0) || 1;
    return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function parseHex(c) {
    if (typeof c !== 'string') return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c.trim());
    if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16)];
    m = /^#([0-9a-f]{3})$/i.exec(c.trim());
    if (m) return [parseInt(m[1][0] + m[1][0], 16), parseInt(m[1][1] + m[1][1], 16), parseInt(m[1][2] + m[1][2], 16)];
    return null;
  }
  function mix(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    if (!B) return typeof b === 'string' ? b : '#888888';
    if (!A || !fin(t)) return b;
    t = cl(t, 0, 1);
    const h = i => ('0' + Math.round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2);
    return '#' + h(0) + h(1) + h(2);
  }
  function rgba(c, a) {
    const p = parseHex(c); if (!p) return 'rgba(0,0,0,' + (Math.round(cl(a, 0, 1) * 1000) / 1000) + ')';
    return 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + (Math.round(cl(a, 0, 1) * 1000) / 1000) + ')';
  }
  function dim(c, light) { return mix('#0a0f1e', c, cl(light, 0, 1)); }   /* Farbe nach Umgebungshelligkeit abdunkeln */
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
    } catch (e) { /* ohne Stile: Standard */ }
    return out;
  }
  function reducedMotion() {
    try { if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return !!window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* ignorieren */ }
    return false;
  }

  /* Anzeige: Dezimalkomma, Minuszeichen, nicht endlich = Gedankenstrich */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    let s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d);
    s = s.replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  /* Leistung: unter 10 W eine Stelle, bis 1000 W ganze Watt, darueber kW (zwei, eine oder keine Stelle). Betrag. */
  function fmtW(P) {
    if (!fin(P)) return '–';
    const a = Math.abs(P);
    if (a >= 999.5) { const k = a / 1000; return fz(k, k >= 100 ? 0 : k >= 10 ? 1 : 2) + ' kW'; }
    return fz(a, a < 10 ? 1 : 0) + ' W';
  }

  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && typeof ctx.save === 'function' && typeof ctx.restore === 'function' &&
      typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function' &&
      typeof ctx.stroke === 'function' && typeof ctx.fill === 'function';
  }
  function draw(ctx, fn) {
    ctx.save();
    try { const r = fn(); ctx.restore(); return r === undefined ? true : r; } catch (e) { try { ctx.restore(); } catch (e2) { /* ignorieren */ } return false; }
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
  function ellipse(ctx, x, y, rx, ry) {
    if (typeof ctx.ellipse === 'function') ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
    else ctx.arc(x, y, Math.max(0.01, (rx + ry) / 2), 0, TAU);
  }
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d); if (off !== undefined) ctx.lineDashOffset = off; }
  const NODASH = [];
  function lin(ctx, x0, y0, x1, y1, stops) {
    if (typeof ctx.createLinearGradient !== 'function') return stops[0][1];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
  }
  function rad(ctx, x, y, r0, r1, stops) {
    if (typeof ctx.createRadialGradient !== 'function') return stops[0][1];
    const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    return g;
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
  /* Punkt und Richtung bei Strecke d entlang des Linienzugs */
  function pointAt(p, d) {
    let acc = 0;
    for (let i = 1; i < p.length; i++) {
      const sl = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (sl > 0 && d <= acc + sl + 1e-9) { const f = (d - acc) / sl; return { x: lerp(p[i - 1][0], p[i][0], f), y: lerp(p[i - 1][1], p[i][1], f), ux: (p[i][0] - p[i - 1][0]) / sl, uy: (p[i][1] - p[i - 1][1]) / sl }; }
      acc += sl;
    }
    const a = p[p.length - 2] || p[0], b = p[p.length - 1], sl = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: b[0], y: b[1], ux: (b[0] - a[0]) / sl, uy: (b[1] - a[1]) / sl };
  }
  function thin(arr, maxN) {
    if (arr.length <= maxN) return arr.map((v, i) => i);
    const out = [];
    for (let i = 0; i < maxN; i++) out.push(Math.round(i * (arr.length - 1) / (maxN - 1)));
    return out;
  }
  function rectOk(r, minW, minH) { return !!r && typeof r === 'object' && fin(r.x) && fin(r.y) && fin(r.w) && fin(r.h) && r.w >= (minW || 4) && r.h >= (minH || 4); }

  /* Beschriftung mit Kontur (lesbar auf Himmel und Boden); Mindestschrift 11 px */
  function labelRaw(ctx, text, x, y, align, size, bold, color, bg, maxw, outline) {
    font(ctx, size, bold);
    let t = text;
    if (maxw > 0) t = fitText(ctx, t, maxw, size, bold);
    if (t === '') return false;
    ctx.textAlign = align; ctx.textBaseline = 'middle';
    if (bg) {
      const w = tw(ctx, t, size, bold) + 8, x0 = align === 'left' ? x - 4 : align === 'right' ? x - w + 4 : x - w / 2;
      ctx.fillStyle = bg; rrect(ctx, x0, y - size * 0.75, w, size * 1.5, 4); ctx.fill();
    }
    if (outline && typeof ctx.strokeText === 'function') {
      ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = outline; ctx.strokeText(t, x, y);
    }
    ctx.fillStyle = color; ctx.fillText(t, x, y);
    return true;
  }
  function label(ctx, text, x, y, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y)) return false;
    const t = typeof text === 'number' ? (fin(text) ? fz(text) : '') : typeof text === 'string' ? text : '';
    if (t.trim() === '') return false;
    o = obj(o);
    const align = o.align === 'left' || o.align === 'right' ? o.align : 'center';
    const outline = o.outline === false ? null : goodColor(o.outline) ? o.outline : (o.bg ? null : 'rgba(8,12,24,0.7)');
    return draw(ctx, () => labelRaw(ctx, t, x, y, align, nz(o, 'size', 12, 11, 60), !!o.bold, goodColor(o.color) ? o.color : '#ffffff',
      goodColor(o.bg) ? o.bg : null, nz(o, 'maxw', 0, 0, 5000), outline));
  }
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
    o = obj(o);
    const dash = Array.isArray(o.dash) && o.dash.length && o.dash.every(v => fin(v) && v >= 0) && o.dash.some(v => v > 0) ? o.dash.slice(0, 6) : null;
    return draw(ctx, () => arrowRaw(ctx, x0, y0, x1, y1, nz(o, 'head', 8, 2, 60), goodColor(o.color) ? o.color : '#ffffff', nz(o, 'width', 2, 0.5, 20), dash));
  }

  /* ------------------------------------------------------------------ Himmel (5.4 Nr. 2) */
  /* Stuetzfarben je Sonnenhoehe: [alt, oben, mitte, Horizont, Sterne 0..1, Umgebungshelligkeit 0..1] */
  const SKY = [
    [-30, '#070b25', '#0b1131', '#131b42', 1.0, 0.12],
    [-18, '#070b25', '#0b1131', '#131b42', 1.0, 0.12],
    [-12, '#121846', '#1c2257', '#33305e', 0.8, 0.22],
    [-6, '#262b66', '#5f4685', '#b8603f', 0.0, 0.45],
    [-3, '#323a7a', '#8d5a95', '#e57d4a', 0.0, 0.62],
    [0, '#3f5390', '#c27a92', '#ff9a4d', 0.0, 0.76],
    [3, '#46659f', '#d8a28c', '#ffb866', 0.0, 0.86],
    [6, '#3f74c2', '#9fb0d0', '#f6d08a', 0.0, 0.93],
    [12, '#3c7fcc', '#78a9d8', '#e6d9b0', 0.0, 1.0],
    [20, '#3787d8', '#6bb0ea', '#bcdcf4', 0.0, 1.0],
    [40, '#2f82dc', '#5aa5ec', '#b0d8f6', 0.0, 1.0],
    [90, '#2a7bd8', '#4f9ae6', '#a5d2f5', 0.0, 1.0]
  ];
  function skyColors(alt) {
    const a = afin(alt) ? cl(alt, -30, 90) : 45;
    let i = 1; while (i < SKY.length - 1 && SKY[i][0] < a) i++;
    const s0 = SKY[i - 1], s1 = SKY[i], f = s1[0] === s0[0] ? 0 : cl((a - s0[0]) / (s1[0] - s0[0]), 0, 1);
    return { top: mix(s0[1], s1[1], f), mid: mix(s0[2], s1[2], f), bottom: mix(s0[3], s1[3], f), stars: lerp(s0[4], s1[4], f), light: lerp(s0[5], s1[5], f) };
  }
  const starCount = alt => Math.round(40 * skyColors(alt).stars);
  function starPos(n, w, h) {
    const r = rng(20240611), out = [];
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h * 0.82, s = r() < 0.2 ? 2 : 1, ph = r() * TAU; if (i < n) out.push([x, y, s, ph]); }
    return out;
  }
  function sky(ctx, w, h, o) {
    if (!okCtx(ctx) || !fin(w) || !fin(h) || w < 4 || h < 4) return false;
    o = obj(o);
    const alt = fin(o.alt) ? o.alt : 45, c = skyColors(alt), t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    return draw(ctx, () => {
      ctx.fillStyle = lin(ctx, 0, 0, 0, h, [[0, c.top], [0.55, c.mid], [1, c.bottom]]);
      ctx.fillRect(0, 0, w, h);
      const n = o.stars === false ? 0 : Math.round(starCount(alt) * (o.stars === undefined ? 1 : nz(o, 'stars', 1, 0, 1)));
      if (n > 0) {
        const st = starPos(n, w, h);
        ctx.fillStyle = '#ffffff';
        for (let g = 0; g < 3; g++) {
          ctx.globalAlpha = reduced ? 0.8 : 0.45 + 0.4 * Math.sin(t * 2.2 + g * 2.1);
          st.forEach((p, i) => { if (i % 3 === g) ctx.fillRect(p[0], p[1], p[2], p[2]); });
        }
        ctx.globalAlpha = 1;
      }
    });
  }
  function sunColor(alt) { const a = afin(alt) ? alt : 45; return mix('#ff9a3c', '#fff2b0', cl(a / 25, 0, 1)); }
  function sun(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o);
    const r = nz(o, 'r', 26, 4, 400), k = nz(o, 'intensity', 1, 0, 1), t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    const col = fin(o.alt) ? sunColor(o.alt) : '#fff2b0';
    return draw(ctx, () => {
      const gR = r * (2.6 + 1.2 * k);
      ctx.fillStyle = rad(ctx, x, y, r * 0.3, gR, [[0, rgba('#ffe27a', 0.55 * (0.25 + 0.75 * k))], [0.45, rgba('#ffcf4d', 0.22 * (0.25 + 0.75 * k))], [1, rgba('#ffcf4d', 0)]]);
      ctx.beginPath(); ctx.arc(x, y, gR, 0, TAU); ctx.fill();
      if (k > 0.35) {
        const rot = reduced ? 0 : t * 0.25;
        ctx.strokeStyle = rgba('#ffd54a', 0.35 + 0.5 * k); ctx.lineWidth = Math.max(1.5, r * 0.09); ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = rot + i * TAU / 12, r0 = r * 1.25, r1 = r * (i % 2 ? 1.7 : 2.05);
          ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1);
        }
        ctx.stroke();
      }
      ctx.fillStyle = rad(ctx, x - r * 0.25, y - r * 0.25, r * 0.1, r, [[0, '#ffffff'], [0.5, col], [1, mix(col, '#ff9a1c', 0.55)]]);
      ctx.globalAlpha = 0.35 + 0.65 * k;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    });
  }
  /* Sonnenposition im Himmelsrechteck: Horizont = Unterkante, Sued in der Mitte, Osten links (5.4 Nr. 3) */
  function sunPos(rect, alt, az) {
    if (!rectOk(rect, 1, 1) || !afin(alt) || !afin(az)) return { x: NaN, y: NaN };
    const hz = rect.y + rect.h, top = rect.y + 0.07 * rect.h;
    return { x: rect.x + rect.w * (0.5 + cl(az, -120, 120) / 240), y: hz - (hz - top) * (cl(alt, -20, 90) / 90) };
  }
  function pathPts(rect, p, maxN) {
    const alt = Array.isArray(p && p.alt) ? p.alt : null, az = Array.isArray(p && p.az) ? p.az : null;
    if (!alt || !az || alt.length < 2 || alt.length !== az.length || alt.length > 20000) return [];
    const idx = thin(alt, maxN || 40), out = [];
    idx.forEach(i => { if (afin(alt[i]) && afin(az[i])) { const q = sunPos(rect, alt[i], az[i]); out.push({ x: q.x, y: q.y, alt: alt[i], az: az[i], i }); } });
    return out;
  }
  function sunPathArc(ctx, rect, path, now) {
    if (!okCtx(ctx) || !rectOk(rect) || !path || typeof path !== 'object') return false;
    const main = pathPts(rect, path, 40);
    const extras = (Array.isArray(path.extra) ? path.extra.slice(0, 3) : []).map(e => ({ e, pts: pathPts(rect, e, 28) }));
    const hasNow = now && typeof now === 'object' && afin(now.alt) && afin(now.az);
    if (!main.some(p => p.alt > 0) && !extras.some(x => x.pts.some(p => p.alt > 0)) && !hasNow) return false;
    return draw(ctx, () => {
      const hz = rect.y + rect.h;
      function stroke(pts, w, col, dash, alpha) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.globalAlpha = alpha; setDash(ctx, dash); ctx.lineCap = 'round';
        let open = false;
        ctx.beginPath();
        pts.forEach(p => {
          if (p.alt >= -1) { if (open) ctx.lineTo(p.x, Math.min(p.y, hz)); else { ctx.moveTo(p.x, Math.min(p.y, hz)); open = true; } } else open = false;
        });
        ctx.stroke(); setDash(ctx, NODASH); ctx.globalAlpha = 1;
      }
      extras.forEach((x, k) => {
        stroke(x.pts, 1.5, '#ffffff', k ? [6, 6] : [2, 6], 0.38);
        const top = x.pts.filter(p => p.alt > 0).sort((a, b) => b.alt - a.alt)[0], lb = str(x.e.label);
        if (top && lb) labelRaw(ctx, lb, top.x, Math.max(rect.y + 8, top.y - 9), 'center', 11, false, 'rgba(255,255,255,0.78)', null, 90, 'rgba(8,12,24,0.6)');
      });
      stroke(main, 2.5, '#ffe27a', [9, 6], 0.9);
      /* Stundenmarken (nur wenn t mitgeliefert, gerade Stunden) */
      if (Array.isArray(path.t) && path.t.length === (path.alt || []).length) {
        ctx.fillStyle = '#ffe27a';
        main.forEach(p => {
          const th = path.t[p.i];
          if (afin(th) && p.alt > 1 && Math.abs(th - Math.round(th)) < 0.03 && Math.round(th) % 2 === 0) {
            ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, TAU); ctx.fill();
            labelRaw(ctx, Math.round(th) + ' h', p.x, p.y + 12, 'center', 11, false, '#fff3c4', null, 40, 'rgba(8,12,24,0.7)');
          }
        });
      }
      if (hasNow) {
        const q = sunPos(rect, now.alt, now.az);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, TAU); ctx.stroke();
      }
    });
  }

  /* ------------------------------------------------------------------ Wolken (5.4 Nr. 3a) */
  function cloudLayout(c, seed, t, w, h, reduced) {
    c = fin(c) ? cl(c, 0, 1) : 0;
    if (c < 0.02 || !fin(w) || !fin(h) || w < 1 || h < 1) return [];
    const n = Math.max(1, Math.round(c * 8)), r = rng(fin(seed) ? Math.floor(Math.abs(seed)) + 7 : 8), out = [];
    const tt = reduced || !fin(t) ? 0 : t;
    for (let g = 0; g < n; g++) {
      const x0 = r(), y0 = r(), sc = r(), sp = r(), pj = [r(), r(), r(), r(), r()];
      const sz = w * 0.06 * (0.8 + 0.7 * sc) * (1 + 0.8 * c), span = w * 1.5;
      const x = (((x0 * span + tt * (4 + 7 * sp)) % span) + span) % span - w * 0.25;
      const puffs = [];
      for (let k = 0; k < 5; k++) {
        const rx = sz * (0.55 + 0.35 * pj[k]);
        puffs.push({ dx: (k - 2) * sz * 0.52, dy: -Math.abs(k - 2) * sz * 0.1 - (k === 2 ? sz * 0.12 : 0), rx, ry: rx * 0.58 });
      }
      out.push({ x, y: h * (0.1 + 0.3 * y0), s: sz, puffs });
    }
    return out;
  }
  function clouds(ctx, rect, o) {
    if (!okCtx(ctx) || !rectOk(rect)) return false;
    o = obj(o);
    const c = nz(o, 'c', 0, 0, 1), light = nz(o, 'light', 1, 0, 1);
    if (c < 0.02) return false;
    const gr = cloudLayout(c, o.seed, o.t, rect.w, rect.h, !!o.reduced);
    return draw(ctx, () => {
      const g = Math.round(255 - 95 * Math.pow(c, 1.4)), base = '#' + [g, g, Math.min(255, g + 6)].map(v => ('0' + v.toString(16)).slice(-2)).join('');
      const col = dim(base, 0.25 + 0.75 * light), shade = dim(mix(base, '#6c7a8c', 0.5), 0.25 + 0.75 * light);
      if (c >= 0.85) { ctx.fillStyle = rgba(dim('#8d98a6', 0.3 + 0.7 * light), 0.5 * (c - 0.7) / 0.3 + 0.1); ctx.fillRect(rect.x, rect.y, rect.w, rect.h); }
      gr.forEach(q => {
        ctx.fillStyle = rgba(shade, 0.55); ctx.beginPath(); ellipse(ctx, rect.x + q.x, rect.y + q.y + q.s * 0.2, q.s * 1.55, q.s * 0.42); ctx.fill();
        ctx.fillStyle = rgba(col, 0.92);
        q.puffs.forEach(p => { ctx.beginPath(); ellipse(ctx, rect.x + q.x + p.dx, rect.y + q.y + p.dy, p.rx, p.ry); ctx.fill(); });
      });
    });
  }

  /* ------------------------------------------------------------------ Boden, Schatten */
  function ground(ctx, rect, o) {
    if (!okCtx(ctx) || !rectOk(rect)) return false;
    o = obj(o);
    const light = nz(o, 'light', 1, 0, 1), snow = !!o.snow;
    return draw(ctx, () => {
      const far = dim(snow ? '#d7e1ea' : '#6f9a5a', 0.2 + 0.8 * light), near = dim(snow ? '#f4f8fb' : '#3f7a3c', 0.18 + 0.82 * light);
      ctx.fillStyle = lin(ctx, 0, rect.y, 0, rect.y + rect.h, [[0, far], [1, near]]);
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
      const hz = goodColor(o.haze) ? o.haze : '#b9d3e8';
      ctx.fillStyle = lin(ctx, 0, rect.y, 0, rect.y + Math.min(rect.h * 0.25, 40), [[0, rgba(hz, 0.4 * (0.3 + 0.7 * light))], [1, rgba(hz, 0)]]);
      ctx.fillRect(rect.x, rect.y, rect.w, Math.min(rect.h * 0.25, 40));
      ctx.strokeStyle = rgba(snow ? '#ffffff' : '#2d5e2f', 0.22 * light + 0.05); ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 6; i++) { const yy = rect.y + rect.h * Math.pow(i / 7, 1.6); ctx.moveTo(rect.x, yy); ctx.lineTo(rect.x + rect.w, yy); }
      ctx.stroke();
    });
  }
  function shadow(ctx, pts, o) {
    const p = normPts(pts);
    if (!okCtx(ctx) || !p || p.length < 3) return false;
    o = obj(o);
    const a = nz(o, 'alpha', 0.35, 0, 1), soft = nz(o, 'soft', 8, 0, 60), col = goodColor(o.color) ? o.color : '#0a1020';
    return draw(ctx, () => {
      ctx.lineJoin = 'round';
      if (soft > 0.5) {
        ctx.strokeStyle = rgba(col, a * 0.14); ctx.lineWidth = soft * 2; poly(ctx, p, true); ctx.stroke();
        ctx.strokeStyle = rgba(col, a * 0.22); ctx.lineWidth = soft; poly(ctx, p, true); ctx.stroke();
      }
      ctx.fillStyle = rgba(col, a); poly(ctx, p, true); ctx.fill();
    });
  }

  /* ------------------------------------------------------------------ Haus */
  function houseGeom(x, y, w, h, o) {
    if (!fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 20 || h < 20) return null;
    o = obj(o);
    const kind = o.kind === 'wohnhaus' ? 'wohnhaus' : 'gartenhaus';
    const rh = Math.max(8, h * 0.07), ov = kind === 'wohnhaus' ? 10 : 6;
    const body = { x, y: y + rh, w, h: h - rh };
    const c = obj(o.cut);
    const cut = fin(c.x) && fin(c.y) && fin(c.w) && fin(c.h) && c.w > 4 && c.h > 4 ? { x: c.x, y: c.y, w: c.w, h: c.h }
      : { x: body.x + body.w * 0.22, y: body.y + body.h * 0.1, w: body.w * 0.56, h: body.h * 0.8 };
    const wy = body.y + body.h * 0.18, wh = body.h * 0.34;
    const windows = [{ x: body.x + body.w * 0.04, y: wy, w: body.w * 0.14, h: wh }, { x: body.x + body.w * 0.82, y: wy, w: body.w * 0.14, h: wh }];
    return { kind, x, y, w, h, body, roof: { x: x - ov, y, w: w + 2 * ov, h: rh }, rackY: y, groundY: y + h, cx: x + w / 2, cut, windows,
      chimney: kind === 'wohnhaus' ? { x: x + w * 0.80, y: y - h * 0.16, w: w * 0.05, h: h * 0.16 + 2 } : null, extra: o.extra && fin(o.extra) ? o.extra : 0 };
  }
  function house(ctx, x, y, w, h, o) {
    if (!okCtx(ctx)) return false;
    o = obj(o);
    const g = houseGeom(x, y, w, h, o);
    if (!g) return false;
    const lit = nz(o, 'lit', 0, 0, 1), light = nz(o, 'light', 1, 0, 1), cutaway = o.cutaway !== false;
    return draw(ctx, () => {
      const wall = g.kind === 'wohnhaus' ? '#e6dcc8' : '#b98a5a', roof = g.kind === 'wohnhaus' ? '#8a4b3a' : '#5d6670';
      if (g.chimney) { ctx.fillStyle = dim('#7a5a4a', 0.25 + 0.75 * light); ctx.fillRect(g.chimney.x, g.chimney.y, g.chimney.w, g.chimney.h); }
      ctx.fillStyle = dim(wall, 0.25 + 0.75 * light); ctx.fillRect(g.body.x, g.body.y, g.body.w, g.body.h);
      if (g.kind === 'gartenhaus') { /* Bretterfugen */
        ctx.strokeStyle = rgba('#5a3d22', 0.35 * light + 0.1); ctx.lineWidth = 1; ctx.beginPath();
        const n = Math.max(3, Math.floor(g.body.w / 18));
        for (let i = 1; i < n; i++) { const xx = g.body.x + g.body.w * i / n; ctx.moveTo(xx, g.body.y); ctx.lineTo(xx, g.body.y + g.body.h); }
        ctx.stroke();
      }
      ctx.fillStyle = dim(roof, 0.25 + 0.75 * light); ctx.fillRect(g.roof.x, g.roof.y, g.roof.w, g.roof.h);
      ctx.fillStyle = rgba('#ffffff', 0.18 * light); ctx.fillRect(g.roof.x, g.roof.y, g.roof.w, 2);
      g.windows.forEach(wd => {
        ctx.fillStyle = lit > 0 ? lin(ctx, 0, wd.y, 0, wd.y + wd.h, [[0, mix('#fff0b0', '#ffd45a', 0.3)], [1, '#ffb83a']]) : dim('#6f93b3', 0.2 + 0.5 * light);
        ctx.globalAlpha = lit > 0 ? 0.35 + 0.65 * lit : 1; ctx.fillRect(wd.x, wd.y, wd.w, wd.h); ctx.globalAlpha = 1;
        if (lit > 0.05) { ctx.fillStyle = rgba('#ffd45a', 0.18 * lit); ctx.fillRect(wd.x - 5, wd.y - 5, wd.w + 10, wd.h + 10); }
        ctx.strokeStyle = dim('#f2f2f2', 0.3 + 0.7 * light); ctx.lineWidth = 2; ctx.strokeRect(wd.x, wd.y, wd.w, wd.h);
        ctx.beginPath(); ctx.moveTo(wd.x + wd.w / 2, wd.y); ctx.lineTo(wd.x + wd.w / 2, wd.y + wd.h); ctx.moveTo(wd.x, wd.y + wd.h / 2); ctx.lineTo(wd.x + wd.w, wd.y + wd.h / 2); ctx.stroke();
      });
      if (cutaway) { /* aufgeschnitten: Blick in den Technikraum */
        const c = g.cut;
        ctx.fillStyle = lin(ctx, 0, c.y, 0, c.y + c.h, [[0, dim('#2a3340', 0.4 + 0.6 * light)], [1, dim('#1c232d', 0.4 + 0.6 * light)]]);
        ctx.fillRect(c.x, c.y, c.w, c.h);
        ctx.fillStyle = dim('#59636f', 0.4 + 0.6 * light); ctx.fillRect(c.x, c.y + c.h - 6, c.w, 6);
        ctx.strokeStyle = dim('#e8e2d4', 0.4 + 0.6 * light); ctx.lineWidth = 3; ctx.strokeRect(c.x, c.y, c.w, c.h);
      }
      ctx.fillStyle = rgba('#000000', 0.2); ctx.fillRect(g.body.x, g.body.y + g.body.h - 3, g.body.w, 3);
    });
  }
  function convexHull(pts) {
    const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  /* Schatten am Boden (5.4 Nr. 5): Laenge H/tan(alt), hoechstens 6 H, Richtung entgegen dem Azimut (Blick nach Sueden:
   * Sonne im Sueden -> Schatten faellt zum Betrachter, Sonne im Westen -> Schatten nach links); Bodenebene in der Tiefe gestaucht. */
  function houseShadow(g, alt, az, o) {
    if (!g || typeof g !== 'object' || !fin(g.x) || !fin(g.w) || !fin(g.groundY) || !fin(g.h) || !afin(alt) || !afin(az) || alt <= 0.5) return null;
    o = obj(o);
    const H = g.h + (fin(g.extra) ? g.extra : 0), maxLen = fin(o.maxLen) && o.maxLen > 0 ? o.maxLen : 6 * H;
    const L = Math.min(H / Math.tan(alt * DEG), 6 * H, maxLen);
    const dx = -Math.sin(az * DEG) * L, dy = Math.cos(az * DEG) * L * 0.32, dep = Math.min(g.w * 0.12, 30);
    const x0 = g.x, x1 = g.x + g.w, yb = g.groundY, b = obj(o.bounds);
    const bx0 = fin(b.x0) ? b.x0 : -Infinity, bx1 = fin(b.x1) ? b.x1 : Infinity, by0 = fin(b.y0) ? b.y0 : -Infinity, by1 = fin(b.y1) ? b.y1 : Infinity;
    const base = [[x0, yb - dep], [x1, yb - dep], [x1, yb], [x0, yb]];
    const all = base.concat(base.map(p => [p[0] + dx, p[1] + dy])).map(p => [cl(p[0], bx0, bx1), cl(p[1], by0, by1)]);
    const hull = convexHull(all);
    return hull.length >= 3 ? hull : null;
  }

  /* ------------------------------------------------------------------ Modul / Zellraster (5.4 Nr. 7) */
  const panelApparent = beta => (afin(beta) ? cl(Math.sin((cl(beta, 0, 90) + 20) * DEG), 0.2, 1) : 0.6);
  function moduleQuad(cx, yb, w, len, beta, az) {
    if (!fin(cx) || !fin(yb) || !fin(w) || !fin(len) || w <= 0 || len <= 0) return null;
    const b = afin(beta) ? cl(beta, 0, 90) : 35, a = afin(az) ? cl(az, -90, 90) : 0;
    const hApp = len * panelApparent(b), wi = w * Math.max(0.35, Math.cos(a * DEG)), sk = Math.sin(a * DEG) * w * 0.08;
    const topW = wi * (1 - 0.1 * Math.sin(b * DEG));
    return [[cx - topW / 2, yb - hApp - sk], [cx + topW / 2, yb - hApp + sk], [cx + wi / 2, yb + sk], [cx - wi / 2, yb - sk]];
  }
  /* Zellfarbe nach Zelltemperatur: kalt blau, 25 Grad dunkelblau (normal), heiss rot (5.4 Nr. 7) */
  const TC_STOPS = [[-20, '#4fa3ff'], [0, '#2f78d8'], [25, '#1d3f80'], [45, '#6a3a6a'], [70, '#c8452c']];
  function tempColor(T) {
    const v = afin(T) ? cl(T, -20, 70) : 25;
    let i = 1; while (i < TC_STOPS.length - 1 && TC_STOPS[i][0] < v) i++;
    const a = TC_STOPS[i - 1], b = TC_STOPS[i];
    return mix(a[1], b[1], cl((v - a[0]) / (b[0] - a[0]), 0, 1));
  }
  const cellIndex = (xf, yf, cols, rows) => (fin(xf) && fin(yf) && fin(cols) && fin(rows) && cols >= 1 && rows >= 1 ?
    cl(Math.floor((1 - cl(yf, 0, 0.999999)) * rows), 0, rows - 1) * Math.round(cols) + cl(Math.floor(cl(xf, 0, 0.999999) * cols), 0, Math.round(cols) - 1) : -1);
  function quadOk(q) {
    if (!Array.isArray(q) || q.length !== 4) return false;
    for (let i = 0; i < 4; i++) { if (!Array.isArray(q[i]) || !fin(q[i][0]) || !fin(q[i][1])) return false; }
    let a = 0; for (let i = 0; i < 4; i++) { const p = q[i], r = q[(i + 1) % 4]; a += p[0] * r[1] - r[0] * p[1]; }
    return Math.abs(a) / 2 >= 16;
  }
  function panelQuad(ctx, quad, o) {
    if (!okCtx(ctx) || !quadOk(quad)) return false;
    o = obj(o);
    const cols = Math.round(nz(o, 'cols', 6, 1, 24)), rows = Math.round(nz(o, 'rows', 10, 1, 24)), subs = Math.round(nz(o, 'subs', 3, 1, 6));
    const orient = o.orient === 'quer' ? 'quer' : 'hochkant', full = o.detail !== 'low';
    const t = fin(o.t) ? o.t : 0, reduced = !!o.reduced, temp = fin(o.temp) ? o.temp : 25;
    const shade = Array.isArray(o.shade) ? o.shade : [], hot = Array.isArray(o.hot) ? o.hot : [];
    const TL = quad[0], TR = quad[1], BR = quad[2], BL = quad[3];
    const P = (u, v) => [(1 - v) * ((1 - u) * TL[0] + u * TR[0]) + v * ((1 - u) * BL[0] + u * BR[0]), (1 - v) * ((1 - u) * TL[1] + u * TR[1]) + v * ((1 - u) * BL[1] + u * BR[1])];
    const poly4 = (u0, v0, u1, v1) => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
    return draw(ctx, () => {
      ctx.lineJoin = 'round';
      ctx.fillStyle = tempColor(temp); poly(ctx, quad, true); ctx.fill();
      /* Sonnenglanz: schraeger Streifen, laeuft ueber das Modul (geklippt aufs Viereck) */
      const gl = o.glint === false ? 0 : nz(o, 'glint', 1, 0, 1);
      if (gl > 0) {
        ctx.save(); poly(ctx, quad, true); ctx.clip();
        const u0 = reduced ? 0.3 : ((t * 0.12) % 1.5) - 0.3;
        ctx.fillStyle = rgba('#ffffff', 0.2 * gl); poly(ctx, [P(u0, 0), P(u0 + 0.1, 0), P(u0 - 0.05, 1), P(u0 - 0.15, 1)], true); ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = 'rgba(190,210,240,0.38)'; ctx.lineWidth = 1; ctx.beginPath();
      for (let c = 1; c < cols; c++) { const a = P(c / cols, 0), b = P(c / cols, 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      for (let r = 1; r < rows; r++) { const a = P(0, r / rows), b = P(1, r / rows); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.stroke();
      if (full) { /* Sammelschienen (zwei je Spalte) und Finger (eine Linie je Zeile) */
        ctx.strokeStyle = 'rgba(225,232,245,0.42)'; ctx.lineWidth = 0.8; ctx.beginPath();
        for (let c = 0; c < cols; c++) [1 / 3, 2 / 3].forEach(f => { const a = P((c + f) / cols, 0), b = P((c + f) / cols, 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
        for (let r = 0; r < rows; r++) { const a = P(0, (r + 0.5) / rows), b = P(1, (r + 0.5) / rows); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        ctx.stroke();
      }
      /* Teilstraenge: dicke Trennlinien */
      if (subs > 1) {
        ctx.strokeStyle = 'rgba(10,18,36,0.92)'; ctx.lineWidth = 2.4; ctx.beginPath();
        for (let k = 1; k < subs; k++) {
          if (orient === 'hochkant') { const a = P(k / subs, 0), b = P(k / subs, 1); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
          else { const a = P(0, k / subs), b = P(1, k / subs); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
        }
        ctx.stroke();
      }
      /* Verschattung: Zellen je Zeile zu Laeufen gleicher Stufe zusammengefasst (wenige Aufrufe), dazu Schraffur */
      const lvl = s => (!afin(s) || s >= 0.95 ? 0 : s < 0.2 ? 3 : s < 0.6 ? 2 : 1), alphaOf = [0, 0.3, 0.52, 0.8];
      const runs = [[], [], [], []];
      for (let r = 0; r < rows; r++) {
        let c = 0;
        while (c < cols) {
          const L = lvl(shade[r * cols + c]);
          if (L === 0) { c++; continue; }
          let e = c + 1; while (e < cols && lvl(shade[r * cols + e]) === L) e++;
          runs[L].push([r, c, e]); c = e;
        }
      }
      for (let L = 1; L <= 3; L++) {
        if (!runs[L].length) continue;
        ctx.fillStyle = rgba('#06101e', alphaOf[L]); ctx.beginPath();
        runs[L].forEach(q => { const pp = poly4(q[1] / cols, q[0] / rows, q[2] / cols, (q[0] + 1) / rows); ctx.moveTo(pp[0][0], pp[0][1]); ctx.lineTo(pp[1][0], pp[1][1]); ctx.lineTo(pp[2][0], pp[2][1]); ctx.lineTo(pp[3][0], pp[3][1]); ctx.closePath(); });
        ctx.fill();
        if (L >= 2) {
          ctx.strokeStyle = rgba('#cfd8e6', 0.32); ctx.lineWidth = 1; ctx.beginPath();
          runs[L].forEach(q => {
            const u0 = q[1] / cols, u1 = q[2] / cols, v0 = q[0] / rows, v1 = (q[0] + 1) / rows;
            [0, 0.5].forEach(f => { const a = P(lerp(u0, u1, f), v1), b = P(lerp(u0, u1, f + 0.5), v0); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); });
          });
          ctx.stroke();
        }
      }
      /* Hotspot: pulsierender Kreisverlauf, Rauch bei Fehler */
      let smoke = 3;
      hot.slice(0, 4).forEach(hs => {
        const cell = typeof hs === 'number' ? hs : hs && typeof hs === 'object' ? hs.cell : NaN;
        if (!fin(cell) || cell < 0 || cell >= cols * rows) return;
        const lv = typeof hs === 'object' && fin(hs.level) ? cl(hs.level, 0, 1) : 0.7, er = typeof hs === 'object' && !!hs.error;
        const r = Math.floor(cell / cols), c = cell % cols, m = P((c + 0.5) / cols, (r + 0.5) / rows);
        const a = P(c / cols, r / rows), b = P((c + 1) / cols, (r + 1) / rows), cr = Math.max(4, Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.75) * (reduced ? 1 : 1 + 0.15 * Math.sin(t * 6));
        ctx.fillStyle = rad(ctx, m[0], m[1], 0, cr, [[0, rgba('#fff2e0', 0.95)], [0.35, rgba(er ? '#ff3b2e' : '#ff8a2a', 0.85)], [1, rgba('#ff5a1f', 0)]]);
        ctx.globalAlpha = 0.45 + 0.55 * lv; ctx.beginPath(); ctx.arc(m[0], m[1], cr, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
        if (er && smoke > 0) {
          for (let k = 0; k < 3 && smoke > 0; k++, smoke--) {
            const ph = reduced ? k / 3 : ((t * 0.5 + k / 3) % 1);
            ctx.fillStyle = rgba('#8a8f98', 0.45 * (1 - ph)); ctx.beginPath(); ctx.arc(m[0] + Math.sin(ph * 6 + k) * 5, m[1] - 6 - ph * 28, 3 + ph * 5, 0, TAU); ctx.fill();
          }
        }
      });
      ctx.strokeStyle = 'rgba(200,210,222,0.9)'; ctx.lineWidth = 2.5; poly(ctx, quad, true); ctx.stroke();
      /* Bypassdioden je Teilstrang (hochkant unter dem Modul, quer rechts daneben) */
      if (Array.isArray(o.bypass) && o.bypass.length) {
        const bs = Math.min(18, Math.max(10, Math.hypot(TR[0] - TL[0], TR[1] - TL[1]) / Math.max(3, subs * 3.2)));
        o.bypass.slice(0, 6).forEach((b, k) => {
          const bb = obj(b), n = Math.min(subs, o.bypass.length);
          let q;
          if (orient === 'hochkant') { q = P((k + 0.5) / n, 1); q = [q[0], q[1] + bs * 0.9]; } else { q = P(1, (k + 0.5) / n); q = [q[0] + bs * 1.1, q[1]]; }
          bypass(ctx, q[0], q[1], { on: !!bb.on, state: bb.state, size: bs, caption: o.captions === true, t, reduced });
        });
      }
    });
  }
  function panelGrid(ctx, x, y, w, h, o) {
    if (!fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 8 || h < 8) return false;
    return panelQuad(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], o);
  }

  /* ------------------------------------------------------------------ Bypassdiode */
  function bypass(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o);
    const s = nz(o, 'size', 18, 8, 80), on = !!o.on, st = o.state === 'kurz' || o.state === 'fehlt' ? o.state : 'ok';
    const t = fin(o.t) ? o.t : 0, reduced = !!o.reduced, cap = o.caption !== false;
    return draw(ctx, () => {
      const col = st !== 'ok' ? '#ff5c5c' : on ? '#ffd54a' : '#8d99a6';
      if (on && st === 'ok') {
        ctx.fillStyle = rad(ctx, x, y, 0, s * 1.3, [[0, rgba('#ffd54a', 0.7)], [1, rgba('#ffd54a', 0)]]);
        ctx.beginPath(); ctx.arc(x, y, s * 1.3, 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = Math.max(1.5, s * 0.1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (st === 'fehlt') setDash(ctx, [3, 3]);
      ctx.beginPath(); ctx.moveTo(x - s * 0.85, y); ctx.lineTo(x - s * 0.32, y); ctx.moveTo(x + s * 0.32, y); ctx.lineTo(x + s * 0.85, y); ctx.stroke();
      poly(ctx, [[x - s * 0.32, y - s * 0.34], [x - s * 0.32, y + s * 0.34], [x + s * 0.32, y]], true);
      if (st === 'ok' && on) ctx.fill(); else ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + s * 0.32, y - s * 0.38); ctx.lineTo(x + s * 0.32, y + s * 0.38); ctx.stroke();
      setDash(ctx, NODASH);
      if (st !== 'ok') { ctx.beginPath(); ctx.moveTo(x - s * 0.5, y - s * 0.5); ctx.lineTo(x + s * 0.5, y + s * 0.5); ctx.moveTo(x + s * 0.5, y - s * 0.5); ctx.lineTo(x - s * 0.5, y + s * 0.5); ctx.stroke(); }
      if (on && st === 'ok') { /* Strompfeil: laeuft durch die Diode */
        const ph = reduced ? 0.5 : (t * 1.4) % 1, ax = x - s * 0.85 + ph * s * 1.7;
        ctx.fillStyle = '#ffffff'; poly(ctx, [[ax + s * 0.12, y - s * 0.62], [ax - s * 0.08, y - s * 0.72], [ax - s * 0.08, y - s * 0.52]], true); ctx.fill();
      }
      if (cap) labelRaw(ctx, st === 'kurz' ? 'Kurzschluss' : st === 'fehlt' ? 'fehlt' : on ? 'leitet' : 'sperrt', x, y + s * 0.95 + 6, 'center', 11, false, col === '#8d99a6' ? '#d5dde6' : col, null, 0, 'rgba(8,12,24,0.75)');
    });
  }

  /* ------------------------------------------------------------------ Querschnitt durch das Modul (5.3.1 Aufbau) */
  function crossSection(ctx, rect, build, o) {
    if (!okCtx(ctx) || !rectOk(rect, 160, 120) || !Array.isArray(build) || build.length < 3 || build.length > 30) return false;
    const items = build.map(b => obj(b));
    if (!items.every(b => str(b.name) !== '' && fin(b.mm) && b.mm > 0)) return false;
    o = obj(o);
    const nPh = Math.round(nz(o, 'photons', 5, 0, 8)), t = fin(o.t) ? o.t : 0, reduced = !!o.reduced, lb = obj(o.labels);
    const T = k => (str(lb[k]) || { photon: 'Licht', n: 'n-Schicht (−)', p: 'p-Schicht (+)', field: 'Feld', current: 'Strom' }[k]);
    const idOf = b => (str(b.id) + ' ' + str(b.name)).toLowerCase();
    const frame = items.find(b => /rahmen/.test(idOf(b))), box = items.find(b => /dose/.test(idOf(b)));
    const stack = items.filter(b => b !== frame && b !== box);
    if (stack.length < 2) return false;
    return draw(ctx, () => {
      const x0 = rect.x + 10, x1 = rect.x + rect.w * 0.6, top = rect.y + rect.h * 0.3, avail = rect.h * 0.46;
      const wts = stack.map(b => Math.sqrt(b.mm)), sum = wts.reduce((a, b) => a + b, 0), minH = 13;
      let hs = wts.map(v => Math.max(minH, v / sum * avail));
      const tot = hs.reduce((a, b) => a + b, 0); if (tot > avail * 1.25) hs = hs.map(v => v * avail * 1.25 / tot);
      const colOf = b => { const s = idOf(b); return /glas/.test(s) ? '#9fd0ee' : /eva|einbett/.test(s) ? '#f0e2a0' : /zelle/.test(s) ? '#1d3f80' : /folie|r.ck/.test(s) ? '#e8ecef' : '#aab4be'; };
      let y = top, cellY0 = NaN, cellY1 = NaN; const ys = [];
      stack.forEach((b, i) => {
        const h = hs[i], isCell = /zelle/.test(idOf(b));
        ctx.fillStyle = colOf(b); ctx.globalAlpha = /glas|eva/.test(idOf(b)) ? 0.75 : 1; ctx.fillRect(x0, y, x1 - x0, h); ctx.globalAlpha = 1;
        if (isCell) {
          ctx.fillStyle = '#3a7bd5'; ctx.fillRect(x0, y, x1 - x0, h * 0.3);          /* n oben */
          ctx.fillStyle = '#1b2f66'; ctx.fillRect(x0, y + h * 0.3, x1 - x0, h * 0.7);   /* p unten */
          ctx.strokeStyle = '#e8d27a'; ctx.lineWidth = 2; ctx.beginPath();            /* Finger und Sammelschiene oben */
          for (let k = 0; k < 9; k++) { const fx = x0 + (x1 - x0) * (k + 0.5) / 9; ctx.moveTo(fx, y - 2.5); ctx.lineTo(fx, y); }
          ctx.stroke(); ctx.fillStyle = '#e8d27a'; ctx.fillRect(x0, y - 3, x1 - x0, 1.5);
          cellY0 = y; cellY1 = y + h;
        }
        ctx.strokeStyle = 'rgba(10,18,36,0.55)'; ctx.lineWidth = 1; ctx.strokeRect(x0, y, x1 - x0, h);
        ys.push([y, h]); y += h;
      });
      const bottom = y;
      if (frame) { ctx.fillStyle = '#b4bdc7'; ctx.fillRect(x0 - 8, top - 6, 8, bottom - top + 12); ctx.fillRect(x1, top - 6, 8, bottom - top + 12); }
      if (box) { ctx.fillStyle = '#39424d'; ctx.fillRect(x1 - 52, bottom + 2, 52, 22); ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 1.5; ctx.strokeRect(x1 - 52, bottom + 2, 52, 22); }
      /* Beschriftung rechts mit Fuehrungslinien */
      const lx = x1 + 22, maxw = rect.x + rect.w - lx - 4;
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(200,210,222,0.5)';
      stack.forEach((b, i) => {
        const yc = ys[i][0] + ys[i][1] / 2;
        ctx.beginPath(); ctx.moveTo(x1 + 2, yc); ctx.lineTo(lx - 3, yc); ctx.stroke();
        labelRaw(ctx, str(b.name) + ' ' + fz(b.mm, b.mm < 1 ? 2 : 1) + ' mm', lx, yc, 'left', 11, false, '#eef3f8', null, maxw, 'rgba(8,12,24,0.75)');
      });
      if (frame) labelRaw(ctx, str(frame.name), x0 - 8, top - 14, 'left', 11, false, '#eef3f8', null, rect.w * 0.5, 'rgba(8,12,24,0.75)');
      if (box) labelRaw(ctx, str(box.name), x1 - 56, bottom + 13, 'right', 11, false, '#eef3f8', null, rect.w * 0.45, 'rgba(8,12,24,0.75)');
      if (isFinite(cellY0)) {
        labelRaw(ctx, T('n'), x0 + 4, cellY0 + (cellY1 - cellY0) * 0.15, 'left', 11, true, '#ffffff', null, (x1 - x0) * 0.8, 'rgba(8,12,24,0.8)');
        labelRaw(ctx, T('p'), x0 + 4, cellY0 + (cellY1 - cellY0) * 0.65, 'left', 11, true, '#ffffff', null, (x1 - x0) * 0.8, 'rgba(8,12,24,0.8)');
        /* Photonen mit Elektron-Loch-Paaren */
        const pj = (cellY0 + (cellY1 - cellY0) * 0.3);
        for (let k = 0; k < nPh; k++) {
          const fx = x0 + (x1 - x0) * (k + 0.5) / nPh, ph = reduced ? ((k * 0.37) % 1) : ((t * 0.45 + k * 0.37) % 1), yy = lerp(rect.y + 6, cellY0 - 4, ph);
          ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 2; ctx.beginPath();
          ctx.moveTo(fx - 8, rect.y + 6); ctx.lineTo(fx - 4, lerp(rect.y + 6, yy, 0.33)); ctx.lineTo(fx - 12 + 8, lerp(rect.y + 6, yy, 0.66)); ctx.lineTo(fx, yy); ctx.stroke();
          ctx.fillStyle = '#ffd54a'; poly(ctx, [[fx, yy + 6], [fx - 4, yy - 2], [fx + 4, yy - 2]], true); ctx.fill();
          const sp = reduced ? 0.5 : (t * 0.8 + k * 0.21) % 1, d = 3 + sp * Math.max(2, (cellY1 - cellY0) * 0.3);
          ctx.fillStyle = '#4fa3ff'; ctx.beginPath(); ctx.arc(fx, pj - d, 3.4, 0, TAU); ctx.fill();
          ctx.fillStyle = '#ff6b6b'; ctx.beginPath(); ctx.arc(fx, pj + d, 3.4, 0, TAU); ctx.fill();
        }
        if (nPh > 0) labelRaw(ctx, T('photon'), x0 + 6, rect.y + 14, 'left', 11, true, '#ffe9a0', null, 100, 'rgba(8,12,24,0.8)');
        /* Feld des pn-Uebergangs und Stromweg */
        arrowRaw(ctx, x1 - 18, cellY0 + (cellY1 - cellY0) * 0.55, x1 - 18, cellY0 + (cellY1 - cellY0) * 0.05, 9, '#ffffff', 2, null);
        labelRaw(ctx, T('field'), x1 - 24, cellY0 + (cellY1 - cellY0) * 0.3, 'right', 11, false, '#ffffff', null, 60, 'rgba(8,12,24,0.8)');
        if (box) {
          const ex = x1 + 12;
          ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 2.5; setDash(ctx, [7, 4], reduced ? 0 : -t * 20);
          poly(ctx, [[x0 + 4, cellY0 - 8], [ex, cellY0 - 8], [ex, bottom + 14], [x1, bottom + 14]], false); ctx.stroke(); setDash(ctx, NODASH, 0);
          labelRaw(ctx, T('current'), ex + 4, (cellY0 + bottom) / 2, 'left', 11, false, '#bfe8ff', null, maxw, 'rgba(8,12,24,0.8)');
        }
      }
    });
  }

  /* ------------------------------------------------------------------ Strahlen (5.4 Nr. 4) */
  function clipSegRect(ax, ay, bx, by, r) { /* Eintrittsparameter s (0..1) der Strecke a->b in das Rechteck, sonst -1 */
    let s0 = 0, s1 = 1; const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
      if (p === 0) { if (q < 0) return -1; } else { const u = q / p; if (p < 0) { if (u > s1) return -1; if (u > s0) s0 = u; } else { if (u < s0) return -1; if (u < s1) s1 = u; } }
    }
    return s0 <= s1 ? s0 : -1;
  }
  function rays(ctx, from, to, o) {
    if (!okCtx(ctx) || !from || typeof from !== 'object' || !fin(from.x) || !fin(from.y) || !to || typeof to !== 'object' ||
      !fin(to.x0) || !fin(to.y0) || !fin(to.x1) || !fin(to.y1)) return false;
    const L = Math.hypot(to.x1 - to.x0, to.y1 - to.y0), mx = (to.x0 + to.x1) / 2, my = (to.y0 + to.y1) / 2, dist = Math.hypot(from.x - mx, from.y - my);
    if (!(L > 2) || !(dist > 12)) return false;
    o = obj(o);
    const gb = nz(o, 'gb', 0, 0, 5000), gd = nz(o, 'gd', 0, 0, 5000), gr = nz(o, 'gr', 0, 0, 5000), t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    const bud = o.budget && typeof o.budget === 'object' && fin(o.budget.n) ? o.budget : { n: 1e9 };
    const ob = rectOk(o.obstacle, 1, 1) ? o.obstacle : null;
    if (gb < 1 && gd < 1 && gr < 1 && !fin(o.aoi)) return false;
    return draw(ctx, () => {
      const d = [(from.x - mx) / dist, (from.y - my) / dist];
      let nx = -(to.y1 - to.y0) / L, ny = (to.x1 - to.x0) / L; if (nx * d[0] + ny * d[1] < 0) { nx = -nx; ny = -ny; }
      const pt = f => [lerp(to.x0, to.x1, f), lerp(to.y0, to.y1, f)];
      if (gb >= 1) {
        const nb = 5 + Math.round(4 * cl(gb / 1000, 0, 1)), w = 1 + 6 * Math.sqrt(cl(gb / 1000, 0, 1.5));
        ctx.strokeStyle = rgba('#ffd54a', 0.78); ctx.fillStyle = '#ffe27a'; ctx.lineWidth = w; ctx.lineCap = 'butt';
        setDash(ctx, [14, 10], reduced ? 0 : -t * 50);
        for (let k = 0; k < nb; k++) {
          const E = pt((k + 0.5) / nb);
          let S = [from.x + (E[0] - mx) * 0.5, from.y + (E[1] - my) * 0.5];
          const len = Math.hypot(E[0] - S[0], E[1] - S[1]) || 1, r0 = Math.min(34, len * 0.3);
          S = [S[0] + (E[0] - S[0]) * r0 / len, S[1] + (E[1] - S[1]) * r0 / len];
          let end = E;
          if (ob) { const s = clipSegRect(S[0], S[1], E[0], E[1], ob); if (s >= 0 && s < 1) end = [S[0] + (E[0] - S[0]) * s, S[1] + (E[1] - S[1]) * s]; }
          ctx.beginPath(); ctx.moveTo(S[0], S[1]); ctx.lineTo(end[0], end[1]); ctx.stroke();
        }
        setDash(ctx, NODASH, 0);
      }
      if (gd >= 1 && bud.n > 0) {
        const nd = Math.min(bud.n, 2 + Math.round(6 * Math.sqrt(cl(gd / 250, 0, 1)))); bud.n -= nd;
        ctx.strokeStyle = rgba('#cfe8ff', 0.3 + 0.4 * Math.sqrt(cl(gd / 250, 0, 1))); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.3; ctx.beginPath();
        const heads = [];
        for (let k = 0; k < nd; k++) {
          const E = pt((k + 0.5) / nd), ang = (-70 + 140 * (k + 0.5) / nd) * DEG, dir = [d[0] * Math.cos(ang) - d[1] * Math.sin(ang), d[0] * Math.sin(ang) + d[1] * Math.cos(ang)];
          const dn = dir[0] * nx + dir[1] * ny, dd = dn < 0.2 ? [dir[0] + nx * 0.5, dir[1] + ny * 0.5] : dir, dl = Math.hypot(dd[0], dd[1]) || 1;
          const S = [E[0] + dd[0] / dl * 34, E[1] + dd[1] / dl * 34];
          ctx.moveTo(S[0], S[1]); ctx.lineTo(E[0], E[1]); heads.push([E, dd[0] / dl, dd[1] / dl]);
        }
        ctx.stroke();
        heads.forEach(h => poly(ctx, [[h[0][0], h[0][1]], [h[0][0] + h[1] * 8 - h[2] * 3.5, h[0][1] + h[2] * 8 + h[1] * 3.5], [h[0][0] + h[1] * 8 + h[2] * 3.5, h[0][1] + h[2] * 8 - h[1] * 3.5]], true) || ctx.fill());
      }
      if (gr >= 1 && bud.n > 0) {
        const nr = Math.min(bud.n, 2 + Math.round(2 * Math.sqrt(cl(gr / 60, 0, 1)))); bud.n -= nr;
        const yb = Math.max(to.y0, to.y1);
        ctx.strokeStyle = rgba('#9bd47c', 0.5); ctx.fillStyle = ctx.strokeStyle; ctx.lineWidth = 1.3; ctx.beginPath();
        for (let k = 0; k < nr; k++) { const xx = pt((k + 0.5) / nr)[0]; ctx.moveTo(xx, yb + 34); ctx.lineTo(xx, yb + 12); }
        ctx.stroke();
        for (let k = 0; k < nr; k++) { const xx = pt((k + 0.5) / nr)[0]; poly(ctx, [[xx, yb + 8], [xx - 3.5, yb + 15], [xx + 3.5, yb + 15]], true); ctx.fill(); }
      }
      if (fin(o.aoi) && o.showAngle !== false) {
        const an = Math.atan2(ny, nx), ad = Math.atan2(d[1], d[0]); let df = ((ad - an + Math.PI) % TAU + TAU) % TAU - Math.PI;
        const r = 28;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; setDash(ctx, [4, 3]); ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + nx * 44, my + ny * 44); ctx.stroke(); setDash(ctx, NODASH);
        ctx.beginPath(); ctx.arc(mx, my, r, an, an + df, df < 0); ctx.stroke();
        const mid = an + df / 2;
        labelRaw(ctx, 'Einfall ' + fz(o.aoi, 0) + '°', mx + Math.cos(mid) * (r + 8), my + Math.sin(mid) * (r + 8), Math.cos(mid) >= 0 ? 'left' : 'right', 11, true, '#ffffff', null, 110, 'rgba(8,12,24,0.8)');
      }
    });
  }

  /* ------------------------------------------------------------------ Energiefluss-Pfeile (5.4 Nr. 6, zentral) */
  /* Farbe UND Linienart UND Textschild: Solar Gold durchgezogen, Akku laden Gruen durchgezogen (+), Akku entladen Cyan gestrichelt (−),
   * Last Violett durchgezogen, Netzbezug Rot Punkt-Strich, Einspeisung Blaugruen doppelt gestrichelt, Verlust Grau gepunktet. */
  const FLOW_KINDS = {
    solar: { name: 'Solar', color: '#ffc83d', dash: [], sym: '' },
    'akku-laden': { name: 'Akku lädt', color: '#3ddc84', dash: [], sym: '+' },
    'akku-entl': { name: 'Akku entlädt', color: '#4fd8ff', dash: [10, 6], sym: '−' },
    last: { name: 'Last', color: '#c792ea', dash: [], sym: '' },
    bezug: { name: 'Netzbezug', color: '#ff6b6b', dash: [14, 4, 3, 4], sym: '' },
    einsp: { name: 'Einspeisung', color: '#2dd4bf', dash: [16, 4, 4, 4, 4, 4], sym: '' },
    verlust: { name: 'Verlust', color: '#9aa5b1', dash: [2, 5], sym: '' }
  };
  const FLOW_W_MIN = 1.5, FLOW_W_MAX = 16;
  /* Strichstaerke nach Wurzel der Leistung; unter 1 W: 0 (nicht gezeichnet) */
  function flowWidth(P, Pref) {
    if (!fin(P) || !(Math.abs(P) >= 1)) return 0;
    const pr = fin(Pref) && Pref > 0 ? Pref : 1000;
    return FLOW_W_MIN + (FLOW_W_MAX - FLOW_W_MIN) * Math.sqrt(Math.min(Math.abs(P) / pr, 1));
  }
  function flowKind(kind, P) {
    if (kind === 'akku') return P >= 0 ? 'akku-laden' : 'akku-entl';
    if (kind === 'netz') return P >= 0 ? 'einsp' : 'bezug';
    return FLOW_KINDS[kind] ? kind : 'solar';
  }
  function flow(ctx, pts, P, o) {
    if (!okCtx(ctx)) return false;
    const p = normPts(pts);
    if (!p || !(polyLen(p) > 4) || !fin(P) || !(Math.abs(P) >= 1)) return false;
    o = obj(o);
    const kk = flowKind(o.kind, P), K = FLOW_KINDS[kk], Pref = fin(o.Pref) && o.Pref > 0 ? o.Pref : 1000;
    const w = flowWidth(P, Pref), x = Math.sqrt(Math.min(Math.abs(P) / Pref, 1)), len = polyLen(p), fwd = P >= 0;
    const t = fin(o.t) ? o.t : 0, reduced = !!o.reduced, color = K.color;
    const bud = o.budget && typeof o.budget === 'object' && fin(o.budget.n) ? o.budget : null;
    const sp = lerp(36, 11, x), maxDots = Math.max(0, Math.floor(Math.min(nz(o, 'maxDots', 40, 0, 150), bud ? bud.n : 150)));
    const nDots = Math.min(maxDots, Math.max(0, Math.floor(len / sp)));
    if (bud) bud.n = Math.max(0, bud.n - nDots);
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
      const hl = Math.min(cl(7 + w * 1.15, 9, 26), len * 0.6);
      /* Linie endet an der Pfeilspitze: hinterer Teil des Linienzugs bis zur Basis der Spitze */
      let pl = p, headAt = len, dirSign = 1;
      if (!fwd) { pl = p.slice().reverse(); }
      const endPt = pointAt(pl, len), basePt = pointAt(pl, len - hl * 0.8);
      const lineEnd = []; /* Linienzug bis Basis */
      { let acc = 0; lineEnd.push(pl[0]); for (let i = 1; i < pl.length; i++) { const sl = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); if (acc + sl >= len - hl * 0.8) break; lineEnd.push(pl[i]); acc += sl; } lineEnd.push([basePt.x, basePt.y]); }
      /* dunkle Kontur fuer Lesbarkeit */
      ctx.strokeStyle = 'rgba(8,12,24,0.45)'; ctx.lineWidth = w + 3; poly(ctx, lineEnd, false); ctx.stroke();
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = w;
      const sc = Math.max(1, w / 5);
      setDash(ctx, K.dash.map(v => v * sc), reduced ? 0 : (fwd ? -t * 30 : t * 30) * 0);
      poly(ctx, lineEnd, false); ctx.stroke(); setDash(ctx, NODASH, 0);
      /* Pfeilspitze */
      const hw = hl * 0.55, ux = endPt.ux, uy = endPt.uy, bx = endPt.x - ux * hl, by = endPt.y - uy * hl;
      ctx.strokeStyle = 'rgba(8,12,24,0.45)'; ctx.lineWidth = 2; poly(ctx, [[endPt.x, endPt.y], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true); ctx.stroke();
      ctx.fillStyle = color; poly(ctx, [[endPt.x, endPt.y], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]], true); ctx.fill();
      /* laufende Punkte: konstante Geschwindigkeit, Dichte waechst mit Wurzel der Leistung */
      if (nDots > 0) {
        const spd = reduced ? 8 : 42, off = (t * spd) % sp, r = cl(w * 0.27 + 0.9, 1.4, 4.4);
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.beginPath();
        const m = Math.max(nDots, Math.floor(len / sp));
        for (let k = 0; k < Math.min(m, nDots); k++) {
          let d = (k * sp + off) % len; if (d > len - hl) d = d - (len - hl);
          const q = pointAt(pl, d); ctx.moveTo(q.x + r, q.y); ctx.arc(q.x, q.y, r, 0, TAU);
        }
        ctx.fill();
      }
      /* Textschild: Name und Leistung mit Einheit, Farbstreifen in der Farbe des Pfeils */
      if (o.label !== false) {
        const compact = !!o.compact, nm = o.name !== undefined ? str(o.name) : K.name;
        const txt = (K.sym && !compact ? K.sym + ' ' : '') + (compact || nm === '' ? '' : nm + ' ') + fmtW(P);
        const at = nz(o, 'at', 0.5, 0.05, 0.95), q = pointAt(p, len * at), off = fin(o.off) ? o.off : -(w / 2 + 11);
        const sx = Math.abs(q.uy) > Math.abs(q.ux) ? 1 : 0, lx = q.x + (sx ? -off * 0 + (off < 0 ? -(w / 2 + 6) : w / 2 + 6) : 0), ly = q.y + (sx ? 0 : off);
        font(ctx, 11, true);
        const maxw = nz(o, 'maxw', 190, 40, 600), s = fitText(ctx, txt, maxw, 11, true);
        if (s !== '') {
          const wd = tw(ctx, s, 11, true) + 12, al = sx ? (off < 0 ? 'right' : 'left') : 'center';
          const x0 = al === 'left' ? lx : al === 'right' ? lx - wd : lx - wd / 2;
          ctx.fillStyle = 'rgba(10,14,26,0.74)'; rrect(ctx, x0, ly - 9, wd, 18, 5); ctx.fill();
          ctx.fillStyle = color; ctx.fillRect(x0 + 1.5, ly - 6.5, 3, 13);
          ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(s, x0 + 7, ly);
        }
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ Akku (5.4 Nr. 8) */
  const socColor = soc => (!fin(soc) ? '#8d99a6' : soc < 0.2 ? '#ff5c5c' : soc < 0.5 ? '#ffb340' : '#3ddc84');
  function battery(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 24 || h < 24) return false;
    o = obj(o);
    const soc = nz(o, 'soc', 0.5, 0, 1), gas = nz(o, 'gas', 0, 0, 1), t = fin(o.t) ? o.t : 0, reduced = !!o.reduced, warn = !!o.warn;
    const bud = o.budget && typeof o.budget === 'object' && fin(o.budget.n) ? o.budget : null;
    return draw(ctx, () => {
      const tp = Math.max(4, h * 0.08), bx = x, by = y + tp, bw = w, bh = h - tp;
      const blink = warn && (reduced || Math.floor(t * 2.5) % 2 === 0);
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#39424d'; ctx.fillRect(x + w * 0.18, y, w * 0.2, tp + 1); ctx.fillRect(x + w * 0.62, y, w * 0.2, tp + 1);
      ctx.fillStyle = '#1c232d'; rrect(ctx, bx, by, bw, bh, 6); ctx.fill();
      /* Zellen im Schnitt */
      const n = 4, cw = (bw - 8) / n, col = socColor(soc);
      for (let i = 0; i < n; i++) {
        const cx = bx + 4 + i * cw, ih = (bh - 8);
        ctx.fillStyle = '#10151c'; ctx.fillRect(cx + 1.5, by + 4, cw - 3, ih);
        const fh = ih * soc;
        ctx.fillStyle = lin(ctx, 0, by + 4 + ih - fh, 0, by + 4 + ih, [[0, mix(col, '#ffffff', 0.25)], [1, col]]);
        ctx.fillRect(cx + 1.5, by + 4 + ih - fh, cw - 3, fh);
      }
      ctx.strokeStyle = blink ? '#ff5c5c' : '#8d99a6'; ctx.lineWidth = blink ? 3 : 2; rrect(ctx, bx, by, bw, bh, 6); ctx.stroke();
      /* Anschluesse mit Vorzeichen */
      font(ctx, 11, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.fillText('+', x + w * 0.28, y + tp * 0.5 - 0.5); ctx.fillText('−', x + w * 0.72, y + tp * 0.5 - 0.5);
      /* Gasblasen */
      if (gas > 0.02) {
        const nb = Math.min(bud ? bud.n : 8, Math.round(2 + 6 * gas)); if (bud) bud.n -= nb;
        ctx.fillStyle = 'rgba(220,240,255,0.8)'; ctx.beginPath();
        for (let k = 0; k < nb; k++) {
          const ph = reduced ? (k / nb) : ((t * 0.6 + k * 0.371) % 1), bxx = bx + 8 + ((k * 0.618) % 1) * (bw - 16), byy = by + bh - 6 - ph * (bh * (0.35 + 0.65 * soc));
          ctx.moveTo(bxx + 2.5, byy); ctx.arc(bxx, byy, 2.5, 0, TAU);
        }
        ctx.fill();
      }
      /* Ladezustand als Zahl mit Einheit im Bild (Kontur) */
      labelRaw(ctx, fz(soc * 100, 0) + ' %', x + w / 2, by + bh / 2, 'center', 12, true, '#ffffff', null, bw - 4, 'rgba(8,12,24,0.85)');
      if (fin(o.temp)) labelRaw(ctx, fz(o.temp, 0) + ' °C', x + w / 2, by + bh - 9, 'center', 11, false, '#dfe7ef', null, bw - 4, 'rgba(8,12,24,0.85)');
      if (warn) labelRaw(ctx, '! Warnung', x + w / 2, by - 1 - tp - 8, 'center', 11, true, blink ? '#ff8a80' : '#ffd0cc', null, Math.max(60, bw + 20), 'rgba(8,12,24,0.85)');
    });
  }

  /* ------------------------------------------------------------------ Regler */
  const STAGES = ['Aus', 'Bulk', 'Absorption', 'Float'];
  function controllerBox(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 40 || h < 36) return false;
    o = obj(o);
    const type = o.type === 'mppt' || o.type === 'direkt' ? o.type : 'pwm', stage = Math.round(nz(o, 'stage', 0, 0, 3)), duty = nz(o, 'duty', 0.5, 0, 1);
    const mppPos = nz(o, 'mpp', 0.7, 0, 1), dead = !!o.dead, t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    return draw(ctx, () => {
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#4a5560'; rrect(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 2; ctx.stroke();
      /* Display */
      const dx = x + 4, dy = y + 4, dw = w - 8, dh = h * 0.42;
      ctx.fillStyle = dead ? '#2a1010' : '#0f2a1c'; ctx.fillRect(dx, dy, dw, dh);
      if (!dead && type !== 'direkt') {
        const l1 = (fin(o.uv) ? fz(o.uv, 1) : '–') + ' V  ' + (fin(o.ii) ? fz(o.ii, 1) : '–') + ' A';
        labelRaw(ctx, l1, dx + dw / 2, dy + dh * 0.32, 'center', 11, true, '#7dffb0', null, dw - 2, null);
        labelRaw(ctx, STAGES[stage], dx + dw / 2, dy + dh * 0.74, 'center', 11, false, '#bff5d4', null, dw - 2, null);
      } else labelRaw(ctx, dead ? 'defekt' : 'kein Regler', dx + dw / 2, dy + dh / 2, 'center', 11, true, dead ? '#ff8a80' : '#ffd9a0', null, dw - 2, null);
      /* LEDs: Laden gruen, Float blau, Fehler rot (Text steht im Display) */
      const ly = y + h * 0.54 + 4, lr = Math.max(2.5, Math.min(5, w * 0.05));
      [['#3ddc84', stage === 1 || stage === 2], ['#4fa3ff', stage === 3], ['#ff5c5c', dead]].forEach((L, i) => {
        const lx = x + 10 + i * (lr * 3.2);
        ctx.fillStyle = L[1] && !(L[0] === '#ff5c5c' && !reduced && Math.floor(t * 3) % 2) ? L[0] : '#2b323a'; ctx.beginPath(); ctx.arc(lx, ly, lr, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 1; ctx.stroke();
      });
      /* PWM-Signalform bzw. MPPT-Kennlinie mit wanderndem Punkt */
      const sx = x + w * 0.46, sw = w * 0.5, sy = y + h * 0.54 - 2, sh = h * 0.34;
      if (type === 'pwm') {
        ctx.strokeStyle = '#ffd54a'; ctx.lineWidth = 1.5; ctx.beginPath();
        const per = sw / 3, ph = reduced ? 0 : ((t * 0.8) % 1) * per;
        let px = sx - ph;
        for (let k = 0; k < 4; k++) {
          const on1 = px + per * duty, e = px + per;
          const pts = [[px, sy + sh], [px, sy], [on1, sy], [on1, sy + sh], [e, sy + sh]];
          pts.forEach((q, i) => { const qx = cl(q[0], sx, sx + sw); if (k === 0 && i === 0) ctx.moveTo(qx, q[1]); else ctx.lineTo(qx, q[1]); });
          px = e;
        }
        ctx.stroke();
      } else if (type === 'mppt') {
        ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i <= 12; i++) { const u = i / 12, v = Math.sin(Math.PI * Math.pow(u, 0.7)) ; const qx = sx + sw * u, qy = sy + sh - sh * Math.min(1, v); if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); }
        ctx.stroke();
        const pu = reduced ? mppPos : cl(mppPos + 0.04 * Math.sin(t * 3), 0, 1), pv = Math.sin(Math.PI * Math.pow(pu, 0.7));
        ctx.fillStyle = '#ffd54a'; ctx.beginPath(); ctx.arc(sx + sw * pu, sy + sh - sh * Math.min(1, pv), 3, 0, TAU); ctx.fill();
      }
      labelRaw(ctx, type === 'mppt' ? 'MPPT' : type === 'pwm' ? 'PWM' : 'ohne Regler', x + w / 2, y + h - 8, 'center', 11, true, '#ffffff', null, w - 4, null);
      if (dead) { ctx.strokeStyle = '#ff5c5c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + w - 4, y + h - 4); ctx.moveTo(x + w - 4, y + 4); ctx.lineTo(x + 4, y + h - 4); ctx.stroke(); }
    });
  }

  /* ------------------------------------------------------------------ Wechselrichter */
  function inverterBox(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 40 || h < 36) return false;
    o = obj(o);
    const on = o.on !== false, led = ['ok', 'warn', 'error', 'off'].indexOf(o.led) >= 0 ? o.led : (on ? 'ok' : 'off');
    const t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    return draw(ctx, () => {
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#d5dbe2'; rrect(ctx, x, y, w, h, 6); ctx.fill();
      ctx.strokeStyle = '#7a8794'; ctx.lineWidth = 2; ctx.stroke();
      /* Display mit echten Zahlen */
      const dx = x + 5, dy = y + 5, dw = w - 10, dh = h * 0.36;
      ctx.fillStyle = '#10261b'; ctx.fillRect(dx, dy, dw, dh);
      if (on) {
        labelRaw(ctx, fin(o.pAc) ? fmtW(o.pAc) : '–', dx + dw / 2, dy + dh * 0.3, 'center', 11, true, '#7dffb0', null, dw - 2, null);
        labelRaw(ctx, fin(o.eta) ? 'η ' + fz(o.eta, 1) + ' %' : 'η –', dx + dw / 2, dy + dh * 0.72, 'center', 11, false, '#bff5d4', null, dw - 2, null);
      } else labelRaw(ctx, 'aus', dx + dw / 2, dy + dh / 2, 'center', 11, true, '#ffd9a0', null, dw - 2, null);
      /* Sinus-Symbol */
      const sy = y + h * 0.58, sw = w * 0.34;
      ctx.strokeStyle = '#2b3a4a'; ctx.lineWidth = 1.8; ctx.beginPath();
      for (let i = 0; i <= 16; i++) { const q = i / 16; const qx = x + 8 + sw * q, qy = sy + Math.sin(q * TAU) * h * 0.1; if (i) ctx.lineTo(qx, qy); else ctx.moveTo(qx, qy); }
      ctx.stroke();
      /* Luefter */
      const fx = x + w * 0.72, fy = sy, fr = Math.min(w * 0.14, h * 0.17), rot = reduced || !on ? 0 : t * 6;
      ctx.fillStyle = '#aab4be'; ctx.beginPath(); ctx.arc(fx, fy, fr, 0, TAU); ctx.fill(); ctx.strokeStyle = '#5b6672'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#3a4550'; ctx.lineWidth = 2; ctx.beginPath();
      for (let i = 0; i < 3; i++) { const a = rot + i * TAU / 3; ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(a) * fr * 0.9, fy + Math.sin(a) * fr * 0.9); }
      ctx.stroke();
      /* LED mit Textschild */
      const lc = { ok: '#2fd16a', warn: '#ffb340', error: '#ff4b4b', off: '#6b7580' }[led], lyy = y + h - 10;
      const lit = !(led === 'error' && !reduced && Math.floor(t * 3) % 2);
      ctx.fillStyle = lit ? lc : '#3a2020'; ctx.beginPath(); ctx.arc(x + 11, lyy, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 1; ctx.stroke();
      const cap = o.caption !== undefined ? str(o.caption) : { ok: 'Netz ok', warn: 'Warnung', error: 'Fehler', off: 'aus' }[led];
      labelRaw(ctx, cap, x + 19, lyy, 'left', 11, true, '#27323d', null, w - 24, null);
    });
  }

  /* ------------------------------------------------------------------ Zaehler */
  function meterBox(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 40 || h < 48) return false;
    o = obj(o);
    const dir = o.dir > 0 ? 1 : o.dir < 0 ? -1 : 0, t = fin(o.t) ? o.t : 0, reduced = !!o.reduced;
    return draw(ctx, () => {
      ctx.lineJoin = 'round';
      ctx.fillStyle = '#e4e8ec'; rrect(ctx, x, y, w, h, 6); ctx.fill(); ctx.strokeStyle = '#7a8794'; ctx.lineWidth = 2; ctx.stroke();
      /* Scheibe */
      const cx = x + w / 2, cy = y + h * 0.3, r = Math.min(w * 0.3, h * 0.2);
      ctx.fillStyle = '#9aa5b1'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 1.5; ctx.stroke();
      const ang = reduced || !dir ? 0.6 : dir * t * 3;
      ctx.strokeStyle = '#d0312d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - Math.cos(ang) * r * 0.9, cy - Math.sin(ang) * r * 0.9); ctx.lineTo(cx + Math.cos(ang) * r * 0.9, cy + Math.sin(ang) * r * 0.9); ctx.stroke();
      ctx.fillStyle = '#4a5560'; ctx.beginPath(); ctx.arc(cx, cy, 2, 0, TAU); ctx.fill();
      /* Richtungspfeil: Einspeisung nach rechts (hinaus), Bezug nach links (herein) */
      if (dir) { const ay = cy + r + 7; ctx.fillStyle = dir > 0 ? '#0f9d8a' : '#d0312d'; poly(ctx, dir > 0 ? [[cx + 9, ay], [cx - 3, ay - 5], [cx - 3, ay + 5]] : [[cx - 9, ay], [cx + 3, ay - 5], [cx + 3, ay + 5]], true); ctx.fill(); }
      /* zwei Zaehlwerke in kWh */
      const rows2 = [['Bezug', o.bezug, '#d0312d'], ['Einsp.', o.einsp, '#0f9d8a']];
      rows2.forEach((rw, i) => {
        const yy = y + h * (0.6 + i * 0.19), hh = h * 0.16;
        ctx.fillStyle = '#10261b'; ctx.fillRect(x + 4, yy, w - 8, hh);
        ctx.fillStyle = rw[2]; ctx.fillRect(x + 4, yy, 3, hh);
        labelRaw(ctx, rw[0] + ' ' + (fin(rw[1]) ? fz(rw[1], 1) : '–') + ' kWh', x + w / 2 + 2, yy + hh / 2, 'center', 11, false, '#bff5d4', null, w - 12, null);
      });
    });
  }

  /* ------------------------------------------------------------------ Mast */
  function pole(ctx, x, y, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(h) || h < 40) return false;
    o = obj(o);
    const on = o.on !== false;
    return draw(ctx, () => {
      ctx.lineCap = 'round';
      ctx.strokeStyle = on ? '#6b5a48' : '#3e362e'; ctx.lineWidth = Math.max(4, h * 0.025);
      ctx.beginPath(); ctx.moveTo(x, y + h); ctx.lineTo(x, y); ctx.stroke();
      ctx.lineWidth = Math.max(3, h * 0.016); ctx.beginPath(); ctx.moveTo(x - h * 0.12, y + h * 0.09); ctx.lineTo(x + h * 0.12, y + h * 0.09); ctx.stroke();
      ctx.fillStyle = on ? '#9fb6c8' : '#55616c';
      [-0.1, 0, 0.1].forEach(f => { ctx.fillRect(x + h * f - 2, y + h * 0.045, 4, h * 0.04); });
      if (o.wires !== false) {
        ctx.strokeStyle = on ? 'rgba(220,226,232,0.85)' : 'rgba(120,130,140,0.6)'; ctx.lineWidth = 1.5; ctx.beginPath();
        [-0.1, 0, 0.1].forEach(f => { ctx.moveTo(x + h * f, y + h * 0.05); ctx.quadraticCurveTo(x + h * f + h * 0.18, y + h * 0.18, x + h * 0.6, y + h * 0.12); });
        ctx.stroke();
      }
      if (!on) { ctx.fillStyle = '#10131a'; ctx.beginPath(); ctx.arc(x, y + h * 0.045, 4, 0, TAU); ctx.fill(); }
    });
  }

  /* ------------------------------------------------------------------ Legende */
  function legend(ctx, x, y, items, o) {
    if (!okCtx(ctx) || typeof ctx.fillText !== 'function' || !fin(x) || !fin(y) || !Array.isArray(items) || !items.length || items.length > 20) return false;
    o = obj(o);
    const rows = items.map(it => {
      const b = obj(it), K = FLOW_KINDS[b.kind] || null;
      return { label: str(b.label) || (K ? K.name : ''), color: goodColor(b.color) ? b.color : K ? K.color : '#ffffff',
        dash: Array.isArray(b.dash) && b.dash.every(v => fin(v) && v >= 0) ? b.dash.slice(0, 6) : K ? K.dash : [], width: fin(b.width) ? cl(b.width, 1, 12) : 3 };
    }).filter(r => r.label !== '');
    if (!rows.length) return false;
    const size = nz(o, 'size', 11, 11, 20), lh = size + 6;
    return draw(ctx, () => {
      font(ctx, size, false);
      let mw = 0; rows.forEach(r => { mw = Math.max(mw, tw(ctx, r.label, size, false)); });
      const note = str(o.note); if (note) mw = Math.max(mw, tw(ctx, note, size, false) - 40);
      const W = mw + 52, H = rows.length * lh + (note ? lh : 0) + 6, maxw = nz(o, 'maxw', 0, 0, 5000);
      ctx.fillStyle = 'rgba(10,14,26,0.66)'; rrect(ctx, x, y, W, H, 6); ctx.fill();
      rows.forEach((r, i) => {
        const yy = y + 3 + lh * i + lh / 2;
        ctx.strokeStyle = r.color; ctx.lineWidth = r.width; ctx.lineCap = 'butt'; setDash(ctx, r.dash.map(v => v * Math.max(1, r.width / 5)));
        ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + 38, yy); ctx.stroke(); setDash(ctx, NODASH);
        labelRaw(ctx, r.label, x + 44, yy, 'left', size, false, '#ffffff', null, maxw > 0 ? maxw - 48 : 0, null);
      });
      if (note) labelRaw(ctx, note, x + 6, y + 3 + lh * rows.length + lh / 2, 'left', size, false, '#cfd8e2', null, maxw > 0 ? maxw - 12 : 0, null);
    });
  }

  /* ------------------------------------------------------------------ Szene: gemeinsame Tageslandschaft fuer insel/netz (5.4, 5.3.4, 5.3.5)
   * scene(ctx, w, h, data) zeichnet in die Flaeche (0,0,w,h); Sky/Boden fuellen alles, die Objekte liegen in einer zentrierten
   * Welt 1000 x 640 (Skalierung s = min(w/1000, h/640)). sceneLayout(w, h, data) liefert dieselbe Geometrie fuer hitTest und Rigs.
   * data = {
   *   id:'insel'|'netz' (Cache-Schluessel), mode:'insel'|'netz', t (Animationszeit s), reduced, dpr, speed (Zeitraffer; > 5 = weniger Partikel),
   *   cache:false (Offscreen-Ebenen aus), canvasFactory(w,h) (nur Tests), legend:true|false, detail:true (Verluste), compact (sonst automatisch s < 0,55),
   *   tS (Sonnenzeit h, nur Anzeige), polar:'nacht'|'tag'|null, labels:{ polar, solar, regler, akku, wr, last, pumpe, zaehler, speicher, netz, haus },
   *   sun:{ alt, az, m },  path:{ alt[], az[], t[], extra:[{alt[],az[],label}] } (sun.sunPath),  cloud:{ c, seed },
   *   house:{ kind:'gartenhaus'|'wohnhaus', lit 0..1 },
   *   modules:{ beta, gam, cols, rows, subs, orient, temp, shade[], hot[], bypass[] },  rays:{ gb, gd, gr, aoi },
   *   batt:{ soc, gas, warn, temp },  ctrl:{ type, stage, duty, uv, ii, mpp, dead },  inv:{ present, pAc, eta, led, on },
   *   store:{ present, soc },  meter:{ bezug, einsp, dir },  grid:{ ok },  loads:{ lamp, pump },
   *   Pref (W, Skala der Strichstaerke),
   *   flows:{ pv, bat (laden +), load (DC, Regler -> WR bzw. Last), loadAc (WR -> Last), pump, haus, netz (Einspeisung +, Bezug -), speicher (laden +),
   *           verlustCtrl, verlustInv } (alle W; fehlend oder < 1 W = nicht gezeichnet) }
   * Hinweis zu den Staerken: Sonnenhoehe-Hinweis, Uhrzeit und Legende kommen aus data (Texte in data.labels ueberschreiben die Kurznamen). */
  function sceneLayout(w, h, data) {
    if (!fin(w) || !fin(h) || w < 80 || h < 60 || w > 20000 || h > 20000) return null;
    data = obj(data);
    const mode = data.mode === 'netz' ? 'netz' : 'insel', s = Math.min(w / 1000, h / 640), ox = (w - 1000 * s) / 2, oy = (h - 640 * s) / 2;
    const X = v => ox + v * s, Y = v => oy + v * s, R = (x, y, ww, hh) => ({ x: X(x), y: Y(y), w: ww * s, h: hh * s });
    const hz = Y(384), sunD = obj(data.sun), mod = obj(data.modules), hd = obj(data.house);
    const kind = hd.kind === 'wohnhaus' || hd.kind === 'gartenhaus' ? hd.kind : (mode === 'netz' ? 'wohnhaus' : 'gartenhaus');
    const hb = mode === 'netz' ? [100, 286, 520, 274] : [125, 296, 480, 264], ct = mode === 'netz' ? [210, 325, 300, 210] : [220, 335, 290, 200];
    const cutR = R(ct[0], ct[1], ct[2], ct[3]);
    const g = houseGeom(X(hb[0]), Y(hb[1]), hb[2] * s, hb[3] * s, { kind, cut: cutR, extra: 150 * s });
    const quad = moduleQuad(g.cx, g.y - 6 * s, g.w * 0.8, 130 * s, fin(mod.beta) ? mod.beta : 35, fin(mod.gam) ? mod.gam : 0);
    const inv = obj(data.inv), store = obj(data.store);
    const invPresent = mode === 'netz' ? true : !!(data.inv && inv.present !== false && inv.present !== undefined ? inv.present : inv.present === true);
    const comps = {};
    if (mode === 'insel') {
      comps.ctrl = R(325, 345, 80, 72); comps.batt = R(236, 440, 84, 80); comps.lamp = R(445, 345, 40, 50); comps.pump = R(690, 490, 50, 50);
      if (invPresent) comps.inv = R(410, 440, 84, 80);
    } else {
      comps.inv = R(316, 340, 88, 76); comps.meter = R(556, 420, 76, 100); comps.loadIcon = R(226, 490, 48, 36);
      if (store.present) comps.store = R(226, 340, 62, 76);
      comps.pole = { x: X(850), y: Y(250), h: 310 * s };
    }
    const cx = r => r.x + r.w / 2, cy = r => r.y + r.h / 2, B = quad ? [(quad[2][0] + quad[3][0]) / 2, (quad[2][1] + quad[3][1]) / 2] : [g.cx, g.y];
    const paths = {}, busY = Y(470);
    const elbow = (a, tx, ty) => { const ym = g.y + 14 * s; return Math.abs(a[0] - tx) < 2 ? [a, [tx, ty]] : [a, [a[0], ym], [tx, ym], [tx, ty]]; };
    if (mode === 'insel') {
      const c = comps.ctrl, b = comps.batt, l = comps.lamp, i = comps.inv, p = comps.pump;
      paths.pv = elbow(B, cx(c), c.y);
      paths.bat = [[c.x + c.w * 0.25, c.y + c.h], [c.x + c.w * 0.25, cy(b)], [b.x + b.w, cy(b)]];
      if (i) {
        paths.load = [[c.x + c.w * 0.75, c.y + c.h], [c.x + c.w * 0.75, cy(i)], [i.x, cy(i)]];
        paths.loadAc = [[i.x + i.w * 0.75, i.y], [i.x + i.w * 0.75, l.y + l.h]];
        paths.pump = [[i.x + i.w, cy(i)], [p.x, cy(p)]];
        paths.verlustInv = [[i.x + i.w * 0.5, i.y], [i.x + i.w * 0.5 - 24 * s, i.y - 26 * s]];
      } else {
        paths.load = [[c.x + c.w, cy(c) - 6 * s], [l.x, l.y + l.h * 0.5]];
        paths.pump = [[c.x + c.w, c.y + c.h * 0.85], [c.x + c.w + 22 * s, c.y + c.h * 0.85], [c.x + c.w + 22 * s, cy(p)], [p.x, cy(p)]];
      }
      paths.verlustCtrl = [[c.x + 6 * s, c.y], [c.x - 22 * s, c.y - 24 * s]];
    } else {
      const i = comps.inv, ic = comps.loadIcon;
      paths.pv = elbow(B, cx(i), i.y);
      paths.acOut = [[cx(i), i.y + i.h], [cx(i), busY]];
      paths.haus = [[cx(i), busY], [cx(ic), busY], [cx(ic), ic.y]];
      paths.netz = [[cx(i), busY], [comps.pole.x, busY]];
      if (comps.store) paths.speicher = [[i.x, cy(i)], [comps.store.x + comps.store.w, cy(i)]];
      paths.verlustInv = [[i.x + i.w * 0.8, i.y], [i.x + i.w * 0.8 + 24 * s, i.y - 26 * s]];
    }
    /* Beruehrflaechen (mindestens 40 x 40 px) */
    const hr = (id, r) => { const W = Math.max(r.w, 40), H = Math.max(r.h, 40); return { id, x: r.x + r.w / 2 - W / 2, y: r.y + r.h / 2 - H / 2, w: W, h: H }; };
    const sunRect = { x: ox, y: oy, w: 1000 * s, h: 384 * s }, sp = sunPos(sunRect, fin(sunD.alt) ? sunD.alt : 30, fin(sunD.az) ? sunD.az : 0);
    const sunR = 26 * Math.min(1, Math.max(0.55, s)) * (1 + 0.25 * (1 - cl((fin(sunD.alt) ? sunD.alt : 30) / 30, 0, 1)));
    const hit = [];
    if (fin(sp.x)) hit.push({ id: 'sonne', x: sp.x - Math.max(20, sunR * 1.3), y: sp.y - Math.max(20, sunR * 1.3), w: Math.max(40, sunR * 2.6), h: Math.max(40, sunR * 2.6), r: Math.max(20, sunR * 1.3), cx: sp.x, cy: sp.y });
    if (quad) { const xs = quad.map(q => q[0]), ys = quad.map(q => q[1]); hit.push(hr('modul', { x: Math.min.apply(null, xs), y: Math.min.apply(null, ys), w: Math.max.apply(null, xs) - Math.min.apply(null, xs), h: Math.max.apply(null, ys) - Math.min.apply(null, ys) })); }
    const cloud = obj(data.cloud), cgr = cloudLayout(cloud.c, cloud.seed, data.t, w, hz * 0.9, data.reduced === undefined ? reducedMotion() : !!data.reduced);
    cgr.forEach((q, k) => hit.push(Object.assign(hr('wolke', { x: q.x - q.s * 1.5, y: q.y - q.s * 0.5, w: q.s * 3, h: q.s }), { index: k })));
    [['regler', comps.ctrl], ['akku', comps.batt], ['wr', comps.inv], ['lampe', comps.lamp], ['pumpe', comps.pump], ['zaehler', comps.meter], ['speicher', comps.store], ['verbraucher', comps.loadIcon]]
      .forEach(a => { if (a[1]) hit.push(hr(a[0], a[1])); });
    if (comps.pole) hit.push(hr('mast', { x: comps.pole.x - 12 * s, y: comps.pole.y, w: 24 * s, h: comps.pole.h }));
    return { s, ox, oy, w, h, hz, mode, kind, compact: data.compact !== undefined ? !!data.compact : s < 0.55, skyRect: { x: 0, y: 0, w, h: hz }, sunRect, sunPos: sp, sunR,
      house: g, quad, comps, paths, hit, clouds: cgr, invPresent };
  }

  const CACHE = {};
  function defaultFactory(w, h) {
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
    const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
  }
  /* statische Ebene (Boden, Haus): Offscreen-Canvas, neu nur bei geaenderter Groesse oder Umgebungshelligkeit */
  function cachedLayer(ctx, data, name, key, w, h, fn) {
    if (data.cache === false || typeof ctx.drawImage !== 'function') { fn(ctx); return false; }
    const factory = typeof data.canvasFactory === 'function' ? data.canvasFactory : defaultFactory;
    const dpr = fin(data.dpr) && data.dpr > 0 ? cl(data.dpr, 1, 3) : (typeof window !== 'undefined' && fin(window.devicePixelRatio) ? cl(window.devicePixelRatio, 1, 3) : 1);
    const id = (str(data.id) || data.mode || 'x') + ':' + name, k = [w, h, dpr].join('x') + '|' + key;
    try {
      let e = CACHE[id];
      if (!e || e.key !== k) {
        const cv = factory(Math.ceil(w * dpr), Math.ceil(h * dpr));
        const cx = cv && typeof cv.getContext === 'function' ? cv.getContext('2d') : null;
        if (!cx) { fn(ctx); return false; }
        if (typeof cx.setTransform === 'function') cx.setTransform(dpr, 0, 0, dpr, 0, 0);
        fn(cx); e = CACHE[id] = { key: k, canvas: cv };
      }
      ctx.drawImage(e.canvas, 0, 0, w, h);
      return true;
    } catch (err) { fn(ctx); return false; }
  }
  function clock(hh) { if (!fin(hh)) return ''; const m = Math.round((((hh % 24) + 24) % 24) * 60) % 1440; return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); }
  function glow(ctx, g, lit) {
    if (!(lit > 0.02)) return;
    g.windows.forEach(wd => {
      ctx.fillStyle = lin(ctx, 0, wd.y, 0, wd.y + wd.h, [[0, '#fff0b0'], [1, '#ffb83a']]); ctx.globalAlpha = 0.35 + 0.65 * lit; ctx.fillRect(wd.x, wd.y, wd.w, wd.h); ctx.globalAlpha = 1;
      ctx.fillStyle = rgba('#ffd45a', 0.18 * lit); ctx.fillRect(wd.x - 5, wd.y - 5, wd.w + 10, wd.h + 10);
      ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 2; ctx.strokeRect(wd.x, wd.y, wd.w, wd.h);
      ctx.beginPath(); ctx.moveTo(wd.x + wd.w / 2, wd.y); ctx.lineTo(wd.x + wd.w / 2, wd.y + wd.h); ctx.moveTo(wd.x, wd.y + wd.h / 2); ctx.lineTo(wd.x + wd.w, wd.y + wd.h / 2); ctx.stroke();
    });
  }
  function lampIcon(ctx, r, on, t, reduced) {
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.62, br = Math.min(r.w, r.h) * 0.3;
    ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx, r.y); ctx.lineTo(cx, cy - br); ctx.stroke();
    if (on > 0.02) { ctx.fillStyle = rad(ctx, cx, cy, 0, br * 3, [[0, rgba('#ffe27a', 0.6 * on)], [1, rgba('#ffe27a', 0)]]); ctx.beginPath(); ctx.arc(cx, cy, br * 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = on > 0.02 ? mix('#fff6c8', '#ffd54a', 1 - on) : '#6b7580'; ctx.beginPath(); ctx.arc(cx, cy, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#d5dde6'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#8d99a6'; ctx.fillRect(cx - br * 0.45, cy - br - 3, br * 0.9, 5);
  }
  function pumpIcon(ctx, r, P, t, reduced, bud) {
    const cx = r.x + r.w * 0.45, cy = r.y + r.h * 0.55, pr = Math.min(r.w, r.h) * 0.36, on = P >= 1;
    ctx.fillStyle = '#3b6fa8'; rrect(ctx, r.x, r.y + r.h * 0.2, r.w * 0.9, r.h * 0.7, 6); ctx.fill();
    ctx.strokeStyle = '#9fc4e8'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#cfe3f5'; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, TAU); ctx.fill();
    const rot = on && !reduced ? t * 8 : 0; ctx.strokeStyle = '#2b4f7a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 3; i++) { const a = rot + i * TAU / 3; ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * pr * 0.9, cy + Math.sin(a) * pr * 0.9); }
    ctx.stroke();
    if (on) { /* Wasserstrahl in hohem Bogen */
      const x0 = r.x + r.w * 0.9, y0 = r.y + r.h * 0.3, n = Math.min(bud.n, 10); bud.n -= n;
      ctx.fillStyle = 'rgba(120,200,255,0.9)'; ctx.beginPath();
      for (let k = 0; k < n; k++) { const f = reduced ? k / n : ((t * 0.9 + k / n) % 1), px = x0 + f * r.w * 1.6, py = y0 - 4 * r.h * 0.35 * f * (1 - f) * 2 + f * f * r.h * 1.3; ctx.moveTo(px + 2.2, py); ctx.arc(px, py, 2.2, 0, TAU); }
      ctx.fill();
    }
  }
  function storeIcon(ctx, r, soc, t, reduced) {
    ctx.fillStyle = '#3a4350'; rrect(ctx, r.x, r.y, r.w, r.h, 5); ctx.fill(); ctx.strokeStyle = '#8d99a6'; ctx.lineWidth = 2; ctx.stroke();
    const col = socColor(soc), n = 5, ch = (r.h - 12) / n;
    for (let i = 0; i < n; i++) { const on = (n - i) / n <= (fin(soc) ? soc : 0) + 0.001; ctx.fillStyle = on ? col : '#1c232d'; ctx.fillRect(r.x + 6, r.y + 6 + i * ch + 1.5, r.w - 12, ch - 3); }
  }

  function scene(ctx, w, h, data) {
    if (!okCtx(ctx) || !fin(w) || !fin(h) || w < 80 || h < 60 || w > 20000 || h > 20000) return false;
    data = obj(data);
    const L = sceneLayout(w, h, data);
    if (!L) return false;
    const reduced = data.reduced === undefined ? reducedMotion() : !!data.reduced, t = fin(data.t) ? data.t : 0;
    const sunD = obj(data.sun), alt = fin(sunD.alt) ? sunD.alt : 30, az = fin(sunD.az) ? sunD.az : 0, m = fin(sunD.m) ? cl(sunD.m, 0.15, 1) : 1;
    const cloud = obj(data.cloud), cc = nz(cloud, 'c', 0, 0, 1), sc = skyColors(alt), light = sc.light;
    const mod = obj(data.modules), fl = obj(data.flows), lab = obj(data.labels), loads = obj(data.loads), hd = obj(data.house);
    const speed = fin(data.speed) ? data.speed : 1, B = { n: Math.floor(150 * (speed > 5 ? 0.5 : 1)) };
    const cs = L.s, comps = L.comps, mode = L.mode, compact = L.compact;
    const nm = (k, d) => (str(lab[k]) || d);
    const stats = { particles: 0, flows: 0, labels: 0, cached: false };
    const nStars = starCount(alt); B.n = Math.max(0, B.n - nStars);
    return draw(ctx, () => {
      const hz = L.hz;
      sky(ctx, w, hz, { alt, t, reduced });
      /* Sonnenbahn und Sonne */
      if (data.path && typeof data.path === 'object') sunPathArc(ctx, L.sunRect, data.path, { alt, az });
      if (alt > -9 && fin(L.sunPos.x)) {
        const k = cl(m * (1 - 0.85 * cc * cc), 0.05, 1);
        sun(ctx, L.sunPos.x, L.sunPos.y, { r: L.sunR, intensity: k, t, reduced, alt });
      }
      clouds(ctx, { x: 0, y: 0, w, h: hz * 0.9 }, { c: cc, t, seed: cloud.seed, reduced, light });
      /* Boden (statische Ebene) */
      const lightBin = Math.round(light * 40);
      stats.cached = cachedLayer(ctx, data, 'ground', 'g' + lightBin, w, h, cx => { ground(cx, { x: 0, y: hz, w, h: h - hz }, { light }); });
      /* Wolkenschatten und Hausschatten auf dem Boden */
      if (alt > 3 && cc > 0.05) {
        ctx.fillStyle = 'rgba(8,16,28,0.14)';
        L.clouds.slice(0, 6).forEach(q => { ctx.beginPath(); ellipse(ctx, q.x, hz + (h - hz) * (0.2 + 0.55 * q.y / (hz * 0.9)), q.s * 2.1, q.s * 0.45); ctx.fill(); });
      }
      const sh = houseShadow(L.house, alt, az, { bounds: { x0: -w * 0.2, x1: w * 1.2, y0: hz, y1: h } });
      if (sh) shadow(ctx, sh, { alpha: 0.36 * cl(alt / 8, 0.2, 1), soft: 7 * Math.max(0.6, cs) });
      /* Haus, Mast (statisch bzw. billig) */
      const kind = L.kind, lit = nz(hd, 'lit', 0, 0, 1);
      cachedLayer(ctx, data, 'house', ['h', kind, mode, lightBin].join('|'), w, h, cx => { house(cx, L.house.x, L.house.y, L.house.w, L.house.h, { kind, light, lit: 0, cut: L.house.cut }); });
      glow(ctx, L.house, lit);
      if (comps.pole) pole(ctx, comps.pole.x, comps.pole.y, comps.pole.h, { on: obj(data.grid).ok !== false });
      /* Modul auf dem Aufbau: Stuetzen, Zellraster */
      if (L.quad) {
        const q = L.quad, gy = L.house.y;
        ctx.strokeStyle = '#7a8794'; ctx.lineWidth = Math.max(2, 3 * cs); ctx.beginPath();
        ctx.moveTo(q[3][0] + 6 * cs, q[3][1]); ctx.lineTo(q[3][0] + 6 * cs, gy); ctx.moveTo(q[2][0] - 6 * cs, q[2][1]); ctx.lineTo(q[2][0] - 6 * cs, gy); ctx.stroke();
        panelQuad(ctx, q, { cols: mod.cols, rows: mod.rows, subs: mod.subs, orient: mod.orient, temp: mod.temp, shade: mod.shade, hot: mod.hot, bypass: mod.bypass,
          t, reduced, detail: cs < 0.7 ? 'low' : 'full', glint: m * (1 - 0.8 * cc) });
        /* Strahlung */
        const rd = obj(data.rays);
        if (alt > 0.5 && fin(L.sunPos.x) && (fin(rd.gb) || fin(rd.gd) || fin(rd.gr))) {
          const to = { x0: (q[0][0] + q[3][0]) / 2, y0: (q[0][1] + q[3][1]) / 2, x1: (q[1][0] + q[2][0]) / 2, y1: (q[1][1] + q[2][1]) / 2 };
          rays(ctx, { x: L.sunPos.x, y: L.sunPos.y }, to, { gb: rd.gb, gd: rd.gd, gr: rd.gr, aoi: rd.aoi, t, reduced, budget: B, showAngle: !compact });
        }
        if (mode === 'insel' || mode === 'netz') labelRaw(ctx, nm('solar', 'Solarmodul') + (fin(fl.pv) && !compact ? '' : ''), (q[0][0] + q[1][0]) / 2, Math.min(q[0][1], q[1][1]) - 10, 'center', 11, true, '#ffffff', null, w * 0.4, 'rgba(8,12,24,0.8)');
      }
      /* Technik im Haus */
      const nameUnder = (r, key, def, short) => { const txt = r.w * 1.5 < 60 && short ? short : nm(key, def); labelRaw(ctx, txt, r.x + r.w / 2, r.y + r.h + 9, 'center', 11, false, '#e8eef4', null, Math.max(r.w * 1.6, 44), null); };
      const bd = obj(data.batt), cd = obj(data.ctrl), iv = obj(data.inv);
      if (mode === 'insel') {
        if (comps.batt) { battery(ctx, comps.batt.x, comps.batt.y, comps.batt.w, comps.batt.h, { soc: bd.soc, gas: bd.gas, warn: bd.warn, temp: bd.temp, t, reduced, budget: B }); nameUnder(comps.batt, 'akku', 'Akku'); }
        controllerBox(ctx, comps.ctrl.x, comps.ctrl.y, comps.ctrl.w, comps.ctrl.h, { type: cd.type, stage: cd.stage, duty: cd.duty, uv: cd.uv, ii: cd.ii, mpp: cd.mpp, dead: cd.dead, t, reduced });
        nameUnder(comps.ctrl, 'regler', 'Laderegler', 'Regler');
        lampIcon(ctx, comps.lamp, nz(loads, 'lamp', 0, 0, 1e9) >= 1 ? 1 : 0, t, reduced);
        nameUnder(comps.lamp, 'last', 'Last');
        if (comps.inv) { inverterBox(ctx, comps.inv.x, comps.inv.y, comps.inv.w, comps.inv.h, { on: iv.on, pAc: iv.pAc, eta: iv.eta, led: iv.led, t, reduced, caption: compact ? '' : undefined }); nameUnder(comps.inv, 'wr', 'Wechselrichter', 'WR'); }
        pumpIcon(ctx, comps.pump, nz(loads, 'pump', 0, 0, 1e9), t, reduced, B);
        nameUnder(comps.pump, 'pumpe', 'Pumpe');
      } else {
        inverterBox(ctx, comps.inv.x, comps.inv.y, comps.inv.w, comps.inv.h, { on: iv.on, pAc: iv.pAc, eta: iv.eta, led: obj(data.grid).ok === false ? 'error' : iv.led, t, reduced, caption: obj(data.grid).ok === false ? 'Netz aus' : (compact ? '' : undefined) });
        nameUnder(comps.inv, 'wr', 'Wechselrichter', 'WR');
        if (comps.store) { storeIcon(ctx, comps.store, obj(data.store).soc, t, reduced); nameUnder(comps.store, 'speicher', 'Speicher', 'Sp.'); }
        const ic = comps.loadIcon;
        lampIcon(ctx, { x: ic.x, y: ic.y - 10 * cs, w: ic.w, h: ic.h + 10 * cs }, 1, t, reduced); nameUnder(ic, 'haus', 'Haus');
        /* Sammelschiene im Haus */
        ctx.strokeStyle = 'rgba(200,210,222,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L.paths.haus[1][0] - 10 * cs, L.paths.acOut[1][1]); ctx.lineTo(L.paths.netz[1][0] - 40 * cs, L.paths.acOut[1][1]); ctx.stroke();
      }
      /* Energieflusspfeile (Hauptfigur): zuletzt, damit nichts sie verdeckt */
      const Pref = fin(data.Pref) && data.Pref > 0 ? data.Pref : 1000;
      const active = [];
      const addF = (key, kindName, P, name, at, extra) => { if (fin(P) && Math.abs(P) >= 1 && L.paths[key]) active.push(Object.assign({ key, kind: kindName, P, name, at }, extra || {})); };
      if (mode === 'insel') {
        addF('pv', 'solar', fl.pv, nm('solar', 'Solar'), 0.45);
        addF('bat', 'akku', fl.bat, undefined, 0.78);
        addF('load', 'last', fl.load, nm('last', 'Last'), 0.8);
        if (comps.inv) addF('loadAc', 'last', fl.loadAc, nm('last', 'Last'), 0.5);
        addF('pump', 'last', fl.pump, nm('pumpe', 'Pumpe'), 0.8);
        if (data.detail) { addF('verlustCtrl', 'verlust', fl.verlustCtrl, 'Verlust', 0.6); if (comps.inv) addF('verlustInv', 'verlust', fl.verlustInv, 'Verlust', 0.6); }
      } else {
        addF('pv', 'solar', fl.pv, nm('solar', 'Solar'), 0.5);
        addF('acOut', 'solar', fl.acOut !== undefined ? fl.acOut : fl.loadAc, nm('solar', 'Solar'), 0.5);
        addF('haus', 'last', fl.haus, nm('haus', 'Haus'), 0.55);
        addF('netz', 'netz', fl.netz, undefined, 0.84);
        addF('speicher', 'akku', fl.speicher, nm('speicher', 'Speicher'), 0.5);
        if (data.detail) addF('verlustInv', 'verlust', fl.verlustInv, 'Verlust', 0.6);
      }
      const per = Math.max(6, Math.floor(B.n / Math.max(1, active.length)));
      active.forEach(a => {
        const isMain = a.key === 'pv' || a.key === 'bat' || a.key === 'netz' || a.key === 'load' || a.key === 'haus';
        const o = { kind: a.kind, Pref, t, reduced, name: a.name, at: a.at, compact: compact, label: compact ? isMain : true, budget: B, maxDots: per };
        if (flow(ctx, L.paths[a.key], a.P, o)) { stats.flows++; if (o.label) stats.labels++; }
      });
      /* Textschilder oben links: Sonnenzeit und Sonnenhoehe, Polarnacht-Hinweis */
      const lines = [];
      if (fin(data.tS)) lines.push('Sonnenzeit ' + clock(data.tS) + ' Uhr');
      lines.push(alt > 0 ? 'Sonnenhöhe ' + fz(alt, 0) + '°' : 'Sonne unter dem Horizont');
      lines.forEach((tx, i) => labelRaw(ctx, tx, 8, 14 + i * 16, 'left', 11, true, '#ffffff', null, w * 0.6, 'rgba(8,12,24,0.8)'));
      if (data.polar === 'nacht' && str(lab.polar)) labelRaw(ctx, str(lab.polar), w / 2, hz * 0.35, 'center', 12, true, '#ffffff', null, w * 0.9, 'rgba(8,12,24,0.85)');
      if (data.grid && obj(data.grid).ok === false && mode === 'netz') labelRaw(ctx, str(lab.netz) || 'Netz aus', comps.pole.x, comps.pole.y - 12, 'center', 11, true, '#ff8a80', null, w * 0.3, 'rgba(8,12,24,0.85)');
      /* Legende */
      const wantLegend = data.legend === true || (data.legend !== false && !compact && w >= 520 && h >= 360);
      const note = 'Strichstärke ~ √Leistung';
      if (wantLegend) {
        const items = mode === 'insel' ? [{ kind: 'solar' }, { kind: 'akku-laden' }, { kind: 'akku-entl' }, { kind: 'last' }] : [{ kind: 'solar' }, { kind: 'last' }, { kind: 'bezug' }, { kind: 'einsp' }];
        if (data.detail) items.push({ kind: 'verlust' });
        const lh = 17, H = items.length * lh + lh + 6;
        legend(ctx, 8, h - H - 8, items, { note, maxw: w * 0.5 });
      } else if (data.legend !== false) labelRaw(ctx, note, 8, h - 9, 'left', 11, false, '#e8eef4', null, w - 16, 'rgba(8,12,24,0.8)');
      stats.particles = (Math.floor(150 * (speed > 5 ? 0.5 : 1))) - B.n;
      return true;
    }) && (ENR_API.lastStats = stats, true);
  }

  /* ------------------------------------------------------------------ Programmierschnittstelle */
  const FNS = ['skyColors', 'sky', 'sun', 'sunPathArc', 'clouds', 'ground', 'shadow', 'house', 'panelGrid', 'panelQuad', 'bypass', 'crossSection', 'rays', 'flow',
    'battery', 'controllerBox', 'inverterBox', 'meterBox', 'pole', 'scene', 'label', 'arrow', 'legend'];
  const ENR_API = {
    version: '1.0', fns: FNS,
    skyColors, sky, sun, sunPos, sunPathArc, clouds, cloudLayout, ground, shadow, house, houseGeom, houseShadow, moduleQuad, panelApparent, panelGrid, panelQuad,
    cellIndex, tempColor, bypass, crossSection, rays, flow, flowWidth, fmtW, FLOW_KINDS, battery, socColor, controllerBox, inverterBox, meterBox, pole, scene, sceneLayout,
    label, arrow, legend, cssColors, starCount, reducedMotion, fz, mix, lastStats: null
  };
  root.ENR_DRAW = ENR_API;
  if (typeof module !== 'undefined') module.exports = ENR_API;
})(typeof window !== 'undefined' ? window : globalThis);
