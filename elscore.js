/* elscore.js - ELS-Lab Kern Teil 1 (ELS_CORE, Version 1.0)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.ELS_CORE, Node: module.exports / globalThis.ELS_CORE.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval. Alle Anlagenwerte sind Uebungswerte (Uebungsanlage).
 * Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. Norm und Vorschrift massgeblich.
 * Teil 2 (insu, pe, leak, device, protocol, rules, aid, design, assess, diagnose, formulas, exercise, runSeq) steht in elscore-pruef.js
 * und haengt sich mit ELS_CORE.extend(name, obj) bzw. direkt an dasselbe Objekt (Schnittstelle: ELS_CORE.util).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten: Strom in A (Anzeige mit fmtEng als mA), Spannung V, Widerstand Ohm, Laenge m, Querschnitt mm2, Zeit s (tMs in ms).
 *    Ausnahme (wie in der SPEC): RCD-Funktionen rechnen Differenzstrom und Nennfehlerstrom in mA; Erdungswiderstaende ra, rb in Ohm;
 *    cleck (IT) in nF. Jede Funktion nennt ihre Einheit unten.
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte, negative
 *    oder riesige Werte) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }, Listen [].
 *    Formeln ausserhalb des Gueltigkeitsbereichs melden valid:false mit Text und rechnen nie still weiter.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32).
 *  - Jeder Grenzwert steht NUR in ELS_CORE.limits (status 'belegt' | 'A'); Modellkonstanten (Zonen, LS-Faktoren, RCD-Zeiten, Rk)
 *    werden aus limits[].extra gelesen. Texte nennen Grenzwerte nur ueber limitText(id).
 *
 * SIGNATUREN (SPEC 4 ist massgeblich; hier die Festlegungen, die dort offen waren)
 *  Basis:  guard(fn,fb) rng(seed){next(),normal()} fmt(x,d)=fm fmtEng(x,unit) parseNum(str) parseQty(str) limits[] limit(id) limitText(id)
 *          limitOK(id) glossary{items,foreign,get,list} TEXTS{...,get(id,vars)} levers{basis,fehler,zusatz}=ebenen const{...} util{...} extend(name,obj)
 *  body:   resistance({haut:'trocken'|'feucht'|'nass'|'rechen', pfad:'hand-fuss'|'hand-hand'|'hand-rumpf', rv:Ohm}) -> {ok, rk, rv, rges, haut, pfad, status:'A', frage:'F11'}
 *          current(U, cfg) -> A (NaN) ; zone(I[A], tMs, art?) -> {ok, zone:1..4, id:'Z1'.., name, text, margin (=iFl - I in A), iFl} ; art 'DC'/'gleich' -> {ok:false, valid:false, why}
 *          zoneCurve(tMs|[tMs]) -> {ok, t, z1, z2, flimmer} (A) bzw. Liste ; touch({U, haut, pfad, rv, tMs}) -> {ok, U, U_B, I_K, iK, R_ges, rges, zone(1..4), zoneInfo, tOK(U_B<=ul_ac), hinweis}
 *  grid:   forms[] ; loop(cfg) ; fault(cfg) ; zsMax(dev, In, cfg?) -> Ohm ; maxLength(cfg) -> {ok, lMax, zsMax,...} ; condition(cfg) ; tt(cfg) ; it(cfg) ; raMax(idn mA) -> Ohm
 *          cfg { form, U0, zv, q, qpe, l, rho, dev, In, kreis:'end'|'verteil', ra, rb, rf, cleck(nF), rcd:{on, idn, type}, fehler:'koerperschluss'|'pe-unterbrochen'|'ohne',
 *                haut, pfad, rv, zweiterFehler }
 *  prot:   devices[] series[] ; ia(dev, In, tGrenze?) -> A (NaN) ; trip(dev, In, I) -> {ok, tMin, tMax, bereich:'nicht'|'thermisch'|'unsicher'|'sicher', text}
 *          (tMin/tMax Infinity = keine Ausloesung) ; curve(dev, In) -> [[x,tMin,tMax],...] ; cable(q) -> {ok, iz, q, status:'A', frage:'F21'}
 *          check(Ib, In, Iz) -> {ok, ibOk, izOk, text} ; shortCircuit(cfg) -> {ok, ik, zLN, text} ; inrush(dev, In, ein) -> {ok, bereich, ausloesung:'ja'|'moeglich'|'nein', text}
 *  rcd:    types[] idnList[] ; trip(cfg, shape, iDiff[mA]) -> {ok, tripped, possible, blind, bereich, tTrip(s|null), text} ; sum([{i, phase:'L'|'L1'|'L2'|'L3'|'N'}]) -> Zahl (Einheit der Eingabe)
 *          leakSum(list(mA, Zahlen oder {i}), cfg) -> {ok, sum, ratio, nahe, fehlausloesung, idn} ; testButton(cfg) -> {ok, tripped, prueftSchutzleiter:false, text} ; person(cfg)
 *  cls/ip: cls.info(id) cls.effect(id, fault) cls.extra(kind) ip.decode(code) ip.encode(a,b)
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const TWO_PI = 2 * Math.PI;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.replace(',', '.')); return isFinite(x) ? x : d; }
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function obj(o) { return isObj(o) ? o : {}; }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  /* Validierungsfehler mit deutschem Text (wird von S() in { ok:false, why } umgesetzt, von C() in NaN) */
  function V(why) { const e = new Error(why); e.elsWhy = why; throw e; }
  function reqPos(v, name, max) {
    const x = num(v, NaN);
    if (!(x > 0)) V(name + ' muss größer als 0 sein.');
    if (x > (max || 1e9)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function reqNn(v, name, max) {
    const x = num(v, NaN);
    if (!(x >= 0)) V(name + ' darf nicht negativ sein.');
    if (x > (max || 1e9)) V(name + ' ist unrealistisch groß.');
    return x;
  }
  function optPos(v, d, name, max) { return v === undefined || v === null ? d : reqPos(v, name, max); }
  function optNn(v, d, name, max) { return v === undefined || v === null ? d : reqNn(v, name, max); }
  /* C: Rechenfunktion -> NaN. S: Strukturfunktion -> { ok:false, why }. A: Liste -> []. */
  function C(fn) { return function () { try { const r = fn.apply(this, arguments); return typeof r === 'number' && !isFinite(r) && r !== Infinity ? NaN : r; } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail(e && e.elsWhy ? e.elsWhy : 'Mit diesen Eingaben gibt es kein Ergebnis.'); } }; }
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

  /* ---------- Konstanten (Uebungswerte der Anlage, SPEC 2 und 4.2) ---------- */
  const U0N = 230, FN = 50, RHO_NEU = 0.0178, RHO_ALT = 0.0172, ZV_DEF = 0.4;
  api.const = { U0: U0N, f: FN, rho: RHO_NEU, rhoAlt: RHO_ALT, zv: ZV_DEF, status: 'A', frage: 'F20' };

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
  const UNITS = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'J', 'm', 's', 'S', 'VA'];
  /* parseQty(str) -> { v (SI, Vorsatz angewendet), raw, factor, unit, hasUnit } oder null. "0,3 Ω", "30 mA", "2 MΩ", "2,5 mm²" */
  function parseQty(str) {
    if (typeof str === 'number') return isFinite(str) ? { v: str, raw: str, factor: 1, unit: '', hasUnit: false } : null;
    if (typeof str !== 'string') return null;
    const b = numBody(str);
    if (!b) return null;
    let u = b.rest.trim();
    if (u === '') return { v: b.v, raw: b.v, factor: 1, unit: '', hasUnit: false };
    let sq = false;
    if (/²$/.test(u)) { sq = true; u = u.slice(0, -1); }
    if (/\^2$/.test(u)) { sq = true; u = u.slice(0, -2); }
    let f = 1;
    const base = u;
    if (/^(dB|%|°)/.test(u)) f = 1;
    else if (u === 'Meg') f = 1e6;
    else if (UNITS.indexOf(u) >= 0) f = 1;
    else if (u.length >= 2 && PFX[u[0]] !== undefined && UNITS.indexOf(u.slice(1)) >= 0) f = PFX[u[0]];
    else if (u.length === 1 && PFX[u] !== undefined) f = PFX[u];
    else if (/^[A-Za-zµμΩ/·²³]+$/.test(u)) f = 1;
    else return null;
    if (sq) f = f * f;
    return { v: b.v * f, raw: b.v, factor: f, unit: base, hasUnit: true };
  }
  function parseNum(str) { try { const q = parseQty(str); return q ? (isFinite(q.v) ? q.v : NaN) : NaN; } catch (e) { return NaN; } }
  api.fmtEng = function (x, u) { try { return fmtEng(x, u); } catch (e) { return '–'; } };
  api.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  api.fm = api.fmt;
  api.parseNum = parseNum;
  api.parseQty = function (s) { try { return parseQty(s); } catch (e) { return null; } };

  /* ---------- Zufall (mulberry32) ---------- */
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
    return { next: next, normal: normal };
  }
  api.rng = function (seed) { try { return rng(seed); } catch (e) { return rng(1); } };

  /* =============================== limits (einzige Quelle der Grenzwerte, SPEC 4.0) =============================== */
  const LIM = [
    ['ber_sk2', 0.5, 'mA', '<=', 'belegt', 'toni', null, 'Berührungsstrom Schutzklasse II', null],
    ['rpe_5m', 0.3, 'Ω', '<=', 'belegt', 'pool:S2025-06, S2020-N32', null, 'Schutzleiterwiderstand bei Anschlussleitung bis 5 m', null],
    ['riso_sk1', 1, 'MΩ', '>=', 'belegt', 'pool:S2025-06', null, 'Isolationswiderstand Schutzklasse I', null],
    ['riso_sk2', 2, 'MΩ', '>=', 'belegt', 'pool:S2025-06, W-2024-Praxis', null, 'Isolationswiderstand Schutzklasse II', null],
    ['tab_033', 0.4, 's', '<=', 'belegt', 'pool:W2022-N16', null, 'Abschaltzeit im TN-Netz 230 V, Endstromkreis bis 32 A', null],
    ['tab_5', 5, 's', '<=', 'belegt', 'pool:W2022-N16', null, 'Abschaltzeit im TN-Netz, Verteilerstromkreis', null],
    ['ul_ac', 50, 'V', '<=', 'belegt', 'pool:W2025-01', null, 'Dauernd zulässige Berührungsspannung (Wechselspannung)', null],
    ['ul_dc', 120, 'V', '<=', 'belegt', 'pool:W2025-01', null, 'Dauernd zulässige Berührungsspannung (Gleichspannung, glatt)', null],
    ['faktor_b', 5, '· In', '=', 'belegt', 'pool:W2025-32', null, 'Sichere Auslösung des Leitungsschutzschalters Typ B', null],
    ['idn_zusatz', 30, 'mA', '=', 'belegt', 'Hauslab (Lernbaustein RCD)', null, 'Nennfehlerstrom des Zusatzschutzes bei Wohn-Steckdosen', null],
    ['rpe_zuschlag', null, 'Ω', '<=', 'A', '—', 'F1', 'Schutzleiterwiderstand bei Leitungen über 5 m: Zuschlag nach Norm, im Lab kein Wert', null],
    ['riso_sk3', null, 'MΩ', '>=', 'A', '—', 'F2', 'Isolationswiderstand Schutzklasse III: im Lab kein Grenzwert', null],
    ['upruef_iso', 500, 'V', '=', 'A', '—', 'F2', 'Prüfspannung der Isolationsmessung (Gleichspannung)', null],
    ['ipe_sk1', 3.5, 'mA', '<=', 'A', '—', 'F3', 'Schutzleiterstrom Schutzklasse I (Übungswert)', null],
    ['ber_sk1', 0.5, 'mA', '<=', 'A', '—', 'F3', 'Berührungsstrom Schutzklasse I (Übungswert)', null],
    ['tab_tt', null, 's', '<=', 'A', '—', 'F5', 'Abschaltzeit im TT-Netz: im Lab kein Wert', null],
    ['tab_it', null, 's', '<=', 'A', '—', 'F5', 'Abschaltzeit im IT-Netz: im Lab kein Wert', null],
    ['ls_bcd', null, '· In', '=', 'A', '—', 'F7', 'Magnetischer Auslösebereich Typ B, C, D (Lehrmodell)', { B: [3, 5], C: [5, 10], D: [10, 20], tMagMin: 0.005, tMagMax: 0.1 }],
    ['ls_thermisch', null, '· In', '=', 'A', '—', 'F7', 'Thermischer Bereich: nicht auslösen bis 1,13 · In, auslösen innerhalb 1 h ab 1,45 · In (Lehrmodell)', { nicht: 1.13, aus: 1.45, tAus: 3600 }],
    ['rcd_zeit', 300, 'ms', '<=', 'A', '—', 'F9', 'Auslösezeit RCD bei IΔn (40 ms bei 5 · IΔn, Lehrmodell)', { t1: 0.3, t5: 0.04, vielfach: 5 }],
    ['rcd_bereich', 0.5, '· IΔn', '=', 'A', '—', 'F9', 'RCD löst nicht aus unter 0,5 · IΔn, kann auslösen bis 1 · IΔn, löst aus ab 1 · IΔn (Lehrfaustwert)', { unten: 0.5, oben: 1 }],
    ['zonen', null, 'mA', '=', 'A', '—', 'F10', 'Zonen der Stromwirkung (Lehrdarstellung, 50 Hz): 0,5 mA, 10 mA, Flimmerkurve ab 50 mA', { z1: 0.0005, z2: 0.01, ifl: 0.05, tRef: 1000 }],
    ['rk', 1000, 'Ω', '=', 'A', '—', 'F11', 'Körperwiderstand: Rechenwert 1 kΩ (entspricht nass); trocken 3 kΩ, feucht 1,5 kΩ', { trocken: 3000, feucht: 1500, nass: 1000, rechen: 1000, pfad: { 'hand-fuss': 1, 'hand-hand': 1, 'hand-rumpf': 0.5 } }]
  ];
  const limits = LIM.map(function (r) {
    const o = { id: r[0], value: r[1], unit: r[2], cmp: r[3], status: r[4], quelle: r[5], frage: r[6], text: r[7] };
    if (r[8]) o.extra = r[8];
    if (o.extra) { hide(o, 'extra', o.extra); Object.freeze(o.extra); }
    return Object.freeze(o);
  });
  Object.freeze(limits);
  api.limits = limits;
  function L(id) {
    for (let i = 0; i < limits.length; i++) if (limits[i].id === id) return limits[i];
    V('Unbekannter Grenzwert: ' + String(id));
  }
  api.limit = guard(function (id) { return L(id); }, null);
  /* Grenzwert als Text mit Einheit und Statuszeichen: "<= 0,3 Ω (✓ belegt)" bzw. "Übungswert (A)" */
  const CMPS = { '<=': '≤ ', '>=': '≥ ', '=': '' };
  function statusTag(l) { return l.status === 'belegt' ? '✓ belegt' : 'Übungswert (A)' + (l.frage ? ', ' + l.frage : ''); }
  api.limitText = guard(function (id) {
    const l = L(id);
    if (l.value === null && !l.extra) return 'kein Wert festgelegt (' + statusTag(l) + ')';
    if (l.value === null) return l.text + ' (' + statusTag(l) + ')';
    return CMPS[l.cmp] + fmt(l.value) + ' ' + l.unit + ' (' + statusTag(l) + ')';
  }, '');
  /* Vergleich eines Messwerts (Einheit wie limit.unit) mit dem Grenzwert: true/false, null wenn kein Wert */
  api.limitOK = guard(function (id, x) {
    const l = L(id); x = num(x, NaN);
    if (!isFinite(x) || l.value === null) return null;
    const tol = 1e-12 * Math.max(1, Math.abs(l.value));
    if (l.cmp === '<=') return x <= l.value + tol;
    if (l.cmp === '>=') return x >= l.value - tol;
    return Math.abs(x - l.value) <= tol;
  }, null);
  const UL = L('ul_ac').value;

  /* ---------- Schutzebenen (= lever des EMV-Labs, einzige Quelle der Namen) ---------- */
  api.levers = {
    basis: { id: 'basis', name: 'Basisschutz', short: 'Basis', text: 'Schutz gegen direktes Berühren aktiver Teile: Isolierung, Gehäuse, Abdeckung, Kleinspannung.' },
    fehler: { id: 'fehler', name: 'Fehlerschutz', short: 'Fehler', text: 'Schutz bei indirektem Berühren (Körperschluss): Schutzleiter mit Abschaltung, Schutzisolierung.' },
    zusatz: { id: 'zusatz', name: 'Zusatzschutz', short: 'Zusatz', text: 'Zusätzlicher Schutz durch die Fehlerstrom-Schutzeinrichtung (RCD) mit höchstens 30 mA.' }
  };
  api.ebenen = api.levers;

  /* =============================== Texte (einzige Quelle) =============================== */
  const TEXTS = {
    simOnly: 'Simulation – Arbeiten an Netzspannung nur durch Elektrofachkraft oder unterwiesene Person.',
    ampelHinweis: 'Grün heißt: Der Schutz ist in der Simulation wirksam. Es heißt nie, dass du etwas gefahrlos anfassen darfst.',
    keinKurs: 'Dieses Lab ersetzt keine Unterweisung und keinen Erste-Hilfe-Kurs.',
    norm: 'Norm und Vorschrift maßgeblich.',
    uebung: 'Übungsanlage: Alle Zahlen sind Übungswerte, keine Aussage über echte Anlagen.',
    uebungProtokoll: 'Übungsprotokoll, kein Prüfnachweis.',
    betriebLegtFest: 'Der Betrieb legt das fest; Norm und Vorschrift maßgeblich.',
    isoNurFrei: 'Isolationsmessung nur am freigeschalteten, getrennten Prüfling.',
    messNurFachkraft: 'Messung am Prüfgerät mit geprüftem Prüfaufbau durch die Elektrofachkraft.',
    ulTrocken: '50 V gelten für trockene Bedingungen, bei Nässe ist die Gefährdung größer.',
    rkModell: 'Der Körperwiderstand sinkt in der Wirklichkeit mit der Spannung; das Modell rechnet vereinfacht mit einem festen Wert.',
    rkRechenwert: 'Für Aufgaben gilt der Rechenwert 1 kΩ für den Körperwiderstand (entspricht nass).',
    flimmerKurve: 'Die Flimmerkurve ist eine Lehrkurve: I = 50 mA · max(1, √(1000 ms / t)).',
    gleichstrom: 'Gleichstrom wird im Zonenmodell nicht gerechnet; bei Gleichstrom gilt: Fachkraft, Abstand, Notruf.',
    prueftaste: 'Die Prüftaste prüft nur die Auslösefunktion des RCD, nicht den Schutzleiter und nicht den Erdungswiderstand.',
    zusatzErsetztNicht: 'Der Zusatzschutz ersetzt den Schutzleiter nicht.',
    rcdVerkuerzt: 'Der Zusatzschutz verkürzt die Einwirkzeit; er macht die Berührung nicht ungefährlich.',
    faustwert: 'Lehrfaustwert, kein Normwert.',
    herstellerMassgeblich: 'Herstellerkennlinie maßgeblich.',
    keineZahl: 'Das ist keine Zahl. Gib eine Zahl ein, auch mit Einheit (zum Beispiel 0,3 Ω oder 30 mA).',
    eingabe: 'Mit diesen Werten gibt es kein Ergebnis.',
    tnCBegriff: 'TN-C ist hier nur ein Begriff (PEN-Leiter durchgehend) und wird nicht gerechnet (F18).',
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
  api.TEXTS = TEXTS;

  /* =============================== 4.1 Körper (body) =============================== */
  const RK = L('rk').extra, ZON = L('zonen').extra;
  const HAUT = ['trocken', 'feucht', 'nass', 'rechen'];
  function bodyCfg(cfg) {
    cfg = obj(cfg);
    const haut = cfg.haut === undefined || cfg.haut === null ? 'nass' : String(cfg.haut);
    if (HAUT.indexOf(haut) < 0) V('Unbekannter Hautzustand: erlaubt sind trocken, feucht, nass.');
    const pfad = cfg.pfad === undefined || cfg.pfad === null ? 'hand-fuss' : String(cfg.pfad);
    if (RK.pfad[pfad] === undefined) V('Unbekannter Strompfad: erlaubt sind hand-fuss, hand-hand, hand-rumpf.');
    const rv = optNn(cfg.rv, 0, 'Der Übergangswiderstand', 1e7);
    const rk = RK[haut] * RK.pfad[pfad];
    return { haut: haut, pfad: pfad, rk: rk, rv: rv, rges: rk + rv };
  }
  const body = {};
  body.resistance = S(function (cfg) {
    const b = bodyCfg(cfg);
    return { ok: true, rk: b.rk, rv: b.rv, rges: b.rges, haut: b.haut, pfad: b.pfad, status: 'A', frage: 'F11', text: TEXTS.rkRechenwert };
  });
  body.current = C(function (U, cfg) {
    const u = num(U, NaN);
    if (!(u >= 0) || u > 1e6) return NaN;
    return u / bodyCfg(cfg).rges;
  });
  function iFl(tMs) { return ZON.ifl * Math.max(1, Math.sqrt(ZON.tRef / tMs)); }
  const ZN = [
    { id: 'Z1', name: 'kaum wahrnehmbar', text: 'Zone 1: Der Strom ist kaum wahrnehmbar.' },
    { id: 'Z2', name: 'spürbar, Loslassen möglich', text: 'Zone 2: Der Strom ist spürbar, du kannst loslassen.' },
    { id: 'Z3', name: 'Muskelverkrampfung, Loslassen nicht möglich', text: 'Zone 3: Muskelverkrampfung, Loslassen nicht möglich, Atembeschwerden möglich.' },
    { id: 'Z4', name: 'Herzkammerflimmern möglich', text: 'Zone 4: Herzkammerflimmern ist möglich. Das ist lebensgefährlich.' }
  ];
  body.zone = S(function (I, tMs, art) {
    if (art !== undefined && art !== null && /^(dc|gleich|gleichstrom)$/i.test(String(art))) return fail(TEXTS.gleichstrom, { valid: false });
    const i = num(I, NaN), t = num(tMs, NaN);
    if (!(i >= 0) || i > 1e6) V('Der Strom muss eine Zahl größer oder gleich 0 sein.');
    if (!(t > 0) || t > 1e7) V('Die Einwirkdauer muss größer als 0 ms sein.');
    const fl = iFl(t);
    let z = 4;
    if (i <= ZON.z1) z = 1; else if (i <= ZON.z2) z = 2; else if (i <= fl) z = 3;
    const o = { ok: true, zone: z, id: ZN[z - 1].id, name: ZN[z - 1].name, text: ZN[z - 1].text, margin: fl - i, iFl: fl, I: i, tMs: t };
    return o;
  });
  body.zoneCurve = guard(function (tMs) {
    function one(t) {
      t = num(t, NaN);
      if (!(t > 0) || t > 1e7) return fail('Die Einwirkdauer muss größer als 0 ms sein.');
      return { ok: true, t: t, z1: ZON.z1, z2: ZON.z2, flimmer: iFl(t) };
    }
    if (isArr(tMs)) return tMs.map(one);
    return one(tMs);
  }, function () { return fail('Die Einwirkdauer muss größer als 0 ms sein.'); });
  body.touch = S(function (cfg) {
    const c = obj(cfg);
    if (c.dc === true || /^(dc|gleich)$/i.test(String(c.art || ''))) return fail(TEXTS.gleichstrom, { valid: false });
    const U = c.U === undefined || c.U === null ? U0N : reqNn(c.U, 'Die Spannung', 1e6);
    const b = bodyCfg(c);
    const tMs = c.tMs === undefined || c.tMs === null ? 1000 : reqPos(c.tMs, 'Die Einwirkdauer', 1e7);
    const I = U / b.rges;
    const z = body.zone(I, tMs);
    const o = { ok: true, U: U, U_B: U, uB: U, I_K: I, iK: I, R_ges: b.rges, rges: b.rges, rk: b.rk, rv: b.rv, zone: z.zone, zoneInfo: z, tMs: tMs, tOK: U <= UL + 1e-9, hinweis: '' };
    if (b.haut !== 'trocken' && U <= UL + 1e-9) o.hinweis = TEXTS.ulTrocken;
    return o;
  });
  api.body = body;

  /* =============================== 4.3 Schutzorgane (prot) =============================== */
  const BCD = L('ls_bcd').extra, TH = L('ls_thermisch').extra;
  const SERIES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63];
  const DEVS = [
    { id: 'LS-B', name: 'Leitungsschutzschalter Typ B', art: 'ls', typ: 'B', lo: BCD.B[0], hi: BCD.B[1] },
    { id: 'LS-C', name: 'Leitungsschutzschalter Typ C', art: 'ls', typ: 'C', lo: BCD.C[0], hi: BCD.C[1] },
    { id: 'LS-D', name: 'Leitungsschutzschalter Typ D', art: 'ls', typ: 'D', lo: BCD.D[0], hi: BCD.D[1] },
    { id: 'gG', name: 'Schmelzsicherung gG', art: 'sicherung', typ: 'gG', lo: null, hi: null }
  ];
  const GG_NICHT = 1.25, GG_K = 0.4 * (25 - GG_NICHT * GG_NICHT); /* Lehrmodell F8: 0,4 s bei 5 · In */
  function devOf(dev) {
    const id = String(dev);
    for (let i = 0; i < DEVS.length; i++) if (DEVS[i].id === id) return DEVS[i];
    V('Unbekanntes Schutzorgan: erlaubt sind LS-B, LS-C, LS-D und gG.');
  }
  function inOf(In) {
    const x = num(In, NaN);
    if (SERIES.indexOf(x) < 0) V('Der Nennstrom muss aus der Reihe 6, 10, 13, 16, 20, 25, 32, 40, 50, 63 A sein.');
    return x;
  }
  function ggT(x) { return GG_K / (x * x - GG_NICHT * GG_NICHT); }
  function thermMax(x) { return TH.tAus * (TH.aus * TH.aus - 1) / (x * x - 1); }
  function thermMin(x) { return TH.tAus * (TH.nicht * TH.nicht - 1) / (x * x - 1); }
  function iaOf(d, In, tG) {
    if (d.art === 'ls') return d.hi * In;
    const t = tG === undefined || tG === null ? L('tab_033').value : reqPos(tG, 'Die Abschaltzeit', 1e5);
    return In * Math.sqrt(GG_NICHT * GG_NICHT + GG_K / t);
  }
  const prot = {};
  prot.devices = DEVS.map(function (d) { return Object.freeze(Object.assign({}, d)); });
  prot.series = SERIES.slice();
  prot.ia = C(function (dev, In, tG) { return iaOf(devOf(dev), inOf(In), tG); });
  function tripCalc(d, In, I) {
    const x = I / In;
    const o = { ok: true, dev: d.id, In: In, I: I, x: x, bereich: 'nicht', tMin: Infinity, tMax: Infinity, text: '' };
    if (d.art === 'ls') {
      if (x < TH.nicht) { o.text = 'Bei ' + fmtEng(I, 'A') + ' löst der ' + d.id + ' nicht aus (unter ' + fmt(TH.nicht) + ' · In).'; return o; }
      if (x < d.lo) {
        o.bereich = 'thermisch'; o.tMin = thermMin(x); o.tMax = thermMax(x);
        o.text = 'Thermischer Bereich: Auslösung nach ' + fmtEng(o.tMin, 's') + ' bis ' + fmtEng(o.tMax, 's') + ' (Lehrmodell).';
        return o;
      }
      if (x < d.hi) {
        o.bereich = 'unsicher'; o.tMin = BCD.tMagMin; o.tMax = x < TH.aus ? Infinity : thermMax(x);
        o.text = 'Unsicherer Bereich zwischen ' + fmt(d.lo) + ' und ' + fmt(d.hi) + ' · In: Der ' + d.id + ' kann auslösen, die Auslösung ist nicht garantiert.';
        return o;
      }
      o.bereich = 'sicher'; o.tMin = BCD.tMagMin; o.tMax = BCD.tMagMax;
      o.text = 'Magnetischer Bereich: Der ' + d.id + ' löst sicher aus, höchstens nach ' + fmtEng(o.tMax, 's') + '.';
      return o;
    }
    /* gG */
    if (x <= GG_NICHT) { o.text = 'Bei ' + fmtEng(I, 'A') + ' schmilzt die Sicherung nicht (unter ' + fmt(GG_NICHT) + ' · In, Lehrmodell).'; return o; }
    o.tMax = ggT(x); o.tMin = o.tMax / 2;
    o.bereich = o.tMax <= L('tab_033').value + 1e-12 ? 'sicher' : 'thermisch';
    o.text = 'Schmelzzeit ' + fmtEng(o.tMin, 's') + ' bis ' + fmtEng(o.tMax, 's') + ' (Lehrmodell, ' + TEXTS.herstellerMassgeblich + ')';
    return o;
  }
  prot.trip = S(function (dev, In, I) {
    const d = devOf(dev), n = inOf(In), i = num(I, NaN);
    if (!(i >= 0) || i > 1e7) V('Der Strom muss eine Zahl größer oder gleich 0 sein.');
    return tripCalc(d, n, i);
  });
  prot.curve = A(function (dev, In) {
    const d = devOf(dev), n = inOf(In);
    const out = [];
    function push(x, xs) {
      const t = tripCalc(d, n, (xs === undefined ? x : xs) * n);
      if (t.bereich === 'nicht' || !isFinite(t.tMin)) return;
      out.push([x, t.tMin, isFinite(t.tMax) ? t.tMax : null]);
    }
    function span(x0, x1, k) { for (let j = 0; j <= k; j++) push(x0 * Math.pow(x1 / x0, j / k)); }
    if (d.art === 'ls') {
      span(TH.nicht, d.lo * (1 - 1e-9), 30);
      push(d.lo, d.lo * (1 - 1e-9)); push(d.lo);
      span(d.lo * 1.0001, d.hi * (1 - 1e-9), 12);
      push(d.hi, d.hi * (1 - 1e-9)); push(d.hi);
      span(d.hi * 1.0001, d.hi * 3, 8);
    } else span(1.3, 100, 40);
    return out;
  });
  const CABLE = { 1.5: 16, 2.5: 20, 4: 27, 6: 34 };
  prot.cable = S(function (q) {
    const x = num(q, NaN);
    if (CABLE[x] === undefined) V('Für diesen Querschnitt gibt es keinen Übungswert (erlaubt: 1,5; 2,5; 4; 6 mm²).');
    return { ok: true, q: x, iz: CABLE[x], status: 'A', frage: 'F21', text: 'Übungswert Kupfer, Verlegeart B2 (Übungstabelle, Tabellenbuch maßgeblich).' };
  });
  prot.check = S(function (Ib, In, Iz) {
    const ib = reqNn(Ib, 'Der Betriebsstrom', 1e6), n = reqPos(In, 'Der Nennstrom', 1e6), iz = reqPos(Iz, 'Die Strombelastbarkeit', 1e6);
    const ibOk = ib <= n + 1e-12, izOk = n <= iz + 1e-12;
    const t = [];
    if (!ibOk) t.push('Ib = ' + fmtEng(ib, 'A') + ' ist größer als In = ' + fmtEng(n, 'A') + ': Das Schutzorgan würde im Betrieb auslösen.');
    if (!izOk) t.push('In = ' + fmtEng(n, 'A') + ' ist größer als Iz = ' + fmtEng(iz, 'A') + ': Die Leitung wäre bei Überlast nicht geschützt.');
    const ok = ibOk && izOk;
    return { ok: ok, ibOk: ibOk, izOk: izOk, text: ok ? 'Ib ≤ In ≤ Iz ist erfüllt (' + fmtEng(ib, 'A') + ' ≤ ' + fmtEng(n, 'A') + ' ≤ ' + fmtEng(iz, 'A') + ').' : t.join(' ') };
  });
  /* normalisiert die Leitungsdaten fuer grid und prot */
  function lineCfg(cfg) {
    cfg = obj(cfg);
    const q = optPos(cfg.q, 2.5, 'Der Querschnitt', 1000);
    return {
      U0: optPos(cfg.U0, U0N, 'Die Spannung', 1000),
      zv: optNn(cfg.zv, ZV_DEF, 'Die Netzimpedanz', 1000),
      q: q, qpe: optPos(cfg.qpe, q, 'Der Schutzleiterquerschnitt', 1000),
      l: optPos(cfg.l, 20, 'Die Leitungslänge', 1e5),
      rho: optPos(cfg.rho, RHO_NEU, 'Der spezifische Widerstand', 0.1),
      rf: optNn(cfg.rf, 0, 'Der Fehlerübergangswiderstand', 1e6)
    };
  }
  prot.shortCircuit = S(function (cfg) {
    const c = lineCfg(cfg);
    const z = c.zv + 2 * c.rho * c.l / c.q;
    const ik = c.U0 / z;
    return { ok: true, zLN: z, ik: ik, text: 'Kurzschlussstrom ' + fmtEng(ik, 'A') + ' bei Schleifenimpedanz L–N ' + fmt(z, 3) + ' Ω; das Ausschaltvermögen des Schutzorgans muss dazu passen (Datenblatt, Norm maßgeblich).' };
  });
  prot.inrush = S(function (dev, In, ein) {
    const d = devOf(dev), n = inOf(In), e = reqPos(ein, 'Das Einschaltstrom-Vielfache', 1e4);
    const t = tripCalc(d, n, e * n);
    let aus = 'nein', txt;
    if (t.bereich === 'sicher') { aus = 'ja'; txt = 'Der Einschaltstrom von ' + fmtEng(e * n, 'A') + ' liegt im magnetischen Bereich: ' + d.id + ' löst aus.'; }
    else if (t.bereich === 'unsicher') { aus = 'moeglich'; txt = 'Der Einschaltstrom von ' + fmtEng(e * n, 'A') + ' liegt im unsicheren Bereich: ' + d.id + ' kann auslösen.'; }
    else txt = 'Der Einschaltstrom von ' + fmtEng(e * n, 'A') + ' liegt unter dem magnetischen Bereich: ' + d.id + ' löst dadurch nicht aus.';
    return { ok: true, bereich: t.bereich, ausloesung: aus, I: e * n, text: txt };
  });
  api.prot = prot;

  /* =============================== 4.2 Netzformen und Fehlerschleife (grid) =============================== */
  const grid = {};
  grid.forms = [
    { id: 'TN-S', name: 'TN-S-System', text: 'Neutralleiter N und Schutzleiter PE sind im ganzen Netz getrennt.', simuliert: true, pe: 'getrennt' },
    { id: 'TN-C-S', name: 'TN-C-S-System', text: 'Im Netz gemeinsamer PEN-Leiter, ab der Aufteilung getrennt in N und PE; der PEN-Teil steckt in der Netzimpedanz.', simuliert: true, pe: 'aufgeteilt' },
    { id: 'TT', name: 'TT-System', text: 'Das Netz ist am Betriebserder geerdet, die Körper der Anlage haben einen eigenen Anlagenerder.', simuliert: true, pe: 'eigener Erder' },
    { id: 'IT', name: 'IT-System', text: 'Das Netz ist von Erde isoliert (oder über eine hohe Impedanz verbunden), die Körper sind geerdet; der erste Fehler schaltet nicht ab, er wird gemeldet.', simuliert: true, pe: 'Körper geerdet' },
    { id: 'TN-C', name: 'TN-C-System', text: 'Nur ein Begriff: ein durchgehender PEN-Leiter übernimmt die Aufgabe von N und PE.', simuliert: false, begriff: true, pe: 'PEN' }
  ];
  grid.letters = { T: 'terre: direkte Erdung', N: 'neutre: Körper mit dem geerdeten Netzpunkt (Neutralleiter) verbunden', I: 'isolé: von Erde isoliert', S: 'séparé: Neutralleiter und Schutzleiter getrennt', C: 'combiné: kombiniert zum PEN-Leiter' };
  const FORMS = ['TN-S', 'TN-C-S', 'TT', 'IT'];
  const RCD_IDN = [10, 30, 100, 300, 500];
  const RCD_TYPES = ['AC', 'A', 'F', 'B'];
  function gridCfg(cfg) {
    cfg = obj(cfg);
    const form = cfg.form === undefined || cfg.form === null ? 'TN-S' : String(cfg.form);
    if (form === 'TN-C') V(TEXTS.tnCBegriff);
    if (FORMS.indexOf(form) < 0) V('Unbekannte Netzform: erlaubt sind TN-S, TN-C-S, TT und IT.');
    const c = lineCfg(cfg);
    c.form = form;
    c.dev = cfg.dev === undefined || cfg.dev === null ? 'LS-B' : String(cfg.dev);
    devOf(c.dev);
    c.In = cfg.In === undefined || cfg.In === null ? 16 : inOf(cfg.In);
    c.kreis = cfg.kreis === undefined || cfg.kreis === null ? 'end' : String(cfg.kreis);
    if (c.kreis !== 'end' && c.kreis !== 'verteil') V('Die Stromkreisart muss end oder verteil sein.');
    c.ra = optNn(cfg.ra, 0, 'Der Erdungswiderstand R_A', 1e6);
    c.rb = optNn(cfg.rb, 0, 'Der Erdungswiderstand R_B', 1e6);
    c.cleck = optNn(cfg.cleck, 0, 'Die Leitungskapazität', 1e9);
    const r = obj(cfg.rcd);
    c.rcd = { on: r.on === true, idn: r.idn === undefined || r.idn === null ? 30 : num(r.idn, NaN), type: r.type === undefined || r.type === null ? 'A' : String(r.type) };
    if (RCD_IDN.indexOf(c.rcd.idn) < 0) V('Der Nennfehlerstrom muss 10, 30, 100, 300 oder 500 mA sein.');
    if (RCD_TYPES.indexOf(c.rcd.type) < 0) V('Der RCD-Typ muss AC, A, F oder B sein.');
    c.fehler = cfg.fehler === undefined || cfg.fehler === null ? 'koerperschluss' : String(cfg.fehler);
    if (['koerperschluss', 'pe-unterbrochen', 'ohne'].indexOf(c.fehler) < 0) V('Unbekannter Fehler: erlaubt sind koerperschluss, pe-unterbrochen und ohne.');
    c.zweiterFehler = cfg.zweiterFehler === true;
    c.body = { haut: cfg.haut, pfad: cfg.pfad, rv: cfg.rv };
    if (form === 'TT' && !(c.ra > 0)) V('Im TT-System fehlt der Erdungswiderstand R_A (muss größer als 0 sein).');
    return c;
  }
  function loopOf(c) {
    const rl = c.rho * c.l / c.q, rpe = c.rho * c.l / c.qpe;
    const o = { ok: true, form: c.form, rl: rl, rpe: rpe, zv: c.zv, rf: c.rf, rho: c.rho, ra: c.ra, rb: c.rb };
    if (c.form === 'TT') {
      o.zs = c.ra + c.rb + rl + rpe + c.rf;
      o.hinweis = 'TT: Fehlerschleife über Anlagenerder R_A und Betriebserder R_B.';
    } else if (c.form === 'IT') {
      o.zs = c.zv + rl + rpe + c.rf;
      o.hinweis = 'IT: Die Schleife gilt für den zweiten Fehler (Lehrmodell, wie TN).';
    } else {
      o.zs = c.zv + rl + rpe + c.rf;
      o.hinweis = c.form === 'TN-C-S' ? 'TN-C-S: Der PEN-Teil des Netzes steckt in der Netzimpedanz Zv.' : 'TN-S: Zs = Zv + R_L + R_PE.';
    }
    return o;
  }
  grid.loop = S(function (cfg) { return loopOf(gridCfg(cfg)); });
  function zsMaxOf(c) { return c.U0 / iaOf(devOf(c.dev), c.In, c.kreis === 'verteil' ? L('tab_5').value : L('tab_033').value); }
  grid.zsMax = C(function (dev, In, cfg) {
    const d = devOf(dev), n = inOf(In), c = obj(cfg);
    const U0 = optPos(c.U0, U0N, 'Die Spannung', 1000);
    const tG = c.kreis === 'verteil' ? L('tab_5').value : L('tab_033').value;
    return U0 / iaOf(d, n, tG);
  });
  grid.raMax = C(function (idn) { const x = num(idn, NaN); if (!(x > 0) || x > 1e6) return NaN; return UL / (x / 1000); });
  grid.maxLength = S(function (cfg) {
    const c = gridCfg(cfg);
    if (c.form === 'TT') V('Die größte Leitungslänge aus der Abschaltbedingung gilt nur für TN (und den zweiten Fehler im IT-System).');
    const zm = zsMaxOf(c);
    const k = c.rho * (1 / c.q + 1 / c.qpe);
    const frei = zm - c.zv - c.rf;
    const lMax = frei > 0 ? frei / k : 0;
    return { ok: true, lMax: lMax, zsMax: zm, frei: frei, valid: frei > 0, text: frei > 0 ? 'Bis ' + fmt(lMax, 1) + ' m bleibt Zs höchstens ' + fmt(zm, 3) + ' Ω.' : 'Schon die Netzimpedanz ' + fmt(c.zv + c.rf, 3) + ' Ω überschreitet Zs_max = ' + fmt(zm, 3) + ' Ω: Mit diesem Schutzorgan ist keine Leitungslänge zulässig.' };
  });
  function tripRcd(c, iMa, shape) { return rcd.trip({ idn: c.rcd.idn, type: c.rcd.type, on: c.rcd.on }, shape || 'sinus', iMa); }
  function personOf(c, U) {
    const b = bodyCfg(c.body);
    const iK = U / b.rges;
    return { iK: iK, rges: b.rges, zone: body.zone(iK, 1000) };
  }
  grid.fault = S(function (cfg) {
    const c = gridCfg(cfg);
    const lp = loopOf(c);
    const tG = c.kreis === 'verteil' ? L('tab_5') : L('tab_033');
    const o = { ok: true, form: c.form, fehler: c.fehler, zs: lp.zs, rl: lp.rl, rpe: lp.rpe, iF: 0, uB: 0, ia: iaOf(devOf(c.dev), c.In, tG.value), zsMax: NaN, reserve: NaN, bedingung: null, tAb: null, grenze: tG.value, tOK: null, ausgeloest: false, ausloeser: null, bereich: 'nicht', rcd: null, iK: 0, zusatz: false, meldung: '', text: '', warn: [] };
    o.zsMax = c.U0 / o.ia;
    const tn = c.form === 'TN-S' || c.form === 'TN-C-S' || (c.form === 'IT' && c.zweiterFehler);
    if (c.fehler === 'ohne') { o.text = 'Kein Fehler: Es fließt kein Fehlerstrom.'; o.reserve = tn ? o.zsMax / lp.zs : NaN; return o; }
    if (c.fehler === 'pe-unterbrochen') {
      o.zs = Infinity; o.iF = 0; o.uB = c.U0; o.bereich = 'nicht'; o.bedingung = false;
      const p = personOf(c, c.U0); o.iK = p.iK; o.person = p;
      o.warn.push('Der Schutzleiter ist unterbrochen: Der Leitungsschutz löst nicht aus, das Gehäuse führt Spannung (ungünstigster Fall U_B = ' + fmt(c.U0) + ' V).');
      if (c.rcd.on) {
        const r = tripRcd(c, p.iK * 1000);
        o.rcd = r;
        if (r.tripped) { o.zusatz = true; o.ausgeloest = true; o.ausloeser = 'rcd'; o.tAb = r.tTrip; o.warn.push('Der RCD löst erst durch den Strom über den Menschen aus (' + fmtEng(p.iK, 'A') + ' ≥ IΔn). ' + TEXTS.zusatzErsetztNicht); }
        else o.warn.push('Auch der RCD löst nicht sicher aus: Der Körperstrom ' + fmtEng(p.iK, 'A') + ' liegt nicht über IΔn.');
      }
      o.text = o.warn.join(' ');
      return o;
    }
    /* Körperschluss */
    if (c.form === 'IT' && !c.zweiterFehler) {
      const i1 = c.U0 * TWO_PI * FN * c.cleck * 1e-9;
      o.iF = i1; o.zs = NaN; o.zsMax = NaN; o.ia = NaN; o.uB = i1 * (c.ra > 0 ? c.ra : lp.rpe);
      o.meldung = 'Isolationsüberwachung meldet den ersten Fehler; es erfolgt keine Abschaltung.';
      o.text = 'Erster Fehler im IT-System: I_F1 = ' + fmtEng(i1, 'A') + ' (Lehrmodell), keine Abschaltung, die Isolationsüberwachung meldet. Ein zweiter Fehler würde wie im TN-System abschalten.';
      return o;
    }
    if (c.form === 'TT') {
      const rs = lp.zs;
      o.iF = c.U0 / rs; o.uB = o.iF * c.ra; o.ia = NaN; o.zsMax = NaN;
      const ra = grid.tt(cfg);
      o.raMax = ra.ok ? ra.raMax : NaN; o.bedingung = c.rcd.on ? c.ra <= o.raMax + 1e-9 : false;
      const t = tripCalc(devOf(c.dev), c.In, o.iF);
      o.bereich = t.bereich;
      let tA = t.bereich === 'sicher' ? t.tMax : null;
      if (tA !== null) { o.ausgeloest = true; o.ausloeser = 'ls'; o.tAb = tA; }
      if (c.rcd.on) {
        const r = tripRcd(c, o.iF * 1000); o.rcd = r;
        if (r.tripped && (tA === null || r.tTrip < tA)) { o.ausgeloest = true; o.ausloeser = 'rcd'; o.tAb = r.tTrip; }
      }
      o.tOK = null;
      if (!o.ausgeloest) o.warn.push('Im TT-System löst der Leitungsschutz bei ' + fmtEng(o.iF, 'A') + ' nicht sicher aus' + (c.rcd.on ? ', und der RCD löst nicht aus.' : '; ohne RCD gibt es keine sichere Abschaltung.'));
      o.text = 'TT: I_F = ' + fmtEng(o.iF, 'A') + ', U_B = ' + fmt(o.uB, 1) + ' V' + (c.rcd.on ? ', R_A ' + (o.bedingung ? '≤' : '>') + ' R_A,max = ' + fmt(o.raMax, 1) + ' Ω.' : '.') + (o.warn.length ? ' ' + o.warn.join(' ') : '');
      return o;
    }
    /* TN (und zweiter Fehler im IT) */
    o.iF = c.U0 / lp.zs; o.uB = o.iF * lp.rpe;
    o.reserve = o.zsMax / lp.zs;
    o.bedingung = lp.zs <= o.zsMax * (1 + 1e-12);
    const t = tripCalc(devOf(c.dev), c.In, o.iF);
    o.bereich = t.bereich; o.trip = t;
    if (isFinite(t.tMax) && t.bereich !== 'nicht') { o.tAb = t.tMax; o.ausgeloest = true; o.ausloeser = 'ls'; }
    if (c.rcd.on) {
      const r = tripRcd(c, o.iF * 1000); o.rcd = r;
      if (r.tripped && (o.tAb === null || r.tTrip < o.tAb)) { o.tAb = r.tTrip; o.ausgeloest = true; o.ausloeser = 'rcd'; }
    }
    o.tOK = o.tAb !== null && o.tAb <= tG.value + 1e-12 && (o.bedingung || o.ausloeser === 'rcd');
    if (!o.bedingung) o.warn.push('Zs = ' + fmt(lp.zs, 4) + ' Ω ist größer als Zs_max = ' + fmt(o.zsMax, 4) + ' Ω: Die Auslösung des Leitungsschutzes ist nicht sicher.');
    o.text = 'Fehlerstrom I_F = ' + fmtEng(o.iF, 'A') + ', Berührungsspannung U_B = ' + fmt(o.uB, 1) + ' V' + (o.uB > UL ? ' (über ' + fmt(UL) + ' V)' : '') + '. ' + (o.warn.length ? o.warn.join(' ') : 'Abschaltbedingung Zs ≤ U0 / Ia ist erfüllt (' + fmt(lp.zs, 4) + ' Ω ≤ ' + fmt(o.zsMax, 4) + ' Ω).');
    return o;
  });
  grid.condition = S(function (cfg) {
    const c = obj(cfg);
    const f = grid.fault(Object.assign({}, c, { fehler: 'koerperschluss' }));
    if (!f.ok) return f;
    const o = { ok: true, form: f.form, erfuellt: null, zs: f.zs, zsMax: f.zsMax, text: '' };
    if (f.form === 'IT' && f.meldung) { o.text = f.text + ' Eine Abschaltbedingung für den ersten Fehler ist im Lab nicht festgelegt (F5).'; return o; }
    if (f.form === 'TT') { o.erfuellt = f.bedingung; o.raMax = f.raMax; o.text = f.rcd ? 'TT-Bedingung R_A ≤ U_L / IΔn: ' + fmt(grid.tt(cfg).ra, 1) + ' Ω ' + (f.bedingung ? '≤' : '>') + ' ' + fmt(f.raMax, 1) + ' Ω.' : 'Im TT-System ohne RCD gibt es keine sichere Abschaltung.'; return o; }
    o.erfuellt = f.bedingung; o.tAb = f.tAb; o.tOK = f.tOK; o.reserve = f.reserve;
    o.text = 'Zs = ' + fmt(f.zs, 4) + ' Ω ' + (f.bedingung ? '≤' : '>') + ' Zs_max = ' + fmt(f.zsMax, 4) + ' Ω: Abschaltbedingung ' + (f.bedingung ? 'erfüllt.' : 'nicht erfüllt.');
    return o;
  });
  grid.tt = S(function (cfg) {
    const c = gridCfg(Object.assign({}, obj(cfg), { form: 'TT' }));
    const raMax = UL / (c.rcd.idn / 1000);
    return { ok: true, ra: c.ra, idn: c.rcd.idn, raMax: raMax, erfuellt: c.ra <= raMax * (1 + 1e-12), text: 'R_A ≤ U_L / IΔn = ' + fmt(UL) + ' V / ' + fmt(c.rcd.idn) + ' mA = ' + fmt(raMax, 1) + ' Ω; ' + TEXTS.ulTrocken };
  });
  grid.it = S(function (cfg) {
    const c = gridCfg(Object.assign({}, obj(cfg), { form: 'IT' }));
    const lp = loopOf(c);
    const i1 = c.U0 * TWO_PI * FN * c.cleck * 1e-9;
    const uB = i1 * (c.ra > 0 ? c.ra : lp.rpe);
    return { ok: true, iF1: i1, uB: uB, abschaltung: false, meldung: true, zs2: lp.zs, text: 'Erster Fehler: I_F1 = ' + fmtEng(i1, 'A') + ' (Lehrmodell), keine Abschaltung, Meldung durch die Isolationsüberwachung; zweiter Fehler: Schleife wie TN, Abschaltung durch das Schutzorgan.' };
  });
  api.grid = grid;

  /* =============================== 4.4 RCD (rcd) =============================== */
  const RZ = L('rcd_zeit').extra, RB = L('rcd_bereich').extra;
  const rcd = {};
  rcd.types = [
    { id: 'AC', name: 'Typ AC', shapes: ['sinus'], text: 'erkennt sinusförmige Differenzströme' },
    { id: 'A', name: 'Typ A', shapes: ['sinus', 'puls'], text: 'erkennt zusätzlich pulsierende Gleichfehlerströme' },
    { id: 'F', name: 'Typ F', shapes: ['sinus', 'puls', 'mix'], text: 'erkennt zusätzlich Frequenzgemische' },
    { id: 'B', name: 'Typ B', shapes: ['sinus', 'puls', 'mix', 'gleich'], text: 'erkennt zusätzlich glatte Gleichfehlerströme (allstromsensitiv)' }
  ];
  rcd.idnList = RCD_IDN.slice();
  rcd.shapes = ['sinus', 'puls', 'gleich', 'mix'];
  function rcdCfg(cfg) {
    cfg = obj(cfg);
    const idn = num(cfg.idn, NaN);
    if (RCD_IDN.indexOf(idn) < 0) V('Der Nennfehlerstrom muss 10, 30, 100, 300 oder 500 mA sein.');
    const type = cfg.type === undefined || cfg.type === null ? 'A' : String(cfg.type);
    if (RCD_TYPES.indexOf(type) < 0) V('Der RCD-Typ muss AC, A, F oder B sein.');
    return { idn: idn, type: type, on: cfg.on === undefined ? true : cfg.on === true, defekt: cfg.defekt === true };
  }
  function tripTime(m) {
    if (m >= RZ.vielfach) return RZ.t5;
    return RZ.t1 * Math.pow(RZ.t5 / RZ.t1, Math.log(m) / Math.log(RZ.vielfach));
  }
  rcd.trip = S(function (cfg, shape, iDiff) {
    const c = rcdCfg(cfg);
    const sh = String(shape);
    if (rcd.shapes.indexOf(sh) < 0) V('Unbekannte Stromform: erlaubt sind sinus, puls, gleich und mix.');
    const i = num(iDiff, NaN);
    if (!(i >= 0) || i > 1e7) V('Der Differenzstrom muss eine Zahl größer oder gleich 0 sein.');
    const o = { ok: true, tripped: false, possible: false, blind: false, bereich: 'nicht', tTrip: null, idn: c.idn, type: c.type, shape: sh, iDiff: i, text: '' };
    if (!c.on) { o.text = 'Der RCD ist ausgeschaltet.'; return o; }
    const typ = RCD_TYPES.indexOf(c.type);
    if (rcd.types[typ].shapes.indexOf(sh) < 0) { o.blind = true; o.text = 'Der RCD ' + rcd.types[typ].name + ' ist für diese Stromform blind: Er erkennt den Differenzstrom nicht und löst nicht aus.'; return o; }
    const m = i / c.idn;
    if (m < RB.unten) { o.text = 'Der Differenzstrom ' + fmt(i, 2) + ' mA liegt unter ' + fmt(RB.unten) + ' · IΔn: keine Auslösung.'; return o; }
    if (m < RB.oben) { o.bereich = 'unsicher'; o.possible = true; o.text = 'Der Differenzstrom ' + fmt(i, 2) + ' mA liegt zwischen ' + fmt(RB.unten) + ' und ' + fmt(RB.oben) + ' · IΔn: Der RCD kann auslösen, die Auslösung ist nicht garantiert (Lehrfaustwert).'; return o; }
    o.bereich = 'sicher'; o.tripped = true; o.possible = true; o.tTrip = tripTime(m);
    o.text = 'Der Differenzstrom ' + fmt(i, 2) + ' mA erreicht IΔn = ' + fmt(c.idn) + ' mA: Der RCD löst aus, höchstens nach ' + fmt(o.tTrip * 1000, 0) + ' ms.';
    return o;
  });
  rcd.sum = C(function (list) {
    if (!isArr(list) || !list.length || list.length > 1000) return NaN;
    let s = 0;
    for (let k = 0; k < list.length; k++) {
      const e = list[k];
      if (!isObj(e)) return NaN;
      const i = num(e.i, NaN), p = String(e.phase);
      if (!(i >= 0) || i > 1e9) return NaN;
      if (p === 'L' || p === 'L1' || p === 'L2' || p === 'L3') s += i;
      else if (p === 'N') s -= i;
      else return NaN;
    }
    return Math.abs(s);
  });
  rcd.leakSum = S(function (list, cfg) {
    if (!isArr(list) || !list.length || list.length > 1000) V('Die Liste der Ableitströme darf nicht leer sein.');
    const c = rcdCfg(cfg);
    let s = 0;
    for (let k = 0; k < list.length; k++) {
      const x = isObj(list[k]) ? num(list[k].i, NaN) : num(list[k], NaN);
      if (!(x >= 0) || x > 1e9) V('Jeder Ableitstrom muss eine Zahl größer oder gleich 0 mA sein.');
      s += x;
    }
    const ratio = s / c.idn;
    const faus = ratio >= RB.unten - 1e-12;
    const nahe = !faus && ratio >= 0.3;
    const o = { ok: true, sum: s, ratio: ratio, nahe: nahe, fehlausloesung: faus, idn: c.idn, text: '' };
    if (faus) o.text = 'Die Summe der Ableitströme ' + fmt(s, 2) + ' mA erreicht ' + fmt(ratio, 2) + ' · IΔn (ab ' + fmt(RB.unten) + ' · IΔn): Fehlauslösung möglich (Lehrfaustwert).';
    return o;
  });
  rcd.testButton = S(function (cfg) {
    const c = rcdCfg(cfg);
    const o = { ok: true, tripped: false, prueftSchutzleiter: false, text: '' };
    if (!c.on) o.text = 'Der RCD ist ausgeschaltet: Die Prüftaste zeigt nichts.';
    else if (c.defekt) o.text = 'Der RCD löst nicht aus: Die Auslösefunktion ist defekt.';
    else { o.tripped = true; o.text = 'Der RCD löst aus: Die Auslösefunktion arbeitet.'; }
    o.text += ' ' + TEXTS.prueftaste;
    return o;
  });
  rcd.person = S(function (cfg) {
    const c = obj(cfg);
    const r = rcdCfg(c);
    const U = c.U === undefined || c.U === null ? U0N : reqNn(c.U, 'Die Spannung', 1e6);
    const b = bodyCfg(c);
    const iK = U / b.rges;
    const tr = rcd.trip(r, 'sinus', iK * 1000);
    const o = { ok: true, U: U, iK: iK, iKmA: iK * 1000, rges: b.rges, trip: tr, tAb: tr.tTrip, zoneOhne: body.zone(iK, ZON.tRef), zoneMit: null, verkuerzt: false, text: '' };
    if (tr.tripped) {
      o.zoneMit = body.zone(iK, tr.tTrip * 1000);
      o.verkuerzt = o.zoneMit.zone < o.zoneOhne.zone;
      o.text = 'Körperstrom ' + fmtEng(iK, 'A') + ' ≥ IΔn: ' + tr.text + ' ' + TEXTS.rcdVerkuerzt;
    } else if (tr.possible) o.text = 'Körperstrom ' + fmtEng(iK, 'A') + ': Der RCD kann auslösen, ist aber nicht sicher; ' + TEXTS.rcdVerkuerzt;
    else o.text = 'Körperstrom ' + fmtEng(iK, 'A') + ': ' + tr.text + ' Du bist weiter gefährdet.';
    return o;
  });
  api.rcd = rcd;

  /* =============================== 4.5 Schutzklassen, Schutzmaßnahmen, Schutzart (cls, ip) =============================== */
  const CLS = {
    I: { id: 'I', name: 'Schutzklasse I', merkmal: 'Basisisolierung und Anschluss der Körper an den Schutzleiter (PE).', symbol: 'Schutzleiter-Symbol', zeichen: '⏚', pe: true, beispiel: 'Wasserkocher, Waschmaschine, Heizlüfter', pruefung: ['sicht', 'rpe', 'riso', 'ipe'], ebene: 'fehler' },
    II: { id: 'II', name: 'Schutzklasse II', merkmal: 'Schutzisolierung (verstärkte oder doppelte Isolierung), kein Schutzleiteranschluss.', symbol: 'Doppelquadrat', zeichen: '▣', pe: false, beispiel: 'Bohrmaschine, Haartrockner, Steckernetzteil', pruefung: ['sicht', 'riso', 'ipe'], ebene: 'fehler' },
    III: { id: 'III', name: 'Schutzklasse III', merkmal: 'Betrieb mit Kleinspannung bis 50 V Wechselspannung (SELV), kein Schutzleiter.', symbol: 'römisch III in einer Raute', zeichen: '◇', pe: false, beispiel: 'Spielzeugeisenbahn, Handleuchte mit Schutzkleinspannung', pruefung: ['sicht', 'riso'], ebene: 'basis', hinweisPruefung: 'Für Schutzklasse III gibt es im Lab keinen Isolationsgrenzwert (F2).' }
  };
  function clsId(id) {
    let s = String(id).toUpperCase().replace(/^SK\s*/, '').replace(/^SCHUTZKLASSE\s*/, '').trim();
    if (s === '1') s = 'I'; else if (s === '2') s = 'II'; else if (s === '3') s = 'III';
    if (!CLS[s]) V('Unbekannte Schutzklasse: erlaubt sind I, II und III.');
    return s;
  }
  const cls = {};
  cls.info = S(function (id) {
    const c = CLS[clsId(id)];
    return { ok: true, id: c.id, name: c.name, merkmal: c.merkmal, symbol: c.symbol, zeichen: c.zeichen, pe: c.pe, beispiel: c.beispiel, pruefung: c.pruefung.slice(), ebene: c.ebene, hinweisPruefung: c.hinweisPruefung || '' };
  });
  cls.effect = S(function (id, fault) {
    const k = clsId(id);
    const f = fault === undefined || fault === null ? 'koerperschluss' : String(fault);
    if (f !== 'koerperschluss' && f !== 'ohne') V('Unbekannter Fehler: erlaubt sind koerperschluss und ohne.');
    const o = { ok: true, id: k, fault: f, abschaltung: false, gehaeuseSpannung: false, uBPfad: false, text: '' };
    if (f === 'ohne') { o.text = 'Ohne Fehler ist das Gehäuse in jeder Schutzklasse spannungsfrei.'; return o; }
    if (k === 'I') { o.abschaltung = true; o.uBPfad = true; o.text = 'Schutzklasse I: Beim Körperschluss fließt der Fehlerstrom über den Schutzleiter, das Schutzorgan schaltet nach der Abschaltbedingung ab (Fehlerschutz). Ist der Schutzleiter unwirksam, bleibt das Gehäuse unter Spannung.'; }
    else if (k === 'II') o.text = 'Schutzklasse II: Die Schutzisolierung verhindert, dass ein berührbares Teil Spannung annimmt. Es gibt keinen Schutzleiter und keinen Berührungsspannungspfad am Gehäuse; geprüft wird die Isolierung.';
    else o.text = 'Schutzklasse III: Es treten nur Kleinspannungen bis 50 V Wechselspannung auf, die Spannungsquelle trennt sicher vom Netz.';
    return o;
  });
  const EXTRA = {
    selv: { id: 'SELV', name: 'SELV (Schutzkleinspannung)', geerdet: false, sichereTrennung: true, text: 'SELV: Kleinspannung bis 50 V Wechselspannung, ungeerdet, vom Netz sicher getrennt.' },
    pelv: { id: 'PELV', name: 'PELV (Funktionskleinspannung mit sicherer Trennung)', geerdet: true, sichereTrennung: true, text: 'PELV: Kleinspannung bis 50 V Wechselspannung mit sicherer Trennung vom Netz, aber geerdet.' },
    schutztrennung: { id: 'schutztrennung', name: 'Schutztrennung', geerdet: false, sichereTrennung: true, text: 'Schutztrennung: Ein Trenntransformator speist einen Verbraucher ungeerdet, ein Fehler schließt keinen Stromkreis über Erde.' },
    zusatz: { id: 'zusatz', name: 'Zusatzschutz', geerdet: null, sichereTrennung: false, text: 'Zusatzschutz: RCD mit höchstens ' + fmt(L('idn_zusatz').value) + ' mA, zusätzlich zu Basisschutz und Fehlerschutz.' }
  };
  cls.extra = S(function (kind) {
    const k = String(kind).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(EXTRA, k)) V('Unbekannte Maßnahme: erlaubt sind SELV, PELV, Schutztrennung und Zusatzschutz.');
    return Object.assign({ ok: true }, EXTRA[k]);
  });
  api.cls = cls;

  const IPA = [
    ['kein Schutz gegen feste Fremdkörper und Berühren', 'kein Schutz'],
    ['Fremdkörper über 50 mm (Schutz gegen Berühren mit dem Handrücken)', 'über 50 mm'],
    ['Fremdkörper über 12,5 mm (Schutz gegen Berühren mit dem Finger)', 'über 12,5 mm'],
    ['Fremdkörper über 2,5 mm (Schutz gegen Berühren mit Werkzeug)', 'über 2,5 mm'],
    ['Fremdkörper über 1 mm (Schutz gegen Berühren mit einem Draht)', 'über 1 mm'],
    ['staubgeschützt (Staub dringt nicht schädlich ein)', 'staubgeschützt'],
    ['staubdicht (kein Staub dringt ein)', 'staubdicht']
  ];
  const IPB = [
    'kein Schutz gegen Wasser',
    'senkrecht tropfendes Wasser',
    'tropfendes Wasser bei bis zu 15° geneigtem Gehäuse',
    'Sprühwasser',
    'Spritzwasser',
    'Strahlwasser',
    'starkes Strahlwasser',
    'zeitweiliges Untertauchen',
    'dauerndes Untertauchen'
  ];
  const ip = {};
  ip.table = { a: IPA.map(function (r) { return r[1]; }), b: IPB.slice(), hinweis: 'Tabelle als Übungsdaten, ' + TEXTS.norm, frage: 'F17' };
  function ipOf(a, b) {
    return { ok: true, code: 'IP' + a + b, a: a, b: b, textA: IPA[a][0], textB: IPB[b], text: 'IP' + a + b + ': ' + IPA[a][0] + '; ' + IPB[b] + '. ' + TEXTS.norm };
  }
  ip.decode = S(function (code) {
    if (typeof code !== 'string') V('Die Schutzart muss als Text eingegeben werden, zum Beispiel IP65.');
    const m = code.trim().toUpperCase().match(/^IP\s?([0-9])([0-9])$/);
    if (!m) V('Die Schutzart besteht aus IP und zwei Ziffern, zum Beispiel IP44.');
    const a = Number(m[1]), b = Number(m[2]);
    if (a > 6) V('Die erste Ziffer geht nur von 0 bis 6.');
    if (b > 8) V('Die zweite Ziffer geht nur von 0 bis 8.');
    return ipOf(a, b);
  });
  ip.encode = S(function (a, b) {
    const x = num(a, NaN), y = num(b, NaN);
    if (!(x >= 0 && x <= 6 && x === Math.floor(x))) V('Die erste Ziffer muss eine ganze Zahl von 0 bis 6 sein.');
    if (!(y >= 0 && y <= 8 && y === Math.floor(y))) V('Die zweite Ziffer muss eine ganze Zahl von 0 bis 8 sein.');
    return ipOf(x, y);
  });
  api.ip = ip;

  /* =============================== Glossar (einzige Quelle der Begriffe) =============================== */
  /* [id, Begriff, Genus, Symbol, Einheit, Kategorie, Text] */
  const GL = [
    ['schutzleiter', 'Schutzleiter', 'der', 'PE', '', 'leiter', 'Leiter, der die Körper der Anlage mit dem Erder verbindet und den Fehlerstrom zur Quelle zurückführt.'],
    ['neutralleiter', 'Neutralleiter', 'der', 'N', '', 'leiter', 'Betriebsstromführender Leiter mit etwa Erdpotenzial; er führt den Rückstrom.'],
    ['aussenleiter', 'Außenleiter', 'der', 'L', '', 'leiter', 'Spannungführender Leiter des Netzes (230 V gegen Erde).'],
    ['penleiter', 'PEN-Leiter', 'der', 'PEN', '', 'leiter', 'Gemeinsamer Leiter, der im TN-C-System die Aufgaben von Schutzleiter und Neutralleiter übernimmt.'],
    ['koerperschluss', 'Körperschluss', 'der', '', '', 'fehler', 'Fehlerhafte Verbindung zwischen einem aktiven Leiter und einem Körper (berührbares leitfähiges Teil).'],
    ['basisschutz', 'Basisschutz', 'der', '', '', 'schutz', 'Schutz gegen direktes Berühren aktiver Teile.'],
    ['fehlerschutz', 'Fehlerschutz', 'der', '', '', 'schutz', 'Schutz bei indirektem Berühren, also bei Körperschluss.'],
    ['zusatzschutz', 'Zusatzschutz', 'der', '', '', 'schutz', 'Zusätzlicher Schutz durch einen RCD mit höchstens 30 mA.'],
    ['schutzklasse', 'Schutzklasse', 'die', '', '', 'schutz', 'Einteilung elektrischer Betriebsmittel nach ihrer Schutzvorkehrung gegen elektrischen Schlag (I, II, III).'],
    ['schutzisolierung', 'Schutzisolierung', 'die', '', '', 'schutz', 'Verstärkte oder doppelte Isolierung, die den Fehlerschutz ohne Schutzleiter übernimmt (Schutzklasse II).'],
    ['schutzmassnahme', 'Schutzmaßnahme', 'die', '', '', 'schutz', 'Maßnahme, die Basisschutz, Fehlerschutz oder Zusatzschutz sicherstellt.'],
    ['schutzart', 'Schutzart (IP)', 'die', 'IP', '', 'schutz', 'Schutz eines Gehäuses gegen Fremdkörper und Wasser; erste Ziffer 0 bis 6, zweite Ziffer 0 bis 8.'],
    ['schleifenimpedanz', 'Schleifenimpedanz', 'die', 'Zs', 'Ω', 'netz', 'Widerstand der Fehlerschleife aus Netzimpedanz, Außenleiter und Schutzleiter.'],
    ['netzimpedanz', 'Netzimpedanz', 'die', 'Zv', 'Ω', 'netz', 'Impedanz des Netzes bis zur Einspeisung der Anlage (Übungswert).'],
    ['abschaltbedingung', 'Abschaltbedingung', 'die', '', '', 'netz', 'Bedingung Zs ≤ U0 / Ia: Der Fehlerstrom muss das Schutzorgan sicher in der geforderten Zeit auslösen.'],
    ['abschaltzeit', 'Abschaltzeit', 'die', 't_ab', 's', 'netz', 'Zeit vom Fehlereintritt bis zur Abschaltung.'],
    ['fehlerstrom', 'Fehlerstrom', 'der', 'I_F', 'A', 'netz', 'Strom an der Fehlerstelle (nicht der Differenzstrom des RCD).'],
    ['ausloesestrom', 'Auslösestrom', 'der', 'Ia', 'A', 'netz', 'Strom, bei dem das Schutzorgan in der geforderten Zeit sicher auslöst.'],
    ['beruehrungsspannung', 'Berührungsspannung', 'die', 'U_B', 'V', 'koerper', 'Spannung, die im Fehlerfall zwischen zwei gleichzeitig berührbaren Stellen anliegt, zum Beispiel zwischen Gehäuse und Boden.'],
    ['beruehrungsstrom', 'Berührungsstrom', 'der', 'I_ber', 'mA', 'koerper', 'Strom, der beim Berühren eines Teils durch einen Menschen fließen würde (Prüfgröße).'],
    ['koerperstrom', 'Körperstrom', 'der', 'I_K', 'A', 'koerper', 'Strom, der durch den menschlichen Körper fließt.'],
    ['koerperwiderstand', 'Körperwiderstand', 'der', 'R_K', 'Ω', 'koerper', 'Widerstand des Körpers; hängt von Haut, Strompfad und Spannung ab. Rechenwert in Aufgaben: 1 kΩ.'],
    ['ableitstrom', 'Ableitstrom', 'der', 'I_ab', 'mA', 'messen', 'Strom, der im fehlerfreien Betrieb über Isolierung oder Y-Kondensatoren nach Erde fließt.'],
    ['schutzleiterstrom', 'Schutzleiterstrom', 'der', 'I_pe', 'mA', 'messen', 'Strom, der im Betrieb über den Schutzleiter eines Geräts fließt.'],
    ['isolationswiderstand', 'Isolationswiderstand', 'der', 'R_iso', 'MΩ', 'messen', 'Widerstand der Isolierung; er wird am freigeschalteten, getrennten Prüfling gemessen.'],
    ['schutzleiterwiderstand', 'Schutzleiterwiderstand', 'der', 'R_pe', 'Ω', 'messen', 'Widerstand des Schutzleiterwegs zwischen Netzstecker und berührbarem Teil.'],
    ['rcd', 'Fehlerstrom-Schutzeinrichtung (RCD)', 'die', 'RCD', '', 'schutzorgan', 'Schutzeinrichtung, die auslöst, wenn der Differenzstrom den Nennfehlerstrom erreicht (früher FI genannt).'],
    ['differenzstrom', 'Differenzstrom', 'der', 'IΔ', 'mA', 'schutzorgan', 'Messwert des RCD: Betrag der Summe der Ströme aller aktiven Leiter.'],
    ['nennfehlerstrom', 'Nennfehlerstrom', 'der', 'IΔn', 'mA', 'schutzorgan', 'Bemessungswert des Differenzstroms, bei dem ein RCD auslöst (10, 30, 100, 300, 500 mA).'],
    ['ls', 'Leitungsschutzschalter (LS)', 'der', 'LS', '', 'schutzorgan', 'Schutzorgan mit thermischer und magnetischer Auslösung; Typ B, C oder D.'],
    ['sicherung', 'Sicherung', 'die', 'gG', '', 'schutzorgan', 'Schmelzsicherung; gG schützt Leitungen vor Überlast und Kurzschluss.'],
    ['nennstrom', 'Nennstrom', 'der', 'In', 'A', 'schutzorgan', 'Bemessungsstrom des Schutzorgans.'],
    ['betriebsstrom', 'Betriebsstrom', 'der', 'Ib', 'A', 'schutzorgan', 'Strom, der im Betrieb im Stromkreis fließt.'],
    ['belastbarkeit', 'Strombelastbarkeit', 'die', 'Iz', 'A', 'schutzorgan', 'Strom, den eine Leitung dauernd führen darf.'],
    ['erdungswiderstand', 'Erdungswiderstand', 'der', 'R_A', 'Ω', 'netz', 'Widerstand des Anlagenerders (TT-System).'],
    ['pruefling', 'Prüfling', 'der', '', '', 'pruefung', 'Das zu prüfende Gerät.'],
    ['sichtpruefung', 'Sichtprüfung', 'die', '', '', 'pruefung', 'Erster Schritt der Geräteprüfung: Mängel am Gerät und an der Leitung erkennen.'],
    ['pruefprotokoll', 'Prüfprotokoll', 'das', '', '', 'pruefung', 'Dokument mit Prüfling, Messwerten, Mängeln und Ergebnis. Im Lab ein Übungsprotokoll, kein Prüfnachweis.'],
    ['elektrofachkraft', 'Elektrofachkraft', 'die', '', '', 'arbeitssicherheit', 'Person mit Ausbildung und Erfahrung, die Gefahren der Elektrizität selbst beurteilen kann; Festlegung durch den Betrieb.'],
    ['erstehilfe', 'Erste Hilfe', 'die', '', '', 'arbeitssicherheit', 'Sofortmaßnahmen nach einem Unfall; dieses Lab ersetzt keinen Erste-Hilfe-Kurs.']
  ];
  const glossary = { items: GL.map(function (g) { return { id: g[0], term: g[1], genus: g[2], article: g[2], symbol: g[3], unit: g[4], kat: g[5], text: g[6] }; }) };
  /* alte Begriffe: nur hier erwaehnt, in Lab-Texten steht immer der Lab-Begriff */
  glossary.foreign = [
    { id: 'fi', term: 'FI', genus: 'der', text: 'Alte Bezeichnung für die Fehlerstrom-Schutzeinrichtung. Im Lab steht immer RCD.' },
    { id: 'erdschluss', term: 'Erdschluss', genus: 'der', text: 'Fehlerhafte Verbindung eines Außenleiters mit Erde. Im Lab steht für den Fehler am Gerät der Körperschluss.' }
  ];
  glossary.get = function (idOrTerm) {
    try {
      const k = String(idOrTerm).toLowerCase();
      for (let i = 0; i < glossary.items.length; i++) { const g = glossary.items[i]; if (g.id === k || g.term.toLowerCase() === k) return g; }
      for (let i = 0; i < glossary.foreign.length; i++) { const g = glossary.foreign[i]; if (g.id === k || g.term.toLowerCase() === k) return g; }
    } catch (e) { /* */ }
    return null;
  };
  glossary.list = function () { try { return glossary.items.slice(); } catch (e) { return []; } };
  api.glossary = glossary;

  /* ---------- Hilfen fuer Tests und Teil 2 (elscore-pruef.js) ---------- */
  api.util = { num: num, clamp: clamp, fin: fin, isArr: isArr, isObj: isObj, obj: obj, fail: fail, V: V, reqPos: reqPos, reqNn: reqNn, optPos: optPos, optNn: optNn, C: C, S: S, A: A, L: L, lineCfg: lineCfg, gridCfg: gridCfg, bodyCfg: bodyCfg, loopOf: loopOf, tripCalc: tripCalc, devOf: devOf, inOf: inOf, iaOf: iaOf, tripTime: tripTime, statusTag: statusTag, hide: hide, UL: UL };
  hide(api, 'util', api.util);
  api.extend = function (name, o) { try { api[name] = o; return true; } catch (e) { return false; } };
  hide(api, 'extend', api.extend);
  api.guardAll = true;
  root.ELS_CORE = api;
  if (typeof module !== 'undefined') module.exports = root.ELS_CORE;
})(typeof window !== 'undefined' ? window : globalThis);
