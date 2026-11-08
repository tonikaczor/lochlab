'use strict';
/* Tonfunk Zerspan-Lab: reine Rechenlogik (Drehen, Fräsen, Bohren). Keine DOM-Zugriffe, per Node testbar.
   Einheiten (Tabellenbuch Metall): d, l, L, ap, ae in mm; n in min^-1; vc in m/min; f in mm/U; fz in mm; vf in mm/min;
   Zeiten in min; A in mm^2; kc in N/mm^2; Fc in N; Pc in kW.
   Ungültige Eingaben (nicht endlich, Durchmesser/Drehzahl/Vorschub <= 0 wo durch sie geteilt wird) liefern NaN, nie eine Ausnahme. */
(function (root) {
  var PI = Math.PI;
  function ok(x) { return typeof x === 'number' && isFinite(x); }
  function pos(x) { return ok(x) && x > 0; }
  function nn(x) { return ok(x) && x >= 0; }

  /* ---------- Drehzahl und Schnittgeschwindigkeit ---------- */
  /* vc = pi * d * n / 1000  (m/min) */
  function vc(d, n) { return nn(d) && nn(n) ? PI * d * n / 1000 : NaN; }
  /* n = vc * 1000 / (pi * d)  (min^-1) */
  function nFromVc(v, d) { return nn(v) && pos(d) ? v * 1000 / (PI * d) : NaN; }
  /* d = vc * 1000 / (pi * n)  (mm) */
  function dFromVcN(v, n) { return nn(v) && pos(n) ? v * 1000 / (PI * n) : NaN; }
  /* Umrechnungen der Einheit */
  function mPerMinToMmPerMin(v) { return ok(v) ? v * 1000 : NaN; }
  function mmPerMinToMPerMin(v) { return ok(v) ? v / 1000 : NaN; }
  function rpsToRpm(x) { return ok(x) ? x * 60 : NaN; }
  function rpmToRps(x) { return ok(x) ? x / 60 : NaN; }

  /* ---------- Vorschub und Hauptzeit ---------- */
  /* Vorschubgeschwindigkeit vf = f * n  (mm/min) */
  function vf(f, n) { return nn(f) && nn(n) ? f * n : NaN; }
  /* Drehen: f = vf / n */
  function fFromVf(v, n) { return nn(v) && pos(n) ? v / n : NaN; }
  /* Gesamtweg L = l + la + lu  (mm) */
  function weg(l, la, lu) { return nn(l) && nn(la || 0) && nn(lu || 0) ? l + (la || 0) + (lu || 0) : NaN; }
  /* allgemeine Hauptzeit th = L * i / vf  (min) */
  function th(L, i, vfv) { return nn(L) && pos(i) && pos(vfv) ? L * i / vfv : NaN; }
  /* Drehen: th = L * i / (f * n) mit L = l + la + lu */
  function thDreh(l, la, lu, i, f, n) { return th(weg(l, la, lu), i == null ? 1 : i, vf(f, n)); }
  /* Anzahl Schnitte aus Durchmesser-Aufmaß: i = aufgerundet (d1 - d2) / (2 * ap) */
  function schnitte(d1, d2, ap) {
    if (!(pos(d1) && nn(d2) && pos(ap)) || d2 > d1) return NaN;
    var q = (d1 - d2) / (2 * ap);
    return Math.max(1, Math.ceil(q - 1e-9));
  }
  /* Spanquerschnitt A = ap * f  (mm^2) */
  function spanquerschnitt(ap, f) { return nn(ap) && nn(f) ? ap * f : NaN; }
  /* Schnittkraft Fc = A * kc  (N), vereinfacht mit Richtwert-kc */
  function schnittkraft(A, kc) { return nn(A) && nn(kc) ? A * kc : NaN; }
  /* Schnittleistung Pc = Fc * vc / 60000  (kW; Fc in N, vc in m/min) */
  function schnittleistung(Fc, v) { return nn(Fc) && nn(v) ? Fc * v / 60000 : NaN; }
  /* Motorleistung bei Wirkungsgrad eta: P = Pc / eta */
  function motorleistung(Pc, eta) { return nn(Pc) && ok(eta) && eta > 0 && eta <= 1 ? Pc / eta : NaN; }

  /* ---------- Fräsen ---------- */
  /* vf = fz * z * n  (mm/min) */
  function vfFraes(fz, z, n) { return nn(fz) && pos(z) && nn(n) ? fz * z * n : NaN; }
  /* fz = vf / (z * n)  (mm) */
  function fzFromVf(v, z, n) { return nn(v) && pos(z) && pos(n) ? v / (z * n) : NaN; }
  /* Vorschub je Umdrehung f = fz * z  (mm/U) */
  function fFraes(fz, z) { return nn(fz) && pos(z) ? fz * z : NaN; }
  /* Fräsen-Hauptzeit th = L * i / vf */
  function thFraes(l, la, lu, i, v) { return th(weg(l, la, lu), i == null ? 1 : i, v); }

  /* ---------- Bohren ---------- */
  /* Anschnittlänge la = (d/2) / tan(sigma/2); bei 118 Grad ca. 0,3 * d */
  function bohrAnschnitt(d, sigma) {
    var s = sigma == null ? 118 : sigma;
    if (!(pos(d) && ok(s) && s > 0 && s < 180)) return NaN;
    return (d / 2) / Math.tan(s / 2 * PI / 180);
  }
  /* Bohrweg L = l + la (+ lu bei Durchgangsbohrung) */
  function bohrWeg(tiefe, d, opt) {
    opt = opt || {};
    var la = bohrAnschnitt(d, opt.sigma), lu = opt.durchgang ? (opt.lu == null ? 0 : opt.lu) : 0;
    return nn(tiefe) && ok(la) && nn(lu) ? tiefe + la + lu : NaN;
  }
  /* Bohrzeit th = L / (f * n)  (min) */
  function thBohr(tiefe, d, f, n, opt) { return th(bohrWeg(tiefe, d, opt), 1, vf(f, n)); }

  /* ---------- Drehzahlreihe einer Maschine ---------- */
  /* Normzahlreihe R20/2, Beispielmaschine Drehbank (min^-1) */
  var SERIES_STD = [45, 63, 90, 125, 180, 250, 355, 500, 710, 1000, 1400, 2000];
  /* nächstliegende Stufe (kleinster Abstand zum Sollwert; bei Gleichstand die niedrigere) */
  function nearestSpeed(series, nSoll) {
    if (!Array.isArray(series) || !series.length || !pos(nSoll)) return NaN;
    var best = series[0], bd = Math.abs(series[0] - nSoll);
    for (var k = 1; k < series.length; k++) {
      var dd = Math.abs(series[k] - nSoll);
      if (dd < bd - 1e-9 || (Math.abs(dd - bd) <= 1e-9 && series[k] < best)) { best = series[k]; bd = dd; }
    }
    return best;
  }
  /* höchste Stufe, die nSoll nicht überschreitet (Praxis: lieber etwas niedriger). NaN, wenn alle Stufen höher sind */
  function lowerSpeed(series, nSoll) {
    if (!Array.isArray(series) || !pos(nSoll)) return NaN;
    var best = NaN;
    series.forEach(function (s) { if (s <= nSoll + 1e-9 && (isNaN(best) || s > best)) best = s; });
    return best;
  }
  /* alle Stufen, bei denen vc im Fenster [lo, hi] liegt */
  function speedsInWindow(series, d, lo, hi) {
    if (!Array.isArray(series) || !pos(d) || !ok(lo) || !ok(hi)) return [];
    return series.filter(function (s) { var v = vc(d, s); return v >= lo - 1e-9 && v <= hi + 1e-9; });
  }
  /* Lage von vc zum Fenster: 'niedrig' | 'ok' | 'hoch' */
  function vcStatus(v, win) {
    if (!ok(v) || !win) return '';
    if (v < win[0] - 1e-9) return 'niedrig';
    if (v > win[1] + 1e-9) return 'hoch';
    return 'ok';
  }

  /* ---------- Richtwerte (RICHTWERTE, Werkzeughersteller beachten!) ----------
     vc-Fenster [von, bis] in m/min. Gruppen: stahl (unlegiert/Baustahl), alu (Knetlegierung), messing (zerspanbar), guss (Grauguss).
     PRUEFEN: alle Zahlen sind gerundete Mittelwerte aus üblichen Herstellertafeln, vor Verwendung im Unterricht durch den Ausbilder bestätigen. */
  var GRUPPEN = [['stahl', 'Stahl (Baustahl)'], ['alu', 'Aluminium'], ['messing', 'Messing'], ['guss', 'Guss (Grauguss)']];
  var VC_TAB = {
    dreh: { stahl: { hss: [20, 35], hm: [120, 220] }, alu: { hss: [100, 180], hm: [250, 500] }, messing: { hss: [60, 100], hm: [150, 300] }, guss: { hss: [15, 25], hm: [80, 150] } }, /* PRUEFEN */
    fraes: { stahl: { hss: [20, 30], hm: [100, 200] }, alu: { hss: [100, 200], hm: [250, 500] }, messing: { hss: [60, 100], hm: [150, 250] }, guss: { hss: [15, 25], hm: [70, 120] } }, /* PRUEFEN */
    bohr: { stahl: { hss: [20, 30], hm: null }, alu: { hss: [60, 100], hm: null }, messing: { hss: [40, 70], hm: null }, guss: { hss: [15, 25], hm: null } } /* PRUEFEN; Bohren hier nur mit HSS-Bohrer */
  };
  /* Werkstoffe mit kc-Richtwert (N/mm^2), vereinfacht für übliche Spanungsdicken, ohne Korrektur nach Spanungsdicke. PRUEFEN */
  var MATERIALS = {
    s235: { name: 'S235 (Baustahl)', gruppe: 'stahl', kc: 2100 }, /* PRUEFEN */
    c45: { name: 'C45 (Vergütungsstahl)', gruppe: 'stahl', kc: 2400 }, /* PRUEFEN */
    alu: { name: 'Aluminium (AlMgSi)', gruppe: 'alu', kc: 800 }, /* PRUEFEN */
    gg: { name: 'GG (Grauguss)', gruppe: 'guss', kc: 1100 } /* PRUEFEN */
  };
  var PROCS = { dreh: 'Drehen', fraes: 'Fräsen', bohr: 'Bohren' };
  var CUTS = { hss: 'HSS', hm: 'Hartmetall' };
  function vcWindow(proc, gruppe, schneid) {
    var p = VC_TAB[proc]; if (!p || !p[gruppe]) return null;
    var w = p[gruppe][schneid]; return w ? w.slice() : null;
  }
  function kcOf(mat) { return MATERIALS[mat] ? MATERIALS[mat].kc : NaN; }
  function gruppeOf(mat) { return MATERIALS[mat] ? MATERIALS[mat].gruppe : null; }

  /* ---------- Zahlen lesen, vergleichen, anzeigen ---------- */
  /* Deutsche und englische Schreibweise; Einheiten und Leerzeichen am Ende werden ignoriert */
  function parseDE(s) {
    if (typeof s === 'number') return ok(s) ? s : NaN;
    if (s == null) return NaN;
    var t = String(s).trim().replace(/[−–]/g, '-').replace(/\s+/g, '');
    var m = t.match(/^([+-]?[\d.,']*\d(?:[eE][+-]?\d+)?)(?:[^\d].*)?$/);
    if (!m) return NaN;
    var x = m[1].replace(/'/g, '');
    var lc = x.lastIndexOf(','), ld = x.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) { if (lc > ld) x = x.replace(/\./g, '').replace(',', '.'); else x = x.replace(/,/g, ''); }
    else if (lc >= 0) { if ((x.match(/,/g) || []).length > 1) x = x.replace(/,/g, ''); else x = x.replace(',', '.'); }
    else if (ld >= 0) { var parts = x.split('.'); if (parts.length > 2) x = x.replace(/\./g, ''); }
    var v = parseFloat(x);
    return ok(v) ? v : NaN;
  }
  /* Antwort gilt, wenn sie innerhalb von tol Prozent liegt oder genau der sinnvoll gerundete Sollwert ist (0 bis 3 Nachkommastellen) */
  function checkNum(input, sol, opt) {
    opt = opt || {};
    var tol = opt.tol == null ? 2 : opt.tol, u = parseDE(input), r = { ok: false, value: u, rel: NaN };
    if (!ok(u) || !ok(sol)) return r;
    var d = Math.abs(u - sol);
    r.rel = sol === 0 ? (d === 0 ? 0 : Infinity) : d / Math.abs(sol) * 100;
    var absOk = opt.abs != null && d <= opt.abs;
    var rounded = false;
    for (var k = 0; k <= 3; k++) { if (Math.abs(u - Number(sol.toFixed(k))) < 1e-9) rounded = true; }
    r.ok = r.rel <= tol + 1e-9 || absOk || rounded;
    return r;
  }
  /* Zahl deutsch, dec Nachkommastellen (Standard: gültige Stellen je nach Größe) */
  function fmt(v, dec) {
    if (!ok(v)) return '–';
    var a = Math.abs(v), d = dec != null ? dec : (a === 0 ? 0 : a >= 1000 ? 0 : a >= 100 ? 1 : a >= 10 ? 1 : a >= 1 ? 2 : 3);
    var s = v.toFixed(d);
    if (dec == null && s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    var neg = s[0] === '-'; if (neg) s = s.slice(1);
    var p = s.split('.'), ip = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg ? '−' : '') + ip + (p[1] ? ',' + p[1] : '');
  }
  /* Minuten als "m min s s" für die Anzeige */
  function fmtZeit(min) {
    if (!ok(min) || min < 0) return '–';
    var s = Math.round(min * 60), m = Math.floor(s / 60), r = s % 60;
    if (m === 0) return r + ' s';
    return m + ' min ' + (r < 10 ? '0' : '') + r + ' s';
  }

  /* ---------- Zufall mit Startwert (für Aufgaben) ---------- */
  function hashStr(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    var a = hashStr(seed) || 1;
    function next() { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
    next.int = function (lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); };
    next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
    next.shuffle = function (arr) { var b = arr.slice(); for (var i = b.length - 1; i > 0; i--) { var j = Math.floor(next() * (i + 1)); var t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
    return next;
  }

  var ZER_CORE = {
    vc: vc, nFromVc: nFromVc, dFromVcN: dFromVcN, mPerMinToMmPerMin: mPerMinToMmPerMin, mmPerMinToMPerMin: mmPerMinToMPerMin, rpsToRpm: rpsToRpm, rpmToRps: rpmToRps,
    vf: vf, fFromVf: fFromVf, weg: weg, th: th, thDreh: thDreh, schnitte: schnitte, spanquerschnitt: spanquerschnitt,
    schnittkraft: schnittkraft, schnittleistung: schnittleistung, motorleistung: motorleistung,
    vfFraes: vfFraes, fzFromVf: fzFromVf, fFraes: fFraes, thFraes: thFraes,
    bohrAnschnitt: bohrAnschnitt, bohrWeg: bohrWeg, thBohr: thBohr,
    SERIES_STD: SERIES_STD, nearestSpeed: nearestSpeed, lowerSpeed: lowerSpeed, speedsInWindow: speedsInWindow, vcStatus: vcStatus,
    GRUPPEN: GRUPPEN, VC_TAB: VC_TAB, MATERIALS: MATERIALS, PROCS: PROCS, CUTS: CUTS, vcWindow: vcWindow, kcOf: kcOf, gruppeOf: gruppeOf,
    parseDE: parseDE, checkNum: checkNum, fmt: fmt, fmtZeit: fmtZeit, rng: rng, hashStr: hashStr
  };
  root.ZER_CORE = ZER_CORE;
  if (typeof module !== 'undefined' && module.exports) module.exports = ZER_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
