/* anacore.js - ANA-Lab Kern Teil 1 (ANA_CORE, Version 1.0): Basis, limits, Glossar, TEXTS, diode, tr, emit, grund
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.ANA_CORE, Node: module.exports / globalThis.ANA_CORE.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval. Alle Bauteil- und Anlagenwerte sind Uebungswerte (Lehrmodelle mit offen genannten Grenzen).
 * Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. Norm und Vorschrift massgeblich.
 * Teil 2 (op, komp, act, deep) steht in anacore-op.js, Teil 3 (report, assess, diagnose, formulas, exercise, runSeq) in anacore-res.js.
 * Beide haengen sich an dasselbe Objekt (ANA_CORE.extend(name, obj) bzw. direkte Zuweisung; Hilfen: ANA_CORE.util, nicht aufzaehlbar).
 * Hinweis: Dieser Kern ersetzt ein evtl. geladenes ANA_CORE aus stub/stubcore.js; Teil 2 und 3 daher immer mit require('./anacore.js') laden.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten: SI (V, A, Ohm, F, H, Hz, s, W), Winkel in GRAD, Verstaerkung als Zahl (negativ = invertierend), nicht definierte Felder NaN
 *    (nie Infinity). Widerstaende sind im Bereich (0; 1e13] gueltig, R_OFFEN = 1e12 (offen), R_KURZ = 1e-3 (Kurzschluss).
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt und werfen NIE. Rechenfunktionen liefern NaN, Strukturfunktionen { ok:false, why:'deutscher Text' }.
 *    Betriebszustaende, in denen eine Formel nicht gilt (Transistor nicht aktiv bei Kleinsignal, Last bekommt keinen Strom), melden
 *    { ok:true, valid:false, why } und rechnen nie still weiter. Ergebnisse mit Infinity werden zu { ok:false, why }.
 *  - Fehlerfaelle kennt der Kern nicht: Rigs ersetzen Eingaben (offen R_OFFEN, Kurzschluss R_KURZ, offener Kondensator 1e-12). Nur Transistordefekt
 *    ueber defekt:'ce_schluss'|'ce_offen'|'be_offen' (tr.dc, emit.*, grund.compare).
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32). Feste Zahlen stehen NUR in ANA_CORE.limits (status 'belegt' | 'A').
 *
 * SIGNATUREN (SPEC 4 ist massgeblich; Rueckgabeformen wie stub/stubcore.js, hier die Festlegungen, die dort offen waren)
 *  Basis:   guard(fn,fb) cx{add,sub,mul,div,abs,arg,fromPolar,conj,make} rng(seed)->()=>[0,1) (+ .next, .normal) fmt(x,d) fmtEng(x,unit)
 *           parseNum(str)=parseQty(str)->number|NaN  limits[] limit(id) limitText(id) limitOK(id,x) grid(center,n,decLo,decHi)
 *           glossary[] (+ .get(term)) TEXTS{...,get(id)} R_OFFEN R_KURZ
 *  diode:   types[] curve(cfg,uList) operating(cfg) rvFor({uq,uf,i}) rvZMin({uqmax,uz,pz}) ledSwap({uq,uf1,i1,uf2,modus})
 *           cfg { typ, modell:'kennlinie'|'konstant', uq, rv (>= R_KURZ), rlast (nur Z, >= 1e11 keine Last), uf, uz, rz, temp }
 *           operating -> { ok, valid, ud, id, iz, ilast, iq, ur, pr, pd, rd, us, zustand, ueberlast, ... }
 *  tr:      dc(cfg) rbFor(cfg) switch(cfg) relais(cfg) cs(cfg) zfolger(cfg) family(cfg, ibList, uceList)
 *  emit:    ac(cfg) large(cfg,n) line(cfg)        grund: compare(cfg)
 *  Abweichungen von SPEC/Stub (Begruendung ABWEICHUNGEN.md, Abschnitt WP1a):
 *   - rlast wirkt nur bei typ 'z'. Z-Diode ohne uz nimmt limits.uz_std (neuer Uebungswert, Frage F20).
 *   - tr.switch (LED, sperrt): U_CE = U_B (kein Strom, keine Spannung an der LED); reicht U_B nicht fuer U_CE,sat und U_F, ist valid:false.
 *   - emit.line: Wechselstrom-Arbeitsgerade von der Strom- bis zur Spannungsachse (nicht nur ein Stueck um den Arbeitspunkt).
 *   - grund.compare: die Emitterspalte ruft emit.ac (beruecksichtigt ce), Zusatzfeld direkt (R_L/(R_G+R_L)).
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const TWO_PI = 2 * Math.PI, RAD = Math.PI / 180, DEG = 180 / Math.PI;
  const R_OFFEN = 1e12, R_KURZ = 1e-3;

  /* ---------- Hilfsfunktionen ---------- */
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.trim().replace(',', '.')); return isFinite(x) ? x : d; }
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  function z0(x) { return x === 0 ? 0 : x; }          // -0 vermeiden
  function par(a, b) { return a * b / (a + b); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  /* Validierungsfehler mit deutschem Text (S() macht daraus { ok:false, why }, C() macht daraus NaN) */
  function V(why) { const e = new Error(why); e.anaWhy = why; throw e; }
  function reqObj(o) { if (!isObj(o)) V('Es fehlen gültige Eingabewerte.'); return o; }
  function reqPos(v, name, max) {
    const x = num(v, NaN);
    if (!(x > 0)) V(name + ' muss eine Zahl größer als 0 sein.');
    if (x > (max || 1e13)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqNn(v, name, max) {
    const x = num(v, NaN);
    if (!(x >= 0)) V(name + ' muss eine Zahl sein und darf nicht negativ sein.');
    if (x > (max || 1e13)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqFin(v, name, max) {
    const x = num(v, NaN);
    if (!isFinite(x)) V(name + ' muss eine Zahl sein.');
    if (Math.abs(x) > (max || 1e4)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqRange(v, lo, hi, name) {
    const x = num(v, NaN);
    if (!(x >= lo && x <= hi)) V(name + ' muss zwischen ' + fmtEngRaw(lo) + ' und ' + fmtEngRaw(hi) + ' liegen.');
    return x;
  }
  function none(v) { return v === undefined || v === null; }
  function optPos(v, d, name, max) { return none(v) ? d : reqPos(v, name, max); }
  function optNn(v, d, name, max) { return none(v) ? d : reqNn(v, name, max); }
  function optFin(v, d, name, max) { return none(v) ? d : reqFin(v, name, max); }
  function hasInf(o, depth) {
    if (typeof o === 'number') return o === Infinity || o === -Infinity;
    if (depth > 3 || o === null || typeof o !== 'object') return false;
    const ks = Object.keys(o);
    for (let i = 0; i < ks.length; i++) if (hasInf(o[ks[i]], depth + 1)) return true;
    return false;
  }
  function checkOut(r) {
    if (isObj(r) && r.ok === true && hasInf(r, 0)) return fail('Das Ergebnis liegt außerhalb des darstellbaren Zahlenbereichs.');
    return r;
  }
  /* C: Rechenfunktion -> NaN. S: Strukturfunktion -> { ok:false, why }. A: Liste -> []. */
  function C(fn) { return function () { try { const r = fn.apply(this, arguments); return typeof r === 'number' && !isFinite(r) ? NaN : r; } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return checkOut(fn.apply(this, arguments)); } catch (e) { return fail(e && e.anaWhy ? e.anaWhy : 'Mit diesen Eingaben gibt es kein Ergebnis.'); } }; }
  function A(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return []; } }; }
  function guard(fn, fb) {
    return function () {
      try {
        if (typeof fn !== 'function') throw new Error('keine Funktion');
        return fn.apply(this, arguments);
      } catch (e) {
        if (typeof fb === 'function') { try { return fb(e); } catch (e2) { return NaN; } }
        return fb === undefined ? NaN : fb;
      }
    };
  }
  /* Gueltiges Ergebnis, aber Formel ausserhalb ihres Bereichs: Zahlen NaN, Text sagt warum */
  function invalid(why, nanKeys, extra) {
    const o = { ok: true, valid: false, why: why };
    (nanKeys || []).forEach(function (k) { o[k] = NaN; });
    if (extra) for (const k in extra) o[k] = extra[k];
    return o;
  }
  api.version = '1.0';
  api.guard = guard;
  api.R_OFFEN = R_OFFEN;
  api.R_KURZ = R_KURZ;

  /* ---------- Zahlen: Ausgabe ---------- */
  function fmt(x, digits) {
    x = num(x, NaN);
    if (!isFinite(x)) return '–';
    let s;
    const dg = none(digits) ? NaN : Number(digits);
    if (isFinite(dg)) s = x.toFixed(clamp(Math.round(dg), 0, 10));
    else if (x === 0) s = '0';
    else {
      const a = Math.abs(x);
      if (a >= 1e4) s = a < 1e15 ? String(Math.round(x)) : x.toExponential(3);
      else if (a >= 1e-4) s = String(Number(x.toPrecision(4)));
      else s = x.toExponential(2);
    }
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('.', ',');
  }
  const MU = 'µ';
  const PREF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, MU], [1e-9, 'n'], [1e-12, 'p']];
  /* fmtEng(4700,'Ω') -> '4,7 kΩ'; drei gueltige Stellen */
  function fmtEng(x, unit) {
    x = num(x, NaN);
    const u = typeof unit === 'string' ? unit : '';
    if (!isFinite(x)) return '–';
    if (x === 0) return '0' + (u ? ' ' + u : '');
    const a = Math.abs(x);
    let k = PREF.length - 1;
    for (let i = 0; i < PREF.length; i++) { if (a >= PREF[i][0] * 0.99995) { k = i; break; } }
    let v = Number((x / PREF[k][0]).toPrecision(3));
    if (Math.abs(v) >= 1000 && k > 0) { k -= 1; v = Number((x / PREF[k][0]).toPrecision(3)); }
    return String(v).replace('.', ',') + (u || PREF[k][1] ? ' ' + PREF[k][1] + u : '');
  }
  function fmtEngRaw(x) { return fmtEng(x, ''); }
  api.fmt = guard(fmt, '–');
  api.fmtEng = guard(fmtEng, '–');

  /* ---------- Zahlen: Eingabe (parseNum/parseQty -> number | NaN) ---------- */
  const PFX = { p: -12, n: -9, 'µ': -6, 'μ': -6, u: -6, m: -3, k: 3, K: 3, M: 6, G: 9, T: 12 };   // Zehnerexponenten
  const UNITS = ['hz', 'v', 'a', 'f', 'h', 'ohm', 'ω', 'w', 's', 'db', '%', '°', '°c', 'va', 'var'];
  function scale(v, e) { return e >= 0 ? v * Math.pow(10, e) : v / Math.pow(10, -e); }   // exakte Zehnerpotenzen (10 µF -> 1e-5)
  function unitFactor(rest) {   // liefert den Zehnerexponenten der Einheit (Vorsatz, V/µs) oder NaN
    let r = rest.trim().replace(/Ω/g, 'Ω');
    if (r === '') return 0;
    const low = r.toLowerCase();
    // Slew-Rate: V/µs, V/us, V/ms, V/ns, V/s  (Ergebnis in V/s)
    let m = low.match(/^v\s*\/\s*([µμunm]?)s$/);
    if (m) return m[1] === '' ? 0 : -PFX[m[1]];
    if (UNITS.indexOf(low) >= 0) return 0;
    if (r.length === 1 && has(PFX, r)) return PFX[r];
    if (r.length >= 2 && has(PFX, r[0]) && UNITS.indexOf(low.slice(1)) >= 0 && low.slice(1) !== '%' && low.slice(1) !== '°') return PFX[r[0]];
    return NaN;
  }
  function numBody(b) {
    if (/[  ]/.test(b)) {
      if (!/^\d{1,3}([  ]\d{3})+([.,]\d+)?$/.test(b)) return NaN;
      b = b.replace(/[  ]/g, '');
    }
    const nC = (b.match(/,/g) || []).length, nP = (b.match(/\./g) || []).length;
    if (nC && nP) {
      const dec = b.lastIndexOf(',') > b.lastIndexOf('.') ? ',' : '.', th = dec === ',' ? '.' : ',';
      const parts = b.split(dec);
      if (parts.length !== 2) return NaN;
      if (!new RegExp('^\\d{1,3}(?:\\' + th + '\\d{3})+$|^\\d+$').test(parts[0]) || !/^\d+$/.test(parts[1])) return NaN;
      b = parts[0].split(th).join('') + '.' + parts[1];
    } else if (nC > 1 || nP > 1) {
      const sep = nC > 1 ? ',' : '.';
      if (!new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$').test(b)) return NaN;
      b = b.split(sep).join('');
    } else if (nC === 1) b = b.replace(',', '.');
    if (!/^\d+\.?\d*$|^\.\d+$/.test(b)) return NaN;
    return Number(b);
  }
  function parseNum(str) {
    if (typeof str === 'number') return isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    let s = str.replace(/ /g, ' ').trim();
    if (s === '' || s.length > 60) return NaN;
    let v, rest;
    // Kurzschreibweise 4k7, 2u2
    let m = s.match(/^([+-]?)(\d+)([pnukµμmMGT])(\d+)\s*(.*)$/);
    if (m && has(PFX, m[3])) {
      const f = unitFactor(m[5]);
      if (isNaN(f)) return NaN;
      v = scale(Number(m[2] + '.' + m[4]), PFX[m[3]] + f);
      return isFinite(v) ? (m[1] === '-' ? -v : v) : NaN;
    }
    m = s.match(/^([+-]?)(\d[\d.,  ]*\d|\d|[.,]\d+)(?:\s*[eE]\s*([+-]?\d+)|\s*(?:·|\*|x|×)\s*10\s*(?:\^|\*\*)?\s*([+-]?\d+))?\s*(.*)$/);
    if (!m) return NaN;
    let body = numBody(m[2].replace(/^,/, '0,').replace(/^\./, '0.'));
    if (isNaN(body)) return NaN;
    const ex = m[3] !== undefined ? m[3] : m[4];
    if (ex !== undefined) { const e = Number(ex); if (Math.abs(e) > 300) return NaN; body = scale(body, e); }
    rest = m[5];
    const f = unitFactor(rest);
    if (isNaN(f)) return NaN;
    v = scale(body, f);
    if (!isFinite(v)) return NaN;
    return m[1] === '-' ? -v : v;
  }
  api.parseNum = guard(parseNum, NaN);
  api.parseQty = api.parseNum;

  /* ---------- Zufall (mulberry32): rng(seed) -> () => [0,1), dazu .next und .normal ---------- */
  function rng(seed) {
    let a = Math.floor(num(seed, 1)) | 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    let spare = null;
    function normal() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u = 0;
      while (u === 0) u = next();
      const v = next(), r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(TWO_PI * v);
      return r * Math.cos(TWO_PI * v);
    }
    const f = function () { return next(); };
    f.next = next; f.normal = normal;
    return f;
  }
  api.rng = function (seed) { try { return rng(seed); } catch (e) { return rng(1); } };

  /* ---------- Komplexe Zahlen { re, im } (Winkel im Bogenmass) ---------- */
  const NC = function () { return { re: NaN, im: NaN }; };
  function cxOk(a) { return isObj(a) && fin(a.re) && fin(a.im); }
  const cx = {
    make: function (re, im) { try { re = Number(re); im = Number(im); return fin(re) && fin(im) ? { re: re, im: im } : NC(); } catch (e) { return NC(); } },
    add: function (a, b) { try { return cxOk(a) && cxOk(b) ? { re: a.re + b.re, im: a.im + b.im } : NC(); } catch (e) { return NC(); } },
    sub: function (a, b) { try { return cxOk(a) && cxOk(b) ? { re: a.re - b.re, im: a.im - b.im } : NC(); } catch (e) { return NC(); } },
    mul: function (a, b) { try { return cxOk(a) && cxOk(b) ? { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re } : NC(); } catch (e) { return NC(); } },
    div: function (a, b) {
      try {
        if (!cxOk(a) || !cxOk(b)) return NC();
        const d = b.re * b.re + b.im * b.im;
        if (!(d > 0) || !isFinite(d)) return NC();
        const r = { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
        return fin(r.re) && fin(r.im) ? r : NC();
      } catch (e) { return NC(); }
    },
    conj: function (a) { try { return cxOk(a) ? { re: a.re, im: -a.im } : NC(); } catch (e) { return NC(); } },
    abs: function (a) { try { return cxOk(a) ? Math.hypot(a.re, a.im) : NaN; } catch (e) { return NaN; } },
    arg: function (a) { try { return cxOk(a) ? Math.atan2(a.im, a.re) : NaN; } catch (e) { return NaN; } },
    fromPolar: function (r, phi) { try { r = num(r, NaN); phi = num(phi, NaN); return fin(r) && fin(phi) ? { re: r * Math.cos(phi), im: r * Math.sin(phi) } : NC(); } catch (e) { return NC(); } }
  };
  api.cx = cx;

  /* =============================== limits (einzige Quelle fester Zahlen, SPEC 4.0 und 12) =============================== */
  const LIM = [
    /* belegt (Pruefungspool, SPEC 12.1) */
    ['ube', 0.7, 'V', '=', 'belegt', 'pool:H2022-N05', null, 'Basis-Emitter-Spannung des Siliziumtransistors'],
    ['uf_si', 0.7, 'V', '=', 'belegt', 'pool:H2023-N08', null, 'Flussspannung der Siliziumdiode'],
    ['ufd_freilauf', 0.7, 'V', '=', 'belegt', 'pool:F2026-16', null, 'Freilaufdiode begrenzt die Spannung auf die Flussspannung der Siliziumdiode'],
    ['db_faktor', 20, '', '=', 'belegt', 'pool:S2025-26', null, 'Spannungsverstärkungsmaß a = 20 · lg V_u'],
    ['emitter_phase', 180, '°', '=', 'belegt', 'pool:S2022-N32', null, 'Emitterschaltung dreht die Phase um 180°'],
    ['kollektor_vu', 1, '', '<=', 'belegt', 'pool:S2022-N33', null, 'Kollektorschaltung: V_u knapp unter 1, keine Phasendrehung'],
    ['opv_folger_v', 1, '', '=', 'belegt', 'pool:F2025-11', null, 'Spannungsfolger: V_u = 1'],
    ['opv_nin_vmin', 1, '', '>=', 'belegt', 'pool:H2026-13', null, 'Nichtinvertierender Verstärker: V_u ist nie kleiner als 1'],
    ['opv_inv_phase', 180, '°', '=', 'belegt', 'pool:F2026-07', null, 'Invertierender Verstärker dreht die Phase um 180°'],
    ['integr_db', -20, 'dB/Dekade', '=', 'belegt', 'pool:W2025-05', null, 'Integrierer: Verstärkung fällt um 20 dB je Dekade'],
    ['schmitt_schwellen', 2, '', '=', 'belegt', 'pool:W2021-N28', null, 'Schmitt-Trigger hat zwei Schaltschwellen'],
    /* Uebungswerte (A), Fragen in AUSBILDER.md */
    ['ut', 0.026, 'V', '=', 'A', '—', 'F3', 'Temperaturspannung (Lehrwert)'],
    ['tk_uf', -0.002, 'V/K', '=', 'A', '—', 'F3', 'Temperaturkoeffizient der Flussspannung (Lehrwert)'],
    ['temp_ref', 27, '°C', '=', 'A', '—', 'F3', 'Bezugstemperatur der Bauteilwerte (Lehrwert)'],
    ['uf_iref', 0.01, 'A', '=', 'A', '—', 'F2', 'Bezugsstrom, bei dem die Flussspannungen der Diodentypen gelten'],
    ['n_led', 2, '', '=', 'A', '—', 'F1', 'Idealitätsfaktor der LED im Kennlinienmodell (Silizium und Schottky: 1)'],
    ['uf_schottky', 0.3, 'V', '=', 'A', '—', 'F2', 'Flussspannung Schottky-Diode bei 10 mA'],
    ['uf_led_rot', 2.0, 'V', '=', 'A', '—', 'F2', 'Flussspannung rote LED bei 10 mA'],
    ['uf_led_gelb', 2.1, 'V', '=', 'A', '—', 'F2', 'Flussspannung gelbe LED bei 10 mA'],
    ['uf_led_gruen', 2.2, 'V', '=', 'A', '—', 'F2', 'Flussspannung grüne LED bei 10 mA'],
    ['uf_led_blau', 3.1, 'V', '=', 'A', '—', 'F2', 'Flussspannung blaue LED bei 10 mA'],
    ['led_imax', 0.02, 'A', '<=', 'A', '—', 'F2', 'Zulässiger LED-Strom'],
    ['pz_max', 0.5, 'W', '<=', 'A', '—', 'F2', 'Zulässige Verlustleistung der Z-Diode'],
    ['rz', 10, 'Ω', '=', 'A', '—', 'F2', 'Dynamischer Widerstand der Z-Diode im Durchbruch'],
    ['uz_std', 5.1, 'V', '=', 'A', '—', 'F20', 'Z-Spannung der Z-Diode in der Voreinstellung (wenn die Aufgabe keine nennt)'],
    ['b_std', 100, '', '=', 'A', '—', 'F4', 'Gleichstromverstärkung B'],
    ['ucesat', 0.2, 'V', '=', 'A', '—', 'F4', 'Sättigungsspannung U_CE,sat'],
    ['uceo', 40, 'V', '<=', 'A', '—', 'F4', 'Zulässige Kollektor-Emitter-Spannung'],
    ['ptot', 0.5, 'W', '<=', 'A', '—', 'F4', 'Zulässige Verlustleistung des Transistors'],
    ['icmax', 0.5, 'A', '<=', 'A', '—', 'F4', 'Zulässiger Kollektorstrom'],
    ['ue_min', 1.5, '', '>=', 'A', '—', 'F5', 'Mindest-Übersteuerungsfaktor (grün)'],
    ['ue_typ', 3, '', '=', 'A', '—', 'F5', 'Übliche Übersteuerung beim Dimensionieren'],
    ['ap_fenster', 0.15, '', '<=', 'A', '—', 'F6', 'Arbeitspunkt-Fenster: Abweichung von der Vorgabe in Anteilen der Betriebsspannung'],
    ['klirr_grenze', 0.05, '', '<=', 'A', '—', 'F6', 'Klirrfaktor, ab dem die Verzerrung gemeldet wird'],
    ['uv_std', 12, 'V', '=', 'A', '—', 'F10', 'Betriebsspannung des Operationsverstärkers (± Spannung)'],
    ['u_klein', 30, 'V', '<=', 'A', '—', 'F15', 'Obergrenze der Kleinspannung in diesem Lab (Simulation)'],
    ['a0', 1e5, '', '=', 'A', '—', 'F9', 'Leerlaufverstärkung des Operationsverstärkers'],
    ['gbw_langsam', 1e6, 'Hz', '=', 'A', '—', 'F9', 'Verstärkungs-Bandbreite-Produkt (langsamer OPV)'],
    ['sr_langsam', 0.5e6, 'V/s', '=', 'A', '—', 'F9', 'Slew-Rate (langsamer OPV)'],
    ['uos_langsam', 0.002, 'V', '=', 'A', '—', 'F9', 'Offsetspannung (langsamer OPV)'],
    ['gbw_schnell', 3e6, 'Hz', '=', 'A', '—', 'F9', 'Verstärkungs-Bandbreite-Produkt (schneller OPV)'],
    ['sr_schnell', 13e6, 'V/s', '=', 'A', '—', 'F9', 'Slew-Rate (schneller OPV)'],
    ['uos_schnell', 0.003, 'V', '=', 'A', '—', 'F9', 'Offsetspannung (schneller OPV)'],
    ['dusat', 1.5, 'V', '=', 'A', '—', 'F9', 'Abstand der Aussteuergrenze zur Betriebsspannung (realer OPV)'],
    ['ro_ol', 75, 'Ω', '=', 'A', '—', 'F9', 'Ausgangswiderstand ohne Gegenkopplung'],
    ['rid', 2e6, 'Ω', '=', 'A', '—', 'F9', 'Differenzeingangswiderstand'],
    ['fenster_gruen', 0.05, '', '<=', 'A', '—', 'F16', 'Ampel grün: Abweichung von der Vorgabe (Ströme, Verstärkungen)'],
    ['fenster_gelb', 0.10, '', '<=', 'A', '—', 'F16', 'Ampel gelb: Abweichung von der Vorgabe (Ströme, Verstärkungen)'],
    ['fenster_op_gruen', 0.02, '', '<=', 'A', '—', 'F16', 'Ampel grün bei Operationsverstärker-Schaltungen'],
    ['fenster_op_gelb', 0.05, '', '<=', 'A', '—', 'F16', 'Ampel gelb bei Operationsverstärker-Schaltungen']
  ];
  const limits = LIM.map(function (r) { return Object.freeze({ id: r[0], value: r[1], unit: r[2], cmp: r[3], status: r[4], quelle: r[5], frage: r[6], text: r[7] }); });
  api.limits = limits;
  function L(id) {
    for (let i = 0; i < limits.length; i++) if (limits[i].id === id) return limits[i];
    V('Unbekannter Grenzwert: ' + String(id));
  }
  api.limit = S(function (id) { return L(id); });
  function LV(id) { const l = L(id); return l.value === null ? NaN : l.value; }
  const CMPS = { '<=': '≤ ', '>=': '≥ ', '=': '' };
  function statusTag(l) { return l.status === 'belegt' ? 'belegt' : 'Übungswert'; }
  /* Wert und Einheit fuer die Anzeige: Hz, Ω, A mit Vorsatz, Slew-Rate in V/µs, sonst plain (0,7 V) */
  function limitValueText(l) {
    if (l.value === null) return '';
    if (l.unit === 'V/s') return fmt(l.value / 1e6) + ' V/' + MU + 's';
    if (l.unit === 'Hz' || l.unit === 'Ω' || l.unit === 'A') return fmtEng(l.value, l.unit);
    return fmt(l.value) + (l.unit ? ' ' + l.unit : '');
  }
  /* limitText('ube') -> '0,7 V'; Uebungswerte mit ' (Übungswert)'; cmp '<=' / '>=' als ≤ / ≥ */
  api.limitText = guard(function (id) {
    const l = L(id);
    return CMPS[l.cmp] + limitValueText(l) + (l.status === 'A' ? ' (Übungswert)' : '');
  }, '–');
  api.limitOK = guard(function (id, x) {
    const l = L(id); x = num(x, NaN);
    if (!isFinite(x) || l.value === null) return null;
    const tol = 1e-12 * Math.max(1, Math.abs(l.value));
    if (l.cmp === '<=') return x <= l.value + tol;
    if (l.cmp === '>=') return x >= l.value - tol;
    return Math.abs(x - l.value) <= tol;
  }, null);
  api.grid = guard(function (center, n, decLo, decHi) {
    const c = num(center, NaN);
    if (!(c > 0 && c <= 1e13)) return [];
    const N = Math.floor(num(n, 81)), lo = num(decLo, 1), hi = num(decHi, 1);
    if (!(N >= 2 && N <= 5000) || !(lo >= 0 && lo <= 12) || !(hi >= 0 && hi <= 12)) return [];
    const o = [];
    for (let i = 0; i < N; i++) o.push(c * Math.pow(10, -lo + (lo + hi) * i / (N - 1)));
    return o;
  }, []);
  const TK = LV('tk_uf'), TREF = LV('temp_ref');

  /* =============================== Texte (einzige Quelle) =============================== */
  const TEXTS = {
    simOnly: 'Simulation – Übungswerte. Aufbau und Messung am Labortisch nur nach Anweisung der Ausbilder.',
    ampelHinweis: 'Grün heißt: Vorgabe der Simulation erfüllt, nicht: Schaltung ist für jeden Einsatz geeignet.',
    protoHinweis: 'Übungsbericht, kein Nachweis.',
    kleinspannung: 'Alle Schaltungen in diesem Lab arbeiten mit Kleinspannung (bis ' + api.limitText('u_klein').replace(' (Übungswert)', '').replace('≤ ', '') + '). Netzspannung kommt hier nicht vor.',
    uebungswert: 'Übungswert: Der Ausbilder gleicht den Wert noch ab.',
    opvModell: 'Idealer Operationsverstärker: Eingangswiderstand unendlich, Ausgangswiderstand null, Verstärkung unendlich.',
    gegenkopplung: 'Ohne Gegenkopplung arbeitet der Operationsverstärker als Komparator und läuft in die Sättigung.',
    mitkopplung: 'Mitkopplung führt zum Kippen des Ausgangs: Der Schmitt-Trigger hat zwei Schaltschwellen.',
    vertiefungHinweis: 'Vertiefung: gilt für das Lehrmodell des Operationsverstärkers (Übungswerte).',
    modellDiode: 'Lehrmodell der Diode: Exponentialkennlinie oder konstante Flussspannung; die Z-Diode wird in Sperrrichtung im Durchbruch betrieben.',
    modellTransistor: 'Lehrmodell des Transistors: konstante Gleichstromverstärkung B, konstante Basis-Emitter-Spannung, Sättigung bei U_CE,sat; kein Early-Effekt, keine Kapazitäten.',
    modellEmitter: 'Modell der Emitterschaltung: Kleinsignal mit r_BE = B · U_T / I_C, Großsignal mit Exponentialkennlinie; Modell gilt bis zur Transitfrequenz ideal, der obere Frequenzgang entfällt.',
    mosfet: 'Der MOSFET ist spannungsgesteuert und braucht im Gleichgewicht keinen Steuerstrom; hier nur als Begriff, ohne Prüfstand und Rechnung.'
  };
  hide(TEXTS, 'get', function (id) { try { const t = TEXTS[id]; return typeof t === 'string' ? t : ''; } catch (e) { return ''; } });
  api.TEXTS = TEXTS;

  /* =============================== Glossar (einzige Quelle) =============================== */
  const LT = function (id) { return api.limitText(id); };
  const GL = [
    ['Arbeitspunkt', 'AP', 'Gleichstrom- und Gleichspannungswerte einer Schaltung ohne Signal; bei der Emitterschaltung vor allem I_C und U_CE. Er liegt auf der Kennlinie und auf der Arbeitsgeraden.'],
    ['Arbeitsgerade', '', 'Gerade im Ausgangskennlinienfeld, die vom Kollektorwiderstand (und Emitterwiderstand) bestimmt wird; der Arbeitspunkt liegt auf ihr.'],
    ['Flussspannung', 'U_F', 'Spannung an einer leitenden Diode in Durchlassrichtung; bei Silizium ' + LT('uf_si') + ', bei einer LED je nach Farbe höher.'],
    ['Schwellspannung', 'U_S', 'Schnittpunkt der Tangente an die Kennlinie im Arbeitspunkt mit der Spannungsachse; eine Näherung, kein fester Bauteilwert.'],
    ['Dynamischer Widerstand', 'r_d', 'Steigung der Kennlinie im Arbeitspunkt: r_d = dU/dI; bei der Diode im Durchlassbereich r_d = U_T / I (Faktor n bei der LED).'],
    ['Vorwiderstand', 'R_V', 'Widerstand in Reihe zu LED oder Z-Diode, der den Strom begrenzt: R_V = (U_B − U_F) / I_F.'],
    ['LED', '', 'Leuchtdiode; die Flussspannung hängt von der Farbe ab, ohne Vorwiderstand wird sie überlastet.'],
    ['Z-Diode', 'U_Z', 'Diode, die in Sperrrichtung im Durchbruch betrieben wird; die Spannung bleibt dabei nahezu gleich U_Z, der Vorwiderstand begrenzt den Strom.'],
    ['Freilaufdiode', '', 'Diode parallel zur Relaisspule in Sperrrichtung; sie übernimmt beim Abschalten den Spulenstrom und begrenzt die Spannung auf ' + LT('ufd_freilauf') + '.'],
    ['Temperaturspannung', 'U_T', 'Spannung k·T/q; im Lehrmodell ' + LT('ut') + '. Die Temperaturspannung bestimmt die Steilheit der Halbleiterkennlinie.'],
    ['Transistor', '', 'Halbleiterbauelement mit Basis, Kollektor und Emitter; der kleine Basisstrom steuert den großen Kollektorstrom.'],
    ['Gleichstromverstärkung', 'B', 'Verhältnis von Kollektorstrom zu Basisstrom: I_C = B · I_B (Formelzeichen B, nicht β).'],
    ['Basisvorwiderstand', 'R_B', 'Widerstand zwischen Steuerspannung und Basis des Schalttransistors: R_B = (U_St − U_BE) / I_B.'],
    ['Sättigung', '', 'Betriebszustand des durchgesteuerten Schalttransistors: U_CE ist auf U_CE,sat gesunken, der Kollektorstrom wird von der Last bestimmt, nicht von B.'],
    ['Sättigungsbereich', '', 'Bereich der Ausgangskennlinie mit U_CE kleiner als U_CE,sat; der Kollektorstrom folgt hier nicht mehr dem Basisstrom.'],
    ['Übersteuerungsfaktor', 'ü', 'Verhältnis des tatsächlichen Basisstroms zum Basisstrom, der für die Sättigung mindestens nötig ist: ü = I_B / I_B,min.'],
    ['Übersteuerung', '', 'Der Transistor wird mit mehr Basisstrom angesteuert, als für die Sättigung nötig ist (ü größer als 1); üblich ist ü = ' + LT('ue_typ').replace(' (Übungswert)', '') + ' (Übungswert).'],
    ['Emitterschaltung', '', 'Grundschaltung mit dem Emitter als gemeinsamem Bezugspunkt; sie verstärkt Spannung und Strom und dreht die Phase um ' + LT('emitter_phase') + '.'],
    ['Kollektorschaltung', '', 'Emitterfolger: Der Ausgang liegt am Emitter, V_u ist knapp unter 1, die Phase wird nicht gedreht.'],
    ['Emitterfolger', '', 'Anderer Name der Kollektorschaltung; sie arbeitet als Impedanzwandler.'],
    ['Basisschaltung', '', 'Grundschaltung mit der Basis als gemeinsamem Bezugspunkt; kleiner Eingangswiderstand, keine Phasendrehung.'],
    ['Spannungsverstärkung', 'V_u', 'Verhältnis von Ausgangs- zu Eingangswechselspannung (Verstärkungsfaktor); negativ bei Phasendrehung um 180°. In Pool-Aufgaben stehen auch g_u, v_u oder g_U für dieselbe Größe.'],
    ['Spannungsverstärkungsmaß', 'a', 'a = 20 · lg |V_u| in dB.'],
    ['Eingangswiderstand', 'r_ein', 'Widerstand, den die Schaltung der Signalquelle bietet (Impedanz am Eingang).'],
    ['Ausgangswiderstand', 'r_aus', 'Innenwiderstand der Schaltung am Ausgang; bei der Emitterschaltung R_C, beim Emitterfolger klein.'],
    ['Impedanzwandler', '', 'Schaltung mit hohem Eingangs- und kleinem Ausgangswiderstand (Kollektorschaltung, Spannungsfolger); sie belastet die Quelle kaum und treibt eine kleine Last.'],
    ['Steilheit', 'g_m', 'g_m = I_C / U_T: Änderung des Kollektorstroms je Änderung der Basis-Emitter-Spannung.'],
    ['Aussteuerung', '', 'Größe der Signalamplitude im Vergleich zum Bereich, den der Arbeitspunkt zulässt; zu große Aussteuerung führt zum Begrenzen.'],
    ['Begrenzen', '', 'Der Ausgang kann nicht weiter steigen oder fallen (Sättigung oder Sperren); die Halbwelle wird flach.'],
    ['Klirrfaktor', 'THD', 'Anteil der Oberwellen (zweite bis zehnte) an der Grundschwingung des Ausgangssignals.'],
    ['Koppelkondensator', 'C_1, C_2', 'Kondensator, der nur das Wechselsignal weitergibt und die Gleichspannung des Arbeitspunkts trennt; er bildet mit dem Widerstand einen Hochpass.'],
    ['Emitterkondensator', 'C_E', 'Kondensator parallel zum Emitterwiderstand; er überbrückt ihn für das Signal und hebt so die Gegenkopplung auf.'],
    ['Gegenkopplung', '', 'Rückführung eines Teils des Ausgangssignals gegen das Eingangssignal; sie legt die Verstärkung fest und verringert Verzerrungen.'],
    ['Mitkopplung', '', 'Rückführung im gleichen Sinn wie das Eingangssignal; sie führt zum Kippen (Schmitt-Trigger).'],
    ['Operationsverstärker', 'OPV', 'Differenzverstärker mit sehr hoher Verstärkung; seine Schaltung bestimmt die Gegenkopplung.'],
    ['Spannungsfolger', '', 'Nichtinvertierender Verstärker mit V_u = 1; Impedanzwandler.'],
    ['Summierer', '', 'Invertierender Verstärker mit mehreren Eingängen: U_a = −R_f · Σ(U_k / R_k).'],
    ['Differenzverstärker', '', 'Verstärker für die Differenz zweier Eingangsspannungen; Abgleich bei R_4 / R_2 = R_3 / R_1.'],
    ['Komparator', '', 'Operationsverstärker ohne Gegenkopplung: Der Ausgang geht je nach Vorzeichen der Eingangsdifferenz in die positive oder negative Sättigung.'],
    ['Schmitt-Trigger', '', 'Komparator mit Mitkopplung und zwei Schaltschwellen.'],
    ['Schaltschwelle', 'U_o, U_u', 'Eingangsspannung, bei der der Ausgang des Schmitt-Triggers kippt (obere und untere).'],
    ['Hysterese', 'U_H', 'Abstand zwischen oberer und unterer Schaltschwelle: U_H = U_o − U_u.'],
    ['Integrierer', '', 'Invertierender Verstärker mit Kondensator in der Rückführung: U_a = −(1 / (R · C)) · ∫U_e dt; die Verstärkung fällt um 20 dB je Dekade.'],
    ['Differenzierer', '', 'Verstärker mit Kondensator am Eingang; der Ausgang ist proportional zur Änderungsgeschwindigkeit des Eingangs.'],
    ['Slew-Rate', 'SR', 'Größte Änderungsgeschwindigkeit der Ausgangsspannung eines Operationsverstärkers in V/µs.'],
    ['Verstärkungs-Bandbreite-Produkt', 'GBW', 'Produkt aus Verstärkung und Grenzfrequenz eines gegengekoppelten Verstärkers (näherungsweise konstant).'],
    ['Leerlaufverstärkung', 'A₀', 'Verstärkung des Operationsverstärkers ohne Gegenkopplung bei tiefen Frequenzen.'],
    ['Offsetspannung', 'U_os', 'Kleine Eingangsspannung, die ein realer Operationsverstärker für Ausgangsspannung null braucht.'],
    ['Aussteuergrenze', 'U_sat', 'Größte Ausgangsspannung des Operationsverstärkers; sie liegt beim realen Verstärker unter der Betriebsspannung.'],
    ['Grenzfrequenz', 'f_g', 'Frequenz, bei der die Verstärkung auf das 0,707-fache (−3 dB) gesunken ist.']
  ];
  const glossary = GL.map(function (g) { return Object.freeze({ term: g[0], abbr: g[1], text: g[2] }); });
  hide(glossary, 'get', function (term) {
    try { const k = String(term).toLowerCase(); for (let i = 0; i < glossary.length; i++) if (glossary[i].term.toLowerCase() === k || (glossary[i].abbr && glossary[i].abbr.toLowerCase() === k)) return glossary[i]; } catch (e) { /* fall through */ }
    return null;
  });
  api.glossary = glossary;

  /* =============================== 4.1 Diode =============================== */
  const DT = {
    si: { name: 'Siliziumdiode', art: 'si', id: 'uf_si', n: 1 },
    schottky: { name: 'Schottky-Diode', art: 'schottky', id: 'uf_schottky', n: 1 },
    led_rot: { name: 'LED rot', art: 'led', id: 'uf_led_rot', n: 'led' },
    led_gelb: { name: 'LED gelb', art: 'led', id: 'uf_led_gelb', n: 'led' },
    led_gruen: { name: 'LED grün', art: 'led', id: 'uf_led_gruen', n: 'led' },
    led_blau: { name: 'LED blau', art: 'led', id: 'uf_led_blau', n: 'led' },
    z: { name: 'Z-Diode', art: 'z', id: 'uf_si', n: 1 }
  };
  function nOf(t) { return t.n === 'led' ? LV('n_led') : t.n; }
  const KEYS_D = Object.keys(DT);
  /* Parametersatz der Diode: Kennlinie I = I_S·(e^(U/(n·U_T)) − 1), I_S so, dass U = U_F beim Bezugsstrom fliesst */
  function dprm(cfg) {
    const typ = none(cfg.typ) ? 'si' : cfg.typ;
    if (typeof typ !== 'string' || !has(DT, typ)) V('Der Diodentyp „' + String(typ).slice(0, 20) + '“ ist unbekannt.');
    const t = DT[typ], mod = none(cfg.modell) ? 'kennlinie' : cfg.modell;
    if (mod !== 'kennlinie' && mod !== 'konstant') V('Das Diodenmodell muss „kennlinie“ oder „konstant“ sein.');
    const kon = mod === 'konstant', ut = LV('ut'), n = nOf(t);
    const temp = none(cfg.temp) ? TREF : reqRange(cfg.temp, -100, 400, 'Temperatur');
    const uf0 = none(cfg.uf) ? LV(t.id) : reqPos(cfg.uf, 'Die Flussspannung U_F', 100);
    const uf = uf0 + TK * (temp - TREF);
    if (!(uf > 0.05)) V('Bei dieser Temperatur gilt das Lehrmodell nicht: Die Flussspannung wäre nicht größer als 0.');
    const z = typ === 'z';
    const uz = z ? (none(cfg.uz) ? LV('uz_std') : reqPos(cfg.uz, 'Die Z-Spannung U_Z', 1000)) : NaN;
    const rz = z ? (kon ? 0 : optNn(cfg.rz, LV('rz'), 'Der dynamische Widerstand r_z', 1e6)) : NaN;
    const is = LV('uf_iref') / (Math.exp(uf / (n * ut)) - 1);
    return { typ: typ, t: t, art: t.art, n: n, ut: ut, is: is, uf: uf, kon: kon, z: z, uz: uz, rz: rz };
  }
  function iFwd(p, u) { return p.is * (Math.exp(Math.min(u / (p.n * p.ut), 700)) - 1); }
  /* Strom in Betriebsrichtung bei Spannung uop in Betriebsrichtung (Z-Diode: Betriebsrichtung = Sperrrichtung) */
  function iOp(p, uop) {
    if (!p.z) return uop > 0 ? iFwd(p, uop) : 0;
    if (uop > p.uz) return (uop - p.uz) / Math.max(p.rz, 1e-6);
    if (uop >= 0) return 0;
    return -iFwd(p, -uop);
  }
  const ZUSTAND_OK = { sperrt: 1, leitet: 1, durchbruch: 1, verpolt: 1 };
  const diode = {
    types: KEYS_D.map(function (k) { return { id: k, name: DT[k].name, art: DT[k].art, uf: LV(DT[k].id), n: nOf(DT[k]) }; }),
    curve: S(function (cfg, uList) {
      cfg = reqObj(cfg);
      const p = dprm(cfg);
      if (!isArr(uList) || uList.length > 20000) V('Die Spannungsliste fehlt oder ist zu lang.');
      const u = uList.filter(fin);
      if (!u.length) V('Die Spannungsliste enthält keine Zahl.');
      return { ok: true, u: u, i: u.map(function (x) { return z0(iOp(p, x)); }), zustand: p.art, art: p.art };
    }),
    operating: S(function (cfg) {
      cfg = reqObj(cfg);
      const p = dprm(cfg);
      const uq = reqFin(cfg.uq, 'Die Quellenspannung U_q', 1e4);
      const rv = reqRange(cfg.rv, R_KURZ, 1e13, 'Der Vorwiderstand R_V');
      let rl = Infinity;
      if (p.z && !none(cfg.rlast)) { const r = reqPos(cfg.rlast, 'Der Lastwiderstand R_L'); if (r < 1e11) rl = r; }
      const load = rl < Infinity;
      let ud, id, zustand;
      if (p.kon) {
        if (!p.z) {
          if (uq <= p.uf) { ud = uq; id = 0; zustand = uq < 0 ? 'verpolt' : 'sperrt'; }
          else { ud = p.uf; id = (uq - p.uf) / rv; zustand = 'leitet'; }
        } else if (uq <= -p.uf) { ud = -p.uf; id = (uq + p.uf) / rv; zustand = 'verpolt'; }
        else {
          const uoc = load ? uq * rl / (rv + rl) : uq;
          if (uoc <= p.uz) { ud = uoc; id = 0; zustand = uq < 0 ? 'verpolt' : 'sperrt'; }
          else { ud = p.uz; id = (uq - p.uz) / rv - (load ? p.uz / rl : 0); zustand = 'durchbruch'; }
        }
      } else {
        const g = function (x) { return x + rv * (iOp(p, x) + (load ? x / rl : 0)) - uq; };
        let lo = -(Math.abs(uq) + 1), hi = Math.abs(uq) + 1;
        for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (g(m) > 0) hi = m; else lo = m; }
        ud = (lo + hi) / 2; id = iOp(p, ud);
        if (p.z) zustand = ud > p.uz ? 'durchbruch' : (ud < 0 ? 'verpolt' : 'sperrt');
        else zustand = ud < 0 ? 'verpolt' : (id < 1e-6 ? 'sperrt' : 'leitet');
      }
      const ilast = load ? ud / rl : 0, iq = id + ilast;
      // dynamischer Widerstand und Schwellspannung
      let rd = NaN, us = NaN;
      if (p.kon) {
        rd = 0;
        us = p.z ? (zustand === 'verpolt' ? -p.uf : p.uz) : p.uf;
        if (!p.z && zustand !== 'leitet') us = p.uf;
      } else if (p.z && (zustand === 'durchbruch')) { rd = p.rz; us = ud - id * rd; }
      else if (p.z && zustand === 'sperrt') { us = p.uz; }
      else if (Math.abs(id) >= 1e-6 && (zustand === 'leitet' || (p.z && zustand === 'verpolt'))) { rd = p.n * p.ut / (Math.abs(id) + p.is); us = ud - id * rd; }
      const pd = ud * id;
      const ueberlast = p.art === 'led' ? id > LV('led_imax') : (p.z ? pd > LV('pz_max') : false);
      return { ok: true, valid: true, ud: z0(ud), id: z0(id), iz: p.z ? z0(id) : 0, ilast: z0(ilast), iq: z0(iq), ur: z0(rv * iq), pr: rv * iq * iq, pd: z0(pd), rd: rd, us: us, zustand: zustand,
        ueberlast: ueberlast, typ: p.typ, modell: p.kon ? 'konstant' : 'kennlinie', uf: p.uf, uz: p.uz };
    }),
    /* R_V = (U_q − U_F) / I; kein Vorwiderstand, wenn U_q nicht ueber U_F liegt (NaN) */
    rvFor: C(function (cfg) {
      cfg = reqObj(cfg);
      const uq = reqFin(cfg.uq, 'U_q'), uf = reqPos(cfg.uf, 'U_F', 1e3), i = reqPos(cfg.i, 'I', 1e4);
      if (!(uq > uf)) return NaN;
      return (uq - uf) / i;
    }),
    /* kleinster Vorwiderstand bei hoechster Eingangsspannung: (U_max − U_Z) / (P_Z / U_Z) */
    rvZMin: C(function (cfg) {
      cfg = reqObj(cfg);
      const um = reqFin(cfg.uqmax, 'U_max'), uz = reqPos(cfg.uz, 'U_Z', 1e3), pz = reqPos(cfg.pz, 'P_Z', 1e6);
      if (!(um > uz)) return NaN;
      return (um - uz) / (pz / uz);
    }),
    ledSwap: S(function (cfg) {
      cfg = reqObj(cfg);
      const uq = reqPos(cfg.uq, 'U_q', 1e4), uf1 = reqPos(cfg.uf1, 'U_F1', 100), i1 = reqPos(cfg.i1, 'I_1', 1e3), uf2 = reqPos(cfg.uf2, 'U_F2', 100);
      const modus = none(cfg.modus) ? 'gleicheLeistung' : cfg.modus;
      if (modus !== 'gleicheLeistung' && modus !== 'gleicherStrom') V('Der Modus muss „gleicheLeistung“ oder „gleicherStrom“ sein.');
      if (!(uq > uf2)) V('Die Quellenspannung muss über der Flussspannung der neuen LED liegen.');
      const i2 = modus === 'gleicherStrom' ? i1 : uf1 * i1 / uf2;
      return { ok: true, i2: i2, rv: (uq - uf2) / i2, p: uf2 * i2, modus: modus };
    })
  };
  api.diode = diode;

  /* =============================== 4.2 Transistor (Gleichstrom, Schalter, Stromquellen) =============================== */
  const DEFEKT = ['ce_schluss', 'ce_offen', 'be_offen'];
  function defektOf(v) {
    if (none(v) || v === '' || v === false) return '';
    if (typeof v !== 'string' || DEFEKT.indexOf(v) < 0) V('Der Defekt muss „ce_schluss“, „ce_offen“ oder „be_offen“ sein.');
    return v;
  }
  /* Basisnetz: Teiler oder Vorwiderstand -> { ubb, rb } */
  function baseNet(cfg, ub) {
    const basis = none(cfg.basis) ? 'teiler' : cfg.basis;
    if (basis === 'rb') {
      return { ubb: reqFin(cfg.ubase, 'Die Basisspannung', 1e4), rb: reqPos(cfg.rb, 'Der Basisvorwiderstand R_B') };
    }
    if (basis !== 'teiler') V('Die Basisbeschaltung muss „teiler“ oder „rb“ sein.');
    const r1 = reqPos(cfg.r1, 'R_1'), r2 = reqPos(cfg.r2, 'R_2');
    return { ubb: ub * r2 / (r1 + r2), rb: par(r1, r2) };
  }
  /* Arbeitspunkt (SPEC 4.2): sperrt, aktiv, Saettigung mit zwei Gleichungen, Defekte */
  function dcCalc(cfg) {
    cfg = reqObj(cfg);
    const ub = reqPos(cfg.ub, 'Die Betriebsspannung U_B', 1e4), rc = optNn(cfg.rc, 0, 'R_C'), re = optNn(cfg.re, 0, 'R_E');
    const b = optPos(cfg.b, LV('b_std'), 'Die Gleichstromverstärkung B', 1e5), ube = optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE');
    const ucesat = optRange(cfg.ucesat, LV('ucesat'), 0, 100, 'U_CE,sat');
    const defekt = defektOf(cfg.defekt);
    if (defekt) {
      let net = { ubb: NaN, rb: NaN };
      try { net = baseNet(cfg, ub); } catch (e) { /* Basisnetz ist bei Defekt nicht noetig */ }
      if (defekt === 'ce_schluss') {
        if (!(rc + re > 0)) V('Bei Kollektor-Emitter-Schluss muss R_C + R_E größer als 0 sein.');
        const ic = ub / (rc + re);
        return { ok: true, valid: true, zustand: 'defekt', defekt: defekt, ubb: net.ubb, rbth: net.rb, ib: NaN, ic: ic, ie: ic, ube: 0, uce: 0, ue: ic * re, urc: ic * rc, ibmin: NaN, ueb: NaN, pv: 0, prc: ic * ic * rc };
      }
      if (defekt === 'ce_offen') {
        /* C-E offen: Die B-E-Diode bleibt intakt, der Basisstrom fliesst weiter (I_E = I_B, nur durch R_E); I_C = 0, am Kollektor liegt die Versorgung.
         * Ohne Basisnetz im Aufruf sind I_B und U_BE nicht bestimmt (NaN). */
        const ibc = net.ubb > ube ? (net.ubb - ube) / (net.rb + re) : (isFinite(net.ubb) ? 0 : NaN);
        const ubeC = isFinite(net.ubb) ? (net.ubb > ube ? ube : Math.max(net.ubb, 0)) : NaN, ueC = ibc * re;
        return { ok: true, valid: true, zustand: 'defekt', defekt: defekt, ubb: net.ubb, rbth: net.rb, ib: ibc, ic: 0, ie: ibc, ube: ubeC, uce: ub - ueC, ue: ueC, urc: 0, ibmin: 0, ueb: 0, pv: ubeC * ibc, prc: 0 };
      }
      /* be_offen: I_B = 0 ist richtig, es fliesst kein Strom */
      return { ok: true, valid: true, zustand: 'defekt', defekt: defekt, ubb: net.ubb, rbth: net.rb, ib: 0, ic: 0, ie: 0, ube: 0, uce: ub, ue: 0, urc: 0, ibmin: 0, ueb: 0, pv: 0, prc: 0 };
    }
    const net = baseNet(cfg, ub), ubb = net.ubb, rb = net.rb;
    let ib, ic, zustand;
    if (ubb <= ube) { ib = 0; ic = 0; zustand = 'sperrt'; }
    else {
      ib = (ubb - ube) / (rb + (b + 1) * re); ic = b * ib; zustand = 'aktiv';
      if (ub - ic * rc - (ic + ib) * re < ucesat) {
        // Saettigung: zwei lineare Gleichungen fuer I_B und I_C bei U_CE = U_CE,sat
        const a1 = ubb - ube, a2 = ub - ucesat, det = (rb + re) * (rc + re) - re * re;
        ib = (a1 * (rc + re) - re * a2) / det; ic = ((rb + re) * a2 - re * a1) / det; zustand = 'saettigung';
        if (!(ic > 0) || !(ib > 0)) { ib = 0; ic = 0; zustand = 'sperrt'; }
      }
    }
    const ie = ic + ib, uce = zustand === 'saettigung' ? ucesat : ub - ic * rc - ie * re;
    /* I_B,min wie in tr.switch: Basisstrom, der den Transistor gerade saettigt, I_B,min = (U_B - U_CE,sat) / ((R_C + R_E) · B); ü = I_B / I_B,min (im aktiven Bereich < 1) */
    const ibm = zustand === 'aktiv' ? (rc + re > 0 ? (ub - ucesat) / ((rc + re) * b) : ib) : ic / b, ueb = ibm > 0 ? ib / ibm : 0;
    const ubeAus = zustand === 'sperrt' ? Math.min(ubb, ube) : ube;
    return { ok: true, valid: true, zustand: zustand, ubb: ubb, rbth: rb, ib: ib, ic: ic, ie: ie, ube: ubeAus, uce: uce, ue: ie * re, urc: ic * rc, ibmin: ibm, ueb: ueb,
      pv: uce * ic + ubeAus * ib, prc: ic * ic * rc };
  }
  function optRange(v, d, lo, hi, name) { return none(v) ? d : reqRange(v, lo, hi, name); }
  const trDc = S(dcCalc);
  const tr = {
    dc: trDc,
    /* Basisvorwiderstand: I_B = ü·I_C/B, R_B = (U_St − U_BE)/I_B */
    rbFor: S(function (cfg) {
      cfg = reqObj(cfg);
      const ube = optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE'), ueb = optPos(cfg.ueb, 1, 'Der Übersteuerungsfaktor ü', 1e3);
      const ust = reqFin(cfg.ust, 'Die Steuerspannung U_St', 1e4), ic = reqPos(cfg.ic, 'Der Kollektorstrom I_C', 1e4), b = reqPos(cfg.b, 'Die Gleichstromverstärkung B', 1e5);
      if (!(ust > ube)) V('Die Steuerspannung U_St muss über U_BE liegen, sonst fließt kein Basisstrom.');
      const ib = ueb * ic / b;
      return { ok: true, ib: ib, rb: (ust - ube) / ib };
    }),
    switch: S(function (cfg) {
      cfg = reqObj(cfg);
      const last = none(cfg.last) ? 'led' : cfg.last;
      if (last !== 'led' && last !== 'relais' && last !== 'ohm') V('Die Last muss „led“, „relais“ oder „ohm“ sein.');
      const ub = reqPos(cfg.ub, 'Die Betriebsspannung U_B', 1e4), ust = reqFin(cfg.ust, 'Die Steuerspannung U_St', 1e4), rb = reqPos(cfg.rb, 'Der Basisvorwiderstand R_B');
      const b = optPos(cfg.b, LV('b_std'), 'Die Gleichstromverstärkung B', 1e5), ube = optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE'), ucesat = optRange(cfg.ucesat, LV('ucesat'), 0, 100, 'U_CE,sat');
      const rl = last === 'led' ? reqPos(cfg.rv, 'Der Vorwiderstand R_V') : last === 'relais' ? reqPos(cfg.rspule, 'Der Spulenwiderstand') : reqPos(cfg.rlast, 'Der Lastwiderstand');
      const uf = last === 'led' ? (none(cfg.uf) ? LV('uf_led_rot') : reqPos(cfg.uf, 'U_F', 100)) : 0;
      const ib = ust > ube ? (ust - ube) / rb : 0, ubeAus = ust > ube ? ube : Math.max(ust, 0);
      if (!(ub - ucesat - uf > 0)) {
        return { ok: true, valid: false, why: 'Die Betriebsspannung reicht nicht für U_CE,sat' + (uf > 0 ? ' und U_F' : '') + ': Die Last bekommt keinen Strom.', zustand: 'sperrt', icSat: 0, ic: 0, ib: ib, ibmin: 0, ueb: NaN, uce: ub, ube: ubeAus,
          plast: 0, pv: ubeAus * ib, rbMax: NaN, rbSoll: NaN };
      }
      const icSat = (ub - ucesat - uf) / rl, ibm = icSat / b;
      let zustand, ic;
      if (ib <= 0) { zustand = 'sperrt'; ic = 0; }
      else if (ib >= ibm) { zustand = 'saettigung'; ic = icSat; }
      else { zustand = 'aktiv'; ic = b * ib; }
      const uce = zustand === 'saettigung' ? ucesat : (zustand === 'sperrt' ? ub : ub - uf - ic * rl);
      return { ok: true, valid: true, zustand: zustand, icSat: icSat, ic: ic, ib: ib, ibmin: ibm, ueb: ib / ibm, uce: uce, ube: ubeAus, plast: ic * ic * rl + uf * ic, pv: uce * ic + ubeAus * ib,
        rbMax: ust > ube ? (ust - ube) / ibm : NaN, rbSoll: ust > ube ? (ust - ube) / (LV('ue_typ') * ibm) : NaN };
    }),
    /* Relais: Einschalten I(t) = I0·(1 − e^(−t/τ)), Ausschalten mit/ohne Freilaufdiode (Lehrmodell, nur Simulation) */
    relais: S(function (cfg) {
      cfg = reqObj(cfg);
      const ub = reqPos(cfg.ub, 'Die Betriebsspannung U_B', 1e4), r = reqPos(cfg.rspule, 'Der Spulenwiderstand'), l = reqPos(cfg.lspule, 'Die Spuleninduktivität', 1e6);
      const ufd = optPos(cfg.ufd, LV('ufd_freilauf'), 'Die Flussspannung der Freilaufdiode', 100), uceo = optPos(cfg.uceo, LV('uceo'), 'U_CEO', 1e4);
      const fl = cfg.freilauf !== false, i0 = ub / r, tau = l / r;
      const ucePeak = fl ? ub + ufd : uceo;
      return { ok: true, i0: i0, tau: tau, tAn90: tau * Math.log(10), pSpule: ub * ub / r, ucePeak: ucePeak, tAus: fl ? tau * Math.log(1 + i0 * r / ufd) : 0, ueberUceo: fl ? ucePeak > uceo : true };
    }),
    /* Konstantstromquelle: R_E = (n_D·U_D − U_BE)/I_C */
    cs: S(function (cfg) {
      cfg = reqObj(cfg);
      const nd = num(cfg.nd, NaN);
      if (!(nd >= 1 && nd <= 20) || Math.floor(nd) !== nd) V('Die Zahl der Dioden n_D muss eine ganze Zahl von 1 bis 20 sein.');
      const ud = reqPos(cfg.ud, 'U_D', 100), ic = reqPos(cfg.ic, 'Der Kollektorstrom I_C', 1e4), ube = optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE');
      const ure = nd * ud - ube;
      if (!(ure > 0)) V('Die Dioden liefern nicht mehr als U_BE: Es entsteht keine Emitterspannung.');
      return { ok: true, ure: ure, re: ure / ic, ic: ic };
    }),
    /* Z-Diode am Folger: R_1 = (U_B − U_Z)/(I_Z + I_C/B), U_E = U_Z − U_BE */
    zfolger: S(function (cfg) {
      cfg = reqObj(cfg);
      const ub = reqPos(cfg.ub, 'U_B', 1e4), uz = reqPos(cfg.uz, 'U_Z', 1e3), ic = reqPos(cfg.ic, 'I_C', 1e4), b = reqPos(cfg.b, 'B', 1e5), iz = reqPos(cfg.iz, 'I_Z', 1e4);
      const ube = optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE');
      if (!(ub > uz)) V('Die Betriebsspannung muss über der Z-Spannung liegen.');
      const ib = ic / b;
      return { ok: true, ib: ib, ir1: iz + ib, r1: (ub - uz) / (iz + ib), ue: uz - ube, ic: ic };
    }),
    /* Ausgangskennlinienfeld: I_C = B·I_B·min(1, U_CE/U_CE,sat) (Lehrmodell, kein Early-Effekt) */
    family: S(function (cfg, ibList, uceList) {
      cfg = reqObj(cfg);
      if (!isArr(ibList) || !isArr(uceList) || ibList.length > 200 || uceList.length > 5000) V('Die Listen für I_B und U_CE fehlen oder sind zu lang.');
      const b = optPos(cfg.b, LV('b_std'), 'B', 1e5), us = optRange(cfg.ucesat, LV('ucesat'), 1e-6, 100, 'U_CE,sat');
      const uce = uceList.filter(fin), ibs = ibList.filter(fin);
      if (!uce.length || !ibs.length) V('Die Listen enthalten keine Zahlen.');
      return { ok: true, uce: uce, series: ibs.map(function (ib) { return { ib: ib, ic: uce.map(function (u) { return b * ib * Math.min(1, Math.max(0, u) / us); }) }; }) };
    })
  };
  api.tr = tr;

  /* =============================== 4.3 Emitterschaltung =============================== */
  const NANKEYS_AC = ['gm', 'rbe', 're', 'reac', 'rinT', 'rin', 'rout', 'rcl', 'vuLeer', 'vu', 'vus', 'vuDb', 'phase', 'f1', 'f2', 'fu', 'uaMaxOben', 'uaMaxUnten', 'uaMax', 'ueMax'];
  function emCfg(cfg) {
    cfg = reqObj(cfg);
    const E = {
      ub: reqPos(cfg.ub, 'Die Betriebsspannung U_B', 1e4), r1: reqPos(cfg.r1, 'R_1'), r2: reqPos(cfg.r2, 'R_2'), rc: reqPos(cfg.rc, 'Der Kollektorwiderstand R_C'),
      re1: optNn(cfg.re1, 0, 'R_E1'), re2: optNn(cfg.re2, 0, 'R_E2'), b: optPos(cfg.b, LV('b_std'), 'Die Gleichstromverstärkung B', 1e5),
      ut: optPos(cfg.ut, LV('ut'), 'Die Temperaturspannung U_T', 1), rg: optNn(cfg.rg, 0, 'Der Quellenwiderstand R_G'), rl: none(cfg.rl) ? R_OFFEN : reqPos(cfg.rl, 'Der Lastwiderstand R_L'),
      ce: cfg.ce !== false, ube: optRange(cfg.ube, LV('ube'), 0.01, 5, 'U_BE'), ucesat: optRange(cfg.ucesat, LV('ucesat'), 0, 100, 'U_CE,sat'),
      c1: optNn(cfg.c1, 0, 'C_1', 1), c2: optNn(cfg.c2, 0, 'C_2', 1), defekt: defektOf(cfg.defekt)
    };
    E.rb = par(E.r1, E.r2);
    E.dc = dcCalc({ ub: E.ub, r1: E.r1, r2: E.r2, rc: E.rc, re: E.re1 + E.re2, b: E.b, ube: E.ube, ucesat: E.ucesat, defekt: E.defekt });
    return E;
  }
  function hpFu(f1, f2) { const a = f1 * f1, b = f2 * f2; return Math.sqrt(((a + b) + Math.sqrt((a + b) * (a + b) + 4 * a * b)) / 2); }
  function zText(z) { return z === 'sperrt' ? 'im Sperrbereich' : (z === 'saettigung' ? 'in der Sättigung' : 'defekt'); }
  /* Kleinsignalrechnung (Hybrid-pi, ohne Early-Effekt und ohne Kapazitaeten) */
  function acCalc(E) {
    const d = E.dc;
    if (d.zustand !== 'aktiv') {
      return invalid('Der Transistor ist ' + zText(d.zustand) + ' (U_CE = ' + fmtEng(d.uce, 'V') + ', I_C = ' + fmtEng(d.ic, 'A') + '): Die Kleinsignalverstärkung gilt nur im aktiven Bereich.', NANKEYS_AC,
        { zustand: d.zustand, ic: d.ic, ib: d.ib, ie: d.ie, uce: d.uce, ue: d.ue, ubb: d.ubb });
    }
    const reac = E.ce ? E.re1 : E.re1 + E.re2, gm = d.ic / E.ut, rbe = E.b / gm, rinT = rbe + (E.b + 1) * reac, rcl = par(E.rc, E.rl);
    const vuLeer = -E.b * E.rc / rinT, vu = -E.b * rcl / rinT, rin = par(E.rb, rinT), vus = vu * rin / (rin + E.rg);
    const f1 = E.c1 > 0 ? 1 / (TWO_PI * (E.rg + rin) * E.c1) : 0, f2 = E.c2 > 0 && E.rl < 1e11 ? 1 / (TWO_PI * (E.rc + E.rl) * E.c2) : 0;
    const fu = f1 > 0 && f2 > 0 ? hpFu(f1, f2) : Math.max(f1, f2);
    const dIcSat = (d.uce - E.ucesat) / (rcl + reac * (E.b + 1) / E.b);
    const oben = d.ic * rcl, unten = dIcSat * rcl, uaMax = Math.min(oben, unten);
    return { ok: true, valid: true, zustand: 'aktiv', ic: d.ic, ib: d.ib, ie: d.ie, uce: d.uce, ue: d.ue, ubb: d.ubb, gm: gm, rbe: rbe, re: E.ut / d.ie, reac: reac, rinT: rinT, rin: rin, rout: E.rc, rcl: rcl,
      vuLeer: vuLeer, vu: vu, vus: vus, vuDb: 20 * Math.log10(Math.abs(vu)), phase: LV('emitter_phase') * (vu < 0 ? 1 : 0), f1: f1, f2: f2, fu: fu,
      uaMaxOben: oben, uaMaxUnten: unten, uaMax: uaMax, ueMax: uaMax / Math.abs(vu) };
  }
  const emit = {
    ac: S(function (cfg) { return acCalc(emCfg(cfg)); }),
    /* Grosssignal: quasistatisch mit Exponentialkennlinie, Signal ueber genau eine Periode, THD aus den Oberwellen 2 bis 10 */
    large: S(function (cfg, n) {
      const E = emCfg(cfg), a = acCalc(E);
      n = none(n) ? 128 : Math.floor(num(n, NaN));
      if (!(n >= 16 && n <= 4096)) V('Die Punktzahl n muss zwischen 16 und 4096 liegen.');
      const ue = reqPos(cfg.ue, 'Die Amplitude u_e', 1e3), f = reqPos(cfg.f, 'Die Frequenz f', 1e9);
      if (a.valid === false) return a;
      const is = a.ic / (Math.exp(E.ube / E.ut) - 1), us = ue * E.rb / (E.rb + E.rg), rth = par(E.rb, E.rg), k = rth / E.b + a.reac * (1 + 1 / E.b);
      const icMax = a.ic + (a.uce - E.ucesat) / (a.rcl + a.reac * (E.b + 1) / E.b);
      const t = [], uin = [], uout = [], ic = [];
      let clipO = false, clipU = false;
      for (let i = 0; i < n; i++) {
        const s = Math.sin(TWO_PI * i / n), usn = us * s;
        let lo = 1e-18, hi = 10;
        for (let j = 0; j < 90; j++) {
          const m = Math.sqrt(lo * hi), fm = E.ut * Math.log(m / is + 1) - E.ube - usn + (m - a.ic) * k;
          if (fm > 0) hi = m; else lo = m;
        }
        let c = Math.sqrt(lo * hi);
        if (c > icMax) { c = icMax; clipU = true; }
        if (c <= 0.01 * a.ic) clipO = true;
        t.push(i / n / f); uin.push(ue * s); ic.push(c); uout.push(-(c - a.ic) * a.rcl);
      }
      const harm = [];
      for (let m = 1; m <= 10; m++) {
        let re = 0, im = 0;
        for (let i = 0; i < n; i++) { const ph = TWO_PI * m * i / n; re += uout[i] * Math.cos(ph); im += uout[i] * Math.sin(ph); }
        harm.push(Math.hypot(re, im) * 2 / n);
      }
      const thd = Math.sqrt(harm.slice(1).reduce(function (s, x) { return s + x * x; }, 0)) / harm[0];
      let uaPeak = 0; for (let i = 0; i < n; i++) uaPeak = Math.max(uaPeak, Math.abs(uout[i]));
      return { ok: true, valid: true, t: t, uin: uin, uout: uout, ic: ic, harm: harm, thd: thd, thdProzent: thd * 100, clip: clipO && clipU ? 'beide' : clipU ? 'unten' : clipO ? 'oben' : null, uaPeak: uaPeak, vuMess: uaPeak / ue };
    }),
    /* Arbeitsgerade (Gleichstrom) und Wechselstrom-Arbeitsgerade durch den Arbeitspunkt, Punkte [U_CE, I_C] */
    line: S(function (cfg) {
      const E = emCfg(cfg), a = acCalc(E), rdc = E.rc + E.re1 + E.re2;
      let ac = null, rac = NaN;
      if (a.valid !== false) { rac = a.rcl + a.reac; ac = [[0, a.ic + a.uce / rac], [a.uce + a.ic * rac, 0]]; }
      return { ok: true, valid: a.valid !== false, dc: [[0, E.ub / rdc], [E.ub, 0]], ap: [E.dc.uce, E.dc.ic], ac: ac, rdc: rdc, rac: rac, zustand: E.dc.zustand };
    })
  };
  api.emit = emit;

  /* =============================== 4.4 Grundschaltungen im Vergleich =============================== */
  const grund = {
    compare: S(function (cfg) {
      const E = emCfg(cfg), d = E.dc;
      const nanSet = { vu: NaN, vus: NaN, rin: NaN, rout: NaN, phase: NaN, art: '' };
      if (d.zustand !== 'aktiv') {
        return invalid('Der Transistor ist ' + zText(d.zustand) + ' (U_CE = ' + fmtEng(d.uce, 'V') + '): Ein Vergleich der Grundschaltungen gilt nur im aktiven Bereich.', ['ie', 're', 'direkt'],
          { zustand: d.zustand, ic: d.ic, emitter: Object.assign({}, nanSet), kollektor: Object.assign({}, nanSet), basis: Object.assign({}, nanSet) });
      }
      const a = acCalc(E), gm = d.ic / E.ut, rbe = E.b / gm, ret = E.ut / d.ie, ree = E.re1 + E.re2, rcl = a.rcl;
      const reE = par(ree, E.rl), kT = rbe + (E.b + 1) * reE, kVu = (E.b + 1) * reE / kT, kRin = par(E.rb, kT), kRout = par(ree, (rbe + par(E.rg, E.rb)) / (E.b + 1));
      const alpha = E.b / (E.b + 1), bVu = alpha * rcl / ret, bRin = par(ree, ret);
      const us = function (vu, ri) { return vu * ri / (ri + E.rg); };
      return { ok: true, valid: true, zustand: 'aktiv', ic: d.ic, ie: d.ie, re: ret, direkt: E.rl < 1e11 ? E.rl / (E.rg + E.rl) : 1,
        emitter: { vu: a.vu, vus: a.vus, rin: a.rin, rout: E.rc, phase: 180, art: 'Spannungs- und Stromverstärkung' },
        kollektor: { vu: kVu, vus: us(kVu, kRin), rin: kRin, rout: kRout, phase: 0, art: 'Impedanzwandler (Emitterfolger)' },
        basis: { vu: bVu, vus: us(bVu, bRin), rin: bRin, rout: E.rc, phase: 0, art: 'Spannungsverstärkung, niedriger Eingangswiderstand' } };
    })
  };
  api.grund = grund;

  /* ---------- Hilfen fuer Tests und Teil 2/3 (anacore-op.js, anacore-res.js) ---------- */
  api.util = {
    num: num, clamp: clamp, fin: fin, isArr: isArr, isObj: isObj, has: has, none: none, fail: fail, invalid: invalid, V: V, reqObj: reqObj, reqPos: reqPos, reqNn: reqNn, reqFin: reqFin,
    reqRange: reqRange, optPos: optPos, optNn: optNn, optFin: optFin, optRange: optRange, C: C, S: S, A: A, L: L, LV: LV, hide: hide, statusTag: statusTag, checkOut: checkOut,
    par: par, z0: z0, fmtEngRaw: fmtEngRaw, TWO_PI: TWO_PI, RAD: RAD, DEG: DEG, R_OFFEN: R_OFFEN, R_KURZ: R_KURZ, limitValueText: limitValueText
  };
  hide(api, 'util', api.util);
  api.extend = function (name, o) { try { api[name] = o; return true; } catch (e) { return false; } };
  hide(api, 'extend', api.extend);
  api.guardAll = true;
  root.ANA_CORE = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
