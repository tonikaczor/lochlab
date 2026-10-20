/* pcbcore.js - Kern des Leiterplatten-Labs (Modell, Geometrie, Footprints, Konnektivitaet,
 * Zonen, DRC, IPC-Rechner, Gerber/Excellon, Stueckliste, Pick&Place, Kosten, Autorouter).
 * Keine Abhaengigkeiten, kein eval. Browser: window.PCB_CORE, Node: module.exports.
 *
 * ENTSCHEIDUNGEN ZU OFFENEN PUNKTEN
 *  - Einheiten mm, y nach unten. Drehung `rot` in Grad GEGEN den Uhrzeigersinn auf dem Bildschirm
 *    (KiCad-Konvention). Unterseite: erst an der y-Achse spiegeln (x -> -x), dann drehen.
 *  - 1-Lagen-Platine: layerList = ['B.Cu']. SMD-Pads oben liegen dann auf F.Cu (nicht in der Liste,
 *    validate() warnt).
 *  - Pin-Nummern: DIP/SOIC/TSSOP 1..n/2 links oben nach unten, dann rechts unten nach oben. LED: 1 = Kathode,
 *    2 = Anode. Dioden/LED0603/SOD-123: 1 = Kathode. Elko/C_RADIAL: 1 = Plus. TO-92/TO-220/SOT-23: siehe desc.
 *    TO-92 hat hier 2,54 mm Pitch (Wide-Variante, anfaengerfreundlich).
 *    D_DO41: 1 = Kathode, 2 = Anode. RELAY_SRD: 1 A1, 2 A2, 3 COM, 4 NO, 5 NC. XTAL_HC49: 1, 2. TERMINAL_n: Pad n = Anschluss n.
 *    SEG7_10: 1 e, 2 d, 3 gem. Kathode, 4 c, 5 dp, 6 b, 7 a, 8 gem. Kathode, 9 f, 10 g.
 *  - stackup() liefert ein Array (oben nach unten) mit Eigenschaften .total, .copper (Kupferlagen). Mask/Silk zaehlen
 *    zur Gesamtdicke; der Mittelkern/Kern wird so gewaehlt, dass die Summe board.thickness (Standard 1,6 mm) ergibt.
 *  - Zonen: Raster-Fuellung (Zellgroesse 0,1..0,25 mm, aus der Flaeche abgeleitet), Abstand = max(zone.clearance,
 *    rules.clearance), Hindernisse werden um eine halbe Zelle zusaetzlich vergroessert. Inseln ohne Anschluss
 *    (kein Pad/Via/Bahn des Netzes) werden entfernt (wie "Inseln entfernen"). Thermals: Spalt zone.thermalGap (0,3),
 *    Speichen zone.spoke (0,3), nur an gleichnetzigen Pads. Zonen verschiedener Netze auf einer Lage duerfen sich
 *    nicht ueberlappen (sonst Kurzschluss).
 *  - Netz-Zuordnung: Pads haben ihr Netz fest (aus board.nets; ohne Eintrag = kein Netz). Bahnen/Vias ohne `net`
 *    uebernehmen das Netz, an dem sie physisch haengen. Treffen zwei verschiedene feste Netze zusammen: Kurzschluss.
 *  - Silk-Pruefung: Texte und Silk-Linien FREMDER Bauteile ueber Pads (eigene Silk-Linien werden nicht geprueft).
 *  - unmask: Pad ohne Loetstopp-Oeffnung, wenn part.noMask === true | ['1','2'] oder board.noMask = ['R1.1'].
 *    Vias sind standardmaessig abgedeckt (tented), via.tented === false oeffnet sie.
 *  - Optional zusaetzlich im Modell: board.holes = [{id,x,y,d}] (nicht durchkontaktierte Bohrungen, NPTH),
 *    board.finish = 'HASL'|'ENIG', board.thickness (mm), net.current (A), net.rise (K), part.noMask, part.hideRef.
 *  - Gerber: y wird gespiegelt (Gerber y nach oben, Ursprung links unten: y_g = board.h - y). parseGerber/parseDrill
 *    liefern rohe Gerber-Koordinaten; mit opts.boardH = board.h wird zurueck in Platinen-Koordinaten (y unten) gewandelt.
 *    Loetstopp-Dateien sind wie bei KiCad "Negative" geschrieben: dunkel = Oeffnung. Bogen (G02/G03) schreibt der Kern
 *    nicht, der Parser behandelt sie als Gerade.
 *  - Pick&Place: nur SMD-Bauteile (opts.all = true: alle), Platinen-Koordinaten (y unten), Rotation wie im Modell.
 *  - Autorouter: Gitter A* (8 Richtungen, optional nur 90 Grad), Bahnbreite je Netz (net.width, sonst Power 0,4 /
 *    Signal 0,25, bei net.current mindestens IPC-Breite), Innenlagen mit Zone gelten als Ebene und werden nicht
 *    verlegt; Zonen-Netze werden per Via an die Flaeche angeschlossen. Pads abseits des Rasters werden mit kurzen
 *    Stichleitungen angebunden. Grenzen: kein Rip-up einzelner Bahnen (nur Neustart mit geaenderter Reihenfolge),
 *    keine Blind/Buried-Vias, Bahnen quer durch fremde Aussenlagen-Zonen sind erlaubt (planesplit-Warnung).
 */
