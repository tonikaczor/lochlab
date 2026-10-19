/* dscore.js – Rechenkern des Tonfunk Datenblatt-Labs (DS_CORE, DS_SCHEMA, DS_LIB)
 *
 * Entscheidungen zu offenen Punkten (Stand v1.0):
 *  - Rückgabekonvention: skalare Funktionen (parseValue, parseWithUnit, interp, readCurve, inverse,
 *    eSeries, tj, rthSum, tolerance) liefern bei ungültiger Eingabe null. Funktionen mit mehreren
 *    Ausgaben (derate, ledResistor, worstCase, divider) liefern ein Objekt mit ok:false und error:'…'
 *    (Zahlenfelder dann null). check() liefert eine Liste, bei Fehlern ein Eintrag key:'_fehler'.
 *    Keine Funktion wirft.
 *  - Einheiten: Alle Rechenfunktionen arbeiten in SI-Basiseinheiten (V, A, W, Ω, F, H, Hz, s, °C).
 *    Datenblattzeilen dürfen Vorsatzeinheiten tragen (mA, kΩ, ns ...); sie werden intern umgerechnet.
 *    Prozent wird NICHT skaliert: parseWithUnit('5 %') → value 5, unit '%'.
 *  - parseValue('1.000,5') = 1000,5; '1.000' = 1 (Punkt ist Dezimalpunkt, außer bei Dezimalkomma
 *    in der gleichen Zahl). Platzhalter-Schreibweise 4k7 / 2R2 / 4k7Ω wird verstanden.
 *    'm' allein = Milli, 'M' = Mega, 'K' = kilo wie 'k'; u/µ/μ = Mikro.
 *  - fmt(): Dezimalkomma, Minus als '−' (U+2212), Standard 3 signifikante Stellen;
 *    fmt(v,u,d,{dot:true}) liefert Dezimalpunkt. Vorsätze nur bei V A W Ω F H Hz s S (und ohne Einheit).
 *  - interp(): außerhalb des Stützstellenbereichs null (opts.clamp:true = Randwert, opts.extrapolate:true
 *    = Fortsetzung des Randsegments). Nicht aufsteigende Reihen werden nach x sortiert. Log-Achsen
 *    verlangen positive Werte, sonst null. inverse() verlangt streng monotone y-Werte, sonst null
 *    (crossings() liefert alle Schnittpunkte für nicht monotone Reihen).
 *  - derate(): ptotAllowed = min((Tjmax − Tamb)/RthJA, ptotMax); der Deckel ptotMax gilt, weil
 *    Datenblätter unterhalb 25 °C nicht mehr Leistung zulassen. ptotFormula liefert die reine Formel.
 *    margin = ptotAllowed − ptot (W), marginK = Tjmax − Tj (K). Ohne ptot: tj/margin null.
 *    Mit Kühlkörper (rthSA, optional rthCS): Rth = RthJC + RthCS + RthSA.
 *  - ledResistor(): E-Reihen-Werte werden AUFGERUNDET (nächster größerer Wert, schützt die LED);
 *    iActual gehört zu rE12, iActual24/iActual96 zu rE24/rE96; p = Verlustleistung im idealen
 *    Widerstand, pE12 im gerundeten.
 *  - eSeries(): 'nearest' bedeutet kleinster linearer Abstand, bei Gleichstand der größere Wert.
 *  - check(): Bedingungen in SI (Zahl) oder als Text mit Einheit ('50 mA') oder {value,unit} oder
 *    {min,max}. Schlüssel ohne Datenblatteintrag liefern ok:false, unknown:true. Ein Info-Eintrag
 *    key:'_hinweis' (ok:true, info:true) erinnert an "Absolute Maximum Ratings sind keine Betriebswerte",
 *    sobald eine Zeile nicht ok ist. Mit Bedingung ptot (und optional tAmb, Standard 25 °C) kommt
 *    zusätzlich der Eintrag key:'derating'.
 *  - worstCase(): Ausdrücke als Text (eigener sicherer Parser, kein eval) oder als Funktion.
 *    Bei bis zu 8 streuenden Größen werden die Stufen Min/Nenn/Max aller Kombinationen gerechnet,
 *    sonst nur Min/Max (bis 20 Größen). Exakt ist das für je Größe monotone Ausdrücke.
 *  - pick(): liefert nur die passenden Bauteile (Array, nach Passgenauigkeit sortiert); das Array
 *    trägt nicht aufzählbar .excluded und .all. pickAll() liefert alle mit match:true/false.
 *  - validate(): Fehler (errors) machen ok:false; Hinweise (warnings) nicht. Weniger als zwei
 *    Kennlinien, fehlender Tj bei elec, Pinzahl ≠ Gehäuseart sind nur Hinweise. Zusätzlich zu den in
 *    der Spezifikation genannten Gehäusearten sind 'to126' (BD139), 'do41' (1N4007) und 'led5' (LED 5 mm)
 *    erlaubt, weil dslib-semi.js sie nutzt; Einheit C (nC, µC) ist bekannt.
 *    Thermik: ptotMax ≈ (tjMax − 25)/rthJA mit 10 % Toleranz; rthJC darf nicht größer als rthJA sein.
 *  - glossary(): Einträge {en,de,note,cat,src}; src 'basis' oder Datenblatt-Id. Doppelte englische
 *    Begriffe werden zusammengeführt (erster Eintrag zählt, weitere Quellen in sources).
 *  - DS_LIB.add() validiert nicht, ignoriert Duplikat-Ids und ungültige Einträge, liefert true/false.
 */
