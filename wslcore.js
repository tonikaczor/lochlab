/* wslcore.js - WSL-Lab Kern Teil 1 (WSL_CORE, Version 1.0)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.WSL_CORE, Node: module.exports / globalThis.WSL_CORE.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval. Alle Bauteil- und Anlagenwerte sind Uebungswerte, Bauteile ideal.
 * Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. Norm und Vorschrift massgeblich.
 * Teil 2 (res, filter, trafo, three, report, assess, diagnose, formulas, exercise, runSeq) steht in wslcore-res.js
 * und haengt sich mit WSL_CORE.extend(name, obj) bzw. direkt an dasselbe Objekt (Hilfen: WSL_CORE.util).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten: Spannung V (Effektivwert, ausser sample/values: Scheitelwert ampl), Strom A, Widerstand Ohm, L in H, C in F,
 *    f in Hz, Phasenwinkel phi in GRAD (Anzeige), intern Bogenmass; Leistung P in W, Q in var, S in VA.
 *  - Konvention (F2): phi = phi_u - phi_i. Reihe: Bezug ist der Strom, Parallel: Bezug ist die Spannung. induktiv phi > 0
 *    (die Spannung eilt dem Strom vor), kapazitiv phi < 0. Q induktiv positiv, kapazitiv negativ.
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt und werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen
 *    { ok:false, why:'deutscher Text' }, Ergebnisse ausserhalb des Zahlenbereichs ebenso. Formeln ausserhalb des
 *    Gueltigkeitsbereichs melden { ok:true, valid:false, why } (Zahlenfelder NaN) und rechnen nie still weiter.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32).
 *  - Feste Zahlen stehen NUR in WSL_CORE.limits (status 'belegt' | 'A'); Texte nennen sie ueber limitText(id).
 *
 * SIGNATUREN (SPEC 4 ist massgeblich; hier die Festlegungen, die dort offen waren)
 *  Basis:  guard(fn,fb) cx{add,sub,mul,div,abs,arg,fromPolar,conj,make} rng(seed)->()=>[0,1) (+ .next, .normal) fmt(x,d) fmtEng(x,unit)
 *          parseNum(str) parseQty(str) limits[] limit(id) limitText(id) limitOK(id,x) glossary[] (+ .get(term)) TEXTS{...,get(id,vars)}
 *  sine:   make(cfg)->{ok,form,ampl,f,phi,offset,T,omega} ; values(cfg)->{ok,T,omega,rms,peak,pp,mean,rect,formFactor,crest,max,min}
 *          sample(cfg,n)->{ok,n,T,t[],y[]} ; at(cfg,t_s)->u ; shift(cfg)->{ok,phi,phiRaw,dtMs,dtS,dir,text} ; sum(a,b)->{ok,ampl,phi,f,rms}
 *          cfg { form:'sinus'|'rechteck'|'dreieck', ampl (Scheitelwert V), f Hz, phi Grad, offset V }
 *  rlc:    reactance({f,l,c})->{ok,valid,xl,xc,x,omega} ; series({u,f,r,l,c,aufbau})->{ok,valid,z,phi,i,ur,ul,uc,ux,triangle,art,...}
 *          parallel(...)->{ok,valid,y,phi,i,ir,il,ic,ix,...} ; phasors({..., art:'reihe'|'parallel'})->{ok,bezug,list:[{name,len,angle}]}
 *          coil({u,i,p,f})->{ok,z,r,xl,l}   aufbau 'R'|'L'|'C'|'RL'|'RC'|'RLC' (ohne Angabe aus den gegebenen Werten > 0)
 *  power:  fromUIphi(U,I,phi) fromMeasure(U,I,P) fromPcos(P,cosphi,U[,art]) triangle(res) line({p,cosphi,u,rl[,cos2]})
 *  comp:   need({p,cos1,cos2,u,f,form}) after({p,cos1,u,f,c}) cMax({p,cos1,u,f}) -> F ; state({..., cos2}) -> {ok,state:'unter'|'ziel'|'ueber',...}
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const TWO_PI = 2 * Math.PI, RAD = Math.PI / 180, DEG = 180 / Math.PI, SQ2 = Math.SQRT2;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.trim().replace(',', '.')); return isFinite(x) ? x : d; }
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function obj(o) { return isObj(o) ? o : {}; }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  /* Validierungsfehler mit deutschem Text (S() macht daraus { ok:false, why }, C() macht daraus NaN) */
  function V(why) { const e = new Error(why); e.wslWhy = why; throw e; }
  function reqObj(o) { if (!isObj(o)) V('Es fehlen gültige Eingabewerte.'); return o; }
  function reqPos(v, name, max) {
    const x = num(v, NaN);
    if (!(x > 0)) V(name + ' muss eine Zahl größer als 0 sein.');
    if (x > (max || 1e9)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqNn(v, name, max) {
    const x = num(v, NaN);
    if (!(x >= 0)) V(name + ' muss eine Zahl sein und darf nicht negativ sein.');
    if (x > (max || 1e9)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqFin(v, name, max) {
    const x = num(v, NaN);
    if (!isFinite(x)) V(name + ' muss eine Zahl sein.');
    if (Math.abs(x) > (max || 1e9)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function optPos(v, d, name, max) { return v === undefined || v === null ? d : reqPos(v, name, max); }
  function optNn(v, d, name, max) { return v === undefined || v === null ? d : reqNn(v, name, max); }
  function optFin(v, d, name, max) { return v === undefined || v === null ? d : reqFin(v, name, max); }
  function finiteDeep(o, depth) {
    if (typeof o === 'number') return isFinite(o);
    if (depth > 2 || o === null || typeof o !== 'object') return true;
    const ks = Object.keys(o);
    for (let i = 0; i < ks.length; i++) if (!finiteDeep(o[ks[i]], depth + 1)) return false;
    return true;
  }
  function checkOut(r) {
    if (isObj(r) && r.ok === true && r.valid !== false && !finiteDeep(r, 0)) return fail('Das Ergebnis liegt außerhalb des darstellbaren Zahlenbereichs.');
    return r;
  }
  /* C: Rechenfunktion -> NaN. S: Strukturfunktion -> { ok:false, why }. A: Liste -> []. */
  function C(fn) { return function () { try { const r = fn.apply(this, arguments); return typeof r === 'number' && !isFinite(r) ? NaN : r; } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return checkOut(fn.apply(this, arguments)); } catch (e) { return fail(e && e.wslWhy ? e.wslWhy : 'Mit diesen Eingaben gibt es kein Ergebnis.'); } }; }
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
  api.version = '1.0';
  api.guard = guard;
  /* Gueltiges Ergebnis, aber Formel ausserhalb ihres Bereichs: Zahlen NaN, Text sagt warum (Regel 3) */
  function invalid(why, nanKeys, extra) {
    const o = { ok: true, valid: false, why: why };
    (nanKeys || []).forEach(function (k) { o[k] = NaN; });
    if (extra) for (const k in extra) o[k] = extra[k];
    return o;
  }
  function normDeg(p) { let x = p % 360; if (x > 180) x -= 360; if (x <= -180) x += 360; return x; }

  /* ---------- Zahlen: Ausgabe und Eingabe ---------- */
  function fmt(x, digits) {
    x = num(x, NaN);
    if (!isFinite(x)) return '–';
    let s;
    const dg = digits === undefined || digits === null ? NaN : Number(digits);
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
  const PREF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function fmtEng(x, unit) {
    x = num(x, NaN);
    const u = typeof unit === 'string' ? unit : '';
    if (!isFinite(x)) return '–';
    if (x === 0) return '0' + (u ? ' ' + u : '');
    const a = Math.abs(x);
    let p = PREF[PREF.length - 1];
    for (let i = 0; i < PREF.length; i++) { if (a >= PREF[i][0] * 0.99995) { p = PREF[i]; break; } }
    function cut(v) { return Math.abs(v) >= 99.95 ? String(Math.round(v)) : (Math.abs(v) >= 9.995 ? v.toFixed(1) : v.toFixed(2)); }
    let v = x / p[0], s = cut(v);
    if (Math.abs(Number(s)) >= 1000 && p[0] < 1e12) {
      const k = PREF.findIndex(function (q) { return q === p; });
      if (k > 0) { p = PREF[k - 1]; v = x / p[0]; s = cut(v); }
    }
    return s.replace('.', ',') + ' ' + p[1] + u;
  }
  function numBody(str) {
    const s = str.replace(/−/g, '-').replace(/[   ]/g, ' ').trim();
    const m = s.match(/^[+-]?\s?(?:[0-9][0-9 .,]*|[.,][0-9]+)/);
    if (!m) return null;
    let body = m[0].replace(/\s+$/, '').replace(/[.,]+$/, '');
    let rest = s.slice(m[0].length);
    if (m[0].length > body.length && /\s$/.test(m[0])) rest = ' ' + rest;
    if (!body) return null;
    let sgn = 1;
    if (body[0] === '-' || body[0] === '+') { if (body[0] === '-') sgn = -1; body = body.slice(1).trim(); }
    if (/ /.test(body)) {
      if (!/^\d{1,3}( \d{3})+([.,]\d+)?$/.test(body)) return null;
      body = body.replace(/ /g, '');
    }
    const nC = (body.match(/,/g) || []).length, nP = (body.match(/\./g) || []).length;
    if (nC && nP) {
      const dec = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
      const th = dec === ',' ? '.' : ',';
      const parts = body.split(dec);
      if (parts.length !== 2) return null;
      if (parts[0].indexOf(th) >= 0 && !new RegExp('^\\d{1,3}(?:\\' + th + '\\d{3})+$').test(parts[0])) return null;
      body = parts[0].split(th).join('') + '.' + parts[1];
    } else if (nC > 1 || nP > 1) {
      const sep = nC > 1 ? ',' : '.';
      if (!new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$').test(body)) return null;
      body = body.split(sep).join('');
    } else if (nC === 1) body = body.replace(',', '.');
    if (!/^\d*\.?\d+$|^\d+\.?$/.test(body)) return null;
    let v = Number(body);
    const ex = rest.match(/^[eE]([+-]?\d+)/);
    if (ex) { v = v * Math.pow(10, Number(ex[1])); rest = rest.slice(ex[0].length); }
    else {
      const t = rest.match(/^\s*(?:·|\*|x|×)\s*10\s*(?:\^|\*\*)?\s*([+-]?\d+)/i);
      if (t) { v = v * Math.pow(10, Number(t[1])); rest = rest.slice(t[0].length); }
    }
    v = sgn * v;
    return isFinite(v) ? { v: v, rest: rest } : null;
  }
  const PFX = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, n: 1e-9, p: 1e-12 };
  const UNITS = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'var', 'VA', 's', 'S'];
  /* parseQty(str) -> { v (SI, Vorsatz angewendet), raw, factor, unit, hasUnit } oder null. "88,8 Ω", "2,4 kvar", "495 kHz", "10 µF", "10 uF" */
  function parseQty(str) {
    if (typeof str === 'number') return isFinite(str) ? { v: str, raw: str, factor: 1, unit: '', hasUnit: false } : null;
    if (typeof str !== 'string') return null;
    const b = numBody(str);
    if (!b) return null;
    const u = b.rest.trim();
    if (u === '') return { v: b.v, raw: b.v, factor: 1, unit: '', hasUnit: false };
    let f = 1;
    if (/^(dB|%|°)/.test(u)) f = 1;
    else if (UNITS.indexOf(u) >= 0) f = 1;
    else if (u.length >= 2 && PFX[u[0]] !== undefined && UNITS.indexOf(u.slice(1)) >= 0) f = PFX[u[0]];
    else if (u.length === 1 && PFX[u] !== undefined) f = PFX[u];
    else if (/^[A-Za-zµμΩ/·²³]+$/.test(u)) f = 1;
    else return null;
    return { v: b.v * f, raw: b.v, factor: f, unit: u, hasUnit: true };
  }
  function parseNum(str) { try { const q = parseQty(str); return q ? (isFinite(q.v) ? q.v : NaN) : NaN; } catch (e) { return NaN; } }
  api.fmtEng = function (x, u) { try { return fmtEng(x, u); } catch (e) { return '–'; } };
  api.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  api.fm = api.fmt;
  api.parseNum = parseNum;
  api.parseQty = function (s) { try { return parseQty(s); } catch (e) { return null; } };

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
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
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
    /* belegt (SPEC 12.1) */
    ['f_netz', 50, 'Hz', '=', 'belegt', 'pool:S2023-N05, W2024-10', null, 'Netzfrequenz', null],
    ['u_netz', 230, 'V', '=', 'belegt', 'pool:S2023-N05, W2024-10', null, 'Netzspannung (Effektivwert)', null],
    ['eff_sinus', 1 / SQ2, '', '=', 'belegt', 'pool:F2021-N05, F2020-N25', null, 'Effektivwert einer Sinusgröße: Scheitelwert geteilt durch √2', null],
    ['eff_rechteck', 1, '', '=', 'belegt', 'pool:F2021-N05', null, 'Effektivwert einer Rechteckgröße: gleich dem Scheitelwert', null],
    ['fg_betrag', 0.7071, '', '=', 'belegt', 'pool:W2024-20, S2023-N32', null, 'Übertragungsverhältnis des RC-Tiefpasses bei der Grenzfrequenz: 70,7 %', null],
    ['fg_db', -3, 'dB', '=', 'belegt', 'pool:W2024-20, S2023-N32', null, 'Dämpfungsmaß bei der Grenzfrequenz', null],
    ['fg_phase', 45, '°', '=', 'belegt', 'pool:W2024-20, S2023-N32', null, 'Betrag der Phasenverschiebung bei der Grenzfrequenz', null],
    ['fg_xc', 1, '· R', '=', 'belegt', 'pool:S2023-N32', null, 'Bei der Grenzfrequenz ist der Blindwiderstand des Kondensators gleich dem Wirkwiderstand', null],
    ['res_reihe', null, '', '=', 'belegt', 'pool:S2023-N03', null, 'Reihenschwingkreis bei Resonanz: Scheinwiderstand am kleinsten, Strom am größten', { z: 'min', i: 'max' }],
    ['res_parallel', null, '', '=', 'belegt', 'pool:W2023-14', null, 'Parallelschwingkreis bei Resonanz: Scheinwiderstand am größten, Strom aus der Quelle am kleinsten', { z: 'max', i: 'min' }],
    ['trafo_ueb', null, '', '=', 'belegt', 'pool:H2022-N07, F2021-N04', null, 'Idealer Transformator: U1 zu U2 wie N1 zu N2, I1 zu I2 wie N2 zu N1', { u: 'N1/N2', i: 'N2/N1' }],
    ['trafo_dc', null, '', '=', 'belegt', 'pool:F2023-N17', null, 'Gleichspannung am Transformator: kein induktiver Widerstand, der Strom wird nur vom Wicklungswiderstand begrenzt, die Wicklung ist gefährdet', null],
    /* Uebungswerte (A), Fragen in AUSBILDER.md */
    ['u_aussen', 400, 'V', '=', 'A', '—', 'F7', 'Außenleiterspannung im 230/400-V-Netz (Übungswert)', null],
    ['cos_ziel', 0.95, '', '>=', 'A', '—', 'F6', 'Ziel für cos φ nach der Kompensation (Übungswert)', null],
    ['cos_ziel2', 0.9, '', '>=', 'A', '—', 'F6', 'Zweites Ziel für cos φ nach der Kompensation (Übungswert)', null],
    ['amp_gruen', 2, '%', '<=', 'A', '—', 'F13', 'Ampel grün: Abweichung von der Vorgabe höchstens 2 % (Lehrfaustwert)', null],
    ['amp_gelb', 5, '%', '<=', 'A', '—', 'F13', 'Ampel gelb: Abweichung von der Vorgabe höchstens 5 % (Lehrfaustwert)', null],
    ['cos_fenster', 0.05, '', '<=', 'A', '—', 'F13', 'Ampel gelb bei cos φ: höchstens 0,05 unter der Vorgabe (Lehrfaustwert)', null],
    ['res_fenster', 2, '%', '<=', 'A', '—', 'F13', 'Resonanzfenster: Abweichung der Resonanzfrequenz höchstens 2 % (Lehrfaustwert)', null],
    ['fg_fenster', 5, '%', '<=', 'A', '—', 'F13', 'Grenzfrequenz-Fenster: Abweichung höchstens 5 % (Lehrfaustwert)', null],
    ['trafo_uk', 5, '%', '=', 'A', '—', 'F8', 'Kurzschlussspannung im Trafo-Lehrmodell (Übungswert)', null],
    ['trafo_pfe', 3, 'W', '=', 'A', '—', 'F8', 'Eisenverlust im Trafo-Lehrmodell (Übungswert)', null],
    ['tau_5', 5, '· τ', '=', 'A', '—', 'F9', 'Nach fünf Zeitkonstanten gilt der Ausgleichsvorgang als abgeschlossen (Lehrfaustwert)', null]
  ];
  const limits = LIM.map(function (r) {
    const o = { id: r[0], value: r[1], unit: r[2], cmp: r[3], status: r[4], quelle: r[5], frage: r[6], text: r[7] };
    if (r[8]) { hide(o, 'extra', Object.freeze(r[8])); }
    return Object.freeze(o);
  });
  Object.freeze(limits);
  api.limits = limits;
  function L(id) {
    for (let i = 0; i < limits.length; i++) if (limits[i].id === id) return limits[i];
    V('Unbekannter Grenzwert: ' + String(id));
  }
  api.limit = S(function (id) { return L(id); });
  /* Wert eines Grenzwerts als Zahl (NaN, wenn unbekannt oder ohne Zahl) */
  function LV(id) { const l = L(id); return l.value === null ? NaN : l.value; }
  const CMPS = { '<=': '≤ ', '>=': '≥ ', '=': '' };
  function statusTag(l) { return l.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)' + (l.frage ? ', ' + l.frage : ''); }
  api.limitText = guard(function (id) {
    const l = L(id);
    if (l.value === null) return l.text + ' (' + statusTag(l) + ')';
    return CMPS[l.cmp] + fmt(l.value) + (l.unit ? ' ' + l.unit : '') + ' (' + statusTag(l) + ')';
  }, '');
  api.limitOK = guard(function (id, x) {
    const l = L(id); x = num(x, NaN);
    if (!isFinite(x) || l.value === null) return null;
    const tol = 1e-12 * Math.max(1, Math.abs(l.value));
    if (l.cmp === '<=') return x <= l.value + tol;
    if (l.cmp === '>=') return x >= l.value - tol;
    return Math.abs(x - l.value) <= tol;
  }, null);
  const F_NETZ = LV('f_netz'), COS_ZIEL = LV('cos_ziel');

  /* =============================== Texte (einzige Quelle) =============================== */
  const TEXTS = {
    simOnly: 'Simulation – Versuche an Netzspannung nur durch Elektrofachkraft oder unter Aufsicht der Ausbilder.',
    ampelHinweis: 'Grün heißt: Vorgabe der Simulation erfüllt, nicht: gefahrlos aufbauen.',
    effHinweis: 'Der Effektivwert bewirkt in einem Widerstand die gleiche Wärme wie eine Gleichspannung gleicher Höhe.',
    ueberhoehung: 'Spannungsüberhöhung kann ein Bauteil zerstören: Die Spannungsfestigkeit der Bauteile ist ein Auslegungskriterium (Lehrbeispiel, nicht nachbauen).',
    protoHinweis: 'Übungsbericht, kein Nachweis.',
    uebung: 'Übungsschaltung: Alle Zahlen sind Übungswerte, bei idealen Bauteilen im Beharrungszustand.',
    uebungswert: 'Übungswert: Der Ausbilder gleicht ihn ab.',
    faustwert: 'Lehrfaustwert, kein Normwert.',
    norm: 'Norm und Vorschrift maßgeblich.',
    modell: 'Modell: ideale Bauteile, Beharrungszustand, Wechselspannung mit einer festen Frequenz.',
    konvention: 'Bezug ist bei der Reihenschaltung der Strom, bei der Parallelschaltung die Spannung. φ = φ_u − φ_i: induktiv ist φ positiv, kapazitiv negativ.',
    gleichstrom: 'Gleichstrom: Kondensator sperrt, Spule ist ein Draht.',
    blindNull: 'Wirkleistung null, cos φ nicht zur Berechnung geeignet.',
    blindLast: 'Reine Blindlast: Die Wirkleistung ist null, die Scheinleistung besteht nur aus Blindleistung.',
    pNegativ: 'Die Wirkleistung wäre negativ: Die Last würde Leistung abgeben. Dieses Lab rechnet nur Verbraucher.',
    keinStrom: 'Es fließt kein Strom (oder die Spannung ist null): Leistung und cos φ sind nicht definiert.',
    reiheIdeal: 'Ideal (R = 0) und genau in Resonanz: Der Strom wäre nur durch die Quelle begrenzt, das gibt es in der Wirklichkeit nie.',
    parallelIdeal: 'Ideal (ohne Verlustwiderstand) und genau in Resonanz: Der Strom aus der Quelle wäre null (Sperrkreis).',
    kompNurParallel: 'Gerechnet wird nur die Parallelkompensation; Reihen-, Gruppen- und Zentralkompensation sind hier nur Begriffe.',
    kompZielNiedrig: 'Das Ziel liegt unter dem vorhandenen cos φ: Es muss nichts kompensiert werden.',
    nurSinus: 'Zeiger gibt es nur für Sinusgrößen; bei Rechteck und Dreieck wirkt die Phase nur als Zeitversatz.',
    keineZahl: 'Das ist keine Zahl. Gib eine Zahl ein, auch mit Einheit (zum Beispiel 88,8 Ω oder 2,4 kvar).',
    eingabe: 'Mit diesen Werten gibt es kein Ergebnis.',
    ampel: { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' },
    ampelSym: { gruen: '✓', gelb: '!', rot: '✗', grau: '–' },
    diag: {},
    msg: {}
  };
  TEXTS.get = function (id, vars) {
    try {
      let t = TEXTS.diag[id];
      if (t === undefined) t = TEXTS.msg[id];
      if (t === undefined) t = TEXTS[id];
      if (typeof t !== 'string') return '';
      return t.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? String(vars[k]) : ''; });
    } catch (e) { return ''; }
  };
  hide(TEXTS, 'get', TEXTS.get);
  api.TEXTS = TEXTS;

  /* =============================== Glossar (einzige Quelle der Begriffe, Genus fest) =============================== */
  const GL = [
    ['Effektivwert', 'der', 'U, I', 'V, A', 'Gleichwert mit gleicher Wärmewirkung; bei einer Sinusgröße der Scheitelwert geteilt durch √2. Ein Großbuchstabe ohne Zusatz meint den Effektivwert.'],
    ['Scheitelwert', 'der', 'û, î', 'V, A', 'Größter Augenblickswert einer Wechselgröße.'],
    ['Mittelwert', 'der', '', 'V, A', 'Arithmetischer Mittelwert über eine volle Periode; er ist bei einer reinen Wechselgröße null.'],
    ['Gleichrichtwert', 'der', '', 'V, A', 'Mittelwert des Betrags einer Wechselgröße; bei einer Sinusgröße 2 · û / π.'],
    ['Formfaktor', 'der', '', '', 'Verhältnis von Effektivwert zu Gleichrichtwert; bei einer Sinusgröße rund 1,11.'],
    ['Scheitelfaktor', 'der', '', '', 'Verhältnis von Scheitelwert zu Effektivwert; bei einer Sinusgröße √2.'],
    ['Periodendauer', 'die', 'T', 's', 'Zeit für eine volle Schwingung; T = 1 / f.'],
    ['Frequenz', 'die', 'f', 'Hz', 'Anzahl der Perioden je Sekunde.'],
    ['Kreisfrequenz', 'die', 'ω', '1/s', 'ω = 2π · f.'],
    ['Phasenverschiebung', 'die', 'φ', '°', 'Zeitliche Verschiebung zweier gleichfrequenter Wechselgrößen. Der Zahlenwert heißt Phasenwinkel.'],
    ['Phasenwinkel', 'der', 'φ', '°', 'Zahlenwert der Phasenverschiebung in Grad; φ = φ_u − φ_i.'],
    ['Zeiger', 'der', '', '', 'Drehender Pfeil, dessen Länge den Wert und dessen Winkel die Phase einer Sinusgröße zeigt.'],
    ['Zeigerdiagramm', 'das', '', '', 'Bild aller Zeiger einer Schaltung; Zeiger werden geometrisch addiert.'],
    ['Wirkwiderstand', 'der', 'R', 'Ω', 'Widerstand, an dem Strom und Spannung in Phase sind.'],
    ['Blindwiderstand', 'der', 'X', 'Ω', 'Widerstand von Spule (X_L = ω · L) und Kondensator (X_C = 1 / (ω · C)); X = X_L − X_C.'],
    ['Scheinwiderstand', 'der', 'Z', 'Ω', 'Betrag der Verbindung von Wirk- und Blindwiderstand: Z = √(R² + X²). Auch Impedanz genannt.'],
    ['Scheinleitwert', 'der', 'Y', 'S', 'Kehrwert des Scheinwiderstands; Y = 1 / Z.'],
    ['Wirkleistung', 'die', 'P', 'W', 'Leistung, die in Wärme oder Arbeit umgesetzt wird; P = U · I · cos φ.'],
    ['Blindleistung', 'die', 'Q', 'var', 'Leistung, die zwischen Quelle und Spule oder Kondensator pendelt; Q = U · I · sin φ. Induktiv positiv, kapazitiv negativ.'],
    ['Scheinleistung', 'die', 'S', 'VA', 'Produkt aus Effektivspannung und Effektivstrom; S = U · I = √(P² + Q²).'],
    ['Leistungsfaktor', 'der', 'cos φ', '', 'Verhältnis von Wirkleistung zu Scheinleistung; cos φ = P / S.'],
    ['Kompensation', 'die', '', '', 'Verringern der Blindleistung, hier durch einen Kondensator parallel zur induktiven Last.'],
    ['Überkompensation', 'die', '', '', 'Der Kondensator ist so groß, dass die Last insgesamt kapazitiv wird; Q ist dann negativ und cos φ sinkt wieder.'],
    ['Schwingkreis', 'der', '', '', 'Schaltung aus Spule und Kondensator, die bei der Resonanzfrequenz besonders reagiert.'],
    ['Reihenschwingkreis', 'der', '', '', 'Spule, Kondensator und Verlustwiderstand in Reihe; bei Resonanz ist der Scheinwiderstand am kleinsten.'],
    ['Parallelschwingkreis', 'der', '', '', 'Spule und Kondensator parallel; bei Resonanz ist der Scheinwiderstand am größten (Sperrkreis).'],
    ['Resonanzfrequenz', 'die', 'f₀', 'Hz', 'f₀ = 1 / (2π · √(L · C)); dort sind X_L und X_C gleich.'],
    ['Kennwiderstand', 'der', 'Z₀', 'Ω', 'Z₀ = √(L / C), der Blindwiderstand bei der Resonanzfrequenz.'],
    ['Güte', 'die', 'Q_G', '', 'Q_G = Z₀ / R beim Reihenkreis, Q_G = R_p / Z₀ beim Parallelkreis. Das Formelzeichen Q_G unterscheidet sie von der Blindleistung Q.'],
    ['Bandbreite', 'die', 'B', 'Hz', 'B = f₀ / Q_G; Abstand der beiden Grenzfrequenzen, bei denen Strom oder Spannung auf 1/√2 gefallen sind.'],
    ['Spannungsüberhöhung', 'die', '', 'V', 'Im Reihenkreis bei Resonanz liegen an Spule und Kondensator je Q_G mal die Quellenspannung.'],
    ['Grenzfrequenz', 'die', 'f_g', 'Hz', 'Frequenz, bei der das Übertragungsverhältnis auf 70,7 % (−3 dB) gefallen ist; f_g = 1 / (2π · R · C) beim RC-Glied und f_g = R / (2π · L) beim RL-Glied.'],
    ['Zeitkonstante', 'die', 'τ', 's', 'τ = R · C beim RC-Glied und τ = L / R beim RL-Glied.'],
    ['Tiefpass', 'der', '', '', 'Filter, das tiefe Frequenzen durchlässt und hohe dämpft.'],
    ['Hochpass', 'der', '', '', 'Filter, das hohe Frequenzen durchlässt und tiefe dämpft.'],
    ['Bode-Diagramm', 'das', '', 'dB', 'Darstellung von 20 · lg|H| und der Phase über der Frequenz auf einer logarithmischen Achse (Vertiefung).'],
    ['Transformator', 'der', '', '', 'Überträgt Wechselspannung über ein Magnetfeld zwischen zwei Wicklungen; Kurzform Trafo.'],
    ['Primärseite', 'die', '', '', 'Wicklung des Transformators, die an der Quelle liegt.'],
    ['Sekundärseite', 'die', '', '', 'Wicklung des Transformators, an der die Last liegt.'],
    ['Übersetzungsverhältnis', 'das', 'ü', '', 'ü = N₁ / N₂ = U₁ / U₂.'],
    ['Wirkungsgrad', 'der', 'η', '%', 'Verhältnis von abgegebener zu aufgenommener Wirkleistung.'],
    ['Drehstrom', 'der', '', '', 'Drei Wechselspannungen gleicher Frequenz, gegeneinander um 120° verschoben.'],
    ['Außenleiter', 'der', 'L1, L2, L3', '', 'Die drei spannungsführenden Leiter des Drehstromnetzes.'],
    ['Sternpunkt', 'der', '', '', 'Gemeinsamer Punkt der Stern-Schaltung; bei symmetrischer Last ist der Strom darin null.'],
    ['Strangspannung', 'die', 'U_Str', 'V', 'Spannung an einem einzelnen Strang (Wicklung oder Verbraucher) der Last.']
  ];
  const glossary = GL.map(function (g) {
    return Object.freeze({ term: g[0], genus: g[1], abbr: g[2], unit: g[3], text: g[4] });
  });
  hide(glossary, 'get', function (term) {
    try {
      const k = String(term).toLowerCase();
      for (let i = 0; i < glossary.length; i++) if (glossary[i].term.toLowerCase() === k) return glossary[i];
    } catch (e) { /* */ }
    return null;
  });
  hide(glossary, 'list', function () { try { return glossary.slice(); } catch (e) { return []; } });
  Object.freeze(glossary);
  api.glossary = glossary;

  /* =============================== 4.1 Sinusgroessen (sine) =============================== */
  const FORMS = ['sinus', 'rechteck', 'dreieck'];
  function sineCfg(cfg) {
    reqObj(cfg);
    const form = cfg.form === undefined || cfg.form === null ? 'sinus' : String(cfg.form);
    if (FORMS.indexOf(form) < 0) V('Unbekannte Kurvenform „' + form + '“. Es gibt Sinus, Rechteck und Dreieck.');
    const ampl = reqNn(cfg.ampl, 'Der Scheitelwert', 1e9);
    const f = reqPos(cfg.f, 'Die Frequenz', 1e12);
    const phi = optFin(cfg.phi, 0, 'Der Phasenwinkel', 1e6);
    const offset = optFin(cfg.offset, 0, 'Der Gleichanteil', 1e9);
    return { form: form, ampl: ampl, f: f, phi: phi, offset: offset, T: 1 / f, omega: TWO_PI * f };
  }
  /* Kurvenform mit Scheitelwert 1 bei Phase x (Bogenmass), Nulldurchgang bei x = 0 */
  function shape(form, x) {
    if (form === 'sinus') return Math.sin(x);
    if (form === 'rechteck') {
      let xm = x % TWO_PI; if (xm < 0) xm += TWO_PI;
      return (xm < Math.PI * (1 - 1e-12) || xm > TWO_PI * (1 - 1e-12)) ? 1 : -1;
    }
    return (2 / Math.PI) * Math.asin(clamp(Math.sin(x), -1, 1));
  }
  const sine = {
    make: S(function (cfg) {
      const c = sineCfg(cfg);
      const r = { ok: true, form: c.form, ampl: c.ampl, f: c.f, phi: c.phi, offset: c.offset, T: c.T, omega: c.omega };
      if (c.form !== 'sinus' && c.phi !== 0) { r.phaseNurZeitversatz = true; r.hinweis = TEXTS.nurSinus; }
      return r;
    }),
    values: S(function (cfg) {
      const c = sineCfg(cfg);
      const k = { sinus: [1 / SQ2, 2 / Math.PI], rechteck: [1, 1], dreieck: [1 / Math.sqrt(3), 0.5] }[c.form];
      const rmsAc = c.ampl * k[0], rect = c.ampl * k[1];
      const r = {
        ok: true, form: c.form, T: c.T, omega: c.omega, rms: Math.sqrt(c.offset * c.offset + rmsAc * rmsAc), acRms: rmsAc,
        peak: c.ampl, pp: 2 * c.ampl, max: c.offset + c.ampl, min: c.offset - c.ampl, mean: c.offset, rect: rect,
        formFactor: rmsAc / rect, crest: c.ampl / rmsAc
      };
      if (c.ampl === 0) return invalid('Scheitelwert null: kein Signal, Formfaktor und Scheitelfaktor sind nicht definiert.', ['formFactor', 'crest'], r);
      if (c.offset !== 0) r.hinweis = 'Mit Gleichanteil gilt U = √(U_DC² + U_AC²); Gleichrichtwert, Formfaktor und Scheitelfaktor gelten für den Wechselanteil.';
      return r;
    }),
    sample: S(function (cfg, n) {
      const c = sineCfg(cfg);
      const N = Math.floor(num(n, NaN));
      if (!(N >= 2)) V('Die Anzahl der Abtastwerte muss mindestens 2 sein.');
      if (N > 20000) V('Die Anzahl der Abtastwerte ist zu groß (höchstens 20000).');
      const t = new Array(N), y = new Array(N), ph = c.phi * RAD;
      for (let i = 0; i < N; i++) {
        t[i] = i * c.T / N;
        y[i] = c.offset + c.ampl * shape(c.form, TWO_PI * i / N + ph);
      }
      return { ok: true, n: N, T: c.T, t: t, y: y };
    }),
    at: C(function (cfg, tS) {
      const c = sineCfg(cfg), t = num(tS, NaN);
      if (!isFinite(t) || Math.abs(t) > 1e9) return NaN;
      return c.offset + c.ampl * shape(c.form, c.omega * t + c.phi * RAD);
    }),
    shift: S(function (cfg) {
      reqObj(cfg);
      const f = reqPos(cfg.f, 'Die Frequenz', 1e12);
      const raw = reqFin(cfg.phi, 'Der Phasenwinkel', 1e6);
      const phi = normDeg(raw), T = 1 / f;
      const dtS = Math.abs(phi) / 360 * T;
      const dir = phi > 0 ? 'vor' : (phi < 0 ? 'nach' : 'gleich');
      const text = dir === 'gleich' ? 'Beide Größen sind in Phase.' :
        'Die Größe eilt dem Bezug um ' + fmt(Math.abs(phi), 1) + '° (' + fmtEng(dtS, 's') + ') ' + dir + '.';
      return { ok: true, phi: phi, phiRaw: raw, T: T, dtS: dtS, dtMs: dtS * 1000, dir: dir, text: text };
    }),
    sum: S(function (a, b) {
      reqObj(a); reqObj(b);
      [a, b].forEach(function (z) { if (z.form !== undefined && z.form !== null && z.form !== 'sinus') V(TEXTS.nurSinus); });
      const aa = reqNn(a.ampl, 'Der Scheitelwert', 1e9), bb = reqNn(b.ampl, 'Der Scheitelwert', 1e9);
      const pa = optFin(a.phi, 0, 'Der Phasenwinkel', 1e6), pb = optFin(b.phi, 0, 'Der Phasenwinkel', 1e6);
      const fa = optPos(a.f, NaN, 'Die Frequenz', 1e12), fb = optPos(b.f, NaN, 'Die Frequenz', 1e12);
      if (isFinite(fa) && isFinite(fb) && Math.abs(fa - fb) > 1e-9 * Math.max(fa, fb)) V('Die Zeigeraddition gilt nur für gleichfrequente Größen.');
      const z = cx.add(cx.fromPolar(aa, pa * RAD), cx.fromPolar(bb, pb * RAD));
      const ampl = Math.hypot(z.re, z.im);
      const f = isFinite(fa) ? fa : fb;
      const r = { ok: true, ampl: ampl, phi: ampl === 0 ? 0 : normDeg(Math.atan2(z.im, z.re) * DEG), rms: ampl / SQ2, re: z.re, im: z.im };
      if (isFinite(f)) r.f = f;
      return r;
    })
  };
  api.sine = sine;

  /* =============================== 4.2 R, L, C (rlc) =============================== */
  const AUFBAU = ['R', 'L', 'C', 'RL', 'RC', 'RLC'];
  /* gemeinsame Pruefung: liefert { aufbau, hasR, hasL, hasC, r, l, c, f, dc } (f = 0 -> dc) */
  function rlcCfg(cfg, parallel) {
    reqObj(cfg);
    let aufbau = cfg.aufbau;
    const rr = num(cfg.r, NaN), ll = num(cfg.l, NaN), cc = num(cfg.c, NaN);
    if (aufbau === undefined || aufbau === null || aufbau === '') {
      aufbau = (rr > 0 ? 'R' : '') + (ll > 0 ? 'L' : '') + (cc > 0 ? 'C' : '');
      if (!aufbau) V('Es ist kein Bauteil mit einem Wert größer als 0 angegeben (R, L oder C).');
    } else {
      aufbau = String(aufbau);
      if (AUFBAU.indexOf(aufbau) < 0) V('Unbekannter Aufbau „' + aufbau + '“. Es gibt R, L, C, RL, RC und RLC.');
    }
    const o = { aufbau: aufbau, hasR: aufbau.indexOf('R') >= 0, hasL: aufbau.indexOf('L') >= 0, hasC: aufbau.indexOf('C') >= 0, r: 0, l: 0, c: 0, dc: false };
    if (o.hasR) o.r = (parallel || aufbau === 'R') ? reqPos(cfg.r, 'Der Wirkwiderstand', 1e12) : reqNn(cfg.r, 'Der Wirkwiderstand', 1e12);
    if (o.hasL) o.l = (parallel || aufbau === 'L') ? reqPos(cfg.l, 'Die Induktivität', 1e9) : reqNn(cfg.l, 'Die Induktivität', 1e9);
    if (o.hasC) o.c = reqPos(cfg.c, 'Die Kapazität', 1e9);
    const fx = num(cfg.f, NaN);
    if (aufbau === 'R') { o.f = fx >= 0 && fx <= 1e12 ? fx : 0; }
    else if (fx === 0) { o.dc = true; o.f = 0; }
    else o.f = reqPos(cfg.f, 'Die Frequenz', 1e12);
    o.omega = TWO_PI * o.f;
    return o;
  }
  function phiText(phi, bezugReihe) {
    if (Math.abs(phi) < 1e-7) return 'Strom und Spannung sind in Phase.';
    const w = fmt(Math.abs(phi), 1) + '°';
    if (bezugReihe) return phi > 0 ? 'Die Spannung eilt dem Strom um ' + w + ' vor.' : 'Die Spannung eilt dem Strom um ' + w + ' nach.';
    return phi > 0 ? 'Der Strom eilt der Spannung um ' + w + ' nach.' : 'Der Strom eilt der Spannung um ' + w + ' vor.';
  }
  const rlc = {
    reactance: S(function (cfg) {
      reqObj(cfg);
      const hasL = !(cfg.l === undefined || cfg.l === null), hasC = !(cfg.c === undefined || cfg.c === null);
      const l = hasL ? reqNn(cfg.l, 'Die Induktivität', 1e9) : 0;
      const c = hasC ? num(cfg.c, NaN) : NaN;
      if (hasC && !(c >= 0)) V('Die Kapazität muss eine Zahl sein und darf nicht negativ sein.');
      if (hasC && c > 1e9) V('Die Kapazität ist unrealistisch groß.');
      const fx = num(cfg.f, NaN);
      if (fx === 0 || (hasC && c === 0)) return invalid(TEXTS.gleichstrom, ['xl', 'xc', 'x', 'omega']);
      const f = reqPos(cfg.f, 'Die Frequenz', 1e12);
      const w = TWO_PI * f, xl = w * l, xc = hasC ? 1 / (w * c) : 0;
      return { ok: true, valid: true, omega: w, xl: xl, xc: xc, x: xl - xc };
    }),
    series: S(function (cfg) {
      const c = rlcCfg(cfg, false);
      const u = reqNn(cfg.u, 'Die Spannung', 1e9);
      if (c.dc) return invalid(TEXTS.gleichstrom, ['z', 'phi', 'i', 'ur', 'ul', 'uc', 'ux', 'xl', 'xc', 'x']);
      const xl = c.hasL ? c.omega * c.l : 0, xc = c.hasC ? 1 / (c.omega * c.c) : 0, x = xl - xc;
      const z = Math.hypot(c.r, x);
      if (!(z > 1e-12 * Math.max(xl, xc, 1e-300)) || z === 0) return invalid(TEXTS.reiheIdeal, ['z', 'phi', 'i', 'ur', 'ul', 'uc', 'ux'], { xl: xl, xc: xc, x: x });
      const i = u / z, phiRad = Math.atan2(x, c.r), phi = phiRad * DEG;
      const art = Math.abs(x) <= 1e-9 * z ? 'ohmsch' : (x > 0 ? 'induktiv' : 'kapazitiv');
      const ur = i * c.r, ul = i * xl, uc = i * xc, ux = Math.abs(i * x);
      return {
        ok: true, valid: true, art: art, aufbau: c.aufbau, bezug: 'strom', u: u, f: c.f, omega: c.omega, r: c.r, xl: xl, xc: xc, x: x, z: z,
        phi: phi, phiRad: phiRad, i: i, ur: ur, ul: ul, uc: uc, ux: ux, uGeom: Math.hypot(ur, ux),
        triangle: { r: c.r, x: x, z: z }, p: i * i * c.r, q: i * i * x, s: u * i, cosphi: c.r / z, text: phiText(phi, true)
      };
    }),
    parallel: S(function (cfg) {
      const c = rlcCfg(cfg, true);
      const u = reqNn(cfg.u, 'Die Spannung', 1e9);
      if (c.dc) return invalid(TEXTS.gleichstrom, ['y', 'z', 'phi', 'i', 'ir', 'il', 'ic', 'ix', 'xl', 'xc']);
      const g = c.hasR ? 1 / c.r : 0, bl = c.hasL ? 1 / (c.omega * c.l) : 0, bc = c.hasC ? c.omega * c.c : 0;
      const xl = c.hasL ? c.omega * c.l : 0, xc = c.hasC ? 1 / (c.omega * c.c) : 0;
      const b = bl - bc, y = Math.hypot(g, b);
      if (!(y > 1e-12 * Math.max(bl, bc, 1e-300)) || y === 0) return invalid(TEXTS.parallelIdeal, ['y', 'z', 'phi', 'i', 'ir', 'il', 'ic', 'ix'], { xl: xl, xc: xc });
      const phiRad = Math.atan2(b, g), phi = phiRad * DEG;
      const art = Math.abs(b) <= 1e-9 * y ? 'ohmsch' : (b > 0 ? 'induktiv' : 'kapazitiv');
      return {
        ok: true, valid: true, art: art, aufbau: c.aufbau, bezug: 'spannung', u: u, f: c.f, omega: c.omega, r: c.r, xl: xl, xc: xc, g: g, bl: bl, bc: bc, y: y, z: 1 / y,
        phi: phi, phiRad: phiRad, i: u * y, ir: u * g, il: u * bl, ic: u * bc, ix: u * Math.abs(b),
        p: u * u * g, q: u * u * b, s: u * u * y, cosphi: g / y, text: phiText(phi, false)
      };
    }),
    phasors: S(function (cfg) {
      reqObj(cfg);
      const art = cfg.art === undefined || cfg.art === null ? (cfg.schaltung === 'parallel' ? 'parallel' : 'reihe') : String(cfg.art);
      if (art !== 'reihe' && art !== 'parallel') V('Unbekannte Schaltung „' + art + '“. Es gibt Reihe und Parallel.');
      if (art === 'reihe') {
        const s = rlc.series(cfg);
        if (!s.ok || s.valid === false) return s;
        const list = [{ name: 'I', len: s.i, angle: 0, unit: 'A' }];
        if (s.r > 0) list.push({ name: 'U_R', len: s.ur, angle: 0, unit: 'V' });
        if (s.xl > 0) list.push({ name: 'U_L', len: s.ul, angle: 90, unit: 'V' });
        if (s.xc > 0) list.push({ name: 'U_C', len: s.uc, angle: -90, unit: 'V' });
        list.push({ name: 'U', len: s.u, angle: s.phi, unit: 'V' });
        return { ok: true, valid: true, art: 'reihe', bezug: 'strom', f: s.f, omega: s.omega, phi: s.phi, effektiv: true, list: list };
      }
      const p = rlc.parallel(cfg);
      if (!p.ok || p.valid === false) return p;
      const list = [{ name: 'U', len: p.u, angle: 0, unit: 'V' }];
      if (p.g > 0) list.push({ name: 'I_R', len: p.ir, angle: 0, unit: 'A' });
      if (p.bl > 0) list.push({ name: 'I_L', len: p.il, angle: -90, unit: 'A' });
      if (p.bc > 0) list.push({ name: 'I_C', len: p.ic, angle: 90, unit: 'A' });
      list.push({ name: 'I', len: p.i, angle: -p.phi, unit: 'A' });
      return { ok: true, valid: true, art: 'parallel', bezug: 'spannung', f: p.f, omega: p.omega, phi: p.phi, effektiv: true, list: list };
    }),
    coil: S(function (cfg) {
      reqObj(cfg);
      const u = reqPos(cfg.u, 'Die Spannung', 1e9), i = reqPos(cfg.i, 'Der Strom', 1e9), p = reqNn(cfg.p, 'Die Wirkleistung', 1e12);
      const f = optPos(cfg.f, F_NETZ, 'Die Frequenz', 1e12);
      const s = u * i;
      if (p > s * (1 + 1e-9)) V('Die Wirkleistung ist größer als die Scheinleistung (U · I): Die Messwerte passen nicht zusammen.');
      const z = u / i, r = p / (i * i), xl = Math.sqrt(Math.max(0, z * z - r * r));
      return { ok: true, valid: true, z: z, r: r, xl: xl, l: xl / (TWO_PI * f), f: f, cosphi: Math.min(1, p / s), phi: Math.acos(Math.min(1, p / s)) * DEG };
    })
  };
  api.rlc = rlc;

  /* =============================== 4.3 Leistung (power) =============================== */
  function snapZero(x) { return Math.abs(x) < 1e-12 ? 0 : x; }
  function powerRes(s, p, q, extra) {
    const cosphi = s > 0 ? p / s : 1;
    const o = { ok: true, valid: true, s: s, p: p, q: q, cosphi: cosphi, sinphi: s > 0 ? q / s : 0, phi: Math.atan2(q, p) * DEG };
    if (extra) for (const k in extra) o[k] = extra[k];
    if (p === 0 && s > 0) { o.reinBlind = true; o.hinweis = TEXTS.blindLast; }
    return o;
  }
  const power = {
    fromUIphi: S(function (U, I, phi) {
      const u = reqNn(U, 'Die Spannung', 1e9), i = reqNn(I, 'Der Strom', 1e9);
      const phiN = normDeg(reqFin(phi, 'Der Phasenwinkel', 1e6));
      const nan = ['s', 'p', 'q', 'cosphi', 'sinphi'];
      if (u === 0 || i === 0) return invalid(TEXTS.keinStrom, nan);
      const cs = snapZero(Math.cos(phiN * RAD)), sn = snapZero(Math.sin(phiN * RAD));
      if (cs < 0) return invalid(TEXTS.pNegativ, nan);
      const s = u * i;
      const o = powerRes(s, s * cs, s * sn, { cosphi: cs, sinphi: sn, phi: phiN, u: u, i: i });
      return o;
    }),
    fromMeasure: S(function (U, I, P) {
      const u = reqPos(U, 'Die Spannung', 1e9), i = reqPos(I, 'Der Strom', 1e9), p = reqNn(P, 'Die Wirkleistung', 1e12);
      const s = u * i;
      if (p > s * (1 + 1e-9)) V('Die Wirkleistung (' + fmtEng(p, 'W') + ') ist größer als die Scheinleistung (' + fmtEng(s, 'VA') + '): Die Messwerte passen nicht zusammen.');
      const pp = Math.min(p, s);
      return powerRes(s, pp, Math.sqrt(Math.max(0, s * s - pp * pp)), { u: u, i: i, art: 'unbekannt' });
    }),
    fromPcos: S(function (P, cosphi, U, art) {
      const p = reqNn(P, 'Die Wirkleistung', 1e12);
      const cs = num(cosphi, NaN);
      const nan = ['s', 'q', 'i', 'phi'];
      if (!isFinite(cs)) V('Der Leistungsfaktor cos φ muss eine Zahl sein.');
      if (cs === 0) return invalid(TEXTS.blindNull, nan, { p: p, cosphi: 0 });
      if (cs < 0 || cs > 1) return invalid('Der Leistungsfaktor cos φ muss größer als 0 und höchstens 1 sein.', nan, { p: p, cosphi: cs });
      const u = optPos(U, NaN, 'Die Spannung', 1e9);
      const sgn = art === 'kapazitiv' ? -1 : 1;
      const s = p / cs, tan = Math.tan(Math.acos(cs));
      const o = powerRes(s, p, sgn * p * tan, { cosphi: cs, art: sgn < 0 ? 'kapazitiv' : 'induktiv' });
      o.phi = sgn * Math.acos(cs) * DEG;
      o.sinphi = sgn * Math.sqrt(Math.max(0, 1 - cs * cs));
      if (isFinite(u)) { o.i = s / u; o.u = u; }
      return o;
    }),
    triangle: S(function (res) {
      reqObj(res);
      const p = reqFin(res.p, 'Die Wirkleistung', 1e12), q = reqFin(res.q, 'Die Blindleistung', 1e12);
      const s = Math.hypot(p, q);
      if (s === 0) return invalid(TEXTS.keinStrom, ['cosphi'], { p: 0, q: 0, s: 0, phi: 0 });
      return { ok: true, p: p, q: q, s: s, phi: Math.atan2(q, p) * DEG, cosphi: p / s, art: q > 0 ? 'induktiv' : (q < 0 ? 'kapazitiv' : 'ohmsch') };
    }),
    line: S(function (cfg) {
      reqObj(cfg);
      const p = reqNn(cfg.p, 'Die Wirkleistung', 1e12), u = reqPos(cfg.u, 'Die Spannung', 1e9), rl = reqNn(cfg.rl, 'Der Leitungswiderstand', 1e9);
      const cs = num(cfg.cosphi, NaN);
      if (!(cs > 0 && cs <= 1)) V('Der Leistungsfaktor cos φ muss größer als 0 und höchstens 1 sein.');
      const s = p / cs, i = s / u, pv = i * i * rl;
      const o = { ok: true, valid: true, s: s, i: i, pv: pv, rl: rl };
      if (cfg.cos2 !== undefined && cfg.cos2 !== null) {
        const c2 = num(cfg.cos2, NaN);
        if (!(c2 > 0 && c2 <= 1)) V('Das zweite cos φ muss größer als 0 und höchstens 1 sein.');
        const s2 = p / c2, i2 = s2 / u, pv2 = i2 * i2 * rl;
        o.s2 = s2; o.i2 = i2; o.pv2 = pv2; o.ratio = (i2 / i) * (i2 / i); o.einsparung = pv - pv2;
      }
      return o;
    })
  };
  api.power = power;

  /* =============================== 4.4 Kompensation (comp) =============================== */
  function compCfg(cfg, needCos2) {
    reqObj(cfg);
    if (cfg.form !== undefined && cfg.form !== null && cfg.form !== 'parallel') V(TEXTS.kompNurParallel);
    const p = reqPos(cfg.p, 'Die Wirkleistung', 1e12);
    const u = reqPos(cfg.u, 'Die Spannung', 1e9);
    const f = reqPos(cfg.f, 'Die Frequenz', 1e12);
    const cos1 = num(cfg.cos1, NaN);
    if (!(cos1 > 0 && cos1 <= 1)) V('Der Leistungsfaktor vorher (cos φ₁) muss größer als 0 und höchstens 1 sein.');
    let cos2 = NaN;
    if (needCos2) {
      cos2 = num(cfg.cos2, NaN);
      if (!(cos2 > 0 && cos2 <= 1)) V('Das Ziel (cos φ₂) muss größer als 0 und höchstens 1 sein.');
    }
    const w = TWO_PI * f;
    return { p: p, u: u, f: f, w: w, cos1: cos1, cos2: cos2, q1: p * Math.tan(Math.acos(cos1)) };
  }
  const comp = {
    need: S(function (cfg) {
      const c = compCfg(cfg, true);
      const t2 = Math.tan(Math.acos(c.cos2)), q2 = c.p * t2;
      const s1 = c.p / c.cos1, s2 = c.p / c.cos2;
      if (c.cos2 < c.cos1) return invalid(TEXTS.kompZielNiedrig, ['qc', 'c', 'i2', 'dpv'], { q1: c.q1, s1: s1, i1: s1 / c.u });
      const qc = c.q1 - q2;
      return { ok: true, valid: true, form: 'parallel', qc: qc, c: qc / (c.w * c.u * c.u), i1: s1 / c.u, i2: s2 / c.u, q1: c.q1, q2: q2, s1: s1, s2: s2, dpv: (s2 / s1) * (s2 / s1), omega: c.w };
    }),
    after: S(function (cfg) {
      const c = compCfg(cfg, false);
      const cap = optNn(cfg.c, 0, 'Die Kapazität', 1e9);
      const qc = c.w * c.u * c.u * cap, q = c.q1 - qc, s = Math.hypot(c.p, q);
      const cMax = c.q1 / (c.w * c.u * c.u);
      const tol = 1e-9 * s;
      const ueber = q < -tol;
      return {
        ok: true, valid: true, cos: c.p / s, q: q, s: s, i: s / c.u, q1: c.q1, qc: qc, c: cap, cMax: cMax, p: c.p, cos1: c.cos1,
        ueber: ueber, art: Math.abs(q) <= tol ? 'ohmsch' : (q > 0 ? 'induktiv' : 'kapazitiv')
      };
    }),
    cMax: C(function (cfg) {
      const c = compCfg(cfg, false);
      return c.q1 / (c.w * c.u * c.u);
    }),
    state: S(function (cfg) {
      reqObj(cfg);
      const cos2 = optFin(cfg.cos2, COS_ZIEL, 'Das Ziel (cos φ₂)', 10);
      if (!(cos2 > 0 && cos2 <= 1)) V('Das Ziel (cos φ₂) muss größer als 0 und höchstens 1 sein.');
      const a = comp.after(cfg);
      if (!a.ok) return a;
      const tol = 1e-9;
      let state, text;
      if (a.ueber) {
        state = 'ueber';
        text = 'Überkompensation: C = ' + fmtEng(a.c, 'F') + ' ist größer als ' + fmtEng(a.cMax, 'F') + '. Die Last wird kapazitiv (Q = ' + fmtEng(a.q, 'var') + '), cos φ sinkt auf ' + fmt(a.cos, 3) + '.';
      } else if (a.cos < cos2 - tol) {
        state = 'unter';
        text = 'Ziel noch nicht erreicht: cos φ = ' + fmt(a.cos, 3) + ', Ziel ' + fmt(cos2, 3) + '.';
      } else {
        state = 'ziel';
        text = 'Ziel erreicht: cos φ = ' + fmt(a.cos, 3) + ' bei Ziel ' + fmt(cos2, 3) + '; die Last ist nicht überkompensiert (Q = ' + fmtEng(a.q, 'var') + ').';
      }
      const o = {}; for (const k in a) o[k] = a[k];
      o.state = state; o.cos2 = cos2; o.text = text;
      return o;
    })
  };
  api.comp = comp;

  /* ---------- Hilfen fuer Tests und Teil 2 (wslcore-res.js) ---------- */
  api.util = {
    num: num, clamp: clamp, fin: fin, isArr: isArr, isObj: isObj, obj: obj, fail: fail, invalid: invalid, V: V, reqObj: reqObj, reqPos: reqPos, reqNn: reqNn,
    reqFin: reqFin, optPos: optPos, optNn: optNn, optFin: optFin, C: C, S: S, A: A, L: L, LV: LV, hide: hide, statusTag: statusTag, normDeg: normDeg,
    checkOut: checkOut, shape: shape, phiText: phiText, TWO_PI: TWO_PI, RAD: RAD, DEG: DEG, SQ2: SQ2, rlcCfg: rlcCfg, sineCfg: sineCfg, compCfg: compCfg
  };
  hide(api, 'util', api.util);
  api.extend = function (name, o) { try { api[name] = o; return true; } catch (e) { return false; } };
  hide(api, 'extend', api.extend);
  api.guardAll = true;
  root.WSL_CORE = api;
  if (typeof module !== 'undefined') module.exports = root.WSL_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