(function (root) {
  'use strict';

  var EPS = 1e-6;
  var SQ2 = Math.SQRT2;

  /* ---------- Hilfsfunktionen ---------- */
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function num(v, d) {
    if (typeof v === 'string' && v.trim() !== '') v = Number(v);
    return isNum(v) ? v : d;
  }
  function arr(a) { return Array.isArray(a) ? a : []; }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function str(v, d) { return (typeof v === 'string' && v !== '') ? v : (typeof v === 'number' ? String(v) : d); }
  function r3(v) { return Math.round(v * 1000) / 1000; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  function fmt(n, dec) {
    if (!isNum(n)) return '?';
    var d = dec == null ? 3 : dec;
    return String(Number(n.toFixed(d))).replace('.', ',');
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isPt(p) { return Array.isArray(p) && p.length >= 2 && isNum(p[0]) && isNum(p[1]); }
  function cloneSafe(o) {
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
  }
  function guard(fn, fallback) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) { return typeof fallback === 'function' ? fallback(e, arguments) : fallback; }
    };
  }
  function natCmp(a, b) {
    var ra = /^([^\d]*)(\d*)(.*)$/.exec(String(a)), rb = /^([^\d]*)(\d*)(.*)$/.exec(String(b));
    if (ra[1] !== rb[1]) return ra[1] < rb[1] ? -1 : 1;
    var na = ra[2] === '' ? -1 : Number(ra[2]), nb = rb[2] === '' ? -1 : Number(rb[2]);
    if (na !== nb) return na < nb ? -1 : 1;
    return ra[3] < rb[3] ? -1 : (ra[3] > rb[3] ? 1 : 0);
  }

  /* ---------- Lagen ---------- */
  var CU_ALL = ['F.Cu', 'In1.Cu', 'In2.Cu', 'In3.Cu', 'In4.Cu', 'B.Cu'];
  var DEF_RULES = { minWidth: 0.2, clearance: 0.2, minDrill: 0.3, annular: 0.15, edge: 0.3, viaDia: 0.8, viaDrill: 0.4,
    maskExpansion: 0.05, silkWidth: 0.15, holeGap: 0.25 };

  function nLayers(b) {
    var n = Number(b && b.layers);
    return (n === 1 || n === 2 || n === 4 || n === 6) ? n : 2;
  }
  function layerList(b) {
    var n = nLayers(b);
    if (n === 1) return ['B.Cu'];
    if (n === 2) return ['F.Cu', 'B.Cu'];
    if (n === 4) return ['F.Cu', 'In1.Cu', 'In2.Cu', 'B.Cu'];
    return CU_ALL.slice();
  }
  function isOuter(l) { return l === 'F.Cu' || l === 'B.Cu'; }
  function rulesOf(b) {
    var r = {}, src = (b && isObj(b.rules)) ? b.rules : {};
    for (var k in DEF_RULES) r[k] = num(src[k], DEF_RULES[k]);
    return r;
  }
  function ozOf(b, layer) {
    return isOuter(layer) ? num(b && b.copperOz, 1) : num(b && b.inOz, 0.5);
  }

  /* ---------- Lagenaufbau ---------- */
  function stackup(board) {
    var b = board || {};
    var n = nLayers(b), ll = layerList(b), total = num(b.thickness, 1.6);
    if (!(total > 0.2)) total = 1.6;
    var ozO = num(b.copperOz, 1), ozI = num(b.inOz, 0.5);
    var out = [];
    function add(id, kind, name, th, mat, extra) {
      var o = { id: id, kind: kind, name: name, thickness: r4(th), material: mat };
      if (extra) for (var k in extra) o[k] = extra[k];
      out.push(o);
    }
    var tO = ozO * 0.035, tI = ozI * 0.035, tMask = 0.02, tSilk = 0.01;
    var fixed = 2 * tMask + 2 * tSilk;
    var i;
    for (i = 0; i < ll.length; i++) fixed += isOuter(ll[i]) ? tO : tI;
    var layout;   // Reihenfolge der Dielektrika (Dicke, Art); -1 = Rest
    if (n === 1 || n === 2) layout = [['core', -1]];
    else if (n === 4) layout = [['prepreg', 0.2], ['core', -1], ['prepreg', 0.2]];
    else layout = [['prepreg', 0.11], ['core', 0.36], ['prepreg', -1], ['core', 0.36], ['prepreg', 0.11]];
    var sumFix = 0;
    layout.forEach(function (d) { if (d[1] > 0) sumFix += d[1]; });
    var left = Math.max(0.05, total - fixed - sumFix);
    add('F.Silk', 'silk', 'Bestückungsdruck oben', tSilk, 'Epoxid-Tinte weiß');
    add('F.Mask', 'mask', 'Lötstopplack oben', tMask, 'LPI-Lötstopplack grün');
    var di = 0;
    if (n === 1) {
      add('Core1', 'core', 'Basismaterial (FR-4)', left, 'FR-4', { er: 4.5 });
      add('B.Cu', 'copper', 'Kupfer unten', tO, 'Kupfer ' + Math.round(ozO * 35 * 100) / 100 + ' µm', { oz: ozO });
    } else {
      for (i = 0; i < ll.length; i++) {
        var l = ll[i];
        add(l, 'copper', isOuter(l) ? (l === 'F.Cu' ? 'Kupfer oben' : 'Kupfer unten') : 'Kupfer innen ' + l.replace('.Cu', ''),
          isOuter(l) ? tO : tI, 'Kupfer ' + Math.round((isOuter(l) ? ozO : ozI) * 35 * 100) / 100 + ' µm',
          { oz: isOuter(l) ? ozO : ozI });
        if (i < ll.length - 1) {
          var d = layout[di++] || ['core', -1];
          var th = d[1] > 0 ? d[1] : left;
          var kind = d[0];
          add(kind === 'core' ? 'Core' + di : 'PP' + di, kind, kind === 'core' ? 'Kern (FR-4)' : 'Prepreg (FR-4)', th, 'FR-4',
            { er: kind === 'core' ? 4.5 : 4.2 });
        }
      }
    }
    add('B.Mask', 'mask', 'Lötstopplack unten', tMask, 'LPI-Lötstopplack grün');
    add('B.Silk', 'silk', 'Bestückungsdruck unten', tSilk, 'Epoxid-Tinte weiß');
    var sum = 0;
    out.forEach(function (o) { sum += o.thickness; });
    out.total = r3(sum);
    out.copper = ll.slice();
    out.layerCount = n;
    return out;
  }
  function stackupTotal(board) { return stackup(board).total; }
  // Summe der Dielektrikumsdicke zwischen zwei Kupferlagen (mm) und mittleres er
  function dielectricBetween(board, la, lb) {
    var s = stackup(board), a = -1, c = -1, i;
    for (i = 0; i < s.length; i++) { if (s[i].id === la) a = i; if (s[i].id === lb) c = i; }
    if (a < 0 || c < 0) return { h: 0, er: 4.3 };
    if (a > c) { var t = a; a = c; c = t; }
    var h = 0, e = 0;
    for (i = a + 1; i < c; i++) if (s[i].kind === 'prepreg' || s[i].kind === 'core') { h += s[i].thickness; e += s[i].thickness * (s[i].er || 4.3); }
    return { h: r4(h), er: h > 0 ? r3(e / h) : 4.3 };
  }

  /* ---------- Neue Platine / Normalisierung ---------- */
  function newBoard(opts) {
    var o = isObj(opts) ? opts : {};
    var b = {
      id: str(o.id, 'board'),
      name: str(o.name, 'Neue Platine'),
      w: num(o.w, 50) > 0 ? num(o.w, 50) : 50,
      h: num(o.h, 40) > 0 ? num(o.h, 40) : 40,
      layers: nLayers(o),
      copperOz: num(o.copperOz, 1),
      inOz: num(o.inOz, 0.5),
      rules: rulesOf(o),
      grid: num(o.grid, 0.25) > 0 ? num(o.grid, 0.25) : 0.25,
      nets: cloneSafe(arr(o.nets)),
      parts: cloneSafe(arr(o.parts)),
      tracks: cloneSafe(arr(o.tracks)),
      vias: cloneSafe(arr(o.vias)),
      zones: cloneSafe(arr(o.zones)),
      texts: cloneSafe(arr(o.texts))
    };
    if (Array.isArray(o.outline)) b.outline = cloneSafe(o.outline);
    if (o.notes != null) b.notes = o.notes;
    if (o.finish) b.finish = o.finish;
    if (o.holes) b.holes = cloneSafe(arr(o.holes));
    delete b.rules.holeGap;           // nicht im Standard-Datenmodell sichtbar
    return b;
  }
  function normalize(board) {
    var src = isObj(board) ? board : {};
    var b = cloneSafe(src);
    if (!isObj(b)) b = {};
    var base = newBoard({});
    b.id = str(b.id, base.id); b.name = str(b.name, base.name);
    b.w = num(b.w, 50) > 0 ? num(b.w, 50) : 50;
    b.h = num(b.h, 40) > 0 ? num(b.h, 40) : 40;
    b.layers = nLayers(b);
    b.copperOz = num(b.copperOz, 1); b.inOz = num(b.inOz, 0.5);
    var rr = rulesOf(b); delete rr.holeGap;
    if (isObj(b.rules) && isNum(b.rules.holeGap)) rr.holeGap = b.rules.holeGap;
    b.rules = rr;
    b.grid = num(b.grid, 0.25) > 0 ? num(b.grid, 0.25) : 0.25;
    ['nets', 'parts', 'tracks', 'vias', 'zones', 'texts'].forEach(function (k) {
      b[k] = arr(b[k]).filter(function (x) { return isObj(x); });
    });
    b.nets.forEach(function (n) { n.name = str(n.name, ''); n.pins = arr(n.pins).map(String); if (n.cls !== 'power') n.cls = 'signal'; });
    b.nets = b.nets.filter(function (n) { return n.name !== ''; });
    b.parts.forEach(function (p) {
      p.x = num(p.x, 0); p.y = num(p.y, 0); p.rot = num(p.rot, 0); p.side = p.side === 'bot' ? 'bot' : 'top';
      p.ref = str(p.ref, str(p.id, '?'));
    });
    return b;
  }

  /* ---------- Footprints ---------- */
  var FP = {};
  function P(n, x, y, shape, w, h, drill) {
    var p = { n: String(n), x: r3(x), y: r3(y), shape: shape, w: w, h: h };
    if (drill) p.drill = drill;
    return p;
  }
  function tp(n, x, y, d, drill, rect) { return P(n, x, y, rect ? 'rect' : 'round', d, d, drill); }
  function sRect(x, y, w, h) { return { t: 'rect', x: r3(x), y: r3(y), w: r3(w), h: r3(h) }; }
  function sLine(x1, y1, x2, y2) { return { t: 'line', x1: r3(x1), y1: r3(y1), x2: r3(x2), y2: r3(y2) }; }
  function sCirc(x, y, r) { return { t: 'circle', x: r3(x), y: r3(y), r: r3(r) }; }
  function addFP(id, name, kind, desc, pads, silk, o) {
    o = o || {};
    var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    pads.forEach(function (p) {
      x0 = Math.min(x0, p.x - p.w / 2); x1 = Math.max(x1, p.x + p.w / 2);
      y0 = Math.min(y0, p.y - p.h / 2); y1 = Math.max(y1, p.y + p.h / 2);
    });
    (silk || []).forEach(function (s) {
      if (s.t === 'rect') { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x + s.w); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y + s.h); }
      else if (s.t === 'line') { x0 = Math.min(x0, s.x1, s.x2); x1 = Math.max(x1, s.x1, s.x2); y0 = Math.min(y0, s.y1, s.y2); y1 = Math.max(y1, s.y1, s.y2); }
      else if (s.t === 'circle') { x0 = Math.min(x0, s.x - s.r); x1 = Math.max(x1, s.x + s.r); y0 = Math.min(y0, s.y - s.r); y1 = Math.max(y1, s.y + s.r); }
    });
    var m = o.margin != null ? o.margin : (kind === 'tht' ? 0.4 : 0.25);
    var fp = { id: id, name: name, kind: kind, desc: desc, pads: pads, silk: silk || [],
      courtyard: { x: r3(x0 - m), y: r3(y0 - m), w: r3(x1 - x0 + 2 * m), h: r3(y1 - y0 + 2 * m) } };
    if (o.bodyH != null) fp.bodyH = o.bodyH;
    if (o.body) fp.body = o.body;
    FP[id] = fp;
  }
  function dualRow(total, pitch, rowD, mk) {
    var half = total / 2, pads = [], y0 = -(half - 1) * pitch / 2, i;
    for (i = 0; i < half; i++) pads.push(mk(i + 1, -rowD / 2, y0 + i * pitch));
    for (i = 0; i < half; i++) pads.push(mk(half + i + 1, rowD / 2, y0 + (half - 1 - i) * pitch));
    return pads;
  }
  (function buildFootprints() {
    // --- THT ---
    addFP('R_AXIAL_10', 'Widerstand axial 10,16', 'tht', 'Bedrahteter Widerstand, Rastermaß 10,16 mm',
      [tp(1, -5.08, 0, 1.8, 0.8, true), tp(2, 5.08, 0, 1.8, 0.8)], [sRect(-3.15, -1.25, 6.3, 2.5)], { bodyH: 2.5, body: { w: 6.3, h: 2.5 } });
    addFP('R_AXIAL_7', 'Widerstand axial 7,62', 'tht', 'Bedrahteter Widerstand, Rastermaß 7,62 mm (liegend, kleine Bauform)',
      [tp(1, -3.81, 0, 1.6, 0.8, true), tp(2, 3.81, 0, 1.6, 0.8)], [sRect(-2.4, -1, 4.8, 2)], { bodyH: 2.2, body: { w: 4.8, h: 2 } });
    addFP('C_RADIAL_2.5', 'Elko radial 2,5', 'tht', 'Radialkondensator, Rastermaß 2,5 mm (5 mm Durchmesser), Pin 1 = Plus',
      [tp(1, -1.25, 0, 1.5, 0.8, true), tp(2, 1.25, 0, 1.5, 0.8)], [sCirc(0, 0, 2.6)], { bodyH: 11, body: { w: 5, h: 5 } });
    addFP('C_RADIAL_5', 'Elko radial 5', 'tht', 'Radialkondensator, Rastermaß 5 mm (10 mm Durchmesser), Pin 1 = Plus',
      [tp(1, -2.5, 0, 2, 1, true), tp(2, 2.5, 0, 2, 1)], [sCirc(0, 0, 5.2)], { bodyH: 16, body: { w: 10, h: 10 } });
    addFP('LED_5MM', 'LED 5 mm', 'tht', 'LED 5 mm bedrahtet, Pin 1 = Kathode (flache Seite), Pin 2 = Anode',
      [tp(1, -1.27, 0, 1.8, 1, true), tp(2, 1.27, 0, 1.8, 1)], [sCirc(0, 0, 2.9)], { bodyH: 8.6, body: { w: 5.8, h: 5.8 } });
    [8, 14, 16].forEach(function (n) {
      var half = n / 2, ht = (half - 1) * 2.54 / 2 + 1.3;
      addFP('DIP-' + n, 'DIP-' + n, 'tht', 'Dual-Inline-Gehäuse, ' + n + ' Pins, Raster 2,54 mm, Reihenabstand 7,62 mm, Pin 1 links oben',
        dualRow(n, 2.54, 7.62, function (k, x, y) { return tp(k, x, y, 1.6, 0.8, k === 1); }),
        [sRect(-2.5, -ht, 5, 2 * ht), sCirc(-1.2, -ht + 0.9, 0.35)], { bodyH: 4, body: { w: 6.4, h: 2 * ht } });
    });
    addFP('TO-92', 'TO-92', 'tht', 'Transistor TO-92, 3 Pins im Abstand 2,54 mm (Pin 1 links, flache Seite zum Betrachter)',
      [tp(1, -2.54, 0, 1.6, 0.8, true), tp(2, 0, 0, 1.6, 0.8), tp(3, 2.54, 0, 1.6, 0.8)], [sRect(-2.3, -3.6, 4.6, 3.0)], { bodyH: 5, body: { w: 4.6, h: 4.6 } });
    addFP('TO-220', 'TO-220', 'tht', 'Leistungsgehäuse TO-220, 3 Pins im Abstand 2,54 mm, Kühlfahne oben (Pin 1 links)',
      [P(1, -2.54, 0, 'rect', 1.9, 2.4, 1.1), P(2, 0, 0, 'oval', 1.9, 2.4, 1.1), P(3, 2.54, 0, 'oval', 1.9, 2.4, 1.1)],
      [sRect(-5.1, -5.8, 10.2, 4.2), sLine(-5.1, -3.6, 5.1, -3.6)], { bodyH: 9, body: { w: 10.2, h: 4.5 } });
    [2, 4].forEach(function (n) {
      var pads = [], i;
      for (i = 0; i < n; i++) pads.push(tp(i + 1, 0, (i - (n - 1) / 2) * 2.54, 1.7, 1, i === 0));
      addFP('HDR_1x' + n, 'Stiftleiste 1x' + n, 'tht', 'Stiftleiste einreihig, ' + n + ' Pins, Raster 2,54 mm, Pin 1 oben',
        pads, [sRect(-1.27, -n * 1.27, 2.54, n * 2.54)], { bodyH: 8.5, body: { w: 2.54, h: n * 2.54 } });
    });
    (function () {
      var pads = [], i;
      for (i = 0; i < 5; i++) {
        var y = (i - 2) * 2.54;
        pads.push(tp(2 * i + 1, -1.27, y, 1.7, 1, i === 0));
        pads.push(tp(2 * i + 2, 1.27, y, 1.7, 1));
      }
      addFP('HDR_2x5', 'Stiftleiste 2x5', 'tht', 'Stiftleiste zweireihig, 10 Pins (2x5), Raster 2,54 mm; ungerade Pins links, gerade rechts',
        pads, [sRect(-2.54, -6.35, 5.08, 12.7)], { bodyH: 8.5, body: { w: 5.08, h: 12.7 } });
    })();
    addFP('DC_JACK', 'DC-Buchse', 'tht', 'DC-Hohlsteckerbuchse 5,5/2,1 mm: Pin 1 = Mittenstift, 2 = Masse (Hülse), 3 = Schaltkontakt',
      [P(1, 0, 0, 'oval', 3.0, 3.5, 1.0), P(2, 0, 6, 'oval', 3.0, 3.5, 1.0), P(3, 4.7, 3, 'oval', 3.5, 3.0, 1.0)],
      [sRect(-4.5, -3, 14, 9)], { bodyH: 11, body: { w: 14, h: 9 } });
    addFP('SWITCH_6MM', 'Taster 6 mm', 'tht', 'Kurzhubtaster 6x6 mm, 4 Pins (1-2 und 3-4 intern verbunden)',
      [tp(1, -3.25, -2.25, 2, 1.1, true), tp(2, 3.25, -2.25, 2, 1.1), tp(3, -3.25, 2.25, 2, 1.1), tp(4, 3.25, 2.25, 2, 1.1)],
      [sLine(-3, -1, -3, 1), sLine(3, -1, 3, 1), sLine(-1, -3, 1, -3), sLine(-1, 3, 1, 3)], { bodyH: 4.3, body: { w: 6, h: 6 } });

    /* Ergaenzungen fuer die Verbundprojekte (Paket A3). Pad-Nummer = Anschlussnummer der Netzliste (Verbund.nl.FPMAP).
       Gehaeusemasse sind Lehrwerte (A): vor einer echten Fertigung am Datenblatt des gewaehlten Bauteils pruefen. */
    addFP('D_DO41', 'Diode DO-41', 'tht', 'Bedrahtete Diode DO-41 liegend, Rastermaß 10,16 mm, Pin 1 = Kathode (Ring), Pin 2 = Anode',
      [tp(1, -5.08, 0, 1.8, 1, true), tp(2, 5.08, 0, 1.8, 1)], [sRect(-2.6, -1.35, 5.2, 2.7), sLine(-1.7, -1.35, -1.7, 1.35)], { bodyH: 2.7, body: { w: 5.2, h: 2.7 } });
    addFP('RELAY_SRD', 'Relais SRD (Wechsler)', 'tht', 'Print-Relais im Gehäuse 19 x 15,5 mm (Bauform SRD, Raster vereinfacht (A)): Pin 1 = A1, 2 = A2 (Spule), 3 = COM, 4 = NO, 5 = NC',
      [P(1, -7, -3.75, 'oval', 2.6, 2.2, 1.3), P(2, -7, 3.75, 'oval', 2.6, 2.2, 1.3), P(3, 7, 0, 'oval', 2.6, 2.2, 1.3), P(4, 7, -6, 'oval', 2.6, 2.2, 1.3), P(5, 7, 6, 'oval', 2.6, 2.2, 1.3)],
      [sRect(-9.5, -7.75, 19, 15.5), sLine(-9.5, -5.5, -8.3, -5.5)], { bodyH: 15.5, body: { w: 19, h: 15.5 } });
    addFP('XTAL_HC49', 'Quarz HC-49', 'tht', 'Quarz HC-49 bedrahtet, Pinabstand 4,88 mm, Pin 1 und 2 beliebig tauschbar',
      [tp(1, -2.44, 0, 1.7, 0.9, true), tp(2, 2.44, 0, 1.7, 0.9)], [sRect(-5.5, -2.3, 11, 4.6)], { bodyH: 13.5, body: { w: 11, h: 4.6 } });
    (function () {
      var pads = dualRow(10, 2.54, 10.16, function (k, x, y) { return tp(k, x, y, 1.6, 0.8, k === 1); });
      addFP('SEG7_10', '7-Segment-Anzeige 10 Pins', 'tht', '7-Segment-Anzeige 10 Pins (gängige Norm, Reihenabstand 10,16 mm (A)): 1 e, 2 d, 3 gem. Kathode, 4 c, 5 dp, 6 b, 7 a, 8 gem. Kathode, 9 f, 10 g; Zählweise wie DIP',
        pads, [sRect(-6.3, -9.5, 12.6, 19), sCirc(-4.4, -8, 0.4)], { bodyH: 8, body: { w: 12.6, h: 19 } });
    })();
    [2, 3].forEach(function (n) {
      var pads = [], i;
      for (i = 0; i < n; i++) pads.push(tp(i + 1, 0, (i - (n - 1) / 2) * 5.08, 2.4, 1.3, i === 0));
      addFP('TERMINAL_' + n, 'Schraubklemme ' + n + '-polig', 'tht', 'Schraubklemme ' + n + '-polig (kompakte Bauform, Körper nur 4,6 mm tief (A)), Raster 5,08 mm, Pin 1 oben, Pad n = Anschluss n',
        pads, [sRect(-2.3, -n * 2.54, 4.6, n * 5.08)], { bodyH: 10, body: { w: 4.6, h: n * 5.08 } });
    });

    // --- SMD Chip ---
    function chip(id, name, desc, px, pw, ph, silkY, extra) {
      var pads = [P(1, -px, 0, 'rect', pw, ph), P(2, px, 0, 'rect', pw, ph)];
      var silk = silkY ? [sLine(-px + pw / 2 + 0.12, -silkY, px - pw / 2 - 0.12, -silkY), sLine(-px + pw / 2 + 0.12, silkY, px - pw / 2 - 0.12, silkY)] : [];
      if (extra) silk = silk.concat(extra);
      addFP(id, name, 'smd', desc, pads, silk, { bodyH: 0.5 });
    }
    chip('R0402', 'Widerstand 0402', 'SMD-Chip 0402 (1,0 x 0,5 mm)', 0.5, 0.55, 0.6, 0);
    chip('R0603', 'Widerstand 0603', 'SMD-Chip 0603 (1,6 x 0,8 mm), Pads 0,9 x 1,0 mm, Mitte-Mitte 1,6 mm', 0.8, 0.9, 1.0, 0.65);
    chip('R0805', 'Widerstand 0805', 'SMD-Chip 0805 (2,0 x 1,25 mm)', 0.95, 1.0, 1.4, 0.9);
    chip('R1206', 'Widerstand 1206', 'SMD-Chip 1206 (3,2 x 1,6 mm)', 1.4, 1.25, 1.75, 1.1);
    chip('C0603', 'Kondensator 0603', 'SMD-Chip 0603, Kondensator', 0.8, 0.9, 1.0, 0.65);
    chip('C0805', 'Kondensator 0805', 'SMD-Chip 0805, Kondensator', 0.95, 1.0, 1.4, 0.9);
    chip('LED0603', 'LED 0603', 'SMD-LED 0603, Pin 1 = Kathode (Markierung links), Pin 2 = Anode', 0.8, 0.9, 1.0, 0.65, [sLine(-1.55, -0.5, -1.55, 0.5)]);
    addFP('SOD-123', 'Diode SOD-123', 'smd', 'SMD-Diode SOD-123, Pin 1 = Kathode, Pin 2 = Anode',
      [P(1, -1.65, 0, 'rect', 0.9, 1.2), P(2, 1.65, 0, 'rect', 0.9, 1.2)],
      [sLine(-1, -0.95, 1, -0.95), sLine(-1, 0.95, 1, 0.95), sLine(-2.4, -0.6, -2.4, 0.6)], { bodyH: 1.1 });
    addFP('SOT-23', 'SOT-23', 'smd', 'Transistor/Regler SOT-23, 3 Pins: 1 links oben, 2 links unten, 3 rechts',
      [P(1, -1.1, -0.95, 'rect', 1.0, 0.8), P(2, -1.1, 0.95, 'rect', 1.0, 0.8), P(3, 1.1, 0, 'rect', 1.0, 0.8)],
      [sLine(-0.8, -1.55, 0.8, -1.55), sLine(-0.8, 1.55, 0.8, 1.55)], { bodyH: 1.1 });
    addFP('SOT-223', 'SOT-223', 'smd', 'Spannungsregler SOT-223: Pins 1-3 links, Kühlfahne (Pin 4) rechts',
      [P(1, -3.15, -2.3, 'rect', 2.0, 1.5), P(2, -3.15, 0, 'rect', 2.0, 1.5), P(3, -3.15, 2.3, 'rect', 2.0, 1.5), P(4, 3.15, 0, 'rect', 2.0, 3.8)],
      [sLine(-1.9, -1.9, 1.9, -1.9), sLine(-1.9, 1.9, 1.9, 1.9)], { bodyH: 1.8 });
    [8, 14, 16].forEach(function (n) {
      var half = n / 2, yt = (half - 1) * 1.27 / 2 + 0.7;
      addFP('SOIC-' + n, 'SOIC-' + n, 'smd', 'SOIC-' + n + ' (Raster 1,27 mm, Reihenabstand 5,4 mm), Pin 1 links oben',
        dualRow(n, 1.27, 5.4, function (k, x, y) { return P(k, x, y, 'rect', 1.55, 0.6); }),
        [sLine(-1.8, -yt, 1.8, -yt), sLine(-1.8, yt, 1.8, yt), sCirc(-1.3, -yt + 0.25, 0.2)], { bodyH: 1.75 });
    });
    addFP('TSSOP-16', 'TSSOP-16', 'smd', 'TSSOP-16 (Raster 0,65 mm), Pin 1 links oben',
      dualRow(16, 0.65, 5.6, function (k, x, y) { return P(k, x, y, 'rect', 1.45, 0.4); }),
      [sLine(-1.9, -2.95, 1.9, -2.95), sLine(-1.9, 2.95, 1.9, 2.95), sCirc(-1.3, -2.6, 0.2)], { bodyH: 1.1 });
    (function () {
      var pads = [], i, pn = 1, c = 4.2, pt = 0.8;
      for (i = 0; i < 8; i++) pads.push(P(pn++, -c, (i - 3.5) * pt, 'rect', 1.6, 0.55));
      for (i = 0; i < 8; i++) pads.push(P(pn++, (i - 3.5) * pt, c, 'rect', 0.55, 1.6));
      for (i = 0; i < 8; i++) pads.push(P(pn++, c, (3.5 - i) * pt, 'rect', 1.6, 0.55));
      for (i = 0; i < 8; i++) pads.push(P(pn++, (3.5 - i) * pt, -c, 'rect', 0.55, 1.6));
      addFP('QFP-32', 'QFP-32 (7x7)', 'smd', 'LQFP-32 7x7 mm, Raster 0,8 mm, Pin 1 links oben, gegen den Uhrzeigersinn gezählt',
        pads, [sRect(-3.3, -3.3, 6.6, 6.6), sCirc(-2.6, -2.6, 0.3)], { bodyH: 1.6 });
    })();
    (function () {
      var pads = [], i, pn = 1, c = 1.45, pt = 0.5;
      for (i = 0; i < 4; i++) pads.push(P(pn++, -c, (i - 1.5) * pt, 'rect', 0.8, 0.28));
      for (i = 0; i < 4; i++) pads.push(P(pn++, (i - 1.5) * pt, c, 'rect', 0.28, 0.8));
      for (i = 0; i < 4; i++) pads.push(P(pn++, c, (1.5 - i) * pt, 'rect', 0.8, 0.28));
      for (i = 0; i < 4; i++) pads.push(P(pn++, (1.5 - i) * pt, -c, 'rect', 0.28, 0.8));
      pads.push(P(17, 0, 0, 'rect', 1.6, 1.6));
      addFP('QFN-16', 'QFN-16 (3x3)', 'smd', 'QFN-16 3x3 mm, Raster 0,5 mm, Pin 17 = Thermal-Pad (Exposed Pad)',
        pads, [sLine(-1.6, -1.6, -1.1, -1.6), sLine(-1.6, -1.6, -1.6, -1.1)], { bodyH: 0.9 });
    })();
  })();

  function footprint(id) {
    if (typeof id !== 'string') return null;
    if (FP[id]) return FP[id];
    var u = id.toUpperCase();
    for (var k in FP) if (k.toUpperCase() === u) return FP[k];
    return null;
  }

  /* ---------- Transformation ---------- */
  function rotCS(rot) {
    var r = ((rot % 360) + 360) % 360;
    if (r === 0) return [1, 0];
    if (r === 90) return [0, 1];
    if (r === 180) return [-1, 0];
    if (r === 270) return [0, -1];
    var a = r * Math.PI / 180;
    return [Math.cos(a), Math.sin(a)];
  }
  // Punkt aus Footprint-Koordinaten in Weltkoordinaten
  function xform(part, px, py) {
    var cs = rotCS(num(part.rot, 0)), x = part.side === 'bot' ? -px : px;
    return [num(part.x, 0) + x * cs[0] + py * cs[1], num(part.y, 0) - x * cs[1] + py * cs[0]];
  }
  function partRotNorm(part) { var r = Math.round(num(part.rot, 0)) % 360; return r < 0 ? r + 360 : r; }

  function netMap(board) {
    var m = {};
    arr(board && board.nets).forEach(function (n) {
      if (!isObj(n) || typeof n.name !== 'string') return;
      arr(n.pins).forEach(function (p) { p = String(p); if (!(p in m)) m[p] = n.name; });
    });
    return m;
  }
  function netByName(board) {
    var m = {};
    arr(board && board.nets).forEach(function (n) { if (isObj(n) && typeof n.name === 'string') m[n.name] = n; });
    return m;
  }

  function padsOfRaw(board) {
    var out = [];
    if (!isObj(board)) return out;
    var ll = layerList(board), nm = netMap(board);
    arr(board.parts).forEach(function (part) {
      if (!isObj(part)) return;
      var fp = footprint(part.fp);
      if (!fp) return;
      var ref = str(part.ref, str(part.id, '?'));
      var side = part.side === 'bot' ? 'bot' : 'top';
      var rot = partRotNorm(part);
      var cs = rotCS(rot);
      fp.pads.forEach(function (p) {
        var xy = xform({ x: part.x, y: part.y, rot: rot, side: side }, p.x, p.y);
        var w = p.w, h = p.h;
        if (rot % 180 === 90) { w = p.h; h = p.w; }
        else if (rot % 90 !== 0) { w = Math.abs(p.w * cs[0]) + Math.abs(p.h * cs[1]); h = Math.abs(p.w * cs[1]) + Math.abs(p.h * cs[0]); }
        var tht = !!(p.drill && p.drill > 0);
        var id = ref + '.' + p.n;
        out.push({ id: id, part: part.id, ref: ref, n: p.n, x: r4(xy[0]), y: r4(xy[1]), w: r4(w), h: r4(h), shape: p.shape,
          drill: p.drill || 0, rot: rot, side: side, kind: tht ? 'tht' : 'smd',
          layers: tht ? ll.slice() : [side === 'bot' ? 'B.Cu' : 'F.Cu'], net: (id in nm) ? nm[id] : null });
      });
    });
    return out;
  }
  var padsOf = guard(padsOfRaw, []);

  // Weltgeometrie eines Bauteils: Silk-Formen, Courtyard (Rechteck), Anker fuer Referenztext
  function partGeometry(board, part) {
    var fp = footprint(part && part.fp);
    if (!fp || !isObj(part)) return null;
    var side = part.side === 'bot' ? 'bot' : 'top';
    var pp = { x: num(part.x, 0), y: num(part.y, 0), rot: partRotNorm(part), side: side };
    var silk = [];
    fp.silk.forEach(function (s) {
      if (s.t === 'line') { var a = xform(pp, s.x1, s.y1), b = xform(pp, s.x2, s.y2); silk.push({ t: 'line', x1: a[0], y1: a[1], x2: b[0], y2: b[1] }); }
      else if (s.t === 'rect') {
        var c = [xform(pp, s.x, s.y), xform(pp, s.x + s.w, s.y), xform(pp, s.x + s.w, s.y + s.h), xform(pp, s.x, s.y + s.h)];
        for (var i = 0; i < 4; i++) { var u = c[i], v = c[(i + 1) % 4]; silk.push({ t: 'line', x1: u[0], y1: u[1], x2: v[0], y2: v[1] }); }
      } else if (s.t === 'circle') { var m = xform(pp, s.x, s.y); silk.push({ t: 'circle', x: m[0], y: m[1], r: s.r }); }
    });
    var cy = fp.courtyard;
    var cc = [xform(pp, cy.x, cy.y), xform(pp, cy.x + cy.w, cy.y), xform(pp, cy.x + cy.w, cy.y + cy.h), xform(pp, cy.x, cy.y + cy.h)];
    var xs = cc.map(function (p) { return p[0]; }), ys = cc.map(function (p) { return p[1]; });
    return { fp: fp, side: side, silk: silk,
      courtyard: { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys), corners: cc } };
  }

  /* ---------- Geometrie-Grundformen ---------- */
  // Formen: {k:'c', x1,y1,x2,y2,r} (Kapsel/Kreis)  |  {k:'r', x0,y0,x1,y1} (Rechteck)
  function capShape(x1, y1, x2, y2, r) { return { k: 'c', x1: x1, y1: y1, x2: x2, y2: y2, r: r }; }
  function padShape(p) {
    var w = p.w, h = p.h;
    if (p.shape === 'rect') return { k: 'r', x0: p.x - w / 2, y0: p.y - h / 2, x1: p.x + w / 2, y1: p.y + h / 2 };
    if (Math.abs(w - h) < 1e-9) return capShape(p.x, p.y, p.x, p.y, w / 2);
    var r = Math.min(w, h) / 2, d;
    if (w >= h) { d = (w - h) / 2; return capShape(p.x - d, p.y, p.x + d, p.y, r); }
    d = (h - w) / 2; return capShape(p.x, p.y - d, p.x, p.y + d, r);
  }
  function shapeBBox(s) {
    if (s.k === 'r') return [s.x0, s.y0, s.x1, s.y1];
    return [Math.min(s.x1, s.x2) - s.r, Math.min(s.y1, s.y2) - s.r, Math.max(s.x1, s.x2) + s.r, Math.max(s.y1, s.y2) + s.r];
  }
  function ptSegD(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = 0;
    if (l2 > 0) { t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : (t > 1 ? 1 : t); }
    var qx = ax + t * dx - px, qy = ay + t * dy - py;
    return Math.sqrt(qx * qx + qy * qy);
  }
  function ptSegClosest(px, py, ax, ay, bx, by) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = 0;
    if (l2 > 0) { t = ((px - ax) * dx + (py - ay) * dy) / l2; t = t < 0 ? 0 : (t > 1 ? 1 : t); }
    return [ax + t * dx, ay + t * dy];
  }
  function segInter(ax, ay, bx, by, cx, cy, dx, dy) {
    var d1x = bx - ax, d1y = by - ay, d2x = dx - cx, d2y = dy - cy;
    var den = d1x * d2y - d1y * d2x;
    if (Math.abs(den) < 1e-12) return null;
    var t = ((cx - ax) * d2y - (cy - ay) * d2x) / den;
    var u = ((cx - ax) * d1y - (cy - ay) * d1x) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return [ax + t * d1x, ay + t * d1y];
    return null;
  }
  // Abstand Strecke-Strecke mit naechsten Punkten: {d, p:[x,y], q:[x,y]}
  function segSegDist(a1, a2, b1, b2) {
    var ip = segInter(a1[0], a1[1], a2[0], a2[1], b1[0], b1[1], b2[0], b2[1]);
    if (ip) return { d: 0, p: ip, q: ip };
    var best = null, c;
    c = ptSegClosest(a1[0], a1[1], b1[0], b1[1], b2[0], b2[1]); best = { d: Math.hypot(c[0] - a1[0], c[1] - a1[1]), p: a1, q: c };
    c = ptSegClosest(a2[0], a2[1], b1[0], b1[1], b2[0], b2[1]); var d = Math.hypot(c[0] - a2[0], c[1] - a2[1]);
    if (d < best.d) best = { d: d, p: a2, q: c };
    c = ptSegClosest(b1[0], b1[1], a1[0], a1[1], a2[0], a2[1]); d = Math.hypot(c[0] - b1[0], c[1] - b1[1]);
    if (d < best.d) best = { d: d, p: c, q: b1 };
    c = ptSegClosest(b2[0], b2[1], a1[0], a1[1], a2[0], a2[1]); d = Math.hypot(c[0] - b2[0], c[1] - b2[1]);
    if (d < best.d) best = { d: d, p: c, q: b2 };
    return best;
  }
  function inRect(r, x, y) { return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1; }
  // Abstand Kapsel-Achse zu Rechteck (Kapselradius wird NICHT abgezogen): {d,x,y}
  function segRectDist(x1, y1, x2, y2, r) {
    if (inRect(r, x1, y1)) return { d: 0, x: x1, y: y1 };
    if (inRect(r, x2, y2)) return { d: 0, x: x2, y: y2 };
    var E = [[[r.x0, r.y0], [r.x1, r.y0]], [[r.x1, r.y0], [r.x1, r.y1]], [[r.x1, r.y1], [r.x0, r.y1]], [[r.x0, r.y1], [r.x0, r.y0]]];
    var best = null;
    for (var i = 0; i < 4; i++) {
      var s = segSegDist([x1, y1], [x2, y2], E[i][0], E[i][1]);
      if (!best || s.d < best.d) best = { d: s.d, x: (s.p[0] + s.q[0]) / 2, y: (s.p[1] + s.q[1]) / 2 };
    }
    return best;
  }
  // Luftspalt zwischen zwei Formen (negativ = Ueberlappung bei Kapseln); {d,x,y}
  function shapeDist(a, b) {
    if (a.k === 'c' && b.k === 'c') {
      var s = segSegDist([a.x1, a.y1], [a.x2, a.y2], [b.x1, b.y1], [b.x2, b.y2]);
      return { d: s.d - a.r - b.r, x: (s.p[0] + s.q[0]) / 2, y: (s.p[1] + s.q[1]) / 2 };
    }
    if (a.k === 'r' && b.k === 'r') {
      var dx = Math.max(0, Math.max(a.x0 - b.x1, b.x0 - a.x1)), dy = Math.max(0, Math.max(a.y0 - b.y1, b.y0 - a.y1));
      var ox0 = Math.max(a.x0, b.x0), ox1 = Math.min(a.x1, b.x1), oy0 = Math.max(a.y0, b.y0), oy1 = Math.min(a.y1, b.y1);
      var px, py;
      if (ox0 <= ox1) px = (ox0 + ox1) / 2; else px = a.x1 < b.x0 ? (a.x1 + b.x0) / 2 : (b.x1 + a.x0) / 2;
      if (oy0 <= oy1) py = (oy0 + oy1) / 2; else py = a.y1 < b.y0 ? (a.y1 + b.y0) / 2 : (b.y1 + a.y0) / 2;
      return { d: Math.sqrt(dx * dx + dy * dy), x: px, y: py };
    }
    var c = a.k === 'c' ? a : b, rr = a.k === 'r' ? a : b;
    var q = segRectDist(c.x1, c.y1, c.x2, c.y2, rr);
    return { d: q.d - c.r, x: q.x, y: q.y };
  }
  function pointInPoly(x, y, poly) {
    var inside = false, n = poly.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function validPoly(p) { return Array.isArray(p) && p.length >= 3 && p.every(isPt); }
  function outlineOf(b) {
    if (validPoly(b && b.outline)) return b.outline.map(function (p) { return [p[0], p[1]]; });
    var w = num(b && b.w, 50), h = num(b && b.h, 40);
    return [[0, 0], [w, 0], [w, h], [0, h]];
  }
  function polyBBox(poly) {
    var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18;
    poly.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
    return [x0, y0, x1, y1];
  }
  function polyArea(poly) {
    var a = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
    return Math.abs(a / 2);
  }
  function trackW(b, t) {
    var w = num(t && t.w, 0);
    if (w > 0) return w;
    var n = t && t.net ? netByName(b)[t.net] : null;
    return n && num(n.width, 0) > 0 ? n.width : 0.25;
  }
  function trackPts(t) { return arr(t && t.pts).filter(isPt); }
  function viaSpan(b, v) {
    var ll = layerList(b), a = ll.indexOf(v && v.from), c = ll.indexOf(v && v.to);
    if (a < 0) a = 0;
    if (c < 0) c = ll.length - 1;
    if (a > c) { var t = a; a = c; c = t; }
    return ll.slice(a, c + 1);
  }

  /* Raeumlicher Index (Gitter-Hash) */
  function SGrid(cell) { this.c = cell; this.m = {}; this.stamp = 0; this.seen = {}; }
  SGrid.prototype.insert = function (bb, id) {
    var c = this.c, i0 = Math.floor(bb[0] / c), i1 = Math.floor(bb[2] / c), j0 = Math.floor(bb[1] / c), j1 = Math.floor(bb[3] / c);
    if ((i1 - i0 + 1) * (j1 - j0 + 1) > 40000) { i1 = i0 + 199; j1 = j0 + 199; }
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var k = i * 100003 + j, l = this.m[k];
      if (l) l.push(id); else this.m[k] = [id];
    }
  };
  SGrid.prototype.query = function (bb) {
    var c = this.c, i0 = Math.floor(bb[0] / c), i1 = Math.floor(bb[2] / c), j0 = Math.floor(bb[1] / c), j1 = Math.floor(bb[3] / c), out = [];
    var st = ++this.stamp, seen = this.seen;
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var l = this.m[i * 100003 + j];
      if (l) for (var q = 0; q < l.length; q++) { var id = l[q]; if (seen[id] !== st) { seen[id] = st; out.push(id); } }
    }
    return out;
  };

  /* ---------- Analyse-Cache ---------- */
  var _cache = [];
  function sigOf(b) {
    return JSON.stringify([b.w, b.h, b.outline, b.layers, b.rules, b.nets,
      arr(b.parts).map(function (p) { return isObj(p) ? [p.id, p.ref, p.fp, p.x, p.y, p.rot, p.side] : null; }),
      b.tracks, b.vias, b.zones, b.holes]);
  }
  function analysis(b) {
    var key = sigOf(b), i;
    for (i = 0; i < _cache.length; i++) if (_cache[i].key === key) return _cache[i];
    var A = { key: key, pads: padsOfRaw(b), rules: rulesOf(b), layers: layerList(b), fills: {}, conn: null };
    _cache.unshift(A);
    if (_cache.length > 4) _cache.length = 4;
    return A;
  }

  /* ---------- Zonen-Fuellung (Raster) ---------- */
  function zoneKey(z) { return JSON.stringify([z.id, z.layer, z.net, z.poly, z.clearance, z.thermals, z.thermalGap, z.spoke, z.res]); }

  function markDist(mask, R, s, rad, val) {
    var cs = R.cs, nx = R.nx, ny = R.ny, bb = shapeBBox(s);
    var i0 = Math.max(0, Math.floor((bb[0] - rad - R.ox) / cs)), i1 = Math.min(nx - 1, Math.floor((bb[2] + rad - R.ox) / cs));
    var j0 = Math.max(0, Math.floor((bb[1] - rad - R.oy) / cs)), j1 = Math.min(ny - 1, Math.floor((bb[3] + rad - R.oy) / cs));
    var i, j, cx, cy, d;
    if (s.k === 'c') {
      var lim = rad + s.r;
      for (j = j0; j <= j1; j++) {
        cy = R.oy + (j + 0.5) * cs;
        for (i = i0; i <= i1; i++) {
          cx = R.ox + (i + 0.5) * cs;
          if (ptSegD(cx, cy, s.x1, s.y1, s.x2, s.y2) <= lim) mask[j * nx + i] = val;
        }
      }
    } else {
      for (j = j0; j <= j1; j++) {
        cy = R.oy + (j + 0.5) * cs;
        var dy = Math.max(s.y0 - cy, 0, cy - s.y1);
        for (i = i0; i <= i1; i++) {
          cx = R.ox + (i + 0.5) * cs;
          var dx = Math.max(s.x0 - cx, 0, cx - s.x1);
          if (Math.sqrt(dx * dx + dy * dy) <= rad) mask[j * nx + i] = val;
        }
      }
    }
  }
  function scanPoly(poly, R, mask) {
    var n = poly.length, xs = [];
    for (var j = 0; j < R.ny; j++) {
      var y = R.oy + (j + 0.5) * R.cs;
      xs.length = 0;
      for (var a = 0, c = n - 1; a < n; c = a++) {
        var p = poly[c], q = poly[a];
        if ((p[1] > y) !== (q[1] > y)) xs.push(p[0] + (y - p[1]) * (q[0] - p[0]) / (q[1] - p[1]));
      }
      xs.sort(function (u, v) { return u - v; });
      for (var k = 0; k + 1 < xs.length; k += 2) {
        var i0 = Math.max(0, Math.ceil((xs[k] - R.ox) / R.cs - 0.5)), i1 = Math.min(R.nx - 1, Math.floor((xs[k + 1] - R.ox) / R.cs - 0.5));
        for (var i = i0; i <= i1; i++) mask[j * R.nx + i] = 1;
      }
    }
  }
  // welche (behaltenen) Inseln beruehrt die Form
  function touchLabels(R, s) {
    var out = {}, cs = R.cs, rr = cs * 0.75, lab = R.label, nx = R.nx, ny = R.ny;
    function scan(xc, yc, rad, rect) {
      var i0 = Math.max(0, Math.floor((xc - rad - R.ox) / cs)), i1 = Math.min(nx - 1, Math.floor((xc + rad - R.ox) / cs));
      var j0 = Math.max(0, Math.floor((yc - rad - R.oy) / cs)), j1 = Math.min(ny - 1, Math.floor((yc + rad - R.oy) / cs));
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
        var L = lab[j * nx + i];
        if (L > 0 && !out[L]) {
          var cx = R.ox + (i + 0.5) * cs, cy = R.oy + (j + 0.5) * cs;
          if (rect) {
            var dx = Math.max(s.x0 - cx, 0, cx - s.x1), dy = Math.max(s.y0 - cy, 0, cy - s.y1);
            if (dx * dx + dy * dy <= rr * rr) out[L] = 1;
          } else if (Math.hypot(cx - xc, cy - yc) <= rad) out[L] = 1;
        }
      }
    }
    if (s.k === 'r') {
      var i0 = Math.max(0, Math.floor((s.x0 - rr - R.ox) / cs)), i1 = Math.min(nx - 1, Math.floor((s.x1 + rr - R.ox) / cs));
      var j0 = Math.max(0, Math.floor((s.y0 - rr - R.oy) / cs)), j1 = Math.min(ny - 1, Math.floor((s.y1 + rr - R.oy) / cs));
      for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
        var L = lab[j * nx + i];
        if (L > 0 && !out[L]) {
          var cx = R.ox + (i + 0.5) * cs, cy = R.oy + (j + 0.5) * cs;
          var dx = Math.max(s.x0 - cx, 0, cx - s.x1), dy = Math.max(s.y0 - cy, 0, cy - s.y1);
          if (dx * dx + dy * dy <= rr * rr) out[L] = 1;
        }
      }
    } else {
      var len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), steps = Math.max(1, Math.ceil(len / (cs * 0.5)));
      for (var k = 0; k <= steps; k++) {
        var t = k / steps;
        scan(s.x1 + (s.x2 - s.x1) * t, s.y1 + (s.y2 - s.y1) * t, s.r + rr, false);
      }
    }
    return Object.keys(out).map(Number);
  }

  function buildRaster(b, A, z) {
    var R = { zone: z, layer: z && z.layer, net: (z && z.net) || '', ok: false, nx: 0, ny: 0, cs: 0.15, ox: 0, oy: 0,
      mask: null, label: null, kept: {}, removed: 0, cells: 0 };
    if (!isObj(z) || !validPoly(z.poly) || A.layers.indexOf(z.layer) < 0) return R;
    var rules = A.rules, layer = z.layer, net = z.net || '';
    var ol = outlineOf(b), obb = polyBBox(ol), pb = polyBBox(z.poly);
    var x0 = Math.max(pb[0], obb[0]), y0 = Math.max(pb[1], obb[1]), x1 = Math.min(pb[2], obb[2]), y1 = Math.min(pb[3], obb[3]);
    if (!(x1 > x0 && y1 > y0)) return R;
    var area = (x1 - x0) * (y1 - y0);
    var cs = num(z.res, 0) > 0 ? Math.max(0.05, z.res) : clamp(Math.round(Math.sqrt(area / 90000) / 0.05) * 0.05, 0.1, 0.25);
    while ((x1 - x0) / cs * (y1 - y0) / cs > 2500000) cs *= 1.25;
    R.cs = cs; R.ox = Math.floor(x0 / cs) * cs; R.oy = Math.floor(y0 / cs) * cs;
    R.nx = Math.ceil((x1 - R.ox) / cs); R.ny = Math.ceil((y1 - R.oy) / cs);
    var n = R.nx * R.ny, i;
    var inside = new Uint8Array(n), outM = new Uint8Array(n), block = new Uint8Array(n), ring = new Uint8Array(n);
    scanPoly(z.poly, R, inside);
    scanPoly(ol, R, outM);
    var clr = Math.max(num(z.clearance, rules.clearance), rules.clearance), grow = clr + cs * 0.5;
    // Rand
    for (i = 0; i < ol.length; i++) {
      var a = ol[i], c = ol[(i + 1) % ol.length];
      markDist(block, R, capShape(a[0], a[1], c[0], c[1], 0), rules.edge + cs * 0.5, 1);
    }
    var thermals = !!z.thermals, tgap = num(z.thermalGap, 0.3), spoke = Math.max(num(z.spoke, 0.3), cs * 1.5);
    var seeds = [];
    A.pads.forEach(function (p) {
      if (p.layers.indexOf(layer) < 0) return;
      var s = padShape(p);
      if (net && p.net === net) {
        seeds.push(s);
        if (thermals) {
          var bb = shapeBBox(s), rad = tgap;
          var i0 = Math.max(0, Math.floor((bb[0] - rad - R.ox) / cs)), i1 = Math.min(R.nx - 1, Math.floor((bb[2] + rad - R.ox) / cs));
          var j0 = Math.max(0, Math.floor((bb[1] - rad - R.oy) / cs)), j1 = Math.min(R.ny - 1, Math.floor((bb[3] + rad - R.oy) / cs));
          for (var j = j0; j <= j1; j++) for (var ii = i0; ii <= i1; ii++) {
            var cx = R.ox + (ii + 0.5) * cs, cy = R.oy + (j + 0.5) * cs;
            var d = shapeDist(s, { k: 'c', x1: cx, y1: cy, x2: cx, y2: cy, r: 0 }).d;
            if (d > 0 && d <= rad) {
              var idx = j * R.nx + ii;
              if (Math.abs(cx - p.x) <= spoke / 2 || Math.abs(cy - p.y) <= spoke / 2) ring[idx] = 2;
              else if (ring[idx] !== 2) ring[idx] = 1;
            }
          }
        }
      } else markDist(block, R, s, grow, 1);
    });
    arr(b.tracks).forEach(function (t) {
      if (!isObj(t) || t.layer !== layer) return;
      var same = net && t.net === net, pts = trackPts(t), w = trackW(b, t);
      for (var k = 0; k < pts.length; k++) {
        var s = pts.length === 1 ? capShape(pts[0][0], pts[0][1], pts[0][0], pts[0][1], w / 2)
          : (k < pts.length - 1 ? capShape(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], w / 2) : null);
        if (!s) continue;
        if (same) seeds.push(s); else markDist(block, R, s, grow, 1);
      }
    });
    arr(b.vias).forEach(function (v) {
      if (!isObj(v) || !isNum(v.x) || !isNum(v.y) || viaSpan(b, v).indexOf(layer) < 0) return;
      var s = capShape(v.x, v.y, v.x, v.y, num(v.dia, rules.viaDia) / 2);
      if (net && v.net === net) seeds.push(s); else markDist(block, R, s, grow, 1);
    });
    arr(b.holes).forEach(function (h) {
      if (isObj(h) && isNum(h.x) && isNum(h.y)) markDist(block, R, capShape(h.x, h.y, h.x, h.y, num(h.d, 3) / 2), grow, 1);
    });
    var fill = new Uint8Array(n);
    for (i = 0; i < n; i++) fill[i] = (inside[i] && outM[i] && !block[i] && ring[i] !== 1) ? 1 : 0;
    // Inseln markieren
    var label = new Int32Array(n), cnt = 0, stack = new Int32Array(n), nx = R.nx, ny = R.ny;
    for (i = 0; i < n; i++) {
      if (fill[i] && !label[i]) {
        cnt++;
        var sp = 0; stack[sp++] = i; label[i] = cnt;
        while (sp > 0) {
          var q = stack[--sp], qx = q % nx, qy = (q / nx) | 0, nb;
          if (qx > 0 && fill[nb = q - 1] && !label[nb]) { label[nb] = cnt; stack[sp++] = nb; }
          if (qx < nx - 1 && fill[nb = q + 1] && !label[nb]) { label[nb] = cnt; stack[sp++] = nb; }
          if (qy > 0 && fill[nb = q - nx] && !label[nb]) { label[nb] = cnt; stack[sp++] = nb; }
          if (qy < ny - 1 && fill[nb = q + nx] && !label[nb]) { label[nb] = cnt; stack[sp++] = nb; }
        }
      }
    }
    R.label = label; R.mask = fill; R.ok = true;
    var kept = {}, any = false;
    seeds.forEach(function (s) { touchLabels(R, s).forEach(function (L) { kept[L] = 1; any = true; }); });
    if (!any) for (var L = 1; L <= cnt; L++) kept[L] = 1;
    R.kept = kept; R.nIsl = cnt;
    var cells = 0;
    for (i = 0; i < n; i++) {
      if (fill[i]) { if (kept[label[i]]) cells++; else { fill[i] = 0; } }
    }
    R.cells = cells; R.removed = cnt - Object.keys(kept).length;
    return R;
  }
  function zoneRaster(b, A, z) {
    var key = zoneKey(z);
    if (!A.fills[key]) A.fills[key] = buildRaster(b, A, z);
    return A.fills[key];
  }
  function rasterPolys(R) {
    var polys = [];
    if (!R || !R.ok) return polys;
    var nx = R.nx, ny = R.ny, cs = R.cs, mask = R.mask, open = [], j, i;
    function emit(o, jEnd) {
      var x0 = R.ox + o[0] * cs, x1 = R.ox + o[1] * cs, y0 = R.oy + o[2] * cs, y1 = R.oy + jEnd * cs;
      polys.push([[r4(x0), r4(y0)], [r4(x1), r4(y0)], [r4(x1), r4(y1)], [r4(x0), r4(y1)]]);
    }
    for (j = 0; j < ny; j++) {
      var runs = [];
      i = 0;
      while (i < nx) {
        if (mask[j * nx + i]) { var s = i; while (i < nx && mask[j * nx + i]) i++; runs.push([s, i]); } else i++;
      }
      var nopen = [], used = {};
      runs.forEach(function (rn) {
        var found = -1;
        for (var k = 0; k < open.length; k++) if (!used[k] && open[k][0] === rn[0] && open[k][1] === rn[1]) { found = k; break; }
        if (found >= 0) { used[found] = 1; nopen.push(open[found]); } else nopen.push([rn[0], rn[1], j]);
      });
      for (var k2 = 0; k2 < open.length; k2++) if (!used[k2]) emit(open[k2], j);
      open = nopen;
    }
    open.forEach(function (o) { emit(o, ny); });
    return polys;
  }
  var zoneFill = guard(function (board, zone) {
    if (!isObj(board)) return [];
    var z = zone;
    if (typeof zone === 'string') z = arr(board.zones).filter(function (q) { return q && q.id === zone; })[0];
    if (!isObj(z)) return [];
    var A = analysis(board);
    return rasterPolys(zoneRaster(board, A, z));
  }, []);
  // Rohdaten der Fuellung (fuer Viewer/Tests): { cs, ox, oy, nx, ny, cells, removedIslands }
  var zoneFillInfo = guard(function (board, zone) {
    var z = typeof zone === 'string' ? arr(board.zones).filter(function (q) { return q && q.id === zone; })[0] : zone;
    var R = zoneRaster(board, analysis(board), z);
    return { ok: R.ok, cs: R.cs, ox: R.ox, oy: R.oy, nx: R.nx, ny: R.ny, cells: R.cells, islands: R.nIsl - R.removed, removedIslands: R.removed,
      areaMm2: r3(R.cells * R.cs * R.cs) };
  }, { ok: false });

  /* ---------- Konnektivitaet ---------- */
  function UF(n) {
    var p = new Int32Array(n), i;
    for (i = 0; i < n; i++) p[i] = i;
    return { p: p, find: function (x) { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; } };
  }

  function buildConn(b, A) {
    var nodes = [], elems = [], layers = A.layers, rules = A.rules, i, j;
    function addNode(type, id, net, at, layer) { nodes.push({ type: type, id: id, net: net, at: at, layer: layer, idx: nodes.length }); return nodes.length - 1; }
    var padNode = [];
    A.pads.forEach(function (p, pi) {
      var ni = addNode('pad', p.id, p.net || '', { x: p.x, y: p.y }, p.layers[0]);
      padNode.push(ni);
      var s = padShape(p);
      p.layers.forEach(function (l) { elems.push({ n: ni, l: l, s: s }); });
    });
    var trackNodes = [];
    arr(b.tracks).forEach(function (t, ti) {
      if (!isObj(t) || layers.indexOf(t.layer) < 0) { trackNodes.push(-1); return; }
      var pts = trackPts(t), w = trackW(b, t);
      if (!pts.length) { trackNodes.push(-1); return; }
      var ni = addNode('track', str(t.id, 't?' + ti), t.net ? String(t.net) : null, { x: pts[0][0], y: pts[0][1] }, t.layer);
      nodes[ni].len = 0;
      trackNodes.push(ni);
      if (pts.length === 1) elems.push({ n: ni, l: t.layer, s: capShape(pts[0][0], pts[0][1], pts[0][0], pts[0][1], w / 2) });
      for (var k = 0; k + 1 < pts.length; k++) {
        elems.push({ n: ni, l: t.layer, s: capShape(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], w / 2) });
        nodes[ni].len += Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]);
      }
    });
    arr(b.vias).forEach(function (v, vi) {
      if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) return;
      var span = viaSpan(b, v);
      var ni = addNode('via', str(v.id, 'v?' + vi), v.net ? String(v.net) : null, { x: v.x, y: v.y }, span[0]);
      var s = capShape(v.x, v.y, v.x, v.y, num(v.dia, rules.viaDia) / 2);
      span.forEach(function (l) { elems.push({ n: ni, l: l, s: s }); });
    });
    // Zonen
    var zoneNodes = [], zoneRasters = [];
    arr(b.zones).forEach(function (z, zi) {
      var R = isObj(z) ? zoneRaster(b, A, z) : null;
      zoneRasters.push(R);
      var map = {};
      if (R && R.ok) {
        Object.keys(R.kept).forEach(function (L) {
          // Ortspunkt: erste Zelle der Insel
          var at = null;
          for (var q = 0; q < R.label.length; q++) if (R.label[q] === Number(L)) { at = { x: R.ox + ((q % R.nx) + 0.5) * R.cs, y: R.oy + (((q / R.nx) | 0) + 0.5) * R.cs }; break; }
          map[L] = addNode('zone', str(z.id, 'z?' + zi), z.net ? String(z.net) : '', at, z.layer);
          nodes[map[L]].zoneIdx = zi;
        });
      }
      zoneNodes.push(map);
    });
    // Kontakte je Lage
    var edges = [], seenPair = {}, N = nodes.length + 1;
    function addEdge(a, c, x, y, l) {
      var k = a < c ? a * N + c : c * N + a;
      if (seenPair[k]) return;
      seenPair[k] = 1;
      edges.push({ a: a, b: c, x: x, y: y, l: l });
    }
    layers.forEach(function (l) {
      var list = [];
      for (i = 0; i < elems.length; i++) if (elems[i].l === l) list.push(i);
      var g = new SGrid(2);
      list.forEach(function (ei) {
        var e = elems[ei], bb = shapeBBox(e.s);
        var cand = g.query(bb);
        for (var q = 0; q < cand.length; q++) {
          var o = elems[cand[q]];
          if (o.n === e.n) continue;
          var d = shapeDist(e.s, o.s);
          if (d.d <= EPS) addEdge(e.n, o.n, d.x, d.y, l);
        }
        g.insert(bb, ei);
      });
      // Zonen-Inseln gegen Elemente
      arr(b.zones).forEach(function (z, zi) {
        var R = zoneRasters[zi];
        if (!R || !R.ok || z.layer !== l) return;
        var znet = z.net ? String(z.net) : '';
        var rb = [R.ox - R.cs, R.oy - R.cs, R.ox + (R.nx + 1) * R.cs, R.oy + (R.ny + 1) * R.cs];
        list.forEach(function (ei) {
          var e = elems[ei], nd = nodes[e.n];
          if (nd.type === 'zone') return;
          var elig = nd.net === null || (nd.net !== '' && znet !== '' && nd.net === znet);
          if (!elig) return;
          var bb = shapeBBox(e.s);
          if (bb[2] < rb[0] || bb[0] > rb[2] || bb[3] < rb[1] || bb[1] > rb[3]) return;
          touchLabels(R, e.s).forEach(function (L) {
            if (zoneNodes[zi][L] != null) addEdge(e.n, zoneNodes[zi][L], (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, l);
          });
        });
      });
    });
    // Zone gegen Zone (gleiche Lage)
    for (i = 0; i < zoneRasters.length; i++) for (j = i + 1; j < zoneRasters.length; j++) {
      var Ra = zoneRasters[i], Rb = zoneRasters[j];
      if (!Ra || !Rb || !Ra.ok || !Rb.ok || Ra.layer !== Rb.layer) continue;
      var xa0 = Math.max(Ra.ox, Rb.ox), xa1 = Math.min(Ra.ox + Ra.nx * Ra.cs, Rb.ox + Rb.nx * Rb.cs);
      var ya0 = Math.max(Ra.oy, Rb.oy), ya1 = Math.min(Ra.oy + Ra.ny * Ra.cs, Rb.oy + Rb.ny * Rb.cs);
      if (xa1 <= xa0 || ya1 <= ya0) continue;
      var hit = {};
      var ci0 = Math.max(0, Math.floor((xa0 - Ra.ox) / Ra.cs)), ci1 = Math.min(Ra.nx - 1, Math.ceil((xa1 - Ra.ox) / Ra.cs));
      var cj0 = Math.max(0, Math.floor((ya0 - Ra.oy) / Ra.cs)), cj1 = Math.min(Ra.ny - 1, Math.ceil((ya1 - Ra.oy) / Ra.cs));
      for (var cj = cj0; cj <= cj1; cj++) for (var ci = ci0; ci <= ci1; ci++) {
        var ia = cj * Ra.nx + ci;
        if (!Ra.mask[ia]) continue;
        var wx = Ra.ox + (ci + 0.5) * Ra.cs, wy = Ra.oy + (cj + 0.5) * Ra.cs;
        var bi = Math.floor((wx - Rb.ox) / Rb.cs), bj = Math.floor((wy - Rb.oy) / Rb.cs);
        if (bi < 0 || bj < 0 || bi >= Rb.nx || bj >= Rb.ny) continue;
        var ib = bj * Rb.nx + bi;
        if (!Rb.mask[ib]) continue;
        var key = Ra.label[ia] + ':' + Rb.label[ib];
        if (!hit[key]) {
          hit[key] = 1;
          var na = zoneNodes[i][Ra.label[ia]], nb2 = zoneNodes[j][Rb.label[ib]];
          if (na != null && nb2 != null) addEdge(na, nb2, wx, wy, Ra.layer);
        }
      }
    }
    // Union-Find
    var ufP = UF(nodes.length), ufN = UF(nodes.length);
    var rnet = new Array(nodes.length);
    for (i = 0; i < nodes.length; i++) rnet[i] = nodes[i].net;
    var shorts = [], shortKey = {};
    edges.forEach(function (e) {
      var ra = ufP.find(e.a), rb2 = ufP.find(e.b);
      if (ra !== rb2) ufP.p[ra] = rb2;
      var na = ufN.find(e.a), nb = ufN.find(e.b);
      if (na === nb) return;
      var x = rnet[na], y = rnet[nb];
      if (x !== null && y !== null && x !== y) {
        var A1 = x < y ? x : y, B1 = x < y ? y : x;
        var k = A1 + '|' + B1 + '|' + e.l + '|' + Math.round(e.x / 1.5) + '|' + Math.round(e.y / 1.5);
        if (shortKey[k]) { shortKey[k].count++; return; }
        var sh = { netA: x, netB: y, at: { x: r3(e.x), y: r3(e.y) }, layer: e.l, items: [nodes[e.a].id, nodes[e.b].id], count: 1 };
        shortKey[k] = sh; shorts.push(sh);
        return;
      }
      ufN.p[na] = nb;
      rnet[nb] = x !== null ? x : y;
    });
    function effNet(ni) { return rnet[ufN.find(ni)]; }
    // Netze
    var nbn = netByName(b), byNet = {};
    A.pads.forEach(function (p, pi) { if (p.net) { (byNet[p.net] = byNet[p.net] || []).push(pi); } });
    var netOut = [], unrouted = [], padIsland = {}, padComp = {}, zoneConnected = {}, itemNet = {};
    var hasZone = {};
    // Zonen-Komponenten
    nodes.forEach(function (nd) { if (nd.type === 'zone') hasZone[ufN.find(nd.idx)] = true; });
    A.pads.forEach(function (p, pi) {
      var ni = padNode[pi];
      if (!(p.id in padComp)) {
        padComp[p.id] = ufP.find(ni);
        if (hasZone[ufN.find(ni)] && p.net) zoneConnected[p.id] = true;
      }
    });
    nodes.forEach(function (nd) { if (nd.type === 'track' || nd.type === 'via') { var en = effNet(nd.idx); if (!(nd.id in itemNet)) itemNet[nd.id] = en; } });
    var lenByNet = {};
    nodes.forEach(function (nd) { if (nd.type === 'track') { var en = effNet(nd.idx); if (en) lenByNet[en] = (lenByNet[en] || 0) + nd.len; } });
    var knownPins = {};
    A.pads.forEach(function (p) { knownPins[p.id] = true; });
    arr(b.nets).forEach(function (net) {
      if (!isObj(net) || typeof net.name !== 'string') return;
      var pl = byNet[net.name] || [];
      var roots = {}, islandPads = [], idxOfRoot = {};
      pl.forEach(function (pi) {
        var r = ufN.find(padNode[pi]);
        if (idxOfRoot[r] == null) { idxOfRoot[r] = islandPads.length; islandPads.push([]); }
        islandPads[idxOfRoot[r]].push(pi);
        if (!(A.pads[pi].id in padIsland)) padIsland[A.pads[pi].id] = { net: net.name, island: idxOfRoot[r] };
      });
      var missing = arr(net.pins).map(String).filter(function (p) { return !knownPins[p]; });
      var ent = { name: net.name, cls: net.cls === 'power' ? 'power' : 'signal', pads: pl.map(function (pi) { return A.pads[pi].id; }),
        islands: islandPads.length, connected: islandPads.length <= 1, length: r3(lenByNet[net.name] || 0), missing: missing };
      if (net.width) ent.width = net.width;
      if (net.current) ent.current = net.current;
      netOut.push(ent);
      if (islandPads.length >= 2) {
        // Prim ueber Inseln
        var m = islandPads.length, inT = new Array(m), best = new Array(m), from = new Array(m), t;
        for (t = 0; t < m; t++) { inT[t] = false; best[t] = Infinity; from[t] = null; }
        function islDist(ia, ib) {
          var bd = Infinity, pa = null, pb = null;
          islandPads[ia].forEach(function (x) { islandPads[ib].forEach(function (y) {
            var d = Math.hypot(A.pads[x].x - A.pads[y].x, A.pads[x].y - A.pads[y].y);
            if (d < bd) { bd = d; pa = x; pb = y; }
          }); });
          return { d: bd, a: pa, b: pb };
        }
        inT[0] = true;
        for (t = 1; t < m; t++) { var q = islDist(0, t); best[t] = q.d; from[t] = q; }
        for (var step = 1; step < m; step++) {
          var bi = -1, bd2 = Infinity;
          for (t = 0; t < m; t++) if (!inT[t] && best[t] < bd2) { bd2 = best[t]; bi = t; }
          if (bi < 0) break;
          inT[bi] = true;
          var f = from[bi], pa2 = A.pads[f.a], pb2 = A.pads[f.b];
          unrouted.push({ net: net.name, a: { x: pa2.x, y: pa2.y, pad: pa2.id }, b: { x: pb2.x, y: pb2.y, pad: pb2.id }, dist: r3(f.d) });
          for (t = 0; t < m; t++) if (!inT[t]) { var q2 = islDist(bi, t); if (q2.d < best[t]) { best[t] = q2.d; from[t] = q2; } }
        }
      }
    });
    // schwebende Elemente (Komponenten ohne Pad)
    var padRoots = {};
    A.pads.forEach(function (p, pi) { padRoots[ufN.find(padNode[pi])] = true; });
    var floating = [];
    nodes.forEach(function (nd) {
      if (nd.type === 'pad') return;
      if (!padRoots[ufN.find(nd.idx)]) floating.push({ type: nd.type, id: nd.id, net: effNet(nd.idx), at: nd.at ? { x: r3(nd.at.x), y: r3(nd.at.y) } : null, layer: nd.layer });
    });
    var conn = { nets: netOut, unrouted: unrouted, shorts: shorts, floating: floating, padIsland: padIsland, padComp: padComp,
      zoneConnected: zoneConnected, itemNet: itemNet };
    Object.defineProperty(conn, '_int', { value: { nodes: nodes, elems: elems, find: ufN.find, rnet: rnet, padNode: padNode, effNet: effNet, zoneRasters: zoneRasters,
      compOf: function (ni) { return ufN.find(ni); } }, enumerable: false });
    return conn;
  }
  function connOf(b, A) {
    if (!A.conn) A.conn = buildConn(b, A);
    return A.conn;
  }
  var connectivity = guard(function (board) {
    if (!isObj(board)) return { nets: [], unrouted: [], shorts: [], floating: [], padIsland: {}, padComp: {}, zoneConnected: {}, itemNet: {} };
    return connOf(board, analysis(board));
  }, function () { return { nets: [], unrouted: [], shorts: [], floating: [], padIsland: {}, padComp: {}, zoneConnected: {}, itemNet: {}, error: true }; });
  // Durchgang zwischen zwei Pads ('R1.1','C1.2') rein physisch (auch ueber Kurzschluesse)
  var continuity = guard(function (conn, padA, padB) {
    if (!conn || !conn.padComp) return false;
    var a = conn.padComp[padA], c = conn.padComp[padB];
    return a != null && c != null && a === c;
  }, false);

  /* ---------- DRC ---------- */
  var drcTypes = ['clearance', 'width', 'drill', 'annular', 'edge', 'short', 'unconnected', 'silk', 'courtyard', 'acid', 'current', 'via', 'planesplit', 'unmask'];
  drcTypes.info = {
    clearance: { title: 'Abstand', severity: 'error', desc: 'Kupfer verschiedener Netze zu nah beieinander' },
    width: { title: 'Leiterbahnbreite', severity: 'error', desc: 'Leiterbahn schmaler als die Mindestbreite' },
    drill: { title: 'Bohrung', severity: 'error', desc: 'Bohrung kleiner als der Mindestdurchmesser' },
    annular: { title: 'Restring', severity: 'error', desc: 'Kupferring um die Bohrung zu schmal' },
    edge: { title: 'Randabstand', severity: 'error', desc: 'Kupfer zu nah am Platinenrand' },
    short: { title: 'Kurzschluss', severity: 'error', desc: 'Zwei verschiedene Netze berühren sich' },
    unconnected: { title: 'Nicht verbunden', severity: 'error', desc: 'Luftlinie (Ratsnest) noch offen' },
    silk: { title: 'Bestückungsdruck', severity: 'warn', desc: 'Silkscreen liegt über einem Pad' },
    courtyard: { title: 'Courtyard', severity: 'error', desc: 'Bauteile überlappen sich' },
    acid: { title: 'Säurefalle', severity: 'warn', desc: 'Spitzer Winkel in der Leiterbahn' },
    current: { title: 'Strombelastbarkeit', severity: 'error', desc: 'Leiterbahn für den Strom zu schmal (IPC-2221)' },
    via: { title: 'Via-Abstand', severity: 'error', desc: 'Via zu nah an Bohrung oder im Pad' },
    planesplit: { title: 'Flächenschnitt', severity: 'warn', desc: 'Leiterbahn zerschneidet eine Kupferfläche' },
    unmask: { title: 'Lötstopp', severity: 'error', desc: 'Pad ohne Lötstopp-Öffnung' }
  };

  function ipcWidth(cur, o) {
    o = o || {};
    cur = num(cur, 0);
    if (!(cur > 0)) return 0;
    var oz = num(o.oz, 1), rise = num(o.rise, 10), ext = o.external !== false;
    if (!(oz > 0) || !(rise > 0)) return 0;
    var k = ext ? 0.048 : 0.024;
    var areaMil2 = Math.pow(cur / (k * Math.pow(rise, 0.44)), 1 / 0.725);
    return areaMil2 / (oz * 1.378) * 0.0254;
  }
  function ipcCurrent(w, o) {
    o = o || {};
    w = num(w, 0);
    if (!(w > 0)) return 0;
    var oz = num(o.oz, 1), rise = num(o.rise, 10), ext = o.external !== false;
    if (!(oz > 0) || !(rise > 0)) return 0;
    var k = ext ? 0.048 : 0.024;
    var areaMil2 = (w / 0.0254) * oz * 1.378;
    return k * Math.pow(rise, 0.44) * Math.pow(areaMil2, 0.725);
  }

  function textBox(t, rules) {
    var size = num(t.size, 1), s = String(t.text == null ? '' : t.text), w = Math.max(1, s.length) * size * 0.75, h = size;
    return { k: 'r', x0: num(t.x, 0) - w / 2, y0: num(t.y, 0) - h / 2, x1: num(t.x, 0) + w / 2, y1: num(t.y, 0) + h / 2 };
  }

  var drc = guard(function (board, opts) {
    var out = [];
    if (!isObj(board)) return out;
    opts = isObj(opts) ? opts : {};
    var b = board;
    var A = analysis(b), conn = connOf(b, A), I = conn._int;
    var rules = Object.assign({}, A.rules);
    if (isObj(opts.rules)) for (var rk in opts.rules) if (isNum(opts.rules[rk])) rules[rk] = opts.rules[rk];
    var want = {};
    drcTypes.forEach(function (t) { want[t] = true; });
    if (Array.isArray(opts.only)) { want = {}; opts.only.forEach(function (t) { want[t] = true; }); }
    if (Array.isArray(opts.ignore)) opts.ignore.forEach(function (t) { want[t] = false; });
    var maxPer = num(opts.max, 300), cnt = {}, seq = 0;
    function emit(type, sev, msg, x, y, layer, items) {
      cnt[type] = (cnt[type] || 0) + 1;
      if (cnt[type] > maxPer) return;
      seq++;
      out.push({ id: 'drc' + seq, type: type, severity: sev, msg: msg, at: { x: r3(num(x, 0)), y: r3(num(y, 0)) }, layer: layer || null, items: items || [] });
    }
    var nets = netByName(b);
    var layers = A.layers, nodes = I.nodes, elems = I.elems, i, j;
    function kindName(nd) { return nd.type === 'pad' ? 'Pad ' + nd.id : (nd.type === 'track' ? 'Bahn ' + nd.id : (nd.type === 'via' ? 'Via ' + nd.id : 'Fläche ' + nd.id)); }
    function netName(nd) { var n = I.effNet(nd.idx); return n ? n : 'kein Netz'; }

    /* clearance */
    if (want.clearance) {
      var reqC = rules.clearance, pairSeen = {}, NN = nodes.length + 1;
      layers.forEach(function (l) {
        var list = [];
        for (i = 0; i < elems.length; i++) if (elems[i].l === l && nodes[elems[i].n].type !== 'zone') list.push(i);
        var g = new SGrid(2.5);
        list.forEach(function (ei) {
          var e = elems[ei], bb = shapeBBox(e.s);
          bb = [bb[0] - reqC / 2, bb[1] - reqC / 2, bb[2] + reqC / 2, bb[3] + reqC / 2];
          var cand = g.query(bb);
          for (var q = 0; q < cand.length; q++) {
            var o = elems[cand[q]];
            if (o.n === e.n) continue;
            var key = e.n < o.n ? e.n * NN + o.n : o.n * NN + e.n;
            if (pairSeen[key]) continue;
            var na = nodes[e.n], nb = nodes[o.n];
            var ea = I.effNet(e.n), eb = I.effNet(o.n);
            if (I.compOf(e.n) === I.compOf(o.n)) continue;
            if (ea && eb && ea === eb) continue;
            var d = shapeDist(e.s, o.s);
            if (d.d > EPS && d.d + 1e-4 < reqC) {
              pairSeen[key] = 1;
              emit('clearance', 'error', 'Abstand zwischen ' + netName(na) + ' (' + kindName(na) + ') und ' + netName(nb) + ' (' + kindName(nb) +
                ') nur ' + fmt(d.d, 3) + ' mm, gefordert ' + fmt(reqC, 3) + ' mm', d.x, d.y, l, [na.id, nb.id]);
            }
          }
          g.insert(bb, ei);
        });
      });
    }
    /* width */
    if (want.width) {
      arr(b.tracks).forEach(function (t, ti) {
        if (!isObj(t)) return;
        var w = num(t.w, 0), pts = trackPts(t);
        if (!pts.length) return;
        if (w + 1e-9 < rules.minWidth) emit('width', 'error', 'Leiterbahn ' + str(t.id, '?') + ' ist nur ' + fmt(w, 3) + ' mm breit, Minimum ' + fmt(rules.minWidth, 3) + ' mm',
          pts[0][0], pts[0][1], t.layer, [t.id]);
      });
    }
    /* drill / annular */
    if (want.drill || want.annular) {
      arr(b.vias).forEach(function (v) {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) return;
        var dia = num(v.dia, rules.viaDia), dr = num(v.drill, rules.viaDrill);
        if (want.drill && dr + 1e-9 < rules.minDrill) emit('drill', 'error', 'Via ' + str(v.id, '?') + ': Bohrung ' + fmt(dr, 3) + ' mm kleiner als Minimum ' + fmt(rules.minDrill, 3) + ' mm', v.x, v.y, null, [v.id]);
        var ring = (dia - dr) / 2;
        if (want.annular && ring + 1e-6 < rules.annular) emit('annular', 'error', 'Via ' + str(v.id, '?') + ': Restring nur ' + fmt(ring, 3) + ' mm, gefordert ' + fmt(rules.annular, 3) + ' mm (Durchmesser ' + fmt(dia, 2) + ', Bohrung ' + fmt(dr, 2) + ')', v.x, v.y, null, [v.id]);
      });
      A.pads.forEach(function (p) {
        if (!(p.drill > 0)) return;
        if (want.drill && p.drill + 1e-9 < rules.minDrill) emit('drill', 'error', 'Pad ' + p.id + ': Bohrung ' + fmt(p.drill, 3) + ' mm kleiner als Minimum ' + fmt(rules.minDrill, 3) + ' mm', p.x, p.y, null, [p.id]);
        var ring = (Math.min(p.w, p.h) - p.drill) / 2;
        if (want.annular && ring + 1e-6 < rules.annular) emit('annular', 'error', 'Pad ' + p.id + ': Restring nur ' + fmt(ring, 3) + ' mm, gefordert ' + fmt(rules.annular, 3) + ' mm', p.x, p.y, null, [p.id]);
      });
      arr(b.holes).forEach(function (h) {
        if (isObj(h) && isNum(h.d) && want.drill && h.d + 1e-9 < rules.minDrill) emit('drill', 'error', 'Bohrung ' + str(h.id, '?') + ' ' + fmt(h.d, 3) + ' mm kleiner als Minimum ' + fmt(rules.minDrill, 3) + ' mm', h.x, h.y, null, [h.id]);
      });
    }
    /* edge */
    if (want.edge) {
      var ol = outlineOf(b), obb = polyBBox(ol), rectOutline = !validPoly(b.outline);
      var segs = ol.map(function (a, k) { var c = ol[(k + 1) % ol.length]; return capShape(a[0], a[1], c[0], c[1], 0); });
      var worst = {};
      elems.forEach(function (e) {
        var nd = nodes[e.n];
        if (nd.type === 'zone') return;
        var bb = shapeBBox(e.s);
        if (rectOutline && bb[0] >= obb[0] + rules.edge && bb[1] >= obb[1] + rules.edge && bb[2] <= obb[2] - rules.edge && bb[3] <= obb[3] - rules.edge) return;
        var cx = e.s.k === 'r' ? (e.s.x0 + e.s.x1) / 2 : e.s.x1, cy = e.s.k === 'r' ? (e.s.y0 + e.s.y1) / 2 : e.s.y1;
        var outside = !pointInPoly(cx, cy, ol);
        var bd = null;
        segs.forEach(function (sg) { var d = shapeDist(e.s, sg); if (!bd || d.d < bd.d) bd = d; });
        if (!bd) return;
        var gap = outside ? -Math.abs(bd.d) : bd.d;
        if (gap + 1e-4 < rules.edge) {
          var w = worst[e.n];
          if (!w || gap < w.gap) worst[e.n] = { gap: gap, x: bd.x, y: bd.y, l: e.l, outside: outside };
        }
      });
      Object.keys(worst).forEach(function (k) {
        var w = worst[k], nd = nodes[k];
        emit('edge', 'error', w.outside ? kindName(nd) + ' (' + netName(nd) + ') ragt über den Platinenrand hinaus'
          : kindName(nd) + ' (' + netName(nd) + ') nur ' + fmt(w.gap, 3) + ' mm vom Platinenrand entfernt, gefordert ' + fmt(rules.edge, 3) + ' mm',
          w.x, w.y, w.l, [nd.id]);
      });
    }
    /* short */
    if (want.short) {
      conn.shorts.forEach(function (s) {
        emit('short', 'error', 'Kurzschluss zwischen ' + (s.netA || 'kein Netz') + ' und ' + (s.netB || 'kein Netz') + ' auf ' + s.layer +
          ' bei (' + fmt(s.at.x, 2) + '; ' + fmt(s.at.y, 2) + ')' + (s.count > 1 ? ' (' + s.count + ' Berührungen)' : ''), s.at.x, s.at.y, s.layer, s.items);
      });
    }
    /* unconnected */
    if (want.unconnected) {
      conn.unrouted.forEach(function (u) {
        emit('unconnected', 'error', 'Netz ' + u.net + ': Luftlinie offen zwischen ' + u.a.pad + ' und ' + u.b.pad + ' (' + fmt(u.dist, 1) + ' mm)',
          (u.a.x + u.b.x) / 2, (u.a.y + u.b.y) / 2, null, [u.a.pad, u.b.pad]);
      });
    }
    /* silk */
    if (want.silk) {
      var pg = new SGrid(4), padShapes = A.pads.map(padShape);
      padShapes.forEach(function (s, k) { pg.insert(shapeBBox(s), k); });
      var sw = rules.silkWidth, silkSeen = {};
      function checkSilk(shape, side, ownPart, label, items) {
        var bb = shapeBBox(shape), cand = pg.query(bb), cu = side === 'bot' ? 'B.Cu' : 'F.Cu';
        for (var q = 0; q < cand.length; q++) {
          var p = A.pads[cand[q]];
          if (p.layers.indexOf(cu) < 0 || (ownPart != null && p.part === ownPart)) continue;
          var key = label + '>' + p.id;
          if (silkSeen[key]) continue;
          var d = shapeDist(shape, padShapes[cand[q]]);
          if (d.d <= EPS) {
            silkSeen[key] = 1;
            emit('silk', 'warn', label + ' liegt über Pad ' + p.id + ' – Lötfläche muss frei von Silkscreen bleiben', d.x, d.y, side === 'bot' ? 'B.Silk' : 'F.Silk', items.concat([p.id]));
          }
        }
      }
      arr(b.parts).forEach(function (part) {
        var pgm = partGeometry(b, part);
        if (!pgm) return;
        var label = 'Silkscreen von ' + str(part.ref, str(part.id, '?'));
        pgm.silk.forEach(function (s) {
          if (s.t === 'line') checkSilk(capShape(s.x1, s.y1, s.x2, s.y2, sw / 2), pgm.side, part.id, label, [part.id]);
          else {
            for (var k = 0; k < 16; k++) {
              var a1 = k / 16 * 2 * Math.PI, a2 = (k + 1) / 16 * 2 * Math.PI;
              checkSilk(capShape(s.x + s.r * Math.cos(a1), s.y + s.r * Math.sin(a1), s.x + s.r * Math.cos(a2), s.y + s.r * Math.sin(a2), sw / 2), pgm.side, part.id, label, [part.id]);
            }
          }
        });
      });
      arr(b.texts).forEach(function (t) {
        if (!isObj(t) || (t.layer !== 'F.Silk' && t.layer !== 'B.Silk')) return;
        checkSilk(textBox(t, rules), t.layer === 'B.Silk' ? 'bot' : 'top', null, 'Silk-Text "' + String(t.text) + '"', [str(t.id, '?')]);
      });
    }
    /* courtyard */
    if (want.courtyard) {
      var cg = new SGrid(5), geoms = [];
      arr(b.parts).forEach(function (part) {
        var pgm = partGeometry(b, part);
        if (!pgm) return;
        var c = pgm.courtyard;
        geoms.push({ part: part, side: pgm.side, c: c });
      });
      geoms.forEach(function (g, k) {
        var cand = cg.query([g.c.x0, g.c.y0, g.c.x1, g.c.y1]);
        cand.forEach(function (q) {
          var o = geoms[q];
          if (o.side !== g.side) return;
          var ox = Math.min(g.c.x1, o.c.x1) - Math.max(g.c.x0, o.c.x0), oy = Math.min(g.c.y1, o.c.y1) - Math.max(g.c.y0, o.c.y0);
          if (ox > 0.01 && oy > 0.01) {
            emit('courtyard', 'error', 'Bauteile ' + str(o.part.ref, str(o.part.id, '?')) + ' und ' + str(g.part.ref, str(g.part.id, '?')) + ' überlappen sich (Courtyard um ' + fmt(ox, 2) + ' x ' + fmt(oy, 2) + ' mm)',
              (Math.max(g.c.x0, o.c.x0) + Math.min(g.c.x1, o.c.x1)) / 2, (Math.max(g.c.y0, o.c.y0) + Math.min(g.c.y1, o.c.y1)) / 2, g.side === 'bot' ? 'B.Cu' : 'F.Cu', [o.part.id, g.part.id]);
          }
        });
        cg.insert([g.c.x0, g.c.y0, g.c.x1, g.c.y1], k);
      });
    }
    /* acid */
    if (want.acid) {
      var joints = {};
      arr(b.tracks).forEach(function (t) {
        if (!isObj(t)) return;
        var pts = trackPts(t);
        for (var k = 0; k < pts.length; k++) {
          var key = t.layer + '|' + Math.round(pts[k][0] / 0.01) + '|' + Math.round(pts[k][1] / 0.01);
          var arrj = joints[key] || (joints[key] = []);
          if (k > 0) arrj.push({ t: t, dx: pts[k - 1][0] - pts[k][0], dy: pts[k - 1][1] - pts[k][1], x: pts[k][0], y: pts[k][1] });
          if (k < pts.length - 1) arrj.push({ t: t, dx: pts[k + 1][0] - pts[k][0], dy: pts[k + 1][1] - pts[k][1], x: pts[k][0], y: pts[k][1] });
        }
      });
      Object.keys(joints).forEach(function (key) {
        var l = joints[key];
        if (l.length !== 2) return;
        var a = l[0], c = l[1], la = Math.hypot(a.dx, a.dy), lc = Math.hypot(c.dx, c.dy);
        if (la < 1e-9 || lc < 1e-9) return;
        var cosv = clamp((a.dx * c.dx + a.dy * c.dy) / (la * lc), -1, 1), ang = Math.acos(cosv) * 180 / Math.PI;
        if (ang < 89.5) {
          emit('acid', 'warn', 'Säurefalle: spitzer Winkel von ' + fmt(ang, 0) + '° an Leiterbahn ' + str(a.t.id, '?') + (c.t !== a.t ? ' / ' + str(c.t.id, '?') : '') +
            ' bei (' + fmt(a.x, 2) + '; ' + fmt(a.y, 2) + ') – Ätzmittel bleibt in der Ecke stehen', a.x, a.y, a.t.layer, c.t !== a.t ? [a.t.id, c.t.id] : [a.t.id]);
        }
      });
    }
    /* current */
    if (want.current) {
      arr(b.tracks).forEach(function (t) {
        if (!isObj(t) || !t.net) return;
        var net = nets[t.net];
        if (!net || !(num(net.current, 0) > 0)) return;
        var pts = trackPts(t);
        if (!pts.length) return;
        var rise = num(net.rise, 10);
        var need = ipcWidth(net.current, { oz: ozOf(b, t.layer), rise: rise, external: isOuter(t.layer) });
        var w = num(t.w, 0);
        if (w + 1e-6 < need) emit('current', 'error', 'Leiterbahn ' + str(t.id, '?') + ' (' + t.net + ') ist mit ' + fmt(w, 2) + ' mm für ' + fmt(net.current, 2) +
          ' A zu schmal – nach IPC-2221 sind bei ' + fmt(rise, 0) + ' K Erwärmung mindestens ' + fmt(need, 2) + ' mm nötig', pts[0][0], pts[0][1], t.layer, [t.id]);
      });
    }
    /* via */
    if (want.via) {
      var holes = [];
      arr(b.vias).forEach(function (v) { if (isObj(v) && isNum(v.x) && isNum(v.y)) holes.push({ x: v.x, y: v.y, r: num(v.drill, rules.viaDrill) / 2, via: v, id: str(v.id, '?') }); });
      A.pads.forEach(function (p) { if (p.drill > 0) holes.push({ x: p.x, y: p.y, r: p.drill / 2, pad: p, id: p.id }); });
      arr(b.holes).forEach(function (h) { if (isObj(h) && isNum(h.x) && isNum(h.y)) holes.push({ x: h.x, y: h.y, r: num(h.d, 3) / 2, id: str(h.id, '?') }); });
      var hg = new SGrid(3), hgap = rules.holeGap;
      holes.forEach(function (h, k) {
        var cand = hg.query([h.x - h.r - hgap, h.y - h.r - hgap, h.x + h.r + hgap, h.y + h.r + hgap]);
        cand.forEach(function (q) {
          var o = holes[q];
          if (!h.via && !o.via) return;
          var gap = Math.hypot(h.x - o.x, h.y - o.y) - h.r - o.r;
          if (gap + 1e-4 < hgap) emit('via', 'error', (h.via ? 'Via ' : 'Bohrung ') + h.id + ' ist nur ' + fmt(gap, 3) + ' mm von ' + (o.via ? 'Via ' : 'Bohrung ') + o.id + ' entfernt (Bohrloch zu Bohrloch), gefordert ' + fmt(hgap, 2) + ' mm',
            (h.x + o.x) / 2, (h.y + o.y) / 2, null, [h.id, o.id]);
        });
        hg.insert([h.x - h.r - hgap, h.y - h.r - hgap, h.x + h.r + hgap, h.y + h.r + hgap], k);
      });
      // Via im SMD-Pad
      arr(b.vias).forEach(function (v) {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) return;
        var vs = capShape(v.x, v.y, v.x, v.y, num(v.dia, rules.viaDia) / 2), span = viaSpan(b, v);
        A.pads.forEach(function (p) {
          if (p.kind !== 'smd' || span.indexOf(p.layers[0]) < 0) return;
          if (Math.abs(p.x - v.x) > 5 || Math.abs(p.y - v.y) > 5) return;
          var d = shapeDist(vs, padShape(p));
          if (d.d <= EPS) emit('via', 'warn', 'Via ' + str(v.id, '?') + ' liegt im SMD-Pad ' + p.id + ' – Lot kann in die Bohrung laufen', v.x, v.y, p.layers[0], [str(v.id, '?'), p.id]);
        });
      });
    }
    /* planesplit */
    if (want.planesplit) {
      arr(b.zones).forEach(function (z) {
        if (!isObj(z) || !validPoly(z.poly)) return;
        arr(b.tracks).forEach(function (t) {
          if (!isObj(t) || t.layer !== z.layer || (t.net && t.net === z.net)) return;
          var pts = trackPts(t);
          if (pts.length < 2) return;
          var states = [], firstIn = null;
          for (var k = 0; k + 1 < pts.length; k++) {
            var len = Math.hypot(pts[k + 1][0] - pts[k][0], pts[k + 1][1] - pts[k][1]), n = Math.max(1, Math.ceil(len / 0.25));
            for (var q = (k === 0 ? 0 : 1); q <= n; q++) {
              var x = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * q / n, y = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * q / n;
              var ins = pointInPoly(x, y, z.poly);
              states.push(ins);
              if (ins && !firstIn) firstIn = [x, y];
            }
          }
          var trans = 0;
          for (k = 1; k < states.length; k++) if (states[k] !== states[k - 1]) trans++;
          if (trans >= 2 && !states[0] && !states[states.length - 1]) {
            emit('planesplit', 'warn', 'Leiterbahn ' + str(t.id, '?') + (t.net ? ' (' + t.net + ')' : '') + ' zerschneidet die ' + (z.net || 'kein Netz') + '-Fläche auf ' + z.layer + ' – Rückstrom muss einen Umweg nehmen',
              firstIn[0], firstIn[1], z.layer, [str(t.id, '?'), str(z.id, '?')]);
          }
        });
      });
    }
    /* unmask */
    if (want.unmask) {
      var nmList = arr(b.noMask).map(String);
      A.pads.forEach(function (p) {
        var part = arr(b.parts).filter(function (q) { return q && q.id === p.part; })[0] || {};
        var off = part.noMask === true || (Array.isArray(part.noMask) && part.noMask.map(String).indexOf(p.n) >= 0) || nmList.indexOf(p.id) >= 0;
        if (off) emit('unmask', 'error', 'Pad ' + p.id + ' hat keine Lötstopp-Öffnung – er kann nicht gelötet werden', p.x, p.y, p.layers[0], [p.id]);
      });
    }
    // Sortierung: nach Typreihenfolge (stabil), ids neu vergeben
    var order = {};
    drcTypes.forEach(function (t, k) { order[t] = k; });
    out.sort(function (a, c) { return order[a.type] - order[c.type]; });
    out.forEach(function (o, k) { o.id = 'drc' + (k + 1); });
    return out;
  }, []);

  /* ---------- Rechner ---------- */
  var traceResistance = guard(function (lenMm, wMm, oz) {
    lenMm = num(lenMm, 0); wMm = num(wMm, 0); oz = num(oz, 1);
    if (!(lenMm >= 0) || !(wMm > 0) || !(oz > 0)) return 0;
    return 1.72e-8 * (lenMm / 1000) / ((wMm / 1000) * (oz * 35e-6));
  }, 0);
  // IPC-2141: Z0 = 87/sqrt(er+1,41) * ln(5,98 h / (0,8 w + t))
  var microstrip = guard(function (w, h, er, t) {
    w = num(w, 0); h = num(h, 0); er = num(er, 4.3); t = num(t, 0.035);
    if (!(w > 0) || !(h > 0) || !(er >= 1) || !(t >= 0)) return 0;
    var arg = 5.98 * h / (0.8 * w + t);
    if (!(arg > 1)) return 0;
    return 87 / Math.sqrt(er + 1.41) * Math.log(arg);
  }, 0);
  // IPC-2141: Z0 = 60/sqrt(er) * ln(4 b / (0,67 pi (0,8 w + t))), b = Abstand der Bezugsebenen
  var stripline = guard(function (w, b, er, t) {
    w = num(w, 0); b = num(b, 0); er = num(er, 4.3); t = num(t, 0.035);
    if (!(w > 0) || !(b > 0) || !(er >= 1) || !(t >= 0)) return 0;
    var arg = 4 * b / (0.67 * Math.PI * (0.8 * w + t));
    if (!(arg > 1)) return 0;
    return 60 / Math.sqrt(er) * Math.log(arg);
  }, 0);
  // Leiterbahnbreite fuer Wunschimpedanz (Mikrostreifen oder Stripline) per Bisektion
  var widthForImpedance = guard(function (z0, hMm, er, tMm, type) {
    z0 = num(z0, 50); hMm = num(hMm, 0.2); er = num(er, 4.3); tMm = num(tMm, 0.035);
    var f = type === 'stripline' ? function (w) { return stripline(w, hMm, er, tMm); } : function (w) { return microstrip(w, hMm, er, tMm); };
    var lo = 0.02, hi = 10 * Math.max(hMm, 0.1), k;
    if (!(f(lo) > z0) || !(f(hi) < z0)) return 0;
    for (k = 0; k < 60; k++) { var mid = (lo + hi) / 2; if (f(mid) > z0) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }, 0);

  /* ---------- Strichschrift (Silkscreen) ---------- */
  var FONT_SRC = {
    '0': '0,0 2,0 2,4 0,4 0,0', '1': '1,0 1,4|0,1 1,0', '2': '0,0 2,0 2,2 0,2 0,4 2,4', '3': '0,0 2,0 2,4 0,4|0,2 2,2',
    '4': '0,0 0,2 2,2|2,0 2,4', '5': '2,0 0,0 0,2 2,2 2,4 0,4', '6': '2,0 0,0 0,4 2,4 2,2 0,2', '7': '0,0 2,0 1,4',
    '8': '0,0 2,0 2,4 0,4 0,0|0,2 2,2', '9': '2,2 0,2 0,0 2,0 2,4 0,4',
    'A': '0,4 0,0 2,0 2,4|0,2 2,2', 'B': '0,0 0,4 2,4 2,2 0,2|0,0 2,0 2,2', 'C': '2,0 0,0 0,4 2,4', 'D': '0,0 0,4 1,4 2,3 2,1 1,0 0,0',
    'E': '2,0 0,0 0,4 2,4|0,2 1,2', 'F': '2,0 0,0 0,4|0,2 1,2', 'G': '2,0 0,0 0,4 2,4 2,2 1,2', 'H': '0,0 0,4|2,0 2,4|0,2 2,2',
    'I': '0,0 2,0|1,0 1,4|0,4 2,4', 'J': '2,0 2,4 0,4 0,3', 'K': '0,0 0,4|2,0 0,2 2,4', 'L': '0,0 0,4 2,4', 'M': '0,4 0,0 1,2 2,0 2,4',
    'N': '0,4 0,0 2,4 2,0', 'O': '0,0 2,0 2,4 0,4 0,0', 'P': '0,4 0,0 2,0 2,2 0,2', 'Q': '0,0 2,0 2,4 0,4 0,0|1,3 2,4',
    'R': '0,4 0,0 2,0 2,2 0,2|1,2 2,4', 'S': '2,0 0,0 0,2 2,2 2,4 0,4', 'T': '0,0 2,0|1,0 1,4', 'U': '0,0 0,4 2,4 2,0', 'V': '0,0 1,4 2,0',
    'W': '0,0 0,4 1,2 2,4 2,0', 'X': '0,0 2,4|2,0 0,4', 'Y': '0,0 1,2 2,0|1,2 1,4', 'Z': '0,0 2,0 0,4 2,4',
    '-': '0,2 2,2', '+': '0,2 2,2|1,1 1,3', '.': '1,3.6 1,4', ',': '1,3 0.5,4', '/': '2,0 0,4', '_': '0,4 2,4', ':': '1,1 1,1.3|1,2.7 1,3',
    '=': '0,1.5 2,1.5|0,2.5 2,2.5', '(': '2,0 1,1 1,3 2,4', ')': '0,0 1,1 1,3 0,4', '*': '0,1 2,3|2,1 0,3|1,0.5 1,3.5', ' ': '', '?': '0,0 2,0 2,2 1,2 1,3|1,3.6 1,4'
  };
  var FONT = {};
  Object.keys(FONT_SRC).forEach(function (k) {
    FONT[k] = FONT_SRC[k] === '' ? [] : FONT_SRC[k].split('|').map(function (pl) {
      return pl.split(' ').map(function (p) { var q = p.split(','); return [Number(q[0]), Number(q[1])]; });
    });
  });
  // Text als Polylinien: Mitte bei (x,y); size = Zeichenhoehe in mm; o.rot (Grad, gegen UZS), o.mirror (an senkrechter Achse)
  var textStrokes = guard(function (text, x, y, size, o) {
    o = o || {};
    size = num(size, 1); x = num(x, 0); y = num(y, 0);
    var s = size / 4, t = String(text == null ? '' : text).toUpperCase().replace(/[µμ]/g, 'U').replace(/Ω/g, 'R');
    var adv = 3 * s, w = Math.max(0, t.length * adv - s), out = [];
    var cs = rotCS(num(o.rot, 0)), i;
    for (i = 0; i < t.length; i++) {
      var g = FONT[t[i]] || FONT['?'];
      g.forEach(function (pl) {
        out.push(pl.map(function (p) {
          var u = p[0] * s + i * adv - w / 2, v = p[1] * s - size / 2;
          if (o.mirror) u = -u;
          return [r4(x + u * cs[0] + v * cs[1]), r4(y - u * cs[1] + v * cs[0])];
        }));
      });
    }
    return out;
  }, []);

  /* ---------- Gerber ---------- */
  function GW(H) {
    this.H = H; this.aps = []; this.apMap = {}; this.body = []; this.next = 10; this.cur = null; this.pol = 'D';
  }
  GW.prototype.ap = function (t, w, h) {
    var key = t + ':' + w + ':' + h;
    if (this.apMap[key] == null) { this.apMap[key] = this.next++; this.aps.push({ code: this.apMap[key], type: t, w: w, h: t === 'C' ? w : h }); }
    return this.apMap[key];
  };
  GW.prototype.sel = function (c) { if (this.cur !== c) { this.body.push('D' + c + '*'); this.cur = c; } };
  GW.prototype.pos = function (x, y) { return 'X' + Math.round(x * 1e6) + 'Y' + Math.round((this.H - y) * 1e6); };
  GW.prototype.flash = function (c, x, y) { this.sel(c); this.body.push(this.pos(x, y) + 'D03*'); };
  GW.prototype.draw = function (c, pts) {
    if (pts.length < 1) return;
    this.sel(c);
    this.body.push(this.pos(pts[0][0], pts[0][1]) + 'D02*');
    if (pts.length === 1) this.body.push(this.pos(pts[0][0], pts[0][1]) + 'D01*');
    for (var i = 1; i < pts.length; i++) this.body.push(this.pos(pts[i][0], pts[i][1]) + 'D01*');
  };
  GW.prototype.region = function (pts) {
    if (pts.length < 3) return;
    this.body.push('G36*');
    this.body.push(this.pos(pts[0][0], pts[0][1]) + 'D02*');
    for (var i = 1; i < pts.length; i++) this.body.push(this.pos(pts[i][0], pts[i][1]) + 'D01*');
    this.body.push(this.pos(pts[0][0], pts[0][1]) + 'D01*');
    this.body.push('G37*');
  };
  GW.prototype.polarity = function (p) { if (this.pol !== p) { this.body.push('%LP' + p + '*%'); this.pol = p; } };
  GW.prototype.padAp = function (w, h, shape) {
    if (shape === 'rect') return this.ap('R', r4(w), r4(h));
    if (Math.abs(w - h) < 1e-9) return this.ap('C', r4(w));
    return this.ap('O', r4(w), r4(h));
  };
  GW.prototype.text = function (attrs, name) {
    var out = ['G04 Tonfunk PCB-Lab, RS-274X (' + name + ')*', '%TF.GenerationSoftware,Tonfunk,PCBLab,1.0*%'];
    attrs.forEach(function (a) { out.push('%' + a + '*%'); });
    out.push('%FSLAX46Y46*%', '%MOMM*%');
    this.aps.forEach(function (a) {
      var f = function (v) { return v.toFixed(6); };
      out.push('%ADD' + a.code + a.type + ',' + (a.type === 'C' ? f(a.w) : f(a.w) + 'X' + f(a.h)) + '*%');
    });
    out.push('%LPD*%', 'G01*');
    var res = out.concat(this.body);
    res.push('M02*');
    return res.join('\n') + '\n';
  };

  function partSilk(b, part) {
    var pg = partGeometry(b, part);
    return pg;
  }
  function refTextPos(pg) {
    var c = pg.courtyard;
    return { x: (c.x0 + c.x1) / 2, y: c.y0 - 0.8 };
  }

  var CU_EXT = { 'F.Cu': 'gtl', 'In1.Cu': 'g2', 'In2.Cu': 'g3', 'In3.Cu': 'g4', 'In4.Cu': 'g5', 'B.Cu': 'gbl' };
  var gerber = guard(function (board, opts) {
    var res = { files: {}, apertures: {}, info: null, list: [] };
    if (!isObj(board)) return res;
    opts = opts || {};
    var b = board, A = analysis(b), rules = A.rules, ol = outlineOf(b), obb = polyBBox(ol);
    var H = obb[3] > 0 ? Math.max(obb[3], num(b.h, obb[3])) : num(b.h, 40);
    var name = String(opts.name || b.name || 'board').replace(/[^A-Za-z0-9_\-]/g, '_') || 'board';
    var layers = A.layers, conn = connOf(b, A), parts = arr(b.parts).filter(function (p) { return isObj(p) && footprint(p.fp); });
    var nmList = arr(b.noMask).map(String);
    function maskOff(p) {
      var part = null;
      for (var i = 0; i < parts.length; i++) if (parts[i].id === p.part) { part = parts[i]; break; }
      return (part && (part.noMask === true || (Array.isArray(part.noMask) && part.noMask.map(String).indexOf(p.n) >= 0))) || nmList.indexOf(p.id) >= 0;
    }
    function fileName(tag, ext) { return name + '-' + tag + '.' + ext; }
    function put(fn, gw, attrs, layer, kind, desc) {
      res.files[fn] = gw.text(attrs, fn);
      res.apertures[fn] = gw.aps.map(function (a) { return { code: a.code, type: a.type, w: a.w, h: a.h }; });
      res.list.push({ file: fn, layer: layer, kind: kind, ext: fn.split('.').pop(), desc: desc });
    }
    var cuIdx = 0;
    layers.forEach(function (l) {
      cuIdx++;
      var gw = new GW(H);
      A.pads.forEach(function (p) {
        if (p.layers.indexOf(l) >= 0) gw.flash(gw.padAp(p.w, p.h, p.shape), p.x, p.y);
      });
      arr(b.tracks).forEach(function (t) {
        if (!isObj(t) || t.layer !== l) return;
        var pts = trackPts(t);
        if (!pts.length) return;
        gw.draw(gw.ap('C', r4(trackW(b, t))), pts);
      });
      arr(b.vias).forEach(function (v) {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y) || viaSpan(b, v).indexOf(l) < 0) return;
        gw.flash(gw.ap('C', r4(num(v.dia, rules.viaDia))), v.x, v.y);
      });
      arr(b.zones).forEach(function (z, zi) {
        if (!isObj(z) || z.layer !== l) return;
        var R = conn._int.zoneRasters[zi];
        rasterPolys(R).forEach(function (poly) { gw.region(poly); });
      });
      var pos = l === 'F.Cu' ? 'Top' : (l === 'B.Cu' ? 'Bot' : 'Inr');
      var lnum = layers.length === 1 ? 1 : (l === 'B.Cu' ? layers.length : layers.indexOf(l) + 1);
      put(fileName(l.replace('.', '_'), CU_EXT[l]), gw, ['TF.FileFunction,Copper,L' + lnum + ',' + pos, 'TF.FilePolarity,Positive'], l, 'copper',
        l === 'F.Cu' ? 'Kupfer Oberseite (Leiterbahnen, Pads, Flächen)' : (l === 'B.Cu' ? 'Kupfer Unterseite' : 'Kupfer Innenlage ' + l.replace('.Cu', '')));
    });
    ['F', 'B'].forEach(function (sd) {
      var cu = sd + '.Cu', gw = new GW(H), m = rules.maskExpansion;
      gw.polarity('D');
      A.pads.forEach(function (p) {
        if (p.layers.indexOf(cu) < 0 || maskOff(p)) return;
        gw.flash(gw.padAp(r4(p.w + 2 * m), r4(p.h + 2 * m), p.shape), p.x, p.y);
      });
      arr(b.vias).forEach(function (v) {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y) || v.tented !== false || viaSpan(b, v).indexOf(cu) < 0) return;
        gw.flash(gw.ap('C', r4(num(v.dia, rules.viaDia) + 2 * m)), v.x, v.y);
      });
      put(fileName(sd + '_Mask', sd === 'F' ? 'gts' : 'gbs'), gw, ['TF.FileFunction,Soldermask,' + (sd === 'F' ? 'Top' : 'Bot'), 'TF.FilePolarity,Negative'], sd + '.Mask', 'mask',
        'Lötstopplack ' + (sd === 'F' ? 'oben' : 'unten') + ' (dunkel = Öffnung im Lack, hier wird gelötet)');
    });
    ['F', 'B'].forEach(function (sd) {
      var cu = sd + '.Cu', gw = new GW(H);
      A.pads.forEach(function (p) {
        if (p.kind !== 'smd' || p.layers[0] !== cu) return;
        var w = p.w - 0.1, h = p.h - 0.1;
        if (w < 0.1 || h < 0.1) return;
        gw.flash(gw.padAp(r4(w), r4(h), p.shape === 'rect' ? 'rect' : 'oval'), p.x, p.y);
      });
      put(fileName(sd + '_Paste', sd === 'F' ? 'gtp' : 'gbp'), gw, ['TF.FileFunction,Paste,' + (sd === 'F' ? 'Top' : 'Bot'), 'TF.FilePolarity,Positive'], sd + '.Paste', 'paste',
        'Lotpastenschablone ' + (sd === 'F' ? 'oben' : 'unten') + ' (Öffnungen für den Pastendruck der SMD-Pads)');
    });
    ['F', 'B'].forEach(function (sd) {
      var gw = new GW(H), sl = sd + '.Silk', ap = gw.ap('C', r4(rules.silkWidth)), side = sd === 'F' ? 'top' : 'bot';
      parts.forEach(function (part) {
        var pg = partSilk(b, part);
        if (!pg || pg.side !== side) return;
        pg.silk.forEach(function (s) {
          if (s.t === 'line') gw.draw(ap, [[s.x1, s.y1], [s.x2, s.y2]]);
          else {
            var pts = [];
            for (var k = 0; k <= 24; k++) { var a = k / 24 * 2 * Math.PI; pts.push([s.x + s.r * Math.cos(a), s.y + s.r * Math.sin(a)]); }
            gw.draw(ap, pts);
          }
        });
        if (!part.hideRef) {
          var tp2 = refTextPos(pg);
          textStrokes(str(part.ref, str(part.id, '?')), tp2.x, tp2.y, 0.9, { mirror: side === 'bot' }).forEach(function (pl) { gw.draw(ap, pl); });
        }
      });
      arr(b.texts).forEach(function (t) {
        if (!isObj(t) || t.layer !== sl) return;
        textStrokes(t.text, num(t.x, 0), num(t.y, 0), num(t.size, 1), { rot: num(t.rot, 0), mirror: sd === 'B' }).forEach(function (pl) { gw.draw(ap, pl); });
      });
      put(fileName(sd + '_Silk', sd === 'F' ? 'gto' : 'gbo'), gw, ['TF.FileFunction,Legend,' + (sd === 'F' ? 'Top' : 'Bot'), 'TF.FilePolarity,Positive'], sd + '.Silk', 'silk',
        'Bestückungsdruck ' + (sd === 'F' ? 'oben' : 'unten') + ' (Umrisse, Referenzen, Texte)');
    });
    (function () {
      var gw = new GW(H), ap = gw.ap('C', 0.1);
      var pts = ol.slice(); pts.push(ol[0]);
      gw.draw(ap, pts);
      put(fileName('Edge', 'gm1'), gw, ['TF.FileFunction,Profile,NP', 'TF.FilePolarity,Positive'], 'Edge', 'edge', 'Platinenumriss (Fräskontur)');
    })();
    // Bohrdateien
    var pth = [], npth = [];
    arr(b.vias).forEach(function (v) { if (isObj(v) && isNum(v.x) && isNum(v.y)) pth.push({ x: v.x, y: v.y, d: num(v.drill, rules.viaDrill) }); });
    A.pads.forEach(function (p) { if (p.drill > 0) pth.push({ x: p.x, y: p.y, d: p.drill }); });
    arr(b.holes).forEach(function (h) { if (isObj(h) && isNum(h.x) && isNum(h.y)) npth.push({ x: h.x, y: h.y, d: num(h.d, 3) }); });
    function excellon(list, plated) {
      var tools = {}, ds = [];
      list.forEach(function (h) { var k = r3(h.d).toFixed(3); if (!tools[k]) { tools[k] = []; ds.push(k); } tools[k].push(h); });
      ds.sort(function (a, c) { return Number(a) - Number(c); });
      var o = ['M48', '; Tonfunk PCB-Lab Excellon (' + (plated ? 'PTH, durchkontaktiert' : 'NPTH, nicht durchkontaktiert') + ')',
        '; FORMAT={-:-/ absolute / metric / decimal}', 'FMAT,2', 'METRIC,TZ'];
      ds.forEach(function (k, i) { o.push('T' + (i + 1) + 'C' + k); });
      o.push('%', 'G90', 'G05');
      ds.forEach(function (k, i) {
        o.push('T' + (i + 1));
        tools[k].forEach(function (h) { o.push('X' + (Math.round(h.x * 10000) / 10000).toFixed(4) + 'Y' + (Math.round((H - h.y) * 10000) / 10000).toFixed(4)); });
      });
      o.push('T0', 'M30');
      return o.join('\n') + '\n';
    }
    res.files[fileName('PTH', 'drl')] = excellon(pth, true);
    res.list.push({ file: fileName('PTH', 'drl'), layer: 'PTH', kind: 'drill', ext: 'drl', desc: 'Bohrdaten durchkontaktiert (Vias und Bauteilbohrungen, Excellon)' });
    res.files[fileName('NPTH', 'drl')] = excellon(npth, false);
    res.list.push({ file: fileName('NPTH', 'drl'), layer: 'NPTH', kind: 'drill', ext: 'drl', desc: 'Bohrdaten nicht durchkontaktiert (Befestigungslöcher, Excellon)' });
    res.info = { name: name, w: obb[2] - obb[0], h: H, units: 'mm', format: '4.6', yUp: true, layers: layers.length };
    return res;
  }, function () { return { files: {}, apertures: {}, info: null, list: [], error: true }; });

  function bboxAdd(bb, x, y) {
    if (!bb) return { x0: x, y0: y, x1: x, y1: y };
    if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y;
    return bb;
  }
  var parseGerber = guard(function (text, opts) {
    opts = opts || {};
    var res = { units: 'mm', apertures: {}, ops: [], bbox: null, errors: [], attrs: [], format: { xi: 4, xd: 6, yi: 4, yd: 6 } };
    text = String(text == null ? '' : text);
    var pos = 0, n = text.length, cx = 0, cy = 0, cur = null, pol = 'dark', region = false, contour = null, scale = 1, xd = 6, yd = 6, unitMul = 1;
    function emitRegion() {
      if (contour && contour.length >= 3) res.ops.push({ t: 'region', pts: contour.slice(), polarity: pol });
      contour = null;
    }
    function ext(cmd) {
      var m;
      if ((m = /^FS([LT])([AI])X(\d)(\d)Y(\d)(\d)/.exec(cmd))) { res.format = { xi: +m[3], xd: +m[4], yi: +m[5], yd: +m[6] }; xd = +m[4]; yd = +m[6]; }
      else if (cmd.indexOf('MOIN') === 0) { res.srcUnits = 'in'; unitMul = 25.4; }
      else if (cmd.indexOf('MOMM') === 0) { res.srcUnits = 'mm'; unitMul = 1; }
      else if ((m = /^ADD(\d+)([A-Za-z_][\w.]*),?(.*)$/.exec(cmd))) {
        var code = Number(m[1]), type = m[2], pr = m[3] === '' ? [] : m[3].split('X').map(Number);
        var ap = { type: type, params: pr };
        if (type === 'C') { ap.w = ap.h = pr[0] * unitMul; ap.d = ap.w; }
        else if (type === 'R' || type === 'O') { ap.w = pr[0] * unitMul; ap.h = (pr.length > 1 ? pr[1] : pr[0]) * unitMul; }
        else if (type === 'P') { ap.w = ap.h = pr[0] * unitMul; }
        else { ap.w = ap.h = 0; }
        res.apertures[code] = ap;
      } else if (cmd.indexOf('LPD') === 0) { pol = 'dark'; }
      else if (cmd.indexOf('LPC') === 0) { pol = 'clear'; }
      else if (cmd.indexOf('TF') === 0 || cmd.indexOf('TA') === 0 || cmd.indexOf('TO') === 0) res.attrs.push(cmd);
    }
    function block(cmd) {
      cmd = cmd.replace(/[\r\n\s]+/g, '');
      if (cmd === '') return;
      if (cmd.indexOf('G04') === 0) return;
      var m, nx = null, ny = null, d = null, g = [];
      var re = /([GDMXYIJ])(-?\d+)/g;
      while ((m = re.exec(cmd))) {
        if (m[1] === 'G') g.push(Number(m[2]));
        else if (m[1] === 'X') nx = Number(m[2]) / Math.pow(10, xd) * unitMul;
        else if (m[1] === 'Y') ny = Number(m[2]) / Math.pow(10, yd) * unitMul;
        else if (m[1] === 'D') d = Number(m[2]);
        else if (m[1] === 'M') { if (Number(m[2]) === 2 || Number(m[2]) === 0) pos = n; }
      }
      g.forEach(function (gc) {
        if (gc === 36) { region = true; contour = []; }
        else if (gc === 37) { emitRegion(); region = false; }
      });
      if (d != null && d >= 10) {
        if (!res.apertures[d]) res.errors.push('Unbekannte Blende D' + d);
        cur = d;
        if (nx == null && ny == null) return;
      }
      if (nx == null && ny == null && d == null) return;
      var x = nx != null ? nx : cx, y = ny != null ? ny : cy;
      if (d === 1 || (d == null && (nx != null || ny != null))) {
        if (region) { if (!contour) contour = []; if (!contour.length) contour.push([cx, cy]); contour.push([x, y]); }
        else if (cur != null) res.ops.push({ t: 'draw', ap: cur, x: cx, y: cy, x2: x, y2: y, polarity: pol });
        else res.errors.push('Zeichnen ohne gewählte Blende');
      } else if (d === 2) {
        if (region) { emitRegion(); contour = [[x, y]]; }
      } else if (d === 3) {
        if (cur != null) res.ops.push({ t: 'flash', ap: cur, x: x, y: y, polarity: pol });
        else res.errors.push('Flash ohne gewählte Blende');
      }
      cx = x; cy = y;
    }
    while (pos < n) {
      var c = text[pos];
      if (c === '%') {
        var end = text.indexOf('%', pos + 1);
        if (end < 0) { res.errors.push('Unvollständiger Erweiterungsblock'); break; }
        text.slice(pos + 1, end).split('*').forEach(function (cm) { cm = cm.replace(/[\r\n]/g, ''); if (cm !== '') ext(cm); });
        pos = end + 1;
      } else if (c === '\n' || c === '\r' || c === ' ' || c === '\t') pos++;
      else {
        var e2 = text.indexOf('*', pos);
        if (e2 < 0) { res.errors.push('Block ohne Stern am Ende'); break; }
        var bl = text.slice(pos, e2);
        pos = e2 + 1;
        block(bl);
      }
    }
    emitRegion();
    // Umrechnung / Bounding Box
    var H = num(opts.boardH, null), bb = null;
    res.ops.forEach(function (op) {
      var ap = op.ap != null ? res.apertures[op.ap] : null, hw = ap ? ap.w / 2 : 0, hh = ap ? ap.h / 2 : 0;
      if (H != null) {
        if (op.t === 'region') op.pts = op.pts.map(function (p) { return [p[0], H - p[1]]; });
        else { op.y = H - op.y; if (op.y2 != null) op.y2 = H - op.y2; }
      }
      if (op.t === 'flash') { bb = bboxAdd(bb, op.x - hw, op.y - hh); bb = bboxAdd(bb, op.x + hw, op.y + hh); }
      else if (op.t === 'draw') { [[op.x, op.y], [op.x2, op.y2]].forEach(function (p) { bb = bboxAdd(bb, p[0] - hw, p[1] - hh); bb = bboxAdd(bb, p[0] + hw, p[1] + hh); }); }
      else op.pts.forEach(function (p) { bb = bboxAdd(bb, p[0], p[1]); });
    });
    res.bbox = bb;
    return res;
  }, function (e) { return { units: 'mm', apertures: {}, ops: [], bbox: null, errors: ['Interner Fehler: ' + (e && e.message)], attrs: [] }; });

  var parseDrill = guard(function (text, opts) {
    opts = opts || {};
    var out = [], tools = {}, cur = null, inHeader = false, mul = 1, H = num(opts.boardH, null);
    String(text == null ? '' : text).split(/\r?\n/).forEach(function (ln) {
      ln = ln.trim();
      if (ln === '' || ln[0] === ';') return;
      var m;
      if (ln === 'M48') { inHeader = true; return; }
      if (ln === '%' || ln === 'M95') { inHeader = false; return; }
      if (/^INCH/.test(ln)) { mul = 25.4; return; }
      if (/^METRIC/.test(ln)) { mul = 1; return; }
      if ((m = /^T(\d+)C([\d.]+)/.exec(ln))) { tools[m[1]] = Number(m[2]) * mul; return; }
      if ((m = /^T(\d+)$/.exec(ln))) { cur = Number(m[1]) === 0 ? null : tools[String(Number(m[1]))] != null ? tools[String(Number(m[1]))] : tools[m[1]]; return; }
      if ((m = /^X(-?[\d.]+)Y(-?[\d.]+)/.exec(ln)) && !inHeader && cur != null) {
        var x = Number(m[1]) * (m[1].indexOf('.') >= 0 ? mul : mul / 1000), y = Number(m[2]) * (m[2].indexOf('.') >= 0 ? mul : mul / 1000);
        out.push({ x: x, y: H != null ? H - y : y, d: cur });
      }
    });
    return out;
  }, []);

  /* ---------- Stueckliste, Pick&Place ---------- */
  var bom = guard(function (board) {
    var groups = {}, order = [];
    arr(board && board.parts).forEach(function (p) {
      if (!isObj(p)) return;
      var key = String(p.value == null ? '' : p.value) + '|' + String(p.fp);
      if (!groups[key]) { groups[key] = { value: p.value == null ? '' : String(p.value), fp: String(p.fp), refs: [] }; order.push(key); }
      groups[key].refs.push(str(p.ref, str(p.id, '?')));
    });
    var list = order.map(function (k) {
      var g = groups[k]; g.refs.sort(natCmp); g.qty = g.refs.length;
      var fp = footprint(g.fp); g.kind = fp ? fp.kind : null; g.desc = fp ? fp.name : '';
      return g;
    });
    list.sort(function (a, c) { return natCmp(a.refs[0], c.refs[0]); });
    return list;
  }, []);
  var pickplace = guard(function (board, opts) {
    opts = opts || {};
    var h = num(board && board.h, 0), out = [];
    arr(board && board.parts).forEach(function (p) {
      if (!isObj(p)) return;
      var fp = footprint(p.fp);
      if (!opts.all && (!fp || fp.kind !== 'smd')) return;
      var x = num(p.x, 0), y = num(p.y, 0);
      if (opts.origin === 'bottomleft') y = h - y;
      out.push({ ref: str(p.ref, str(p.id, '?')), x: r3(x), y: r3(y), rot: partRotNorm(p), side: p.side === 'bot' ? 'bot' : 'top', fp: String(p.fp), value: p.value == null ? '' : String(p.value) });
    });
    out.sort(function (a, c) { return natCmp(a.ref, c.ref); });
    return out;
  }, []);
  function csvCell(v) { v = String(v == null ? '' : v); return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  var pickplaceCsv = guard(function (board, opts) {
    var rows = ['Designator,Val,Package,Mid X,Mid Y,Rotation,Layer'];
    pickplace(board, opts).forEach(function (p) {
      rows.push([p.ref, p.value, p.fp, p.x.toFixed(3), p.y.toFixed(3), p.rot, p.side === 'bot' ? 'Bottom' : 'Top'].map(csvCell).join(','));
    });
    return rows.join('\n') + '\n';
  }, 'Designator,Val,Package,Mid X,Mid Y,Rotation,Layer\n');
  var bomCsv = guard(function (board) {
    var rows = ['Menge,Wert,Gehäuse,Referenzen'];
    bom(board).forEach(function (g) { rows.push([g.qty, g.value, g.fp, g.refs.join(' ')].map(csvCell).join(',')); });
    return rows.join('\n') + '\n';
  }, 'Menge,Wert,Gehäuse,Referenzen\n');

  /* ---------- Kosten ---------- */
  var COST = {
    setup: { 1: 12, 2: 18, 4: 42, 6: 78 }, layerFactor: { 1: 0.7, 2: 1, 4: 2.1, 6: 3.4 }, rate: 0.035, holeEach: 0.003,
    fineHole: 0.006, fineSetup: 8, enigSetup: 5, enigRate: 0.02, lead: { 1: 3, 2: 4, 4: 7, 6: 10 }
  };
  var cost = guard(function (board, qty, opts) {
    var b = isObj(board) ? board : {};
    opts = opts || {};
    qty = Math.max(1, Math.round(num(qty, 1)));
    var n = nLayers(b), ol = outlineOf(b), area = polyArea(ol) / 100;       // cm2
    var finish = String(opts.finish || b.finish || 'HASL').toUpperCase().indexOf('ENIG') === 0 ? 'ENIG' : 'HASL';
    var A = analysis(isObj(board) ? board : newBoard({})), holes = 0, minD = Infinity, fine = 0, rules = A.rules;
    arr(b.vias).forEach(function (v) { if (isObj(v)) { holes++; var d = num(v.drill, rules.viaDrill); if (d < minD) minD = d; if (d < 0.3) fine++; } });
    A.pads.forEach(function (p) { if (p.drill > 0) { holes++; if (p.drill < minD) minD = p.drill; if (p.drill < 0.3) fine++; } });
    arr(b.holes).forEach(function (h) { if (isObj(h)) { holes++; var d = num(h.d, 3); if (d < minD) minD = d; } });
    var items = [];
    function add(label, c) { items.push({ label: label, cost: Math.round(c * 100) / 100 }); }
    var copperF = (num(b.copperOz, 1) >= 2) ? 1.25 : 1;
    add('Grundpreis (Rüstkosten, Daten, Werkzeug) – ' + n + ' Lage' + (n > 1 ? 'n' : ''), COST.setup[n]);
    var variable = 0;
    var cArea = area * COST.rate * COST.layerFactor[n] * copperF * qty;
    add('Fläche ' + fmt(area, 1) + ' cm² x ' + qty + ' Stück (Lagenfaktor ' + fmt(COST.layerFactor[n], 1) + (copperF > 1 ? ', 2 oz Kupfer +25 %' : '') + ')', cArea);
    variable += cArea;
    var cHole = holes * COST.holeEach * qty + fine * COST.fineHole * qty;
    add('Bohrungen: ' + holes + ' je Platine' + (fine ? ' (davon ' + fine + ' unter 0,3 mm)' : ''), cHole);
    variable += cHole;
    if (fine > 0 || (isFinite(minD) && minD < 0.3)) add('Zuschlag Feinstbohrung (< 0,3 mm)', COST.fineSetup);
    if (finish === 'ENIG') {
      var cE = area * COST.enigRate * qty;
      add('Oberfläche ENIG (chemisch Nickel/Gold)', COST.enigSetup + cE);
      variable += cE;
    } else add('Oberfläche HASL (verzinnt)', 0);
    var disc = qty > 1 ? Math.min(0.45, 0.06 * Math.log(qty) / Math.log(2)) : 0;
    if (disc > 0) add('Mengenrabatt ' + Math.round(disc * 100) + ' % auf Fläche, Bohrungen und Oberfläche', -variable * disc);
    var total = 0;
    items.forEach(function (it) { total += it.cost; });
    total = Math.round(total * 100) / 100;
    var lead = COST.lead[n] + (finish === 'ENIG' ? 1 : 0) + (qty > 50 ? 1 : 0) + (qty > 200 ? 3 : 0) + (fine > 0 ? 1 : 0);
    return { total: total, perBoard: Math.round(total / qty * 100) / 100, items: items, leadTimeDays: lead, qty: qty, areaCm2: r3(area), holes: holes, finish: finish };
  }, { total: 0, perBoard: 0, items: [], leadTimeDays: 0 });

  /* ---------- clone, validate, JSON, nextId ---------- */
  function clone(board) {
    try { return JSON.parse(JSON.stringify(board)); } catch (e) { return isObj(board) ? Object.assign({}, board) : board; }
  }
  var validate = guard(function (board) {
    var errors = [], warnings = [];
    if (!isObj(board)) return { ok: false, errors: ['Platine ist kein Objekt'], warnings: warnings };
    var b = board, i;
    if (!(isNum(b.w) && b.w > 0) || !(isNum(b.h) && b.h > 0)) errors.push('Platinengröße (w/h) fehlt oder ist ungültig');
    if ([1, 2, 4, 6].indexOf(Number(b.layers)) < 0) errors.push('Lagenzahl muss 1, 2, 4 oder 6 sein (ist: ' + b.layers + ')');
    ['nets', 'parts', 'tracks', 'vias', 'zones', 'texts'].forEach(function (k) {
      if (b[k] != null && !Array.isArray(b[k])) errors.push('"' + k + '" muss eine Liste sein');
    });
    if (b.rules != null && !isObj(b.rules)) errors.push('"rules" muss ein Objekt sein');
    else if (b.rules) for (var rk in b.rules) if (!isNum(b.rules[rk]) || b.rules[rk] < 0) errors.push('Regel ' + rk + ' ist keine gültige Zahl');
    if (b.grid != null && !(isNum(b.grid) && b.grid > 0)) errors.push('Raster (grid) muss eine positive Zahl sein');
    var ll = layerList(b), ids = {};
    function uid(o, what) {
      if (!isObj(o)) { errors.push(what + ' ist kein Objekt'); return false; }
      if (o.id == null) { warnings.push(what + ' hat keine id'); return true; }
      if (ids[o.id]) errors.push('id "' + o.id + '" ist doppelt vergeben'); ids[o.id] = true;
      return true;
    }
    var refs = {};
    arr(b.parts).forEach(function (p, k) {
      if (!uid(p, 'Bauteil ' + k)) return;
      if (!footprint(p.fp)) errors.push('Bauteil ' + str(p.ref, str(p.id, '#' + k)) + ': Footprint "' + p.fp + '" unbekannt');
      if (!isNum(p.x) || !isNum(p.y)) errors.push('Bauteil ' + str(p.ref, '#' + k) + ': Position fehlt');
      if (p.rot != null && [0, 90, 180, 270].indexOf(partRotNorm(p)) < 0) warnings.push('Bauteil ' + str(p.ref, '#' + k) + ': Drehung ' + p.rot + '° ist kein Vielfaches von 90°');
      if (p.side != null && p.side !== 'top' && p.side !== 'bot') errors.push('Bauteil ' + str(p.ref, '#' + k) + ': side muss top oder bot sein');
      var r = str(p.ref, null);
      if (r) { if (refs[r]) errors.push('Referenz ' + r + ' ist doppelt'); refs[r] = true; }
      var fp = footprint(p.fp);
      if (fp && fp.kind === 'smd' && p.side !== 'bot' && nLayers(b) === 1) warnings.push('SMD-Bauteil ' + str(p.ref, '#' + k) + ' liegt oben, die Platine hat nur eine Lage (unten)');
    });
    var pads = padsOf(b), padIds = {};
    pads.forEach(function (p) { padIds[p.id] = true; });
    var netNames = {}, pinUsed = {};
    arr(b.nets).forEach(function (n, k) {
      if (!isObj(n) || typeof n.name !== 'string' || n.name === '') { errors.push('Netz #' + k + ' hat keinen Namen'); return; }
      if (netNames[n.name]) errors.push('Netz ' + n.name + ' ist doppelt'); netNames[n.name] = true;
      arr(n.pins).forEach(function (pin) {
        pin = String(pin);
        if (!padIds[pin]) errors.push('Netz ' + n.name + ': Pin ' + pin + ' existiert nicht');
        else if (pinUsed[pin] && pinUsed[pin] !== n.name) errors.push('Pin ' + pin + ' liegt in zwei Netzen (' + pinUsed[pin] + ' und ' + n.name + ')');
        pinUsed[pin] = n.name;
      });
    });
    arr(b.tracks).forEach(function (t, k) {
      if (!uid(t, 'Leiterbahn ' + k)) return;
      if (ll.indexOf(t.layer) < 0) errors.push('Leiterbahn ' + str(t.id, '#' + k) + ': Lage ' + t.layer + ' gibt es auf dieser Platine nicht');
      if (!Array.isArray(t.pts) || t.pts.length < 2 || !t.pts.every(isPt)) errors.push('Leiterbahn ' + str(t.id, '#' + k) + ': Punkte ungültig (mindestens 2 Punkte [x,y])');
      if (!(isNum(t.w) && t.w > 0)) errors.push('Leiterbahn ' + str(t.id, '#' + k) + ': Breite ungültig');
      if (t.net && !netNames[t.net]) warnings.push('Leiterbahn ' + str(t.id, '#' + k) + ': Netz ' + t.net + ' nicht in der Netzliste');
    });
    arr(b.vias).forEach(function (v, k) {
      if (!uid(v, 'Via ' + k)) return;
      if (!isNum(v.x) || !isNum(v.y)) errors.push('Via ' + str(v.id, '#' + k) + ': Position fehlt');
      if (v.dia != null && !(isNum(v.dia) && v.dia > 0)) errors.push('Via ' + str(v.id, '#' + k) + ': Durchmesser ungültig');
      if (isNum(v.dia) && isNum(v.drill) && v.drill >= v.dia) errors.push('Via ' + str(v.id, '#' + k) + ': Bohrung ist nicht kleiner als der Durchmesser');
      if (v.from != null && ll.indexOf(v.from) < 0) errors.push('Via ' + str(v.id, '#' + k) + ': from-Lage ' + v.from + ' unbekannt');
      if (v.to != null && ll.indexOf(v.to) < 0) errors.push('Via ' + str(v.id, '#' + k) + ': to-Lage ' + v.to + ' unbekannt');
    });
    arr(b.zones).forEach(function (z, k) {
      if (!uid(z, 'Fläche ' + k)) return;
      if (ll.indexOf(z.layer) < 0) errors.push('Fläche ' + str(z.id, '#' + k) + ': Lage ' + z.layer + ' gibt es auf dieser Platine nicht');
      if (!validPoly(z.poly)) errors.push('Fläche ' + str(z.id, '#' + k) + ': Umriss braucht mindestens 3 gültige Punkte');
      if (z.net && !netNames[z.net]) warnings.push('Fläche ' + str(z.id, '#' + k) + ': Netz ' + z.net + ' nicht in der Netzliste');
    });
    arr(b.texts).forEach(function (t, k) { uid(t, 'Text ' + k); });
    if (b.outline != null && !validPoly(b.outline)) errors.push('Umriss (outline) braucht mindestens 3 gültige Punkte');
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }, function (e) { return { ok: false, errors: ['Prüfung fehlgeschlagen: ' + (e && e.message)], warnings: [] }; });

  function toJSON(board, pretty) {
    try { return JSON.stringify(board, null, pretty ? 1 : 0); } catch (e) { return '{}'; }
  }
  function fromJSON(src, errs) {
    var o = src;
    function err(m) { if (Array.isArray(errs)) errs.push(m); }
    if (typeof src === 'string') {
      try { o = JSON.parse(src); } catch (e) { err('Kein gültiges JSON: ' + e.message); return null; }
    }
    if (!isObj(o)) { err('Platine fehlt oder ist kein Objekt'); return null; }
    try { return normalize(o); } catch (e) { err('Platine nicht lesbar: ' + e.message); return null; }
  }
  var nextId = guard(function (board, prefix) {
    var mx = 0;
    function scan(list) {
      arr(list).forEach(function (o) {
        if (!isObj(o) || o.id == null) return;
        var m = /(\d+)$/.exec(String(o.id));
        if (m) { var v = Number(m[1]); if (v > mx) mx = v; }
      });
    }
    if (isObj(board)) ['parts', 'tracks', 'vias', 'zones', 'texts', 'holes'].forEach(function (k) { scan(board[k]); });
    return (typeof prefix === 'string' ? prefix : 'e') + (mx + 1);
  }, 'e1');

  /* ---------- Autorouter ---------- */
  var DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];

  function routeImpl(board, opts, out, t0) {
    if (!isObj(board)) { out.board = newBoard({}); out.failed.push({ net: '*', reason: 'Keine Platine übergeben' }); return; }
    var base = normalize(board);
    var deadline = t0 + num(opts.maxMs, 2600);
    var A0 = analysis(base), rules = A0.rules, layersAll = A0.layers;
    var diag = !(opts.diag === false || opts.diagonal === false);
    var viaCostGrid = num(opts.viaCost, 10), bendGrid = num(opts.bendCost, 0.5), WT = num(opts.weight, 1.25);
    var conn0 = connOf(base, A0);
    // Netze, die geroutet werden sollen
    var wanted = null;
    if (Array.isArray(opts.nets)) { wanted = {}; opts.nets.forEach(function (n) { wanted[String(n)] = true; }); }
    var netsByName = netByName(base), padsByNet = {};
    A0.pads.forEach(function (p) { if (p.net) (padsByNet[p.net] = padsByNet[p.net] || []).push(p); });
    var todo = base.nets.filter(function (n) { return (!wanted || wanted[n.name]) && (padsByNet[n.name] || []).length >= 2; }).map(function (n) { return n.name; });
    if (!todo.length) { out.board = clone(base); out.routed = base.nets.map(function (n) { return n.name; }); return; }
    // Lagen
    var zoneLayers = {};
    arr(base.zones).forEach(function (z) { if (isObj(z) && validPoly(z.poly) && !isOuter(z.layer)) zoneLayers[z.layer] = true; });
    var RL;
    if (Array.isArray(opts.layers) && opts.layers.length) RL = opts.layers.filter(function (l) { return layersAll.indexOf(l) >= 0; });
    else RL = layersAll.filter(function (l) { return !zoneLayers[l]; });
    if (!RL.length) RL = layersAll.slice();
    var NL = RL.length;
    var RLbit = RL.map(function (l) { return 1 << layersAll.indexOf(l); });
    var ALLBITS = (1 << layersAll.length) - 1;
    // Raster
    var ol = outlineOf(base), obb = polyBBox(ol), rectO = !validPoly(base.outline);
    var g = Math.max(0.05, num(base.grid, 0.25));
    var nx, ny;
    for (;;) {
      nx = Math.floor(obb[2] / g) + 1; ny = Math.floor(obb[3] / g) + 1;
      if (nx * ny * NL * 9 <= 4500000) break;
      g *= 1.25;
      if (out.warnings.indexOf('Raster zu fein für die Plattengröße, automatisch vergröbert') < 0) out.warnings.push('Raster zu fein für die Plattengröße, automatisch vergröbert');
    }
    var coarse = g > 0.5;
    var NN = nx * ny;
    var S = NN * NL * 9;
    var gArr = new Float32Array(S), gSt = new Int32Array(S), clSt = new Int32Array(S), par = new Int32Array(S);
    var tStamp = new Int32Array(NN * NL), pStamp = new Int32Array(NN * NL), pVal = new Uint8Array(NN * NL);
    var vStamp = new Int32Array(NN), vVal = new Uint8Array(NN);
    var run = 0, passRun = 0, totalExp = 0;
    var clr = rules.clearance;
    var viaDia = rules.viaDia, viaDrill = rules.viaDrill, viaR = viaDia / 2;
    var maxW = 0.25;
    todo.forEach(function (nm) { maxW = Math.max(maxW, netWidth(nm)); });
    function netWidth(nm) {
      var n = netsByName[nm] || {}, w = num(n.width, 0);
      if (!(w > 0)) w = n.cls === 'power' ? 0.4 : 0.25;
      w = Math.max(w, rules.minWidth);
      if (num(n.current, 0) > 0) w = Math.max(w, Math.ceil(ipcWidth(n.current, { oz: num(base.copperOz, 1), rise: num(n.rise, 10) }) * 20) / 20);
      return Math.min(w, 4);
    }
    // Netzindizes
    var netIdx = {}, nIdx = 0;
    function idxOf(nm) { if (!nm) return 0; if (!netIdx[nm]) netIdx[nm] = ++nIdx; return netIdx[nm]; }
    base.nets.forEach(function (n) { idxOf(n.name); });
    // ids
    var idc = (function () { var m = /(\d+)$/.exec(nextId(base, '')); return m ? Number(m[1]) - 1 : 0; })();

    // Hindernis-Index
    var B = 1.5, bx = Math.ceil(obb[2] / B) + 3, by = Math.ceil(obb[3] / B) + 3, E = Math.max(maxW / 2, viaR) + clr + 0.3;
    function newState() {
      return { obs: [], bucket: new Array(bx * by), last: new Int32Array(bx * by), holes: [], tracks: [], vias: [] };
    }
    var ST;
    function insertObs(o) {
      var id = ST.obs.length + 1; ST.obs.push(o);
      var exp = E + (o.k === 'c' ? o.r : 0), cells = [], i, j;
      function cellsRect(x0, y0, x1, y1) {
        var i0 = Math.max(0, Math.floor((x0 - exp) / B)), i1 = Math.min(bx - 1, Math.floor((x1 + exp) / B));
        var j0 = Math.max(0, Math.floor((y0 - exp) / B)), j1 = Math.min(by - 1, Math.floor((y1 + exp) / B));
        for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
          var c = j * bx + i;
          if (ST.last[c] !== id) { ST.last[c] = id; (ST.bucket[c] || (ST.bucket[c] = [])).push(o); }
        }
      }
      if (o.k === 'r') cellsRect(o.x0, o.y0, o.x1, o.y1);
      else {
        var len = Math.hypot(o.x2 - o.x1, o.y2 - o.y1), steps = Math.max(1, Math.ceil(len / (B * 0.5)));
        for (var s = 0; s <= steps; s++) {
          var t = s / steps, x = o.x1 + (o.x2 - o.x1) * t, y = o.y1 + (o.y2 - o.y1) * t;
          cellsRect(x, y, x, y);
        }
      }
    }
    function addCap(x1, y1, x2, y2, r, net, mask, kind) { insertObs({ k: 'c', x1: x1, y1: y1, x2: x2, y2: y2, r: r, net: net, mask: mask, kind: kind }); }
    function loadBoard() {
      ST = newState();
      A0.pads.forEach(function (p) {
        var s = padShape(p), mask = 0;
        p.layers.forEach(function (l) { mask |= 1 << layersAll.indexOf(l); });
        s.net = idxOf(p.net); s.mask = mask; s.kind = 'pad'; s.smd = p.kind === 'smd'; s.pad = p.id;
        insertObs(s);
        if (p.drill > 0) ST.holes.push({ x: p.x, y: p.y, r: p.drill / 2 });
      });
      arr(base.tracks).forEach(function (t) {
        if (!isObj(t) || layersAll.indexOf(t.layer) < 0) return;
        var pts = trackPts(t), w = trackW(base, t), m = 1 << layersAll.indexOf(t.layer), n = idxOf(t.net);
        if (pts.length === 1) addCap(pts[0][0], pts[0][1], pts[0][0], pts[0][1], w / 2, n, m, 'track');
        for (var k = 0; k + 1 < pts.length; k++) addCap(pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1], w / 2, n, m, 'track');
      });
      arr(base.vias).forEach(function (v) {
        if (!isObj(v) || !isNum(v.x) || !isNum(v.y)) return;
        var m = 0;
        viaSpan(base, v).forEach(function (l) { m |= 1 << layersAll.indexOf(l); });
        addCap(v.x, v.y, v.x, v.y, num(v.dia, viaDia) / 2, idxOf(v.net), m, 'via');
        ST.holes.push({ x: v.x, y: v.y, r: num(v.drill, viaDrill) / 2 });
      });
      arr(base.holes).forEach(function (h) {
        if (!isObj(h) || !isNum(h.x) || !isNum(h.y)) return;
        var r = num(h.d, 3) / 2;
        addCap(h.x, h.y, h.x, h.y, r + Math.max(0, rules.edge - clr), 0, ALLBITS, 'hole');
        ST.holes.push({ x: h.x, y: h.y, r: r });
      });
    }
    function bucketAt(x, y) {
      var i = Math.floor(x / B), j = Math.floor(y / B);
      if (i < 0 || j < 0 || i >= bx || j >= by) return null;
      return ST.bucket[j * bx + i] || null;
    }
    function ptDist(o, x, y) {
      if (o.k === 'c') return ptSegD(x, y, o.x1, o.y1, o.x2, o.y2) - o.r;
      var dx = Math.max(o.x0 - x, 0, x - o.x1), dy = Math.max(o.y0 - y, 0, y - o.y1);
      return Math.sqrt(dx * dx + dy * dy);
    }
    function inBoard(x, y, half) {
      var m = rules.edge + half;
      if (rectO) return x >= obb[0] + m - 1e-9 && y >= obb[1] + m - 1e-9 && x <= obb[2] - m + 1e-9 && y <= obb[3] - m + 1e-9;
      if (!pointInPoly(x, y, ol)) return false;
      for (var k = 0; k < ol.length; k++) {
        var a = ol[k], c = ol[(k + 1) % ol.length];
        if (ptSegD(x, y, a[0], a[1], c[0], c[1]) < m - 1e-9) return false;
      }
      return true;
    }
    var cNet = 0, cW = 0.25;
    var LHALF2 = (g * SQ2 / 2) * (g * SQ2 / 2);
    // 0 = blockiert, 1 = frei, 2 = frei aber knapp (Kanten daneben muessen exakt geprueft werden)
    function pointFree(net, w, bit, x, y) {
      if (!inBoard(x, y, w / 2)) return 0;
      var l = bucketAt(x, y);
      if (!l) return 1;
      var need = clr + w / 2 - 1e-6, res = 1;
      for (var k = 0; k < l.length; k++) {
        var o = l[k];
        if (!(o.mask & bit)) continue;
        if (o.net === net && net !== 0) continue;
        var d = ptDist(o, x, y);
        if (d < need) return 0;
        if (res === 1) {
          var rc = need + (o.k === 'c' ? o.r : 0);
          if (d < Math.sqrt(rc * rc + LHALF2) - (o.k === 'c' ? o.r : 0)) res = 2;
        }
      }
      return res;
    }
    function segFree(net, w, bit, x1, y1, x2, y2) {
      var n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 0.2));
      var cap = capShape(x1, y1, x2, y2, w / 2), seen = [];
      for (var q = 0; q <= n; q++) {
        var x = x1 + (x2 - x1) * q / n, y = y1 + (y2 - y1) * q / n;
        if (!inBoard(x, y, w / 2)) return false;
        var l = bucketAt(x, y);
        if (!l) continue;
        for (var k = 0; k < l.length; k++) {
          var o = l[k];
          if (!(o.mask & bit) || (o.net === net && net !== 0) || seen.indexOf(o) >= 0) continue;
          seen.push(o);
          if (shapeDist(cap, o).d < clr - 1e-6) return false;
        }
      }
      return true;
    }
    function free(li, i, j) {
      var idx = (li * ny + j) * nx + i;
      if (pStamp[idx] === passRun) return pVal[idx] > 0;
      var ok = pointFree(cNet, cW, RLbit[li], i * g, j * g);
      pStamp[idx] = passRun; pVal[idx] = ok;
      return ok > 0;
    }
    function tight(li, i, j) { return pVal[(li * ny + j) * nx + i] === 2; }
    function viaFree(i, j) {
      var idx = j * nx + i;
      if (vStamp[idx] === passRun) return vVal[idx] === 1;
      var x = i * g, y = j * g, ok = inBoard(x, y, viaR);
      if (ok) {
        var l = bucketAt(x, y);
        if (l) for (var k = 0; k < l.length && ok; k++) {
          var o = l[k], d = ptDist(o, x, y);
          if (o.net !== cNet || cNet === 0) { if (d < clr + viaR - 1e-6) ok = false; }
          else if (o.smd && d < viaR + 0.05) ok = false;
        }
        if (ok) for (var h = 0; h < ST.holes.length; h++) {
          var ho = ST.holes[h];
          if (Math.abs(ho.x - x) > 3 || Math.abs(ho.y - y) > 3) continue;
          if (Math.hypot(ho.x - x, ho.y - y) - ho.r - viaDrill / 2 < rules.holeGap + 1e-6) { ok = false; break; }
        }
      }
      vStamp[idx] = passRun; vVal[idx] = ok ? 1 : 0;
      return ok;
    }
    // Heap
    var hk = new Float64Array(1 << 16), hv = new Int32Array(1 << 16), hn = 0;
    function hpush(k, v) {
      if (hn >= hk.length) { var nk = new Float64Array(hk.length * 2); nk.set(hk); hk = nk; var nv = new Int32Array(hv.length * 2); nv.set(hv); hv = nv; }
      var i = hn++;
      while (i > 0) { var p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; }
      hk[i] = k; hv[i] = v;
    }
    function hpop() {
      var top = hv[0]; hn--;
      if (hn > 0) {
        var k = hk[hn], v = hv[hn], i = 0;
        for (;;) {
          var l = 2 * i + 1;
          if (l >= hn) break;
          var r = l + 1, c = (r < hn && hk[r] < hk[l]) ? r : l;
          if (hk[c] >= k) break;
          hk[i] = hk[c]; hv[i] = hv[c]; i = c;
        }
        hk[i] = k; hv[i] = v;
      }
      return top;
    }
    function search(srcs, tgts, allowedLi, allowVias, maxExp) {
      run++;
      var ti0 = 1e9, ti1 = -1, tj0 = 1e9, tj1 = -1, t;
      for (t = 0; t < tgts.length; t++) {
        var tg = tgts[t];
        tStamp[(tg.li * ny + tg.j) * nx + tg.i] = run;
        if (tg.i < ti0) ti0 = tg.i; if (tg.i > ti1) ti1 = tg.i; if (tg.j < tj0) tj0 = tg.j; if (tg.j > tj1) tj1 = tg.j;
      }
      function h(i, j) {
        var dx = Math.max(0, ti0 - i, i - ti1), dy = Math.max(0, tj0 - j, j - tj1);
        return diag ? g * (Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy)) : g * (dx + dy);
      }
      hn = 0;
      for (t = 0; t < srcs.length; t++) {
        var sr = srcs[t];
        if (!free(sr.li, sr.i, sr.j)) continue;
        var s0 = ((sr.li * ny + sr.j) * nx + sr.i) * 9 + 8;
        if (gSt[s0] !== run || sr.g0 < gArr[s0]) { gSt[s0] = run; gArr[s0] = sr.g0; par[s0] = -1; hpush(sr.g0 + WT * h(sr.i, sr.j), s0); }
      }
      var bend = bendGrid * g, viaMM = viaCostGrid * g, goal = -1, exp = 0, kk;
      while (hn > 0) {
        var s = hpop();
        if (clSt[s] === run) continue;
        clSt[s] = run;
        var node = (s / 9) | 0, dir = s - node * 9, i = node % nx, tt = (node / nx) | 0, j = tt % ny, li = (tt / ny) | 0;
        if (tStamp[node] === run) { goal = s; break; }
        if (++exp > maxExp) break;
        if ((exp & 2047) === 0 && Date.now() > deadline) break;
        var gcur = gArr[s];
        for (kk = 0; kk < 8; kk++) {
          if (!diag && (kk & 1)) continue;
          if (dir !== 8) { var dd = kk - dir; if (dd < 0) dd = -dd; if (dd > 4) dd = 8 - dd; if (dd >= 3) continue; }
          var ni = i + DX[kk], nj = j + DY[kk];
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          var ns = ((li * ny + nj) * nx + ni) * 9 + kk;
          if (clSt[ns] === run) continue;
          if (!free(li, ni, nj)) continue;
          if ((coarse || tight(li, i, j) || tight(li, ni, nj)) && !segFree(cNet, cW, RLbit[li], i * g, j * g, ni * g, nj * g)) continue;
          var ng = gcur + ((kk & 1) ? g * SQ2 : g) + ((dir !== 8 && dir !== kk) ? bend : 0);
          if (gSt[ns] !== run || ng < gArr[ns]) { gSt[ns] = run; gArr[ns] = ng; par[ns] = s; hpush(ng + WT * h(ni, nj), ns); }
        }
        if (allowVias && viaFree(i, j)) {
          for (var q = 0; q < allowedLi.length; q++) {
            var l2 = allowedLi[q];
            if (l2 === li || !free(l2, i, j)) continue;
            var ns2 = ((l2 * ny + j) * nx + i) * 9 + 8;
            if (clSt[ns2] === run) continue;
            var ng2 = gcur + viaMM;
            if (gSt[ns2] !== run || ng2 < gArr[ns2]) { gSt[ns2] = run; gArr[ns2] = ng2; par[ns2] = s; hpush(ng2 + WT * h(i, j), ns2); }
          }
        }
      }
      totalExp += exp;
      if (goal < 0) return null;
      var path = [], cs = goal;
      while (cs >= 0) {
        var nd = (cs / 9) | 0, tq = (nd / nx) | 0;
        path.push([(tq / ny) | 0, nd % nx, tq % ny]);
        cs = par[cs];
      }
      path.reverse();
      return path;
    }
    // Pad-Zugaenge
    function accessOf(pad, net, w) {
      var res = [], kk0 = Math.max(1, Math.ceil(0.8 / g)), attempt;
      var ci = Math.round(pad.x / g), cj = Math.round(pad.y / g);
      for (attempt = 0; attempt < 2 && !res.length; attempt++) {
        var kk2 = attempt === 0 ? kk0 : kk0 * 2;
        for (var li = 0; li < NL; li++) {
          if (pad.layers.indexOf(RL[li]) < 0) continue;
          var cand = [];
          for (var dj = -kk2; dj <= kk2; dj++) for (var di = -kk2; di <= kk2; di++) {
            var ni = ci + di, nj = cj + dj;
            if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
            var x = ni * g, y = nj * g, d = Math.hypot(x - pad.x, y - pad.y);
            if (d > Math.max(1.0, g * 1.5) * (attempt + 1)) continue;
            cand.push({ li: li, i: ni, j: nj, d: d });
          }
          cand.sort(function (a, c) { return a.d - c.d || a.j - c.j || a.i - c.i; });
          var got = 0;
          for (var q = 0; q < cand.length && got < 6; q++) {
            var c = cand[q];
            if (!free(c.li, c.i, c.j)) continue;
            if (c.d > 1e-6 && !segFree(net, w, RLbit[li], pad.x, pad.y, c.i * g, c.j * g)) continue;
            res.push({ li: c.li, i: c.i, j: c.j, g0: c.d, pad: pad, stub: c.d > 1e-6 });
            got++;
          }
        }
      }
      return res;
    }
    var stubDone = {};
    function sk(a) { return a.pad.id + '@' + a.li + ',' + a.i + ',' + a.j; }
    function angleAt(p0, p1, p2) {
      var ax = p0[0] - p1[0], ay = p0[1] - p1[1], bx = p2[0] - p1[0], by2 = p2[1] - p1[1];
      var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by2);
      if (la < 1e-9 || lb < 1e-9) return 180;
      return Math.acos(clamp((ax * bx + ay * by2) / (la * lb), -1, 1)) * 180 / Math.PI;
    }
    function emitPath(nm, w, path, srcAcc, tgtAcc, treeNodes) {
      var nt = [], nv = [], runs = [], cur = { li: path[0][0], pts: [[path[0][1] * g, path[0][2] * g]] }, k;
      for (k = 1; k < path.length; k++) {
        var nd = path[k], x = nd[1] * g, y = nd[2] * g;
        if (nd[0] !== cur.li) { nv.push([x, y]); runs.push(cur); cur = { li: nd[0], pts: [[x, y]] }; }
        else cur.pts.push([x, y]);
      }
      runs.push(cur);
      path.forEach(function (nd) { treeNodes.push({ li: nd[0], i: nd[1], j: nd[2], g0: 0 }); });
      if (srcAcc && srcAcc.stub && !stubDone[sk(srcAcc)]) { runs[0].pts.unshift([srcAcc.pad.x, srcAcc.pad.y]); stubDone[sk(srcAcc)] = true; } else srcAcc = null;
      if (tgtAcc && tgtAcc.stub && !stubDone[sk(tgtAcc)]) { runs[runs.length - 1].pts.push([tgtAcc.pad.x, tgtAcc.pad.y]); stubDone[sk(tgtAcc)] = true; } else tgtAcc = null;
      runs.forEach(function (rn, ri) {
        // kollineare/doppelte Punkte entfernen
        var p = rn.pts, o = [];
        for (var q = 0; q < p.length; q++) {
          if (o.length && Math.abs(o[o.length - 1][0] - p[q][0]) < 1e-9 && Math.abs(o[o.length - 1][1] - p[q][1]) < 1e-9) continue;
          o.push(p[q]);
        }
        var c2 = [];
        for (q = 0; q < o.length; q++) {
          if (c2.length >= 1 && q < o.length - 1) {
            var a = c2[c2.length - 1], b2 = o[q], c3 = o[q + 1];
            var cr = (b2[0] - a[0]) * (c3[1] - b2[1]) - (b2[1] - a[1]) * (c3[0] - b2[0]);
            var dt = (b2[0] - a[0]) * (c3[0] - b2[0]) + (b2[1] - a[1]) * (c3[1] - b2[1]);
            if (Math.abs(cr) < 1e-9 && dt > 0) continue;
          }
          c2.push(o[q]);
        }
        // spitzen Winkel an der Stichleitung entschaerfen
        var bit = RLbit[rn.li];
        if (ri === 0 && srcAcc && srcAcc.stub && c2.length >= 3 && angleAt(c2[0], c2[1], c2[2]) < 89.5 && segFree(cNet, cW, bit, c2[0][0], c2[0][1], c2[2][0], c2[2][1])) c2.splice(1, 1);
        if (ri === runs.length - 1 && tgtAcc && tgtAcc.stub && c2.length >= 3) {
          var L = c2.length;
          if (angleAt(c2[L - 3], c2[L - 2], c2[L - 1]) < 89.5 && segFree(cNet, cW, bit, c2[L - 3][0], c2[L - 3][1], c2[L - 1][0], c2[L - 1][1])) c2.splice(L - 2, 1);
        }
        if (c2.length >= 2) nt.push({ layer: RL[rn.li], pts: c2 });
      });
      nt.forEach(function (t) {
        var tr = { id: 't' + (++idc), layer: t.layer, net: nm, w: r4(cW), pts: t.pts.map(function (p) { return [r4(p[0]), r4(p[1])]; }) };
        ST.tracks.push(tr);
        var m = 1 << layersAll.indexOf(t.layer);
        for (var q = 0; q + 1 < tr.pts.length; q++) addCap(tr.pts[q][0], tr.pts[q][1], tr.pts[q + 1][0], tr.pts[q + 1][1], cW / 2, cNet, m, 'track');
      });
      nv.forEach(function (p) { addVia(nm, p[0], p[1]); });
      passRun++;
    }
    function addVia(nm, x, y) {
      var v = { id: 'v' + (++idc), x: r4(x), y: r4(y), net: nm, dia: viaDia, drill: viaDrill, from: layersAll[0], to: layersAll[layersAll.length - 1] };
      ST.vias.push(v);
      addCap(v.x, v.y, v.x, v.y, viaR, cNet, ALLBITS, 'via');
      ST.holes.push({ x: v.x, y: v.y, r: viaDrill / 2 });
    }
    function islandsOf(nm) {
      var map = {}, list = [];
      (padsByNet[nm] || []).forEach(function (p) {
        var pi = conn0.padIsland[p.id], k = pi ? pi.island : 'x' + p.id;
        if (map[k] == null) { map[k] = list.length; list.push([]); }
        list[map[k]].push(p);
      });
      return list;
    }
    function zonesOf(nm) { return arr(base.zones).filter(function (z) { return isObj(z) && z.net === nm && validPoly(z.poly) && layersAll.indexOf(z.layer) >= 0; }); }

    function routeZoneNet(nm) {
      var zs = zonesOf(nm), fails = [];
      (padsByNet[nm] || []).forEach(function (pad) {
        if (conn0.zoneConnected[pad.id]) return;
        var acc = accessOf(pad, cNet, cW);
        if (!acc.length) { fails.push(pad.id); return; }
        var cands = [], ci = Math.round(pad.x / g), cj = Math.round(pad.y / g), kk = Math.ceil(8 / g);
        for (var dj = -kk; dj <= kk; dj++) for (var di = -kk; di <= kk; di++) {
          var ni = ci + di, nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          var x = ni * g, y = nj * g, d = Math.hypot(x - pad.x, y - pad.y);
          if (d > 8) continue;
          var inz = false;
          for (var z = 0; z < zs.length; z++) if (pointInPoly(x, y, zs[z].poly)) { inz = true; break; }
          if (inz) cands.push({ i: ni, j: nj, d: d });
        }
        cands.sort(function (a, c) { return a.d - c.d || a.j - c.j || a.i - c.i; });
        var done = false, tries = 0;
        for (var q = 0; q < cands.length && !done && tries < 25; q++) {
          var c = cands[q];
          if (!viaFree(c.i, c.j)) continue;
          tries++;
          var tgts = [], li;
          for (li = 0; li < NL; li++) {
            if (pad.kind === 'smd' && pad.layers.indexOf(RL[li]) < 0) continue;
            if (free(li, c.i, c.j)) tgts.push({ li: li, i: c.i, j: c.j });
          }
          if (!tgts.length) continue;
          var allowed = [];
          for (li = 0; li < NL; li++) allowed.push(li);
          var path = search(acc, tgts, allowed, pad.kind === 'tht', 9000);
          if (path) {
            var first = path[0], sa = null;
            for (var a = 0; a < acc.length; a++) if (acc[a].li === first[0] && acc[a].i === first[1] && acc[a].j === first[2]) { sa = acc[a]; break; }
            var tree = [];
            if (path.length === 1 && !(sa && sa.stub)) { addVia(nm, c.i * g, c.j * g); passRun++; }
            else {
              emitPath(nm, cW, path, sa, null, tree);
              var last = path[path.length - 1];
              var hasVia = ST.vias.some(function (v) { return Math.abs(v.x - last[1] * g) < 1e-3 && Math.abs(v.y - last[2] * g) < 1e-3; });
              if (!hasVia) { addVia(nm, last[1] * g, last[2] * g); passRun++; }
            }
            done = true;
          }
        }
        if (!done) fails.push(pad.id);
      });
      return fails.length ? 'Kein Via-Anschluss an die ' + nm + '-Fläche für ' + fails.slice(0, 4).join(', ') + (fails.length > 4 ? ' u. a.' : '') : null;
    }

    function routeNet(nm) {
      var isl = islandsOf(nm);
      if (isl.length < 2) return null;
      var acc = {}, treeNodes = [];
      function accFor(p) { if (!acc[p.id]) acc[p.id] = accessOf(p, cNet, cW); return acc[p.id]; }
      var connectedPads = isl[0].slice(), rest = isl.slice(1);
      for (var qi = 0; qi < isl[0].length; qi++) if (!accFor(isl[0][qi]).length) return 'Pad ' + isl[0][qi].id + ' ist vom Raster aus nicht erreichbar';
      while (rest.length) {
        var order = rest.map(function (r, idx) {
          var bd = Infinity;
          r.forEach(function (p) { connectedPads.forEach(function (c) { var d = Math.hypot(p.x - c.x, p.y - c.y); if (d < bd) bd = d; }); });
          return { r: r, idx: idx, d: bd };
        });
        order.sort(function (a, c) { return a.d - c.d || a.idx - c.idx; });
        var ok = false, reason = null;
        for (var oi = 0; oi < Math.min(order.length, 3) && !ok; oi++) {
          var cand = order[oi].r;
          var srcs = treeNodes.slice(), tgts = [], sacc = [], tacc = [];
          connectedPads.forEach(function (p) { accFor(p).forEach(function (a) { srcs.push(a); sacc.push(a); }); });
          var bad = null;
          cand.forEach(function (p) { var a = accFor(p); if (!a.length) bad = p; a.forEach(function (x) { tgts.push(x); tacc.push(x); }); });
          if (bad) { reason = 'Pad ' + bad.id + ' ist vom Raster aus nicht erreichbar (zu eng oder Raster zu grob)'; continue; }
          var allowed = [], li;
          for (li = 0; li < NL; li++) allowed.push(li);
          var path = search(srcs, tgts, allowed, NL > 1, num(opts.maxExpand, 260000));
          if (!path) { reason = 'Kein freier Weg gefunden'; continue; }
          var f = path[0], l = path[path.length - 1], sa = null, ta = null;
          for (var a = 0; a < sacc.length; a++) if (sacc[a].li === f[0] && sacc[a].i === f[1] && sacc[a].j === f[2]) { sa = sacc[a]; break; }
          for (a = 0; a < tacc.length; a++) if (tacc[a].li === l[0] && tacc[a].i === l[1] && tacc[a].j === l[2]) { ta = tacc[a]; break; }
          emitPath(nm, cW, path, sa, ta, treeNodes);
          connectedPads = connectedPads.concat(cand);
          rest.splice(order[oi].idx, 1);
          ok = true;
        }
        if (!ok) return reason || 'Kein freier Weg gefunden';
        if (Date.now() > deadline) return 'Zeitlimit erreicht';
      }
      return null;
    }

    function runPass(order) {
      loadBoard();
      passRun++;
      stubDone = {};
      var fails = {};
      order.forEach(function (nm) {
        if (Date.now() > deadline) { fails[nm] = 'Zeitlimit erreicht'; return; }
        cNet = idxOf(nm); cW = netWidth(nm); passRun++;
        var r = zonesOf(nm).length ? routeZoneNet(nm) : routeNet(nm);
        if (r) fails[nm] = r;
      });
      var nb = clone(base);
      nb.tracks = nb.tracks.concat(ST.tracks);
      nb.vias = nb.vias.concat(ST.vias);
      var cn = connectivity(nb), open = {}, cnt = 0;
      cn.unrouted.forEach(function (u) { open[u.net] = (open[u.net] || 0) + 1; cnt++; });
      return { board: nb, fails: fails, open: open, openCount: cnt, shorts: cn.shorts.length, tracks: ST.tracks.length, vias: ST.vias.length };
    }

    function hpwl(nm) {
      var ps = padsByNet[nm] || [], x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      ps.forEach(function (p) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
      return (x1 - x0) + (y1 - y0);
    }
    var hasZone = {};
    todo.forEach(function (nm) { hasZone[nm] = zonesOf(nm).length > 0; });
    var order1 = todo.slice().sort(function (a, c) {
      if (hasZone[a] !== hasZone[c]) return hasZone[a] ? -1 : 1;
      return hpwl(a) - hpwl(c) || (a < c ? -1 : 1);
    });
    var best = null, order = order1, pass, passesDone = 0;
    for (pass = 0; pass < 3; pass++) {
      var res = runPass(order);
      passesDone++;
      res.order = order;
      if (!best || res.openCount + res.shorts * 5 < best.openCount + best.shorts * 5) best = res;
      if (res.openCount === 0 || Date.now() > deadline - 100) break;
      var failedFirst = order1.filter(function (n) { return res.open[n] || res.fails[n]; });
      if (pass === 0) order = failedFirst.concat(order1.filter(function (n) { return failedFirst.indexOf(n) < 0; }));
      else order = failedFirst.concat(order1.filter(function (n) { return failedFirst.indexOf(n) < 0; }).reverse());
    }
    out.board = best.board;
    todo.forEach(function (nm) {
      if (best.open[nm] || best.fails[nm]) out.failed.push({ net: nm, reason: best.fails[nm] || 'Verbindung unvollständig', open: best.open[nm] || 0 });
      else out.routed.push(nm);
    });
    out.stats = { tracks: best.tracks, vias: best.vias, passes: passesDone, expansions: totalExp, grid: g, layers: RL, shorts: best.shorts };
  }

  function autoroute(board, opts) {
    var t0 = Date.now();
    var out = { board: null, routed: [], failed: [], warnings: [], stats: {} };
    try { routeImpl(board, isObj(opts) ? opts : {}, out, t0); }
    catch (e) {
      out.board = out.board || clone(board);
      out.failed.push({ net: '*', reason: 'Interner Fehler im Autorouter: ' + (e && e.message) });
    }
    out.stats.ms = Date.now() - t0;
    return out;
  }

  /* ---------- API ---------- */
  var api = {
    version: '1.0',
    layerList: guard(layerList, ['F.Cu', 'B.Cu']),
    stackup: guard(stackup, []),
    stackupTotal: guard(stackupTotal, 1.6),
    dielectricBetween: guard(dielectricBetween, { h: 0, er: 4.3 }),
    newBoard: guard(newBoard, function () { return { id: 'board', name: 'Neue Platine', w: 50, h: 40, layers: 2, nets: [], parts: [], tracks: [], vias: [], zones: [], texts: [] }; }),
    normalize: guard(normalize, null),
    footprints: FP,
    footprint: guard(footprint, null),
    padsOf: padsOf,
    partGeometry: guard(partGeometry, null),
    xform: guard(xform, [0, 0]),
    connectivity: connectivity,
    continuity: continuity,
    zoneFill: zoneFill,
    zoneFillInfo: zoneFillInfo,
    drc: drc,
    drcTypes: drcTypes,
    ipcWidth: guard(ipcWidth, 0),
    ipcCurrent: guard(ipcCurrent, 0),
    traceResistance: traceResistance,
    microstrip: microstrip,
    stripline: stripline,
    widthForImpedance: widthForImpedance,
    textStrokes: textStrokes,
    gerber: gerber,
    parseGerber: parseGerber,
    parseDrill: parseDrill,
    bom: bom,
    bomCsv: bomCsv,
    pickplace: pickplace,
    pickplaceCsv: pickplaceCsv,
    cost: cost,
    autoroute: autoroute,
    clone: clone,
    validate: validate,
    toJSON: toJSON,
    fromJSON: fromJSON,
    nextId: nextId,
    shapeDist: guard(shapeDist, { d: 1e9, x: 0, y: 0 }),
    padShape: guard(padShape, null)
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  var g0 = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : root);
  g0.PCB_CORE = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