(function () {
  'use strict';

  var root = (typeof window !== 'undefined') ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  var hasOwn = Object.prototype.hasOwnProperty;

  /* ------------------------------------------------------------------ Registry */
  if (!root.DS_LIB) {
    root.DS_LIB = {
      list: [], byId: {},
      add: function (ds) {
        if (!ds || typeof ds !== 'object' || typeof ds.id !== 'string' || !ds.id || ds.id === '__proto__') return false;
        if (hasOwn.call(this.byId, ds.id)) return false;
        this.byId[ds.id] = ds; this.list.push(ds); return true;
      }
    };
  }

  /* ------------------------------------------------------------------ Hilfen */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function isStr(x) { return typeof x === 'string' && x.trim() !== ''; }
  function isArr(x) { return Array.isArray(x); }
  function isObj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x); }
  function pow10(n) { return Math.pow(10, n); }
  function scale(v, e) { return e >= 0 ? v * pow10(e) : v / pow10(-e); }       // v · 10^e ohne Rundungsrauschen
  function nf(x) { return String(Number(Number(x).toPrecision(6))).replace('.', ','); }
  function clean(x) { return Number(Number(x).toPrecision(12)); }

  /* ------------------------------------------------------------------ Einheiten */
  var PREFIX = { p: -12, n: -9, 'µ': -6, 'μ': -6, u: -6, m: -3, k: 3, K: 3, M: 6, G: 9 };
  var BASES = ['Hz', 'V', 'A', 'W', 'Ω', 'F', 'H', 's', '°C', '%'];
  var BASES_EXT = BASES.concat(['S', 'K', 'dB', 'm', 'cd', 'lm', 'lx', '°', 'ppm', 'bit', 'LSB', 'SPS', 'Vrms', 'Vpp', 'Arms', 'Vp', 'dec', 'oct', 'in', 'mil', 'rpm', 'VA', 'dBm', 'baud', 'Bd', 'B', 'C']);
  var PREFIXABLE = { V: 1, A: 1, W: 1, 'Ω': 1, F: 1, H: 1, Hz: 1, s: 1, S: 1, C: 1 };
  var ALIAS = { ohm: 'Ω', Ohm: 'Ω', OHM: 'Ω', 'Ω': 'Ω', hz: 'Hz', HZ: 'Hz', degC: '°C', '℃': '°C', '°c': '°C' };

  function normUnit(u) { u = String(u).trim(); return hasOwn.call(ALIAS, u) ? ALIAS[u] : u; }

  // zerlegt 'mA' → {prefix:'m', exp:-3, base:'A'}; null wenn unbekannt
  function splitUnit(u, ext) {
    if (typeof u !== 'string') return null;
    u = normUnit(u);
    if (u === '') return { prefix: '', exp: 0, base: '' };
    var bases = ext ? BASES_EXT : BASES;
    if (bases.indexOf(u) >= 0) return { prefix: '', exp: 0, base: u };
    var c = u.charAt(0);
    if (hasOwn.call(PREFIX, c) && u.length > 1) {
      var rest = normUnit(u.slice(1));
      if (bases.indexOf(rest) >= 0 && rest !== '°C' && rest !== '%') return { prefix: c, exp: PREFIX[c], base: rest };
    }
    return null;
  }

  function unitValid(u) {
    if (typeof u !== 'string') return false;
    u = u.trim();
    if (u === '' || u === '-' || u === '–' || u === '—') return true;
    var parts = u.split(/[\/·]/);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim().replace(/^√/, '').replace(/[²³]$/, '').replace(/\^\d$/, '');
      if (p === '') return false;
      if (/^\d+$/.test(p)) continue;
      if (!splitUnit(p, true)) return false;
    }
    return true;
  }

  // Wert einer Datenblattzeile in SI (nach Vorsatz der Einheit)
  function toSI(v, unit) {
    if (!isNum(v)) return null;
    var s = splitUnit(unit, true);
    return s ? scale(v, s.exp) : v;
  }
  function siBaseOf(unit) { var s = splitUnit(unit, true); return s ? s.base : String(unit || ''); }

  function parseWithUnit(input) {
    try {
      if (isNum(input)) return { value: input, unit: '', text: String(input) };
      if (typeof input !== 'string') return null;
      var raw = input.trim();
      if (!raw) return null;
      var t = raw.replace(/ /g, ' ');
      // Platzhalter-Schreibweise: 4k7, 2R2, 4k7Ω
      var rk = /^([+\-−–]?)(\d+)([pnuµμmkKMGR])(\d+)\s*(Ω|ohm|Ohm|F|H|V|A)?$/.exec(t);
      if (rk) {
        var e = rk[3] === 'R' ? 0 : PREFIX[rk[3]];
        var val = scale(parseFloat(rk[2] + '.' + rk[4]), e);
        if (rk[1] === '-' || rk[1] === '−' || rk[1] === '–') val = -val;
        return { value: clean(val), unit: rk[5] ? normUnit(rk[5]) : '', text: raw };
      }
      var m = /^([+\-−–]?)([\d.,]+)(?:\s*[eE]([+\-−–]?\d+))?\s*(.*)$/.exec(t);
      if (!m) return null;
      var digits = m[2];
      var nd = (digits.match(/\./g) || []).length, nc = (digits.match(/,/g) || []).length;
      var ds = digits;
      if (nd && nc) {
        var dec = Math.max(digits.lastIndexOf('.'), digits.lastIndexOf(','));
        var thou = digits.charAt(dec) === '.' ? ',' : '.';
        ds = digits.slice(0, dec).split(thou).join('') + '.' + digits.slice(dec + 1);
        if (digits.slice(0, dec).indexOf(digits.charAt(dec)) >= 0) return null;
      } else if (nd + nc > 1) {
        var sep = nd ? '.' : ',';
        var g = digits.split(sep);
        for (var gi = 1; gi < g.length; gi++) if (g[gi].length !== 3) return null;
        ds = g.join('');
      } else if (nc === 1) ds = digits.replace(',', '.');
      if (!/^(\d+\.?\d*|\.\d+)$/.test(ds)) return null;
      var num = parseFloat(ds);
      if (m[3]) num = scale(num, parseInt(m[3].replace(/[−–]/, '-'), 10));
      if (m[1] === '-' || m[1] === '−' || m[1] === '–') num = -num;
      var rest = m[4].trim();
      var unit = '', exp = 0;
      if (rest) {
        var su = splitUnit(rest, false);
        if (su) { unit = su.base; exp = su.exp; }
        else if (hasOwn.call(PREFIX, rest) && rest.length === 1) { exp = PREFIX[rest]; }
        else return null;
      }
      var v = scale(num, exp);
      if (!isFinite(v)) return null;
      return { value: clean(v), unit: unit, text: raw };
    } catch (e) { return null; }
  }

  function parseValue(input) {
    var r = parseWithUnit(input);
    return r ? r.value : null;
  }

  // beliebige Eingabe → Zahl in SI (Zahl, Text, {value,unit}); sonst null
  function num(v) {
    if (isNum(v)) return v;
    if (typeof v === 'string') return parseValue(v);
    if (isObj(v) && isNum(v.value)) { var s = splitUnit(String(v.unit || ''), true); return s ? scale(v.value, s.exp) : v.value; }
    return null;
  }

  function fmt(value, unit, digits, opts) {
    try {
      var v = num(value);
      if (v === null) return '–';
      digits = isNum(digits) ? Math.max(1, Math.min(12, Math.round(digits))) : 3;
      var dot = !!(opts && opts.dot);
      unit = unit == null ? '' : String(unit);
      var su = splitUnit(unit, true);
      var base = su ? su.base : unit;
      if (su) v = scale(v, su.exp);
      var canPrefix = !su || base === '' || hasOwn.call(PREFIXABLE, base);
      if (!su) canPrefix = false;
      var sign = v < 0 ? '−' : '';
      var a = Math.abs(v), pfx = '', body;
      if (a === 0) body = '0';
      else {
        var idx = 0;
        if (canPrefix) {
          idx = Math.max(-4, Math.min(3, Math.floor(Math.floor(Math.log10(a)) / 3)));
          while (idx > -4 && scale(a, -3 * idx) < 1) idx--;
          while (idx < 3 && scale(a, -3 * idx) >= 1000) idx++;
          if (idx < 3 && Number(scale(a, -3 * idx).toPrecision(digits)) >= 1000) idx++;   // 999,96 → 1 k
          pfx = ['p', 'n', 'µ', 'm', '', 'k', 'M', 'G'][idx + 4];
        }
        var mm = Number(scale(a, -3 * idx).toPrecision(digits));
        body = String(mm);
        if (/e/i.test(body)) body = mm.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
      }
      if (!dot) body = body.replace('.', ',');
      var u = pfx + base;
      return sign + body + (u ? ' ' + u : '');
    } catch (e) { return '–'; }
  }

  /* ------------------------------------------------------------------ Kennlinien */
  function pointsOf(series) {
    var pts = isArr(series) ? series : (isObj(series) && isArr(series.points) ? series.points : null);
    if (!pts) return null;
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (isArr(p) && isNum(p[0]) && isNum(p[1])) out.push([p[0], p[1]]);
    }
    if (!out.length) return null;
    for (var j = 1; j < out.length; j++) if (out[j][0] < out[j - 1][0]) { out.sort(function (a, b) { return a[0] - b[0]; }); break; }
    return out;
  }
  function tf(scaleName) { return scaleName === 'log' ? function (v) { return Math.log10(v); } : function (v) { return v; }; }
  function itf(scaleName) { return scaleName === 'log' ? function (v) { return Math.pow(10, v); } : function (v) { return v; }; }

  function interp(series, x, opts) {
    try {
      opts = opts || {};
      var xv = num(x);
      if (xv === null) return null;
      var pts = pointsOf(series);
      if (!pts) return null;
      var xl = opts.xScale === 'log', yl = opts.yScale === 'log';
      var n = pts.length;
      if (xv < pts[0][0] || xv > pts[n - 1][0]) {
        if (opts.clamp) return xv < pts[0][0] ? pts[0][1] : pts[n - 1][1];
        if (!opts.extrapolate || n < 2) return null;
      }
      var i = 0;
      for (var k = 0; k < n; k++) if (pts[k][0] === xv) return pts[k][1];
      if (n < 2) return null;
      if (xv < pts[0][0]) i = 0;
      else if (xv > pts[n - 1][0]) i = n - 2;
      else { while (i < n - 2 && pts[i + 1][0] < xv) i++; }
      var x0 = pts[i][0], x1 = pts[i + 1][0], y0 = pts[i][1], y1 = pts[i + 1][1];
      if (x1 === x0) return y0;
      if (xl && (xv <= 0 || x0 <= 0 || x1 <= 0)) return null;
      if (yl && (y0 <= 0 || y1 <= 0)) return null;
      var tx = tf(xl ? 'log' : 'lin'), ty = tf(yl ? 'log' : 'lin'), iy = itf(yl ? 'log' : 'lin');
      var t = (tx(xv) - tx(x0)) / (tx(x1) - tx(x0));
      var y = iy(ty(y0) + t * (ty(y1) - ty(y0)));
      return isFinite(y) ? y : null;
    } catch (e) { return null; }
  }

  function seriesOf(graph, idx) {
    if (!isObj(graph) || !isArr(graph.series)) return null;
    if (typeof idx === 'string') {
      for (var i = 0; i < graph.series.length; i++) if (graph.series[i] && graph.series[i].name === idx) return graph.series[i];
      idx = parseInt(idx, 10);
    }
    if (idx === undefined || idx === null) idx = 0;
    if (!isNum(idx)) return null;
    return graph.series[idx] || null;
  }
  function gScales(graph) { return { xScale: graph && graph.xScale === 'log' ? 'log' : 'lin', yScale: graph && graph.yScale === 'log' ? 'log' : 'lin' }; }

  function readCurve(graph, seriesIdx, x, opts) {
    try {
      var s = seriesOf(graph, seriesIdx);
      if (!s) return null;
      var o = gScales(graph);
      if (opts) { o.clamp = opts.clamp; o.extrapolate = opts.extrapolate; }
      return interp(s, x, o);
    } catch (e) { return null; }
  }

  function monotone(pts) {
    var inc = true, dec = true;
    for (var i = 1; i < pts.length; i++) {
      if (!(pts[i][1] > pts[i - 1][1])) inc = false;
      if (!(pts[i][1] < pts[i - 1][1])) dec = false;
    }
    return inc || dec;
  }

  function inverseSeg(pts, y, g) {
    var xl = g.xScale === 'log', yl = g.yScale === 'log';
    for (var i = 0; i < pts.length - 1; i++) {
      var y0 = pts[i][1], y1 = pts[i + 1][1];
      if ((y >= Math.min(y0, y1)) && (y <= Math.max(y0, y1))) {
        if (y === y0) return pts[i][0];
        if (y === y1) return pts[i + 1][0];
        if (xl && (pts[i][0] <= 0 || pts[i + 1][0] <= 0)) return null;
        if (yl && (y <= 0 || y0 <= 0 || y1 <= 0)) return null;
        var ty = tf(g.yScale), tx = tf(g.xScale), ix = itf(g.xScale);
        var t = (ty(y) - ty(y0)) / (ty(y1) - ty(y0));
        var xr = ix(tx(pts[i][0]) + t * (tx(pts[i + 1][0]) - tx(pts[i][0])));
        return isFinite(xr) ? xr : null;
      }
    }
    return null;
  }

  function inverse(graph, seriesIdx, y) {
    try {
      var s = seriesOf(graph, seriesIdx), yv = num(y);
      if (!s || yv === null) return null;
      var pts = pointsOf(s);
      if (!pts || pts.length < 2 || !monotone(pts)) return null;
      return inverseSeg(pts, yv, gScales(graph));
    } catch (e) { return null; }
  }

  function crossings(graph, seriesIdx, y) {
    var out = [];
    try {
      var s = seriesOf(graph, seriesIdx), yv = num(y);
      if (!s || yv === null) return out;
      var pts = pointsOf(s);
      if (!pts || pts.length < 2) return out;
      var g = gScales(graph);
      for (var i = 0; i < pts.length - 1; i++) {
        var seg = [pts[i], pts[i + 1]];
        if (seg[0][1] === seg[1][1]) { if (seg[0][1] === yv && out.indexOf(seg[0][0]) < 0) out.push(seg[0][0]); continue; }
        var xr = inverseSeg(seg, yv, g);
        if (xr !== null && out.indexOf(xr) < 0) out.push(xr);
      }
    } catch (e) { /* leer */ }
    return out;
  }

  /* ------------------------------------------------------------------ Thermik */
  function tj(pd, rth, tAmb) {
    var p = num(pd), r = num(rth), t = tAmb === undefined ? 25 : num(tAmb);
    if (p === null || r === null || t === null) return null;
    return t + p * r;
  }

  function rthSum() {
    var args = [], sum = 0, n = 0;
    for (var i = 0; i < arguments.length; i++) {
      if (isArr(arguments[i])) args = args.concat(arguments[i]); else args.push(arguments[i]);
    }
    for (var j = 0; j < args.length; j++) {
      var v = num(args[j]);
      if (v === null) return null;
      sum += v; n++;
    }
    return n ? sum : null;
  }

  function derate(ds, cond) {
    var bad = function (msg) { return { ptotAllowed: null, tj: null, ok: false, margin: null, marginK: null, error: msg }; };
    try {
      cond = isObj(cond) ? cond : {};
      var th = ds && isObj(ds.thermal) ? ds.thermal : null;
      var tjMax = num(cond.tjMax !== undefined ? cond.tjMax : th && th.tjMax);
      var tAmb = cond.tAmb === undefined ? 25 : num(cond.tAmb);
      if (tAmb === null) return bad('Umgebungstemperatur (tAmb) ist keine gültige Zahl.');
      if (tjMax === null) return bad('Das Datenblatt nennt keine maximale Sperrschichttemperatur (tjMax).');
      var rth = null;
      if (cond.rthJA !== undefined) rth = num(cond.rthJA);
      else if (cond.rthSA !== undefined) {
        var jc = num(th && th.rthJC !== undefined ? th.rthJC : cond.rthJC);
        var sa = num(cond.rthSA), cs = cond.rthCS === undefined ? 0 : num(cond.rthCS);
        if (jc === null || sa === null || cs === null) return bad('Für die Rechnung mit Kühlkörper fehlen RthJC, RthCS oder RthSA.');
        rth = jc + cs + sa;
      } else rth = num(th && th.rthJA);
      if (rth === null || !(rth > 0)) return bad('Der Wärmewiderstand (RthJA) fehlt oder ist nicht größer als 0.');
      var formula = Math.max(0, (tjMax - tAmb) / rth);
      var ptotMax = th ? num(th.ptotMax) : null;
      var allowed = (ptotMax !== null && ptotMax > 0) ? Math.min(formula, ptotMax) : formula;
      var out = { ptotAllowed: allowed, ptotFormula: formula, ptotRated: ptotMax, tj: null, ok: tAmb < tjMax, margin: null, marginK: null, rth: rth, tjMax: tjMax, tAmb: tAmb };
      if (cond.ptot !== undefined) {
        var p = num(cond.ptot);
        if (p === null || p < 0) return bad('Die Verlustleistung (ptot) ist keine gültige Zahl ≥ 0.');
        out.tj = tAmb + p * rth;
        out.margin = allowed - p;
        out.marginK = tjMax - out.tj;
        out.ok = out.tj <= tjMax && p <= allowed + 1e-12;
      }
      return out;
    } catch (e) { return bad('Interner Fehler bei der Thermikrechnung.'); }
  }

  /* ------------------------------------------------------------------ E-Reihen */
  var E = {
    E3: [1.0, 2.2, 4.7],
    E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
    E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
    E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
    E96: [1.00, 1.02, 1.05, 1.07, 1.10, 1.13, 1.15, 1.18, 1.21, 1.24, 1.27, 1.30, 1.33, 1.37, 1.40, 1.43, 1.47, 1.50, 1.54, 1.58,
      1.62, 1.65, 1.69, 1.74, 1.78, 1.82, 1.87, 1.91, 1.96, 2.00, 2.05, 2.10, 2.15, 2.21, 2.26, 2.32, 2.37, 2.43, 2.49, 2.55,
      2.61, 2.67, 2.74, 2.80, 2.87, 2.94, 3.01, 3.09, 3.16, 3.24, 3.32, 3.40, 3.48, 3.57, 3.65, 3.74, 3.83, 3.92, 4.02, 4.12,
      4.22, 4.32, 4.42, 4.53, 4.64, 4.75, 4.87, 4.99, 5.11, 5.23, 5.36, 5.49, 5.62, 5.76, 5.90, 6.04, 6.19, 6.34, 6.49, 6.65,
      6.81, 6.98, 7.15, 7.32, 7.50, 7.68, 7.87, 8.06, 8.25, 8.45, 8.66, 8.87, 9.09, 9.31, 9.53, 9.76]
  };

  function eSeries(series, value, mode) {
    try {
      var name = String(series || '').toUpperCase();
      var tab = hasOwn.call(E, name) ? E[name] : null;
      var v = num(value);
      if (!tab || v === null || !(v > 0)) return null;
      mode = mode || 'nearest';
      var dec = Math.floor(Math.log10(v));
      var mant = v / pow10(dec);
      if (mant < 1) { mant *= 10; dec--; }
      if (mant >= 10) { mant /= 10; dec++; }
      var cands = tab.concat([10]);
      var best = null;
      if (mode === 'up') {
        for (var i = 0; i < cands.length; i++) if (cands[i] >= mant * (1 - 1e-9)) { best = cands[i]; break; }
      } else if (mode === 'down') {
        for (var j = cands.length - 1; j >= 0; j--) if (cands[j] <= mant * (1 + 1e-9)) { best = cands[j]; break; }
      } else if (mode === 'nearest') {
        var bd = Infinity;
        for (var k = 0; k < cands.length; k++) {
          var d = Math.abs(cands[k] - mant);
          if (d < bd - 1e-12 || (Math.abs(d - bd) <= 1e-12 && cands[k] > best)) { bd = d; best = cands[k]; }
        }
      } else return null;
      if (best === null) return null;
      return clean(best * pow10(dec));
    } catch (e) { return null; }
  }

  function ledResistor(uSupply, uF, iF) {
    var bad = function (msg) { return { r: null, rE12: null, rE24: null, rE96: null, p: null, iActual: null, error: msg }; };
    try {
      var us = num(uSupply), uf = num(uF), i = num(iF);
      if (us === null || uf === null || i === null) return bad('Versorgungsspannung, LED-Spannung und LED-Strom müssen Zahlen sein.');
      if (!(i > 0)) return bad('Der LED-Strom muss größer als 0 sein.');
      if (!(us > uf)) return bad('Die Versorgungsspannung muss größer sein als die Flussspannung der LED, sonst fließt kein Strom.');
      var r = (us - uf) / i;
      var r12 = eSeries('E12', r, 'up'), r24 = eSeries('E24', r, 'up'), r96 = eSeries('E96', r, 'up');
      return {
        r: r, rE12: r12, rE24: r24, rE96: r96,
        p: i * i * r, iActual: (us - uf) / r12, iActual24: (us - uf) / r24, iActual96: (us - uf) / r96,
        pE12: Math.pow((us - uf) / r12, 2) * r12, uR: us - uf
      };
    } catch (e) { return bad('Interner Fehler bei der Vorwiderstandsrechnung.'); }
  }

  /* ------------------------------------------------------------------ Toleranz / Worst Case */
  function tolPair(tol) {
    // → [minusPct, plusPct] oder null
    if (tol === undefined || tol === null) return [0, 0];
    if (isArr(tol) && tol.length === 2) { var a = num(tol[0]), b = num(tol[1]); return a === null || b === null ? null : [Math.abs(a), Math.abs(b)]; }
    if (isObj(tol)) { var m = num(tol.minus), p = num(tol.plus); return m === null || p === null ? null : [Math.abs(m), Math.abs(p)]; }
    var t = typeof tol === 'string' ? parseValue(tol) : tol;
    if (!isNum(t)) return null;
    return [Math.abs(t), Math.abs(t)];
  }

  function tolerance(value, tolPct) {
    try {
      var v = num(value), tp = tolPair(tolPct);
      if (v === null || !tp) return null;
      var a = v * (1 - tp[0] / 100), b = v * (1 + tp[1] / 100);
      var lo = Math.min(a, b), hi = Math.max(a, b);
      return { nom: v, min: lo, max: hi, tolPct: tp[0] === tp[1] ? tp[0] : null, minusPct: tp[0], plusPct: tp[1], absMinus: v - lo, absPlus: hi - v };
    } catch (e) { return null; }
  }

  // kleiner, sicherer Ausdrucksparser (kein eval)
  var FUNCS = {
    sqrt: Math.sqrt, abs: Math.abs, ln: Math.log, log: Math.log10, log10: Math.log10, exp: Math.exp,
    sin: Math.sin, cos: Math.cos, tan: Math.tan, atan: Math.atan, min: Math.min, max: Math.max, pow: Math.pow, floor: Math.floor, ceil: Math.ceil, round: Math.round
  };
  var CONSTS = { pi: Math.PI, PI: Math.PI };

  function compileExpr(src) {
    var s = String(src), i = 0, toks = [], names = [];
    while (i < s.length) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      var rest = s.slice(i), m;
      if (/[0-9.]/.test(c)) {
        m = /^(\d+\.?\d*|\.\d+)(?:[eE][+\-]?\d+)?/.exec(rest);
        if (!m) throw new Error('Ungültige Zahl im Ausdruck.');
        toks.push({ t: 'n', v: parseFloat(m[0]) }); i += m[0].length; continue;
      }
      if (/[A-Za-zµΩ_]/.test(c)) {
        m = /^[A-Za-z_µΩ][A-Za-z0-9_µΩ]*/.exec(rest);
        toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue;
      }
      if (c === '·' || c === '×') { toks.push({ t: '*' }); i++; continue; }
      if (c === '−' || c === '–') { toks.push({ t: '-' }); i++; continue; }
      if ('+-*/^(),'.indexOf(c) >= 0) { toks.push({ t: c }); i++; continue; }
      throw new Error("Unerlaubtes Zeichen '" + c + "' im Ausdruck.");
    }
    var p = 0;
    function peek() { return toks[p] ? toks[p].t : null; }
    function eat(t) { if (peek() !== t) throw new Error("Im Ausdruck fehlt '" + t + "'."); p++; }
    function expr() {
      var l = term();
      while (peek() === '+' || peek() === '-') { var op = toks[p++].t, r = term(); l = bin(op, l, r); }
      return l;
    }
    function term() {
      var l = unary();
      while (peek() === '*' || peek() === '/') { var op = toks[p++].t, r = unary(); l = bin(op, l, r); }
      return l;
    }
    function unary() {
      if (peek() === '-') { p++; var u = unary(); return function (e) { return -u(e); }; }
      if (peek() === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      var b = atom();
      if (peek() === '^') { p++; var x = unary(); return function (e) { return Math.pow(b(e), x(e)); }; }
      return b;
    }
    function atom() {
      var t = toks[p];
      if (!t) throw new Error('Der Ausdruck endet unerwartet.');
      if (t.t === 'n') { p++; var v = t.v; return function () { return v; }; }
      if (t.t === '(') { p++; var inner = expr(); eat(')'); return inner; }
      if (t.t === 'id') {
        p++;
        if (peek() === '(') {
          if (!hasOwn.call(FUNCS, t.v)) throw new Error("Unbekannte Funktion '" + t.v + "'.");
          p++;
          var args = [];
          if (peek() !== ')') { args.push(expr()); while (peek() === ',') { p++; args.push(expr()); } }
          eat(')');
          var f = FUNCS[t.v];
          return function (e) { return f.apply(null, args.map(function (a) { return a(e); })); };
        }
        if (hasOwn.call(CONSTS, t.v)) { var cv = CONSTS[t.v]; return function () { return cv; }; }
        if (names.indexOf(t.v) < 0) names.push(t.v);
        var nm = t.v;
        return function (e) { return e[nm]; };
      }
      throw new Error("Unerwartetes Zeichen '" + t.t + "' im Ausdruck.");
    }
    function bin(op, l, r) {
      switch (op) {
        case '+': return function (e) { return l(e) + r(e); };
        case '-': return function (e) { return l(e) - r(e); };
        case '*': return function (e) { return l(e) * r(e); };
        default: return function (e) { return l(e) / r(e); };
      }
    }
    var f = expr();
    if (p < toks.length) throw new Error('Der Ausdruck enthält überzählige Zeichen.');
    return { f: f, names: names };
  }

  function varRange(spec) {
    if (isNum(spec)) return { min: spec, nom: spec, max: spec };
    if (typeof spec === 'string') { var v = parseValue(spec); return v === null ? null : { min: v, nom: v, max: v }; }
    if (!isObj(spec)) return null;
    var nom = num(spec.nom !== undefined ? spec.nom : (spec.value !== undefined ? spec.value : spec.typ));
    if (spec.min !== undefined || spec.max !== undefined) {
      var mn = num(spec.min), mx = num(spec.max);
      if (mn === null || mx === null) return null;
      if (mn > mx) { var t = mn; mn = mx; mx = t; }
      return { min: mn, nom: nom === null ? (mn + mx) / 2 : nom, max: mx };
    }
    if (nom === null) return null;
    if (spec.absTol !== undefined) { var at = num(spec.absTol); if (at === null) return null; return { min: nom - Math.abs(at), nom: nom, max: nom + Math.abs(at) }; }
    var tp = tolPair(spec.tolMinus !== undefined || spec.tolPlus !== undefined ? [spec.tolMinus || 0, spec.tolPlus || 0] : spec.tol);
    if (!tp) return null;
    var a = nom * (1 - tp[0] / 100), b = nom * (1 + tp[1] / 100);
    return { min: Math.min(a, b), nom: nom, max: Math.max(a, b) };
  }

  function worstCase(expr, vars) {
    var bad = function (msg) { return { ok: false, nom: null, min: null, max: null, error: msg }; };
    try {
      if (!isObj(vars)) return bad('Die Größen (vars) müssen als Objekt angegeben werden.');
      var f, names;
      if (typeof expr === 'function') { f = expr; names = Object.keys(vars); }
      else if (typeof expr === 'string' && expr.trim()) {
        var c = compileExpr(expr); f = c.f; names = c.names;
        for (var q = 0; q < names.length; q++) if (!hasOwn.call(vars, names[q])) return bad("Für '" + names[q] + "' wurde kein Wert angegeben.");
      } else return bad('Der Ausdruck fehlt.');
      var keys = Object.keys(vars), ranges = {}, varying = [], nomEnv = {};
      for (var i = 0; i < keys.length; i++) {
        var rg = varRange(vars[keys[i]]);
        if (!rg) return bad("Der Wert von '" + keys[i] + "' ist ungültig.");
        ranges[keys[i]] = rg; nomEnv[keys[i]] = rg.nom;
        if (rg.max > rg.min && (typeof expr === 'function' || names.indexOf(keys[i]) >= 0)) varying.push(keys[i]);
      }
      if (varying.length > 20) return bad('Zu viele streuende Größen (höchstens 20).');
      var levels = varying.length <= 8 ? 3 : 2;
      var nom = f(Object.assign({}, nomEnv));
      if (!isNum(nom)) return bad('Der Ausdruck liefert für die Nennwerte keinen endlichen Wert (Division durch 0?).');
      var lo = nom, hi = nom, loAt = Object.assign({}, nomEnv), hiAt = Object.assign({}, nomEnv);
      var total = Math.pow(levels, varying.length);
      for (var n = 0; n < total; n++) {
        var env = Object.assign({}, nomEnv), k = n;
        for (var j = 0; j < varying.length; j++) {
          var lev = k % levels; k = Math.floor(k / levels);
          var r = ranges[varying[j]];
          env[varying[j]] = levels === 3 ? [r.min, r.nom, r.max][lev] : [r.min, r.max][lev];
        }
        var y = f(Object.assign({}, env));
        if (!isNum(y)) return bad('Der Ausdruck liefert für eine Kombination keinen endlichen Wert (Division durch 0?).');
        if (y < lo) { lo = y; loAt = env; }
        if (y > hi) { hi = y; hiAt = env; }
      }
      return {
        ok: true, nom: nom, min: lo, max: hi,
        minusPct: nom !== 0 ? (nom - lo) / Math.abs(nom) * 100 : null, plusPct: nom !== 0 ? (hi - nom) / Math.abs(nom) * 100 : null,
        minAt: loAt, maxAt: hiAt, combos: total
      };
    } catch (e) { return bad(e && e.message ? e.message : 'Fehler im Ausdruck.'); }
  }

  function divider(uIn, r1, r2, tolR1, tolR2, tolUin) {
    try {
      return worstCase('u*r2/(r1+r2)', {
        u: { nom: uIn, tol: tolUin || 0 }, r1: { nom: r1, tol: tolR1 || 0 }, r2: { nom: r2, tol: tolR2 || 0 }
      });
    } catch (e) { return { ok: false, nom: null, min: null, max: null, error: 'Fehler beim Spannungsteiler.' }; }
  }

  /* ------------------------------------------------------------------ Grenzwerte prüfen */
  var HINT_ABS = 'Absolute Maximum Ratings sind keine Betriebswerte: Sie dürfen nie überschritten und auch nicht als Arbeitspunkt gewählt werden. Entwirf immer innerhalb der Recommended Operating Conditions und plane Reserve ein.';

  function lc(s) { return String(s).toLowerCase(); }
  function entriesFor(ds, section, key) {
    var out = [], arr = ds && isArr(ds[section]) ? ds[section] : [];
    for (var i = 0; i < arr.length; i++) if (arr[i] && typeof arr[i].key === 'string' && lc(arr[i].key) === lc(key)) out.push(arr[i]);
    return out;
  }
  function limSI(e) {
    return { min: isNum(e.min) ? toSI(e.min, e.unit) : null, max: isNum(e.max) ? toSI(e.max, e.unit) : null };
  }
  function fmtLim(v, e) { return fmt(v, siBaseOf(e.unit), 3); }
  function rangeText(e) {
    var l = limSI(e);
    if (l.min !== null && l.max !== null) return fmtLim(l.min, e) + ' … ' + fmtLim(l.max, e);
    if (l.max !== null) return 'max. ' + fmtLim(l.max, e);
    if (l.min !== null) return 'min. ' + fmtLim(l.min, e);
    return 'keine Angabe';
  }
  function condRange(v) {
    if (isObj(v) && (v.min !== undefined || v.max !== undefined)) {
      var a = num(v.min), b = num(v.max);
      if (a === null || b === null) return null;
      return { lo: Math.min(a, b), hi: Math.max(a, b) };
    }
    var n = num(v);
    return n === null ? null : { lo: n, hi: n };
  }
  function condText(r, e) {
    var base = siBaseOf(e.unit);
    return r.lo === r.hi ? fmt(r.lo, base, 3) : fmt(r.lo, base, 3) + ' … ' + fmt(r.hi, base, 3);
  }

  function check(ds, conditions) {
    try {
      if (!isObj(ds)) return [{ key: '_fehler', ok: false, text: 'Kein gültiges Datenblatt übergeben.' }];
      if (!isObj(conditions)) return [{ key: '_fehler', ok: false, text: 'Die Betriebsbedingungen müssen als Objekt angegeben werden, z. B. { vceo: 30, ic: 0.05 }.' }];
      var out = [], anyBad = false, keys = Object.keys(conditions);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i], cv = conditions[key];
        if (lc(key) === 'tamb' && !entriesFor(ds, 'abs', key).length && !entriesFor(ds, 'rec', key).length) {
          var tr = condRange(cv);
          if (ds.thermal && tr && isNum(ds.thermal.tjMax) && tr.hi >= ds.thermal.tjMax) {
            out.push({ key: key, ok: false, level: 'fail', text: 'Die Umgebungstemperatur ' + fmt(tr.hi, '°C') + ' erreicht oder übersteigt die maximale Sperrschichttemperatur ' + fmt(ds.thermal.tjMax, '°C') + '. Das Bauteil kann so nicht betrieben werden.' });
            anyBad = true;
          } else if (tr) out.push({ key: key, ok: true, level: 'ok', text: 'Umgebungstemperatur ' + fmt(tr.hi, '°C') + ' liegt unter Tjmax; das Datenblatt nennt keinen eigenen Eintrag dafür.' });
          else { out.push({ key: key, ok: false, level: 'fail', text: 'Der Wert für ' + key + ' ist keine gültige Zahl.' }); anyBad = true; }
          continue;
        }
        var ab = entriesFor(ds, 'abs', key), rc = entriesFor(ds, 'rec', key);
        if (!ab.length && !rc.length) {
          if (lc(key) === 'ptot' || lc(key) === 'tamb') { if (lc(key) === 'ptot') continue; }
          out.push({ key: key, ok: false, unknown: true, level: 'unknown', text: "Zu '" + key + "' gibt es im Datenblatt keine Grenzwerte (weder Absolute Maximum Ratings noch Recommended Operating Conditions)." });
          anyBad = true; continue;
        }
        var r = condRange(cv);
        var ref = ab[0] || rc[0];
        if (!r) { out.push({ key: key, ok: false, level: 'fail', text: "Der Wert für '" + key + "' ist keine gültige Zahl oder Größe mit Einheit." }); anyBad = true; continue; }
        var sym = ref.sym || ref.key, vt = condText(r, ref);
        var failMsg = null, warnMsg = null, notes = [];
        ab.forEach(function (e) {
          var l = limSI(e);
          if (l.max !== null && r.hi > l.max * (1 + 1e-12)) failMsg = failMsg || (sym + ' = ' + vt + ' überschreitet das Absolute Maximum Rating (max. ' + fmtLim(l.max, e) + '). Das Bauteil kann dauerhaft geschädigt oder zerstört werden.');
          else if (l.min !== null && r.lo < l.min * (l.min >= 0 ? 1 : 1) - 1e-12 && r.lo < l.min) failMsg = failMsg || (sym + ' = ' + vt + ' unterschreitet das Absolute Maximum Rating (min. ' + fmtLim(l.min, e) + '). Das Bauteil kann dauerhaft geschädigt oder zerstört werden.');
          else if (l.max !== null && l.max > 0 && r.hi >= 0.9 * l.max) notes.push('Achtung: weniger als 10 % Reserve zum Grenzwert (max. ' + fmtLim(l.max, e) + ').');
        });
        rc.forEach(function (e) {
          var l = limSI(e);
          if (l.max !== null && r.hi > l.max * (1 + 1e-12)) warnMsg = warnMsg || (sym + ' = ' + vt + ' liegt über dem empfohlenen Betriebsbereich (' + rangeText(e) + ').');
          else if (l.min !== null && r.lo < l.min - 1e-12) warnMsg = warnMsg || (sym + ' = ' + vt + ' liegt unter dem empfohlenen Betriebsbereich (' + rangeText(e) + ').');
        });
        if (lc(key) === 'ptot' && ab.length) notes.push('Ptot gilt nur bei 25 °C; bei höherer Umgebungstemperatur musst du reduzieren (Derating).');
        if (failMsg) {
          out.push({ key: key, ok: false, level: 'fail', text: failMsg });
          anyBad = true;
        } else if (warnMsg) {
          out.push({ key: key, ok: false, level: 'warn', text: warnMsg + ' Das ist zwar noch unter dem Absolute Maximum Rating, aber kein zulässiger Arbeitsbereich: Die Kenndaten sind dort nicht garantiert. Absolute Maximum Ratings sind keine Betriebswerte.' });
          anyBad = true;
        } else if (rc.length) {
          out.push({ key: key, ok: true, level: 'ok', text: sym + ' = ' + vt + ' liegt im empfohlenen Betriebsbereich (' + rangeText(rc[0]) + ').' + (notes.length ? ' ' + notes.join(' ') : '') });
        } else {
          out.push({ key: key, ok: true, level: 'ok', text: sym + ' = ' + vt + ' liegt innerhalb der Absolute Maximum Ratings (' + rangeText(ab[0]) + '). Das Datenblatt nennt dazu keinen empfohlenen Betriebsbereich; Absolute Maximum Ratings sind keine Betriebswerte, lass also Reserve.' + (notes.length ? ' ' + notes.join(' ') : '') });
        }
      }
      // Derating bei gegebener Verlustleistung
      var pk = null, ta = null;
      keys.forEach(function (k) { if (lc(k) === 'ptot') pk = k; if (lc(k) === 'tamb') ta = k; });
      if (pk !== null && isObj(ds.thermal)) {
        var pr = condRange(conditions[pk]);
        var d = pr ? derate(ds, { tAmb: ta !== null ? (condRange(conditions[ta]) || { hi: 25 }).hi : 25, ptot: pr.hi }) : null;
        if (!pr) { /* schon oben nicht lesbar */ }
        else if (d && d.error) { out.push({ key: 'derating', ok: false, level: 'fail', text: d.error }); anyBad = true; }
        else if (d) {
          var tx = fmt(d.tAmb, '°C');
          if (d.ok) out.push({ key: 'derating', ok: true, level: 'ok', text: 'Bei Tamb = ' + tx + ' sind höchstens ' + fmt(d.ptotAllowed, 'W') + ' zulässig; Tj = ' + fmt(d.tj, '°C') + ' liegt unter Tjmax = ' + fmt(d.tjMax, '°C') + '.' });
          else { out.push({ key: 'derating', ok: false, level: 'fail', text: 'Bei Tamb = ' + tx + ' sind nur ' + fmt(d.ptotAllowed, 'W') + ' zulässig. Mit ' + fmt(pr.hi, 'W') + ' wird Tj = ' + fmt(d.tj, '°C') + ' und überschreitet Tjmax = ' + fmt(d.tjMax, '°C') + '. Verlustleistung senken oder Kühlkörper einsetzen.' }); anyBad = true; }
        }
      }
      if (anyBad) out.push({ key: '_hinweis', ok: true, info: true, level: 'info', text: HINT_ABS });
      return out;
    } catch (e) { return [{ key: '_fehler', ok: false, text: 'Interner Fehler bei der Prüfung.' }]; }
  }

  /* ------------------------------------------------------------------ Bauteilwahl */
  var RESERVED = ['family', 'pkg', 'text', 'conditions', 'needMax', 'needMin', 'tAmb', 'ptot', 'voltage', 'current', 'allowAbs', 'limit'];
  var V_PRIO = ['vceo', 'vds', 'vrrm', 'vr', 'vin', 'vcc', 'vdd', 'vs', 'vsupply'];
  var I_PRIO = ['ic', 'id', 'if', 'io', 'iout', 'ifav', 'ioh', 'iol'];
  var PEAK_RE = /peak|pulse|surge|repetitive|spitze|impuls|stoß|stoss/i;
  var PEAK_KEY = /^(icm|idm|ifrm|ifsm|ifm|itsm|ipk|isurge)/i;

  function mainRating(ds, baseUnit, prio) {
    var ab = isArr(ds.abs) ? ds.abs : [], i, j, e;
    for (j = 0; j < prio.length; j++) {
      for (i = 0; i < ab.length; i++) {
        e = ab[i];
        if (e && typeof e.key === 'string' && lc(e.key) === prio[j] && siBaseOf(e.unit) === baseUnit && isNum(e.max)) return { key: e.key, sym: e.sym || e.key, val: toSI(e.max, e.unit), e: e };
      }
    }
    var best = null;
    for (i = 0; i < ab.length; i++) {
      e = ab[i];
      if (!e || siBaseOf(e.unit) !== baseUnit || !isNum(e.max) || !(e.max > 0)) continue;
      if (PEAK_RE.test(String(e.param || '') + ' ' + String(e.cond || '') + ' ' + String(e.note || '')) || PEAK_KEY.test(String(e.key || ''))) continue;
      var v = toSI(e.max, e.unit);
      if (!best || v > best.val) best = { key: e.key, sym: e.sym || e.key, val: v, e: e };
    }
    return best;
  }

  function normPkg(s) { return String(s || '').toLowerCase().replace(/[\s\-_]/g, ''); }
  function asList(x) { return isArr(x) ? x : (x === undefined || x === null || x === '' ? [] : [x]); }

  function evalPart(ds, req) {
    var reasons = [], excl = [], score = 0, used = 0;
    var part = ds.part || ds.id || '?';
    var needCheck = function (ok, okText, badText, sc) {
      used++;
      if (ok) { reasons.push(okText); if (isNum(sc) && isFinite(sc)) score += sc; }
      else excl.push(badText);
    };
    var fams = asList(req.family);
    if (fams.length) {
      var f = lc(ds.family || '');
      var hit = fams.some(function (x) { return f.indexOf(lc(x)) >= 0 || lc(ds.id || '').indexOf(lc(x)) >= 0; });
      needCheck(hit, 'Bauteilfamilie passt: ' + (ds.family || '?') + '.', 'Falsche Familie (' + (ds.family || 'unbekannt') + ', gesucht: ' + fams.join(' / ') + ').');
    }
    var pkgs = asList(req.pkg);
    if (pkgs.length) {
      var cands = [ds.pins && ds.pins.pkg, ds.pkgDraw && ds.pkgDraw.name, ds.pkgDraw && ds.pkgDraw.kind].filter(isStr).map(normPkg);
      var ph = pkgs.some(function (p) { var n = normPkg(p); return n && cands.some(function (c) { return c.indexOf(n) >= 0 || n.indexOf(c) >= 0; }); });
      needCheck(ph, 'Gehäuse passt: ' + ((ds.pins && ds.pins.pkg) || (ds.pkgDraw && ds.pkgDraw.name) || '?') + '.',
        'Gehäuse ' + ((ds.pins && ds.pins.pkg) || 'unbekannt') + ' passt nicht zu ' + pkgs.join(' / ') + '.');
    }
    if (isStr(req.text)) {
      var hay = lc([ds.id, ds.part, ds.ref, ds.title, ds.desc].concat(isArr(ds.features) ? ds.features : []).join(' '));
      needCheck(hay.indexOf(lc(req.text)) >= 0, 'Stichwort "' + req.text + '" kommt im Datenblatt vor.', 'Stichwort "' + req.text + '" kommt im Datenblatt nicht vor.');
    }
    if (req.voltage !== undefined) {
      var vn = num(req.voltage);
      if (vn === null) excl.push('Die geforderte Spannung ist keine gültige Zahl.');
      else {
        var mr = mainRating(ds, 'V', V_PRIO);
        if (!mr) needCheck(false, '', 'Das Datenblatt nennt keine Spannungsgrenze.');
        else needCheck(mr.val >= vn, 'Spannung ' + fmt(vn, 'V') + ' ist machbar: ' + mr.sym + ' max. ' + fmt(mr.val, 'V') + '.',
          'Spannungsfestigkeit zu klein: ' + mr.sym + ' max. ' + fmt(mr.val, 'V') + ', gefordert ' + fmt(vn, 'V') + '.', Math.log(mr.val / Math.max(vn, 1e-12)));
      }
    }
    if (req.current !== undefined) {
      var cn = num(req.current);
      if (cn === null) excl.push('Der geforderte Strom ist keine gültige Zahl.');
      else {
        var ci = mainRating(ds, 'A', I_PRIO);
        if (!ci) needCheck(false, '', 'Das Datenblatt nennt keine Stromgrenze.');
        else needCheck(ci.val >= cn, 'Strom ' + fmt(cn, 'A') + ' ist machbar: ' + ci.sym + ' max. ' + fmt(ci.val, 'A') + '.',
          'Strombelastbarkeit zu klein: ' + ci.sym + ' max. ' + fmt(ci.val, 'A') + ', gefordert ' + fmt(cn, 'A') + '.', Math.log(ci.val / Math.max(cn, 1e-12)));
      }
    }
    var flat = function (obj, kind) {
      if (!isObj(obj)) return;
      Object.keys(obj).forEach(function (k) {
        var need = num(obj[k]);
        if (need === null) { excl.push('Die Anforderung für ' + k + ' ist keine gültige Zahl.'); return; }
        var rc = entriesFor(ds, 'rec', k), ab = entriesFor(ds, 'abs', k);
        var e = null, side = kind === 'max' ? 'max' : 'min', lim = null;
        [rc, ab].forEach(function (arr) { arr.forEach(function (x) { if (lim === null && isNum(x[side])) { e = x; lim = toSI(x[side], x.unit); } }); });
        if (lim === null) {
          needCheck(false, '', 'Das Datenblatt nennt keinen ' + (kind === 'max' ? 'Höchstwert' : 'Mindestwert') + ' für ' + k + '.');
          return;
        }
        var sym = e.sym || e.key;
        if (kind === 'max') needCheck(lim >= need - 1e-12, sym + ' max. ' + fmt(lim, siBaseOf(e.unit)) + ' deckt die geforderten ' + fmt(need, siBaseOf(e.unit)) + ' ab.',
          sym + ' max. ' + fmt(lim, siBaseOf(e.unit)) + ' reicht nicht für ' + fmt(need, siBaseOf(e.unit)) + '.', lim > 0 && need > 0 ? Math.log(lim / need) : 0);
        else needCheck(lim <= need + 1e-12, sym + ' ab ' + fmt(lim, siBaseOf(e.unit)) + ' funktioniert bei ' + fmt(need, siBaseOf(e.unit)) + '.',
          sym + ' erst ab ' + fmt(lim, siBaseOf(e.unit)) + ' zulässig, gefordert sind ' + fmt(need, siBaseOf(e.unit)) + '.');
      });
    };
    flat(req.needMax, 'max'); flat(req.needMin, 'min');
    Object.keys(req).forEach(function (k) {
      if (RESERVED.indexOf(k) >= 0) return;
      if (entriesFor(ds, 'abs', k).length || entriesFor(ds, 'rec', k).length) { var o = {}; o[k] = req[k]; flat(o, 'max'); }
    });
    if (isObj(req.conditions)) {
      var res = check(ds, req.conditions);
      res.forEach(function (r) {
        if (r.info) return;
        used++;
        if (r.ok || (r.level === 'warn' && req.allowAbs)) reasons.push(r.text);
        else excl.push(r.text);
      });
    }
    if (req.tAmb !== undefined || req.ptot !== undefined) {
      var ta = req.tAmb === undefined ? 25 : req.tAmb;
      var dd = derate(ds, { tAmb: ta, ptot: req.ptot });
      used++;
      if (dd.error) excl.push(dd.error);
      else if (dd.ok) reasons.push(req.ptot !== undefined ? 'Bei ' + fmt(dd.tAmb, '°C') + ' sind ' + fmt(dd.ptotAllowed, 'W') + ' zulässig; ' + fmt(num(req.ptot), 'W') + ' bleiben mit Tj = ' + fmt(dd.tj, '°C') + ' unter Tjmax.' : 'Bei ' + fmt(dd.tAmb, '°C') + ' liegt die Umgebung unter Tjmax = ' + fmt(dd.tjMax, '°C') + '.');
      else excl.push(req.ptot !== undefined ? 'Thermisch nicht machbar: bei ' + fmt(dd.tAmb, '°C') + ' nur ' + fmt(dd.ptotAllowed, 'W') + ' zulässig (Tj wäre ' + fmt(dd.tj, '°C') + ', Tjmax ' + fmt(dd.tjMax, '°C') + ').' : 'Umgebungstemperatur ' + fmt(dd.tAmb, '°C') + ' ist nicht unter Tjmax = ' + fmt(dd.tjMax, '°C') + '.');
    }
    if (!used && !excl.length) reasons.push('Keine Anforderung angegeben, daher kommt das Bauteil in Frage.');
    return { id: ds.id, part: part, family: ds.family || '', ds: ds, match: excl.length === 0, score: score, reasons: reasons.filter(Boolean), excluded: excl.length ? excl.join(' ') : null, exclusions: excl };
  }

  function libOf(lib) {
    if (isArr(lib)) return lib;
    if (isObj(lib) && isArr(lib.list)) return lib.list;
    return root.DS_LIB && isArr(root.DS_LIB.list) ? root.DS_LIB.list : [];
  }

  function pickAll(lib, req) {
    var out = [];
    try {
      req = isObj(req) ? req : {};
      libOf(lib).forEach(function (ds) {
        if (!isObj(ds)) return;
        try { out.push(evalPart(ds, req)); }
        catch (e) { out.push({ id: ds.id, part: ds.part || ds.id, family: ds.family || '', ds: ds, match: false, score: 0, reasons: [], excluded: 'Das Datenblatt ließ sich nicht auswerten.', exclusions: ['Das Datenblatt ließ sich nicht auswerten.'] }); }
      });
    } catch (e) { /* leer */ }
    return out;
  }

  function pick(lib, req) {
    var all = pickAll(lib, req);
    var m = all.filter(function (r) { return r.match; });
    m.sort(function (a, b) { return a.score - b.score; });
    var x = all.filter(function (r) { return !r.match; });
    Object.defineProperty(m, 'excluded', { value: x, enumerable: false });
    Object.defineProperty(m, 'all', { value: all, enumerable: false });
    return m;
  }

  /* ------------------------------------------------------------------ Schema-Prüfung */
  var PIN_TYPES = ['in', 'out', 'pwr', 'gnd', 'io', 'nc'];
  var KINDS = ['to220', 'to92', 'dip8', 'dip14', 'soic8', 'sot23', 'sot223', 'do35', 'sod123', 'dip16', 'tssop16', 'qfn16', 'to126', 'do41', 'led5'];
  var KIND_PINS = { to220: 3, to92: 3, to126: 3, dip8: 8, dip14: 14, dip16: 16, soic8: 8, sot23: 3, sot223: 4, do35: 2, sod123: 2, tssop16: 16, qfn16: 16, do41: 2, led5: 2 };

  function validate(ds) {
    var errors = [], warnings = [];
    var E_ = function (m) { errors.push(m); }, W_ = function (m) { warnings.push(m); };
    try {
      if (!isObj(ds)) return { ok: false, errors: ['Das Datenblatt ist kein Objekt.'], warnings: warnings };
      var strReq = function (o, k, where) { if (!isStr(o[k])) E_(where + ': Pflichtfeld "' + k + '" fehlt oder ist leer.'); };

      // Kopf
      strReq(ds, 'id', 'Datenblatt');
      if (isStr(ds.id) && !/^[a-z0-9][a-z0-9_\-]*$/.test(ds.id)) E_('Datenblatt: Die id "' + ds.id + '" darf nur Kleinbuchstaben, Ziffern, - und _ enthalten.');
      ['part', 'family', 'mfr', 'title', 'desc'].forEach(function (k) { strReq(ds, k, 'Datenblatt'); });
      if (ds.lang !== 'en' && ds.lang !== 'de') E_('Datenblatt: "lang" muss "en" oder "de" sein.');
      if (ds.ref !== undefined && typeof ds.ref !== 'string') E_('Datenblatt: "ref" muss ein Text sein.');
      if (!isArr(ds.features) || !ds.features.length) E_('Datenblatt: "features" muss eine nicht leere Liste sein.');
      else ds.features.forEach(function (f, i) { if (!isStr(f)) E_('features[' + i + ']: Eintrag fehlt oder ist leer.'); });

      // Pins
      var nPins = 0;
      if (!isObj(ds.pins)) E_('Pins: Pflichtfeld "pins" fehlt.');
      else {
        if (!isStr(ds.pins.pkg)) E_('Pins: "pkg" fehlt.');
        if (!isArr(ds.pins.pins) || !ds.pins.pins.length) E_('Pins: Die Pinliste fehlt oder ist leer.');
        else {
          var seen = {}, maxN = 0;
          ds.pins.pins.forEach(function (p, i) {
            var w = 'pins[' + i + ']';
            if (!isObj(p)) { E_(w + ': Eintrag ist kein Objekt.'); return; }
            if (!Number.isInteger(p.n) || p.n < 1) E_(w + ': Pinnummer "n" muss eine ganze Zahl ≥ 1 sein.');
            else { if (seen[p.n]) E_(w + ': Pinnummer ' + p.n + ' kommt doppelt vor.'); seen[p.n] = true; if (p.n > maxN) maxN = p.n; }
            if (!isStr(p.name)) E_(w + ': Pinname fehlt.');
            if (PIN_TYPES.indexOf(p.type) < 0) E_(w + ': Pintyp "' + p.type + '" ist ungültig (erlaubt: ' + PIN_TYPES.join(', ') + ').');
            if (!isStr(p.desc)) E_(w + ': Pinbeschreibung "desc" fehlt.');
          });
          for (var q = 1; q <= maxN; q++) if (!seen[q]) E_('Pins: Pin ' + q + ' fehlt in der Nummerierung 1…' + maxN + '.');
          nPins = maxN;
        }
      }

      // Zeilenlisten
      var seenKeys;
      var rowCheck = function (name, arr, kind) {
        if (!isArr(arr) || !arr.length) { E_('Abschnitt "' + name + '" fehlt oder ist leer.'); return; }
        seenKeys = {};
        arr.forEach(function (r, i) {
          var w = name + '[' + i + ']' + (isObj(r) && isStr(r.key) ? ' (' + r.key + ')' : '');
          if (!isObj(r)) { E_(w + ': Eintrag ist kein Objekt.'); return; }
          if (!isStr(r.key)) E_(w + ': "key" fehlt.');
          else { if (seenKeys[r.key] && kind !== 'elec') W_(w + ': key kommt mehrfach vor.'); seenKeys[r.key] = true; }
          if (!isStr(r.param)) E_(w + ': "param" (Parameterbezeichnung) fehlt.');
          if (!isStr(r.sym)) W_(w + ': Formelzeichen "sym" fehlt.');
          if (typeof r.unit !== 'string') E_(w + ': Einheit "unit" fehlt.');
          else if (!unitValid(r.unit)) E_(w + ': Einheit "' + r.unit + '" ist unbekannt.');
          ['min', 'typ', 'max'].forEach(function (f) {
            if (r[f] !== undefined && r[f] !== null && !isNum(r[f])) E_(w + ': "' + f + '" muss eine Zahl oder null sein.');
          });
          if (kind !== 'elec' && r.typ !== undefined && r.typ !== null) W_(w + ': "typ" gehört nicht in diese Tabelle.');
          var has = ['min', 'typ', 'max'].filter(function (f) { return isNum(r[f]); });
          if (!has.length) E_(w + ': Mindestens einer der Werte min, typ, max muss angegeben sein.');
          if (kind !== 'elec' && !isNum(r.min) && !isNum(r.max)) E_(w + ': Mindestens min oder max muss angegeben sein.');
          if (isNum(r.min) && isNum(r.max) && r.min > r.max) E_(w + ': Min (' + nf(r.min) + ') ist größer als Max (' + nf(r.max) + ').');
          if (isNum(r.min) && isNum(r.typ) && r.min > r.typ) E_(w + ': Min (' + nf(r.min) + ') ist größer als Typ (' + nf(r.typ) + ').');
          if (isNum(r.typ) && isNum(r.max) && r.typ > r.max) E_(w + ': Typ (' + nf(r.typ) + ') ist größer als Max (' + nf(r.max) + ').');
          if (r.cond !== undefined && typeof r.cond !== 'string') E_(w + ': "cond" muss ein Text sein.');
          if (kind === 'elec') {
            if (r.tj === undefined) W_(w + ': Keine Temperatur "tj" angegeben.');
            else if (!isNum(r.tj)) E_(w + ': "tj" muss eine Zahl sein.');
          }
        });
      };
      rowCheck('abs', ds.abs, 'abs'); rowCheck('rec', ds.rec, 'rec'); rowCheck('elec', ds.elec, 'elec');

      // Konsistenz rec ⊆ abs
      if (isArr(ds.abs) && isArr(ds.rec)) {
        ds.rec.forEach(function (r, i) {
          if (!isObj(r) || !isStr(r.key)) return;
          entriesFor(ds, 'abs', r.key).forEach(function (a) {
            var rl = limSI(r), al = limSI(a);
            if (rl.max !== null && al.max !== null && rl.max > al.max * (1 + 1e-9)) E_('rec[' + i + '] (' + r.key + '): Empfohlener Höchstwert liegt über dem Absolute Maximum Rating.');
            if (rl.min !== null && al.min !== null && rl.min < al.min - Math.abs(al.min) * 1e-9) E_('rec[' + i + '] (' + r.key + '): Empfohlener Mindestwert liegt unter dem Absolute Maximum Rating.');
          });
        });
      }

      // Kennlinien
      if (!isArr(ds.graphs)) E_('Abschnitt "graphs" fehlt.');
      else {
        if (ds.graphs.length < 2) W_('Es sollten mindestens zwei Kennlinien oder Diagramme vorhanden sein.');
        var gids = {};
        ds.graphs.forEach(function (g, i) {
          var w = 'graphs[' + i + ']' + (isObj(g) && isStr(g.id) ? ' (' + g.id + ')' : '');
          if (!isObj(g)) { E_(w + ': Eintrag ist kein Objekt.'); return; }
          if (!isStr(g.id)) E_(w + ': "id" fehlt.'); else { if (gids[g.id]) E_(w + ': id kommt doppelt vor.'); gids[g.id] = true; }
          ['title', 'xLabel', 'yLabel'].forEach(function (k) { if (!isStr(g[k])) E_(w + ': "' + k + '" fehlt.'); });
          ['xUnit', 'yUnit'].forEach(function (k) {
            if (typeof g[k] !== 'string') E_(w + ': "' + k + '" fehlt.');
            else if (!unitValid(g[k])) E_(w + ': Einheit "' + g[k] + '" (' + k + ') ist unbekannt.');
          });
          ['xScale', 'yScale'].forEach(function (k) { if (g[k] !== 'lin' && g[k] !== 'log') E_(w + ': "' + k + '" muss "lin" oder "log" sein.'); });
          if (!isArr(g.series) || !g.series.length) { E_(w + ': Es ist keine Messreihe (series) vorhanden.'); return; }
          g.series.forEach(function (s, j) {
            var sw = w + ' Reihe ' + j;
            if (!isObj(s)) { E_(sw + ': kein Objekt.'); return; }
            if (!isStr(s.name)) E_(sw + ': "name" fehlt.');
            if (!isArr(s.points) || s.points.length < 2) { E_(sw + ': Mindestens zwei Punkte nötig.'); return; }
            var prev = -Infinity, okPts = true;
            s.points.forEach(function (p, k) {
              if (!isArr(p) || p.length !== 2 || !isNum(p[0]) || !isNum(p[1])) { E_(sw + ' Punkt ' + k + ': muss [x, y] mit Zahlen sein.'); okPts = false; return; }
              if (g.xScale === 'log' && !(p[0] > 0)) E_(sw + ' Punkt ' + k + ': x muss bei logarithmischer Achse > 0 sein.');
              if (g.yScale === 'log' && !(p[1] > 0)) E_(sw + ' Punkt ' + k + ': y muss bei logarithmischer Achse > 0 sein.');
              if (!(p[0] > prev)) E_(sw + ' Punkt ' + k + ': x (' + nf(p[0]) + ') ist nicht größer als der vorherige Wert; die Reihe muss in x aufsteigend sein.');
              prev = p[0];
            });
            void okPts;
          });
        });
      }

      // Thermik
      if (!isObj(ds.thermal)) E_('Abschnitt "thermal" fehlt.');
      else {
        var t = ds.thermal;
        if (!isNum(t.rthJA) || !(t.rthJA > 0)) E_('thermal: rthJA muss eine Zahl > 0 sein.');
        if (!isNum(t.tjMax)) E_('thermal: tjMax muss eine Zahl sein.');
        else if (t.tjMax <= 25) E_('thermal: tjMax (' + nf(t.tjMax) + ' °C) muss über 25 °C liegen.');
        if (t.rthJC !== undefined && (!isNum(t.rthJC) || !(t.rthJC > 0))) E_('thermal: rthJC muss eine Zahl > 0 sein.');
        if (t.ptotMax !== undefined && (!isNum(t.ptotMax) || !(t.ptotMax > 0))) E_('thermal: ptotMax muss eine Zahl > 0 sein.');
        if (isNum(t.rthJC) && isNum(t.rthJA) && t.rthJC > t.rthJA) E_('thermal: rthJC (' + nf(t.rthJC) + ' K/W) darf nicht größer als rthJA (' + nf(t.rthJA) + ' K/W) sein.');
        if (isNum(t.ptotMax) && isNum(t.rthJA) && t.rthJA > 0 && isNum(t.tjMax) && t.tjMax > 25) {
          var exp = (t.tjMax - 25) / t.rthJA;
          if (Math.abs(t.ptotMax - exp) > 0.1 * exp) E_('thermal: ptotMax (' + nf(t.ptotMax) + ' W) passt nicht zu (tjMax − 25)/rthJA = ' + nf(Number(exp.toPrecision(4))) + ' W (Toleranz 10 %).');
        }
        if (isArr(ds.abs) && isNum(t.ptotMax)) {
          entriesFor(ds, 'abs', 'ptot').forEach(function (a) {
            var l = limSI(a);
            if (l.max !== null && Math.abs(l.max - t.ptotMax) > 0.1 * t.ptotMax) W_('Ptot in abs (' + nf(l.max) + ' W) weicht von thermal.ptotMax (' + nf(t.ptotMax) + ' W) ab.');
          });
        }
      }

      // Gehäuse
      if (!isObj(ds.pkgDraw)) E_('Abschnitt "pkgDraw" fehlt.');
      else {
        var pd = ds.pkgDraw;
        if (!isStr(pd.name)) E_('pkgDraw: "name" fehlt.');
        if (KINDS.indexOf(pd.kind) < 0) E_('pkgDraw: Gehäuseart "' + pd.kind + '" ist unbekannt (erlaubt: ' + KINDS.join(', ') + ').');
        else if (nPins && KIND_PINS[pd.kind] !== nPins) W_('pkgDraw: Gehäuseart ' + pd.kind + ' hat üblicherweise ' + KIND_PINS[pd.kind] + ' Pins, im Datenblatt sind ' + nPins + ' aufgeführt.');
        if (!isArr(pd.dims) || !pd.dims.length) E_('pkgDraw: Maße (dims) fehlen.');
        else pd.dims.forEach(function (d, i) {
          var w = 'pkgDraw.dims[' + i + ']';
          if (!isObj(d)) { E_(w + ': kein Objekt.'); return; }
          if (!isStr(d.label)) E_(w + ': "label" fehlt.');
          if (typeof d.unit !== 'string' || !/^(mm|in|mil|µm|um|cm)$/.test(d.unit)) E_(w + ': Einheit muss eine Länge sein (mm, in, mil, µm).');
          ['min', 'max'].forEach(function (f) { if (d[f] !== undefined && d[f] !== null && !isNum(d[f])) E_(w + ': "' + f + '" muss eine Zahl sein.'); });
          if (!isNum(d.min) && !isNum(d.max)) E_(w + ': min oder max muss angegeben sein.');
          if (isNum(d.min) && isNum(d.max) && d.min > d.max) E_(w + ': Min (' + nf(d.min) + ') ist größer als Max (' + nf(d.max) + ').');
        });
      }

      // Anwendung, Bestellung, Glossar
      if (!isArr(ds.app) || !ds.app.length) E_('Abschnitt "app" (Anwendung) fehlt oder ist leer.');
      else ds.app.forEach(function (a, i) {
        var w = 'app[' + i + ']';
        if (!isObj(a)) { E_(w + ': kein Objekt.'); return; }
        if (!isStr(a.title)) E_(w + ': "title" fehlt.');
        if (!isStr(a.text)) E_(w + ': "text" fehlt.');
        ['circuit', 'formulas'].forEach(function (k) {
          if (a[k] !== undefined) {
            if (!isArr(a[k])) E_(w + ': "' + k + '" muss eine Liste von Texten sein.');
            else a[k].forEach(function (x, j) { if (typeof x !== 'string') E_(w + '.' + k + '[' + j + ']: muss ein Text sein.'); });
          }
        });
      });
      if (!isArr(ds.order) || !ds.order.length) E_('Abschnitt "order" (Bestellinformation) fehlt oder ist leer.');
      else ds.order.forEach(function (o, i) {
        if (!isObj(o) || !isStr(o.type)) E_('order[' + i + ']: "type" fehlt.');
        else if (!isStr(o.pkg)) E_('order[' + i + ']: "pkg" fehlt.');
      });
      if (!isArr(ds.glossary) || !ds.glossary.length) E_('Abschnitt "glossary" fehlt oder ist leer.');
      else {
        var ge = {};
        ds.glossary.forEach(function (g, i) {
          var w = 'glossary[' + i + ']';
          if (!isObj(g)) { E_(w + ': kein Objekt.'); return; }
          if (!isStr(g.en)) E_(w + ': "en" fehlt.');
          else { if (ge[lc(g.en)]) W_(w + ': Begriff "' + g.en + '" kommt doppelt vor.'); ge[lc(g.en)] = true; }
          if (!isStr(g.de)) E_(w + ': "de" fehlt.');
          if (g.note !== undefined && typeof g.note !== 'string') E_(w + ': "note" muss ein Text sein.');
        });
      }

      // Optional: timing
      if (ds.timing !== undefined) {
        if (!isArr(ds.timing)) E_('timing: muss eine Liste sein.');
        else ds.timing.forEach(function (t, i) {
          var w = 'timing[' + i + ']';
          if (!isObj(t)) { E_(w + ': kein Objekt.'); return; }
          if (!isStr(t.title)) E_(w + ': "title" fehlt.');
          if (!isArr(t.signals) || !t.signals.length) { E_(w + ': "signals" fehlt oder ist leer.'); return; }
          var len = null;
          t.signals.forEach(function (s, j) {
            var sw = w + '.signals[' + j + ']';
            if (!isObj(s)) { E_(sw + ': kein Objekt.'); return; }
            if (!isStr(s.name)) E_(sw + ': "name" fehlt.');
            if (typeof s.wave !== 'string' || !s.wave.length) { E_(sw + ': "wave" fehlt.'); return; }
            if (!/^[01xzXZ]+$/.test(s.wave)) E_(sw + ': "wave" darf nur die Zeichen 0, 1, x und z enthalten.');
            if (len === null) len = s.wave.length;
            else if (s.wave.length !== len) E_(sw + ': Alle Signale eines Zeitdiagramms müssen gleich lang sein (' + len + ' Zeichen).');
          });
        });
      }

      // Optional: regs
      if (ds.regs !== undefined) {
        if (!isArr(ds.regs)) E_('regs: muss eine Liste sein.');
        else ds.regs.forEach(function (r, i) {
          var w = 'regs[' + i + ']';
          if (!isObj(r)) { E_(w + ': kein Objekt.'); return; }
          if (!isStr(r.addr) || !/^(0x[0-9a-fA-F]+|\d+|[0-9a-fA-F]+h|0b[01]+)$/.test(r.addr.trim())) E_(w + ': Adresse "addr" fehlt oder ist ungültig (z. B. "0x20").');
          if (!isStr(r.name)) E_(w + ': "name" fehlt.');
          if (typeof r.bits !== 'string' || !/^\d+(:\d+)?$/.test(r.bits)) E_(w + ': "bits" muss wie "7:0" oder "3" aussehen.');
          else { var bp = r.bits.split(':').map(Number); if (bp.length === 2 && bp[0] < bp[1]) E_(w + ': "bits" muss absteigend sein (hohes Bit zuerst).'); if (bp[0] > 63) E_(w + ': Bitnummer zu groß.'); }
          if (!isStr(r.rw) || !/^(R|W|RW|R\/W|RO|WO|R\/WC|R\/W1C)$/.test(r.rw.trim())) E_(w + ': "rw" muss R, W oder R/W sein.');
          if (!isStr(r.reset) && !isNum(r.reset)) E_(w + ': "reset" fehlt.');
          if (!isStr(r.desc)) E_(w + ': "desc" fehlt.');
        });
      }

      // Optional: truth
      if (ds.truth !== undefined) {
        var tr = ds.truth;
        if (!isObj(tr)) E_('truth: muss ein Objekt sein.');
        else if (!isArr(tr.inputs) || !tr.inputs.length || !tr.inputs.every(isStr)) E_('truth: "inputs" muss eine Liste von Namen sein.');
        else if (!isArr(tr.outputs) || !tr.outputs.length || !tr.outputs.every(isStr)) E_('truth: "outputs" muss eine Liste von Namen sein.');
        else if (!isArr(tr.rows) || !tr.rows.length) E_('truth: "rows" fehlt oder ist leer.');
        else {
          var width = tr.inputs.length + tr.outputs.length, combos = {}, allBin = true, valid = /^(0|1|x|z|X|Z)$/;
          tr.rows.forEach(function (row, i) {
            var w = 'truth.rows[' + i + ']';
            if (!isArr(row) || row.length !== width) { E_(w + ': muss genau ' + width + ' Werte haben (' + tr.inputs.length + ' Eingänge + ' + tr.outputs.length + ' Ausgänge).'); return; }
            row.forEach(function (v, j) { if (!valid.test(String(v))) E_(w + ' Spalte ' + j + ': Wert "' + v + '" ist nicht 0, 1, x oder z.'); });
            var ik = row.slice(0, tr.inputs.length).join(',');
            if (combos[ik]) W_(w + ': Eingangskombination ' + ik + ' kommt doppelt vor.');
            combos[ik] = true;
            if (!row.slice(0, tr.inputs.length).every(function (v) { return v === 0 || v === 1; })) allBin = false;
          });
          if (allBin && tr.rows.length !== Math.pow(2, tr.inputs.length) && Object.keys(combos).length !== Math.pow(2, tr.inputs.length)) W_('truth: ' + Math.pow(2, tr.inputs.length) + ' Eingangskombinationen erwartet, ' + Object.keys(combos).length + ' vorhanden.');
        }
      }
    } catch (e) {
      errors.push('Interner Prüffehler: ' + (e && e.message ? e.message : 'unbekannt'));
    }
    return { ok: errors.length === 0, errors: errors, warnings: warnings };
  }

  /* ------------------------------------------------------------------ Glossar */
  // [en, de, Erklärung, Kategorie]
  var BASIC = [
    // Aufbau des Datenblatts
    ['datasheet', 'Datenblatt', 'Dokument des Herstellers mit allen Kenndaten, Grenzwerten und Kennlinien eines Bauteils.', 'Datenblatt'],
    ['absolute maximum ratings', 'Grenzwerte (absolute Maximalwerte)', 'Werte, die nie überschritten werden dürfen, sonst droht dauerhafter Schaden. Sie sind kein Betriebsbereich.', 'Datenblatt'],
    ['recommended operating conditions', 'empfohlene Betriebsbedingungen', 'Bereich, in dem das Bauteil seine garantierten Daten einhält und für den Dauerbetrieb gedacht ist.', 'Datenblatt'],
    ['electrical characteristics', 'elektrische Kenndaten', 'Tabelle der garantierten Werte (min, typ, max) unter angegebenen Testbedingungen.', 'Datenblatt'],
    ['test conditions', 'Testbedingungen', 'Spannung, Strom und Temperatur, bei denen ein Kennwert gemessen oder garantiert wird.', 'Datenblatt'],
    ['typical', 'typisch', 'Üblicher Wert bei Raumtemperatur und Nennbedingungen. Er ist nicht garantiert und für die Auslegung nur ein Anhaltspunkt.', 'Datenblatt'],
    ['minimum', 'Minimum (kleinster garantierter Wert)', 'Der Wert wird bei jedem Bauteil dieses Typs mindestens erreicht, sofern die Testbedingungen eingehalten sind.', 'Datenblatt'],
    ['maximum', 'Maximum (größter garantierter Wert)', 'Der Wert wird bei keinem Bauteil dieses Typs überschritten, sofern die Testbedingungen eingehalten sind.', 'Datenblatt'],
    ['parameter', 'Kenngröße, Parameter', 'Eine im Datenblatt aufgeführte Eigenschaft, z. B. Durchlassspannung.', 'Datenblatt'],
    ['symbol', 'Formelzeichen', 'Kurzzeichen des Parameters, z. B. VF für die Durchlassspannung.', 'Datenblatt'],
    ['unit', 'Einheit', 'Maßeinheit des Wertes, z. B. V, mA oder ns.', 'Datenblatt'],
    ['pin assignment', 'Pinbelegung', 'Zuordnung von Funktion und Name zu den Anschlussnummern des Gehäuses.', 'Datenblatt'],
    ['package', 'Gehäuse (Bauform)', 'Bauform des Bauteils, z. B. TO-92, DIP-8 oder SOT-23.', 'Datenblatt'],
    ['package dimensions', 'Gehäusemaße', 'Maßzeichnung mit Abmessungen und Toleranzen des Gehäuses.', 'Datenblatt'],
    ['ordering information', 'Bestellinformationen', 'Typbezeichnungen mit Gehäuse und Verpackung, unter denen das Bauteil bestellt wird.', 'Datenblatt'],
    ['features', 'Merkmale', 'Stichpunktliste der wichtigsten Eigenschaften auf der ersten Seite.', 'Datenblatt'],
    ['description', 'Beschreibung', 'Kurze Erklärung, was das Bauteil macht.', 'Datenblatt'],
    ['applications', 'Anwendungen', 'Typische Einsatzgebiete des Bauteils.', 'Datenblatt'],
    ['typical application circuit', 'typische Anwendungsschaltung', 'Beispielschaltung des Herstellers mit empfohlenen Bauteilwerten.', 'Datenblatt'],
    ['block diagram', 'Blockschaltbild', 'Vereinfachte Darstellung der inneren Funktionsblöcke eines ICs.', 'Datenblatt'],
    ['revision history', 'Änderungshistorie', 'Liste der Änderungen des Datenblatts zwischen den Ausgaben.', 'Datenblatt'],
    ['footnote', 'Fußnote, Anmerkung', 'Zusatzhinweis zu einem Wert; oft steht hier eine wichtige Einschränkung.', 'Datenblatt'],
    ['unless otherwise noted', 'sofern nicht anders angegeben', 'Die genannten Testbedingungen gelten für alle Zeilen ohne eigene Angabe.', 'Datenblatt'],
    ['with respect to ground', 'bezogen auf Masse', 'Spannungsangabe, die sich auf den Massepin (GND) bezieht.', 'Datenblatt'],
    ['stress', 'Beanspruchung', 'Belastung über den Grenzwerten kann das Bauteil dauerhaft schädigen ("stresses beyond those listed").', 'Datenblatt'],
    ['functional operation', 'funktionsgemäßer Betrieb', 'Betrieb, bei dem das Bauteil seine Funktion erfüllt; gilt nur innerhalb der empfohlenen Bedingungen.', 'Datenblatt'],
    ['shall not exceed', 'darf nicht überschritten werden', 'Formulierung für verbindliche Grenzwerte.', 'Datenblatt'],
    // Spannungen, Ströme, Temperaturen
    ['supply voltage', 'Versorgungsspannung', 'Spannung, mit der das Bauteil betrieben wird, oft VCC, VDD oder VS.', 'Betrieb'],
    ['supply current', 'Versorgungsstrom (Stromaufnahme)', 'Strom, den das Bauteil aus der Versorgung aufnimmt.', 'Betrieb'],
    ['quiescent current', 'Ruhestrom', 'Strom, den ein Bauteil ohne Last oder ohne Ansteuerung aufnimmt.', 'Betrieb'],
    ['input voltage', 'Eingangsspannung', 'Spannung am Eingang, bei Reglern die zu regelnde Spannung.', 'Betrieb'],
    ['output voltage', 'Ausgangsspannung', 'Spannung am Ausgang des Bauteils.', 'Betrieb'],
    ['output current', 'Ausgangsstrom', 'Strom, den der Ausgang liefert oder aufnimmt.', 'Betrieb'],
    ['load', 'Last', 'Verbraucher, der am Ausgang angeschlossen ist.', 'Betrieb'],
    ['ground', 'Masse (Bezugspotenzial)', 'Gemeinsamer Bezugspunkt der Spannungen, Pin GND.', 'Betrieb'],
    ['operating temperature range', 'Betriebstemperaturbereich', 'Umgebungstemperaturbereich, in dem das Bauteil betrieben werden darf.', 'Thermik'],
    ['storage temperature', 'Lagertemperatur', 'Temperaturbereich für die Lagerung ohne Betrieb.', 'Thermik'],
    ['junction temperature', 'Sperrschichttemperatur', 'Temperatur des Halbleiterkristalls; sie ist entscheidend und höher als die Umgebungstemperatur.', 'Thermik'],
    ['ambient temperature', 'Umgebungstemperatur', 'Temperatur der Luft in der Umgebung des Bauteils.', 'Thermik'],
    ['case temperature', 'Gehäusetemperatur', 'Temperatur an der Oberfläche oder Fahne des Gehäuses.', 'Thermik'],
    ['lead temperature', 'Löttemperatur (Anschlüsse)', 'Höchste Temperatur an den Anschlüssen beim Löten, mit Zeitangabe.', 'Thermik'],
    ['power dissipation', 'Verlustleistung', 'Leistung, die im Bauteil in Wärme umgesetzt wird.', 'Thermik'],
    ['total power dissipation', 'Gesamtverlustleistung (Ptot)', 'Höchste zulässige Verlustleistung, meist bei 25 °C angegeben.', 'Thermik'],
    ['derating', 'Leistungsreduzierung (Derating)', 'Verringerung der zulässigen Belastung bei steigender Temperatur.', 'Thermik'],
    ['derating curve', 'Derating-Kurve', 'Diagramm der zulässigen Verlustleistung über der Temperatur.', 'Thermik'],
    ['thermal resistance junction to ambient', 'Wärmewiderstand Sperrschicht–Umgebung (RthJA)', 'Temperaturanstieg in K je Watt Verlustleistung zwischen Kristall und Umgebungsluft.', 'Thermik'],
    ['thermal resistance junction to case', 'Wärmewiderstand Sperrschicht–Gehäuse (RthJC)', 'Temperaturanstieg in K je Watt zwischen Kristall und Gehäuse, wichtig bei Kühlkörpern.', 'Thermik'],
    ['heat sink', 'Kühlkörper', 'Metallkörper, der Wärme vom Bauteil an die Luft abgibt und den Wärmewiderstand senkt.', 'Thermik'],
    ['thermal shutdown', 'thermische Abschaltung', 'Schutzfunktion, die den Ausgang abschaltet, wenn der Chip zu heiß wird.', 'Thermik'],
    ['thermal runaway', 'thermisches Weglaufen', 'Selbstverstärkender Effekt: Wärme erhöht den Strom, der Strom erzeugt noch mehr Wärme.', 'Thermik'],
    ['safe operating area', 'sicherer Arbeitsbereich (SOA)', 'Diagramm der erlaubten Kombinationen von Spannung und Strom.', 'Thermik'],
    ['free air', 'freie Luft', 'Betrieb ohne Kühlkörper und ohne erzwungene Belüftung.', 'Thermik'],
    ['continuous', 'dauernd, Dauer-', 'Gilt ohne zeitliche Begrenzung, im Gegensatz zu Spitzen- oder Impulswerten.', 'Betrieb'],
    ['peak', 'Spitzenwert', 'Höchster kurzzeitig auftretender Wert.', 'Betrieb'],
    ['pulsed', 'gepulst', 'Nur als kurzer Impuls zulässig, mit Angabe von Impulsbreite und Tastverhältnis.', 'Betrieb'],
    ['repetitive', 'periodisch wiederkehrend', 'Wird regelmäßig wiederholt, z. B. VRRM bei Gleichrichtern.', 'Betrieb'],
    ['non-repetitive', 'einmalig (nicht wiederholt)', 'Tritt nur selten auf, z. B. ein einzelner Stoßstrom.', 'Betrieb'],
    ['duty cycle', 'Tastverhältnis', 'Verhältnis von Impulsdauer zu Periodendauer.', 'Betrieb'],
    ['pulse width', 'Impulsbreite', 'Dauer eines Impulses.', 'Betrieb'],
    ['surge current', 'Stoßstrom', 'Kurzzeitiger, sehr hoher Strom, etwa beim Einschalten.', 'Betrieb'],
    ['inrush current', 'Einschaltstromstoß', 'Hoher Strom beim Einschalten, z. B. beim Laden von Kondensatoren.', 'Betrieb'],
    // Dioden
    ['forward voltage', 'Durchlassspannung (VF)', 'Spannung an der leitenden Diode oder LED bei einem bestimmten Strom.', 'Dioden'],
    ['forward current', 'Durchlassstrom (IF)', 'Strom, der in Durchlassrichtung durch die Diode fließt.', 'Dioden'],
    ['reverse voltage', 'Sperrspannung (VR)', 'Spannung in Sperrrichtung an der Diode.', 'Dioden'],
    ['reverse current', 'Sperrstrom (IR)', 'Kleiner Strom, der in Sperrrichtung fließt.', 'Dioden'],
    ['reverse leakage current', 'Sperrstrom (Leckstrom in Sperrrichtung)', 'Unerwünscht kleiner Strom bei gesperrter Diode; steigt stark mit der Temperatur.', 'Dioden'],
    ['breakdown voltage', 'Durchbruchspannung', 'Spannung, bei der ein gesperrter pn-Übergang stark leitend wird.', 'Dioden'],
    ['reverse recovery time', 'Sperrverzugszeit (trr)', 'Zeit, die eine Diode nach dem Umschalten von Durchlass auf Sperren noch Strom in Rückwärtsrichtung leitet.', 'Dioden'],
    ['junction capacitance', 'Sperrschichtkapazität', 'Kapazität des pn-Übergangs, hängt von der Sperrspannung ab.', 'Dioden'],
    ['zener voltage', 'Z-Spannung', 'Durchbruchspannung einer Z-Diode, bei der sie die Spannung stabilisiert.', 'Dioden'],
    ['dynamic resistance', 'differenzieller Widerstand', 'Verhältnis von Spannungs- zu Stromänderung im Arbeitspunkt.', 'Dioden'],
    ['peak repetitive reverse voltage', 'periodische Spitzensperrspannung (VRRM)', 'Höchste wiederholt zulässige Sperrspannung einer Gleichrichterdiode.', 'Dioden'],
    ['average rectified forward current', 'mittlerer gleichgerichteter Durchlassstrom', 'Zulässiger Mittelwert des Stroms in einer Gleichrichterschaltung.', 'Dioden'],
    ['luminous intensity', 'Lichtstärke', 'Helligkeit einer LED in Millicandela (mcd) in Hauptstrahlrichtung.', 'Dioden'],
    ['viewing angle', 'Abstrahlwinkel', 'Winkel, bis zu dem die Lichtstärke auf die Hälfte absinkt.', 'Dioden'],
    ['dominant wavelength', 'dominante Wellenlänge', 'Wellenlänge, die den Farbeindruck einer LED bestimmt.', 'Dioden'],
    // Transistoren
    ['collector-emitter voltage', 'Kollektor-Emitter-Spannung (VCE)', 'Spannung zwischen Kollektor und Emitter eines Bipolartransistors.', 'Transistoren'],
    ['collector-base voltage', 'Kollektor-Basis-Spannung (VCB)', 'Spannung zwischen Kollektor und Basis.', 'Transistoren'],
    ['emitter-base voltage', 'Emitter-Basis-Spannung (VEB)', 'Spannung zwischen Emitter und Basis, in Sperrrichtung nur wenige Volt zulässig.', 'Transistoren'],
    ['collector current', 'Kollektorstrom (IC)', 'Strom durch den Kollektoranschluss.', 'Transistoren'],
    ['base current', 'Basisstrom (IB)', 'Steuerstrom in die Basis eines Bipolartransistors.', 'Transistoren'],
    ['dc current gain', 'Gleichstromverstärkung (hFE)', 'Verhältnis von Kollektorstrom zu Basisstrom; streut stark und hängt vom Strom ab.', 'Transistoren'],
    ['saturation voltage', 'Sättigungsspannung (VCEsat)', 'Kleine Restspannung zwischen Kollektor und Emitter bei voll durchgesteuertem Transistor.', 'Transistoren'],
    ['base-emitter voltage', 'Basis-Emitter-Spannung (VBE)', 'Spannung an der Basis-Emitter-Diode, bei Silizium etwa 0,6 bis 0,7 V.', 'Transistoren'],
    ['transition frequency', 'Transitfrequenz (fT)', 'Frequenz, bei der die Stromverstärkung auf 1 gesunken ist.', 'Transistoren'],
    ['gate threshold voltage', 'Gate-Schwellenspannung (VGS(th))', 'Gate-Source-Spannung, bei der ein MOSFET zu leiten beginnt.', 'Transistoren'],
    ['drain-source on-resistance', 'Drain-Source-Einschaltwiderstand (RDS(on))', 'Widerstand des durchgesteuerten MOSFET-Kanals.', 'Transistoren'],
    ['drain current', 'Drainstrom (ID)', 'Strom durch den Drainanschluss eines MOSFETs.', 'Transistoren'],
    ['gate-source voltage', 'Gate-Source-Spannung (VGS)', 'Steuerspannung eines MOSFETs.', 'Transistoren'],
    ['input capacitance', 'Eingangskapazität', 'Kapazität am Eingang, beim MOSFET am Gate; bestimmt den Umladestrom beim Schalten.', 'Transistoren'],
    ['gate charge', 'Gateladung (Qg)', 'Ladung, die zum Durchsteuern des Gates nötig ist.', 'Transistoren'],
    ['body diode', 'Body-Diode (Inversdiode)', 'Im MOSFET entstehende Diode zwischen Source und Drain.', 'Transistoren'],
    ['turn-on time', 'Einschaltzeit', 'Zeit vom Einschaltsignal bis zum Erreichen des eingeschalteten Zustands.', 'Transistoren'],
    ['turn-off time', 'Ausschaltzeit', 'Zeit vom Ausschaltsignal bis zum gesperrten Zustand.', 'Transistoren'],
    ['storage time', 'Speicherzeit', 'Verzögerung beim Ausschalten eines gesättigten Transistors.', 'Transistoren'],
    ['transconductance', 'Steilheit', 'Änderung des Ausgangsstroms je Änderung der Steuerspannung, Einheit Siemens (A/V).', 'Transistoren'],
    // Digital und Zeiten
    ['propagation delay', 'Signallaufzeit (Verzögerungszeit)', 'Zeit zwischen Eingangs- und Ausgangsflanke eines Gatters.', 'Digital'],
    ['rise time', 'Anstiegszeit', 'Zeit, in der ein Signal von 10 % auf 90 % seines Endwerts steigt.', 'Digital'],
    ['fall time', 'Abfallzeit', 'Zeit, in der ein Signal von 90 % auf 10 % seines Anfangswerts fällt.', 'Digital'],
    ['setup time', 'Setup-Zeit (Vorlaufzeit)', 'Zeit, die ein Datensignal vor der Taktflanke stabil anliegen muss.', 'Digital'],
    ['hold time', 'Haltezeit', 'Zeit, die ein Datensignal nach der Taktflanke noch stabil bleiben muss.', 'Digital'],
    ['clock frequency', 'Taktfrequenz', 'Frequenz des Taktsignals; sie hat eine Obergrenze.', 'Digital'],
    ['input high voltage', 'Eingangsspannung High-Pegel (VIH)', 'Kleinste Spannung, die der Eingang sicher als High erkennt.', 'Digital'],
    ['input low voltage', 'Eingangsspannung Low-Pegel (VIL)', 'Größte Spannung, die der Eingang sicher als Low erkennt.', 'Digital'],
    ['output high voltage', 'Ausgangsspannung High-Pegel (VOH)', 'Garantierte Mindestspannung am Ausgang im High-Zustand bei einem bestimmten Laststrom.', 'Digital'],
    ['output low voltage', 'Ausgangsspannung Low-Pegel (VOL)', 'Garantierte Höchstspannung am Ausgang im Low-Zustand bei einem bestimmten Laststrom.', 'Digital'],
    ['sink current', 'Senkenstrom', 'Strom, den ein Ausgang gegen Masse aufnimmt (Low-Zustand).', 'Digital'],
    ['source current', 'Quellenstrom', 'Strom, den ein Ausgang an die Last abgibt (High-Zustand).', 'Digital'],
    ['fan-out', 'Ausgangslastfaktor (Fan-out)', 'Anzahl der Eingänge, die ein Ausgang treiben kann.', 'Digital'],
    ['noise margin', 'Störabstand', 'Spannungsreserve zwischen Ausgangs- und Eingangspegel gegen Störungen.', 'Digital'],
    ['schmitt trigger', 'Schmitt-Trigger', 'Eingang mit Hysterese, der langsame oder verrauschte Signale sauber auswertet.', 'Digital'],
    ['open drain', 'offener Drain (Open-Drain)', 'Ausgang, der nur nach Masse schaltet und einen externen Pull-up-Widerstand braucht.', 'Digital'],
    ['open collector', 'offener Kollektor', 'Wie Open-Drain bei Bipolartransistoren: Ausgang schaltet nur nach Masse.', 'Digital'],
    ['pull-up resistor', 'Pull-up-Widerstand', 'Widerstand nach Versorgungsspannung, der eine Leitung im Ruhezustand auf High zieht.', 'Digital'],
    ['pull-down resistor', 'Pull-down-Widerstand', 'Widerstand nach Masse, der eine Leitung im Ruhezustand auf Low zieht.', 'Digital'],
    ['high impedance', 'hochohmig (Tri-State)', 'Ausgang ist weder High noch Low, sondern praktisch abgetrennt.', 'Digital'],
    ['enable', 'Freigabe', 'Eingang, der eine Funktion oder einen Ausgang ein- oder ausschaltet.', 'Digital'],
    ['chip select', 'Chip-Auswahl', 'Eingang, der einen von mehreren Bausteinen am Bus anspricht.', 'Digital'],
    ['active low', 'low-aktiv', 'Die Funktion ist bei Low-Pegel wirksam, oft mit Überstrich oder # gekennzeichnet.', 'Digital'],
    ['truth table', 'Wahrheitstabelle', 'Tabelle aller Eingangskombinationen mit zugehörigem Ausgangszustand.', 'Digital'],
    ['register', 'Register', 'Speicherplatz im Baustein für Einstellungen oder Messwerte.', 'Digital'],
    ['address', 'Adresse', 'Nummer, mit der ein Baustein oder ein Register angesprochen wird.', 'Digital'],
    ['bus', 'Bus', 'Gemeinsame Leitungen, an denen mehrere Bausteine Daten austauschen.', 'Digital'],
    ['slave address', 'Slave-Adresse', 'Adresse eines Bausteins am I²C-Bus.', 'Digital'],
    ['acknowledge', 'Quittung (ACK)', 'Bestätigungsbit des Empfängers nach jedem übertragenen Byte.', 'Digital'],
    ['clock', 'Takt', 'Signal, das die Übertragung oder Verarbeitung synchronisiert.', 'Digital'],
    ['data', 'Daten', 'Nutzinformation, die über eine Leitung übertragen wird.', 'Digital'],
    ['read', 'lesen', 'Daten aus dem Baustein abrufen.', 'Digital'],
    ['write', 'schreiben', 'Daten in den Baustein übertragen.', 'Digital'],
    ['reset', 'Rücksetzen', 'Bringt den Baustein in einen definierten Anfangszustand.', 'Digital'],
    ['default value', 'Standardwert (Reset-Wert)', 'Wert, den ein Register nach dem Einschalten oder Reset hat.', 'Digital'],
    ['quasi-bidirectional', 'quasi-bidirektional', 'Port, der durch einen schwachen Pull-up als Eingang und Ausgang dient; High-Strom ist sehr klein.', 'Digital'],
    ['interrupt', 'Unterbrechungsanforderung (Interrupt)', 'Signal, das den Controller auf ein Ereignis aufmerksam macht.', 'Digital'],
    ['resolution', 'Auflösung', 'Anzahl der unterscheidbaren Stufen, z. B. 8 Bit gleich 256 Stufen.', 'Messtechnik'],
    ['wiper', 'Schleifer', 'Beweglicher Abgriff eines Potentiometers.', 'Messtechnik'],
    ['wiper resistance', 'Schleiferwiderstand', 'Widerstand des Schleiferkontakts, besonders bei digitalen Potentiometern relevant.', 'Messtechnik'],
    ['end-to-end resistance', 'Gesamtwiderstand', 'Widerstand zwischen den beiden Enden eines Potentiometers.', 'Messtechnik'],
    ['latch-up', 'Latch-up', 'Unerwünschtes Zünden einer parasitären Struktur im IC, das hohe Ströme verursacht.', 'Digital'],
    ['electrostatic discharge', 'elektrostatische Entladung (ESD)', 'Plötzlicher Ladungsausgleich, der Bauteile zerstören kann.', 'Digital'],
    // Analog und Regler
    ['input offset voltage', 'Eingangs-Offsetspannung', 'Differenzspannung, die am Eingang eines Operationsverstärkers anliegen muss, damit der Ausgang null wird.', 'Analog'],
    ['input bias current', 'Eingangsruhestrom (Bias-Strom)', 'Mittlerer Strom, der in die Eingänge eines Operationsverstärkers fließt.', 'Analog'],
    ['input offset current', 'Eingangs-Offsetstrom', 'Differenz der beiden Eingangsruheströme.', 'Analog'],
    ['open-loop gain', 'Leerlaufverstärkung', 'Verstärkung ohne Gegenkopplung.', 'Analog'],
    ['gain bandwidth product', 'Verstärkungs-Bandbreite-Produkt (GBW)', 'Produkt aus Verstärkung und Bandbreite, bei Gegenkopplung näherungsweise konstant.', 'Analog'],
    ['slew rate', 'Anstiegsgeschwindigkeit (Slew Rate)', 'Maximale Änderungsgeschwindigkeit der Ausgangsspannung in V/µs.', 'Analog'],
    ['common-mode rejection ratio', 'Gleichtaktunterdrückung (CMRR)', 'Maß, wie stark Gleichtaktsignale gegenüber Differenzsignalen unterdrückt werden.', 'Analog'],
    ['power supply rejection ratio', 'Betriebsspannungsunterdrückung (PSRR)', 'Maß, wie gut Schwankungen der Versorgung vom Ausgang ferngehalten werden.', 'Analog'],
    ['common-mode input voltage range', 'Gleichtakt-Eingangsspannungsbereich', 'Bereich der Eingangsspannung, in dem der Verstärker richtig arbeitet.', 'Analog'],
    ['output voltage swing', 'Ausgangsspannungshub', 'Größter Spannungsbereich, den der Ausgang erreichen kann.', 'Analog'],
    ['unity gain', 'Verstärkung 1 (Einsverstärkung)', 'Verstärkung vom Betrag eins, z. B. beim Spannungsfolger.', 'Analog'],
    ['noise', 'Rauschen', 'Zufällige Störspannung eines Bauteils.', 'Analog'],
    ['bandwidth', 'Bandbreite', 'Frequenzbereich, in dem ein Verstärker oder Signal übertragen wird.', 'Analog'],
    ['gain', 'Verstärkung', 'Verhältnis von Ausgangs- zu Eingangsgröße.', 'Analog'],
    ['dropout voltage', 'Mindest-Spannungsdifferenz (Dropout-Spannung)', 'Kleinste Differenz zwischen Ein- und Ausgang, bei der ein Spannungsregler noch regelt.', 'Regler'],
    ['line regulation', 'Netzregelung (Eingangsspannungsabhängigkeit)', 'Änderung der Ausgangsspannung bei Änderung der Eingangsspannung.', 'Regler'],
    ['load regulation', 'Lastregelung', 'Änderung der Ausgangsspannung bei Änderung des Laststroms.', 'Regler'],
    ['reference voltage', 'Referenzspannung', 'Intern erzeugte, stabile Vergleichsspannung, z. B. 1,25 V beim LM317.', 'Regler'],
    ['short-circuit current', 'Kurzschlussstrom', 'Strom, der bei Kurzschluss am Ausgang fließt.', 'Regler'],
    ['current limit', 'Strombegrenzung', 'Schutzfunktion, die den Ausgangsstrom auf einen Höchstwert begrenzt.', 'Regler'],
    ['ripple rejection', 'Brummspannungsunterdrückung', 'Dämpfung einer Brummspannung der Eingangsseite am Ausgang.', 'Regler'],
    ['adjustable', 'einstellbar', 'Der Wert lässt sich über externe Bauteile oder einen Regler festlegen.', 'Regler'],
    ['fixed', 'fest', 'Wert ist vom Hersteller fest vorgegeben, z. B. 5 V.', 'Regler'],
    ['threshold', 'Schwelle', 'Wert, bei dessen Erreichen eine Umschaltung erfolgt.', 'Regler'],
    ['trigger', 'Auslöser (Triggereingang)', 'Eingang, der einen Vorgang startet, z. B. beim NE555.', 'Regler'],
    ['discharge', 'Entladen', 'Abfließen der Ladung, z. B. des Zeitkondensators beim NE555.', 'Regler'],
    ['astable', 'astabil (frei schwingend)', 'Schaltung ohne stabilen Zustand, die ständig umkippt.', 'Regler'],
    ['monostable', 'monostabil', 'Schaltung mit einem stabilen Zustand, die nach einem Trigger für eine feste Zeit kippt.', 'Regler'],
    ['decoupling capacitor', 'Abblockkondensator', 'Kondensator nahe am IC, der Spannungseinbrüche und Störungen der Versorgung abfängt.', 'Regler'],
    ['bypass capacitor', 'Überbrückungskondensator (Abblockkondensator)', 'Kondensator, der hochfrequente Störungen nach Masse ableitet.', 'Regler'],
    // Messtechnik
    ['tolerance', 'Toleranz', 'Zulässige Abweichung vom Nennwert, meist in Prozent.', 'Messtechnik'],
    ['temperature coefficient', 'Temperaturkoeffizient', 'Änderung einer Größe je Kelvin Temperaturänderung, z. B. in ppm/K.', 'Messtechnik'],
    ['accuracy', 'Genauigkeit', 'Maximale Abweichung vom wahren Wert.', 'Messtechnik'],
    ['precision', 'Präzision (Wiederholgenauigkeit)', 'Maß, wie dicht wiederholte Messungen beieinanderliegen.', 'Messtechnik'],
    ['linearity', 'Linearität', 'Abweichung der Kennlinie von einer Geraden.', 'Messtechnik'],
    ['offset', 'Versatz (Offset)', 'Konstante Abweichung vom Sollwert, auch bei Eingangsgröße null.', 'Messtechnik'],
    ['drift', 'Drift', 'Langsame Änderung einer Größe über Zeit oder Temperatur.', 'Messtechnik'],
    ['hysteresis', 'Hysterese', 'Unterschied der Schaltschwellen für steigende und fallende Signale.', 'Messtechnik'],
    ['full scale', 'Vollausschlag (Endwert)', 'Größter Wert des Messbereichs.', 'Messtechnik'],
    ['range', 'Bereich', 'Zulässiger Wertebereich von einem Minimum bis zu einem Maximum.', 'Messtechnik'],
    ['calibration', 'Kalibrierung', 'Vergleich mit einem Normal und Abgleich der Abweichung.', 'Messtechnik'],
    ['sampling rate', 'Abtastrate', 'Anzahl der Messwerte je Sekunde.', 'Messtechnik'],
    ['sensitivity', 'Empfindlichkeit', 'Änderung des Ausgangssignals je Änderung der Messgröße, z. B. 10 mV/°C.', 'Messtechnik'],
    // Bauform und Montage
    ['through-hole', 'Durchsteckmontage (THT)', 'Bauteil mit Anschlussdrähten, die durch Bohrungen der Leiterplatte gesteckt werden.', 'Bauform'],
    ['surface mount', 'oberflächenmontiert (SMD)', 'Bauteil, das direkt auf die Leiterplattenoberfläche gelötet wird.', 'Bauform'],
    ['pitch', 'Rastermaß', 'Abstand zwischen benachbarten Anschlüssen.', 'Bauform'],
    ['lead', 'Anschlussdraht, Anschlussbein', 'Elektrischer Anschluss des Bauteils.', 'Bauform'],
    ['soldering', 'Löten', 'Stoffschlüssige elektrische Verbindung mit Lot.', 'Bauform'],
    ['tape and reel', 'Gurt und Rolle', 'Verpackung für automatische Bestückung.', 'Bauform'],
    ['not connected', 'nicht beschaltet (NC)', 'Pin ohne interne Verbindung; er darf offen bleiben, sofern nicht anders angegeben.', 'Bauform'],
    ['floating', 'unbeschaltet (schwebend)', 'Eingang ohne definierte Verbindung; bei Logikeingängen unzulässig, da er Störungen aufnimmt.', 'Bauform'],
    ['moisture sensitivity level', 'Feuchteempfindlichkeitsstufe (MSL)', 'Gibt an, wie lange ein SMD-Bauteil vor dem Löten an Luft liegen darf.', 'Bauform'],
    ['rohs compliant', 'RoHS-konform', 'Erfüllt die EU-Beschränkung gefährlicher Stoffe.', 'Bauform']
  ];

  function glossary() {
    var out = [], idx = {};
    try {
      BASIC.forEach(function (b) {
        idx[lc(b[0])] = out.length;
        out.push({ en: b[0], de: b[1], note: b[2], cat: b[3], src: 'basis', sources: ['basis'] });
      });
      var lib = root.DS_LIB && isArr(root.DS_LIB.list) ? root.DS_LIB.list : [];
      lib.forEach(function (ds) {
        if (!isObj(ds) || !isArr(ds.glossary)) return;
        ds.glossary.forEach(function (g) {
          if (!isObj(g) || !isStr(g.en) || !isStr(g.de)) return;
          var k = lc(g.en.trim());
          if (hasOwn.call(idx, k)) {
            var ex = out[idx[k]];
            if (ex.sources.indexOf(ds.id) < 0) ex.sources.push(ds.id);
          } else {
            idx[k] = out.length;
            out.push({ en: g.en, de: g.de, note: typeof g.note === 'string' ? g.note : '', cat: 'Bauteil', src: ds.id || '', sources: [ds.id || ''] });
          }
        });
      });
    } catch (e) { /* liefert, was bis hierher gesammelt wurde */ }
    return out;
  }

  /* ------------------------------------------------------------------ Export */
  var DS_CORE = {
    version: '1.0',
    parseValue: parseValue, parseWithUnit: parseWithUnit, fmt: fmt, splitUnit: splitUnit, unitValid: unitValid, toSI: toSI,
    interp: interp, readCurve: readCurve, inverse: inverse, crossings: crossings,
    derate: derate, rthSum: rthSum, tj: tj,
    ledResistor: ledResistor, eSeries: eSeries, eTable: function (n) { var t = hasOwn.call(E, String(n).toUpperCase()) ? E[String(n).toUpperCase()] : null; return t ? t.slice() : null; },
    check: check, tolerance: tolerance, worstCase: worstCase, divider: divider,
    pick: pick, pickAll: pickAll, glossary: glossary
  };
  var DS_SCHEMA = {
    version: '1.0', validate: validate, pinTypes: PIN_TYPES.slice(), kinds: KINDS.slice()
  };

  root.DS_CORE = DS_CORE;
  root.DS_SCHEMA = DS_SCHEMA;
  if (typeof module !== 'undefined' && module.exports) module.exports = { DS_CORE: DS_CORE, DS_SCHEMA: DS_SCHEMA, DS_LIB: root.DS_LIB };
})();
