/* thmcore.js - Thermik-/Kuehlkoerper-Lab Kern (THM_CORE, Version 1.0)
 * Reine Rechnung, keine DOM-Zugriffe, keine Abhaengigkeit von DS_CORE/REG_CORE/ANT_CORE/SEN_CORE.
 * Browser: window.THM_CORE, Node: module.exports / globalThis.THM_CORE. Vanilla-JS, kein eval.
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Temperaturen in Grad C, Differenzen in K, Leistung in W, Widerstaende in K/W, Waermekapazitaet in J/K, Zeit in Prozess-SEKUNDEN.
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte ohne Felder,
 *    negative Werte) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32). Gleiche Eingaben ergeben bitgleiche Ergebnisse.
 *  - Texte enthalten keine fest verdrahteten Waermesymbole, sondern {sym:key}-Platzhalter (tpl()). Der Symbolsatz ('db' Datenblatt,
 *    'de' Berufsschule) gilt global ueber symSet(set) (Standard 'db') oder je Aufruf ueber sym(key, set) / tpl(text, set).
 *
 * ===================================================================================================
 * MEILENSTEINE
 *  M1: glossary, sym, tpl, analogie, fmt, parseNum, rng, eSeries, packages, mount, fan, orient, heatsinks, materials, rthLayer, devices (+elec),
 *      chain, steady, pzul, rthKerf, taMax, chooseHeatsink, power.*, formulas, mountControls, mountPresets, const
 *  M2: thermal (exakter Schritt), zth, pulseTj, coupled, efficiency, derating, parallelDevices, heatsink.fromGeometry/finProfile, tauOf, ...
 *  M3: recipe, exercise, diagnoseAnswer, diagnose, TEXTS, runSeq, fitTau
 *
 * ===================================================================================================
 * SCHNITTSTELLEN FUER ANDERE PAKETE (Kurzfassung; Abschnitt 4 der SPEC ist massgeblich)
 *  cfg (SPEC 4.1): { device, heatsink, joint, paste, bushing, screw, ksPot, fan, orient, count, blech:{A_cm2,d_mm,material}, custom:{rthK,massG,material},
 *    nonlin, overrides:{rthJC,rthCK,rthK,rthJA,cthJ,cthC,cthK} }. Fehlende Felder: Standardwerte (heatsink 'none', joint 'direkt', paste 'duenn', bushing true,
 *    screw 'fest', ksPot 'masse', fan 'aus', orient 'senkrecht', count 1).
 *  chain(cfg) -> { ok, mode:'frei'|'kk', device (Id), dev (Bauteilobjekt), pkg, rthJC, rthCK, rthK (effektiv, inkl. Luefter und Einbaulage),
 *    rthK0 (Katalog frei), rthCA, rthJA, rthTotal (= rthJC + rthCK + count*rthK, frei: rthJA), count, cth:{j,c,k}, tjMax, fanF, orientF, hs, faults:[ids], notes:[text], cfg (normiert) }
 *  steady(cfg, P, ta, opts) -> { ok, tj, tc, tk, ta, p, dJC, dCK, dK, dCA, sum, rthTotal, rthJC, rthCK, rthK, tjMax, margin, mode, count, steps:[text], faults }
 *    (P ist je Bauteil; bei count > 1 traegt der Kuehlkoerper count*P). pzul(cfg, ta) -> Zahl (W). rthKerf(...) -> { ok, kind, value (K/W, effektiv), raw, why, steps }.
 *    taMax(cfg, P) -> Zahl. chooseHeatsink(rthErf, {fan, orient, pkg}) -> { ok, id, heatsink, rthK, rthKeff, rthErf, reserve } oder { ok:false, why }.
 *  power.linear/bipolar/endstufe/mosfet/diode/resistor/led/switching -> { ok, p, value (= p), steps, why, ... }  (bei Fehler p = NaN).
 *    power.mosfet({i,d,rds25,tj,alpha,u,f,tr,tf}); power.diode({i,ff,u0,rf}); power.led({n,uf,i,etaTh}); power.resistor(u, r) oder ({u,r}) / ({i,r}).
 *  devices[id]: { id, name, part, pkg, tjMax, rthJC, rthJA, ptot (frei, W), source, fromDs, cthJ, cthC, tab:{pin,name,pot,potText}, kind, limits,
 *    shutdown:{on,off} | destroyAt, p(op), elec(state), ... }. packages[id]. mount.rthCK(pkg, joint, paste, screw). mount.options. mount.factors.
 *  fan[id] / orient[id] sind Faktoren (Zahl); fan.list / orient.list sind Auswahllisten (nicht aufzaehlbar). heatsinks ist ein Array (Reihenfolge klein -> gross),
 *    zusaetzlich heatsinks.byId[id] und heatsinks[id] (nicht aufzaehlbar). materials[id] = { lambda, c, rho }.
 *  formulas ist ein Array { id, name, symbol, expr (mit {sym:..}-Platzhaltern, tpl() loest auf), unit, inputs:[{key,label,unit,def}], fn, explain(...) -> { ok, value, unit, steps } }
 *    mit formulas.byId[id], formulas.get(id), formulas.list().
 *  mountControls(set?) -> Steuerwert-Beschreibungen der Gruppe "Montage und Umgebung" (SPEC 5.0), mountPresets -> [{ id, name, values }].
 *  TEXTS.diag/TEXTS.rig/TEXTS.kern: einzige Quelle der Kernmeldungen; TEXTS.get(id, vars).
 *  M2: thermal(cfg) -> { step(dtS, P, ta) (exakter Schritt, P je Bauteil), state() { tj, tc, tk, ta, x }, reset(ta), set(tj, tc, tk), setCfg(cfg) (Knoten behalten die
 *    Temperatur), settle(P, ta), steadyNodes(P, ta), tauDominant(), tauList(), nodes(), chain(), stepResponse(tEnd, n) }. zth(cfg, tArr) -> Zahlen (K/W).
 *    pulseTj(cfg, Ppk, tp, T, ta) -> { ok, tj (Spitze), tjAvg, d, dauer, steps }. derating(cfg, ta?, n?) -> { points:[{tc,p}], pCase25, slope, pAt(tc) },
 *    derating.overTa(cfg, n). parallelDevices(n, cfg, P1, ta) -> { tk, tc, tj, dK, steps }. coupled.mosfet({i,d,rds25,alpha,u,f,tr,tf,rth,ta}) und
 *    coupled.runaway({uce,ic,rth,ta,re}) -> { ok, runaway, g, tj, p, why }. efficiency.linear(ue,ua,ia,iq) -> Zahl (0…1); efficiency.switching(pa,eta) und
 *    efficiency.compare({ue,ua,ia,iq,eta,ta,device}) -> Objekte. heatsink.fromGeometry(spec|id), heatsink.finProfile(spec|id, tBase, ta, n) (x in mm).
 *    shutdownStep(prevShut, tSense, devId), shutdownSense(tc, pOn, rthJC|cfg), tempRange(devId, ta), tauApprox(cfg), blech(spec).
 *  M3: diagnose(ctx) -> [{ id, kind, text, fx? }]; ctx { cfg, p, ta, tj?, tc?, tk?, tjMax?, shutdown?, shutCount?, destroyed?, runaway?, op?, elec?, tabV?, set? }.
 *    recipe({ device|cfg, op|p, ta, joint, paste, screw, fan, orient, heatsink, count, tjMax, rthJC, rthCK, rthJA, margin, compare }) -> { ok, steps:[{ n, title, lines, text }], result, warn }.
 *    exercise(kind, seed) -> { ok, kind, seed, question, given, table:[{ caption, head, rows }], answer:{ value, unit, tol, alt }, steps, check(input) -> { ok, text },
 *    diagnose(input) -> { ok, id, hint } }; diagnoseAnswer(kind, input, ctx|{seed}). fitTau(ts, ys, yInf). runSeq(rigFactory|rigId|rig, seq, tEndS, opts).
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const api = {};
  const PI = Math.PI;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v); return isFinite(x) ? x : d; }
    return d;
  }
  function pos(v, d) { const x = num(v, NaN); return x > 0 ? x : d; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function isArr(a) { return Array.isArray(a); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function C(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail('Interner Fehler bei ungültiger Eingabe.'); } }; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  const LN2 = Math.LN2;

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
  /* parseNum(str): Komma/Punkt, Leerzeichen als Tausendertrennung, Einheitenzusatz toleriert ("3,5 W", "14,5 K/W"). Zahl oder NaN. */
  function parseNum(str) {
    if (typeof str === 'number') return isFinite(str) ? str : NaN;
    if (typeof str !== 'string') return NaN;
    const s = str.replace(/−/g, '-').replace(/[   ]/g, ' ').trim();
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

  /* ---------- Zufall (mulberry32) ---------- */
  function rng(seed) {
    let a = Math.floor(num(seed, 1)) | 0;
    function next() {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    function int(lo, hi) {
      lo = Math.ceil(num(lo, 0)); hi = Math.floor(num(hi, lo));
      if (hi < lo) hi = lo;
      return lo + Math.floor(next() * (hi - lo + 1));
    }
    function pick(arr) { if (!isArr(arr) || !arr.length) return undefined; return arr[Math.floor(next() * arr.length) % arr.length]; }
    return { next: next, int: int, pick: pick };
  }

  /* ---------- E-Reihen (fuer Widerstandswerte) ---------- */
  const ESER = {
    E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
    E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
    E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1]
  };
  /* eSeries(series, value, mode): 'up' (naechster Wert >= value), 'down', 'nearest' (Standard). NaN bei Unsinn. */
  function eSeries(series, value, mode) {
    const name = String(series || 'E12').toUpperCase();
    const tab = has(ESER, name) ? ESER[name] : null;
    const v = num(value, NaN);
    if (!tab || !(v > 0)) return NaN;
    mode = mode || 'nearest';
    let dec = Math.floor(Math.log10(v));
    let mant = v / Math.pow(10, dec);
    if (mant < 1) { mant *= 10; dec--; }
    if (mant >= 10) { mant /= 10; dec++; }
    const cands = tab.concat([10]);
    let best = NaN;
    if (mode === 'up') { for (let i = 0; i < cands.length; i++) if (cands[i] >= mant * (1 - 1e-9)) { best = cands[i]; break; } }
    else if (mode === 'down') { for (let i = cands.length - 1; i >= 0; i--) if (cands[i] <= mant * (1 + 1e-9)) { best = cands[i]; break; } }
    else { let bd = Infinity; cands.forEach(function (c) { const d = Math.abs(Math.log(c / mant)); if (d < bd) { bd = d; best = c; } }); }
    return Number((best * Math.pow(10, dec)).toPrecision(6));
  }

  /* =====================================================================================================
   *  GLOSSAR, SYMBOLE, ANALOGIE (einzige Quelle fuer Begriffe, Symbole, Erklaertexte)
   * ===================================================================================================== */
  /* [key, db, de, Artikel, Name, Einheit, Erklaerung (mit {sym:key}), Tipp] */
  const GL = [
    ['P', 'P', 'P_V', 'die', 'Verlustleistung', 'W', 'Die {sym:P} ist die Leistung, die im Bauteil in Wärme umgesetzt wird. Genau diese Wärmeleistung muss über den Kühlkörper an die Umgebung abfließen.', 'Beim Linearregler ist sie die Spannungsdifferenz mal der Strom.'],
    ['Ptot', 'Ptot', 'P_tot', 'die', 'zulässige Verlustleistung (Datenblatt)', 'W', 'Die {sym:Ptot} steht im Datenblatt für freistehenden Betrieb bei 25 °C Umgebung. Mit Kühlkörper gilt sie nicht, dort zählt die Rechnung mit der ganzen Kette.', ''],
    ['Pzul', 'P_zul', 'P_zul', 'die', 'zulässige Verlustleistung (gerechnet)', 'W', 'Die {sym:Pzul} ist die größte Verlustleistung, bei der die Sperrschicht gerade noch {sym:Tjmax} erreicht.', ''],
    ['Tj', 'Tj', 'ϑj', 'die', 'Sperrschichttemperatur', '°C', 'Die {sym:Tj} ist die Temperatur im Inneren des Bauteils (am Chip). Du kannst sie nicht direkt messen, du rechnest sie aus.', 'Die Wärmebild-Kamera sieht sie nicht, nur das Gehäuse und den Kühlkörper.'],
    ['Tjmax', 'Tj,max', 'ϑj,max', 'die', 'höchstzulässige Sperrschichttemperatur', '°C', 'Die {sym:Tjmax} steht im Datenblatt. Sie ist ein Grenzwert und kein Betriebspunkt: Plane eine Reserve ein.', ''],
    ['Tc', 'Tc', 'ϑG', 'die', 'Gehäusetemperatur', '°C', 'Die {sym:Tc} ist die Temperatur an der Gehäuserückseite oder an der Fahne des Bauteils.', ''],
    ['Tk', 'Tk', 'ϑK', 'die', 'Kühlkörpertemperatur', '°C', 'Die {sym:Tk} ist die Temperatur am Fuß des Kühlkörpers, dort wo das Bauteil aufliegt.', 'Fühle nur vorsichtig: Der Kühlkörper kann heiß sein.'],
    ['Ta', 'Ta', 'ϑU', 'die', 'Umgebungstemperatur', '°C', 'Die {sym:Ta} ist die Temperatur der Luft am Kühlkörper. Im Gerät ist sie höher als im Raum.', 'Im Datenblatt gilt meist 25 °C.'],
    ['Rth_JC', 'Rth_JC', 'R_thJG', 'der', 'Wärmewiderstand Sperrschicht–Gehäuse', 'K/W', 'Der {sym:Rth_JC} steht im Datenblatt. Er beschreibt, wie schwer die Wärme vom Chip zur Gehäuserückseite kommt.', ''],
    ['Rth_CK', 'Rth_CK', 'R_thGK', 'der', 'Wärmewiderstand Gehäuse–Kühlkörper', 'K/W', 'Der {sym:Rth_CK} ist der Übergang zwischen Gehäuse und Kühlkörper. Er hängt von Isolierscheibe, Wärmeleitpaste und Schraube ab.', 'Ihn kannst du bei der Montage verbessern oder verschlechtern.'],
    ['Rth_K', 'Rth_K', 'R_thKU', 'der', 'Wärmewiderstand Kühlkörper–Umgebung', 'K/W', 'Der {sym:Rth_K} steht im Katalog des Kühlkörpers (freie Konvektion, Rippen senkrecht). Lüfter und Einbaulage verändern ihn.', ''],
    ['Rth_JA', 'Rth_JA', 'R_thJU', 'der', 'Wärmewiderstand Sperrschicht–Umgebung', 'K/W', 'Der {sym:Rth_JA} gilt für das Bauteil ohne Kühlkörper (freistehend) und steht im Datenblatt.', ''],
    ['Rth_CA', 'Rth_CA', 'R_thGU', 'der', 'Wärmewiderstand Gehäuse–Umgebung', 'K/W', 'Der {sym:Rth_CA} ist beim freistehenden Bauteil der Rest der Kette: {sym:Rth_JA} minus {sym:Rth_JC}.', ''],
    ['Rth_ges', 'Rth_ges', 'R_thges', 'der', 'Gesamt-Wärmewiderstand', 'K/W', 'Der {sym:Rth_ges} ist die Summe aller Wärmewiderstände der Kette zwischen Sperrschicht und Umgebung (Reihenschaltung).', ''],
    ['Rth_Kerf', 'Rth_K,erf', 'R_thKU,erf', 'der', 'erforderlicher Wärmewiderstand des Kühlkörpers', 'K/W', 'Der {sym:Rth_Kerf} ist der größte Kühlkörper-Wärmewiderstand, mit dem die Sperrschicht gerade noch {sym:Tjmax} einhält.', ''],
    ['Cth', 'Cth', 'Cth', 'die', 'Wärmekapazität', 'J/K', 'Die {sym:Cth} sagt, wie viel Wärme ein Teil speichert, bis es um 1 K wärmer ist. Sie ist Masse mal spezifische Wärmekapazität.', ''],
    ['tau', 'τ', 'τ', 'die', 'Zeitkonstante', 's', 'Die {sym:tau} ist Wärmewiderstand mal Wärmekapazität. Nach einer {sym:tau} sind 63 % des Endwertes erreicht, nach drei {sym:tau} 95 %.', 'Die Anzeige im Lab läuft in Prozessminuten.'],
    ['dT', 'ΔT', 'Δϑ', 'der', 'Temperaturabfall über einem Glied', 'K', 'Der {sym:dT} über einem Glied ist die Verlustleistung mal der Wärmewiderstand dieses Gliedes. Alle Abfälle zusammen ergeben {sym:Tj} minus {sym:Ta}.', ''],
    ['Tshut', 'T_shut', 'ϑ_ab', 'die', 'Abschalttemperatur', '°C', 'Bei der {sym:Tshut} schaltet der Regler ab und kühlt aus, bis er wieder einschaltet. Das ist ein Schutz und kein Betriebspunkt.', ''],
    ['paste', '', '', 'die', 'Wärmeleitpaste', '', 'Die Wärmeleitpaste füllt die winzigen Luftspalte zwischen Gehäuse und Kühlkörper. Luft leitet die Wärme schlecht, deshalb sinkt der {sym:Rth_CK} mit Paste.', 'Trage sie dünn auf.'],
    ['glimmer', '', '', 'die', 'Glimmerscheibe (Isolierscheibe)', '', 'Die Glimmerscheibe isoliert das Gehäuse elektrisch vom Kühlkörper. Sie leitet die Wärme schlechter als Metall und erhöht den {sym:Rth_CK}.', ''],
    ['buchse', '', '', 'die', 'Isolierbuchse', '', 'Die Isolierbuchse isoliert die Schraube. Ohne sie verbindet die Schraube Fahne und Kühlkörper elektrisch.', ''],
    ['kuehlkoerper', '', '', 'der', 'Kühlkörper', '', 'Der Kühlkörper vergrößert die Fläche, über die Wärme an die Luft abgegeben wird. Rippen und ein Lüfter verkleinern den {sym:Rth_K}.', ''],
    ['linearregler', '', '', 'der', 'Linearregler', '', 'Der Linearregler setzt den Spannungsunterschied zwischen Eingang und Ausgang in Wärme um. Seine {sym:P} ist (Ue − Ua) mal Ia.', ''],
    ['schaltregler', '', '', 'der', 'Schaltregler', '', 'Der Schaltregler schaltet und speichert Energie, deshalb ist seine {sym:P} viel kleiner als beim Linearregler.', ''],
    ['derating', '', '', 'das', 'Derating', '', 'Derating nennt man das Absenken der zulässigen {sym:P} bei steigender Temperatur.', '']
  ];
  const glossary = GL.map(function (g) { return { key: g[0], db: g[1], de: g[2], article: g[3], name: g[4], unit: g[5], explain: g[6], tip: g[7] }; });
  const glByKey = {};
  glossary.forEach(function (g) { glByKey[g.key] = g; });
  /* Schluessel werden auch ohne Beachtung von Gross-/Kleinschreibung und ohne Unterstrich gefunden (tjMax = Tjmax, rthJC = Rth_JC) */
  const glNorm = {};
  glossary.forEach(function (g) { glNorm[g.key.toLowerCase().replace(/[_,]/g, '')] = g; });
  function glFind(key) {
    if (typeof key !== 'string') return null;
    if (has(glByKey, key)) return glByKey[key];
    const n = key.toLowerCase().replace(/[_,]/g, '');
    return has(glNorm, n) ? glNorm[n] : null;
  }
  hide(glossary, 'byKey', glByKey);
  hide(glossary, 'get', glFind);
  /* verbotene Schreibweisen (Regel 6): Suchmuster (RegExp-Quelltext), Flags, Ersatz */
  hide(glossary, 'forbidden', [
    { pattern: 'Isolierpl(ä|ae)ttchen', flags: 'i', use: 'Glimmerscheibe oder Isolierscheibe' },
    { pattern: 'W(ä|ae)rmewiderstandswert', flags: 'i', use: 'Wärmewiderstand' },
    { pattern: 'K(ü|ue)hlk(ö|oe)rper-Temperatur', flags: '', use: 'Kühlkörpertemperatur' },
    { pattern: '\\bSie (m(ü|ue)ssen|k(ö|oe)nnen|sollen|stellen|messen|lesen|berechnen)\\b', flags: '', use: 'Du-Anrede' },
    { pattern: '\\b[Mm]esse\\b', flags: '', use: 'miss' },
    { pattern: '\\bLies\\b(?! ab)', flags: '', use: 'lies ab' },
    { pattern: '\\bdie K(ü|ue)hlk(ö|oe)rper\\b(?!n)', flags: '', use: 'der Kühlkörper (Genus)' },
    { pattern: '\\bder W(ä|ae)rmeleitpaste\\b(?! )', flags: '', use: 'die Wärmeleitpaste (Genus)' },
    { pattern: 'Echtzeit', flags: 'i', use: 'Prozesszeit' }
  ]);
  let SYM_SET = 'db';
  function symSet(set) { if (set === 'db' || set === 'de') SYM_SET = set; return SYM_SET; }
  function sym(key, set) {
    const g = glFind(key);
    if (!g) return String(key);
    const s = set === 'de' || set === 'db' ? set : SYM_SET;
    const v = s === 'de' ? g.de : g.db;
    return v || g.name;
  }
  /* tpl(text, set): ersetzt {sym:key} durch das Symbol des Satzes; unbekannte Schluessel bleiben als Schluessel stehen */
  function tpl(text, set) {
    return String(text === undefined || text === null ? '' : text).replace(/\{sym:([A-Za-z_]+)\}/g, function (_, k) { return sym(k, set); });
  }
  hide(glossary, 'text', function (key, set) { const g = glossary.get(key); return g ? tpl(g.explain, set) : ''; });
  const analogie = [
    { id: 'spannung', elek: 'Spannung U', therm: 'Temperaturdifferenz {sym:dT}', text: 'Eine Spannung treibt den Strom, eine Temperaturdifferenz treibt die Wärme.' },
    { id: 'strom', elek: 'Strom I', therm: 'Verlustleistung {sym:P}', text: 'Wie Ladung fließt Wärmeleistung durch die Kette. Der Strom ist an jeder Stelle gleich, die {sym:P} auch.' },
    { id: 'widerstand', elek: 'Widerstand R', therm: 'Wärmewiderstand {sym:Rth_ges}', text: 'Ein Widerstand bremst den Strom, ein Wärmewiderstand bremst die Wärme. Die Einheit ist K/W.' },
    { id: 'kondensator', elek: 'Kondensator C', therm: 'Wärmekapazität {sym:Cth}', text: 'Ein Kondensator speichert Ladung, ein Körper speichert Wärme. Beide werden nur langsam voll.' },
    { id: 'masse', elek: 'Masse (0 V)', therm: 'Umgebung', text: 'Die Umgebung ist der Bezugspunkt, an dem die Wärme am Ende verschwindet.' },
    { id: 'spannungsquelle', elek: 'Spannungsquelle', therm: 'Umgebungstemperatur {sym:Ta}', text: 'Die Umgebungstemperatur legt fest, von welcher Temperatur aus du rechnest.' },
    { id: 'stromquelle', elek: 'Stromquelle', therm: 'Verlustleistung des Bauteils', text: 'Das Bauteil speist seine Verlustleistung wie eine Stromquelle in die Kette ein.' },
    { id: 'reihe', elek: 'Reihenschaltung', therm: 'Kette der Wärmewiderstände', text: 'Die Wärmewiderstände Sperrschicht–Gehäuse, Gehäuse–Kühlkörper und Kühlkörper–Umgebung liegen in Reihe und addieren sich.' }
  ];
  analogie.forEach(function (a) {
    a.elektrisch = a.elek;
    Object.defineProperty(a, 'thermisch', { enumerable: true, get: function () { return tpl(a.therm); } });
    Object.defineProperty(a, 'erklaerung', { enumerable: true, get: function () { return tpl(a.text); } });
  });
  hide(analogie, 'resolved', function (set) { return analogie.map(function (a) { return { id: a.id, elek: a.elek, therm: tpl(a.therm, set), text: tpl(a.text, set) }; }); });

  /* ---------- Texte (einzige Quelle fuer Kernmeldungen; Platzhalter {name} und {sym:key}) ---------- */
  const TXT = {
    keineZahl: 'Das ist keine Zahl. Schreibe zum Beispiel 3,5.',
    ungueltig: 'Die Eingabe ist ungültig.',
    ueUa: 'Die Eingangsspannung ist kleiner als die Ausgangsspannung: Ein Linearregler kann nur herunterregeln.',
    iNeg: 'Der Strom darf nicht negativ sein.',
    uNeg: 'Die Spannung darf nicht negativ sein.',
    rPos: 'Der Widerstand muss größer als 0 sein.',
    nMin: 'Es muss mindestens ein Bauteil geben (n ≥ 1).',
    pNeg: 'Die Verlustleistung darf nicht negativ sein.',
    aKlemm: 'Die Aussteuerung liegt außerhalb von 0 bis 100 %: Sie wurde auf {a} % begrenzt.',
    dKlemm: 'Die Einschaltdauer liegt außerhalb von 0 bis 100 %: Sie wurde auf {d} % begrenzt.',
    dauerKeinSchalten: 'Bei 100 % Einschaltdauer schaltet nichts: Es gibt keine Schaltverluste.',
    schaltzeit: 'Die Schaltzeiten sind zu lang für diese Frequenz: Das Bauteil kommt nie ganz zum Schalten.',
    etaKlemm: 'Der Wirkungsgrad liegt außerhalb von {lo} bis {hi} %: Das ist für einen Schaltregler unrealistisch.',
    keineLeistung: 'Es entsteht keine Verlustleistung: Du brauchst keinen Kühlkörper.',
    taZuHoch: 'Die Umgebung ist so warm wie die zulässige Sperrschichttemperatur: Das Bauteil darf gar keine Leistung umsetzen.',
    negativ: 'Das Ergebnis ist negativ: Schon {sym:Rth_JC} + {sym:Rth_CK} sind zu groß. Mit idealem Kühlkörper (0 K/W) wäre {sym:Tj} = {tj} °C zu hoch. Verkleinere die Verlustleistung, wähle einen besseren Übergang (Paste, keine Isolierscheibe) oder ein anderes Gehäuse.',
    unrealistisch: 'Der erforderliche Wert {x} K/W ist kleiner als bei jedem Kühlkörper der Tabelle (der kleinste mögliche Wert mit Lüfter ist {best} K/W). Nimm einen Lüfter, eine größere Fläche oder senke die Verlustleistung.',
    keinKK: 'Kein Kühlkörper aus der Tabelle reicht (kleinster nötiger Wert {need} K/W, bester vorhandener {best} K/W). Nimm einen Lüfter, senke die Verlustleistung oder verbessere den Übergang.',
    rthNichtPos: 'Der erforderliche Wärmewiderstand ist nicht positiv: Mit keinem Kühlkörper zu erreichen.',
    ungueltigerAufbau: 'Dieser Aufbau ist ungültig.',
    keinSockel: 'Dieses Bauteil wird nicht auf einen Kühlkörper montiert.',
    nurMitKK: 'Dieses Bauteil darf nur mit Kühlkörper betrieben werden.',
    silikonPaste: 'Silikonfolie braucht keine Paste: Die Paste bringt hier nichts.',
    fahneTO220: 'Der Fahnenkühlkörper passt nur auf das Gehäuse TO-220.',
    keinJC: 'Dieses Bauteil hat keinen Wärmewiderstand Sperrschicht–Gehäuse: Eine Gehäuse-Kennlinie gibt es hier nicht.',
    weglaufen: 'Thermische Mitkopplung: RDS(on) steigt mit der Temperatur schneller, als der Kühlkörper die zusätzliche Wärme abführt. Die Temperatur läuft weg.',
    weglaufenBip: 'Thermisches Weglaufen: Der Kollektorstrom steigt mit der Temperatur schneller, als der Kühlkörper die zusätzliche Wärme abführt. Die Temperatur läuft weg.',
    wertAblehnen: 'Diesen Wert gibt es an dieser Anlage nicht.',
    dauerbetrieb: 'Die Impulsdauer ist nicht kürzer als die Periode: Das ist Dauerbetrieb, es gilt {sym:Rth_ges}.',
    impulsZuKurz: 'Die Periode muss größer als 0 sein.',
    keinZahlEingabe: 'Das ist keine Zahl.'
  };
  function fill(tplText, vars, set) {
    vars = vars || {};
    return tpl(String(tplText), set).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] === undefined ? '{' + k + '}' : String(vars[k]); });
  }

  /* =====================================================================================================
   *  KONSTANTEN (Annahmen (A) siehe SPEC Abschnitt 10)
   * ===================================================================================================== */
  const K = {
    ALPHA_CONV: 10,        // W/(m²·K) freie Konvektion einschliesslich Strahlung (A10)
    TA_STD: 25,            // Datenblattbedingung
    TA_GERAET: 40,         // "im Geraet" (A5)
    TA_WARM: 55,           // Warnung ab (A5)
    T_HAND: 70,            // Beruehrgrenze nur Hinweis (A21)
    SHUT_ON: 150, SHUT_OFF: 140,   // thermische Abschaltung (A3)
    DEFEKT_K: 25,          // Defekt ab Tj,max + 25 K (A4)
    RESERVE_K: 10,         // Reservemeldung unter 10 K
    ETA_SW: 0.90,          // Uebungswirkungsgrad Schaltregler (A20)
    ETA_MIN: 0.5, ETA_MAX: 0.99,   // Bereich, in dem ein Schaltregler-Wirkungsgrad glaubwuerdig ist
    RTH_SWCHIP: 50,        // Schaltreglerchip freistehend (A20)
    TJMAX_SWCHIP: 125,
    H: 0.25,               // Kernschritt (Prozess-s)
    TIMESCALE: 30, TUNIT: 'min',
    NONLIN_REF: 40, NONLIN_EXP: -0.25,   // (A11)
    VREF: 1.25,
    SPAN_UNREAL: 0.2       // K/W: kleiner als jeder Katalogkuehlkoerper mit Luefter
  };

  glByKey.Tshut.tip = 'Der Wert ' + K.SHUT_ON + ' °C (Wiedereinschalten bei ' + K.SHUT_OFF + ' °C) ist ein Übungswert.';

  /* =====================================================================================================
   *  TABELLEN
   * ===================================================================================================== */
  /* ---------- Materialien ---------- */
  const materials = {
    al: { id: 'al', name: 'Aluminium', lambda: 200, c: 900, rho: 2700 },
    cu: { id: 'cu', name: 'Kupfer', lambda: 390, c: 385, rho: 8960 },
    luft: { id: 'luft', name: 'Luft', lambda: 0.026 },
    glimmer: { id: 'glimmer', name: 'Glimmer', lambda: 0.6 },
    silikon: { id: 'silikon', name: 'Silikonfolie', lambda: 1.5 },
    paste: { id: 'paste', name: 'Wärmeleitpaste', lambda: 2 }
  };
  hide(materials, 'aluminium', materials.al); hide(materials, 'kupfer', materials.cu);
  function matOf(m) {
    const k = typeof m === 'string' ? m.toLowerCase() : '';
    return has(materials, k) ? materials[k] : null;
  }
  /* rthLayer(d, lambda, A): Rth = d / (lambda * A) in K/W, SI-Einheiten (d in m, lambda in W/(m*K), A in m²). Material-Name statt lambda erlaubt. */
  function rthLayer(d, lambda, A) {
    d = num(d, NaN); A = num(A, NaN);
    let l = num(lambda, NaN);
    if (!isFinite(l) && typeof lambda === 'string') { const m = matOf(lambda); if (m) l = m.lambda; }
    return d > 0 && l > 0 && A > 0 ? d / (l * A) : NaN;
  }
  /* rthLayerMM(d_mm, lambda, A_cm2): dasselbe mit Anzeigeeinheiten (d in mm, A in cm²) */
  function rthLayerMM(dmm, lambda, Acm2) { return rthLayer(num(dmm, NaN) * 1e-3, lambda, num(Acm2, NaN) * 1e-4); }
  /* heatCapacity(m_kg, material): Cth = m * c in J/K */
  function heatCapacity(m, material) {
    m = num(m, NaN);
    const mat = matOf(typeof material === 'string' ? material : 'al');
    return m >= 0 && mat && mat.c ? m * mat.c : NaN;
  }
  function tauOf(rth, c) { rth = num(rth, NaN); c = num(c, NaN); return rth >= 0 && c >= 0 ? rth * c : NaN; }
  function tFraction(tau, f) { tau = num(tau, NaN); f = num(f, NaN); return tau >= 0 && f >= 0 && f < 1 ? -tau * Math.log(1 - f) : NaN; }

  /* ---------- Gehaeuse ---------- */
  const packages = {
    'TO-220': { id: 'TO-220', name: 'TO-220', areaCm2: 1.5, cthC: 1.5, cthJ: 0.05, devices: ['7805', 'lm317', 'irlz34n'], tabText: '7805: Masse (Pin 2); LM317: Ausgang (Pin 2); IRLZ34N: Drain' },
    'TO-126': { id: 'TO-126', name: 'TO-126', areaCm2: 0.9, cthC: 0.8, cthJ: 0.03, devices: ['bd139'], tabText: 'BD139: Kollektor' },
    'DO-41': { id: 'DO-41', name: 'DO-41 axial', areaCm2: NaN, cthC: 0.3, cthJ: 0.02, devices: ['1n4007'], tabText: '' },
    'Zement': { id: 'Zement', name: 'Zementwiderstand', areaCm2: NaN, cthC: 10, cthJ: 0, devices: ['r-zement5'], tabText: '' },
    'Alu': { id: 'Alu', name: 'Alu-Gehäuse', areaCm2: 4.0, cthC: 20, cthJ: 0.1, devices: ['r-alu50'], tabText: 'Gehäuse elektrisch getrennt (Annahme)' },
    'LED': { id: 'LED', name: 'Power-LED auf Sternplatine', areaCm2: NaN, cthC: 3, cthJ: 0.05, devices: ['led3w'], tabText: 'Platinenrückseite isoliert (Annahme)' }
  };

  /* ---------- Uebergang Gehaeuse-Kuehlkoerper (SPEC 4.2.2) ---------- */
  const MOUNT_TAB = {
    'TO-220': { direkt: { duenn: 0.5, keine: 1.5 }, glimmer: { duenn: 1.5, keine: 3.0 }, silikon: { duenn: 2.0, keine: 2.0 } },
    'TO-126': { direkt: { duenn: 0.8, keine: 2.0 }, glimmer: { duenn: 1.0, keine: 3.5 }, silikon: { duenn: 2.5, keine: 2.5 } },
    /* Annahmen (A): groessere Kontaktflaeche beim Alu-Gehaeuse, Stern-Platine der LED */
    'Alu': { direkt: { duenn: 0.3, keine: 0.9 }, glimmer: { duenn: 0.9, keine: 1.8 }, silikon: { duenn: 1.2, keine: 1.2 } },
    'LED': { direkt: { duenn: 1.0, keine: 2.5 }, glimmer: { duenn: 2.0, keine: 4.0 }, silikon: { duenn: 3.0, keine: 3.0 } }
  };
  const MOUNT_FACTORS = { dick: 1.5, locker: 1.8 };
  const JOINTS = ['direkt', 'glimmer', 'silikon'], PASTES = ['keine', 'duenn', 'dick'], SCREWS = ['fest', 'locker'];
  function rthCK(pkg, joint, paste, screw) {
    const tab = has(MOUNT_TAB, pkg) ? MOUNT_TAB[pkg] : null;
    if (!tab) return NaN;
    const j = joint === undefined || joint === null ? 'direkt' : joint;
    const p = paste === undefined || paste === null ? 'duenn' : (paste === 'geliefert' ? 'keine' : paste);   // 'geliefert' = Aufbau noch nicht geprueft (Fehlersuche): physikalisch wie 'keine'
    const s = screw === undefined || screw === null ? 'fest' : (screw === 'geliefert' ? 'locker' : screw);   // ... bzw. wie 'locker'
    if (JOINTS.indexOf(j) < 0 || PASTES.indexOf(p) < 0 || SCREWS.indexOf(s) < 0) return NaN;
    const row = tab[j];
    let v = p === 'keine' ? row.keine : row.duenn;
    if (p === 'dick' && j !== 'silikon') v *= MOUNT_FACTORS.dick;
    if (s === 'locker') v *= MOUNT_FACTORS.locker;
    return v;
  }
  const fan = { aus: 1.00, leise: 0.55, mittel: 0.40, stark: 0.30 };
  const orient = { senkrecht: 1.00, waagrecht: 1.25 };
  hide(fan, 'list', [
    { id: 'aus', name: 'Lüfter aus', factor: fan.aus }, { id: 'leise', name: 'Lüfter leise', factor: fan.leise },
    { id: 'mittel', name: 'Lüfter mittel', factor: fan.mittel }, { id: 'stark', name: 'Lüfter stark', factor: fan.stark }]);
  hide(orient, 'list', [
    { id: 'senkrecht', name: 'Rippen senkrecht', factor: orient.senkrecht }, { id: 'waagrecht', name: 'Rippen waagrecht', factor: orient.waagrecht }]);

  /* ---------- Kuehlkoerper (SPEC 4.2.3) ---------- */
  function hsRow(id, name, rth, massG, geom) {
    return { id: id, name: name, rthK: rth, massG: massG, material: 'al', cthK: heatCapacity(massG / 1000, 'al'), tau: rth * heatCapacity(massG / 1000, 'al'), geom: geom || null };
  }
  const heatsinks = [
    hsRow('fahne', 'Fahnenkühlkörper für TO-220', 25, 6, null),
    hsRow('s', 'Profil klein (25 mm lang)', 15, 25, { b: 35, l: 25, n: 6, L: 20, t: 1.5 }),
    hsRow('m', 'Profil mittel (50 mm lang)', 8, 70, { b: 40, l: 50, n: 4, L: 25, t: 2 }),
    hsRow('l', 'Profil groß (100 mm lang)', 3.5, 250, { b: 60, l: 100, n: 5, L: 25, t: 2.5 }),
    hsRow('xl', 'Rippenkörper sehr groß', 1.5, 800, { b: 100, l: 150, n: 5, L: 40, t: 3 })
  ];
  const hsById = {};
  heatsinks.forEach(function (h) { hsById[h.id] = h; hide(heatsinks, h.id, h); });
  hide(heatsinks, 'byId', hsById);
  hide(heatsinks, 'ids', heatsinks.map(function (h) { return h.id; }));

  /* Selbstbau-Blech: A_cm2 = Flaeche EINER Seite; beide Seiten wirken (A_eff = 2*A). Rth_K = 1/(alpha*A_eff). */
  function blechOf(spec) {
    spec = isObj(spec) ? spec : {};
    const A = num(spec.A_cm2, NaN), d = num(spec.d_mm, 2);
    const mat = matOf(spec.material || 'al');
    if (!(A > 0) || !(d > 0) || !mat || !mat.rho) return fail('Das Kühlblech braucht eine Fläche und eine Dicke größer als 0 und das Material Aluminium oder Kupfer.');
    const aEff = 2 * A * 1e-4;
    const rth = 1 / (K.ALPHA_CONV * aEff);
    const massKg = A * 1e-4 * d * 1e-3 * mat.rho;
    return { ok: true, rthK: rth, aEff: aEff, massG: massKg * 1000, cthK: massKg * mat.c, material: mat.id };
  }

  /* ---------- Bauteile (SPEC 4.2.4); Zahlen der fuenf Uebungsdatenblaetter stehen in test_thm_dslib.js gegen dslib-*.js ---------- */
  const DEV = {};
  function addDev(o) { DEV[o.id] = o; }
  function vdoOf(dev, I, tj) {
    const v = dev.vdo;
    if (!v) return NaN;
    const i = Math.max(0, num(I, NaN)), t = Math.max(25, num(tj, 25));
    if (!isFinite(i)) return NaN;
    const v25 = v.a25 + v.b25 * i, v125 = v.a125 + v.b125 * i;
    return v25 + (v125 - v25) * (t - 25) / 100;
  }
  function ilimOf(dev, du) {
    const L = dev.ilim;
    du = num(du, NaN);
    if (!L || !isFinite(du)) return NaN;
    if (du <= L.du1) return L.i1;
    if (du >= L.du2) return L.i2;
    return L.i1 + (L.i2 - L.i1) * (du - L.du1) / (L.du2 - L.du1);
  }
  addDev({
    id: '7805', name: 'TF-7805 (5 V, 1 A)', part: 'TF-7805', pkg: 'TO-220', kind: 'linear', tjMax: 125, rthJC: 5, rthJA: 50, ptot: 2, ptotFree: 2,
    source: 'tf-7805', fromDs: true, tab: { pin: 2, name: 'GND', pot: 'masse', potText: 'Gerätemasse (Pin 2, GND)' },
    uaFix: 5.0, iq: 0.005, vdo: { a25: 1.7, b25: 0.3, a125: 1.8, b125: 0.35 },
    ilim: { i1: 2.2, du1: 15, i2: 0.75, du2: 30 }, iopk: 2.2, ios: 0.75,
    limits: { ueRec: [7.5, 25], ueAbs: 35, iRec: 1.0 }, shutdown: { on: K.SHUT_ON, off: K.SHUT_OFF }
  });
  addDev({
    id: 'lm317', name: 'TF-LM317 (1,25…37 V, 1,5 A)', part: 'TF-LM317', pkg: 'TO-220', kind: 'linear', tjMax: 125, rthJC: 5, rthJA: 50, ptot: 2, ptotFree: 2,
    source: 'tf-lm317', fromDs: true, tab: { pin: 2, name: 'OUT', pot: 'ausgang', potText: 'dem Ausgang (Pin 2, OUT)' },
    vref: 1.25, iadj: 50e-6, r1: 240, uaMin: 1.25, uaMax: 37, ilmin: 0.010,
    vdo: { a25: 1.5, b25: 0.3333, a125: 1.6, b125: 0.36 },
    ilim: { i1: 2.2, du1: 15, i2: 0.4, du2: 40 },
    limits: { duRec: [3, 40], duAbs: 40, iRec: [0.01, 1.5] }, shutdown: { on: K.SHUT_ON, off: K.SHUT_OFF }
  });
  addDev({
    id: 'bd139', name: 'TF-BD139 (NPN, 1,5 A)', part: 'TF-BD139', pkg: 'TO-126', kind: 'bipolar', tjMax: 150, rthJC: 10, rthJA: 100, ptot: 1.25, ptotFree: 1.25, ptotCase: 12.5,
    source: 'tf-bd139', fromDs: true, tab: { pin: 2, name: 'C', pot: 'kollektor', potText: 'dem Kollektor (Pin 2, C)' },
    vcesat: 0.2, icSat: 0.5, limits: { vceRec: 60, vceAbs: 80, iRec: 1.0, iAbs: 1.5 }, destroyAt: 150 + K.DEFEKT_K
  });
  addDev({
    id: 'irlz34n', name: 'TF-IRLZ34N (55 V, Logic-Level)', part: 'TF-IRLZ34N', pkg: 'TO-220', kind: 'mosfet', tjMax: 175, rthJC: 2.2, rthJA: 62, ptot: 2.4, ptotFree: 2.4, ptotCase: 68,
    source: 'tf-irlz', fromDs: true, tab: { pin: 2, name: 'D', pot: 'drain', potText: 'dem Drain (Pin 2, D)' },
    rdsTyp: { '10': 0.028, '5': 0.037, '4.5': 0.040 }, rdsMax: { '10': 0.035, '5': 0.046, '4.5': 0.050 }, alpha: 0.0065,
    tr: 100e-9, tf: 45e-9, rgRef: 4.5, vddRef: 28,
    limits: { vdsRec: 44, vdsAbs: 55, iRec: 20 }, destroyAt: 175 + K.DEFEKT_K
  });
  addDev({
    id: '1n4007', name: 'TF-1N4007 (Gleichrichterdiode, 1 A)', part: 'TF-1N4007', pkg: 'DO-41', kind: 'diode', tjMax: 175, rthJC: 25, rthJA: 100, ptot: 1.5, ptotFree: 1.5, rthJL: 25,
    source: 'tf-1n4007', fromDs: true, tab: { pin: 0, name: '', pot: 'keine', potText: '' }, noSink: true,
    u0: 0.87, rF: 0.06, ffList: [1, PI / 2, 3], limits: { iRec: 1.0 }
  });
  addDev({
    id: 'r-zement5', name: 'Zementwiderstand 5 W', part: 'Zementwiderstand 5 W', pkg: 'Zement', kind: 'resistor', tjMax: 200, rthJC: 0, rthJA: 35, ptot: 5, ptotFree: 5, pNenn: 5,
    source: 'Übungswert', fromDs: false, tab: { pin: 0, name: '', pot: 'keine', potText: '' }, noSink: true, limits: {}
  });
  addDev({
    id: 'r-alu50', name: 'Alu-Gehäusewiderstand 50 W', part: 'Alu-Gehäusewiderstand 50 W', pkg: 'Alu', kind: 'resistor', tjMax: 200, rthJC: 1.2, rthJA: 20, ptot: 8.75, ptotFree: 8.75, pNenn: 50,
    source: 'Übungswert', fromDs: false, tab: { pin: 0, name: '', pot: 'isoliert', potText: 'isoliert' }, needsSink: true, limits: {}
  });
  addDev({
    id: 'led3w', name: 'Power-LED 3 W auf Sternplatine', part: 'Power-LED 3 W', pkg: 'LED', kind: 'led', tjMax: 125, rthJC: 6, rthJA: 40, ptot: 3, ptotFree: 3,
    source: 'Übungswert', fromDs: false, tab: { pin: 0, name: '', pot: 'isoliert', potText: 'isoliert' },
    uf: 3.2, i0: 0.7, etaTh: 0.7, vref: 1.25, limits: { nMax: 4 }
  });
  const DEV_IDS = ['7805', 'lm317', 'bd139', 'irlz34n', '1n4007', 'r-zement5', 'r-alu50', 'led3w'];
  DEV_IDS.forEach(function (id) {
    const d = DEV[id], p = packages[d.pkg];
    d.cthC = p.cthC; d.cthJ = p.cthJ; d.pkgName = p.name;
    d.rthCA = d.rthJA - d.rthJC;
  });

  /* ---------- Verlustleistung (SPEC 4.3): Rueckgabe { ok, p, value, steps, why } ---------- */
  function pOk(p, steps, extra) { const o = { ok: true, p: p, value: p, steps: steps }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function pBad(why, extra) { const o = { ok: false, p: NaN, value: NaN, why: why, steps: [] }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function pLinear(ue, ua, ia, iq) {
    ue = num(ue, NaN); ua = num(ua, NaN); ia = num(ia, NaN);
    if (!isFinite(ue) || !isFinite(ua) || !isFinite(ia)) return pBad(TXT.ungueltig);
    if (ue < 0 || ua < 0) return pBad(TXT.uNeg);
    if (ia < 0) return pBad(TXT.iNeg);
    if (ue < ua) return pBad(TXT.ueUa);
    const ohne = (ue - ua) * ia;
    const steps = ['P = (Ue − Ua) · Ia = (' + fmt(ue) + ' V − ' + fmt(ua) + ' V) · ' + fmt(ia) + ' A = ' + fmt(ohne) + ' W'];
    const q = num(iq, NaN);
    if (isFinite(q) && q >= 0) {
      const mit = ohne + ue * q;
      steps.push('mit Ruhestrom: P = (Ue − Ua) · Ia + Ue · Iq = ' + fmt(ohne) + ' W + ' + fmt(ue) + ' V · ' + fmt(q * 1000) + ' mA = ' + fmt(mit) + ' W');
      return pOk(mit, steps, { pOhneIq: ohne, pMitIq: mit, alt: [ohne] });
    }
    return pOk(ohne, steps, { pOhneIq: ohne });
  }
  function pBipolar(uce, ic) {
    uce = num(uce, NaN); ic = num(ic, NaN);
    if (!isFinite(uce) || !isFinite(ic)) return pBad(TXT.ungueltig);
    if (uce < 0) return pBad(TXT.uNeg);
    if (ic < 0) return pBad(TXT.iNeg);
    const p = uce * ic;
    return pOk(p, ['P = UCE · IC = ' + fmt(uce) + ' V · ' + fmt(ic) + ' A = ' + fmt(p) + ' W']);
  }
  function pEndstufe(ub, rl, a) {
    ub = num(ub, NaN); rl = num(rl, NaN);
    if (!isFinite(ub) || !isFinite(rl)) return pBad(TXT.ungueltig);
    if (ub < 0) return pBad(TXT.uNeg);
    if (!(rl > 0)) return pBad(TXT.rPos);
    const pMax = ub * ub / (PI * PI * rl), aMax = 2 / PI;
    const steps = ['P_max = Ub² / (π² · RL) = (' + fmt(ub) + ' V)² / (π² · ' + fmt(rl) + ' Ω) = ' + fmt(pMax) + ' W bei Û = 2·Ub/π = ' + fmt(2 * ub / PI) + ' V (Aussteuerung ' + fmt(aMax * 100, 1) + ' %)'];
    let note = '';
    let p = pMax, aEff = aMax;
    if (a !== undefined && a !== null) {
      let av = num(a, NaN);
      if (!isFinite(av)) return pBad(TXT.ungueltig);
      const cl = clamp(av, 0, 1);
      if (cl !== av) note = fill(TXT.aKlemm, { a: fmt(cl * 100, 0) });
      aEff = cl;
      const uh = aEff * ub;
      p = (ub * uh / PI - uh * uh / 4) / rl;
      steps.unshift('P(Û) = (Ub · Û / π − Û² / 4) / RL mit Û = a · Ub = ' + fmt(uh) + ' V: P = ' + fmt(p) + ' W je Transistor');
    }
    return pOk(p, steps, { pMax: pMax, aMax: aMax, uHatMax: 2 * ub / PI, a: aEff, note: note });
  }
  function rdsAt(rds25, tj, alpha) { return rds25 * (1 + alpha * (tj - 25)); }
  function pMosfet(o) {
    o = isObj(o) ? o : null;
    if (!o) return pBad(TXT.ungueltig);
    const i = num(o.i, NaN), d0 = num(o.d, 1), r25 = num(o.rds25, NaN), tj = num(o.tj, 25), al = num(o.alpha, 0.0065);
    const u = num(o.u, 0), f = num(o.f, 0), tr = num(o.tr, 0), tf = num(o.tf, 0);
    if (!isFinite(i) || !isFinite(r25) || !isFinite(d0)) return pBad(TXT.ungueltig);
    if (i < 0) return pBad(TXT.iNeg);
    if (!(r25 > 0)) return pBad(TXT.rPos);
    if (u < 0) return pBad(TXT.uNeg);
    if (f < 0 || tr < 0 || tf < 0) return pBad(TXT.ungueltig);
    let note = '';
    const d = clamp(d0, 0, 1);
    if (d !== d0) note = fill(TXT.dKlemm, { d: fmt(d * 100, 0) });
    const switching = d > 0 && d < 1;
    if (switching && f * (tr + tf) > 0.5) return pBad(TXT.schaltzeit);
    const rds = rdsAt(r25, tj, al);
    const pl = d * i * i * rds;
    const ps = switching ? 0.5 * u * i * (tr + tf) * f : 0;
    if (d >= 1 && f > 0 && u > 0 && i > 0) note = (note ? note + ' ' : '') + TXT.dauerKeinSchalten;
    const steps = ['RDS(on)(Tj) = RDS(on,25) · (1 + α · (Tj − 25 °C)) = ' + fmt(r25 * 1000) + ' mΩ · (1 + ' + fmt(al) + ' /K · ' + fmt(tj - 25) + ' K) = ' + fmt(rds * 1000) + ' mΩ',
      'P_leit = D · I² · RDS(on) = ' + fmt(d) + ' · (' + fmt(i) + ' A)² · ' + fmt(rds * 1000) + ' mΩ = ' + fmt(pl) + ' W'];
    if (switching) steps.push('P_sw = ½ · U · I · (tr + tf) · f = ½ · ' + fmt(u) + ' V · ' + fmt(i) + ' A · ' + fmt((tr + tf) * 1e9) + ' ns · ' + fmt(f) + ' Hz = ' + fmt(ps) + ' W (Näherung, lineare Überlappung)');
    steps.push('P = P_leit + P_sw = ' + fmt(pl) + ' W + ' + fmt(ps) + ' W = ' + fmt(pl + ps) + ' W');
    return pOk(pl + ps, steps, { pLeit: pl, pSw: ps, rds: rds, rds25: r25, d: d, note: note });
  }
  function pDiode(o) {
    o = isObj(o) ? o : null;
    if (!o) return pBad(TXT.ungueltig);
    const i = num(o.i, NaN), ff = num(o.ff, 1), u0 = num(o.u0, 0.87), rf = num(o.rf, 0.06);
    if (!isFinite(i)) return pBad(TXT.ungueltig);
    if (i < 0 || ff < 0 || u0 < 0 || rf < 0) return pBad(TXT.iNeg);
    const irms = ff * i, p = u0 * i + rf * irms * irms;
    return pOk(p, ['I_rms = FF · I_avg = ' + fmt(ff) + ' · ' + fmt(i) + ' A = ' + fmt(irms) + ' A',
      'P = U0 · I_avg + rF · I_rms² = ' + fmt(u0) + ' V · ' + fmt(i) + ' A + ' + fmt(rf) + ' Ω · (' + fmt(irms) + ' A)² = ' + fmt(p) + ' W'], { irms: irms });
  }
  function pResistor(a, b) {
    let u = NaN, iv = NaN, r = NaN;
    if (isObj(a)) { u = num(a.u, NaN); iv = num(a.i, NaN); r = num(a.r, NaN); }
    else { u = num(a, NaN); r = num(b, NaN); }
    if (!isFinite(r)) return pBad(TXT.ungueltig);
    if (!(r > 0)) return pBad(TXT.rPos);
    if (isFinite(u)) {
      const p = u * u / r;
      return pOk(p, ['P = U² / R = (' + fmt(u) + ' V)² / ' + fmt(r) + ' Ω = ' + fmt(p) + ' W'], { i: u / r });
    }
    if (isFinite(iv)) {
      if (iv < 0) return pBad(TXT.iNeg);
      const p = iv * iv * r;
      return pOk(p, ['P = I² · R = (' + fmt(iv) + ' A)² · ' + fmt(r) + ' Ω = ' + fmt(p) + ' W'], { u: iv * r });
    }
    return pBad(TXT.ungueltig);
  }
  function pLed(o) {
    o = isObj(o) ? o : null;
    if (!o) return pBad(TXT.ungueltig);
    const n = num(o.n, NaN), uf = num(o.uf, 3.2), i = num(o.i, NaN), eta = num(o.etaTh, 0.7);
    if (!isFinite(n) || !isFinite(i)) return pBad(TXT.ungueltig);
    if (n < 1) return pBad(TXT.nMin);
    if (i < 0 || uf < 0 || eta < 0 || eta > 1) return pBad(TXT.ungueltig);
    const p = eta * n * uf * i;
    return pOk(p, ['P_th = η_th · n · UF · I = ' + fmt(eta) + ' · ' + fmt(n) + ' · ' + fmt(uf) + ' V · ' + fmt(i) + ' A = ' + fmt(p) + ' W'], { pEl: n * uf * i });
  }
  function pSwitching(pa, eta) {
    pa = num(pa, NaN); let e = num(eta, K.ETA_SW);
    if (!isFinite(pa) || !isFinite(e)) return pBad(TXT.ungueltig);
    if (pa < 0) return pBad(TXT.pNeg);
    let note = '';
    if (e < K.ETA_MIN || e > K.ETA_MAX) { note = fill(TXT.etaKlemm, { lo: fmt(K.ETA_MIN * 100, 0), hi: fmt(K.ETA_MAX * 100, 0) }); e = clamp(e, K.ETA_MIN, K.ETA_MAX); }
    const p = pa * (1 / e - 1);
    return pOk(p, ['P_V = Pa · (1/η − 1) = ' + fmt(pa) + ' W · (1/' + fmt(e) + ' − 1) = ' + fmt(p) + ' W'], { eta: e, pIn: pa + p, note: note });
  }
  const power = {
    linear: S(pLinear), bipolar: S(pBipolar), endstufe: S(pEndstufe), mosfet: S(pMosfet), diode: S(pDiode), resistor: S(pResistor), led: S(pLed), switching: S(pSwitching)
  };
  /* Verlustleistung je Bauteil aus dem Betriebspunkt op (Prueflogik wie im Rechner); op-Felder siehe devices[id].elec */
  function pMosfetDev(o) {
    return pMosfet(o);
  }

  /* =====================================================================================================
   *  BAUTEILE: Elektrik (elec) und Betriebspunkt
   * ===================================================================================================== */
  /* Linearregler: state { ue, ua (nur lm317), loadMode:'strom'|'widerstand', iLoad, rLoad, tj, iq:bool (Standard true), shut:bool } */
  function linearElec(dev, s) {
    s = isObj(s) ? s : {};
    const ue = num(s.ue, NaN);
    if (!isFinite(ue) || ue < 0) return fail(TXT.ungueltig);
    const tj = num(s.tj, 25), iqOn = s.iq !== false, shut = s.shut === true;
    const lm = dev.id === 'lm317';
    const uaSet = lm ? clamp(num(s.ua, 5), dev.uaMin, dev.uaMax) : dev.uaFix;
    const mode = s.loadMode === 'widerstand' ? 'widerstand' : 'strom';
    const iLoad = Math.max(0, num(s.iLoad, 0));
    const rLoad = pos(s.rLoad, NaN);
    if (mode === 'widerstand' && !isFinite(rLoad)) return fail(TXT.rPos);
    const iqDev = lm ? dev.iadj : dev.iq;
    const extra = lm && iqOn ? dev.vref / dev.r1 : 0;      // Teilerstrom durch R1 zaehlt zur Last (A15)
    const ilmin = lm ? dev.ilmin : NaN;
    const out = { ok: true, uaSet: uaSet, ue: ue, tj: tj, mode: mode, shut: shut, dropout: false, ilimit: false, minlast: false, ilim: NaN, vdo: NaN, steps: [] };
    if (shut) {
      out.ua = 0; out.ia = 0; out.io = 0; out.pv = ue * iqDev; out.du = ue; out.iin = iqDev; out.eta = 0;
      out.steps.push('Thermische Abschaltung: Ia = 0, Ua = 0, P = Ue · Iq = ' + fmt(ue) + ' V · ' + fmt(iqDev * 1000) + ' mA = ' + fmt(out.pv) + ' W');
      return out;
    }
    // 1. Dropout (Rueckkopplung ueber den Strom nur bei Widerstandslast)
    let ua = uaSet, ia = mode === 'strom' ? iLoad : uaSet / rLoad, vdo = NaN;
    for (let it = 0; it < 80; it++) {
      vdo = vdoOf(dev, ia + extra, tj);
      const uaTry = Math.max(0, Math.min(uaSet, ue - vdo));
      const iaNew = mode === 'strom' ? iLoad : uaTry / rLoad;
      const conv = Math.abs(uaTry - ua) < 1e-13 && Math.abs(iaNew - ia) < 1e-13;
      ua = uaTry; ia = iaNew;
      if (conv) break;
    }
    out.vdo = vdo;
    if (ue - vdo < uaSet) {
      out.dropout = true;
      out.steps.push('Dropout: Ue − Ua,soll = ' + fmt(ue - uaSet) + ' V ist kleiner als V_DO = ' + fmt(vdo) + ' V, deshalb Ua = Ue − V_DO = ' + fmt(ua) + ' V');
    }
    // 2. Strombegrenzung
    let io = ia + extra;
    let lim = ilimOf(dev, ue - ua);
    if (io > lim + 1e-12) {
      out.ilimit = true;
      const R = mode === 'strom' ? (iLoad > 0 ? ua / iLoad : NaN) : rLoad;
      if (isFinite(R) && R > 0) {
        const Ia0 = ua / R;
        const g = function (x) { return ilimOf(dev, ue - x * R) - (x + extra); };
        let hi = Ia0, lo = 0, found = false;
        const N = 600;
        for (let k = 0; k <= N; k++) {
          const x = Ia0 * (1 - k / N);
          if (g(x) >= 0) { lo = x; hi = Ia0 * (1 - Math.max(0, k - 1) / N); found = true; break; }
        }
        if (!found) { lo = 0; hi = 0; }
        for (let k = 0; k < 80 && hi > lo; k++) { const mid = (lo + hi) / 2; if (g(mid) >= 0) lo = mid; else hi = mid; }
        ia = lo; ua = ia * R;
      } else { ia = Math.max(0, lim - extra); }
      io = ia + extra;
      lim = ilimOf(dev, ue - ua);
      out.steps.push('Strombegrenzung: Der Regler liefert höchstens ' + fmt(lim) + ' A bei Ue − Ua = ' + fmt(ue - ua) + ' V, dadurch Ia = ' + fmt(ia) + ' A und Ua = ' + fmt(ua) + ' V');
    }
    out.ilim = lim;
    out.ua = ua; out.ia = ia; out.io = io; out.du = ue - ua;
    const iqTerm = iqOn ? ue * iqDev : 0;
    out.pv = (ue - ua) * io + iqTerm;
    out.iin = io + (iqOn ? iqDev : 0);
    out.eta = out.iin > 0 ? (ua * ia) / (ue * out.iin) : 0;
    out.minlast = lm ? (ia + dev.vref / dev.r1) < ilmin : false;
    out.steps.unshift('P = (Ue − Ua) · Ia' + (lm && iqOn ? ' (Ia einschließlich Teilerstrom ' + fmt(extra * 1000) + ' mA)' : '') + (iqOn ? ' + Ue · Iq' : '') + ' = (' + fmt(ue) + ' V − ' + fmt(ua) + ' V) · ' + fmt(io) + ' A' + (iqOn ? ' + ' + fmt(ue) + ' V · ' + fmt(iqDev * 1000) + ' mA' : '') + ' = ' + fmt(out.pv) + ' W');
    return out;
  }
  function bipolarElec(dev, s) {
    s = isObj(s) ? s : {};
    if (s.mode === 'endstufe') {
      const r = pEndstufe(s.ub, s.rl, s.a === undefined ? undefined : s.a);
      return r.ok ? Object.assign({ pv: r.p }, r) : r;
    }
    const r = pBipolar(s.uce, s.ic);
    if (!r.ok) return r;
    return Object.assign({ pv: r.p, uce: num(s.uce, 0), ic: num(s.ic, 0) }, r);
  }
  function rdsOfDev(dev, vgs, spec) {
    const tab = spec === 'max' ? dev.rdsMax : dev.rdsTyp;
    const key = String(Number(vgs));
    return has(tab, key) ? tab[key] : NaN;
  }
  function mosfetElec(dev, s) {
    s = isObj(s) ? s : {};
    const r25 = rdsOfDev(dev, num(s.vgs, 5), s.spec === 'max' ? 'max' : 'typ');
    if (!isFinite(r25)) return fail(TXT.wertAblehnen);
    const hot = s.hot !== false;
    const r = pMosfet({ i: s.i, d: s.d === undefined ? 1 : s.d, rds25: r25, tj: hot ? num(s.tj, 25) : 25, alpha: dev.alpha, u: s.u, f: s.f, tr: dev.tr, tf: dev.tf });
    return r.ok ? Object.assign({ pv: r.p }, r) : r;
  }
  function diodeElec(dev, s) {
    s = isObj(s) ? s : {};
    const r = pDiode({ i: s.i, ff: s.ff === undefined ? 1 : s.ff, u0: dev.u0, rf: dev.rF });
    if (!r.ok) return r;
    const i = num(s.i, 0);
    return Object.assign({ pv: r.p, uF: dev.u0 + dev.rF * i }, r);
  }
  function resistorElec(dev, s) {
    s = isObj(s) ? s : {};
    const r = pResistor(isObj(s) && s.u !== undefined ? { u: s.u, r: s.r } : { i: s.i, r: s.r });
    return r.ok ? Object.assign({ pv: r.p }, r) : r;
  }
  /* Power-LED: state { n 1..4, ub, iLed, driver:'vorwiderstand'|'lm317cc', tj? }. Treiberverlust: siehe ABWEICHUNGEN (WP1a). */
  function ledElec(dev, s) {
    s = isObj(s) ? s : {};
    const n = Math.round(num(s.n, NaN)), ub = num(s.ub, NaN), iSet = num(s.iLed, NaN);
    if (!isFinite(n) || !isFinite(ub) || !isFinite(iSet) || n < 1 || n > dev.limits.nMax || ub < 0 || !(iSet > 0)) return fail(TXT.ungueltig);
    const uLed = n * dev.uf, headroom = ub - uLed;
    const driver = s.driver === 'lm317cc' ? 'lm317cc' : 'vorwiderstand';
    const out = { ok: true, driver: driver, n: n, uLed: uLed, headroom: headroom, steps: [], dropout: false };
    if (headroom <= 0) { out.i = 0; out.pTh = 0; out.pTreiber = 0; out.pReg = 0; out.pRs = 0; out.rV = NaN; out.uRs = 0; out.pv = 0; out.eta = 0; out.noLight = true; out.steps.push('Die Betriebsspannung reicht nicht für ' + n + ' LED in Reihe: ' + fmt(ub) + ' V < ' + fmt(uLed) + ' V.'); return out; }
    if (driver === 'vorwiderstand') {
      const rExact = headroom / iSet;
      const rV = eSeries('E12', rExact, 'up');
      const iAct = headroom / rV;
      out.rV = rV; out.rExact = rExact; out.i = iAct; out.uRs = rV * iAct; out.pRs = out.uRs * iAct; out.pReg = 0; out.pTreiber = out.pRs;
      out.steps.push('R_V = (Ub − n · UF) / I = (' + fmt(ub) + ' V − ' + fmt(uLed) + ' V) / ' + fmt(iSet) + ' A = ' + fmt(rExact) + ' Ω, aufgerundet auf E12: ' + fmt(rV) + ' Ω');
      out.steps.push('I = (Ub − n · UF) / R_V = ' + fmt(iAct) + ' A; P_Treiber = U_Rs · I = ' + fmt(out.uRs) + ' V · ' + fmt(iAct) + ' A = ' + fmt(out.pTreiber) + ' W');
    } else {
      const lmDev = DEV.lm317;
      const rS = lmDev.vref / iSet;
      let iAct = iSet;
      const vdoSet = vdoOf(lmDev, iSet, num(s.tj, 25));
      if (headroom - lmDev.vref < vdoSet) {            // Dropout: der Regler regelt nicht mehr
        const a = lmDev.vdo.a25, b = lmDev.vdo.b25;
        iAct = Math.max(0, (headroom - a) / (rS + b));
        out.dropout = true;
      }
      out.rS = rS; out.i = iAct; out.uRs = iAct * rS; out.pRs = out.uRs * iAct; out.pReg = (headroom - out.uRs) * iAct; out.pTreiber = out.pReg + out.pRs; out.rV = NaN;
      out.vdo = vdoOf(lmDev, iAct, num(s.tj, 25));
      out.steps.push('R_S = Vref / I = ' + fmt(lmDev.vref) + ' V / ' + fmt(iSet) + ' A = ' + fmt(rS) + ' Ω; P_LM317 = (Ub − n · UF − U_Rs) · I = ' + fmt(out.pReg) + ' W; P_Rs = ' + fmt(out.pRs) + ' W');
    }
    const pl = pLed({ n: n, uf: dev.uf, i: out.i, etaTh: dev.etaTh });
    out.pTh = pl.p; out.pEl = n * dev.uf * out.i;
    out.pv = out.pTh;
    out.eta = ub * out.i > 0 ? out.pEl / (ub * out.i) : 0;
    out.steps.push(pl.steps[0]);
    return out;
  }
  DEV['7805'].elec = S(function (s) { return linearElec(DEV['7805'], s); });
  DEV.lm317.elec = S(function (s) { return linearElec(DEV.lm317, s); });
  DEV.bd139.elec = S(function (s) { return bipolarElec(DEV.bd139, s); });
  DEV.irlz34n.elec = S(function (s) { return mosfetElec(DEV.irlz34n, s); });
  DEV['1n4007'].elec = S(function (s) { return diodeElec(DEV['1n4007'], s); });
  DEV['r-zement5'].elec = S(function (s) { return resistorElec(DEV['r-zement5'], s); });
  DEV['r-alu50'].elec = S(function (s) { return resistorElec(DEV['r-alu50'], s); });
  DEV.led3w.elec = S(function (s) { return ledElec(DEV.led3w, s); });
  DEV_IDS.forEach(function (id) { DEV[id].p = function (op) { const r = DEV[id].elec(op); return r && r.ok ? r.pv : NaN; }; });
  /* Funktionen der Linearregler als Teil von devices */
  DEV['7805'].dropout = C(function (i, tj) { return vdoOf(DEV['7805'], i, tj); });
  DEV.lm317.dropout = C(function (i, tj) { return vdoOf(DEV.lm317, i, tj); });
  DEV['7805'].ilimAt = C(function (du) { return ilimOf(DEV['7805'], du); });
  DEV.lm317.ilimAt = C(function (du) { return ilimOf(DEV.lm317, du); });
  DEV.irlz34n.rdsAt = C(function (vgs, spec, tj) { const r = rdsOfDev(DEV.irlz34n, num(vgs, 5), spec === 'max' ? 'max' : 'typ'); return isFinite(r) ? rdsAt(r, num(tj, 25), DEV.irlz34n.alpha) : NaN; });
  const devices = DEV;
  hide(devices, 'ids', DEV_IDS);
  /* shutdownStep(prevShut, tj, devId): Hysterese der thermischen Abschaltung (ein Wechsel je Aufruf) */
  function shutdownStep(prev, tj, id) {
    const d = has(DEV, id) ? DEV[id] : null;
    tj = num(tj, NaN);
    if (!d || !d.shutdown) return false;
    if (!isFinite(tj)) return prev === true;
    if (prev === true) return !(tj <= d.shutdown.off);
    return tj >= d.shutdown.on;
  }

  /* shutdownSense(tc, pOn, rthJC | cfg): Vergleichstemperatur der Abschaltung = Tj bei leitendem Regler = Tc + P_ein * Rth_JC.
   * (Wuerde man die Sperrschichttemperatur selbst vergleichen, faellt sie beim Abschalten sofort um P * Rth_JC; ist das groesser als die Hysterese
   *  von 10 K, flackert der Regler im Takt der Rechenschritte statt zu pendeln. Siehe ABWEICHUNGEN.md.) */
  function shutdownSense(tc, pOn, rth) {
    tc = num(tc, NaN); pOn = num(pOn, NaN);
    const r = isObj(rth) ? (chain(rth).ok ? chain(rth).rthJC : NaN) : num(rth, NaN);
    return isFinite(tc) && pOn >= 0 && r >= 0 ? tc + pOn * r : NaN;
  }
  /* tempRange(device, ta): Anzeigebereich der Temperaturen { lo, hi, unit, digits } = Ta ... Tshut bzw. Tj,max + 30 K (SPEC 5) */
  function tempRange(id, ta) {
    const d = has(DEV, id) ? DEV[id] : null;
    if (!d) return fail(TXT.ungueltig);
    const a = ta === undefined || ta === null ? 0 : num(ta, NaN);
    if (!isFinite(a)) return fail(TXT.ungueltig);
    return { ok: true, lo: Math.min(a, 0), hi: d.shutdown ? d.shutdown.on + 10 : d.tjMax + 30, unit: '°C', digits: 0, tjMax: d.tjMax, tShut: d.shutdown ? d.shutdown.on : NaN };
  }

  /* =====================================================================================================
   *  WAERMEKETTE: Konfiguration, chain (SPEC 4.1)
   * ===================================================================================================== */
  const HS_OPTS = ['none', 'fahne', 's', 'm', 'l', 'xl', 'blech', 'custom'];
  function normCfg(cfg) {
    if (!isObj(cfg)) return fail('Der Aufbau fehlt (cfg muss ein Objekt sein).');
    const c = cfg;
    const dev = c.device === undefined || c.device === null ? '7805' : c.device;
    if (!has(DEV, dev)) return fail(TXT.ungueltigerAufbau + ' Das Bauteil „' + String(dev) + '“ gibt es nicht.');
    const o = {
      device: dev,
      heatsink: c.heatsink === undefined || c.heatsink === null ? 'none' : c.heatsink,
      joint: c.joint === undefined || c.joint === null ? 'direkt' : c.joint,
      paste: c.paste === undefined || c.paste === null ? 'duenn' : (c.paste === 'geliefert' ? 'keine' : c.paste),
      bushing: c.bushing === undefined ? true : c.bushing !== false,
      screw: c.screw === undefined || c.screw === null ? 'fest' : (c.screw === 'geliefert' ? 'locker' : c.screw),
      ksPot: c.ksPot === undefined || c.ksPot === null ? 'masse' : c.ksPot,
      fan: c.fan === undefined || c.fan === null ? 'aus' : c.fan,
      orient: c.orient === undefined || c.orient === null ? 'senkrecht' : c.orient,
      count: c.count === undefined || c.count === null ? 1 : Math.round(num(c.count, NaN)),
      nonlin: c.nonlin === true,
      blech: isObj(c.blech) ? c.blech : null, custom: isObj(c.custom) ? c.custom : null,
      overrides: isObj(c.overrides) ? c.overrides : {}
    };
    if (HS_OPTS.indexOf(o.heatsink) < 0) return fail(TXT.ungueltigerAufbau + ' Den Kühlkörper „' + String(o.heatsink) + '“ gibt es nicht.');
    if (JOINTS.indexOf(o.joint) < 0) return fail(TXT.ungueltigerAufbau + ' Den Übergang „' + String(o.joint) + '“ gibt es nicht.');
    if (PASTES.indexOf(o.paste) < 0) return fail(TXT.ungueltigerAufbau + ' Die Paste „' + String(o.paste) + '“ gibt es nicht.');
    if (SCREWS.indexOf(o.screw) < 0) return fail(TXT.ungueltigerAufbau + ' Die Schraube „' + String(o.screw) + '“ gibt es nicht.');
    if (o.ksPot !== 'masse' && o.ksPot !== 'frei') return fail(TXT.ungueltigerAufbau + ' Das Potenzial „' + String(o.ksPot) + '“ gibt es nicht.');
    if (!has(fan, o.fan)) return fail(TXT.ungueltigerAufbau + ' Den Lüfter „' + String(o.fan) + '“ gibt es nicht.');
    if (!has(orient, o.orient)) return fail(TXT.ungueltigerAufbau + ' Die Einbaulage „' + String(o.orient) + '“ gibt es nicht.');
    if (!(o.count >= 1 && o.count <= 4)) return fail(TXT.ungueltigerAufbau + ' Die Anzahl muss 1 bis 4 sein.');
    return { ok: true, cfg: o };
  }
  function chain(cfgIn) {
    const nc = normCfg(cfgIn);
    if (!nc.ok) return nc;
    const cfg = nc.cfg, dev = DEV[cfg.device], ov = cfg.overrides;
    const notes = [], faults = [];
    const ovn = function (k) { const v = num(ov[k], NaN); return isFinite(v) && v >= 0 ? v : NaN; };
    let free = cfg.heatsink === 'none';
    if (dev.noSink && !free) { free = true; notes.push(TXT.keinSockel); }
    const rthJC = isFinite(ovn('rthJC')) ? ovn('rthJC') : dev.rthJC;
    const cthJ = isFinite(ovn('cthJ')) ? ovn('cthJ') : dev.cthJ;
    const cthC = isFinite(ovn('cthC')) ? ovn('cthC') : dev.cthC;
    const out = { ok: true, device: cfg.device, dev: dev, pkg: dev.pkg, tjMax: ovn('tjMax') > 0 ? ovn('tjMax') : dev.tjMax, cfg: cfg, notes: notes, faults: faults, count: free ? 1 : cfg.count, hs: null };
    out.rthJC = rthJC;
    if (free) {
      const rthJA = isFinite(ovn('rthJA')) ? ovn('rthJA') : dev.rthJA;
      out.mode = 'frei'; out.rthJA = rthJA; out.rthCA = Math.max(0, rthJA - rthJC);
      out.rthCK = 0; out.rthK = 0; out.rthK0 = 0; out.fanF = 1; out.orientF = 1; out.rthTotal = rthJA;
      out.cth = { j: cthJ, c: cthC, k: 0 };
      if (dev.needsSink) notes.push(TXT.nurMitKK);
      return out;
    }
    // Montage mit Kuehlkoerper
    out.mode = 'kk';
    const rck = isFinite(ovn('rthCK')) ? ovn('rthCK') : rthCK(dev.pkg, cfg.joint, cfg.paste, cfg.screw);
    if (!isFinite(rck)) return fail(TXT.ungueltigerAufbau + ' Für dieses Bauteil gibt es keine Montage auf einen Kühlkörper.');
    out.rthCK = rck;
    let rthK0, cthK, hs = null;
    if (cfg.heatsink === 'blech') {
      const b = blechOf(cfg.blech || { A_cm2: 100, d_mm: 2, material: 'al' });
      if (!b.ok) return b;
      rthK0 = b.rthK; cthK = b.cthK;
    } else if (cfg.heatsink === 'custom') {
      const cu = cfg.custom;
      const r = cu ? num(cu.rthK, NaN) : NaN, mg = cu ? num(cu.massG, NaN) : NaN;
      const mat = cu ? matOf(cu.material || 'al') : null;
      if (!(r > 0) || !(mg >= 0) || !mat || !mat.c) return fail(TXT.ungueltigerAufbau + ' Der Selbstbau-Kühlkörper braucht Rth_K > 0, eine Masse und das Material Aluminium oder Kupfer.');
      rthK0 = r; cthK = mg / 1000 * mat.c;
    } else {
      hs = hsById[cfg.heatsink];
      rthK0 = hs.rthK; cthK = hs.cthK;
      if (hs.id === 'fahne' && dev.pkg !== 'TO-220') notes.push(TXT.fahneTO220);
    }
    out.hs = hs;
    if (isFinite(ovn('rthK'))) rthK0 = ovn('rthK');
    if (isFinite(ovn('cthK'))) cthK = ovn('cthK');
    out.rthK0 = rthK0; out.fanF = fan[cfg.fan]; out.orientF = orient[cfg.orient];
    out.rthK = rthK0 * out.fanF * out.orientF;
    out.rthTotal = rthJC + rck + out.count * out.rthK;
    out.cth = { j: cthJ, c: cthC, k: cthK };
    out.rthJA = dev.rthJA; out.rthCA = Math.max(0, dev.rthJA - dev.rthJC);
    // Hinweise und Fehlerzustaende
    if (cfg.joint === 'silikon' && cfg.paste !== 'keine') notes.push(TXT.silikonPaste);
    const tabPot = dev.tab.pot;
    const contact = cfg.joint === 'direkt' || cfg.bushing === false;
    if (cfg.joint !== 'direkt' && cfg.bushing === false) faults.push('buchse-fehlt');
    if (tabPot !== 'masse' && tabPot !== 'isoliert' && tabPot !== 'keine' && cfg.ksPot === 'masse' && contact) faults.push('kurzschluss');
    if (cfg.screw === 'locker') faults.push('locker');
    if (cfg.paste === 'keine' && cfg.joint !== 'silikon') faults.push('paste-fehlt');
    if (cfg.paste === 'dick' && cfg.joint !== 'silikon') faults.push('dick');
    return out;
  }

  /* ---------- steady (SPEC 4.4) ---------- */
  function nonlinFactor(dTk) { return Math.pow(Math.max(num(dTk, 1), 1) / K.NONLIN_REF, K.NONLIN_EXP); }
  function steady(cfgIn, P, ta, opts) {
    const ch = chain(cfgIn);
    if (!ch.ok) return ch;
    const p = num(P, NaN);
    if (!(p >= 0)) return fail(TXT.pNeg);
    const a = ta === undefined || ta === null ? K.TA_STD : num(ta, NaN);
    if (!isFinite(a)) return fail(TXT.ungueltig);
    opts = isObj(opts) ? opts : {};
    const n = ch.count;
    let rthK = ch.rthK;
    const nonlin = (opts.nonlin === true || ch.cfg.nonlin === true) && ch.mode === 'kk';
    if (nonlin) {
      let x = rthK;
      for (let i = 0; i < 100; i++) {
        const nx = ch.rthK0 * ch.fanF * ch.orientF * nonlinFactor(n * p * x);
        if (Math.abs(nx - x) < 1e-13) { x = nx; break; }
        x = nx;
      }
      rthK = x;
    }
    const out = { ok: true, mode: ch.mode, p: p, ta: a, count: n, tjMax: ch.tjMax, rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: rthK, faults: ch.faults.slice(), nonlin: nonlin };
    const S1 = sym('Rth_ges');
    if (ch.mode === 'kk') {
      out.tk = a + n * p * rthK; out.tc = out.tk + p * ch.rthCK; out.tj = out.tc + p * ch.rthJC;
      out.dJC = p * ch.rthJC; out.dCK = p * ch.rthCK; out.dK = n * p * rthK; out.dCA = 0;
      out.rthTotal = ch.rthJC + ch.rthCK + n * rthK;
      out.steps = [
        S1 + ' = ' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ' + ' + (n > 1 ? n + ' · ' : '') + sym('Rth_K') + ' = ' + fmt(ch.rthJC) + ' K/W + ' + fmt(ch.rthCK) + ' K/W + ' + (n > 1 ? n + ' · ' : '') + fmt(rthK) + ' K/W = ' + fmt(out.rthTotal) + ' K/W',
        sym('Tk') + ' = ' + sym('Ta') + ' + ' + (n > 1 ? n + ' · ' : '') + 'P · ' + sym('Rth_K') + ' = ' + fmt(a) + ' °C + ' + (n > 1 ? n + ' · ' : '') + fmt(p) + ' W · ' + fmt(rthK) + ' K/W = ' + fmt(out.tk) + ' °C',
        sym('Tc') + ' = ' + sym('Tk') + ' + P · ' + sym('Rth_CK') + ' = ' + fmt(out.tk) + ' °C + ' + fmt(p) + ' W · ' + fmt(ch.rthCK) + ' K/W = ' + fmt(out.tc) + ' °C',
        sym('Tj') + ' = ' + sym('Tc') + ' + P · ' + sym('Rth_JC') + ' = ' + fmt(out.tc) + ' °C + ' + fmt(p) + ' W · ' + fmt(ch.rthJC) + ' K/W = ' + fmt(out.tj) + ' °C'
      ];
    } else {
      out.tk = a; out.tc = a + p * ch.rthCA; out.tj = out.tc + p * ch.rthJC;
      out.dJC = p * ch.rthJC; out.dCK = 0; out.dK = 0; out.dCA = p * ch.rthCA;
      out.rthTotal = ch.rthJA; out.rthCA = ch.rthCA;
      out.steps = [
        sym('Tj') + ' = ' + sym('Ta') + ' + P · ' + sym('Rth_JA') + ' = ' + fmt(a) + ' °C + ' + fmt(p) + ' W · ' + fmt(ch.rthJA) + ' K/W = ' + fmt(out.tj) + ' °C',
        sym('Tc') + ' = ' + sym('Ta') + ' + P · (' + sym('Rth_JA') + ' − ' + sym('Rth_JC') + ') = ' + fmt(out.tc) + ' °C'
      ];
    }
    out.sum = out.tj - a;
    out.drops = ch.mode === 'kk'
      ? [{ id: 'JC', key: 'Rth_JC', rth: ch.rthJC, dT: out.dJC }, { id: 'CK', key: 'Rth_CK', rth: ch.rthCK, dT: out.dCK }, { id: 'K', key: 'Rth_K', rth: n * rthK, dT: out.dK }]
      : [{ id: 'JC', key: 'Rth_JC', rth: ch.rthJC, dT: out.dJC }, { id: 'CA', key: 'Rth_CA', rth: ch.rthCA, dT: out.dCA }];
    const mg = num(opts.margin, 0);
    out.margin = ch.tjMax - out.tj - mg;
    return out;
  }
  /* pzul: Zahl in W (frei: min(Formel, Datenblatt-Deckel); Kuehlkoerper: nur Formel; Nennleistung als Deckel, wo es eine gibt) */
  function pzul(cfgIn, ta) {
    const ch = chain(cfgIn);
    if (!ch.ok) return NaN;
    const a = ta === undefined || ta === null ? K.TA_STD : num(ta, NaN);
    if (!isFinite(a)) return NaN;
    const dev = ch.dev;
    if (a >= ch.tjMax) return 0;
    let v = (ch.tjMax - a) / ch.rthTotal;
    if (ch.mode === 'frei' && isFinite(dev.ptotFree)) v = Math.min(v, dev.ptotFree);
    if (isFinite(dev.pNenn)) v = Math.min(v, dev.pNenn);
    return v;
  }
  function taMax(cfgIn, P) {
    const ch = chain(cfgIn);
    const p = num(P, NaN);
    if (!ch.ok || !(p >= 0)) return NaN;
    return ch.tjMax - p * ch.rthTotal;
  }
  function smallestEff(opts) {
    opts = isObj(opts) ? opts : {};
    /* bester denkbarer Fall: groesster Kuehlkoerper mit dem staerksten Luefter (oder dem gewaehlten) und senkrechten Rippen */
    const f = (has(fan, opts.fan) ? fan[opts.fan] : fan.stark) * (has(orient, opts.orient) ? orient[opts.orient] : orient.senkrecht);
    return { f: f, best: heatsinks[heatsinks.length - 1].rthK * f };
  }
  /* rthKerf(cfg, P, ta, opts): erforderlicher effektiver Rth_K (K/W) je Bauteil; opts { tjMax, margin }. Vier Randfaelle mit eigenem Text und kind. */
  function rthKerf(cfgIn, P, ta, opts) {
    const nc = normCfg(cfgIn);
    if (!nc.ok) return Object.assign({ kind: 'ungueltig', value: NaN }, nc);
    const cfg = nc.cfg, dev = DEV[cfg.device];
    opts = isObj(opts) ? opts : {};
    const p = num(P, NaN);
    const a = ta === undefined || ta === null ? K.TA_STD : num(ta, NaN);
    if (!isFinite(p) || !isFinite(a)) return fail(TXT.ungueltig, { kind: 'ungueltig', value: NaN });
    const ov = cfg.overrides;
    const tjMax = (isFinite(num(opts.tjMax, NaN)) ? num(opts.tjMax, NaN) : (num(ov.tjMax, NaN) > 0 ? num(ov.tjMax, NaN) : dev.tjMax)) - num(opts.margin, 0);
    const jc = isFinite(num(ov.rthJC, NaN)) ? num(ov.rthJC, NaN) : dev.rthJC;
    const ck = isFinite(num(ov.rthCK, NaN)) ? num(ov.rthCK, NaN) : rthCK(dev.pkg, cfg.joint, cfg.paste, cfg.screw);
    const n = cfg.count;
    if (p <= 0) return fail(TXT.keineLeistung, { kind: 'keine-leistung', value: NaN });
    if (tjMax <= a) return fail(TXT.taZuHoch, { kind: 'ta-zu-hoch', value: NaN });
    if (!isFinite(ck)) return fail(TXT.ungueltigerAufbau, { kind: 'ungueltig', value: NaN });
    const rthTot = (tjMax - a) / p;
    const raw = (rthTot - jc - ck) / n;
    const steps = [
      sym('Rth_ges') + ',max = (' + sym('Tjmax') + ' − ' + sym('Ta') + ') / P = (' + fmt(tjMax) + ' °C − ' + fmt(a) + ' °C) / ' + fmt(p) + ' W = ' + fmt(rthTot) + ' K/W',
      sym('Rth_Kerf') + ' = ' + sym('Rth_ges') + ',max − ' + sym('Rth_JC') + ' − ' + sym('Rth_CK') + (n > 1 ? ', geteilt durch ' + n : '') + ' = ' + fmt(rthTot) + ' K/W − ' + fmt(jc) + ' K/W − ' + fmt(ck) + ' K/W' + (n > 1 ? ' / ' + n : '') + ' = ' + fmt(raw) + ' K/W'
    ];
    const se = smallestEff(opts);
    if (raw < 0) {
      const tjIdeal = a + p * (jc + ck);   // idealer Kuehlkoerper (0 K/W): Tj = Ta + P * (Rth_JC + Rth_CK)
      return { ok: false, kind: 'negativ', value: NaN, raw: raw, tjIdeal: tjIdeal, why: fill(TXT.negativ, { tj: fmt(tjIdeal, 1) }), steps: steps, rthTotMax: rthTot };
    }
    if (raw <= K.SPAN_UNREAL) return { ok: true, kind: 'unrealistisch', value: raw, raw: raw, why: fill(TXT.unrealistisch, { x: fmt(raw), best: fmt(se.best) }), steps: steps, rthTotMax: rthTot };
    return { ok: true, kind: 'ok', value: raw, raw: raw, why: '', steps: steps, rthTotMax: rthTot };
  }
  /* chooseHeatsink(rthErf, { fan, orient, pkg }): kleinster Katalogkuehlkoerper mit Rth_K,eff <= rthErf */
  function chooseHeatsink(rthErf, opts) {
    opts = isObj(opts) ? opts : {};
    const r = num(rthErf, NaN);
    if (!(r > 0)) return fail(TXT.rthNichtPos);
    if (opts.fan !== undefined && opts.fan !== null && !has(fan, opts.fan)) return fail(TXT.wertAblehnen);
    if (opts.orient !== undefined && opts.orient !== null && !has(orient, opts.orient)) return fail(TXT.wertAblehnen);
    const f = (has(fan, opts.fan) ? fan[opts.fan] : 1) * (has(orient, opts.orient) ? orient[opts.orient] : 1);
    const cands = heatsinks.filter(function (h) { return !(h.id === 'fahne' && opts.pkg !== undefined && opts.pkg !== null && opts.pkg !== 'TO-220'); });
    for (let i = 0; i < cands.length; i++) {
      const h = cands[i], eff = h.rthK * f;
      if (eff <= r * (1 + 1e-12)) return { ok: true, id: h.id, heatsink: h, rthK: h.rthK, rthKeff: eff, rthErf: r, reserve: r - eff, fan: opts.fan || 'aus', orient: opts.orient || 'senkrecht' };
    }
    let best = Infinity;
    cands.forEach(function (h) { best = Math.min(best, h.rthK * f); });
    return fail(fill(TXT.keinKK, { need: fmt(r), best: fmt(best) }), { need: r, best: best });
  }

  /* =====================================================================================================
   *  FORMELN (SPEC 4.7): Array { id, name, symbol, expr, unit, inputs, fn, explain }
   * ===================================================================================================== */
  const FORM = [];
  /* def: Eingaben [key, label, unit, default]; calc(a...) -> Zahl; sub(a..., r) -> Textzeile mit eingesetzten Zahlen */
  function defF(id, name, symbolKey, expr, unit, inputs, calc, sub) {
    const fn = C(function () { const a = Array.prototype.slice.call(arguments); const v = calc.apply(null, a); return isFinite(v) ? v : NaN; });
    const explain = S(function () {
      const a = Array.prototype.slice.call(arguments);
      const v = fn.apply(null, a);
      if (!isFinite(v)) return fail(TXT.ungueltig);
      return { ok: true, value: v, unit: unit, steps: [tpl(expr), sub.apply(null, a.concat([v]))] };
    });
    const e = { id: id, name: name, symbol: symbolKey ? '{sym:' + symbolKey + '}' : '', symbolKey: symbolKey, expr: expr, unit: unit, inputs: inputs.map(function (x) { return { key: x[0], label: x[1], unit: x[2], def: x[3] }; }), fn: fn, explain: explain };
    FORM.push(e);
  }
  const N_ = function (x) { return fmt(x); };
  defF('pLinear', 'Verlustleistung Linearregler', 'P', 'P = (Ue − Ua) · Ia   (genauer: + Ue · Iq)', 'W',
    [['ue', 'Eingangsspannung Ue', 'V', 12], ['ua', 'Ausgangsspannung Ua', 'V', 5], ['ia', 'Ausgangsstrom Ia', 'A', 0.5], ['iq', 'Ruhestrom Iq (0 = vernachlässigen)', 'A', 0]],
    function (ue, ua, ia, iq) { ue = num(ue, NaN); ua = num(ua, NaN); ia = num(ia, NaN); const q = num(iq, 0); return ue >= ua && ua >= 0 && ia >= 0 && q >= 0 ? (ue - ua) * ia + ue * q : NaN; },
    function (ue, ua, ia, iq, r) { return 'P = (' + N_(ue) + ' V − ' + N_(ua) + ' V) · ' + N_(ia) + ' A' + (num(iq, 0) > 0 ? ' + ' + N_(ue) + ' V · ' + N_(iq * 1000) + ' mA' : '') + ' = ' + N_(r) + ' W'; });
  defF('pBipolar', 'Verlustleistung Längstransistor', 'P', 'P = UCE · IC', 'W',
    [['uce', 'Spannung UCE', 'V', 6], ['ic', 'Kollektorstrom IC', 'A', 0.3]],
    function (u, i) { u = num(u, NaN); i = num(i, NaN); return u >= 0 && i >= 0 ? u * i : NaN; },
    function (u, i, r) { return 'P = ' + N_(u) + ' V · ' + N_(i) + ' A = ' + N_(r) + ' W'; });
  defF('pMosfet', 'Verlustleistung MOSFET-Schalter', 'P', 'P = D · I² · RDS(on) + ½ · U · I · (tr + tf) · f', 'W',
    [['i', 'Strom I', 'A', 10], ['d', 'Einschaltdauer D (0…1)', '', 1], ['rds', 'RDS(on)', 'Ω', 0.037], ['u', 'Spannung U', 'V', 24], ['f', 'Frequenz f', 'Hz', 0], ['trf', 'tr + tf', 's', 1.45e-7]],
    function (i, d, rds, u, f, trf) { const r = pMosfet({ i: i, d: d, rds25: rds, tj: 25, alpha: 0, u: u, f: f, tr: num(trf, 0), tf: 0 }); return r.ok ? r.p : NaN; },
    function (i, d, rds, u, f, trf, r) { return 'P = ' + N_(d) + ' · (' + N_(i) + ' A)² · ' + N_(rds * 1000) + ' mΩ + ½ · ' + N_(u) + ' V · ' + N_(i) + ' A · ' + N_(num(trf, 0) * 1e9) + ' ns · ' + N_(f) + ' Hz = ' + N_(r) + ' W'; });
  defF('pSwitch', 'Schaltverlust MOSFET', 'P', 'P_sw = ½ · U · I · (tr + tf) · f', 'W',
    [['u', 'Spannung U', 'V', 24], ['i', 'Strom I', 'A', 10], ['f', 'Frequenz f', 'Hz', 20000], ['trf', 'tr + tf', 's', 1.45e-7]],
    function (u, i, f, trf) { u = num(u, NaN); i = num(i, NaN); f = num(f, NaN); trf = num(trf, NaN); return u >= 0 && i >= 0 && f >= 0 && trf >= 0 ? 0.5 * u * i * trf * f : NaN; },
    function (u, i, f, trf, r) { return 'P_sw = ½ · ' + N_(u) + ' V · ' + N_(i) + ' A · ' + N_(trf * 1e9) + ' ns · ' + N_(f) + ' Hz = ' + N_(r) + ' W'; });
  defF('pDiode', 'Verlustleistung Diode (aus UF)', 'P', 'P = UF · IF', 'W',
    [['uf', 'Durchlassspannung UF', 'V', 0.93], ['i', 'Strom IF', 'A', 1]],
    function (u, i) { u = num(u, NaN); i = num(i, NaN); return u >= 0 && i >= 0 ? u * i : NaN; },
    function (u, i, r) { return 'P = ' + N_(u) + ' V · ' + N_(i) + ' A = ' + N_(r) + ' W'; });
  defF('diodeFF', 'Verlustleistung Diode mit Formfaktor', 'P', 'P = U0 · I_avg + rF · (FF · I_avg)²', 'W',
    [['i', 'Mittelwert I_avg', 'A', 1], ['ff', 'Formfaktor FF', '', 1], ['u0', 'Schleusenspannung U0', 'V', 0.87], ['rf', 'Bahnwiderstand rF', 'Ω', 0.06]],
    function (i, ff, u0, rf) { i = num(i, NaN); ff = num(ff, NaN); u0 = num(u0, NaN); rf = num(rf, NaN); return i >= 0 && ff >= 0 && u0 >= 0 && rf >= 0 ? u0 * i + rf * ff * ff * i * i : NaN; },
    function (i, ff, u0, rf, r) { return 'P = ' + N_(u0) + ' V · ' + N_(i) + ' A + ' + N_(rf) + ' Ω · (' + N_(ff) + ' · ' + N_(i) + ' A)² = ' + N_(r) + ' W'; });
  defF('pRes', 'Verlustleistung Widerstand', 'P', 'P = U² / R', 'W',
    [['u', 'Spannung U', 'V', 12], ['r', 'Widerstand R', 'Ω', 47]],
    function (u, r) { u = num(u, NaN); r = num(r, NaN); return u >= 0 && r > 0 ? u * u / r : NaN; },
    function (u, r, p) { return 'P = (' + N_(u) + ' V)² / ' + N_(r) + ' Ω = ' + N_(p) + ' W'; });
  defF('endstufe', 'größte Verlustleistung je Transistor (Gegentakt-B)', 'P', 'P_max = Ub² / (π² · RL)', 'W',
    [['ub', 'Betriebsspannung Ub', 'V', 15], ['rl', 'Lastwiderstand RL', 'Ω', 8]],
    function (ub, rl) { ub = num(ub, NaN); rl = num(rl, NaN); return ub >= 0 && rl > 0 ? ub * ub / (PI * PI * rl) : NaN; },
    function (ub, rl, r) { return 'P_max = (' + N_(ub) + ' V)² / (π² · ' + N_(rl) + ' Ω) = ' + N_(r) + ' W'; });
  defF('rthSum', 'Gesamt-Wärmewiderstand', 'Rth_ges', '{sym:Rth_ges} = {sym:Rth_JC} + {sym:Rth_CK} + {sym:Rth_K}', 'K/W',
    [['jc', 'Rth_JC', 'K/W', 5], ['ck', 'Rth_CK', 'K/W', 1.5], ['k', 'Rth_K', 'K/W', 8]],
    function (a, b, c) { a = num(a, NaN); b = num(b, NaN); c = num(c, NaN); return a >= 0 && b >= 0 && c >= 0 ? a + b + c : NaN; },
    function (a, b, c, r) { return tpl('{sym:Rth_ges}') + ' = ' + N_(a) + ' K/W + ' + N_(b) + ' K/W + ' + N_(c) + ' K/W = ' + N_(r) + ' K/W'; });
  defF('tj', 'Sperrschichttemperatur', 'Tj', '{sym:Tj} = {sym:Ta} + P · {sym:Rth_ges}', '°C',
    [['ta', 'Umgebungstemperatur', '°C', 25], ['p', 'Verlustleistung P', 'W', 3.5], ['rth', 'Rth_ges', 'K/W', 14.5]],
    function (ta, p, r) { ta = num(ta, NaN); p = num(p, NaN); r = num(r, NaN); return p >= 0 && r >= 0 && isFinite(ta) ? ta + p * r : NaN; },
    function (ta, p, r, v) { return tpl('{sym:Tj}') + ' = ' + N_(ta) + ' °C + ' + N_(p) + ' W · ' + N_(r) + ' K/W = ' + N_(v) + ' °C'; });
  defF('tc', 'Gehäusetemperatur', 'Tc', '{sym:Tc} = {sym:Ta} + P · ({sym:Rth_CK} + {sym:Rth_K})', '°C',
    [['ta', 'Umgebungstemperatur', '°C', 25], ['p', 'Verlustleistung P', 'W', 3.5], ['ck', 'Rth_CK', 'K/W', 1.5], ['k', 'Rth_K', 'K/W', 8]],
    function (ta, p, ck, k) { ta = num(ta, NaN); p = num(p, NaN); ck = num(ck, NaN); k = num(k, NaN); return p >= 0 && ck >= 0 && k >= 0 && isFinite(ta) ? ta + p * (ck + k) : NaN; },
    function (ta, p, ck, k, v) { return tpl('{sym:Tc}') + ' = ' + N_(ta) + ' °C + ' + N_(p) + ' W · (' + N_(ck) + ' K/W + ' + N_(k) + ' K/W) = ' + N_(v) + ' °C'; });
  defF('tk', 'Kühlkörpertemperatur', 'Tk', '{sym:Tk} = {sym:Ta} + P · {sym:Rth_K}', '°C',
    [['ta', 'Umgebungstemperatur', '°C', 25], ['p', 'Verlustleistung P', 'W', 3.5], ['k', 'Rth_K', 'K/W', 8]],
    function (ta, p, k) { ta = num(ta, NaN); p = num(p, NaN); k = num(k, NaN); return p >= 0 && k >= 0 && isFinite(ta) ? ta + p * k : NaN; },
    function (ta, p, k, v) { return tpl('{sym:Tk}') + ' = ' + N_(ta) + ' °C + ' + N_(p) + ' W · ' + N_(k) + ' K/W = ' + N_(v) + ' °C'; });
  defF('dT', 'Temperaturabfall über einem Glied', 'dT', '{sym:dT} = P · Rth', 'K',
    [['p', 'Verlustleistung P', 'W', 3.5], ['rth', 'Wärmewiderstand Rth', 'K/W', 8]],
    function (p, r) { p = num(p, NaN); r = num(r, NaN); return p >= 0 && r >= 0 ? p * r : NaN; },
    function (p, r, v) { return tpl('{sym:dT}') + ' = ' + N_(p) + ' W · ' + N_(r) + ' K/W = ' + N_(v) + ' K'; });
  defF('pzul', 'zulässige Verlustleistung', 'Pzul', '{sym:Pzul} = ({sym:Tjmax} − {sym:Ta}) / {sym:Rth_ges}', 'W',
    [['tjmax', 'Tj,max', '°C', 125], ['ta', 'Umgebungstemperatur', '°C', 25], ['rth', 'Rth_ges', 'K/W', 14.5]],
    function (tjm, ta, r) { tjm = num(tjm, NaN); ta = num(ta, NaN); r = num(r, NaN); return isFinite(tjm) && isFinite(ta) && r > 0 ? Math.max(0, (tjm - ta) / r) : NaN; },
    function (tjm, ta, r, v) { return tpl('{sym:Pzul}') + ' = (' + N_(tjm) + ' °C − ' + N_(ta) + ' °C) / ' + N_(r) + ' K/W = ' + N_(v) + ' W'; });
  defF('rthKerf', 'erforderlicher Wärmewiderstand des Kühlkörpers', 'Rth_Kerf', '{sym:Rth_Kerf} = ({sym:Tjmax} − {sym:Ta}) / P − {sym:Rth_JC} − {sym:Rth_CK}', 'K/W',
    [['tjmax', 'Tj,max', '°C', 125], ['ta', 'Umgebungstemperatur', '°C', 40], ['p', 'Verlustleistung P', 'W', 3.5], ['jc', 'Rth_JC', 'K/W', 5], ['ck', 'Rth_CK', 'K/W', 1.5]],
    function (tjm, ta, p, jc, ck) { tjm = num(tjm, NaN); ta = num(ta, NaN); p = num(p, NaN); jc = num(jc, NaN); ck = num(ck, NaN); return isFinite(tjm) && isFinite(ta) && p > 0 && jc >= 0 && ck >= 0 ? (tjm - ta) / p - jc - ck : NaN; },
    function (tjm, ta, p, jc, ck, v) { return tpl('{sym:Rth_Kerf}') + ' = (' + N_(tjm) + ' °C − ' + N_(ta) + ' °C) / ' + N_(p) + ' W − ' + N_(jc) + ' K/W − ' + N_(ck) + ' K/W = ' + N_(v) + ' K/W'; });
  defF('taMax', 'höchste Umgebungstemperatur', 'Ta', '{sym:Ta},max = {sym:Tjmax} − P · {sym:Rth_ges}', '°C',
    [['tjmax', 'Tj,max', '°C', 125], ['p', 'Verlustleistung P', 'W', 3.5], ['rth', 'Rth_ges', 'K/W', 14.5]],
    function (tjm, p, r) { tjm = num(tjm, NaN); p = num(p, NaN); r = num(r, NaN); return isFinite(tjm) && p >= 0 && r >= 0 ? tjm - p * r : NaN; },
    function (tjm, p, r, v) { return tpl('{sym:Ta}') + ',max = ' + N_(tjm) + ' °C − ' + N_(p) + ' W · ' + N_(r) + ' K/W = ' + N_(v) + ' °C'; });
  defF('derate', 'zulässige Verlustleistung über der Gehäusetemperatur', 'Pzul', '{sym:Pzul}({sym:Tc}) = ({sym:Tjmax} − {sym:Tc}) / {sym:Rth_JC}', 'W',
    [['tjmax', 'Tj,max', '°C', 150], ['tc', 'Gehäusetemperatur', '°C', 75], ['jc', 'Rth_JC', 'K/W', 10]],
    function (tjm, tc, jc) { tjm = num(tjm, NaN); tc = num(tc, NaN); jc = num(jc, NaN); return isFinite(tjm) && isFinite(tc) && jc > 0 ? Math.max(0, (tjm - Math.max(tc, 25)) / jc) : NaN; },
    function (tjm, tc, jc, v) { return tpl('{sym:Pzul}') + ' = (' + N_(tjm) + ' °C − ' + N_(Math.max(tc, 25)) + ' °C) / ' + N_(jc) + ' K/W = ' + N_(v) + ' W'; });
  defF('parallelKK', 'mehrere Bauteile auf einem Kühlkörper', 'Tj', '{sym:Tj} = {sym:Ta} + n · P · {sym:Rth_K} + P · ({sym:Rth_JC} + {sym:Rth_CK})', '°C',
    [['n', 'Anzahl n', '', 2], ['p', 'Verlustleistung je Bauteil', 'W', 1.8], ['ta', 'Umgebungstemperatur', '°C', 25], ['k', 'Rth_K', 'K/W', 8], ['jc', 'Rth_JC', 'K/W', 10], ['ck', 'Rth_CK', 'K/W', 1]],
    function (n, p, ta, k, jc, ck) { n = num(n, NaN); p = num(p, NaN); ta = num(ta, NaN); k = num(k, NaN); jc = num(jc, NaN); ck = num(ck, NaN); return n >= 1 && p >= 0 && isFinite(ta) && k >= 0 && jc >= 0 && ck >= 0 ? ta + n * p * k + p * (jc + ck) : NaN; },
    function (n, p, ta, k, jc, ck, v) { return tpl('{sym:Tj}') + ' = ' + N_(ta) + ' °C + ' + N_(n) + ' · ' + N_(p) + ' W · ' + N_(k) + ' K/W + ' + N_(p) + ' W · (' + N_(jc) + ' K/W + ' + N_(ck) + ' K/W) = ' + N_(v) + ' °C'; });
  defF('rthLayer', 'Wärmewiderstand einer Schicht', 'Rth_CK', 'Rth = d / (λ · A)', 'K/W',
    [['d', 'Dicke d', 'mm', 0.05], ['lambda', 'Wärmeleitfähigkeit λ', 'W/(m·K)', 0.026], ['a', 'Fläche A', 'cm²', 1.5]],
    function (d, l, a) { return rthLayerMM(d, l, a); },
    function (d, l, a, v) { return 'Rth = ' + N_(d) + ' mm / (' + N_(l) + ' W/(m·K) · ' + N_(a) + ' cm²) = ' + N_(v) + ' K/W'; });
  defF('tau', 'Zeitkonstante', 'tau', '{sym:tau} = Rth · {sym:Cth}', 's',
    [['rth', 'Wärmewiderstand Rth', 'K/W', 8], ['c', 'Wärmekapazität Cth', 'J/K', 63]],
    function (r, c) { return tauOf(r, c); },
    function (r, c, v) { return tpl('{sym:tau}') + ' = ' + N_(r) + ' K/W · ' + N_(c) + ' J/K = ' + N_(v) + ' s'; });
  defF('tPct', 'Zeit bis x % des Endwertes', 'tau', 't = −{sym:tau} · ln(1 − x)', 's',
    [['tau', 'Zeitkonstante', 's', 504], ['pct', 'Anteil x', '%', 90]],
    function (tau, pct) { pct = num(pct, NaN); return tFraction(tau, pct / 100); },
    function (tau, pct, v) { return 't = −' + N_(tau) + ' s · ln(1 − ' + N_(pct / 100) + ') = ' + N_(v) + ' s'; });
  defF('etaLin', 'Wirkungsgrad Linearregler', null, 'η = Ua / Ue   (genauer: Ua · Ia / (Ue · (Ia + Iq)))', '',
    [['ue', 'Eingangsspannung Ue', 'V', 12], ['ua', 'Ausgangsspannung Ua', 'V', 5]],
    function (ue, ua) { ue = num(ue, NaN); ua = num(ua, NaN); return ue > 0 && ua >= 0 && ua <= ue ? ua / ue : NaN; },
    function (ue, ua, v) { return 'η = ' + N_(ua) + ' V / ' + N_(ue) + ' V = ' + N_(v) + ' (' + N_(v * 100) + ' %)'; });
  defF('pvSw', 'Verlustleistung Schaltregler', 'P', 'P_V = Pa · (1/η − 1)', 'W',
    [['pa', 'Ausgangsleistung Pa', 'W', 2.5], ['eta', 'Wirkungsgrad η (0…1)', '', 0.9]],
    function (pa, eta) { pa = num(pa, NaN); eta = num(eta, NaN); return pa >= 0 && eta > 0 && eta <= 1 ? pa * (1 / eta - 1) : NaN; },
    function (pa, eta, v) { return 'P_V = ' + N_(pa) + ' W · (1/' + N_(eta) + ' − 1) = ' + N_(v) + ' W'; });
  defF('pulse', 'Spitzentemperatur bei Impulsen (Einknotenmodell)', 'Tj', '{sym:Tj} = {sym:Ta} + P_pk · [D · Rth + (1 − D) · Zth(tp + T) − Zth(T) + Zth(tp)],  Zth(t) = Rth · (1 − e^(−t/τ))', '°C',
    [['ta', 'Umgebungstemperatur', '°C', 25], ['ppk', 'Spitzenleistung P_pk', 'W', 100], ['rth', 'Rth_ges', 'K/W', 1], ['tau', 'Zeitkonstante τ', 's', 60], ['tp', 'Impulsdauer tp', 's', 0.001], ['T', 'Periode T', 's', 0.1]],
    function (ta, ppk, rth, tau, tp, T) {
      ta = num(ta, NaN); ppk = num(ppk, NaN); rth = num(rth, NaN); tau = num(tau, NaN); tp = num(tp, NaN); T = num(T, NaN);
      if (!isFinite(ta) || !(ppk >= 0) || !(rth >= 0) || !(tau > 0) || !(tp > 0) || !(T > 0)) return NaN;
      const D = tp / T, z = function (t) { return rth * (1 - Math.exp(-t / tau)); };
      if (D >= 1) return ta + ppk * rth;
      return ta + ppk * (D * rth + (1 - D) * z(tp + T) - z(T) + z(tp));
    },
    function (ta, ppk, rth, tau, tp, T, v) { return tpl('{sym:Tj}') + ' = ' + N_(ta) + ' °C + ' + N_(ppk) + ' W · [D · ' + N_(rth) + ' K/W + (1 − D) · Zth(tp + T) − Zth(T) + Zth(tp)] = ' + N_(v) + ' °C'; });
  defF('widerstandNenn', 'Widerstandswert mit Reserve (E12 aufgerundet)', null, 'R ≥ Reserve · U² / P_nenn, dann nächster E12-Wert nach oben', 'Ω',
    [['u', 'Spannung U', 'V', 12], ['pn', 'Nennleistung P_nenn', 'W', 5], ['res', 'Reserve (2 = halbe Nennleistung)', '', 2]],
    function (u, pn, res) { u = num(u, NaN); pn = num(pn, NaN); res = num(res, 2); return u > 0 && pn > 0 && res >= 1 ? eSeries('E12', res * u * u / pn, 'up') : NaN; },
    function (u, pn, res, v) { return 'R ≥ ' + N_(res) + ' · (' + N_(u) + ' V)² / ' + N_(pn) + ' W = ' + N_(res * u * u / pn) + ' Ω → E12: ' + N_(v) + ' Ω'; });
  const formulas = FORM;
  const formById = {};
  FORM.forEach(function (f) { formById[f.id] = f; hide(FORM, f.id, f); });
  hide(FORM, 'byId', formById);
  hide(FORM, 'get', function (id) { return has(formById, id) ? formById[id] : null; });
  hide(FORM, 'list', function () { return FORM.slice(); });

  /* =====================================================================================================
   *  MONTAGE-STEUERWERTE FUER DIE PRUEFSTAENDE (SPEC 5.0)
   * ===================================================================================================== */
  const MOUNT_OPT = {
    heatsink: [
      { value: 'none', label: 'ohne Kühlkörper', help: 'Das Bauteil steht frei in der Luft: Es gilt der Wärmewiderstand Sperrschicht–Umgebung aus dem Datenblatt.', hint: 'Meist zu heiß: Rechne zuerst nach.' },
      { value: 'fahne', label: 'Fahnenkühlkörper', help: 'Kleines Blech für TO-220, schraubbar.', hint: 'Passt nur auf TO-220.' },
      { value: 's', label: 'Profil klein', help: 'Strangpressprofil, 25 mm lang.' },
      { value: 'm', label: 'Profil mittel', help: 'Strangpressprofil, 50 mm lang.' },
      { value: 'l', label: 'Profil groß', help: 'Strangpressprofil, 100 mm lang.' },
      { value: 'xl', label: 'Rippenkörper sehr groß', help: 'Großer Rippenkörper.' },
      { value: 'blech', label: 'Kühlblech (Selbstbau)', help: 'Blech aus Aluminium: Der Wärmewiderstand folgt aus der Fläche.', hint: 'Beide Seiten kühlen.' }
    ],
    joint: [
      { value: 'direkt', label: 'direkt', help: 'Das Gehäuse liegt direkt auf dem Kühlkörper. Bei gleicher Paste ist das die beste Wärmeleitung, aber das Gehäuse ist elektrisch mit dem Kühlkörper verbunden.', hint: 'Nur, wenn die Fahne am Potenzial des Kühlkörpers liegt.' },
      { value: 'glimmer', label: 'Glimmerscheibe', help: 'Die Glimmerscheibe isoliert elektrisch, leitet die Wärme aber schlechter.', hint: 'Mit Isolierbuchse für die Schraube.' },
      { value: 'silikon', label: 'Silikonfolie', help: 'Die Silikonfolie isoliert elektrisch und braucht keine Wärmeleitpaste.', hint: 'Die Paste bringt hier nichts.' }
    ],
    paste: [
      { value: 'keine', label: 'keine Paste', help: 'Ohne Wärmeleitpaste bleiben Luftspalte: Der Wärmewiderstand des Übergangs ist deutlich größer.' },
      { value: 'duenn', label: 'Paste dünn', help: 'Dünn aufgetragene Wärmeleitpaste füllt die Luftspalte und ist richtig.' },
      { value: 'dick', label: 'Paste dick', help: 'Zu viel Paste verschlechtert den Übergang wieder.', hint: 'Trage sie dünn auf.' }
    ],
    screw: [
      { value: 'fest', label: 'Schraube fest', help: 'Die Schraube drückt das Gehäuse auf den Kühlkörper.', hint: 'Das Anzugsmoment steht in der Herstellerangabe.' },
      { value: 'locker', label: 'Schraube locker', help: 'Eine lockere Schraube lässt einen Spalt: Der Wärmewiderstand des Übergangs steigt.' }
    ],
    ksPot: [
      { value: 'masse', label: 'Kühlkörper an Masse', help: 'Der Kühlkörper ist an die Gerätemasse angeschlossen.' },
      { value: 'frei', label: 'Kühlkörper frei', help: 'Der Kühlkörper ist isoliert eingebaut und nimmt das Potenzial der Fahne an.', hint: 'Berührschutz beachten.' }
    ],
    fan: [], orient: []
  };
  MOUNT_OPT.heatsink.splice(1, 5, ...heatsinks.map(function (h) {
    return { value: h.id, label: h.name, help: 'Wärmewiderstand {sym:Rth_K} = ' + fmt(h.rthK) + ' K/W bei freier Konvektion (Katalogwert, Übungswert), Masse ' + fmt(h.massG) + ' g.', hint: h.id === 'fahne' ? 'Passt nur auf TO-220.' : '' };
  }));
  fan.list.forEach(function (f) { MOUNT_OPT.fan.push({ value: f.id, label: f.name, help: f.id === 'aus' ? 'Ohne Lüfter kühlt der Kühlkörper nur durch freie Konvektion.' : 'Der Lüfter verkleinert nur den Wärmewiderstand des Kühlkörpers, auf ×' + fmt(f.factor) + '.' }); });
  orient.list.forEach(function (o) { MOUNT_OPT.orient.push({ value: o.id, label: o.name, help: o.id === 'senkrecht' ? 'Stehende Rippen: Die warme Luft steigt im Kamin nach oben.' : 'Liegende Rippen kühlen schlechter: Der Wärmewiderstand des Kühlkörpers steigt auf ×' + fmt(o.factor) + '.' }); });
  const mount = { rthCK: C(rthCK), options: MOUNT_OPT, factors: MOUNT_FACTORS, table: MOUNT_TAB, joints: JOINTS, pastes: PASTES, screws: SCREWS };
  /* mountControls(set?): Steuerwerte der Gruppe "Montage und Umgebung"; help ist die einzige Quelle der Tooltips (aus den Tabellen erzeugt) */
  function mountControls(set) {
    const G = 'Montage und Umgebung';
    const isKK = function (s) { return !!s && (s.mode === 'kk' || (s.mode === undefined && s.heatsink !== undefined && s.heatsink !== 'none')); };
    function sel(key, label, opts, value, help, vis) {
      const o = { key: key, label: tpl(label, set), type: 'select', value: value, options: opts.map(function (x) { return { value: x.value, label: tpl(x.label, set), help: tpl(x.help || '', set), hint: tpl(x.hint || '', set) }; }), group: G, help: tpl(help, set) };
      if (vis) o.visible = vis;
      return o;
    }
    return [
      sel('heatsink', 'Kühlkörper', MOUNT_OPT.heatsink, 'none', 'Wähle den Kühlkörper. Ohne Kühlkörper gilt {sym:Rth_JA}, mit Kühlkörper die Reihe {sym:Rth_JC} + {sym:Rth_CK} + {sym:Rth_K}.'),
      { key: 'blechA', label: 'Blechfläche (eine Seite)', type: 'slider', min: 10, max: 400, step: 5, unit: 'cm²', value: 100, group: G, help: 'Fläche einer Seite des Kühlbleches; beide Seiten geben Wärme ab. Der Wärmewiderstand folgt aus 1 / (α · A).', visible: function (s) { return !!s && s.heatsink === 'blech'; } },
      sel('joint', 'Übergang', MOUNT_OPT.joint, 'direkt', 'Der Übergang zwischen Gehäuse und Kühlkörper bestimmt den {sym:Rth_CK} und die elektrische Trennung.', isKK),
      sel('paste', 'Wärmeleitpaste', MOUNT_OPT.paste, 'duenn', 'Die Wärmeleitpaste füllt Luftspalte und senkt den {sym:Rth_CK}.', isKK),
      { key: 'bushing', label: 'Isolierbuchse', type: 'switch', value: true, group: G, help: 'Die Isolierbuchse isoliert die Schraube. Ohne sie verbindet die Schraube Fahne und Kühlkörper.', visible: function (s) { return isKK(s) && !!s && s.joint !== 'direkt'; } },
      sel('screw', 'Schraube', MOUNT_OPT.screw, 'fest', 'Die Schraube drückt das Gehäuse an den Kühlkörper; eine lockere Schraube erhöht den {sym:Rth_CK}.', isKK),
      sel('ksPot', 'Kühlkörper elektrisch', MOUNT_OPT.ksPot, 'masse', 'Der Kühlkörper liegt an Gerätemasse oder frei.', isKK),
      sel('fan', 'Lüfter', MOUNT_OPT.fan, 'aus', 'Der Lüfter wirkt nur auf {sym:Rth_K}, nicht auf {sym:Rth_JC} und {sym:Rth_CK}.', isKK),
      sel('orient', 'Einbaulage', MOUNT_OPT.orient, 'senkrecht', 'Senkrechte Rippen kühlen besser als waagrechte.', isKK),
      { key: 'ta', label: 'Umgebungstemperatur', type: 'slider', min: 0, max: 70, step: 1, unit: '°C', value: K.TA_STD, group: G, help: 'Temperatur der Luft am Kühlkörper. Im Gerät ist es wärmer als im Raum.' },
      { key: 'nonlin', label: 'Konvektion nichtlinear', type: 'switch', value: false, group: G, help: 'Vertiefung: Der Wärmewiderstand des Kühlkörpers sinkt mit steigender Übertemperatur. Aufgaben rechnen nie so.', visible: isKK }
    ];
  }
  const mountPresets = [
    { id: 'frei', name: 'freistehend', values: { heatsink: 'none' } },
    { id: 'kk-m-glimmer-paste', name: 'Profil mittel, Glimmer, Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest' } },
    { id: 'kk-m-glimmer-trocken', name: 'Profil mittel, Glimmer ohne Paste', values: { heatsink: 'm', joint: 'glimmer', paste: 'keine', bushing: true, screw: 'fest' } },
    { id: 'kk-m-direkt-paste', name: 'Profil mittel, direkt, Paste', values: { heatsink: 'm', joint: 'direkt', paste: 'duenn', screw: 'fest' } },
    { id: 'kk-l-lüfter', name: 'Profil groß, Glimmer, Paste, Lüfter mittel', values: { heatsink: 'l', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', fan: 'mittel' } }
  ];
  /* cfgFromControls(ctl, device): cfg aus den Steuerwerten der Anlage (heatsink, blechA, joint, paste, bushing, screw, ksPot, fan, orient, nonlin) */
  function cfgFromControls(ctl, device) {
    ctl = isObj(ctl) ? ctl : {};
    const c = { device: device === undefined ? ctl.device : device };
    ['heatsink', 'joint', 'paste', 'screw', 'ksPot', 'fan', 'orient'].forEach(function (k) { if (ctl[k] !== undefined) c[k] = ctl[k]; });
    if (ctl.bushing !== undefined) c.bushing = ctl.bushing !== false;
    if (ctl.nonlin !== undefined) c.nonlin = ctl.nonlin === true;
    if (ctl.count !== undefined) c.count = ctl.count;
    if (num(ctl.blechA, NaN) > 0) c.blech = { A_cm2: num(ctl.blechA, 100), d_mm: num(ctl.blechD, 2), material: ctl.blechMat || 'al' };
    return c;
  }

  /* =====================================================================================================
   *  M2: KUEHLKOERPER-GEOMETRIE, DERATING, MEHRERE BAUTEILE, MITKOPPLUNG, WIRKUNGSGRAD
   * ===================================================================================================== */
  /* ---------- Rippenmodell (SPEC 4.2.3): Katalogwerte und Modellwerte stehen nebeneinander ---------- */
  function geomOf(spec) {
    let g = spec;
    if (typeof spec === 'string') { const h = has(hsById, spec) ? hsById[spec] : null; g = h ? h.geom : null; if (!g) return fail('Für diesen Kühlkörper gibt es kein Rippenmodell.'); }
    if (!isObj(g)) return fail('Das Rippenmodell braucht b, l, n, L und t (in mm).');
    const b = num(g.b, NaN), l = num(g.l, NaN), n = Math.round(num(g.n, NaN)), L = num(g.L, NaN), tt = num(g.t, NaN);
    const mat = matOf(g.material || 'al'), alpha = num(g.alpha, K.ALPHA_CONV);
    if (!(b > 0) || !(l > 0) || !(n >= 0) || !(L > 0) || !(tt > 0) || !mat || !mat.lambda || !(alpha > 0)) return fail('Das Rippenmodell braucht b, l, L, t größer als 0, n ≥ 0 und das Material Aluminium oder Kupfer.');
    return { ok: true, b: b * 1e-3, l: l * 1e-3, n: n, L: L * 1e-3, t: tt * 1e-3, lambda: mat.lambda, alpha: alpha };
  }
  /* fromGeometry(spec): Grundplatte b x l, n Rippen der Hoehe L und Dicke t (alles in mm). Rth_K = 1/(alpha*A_eff), A_eff = A_Grund + n*eta_f*A_Rippe */
  function fromGeometry(spec) {
    const g = geomOf(spec);
    if (!g.ok) return g;
    const mf = Math.sqrt(2 * g.alpha / (g.lambda * g.t));
    const mL = mf * g.L;
    const eta = mL < 1e-9 ? 1 : Math.tanh(mL) / mL;
    const aBase = g.b * g.l, aFin = 2 * g.L * g.l;
    const aEff = aBase + g.n * eta * aFin;
    const rth = 1 / (g.alpha * aEff);
    return { ok: true, rthK: rth, aEff: aEff, aBase: aBase, aFin: aFin, mf: mf, mL: mL, eta: eta, steps: [
      'm_f = √(2 · α / (λ · t)) = ' + fmt(mf) + ' 1/m, m_f · L = ' + fmt(mL),
      'η_f = tanh(m_f · L) / (m_f · L) = ' + fmt(eta),
      'A_eff = A_Grund + n · η_f · A_Rippe = ' + fmt(aBase * 1e4) + ' cm² + ' + g.n + ' · ' + fmt(eta) + ' · ' + fmt(aFin * 1e4) + ' cm² = ' + fmt(aEff * 1e4) + ' cm²',
      sym('Rth_K') + ' = 1 / (α · A_eff) = 1 / (' + fmt(g.alpha) + ' W/(m²·K) · ' + fmt(aEff) + ' m²) = ' + fmt(rth) + ' K/W'] };
  }
  /* finProfile(spec, tBase, ta, n): Temperatur entlang der Rippe, x = 0 am Fuss (Tk), x = L an der Spitze; x in mm */
  function finProfile(spec, tBase, ta, n) {
    const g = geomOf(spec);
    if (!g.ok) return g;
    const tb = num(tBase, NaN), a = num(ta, K.TA_STD);
    if (!isFinite(tb) || !isFinite(a)) return fail(TXT.ungueltig);
    const N = clamp(Math.round(num(n, 21)), 2, 400);
    const mf = Math.sqrt(2 * g.alpha / (g.lambda * g.t)), mL = mf * g.L;
    const xs = [], ts = [];
    for (let i = 0; i < N; i++) {
      const x = g.L * i / (N - 1);
      xs.push(x * 1e3);
      ts.push(a + (tb - a) * Math.cosh(mf * (g.L - x)) / Math.cosh(mL));
    }
    const res = ts.slice();            // Zahlenliste vom Fuss zur Spitze, zusaetzlich die Felder ok, x (mm), t, tTip, L (mm)
    res.ok = true; res.x = xs; res.t = ts; res.tTip = ts[N - 1]; res.L = g.L * 1e3;
    return res;
  }
  const heatsink = { fromGeometry: S(fromGeometry), finProfile: S(finProfile), blech: S(blechOf) };

  /* ---------- Derating (Gehaeuse) ---------- */
  /* derating(cfg, ta?, n?): P_zul(Tc) = (Tj,max - Tc) / Rth_JC, bis Tc = 25 °C waagrecht; mit ta zusaetzlich der Marker des aktuellen Betriebs */
  function derating(cfgIn, ta, n) {
    const ch = chain(cfgIn);
    if (!ch.ok) return ch;
    if (!(ch.rthJC > 0)) return fail(TXT.keinJC);
    const N = clamp(Math.round(num(n, 21)), 2, 400);
    const tjM = ch.tjMax, rjc = ch.rthJC;
    const p25 = (tjM - 25) / rjc;
    const pts = [];
    for (let i = 0; i < N; i++) { const tc = 25 + (tjM - 25) * i / (N - 1); pts.push({ tc: tc, p: Math.max(0, (tjM - tc) / rjc) }); }
    const out = { ok: true, points: pts, pCase25: p25, slope: -1 / rjc, tcMax: tjM, tjMax: tjM, rthJC: rjc, pAt: C(function (tc) { tc = num(tc, NaN); return isFinite(tc) ? Math.max(0, (tjM - Math.max(tc, 25)) / rjc) : NaN; }) };
    if (ta !== undefined && ta !== null && isFinite(num(ta, NaN))) {
      const a = num(ta, 25), pz = pzul(cfgIn, a);
      out.pzul = pz; out.tcAtPzul = a + pz * (ch.mode === 'kk' ? ch.count * ch.rthK + ch.rthCK : ch.rthCA);
    }
    return out;
  }
  /* derating.overTa(cfg, n): zulaessige Verlustleistung ueber der Umgebungstemperatur 0 … Tj,max */
  function deratingOverTa(cfgIn, n) {
    const ch = chain(cfgIn);
    if (!ch.ok) return ch;
    const N = clamp(Math.round(num(n, 36)), 2, 400), pts = [];
    for (let i = 0; i < N; i++) { const a = ch.tjMax * i / (N - 1); pts.push({ ta: a, p: pzul(cfgIn, a) }); }
    return { ok: true, points: pts, tjMax: ch.tjMax };
  }

  /* ---------- mehrere gleiche Bauteile auf einem Kuehlkoerper ---------- */
  function parallelDevices(nIn, cfgIn, P1, ta) {
    const nn = Math.round(num(nIn, NaN));
    if (!(nn >= 1 && nn <= 16)) return fail(TXT.nMin);
    const base = isObj(cfgIn) ? Object.assign({}, cfgIn, { count: 1 }) : cfgIn;
    const ch = chain(base);
    if (!ch.ok) return ch;
    if (ch.mode !== 'kk') return fail('Mehrere Bauteile brauchen einen gemeinsamen Kühlkörper.');
    const p = num(P1, NaN), a = ta === undefined || ta === null ? K.TA_STD : num(ta, NaN);
    if (!(p >= 0) || !isFinite(a)) return fail(TXT.ungueltig);
    const tk = a + nn * p * ch.rthK, tc = tk + p * ch.rthCK, tj = tc + p * ch.rthJC;
    return { ok: true, n: nn, pTotal: nn * p, tk: tk, tc: tc, tj: tj, dK: nn * p * ch.rthK, rthK: ch.rthK, rthTotal: ch.rthJC + ch.rthCK + nn * ch.rthK, steps: [
      sym('Tk') + ' = ' + sym('Ta') + ' + n · P · ' + sym('Rth_K') + ' = ' + fmt(a) + ' °C + ' + nn + ' · ' + fmt(p) + ' W · ' + fmt(ch.rthK) + ' K/W = ' + fmt(tk) + ' °C (der Kühlkörper trägt die Summe ' + fmt(nn * p) + ' W)',
      sym('Tj') + ' = ' + sym('Tk') + ' + P · (' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ') = ' + fmt(tk) + ' °C + ' + fmt(p) + ' W · (' + fmt(ch.rthJC) + ' K/W + ' + fmt(ch.rthCK) + ' K/W) = ' + fmt(tj) + ' °C'] };
  }

  /* ---------- Thermische Mitkopplung ---------- */
  /* coupled.mosfet({ i, d, rds25, alpha, u, f, tr, tf, rth (gesamt), ta }): Der Leitverlust waechst mit Tj. Geschlossene Loesung
   *   Tj - 25 = [(Ta - 25) + Rth * (P_leit,25 + P_sw)] / (1 - G),  G = P_leit,25 * alpha * Rth.  G >= 1: Weglaufen. */
  function coupledMosfet(o) {
    o = isObj(o) ? o : null;
    if (!o) return fail(TXT.ungueltig);
    const rth = num(o.rth, NaN), a = o.ta === undefined || o.ta === null ? K.TA_STD : num(o.ta, NaN), alpha = num(o.alpha, 0.0065);
    if (!(rth > 0) || !isFinite(a) || !(alpha >= 0)) return fail(TXT.ungueltig);
    const p0 = pMosfet({ i: o.i, d: o.d === undefined ? 1 : o.d, rds25: o.rds25, tj: 25, alpha: alpha, u: o.u, f: o.f, tr: o.tr, tf: o.tf });
    if (!p0.ok) return p0;
    const pl25 = p0.pLeit, ps = p0.pSw;
    const G = pl25 * alpha * rth;
    if (G >= 1) return { ok: false, runaway: true, g: G, why: TXT.weglaufen, p0: pl25 + ps, pLeit25: pl25, pSw: ps };
    const dT = ((a - 25) + rth * (pl25 + ps)) / (1 - G);
    const tj = 25 + dT;
    const pLeit = pl25 * (1 + alpha * (tj - 25));
    return { ok: true, runaway: false, g: G, tj: tj, p: pLeit + ps, pLeit: pLeit, pSw: ps, pLeit25: pl25, dT: tj - a, steps: [
      'G = P_leit,25 · α · Rth_ges = ' + fmt(pl25) + ' W · ' + fmt(alpha) + ' /K · ' + fmt(rth) + ' K/W = ' + fmt(G) + ' (stabil, wenn G < 1)',
      sym('Tj') + ' − 25 °C = [(' + sym('Ta') + ' − 25 °C) + Rth_ges · (P_leit,25 + P_sw)] / (1 − G) = ' + fmt(dT) + ' K, also ' + sym('Tj') + ' = ' + fmt(tj) + ' °C',
      'P = P_leit,25 · (1 + α · (' + sym('Tj') + ' − 25 °C)) + P_sw = ' + fmt(pLeit + ps) + ' W'] };
  }
  /* coupled.runaway({ uce, ic (bei 25 °C), rth, ta, re }): Bipolartransistor mit fester UBE: Ic(Tj) = Ic25 * 2^((Tj - 25)/10).
   *   Mit Emitterwiderstand re (> 0): Ic = Ic25 + 2 mV/K * (Tj - 25) / re (linear, Gegenkopplung). */
  function coupledRunaway(o) {
    o = isObj(o) ? o : null;
    if (!o) return fail(TXT.ungueltig);
    const uce = num(o.uce, NaN), ic25 = num(o.ic, NaN), rth = num(o.rth, NaN), a = o.ta === undefined || o.ta === null ? K.TA_STD : num(o.ta, NaN), re = num(o.re, 0);
    if (!(uce >= 0) || !(ic25 >= 0) || !(rth > 0) || !isFinite(a)) return fail(TXT.ungueltig);
    if (re > 0) {
      const k = 0.002 / re, G = uce * k * rth;
      if (G >= 1) return { ok: false, runaway: true, g: G, why: TXT.weglaufenBip };
      const dT = ((a - 25) + rth * uce * ic25) / (1 - G), tj = 25 + dT, ic = ic25 + k * (tj - 25);
      return { ok: true, runaway: false, g: G, tj: tj, ic: ic, p: uce * ic, steps: ['G = UCE · (2 mV/K / re) · Rth_ges = ' + fmt(G) + ' (stabil, wenn G < 1)', sym('Tj') + ' = ' + fmt(tj) + ' °C, IC = ' + fmt(ic) + ' A, P = ' + fmt(uce * ic) + ' W'] };
    }
    const c1 = LN2 / 10;
    if (ic25 === 0 || uce === 0) return { ok: true, runaway: false, g: 0, tj: a, ic: ic25, p: 0, steps: [] };
    const p = function (tj) { return uce * ic25 * Math.pow(2, (tj - 25) / 10); };
    // kritischer Punkt: dP/dTj * Rth = 1
    const tjC = 25 + 10 * Math.log2(1 / (c1 * rth * uce * ic25));
    const hC = tjC - a - rth * p(tjC);           // h(Tj) = Tj - Ta - Rth * P(Tj); Festpunkt bei h = 0
    if (hC < 0) return { ok: false, runaway: true, g: Infinity, why: TXT.weglaufenBip, tjCrit: tjC };
    let lo = Math.min(a, tjC) - 200, hi = tjC;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (mid - a - rth * p(mid) >= 0) hi = mid; else lo = mid; }
    const tj = (lo + hi) / 2, pp = p(tj), G = c1 * pp * rth;
    return { ok: true, runaway: false, g: G, tj: tj, ic: pp / uce, p: pp, tjCrit: tjC, steps: ['G = ln 2 / 10 K · P · Rth_ges = ' + fmt(G) + ' (stabil, wenn G < 1)', sym('Tj') + ' = ' + fmt(tj) + ' °C, P = ' + fmt(pp) + ' W'] };
  }

  /* ---------- Wirkungsgrad Linear- gegen Schaltregler (SPEC 4.6) ---------- */
  function etaLinear(ue, ua, ia, iq) {
    ue = num(ue, NaN); ua = num(ua, NaN);
    if (!(ue > 0) || !(ua >= 0) || ua > ue) return NaN;
    const i = num(ia, NaN), q = num(iq, NaN);
    if (isFinite(i) && i > 0 && isFinite(q) && q >= 0) return ua * i / (ue * (i + q));
    return ua / ue;
  }
  /* compare({ ue, ua, ia, iq?, eta?, ta?, device? }): Verlustleistungen beider Regler und die Aussage "Kuehlkoerper noetig?" nur nach dem Vergleich Tj <= Tj,max */
  function etaCompare(o) {
    o = isObj(o) ? o : null;
    if (!o) return fail(TXT.ungueltig);
    const dev = has(DEV, o.device) ? DEV[o.device] : DEV['7805'];
    if (dev.kind !== 'linear') return fail(TXT.ungueltig);
    const a = o.ta === undefined || o.ta === null ? K.TA_STD : num(o.ta, NaN);
    const pl = pLinear(o.ue, o.ua, o.ia, o.iq);
    if (!pl.ok) return pl;
    if (!isFinite(a)) return fail(TXT.ungueltig);
    const ue = num(o.ue, NaN), ua = num(o.ua, NaN), ia = num(o.ia, NaN);
    const pa = ua * ia;
    const sw = pSwitching(pa, o.eta === undefined ? K.ETA_SW : o.eta);
    if (!sw.ok) return sw;
    const tjLin = a + pl.p * dev.rthJA, tjSw = a + sw.p * K.RTH_SWCHIP;
    const needLin = tjLin > dev.tjMax, needSw = tjSw > K.TJMAX_SWCHIP;
    const etaL = etaLinear(ue, ua, ia, o.iq);
    return { ok: true, pa: pa, etaLin: etaL, etaSw: sw.eta, pvLin: pl.p, pvSw: sw.p, saved: pl.p - sw.p, savedPct: pl.p > 0 ? 100 * (pl.p - sw.p) / pl.p : 0,
      tjLinFree: tjLin, tjSwFree: tjSw, needSinkLin: needLin, needSinkSw: needSw, rthSwChip: K.RTH_SWCHIP, note: sw.note,
      text: 'Linearregler freistehend: ' + sym('Tj') + ' = ' + fmt(tjLin, 1) + ' °C ' + (needLin ? '> ' : '≤ ') + fmt(dev.tjMax) + ' °C, Kühlkörper nötig: ' + (needLin ? 'ja' : 'nein') + '. Schaltregler freistehend: ' + sym('Tj') + ' = ' + fmt(tjSw, 1) + ' °C ' + (needSw ? '> ' : '≤ ') + fmt(K.TJMAX_SWCHIP) + ' °C, Kühlkörper nötig: ' + (needSw ? 'ja' : 'nein') + ' (Übungsannahme η = ' + fmt(sw.eta * 100, 0) + ' %).',
      steps: [pl.steps[0], 'η_lin = Ua · Ia / (Ue · (Ia + Iq)) = ' + fmt(etaL * 100, 1) + ' %', sw.steps[0], 'Ersparnis = ' + fmt(pl.p) + ' W − ' + fmt(sw.p) + ' W = ' + fmt(pl.p - sw.p) + ' W'] };
  }

  /* =====================================================================================================
   *  M2: ZEITVERHALTEN (SPEC 4.5) - Netz aus Waermekapazitaeten und Waermewiderstaenden, exakter Schritt
   * ===================================================================================================== */
  const RMIN = 1e-4, CMIN = 1e-3;
  /* Jacobi-Verfahren fuer symmetrische Matrizen (n klein) */
  function jacobiEig(S0, n) {
    const a = S0.map(function (r) { return r.slice(); });
    const v = [];
    for (let i = 0; i < n; i++) { v.push(new Array(n).fill(0)); v[i][i] = 1; }
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0, dia = 0;
      for (let i = 0; i < n; i++) { dia += a[i][i] * a[i][i]; for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j]; }
      if (off <= 1e-34 * dia) break;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          const apq = a[p][q];
          if (Math.abs(apq) < 1e-300) continue;
          const theta = (a[q][q] - a[p][p]) / (2 * apq);
          const tt = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(tt * tt + 1), s = tt * c;
          for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
          for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
          for (let k = 0; k < n; k++) { const vkp = v[k][p], vkq = v[k][q]; v[k][p] = c * vkp - s * vkq; v[k][q] = s * vkp + c * vkq; }
        }
      }
    }
    const vals = []; for (let i = 0; i < n; i++) vals.push(a[i][i]);
    return { vals: vals, vecs: v };
  }
  function invMatrix(G, n) {
    const a = G.map(function (r, i) { const row = r.slice(); for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0); return row; });
    for (let c = 0; c < n; c++) {
      let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[piv][c])) piv = r;
      const tmp = a[c]; a[c] = a[piv]; a[piv] = tmp;
      const d = a[c][c];
      for (let j = 0; j < 2 * n; j++) a[c][j] /= d;
      for (let r = 0; r < n; r++) if (r !== c) { const f = a[r][c]; if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[c][j]; }
    }
    return a.map(function (r) { return r.slice(n); });
  }
  /* Netz aus chain(): { n, names, C, G, g0, powerNodes:[i], idx:{j:[...], c, k} } */
  function buildNet(ch, rthKOverride) {
    const R = function (x) { return Math.max(RMIN, x); }, Cp = function (x) { return Math.max(CMIN, x); };
    const rk = isFinite(rthKOverride) ? rthKOverride : ch.rthK;
    let names = [], Cv = [], edges = [], ground = [], powerNodes = [];
    const idx = { j: [], c: -1, k: -1 };
    if (ch.mode === 'kk' && ch.count === 1) {
      names = ['j', 'c', 'k']; Cv = [Cp(ch.cth.j), Cp(ch.cth.c), Cp(ch.cth.k)];
      edges = [[0, 1, R(ch.rthJC)], [1, 2, R(ch.rthCK)]];
      ground = [[2, R(rk)]];
      powerNodes = [0]; idx.j = [0]; idx.c = 1; idx.k = 2;
    } else if (ch.mode === 'kk') {
      const n = ch.count;
      for (let i = 0; i < n; i++) { names.push('j' + (i + 1)); Cv.push(Cp(ch.cth.j + ch.cth.c)); edges.push([i, n, R(ch.rthJC + ch.rthCK)]); powerNodes.push(i); idx.j.push(i); }
      names.push('k'); Cv.push(Cp(ch.cth.k)); ground = [[n, R(rk)]];
      idx.k = n; idx.c = -1;
    } else if (ch.rthJC > 0) {
      names = ['j', 'c']; Cv = [Cp(ch.cth.j), Cp(ch.cth.c)];
      edges = [[0, 1, R(ch.rthJC)]]; ground = [[1, R(ch.rthCA)]];
      powerNodes = [0]; idx.j = [0]; idx.c = 1;
    } else {
      names = ['c']; Cv = [Cp(ch.cth.c)]; ground = [[0, R(ch.rthCA)]];
      powerNodes = [0]; idx.j = [0]; idx.c = 0;
    }
    const n = names.length;
    const G = []; for (let i = 0; i < n; i++) G.push(new Array(n).fill(0));
    const g0 = new Array(n).fill(0);
    edges.forEach(function (e) { const g = 1 / e[2]; G[e[0]][e[0]] += g; G[e[1]][e[1]] += g; G[e[0]][e[1]] -= g; G[e[1]][e[0]] -= g; });
    ground.forEach(function (e) { const g = 1 / e[1]; G[e[0]][e[0]] += g; g0[e[0]] = g; });
    const Cs = Cv.map(Math.sqrt);
    const S0 = []; for (let i = 0; i < n; i++) { S0.push([]); for (let j = 0; j < n; j++) S0[i].push(G[i][j] / (Cs[i] * Cs[j])); }
    const eig = jacobiEig(S0, n);
    return { n: n, names: names, C: Cv, Cs: Cs, G: G, g0: g0, Ginv: invMatrix(G, n), powerNodes: powerNodes, idx: idx, lam: eig.vals, V: eig.vecs, mode: ch.mode, count: ch.count,
      rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: rk, rthCA: ch.rthCA };
  }
  function netTinf(net, P, ta) {
    const n = net.n, f = new Array(n).fill(0);
    for (let i = 0; i < n; i++) f[i] = net.g0[i] * ta;
    net.powerNodes.forEach(function (i) { f[i] += P; });
    const T = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < n; j++) s += net.Ginv[i][j] * f[j]; T[i] = s; }
    return T;
  }
  function netDecay(net, y0, dt) {
    const n = net.n, z = new Array(n).fill(0), y = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < n; k++) s += net.V[k][i] * y0[k]; z[i] = s * Math.exp(-net.lam[i] * dt); }
    for (let k = 0; k < n; k++) { let s = 0; for (let i = 0; i < n; i++) s += net.V[k][i] * z[i]; y[k] = s; }
    return y;
  }
  /* Messgroessen aus den Knotentemperaturen: tj (erster Sperrschichtknoten), tc, tk */
  function netReadout(net, T, ta) {
    const tj = T[net.idx.j[0]];
    const tk = net.idx.k >= 0 ? T[net.idx.k] : ta;
    const tc = net.idx.c >= 0 ? T[net.idx.c] : tk + (tj - tk) * net.rthCK / Math.max(RMIN, net.rthJC + net.rthCK);
    return { tj: tj, tc: tc, tk: tk };
  }
  function deadThermal(why) {
    return { ok: false, why: why, step: function () { return NaN; }, state: function () { return { tj: NaN, tc: NaN, tk: NaN }; }, reset: function () {}, set: function () {}, setCfg: function () { return fail(why); }, settle: function () {}, tauDominant: function () { return NaN; }, tauList: function () { return []; }, nodes: function () { return []; }, steadyNodes: function () { return []; }, stepResponse: function () { return fail(why); } };
  }
  /* thermal(cfg): { step(dtS, P, ta), state(), reset(ta), set(tj, tc, tk), setCfg(cfg), settle(P, ta), steadyNodes(P, ta), tauDominant(), tauList(), nodes(), chain(), stepResponse(tEnd, n) }
   * P ist die Verlustleistung JE Bauteil (bei count > 1 speist jedes Bauteil P in seinen eigenen Sperrschichtknoten). */
  function thermal(cfgIn) {
    let ch = chain(cfgIn);
    if (!ch.ok) return deadThermal(ch.why);
    let net = buildNet(ch, NaN), T = new Array(net.n).fill(K.TA_STD), lastTa = K.TA_STD, lastRk = ch.rthK;
    function maybeRebuild(ta) {
      if (!(ch.cfg.nonlin === true && ch.mode === 'kk')) return;
      const rk = ch.rthK0 * ch.fanF * ch.orientF * nonlinFactor(net.count * (T[net.idx.k] - ta));
      if (Math.abs(rk / lastRk - 1) > 1e-3) { net = buildNet(ch, rk); lastRk = rk; }
    }
    return {
      ok: true,
      step: C(function (dtS, P, ta) {
        const dt = num(dtS, NaN), p = num(P, 0), a = ta === undefined || ta === null ? lastTa : num(ta, lastTa);
        if (!(dt >= 0)) return NaN;
        lastTa = a;
        maybeRebuild(a);
        if (dt === 0) return T[net.idx.j[0]];
        const Ti = netTinf(net, p, a), y0 = new Array(net.n);
        for (let i = 0; i < net.n; i++) y0[i] = net.Cs[i] * (T[i] - Ti[i]);
        const y = netDecay(net, y0, dt);
        for (let i = 0; i < net.n; i++) T[i] = Ti[i] + y[i] / net.Cs[i];
        return T[net.idx.j[0]];
      }),
      state: function () { const r = netReadout(net, T, lastTa); r.ta = lastTa; r.x = T.slice(); return r; },
      reset: function (ta) { const a = num(ta, K.TA_STD); lastTa = a; T = new Array(net.n).fill(a); },
      set: function (tj, tc, tk) {
        const a = lastTa;
        for (let i = 0; i < net.n; i++) T[i] = a;
        net.idx.j.forEach(function (i) { T[i] = num(tj, a); });
        if (net.idx.c >= 0 && net.idx.c !== net.idx.j[0]) T[net.idx.c] = num(tc, a);
        if (net.idx.k >= 0) T[net.idx.k] = num(tk, a);
      },
      /* setCfg(cfg): neuer Aufbau; die Knoten behalten ihre Temperatur (A22), ein neuer Kuehlkoerper-Knoten startet bei Ta */
      setCfg: function (cNew) {
        const c2 = chain(cNew);
        if (!c2.ok) return c2;
        const old = netReadout(net, T, lastTa);
        ch = c2; net = buildNet(ch, NaN); lastRk = ch.rthK;
        T = new Array(net.n).fill(lastTa);
        net.idx.j.forEach(function (i) { T[i] = old.tj; });
        if (net.idx.c >= 0 && net.idx.c !== net.idx.j[0]) T[net.idx.c] = old.tc;
        if (net.idx.k >= 0) T[net.idx.k] = isFinite(old.tk) ? old.tk : lastTa;
        return { ok: true };
      },
      settle: function (P, ta) { const a = ta === undefined || ta === null ? lastTa : num(ta, lastTa); lastTa = a; T = netTinf(net, num(P, 0), a); },
      steadyNodes: function (P, ta) { return netTinf(net, num(P, 0), ta === undefined || ta === null ? lastTa : num(ta, lastTa)); },
      tauDominant: C(function () { return 1 / Math.min.apply(null, net.lam); }),
      tauList: function () { return net.lam.map(function (l) { return 1 / l; }).sort(function (x, y) { return y - x; }); },
      nodes: function () { return net.names.slice(); },
      chain: function () { return ch; },
      stepResponse: function (tEnd, n) { return stepResponse(ch.cfg, tEnd, n); }
    };
  }
  /* Antwort des kalten Netzes (T = Ta = 0) auf P = 1 W je Bauteil, geschlossene Formel (kein Schrittverfahren) */
  function netResponse(net, tArr) {
    const Ti = netTinf(net, 1, 0), y0 = new Array(net.n);
    for (let i = 0; i < net.n; i++) y0[i] = net.Cs[i] * (0 - Ti[i]);
    return tArr.map(function (t) {
      const y = netDecay(net, y0, Math.max(0, t));
      const T = new Array(net.n);
      for (let i = 0; i < net.n; i++) T[i] = Ti[i] + y[i] / net.Cs[i];
      return netReadout(net, T, 0);
    });
  }
  /* stepResponse(cfg, tEnd, n): { t, tj, tc, tk } fuer P = 1 W, Ta = 0 (Anstieg in K je W) */
  function stepResponse(cfgIn, tEnd, n) {
    const ch = chain(cfgIn);
    if (!ch.ok) return ch;
    const te = num(tEnd, NaN), N = clamp(Math.round(num(n, 60)), 2, 5000);
    if (!(te > 0)) return fail(TXT.ungueltig);
    const net = buildNet(ch, NaN), ts = [];
    for (let i = 0; i <= N; i++) ts.push(te * i / N);
    const r = netResponse(net, ts);
    return { ok: true, t: ts, tj: r.map(function (x) { return x.tj; }), tc: r.map(function (x) { return x.tc; }), tk: r.map(function (x) { return x.tk; }), rthTotal: ch.rthTotal };
  }
  /* zth(cfg, tArr): Sprungantwort von Tj in K/W (Impedanz) fuer die Zeiten tArr (s) */
  function zth(cfgIn, tArr) {
    const ch = chain(cfgIn);
    if (!ch.ok || !isArr(tArr)) return [];
    const net = buildNet(ch, NaN);
    return netResponse(net, tArr.map(function (t) { return num(t, 0); })).map(function (x) { return x.tj; });
  }
  /* pulseTj(cfg, Ppk, tp, T, ta): Spitzentemperatur bei periodischen Impulsen:
   *   Tj = Ta + Ppk * [ D*Rth_ges + (1 - D) * Zth(tp + T) - Zth(T) + Zth(tp) ],  D = tp / T   (Superposition; der Faktor (1 - D) gehoert nur an Zth(tp + T)) */
  function pulseTj(cfgIn, Ppk, tp, T, ta) {
    const ch = chain(cfgIn);
    if (!ch.ok) return ch;
    const pk = num(Ppk, NaN), t1 = num(tp, NaN), per = num(T, NaN), a = ta === undefined || ta === null ? K.TA_STD : num(ta, NaN);
    if (!(pk >= 0) || !(t1 > 0) || !isFinite(a)) return fail(TXT.ungueltig);
    if (!(per > 0)) return fail(TXT.impulsZuKurz);
    const rth = ch.rthTotal, D = t1 / per;
    if (D >= 1) return { ok: true, dauer: true, d: 1, tj: a + pk * rth, tjAvg: a + pk * rth, pAvg: pk, rthTotal: rth, note: fill(TXT.dauerbetrieb, {}), steps: [sym('Tj') + ' = ' + sym('Ta') + ' + P · ' + sym('Rth_ges') + ' = ' + fmt(a + pk * rth) + ' °C (Dauerbetrieb)'] };
    const z = zth(ch.cfg, [t1 + per, per, t1]);
    const zf = (1 - D) * z[0] - z[1] + z[2];   // Zth-Anteil der Klammer: (1 - D) * Zth(tp + T) - Zth(T) + Zth(tp)
    const tj = a + pk * (D * rth + zf);
    return { ok: true, dauer: false, d: D, tj: tj, tjAvg: a + pk * D * rth, pAvg: pk * D, zthTp: z[2], zthT: z[1], zthTpT: z[0], rthTotal: rth, note: '', steps: [
      'D = tp / T = ' + fmt(t1) + ' s / ' + fmt(per) + ' s = ' + fmt(D),
      'Zth(tp) = ' + fmt(z[2]) + ' K/W, Zth(T) = ' + fmt(z[1]) + ' K/W, Zth(tp + T) = ' + fmt(z[0]) + ' K/W',
      sym('Tj') + ' = ' + sym('Ta') + ' + P_pk · [D · ' + sym('Rth_ges') + ' + (1 − D) · Zth(tp + T) − Zth(T) + Zth(tp)] = ' + fmt(tj) + ' °C'] };
  }
  /* tauApprox(cfg): Naeherung tau ~ Rth_K,eff * (Cth_k + Cth_c + Cth_j) */
  function tauApprox(cfgIn) {
    const ch = chain(cfgIn);
    if (!ch.ok) return NaN;
    if (ch.mode === 'kk') return ch.count * ch.rthK * (ch.cth.k + ch.cth.c * ch.count + ch.cth.j * ch.count);
    return ch.rthCA * (ch.cth.c + ch.cth.j);
  }

  /* =====================================================================================================
   *  M3: DIAGNOSE UND TEXTE (SPEC 4.8)
   * ===================================================================================================== */
  const DIAG = {
    'heiss': 'Die Sperrschicht ist mit {tj} °C heißer als erlaubt ({tjmax} °C): Das Bauteil wird geschädigt. Verkleinere die Verlustleistung oder den Wärmewiderstand.',
    'reserve': 'Die Reserve beträgt nur {res} K bis zur zulässigen Sperrschichttemperatur.',
    'abschalt': 'Thermische Abschaltung: Der Regler schaltet bei {on} °C ab und kühlt ab, bis er bei {off} °C wieder einschaltet. Das ist ein Schutz, kein Betriebspunkt.',
    'pendeln': 'Der Regler schaltet immer wieder ab und ein (Pendeln, bisher {n} Mal). Die Ausgangsspannung bricht dabei zusammen.',
    'frei-zu-heiss': 'Freistehend darfst du höchstens {pzul} W umsetzen, du hast {p} W. Du brauchst einen Kühlkörper.',
    'paste-fehlt': 'Ohne Wärmeleitpaste ist {sym:Rth_CK} = {ohne} K/W statt {mit} K/W mit Paste: Die Sperrschicht ist {dt} K heißer.',
    'kurzschluss': 'Kurzschluss: Die Fahne des Bauteils liegt an {pot} und berührt den Kühlkörper, der an {kk} liegt.',
    'buchse-fehlt': 'Die Isolierbuchse fehlt. Hier passiert noch nichts, weil Fahne und Kühlkörper dasselbe Potenzial haben; bei einem anderen Bauteil wäre das ein Kurzschluss.',
    'beruehr': 'Der Kühlkörper führt Spannung ({u} V gegen Masse). Isoliere ihn oder baue ihn berührgeschützt ein.',
    'locker': 'Die Schraube ist locker: {sym:Rth_CK} steigt von {a} auf {b} K/W.',
    'dick': 'Zu viel Wärmeleitpaste: {sym:Rth_CK} steigt von {a} auf {b} K/W. Trage sie dünn auf.',
    'luefter-hilft': 'Ein Lüfter (mittel) würde {sym:Tj} auf {tj} °C senken.',
    'dropout': 'Die Eingangsspannung ist zu klein: Der Regler braucht mindestens {vdo} V Differenz (Dropout) und regelt nicht mehr, Ua ≈ {ua} V.',
    'ilimit': 'Strombegrenzung: Der Regler liefert höchstens {ilim} A bei diesem Spannungsabfall, die Ausgangsspannung bricht ein.',
    'ue-hoch': '{was} ({x} V) liegt über dem empfohlenen Wert ({rec} V).',
    'ue-abs': '{was} ({x} V) liegt über dem absoluten Grenzwert ({abs} V): Das Bauteil kann beschädigt werden.',
    'i-hoch': 'Der Strom liegt über dem empfohlenen Wert ({rec} A).',
    'minlast': 'Unter der Mindestlast aus dem Datenblatt ({ilmin} mA): Die Ausgangsspannung ist nicht sicher geregelt.',
    'runaway': TXT.weglaufen,
    'runaway-bip': TXT.weglaufenBip,
    'defekt': 'Bauteil defekt: Die Sperrschicht war zu heiß. Setze den Prüfstand zurück.',
    'hand-heiss': 'Der Kühlkörper ist {t} °C heiß: Berührungsgefahr.',
    'hand-heiss-gehaeuse': 'Das Gehäuse ist {t} °C heiß: Berührungsgefahr.',
    'ta-hoch': 'Im Gerät ist es warm: Die Umgebung für den Kühlkörper ist {ta} °C.',
    'vergleich-paste': 'Mit Paste statt ohne ist {sym:Tj} in {wo} um {dt} K niedriger.',
    'spec': 'Mit RDS(on,max) rechnest du auf der sicheren Seite.'
  };
  const TEXTS = {
    diag: DIAG,
    rig: { wertAblehnen: TXT.wertAblehnen, zeitraffer: 'Zeitraffer gedrosselt', beharrung: 'Beharrungszustand', unbekannterSchluessel: 'Schlüssel „{key}“ gibt es an dieser Anlage nicht.' },
    kern: TXT,
    get: function (id, vars) {
      const tplText = has(DIAG, id) ? DIAG[id] : (has(TEXTS.rig, id) ? TEXTS.rig[id] : (has(TXT, id) ? TXT[id] : ''));
      return fill(tplText, vars);
    }
  };
  const F_ = function (id) { return formById[id]; };
  /* diagnose(ctx): jede Meldung nur bei geprueft erfuellter Bedingung (Regel 2); Zahlen stammen aus steady/chain/mount.
   * ctx: { cfg, p, ta, tj?, tc?, tk?, tjMax?, shutdown?, shutCount?, destroyed?, runaway?:bool|'bip', op?, elec?, tabV?, set? }
   *   op = Betriebspunkt fuer devices[id].elec (z. B. { ue, ua, iLoad, ... }); elec = bereits berechnetes Ergebnis von elec.
   *   Ohne cfg genuegen { tj, tjMax }: dann erscheinen nur heiss, reserve und defekt. */
  function diagnose(ctx) {
    const out = [];
    if (!isObj(ctx)) return out;
    const set = ctx.set === 'de' || ctx.set === 'db' ? ctx.set : undefined;
    function add(id, kind, vars, fx, tplId) {
      const o = { id: id, kind: kind, text: fill(DIAG[tplId || id], vars, set) };
      if (fx) o.fx = fx;
      out.push(o);
    }
    let ch = null, dev = null, st = null;
    const p = num(ctx.p, NaN), ta = ctx.ta === undefined || ctx.ta === null ? K.TA_STD : num(ctx.ta, NaN);
    if (isObj(ctx.cfg)) {
      ch = chain(ctx.cfg);
      if (ch.ok) { dev = ch.dev; if (isFinite(p) && p >= 0 && isFinite(ta)) { st = steady(ctx.cfg, p, ta); if (!st.ok) st = null; } }
      else ch = null;
    }
    const tjMax = ch ? ch.tjMax : num(ctx.tjMax, NaN);
    const tj = isFinite(num(ctx.tj, NaN)) ? num(ctx.tj, NaN) : (st ? st.tj : NaN);
    const tc = isFinite(num(ctx.tc, NaN)) ? num(ctx.tc, NaN) : (st ? st.tc : NaN);
    const tk = isFinite(num(ctx.tk, NaN)) ? num(ctx.tk, NaN) : (st ? st.tk : NaN);
    let el = isObj(ctx.elec) ? ctx.elec : null;
    if (!el && dev && isObj(ctx.op) && typeof dev.elec === 'function') { const r = dev.elec(ctx.op); if (r && r.ok) el = r; }
    // Fehler zuerst
    const destroyed = ctx.destroyed === true || (isFinite(tj) && isFinite(tjMax) && dev && isFinite(dev.destroyAt) && tj >= dev.destroyAt);
    if (destroyed) add('defekt', 'error', {}, 'defekt');
    if (ch && ch.mode === 'kk' && ch.faults.indexOf('kurzschluss') >= 0) add('kurzschluss', 'error', { pot: dev.tab.potText, kk: 'Gerätemasse' }, 'spark');
    if (isFinite(tj) && isFinite(tjMax) && tj > tjMax) add('heiss', 'error', { tj: fmt(tj, 1), tjmax: fmt(tjMax) }, 'smoke');
    if (ctx.runaway) add('runaway', 'error', {}, null, ctx.runaway === 'bip' ? 'runaway-bip' : 'runaway');
    // Grenzwerte der Betriebsspannung (aus dem Bauteil, nie fest im Text)
    if (dev && el) {
      const lim = dev.limits || {};
      if (dev.id === '7805' && isFinite(el.ue)) {
        if (el.ue > lim.ueAbs) add('ue-abs', 'error', { was: 'Die Eingangsspannung', x: fmt(el.ue), abs: fmt(lim.ueAbs) });
        else if (el.ue > lim.ueRec[1]) add('ue-hoch', 'warn', { was: 'Die Eingangsspannung', x: fmt(el.ue), rec: fmt(lim.ueRec[1]) });
      }
      if (dev.id === 'lm317' && isFinite(el.du)) {
        if (el.du > lim.duAbs + 1e-9) add('ue-abs', 'error', { was: 'Die Spannungsdifferenz zwischen Eingang und Ausgang', x: fmt(el.du), abs: fmt(lim.duAbs) });
      }
      if (dev.id === 'irlz34n' && isFinite(num(ctx.op && ctx.op.u, NaN))) {
        const u = num(ctx.op.u, NaN);
        if (u > lim.vdsAbs) add('ue-abs', 'error', { was: 'Die Spannung am Schalter', x: fmt(u), abs: fmt(lim.vdsAbs) });
        else if (u > lim.vdsRec) add('ue-hoch', 'warn', { was: 'Die Spannung am Schalter', x: fmt(u), rec: fmt(lim.vdsRec) });
      }
      if (dev.id === 'bd139' && isFinite(num(ctx.op && ctx.op.uce, NaN))) {
        const u = num(ctx.op.uce, NaN);
        if (u > lim.vceAbs) add('ue-abs', 'error', { was: 'Die Spannung UCE', x: fmt(u), abs: fmt(lim.vceAbs) });
        else if (u > lim.vceRec) add('ue-hoch', 'warn', { was: 'Die Spannung UCE', x: fmt(u), rec: fmt(lim.vceRec) });
      }
    }
    // Zustaende der Regler
    if (el && ctx.shutdown !== true) {
      if (el.dropout) add('dropout', 'warn', { vdo: fmt(el.vdo), ua: fmt(el.ua) });
      if (el.ilimit) add('ilimit', 'warn', { ilim: fmt(el.ilim) });
      if (el.minlast && dev && dev.id === 'lm317') add('minlast', 'warn', { ilmin: fmt(dev.ilmin * 1000, 0) });
    }
    if (ctx.shutdown === true && dev && dev.shutdown) add('abschalt', 'warn', { on: fmt(dev.shutdown.on), off: fmt(dev.shutdown.off) }, 'shutdown');
    if (num(ctx.shutCount, 0) >= 2) add('pendeln', 'warn', { n: fmt(num(ctx.shutCount, 0), 0) });
    // Strom ueber dem empfohlenen Wert
    if (dev && dev.limits) {
      const lim = dev.limits;
      let io = NaN, rec = NaN;
      if (dev.kind === 'linear' && el) { io = el.ia; rec = dev.id === 'lm317' ? lim.iRec[1] : lim.iRec; }
      else if (dev.id === 'irlz34n' && ctx.op) { io = num(ctx.op.i, NaN); rec = lim.iRec; }
      else if (dev.id === 'bd139' && ctx.op) { io = num(ctx.op.ic, NaN); rec = lim.iRec; }
      else if (dev.id === '1n4007' && ctx.op) { io = num(ctx.op.i, NaN); rec = lim.iRec; }
      if (isFinite(io) && isFinite(rec) && io > rec + 1e-12) add('i-hoch', 'warn', { rec: fmt(rec) });
    }
    // Montage
    if (ch && ch.mode === 'frei' && dev && st) {
      const pz = pzul(ctx.cfg, ta);
      if (p > pz + 1e-12) add('frei-zu-heiss', 'warn', { pzul: fmt(pz), p: fmt(p) });
    }
    if (ch && ch.mode === 'kk' && st && p > 0 && ch.faults.indexOf('paste-fehlt') >= 0) {
      const mit = rthCK(dev.pkg, ch.cfg.joint, 'duenn', ch.cfg.screw), ohne = rthCK(dev.pkg, ch.cfg.joint, 'keine', ch.cfg.screw);
      if (ohne > mit) add('paste-fehlt', 'warn', { ohne: fmt(ohne), mit: fmt(mit), dt: fmt(p * (ohne - mit), 1) });
    }
    if (ch && ch.mode === 'kk' && ch.faults.indexOf('locker') >= 0) add('locker', 'warn', { a: fmt(rthCK(dev.pkg, ch.cfg.joint, ch.cfg.paste, 'fest')), b: fmt(ch.rthCK) });
    if (ch && ch.mode === 'kk' && ch.faults.indexOf('dick') >= 0) add('dick', 'warn', { a: fmt(rthCK(dev.pkg, ch.cfg.joint, 'duenn', ch.cfg.screw)), b: fmt(ch.rthCK) });
    if (ch && ch.mode === 'kk' && ch.faults.indexOf('buchse-fehlt') >= 0 && ch.faults.indexOf('kurzschluss') < 0) add('buchse-fehlt', 'info', {});
    if (ch && ch.mode === 'kk' && ch.cfg.ksPot === 'frei') {
      let u = NaN;
      if (isFinite(num(ctx.tabV, NaN))) u = num(ctx.tabV, NaN);
      else if (dev.id === 'lm317' && el && isFinite(el.ua)) u = el.ua;
      else if (dev.tab.pot === 'masse') u = 0;
      if (isFinite(u) && u > 0) add('beruehr', 'warn', { u: fmt(u, 1) });
    }
    if (ch && ch.mode === 'kk' && st && ch.cfg.fan === 'aus' && isFinite(tj) && tj > tjMax) {
      const s2 = steady(Object.assign({}, ctx.cfg, { fan: 'mittel' }), p, ta);
      if (s2.ok && s2.tj <= tjMax) add('luefter-hilft', 'info', { tj: fmt(s2.tj, 1) });
    }
    // Reserve, Temperaturen
    if (isFinite(tj) && isFinite(tjMax) && tj <= tjMax && tjMax - tj < K.RESERVE_K && !destroyed) add('reserve', 'info', { res: fmt(tjMax - tj, 1) });
    if (ch && st && ch.mode === 'kk' && isFinite(tk) && tk > K.T_HAND) add('hand-heiss', 'info', { t: fmt(tk, 1) });
    else if (ch && st && ch.mode === 'frei' && isFinite(tc) && tc > K.T_HAND) add('hand-heiss', 'info', { t: fmt(tc, 1) }, null, 'hand-heiss-gehaeuse');
    if (isFinite(ta) && ta > K.TA_WARM) add('ta-hoch', 'info', { ta: fmt(ta, 0) });
    return out;
  }

  /* =====================================================================================================
   *  M3: RECIPE - Pruefungs-Berechnungsgang in sieben Schritten (SPEC 4.7)
   * ===================================================================================================== */
  /* recipe({ device | cfg, op | p, ta, joint, paste, screw, fan, orient, heatsink, count, tjMax, rthJC, rthCK, rthJA, margin, compare }):
   *   Schritte (1) Verlustleistung, (2) Ersatzschaltbild, (3) Rth_ges des gegebenen Aufbaus, (4) Tj und Vergleich mit Tj,max, (5) Rth_K,erf,
   *   (6) Kuehlkoerper waehlen, (7) Kontrolle mit dem gewaehlten Kuehlkoerper. Ausgabe { ok, steps:[{ n, title, lines, text }], result, warn }. */
  function recipe(inp) {
    if (!isObj(inp)) return fail(TXT.ungueltig, { steps: [], result: {}, warn: [TXT.ungueltig] });
    const devId = inp.device === undefined ? (isObj(inp.cfg) && inp.cfg.device ? inp.cfg.device : '7805') : inp.device;
    if (!has(DEV, devId)) return fail(TXT.ungueltigerAufbau, { steps: [], result: {}, warn: [TXT.ungueltigerAufbau] });
    const dev = DEV[devId];
    const ov = {};
    ['tjMax', 'rthJC', 'rthCK', 'rthJA'].forEach(function (k) { if (isFinite(num(inp[k], NaN))) ov[k] = num(inp[k], NaN); });
    const base = Object.assign({ device: devId }, isObj(inp.cfg) ? inp.cfg : {}, { overrides: Object.assign({}, isObj(inp.cfg) && isObj(inp.cfg.overrides) ? inp.cfg.overrides : {}, ov) });
    ['joint', 'paste', 'screw', 'fan', 'orient', 'heatsink', 'count', 'bushing', 'ksPot'].forEach(function (k) { if (inp[k] !== undefined) base[k] = inp[k]; });
    const ta = inp.ta === undefined || inp.ta === null ? K.TA_STD : num(inp.ta, NaN);
    if (!isFinite(ta)) return fail(TXT.ungueltig, { steps: [], result: {}, warn: [TXT.ungueltig] });
    const warn = [], steps = [];
    // (1) Verlustleistung
    let p = NaN, l1 = [];
    if (isFinite(num(inp.p, NaN)) && inp.p >= 0) { p = num(inp.p, NaN); l1 = ['P = ' + fmt(p) + ' W (gegeben)']; }
    else if (isObj(inp.op) && typeof dev.elec === 'function') {
      const e = dev.elec(inp.op);
      if (e && e.ok) { p = e.pv; l1 = (e.steps || []).slice(0, 2); if (!l1.length) l1 = ['P = ' + fmt(p) + ' W']; }
      else return fail(e && e.why ? e.why : TXT.ungueltig, { steps: [], result: {}, warn: [e && e.why ? e.why : TXT.ungueltig] });
    } else return fail('Gib die Verlustleistung P oder den Betriebspunkt an.', { steps: [], result: {}, warn: ['Gib die Verlustleistung P oder den Betriebspunkt an.'] });
    if (!(p >= 0)) return fail(TXT.pNeg, { steps: [], result: {}, warn: [TXT.pNeg] });
    steps.push({ n: 1, title: 'Verlustleistung berechnen', lines: l1 });
    const ch0 = chain(base);
    if (!ch0.ok) return fail(ch0.why, { steps: steps, result: {}, warn: [ch0.why] });
    const frei = ch0.mode === 'frei';
    // (2) Ersatzschaltbild
    const ckPlan = isFinite(num(ov.rthCK, NaN)) ? num(ov.rthCK, NaN) : rthCK(dev.pkg, base.joint, base.paste, base.screw);
    steps.push({ n: 2, title: 'Ersatzschaltbild zeichnen', lines: [
      'Die Wärme fließt von der Sperrschicht über ' + sym('Rth_JC') + ' (' + fmt(ch0.rthJC) + ' K/W) zum Gehäuse, über ' + sym('Rth_CK') + (isFinite(ckPlan) ? ' (' + fmt(ckPlan) + ' K/W)' : '') + ' zum Kühlkörper und über ' + sym('Rth_K') + ' zur Umgebung (' + sym('Ta') + ' = ' + fmt(ta) + ' °C). Die Glieder liegen in Reihe.',
      'Die Verlustleistung P = ' + fmt(p) + ' W wirkt wie eine Stromquelle, die Umgebungstemperatur wie eine Spannungsquelle.'] });
    // (3), (4) gegebener Aufbau
    const s0 = steady(base, p, ta, { margin: num(inp.margin, 0) });
    if (!s0.ok) return fail(s0.why, { steps: steps, result: {}, warn: [s0.why] });
    steps.push({ n: 3, title: 'Gesamt-Wärmewiderstand bestimmen', lines: [frei ? sym('Rth_ges') + ' = ' + sym('Rth_JA') + ' = ' + fmt(ch0.rthJA) + ' K/W (freistehend, ohne Kühlkörper)' : s0.steps[0]] });
    const lines4 = [sym('Tj') + ' = ' + sym('Ta') + ' + P · ' + sym('Rth_ges') + ' = ' + fmt(ta) + ' °C + ' + fmt(p) + ' W · ' + fmt(s0.rthTotal) + ' K/W = ' + fmt(s0.tj) + ' °C'];
    const tjMax = ch0.tjMax - num(inp.margin, 0);
    let verdict = 'unbekannt';
    if (inp.compare !== false) {
      const marg = tjMax - s0.tj;
      if (s0.tj > tjMax) { verdict = 'heiss'; lines4.push(fmt(s0.tj, 1) + ' °C > ' + fmt(tjMax) + ' °C: Das Bauteil ist zu heiß (' + fmt(-marg, 1) + ' K über der Grenze).'); }
      else { verdict = marg < K.RESERVE_K ? 'reserve' : 'ok'; lines4.push(fmt(s0.tj, 1) + ' °C ≤ ' + fmt(tjMax) + ' °C: in Ordnung, die Reserve beträgt ' + fmt(marg, 1) + ' K.'); }
    }
    steps.push({ n: 4, title: 'Sperrschichttemperatur berechnen und vergleichen', lines: lines4 });
    // (5) erforderlicher Rth_K
    const ke = rthKerf(base, p, ta, { margin: num(inp.margin, 0) });
    const l5 = ke.steps ? ke.steps.slice() : [];
    if (ke.why) l5.push(ke.why);
    if (!ke.steps && !ke.why) l5.push(TXT.ungueltig);
    steps.push({ n: 5, title: 'Erforderlichen Wärmewiderstand des Kühlkörpers berechnen', lines: l5 });
    if (!ke.ok || ke.kind !== 'ok') { if (ke.why) warn.push(ke.why); }
    // (6) Kuehlkoerper waehlen
    let ch6 = null, l6 = [];
    if (ke.ok && isFinite(ke.value)) {
      ch6 = chooseHeatsink(ke.value, { fan: base.fan, orient: base.orient, pkg: dev.pkg });
      if (ch6.ok) l6.push('Gewählt: ' + ch6.heatsink.name + ' mit ' + sym('Rth_K') + ' = ' + fmt(ch6.rthK) + ' K/W' + (ch6.rthKeff !== ch6.rthK ? ', wirksam ' + fmt(ch6.rthKeff) + ' K/W (Lüfter und Einbaulage)' : '') + ' ≤ ' + fmt(ke.value) + ' K/W, Reserve ' + fmt(ch6.reserve) + ' K/W.');
      else { l6.push(ch6.why); warn.push(ch6.why); }
    } else l6.push('Ohne einen positiven erforderlichen Wert kannst du keinen Kühlkörper wählen.');
    steps.push({ n: 6, title: 'Kühlkörper aus der Tabelle wählen', lines: l6 });
    // (7) Kontrolle
    let s7 = null, l7 = [];
    if (ch6 && ch6.ok) {
      const cfg7 = Object.assign({}, base, { heatsink: ch6.id });
      s7 = steady(cfg7, p, ta, { margin: num(inp.margin, 0) });
      const c7 = chain(cfg7);
      if (c7.ok) c7.notes.forEach(function (n7) { if (warn.indexOf(n7) < 0) warn.push(n7); });
      if (s7.ok) {
        l7 = s7.steps.slice();
        l7.push(fmt(s7.tj, 1) + ' °C ' + (s7.tj <= tjMax ? '≤ ' : '> ') + fmt(tjMax) + ' °C: ' + (s7.tj <= tjMax ? 'die Kontrolle stimmt, die Reserve beträgt ' + fmt(tjMax - s7.tj, 1) + ' K.' : 'die Kontrolle schlägt fehl.'));
        if (s7.tj > tjMax) warn.push('Die Kontrolle mit dem gewählten Kühlkörper schlägt fehl.');
      } else { l7.push(s7.why); warn.push(s7.why); }
    } else l7.push('Eine Kontrolle ist nicht möglich, weil kein Kühlkörper gewählt werden konnte.');
    steps.push({ n: 7, title: 'Kontrolle mit dem gewählten Kühlkörper', lines: l7 });
    steps.forEach(function (s) { s.text = s.lines.join('\n'); });
    ch0.notes.forEach(function (n) { warn.push(n); });
    return { ok: true, steps: steps, warn: warn, result: {
      p: p, ta: ta, tjMax: tjMax, rthJC: ch0.rthJC, rthCK: isFinite(ckPlan) ? ckPlan : ch0.rthCK, rthTotal: s0.rthTotal, mode: ch0.mode, tj: s0.tj, tc: s0.tc, tk: s0.tk, verdict: verdict,
      rthKerf: ke.ok ? ke.value : NaN, kind: ke.kind, heatsink: ch6 && ch6.ok ? ch6.id : null, rthKeff: ch6 && ch6.ok ? ch6.rthKeff : NaN,
      tjCheck: s7 && s7.ok ? s7.tj : NaN, tcCheck: s7 && s7.ok ? s7.tc : NaN, tkCheck: s7 && s7.ok ? s7.tk : NaN, reserveCheck: s7 && s7.ok ? tjMax - s7.tj : NaN } };
  }

  /* =====================================================================================================
   *  M3: UEBUNGEN (SPEC 4.7)
   * ===================================================================================================== */
  const EX_KINDS = ['pv', 'pvIq', 'rthges', 'tj', 'tc', 'tk', 'delta', 'pzul', 'rthkerf', 'tamax', 'kuehlerwahl', 'parallel', 'derating', 'eta', 'pvsw', 'tau', 'tpct', 'mosfet', 'diode', 'widerstand', 'led', 'endstufe', 'impuls', 'schicht'];
  const JNAME = { 'direkt|duenn': 'direkt mit Wärmeleitpaste', 'direkt|keine': 'direkt ohne Paste', 'glimmer|duenn': 'Glimmerscheibe mit Wärmeleitpaste', 'glimmer|keine': 'Glimmerscheibe ohne Paste', 'silikon|keine': 'Silikonfolie' };
  function exercise(kind, seed) {
    const idx = EX_KINDS.indexOf(kind);
    if (idx < 0) return fail('Unbekannte Übungsart „' + String(kind) + '“. Erlaubt: ' + EX_KINDS.join(', ') + '.');
    const sd = isFinite(num(seed, NaN)) ? Math.floor(num(seed, 1)) : 1;
    const R = rng(sd * 7919 + idx * 104729 + 13);
    const pick = function (a) { return a[Math.floor(R.next() * a.length) % a.length]; };
    let q = '', given = {}, ans = null, steps = [], tables = [], lowHint = '', highHint = '';
    const wrongs = [];
    function ex(value, unit, tol, alt) { ans = { value: value, unit: unit, tol: tol, alt: alt || [] }; }
    function addWrong(id, v, text) {
      if (!ans || !isFinite(v)) return;
      if (Math.abs(v - ans.value) <= 2 * ans.tol * Math.abs(ans.value) + 1e-9) return;
      for (let i = 0; i < ans.alt.length; i++) if (Math.abs(v - ans.alt[i]) <= 2 * ans.tol * Math.abs(ans.alt[i]) + 1e-9) return;
      for (let i = 0; i < wrongs.length; i++) if (Math.abs(v - wrongs[i].v) <= 2 * ans.tol * Math.abs(wrongs[i].v) + 1e-9) return;
      wrongs.push({ id: id, v: v, text: text });
    }
    const f = function (id) { return F_(id); };
    const ex1 = function (id) { return f(id).explain.apply(null, Array.prototype.slice.call(arguments, 1)).steps; };
    const num2 = function (x) { return fmt(x); };
    // Tabellen im Pruefungsstil: Zahlen stehen NUR in der Tabelle
    function tabDevice(d, extraRows) {
      const rows = [[sym('Tjmax'), fmt(d.tjMax) + ' °C'], [sym('Rth_JC'), fmt(d.rthJC) + ' K/W'], [sym('Rth_JA'), fmt(d.rthJA) + ' K/W']];
      return { caption: 'Bauteil ' + d.part, head: ['Größe', 'Wert'], rows: rows.concat(extraRows || []) };
    }
    function tabJoint(d, joint, paste) { return { caption: 'Übergang', head: ['Montage', sym('Rth_CK')], rows: [[JNAME[joint + '|' + paste], fmt(rthCK(d.pkg, joint, paste, 'fest')) + ' K/W']] }; }
    function tabHs(ids) { return { caption: 'Kühlkörper', head: ['Typ', sym('Rth_K')], rows: ids.map(function (id) { return [hsById[id].name, fmt(hsById[id].rthK) + ' K/W']; }) }; }
    function pickKette(o) {
      o = o || {};
      const devId = pick(o.devs || ['7805', 'lm317', 'bd139', 'irlz34n']), d = DEV[devId];
      const jopts = devId === '7805' ? [['direkt', 'duenn'], ['glimmer', 'duenn'], ['glimmer', 'keine'], ['silikon', 'keine']] : [['glimmer', 'duenn'], ['glimmer', 'keine'], ['silikon', 'keine']];
      const jo = pick(jopts), hsId = pick(o.hs || ['s', 'm', 'l', 'xl']);
      return { devId: devId, d: d, joint: jo[0], paste: jo[1], hsId: hsId, jc: d.rthJC, ck: rthCK(d.pkg, jo[0], jo[1], 'fest'), k: hsById[hsId].rthK, tjMax: d.tjMax, rthJA: d.rthJA };
    }
    function pickP(kk, ta, lo) {
      const ps = [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10];
      for (let tries = 0; tries < 40; tries++) {
        const p = pick(ps);
        if (p * (kk.jc + kk.ck + kk.k) <= kk.tjMax - ta - 5 && (!lo || p * (kk.jc + kk.ck + kk.k) >= lo)) return p;
      }
      return 1;
    }
    const tablesFor = function (kk, withHs) { const t = [tabDevice(kk.d), tabJoint(kk.d, kk.joint, kk.paste)]; if (withHs !== false) t.push(tabHs([kk.hsId])); return t; };
    const montageText = function (kk) { return 'Ein ' + kk.d.part + ' ist auf einen Kühlkörper montiert (Übergang: ' + JNAME[kk.joint + '|' + kk.paste] + ').'; };
    switch (kind) {
      case 'pv': case 'pvIq': {
        const lm = R.next() < 0.4, ue = pick([9, 12, 15, 18, 24]), ua = lm ? pick([3.3, 5, 9]) : 5, ia = pick([0.2, 0.3, 0.5, 0.8, 1]);
        const ueE = ue > ua + 3 ? ue : ua + 6 > 24 ? 24 : ua + 6;
        const part = lm ? 'TF-LM317' : 'TF-7805', iq = lm ? DEV.lm317.iadj : DEV['7805'].iq;
        given = { ue: ueE, ua: ua, ia: ia, device: lm ? 'lm317' : '7805' };
        const ohne = f('pLinear').fn(ueE, ua, ia, 0), mit = f('pLinear').fn(ueE, ua, ia, iq);
        if (kind === 'pv') {
          q = 'Der Linearregler ' + part + ' liegt an Ue = ' + num2(ueE) + ' V, liefert Ua = ' + num2(ua) + ' V und Ia = ' + num2(ia) + ' A. Berechne die Verlustleistung. Den Ruhestrom darfst du vernachlässigen.';
          ex(ohne, 'W', 0.02, [mit]); steps = ex1('pLinear', ueE, ua, ia, 0);
        } else {
          given.iq = iq;
          q = 'Der Linearregler ' + part + ' liegt an Ue = ' + num2(ueE) + ' V, liefert Ua = ' + num2(ua) + ' V und Ia = ' + num2(ia) + ' A. Der Ruhestrom beträgt Iq = ' + num2(iq * 1000) + ' mA. Berechne die Verlustleistung einschließlich des Ruhestroms.';
          ex(mit, 'W', 0.005, [ohne]); steps = ex1('pLinear', ueE, ua, ia, iq);
        }
        addWrong('ue-ia', ueE * ia, 'Das ist die Eingangsleistung Ue · Ia. Die Verlustleistung ist nur der Anteil, der am Regler abfällt: (Ue − Ua) · Ia.');
        addWrong('ua-ia', ua * ia, 'Das ist die Nutzleistung Ua · Ia am Ausgang. Die Verlustleistung fällt über der Spannungsdifferenz (Ue − Ua) am Regler ab.');
        addWrong('ue-ua', ueE - ua, 'Das ist die Spannungsdifferenz in V. Multipliziere sie noch mit dem Strom Ia.');
        lowHint = 'Prüfe: P = (Ue − Ua) · Ia' + (kind === 'pvIq' ? ' + Ue · Iq' : '') + '.'; highHint = lowHint;
        break;
      }
      case 'rthges': {
        const kk = pickKette(); given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId };
        tables = tablesFor(kk);
        q = montageText(kk) + ' Berechne den Gesamt-Wärmewiderstand von der Sperrschicht bis zur Umgebung. Die Werte stehen in den Tabellen.';
        const v = f('rthSum').fn(kk.jc, kk.ck, kk.k); ex(v, 'K/W', 0.02); steps = ex1('rthSum', kk.jc, kk.ck, kk.k);
        addWrong('ohne-jc', kk.ck + kk.k, 'Du hast ' + sym('Rth_JC') + ' vergessen. Auch der Wärmewiderstand Sperrschicht–Gehäuse gehört zur Reihenschaltung.');
        addWrong('ohne-ck', kk.jc + kk.k, 'Du hast ' + sym('Rth_CK') + ' vergessen. Der Übergang zwischen Gehäuse und Kühlkörper gehört zur Reihenschaltung.');
        addWrong('nur-k', kk.k, 'Das ist nur ' + sym('Rth_K') + '. Addiere noch ' + sym('Rth_JC') + ' und ' + sym('Rth_CK') + '.');
        addWrong('ja', kk.rthJA, 'Das ist ' + sym('Rth_JA') + ' des freistehenden Bauteils. Mit Kühlkörper gilt die Reihe ' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ' + ' + sym('Rth_K') + '.');
        lowHint = 'Prüfe: Alle drei Wärmewiderstände liegen in Reihe und werden addiert.'; highHint = lowHint;
        break;
      }
      case 'tj': case 'tc': case 'tk': {
        const kk = pickKette(), ta = pick([25, 40, 50]), p = pickP(kk, ta);
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, p: p, ta: ta };
        tables = tablesFor(kk);
        const name = { tj: 'die Sperrschichttemperatur', tc: 'die Gehäusetemperatur', tk: 'die Kühlkörpertemperatur' }[kind];
        q = montageText(kk) + ' Die Verlustleistung beträgt P = ' + num2(p) + ' W, die Umgebungstemperatur ' + num2(ta) + ' °C. Berechne ' + name + '. Die Werte stehen in den Tabellen.';
        const rth = kk.jc + kk.ck + kk.k;
        if (kind === 'tj') {
          ex(f('tj').fn(ta, p, rth), '°C', 0.02); steps = ex1('rthSum', kk.jc, kk.ck, kk.k).concat(ex1('tj', ta, p, rth));
          addWrong('ohne-ta', p * rth, 'Du hast ' + sym('Ta') + ' nicht addiert: P · ' + sym('Rth_ges') + ' = ' + fmt(p * rth) + ' K ist nur die Übertemperatur.');
          addWrong('ohne-jc', ta + p * (kk.ck + kk.k), 'Du hast ' + sym('Rth_JC') + ' vergessen: Die Sperrschicht liegt noch ' + fmt(p * kk.jc) + ' K über dem Gehäuse.');
          addWrong('ohne-ck', ta + p * (kk.jc + kk.k), 'Du hast ' + sym('Rth_CK') + ' vergessen: Der Übergang kostet ' + fmt(p * kk.ck) + ' K.');
          addWrong('ja', ta + p * kk.rthJA, 'Du hast ' + sym('Rth_JA') + ' benutzt. Das gilt nur ohne Kühlkörper; hier gilt die Reihe ' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ' + ' + sym('Rth_K') + '.');
          addWrong('nur-k', ta + p * kk.k, 'Das ist ' + sym('Tk') + ' (nur ' + sym('Rth_K') + ' gerechnet), nicht ' + sym('Tj') + '.');
          lowHint = 'Prüfe: ' + sym('Tj') + ' = ' + sym('Ta') + ' + P · ' + sym('Rth_ges') + '.'; highHint = lowHint;
        } else if (kind === 'tc') {
          ex(f('tc').fn(ta, p, kk.ck, kk.k), '°C', 0.02); steps = ex1('tc', ta, p, kk.ck, kk.k);
          addWrong('tj', ta + p * (kk.jc + kk.ck + kk.k), 'Das ist ' + sym('Tj') + ' (mit ' + sym('Rth_JC') + ' gerechnet). Das Gehäuse liegt um P · ' + sym('Rth_JC') + ' darunter.');
          addWrong('ohne-ta', p * (kk.ck + kk.k), 'Du hast ' + sym('Ta') + ' nicht addiert.');
          addWrong('nur-k', ta + p * kk.k, 'Das ist ' + sym('Tk') + '. Das Gehäuse liegt um P · ' + sym('Rth_CK') + ' darüber.');
          lowHint = 'Prüfe: ' + sym('Tc') + ' = ' + sym('Ta') + ' + P · (' + sym('Rth_CK') + ' + ' + sym('Rth_K') + ').'; highHint = lowHint;
        } else {
          ex(f('tk').fn(ta, p, kk.k), '°C', 0.02); steps = ex1('tk', ta, p, kk.k);
          addWrong('tc', ta + p * (kk.ck + kk.k), 'Das ist ' + sym('Tc') + '. Der Kühlkörper hat nur den Abfall über ' + sym('Rth_K') + '.');
          addWrong('ohne-ta', p * kk.k, 'Du hast ' + sym('Ta') + ' nicht addiert.');
          addWrong('tj', ta + p * (kk.jc + kk.ck + kk.k), 'Das ist ' + sym('Tj') + ', mit der ganzen Kette gerechnet. Für ' + sym('Tk') + ' zählt nur ' + sym('Rth_K') + '.');
          lowHint = 'Prüfe: ' + sym('Tk') + ' = ' + sym('Ta') + ' + P · ' + sym('Rth_K') + '.'; highHint = lowHint;
        }
        break;
      }
      case 'delta': {
        const kk = pickKette(), ta = 25, p = pickP(kk, ta), mem = pick(['JC', 'CK', 'K']);
        const rm = { JC: kk.jc, CK: kk.ck, K: kk.k }[mem], nm = { JC: 'Sperrschicht–Gehäuse', CK: 'Gehäuse–Kühlkörper', K: 'Kühlkörper–Umgebung' }[mem];
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, p: p, member: mem };
        tables = tablesFor(kk);
        q = montageText(kk) + ' Die Verlustleistung beträgt P = ' + num2(p) + ' W. Berechne den Temperaturabfall über dem Wärmewiderstand ' + nm + '.';
        ex(f('dT').fn(p, rm), 'K', 0.02); steps = ex1('dT', p, rm);
        addWrong('rth-ges', p * (kk.jc + kk.ck + kk.k), 'Das ist der Temperaturabfall über der ganzen Kette. Gefragt ist nur das eine Glied.');
        ['JC', 'CK', 'K'].forEach(function (m2) { if (m2 !== mem) addWrong('glied-' + m2, p * { JC: kk.jc, CK: kk.ck, K: kk.k }[m2], 'Du hast das falsche Glied gerechnet. Gefragt ist der Wärmewiderstand ' + nm + '.'); });
        addWrong('ohne-p', rm, 'Du hast nur den Wärmewiderstand abgeschrieben. Multipliziere mit der Verlustleistung: ΔT = P · Rth.');
        lowHint = 'Prüfe: ' + sym('dT') + ' = P · Rth des Gliedes.'; highHint = lowHint;
        break;
      }
      case 'pzul': {
        const kk = pickKette(), ta = pick([25, 40, 50]), rth = kk.jc + kk.ck + kk.k;
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, ta: ta };
        tables = tablesFor(kk);
        q = montageText(kk) + ' Die Umgebungstemperatur beträgt ' + num2(ta) + ' °C. Berechne die zulässige Verlustleistung, bei der die Sperrschicht gerade ' + sym('Tjmax') + ' erreicht.';
        ex(f('pzul').fn(kk.tjMax, ta, rth), 'W', 0.02); steps = ex1('rthSum', kk.jc, kk.ck, kk.k).concat(ex1('pzul', kk.tjMax, ta, rth));
        addWrong('ohne-ta', kk.tjMax / rth, 'Du hast ' + sym('Ta') + ' nicht abgezogen: Die Temperaturdifferenz ist ' + sym('Tjmax') + ' − ' + sym('Ta') + '.');
        addWrong('ja', (kk.tjMax - ta) / kk.rthJA, 'Du hast ' + sym('Rth_JA') + ' benutzt. Mit Kühlkörper gilt die Reihe ' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ' + ' + sym('Rth_K') + '.');
        addWrong('ohne-ck', (kk.tjMax - ta) / (kk.jc + kk.k), 'Du hast ' + sym('Rth_CK') + ' vergessen.');
        addWrong('ohne-jc', (kk.tjMax - ta) / (kk.ck + kk.k), 'Du hast ' + sym('Rth_JC') + ' vergessen.');
        lowHint = 'Prüfe: ' + sym('Pzul') + ' = (' + sym('Tjmax') + ' − ' + sym('Ta') + ') / ' + sym('Rth_ges') + '.'; highHint = lowHint;
        break;
      }
      case 'rthkerf': {
        let kk = null, ta = 25, p = 1, val = -1;
        for (let tries = 0; tries < 60; tries++) {
          kk = pickKette({ hs: ['m'] }); ta = pick([25, 40, 50]); p = pick([1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 10, 12]);
          val = f('rthKerf').fn(kk.tjMax, ta, p, kk.jc, kk.ck);
          if (val >= 0.5 && val <= 20) break;
        }
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, p: p, ta: ta };
        tables = [tabDevice(kk.d), tabJoint(kk.d, kk.joint, kk.paste)];
        q = montageText(kk).replace(' ist auf einen Kühlkörper montiert', ' soll auf einen noch zu wählenden Kühlkörper montiert werden') + ' Die Verlustleistung beträgt P = ' + num2(p) + ' W, die Umgebungstemperatur ' + num2(ta) + ' °C. Berechne den Wärmewiderstand ' + sym('Rth_K') + ', den der Kühlkörper höchstens haben darf.';
        ex(val, 'K/W', 0.02); steps = ex1('rthKerf', kk.tjMax, ta, p, kk.jc, kk.ck);
        const tot = (kk.tjMax - ta) / p;
        addWrong('rth-ges', tot, 'Das ist der größte Gesamt-Wärmewiderstand. Ziehe noch ' + sym('Rth_JC') + ' und ' + sym('Rth_CK') + ' ab.');
        addWrong('ohne-ta', kk.tjMax / p - kk.jc - kk.ck, 'Du hast ' + sym('Ta') + ' nicht abgezogen: Die Temperaturdifferenz ist ' + sym('Tjmax') + ' − ' + sym('Ta') + '.');
        addWrong('vorzeichen', (ta - kk.tjMax) / p - kk.jc - kk.ck, 'Das Vorzeichen stimmt nicht: Die Temperaturdifferenz ist ' + sym('Tjmax') + ' − ' + sym('Ta') + ', nicht umgekehrt.');
        addWrong('ohne-jc', tot - kk.ck, 'Du hast ' + sym('Rth_JC') + ' nicht abgezogen.');
        addWrong('ohne-ck', tot - kk.jc, 'Du hast ' + sym('Rth_CK') + ' nicht abgezogen.');
        lowHint = 'Prüfe: ' + sym('Rth_Kerf') + ' = (' + sym('Tjmax') + ' − ' + sym('Ta') + ') / P − ' + sym('Rth_JC') + ' − ' + sym('Rth_CK') + '.'; highHint = lowHint;
        break;
      }
      case 'tamax': {
        const kk = pickKette(), rth = kk.jc + kk.ck + kk.k;
        let p = pick([1, 1.5, 2, 2.5, 3]);
        for (let i = 0; i < 20 && kk.tjMax - p * rth < 30; i++) p = pick([0.5, 1, 1.5, 2, 2.5, 3]);
        if (kk.tjMax - p * rth < 30) p = 0.5;
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, p: p };
        tables = tablesFor(kk);
        q = montageText(kk) + ' Die Verlustleistung beträgt P = ' + num2(p) + ' W. Berechne die höchste Umgebungstemperatur, bei der die Sperrschicht gerade ' + sym('Tjmax') + ' erreicht.';
        ex(f('taMax').fn(kk.tjMax, p, rth), '°C', 0.02); steps = ex1('rthSum', kk.jc, kk.ck, kk.k).concat(ex1('taMax', kk.tjMax, p, rth));
        addWrong('plus', kk.tjMax + p * rth, 'Du hast addiert statt subtrahiert: Die Umgebung darf nur so warm sein, wie die Temperaturreserve ' + sym('Tjmax') + ' − P · ' + sym('Rth_ges') + ' es erlaubt.');
        addWrong('nur-dt', p * rth, 'Das ist nur die Übertemperatur P · ' + sym('Rth_ges') + '. Ziehe sie von ' + sym('Tjmax') + ' ab.');
        addWrong('ohne-ck', kk.tjMax - p * (kk.jc + kk.k), 'Du hast ' + sym('Rth_CK') + ' vergessen.');
        lowHint = 'Prüfe: ' + sym('Ta') + ',max = ' + sym('Tjmax') + ' − P · ' + sym('Rth_ges') + '.'; highHint = lowHint;
        break;
      }
      case 'kuehlerwahl': {
        let kk = null, ta = 40, p = 3, need = 0, chosen = null;
        for (let tries = 0; tries < 80; tries++) {
          kk = pickKette({ hs: ['m'], devs: ['7805', 'bd139', 'irlz34n'] }); ta = pick([25, 40, 50]); p = pick([1.5, 2, 2.5, 3, 3.5, 4, 5, 6]);
          need = f('rthKerf').fn(kk.tjMax, ta, p, kk.jc, kk.ck);
          const ids = ['s', 'm', 'l', 'xl'];
          chosen = null; for (let i = 0; i < ids.length; i++) if (hsById[ids[i]].rthK <= need) { chosen = ids[i]; break; }
          if (chosen && chosen !== 's') break;
          chosen = null;
        }
        if (!chosen) { need = 9; chosen = 'm'; }
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, p: p, ta: ta, chosen: chosen };
        tables = [tabDevice(kk.d), tabJoint(kk.d, kk.joint, kk.paste), tabHs(['s', 'm', 'l', 'xl'])];
        q = montageText(kk).replace(' ist auf einen Kühlkörper montiert', ' soll auf einen noch zu wählenden Kühlkörper montiert werden') + ' Die Verlustleistung beträgt P = ' + num2(p) + ' W, die Umgebungstemperatur ' + num2(ta) + ' °C. Berechne den erforderlichen Wärmewiderstand ' + sym('Rth_K') + ' und wähle aus der Tabelle den kleinsten Kühlkörper, der reicht. Gib seinen Wärmewiderstand in K/W an.';
        ex(hsById[chosen].rthK, 'K/W', 0.01); steps = ex1('rthKerf', kk.tjMax, ta, p, kk.jc, kk.ck).concat(['Gewählt: ' + hsById[chosen].name + ' mit ' + sym('Rth_K') + ' = ' + fmt(hsById[chosen].rthK) + ' K/W ≤ ' + fmt(need) + ' K/W']);
        const ids2 = ['s', 'm', 'l', 'xl'], pos2 = ids2.indexOf(chosen);
        if (pos2 > 0) { const sm = ids2[pos2 - 1], ss = steady({ device: kk.devId, heatsink: sm, joint: kk.joint, paste: kk.paste }, p, ta); addWrong('zu-klein', hsById[sm].rthK, 'Dieser Kühlkörper ist zu klein: Mit ihm wäre ' + sym('Tj') + ' = ' + fmt(ss.tj, 1) + ' °C und damit größer als ' + sym('Tjmax') + ' = ' + fmt(kk.tjMax) + ' °C.'); }
        if (pos2 < ids2.length - 1) addWrong('zu-gross', hsById[ids2[pos2 + 1]].rthK, 'Dieser Kühlkörper reicht, ist aber nicht der kleinste: Der nächstkleinere genügt auch.');
        addWrong('erforderlich', need, 'Das ist der erforderliche Wert, nicht der Wert eines Kühlkörpers aus der Tabelle. Wähle den kleinsten Kühlkörper mit ' + sym('Rth_K') + ' ≤ ' + fmt(need) + ' K/W.');
        lowHint = 'Prüfe: Der Wert des Kühlkörpers muss kleiner oder gleich ' + sym('Rth_Kerf') + ' sein; kleiner als nötig heißt größer als nötig (Rippen).'; highHint = 'Wähle den kleinsten Kühlkörper, dessen ' + sym('Rth_K') + ' höchstens ' + fmt(need) + ' K/W beträgt.';
        break;
      }
      case 'parallel': {
        const kk = pickKette({ devs: ['bd139'], hs: ['m', 'l'] }), n = pick([2, 3]), ta = pick([25, 40]), p1 = pick([1, 1.5, 1.8, 2]);
        given = { n: n, p: p1, ta: ta, device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId };
        tables = tablesFor(kk);
        q = 'Auf einem Kühlkörper sind ' + n + ' gleiche ' + kk.d.part + ' montiert (' + JNAME[kk.joint + '|' + kk.paste] + '). Jedes setzt P = ' + num2(p1) + ' W um. Die Umgebungstemperatur beträgt ' + num2(ta) + ' °C. Berechne die Sperrschichttemperatur eines Transistors.';
        const v = f('parallelKK').fn(n, p1, ta, kk.k, kk.jc, kk.ck); ex(v, '°C', 0.02); steps = ex1('parallelKK', n, p1, ta, kk.k, kk.jc, kk.ck);
        addWrong('einzeln', f('tj').fn(ta, p1, kk.jc + kk.ck + kk.k), 'Du hast nur ein Bauteil gerechnet. Der Kühlkörper trägt die Summe aller Verlustleistungen: ' + fmt(n * p1) + ' W.');
        addWrong('alles-n', ta + n * p1 * (kk.jc + kk.ck + kk.k), 'Du hast die ganze Kette mit n · P gerechnet. Nur ' + sym('Rth_K') + ' sieht die Summe, ' + sym('Rth_JC') + ' und ' + sym('Rth_CK') + ' sieht jedes Bauteil allein.');
        addWrong('ohne-ta', n * p1 * kk.k + p1 * (kk.jc + kk.ck), 'Du hast ' + sym('Ta') + ' nicht addiert.');
        lowHint = 'Prüfe: ' + sym('Tj') + ' = ' + sym('Ta') + ' + n · P · ' + sym('Rth_K') + ' + P · (' + sym('Rth_JC') + ' + ' + sym('Rth_CK') + ').'; highHint = lowHint;
        break;
      }
      case 'derating': {
        const kk = pickKette({ devs: ['bd139', 'irlz34n'], hs: ['m'] }), tcv = pick(kk.devId === 'bd139' ? [50, 75, 100, 125] : [50, 75, 100, 125, 150]);
        given = { device: kk.devId, joint: kk.joint, paste: kk.paste, heatsink: kk.hsId, tc: tcv };
        tables = [tabDevice(kk.d)];
        q = 'Das Bauteil ' + kk.d.part + ' wird so gekühlt, dass das Gehäuse ' + num2(tcv) + ' °C warm ist. Berechne die zulässige Verlustleistung (Derating nach dem Wärmewiderstand ' + sym('Rth_JC') + ').';
        ex(f('derate').fn(kk.tjMax, tcv, kk.jc), 'W', 0.02); steps = ex1('derate', kk.tjMax, tcv, kk.jc);
        addWrong('ja', (kk.tjMax - 25) / kk.rthJA, 'Du hast ' + sym('Rth_JA') + ' benutzt. Bei vorgegebener Gehäusetemperatur zählt nur ' + sym('Rth_JC') + '.');
        addWrong('ohne-tc', kk.tjMax / kk.jc, 'Du hast die Gehäusetemperatur nicht abgezogen: Die Temperaturdifferenz ist ' + sym('Tjmax') + ' − ' + sym('Tc') + '.');
        addWrong('bei-25', (kk.tjMax - 25) / kk.jc, 'Das ist der Wert bei 25 °C Gehäusetemperatur. Rechne mit der vorgegebenen Temperatur.');
        lowHint = 'Prüfe: ' + sym('Pzul') + ' = (' + sym('Tjmax') + ' − ' + sym('Tc') + ') / ' + sym('Rth_JC') + '.'; highHint = lowHint;
        break;
      }
      case 'eta': {
        const ue = pick([9, 12, 15, 18, 24]), ua = pick([3.3, 5, 9]), ueE = ue > ua ? ue : 24;
        given = { ue: ueE, ua: ua };
        q = 'Ein idealisierter Linearregler setzt ' + num2(ueE) + ' V auf ' + num2(ua) + ' V um (der Ruhestrom bleibt unberücksichtigt). Berechne den Wirkungsgrad in Prozent.';
        const v = f('etaLin').fn(ueE, ua) * 100; ex(v, '%', 0.02); steps = ex1('etaLin', ueE, ua);
        addWrong('faktor', v / 100, 'Das ist der Wirkungsgrad als Faktor. Gefragt sind Prozent: Multipliziere mit 100.');
        addWrong('kehrwert', ueE / ua * 100, 'Du hast den Kehrwert gerechnet. Der Wirkungsgrad ist Ausgangs- durch Eingangsspannung: Ua / Ue.');
        addWrong('verlust', (1 - ua / ueE) * 100, 'Das ist der Verlustanteil in Prozent. Der Wirkungsgrad ist Ua / Ue.');
        lowHint = 'Prüfe: η = Ua / Ue · 100 %.'; highHint = lowHint;
        break;
      }
      case 'pvsw': {
        const ua = pick([3.3, 5, 9, 12]), ia = pick([0.5, 1, 1.5, 2]), eta = pick([0.85, 0.9, 0.92]), pa = ua * ia;
        given = { ua: ua, ia: ia, eta: eta };
        q = 'Ein Schaltregler gibt Ua = ' + num2(ua) + ' V bei Ia = ' + num2(ia) + ' A ab. Sein Wirkungsgrad ist η = ' + num2(eta * 100) + ' % (Übungsannahme). Berechne die Verlustleistung des Schaltreglers.';
        ex(f('pvSw').fn(pa, eta), 'W', 0.02); steps = ex1('pvSw', pa, eta);
        addWrong('pa-1-eta', pa * (1 - eta), 'Du hast die Ausgangsleistung mit (1 − η) multipliziert. Der Verlust bezieht sich auf die Eingangsleistung: P_V = Pa · (1/η − 1).');
        addWrong('prozent', pa * (1 / (eta * 100) - 1), 'Du hast η in Prozent eingesetzt. Rechne mit dem Faktor (' + fmt(eta) + ').');
        addWrong('eingang', pa / eta, 'Das ist die Eingangsleistung. Ziehe noch die Ausgangsleistung ab.');
        lowHint = 'Prüfe: P_V = Pa · (1/η − 1).'; highHint = lowHint;
        break;
      }
      case 'tau': case 'tpct': {
        const rth = pick([3.5, 8, 15, 25]), hid = rth === 3.5 ? 'l' : rth === 8 ? 'm' : rth === 15 ? 's' : 'fahne', cth = hsById[hid].cthK, tau = f('tau').fn(rth, cth);
        const inMin = R.next() < 0.5;
        given = { rth: rth, cth: cth, heatsink: hid };
        if (kind === 'tau') {
          q = 'Ein Kühlkörper hat den Wärmewiderstand ' + sym('Rth_K') + ' = ' + num2(rth) + ' K/W und die Wärmekapazität ' + sym('Cth') + ' = ' + num2(cth) + ' J/K. Berechne die Zeitkonstante in ' + (inMin ? 'Minuten' : 'Sekunden') + '.';
          ex(inMin ? tau / 60 : tau, inMin ? 'min' : 's', 0.02); steps = ex1('tau', rth, cth);
          addWrong('einheit', inMin ? tau : tau / 60, inMin ? 'Das ist die Zeitkonstante in Sekunden. Gefragt sind Minuten: Teile durch 60.' : 'Das ist die Zeitkonstante in Minuten. Gefragt sind Sekunden: Multipliziere mit 60.');
          addWrong('summe', (rth + cth) * (inMin ? 1 / 60 : 1), 'Du hast addiert statt multipliziert: ' + sym('tau') + ' = Rth · ' + sym('Cth') + '.');
          lowHint = 'Prüfe: ' + sym('tau') + ' = Rth · ' + sym('Cth') + (inMin ? ' in s, dann durch 60.' : '.'); highHint = lowHint;
        } else {
          const pct = pick([63, 90, 95]);
          given.pct = pct;
          q = 'Ein Kühlkörper hat die Zeitkonstante ' + sym('tau') + ' = ' + num2(tau) + ' s. Nach wie vielen ' + (inMin ? 'Minuten' : 'Sekunden') + ' hat er ' + num2(pct) + ' % seiner Endtemperatur erreicht? Die Aufheizkurve ist ein PT1-Verlauf.';
          const ts = f('tPct').fn(tau, pct);
          ex(inMin ? ts / 60 : ts, inMin ? 'min' : 's', 0.05); steps = ex1('tPct', tau, pct);
          addWrong('einheit', inMin ? ts : ts / 60, inMin ? 'Das ist die Zeit in Sekunden. Gefragt sind Minuten: Teile durch 60.' : 'Das ist die Zeit in Minuten. Gefragt sind Sekunden: Multipliziere mit 60.');
          addWrong('tau', inMin ? tau / 60 : tau, 'Das ist die Zeitkonstante selbst (63 %). Für ' + fmt(pct) + ' % gilt t = −' + sym('tau') + ' · ln(1 − ' + fmt(pct / 100) + ').');
          lowHint = 'Prüfe: t = −' + sym('tau') + ' · ln(1 − x).'; highHint = lowHint;
        }
        break;
      }
      case 'mosfet': {
        const i = pick([5, 8, 10, 12, 15]), d = pick([1, 0.5, 0.75]), u = pick([12, 24]), fq = d === 1 ? 0 : pick([1000, 20000]);
        const r = DEV.irlz34n.rdsTyp['5'], trf = DEV.irlz34n.tr + DEV.irlz34n.tf;
        given = { i: i, d: d, u: u, f: fq, rds: r };
        const v = f('pMosfet').fn(i, d, r, u, fq, trf);
        q = 'Ein MOSFET TF-IRLZ34N schaltet ' + num2(i) + ' A bei ' + num2(u) + ' V und der Einschaltdauer D = ' + num2(d) + (fq > 0 ? ' mit f = ' + num2(fq) + ' Hz' : ' (Dauerbetrieb)') + '. RDS(on) beträgt bei 25 °C und 5 V Gate ' + num2(r * 1000) + ' mΩ, die Schaltzeiten zusammen ' + num2(trf * 1e9) + ' ns. Berechne die gesamte Verlustleistung (RDS(on) bei 25 °C, Leit- und Schaltverluste).';
        ex(v, 'W', 0.02); steps = ex1('pMosfet', i, d, r, u, fq, trf);
        addWrong('ohne-d', i * i * r + (fq > 0 ? 0.5 * u * i * trf * fq : 0), 'Du hast die Einschaltdauer D nicht berücksichtigt: Der Leitverlust ist D · I² · RDS(on).');
        addWrong('ohne-sw', d * i * i * r, 'Du hast die Schaltverluste vergessen: ½ · U · I · (tr + tf) · f.');
        addWrong('heiss', d * i * i * r * 1.65 + (fq > 0 ? 0.5 * u * i * trf * fq : 0), 'Du hast RDS(on) mit dem Heißwert gerechnet. In dieser Aufgabe gilt der Wert bei 25 °C.');
        addWrong('ohne-quadrat', d * i * r + (fq > 0 ? 0.5 * u * i * trf * fq : 0), 'Der Strom geht quadratisch ein: I².');
        lowHint = 'Prüfe: P = D · I² · RDS(on) + ½ · U · I · (tr + tf) · f.'; highHint = lowHint;
        break;
      }
      case 'diode': {
        const i = pick([0.5, 1, 1.5, 2]), ff = pick([[1, 'Gleichstrom'], [PI / 2, 'Sinus-Halbwellen'], [3, 'Ladeelko-Impulse']]), u0 = DEV['1n4007'].u0, rf = DEV['1n4007'].rF;
        given = { i: i, ff: ff[0], u0: u0, rf: rf };
        q = 'Die Diode TF-1N4007 führt den Mittelwert I = ' + num2(i) + ' A (Stromform: ' + ff[1] + ', Formfaktor FF = ' + num2(ff[0]) + '). Die Diode hat die Schleusenspannung U0 = ' + num2(u0) + ' V und den Bahnwiderstand rF = ' + num2(rf) + ' Ω. Berechne die Verlustleistung P = U0 · I + rF · (FF · I)².';
        const v = f('diodeFF').fn(i, ff[0], u0, rf); ex(v, 'W', 0.02); steps = ex1('diodeFF', i, ff[0], u0, rf);
        addWrong('ohne-ff', f('diodeFF').fn(i, 1, u0, rf), 'Du hast den Formfaktor vergessen: Der Effektivwert ist FF · I, er geht quadratisch in den Bahnwiderstand-Anteil ein.');
        addWrong('nur-u0', u0 * i, 'Das ist nur der Anteil der Schleusenspannung. Addiere rF · (FF · I)².');
        addWrong('ff-linear', u0 * i + rf * ff[0] * i, 'Der Effektivwert FF · I geht quadratisch ein: rF · (FF · I)².');
        lowHint = 'Prüfe: P = U0 · I + rF · (FF · I)².'; highHint = lowHint;
        break;
      }
      case 'widerstand': {
        const u = pick([12, 18, 24, 30]), pn = pick([2, 5, 10]);
        given = { u: u, pn: pn };
        q = 'An einem Widerstand liegt dauernd U = ' + num2(u) + ' V. Er ist für P_nenn = ' + num2(pn) + ' W ausgelegt, soll aber höchstens mit der halben Nennleistung laufen. Welchen kleinsten Widerstandswert aus der Reihe E12 darfst du einbauen? Gib den Wert in Ω an.';
        const exact = 2 * u * u / pn, v = eSeries('E12', exact, 'up');
        ex(v, 'Ω', 0.005); steps = ex1('widerstandNenn', u, pn, 2);
        addWrong('nicht-gerundet', exact, 'Das ist der berechnete Mindestwert. Runde auf den nächsten größeren Wert der Reihe E12.');
        const down = eSeries('E12', exact, 'down');
        if (down !== v) addWrong('abgerundet', down, 'Dieser Wert ist kleiner als der Mindestwert: Der Widerstand würde mit ' + fmt(u * u / down) + ' W mehr als die halbe Nennleistung (' + fmt(pn / 2) + ' W) umsetzen. Runde nach oben.');
        addWrong('ohne-reserve', eSeries('E12', u * u / pn, 'up'), 'Du hast die Reserve vergessen: Bei halber Nennleistung gilt R ≥ 2 · U² / P_nenn.');
        lowHint = 'Prüfe: R ≥ 2 · U² / P_nenn, dann auf E12 aufrunden.'; highHint = 'Prüfe: Du sollst den kleinsten E12-Wert nehmen, der noch reicht.';
        break;
      }
      case 'led': {
        const n = pick([1, 2, 3, 4]), uf = DEV.led3w.uf, ii = pick([0.35, 0.5, 0.7, 1]), eta = DEV.led3w.etaTh;
        given = { n: n, uf: uf, i: ii, etaTh: eta };
        q = 'Eine Power-LED-Kette hat n = ' + n + ' LED in Reihe mit je UF = ' + num2(uf) + ' V bei I = ' + num2(ii) + ' A. ' + num2(eta * 100) + ' % der elektrischen Leistung werden zu Wärme (Übungswert). Berechne die Wärmeleistung der LED-Kette.';
        const v = power.led({ n: n, uf: uf, i: ii, etaTh: eta }).p; ex(v, 'W', 0.02); steps = power.led({ n: n, uf: uf, i: ii, etaTh: eta }).steps;
        addWrong('elektrisch', n * uf * ii, 'Das ist die gesamte elektrische Leistung. Nur ' + fmt(eta * 100) + ' % davon werden zu Wärme.');
        addWrong('ohne-n', eta * uf * ii, 'Du hast die Zahl der LED nicht berücksichtigt: Die Spannungen addieren sich bei Reihenschaltung.');
        addWrong('rest', (1 - eta) * n * uf * ii, 'Das ist der Lichtanteil. Gefragt ist der Wärmeanteil von ' + fmt(eta * 100) + ' %.');
        lowHint = 'Prüfe: P_th = η_th · n · UF · I.'; highHint = lowHint;
        break;
      }
      case 'endstufe': {
        const ub = pick([12, 15, 18, 24, 30]), rl = pick([4, 8, 16]);
        given = { ub: ub, rl: rl };
        q = 'Eine Gegentakt-B-Endstufe mit Ub = ' + num2(ub) + ' V treibt eine Last von RL = ' + num2(rl) + ' Ω. Berechne die größte Verlustleistung je Endstufentransistor (sie tritt bei der Aussteuerung Û = 2·Ub/π auf).';
        const v = f('endstufe').fn(ub, rl); ex(v, 'W', 0.02); steps = ex1('endstufe', ub, rl);
        addWrong('ohne-pi', ub * ub / rl, 'Das wäre die Leistung bei Gleichspannung Ub am Lastwiderstand. Die Verlustleistung je Transistor ist Ub² / (π² · RL).');
        addWrong('beide', 2 * v, 'Das ist die Verlustleistung beider Transistoren zusammen. Gefragt ist ein Transistor.');
        addWrong('pi', ub * ub / (PI * rl), 'Du hast nur ein π im Nenner. Es muss π² sein: Ub² / (π² · RL).');
        lowHint = 'Prüfe: P_max = Ub² / (π² · RL).'; highHint = lowHint;
        break;
      }
      case 'impuls': {
        const hsId = pick(['m', 'l']), ppk = pick([50, 100, 200]), tp = pick([0.001, 0.01]), per = tp * pick([10, 100]);
        const cfg = { device: 'irlz34n', heatsink: hsId, joint: 'direkt', paste: 'duenn' }, ta = pick([25, 40]);
        const rth = chain(cfg).rthTotal, zv = zth(cfg, [tp, per, tp + per]).map(function (x) { return Number(x.toPrecision(4)); });
        given = { ppk: ppk, tp: tp, T: per, ta: ta, device: 'irlz34n', heatsink: hsId, z: zv, rth: rth };
        tables = [{ caption: 'Thermische Impedanz Zth des Aufbaus', head: ['Zeit', 'Zth'], rows: [[fmt(tp) + ' s', fmt(zv[0]) + ' K/W'], [fmt(per) + ' s', fmt(zv[1]) + ' K/W'], [fmt(tp + per) + ' s', fmt(zv[2]) + ' K/W']] }, { caption: 'Dauerbetrieb', head: ['Größe', 'Wert'], rows: [[sym('Rth_ges'), fmt(rth) + ' K/W']] }];
        q = 'Ein Bauteil am Kühlkörper bekommt Leistungsimpulse von P_pk = ' + num2(ppk) + ' W, Dauer tp = ' + num2(tp) + ' s, Periode T = ' + num2(per) + ' s. Die Umgebungstemperatur beträgt ' + num2(ta) + ' °C. Berechne die Spitzen-Sperrschichttemperatur mit Tj = Ta + P_pk · [D · Rth_ges + (1 − D) · Zth(tp + T) − Zth(T) + Zth(tp)]. Die Zth-Werte stehen in der Tabelle.';
        const D = tp / per, v = ta + ppk * (D * rth + (1 - D) * zv[2] - zv[1] + zv[0]);
        ex(v, '°C', 0.03);
        steps = ['D = tp / T = ' + fmt(tp) + ' s / ' + fmt(per) + ' s = ' + fmt(D), sym('Tj') + ' = ' + fmt(ta) + ' °C + ' + fmt(ppk) + ' W · [' + fmt(D) + ' · ' + fmt(rth) + ' K/W + ' + fmt(1 - D) + ' · ' + fmt(zv[2]) + ' K/W − ' + fmt(zv[1]) + ' K/W + ' + fmt(zv[0]) + ' K/W] = ' + fmt(v) + ' °C'];
        addWrong('dauer', ta + ppk * rth, 'Das ist die Temperatur bei Dauerbetrieb mit P_pk. Bei Impulsen liegt die Spitze darunter, weil der Kühlkörper zwischen den Impulsen abkühlt.');
        addWrong('nur-zth', ta + ppk * zv[0], 'Du hast nur Zth(tp) benutzt. Dazu kommt der Beitrag der vorherigen Impulse: D · Rth_ges, (1 − D) · Zth(tp + T) und − Zth(T).');
        addWrong('mittel', ta + ppk * D * rth, 'Das ist die Temperatur bei der mittleren Leistung. Die Spitze liegt darüber.');
        lowHint = 'Prüfe: Du brauchst D, Rth_ges und die drei Zth-Werte aus der Tabelle.'; highHint = lowHint;
        break;
      }
      case 'schicht': {
        const mat = pick(['luft', 'glimmer', 'silikon', 'paste']), dmm = mat === 'luft' ? pick([0.02, 0.05, 0.1]) : pick([0.03, 0.05, 0.1, 0.2]), a = pick([1, 1.5, 2, 4]);
        const lam = materials[mat].lambda;
        given = { material: mat, d: dmm, lambda: lam, a: a };
        q = 'Eine Schicht aus ' + { luft: 'Luft', glimmer: 'Glimmer', silikon: 'Silikonfolie', paste: 'Wärmeleitpaste' }[mat] + ' (Wärmeleitfähigkeit λ = ' + num2(lam) + ' W/(m·K)) ist d = ' + num2(dmm) + ' mm dick und hat die Fläche A = ' + num2(a) + ' cm². Berechne ihren Wärmewiderstand in K/W (Rth = d / (λ · A)).';
        const v = f('rthLayer').fn(dmm, lam, a); ex(v, 'K/W', 0.02); steps = ex1('rthLayer', dmm, lam, a);
        addWrong('einheiten', dmm / (lam * a), 'Du hast mm und cm² direkt eingesetzt. Rechne in m und m²: d = ' + fmt(dmm * 1e-3) + ' m, A = ' + fmt(a * 1e-4) + ' m².');
        addWrong('ohne-a', dmm * 1e-3 / lam, 'Du hast die Fläche vergessen: Rth = d / (λ · A).');
        addWrong('kehrwert', lam * a * 1e-4 / (dmm * 1e-3), 'Das ist der Kehrwert (der Wärmeleitwert). Der Wärmewiderstand ist d / (λ · A).');
        lowHint = 'Prüfe: Rth = d / (λ · A) mit d in m und A in m².'; highHint = lowHint;
        break;
      }
    }
    const value = ans.value, tol = ans.tol, alts = ans.alt, unit = ans.unit;
    function uText(u) { return u ? ' ' + u : ''; }
    function hintFor(v) {
      for (let i = 0; i < wrongs.length; i++) if (Math.abs(v - wrongs[i].v) <= tol * Math.abs(wrongs[i].v) + 1e-9) return wrongs[i];
      return null;
    }
    function diag(input) {
      const v = parseNum(input);
      if (!isFinite(v)) return { ok: false, id: 'keine-zahl', hint: TXT.keineZahl };
      const cands = [value].concat(alts);
      for (let i = 0; i < cands.length; i++) if (Math.abs(v - cands[i]) <= tol * Math.abs(cands[i]) + 1e-12) return { ok: true, id: i === 0 ? 'richtig' : 'alt', hint: '' };
      const w = hintFor(v);
      if (w) return { ok: false, id: w.id, hint: w.text };
      return { ok: false, id: v < value ? 'zu-klein' : 'zu-gross', hint: v < value ? lowHint : highHint };
    }
    function check(input) {
      try {
        const v = parseNum(input);
        if (!isFinite(v)) return { ok: false, text: TXT.keineZahl };
        const d = diag(input);
        if (d.ok) return { ok: true, text: 'Richtig: ' + fmt(value) + uText(unit) + '.' + (alts.length ? ' Auch ' + alts.map(function (a) { return fmt(a); }).join(' oder ') + uText(unit) + ' gilt als richtig (mit und ohne Ruhestrom, Tabellenbuch-Rundung).' : '') };
        const lo = value * (1 - tol), hi = value * (1 + tol), bl = Math.min(lo, hi), bh = Math.max(lo, hi);
        const small = v < bl;
        const text = small ? 'Dein Wert ist zu klein (' + fmt(v) + ' < ' + fmt(bl) + ').' : 'Dein Wert ist zu groß (' + fmt(v) + ' > ' + fmt(bh) + ').';
        return { ok: false, text: text + (d.hint ? ' ' + d.hint : '') };
      } catch (e) { return { ok: false, text: TXT.keineZahl }; }
    }
    const res = { ok: true, kind: kind, seed: sd, question: q, given: given, table: tables, answer: ans, steps: steps, check: check, diagnose: diag };
    hide(res, 'wrongs', wrongs);
    return res;
  }
  exercise.kinds = EX_KINDS.slice();
  /* diagnoseAnswer(kind, input, ctx): ctx = Uebung (von exercise) oder { seed }. Liefert { ok, id, hint }: hint nur aus einem tatsaechlich gerechneten Fehlerbild */
  function diagnoseAnswer(kind, input, ctx) {
    let ex = null;
    if (isObj(ctx) && typeof ctx.diagnose === 'function') ex = ctx;
    else ex = exercise(kind, isObj(ctx) ? ctx.seed : ctx);
    if (!ex || !ex.ok) return fail('Unbekannte Übungsart.', { id: 'unbekannt', hint: '' });
    return ex.diagnose(input);
  }

  /* =====================================================================================================
   *  M3: ANPASSUNG EINER AUFHEIZKURVE (fitTau) UND LAEUFER (runSeq)
   * ===================================================================================================== */
  /* fitTau(ts, ys, yInf): y(t) = yInf - (yInf - y0) * exp(-t/tau); lineare Regression von ln|yInf - y| ueber t im Bereich 10 % ... 90 % des Anstiegs.
   * Ohne yInf gilt der letzte Wert. NaN, wenn der Anstieg zu klein ist oder weniger als drei Punkte im Bereich liegen. */
  function fitTau(ts, ys, yInf) {
    if (!isArr(ts) || !isArr(ys) || ts.length !== ys.length || ts.length < 4) return NaN;
    for (let i = 0; i < ts.length; i++) if (!fin(ts[i]) || !fin(ys[i])) return NaN;
    const y0 = ys[0], yi = isFinite(num(yInf, NaN)) ? num(yInf, NaN) : ys[ys.length - 1], span = yi - y0;
    if (!(Math.abs(span) > 1e-6)) return NaN;
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < ts.length; i++) {
      const fr = (ys[i] - y0) / span;
      if (fr >= 0.1 && fr <= 0.9) {
        const x = ts[i] - ts[0], z = Math.log(Math.abs(yi - ys[i]));
        n++; sx += x; sy += z; sxx += x * x; sxy += x * z;
      }
    }
    if (n < 3) return NaN;
    const den = n * sxx - sx * sx;
    if (!(Math.abs(den) > 1e-300)) return NaN;
    const m = (n * sxy - sx * sy) / den;
    return m < 0 ? -1 / m : NaN;
  }
  function snapObj(o) {
    if (!o || typeof o !== 'object') return o;
    const c = {};
    for (const k of Object.keys(o)) { const v = o[k]; c[k] = isArr(v) ? v.slice() : v; }
    return c;
  }
  function collectKeys(list, set) {
    if (!isArr(list)) return;
    list.forEach(function (e) {
      if (typeof e === 'string') set[e] = 1;
      else if (e && typeof e === 'object') { if (typeof e.key === 'string') set[e.key] = 1; if (isArr(e.controls)) collectKeys(e.controls, set); }
    });
  }
  /* runSeq(rigFactory | rigId | rig, seq, tEndS, opts): seq = [{ t:s, set:{key:value} }, { t:s, ramp:{ key, to, durS } }] in Prozess-Sekunden.
   *   opts = { controls, settle (Standard true: stationaerer Anfangszustand), sampleS, seed }.
   *   Ergebnis { ok, samples:[{ t, tj, tc, tk, ta, p, meters, state }], final, events, faults, metrics:{ tjMax, tjFinal, tjSteady, t63, t90, shutCount, tauFit }, errors, rejected } */
  function runSeq(rigIn, seq, tEndS, opts) {
    opts = isObj(opts) ? opts : {};
    const out = { ok: true, samples: [], final: null, events: [], faults: [], metrics: {}, errors: [], rejected: [] };
    let rig = null;
    try {
      const seedOpt = isFinite(num(opts.seed, NaN)) ? num(opts.seed, 1) : undefined;
      if (typeof rigIn === 'function') rig = rigIn(seedOpt);
      else if (typeof rigIn === 'string') {
        const Rr = root.THM_RIGS;
        if (Rr && typeof Rr.create === 'function' && Rr.defs && Rr.defs[rigIn]) rig = Rr.create(rigIn, Object.assign({}, opts.rigOpts || {}, seedOpt !== undefined ? { seed: seedOpt } : {}));
        else out.errors.push(Rr && Rr.create ? 'Den Prüfstand „' + rigIn + '“ gibt es nicht.' : 'THM_RIGS ist nicht geladen.');
      } else if (rigIn && typeof rigIn === 'object' && (typeof rigIn.stepProcess === 'function' || typeof rigIn.step === 'function')) {
        rig = rigIn; if (opts.reset !== false && typeof rig.reset === 'function') rig.reset();
      }
    } catch (e) { out.errors.push('Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); }
    if (!rig) { if (!out.errors.length) out.errors.push('Kein Prüfstand angegeben.'); out.ok = false; return out; }
    const h = pos(rig.h, K.H);
    const tEnd = clamp(num(tEndS, 0), 0, Math.min(1e7, 5e6 * h));
    const sampleS = Math.max(h, pos(opts.sampleS, tEnd / 2000));
    const known = {}; collectKeys(rig.controls, known);
    const knownOn = Object.keys(known).length > 0;
    const faultSet = {};
    function setCtl(key, v, tNow) {
      if (typeof key !== 'string') return;
      if (knownOn && !known[key]) { out.errors.push('Schlüssel „' + key + '“ gibt es an dieser Anlage nicht.'); return; }
      let r;
      try { r = rig.setControl(key, v); } catch (e) { out.errors.push('setControl(' + key + '): ' + (e && e.message)); return; }
      if (r === false) out.rejected.push({ key: key, value: v, t: tNow });
    }
    function collect(s) { if (s && isArr(s.faults)) s.faults.forEach(function (fl) { if (!faultSet[fl]) { faultSet[fl] = 1; out.faults.push(fl); } }); }
    if (opts.controls && typeof opts.controls === 'object') Object.keys(opts.controls).forEach(function (k) { setCtl(k, opts.controls[k], 0); });
    const q = [];
    (isArr(seq) ? seq : []).forEach(function (e, k) {
      if (e && typeof e === 'object' && isFinite(num(e.t, NaN))) q.push({ t: Math.max(0, num(e.t, 0)), set: e.set && typeof e.set === 'object' ? e.set : null, ramp: e.ramp && typeof e.ramp === 'object' ? e.ramp : null, k: k });
    });
    q.sort(function (a, b) { return a.t - b.t || a.k - b.k; });
    // Einstellungen bei t = 0 gehoeren zum Anfangszustand: vor dem Beharrungszustand setzen
    let qi = 0;
    while (qi < q.length && q[qi].t <= 1e-9 && !q[qi].ramp) { const e0 = q[qi++]; if (e0.set) Object.keys(e0.set).forEach(function (k) { setCtl(k, e0.set[k], 0); }); }
    if (opts.settle !== false && typeof rig.settle === 'function') { try { rig.settle(); } catch (e) { out.errors.push('settle(): ' + (e && e.message)); } }
    const ramps = [];
    let t = 0, nextSample = 0;
    function advance(dt) { if (typeof rig.stepProcess === 'function') rig.stepProcess(dt); else rig.step(dt * 1000 / pos(rig.timeScale, K.TIMESCALE)); }
    function takeSample() {
      let st = null, m = null;
      try { st = rig.state(); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
      try { m = typeof rig.readMeters === 'function' ? rig.readMeters() : null; } catch (e) { out.errors.push('readMeters(): ' + (e && e.message)); }
      const s = st || {};
      out.samples.push({ t: t, tj: s.tj, tc: s.tc, tk: s.tk, ta: s.ta, p: s.pv, meters: snapObj(m), state: snapObj(st) });
      collect(st);
    }
    for (let guard = 0; guard < 6000000; guard++) {
      while (qi < q.length && q[qi].t <= t + 1e-9) {
        const e = q[qi++];
        if (e.set) Object.keys(e.set).forEach(function (k) { setCtl(k, e.set[k], t); });
        if (e.ramp && typeof e.ramp.key === 'string') {
          let from = NaN;
          try { from = typeof rig.getControl === 'function' ? num(rig.getControl(e.ramp.key), NaN) : NaN; } catch (er) { /* */ }
          const to = num(e.ramp.to, NaN), dur = num(e.ramp.durS, 0);
          if (!isFinite(to)) out.errors.push('Rampe für „' + e.ramp.key + '“ hat keinen Zielwert.');
          else if (!(dur > 0) || !isFinite(from)) setCtl(e.ramp.key, to, t);
          else ramps.push({ key: e.ramp.key, from: from, to: to, t0: t, dur: dur });
        }
      }
      for (let i = ramps.length - 1; i >= 0; i--) {
        const r = ramps[i], fr = clamp((t - r.t0) / r.dur, 0, 1);
        setCtl(r.key, r.from + (r.to - r.from) * fr);
        if (fr >= 1) ramps.splice(i, 1);
      }
      if (t >= nextSample - 1e-9) { takeSample(); nextSample += sampleS; }
      if (t >= tEnd - 1e-9) break;
      let tn = Math.min(nextSample, tEnd);
      if (qi < q.length) tn = Math.min(tn, q[qi].t);
      if (ramps.length) { let rd = Infinity; ramps.forEach(function (r) { rd = Math.min(rd, r.dur / 200); }); tn = Math.min(tn, t + Math.max(h, rd)); }
      let dt = tn - t;
      if (!(dt > 1e-12)) dt = h;
      try { advance(dt); } catch (e) { out.errors.push('step(): ' + (e && e.message)); break; }
      t += dt;
    }
    try { out.final = snapObj(rig.state()); collect(out.final); } catch (e) { out.errors.push('state(): ' + (e && e.message)); }
    try { out.events = isArr(rig.events) ? rig.events.map(snapObj) : []; } catch (e) { /* */ }
    // Kenngroessen
    const ts = [], tjs = [];
    out.samples.forEach(function (s) { if (fin(s.tj)) { ts.push(s.t); tjs.push(s.tj); } });
    const m = out.metrics;
    m.tjMax = tjs.length ? Math.max.apply(null, tjs) : NaN;
    m.tjFinal = tjs.length ? tjs[tjs.length - 1] : NaN;
    m.shutCount = out.final && fin(out.final.shutCount) ? out.final.shutCount : 0;
    let tjSteady = NaN;
    try { if (typeof rig.steady === 'function') { const sd = rig.steady(); if (sd && fin(sd.tj)) tjSteady = sd.tj; } } catch (e) { /* */ }
    m.tjSteady = fin(tjSteady) ? tjSteady : m.tjFinal;
    m.t63 = NaN; m.t90 = NaN; m.tauFit = NaN;
    if (tjs.length >= 4) {
      const y0 = tjs[0], yi = m.tjSteady, span = yi - y0;
      if (Math.abs(span) > 0.5) {
        const cross = function (frac) {
          for (let i = 1; i < tjs.length; i++) {
            const f1 = (tjs[i] - y0) / span;
            if (f1 >= frac) { const f0 = (tjs[i - 1] - y0) / span; return ts[i - 1] + (ts[i] - ts[i - 1]) * (f1 === f0 ? 0 : (frac - f0) / (f1 - f0)); }
          }
          return NaN;
        };
        m.t63 = cross(1 - Math.exp(-1)); m.t90 = cross(0.9);
        m.tauFit = fitTau(ts, tjs, yi);
      }
    }
    return out;
  }

  /* =====================================================================================================
   *  EXPORT
   * ===================================================================================================== */
  api.version = '1.0';
  api.const = K;
  api.rng = S(rng);
  api.glossary = glossary;
  api.sym = function (k, s) { try { return sym(k, s); } catch (e) { return ''; } };
  api.symSet = function (s) { try { return symSet(s); } catch (e) { return 'db'; } };
  api.tpl = function (t, s) { try { return tpl(t, s); } catch (e) { return ''; } };
  api.fill = function (t, v, s) { try { return fill(t, v, s); } catch (e) { return ''; } };
  api.analogie = analogie;
  api.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  api.parseNum = C(parseNum);
  api.eSeries = C(eSeries);
  api.packages = packages;
  api.mount = mount;
  api.fan = fan; api.orient = orient;
  api.heatsinks = heatsinks;
  api.materials = materials;
  api.rthLayer = C(rthLayer); api.rthLayerMM = C(rthLayerMM);
  api.devices = devices;
  api.shutdownStep = function (p, t, id) { try { return shutdownStep(p, t, id); } catch (e) { return false; } };
  api.shutdownSense = C(shutdownSense); api.tempRange = S(tempRange);
  api.power = power;
  api.chain = S(chain); api.steady = S(steady);
  api.pzul = C(pzul); api.rthKerf = S(rthKerf); api.taMax = C(taMax);
  api.chooseHeatsink = S(chooseHeatsink);
  api.heatCapacity = C(heatCapacity); api.tauOf = C(tauOf); api.tFraction = C(tFraction);
  api.formulas = formulas;
  api.mountControls = function (set) { try { return mountControls(set); } catch (e) { return []; } };
  api.mountPresets = mountPresets;
  api.cfgFromControls = S(cfgFromControls);
  api.blech = S(blechOf);
  api.TXT = TXT;
  api.heatsink = heatsink;
  api.derating = S(derating); api.derating.overTa = S(deratingOverTa);
  api.parallelDevices = S(parallelDevices);
  api.coupled = { mosfet: S(coupledMosfet), runaway: S(coupledRunaway) };
  api.efficiency = { linear: C(etaLinear), switching: S(pSwitching), compare: S(etaCompare) };
  api.thermal = S(thermal); api.thermal.stepResponse = S(stepResponse);
  api.zth = function (cfg, t) { try { return zth(cfg, t); } catch (e) { return []; } };
  api.pulseTj = S(pulseTj);
  api.tauApprox = C(tauApprox);
  api.recipe = S(recipe);
  api.exercise = S(exercise); api.exercise.kinds = EX_KINDS.slice();
  api.diagnoseAnswer = S(diagnoseAnswer);
  api.diagnose = function (c) { try { return diagnose(c); } catch (e) { return []; } };
  api.TEXTS = TEXTS;
  api.runSeq = S(runSeq);
  api.fitTau = C(fitTau);
  root.THM_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
