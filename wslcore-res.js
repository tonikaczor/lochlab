/* wslcore-res.js - WSL-Lab Kern Teil 2 (WSL_CORE: res, filter, trafo, three, report, assess, diagnose, formulas, exercise, runSeq)
 * Haengt sich per WSL_CORE.extend(...) an wslcore.js (Teil 1). Reine Rechnung, keine DOM-Zugriffe, Node-ladbar.
 * Alle Bauteil- und Anlagenwerte sind Uebungswerte, Bauteile ideal, Beharrungszustand. Simulation, keine Anleitung fuer Arbeiten an Netzspannung.
 *
 * ===================================================================================================
 * SIGNATUREN (SPEC 4.5 bis 4.12; hier die Festlegungen, die dort offen waren). Alle Funktionen werfen nie.
 *  Konvention wie Teil 1: phi in GRAD, phi = phi_u - phi_i, induktiv > 0. Spannungen/Stroeme Effektivwerte.
 *
 *  res.series({u?,f?,l,c,r})   Reihenkreis, r = Verlustwiderstand in Reihe (r = 0 -> valid:false "ideal", Q_G unendlich)
 *       -> { ok, valid, art:'reihe', f0, omega0, z0, qg, d, b, fu, fo, l, c, r, text,
 *            resonanz?:{ z, i, ul, uc, ur, p, ueberhoehung }   (nur mit u),
 *            [mit f:] f, ratio, xl, xc, x, z, phi, phiArt, i?, ul?, uc?, ur?, imBand, aufResonanz }   (i, ul, uc, ur nur mit u)
 *  res.parallel({u?,f?,l,c,r|rp|rl}) Parallelkreis; r/rp = Verlustwiderstand PARALLEL (Lehrmodell F5), rl = Spulenwiderstand in Reihe
 *       (dann rp = z0^2/rl als Naeherung, Feld rpAusRl:true). Ohne Verlustwiderstand -> valid:false (Sperrkreis ideal).
 *       -> { ok, valid, art:'parallel', f0, omega0, z0, qg, d, b, fu, fo, rp, text, resonanz?:{ z, i, il, ic, kreisstrom }, [mit f:] z, y, phi, i?, il?, ic?, ir? }
 *  res.curve({art:'reihe'|'parallel', ...}, fList|n)  -> { ok, art, f[], z[], phi[], i[], ul[], uc[] (parallel: il[], ic[]), u, f0, marker:{ f, z, art:'min'|'max' }, qg, b }
 *       fList fehlt oder Zahl n: logarithmisches Raster 0,1 f0 ... 10 f0. u fehlt: Bezug 1 V (Feld uBezug:true).
 *  res.bandwidth(cfg) -> { ok, f0, qg, b, d, fu, fo, check (= fo - fu - b), art }      res.tune({l,c,f0} zwei von drei) -> { ok, l, c, f0, z0 }
 *  res.ring(cfg, tList|n) -> { ok, valid, art, delta, tau, schwingt, fd?, t[], env[] }   Huellkurve e^(-delta t), t bis tau_5 * tau
 *
 *  filter.rc(cfg) / .rl(cfg)  cfg { typ:'tief'|'hoch', r, c|l, ue?, f? (Standard f = f_g) }
 *       -> { ok, valid, art, typ, fg, tau, f, x (= f/fg), h, a (dB), phi, hc:{re,im}, imFg, ua? (mit ue), xc?, z?, text }
 *  filter.response(cfg, f) -> wie rc/rl bei f (f <= 0 -> ok:false)   (cfg.art 'RC'|'RL')
 *  filter.bode(cfg, fList|n) -> { ok, valid, fg, f[], a[], phi[], h[], asymp[], steigung (dB/Dekade), knick:{ f, aAsymp, aKurve, diff }, dekade:{ f, a, aAsymp, abweichung }, text }
 *  filter.step(cfg, t|[t]) -> { ok, tau, t, y (0..1), ua?, t5 }            filter.square(cfg, T, tList|n) -> { ok, T, tau, t[], uin[], y[], randfall, nadel, hub, text }
 *  filter.sieve({r,c,f,u1|ue|u}) -> { ok, xc, z, u2, h, a, i }               filter.lc({l,c}) -> { ok, fg, z0 }
 *  filter.design({fg, r|c|l, art?}) -> fehlendes Bauteil: { ok, c|l|r }
 *
 *  trafo.ideal({u1?, n1, n2, i2|rlast}) -> { ok, ueb, u1?, u2?, i2?, i1?, p?, rlastPrim? }
 *  trafo.real({u1, n1, n2, sn, r1, r2, rlast|i2?, u1n?, pfe?, uk?}) Lehrmodell (F8): pfe/uk Standard aus limits; sn, r1, r2 muessen gegeben werden
 *       -> { ok, valid, ueb, u20, u2, du, duProzent, i2, i1, p1, p2, pcu, pfe, eta (0..1), etaProzent, rk, xk, text }
 *  trafo.load({...wie real, n?}) -> { ok, i2[], u2[], eta[], p2[], pcu[], pfe, opt:{ i2, eta, pcu, pfe, p2 } }
 *  trafo.dc({u, rw}) -> { ok, valid:false, why, i, ueb:NaN, ... }       trafo.frequenz({f, fn}) -> qualitativer Text
 *
 *  three.star / .delta({ul, zstr|rstr|il|istr, cosphi? (Standard 1)}) -> { ok, schaltung, ul, ustr, istr, il, zstr?, cosphi, p, q, s }
 *  three.power({ul, il, cosphi?} oder {ul, zstr|rstr, cosphi?, schaltung?}) -> { ok, p, q, s, ... } bzw. { stern, dreieck, faktor }
 *  three.phases({ul|ustr, f?}, t|[t]) -> { ok, t[], u1[], u2[], u3[], sum[], u12[], ustr, ul, at? }
 *  WSL_CORE.grid(center, n?, decUnten?, decOben?) -> [f...] logarithmisches Frequenzraster
 *
 *  report: siehe Abschnitt Messreihe unten.  assess(rigId, state): state = Steuerwerte der Anlage (Schluessel wie controls) + ziel:{...}.
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  let W = root.WSL_CORE;
  if (!W && typeof require === 'function') { try { W = require('./wslcore.js'); } catch (e) { W = null; } }
  if (!W || !W.util || typeof W.extend !== 'function') {
    if (typeof console !== 'undefined') console.warn('wslcore-res.js: WSL_CORE (wslcore.js) fehlt, Teil 2 wird nicht registriert.');
    return;
  }
  const U = W.util;
  const num = U.num, clamp = U.clamp, fin = U.fin, isArr = U.isArr, isObj = U.isObj, obj = U.obj, fail = U.fail, invalid = U.invalid, V = U.V;
  const reqObj = U.reqObj, reqPos = U.reqPos, reqNn = U.reqNn, reqFin = U.reqFin, optPos = U.optPos, optNn = U.optNn, optFin = U.optFin;
  const C = U.C, S = U.S, A = U.A, L = U.L, LV = U.LV, hide = U.hide;
  const fmt = W.fmt, fmtEng = W.fmtEng, TEXTS = W.TEXTS, cx = W.cx, rlc = W.rlc, power = W.power, comp = W.comp, sine = W.sine;
  const TWO_PI = U.TWO_PI, RAD = U.RAD, DEG = U.DEG, SQ2 = U.SQ2, SQ3 = Math.sqrt(3);
  const COS_ZIEL = LV('cos_ziel');
  const RES_FENSTER = LV('res_fenster'), FG_FENSTER = LV('fg_fenster'), AMP_GRUEN = LV('amp_gruen'), AMP_GELB = LV('amp_gelb'), COS_FENSTER = LV('cos_fenster');
  const TAU5 = LV('tau_5'), TRAFO_PFE = LV('trafo_pfe'), TRAFO_UK = LV('trafo_uk');
  function snap(o) { try { return o === undefined ? null : JSON.parse(JSON.stringify(o)); } catch (e) { return null; } }
  function lg(x) { return Math.log(x) / Math.LN10; }
  function lcase(v, d) { return v === undefined || v === null ? d : String(v).trim().toLowerCase(); }

  /* ---------- Texte (einzige Quelle, TEXTS.get(id, vars)) ---------- */
  Object.assign(TEXTS, {
    filterNurErsteOrdnung: 'Das Bode-Diagramm gilt hier nur für unbelastete Glieder erster Ordnung (Übungsmodell, Vorgabe vom Ausbilder abzugleichen).',
    rlIdeal: 'Das RL-Glied rechnet mit einer idealen Spule ohne Wicklungswiderstand (Übungsmodell).',
    trafoModell: 'Trafo-Lehrmodell: Wicklungswiderstände, konstanter Eisenverlust und Kurzschlussspannung als Übungswerte; kein Anlauf-, Sättigungs- oder Kurzschlussmodell.',
    dcHinweis: 'Gleichspannung am Transformator ist nur Simulation und wird hier als Fehlerbild erklärt.',
    dreiOhne: 'Gerechnet wird nur eine symmetrische Last; unsymmetrische Last, Sternpunktstrom und Anlauf sind hier nur Begriffe.',
    messreiheHinweis: 'Übungsprotokoll, kein Nachweis. Die Messwerte stammen aus der Simulation.',
    grau: 'Keine Vorgabe gesetzt: Die Ampel bleibt grau.'
  });

  /* ---------- Raster und Listen ---------- */
  function logGrid(center, n, decLo, decHi) {
    const N = Math.floor(n);
    const out = new Array(N);
    for (let i = 0; i < N; i++) out[i] = center * Math.pow(10, -decLo + (decLo + decHi) * (N === 1 ? 0.5 : i / (N - 1)));
    return out;
  }
  /* Raster: Liste, bei Unsinn leere Liste */
  W.extend('grid', A(function (center, n, decLo, decHi) {
    const c = reqPos(center, 'Die Mittenfrequenz', 1e12);
    const N = n === undefined || n === null ? 81 : Math.floor(reqPos(n, 'Die Anzahl der Punkte', 5000));
    if (N < 2) return [];
    return logGrid(c, N, optNn(decLo, 1, 'Die Dekaden unten', 12), optNn(decHi, 1, 'Die Dekaden oben', 12));
  }));
  /* Liste positiver endlicher Zahlen oder Rasteranzahl */
  function posList(v, center, def, decLo, decHi, name, allowZero) {
    if (v === undefined || v === null) return logGrid(center, def, decLo, decHi);
    if (typeof v === 'number') {
      const n = Math.floor(v);
      if (!(n >= 2)) V('Die Anzahl der Punkte muss mindestens 2 sein.');
      if (n > 5000) V('Die Anzahl der Punkte ist zu groß (höchstens 5000).');
      return logGrid(center, n, decLo, decHi);
    }
    if (!isArr(v) || v.length < 1) V(name + ' fehlt: Es wird eine Liste von Zahlen gebraucht.');
    if (v.length > 20000) V(name + ' ist zu lang (höchstens 20000 Werte).');
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      const x = num(v[i], NaN);
      if (!(allowZero ? x >= 0 : x > 0) || x > 1e12) V(name + ' enthält einen ungültigen Wert (Eintrag ' + (i + 1) + '): erlaubt sind nur Zahlen größer ' + (allowZero ? 'gleich ' : '') + '0.');
      out[i] = x;
    }
    return out;
  }

  /* =============================== 4.5 Schwingkreise (res) =============================== */
  function resArt(cfg) {
    const a = lcase(cfg.art, 'reihe');
    if (a !== 'reihe' && a !== 'parallel') V('Unbekannte Schaltung „' + a + '“. Es gibt Reihe und Parallel.');
    return a;
  }
  /* Eingaben pruefen; liefert { art, l, c, r (Verlustwiderstand oder NaN = ideal), z0, w0, f0, u, f, rpAusRl } */
  function resParams(cfg, artForce) {
    reqObj(cfg);
    const art = artForce || resArt(cfg);
    const l = reqPos(cfg.l, 'Die Induktivität', 1e9), c = reqPos(cfg.c, 'Die Kapazität', 1e9);
    const w0 = 1 / Math.sqrt(l * c), z0 = Math.sqrt(l / c);
    const p = { art: art, l: l, c: c, w0: w0, f0: w0 / TWO_PI, z0: z0, r: NaN, rpAusRl: false };
    if (art === 'reihe') {
      p.r = optNn(cfg.r, NaN, 'Der Verlustwiderstand', 1e12);
      if (!isFinite(p.r)) p.r = 0;     /* fehlt der Widerstand, ist der Kreis ideal */
    } else {
      const rp = cfg.rp !== undefined && cfg.rp !== null ? cfg.rp : cfg.r;
      if (rp !== undefined && rp !== null) p.r = reqPos(rp, 'Der Parallel-Verlustwiderstand', 1e15);
      else if (cfg.rl !== undefined && cfg.rl !== null) { const rl = reqPos(cfg.rl, 'Der Spulenwiderstand', 1e12); p.r = z0 * z0 / rl; p.rpAusRl = true; }
    }
    p.u = optNn(cfg.u, NaN, 'Die Spannung', 1e9);
    p.fRaw = num(cfg.f, NaN);
    if (cfg.f !== undefined && cfg.f !== null && !(p.fRaw >= 0)) V('Die Frequenz muss eine Zahl größer als 0 sein.');
    if (p.fRaw > 1e12) V('Die Frequenz ist unrealistisch groß.');
    p.f = p.fRaw;
    return p;
  }
  /* Guete, Grenzfrequenzen (exakt aus |Z| = sqrt2 R bzw. |Y| = sqrt2 G) */
  function resBand(p) {
    const qg = p.art === 'reihe' ? p.z0 / p.r : p.r / p.z0;
    const h = 1 / (2 * qg), sq = Math.sqrt(1 + h * h);
    return { qg: qg, d: 1 / qg, b: p.f0 / qg, fu: p.f0 * (sq - h), fo: p.f0 * (sq + h) };
  }
  /* Punktwerte bei f (f > 0), u optional (dann Bezug 1 V nur bei curve) */
  function resPoint(p, f, u) {
    const w = TWO_PI * f, o = { f: f, ratio: f / p.f0 };
    if (p.art === 'reihe') {
      const xl = w * p.l, xc = 1 / (w * p.c), x = xl - xc, z = Math.hypot(p.r, x);
      o.xl = xl; o.xc = xc; o.x = x; o.z = z; o.phi = Math.atan2(x, p.r) * DEG; o.zArt = Math.abs(x) <= 1e-9 * z ? 'ohmsch' : (x > 0 ? 'induktiv' : 'kapazitiv');
      if (isFinite(u)) { o.i = u / z; o.ur = o.i * p.r; o.ul = o.i * xl; o.uc = o.i * xc; }
    } else {
      const g = 1 / p.r, bl = 1 / (w * p.l), bc = w * p.c, b = bl - bc, y = Math.hypot(g, b);
      o.xl = w * p.l; o.xc = 1 / (w * p.c); o.g = g; o.bl = bl; o.bc = bc; o.y = y; o.z = 1 / y; o.phi = Math.atan2(b, g) * DEG;
      o.zArt = Math.abs(b) <= 1e-9 * y ? 'ohmsch' : (b > 0 ? 'induktiv' : 'kapazitiv');
      if (isFinite(u)) { o.i = u * y; o.ir = u * g; o.il = u * bl; o.ic = u * bc; }
    }
    return o;
  }
  function resText(p, bd) {
    return 'Resonanzfrequenz f₀ = ' + fmtEng(p.f0, 'Hz') + ', Kennwiderstand Z₀ = ' + fmtEng(p.z0, 'Ω') + ', Güte Q_G = ' + fmt(bd.qg, 3) + ', Bandbreite B = ' + fmtEng(bd.b, 'Hz') +
      ' (von f_u = ' + fmtEng(bd.fu, 'Hz') + ' bis f_o = ' + fmtEng(bd.fo, 'Hz') + ').';
  }
  function resBuild(p) {
    const idealKeys = ['qg', 'd', 'b', 'fu', 'fo', 'i', 'ul', 'uc', 'ur', 'il', 'ic'];
    const base = { art: p.art, l: p.l, c: p.c, f0: p.f0, omega0: p.w0, z0: p.z0 };
    if (p.art === 'reihe' && p.r === 0) return invalid(TEXTS.reiheIdeal, idealKeys, Object.assign(base, { r: 0, ideal: true }));
    if (p.art === 'parallel' && !(p.r > 0)) return invalid(TEXTS.parallelIdeal, idealKeys, Object.assign(base, { ideal: true }));
    const bd = resBand(p);
    const o = Object.assign({ ok: true, valid: true }, base, { r: p.r, qg: bd.qg, d: bd.d, b: bd.b, fu: bd.fu, fo: bd.fo, text: resText(p, bd) });
    if (p.art === 'parallel') { o.rp = p.r; if (p.rpAusRl) { o.rpAusRl = true; o.hinweis = 'R_p = Z₀² / R_L ist eine Näherung (Lehrmodell).'; } }
    if (isFinite(p.u)) {
      o.u = p.u;
      if (p.art === 'reihe') o.resonanz = { z: p.r, i: p.u / p.r, ur: p.u, ul: bd.qg * p.u, uc: bd.qg * p.u, p: p.u * p.u / p.r, ueberhoehung: bd.qg };
      else o.resonanz = { z: p.r, i: p.u / p.r, il: bd.qg * p.u / p.r, ic: bd.qg * p.u / p.r, kreisstrom: bd.qg * p.u / p.r, p: p.u * p.u / p.r };
      if (p.art === 'reihe' && bd.qg > 1) o.ueberhoehungText = 'Bei Resonanz liegen an Spule und Kondensator je ' + fmtEng(bd.qg * p.u, 'V') + ' bei ' + fmtEng(p.u, 'V') + ' Quellenspannung (Faktor Q_G = ' + fmt(bd.qg, 3) + '). ' + TEXTS.ueberhoehung;
    }
    if (p.f !== undefined && isFinite(p.f)) {
      if (p.f === 0) return Object.assign({}, o, invalid(TEXTS.gleichstrom, ['z', 'phi', 'i', 'ul', 'uc', 'ur', 'il', 'ic', 'xl', 'xc']), { f: 0 });
      const pt = resPoint(p, p.f, p.u);
      for (const k in pt) o[k] = pt[k];
      o.imBand = p.f >= bd.fu && p.f <= bd.fo;
      o.aufResonanz = Math.abs(p.f - p.f0) / p.f0 * 100 <= RES_FENSTER;
      o.abwF0 = (p.f - p.f0) / p.f0 * 100;
      o.text += ' Bei f = ' + fmtEng(p.f, 'Hz') + ': Z = ' + fmtEng(pt.z, 'Ω') + ', φ = ' + fmt(pt.phi, 1) + '°' + (isFinite(p.u) ? ', I = ' + fmtEng(pt.i, 'A') : '') + '.';
    }
    return o;
  }
  const res = {
    series: S(function (cfg) { return resBuild(resParams(cfg, 'reihe')); }),
    parallel: S(function (cfg) { return resBuild(resParams(cfg, 'parallel')); }),
    bandwidth: S(function (cfg) {
      const p = resParams(cfg);
      if (p.art === 'reihe' && p.r === 0) return invalid(TEXTS.reiheIdeal, ['qg', 'b', 'fu', 'fo', 'd'], { art: p.art, f0: p.f0, z0: p.z0, ideal: true });
      if (p.art === 'parallel' && !(p.r > 0)) return invalid(TEXTS.parallelIdeal, ['qg', 'b', 'fu', 'fo', 'd'], { art: p.art, f0: p.f0, z0: p.z0, ideal: true });
      const bd = resBand(p);
      return { ok: true, valid: true, art: p.art, f0: p.f0, z0: p.z0, qg: bd.qg, d: bd.d, b: bd.b, fu: bd.fu, fo: bd.fo, check: (bd.fo - bd.fu) - bd.b, text: resText(p, bd) };
    }),
    tune: S(function (cfg) {
      reqObj(cfg);
      const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
      const n = (has('l') ? 1 : 0) + (has('c') ? 1 : 0) + (has('f0') ? 1 : 0);
      if (n !== 2) V('Gib genau zwei der drei Größen L, C und f₀ an; die dritte wird berechnet.');
      let l, c, f0;
      if (has('l')) l = reqPos(cfg.l, 'Die Induktivität', 1e9);
      if (has('c')) c = reqPos(cfg.c, 'Die Kapazität', 1e9);
      if (has('f0')) f0 = reqPos(cfg.f0, 'Die Resonanzfrequenz', 1e12);
      const w2 = f0 === undefined ? NaN : Math.pow(TWO_PI * f0, 2);
      if (c === undefined) c = 1 / (w2 * l); else if (l === undefined) l = 1 / (w2 * c); else f0 = 1 / (TWO_PI * Math.sqrt(l * c));
      return { ok: true, valid: true, l: l, c: c, f0: f0, z0: Math.sqrt(l / c) };
    }),
    curve: S(function (cfg, fList) {
      const p = resParams(cfg);
      if (p.art === 'reihe' && p.r === 0) V(TEXTS.reiheIdeal);
      if (p.art === 'parallel' && !(p.r > 0)) V(TEXTS.parallelIdeal);
      const bd = resBand(p);
      const uGiven = isFinite(p.u), u = uGiven && p.u > 0 ? p.u : 1;
      const f = posList(fList, p.f0, 101, 1, 1, 'Die Frequenzliste', false);
      const N = f.length, z = new Array(N), phi = new Array(N), i = new Array(N), ul = new Array(N), uc = new Array(N), il = new Array(N), ic = new Array(N);
      let kBest = 0;
      for (let k = 0; k < N; k++) {
        const pt = resPoint(p, f[k], u);
        z[k] = pt.z; phi[k] = pt.phi; i[k] = pt.i;
        if (p.art === 'reihe') { ul[k] = pt.ul; uc[k] = pt.uc; } else { il[k] = pt.il; ic[k] = pt.ic; }
        if (p.art === 'reihe' ? z[k] < z[kBest] : z[k] > z[kBest]) kBest = k;
      }
      const o = { ok: true, valid: true, art: p.art, f: f, z: z, phi: phi, i: i, u: u, uBezug: !uGiven, f0: p.f0, qg: bd.qg, b: bd.b, fu: bd.fu, fo: bd.fo, marker: { f: f[kBest], z: z[kBest], art: p.art === 'reihe' ? 'min' : 'max' } };
      if (p.art === 'reihe') { o.ul = ul; o.uc = uc; } else { o.il = il; o.ic = ic; }
      return o;
    }),
    ring: S(function (cfg, tList) {
      const p = resParams(cfg);
      if (p.art === 'reihe' && p.r === 0) return invalid(TEXTS.reiheIdeal, ['delta', 'tau'], { art: p.art, ideal: true });
      if (p.art === 'parallel' && !(p.r > 0)) return invalid(TEXTS.parallelIdeal, ['delta', 'tau'], { art: p.art, ideal: true });
      const delta = p.art === 'reihe' ? p.r / (2 * p.l) : 1 / (2 * p.r * p.c), tau = 1 / delta;
      const t = posList(tList, 1, 201, 0, 0, 'Die Zeitliste', true);
      let tt = t;
      if (tList === undefined || tList === null || typeof tList === 'number') {
        const n = t.length, T = TAU5 * tau;
        tt = new Array(n); for (let i = 0; i < n; i++) tt[i] = T * i / (n - 1);
      }
      const env = tt.map(function (x) { return Math.exp(-delta * x); });
      const o = { ok: true, valid: true, art: p.art, delta: delta, tau: tau, w0: p.w0, schwingt: delta < p.w0, t: tt, env: env, t5: TAU5 * tau };
      if (o.schwingt) o.fd = Math.sqrt(p.w0 * p.w0 - delta * delta) / TWO_PI;
      else o.hinweis = 'Die Dämpfung ist so groß, dass der Kreis nicht mehr schwingt (aperiodisch).';
      return o;
    })
  };
  W.extend('res', res);

  /* =============================== 4.6 Filter =============================== */
  function fParams(cfg, artForce) {
    reqObj(cfg);
    const art = artForce || String(cfg.art === undefined || cfg.art === null ? 'RC' : cfg.art).toUpperCase();
    if (art !== 'RC' && art !== 'RL') V('Unbekannter Aufbau „' + art + '“. Es gibt RC und RL.');
    let typ = lcase(cfg.typ, 'tief');
    if (typ === 'tiefpass') typ = 'tief'; if (typ === 'hochpass') typ = 'hoch';
    if (typ !== 'tief' && typ !== 'hoch') V('Unbekannter Typ „' + typ + '“. Es gibt Tiefpass (tief) und Hochpass (hoch).');
    const r = reqPos(cfg.r, 'Der Widerstand', 1e12);
    const p = { art: art, typ: typ, r: r };
    if (art === 'RC') { p.c = reqPos(cfg.c, 'Die Kapazität', 1e9); p.tau = r * p.c; p.fg = 1 / (TWO_PI * p.tau); }
    else { p.l = reqPos(cfg.l, 'Die Induktivität', 1e9); p.tau = p.l / r; p.fg = r / (TWO_PI * p.l); }
    const ue = cfg.ue !== undefined && cfg.ue !== null ? cfg.ue : cfg.u;
    p.ue = optNn(ue, NaN, 'Die Eingangsspannung', 1e9);
    return p;
  }
  /* Uebertragung bei f (x = f / f_g): Tiefpass 1/(1 + jx), Hochpass jx/(1 + jx); RL gleiche Form mit tau = L/R */
  function fAt(p, f) {
    const x = f / p.fg, one = { re: 1, im: 0 }, jx = { re: 0, im: x };
    const den = cx.add(one, jx);
    const hc = p.typ === 'tief' ? cx.div(one, den) : cx.div(jx, den);
    const h = cx.abs(hc), phi = cx.arg(hc) * DEG;
    return { f: f, x: x, hc: hc, h: h, a: 20 * lg(h), phi: phi };
  }
  function fResult(p, f) {
    const pt = fAt(p, f), w = TWO_PI * f;
    const o = { ok: true, valid: true, art: p.art, typ: p.typ, r: p.r, fg: p.fg, tau: p.tau, f: f, x: pt.x, h: pt.h, a: pt.a, phi: pt.phi, hc: pt.hc, imFg: Math.abs(f - p.fg) <= 1e-9 * p.fg };
    if (p.art === 'RC') { o.c = p.c; o.xc = 1 / (w * p.c); o.z = Math.hypot(p.r, o.xc); } else { o.l = p.l; o.xl = w * p.l; o.z = Math.hypot(p.r, o.xl); }
    if (isFinite(p.ue)) { o.ue = p.ue; o.ua = p.ue * pt.h; }
    o.text = (p.typ === 'tief' ? 'Tiefpass' : 'Hochpass') + ' (' + p.art + '): f_g = ' + fmtEng(p.fg, 'Hz') + ', τ = ' + fmtEng(p.tau, 's') + '. Bei f = ' + fmtEng(f, 'Hz') + ': |H| = ' + fmt(pt.h, 4) + ' (' + fmt(pt.a, 2) + ' dB), Phase ' + fmt(pt.phi, 1) + '°.';
    if (p.art === 'RL') o.hinweis = TEXTS.rlIdeal;
    return o;
  }
  function fPoint(cfg, artForce, fOverride) {
    const p = fParams(cfg, artForce);
    let f = fOverride !== undefined ? fOverride : cfg.f;
    if (f === undefined || f === null) f = p.fg;
    else f = reqPos(f, 'Die Frequenz', 1e12);
    return fResult(p, f);
  }
  const filter = {
    rc: S(function (cfg) { reqObj(cfg); return fPoint(cfg, 'RC'); }),
    rl: S(function (cfg) { reqObj(cfg); return fPoint(cfg, 'RL'); }),
    response: S(function (cfg, f) {
      reqObj(cfg);
      const ff = f === undefined || f === null ? cfg.f : f;
      if (ff === undefined || ff === null) V('Es fehlt die Frequenz.');
      return fPoint(cfg, undefined, reqPos(ff, 'Die Frequenz', 1e12));
    }),
    bode: S(function (cfg, fList) {
      const p = fParams(cfg);
      const f = posList(fList, p.fg, 81, 2, 2, 'Die Frequenzliste', false);
      const N = f.length, a = new Array(N), phi = new Array(N), h = new Array(N), asymp = new Array(N);
      for (let k = 0; k < N; k++) {
        const pt = fAt(p, f[k]);
        a[k] = pt.a; phi[k] = pt.phi; h[k] = pt.h;
        const r = f[k] / p.fg;
        asymp[k] = p.typ === 'tief' ? (r <= 1 ? 0 : -20 * lg(r)) : (r >= 1 ? 0 : 20 * lg(r));
      }
      const atFg = fAt(p, p.fg);
      const fD = p.typ === 'tief' ? 10 * p.fg : p.fg / 10, pd = fAt(p, fD);
      return {
        ok: true, valid: true, art: p.art, typ: p.typ, fg: p.fg, tau: p.tau, f: f, a: a, phi: phi, h: h, asymp: asymp,
        steigung: p.typ === 'tief' ? -20 : 20, steigungText: (p.typ === 'tief' ? '−20' : '+20') + ' dB je Dekade',
        knick: { f: p.fg, aAsymp: 0, aKurve: atFg.a, diff: atFg.a, phi: atFg.phi },
        dekade: { f: fD, a: pd.a, aAsymp: -20, abweichung: pd.a + 20 },
        unbelastet: true,
        text: 'Knickfrequenz = Grenzfrequenz f_g = ' + fmtEng(p.fg, 'Hz') + '; dort liegt die Kurve ' + fmt(Math.abs(atFg.a), 2) + ' dB unter dem Knick der Asymptoten. Eine Dekade ' + (p.typ === 'tief' ? 'über' : 'unter') + ' f_g beträgt das Dämpfungsmaß ' + fmt(pd.a, 2) + ' dB (nicht genau −20 dB). ' + TEXTS.filterNurErsteOrdnung
      };
    }),
    step: S(function (cfg, t) {
      const p = fParams(cfg);
      const list = isArr(t);
      const ts = list ? posList(t, 1, 2, 0, 0, 'Die Zeitliste', true) : [reqNn(t, 'Die Zeit', 1e9)];
      const y = ts.map(function (x) { const e = Math.exp(-x / p.tau); return p.typ === 'tief' ? 1 - e : e; });
      const o = { ok: true, valid: true, art: p.art, typ: p.typ, tau: p.tau, fg: p.fg, t5: TAU5 * p.tau, form: p.typ === 'tief' ? 'Ladekurve 1 − e^(−t/τ)' : 'Entladekurve e^(−t/τ)' };
      if (list) { o.t = ts; o.y = y; if (isFinite(p.ue)) o.ua = y.map(function (v) { return v * p.ue; }); }
      else { o.t = ts[0]; o.y = y[0]; o.x = ts[0] / p.tau; if (isFinite(p.ue)) o.ua = y[0] * p.ue; }
      return o;
    }),
    square: S(function (cfg, T, tList) {
      const p = fParams(cfg);
      const per = reqPos(T, 'Die Periodendauer', 1e9);
      const ue = isFinite(p.ue) && p.ue > 0 ? p.ue : 1;
      const half = per / 2, k = Math.exp(-half / p.tau);
      const ya = ue * k / (1 + k), yb = ue / (1 + k);     /* Beharrungszustand des Tiefpasses: Anfang und Ende der High-Phase */
      let t;
      if (tList === undefined || tList === null || typeof tList === 'number') {
        const n = tList === undefined || tList === null ? 401 : Math.floor(tList);
        if (!(n >= 2) || n > 20000) V('Die Anzahl der Punkte muss zwischen 2 und 20000 liegen.');
        t = new Array(n); for (let i = 0; i < n; i++) t[i] = 2 * per * i / (n - 1);
      } else t = posList(tList, 1, 2, 0, 0, 'Die Zeitliste', true);
      const uin = new Array(t.length), y = new Array(t.length);
      for (let i = 0; i < t.length; i++) {
        let s = t[i] % per; if (s < 0) s += per;
        const hi = s < half;
        const lp = hi ? ue + (ya - ue) * Math.exp(-s / p.tau) : yb * Math.exp(-(s - half) / p.tau);
        uin[i] = hi ? ue : 0;
        y[i] = p.typ === 'tief' ? lp : uin[i] - lp;
      }
      const verh = half / p.tau;
      const nadel = p.typ === 'hoch' && verh >= TAU5;
      let randfall = 'normal', text;
      if (per / p.tau <= 0.1) {
        randfall = 'T-viel-kleiner-tau';
        text = p.typ === 'tief' ? 'T ist viel kleiner als τ: Der Tiefpass glättet fast alles weg, am Ausgang bleibt nahezu der Gleichanteil ' + fmt(ue / 2, 3) + ' V (Welligkeit nur ' + fmt(ue * (1 - k) / (1 + k), 4) + ' V).'
          : 'T ist viel kleiner als τ: Der Hochpass lässt das Rechtecksignal fast unverändert durch und sperrt nur den Gleichanteil.';
      } else if (per / p.tau >= 2 * TAU5) {
        randfall = 'T-viel-groesser-tau';
        text = p.typ === 'tief' ? 'T ist viel größer als τ: Der Tiefpass gibt das Rechteck mit verschliffenen Flanken wieder; die Flanke braucht etwa ' + fmtEng(TAU5 * p.tau, 's') + ' (' + fmt(TAU5, 0) + ' · τ, Lehrfaustwert).'
          : 'T ist viel größer als τ: Der Hochpass zeigt nur Nadelimpulse an den Flanken, dazwischen fällt die Spannung auf null ab.';
      } else text = (p.typ === 'tief' ? 'Der Tiefpass verschleift die Flanken.' : 'Der Hochpass formt die Flanken zu Nadelimpulsen um.') + ' Verhältnis halbe Periode zu τ: ' + fmt(verh, 3) + '.';
      return { ok: true, valid: true, art: p.art, typ: p.typ, T: per, tau: p.tau, verhaeltnis: per / p.tau, t: t, uin: uin, y: y, ue: ue, ueBezug: !(isFinite(p.ue) && p.ue > 0), randfall: randfall, nadel: nadel, hub: ue * (1 - k) / (1 + k), yAnfang: ya, yEnde: yb, text: text };
    }),
    sieve: S(function (cfg) {
      reqObj(cfg);
      const r = reqPos(cfg.r, 'Der Widerstand', 1e12), c = reqPos(cfg.c, 'Die Kapazität', 1e9);
      const u1 = reqPos(cfg.u1 !== undefined && cfg.u1 !== null ? cfg.u1 : (cfg.ue !== undefined && cfg.ue !== null ? cfg.ue : cfg.u), 'Die Eingangsspannung', 1e9);
      if (num(cfg.f, NaN) === 0) return invalid(TEXTS.gleichstrom, ['xc', 'z', 'u2', 'h', 'a', 'i']);
      const f = reqPos(cfg.f, 'Die Frequenz', 1e12);
      const xc = 1 / (TWO_PI * f * c), z = Math.hypot(r, xc), h = xc / z;
      return { ok: true, valid: true, f: f, r: r, c: c, u1: u1, xc: xc, z: z, u2: u1 * h, h: h, a: 20 * lg(h), i: u1 / z, text: 'Siebglied: X_C = ' + fmtEng(xc, 'Ω') + ', Z = ' + fmtEng(z, 'Ω') + ', U₂ = ' + fmtEng(u1 * h, 'V') + ' bei U₁ = ' + fmtEng(u1, 'V') + ' und f = ' + fmtEng(f, 'Hz') + '.' };
    }),
    lc: S(function (cfg) {
      reqObj(cfg);
      const l = reqPos(cfg.l, 'Die Induktivität', 1e9), c = reqPos(cfg.c, 'Die Kapazität', 1e9);
      return { ok: true, valid: true, fg: 1 / (TWO_PI * Math.sqrt(l * c)), z0: Math.sqrt(l / c), hinweis: 'LC-Tiefpass: nur Rechnung, ohne Dämpfung (Querverweis zum Schwingkreis).' };
    }),
    design: S(function (cfg) {
      reqObj(cfg);
      const fg = reqPos(cfg.fg, 'Die Grenzfrequenz', 1e12);
      const art = String(cfg.art === undefined || cfg.art === null ? (cfg.l !== undefined && cfg.l !== null ? 'RL' : 'RC') : cfg.art).toUpperCase();
      if (art === 'RC') {
        const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
        if (has('r') === has('c')) V('Gib genau eines von R und C an; das andere wird berechnet.');
        if (has('r')) { const r = reqPos(cfg.r, 'Der Widerstand', 1e12); return { ok: true, valid: true, art: 'RC', fg: fg, r: r, c: 1 / (TWO_PI * fg * r) }; }
        const c = reqPos(cfg.c, 'Die Kapazität', 1e9); return { ok: true, valid: true, art: 'RC', fg: fg, c: c, r: 1 / (TWO_PI * fg * c) };
      }
      if (art === 'RL') {
        const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
        if (has('r') === has('l')) V('Gib genau eines von R und L an; das andere wird berechnet.');
        if (has('r')) { const r = reqPos(cfg.r, 'Der Widerstand', 1e12); return { ok: true, valid: true, art: 'RL', fg: fg, r: r, l: r / (TWO_PI * fg) }; }
        const l = reqPos(cfg.l, 'Die Induktivität', 1e9); return { ok: true, valid: true, art: 'RL', fg: fg, l: l, r: TWO_PI * fg * l };
      }
      V('Unbekannter Aufbau „' + art + '“. Es gibt RC und RL.');
    })
  };
  W.extend('filter', filter);

  /* =============================== 4.7 Transformator =============================== */
  const trafo = {};
  trafo.ideal = S(function (cfg) {
    reqObj(cfg);
    const n1 = reqPos(cfg.n1, 'Die Windungszahl der Primärseite', 1e9), n2 = reqPos(cfg.n2, 'Die Windungszahl der Sekundärseite', 1e9);
    const ueb = n1 / n2, o = { ok: true, valid: true, ueb: ueb };
    const hasU1 = cfg.u1 !== undefined && cfg.u1 !== null, hasI2 = cfg.i2 !== undefined && cfg.i2 !== null, hasR = cfg.rlast !== undefined && cfg.rlast !== null;
    if (hasI2 && hasR) V('Gib entweder den Sekundärstrom I₂ oder den Lastwiderstand an, nicht beides.');
    let u2 = NaN, i2 = NaN;
    if (hasU1) { o.u1 = reqNn(cfg.u1, 'Die Primärspannung', 1e9); u2 = o.u1 / ueb; o.u2 = u2; }
    if (hasI2) i2 = reqNn(cfg.i2, 'Der Sekundärstrom', 1e9);
    else if (hasR) {
      if (!hasU1) V('Für den Lastwiderstand wird die Primärspannung U₁ gebraucht.');
      const rl = reqPos(cfg.rlast, 'Der Lastwiderstand', 1e12);
      o.rlast = rl; o.rlastPrim = ueb * ueb * rl; i2 = u2 / rl;
    }
    if (isFinite(i2)) { o.i2 = i2; o.i1 = i2 / ueb; if (hasU1) { o.p = u2 * i2; } }
    if (!isFinite(i2) && !hasU1) V('Es fehlt die Primärspannung U₁ oder der Sekundärstrom I₂.');
    o.text = 'Idealer Transformator: ü = N₁ / N₂ = ' + fmt(ueb, 3) + (isFinite(u2) ? ', U₂ = ' + fmtEng(u2, 'V') : '') + (isFinite(i2) ? ', I₂ = ' + fmtEng(i2, 'A') + ', I₁ = ' + fmtEng(i2 / ueb, 'A') : '') + '. ' + L('trafo_ueb').text + '.';
    return o;
  });
  function realParams(cfg) {
    reqObj(cfg);
    const p = {};
    p.u1 = reqPos(cfg.u1, 'Die Primärspannung', 1e9);
    p.n1 = reqPos(cfg.n1, 'Die Windungszahl der Primärseite', 1e9); p.n2 = reqPos(cfg.n2, 'Die Windungszahl der Sekundärseite', 1e9);
    p.ueb = p.n1 / p.n2;
    p.sn = reqPos(cfg.sn, 'Die Nennscheinleistung', 1e9);
    p.r1 = reqNn(cfg.r1, 'Der Wicklungswiderstand der Primärseite', 1e9); p.r2 = reqNn(cfg.r2, 'Der Wicklungswiderstand der Sekundärseite', 1e9);
    p.u1n = optPos(cfg.u1n, p.u1, 'Die Nennspannung der Primärseite', 1e9);
    p.pfe = optNn(cfg.pfe, TRAFO_PFE, 'Der Eisenverlust', 1e9);
    p.uk = optPos(cfg.uk, TRAFO_UK, 'Die Kurzschlussspannung', 100);
    p.rk = p.r1 + p.ueb * p.ueb * p.r2;
    const zk = p.uk / 100 * p.u1n * p.u1n / p.sn;
    if (!(p.rk < zk)) V('Die Wicklungswiderstände (R₁ + ü² · R₂ = ' + fmtEng(p.rk, 'Ω') + ') sind nicht kleiner als die Kurzschlussimpedanz aus u_k (' + fmtEng(zk, 'Ω') + '): Die Werte passen nicht zusammen.');
    p.zk = zk; p.xk = Math.sqrt(zk * zk - p.rk * p.rk);
    p.pfeAkt = p.pfe * Math.pow(p.u1 / p.u1n, 2);
    p.rfe = p.pfe > 0 ? p.u1n * p.u1n / p.pfe : Infinity;
    return p;
  }
  /* Betriebspunkt aus Last Z' (auf die Primaerseite bezogen, reell) ; zl = Infinity: Leerlauf */
  function realAt(p, zl) {
    const u20 = p.u1 / p.ueb;
    let ip = 0, u2 = u20, p2 = 0, pcu = 0, phi = 0;
    if (isFinite(zl)) {
      const rt = p.rk + zl, zt = Math.hypot(rt, p.xk);
      ip = p.u1 / zt; u2 = ip * zl / p.ueb; p2 = ip * ip * zl; pcu = ip * ip * p.rk; phi = -Math.atan2(p.xk, rt);
    }
    const ire = ip * Math.cos(phi) + (isFinite(p.rfe) ? p.u1 / p.rfe : 0), iim = ip * Math.sin(phi);
    const i1 = Math.hypot(ire, iim), p1 = p2 + pcu + p.pfeAkt;
    return { ueb: p.ueb, u20: u20, u2: u2, du: u20 - u2, duProzent: (u20 - u2) / u20 * 100, i2: ip * p.ueb, i1: i1, ip: ip, p1: p1, p2: p2, pcu: pcu, pfe: p.pfeAkt, eta: p1 > 0 ? p2 / p1 : 0, rk: p.rk, xk: p.xk, zlPrim: zl };
  }
  function zFromIp(p, ip) {
    const a = p.u1 / ip;
    if (!(a > p.xk)) return NaN;
    return -p.rk + Math.sqrt(a * a - p.xk * p.xk);
  }
  trafo.real = S(function (cfg) {
    const p = realParams(cfg);
    let zl = Infinity;
    const hasR = cfg.rlast !== undefined && cfg.rlast !== null, hasI2 = cfg.i2 !== undefined && cfg.i2 !== null;
    if (hasR && hasI2) V('Gib entweder den Sekundärstrom I₂ oder den Lastwiderstand an, nicht beides.');
    if (hasR) { const rl = num(cfg.rlast, NaN); if (!(rl > 0) || rl > 1e12) V('Der Lastwiderstand muss eine Zahl größer als 0 sein (ohne Angabe: Leerlauf).'); zl = p.ueb * p.ueb * rl; }
    else if (hasI2) {
      const i2 = reqNn(cfg.i2, 'Der Sekundärstrom', 1e9);
      if (i2 > 0) { zl = zFromIp(p, i2 / p.ueb); if (!(zl >= 0)) V('Dieser Sekundärstrom ist mit u_k und den Wicklungswiderständen nicht erreichbar.'); }
    }
    const r = realAt(p, zl);
    const o = Object.assign({ ok: true, valid: true, modell: 'Lehrmodell (Übungswerte)' }, r);
    o.etaProzent = r.eta * 100; o.rlast = isFinite(zl) ? zl / (p.ueb * p.ueb) : NaN;
    if (!isFinite(zl)) delete o.rlast;
    o.zlPrim = isFinite(zl) ? zl : undefined; if (o.zlPrim === undefined) delete o.zlPrim;
    o.text = 'Lehrmodell: U₂ = ' + fmtEng(r.u2, 'V') + ' unter Last (Leerlauf ' + fmtEng(r.u20, 'V') + ', Abfall ' + fmt(r.duProzent, 2) + ' %), η = ' + fmt(o.etaProzent, 1) + ' % bei P_Cu = ' + fmtEng(r.pcu, 'W') + ' und P_Fe = ' + fmtEng(r.pfe, 'W') + '. ' + TEXTS.trafoModell;
    return o;
  });
  trafo.load = S(function (cfg) {
    const p = realParams(cfg);
    const N = cfg.n === undefined || cfg.n === null ? 61 : Math.floor(reqPos(cfg.n, 'Die Anzahl der Punkte', 2000));
    if (N < 3) V('Es werden mindestens 3 Punkte gebraucht.');
    const ipN = p.sn / p.u1n, ipMax = 0.999 * p.u1 / p.zk;
    const top = Math.min(1.5 * ipN * p.u1 / p.u1n, ipMax);
    const i2 = [], u2 = [], eta = [], p2 = [], pcu = [];
    for (let k = 0; k < N; k++) {
      const ip = top * k / (N - 1);
      const zl = ip === 0 ? Infinity : zFromIp(p, ip);
      if (!(zl >= 0) && zl !== Infinity) continue;
      const r = realAt(p, zl);
      i2.push(r.i2); u2.push(r.u2); eta.push(r.eta); p2.push(r.p2); pcu.push(r.pcu);
    }
    const ipOpt = p.pfeAkt > 0 && p.rk > 0 ? Math.sqrt(p.pfeAkt / p.rk) : NaN;
    const o = { ok: true, valid: true, i2: i2, u2: u2, eta: eta, p2: p2, pcu: pcu, pfe: p.pfeAkt, rk: p.rk, xk: p.xk };
    if (isFinite(ipOpt) && ipOpt < ipMax) {
      const zo = zFromIp(p, ipOpt);
      if (zo >= 0) { const r = realAt(p, zo); o.opt = { i2: r.i2, eta: r.eta, pcu: r.pcu, pfe: r.pfe, p2: r.p2, u2: r.u2 }; }
    }
    o.text = 'Der Wirkungsgrad ist am größten, wenn die Kupferverluste gleich dem Eisenverlust sind (P_Cu = P_Fe)' + (o.opt ? ': bei I₂ = ' + fmtEng(o.opt.i2, 'A') + ' mit η = ' + fmt(o.opt.eta * 100, 1) + ' %.' : '.') + ' ' + TEXTS.trafoModell;
    return o;
  });
  trafo.dc = S(function (cfg) {
    reqObj(cfg);
    const u = reqNn(cfg.u !== undefined && cfg.u !== null ? cfg.u : cfg.u1, 'Die Gleichspannung', 1e9);
    const rw = reqPos(cfg.rw !== undefined && cfg.rw !== null ? cfg.rw : (cfg.r1 !== undefined && cfg.r1 !== null ? cfg.r1 : cfg.rwick), 'Der Wicklungswiderstand', 1e9);
    const i = u / rw;
    const o = {
      ok: true, valid: false, ueb: NaN, u: u, rw: rw, i: i,
      why: 'Gleichspannung: Die Übersetzung gilt nur für Wechselspannung. Es gibt keinen induktiven Widerstand, der Strom ist nur U / R = ' + fmtEng(u, 'V') + ' / ' + fmtEng(rw, 'Ω') + ' = ' + fmtEng(i, 'A') + '; die Wicklung ist gefährdet. ' + TEXTS.dcHinweis
    };
    if (cfg.inenn !== undefined && cfg.inenn !== null) { const inn = reqPos(cfg.inenn, 'Der Nennstrom', 1e9); o.faktor = i / inn; o.why += ' Das ist das ' + fmt(i / inn, 1) + '-fache des Nennstroms.'; }
    return o;
  });
  trafo.frequenz = S(function (cfg) {
    reqObj(cfg);
    const f = reqPos(cfg.f, 'Die Frequenz', 1e12), fn = optPos(cfg.fn, LV('f_netz'), 'Die Nennfrequenz', 1e12);
    const art = Math.abs(f - fn) <= 1e-9 * fn ? 'gleich' : (f < fn ? 'niedriger' : 'hoeher');
    const text = art === 'gleich' ? 'Nennfrequenz: Das Lehrmodell gilt.' :
      art === 'niedriger' ? 'Bei niedrigerer Frequenz als der Nennfrequenz kann der Kern in die Sättigung gehen (nur als Begriff, kein Rechenmodell).' :
        'Bei höherer Frequenz als der Nennfrequenz gibt es hier kein Rechenmodell (nur qualitativ).';
    return { ok: true, valid: art === 'gleich', art: art, f: f, fn: fn, text: text, why: art === 'gleich' ? undefined : text };
  });
  W.extend('trafo', trafo);

  /* =============================== 4.8 Drehstrom (three) =============================== */
  function threeParams(cfg, schaltung) {
    reqObj(cfg);
    const star = schaltung === 'stern';
    const ul = reqPos(cfg.ul, 'Die Außenleiterspannung', 1e9);
    const cs = cfg.cosphi === undefined || cfg.cosphi === null ? 1 : num(cfg.cosphi, NaN);
    if (!(cs >= 0 && cs <= 1)) V('Der Leistungsfaktor cos φ muss zwischen 0 und 1 liegen.');
    const ustr = star ? ul / SQ3 : ul;
    const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
    let istr, il, z = NaN;
    if (has('il')) { il = reqPos(cfg.il, 'Der Leiterstrom', 1e9); istr = star ? il : il / SQ3; z = ustr / istr; }
    else if (has('istr')) { istr = reqPos(cfg.istr, 'Der Strangstrom', 1e9); il = star ? istr : SQ3 * istr; z = ustr / istr; }
    else if (has('zstr') || has('rstr')) { z = reqPos(has('zstr') ? cfg.zstr : cfg.rstr, 'Der Strangwiderstand', 1e12); istr = ustr / z; il = star ? istr : SQ3 * istr; }
    else V('Es fehlt die Last: Gib den Leiterstrom, den Strangstrom oder den Strangwiderstand an.');
    return { star: star, schaltung: schaltung, ul: ul, ustr: ustr, istr: istr, il: il, z: z, cos: cs };
  }
  function threeRes(q) {
    const s = SQ3 * q.ul * q.il, sin = Math.sqrt(Math.max(0, 1 - q.cos * q.cos));
    const o = { ok: true, valid: true, schaltung: q.schaltung, ul: q.ul, ustr: q.ustr, istr: q.istr, il: q.il, cosphi: q.cos, p: s * q.cos, q: s * sin, s: s, hinweis: TEXTS.dreiOhne };
    if (isFinite(q.z)) o.zstr = q.z;
    o.text = (q.star ? 'Stern: U_Str = U_L / √3 = ' : 'Dreieck: U_Str = U_L = ') + fmtEng(q.ustr, 'V') + ', ' + (q.star ? 'I_L = I_Str = ' : 'I_L = √3 · I_Str = ') + fmtEng(q.il, 'A') + '; S = √3 · U_L · I_L = ' + fmtEng(s, 'VA') + ', P = ' + fmtEng(s * q.cos, 'W') + ', Q = ' + fmtEng(s * sin, 'var') + '.';
    if (q.cos === 0) o.reinBlind = true;
    return o;
  }
  const three = {
    star: S(function (cfg) { return threeRes(threeParams(cfg, 'stern')); }),
    delta: S(function (cfg) { return threeRes(threeParams(cfg, 'dreieck')); }),
    power: S(function (cfg) {
      reqObj(cfg);
      const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
      if (has('zstr') || has('rstr')) {
        const st = three.star(cfg), de = three.delta(cfg);
        if (!st.ok) return st; if (!de.ok) return de;
        const o = { ok: true, valid: true, stern: st, dreieck: de, faktor: de.p > 0 ? de.p / st.p : (de.s / st.s), text: 'Dieselbe Last in Dreieck statt in Stern aufgenommen: ' + fmt(de.s / st.s, 3) + '-fache Leistung (Rechenvergleich).' };
        const sch = lcase(cfg.schaltung, '');
        const pick = sch === 'stern' ? st : (sch === 'dreieck' ? de : null);
        if (pick) for (const k in pick) if (!(k in o)) o[k] = pick[k];
        return o;
      }
      const ul = reqPos(cfg.ul, 'Die Außenleiterspannung', 1e9), il = reqPos(cfg.il, 'Der Leiterstrom', 1e9);
      const cs = cfg.cosphi === undefined || cfg.cosphi === null ? 1 : num(cfg.cosphi, NaN);
      if (!(cs >= 0 && cs <= 1)) V('Der Leistungsfaktor cos φ muss zwischen 0 und 1 liegen.');
      return threeRes({ star: true, schaltung: 'beliebig', ul: ul, ustr: ul / SQ3, istr: il, il: il, z: NaN, cos: cs });
    }),
    phases: S(function (cfg, t) {
      reqObj(cfg);
      const has = function (k) { return cfg[k] !== undefined && cfg[k] !== null; };
      let ustr, ul;
      if (has('ustr')) { ustr = reqPos(cfg.ustr, 'Die Strangspannung', 1e9); ul = SQ3 * ustr; }
      else { ul = reqPos(cfg.ul, 'Die Außenleiterspannung', 1e9); ustr = ul / SQ3; }
      const f = optPos(cfg.f, LV('f_netz'), 'Die Frequenz', 1e12);
      const list = isArr(t), ts = list ? posList(t, 1, 2, 0, 0, 'Die Zeitliste', true) : [reqNn(t, 'Die Zeit', 1e9)];
      const w = TWO_PI * f, uh = ustr * SQ2, u1 = [], u2 = [], u3 = [], sum = [], u12 = [];
      ts.forEach(function (x) {
        const a = uh * Math.sin(w * x), b = uh * Math.sin(w * x - TWO_PI / 3), c = uh * Math.sin(w * x - 2 * TWO_PI / 3);
        u1.push(a); u2.push(b); u3.push(c); sum.push(a + b + c); u12.push(a - b);
      });
      const o = { ok: true, valid: true, f: f, ustr: ustr, ul: ul, uHat: uh, t: ts, u1: u1, u2: u2, u3: u3, sum: sum, u12: u12, hinweis: 'Summe der drei Strangspannungen ist immer null; bei symmetrischer Last fließt kein Strom im Sternpunkt (nur Begriff).' };
      if (!list) o.at = { u1: u1[0], u2: u2[0], u3: u3[0], sum: sum[0], u12: u12[0] };
      return o;
    })
  };
  W.extend('three', three);

  /* =============================== 4.10 Formeln (formulas) =============================== */
  function need(r) {
    if (!r || r.ok !== true) V(r && r.why ? r.why : TEXTS.eingabe);
    if (r.valid === false) V(r.why || TEXTS.eingabe);
    return r;
  }
  const FM = [];
  function F(id, name, symbol, expr, unit, args, core, explain) {
    FM.push({ id: id, name: name, symbol: symbol, expr: expr, unit: unit, args: args.map(function (a) { return { key: a[0], label: a[1], unit: a[2] }; }), core: core, explain: explain });
  }
  const gt0 = function (v, n) { return reqPos(v, n, 1e12); };
  F('omega', 'Kreisfrequenz', 'ω', 'ω = 2π · f', '1/s', [['f', 'Frequenz', 'Hz']], function (f) { return TWO_PI * gt0(f, 'Die Frequenz'); }, 'Die Kreisfrequenz ist 2π mal die Frequenz.');
  F('periode', 'Periodendauer', 'T', 'T = 1 / f', 's', [['f', 'Frequenz', 'Hz']], function (f) { return 1 / gt0(f, 'Die Frequenz'); }, 'Die Periodendauer ist der Kehrwert der Frequenz.');
  F('eff', 'Effektivwert (Sinus)', 'U', 'U = û / √2', 'V', [['ampl', 'Scheitelwert', 'V']], function (a) { return need(sine.values({ form: 'sinus', ampl: reqNn(a, 'Der Scheitelwert', 1e9), f: 1 })).rms; }, 'Bei einer Sinusgröße ist der Effektivwert der Scheitelwert geteilt durch √2.');
  F('gleichricht', 'Gleichrichtwert (Sinus)', '|u|', '|u| = 2 · û / π', 'V', [['ampl', 'Scheitelwert', 'V']], function (a) { return need(sine.values({ form: 'sinus', ampl: reqNn(a, 'Der Scheitelwert', 1e9), f: 1 })).rect; }, 'Mittelwert des Betrags einer Sinusgröße.');
  F('formfaktor', 'Formfaktor (Sinus)', 'F', 'F = U / |u| = π / (2√2)', '', [['ampl', 'Scheitelwert', 'V']], function (a) { return need(sine.values({ form: 'sinus', ampl: reqNn(a, 'Der Scheitelwert', 1e9), f: 1 })).formFactor; }, 'Verhältnis von Effektivwert zu Gleichrichtwert.');
  F('zeitversatz', 'Zeitversatz', 'Δt', 'Δt = φ / 360° · T', 's', [['f', 'Frequenz', 'Hz'], ['phi', 'Phasenwinkel', '°']], function (f, phi) { return need(sine.shift({ f: f, phi: phi })).dtS; }, 'Der Phasenwinkel in Grad, auf eine Periode von 360° bezogen, ergibt den Zeitversatz.');
  F('xl', 'Induktiver Blindwiderstand', 'X_L', 'X_L = 2π · f · L', 'Ω', [['f', 'Frequenz', 'Hz'], ['l', 'Induktivität', 'H']], function (f, l) { return need(rlc.reactance({ f: f, l: l })).xl; }, 'Der Blindwiderstand der Spule wächst mit der Frequenz.');
  F('xc', 'Kapazitiver Blindwiderstand', 'X_C', 'X_C = 1 / (2π · f · C)', 'Ω', [['f', 'Frequenz', 'Hz'], ['c', 'Kapazität', 'F']], function (f, c) { return need(rlc.reactance({ f: f, c: c })).xc; }, 'Der Blindwiderstand des Kondensators sinkt mit der Frequenz.');
  F('zReihe', 'Scheinwiderstand Reihenschaltung', 'Z', 'Z = √(R² + (X_L − X_C)²)', 'Ω', [['r', 'Wirkwiderstand', 'Ω'], ['xl', 'Blindwiderstand X_L', 'Ω'], ['xc', 'Blindwiderstand X_C', 'Ω']], function (r, xl, xc) { const z = Math.hypot(reqNn(r, 'Der Wirkwiderstand', 1e12), reqNn(xl, 'Der Blindwiderstand X_L', 1e12) - reqNn(xc, 'Der Blindwiderstand X_C', 1e12)); if (!(z > 0)) V('Der Scheinwiderstand wäre null.'); return z; }, 'Wirk- und Blindwiderstand werden geometrisch addiert (rechter Winkel).');
  F('phiReihe', 'Phasenwinkel Reihenschaltung', 'φ', 'φ = arctan((X_L − X_C) / R)', '°', [['r', 'Wirkwiderstand', 'Ω'], ['xl', 'Blindwiderstand X_L', 'Ω'], ['xc', 'Blindwiderstand X_C', 'Ω']], function (r, xl, xc) { const R = reqNn(r, 'Der Wirkwiderstand', 1e12), x = reqNn(xl, 'Der Blindwiderstand X_L', 1e12) - reqNn(xc, 'Der Blindwiderstand X_C', 1e12); if (R === 0 && x === 0) V('Wirk- und Blindwiderstand sind null.'); return Math.atan2(x, R) * DEG; }, 'Positiv induktiv (die Spannung eilt dem Strom vor), negativ kapazitiv.');
  F('iReihe', 'Strom Reihenschaltung', 'I', 'I = U / Z', 'A', [['u', 'Spannung', 'V'], ['r', 'Wirkwiderstand', 'Ω'], ['xl', 'Blindwiderstand X_L', 'Ω'], ['xc', 'Blindwiderstand X_C', 'Ω']], function (u, r, xl, xc) { const z = Math.hypot(reqNn(r, 'Der Wirkwiderstand', 1e12), reqNn(xl, 'Der Blindwiderstand X_L', 1e12) - reqNn(xc, 'Der Blindwiderstand X_C', 1e12)); if (!(z > 0)) V('Der Scheinwiderstand wäre null.'); return reqNn(u, 'Die Spannung', 1e9) / z; }, 'Strom aus Spannung und Scheinwiderstand.');
  F('uGeom', 'Gesamtspannung (geometrisch)', 'U', 'U = √(U_R² + (U_L − U_C)²)', 'V', [['ur', 'Spannung U_R', 'V'], ['ul', 'Spannung U_L', 'V'], ['uc', 'Spannung U_C', 'V']], function (ur, ul, uc) { return Math.hypot(reqNn(ur, 'Die Spannung U_R', 1e9), reqNn(ul, 'Die Spannung U_L', 1e9) - reqNn(uc, 'Die Spannung U_C', 1e9)); }, 'U_L und U_C sind gegenphasig, alle Teilspannungen werden geometrisch addiert.');
  F('yParallel', 'Scheinleitwert Parallelschaltung', 'Y', 'Y = √((1/R)² + (1/X_L − 1/X_C)²)', 'S', [['r', 'Wirkwiderstand', 'Ω'], ['xl', 'Blindwiderstand X_L', 'Ω'], ['xc', 'Blindwiderstand X_C', 'Ω']], function (r, xl, xc) { const y = Math.hypot(1 / gt0(r, 'Der Wirkwiderstand'), 1 / gt0(xl, 'Der Blindwiderstand X_L') - 1 / gt0(xc, 'Der Blindwiderstand X_C')); if (!(y > 0)) V('Der Scheinleitwert wäre null.'); return y; }, 'Bei Parallelschaltung addieren sich die Leitwerte geometrisch.');
  F('spule', 'Blindwiderstand der Spule aus U, I, P', 'X_L', 'X_L = √((U/I)² − (P/I²)²)', 'Ω', [['u', 'Spannung', 'V'], ['i', 'Strom', 'A'], ['p', 'Wirkleistung', 'W']], function (u, i, p) { return need(rlc.coil({ u: u, i: i, p: p })).xl; }, 'Aus Z = U / I und R = P / I² folgt X_L.');
  F('pUIphi', 'Wirkleistung', 'P', 'P = U · I · cos φ', 'W', [['u', 'Spannung', 'V'], ['i', 'Strom', 'A'], ['phi', 'Phasenwinkel', '°']], function (u, i, phi) { return need(power.fromUIphi(u, i, phi)).p; }, 'Wirkleistung aus Spannung, Strom und Phasenwinkel.');
  F('qUIphi', 'Blindleistung', 'Q', 'Q = U · I · sin φ', 'var', [['u', 'Spannung', 'V'], ['i', 'Strom', 'A'], ['phi', 'Phasenwinkel', '°']], function (u, i, phi) { return need(power.fromUIphi(u, i, phi)).q; }, 'Blindleistung aus Spannung, Strom und Phasenwinkel; induktiv positiv.');
  F('sUI', 'Scheinleistung', 'S', 'S = U · I', 'VA', [['u', 'Spannung', 'V'], ['i', 'Strom', 'A']], function (u, i) { return reqNn(u, 'Die Spannung', 1e9) * reqNn(i, 'Der Strom', 1e9); }, 'Scheinleistung als Produkt der Effektivwerte.');
  F('cosphi', 'Leistungsfaktor', 'cos φ', 'cos φ = P / S', '', [['p', 'Wirkleistung', 'W'], ['s', 'Scheinleistung', 'VA']], function (p, s) { const P = reqNn(p, 'Die Wirkleistung', 1e12), Sv = reqPos(s, 'Die Scheinleistung', 1e12); if (P > Sv * (1 + 1e-9)) V('Die Wirkleistung ist größer als die Scheinleistung.'); return Math.min(1, P / Sv); }, 'Verhältnis von Wirk- zu Scheinleistung.');
  F('qAusSP', 'Blindleistung aus S und P', 'Q', 'Q = √(S² − P²)', 'var', [['s', 'Scheinleistung', 'VA'], ['p', 'Wirkleistung', 'W']], function (s, p) { const Sv = reqNn(s, 'Die Scheinleistung', 1e12), P = reqNn(p, 'Die Wirkleistung', 1e12); if (P > Sv * (1 + 1e-9)) V('Die Wirkleistung ist größer als die Scheinleistung.'); return Math.sqrt(Math.max(0, Sv * Sv - P * P)); }, 'Leistungsdreieck: S ist die Hypotenuse.');
  F('qc', 'Kompensationsblindleistung', 'Q_C', 'Q_C = P · (tan φ₁ − tan φ₂)', 'var', [['p', 'Wirkleistung', 'W'], ['cos1', 'cos φ vorher', ''], ['cos2', 'cos φ Ziel', '']], function (p, c1, c2) { return need(comp.need({ p: p, cos1: c1, cos2: c2, u: 230, f: 50 })).qc; }, 'Blindleistung, die der Kondensator aufnehmen muss.');
  F('cKomp', 'Kompensationskapazität', 'C', 'C = Q_C / (ω · U²)', 'F', [['p', 'Wirkleistung', 'W'], ['cos1', 'cos φ vorher', ''], ['cos2', 'cos φ Ziel', ''], ['u', 'Spannung', 'V'], ['f', 'Frequenz', 'Hz']], function (p, c1, c2, u, f) { return need(comp.need({ p: p, cos1: c1, cos2: c2, u: u, f: f })).c; }, 'Parallelkompensation: Kondensator parallel zur Last.');
  F('f0', 'Resonanzfrequenz', 'f₀', 'f₀ = 1 / (2π · √(L · C))', 'Hz', [['l', 'Induktivität', 'H'], ['c', 'Kapazität', 'F']], function (l, c) { return need(res.tune({ l: l, c: c })).f0; }, 'Bei f₀ sind X_L und X_C gleich groß.');
  F('cAusF0', 'Kapazität für f₀', 'C', 'C = 1 / ((2π · f₀)² · L)', 'F', [['l', 'Induktivität', 'H'], ['f0', 'Resonanzfrequenz', 'Hz']], function (l, f0) { return need(res.tune({ l: l, f0: f0 })).c; }, 'Resonanzbedingung nach C umgestellt.');
  F('lAusF0', 'Induktivität für f₀', 'L', 'L = 1 / ((2π · f₀)² · C)', 'H', [['c', 'Kapazität', 'F'], ['f0', 'Resonanzfrequenz', 'Hz']], function (c, f0) { return need(res.tune({ c: c, f0: f0 })).l; }, 'Resonanzbedingung nach L umgestellt.');
  F('z0', 'Kennwiderstand', 'Z₀', 'Z₀ = √(L / C)', 'Ω', [['l', 'Induktivität', 'H'], ['c', 'Kapazität', 'F']], function (l, c) { return Math.sqrt(reqPos(l, 'Die Induktivität', 1e9) / reqPos(c, 'Die Kapazität', 1e9)); }, 'Blindwiderstand bei der Resonanzfrequenz.');
  F('gueteReihe', 'Güte Reihenkreis', 'Q_G', 'Q_G = Z₀ / R', '', [['l', 'Induktivität', 'H'], ['c', 'Kapazität', 'F'], ['r', 'Verlustwiderstand', 'Ω']], function (l, c, r) { return need(res.series({ l: l, c: c, r: r })).qg; }, 'Beim Reihenkreis ist die Güte der Kennwiderstand geteilt durch R.');
  F('gueteParallel', 'Güte Parallelkreis', 'Q_G', 'Q_G = R_p / Z₀', '', [['l', 'Induktivität', 'H'], ['c', 'Kapazität', 'F'], ['rp', 'Parallel-Verlustwiderstand', 'Ω']], function (l, c, rp) { return need(res.parallel({ l: l, c: c, r: rp })).qg; }, 'Beim Parallelkreis (Lehrmodell) ist die Güte R_p geteilt durch den Kennwiderstand.');
  F('bandbreite', 'Bandbreite', 'B', 'B = f₀ / Q_G', 'Hz', [['f0', 'Resonanzfrequenz', 'Hz'], ['qg', 'Güte', '']], function (f0, qg) { return gt0(f0, 'Die Resonanzfrequenz') / gt0(qg, 'Die Güte'); }, 'Abstand der beiden Grenzfrequenzen.');
  F('uLReso', 'Spannung an der Spule bei Resonanz', 'U_L', 'U_L = U / R · X_L', 'V', [['u', 'Spannung', 'V'], ['r', 'Wirkwiderstand', 'Ω'], ['xl', 'Blindwiderstand X_L', 'Ω']], function (u, r, xl) { return reqNn(u, 'Die Spannung', 1e9) / gt0(r, 'Der Wirkwiderstand') * reqNn(xl, 'Der Blindwiderstand X_L', 1e12); }, 'Bei Resonanz begrenzt nur R den Strom; U_L kann weit über U liegen.');
  F('fgRC', 'Grenzfrequenz RC', 'f_g', 'f_g = 1 / (2π · R · C)', 'Hz', [['r', 'Widerstand', 'Ω'], ['c', 'Kapazität', 'F']], function (r, c) { return need(filter.rc({ typ: 'tief', r: r, c: c })).fg; }, 'Bei f_g ist X_C gleich R.');
  F('fgRL', 'Grenzfrequenz RL', 'f_g', 'f_g = R / (2π · L)', 'Hz', [['r', 'Widerstand', 'Ω'], ['l', 'Induktivität', 'H']], function (r, l) { return need(filter.rl({ typ: 'tief', r: r, l: l })).fg; }, 'Bei f_g ist X_L gleich R (ideale Spule).');
  F('hBetrag', 'Übertragungsverhältnis Tiefpass', '|H|', '|H| = 1 / √(1 + (f / f_g)²)', '', [['f', 'Frequenz', 'Hz'], ['fg', 'Grenzfrequenz', 'Hz']], function (f, fg) { const x = gt0(f, 'Die Frequenz') / gt0(fg, 'Die Grenzfrequenz'); return 1 / Math.sqrt(1 + x * x); }, 'Beim Tiefpass sinkt |H| oberhalb von f_g.');
  F('dB', 'Dämpfungsmaß', 'a', 'a = 20 · lg |H|', 'dB', [['h', 'Übertragungsverhältnis', '']], function (h) { return 20 * lg(gt0(h, 'Das Übertragungsverhältnis')); }, 'Spannungsverhältnis in Dezibel.');
  F('dekade', 'Dämpfungsmaß im Abstand x · f_g (Tiefpass)', 'a', 'a = −10 · lg(1 + x²) mit x = f / f_g', 'dB', [['x', 'Frequenz geteilt durch f_g', '']], function (x) { const X = gt0(x, 'Das Frequenzverhältnis'); return -10 * lg(1 + X * X); }, 'Bei x = 10 ist a = −20,04 dB, nicht genau −20 dB.');
  F('tau', 'Zeitkonstante RC', 'τ', 'τ = R · C', 's', [['r', 'Widerstand', 'Ω'], ['c', 'Kapazität', 'F']], function (r, c) { return need(filter.rc({ typ: 'tief', r: r, c: c })).tau; }, 'Maß für die Dauer des Auf- und Entladens.');
  F('ueb', 'Übersetzungsverhältnis', 'ü', 'ü = N₁ / N₂ = U₁ / U₂', '', [['n1', 'Windungen Primärseite', ''], ['n2', 'Windungen Sekundärseite', '']], function (n1, n2) { return need(trafo.ideal({ n1: n1, n2: n2, i2: 0 })).ueb; }, L('trafo_ueb').text);
  F('i1', 'Primärstrom (ideal)', 'I₁', 'I₁ = I₂ · N₂ / N₁', 'A', [['i2', 'Sekundärstrom', 'A'], ['n1', 'Windungen Primärseite', ''], ['n2', 'Windungen Sekundärseite', '']], function (i2, n1, n2) { return need(trafo.ideal({ n1: n1, n2: n2, i2: i2 })).i1; }, 'Die Ströme verhalten sich umgekehrt wie die Windungszahlen.');
  F('etaTrafo', 'Wirkungsgrad Transformator', 'η', 'η = P₂ / (P₂ + P_Cu + P_Fe)', '', [['p2', 'Abgegebene Wirkleistung', 'W'], ['pcu', 'Kupferverluste', 'W'], ['pfe', 'Eisenverlust', 'W']], function (p2, pcu, pfe) { const a = reqNn(p2, 'Die Wirkleistung P₂', 1e12), b = reqNn(pcu, 'Die Kupferverluste', 1e12), c = reqNn(pfe, 'Der Eisenverlust', 1e12); if (!(a + b + c > 0)) V('Es gibt keine Leistung.'); return a / (a + b + c); }, 'Lehrmodell: abgegebene durch aufgenommene Wirkleistung.');
  F('uAussen', 'Außenleiterspannung', 'U_L', 'U_L = √3 · U_Str (Stern)', 'V', [['ustr', 'Strangspannung', 'V']], function (u) { return SQ3 * gt0(u, 'Die Strangspannung'); }, 'In der Sternschaltung ist die Außenleiterspannung √3 mal die Strangspannung.');
  F('pDrehstrom', 'Leistung im Drehstromnetz', 'P', 'P = √3 · U_L · I_L · cos φ', 'W', [['ul', 'Außenleiterspannung', 'V'], ['il', 'Leiterstrom', 'A'], ['cosphi', 'cos φ', '']], function (ul, il, cs) { return need(three.power({ ul: ul, il: il, cosphi: cs })).p; }, 'Gilt bei symmetrischer Last in Stern und Dreieck.');
  F('sternDreieck', 'Leistungsverhältnis Dreieck zu Stern', 'P_Δ / P_Y', 'P_Δ / P_Y = 3 (gleiche Last)', '', [['ul', 'Außenleiterspannung', 'V'], ['zstr', 'Strangwiderstand', 'Ω']], function (ul, z) { return need(three.power({ ul: ul, zstr: z, cosphi: 1 })).faktor; }, 'Dieselbe Last nimmt in Dreieck die dreifache Leistung auf wie in Stern (Rechenvergleich).');
  function fmUnitText(v, unit) { return unit && unit.indexOf('/') < 0 ? fmtEng(v, unit) : fmt(v) + (unit ? ' ' + unit : ''); }
  const formulas = {};
  const FMLIST = FM.map(function (m) {
    const fn = C(m.core);
    const calc = S(function (o) {
      reqObj(o);
      const vals = m.args.map(function (a) { return o[a.key]; });
      const v = m.core.apply(null, vals);
      if (!fin(v)) V(TEXTS.eingabe);
      return { ok: true, valid: true, id: m.id, value: v, unit: m.unit, text: m.symbol + ' = ' + fmUnitText(v, m.unit) };
    });
    const e = Object.freeze({ id: m.id, name: m.name, symbol: m.symbol, expr: m.expr, unit: m.unit, args: Object.freeze(m.args), fn: fn, calc: calc, explain: m.explain });
    formulas[m.id] = e;
    return e;
  });
  hide(formulas, 'list', function () { try { return FMLIST.slice(); } catch (e) { return []; } });
  hide(formulas, 'get', function (id) { try { return formulas[id] && formulas[id].fn ? formulas[id] : null; } catch (e) { return null; } });
  W.extend('formulas', formulas);
  const FN = function (id) { return formulas[id].fn; };
  const parseNum = W.parseNum;

  /* =============================== Messreihe (report) =============================== */
  const COLS = {
    schwing: [{ key: 'f', label: 'Frequenz', unit: 'Hz' }, { key: 'z', label: 'Scheinwiderstand', unit: 'Ω' }, { key: 'i', label: 'Strom', unit: 'A' }],
    filter: [{ key: 'f', label: 'Frequenz', unit: 'Hz' }, { key: 'ua', label: 'Ausgangsspannung', unit: 'V' }, { key: 'phi', label: 'Phasenwinkel', unit: '°' }],
    rlc: [{ key: 'f', label: 'Frequenz', unit: 'Hz' }, { key: 'z', label: 'Scheinwiderstand', unit: 'Ω' }, { key: 'i', label: 'Strom', unit: 'A' }]
  };
  const AUSW = {
    schwing: [{ key: 'f0', label: 'Resonanzfrequenz', unit: 'Hz', tol: RES_FENSTER }, { key: 'qg', label: 'Güte', unit: '', tol: 3 }, { key: 'b', label: 'Bandbreite', unit: 'Hz', tol: 3 }],
    filter: [{ key: 'fg', label: 'Grenzfrequenz', unit: 'Hz', tol: RES_FENSTER }],
    rlc: []
  };
  /* Zustand normieren: liefert ein Modell mit row(f) (Rechenwerte), ausw (Kennwerte), schaltung, center, oder wirft */
  function repModel(rigId, st) {
    const s = reqObj(st);
    if (rigId === 'schwing') {
      const art = lcase(s.art, 'reihe');
      const cfg = { art: art, l: s.l, c: s.c, r: s.r, u: s.u === undefined ? 1 : s.u };
      const at = function (f) { return need(art === 'parallel' ? res.parallel(Object.assign({}, cfg, { f: f })) : res.series(Object.assign({}, cfg, { f: f }))); };
      const base = need(art === 'parallel' ? res.parallel(cfg) : res.series(cfg));
      return { center: base.f0, row: function (f) { const p = at(f); return { z: p.z, i: p.i }; }, ausw: { f0: base.f0, qg: base.qg, b: base.b }, schaltung: art === 'parallel' ? 'Parallelschwingkreis' : 'Reihenschwingkreis' };
    }
    if (rigId === 'filter') {
      const cfg = { art: s.art, typ: s.typ, r: s.r, c: s.c, l: s.l, ue: s.ue !== undefined ? s.ue : (s.u !== undefined ? s.u : 1) };
      const base = need(filter.response(cfg, 1000));
      return { center: base.fg, row: function (f) { const p = need(filter.response(cfg, f)); return { ua: p.ua, phi: p.phi }; }, ausw: { fg: base.fg }, schaltung: 'Filter ' + base.art + ', ' + (base.typ === 'tief' ? 'Tiefpass' : 'Hochpass') };
    }
    if (rigId === 'rlc') {
      const aufbau = String(s.aufbau === undefined || s.aufbau === null ? 'RLC' : s.aufbau);
      const par = /parallel/i.test(aufbau);
      const ab = aufbau.replace(/parallel/i, '').trim().toUpperCase() || 'RLC';
      const cfg = { aufbau: ab, u: s.u === undefined ? 230 : s.u, r: s.r, l: s.l, c: s.c };
      const calc = function (f) { return need(par ? rlc.parallel(Object.assign({}, cfg, { f: f })) : rlc.series(Object.assign({}, cfg, { f: f }))); };
      return { center: 50, row: function (f) { const p = calc(f); return { z: p.z, i: p.i }; }, ausw: {}, schaltung: (par ? 'Parallelschaltung ' : 'Reihenschaltung ') + ab };
    }
    V('Für diesen Prüfstand gibt es keine Messreihe (möglich sind schwing, filter und rlc).');
  }
  function colsOf(rigId) { return COLS[rigId] ? COLS[rigId].map(function (c) { return Object.assign({}, c); }) : []; }
  const report = {};
  report.template = Object.freeze([
    { key: 'name', label: 'Name', typ: 'text', pflicht: true },
    { key: 'datum', label: 'Datum', typ: 'text', pflicht: true },
    { key: 'schaltung', label: 'Schaltung', typ: 'auswahl', pflicht: true },
    { key: 'bauteile', label: 'Bauteilwerte', typ: 'zahlen', pflicht: true },
    { key: 'quelle', label: 'Quellenspannung', typ: 'zahlen', pflicht: true },
    { key: 'zeilen', label: 'Messreihe (f, Messwert, berechneter Wert, Abweichung)', typ: 'tabelle', pflicht: true },
    { key: 'auswertung', label: 'Auswertung (f₀ bzw. f_g, Q_G, B)', typ: 'zahlen', pflicht: true },
    { key: 'ergebnis', label: 'Ergebnis', typ: 'text', pflicht: true }
  ]);
  report.generate = S(function (rigId, state, seed) {
    const id = String(rigId);
    if (!COLS[id]) V('Für diesen Prüfstand gibt es keine Messreihe (möglich sind schwing, filter und rlc).');
    const m = repModel(id, state), cols = colsOf(id), r = W.rng(num(seed, 1));
    const f = id === 'schwing' ? logGrid(m.center, 21, Math.log10(2), Math.log10(2)) : logGrid(m.center, 13, 1, 1);
    const zeilen = f.map(function (fk) {
      const ex = m.row(fk), row = { f: fk };
      cols.slice(1).forEach(function (c) {
        const v = ex[c.key], e1 = 2 * r() - 1;
        row[c.key] = c.key === 'phi' ? v + 0.5 * e1 : v * (1 + 0.01 * e1);
      });
      return row;
    });
    const zustand = snap(state);
    const bauteile = {}, quelle = {};
    ['l', 'c', 'r', 'aufbau', 'art', 'typ'].forEach(function (k) { if (zustand && zustand[k] !== undefined && zustand[k] !== null) bauteile[k] = zustand[k]; });
    ['u', 'ue'].forEach(function (k) { if (zustand && zustand[k] !== undefined && zustand[k] !== null) quelle[k] = zustand[k]; });
    const entry = { rigId: id, name: '', datum: '', schaltung: m.schaltung, bauteile: bauteile, quelle: quelle, spalten: cols, zeilen: zeilen, auswertung: {}, ergebnis: '', seed: num(seed, 1), zustand: zustand, hinweis: TEXTS.messreiheHinweis };
    return { ok: true, valid: true, rigId: id, entry: entry, ref: { rigId: id, state: zustand, ausw: snap(m.ausw) }, hinweis: TEXTS.messreiheHinweis };
  });
  function isEmptyS(v) { return v === undefined || v === null || String(v).trim() === ''; }
  function hintFor(ratio) {
    if (Math.abs(ratio / TWO_PI - 1) < 0.03) return ' Der Wert ist rund 6,28-mal zu groß: prüfe, ob du ω statt f eingetragen hast.';
    if (Math.abs(ratio * TWO_PI - 1) < 0.03) return ' Der Wert ist rund 6,28-mal zu klein: prüfe, ob du 2π vergessen hast (f = ω / 2π).';
    return ' Prüfe, ob du ω oder f eingesetzt hast.';
  }
  report.check = S(function (entry, ref) {
    reqObj(entry);
    const rigId = String(entry.rigId);
    if (!COLS[rigId]) V('Für diesen Prüfstand gibt es keine Messreihe.');
    const rf = isObj(ref) ? (isObj(ref.ref) ? ref.ref : ref) : null;
    const state = rf && isObj(rf.state) ? rf.state : entry.zustand;
    if (!isObj(state)) V('Zum Prüfen fehlt der Zustand der Anlage (zustand).');
    const m = repModel(rigId, state), cols = colsOf(rigId);
    const items = [];
    function add(feld, okv, text) { items.push({ feld: feld, ok: okv, text: text }); }
    [['name', 'Der Name'], ['datum', 'Das Datum'], ['schaltung', 'Die Schaltung'], ['ergebnis', 'Das Ergebnis']].forEach(function (p) {
      add(p[0], !isEmptyS(entry[p[0]]), isEmptyS(entry[p[0]]) ? p[1] + ' fehlt (Pflichtfeld).' : p[1] + ' ist eingetragen.');
    });
    const bt = isObj(entry.bauteile) ? Object.keys(entry.bauteile).length : 0;
    add('bauteile', bt > 0, bt > 0 ? 'Die Bauteilwerte sind eingetragen.' : 'Die Bauteilwerte fehlen (Pflichtfeld).');
    if (rf && isObj(rf.state) && bt > 0) {
      ['l', 'c', 'r'].forEach(function (k) {
        if (entry.bauteile[k] !== undefined && rf.state[k] !== undefined) {
          const a = parseNum(entry.bauteile[k]), b = num(rf.state[k], NaN);
          if (isFinite(a) && isFinite(b) && Math.abs(a - b) > 0.03 * Math.abs(b)) add('bauteile.' + k, false, 'Der Bauteilwert ' + k.toUpperCase() + ' weicht von der Anlage ab (' + fmt(a) + ' statt ' + fmt(b) + ').');
        }
      });
    }
    const qn = isObj(entry.quelle) ? Object.keys(entry.quelle).length : 0;
    add('quelle', qn > 0, qn > 0 ? 'Die Quellenspannung ist eingetragen.' : 'Die Quellenspannung fehlt (Pflichtfeld).');
    const zl = isArr(entry.zeilen) ? entry.zeilen : [];
    add('zeilen', zl.length >= 3, zl.length >= 3 ? 'Die Messreihe hat ' + zl.length + ' Zeilen.' : 'Die Messreihe braucht mindestens 3 Zeilen.');
    const bad = [];
    zl.forEach(function (row, k) {
      if (!isObj(row)) { bad.push('Zeile ' + (k + 1) + ' ist leer.'); return; }
      const f = parseNum(row.f);
      if (!(f > 0)) { bad.push('Zeile ' + (k + 1) + ': Die Frequenz ist keine Zahl größer als 0.'); return; }
      let ex; try { ex = m.row(f); } catch (e) { bad.push('Zeile ' + (k + 1) + ': Für f = ' + fmtEng(f, 'Hz') + ' gibt es keine Rechnung.'); return; }
      cols.slice(1).forEach(function (c) {
        const v = parseNum(row[c.key]);
        if (!isFinite(v)) { bad.push('Zeile ' + (k + 1) + ' (f = ' + fmtEng(f, 'Hz') + '): ' + c.label + ' ist keine Zahl.'); return; }
        const e = ex[c.key];
        const dev = c.key === 'phi' ? Math.abs(v - e) / 90 * 100 : Math.abs(v - e) / Math.max(Math.abs(e), 1e-300) * 100;
        if (dev > 3) bad.push('Zeile ' + (k + 1) + ' (f = ' + fmtEng(f, 'Hz') + '): ' + c.label + ' ' + fmtEng(v, c.unit) + ' weicht um ' + fmt(dev, 1) + ' % von der Rechnung ab (' + (c.key === 'phi' ? 'bezogen auf 90°, ' : '') + 'Toleranz 3 %).');
      });
    });
    if (zl.length >= 3) add('messwerte', bad.length === 0, bad.length === 0 ? 'Alle Messwerte stimmen mit der Rechnung überein (Toleranz 3 %).' : bad.slice(0, 3).join(' ') + (bad.length > 3 ? ' Dazu ' + (bad.length - 3) + ' weitere Abweichungen.' : ''));
    const aw = isObj(entry.auswertung) ? entry.auswertung : {};
    const defs = AUSW[rigId];
    if (defs.length) {
      const any = defs.some(function (d) { return !isEmptyS(aw[d.key]); });
      add('auswertung', any, any ? 'Die Auswertung ist ausgefüllt.' : 'Die Auswertung fehlt (Pflichtfeld).');
      defs.forEach(function (d) {
        if (isEmptyS(aw[d.key])) return;
        const v = parseNum(aw[d.key]), e = m.ausw[d.key];
        if (e === undefined || !isFinite(e)) return;
        if (!isFinite(v)) { add('auswertung.' + d.key, false, d.label + ' ist keine Zahl.'); return; }
        const dev = Math.abs(v - e) / Math.abs(e) * 100;
        const okv = dev <= d.tol;
        add('auswertung.' + d.key, okv, okv ? d.label + ' stimmt mit der Rechnung überein (Abweichung ' + fmt(dev, 1) + ' %, Toleranz ' + fmt(d.tol, 0) + ' %).' :
          d.label + ' weicht um ' + fmt(dev, 0) + ' % ab:' + (d.key === 'f0' || d.key === 'fg' ? hintFor(v / e) : ' prüfe die Formel und die Einheiten.'));
      });
    } else add('auswertung', true, 'Für diese Schaltung ist keine Auswertung verlangt.');
    const fails = items.filter(function (x) { return !x.ok; });
    return { ok: true, valid: true, passt: fails.length === 0, items: items, abweichungen: fails.map(function (x) { return x.text; }), text: fails.length === 0 ? 'Die Messreihe ist in sich stimmig. ' + TEXTS.protoHinweis : fails.length + ' Punkt(e) prüfen: ' + fails.map(function (x) { return x.text; }).join(' ') };
  });
  /* CSV: Semikolon, Dezimalkomma, Anfuehrungszeichen verdoppelt */
  function csvCell(v) {
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[;"\r\n]/.test(s) || s !== s.trim()) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function typOf(v) { return typeof v === 'number' ? 'n' : (typeof v === 'boolean' ? 'b' : 's'); }
  report.csv = S(function (entry) {
    reqObj(entry);
    const lines = ['#WSL-Messreihe;Version 1;' + TEXTS.protoHinweis.replace(/;/g, ',')];
    function meta(k, v) { if (v === undefined || v === null) return; if (typeof v === 'number' && !isFinite(v)) return; if (typeof v === 'object') return; lines.push([csvCell(k), csvCell(v), typOf(v)].join(';')); }
    ['rigId', 'name', 'datum', 'schaltung', 'ergebnis', 'seed', 'hinweis'].forEach(function (k) { meta(k, entry[k]); });
    ['bauteile', 'quelle', 'auswertung', 'zustand'].forEach(function (g) { if (isObj(entry[g])) Object.keys(entry[g]).forEach(function (k) { meta(g + '.' + k, entry[g][k]); }); });
    const rows = isArr(entry.zeilen) ? entry.zeilen : [];
    const keys = isArr(entry.spalten) && entry.spalten.length ? entry.spalten.map(function (c) { return c.key; }) : (rows[0] ? Object.keys(rows[0]) : []);
    lines.push('');
    lines.push('@Messreihe');
    lines.push(keys.map(csvCell).join(';'));
    rows.forEach(function (r) { lines.push(keys.map(function (k) { return r && r[k] !== undefined && r[k] !== null ? csvCell(r[k]) : ''; }).join(';')); });
    return { ok: true, valid: true, text: lines.join('\r\n') + '\r\n' };
  });
  function csvRows(text) {
    const rows = []; let row = [], cell = '', q = false, i = 0, started = false;
    const n = text.length;
    while (i < n) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') { q = true; started = true; i++; continue; }
      if (ch === ';') { row.push(cell); cell = ''; started = true; i++; continue; }
      if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        i++;
        if (started || cell !== '' || row.length) { row.push(cell); rows.push(row); } else rows.push([]);
        row = []; cell = ''; started = false; continue;
      }
      cell += ch; started = true; i++;
    }
    if (started || cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  report.parseCsv = S(function (text) {
    if (typeof text !== 'string' || text.length < 5) V('Das ist keine Messreihen-Datei: Der Text ist leer.');
    if (text.length > 5e6) V('Die Datei ist zu groß.');
    const rows = csvRows(text.replace(/^﻿/, ''));
    if (!rows.length || !rows[0][0] || rows[0][0].indexOf('#WSL-Messreihe') !== 0) V('Das ist keine Messreihen-Datei dieses Labs (Kopfzeile #WSL-Messreihe fehlt).');
    const entry = { bauteile: {}, quelle: {}, auswertung: {}, zustand: {} };
    let k = 1;
    function val(cell, typ) {
      if (typ === 'n') { const x = parseNum(cell); if (!isFinite(x)) V('Zahl nicht lesbar: „' + cell + '“.'); return x; }
      if (typ === 'b') return cell === 'true';
      return cell;
    }
    for (; k < rows.length; k++) {
      const r = rows[k];
      if (r.length === 0) continue;
      if (r[0] === '@Messreihe') { k++; break; }
      if (r.length < 3) V('Zeile ' + (k + 1) + ' ist keine Eigenschaft (Schlüssel;Wert;Typ).');
      const key = r[0], v = val(r[1], r[2]), dot = key.indexOf('.');
      if (dot > 0) { const g = key.slice(0, dot); if (!entry[g]) V('Unbekannter Abschnitt „' + g + '“.'); entry[g][key.slice(dot + 1)] = v; } else entry[key] = v;
    }
    const head = rows[k] || [];
    k++;
    const id = String(entry.rigId);
    entry.spalten = COLS[id] ? colsOf(id) : head.map(function (h) { return { key: h, label: h, unit: '' }; });
    entry.zeilen = [];
    for (; k < rows.length; k++) {
      const r = rows[k];
      if (!r.length || (r.length === 1 && r[0] === '')) continue;
      const o = {};
      head.forEach(function (h, j) { if (r[j] !== undefined && r[j] !== '') { const pq = W.parseQty(r[j]); o[h] = pq && !pq.hasUnit && isFinite(pq.v) ? pq.v : r[j]; } });
      entry.zeilen.push(o);
    }
    return { ok: true, valid: true, entry: entry };
  });
  W.extend('report', report);
  /* =============================== 4.10 Pruefmodell assess =============================== */
  const RANK = { grau: 0, gruen: 1, gelb: 2, rot: 3 };
  const AMPEL_TXT = TEXTS.ampel;
  function rate(dev, g, y) { return dev <= g + 1e-12 ? 'gruen' : (dev <= y + 1e-12 ? 'gelb' : 'rot'); }
  function pct(v, ziel) { return Math.abs(v - ziel) / Math.abs(ziel) * 100; }
  function zielNum(z, k) { const v = z[k] === undefined || z[k] === null ? NaN : num(z[k], NaN); return isFinite(v) ? v : NaN; }
  function crit(list, name, ist, soll, unit, dev, ampel, g, y, extra) {
    list.push({ name: name, ist: ist, soll: soll, abw: dev, ampel: ampel, text: name + ' ' + fmUnitText(ist, unit) + ', Vorgabe ' + fmUnitText(soll, unit) + ': Abweichung ' + fmt(dev, 1) + (extra || ' %') + ' (' + AMPEL_TXT[ampel] + '; grün bis ' + fmt(g, 2) + ', gelb bis ' + fmt(y, 2) + ')' });
  }
  function critPct(list, name, ist, soll, unit, g, y) {
    const dev = pct(ist, soll);
    crit(list, name, ist, soll, unit, dev, rate(dev, g, y), g, y);
  }
  function assessCore(rigId, state) {
    const id = String(rigId);
    const st = obj(state), z = obj(st.ziel), list = [];
    let notes = '';
    const G = AMP_GRUEN, Y = AMP_GELB;
    if (id === 'sinus') {
      const v = need(sine.values({ form: st.form === undefined ? 'sinus' : st.form, ampl: st.ampl, f: st.f, offset: st.offset }));
      const ue = zielNum(z, 'ueff'), ph = zielNum(z, 'phi'), ff = zielNum(z, 'f');
      if (isFinite(ue)) { if (!(ue > 0)) V('Die Vorgabe für den Effektivwert muss größer als 0 sein.'); critPct(list, 'Effektivwert U =', v.rms, ue, 'V', G, Y); }
      if (isFinite(ph)) { const ist = U.normDeg(num(st.phi, 0)), dev = Math.abs(U.normDeg(ist - ph)) / 90 * 100; crit(list, 'Phasenwinkel φ =', ist, ph, '°', dev, rate(dev, G, Y), G, Y, ' % von 90°'); }
      if (isFinite(ff)) { if (!(ff > 0)) V('Die Vorgabe für die Frequenz muss größer als 0 sein.'); critPct(list, 'Frequenz f =', reqPos(st.f, 'Die Frequenz', 1e12), ff, 'Hz', G, Y); }
    } else if (id === 'rlc') {
      const aufbau = String(st.aufbau === undefined || st.aufbau === null ? 'RLC' : st.aufbau);
      const par = /parallel/i.test(aufbau), ab = aufbau.replace(/parallel/i, '').trim().toUpperCase() || 'RLC';
      const cfg = { aufbau: ab, u: st.u, f: st.f, r: st.r, l: st.l, c: st.c };
      const p = need(par ? rlc.parallel(cfg) : rlc.series(cfg));
      const ph = zielNum(z, 'phi'), zi = zielNum(z, 'z'), ii = zielNum(z, 'i'), im = zielNum(z, 'imax');
      if (isFinite(ph)) { const dev = Math.abs(p.phi - ph) / 90 * 100; crit(list, 'Phasenwinkel φ =', p.phi, ph, '°', dev, rate(dev, G, Y), G, Y, ' % von 90°'); }
      if (isFinite(zi)) { if (!(zi > 0)) V('Die Vorgabe für den Scheinwiderstand muss größer als 0 sein.'); critPct(list, 'Scheinwiderstand Z =', p.z, zi, 'Ω', G, Y); }
      if (isFinite(ii)) { if (!(ii > 0)) V('Die Vorgabe für den Strom muss größer als 0 sein.'); critPct(list, 'Strom I =', p.i, ii, 'A', G, Y); }
      if (isFinite(im)) {
        const over = p.i > im;
        list.push({ name: 'Bauteilstrom', ist: p.i, soll: im, abw: over ? pct(p.i, im) : 0, ampel: over ? 'rot' : 'gruen', text: 'Strom I = ' + fmtEng(p.i, 'A') + ' bei zulässigem Strom ' + fmtEng(im, 'A') + ': ' + (over ? 'Das Bauteil wäre überlastet (rot).' : 'keine Überlast (grün).') });
      }
    } else if (id === 'leistung') {
      const zc = zielNum(z, 'cosphi');
      if (isFinite(zc)) {
        const r = need(power.fromPcos(st.p, st.cosphi, st.u));
        const dev = Math.max(0, zc - r.cosphi), ampel = dev <= 1e-9 ? 'gruen' : (dev <= COS_FENSTER + 1e-12 ? 'gelb' : 'rot');
        list.push({ name: 'Leistungsfaktor', ist: r.cosphi, soll: zc, abw: dev, ampel: ampel, text: 'cos φ = ' + fmt(r.cosphi, 3) + ', Vorgabe ' + fmt(zc, 3) + ': ' + (dev <= 1e-9 ? 'Vorgabe erreicht' : 'liegt ' + fmt(dev, 3) + ' darunter') + ' (' + AMPEL_TXT[ampel] + '; gelb bis ' + fmt(COS_FENSTER, 2) + ' darunter, Lehrfaustwert).' });
      }
    } else if (id === 'kompens') {
      const zc = z.cos2 !== undefined && z.cos2 !== null ? zielNum(z, 'cos2') : zielNum(z, 'cos');
      if (isFinite(zc)) {
        const cs = need(comp.state({ p: st.p, cos1: st.cos1, u: st.u === undefined ? LV('u_netz') : st.u, f: st.f === undefined ? LV('f_netz') : st.f, c: st.c === undefined ? 0 : st.c, cos2: zc }));
        let ampel;
        if (cs.state === 'ueber') ampel = 'rot'; else if (cs.state === 'ziel') ampel = 'gruen'; else ampel = cs.cos >= zc - COS_FENSTER - 1e-12 ? 'gelb' : 'rot';
        list.push({ name: 'Kompensation', ist: cs.cos, soll: zc, abw: Math.max(0, zc - cs.cos), ampel: ampel, zustand: cs.state, text: cs.text + ' (' + AMPEL_TXT[ampel] + '; gelb bis ' + fmt(COS_FENSTER, 2) + ' unter dem Ziel, Lehrfaustwert).' });
      }
    } else if (id === 'schwing') {
      const art = lcase(st.art, 'reihe');
      const cfg = { art: art, l: st.l, c: st.c, r: st.r, u: st.u };
      const p = need(art === 'parallel' ? res.parallel(cfg) : res.series(cfg));
      const zf = zielNum(z, 'f0'), zq = zielNum(z, 'qg'), zb = zielNum(z, 'b'), zu = zielNum(z, 'umax');
      if (isFinite(zf)) { if (!(zf > 0)) V('Die Vorgabe für die Resonanzfrequenz muss größer als 0 sein.'); critPct(list, 'Resonanzfrequenz f₀ =', p.f0, zf, 'Hz', RES_FENSTER, Y); }
      if (isFinite(zq)) { if (!(zq > 0)) V('Die Vorgabe für die Güte muss größer als 0 sein.'); critPct(list, 'Güte Q_G =', p.qg, zq, '', G, Y); }
      if (isFinite(zb)) { if (!(zb > 0)) V('Die Vorgabe für die Bandbreite muss größer als 0 sein.'); critPct(list, 'Bandbreite B =', p.b, zb, 'Hz', G, Y); }
      if (isFinite(zu)) {
        if (art !== 'reihe') V('Die Spannungsvorgabe gilt für den Reihenkreis (Spannungsüberhöhung).');
        if (!p.resonanz) V('Für die Spannungsvorgabe wird die Quellenspannung gebraucht.');
        const um = p.resonanz.ul, over = um > zu;
        list.push({ name: 'Bauteilspannung', ist: um, soll: zu, abw: over ? pct(um, zu) : 0, ampel: over ? 'rot' : 'gruen', text: 'Bei Resonanz liegen an L und C je ' + fmtEng(um, 'V') + ' bei zulässigen ' + fmtEng(zu, 'V') + ': ' + (over ? 'Die Spannungsfestigkeit wäre überschritten (rot).' : 'unter der Vorgabe (grün).') });
      }
    } else if (id === 'filter') {
      const zf = zielNum(z, 'fg'), zt = z.typ === undefined || z.typ === null ? '' : lcase(z.typ, '').replace('pass', '');
      const p = need(filter.response({ art: st.art, typ: st.typ, r: st.r, c: st.c, l: st.l, ue: st.ue }, 1000));
      if (zt) {
        const okTyp = zt === p.typ;
        list.push({ name: 'Typ', ist: 0, soll: 0, abw: okTyp ? 0 : 100, ampel: okTyp ? 'gruen' : 'rot', text: 'Das Filter ist ein ' + (p.typ === 'tief' ? 'Tiefpass' : 'Hochpass') + ', verlangt ist ein ' + (zt === 'tief' ? 'Tiefpass' : 'Hochpass') + (okTyp ? ' (grün).' : ': Hoch- und Tiefpass sind vertauscht (rot).') });
      }
      if (isFinite(zf)) { if (!(zf > 0)) V('Die Vorgabe für die Grenzfrequenz muss größer als 0 sein.'); critPct(list, 'Grenzfrequenz f_g =', p.fg, zf, 'Hz', FG_FENSTER, 2 * FG_FENSTER); }
    } else if (id === 'trafo') {
      const real = lcase(st.modus, 'ideal') === 'real' && st.sn !== undefined && st.r1 !== undefined && st.r2 !== undefined;
      const rl = st.rlast;
      const r = real ? need(trafo.real({ u1: st.u1, n1: st.n1, n2: st.n2, sn: st.sn, r1: st.r1, r2: st.r2, rlast: rl, u1n: st.u1n, pfe: st.pfe, uk: st.uk })) : need(trafo.ideal({ u1: st.u1, n1: st.n1, n2: st.n2, rlast: rl }));
      const zu = zielNum(z, 'u2'), zi = zielNum(z, 'i1'), ze = zielNum(z, 'eta'), zm = zielNum(z, 'i1max');
      if (isFinite(zu)) { if (!(zu > 0)) V('Die Vorgabe für U₂ muss größer als 0 sein.'); critPct(list, 'Sekundärspannung U₂ =', r.u2, zu, 'V', G, Y); }
      if (isFinite(zi)) { if (!(zi > 0)) V('Die Vorgabe für I₁ muss größer als 0 sein.'); critPct(list, 'Primärstrom I₁ =', r.i1, zi, 'A', G, Y); }
      if (isFinite(ze)) {
        if (!real) V('Den Wirkungsgrad gibt es nur im Lehrmodell (Modell „real“ mit Nennscheinleistung und Wicklungswiderständen).');
        if (!(ze > 0)) V('Die Vorgabe für den Wirkungsgrad muss größer als 0 sein.');
        critPct(list, 'Wirkungsgrad η =', r.eta * 100, ze * (ze <= 1 ? 100 : 1), '%', G, Y);
      }
      if (isFinite(zm)) { const over = r.i1 > zm; list.push({ name: 'Primärstrom', ist: r.i1, soll: zm, abw: over ? pct(r.i1, zm) : 0, ampel: over ? 'rot' : 'gruen', text: 'Primärstrom I₁ = ' + fmtEng(r.i1, 'A') + ' bei zulässigen ' + fmtEng(zm, 'A') + ': ' + (over ? 'über der Vorgabe (rot).' : 'unter der Vorgabe (grün).') }); }
    } else if (id === 'drehstrom') {
      const sch = lcase(st.schaltung, 'stern');
      const cfg = { ul: st.ul, zstr: st.rstr !== undefined ? st.rstr : st.zstr, cosphi: st.cosphi };
      const r = need(sch === 'dreieck' ? three.delta(cfg) : three.star(cfg));
      const zp = zielNum(z, 'p'), zi = zielNum(z, 'il'), zs = z.schaltung === undefined || z.schaltung === null ? '' : lcase(z.schaltung, '');
      if (zs) { const okS = zs === (sch === 'dreieck' ? 'dreieck' : 'stern'); list.push({ name: 'Schaltung', ist: 0, soll: 0, abw: okS ? 0 : 100, ampel: okS ? 'gruen' : 'rot', text: 'Geschaltet ist ' + (sch === 'dreieck' ? 'Dreieck' : 'Stern') + ', verlangt ist ' + (zs === 'dreieck' ? 'Dreieck' : 'Stern') + (okS ? ' (grün).' : ': Stern und Dreieck sind vertauscht (rot).') }); }
      if (isFinite(zp)) { if (!(zp > 0)) V('Die Vorgabe für die Leistung muss größer als 0 sein.'); critPct(list, 'Wirkleistung P =', r.p, zp, 'W', G, Y); }
      if (isFinite(zi)) { if (!(zi > 0)) V('Die Vorgabe für den Leiterstrom muss größer als 0 sein.'); critPct(list, 'Leiterstrom I_L =', r.il, zi, 'A', G, Y); }
    } else V('Den Prüfstand „' + id + '“ gibt es nicht.');
    if (!list.length) return { ok: true, valid: true, ampel: 'grau', text: TEXTS.grau, punkte: [] };
    let ampel = 'gruen', margin = 0;
    list.forEach(function (k) { if (RANK[k.ampel] > RANK[ampel]) ampel = k.ampel; if (isFinite(k.abw) && k.abw > margin) margin = k.abw; });
    return { ok: true, valid: true, ampel: ampel, text: list.map(function (k) { return k.text; }).join(' ') + notes, margin: margin, ziel: snap(z), punkte: list };
  }
  W.extend('assess', function (rigId, state) {
    try {
      const r = S(assessCore)(rigId, state);
      if (!r || r.ok !== true) return { ok: false, ampel: 'grau', text: r && r.why ? r.why : TEXTS.eingabe, why: r && r.why ? r.why : TEXTS.eingabe };
      return r;
    } catch (e) { return { ok: false, ampel: 'grau', text: TEXTS.eingabe, why: TEXTS.eingabe }; }
  });
  const assess = W.assess;

  /* =============================== Aufgaben (exercise) und Diagnose =============================== */
  Object.assign(TEXTS.diag, {
    'omega-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne den Faktor 2π, also mit f statt ω = 2π · f. Prüfe, wo 2π hineingehört.',
    'xl-xc-vertauscht': 'Das Vorzeichen von φ ist vertauscht (dein Wert {w}): Ist X_L größer als X_C, ist φ positiv (induktiv, die Spannung eilt dem Strom vor), sonst negativ (kapazitiv). Hier ist X_L = {xl} und X_C = {xc}.',
    'z-addiert': 'Dein Wert ({w}) passt zu Z = R + X. Wirk- und Blindwiderstand stehen im rechten Winkel und werden geometrisch addiert: Z = √(R² + X²).',
    'u-addiert': 'Dein Wert ({w}) passt zu einer Summe der Teilspannungen. Teilspannungen werden geometrisch addiert: U_L und U_C sind gegenphasig, U = √(U_R² + (U_L − U_C)²).',
    'p-gleich-s': 'Dein Wert ({w}) passt zu S = P oder S = √3 · U · I ohne cos φ. Die Wirkleistung ist nur der Anteil P = S · cos φ der Scheinleistung; hast du cos φ vergessen?',
    'q-aus-p': 'Dein Wert ({w}) passt zu Q = P · sin φ. Aus der Wirkleistung gilt Q = P · tan φ; sin φ gehört zu Q = S · sin φ.',
    'komp-ueber': 'Dein C ({w}) ist größer als {cmax}, das C, bei dem die Blindleistung schon ganz kompensiert ist. Darüber ist die Last überkompensiert (kapazitiv), cos φ sinkt wieder auf {cos}.',
    'komp-wirkung': 'Der Kondensator senkt den Strom aus dem Netz von {i1} auf {i2}; die Wirkleistung P = {p} bleibt gleich, nur die Blindleistung sinkt (Q von {q1} auf {q2}).',
    'res-reihe': 'Bei Resonanz ist der Scheinwiderstand des Reihenkreises am kleinsten: Z = R = {z}. Der Strom ist am größten: I = {i}.',
    'res-parallel': 'Bei Resonanz ist der Scheinwiderstand des Parallelkreises am größten: Z = R_p = {z}. Der Strom aus der Quelle ist am kleinsten: I = {i}; im Kreis fließen je {ik} durch L und C.',
    'res-ueberhoehung': 'An Spule und Kondensator liegen je {ul} bei nur {u} Quellenspannung (Faktor Q_G = {qg}). Das ist die Spannungsüberhöhung; die Spannungsfestigkeit der Bauteile ist ein Auslegungskriterium (nur Simulation).',
    'fg-f': 'Dein Wert ({w}) passt zu f_g = 1 / (R · C), also mit ω statt f. Die Grenzfrequenz ist f_g = 1 / (2π · R · C).',
    'fg-3db': 'Bei der Grenzfrequenz beträgt das Übertragungsverhältnis {betrag} und das Dämpfungsmaß {db}, nicht 50 % oder −6 dB.',
    'hp-tp': 'Hoch- und Tiefpass sind vertauscht: Dein Filter ist ein {ist}. Bei f = {f} ist |H| = {hist} ({aist} dB); ein {soll} hätte dort |H| = {hsoll} ({asoll} dB).',
    'bode-dekade': 'Dein Wert ({w}) passt zu −3 dB: Das gilt bei f_g selbst. Beim {x}-fachen von f_g beträgt das Dämpfungsmaß {a} dB (Asymptote −20 dB je Dekade; bei f_g liegt die Kurve 3 dB unter dem Knick).',
    'trafo-dc': 'Gleichspannung am Transformator: {why}',
    'trafo-i': 'Dein Wert ({w}) passt zu I₁ = I₂ · N₁ / N₂. Die Ströme verhalten sich umgekehrt wie die Windungszahlen: I₁ / I₂ = N₂ / N₁.',
    'stern-dreieck': 'Dein Wert ({w}) passt zu einer Rechnung, in der der Faktor √3 falsch angesetzt ist. Drehstrom: P = √3 · U_L · I_L · cos φ mit Außenleiterspannung und Leiterstrom; Stern: U_Str = U_L / √3, Dreieck: I_Str = I_L / √3.'
  });
  Object.assign(TEXTS.msg, {
    'zu-klein': 'Dein Wert ist zu klein: Er liegt {pct} % unter dem Ergebnis. Rechne die Schritte noch einmal nach.',
    'zu-gross': 'Dein Wert ist zu groß: Er liegt {pct} % über dem Ergebnis. Rechne die Schritte noch einmal nach.',
    'vorzeichen': 'Das Vorzeichen stimmt nicht: Das Ergebnis hat das andere Vorzeichen.',
    'vorsatz': 'Dein Wert ist um den Faktor {faktor} verschoben. Prüfe den Vorsatz: µ, n, p, m, k, M.',
    'wurzel': 'Dein Wert weicht um den Faktor √2 ab: Prüfe die Wurzel aus 2 (zum Beispiel Effektivwert = Scheitelwert / √2, oder |H| = 1 / √2 bei f_g).',
    'wurzel3': 'Dein Wert weicht um den Faktor √3 ab: Prüfe, ob du Außenleiter- und Strangwerte richtig zugeordnet hast (Stern: U_L = √3 · U_Str, Dreieck: I_L = √3 · I_Str).',
    'wurzel-allg': 'Dein Wert liegt um den Faktor {f} daneben: Prüfe die Rechenschritte, zum Beispiel die geometrische Addition (Pythagoras statt einfacher Summe) und die Stellen, an denen eine Wurzel gezogen wird.',
    'einheit': 'Die Einheit passt nicht: Gesucht ist eine Größe in {gesucht}.',
    'richtig': 'Richtig: {was} = {wert}.',
    'wurzel-vergessen': 'Dein Wert ({w}) ist der Scheitelwert selbst. Der Effektivwert einer Sinusgröße ist der Scheitelwert geteilt durch √2: Hast du die Wurzel vergessen?',
    'halbiert': 'Dein Wert ({w}) passt zu û / 2. Beim Sinus wird durch √2 geteilt, nicht durch 2.',
    'grad-nicht-umgerechnet': 'Dein Wert ({w}) passt zu Δt = φ / f. Der Phasenwinkel muss auf die volle Periode von 360° bezogen werden: Δt = φ / 360° · T.',
    'bogenmass': 'Dein Wert ({w}) passt zu einer Rechnung mit dem Winkel in Bogenmaß statt Grad. Δt = φ / 360° · T gilt mit φ in Grad.',
    'periode-statt-versatz': 'Dein Wert ({w}) ist die Periodendauer T. Gefragt ist der Zeitversatz, also nur der Anteil φ / 360° davon.',
    'kehrwert-vergessen': 'Dein Wert ({w}) passt zu X_C = 2π · f · C. Beim Kondensator gilt der Kehrwert: X_C = 1 / (2π · f · C).',
    'z-statt-xl': 'Dein Wert ({w}) ist der Scheinwiderstand Z = U / I. Gefragt ist X_L: Zieh den Wirkwiderstand R = P / I² geometrisch ab, X_L = √(Z² − R²).',
    'z-minus-r': 'Dein Wert ({w}) passt zu X_L = Z − R. Die Widerstände werden geometrisch verrechnet: X_L = √(Z² − R²).',
    'cos-sin-vertauscht': 'Dein Wert ({w}) passt zur Wirkleistung P = U · I · cos φ. Die Blindleistung ist Q = U · I · sin φ: cos φ und sin φ sind vertauscht.',
    's-minus-p': 'Dein Wert ({w}) passt zu Q = S − P. Im Leistungsdreieck gilt der Satz des Pythagoras: Q = √(S² − P²).',
    'pythagoras-plus': 'Dein Wert ({w}) passt zu √(S² + P²). S ist die Hypotenuse: Q = √(S² − P²).',
    'cos-multipliziert': 'Dein Wert ({w}) passt zu S = P · cos φ. Es gilt S = P / cos φ, die Scheinleistung ist größer als die Wirkleistung.',
    'tan-cos-vertauscht': 'Dein Wert ({w}) passt zu einer Rechnung mit cos φ statt tan φ. Die Kompensationsblindleistung ist Q_C = P · (tan φ₁ − tan φ₂).',
    'wurzel-vergessen-f0': 'Dein Wert ({w}) passt zu einer Rechnung ohne die Wurzel: f₀ = 1 / (2π · √(L · C)).',
    'quadrat-vergessen': 'Dein Wert ({w}) passt zu einer Rechnung ohne das Quadrat von 2π · f₀: Aus f₀ = 1 / (2π · √(L · C)) folgt L · C = 1 / (2π · f₀)².',
    'guete-statt-b': 'Dein Wert ({w}) ist die Güte Q_G. Gefragt ist die Bandbreite B = f₀ / Q_G.',
    'f0-statt-b': 'Dein Wert ({w}) ist die Resonanzfrequenz f₀. Gefragt ist die Bandbreite B = f₀ / Q_G.',
    'guete-mal': 'Dein Wert ({w}) passt zu B = f₀ · Q_G. Die Bandbreite ist f₀ geteilt durch Q_G.',
    'keine-ueberhoehung': 'Dein Wert ({w}) ist die Quellenspannung selbst. Bei Resonanz begrenzt nur R den Strom; an der Spule liegt U_L = U · X_L / R. Ist X_L größer als R (Q_G > 1), ist das mehr als die Quellenspannung (Spannungsüberhöhung).',
    'strom-statt-spannung': 'Dein Wert ({w}) ist der Strom I = U / R bei Resonanz. Gefragt ist die Spannung an der Spule: U_L = I · X_L.',
    'u-am-widerstand': 'Dein Wert ({w}) passt zur Spannung am Widerstand. Beim Siebglied wird am Kondensator abgegriffen: U₂ = U₁ · X_C / Z.',
    'bode-vorzeichen': 'Dein Wert ({w}) hat das falsche Vorzeichen: Ein Tiefpass dämpft oberhalb von f_g, das Dämpfungsmaß ist negativ.',
    'ueb-kehrwert': 'Dein Wert ({w}) ist der Kehrwert: Das Übersetzungsverhältnis ist ü = N₁ / N₂ (Primärseite durch Sekundärseite).',
    'strom-gleich': 'Dein Wert ({w}) ist der Sekundärstrom I₂ selbst. Am Transformator ändert sich der Strom im umgekehrten Verhältnis der Windungszahlen.'
  });
  const K1 = { pi: Math.PI, sq2: SQ2, sq3: SQ3 }, K2 = { pi: 3.14, sq2: 1.41, sq3: 1.73 }, K3 = { pi: 3.1416, sq2: 1.414, sq3: 1.732 };
  const FREQ = [50, 100, 1000, 10000];
  function pick(r, arr) { return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))]; }
  const LS = [1e-3, 2.2e-3, 10e-3, 47e-3, 0.1, 0.25, 0.5, 1], CS = [100e-9, 220e-9, 470e-9, 1e-6, 2.2e-6, 4.7e-6, 10e-6, 47e-6];
  const LP = [100e-6, 220e-6, 470e-6, 1e-3, 10e-3, 50e-3], CP = [100e-12, 470e-12, 10e-9, 100e-9, 470e-9, 1e-6];
  const RS = [22, 47, 100, 220, 470, 1000, 2200, 4700, 10000];
  function fe(x, u) { return fmtEng(x, u); }
  const D = {};
  D.eff = { unit: 'V', tol: 0.03, what: 'Effektivwert U',
    gen: function (r) { return { ampl: pick(r, [12, 24, 48, 100, 230, 325]) }; },
    q: function (g) { return 'Eine Sinusspannung hat den Scheitelwert û = ' + fe(g.ampl, 'V') + '. Berechne den Effektivwert U.'; },
    val: function (g) { return FN('eff')(g.ampl); }, alt: function (g, k) { return g.ampl / k.sq2; },
    steps: function (g, v) { return ['Für eine Sinusgröße gilt U = û / √2.', 'U = ' + fe(g.ampl, 'V') + ' / √2 = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['wurzel-vergessen', g.ampl], ['halbiert', g.ampl / 2]]; } };
  D.zeitversatz = { unit: 's', tol: 0.03, what: 'Zeitversatz Δt',
    gen: function (r) { return { f: pick(r, FREQ), phi: pick(r, [30, 45, 60, 90, 120, 180]) }; },
    q: function (g) { return 'Zwei Sinusspannungen mit f = ' + fe(g.f, 'Hz') + ' sind um φ = ' + fmt(g.phi, 0) + '° gegeneinander verschoben. Berechne den Zeitversatz Δt.'; },
    val: function (g) { return FN('zeitversatz')(g.f, g.phi); }, alt: function () { return null; },
    steps: function (g, v) { const T = FN('periode')(g.f); return ['Periodendauer T = 1 / f = ' + fe(T, 's'), 'Δt = φ / 360° · T = ' + fmt(g.phi, 0) + '° / 360° · ' + fe(T, 's') + ' = ' + fe(v, 's')]; },
    wrong: function (g) { return [['grad-nicht-umgerechnet', g.phi / g.f], ['bogenmass', g.phi * RAD / g.f], ['periode-statt-versatz', 1 / g.f]]; } };
  D.xl = { unit: 'Ω', tol: 0.03, what: 'X_L',
    gen: function (r) { return { f: pick(r, FREQ), l: pick(r, LS) }; },
    q: function (g) { return 'Berechne den Blindwiderstand X_L einer Spule mit L = ' + fe(g.l, 'H') + ' bei f = ' + fe(g.f, 'Hz') + '.'; },
    val: function (g) { return FN('xl')(g.f, g.l); }, alt: function (g, k) { return 2 * k.pi * g.f * g.l; },
    steps: function (g, v) { return ['ω = 2π · f = ' + fmt(FN('omega')(g.f), 4) + ' 1/s', 'X_L = ω · L = ' + fmt(FN('omega')(g.f), 4) + ' 1/s · ' + fe(g.l, 'H') + ' = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['omega-vergessen', g.f * g.l]]; } };
  D.xc = { unit: 'Ω', tol: 0.03, what: 'X_C',
    gen: function (r) { return { f: pick(r, FREQ), c: pick(r, CS) }; },
    q: function (g) { return 'Berechne den Blindwiderstand X_C eines Kondensators mit C = ' + fe(g.c, 'F') + ' bei f = ' + fe(g.f, 'Hz') + '.'; },
    val: function (g) { return FN('xc')(g.f, g.c); }, alt: function (g, k) { return 1 / (2 * k.pi * g.f * g.c); },
    steps: function (g, v) { return ['ω = 2π · f = ' + fmt(FN('omega')(g.f), 4) + ' 1/s', 'X_C = 1 / (ω · C) = 1 / (' + fmt(FN('omega')(g.f), 4) + ' 1/s · ' + fe(g.c, 'F') + ') = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['omega-vergessen', 1 / (g.f * g.c)], ['kehrwert-vergessen', 2 * Math.PI * g.f * g.c]]; } };
  function zParts(g, k) { const w = k ? 2 * k.pi * g.f : TWO_PI * g.f; return { xl: g.l ? w * g.l : 0, xc: g.c ? 1 / (w * g.c) : 0 }; }
  D.zReihe = { unit: 'Ω', tol: 0.03, what: 'Z',
    gen: function (r) { const ab = pick(r, ['RL', 'RC', 'RLC']); return { aufbau: ab, r: pick(r, RS), l: ab.indexOf('L') >= 0 ? pick(r, LS) : 0, c: ab.indexOf('C') >= 0 ? pick(r, CS) : 0, f: pick(r, [50, 100, 1000]) }; },
    q: function (g) { return 'Berechne den Scheinwiderstand Z (Impedanz) einer Reihenschaltung aus R = ' + fe(g.r, 'Ω') + (g.l ? ', L = ' + fe(g.l, 'H') : '') + (g.c ? ', C = ' + fe(g.c, 'F') : '') + ' bei f = ' + fe(g.f, 'Hz') + '.'; },
    val: function (g) { const p = zParts(g); return FN('zReihe')(g.r, p.xl, p.xc); },
    alt: function (g, k) { const p = zParts(g, k); return Math.hypot(g.r, p.xl - p.xc); },
    steps: function (g, v) { const p = zParts(g); const s = []; if (g.l) s.push('X_L = 2π · f · L = ' + fe(p.xl, 'Ω')); if (g.c) s.push('X_C = 1 / (2π · f · C) = ' + fe(p.xc, 'Ω')); s.push('Z = √(R² + (X_L − X_C)²) = ' + fe(v, 'Ω')); return s; },
    wrong: function (g) { const p = zParts(g), q = { xl: g.l ? g.f * g.l : 0, xc: g.c ? 1 / (g.f * g.c) : 0 }; return [['z-addiert', g.r + Math.abs(p.xl - p.xc)], ['omega-vergessen', Math.hypot(g.r, q.xl - q.xc)]]; } };
  D.iReihe = { unit: 'A', tol: 0.03, what: 'I',
    gen: function (r) { return { u: pick(r, [12, 24, 230]), r: pick(r, RS), l: pick(r, LS), f: pick(r, [50, 100, 1000]) }; },
    q: function (g) { return 'Eine Spule mit R = ' + fe(g.r, 'Ω') + ' und L = ' + fe(g.l, 'H') + ' liegt an ' + fe(g.u, 'V') + ' bei f = ' + fe(g.f, 'Hz') + '. Berechne den Strom I.'; },
    val: function (g) { return FN('iReihe')(g.u, g.r, FN('xl')(g.f, g.l), 0); },
    alt: function (g, k) { return g.u / Math.hypot(g.r, 2 * k.pi * g.f * g.l); },
    steps: function (g, v) { const xl = FN('xl')(g.f, g.l), z = FN('zReihe')(g.r, xl, 0); return ['X_L = 2π · f · L = ' + fe(xl, 'Ω'), 'Z = √(R² + X_L²) = ' + fe(z, 'Ω'), 'I = U / Z = ' + fe(g.u, 'V') + ' / ' + fe(z, 'Ω') + ' = ' + fe(v, 'A')]; },
    wrong: function (g) { const xl = FN('xl')(g.f, g.l); return [['omega-vergessen', g.u / Math.hypot(g.r, g.f * g.l)], ['z-addiert', g.u / (g.r + xl)]]; } };
  D.uGeom = { unit: 'V', tol: 0.03, what: 'U',
    gen: function (r) { return { ur: pick(r, [5, 10, 15, 20, 30]), ul: pick(r, [10, 20, 30, 40, 60]), uc: pick(r, [5, 10, 15, 25]) }; },
    q: function (g) { return 'In einer Reihenschaltung aus R, L und C werden U_R = ' + fe(g.ur, 'V') + ', U_L = ' + fe(g.ul, 'V') + ' und U_C = ' + fe(g.uc, 'V') + ' gemessen. Berechne die Gesamtspannung U.'; },
    val: function (g) { return FN('uGeom')(g.ur, g.ul, g.uc); }, alt: function () { return null; },
    steps: function (g, v) { return ['U_L und U_C sind gegenphasig: U_X = |U_L − U_C| = ' + fe(Math.abs(g.ul - g.uc), 'V'), 'U = √(U_R² + U_X²) = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['u-addiert', g.ur + g.ul + g.uc], ['u-addiert', g.ur + Math.abs(g.ul - g.uc)]]; } };
  D.spule = { unit: 'Ω', tol: 0.03, what: 'X_L',
    gen: function (r) { const u = pick(r, [24, 48, 100, 230]), i = pick(r, [0.25, 0.5, 1, 2, 2.5]), rho = pick(r, [0.2, 0.3, 0.4, 0.5, 0.6]); return { u: u, i: i, p: Math.max(1, Math.round(u * i * rho)) }; },
    q: function (g) { return 'Eine Spule (R und L in Reihe) liegt an ' + fe(g.u, 'V') + '. Ein Strommesser zeigt ' + fe(g.i, 'A') + ', ein Leistungsmesser ' + fe(g.p, 'W') + '. Berechne den Blindwiderstand X_L.'; },
    val: function (g) { return FN('spule')(g.u, g.i, g.p); }, alt: function () { return null; },
    steps: function (g, v) { return ['Z = U / I = ' + fe(g.u / g.i, 'Ω'), 'R = P / I² = ' + fe(g.p / (g.i * g.i), 'Ω'), 'X_L = √(Z² − R²) = ' + fe(v, 'Ω')]; },
    wrong: function (g) { return [['z-statt-xl', g.u / g.i], ['z-minus-r', g.u / g.i - g.p / (g.i * g.i)]]; } };
  D.qUIphi = { unit: 'var', tol: 0.03, what: 'Q',
    gen: function (r) { return { u: pick(r, [24, 100, 230, 400]), i: pick(r, [0.5, 1, 2, 5, 10]), phi: pick(r, [30, 45, 60]) }; },
    q: function (g) { return 'Ein Verbraucher nimmt bei U = ' + fe(g.u, 'V') + ' den Strom I = ' + fe(g.i, 'A') + ' auf; φ = ' + fmt(g.phi, 0) + '°. Berechne die Blindleistung Q.'; },
    val: function (g) { return FN('qUIphi')(g.u, g.i, g.phi); }, alt: function () { return null; },
    steps: function (g, v) { return ['S = U · I = ' + fe(g.u * g.i, 'VA'), 'Q = S · sin φ = ' + fe(g.u * g.i, 'VA') + ' · ' + fmt(Math.sin(g.phi * RAD), 4) + ' = ' + fe(v, 'var')]; },
    wrong: function (g) { return [['cos-sin-vertauscht', g.u * g.i * Math.cos(g.phi * RAD)]]; } };
  D.qAusSP = { unit: 'var', tol: 0.03, what: 'Q',
    gen: function (r) { const u = pick(r, [24, 48, 100, 230]), i = pick(r, [0.25, 0.5, 1, 2]), rho = pick(r, [0.3, 0.4, 0.5, 0.6, 0.7]); return { u: u, i: i, p: Number((u * i * rho).toFixed(1)) }; },
    q: function (g) { return 'Eine Spule wird mit ' + fe(g.u, 'V') + ' betrieben. Strommesser: ' + fe(g.i, 'A') + ', Leistungsmesser: ' + fe(g.p, 'W') + '. Berechne die Blindleistung Q.'; },
    val: function (g) { return FN('qAusSP')(g.u * g.i, g.p); }, alt: function () { return null; },
    steps: function (g, v) { return ['S = U · I = ' + fe(g.u * g.i, 'VA'), 'Q = √(S² − P²) = ' + fe(v, 'var')]; },
    wrong: function (g) { const s = g.u * g.i; return [['s-minus-p', s - g.p], ['pythagoras-plus', Math.hypot(s, g.p)]]; } };
  D.sAusPcos = { unit: 'VA', tol: 0.03, what: 'S',
    gen: function (r) { return { p: pick(r, [500, 1000, 1500, 2000, 3200, 5000]), cosphi: pick(r, [0.6, 0.7, 0.8, 0.85, 0.9]) }; },
    q: function (g) { return 'Ein Verbraucher nimmt die Wirkleistung P = ' + fe(g.p, 'W') + ' bei cos φ = ' + fmt(g.cosphi, 2) + ' auf. Berechne die Scheinleistung S.'; },
    val: function (g) { return need(power.fromPcos(g.p, g.cosphi)).s; }, alt: function () { return null; },
    steps: function (g, v) { return ['S = P / cos φ = ' + fe(g.p, 'W') + ' / ' + fmt(g.cosphi, 2) + ' = ' + fe(v, 'VA')]; },
    wrong: function (g) { return [['p-gleich-s', g.p], ['cos-multipliziert', g.p * g.cosphi]]; } };
  D.cKomp = { unit: 'F', tol: 0.03, what: 'C',
    gen: function (r) { return { p: pick(r, [1000, 2000, 3200, 5000, 7500]), cos1: pick(r, [0.6, 0.7, 0.75, 0.8]), cos2: pick(r, [0.9, 0.95]), u: 230, f: 50 }; },
    q: function (g) { return 'Eine Last (P = ' + fe(g.p, 'W') + ', cos φ = ' + fmt(g.cos1, 2) + ') liegt an ' + fe(g.u, 'V') + ' / ' + fe(g.f, 'Hz') + '. Berechne die Kapazität C, die parallel zur Last den Leistungsfaktor auf cos φ = ' + fmt(g.cos2, 2) + ' bringt.'; },
    val: function (g) { return FN('cKomp')(g.p, g.cos1, g.cos2, g.u, g.f); },
    alt: function (g, k) { const q = g.p * (Math.tan(Math.acos(g.cos1)) - Math.tan(Math.acos(g.cos2))); return q / (2 * k.pi * g.f * g.u * g.u); },
    steps: function (g, v) { const qc = FN('qc')(g.p, g.cos1, g.cos2); return ['Q_C = P · (tan φ₁ − tan φ₂) = ' + fe(qc, 'var'), 'C = Q_C / (ω · U²) = ' + fe(qc, 'var') + ' / (' + fmt(FN('omega')(g.f), 4) + ' 1/s · (' + fe(g.u, 'V') + ')²) = ' + fe(v, 'F')]; },
    wrong: function (g) { const qc = FN('qc')(g.p, g.cos1, g.cos2), qw = Math.abs(g.p * (g.cos1 - g.cos2)); return [['omega-vergessen', qc / (g.f * g.u * g.u)], ['tan-cos-vertauscht', qw / (TWO_PI * g.f * g.u * g.u)]]; },
    special: function (g, a, v) {
      const cm = comp.cMax({ p: g.p, cos1: g.cos1, u: g.u, f: g.f });
      if (isFinite(cm) && a > cm * (1 + 1e-9) && v < cm) {
        const af = comp.after({ p: g.p, cos1: g.cos1, u: g.u, f: g.f, c: a });
        if (af.ok) return { id: 'komp-ueber', text: TEXTS.get('komp-ueber', { w: fe(a, 'F'), cmax: fe(cm, 'F'), cos: fmt(af.cos, 3) }) };
      }
      return null;
    } };
  D.f0 = { unit: 'Hz', tol: 0.02, what: 'f₀',
    gen: function (r) { return { l: pick(r, LP), c: pick(r, CP) }; },
    q: function (g) { return 'Ein Schwingkreis besteht aus L = ' + fe(g.l, 'H') + ' und C = ' + fe(g.c, 'F') + '. Berechne die Resonanzfrequenz f₀.'; },
    val: function (g) { return FN('f0')(g.l, g.c); }, alt: function (g, k) { return 1 / (2 * k.pi * Math.sqrt(g.l * g.c)); },
    steps: function (g, v) { return ['√(L · C) = ' + fmtEng(Math.sqrt(g.l * g.c), 's'), 'f₀ = 1 / (2π · √(L · C)) = ' + fe(v, 'Hz')]; },
    wrong: function (g) { return [['omega-vergessen', 1 / Math.sqrt(g.l * g.c)], ['wurzel-vergessen-f0', 1 / (TWO_PI * g.l * g.c)]]; } };
  D.cAusF0 = { unit: 'F', tol: 0.03, what: 'C',
    gen: function (r) { return { l: pick(r, [0.25, 0.1, 1, 10e-3, 50e-3]), f0: pick(r, [50, 100, 1000, 10000, 20000]) }; },
    q: function (g) { return 'Ein Reihenschwingkreis mit L = ' + fe(g.l, 'H') + ' soll bei f₀ = ' + fe(g.f0, 'Hz') + ' in Resonanz sein. Berechne die Kapazität C.'; },
    val: function (g) { return FN('cAusF0')(g.l, g.f0); }, alt: function (g, k) { return 1 / (Math.pow(2 * k.pi * g.f0, 2) * g.l); },
    steps: function (g, v) { return ['ω₀ = 2π · f₀ = ' + fmt(FN('omega')(g.f0), 4) + ' 1/s', 'C = 1 / (ω₀² · L) = ' + fe(v, 'F')]; },
    wrong: function (g) { return [['omega-vergessen', 1 / (g.f0 * g.f0 * g.l)], ['quadrat-vergessen', 1 / (TWO_PI * g.f0 * g.l)]]; } };
  D.lAusF0 = { unit: 'H', tol: 0.03, what: 'L',
    gen: function (r) { return { c: pick(r, [10e-9, 100e-9, 470e-9, 1e-6, 4.7e-6, 10e-6]), f0: pick(r, [50, 100, 1000, 10000, 20000]) }; },
    q: function (g) { return 'Ein Parallelschwingkreis mit C = ' + fe(g.c, 'F') + ' soll als Sperrkreis für f₀ = ' + fe(g.f0, 'Hz') + ' wirken. Berechne die Induktivität L.'; },
    val: function (g) { return FN('lAusF0')(g.c, g.f0); }, alt: function (g, k) { return 1 / (Math.pow(2 * k.pi * g.f0, 2) * g.c); },
    steps: function (g, v) { return ['ω₀ = 2π · f₀ = ' + fmt(FN('omega')(g.f0), 4) + ' 1/s', 'L = 1 / (ω₀² · C) = ' + fe(v, 'H')]; },
    wrong: function (g) { return [['omega-vergessen', 1 / (g.f0 * g.f0 * g.c)], ['quadrat-vergessen', 1 / (TWO_PI * g.f0 * g.c)]]; } };
  D.gueteBandbreite = { unit: 'Hz', tol: 0.03, what: 'B',
    gen: function (r) { return { l: pick(r, [1e-3, 2.2e-3, 10e-3]), c: pick(r, [10e-9, 47e-9, 100e-9, 470e-9]), r: pick(r, [4.7, 10, 22]) }; },
    q: function (g) { return 'Ein Reihenschwingkreis hat L = ' + fe(g.l, 'H') + ', C = ' + fe(g.c, 'F') + ' und R = ' + fe(g.r, 'Ω') + '. Berechne die Bandbreite B.'; },
    val: function (g) { return need(res.series({ l: g.l, c: g.c, r: g.r })).b; },
    alt: function (g, k) { const f0 = 1 / (2 * k.pi * Math.sqrt(g.l * g.c)); return f0 * g.r / Math.sqrt(g.l / g.c); },
    steps: function (g, v) { const s = need(res.series({ l: g.l, c: g.c, r: g.r })); return ['f₀ = 1 / (2π · √(L · C)) = ' + fe(s.f0, 'Hz'), 'Z₀ = √(L / C) = ' + fe(s.z0, 'Ω'), 'Q_G = Z₀ / R = ' + fmt(s.qg, 3), 'B = f₀ / Q_G = ' + fe(v, 'Hz')]; },
    wrong: function (g) { const s = need(res.series({ l: g.l, c: g.c, r: g.r })); return [['guete-statt-b', s.qg], ['f0-statt-b', s.f0], ['guete-mal', s.f0 * s.qg]]; } };
  D.uLReso = { unit: 'V', tol: 0.03, what: 'U_L',
    gen: function (r) { return { u: pick(r, [12, 24, 230]), r: pick(r, [10, 22, 40, 100]), l: pick(r, [0.1, 0.2, 0.25]), f: pick(r, [50, 100]) }; },
    q: function (g) { return 'Ein Reihenschwingkreis (R = ' + fe(g.r, 'Ω') + ', L = ' + fe(g.l, 'H') + ') liegt an ' + fe(g.u, 'V') + ' und f = ' + fe(g.f, 'Hz') + '; die Kapazität ist so gewählt, dass Resonanz herrscht. Berechne die Spannung U_L an der Spule.'; },
    val: function (g) { return FN('uLReso')(g.u, g.r, FN('xl')(g.f, g.l)); },
    alt: function (g, k) { return g.u / g.r * 2 * k.pi * g.f * g.l; },
    steps: function (g, v) { const xl = FN('xl')(g.f, g.l); return ['Bei Resonanz begrenzt nur R den Strom: I = U / R = ' + fe(g.u / g.r, 'A'), 'X_L = 2π · f · L = ' + fe(xl, 'Ω'), 'U_L = I · X_L = ' + fe(v, 'V')]; },
    wrong: function (g) { return [['keine-ueberhoehung', g.u], ['omega-vergessen', g.u / g.r * g.f * g.l], ['strom-statt-spannung', g.u / g.r]]; } };
  D.fgRC = { unit: 'Hz', tol: 0.02, what: 'f_g',
    gen: function (r) { return { r: pick(r, [1e3, 2.2e3, 4.7e3, 10e3, 15e3, 100e3]), c: pick(r, [10e-9, 47e-9, 100e-9, 220e-9, 1e-6]) }; },
    q: function (g) { return 'Ein RC-Glied hat R = ' + fe(g.r, 'Ω') + ' und C = ' + fe(g.c, 'F') + '. Berechne die Grenzfrequenz f_g.'; },
    val: function (g) { return FN('fgRC')(g.r, g.c); }, alt: function (g, k) { return 1 / (2 * k.pi * g.r * g.c); },
    steps: function (g, v) { return ['τ = R · C = ' + fe(FN('tau')(g.r, g.c), 's'), 'f_g = 1 / (2π · R · C) = ' + fe(v, 'Hz')]; },
    wrong: function (g) { return [['fg-f', 1 / (g.r * g.c)]]; } };
  D.cFuerFg = { unit: 'F', tol: 0.03, what: 'C',
    gen: function (r) { return { r: pick(r, [470, 1e3, 2.2e3, 4.7e3, 10e3]), fg: pick(r, [50, 100, 250, 1000, 5000]) }; },
    q: function (g) { return 'Ein RC-Hochpass mit R = ' + fe(g.r, 'Ω') + ' soll die Grenzfrequenz f_g = ' + fe(g.fg, 'Hz') + ' haben. Berechne die Kapazität C.'; },
    val: function (g) { return need(filter.design({ fg: g.fg, r: g.r })).c; }, alt: function (g, k) { return 1 / (2 * k.pi * g.fg * g.r); },
    steps: function (g, v) { return ['f_g = 1 / (2π · R · C), umgestellt: C = 1 / (2π · f_g · R)', 'C = 1 / (2π · ' + fe(g.fg, 'Hz') + ' · ' + fe(g.r, 'Ω') + ') = ' + fe(v, 'F')]; },
    wrong: function (g) { return [['fg-f', 1 / (g.fg * g.r)]]; } };
  D.siebglied = { unit: 'V', tol: 0.03, what: 'U₂',
    gen: function (r) { return { r: pick(r, [100, 220, 470, 1000]), c: pick(r, [1e-6, 2.2e-6, 4.7e-6, 10e-6]), f: pick(r, [50, 100, 1000]), u1: pick(r, [4, 12, 24]) }; },
    q: function (g) { return 'Ein RC-Siebglied (R = ' + fe(g.r, 'Ω') + ' in Reihe, C = ' + fe(g.c, 'F') + ' nach Masse, Ausgang am Kondensator, Last hochohmig) bekommt ' + fe(g.u1, 'V') + ' bei f = ' + fe(g.f, 'Hz') + '. Berechne die Ausgangs-Wechselspannung U₂.'; },
    val: function (g) { return need(filter.sieve({ r: g.r, c: g.c, f: g.f, u1: g.u1 })).u2; },
    alt: function (g, k) { const xc = 1 / (2 * k.pi * g.f * g.c); return g.u1 * xc / Math.hypot(g.r, xc); },
    steps: function (g, v) { const s = need(filter.sieve({ r: g.r, c: g.c, f: g.f, u1: g.u1 })); return ['X_C = 1 / (2π · f · C) = ' + fe(s.xc, 'Ω'), 'Z = √(R² + X_C²) = ' + fe(s.z, 'Ω'), 'U₂ = U₁ · X_C / Z = ' + fe(v, 'V')]; },
    wrong: function (g) { const s = need(filter.sieve({ r: g.r, c: g.c, f: g.f, u1: g.u1 })), xw = 1 / (g.f * g.c); return [['z-addiert', g.u1 * s.xc / (g.r + s.xc)], ['omega-vergessen', g.u1 * xw / Math.hypot(g.r, xw)], ['u-am-widerstand', g.u1 * g.r / s.z]]; } };
  D.dbDekade = { unit: 'dB', tol: 0.03, what: 'a',
    gen: function (r) { const rr = pick(r, [1e3, 4.7e3, 10e3]), cc = pick(r, [10e-9, 100e-9]); return { r: rr, c: cc, dek: pick(r, [1, 2]), fg: FN('fgRC')(rr, cc) }; },
    q: function (g) { return 'Ein RC-Tiefpass hat R = ' + fe(g.r, 'Ω') + ' und C = ' + fe(g.c, 'F') + ' (f_g = ' + fe(g.fg, 'Hz') + '). Berechne das Dämpfungsmaß a bei f = ' + fe(g.fg * Math.pow(10, g.dek), 'Hz') + ' und gib es als negative Zahl in dB an.'; },
    val: function (g) { return FN('dekade')(Math.pow(10, g.dek)); }, alt: function (g) { return -20 * g.dek; },
    steps: function (g, v) { return ['f / f_g = ' + fmt(Math.pow(10, g.dek), 0), '|H| = 1 / √(1 + (f / f_g)²) = ' + fmt(1 / Math.sqrt(1 + Math.pow(10, 2 * g.dek)), 5), 'a = 20 · lg |H| = ' + fmt(v, 2) + ' dB (Asymptote: −20 dB je Dekade, hier ' + fmt(-20 * g.dek, 0) + ' dB)']; },
    wrong: function (g, v) { return [['bode-dekade', FN('dB')(1 / Math.SQRT2), { a: fmt(v, 2), x: fmt(Math.pow(10, g.dek), 0) }], ['bode-vorzeichen', -v]]; } };
  D.ueb = { unit: '', tol: 0.03, what: 'ü',
    gen: function (r) { return { n1: pick(r, [1150, 2300, 500, 1000]), n2: pick(r, [69, 115, 50, 100, 23]) }; },
    q: function (g) { return 'Ein Transformator hat auf der Primärseite N₁ = ' + fmt(g.n1, 0) + ' und auf der Sekundärseite N₂ = ' + fmt(g.n2, 0) + ' Windungen. Berechne das Übersetzungsverhältnis ü.'; },
    val: function (g) { return FN('ueb')(g.n1, g.n2); }, alt: function () { return null; },
    steps: function (g, v) { return ['ü = N₁ / N₂ = ' + fmt(g.n1, 0) + ' / ' + fmt(g.n2, 0) + ' = ' + fmt(v, 4)]; },
    wrong: function (g) { return [['ueb-kehrwert', g.n2 / g.n1]]; } };
  D.i1 = { unit: 'A', tol: 0.03, what: 'I₁',
    gen: function (r) { return { n1: pick(r, [1150, 2300, 500, 1000]), n2: pick(r, [69, 115, 50, 100, 23]), i2: pick(r, [0.5, 1, 2, 2.5, 5]) }; },
    q: function (g) { return 'Ein idealer Transformator hat primär N₁ = ' + fmt(g.n1, 0) + ' und sekundär N₂ = ' + fmt(g.n2, 0) + ' Windungen. Sekundärseitig fließen ' + fe(g.i2, 'A') + '. Berechne den Primärstrom I₁.'; },
    val: function (g) { return FN('i1')(g.i2, g.n1, g.n2); }, alt: function () { return null; },
    steps: function (g, v) { return ['I₁ / I₂ = N₂ / N₁', 'I₁ = I₂ · N₂ / N₁ = ' + fe(g.i2, 'A') + ' · ' + fmt(g.n2, 0) + ' / ' + fmt(g.n1, 0) + ' = ' + fe(v, 'A')]; },
    wrong: function (g) { return [['trafo-i', g.i2 * g.n1 / g.n2], ['strom-gleich', g.i2]]; } };
  D.pDrehstrom = { unit: 'W', tol: 0.03, what: 'P',
    gen: function (r) { return { ul: 400, il: pick(r, [5, 10, 16, 20, 32]), cosphi: pick(r, [0.7, 0.8, 0.85, 0.9]) }; },
    q: function (g) { return 'Ein symmetrischer Drehstromverbraucher nimmt am Netz mit U_L = ' + fe(g.ul, 'V') + ' den Leiterstrom I_L = ' + fe(g.il, 'A') + ' bei cos φ = ' + fmt(g.cosphi, 2) + ' auf. Berechne die Wirkleistung P (Übungsnetz, 400 V ist ein Übungswert).'; },
    val: function (g) { return FN('pDrehstrom')(g.ul, g.il, g.cosphi); }, alt: function (g, k) { return k.sq3 * g.ul * g.il * g.cosphi; },
    steps: function (g, v) { return ['S = √3 · U_L · I_L = ' + fe(SQ3 * g.ul * g.il, 'VA'), 'P = S · cos φ = ' + fe(v, 'W')]; },
    wrong: function (g) { return [['stern-dreieck', g.ul * g.il * g.cosphi], ['stern-dreieck', 3 * g.ul * g.il * g.cosphi], ['p-gleich-s', SQ3 * g.ul * g.il]]; } };
  /* nur fuer diagnose (keine Aufgabenart) */
  const DH = {};
  DH.phiReihe = { unit: '°', tol: 0.03, what: 'φ',
    val: function (g) { const p = need(rlc.series({ u: 1, f: g.f, r: g.r, l: g.l, c: g.c })); return p.phi; },
    wrong: function (g, v) { const p = need(rlc.series({ u: 1, f: g.f, r: g.r, l: g.l, c: g.c })); return Math.abs(v) > 1 ? [['xl-xc-vertauscht', -v, { xl: fe(p.xl, 'Ω'), xc: fe(p.xc, 'Ω') }]] : []; } };
  DH.qAusPcos = { unit: 'var', tol: 0.03, what: 'Q',
    val: function (g) { return need(power.fromPcos(g.p, g.cosphi)).q; },
    wrong: function (g) { return [['q-aus-p', g.p * Math.sin(Math.acos(g.cosphi))]]; } };
  const KINDS = Object.keys(D);
  const PREFS = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function dispOf(v, unit) {
    if (unit === '' || unit === 'dB' || unit === '°' || !isFinite(v) || v === 0) return { value: v, unit: unit, factor: 1 };
    const a = Math.abs(v);
    let p = PREFS[PREFS.length - 1];
    for (let i = 0; i < PREFS.length; i++) if (a >= PREFS[i][0] * 0.99995) { p = PREFS[i]; break; }
    return { value: v / p[0], unit: p[1] + unit, factor: p[0] };
  }
  /* Antwortwerte aus der Aufgabe: value (SI), alt (gerundete Konstanten), wrong (Fehlerbilder mit Text) */
  function build(def, g) {
    const value = def.val(g);
    if (!fin(value)) V('Die Aufgabe hat keinen gültigen Wert.');
    const alt = [];
    if (def.alt) [K2, K3].forEach(function (k) { const a = def.alt(g, k); if (a !== null && a !== undefined && fin(a) && Math.abs(a - value) > 1e-12 * Math.abs(value) && !alt.some(function (x) { return Math.abs(x - a) <= 1e-12 * Math.abs(a); })) alt.push(a); });
    const wrong = [];
    (def.wrong ? def.wrong(g, value) : []).forEach(function (w) {
      const wv = w[1];
      if (!fin(wv)) return;
      if (Math.abs(wv - value) <= 2 * def.tol * Math.abs(value)) return;          /* Gegenprobe: unterscheidbar vom richtigen Ergebnis */
      if (wrong.some(function (x) { return Math.abs(x.value - wv) <= 1e-9 * Math.abs(wv); })) return;   /* gleiche Zahl, erstes Fehlerbild gilt */
      const vars = Object.assign({ w: fmUnitText(wv, def.unit) }, w[2] || {});
      wrong.push({ id: w[0], value: wv, text: TEXTS.get(w[0], vars) });
    });
    return { value: value, alt: alt, wrong: wrong, disp: dispOf(value, def.unit) };
  }
  const BASEU = { 'Ohm': 'Ω', 'ohm': 'Ω' };
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'var', 'VA', 's', 'S', 'dB', '°'];
  function baseUnit(u) {
    if (!u) return '';
    if (ULIST.indexOf(u) >= 0) return BASEU[u] || u;
    if (u.length >= 2 && 'TGMkKmµμunp'.indexOf(u[0]) >= 0 && ULIST.indexOf(u.slice(1)) >= 0) return BASEU[u.slice(1)] || u.slice(1);
    return '';
  }
  function checkAnswer(def, built, tol, input) {
    const q = W.parseQty(input);
    if (!q || !fin(q.v)) return { ok: false, why: 'keine-zahl', text: TEXTS.keineZahl };
    const unit = def.unit;
    if (q.hasUnit && unit) { const b = baseUnit(q.unit); if (b && b !== unit) return { ok: false, why: 'einheit', text: TEXTS.get('einheit', { gesucht: unit }) }; }
    const cands = [q.v];
    if (!q.hasUnit && built.disp.factor !== 1) cands.push(q.v * built.disp.factor);
    const refs = [built.value].concat(built.alt);
    const close = function (a, b, t) { return Math.abs(a - b) <= t * Math.abs(b) + 1e-300; };
    for (let i = 0; i < cands.length; i++) for (let j = 0; j < refs.length; j++) if (close(cands[i], refs[j], tol)) return { ok: true, why: 'richtig', text: TEXTS.get('richtig', { was: def.what, wert: fmUnitText(built.value, unit) }) };
    let a = cands[0];
    if (cands.length > 1 && built.value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / built.value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / built.value))); if (l1 < l0) a = cands[1]; }
    for (let k = 0; k < built.wrong.length; k++) {
      const w = built.wrong[k];
      for (let i = 0; i < cands.length; i++) if (close(cands[i], w.value, tol)) return { ok: false, why: w.id, text: w.text };
    }
    return diagGeneric(def, built, tol, a);
  }
  /* Faktor-Wurzel-Hinweis nur fuer die zugehoerigen Aufgabenarten (Review v22 M4), sonst neutral */
  function wurzelText(kind, w) {
    const ok = w === 3 ? kind === 'pDrehstrom' : ['eff', 'zeitversatz', 'uGeom', 'fgRC', 'cFuerFg', 'siebglied', 'dbDekade'].indexOf(kind) >= 0;
    return ok ? TEXTS.get(w === 3 ? 'wurzel3' : 'wurzel') : TEXTS.get('wurzel-allg', { f: w === 3 ? '√3' : '√2' });
  }
  function diagGeneric(def, built, tol, a) {
    const v = built.value;
    if (def.special && def.g) { const sp = def.special(def.g, a, v); if (sp) return { ok: false, why: sp.id, text: sp.text }; }
    if (a !== 0 && v !== 0 && ((a > 0) === (v > 0))) {
      const r = a / v, lr = lg(Math.abs(r));
      if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) return { ok: false, why: 'vorsatz', text: TEXTS.get('vorsatz', { faktor: Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')' }) };
      if (Math.abs(r / TWO_PI - 1) < 0.03 || Math.abs(r * TWO_PI - 1) < 0.03) return { ok: false, why: 'omega-vergessen', text: TEXTS.get('omega-vergessen', { w: fmUnitText(a, def.unit) }) };
      if (Math.abs(r / SQ2 - 1) < 0.03 || Math.abs(r * SQ2 - 1) < 0.03) return { ok: false, why: 'wurzel', text: wurzelText(def.kind, 2) };
      if (Math.abs(r / SQ3 - 1) < 0.03 || Math.abs(r * SQ3 - 1) < 0.03) return { ok: false, why: 'wurzel3', text: wurzelText(def.kind, 3) };
      if (r < 1) return { ok: false, why: 'zu-klein', text: TEXTS.get('zu-klein', { pct: fmt((1 - r) * 100, 0) }) };
      return { ok: false, why: 'zu-gross', text: TEXTS.get('zu-gross', { pct: fmt((r - 1) * 100, 0) }) };
    }
    if (a !== 0 && v !== 0) return { ok: false, why: 'vorzeichen', text: TEXTS.get('vorzeichen') };
    return a < v ? { ok: false, why: 'zu-klein', text: TEXTS.get('zu-klein', { pct: '100' }) } : { ok: false, why: 'zu-gross', text: TEXTS.get('zu-gross', { pct: fmt(Math.abs(a - v) / Math.max(Math.abs(v), 1e-300) * 100, 0) }) };
  }
  Object.keys(D).forEach(function (k) { D[k].kind = k; });
  const exercise = function (kind, seed) {
    try {
      const k = String(kind);
      const def0 = D[k];
      if (!def0) return fail('Diese Aufgabenart gibt es nicht: ' + k + '.');
      const sd = seed === undefined || seed === null ? 1 : num(seed, NaN);
      if (!isFinite(sd) || Math.abs(sd) > 1e9) return fail('Der Startwert (seed) muss eine Zahl sein.');
      const g = def0.gen(W.rng(sd));
      const def = Object.assign({}, def0, { g: g });
      const b = build(def, g);
      const tol = def.tol;
      const answer = { value: b.value, unit: def.unit, tol: tol, alt: b.alt.slice(), disp: b.disp };
      const steps = def.steps(g, b.value);
      const ex = {
        ok: true, kind: k, seed: sd, question: def.q(g), given: g, answer: answer, steps: steps, hinweis: TEXTS.uebung,
        check: function (input) {
          try { return checkAnswer(def, b, tol, input); } catch (e) { return { ok: false, why: 'keine-zahl', text: TEXTS.keineZahl }; }
        }
      };
      hide(ex, 'wrong', b.wrong);
      return ex;
    } catch (e) { return fail(e && e.wslWhy ? e.wslWhy : 'Mit diesen Eingaben gibt es keine Aufgabe.'); }
  };
  exercise.kinds = KINDS.slice();
  /* Loesung zu gegebenen Werten (fuer Tests und Diagnose): { ok, value, alt, wrong:[{id,value,text}] } */
  exercise.solve = S(function (kind, given) {
    const def = D[kind] || DH[kind];
    if (!def) V('Diese Aufgabenart gibt es nicht: ' + String(kind) + '.');
    const b = build(def, obj(given));
    return { ok: true, valid: true, value: b.value, unit: def.unit, alt: b.alt, wrong: b.wrong, disp: b.disp };
  });
  W.extend('exercise', exercise);

  /* =============================== Diagnose =============================== */
  function dgn(id, vars, extra) { return Object.assign({ id: id, text: TEXTS.get(id, vars), bedingung: true, gegenprobe: true }, extra || {}); }
  function diagAntwort(ctx) {
    const kind = String(ctx.kind), g = obj(ctx.given);
    if (kind === 'hAtFg') {
      const a = W.parseQty(ctx.antwort);
      if (!a || !fin(a.v)) return [];
      const v = a.v, betrag = LV('fg_betrag'), db = LV('fg_db');
      const is50 = Math.abs(v - 0.5) < 0.01 || Math.abs(v - 50) < 1 || (a.unit === 'dB' && Math.abs(v + 6) < 0.2);
      const isCorrect = Math.abs(v - betrag) < 0.01 || Math.abs(v - betrag * 100) < 1 || (a.unit === 'dB' && Math.abs(v - db) < 0.2);
      return is50 && !isCorrect ? [dgn('fg-3db', { betrag: W.limitText('fg_betrag'), db: W.limitText('fg_db') })] : [];
    }
    const def = D[kind] || DH[kind];
    if (!def) return [];
    const a = W.parseQty(ctx.antwort);
    if (!a || !fin(a.v)) return [];
    const b = build(Object.assign({}, def, { g: g }), g);
    const out = [];
    const cands = [a.v]; if (!a.hasUnit && b.disp.factor !== 1) cands.push(a.v * b.disp.factor);
    b.wrong.forEach(function (w) { if (cands.some(function (c) { return Math.abs(c - w.value) <= def.tol * Math.abs(w.value); })) out.push({ id: w.id, text: w.text, bedingung: true, gegenprobe: true, wert: w.value }); });
    if (def.special) { const sp = def.special(g, cands[cands.length - 1], b.value); if (sp) out.push({ id: sp.id, text: sp.text, bedingung: true, gegenprobe: true }); }
    return out;
  }
  function diagZustand(ctx) {
    const rig = String(ctx.rig), st = obj(ctx.state), z = obj(st.ziel), out = [];
    if (rig === 'schwing') {
      const art = lcase(st.art, 'reihe');
      const cfg = { art: art, l: st.l, c: st.c, r: st.r, u: st.u === undefined ? 1 : st.u };
      const f = num(st.f, NaN);
      const p = art === 'parallel' ? res.parallel(Object.assign({}, cfg, { f: f })) : res.series(Object.assign({}, cfg, { f: f }));
      if (!p.ok || p.valid === false) return out;
      if (isFinite(f) && f > 0 && p.aufResonanz) {
        const lo = art === 'parallel' ? res.parallel(Object.assign({}, cfg, { f: f / 1.1 })) : res.series(Object.assign({}, cfg, { f: f / 1.1 }));
        const hi = art === 'parallel' ? res.parallel(Object.assign({}, cfg, { f: f * 1.1 })) : res.series(Object.assign({}, cfg, { f: f * 1.1 }));
        if (art === 'reihe' && p.z <= lo.z && p.z <= hi.z) out.push(dgn('res-reihe', { z: fe(p.z, 'Ω'), i: p.i !== undefined ? fe(p.i, 'A') : '–' }));
        if (art === 'parallel' && p.z >= lo.z && p.z >= hi.z) out.push(dgn('res-parallel', { z: fe(p.z, 'Ω'), i: p.i !== undefined ? fe(p.i, 'A') : '–', ik: p.il !== undefined ? fe(p.il, 'A') : '–' }));
      }
      if (art === 'reihe' && p.ul !== undefined && p.ul > p.u && isFinite(f) && f > 0) {
        const qg = p.qg;
        out.push(dgn('res-ueberhoehung', { ul: fe(Math.max(p.ul, p.uc), 'V'), u: fe(p.u, 'V'), qg: fmt(qg, 3) }));
      }
    } else if (rig === 'kompens') {
      const cfg = { p: st.p, cos1: st.cos1, u: st.u === undefined ? LV('u_netz') : st.u, f: st.f === undefined ? LV('f_netz') : st.f, c: st.c === undefined ? 0 : st.c };
      const a = comp.after(cfg);
      if (!a.ok) return out;
      if (a.ueber) out.push(dgn('komp-ueber', { w: fe(a.c, 'F'), cmax: fe(a.cMax, 'F'), cos: fmt(a.cos, 3) }));
      else if (a.c > 0) {
        const a0 = comp.after(Object.assign({}, cfg, { c: 0 }));
        if (a.i < a0.i && Math.abs(a.p - a0.p) < 1e-9 * a0.p) out.push(dgn('komp-wirkung', { i1: fe(a0.i, 'A'), i2: fe(a.i, 'A'), p: fe(a.p, 'W'), q1: fe(a0.q, 'var'), q2: fe(a.q, 'var') }));
      }
    } else if (rig === 'filter') {
      const zt = z.typ === undefined || z.typ === null ? '' : lcase(z.typ, '').replace('pass', '');
      const base = { art: st.art, r: st.r, c: st.c, l: st.l };
      const ist = filter.response(Object.assign({ typ: st.typ }, base), 1);
      if (zt && ist.ok && ist.typ !== zt) {
        const f = ist.fg / 10;
        const a = filter.response(Object.assign({ typ: ist.typ }, base), f), b = filter.response(Object.assign({ typ: zt }, base), f);
        if (a.ok && b.ok && Math.abs(a.h - b.h) > 0.05) out.push(dgn('hp-tp', { ist: ist.typ === 'tief' ? 'Tiefpass' : 'Hochpass', soll: zt === 'tief' ? 'Tiefpass' : 'Hochpass', f: fe(f, 'Hz'), hist: fmt(a.h, 3), aist: fmt(a.a, 1), hsoll: fmt(b.h, 3), asoll: fmt(b.a, 1) }));
      }
    } else if (rig === 'trafo') {
      const dcOn = st.dc === true || /gleich/i.test(String(st.dc === undefined ? '' : st.dc)) || /gleich/i.test(String(st.art === undefined ? '' : st.art));
      if (dcOn) {
        const rw = st.rw !== undefined ? st.rw : (st.r1 !== undefined ? st.r1 : st.rwick);
        const d = trafo.dc({ u: st.u1, rw: rw });
        out.push(dgn('trafo-dc', { why: d.ok ? d.why : L('trafo_dc').text }));
      }
    } else if (rig === 'drehstrom') {
      const zs = z.schaltung === undefined || z.schaltung === null ? '' : lcase(z.schaltung, '');
      const sch = lcase(st.schaltung, 'stern');
      if (zs && zs !== sch) {
        const cfg = { ul: st.ul, zstr: st.rstr !== undefined ? st.rstr : st.zstr, cosphi: st.cosphi };
        const a = three.star(cfg), b = three.delta(cfg);
        if (a.ok && b.ok) out.push(dgn('stern-dreieck', { w: fe(sch === 'dreieck' ? b.p : a.p, 'W') + ' (statt ' + fe(zs === 'dreieck' ? b.p : a.p, 'W') + ')' }));
      }
    }
    return out;
  }
  W.extend('diagnose', function (ctx) {
    try {
      if (!isObj(ctx)) return [];
      if (ctx.kind !== undefined) return diagAntwort(ctx);
      if (ctx.rig !== undefined) return diagZustand(ctx);
      return [];
    } catch (e) { return []; }
  });

  /* =============================== 4.11 Laeufer runSeq =============================== */
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
        const Rr = root.WSL_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'WSL_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && typeof rigIn.setControl === 'function') {
        rig = rigIn; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { out.ok = false; if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); return out; }
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const tEnd = clamp(num(tEndS, 0), 0, 1e6);
    const sampleS = Math.max(tEnd / 20000, num(opts.sampleS, 0) > 0 ? num(opts.sampleS, 0) : (tEnd / 200 || 1));
    const faultSet = {};
    function collect(st) { if (st && isArr(st.faults)) st.faults.forEach(function (f) { if (!faultSet[f]) { faultSet[f] = 1; out.faults.push(f); } }); }
    function setCtl(key, v) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '“ gibt es an dieser Anlage nicht.'); return; }
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
      out.samples.push({ t: t, meters: snap(m), state: snap(st) });
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
          else ramps.push({ key: e.ramp.key, from: from, to: to, t0: t, dur: dur, log: known[e.ramp.key] && known[e.ramp.key].scale === 'log' && from > 0 && to > 0 });
        }
        if (e.fire) {
          try { if (typeof rig.fire === 'function') rig.fire(); else out.errors.push('Dieser Prüfstand hat keine Auslösung (fire).'); } catch (er) { out.errors.push('fire(): ' + (er && er.message)); }
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
    try { out.final = snap(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.assess = typeof rig.assess === 'function' ? snap(rig.assess()) : null; } catch (e) { out.errors.push('assess(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snap) : []; } catch (e) { /* */ }
    if (opts.keepRig) out.rig = rig;
    return out;
  }
  W.extend('runSeq', function () {
    try { return runSeq.apply(null, arguments); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], assess: null, errors: ['Interner Fehler im Läufer.'], rejected: [] }; }
  });

  if (typeof module !== 'undefined') module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
