/* emvcore.js - EMV-Lab Kern (EMV_CORE, Version 1.0)
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.EMV_CORE, Node: module.exports / globalThis.EMV_CORE.
 * Vanilla-JS, keine Abhaengigkeiten, kein eval. Alles Uebungswerte (Uebungsanlage), keine Vorhersage echter Geraete.
 * Herstellerdokumentation und aktuelle Norm massgeblich.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten: alle Funktionen rechnen in SI (Hz, V, A, F, H, Ohm, m, s, W, J). Pegel in dBuV (Effektwert, 1 uV = 0 dB),
 *    Feldstaerken in dBuV/m. Laengen (len, lp, h, s, r, d) in METERN, Flaechen in m^2 (Schleifenflaeche der Layout-Faelle in mm^2 ist Sache
 *    von emvcore-lay.js). Tastverhaeltnis duty und Jitter jit als BRUCHTEIL (0,5 / 0,06); Werte >= 1 bei duty und > 1 bei jit werden
 *    als Prozent gelesen (Schutz gegen Verwechslung, in ABWEICHUNGEN.md dokumentiert).
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte ohne Felder,
 *    negative oder riesige Werte) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }.
 *    Formeln ausserhalb ihres Gueltigkeitsbereichs melden valid:false mit Text und rechnen nie still weiter.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32). Gleiche Eingaben ergeben bitgleiche Ergebnisse.
 *  - Ampel-Ids ASCII: 'gruen' | 'gelb' | 'rot' | 'grau'; nameOf(ampel) liefert '✓ grün' / '! gelb' / '✗ rot' / '– grau'.
 *
 * ===================================================================================================
 * SCHNITTSTELLEN (Abschnitt 4 der SPEC ist massgeblich, hier die Festlegungen, die dort offen waren)
 *  Basis (M1): C0 MU0 EPS0 Z0 guard(fn,fb) rng(seed){next(),normal()} fmt(x,d) fmtEng(x,unit) parseNum(str) parseQty(str)->{v,raw,factor,unit,hasUnit}
 *    db{v,p,fromV,fromP,uv,toUv,dbm2dbuv,dbuv2dbm,sum,margin} glossary{items,normen,foreign,get,list} TEXTS levers
 *  spec (M1): lines(cfg) cfg {A, f0|T, tau|duty, tr, tf?, nMax?, fMax?, fMin?} -> {ok, lines:[{n,f,c,L}], c0, T, tau, tr, tf, t2, f1, f2} | {ok:false, why}
 *    c(cfg,n) -> Spitzenwert der n-ten Oberwelle; envelope(cfg) -> {c0, f1, f2, at(f), levelAt(f)}; level(c) = db.uv(c/sqrt2);
 *    jitterDelta(n,fs,jit,rbw) -> Pegelabsenkung in dB (>= 0); ringModel({L,C,Rv,Rs?,Cs?,isw?}) -> {ok, fr, zeta, os, z0, ur, wn, alpha, wd, ringing, roots};
 *    ring(cfg) -> Linien der Ringschwingung (cfg wie lines plus {L,C,Rv,Rs,Cs,isw}); check(cfg) -> {ok, why}
 *  coupling (M1): wires({s,h,r?,len}) -> {Ls,M,Cm,Cg je Meter, LsTot,MTot,CmTot,CgTot gesamt, shareE, shareH} total(cfg) shieldMag(f) twist(N) hum(cfg) dominant(res)
 *    total(cfg): cfg {s,h,r,len,f,us,rl,ro,schirm:'kein'|'eine'|'beide',twist(je m),sym:'unsym'|'sym'|bool,cmrr,gem,rgem,loop,dUg,rPE,uNutz,snrReq}
 *      -> {ok, valid, why?, uKap, uInd, uGalv, uSum, uBrumm, snr, margin, dominant, fCrit, cm, cg, m, ls, is, iBrumm, in:{...}}
 *  filter (M1): parts, il(cfg,f) -> {gg, gt, ggEff, gtEff} (dB, roh und mit Durchkopplungsgrenze), curve(cfg,fList), leak({cy,u,f}), fres(part), apply(lines,cfg,mode), satur(cfg)
 *    cfg {topo:'kein'|'C'|'LC'|'pi', cx, cy, drossel:'ohne'|'d1'|'d3'|'d10'|'d22', ld, lead(m!), ferrit, iLast}   (lead in METERN, 0,015 = 15 mm)
 *  shield (M2): materials skin(f,mat) se({mat,t,f,feld,r,rsq}) -> {A,R,B,se,delta,...} slot({len,f}) holes({n,d,f}) combine(listDb) cable({mode,lp,f,ish}) -> {zt,uIn,L,ratio}
 *    total(cfg) = Gesamtrechnung des Pruefstands schirm {mat,t,rsq,feld,r,f,slot,holes,dhole,kabel,lp,ish,seReq,uInReq} -> {seMat,seSlot,seHoles,seGes,uIn,leak,margin,ampel,text,...}
 *  antenna (M2): cableE({f,len,U,r,ferrit:'kein'|'x1'|'x2',...}) -> {E,L,iFoot,...} shortCM({f,len,I,r}) shortDM({f,A,I,r}) resonances(len,n)->Array, resonance(len,k)->Zahl, lambda(f)
 *    takt({fclk,tr,kcm,len,kabel,ferrit,r,klasse}) -> {lines:[{n,f,U,E,L,lim,margin}], worst, iCm, assess, fRes}; factor(cfg,fList)
 *  source.flyback(cfg) -> {tr,tf,dudt,f1,f2,pSw,ring:{fr,zeta,os,Z0,ur,pSnub,bump},cm:[{n,f,L}],dm:[...],clamped?}, source.defaults, chain.lisn({src|source, filter|filt|flt, klasse}) -> {lines:[{n,f,L,Lcm,Ldm}],worst,ring,src,assess,lMax,margin}, limits{at,pts,get,atDist,ids,list}, assess{conducted,radiated,margin,immunity,nameOf}
 *  diagnose(ctx) -> [{id,kind,text,fx?}] (ids: diagnose.ids), formulas (list(), fnInfo(id,...args)), exercise(kind, seed) (kinds: exercise.kinds, 20 Arten) -> {question,given,answer:{value,unit,scale,si,tol,tolType,alt},steps,check(input)->{ok,text}},
 *    runSeq(rigFactory|rigId|rig, seq, tEndS, opts) (M3)
 *
 *  ctx fuer diagnose (alle Felder optional, fehlende erzeugen nie eine Meldung):
 *    coup (Ergebnis von coupling.total), src (Ergebnis von source.flyback), lisn (Ergebnis von chain.lisn),
 *    filt {cfg, f} (Filterkonfiguration und betrachtete Frequenz), leakReq (A, nur Aufgabenvorgabe), leakA (A, sonst aus cfg.cy),
 *    shield {cfg} (cfg wie shield.total) oder {res}, antenna {len, lines:[{f,margin}]},
 *    layout {detourMm, areaMm2, areaDirectMm2}, abbl {c, lmountH, eslH}, pdnCurve [{f,z}] oder {f:[],z:[]},
 *    esd {verdict:{kriterium,vq,vabs,...}, vq, vabs, resetS (s), vil, w, wLimit}, burst {n, v, tau, gap}, varist {vacMax, w, wLimit},
 *    probe {os, lgH, fr}, pick {v, amp}, floorHit (bool/Anzahl), noLimit {id, f}
 *  TEXTS.diag/TEXTS.msg: einzige Quelle der Meldungen; TEXTS.get(id, vars).
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const TWO_PI = 2 * Math.PI;
  const LN10 = Math.LN10;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v); return isFinite(x) ? x : d; }
    return d;
  }
  function pos(v, d) { const x = num(v, NaN); return x > 0 ? x : d; }
  function nn(v, d) { const x = num(v, NaN); return x >= 0 ? x : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function obj(o) { return isObj(o) ? o : {}; }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function log10(x) { return Math.log(x) / LN10; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  /* C: Rechenfunktion -> NaN bei Ausnahme. S: Strukturfunktion -> { ok:false, why }. */
  function C(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail('Interner Fehler bei ungültiger Eingabe.'); } }; }
  function A(fn, bad) { return function () { try { return fn.apply(this, arguments); } catch (e) { return bad === undefined ? [] : bad; } }; }
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

  /* ---------- Konstanten ---------- */
  const C0 = 299792458, MU0 = 4 * Math.PI * 1e-7, EPS0 = 1 / (MU0 * C0 * C0), Z0 = MU0 * C0;
  api.version = '1.0';
  api.C0 = C0; api.MU0 = MU0; api.EPS0 = EPS0; api.Z0 = Z0;
  api.guard = guard;
  api.SIGMA = { kupfer: 5.8e7, alu: 3.5e7, stahl: 1.0e7 };

  /* ---------- Texte (einzige Quelle) ---------- */
  const TEXTS = {
    dbNull: 'Ein Verhältnis von 0 oder kleiner ist in dB nicht definiert.',
    norm: 'Herstellerdokumentation und aktuelle Norm maßgeblich.',
    uebung: 'Übungsanlage: Alle Zahlen sind Übungswerte, keine Vorhersage echter Geräte.',
    vorpruef: 'Diese Vorprüfung ersetzt keine Prüfung im akkreditierten Labor.',
    schutz: 'EMV-Maßnahmen ersetzen keine Schutzmaßnahmen.',
    geomUnmoeglich: 'Die Geometrie ist unmöglich (der Drahtradius muss kleiner als Höhe und halber Abstand sein).',
    flankeLang: 'Die Flanken sind länger als der Impuls oder die Pause: Das Signal ist kein Trapez mehr.',
    flankeNull: 'Die Flankenzeit muss größer als 0 sein.',
    periodeNull: 'Die Periodendauer muss größer als 0 sein.',
    keineZahl: 'Das ist keine Zahl. Gib eine Zahl ein, auch mit Einheit (zum Beispiel 2,2 nF).',
    eingabe: 'Mit diesen Werten gibt es kein Ergebnis.',
    langMsg: 'Die Leitung ist elektrisch lang (ℓ = {len} > λ/10 = {l10}): Das Modell aus Koppelkapazität und Gegeninduktivität gilt nur für elektrisch kurze Leitungen, der Pegel ist nur eine Größenordnung.',
    schlitzHalb: 'Der Schlitz ist so lang wie die halbe Wellenlänge: keine Schirmwirkung.',
    lochHalb: 'Das Loch ist so groß wie die halbe Wellenlänge: keine Schirmwirkung.',
    nahfeldGrenze: 'Die Nahfeldformel gilt nur für r < λ/(2π); darüber rechnet das Modell mit der Wellenimpedanz des freien Raums.',
    kurzkabelLang: 'Das Kabel ist nicht kurz (ℓ = {len} ≥ λ/10 = {l10}): Die Kurzkabelformel gilt nicht, nimm das Leitungsmodell.',
    unterRauschen: 'Unter dem Eigenrauschen des Analysators nicht messbar.',
    ohneGrenzwert: 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert.',
    knapp: 'Vorprüfung knapp: Im Labor mit Quasi-Spitzenwert und Mittelwert nachmessen.',
    gruenSatz: 'Vorprüfung bestanden: Alle Spitzenwerte liegen mindestens 6 dB unter der Mittelwert-Grenzlinie.',
    peakReihe: 'Der Spitzenwert ist nie kleiner als der Quasi-Spitzenwert, und der ist nie kleiner als der Mittelwert.',
    flankeKlemmt: 'Die Flanke ist länger als der Impuls erlaubt und wurde auf {tr} begrenzt.',
    lineZahl: 'Zu viele Linien: Der Anzeigebereich wurde auf {n} Linien begrenzt.',
    ampel: { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' },
    ampelSym: { gruen: '✓', gelb: '!', rot: '✗', grau: '–' },
    kriterium: {
      A: 'Kriterium A: normales Verhalten während und nach der Störung.',
      B: 'Kriterium B: kurze Beeinträchtigung, das Gerät erholt sich selbst.',
      C: 'Kriterium C: Bedienereingriff nötig.',
      Ausfall: 'Ausfall: Das Bauteil ist defekt.'
    },
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

  /* ---------- Zahlen: Ausgabe und Eingabe ---------- */
  /* fmt(x, digits): Dezimalkomma. Ohne digits: bis zu 4 gueltige Stellen, ueberfluessige Nullen entfallen. Nicht endlich: '–'. */
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
  const PREF = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  /* fmtEng(x, unit): Einheitenvorsatz so, dass 1...999 vor dem Komma steht, drei gueltige Stellen ("2,41 pF", "34,2 MHz"). */
  function fmtEng(x, unit) {
    x = num(x, NaN);
    const u = typeof unit === 'string' ? unit : '';
    if (!isFinite(x)) return '–';
    if (x === 0) return '0' + (u ? ' ' + u : '');
    const a = Math.abs(x);
    let p = PREF[PREF.length - 1];
    for (let i = 0; i < PREF.length; i++) { if (a >= PREF[i][0] * 0.99995) { p = PREF[i]; break; } }
    let v = x / p[0];
    let s = Math.abs(v) >= 99.95 ? String(Math.round(v)) : (Math.abs(v) >= 9.995 ? v.toFixed(1) : v.toFixed(2));
    if (Math.abs(Number(s)) >= 1000 && p[0] < 1e12) {
      const k = PREF.findIndex(function (q) { return q === p; });
      if (k > 0) { p = PREF[k - 1]; v = x / p[0]; s = Math.abs(v) >= 99.95 ? String(Math.round(v)) : (Math.abs(v) >= 9.995 ? v.toFixed(1) : v.toFixed(2)); }
    }
    return s.replace('.', ',') + ' ' + p[1] + u;
  }
  /* Zahlenkoerper (Komma/Punkt, Tausender) -> { v, rest } oder null */
  function numBody(str) {
    const s = str.replace(/−/g, '-').replace(/[   ]/g, ' ').trim();
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
      /* "3·10^8", "3*10^8", "3 x 10^8", "3·10⁸" */
      const t = rest.match(/^\s*(?:·|\*|x|×)\s*10\s*(?:\^|\*\*)?\s*([+-]?\d+)/i);
      if (t) { v = v * Math.pow(10, Number(t[1])); rest = rest.slice(t[0].length); }
      else {
        const sup = rest.match(/^\s*(?:·|\*|x|×)\s*10([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
        if (sup) {
          const map = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' };
          const e = sup[1].replace(/./g, function (c) { return map[c] || ''; });
          v = v * Math.pow(10, Number(e)); rest = rest.slice(sup[0].length);
        }
      }
    }
    v = sgn * v;
    return isFinite(v) ? { v: v, rest: rest } : null;
  }
  const PFX = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, c: 1e-2, m: 1e-3, 'µ': 1e-6, 'μ': 1e-6, u: 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 };
  const UNITS = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'J', 'm', 's', 'T', 'S', 'Vs'];
  /* parseQty(str) -> { v (SI, Vorsatz angewendet), raw (Zahl wie getippt), factor, unit (Rest), hasUnit } oder null */
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
    let f = 1, hasU = true, base = u;
    if (/^(dB|%|°)/.test(u)) { f = 1; }
    else if (u === 'Meg') f = 1e6;
    else if (UNITS.indexOf(u) >= 0) f = 1;
    else if (u.length >= 2 && PFX[u[0]] !== undefined && UNITS.indexOf(u.slice(1)) >= 0) f = PFX[u[0]];
    else if (u.length === 1 && PFX[u] !== undefined) f = PFX[u];
    else if (/^[A-Za-zµμΩ/·²³]+$/.test(u)) f = 1;
    else return null;
    if (sq) f = f * f;
    return { v: b.v * f, raw: b.v, factor: f, unit: base, hasUnit: hasU };
  }
  /* parseNum(str): Zahl mit Komma oder Punkt, Einheitenvorsatz (n, µ, m, k, M, G ...) und Einheit toleriert: "2,2 nF" -> 2.2e-9, "30 MHz" -> 3e7,
   * "45 dBµV" -> 45, "5 m" -> 5 (Meter, nicht Milli). Zahl oder NaN. */
  function parseNum(str) {
    try { const q = parseQty(str); return q ? (isFinite(q.v) ? q.v : NaN) : NaN; } catch (e) { return NaN; }
  }
  api.fmtEng = function (x, u) { try { return fmtEng(x, u); } catch (e) { return '–'; } };
  api.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  api.parseNum = parseNum; api.parseQty = function (s) { try { return parseQty(s); } catch (e) { return null; } };

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
      let u = 0, v = 0;
      while (u === 0) u = next();
      v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(TWO_PI * v);
      return r * Math.cos(TWO_PI * v);
    }
    return { next: next, normal: normal };
  }
  api.rng = rng;

  /* ---------- dB ---------- */
  const db = {
    v: C(function (r) { r = num(r, NaN); return r > 0 ? 20 * log10(r) : NaN; }),
    p: C(function (r) { r = num(r, NaN); return r > 0 ? 10 * log10(r) : NaN; }),
    fromV: C(function (d) { d = num(d, NaN); return isFinite(d) ? Math.pow(10, d / 20) : NaN; }),
    fromP: C(function (d) { d = num(d, NaN); return isFinite(d) ? Math.pow(10, d / 10) : NaN; }),
    uv: C(function (u) { u = num(u, NaN); return u > 0 ? 20 * log10(u / 1e-6) : NaN; }),
    toUv: C(function (d) { d = num(d, NaN); return isFinite(d) ? 1e-6 * Math.pow(10, d / 20) : NaN; }),
    dbm2dbuv: C(function (x) { x = num(x, NaN); return x + 106.99; }),
    dbuv2dbm: C(function (x) { x = num(x, NaN); return x - 106.99; }),
    sum: C(function (list) {
      if (!isArr(list) || !list.length) return NaN;
      let s = 0;
      for (let i = 0; i < list.length; i++) { const x = num(list[i], NaN); if (!isFinite(x)) return NaN; s += Math.pow(10, x / 10); }
      return 10 * log10(s);
    }),
    margin: C(function (limit, level) { limit = num(limit, NaN); level = num(level, NaN); return limit - level; })
  };
  api.db = db;
  function uvOf(u) { return u > 0 ? 20 * log10(u / 1e-6) : NaN; }

  /* ---------- Hebel (einzige Quelle der Namen) ---------- */
  api.levers = {
    quelle: { id: 'quelle', name: 'Quelle entschärfen', short: 'Quelle' },
    pfad: { id: 'pfad', name: 'Kopplung verringern', short: 'Pfad' },
    senke: { id: 'senke', name: 'Senke härten', short: 'Senke' }
  };

  /* =============================== 4.1 Spektrum der Trapezfolge =============================== */
  /* Normalisierung der Trapez-Konfiguration. Gibt { ok, A, T, tau, tr, tf, t2 } oder Fehler. */
  function trapCfg(cfg) {
    cfg = obj(cfg);
    const Aamp = num(cfg.A, num(cfg.amp, 1));
    let T = num(cfg.T, NaN);
    if (!(T > 0)) { const f0 = num(cfg.f0, num(cfg.fs, NaN)); T = f0 > 0 ? 1 / f0 : NaN; }
    if (!(T > 0)) return fail(TEXTS.periodeNull);
    let tau = num(cfg.tau, NaN);
    if (!(tau > 0)) {
      let D = num(cfg.duty, num(cfg.D, NaN));
      if (D >= 1) D = D / 100;
      tau = D > 0 ? D * T : NaN;
    }
    if (!(tau > 0)) return fail('Die Impulsbreite muss größer als 0 sein.');
    const tr = num(cfg.tr, NaN);
    if (!(tr > 0)) return fail(TEXTS.flankeNull);
    const tf = num(cfg.tf, tr);
    if (!(tf > 0)) return fail(TEXTS.flankeNull);
    const t2 = tau + tr / 2 - tf / 2;
    if (!(t2 >= tr * (1 - 1e-12)) || !(t2 + tf <= T * (1 + 1e-12))) return fail(TEXTS.flankeLang);
    return { ok: true, A: Aamp, T: T, tau: tau, tr: tr, tf: tf, t2: t2 };
  }
  /* Spitzenwert der n-ten Oberwelle (stabile Form der exakten Formel, siehe SPEC 4.1):
   * c_n = 2A/(T*w) * | sinc(w*tr/2) - sinc(w*tf/2) * e^(-j*w*tau) |, w = 2*pi*n/T. */
  function cnOf(p, n) {
    const w = TWO_PI * n / p.T;
    const xr = w * p.tr / 2, xf = w * p.tf / 2;
    const sr = xr === 0 ? 1 : Math.sin(xr) / xr, sf = xf === 0 ? 1 : Math.sin(xf) / xf;
    const ph = w * p.tau;
    const re = sr - sf * Math.cos(ph), im = sf * Math.sin(ph);
    return (2 * p.A / (p.T * w)) * Math.hypot(re, im);
  }
  const specLevel = C(function (c) { c = num(c, NaN); return c > 0 ? uvOf(c / Math.SQRT2) : NaN; });
  function linesOf(p, cfg) {
    cfg = obj(cfg);
    const fMin = nn(cfg.fMin, 9e3), fMax = pos(cfg.fMax, 30e6);
    const fs = 1 / p.T;
    let n0 = Math.max(1, Math.ceil(fMin / fs - 1e-9)), n1 = Math.floor(fMax / fs + 1e-9);
    const nMaxCfg = num(cfg.nMax, NaN);
    if (nMaxCfg >= 1) n1 = Math.min(n1, Math.floor(nMaxCfg));
    const NCAP = 30000;
    let truncated = false;
    if (n1 - n0 + 1 > NCAP) { n1 = n0 + NCAP - 1; truncated = true; }
    const lines = [];
    for (let n = n0; n <= n1; n++) {
      const c = cnOf(p, n);
      lines.push({ n: n, f: n * fs, c: c, L: c > 0 ? uvOf(c / Math.SQRT2) : -300 });
    }
    return { lines: lines, truncated: truncated };
  }
  function envOf(p) {
    const trE = Math.max(p.tr, p.tf);
    const c0 = 2 * p.A * p.tau / p.T;
    const f1 = 1 / (Math.PI * p.tau), f2 = 1 / (Math.PI * trE);
    function at(f) {
      f = num(f, NaN);
      if (!(f > 0)) return NaN;
      let c = c0;
      if (f > f1) c *= f1 / f;
      if (f > f2) c *= f2 / f;
      return c;
    }
    return { c0: c0, f1: f1, f2: f2, trEff: trE, at: C(at), levelAt: C(function (f) { const c = at(f); return c > 0 ? uvOf(c / Math.SQRT2) : NaN; }) };
  }
  /* ---- Ringing: Polynomwurzeln ---- */
  function cadd(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function cmul(a, b) { return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]]; }
  function cdiv(a, b) { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }
  function cabs(a) { return Math.hypot(a[0], a[1]); }
  function csub(a, b) { return [a[0] - b[0], a[1] - b[1]]; }
  /* Wurzeln eines reellen Polynoms (Koeffizienten von der hoechsten Potenz), Durand-Kerner mit Newton-Nachlauf */
  function polyRoots(co) {
    let a = co.slice();
    while (a.length > 1 && a[0] === 0) a.shift();
    const n = a.length - 1;
    if (n < 1) return [];
    const lead = a[0];
    a = a.map(function (x) { return x / lead; });
    if (n === 1) return [[-a[1], 0]];
    function pv(z) { let r = [1, 0]; for (let i = 1; i <= n; i++) r = cadd(cmul(r, z), [a[i], 0]); return r; }
    function dpv(z) { let r = [n, 0]; for (let i = 1; i < n; i++) r = cadd(cmul(r, z), [(n - i) * a[i], 0]); return r; }
    let rad = 0;
    for (let i = 1; i <= n; i++) rad = Math.max(rad, Math.pow(Math.abs(a[i]), 1 / i));
    rad = rad * 1.3 + 1e-30;
    const z = [];
    for (let k = 0; k < n; k++) { const ang = TWO_PI * k / n + 0.4; z.push([rad * Math.cos(ang), rad * Math.sin(ang)]); }
    for (let it = 0; it < 500; it++) {
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        let den = [1, 0];
        for (let j = 0; j < n; j++) if (j !== i) den = cmul(den, csub(z[i], z[j]));
        if (cabs(den) === 0) den = [1e-30, 0];
        const d = cdiv(pv(z[i]), den);
        z[i] = csub(z[i], d);
        maxd = Math.max(maxd, cabs(d));
      }
      if (maxd < 1e-15 * rad) break;
    }
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 6; k++) {
        const dp = dpv(z[i]);
        if (cabs(dp) === 0) break;
        z[i] = csub(z[i], cdiv(pv(z[i]), dp));
      }
      if (Math.abs(z[i][1]) < 1e-12 * Math.max(1, Math.abs(z[i][0]))) z[i][1] = 0;
    }
    return z;
  }
  api._polyRoots = A(polyRoots);
  /* ringModel: Reihenschwingkreis L, C, Rv mit RC-Snubber (Rs, Cs) parallel zu C (SPEC 4.1) */
  function ringModelRaw(c) {
    c = obj(c);
    const L = num(c.L, num(c.lp, NaN)), Cc = num(c.C, num(c.coss, NaN)), Rv = num(c.Rv, num(c.rv, NaN));
    if (!(L > 0) || !(Cc > 0) || !(Rv >= 0)) return fail('Für das Ringing brauchst du Streuinduktivität, Ausgangskapazität und Verlustwiderstand größer als 0.');
    let Rs = num(c.Rs, num(c.rs, 0)), Cs = num(c.Cs, num(c.cs, 0));
    if (!(Cs > 0) || !(Rs >= 0)) { Cs = 0; Rs = 0; }
    const wn = 1 / Math.sqrt(L * Cc), z0 = Math.sqrt(L / Cc);
    const a3 = L * Cc * Rs * Cs, a2 = L * (Cc + Cs) + Rv * Cc * Rs * Cs, a1 = Rv * (Cc + Cs) + Rs * Cs;
    const coef = Cs > 0 && Rs > 0 ? [a3, a2, a1, 1] : (Cs > 0 ? [L * (Cc + Cs), Rv * (Cc + Cs), 1] : [L * Cc, Rv * Cc, 1]);
    const roots = polyRoots(coef);
    let best = null;
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i];
      if (r[1] > 0) {
        const mag = cabs(r), zeta = -r[0] / mag;
        if (!best || zeta < best.zeta) best = { zeta: zeta, alpha: -r[0], wd: r[1], mag: mag };
      }
    }
    const out = { ok: true, z0: z0, wn: wn, roots: roots, coef: coef, L: L, C: Cc, Rv: Rv, Rs: Rs, Cs: Cs, isw: num(c.isw, NaN) };
    if (best) {
      out.zeta = best.zeta; out.alpha = best.alpha; out.wd = best.wd;
      out.fr = best.wd / TWO_PI;
      out.os = best.zeta < 1 && best.zeta > -1 ? Math.exp(-Math.PI * best.zeta / Math.sqrt(1 - best.zeta * best.zeta)) : 0;
      if (best.zeta <= 0) out.os = 1;
      out.ringing = true;
    } else {
      out.zeta = 1; out.alpha = wn; out.wd = 0; out.fr = wn / TWO_PI; out.os = 0; out.ringing = false;
    }
    out.ur = fin(out.isw) ? out.isw * z0 : NaN;
    return out;
  }
  /* Spektrallinie der Ringschwingung: c_n = (2/T)*|F(w_n)|*|1 - e^(-j*w_n*tau)|, F = Ur*(alpha + jw)/((alpha + jw)^2 + wd^2) */
  function ringLineOf(m, T, tau, n) {
    if (!m || !m.ok || !m.ringing || !(m.ur > 0)) return 0;
    const w = TWO_PI * n / T;
    const num_ = [m.alpha, w];
    const den = cadd(cmul(num_, num_), [m.wd * m.wd, 0]);
    const F = cdiv([m.ur * num_[0], m.ur * num_[1]], den);
    const e = [1 - Math.cos(w * tau), Math.sin(w * tau)];
    return (2 / T) * cabs(F) * cabs(e);
  }

  const spec = {};
  spec.check = S(function (cfg) { const p = trapCfg(cfg); return p.ok ? { ok: true } : p; });
  spec.lines = S(function (cfg) {
    const p = trapCfg(cfg);
    if (!p.ok) return p;
    const r = linesOf(p, cfg), e = envOf(p);
    const out = { ok: true, lines: r.lines, c0: p.A * p.tau / p.T, T: p.T, tau: p.tau, tr: p.tr, tf: p.tf, t2: p.t2, f1: e.f1, f2: e.f2, A: p.A };
    if (r.truncated) out.truncated = true;
    return out;
  });
  spec.c = C(function (cfg, n) { const p = trapCfg(cfg); n = num(n, NaN); if (!p.ok || !(n >= 1)) return NaN; return cnOf(p, n); });
  spec.envelope = S(function (cfg) {
    const p = trapCfg(cfg);
    if (!p.ok) return p;
    const e = envOf(p);
    return { ok: true, c0: e.c0, f1: e.f1, f2: e.f2, trEff: e.trEff, at: e.at, levelAt: e.levelAt, note: p.tr !== p.tf ? 'Für unterschiedliche Flanken gilt tr = größere der beiden Zeiten.' : '' };
  });
  spec.level = specLevel;
  spec.jitterDelta = C(function (n, fs, jit, rbw) {
    n = num(n, NaN); fs = num(fs, NaN); let j = num(jit, NaN); rbw = pos(rbw, 9e3);
    if (!(n >= 0) || !(fs > 0) || !(j >= 0)) return NaN;
    if (j > 1) j = j / 100;
    const delta = 2 * n * fs * j;
    return delta > rbw ? 10 * log10(delta / rbw) : 0;
  });
  spec.ringModel = S(ringModelRaw);
  spec.ring = S(function (cfg) {
    cfg = obj(cfg);
    const p = trapCfg(Object.assign({ tr: 1e-12 }, cfg, { A: 1 }));
    if (!p.ok) return p;
    const m = cfg.model && cfg.model.ok ? cfg.model : ringModelRaw(cfg);
    if (!m.ok) return m;
    const r = linesOf(p, cfg);
    const lines = r.lines.map(function (l) {
      const c = ringLineOf(m, p.T, p.tau, l.n);
      return { n: l.n, f: l.f, c: c, L: c > 0 ? uvOf(c / Math.SQRT2) : -300 };
    });
    return { ok: true, lines: lines, model: m };
  });
  api.spec = spec;

  /* =============================== 4.2 Kopplung =============================== */
  /* Laengen (lead, lp, Schlitz, Lochdurchmesser) oberhalb einer Grenze gelten als Millimeter (siehe Kopfkommentar). */
  function lenMeter(v, maxM, dflt) { const x = num(v, NaN); if (!isFinite(x)) return dflt; return x > maxM ? x / 1000 : x; }
  const K_SF = { rsh: 0.015, lsh: 0.5e-6 }; /* Schirm: 15 mOhm/m, 0,5 uH/m -> fc = 4,77 kHz */
  const FC_SHIELD = K_SF.rsh / (TWO_PI * K_SF.lsh);
  const coupling = {};
  coupling.fc = FC_SHIELD;
  coupling.shieldMag = C(function (f) { f = num(f, NaN); if (!(f >= 0)) return NaN; return 1 / Math.sqrt(1 + (f / FC_SHIELD) * (f / FC_SHIELD)); });
  coupling.twist = C(function (N) { N = num(N, NaN); if (!(N >= 0)) return NaN; return Math.max(1 / (1 + N), 0.01); });
  function geomOf(cfg) {
    cfg = obj(cfg);
    const s = num(cfg.s, 0.01), h = num(cfg.h, 0.01), r = num(cfg.r, 0.25e-3), len = num(cfg.len, 1);
    if (!(s > 0) || !(h > 0) || !(r > 0) || !(len > 0) || !(r < h) || !(r < s / 2)) return fail(TEXTS.geomUnmoeglich);
    const ls = MU0 / TWO_PI * Math.log(2 * h / r);
    const m = MU0 / (4 * Math.PI) * Math.log(1 + (2 * h / s) * (2 * h / s));
    const k = MU0 * EPS0, den = ls * ls - m * m;
    const cm = k * m / den, cg = k * (ls - m) / den;
    /* Ls, M, Cm, Cg (gross) = je Meter; LsTot, MTot, CmTot, CgTot (gross) und ls, m, cm, cg (klein) = Gesamtwerte mal Laenge */
    return {
      ok: true, s: s, h: h, r: r, len: len, Ls: ls, M: m, Cm: cm, Cg: cg, LsTot: ls * len, MTot: m * len, CmTot: cm * len, CgTot: cg * len,
      lsPm: ls, mPm: m, cmPm: cm, cgPm: cg, ls: ls * len, m: m * len, cm: cm * len, cg: cg * len, shareE: cm / (cm + cg), shareH: m / ls
    };
  }
  coupling.wires = S(function (cfg) { return geomOf(cfg); });
  function humOf(cfg, g) {
    cfg = obj(cfg);
    const len = g ? g.len : num(cfg.len, 1);
    const schirm = cfg.schirm === 'beide' ? 'beide' : (cfg.schirm === 'eine' ? 'eine' : 'kein');
    const sym = cfg.sym === true || cfg.sym === 'sym';
    const cmrr = pos(cfg.cmrr, 60);
    const rret = (schirm === 'beide' ? 0.015 : 0.07) * len;
    const rPE = nn(cfg.rPE, 0.5), dUg = nn(cfg.dUg, 0.5);
    const loop = cfg.loop === true || cfg.loop === 'ein' || cfg.loop === 1;
    let u = 0, i = 0;
    if (loop) {
      u = dUg * rret / (rret + rPE);
      i = dUg / (rret + rPE);
      if (sym) u = u * Math.pow(10, -cmrr / 20);
    }
    return { ok: true, uBrumm: u, rret: rret, iLoop: loop ? i : 0, loop: loop, rPE: rPE, dUg: dUg, f: 50 };
  }
  coupling.hum = S(function (cfg) { const g = geomOf(cfg); if (!g.ok) return g; return humOf(cfg, g); });
  coupling.total = S(function (cfg) {
    cfg = obj(cfg);
    const g = geomOf(cfg);
    if (!g.ok) return g;
    const f = pos(cfg.f, 1e6), us = nn(cfg.us, 24), rl = pos(cfg.rl, 48), ro = pos(cfg.ro, 1e4);
    const schirm = cfg.schirm === 'beide' ? 'beide' : (cfg.schirm === 'eine' ? 'eine' : 'kein');
    const sym = cfg.sym === true || cfg.sym === 'sym';
    const cmrr = pos(cfg.cmrr, 60);
    const tw = nn(cfg.twist, 0), N = tw * g.len;
    const gem = cfg.gem === true || cfg.gem === 'ein' || cfg.gem === 1;
    const rgem = nn(cfg.rgem, 0.05);
    const uNutz = pos(cfg.uNutz, 0.1), snrReq = num(cfg.snrReq, 40);
    const w = TWO_PI * f, rp = ro / 2, is = us / rl;
    const lam = C0 / f, l10 = lam / 10, fCrit = C0 / (10 * g.len);
    let kap = us * (w * g.cm * rp) / Math.sqrt(1 + Math.pow(w * (g.cm + g.cg) * rp, 2));
    let ind = 0.5 * w * g.m * is;
    const galv = gem ? is * Math.hypot(rgem, w * 1e-6 * g.len) : 0;
    const sf = schirm === 'beide' ? coupling.shieldMag(f) : 1;
    const tf = coupling.twist(N);
    const fk = { schirm: schirm === 'kein' ? 1 : 0.01, sym: sym ? Math.max(Math.pow(10, -cmrr / 20), 0.3 / (1 + N)) : 1 };
    const fi = { schirm: schirm === 'beide' ? sf : 1, twist: tw > 0 ? tf : 1 };
    kap = kap * fk.schirm * fk.sym;
    ind = ind * fi.schirm * fi.twist;
    const hum = humOf(cfg, g);
    const uSum = kap + ind + galv;
    const tot = uSum + hum.uBrumm;
    const snr = tot > 0 ? Math.min(200, 20 * log10(uNutz / tot)) : 200;
    const valid = g.len <= l10 * (1 + 1e-12);
    const res = {
      ok: true, valid: valid, uKap: kap, uInd: ind, uGalv: galv, uSum: uSum, uBrumm: hum.uBrumm, snr: snr, margin: snr - snrReq,
      fCrit: fCrit, cm: g.cm, cg: g.cg, m: g.m, ls: g.ls, cmPm: g.cmPm, cgPm: g.cgPm, mPm: g.mPm, lsPm: g.lsPm, is: is, iLoop: hum.iLoop, iBrumm: hum.iLoop, rret: hum.rret,
      sf: sf, twistF: fi.twist, lambda: lam, l10: l10, N: N,
      dominant: null, in: { f: f, us: us, rl: rl, ro: ro, schirm: schirm, sym: sym, cmrr: cmrr, twist: tw, len: g.len, gem: gem, loop: hum.loop, uNutz: uNutz, snrReq: snrReq, dUg: hum.dUg }
    };
    res.dominant = coupling.dominant(res);
    if (!valid) res.why = TEXTS.get('langMsg', { len: fmtEng(g.len, 'm'), l10: fmtEng(l10, 'm') });
    return res;
  });
  coupling.dominant = function (res) {
    try {
      res = obj(res);
      const a = [['kapazitiv', num(res.uKap, 0)], ['induktiv', num(res.uInd, 0)], ['galvanisch', num(res.uGalv, 0)]];
      let best = null;
      for (let i = 0; i < a.length; i++) if (a[i][1] > 0 && (!best || a[i][1] > best[1])) best = a[i];
      return best ? best[0] : null;
    } catch (e) { return null; }
  };
  api.coupling = coupling;

  /* =============================== 4.3 Filter =============================== */
  const DROSSELN = {
    d1: { id: 'd1', name: '1 mH', l: 1e-3, cw: 8e-12, in: 8, isat: 12 },
    d3: { id: 'd3', name: '3,3 mH', l: 3.3e-3, cw: 12e-12, in: 4, isat: 6 },
    d10: { id: 'd10', name: '10 mH', l: 10e-3, cw: 25e-12, in: 2, isat: 3 },
    d22: { id: 'd22', name: '22 mH', l: 22e-3, cw: 45e-12, in: 1, isat: 1.5 }
  };
  const FPARTS = {
    cx: { esr: 0.02, esl0: 5e-9 }, cy: { esr: 0.05, esl0: 6e-9 }, eslPerM: 1e-6, /* 1 nH/mm */
    drossel: DROSSELN, rp: 5000, ldFrac: 0.01, ferritR100: 100, durchkopplung: 80, rGG: 100, rGT: 25,
    cxValues: [0, 10e-9, 47e-9, 100e-9, 330e-9, 1e-6], cyValues: [0, 1e-9, 2.2e-9, 4.7e-9],
    topos: ['kein', 'C', 'LC', 'pi'], drosselIds: ['ohne', 'd1', 'd3', 'd10', 'd22'],
    defaults: { topo: 'pi', cx: 100e-9, cy: 2.2e-9, drossel: 'd10', ld: 0, lead: 0.015, ferrit: false, iLast: 0 }
  };
  function fcfg(cfg) {
    cfg = obj(cfg);
    const d = FPARTS.defaults;
    const topo = FPARTS.topos.indexOf(cfg.topo) >= 0 ? cfg.topo : d.topo;
    const dr = FPARTS.drosselIds.indexOf(cfg.drossel) >= 0 ? cfg.drossel : d.drossel;
    return {
      topo: topo, cx: nn(cfg.cx, d.cx), cy: nn(cfg.cy, d.cy), drossel: dr, ld: nn(cfg.ld, d.ld), lead: lenMeter(cfg.lead, 0.5, d.lead),
      ferrit: cfg.ferrit === true || cfg.ferrit === 'ein' || cfg.ferrit === 1, iLast: nn(cfg.iLast, d.iLast)
    };
  }
  function rfOf(f) { return FPARTS.ferritR100 * Math.sqrt(f / 100e6); }
  /* Kondensatorzweig: ESR + j*w*ESL + 1/(jwC) als [re, im] (C <= 0: fehlt -> null) */
  function capZ(w, c, esr, esl) { if (!(c > 0)) return null; return [esr, w * esl - 1 / (w * c)]; }
  function chokeLeff(dr, iLast) { if (dr === 'ohne') return 0; const d = DROSSELN[dr]; return d.l / (1 + (iLast / d.isat) * (iLast / d.isat)); }
  function chokeZ(w, L, cw) {
    const zl = [0, w * L], zc = [0, -1 / (w * cw)];
    const p1 = cdiv(cmul(zl, zc), cadd(zl, zc));
    return cdiv(cmul(p1, [FPARTS.rp, 0]), cadd(p1, [FPARTS.rp, 0]));
  }
  /* Kettenmatrix: Querzweige und Reihenzweig von der Quelle zur Last, IL = 20 lg |(A Zl + B + C Zs Zl + D Zs)/(Zs + Zl)| */
  function ilLadder(sh1, ser, sh2, zs, zl) {
    let A_ = [1, 0], B_ = [0, 0], C_ = [0, 0], D_ = [1, 0];
    function shunt(z) { const y = cdiv([1, 0], z); const nA = cadd(A_, cmul(B_, y)), nC = cadd(C_, cmul(D_, y)); A_ = nA; C_ = nC; }
    function series(z) { const nB = cadd(cmul(A_, z), B_), nD = cadd(cmul(C_, z), D_); B_ = nB; D_ = nD; }
    if (sh1) shunt(sh1);
    if (ser) series(ser);
    if (sh2) shunt(sh2);
    const n = cadd(cadd(cmul(A_, [zl, 0]), B_), cadd(cmul(cmul(C_, [zs, 0]), [zl, 0]), cmul(D_, [zs, 0])));
    const r = cabs(cdiv(n, [zs + zl, 0]));
    return r > 0 ? 20 * log10(r) : 400;
  }
  function ilEffOf(il) { return -20 * log10(Math.pow(10, -il / 20) + Math.pow(10, -FPARTS.durchkopplung / 20)); }
  function ilAt(c, f, ideal) {
    const w = TWO_PI * f, lead = ideal ? 0 : c.lead * FPARTS.eslPerM;
    const cx = capZ(w, c.cx, FPARTS.cx.esr, (ideal ? 0 : FPARTS.cx.esl0) + lead);
    const cy = capZ(w, 2 * c.cy, FPARTS.cy.esr, (ideal ? 0 : FPARTS.cy.esl0) + lead);
    const hasSh = c.topo !== 'kein', hasSer = c.topo !== 'C', hasSh2 = c.topo === 'pi';
    /* Gegentakt: Reihenzweig Ld, Querzweig Cx; je 100 Ohm */
    const Lcm = c.drossel === 'ohne' ? 0 : DROSSELN[c.drossel].l;
    const Ld = FPARTS.ldFrac * Lcm + c.ld;
    const serGG = hasSer && Ld > 0 ? [0, w * Ld] : null;
    const gg = ilLadder(hasSh ? cx : null, serGG, hasSh2 ? cx : null, FPARTS.rGG, FPARTS.rGG);
    /* Gleichtakt: Reihenzweig Drossel (+ Ferrit), Querzweig 2 Cy; je 25 Ohm */
    let serGT = null;
    if (hasSer && c.drossel !== 'ohne') serGT = chokeZ(w, chokeLeff(c.drossel, c.iLast), ideal ? 1e-18 : DROSSELN[c.drossel].cw);
    if (c.ferrit) serGT = serGT ? cadd(serGT, [rfOf(f), 0]) : [rfOf(f), 0];
    const gt = ilLadder(hasSh ? cy : null, serGT, hasSh2 ? cy : null, FPARTS.rGT, FPARTS.rGT);
    return { gg: gg, gt: gt, ggEff: ilEffOf(gg), gtEff: ilEffOf(gt) };
  }
  const filter = {};
  filter.parts = FPARTS;
  filter.il = S(function (cfg, f, mode) {
    f = num(f, NaN);
    const num_ = mode === 'gg' || mode === 'gt' || mode === 'ggEff' || mode === 'gtEff';
    if (!(f > 0)) return num_ ? NaN : fail('Die Frequenz muss größer als 0 sein.');
    const r = ilAt(fcfg(cfg), f);
    if (num_) return r[mode];
    return { ok: true, f: f, gg: r.gg, gt: r.gt, ggEff: r.ggEff, gtEff: r.gtEff };
  });
  filter.ilIdeal = S(function (cfg, f) { f = num(f, NaN); if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.'); const r = ilAt(fcfg(cfg), f, true); return { ok: true, f: f, gg: r.gg, gt: r.gt, ggEff: r.ggEff, gtEff: r.gtEff }; });
  filter.curve = S(function (cfg, fList) {
    if (!isArr(fList)) return fail('Die Frequenzliste fehlt.');
    const c = fcfg(cfg), out = { ok: true, f: [], gg: [], gt: [], ggEff: [], gtEff: [] };
    for (let i = 0; i < fList.length && i < 20000; i++) {
      const f = num(fList[i], NaN);
      if (!(f > 0)) { out.f.push(NaN); out.gg.push(NaN); out.gt.push(NaN); out.ggEff.push(NaN); out.gtEff.push(NaN); continue; }
      const r = ilAt(c, f);
      out.f.push(f); out.gg.push(r.gg); out.gt.push(r.gt); out.ggEff.push(r.ggEff); out.gtEff.push(r.gtEff);
    }
    return out;
  });
  filter.leak = C(function (o) { o = obj(o); const cy = nn(o.cy, NaN), u = pos(o.u, 230), f = pos(o.f, 50); return TWO_PI * f * cy * u; });
  filter.fres = C(function (p) {
    p = obj(p);
    if (p.type === 'drossel' || p.type === 'choke') { const d = DROSSELN[p.id]; if (!d) return NaN; return 1 / (TWO_PI * Math.sqrt(d.l * d.cw)); }
    if (p.type === 'cx' || p.type === 'cy') {
      const esl = (p.type === 'cx' ? FPARTS.cx.esl0 : FPARTS.cy.esl0) + lenMeter(p.lead, 0.5, 0.015) * FPARTS.eslPerM;
      const c = num(p.c, NaN); return c > 0 ? 1 / (TWO_PI * Math.sqrt(esl * c)) : NaN;
    }
    const l = num(p.l, NaN), cw = num(p.cw, NaN), c = num(p.c, NaN), esl = num(p.esl, NaN);
    if (l > 0 && cw > 0) return 1 / (TWO_PI * Math.sqrt(l * cw));
    if (c > 0 && esl > 0) return 1 / (TWO_PI * Math.sqrt(esl * c));
    return NaN;
  });
  filter.esl = C(function (type, lead) { return (type === 'cy' ? FPARTS.cy.esl0 : FPARTS.cx.esl0) + lenMeter(lead, 0.5, 0.015) * FPARTS.eslPerM; });
  filter.satur = C(function (cfg) { const c = fcfg(cfg); if (c.drossel === 'ohne') return 100; return 100 * chokeLeff(c.drossel, c.iLast) / DROSSELN[c.drossel].l; });
  filter.apply = A(function (lines, cfg, mode) {
    if (!isArr(lines)) return [];
    const c = fcfg(cfg), gt = mode === 'gt' || mode === 'GT' || mode === 'cm';
    return lines.map(function (l) {
      const o = Object.assign({}, l);
      const f = num(l && l.f, NaN);
      if (f > 0) { const r = ilAt(c, f); const il = gt ? r.gtEff : r.ggEff; o.il = il; o.L = num(l.L, NaN) - il; }
      return o;
    });
  });
  filter.defaults = FPARTS.defaults;
  api.filter = filter;

  /* =============================== 4.6 Grenzlinien, Pruefmodell =============================== */
  const LIM = {
    'leit-B-QP': { name: 'Übungsgrenzlinie leitungsgebunden Klasse B, Quasi-Spitzenwert (A)', unit: 'dBµV', pts: [[150e3, 66], [500e3, 56], [5e6, 56], [5e6, 60], [30e6, 60]] },
    'leit-B-AV': { name: 'Übungsgrenzlinie leitungsgebunden Klasse B, Mittelwert (A)', unit: 'dBµV', pts: [[150e3, 56], [500e3, 46], [5e6, 46], [5e6, 50], [30e6, 50]] },
    'leit-A-QP': { name: 'Übungsgrenzlinie leitungsgebunden Klasse A, Quasi-Spitzenwert (A)', unit: 'dBµV', pts: [[150e3, 79], [500e3, 79], [500e3, 73], [30e6, 73]] },
    'leit-A-AV': { name: 'Übungsgrenzlinie leitungsgebunden Klasse A, Mittelwert (A)', unit: 'dBµV', pts: [[150e3, 66], [500e3, 66], [500e3, 60], [30e6, 60]] },
    'str-B-10m': { name: 'Übungsgrenzlinie Störstrahlung Klasse B bei 10 m (A)', unit: 'dBµV/m', pts: [[30e6, 30], [230e6, 30], [230e6, 37], [1e9, 37]] },
    'str-A-10m': { name: 'Übungsgrenzlinie Störstrahlung Klasse A bei 10 m (A)', unit: 'dBµV/m', pts: [[30e6, 40], [230e6, 40], [230e6, 47], [1e9, 47]] }
  };
  const limits = { ids: Object.keys(LIM) };
  function limAt(id, f) {
    const L = LIM[id];
    if (!L) return null;
    f = num(f, NaN);
    if (!(f > 0)) return null;
    const p = L.pts;
    if (f < p[0][0] * (1 - 1e-12) || f > p[p.length - 1][0] * (1 + 1e-12)) return null;
    let stepY = null;
    for (let i = 0; i < p.length; i++) if (Math.abs(p[i][0] - f) <= 1e-9 * f) stepY = stepY === null ? p[i][1] : Math.min(stepY, p[i][1]);
    if (stepY !== null) return stepY;
    for (let i = 0; i < p.length - 1; i++) {
      if (f > p[i][0] && f < p[i + 1][0]) {
        const t = (Math.log(f) - Math.log(p[i][0])) / (Math.log(p[i + 1][0]) - Math.log(p[i][0]));
        return p[i][1] + t * (p[i + 1][1] - p[i][1]);
      }
    }
    return null;
  }
  limits.at = function (id, f) { try { return limAt(id, f); } catch (e) { return null; } };
  limits.atDist = function (id, f, d) {
    try { const v = limAt(id, f); d = pos(d, 10); return v === null ? null : v + 20 * log10(10 / d); } catch (e) { return null; }
  };
  limits.get = function (id) { try { const L = LIM[id]; return L ? { id: id, name: L.name, unit: L.unit, pts: L.pts.map(function (q) { return [q[0], q[1]]; }) } : null; } catch (e) { return null; } };
  limits.name = function (id) { try { return LIM[id] ? LIM[id].name : ''; } catch (e) { return ''; } };
  limits.list = function () { try { return limits.ids.map(function (id) { return limits.get(id); }); } catch (e) { return []; } };
  limits.pts = function (id) { const g = limits.get(id); return g ? g.pts : null; };
  limits.klasse = function (k) { return k === 'A' ? 'A' : 'B'; };
  api.limits = limits;

  const EPSM = 1e-9;
  function ampelOfMargin(m) { return !isFinite(m) ? 'grau' : (m >= 6 - EPSM ? 'gruen' : (m >= -EPSM ? 'gelb' : 'rot')); }
  function nameOf(a) {
    const k = a === 'grün' ? 'gruen' : a;
    if (!TEXTS.ampel[k]) return TEXTS.ampelSym.grau + ' ' + TEXTS.ampel.grau;
    return TEXTS.ampelSym[k] + ' ' + TEXTS.ampel[k];
  }
  const assess = {};
  assess.nameOf = function (a) { try { return nameOf(a); } catch (e) { return '– grau'; } };
  assess.margin = S(function (m) {
    m = num(m, NaN);
    if (!isFinite(m)) return { ok: false, ampel: 'grau', margin: NaN, text: TEXTS.eingabe };
    const a = ampelOfMargin(m);
    return { ok: a !== 'rot', ampel: a, margin: m, text: a === 'gruen' ? 'Marge ' + fmt(m, 1) + ' dB: mindestens 6 dB Abstand.' : (a === 'gelb' ? 'Marge ' + fmt(m, 1) + ' dB: weniger als 6 dB Abstand, knapp.' : 'Marge ' + fmt(m, 1) + ' dB: Die Vorgabe wird nicht erreicht.') };
  });
  assess.conducted = S(function (lines, klasse) {
    const k = limits.klasse(klasse);
    if (!isArr(lines)) return { ok: false, ampel: 'grau', margin: NaN, text: TEXTS.eingabe };
    let minAV = Infinity, minQP = Infinity, fAV = NaN, LAV = NaN, nEval = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const f = num(l && l.f, NaN), L = num(l && l.L, NaN);
      if (!(f > 0) || !isFinite(L)) continue;
      const av = limAt('leit-' + k + '-AV', f), qp = limAt('leit-' + k + '-QP', f);
      if (av === null || qp === null) continue;
      nEval++;
      if (av - L < minAV) { minAV = av - L; fAV = f; LAV = L; }
      if (qp - L < minQP) minQP = qp - L;
    }
    if (!nEval) return { ok: false, ampel: 'grau', margin: NaN, freq: NaN, text: TEXTS.ohneGrenzwert, n: 0 };
    const o = { ok: true, margin: minAV, marginQP: minQP, freq: fAV, L: LAV, n: nEval, klasse: k };
    if (minQP < -EPSM) {
      o.ampel = 'rot'; o.ok = false;
      o.text = 'Der Spitzenwert ' + fmt(LAV, 1) + ' dBµV bei ' + fmtEng(fAV, 'Hz') + ' liegt ' + fmt(-minQP, 1) + ' dB über der Quasi-Spitzenwert-Grenzlinie (Übungsgrenzlinie Klasse ' + k + ').';
    } else if (minAV < 6 - EPSM) {
      o.ampel = 'gelb';
      o.text = TEXTS.knapp + ' Kleinste Marge zur Mittelwert-Grenzlinie: ' + fmt(minAV, 1) + ' dB bei ' + fmtEng(fAV, 'Hz') + '.';
    } else {
      o.ampel = 'gruen';
      o.text = TEXTS.gruenSatz + ' Kleinste Marge: ' + fmt(minAV, 1) + ' dB bei ' + fmtEng(fAV, 'Hz') + '.';
    }
    return o;
  });
  assess.radiated = S(function (lines, klasse, d) {
    const k = limits.klasse(klasse), dist = pos(d, 3);
    if (!isArr(lines)) return { ok: false, ampel: 'grau', margin: NaN, text: TEXTS.eingabe };
    let minM = Infinity, fM = NaN, LM = NaN, nEval = 0;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      const f = num(l && l.f, NaN), L = num(l && l.L, NaN);
      if (!(f > 0) || !isFinite(L)) continue;
      const lim = limits.atDist('str-' + k + '-10m', f, dist);
      if (lim === null) continue;
      nEval++;
      if (lim - L < minM) { minM = lim - L; fM = f; LM = L; }
    }
    if (!nEval) return { ok: false, ampel: 'grau', margin: NaN, freq: NaN, text: TEXTS.ohneGrenzwert, n: 0 };
    const a = ampelOfMargin(minM);
    const o = { ok: a !== 'rot', ampel: a, margin: minM, freq: fM, L: LM, n: nEval, klasse: k, d: dist };
    o.text = a === 'rot' ? 'Die Feldstärke ' + fmt(LM, 1) + ' dBµV/m bei ' + fmtEng(fM, 'Hz') + ' liegt ' + fmt(-minM, 1) + ' dB über der Übungsgrenzlinie (Abstand ' + fmtEng(dist, 'm') + ').'
      : 'Kleinste Marge zur Übungsgrenzlinie: ' + fmt(minM, 1) + ' dB bei ' + fmtEng(fM, 'Hz') + (a === 'gelb' ? ' (knapp, weniger als 6 dB).' : '.');
    return o;
  });
  assess.immunity = S(function (v) {
    let k = typeof v === 'string' ? v : (v && typeof v === 'object' ? v.kriterium : null);
    if (k === 'a' || k === 'b' || k === 'c') k = k.toUpperCase();
    if (k !== 'A' && k !== 'B' && k !== 'C' && k !== 'Ausfall') return { ok: false, ampel: 'grau', kriterium: null, text: TEXTS.eingabe };
    const a = k === 'A' ? 'gruen' : (k === 'B' ? 'gelb' : 'rot');
    return { ok: a !== 'rot', ampel: a, kriterium: k, text: TEXTS.kriterium[k] };
  });
  assess.ampelOfMargin = C(function (m) { return ampelOfMargin(num(m, NaN)); });
  api.assess = assess;
  api.nameOf = assess.nameOf;

  /* =============================== 4.6 Quelle =============================== */
  const SRC = {
    u: 325, fs: 100e3, duty: 0.5, rg: 10, cp: 20e-12, isw: 0.5, idm: 0.02, snub: { on: false, rs: 39, cs: 100e-12 }, ferrit: false, jitter: 0,
    Lp: 60e-9, Coss: 40e-12, Ron: 0.5, Ugate: 12, Uplateau: 5, Cgd: 20e-12, fMax: 30e6, fMin: 9e3, rbw: 9e3
  };
  function srcCfg(cfg) {
    cfg = obj(cfg);
    const d = SRC;
    let duty = num(cfg.duty, d.duty); if (duty >= 1) duty = duty / 100;
    duty = clamp(duty, 0.01, 0.99);
    let jit = nn(cfg.jitter, d.jitter); if (jit > 1) jit = jit / 100;
    let sn = cfg.snub, snOn = false, rs = num(cfg.rsn, num(cfg.rs, d.snub.rs)), cs = num(cfg.csn, num(cfg.cs, d.snub.cs));
    if (sn === true || sn === 'ein' || sn === 1) snOn = true;
    else if (isObj(sn)) { snOn = sn.on === true || sn.on === 'ein'; rs = num(sn.rs, rs); cs = num(sn.cs, cs); }
    if (!(rs > 0)) rs = d.snub.rs;
    if (!(cs > 0)) cs = d.snub.cs;
    return {
      u: pos(cfg.u, d.u), fs: pos(cfg.fs, d.fs), duty: duty, rg: pos(cfg.rg, d.rg), cp: pos(cfg.cp, d.cp), isw: nn(cfg.isw, d.isw), idm: nn(cfg.idm, d.idm),
      snub: { on: snOn, rs: rs, cs: cs }, ferrit: cfg.ferrit === true || cfg.ferrit === 'ein' || cfg.ferrit === 1, jitter: jit,
      Lp: pos(cfg.Lp, d.Lp), Coss: pos(cfg.Coss, d.Coss), Ron: nn(cfg.Ron, d.Ron), Ugate: pos(cfg.Ugate, d.Ugate), Uplateau: nn(cfg.Uplateau, d.Uplateau), Cgd: pos(cfg.Cgd, d.Cgd),
      fMax: clamp(pos(cfg.fMax, d.fMax), 1e5, 300e6), fMin: nn(cfg.fMin, d.fMin), rbw: pos(cfg.rbw, d.rbw)
    };
  }
  function ringOfSrc(c) {
    const base = { L: c.Lp, C: c.Coss, Rv: c.Ron, Rs: c.snub.on ? c.snub.rs : 0, Cs: c.snub.on ? c.snub.cs : 0, isw: c.isw };
    let m = ringModelRaw(base);
    if (c.ferrit && m.ok) { m = ringModelRaw(Object.assign({}, base, { Rv: c.Ron + rfOf(m.fr) })); }
    return m;
  }
  const source = { defaults: SRC };
  source.flyback = S(function (cfg) {
    const c = srcCfg(cfg);
    const dudt = (c.Ugate - c.Uplateau) / (c.rg * c.Cgd);
    let tr = Math.max(1e-9, c.u / dudt);
    const T = 1 / c.fs, tau = c.duty * T, lim = 0.98 * Math.min(tau, T - tau);
    let clamped = false;
    if (tr > lim) { tr = lim; clamped = true; }
    const pT = { A: c.u, T: T, tau: tau, tr: tr, tf: tr, t2: tau };
    const pI = { A: c.idm, T: T, tau: tau, tr: tr, tf: tr, t2: tau };
    const env = envOf(pT);
    const m = ringOfSrc(c);
    const n0 = Math.max(1, Math.ceil(c.fMin / c.fs - 1e-9));
    let n1 = Math.floor(c.fMax / c.fs + 1e-9), truncated = false;
    if (n1 - n0 + 1 > 30000) { n1 = n0 + 29999; truncated = true; }
    const cm = [], dm = [];
    let bump = 0;
    function cmLevels(n) {
      const f = n * c.fs, w = TWO_PI * f;
      const jr = spec.jitterDelta(n, c.fs, c.jitter, c.rbw);
      const ct = cnOf(pT, n), cr = ringLineOf(m, T, tau, n);
      const ctot = Math.hypot(ct, cr);
      const u0 = w * c.cp * ct / Math.SQRT2 * 25, u1 = w * c.cp * ctot / Math.SQRT2 * 25;
      const ue = w * c.cp * env.at(f) / Math.SQRT2 * 25;
      return { f: f, jr: jr, L0: u0 > 0 ? uvOf(u0) - jr : -300, L1: u1 > 0 ? uvOf(u1) - jr : -300, Le: ue > 0 ? uvOf(ue) - jr : -300 };
    }
    /* Buckel der Ringschwingung: unabhaengig vom Anzeigebereich um die Ringfrequenz herum bestimmt (Fenster +-200 Linien) */
    if (m.ok && m.ringing && m.ur > 0) {
      const nc = Math.round(m.fr / c.fs);
      for (let n = Math.max(1, nc - 200); n <= nc + 200; n++) { const q = cmLevels(n); if (q.L1 > -40 && q.L1 - q.Le > bump) bump = q.L1 - q.Le; }
    }
    for (let n = n0; n <= n1; n++) {
      const q = cmLevels(n), f = q.f, jr = q.jr, L0 = q.L0, L1 = q.L1;
      if (L1 > -40 && L1 - q.Le > bump) bump = L1 - q.Le;
      cm.push({ n: n, f: f, L: L1, L0: L0 });
      const ci = cnOf(pI, n), ud = ci / Math.SQRT2 * 50;
      dm.push({ n: n, f: f, L: ud > 0 ? uvOf(ud) - jr : -300 });
    }
    const pSn = c.snub.on ? c.snub.cs * c.u * c.u * c.fs : 0;
    const out = {
      ok: true, tr: tr, tf: tr, dudt: dudt, dudtEff: c.u / tr, f1: env.f1, f2: env.f2, T: T, tau: tau, duty: c.duty, clamped: clamped,
      ring: { ok: m.ok, fr: m.fr, zeta: m.zeta, os: m.os, Z0: m.z0, ur: m.ur, pSnub: pSn, bump: bump, ringing: m.ringing, alpha: m.alpha, wd: m.wd },
      pSw: 0.5 * c.u * c.isw * (tr + tr) * c.fs, pSnub: pSn, cm: cm, dm: dm, cfg: c, model: m
    };
    if (truncated) out.truncated = true;
    if (clamped) out.why = TEXTS.get('flankeKlemmt', { tr: fmtEng(tr, 's') });
    return out;
  });
  api.source = source;

  /* =============================== 4.6 Kette (LISN) =============================== */
  const chain = {};
  chain.lisn = S(function (cfg) {
    cfg = obj(cfg);
    const srcIn = isObj(cfg.src) ? cfg.src : (isObj(cfg.source) ? cfg.source : cfg);
    const fc = isObj(cfg.filter) ? cfg.filter : (isObj(cfg.filt) ? cfg.filt : (isObj(cfg.flt) ? cfg.flt : null));
    const k = limits.klasse(cfg.klasse);
    const s = source.flyback(srcIn);
    if (!s.ok) return s;
    const fcf = fc ? fcfg(fc) : null;
    const lines = [];
    let worst = null;
    for (let i = 0; i < s.cm.length; i++) {
      const a = s.cm[i], b = s.dm[i];
      let ilc = 0, ild = 0;
      if (fcf) { const r = ilAt(fcf, a.f); ilc = r.gtEff; ild = r.ggEff; }
      const Lcm = a.L - ilc, Ldm = b.L - ild;
      const L = db.sum([Lcm, Ldm]);
      const o = { n: a.n, f: a.f, L: L, Lcm: Lcm, Ldm: Ldm, Lcm0: a.L, Ldm0: b.L, ilCm: ilc, ilDm: ild };
      lines.push(o);
      const av = limAt('leit-' + k + '-AV', a.f), qp = limAt('leit-' + k + '-QP', a.f);
      if (av !== null && qp !== null) {
        const mAV = av - L;
        if (!worst || mAV < worst.marginAV) worst = { f: a.f, n: a.n, L: L, marginAV: mAV, marginQP: qp - L };
      }
    }
    const ass = assess.conducted(lines, k);
    let lMax = -Infinity, fMax = NaN;
    for (let i = 0; i < lines.length; i++) if (lines[i].L > lMax) { lMax = lines[i].L; fMax = lines[i].f; }
    return { ok: true, lines: lines, worst: worst, ring: s.ring, src: s, klasse: k, assess: ass, lMax: lMax, fMax: fMax, margin: worst ? worst.marginAV : NaN };
  });
  api.chain = chain;

  /* =============================== Glossar (einzige Quelle der Begriffe) =============================== */
  /* Eintrag: { id, term, genus:'der'|'die'|'das', symbol, unit, kat, text }. Ein Wort je Begriff, Genus festgelegt (SPEC Abschnitt 2). */
  const GL = [
    ['stoerquelle', 'Störquelle', 'die', '', '', 'grundlagen', 'Der Teil eines Geräts oder einer Anlage, der die Störung erzeugt, zum Beispiel ein schnell schaltender Transistor, ein Relais oder ein Taktgeber.'],
    ['stoersenke', 'Störsenke', 'die', '', '', 'grundlagen', 'Der Teil, der von der Störung beeinflusst wird, zum Beispiel ein hochohmiger Sensoreingang, ein Verstärker oder ein Funkempfänger.'],
    ['kopplungspfad', 'Kopplungspfad', 'der', '', '', 'grundlagen', 'Der Weg, auf dem die Störung von der Störquelle zur Störsenke gelangt: über gemeinsame Impedanz, elektrisches Feld, magnetisches Feld oder Strahlung.'],
    ['kopplung', 'Kopplung', 'die', '', '', 'grundlagen', 'Übertragung der Störung auf dem Kopplungspfad. Es gibt die galvanische (gemeinsame Impedanz), kapazitive (elektrisches Feld), induktive (magnetisches Feld) Kopplung und die Strahlung.'],
    ['gleichtakt', 'Gleichtakt', 'der', 'GT', '', 'grundlagen', 'Störstrom, der auf allen Leitern in dieselbe Richtung fließt und über Masse, Gehäuse oder Erde zurückkehrt. Er strahlt besonders gut ab.'],
    ['gegentakt', 'Gegentakt', 'der', 'GG', '', 'grundlagen', 'Störstrom, der auf einem Leiter hin- und auf dem anderen zurückfließt, wie der Nutzstrom.'],
    ['stoeraussendung', 'Störaussendung', 'die', '', '', 'grundlagen', 'Die Störungen, die ein Gerät leitungsgebunden oder als Strahlung an seine Umgebung abgibt. Sie wird gegen eine Grenzlinie gemessen.'],
    ['stoerfestigkeit', 'Störfestigkeit', 'die', '', '', 'grundlagen', 'Die Fähigkeit eines Geräts, bei einer Störung weiterzuarbeiten. Sie wird mit Prüfimpulsen wie ESD, Burst und Surge geprüft und mit den Bewertungskriterien A, B und C beurteilt.'],
    ['massnahme', 'Maßnahme', 'die', '', '', 'grundlagen', 'Eine Änderung, die die Störung verkleinert. Sie wirkt an einem der drei Hebel: Quelle entschärfen, Kopplung verringern oder Senke härten.'],
    ['pegel', 'Pegel', 'der', 'L', 'dBµV', 'spektrum', 'Logarithmisches Maß einer Spannung, bezogen auf 1 µV: L = 20·lg(U/1 µV). Feldstärken werden in dBµV/m angegeben.'],
    ['marge', 'Marge', 'die', '', 'dB', 'spektrum', 'Abstand zur Grenzlinie: Grenzwert minus Pegel. Positiv ist gut, negativ bedeutet überschritten.'],
    ['grenzlinie', 'Grenzlinie', 'die', '', '', 'spektrum', 'Der erlaubte Pegel über der Frequenz. Im Lab sind die Grenzlinien Übungsgrenzlinien: Herstellerdokumentation und aktuelle Norm maßgeblich.'],
    ['oberwelle', 'Oberwelle', 'die', 'n', '', 'spektrum', 'Ein ganzzahliges Vielfaches der Grundfrequenz. Ein Rechtecksignal besteht aus der Grundwelle und vielen Oberwellen.'],
    ['flanke', 'Flanke', 'die', 'tr', 's', 'spektrum', 'Der Übergang zwischen den beiden Pegeln eines Impulses. Je kürzer die Flanke, desto weiter reichen die Oberwellen nach oben.'],
    ['spektrum', 'Spektrum', 'das', '', '', 'spektrum', 'Darstellung der Anteile eines Signals über der Frequenz.'],
    ['rbw', 'Auflösebandbreite', 'die', 'RBW', 'Hz', 'messen', 'Die Bandbreite des Messfilters im Spektrumanalysator. Linien innerhalb einer Auflösebandbreite addieren sich in der Leistung.'],
    ['spitzenwert', 'Spitzenwert', 'der', '', '', 'messen', 'Detektorart des Analysators. Der Spitzenwert ist nie kleiner als der Quasi-Spitzenwert, und der ist nie kleiner als der Mittelwert.'],
    ['netznachbildung', 'Netznachbildung', 'die', 'LISN', '', 'messen', 'Ein Messnetzwerk zwischen Netz und Prüfling. Es bildet für die Störung eine definierte Last nach und trennt den Prüfling vom Netz.'],
    ['pruefling', 'Prüfling', 'der', '', '', 'messen', 'Das Gerät, das gemessen oder geprüft wird.'],
    ['tastkopf', 'Tastkopf', 'der', '', '', 'messen', 'Messspitze des Oszilloskops. Seine Masseleitung bildet mit der Eingangskapazität einen Schwingkreis.'],
    ['nahfeldsonde', 'Nahfeldsonde', 'die', '', '', 'messen', 'Kleine Schleife, mit der du Störquellen auf einer Baugruppe aufspürst, ohne den Pegel absolut zu messen.'],
    ['schirm', 'Schirm', 'der', '', '', 'schirmung', 'Eine leitfähige Hülle, die ein elektromagnetisches Feld abschwächt. Ein Kabelschirm wird rundum (360°) am Gehäuse angeschlossen.'],
    ['schirmung', 'Schirmung', 'die', '', '', 'schirmung', 'Die Gesamtheit der Maßnahmen, mit denen ein Feld abgeschwächt wird: Material, Dicke, Schlitze, Löcher und Anschluss.'],
    ['gehaeuse', 'Gehäuse', 'das', '', '', 'schirmung', 'Die Hülle des Geräts. Sie wirkt als Schirm, wenn sie leitfähig ist und keine großen Schlitze oder Löcher hat.'],
    ['schirmdaempfung', 'Schirmdämpfung', 'die', 'SE', 'dB', 'schirmung', 'Verhältnis der Feldstärke ohne und mit Schirm in dB. Sie setzt sich aus Absorption A, Reflexion R und Mehrfachreflexion B zusammen.'],
    ['hauttiefe', 'Hauttiefe', 'die', 'δ', 'm', 'schirmung', 'Die Tiefe, in der die Stromdichte im Leiter auf den e-ten Teil abgefallen ist. Sie sinkt mit steigender Frequenz.'],
    ['einfuegungsdaempfung', 'Einfügungsdämpfung', 'die', 'IL', 'dB', 'filter', 'Dämpfung, die ein Filter im Messsystem bewirkt: Pegel ohne Filter minus Pegel mit Filter.'],
    ['xkondensator', 'X-Kondensator', 'der', 'Cx', 'F', 'filter', 'Kondensator zwischen den Netzleitern. Er dämpft den Gegentakt.'],
    ['ykondensator', 'Y-Kondensator', 'der', 'Cy', 'F', 'filter', 'Kondensator zwischen Netzleiter und Schutzleiter oder Gehäuse. Er dämpft den Gleichtakt, führt aber einen Ableitstrom.'],
    ['gtdrossel', 'Gleichtaktdrossel', 'die', '', '', 'filter', 'Zwei gegensinnig gekoppelte Wicklungen auf einem Kern. Sie sperrt den Gleichtakt und lässt den Gegentakt des Nutzstroms fast ungehindert durch.'],
    ['ferrit', 'Ferrit', 'der', '', '', 'filter', 'Magnetischer Werkstoff als Perle oder Hülse auf dem Kabel. Er wirkt im Störbereich wie ein Widerstand.'],
    ['ableitstrom', 'Ableitstrom', 'der', '', 'A', 'filter', 'Strom, der über die Y-Kondensatoren vom Netzleiter zum Schutzleiter fließt. Er wächst mit der Y-Kapazität.'],
    ['eigenresonanz', 'Eigenresonanz', 'die', 'fres', 'Hz', 'filter', 'Frequenz, bei der ein realer Kondensator (mit Anschlussinduktivität) oder eine Drossel (mit Windungskapazität) in Resonanz geht. Darüber verhält sich das Bauteil umgekehrt.'],
    ['snubber', 'Snubber', 'der', '', '', 'quelle', 'Reihenschaltung aus Widerstand und Kondensator parallel zum Schalter. Er dämpft das Nachschwingen und verbraucht dabei Leistung.'],
    ['ringing', 'Ringing', 'das', '', '', 'quelle', 'Gedämpftes Nachschwingen der Schaltzelle nach der Flanke, ausgelöst durch Streuinduktivität und Ausgangskapazität.'],
    ['jitter', 'Frequenzjitter', 'der', '', '', 'quelle', 'Absichtliches Schwanken der Schaltfrequenz. Es verteilt die Leistung der Oberwellen auf mehrere Auflösebandbreiten und senkt die Spitzen.'],
    ['rueckstrom', 'Rückstrom', 'der', '', 'A', 'layout', 'Der Strom, der zur Quelle zurückfließt. Bei hohen Frequenzen folgt er direkt unter dem Hinleiter.'],
    ['schleifenflaeche', 'Schleifenfläche', 'die', 'A', 'm²', 'layout', 'Die von Hin- und Rückleiter umschlossene Fläche. Sie bestimmt Abstrahlung und Einkopplung der Schleife.'],
    ['masseschleife', 'Masseschleife', 'die', '', '', 'kopplung', 'Zwei Erdungspunkte desselben Stromkreises. Eine Potenzialdifferenz treibt einen Strom durch den Rückleiter und erzeugt Brummen.'],
    ['abblockkondensator', 'Abblockkondensator', 'der', '', 'F', 'layout', 'Kondensator an der Versorgung eines ICs. Er liefert den Impulsstrom lokal, wenn er direkt am Pin sitzt.'],
    ['esd', 'ESD', 'die', '', '', 'impulse', 'Elektrostatische Entladung: Ein aufgeladener Körper entlädt sich in wenigen Nanosekunden über das Gerät.'],
    ['burst', 'Burst', 'der', '', '', 'impulse', 'Folge schneller, energiearmer Impulse, wie sie beim Schalten induktiver Lasten entstehen.'],
    ['surge', 'Surge', 'der', '', '', 'impulse', 'Energiereicher Stoßimpuls, wie er durch Blitzeinwirkung oder große Schalthandlungen im Netz entsteht.'],
    ['tvs', 'TVS-Diode', 'die', '', '', 'impulse', 'Schutzdiode, die bei Überschreiten ihrer Durchbruchspannung leitend wird und die Spannung begrenzt.'],
    ['varistor', 'Varistor', 'der', '', '', 'impulse', 'Spannungsabhängiger Widerstand zum Begrenzen von Überspannungen im Netz.'],
    ['bewertungskriterium', 'Bewertungskriterium', 'das', '', '', 'impulse', 'Einteilung des Gerätverhaltens bei einer Störfestigkeitsprüfung: A normales Verhalten, B kurze Beeinträchtigung mit Selbsterholung, C Bedienereingriff nötig.'],
    ['vorpruefung', 'Vorprüfung', 'die', '', '', 'normen', 'Eigene Messung vor der Konformitätsprüfung. Sie ersetzt keine Prüfung im akkreditierten Labor.']
  ];
  const glossary = { items: GL.map(function (g) { return { id: g[0], term: g[1], genus: g[2], article: g[2], symbol: g[3], unit: g[4], kat: g[5], text: g[6] }; }) };
  glossary.foreign = [
    { id: 'emission', term: 'Emission', genus: 'die', text: 'Fremdwort für Störaussendung. Im Lab steht immer Störaussendung.' },
    { id: 'immission', term: 'Immission', genus: 'die', text: 'Fremdwort für die auf ein Gerät einwirkende Störung. Im Lab steht Störung oder Störfestigkeit.' }
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
  /* Fragen zu Normen und Praxis (em30): nur gesicherte Aussagen, ohne Zahlen. Jede Antwortmoeglichkeit hat einen Fachgrund. */
  glossary.normen = [
    { id: 'ce', frage: 'Was sagt das CE-Zeichen am Gerät aus?', richtig: 'Der Hersteller erklärt, dass das Gerät die zutreffenden EU-Vorschriften erfüllt.',
      falsch: [{ text: 'Ein unabhängiges Labor hat jedes einzelne Gerät geprüft.', grund: 'Das CE-Zeichen ist eine Erklärung des Herstellers; nicht jedes Gerät wird von einem Labor geprüft.' },
        { text: 'Das Gerät wurde in der EU hergestellt.', grund: 'Das CE-Zeichen sagt nichts über den Herstellungsort aus.' },
        { text: 'Das Gerät ist besonders sicher und hochwertig.', grund: 'Das Zeichen ist keine Qualitätsaussage, sondern bestätigt die Einhaltung der Vorschriften.' }] },
    { id: 'richtlinie', frage: 'Was verlangt die EMV-Richtlinie von einem Gerät?', richtig: 'Es darf andere Geräte nicht unzulässig stören und muss selbst ausreichend störfest sein.',
      falsch: [{ text: 'Es darf überhaupt keine Störungen aussenden.', grund: 'Verlangt wird eine begrenzte Störaussendung, kein völliges Fehlen.' },
        { text: 'Es muss in einem Metallgehäuse stecken.', grund: 'Die Richtlinie schreibt kein Mittel vor, sondern ein Ergebnis.' },
        { text: 'Es muss nur die Störaussendung beachten, die Störfestigkeit ist freiwillig.', grund: 'Störaussendung und Störfestigkeit gehören beide zu den Anforderungen.' }] },
    { id: 'aussendung', frage: 'Was beschreibt die Störaussendung?', richtig: 'Die Störungen, die das Gerät an seine Umgebung abgibt.',
      falsch: [{ text: 'Die Störungen, die das Gerät ohne Fehlfunktion aushält.', grund: 'Das ist die Störfestigkeit.' },
        { text: 'Die Energie, die das Gerät aus dem Netz aufnimmt.', grund: 'Das ist die Leistungsaufnahme und hat mit der Störaussendung nichts zu tun.' },
        { text: 'Die Wärme, die das Gerät abgibt.', grund: 'Verlustwärme ist keine elektromagnetische Störung.' }] },
    { id: 'festigkeit', frage: 'Was beschreibt die Störfestigkeit?', richtig: 'Die Fähigkeit des Geräts, bei äußeren Störungen weiter zu funktionieren.',
      falsch: [{ text: 'Die Störungen, die das Gerät selbst erzeugt.', grund: 'Das ist die Störaussendung.' },
        { text: 'Die mechanische Festigkeit des Gehäuses.', grund: 'Mit mechanischer Belastung hat der Begriff nichts zu tun.' },
        { text: 'Der Schutz des Geräts vor Wasser und Staub.', grund: 'Das ist eine Frage der Schutzart, nicht der EMV.' }] },
    { id: 'kriteriumA', frage: 'Was bedeutet Bewertungskriterium A bei einer Störfestigkeitsprüfung?', richtig: 'Das Gerät arbeitet während und nach der Störung normal weiter.',
      falsch: [{ text: 'Das Gerät fällt aus und startet von selbst neu.', grund: 'Ein Neustart von selbst entspricht Kriterium B.' },
        { text: 'Das Gerät bleibt stehen, bis der Bediener eingreift.', grund: 'Ein nötiger Bedienereingriff entspricht Kriterium C.' },
        { text: 'Das Gerät wird zerstört, ist aber geprüft.', grund: 'Ein Ausfall besteht die Prüfung nicht; er gehört zu keinem der drei Kriterien.' }] },
    { id: 'kriteriumB', frage: 'Welches Verhalten gehört zu Bewertungskriterium B?', richtig: 'Eine kurze Beeinträchtigung, von der sich das Gerät selbst erholt.',
      falsch: [{ text: 'Keinerlei Beeinträchtigung.', grund: 'Das ist Kriterium A.' },
        { text: 'Das Gerät läuft erst nach Eingriff des Bedieners wieder.', grund: 'Das ist Kriterium C.' },
        { text: 'Das Gerät wird dauerhaft beschädigt.', grund: 'Dauerhafte Schäden sind ein Ausfall und bestehen die Prüfung nicht.' }] },
    { id: 'bereich', frage: 'Welche Aussage zu den Fachgrundnormen für Wohn- und Industriebereich stimmt?', richtig: 'Im Wohnbereich gelten für die Störaussendung strengere Grenzen als im Industriebereich.',
      falsch: [{ text: 'Im Industriebereich gelten für die Störaussendung strengere Grenzen.', grund: 'Umgekehrt: Wohnbereiche haben empfindliche Empfänger in der Nähe und verlangen weniger Störaussendung.' },
        { text: 'Für beide Bereiche gelten genau dieselben Anforderungen.', grund: 'Die Fachgrundnormen unterscheiden die Umgebungen gerade wegen unterschiedlicher Anforderungen.' },
        { text: 'Im Wohnbereich gibt es keine Anforderungen.', grund: 'Auch dort gelten Grenzen, sonst würden Rundfunkempfänger gestört.' }] },
    { id: 'esd', frage: 'Welche Störung simuliert die ESD-Prüfung?', richtig: 'Die Entladung statischer Aufladung, zum Beispiel von einem Menschen.',
      falsch: [{ text: 'Kurzzeitige Spannungseinbrüche im Netz.', grund: 'Netzspannungseinbrüche sind eine eigene Prüfung.' },
        { text: 'Die Einstrahlung von Funkwellen.', grund: 'Dafür gibt es die Prüfung mit hochfrequenten Feldern.' },
        { text: 'Den Blitzeinschlag in das Versorgungsnetz.', grund: 'Dafür ist die Surge-Prüfung da.' }] },
    { id: 'burst', frage: 'Wofür steht die Burst-Prüfung?', richtig: 'Für schnelle Impulsfolgen, wie sie beim Schalten induktiver Lasten entstehen.',
      falsch: [{ text: 'Für einen einzelnen, sehr energiereichen Blitzimpuls.', grund: 'Das beschreibt eher die Surge-Prüfung.' },
        { text: 'Für das langsame Aufladen eines Menschen.', grund: 'Das ist die Grundlage der ESD-Prüfung.' },
        { text: 'Für die Messung der Störaussendung am Netz.', grund: 'Burst ist eine Störfestigkeitsprüfung, keine Messung der Aussendung.' }] },
    { id: 'surge', frage: 'Wofür steht die Surge-Prüfung?', richtig: 'Für energiereiche Stoßimpulse wie Blitzeinwirkung oder große Schalthandlungen im Netz.',
      falsch: [{ text: 'Für schnelle Impulsfolgen von Relais.', grund: 'Das ist die Burst-Prüfung.' },
        { text: 'Für die Entladung statischer Aufladung.', grund: 'Das ist die ESD-Prüfung.' },
        { text: 'Für das Messen von Oberwellen.', grund: 'Surge ist eine Störfestigkeitsprüfung, keine Messung von Oberwellen.' }] },
    { id: 'vorpruef', frage: 'Was kann eine eigene Vorprüfung leisten?', richtig: 'Sie zeigt früh, ob ein Gerät voraussichtlich knapp oder deutlich an der Grenzlinie liegt, ersetzt aber keine Prüfung im akkreditierten Labor.',
      falsch: [{ text: 'Sie ersetzt die Konformitätsprüfung vollständig.', grund: 'Nur ein akkreditiertes Labor liefert Ergebnisse mit nachgewiesener Messunsicherheit und Prüfaufbau.' },
        { text: 'Sie ist unnötig, weil Fehler erst am Ende auffallen sollen.', grund: 'Je früher EMV-Probleme auffallen, desto billiger sind sie zu beheben.' },
        { text: 'Sie darf nur der Kunde durchführen.', grund: 'Der Hersteller darf und soll selbst vorprüfen.' }] },
    { id: 'verantwortung', frage: 'Wer ist für die Konformitätserklärung verantwortlich?', richtig: 'Der Hersteller (oder sein Bevollmächtigter in der EU).',
      falsch: [{ text: 'Der Händler, der das Gerät verkauft, allein und immer.', grund: 'Der Hersteller trägt die Verantwortung; der Händler muss nur prüfen, ob die Unterlagen vorhanden sind.' },
        { text: 'Der Kunde, der das Gerät kauft.', grund: 'Der Kunde erklärt nichts; er verwendet das Gerät.' },
        { text: 'Die Prüfstelle, die einen Test durchgeführt hat.', grund: 'Eine Prüfstelle liefert einen Bericht, die Erklärung gibt der Hersteller ab.' }] }
  ];
  api.glossary = glossary;

  /* =============================== 4.4 Schirmung =============================== */
  const MATS = {
    kupfer: { id: 'kupfer', name: 'Kupfer', sigma: 5.8e7, mur: 1 },
    alu: { id: 'alu', name: 'Aluminium', sigma: 3.5e7, mur: 1 },
    stahl: { id: 'stahl', name: 'Stahl', sigma: 1.0e7, mur: 200 },
    leitlack: { id: 'leitlack', name: 'Leitlack', thin: true }
  };
  const SE_NONE = 200; /* "kein Leck": 10^(-200/20) = 1e-10 Anteil */
  const SE_CAP = 300;
  function matOf(m) {
    if (typeof m === 'string' && MATS[m]) return MATS[m];
    if (isObj(m) && num(m.sigma, 0) > 0) return { id: 'eigen', name: 'eigenes Material', sigma: m.sigma, mur: pos(m.mur, 1) };
    return null;
  }
  function skinOf(f, m) { return 1 / Math.sqrt(Math.PI * f * MU0 * m.mur * m.sigma); }
  const shield = { materials: MATS, SE_NONE: SE_NONE, SE_CAP: SE_CAP, rsqDefault: 0.1 };
  shield.skin = C(function (f, mat) {
    f = num(f, NaN);
    const m = matOf(mat || 'kupfer');
    if (!(f > 0) || !m || m.thin) return NaN;
    return skinOf(f, m);
  });
  shield.se = S(function (cfg) {
    cfg = obj(cfg);
    const m = matOf(cfg.mat === undefined ? 'alu' : cfg.mat);
    if (!m) return fail('Das Material gibt es nicht.');
    const f = num(cfg.f, 1e6);
    if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.');
    if (m.thin) {
      const rsq = pos(cfg.rsq, 0.1);
      const se = 20 * log10(1 + Z0 / (2 * rsq));
      return { ok: true, A: 0, R: se, B: 0, se: se, delta: NaN, thin: true, rsq: rsq, mat: m.id, f: f, feld: 'fern', note: 'Dünner Film: Die Schirmdämpfung hängt hier nicht von der Frequenz ab.' };
    }
    const t = num(cfg.t, 0.5e-3);
    if (!(t > 0)) return fail('Die Dicke muss größer als 0 sein.');
    const feld = cfg.feld === 'enah' || cfg.feld === 'hnah' ? cfg.feld : 'fern';
    const r = pos(cfg.r, 0.1);
    const lam = C0 / f, delta = skinOf(f, m);
    const zs = Math.sqrt(TWO_PI * f * MU0 * m.mur / m.sigma);
    let zw = Z0, nah = false;
    if (feld !== 'fern' && r < lam / TWO_PI) {
      nah = true;
      zw = feld === 'enah' ? Z0 * lam / (TWO_PI * r) : Z0 * TWO_PI * r / lam;
    }
    const Aa = 8.686 * t / delta;
    const R = 20 * log10(zw / (4 * zs));
    const B = Aa < 15 ? 20 * log10(Math.abs(1 - Math.exp(-2 * t / delta))) : 0;
    let se = Aa + R + B, clamped = false;
    if (se < 0) { se = 0; clamped = true; }
    if (se > SE_CAP) { se = SE_CAP; clamped = true; }
    const o = { ok: true, A: Aa, R: R, B: B, se: se, delta: delta, zw: zw, zs: zs, nah: nah, thin: false, mat: m.id, f: f, feld: feld, r: r, t: t, bApplied: Aa < 15, clamped: clamped };
    if (feld !== 'fern' && !nah) o.note = TEXTS.nahfeldGrenze;
    return o;
  });
  shield.slot = S(function (o) {
    o = obj(o);
    const f = num(o.f, 1e6);
    if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.');
    const len = lenMeter(o.len, 1, 0);
    const lam = C0 / f;
    if (!(len > 0)) return { ok: true, se: SE_NONE, none: true, valid: true, fCrit: NaN, lambda: lam };
    const fCrit = C0 / (2 * len);
    if (len >= lam / 2) return { ok: true, se: 0, valid: false, why: TEXTS.schlitzHalb, fCrit: fCrit, lambda: lam, len: len };
    return { ok: true, se: 20 * log10(lam / (2 * len)), valid: true, fCrit: fCrit, lambda: lam, len: len };
  });
  shield.holes = S(function (o) {
    o = obj(o);
    const f = num(o.f, 1e6);
    if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.');
    const n = Math.floor(num(o.n, 0)), d = lenMeter(o.d, 0.5, 0.005);
    const lam = C0 / f;
    if (!(n >= 1) || !(d > 0)) return { ok: true, se: SE_NONE, none: true, valid: true, lambda: lam };
    if (d >= lam / 2) return { ok: true, se: 0, valid: false, why: TEXTS.lochHalb, lambda: lam, n: n, d: d };
    return { ok: true, se: Math.max(0, 20 * log10(lam / (2 * d)) - 10 * log10(n)), valid: true, lambda: lam, n: n, d: d };
  });
  shield.combine = C(function (list) {
    if (!isArr(list) || !list.length) return NaN;
    let s = 0;
    for (let i = 0; i < list.length; i++) { const x = num(list[i], NaN); if (!isFinite(x)) return NaN; s += Math.pow(10, -x / 20); }
    return s > 0 ? -20 * log10(s) : NaN;
  });
  shield.cable = S(function (o) {
    o = obj(o);
    const f = num(o.f, 100e6);
    if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.');
    const mode = o.mode === 'pigtail' ? 'pigtail' : '360';
    const lp = lenMeter(o.lp, 1, 0.03), ish = pos(o.ish, 0.5e-3);
    const w = TWO_PI * f;
    const l360 = 2e-9, lPig = 2e-9 + 1e-6 * lp;
    const zt = Math.hypot(5e-3, w * (mode === 'pigtail' ? lPig : l360)), zt360 = Math.hypot(5e-3, w * l360);
    const uIn = zt * ish;
    return { ok: true, mode: mode, zt: zt, zt360: zt360, ratio: zt / zt360, uIn: uIn, L: uvOf(uIn), lp: lp, ish: ish, f: f };
  });
  /* Gesamtrechnung des Pruefstands "schirm" (eine Stelle fuer Rig und Aufgaben) */
  shield.total = S(function (cfg) {
    cfg = obj(cfg);
    const f = num(cfg.f, 1e6);
    const mat = shield.se(cfg);
    if (!mat.ok) return mat;
    const slot = shield.slot({ len: cfg.slot, f: f }), holes = shield.holes({ n: cfg.holes, d: cfg.dhole, f: f });
    if (!slot.ok) return slot;
    const cab = shield.cable({ mode: cfg.kabel, lp: cfg.lp, f: f, ish: cfg.ish });
    const parts = [['Material', mat.se], ['Schlitz', slot.se], ['Löcher', holes.se]];
    const seGes = shield.combine(parts.map(function (p) { return p[1]; }));
    let weakest = parts[0];
    for (let i = 1; i < parts.length; i++) if (parts[i][1] < weakest[1]) weakest = parts[i];
    const seReq = num(cfg.seReq, 40), uInReq = num(cfg.uInReq, 60);
    const mSE = seGes - seReq, mIn = uInReq - cab.L;
    const worstIsSE = mSE <= mIn;
    const ass = assess.margin(Math.min(mSE, mIn));
    const nLeaks = [slot, holes].filter(function (x) { return !x.none; }).length;
    return {
      ok: true, f: f, mat: mat, slot: slot, holes: holes, cable: cab, seMat: mat.se, seSlot: slot.se, seHoles: holes.se, seGes: seGes,
      uIn: cab.L, fSlot: slot.fCrit, delta: mat.delta, A: mat.A, R: mat.R, B: mat.B, leak: weakest[0], leakSE: weakest[1], nLeaks: nLeaks,
      marginSE: mSE, marginIn: mIn, margin: Math.min(mSE, mIn), ampel: ass.ampel, passes: ass.ok, worst: worstIsSE ? 'se' : 'uIn',
      text: worstIsSE ? 'Schirmdämpfung ' + fmt(seGes, 1) + ' dB gegen Vorgabe ' + fmt(seReq, 1) + ' dB; das schwächste Leck: ' + weakest[0] + ' mit ' + fmt(weakest[1], 1) + ' dB.'
        : 'Störspannung innen ' + fmt(cab.L, 1) + ' dBµV gegen Vorgabe ' + fmt(uInReq, 1) + ' dBµV (Schirmanbindung ' + (cab.mode === 'pigtail' ? 'mit Schirmlitze' : '360°') + ').'
    };
  });
  api.shield = shield;

  /* =============================== 4.5 Kabel als Antenne =============================== */
  const antenna = {};
  antenna.lambda = C(function (f) { f = num(f, NaN); return f > 0 ? C0 / f : NaN; });
  function ferritK(fer) { return fer === 'x1' ? 1 : (fer === 'x2' ? 2 : (fer === true ? 1 : 0)); }
  function cableOf(cfg) {
    cfg = obj(cfg);
    const f = num(cfg.f, NaN), len = num(cfg.len, 1.5);
    if (!(f > 0)) return fail('Die Frequenz muss größer als 0 sein.');
    if (!(len > 0)) return fail('Die Kabellänge muss größer als 0 sein.');
    const U = nn(cfg.U, 100e-6), r = pos(cfg.r, 3), h = pos(cfg.h, 0.8), rw = pos(cfg.rw, 0.5e-3), Rs = pos(cfg.rs, 36);
    if (!(rw < 2 * h)) return fail(TEXTS.geomUnmoeglich);
    const Rf = nn(cfg.rf, 0) + ferritK(cfg.ferrit) * rfOf(f);
    const lam = C0 / f, bl = TWO_PI * len / lam;
    const Za = 60 * Math.log(2 * h / rw);
    const sn = Math.sin(bl), cs = Math.cos(bl), s2 = Math.sin(bl / 2);
    const den = Math.hypot((Rs + Rf) * sn, Za * cs);
    const E = (60 / r) * U * 2 * s2 * s2 / den;
    const iFoot = U * Math.abs(sn) / den;
    return { ok: true, E: E, L: E > 0 ? uvOf(E / Math.SQRT2) : -300, iFoot: iFoot, zin: Math.hypot(Rs + Rf, Za * (cs / (sn === 0 ? 1e-300 : sn))), za: Za, rf: Rf, beta: bl / len, lambda: lam, bl: bl, f: f, len: len, U: U, r: r };
  }
  antenna.cableE = S(cableOf);
  antenna.resonances = A(function (len, n) {
    len = num(len, NaN); n = Math.floor(num(n, 1));
    if (!(len > 0) || !(n >= 1)) return [];
    const out = [];
    for (let k = 1; k <= Math.min(n, 200); k++) out.push((2 * k - 1) * C0 / (4 * len));
    return out;
  });
  antenna.resonance = C(function (len, k) { len = num(len, NaN); k = Math.floor(num(k, 1)); return len > 0 && k >= 1 ? (2 * k - 1) * C0 / (4 * len) : NaN; });
  antenna.shortCM = S(function (cfg) {
    cfg = obj(cfg);
    const f = num(cfg.f, NaN), len = num(cfg.len, NaN), I = nn(cfg.I, NaN), r = pos(cfg.r, 3);
    if (!(f > 0) || !(len > 0) || !isFinite(I)) return fail(TEXTS.eingabe);
    const lam = C0 / f;
    if (len >= lam / 10) return { ok: true, valid: false, E: NaN, L: NaN, why: TEXTS.get('kurzkabelLang', { len: fmtEng(len, 'm'), l10: fmtEng(lam / 10, 'm') }), lambda: lam };
    const E = 1.257e-6 * f * len * I / r;
    return { ok: true, valid: true, E: E, L: E > 0 ? uvOf(E / Math.SQRT2) : -300, lambda: lam };
  });
  antenna.shortDM = S(function (cfg) {
    cfg = obj(cfg);
    const f = num(cfg.f, NaN), area = num(cfg.A, NaN), I = nn(cfg.I, NaN), r = pos(cfg.r, 3), len = num(cfg.len, 0);
    if (!(f > 0) || !(area > 0) || !isFinite(I)) return fail(TEXTS.eingabe);
    const lam = C0 / f;
    if (Math.max(len, Math.sqrt(area)) >= lam / 10) return { ok: true, valid: false, E: NaN, L: NaN, why: TEXTS.get('kurzkabelLang', { len: fmtEng(Math.max(len, Math.sqrt(area)), 'm'), l10: fmtEng(lam / 10, 'm') }), lambda: lam };
    const E = 2.63e-14 * f * f * area * I / r;
    return { ok: true, valid: true, E: E, L: E > 0 ? uvOf(E / Math.SQRT2) : -300, lambda: lam };
  });
  /* Abstrahlfaktor ueber der Frequenz: E bei fester Gleichtaktspannung U (Standard 100 uV) */
  antenna.factor = S(function (cfg, fList) {
    if (!isArr(fList)) return fail('Die Frequenzliste fehlt.');
    const out = { ok: true, f: [], L: [] };
    for (let i = 0; i < fList.length && i < 20000; i++) {
      const r = cableOf(Object.assign({}, obj(cfg), { f: fList[i] }));
      out.f.push(num(fList[i], NaN)); out.L.push(r.ok ? r.L : NaN);
    }
    return out;
  });
  /* Abstrahlung der Takt-Oberwellen ueber das Kabel (Pruefstand abstrahlung): Linien n*fclk von 30 MHz bis 1 GHz */
  antenna.takt = S(function (cfg) {
    cfg = obj(cfg);
    const fclk = pos(cfg.fclk, 25e6), tr = pos(cfg.tr, 2e-9), kcm = num(cfg.kcm, -70), len = pos(cfg.len, 1.5);
    const kabel = cfg.kabel === 'geschirmt360' ? 0.1 : (cfg.kabel === 'geschirmtPigtail' ? 0.4 : 1);
    const klasse = limits.klasse(cfg.klasse), d = pos(cfg.r, 3), Aamp = pos(cfg.A, 3.3);
    const p = trapCfg({ A: Aamp, f0: fclk, duty: 0.5, tr: tr });
    if (!p.ok) return p;
    const lines = [];
    const n0 = Math.max(1, Math.ceil(30e6 / fclk - 1e-9)), n1 = Math.min(Math.floor(1e9 / fclk + 1e-9), 5000);
    let iMax = NaN, worst = null;
    for (let n = n0; n <= n1; n++) {
      const f = n * fclk, c = cnOf(p, n);
      const U = c * Math.pow(10, kcm / 20) * kabel;
      const r = cableOf({ f: f, len: len, U: U, r: d, ferrit: cfg.ferrit, h: cfg.h, rw: cfg.rw, rs: cfg.rs });
      if (!r.ok) continue;
      const lim = limits.atDist('str-' + klasse + '-10m', f, d);
      const mg = lim === null ? NaN : lim - r.L;
      const o = { n: n, f: f, U: U, E: r.E, L: r.L, lim: lim, margin: mg, iFoot: r.iFoot };
      lines.push(o);
      if (isFinite(mg) && (!worst || mg < worst.margin)) { worst = o; iMax = r.iFoot; }
    }
    const ass = assess.radiated(lines, klasse, d);
    return { ok: true, lines: lines, worst: worst, iCm: iMax, assess: ass, fRes: antenna.resonance(len, 1), klasse: klasse, d: d };
  });
  api.antenna = antenna;

  /* =============================== 4.11 Formeln =============================== */
  const formulas = {};
  const FORDER = [];
  /* Flaechen nicht mit Vorsatz (milli-m2 waere falsch): cm2 oder mm2 */
  function fmtU(v, u) {
    if (u === '#') return fmt(v);
    if (u === 'm²') { const a = Math.abs(v); return a >= 1e-4 || a === 0 ? fmt(v * 1e4, 3) + ' cm²' : fmt(v * 1e6, 3) + ' mm²'; }
    return fmtEng(v, u);
  }
  function sub(tpl, a, units) {
    return tpl.replace(/\{(\d)\}/g, function (_, i) { const v = a[+i]; const u = units && units[+i] !== undefined ? units[+i] : ''; return fmtU(v, u); });
  }
  /* def(id, name, symbol, expr, unit, args, units, tpl, fn, why?): args = Beschriftungen, units = Basiseinheiten der Eingaben ('' = einheitenlos, '#' = Zahl),
   * tpl = Rechenweg mit {0}.. Platzhaltern, fn rechnet in SI und liefert NaN bei ungueltiger Eingabe. */
  function def(id, name, symbol, expr, unit, args, units, tpl, fn, whyFn) {
    const f = {
      id: id, name: name, symbol: symbol, expr: expr, unit: unit, args: args, units: units, tpl: tpl,
      fn: C(function () { const a = Array.prototype.slice.call(arguments).map(function (v) { return num(v, NaN); }); const r = fn.apply(null, a); return isFinite(r) ? r : NaN; }),
      explain: function () {
        try {
          const a = Array.prototype.slice.call(arguments).map(function (v) { return num(v, NaN); });
          const value = fn.apply(null, a);
          if (!isFinite(value)) {
            let why = TEXTS.eingabe;
            try { if (whyFn) why = whyFn.apply(null, a) || why; } catch (e) { /* */ }
            return { ok: false, value: NaN, unit: unit, why: why, steps: [expr, why] };
          }
          return { ok: true, value: value, unit: unit, steps: [expr, sub(tpl, a, units), '= ' + (unit === 'dB' || unit === 'dBµV' || unit === 'dBµV/m' ? fmt(value, 1) + ' ' + unit : fmtU(value, unit))] };
        } catch (e) { return { ok: false, value: NaN, unit: unit, why: TEXTS.eingabe, steps: [expr, TEXTS.eingabe] }; }
      }
    };
    formulas[id] = f; FORDER.push(id);
    return f;
  }
  const lg = log10;
  def('dbV', 'Spannungsverhältnis in dB', 'a', 'a = 20·lg(U2/U1)', 'dB', ['U2 [V]', 'U1 [V]'], ['V', 'V'], '20·lg({0}/{1})', function (u2, u1) { return u2 > 0 && u1 > 0 ? 20 * lg(u2 / u1) : NaN; }, function () { return TEXTS.dbNull; });
  def('dbP', 'Leistungsverhältnis in dB', 'a', 'a = 10·lg(P2/P1)', 'dB', ['P2 [W]', 'P1 [W]'], ['W', 'W'], '10·lg({0}/{1})', function (p2, p1) { return p2 > 0 && p1 > 0 ? 10 * lg(p2 / p1) : NaN; }, function () { return TEXTS.dbNull; });
  def('dbuv', 'Spannung in dBµV', 'L', 'L = 20·lg(U/1 µV)', 'dBµV', ['U [V]'], ['V'], '20·lg({0}/1 µV)', function (u) { return u > 0 ? 20 * lg(u / 1e-6) : NaN; }, function () { return TEXTS.dbNull; });
  def('dbuvInv', 'dBµV in Spannung', 'U', 'U = 1 µV·10^(L/20)', 'V', ['L [dBµV]'], ['#'], '1 µV·10^({0}/20)', function (l) { return 1e-6 * Math.pow(10, l / 20); });
  def('dbm', 'dBm in dBµV (50 Ω)', 'L', 'L = P + 107 (genauer: 106,99)', 'dBµV', ['P [dBm]'], ['#'], '{0} + 107', function (p) { return p + 107; });
  def('dbSum', 'Pegel addieren (Leistung)', 'L', 'L = 10·lg(10^(L1/10) + 10^(L2/10) + …)', 'dBµV', ['L1 [dBµV]', 'L2 [dBµV]'], ['#', '#'], '10·lg(10^({0}/10) + 10^({1}/10))', function () {
    const a = Array.prototype.slice.call(arguments).filter(function (v) { return isFinite(v); });
    if (a.length < 1) return NaN;
    let s = 0; a.forEach(function (x) { s += Math.pow(10, x / 10); });
    return 10 * lg(s);
  });
  def('fRes', 'Resonanzfrequenz', 'f0', 'f0 = 1/(2π·√(L·C))', 'Hz', ['L [H]', 'C [F]'], ['H', 'F'], '1/(2π·√({0}·{1}))', function (L, c) { return L > 0 && c > 0 ? 1 / (TWO_PI * Math.sqrt(L * c)) : NaN; });
  def('fgRC', 'Grenzfrequenz RC-Glied', 'fg', 'fg = 1/(2π·R·C)', 'Hz', ['R [Ω]', 'C [F]'], ['Ω', 'F'], '1/(2π·{0}·{1})', function (r, c) { return r > 0 && c > 0 ? 1 / (TWO_PI * r * c) : NaN; });
  def('fgLR', 'Grenzfrequenz LR-Glied', 'fg', 'fg = R/(2π·L)', 'Hz', ['R [Ω]', 'L [H]'], ['Ω', 'H'], '{0}/(2π·{1})', function (r, L) { return r > 0 && L > 0 ? r / (TWO_PI * L) : NaN; });
  def('ilFirst', 'Dämpfung eines RC- oder LC-Glieds', 'a', 'a = 20·lg√(1 + (f/fg)²) (1. Ordnung), a = 40·lg(f/f0) oberhalb f0 (2. Ordnung)', 'dB', ['f [Hz]', 'fg [Hz]', 'Ordnung (1 oder 2)'], ['Hz', 'Hz', '#'],
    '1. Ordnung: 20·lg√(1 + ({0}/{1})²); 2. Ordnung: 40·lg({0}/{1})', function (f, fg, n) {
      if (!(f > 0) || !(fg > 0)) return NaN;
      if (n === 2) return f > fg ? 40 * lg(f / fg) : 0;
      return 20 * lg(Math.sqrt(1 + (f / fg) * (f / fg)));
    });
  def('xl', 'Induktiver Blindwiderstand', 'XL', 'XL = 2π·f·L', 'Ω', ['f [Hz]', 'L [H]'], ['Hz', 'H'], '2π·{0}·{1}', function (f, L) { return f >= 0 && L >= 0 ? TWO_PI * f * L : NaN; });
  def('schleife', 'Schleifenfläche', 'A', 'A = b·h', 'm²', ['b [m]', 'h [m]'], ['m', 'm'], '{0}·{1}', function (b, h) { return b >= 0 && h >= 0 ? b * h : NaN; });
  def('uInd', 'Induzierte Spannung im Wechselfeld (Spitzenwert)', 'û', 'û = 2π·f·B̂·A·cos α (B = µ0·H)', 'V', ['f [Hz]', 'B̂ [T]', 'A [m²]', 'α [°]'], ['Hz', 'T', 'm²', '#'],
    '2π·{0}·{1}·{2}·cos({3}°)', function (f, B, a, al) { return f >= 0 && B >= 0 && a >= 0 ? TWO_PI * f * B * a * Math.cos((isFinite(al) ? al : 0) * Math.PI / 180) : NaN; });
  def('uIndM', 'Induzierte Spannung durch Gegeninduktivität', 'u', 'u = M·di/dt', 'V', ['M [H]', 'di/dt [A/s]'], ['H', 'A/s'], '{0}·{1}', function (M, d) { return M >= 0 ? M * d : NaN; });
  def('kapTeiler', 'Kapazitiver Teiler (hohe Frequenz)', 'UN', 'UN = Us·Cm/(Cm + Cg)', 'V', ['Us [V]', 'Cm [F]', 'Cg [F]'], ['V', 'F', 'F'], '{0}·{1}/({1} + {2})', function (u, cm, cg) { return u >= 0 && cm > 0 && cg >= 0 ? u * cm / (cm + cg) : NaN; });
  def('kapTeilerNf', 'Kapazitive Einkopplung (niedrige Frequenz)', 'UN', 'UN = ω·Cm·R·Us', 'V', ['Us [V]', 'Cm [F]', 'R [Ω]', 'f [Hz]'], ['V', 'F', 'Ω', 'Hz'], '2π·{3}·{1}·{2}·{0}', function (u, cm, r, f) { return u >= 0 && cm > 0 && r > 0 && f > 0 ? TWO_PI * f * cm * r * u : NaN; });
  def('galv', 'Galvanische Kopplung (gemeinsame Impedanz)', 'U', 'U = I·Z', 'V', ['I [A]', 'Z [Ω]'], ['A', 'Ω'], '{0}·{1}', function (i, z) { return i >= 0 && z >= 0 ? i * z : NaN; });
  def('hnwEnv', 'Pegel der Einhüllenden bei f', 'L', 'c = 2A·τ/T, −20 dB/Dekade ab f1 = 1/(π·τ), −40 dB/Dekade ab f2 = 1/(π·tr); L = 20·lg(c/√2/1 µV)', 'dBµV',
    ['A [V]', 'T [s]', 'τ [s]', 'tr [s]', 'f [Hz]'], ['V', 's', 's', 's', 'Hz'], 'Einhüllende von A = {0}, T = {1}, τ = {2}, tr = {3} bei f = {4}',
    function (A_, T, tau, tr, f) { const e = spec.envelope({ A: A_, T: T, tau: tau, tr: tr }); return e.ok ? e.levelAt(f) : NaN; }, function (A_, T, tau, tr) { const e = spec.envelope({ A: A_, T: T, tau: tau, tr: tr }); return e.ok ? '' : e.why; });
  def('knick', 'Knickfrequenz f1 (Impulsbreite)', 'f1', 'f1 = 1/(π·τ)', 'Hz', ['τ [s]'], ['s'], '1/(π·{0})', function (t) { return t > 0 ? 1 / (Math.PI * t) : NaN; });
  def('knick2', 'Knickfrequenz f2 (Flanke)', 'f2', 'f2 = 1/(π·tr)', 'Hz', ['tr [s]'], ['s'], '1/(π·{0})', function (t) { return t > 0 ? 1 / (Math.PI * t) : NaN; });
  def('flankeBw', 'Bandbreite aus der Flanke (10–90 %)', 'BW', 'BW = 0,35/tr', 'Hz', ['tr (10–90 %) [s]'], ['s'], '0,35/{0}', function (t) { return t > 0 ? 0.35 / t : NaN; });
  def('skin', 'Hauttiefe', 'δ', 'δ = 1/√(π·f·µ0·µr·σ)', 'm', ['f [Hz]', 'σ [S/m]', 'µr'], ['Hz', 'S/m', '#'], '1/√(π·{0}·µ0·{2}·{1})', function (f, s, mu) { mu = isFinite(mu) ? mu : 1; return f > 0 && s > 0 && mu > 0 ? 1 / Math.sqrt(Math.PI * f * MU0 * mu * s) : NaN; });
  def('se', 'Schirmdämpfung im Fernfeld (A + R + B)', 'SE', 'SE = A + R + B mit A = 8,686·t/δ, R = 20·lg(Z0/(4·|Zs|)), B = 20·lg|1 − e^(−2t/δ)| (nur wenn A < 15 dB)', 'dB',
    ['t [m]', 'f [Hz]', 'σ [S/m]', 'µr'], ['m', 'Hz', 'S/m', '#'], 'Blech t = {0}, f = {1}, σ = {2}, µr = {3}', function (t, f, s, mu) {
      const r = shield.se({ mat: { sigma: s, mur: isFinite(mu) ? mu : 1 }, t: t, f: f, feld: 'fern' });
      return r.ok ? r.A + r.R + r.B : NaN;
    });
  def('seThin', 'Schirmdämpfung eines dünnen Films (Leitlack)', 'SE', 'SE = 20·lg(1 + Z0/(2·R□))', 'dB', ['R□ [Ω]'], ['Ω'], '20·lg(1 + 377 Ω/(2·{0}))', function (r) { return r > 0 ? 20 * lg(1 + Z0 / (2 * r)) : NaN; });
  def('schlitz', 'Schirmdämpfung eines Schlitzes', 'SE', 'SE = 20·lg(λ/(2·ℓ)), nur für ℓ < λ/2', 'dB', ['λ [m]', 'ℓ [m]'], ['m', 'm'], '20·lg({0}/(2·{1}))', function (l, len) { return l > 0 && len > 0 && len < l / 2 ? 20 * lg(l / (2 * len)) : NaN; },
    function (l, len) { return l > 0 && len >= l / 2 ? TEXTS.schlitzHalb : TEXTS.eingabe; });
  def('lambda', 'Wellenlänge', 'λ', 'λ = c0/f', 'm', ['f [Hz]'], ['Hz'], '299 792 458 m/s / {0}', function (f) { return f > 0 ? C0 / f : NaN; });
  def('lambda4', 'Viertelwellenlänge (Kabel als Antenne)', 'ℓ', 'ℓ = c0/(4·f)', 'm', ['f [Hz]'], ['Hz'], '299 792 458 m/s / (4·{0})', function (f) { return f > 0 ? C0 / (4 * f) : NaN; });
  def('eKurz', 'Feldstärke eines kurzen Kabels (Gleichtakt)', 'E', 'E = 1,257·10⁻⁶·f·ℓ·I/r, nur für ℓ < λ/10', 'V/m', ['f [Hz]', 'ℓ [m]', 'I [A]', 'r [m]'], ['Hz', 'm', 'A', 'm'], '1,257·10⁻⁶·{0}·{1}·{2}/{3}',
    function (f, l, i, r) { return f > 0 && l > 0 && i >= 0 && r > 0 && l < C0 / f / 10 ? 1.257e-6 * f * l * i / r : NaN; },
    function (f, l) { return f > 0 && l >= C0 / f / 10 ? TEXTS.get('kurzkabelLang', { len: fmtEng(l, 'm'), l10: fmtEng(C0 / f / 10, 'm') }) : TEXTS.eingabe; });
  def('yStrom', 'Ableitstrom über einen Y-Kondensator', 'I', 'I = 2π·f·C·U', 'A', ['f [Hz]', 'C [F]', 'U [V]'], ['Hz', 'F', 'V'], '2π·{0}·{1}·{2}', function (f, c, u) { return f >= 0 && c >= 0 && u >= 0 ? TWO_PI * f * c * u : NaN; });
  def('hbm', 'Energie des Körpermodells (ESD)', 'E', 'E = ½·C·U²', 'J', ['C [F]', 'U [V]'], ['F', 'V'], '½·{0}·{1}²', function (c, u) { return c >= 0 && u >= 0 ? 0.5 * c * u * u : NaN; });
  def('hbmI', 'Strom des Körpermodells (idealisiert)', 'I', 'I = U/R', 'A', ['U [V]', 'R [Ω]'], ['V', 'Ω'], '{0}/{1}', function (u, r) { return u >= 0 && r > 0 ? u / r : NaN; });
  def('marge', 'Marge zur Grenzlinie', 'M', 'Marge = Grenzwert − Pegel', 'dB', ['Grenzwert [dBµV]', 'Pegel [dBµV]'], ['#', '#'], '{0} − {1}', function (g, l) { return g - l; });
  def('snr', 'Störabstand', 'SNR', 'SNR = 20·lg(U_Nutz/U_Stör)', 'dB', ['U_Nutz [V]', 'U_Stör [V]'], ['V', 'V'], '20·lg({0}/{1})', function (n, s) { return n > 0 && s > 0 ? 20 * lg(n / s) : NaN; }, function () { return TEXTS.dbNull; });
  formulas.list = function () { return FORDER.map(function (id) { return formulas[id]; }); };
  hide(formulas, 'list', formulas.list);
  hide(formulas, 'fnInfo', function (id) {
    try {
      const f = formulas[id];
      if (!f || typeof f.explain !== 'function') return { ok: false, value: NaN, why: 'Die Formel „' + String(id) + '“ gibt es nicht.' };
      const a = Array.prototype.slice.call(arguments, 1);
      const r = f.explain.apply(null, a);
      return r;
    } catch (e) { return { ok: false, value: NaN, why: TEXTS.eingabe }; }
  });
  api.formulas = formulas;

  /* =============================== 4.11 Uebungen =============================== */
  const KINDS = ['dbV', 'dbP', 'dbuv', 'dbSum', 'fRes', 'fgRC', 'ilRC', 'schleife', 'uInd', 'kapTeiler', 'knick', 'hnw', 'skin', 'seFern', 'schlitz', 'lambda4', 'yStrom', 'hbm', 'marge', 'dbm'];
  const E6 = [1, 1.5, 2.2, 3.3, 4.7, 6.8];
  /* Anzeigeeinheit mit Vorsatz: { unit, scale } so, dass der Wert 1...999 wird */
  function dispUnit(si, base) {
    const a = Math.abs(si);
    for (let i = 0; i < PREF.length; i++) {
      if (PREF[i][0] > 1e9 || PREF[i][0] < 1e-12) continue;
      if (a >= PREF[i][0] * 0.99995) return { unit: PREF[i][1] + base, scale: PREF[i][0] };
    }
    return { unit: 'p' + base, scale: 1e-12 };
  }
  function exercise(kind, seed) {
    if (KINDS.indexOf(kind) < 0) return fail('Unbekannte Übungsart „' + String(kind) + '“. Erlaubt: ' + KINDS.join(', ') + '.');
    const sd = isFinite(num(seed, NaN)) ? Math.floor(num(seed, 1)) : 1;
    const R = rng(sd * 7919 + KINDS.indexOf(kind) * 104729 + 13);
    const pick = function (a) { return a[Math.floor(R.next() * a.length) % a.length]; };
    const F = formulas;
    let q = '', given = {}, steps = [], value = NaN, base = '', unitFix = null, tol = 0.03, tolType = 'rel', alt = [], wrong = [], is2pi = false, isDb = false, lowHint = '', highHint = '';
    function wr(v, text) { if (isFinite(v)) wrong.push({ v: v, text: text }); }
    switch (kind) {
      case 'dbV': {
        const u1 = pick([1, 2, 5, 10, 20, 50]) * 1e-3, r = pick([2, 5, 10, 20, 50, 100, 200, 500, 1000, 0.5, 0.1]), u2 = u1 * r;
        given = { u1: u1, u2: u2 }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dB';
        q = 'Eine Störspannung steigt von U1 = ' + fmtEng(u1, 'V') + ' auf U2 = ' + fmtEng(u2, 'V') + '. Berechne das Verhältnis in dB (Spannungsverhältnis).';
        value = F.dbV.fn(u2, u1); steps = F.dbV.explain(u2, u1).steps;
        wr(value / 2, 'Du hast 10·lg benutzt. Bei einem Spannungsverhältnis gilt 20·lg (Leistung ist Spannung zum Quadrat).');
        lowHint = 'Prüfe: a = 20·lg(U2/U1).'; highHint = lowHint;
        break;
      }
      case 'dbP': {
        const p1 = pick([1, 2, 5, 10]) * 1e-3, r = pick([2, 4, 10, 20, 100, 1000, 0.5, 0.1]), p2 = p1 * r;
        given = { p1: p1, p2: p2 }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dB';
        q = 'Die Störleistung ändert sich von P1 = ' + fmtEng(p1, 'W') + ' auf P2 = ' + fmtEng(p2, 'W') + '. Berechne das Verhältnis in dB (Leistungsverhältnis).';
        value = F.dbP.fn(p2, p1); steps = F.dbP.explain(p2, p1).steps;
        wr(value * 2, 'Du hast 20·lg benutzt. Bei einem Leistungsverhältnis gilt 10·lg.');
        lowHint = 'Prüfe: a = 10·lg(P2/P1).'; highHint = lowHint;
        break;
      }
      case 'dbuv': {
        const u = pick([1, 2, 5, 10, 20, 50, 100, 200, 500]) * pick([1e-6, 1e-3]);
        given = { u: u }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dBµV';
        q = 'Ein Analysator zeigt eine Effektivspannung von ' + fmtEng(u, 'V') + '. Rechne sie in dBµV um.';
        value = F.dbuv.fn(u); steps = F.dbuv.explain(u).steps;
        wr(value / 2, 'Du hast 10·lg benutzt. Spannungen rechnest du mit 20·lg.');
        wr(value - 60, 'Der Bezug ist 1 µV, nicht 1 mV: 1 mV entspricht 60 dBµV.');
        lowHint = 'Prüfe: L = 20·lg(U/1 µV).'; highHint = lowHint;
        break;
      }
      case 'dbSum': {
        const l1 = pick([40, 46, 50, 56, 60]), l2 = pick([l1, l1 - 3]);
        given = { l1: l1, l2: l2 }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dBµV';
        q = 'Zwei unabhängige Störquellen erzeugen am selben Messpunkt ' + fmt(l1) + ' dBµV und ' + fmt(l2) + ' dBµV. Berechne den Gesamtpegel in dBµV.';
        value = F.dbSum.fn(l1, l2); steps = F.dbSum.explain(l1, l2).steps;
        wr(l1 + l2, 'Pegel in dB darfst du nicht einfach addieren. Rechne in Leistung um, addiere und wandle zurück.');
        wr(Math.max(l1, l2), 'Der Gesamtpegel liegt über dem größeren Einzelpegel, weil sich die Leistungen addieren.');
        lowHint = 'Prüfe: L = 10·lg(10^(L1/10) + 10^(L2/10)).'; highHint = lowHint;
        break;
      }
      case 'fRes': {
        const L = pick(E6) * pick([1e-6, 10e-6, 100e-6, 1e-3]), c = pick(E6) * pick([1e-9, 10e-9, 100e-9]);
        given = { L: L, C: c }; base = 'Hz'; is2pi = true;
        q = 'Ein LC-Kreis hat L = ' + fmtEng(L, 'H') + ' und C = ' + fmtEng(c, 'F') + '. Berechne die Resonanzfrequenz f0.';
        value = F.fRes.fn(L, c); steps = F.fRes.explain(L, c).steps;
        alt = [159e3 / Math.sqrt(L * 1e6 * c * 1e6)];
        wr(value * TWO_PI, 'Das ist die Kreisfrequenz ω0 = 1/√(L·C). Die Frequenz ist f0 = ω0/(2π).');
        lowHint = 'Prüfe: f0 = 1/(2π·√(L·C)). Tabellenbuch: f0 = 159 kHz/√(L in µH · C in µF).'; highHint = lowHint;
        break;
      }
      case 'fgRC': {
        const r = pick(E6) * pick([10, 100, 1e3, 10e3]), c = pick(E6) * pick([1e-9, 10e-9, 100e-9]);
        given = { R: r, C: c }; base = 'Hz'; is2pi = true;
        q = 'Ein RC-Tiefpass hat R = ' + fmtEng(r, 'Ω') + ' und C = ' + fmtEng(c, 'F') + '. Berechne die Grenzfrequenz fg (−3 dB).';
        value = F.fgRC.fn(r, c); steps = F.fgRC.explain(r, c).steps;
        alt = [159 / (r / 1e3 * c * 1e6)];
        wr(value * TWO_PI, 'Das ist 1/(R·C), also die Kreisfrequenz. Die Grenzfrequenz ist fg = 1/(2π·R·C).');
        lowHint = 'Prüfe: fg = 1/(2π·R·C).'; highHint = lowHint;
        break;
      }
      case 'ilRC': {
        const fg = pick([1e3, 10e3, 100e3, 1e6]), x = pick([2, 5, 10, 100]), f = x * fg;
        given = { f: f, fg: fg }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dB';
        q = 'Ein RC-Tiefpass hat die Grenzfrequenz fg = ' + fmtEng(fg, 'Hz') + '. Berechne seine Dämpfung bei f = ' + fmtEng(f, 'Hz') + ' in dB.';
        value = F.ilFirst.fn(f, fg, 1); steps = F.ilFirst.explain(f, fg, 1).steps;
        alt = [20 * lg(x)];
        wr(value / 2, 'Du hast 10·lg statt 20·lg benutzt. Das Verhältnis ist eine Spannung.');
        lowHint = 'Prüfe: a = 20·lg√(1 + (f/fg)²); oberhalb fg gilt etwa 20·lg(f/fg).'; highHint = lowHint;
        break;
      }
      case 'schleife': {
        const b = pick([2, 4, 5, 10, 20]), h = pick([1, 2, 3, 5, 10]);
        given = { b: b / 100, h: h / 100 }; unitFix = { unit: 'cm²', scale: 1e-4 };
        q = 'Eine Leiterschleife ist b = ' + fmt(b) + ' cm lang und h = ' + fmt(h) + ' cm hoch. Berechne die Schleifenfläche in cm².';
        value = F.schleife.fn(b / 100, h / 100); steps = F.schleife.explain(b / 100, h / 100).steps;
        wr(2 * (b + h) * 1e-4, 'Das ist der Umfang (in cm). Die Fläche ist b·h.');
        lowHint = 'Prüfe: A = b·h.'; highHint = lowHint;
        break;
      }
      case 'uInd': {
        const f = pick([50, 1e3, 10e3, 100e3]), B = pick([1, 2, 5, 10, 100]) * 1e-6, a = pick([10, 20, 50, 100]) * 1e-4;
        given = { f: f, B: B, A: a }; base = 'V'; is2pi = true;
        q = 'Eine Leiterschleife (A = ' + fmt(a * 1e4) + ' cm²) steht senkrecht in einem Wechselfeld mit f = ' + fmtEng(f, 'Hz') + ' und dem Spitzenwert B = ' + fmtEng(B, 'T') + '. Berechne die induzierte Spitzenspannung.';
        value = F.uInd.fn(f, B, a, 0); steps = F.uInd.explain(f, B, a, 0).steps;
        lowHint = 'Prüfe: û = 2π·f·B̂·A. Bei sinusförmigem Feld ist die Ableitung ω·B̂.'; highHint = lowHint;
        break;
      }
      case 'kapTeiler': {
        const us = pick([24, 100, 230, 325]), cm = pick([1, 2, 5]) * 1e-12, cg = pick([10, 20, 50]) * 1e-12;
        given = { us: us, cm: cm, cg: cg }; base = 'V';
        q = 'Ein Störer mit Us = ' + fmt(us) + ' V koppelt über Cm = ' + fmtEng(cm, 'F') + ' auf eine Leitung mit Cg = ' + fmtEng(cg, 'F') + ' gegen Masse. Berechne die Störspannung bei hoher Frequenz (Teiler aus den beiden Kapazitäten).';
        value = F.kapTeiler.fn(us, cm, cg); steps = F.kapTeiler.explain(us, cm, cg).steps;
        wr(us * cm / cg, 'Im Nenner steht die Summe Cm + Cg, nicht nur Cg.');
        lowHint = 'Prüfe: UN = Us·Cm/(Cm + Cg).'; highHint = lowHint;
        break;
      }
      case 'knick': {
        if (R.next() < 0.5) {
          const tau = pick([100e-9, 200e-9, 500e-9, 1e-6, 2e-6, 5e-6]);
          given = { tau: tau }; base = 'Hz';
          q = 'Ein Rechtecksignal hat die Impulsbreite τ = ' + fmtEng(tau, 's') + '. Berechne die erste Knickfrequenz f1 der Einhüllenden.';
          value = F.knick.fn(tau); steps = F.knick.explain(tau).steps;
          wr(value / 2, 'Der Knick liegt bei f1 = 1/(π·τ), nicht bei 1/(2π·τ).');
          wr(value * Math.PI * Math.PI, 'Das π gehört in den Nenner: f1 = 1/(π·τ).');
        } else {
          const tr = pick([2e-9, 5e-9, 10e-9, 20e-9, 50e-9, 100e-9]);
          given = { tr: tr }; base = 'Hz';
          q = 'Ein Signal hat die Anstiegszeit tr = ' + fmtEng(tr, 's') + ' (von 0 auf 100 %). Berechne die zweite Knickfrequenz f2 der Einhüllenden.';
          value = F.knick2.fn(tr); steps = F.knick2.explain(tr).steps;
          wr(value / 2, 'Der Knick liegt bei f2 = 1/(π·tr), nicht bei 1/(2π·tr).');
        }
        lowHint = 'Prüfe: f1 = 1/(π·τ) und f2 = 1/(π·tr).'; highHint = lowHint;
        break;
      }
      case 'hnw': {
        const A_ = pick([5, 12, 24, 325]), tr = pick([10e-9, 20e-9, 50e-9, 100e-9]), n = pick([50, 100, 300, 1000]);
        const T = 1e-5, tau = 5e-6, f = n / T;
        given = { A: A_, T: T, tau: tau, tr: tr, n: n, f: f }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dBµV';
        q = 'Ein Rechtecksignal mit A = ' + fmt(A_) + ' V, T = ' + fmtEng(T, 's') + ', τ = ' + fmtEng(tau, 's') + ' und tr = ' + fmtEng(tr, 's') + ' hat Oberwellen. Berechne den Pegel der Einhüllenden bei der ' + n + '. Oberwelle (f = ' + fmtEng(f, 'Hz') + ') in dBµV (Effektwert).';
        value = F.hnwEnv.fn(A_, T, tau, tr, f); steps = F.hnwEnv.explain(A_, T, tau, tr, f).steps;
        const e = spec.envelope({ A: A_, T: T, tau: tau, tr: tr });
        steps.push('Knickfrequenzen: f1 = ' + fmtEng(e.f1, 'Hz') + ', f2 = ' + fmtEng(e.f2, 'Hz') + '; Spitzenwert → Effektwert: durch √2.');
        wr(value + 20 * lg(Math.SQRT2), 'Du hast den Spitzenwert in dBµV umgerechnet. Der Pegel gilt für den Effektwert (Spitzenwert durch √2, das sind 3 dB weniger).');
        if (f > e.f2) { const c20 = e.c0 * (e.f1 / f); wr(uvOf(c20 / Math.SQRT2), 'Oberhalb von f2 fällt die Einhüllende mit 40 dB je Dekade, nicht nur mit 20 dB.'); }
        lowHint = 'Prüfe: c = 2A·τ/T, dann −20 dB/Dekade ab f1 und −40 dB/Dekade ab f2, am Ende durch √2.'; highHint = lowHint;
        break;
      }
      case 'skin': {
        const f = pick([10e3, 100e3, 1e6, 10e6, 100e6]);
        given = { f: f, sigma: 5.8e7 }; base = 'm'; unitFix = { unit: 'µm', scale: 1e-6 };
        q = 'Berechne die Hauttiefe δ von Kupfer (σ = 58 MS/m) bei f = ' + fmtEng(f, 'Hz') + ' in µm.';
        value = F.skin.fn(f, 5.8e7, 1); steps = F.skin.explain(f, 5.8e7, 1).steps;
        alt = [66e-6 / Math.sqrt(f / 1e6), Math.sqrt(0.0172e-6 / (Math.PI * f * MU0)), Math.sqrt(0.0178e-6 / (Math.PI * f * MU0))];
        lowHint = 'Prüfe: δ = 1/√(π·f·µ0·σ). Faustformel Kupfer: 66 µm/√(f in MHz).'; highHint = lowHint;
        break;
      }
      case 'seFern': {
        const mat = pick(['kupfer', 'alu']), t = pick([0.1, 0.2, 0.5, 1]) * 1e-3, f = pick([1e6, 10e6, 100e6]);
        const r = shield.se({ mat: mat, t: t, f: f, feld: 'fern' }), m = MATS[mat];
        given = { mat: mat, t: t, f: f }; isDb = true; tol = 1; tolType = 'abs'; base = 'dB';
        q = 'Ein Gehäuseblech aus ' + m.name + ' (σ = ' + fmtEng(m.sigma, 'S/m') + ') ist ' + fmtEng(t, 'm') + ' dick. Berechne die Schirmdämpfung im Fernfeld bei ' + fmtEng(f, 'Hz') + ' (SE = A + R + B).';
        value = r.A + r.R + r.B;
        steps = ['δ = ' + fmtEng(r.delta, 'm') + ', Absorption A = 8,686·t/δ = ' + fmt(r.A, 1) + ' dB', 'Reflexion R = 20·lg(Z0/(4·|Zs|)) = ' + fmt(r.R, 1) + ' dB (Z0 = 377 Ω, |Zs| = ' + fmtEng(r.zs, 'Ω') + ')',
          r.bApplied ? 'Mehrfachreflexion B = ' + fmt(r.B, 1) + ' dB (nur weil A unter 15 dB liegt)' : 'Mehrfachreflexion B entfällt (A ≥ 15 dB)', 'SE = A + R + B = ' + fmt(value, 1) + ' dB'];
        if (r.bApplied) alt = [r.A + r.R];
        wr(r.A, 'Das ist nur die Absorption A. Die Reflexion R kommt dazu.');
        wr(r.R, 'Das ist nur die Reflexion R. Die Absorption A kommt dazu.');
        lowHint = 'Prüfe: SE = A + R + B mit A = 8,686·t/δ und R = 20·lg(Z0/(4·|Zs|)).'; highHint = lowHint;
        break;
      }
      case 'schlitz': {
        const f = pick([100e6, 300e6, 1e9]), len = f === 100e6 ? pick([0.05, 0.1, 0.2]) : (f === 300e6 ? pick([0.02, 0.05, 0.1]) : pick([0.01, 0.02, 0.05]));
        const lam = C0 / f;
        given = { f: f, len: len, lambda: lam }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dB';
        q = 'Ein Gehäuse hat einen Schlitz der Länge ℓ = ' + fmtEng(len, 'm') + '. Berechne seine Schirmdämpfung bei f = ' + fmtEng(f, 'Hz') + ' mit der Schlitzformel (Faustformel, Schlitz kürzer als λ/2).';
        value = F.schlitz.fn(lam, len); steps = ['λ = c0/f = ' + fmtEng(lam, 'm')].concat(F.schlitz.explain(lam, len).steps);
        alt = [20 * lg(3e8 / f / (2 * len))];
        q += ' Mit c0 = 3·10⁸ m/s erhältst du ' + fmt(alt[0], 1) + ' dB; auch das ist richtig.';
        wr(value + 20 * lg(2), 'Im Nenner fehlt die 2: Ein Schlitz strahlt bei λ/2, die Formel lautet 20·lg(λ/(2·ℓ)).');
        wr(value / 2, 'Du hast 10·lg statt 20·lg benutzt.');
        lowHint = 'Prüfe: SE = 20·lg(λ/(2·ℓ)) mit λ = c0/f.'; highHint = lowHint;
        break;
      }
      case 'lambda4': {
        const f = pick([30e6, 50e6, 75e6, 100e6, 150e6, 300e6]);
        given = { f: f }; base = 'm';
        q = 'Ein Kabel soll bei f = ' + fmtEng(f, 'Hz') + ' als Viertelwellen-Antenne wirken. Berechne die Kabellänge ℓ = λ/4.';
        value = F.lambda4.fn(f); steps = F.lambda4.explain(f).steps;
        alt = [3e8 / (4 * f)];
        q += ' Mit c0 = 3·10⁸ m/s erhältst du ' + fmtSmart(alt[0]) + ' m; auch das ist richtig.';
        wr(4 * value, 'Das ist die ganze Wellenlänge λ. Die Viertelwelle ist λ/4.');
        wr(2 * value, 'Das ist die halbe Wellenlänge λ/2. Gesucht ist λ/4.');
        lowHint = 'Prüfe: ℓ = c0/(4·f), mit c0 = 3·10⁸ m/s oder 299 792 458 m/s.'; highHint = lowHint;
        break;
      }
      case 'yStrom': {
        const c = pick([1e-9, 2.2e-9, 4.7e-9]);
        given = { f: 50, C: c, U: 230 }; base = 'A'; unitFix = { unit: 'mA', scale: 1e-3 }; is2pi = true;
        q = 'Ein Y-Kondensator mit ' + fmtEng(c, 'F') + ' liegt zwischen dem Netzleiter (230 V, 50 Hz) und dem Schutzleiter. Berechne den Ableitstrom in mA.';
        value = F.yStrom.fn(50, c, 230); steps = F.yStrom.explain(50, c, 230).steps;
        lowHint = 'Prüfe: I = 2π·f·C·U.'; highHint = lowHint;
        break;
      }
      case 'hbm': {
        const u = pick([2e3, 4e3, 6e3, 8e3]);
        given = { C: 150e-12, U: u }; base = 'J'; unitFix = { unit: 'mJ', scale: 1e-3 };
        q = 'Das Körpermodell der ESD-Prüfung hat C = 150 pF und wird auf U = ' + fmtEng(u, 'V') + ' aufgeladen. Berechne die gespeicherte Energie in mJ.';
        value = F.hbm.fn(150e-12, u); steps = F.hbm.explain(150e-12, u).steps;
        wr(2 * value, 'Der Faktor ½ fehlt: E = ½·C·U².');
        lowHint = 'Prüfe: E = ½·C·U².'; highHint = lowHint;
        break;
      }
      case 'marge': {
        const lim = pick([46, 50, 56, 60]), lv = lim + pick([-12, -8, -3, 4, 9]);
        given = { limit: lim, level: lv }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dB';
        q = 'Die Übungsgrenzlinie liegt bei ' + fmt(lim) + ' dBµV, der gemessene Pegel bei ' + fmt(lv) + ' dBµV. Berechne die Marge in dB (positiv = Abstand zur Grenzlinie).';
        value = F.marge.fn(lim, lv); steps = F.marge.explain(lim, lv).steps;
        wr(-value, 'Das Vorzeichen ist vertauscht. Marge = Grenzwert − Pegel; positiv bedeutet Abstand zur Grenzlinie.');
        lowHint = 'Prüfe: Marge = Grenzwert − Pegel.'; highHint = lowHint;
        break;
      }
      case 'dbm': {
        const p = pick([-60, -50, -40, -30, -20, -10, 0, 10]);
        given = { dBm: p }; isDb = true; tol = 0.5; tolType = 'abs'; base = 'dBµV';
        q = 'Ein Analysator (50 Ω) zeigt ' + fmt(p) + ' dBm. Rechne den Wert in dBµV um.';
        value = F.dbm.fn(p); steps = F.dbm.explain(p).steps;
        alt = [p + 106.99];
        wr(p - 107, 'Das Vorzeichen ist vertauscht: dBµV liegt 107 dB über dBm (50 Ω).');
        lowHint = 'Prüfe: dBµV = dBm + 107 (genauer 106,99).'; highHint = lowHint;
        break;
      }
      default: return fail('Unbekannte Übungsart.');
    }
    const du = unitFix || (base === 'm' && Math.abs(value) >= 0.01 && Math.abs(value) < 1000 ? { unit: 'm', scale: 1 } : (base && !isDb && base !== 'dB' && base !== 'dBµV' ? dispUnit(value, base) : { unit: base, scale: 1 }));
    const scale = du.scale;
    if (!unitFix && !isDb && du.unit) q += ' Gib das Ergebnis in ' + du.unit + ' an.';
    const ans = { value: value / scale, unit: du.unit, scale: scale, si: value, tol: tol, tolType: tolType, alt: alt.map(function (a) { return a / scale; }) };
    if (isDb) ans.scale = 1;
    const wrongD = wrong.map(function (w) { return { v: w.v / scale, text: w.text }; });
    function match(d, ref) { return tolType === 'abs' ? Math.abs(d - ref) <= tol + 1e-12 : Math.abs(d - ref) <= tol * Math.abs(ref) + 1e-15 * Math.abs(ref) + 1e-300; }
    function check(input) {
      try {
        const qy = parseQty(input);
        if (!qy) return { ok: false, text: TEXTS.keineZahl, why: 'keineZahl' };
        const d = qy.hasUnit && ans.scale !== 1 ? qy.v / ans.scale : qy.raw;
        const unitTxt = ans.unit ? ' ' + ans.unit : '';
        if (match(d, ans.value)) return { ok: true, text: 'Richtig: ' + fmtSmart(ans.value) + unitTxt + '.', value: d };
        for (let i = 0; i < ans.alt.length; i++) {
          if (match(d, ans.alt[i])) return { ok: true, text: 'Richtig. Mit dem Tabellenwert kommt ' + fmtSmart(ans.alt[i]) + unitTxt + ' heraus, mit dem genauen Wert ' + fmtSmart(ans.value) + unitTxt + '; beides ist in Ordnung.', value: d, alt: true };
        }
        for (let i = 0; i < wrongD.length; i++) {
          const w = wrongD[i];
          const hit = tolType === 'abs' ? Math.abs(d - w.v) <= tol : Math.abs(d - w.v) <= 0.03 * Math.abs(w.v);
          if (hit && !match(w.v, ans.value)) return { ok: false, text: w.text, why: 'typisch' };
        }
        if (is2pi && !isDb) {
          if (match(d, ans.value * TWO_PI)) return { ok: false, text: 'Dein Wert ist etwa 2π-mal zu groß: Prüfe, ob du ω und f verwechselt hast (ω = 2π·f).', why: '2pi' };
          if (match(d, ans.value / TWO_PI)) return { ok: false, text: 'Dein Wert ist etwa 2π-mal zu klein: Der Faktor 2π fehlt.', why: '2pi' };
        }
        if (!isDb && ans.value !== 0 && d !== 0) {
          const ratio = d / ans.value, ks = [1, 2, 3, 6, 9, 12];
          for (let i = 0; i < ks.length; i++) {
            for (let sg = -1; sg <= 1; sg += 2) {
              const p10 = Math.pow(10, sg * ks[i]);
              if (Math.abs(ratio / p10 - 1) <= 0.03) return { ok: false, text: 'Die Größenordnung stimmt nicht (Faktor ' + (sg > 0 ? '' : '1/') + fmt(Math.pow(10, ks[i])) + '). Prüfe den Vorsatz: nano, pico, Mikro, milli, kilo, Mega.', why: 'groessenordnung' };
            }
          }
        }
        const low = d < ans.value;
        return { ok: false, text: (low ? 'Zu klein: ' : 'Zu groß: ') + fmtSmart(d) + unitTxt + ' liegt ' + (low ? 'unter' : 'über') + ' dem Ergebnis. ' + (low ? lowHint : highHint), why: low ? 'klein' : 'gross' };
      } catch (e) { return { ok: false, text: TEXTS.keineZahl, why: 'keineZahl' }; }
    }
    return { ok: true, kind: kind, seed: sd, question: q, given: given, answer: ans, steps: steps, check: check, wrong: wrongD, has2pi: is2pi };
  }
  function fmtSmart(x) { if (!isFinite(x)) return '–'; const a = Math.abs(x); return fmt(x, a >= 100 ? 0 : (a >= 10 ? 1 : 2)); }
  exercise.kinds = KINDS;
  api.exercise = S(exercise);
  api.exercise.kinds = KINDS;

  /* =============================== 4.10 Diagnose =============================== */
  const UNETZ_MAX = 253; /* 230 V + 10 % */
  Object.assign(TEXTS.diag, {
    'kap-dom': 'Die kapazitive Kopplung dominiert ({uKap} gegen {uInd} induktiv). Verkleinere die Opfer-Impedanz, vergrößere den Abstand oder lege den Schirm einseitig auf.',
    'ind-dom': 'Die induktive Kopplung dominiert ({uInd} gegen {uKap} kapazitiv). Verkleinere die Schleifenfläche (verdrillen) oder schirme beidseitig; ein einseitiger Schirm hilft hier nicht.',
    'galv-dom': 'Die gemeinsame Rückleitung koppelt ({uGalv}): Trenne die Rückleiter oder verkleinere ihre Impedanz.',
    'schirm-mag': 'Der einseitig aufgelegte Schirm führt keinen Strom und schirmt das Magnetfeld nicht.',
    'schirm-fc': 'Ein beidseitiger Schirm wirkt gegen Magnetfelder erst oberhalb fc = {fc}; bei f = {f} ist SF = {sf}.',
    'brumm': 'Die Masseschleife treibt {iLoop} durch den Rückleiter: Brummspannung {uBrumm}. Löse eine Erdung (Schirm nur einseitig) oder übertrage symmetrisch.',
    'lang': '{why}',
    'ringing': 'Die Schaltzelle schwingt bei {fr} nach (Überschwingen {os} %). Dämpfe mit einem Snubber (R etwa Z0 = {z0}).',
    'flanke': 'Die Flanke von {tr} erzeugt Oberwellen bis {f2} (Knick bei f2). Verlangsame sie (Gate-Widerstand): Eine doppelt so lange Flanke kostet {dP} mehr Schaltverlust.',
    'gerade': 'Bei 50 % Tastverhältnis fehlen die geraden Oberwellen.',
    'cap-ind': 'Der Kondensator ist oberhalb {fres} eine Induktivität (Anschlussinduktivität {esl}): Kürze die Anschlüsse.',
    'dr-kap': 'Die Drossel ist oberhalb {fres} kapazitiv (Windungskapazität {cw}) und dämpft kaum noch.',
    'sat': 'Der Laststrom {i} sättigt die Drossel (Isat {isat}): Die Induktivität sinkt auf {pct} %.',
    'y-strom': 'Ableitstrom {leak} bei 230 V und 50 Hz.',
    'y-strom-vorgabe': 'Ableitstrom {leak} bei 230 V und 50 Hz, über der Vorgabe der Übung von {req}.',
    'y-strom-ok': 'Ableitstrom {leak} bei 230 V und 50 Hz, unter der Vorgabe der Übung von {req}.',
    'schlitz-lang': 'Der Schlitz ist so lang wie die halbe Wellenlänge ({len}): keine Schirmwirkung mehr.',
    'leck': 'Das schwächste Leck bestimmt: {name} mit {se} dB.',
    'pigtail': 'Die Schirmlitze ({lp}) hat bei {f} eine Kopplungsimpedanz von {zt} gegen {zt360} bei 360°.',
    'kabel-res': 'Das Kabel ({len}) ist bei {fres} eine Viertelwellen-Antenne: Verkürze es, entkopple es (Ferrit) oder schirme es 360°.',
    'rueck-umweg': 'Der Rückstrom muss einen Umweg von {detour} nehmen: Schleifenfläche {area} statt {direct}.',
    'abbl-weit': 'Der Weg vom Kondensator zum Pin hat {lm}: Der Kondensator wirkt nur bis {fe}.',
    'antires': 'Antiresonanz bei {f}: Die Impedanz steigt auf {z}.',
    'esd-ausfall': 'Spitze am Eingang {vq}, höchstzulässig {vabs}: Das Bauteil wird zerstört.',
    'esd-ausfall-energie': 'Das Schutzbauteil nimmt {w} auf (Grenze {wl}) und wird zerstört.',
    'esd-reset': 'Der Reset-Pegel fiel {t} unter {vil}: Das Gerät startet neu (Kriterium B).',
    'burst-treppe': 'Die Impulse addieren sich: nach {n} Impulsen {v} (τ = {tau}).',
    'var-dauer': 'Dauerspannung {u} über Vac,max {vac}: Der Varistor wird warm und altert.',
    'var-energie': 'Der Varistor nimmt {w} auf (Grenze {wl}).',
    'tk-ring': 'Der lange Masseanschluss ({lg}) schwingt mit der Tastkopfkapazität bei {fr}: Überschwinger {os} %. Nimm den Federkontakt.',
    'tk-pick': 'Die Masseschleife fängt {v} Störspannung ein.',
    'floor': 'Unter dem Eigenrauschen des Analysators nicht messbar.',
    'limit-frei': 'Für diese Frequenz gibt es in der Übungsgrenzlinie keinen Grenzwert.'
  });
  const DIAG_KIND = {
    'kap-dom': 'warn', 'ind-dom': 'warn', 'galv-dom': 'warn', 'schirm-mag': 'warn', 'schirm-fc': 'warn', 'brumm': 'warn', 'lang': 'warn', 'ringing': 'warn', 'flanke': 'warn', 'gerade': 'info',
    'cap-ind': 'warn', 'dr-kap': 'warn', 'sat': 'warn', 'y-strom': 'info', 'schlitz-lang': 'warn', 'leck': 'info', 'pigtail': 'warn', 'kabel-res': 'warn', 'rueck-umweg': 'info',
    'abbl-weit': 'warn', 'antires': 'info', 'esd-ausfall': 'error', 'esd-reset': 'warn', 'burst-treppe': 'info', 'var-dauer': 'warn', 'var-energie': 'warn', 'tk-ring': 'warn',
    'tk-pick': 'warn', 'floor': 'info', 'limit-frei': 'info'
  };
  const DIAG_FX = { 'esd-ausfall': 'crash', 'esd-reset': 'buzz', 'kabel-res': 'kazoo' };
  function dpush(out, id, vars, kind, textId) {
    const o = { id: id, kind: kind || DIAG_KIND[id] || 'info', text: TEXTS.get(textId || id, vars) };
    if (DIAG_FX[id]) o.fx = DIAG_FX[id];
    out.push(o);
  }
  /* Antiresonanz: Maximum zwischen zwei Minima der Impedanzkurve */
  function antiresOf(curve) {
    let fs_ = null, zs_ = null;
    if (isArr(curve)) { fs_ = curve.map(function (p) { return num(p && p.f, NaN); }); zs_ = curve.map(function (p) { return num(p && p.z, NaN); }); }
    else if (isObj(curve) && isArr(curve.f) && isArr(curve.z)) { fs_ = curve.f.map(function (v) { return num(v, NaN); }); zs_ = curve.z.map(function (v) { return num(v, NaN); }); }
    if (!fs_ || fs_.length < 5) return null;
    const ext = [];
    for (let i = 1; i < zs_.length - 1; i++) {
      if (!isFinite(zs_[i]) || !isFinite(zs_[i - 1]) || !isFinite(zs_[i + 1])) continue;
      if (zs_[i] > zs_[i - 1] && zs_[i] >= zs_[i + 1]) ext.push({ i: i, t: 'max' });
      else if (zs_[i] < zs_[i - 1] && zs_[i] <= zs_[i + 1]) ext.push({ i: i, t: 'min' });
    }
    let best = null;
    for (let k = 1; k < ext.length - 1; k++) {
      if (ext[k].t !== 'max' || ext[k - 1].t !== 'min' || ext[k + 1].t !== 'min') continue;
      const zm = zs_[ext[k].i], lo = Math.max(zs_[ext[k - 1].i], zs_[ext[k + 1].i]);
      if (zm > 1.2 * lo && (!best || zm > best.z)) best = { f: fs_[ext[k].i], z: zm };
    }
    return best;
  }
  api.diagnose = function (ctx) {
    const out = [];
    try {
      ctx = obj(ctx);
      const k = ctx.coup;
      if (isObj(k) && k.ok) {
        const ukap = num(k.uKap, 0), uind = num(k.uInd, 0);
        const kapDom = k.dominant === 'kapazitiv' && ukap > 2 * uind, indDom = k.dominant === 'induktiv' && uind > 2 * ukap;
        const schirm = k.in && k.in.schirm;
        if (kapDom) dpush(out, 'kap-dom', { uKap: fmtEng(ukap, 'V'), uInd: fmtEng(uind, 'V') });
        if (indDom) dpush(out, 'ind-dom', { uKap: fmtEng(ukap, 'V'), uInd: fmtEng(uind, 'V') });
        if (k.dominant === 'galvanisch') dpush(out, 'galv-dom', { uGalv: fmtEng(num(k.uGalv, 0), 'V') });
        if (schirm === 'eine' && indDom) dpush(out, 'schirm-mag', {});
        if (schirm === 'beide' && indDom && num(k.in.f, Infinity) < FC_SHIELD) dpush(out, 'schirm-fc', { fc: fmtEng(FC_SHIELD, 'Hz'), f: fmtEng(k.in.f, 'Hz'), sf: fmt(coupling.shieldMag(k.in.f), 2) });
        if (k.in && k.in.loop && num(k.uBrumm, 0) > num(k.uSum, 0)) dpush(out, 'brumm', { iLoop: fmtEng(num(k.iLoop, 0), 'A'), uBrumm: fmtEng(num(k.uBrumm, 0), 'V') });
        if (k.valid === false && typeof k.why === 'string') dpush(out, 'lang', { why: k.why });
      }
      const s = ctx.src;
      if (isObj(s) && s.ok && s.ring) {
        if (s.ring.ringing && s.ring.os > 0.2) dpush(out, 'ringing', { fr: fmtEng(s.ring.fr, 'Hz'), os: fmt(100 * s.ring.os, 0), z0: fmtEng(s.ring.Z0, 'Ω') });
        const lw = isObj(ctx.lisn) && isObj(ctx.lisn.worst) ? ctx.lisn.worst.marginAV : num(ctx.margin, NaN);
        if (s.tr < 3e-9 && lw < 0) {
          const dbl = source.flyback(Object.assign({}, s.cfg, { rg: 2 * s.cfg.rg, fMax: 1e6 }));
          const dP = dbl.ok ? dbl.pSw - s.pSw : NaN;
          if (isFinite(dP) && dP > 0) dpush(out, 'flanke', { tr: fmtEng(s.tr, 's'), f2: fmtEng(s.f2, 'Hz'), dP: fmtEng(dP, 'W') });
        }
        if (s.cfg && Math.abs(s.cfg.duty - 0.5) < 1e-9) dpush(out, 'gerade', {});
      }
      const fl = ctx.filt;
      if (isObj(fl) && isObj(fl.cfg) && num(fl.f, NaN) > 0) {
        const c = fcfg(fl.cfg), f = num(fl.f, NaN);
        if (c.topo !== 'kein' && c.cx > 0) {
          const fr = filter.fres({ type: 'cx', c: c.cx, lead: c.lead });
          const a = ilAt(c, f, false), b = ilAt(c, f, true);
          if (f > fr && a.gg < b.gg - 3) dpush(out, 'cap-ind', { fres: fmtEng(fr, 'Hz'), esl: fmtEng(filter.esl('cx', c.lead), 'H') });
        }
        if (c.drossel !== 'ohne' && c.topo !== 'C') {
          const d = DROSSELN[c.drossel], fr = filter.fres({ type: 'drossel', id: c.drossel });
          if (f > fr) dpush(out, 'dr-kap', { fres: fmtEng(fr, 'Hz'), cw: fmtEng(d.cw, 'F') });
          if (c.iLast > 0.5 * d.isat) dpush(out, 'sat', { i: fmtEng(c.iLast, 'A'), isat: fmtEng(d.isat, 'A'), pct: fmt(filter.satur(c), 0) });
        }
        if (c.cy > 0) {
          const leak = isFinite(num(ctx.leakA, NaN)) ? ctx.leakA : filter.leak({ cy: c.cy });
          const req = num(ctx.leakReq, NaN);
          if (isFinite(req)) dpush(out, 'y-strom', { leak: fmtEng(leak, 'A'), req: fmtEng(req, 'A') }, leak > req ? 'warn' : 'info', leak > req ? 'y-strom-vorgabe' : 'y-strom-ok');
          else dpush(out, 'y-strom', { leak: fmtEng(leak, 'A') });
        }
      }
      const sh = ctx.shield;
      if (isObj(sh) && (isObj(sh.cfg) || isObj(sh.res))) {
        const res = isObj(sh.res) && sh.res.ok ? sh.res : shield.total(sh.cfg);
        if (res.ok) {
          if (res.slot && res.slot.valid === false) dpush(out, 'schlitz-lang', { len: fmtEng(res.slot.len, 'm') });
          const lo = Math.min(res.seMat, res.seSlot, res.seHoles);
          if (res.nLeaks >= 1 && res.seGes <= lo + 3 && res.seGes < 150) dpush(out, 'leck', { name: res.leak, se: fmt(res.leakSE, 1) });
          if (res.cable && res.cable.mode === 'pigtail' && res.cable.ratio > 5) dpush(out, 'pigtail', { lp: fmtEng(res.cable.lp, 'm'), f: fmtEng(res.cable.f, 'Hz'), zt: fmtEng(res.cable.zt, 'Ω'), zt360: fmtEng(res.cable.zt360, 'Ω') });
        }
      }
      const an = ctx.antenna;
      if (isObj(an) && num(an.len, NaN) > 0 && isArr(an.lines)) {
        let hit = null;
        for (let i = 0; i < an.lines.length && !hit; i++) {
          const l = an.lines[i], f = num(l && l.f, NaN), m = num(l && l.margin, NaN);
          if (!(f > 0) || !(m < 6)) continue;
          for (let kk = 1; kk <= 5; kk++) { const fr = antenna.resonance(an.len, kk); if (Math.abs(f - fr) <= 0.1 * fr) { hit = { fres: fr }; break; } }
        }
        if (hit) dpush(out, 'kabel-res', { len: fmtEng(an.len, 'm'), fres: fmtEng(hit.fres, 'Hz') });
      }
      const ly = ctx.layout;
      if (isObj(ly) && num(ly.detourMm, 0) > 0 && num(ly.areaMm2, NaN) > num(ly.areaDirectMm2, NaN)) dpush(out, 'rueck-umweg', { detour: fmt(ly.detourMm, 0) + ' mm', area: fmt(ly.areaMm2, 0) + ' mm²', direct: fmt(ly.areaDirectMm2, 0) + ' mm²' });
      const ab = ctx.abbl;
      if (isObj(ab) && num(ab.lmountH, 0) > 3e-9 && num(ab.c, 0) > 0) {
        const fe = 1 / (TWO_PI * Math.sqrt((num(ab.eslH, 0) + ab.lmountH) * ab.c));
        dpush(out, 'abbl-weit', { lm: fmtEng(ab.lmountH, 'H'), fe: fmtEng(fe, 'Hz') });
      }
      if (ctx.pdnCurve) { const ar = antiresOf(ctx.pdnCurve); if (ar) dpush(out, 'antires', { f: fmtEng(ar.f, 'Hz'), z: fmtEng(ar.z, 'Ω') }); }
      const ed = ctx.esd;
      if (isObj(ed)) {
        const v = isObj(ed.verdict) ? ed.verdict : {};
        const vq = num(ed.vq, num(v.vq, NaN)), vabs = num(ed.vabs, num(v.vabs, NaN));
        if (v.kriterium === 'Ausfall') {
          if (vq > vabs) dpush(out, 'esd-ausfall', { vq: fmtEng(vq, 'V'), vabs: fmtEng(vabs, 'V') });
          else if (num(ed.w, 0) > num(ed.wLimit, Infinity)) dpush(out, 'esd-ausfall', { w: fmtEng(ed.w, 'J'), wl: fmtEng(ed.wLimit, 'J') }, 'error', 'esd-ausfall-energie');
        }
        const rs = num(ed.resetS, num(ed.resetNs, NaN) * 1e-9);
        if (v.kriterium === 'B' && rs >= num(ed.resetMin, 100e-9)) dpush(out, 'esd-reset', { t: fmtEng(rs, 's'), vil: fmtEng(num(ed.vil, num(ed.resetV, NaN)), 'V') });
      }
      const bu = ctx.burst;
      if (isObj(bu) && num(bu.tau, 0) > num(bu.gap, Infinity)) dpush(out, 'burst-treppe', { n: fmt(bu.n, 0), v: fmtEng(bu.v, 'V'), tau: fmtEng(bu.tau, 's') });
      const va = ctx.varist;
      if (isObj(va)) {
        if (UNETZ_MAX > num(va.vacMax, Infinity)) dpush(out, 'var-dauer', { u: fmtEng(UNETZ_MAX, 'V'), vac: fmtEng(va.vacMax, 'V') });
        if (num(va.w, 0) > num(va.wLimit, Infinity)) dpush(out, 'var-energie', { w: fmtEng(va.w, 'J'), wl: fmtEng(va.wLimit, 'J') });
      }
      const pr = ctx.probe;
      if (isObj(pr) && num(pr.os, 0) > 0.1 && num(pr.lgH, 0) > 12e-9 * 1.001) dpush(out, 'tk-ring', { lg: fmtEng(pr.lgH, 'H'), fr: fmtEng(pr.fr, 'Hz'), os: fmt(100 * pr.os, 0) });
      const pk = ctx.pick;
      if (isObj(pk) && num(pk.v, 0) > 0.05 * num(pk.amp, Infinity)) dpush(out, 'tk-pick', { v: fmtEng(pk.v, 'V') });
      if (ctx.floorHit) dpush(out, 'floor', {});
      const nl = ctx.noLimit;
      if (isObj(nl) && typeof nl.id === 'string' && LIM[nl.id] && num(nl.f, NaN) > 0 && limAt(nl.id, nl.f) === null) dpush(out, 'limit-frei', {});
    } catch (e) { /* nie werfen */ }
    return out;
  };
  api.diagnose.ids = Object.keys(DIAG_KIND);

  /* =============================== 4.12 Laeufer =============================== */
  function snapObj(o) { try { return o === undefined ? null : JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function collectKeys(list, map) {
    if (!isArr(list)) return;
    list.forEach(function (c) {
      if (c && typeof c.key === 'string') map[c.key] = c;
      if (c && isArr(c.items)) collectKeys(c.items, map);
      if (c && isArr(c.controls)) collectKeys(c.controls, map);
    });
  }
  function runSeq(rigIn, seq, tEndS, opts) {
    opts = isObj(opts) ? opts : {};
    const out = { ok: true, samples: [], final: null, events: [], faults: [], assess: null, errors: [], rejected: [] };
    let rig = null;
    try {
      const seedOpt = isFinite(num(opts.seed, NaN)) ? num(opts.seed, 1) : undefined;
      if (typeof rigIn === 'function') rig = rigIn(seedOpt);
      else if (typeof rigIn === 'string') {
        const Rr = root.EMV_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'EMV_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && typeof rigIn.setControl === 'function') {
        rig = rigIn; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { out.ok = false; if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); return out; }
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const tEnd = clamp(num(tEndS, 0), 0, 1e6);
    const sampleS = Math.max(tEnd / 20000, pos(opts.sampleS, tEnd / 200 || 1));
    const faultSet = {};
    function collect(st) { if (st && isArr(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } }); }
    function setCtl(key, v) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '" gibt es an dieser Anlage nicht.'); return; }
      let r;
      try { r = rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); return; }
      if (r === false) out.rejected.push({ key: key, value: v });
    }
    if (isObj(opts.controls)) Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k]); });
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, i) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: isObj(e.set) ? e.set : null, ramp: isObj(e.ramp) ? e.ramp : null, fire: !!e.fire, k: i });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    const ramps = [];
    let t = 0, qi = 0, nextSample = 0;
    function takeSample() {
      let st = null, m = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      try { m = typeof rig.readMeters === 'function' ? rig.readMeters() : null; } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
      out.samples.push({ t: t, meters: snapObj(m), state: snapObj(st) });
      collect(st);
    }
    for (let guardN = 0; guardN < 200000; guardN++) {
      while (qi < q.length && q[qi].t <= t + 1e-9) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k]); });
        if (e.ramp && typeof e.ramp.key === 'string') {
          let from = NaN;
          try { from = typeof rig.getControl === 'function' ? num(rig.getControl(e.ramp.key), NaN) : NaN; } catch (er) { /* */ }
          const to = num(e.ramp.to, NaN), dur = num(e.ramp.durS, 0);
          if (!isFinite(to)) out.errors.push('Rampe für „' + e.ramp.key + '“ hat keinen Zielwert.');
          else if (!(dur > 0) || !isFinite(from)) setCtl(e.ramp.key, to);
          else ramps.push({ key: e.ramp.key, from: from, to: to, t0: t, dur: dur, log: known[e.ramp.key] && known[e.ramp.key].unitKind === 'freq' && from > 0 && to > 0 });
        }
        if (e.fire) {
          try { if (typeof rig.fire === 'function') rig.fire(); else out.errors.push('Dieser Prüfstand hat keine Entladung (fire).'); } catch (er) { out.errors.push('fire(): ' + (er && er.message)); }
        }
      }
      for (let i = ramps.length - 1; i >= 0; i--) {
        const r = ramps[i], fr = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(r.key, r.log ? r.from * Math.pow(r.to / r.from, fr) : r.from + (r.to - r.from) * fr);
        if (fr >= 1) ramps.splice(i, 1);
      }
      if (t >= nextSample - 1e-9) { takeSample(); nextSample += sampleS; }
      if (t >= tEnd - 1e-9) break;
      let tn = Math.min(nextSample, tEnd);
      if (qi < q.length) tn = Math.min(tn, q[qi].t);
      if (ramps.length) { let rd = Infinity; ramps.forEach(function (r) { rd = Math.min(rd, r.dur / 50); }); tn = Math.min(tn, t + Math.max(rd, tEnd / 20000)); }
      let dt = tn - t;
      if (!(dt > 1e-12)) dt = Math.max(1e-6, tEnd / 20000);
      try { if (typeof rig.step === 'function') rig.step(dt * 1000); } catch (e) { out.errors.push('step(): ' + (e && e.message)); break; }
      t += dt;
    }
    try { out.final = snapObj(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.assess = typeof rig.assess === 'function' ? snapObj(rig.assess()) : null; } catch (e) { out.errors.push('assess(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snapObj) : []; } catch (e) { /* */ }
    if (opts.keepRig) out.rig = rig;
    return out;
  }
  api.runSeq = function () {
    try { return runSeq.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], assess: null, errors: ['Interner Fehler im Läufer.'], rejected: [] }; }
  };

  /* Hilfen fuer Tests und Erweiterungen (emvcore-lay.js hakt sich hier ein) */
  api.util = { num: num, pos: pos, nn: nn, clamp: clamp, fin: fin, isObj: isObj, obj: obj, fail: fail, cadd: cadd, cmul: cmul, cdiv: cdiv, cabs: cabs, csub: csub, rfOf: rfOf, uvOf: uvOf, lenMeter: lenMeter, fmtSmart: fmtSmart, polyRoots: polyRoots, cnOf: cnOf, trapCfg: trapCfg };
  hide(api, 'util', api.util);
  api.guardAll = true;
  root.EMV_CORE = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
