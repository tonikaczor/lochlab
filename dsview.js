/* dsview.js - Datenblatt-Betrachter des Datenblatt-Labs (window.DS_VIEW)
   DS_VIEW.mount(el, ctx) -> { refresh(), focus(target), setMode(m), destroy(), ... }
   ctx: { getDs(), onRead({graphId,series,seriesName,x,y}), onMark({section,key,marked}), toast(msg), fx(name), marks?:[{section,key}], mode?:'lesen' }
   Keine Abhaengigkeiten, kein eval. Nutzt DS_CORE.interp, wenn vorhanden und plausibel. */
(function () {
  'use strict';
  var VERSION = '1.0', uid = 0;
  var COL = ['#1f5fbf', '#c0392b', '#2e8b57', '#d68910', '#7d3c98', '#117a8b'];
  var DASH = ['', '7 3', '2 3', '10 3 2 3', '', '4 4'];
  var PINCOL = { 'in': '#2f6fdb', out: '#1f8f4d', pwr: '#c8342c', gnd: '#333b45', io: '#c77700', nc: '#8a939e' };
  var PINTXT = { 'in': 'Eingang', out: 'Ausgang', pwr: 'Versorgung', gnd: 'Masse', io: 'Ein-/Ausgang', nc: 'nicht belegt' };
  var PANELBG = '#fdfdfb';

  var TXT = {
    en: { features: 'Features', desc: 'Description', pins: 'Pin configuration', abs: 'Absolute maximum ratings', rec: 'Recommended operating conditions', elec: 'Electrical characteristics', graphs: 'Typical characteristics', thermal: 'Thermal information', pkg: 'Package outline', timing: 'Timing diagram', regs: 'Register map', truth: 'Function table', app: 'Application information', order: 'Ordering information', param: 'Parameter', sym: 'Symbol', cond: 'Test conditions', min: 'Min', typ: 'Typ', max: 'Max', unit: 'Unit', note: 'Note', pin: 'Pin', name: 'Name', type: 'Type', descr: 'Description', addr: 'Address', bits: 'Bits', rw: 'R/W', reset: 'Reset', inp: 'Inputs', outp: 'Outputs', dim: 'Dimension', dimh: 'Dimensions', pkgcol: 'Package', ordtype: 'Order code', titlepg: 'Overview', fig: 'Fig.',
      warn: 'Stresses beyond those listed under Absolute Maximum Ratings may cause permanent damage to the device. These are stress ratings only; functional operation at these or any other conditions beyond those given under Recommended Operating Conditions is not implied.',
      unless: 'Unless otherwise noted: ' },
    de: { features: 'Merkmale', desc: 'Beschreibung', pins: 'Pinbelegung', abs: 'Grenzwerte (Absolute Maximum Ratings)', rec: 'Empfohlene Betriebsbedingungen', elec: 'Elektrische Kennwerte', graphs: 'Typische Kennlinien', thermal: 'Thermische Daten', pkg: 'Gehäusezeichnung', timing: 'Zeitdiagramm', regs: 'Registertabelle', truth: 'Wahrheitstabelle', app: 'Anwendungsschaltung', order: 'Bestellinformation', param: 'Parameter', sym: 'Symbol', cond: 'Testbedingungen', min: 'Min', typ: 'Typ', max: 'Max', unit: 'Einheit', note: 'Hinweis', pin: 'Pin', name: 'Name', type: 'Typ', descr: 'Beschreibung', addr: 'Adresse', bits: 'Bits', rw: 'R/W', reset: 'Reset', inp: 'Eingänge', outp: 'Ausgänge', dim: 'Maß', dimh: 'Maße', pkgcol: 'Gehäuse', ordtype: 'Bestellnummer', titlepg: 'Übersicht', fig: 'Abb.',
      warn: 'Eine Belastung über die Absolute Maximum Ratings hinaus kann das Bauteil dauerhaft schädigen. Es sind reine Grenzwerte; Funktion ist dort und außerhalb der empfohlenen Betriebsbedingungen nicht zugesichert.',
      unless: 'Wenn nicht anders angegeben: ' }
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /* ---------- Zahlenformat ---------- */
  var BASE = { A: 1, V: 1, W: 1, 'Ω': 1, Hz: 1, s: 1, F: 1, H: 1 };
  var PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  var SUPD = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  function mkFmt(dec) {
    function trim(v, p) {
      if (typeof v !== 'number' || !isFinite(v)) return '–';
      var s = String(Number(v.toPrecision(p || 6)));
      if (/e/.test(s)) s = v.toFixed(8).replace(/0+$/, '').replace(/\.$/, '');
      return dec === ',' ? s.replace('.', ',') : s;
    }
    function si(v, unit, dig) {
      if (typeof v !== 'number' || !isFinite(v)) return '–';
      dig = dig || 3;
      if (!BASE[unit]) return trim(v, dig) + (unit ? ' ' + unit : '');
      if (v === 0) return '0 ' + unit;
      var a = Math.abs(v);
      for (var i = 0; i < PRE.length; i++) if (a >= PRE[i][0] * 0.9995) return trim(v / PRE[i][0], dig) + ' ' + PRE[i][1] + unit;
      return trim(v / 1e-12, dig) + ' p' + unit;
    }
    function tickLog(v, u) {
      if (BASE[u]) return si(v, u, 3);
      var a = Math.abs(v);
      if (a >= 1e6) return trim(v / 1e6) + 'M';
      if (a >= 1e3) return trim(v / 1e3) + 'k';
      if (a < 0.01) { var e = String(Math.round(Math.log10(a))).split('').map(function (c) { return SUPD[c] || c; }).join(''); return '10' + e; }
      return trim(v);
    }
    function cell(v) { if (v == null || v === '') return '–'; if (typeof v === 'number') return trim(v, 6); return esc(v); }
    return { trim: trim, si: si, tickLog: tickLog, cell: cell, dec: dec };
  }

  /* ---------- Interpolation (gekapselt; DS_CORE.interp nur, wenn plausibel) ---------- */
  function ownInterp(pts, x, xs, ys) {
    var n = pts.length; if (!n) return null;
    if (x < pts[0][0] - 1e-12 || x > pts[n - 1][0] + 1e-12) return null;
    for (var i = 1; i < n; i++) {
      if (x <= pts[i][0]) {
        var a = pts[i - 1], b = pts[i]; if (b[0] === a[0]) return b[1];
        var X0 = xs === 'log' ? Math.log(a[0]) : a[0], X1 = xs === 'log' ? Math.log(b[0]) : b[0], X = xs === 'log' ? Math.log(x) : x;
        var t = (X - X0) / (X1 - X0);
        if (ys === 'log' && a[1] > 0 && b[1] > 0) return Math.exp(Math.log(a[1]) + t * (Math.log(b[1]) - Math.log(a[1])));
        return a[1] + t * (b[1] - a[1]);
      }
    }
    return pts[n - 1][1];
  }
  var coreState = 0; // 0 unbekannt, 1 ok, -1 nein
  function interp(g, s, x) {
    var pts = (s.points || []).filter(function (p) { return (g.xScale !== 'log' || p[0] > 0) && (g.yScale !== 'log' || p[1] > 0); });
    var o = ownInterp(pts, x, g.xScale, g.yScale);
    if (o == null) return null;
    if (coreState >= 0 && window.DS_CORE && typeof window.DS_CORE.interp === 'function') {
      try {
        var r = window.DS_CORE.interp(s, x, { xScale: g.xScale, yScale: g.yScale });
        if (typeof r === 'number' && isFinite(r) && Math.abs(r - o) <= Math.abs(o) * 0.02 + 1e-12) { coreState = 1; return r; }
        if (coreState === 0) coreState = -1;
      } catch (e) { if (coreState === 0) coreState = -1; }
    }
    return o;
  }

  /* ---------- Achsen und Kennlinien ---------- */
  function niceStep(raw) { var e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
  function axis(min, max, log) {
    if (log) {
      var lo = Math.pow(10, Math.floor(Math.log10(min) + 1e-9)), hi = Math.pow(10, Math.ceil(Math.log10(max) - 1e-9));
      if (hi <= lo) hi = lo * 10;
      var maj = [], mnr = [];
      for (var v = lo; v <= hi * 1.0001; v *= 10) { maj.push(v); if (v < hi * 0.999) for (var k = 2; k < 10; k++) mnr.push(v * k); }
      return { lo: lo, hi: hi, maj: maj, mnr: mnr, log: true };
    }
    if (min > 0 && min <= max * 0.35) min = 0;
    if (max <= min) max = min + 1;
    var step = niceStep((max - min) / 5);
    var l = Math.floor(min / step + 1e-9) * step, h = Math.ceil(max / step - 1e-9) * step, t = [];
    for (var u = l; u <= h + step * 1e-6; u += step) t.push(+u.toPrecision(12));
    return { lo: l, hi: h, maj: t, mnr: [], log: false };
  }

  function buildChart(g, F, seriesHidden) {
    var W = 640, H = 360, ml = 72, mr = 20, mt = 16, mb = 58, pw = W - ml - mr, ph = H - mt - mb, id = 'c' + (++uid);
    var xl = g.xScale === 'log', yl = g.yScale === 'log';
    var xs = [], ys = [];
    (g.series || []).forEach(function (s) { (s.points || []).forEach(function (p) { if ((!xl || p[0] > 0) && (!yl || p[1] > 0)) { xs.push(p[0]); ys.push(p[1]); } }); });
    if (!xs.length) { xs = [0, 1]; ys = [0, 1]; }
    var ax = axis(Math.min.apply(null, xs), Math.max.apply(null, xs), xl), ay = axis(Math.min.apply(null, ys), Math.max.apply(null, ys), yl);
    function tr(v, l) { return l ? Math.log10(v) : v; }
    var tx0 = tr(ax.lo, xl), tx1 = tr(ax.hi, xl), ty0 = tr(ay.lo, yl), ty1 = tr(ay.hi, yl);
    function X(v) { return ml + (tr(v, xl) - tx0) / (tx1 - tx0) * pw; }
    function Y(v) { return mt + ph - (tr(v, yl) - ty0) / (ty1 - ty0) * ph; }
    function invX(px) { var t = tx0 + (px - ml) / pw * (tx1 - tx0); return xl ? Math.pow(10, t) : t; }
    function r1(n) { return Math.round(n * 10) / 10; }
    var o = '<svg class="dsv-plot" viewBox="0 0 ' + W + ' ' + H + '" role="img" tabindex="0" aria-label="' + esc(g.title || 'Kennlinie') + '" data-gid="' + esc(g.id) + '">';
    o += '<defs><clipPath id="' + id + '"><rect x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '"/></clipPath></defs>';
    o += '<rect x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '" fill="#fff"/>';
    var gm = '', gM = '';
    function gridX(v, major) { var x = r1(X(v)); return 'M' + x + ' ' + mt + 'V' + (mt + ph); }
    function gridY(v) { var y = r1(Y(v)); return 'M' + ml + ' ' + y + 'H' + (ml + pw); }
    ax.mnr.forEach(function (v) { gm += gridX(v); }); ay.mnr.forEach(function (v) { gm += gridY(v); });
    ax.maj.forEach(function (v) { gM += gridX(v); }); ay.maj.forEach(function (v) { gM += gridY(v); });
    o += '<path d="' + gm + '" stroke="#e3e6ea" stroke-width="1" fill="none"/><path d="' + gM + '" stroke="#b4bcc6" stroke-width="1" fill="none"/>';
    o += '<g font-size="12" fill="#2b3138" font-family="Segoe UI,Arial,sans-serif">';
    ax.maj.forEach(function (v) { o += '<text x="' + r1(X(v)) + '" y="' + (mt + ph + 17) + '" text-anchor="middle">' + esc(xl ? F.tickLog(v, g.xUnit) : F.trim(v, 6)) + '</text>'; });
    ay.maj.forEach(function (v) { o += '<text x="' + (ml - 7) + '" y="' + (r1(Y(v)) + 4) + '" text-anchor="end">' + esc(yl ? F.tickLog(v, g.yUnit) : F.trim(v, 6)) + '</text>'; });
    o += '<text x="' + (ml + pw / 2) + '" y="' + (H - 10) + '" text-anchor="middle" font-weight="600">' + esc((g.xLabel || '') + (g.xUnit ? ' (' + g.xUnit + ')' : '')) + '</text>';
    o += '<text transform="translate(15 ' + (mt + ph / 2) + ') rotate(-90)" text-anchor="middle" font-weight="600">' + esc((g.yLabel || '') + (g.yUnit ? ' (' + g.yUnit + ')' : '')) + '</text></g>';
    o += '<g clip-path="url(#' + id + ')" fill="none">';
    (g.series || []).forEach(function (s, si) {
      var pts = (s.points || []).filter(function (p) { return (!xl || p[0] > 0) && (!yl || p[1] > 0); });
      if (!pts.length) return;
      var d = '';
      for (var i = 0; i < pts.length; i++) {
        if (i === 0) { d += 'M' + r1(X(pts[0][0])) + ' ' + r1(Y(pts[0][1])); continue; }
        var a = pts[i - 1], b = pts[i], N = 12;
        for (var k = 1; k <= N; k++) {
          var t = k / N, xt = tr(a[0], xl) + (tr(b[0], xl) - tr(a[0], xl)) * t, xv = xl ? Math.pow(10, xt) : xt;
          var yv = ownInterp([a, b], xv, g.xScale, g.yScale); if (yv == null) yv = b[1];
          d += 'L' + r1(X(xv)) + ' ' + r1(Y(yv));
        }
      }
      var c = COL[si % COL.length];
      o += '<path d="' + d + '" stroke="' + c + '" stroke-width="2.2" stroke-linejoin="round"' + (DASH[si % DASH.length] ? ' stroke-dasharray="' + DASH[si % DASH.length] + '"' : '') + ' class="dsv-curve" data-si="' + si + '"/>';
      if (pts.length <= 24) pts.forEach(function (p) {
        o += '<circle cx="' + r1(X(p[0])) + '" cy="' + r1(Y(p[1])) + '" r="2.6" fill="#fff" stroke="' + c + '" stroke-width="1.4"><title>' + esc(F.si(p[0], g.xUnit) + ' | ' + F.si(p[1], g.yUnit)) + '</title></circle>';
      });
    });
    o += '</g><rect x="' + ml + '" y="' + mt + '" width="' + pw + '" height="' + ph + '" fill="none" stroke="#5b6672" stroke-width="1.2"/>';
    o += '<g class="dsv-cur" style="display:none" pointer-events="none">' +
      '<line class="v" y1="' + mt + '" y2="' + (mt + ph) + '" stroke="#e8590c" stroke-width="1.2" stroke-dasharray="5 3"/>' +
      '<line class="h" x1="' + ml + '" x2="' + (ml + pw) + '" stroke="#e8590c" stroke-width="1.2" stroke-dasharray="5 3"/>' +
      '<circle class="dot" r="5.5" fill="rgba(232,89,12,.18)" stroke="#e8590c" stroke-width="2"/>' +
      '<g class="dsv-curtag tx"><rect rx="3" height="18" fill="#e8590c"/><text font-size="11.5" fill="#fff" font-weight="600" font-family="Segoe UI,Arial,sans-serif"></text></g>' +
      '<g class="dsv-curtag ty"><rect rx="3" height="18" fill="#e8590c"/><text font-size="11.5" fill="#fff" font-weight="600" font-family="Segoe UI,Arial,sans-serif"></text></g></g>';
    o += '</svg>';
    return { svg: o, geo: { X: X, Y: Y, invX: invX, tr: tr, xl: xl, yl: yl, ax: ax, ay: ay, ml: ml, mt: mt, pw: pw, ph: ph, W: W, H: H, tx0: tx0, tx1: tx1 } };
  }

  /* ---------- Gehaeusezeichnungen (maßstäblich, in mm) ---------- */
  function pkgSvg(kind, pins, o) {
    o = o || {};
    kind = String(kind || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    var K = KINDS[kind] || KINDS.generic, id = 'pk' + (++uid);
    var fm = o.fmt || mkFmt(o.dec || ',');
    var pm = {}, plist = (pins || []).slice().sort(function (a, b) { return a.n - b.n; });
    plist.forEach(function (p) { pm[p.n] = p; });
    var ext = K.ext(), w = ext[2] - ext[0], h = ext[3] - ext[1];
    var s = Math.min(K.smax || 38, 160 / Math.max(w, h));
    var maxName = 0; plist.forEach(function (p) { maxName = Math.max(maxName, String(p.name || '').length); });
    var nameW = maxName * 6.8 + 10;
    var c = {
      s: s, pm: pm, plist: plist, names: o.names !== false, dims: !!o.dims, nameW: nameW, fm: fm,
      px: function (n) { return n / s; },
      t: function (x, y, str, a, sz, fill, wt) { return '<text x="' + x + '" y="' + y + '" font-size="' + ((sz || 11) / s) + '" text-anchor="' + (a || 'middle') + '" fill="' + (fill || '#1b1f24') + '"' + (wt ? ' font-weight="' + wt + '"' : '') + ' font-family="Segoe UI,Arial,sans-serif">' + esc(str) + '</text>'; },
      hdim: function (x1, x2, y, label) {
        var e = 4 / s; return '<g stroke="#5b6672" stroke-width="1" fill="none"><path d="M' + x1 + ' ' + y + 'H' + x2 + 'M' + x1 + ' ' + (y - e) + 'V' + (y + e) + 'M' + x2 + ' ' + (y - e) + 'V' + (y + e) + '"/></g>' +
          c.t((x1 + x2) / 2, y - 4 / s, label, 'middle', 10.5, '#3a4350', 600);
      },
      vdim: function (y1, y2, x, label) {
        var e = 4 / s; return '<g stroke="#5b6672" stroke-width="1" fill="none"><path d="M' + x + ' ' + y1 + 'V' + y2 + 'M' + (x - e) + ' ' + y1 + 'H' + (x + e) + 'M' + (x - e) + ' ' + y2 + 'H' + (x + e) + '"/></g>' +
          c.t(x + 6 / s, (y1 + y2) / 2 + 4 / s, label, 'start', 10.5, '#3a4350', 600);
      }
    };
    var r = K.draw(c);
    var pl = (r.pl || 14), pr = (r.pr || 14), pt = (r.pt || 14), pb = (r.pb || 14) + 20;
    var listW = 0, listH = 0;
    if (r.list && plist.length && o.names !== false) { listW = 26 + nameW + 90; listH = plist.length * 19 + 8; }
    var W = w * s + pl + pr + listW, Hh = Math.max(h * s + pt + pb, listH + 20);
    var ty = pt - ext[1] * s + Math.max(0, (Hh - (h * s + pt + pb)) / 2);
    var out = '<svg class="dsv-pk" viewBox="0 0 ' + Math.round(W) + ' ' + Math.round(Hh) + '" role="img" aria-label="Gehäusezeichnung" xmlns="http://www.w3.org/2000/svg">';
    out += '<g transform="translate(' + (pl - ext[0] * s).toFixed(2) + ' ' + ty.toFixed(2) + ') scale(' + s.toFixed(4) + ')">' + r.els + '</g>';
    if (listW) {
      var lx = w * s + pl + pr + 6;
      plist.forEach(function (p, i) {
        var yy = 24 + i * 19, col = PINCOL[p.type] || '#555';
        out += '<g data-sec="pkgpin" data-key="' + esc(p.n) + '"><circle cx="' + (lx + 9) + '" cy="' + (yy - 4) + '" r="9" fill="none" stroke="' + col + '" stroke-width="1.6"/>' +
          '<text x="' + (lx + 9) + '" y="' + yy + '" text-anchor="middle" font-size="11" font-weight="700" fill="#1b1f24" font-family="Segoe UI,Arial,sans-serif">' + esc(p.n) + '</text>' +
          '<text x="' + (lx + 26) + '" y="' + yy + '" font-size="12" font-weight="600" fill="' + col + '" font-family="Segoe UI,Arial,sans-serif">' + esc(p.name || '') + '</text></g>';
      });
    }
    var sb = 5 * s, sy = Hh - 12;
    out += '<g stroke="#3a4350" stroke-width="1.4"><path d="M' + pl + ' ' + sy + 'h' + sb + 'M' + pl + ' ' + (sy - 4) + 'v8M' + (pl + sb) + ' ' + (sy - 4) + 'v8"/></g>' +
      '<text x="' + (pl + sb + 6) + '" y="' + (sy + 4) + '" font-size="10.5" fill="#3a4350" font-family="Segoe UI,Arial,sans-serif">5 mm</text>';
    out += '</svg>';
    return { svg: out, caption: r.caption || '' };
  }

  function bodyFill() { return '#2b3038'; }
  function lead() { return 'fill="#c3c9d1" stroke="#6b7480" stroke-width="1"'; }
  function pinCol(c, n) { var p = c.pm[n]; return (p && PINCOL[p.type]) || '#1b1f24'; }
  function pinName(c, n) { var p = c.pm[n]; return p ? p.name : ''; }

  function ic2row(n, bw, bl, overall, pitch, lw, nr, cap) {
    return {
      ext: function () { return [-overall / 2, -bl / 2, overall / 2, bl / 2]; },
      draw: function (c) {
        var m = n / 2, out = (overall - bw) / 2, e = '', i, y, pxl = c.px;
        function py(i) { return (i - (m - 1) / 2) * pitch; }
        for (i = 0; i < m; i++) {
          y = py(i);
          e += '<rect x="' + (-bw / 2 - out) + '" y="' + (y - lw / 2) + '" width="' + (out + 0.15) + '" height="' + lw + '" ' + lead() + '/>';
          e += '<rect x="' + (bw / 2 - 0.15) + '" y="' + (y - lw / 2) + '" width="' + (out + 0.15) + '" height="' + lw + '" ' + lead() + '/>';
        }
        e += '<rect x="' + (-bw / 2) + '" y="' + (-bl / 2) + '" width="' + bw + '" height="' + bl + '" rx="0.2" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
        e += '<path d="M' + (-nr) + ' ' + (-bl / 2) + 'A' + nr + ' ' + nr + ' 0 0 0 ' + nr + ' ' + (-bl / 2) + 'Z" fill="#0e1114"/>';
        var gap = bl / 2 - (m - 1) / 2 * pitch; e += '<circle cx="' + (-bw / 2 + bw * 0.24) + '" cy="' + (-bl / 2 + gap * 0.5) + '" r="' + Math.min(0.4, gap * 0.28) + '" fill="#8a939e"/>';
        var nums = c.names || true;
        for (i = 0; i < m; i++) {
          y = py(i);
          e += c.t(-bw / 2 + 0.3, y + pxl(3.5), String(i + 1), 'start', 9, '#e6edf3', 600);
          e += c.t(bw / 2 - 0.3, y + pxl(3.5), String(n - i), 'end', 9, '#e6edf3', 600);
          if (c.names) {
            e += c.t(-overall / 2 - pxl(6), y + pxl(4), pinName(c, i + 1), 'end', 11.5, pinCol(c, i + 1), 600);
            e += c.t(overall / 2 + pxl(6), y + pxl(4), pinName(c, n - i), 'start', 11.5, pinCol(c, n - i), 600);
          }
        }
        var r = { els: e, pl: c.names ? c.nameW + 14 : 14, pr: c.names ? c.nameW + 14 : 14, caption: cap };
        if (c.dims) {
          e += c.hdim(-bw / 2, bw / 2, bl / 2 + pxl(22), c.fm.trim(bw, 3) + ' mm');
          e += c.vdim(-bl / 2, bl / 2, overall / 2 + pxl(c.names ? c.nameW + 22 : 22), c.fm.trim(bl, 3) + ' mm');
          e += c.hdim(-overall / 2, overall / 2, bl / 2 + pxl(40), c.fm.trim(overall, 3) + ' mm');
          r.els = e; r.pb = 62; r.pr += 78;
        }
        return r;
      }, smax: 36
    };
  }

  function listOnly(extFn, drawFn, cap) {
    return { ext: extFn, draw: function (c) { var r = drawFn(c); r.list = true; r.caption = cap; return r; } };
  }

  var KINDS = {};
  KINDS.dip8 = ic2row(8, 6.35, 9.8, 8.6, 2.54, 0.5, 1.0, 'DIP-8, Draufsicht, Rastermaß 2,54 mm, Reihenabstand 7,62 mm');
  KINDS.dip14 = ic2row(14, 6.35, 19.2, 8.6, 2.54, 0.5, 1.0, 'DIP-14, Draufsicht, Rastermaß 2,54 mm');
  KINDS.dip16 = ic2row(16, 6.35, 19.3, 8.6, 2.54, 0.5, 1.0, 'DIP-16, Draufsicht, Rastermaß 2,54 mm');
  KINDS.soic8 = ic2row(8, 3.9, 4.9, 6.0, 1.27, 0.4, 0.5, 'SOIC-8, Draufsicht, Rastermaß 1,27 mm');
  KINDS.soic16 = ic2row(16, 3.9, 9.9, 6.0, 1.27, 0.4, 0.5, 'SOIC-16, Draufsicht, Rastermaß 1,27 mm');
  KINDS.tssop16 = ic2row(16, 4.4, 5.0, 6.4, 0.65, 0.25, 0.4, 'TSSOP-16, Draufsicht, Rastermaß 0,65 mm');
  KINDS.dip8.smax = 30;

  KINDS.qfn16 = listOnly(function () { return [-2.5, -2.5, 2.5, 2.5]; }, function (c) {
    var e = '', p = 0.5, i, bw = 3, pad = 1.7, pxl = c.px, n = 16;
    e += '<rect x="' + (-bw / 2) + '" y="' + (-bw / 2) + '" width="' + bw + '" height="' + bw + '" rx="0.1" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
    e += '<rect x="' + (-pad / 2) + '" y="' + (-pad / 2) + '" width="' + pad + '" height="' + pad + '" fill="#9aa3ad" stroke="#5b6672" stroke-width="1"/>';
    var pos = [];
    for (i = 0; i < 4; i++) pos.push([-bw / 2, (i - 1.5) * p, 'L']);
    for (i = 0; i < 4; i++) pos.push([(i - 1.5) * p, bw / 2, 'B']);
    for (i = 0; i < 4; i++) pos.push([bw / 2, (1.5 - i) * p, 'R']);
    for (i = 0; i < 4; i++) pos.push([(1.5 - i) * p, -bw / 2, 'T']);
    pos.forEach(function (q, k) {
      var x = q[0], y = q[1], sd = q[2], lw = 0.25, ln = 0.5, rw, rh, rxx, ryy;
      if (sd === 'L') { rxx = x - ln * 0.6; ryy = y - lw / 2; rw = ln; rh = lw; }
      else if (sd === 'R') { rxx = x - ln * 0.4; ryy = y - lw / 2; rw = ln; rh = lw; }
      else if (sd === 'B') { rxx = x - lw / 2; ryy = y - ln * 0.4; rw = lw; rh = ln; }
      else { rxx = x - lw / 2; ryy = y - ln * 0.6; rw = lw; rh = ln; }
      e += '<rect x="' + rxx + '" y="' + ryy + '" width="' + rw + '" height="' + rh + '" ' + lead() + '/>';
      var tx = x, ty = y, a = 'middle', d = 0.78;
      if (sd === 'L') { tx = x - d - 0.1; a = 'end'; ty = y + pxl(3.5); } else if (sd === 'R') { tx = x + d + 0.1; a = 'start'; ty = y + pxl(3.5); }
      else if (sd === 'B') { ty = y + d + pxl(8); } else { ty = y - d - pxl(2); }
      e += c.t(tx, ty, String(k + 1), a, 10.5, pinCol(c, k + 1), 700);
    });
    e += '<circle cx="' + (-bw / 2 + 0.3) + '" cy="' + (-bw / 2 + 0.3) + '" r="0.14" fill="#8a939e"/>';
    var r = { els: e, pl: 44, pr: 20, pt: 24, pb: 24 };
    if (c.dims) { e += c.hdim(-bw / 2, bw / 2, bw / 2 + pxl(40), c.fm.trim(bw, 2) + ' mm'); r.els = e; r.pb = 72; }
    return r;
  }, 'QFN-16, Draufsicht, Rastermaß 0,5 mm, Exposed Pad in der Mitte');

  function threeLead(name, cfg) {
    return listOnly(cfg.ext, function (c) {
      var e = '', cnt = Math.max(c.plist.length, 1), pxl = c.px, i, x;
      var pitch = cfg.pitch(cnt);
      function xi(i) { return (i - (cnt - 1) / 2) * pitch; }
      e += cfg.parts(c, cnt, xi);
      for (i = 0; i < cnt; i++) {
        x = xi(i);
        e += c.t(x, cfg.numY + pxl(14), String(i + 1), 'middle', 11.5, i === 0 ? '#0b4f9c' : pinCol(c, i + 1), 700);
      }
      var r = { els: e, pl: 16, pr: 16, pt: 18, pb: 22 };
      if (cfg.dim && c.dims) { e += cfg.dim(c); r.els = e; r.pt = 30; r.pr = 56; }
      return r;
    }, cfg.cap);
  }
  KINDS.to220 = threeLead('to220', {
    ext: function () { return [-5.1, -3.2, 5.1, 28.6]; }, numY: 28.6, pitch: function (n) { return n > 3 ? 1.7 : 2.54; }, smax: 12,
    cap: 'TO-220, Ansicht auf die bedruckte Seite, Pin 1 links, Kühlfahne = Pin 2 bei Standardtypen',
    parts: function (c, cnt, xi) {
      var e = '', i;
      for (i = 0; i < cnt; i++) e += '<rect x="' + (xi(i) - 0.45) + '" y="15.5" width="0.9" height="13.1" ' + lead() + '/>';
      e += '<path d="M-5 6.5V1.4Q-5 0 -3.6 0H3.6Q5 0 5 1.4V6.5Z" fill="#cfd6dd" stroke="#6b7480" stroke-width="1.2"/>';
      e += '<circle cx="0" cy="3.1" r="1.9" fill="' + PANELBG + '" stroke="#6b7480" stroke-width="1.2"/>';
      e += '<rect x="-5" y="6.5" width="10" height="9" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
      e += c.t(0, 11.6, c.plist.length ? 'TO-220' : '', 'middle', 10, '#e6edf3', 600);
      return e;
    }, dim: function (c) { return c.hdim(-5, 5, -2.2 - 0.8, '10,2 mm'.replace(',', c.fm.dec)) + c.vdim(0, 15.5, 6.8, '15,5 mm'.replace(',', c.fm.dec)); }
  });
  KINDS.to126 = threeLead('to126', {
    ext: function () { return [-4.1, -2.4, 4.1, 25.2]; }, numY: 25.2, pitch: function (n) { return 2.29; }, smax: 14,
    cap: 'TO-126 (SOT-32), Ansicht auf die bedruckte Seite, Pin 1 links',
    parts: function (c, cnt, xi) {
      var e = '', i;
      for (i = 0; i < cnt; i++) e += '<rect x="' + (xi(i) - 0.4) + '" y="11" width="0.8" height="14.2" ' + lead() + '/>';
      e += '<path d="M-3.9 11V1.2Q-3.9 0 -2.7 0H2.7Q3.9 0 3.9 1.2V11Z" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
      e += '<circle cx="0" cy="2.7" r="1.35" fill="' + PANELBG + '" stroke="#0e1114" stroke-width="1.2"/>';
      e += '<rect x="-3.9" y="5" width="7.8" height="0.5" fill="#cfd6dd"/>';
      e += c.t(0, 9.4, 'TO-126', 'middle', 9, '#e6edf3', 600);
      return e;
    }, dim: function (c) { return c.hdim(-3.9, 3.9, -1.6, '7,8 mm'.replace(',', c.fm.dec)) + c.vdim(0, 11, 5.6, '11 mm'); }
  });
  KINDS.to92 = threeLead('to92', {
    ext: function () { return [-2.6, -2.2, 2.6, 12.6]; }, numY: 12.6, pitch: function (n) { return 1.27; }, smax: 22,
    cap: 'TO-92, Ansicht von der flachen (bedruckten) Seite, Anschlüsse nach unten, Pin 1 links',
    parts: function (c, cnt, xi) {
      var e = '', i;
      for (i = 0; i < cnt; i++) e += '<rect x="' + (xi(i) - 0.25) + '" y="4.6" width="0.5" height="8" ' + lead() + '/>';
      e += '<path d="M-2.35 4.8V2.4A2.35 2.35 0 0 1 2.35 2.4V4.8Z" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
      e += c.t(0, 4.0, 'TO-92', 'middle', 7.5, '#e6edf3', 600);
      return e;
    }, dim: function (c) { return c.hdim(-2.35, 2.35, -1.3, '4,7 mm'.replace(',', c.fm.dec)); }
  });
  KINDS.sot23 = threeLead('sot23', {
    ext: function () { return [-1.9, -1.9, 1.9, 1.9]; }, numY: 1.4, pitch: function () { return 1.9; }, smax: 40,
    cap: 'SOT-23, Draufsicht; Pin 1 links unten, Pin 2 rechts unten, Pin 3 oben',
    parts: function (c) {
      var e = '';
      e += '<rect x="-1.15" y="0.6" width="0.4" height="0.8" ' + lead() + '/><rect x="0.75" y="0.6" width="0.4" height="0.8" ' + lead() + '/><rect x="-0.2" y="-1.4" width="0.4" height="0.8" ' + lead() + '/>';
      e += '<rect x="-1.45" y="-0.65" width="2.9" height="1.3" rx="0.12" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/><circle cx="-1.1" cy="0.3" r="0.1" fill="#8a939e"/>';
      return e;
    }, dim: function (c) { return c.hdim(-1.45, 1.45, -2.6, '2,9 mm'.replace(',', c.fm.dec)); }
  });
  // SOT-23: Nummern passend zur Lage (nicht in einer Reihe)
  KINDS.sot23 = listOnly(KINDS.sot23.ext, function (c) {
    var e = '', pxl = c.px;
    e += '<rect x="-1.15" y="0.6" width="0.4" height="0.8" ' + lead() + '/><rect x="0.75" y="0.6" width="0.4" height="0.8" ' + lead() + '/><rect x="-0.2" y="-1.4" width="0.4" height="0.8" ' + lead() + '/>';
    e += '<rect x="-1.45" y="-0.65" width="2.9" height="1.3" rx="0.12" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/><circle cx="-1.15" cy="0.32" r="0.09" fill="#8a939e"/>';
    e += c.t(-0.95, 1.4 + pxl(14), '1', 'middle', 11.5, '#0b4f9c', 700) + c.t(0.95, 1.4 + pxl(14), '2', 'middle', 11.5, pinCol(c, 2), 700) + c.t(0, -1.4 - pxl(5), '3', 'middle', 11.5, pinCol(c, 3), 700);
    var r = { els: e, pl: 16, pr: 16, pt: 18, pb: 18 };
    if (c.dims) { e += c.hdim(-1.45, 1.45, -2.0 - pxl(6), c.fm.trim(2.9, 3) + ' mm'); r.els = e; r.pt = 40; }
    return r;
  }, 'SOT-23, Draufsicht; Pin 1 links unten, Pin 2 rechts unten, Pin 3 oben');
  KINDS.sot223 = listOnly(function () { return [-3.4, -3.9, 3.4, 3.9]; }, function (c) {
    var e = '', pxl = c.px, i, xs = [-2.3, 0, 2.3];
    for (i = 0; i < 3; i++) e += '<rect x="' + (xs[i] - 0.4) + '" y="1.6" width="0.8" height="2.1" ' + lead() + '/>';
    e += '<rect x="-1.5" y="-3.7" width="3" height="2.1" fill="#cfd6dd" stroke="#6b7480" stroke-width="1"/>';
    e += '<rect x="-3.25" y="-1.75" width="6.5" height="3.5" rx="0.12" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/><circle cx="-2.7" cy="1.2" r="0.17" fill="#8a939e"/>';
    for (i = 0; i < 3; i++) e += c.t(xs[i], 3.7 + pxl(14), String(i + 1), 'middle', 11.5, i === 0 ? '#0b4f9c' : pinCol(c, i + 1), 700);
    e += c.t(0, -3.7 - pxl(5), '4 (Tab)', 'middle', 10.5, '#3a4350', 700);
    var r = { els: e, pl: 16, pr: 16, pt: 22, pb: 22 };
    if (c.dims) { e += c.hdim(-3.25, 3.25, -4.5 - pxl(10), c.fm.trim(6.5, 3) + ' mm'); r.els = e; r.pt = 44; }
    return r;
  }, 'SOT-223, Draufsicht; Pin 1 links, Kühlfahne = Pin 4');
  KINDS.sot223.smax = 30;

  function axial(L, d, leadL, band, glass, cap, smax) {
    var k = listOnly(function () { return [-(L / 2 + leadL), -d / 2 - 2.2, L / 2 + leadL, d / 2 + 0.5]; }, function (c) {
      var e = '', pxl = c.px, a = c.plist.length ? c.plist : [{ n: 1, name: 'K' }, { n: 2, name: 'A' }];
      var left = a[0], right = a[1] || a[0];
      for (var i = 0; i < a.length; i++) if (/^(k|c|cath)/i.test(String(a[i].name))) { left = a[i]; right = a[1 - i] || a[i]; }
      e += '<rect x="' + (-(L / 2 + leadL)) + '" y="-0.25" width="' + (L + 2 * leadL) + '" height="0.5" ' + lead() + '/>';
      e += '<rect x="' + (-L / 2) + '" y="' + (-d / 2) + '" width="' + L + '" height="' + d + '" rx="' + (glass ? d / 2 * 0.7 : 0.25) + '" fill="' + (glass ? '#c98a2b' : bodyFill()) + '" stroke="#0e1114" stroke-width="1.2"/>';
      e += '<rect x="' + (-L / 2) + '" y="' + (-d / 2) + '" width="' + band + '" height="' + d + '" fill="' + (glass ? '#1b1f24' : '#d8dde3') + '" stroke="#0e1114" stroke-width="1"/>';
      e += c.t(-(L / 2 + leadL) + 0.3, d / 2 + 0.2 + pxl(14), '1: ' + (left.name || ''), 'start', 11, pinCol(c, left.n), 700);
      e += c.t((L / 2 + leadL) - 0.3, d / 2 + 0.2 + pxl(14), '2: ' + (right.name || ''), 'end', 11, pinCol(c, right.n), 700);
      e += c.t(-L / 2 + band / 2, -d / 2 - pxl(5), 'Kathodenring', 'start', 10, '#3a4350', 600);
      var r = { els: e, pl: 14, pr: 14, pt: 22, pb: 22 };
      if (c.dims) { e += c.hdim(-L / 2, L / 2, -d / 2 - 1.5 - pxl(14), c.fm.trim(L, 3) + ' mm') + c.vdim(-d / 2, d / 2, L / 2 + 0.8, 'Ø ' + c.fm.trim(d, 3) + ' mm'); r.els = e; r.pt = 36; r.pr = 80; }
      return r;
    }, cap);
    k.smax = smax; return k;
  }
  KINDS.do35 = axial(3.9, 1.9, 8, 0.8, true, 'DO-35 (Glasgehäuse), Ring = Kathode', 24);
  KINDS.do41 = axial(5.2, 2.7, 8, 1.0, false, 'DO-41, Ring = Kathode', 18);
  KINDS.sod123 = listOnly(function () { return [-1.95, -1.1, 1.95, 1.1]; }, function (c) {
    var e = '', pxl = c.px;
    e += '<rect x="-1.85" y="-0.4" width="1" height="0.8" ' + lead() + '/><rect x="0.85" y="-0.4" width="1" height="0.8" ' + lead() + '/>';
    e += '<rect x="-1.35" y="-0.8" width="2.7" height="1.6" rx="0.15" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>';
    e += '<rect x="-1.35" y="-0.8" width="0.42" height="1.6" fill="#d8dde3" stroke="#0e1114" stroke-width="1"/>';
    e += c.t(-1.5, 0.8 + pxl(14), '1 (K)', 'middle', 10.5, pinCol(c, 1), 700) + c.t(1.5, 0.8 + pxl(14), '2 (A)', 'middle', 10.5, pinCol(c, 2), 700);
    var r = { els: e, pl: 24, pr: 24, pt: 30, pb: 22 };
    if (c.dims) { e += c.hdim(-1.35, 1.35, -1.2 - pxl(8), c.fm.trim(2.7, 3) + ' mm'); r.els = e; r.pt = 46; }
    return r;
  }, 'SOD-123, Draufsicht, Ring = Kathode');
  KINDS.sod123.smax = 36;
  KINDS.led5 = listOnly(function () { return [-3.1, -0.4, 3.1, 14.4]; }, function (c) {
    var e = '', pxl = c.px;
    e += '<rect x="-1.5" y="8.6" width="0.5" height="5.6" ' + lead() + '/><rect x="1.0" y="8.6" width="0.5" height="7.2" ' + lead() + '/>';
    e += '<path d="M-2.5 3.1A2.5 2.5 0 0 1 2.5 3.1V7.6H2.9V8.6H-2.4L-2.9 8.1V7.6H-2.5Z" fill="#e0443a" fill-opacity="0.75" stroke="#7b1a14" stroke-width="1.2"/>';
    e += '<path d="M-2.9 8.1L-2.4 8.6" stroke="#7b1a14" stroke-width="1.2"/>';
    var k = c.plist.length ? c.plist : [{ n: 1, name: 'K' }, { n: 2, name: 'A' }];
    e += c.t(-1.25, 14.2 + pxl(14), '1', 'middle', 11.5, pinCol(c, 1), 700) + c.t(1.25, 14.2 + pxl(14), '2', 'middle', 11.5, pinCol(c, 2), 700);
    
    var r = { els: e, pl: 16, pr: 16, pt: 16, pb: 28 };
    if (c.dims) { e += c.hdim(-2.5, 2.5, -1.2, '5,0 mm'.replace(',', c.fm.dec)); r.els = e; r.pt = 34; }
    return r;
  }, 'LED 5 mm, Seitenansicht; Abflachung am Flansch und kürzerer Anschluss = Kathode');
  KINDS.led5.smax = 24;
  KINDS.generic = listOnly(function () { return [-6, -3, 6, 3]; }, function (c) {
    return { els: '<rect x="-5" y="-2.5" width="10" height="5" rx="0.4" fill="' + bodyFill() + '" stroke="#0e1114" stroke-width="1.2"/>' + c.t(0, 0.4, 'Gehäuse', 'middle', 11, '#e6edf3', 600), pl: 16, pr: 16, pt: 16, pb: 16 };
  }, 'Gehäuse (schematisch)');
  KINDS.axial = KINDS.do41; KINDS.to2205 = KINDS.to220; KINDS.sot32 = KINDS.to126; KINDS.led = KINDS.led5; KINDS.radial = KINDS.led5;

  /* ---------- Zeitdiagramm ---------- */
  function timingSvg(t, F) {
    var sigs = t.signals || [], slot = 34, lab = 100, rowH = 46, top = 24, sl = 4, n = 0, i, j;
    var waves = sigs.map(function (s) {
      var w = String(s.wave || ''), out = [], last = 'x';
      for (j = 0; j < w.length; j++) { var ch = w[j].toLowerCase(); if (ch === '.') ch = last; if ('01xz'.indexOf(ch) < 0) ch = 'x'; out.push(ch); last = ch; }
      n = Math.max(n, out.length); return out;
    });
    if (!n) n = 1;
    var W = lab + n * slot + 16, H = top + sigs.length * rowH + 10;
    var o = '<svg class="dsv-tm" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(t.title || 'Zeitdiagramm') + '">';
    o += '<defs><pattern id="h' + (++uid) + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#eef1f5"/><line x1="0" y1="0" x2="0" y2="5" stroke="#9aa5b1" stroke-width="1.5"/></pattern></defs>';
    var hid = 'h' + uid;
    for (j = 0; j <= n; j++) o += '<line x1="' + (lab + j * slot) + '" y1="' + (top - 6) + '" x2="' + (lab + j * slot) + '" y2="' + (H - 6) + '" stroke="#d3d8de" stroke-width="1" stroke-dasharray="2 4"/>';
    for (j = 0; j < n; j++) o += '<text x="' + (lab + j * slot + slot / 2) + '" y="14" font-size="10" fill="#8a939e" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif">t' + j + '</text>';
    sigs.forEach(function (s, si) {
      var y0 = top + si * rowH, hi = y0 + 9, lo = y0 + rowH - 13, mid = (hi + lo) / 2, w = waves[si], k, r;
      o += '<rect class="dsv-sigbg" data-mk data-sec="timing" data-key="' + esc(s.name) + '" x="2" y="' + y0 + '" width="' + (W - 4) + '" height="' + rowH + '" rx="4" fill="transparent"/>';
      o += '<text x="' + (lab - 10) + '" y="' + (mid + 4) + '" text-anchor="end" font-size="13" font-weight="700" fill="#1b1f24" font-family="Segoe UI,Arial,sans-serif" pointer-events="none">' + esc(s.name) + '</text>';
      var runs = [];
      for (k = 0; k < w.length; k++) {
        var cl = (w[k] === '0' || w[k] === '1') ? 'L' : w[k];
        if (runs.length && runs[runs.length - 1].c === cl) runs[runs.length - 1].e = k + 1; else runs.push({ c: cl, s: k, e: k + 1 });
      }
      runs.forEach(function (rn, ri) {
        var xs = lab + rn.s * slot, xe = lab + rn.e * slot, prev = runs[ri - 1], next = runs[ri + 1], d;
        if (rn.c === 'x') {
          o += '<path d="M' + xs + ' ' + mid + 'L' + (xs + sl) + ' ' + hi + 'H' + (xe - sl) + 'L' + xe + ' ' + mid + 'L' + (xe - sl) + ' ' + lo + 'H' + (xs + sl) + 'Z" fill="url(#' + hid + ')" stroke="#0b4f9c" stroke-width="1.6" pointer-events="none"/>';
        } else if (rn.c === 'z') {
          o += '<path d="M' + xs + ' ' + mid + 'H' + xe + '" stroke="#6b7480" stroke-width="1.6" stroke-dasharray="5 3" fill="none" pointer-events="none"/>';
        } else {
          var yl = function (kk) { return w[kk] === '1' ? hi : lo; };
          d = prev ? 'M' + xs + ' ' + mid + 'L' + (xs + sl) + ' ' + yl(rn.s) : 'M' + xs + ' ' + yl(rn.s);
          for (k = rn.s + 1; k < rn.e; k++) if (yl(k) !== yl(k - 1)) d += 'L' + (lab + k * slot - sl) + ' ' + yl(k - 1) + 'L' + (lab + k * slot + sl) + ' ' + yl(k);
          d += next ? 'L' + (xe - sl) + ' ' + yl(rn.e - 1) + 'L' + xe + ' ' + mid : 'L' + xe + ' ' + yl(rn.e - 1);
          o += '<path d="' + d + '" stroke="#0b4f9c" stroke-width="2" fill="none" stroke-linejoin="round" pointer-events="none"/>';
        }
      });
      o += '<text x="' + (lab - 10) + '" y="' + (hi + 3) + '" text-anchor="end" font-size="9" fill="#8a939e" font-family="Segoe UI,Arial,sans-serif" pointer-events="none"></text>';
    });
    return o + '</svg>';
  }

  /* ---------- Formeln: Indizes ---------- */
  function fmHtml(s) {
    var e = esc(String(s).replace(/\*/g, '·'));
    return e.replace(/(^|[^A-Za-zÀ-ž])([VIRPCLTfQ])([A-Za-z]{1,5}|\d{1,2})(?![A-Za-z0-9])/g, function (m, p, a, b) { return p + '<i>' + a + '</i><sub>' + b + '</sub>'; });
  }
  /* Text-Schaltbild (Linienzeichen) -> SVG: Linien als echte Striche, [Bauteile] als Kästchen */
  var LN = { '─': 'lr', '│': 'ud', '┌': 'dr', '┐': 'dl', '└': 'ur', '┘': 'ul', '├': 'udr', '┤': 'udl', '┬': 'dlr', '┴': 'ulr', '┼': 'udlr', '━': 'lr', '┃': 'ud', '╌': 'lr', '┄': 'lr' };
  function circuitSvg(lines) {
    var cw = 9.4, ch = 24, pad = 12, n = lines.length, cols = 0, i, j;
    lines.forEach(function (l) { cols = Math.max(cols, Array.from(l).length); });
    var W = cols * cw + pad * 2, H = n * ch + pad * 2;
    var grid = lines.map(function (l) { return Array.from(l); });
    function isLine(c) { return !!LN[c] || c === '-' || c === '|'; }
    var o = '<svg class="dsv-cks" viewBox="0 0 ' + W + ' ' + H + '" style="max-width:' + Math.round(W) + 'px" role="img" aria-label="Schaltbild" font-family="Consolas,\'DejaVu Sans Mono\',\'Courier New\',monospace" font-size="13">';
    var seg = '', dots = '', txt = '', boxes = '';
    var skip = grid.map(function (r) { return r.map(function () { return false; }); });
    for (i = 0; i < n; i++) {
      var row = grid[i], x0;
      /* Kästchen */
      for (j = 0; j < row.length; j++) {
        if (row[j] === '[') {
          var k = row.indexOf(']', j);
          if (k > j) {
            var label = row.slice(j + 1, k).join('').trim();
            boxes += '<rect x="' + (pad + j * cw) + '" y="' + (pad + i * ch + 2) + '" width="' + ((k - j + 1) * cw) + '" height="' + (ch - 4) + '" rx="3" fill="#eef4fb" stroke="#0b4f9c" stroke-width="1.6"/>' +
              '<text x="' + (pad + (j + k + 1) / 2 * cw) + '" y="' + (pad + i * ch + ch / 2 + 4.5) + '" text-anchor="middle" font-weight="700" fill="#0b4f9c">' + esc(label) + '</text>';
            for (x0 = j; x0 <= k; x0++) skip[i][x0] = true;
            j = k;
          }
        }
      }
    }
    for (i = 0; i < n; i++) {
      var r = grid[i], run = '', rs = 0;
      function flush(end) { if (run.trim()) { var t0 = run.replace(/^\s+/, ''), lead = run.length - t0.length, t1 = t0.replace(/\s+$/, ''); txt += '<text x="' + (pad + (rs + lead) * cw) + '" y="' + (pad + i * ch + ch / 2 + 4.5) + '" fill="#1b1f24" textLength="' + (t1.length * cw) + '" lengthAdjust="spacingAndGlyphs" xml:space="preserve">' + esc(t1) + '</text>'; } run = ''; }
      for (j = 0; j < r.length; j++) {
        var c = r[j];
        if (skip[i][j]) { flush(); continue; }
        var dirs = LN[c] || '';
        if (!dirs && (c === '-' || c === '|')) {
          var pv = r[j - 1], nx = r[j + 1];
          if (c === '|') dirs = 'ud';
          else if (isLine(pv) || isLine(nx) || pv === ']' || nx === '[' || (skip[i][j - 1]) || (skip[i][j + 1])) dirs = 'lr';
        }
        if (dirs) {
          flush();
          var cx = pad + j * cw + cw / 2, cy = pad + i * ch + ch / 2;
          if (dirs.indexOf('u') >= 0) seg += 'M' + cx + ' ' + (cy - ch / 2) + 'V' + cy;
          if (dirs.indexOf('d') >= 0) seg += 'M' + cx + ' ' + cy + 'V' + (cy + ch / 2);
          if (dirs.indexOf('l') >= 0) seg += 'M' + (cx - cw / 2) + ' ' + cy + 'H' + cx;
          if (dirs.indexOf('r') >= 0) seg += 'M' + cx + ' ' + cy + 'H' + (cx + cw / 2);
          if (dirs.length >= 3) dots += '<circle cx="' + cx + '" cy="' + cy + '" r="3" fill="#1b1f24"/>';
          continue;
        }
        if ('▲▼►◄▶◀→←'.indexOf(c) >= 0) {
          flush();
          txt += '<text x="' + (pad + j * cw + cw / 2) + '" y="' + (pad + i * ch + ch / 2 + 4.5) + '" text-anchor="middle" fill="#c0392b" font-weight="700">' + esc(c) + '</text>';
          continue;
        }
        if (!run) rs = j; run += c;
      }
      flush();
    }
    o += '<path d="' + seg + '" stroke="#1b1f24" stroke-width="1.7" stroke-linecap="square" fill="none"/>' + dots + boxes + txt + '</svg>';
    return o;
  }

  /* ---------- CSS ---------- */
  var CSS = [
    '.dsv{position:relative;display:flex;flex-direction:column;height:100%;min-height:420px;background:#14181c;color:#e6edf3;font:14px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow:hidden;border-radius:10px;-webkit-text-size-adjust:100%}',
    '.dsv *{box-sizing:border-box}',
    '.dsv-bar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;background:#222830;border-bottom:1px solid #38424d;flex:none}',
    '.dsv-bar button,.dsv-bar select,.dsv-bar input{min-height:40px;border-radius:9px;border:1px solid #38424d;background:#2c343e;color:#e6edf3;font:inherit;padding:0 12px}',
    '.dsv-bar button{cursor:pointer;min-width:40px;touch-action:manipulation}',
    '.dsv-bar button:hover,.dsv-bar button:focus-visible{border-color:#3b9eff;outline:none}',
    '.dsv-bar button.on{background:#17405f;border-color:#3b9eff}',
    '.dsv-bar button:disabled{opacity:.4;cursor:default}',
    '.dsv-bar input{min-width:120px;flex:1 1 150px;max-width:300px}',
    '.dsv-bar select{max-width:190px}',
    '.dsv-narrow .dsv-bar{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}',
    '.dsv-narrow .dsv-bar>*{flex:none}.dsv-narrow .dsv-bar input{width:150px;flex:none}',
    '.dsv-sep{width:1px;height:26px;background:#38424d;margin:0 2px}',
    '.dsv-cnt{font-size:12px;color:#8d99a6;min-width:46px;text-align:center}',
    '.dsv-zp{font-size:13px;color:#cdd6df;min-width:48px;text-align:center}',
    '.dsv-mode{margin-left:auto;font-size:12px;font-weight:700;padding:6px 10px;border-radius:999px;border:1px solid #38424d;letter-spacing:.03em;white-space:nowrap}',
    '.dsv-m-lesen .dsv-mode{color:#3b9eff;border-color:#3b9eff}.dsv-m-ablesen .dsv-mode{color:#4cd964;border-color:#4cd964}.dsv-m-quiz .dsv-mode{color:#ffb340;border-color:#ffb340}',
    '.dsv-main{flex:1;display:flex;min-height:0;position:relative}',
    '.dsv-stage{flex:1;overflow:auto;position:relative;padding:18px;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y;background:#14181c;min-width:0}',
    '.dsv-wrap{position:relative;margin:0 auto}',
    '.dsv-pages{width:794px;transform-origin:0 0;position:absolute;left:0;top:0}',
    '.dsv-empty{padding:40px;text-align:center;color:#8d99a6}',
    /* Seite */
    '.dsv-page{width:794px;min-height:1123px;margin:0 0 24px;background:' + PANELBG + ';color:#1b1f24;padding:40px 52px 30px;position:relative;box-shadow:0 8px 28px rgba(0,0,0,.55);font:12.5px/1.45 "Segoe UI","Helvetica Neue",Arial,sans-serif;display:flex;flex-direction:column;user-select:text;-webkit-user-select:text}',
    '.dsv-ph{display:flex;justify-content:space-between;border-bottom:2px solid #0b4f9c;padding-bottom:6px;margin-bottom:18px;font-size:11px;color:#4a5461;letter-spacing:.02em}',
    '.dsv-ph b{color:#0b4f9c;font-size:12px}',
    '.dsv-pc{flex:1}',
    '.dsv-pf{display:flex;justify-content:space-between;border-top:1px solid #c9ced4;margin-top:22px;padding-top:6px;font-size:10.5px;color:#6a7480}',
    '.dsv-page h2{font-size:19px;color:#0b4f9c;margin:0 0 10px;display:flex;align-items:baseline;gap:10px;font-weight:700}',
    '.dsv-page h2 .n{background:#0b4f9c;color:#fff;border-radius:4px;padding:1px 8px;font-size:15px}',
    '.dsv-page h3{font-size:13.5px;color:#0b4f9c;margin:16px 0 6px;font-weight:700}',
    '.dsv-page p{margin:0 0 8px}',
    '.dsv-sub{color:#5b6672;font-size:11.5px;margin:-4px 0 10px}',
    /* Titelseite */
    '.dsv-cv-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:26px}',
    '.dsv-brand{font-weight:800;letter-spacing:.14em;color:#0b4f9c;font-size:12px}',
    '.dsv-ribbon{background:#ffb340;color:#1b1f24;font-weight:800;font-size:11px;letter-spacing:.1em;padding:4px 12px;border-radius:3px}',
    '.dsv-part{font-size:50px;line-height:1.05;margin:0;color:#0b4f9c;font-weight:800;letter-spacing:-.01em}',
    '.dsv-fam{display:inline-block;margin:8px 0 6px;background:#e8eef6;color:#0b4f9c;font-weight:700;font-size:12px;padding:3px 10px;border-radius:999px}',
    '.dsv-ttl{font-size:21px;line-height:1.25;margin:4px 0 18px;font-weight:600;color:#1b1f24;border-bottom:3px solid #0b4f9c;padding-bottom:12px}',
    '.dsv-cols{display:flex;gap:26px}.dsv-cl{flex:1.25;min-width:0}.dsv-cr{flex:1;min-width:0}',
    '.dsv-feat{list-style:none;margin:0 0 6px;padding:0}',
    '.dsv-feat li{position:relative;padding:5px 6px 5px 22px;border-radius:4px}',
    '.dsv-feat li:before{content:"";position:absolute;left:6px;top:11px;width:7px;height:7px;background:#0b4f9c;border-radius:50%}',
    '.dsv-fig{margin:0 0 14px;border-radius:6px;padding:4px}',
    '.dsv-pkbox{border:1px solid #d3d8de;border-radius:8px;padding:8px;background:#fff}',
    '.dsv-pkbox svg{display:block;width:100%;height:auto}',
    '.dsv-pk g *{vector-effect:non-scaling-stroke}',
    '.dsv-cap{font-size:11px;color:#5b6672;margin-top:4px}',
    '.dsv-disc{margin-top:18px;border:1px dashed #b36b00;background:#fff8e8;color:#5c3d00;padding:8px 12px;border-radius:6px;font-size:11px}',
    /* Tabellen */
    '.dsv-t{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:6px}',
    '.dsv-t th{background:#e8eef6;color:#0b4f9c;text-align:left;font-weight:700;padding:7px 7px;border-bottom:2px solid #0b4f9c;font-size:11.5px}',
    '.dsv-t td{padding:9px 7px;border-bottom:1px solid #d7dce2;vertical-align:top;height:40px}',
    '.dsv-t .num{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}',
    '.dsv-t .sym{font-family:"Cambria Math",Cambria,"Times New Roman",serif;font-style:italic;white-space:nowrap}',
    '.dsv-t .cd{color:#3a4350;font-size:11.5px}',
    '.dsv-t .nt{display:block;color:#6a7480;font-size:10.5px;font-style:italic;margin-top:2px}',
    '.dsv-t .tj{display:block;color:#6a7480;font-size:10.5px;margin-top:2px}',
    '.dsv-t.abs th{background:#fdecc8;color:#7a4a00;border-bottom-color:#b36b00}',
    '.dsv-t.tr td.out{background:#f1f5fa}',
    '.dsv-warn{display:flex;border:2px solid #b36b00;background:#fff4dd;margin:0 0 12px;border-radius:3px;overflow:hidden}',
    '.dsv-warn:before{content:"";flex:none;width:24px;background:repeating-linear-gradient(-45deg,#1b1f24 0 7px,#ffb340 7px 14px)}',
    '.dsv-warn p{margin:0;padding:8px 12px;color:#5c3d00;font-size:11.5px}',
    '.dsv-warn b{color:#7a4a00}',
    '.dsv-chip2{display:inline-block;padding:1px 8px;border-radius:999px;color:#fff;font-size:10.5px;font-weight:700}',
    /* Markierung / Fokus */
    '[data-mk]{cursor:pointer}',
    '@media (hover:hover){tr[data-mk]:hover td,li[data-mk]:hover,div[data-mk]:hover{background:#eef4fb}}',
    'tr.dsv-marked td,li.dsv-marked,div.dsv-marked{background:#fff0a8!important}',
    'tr.dsv-marked td:first-child{box-shadow:inset 4px 0 0 #f2a900}',
    'li.dsv-marked,div.dsv-marked{box-shadow:inset 4px 0 0 #f2a900}',
    '.dsv-sigbg.dsv-marked{fill:#fff0a8}',
    '@keyframes dsvfl{0%,40%{background:#ffd166;box-shadow:0 0 0 3px #ff9f1a}100%{background:transparent;box-shadow:0 0 0 0 rgba(255,159,26,0)}}',
    '@keyframes dsvflo{0%,40%{outline-color:#ff9f1a;background:rgba(255,209,102,.35)}100%{outline-color:transparent;background:transparent}}',
    '@keyframes dsvfsv{0%,40%{fill:#ffd166}100%{fill:transparent}}',
    'tr.dsv-flash td{animation:dsvfl 2.6s ease-out 1}',
    '.dsv-flash.fl{animation:dsvflo 2.6s ease-out 1;outline:3px solid #ff9f1a;outline-offset:2px}',
    '.dsv-sigbg.dsv-flash{animation:dsvfsv 2.6s ease-out 1}',
    '.dsv-glhi{animation:dsvfl 2.6s ease-out 1}',
    /* Kennlinien */
    '.dsv-graph figcaption{font-weight:700;color:#1b1f24;margin:0 0 6px;display:flex;align-items:center;gap:8px}',
    '.dsv-graph figcaption .fn{color:#0b4f9c}',
    '.dsv-mkb{margin-left:auto;min-width:40px;min-height:40px;border:1px solid #c9ced4;border-radius:8px;background:#fff;color:#8a939e;font-size:18px;cursor:pointer;line-height:1}',
    '.dsv-mkb.on{color:#d49300;background:#fff0a8;border-color:#d49300}',
    '.dsv-plot{display:block;width:100%;height:auto;touch-action:pan-y;background:#fff;border-radius:4px;cursor:crosshair;outline:none}',
    '.dsv-plot:focus-visible{box-shadow:0 0 0 2px #3b9eff}',
    '.dsv-legend{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}',
    '.dsv-lg{display:inline-flex;align-items:center;gap:7px;border:1px solid #c9ced4;background:#fff;border-radius:8px;min-height:40px;padding:2px 10px;font:inherit;color:#1b1f24;cursor:pointer;text-align:left}',
    '.dsv-lg small{color:#5b6672;font-size:10.5px;display:block;line-height:1.2}',
    '.dsv-lg.act{border-color:#0b4f9c;background:#eaf2fc;box-shadow:inset 0 0 0 1px #0b4f9c}',
    '.dsv-readout{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:8px;padding:6px 10px;border:1px solid #d3d8de;border-radius:8px;background:#f4f7fb;min-height:46px}',
    '.dsv-readout .k{color:#5b6672;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-right:4px}',
    '.dsv-readout b{font-size:15px;font-variant-numeric:tabular-nums}',
    '.dsv-readout .oth{font-size:11.5px;color:#3a4350}',
    '.dsv-readout .hint{color:#6a7480;font-size:11.5px}',
    '.dsv-readout button{min-height:40px;min-width:40px;border:1px solid #9aa5b1;background:#fff;color:#1b1f24;border-radius:8px;font:inherit;cursor:pointer;padding:0 10px}',
    '.dsv-readout button.take{background:#1f8f4d;color:#fff;border-color:#1f8f4d;font-weight:700}',
    '.dsv-readout .sp{flex:1}',
    '.dsv-m-quiz .dsv-readout,.dsv-m-quiz .dsv-curtag{display:none}',
    '.dsv-note{font-size:11px;color:#5b6672;margin-top:6px}',
    /* Rest */
    '.dsv-tm{display:block;width:100%;height:auto;background:#fff;border:1px solid #d3d8de;border-radius:6px}',
    '.dsv-formula{font:italic 17px/1.5 "Cambria Math",Cambria,"Times New Roman",serif;background:#f4f7fb;border-left:4px solid #0b4f9c;padding:8px 14px;margin:6px 0;border-radius:0 6px 6px 0}',
    '.dsv-formula.ex{font:13px/1.5 "Segoe UI",Arial,sans-serif;border-left-color:#8a939e}',
    '.dsv-formula sub{font-size:.68em;font-style:normal}',
    '.dsv-formula i{font-style:italic}',
    '.dsv-ckt{background:#fff;border:1px solid #cfd5dc;border-radius:6px;padding:8px;margin:8px 0;overflow:hidden}',
    '.dsv-cks{display:block;width:100%;height:auto;margin:0 auto}',
    '.dsv-apps h3{margin-top:4px}',
    '.dsv-gl{border-bottom:1.5px dotted #0b7bd6;cursor:help}',
    '.dsv-m-quiz .dsv-gl{border-bottom:0;cursor:inherit}',
    'mark.dsv-hit{background:#ffe066;color:inherit;border-radius:2px;padding:0;box-shadow:0 0 0 1px #e6b800}',
    'mark.dsv-hit.cur{background:#ff9f1a;box-shadow:0 0 0 2px #ff6b00}',
    'svg text.dsv-hitsvg{fill:#e8590c!important;font-weight:800}',
    '.dsv-th svg{display:block;width:100%;height:auto}',
    /* Seitenleiste */
    '.dsv-side{width:290px;flex:none;background:#1b2026;border-left:1px solid #38424d;display:flex;flex-direction:column;min-height:0}',
    '.dsv-side[hidden]{display:none}',
    '.dsv-tabs{display:flex;border-bottom:1px solid #38424d}',
    '.dsv-tabs button{flex:1;min-height:42px;background:none;border:0;border-bottom:3px solid transparent;color:#8d99a6;font:inherit;font-weight:600;cursor:pointer}',
    '.dsv-tabs button.on{color:#e6edf3;border-bottom-color:#3b9eff}',
    '.dsv-slist{overflow:auto;flex:1;padding:8px;-webkit-overflow-scrolling:touch}',
    '.dsv-gi{border:1px solid #38424d;border-radius:10px;margin-bottom:6px;background:#222830}',
    '.dsv-gi>button{display:block;width:100%;text-align:left;min-height:42px;padding:8px 12px;background:none;border:0;color:#e6edf3;font:inherit;font-weight:600;cursor:pointer}',
    '.dsv-gi .d{display:none;padding:0 12px 10px;color:#cdd6df}',
    '.dsv-gi.open .d{display:block}.dsv-gi.open>button{color:#3b9eff}',
    '.dsv-gi .d i{display:block;color:#8d99a6;font-size:12px;margin-top:4px}',
    '.dsv-gi .d button{margin-top:8px;min-height:40px;border:1px solid #38424d;background:#2c343e;color:#e6edf3;border-radius:8px;font:inherit;padding:0 12px;cursor:pointer}',
    '.dsv-mi{display:block;width:100%;text-align:left;min-height:44px;margin-bottom:6px;padding:8px 12px;border:1px solid #38424d;border-radius:10px;background:#222830;color:#e6edf3;font:inherit;cursor:pointer}',
    '.dsv-mi small{display:block;color:#8d99a6}',
    '.dsv-sempty{color:#8d99a6;padding:12px;font-size:13px}',
    '.dsv-m-quiz .dsv-sidebtn{display:none}',
    '.dsv-narrow .dsv-side{position:absolute;right:0;top:0;bottom:0;z-index:20;width:min(320px,88%);box-shadow:-10px 0 28px rgba(0,0,0,.55)}',
    '.dsv-pop{position:absolute;z-index:40;max-width:290px;background:#222830;border:1px solid #3b9eff;border-radius:10px;padding:10px 14px;box-shadow:0 10px 30px rgba(0,0,0,.6);color:#e6edf3;font-size:13.5px}',
    '.dsv-pop b{color:#3b9eff;display:block;margin-bottom:2px}.dsv-pop i{display:block;color:#8d99a6;font-size:12px;margin-top:4px}',
    /* Druck */
    '@media print{body.dsv-printing>*:not(.dsv-printroot){display:none!important}',
    'body.dsv-printing{background:#fff!important}',
    '.dsv-printroot .dsv-pages{position:static!important;transform:none!important;width:auto!important}',
    '.dsv-printroot .dsv-page{width:auto!important;min-height:0!important;box-shadow:none!important;margin:0!important;page-break-after:always;break-after:page;padding:10mm 12mm}',
    '.dsv-printroot .dsv-readout,.dsv-printroot .dsv-mkb,.dsv-printroot .dsv-lg{display:none!important}',
    '.dsv-printroot .dsv-marked,.dsv-printroot tr.dsv-marked td{background:transparent!important;box-shadow:none!important}',
    '.dsv-printroot tr,.dsv-printroot figure{break-inside:avoid;page-break-inside:avoid}',
    '.dsv-printroot .dsv-legend{display:flex}}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('dsv-css')) return;
    var st = document.createElement('style'); st.id = 'dsv-css'; st.textContent = CSS; document.head.appendChild(st);
  }

  /* ---------- mount ---------- */
  var ALIAS = { ratings: 'abs', amr: 'abs', absolute: 'abs', roc: 'rec', electrical: 'elec', characteristics: 'elec', curve: 'graph', graphs: 'graph', kennlinie: 'graph', package: 'pkg', gehaeuse: 'pkg', pin: 'pins', thermik: 'thermal', register: 'regs', glossar: 'glossary', bestellung: 'order' };

  function mount(el, ctx) {
    ctx = ctx || {};
    injectCss();
    var S = { mode: ctx.mode || 'lesen', z: 1, autoFit: true, marks: {}, hits: [], cur: -1, q: '', side: false, tab: 'gl', dead: false, lastMs: 0 };
    (ctx.marks || (ctx.getMarks && ctx.getMarks()) || []).forEach(function (m) { if (m && m.section) S.marks[m.section + '|' + m.key] = { section: m.section, key: String(m.key) }; });
    var ds = null, F = mkFmt(','), T = TXT.en, Gs = {}, glList = [], glRe = null, pageInfo = [], timers = [];
    var PW = 794;

    var root = document.createElement('div');
    root.className = 'dsv dsv-m-' + S.mode;
    root.innerHTML =
      '<div class="dsv-bar">' +
      '<select class="dsv-nav" aria-label="Seite wählen"></select>' +
      '<input class="dsv-q" type="search" placeholder="Im Datenblatt suchen" aria-label="Suche im Datenblatt" autocomplete="off">' +
      '<button class="dsv-sprev" title="Vorheriger Treffer" aria-label="Vorheriger Treffer">▲</button><button class="dsv-snext" title="Nächster Treffer" aria-label="Nächster Treffer">▼</button><span class="dsv-cnt"></span>' +
      '<span class="dsv-sep"></span>' +
      '<button class="dsv-zm" title="Verkleinern" aria-label="Verkleinern">−</button><span class="dsv-zp"></span><button class="dsv-zpl" title="Vergrößern" aria-label="Vergrößern">+</button><button class="dsv-fit" title="An Breite anpassen">Einpassen</button>' +
      '<span class="dsv-sep"></span>' +
      '<button class="dsv-sidebtn" title="Glossar und Markierungen">☰ Glossar</button><button class="dsv-print" title="Drucken">Drucken</button>' +
      '<span class="dsv-mode"></span></div>' +
      '<div class="dsv-main"><div class="dsv-stage" tabindex="-1"><div class="dsv-wrap"><div class="dsv-pages"></div></div></div>' +
      '<aside class="dsv-side" hidden><div class="dsv-tabs"><button data-tab="gl" class="on">Glossar</button><button data-tab="mk">Markiert (<span class="dsv-mkn">0</span>)</button></div><div class="dsv-slist"></div></aside></div>';
    el.appendChild(root);
    var $ = function (s) { return root.querySelector(s); };
    var stage = $('.dsv-stage'), wrap = $('.dsv-wrap'), pagesEl = $('.dsv-pages'), side = $('.dsv-side'), slist = $('.dsv-slist'), qIn = $('.dsv-q'), navSel = $('.dsv-nav');

    function toast(m) { try { if (ctx.toast) ctx.toast(m); } catch (e) { } }

    /* ----- Hilfsfunktionen zum Text ----- */
    function tx(s) {
      s = String(s == null ? '' : s);
      if (!glRe) return esc(s);
      var o = '', last = 0, m;
      glRe.lastIndex = 0;
      while ((m = glRe.exec(s))) {
        var pre = m[1], term = m[2], st = m.index + pre.length;
        o += esc(s.slice(last, st));
        var gi = glList.map(function (g) { return g.en.toLowerCase(); }).indexOf(term.toLowerCase());
        o += '<span class="dsv-gl" data-gi="' + gi + '">' + esc(term) + '</span>';
        last = st + term.length;
        glRe.lastIndex = last;
      }
      return o + esc(s.slice(last));
    }
    function mk(sec, key) { return ' data-mk data-sec="' + esc(sec) + '" data-key="' + esc(key) + '"'; }
    function symHtml(s) { return fmHtml(s); }

    /* ----- Seitenaufbau ----- */
    var secNo;
    function h2(key, extra) { return '<h2><span class="n">' + (++secNo) + '</span>' + esc(T[key]) + (extra || '') + '</h2>'; }
    function specTable(sec, rows, o) {
      var hasMin = rows.some(function (r) { return r.min != null; }), hasMax = rows.some(function (r) { return r.max != null; }), hasTyp = o.typ !== false && rows.some(function (r) { return r.typ != null; }), hasCond = rows.some(function (r) { return r.cond; }) || o.cond;
      var h = '<table class="dsv-t ' + (o.cls || '') + '"><thead><tr><th>' + T.param + '</th><th>' + T.sym + '</th>' + (hasCond ? '<th>' + T.cond + '</th>' : '') + (hasMin ? '<th class="num">' + T.min + '</th>' : '') + (hasTyp ? '<th class="num">' + T.typ + '</th>' : '') + (hasMax ? '<th class="num">' + T.max + '</th>' : '') + '<th>' + T.unit + '</th></tr></thead><tbody>';
      rows.forEach(function (r, i) {
        var key = r.key != null ? r.key : '#' + i;
        h += '<tr' + mk(sec, key) + '><td>' + tx(r.param) + (r.note ? '<span class="nt">' + tx(r.note) + '</span>' : '') + '</td><td class="sym">' + symHtml(r.sym || '') + '</td>' +
          (hasCond ? '<td class="cd">' + tx(r.cond || '') + (r.tj != null ? '<span class="tj">Tj = ' + F.trim(r.tj, 4) + ' °C</span>' : '') + '</td>' : '') +
          (hasMin ? '<td class="num">' + F.cell(r.min) + '</td>' : '') + (hasTyp ? '<td class="num">' + F.cell(r.typ) + '</td>' : '') + (hasMax ? '<td class="num">' + F.cell(r.max) + '</td>' : '') +
          '<td>' + esc(r.unit || '') + '</td></tr>';
      });
      return h + '</tbody></table>';
    }
    function pinsTable() {
      var p = (ds.pins && ds.pins.pins) || [];
      var h = '<table class="dsv-t"><thead><tr><th class="num" style="width:44px">' + T.pin + '</th><th>' + T.name + '</th><th>' + T.type + '</th><th>' + T.descr + '</th></tr></thead><tbody>';
      p.forEach(function (x) {
        h += '<tr' + mk('pins', x.n) + '><td class="num"><b>' + esc(x.n) + '</b></td><td><b>' + esc(x.name) + '</b></td><td><span class="dsv-chip2" style="background:' + (PINCOL[x.type] || '#555') + '">' + esc(PINTXT[x.type] || x.type || '') + '</span></td><td>' + tx(x.desc || '') + '</td></tr>';
      });
      return h + '</tbody></table>';
    }
    function pkgBlock(opts) {
      var pd = ds.pkgDraw || {};
      var r = pkgSvg(pd.kind, (ds.pins && ds.pins.pins) || [], { names: opts.names, dims: opts.dims, fmt: F });
      return '<div class="dsv-pkbox"' + (opts.mk ? mk('pkg', 'drawing') : '') + '>' + r.svg + '</div><div class="dsv-cap">' + esc(r.caption || pd.name || (ds.pins && ds.pins.pkg) || '') + '</div>';
    }
    function dimsTable() {
      var d = (ds.pkgDraw && ds.pkgDraw.dims) || [];
      if (!d.length) return '';
      var hasMin = d.some(function (x) { return x.min != null; });
      var h = '<h3>' + esc(T.dimh) + '</h3><table class="dsv-t"><thead><tr><th>' + T.dim + '</th>' + (hasMin ? '<th class="num">' + T.min + '</th>' : '') + '<th class="num">' + T.max + '</th><th>' + T.unit + '</th>' + (d.some(function (x) { return x.desc||x.note; }) ? '<th>' + T.note + '</th>' : '') + '</tr></thead><tbody>';
      d.forEach(function (x) { h += '<tr' + mk('pkg', x.label) + '><td><b>' + esc(x.label) + '</b></td>' + (hasMin ? '<td class="num">' + F.cell(x.min) + '</td>' : '') + '<td class="num">' + F.cell(x.max != null ? x.max : x.typ) + '</td><td>' + esc(x.unit || 'mm') + '</td>' + (d.some(function (y) { return y.desc||y.note; }) ? '<td class="cd">' + tx(x.desc || x.note || '') + '</td>' : '') + '</tr>'; });
      return h + '</tbody></table>';
    }
    function graphFig(g, num, extraCls) {
      var ch = buildChart(g, F);
      Gs[g.id] = { g: g, geo: ch.geo, si: 0, x: null, y: null };
      var fig = '<figure class="dsv-fig dsv-graph ' + (extraCls || '') + '" data-sec="graph" data-key="' + esc(g.id) + '" data-graph="' + esc(g.id) + '"><figcaption><span class="fn">' + esc(T.fig) + ' ' + num + '</span> ' + tx(g.title || '') +
        '<button class="dsv-mkb" data-act="mkgraph" aria-label="Markieren" title="Kennlinie markieren">☆</button></figcaption>' + ch.svg;
      fig += '<div class="dsv-legend">';
      (g.series || []).forEach(function (s, si) {
        var c = COL[si % COL.length];
        fig += '<button class="dsv-lg' + (si === 0 ? ' act' : '') + '" data-act="series" data-si="' + si + '"><svg width="30" height="10"><line x1="1" y1="5" x2="29" y2="5" stroke="' + c + '" stroke-width="2.4"' + (DASH[si % DASH.length] ? ' stroke-dasharray="' + DASH[si % DASH.length] + '"' : '') + '/></svg><span>' + esc(s.name || ('Serie ' + (si + 1))) + (s.cond ? '<small>' + esc(s.cond) + '</small>' : '') + '</span></button>';
      });
      fig += '</div><div class="dsv-readout" data-ro></div>';
      if (g.note) fig += '<div class="dsv-note">' + tx(g.note) + '</div>';
      return fig + '</figure>';
    }
    function thermalGraph() {
      var th = ds.thermal; if (!th) return null;
      var pmax = th.ptotMax != null ? th.ptotMax : (th.rthJA ? (th.tjMax - 25) / th.rthJA : null);
      if (pmax == null || !th.tjMax) return null;
      var de = ds.lang === 'de';
      return { id: 'thermal-derating', title: de ? 'Zulässige Verlustleistung über der Umgebungstemperatur (Derating)' : 'Power dissipation vs. ambient temperature (derating)', xLabel: de ? 'Umgebungstemperatur' : 'Ambient temperature', xUnit: '°C', xScale: 'lin', yLabel: de ? 'Verlustleistung Ptot' : 'Total power dissipation', yUnit: 'W', yScale: 'lin',
        series: [{ name: 'Ptot max', cond: 'RthJA = ' + F.trim(th.rthJA, 4) + ' K/W', points: [[0, pmax], [25, pmax], [th.tjMax, 0]] }], note: de ? 'Oberhalb von 25 °C sinkt die zulässige Verlustleistung linear bis auf 0 W bei Tj max.' : 'Above 25 °C the permitted power dissipation falls linearly to 0 W at Tj max.' };
    }

    function buildPages() {
      var t0 = performance.now(), P = [], g = ds, r, i;
      Gs = {}; secNo = 0;
      var lang = g.lang === 'de' ? 'de' : 'en'; T = TXT[lang]; F = mkFmt(lang === 'de' ? ',' : '.');
      glList = (g.glossary || []).filter(function (x) { return x && x.en; });
      var terms = glList.map(function (x) { return rx(x.en); }).sort(function (a, b) { return b.length - a.length; });
      glRe = terms.length ? new RegExp('(^|[^A-Za-zÄÖÜäöüß0-9])(' + terms.join('|') + ')(?![A-Za-zÄÖÜäöüß0-9])', 'gi') : null;

      /* Titelseite */
      var c = '<div class="dsv-cv-top"><span class="dsv-brand">' + esc((g.mfr || 'Tonfunk Übung').toUpperCase()) + '</span><span class="dsv-ribbon">ÜBUNGSDATENBLATT</span></div>';
      c += '<h1 class="dsv-part">' + esc(g.part || g.id) + '</h1><span class="dsv-fam">' + esc(g.family || '') + '</span><div class="dsv-ttl">' + tx(g.title || '') + '</div>';
      c += '<div class="dsv-cols"><div class="dsv-cl">';
      if ((g.features || []).length) { c += '<h3>' + T.features + '</h3><ul class="dsv-feat">'; g.features.forEach(function (f, k) { c += '<li' + mk('features', k) + '>' + tx(f) + '</li>'; }); c += '</ul>'; }
      if (g.desc) c += '<h3>' + T.desc + '</h3><p>' + tx(g.desc) + '</p>';
      c += '</div><div class="dsv-cr"><h3>' + T.pins + '</h3>' + pkgBlock({ names: true, dims: false }) + '</div></div>';
      if ((g.order || []).length) {
        c += '<h3>' + T.order + '</h3><table class="dsv-t"><thead><tr><th>' + T.ordtype + '</th><th>' + T.pkgcol + '</th><th>' + T.note + '</th></tr></thead><tbody>';
        g.order.forEach(function (o, k) { c += '<tr' + mk('order', o.type || k) + '><td><b>' + esc(o.type) + '</b></td><td>' + esc(o.pkg || '') + '</td><td class="cd">' + tx(o.note || '') + '</td></tr>'; });
        c += '</tbody></table>';
      }
      c += '<div class="dsv-disc"><b>Übungsdatenblatt</b> – Werte angelehnt an typische Bauteile' + (g.ref ? ' (Vorbild: ' + esc(g.ref) + ')' : '') + '; maßgeblich sind immer die Datenblätter des Herstellers. Hersteller „' + esc(g.mfr || 'Tonfunk Übung (fiktiv)') + '“.</div>';
      P.push({ id: 'cover', title: T.titlepg, html: c });
      secNo = 0;

      /* Pins und Gehäuse */
      if (g.pins || g.pkgDraw) {
        var p2 = h2('pins') + (g.pins ? pinsTable() : '');
        if (g.pkgDraw) p2 += h2('pkg') + '<div class="dsv-cols"><div class="dsv-cl" style="flex:1.1">' + pkgBlock({ names: true, dims: true, mk: true }) + '</div><div class="dsv-cr" style="flex:1.3">' + dimsTable() + '</div></div>';
        P.push({ id: 'pins', title: T.pins, html: p2 });
      }
      /* Grenzwerte */
      if ((g.abs || []).length || (g.rec || []).length) {
        var p3 = '';
        if ((g.abs || []).length) p3 += h2('abs') + '<div class="dsv-warn"><p><b>' + (lang === 'de' ? 'Achtung: ' : 'Caution: ') + '</b>' + esc(T.warn) + '</p></div>' + specTable('abs', g.abs, { cls: 'abs', typ: false });
        if ((g.rec || []).length) p3 += h2('rec') + specTable('rec', g.rec, {});
        P.push({ id: 'ratings', title: T.abs.replace(/ \(.*\)/, ''), html: p3 });
      }
      if ((g.elec || []).length) P.push({ id: 'elec', title: T.elec, html: h2('elec') + (g.elec.some(function (e) { return e.tj != null; }) ? '<div class="dsv-sub">' + esc(T.unless) + 'Tj = 25 °C' + '</div>' : '') + specTable('elec', g.elec, { cond: true }) });
      /* Kennlinien */
      var gr = (g.graphs || []).slice(), gnum = 0;
      for (i = 0; i < gr.length; i += 2) {
        var h = (i === 0 ? h2('graphs') : '');
        h += graphFig(gr[i], ++gnum);
        if (gr[i + 1]) h += graphFig(gr[i + 1], ++gnum);
        P.push({ id: 'graphs' + (i / 2 + 1), title: T.graphs + (gr.length > 2 ? ' ' + (i / 2 + 1) : ''), html: h });
      }
      /* Thermik */
      if (g.thermal) {
        var th = g.thermal, hh = h2('thermal'), rows = [['rthJA', 'Thermal resistance, junction to ambient', 'RthJA', th.rthJA, 'K/W'], ['rthJC', 'Thermal resistance, junction to case', 'RthJC', th.rthJC, 'K/W'], ['tjMax', 'Maximum junction temperature', 'Tj max', th.tjMax, '°C'], ['ptotMax', 'Total power dissipation (Tamb = 25 °C)', 'Ptot', th.ptotMax, 'W']];
        hh += '<table class="dsv-t"><thead><tr><th>' + T.param + '</th><th>' + T.sym + '</th><th class="num">' + T.typ + ' / ' + T.max + '</th><th>' + T.unit + '</th></tr></thead><tbody>';
        rows.forEach(function (x) { if (x[3] != null) hh += '<tr' + mk('thermal', x[0]) + '><td>' + tx(x[1]) + '</td><td class="sym">' + symHtml(x[2]) + '</td><td class="num">' + F.cell(x[3]) + '</td><td>' + esc(x[4]) + '</td></tr>'; });
        hh += '</tbody></table>';
        if (th.note) hh += '<p class="dsv-note">' + tx(th.note) + '</p>';
        var tg = thermalGraph();
        if (tg) hh += '<div style="margin-top:12px">' + graphFig(tg, ++gnum) + '</div>';
        hh += '<h3>' + (lang === 'de' ? 'Sperrschichttemperatur' : 'Junction temperature') + '</h3><div class="dsv-formula"' + mk('thermal', 'formula').replace('data-mk', 'data-mk') + '>' + fmHtml('Tj = Tamb + Ptot * RthJA') + '</div>';
        if (th.rthJA != null && th.tjMax != null) {
          var pe = th.ptotMax != null ? th.ptotMax / 2 : (th.tjMax - 25) / th.rthJA / 2, te = 40, tje = te + pe * th.rthJA;
          hh += '<p class="dsv-note">' + (lang === 'de' ? 'Beispiel' : 'Example') + ': Ptot = ' + F.trim(pe, 3) + ' W, Tamb = 40 °C → Tj = 40 °C + ' + F.trim(pe, 3) + ' W · ' + F.trim(th.rthJA, 4) + ' K/W = ' + F.trim(tje, 4) + ' °C' + (tje <= th.tjMax ? ' ≤ ' : ' > ') + 'Tj max (' + F.trim(th.tjMax, 4) + ' °C).</p>';
        }
        P.push({ id: 'thermal', title: T.thermal, html: hh });
      }
      /* Zeit, Register, Wahrheit */
      var ex = '';
      (g.timing || []).forEach(function (tm, k) {
        ex += h2('timing', tm.title ? '<small style="font-weight:400;font-size:13px;color:#3a4350"> – ' + esc(tm.title) + '</small>' : '') + '<figure class="dsv-fig"' + mk('timing-fig', k) + '>' + timingSvg(tm, F) + '</figure>' + (tm.note ? '<div class="dsv-note">' + tx(tm.note) + '</div>' : '');
      });
      if ((g.regs || []).length) {
        ex += h2('regs') + '<table class="dsv-t"><thead><tr><th>' + T.addr + '</th><th>' + T.name + '</th><th>' + T.bits + '</th><th>' + T.rw + '</th><th>' + T.reset + '</th><th>' + T.descr + '</th></tr></thead><tbody>';
        g.regs.forEach(function (x, k) { ex += '<tr' + mk('regs', x.addr != null ? x.addr : k) + '><td><b>' + esc(x.addr) + '</b></td><td>' + esc(x.name) + '</td><td>' + esc(x.bits) + '</td><td>' + esc(x.rw) + '</td><td>' + esc(x.reset) + '</td><td class="cd">' + tx(x.desc || '') + '</td></tr>'; });
        ex += '</tbody></table>';
      }
      if (g.truth && g.truth.rows) {
        var tr = g.truth, ni = (tr.inputs || []).length;
        ex += h2('truth') + '<table class="dsv-t tr" style="width:auto;min-width:50%"><thead><tr>' + (tr.inputs || []).map(function (x) { return '<th class="num">' + esc(x) + '</th>'; }).join('') + (tr.outputs || []).map(function (x) { return '<th class="num" style="background:#dbe7f6">' + esc(x) + '</th>'; }).join('') + '</tr></thead><tbody>';
        tr.rows.forEach(function (row, k) { ex += '<tr' + mk('truth', 'row' + k) + '>' + row.map(function (v, j) { return '<td class="num' + (j >= ni ? ' out' : '') + '"' + (j >= ni ? ' style="font-weight:700"' : '') + '>' + esc(String(v).toUpperCase() === 'X' ? 'X' : v) + '</td>'; }).join('') + '</tr>'; });
        ex += '</tbody></table>' + (tr.note ? '<div class="dsv-note">' + tx(tr.note) + '</div>' : '');
      }
      if (ex) P.push({ id: 'extra', title: [g.timing && g.timing.length ? T.timing : '', (g.regs || []).length ? T.regs : '', g.truth ? T.truth : ''].filter(Boolean).join(' / '), html: ex });
      /* Anwendung */
      if ((g.app || []).length) {
        var ap = h2('app') + '<div class="dsv-apps">';
        g.app.forEach(function (a, k) {
          ap += '<h3>' + tx(a.title || '') + '</h3>' + (a.text ? '<p>' + tx(a.text) + '</p>' : '');
          var lines = Array.isArray(a.circuit) ? a.circuit : (a.circuit ? String(a.circuit).split('\n') : []);
          if (lines.length) ap += '<div class="dsv-ckt"' + mk('app', k) + '>' + circuitSvg(lines) + '</div>';
          (a.formulas || []).forEach(function (f, j) { ap += '<div class="dsv-formula' + (/^[A-Za-zÄÖÜäöüß ]{3,}:/.test(f) ? ' ex' : '') + '"' + mk('app', k + ':f' + j) + '>' + fmHtml(f) + '</div>'; });
        });
        ap += '</div>'; P.push({ id: 'app', title: T.app, html: ap });
      }
      var tot = P.length, hd = '', part = esc(g.part || g.id);
      pageInfo = P.map(function (pg, k) { return { id: pg.id, title: pg.title }; });
      P.forEach(function (pg, k) {
        hd += '<section class="dsv-page" data-page="' + k + '" data-pid="' + pg.id + '"><div class="dsv-ph"><b>' + part + '</b><span>' + esc(g.mfr || '') + ' · ' + esc(g.family || '') + '</span></div><div class="dsv-pc">' + pg.html + '</div><div class="dsv-pf"><span>' + part + ' · Übungsdatenblatt</span><span>' + (lang === 'de' ? 'Seite ' : 'Page ') + (k + 1) + ' / ' + tot + '</span></div></section>';
      });
      S.lastMs = performance.now() - t0;
      return hd;
    }

    /* ----- Rendern ----- */
    function render() {
      var t0 = performance.now();
      var st = stage.scrollTop;
      ds = ctx.getDs ? ctx.getDs() : null;
      clearHits(true);
      if (!ds) { pagesEl.innerHTML = '<div class="dsv-empty">Kein Datenblatt gewählt.</div>'; wrap.style.height = '200px'; wrap.style.width = '300px'; pagesEl.style.width = '300px'; navSel.innerHTML = ''; slist.innerHTML = ''; return; }
      pagesEl.style.width = PW + 'px';
      pagesEl.innerHTML = buildPages();
      Object.keys(S.marks).forEach(function (k) { applyMark(S.marks[k].section, S.marks[k].key, true); });
      navSel.innerHTML = pageInfo.map(function (p, i) { return '<option value="' + i + '">' + (i + 1) + ' · ' + esc(p.title) + '</option>'; }).join('');
      Object.keys(Gs).forEach(updRO);
      buildSide();
      applyZoom(S.autoFit ? fitZoom() : S.z, true);
      stage.scrollTop = st;
      if (S.q) doSearch(S.q, true);
      S.renderMs = performance.now() - t0;
    }

    /* ----- Zoom ----- */
    function fitZoom() { var w = stage.clientWidth - 36; return w > 100 ? Math.max(0.3, Math.min(1.35, w / PW)) : 1; }
    function applyZoom(z, keep, cx, cy) {
      z = Math.max(0.3, Math.min(3, z));
      var z0 = S.z;
      var ccx = cx != null ? cx : stage.clientWidth / 2, ccy = cy != null ? cy : stage.clientHeight / 2;
      var px = (stage.scrollLeft + ccx - wrap.offsetLeft) / z0, py = (stage.scrollTop + ccy - wrap.offsetTop) / z0;
      S.z = z;
      pagesEl.style.transform = 'scale(' + z + ')';
      wrap.style.width = (ds ? PW * z : 300) + 'px';
      wrap.style.height = (pagesEl.offsetHeight * z) + 'px';
      $('.dsv-zp').textContent = Math.round(z * 100) + ' %';
      if (!keep) { stage.scrollLeft = wrap.offsetLeft + px * z - ccx; stage.scrollTop = wrap.offsetTop + py * z - ccy; }
    }
    function zoomBy(f, cx, cy) { S.autoFit = false; applyZoom(S.z * f, false, cx, cy); }

    /* ----- Markierungen ----- */
    function mkId(sec, key) { return sec + '|' + key; }
    function applyMark(sec, key, on) {
      pagesEl.querySelectorAll('[data-sec="' + cssq(sec) + '"][data-key="' + cssq(key) + '"]').forEach(function (e) {
        if (e.hasAttribute('data-mk') || e.hasAttribute('data-graph')) e.classList.toggle('dsv-marked', on);
        var b = e.querySelector && e.querySelector('.dsv-mkb'); if (b) { b.classList.toggle('on', on); b.textContent = on ? '★' : '☆'; }
      });
    }
    function labelOf(sec, key) {
      var e = pagesEl.querySelector('[data-sec="' + cssq(sec) + '"][data-key="' + cssq(key) + '"]'), t = '';
      if (e) { if (e.tagName === 'TR') t = (e.cells[1] && /^(pins|regs|truth|pkg)$/.test(sec)) ? e.cells[0].textContent + ' ' + e.cells[1].textContent : e.cells[0].textContent; else if (e.tagName === 'FIGURE') t = (e.querySelector('figcaption') || {}).textContent || ''; else t = e.textContent; }
      return (t || String(key)).replace(/[☆★]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    }
    function toggleMark(sec, key) {
      var id = mkId(sec, key), on = !S.marks[id];
      if (on) S.marks[id] = { section: sec, key: String(key) }; else delete S.marks[id];
      applyMark(sec, key, on); buildSide();
      toast(on ? 'Markiert: ' + labelOf(sec, key) : 'Markierung entfernt');
      try { if (ctx.onMark) ctx.onMark({ section: sec, key: String(key), marked: on }); } catch (e) { }
    }

    /* ----- Seitenleiste ----- */
    function buildSide() {
      var n = Object.keys(S.marks).length; $('.dsv-mkn').textContent = n;
      if (S.tab === 'gl') {
        if (!glList.length) { slist.innerHTML = '<div class="dsv-sempty">Zu diesem Datenblatt gibt es kein Glossar.</div>'; return; }
        slist.innerHTML = '<div class="dsv-sempty" style="padding:2px 4px 8px">Begriff antippen, um die Übersetzung zu sehen. Unterstrichene Wörter im Datenblatt sind ebenfalls antippbar.</div>' + glList.map(function (g, i) {
          return '<div class="dsv-gi" data-gi="' + i + '"><button data-act="gitem">' + esc(g.en) + '</button><div class="d">' + esc(g.de || '') + (g.note ? '<i>' + esc(g.note) + '</i>' : '') + '<button data-act="gfind">Wo steht das?</button></div></div>';
        }).join('');
      } else {
        var ks = Object.keys(S.marks);
        slist.innerHTML = ks.length ? ks.map(function (k) { var m = S.marks[k]; return '<button class="dsv-mi" data-act="mgo" data-sec="' + esc(m.section) + '" data-key="' + esc(m.key) + '">' + esc(labelOf(m.section, m.key)) + '<small>' + esc(m.section) + ' · ' + esc(m.key) + '</small></button>'; }).join('') : '<div class="dsv-sempty">Noch nichts markiert. Tippe auf eine Tabellenzeile, ein Merkmal oder den Stern an einer Kennlinie.</div>';
      }
    }
    function setSide(open) {
      S.side = !!open && S.mode !== 'quiz'; side.hidden = !S.side;
      $('.dsv-sidebtn').classList.toggle('on', S.side);
      applyZoomSoon();
    }
    function applyZoomSoon() { if (S.autoFit && ds) timers.push(setTimeout(function () { if (!S.dead && S.autoFit) applyZoom(fitZoom(), false); }, 30)); }

    /* ----- Glossar-Popup ----- */
    var pop = null;
    function closePop() { if (pop) { pop.remove(); pop = null; } }
    function openPop(spanEl) {
      closePop();
      if (S.mode === 'quiz') return;
      var g = glList[+spanEl.getAttribute('data-gi')]; if (!g) return;
      pop = document.createElement('div'); pop.className = 'dsv-pop';
      pop.innerHTML = '<b>' + esc(g.en) + '</b>' + esc(g.de || '') + (g.note ? '<i>' + esc(g.note) + '</i>' : '');
      root.appendChild(pop);
      var rr = root.getBoundingClientRect(), er = spanEl.getBoundingClientRect();
      var left = Math.max(8, Math.min(er.left - rr.left, rr.width - pop.offsetWidth - 8)), top = er.bottom - rr.top + 6;
      if (top + pop.offsetHeight > rr.height - 8) top = Math.max(8, er.top - rr.top - pop.offsetHeight - 6);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    }

    /* ----- Cursor / Ablesen ----- */
    function gstate(svg) { return Gs[svg.getAttribute('data-gid')]; }
    function figOf(id) { return pagesEl.querySelector('figure[data-graph="' + cssq(id) + '"]'); }
    function setCursor(id, x, si) {
      var st = Gs[id]; if (!st) return;
      if (si != null) st.si = si;
      var g = st.g, s = (g.series || [])[st.si]; if (!s || !(s.points || []).length) return;
      var pts = s.points.filter(function (p) { return (g.xScale !== 'log' || p[0] > 0) && (g.yScale !== 'log' || p[1] > 0); });
      var xa = pts[0][0], xb = pts[pts.length - 1][0];
      x = Math.max(xa, Math.min(xb, x));
      var y = interp(g, s, x); if (y == null) y = pts[pts.length - 1][1];
      st.x = x; st.y = y;
      var fig = figOf(id), geo = st.geo, cur = fig.querySelector('.dsv-cur');
      var X = geo.X(x), Y = geo.Y(y);
      cur.style.display = '';
      cur.querySelector('.v').setAttribute('x1', X); cur.querySelector('.v').setAttribute('x2', X);
      cur.querySelector('.h').setAttribute('y1', Y); cur.querySelector('.h').setAttribute('y2', Y);
      var d = cur.querySelector('.dot'); d.setAttribute('cx', X); d.setAttribute('cy', Y);
      var xt = F.si(x, g.xUnit), yt = F.si(y, g.yUnit);
      var tX = cur.querySelector('.tx'), tY = cur.querySelector('.ty');
      var wx = xt.length * 6.6 + 10, wy = yt.length * 6.6 + 10;
      var rx0 = Math.max(geo.ml, Math.min(geo.ml + geo.pw - wx, X - wx / 2));
      tX.querySelector('rect').setAttribute('x', rx0); tX.querySelector('rect').setAttribute('y', geo.mt + geo.ph - 18); tX.querySelector('rect').setAttribute('width', wx);
      tX.querySelector('text').setAttribute('x', rx0 + 5); tX.querySelector('text').setAttribute('y', geo.mt + geo.ph - 5); tX.querySelector('text').textContent = xt;
      var ry0 = Math.max(geo.mt, Math.min(geo.mt + geo.ph - 18, Y - 9));
      tY.querySelector('rect').setAttribute('x', geo.ml); tY.querySelector('rect').setAttribute('y', ry0); tY.querySelector('rect').setAttribute('width', wy);
      tY.querySelector('text').setAttribute('x', geo.ml + 5); tY.querySelector('text').setAttribute('y', ry0 + 13); tY.querySelector('text').textContent = yt;
      fig.querySelectorAll('.dsv-lg').forEach(function (b, i) { b.classList.toggle('act', i === st.si); });
      updRO(id);
    }
    function updRO(id) {
      var st = Gs[id], fig = figOf(id); if (!st || !fig) return;
      var ro = fig.querySelector('[data-ro]'), g = st.g, h = '';
      var step = '<button data-act="cstep" data-dir="-1" aria-label="Cursor nach links" title="Cursor nach links">◀</button><button data-act="cstep" data-dir="1" aria-label="Cursor nach rechts" title="Cursor nach rechts">▶</button>';
      if (st.x == null) { ro.innerHTML = '<span class="hint">' + (S.mode === 'ablesen' ? 'Tippe oder ziehe in der Kennlinie, um den Wert zu bestimmen. Wähle vorher die richtige Kurve in der Legende.' : 'Tippe oder ziehe in die Kennlinie, um Werte abzulesen.') + '</span><span class="sp"></span>' + step; return; }
      h += '<span><span class="k">' + esc(g.xLabel ? g.xLabel.split(' ').slice(0, 2).join(' ') : 'x') + '</span><b>' + esc(F.si(st.x, g.xUnit)) + '</b></span>';
      h += '<span><span class="k">' + esc(g.yLabel ? g.yLabel.split(' ').slice(0, 2).join(' ') : 'y') + '</span><b>' + esc(F.si(st.y, g.yUnit)) + '</b></span>';
      if (S.mode === 'lesen' && (g.series || []).length > 1) {
        h += '<span class="oth">' + g.series.map(function (s, i) { var v = interp(g, s, st.x); return '<span style="color:' + COL[i % COL.length] + '">■</span> ' + esc(s.name || '') + ': ' + (v == null ? '–' : esc(F.si(v, g.yUnit))); }).join(' &nbsp; ') + '</span>';
      }
      h += '<span class="sp"></span>' + step;
      if (S.mode === 'ablesen') h += '<button class="take" data-act="take">Wert übernehmen</button>';
      ro.innerHTML = h;
    }
    function pointerToX(svg, e) {
      var r = svg.getBoundingClientRect(), st = gstate(svg), px = (e.clientX - r.left) / r.width * st.geo.W;
      return st.geo.invX(px);
    }
    function stepCursor(id, dir, big) {
      var st = Gs[id]; if (!st) return;
      var geo = st.geo, s = st.g.series[st.si], pts = s && s.points; if (!pts || !pts.length) return;
      if (st.x == null) { setCursor(id, geo.invX(geo.ml + geo.pw / 2)); return; }
      var t = geo.tr(st.x, geo.xl) + dir * (geo.tx1 - geo.tx0) / geo.pw * (big ? 10 : 2);
      setCursor(id, geo.xl ? Math.pow(10, t) : t);
    }
    var drag = null;
    root.addEventListener('pointerdown', function (e) {
      var svg = e.target.closest && e.target.closest('svg.dsv-plot'); if (!svg) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      drag = { svg: svg, id: e.pointerId };
      try { svg.setPointerCapture(e.pointerId); } catch (x) { }
      setCursor(svg.getAttribute('data-gid'), pointerToX(svg, e));
    });
    root.addEventListener('pointermove', function (e) {
      var svg = drag ? drag.svg : (e.pointerType === 'mouse' && e.target.closest && e.target.closest('svg.dsv-plot'));
      if (!svg) return;
      if (e.pointerType === 'touch' && !e.isPrimary) return;
      setCursor(svg.getAttribute('data-gid'), pointerToX(svg, e));
    });
    function endDrag() { drag = null; }
    root.addEventListener('pointerup', endDrag); root.addEventListener('pointercancel', endDrag);
    root.addEventListener('keydown', function (e) {
      var svg = e.target.closest && e.target.closest('svg.dsv-plot');
      if (svg && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); stepCursor(svg.getAttribute('data-gid'), e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey); }
    });

    /* ----- Klicks ----- */
    root.addEventListener('click', function (e) {
      var t = e.target;
      var gl = t.closest('.dsv-gl'); if (gl) { openPop(gl); e.stopPropagation(); return; }
      var b = t.closest('[data-act]');
      if (b) {
        var act = b.getAttribute('data-act'), fig = b.closest('figure[data-graph]'), gid = fig && fig.getAttribute('data-graph');
        if (act === 'series') { var st = Gs[gid]; var si = +b.getAttribute('data-si'); if (st.x != null) setCursor(gid, st.x, si); else { st.si = si; fig.querySelectorAll('.dsv-lg').forEach(function (x, i) { x.classList.toggle('act', i === si); }); updRO(gid); } return; }
        if (act === 'cstep') { stepCursor(gid, +b.getAttribute('data-dir')); return; }
        if (act === 'take') {
          var s2 = Gs[gid]; if (s2.x == null) return;
          try { if (ctx.onRead) ctx.onRead({ graphId: gid, series: s2.si, seriesName: (s2.g.series[s2.si] || {}).name, x: s2.x, y: s2.y }); } catch (x) { }
          return;
        }
        if (act === 'mkgraph') { toggleMark('graph', gid); return; }
        if (act === 'gitem') { b.parentNode.classList.toggle('open'); return; }
        if (act === 'gfind') { var gi = b.closest('.dsv-gi').getAttribute('data-gi'); findTerm(+gi); return; }
        if (act === 'mgo') { api.focus({ section: b.getAttribute('data-sec'), key: b.getAttribute('data-key') }); if (S.mode === 'quiz' || root.classList.contains('dsv-narrow')) setSide(false); return; }
      }
      var m = t.closest('[data-mk]');
      if (m && pagesEl.contains(m)) toggleMark(m.getAttribute('data-sec'), m.getAttribute('data-key'));
    });
    function onDocClick(e) { if (pop && !pop.contains(e.target) && !(e.target.closest && e.target.closest('.dsv-gl'))) closePop(); }
    document.addEventListener('click', onDocClick, true);
    function onKeyEsc(e) { if (e.key === 'Escape') closePop(); }
    document.addEventListener('keydown', onKeyEsc);
    function findTerm(gi) {
      var spans = pagesEl.querySelectorAll('.dsv-gl[data-gi="' + gi + '"]');
      if (!spans.length) { toast('Dieser Begriff kommt im Text nicht vor.'); return; }
      spans.forEach(function (s) { s.classList.remove('dsv-glhi'); void s.offsetWidth; s.classList.add('dsv-glhi'); });
      scrollToEl(spans[0]);
      if (root.classList.contains('dsv-narrow')) setSide(false);
    }

    /* ----- Toolbar ----- */
    $('.dsv-zm').addEventListener('click', function () { zoomBy(1 / 1.2); });
    $('.dsv-zpl').addEventListener('click', function () { zoomBy(1.2); });
    $('.dsv-fit').addEventListener('click', function () { S.autoFit = true; applyZoom(fitZoom()); });
    $('.dsv-sidebtn').addEventListener('click', function () { setSide(!S.side); });
    side.querySelector('.dsv-tabs').addEventListener('click', function (e) { var b = e.target.closest('button[data-tab]'); if (!b) return; S.tab = b.getAttribute('data-tab'); side.querySelectorAll('.dsv-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); }); buildSide(); });
    navSel.addEventListener('change', function () { var pg = pagesEl.querySelector('[data-page="' + navSel.value + '"]'); if (pg) scrollToEl(pg, true); });
    $('.dsv-print').addEventListener('click', function () { api.print(); });
    $('.dsv-sprev').addEventListener('click', function () { gotoHit(S.cur - 1); });
    $('.dsv-snext').addEventListener('click', function () { gotoHit(S.cur + 1); });
    var qTimer = null;
    qIn.addEventListener('input', function () { clearTimeout(qTimer); qTimer = setTimeout(function () { doSearch(qIn.value); }, 140); });
    qIn.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); if (qTimer) { clearTimeout(qTimer); qTimer = null; if (qIn.value !== S.q) { doSearch(qIn.value); return; } } gotoHit(S.cur + (e.shiftKey ? -1 : 1)); }
      if (e.key === 'Escape') { qIn.value = ''; doSearch(''); }
    });

    /* ----- Suche ----- */
    function clearHits(silent) {
      pagesEl.querySelectorAll('mark.dsv-hit').forEach(function (m) { var p = m.parentNode; if (!p) return; p.replaceChild(document.createTextNode(m.textContent), m); p.normalize(); });
      pagesEl.querySelectorAll('.dsv-hitsvg').forEach(function (e) { e.classList.remove('dsv-hitsvg'); });
      S.hits = []; S.cur = -1; if (!silent) updCount();
    }
    function updCount() { $('.dsv-cnt').textContent = S.q.length >= 2 ? (S.hits.length ? (S.cur + 1) + '/' + S.hits.length : '0') : ''; }
    function doSearch(q, keep) {
      q = String(q || '').trim(); S.q = q; clearHits(true);
      if (q.length < 2) { updCount(); return; }
      var ql = q.toLowerCase(), nodes = [], w = document.createTreeWalker(pagesEl, NodeFilter.SHOW_TEXT, null, false), n;
      while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; if (n.parentNode.closest && n.parentNode.closest('svg,style,script,.dsv-readout,.dsv-mkb,.dsv-legend')) continue; if (n.nodeValue.toLowerCase().indexOf(ql) >= 0) nodes.push(n); }
      nodes.forEach(function (node) {
        var txt = node.nodeValue, lo = txt.toLowerCase(), pos = 0, i, frag = document.createDocumentFragment();
        while ((i = lo.indexOf(ql, pos)) >= 0) {
          if (i > pos) frag.appendChild(document.createTextNode(txt.slice(pos, i)));
          var mkEl = document.createElement('mark'); mkEl.className = 'dsv-hit'; mkEl.textContent = txt.substr(i, ql.length); frag.appendChild(mkEl);
          pos = i + ql.length;
        }
        if (pos < txt.length) frag.appendChild(document.createTextNode(txt.slice(pos)));
        node.parentNode.replaceChild(frag, node);
      });
      var hits = Array.prototype.slice.call(pagesEl.querySelectorAll('mark.dsv-hit'));
      pagesEl.querySelectorAll('svg text').forEach(function (t) { if (t.textContent.toLowerCase().indexOf(ql) >= 0) { t.classList.add('dsv-hitsvg'); hits.push(t); } });
      hits.sort(function (a, b) { return (a.compareDocumentPosition(b) & 4) ? -1 : 1; });
      S.hits = hits;
      if (!keep && hits.length) gotoHit(0); else updCount();
    }
    function gotoHit(i) {
      if (!S.hits.length) { updCount(); return; }
      S.cur = (i + S.hits.length) % S.hits.length;
      S.hits.forEach(function (h) { h.classList.remove('cur'); });
      var h = S.hits[S.cur]; h.classList.add('cur');
      scrollToEl(h);
      updCount();
    }

    /* ----- Scrollen und Fokus ----- */
    function scrollToEl(e, top) {
      var r = e.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      var dy = r.top - sr.top - (top ? 12 : (sr.height - Math.min(r.height, sr.height * 0.6)) / 3);
      var dx = 0;
      if (r.left < sr.left + 10 || r.right > sr.right - 10) dx = r.left - sr.left - (sr.width - Math.min(r.width, sr.width)) / 2;
      try { stage.scrollTo({ top: stage.scrollTop + dy, left: stage.scrollLeft + dx, behavior: 'smooth' }); } catch (x) { stage.scrollTop += dy; stage.scrollLeft += dx; }
    }
    function flash(e) {
      var isRow = e.tagName === 'TR';
      e.classList.remove('dsv-flash', 'fl'); void e.getBoundingClientRect();
      e.classList.add('dsv-flash'); if (!isRow && !e.classList.contains('dsv-sigbg')) e.classList.add('fl');
      timers.push(setTimeout(function () { e.classList.remove('dsv-flash', 'fl'); }, 2700));
    }
    function focus(t) {
      if (!t) return false;
      var sec = String(t.section || '').toLowerCase(); sec = ALIAS[sec] || sec;
      var key = t.key != null ? String(t.key) : null, gid = t.graphId || null, el = null;
      if (gid && (!sec || sec === 'graph')) { el = pagesEl.querySelector('figure[data-graph="' + cssq(gid) + '"]'); sec = 'graph'; }
      if (!el && sec) {
        if (key != null) {
          el = pagesEl.querySelector('[data-sec="' + cssq(sec) + '"][data-key="' + cssq(key) + '"]');
          if (!el) { var all = pagesEl.querySelectorAll('[data-sec="' + cssq(sec) + '"]'); for (var i = 0; i < all.length; i++) if (String(all[i].getAttribute('data-key')).toLowerCase() === key.toLowerCase()) { el = all[i]; break; } }
        }
        if (!el) el = pagesEl.querySelector('[data-sec="' + cssq(sec) + '"]');
      }
      if (!el && key) { var f = pagesEl.querySelector('[data-key="' + cssq(key) + '"]'); el = f; }
      if (!el) return false;
      var fig = el.closest ? el.closest('figure[data-graph]') : null;
      if (fig && (t.x != null || t.series != null)) setCursor(fig.getAttribute('data-graph'), t.x != null ? +t.x : (Gs[fig.getAttribute('data-graph')].x != null ? Gs[fig.getAttribute('data-graph')].x : Gs[fig.getAttribute('data-graph')].geo.invX(Gs[fig.getAttribute('data-graph')].geo.ml + Gs[fig.getAttribute('data-graph')].geo.pw / 2)), t.series != null ? +t.series : null);
      scrollToEl(el); flash(el);
      return true;
    }

    /* ----- Pinch, Strg+Rad ----- */
    var pinch = null;
    function tdist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
    stage.addEventListener('touchstart', function (e) { if (e.touches.length === 2) { pinch = { d: tdist(e.touches), z: S.z }; drag = null; } }, { passive: true });
    stage.addEventListener('touchmove', function (e) {
      if (pinch && e.touches.length === 2) {
        e.preventDefault();
        var sr = stage.getBoundingClientRect(), cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - sr.left, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - sr.top;
        S.autoFit = false; applyZoom(pinch.z * tdist(e.touches) / pinch.d, false, cx, cy);
      }
    }, { passive: false });
    stage.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; }, { passive: true });
    stage.addEventListener('wheel', function (e) { if (e.ctrlKey) { e.preventDefault(); var sr = stage.getBoundingClientRect(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - sr.left, e.clientY - sr.top); } }, { passive: false });

    /* ----- Groesse beobachten ----- */
    var ro = null;
    function onResize() {
      if (S.dead) return;
      root.classList.toggle('dsv-narrow', root.clientWidth < 820);
      if (S.autoFit && ds && stage.clientWidth && Math.abs(fitZoom() - S.z) > 0.002) applyZoom(fitZoom(), false);
    }
    if (window.ResizeObserver) { ro = new ResizeObserver(onResize); ro.observe(root); } else window.addEventListener('resize', onResize);

    /* ----- Modus ----- */
    function setMode(m) {
      if (['lesen', 'ablesen', 'quiz'].indexOf(m) < 0) return;
      S.mode = m; root.className = root.className.replace(/dsv-m-\w+/, 'dsv-m-' + m);
      $('.dsv-mode').textContent = m === 'lesen' ? 'LESEN' : m === 'ablesen' ? 'ABLESEN' : 'QUIZ';
      if (m === 'quiz') { closePop(); setSide(false); }
      Object.keys(Gs).forEach(updRO);
    }
    var api = {
      refresh: function () { render(); },
      focus: focus,
      setMode: setMode,
      getMode: function () { return S.mode; },
      getMarks: function () { return Object.keys(S.marks).map(function (k) { return { section: S.marks[k].section, key: S.marks[k].key }; }); },
      clearMarks: function () { Object.keys(S.marks).forEach(function (k) { applyMark(S.marks[k].section, S.marks[k].key, false); }); S.marks = {}; buildSide(); },
      search: function (q) { qIn.value = q || ''; doSearch(q || ''); return S.hits.length; },
      setZoom: function (z) { if (z === 'fit') { S.autoFit = true; applyZoom(fitZoom()); } else { S.autoFit = false; applyZoom(+z); } },
      setCursor: function (graphId, x, series) { setCursor(graphId, x, series); },
      getCursor: function (graphId) { var s = Gs[graphId]; return s ? { x: s.x, y: s.y, series: s.si } : null; },
      print: function () {
        if (!ds) return;
        var cl = pagesEl.cloneNode(true); cl.removeAttribute('style'); cl.querySelectorAll('mark.dsv-hit').forEach(function (m) { m.outerHTML = m.textContent; });
        var holder = document.createElement('div'); holder.className = 'dsv-printroot'; holder.appendChild(cl); document.body.appendChild(holder); document.body.classList.add('dsv-printing');
        var done = function () { document.body.classList.remove('dsv-printing'); if (holder.parentNode) holder.parentNode.removeChild(holder); window.removeEventListener('afterprint', done); };
        window.addEventListener('afterprint', done);
        try { window.print(); } catch (e) { }
        timers.push(setTimeout(function () { if (document.body.classList.contains('dsv-printing') && !window.matchMedia('print').matches) done(); }, 1500));
      },
      get lastRenderMs() { return S.renderMs; },
      destroy: function () {
        S.dead = true; timers.forEach(clearTimeout); clearTimeout(qTimer);
        if (ro) ro.disconnect(); else window.removeEventListener('resize', onResize);
        document.removeEventListener('click', onDocClick, true); document.removeEventListener('keydown', onKeyEsc);
        closePop(); if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
    $('.dsv-mode').textContent = S.mode === 'lesen' ? 'LESEN' : S.mode === 'ablesen' ? 'ABLESEN' : 'QUIZ';
    render();
    timers.push(setTimeout(function () { if (!S.dead) { onResize(); setSide(root.clientWidth >= 1000 && S.mode !== 'quiz'); } }, 0));
    onResize();
    return api;
  }

  window.DS_VIEW = { version: VERSION, mount: mount, pkgSvg: function (kind, pins, o) { return pkgSvg(kind, pins, o).svg; }, kinds: Object.keys(KINDS).filter(function (k) { return k !== 'generic'; }) };
})();
