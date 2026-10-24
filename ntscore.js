/* ntscore.js - Netzteil-Lab Kern Teil 1 (NTS_CORE, Version 1.0): Basis, limits, Glossar, TEXTS, Transformator, Gleichrichter und Siebung, Z-Diode, Linearregler
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.NTS_CORE, Node: module.exports / globalThis.NTS_CORE. Vanilla-JS, kein eval.
 * Die Dateien ntscore-sw.js und ntscore-diag.js erweitern DENSELBEN Namensraum (const C = root.NTS_CORE = root.NTS_CORE || {}).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten im Kern: Spannung V, Strom A, Widerstand Ohm, Leistung W, Frequenz Hz, Zeit s. AUSNAHME (SPEC 4.2): Kapazitaeten in rect-Funktionen
 *    (cfg.C, cfg.C2) in uF, weil die Pruefungsaufgaben so rechnen. Anzeige ueber fmtEng (SI-Vorsatz) oder fmt (Dezimalkomma).
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte ohne Felder,
 *    negative oder riesige Zahlen > 1e12) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }.
 *    Zahlen als Strings in cfg werden NICHT stillschweigend akzeptiert (nur parseNum wandelt Text).
 *  - Gueltigkeit: Formeln ausserhalb ihres Bereichs melden valid:false mit text (TEXTS), sie rechnen nie still weiter.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32). Kein Math.random, keine Datumsabfrage.
 *  - Rechenwerte werden nicht gerundet, nur die Anzeige (fmt, fmtEng).
 *  - status: belegt (Pool/Toni) oder A (Uebungswert mit Frage-Nummer F.. in quelle/ntslab/AUSBILDER.md). limits ist die einzige Quelle fuer Zahlen.
 *
 * ===================================================================================================
 * MEILENSTEINE
 *  M1: Basis (guard, util, rng, fmt, fmtEng, parseNum, parseUnit, glossary, TEXTS, limits, limit, limitValue) und lin.loss/eta/fixed/lm317/r2For/dropout/limitT2
 *  M2: trafo.*, rect.*, zener.*
 *
 * ===================================================================================================
 * SCHNITTSTELLEN (Kurzfassung; SPEC 4.0 bis 4.4 ist massgeblich, Abweichungen stehen in quelle/ntslab/ABWEICHUNGEN.md)
 *  NTS_CORE.version, .guard(fn, kind), .util { num, pos, nn, clamp, fin, fail, has, hide }, .rng(seed) -> { next(), normal(), int(lo,hi), pick(arr) }
 *  NTS_CORE.fmt(x, digits)        Dezimalkomma, '–' bei nicht endlich.
 *  NTS_CORE.fmtEng(x, unit, sig)  Zahl mit SI-Vorsatz und Einheit, "4,7 kΩ", "13,6 mA" (sig = gueltige Stellen, Standard 3).
 *  NTS_CORE.parseNum(str)         Zahl oder NaN (Komma/Punkt, Einheitenzusatz toleriert). .parseUnit(str) -> { value, unit, factor, si } (si = value*factor).
 *  NTS_CORE.glossary              Array { key, sym, article, name, alt, unit, digits, explain }; .get(key), .byKey (versteckt).
 *  NTS_CORE.TEXTS                 { diag:{id:{kind,text,fx?,link?}}, get(id, vars), tpl(text, vars), simOnly, ampelHinweis, lernenHinweis, elkoHinweis, datenblatt, uebungswert }.
 *  NTS_CORE.limits                Array { id, value, unit, cmp, status, quelle, frage, text }; .limit(id) -> Eintrag | null; .limitValue(id) -> Zahl | NaN.
 *  trafo.ratio(cfg) ; .load(cfg) ; .dc(cfg) ; .ri(Uleer, Uklemme, I)
 *  rect.fp(topo, f) ; .nD(topo) ; .peak(cfg) ; .ripple(cfg) ; .cmin(cfg) ; .wave(cfg, nPts) ; .inrush(cfg) ; .rcSieb(cfg) ; .decode(str)
 *  zener.stage(cfg) ; .rvMin(cfg) ; .regulation(cfg)
 *  lin.loss(Uein, Uaus, I, iq?) ; .eta(Uein, Uaus, I, iq?) ; .fixed(cfg) ; .lm317(cfg) ; .r2For(Uaus, R1) ; .dropout(cfg) ; .limitT2(cfg) ; .types
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const C = root.NTS_CORE = root.NTS_CORE || {};
  const PI = Math.PI;
  const BIG = 1e12;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) { return (typeof v === 'number' && isFinite(v)) ? v : d; }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function pos(v) { return typeof v === 'number' && isFinite(v) && v > 0 && v <= BIG; }
  function nn(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && v <= BIG; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  function guard(fn, kind) {
    return function () {
      try { return fn.apply(this, arguments); } catch (e) {
        if (kind === 'struct') return fail('Interner Fehler bei ungültiger Eingabe.');
        if (kind === 'array') return [];
        return NaN;
      }
    };
  }
  const G_ = function (fn) { return guard(fn, 'num'); };     // Rechenfunktion: NaN bei Fehler
  const S_ = function (fn) { return guard(fn, 'struct'); };  // Strukturfunktion: { ok:false, why }
  const A_ = function (fn) { return guard(fn, 'array'); };

  C.version = '1.0';
  C.guard = guard;
  C.util = {
    num: num, pos: pos, nn: nn, fin: fin,
    clamp: function (v, a, b) { try { return clamp(v, a, b); } catch (e) { return NaN; } },
    fail: function (why, extra) { try { return fail(why, extra); } catch (e) { return { ok: false, why: String(why) }; } },
    has: function (o, k) { try { return has(o, k); } catch (e) { return false; } },
    hide: function (o, k, v) { try { hide(o, k, v); return true; } catch (e) { return false; } }
  };

  /* =====================================================================================================
   *  ZAHLEN: Ausgabe und Eingabe
   * ===================================================================================================== */
  /* fmt(x, digits): Dezimalkomma. Ohne digits: bis zu 4 gueltige Stellen. Nicht endlich: '–'. */
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
  C.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };

  /* fmtEng(x, unit, sig): SI-Vorsatz so, dass der Zahlenwert in [1, 1000) liegt; sig gueltige Stellen (Standard 3). Keine Vorsaetze bei % und Grad. */
  const PREF = [[-12, 'p'], [-9, 'n'], [-6, 'µ'], [-3, 'm'], [0, ''], [3, 'k'], [6, 'M'], [9, 'G']];
  const NOPREF = { '%': 1, '°C': 1, '°': 1, 'K': 1, '': 1 };
  function fmtEng(x, unit, sig) {
    x = num(x, NaN);
    unit = typeof unit === 'string' ? unit : '';
    if (!isFinite(x)) return '–';
    const sg = clamp(Math.round(num(sig, 3)), 1, 10);
    const u = unit === '' ? '' : ' ' + unit;
    if (x === 0) return '0' + u;
    if (has(NOPREF, unit)) return fmt(Number(x.toPrecision(sg))) + u;
    let a = Math.abs(x);
    let e = clamp(Math.floor(Math.log10(a) / 3) * 3, -12, 9);
    let m = a / Math.pow(10, e);
    let r = Number(m.toPrecision(sg));
    if (r >= 1000 && e < 9) { e += 3; r = Number((a / Math.pow(10, e)).toPrecision(sg)); }
    let p = '';
    for (let i = 0; i < PREF.length; i++) if (PREF[i][0] === e) p = PREF[i][1];
    return (x < 0 ? '-' : '') + fmt(r) + ' ' + p + unit;
  }
  C.fmtEng = function (x, unit, sig) { try { return fmtEng(x, unit, sig); } catch (e) { return '–'; } };

  /* parseNum(str): Komma/Punkt, Leerzeichen als Tausendertrennung, Einheitenzusatz toleriert ("250 W", "2,5 A"). Zahl oder NaN. SI-Vorsatz wird NICHT angewendet (siehe parseUnit). */
  function parseNum(str) {
    if (typeof str === 'number') return isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    const s = str.replace(/−/g, '-').replace(/[   ]/g, ' ').trim();
    const m = s.match(/^[+-]?\s?(?:[0-9][0-9 .,]*|[.,][0-9]+)/);
    if (!m) return NaN;
    let body = m[0].replace(/\s+$/, '').replace(/[.,]+$/, '');
    const rest = s.slice(m[0].length);
    if (!body) return NaN;
    let sgn = 1;
    if (body[0] === '-' || body[0] === '+') { if (body[0] === '-') sgn = -1; body = body.slice(1).trim(); }
    if (/ /.test(body)) {
      if (!/^\d{1,3}( \d{3})+([.,]\d+)?$/.test(body)) return NaN;
      body = body.replace(/ /g, '');
    }
    const nC = (body.match(/,/g) || []).length, nP = (body.match(/\./g) || []).length;
    if (nC && nP) {
      const dec = body.lastIndexOf(',') > body.lastIndexOf('.') ? ',' : '.';
      const th = dec === ',' ? '.' : ',';
      const parts = body.split(dec);
      if (parts.length !== 2) return NaN;
      if (parts[0].indexOf(th) >= 0 && !new RegExp('^\\d{1,3}(?:\\' + th + '\\d{3})+$').test(parts[0])) return NaN;
      body = parts[0].split(th).join('') + '.' + parts[1];
    } else if (nC > 1 || nP > 1) {
      const sep = nC > 1 ? ',' : '.';
      if (!new RegExp('^\\d{1,3}(\\' + sep + '\\d{3})+$').test(body)) return NaN;
      body = body.split(sep).join('');
    } else if (nC === 1) body = body.replace(',', '.');
    if (!/^\d*\.?\d+$|^\d+\.?$/.test(body)) return NaN;
    let v = Number(body);
    const ex = rest.match(/^[eE]([+-]?\d+)/);
    if (ex) v = v * Math.pow(10, Number(ex[1]));
    v = sgn * v;
    return isFinite(v) ? v : NaN;
  }
  C.parseNum = function (s) { try { return parseNum(s); } catch (e) { return NaN; } };

  /* parseUnit(str): Zahl plus Einheit mit SI-Vorsatz: "100 kHz" -> { value:100, unit:'kHz', factor:1000, si:100000 }. NaN-Wert wenn keine Zahl. */
  const BASEU = ['V', 'A', 'W', 'Hz', 'F', 'H', 'Ω', 'Ohm', 'ohm', 's', 'VA'];
  const PFAC = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, 'μ': 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
  C.parseUnit = function (str) {
    try {
      const value = parseNum(str);
      if (!isFinite(value)) return { value: NaN, unit: '', factor: 1, si: NaN };
      const s = String(str).replace(/[   ]/g, ' ');
      const m = s.match(/[A-Za-zµμΩ%°][A-Za-zµμΩ%°]*\s*$/);
      let unit = m ? m[0].trim() : '';
      if (/^[eE]\d*$/.test(unit)) unit = '';
      let factor = 1;
      if (unit.length > 1 && has(PFAC, unit[0]) && BASEU.indexOf(unit.slice(1)) >= 0) factor = PFAC[unit[0]];
      return { value: value, unit: unit, factor: factor, si: value * factor };
    } catch (e) { return { value: NaN, unit: '', factor: 1, si: NaN }; }
  };

  /* ---------- Zufall (mulberry32, Box-Muller) ---------- */
  function rng(seed) {
    let a = Math.floor(num(seed, 1)) | 0;
    let spare = null;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function normal() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u = next(); if (u < 1e-12) u = 1e-12;
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * PI * v);
      return r * Math.cos(2 * PI * v);
    }
    function int(lo, hi) {
      lo = Math.ceil(num(lo, 0)); hi = Math.floor(num(hi, lo));
      if (hi < lo) hi = lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    }
    function pick(arr) { if (!isArr(arr) || !arr.length) return undefined; return arr[Math.floor(next() * arr.length) % arr.length]; }
    return { next: next, normal: normal, int: int, pick: pick };
  }
  C.rng = function (seed) { try { return rng(seed); } catch (e) { return rng(1); } };

  /* =====================================================================================================
   *  LIMITS: einzige Quelle fuer Zahlen mit Normcharakter (Regel 5). status 'belegt' | 'A' (Uebungswert, frage F..)
   *  Anderes Paket (ntscore-sw.js, ntscore-diag.js) darf Eintraege per C.limits.push(...) ergaenzen.
   * ===================================================================================================== */
  function L(id, value, unit, cmp, status, quelle, frage, text) {
    return { id: id, value: value, unit: unit, cmp: cmp, status: status, quelle: quelle, frage: frage, text: text };
  }
  const limits = [
    /* belegt (Pool oder Toni) */
    L('uf_si', 0.7, 'V', '=', 'belegt', 'pool:F2020-N25', null, 'Durchlassspannung einer Silizium-Diode (auch Pool H2025-05).'),
    L('uref_317', 1.25, 'V', '=', 'belegt', 'pool:F2025-22', null, 'Referenzspannung des LM317 und des MC34063 (auch Pool W2023-07).'),
    L('ube', 0.7, 'V', '=', 'belegt', 'pool:W2024-23', null, 'Basis-Emitter-Schwelle für die Strombegrenzung mit zweitem Transistor.'),
    L('fp_brueck', 100, 'Hz', '=', 'belegt', 'pool:H2024-09', null, 'Pulsfrequenz der Brückenschaltung bei 50 Hz Netzfrequenz.'),
    L('fp_einweg', 50, 'Hz', '=', 'belegt', 'pool:F2025-04', null, 'Pulsfrequenz der Einweggleichrichtung bei 50 Hz Netzfrequenz.'),
    L('u_netz', 230, 'V', '=', 'belegt', 'pool:F2023-N17', null, 'Netzspannung (nur im Transformator-Beispiel als Zahl).'),
    L('f_netz', 50, 'Hz', '=', 'belegt', 'pool:W2021-N44', null, 'Netzfrequenz.'),
    /* Uebungswerte (A), Fragen in AUSBILDER.md */
    L('ri_trafo', 0.4, 'Ω', '=', 'A', '—', 'F1', 'Innenwiderstand (Sekundär) des Übungs-Transformators.'),
    L('ri1_trafo', 10, 'Ω', '=', 'A', '—', 'F1', 'Wicklungswiderstand Primär des Übungs-Transformators (nur Beispiel Gleichspannung).'),
    L('trafo_gelb', 5, '%', '<=', 'A', '—', 'F2', 'Spannungseinbruch unter Last: bis hier grün.'),
    L('trafo_rot', 10, '%', '<=', 'A', '—', 'F2', 'Spannungseinbruch unter Last: bis hier gelb, darüber rot.'),
    L('rz', 10, 'Ω', '=', 'A', '—', 'F3', 'Dynamischer Widerstand der Z-Diode.'),
    L('iz_min', 0.005, 'A', '>=', 'A', '—', 'F3', 'Mindest-Z-Strom, ab dem die Z-Diode stabilisiert.'),
    L('uf_schottky', 0.4, 'V', '=', 'A', '—', 'F4', 'Durchlassspannung einer Schottky-Diode (Beispiel).'),
    L('dropout_7805', 2, 'V', '=', 'A', '—', 'F6', 'Mindest-Spannungsabfall (Dropout) der Festspannungsregler 7805 und 7812; Datenblatt maßgeblich.'),
    L('umin_7805', 7, 'V', '>=', 'A', '—', 'F6', 'Mindest-Eingangsspannung des 7805 (5 V plus Dropout); Datenblatt maßgeblich.'),
    L('iq_7805', 0.005, 'A', '=', 'A', '—', 'F6', 'Ruhestrom des Festspannungsreglers.'),
    L('imin_317', 0.01, 'A', '>=', 'A', '—', 'F7', 'Mindestlaststrom des LM317.'),
    L('iadj_317', 0.00005, 'A', '=', 'A', '—', 'F7', 'Adjust-Strom des LM317 (der Pool rechnet ohne ihn).'),
    L('dropout_317', 2, 'V', '=', 'A', '—', 'F27', 'Mindest-Spannungsabfall (Dropout) des LM317; Datenblatt maßgeblich.'),
    L('rds_on', 0.05, 'Ω', '=', 'A', '—', 'F8', 'Durchlasswiderstand des Schalt-MOSFETs.'),
    L('rl_dr', 0.03, 'Ω', '=', 'A', '—', 'F8', 'Kupferwiderstand der Drossel.'),
    L('esr', 0.05, 'Ω', '=', 'A', '—', 'F8', 'Ersatzserienwiderstand des Ausgangskondensators.'),
    L('pv_therm', 1, 'W', '>=', 'A', '—', 'F9', 'Verlustleistung, ab der das Lab einen Kühlungshinweis (Thermik-Lab) gibt.'),
    L('tsw', 40e-9, 's', '=', 'A', '—', 'F10', 'Summe aus Anstiegs- und Abfallzeit t_r + t_f.'),
    L('qg', 20e-9, 'C', '=', 'A', '—', 'F10', 'Gate-Ladung Q_g.'),
    L('qgd', 5e-9, 'C', '=', 'A', '—', 'F10', 'Gate-Drain-Ladung Q_gd.'),
    L('ug', 10, 'V', '=', 'A', '—', 'F10', 'Gate-Ansteuerspannung.'),
    L('uplat', 4.5, 'V', '=', 'A', '—', 'F10', 'Plateauspannung (Miller-Plateau) des MOSFETs.'),
    L('rg', 10, 'Ω', '=', 'A', '—', 'F10', 'Gate-Widerstand.'),
    L('fsw', 100000, 'Hz', '=', 'A', '—', 'F14', 'Beispiel-Schaltfrequenz.'),
    L('ueberschwing', 10, '%', '<=', 'A', '—', 'F11', 'Überschwingen im Regelkreis: darüber gelb (Lehrfaustwert).'),
    L('ripple_ok', 10, '%', '<=', 'A', '—', 'F12', 'Brummspannung ΔU in Prozent von Û: bis hier grün (Lehrfaustwert).'),
    L('dil_max', 0.4, '', '<=', 'A', '—', 'F12', 'Drosselwelligkeit ΔI_L je Ausgangsstrom: bis hier grün (Lehrfaustwert).'),
    L('eta_ok', 85, '%', '>=', 'A', '—', 'F12', 'Wirkungsgrad des Schaltreglers: ab hier grün (Lehrfaustwert).'),
    L('reserve', 1.2, '', '>=', 'A', '—', 'F12', 'Reserve-Faktor der Ampel: darunter gelb (Lehrfaustwert).'),
    L('d_min', 5, '%', '>=', 'A', '—', 'F12', 'Tastverhältnis: Untergrenze des grünen Bereichs (Lehrfaustwert).'),
    L('d_max', 90, '%', '<=', 'A', '—', 'F12', 'Tastverhältnis: Obergrenze des grünen Bereichs (Lehrfaustwert).'),
    L('d_warn', 80, '%', '<=', 'A', '—', 'F12', 'Tastverhältnis: darüber gelb (Lehrfaustwert).'),
    L('dil_ausleg', 0.3, '', '=', 'A', '—', 'F13', 'Auslegungsfaktor der Drossel: ΔI_L = Faktor mal I_aus.'),
    L('ripple_naeh', 0.2, '', '<=', 'A', '—', 'F16', 'Gültigkeitsgrenze der Brummformel: ΔU höchstens dieser Anteil von Û.'),
    L('u_dc_max', 60, 'V', '<=', 'A', '—', 'F28', 'Obergrenze der Gleichspannung am Eingang der Prüfstände (Sicherheit).'),
    L('u_ac_max', 50, 'V', '<=', 'A', '—', 'F28', 'Obergrenze der Wechselspannung am Eingang der Prüfstände (Sicherheit).'),
    L('rc_r', 2.2, 'Ω', '=', 'A', '—', 'F29', 'Widerstand des RC-Glieds am Ausgang des Gleichrichter-Prüfstands.')
  ];
  C.limits = limits;
  C.limit = function (id) {
    try {
      for (let i = 0; i < limits.length; i++) if (limits[i].id === id) return limits[i];
    } catch (e) { /* weiter */ }
    return null;
  };
  C.limitValue = function (id) { const l = C.limit(id); return l ? l.value : NaN; };
  function LV(id) { const l = C.limit(id); return l ? l.value : NaN; }

  /* =====================================================================================================
   *  GLOSSAR (einzige Quelle fuer Begriffe, Symbole, Einheiten, Erklaertexte; Alternativen nur hier im Feld alt)
   * ===================================================================================================== */
  /* [key, Symbol, Artikel, Name, Einheit, Nachkommastellen der Anzeige, Erklaerung, Alternativen] */
  const GL = [
    ['U1', 'U₁', 'die', 'Primärspannung', 'V', 1, 'Die Spannung an der Primärwicklung des Transformators, im Beispiel die Netzspannung.'],
    ['U2', 'U₂', 'die', 'Sekundärspannung', 'V', 2, 'Die Spannung an der Sekundärwicklung. Im Leerlauf gilt U₁/U₂ = N₁/N₂.'],
    ['N1', 'N₁', 'die', 'Windungszahl primär', '', 0, 'Die Zahl der Windungen der Primärwicklung.'],
    ['N2', 'N₂', 'die', 'Windungszahl sekundär', '', 0, 'Die Zahl der Windungen der Sekundärwicklung.'],
    ['ue', 'ü', 'das', 'Übersetzungsverhältnis', '', 2, 'Das Übersetzungsverhältnis ü = N₁/N₂ gibt an, um wie viel die Spannung herabgesetzt wird. Der Strom verhält sich umgekehrt.'],
    ['Uein', 'U_ein', 'die', 'Eingangsspannung', 'V', 2, 'Die Spannung, die eine Stufe am Eingang bekommt.'],
    ['Uaus', 'U_aus', 'die', 'Ausgangsspannung', 'V', 2, 'Die Spannung, die eine Stufe an die Last abgibt.'],
    ['Uref', 'U_ref', 'die', 'Referenzspannung', 'V', 2, 'Die feste Vergleichsspannung im Regler. Beim LM317 sind es 1,25 V.'],
    ['UF', 'U_F', 'die', 'Durchlassspannung', 'V', 2, 'Die Spannung, die an einer leitenden Diode abfällt. Bei einer Silizium-Diode sind es 0,7 V.'],
    ['UZ', 'U_Z', 'die', 'Z-Spannung', 'V', 2, 'Die Spannung, die eine Z-Diode im Sperrbereich festhält.'],
    ['Uhat', 'Û', 'der', 'Scheitelwert', 'V', 2, 'Der Spitzenwert der Spannung am Ladekondensator, nachdem die Durchlassspannungen der Dioden abgezogen sind.'],
    ['dU', 'ΔU', 'die', 'Brummspannung', 'V', 2, 'Die Brummspannung ist die Schwankung der Gleichspannung (Spitze-Spitze) am Ladekondensator.', 'Restwelligkeit'],
    ['Ur', 'U_r', 'die', 'Welligkeit am Ausgang', 'V', 3, 'Der Wechselanteil, der nach einer Siebung oder Regelung am Ausgang übrig bleibt.', 'Restwelligkeit'],
    ['Iaus', 'I_aus', 'der', 'Ausgangsstrom', 'A', 3, 'Der Strom, den die Last aus dem Netzteil zieht.'],
    ['IZ', 'I_Z', 'der', 'Z-Strom', 'A', 4, 'Der Strom durch die Z-Diode. Er muss über dem Mindestwert bleiben, sonst stabilisiert die Z-Diode nicht.'],
    ['IL', 'I_L', 'der', 'Drosselstrom', 'A', 3, 'Der Strom durch die Drossel des Schaltreglers.'],
    ['dIL', 'ΔI_L', 'die', 'Drosselwelligkeit', 'A', 4, 'Die Stromschwankung (Spitze-Spitze) in der Drossel während einer Schaltperiode.'],
    ['Ilim', 'I_lim', 'der', 'Begrenzungsstrom', 'A', 3, 'Der Strom, ab dem die Strombegrenzung eingreift.'],
    ['f', 'f', 'die', 'Netzfrequenz', 'Hz', 0, 'Die Frequenz der Wechselspannung, im Beispiel 50 Hz.'],
    ['fp', 'f_p', 'die', 'Pulsfrequenz', 'Hz', 0, 'Die Frequenz der Ladestromimpulse: 50 Hz beim Einweggleichrichter, 100 Hz bei der Brückenschaltung.'],
    ['fsw', 'f_sw', 'die', 'Schaltfrequenz', 'Hz', 0, 'Die Frequenz, mit der der Schalter im Schaltregler ein- und ausschaltet.'],
    ['T', 'T', 'die', 'Periodendauer', 's', 6, 'Die Dauer einer Schwingung: T = 1/f.'],
    ['D', 'D', 'das', 'Tastverhältnis', '%', 1, 'Das Tastverhältnis ist die Einschaltdauer des Schalters geteilt durch die Periodendauer.'],
    ['C', 'C', 'der', 'Ladekondensator', 'µF', 0, 'Der Ladekondensator glättet die pulsierende Gleichspannung hinter dem Gleichrichter.', 'Siebkondensator'],
    ['L', 'L', 'die', 'Drossel', 'µH', 1, 'Die Drossel speichert im Schaltregler Energie im Magnetfeld.', 'Speicherdrossel'],
    ['Rv', 'R_V', 'der', 'Vorwiderstand', 'Ω', 1, 'Der Vorwiderstand begrenzt den Strom, etwa vor der Z-Diode oder beim Einschalten des Ladekondensators.'],
    ['Ri', 'R_i', 'der', 'Innenwiderstand', 'Ω', 2, 'Der Innenwiderstand lässt die Klemmenspannung unter Last sinken: U_Klemme = U_Leerlauf − I · R_i.'],
    ['rz', 'r_z', 'der', 'dynamische Widerstand der Z-Diode', 'Ω', 1, 'Er beschreibt, wie stark die Z-Spannung sich bei Stromänderung verschiebt.'],
    ['Rds', 'R_ds', 'der', 'Durchlasswiderstand des MOSFETs', 'mΩ', 0, 'Der Widerstand zwischen Drain und Source im eingeschalteten Zustand.'],
    ['RL', 'R_L', 'der', 'Kupferwiderstand der Drossel', 'mΩ', 0, 'Der ohmsche Widerstand der Drosselwicklung.'],
    ['Qg', 'Q_g', 'die', 'Gate-Ladung', 'nC', 0, 'Die Ladung, die das Gate zum Durchschalten braucht.'],
    ['Rg', 'R_g', 'der', 'Gate-Widerstand', 'Ω', 1, 'Er bestimmt, wie schnell das Gate umgeladen wird.'],
    ['tsw', 't_sw', 'die', 'Schaltzeit', 'ns', 0, 'Die Zeit, die der Schalter für den Übergang zwischen Ein und Aus braucht.'],
    ['Pzu', 'P_zu', 'die', 'zugeführte Leistung', 'W', 2, 'Die Leistung, die eine Stufe aufnimmt.'],
    ['Pab', 'P_ab', 'die', 'abgegebene Leistung', 'W', 2, 'Die Leistung, die eine Stufe an die Last abgibt.'],
    ['PV', 'P_V', 'die', 'Verlustleistung', 'W', 2, 'Die Leistung, die in der Stufe als Wärme verloren geht. Beim Linearregler gilt P_V = (U_ein − U_aus) · I.'],
    ['eta', 'η', 'der', 'Wirkungsgrad', '%', 1, 'Der Wirkungsgrad ist abgegebene Leistung geteilt durch zugeführte Leistung.'],
    ['transformator', '', 'der', 'Transformator (Trafo)', '', 0, 'Der Transformator setzt eine Wechselspannung herauf oder herab und trennt Primär- und Sekundärseite.'],
    ['gleichrichter', '', 'der', 'Gleichrichter', '', 0, 'Der Gleichrichter macht aus Wechselspannung eine pulsierende Gleichspannung. Er ist als Einweg- oder Brückenschaltung gebaut.'],
    ['einweg', '', 'der', 'Einweggleichrichter', '', 0, 'Er lässt nur eine Halbwelle durch: eine Diode, Pulsfrequenz gleich der Netzfrequenz.'],
    ['bruecke', '', 'die', 'Brückenschaltung', '', 0, 'Vier Dioden lassen beide Halbwellen durch. Der Strom fließt immer über zwei Dioden, die Pulsfrequenz ist doppelt so hoch.'],
    ['z-diode', '', 'die', 'Z-Diode', '', 0, 'Die Z-Diode wird in Sperrrichtung betrieben und hält ihre Z-Spannung fest, solange ein Mindeststrom fließt.'],
    ['linearregler', '', 'der', 'Linearregler', '', 0, 'Der Linearregler stellt die Ausgangsspannung ein, indem er die überschüssige Spannung als Wärme verbrennt.', 'Längsregler'],
    ['festregler', '', 'der', 'Festspannungsregler', '', 0, 'Ein Linearregler mit fester Ausgangsspannung, zum Beispiel 7805 mit 5 V.'],
    ['schaltregler', '', 'der', 'Schaltregler', '', 0, 'Der Schaltregler schaltet einen Schalter schnell ein und aus und speichert Energie in einer Drossel. Er hat viel weniger Verlust als ein Linearregler.', 'getaktetes Netzteil'],
    ['tiefsetzsteller', '', 'der', 'Tiefsetzsteller', '', 0, 'Der Tiefsetzsteller erzeugt aus einer höheren Eingangsspannung eine niedrigere Ausgangsspannung.', 'Step-down, Buck'],
    ['hochsetzsteller', '', 'der', 'Hochsetzsteller', '', 0, 'Der Hochsetzsteller erzeugt aus einer niedrigeren Eingangsspannung eine höhere Ausgangsspannung.', 'Step-up, Boost'],
    ['inverswandler', '', 'der', 'Inverswandler', '', 0, 'Der Inverswandler erzeugt eine Ausgangsspannung mit umgekehrtem Vorzeichen.', 'Buck-Boost, invertierender Wandler'],
    ['sperrwandler', '', 'der', 'Sperrwandler', '', 0, 'Der Sperrwandler arbeitet mit einem Übertrager mit Luftspalt und trennt Ein- und Ausgang galvanisch.', 'Flyback'],
    ['rueckkopplung', '', 'die', 'Rückkopplung', '', 0, 'Die Rückkopplung führt einen Teil der Ausgangsspannung zurück und vergleicht ihn mit der Referenz.'],
    ['strombegrenzung', '', 'die', 'Strombegrenzung', '', 0, 'Die Strombegrenzung hält den Ausgangsstrom unter einem eingestellten Wert, zum Beispiel mit Messwiderstand und zweitem Transistor.'],
    ['labornetzteil', '', 'das', 'Labornetzteil', '', 0, 'Das Labornetzteil regelt wahlweise die Spannung (CV) oder den Strom (CC).'],
    ['fehlersuche', '', 'die', 'Fehlersuche', '', 0, 'Die Fehlersuche geht vom Symptom über Messpunkte zur Ursache, immer an einem freigeschalteten Gerät.'],
    ['dropout', '', 'der', 'Dropout', 'V', 1, 'Der Dropout ist der Mindest-Spannungsabfall, den ein Linearregler braucht, um die Ausgangsspannung zu halten.', 'Dropout-Spannung'],
    ['cv', 'CV', 'die', 'Spannungsregelung (CV)', '', 0, 'Constant Voltage: Die Ausgangsspannung ist konstant, der Strom stellt sich nach der Last ein.'],
    ['cc', 'CC', 'die', 'Stromregelung (CC)', '', 0, 'Constant Current: Der Ausgangsstrom ist konstant, die Spannung stellt sich nach der Last ein.'],
    ['ccm', 'CCM', 'der', 'nicht lückende Betrieb', '', 0, 'Der Drosselstrom fällt in jeder Periode nicht bis null.'],
    ['dcm', 'DCM', 'der', 'lückende Betrieb', '', 0, 'Der Drosselstrom fällt in jeder Periode bis null und bleibt dort eine Weile.'],
    ['esr', 'ESR', 'der', 'Ersatzserienwiderstand', 'mΩ', 0, 'Der ohmsche Anteil im Kondensator, der bei Wechselstrom Spannung abfallen lässt.'],
    ['mosfet', '', 'der', 'MOSFET', '', 0, 'Der Transistor, der im Schaltregler als schneller Schalter dient.'],
    ['ube', 'U_BE', 'die', 'Basis-Emitter-Schwelle', 'V', 2, 'Etwa 0,7 V: Ab dieser Spannung schaltet der Transistor der Strombegrenzung durch.'],
    ['rkrit', 'R_krit', 'der', 'Grenzwiderstand', 'Ω', 1, 'Der Lastwiderstand, bei dem das Labornetzteil von der Spannungsregelung in die Stromregelung wechselt: R_krit = U_eingestellt/I_eingestellt.']
  ];
  const glossary = GL.map(function (g) { return { key: g[0], sym: g[1], article: g[2], name: g[3], unit: g[4], digits: g[5], explain: g[6], alt: g[7] || '' }; });
  const glByKey = {};
  glossary.forEach(function (g) { glByKey[g.key] = g; });
  hide(glossary, 'byKey', glByKey);
  hide(glossary, 'get', function (k) { try { return typeof k === 'string' && has(glByKey, k) ? glByKey[k] : null; } catch (e) { return null; } });
  C.glossary = glossary;

  /* =====================================================================================================
   *  TEXTS: Meldungsvorlagen (einzige Quelle; ntscore-sw.js und ntscore-diag.js erweitern diese Tabelle)
   * ===================================================================================================== */
  const TEXTS = C.TEXTS || {};
  TEXTS.diag = TEXTS.diag || {};
  function tpl(text, vars) {
    return String(text).replace(/\{([A-Za-z0-9_]+)\}/g, function (m, k) {
      if (!vars || !has(vars, k)) return m;
      const v = vars[k];
      return typeof v === 'number' ? fmt(v) : String(v);
    });
  }
  TEXTS.tpl = function (text, vars) { try { return tpl(text, vars); } catch (e) { return ''; } };
  TEXTS.get = function (id, vars) {
    try {
      const d = (typeof id === 'string' && has(TEXTS.diag, id)) ? TEXTS.diag[id] : null;
      if (!d) return { id: typeof id === 'string' ? id : '', kind: 'info', text: '' };
      const o = { id: id, kind: d.kind || 'info', text: tpl(d.text, vars) };
      if (d.fx) o.fx = d.fx;
      if (d.link) o.link = d.link;
      return o;
    } catch (e) { return { id: '', kind: 'info', text: '' }; }
  };
  hide(TEXTS, 'tpl', TEXTS.tpl);
  TEXTS.simOnly = 'Simulation – kein Eigenbau und keine Messung an Netzspannung.';
  TEXTS.ampelHinweis = 'Grün heißt: Die Auslegung trägt im Modell. Es heißt nicht, dass ein Gerät gefahrlos anzufassen ist.';
  TEXTS.lernenHinweis = 'Dieses Lab ersetzt keine Unterweisung. Arbeiten an Netzspannung nur durch Elektrofachkraft oder unterwiesene Person.';
  TEXTS.elkoHinweis = 'Ein geladener Elko bleibt nach dem Abschalten gefährlich.';
  TEXTS.datenblatt = 'Datenblatt maßgeblich.';
  TEXTS.uebungswert = 'Übungswert: Der Ausbilder gleicht ab.';
  const D = TEXTS.diag;
  D['trafo-dc'] = { kind: 'error', text: 'Gleichspannung am Transformator: Es entsteht keine Gegeninduktion, nur der Wicklungswiderstand begrenzt den Strom ({I}). Die Wicklung wird zerstört. Auf der Sekundärseite entsteht keine Spannung.' };
  D['trafo-ueberlast'] = { kind: 'error', text: 'Überlast: Die Klemmenspannung ist unter null gerechnet, der Strom ist für diesen Innenwiderstand zu groß.' };
  D['ripple-naeherung'] = { kind: 'warn', text: 'Näherung versagt: Die Brummspannung ΔU = I/(f_p · C) gilt nur für ΔU klein gegen Û (hier ΔU = {dU}, Grenze {grenze}). Das Ergebnis ist nicht belastbar.' };
  D['ripple-null'] = { kind: 'warn', text: 'Die Brummspannung wäre größer als der Scheitelwert: Der Ladekondensator entlädt sich bis null, die Formel gilt hier nicht.' };
  D['modellgrenze'] = { kind: 'warn', text: 'Die Eingangsspannung liegt über der Grenze des Modells ({grenze}). Das Lab rechnet nur mit Kleinspannung.' };
  D['inrush-kein-r'] = { kind: 'warn', text: 'Ohne Vorwiderstand und ohne Innenwiderstand begrenzt nur die Zuleitung den Einschaltstrom. Das Modell liefert dann keinen Wert.' };
  D['z-aus'] = { kind: 'warn', text: 'Der Z-Strom ({iz}) liegt unter dem Mindestwert ({izmin}): Die Z-Diode stabilisiert nicht mehr, die Ausgangsspannung bricht ein.' };
  D['z-sperrt'] = { kind: 'warn', text: 'Die Eingangsspannung ({ue}) erreicht die Z-Spannung ({uz}) nicht: Die Z-Diode leitet nicht, es ist nur ein Spannungsteiler.' };
  D['z-ueberlast'] = { kind: 'error', text: 'Die Verlustleistung der Z-Diode ({pz}) liegt über dem zulässigen Wert ({pmax}).' };
  D['regler-dropout'] = { kind: 'error', text: 'Der Regler braucht mindestens {umin} am Eingang (Ausgang plus Dropout), anliegen sind {uein}: Die Ausgangsspannung bricht ein. Datenblatt maßgeblich.' };
  D['regler-ok'] = { kind: 'info', text: 'Der Eingang liegt mit {res} über der Mindest-Eingangsspannung ({umin}).' };
  D['lm317-minlast'] = { kind: 'warn', text: 'Der Laststrom ({i}) liegt unter dem Mindestlaststrom des LM317 ({imin}): Die Ausgangsspannung kann zu hoch werden. Datenblatt maßgeblich.' };
  D['therm'] = { kind: 'info', text: 'Verlustleistung {p}: Kühlung und Sperrschichttemperatur rechnest du im Thermik-Lab, nicht hier.', link: 'thmlab.html' };

  C.TEXTS = TEXTS;

  /* =====================================================================================================
   *  LINEARREGLER (lin) - Meilenstein 1
   * ===================================================================================================== */
  const lin = C.lin = C.lin || {};
  /* Verlustleistung: P_V = (Uein - Uaus) * I  [+ Uein * iq, nur auf Wunsch]. Uein < Uaus: NaN (Linearregler kann nicht hochsetzen). */
  lin.loss = G_(function (Uein, Uaus, I, iq) {
    if (!nn(Uein) || !nn(Uaus) || !nn(I)) return NaN;
    if (Uein < Uaus) return NaN;
    const q = (iq === undefined || iq === null) ? 0 : iq;
    if (!nn(q)) return NaN;
    return (Uein - Uaus) * I + Uein * q;
  });
  /* Wirkungsgrad: eta = Uaus*I / (Uein*(I + iq)). */
  lin.eta = G_(function (Uein, Uaus, I, iq) {
    if (!pos(Uein) || !nn(Uaus) || !nn(I)) return NaN;
    if (Uein < Uaus) return NaN;
    const q = (iq === undefined || iq === null) ? 0 : iq;
    if (!nn(q)) return NaN;
    if (I + q === 0) return NaN;
    return Uaus * I / (Uein * (I + q));
  });
  /* LM317: R2 fuer gewuenschte Ausgangsspannung (ohne Adjust-Strom, wie im Pool). */
  lin.r2For = G_(function (Uaus, R1, Uref) {
    const ur = (Uref === undefined) ? LV('uref_317') : Uref;
    if (!pos(Uaus) || !pos(R1) || !pos(ur)) return NaN;
    if (Uaus < ur) return NaN;
    return R1 * (Uaus / ur - 1);
  });
  lin.types = {
    '7805': { Uaus: 5, name: '7805' },
    '7812': { Uaus: 12, name: '7812' }
  };

  function modelGrenze(Uein) {
    const g = LV('u_dc_max');
    return { imModell: Uein <= g, grenzeText: fmtEng(g, 'V') };
  }
  /* gemeinsamer Teil Fest- und Einstellregler: Dropout-Vergleich, Verlust, Wirkungsgrad, Kuehlungshinweis */
  function linCore(Uein, Uaus, I, iq, dropout, out) {
    const umin = Uaus + dropout;
    const betrieb = Uein >= umin;
    const UausIst = betrieb ? Uaus : Math.max(0, Uein - dropout);
    const PV = (Uein - UausIst) * I + Uein * iq;
    const eta = (I + iq) > 0 ? UausIst * I / (Uein * (I + iq)) : NaN;
    out.dropout = dropout; out.UeinMin = umin; out.betrieb = betrieb; out.reserve = Uein - umin;
    out.UausIst = UausIst; out.P_V = PV; out.eta = eta; out.Pab = UausIst * I; out.Pzu = Uein * (I + iq);
    out.thermHinweis = PV >= LV('pv_therm');
    const mg = modelGrenze(Uein);
    out.imModell = mg.imModell;
    out.diag = [];
    out.diag.push(betrieb ? TEXTS.get('regler-ok', { res: fmtEng(out.reserve, 'V'), umin: fmtEng(umin, 'V') })
                          : TEXTS.get('regler-dropout', { umin: fmtEng(umin, 'V'), uein: fmtEng(Uein, 'V') }));
    if (out.thermHinweis) out.diag.push(TEXTS.get('therm', { p: fmtEng(PV, 'W') }));
    if (!mg.imModell) out.diag.push(TEXTS.get('modellgrenze', { grenze: mg.grenzeText }));
    return out;
  }
  /* fixed(cfg): cfg = { typ:'7805'|'7812', Uein, I, iq?(A), mitIq?(bool: Ruhestrom aus limits), dropout? }. Hinweis: ok ist das Struktur-Flag, der Dropout-Vergleich heisst betrieb. */
  lin.fixed = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const typ = cfg.typ === undefined ? '7805' : String(cfg.typ);
    if (typ === '7905') return fail('Der 7905 liefert eine negative Spannung; das Lab rechnet nur mit positiven Reglern (nur Begriff).');
    if (!has(lin.types, typ)) return fail('Unbekannter Festspannungsregler (7805 oder 7812).');
    if (!pos(cfg.Uein)) return fail('Eingangsspannung muss größer als 0 sein.');
    if (!nn(cfg.I)) return fail('Laststrom darf nicht negativ sein.');
    const iq = cfg.iq !== undefined ? cfg.iq : (cfg.mitIq ? LV('iq_7805') : 0);
    if (!nn(iq)) return fail('Ruhestrom darf nicht negativ sein.');
    const dr = cfg.dropout !== undefined ? cfg.dropout : LV('dropout_7805');
    if (!nn(dr)) return fail('Dropout darf nicht negativ sein.');
    const out = { ok: true, typ: typ, Uaus: lin.types[typ].Uaus, Uein: cfg.Uein, I: cfg.I, iq: iq, dropoutStatus: cfg.dropout !== undefined ? 'eingabe' : 'A' };
    return linCore(cfg.Uein, out.Uaus, cfg.I, iq, dr, out);
  });
  /* lm317(cfg): cfg = { R1, R2, Uref?, iadj?(A), Uein?, I?, iq? }. U = Uref*(1 + R2/R1) [+ iadj*R2]. Mit Uein und I zusaetzlich Dropout, Verlust, Mindestlast. */
  lin.lm317 = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.R1)) return fail('R1 muss größer als 0 sein.');
    if (!nn(cfg.R2)) return fail('R2 darf nicht negativ sein.');
    const Uref = cfg.Uref !== undefined ? cfg.Uref : LV('uref_317');
    if (!pos(Uref)) return fail('Referenzspannung muss größer als 0 sein.');
    const iadj = cfg.iadj === undefined ? 0 : cfg.iadj;
    if (!nn(iadj)) return fail('Adjust-Strom darf nicht negativ sein.');
    const ratio = cfg.R2 / cfg.R1;
    const out = { ok: true, Uref: Uref, R1: cfg.R1, R2: cfg.R2, ratio: ratio, Uaus: Uref * (1 + ratio) + iadj * cfg.R2, iadjTerm: iadj * cfg.R2, diag: [] };
    if (cfg.Uein !== undefined || cfg.I !== undefined) {
      if (!pos(cfg.Uein)) return fail('Für die Verlustrechnung fehlt die Eingangsspannung.');
      if (!nn(cfg.I)) return fail('Laststrom darf nicht negativ sein.');
      const iq = cfg.iq === undefined ? 0 : cfg.iq;
      if (!nn(iq)) return fail('Ruhestrom darf nicht negativ sein.');
      linCore(cfg.Uein, out.Uaus, cfg.I, iq, LV('dropout_317'), out);
      out.imin = LV('imin_317');
      out.minlastOk = cfg.I >= out.imin;
      if (!out.minlastOk) out.diag.push(TEXTS.get('lm317-minlast', { i: fmtEng(cfg.I, 'A'), imin: fmtEng(out.imin, 'A') }));
    }
    return out;
  });
  /* dropout(cfg): cfg = { typ:'7805'|'7812'|'lm317', Uaus (bei lm317 Pflicht), Uein? } -> { dropout, UeinMin, reserve?, betrieb?, UausIst? } */
  lin.dropout = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const typ = cfg.typ === undefined ? '7805' : String(cfg.typ);
    let Uaus, dr;
    if (typ === 'lm317') {
      if (!pos(cfg.Uaus)) return fail('Beim LM317 fehlt die Ausgangsspannung.');
      Uaus = cfg.Uaus; dr = LV('dropout_317');
    } else if (has(lin.types, typ)) {
      Uaus = lin.types[typ].Uaus; dr = LV('dropout_7805');
    } else return fail('Unbekannter Reglertyp (7805, 7812 oder lm317).');
    const out = { ok: true, typ: typ, Uaus: Uaus, dropout: dr, UeinMin: Uaus + dr, status: 'A' };
    if (cfg.Uein !== undefined) {
      if (!pos(cfg.Uein)) return fail('Eingangsspannung muss größer als 0 sein.');
      out.reserve = cfg.Uein - out.UeinMin;
      out.betrieb = cfg.Uein >= out.UeinMin;
      out.UausIst = out.betrieb ? Uaus : Math.max(0, cfg.Uein - dr);
    }
    return out;
  });
  /* limitT2(cfg): Strombegrenzung mit Messwiderstand: I_lim = U_BE / R3. cfg = { R3, Ube?, Uein? } */
  lin.limitT2 = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.R3)) return fail('Der Messwiderstand muss größer als 0 sein.');
    const Ube = cfg.Ube !== undefined ? cfg.Ube : LV('ube');
    if (!pos(Ube)) return fail('U_BE muss größer als 0 sein.');
    const Ilim = Ube / cfg.R3;
    const out = { ok: true, Ube: Ube, R3: cfg.R3, Ilim: Ilim, Pr: Ilim * Ilim * cfg.R3 };
    if (cfg.Uein !== undefined) {
      if (!pos(cfg.Uein)) return fail('Eingangsspannung muss größer als 0 sein.');
      out.PvKurz = cfg.Uein * Ilim;
      out.thermHinweis = out.PvKurz >= LV('pv_therm');
    }
    return out;
  });
  /* =====================================================================================================
   *  TRANSFORMATOR (trafo) - SPEC 4.1. Ideal plus ohmsche Verluste; Eisenverluste und Saettigung NICHT modelliert.
   * ===================================================================================================== */
  const trafo = C.trafo = C.trafo || {};
  /* ratio(cfg): cfg = { U1 (Standard 230 V), n1, n2, iLast? (A, Sekundaerstrom) } -> { ue, U2_leer, I2?, I1? } */
  trafo.ratio = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.n1) || !pos(cfg.n2)) return fail('Die Windungszahlen müssen größer als 0 sein.');
    const U1 = cfg.U1 === undefined ? LV('u_netz') : cfg.U1;
    if (!nn(U1)) return fail('Die Primärspannung darf nicht negativ sein.');
    const out = { ok: true, U1: U1, n1: cfg.n1, n2: cfg.n2, ue: cfg.n1 / cfg.n2, U2_leer: U1 * cfg.n2 / cfg.n1 };
    if (cfg.iLast !== undefined) {
      if (!nn(cfg.iLast)) return fail('Der Laststrom darf nicht negativ sein.');
      out.I2 = cfg.iLast; out.I1 = cfg.iLast * cfg.n2 / cfg.n1;
    }
    return out;
  });
  /* Innenwiderstand aus Leerlauf- und Klemmenspannung: Ri = (U_leer - U_klemme)/I (Pool F2026-19) */
  trafo.ri = G_(function (Uleer, Uklemme, I) {
    if (!pos(Uleer) || !nn(Uklemme) || !pos(I)) return NaN;
    if (Uklemme > Uleer) return NaN;
    return (Uleer - Uklemme) / I;
  });
  /* load(cfg): cfg = { U1?, n1, n2, ri? (Standard aus limits, Uebung), ri1? (Primaer, Standard 0), iLast | Rlast, last?, gleich? }
   * -> { ue, U2_leer, I2, U2_klemme, einbruch (Anteil), I1, Pab, Pcu2, Pcu1, Pv, Pzu, eta, valid, diag }. last/gleich werden nur durchgereicht (siehe ABWEICHUNGEN). */
  trafo.load = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const r = trafo.ratio({ U1: cfg.U1, n1: cfg.n1, n2: cfg.n2 });
    if (!r.ok) return r;
    const riUebung = cfg.ri === undefined;
    const ri = riUebung ? LV('ri_trafo') : cfg.ri;
    const ri1 = cfg.ri1 === undefined ? 0 : cfg.ri1;
    if (!nn(ri) || !nn(ri1)) return fail('Die Widerstände dürfen nicht negativ sein.');
    let I2;
    if (cfg.iLast !== undefined) {
      if (!nn(cfg.iLast)) return fail('Der Laststrom darf nicht negativ sein.');
      I2 = cfg.iLast;
    } else if (cfg.Rlast !== undefined) {
      if (!pos(cfg.Rlast)) return fail('Der Lastwiderstand muss größer als 0 sein.');
      I2 = r.U2_leer / (cfg.Rlast + ri);
    } else return fail('Es fehlt der Laststrom oder der Lastwiderstand.');
    const U2k = r.U2_leer - I2 * ri;
    const I1 = I2 * cfg.n2 / cfg.n1;
    const Pab = Math.max(0, U2k) * I2;
    const Pcu2 = I2 * I2 * ri, Pcu1 = I1 * I1 * ri1;
    const Pv = Pcu2 + Pcu1, Pzu = Pab + Pv;
    const out = { ok: true, U1: r.U1, ue: r.ue, U2_leer: r.U2_leer, I2: I2, U2_klemme: U2k, einbruch: r.U2_leer > 0 ? (r.U2_leer - U2k) / r.U2_leer : NaN,
      I1: I1, Pab: Pab, Pcu2: Pcu2, Pcu1: Pcu1, Pv: Pv, Pzu: Pzu, eta: Pzu > 0 ? Pab / Pzu : NaN, ri: ri, riStatus: riUebung ? 'A' : 'eingabe',
      last: cfg.last === 'diode' ? 'diode' : 'R', gleich: cfg.gleich === true, valid: U2k > 0, diag: [] };
    if (!out.valid) out.diag.push(TEXTS.get('trafo-ueberlast'));
    return out;
  });
  /* dc(cfg): Gleichspannung am Primaeranschluss (Pool F2023-N17): cfg = { U? (Standard 230 V), Rw? (Wicklungswiderstand, Standard ri1_trafo) } */
  trafo.dc = S_(function (cfg) {
    const c = cfg === undefined ? {} : cfg;
    if (!isObj(c)) return fail('Eingabe fehlt.');
    const U = c.U !== undefined ? c.U : (c.U1 !== undefined ? c.U1 : LV('u_netz'));
    const Rw = c.Rw !== undefined ? c.Rw : (c.ri1 !== undefined ? c.ri1 : LV('ri1_trafo'));
    if (!nn(U)) return fail('Die Spannung darf nicht negativ sein.');
    if (!pos(Rw)) return fail('Der Wicklungswiderstand muss größer als 0 sein.');
    const I = U / Rw;
    return { ok: true, valid: true, U: U, Rw: Rw, I: I, P: U * I, U2: 0, induktiv: false, warn: 'Wicklung wird zerstört', diag: [TEXTS.get('trafo-dc', { I: fmtEng(I, 'A') })] };
  });

  /* =====================================================================================================
   *  GLEICHRICHTER UND SIEBUNG (rect) - SPEC 4.2. C in uF!
   * ===================================================================================================== */
  const rect = C.rect = C.rect || {};
  rect.nD = G_(function (topo) { return topo === 'einweg' ? 1 : (topo === 'bruecke' ? 2 : NaN); });
  /* Pulsfrequenz: Einweg f, Bruecke 2f (bei 50 Hz: 50 und 100 Hz, belegt) */
  rect.fp = G_(function (topo, f) {
    const ff = f === undefined ? LV('f_netz') : f;
    if (!pos(ff)) return NaN;
    return topo === 'einweg' ? ff : (topo === 'bruecke' ? 2 * ff : NaN);
  });
  /* gemeinsame Pruefung: cfg = { topo, U2 (eff), uf?, f?, C (uF), I | R, ri?, rs? } */
  function rectNorm(cfg, needC) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (cfg.topo !== 'einweg' && cfg.topo !== 'bruecke') return fail('Die Schaltung muss "einweg" oder "bruecke" sein.');
    if (!pos(cfg.U2)) return fail('Die Sekundärspannung muss größer als 0 sein.');
    const uf = cfg.uf === undefined ? LV('uf_si') : cfg.uf;
    const f = cfg.f === undefined ? LV('f_netz') : cfg.f;
    if (!nn(uf)) return fail('Die Durchlassspannung darf nicht negativ sein.');
    if (!pos(f) || f > 1e4) return fail('Die Netzfrequenz muss zwischen 0 und 10 kHz liegen.');
    const ri = cfg.ri === undefined ? 0 : cfg.ri, rs = cfg.rs === undefined ? 0 : cfg.rs;
    if (!nn(ri) || !nn(rs)) return fail('Die Widerstände dürfen nicht negativ sein.');
    const v = { ok: true, topo: cfg.topo, nD: cfg.topo === 'einweg' ? 1 : 2, U2: cfg.U2, uf: uf, f: f, ri: ri, rs: rs };
    v.fp = (cfg.topo === 'einweg' ? 1 : 2) * f;
    v.peak = cfg.U2 * Math.SQRT2 - v.nD * uf;
    if (needC) {
      if (!pos(cfg.C)) return fail('Der Ladekondensator muss größer als 0 sein.');
      v.C = cfg.C * 1e-6;
      if (cfg.I !== undefined) {
        if (!nn(cfg.I)) return fail('Der Laststrom darf nicht negativ sein.');
        v.I = cfg.I; v.R = NaN;
      } else if (cfg.R !== undefined) {
        if (!pos(cfg.R)) return fail('Der Lastwiderstand muss größer als 0 sein.');
        v.R = cfg.R; v.I = NaN;
      } else return fail('Es fehlt der Laststrom oder der Lastwiderstand.');
    }
    return v;
  }
  /* peak: U_hat = U2 * sqrt(2) - n_D * U_F (Pool F2020-N25: 12 V Bruecke 15,57 V). NaN bei Ergebnis <= 0. */
  rect.peak = G_(function (cfg) {
    const v = rectNorm(cfg, false);
    if (!v.ok || !(v.peak > 0)) return NaN;
    return v.peak;
  });
  /* ripple: dU = I/(fp*C) (Lehrnaeherung, Saegezahn; Pool H2024-10). Bei Lastwiderstand: I = Umittel/R, geschlossen geloest.
   * -> { ok, valid, dU, peak, Umittel, Umin, fp, I, grenze, naeherung:true, diag }. valid:false: Naeherung versagt (dU > ripple_naeh * U_hat), dann Umittel/Umin = NaN. */
  rect.ripple = S_(function (cfg) {
    const v = rectNorm(cfg, true);
    if (!v.ok) return v;
    if (!(v.peak > 0)) return fail('Die Sekundärspannung reicht nicht über die Durchlassspannungen hinaus.');
    let dU, I = v.I;
    if (isNaN(v.I)) {
      const a = 1 / (v.R * v.fp * v.C);
      dU = v.peak * a / (1 + a / 2);
      I = (v.peak - dU / 2) / v.R;
    } else dU = v.I / (v.fp * v.C);
    const grenze = LV('ripple_naeh') * v.peak;
    const valid = dU <= grenze;
    const out = { ok: true, valid: valid, naeherung: true, dU: dU, peak: v.peak, fp: v.fp, I: I, grenze: grenze, C: v.C * 1e6,
      Umittel: valid ? v.peak - dU / 2 : NaN, Umin: valid ? v.peak - dU : NaN, diag: [] };
    out.imModell = cfg.U2 <= LV('u_ac_max');
    if (!valid) {
      out.diag.push(dU >= v.peak ? TEXTS.get('ripple-null') : TEXTS.get('ripple-naeherung', { dU: fmtEng(dU, 'V'), grenze: fmtEng(grenze, 'V') }));
      out.why = out.diag[0].text;
    }
    if (!out.imModell) out.diag.push(TEXTS.get('modellgrenze', { grenze: fmtEng(LV('u_ac_max'), 'V') }));
    return out;
  });
  /* cmin: kleinstes C in uF fuer gegebene Brummspannung: C = I/(fp*dU) (Referenz 0,5 A, 1 V, Bruecke: 5000 uF). cfg = { topo, I, dU, f? } */
  rect.cmin = G_(function (cfg) {
    if (!isObj(cfg)) return NaN;
    if (cfg.topo !== 'einweg' && cfg.topo !== 'bruecke') return NaN;
    const f = cfg.f === undefined ? LV('f_netz') : cfg.f;
    if (!pos(cfg.I) || !pos(cfg.dU) || !pos(f)) return NaN;
    return cfg.I / ((cfg.topo === 'einweg' ? 1 : 2) * f * cfg.dU) * 1e6;
  });
  /* wave(cfg, n): Zeitverlauf im eingeschwungenen Zustand ueber ein numerisches Modell (implizites Euler-Verfahren, Diode leitet bei u_gleich - n_D*U_F >= u_C,
   * Quellwiderstand ri + rs, Konstantstrom- oder Widerstandslast). Eine Netzperiode ab dem Nulldurchgang der Sekundaerspannung.
   * -> { ok, t[], u2[], uc[], iD[] (Maximum je Abtastintervall), tLeit (Leitdauer je Impuls), pulses, fpMess, iPeak, iMean, Umax, Umin, dU, steady, periods } */
  rect.wave = S_(function (cfg, nPts) {
    const v = rectNorm(cfg, true);
    if (!v.ok) return v;
    if (!(v.peak > 0)) return fail('Die Sekundärspannung reicht nicht über die Durchlassspannungen hinaus.');
    const N = Math.round(clamp(num(nPts, 400), 8, 5000));
    const m = Math.max(1, Math.ceil(4000 / N));
    const spp = N * m, T = 1 / v.f, h = T / spp;
    const Rs = Math.max(v.ri + v.rs, 1e-6), Gs = 1 / Rs;
    const Cc = v.C, Gl = isNaN(v.R) ? 0 : 1 / v.R, iConst = isNaN(v.R) ? v.I : 0;
    const Um = v.U2 * Math.SQRT2, w = 2 * PI * v.f, nD = v.nD, uf = v.uf, bridge = v.topo === 'bruecke';
    let uc = Math.max(0, v.peak * 0.95), steady = false, periods = 0;
    const tr = { t: new Array(N), u2: new Array(N), uc: new Array(N), iD: new Array(N) };
    let st;
    function runPeriod(record) {
      let cond = 0, pulses = 0, prev = null, first = null, iPeak = 0, iSum = 0, Umax = -Infinity, Umin = Infinity;
      for (let k = 0; k < spp; k++) {
        const th = w * (k + 1) * h;
        const u2 = Um * Math.sin(th);
        const src = bridge ? Math.abs(u2) : Math.max(u2, 0);
        const eff = src - nD * uf;
        let ucn = (Cc / h * uc - iConst) / (Cc / h + Gl);       // gesperrt
        let iD = 0, on = 0;
        if (eff > 0) {
          const uCond = (Cc / h * uc + Gs * eff - iConst) / (Cc / h + Gs + Gl);
          if (uCond < eff) { ucn = uCond; on = 1; }
        }
        if (ucn < 0) ucn = 0;
        if (on) iD = Cc * (ucn - uc) / h + (iConst + Gl * ucn);
        if (iD < 0) iD = 0;
        uc = ucn;
        if (on) cond++;
        if (prev === null) first = on; else if (on && !prev) pulses++;
        prev = on;
        if (iD > iPeak) iPeak = iD;
        iSum += iD;
        if (uc > Umax) Umax = uc; if (uc < Umin) Umin = uc;
        if (record) {
          const i = Math.floor(k / m);
          if (k % m === m - 1) { tr.t[i] = (k + 1) * h; tr.u2[i] = u2; tr.uc[i] = uc; }
          if (k % m === 0) tr.iD[i] = iD; else if (iD > tr.iD[i]) tr.iD[i] = iD;
        }
      }
      if (first && !prev) pulses++;                       // Impuls ueber die Periodengrenze
      if (pulses === 0 && cond > 0) pulses = 1;           // durchgehend leitend
      return { cond: cond, pulses: pulses, iPeak: iPeak, iMean: iSum / spp, Umax: Umax, Umin: Umin, u0: uc };
    }
    let uStart;
    for (periods = 1; periods <= 40; periods++) {
      uStart = uc;
      st = runPeriod(false);
      if (Math.abs(uc - uStart) <= 1e-5 * v.peak && periods >= 2) { steady = true; break; }
    }
    st = runPeriod(true);
    periods++;
    const pulses = Math.max(st.pulses, st.cond > 0 ? 1 : 0);
    return { ok: true, t: tr.t, u2: tr.u2, uc: tr.uc, iD: tr.iD, tLeit: pulses > 0 ? st.cond * h / pulses : 0, pulses: pulses, fpMess: pulses * v.f,
      iPeak: st.iPeak, iMean: st.iMean, Umax: st.Umax, Umin: st.Umin, dU: st.Umax - st.Umin, steady: steady, periods: periods, peak: v.peak, fp: v.fp };
  });
  /* inrush: Einschaltstrom I_max = U_hat/(ri + rs) (Pool F2024-N07). cfg = { topo, U2, uf?, ri?, rs? } */
  rect.inrush = S_(function (cfg) {
    const v = rectNorm(cfg, false);
    if (!v.ok) return v;
    if (!(v.peak > 0)) return fail('Die Sekundärspannung reicht nicht über die Durchlassspannungen hinaus.');
    const Rges = v.ri + v.rs;
    const out = { ok: true, peak: v.peak, Rges: Rges, Imax: Rges > 0 ? v.peak / Rges : NaN, valid: Rges > 0, diag: [] };
    if (!out.valid) { out.why = TEXTS.get('inrush-kein-r').text; out.diag.push(TEXTS.get('inrush-kein-r')); }
    return out;
  });
  /* rcSieb: Brummspannung am RC-Glied U2 = U1 * Xc / sqrt(R^2 + Xc^2), Xc = 1/(2 pi fp C2). cfg = { U1 | Ubr, R, C (uF), fp | (topo, f?) } (Pool W2021-N44: 10,16 mV) */
  rect.rcSieb = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    const U1 = cfg.U1 !== undefined ? cfg.U1 : cfg.Ubr;
    if (!nn(U1)) return fail('Die Brummspannung am Eingang des RC-Glieds darf nicht negativ sein.');
    if (!pos(cfg.R)) return fail('Der Widerstand muss größer als 0 sein.');
    if (!pos(cfg.C)) return fail('Der Kondensator muss größer als 0 sein.');
    let fp = cfg.fp;
    if (fp === undefined) fp = rect.fp(cfg.topo === undefined ? 'bruecke' : cfg.topo, cfg.f);
    if (!pos(fp)) return fail('Die Pulsfrequenz muss größer als 0 sein.');
    const Xc = 1 / (2 * PI * fp * cfg.C * 1e-6);
    const U2 = U1 * Xc / Math.sqrt(cfg.R * cfg.R + Xc * Xc);
    return { ok: true, Xc: Xc, fp: fp, U2: U2, faktor: U1 > 0 ? U2 / U1 : Xc / Math.sqrt(cfg.R * cfg.R + Xc * Xc), fg: 1 / (2 * PI * cfg.R * cfg.C * 1e-6) };
  });
  /* decode('B80C1500'): Bezeichnung des Brueckengleichrichters (Pool F2023-N09): B = Bruecke, 80 = Nennanschlussspannung in V (Wechselspannung), C = kapazitive Last erlaubt, 1500 = Strom in mA */
  rect.decode = S_(function (str) {
    if (typeof str !== 'string') return fail('Die Bezeichnung muss ein Text sein.');
    const m = str.replace(/[\s ]/g, '').toUpperCase().match(/^B(\d{1,4})([CR])(\d{1,5})$/);
    if (!m) return fail('Die Bezeichnung passt nicht zum Muster B<Spannung>C<Strom in mA>, zum Beispiel B80C1500.');
    const mA = Number(m[3]);
    return { ok: true, code: 'B' + m[1] + m[2] + m[3], topo: 'bruecke', Uanschluss: Number(m[1]), kapazitiv: m[2] === 'C', last: m[2] === 'C' ? 'kapazitiv' : 'ohmsch', mA: mA, I: mA / 1000,
      text: 'Brückenschaltung, ' + m[1] + ' V Nennanschlussspannung, ' + (m[2] === 'C' ? 'kapazitive Belastung zulässig' : 'ohmsche Belastung') + ', ' + mA + ' mA Strombelastung' };
  });

  /* =====================================================================================================
   *  Z-DIODE (zener) - SPEC 4.3
   * ===================================================================================================== */
  const zener = C.zener = C.zener || {};
  /* stage(cfg): cfg = { Ue, Uz, Rv, Rlast | Ilast, rz?, izmin?, Pmax? }
   * -> { Iges, Ilast, Iz, Pz, Pr, eta, aktiv (Iz >= izmin), leitet (Iz > 0), Uaus, ueberlast?, diag } (Pool S2025-30: 13,60 mA) */
  zener.stage = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (!pos(cfg.Ue) || !pos(cfg.Uz)) return fail('Eingangs- und Z-Spannung müssen größer als 0 sein.');
    if (!pos(cfg.Rv)) return fail('Der Vorwiderstand muss größer als 0 sein.');
    let Il, Rl = NaN;
    if (cfg.Ilast !== undefined) {
      if (!nn(cfg.Ilast)) return fail('Der Laststrom darf nicht negativ sein.');
      Il = cfg.Ilast;
    } else if (cfg.Rlast !== undefined) {
      if (!pos(cfg.Rlast)) return fail('Der Lastwiderstand muss größer als 0 sein.');
      Rl = cfg.Rlast; Il = cfg.Uz / cfg.Rlast;
    } else return fail('Es fehlt der Laststrom oder der Lastwiderstand.');
    const rz = cfg.rz === undefined ? LV('rz') : cfg.rz;
    const izmin = cfg.izmin === undefined ? LV('iz_min') : cfg.izmin;
    if (!nn(rz) || !nn(izmin)) return fail('rz und Mindest-Z-Strom dürfen nicht negativ sein.');
    if (cfg.Pmax !== undefined && !pos(cfg.Pmax)) return fail('Die zulässige Verlustleistung muss größer als 0 sein.');
    const Iges = Math.max(0, (cfg.Ue - cfg.Uz) / cfg.Rv);
    const Iz = Iges - Il;
    const sperrt = cfg.Ue <= cfg.Uz;
    const aktiv = !sperrt && Iz >= izmin;
    const leitet = Iz > 0 && !sperrt;
    let Uaus;
    if (leitet) Uaus = cfg.Uz;                                   // Z-Diode klemmt (bei 0 < Iz < izmin schlecht, aktiv:false)
    else Uaus = isNaN(Rl) ? (Il > 0 ? Math.max(0, cfg.Ue - Il * cfg.Rv) : cfg.Ue) : cfg.Ue * Rl / (cfg.Rv + Rl);   // Z leitet nicht: nur Spannungsteiler
    if (!leitet && Uaus > cfg.Uz) Uaus = cfg.Uz;
    const Pz = leitet ? cfg.Uz * Iz : 0;
    const out = { ok: true, Ue: cfg.Ue, Uz: cfg.Uz, Rv: cfg.Rv, Rlast: Rl, Iges: Iges, Ilast: Il, Iz: leitet ? Iz : 0, IzRoh: Iz, Pz: Pz, Pr: (cfg.Ue > cfg.Uz ? (cfg.Ue - cfg.Uz) * (cfg.Ue - cfg.Uz) / cfg.Rv : 0),
      eta: Iges > 0 ? cfg.Uz * Il / (cfg.Ue * Iges) : NaN, aktiv: aktiv, leitet: leitet, Uaus: Uaus, rz: rz, izmin: izmin, diag: [] };
    if (sperrt) out.diag.push(TEXTS.get('z-sperrt', { ue: fmtEng(cfg.Ue, 'V'), uz: fmtEng(cfg.Uz, 'V') }));
    else if (!aktiv) out.diag.push(TEXTS.get('z-aus', { iz: fmtEng(Iz, 'A'), izmin: fmtEng(izmin, 'A') }));
    if (cfg.Pmax !== undefined) {
      out.Pmax = cfg.Pmax; out.ueberlast = Pz > cfg.Pmax;
      if (out.ueberlast) out.diag.push(TEXTS.get('z-ueberlast', { pz: fmtEng(Pz, 'W'), pmax: fmtEng(cfg.Pmax, 'W') }));
    }
    out.imModell = cfg.Ue <= LV('u_dc_max');
    if (!out.imModell) out.diag.push(TEXTS.get('modellgrenze', { grenze: fmtEng(LV('u_dc_max'), 'V') }));
    return out;
  });
  /* rvMin: kleinster Vorwiderstand im Leerlauf bei maximaler Eingangsspannung: R = (Ue_max - Uz) * Uz / Pmax. cfg = { Ue (max), Uz, Pmax } (Pool F2020-N22: 240 Ohm; H2020-N27: 373 Ohm) */
  zener.rvMin = G_(function (cfg) {
    if (!isObj(cfg)) return NaN;
    if (!pos(cfg.Ue) || !pos(cfg.Uz) || !pos(cfg.Pmax)) return NaN;
    if (cfg.Ue <= cfg.Uz) return NaN;
    return (cfg.Ue - cfg.Uz) * cfg.Uz / cfg.Pmax;
  });
  /* regulation: Ausgangsaenderung bei Aenderung der Eingangsspannung dUa = dUe * rz/(Rv + rz) (Lehrmodell, rz Uebungswert). cfg = { dUe, Rv, rz? } */
  zener.regulation = S_(function (cfg) {
    if (!isObj(cfg)) return fail('Eingabe fehlt.');
    if (typeof cfg.dUe !== 'number' || !isFinite(cfg.dUe) || Math.abs(cfg.dUe) > BIG) return fail('Die Änderung der Eingangsspannung muss eine Zahl sein.');
    if (!pos(cfg.Rv)) return fail('Der Vorwiderstand muss größer als 0 sein.');
    const rz = cfg.rz === undefined ? LV('rz') : cfg.rz;
    if (!nn(rz)) return fail('rz darf nicht negativ sein.');
    const f = rz / (cfg.Rv + rz);
    return { ok: true, dUa: cfg.dUe * f, faktor: f, S: f > 0 ? 1 / f : Infinity, rz: rz, rzStatus: cfg.rz === undefined ? 'A' : 'eingabe', model: 'Lehrmodell' };
  });
  /* @@ENDE@@ */
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
