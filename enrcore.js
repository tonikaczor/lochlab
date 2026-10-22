/* enrcore.js - Energie-/Solar-Lab Kern Teil 1 (ENR_CORE, Version 1.0): Basis, Solarzelle/Modul/Feld, Verschattung, Sonne und Wetter
 * Reine Rechnung, keine DOM-Zugriffe. Browser: window.ENR_CORE, Node: module.exports / globalThis.ENR_CORE. Vanilla-JS, kein eval.
 * Die Dateien enrsys.js und enrcalc.js erweitern DENSELBEN Namensraum (const C = root.ENR_CORE = root.ENR_CORE || {}).
 *
 * ===================================================================================================
 * ALLGEMEINES
 *  - Einheiten: Spannung V, Strom A, Leistung W, Einstrahlung W/m2, Temperatur Grad C, Winkel Grad, Zeit Sonnenzeit in Stunden.
 *  - Vorzeichen: Modul/Feld Strom positiv = Erzeugung (Erzeugerzaehlpfeil, Strom aus dem Modul heraus).
 *  - GUARD: Alle oeffentlichen Funktionen sind gekapselt. Unsinnseingaben (null, undefined, NaN, Infinity, Strings, Objekte ohne Felder,
 *    negative oder riesige Zahlen) werfen NIE. Rechenfunktionen liefern NaN, Struktur-Funktionen { ok:false, why:'deutscher Text' }.
 *  - Determinismus: Zufall nur ueber rng(seed) (mulberry32). Kein Math.random, keine Datumsabfrage.
 *  - Rechenwerte werden nicht gerundet, nur die Anzeige (fmt).
 *
 * ===================================================================================================
 * MEILENSTEINE
 *  M1: Basis (K, rng, fmt, parseNum, glossary, TEXTS, guard, util), pv.presets/spec/cond/cellPar/current/voltage/keys/curve/tempCoeff/datasheet/
 *      cellTemp/build, sun.* (Sonnenstand, Strahlung, Wetter, Wolkenzug, poa, dayProfile, dayEnergy, bestTilt, climate, rowSpacing)
 *  M2: pv.array, pv.shade.layout/make/obstacle, pv.analyze, pv.mppt.po/scan, Hotspot, Rueckstrom, TEXTS-Grundgeruest
 *
 * ===================================================================================================
 * SCHNITTSTELLEN FUER ANDERE PAKETE (Kurzfassung; SPEC 4.0 ist massgeblich, Abweichungen stehen in quelle/enrlab/ABWEICHUNGEN.md)
 *  ENR_CORE.K { k, q, Tstc, Gstc }; rng(seed) -> { next(), normal(), int(lo,hi), pick(arr) }; fmt(x, digits) (Dezimalkomma, '–' bei nicht endlich);
 *  parseNum(str); glossary (Array, glossary.get(key) / .byKey); TEXTS { diag:{id:{kind,text,fx?}}, get(id, vars) -> {id,kind,text,fx?}, tpl(text, vars) }.
 *  guard(fn, kind) -> gekapselte Funktion ('num' liefert bei Fehler NaN, 'struct' { ok:false, why }, 'array' []). util { num, clamp, fin, fail }.
 *  pv.presets { zelle, si36, si60, si72 }; pv.spec(idOrObj) -> spec (ok:true) | { ok:false, why };
 *  pv.cond(spec, { G, Tc }) -> par { Iph, I0, a, Rs, Rsh, Vbr, ab, mb, Isc, Uoc, G, Tc, dark, clamped };  pv.cellPar(spec, G, Tc) -> par EINER Zelle;
 *  pv.current(par, U) -> I ; pv.voltage(par, I) -> U ; pv.keys(spec, { G, Tc }) -> { ok, Uoc, Isc, Umpp, Impp, Pmpp, FF, eta, Tc, G, dark };
 *  pv.curve(spec, cond, { points }) -> { U[], I[], P[], keys } ; pv.tempCoeff(spec) -> { gammaP, betaU, alphaI } in 1/K (Anzeige x100 = %/K);
 *  pv.datasheet(spec) -> { rows:[{ id, label, value, unit, text }], note } ; pv.cellTemp(Ta, G, NOCT) ; pv.build (Array von Schichten { id, name, mm, rolle }).
 *  pv.array(cfg) -> feld { ok, spec, ns, np, cond, nMod, uoc, isc, iRev, curve(opts), iAt(U), uAt(I), mpp(), peaks(), opPoint(mode, x), hotspot(I),
 *      keys(), cellMap() , modules() }. cfg = { spec, ns, np, cond:{ G, Tc, fd }, shade:{ kind, p, orient, dunkel, wer, seed }, cellG, bypass, noDedupe }.
 *  pv.shade.layout(spec, orient) -> cells[]; pv.shade.make(spec, orient, kind, p) -> { s[], count, frac, subsHit[], text };
 *  pv.shade.obstacle({ H, D, z0, l, beta, alt, az, gam }) -> { frac, sShade, alphaEff, shaded };
 *  pv.analyze(cfg, opts) -> { keys, keysFree, lossW, lossPct, peaks, op, subs, hot, iRev, track?, diag:[{id,kind,text,fx?}], text };
 *  pv.mppt.po(feld, { u0, stepPct, iter, scan }) -> { path, U, P, stuck }; pv.mppt.scan(feld, opts); pv.hotspotLimits { warn, error } (W).
 *  sun.sites { mitte, sued, nord, pol } (lat, Tm0, Tamp, name); sun.declination(N); sun.position(N, tS, lat) -> { alt, az, up };
 *  sun.dayLength(N, lat); sun.sunriseSunset(N, lat) -> { rise, set, polar, length }; sun.sunPath(N, lat, stepMin); sun.clearSky(N, alt);
 *  sun.weather(c, alt?) -> { ghFactor, kd, kd0 }; sun.cloudTrack(seed, c, spanH) -> fn(tH) -> m (tH = Stunden seit Tagesbeginn des Starttags, darf > 24 sein);
 *  sun.poa(p) -> { gb, gd, gr, g, cosTheta, aoi, alt, az, dniEff, gh }; sun.dayProfile(p, stepMin); sun.dayEnergy(p); sun.bestTilt(N, lat, gam, c);
 *  sun.climate(ort, N, tS); sun.rowSpacing({ l, beta, alt }); sun.site(ortOderBreite) -> { id, lat, ... }.
 * ===================================================================================================
 */
