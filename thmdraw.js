/* thmdraw.js - Thermik-/Kuehlkoerper-Lab Zeichenhelfer (THM_DRAW, Version 1.0)
 * Schnittbild der Waermekette, Waermebild (Falschfarben-Kamera), Isothermen, Waermefluss-Pfeile, Kuehlkoerper mit Rippen und
 * Konvektion, Lueftungsrad, Thermometer, Rauch/Funken, Drehregler, Kippschalter, Lampe, Messschreiber, Kennlinien, gestapelte Balken,
 * thermisches Ersatzschaltbild, Vergleich mehrerer Aufbauten.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval, offline, keine Bilder. Browser: window.THM_DRAW, Node: module.exports / globalThis.THM_DRAW.
 * Kein Zugriff auf THM_CORE zur Laufzeit: alle Zahlen kommen ueber die Parameter (data), die Anlage fuellt sie aus rig.state()/rig.cfg().
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Jede Funktion hat die Form f(ctx, ...). ctx = Canvas-2D-Kontext (im Test ein Mock). Alle Funktionen sind zustandsfrei:
 *    gleiche Argumente ergeben gleiche Aufrufe. Animation nur ueber Parameter (t = Sekunden, rot = Winkel). Einzige Ausnahme sind
 *    interne Zwischenspeicher fuer Rechenergebnisse (Waermebild-Pixelfeld, Farbtabelle); sie veraendern die Zeichenaufrufe nie.
 *  - Alle Optionen sind optional. Ungueltige Werte (kein endlicher Zahlenwert, Text statt Zahl) fallen auf den Vorgabewert zurueck.
 *  - Rueckgabe: false = NICHTS gezeichnet (dann gab es auch KEINEN Aufruf am ctx). Sonst true oder (bei Bildern und Diagrammen) ein
 *    Layout-Objekt (truthy). Gruende fuer false: ctx unbrauchbar, Pflichtkoordinaten nicht endlich, Flaeche zu klein, Leistung 0
 *    bei Pfeil und Konvektion (ohne Leistung gibt es nichts zu zeichnen).
 *  - Koordinaten in CSS-Pixeln. Der Aufrufer setzt Transform und Loeschen (devicePixelRatio). Es wird nie ctx.scale/translate/rotate
 *    benutzt: Textpositionen im Mock sind echte Bildschirmpositionen (Test auf Ueberlappung).
 *  - Texte: Dezimalkomma, Minus als echtes Minuszeichen, Schrift ab 12 px, Zahlen immer mit Einheit (°C, K, K/W, W).
 *    Farbe ist nie der einzige Traeger der Information (Zahlen, Isothermen, Muster, Linienarten).
 *  - Farben: opts.colors = 'light' | 'dark' | Objekt (Schluessel siehe PAL_DARK, optional theme:'light').
 *    THM_DRAW.cssColors(element) liest --bg --panel --panel2 --fg --mute --line --accent --danger --ok --warn der Seite.
 *  - opts.reduced = true (prefers-reduced-motion): keine Partikel, Pfeile statisch, keine Wellenbewegung.
 *
 * ===================================================================================================
 * AUFBAU-OBJEKT (data bei schnitt, kamera, ersatz, balkenData, vergleich.builds[i])
 *  Die Anlage kann Object.assign({}, rig.cfg(), rig.state(), extras) uebergeben. Gelesen werden (alle optional):
 *   Leistung/Temperaturen:  P (oder pv, p) W; ta; tj, tc, tk (°C); tjMax; tShut (Abschalttemperatur); tL (Anschlussdraht, Diode)
 *   Waermewiderstaende:     rthJC, rthCK, rthK (inkl. Luefter und Einbaulage), rthTotal; rthCA (nur frei); rthK0 (Katalogwert)
 *   Temperaturabfaelle:     dJC, dCK, dK (K); fehlen sie, werden sie aus P*Rth gerechnet; fehlt tj/tc/tk, aus ta + Abfaelle
 *   Waermekapazitaeten:     cth {j, c, k} (J/K) nur fuer das Ersatzschaltbild
 *   Aufbau:                 device, pkg ('TO-220','TO-126','DO-201','Zement','Alu','LED'), mode ('frei'|'kk'),
 *                           heatsink ('none','fahne','s','m','l','xl','blech','custom'), blechA (cm2), joint ('direkt','glimmer','silikon'),
 *                           paste ('keine','duenn','dick'), bushing (Bool), screw ('fest'|'locker'), ksPot, fan ('aus','leise','mittel','stark'),
 *                           orient ('senkrecht'|'waagrecht'), fanFactor, orientFactor (nur Anzeige), fin (Array Rippentemperaturen Fuss->Spitze)
 *   Zustand:                shutdown, destroyed, short (Bools); level 0..1 (Aufheizfortschritt: Pfeile blasser) ; t (Animationszeit s)
 *   Anzeige:                lo, hi (Farbskala; Vorgabe ta ... tjMax + 30), sym {tj,tc,tk,ta,rthJC,rthCK,rthK,rthJA,P} (Symbolsatz aus
 *                           THM_CORE.sym, sonst Datenblattsatz), heatsinkName, jointName, fahneText, ksText (Strings), reduced, colors,
 *                           compact (Bool), reserve {left,right,top,bottom} (px, die die Anlage selbst belegt), legend:false,
 *                           cursor {x,y} (nur kamera), autoscale (Bool, nur kamera: Skala Ta-1 ... Tc + 15 %), analogie [[Elektrisch, Thermisch], ...]
 *                           (nur ersatz; Arrays [e,t] oder Objekte {elektrisch,thermisch})
 *  Zahlen im Bild stammen ausschliesslich aus diesem Objekt. Nur wenn die Anlage sie nicht mitgibt, greifen Rueckfallwerte, die
 *  nicht im Kern stehen und deshalb von der Anlage immer mitgegeben werden sollen: fanFactor (Luefterrad-Faktor), fin (Rippentemperaturen),
 *  analogie (Standardzeilen), heatsinkName/jointName (Standardnamen).
 *  Zeitmassstab: t ist die ANIMATIONSZEIT in Sekunden (Echtzeit-Frames), nicht die Prozesszeit; die Anlage zaehlt sie selbst mit.
 *  Aufheizen: level = 0..1 (z. B. (tk - ta) / (tkBeharrung - ta)); Pfeil an der Quelle immer voll, Pfeil durch den Uebergang (1 + level)/2, Pfeil an die Luft = level (kleiner level = blasser).
 *
 * ===================================================================================================
 * FUNKTIONEN
 *  heatColor(t, lo, hi)                  -> '#rrggbb' (Falschfarbe, dunkelblau-violett-rot-orange-gelb-weiss), ungueltig '#808080'
 *  legend(ctx, rect, lo, hi, opts)       Farbskala mit Zahlen; opts {unit, title, marks:[{v,label}], reduced, colors}; liegend wenn w >= h
 *  schnitt(ctx, w, h, data)              komplettes Schnittbild, Waerme fliesst NACH OBEN (Chip unten; Gehaeuse, Paste, Isolierscheibe, Buchse,
 *                                        Schraube, Kuehlkoerper mit Rippen, Luft mit Fahnen), Pfeile, Etiketten mit Zahlen, Isothermen
 *                                        (10 K, bei grossem Bereich 20/25/50 K, hoechstens neun), Skala. Fuellt die Flaeche (w,h) in Bildpunkten
 *                                        (Layout rechnet aus w, h, kein Weltmass 1000x560). Liefert das Layout aus schnittLayout.
 *  schnittLayout(w, h, data)             nur das Layout, ohne zu zeichnen: {kind, u, col:{x0,x1}, gutter:{x0,x1}, labelX, top, bottom,
 *                                        y:{chip,tab,joint,base,fins,solidTop}, fins:{x0,x1,y0,y1,n}, fan:{x,y,size}|null, plume:{x,y,w,h}, arrowX}
 *                                        fuer hitTest und das Platzieren von Reglern und Schaltern ausserhalb der Saeule (data.reserve haelt Platz frei)
 *  kamera(ctx, w, h, data)               Waermebild Draufsicht (Temperaturfeld als Pixelbild, Isothermen als Vektorlinien, Fadenkreuz aus data.cursor);
 *                                        kameraTemp(w, h, data, x, y) -> {t, what}|null fuer Fadenkreuz/hitTest (gleiche Feldfunktion wie das Bild)
 *  ersatz(ctx, w, h, data)               thermisches Ersatzschaltbild mit Live-Werten und Analogietabelle
 *  balken(ctx, rect, data)               gestapelte Saeulen; data {bars:[{label, parts:{jc,ck,k}|[{key,v}], over, note}], unit, limit:{v,label},
 *                                        offset:{v,unit}, keys:{jc:'ΔT_JC',...}}; balkenData(build, name) baut data aus einem Aufbau
 *  konvektion(ctx, x, y, w, h, o)        Waermefahnen in der Box (x,y links oben); o {power W, fan, orient, t, reduced}
 *  pfeil(ctx, x0, y0, x1, y1, o)         Waermefluss-Pfeil; o {P W, level 0..1, t, label, color, reduced}; Breite w = 3 + 2,2*sqrt(P) px
 *  thermometer(ctx, x, y, h, o)          (x,y) Mitte oben der Roehre; o {value, lo, hi, tjMax, shut, destroyed, name, unit}
 *  rauch(ctx, x, y, o)                   o {t, intensity 0..1, flame:true, height px, reduced}; hoechstens 60 Partikel; (x,y) Quelle, steigt nach oben
 *  funken(ctx, x, y, o)                  o {t, size}
 *  luefter(ctx, x, y, o)                 (x,y) Mitte des Rades; o {rot, size, label, air 0..1, t, reduced}
 *  drehregler(ctx, x, y, r, o)           o {value, lo, hi, label, unit, digits, steps}; drehreglerWert(x, y, r, px, py, lo, hi, steps) fuers Ziehen
 *  kippschalter(ctx, x, y, o)            (x,y) Mitte; o {on, label, w, h}; kippBox(x, y, o) -> {x,y,w,h} Trefferfeld (mindestens 44 x 44)
 *  lampe(ctx, x, y, o)                   o {level 0..1, size}
 *  traceChart(ctx, rect, tr, o)          Messschreiber; tr {t[], tj[], tc[], tk[], ta[], p[]} (t in Prozess-s); o {tUnit, t0, t1, range, tjMax, tShut,
 *                                        names, ref:{t[],tj[]}, cursorT, marks, hide:{tc:true}, digits, colors}; Layout wie REG_DRAW.traceChart
 *  kennlinie(ctx, rect, curve, o)        curve {x[], y[]} oder {series:[{x[],y[],name,color,dash}]}; o {xRange,yRange,xLabel,yLabel,xUnit,yUnit,
 *                                        hlines,vlines,marker:{x,y,label},logX,digits}
 *  vergleich(ctx, w, h, data)            data {builds:[Aufbau,...] (2 oder 3), names:['A','B','C'], lo, hi, t, reduced, colors}
 *  Hilfen: fz (fest), fg (gekuerzt), ticks, palette, cssColors, mix, normBuild, version, fns, PAL_DARK, PAL_LIGHT, sig
 */
(function (root) {
  'use strict';

  /* ------------------------------------------------------------------ Palette */
  const PAL_DARK = {
    theme: 'dark', bg: '#14181c', panel: '#222830', panel2: '#2c343e', fg: '#e8ecf0', mute: '#9aa6b2', line: '#38424d', grid: '#26303a',
    accent: '#3b9eff', danger: '#ff5c5c', ok: '#4cd964', warn: '#ffb340',
    metal: '#8d99a6', metalDark: '#5b6672', copper: '#c8793a', plastic: '#3a3f47', silicon: '#8fa0c8', glimmer: '#b8a58a', silikon: '#7f93a8',
    paste: '#e9ecef', heat: '#ff8a3d', air: '#7fb8ff', iso: '#ffffff', isoShade: '#000000',
    sig: { tj: '#ff6b6b', tc: '#ff9f43', tk: '#ffd43b', ta: '#9aa5b1', p: '#4dabf7', jc: '#ff6b4a', ck: '#ffc233', k: '#38b6d8' }
  };
  const PAL_LIGHT = {
    theme: 'light', bg: '#f4f6f8', panel: '#ffffff', panel2: '#e9edf1', fg: '#1c232b', mute: '#55616d', line: '#c4ccd4', grid: '#dde3e8',
    accent: '#0a6fd6', danger: '#d0312d', ok: '#1f9d3a', warn: '#b86a00',
    metal: '#7a8794', metalDark: '#4a5663', copper: '#b8651f', plastic: '#59606b', silicon: '#5f73a8', glimmer: '#9c8660', silikon: '#5f7a94',
    paste: '#f1f3f5', heat: '#e8590c', air: '#2a86d8', iso: '#ffffff', isoShade: '#000000',
    sig: { tj: '#d0312d', tc: '#d9680b', tk: '#a37800', ta: '#55616d', p: '#0a6fd6', jc: '#d9432b', ck: '#c98a00', k: '#1a85a8' }
  };
  const SIG_KEYS = ['tj', 'tc', 'tk', 'ta', 'p', 'jc', 'ck', 'k'];

  const fin = v => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e7;
  const afin = v => typeof v === 'number' && isFinite(v);
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);
  const obj = o => (o && typeof o === 'object' ? o : {});
  function nz(o, k, def, lo, hi) {
    const v = o[k];
    if (!fin(v)) return def;
    return cl(v, lo === undefined ? -Infinity : lo, hi === undefined ? Infinity : hi);
  }
  const str = v => (typeof v === 'string' ? v.trim() : '');
  const goodColor = v => typeof v === 'string' && v.length > 0 && v.length < 64 && !/NaN|undefined|null/i.test(v);
  const firstNum = (...a) => { for (let i = 0; i < a.length; i++) if (fin(a[i])) return a[i]; return NaN; };

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
  function mix(a, b, t) {
    const A = parseHex(a), B = parseHex(b);
    if (!B) return typeof b === 'string' ? b : '#888888';
    if (!A || !fin(t)) return b;
    t = cl(t, 0, 1);
    const h = i => ('0' + Math.round(A[i] + (B[i] - A[i]) * t).toString(16)).slice(-2);
    return '#' + h(0) + h(1) + h(2);
  }
  /* Farbe mit Deckkraft als rgba-Text; unlesbare Farbe: unveraendert */
  function rgba(c, a) {
    const A = parseHex(c);
    return A ? 'rgba(' + A[0] + ',' + A[1] + ',' + A[2] + ',' + (Math.round(cl(a, 0, 1) * 1000) / 1000) + ')' : (typeof c === 'string' ? c : '#888888');
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
  /* fest: v mit d Nachkommastellen (Dezimalkomma, echtes Minus) */
  function fz(v, d) {
    if (!fin(v)) return '–';
    if (!(fin(d) && d >= 0 && d <= 6)) { const a = Math.abs(v); d = v === 0 ? 0 : a >= 100 ? 0 : a >= 10 ? 1 : 2; }
    d = Math.round(d);
    let s = Math.abs(v) < 0.5 * Math.pow(10, -d) ? (0).toFixed(d) : v.toFixed(d);
    s = s.replace('.', ',');
    return s.charAt(0) === '-' ? '−' + s.slice(1) : s;
  }
  /* gekuerzt: hoechstens d Nachkommastellen, ueberfluessige Nullen entfallen (Rth 1,5; 14,5; 0,167) */
  function fg(v, d) {
    if (!fin(v)) return '–';
    d = fin(d) ? cl(Math.round(d), 0, 6) : 2;
    let s = fz(v, d);
    if (d > 0 && s.indexOf(',') >= 0) s = s.replace(/0+$/, '').replace(/,$/, '');
    return s;
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
  const hsh = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

  function okCtx(ctx) {
    return !!ctx && typeof ctx === 'object' && typeof ctx.save === 'function' && typeof ctx.restore === 'function' &&
      typeof ctx.beginPath === 'function' && typeof ctx.moveTo === 'function' && typeof ctx.lineTo === 'function' &&
      typeof ctx.stroke === 'function' && typeof ctx.fill === 'function';
  }
  const okText = ctx => okCtx(ctx) && typeof ctx.fillText === 'function';
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
  function setDash(ctx, d, off) { if (typeof ctx.setLineDash === 'function') ctx.setLineDash(d); if (off !== undefined) ctx.lineDashOffset = off; }
  const NODASH = [];
  /* Verlaeufe: ohne Gradient-Funktionen des Kontexts bleibt eine Einzelfarbe (Mittelwert der Stuetzstellen) */
  function lgrad(ctx, x0, y0, x1, y1, stops) {
    if (typeof ctx.createLinearGradient !== 'function') return stops[Math.floor(stops.length / 2)][1];
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(s => g.addColorStop(cl(s[0], 0, 1), s[1]));
    return g;
  }
  function rgrad(ctx, x, y, r0, r1, stops) {
    if (typeof ctx.createRadialGradient !== 'function') return stops[0][1];
    const g = ctx.createRadialGradient(x, y, r0, x, y, Math.max(r1, r0 + 0.5));
    stops.forEach(s => g.addColorStop(cl(s[0], 0, 1), s[1]));
    return g;
  }
  const rectOk = (r, mw, mh) => !!r && typeof r === 'object' && fin(r.x) && fin(r.y) && fin(r.w) && fin(r.h) && r.w >= mw && r.h >= mh;
  const seq = a => (Array.isArray(a) || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(a) && typeof a.length === 'number') ? a : null);

  /* Text mit optionalem Hintergrund; liefert die belegte Box (fuer Ueberlappungspruefung) oder null */
  function labelRaw(ctx, P, text, x, y, align, size, bold, color, bg, maxw) {
    font(ctx, size, bold);
    let t = text;
    if (maxw > 0) t = fitText(ctx, t, maxw, size, bold);
    if (t === '') return null;
    const w = tw(ctx, t, size, bold), pad = bg ? 4 : 0;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    if (bg) { ctx.fillStyle = bg; rrect(ctx, x0 - pad, y - size * 0.75, w + 2 * pad, size * 1.5, 4); ctx.fill(); }
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color; ctx.fillText(t, x, y);
    return { x0: x0 - pad, x1: x0 + w + pad, y0: y - size * 0.75, y1: y + size * 0.75 };
  }
  const boxHit = (a, b, g) => a.x0 < b.x1 + g && a.x1 > b.x0 - g && a.y0 < b.y1 + g && a.y1 > b.y0 - g;
  /* Text nur zeichnen, wenn er keine schon belegte Box beruehrt (Liste boxes); nudges = erlaubte Verschiebungen in y */
  function tryLabel(ctx, P, boxes, text, x, y, align, size, bold, color, bg, maxw, nudges) {
    font(ctx, size, bold);
    const t = maxw > 0 ? fitText(ctx, text, maxw, size, bold) : text;
    if (t === '') return null;
    const w = tw(ctx, t, size, bold), pad = bg ? 4 : 0;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    const tries = [0].concat(nudges || []);
    for (let i = 0; i < tries.length; i++) {
      const yy = y + tries[i], box = { x0: x0 - pad, x1: x0 + w + pad, y0: yy - size * 0.75, y1: yy + size * 0.75 };
      if (!boxes.some(b => boxHit(box, b, 3))) {
        const r = labelRaw(ctx, P, t, x, yy, align, size, bold, color, bg, 0);
        if (r) boxes.push(r);
        return r;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------------ Falschfarben (perzeptuell geordnet, keine Regenbogenpalette) */
  const HEAT_STOPS = [[0, [11, 26, 107]], [0.15, [43, 26, 143]], [0.30, [106, 26, 154]], [0.45, [179, 33, 122]], [0.55, [224, 57, 47]],
    [0.70, [242, 107, 29]], [0.82, [251, 176, 45]], [0.92, [253, 231, 76]], [1, [255, 255, 255]]];
  const LUT_R = new Uint8Array(256), LUT_G = new Uint8Array(256), LUT_B = new Uint8Array(256), HEAT_HEX = [];
  (function () {
    for (let i = 0; i < 256; i++) {
      const f = i / 255; let k = 0;
      while (k < HEAT_STOPS.length - 2 && f > HEAT_STOPS[k + 1][0]) k++;
      const a = HEAT_STOPS[k], b = HEAT_STOPS[k + 1], u = cl((f - a[0]) / (b[0] - a[0]), 0, 1);
      const c = [0, 1, 2].map(j => Math.round(a[1][j] + (b[1][j] - a[1][j]) * u));
      LUT_R[i] = c[0]; LUT_G[i] = c[1]; LUT_B[i] = c[2];
      HEAT_HEX.push('#' + c.map(v => ('0' + v.toString(16)).slice(-2)).join(''));
    }
  })();
  const heatIdx = f => Math.round(cl(f, 0, 1) * 255);
  function heatColor(t, lo, hi) {
    if (!fin(t) || !fin(lo) || !fin(hi) || !(hi > lo)) return '#808080';
    return HEAT_HEX[heatIdx((t - lo) / (hi - lo))];
  }
  /* Verlauf zwischen zwei Temperaturen (oben tTop, unten tBot) mit passend vielen Stuetzstellen, optional mit Deckkraft */
  function heatGrad(ctx, x, yTop, yBot, tTop, tBot, lo, hi, alpha) {
    const span = Math.abs(tTop - tBot) / (hi - lo), n = cl(Math.ceil(span * 14) + 1, 2, 14), stops = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), tt = tTop + (tBot - tTop) * u; stops.push([u, alpha < 1 ? rgba(heatColor(tt, lo, hi), alpha) : heatColor(tt, lo, hi)]); }
    return lgrad(ctx, x, yTop, x, yBot, stops);
  }

  /* ------------------------------------------------------------------ Farbskala */
  function legend(ctx, rect, lo, hi, o) {
    if (!okText(ctx) || !rectOk(rect, 24, 10) || !fin(lo) || !fin(hi) || !(hi > lo)) return false;
    o = obj(o); const P = pal(o), unit = typeof o.unit === 'string' ? o.unit : '°C';
    const marks = (Array.isArray(o.marks) ? o.marks : []).filter(m => m && fin(m.v) && m.v >= lo && m.v <= hi).slice(0, 4);
    const horiz = rect.w >= rect.h, boxes = [];
    if (horiz ? !(rect.w - 50 > 40) : !(rect.h - 28 > 30)) return false;
    return draw(ctx, () => {
      const fs = 12;
      if (horiz) {
        const padX = 16, bx = rect.x + padX, bw = rect.w - padX - 34;
        const titleRow = str(o.title) && rect.h >= 56 ? 16 : 0, markRow = marks.length && rect.h >= 44 + titleRow ? 16 : 0;
        const barH = cl(rect.h - titleRow - markRow - 18, 8, 14), by = rect.y + titleRow + markRow + 2;
        const X = v => bx + bw * (v - lo) / (hi - lo);
        const g = lgrad(ctx, bx, 0, bx + bw, 0, [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.82, 0.92, 1].map(f => [f, HEAT_HEX[heatIdx(f)]]));
        ctx.fillStyle = g; rrect(ctx, bx, by, bw, barH, 3); ctx.fill();
        ctx.strokeStyle = P.line; ctx.lineWidth = 1; rrect(ctx, bx + 0.5, by + 0.5, bw - 1, barH - 1, 3); ctx.stroke();
        const tk = ticks(lo, hi, Math.max(3, Math.floor(bw / 70))), dg = digitsOfStep(tk.s);
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1;
        tk.t.forEach(v => { const xx = Math.round(X(v)) + 0.5; ctx.beginPath(); ctx.moveTo(xx, by + barH - 3); ctx.lineTo(xx, by + barH + 3); ctx.stroke(); });
        tryLabel(ctx, P, boxes, unit, bx + bw + 14, by + barH + 11, 'left', fs, true, P.mute, null, 0);
        tk.t.forEach(v => tryLabel(ctx, P, boxes, fz(v, dg), X(v), by + barH + 11, 'center', fs, false, P.mute, null, 0));
        if (titleRow) tryLabel(ctx, P, boxes, str(o.title), bx, rect.y + 8, 'left', fs, true, P.fg, null, 0);
        if (markRow) {
          const mk = []; marks.forEach(m => { const xx = X(m.v); mk.push({ m, xx }); });
          mk.sort((a, b) => a.xx - b.xx);
          mk.forEach(e => {
            ctx.fillStyle = P.fg; poly(ctx, [[e.xx, by + 1], [e.xx - 4, by - 6], [e.xx + 4, by - 6]], true); ctx.fill();
            ctx.strokeStyle = P.fg; ctx.beginPath(); ctx.moveTo(Math.round(e.xx) + 0.5, by); ctx.lineTo(Math.round(e.xx) + 0.5, by + barH); ctx.stroke();
            const lb = str(e.m.label) || fz(e.m.v, 0);
            tryLabel(ctx, P, boxes, lb, e.xx, by - 14, 'center', fs, true, P.fg, null, 0);
          });
        }
        return { bar: { x: bx, y: by, w: bw, h: barH }, horiz: true, toPx: X };
      }
      const bw = 12, bx = rect.x + 10, by = rect.y + 14, bh = rect.h - 28;
      const Y = v => by + bh * (1 - (v - lo) / (hi - lo));
      const g = lgrad(ctx, 0, by + bh, 0, by, [0, 0.15, 0.3, 0.45, 0.55, 0.7, 0.82, 0.92, 1].map(f => [f, HEAT_HEX[heatIdx(f)]]));
      ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
      const tk = ticks(lo, hi, Math.max(3, Math.floor(bh / 34))), dg = digitsOfStep(tk.s);
      ctx.strokeStyle = P.fg;
      tk.t.forEach(v => { const yy = Math.round(Y(v)) + 0.5; ctx.beginPath(); ctx.moveTo(bx + bw - 3, yy); ctx.lineTo(bx + bw + 3, yy); ctx.stroke(); });
      tk.t.forEach(v => tryLabel(ctx, P, boxes, fz(v, dg), bx + bw + 6, Y(v), 'left', fs, false, P.mute, null, 0));
      tryLabel(ctx, P, boxes, unit, bx, rect.y + 6, 'left', fs, true, P.mute, null, 0);
      marks.forEach(m => {
        const yy = Y(m.v);
        ctx.fillStyle = P.fg; poly(ctx, [[bx - 1, yy], [bx - 8, yy - 4], [bx - 8, yy + 4]], true); ctx.fill();
        ctx.strokeStyle = P.fg; ctx.beginPath(); ctx.moveTo(bx, Math.round(yy) + 0.5); ctx.lineTo(bx + bw, Math.round(yy) + 0.5); ctx.stroke();
        if (rect.w >= 92) tryLabel(ctx, P, boxes, str(m.label) || fz(m.v, 0), bx + bw + 40, yy, 'left', fs, true, P.fg, null, rect.w - bw - 44);
      });
      return { bar: { x: bx, y: by, w: bw, h: bh }, horiz: false, toPx: Y };
    });
  }

  /* ------------------------------------------------------------------ Waermefluss-Pfeil */
  function pfeil(ctx, x0, y0, x1, y1, o) {
    if (!okCtx(ctx) || !fin(x0) || !fin(y0) || !fin(x1) || !fin(y1)) return false;
    const L = Math.hypot(x1 - x0, y1 - y0);
    if (!(L >= 6)) return false;
    o = obj(o); const P = pal(o);
    const Pw = nz(o, 'P', 1, 0, 1e4);
    if (!(Pw > 0)) return false;
    const lvl = nz(o, 'level', 1, 0, 1), t = nz(o, 't', 0), reduced = !!o.reduced;
    const w = Math.min(cl(3 + 2.2 * Math.sqrt(Pw), 3, 24), L * 0.45);
    const color = goodColor(o.color) ? o.color : P.heat, alpha = 0.3 + 0.7 * lvl;
    const speed = cl(14 + 11 * Pw, 14, 160), seg = w * 1.5 + 8, gap = w * 0.8 + 6, period = seg + gap;
    const off = reduced ? 0 : -((t * speed) % period);
    const hl = Math.min(Math.max(10, w * 1.5 + 4), L * 0.6), hw = w * 0.95 + 3;
    const ux = (x1 - x0) / L, uy = (y1 - y0) / L, bx = x1 - ux * hl, by = y1 - uy * hl;
    return draw(ctx, () => {
      ctx.lineCap = 'butt'; ctx.lineJoin = 'round';
      /* heller/dunkler Saum, damit der Pfeil auf jeder Farbe lesbar bleibt */
      ctx.globalAlpha = alpha * 0.55; ctx.strokeStyle = P.bg; ctx.lineWidth = w + 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx + ux * 2, by + uy * 2); ctx.stroke();
      ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = w;
      setDash(ctx, [seg, gap], off);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(bx + ux * 2, by + uy * 2); ctx.stroke();
      setDash(ctx, NODASH, 0);
      const tri = [[x1, y1], [bx - uy * hw, by + ux * hw], [bx + uy * hw, by - ux * hw]];
      ctx.fillStyle = P.bg; ctx.globalAlpha = alpha * 0.55; poly(ctx, tri, true); ctx.lineWidth = 3; ctx.strokeStyle = P.bg; ctx.stroke();
      ctx.globalAlpha = alpha; ctx.fillStyle = color; poly(ctx, tri, true); ctx.fill();
      ctx.globalAlpha = 1;
      const lb = typeof o.label === 'string' ? o.label.trim() : '';
      if (lb && typeof ctx.fillText === 'function') labelRaw(ctx, P, lb, (x0 + x1) / 2, (y0 + y1) / 2, 'center', 12, true, P.fg, rgba(P.panel, 0.88), 0);
      return true;
    });
  }

  /* ------------------------------------------------------------------ Luefter */
  const FANLV = { aus: 0, leise: 0.4, mittel: 0.7, stark: 1 };
  const FANFAC = { aus: 1, leise: 0.55, mittel: 0.4, stark: 0.3 };
  function luefter(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const s = nz(o, 'size', 44, 16, 300), rot = afin(o.rot) ? o.rot : 0, air = nz(o, 'air', 0, 0, 1), t = nz(o, 't', 0), reduced = !!o.reduced;
    return draw(ctx, () => {
      ctx.lineJoin = 'round'; ctx.lineWidth = 1.5;
      ctx.fillStyle = P.panel2; ctx.strokeStyle = P.metal; rrect(ctx, x - s * 0.55, y - s * 0.55, s * 1.1, s * 1.1, s * 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.bg; ctx.beginPath(); ctx.arc(x, y, s * 0.48, 0, 2 * Math.PI); ctx.fill();
      const NB = 7, r0 = s * 0.13, r1 = s * 0.46;
      ctx.fillStyle = air > 0 ? P.air : P.metal; ctx.globalAlpha = air > 0 ? 0.9 : 0.7;
      for (let i = 0; i < NB; i++) {
        const a = rot + i * 2 * Math.PI / NB;
        const p0 = [x + Math.cos(a) * r0, y + Math.sin(a) * r0], pc = [x + Math.cos(a + 0.55) * s * 0.34, y + Math.sin(a + 0.55) * s * 0.34];
        const p1 = [x + Math.cos(a + 0.95) * r1, y + Math.sin(a + 0.95) * r1], p2 = [x + Math.cos(a + 0.5) * r0, y + Math.sin(a + 0.5) * r0];
        ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.quadraticCurveTo(pc[0], pc[1], p1[0], p1[1]); ctx.lineTo(p2[0], p2[1]); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = P.metalDark; ctx.beginPath(); ctx.arc(x, y, s * 0.1, 0, 2 * Math.PI); ctx.fill();
      if (air > 0) {
        /* Luftpfeile nach rechts in den Kuehlkoerper */
        const ph = reduced ? 0 : (t * 36) % 16;
        ctx.strokeStyle = P.air; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.45 + 0.5 * air;
        setDash(ctx, [8, 8], -ph);
        [-0.28, 0, 0.28].forEach(dy => { ctx.beginPath(); ctx.moveTo(x + s * 0.62, y + dy * s); ctx.lineTo(x + s * (0.62 + 0.3 + 0.5 * air), y + dy * s); ctx.stroke(); });
        setDash(ctx, NODASH, 0); ctx.fillStyle = P.air;
        [-0.28, 0, 0.28].forEach(dy => { const ex = x + s * (0.62 + 0.3 + 0.5 * air) + 3; poly(ctx, [[ex + 5, y + dy * s], [ex - 2, y + dy * s - 4], [ex - 2, y + dy * s + 4]], true); ctx.fill(); });
        ctx.globalAlpha = 1;
      }
      const lb = typeof o.label === 'string' ? o.label.trim() : '';
      if (lb && typeof ctx.fillText === 'function') labelRaw(ctx, P, lb, x, y + s * 0.55 + 12, 'center', 12, true, P.fg, null, 0);
      return true;
    });
  }

  /* ------------------------------------------------------------------ Konvektion: Wellenlinien und Partikel (hoechstens 80) */
  function konvektion(ctx, x, y, w, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(w) || !fin(h) || w < 8 || h < 8) return false;
    o = obj(o); const P = pal(o);
    const power = nz(o, 'power', 1, 0, 1e4);
    if (!(power > 0)) return false;
    const fanLv = typeof o.fan === 'string' && Object.prototype.hasOwnProperty.call(FANLV, o.fan) ? FANLV[o.fan] : 0;
    const bend = o.orient === 'waagrecht' ? 1 : 0, t = nz(o, 't', 0), reduced = !!o.reduced;
    const s = cl(Math.sqrt(power) / 4, 0.08, 1), speed = (0.12 + 0.2 * s) * (1 + 2.2 * fanLv);
    const nw = cl(Math.round(3 + 2 * Math.sqrt(power)), 3, 9), np = reduced ? 0 : Math.min(80, Math.round(10 + 22 * Math.sqrt(power)));
    const warm = P.heat, bx = u => bend * w * 0.4 * u * u;
    return draw(ctx, () => {
      if (typeof ctx.clip === 'function' && typeof ctx.rect === 'function') { ctx.beginPath(); ctx.rect(x - w * 0.2, y, w * 1.6, h); ctx.clip(); }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      /* Wellenlinien: drei Abschnitte mit nach oben abnehmender Deckkraft */
      for (let i = 0; i < nw; i++) {
        const xi = x + w * (i + 0.5) / nw, ph = hsh(i + 3) * 6.283, amp = w * 0.045 * (0.6 + hsh(i + 9));
        const wave = u => xi + Math.sin(6.283 * (u * 1.6) + ph - (reduced ? 0 : t * speed * 5)) * amp * (0.4 + u) + bx(u);
        for (let seg = 0; seg < 3; seg++) {
          ctx.globalAlpha = (0.55 - 0.17 * seg) * (0.5 + 0.5 * s); ctx.strokeStyle = warm; ctx.lineWidth = 2.2 - 0.5 * seg;
          ctx.beginPath();
          for (let k = 0; k <= 6; k++) {
            const u = (seg + k / 6) / 3 * 0.92 + 0.04, px = wave(u), py = y + h - u * h;
            if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
      }
      /* Partikel in vier Deckkraftstufen gesammelt */
      if (np > 0) {
        const buckets = [[], [], [], []];
        for (let j = 0; j < np; j++) {
          const h1 = hsh(j + 1), h2 = hsh(j + 77), u = ((t * speed * (0.7 + 0.6 * h2) + h1) % 1 + 1) % 1;
          const px = x + w * (0.04 + 0.92 * hsh(j * 3 + 5)) + Math.sin(u * 9 + h2 * 6.283) * w * 0.05 + bx(u), py = y + h - u * h;
          buckets[Math.min(3, Math.floor((1 - u) * 4))].push([px, py, 1.2 + 2.3 * (1 - u)]);
        }
        buckets.forEach((b, i) => {
          if (!b.length) return;
          ctx.globalAlpha = 0.18 + 0.2 * i; ctx.fillStyle = mix(warm, P.fg, 0.25); ctx.beginPath();
          b.forEach(p => { ctx.moveTo(p[0] + p[2], p[1]); ctx.arc(p[0], p[1], p[2], 0, 2 * Math.PI); });
          ctx.fill();
        });
      }
      ctx.globalAlpha = 1;
      return true;
    });
  }

  /* ------------------------------------------------------------------ Thermometer */
  function thermometer(ctx, x, y, h, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(h) || h < 40) return false;
    o = obj(o); const P = pal(o);
    let lo = nz(o, 'lo', 0), hi = nz(o, 'hi', 150);
    if (!(hi > lo)) { lo = 0; hi = 150; }
    const value = fin(o.value) ? o.value : NaN, tjMax = fin(o.tjMax) ? o.tjMax : NaN, shut = fin(o.shut) ? o.shut : NaN, dead = !!o.destroyed;
    const unit = typeof o.unit === 'string' ? o.unit : '°C', name = str(o.name);
    return draw(ctx, () => {
      const tw0 = 14, r = 12, tx = x - tw0 / 2, ty = y, by = y + h + r - 2;
      const Y = v => y + h * (1 - (cl(v, lo, hi) - lo) / (hi - lo));
      const zone = v => (dead ? P.fg : !fin(tjMax) ? P.ok : v > tjMax ? P.danger : v > tjMax - 10 ? P.warn : P.ok);
      /* Skalenzonen als Streifen rechts der Roehre, mit Strichmuster nach Zone (Farbe ist nicht allein) */
      const zx = x + tw0 / 2 + 2;
      const zones = fin(tjMax) ? [[lo, Math.max(lo, tjMax - 10), P.ok], [Math.max(lo, tjMax - 10), Math.min(hi, tjMax), P.warn], [Math.min(hi, tjMax), hi, P.danger]] : [[lo, hi, P.ok]];
      zones.forEach((z, i) => {
        if (!(z[1] > z[0])) return;
        ctx.fillStyle = z[2]; ctx.globalAlpha = 0.85; ctx.fillRect(zx, Y(z[1]), 6, Y(z[0]) - Y(z[1])); ctx.globalAlpha = 1;
        if (i === 2) { ctx.strokeStyle = P.bg; ctx.lineWidth = 1; ctx.beginPath(); for (let yy = Y(z[1]) + 4; yy < Y(z[0]); yy += 5) { ctx.moveTo(zx, yy); ctx.lineTo(zx + 6, yy - 3); } ctx.stroke(); }
      });
      /* Roehre und Kugel */
      ctx.lineWidth = 1.5; ctx.strokeStyle = P.metal; ctx.fillStyle = dead ? '#111418' : P.panel;
      rrect(ctx, tx, ty - 4, tw0, h + 6, tw0 / 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, by, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      const col = fin(value) || dead ? zone(fin(value) ? value : lo) : P.mute;
      ctx.fillStyle = dead ? '#000000' : col;
      ctx.beginPath(); ctx.arc(x, by, r - 3, 0, 2 * Math.PI); ctx.fill();
      const yv = fin(value) ? Y(value) : y + h;
      ctx.fillRect(x - 3, yv, 6, y + h + 2 - yv);
      /* Teilstriche mit Zahlen links */
      const tk = ticks(lo, hi, Math.max(3, Math.floor(h / 36))), dg = digitsOfStep(tk.s), boxes = [];
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.beginPath();
      tk.t.forEach(v => { const yy = Math.round(Y(v)) + 0.5; ctx.moveTo(tx - 4, yy); ctx.lineTo(tx, yy); });
      ctx.stroke();
      tk.t.forEach(v => tryLabel(ctx, P, boxes, fz(v, dg), tx - 6, Y(v), 'right', 12, false, P.mute, null, 0));
      /* Marke Abschalttemperatur */
      if (fin(shut) && shut >= lo && shut <= hi) {
        const ys = Y(shut);
        ctx.fillStyle = P.warn; poly(ctx, [[zx + 7, ys], [zx + 15, ys - 5], [zx + 15, ys + 5]], true); ctx.fill();
        tryLabel(ctx, P, boxes, 'T_shut ' + fz(shut, 0), zx + 18, ys, 'left', 12, true, P.warn, null, 0, [-14, 14]);
      }
      if (fin(tjMax) && tjMax >= lo && tjMax <= hi) tryLabel(ctx, P, boxes, 'Tj,max ' + fz(tjMax, 0), zx + 10, Y(tjMax), 'left', 12, true, P.danger, null, 0, [-14, 14, -28]);
      /* Wert unter der Kugel */
      const txt = dead ? 'defekt' : fin(value) ? (name ? name + ' = ' : '') + fz(value, 1) + ' ' + unit : '–';
      labelRaw(ctx, P, txt, x, by + r + 12, 'center', 12, true, dead ? P.danger : P.fg, null, 0);
      return true;
    });
  }

  /* ------------------------------------------------------------------ Rauch, Flamme, Funken */
  function rauch(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o);
    const inten = nz(o, 'intensity', 0.6, 0, 1), t = nz(o, 't', 0), flame = !!o.flame, reduced = !!o.reduced;
    if (!(inten > 0)) return false;
    const n = reduced ? 0 : Math.min(60, Math.round(10 + 50 * inten)), H = nz(o, 'height', 60 + 90 * inten, 20, 2000);
    return draw(ctx, () => {
      if (flame) {
        const fl = 14 + 10 * inten, fk = 1 + 0.12 * Math.sin(t * 17) + 0.08 * Math.sin(t * 29 + 1);
        ctx.fillStyle = rgba('#ff5a1f', 0.9); ctx.beginPath(); ctx.moveTo(x - fl * 0.45, y); ctx.quadraticCurveTo(x - fl * 0.5, y - fl * fk, x, y - fl * 2.1 * fk);
        ctx.quadraticCurveTo(x + fl * 0.5, y - fl * fk, x + fl * 0.45, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = rgba('#ffd24a', 0.95); ctx.beginPath(); ctx.moveTo(x - fl * 0.22, y); ctx.quadraticCurveTo(x - fl * 0.25, y - fl * 0.6 * fk, x, y - fl * 1.2 * fk);
        ctx.quadraticCurveTo(x + fl * 0.25, y - fl * 0.6 * fk, x + fl * 0.22, y); ctx.closePath(); ctx.fill();
      }
      if (n > 0) {
        const buckets = [[], [], []];
        for (let j = 0; j < n; j++) {
          const h1 = hsh(j + 11), h2 = hsh(j + 91), u = ((t * (0.22 + 0.2 * h2) + h1) % 1 + 1) % 1;
          const px = x + Math.sin(u * 6 + h2 * 6.283) * (8 + 26 * u) * (0.6 + h1 * 0.6) + (h1 - 0.5) * 8, py = y - u * H;
          buckets[Math.min(2, Math.floor(u * 3))].push([px, py, 4 + 14 * u * (0.6 + 0.5 * h2)]);
        }
        const cols = [mix(P.metalDark, '#000000', 0.3), P.metalDark, P.metal];
        buckets.forEach((b, i) => {
          ctx.globalAlpha = 0.34 - 0.09 * i; ctx.fillStyle = cols[i]; ctx.beginPath();
          b.forEach(p => { ctx.moveTo(p[0] + p[2], p[1]); ctx.arc(p[0], p[1], p[2], 0, 2 * Math.PI); });
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      } else {
        /* ruhige Bewegungsreduktion: statische Rauchwolken */
        ctx.globalAlpha = 0.4; ctx.fillStyle = P.metalDark;
        [0.2, 0.5, 0.8].forEach((u, i) => { ctx.beginPath(); ctx.arc(x + (i - 1) * 8, y - u * H, 5 + 12 * u, 0, 2 * Math.PI); ctx.fill(); });
        ctx.globalAlpha = 1;
      }
      return true;
    });
  }
  function funken(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), t = nz(o, 't', 0), s = nz(o, 'size', 22, 6, 200);
    return draw(ctx, () => {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const fr = Math.floor(t * 18), n = 8;
      for (let i = 0; i < n; i++) {
        const a = hsh(i * 7 + fr) * 6.283, len = s * (0.45 + 0.75 * hsh(i * 3 + fr * 5)), kink = (hsh(i + fr * 2) - 0.5) * 0.9;
        const x1 = x + Math.cos(a) * len * 0.55, y1 = y + Math.sin(a) * len * 0.55, x2 = x1 + Math.cos(a + kink) * len * 0.5, y2 = y1 + Math.sin(a + kink) * len * 0.5;
        ctx.strokeStyle = i % 2 ? '#ffe066' : '#ffffff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.95;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = '#fff6c2'; ctx.beginPath(); ctx.arc(x, y, s * 0.16, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = rgba('#ffd24a', 0.35); ctx.beginPath(); ctx.arc(x, y, s * 0.36, 0, 2 * Math.PI); ctx.fill();
      return true;
    });
  }

  /* ------------------------------------------------------------------ Drehregler, Kippschalter, Lampe */
  const KNOB_A0 = 0.75 * Math.PI, KNOB_SWEEP = 1.5 * Math.PI;
  function drehregler(ctx, x, y, r, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y) || !fin(r) || r < 14) return false;
    o = obj(o); const P = pal(o);
    let lo = nz(o, 'lo', 0), hi = nz(o, 'hi', 100); if (!(hi > lo)) { lo = 0; hi = 100; }
    const value = nz(o, 'value', lo, lo, hi), frac = (value - lo) / (hi - lo), steps = fin(o.steps) && o.steps >= 2 ? Math.min(40, Math.round(o.steps)) : 10;
    const unit = typeof o.unit === 'string' ? o.unit : '', dg = fin(o.digits) ? o.digits : undefined, lb = str(o.label);
    return draw(ctx, () => {
      ctx.lineCap = 'round';
      /* Skalenbogen mit Rastermarken */
      ctx.strokeStyle = P.line; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 7, KNOB_A0, KNOB_A0 + KNOB_SWEEP); ctx.stroke();
      ctx.strokeStyle = P.accent; ctx.beginPath(); ctx.arc(x, y, r + 7, KNOB_A0, KNOB_A0 + KNOB_SWEEP * frac); ctx.stroke();
      ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.beginPath();
      for (let i = 0; i <= steps; i++) { const a = KNOB_A0 + KNOB_SWEEP * i / steps, c = Math.cos(a), s = Math.sin(a); ctx.moveTo(x + c * (r + 3), y + s * (r + 3)); ctx.lineTo(x + c * (r + 11), y + s * (r + 11)); }
      ctx.stroke();
      /* Knopfkoerper */
      ctx.fillStyle = rgrad(ctx, x - r * 0.3, y - r * 0.3, r * 0.1, r * 1.1, [[0, P.panel2], [1, mix(P.metalDark, P.bg, 0.4)]]);
      ctx.strokeStyle = P.metal; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; ctx.moveTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); ctx.lineTo(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)); }
      ctx.stroke();
      const a = KNOB_A0 + KNOB_SWEEP * frac;
      ctx.strokeStyle = P.fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.25, y + Math.sin(a) * r * 0.25); ctx.lineTo(x + Math.cos(a) * (r - 4), y + Math.sin(a) * (r - 4)); ctx.stroke();
      if (typeof ctx.fillText === 'function') {
        if (lb) labelRaw(ctx, P, lb, x, y - r - 20, 'center', 12, true, P.fg, null, r * 3.4);
        labelRaw(ctx, P, fz(value, dg) + (unit ? ' ' + unit : ''), x, y + r + 20, 'center', 12, true, P.fg, null, r * 3.4);
      }
      return true;
    });
  }
  /* Zeigerposition -> Wert (Ziehen mit Maus/Finger); Totzone unten springt zum naeheren Ende */
  function drehreglerWert(x, y, r, px, py, lo, hi, steps) {
    if (![x, y, px, py, lo, hi].every(afin) || !(hi > lo)) return NaN;
    let a = Math.atan2(py - y, px - x) - KNOB_A0; a = ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (a > KNOB_SWEEP) a = a > KNOB_SWEEP + (2 * Math.PI - KNOB_SWEEP) / 2 ? 0 : KNOB_SWEEP;
    let f = a / KNOB_SWEEP;
    if (fin(steps) && steps >= 2) f = Math.round(f * steps) / steps;
    return lo + f * (hi - lo);
  }
  function kippBox(x, y, o) {
    if (!fin(x) || !fin(y)) return null;
    o = obj(o);
    const w = Math.max(44, nz(o, 'w', 60, 20, 400)), h = Math.max(44, nz(o, 'h', 44, 20, 400));
    return { x: x - w / 2, y: y - h / 2, w, h };
  }
  function kippschalter(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), on = !!o.on, lb = str(o.label);
    return draw(ctx, () => {
      const tw0 = 52, th = 26;
      ctx.lineJoin = 'round';
      ctx.fillStyle = on ? mix(P.panel2, P.ok, 0.55) : P.panel2; ctx.strokeStyle = on ? P.ok : P.metal; ctx.lineWidth = 2;
      rrect(ctx, x - tw0 / 2, y - th / 2 - (lb ? 6 : 0), tw0, th, th / 2); ctx.fill(); ctx.stroke();
      const cx = x + (on ? 1 : -1) * (tw0 / 2 - th / 2), cy = y - (lb ? 6 : 0);
      ctx.fillStyle = rgrad(ctx, cx - 3, cy - 3, 1, th * 0.5, [[0, P.paste], [1, P.metal]]); ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, th / 2 - 3, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      if (typeof ctx.fillText === 'function') {
        labelRaw(ctx, P, on ? 'AN' : 'AUS', x + (on ? -1 : 1) * (tw0 / 2 - th / 2 - 2), cy, 'center', 12, true, on ? P.fg : P.mute, null, 0);
        if (lb) labelRaw(ctx, P, lb, x, y + th / 2 + 4, 'center', 12, true, P.fg, null, 130);
      }
      return true;
    });
  }
  function lampe(ctx, x, y, o) {
    if (!okCtx(ctx) || !fin(x) || !fin(y)) return false;
    o = obj(o); const P = pal(o), lv = nz(o, 'level', 0, 0, 1), s = nz(o, 'size', 40, 16, 300);
    return draw(ctx, () => {
      const r = s * 0.42, cy = y - s * 0.1;
      if (lv > 0.02) { ctx.fillStyle = rgrad(ctx, x, cy, r * 0.4, r * (1.6 + lv), [[0, rgba('#ffe066', 0.55 * lv)], [1, rgba('#ffe066', 0)]]); ctx.beginPath(); ctx.arc(x, cy, r * (1.6 + lv), 0, 2 * Math.PI); ctx.fill(); }
      ctx.fillStyle = lv > 0.02 ? mix(P.panel2, '#ffe066', 0.25 + 0.7 * lv) : P.panel2; ctx.strokeStyle = P.metal; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, cy, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = lv > 0.02 ? '#fff8d6' : P.metalDark; ctx.lineWidth = 1.5; ctx.beginPath();
      ctx.moveTo(x - r * 0.4, cy + r * 0.6); ctx.lineTo(x - r * 0.4, cy - r * 0.05); ctx.lineTo(x - r * 0.2, cy + r * 0.25); ctx.lineTo(x, cy - r * 0.05); ctx.lineTo(x + r * 0.2, cy + r * 0.25); ctx.lineTo(x + r * 0.4, cy - r * 0.05); ctx.lineTo(x + r * 0.4, cy + r * 0.6);
      ctx.stroke();
      ctx.fillStyle = P.metal; ctx.strokeStyle = P.metalDark; rrect(ctx, x - r * 0.45, cy + r * 0.85, r * 0.9, r * 0.6, 3); ctx.fill(); ctx.stroke();
      return true;
    });
  }

  /* ------------------------------------------------------------------ Messschreiber (Temperaturen ueber der Prozesszeit) */
  const TK = { s: 1, min: 60, h: 3600 };
  function traceChart(ctx, rect, tr, o) {
    if (!okText(ctx) || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') return false;
    if (!rectOk(rect, 200, 120) || !tr || typeof tr !== 'object') return false;
    o = obj(o); const P = pal(o), names = obj(o.names), hide = obj(o.hide);
    const unit = typeof o.tUnit === 'string' && Object.prototype.hasOwnProperty.call(TK, o.tUnit) ? o.tUnit : 'min', k = TK[unit];
    const T = seq(tr.t) || [], n = T.length;
    const col = key => { const a = seq(tr[key]); return a && a.length >= n ? a : null; };
    const aJ = col('tj'), aC = hide.tc ? null : col('tc'), aK = hide.tk ? null : col('tk'), aA = hide.ta ? null : col('ta'), aP = col('p');
    const nm = (key, def) => str(names[key]) || def;
    const dg = fin(o.digits) ? o.digits : 1;
    let first = -1, last = -1, tmin = Infinity, tmax = -Infinity;
    for (let i = 0; i < n; i++) if (fin(T[i])) { if (T[i] < tmin) tmin = T[i]; if (T[i] > tmax) tmax = T[i]; }
    const t0 = fin(o.t0) ? o.t0 : (fin(tmin) ? tmin : 0);
    let t1 = fin(o.t1) ? o.t1 : (fin(tmax) ? tmax : 1);
    if (!(t1 > t0)) t1 = t0 + 1;
    for (let i = 0; i < n; i++) if (fin(T[i]) && T[i] >= t0 && T[i] <= t1) { if (first < 0) first = i; last = i; }
    const hasData = first >= 0 && last > first;
    const L = rect.x + 46, R = rect.x + rect.w - 8, Tp = rect.y + 24, B = rect.y + rect.h - 28, pw = R - L, ph = B - Tp;
    if (!(pw > 30) || !(ph > 30)) return false;
    const tjMax = fin(o.tjMax) ? o.tjMax : NaN, tShut = fin(o.tShut) ? o.tShut : NaN, ref = obj(o.ref), rT = seq(ref.t), rJ = seq(ref.tj);
    const showP = !!aP, gapPx = 8, uh = showP ? Math.round(ph * 0.68) : ph, lh = showP ? ph - uh - gapPx : 0;
    /* Temperaturachse */
    let ylo = Infinity, yhi = -Infinity;
    const see = v => { if (fin(v)) { if (v < ylo) ylo = v; if (v > yhi) yhi = v; } };
    if (hasData) for (let i = first; i <= last; i++) [aJ, aC, aK, aA].forEach(a => { if (a) see(a[i]); });
    see(tjMax); see(tShut);
    if (Array.isArray(o.range) && fin(o.range[0]) && fin(o.range[1]) && o.range[1] > o.range[0]) { ylo = o.range[0]; yhi = o.range[1]; }
    else if (fin(ylo) && fin(yhi)) { const pad = (yhi - ylo) * 0.1 || 5; ylo -= pad * 0.5; yhi += pad; }
    else { ylo = 0; yhi = 100; }
    const X = t => L + pw * (t - t0) / (t1 - t0), YU = v => Tp + uh * (1 - (v - ylo) / (yhi - ylo));
    let pmax = 0;
    if (showP && hasData) for (let i = first; i <= last; i++) if (fin(aP[i]) && aP[i] > pmax) pmax = aP[i];
    pmax = pmax > 0 ? pmax * 1.15 : 1;
    const YL = v => Tp + uh + gapPx + lh * (1 - v / pmax);
    const layout = {
      plot: { x: L, y: Tp, w: pw, h: ph }, upper: { x: L, y: Tp, w: pw, h: uh, lo: ylo, hi: yhi }, lower: showP ? { x: L, y: Tp + uh + gapPx, w: pw, h: lh, lo: 0, hi: pmax } : null,
      t0, t1, unit, k, timeAt: px => t0 + (px - L) / pw * (t1 - t0), pxAt: t => X(t), yAt: v => YU(v)
    };
    return draw(ctx, () => {
      const fs = 12, boxes = [];
      ctx.lineJoin = 'round';
      ctx.fillStyle = mix(P.bg, P.panel, 0.6); ctx.fillRect(L, Tp, pw, uh); if (showP) ctx.fillRect(L, Tp + uh + gapPx, pw, lh);
      font(ctx, fs, false); ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.fillStyle = P.mute;
      const tx = ticks(t0 / k, t1 / k, Math.max(3, Math.floor(pw / 80))), tdg = digitsOfStep(tx.s);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      tx.t.forEach(v => {
        const xx = Math.round(X(v * k)) + 0.5; if (xx < L || xx > R) return;
        ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + uh); if (showP) { ctx.moveTo(xx, Tp + uh + gapPx); ctx.lineTo(xx, Tp + ph); } ctx.stroke();
        ctx.fillText(fz(v, tdg), xx, B + 3);
      });
      ctx.fillText('Prozesszeit in ' + unit, L + pw / 2, B + 3 + fs + 3);
      const ty = ticks(ylo, yhi, Math.max(3, Math.floor(uh / 40))), ydg = digitsOfStep(ty.s);
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ty.t.forEach(v => { const yy = Math.round(YU(v)) + 0.5; if (yy < Tp || yy > Tp + uh) return; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); ctx.fillText(fz(v, ydg), L - 5, yy); });
      ctx.textAlign = 'left'; ctx.fillText('°C', rect.x + 2, Tp + 6);
      if (showP) {
        const tp = ticks(0, pmax, Math.max(2, Math.floor(lh / 34))), pdg = digitsOfStep(tp.s);
        ctx.textAlign = 'right';
        tp.t.forEach(v => { const yy = Math.round(YL(v)) + 0.5; if (yy < Tp + uh + gapPx || yy > Tp + ph) return; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); ctx.fillText(fz(v, pdg), L - 5, yy); });
        ctx.textAlign = 'left'; ctx.fillText('W', rect.x + 2, Tp + uh + gapPx + 6);
      }
      ctx.strokeStyle = P.metalDark; ctx.strokeRect(L + 0.5, Tp + 0.5, pw, uh); if (showP) ctx.strokeRect(L + 0.5, Tp + uh + gapPx + 0.5, pw, lh);
      /* Legende in der Kopfzeile: Linienprobe mit gleicher Linienart wie im Diagramm */
      const defs = [];
      if (aJ) defs.push([nm('tj', 'Tj'), P.sig.tj, [], 2.6]);
      if (aC) defs.push([nm('tc', 'Tc'), P.sig.tc, [8, 4], 2.2]);
      if (aK) defs.push([nm('tk', 'Tk'), P.sig.tk, [2, 4], 2.4]);
      if (aA) defs.push([nm('ta', 'Ta'), P.sig.ta, [], 1.6]);
      if (fin(tjMax)) defs.push([nm('tjMax', 'Tj,max'), P.danger, [6, 4], 1.6]);
      if (fin(tShut)) defs.push([nm('tShut', 'Abschaltung'), P.warn, [3, 3], 1.6]);
      if (rT && rJ) defs.push([nm('ref', 'früherer Lauf'), P.sig.tj, [], 2]);
      let lx = L;
      defs.forEach(d => {
        font(ctx, fs, false); const w = tw(ctx, d[0], fs, false);
        if (lx + 26 + w > R) return;
        ctx.strokeStyle = d[1]; ctx.lineWidth = d[3]; ctx.lineCap = 'round'; if (d[0] === nm('ref', 'früherer Lauf')) ctx.globalAlpha = 0.4; setDash(ctx, d[2]);
        ctx.beginPath(); ctx.moveTo(lx, rect.y + 11); ctx.lineTo(lx + 20, rect.y + 11); ctx.stroke(); setDash(ctx, NODASH); ctx.globalAlpha = 1;
        labelRaw(ctx, P, d[0], lx + 24, rect.y + 11, 'left', fs, false, P.fg, null, 0); lx += 24 + w + 12;
      });
      const clipTo = (y, h) => { ctx.save(); ctx.beginPath(); ctx.rect(L, y, pw, h); ctx.clip(); };
      /* Grenzlinien */
      clipTo(Tp, uh);
      const hline = (v, color, dash) => { if (!fin(v)) return; const yy = YU(v); ctx.strokeStyle = color; ctx.lineWidth = 1.6; setDash(ctx, dash); ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); setDash(ctx, NODASH); };
      hline(tjMax, P.danger, [6, 4]); hline(tShut, P.warn, [3, 3]);
      const stride = Math.max(1, Math.floor((last - first + 1) / (pw * 2)));
      const trace = (tt, a, color, width, dash, alpha) => {
        if (!tt || !a) return;
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.globalAlpha = alpha; setDash(ctx, dash);
        ctx.beginPath(); let pen = false; const nn = Math.min(tt.length, a.length);
        for (let i = 0; i < nn; i += stride) {
          if (!(fin(tt[i]) && fin(a[i])) || tt[i] < t0 || tt[i] > t1) { pen = false; continue; }
          const xx = X(tt[i]), yy = YU(a[i]);
          if (pen) ctx.lineTo(xx, yy); else { ctx.moveTo(xx, yy); pen = true; }
        }
        ctx.stroke(); setDash(ctx, NODASH); ctx.globalAlpha = 1;
      };
      if (hasData) {
        if (rT && rJ) trace(rT, rJ, P.sig.tj, 2, [], 0.4);
        trace(T, aA, P.sig.ta, 1.6, [], 0.85); trace(T, aK, P.sig.tk, 2.4, [2, 4], 1); trace(T, aC, P.sig.tc, 2.2, [8, 4], 1); trace(T, aJ, P.sig.tj, 2.6, [], 1);
      }
      ctx.restore();
      /* Beschriftung der Grenzlinien (ausserhalb der Beschneidung) */
      if (fin(tjMax) && tjMax >= ylo && tjMax <= yhi) tryLabel(ctx, P, boxes, nm('tjMax', 'Tj,max') + ' = ' + fz(tjMax, 0) + ' °C', R - 4, YU(tjMax) - 9, 'right', fs, true, P.danger, rgba(P.bg, 0.7), pw * 0.8, [18]);
      if (fin(tShut) && tShut >= ylo && tShut <= yhi) tryLabel(ctx, P, boxes, nm('tShut', 'Abschaltung') + ' = ' + fz(tShut, 0) + ' °C', R - 4, YU(tShut) - 9, 'right', fs, true, P.warn, rgba(P.bg, 0.7), pw * 0.8, [-18, 18, 36]);
      /* Leistungsspur */
      if (showP && hasData) {
        clipTo(Tp + uh + gapPx, lh);
        ctx.strokeStyle = P.sig.p; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); let pen = false, lx0 = 0;
        for (let i = first; i <= last; i += stride) {
          if (!(fin(T[i]) && fin(aP[i]))) { pen = false; continue; }
          const xx = X(T[i]), yy = YL(Math.max(0, aP[i]));
          if (pen) ctx.lineTo(xx, yy); else { ctx.moveTo(xx, yy); pen = true; lx0 = xx; }
        }
        ctx.stroke();
        ctx.globalAlpha = 0.18; ctx.fillStyle = P.sig.p; ctx.lineTo(X(T[last]), YL(0)); ctx.lineTo(lx0, YL(0)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
        ctx.restore();
        tryLabel(ctx, P, boxes, nm('p', 'P') + ' in W', L + 6, Tp + uh + gapPx + 9, 'left', fs, true, P.sig.p, null, 0);
      }
      /* Markierungen */
      clipTo(Tp, ph);
      (Array.isArray(o.marks) ? o.marks.slice(0, 8) : []).forEach(m => {
        if (!m || !fin(m.t) || m.t < t0 || m.t > t1) return;
        const xx = Math.round(X(m.t)) + 0.5, c = goodColor(m.color) ? m.color : P.fg;
        ctx.strokeStyle = c; ctx.lineWidth = 1; setDash(ctx, [2, 3]); ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + uh); ctx.stroke(); setDash(ctx, NODASH);
      });
      ctx.restore();
      (Array.isArray(o.marks) ? o.marks.slice(0, 8) : []).forEach(m => {
        if (!m || !fin(m.t) || m.t < t0 || m.t > t1 || !str(m.label)) return;
        tryLabel(ctx, P, boxes, str(m.label), X(m.t), Tp + uh - 8, 'center', fs, true, goodColor(m.color) ? m.color : P.fg, rgba(P.bg, 0.7), 0, [-16, -32]);
      });
      /* Fadenkreuz mit Wertanzeige */
      if (hasData && fin(o.cursorT) && o.cursorT >= t0 && o.cursorT <= t1) {
        const xx = Math.round(X(o.cursorT)) + 0.5;
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, Tp + ph); ctx.stroke();
        let bi = first, bd = Infinity;
        for (let i = first; i <= last; i++) if (fin(T[i]) && Math.abs(T[i] - o.cursorT) < bd) { bd = Math.abs(T[i] - o.cursorT); bi = i; }
        const lines = [['t = ' + fz(T[bi] / k, 1) + ' ' + unit, P.fg]];
        if (aJ) lines.push([nm('tj', 'Tj') + ' = ' + fz(aJ[bi], dg) + ' °C', P.sig.tj]);
        if (aC) lines.push([nm('tc', 'Tc') + ' = ' + fz(aC[bi], dg) + ' °C', P.sig.tc]);
        if (aK) lines.push([nm('tk', 'Tk') + ' = ' + fz(aK[bi], dg) + ' °C', P.sig.tk]);
        if (aP) lines.push([nm('p', 'P') + ' = ' + fz(aP[bi], 2) + ' W', P.sig.p]);
        font(ctx, fs, true);
        let bwid = 0; lines.forEach(l => { bwid = Math.max(bwid, tw(ctx, l[0], fs, true)); }); bwid = Math.min(bwid + 12, pw * 0.6);
        const bhh = lines.length * 16 + 6, onRight = xx < L + pw / 2, bx0 = onRight ? Math.min(xx + 6, R - bwid - 2) : Math.max(xx - 6 - bwid, L + 2);
        ctx.globalAlpha = 0.92; ctx.fillStyle = P.panel; rrect(ctx, bx0, Tp + 4, bwid, Math.min(bhh, ph - 8), 5); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = P.line; ctx.stroke();
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        lines.forEach((l, i) => { if (Tp + 4 + 14 + i * 16 > Tp + ph - 4) return; ctx.fillStyle = l[1]; ctx.fillText(fitText(ctx, l[0], bwid - 10, fs, true), bx0 + 6, Tp + 4 + 12 + i * 16); });
      }
      return layout;
    });
  }

  /* ------------------------------------------------------------------ Kennlinie */
  function kennlinie(ctx, rect, curve, o) {
    if (!okText(ctx) || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') return false;
    if (!rectOk(rect, 160, 110) || !curve || typeof curve !== 'object') return false;
    o = obj(o); const P = pal(o);
    let series = [];
    if (Array.isArray(curve.series)) series = curve.series.filter(s => s && typeof s === 'object');
    else series = [curve];
    series = series.slice(0, 6).map(s => ({ x: seq(s.x), y: seq(s.y), name: str(s.name), color: s.color, dash: s.dash, width: s.width })).filter(s => s.x && s.y && Math.min(s.x.length, s.y.length) >= 2);
    if (!series.length) return false;
    const logX = !!o.logX && series.every(s => { for (let i = 0; i < s.x.length; i++) if (fin(s.x[i]) && s.x[i] <= 0) return false; return true; });
    const dg = fin(o.digits) ? o.digits : undefined, xUnit = str(o.xUnit), yUnit = str(o.yUnit), xLabel = str(o.xLabel), yLabel = str(o.yLabel);
    const named = series.filter(s => s.name).length > 0;
    const L = rect.x + 48, R = rect.x + rect.w - 10, Tp = rect.y + (named || yLabel || yUnit ? 32 : 10), B = rect.y + rect.h - (xLabel || xUnit ? 44 : 24), pw = R - L, ph = B - Tp;
    if (!(pw > 40) || !(ph > 30)) return false;
    let xlo = Infinity, xhi = -Infinity, ylo = Infinity, yhi = -Infinity;
    series.forEach(s => { const m = Math.min(s.x.length, s.y.length); for (let i = 0; i < m; i++) if (fin(s.x[i]) && fin(s.y[i])) { xlo = Math.min(xlo, s.x[i]); xhi = Math.max(xhi, s.x[i]); ylo = Math.min(ylo, s.y[i]); yhi = Math.max(yhi, s.y[i]); } });
    if (!fin(xlo) || !fin(ylo)) return false;
    if (Array.isArray(o.xRange) && fin(o.xRange[0]) && fin(o.xRange[1]) && o.xRange[1] > o.xRange[0]) { xlo = o.xRange[0]; xhi = o.xRange[1]; }
    if (Array.isArray(o.yRange) && fin(o.yRange[0]) && fin(o.yRange[1]) && o.yRange[1] > o.yRange[0]) { ylo = o.yRange[0]; yhi = o.yRange[1]; }
    else { const pad = (yhi - ylo) * 0.08 || Math.max(1, Math.abs(yhi) * 0.1); ylo -= pad; yhi += pad; }
    if (!(xhi > xlo)) xhi = xlo + 1;
    const lxlo = logX ? Math.log(xlo) : 0, lxhi = logX ? Math.log(xhi) : 1;
    const X = v => L + pw * (logX ? (Math.log(Math.max(v, 1e-12)) - lxlo) / (lxhi - lxlo) : (v - xlo) / (xhi - xlo)), Y = v => Tp + ph * (1 - (v - ylo) / (yhi - ylo));
    const layout = { plot: { x: L, y: Tp, w: pw, h: ph }, xlo, xhi, ylo, yhi, pxX: X, pxY: Y, xAt: px => (logX ? Math.exp(lxlo + (px - L) / pw * (lxhi - lxlo)) : xlo + (px - L) / pw * (xhi - xlo)), yAt: py => ylo + (1 - (py - Tp) / ph) * (yhi - ylo) };
    return draw(ctx, () => {
      const fs = 12, boxes = [], cols = [P.accent, P.warn, P.ok, P.danger, P.sig.p, P.sig.tk];
      ctx.fillStyle = mix(P.bg, P.panel, 0.6); ctx.fillRect(L, Tp, pw, ph);
      font(ctx, fs, false); ctx.lineWidth = 1; ctx.strokeStyle = P.grid; ctx.fillStyle = P.mute;
      let xt = [], xdg = 0;
      if (logX) { for (let e = Math.floor(Math.log10(xlo)); e <= Math.ceil(Math.log10(xhi)); e++) [1, 2, 5].forEach(m => { const v = m * Math.pow(10, e); if (v >= xlo * 0.999 && v <= xhi * 1.001) xt.push(v); }); if (xt.length > 8) xt = xt.filter(v => /^[15]/.test(String(v).replace(/^0\.0*/, ''))); }
      else { const tk = ticks(xlo, xhi, Math.max(3, Math.floor(pw / 80))); xt = tk.t; xdg = digitsOfStep(tk.s); }
      xt.forEach(v => { const xx = Math.round(X(v)) + 0.5; if (xx < L - 1 || xx > R + 1) return; ctx.beginPath(); ctx.moveTo(xx, Tp); ctx.lineTo(xx, B); ctx.stroke(); });
      const ty = ticks(ylo, yhi, Math.max(3, Math.floor(ph / 40))), ydg = fin(dg) ? dg : digitsOfStep(ty.s);
      ty.t.forEach(v => { const yy = Math.round(Y(v)) + 0.5; if (yy < Tp || yy > B) return; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); });
      ctx.strokeStyle = P.metalDark; ctx.strokeRect(L + 0.5, Tp + 0.5, pw, ph);
      xt.forEach(v => { const xx = X(v); if (xx < L - 1 || xx > R + 1) return; tryLabel(ctx, P, boxes, fz(v, logX ? (v < 1 ? 2 : 0) : xdg), xx, B + 11, 'center', fs, false, P.mute, null, 0); });
      ty.t.forEach(v => { const yy = Y(v); if (yy < Tp || yy > B) return; tryLabel(ctx, P, boxes, fz(v, ydg), L - 5, yy, 'right', fs, false, P.mute, null, 0); });
      const xl = xLabel + (xUnit ? (xLabel ? ' in ' : '') + xUnit : ''), yl = yLabel + (yUnit ? (yLabel ? ' in ' : '') + yUnit : '');
      if (xl) tryLabel(ctx, P, boxes, xl, L + pw / 2, B + 32, 'center', fs, true, P.fg, null, pw);
      if (yl) tryLabel(ctx, P, boxes, yl, rect.x + 2, rect.y + 10, 'left', fs, true, P.fg, null, pw + 40);
      /* Legende */
      if (named) {
        let lx = L;
        series.forEach((s, i) => {
          if (!s.name) return;
          const c = goodColor(s.color) ? s.color : cols[i % cols.length];
          font(ctx, fs, false); const w = tw(ctx, s.name, fs, false);
          if (lx + 26 + w > R + 6) return;
          ctx.strokeStyle = c; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; setDash(ctx, Array.isArray(s.dash) && s.dash.every(v => fin(v) && v >= 0) && s.dash.some(v => v > 0) ? s.dash.slice(0, 6) : []);
          ctx.beginPath(); ctx.moveTo(lx, rect.y + 18); ctx.lineTo(lx + 20, rect.y + 18); ctx.stroke(); setDash(ctx, NODASH);
          labelRaw(ctx, P, s.name, lx + 24, rect.y + 18, 'left', fs, false, P.fg, null, 0); lx += 24 + w + 12;
        });
      }
      ctx.save(); ctx.beginPath(); ctx.rect(L, Tp, pw, ph); ctx.clip();
      (Array.isArray(o.hlines) ? o.hlines.slice(0, 6) : []).forEach(h => {
        if (!h || !fin(h.y) || h.y < ylo || h.y > yhi) return;
        const c = goodColor(h.color) ? h.color : P.danger; ctx.strokeStyle = c; ctx.lineWidth = 1.6; setDash(ctx, [6, 4]); ctx.beginPath(); ctx.moveTo(L, Y(h.y)); ctx.lineTo(R, Y(h.y)); ctx.stroke(); setDash(ctx, NODASH);
      });
      (Array.isArray(o.vlines) ? o.vlines.slice(0, 6) : []).forEach(h => {
        if (!h || !fin(h.x) || h.x < xlo || h.x > xhi) return;
        const c = goodColor(h.color) ? h.color : P.warn; ctx.strokeStyle = c; ctx.lineWidth = 1.6; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(X(h.x), Tp); ctx.lineTo(X(h.x), B); ctx.stroke(); setDash(ctx, NODASH);
      });
      series.forEach((s, i) => {
        const c = goodColor(s.color) ? s.color : cols[i % cols.length], m = Math.min(s.x.length, s.y.length), stride = Math.max(1, Math.floor(m / (pw * 2)));
        ctx.strokeStyle = c; ctx.lineWidth = fin(s.width) ? cl(s.width, 0.5, 8) : 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        setDash(ctx, Array.isArray(s.dash) && s.dash.every(v => fin(v) && v >= 0) && s.dash.some(v => v > 0) ? s.dash.slice(0, 6) : []);
        ctx.beginPath(); let pen = false;
        for (let j = 0; j < m; j += stride) {
          if (!(fin(s.x[j]) && fin(s.y[j]))) { pen = false; continue; }
          const xx = X(s.x[j]), yy = Y(s.y[j]);
          if (pen) ctx.lineTo(xx, yy); else { ctx.moveTo(xx, yy); pen = true; }
        }
        ctx.stroke(); setDash(ctx, NODASH);
      });
      const mk = obj(o.marker);
      if (fin(mk.x) && fin(mk.y) && mk.x >= xlo && mk.x <= xhi && mk.y >= ylo && mk.y <= yhi) {
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1; setDash(ctx, [2, 3]); ctx.beginPath(); ctx.moveTo(X(mk.x), B); ctx.lineTo(X(mk.x), Y(mk.y)); ctx.lineTo(L, Y(mk.y)); ctx.stroke(); setDash(ctx, NODASH);
        ctx.fillStyle = P.fg; ctx.strokeStyle = P.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(mk.x), Y(mk.y), 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
      (Array.isArray(o.hlines) ? o.hlines.slice(0, 6) : []).forEach(h => {
        if (!h || !fin(h.y) || h.y < ylo || h.y > yhi || !str(h.label)) return;
        tryLabel(ctx, P, boxes, str(h.label), R - 4, Y(h.y) - 9, 'right', fs, true, goodColor(h.color) ? h.color : P.danger, rgba(P.bg, 0.7), pw * 0.9, [18, -18]);
      });
      if (fin(mk.x) && fin(mk.y) && mk.x >= xlo && mk.x <= xhi && mk.y >= ylo && mk.y <= yhi) {
        const lb = str(mk.label) || '(' + fg(mk.x, 2) + '; ' + fg(mk.y, 2) + ')', onRight = X(mk.x) < L + pw * 0.6;
        tryLabel(ctx, P, boxes, lb, X(mk.x) + (onRight ? 10 : -10), Y(mk.y) - 14, onRight ? 'left' : 'right', fs, true, P.fg, rgba(P.panel, 0.9), pw * 0.7, [28, -14, 14]);
      }
      return layout;
    });
  }

  /* ------------------------------------------------------------------ gestapelte Saeulen (Temperaturabfaelle, Rth, einzelne Werte) */
  const BAR_ORDER = ['k', 'ck', 'jc'];
  function balken(ctx, rect, d) {
    if (!okText(ctx) || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function' || !rectOk(rect, 100, 90)) return false;
    d = obj(d); const P = pal(d);
    const keyNames = Object.assign({ jc: 'ΔT_JC', ck: 'ΔT_CK', k: 'ΔT_K' }, obj(d.keys));
    const bars = (Array.isArray(d.bars) ? d.bars : []).slice(0, 6).filter(b => b && typeof b === 'object').map(b => {
      let parts = [];
      if (Array.isArray(b.parts)) parts = b.parts.filter(p => p && typeof p === 'object' && fin(p.v) && p.v >= 0).map(p => ({ key: str(p.key), v: p.v, label: str(p.label), color: p.color }));
      else if (b.parts && typeof b.parts === 'object') BAR_ORDER.forEach(key => { if (fin(b.parts[key]) && b.parts[key] >= 0) parts.push({ key, v: b.parts[key] }); });
      return { label: typeof b.label === 'string' ? b.label : '', note: str(b.note), top: str(b.top), over: !!b.over, parts, sum: parts.reduce((a, p) => a + p.v, 0) };
    }).filter(b => b.parts.length);
    if (!bars.length) return false;
    const unit = typeof d.unit === 'string' ? d.unit : 'K', lim = obj(d.limit), off = obj(d.offset);
    const hasLim = fin(lim.v) && lim.v > 0, hasOff = fin(off.v);
    const hasNote = bars.some(b => b.note), n = bars.length;
    const L = rect.x + 44, R = rect.x + rect.w - (hasOff ? 46 : 8), Tp = rect.y + 28, B = rect.y + rect.h - (hasNote ? 46 : 32), pw = R - L, ph = B - Tp;
    if (!(pw > 40) || !(ph > 30)) return false;
    let ymax = 0; bars.forEach(b => { ymax = Math.max(ymax, b.sum); }); if (hasLim) ymax = Math.max(ymax, lim.v);
    ymax = (ymax > 0 ? ymax : 1) * 1.2;
    const Y = v => Tp + ph * (1 - v / ymax), slot = pw / n, bw = cl(slot * 0.55, 26, 100);
    const defCols = [P.sig.k, P.sig.ck, P.sig.jc, P.accent, P.warn, P.ok];
    const colorOf = (p, i) => (goodColor(p.color) ? p.color : P.sig[p.key] && (p.key === 'jc' || p.key === 'ck' || p.key === 'k') ? P.sig[p.key] : defCols[i % defCols.length]);
    const layout = { plot: { x: L, y: Tp, w: pw, h: ph }, Y, ymax, bars: bars.map((b, i) => ({ x: L + slot * (i + 0.5) - bw / 2, w: bw, top: Y(b.sum), sum: b.sum })) };
    return draw(ctx, () => {
      const fs = 12, boxes = [];
      ctx.fillStyle = mix(P.bg, P.panel, 0.6); ctx.fillRect(L, Tp, pw, ph);
      font(ctx, fs, false); ctx.lineWidth = 1; ctx.strokeStyle = P.grid;
      const ty = ticks(0, ymax, Math.max(3, Math.floor(ph / 38))), dgy = digitsOfStep(ty.s);
      ty.t.forEach(v => { const yy = Math.round(Y(v)) + 0.5; ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke(); });
      ctx.strokeStyle = P.metalDark; ctx.strokeRect(L + 0.5, Tp + 0.5, pw, ph);
      ty.t.forEach(v => tryLabel(ctx, P, boxes, fz(v, dgy), L - 5, Y(v), 'right', fs, false, P.mute, null, 0));
      tryLabel(ctx, P, boxes, unit, rect.x + 2, rect.y + 6, 'left', fs, true, P.fg, null, 0);
      if (hasOff) {
        ty.t.forEach(v => tryLabel(ctx, P, boxes, fz(v + off.v, 0), R + 5, Y(v), 'left', fs, false, P.mute, null, 0));
        tryLabel(ctx, P, boxes, str(off.unit) || '°C', R + 5, rect.y + 6, 'left', fs, true, P.fg, null, 0);
      }
      /* Legende der Glieder (Muster + Farbe + Name), aus der ersten Saeule */
      let lx = L + 4; const seen = {};
      bars[0].parts.slice().reverse().forEach((p, i0) => {
        const i = bars[0].parts.length - 1 - i0, nmk = p.label || keyNames[p.key] || p.key; if (!nmk || seen[nmk]) return; seen[nmk] = 1;
        font(ctx, fs, false); const w = tw(ctx, nmk, fs, false); if (lx + 18 + w > R) return;
        ctx.fillStyle = colorOf(p, i); ctx.fillRect(lx, rect.y + 5, 14, 12); patternFill(ctx, P, p.key, lx, rect.y + 5, 14, 12);
        ctx.strokeStyle = P.fg; ctx.lineWidth = 1; ctx.strokeRect(lx + 0.5, rect.y + 5.5, 13, 11);
        labelRaw(ctx, P, nmk, lx + 18, rect.y + 11, 'left', fs, false, P.fg, null, 0); lx += 18 + w + 12;
      });
      /* Grenzlinie: Linie zuerst, die Beschriftung kommt nach den Saeulen (liegt dann oben, ihr Platz ist vorher reserviert) */
      let limLab = null;
      if (hasLim) {
        ctx.save(); ctx.beginPath(); ctx.rect(L, Tp, pw, ph); ctx.clip();
        ctx.strokeStyle = P.danger; ctx.lineWidth = 2; setDash(ctx, [7, 4]); ctx.beginPath(); ctx.moveTo(L, Y(lim.v)); ctx.lineTo(R, Y(lim.v)); ctx.stroke(); setDash(ctx, NODASH);
        ctx.restore();
        font(ctx, fs, true);
        const lt = fitText(ctx, str(lim.label) || 'Grenze ' + fz(lim.v, 0) + ' ' + unit, pw * 0.7, fs, true), lw = tw(ctx, lt, fs, true);
        limLab = { text: lt, x: L + 6, y: Y(lim.v) - 11 };
        boxes.push({ x0: L + 2, x1: L + 10 + lw, y0: limLab.y - 10, y1: limLab.y + 10 });
      }
      bars.forEach((b, bi) => {
        const bx = L + slot * (bi + 0.5) - bw / 2; let acc = 0;
        b.parts.forEach((p, i) => {
          const y0 = Y(acc), y1 = Y(acc + p.v), hgt = y0 - y1; acc += p.v;
          if (!(hgt > 0.2)) return;
          ctx.fillStyle = colorOf(p, i); ctx.fillRect(bx, y1, bw, hgt); patternFill(ctx, P, p.key, bx, y1, bw, hgt);
          ctx.strokeStyle = P.bg; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, y1 + 0.5, bw - 1, hgt - 1);
          if (hgt >= 16) {
            const txt = fz(p.v, 1) + ' ' + unit;
            font(ctx, fs, true);
            const shown = tw(ctx, txt, fs, true) <= bw - 4 ? txt : (tw(ctx, fz(p.v, 1), fs, true) <= bw - 4 ? fz(p.v, 1) : '');
            if (shown) { const r = labelRaw(ctx, P, shown, bx + bw / 2, (y0 + y1) / 2, 'center', fs, true, P.fg, rgba(P.bg, 0.78), 0); if (r) boxes.push(r); }
            else tryLabel(ctx, P, boxes, txt, bx + bw + 6, (y0 + y1) / 2, 'left', fs, true, P.fg, rgba(P.bg, 0.78), 0, [-16, 16, -32, 32]);
          } else if (hgt > 0.2) tryLabel(ctx, P, boxes, fz(p.v, 1) + ' ' + unit, bx + bw + 6, (y0 + y1) / 2, 'left', fs, true, P.fg, rgba(P.bg, 0.78), 0, [-16, 16, -32, 32]);
        });
        if (b.over) { ctx.strokeStyle = P.danger; ctx.lineWidth = 3; ctx.strokeRect(bx - 1.5, Y(b.sum) - 1.5, bw + 3, Y(0) - Y(b.sum) + 3); }
        const top = b.top || (fz(b.sum, 1) + ' ' + unit);
        const placed = tryLabel(ctx, P, boxes, top, bx + bw / 2, Y(b.sum) - 11, 'center', fs, true, P.fg, null, 0, [-16]) || tryLabel(ctx, P, boxes, fz(b.sum, 1) + ' ' + unit, bx + bw / 2, Y(b.sum) - 11, 'center', fs, true, P.fg, null, 0, [-16, -32]);
        if (b.over && placed) tryLabel(ctx, P, boxes, 'über der Grenze', bx + bw / 2, placed.y0 - 12, 'center', fs, true, P.danger, null, 0);
        labelRaw(ctx, P, b.label, bx + bw / 2, B + 14, 'center', fs, true, P.fg, null, slot - 4);
        if (b.note) labelRaw(ctx, P, b.note, bx + bw / 2, B + 30, 'center', fs, false, P.mute, null, slot - 4);
      });
      if (limLab) labelRaw(ctx, P, limLab.text, limLab.x, limLab.y, 'left', fs, true, P.danger, rgba(P.bg, 0.8), 0);
      return layout;
    });
  }
  /* Muster je Glied (Farbe ist nicht der einzige Traeger): jc voll, ck Schraegstriche, k Punkte */
  function patternFill(ctx, P, key, x, y, w, h) {
    if (!(w > 2) || !(h > 2) || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') return;
    if (key !== 'ck' && key !== 'k') return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = rgba(P.bg, 0.45); ctx.fillStyle = rgba(P.bg, 0.45); ctx.lineWidth = 1.5;
    if (key === 'ck') {
      ctx.beginPath(); for (let i = -h; i < w; i += 7) { ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); } ctx.stroke();
    } else {
      ctx.beginPath(); for (let yy = y + 3; yy < y + h; yy += 7) for (let xx = x + 3 + ((Math.round(yy) % 14) ? 3 : 0); xx < x + w; xx += 7) { ctx.moveTo(xx + 1.4, yy); ctx.arc(xx, yy, 1.4, 0, 2 * Math.PI); }
      ctx.fill();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------------ Aufbau-Objekt normieren */
  /* Kuehlkoerpertypen: n Rippen, Hoehe in Einheiten (u), Rippenparameter m*L fuer die Ersatzkurve, Anzeigename */
  const HS = {
    fahne: { n: 2, h: 34, mL: 0.7, name: 'Fahnenkühlkörper' }, s: { n: 5, h: 80, mL: 1.0, name: 'Profil klein' }, m: { n: 7, h: 130, mL: 1.2, name: 'Profil mittel' },
    l: { n: 9, h: 190, mL: 1.5, name: 'Profil groß' }, xl: { n: 11, h: 240, mL: 1.8, name: 'Rippenkörper XL' }, blech: { n: 1, h: 90, mL: 0.8, name: 'Kühlblech' },
    custom: { n: 7, h: 130, mL: 1.2, name: 'Kühlkörper' }
  };
  const JOINTS = { direkt: 1, glimmer: 1, silikon: 1 }, PASTES = { keine: 1, duenn: 1, dick: 1 };
  const SYM0 = { tj: 'Tj', tc: 'Tc', tk: 'Tk', ta: 'Ta', rthJC: 'Rth_JC', rthCK: 'Rth_CK', rthK: 'Rth_K', rthJA: 'Rth_JA', P: 'P', tjMax: 'Tj,max' };
  function normBuild(d) {
    d = obj(d);
    const b = { device: str(d.device), pkg: str(d.pkg) };
    const hsel = typeof d.heatsink === 'string' && HS[d.heatsink] ? d.heatsink : 'none';
    b.mode = d.mode === 'kk' ? 'kk' : d.mode === 'frei' ? 'frei' : (hsel === 'none' ? 'frei' : 'kk');
    b.heatsink = b.mode === 'frei' ? 'none' : (hsel === 'none' ? 'm' : hsel);
    b.joint = JOINTS[d.joint] ? d.joint : 'direkt'; b.paste = PASTES[d.paste] ? d.paste : 'keine';
    b.bushing = d.bushing === undefined ? true : !!d.bushing; b.screw = d.screw === 'locker' ? 'locker' : 'fest';
    b.fan = typeof d.fan === 'string' && Object.prototype.hasOwnProperty.call(FANLV, d.fan) ? d.fan : 'aus'; b.orient = d.orient === 'waagrecht' ? 'waagrecht' : 'senkrecht';
    b.blechA = nz(d, 'blechA', 100, 10, 400);
    b.P = Math.max(0, firstNum(d.P, d.pv, d.p, 0)); b.ta = firstNum(d.ta, 25);
    b.rthJC = Math.max(0, firstNum(d.rthJC, 0)); b.rthK = b.mode === 'frei' ? 0 : Math.max(0, firstNum(d.rthK, 0)); b.rthCK = b.mode === 'frei' ? 0 : Math.max(0, firstNum(d.rthCK, 0));
    b.rthTotal = firstNum(d.rthTotal, b.rthJC + b.rthCK + b.rthK);
    b.rthCA = firstNum(d.rthCA, Math.max(0, b.rthTotal - b.rthJC));
    b.dJC = firstNum(d.dJC, b.P * b.rthJC);
    if (b.mode === 'frei') {
      b.dCK = 0; b.dK = 0; b.dCA = firstNum(d.dCA, b.P * b.rthCA);
      b.tc = firstNum(d.tc, b.ta + b.dCA); b.tk = b.tc; b.tj = firstNum(d.tj, b.tc + b.dJC);
    } else {
      b.dCK = firstNum(d.dCK, b.P * b.rthCK); b.dK = firstNum(d.dK, b.P * b.rthK); b.dCA = 0;
      b.tk = firstNum(d.tk, b.ta + b.dK); b.tc = firstNum(d.tc, b.tk + b.dCK); b.tj = firstNum(d.tj, b.tc + b.dJC);
    }
    b.tjMax = firstNum(d.tjMax, NaN); b.tShut = firstNum(d.tShut, NaN); b.tL = firstNum(d.tL, NaN);
    b.lo = firstNum(d.lo, b.ta); b.hi = firstNum(d.hi, fin(b.tjMax) ? b.tjMax + 30 : Math.max(b.tj + 10, b.lo + 20));
    if (!(b.hi > b.lo)) b.hi = b.lo + 30;
    const fa = seq(d.fin); b.fin = fa && fa.length >= 2 && Array.prototype.every.call(fa, fin) ? Array.prototype.slice.call(fa, 0, 64) : null;
    b.shutdown = !!d.shutdown; b.destroyed = !!d.destroyed; b.short = !!d.short;
    b.over = fin(b.tjMax) && b.tj > b.tjMax;
    b.level = nz(d, 'level', 1, 0, 1); b.t = nz(d, 't', 0); b.reduced = !!d.reduced;
    b.rthK0 = firstNum(d.rthK0, NaN); b.fanFactor = firstNum(d.fanFactor, NaN); b.orientFactor = firstNum(d.orientFactor, NaN);
    b.sym = Object.assign({}, SYM0); if (d.sym && typeof d.sym === 'object') Object.keys(SYM0).forEach(k => { if (str(d.sym[k])) b.sym[k] = str(d.sym[k]).slice(0, 14); });
    b.heatsinkName = str(d.heatsinkName); b.jointName = str(d.jointName); b.fahneText = str(d.fahneText); b.ksText = str(d.ksText);
    b.compact = !!d.compact; b.autoscale = !!d.autoscale; b.colors = d.colors; b.reserve = d.reserve; b.legend = d.legend; b.cursor = d.cursor; b.cth = obj(d.cth);
    b.analogie = Array.isArray(d.analogie) ? d.analogie : null;
    return b;
  }
  function pkgKind(b) {
    const s = (b.pkg + ' ' + b.device).toLowerCase();
    if (/zement/.test(s)) return 'zement';
    if (/do-?201|axial|1n4007|diode/.test(s)) return 'diode';
    if (/led/.test(s)) return 'led';
    if (/alu/.test(s)) return 'alu';
    if (/126|bd139/.test(s)) return 'to126';
    return 'to220';
  }
  /* Koerperformen: hp Kunststoff/Platine, ht Fahne, bf Anteil der Breite, cwf Chipbreite, chH Chiphoehe (Einheiten u) */
  const KIND = {
    to220: { hp: 56, ht: 12, bf: 0.62, cwf: 0.30, chH: 16, tex: 'plastic', head: 'Gehäuse' },
    to126: { hp: 44, ht: 9, bf: 0.55, cwf: 0.26, chH: 13, tex: 'plastic', head: 'Gehäuse' },
    alu: { hp: 50, ht: 14, bf: 0.74, cwf: 0.46, chH: 14, tex: 'al', head: 'Alu-Gehäuse' },
    led: { hp: 22, ht: 6, bf: 0.86, cwf: 0.16, chH: 8, tex: 'al', head: 'Sternplatine' },
    zement: { hp: 70, ht: 0, bf: 0.7, cwf: 0.5, chH: 40, tex: 'zement', head: 'Zementkörper' },
    diode: { hp: 40, ht: 0, bf: 0.7, cwf: 0.3, chH: 14, tex: 'plastic', head: 'Diodenkörper' }
  };
  /* Schichten des Uebergangs von unten (Fahne) nach oben (Kuehlkoerper): k, Dicke in u, Gewicht fuer die Verteilung von dT_CK */
  function jointLayers(b) {
    const L = [], ph = b.paste === 'dick' ? 9 : b.paste === 'duenn' ? 3 : 0;
    if (b.joint === 'direkt') {
      if (b.paste === 'keine') L.push({ k: 'gap', h: 3, w: 3 }); else L.push({ k: 'paste', h: ph, w: b.paste === 'dick' ? 2.4 : 1 });
    } else {
      const pk = b.joint, ph2 = b.joint === 'glimmer' ? 10 : 9, pw = b.joint === 'glimmer' ? 4 : 3;
      if (b.paste === 'keine') { L.push({ k: 'gap', h: 2, w: 2.5 }); L.push({ k: pk, h: ph2, w: pw }); L.push({ k: 'gap', h: 2, w: 2.5 }); }
      else { const pp = ph * 0.6, ppw = b.paste === 'dick' ? 1.3 : 0.6; L.push({ k: 'paste', h: pp, w: ppw }); L.push({ k: pk, h: ph2, w: pw }); L.push({ k: 'paste', h: pp, w: ppw }); }
    }
    return L;
  }
  /* Verdeckte Fehler: waehrend einer Fehlersuche-Aufgabe (THM_VEIL, von der Oberflaeche gesetzt) tragen Beschriftungen keinen Fehlernamen; die Zeichnung selbst bleibt */
  const veil = id => { try { return !!(root.THM_VEIL && root.THM_VEIL[id]); } catch (e) { return false; } };
  function jointText(b) {
    if (veil('paste-fehlt') && b.paste === 'keine') return b.joint === 'direkt' ? 'direkt' : b.joint === 'glimmer' ? 'Glimmer' : 'Silikonfolie';
    if (b.jointName) return b.jointName;
    const pa = b.paste === 'keine' ? 'trocken' : b.paste === 'dick' ? 'dicke Paste' : 'Paste';
    if (b.joint === 'direkt') return b.paste === 'keine' ? 'direkt, trocken' : 'direkt + ' + pa;
    const pad = b.joint === 'glimmer' ? 'Glimmer' : 'Silikonfolie';
    return b.paste === 'keine' ? pad + ', trocken' : pad + ' + ' + (b.paste === 'dick' ? 'dicke Paste' : 'Paste');
  }
  /* Temperatur entlang der Rippe: Frac 0 = Fuss, 1 = Spitze (Feld b.fin oder cosh-Modell) */
  function finTemp(b, f) {
    f = cl(f, 0, 1);
    if (b.fin) { const n = b.fin.length - 1, p = f * n, i = Math.min(n - 1, Math.floor(p)); return b.fin[i] + (b.fin[i + 1] - b.fin[i]) * (p - i); }
    const hs = HS[b.heatsink] || HS.m, mL = hs.mL;
    return b.ta + (b.tk - b.ta) * Math.cosh(mL * (1 - f)) / Math.cosh(mL);
  }

  /* Abstand der Isothermen: 10 K, bei grossem Temperaturbereich gröber, damit hoechstens neun Linien entstehen */
  function isoStep(lo, tmax) {
    const st = [10, 20, 25, 50, 100, 200];
    for (let i = 0; i < st.length; i++) if ((tmax - lo) / st[i] <= 9) return st[i];
    return 500;
  }

  /* ------------------------------------------------------------------ Schnittbild: Layout */
  function geomOf(rect, b, o) {
    const kind = pkgKind(b), K = KIND[kind];
    const compact = !!(o.compact || b.compact || rect.w < 300);
    const res = obj(o.reserve || b.reserve);
    const rl = nz(res, 'left', 0, 0, rect.w * 0.45), rr = nz(res, 'right', 0, 0, rect.w * 0.45), rt = nz(res, 'top', 0, 0, rect.h * 0.4), rb = nz(res, 'bottom', 0, 0, rect.h * 0.4);
    const x0 = rect.x + rl, y0 = rect.y + rt, W = Math.max(40, rect.w - rl - rr), H = Math.max(40, rect.h - rt - rb);
    const pad = 8, tableH = o.table ? 36 : 0, legendH = (o.legend === false || b.legend === false || compact) ? 0 : 50, tiny = W < 220;
    const gutter = tiny ? 24 : compact ? 44 : cl(W * 0.12, 48, 90);
    const labelW = tiny ? 0 : compact ? cl(W * 0.34, 84, 170) : cl(W * 0.40, 130, 330), isoW = (compact || tiny) ? 0 : 42;
    const cw = cl(W - 2 * pad - gutter - labelW - isoW, 40, compact ? 150 : 260);
    const groupW = gutter + cw + isoW + labelW, gx0 = x0 + Math.max(pad, (W - groupW) / 2), cx0 = gx0 + gutter, cx1 = cx0 + cw, labelX = cx1 + isoW + 8;
    const top = y0 + pad, ledExtra = kind === 'led' ? 46 : 0, bottom = y0 + H - pad - legendH - tableH - ledExtra, Hav = Math.max(60, bottom - top);
    const kk = b.mode === 'kk' && kind !== 'zement' && kind !== 'diode', hs = kk ? (HS[b.heatsink] || HS.m) : null;
    const finU = kk ? (b.heatsink === 'blech' ? 60 + Math.sqrt(b.blechA) * 9 : hs.h) : 0, jl = kk ? jointLayers(b) : [];
    const jointU = jl.reduce((a, l) => a + l.h, 0), baseU = kk ? 26 : 0, totalU = K.hp + K.ht + jointU + baseU + finU + (kk ? 70 : 120);
    const u = cl(Hav / totalU, 0.2, kk ? 1.6 : 2.4), px = v => Math.max(1.5, v * u);
    const G = { kind, K, compact, tiny, kk, u, x0, y0, W, H, pad, gutter, labelW, isoW, cw, gx0, cx0, cx1, labelX, top, bottom, legendH, tableH, hs, jl, rect };
    G.yPl1 = bottom; G.yPl0 = bottom - px(K.hp); G.yTab1 = G.yPl0; G.yTab0 = G.yTab1 - (K.ht > 0 ? px(K.ht) : 0);
    let y = G.yTab0; G.layers = [];
    jl.forEach(l => { const h = px(l.h); G.layers.push({ k: l.k, w: l.w, y0: y - h, y1: y }); y -= h; });
    G.yJ0 = y; G.yBase1 = y; G.yBase0 = kk ? y - px(baseU) : y; G.yFin1 = G.yBase0; G.yFin0 = kk ? G.yFin1 - px(finU) : G.yFin1;
    G.solidTop = kk ? G.yFin0 : G.yTab0; G.airFade = Math.max(0, Math.min(60 * u + 10, G.solidTop - top));
    G.bodyX1 = cx0 + K.bf * cw; G.chipW = Math.max(6, cw * K.cwf); G.chipH = px(K.chH);
    G.chipX0 = cx0 + (K.bf * cw - G.chipW) / 2; G.chipY1 = bottom - Math.min(px(4), px(K.hp) * 0.2); G.chipY0 = G.chipY1 - G.chipH;
    G.chipCy = (G.chipY0 + G.chipY1) / 2;
    G.xs = cx0 + (K.bf + (1 - K.bf) / 2) * cw; G.shankW = Math.max(5, cw * 0.06);
    /* Rippen */
    G.fins = null;
    if (kk) {
      const n = hs.n, horiz = b.orient === 'waagrecht';
      G.fins = { n, horiz, x0: cx0, x1: cx1, y0: G.yFin0, y1: G.yFin1, list: [] };
      if (!horiz) {
        const fw = b.heatsink === 'blech' ? Math.max(6, cw * 0.14) : Math.min(n <= 3 ? 9 : 99, Math.max(2.5, cw / (2 * n))), pitch = n > 1 ? (cw - fw) / (n - 1) : 0;
        for (let i = 0; i < n; i++) G.fins.list.push({ x: n > 1 ? cx0 + i * pitch : cx0 + (cw - fw) / 2, w: fw });
        G.fins.fw = fw;
      } else {
        const ns = Math.max(2, n), pitch = (G.yFin1 - G.yFin0) / ns, th = Math.max(2.5, pitch * 0.45);
        for (let i = 0; i < ns; i++) G.fins.list.push({ y: G.yFin1 - (i + 1) * pitch + (pitch - th) / 2, h: th });
        G.fins.spine = Math.max(6, cw * 0.12);
      }
    }
    /* Luefter */
    G.fan = null;
    if (kk && b.fan !== 'aus' && !tiny) { const s = cl(Math.min(gutter - 8, (G.yFin1 - G.yFin0) * 0.9), 26, 52); G.fan = { x: gx0 + gutter / 2, y: G.yFin0 + s * 0.55 + 2, size: s, air: FANLV[b.fan] }; }
    G.plume = { x: cx0, y: top, w: cw, h: Math.max(0, G.solidTop - top - 2) };
    G.arrowX = gx0 + gutter / 2;
    return G;
  }

  /* ------------------------------------------------------------------ Schnittbild: Zeichnen */
  /* Texturen innerhalb eines Rechtecks (Material ist nicht allein an der Farbe erkennbar) */
  function texFill(ctx, P, kind, x, y, w, h) {
    if (!(w > 2) || !(h > 1.5) || typeof ctx.clip !== 'function' || typeof ctx.rect !== 'function') return;
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (kind === 'cu') {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.beginPath(); for (let yy = y + 2; yy < y + h; yy += 4) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } ctx.stroke();
    } else if (kind === 'plastic' || kind === 'zement') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); for (let yy = y + 3; yy < y + h; yy += 7) for (let xx = x + 3 + ((Math.round(yy / 7) % 2) ? 3.5 : 0); xx < x + w; xx += 7) { ctx.moveTo(xx + 1.2, yy); ctx.arc(xx, yy, 1.2, 0, 2 * Math.PI); } ctx.fill();
    } else if (kind === 'al') {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x + 3; xx < x + w; xx += 5) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); } ctx.stroke();
    } else if (kind === 'glimmer') {
      ctx.fillStyle = rgba(P.glimmer, 0.34); ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 1; k < 4; k++) { const yy = y + h * k / 4; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } ctx.stroke();
    } else if (kind === 'silikon') {
      ctx.fillStyle = rgba(P.silikon, 0.4); ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); for (let xx = x - h; xx < x + w; xx += 6) { ctx.moveTo(xx, y + h); ctx.lineTo(xx + h, y); } ctx.stroke();
    } else if (kind === 'paste') {
      ctx.fillStyle = rgba(P.paste, 0.38); ctx.fillRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.fillRect(x, y, w, Math.max(1, h * 0.28));
    } else if (kind === 'gap') {
      ctx.fillStyle = rgba(P.bg, 0.6); ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = rgba(P.fg, 0.55); ctx.lineWidth = 1; setDash(ctx, [3, 3]); ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke(); setDash(ctx, NODASH);
    }
    ctx.restore();
  }
  function placeLabels(items, minY, maxY, gap) {
    items.sort((a, b) => a.cy - b.cy);
    items.forEach(it => { it.y0 = it.cy - it.h / 2; });
    for (let i = 0; i < items.length; i++) {
      if (items[i].y0 < minY) items[i].y0 = minY;
      if (i && items[i].y0 < items[i - 1].y0 + items[i - 1].h + gap) items[i].y0 = items[i - 1].y0 + items[i - 1].h + gap;
    }
    for (let i = items.length - 1; i >= 0; i--) {
      const lim = i === items.length - 1 ? maxY : items[i + 1].y0 - gap;
      if (items[i].y0 + items[i].h > lim) items[i].y0 = lim - items[i].h;
    }
    return items;
  }
  const T1 = v => fz(v, 1) + ' °C', K1 = v => fz(v, 1) + ' K', RW = v => fg(v, 2) + ' K/W';

  function drawPanel(ctx, P, rect, b, o) {
    const G = geomOf(rect, b, o), { u, cx0, cx1, cw, K, kind } = G, lo = b.lo, hi = b.hi, S = b.sym, boxes = [], fs = 12, t = b.t, red = b.reduced;
    const tjCol = b.destroyed ? '#101114' : b.shutdown ? mix(heatColor(b.tj, lo, hi), P.metalDark, 0.6) : heatColor(b.tj, lo, hi);
    const outline = rgba(P.fg, 0.55);
    ctx.lineJoin = 'round';
    /* Profil der Temperatur ueber die Hoehe (unten -> oben) fuer Isothermen */
    const segs = [];
    const seg = (ya, yb, ta_, tb_) => { if (ya - yb > 0.01) segs.push({ ya, yb, ta: ta_, tb: tb_ }); };
    seg(G.yPl1, G.yPl0, b.tj, b.tc);
    seg(G.yPl0, G.yTab0, b.tc, b.tc);
    if (kind === 'zement') { segs.length = 0; seg(G.yPl1, G.yPl0, b.tj, b.tj); }
    if (G.kk) {
      const W = G.layers.reduce((a, l) => a + l.w, 0) || 1; let acc = 0;
      G.layers.forEach(l => { const ta_ = b.tc - b.dCK * acc / W; acc += l.w; seg(l.y1, l.y0, ta_, b.tc - b.dCK * acc / W); });
      if (!G.layers.length) seg(G.yTab0, G.yBase1, b.tc, b.tk);
      seg(G.yBase1, G.yBase0, b.tk, b.tk);
      seg(G.yFin1, G.yFin0, b.tk, finTemp(b, 1));
    }
    const tipT = G.kk ? finTemp(b, 1) : (kind === 'zement' || kind === 'diode' ? b.tj : b.tc);
    const solidTop = kind === 'zement' ? G.yPl0 : G.solidTop;
    if (G.airFade > 0) seg(solidTop, solidTop - G.airFade, tipT, b.ta);
    const tAt = y => { for (let i = 0; i < segs.length; i++) { const s = segs[i]; if (y <= s.ya + 0.01 && y >= s.yb - 0.01) return s.ta + (s.tb - s.ta) * (s.ya - y) / (s.ya - s.yb); } return NaN; };
    const gradSegs = (ya, yb, samples) => { const n = samples.length, stops = samples.map((s, i) => [i / (n - 1), heatColor(s, lo, hi)]); return lgrad(ctx, 0, yb, 0, ya, stops); };
    const layerFill = (x, y0, w, ya, yb) => {
      /* Verlauf aus dem Profil: Stuetzstellen entlang y */
      const n = cl(Math.ceil(Math.abs(tAt(ya) - tAt(yb)) / (hi - lo) * 14) + 2, 2, 14), sm = [];
      for (let i = 0; i < n; i++) { const yy = yb + (ya - yb) * i / (n - 1); const v = tAt(yy); sm.push(fin(v) ? v : b.ta); }
      ctx.fillStyle = gradSegs(ya, yb, sm); ctx.fillRect(x, y0, w, ya - yb);
    };
    /* Warmer Hof ueber den Rippen (Luft), unter allem anderen */
    if (G.kk || kind === 'zement' || kind === 'diode' || G.airFade > 0) {
      const hy = solidTop - G.airFade * 0.2, hr = Math.max(cw * 0.8, G.airFade);
      ctx.fillStyle = rgrad(ctx, (cx0 + cx1) / 2, hy, 4, hr, [[0, rgba(heatColor(tipT, lo, hi), 0.55 * (0.3 + 0.7 * b.level))], [1, rgba(heatColor(tipT, lo, hi), 0)]]);
      ctx.beginPath(); ctx.rect(cx0 - cw * 0.3, G.top, cw * 1.6, Math.max(0, solidTop - G.top)); if (typeof ctx.clip === 'function') { ctx.save(); ctx.clip(); ctx.fillRect(cx0 - cw * 0.3, G.top, cw * 1.6, Math.max(0, solidTop - G.top)); ctx.restore(); }
    }
    /* ---- Koerper ---- */
    if (kind === 'diode') drawDiode(ctx, P, G, b, outline);
    else if (kind === 'zement') {
      layerFill(cx0 + cw * 0.15, G.yPl0, cw * 0.7, G.yPl1, G.yPl0);
      texFill(ctx, P, 'zement', cx0 + cw * 0.15, G.yPl0, cw * 0.7, G.yPl1 - G.yPl0);
      ctx.strokeStyle = outline; ctx.lineWidth = 1.5; rrect(ctx, cx0 + cw * 0.15, G.yPl0, cw * 0.7, G.yPl1 - G.yPl0, 6); ctx.stroke();
      ctx.strokeStyle = P.metal; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx0 + cw * 0.15, G.yPl1 - 8); ctx.lineTo(cx0 + cw * 0.02, G.yPl1 - 8); ctx.moveTo(cx0 + cw * 0.85, G.yPl1 - 8); ctx.lineTo(cx0 + cw * 0.98, G.yPl1 - 8); ctx.stroke();
      /* Waermestrahlung als Wellen */
      ctx.strokeStyle = rgba(P.heat, 0.7); ctx.lineWidth = 2; ctx.lineCap = 'round';
      [0.3, 0.5, 0.7].forEach((fx, i) => { ctx.beginPath(); for (let k = 0; k <= 8; k++) { const yy = G.yPl0 - 4 - k * 6, xx = cx0 + cw * fx + Math.sin(k * 1.3 + i + (red ? 0 : t * 3)) * 4; if (k) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); } ctx.stroke(); });
    } else {
      /* Kunststoff/Platine: Verlauf Tj (unten) -> Tc (oben) */
      layerFill(cx0, G.yPl0, G.bodyX1 - cx0, G.yPl1, G.yPl0);
      texFill(ctx, P, K.tex, cx0, G.yPl0, G.bodyX1 - cx0, G.yPl1 - G.yPl0);
      ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.strokeRect(cx0 + 0.75, G.yPl0 + 0.75, G.bodyX1 - cx0 - 1.5, G.yPl1 - G.yPl0 - 1.5);
      /* Chip mit Gluehen */
      const glowR = Math.max(G.chipW, 26) * (0.9 + 0.3 * cl((b.tj - lo) / (hi - lo), 0, 1));
      ctx.save(); ctx.beginPath(); if (typeof ctx.rect === 'function') ctx.rect(cx0, G.yPl0, G.bodyX1 - cx0, G.yPl1 - G.yPl0); if (typeof ctx.clip === 'function') ctx.clip();
      ctx.fillStyle = rgrad(ctx, G.chipX0 + G.chipW / 2, G.chipCy, 2, glowR, [[0, rgba(tjCol, b.destroyed ? 0 : 0.8)], [1, rgba(tjCol, 0)]]); ctx.fillRect(cx0, G.yPl0, G.bodyX1 - cx0, G.yPl1 - G.yPl0); ctx.restore();
      if (kind === 'led') {
        /* Linse und Lichtfaecher unter der Platine (nur Optik) */
        const cxl = G.chipX0 + G.chipW / 2, lens = Math.max(G.chipW * 0.9, 10), lv = b.destroyed || b.shutdown ? 0 : cl(1 - 0.5 * cl((b.tj - b.ta) / Math.max(1, (fin(b.tjMax) ? b.tjMax : hi) - b.ta), 0, 1), 0.3, 1);
        ctx.fillStyle = rgba('#fff3b0', 0.55); ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cxl, G.yPl1, lens, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke();
        if (lv > 0) { ctx.strokeStyle = rgba('#ffe066', 0.85 * lv); ctx.lineWidth = 2; ctx.lineCap = 'round'; for (let i = -3; i <= 3; i++) { const a = Math.PI / 2 + i * 0.32; ctx.beginPath(); ctx.moveTo(cxl + Math.cos(a) * (lens + 4), G.yPl1 + Math.sin(a) * (lens + 4)); ctx.lineTo(cxl + Math.cos(a) * (lens + 30 * lv), G.yPl1 + Math.sin(a) * (lens + 30 * lv)); ctx.stroke(); } }
      }
      ctx.fillStyle = tjCol; ctx.fillRect(G.chipX0, G.chipY0, G.chipW, G.chipH);
      ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.strokeRect(G.chipX0 + 1, G.chipY0 + 1, G.chipW - 2, G.chipH - 2);
      if (b.destroyed) { ctx.strokeStyle = P.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(G.chipX0 + 3, G.chipY0 + 3); ctx.lineTo(G.chipX0 + G.chipW - 3, G.chipY1 - 3); ctx.moveTo(G.chipX0 + G.chipW - 3, G.chipY0 + 3); ctx.lineTo(G.chipX0 + 3, G.chipY1 - 3); ctx.stroke(); }
      /* Fahne (Kupfer) ueber die ganze Breite */
      if (K.ht > 0) {
        layerFill(cx0, G.yTab0, cw, G.yTab1, G.yTab0);
        texFill(ctx, P, 'cu', cx0, G.yTab0, cw, G.yTab1 - G.yTab0);
        ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.strokeRect(cx0 + 0.75, G.yTab0 + 0.75, cw - 1.5, G.yTab1 - G.yTab0 - 1.5);
      }
    }
    /* ---- Uebergang, Fuss, Rippen ---- */
    let screwShown = false;
    if (G.kk) {
      G.layers.forEach(l => {
        layerFill(cx0, l.y0, cw, l.y1, l.y0);
        texFill(ctx, P, l.k, cx0, l.y0, cw, l.y1 - l.y0);
        ctx.strokeStyle = l.k === 'gap' ? rgba(P.fg, 0.4) : outline; ctx.lineWidth = 1; ctx.strokeRect(cx0 + 0.5, l.y0 + 0.5, cw - 1, Math.max(0, l.y1 - l.y0 - 1));
      });
      /* lockere Schraube: sichtbarer Spalt rechts neben dem Gehaeuse */
      if (b.screw === 'locker') {
        const gy = G.yTab0 - 1, gh = Math.max(3, 4 * u);
        ctx.fillStyle = rgba(P.bg, 0.92); ctx.fillRect(G.bodyX1, gy, cx1 - G.bodyX1, gh);
        ctx.strokeStyle = P.warn; ctx.lineWidth = 1.2; setDash(ctx, [3, 2]); ctx.strokeRect(G.bodyX1 + 0.5, gy + 0.5, cx1 - G.bodyX1 - 1, gh - 1); setDash(ctx, NODASH);
      }
      layerFill(cx0, G.yBase0, cw, G.yBase1, G.yBase0);
      texFill(ctx, P, 'al', cx0, G.yBase0, cw, G.yBase1 - G.yBase0);
      ctx.strokeStyle = outline; ctx.lineWidth = 1.5; ctx.strokeRect(cx0 + 0.75, G.yBase0 + 0.75, cw - 1.5, G.yBase1 - G.yBase0 - 1.5);
      /* Rippen: ein gemeinsamer Verlauf, Rippen ausgeschnitten */
      const F = G.fins, fsamples = []; for (let i = 0; i < 10; i++) fsamples.push(finTemp(b, i / 9));
      if (!F.horiz) {
        ctx.fillStyle = lgrad(ctx, 0, F.y1, 0, F.y0, fsamples.map((v, i) => [i / 9, heatColor(v, lo, hi)]));
        ctx.beginPath(); F.list.forEach(f => { ctx.rect(f.x, F.y0, f.w, F.y1 - F.y0); }); ctx.fill();
        ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.beginPath(); F.list.forEach(f => { ctx.rect(f.x + 0.5, F.y0 + 0.5, f.w - 1, F.y1 - F.y0 - 1); }); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.beginPath(); F.list.forEach(f => { ctx.moveTo(f.x + f.w * 0.3, F.y0 + 3); ctx.lineTo(f.x + f.w * 0.3, F.y1 - 2); }); ctx.stroke();
      } else {
        const sp = F.spine, mid = (cx0 + cx1) / 2, tipH = heatColor(finTemp(b, 1), lo, hi), root = heatColor(b.tk, lo, hi);
        ctx.fillStyle = lgrad(ctx, cx0, 0, cx1, 0, [[0, tipH], [0.5 - sp / cw / 2, mix(tipH, root, 0.7)], [0.5, root], [0.5 + sp / cw / 2, mix(tipH, root, 0.7)], [1, tipH]]);
        ctx.beginPath(); F.list.forEach(f => { ctx.rect(cx0, f.y, cw, f.h); }); ctx.fill();
        ctx.fillStyle = root; ctx.fillRect(mid - sp / 2, F.y0, sp, F.y1 - F.y0);
        ctx.strokeStyle = outline; ctx.lineWidth = 1; ctx.beginPath(); F.list.forEach(f => { ctx.rect(cx0 + 0.5, f.y + 0.5, cw - 1, f.h - 1); }); ctx.rect(mid - sp / 2 + 0.5, F.y0 + 0.5, sp - 1, F.y1 - F.y0 - 1); ctx.stroke();
      }
      /* Schraube mit Buchse (nicht bei LED-Platine) */
      if (kind !== 'led') {
        screwShown = true;
        const xs = G.xs, sw = G.shankW, gapL = b.screw === 'locker' ? Math.max(3, 5 * u) : 0, hhd = Math.max(5, 9 * u), hwd = Math.min(cw * 0.26, (1 - K.bf) * cw * 0.9);
        const useBush = b.joint !== 'direkt' && b.bushing, yTabB = G.yTab1, jTop = G.layers.length ? G.layers[G.layers.length - 1].y0 : G.yTab0;
        if (useBush) {
          ctx.fillStyle = '#e9e4d4'; ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1;
          ctx.fillRect(xs - sw / 2 - 3, G.yTab0 - 1, 3, yTabB - G.yTab0 + 1); ctx.strokeRect(xs - sw / 2 - 3 + 0.5, G.yTab0 - 0.5, 2, yTabB - G.yTab0);
          ctx.fillRect(xs + sw / 2, G.yTab0 - 1, 3, yTabB - G.yTab0 + 1); ctx.strokeRect(xs + sw / 2 + 0.5, G.yTab0 - 0.5, 2, yTabB - G.yTab0);
          ctx.fillRect(xs - hwd * 0.6, yTabB + gapL, hwd * 1.2, Math.max(2, 3 * u)); ctx.strokeRect(xs - hwd * 0.6 + 0.5, yTabB + gapL + 0.5, hwd * 1.2 - 1, Math.max(2, 3 * u) - 1);
        }
        ctx.fillStyle = P.metal; ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1.5;
        const yHead0 = yTabB + gapL + (useBush ? Math.max(2, 3 * u) : 0);
        ctx.fillRect(xs - sw / 2, G.yBase0 + (G.yBase1 - G.yBase0) * 0.35, sw, yHead0 - (G.yBase0 + (G.yBase1 - G.yBase0) * 0.35));
        ctx.strokeRect(xs - sw / 2 + 0.5, G.yBase0 + (G.yBase1 - G.yBase0) * 0.35, sw - 1, yHead0 - (G.yBase0 + (G.yBase1 - G.yBase0) * 0.35));
        rrect(ctx, xs - hwd / 2, yHead0, hwd, hhd, 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xs - hwd * 0.3, yHead0 + hhd * 0.5); ctx.lineTo(xs + hwd * 0.3, yHead0 + hhd * 0.5); ctx.stroke();
        ctx.beginPath(); for (let yy = G.yBase0 + (G.yBase1 - G.yBase0) * 0.4; yy < G.yBase1 - 1; yy += 4) { ctx.moveTo(xs - sw / 2, yy); ctx.lineTo(xs + sw / 2, yy + 2); } ctx.stroke();
        G.screw = { x: xs, yHead0, yHead1: yHead0 + hhd, headW: hwd, bush: useBush, gap: gapL };
        if (b.short) {
          ctx.strokeStyle = P.danger; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(xs, yTabB, Math.max(8, 9 * u), 0, 2 * Math.PI); ctx.stroke();
        }
      }
    }
    /* Isothermen (alle 10 K), Zahlen am rechten Rand der Saeule */
    {
      const step = isoStep(b.ta, Math.max(b.tj, b.tc, b.tk)), v0 = Math.ceil((b.ta + 0.5) / step) * step;
      for (let v = v0; v <= hi && v <= Math.max(b.tj, b.tc, b.tk) + 0.001; v += step) {
        let yy = NaN;
        for (let i = 0; i < segs.length && !fin(yy); i++) { const s = segs[i], dT = s.tb - s.ta; if (Math.abs(dT) > 1e-9 && (v - s.ta) * (v - s.tb) <= 0) yy = s.ya + (v - s.ta) / dT * (s.yb - s.ya); }
        if (!fin(yy) || yy < G.top || yy > G.bottom) continue;
        const inBody = (kind !== 'zement' && kind !== 'diode') && yy > G.yPl0 && yy <= G.yPl1;
        const xa = kind === 'zement' ? cx0 + cw * 0.15 : kind === 'diode' ? cx0 + cw * 0.15 : cx0, xb = inBody ? G.bodyX1 : kind === 'zement' || kind === 'diode' ? cx0 + cw * 0.85 : cx1;
        ctx.lineCap = 'butt';
        ctx.strokeStyle = rgba(P.isoShade, 0.4); ctx.lineWidth = 3; setDash(ctx, [5, 4]); ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xb, yy); ctx.stroke();
        ctx.strokeStyle = rgba(P.iso, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xb, yy); ctx.stroke();
        if (xb < cx1) { ctx.strokeStyle = rgba(P.fg, 0.3); ctx.lineWidth = 1; setDash(ctx, [1, 4]); ctx.beginPath(); ctx.moveTo(xb, yy); ctx.lineTo(cx1 + 2, yy); ctx.stroke(); }
        setDash(ctx, NODASH);
      }
    }
    /* Konvektion (Waermefahnen) ueber der Saeule */
    const pw_ = b.P;
    if (G.plume.h >= 14 && pw_ > 0) konvektion(ctx, G.plume.x, G.plume.y, G.plume.w, G.plume.h, { power: pw_, fan: b.fan, orient: b.orient, t, reduced: red, colors: P });
    /* Luefter */
    if (G.fan) luefter(ctx, G.fan.x, G.fan.y, { size: G.fan.size, rot: red ? 0.4 : t * (3 + 14 * G.fan.air), air: G.fan.air, t, reduced: red, colors: P });
    /* Rauch, Flamme, Funken */
    if ((b.over || b.destroyed) && pw_ > 0 || b.destroyed) rauch(ctx, cx0 + cw * 0.12, G.yPl0, { t, intensity: b.destroyed ? 1 : cl(((b.tj - b.tjMax) / 25), 0.25, 1), flame: b.destroyed, reduced: red, colors: P, height: Math.max(30, (G.yPl0 - G.top) * 0.7) });
    if (b.short && G.screw) funken(ctx, G.screw.x, G.yTab1, { t, size: Math.max(16, 26 * u), colors: P });
    /* ---- Pfeile im Rand links ---- */
    font(ctx, fs, true);
    const arrowOk = b.P > 0, ax = G.arrowX, labP = tw(ctx, S.P + ' = ' + fz(b.P, 1) + ' W', fs, true) + 8 <= G.gutter - 2 ? S.P + ' = ' + fz(b.P, 1) + ' W' : fz(b.P, 1) + ' W';
    const arrows = [];
    arrows.push([G.chipCy, G.yTab0 - 2, 1]);
    if (G.kk) arrows.push([G.yTab0 - 2, G.yBase0 + 2, (1 + b.level) / 2]);
    const fanTop = G.fan ? G.fan.y - G.fan.size * 0.55 - 20 : Infinity, a3y0 = Math.min(G.solidTop, fanTop) - 4, a3len = Math.min(70 * u + 20, a3y0 - G.top - 4);
    if (a3len >= 30) arrows.push([a3y0, a3y0 - a3len, b.level]);
    if (arrowOk) arrows.forEach(a => {
      if (a[0] - a[1] < 24) return;
      pfeil(ctx, ax, a[0], ax, a[1], { P: b.P, level: a[2], t, reduced: red, label: labP, colors: P });
      const mid = (a[0] + a[1]) / 2, bx0 = ax - (tw(ctx, labP, fs, true) + 8) / 2; boxes.push({ x0: bx0, x1: ax + (tw(ctx, labP, fs, true) + 8) / 2, y0: mid - fs * 0.75, y1: mid + fs * 0.75 });
    });
    if (G.fan) {
      const ff = fin(b.fanFactor) ? b.fanFactor : FANFAC[b.fan];
      if (G.fan.y - G.fan.size * 0.55 - 10 > G.top) tryLabel(ctx, P, boxes, '×' + fg(ff, 2), G.fan.x, G.fan.y - G.fan.size * 0.55 - 9, 'center', fs, true, P.fg, null, 0);
    }
    /* ---- Etiketten ---- */
    if (!G.tiny) {
      const items = [];
      const add = (cy, ax_, ay_, lines) => items.push({ cy, ax: ax_, ay: ay_, lines, h: lines.length * 15 });
      const L = (text, bold, color) => ({ text, bold: !!bold, color: color || (bold ? P.fg : P.mute) });
      const stat = b.destroyed ? L('defekt (Übungsmodell)', true, P.danger) : b.shutdown ? L('abgeschaltet', true, P.warn) : b.over ? L('über ' + S.tjMax, true, P.danger) : null;
      if (G.compact) {
        add(G.chipCy, G.chipX0 + G.chipW, G.chipCy, [L(S.tj + ' = ' + T1(b.tj), true)].concat(stat ? [stat] : []));
        if (kind !== 'zement' && kind !== 'diode') add((G.yTab0 + G.yTab1) / 2, cx1, (G.yTab0 + G.yTab1) / 2, [L(S.tc + ' = ' + T1(b.tc), true)]);
        if (G.kk) add((G.yBase0 + G.yBase1) / 2, cx1, (G.yBase0 + G.yBase1) / 2, [L(S.tk + ' = ' + T1(b.tk), true)]);
        add(G.top + 22, cx1, G.top + 22, [L(S.ta + ' = ' + T1(b.ta), true)]);
      } else if (kind === 'zement') {
        add(G.chipCy, cx0 + cw * 0.85, G.chipCy, [L('Zementwiderstand', false), L('Oberfläche ' + T1(b.tj), true)].concat(stat ? [stat] : []));
        add(G.top + 30, cx1, G.top + 30, [L('Luft', false), L(S.ta + ' = ' + T1(b.ta), true)]);
      } else if (kind === 'diode') {
        add(G.chipCy, G.chipX0 + G.chipW, G.chipCy, [L('Chip (Sperrschicht)', false), L(S.tj + ' = ' + T1(b.tj), true)].concat(stat ? [stat] : []));
        if (fin(b.tL)) add(G.yPl1 + 4 - G.u * 24, cx0 + cw * 0.15, G.yPl1 - G.u * 12, [L('Anschlussdraht', false), L('T_L = ' + T1(b.tL), true)]);
        add(G.top + 30, cx1, G.top + 30, [L('Luft', false), L(S.ta + ' = ' + T1(b.ta), true)]);
      } else {
        add(G.chipCy, G.chipX0 + G.chipW, G.chipCy, [L('Chip (Sperrschicht)', false), L(S.tj + ' = ' + T1(b.tj), true)].concat(stat ? [stat] : []));
        add((G.yPl0 + G.yPl1) / 2 - 8 * u, G.bodyX1, (G.yPl0 + G.yPl1) / 2 - 8 * u, [L(K.head, false), L(S.rthJC + ' = ' + RW(b.rthJC), false), L('ΔT = ' + K1(b.dJC), false)]);
        const tabL = [L(G.kk ? 'Fahne, Rückseite' : K.head + ' an der Luft', false), L(S.tc + ' = ' + T1(b.tc), true)];
        if (!G.kk) { tabL.push(L('Rth_CA = ' + RW(b.rthCA), false)); tabL.push(L('ΔT = ' + K1(b.dCA), false)); }
        if (b.fahneText) tabL.push(L(b.fahneText, false));
        add((G.yTab0 + G.yTab1) / 2, cx1, (G.yTab0 + G.yTab1) / 2, tabL);
        if (G.kk) {
          const jy = G.layers.length ? (G.layers[0].y1 + G.layers[G.layers.length - 1].y0) / 2 : (G.yTab0 + G.yBase1) / 2;
          add(jy, cx1, jy, [L(jointText(b), false), L(S.rthCK + ' = ' + RW(b.rthCK), false), L('ΔT = ' + K1(b.dCK), false)]);
          const bl = [L('Kühlkörperfuß', false), L(S.tk + ' = ' + T1(b.tk), true)]; if (b.ksText) bl.push(L(b.ksText, false));
          add((G.yBase0 + G.yBase1) / 2, cx1, (G.yBase0 + G.yBase1) / 2, bl);
          const hn = b.heatsinkName || (HS[b.heatsink] || HS.m).name;
          const fl = [L(hn, false), L(S.rthK + ' = ' + RW(b.rthK), false), L('ΔT = ' + K1(b.dK), false)];
          const ffac = fin(b.fanFactor) ? b.fanFactor : (b.fan !== 'aus' ? FANFAC[b.fan] : 1), ofac = fin(b.orientFactor) ? b.orientFactor : 1;
          if (fin(b.rthK0) && (b.fan !== 'aus' || Math.abs(ofac - 1) > 1e-9)) fl.push(L('Katalog ' + fg(b.rthK0, 2) + ' × ' + fg(ffac * ofac, 2), false));
          else if (b.fan !== 'aus') fl.push(L('Lüfter ' + b.fan + ' ×' + fg(ffac, 2), false));
          add((G.yFin0 + G.yFin1) / 2, cx1, (G.yFin0 + G.yFin1) / 2, fl);
          add(G.yFin0 + 4, cx1, G.yFin0 + 4, [L('Rippenspitze', false), L(T1(finTemp(b, 1)), true)]);
          if (G.screw) { const sl = [veil('locker') && b.screw === 'locker' ? L('Schraube', false) : L(b.screw === 'locker' ? 'Schraube locker!' : 'Schraube fest', b.screw === 'locker', b.screw === 'locker' ? P.warn : undefined)]; if (b.joint !== 'direkt') sl.push(L(b.bushing ? 'mit Isolierbuchse' : 'ohne Isolierbuchse', !b.bushing, b.bushing ? undefined : P.danger)); if (b.short) sl.push(L('Kurzschluss!', true, P.danger)); add(G.screw.yHead1 + 6, G.screw.x + G.screw.headW / 2, G.screw.yHead0 + 4, sl); }
        }
        add(G.top + 30, cx1, G.top + 30, [L('Luft', false), L(S.ta + ' = ' + T1(b.ta), true)]);
      }
      const avail = G.bottom - G.top;
      let need = items.reduce((a, it) => a + it.h + 6, 0);
      if (need > avail) items.forEach(it => { if (it.lines.length > 2) { it.lines = it.lines.slice(0, 2); it.h = 30; } });
      need = items.reduce((a, it) => a + it.h + 6, 0);
      if (need > avail) items.forEach(it => { if (it.lines.length > 1) { it.lines = it.lines.slice(0, 1); it.h = 15; } });
      placeLabels(items, G.top, G.bottom + (G.compact ? 6 : 0), 5);
      items.forEach(it => {
        const ly = it.y0 + 8;
        ctx.strokeStyle = rgba(P.fg, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(it.ax, it.ay); ctx.lineTo(G.labelX - 4, ly); ctx.stroke();
        ctx.fillStyle = P.fg; ctx.beginPath(); ctx.arc(it.ax, it.ay, 2.5, 0, 2 * Math.PI); ctx.fill();
      });
      items.forEach(it => {
        it.lines.forEach((ln, i) => {
          const r = labelRaw(ctx, P, ln.text, G.labelX, it.y0 + 8 + i * 15, 'left', fs, ln.bold, ln.color, rgba(P.bg, 0.72), G.x0 + G.W - 4 - G.labelX);
          if (r) boxes.push(r);
        });
      });
    }
    /* Isothermen-Zahlen (nur wenn der Platz da ist und nichts ueberdeckt wird) */
    if (G.isoW > 0) {
      const step = isoStep(b.ta, Math.max(b.tj, b.tc, b.tk)), v0 = Math.ceil((b.ta + 0.5) / step) * step;
      for (let v = v0; v <= hi && v <= Math.max(b.tj, b.tc, b.tk) + 0.001; v += step) {
        let yy = NaN;
        for (let i = 0; i < segs.length && !fin(yy); i++) { const s = segs[i], dT = s.tb - s.ta; if (Math.abs(dT) > 1e-9 && (v - s.ta) * (v - s.tb) <= 0) yy = s.ya + (v - s.ta) / dT * (s.yb - s.ya); }
        if (!fin(yy) || yy < G.top || yy > G.bottom) continue;
        tryLabel(ctx, P, boxes, fz(v, 0) + ' °C', cx1 + 4, yy, 'left', fs, false, P.fg, rgba(P.bg, 0.55), 0);
      }
    }
    /* Skala am unteren Rand */
    if (G.legendH > 0) {
      const marks = [{ v: b.ta, label: S.ta }]; if (fin(b.tjMax) && b.tjMax > lo && b.tjMax < hi) marks.push({ v: b.tjMax, label: S.tjMax + ' ' + fz(b.tjMax, 0) });
      if (fin(b.tShut) && b.tShut > lo && b.tShut < hi) marks.push({ v: b.tShut, label: 'Abschalt. ' + fz(b.tShut, 0) });
      legend(ctx, { x: G.x0, y: G.bottom + G.pad, w: G.W, h: G.legendH - 2 }, lo, hi, { unit: '°C', marks, colors: P });
    }
    /* Wertetafel unter dem Bild (Vergleich) */
    if (o.table) {
      const ty = G.y0 + G.H - G.pad - G.tableH + 10;
      o.table.slice(0, 2).forEach((tl, i) => labelRaw(ctx, P, String(tl), G.x0 + G.W / 2, ty + i * 16, 'center', fs, i === 0, P.fg, null, G.W - 8));
    }
    return G;
  }

  /* Diode: Koerper waagrecht, Anschlussdraehte nach unten zur Platine */
  function drawDiode(ctx, P, G, b, outline) {
    const { cx0, cw } = G, lo = b.lo, hi = b.hi;
    const bx0 = cx0 + cw * 0.15, bx1 = cx0 + cw * 0.85, by1 = G.yPl0 + (G.yPl1 - G.yPl0) * 0.55, by0 = G.yPl0;
    /* Drahtverlauf Tj -> T_L (oder Ta), Platine unten */
    const tl = fin(b.tL) ? b.tL : b.ta + (b.tj - b.ta) * 0.7;
    const bodyH = by1 - by0;
    ctx.fillStyle = lgrad(ctx, bx0, 0, bx1, 0, [[0, heatColor(tl, lo, hi)], [0.2, heatColor(b.tj, lo, hi)], [0.8, heatColor(b.tj, lo, hi)], [1, heatColor(tl, lo, hi)]]);
    rrect(ctx, bx0 + cw * 0.08, by0, bx1 - bx0 - cw * 0.16, bodyH, 6); ctx.fill();
    texFill(ctx, P, 'plastic', bx0 + cw * 0.08, by0, bx1 - bx0 - cw * 0.16, bodyH);
    ctx.strokeStyle = outline; ctx.lineWidth = 1.5; rrect(ctx, bx0 + cw * 0.08, by0, bx1 - bx0 - cw * 0.16, bodyH, 6); ctx.stroke();
    const cxm = (bx0 + bx1) / 2, chW = Math.max(8, cw * 0.14);
    ctx.fillStyle = b.destroyed ? '#101114' : heatColor(b.tj, lo, hi); ctx.fillRect(cxm - chW / 2, by0 + bodyH * 0.25, chW, bodyH * 0.5);
    ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.strokeRect(cxm - chW / 2 + 1, by0 + bodyH * 0.25 + 1, chW - 2, bodyH * 0.5 - 2);
    G.chipX0 = cxm - chW / 2; G.chipW = chW; G.chipCy = by0 + bodyH / 2;
    /* Anschlussdraehte */
    const yb = G.yPl1 + 2;
    ctx.lineCap = 'round'; ctx.lineWidth = 4;
    [bx0, bx1].forEach(xw => {
      ctx.strokeStyle = lgrad(ctx, 0, by0 + bodyH / 2, 0, yb, [[0, heatColor(b.tj, lo, hi)], [1, heatColor(tl, lo, hi)]]);
      ctx.beginPath(); ctx.moveTo(xw + (xw < cxm ? cw * 0.08 : -cw * 0.08), by0 + bodyH / 2); ctx.lineTo(xw, by0 + bodyH / 2); ctx.lineTo(xw, yb); ctx.stroke();
      ctx.fillStyle = P.metal; ctx.beginPath(); ctx.arc(xw, yb + 1, 5, 0, 2 * Math.PI); ctx.fill();
    });
    ctx.strokeStyle = P.metalDark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx0, yb + 7); ctx.lineTo(cx0 + cw, yb + 7); ctx.stroke();
  }

  function schnittLayout(w, h, data) {
    if (!fin(w) || !fin(h) || w < 120 || h < 120) return null;
    const b = normBuild(data), G = geomOf({ x: 0, y: 0, w, h }, b, obj(data));
    return { kind: G.kind, compact: G.compact, u: G.u, col: { x0: G.cx0, x1: G.cx1 }, gutter: { x0: G.gx0, x1: G.cx0 }, labelX: G.labelX, top: G.top, bottom: G.bottom,
      y: { chip: G.chipCy, tab: [G.yTab0, G.yTab1], joint: G.layers.length ? [G.layers[G.layers.length - 1].y0, G.layers[0].y1] : null, base: G.kk ? [G.yBase0, G.yBase1] : null, fins: G.kk ? [G.yFin0, G.yFin1] : null, solidTop: G.solidTop },
      fins: G.fins ? { x0: G.fins.x0, x1: G.fins.x1, y0: G.fins.y0, y1: G.fins.y1, n: G.fins.n } : null, fan: G.fan, plume: G.plume, arrowX: G.arrowX };
  }
  function schnitt(ctx, w, h, data) {
    if (!okText(ctx) || !fin(w) || !fin(h) || w < 120 || h < 120) return false;
    const b = normBuild(data), o = obj(data), P = palette(b.colors);
    return draw(ctx, () => { drawPanel(ctx, P, { x: 0, y: 0, w, h }, b, o); return Object.assign({ ok: true }, schnittLayout(w, h, data)); });
  }

  /* ------------------------------------------------------------------ Vergleich: bis zu drei Schnitte mit gemeinsamer Skala */
  function vergleich(ctx, w, h, d) {
    if (!okText(ctx) || !fin(w) || !fin(h) || w < 200 || h < 200) return false;
    d = obj(d);
    const raw = (Array.isArray(d.builds) ? d.builds : []).slice(0, 3).filter(x => x && typeof x === 'object');
    if (!raw.length) return false;
    const names = Array.isArray(d.names) ? d.names : [];
    let lo = firstNum(d.lo), hi = firstNum(d.hi);
    const bs0 = raw.map(x => normBuild(Object.assign({}, x, { colors: d.colors, reduced: d.reduced, t: d.t })));
    if (!fin(lo)) lo = Math.min.apply(null, bs0.map(b => b.ta));
    if (!fin(hi)) { const mx = Math.max.apply(null, bs0.map(b => (fin(b.tjMax) ? b.tjMax + 30 : b.tj + 10))); hi = mx; }
    if (!(hi > lo)) hi = lo + 30;
    const bs = bs0.map((b, i) => { const nb = Object.assign({}, b, { lo, hi }); nb.over = fin(nb.tjMax) && nb.tj > nb.tjMax; nb.name = typeof names[i] === 'string' && names[i].trim() ? names[i].trim() : String.fromCharCode(65 + i); return nb; });
    const P = palette(d.colors), n = bs.length, legendH = 66, areaH = h - legendH, side = w / n >= 260 || areaH / n < 190;
    return draw(ctx, () => {
      const panels = [];
      bs.forEach((b, i) => {
        const rect = side ? { x: i * w / n, y: 0, w: w / n, h: areaH } : { x: 0, y: i * areaH / n, w, h: areaH / n };
        const rest = fin(b.tjMax) ? b.tjMax - b.tj : NaN;
        const l1 = b.sym.tj + ' ' + fz(b.tj, 1) + ' °C · ' + b.sym.tc + ' ' + fz(b.tc, 1) + ' °C';
        const l2 = 'Rth_ges ' + fg(b.rthTotal, 2) + ' K/W' + (fin(rest) ? (rest >= 0 ? ' · Reserve ' + fz(rest, 1) + ' K' : ' · zu heiß: +' + fz(-rest, 1) + ' K') : '');
        const inner = { x: rect.x, y: rect.y + 22, w: rect.w, h: rect.h - 22 };
        drawPanel(ctx, P, inner, b, { compact: true, legend: false, table: [l1, l2], reserve: undefined });
        labelRaw(ctx, P, 'Aufbau ' + b.name, rect.x + 12, rect.y + 11, 'left', 12, true, b.over ? P.danger : P.fg, null, rect.w - 20);
        panels.push(rect);
      });
      const marks = [{ v: bs[0].ta, label: bs[0].sym.ta }]; if (fin(bs[0].tjMax) && bs[0].tjMax > lo && bs[0].tjMax < hi) marks.push({ v: bs[0].tjMax, label: bs[0].sym.tjMax + ' ' + fz(bs[0].tjMax, 0) });
      legend(ctx, { x: 0, y: areaH + 2, w, h: legendH - 2 }, lo, hi, { unit: '°C', title: 'gleiche Skala', marks, colors: P });
      return { panels, side, lo, hi };
    });
  }

  /* ------------------------------------------------------------------ Waermebild (Falschfarben-Kamera, Draufsicht) */
  const SINKF = { fahne: [0.20, 0.34], s: [0.30, 0.40], m: [0.40, 0.50], l: [0.54, 0.62], xl: [0.68, 0.74], blech: [0.40, 0.50], custom: [0.40, 0.50] };
  function camGeom(w, h, b) {
    const pad = 8, legW = 62, noteH = 38, capH = 22;
    const bx = pad, by = capH + 4, bw = Math.max(40, w - 2 * pad - legW), bh = Math.max(40, h - by - noteH - pad);
    const G = { bx, by, bw, bh, legW, noteH, capH, pad };
    const kk = b.mode === 'kk' && pkgKind(b) !== 'zement' && pkgKind(b) !== 'diode';
    const pw = cl(bw * 0.11, 22, 60), ph = pw * 1.5;
    if (kk) {
      let f = SINKF[b.heatsink] || SINKF.m;
      if (b.heatsink === 'blech') { const a = Math.sqrt(b.blechA / 400); f = [0.22 + 0.5 * a, 0.28 + 0.5 * a]; }
      const sw = bw * f[0], sh = bh * f[1], sx = bx + bw * 0.52 - sw / 2, sy = by + bh * 0.5 - sh / 2;
      G.sink = { x0: sx, y0: sy, x1: sx + sw, y1: sy + sh };
      G.pkg = { x0: sx + sw / 2 - pw / 2, y0: sy + sh - ph * 0.55, x1: sx + sw / 2 + pw / 2, y1: sy + sh + ph * 0.45 };
    } else { G.sink = null; G.pkg = { x0: bx + bw * 0.5 - pw / 2, y0: by + bh * 0.52 - ph / 2, x1: bx + bw * 0.5 + pw / 2, y1: by + bh * 0.52 + ph / 2 }; }
    /* Orientierungsbauteile in den Ecken */
    G.comps = [
      { n: 'C1', kind: 'c', x: bx + bw * 0.07, y: by + bh * 0.13, r: Math.max(8, bw * 0.04), dT: 1.2 },
      { n: 'C2', kind: 'c', x: bx + bw * 0.93, y: by + bh * 0.13, r: Math.max(8, bw * 0.04), dT: 0.8 },
      { n: 'R1', kind: 'r', x0: bx + bw * 0.03, y0: by + bh * 0.9, x1: bx + bw * 0.2, y1: by + bh * 0.9 + Math.max(7, bh * 0.045), dT: 2.0 },
      { n: 'IC1', kind: 'ic', x0: bx + bw * 0.78, y0: by + bh * 0.88, x1: bx + bw * 0.97, y1: by + bh * 0.88 + Math.max(10, bh * 0.1), dT: 1.5 }
    ];
    G.sp = 0.7 + 0.9 * cl(b.rthTotal / 50, 0, 1);
    G.sigma = Math.max(bw, bh) * 0.055 * G.sp;
    return G;
  }
  const rdist = (x, y, r) => { const dx = Math.max(r.x0 - x, 0, x - r.x1), dy = Math.max(r.y0 - y, 0, y - r.y1); return Math.sqrt(dx * dx + dy * dy); };
  /* Temperaturfeld an (x,y) in Bildpunkten: weicher Union (Maximum) aus Plateaus und Gauss-Hoefen. Gibt {t, what} */
  function camField(G, b, x, y) {
    let best = b.ta + 0.3, what = 'Platine';
    const consider = (v, w) => { if (v > best) { best = v; what = w; } };
    if (G.sink) {
      const s = G.sink, d = rdist(x, y, s);
      if (d === 0) {
        const rx = ((x - (s.x0 + s.x1) / 2) / ((s.x1 - s.x0) / 2)), ry = ((y - (s.y0 + s.y1) / 2) / ((s.y1 - s.y0) / 2)), r2 = Math.min(1, (rx * rx + ry * ry) / 2);
        consider(b.tk - 0.03 * (b.tk - b.ta) * r2, 'Kühlkörper');
      } else consider(b.ta + (b.tk - b.ta) * 0.985 * Math.exp(-d * d / (2 * G.sigma * G.sigma)), 'Platine');
    }
    const pk = G.pkg, dp = rdist(x, y, pk);
    if (dp === 0) consider(b.tc, 'Gehäuse'); else consider(b.ta + (b.tc - b.ta) * (G.sink ? 0.8 : 1) * Math.exp(-dp * dp / (2 * G.sigma * G.sigma * (G.sink ? 0.35 : 1))), 'Platine');
    G.comps.forEach(c => {
      const d = c.kind === 'c' ? Math.max(0, Math.hypot(x - c.x, y - c.y) - c.r) : rdist(x, y, c);
      consider(b.ta + 0.3 + c.dT * Math.exp(-d * d / (2 * 16 * 16)), 'Bauteil');
    });
    if (b.shutdown && !b.destroyed) { /* abgeschaltet: Kamerabild kuehlt ab, Werte stehen bereits in b */ }
    return { t: best, what };
  }
  let camCache = null;
  /* Marching Squares: Isothermen als Strecken (Bildpunkte). Gitterpunkt (i,j) liegt bei bx + (i+0.5)*bw/nx. */
  function camContours(G, tg, nx, ny, levels) {
    const segs = [], X = i => G.bx + (i + 0.5) * G.bw / nx, Y = j => G.by + (j + 0.5) * G.bh / ny;
    levels.forEach(L => {
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = tg[j * nx + i], bb = tg[j * nx + i + 1], c = tg[(j + 1) * nx + i + 1], d = tg[(j + 1) * nx + i];
        const idx = (a >= L ? 1 : 0) | (bb >= L ? 2 : 0) | (c >= L ? 4 : 0) | (d >= L ? 8 : 0);
        if (idx === 0 || idx === 15) continue;
        const tp = () => { const t = (L - a) / (bb - a); return [X(i + t), Y(j)]; }, rt = () => { const t = (L - bb) / (c - bb); return [X(i + 1), Y(j + t)]; };
        const bt = () => { const t = (L - d) / (c - d); return [X(i + t), Y(j + 1)]; }, lf = () => { const t = (L - a) / (d - a); return [X(i), Y(j + t)]; };
        const S2 = (p, q) => { segs.push(p[0], p[1], q[0], q[1]); };
        switch (idx) {
          case 1: case 14: S2(lf(), tp()); break; case 2: case 13: S2(tp(), rt()); break; case 3: case 12: S2(lf(), rt()); break;
          case 4: case 11: S2(rt(), bt()); break; case 5: S2(lf(), tp()); S2(rt(), bt()); break; case 6: case 9: S2(tp(), bt()); break;
          case 7: case 8: S2(lf(), bt()); break; case 10: S2(tp(), rt()); S2(lf(), bt()); break;
          default: break;
        }
      }
    });
    return segs;
  }
  /* Feld, Bild und Isothermen werden nur neu berechnet, wenn sich Zahlen aendern (Cursor und Zeit beeinflussen sie nicht) */
  function camData(G, b, nx, ny, wantImage) {
    const key = [nx, ny, G.bw, G.bh, b.lo, b.hi, b.ta, b.tc, b.tk, b.tj, b.mode, b.heatsink, b.blechA, b.rthTotal, finTemp(b, 1)].map(v => (typeof v === 'number' ? Math.round(v * 20) / 20 : v)).join('|');
    let c = camCache && camCache.key === key ? camCache : null;
    if (!c) {
      const tg = new Float32Array(nx * ny); let tmax = -Infinity;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const T = camField(G, b, G.bx + (i + 0.5) * G.bw / nx, G.by + (j + 0.5) * G.bh / ny).t; tg[j * nx + i] = T; if (T > tmax) tmax = T; }
      const step = isoStep(b.ta, tmax), levels = [];
      for (let v = Math.ceil((b.ta + 0.6) / step) * step; v < tmax - 1e-9; v += step) levels.push(v);
      const levelSegs = levels.map(L => camContours(G, tg, nx, ny, [L])), all = [];
      levelSegs.forEach(ls => { for (let i = 0; i < ls.length; i++) all.push(ls[i]); });
      c = { key, tg, segs: all, levelSegs, cv: camCache && camCache.cv ? camCache.cv : null, imgDone: false, levels };
      camCache = c;
    }
    if (wantImage && !c.imgDone && typeof document !== 'undefined' && document && typeof document.createElement === 'function') {
      let cv = c.cv && c.cv.width === nx && c.cv.height === ny ? c.cv : document.createElement('canvas');
      cv.width = nx; cv.height = ny;
      const c2 = cv.getContext && cv.getContext('2d');
      if (c2 && typeof c2.createImageData === 'function' && typeof c2.putImageData === 'function') {
        const img = c2.createImageData(nx, ny), px = img.data;
        for (let i = 0; i < nx * ny; i++) { const k = heatIdx((c.tg[i] - b.lo) / (b.hi - b.lo)), o = i * 4; px[o] = LUT_R[k]; px[o + 1] = LUT_G[k]; px[o + 2] = LUT_B[k]; px[o + 3] = 255; }
        c2.putImageData(img, 0, 0); c.cv = cv; c.imgDone = true;
      }
    }
    return c;
  }
  function kameraTemp(w, h, d, x, y) {
    if (!fin(w) || !fin(h) || !afin(x) || !afin(y) || w < 160 || h < 120) return null;
    const b = normBuild(d), G = camGeom(w, h, b);
    if (x < G.bx || x > G.bx + G.bw || y < G.by || y > G.by + G.bh) return null;
    return camField(G, b, x, y);
  }
  function kamera(ctx, w, h, d) {
    if (!okText(ctx) || !fin(w) || !fin(h) || w < 160 || h < 120) return false;
    const b = normBuild(d), P = palette(b.colors);
    if (b.autoscale) { const top = Math.max(b.tc, b.tk, b.ta + 5); b.lo = b.ta - 1; b.hi = top + 0.15 * (top - b.lo); }
    const G = camGeom(w, h, b), S = b.sym, lo = b.lo, hi = b.hi, boxes = [];
    return draw(ctx, () => {
      const fs = 12;
      labelRaw(ctx, P, 'Wärmebild (Draufsicht)' + (b.autoscale ? ', Skala angepasst' : ''), G.bx, G.capH / 2 + 2, 'left', fs, true, P.fg, null, w - 2 * G.pad);
      /* Temperaturfeld */
      ctx.save();
      rrect(ctx, G.bx, G.by, G.bw, G.bh, 8); if (typeof ctx.clip === 'function') ctx.clip();
      const nx = cl(Math.round(G.bw / 4), 32, 120), ny = cl(Math.round(G.bh / 4), 24, 90), cd = camData(G, b, nx, ny, typeof ctx.drawImage === 'function'), cv = cd.imgDone ? cd.cv : null;
      if (cv) { ctx.imageSmoothingEnabled = true; ctx.drawImage(cv, G.bx, G.by, G.bw, G.bh); }
      else {
        /* ohne Offscreen-Canvas: grobe Zellen aus derselben Feldfunktion */
        const cx_ = 28, cy_ = 18;
        for (let j = 0; j < cy_; j++) for (let i = 0; i < cx_; i++) {
          const T = camField(G, b, G.bx + (i + 0.5) * G.bw / cx_, G.by + (j + 0.5) * G.bh / cy_).t;
          ctx.fillStyle = heatColor(T, lo, hi); ctx.fillRect(G.bx + i * G.bw / cx_, G.by + j * G.bh / cy_, G.bw / cx_ + 0.6, G.bh / cy_ + 0.6);
        }
      }
      /* Isothermen (vektoriell, scharf), mit dunklem Saum fuer jede Farbe lesbar */
      if (cd.segs.length) {
        ctx.lineCap = 'round';
        [[rgba('#000000', 0.35), 3], [rgba('#ffffff', 0.85), 1.2]].forEach(st => { ctx.strokeStyle = st[0]; ctx.lineWidth = st[1]; ctx.beginPath(); for (let i = 0; i < cd.segs.length; i += 4) { ctx.moveTo(cd.segs[i], cd.segs[i + 1]); ctx.lineTo(cd.segs[i + 2], cd.segs[i + 3]); } ctx.stroke(); });
      }
      /* Umrisse der Gegenstaende (dezent, damit man Platine, Kuehlkoerper und Bauteil erkennt) */
      ctx.lineJoin = 'round'; ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1.5;
      if (G.sink) {
        const s = G.sink; ctx.strokeRect(s.x0 + 0.5, s.y0 + 0.5, s.x1 - s.x0 - 1, s.y1 - s.y0 - 1);
        ctx.strokeStyle = rgba('#000000', 0.28); ctx.lineWidth = 1; ctx.beginPath();
        const n = (HS[b.heatsink] || HS.m).n;
        if (b.orient === 'waagrecht') { for (let i = 1; i < n + 1; i++) { const yy = s.y0 + (s.y1 - s.y0) * i / (n + 1); ctx.moveTo(s.x0 + 2, yy); ctx.lineTo(s.x1 - 2, yy); } }
        else { for (let i = 1; i < n * 2; i++) { const xx = s.x0 + (s.x1 - s.x0) * i / (n * 2); ctx.moveTo(xx, s.y0 + 2); ctx.lineTo(xx, s.y1 - 2); } }
        ctx.stroke();
      }
      ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 1.5; const pk = G.pkg; ctx.strokeRect(pk.x0 + 0.5, pk.y0 + 0.5, pk.x1 - pk.x0 - 1, pk.y1 - pk.y0 - 1);
      ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 2; ctx.beginPath();
      [0.3, 0.5, 0.7].forEach(f => { ctx.moveTo(pk.x0 + (pk.x1 - pk.x0) * f, pk.y1); ctx.lineTo(pk.x0 + (pk.x1 - pk.x0) * f, pk.y1 + (G.sink ? 8 : 12)); }); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1;
      G.comps.forEach(c => { if (c.kind === 'c') { ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, 2 * Math.PI); ctx.stroke(); } else ctx.strokeRect(c.x0 + 0.5, c.y0 + 0.5, c.x1 - c.x0 - 1, c.y1 - c.y0 - 1); });
      ctx.restore();
      ctx.strokeStyle = P.metalDark; ctx.lineWidth = 1.5; rrect(ctx, G.bx + 0.5, G.by + 0.5, G.bw - 1, G.bh - 1, 8); ctx.stroke();
      /* Namen der Objekte (kurz), damit die Zuordnung nicht an der Farbe haengt */
      const cur = obj(b.cursor), curOn = fin(cur.x) && fin(cur.y) && cur.x >= G.bx && cur.x <= G.bx + G.bw && cur.y >= G.by && cur.y <= G.by + G.bh;
      let curText = null, curBox = null;
      if (curOn) {
        const f = camField(G, b, cur.x, cur.y), up = cur.y > G.by + G.bh * 0.5;
        curText = fz(f.t, 1) + ' °C (' + f.what + ')'; font(ctx, fs, true);
        const wd = tw(ctx, curText, fs, true) + 8, xx = cl(cur.x, G.bx + wd / 2 + 2, G.bx + G.bw - wd / 2 - 2), yy = up ? cur.y - 26 : cur.y + 26;
        curBox = { x: xx, y: yy, x0: xx - wd / 2, x1: xx + wd / 2, y0: yy - fs * 0.75, y1: yy + fs * 0.75 }; boxes.push(curBox);
      }
      const tag = (txt, x, y) => { tryLabel(ctx, P, boxes, txt, x, y, 'center', fs, true, '#ffffff', 'rgba(0,0,0,0.62)', 0); };
      G.comps.forEach(c => tag(c.n, c.kind === 'c' ? c.x : (c.x0 + c.x1) / 2, c.kind === 'c' ? c.y + c.r + 12 : c.y0 - 10));
      tag(S.tc, (G.pkg.x0 + G.pkg.x1) / 2, G.pkg.y1 + (G.sink ? 24 : 26));
      if (G.sink) tag(S.tk, (G.sink.x0 + G.sink.x1) / 2, G.sink.y0 + 14);
      /* Zahlen an den Isothermen: abwechselnd am linken und am rechten Rand der jeweiligen Linie (Linien fuer eine Stufe gehoeren zu einem Pegel) */
      (cd.levelSegs || []).forEach((ls, k) => {
        let best = -1, bv = k % 2 ? -Infinity : Infinity, bxx = 0, byy = 0;
        for (let i = 0; i < ls.length; i += 4) { const xm = (ls[i] + ls[i + 2]) / 2; if (k % 2 ? xm > bv : xm < bv) { bv = xm; best = i; bxx = xm; byy = (ls[i + 1] + ls[i + 3]) / 2; } }
        if (best >= 0) tryLabel(ctx, P, boxes, fz(cd.levels[k], 0) + ' °C', bxx, byy, 'center', fs, false, '#ffffff', 'rgba(0,0,0,0.55)', 0, [-14, 14]);
      });
      /* Fadenkreuz mit Temperaturzahl */
      if (curOn) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(cur.x - 14, cur.y); ctx.lineTo(cur.x + 14, cur.y); ctx.moveTo(cur.x, cur.y - 14); ctx.lineTo(cur.x, cur.y + 14); ctx.stroke(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#000000'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cur.x - 14, cur.y); ctx.lineTo(cur.x + 14, cur.y); ctx.moveTo(cur.x, cur.y - 14); ctx.lineTo(cur.x, cur.y + 14); ctx.stroke();
        ctx.beginPath(); ctx.arc(cur.x, cur.y, 6, 0, 2 * Math.PI); ctx.stroke();
        labelRaw(ctx, P, curText, curBox.x, curBox.y, 'center', fs, true, '#ffffff', 'rgba(0,0,0,0.78)', 0);
      }
      /* Skala am rechten Rand */
      legend(ctx, { x: G.bx + G.bw + 6, y: G.by, w: G.legW - 6, h: G.bh }, lo, hi, { unit: '°C', colors: P });
      /* Zahlen und Lehrsatz unter dem Bild */
      labelRaw(ctx, P, 'Gehäuse ' + S.tc + ' = ' + fz(b.tc, 1) + ' °C' + (G.sink ? ' · Kühlkörper ' + S.tk + ' = ' + fz(b.tk, 1) + ' °C' : ''), G.bx, G.by + G.bh + 12, 'left', fs, true, P.fg, null, w - 2 * G.pad);
      labelRaw(ctx, P, 'Die Kamera sieht ' + S.tc + (G.sink ? ' und ' + S.tk : '') + ', nicht ' + S.tj + ' (Chip).', G.bx, G.by + G.bh + 29, 'left', fs, false, P.mute, null, w - 2 * G.pad);
      return { board: { x: G.bx, y: G.by, w: G.bw, h: G.bh }, sink: G.sink, pkg: G.pkg, comps: G.comps, legendX: G.bx + G.bw + 6 };
    });
  }

  /* ------------------------------------------------------------------ Thermisches Ersatzschaltbild */
  const ANA0 = [['Spannung U', 'Temperaturdifferenz ΔT'], ['Strom I', 'Verlustleistung P'], ['Widerstand R', 'Wärmewiderstand Rth'], ['Kondensator C', 'Wärmekapazität Cth'],
    ['Masse', 'Umgebung'], ['Spannungsquelle', 'Umgebungstemperatur Ta'], ['Stromquelle', 'Verlustleistung'], ['Reihenschaltung', 'Wärmekette']];
  function anaRows(a) {
    const out = [];
    (Array.isArray(a) ? a : []).slice(0, 12).forEach(r => {
      let e, t;
      if (Array.isArray(r)) { e = r[0]; t = r[1]; } else if (r && typeof r === 'object') { e = r.elektrisch || r.el || r.e; t = r.thermisch || r.th || r.t; }
      if (typeof e === 'string' && typeof t === 'string' && e.trim() && t.trim()) out.push([e.trim(), t.trim()]);
    });
    return out.length ? out : ANA0;
  }
  function ersatz(ctx, w, h, d) {
    if (!okText(ctx) || !fin(w) || !fin(h) || w < 260 || h < 260) return false;
    const b = normBuild(d), P = palette(b.colors), S = b.sym, lo = b.lo, hi = b.hi, kk = b.mode === 'kk', t = b.t, red = b.reduced;
    const rows = anaRows(b.analogie), wide = w >= 640, below = !wide && h >= 560;
    const tblH = rows.length * 20 + 44, pad = 8;
    const R = wide ? { x: pad, y: pad, w: w * 0.58 - pad, h: h - 2 * pad } : { x: pad, y: pad, w: w - 2 * pad, h: below ? h - tblH - 2 * pad : h - 2 * pad };
    const cw = R.w;
    const xs = R.x + 38, xr = R.x + Math.max(cw * 0.28, 152), yJ = R.y + 34, yR = R.y + R.h - 70, nN = kk ? 3 : 2, L = (yR - yJ) / nN;
    const ys = [yJ]; for (let i = 1; i < nN; i++) ys.push(yJ + L * i);
    const T = kk ? [b.tj, b.tc, b.tk] : [b.tj, b.tc], names = kk ? [S.tj, S.tc, S.tk] : [S.tj, S.tc], cths = kk ? [b.cth.j, b.cth.c, b.cth.k] : [b.cth.j, b.cth.c];
    const Rs = kk ? [[S.rthJC, b.rthJC, b.dJC], [S.rthCK, b.rthCK, b.dCK], [S.rthK, b.rthK, b.dK]] : [[S.rthJC, b.rthJC, b.dJC], ['Rth_CA', b.rthCA, b.dCA]];
    const cnames = kk ? ['Cth_j', 'Cth_c', 'Cth_k'] : ['Cth_j', 'Cth_c'];
    return draw(ctx, () => {
      const fs = 12, speed = cl(10 + 9 * b.P, 10, 120), off = red ? 0 : -((t * speed) % 14);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      const wire = (pts, flow) => {
        ctx.strokeStyle = P.metal; ctx.lineWidth = 2; setDash(ctx, NODASH); poly(ctx, pts, false); ctx.stroke();
        if (flow && b.P > 0) { ctx.strokeStyle = P.heat; ctx.globalAlpha = 0.45 + 0.5 * b.level; ctx.lineWidth = 3.4; setDash(ctx, [3, 11], off); poly(ctx, pts, false); ctx.stroke(); setDash(ctx, NODASH, 0); ctx.globalAlpha = 1; }
      };
      /* Waermestrom: von der Stromquelle nach oben, durch die Kette nach unten */
      const xcap0 = xs + 48, xcapStep = 17;
      wire([[xs, yR], [xs, yJ], [xr, yJ]], true);
      wire([[xr, yJ], [xr, yR]], true);
      wire([[xs, yR], [xr, yR]], false);
      /* Stromquelle P (Waermepumpe-Symbol: Kreis mit Pfeil nach oben) */
      const ymid = (ys[1] + (ys[2] !== undefined ? ys[2] : yR)) / 2;
      ctx.fillStyle = P.panel; ctx.strokeStyle = P.heat; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(xs, ymid, 17, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.heat; ctx.fillStyle = P.heat; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xs, ymid + 9); ctx.lineTo(xs, ymid - 4); ctx.stroke(); poly(ctx, [[xs, ymid - 11], [xs - 6, ymid - 2], [xs + 6, ymid - 2]], true); ctx.fill();
      labelRaw(ctx, P, S.P + ' = ' + fz(b.P, 1) + ' W', xs, ymid + 31, 'center', fs, true, P.fg, null, 100);
      labelRaw(ctx, P, 'Stromquelle', xs, ymid + 46, 'center', fs, false, P.mute, null, 100);
      /* Widerstaende (liegende Kette, senkrecht gezeichnet) mit Temperaturabfall */
      Rs.forEach((r, i) => {
        const ya = ys[i], yb = i + 1 < nN ? ys[i + 1] : yR, ym = (ya + yb) / 2, bh = Math.min(46, (yb - ya) - 22);
        ctx.fillStyle = P.panel; ctx.strokeStyle = P.sig[['jc', 'ck', 'k'][i] || 'k']; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.rect(xr - 9, ym - bh / 2, 18, bh); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = rgba(P.sig[['jc', 'ck', 'k'][i] || 'k'], 0.9); ctx.lineWidth = 1.5; ctx.beginPath();
        for (let k = 0; k < 5; k++) { const yy = ym - bh / 2 + 4 + k * (bh - 8) / 4; ctx.moveTo(xr - 9, yy); ctx.lineTo(xr + 9, yy - 3); }
        ctx.stroke();
        const lx = xr + 16;
        labelRaw(ctx, P, r[0] + ' = ' + fg(r[1], 2) + ' K/W', lx, ym - 8, 'left', fs, false, P.fg, null, R.x + cw - lx);
        labelRaw(ctx, P, 'ΔT = ' + fz(r[2], 1) + ' K', lx, ym + 8, 'left', fs, true, P.sig[['jc', 'ck', 'k'][i] || 'k'], null, R.x + cw - lx);
      });
      /* Knoten mit Temperatur */
      T.forEach((tv, i) => {
        const yy = ys[i];
        ctx.fillStyle = heatColor(tv, lo, hi); ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xr, yy, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        const lx = xr + 16;
        labelRaw(ctx, P, names[i] + ' = ' + fz(tv, 1) + ' °C', lx, yy - (fin(cths[i]) ? 7 : 0), 'left', fs, true, P.fg, null, R.x + cw - lx);
        if (fin(cths[i])) labelRaw(ctx, P, cnames[i] + ' = ' + fg(cths[i], 2) + ' J/K', lx, yy + 9, 'left', fs, false, P.mute, null, R.x + cw - lx);
        /* Kondensator: Fuellstand zeigt die Temperatur, Zweig vom Knoten nach links und nach unten zur Schiene */
        const xc = xcap0 + i * xcapStep, ch = Math.min(50, (yR - yy) * 0.45), cy0 = yy + (yR - yy) / 2 - ch / 2;
        ctx.strokeStyle = P.metal; ctx.lineWidth = 2; poly(ctx, [[xr, yy], [xc, yy], [xc, cy0]], false); ctx.stroke(); poly(ctx, [[xc, cy0 + ch], [xc, yR]], false); ctx.stroke();
        ctx.fillStyle = P.panel; ctx.strokeStyle = P.fg; ctx.lineWidth = 1.5; ctx.fillRect(xc - 7, cy0, 14, ch); ctx.strokeRect(xc - 7 + 0.5, cy0 + 0.5, 13, ch - 1);
        const fl = cl((tv - lo) / (hi - lo), 0, 1) * (ch - 2);
        ctx.fillStyle = heatColor(tv, lo, hi); ctx.fillRect(xc - 6, cy0 + ch - 1 - fl, 12, fl);
        ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xc - 10, cy0); ctx.lineTo(xc + 10, cy0); ctx.moveTo(xc - 10, cy0 + ch); ctx.lineTo(xc + 10, cy0 + ch); ctx.stroke();
      });
      /* Umgebung: Spannungsquelle Ta (Batteriesymbol) zwischen Schiene und Masse */
      ctx.fillStyle = heatColor(b.ta, lo, hi); ctx.strokeStyle = P.fg; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xr, yR, 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      const yb0 = yR + 14;
      ctx.strokeStyle = P.metal; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xr, yR + 7); ctx.lineTo(xr, yb0); ctx.stroke();
      ctx.strokeStyle = P.fg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(xr - 14, yb0); ctx.lineTo(xr + 14, yb0); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xr - 8, yb0 + 7); ctx.lineTo(xr + 8, yb0 + 7); ctx.stroke();
      ctx.strokeStyle = P.metal; ctx.beginPath(); ctx.moveTo(xr, yb0 + 7); ctx.lineTo(xr, yb0 + 20); ctx.stroke();
      ctx.strokeStyle = P.fg; ctx.beginPath(); ctx.moveTo(xr - 12, yb0 + 20); ctx.lineTo(xr + 12, yb0 + 20); ctx.moveTo(xr - 7, yb0 + 24); ctx.lineTo(xr + 7, yb0 + 24); ctx.moveTo(xr - 3, yb0 + 28); ctx.lineTo(xr + 3, yb0 + 28); ctx.stroke();
      labelRaw(ctx, P, S.ta + ' = ' + fz(b.ta, 1) + ' °C', xr + 16, yR - 0, 'left', fs, true, P.fg, null, R.x + cw - xr - 16);
      labelRaw(ctx, P, 'Umgebung (Spannungsquelle)', xr + 16, yb0 + 12, 'left', fs, false, P.mute, null, R.x + cw - xr - 16);
      labelRaw(ctx, P, 'Masse = Bezugspunkt', xr + 16, yb0 + 28, 'left', fs, false, P.mute, null, R.x + cw - xr - 16);
      /* Analogietabelle */
      const tx = wide ? w * 0.60 : pad, ty = wide ? pad + 6 : R.y + R.h + 8, tW = wide ? w - tx - pad : w - 2 * pad;
      if (wide || below) {
        const c0 = tW / 2;
        ctx.fillStyle = P.panel2; rrect(ctx, tx, ty, tW, 24, 6); ctx.fill();
        labelRaw(ctx, P, 'Elektrisch', tx + 10, ty + 12, 'left', fs, true, P.fg, null, c0 - 14); labelRaw(ctx, P, 'Thermisch', tx + c0 + 6, ty + 12, 'left', fs, true, P.fg, null, c0 - 14);
        rows.forEach((r, i) => {
          const yy = ty + 28 + i * 20;
          if (i % 2) { ctx.fillStyle = rgba(P.panel2, 0.5); ctx.fillRect(tx, yy, tW, 20); }
          labelRaw(ctx, P, r[0], tx + 10, yy + 10, 'left', fs, false, P.fg, null, c0 - 14);
          labelRaw(ctx, P, r[1], tx + c0 + 6, yy + 10, 'left', fs, false, P.fg, null, c0 - 12);
        });
      }
      return { circuit: R, nodes: ys, table: wide || below ? { x: tx, y: ty, w: tW } : null };
    });
  }

  /* ------------------------------------------------------------------ Hilfen fuer die Anlage */
  /* Daten fuer balken() aus einem oder mehreren Aufbauten (Temperaturabfaelle) */
  function balkenData(builds, opts) {
    const arr = (Array.isArray(builds) ? builds : [builds]).filter(x => x && typeof x === 'object').slice(0, 6);
    opts = obj(opts);
    const bs = arr.map(normBuild), names = Array.isArray(opts.names) ? opts.names : [], mode = opts.mode === 'rth' ? 'rth' : 'dT';
    const first = bs[0] || normBuild({});
    const data = {
      bars: bs.map((b, i) => {
        const nm = typeof names[i] === 'string' ? names[i] : (bs.length > 1 ? String.fromCharCode(65 + i) : '');
        if (mode === 'rth') return { label: nm || 'Rth_ges', parts: b.mode === 'kk' ? { jc: b.rthJC, ck: b.rthCK, k: b.rthK } : { jc: b.rthJC, k: b.rthCA }, top: fg(b.rthTotal, 2) + ' K/W' };
        return { label: nm || (b.sym.tj + ' − ' + b.sym.ta), parts: b.mode === 'kk' ? { jc: b.dJC, ck: b.dCK, k: b.dK } : { jc: b.dJC, k: b.dCA }, over: b.over, top: b.sym.tj + ' = ' + fz(b.tj, 1) + ' °C' };
      }),
      unit: mode === 'rth' ? 'K/W' : 'K',
      keys: mode === 'rth' ? { jc: first.sym.rthJC, ck: first.sym.rthCK, k: first.sym.rthK } : { jc: 'ΔT_' + 'JC', ck: 'ΔT_CK', k: 'ΔT_K' },
      colors: first.colors
    };
    if (mode === 'dT' && fin(first.tjMax)) { data.limit = { v: first.tjMax - first.ta, label: first.sym.tjMax + ' − ' + first.sym.ta + ' = ' + fz(first.tjMax - first.ta, 0) + ' K' }; data.offset = { v: first.ta, unit: '°C' }; }
    if (opts.keys && typeof opts.keys === 'object') data.keys = Object.assign(data.keys, opts.keys);
    return data;
  }

  const FNS = ['heatColor', 'legend', 'schnitt', 'kamera', 'ersatz', 'balken', 'konvektion', 'pfeil', 'thermometer', 'rauch', 'funken', 'luefter', 'drehregler',
    'kippschalter', 'lampe', 'traceChart', 'kennlinie', 'vergleich'];
  const api = { version: '1.0', heatColor, legend, schnitt, schnittLayout, kamera, kameraTemp, ersatz, balken, balkenData, konvektion, pfeil, thermometer, rauch, funken, luefter,
    drehregler, drehreglerWert, kippschalter, kippBox, lampe, traceChart, kennlinie, vergleich,
    fz, fg, ticks, palette, cssColors, mix, normBuild, PAL_DARK, PAL_LIGHT, sig: { dark: PAL_DARK.sig, light: PAL_LIGHT.sig }, fns: FNS };
  root.THM_DRAW = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