(function (root) {
  'use strict';
  const C = root.ENR_CORE = root.ENR_CORE || {};
  const PI = Math.PI, RAD = PI / 180, DEG = 180 / PI;

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v); return isFinite(x) ? x : d; }
    return d;
  }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
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

  /* ---------- Konstanten ---------- */
  const K = { k: 1.380649e-23, q: 1.602176634e-19, Tstc: 25, Gstc: 1000 };
  C.version = '1.0';
  C.K = K;
  C.guard = guard;
  C.util = { num: num, clamp: clamp, fin: fin, fail: fail };
  /* Basis laut Schnittstelle 4.0 im Namensraum (die Funktionen stehen weiter unten, sie sind hochgezogen) */
  C.fmt = function (x, d) { try { return fmt(x, d); } catch (e) { return '–'; } };
  C.parseNum = function (s) { try { return parseNum(s); } catch (e) { return NaN; } };
  C.rng = function (seed) { return rng(seed); };

  /* ---------- Zahlen: Ausgabe und Eingabe ---------- */
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
  /* parseNum(str): Komma/Punkt, Leerzeichen als Tausendertrennung, Einheitenzusatz toleriert ("250 W", "2,5 A"). Zahl oder NaN. */
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

  /* =====================================================================================================
   *  GLOSSAR (einzige Quelle fuer Begriffe, Symbole, Einheiten, Erklaertexte)
   * ===================================================================================================== */
  /* [key, Symbol, Artikel, Name, Einheit, Nachkommastellen der Anzeige, Erklaerung] */
  const GL = [
    ['G', 'G', 'die', 'Einstrahlung (Bestrahlungsstärke) in der Modulebene', 'W/m²', 0, 'Die Einstrahlung ist die Leistung des Lichts, die je Quadratmeter auf das Modul fällt. Bei STC sind es 1000 W/m².'],
    ['Gb', 'Gb', 'die', 'Direktstrahlung in der Modulebene', 'W/m²', 0, 'Die Direktstrahlung kommt geradlinig von der Sonnenscheibe. Ein Schatten nimmt sie weg.'],
    ['Gd', 'Gd', 'die', 'Diffusstrahlung in der Modulebene', 'W/m²', 0, 'Die Diffusstrahlung kommt aus dem ganzen Himmel, auch durch Wolken. Auch im Schatten bleibt sie übrig.'],
    ['Gr', 'Gr', 'die', 'Bodenreflexion in der Modulebene', 'W/m²', 0, 'Die Bodenreflexion ist das Licht, das vom Boden auf das geneigte Modul zurückgeworfen wird (Albedo, hier 0,2).'],
    ['Tc', 'Tc', 'die', 'Zelltemperatur', '°C', 1, 'Die Zelltemperatur bestimmt die Kennlinie: Wird es heiß, sinkt die Spannung und damit die Leistung.'],
    ['Ta', 'Ta', 'die', 'Umgebungstemperatur', '°C', 1, 'Die Umgebungstemperatur ist die Lufttemperatur am Modul. Die Zelle ist bei Sonne deutlich wärmer.'],
    ['U', 'U', 'die', 'Spannung an den Klemmen', 'V', 2, 'Die Spannung an den Modulklemmen hängt vom Arbeitspunkt auf der Kennlinie ab.'],
    ['I', 'I', 'der', 'Strom an den Klemmen', 'A', 2, 'Der Strom fließt beim Erzeuger positiv aus dem Modul heraus.'],
    ['P', 'P', 'die', 'Leistung an den Klemmen', 'W', 1, 'Die Leistung ist Spannung mal Strom im Arbeitspunkt.'],
    ['Uoc', 'Uoc', 'die', 'Leerlaufspannung', 'V', 2, 'Die Leerlaufspannung misst du, wenn kein Strom fließt. Sie steigt bei Kälte.'],
    ['Isc', 'Isc', 'der', 'Kurzschlussstrom', 'A', 2, 'Der Kurzschlussstrom fließt bei Spannung null. Er ist proportional zur Einstrahlung.'],
    ['Umpp', 'Umpp', 'die', 'Spannung im Punkt maximaler Leistung', 'V', 2, 'Die Spannung, bei der das Modul die größte Leistung abgibt.'],
    ['Impp', 'Impp', 'der', 'Strom im Punkt maximaler Leistung', 'A', 2, 'Der Strom, bei dem das Modul die größte Leistung abgibt.'],
    ['Pmpp', 'Pmpp', 'die', 'maximale Leistung (MPP)', 'W', 1, 'Die größte Leistung auf der Kennlinie. Der MPP (Maximum Power Point) ist der beste Arbeitspunkt.'],
    ['FF', 'FF', 'der', 'Füllfaktor', '', 2, 'Der Füllfaktor ist Pmpp geteilt durch Uoc mal Isc. Er sagt, wie eckig die Kennlinie ist.'],
    ['eta', 'η', 'der', 'Wirkungsgrad', '%', 1, 'Beim Modul ist der Wirkungsgrad Pmpp geteilt durch (Einstrahlung mal Fläche), beim Wechselrichter Leistung aus geteilt durch Leistung ein.'],
    ['A', 'A', 'die', 'Modulfläche', 'm²', 2, 'Die Fläche des Moduls, auf die das Licht fällt.'],
    ['Ns', 'Ns', 'die', 'Zahl der Zellen in Reihe im Modul', '', 0, 'Alle Zellen eines Moduls liegen in Reihe, die Zellspannungen addieren sich.'],
    ['ns', 'ns', 'die', 'Zahl der Module in Reihe (Strang)', '', 0, 'Module in Reihe bilden einen Strang: Die Spannungen addieren sich, der Strom bleibt gleich.'],
    ['np', 'np', 'die', 'Zahl der Stränge parallel', '', 0, 'Stränge parallel: Die Ströme addieren sich, die Spannung bleibt gleich.'],
    ['n', 'n', 'der', 'Idealitätsfaktor der Diode', '', 2, 'Der Idealitätsfaktor beschreibt, wie ideal der pn-Übergang sperrt und leitet (1 ideal, 2 viel Rekombination).'],
    ['Rs', 'Rs', 'der', 'Serienwiderstand', 'Ω', 3, 'Der Serienwiderstand fasst Kontakte, Finger und Sammelschienen zusammen. Er rundet die Kennlinie am Knie ab.'],
    ['Rsh', 'Rsh', 'der', 'Parallelwiderstand', 'Ω', 0, 'Der Parallelwiderstand fasst Leckströme zusammen. Er macht die Kennlinie bei kleiner Spannung leicht schräg.'],
    ['aI', 'αI', 'der', 'Temperaturkoeffizient des Kurzschlussstroms', '%/K', 3, 'Der Kurzschlussstrom steigt mit der Temperatur ein ganz wenig.'],
    ['bU', 'βU', 'der', 'Temperaturkoeffizient der Leerlaufspannung', '%/K', 2, 'Die Leerlaufspannung sinkt mit der Temperatur deutlich.'],
    ['gP', 'γP', 'der', 'Temperaturkoeffizient der Leistung', '%/K', 3, 'Die Leistung sinkt mit der Temperatur. Das Modell rechnet diesen Wert aus, er ist keine Eingabe.'],
    ['alt', 'α', 'die', 'Sonnenhöhe', '°', 1, 'Die Sonnenhöhe ist der Winkel der Sonne über dem Horizont.'],
    ['az', 'γs', 'der', 'Sonnenazimut', '°', 1, 'Der Azimut ist die Himmelsrichtung der Sonne (hier 0 = Süd, Westen positiv).'],
    ['beta', 'β', 'die', 'Modulneigung', '°', 0, 'Die Neigung des Moduls gegen die Waagerechte (0° = flach, 90° = senkrecht).'],
    ['gam', 'γm', 'der', 'Modulazimut', '°', 0, 'Die Ausrichtung des Moduls (0° = Süd, Westen positiv).'],
    ['delta', 'δ', 'die', 'Deklination der Sonne', '°', 2, 'Die Deklination ist der Breitengrad, über dem die Sonne mittags senkrecht steht. Sie wandert im Jahr zwischen −23,45° und +23,45°.'],
    ['phi', 'φ', 'der', 'Breitengrad', '°', 1, 'Der Breitengrad des Standorts.'],
    ['c', 'c', 'die', 'Bewölkung', '', 2, 'Die Bewölkung von 0 (klar) bis 1 (bedeckt), Achtel geteilt durch 8.'],
    ['N', 'N', 'der', 'Tag des Jahres', '', 0, 'Die Zählung der Tage von 1 (1. Januar) bis 365.'],
    ['tS', 't', 'die', 'Sonnenzeit', 'h', 2, 'Sonnenzeit, nicht die Uhrzeit an der Wand: Mittag ist, wenn die Sonne am höchsten steht.'],
    ['AM', 'AM', 'die', 'Luftmasse', '', 2, 'Die Luftmasse (Air Mass) ist die Länge des Lichtwegs durch die Atmosphäre, bezogen auf den senkrechten Weg.'],
    ['bypass', '', 'die', 'Bypassdiode', '', 0, 'Die Bypassdiode liegt antiparallel zu einem Teilstrang. Sie überbrückt verschattete Zellen, damit der Strom der anderen weiterfließen kann.'],
    ['hotspot', '', 'der', 'Hotspot', 'W', 0, 'Der Hotspot ist eine verschattete Zelle, die zum Verbraucher wird und sich durch die Leistung der anderen Zellen erwärmt.'],
    ['teilstrang', '', 'der', 'Teilstrang', '', 0, 'Ein Teilstrang ist die Gruppe von Zellen, die eine Bypassdiode überbrückt.'],
    ['strang', '', 'der', 'Strang', '', 0, 'Ein Strang ist eine Reihenschaltung von Modulen (englisch String).'],
    ['feld', '', 'das', 'Solargenerator-Feld', '', 0, 'Das Feld sind alle Module einer Anlage, in Strängen verschaltet.'],
    ['zelle', '', 'die', 'Solarzelle', '', 0, 'Die Solarzelle wandelt Licht im pn-Übergang in Strom. Eine Siliziumzelle liefert etwa 0,5 bis 0,6 V.'],
    ['modul', '', 'das', 'Solarmodul (Modul)', '', 0, 'Das Modul besteht aus in Reihe geschalteten Zellen zwischen Glas und Rückseitenfolie, mit Rahmen und Anschlussdose.'],
    ['laderegler', '', 'der', 'Laderegler', '', 0, 'Der Laderegler lädt den Akku mit der richtigen Spannung und schützt ihn.'],
    ['akku', '', 'der', 'Akku', '', 0, 'Der Akku speichert die Energie (Blei oder Lithium). Das Wort Batterie steht hier nur als Synonym.'],
    ['soc', 'SoC', 'der', 'Ladezustand', '%', 0, 'Der Ladezustand (State of Charge) sagt, wie voll der Akku ist.'],
    ['wr', 'WR', 'der', 'Wechselrichter', '', 0, 'Der Wechselrichter macht aus Gleichspannung Wechselspannung.'],
    ['insel', '', 'die', 'Inselanlage', '', 0, 'Eine Inselanlage hat keinen Netzanschluss und versorgt ihre Verbraucher allein aus Modul und Akku.'],
    ['netz', '', 'die', 'Netzeinspeisung', '', 0, 'Bei der Netzeinspeisung speist der Wechselrichter die Solarleistung ins Hausnetz und ins öffentliche Netz.'],
    ['mpp', 'MPP', 'der', 'Punkt maximaler Leistung', '', 0, 'Der Arbeitspunkt, an dem Spannung mal Strom am größten ist.'],
    ['stc', 'STC', 'die', 'Standard-Testbedingungen', '', 0, 'STC: 1000 W/m² Einstrahlung, 25 °C Zelltemperatur, Spektrum AM 1,5.'],
    ['noct', 'NOCT', 'die', 'Nenn-Betriebstemperatur der Zelle', '°C', 0, 'NOCT: Zelltemperatur bei 800 W/m², 20 °C Umgebung. Daraus folgt die Zelltemperatur im Betrieb.']
  ];
  const glossary = GL.map(function (g) { return { key: g[0], sym: g[1], article: g[2], name: g[3], unit: g[4], digits: g[5], explain: g[6] }; });
  const glByKey = {};
  glossary.forEach(function (g) { glByKey[g.key] = g; });
  hide(glossary, 'byKey', glByKey);
  hide(glossary, 'get', function (k) { return has(glByKey, k) ? glByKey[k] : null; });
  C.glossary = glossary;

  /* =====================================================================================================
   *  TEXTS: Meldungsvorlagen (einzige Quelle; enrsys.js und enrcalc.js erweitern diese Tabelle)
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
  TEXTS.tpl = tpl;
  TEXTS.get = function (id, vars) {
    try {
      const d = has(TEXTS.diag, id) ? TEXTS.diag[id] : null;
      if (!d) return { id: id, kind: 'info', text: '' };
      const o = { id: id, kind: d.kind || 'info', text: tpl(d.text, vars) };
      if (d.fx) o.fx = d.fx;
      return o;
    } catch (e) { return { id: String(id), kind: 'info', text: '' }; }
  };
  hide(TEXTS, 'tpl', tpl);
  const D = TEXTS.diag;
  D['nacht'] = { kind: 'info', text: 'Nacht: Das Modul liefert nichts. Der Akku muss alles allein tragen.' };
  D['polarnacht'] = { kind: 'info', text: 'Polarnacht: Die Sonne geht nicht auf.' };
  D['polartag'] = { kind: 'info', text: 'Polartag: Die Sonne geht nicht unter.' };
  D['pv-schatten'] = { kind: 'warn', text: 'Der Schatten kostet {w} W ({pct} %). {betroffen}.' };
  D['bypass-an'] = { kind: 'info', text: '{wer} {verb} {n} Zellen: Das Modul liefert dafür weniger Spannung, aber der Strom bleibt erhalten.' };
  D['bypass-fehlt'] = { kind: 'warn', text: 'Ohne funktionierende Bypassdiode wird die verschattete Zelle zum Verbraucher: etwa {p} W Verlustleistung in einer Zelle.' };
  D['hotspot'] = { kind: 'warn', text: 'Hotspot: Eine verschattete Zelle erwärmt sich mit {p} W.' };
  D['hotspot-vergleich'] = { kind: 'info', text: ' Ohne Bypassdioden wären es {p0} W: Bypassdioden begrenzen das, beseitigen es nicht.' };
  D['lokal-mpp'] = { kind: 'warn', text: 'Der MPP-Regler hängt im lokalen Maximum ({x} W) statt im globalen ({y} W). Ein Suchlauf über den ganzen Spannungsbereich findet das bessere.' };
  D['rueckstrom'] = { kind: 'warn', text: 'Der Strang führt {x} A rückwärts, mehr als das Modul verträgt ({y} A).' };
  D['uoc-hoch'] = { kind: 'warn', text: 'Bei dieser Temperatur steigt die Leerlaufspannung auf {x} V, die Grenze des Geräts ist {y} V. {abhilfe}' };
  C.TEXTS = TEXTS;

  /* =====================================================================================================
   *  PV: Ein-Dioden-Modell
   * ===================================================================================================== */
  const pv = C.pv = C.pv || {};

  /* ---------- Voreinstellungen (A8, fiktive Uebungsmodule) ---------- */
  const PRESETS = {
    zelle: { id: 'zelle', name: 'Übungszelle (156 mm)', kind: 'zelle', Ns: 1, n: 1.2, Rs: 0.005, Rsh: 20, IscRef: 9.4, UocRef: 0.64, aI: 0.0005, bU: -0.0032, A: 0.0245, NOCT: 45, subs: 1, cols: 1, rows: 1 },
    si36: { id: 'si36', name: 'Übungsmodul 36 Zellen (12 V)', kind: 'modul', Ns: 36, n: 1.2, Rs: 0.25, Rsh: 150, IscRef: 5.9, UocRef: 22.3, aI: 0.0005, bU: -0.0032, A: 0.67, NOCT: 45, subs: 2, cols: 4, rows: 9 },
    si60: { id: 'si60', name: 'Übungsmodul 60 Zellen', kind: 'modul', Ns: 60, n: 1.2, Rs: 0.30, Rsh: 300, IscRef: 9.5, UocRef: 38.2, aI: 0.0005, bU: -0.0030, A: 1.65, NOCT: 45, subs: 3, cols: 6, rows: 10 },
    si72: { id: 'si72', name: 'Übungsmodul 72 Zellen', kind: 'modul', Ns: 72, n: 1.2, Rs: 0.35, Rsh: 350, IscRef: 9.3, UocRef: 46.0, aI: 0.0005, bU: -0.0030, A: 1.95, NOCT: 45, subs: 3, cols: 6, rows: 12 }
  };
  const SPEC_DEF = { Vbr: -30, ab: 0.1, mb: 3.4, Ud: 0.5, Irev: 15 };
  pv.presets = PRESETS;

  /* spec(idOrObj): prueft und ergaenzt Standardwerte. Gueltige Spezifikation traegt ok:true. */
  function specOf(x) {
    if (isObj(x) && x._v === true && x.ok === true) return x;
    let base = null;
    if (typeof x === 'string') {
      if (!has(PRESETS, x)) return fail('Unbekanntes Modul „' + x.slice(0, 40) + '“. Bekannt sind: zelle, si36, si60, si72.');
      base = PRESETS[x];
      x = {};
    } else if (!isObj(x)) {
      return fail('Die Modul-Spezifikation fehlt. Gib eine Kennung (si60) oder ein Objekt mit Ns, IscRef und UocRef an.');
    } else if (typeof x.id === 'string' && has(PRESETS, x.id)) base = PRESETS[x.id];
    const sp = {};
    const keys = ['id', 'name', 'kind', 'Ns', 'n', 'Rs', 'Rsh', 'IscRef', 'UocRef', 'aI', 'bU', 'A', 'NOCT', 'subs', 'cols', 'rows', 'Vbr', 'ab', 'mb', 'Ud', 'Irev'];
    keys.forEach(function (k) {
      if (has(x, k) && x[k] !== undefined && x[k] !== null) sp[k] = x[k];
      else if (base && has(base, k)) sp[k] = base[k];
      else if (has(SPEC_DEF, k)) sp[k] = SPEC_DEF[k];
    });
    const need = ['Ns', 'IscRef', 'UocRef'];
    for (let i = 0; i < need.length; i++) if (sp[need[i]] === undefined) return fail('Die Modul-Spezifikation braucht ' + need[i] + '.');
    const o = { Ns: [1, 144, 'Die Zellenzahl Ns'], n: [0.5, 3, 'Der Idealitätsfaktor n'], Rs: [1e-6, 50, 'Der Serienwiderstand Rs'], Rsh: [1, 1e6, 'Der Parallelwiderstand Rsh'],
      IscRef: [0.01, 60, 'Der Kurzschlussstrom IscRef'], UocRef: [0.05, 400, 'Die Leerlaufspannung UocRef'], aI: [-0.01, 0.01, 'Der Koeffizient aI'], bU: [-0.02, 0, 'Der Koeffizient bU'],
      A: [0.001, 20, 'Die Modulfläche A'], NOCT: [20, 80, 'NOCT'], Vbr: [-100, -1, 'Die Durchbruchspannung Vbr'], ab: [0, 2, 'Der Faktor ab'], mb: [0.5, 10, 'Der Exponent mb'],
      Ud: [0, 3, 'Die Durchlassspannung der Bypassdiode Ud'], Irev: [0.1, 100, 'Die Rückstrombelastbarkeit Irev'] };
    if (sp.n === undefined) sp.n = 1.2;
    if (sp.Rs === undefined) sp.Rs = 0.005 * sp.Ns;
    if (sp.Rsh === undefined) sp.Rsh = 10 * sp.Ns;
    if (sp.aI === undefined) sp.aI = 0.0005;
    if (sp.bU === undefined) sp.bU = -0.003;
    if (sp.NOCT === undefined) sp.NOCT = 45;
    if (sp.A === undefined) sp.A = 0.0245 * sp.Ns;
    for (const k in o) {
      if (sp[k] === undefined) continue;
      const v = num(sp[k], NaN);
      if (!isFinite(v)) return fail(o[k][2] + ' muss eine Zahl sein.');
      if (v < o[k][0] || v > o[k][1]) return fail(o[k][2] + ' liegt mit ' + fmt(v) + ' außerhalb des sinnvollen Bereichs (' + fmt(o[k][0]) + ' bis ' + fmt(o[k][1]) + ').');
      sp[k] = v;
    }
    sp.Ns = Math.round(sp.Ns);
    if (sp.UocRef <= sp.IscRef * sp.Rs) return fail('Uoc muss größer sein als Isc·Rs, sonst ist das Modell unphysikalisch.');
    if (sp.IscRef * (sp.Rsh + sp.Rs) <= sp.UocRef * 1.0001) return fail('Der Parallelwiderstand Rsh ist so klein, dass er schon bei Isc den Leerlauf-Strom aufzehrt. Wähle ein größeres Rsh.');
    // Raster und Teilstraenge
    sp.subs = Math.max(1, Math.round(num(sp.subs, 1)));
    let cols = Math.round(num(sp.cols, NaN)), rows = Math.round(num(sp.rows, NaN));
    if (!(cols >= 1 && rows >= 1 && cols * rows === sp.Ns)) {
      cols = NaN; rows = NaN;
      const tryCols = [sp.subs * 2, sp.subs, 6, 4, 2, 1];
      for (let i = 0; i < tryCols.length; i++) { const cc = tryCols[i]; if (cc >= 1 && sp.Ns % cc === 0 && sp.Ns / cc >= 1) { cols = cc; rows = sp.Ns / cc; break; } }
      if (!(cols >= 1)) { cols = sp.Ns; rows = 1; }
    }
    if (cols < sp.subs) sp.subs = 1;
    sp.cols = cols; sp.rows = rows;
    if (typeof sp.id !== 'string' || !sp.id) sp.id = 'eigen';
    if (typeof sp.name !== 'string' || !sp.name) sp.name = 'Eigenes Modul';
    sp.kind = sp.Ns > 1 ? 'modul' : 'zelle';
    sp.ok = true;
    hide(sp, '_v', true);
    return sp;
  }
  pv.spec = S_(specOf);

  /* ---------- Bedingungen und Parameter ---------- */
  function cellTemp(Ta, G, NOCT) {
    Ta = num(Ta, NaN); G = num(G, NaN); NOCT = num(NOCT, 45);
    if (!isFinite(Ta) || !isFinite(G) || G < 0) return NaN;
    return Ta + (NOCT - 20) / 800 * G;
  }
  pv.cellTemp = G_(cellTemp);

  /* condPar: Modulparameter (Ns Zellen in Reihe) */
  function condPar(sp, cond) {
    cond = isObj(cond) ? cond : {};
    let G = num(cond.G, 1000), Tc = num(cond.Tc, 25), clamped = false;
    if (G < 0 || G > 1500) { G = clamp(G, 0, 1500); clamped = true; }
    if (Tc < -40 || Tc > 120) { Tc = clamp(Tc, -40, 120); clamped = true; }
    const Tk = Tc + 273.15;
    const a = sp.n * sp.Ns * K.k * Tk / K.q;
    const dark = G < 1;
    const Gx = dark ? 1 : G;
    const Isc = sp.IscRef * (Gx / 1000) * (1 + sp.aI * (Tc - 25));
    let Uoc = sp.UocRef * (1 + sp.bU * (Tc - 25)) + a * Math.log(Gx / 1000);
    // Bei sehr schwachem Licht verbraucht der Parallelwiderstand den ganzen Kurzschlussstrom: Uoc wird auf den Wert begrenzt, den das Modell hergibt.
    const uocMax = 0.98 * Isc * (sp.Rsh + sp.Rs);
    if (Uoc > uocMax) { Uoc = uocMax; clamped = true; }
    if (!(Uoc > Isc * sp.Rs * 1.0001)) Uoc = Isc * sp.Rs * 1.0001 + 1e-6;
    const N = Isc * (1 + sp.Rs / sp.Rsh) - Uoc / sp.Rsh;
    const I0 = N * Math.exp(-Uoc / a) / (1 - Math.exp((Isc * sp.Rs - Uoc) / a));
    const Iph = I0 * (Math.exp(Math.min(700, Uoc / a)) - 1) + Uoc / sp.Rsh;
    const par = { Iph: dark ? 0 : Iph, I0: I0, a: a, Rs: sp.Rs, Rsh: sp.Rsh, Vbr: sp.Vbr * sp.Ns, ab: sp.ab, mb: sp.mb, Isc: dark ? 0 : Isc, Uoc: dark ? 0 : Uoc,
      G: G, Tc: Tc, dark: dark, clamped: clamped, Ns: sp.Ns };
    return par;
  }
  pv.cond = S_(function (spec, cond) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    const p = condPar(sp, cond);
    if (!(isFinite(p.Iph) && isFinite(p.I0) && p.I0 > 0)) return fail('Für diese Bedingung lässt sich das Modell nicht lösen.');
    p.ok = true;
    return p;
  });
  /* cellPar: Parameter EINER Zelle des Moduls (gleiche Iph und I0, a, Rs, Rsh durch Ns) */
  function cellParOf(sp, G, Tc) {
    const m = condPar(sp, { G: G, Tc: Tc });
    return { Iph: m.Iph, I0: m.I0, a: m.a / sp.Ns, Rs: m.Rs / sp.Ns, Rsh: m.Rsh / sp.Ns, Vbr: sp.Vbr, ab: sp.ab, mb: sp.mb,
      Isc: m.Isc, Uoc: m.Uoc / sp.Ns, G: m.G, Tc: m.Tc, dark: m.dark, clamped: m.clamped, Ns: 1 };
  }
  pv.cellPar = S_(function (spec, G, Tc) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    const p = cellParOf(sp, num(G, 1000), num(Tc, 25));
    if (!(isFinite(p.Iph) && isFinite(p.I0))) return fail('Für diese Bedingung lässt sich das Modell nicht lösen.');
    p.ok = true;
    return p;
  });

  /* ---------- Loeser ---------- */
  /* Strom-/Spannungsgleichung: f(I; U) = Iph - I0*(exp(Vd/a)-1) - Vd/Rsh*(1+B(Vd)) - I,  Vd = U + I*Rs,  B nur fuer Vd < 0 (Bishop). */
  function shuntI(par, Vd) {
    // liefert [Ish, dIsh/dVd]
    if (Vd >= 0) { shuntI.d = 1 / par.Rsh; return Vd / par.Rsh; }
    let x = 1 - Vd / par.Vbr;
    if (x < 1e-6) x = 1e-6;
    const xm = Math.pow(x, -par.mb);
    const B = par.ab * xm;
    const dB = par.ab * par.mb * xm / x / par.Vbr;
    shuntI.d = (1 + B + Vd * dB) / par.Rsh;
    return Vd / par.Rsh * (1 + B);
  }
  shuntI.d = 0;
  /* f und df/dVd (Ableitung nach Vd bei festem Rest) */
  function fEval(par, Vd, I) {
    const ex = Math.exp(Math.min(700, Vd / par.a));
    const ish = shuntI(par, Vd);
    fEval.dVd = -(par.I0 * (Vd / par.a < 700 ? ex / par.a : 0) + shuntI.d);
    return par.Iph - par.I0 * (ex - 1) - ish - I;
  }
  fEval.dVd = 0;
  /* Gesicherter Newton mit Bisektionsklammer fuer streng fallendes f(x) (dfdx = Faktor vor dVd) */
  function solveDec(par, U, I, mode, x0, step0, tolF) {
    // mode 'I': unbekannt I bei festem U (Vd = U + I*Rs, df/dI = Rs*dVd - 1); mode 'U': unbekannt U bei festem I (Vd = U + I*Rs, df/dU = dVd)
    function ev(x) {
      const Vd = mode === 'I' ? U + x * par.Rs : x + I * par.Rs;
      const f = fEval(par, Vd, mode === 'I' ? x : I);
      return f;
    }
    function dfx() { return mode === 'I' ? fEval.dVd * par.Rs - 1 : fEval.dVd; }
    let x = x0, fx = ev(x), dx = dfx();
    if (!isFinite(fx)) return NaN;
    if (Math.abs(fx) < tolF) return x;
    let a, b, fa, fb;
    let step = step0;
    if (fx > 0) {
      a = x; fa = fx; b = x + step; fb = ev(b);
      for (let k = 0; k < 80 && fb > 0; k++) { a = b; fa = fb; step *= 2; b = x + step; fb = ev(b); }
      if (!(fb <= 0)) return NaN;
    } else {
      b = x; fb = fx; a = x - step; fa = ev(a);
      for (let k = 0; k < 80 && fa < 0; k++) { b = a; fb = fa; step *= 2; a = x - step; fa = ev(a); }
      if (!(fa >= 0)) return NaN;
    }
    x = fa > -fb ? b : a; // naeher an der Nullstelle ist grob der mit kleinerem |f|
    if (Math.abs(fa) < Math.abs(fb)) { x = a; fx = fa; } else { x = b; fx = fb; }
    dx = (function () { ev(x); return dfx(); })();
    for (let it = 0; it < 120; it++) {
      let xn = x - fx / dx;
      if (!(xn > a && xn < b) || !isFinite(xn)) xn = 0.5 * (a + b);
      const fn = ev(xn);
      const dn = dfx();
      if (fn > 0) { a = xn; fa = fn; } else { b = xn; fb = fn; }
      x = xn; fx = fn; dx = dn;
      if (Math.abs(fx) < tolF) return x;
      if (b - a <= 1e-15 * Math.max(1, Math.abs(x))) return x;
      if (!(dx < 0) || !isFinite(dx)) dx = -1;
    }
    return x;
  }
  function currentAt(par, U, guess) {
    if (!isObj(par) || !isFinite(U)) return NaN;
    U = clamp(U, -1e4, 1e4);
    const tol = 1e-12 * Math.max(1, par.Iph, par.Isc || 0);
    const x0 = isFinite(guess) ? guess : par.Iph - U / par.Rsh;
    const I = solveDec(par, U, 0, 'I', x0, Math.max(0.05, Math.abs(par.Iph) * 0.1 + 0.05), tol);
    return I;
  }
  function voltageAt(par, I, guess) {
    if (!isObj(par) || !isFinite(I)) return NaN;
    I = clamp(I, -1e4, 1e4);
    const tol = 1e-12 * Math.max(1, par.Iph, par.Isc || 0);
    let x0 = guess;
    if (!isFinite(x0)) {
      const rest = (par.Iph - I) / par.I0;
      x0 = rest > 0 ? par.a * Math.log(1 + rest) - I * par.Rs : par.Vbr * 0.5 - I * par.Rs;
      if (!isFinite(x0)) x0 = 0;
      x0 = Math.min(x0, 50 * par.a);
    }
    return solveDec(par, 0, I, 'U', x0, Math.max(0.05, par.a), tol);
  }
  pv.current = G_(function (par, U) { return currentAt(par, num(U, NaN)); });
  pv.voltage = G_(function (par, I) { return voltageAt(par, num(I, NaN)); });

  /* ---------- Kennwerte ---------- */
  function mppOf(par) {
    const Uoc = par.Uoc;
    if (!(Uoc > 0) || !(par.Isc > 0)) return { U: 0, I: 0, P: 0 };
    const N = 240;
    let bestK = 0, bestP = -Infinity, g = NaN;
    const Ps = new Array(N + 1);
    for (let k = 0; k <= N; k++) {
      const U = Uoc * k / N;
      const I = currentAt(par, U, g); g = I;
      const P = U * I; Ps[k] = P;
      if (P > bestP) { bestP = P; bestK = k; }
    }
    let lo = Uoc * Math.max(0, bestK - 1) / N, hi = Uoc * Math.min(N, bestK + 1) / N;
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = hi - gr * (hi - lo), d = lo + gr * (hi - lo);
    let fc = c * currentAt(par, c), fd = d * currentAt(par, d);
    for (let i = 0; i < 60; i++) {
      if (fc > fd) { hi = d; d = c; fd = fc; c = hi - gr * (hi - lo); fc = c * currentAt(par, c); }
      else { lo = c; c = d; fc = fd; d = lo + gr * (hi - lo); fd = d * currentAt(par, d); }
    }
    const U = 0.5 * (lo + hi), I = currentAt(par, U);
    return { U: U, I: I, P: U * I };
  }
  function keysOf(sp, cond) {
    cond = isObj(cond) ? cond : {};
    const par = condPar(sp, cond);
    const A = sp.A;
    if (par.dark) {
      return { ok: true, Uoc: 0, Isc: 0, Umpp: 0, Impp: 0, Pmpp: 0, FF: NaN, eta: NaN, Tc: par.Tc, G: par.G, dark: true, clamped: par.clamped,
        why: 'Nacht: Ohne Licht liefert das Modul nichts, Füllfaktor und Wirkungsgrad lassen sich nicht bestimmen.' };
    }
    const m = mppOf(par);
    return { ok: true, Uoc: par.Uoc, Isc: par.Isc, Umpp: m.U, Impp: m.I, Pmpp: m.P, FF: m.P / (par.Uoc * par.Isc), eta: m.P / (par.G * A), Tc: par.Tc, G: par.G, dark: false, clamped: par.clamped };
  }
  pv.keys = S_(function (spec, cond) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    return keysOf(sp, cond);
  });
  pv.curve = S_(function (spec, cond, opts) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    const par = condPar(sp, cond);
    const n = Math.round(clamp(num(isObj(opts) ? opts.points : NaN, 200), 2, 2000));
    const U = [], I = [], P = [];
    const Uoc = par.Uoc;
    let g = NaN;
    for (let k = 0; k < n; k++) {
      const u = Uoc * k / (n - 1);
      const i = par.dark ? 0 : currentAt(par, u, g); g = i;
      U.push(u); I.push(i); P.push(u * i);
    }
    return { ok: true, U: U, I: I, P: P, keys: keysOf(sp, cond) };
  });
  pv.tempCoeff = S_(function (spec) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    const k1 = keysOf(sp, { G: 1000, Tc: 25 }), k2 = keysOf(sp, { G: 1000, Tc: 65 });
    return { ok: true, gammaP: (k2.Pmpp - k1.Pmpp) / (k1.Pmpp * 40), betaU: (k2.Uoc - k1.Uoc) / (k1.Uoc * 40), alphaI: (k2.Isc - k1.Isc) / (k1.Isc * 40) };
  });
  pv.datasheet = S_(function (spec) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    const st = keysOf(sp, { G: 1000, Tc: 25 });
    const tc = pv.tempCoeff(sp);
    const tn = cellTemp(20, 800, sp.NOCT);
    const nk = keysOf(sp, { G: 800, Tc: tn });
    const rows = [];
    function row(id, label, value, unit, dg) { rows.push({ id: id, label: label, value: value, unit: unit, text: fmt(value, dg) }); }
    row('pmpp', 'Maximale Leistung Pmpp (STC)', st.Pmpp, 'W', 1);
    row('pnenn', 'Nennleistung (gerundet)', Math.round(st.Pmpp / 5) * 5, 'W', 0);
    row('umpp', 'Spannung im MPP Umpp', st.Umpp, 'V', 2);
    row('impp', 'Strom im MPP Impp', st.Impp, 'A', 2);
    row('uoc', 'Leerlaufspannung Uoc', st.Uoc, 'V', 2);
    row('isc', 'Kurzschlussstrom Isc', st.Isc, 'A', 2);
    row('ff', 'Füllfaktor FF', st.FF, '', 2);
    row('eta', 'Modulwirkungsgrad η', st.eta * 100, '%', 1);
    row('aI', 'Temperaturkoeffizient Isc', sp.aI * 100, '%/K', 3);
    row('bU', 'Temperaturkoeffizient Uoc', sp.bU * 100, '%/K', 2);
    row('gP', 'Temperaturkoeffizient Pmpp', tc.gammaP * 100, '%/K', 3);
    row('noct', 'NOCT (800 W/m², 20 °C Umgebung)', sp.NOCT, '°C', 0);
    row('pNoct', 'Pmpp bei NOCT', nk.Pmpp, 'W', 1);
    row('uocNoct', 'Uoc bei NOCT', nk.Uoc, 'V', 2);
    row('iscNoct', 'Isc bei NOCT', nk.Isc, 'A', 2);
    row('area', 'Modulfläche A', sp.A, 'm²', 2);
    row('cells', 'Zellen in Reihe', sp.Ns, '', 0);
    row('subs', 'Bypass-Teilstränge', sp.subs, '', 0);
    return { ok: true, rows: rows, note: 'Übungsmodul, Werte aus dem Modell' };
  });
  /* Aufbau-Schichtentabelle (A9: Dicken Naeherung), von oben (Licht) nach unten */
  pv.build = [
    { id: 'glas', name: 'Solarglas', mm: 3.2, rolle: 'Schützt die Zellen und lässt das Licht durch.' },
    { id: 'eva1', name: 'Einbettfolie (EVA), oben', mm: 0.45, rolle: 'Klebt Glas und Zelle zusammen und hält die Feuchtigkeit fern.' },
    { id: 'zelle', name: 'Solarzelle (Silizium)', mm: 0.18, rolle: 'Wandelt Licht in Strom: n-Schicht oben, p-Schicht unten, dazwischen der pn-Übergang. Finger und Sammelschienen (Busbars) sammeln den Strom.' },
    { id: 'eva2', name: 'Einbettfolie (EVA), unten', mm: 0.45, rolle: 'Bettet die Zelle von unten ein und isoliert.' },
    { id: 'rueck', name: 'Rückseitenfolie', mm: 0.3, rolle: 'Schützt die Rückseite und isoliert elektrisch.' },
    { id: 'rahmen', name: 'Rahmen (Aluminium)', mm: 35, rolle: 'Gibt dem Modul Halt und lässt sich befestigen.' },
    { id: 'dose', name: 'Anschlussdose mit Bypassdioden', mm: 15, rolle: 'Führt den Strom heraus und schützt die Teilstränge mit Bypassdioden.' }
  ];
  hide(pv.build, 'byId', (function () { const o = {}; pv.build.forEach(function (l) { o[l.id] = l; }); return o; })());

  /* =====================================================================================================
   *  PV: Verschattung (Zellkarte, Schattenarten, Hindernis)
   * ===================================================================================================== */
  const shade = pv.shade = pv.shade || {};
  const KINDS = ['keiner', 'kante', 'seite', 'blatt', 'laub', 'mast', 'diagonal'];
  shade.kinds = KINDS.slice();

  function layoutOf(sp, orient) {
    const quer = orient === 'quer';
    const cols = sp.cols, rows = sp.rows, subs = Math.max(1, sp.subs);
    const w = cols / subs;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const xh = (c + 0.5) / cols, yh = 1 - (r + 0.5) / rows;
        const sub = Math.min(subs - 1, Math.floor(c / w + 1e-9));
        cells.push({ id: r * cols + c, col: c, row: r, sub: sub, xf: quer ? yh : xh, yf: quer ? 1 - xh : yh });
      }
    }
    return cells;
  }
  shade.layout = A_(function (spec, orient) {
    const sp = specOf(spec);
    if (sp.ok === false) return [];
    return layoutOf(sp, orient === 'quer' ? 'quer' : 'hochkant');
  });

  function betroffenText(sub, nSubs) {
    if (!sub.length) return '';
    return 'Betroffen: Teilstrang ' + sub.map(function (s) { return s + 1; }).join(', ') + ' von ' + nSubs;
  }
  shade.make = S_(function (spec, orient, kind, p) {
    const sp = specOf(spec);
    if (sp.ok === false) return sp;
    orient = orient === 'quer' ? 'quer' : 'hochkant';
    kind = String(kind);
    if (KINDS.indexOf(kind) < 0) return fail('Diese Schattenart gibt es nicht. Wähle: ' + KINDS.join(', ') + '.');
    p = isObj(p) ? p : {};
    const cells = layoutOf(sp, orient);
    const dunkel = clamp(num(p.dunkel, 1), 0, 1);
    const sel = new Array(cells.length).fill(false);
    const frac = clamp(num(p.frac, 0.1), 0, 1);
    if (kind === 'kante') cells.forEach(function (c, i) { sel[i] = c.yf < frac; });
    else if (kind === 'seite') cells.forEach(function (c, i) { sel[i] = c.xf < frac; });
    else if (kind === 'diagonal') cells.forEach(function (c, i) { sel[i] = (c.xf + c.yf) / 2 < frac; });
    else if (kind === 'blatt') {
      const col = Math.round(clamp(num(p.col, Math.floor(sp.cols / 2)), 0, sp.cols - 1));
      const row = Math.round(clamp(num(p.row, sp.rows - 1), 0, sp.rows - 1));
      sel[row * sp.cols + col] = true;
    } else if (kind === 'laub') {
      const cnt = Math.round(clamp(num(p.count, 3), 0, cells.length));
      const r = rng(num(p.seed, 1));
      const idx = cells.map(function (c, i) { return i; });
      for (let i = 0; i < cnt; i++) { const j = i + Math.floor(r.next() * (idx.length - i)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; sel[idx[i]] = true; }
    } else if (kind === 'mast') {
      // Mast: senkrechter Streifen im BILD (die Welt ist senkrecht): p.col zaehlt die Bildspalten (quer: Bildspalte = Zellzeile des Moduls)
      const picCols = orient === 'quer' ? sp.rows : sp.cols;
      const pc = Math.round(clamp(num(p.col, Math.floor(picCols / 2)), 0, picCols - 1));
      const xm = (pc + 0.5) / picCols, half = 0.5 / picCols - 1e-9;
      cells.forEach(function (c, i) { sel[i] = Math.abs(c.xf - xm) < half; });
    }
    const s = sel.map(function (b) { return b && dunkel > 0 ? 1 - dunkel : 1; });
    let count = 0; const hit = {};
    sel.forEach(function (b, i) { if (b && dunkel > 0) { count++; hit[cells[i].sub] = true; } });
    const subsHit = Object.keys(hit).map(Number).sort(function (a, b) { return a - b; });
    let text;
    if (kind === 'keiner' || count === 0) text = 'Kein Schatten auf dem Modul.';
    else text = count + ' von ' + sp.Ns + (sp.Ns === 1 ? ' Zelle' : ' Zellen') + ' verschattet. ' + betroffenText(subsHit, sp.subs) + '.';
    return { ok: true, s: s, count: count, frac: count / sp.Ns, subsHit: subsHit, text: text, kind: kind, orient: orient };
  });
  /* Hindernis (Hecke/Mast) vor dem Modul: unendlich breit, parallel zur Modulunterkante, genau suedlich (A10) */
  shade.obstacle = S_(function (p) {
    p = isObj(p) ? p : {};
    const H = num(p.H, NaN), D = num(p.D, NaN), z0 = num(p.z0, 0.5), l = num(p.l, NaN), beta = num(p.beta, 35);
    const alt = num(p.alt, NaN), az = num(p.az, 0), gam = num(p.gam, 0);
    if (!isFinite(H) || !isFinite(D) || !isFinite(l) || !isFinite(alt) || !(l > 0) || D < 0 || H < 0) return fail('Hindernis: Höhe, Abstand, Modullänge und Sonnenhöhe müssen Zahlen sein (Länge größer 0).');
    const dAz = Math.abs(((az - gam + 540) % 360) - 180);
    if (alt <= 0 || dAz >= 90) return { ok: true, frac: 0, sShade: 0, alphaEff: NaN, shaded: false, noDirect: true };
    const ta = Math.tan(alt * RAD) / Math.cos((az - gam) * RAD);
    const aEff = Math.atan(ta) * DEG;
    const b = beta * RAD;
    const sSh = (H - z0 - D * ta) / (Math.sin(b) + Math.cos(b) * ta);
    const fr = clamp(sSh / l, 0, 1);
    return { ok: true, frac: fr, sShade: Math.max(0, sSh), alphaEff: aEff, shaded: sSh > 0, noDirect: false };
  });

  /* =====================================================================================================
   *  PV: Verschaltung und Feld (pv.array)
   * ===================================================================================================== */
  /* Wurzelsuche (Illinois) auf [a, b], f(a), f(b) mit verschiedenem Vorzeichen */
  function illinois(f, a, b, fa, fb, tolF, tolX, maxIt) {
    let side = 0, c = a;
    if (fa === 0) return a;
    if (fb === 0) return b;
    for (let it = 0; it < maxIt; it++) {
      c = (fa * b - fb * a) / (fa - fb);
      if (!isFinite(c) || c <= Math.min(a, b) || c >= Math.max(a, b)) c = 0.5 * (a + b);
      const fc = f(c);
      if (!isFinite(fc)) return NaN;
      if (Math.abs(fc) <= tolF) return c;
      if (fc * fb > 0) { b = c; fb = fc; if (side === -1) fa *= 0.5; side = -1; }
      else { a = c; fa = fc; if (side === 1) fb *= 0.5; side = 1; }
      if (Math.abs(b - a) <= tolX) return c;
    }
    return c;
  }
  function golden(f, lo, hi, iters) {
    const gr = (Math.sqrt(5) - 1) / 2;
    let c = hi - gr * (hi - lo), d = lo + gr * (hi - lo), fc = f(c), fd = f(d);
    for (let i = 0; i < iters; i++) {
      if (fc > fd) { hi = d; d = c; fd = fc; c = hi - gr * (hi - lo); fc = f(c); }
      else { lo = c; c = d; fc = fd; d = lo + gr * (hi - lo); fd = f(d); }
    }
    return 0.5 * (lo + hi);
  }

  function strSigOf(modRow, noDedupe, j) {
    const cnt = {};
    modRow.forEach(function (m) { cnt[m.type] = (cnt[m.type] || 0) + 1; });
    const sg = Object.keys(cnt).sort().map(function (k) { return k + 'x' + cnt[k]; }).join(',');
    return noDedupe ? sg + '#' + j : sg;
  }

  function arrayOf(cfg) {
    if (!isObj(cfg)) return fail('Die Feld-Beschreibung fehlt.');
    const sp = specOf(cfg.spec);
    if (sp.ok === false) return sp;
    const ns = Math.round(clamp(num(cfg.ns, 1), 1, 40)), np = Math.round(clamp(num(cfg.np, 1), 1, 20));
    const cond0 = isObj(cfg.cond) ? cfg.cond : {};
    const G = clamp(num(cond0.G, 1000), 0, 1500), Tc = clamp(num(cond0.Tc, 25), -40, 120), fd = clamp(num(cond0.fd, 0.12), 0, 1);
    const Gd = fd * G, Gb = G - Gd;
    const subsN = sp.subs, Ud = sp.Ud;
    const sh = isObj(cfg.shade) ? cfg.shade : null;
    const wer = sh && sh.wer ? sh.wer : 'alle';
    let sArr = null;
    if (sh && sh.kind && sh.kind !== 'keiner') {
      const pp = Object.assign({ dunkel: sh.dunkel, seed: sh.seed }, isObj(sh.p) ? sh.p : {});
      const mk = shade.make(sp, sh.orient, sh.kind, pp);
      if (mk.ok === false) return mk;
      sArr = mk.s;
    }
    const cellG = isArr(cfg.cellG) && cfg.cellG.length >= sp.Ns ? cfg.cellG : null;
    function isShaded(j, i) {
      if (!sArr && !cellG) return false;
      if (wer === 'modul1') return j === 0 && i === 0;
      if (wer === 'strang1') return j === 0;
      return true;
    }
    function bypassOf(j, i, sub) {
      const b = cfg.bypass;
      let v = 'ok';
      if (typeof b === 'string') v = b; else if (isArr(b)) v = b[(j * ns + i) * subsN + sub];
      return v === 'fehlt' || v === 'kurz' ? v : 'ok';
    }
    const cells = layoutOf(sp, 'hochkant');
    const parMap = {};
    function parFor(gz) {
      const key = gz.toFixed(6);
      if (!parMap[key]) parMap[key] = cellParOf(sp, gz, Tc);
      return parMap[key];
    }
    const noDedupe = cfg.noDedupe === true;
    const types = [], typeBySig = {};
    const modInfo = [];                // modInfo[j][i] = { type, gz[], byp[] }
    for (let j = 0; j < np; j++) {
      modInfo.push([]);
      for (let i = 0; i < ns; i++) {
        const shd = isShaded(j, i);
        const gz = new Array(sp.Ns);
        for (let c = 0; c < sp.Ns; c++) {
          if (!shd) gz[c] = G;
          else if (cellG) gz[c] = clamp(num(cellG[c], G), 0, 1500);
          else gz[c] = Gd + sArr[c] * Gb;
        }
        const subs = [], byp = [];
        let sig = '';
        for (let sb = 0; sb < subsN; sb++) {
          const grp = {}, order = [];
          for (let c = 0; c < sp.Ns; c++) {
            if (cells[c].sub !== sb) continue;
            const key = gz[c].toFixed(6);
            if (!grp[key]) { grp[key] = { gz: gz[c], n: 0, ids: [], par: parFor(gz[c]) }; order.push(key); }
            grp[key].n++; grp[key].ids.push(c);
          }
          order.sort();
          const b = bypassOf(j, i, sb);
          byp.push(b);
          subs.push({ groups: order.map(function (k) { return grp[k]; }), byp: b, cells: order.reduce(function (s, k) { return s + grp[k].n; }, 0) });
          sig += '|' + b + ':' + order.map(function (k) { return k + 'x' + grp[k].n; }).join(',');
        }
        if (noDedupe) sig += '#' + j + '_' + i;
        let ti = typeBySig[sig];
        if (ti === undefined) {
          let imax = 0;
          subs.forEach(function (s) { s.groups.forEach(function (g) { imax = Math.max(imax, g.par.Iph); }); });
          ti = types.length; typeBySig[sig] = ti;
          types.push({ idx: ti, subs: subs, imax: imax, first: [j, i] });
        }
        modInfo[j].push({ type: ti, gz: gz, byp: byp, shaded: shd });
      }
    }
    // Straenge: gleiche Zusammensetzung wird einmal gerechnet und np-fach gezaehlt
    const strs = [], strBySig = {};
    for (let j = 0; j < np; j++) {
      const sig = strSigOf(modInfo[j], noDedupe, j);
      let si = strBySig[sig];
      if (si === undefined) {
        si = strs.length; strBySig[sig] = si;
        const cnt = {};
        modInfo[j].forEach(function (m) { cnt[m.type] = (cnt[m.type] || 0) + 1; });
        const tl = Object.keys(cnt).map(function (k) { return [Number(k), cnt[k]]; });
        let imax = 0; tl.forEach(function (t) { imax = Math.max(imax, types[t[0]].imax); });
        strs.push({ idx: si, types: tl, mult: 0, imax: imax, first: j, uoc: NaN });
      }
      strs[si].mult++;
    }

    /* --- Spannungen --- */
    function ucellsSub(sub, I) { let u = 0; for (let g = 0; g < sub.groups.length; g++) u += sub.groups[g].n * voltageAt(sub.groups[g].par, I); return u; }
    function usub(sub, I) {
      if (sub.byp === 'kurz') return 0;
      const u = ucellsSub(sub, I);
      return sub.byp === 'ok' ? Math.max(u, -Ud) : u;
    }
    function umod(t, I) { let u = 0; for (let s = 0; s < t.subs.length; s++) u += usub(t.subs[s], I); return u; }
    function ustr(st, I) { let u = 0; for (let k = 0; k < st.types.length; k++) u += st.types[k][1] * umod(types[st.types[k][0]], I); return u; }
    function strUoc(st) { if (!isFinite(st.uoc)) st.uoc = ustr(st, 0); return st.uoc; }
    /* Strangstrom bei Spannung U: ustr(I) = U (ustr streng fallend, abschnittsweise flach nur bei -Ud je Diode) */
    function istr(st, U) {
      const hi0 = st.imax * 1.02 + 1e-9;
      const f = function (I) { return ustr(st, I) - U; };
      const f0 = strUoc(st) - U;
      if (!isFinite(f0)) return NaN;
      const tolF = 1e-10 * Math.max(1, Math.abs(U));
      if (Math.abs(f0) <= tolF) return 0;
      if (f0 > 0) {
        const fh = f(hi0);
        if (fh >= 0) return hi0;
        return illinois(f, 0, hi0, f0, fh, tolF, 1e-13 * Math.max(1, hi0), 120);
      }
      let lo = -Math.max(0.01 * st.imax, 1e-3), flo = f(lo);
      for (let k = 0; k < 60 && flo < 0; k++) { lo *= 2; flo = f(lo); }
      if (!(flo >= 0)) return NaN;
      return illinois(f, lo, 0, flo, f0, tolF, 1e-13 * Math.max(1, Math.abs(lo)), 120);
    }
    function iarr(U) { let s = 0; for (let k = 0; k < strs.length; k++) s += strs[k].mult * istr(strs[k], U); return s; }
    const single = strs.length === 1;
    const imaxAll = strs.reduce(function (m, s) { return Math.max(m, s.imax); }, 0);
    const darkAll = imaxAll <= 1e-9;

    let _uoc = NaN, _isc = NaN, _peaks = null, _irev = NaN;
    function uocArr() {
      if (isFinite(_uoc)) return _uoc;
      if (darkAll) return (_uoc = 0);
      if (single) return (_uoc = strUoc(strs[0]));
      let umax = 0; strs.forEach(function (s) { umax = Math.max(umax, strUoc(s)); });
      const f0 = iarr(0);
      if (!(f0 > 0)) return (_uoc = 0);
      const hi = umax * 1.0001 + 1e-9;
      _uoc = illinois(iarr, 0, hi, f0, iarr(hi), 1e-10, 1e-12 * Math.max(1, umax), 120);
      return _uoc;
    }
    function iscArr() { if (!isFinite(_isc)) _isc = darkAll ? 0 : iarr(0); return _isc; }
    function uAtI(I) {
      if (!isFinite(I)) return NaN;
      if (single) return ustr(strs[0], I / np);
      const f = function (U) { return iarr(U) - I; };
      let lo = -1, flo = f(lo);
      for (let k = 0; k < 40 && flo < 0; k++) { lo *= 2; flo = f(lo); }
      let hi = uocArr() + 1, fhi = f(hi);
      for (let k = 0; k < 40 && fhi > 0; k++) { hi = hi * 2 + 1; fhi = f(hi); }
      if (!(flo >= 0) || !(fhi <= 0)) return NaN;
      return illinois(f, lo, hi, flo, fhi, 1e-10, 1e-12 * Math.max(1, hi), 120);
    }

    /* --- Maxima der P-U-Kurve --- */
    function peaksOf() {
      if (_peaks) return _peaks;
      if (darkAll) return (_peaks = []);
      const N = single ? 240 : 300;
      const par = new Array(N + 1), Us = new Array(N + 1), Is = new Array(N + 1), Ps = new Array(N + 1);
      let fn;
      if (single) {
        const st = strs[0];
        const hi0 = st.imax * 1.02 + 1e-9;
        const f = function (I) { return ustr(st, I); };
        const Imax = illinois(f, 0, hi0, strUoc(st), f(hi0), 1e-10, 1e-13 * hi0, 120);
        if (!(Imax > 0)) return (_peaks = []);
        for (let k = 0; k <= N; k++) { par[k] = Imax * Math.sin(PI / 2 * k / N); Us[k] = ustr(st, par[k]); Is[k] = np * par[k]; Ps[k] = Us[k] * Is[k]; }
        fn = function (x) { return np * x * ustr(st, x); };
      } else {
        const uo = uocArr();
        if (!(uo > 0)) return (_peaks = []);
        for (let k = 0; k <= N; k++) { par[k] = uo * k / N; Us[k] = par[k]; Is[k] = iarr(Us[k]); Ps[k] = Us[k] * Is[k]; }
        fn = function (x) { return x * iarr(x); };
      }
      const cand = [];
      for (let k = 1; k < N; k++) if (Ps[k] > 0 && Ps[k] >= Ps[k - 1] && Ps[k] > Ps[k + 1]) cand.push(k);
      if (!cand.length) { let bk = 0; for (let k = 1; k <= N; k++) if (Ps[k] > Ps[bk]) bk = k; if (Ps[bk] > 0) cand.push(Math.min(N - 1, Math.max(1, bk))); }
      const pk = cand.map(function (k) {
        const x = golden(fn, par[k - 1], par[k + 1], 60);
        let U, I;
        if (single) { U = ustr(strs[0], x); I = np * x; } else { U = x; I = iarr(x); }
        return { k: k, U: U, I: I, P: U * I };
      });
      pk.sort(function (a, b) { return a.k - b.k; });
      // Prominenz: Maxima, die kaum aus dem Tal ragen, sind keine eigenen Maxima
      const pmax = pk.reduce(function (m, p) { return Math.max(m, p.P); }, 0);
      function valley(k1, k2) { let m = Infinity; for (let k = Math.min(k1, k2); k <= Math.max(k1, k2); k++) m = Math.min(m, Ps[k]); return m; }
      const keep = pk.filter(function (p, i) {
        let vl = valley(0, p.k), vr = valley(p.k, N);
        for (let j = i - 1; j >= 0; j--) if (pk[j].P >= p.P) { vl = valley(pk[j].k, p.k); break; }
        for (let j = i + 1; j < pk.length; j++) if (pk[j].P >= p.P) { vr = valley(p.k, pk[j].k); break; }
        return p.P - Math.max(vl, vr) >= 0.01 * pmax - 1e-12;
      });
      keep.sort(function (a, b) { return b.P - a.P; });
      const res = [];
      keep.forEach(function (p) {
        if (res.some(function (q) { return Math.abs(q.U - p.U) < 1e-3 * Math.max(1, q.U) && Math.abs(q.P - p.P) < 1e-6 * Math.max(1, q.P); })) return;
        res.push({ U: p.U, I: p.I, P: p.P, global: false });
      });
      if (res.length) res[0].global = true;
      return (_peaks = res);
    }

    /* --- Teilstrang-Auswertung bei Strangstrom I (Bypassdiode, Zellstrom, Hotspot) --- */
    function subRows(t, I) {
      const rows = [];
      for (let s = 0; s < t.subs.length; s++) {
        const sub = t.subs[s];
        let U, Ic = I, on = false, Ibp = 0, short = false;
        if (sub.byp === 'kurz') {
          // Bypassdiode durchlegiert: Teilstrang liegt auf 0 V, die Zellen arbeiten im Kurzschluss
          const hi = t.imax * 1.02 + 1e-9;
          const f = function (x) { return ucellsSub(sub, x); };
          const f0 = f(0);
          Ic = f0 <= 0 ? 0 : (f(hi) >= 0 ? hi : illinois(f, 0, hi, f0, f(hi), 1e-10, 1e-13 * hi, 100));
          U = 0; on = true; short = true; Ibp = I - Ic;
        } else {
          const uc = ucellsSub(sub, I);
          if (sub.byp === 'ok' && uc < -Ud) {
            const f = function (x) { return ucellsSub(sub, x) + Ud; };
            const f0 = f(0);
            Ic = f0 <= 0 ? 0 : illinois(f, 0, I, f0, uc + Ud, 1e-10, 1e-13 * Math.max(1, I), 100);
            U = -Ud; on = true; Ibp = I - Ic;
          } else U = uc;
        }
        let hot = { P: 0, cell: -1, U: 0 };
        for (let g = 0; g < sub.groups.length; g++) {
          const uc = voltageAt(sub.groups[g].par, Ic);
          if (uc < 0 && -uc * Ic > hot.P) hot = { P: -uc * Ic, cell: sub.groups[g].ids[0], U: uc };
        }
        let shadedN = 0;
        sub.groups.forEach(function (g) { if (g.gz < G - 1e-9) shadedN += g.n; });
        rows.push({ sub: s, U: U, Ic: Ic, bypassOn: on, short: short, Ibp: Ibp, bypass: sub.byp, shaded: shadedN, cells: sub.cells, hot: hot });
      }
      return rows;
    }
    function hotAt(strI) {
      let best = { P: 0, mod: -1, sub: -1, cell: -1, Ic: 0, U: 0, str: -1 };
      strs.forEach(function (st, si) {
        const I = strI[si];
        st.types.forEach(function (tm) {
          const t = types[tm[0]];
          subRows(t, I).forEach(function (r) { if (r.hot.P > best.P) best = { P: r.hot.P, str: st.first, mod: t.first[1], sub: r.sub, cell: r.hot.cell, Ic: r.Ic, U: r.hot.U }; });
        });
      });
      return best;
    }
    function irevAt(U) {
      let m = 0;
      strs.forEach(function (st) { const I = istr(st, U); if (-I > m) m = -I; });
      return m;
    }

    const feld = { ok: true, spec: sp, ns: ns, np: np, nMod: ns * np, cond: { G: G, Tc: Tc, fd: fd }, nTypes: types.length, nStrTypes: strs.length };
    Object.defineProperty(feld, 'uoc', { enumerable: true, get: function () { try { return uocArr(); } catch (e) { return NaN; } } });
    Object.defineProperty(feld, 'isc', { enumerable: true, get: function () { try { return iscArr(); } catch (e) { return NaN; } } });
    Object.defineProperty(feld, 'iRev', { enumerable: true, get: function () { try { if (!isFinite(_irev)) _irev = np > 1 && !darkAll ? irevAt(uocArr()) : 0; return _irev; } catch (e) { return NaN; } } });
    feld.iAt = G_(function (U) { U = num(U, NaN); return isFinite(U) ? iarr(clamp(U, -1e3, 1e4)) : NaN; });
    feld.uAt = G_(function (I) { I = num(I, NaN); return isFinite(I) ? uAtI(clamp(I, -1e4, 1e4)) : NaN; });
    feld.peaks = A_(function () { return peaksOf().map(function (p) { return { U: p.U, I: p.I, P: p.P, global: p.global }; }); });
    feld.mpp = S_(function () {
      const p = peaksOf();
      if (!p.length) return { ok: true, U: 0, I: 0, P: 0 };
      return { ok: true, U: p[0].U, I: p[0].I, P: p[0].P };
    });
    feld.keys = S_(function () {
      const m = feld.mpp(), uo = uocArr(), isc = iscArr();
      const dark = darkAll || !(isc > 0);
      return { ok: true, Uoc: dark ? 0 : uo, Isc: dark ? 0 : isc, Umpp: m.U, Impp: m.I, Pmpp: m.P, FF: dark || !(uo * isc > 0) ? NaN : m.P / (uo * isc),
        eta: G < 1 ? NaN : m.P / (G * sp.A * ns * np), G: G, Tc: Tc, dark: dark || G < 1, nPeaks: peaksOf().length };
    });
    feld.curve = S_(function (opts) {
      const n = Math.round(clamp(num(isObj(opts) ? opts.points : NaN, 200), 2, 2000));
      const U = [], I = [], P = [];
      if (darkAll) { for (let k = 0; k < n; k++) { U.push(0); I.push(0); P.push(0); } return { ok: true, U: U, I: I, P: P, keys: feld.keys() }; }
      if (single) {
        const st = strs[0];
        const hi0 = st.imax * 1.02 + 1e-9;
        const f = function (x) { return ustr(st, x); };
        const Imax = illinois(f, 0, hi0, strUoc(st), f(hi0), 1e-10, 1e-13 * hi0, 120);
        for (let k = n - 1; k >= 0; k--) { const x = Imax * Math.sin(PI / 2 * k / (n - 1)); const u = Math.max(0, ustr(st, x)); U.push(u); I.push(np * x); P.push(u * np * x); }
      } else {
        const uo = uocArr();
        for (let k = 0; k < n; k++) { const u = uo * k / (n - 1); const i = iarr(u); U.push(u); I.push(i); P.push(u * i); }
      }
      return { ok: true, U: U, I: I, P: P, keys: feld.keys() };
    });
    feld.opPoint = S_(function (mode, x) {
      mode = String(mode);
      let U;
      if (mode === 'u') { U = num(x, NaN); if (!isFinite(U)) return fail('Für die Spannung braucht der Arbeitspunkt eine Zahl.'); U = clamp(U, 0, 1e4); }
      else if (mode === 'r') {
        const R = num(x, NaN);
        if (!(R > 0)) return fail('Der Lastwiderstand muss größer als 0 sein.');
        const uo = uocArr();
        if (!(uo > 0)) U = 0;
        else {
          const f = function (u) { return iarr(u) - u / R; };
          const f0 = f(0), f1 = f(uo);
          U = f0 <= 0 ? 0 : (f1 >= 0 ? uo : illinois(f, 0, uo, f0, f1, 1e-11, 1e-13 * uo, 120));
        }
      } else if (mode === 'mpp') { const m = feld.mpp(); return { ok: true, mode: mode, U: m.U, I: m.I, P: m.P }; }
      else if (mode === 'leerlauf') U = uocArr();
      else if (mode === 'kurzschluss') U = 0;
      else return fail('Unbekannter Betrieb „' + mode.slice(0, 20) + '“. Gültig: u, r, mpp, leerlauf, kurzschluss.');
      const I = mode === 'leerlauf' ? 0 : iarr(U);
      return { ok: true, mode: mode, U: U, I: I, P: U * I };
    });
    /* hotspot(I): groesste Zell-Verlustleistung, wenn jeder Strang den Strom I fuehrt */
    feld.hotspot = S_(function (I) {
      I = num(I, NaN);
      if (!isFinite(I)) return fail('Für den Hotspot braucht es eine Stromstärke.');
      const h = hotAt(strs.map(function () { return I; }));
      return { ok: true, P: h.P, mod: h.mod, sub: h.sub, cell: h.cell, Ic: h.Ic, U: h.U, str: h.str };
    });
    /* Auswertung am Arbeitspunkt U (Klemmenspannung des Feldes) */
    feld.at = S_(function (U) {
      U = num(U, NaN);
      if (!isFinite(U)) return fail('Spannung fehlt.');
      const strI = strs.map(function (st) { return istr(st, U); });
      const trows = {}, rows = [];
      for (let j = 0; j < np; j++) {
        const si = strBySig[strSigOf(modInfo[j], noDedupe, j)];
        const Is = strI[si];
        for (let i = 0; i < ns; i++) {
          const ti = modInfo[j][i].type;
          const key = ti + '_' + si;
          if (!trows[key]) trows[key] = subRows(types[ti], Is);
          trows[key].forEach(function (r) { rows.push({ str: j, mod: i, sub: r.sub, U: r.U, Ic: r.Ic, bypassOn: r.bypassOn, short: r.short, Ibp: r.Ibp, bypass: r.bypass, shaded: r.shaded, cells: r.cells, hotP: r.hot.P }); });
        }
      }
      const hot = hotAt(strI);
      const iRev = Math.max(0, Math.max.apply(null, strI.map(function (x) { return -x; })));
      return { ok: true, U: U, subs: rows, hot: hot, iRev: iRev, strI: strI };
    });
    /* Beschreibung eines Moduls (fuer das Zeichnen): Zelleinstrahlung und Bypass je Teilstrang */
    feld.module = S_(function (j, i) {
      j = Math.round(num(j, 0)); i = Math.round(num(i, 0));
      if (j < 0 || j >= np || i < 0 || i >= ns) return fail('Dieses Modul gibt es im Feld nicht.');
      const m = modInfo[j][i];
      return { ok: true, gz: m.gz.slice(), bypass: m.byp.slice(), shaded: m.shaded };
    });
    return feld;
  }
  pv.array = S_(arrayOf);

  /* =====================================================================================================
   *  PV: MPP-Tracker (Perturb and Observe) und Rasterlauf
   * ===================================================================================================== */
  const mppt = pv.mppt = {};
  mppt.step = S_(function (feld, st, o) {
    if (!isObj(feld) || typeof feld.iAt !== 'function') return fail('Der Tracker braucht ein Feld (pv.array).');
    o = isObj(o) ? o : {};
    const uoc = feld.uoc;
    st = isObj(st) ? st : {};
    const dU = clamp(num(o.stepPct, 0.5), 0.01, 20) * uoc / 100;
    if (!(uoc > 0)) return { ok: true, U: 0, P: 0, dir: 1 };
    const U = isFinite(st.U) ? clamp(st.U, 0, uoc) : clamp(num(o.u0, 0.8 * uoc), 0, uoc);
    const P = isFinite(st.P) ? st.P : U * feld.iAt(U);
    let dir = st.dir === -1 ? -1 : 1;
    let Un = U + dir * dU;
    if (Un > uoc) { Un = uoc; dir = -1; } else if (Un < 0) { Un = 0; dir = 1; }
    const Pn = Un * feld.iAt(Un);
    if (Pn < P) dir = -dir;
    return { ok: true, U: Un, P: Pn, dir: dir };
  });
  mppt.po = S_(function (feld, o) {
    if (!isObj(feld) || typeof feld.iAt !== 'function') return fail('Der Tracker braucht ein Feld (pv.array).');
    o = isObj(o) ? o : {};
    const uoc = feld.uoc;
    if (!(uoc > 0)) return { ok: true, path: [[0, 0]], U: 0, P: 0, stuck: false };
    let u0 = num(o.u0, 0.8 * uoc), scanPts = null;
    if (o.scan === true) {
      scanPts = []; let bp = -1;
      for (let k = 0; k <= 60; k++) { const U = uoc * k / 60, P = U * feld.iAt(U); scanPts.push([U, P]); if (P > bp) { bp = P; u0 = U; } }
    }
    const iter = Math.round(clamp(num(o.iter, 200), 1, 5000));
    let st = { U: clamp(u0, 0, uoc), dir: 1 };
    st.P = st.U * feld.iAt(st.U);
    const path = [[st.U, st.P]];
    for (let k = 0; k < iter; k++) { st = mppt.step(feld, st, o); path.push([st.U, st.P]); }
    const last = path[path.length - 1];
    const pk = feld.peaks();
    const pg = pk.length ? pk[0].P : 0;
    const res = { ok: true, path: path, U: last[0], P: last[1], stuck: pg > 0 && last[1] < 0.95 * pg };
    if (scanPts) res.scanPoints = scanPts;
    return res;
  });
  mppt.scan = S_(function (feld, o) { return mppt.po(feld, Object.assign({}, isObj(o) ? o : {}, { scan: true })); });

  /* =====================================================================================================
   *  PV: Analyse (Verschattung, Bypass, Hotspot, Rueckstrom)
   * ===================================================================================================== */
  pv.hotspotLimits = { warn: 25, error: 100 };
  function analyzeOf(cfg, opts) {
    opts = isObj(opts) ? opts : {};
    const f = arrayOf(cfg);
    if (f.ok === false) return f;
    const sp = f.spec, G = f.cond.G;
    const k1 = keysOf(sp, f.cond);
    const free = { ok: true, Uoc: k1.Uoc * f.ns, Isc: k1.Isc * f.np, Umpp: k1.Umpp * f.ns, Impp: k1.Impp * f.np, Pmpp: k1.Pmpp * f.ns * f.np, FF: k1.FF, eta: k1.eta, G: G, Tc: f.cond.Tc, dark: k1.dark };
    const keys = f.keys();
    const peaks = f.peaks();
    const lossW = Math.max(0, free.Pmpp - keys.Pmpp);
    const lossPct = free.Pmpp > 0 ? 100 * lossW / free.Pmpp : 0;
    let op;
    if (opts.mode && opts.mode !== 'mpp') op = f.opPoint(opts.mode, opts.x); else op = f.opPoint('mpp');
    if (op.ok === false) return op;
    const at = f.at(op.U);
    if (at.ok === false) return at;
    const hot = at.hot;
    let track = null;
    if (opts.mppt) track = mppt.po(f, isObj(opts.mppt) ? opts.mppt : {});
    let hot0 = null;
    if (opts.compareBypass && hot.P > 0) {
      const a2 = analyzeOf(Object.assign({}, cfg, { bypass: 'fehlt' }), { mode: opts.mode, x: opts.x });
      if (a2.ok !== false) hot0 = a2.hot.P;
    }
    // Diagnose: jede Aussage ist geprueft (die Bedingung steht hier im Code)
    const diag = [];
    const lim = pv.hotspotLimits;
    const add = function (id, vars, kindOverride, fx) { const d = TEXTS.get(id, vars); if (kindOverride) d.kind = kindOverride; if (fx) d.fx = fx; diag.push(d); return d; };
    if (G < 1) add('nacht');
    const affected = at.subs.filter(function (r) { return r.shaded > 0; }).length;
    const shadeActive = !!(cfg.shade && cfg.shade.kind && cfg.shade.kind !== 'keiner') && affected > 0;
    if (shadeActive && lossPct >= 5) add('pv-schatten', { w: lossW, pct: lossPct, betroffen: affected === 1 ? '1 Teilstrang ist betroffen' : affected + ' Teilstränge sind betroffen' });
    const on = at.subs.filter(function (r) { return r.bypassOn && !r.short && r.bypass === 'ok'; });
    if (on.length) add('bypass-an', { wer: on.length === 1 ? 'Eine Bypassdiode' : on.length + ' Bypassdioden', verb: on.length === 1 ? 'leitet und überbrückt' : 'leiten und überbrücken', n: on.reduce(function (s, r) { return s + r.cells; }, 0) });
    const noByp = at.subs.some(function (r) { return r.bypass !== 'ok'; });
    if (noByp && hot.P >= lim.warn) add('bypass-fehlt', { p: hot.P });
    if (hot.P >= lim.warn) {
      const d = add('hotspot', { p: hot.P }, hot.P >= lim.error ? 'error' : 'warn', hot.P >= lim.error ? 'overheat' : null);
      if (hot0 !== null && hot0 > hot.P) d.text += TEXTS.get('hotspot-vergleich', { p0: hot0 }).text;
    }
    if (peaks.length >= 2 && track && track.ok !== false && track.stuck) add('lokal-mpp', { x: track.P, y: peaks[0].P });
    if (at.iRev > sp.Irev) add('rueckstrom', { x: at.iRev, y: sp.Irev });
    return { ok: true, keys: keys, keysFree: free, lossW: lossW, lossPct: lossPct, peaks: peaks, op: op, subs: at.subs, hot: hot, iRev: at.iRev,
      iRevMax: f.iRev, track: track, hotNoBypass: hot0, diag: diag, text: diag.map(function (d) { return d.text; }).join(' ') };
  }
  pv.analyze = S_(analyzeOf);

  /* =====================================================================================================
   *  SONNE UND WETTER
   * ===================================================================================================== */
  const sun = C.sun = C.sun || {};
  /* Standorte (A6): nur Groessenordnungen; Tm0 Jahresmittel, Tamp Jahresamplitude der Monatsmittel */
  const SITES = {
    mitte: { id: 'mitte', name: 'Mitte Deutschlands (Ermsleben)', lat: 51.7, Tm0: 9.5, Tamp: 9.0 },
    sued: { id: 'sued', name: 'Südeuropa', lat: 37.4, Tm0: 18, Tamp: 8 },
    nord: { id: 'nord', name: 'Nordeuropa', lat: 60, Tm0: 5, Tamp: 11 },
    pol: { id: 'pol', name: 'Polarkreis-Region', lat: 70, Tm0: -2, Tamp: 12 }
  };
  sun.sites = SITES;
  function siteOf(x) {
    if (typeof x === 'string' && has(SITES, x)) return SITES[x];
    if (isObj(x) && isFinite(num(x.lat, NaN))) return { id: 'frei', name: 'freier Standort', lat: clamp(x.lat, -90, 90), Tm0: num(x.Tm0, 26 - 0.33 * Math.abs(x.lat)), Tamp: num(x.Tamp, 0.18 * Math.abs(x.lat)) };
    const v = num(x, NaN);
    if (isFinite(v)) { const la = clamp(v, -90, 90); return { id: 'frei', name: 'freier Standort', lat: la, Tm0: 26 - 0.33 * Math.abs(la), Tamp: 0.18 * Math.abs(la) }; }
    return null;
  }
  sun.site = function (x) { try { return siteOf(x); } catch (e) { return null; } };
  function latOf(l) { if (typeof l === 'string' && has(SITES, l)) return SITES[l].lat; return clamp(num(l, 51.7), -90, 90); }

  function declinationOf(N) { return 23.45 * Math.sin(360 * (284 + N) / 365 * RAD); }
  sun.declination = G_(function (N) { N = num(N, NaN); return isFinite(N) ? declinationOf(N) : NaN; });
  function positionOf(N, tS, lat) {
    const d = declinationOf(N) * RAD, ph = lat * RAD, w = 15 * (tS - 12) * RAD;
    const sa = Math.sin(ph) * Math.sin(d) + Math.cos(ph) * Math.cos(d) * Math.cos(w);
    const alt = Math.asin(clamp(sa, -1, 1)) * DEG;
    const az = Math.atan2(Math.sin(w), Math.cos(w) * Math.sin(ph) - Math.tan(d) * Math.cos(ph)) * DEG;
    return { alt: alt, az: az, up: alt > 0 };
  }
  sun.position = S_(function (N, tS, lat) {
    N = num(N, NaN); tS = num(tS, NaN);
    if (!isFinite(N) || !isFinite(tS)) return fail('Sonnenstand: Tag und Sonnenzeit müssen Zahlen sein.');
    const p = positionOf(N, tS, latOf(lat));
    p.ok = true;
    return p;
  });
  function cosW0(N, lat) { return -Math.tan(lat * RAD) * Math.tan(declinationOf(N) * RAD); }
  sun.dayLength = G_(function (N, lat) {
    N = num(N, NaN); if (!isFinite(N)) return NaN;
    const c = cosW0(N, latOf(lat));
    if (c >= 1) return 0;
    if (c <= -1) return 24;
    return 2 * Math.acos(c) * DEG / 15;
  });
  sun.sunriseSunset = S_(function (N, lat) {
    N = num(N, NaN); if (!isFinite(N)) return fail('Sonnenaufgang: Der Tag muss eine Zahl sein.');
    const c = cosW0(N, latOf(lat));
    if (c >= 1) return { ok: true, rise: 12, set: 12, polar: 'nacht', length: 0 };
    if (c <= -1) return { ok: true, rise: 0, set: 24, polar: 'tag', length: 24 };
    const w0 = Math.acos(c) * DEG / 15;
    return { ok: true, rise: 12 - w0, set: 12 + w0, polar: null, length: 2 * w0 };
  });
  sun.sunPath = S_(function (N, lat, stepMin) {
    N = num(N, NaN); if (!isFinite(N)) return fail('Sonnenbahn: Der Tag muss eine Zahl sein.');
    const st = clamp(num(stepMin, 10), 1, 120);
    const la = latOf(lat), t = [], alt = [], az = [];
    const n = Math.round(24 * 60 / st);
    for (let i = 0; i <= n; i++) { const th = i * st / 60; const p = positionOf(N, th, la); t.push(th); alt.push(p.alt); az.push(p.az); }
    return { ok: true, t: t, alt: alt, az: az };
  });
  function clearOf(N, alt) {
    const g0 = 1361 * (1 + 0.033 * Math.cos(360 * N / 365 * RAD));
    if (!(alt > 0)) return { dni: 0, ghClear: 0, gdhClear: 0, am: NaN, g0: g0 };
    const sa = Math.sin(alt * RAD);
    const am = 1 / (sa + 0.50572 * Math.pow(alt + 6.07995, -1.6364));
    const dni = g0 * Math.pow(0.7, Math.pow(am, 0.678));
    return { dni: dni, ghClear: dni * sa + 0.1 * dni, gdhClear: 0.1 * dni, am: am, g0: g0 };
  }
  sun.clearSky = S_(function (N, alt) {
    N = num(N, NaN); alt = num(alt, NaN);
    if (!isFinite(N) || !isFinite(alt)) return fail('Klarer Himmel: Tag und Sonnenhöhe müssen Zahlen sein.');
    const o = clearOf(N, clamp(alt, -90, 90)); o.ok = true; return o;
  });
  function weatherOf(c, alt) {
    c = clamp(num(c, 0), 0, 1);
    const sa = Math.sin(clamp(num(alt, 30), 0.01, 90) * RAD);
    const kd0 = 0.1 / (sa + 0.1);
    return { ghFactor: 1 - 0.75 * Math.pow(c, 3.4), kd: Math.min(1, kd0 + (1 - kd0) * Math.pow(c, 1.5)), kd0: kd0 };
  }
  sun.weather = S_(function (c, alt) {
    c = num(c, NaN);
    if (!isFinite(c)) return fail('Wetter: Die Bewölkung muss eine Zahl zwischen 0 und 1 sein.');
    const w = weatherOf(c, alt); w.ok = true; return w;
  });
  /* Wolkenzug: Poisson-Ereignisse (Rate 4*c je Stunde), Dauer 2 bis 12 min, Tiefe 0,4 bis 0,9, gehobener Kosinus */
  sun.cloudTrack = function (seed, c, spanH) {
    try {
      c = clamp(num(c, 0), 0, 1);
      const span = clamp(num(spanH, 24), 0, 24 * 28);
      const r = rng(num(seed, 1));
      const ev = [];
      const rate = 4 * c;
      if (rate > 0) {
        let t = -0.25;
        for (let k = 0; k < 20000; k++) {
          t += -Math.log(1 - r.next()) / rate;
          if (t > span + 0.25) break;
          const dur = (2 + 10 * r.next()) / 60, depth = 0.4 + 0.5 * r.next();
          ev.push([t, t + dur, depth]);
        }
      }
      return function (tH) {
        try {
          tH = num(tH, NaN);
          if (!isFinite(tH)) return 1;
          let lo = 0, hi = ev.length;
          while (lo < hi) { const mid = (lo + hi) >> 1; if (ev[mid][0] < tH - 0.2) lo = mid + 1; else hi = mid; }
          let m = 1;
          for (let i = lo; i < ev.length && ev[i][0] <= tH; i++) {
            const e = ev[i];
            if (tH < e[1]) { const x = (tH - e[0]) / (e[1] - e[0]); m *= 1 - e[2] * 0.5 * (1 - Math.cos(2 * PI * x)); }
          }
          return clamp(m, 0.15, 1);
        } catch (e) { return 1; }
      };
    } catch (e) { return function () { return 1; }; }
  };
  /* poa(p): Einstrahlung in der Modulebene. p = { N, tS, lat, beta, gam, c, albedo, m } */
  function poaOf(p) {
    const N = num(p.N, NaN), tS = num(p.tS, NaN);
    if (!isFinite(N) || !isFinite(tS)) return null;
    const lat = latOf(p.lat), beta = clamp(num(p.beta, 35), 0, 90), gam = num(p.gam, 0), c = clamp(num(p.c, 0), 0, 1);
    const rho = clamp(num(p.albedo, 0.2), 0, 1), m = clamp(num(p.m, 1), 0, 1);
    const pos = positionOf(N, tS, lat);
    const b = beta * RAD;
    const zero = { gb: 0, gd: 0, gr: 0, g: 0, cosTheta: 0, aoi: 90, alt: pos.alt, az: pos.az, dniEff: 0, gh: 0 };
    if (!(pos.alt > 0)) return zero;
    const sa = Math.sin(pos.alt * RAD), ca = Math.cos(pos.alt * RAD);
    const cs = clearOf(N, pos.alt), w = weatherOf(c, pos.alt);
    const gh = cs.ghClear * w.ghFactor;
    const gdh = w.kd * gh, gbh = (1 - w.kd) * gh;
    const dniEff = Math.min(gbh / sa, cs.dni);
    const cosT = sa * Math.cos(b) + ca * Math.sin(b) * Math.cos((pos.az - gam) * RAD);
    const gb = Math.max(0, cosT) * dniEff * m;
    const gdhEff = gdh * (1 - 0.3 * (1 - m));
    const gd = gdhEff * (1 + Math.cos(b)) / 2;
    const ghEff = dniEff * m * sa + gdhEff;
    const gr = rho * ghEff * (1 - Math.cos(b)) / 2;
    return { gb: gb, gd: gd, gr: gr, g: gb + gd + gr, cosTheta: cosT, aoi: Math.acos(Math.max(0, Math.min(1, cosT))) * DEG, alt: pos.alt, az: pos.az, dniEff: dniEff * m, gh: ghEff };
  }
  sun.poa = S_(function (p) {
    if (!isObj(p)) return fail('Einstrahlung: Die Eingabe fehlt.');
    const o = poaOf(p);
    if (!o) return fail('Einstrahlung: Tag N und Sonnenzeit tS müssen Zahlen sein.');
    o.ok = true;
    return o;
  });
  function mFn(p) {
    if (typeof p.m === 'function') return function (t) { const v = num(p.m(t), 1); return clamp(v, 0, 1); };
    if (p.zug === true && num(p.c, 0) > 0) return sun.cloudTrack(p.seed, p.c, 24);
    const mm = clamp(num(p.m, 1), 0, 1);
    return function () { return mm; };
  }
  sun.dayProfile = S_(function (p, stepMin) {
    if (!isObj(p)) return fail('Tagesgang: Die Eingabe fehlt.');
    const N = num(p.N, NaN);
    if (!isFinite(N)) return fail('Tagesgang: Der Tag N muss eine Zahl sein.');
    const st = clamp(num(stepMin, 10), 1, 120), m = mFn(p);
    const n = Math.round(24 * 60 / st);
    const t = [], g = [], gClear = [], alt = [], gh = [];
    for (let i = 0; i <= n; i++) {
      const th = i * st / 60;
      const a = poaOf(Object.assign({}, p, { tS: th, m: m(th) }));
      const b = poaOf(Object.assign({}, p, { tS: th, c: 0, m: 1 }));
      t.push(th); g.push(a.g); gClear.push(b.g); alt.push(a.alt); gh.push(a.gh);
    }
    return { ok: true, t: t, g: g, gClear: gClear, alt: alt, gh: gh };
  });
  /* Tagesenergie in der Modulebene in kWh/m2 (Mittelpunktsregel, Standard Minutenraster) */
  sun.dayEnergy = G_(function (p) {
    if (!isObj(p)) return NaN;
    const N = num(p.N, NaN);
    if (!isFinite(N)) return NaN;
    const st = clamp(num(p.stepMin, 1), 1, 120), m = mFn(p);
    const n = Math.round(24 * 60 / st);
    let s = 0;
    for (let i = 0; i < n; i++) { const th = (i + 0.5) * st / 60; s += poaOf(Object.assign({}, p, { tS: th, m: m(th) })).g; }
    return s * st / 60 / 1000;
  });
  sun.bestTilt = G_(function (N, lat, gam, c) {
    N = num(N, NaN); if (!isFinite(N)) return NaN;
    let best = 0, be = -1;
    for (let b = 0; b <= 90; b++) {
      const e = sun.dayEnergy({ N: N, lat: lat, beta: b, gam: num(gam, 0), c: num(c, 0), stepMin: 10 });
      if (e > be + 1e-12) { be = e; best = b; }
    }
    return best;
  });
  sun.climate = G_(function (ort, N, tS) {
    const s = siteOf(ort); N = num(N, NaN); tS = num(tS, NaN);
    if (!s || !isFinite(N) || !isFinite(tS)) return NaN;
    const jahr = Math.cos(2 * PI * (N - 20) / 365);
    const Tm = s.Tm0 - s.Tamp * jahr;
    const dT = 4 - 1.5 * jahr;
    return Tm + dT / 2 * Math.sin(2 * PI * (tS - 9) / 24);
  });
  sun.rowSpacing = G_(function (o) {
    if (!isObj(o)) return NaN;
    const l = num(o.l, NaN), beta = num(o.beta, NaN), alt = num(o.alt, NaN);
    if (!(l > 0) || !isFinite(beta) || !(alt > 0) || alt > 90) return NaN;
    return l * Math.cos(beta * RAD) + l * Math.sin(beta * RAD) / Math.tan(alt * RAD);
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
