/* enrcalc.js - Energie-/Solar-Lab, Kern Teil 3 (ENR_CORE.calc), WP1c. Rechner mit Rechenweg, Normwerte-Tabellen, Uebungsgenerator.
 * Reine Rechnung, keine DOM-Zugriffe. Haengt sich an denselben Namensraum wie enrcore.js und enrsys.js (SPEC Abschnitt 4.14).
 * Browser: window.ENR_CORE.calc. Node: module.exports = ENR_CORE (Namensraum), globalThis.ENR_CORE. Vanilla-JS, kein eval.
 *
 * SCHNITTSTELLE (SPEC 4.14, ab hier fuer WP4b, WP5, WP6 verbindlich)
 *  ENR_CORE.calc.formulas                  Objekt, Schluessel = Id; formulas.list() (Array in fester Reihenfolge), formulas.get(id), formulas.ids
 *    Eintrag { id, name, symbol, expr, unit, pct (true: Ergebnis ist ein Anteil 0..1, Anzeige in %), inputs:[{ key, label, unit, def }],
 *              fn(...zahlen) -> Zahl | NaN,  explain(...zahlen) -> { ok, value, unit, shown, steps:[Formel, eingesetzt], note?, extra? } | { ok:false, why, steps:[] } }
 *    Die Argumente von fn/explain stehen in der Reihenfolge von inputs. Prozentwerte als Eingabe (dod, eta, dsoc, gp, bu) sind in PROZENT (50 = 50 %).
 *    Ids: leistung, energie, eta, etaPv, ff, pTemp, uocTemp, serie, parallel, stringMax, stringMin, crate, ladezeit, autonomie, batterieKap,
 *         pvBedarf, spannungsfall, querschnitt, leitungsverlust, wrEta, euroEta, sonnenhoehe, reihenabstand, ertrag, amortisation, eigenquote, autarkie
 *  ENR_CORE.calc.exercise(kind, seed) -> { ok, kind, seed, question, given, table:[{ caption, head, rows }], answer:{ value, unit, tol, alt:[] }, steps:[], check(input) -> { ok, text }, diagnose(input) -> { ok, id, hint } }
 *    exercise.kinds = ['pel','etaPv','ff','tempkorr','serie','parallel','stringcheck','batterie','autonomie','crate','ladezeit','kabel','verlust','euroeta','ertrag','amorti','sonnenhoehe','abstand','pvbedarf']
 *    given enthaelt alle Zahlen, mit denen gerechnet wird (genau die angezeigten, gerundeten Werte). Antworten in Prozent haben unit '%' (Wert 16,3 fuer 16,3 %).
 *    Fehler: { ok:false, why } (unbekannte Art, Kern fehlt).
 *  ENR_CORE.calc.skal                      Normwerte-Tabellen { querschnitte, sicherungen, akku, regler, kappa, euro, up(liste,x), down(liste,x), upQuerschnitt, upSicherung, upAkku, upRegler }
 *  ENR_CORE.TEXTS.calc                     Meldungen dieser Datei (einzige Quelle, keine Duplikate in der Oberflaeche)
 * Abhaengigkeiten zur Laufzeit (nur lesend, Regel 7): C.fmt/C.parseNum/C.rng (sonst lokale Entsprechung), C.pv.presets/keys/tempCoeff (Modul-Datenblatt der Uebungen),
 *  C.inv.eta/euroEta (Uebung euroeta), C.sun.rowSpacing (Formel reihenabstand). Fehlt ein Teil, liefert die Uebung { ok:false, why }, die Formel rechnet lokal.
 */
(function (root) {
  'use strict';
  if (typeof module !== 'undefined' && typeof require === 'function') {
    try { require('./enrsys.js'); } catch (e) { /* noch nicht vorhanden oder laedt enrcore selbst */ }
    try { require('./enrcore.js'); } catch (e) { /* noch nicht vorhanden */ }
  }
  const C = root.ENR_CORE = root.ENR_CORE || {};
  const calc = {};

  /* ---------- Hilfsfunktionen ---------- */
  function num(v, d) {
    if (typeof v === 'number') return isFinite(v) ? v : d;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v); return isFinite(x) ? x : d; }
    return d;
  }
  function fin(x) { return typeof x === 'number' && isFinite(x); }
  function isObj(o) { return o !== null && typeof o === 'object' && !Array.isArray(o); }
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function fail(why, extra) { const o = { ok: false, why: why }; if (extra) for (const k in extra) o[k] = extra[k]; return o; }
  function S(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return fail('Interner Fehler bei ungültiger Eingabe.'); } }; }
  function Cg(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { return NaN; } }; }
  function hide(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }
  function rd(x, n) { return Number(x.toFixed(n)); }

  /* ---------- Anzeige und Eingabe (Kern, sonst lokale Entsprechung) ---------- */
  function fmtL(x, digits) {
    x = num(x, NaN);
    if (!isFinite(x)) return '–';
    let s;
    const dg = digits === undefined || digits === null ? NaN : Number(digits);
    if (isFinite(dg)) s = x.toFixed(Math.min(10, Math.max(0, Math.round(dg))));
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
  function parseNumL(str) {
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
  function fmt(x, d) {
    const f = C.fmt;
    if (typeof f === 'function') { try { const s = f(x, d); if (typeof s === 'string') return s; } catch (e) { /* lokal */ } }
    return fmtL(x, d);
  }
  function parseNum(s) {
    const f = C.parseNum;
    if (typeof f === 'function') { try { const v = f(s); if (typeof v === 'number') return v; } catch (e) { /* lokal */ } }
    return parseNumL(s);
  }
  function rngL(seed) {
    let a = Math.floor(num(seed, 1)) | 0;
    return { next: function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    } };
  }
  function rng(seed) {
    const f = C.rng;
    if (typeof f === 'function') { try { const r = f(seed); if (r && typeof r.next === 'function') return r; } catch (e) { /* lokal */ } }
    return rngL(seed);
  }
  const N_ = function (x) { return fmt(x); };

  /* ---------- Texte (einzige Quelle dieser Datei) ---------- */
  const TXT = {
    keineZahl: 'Das ist keine Zahl. Schreibe zum Beispiel 2,5.',
    ungueltig: 'Mit diesen Werten lässt sich nichts berechnen. Prüfe, ob alle Felder Zahlen enthalten.',
    kernFehlt: 'Die Übung braucht den Kern (enrcore.js, enrsys.js), der hier nicht geladen ist.',
    unbekannt: 'Unbekannte Übungsart.',
    zuKlein: 'Dein Wert ist zu klein.',
    zuGross: 'Dein Wert ist zu groß.',
    annahme: 'Annahmewerte, bitte aktualisieren.',
    amortiHinweis: 'Gerechnet ohne Zins und ohne Alterung; die Preise sind Annahmen, bitte aktualisieren.',
    ertragHinweis: 'Einstrahlung H und Performance Ratio PR sind Annahmewerte, bitte aktualisieren; das Tagesmodell wird nicht auf ein Jahr hochgerechnet.',
    uocTempHinweis: 'Näherung für G = 1000 W/m². Der Kern rechnet mit demselben Temperaturkoeffizienten (Datenblatt-Art).',
    serieHinweis: 'In der Reihenschaltung bleibt der Strom gleich, nur die Spannungen addieren sich.',
    parallelHinweis: 'In der Parallelschaltung bleibt die Spannung gleich, nur die Ströme addieren sich.',
    stringMaxHinweis: 'Abrunden, nie aufrunden: Bei zu hoher Spannung wird der Eingang zerstört.',
    stringMinHinweis: 'Aufrunden: Bei zu wenig Spannung liegt der Strang außerhalb des MPP-Fensters.',
    akkuGross: 'Größer als der größte Normwert (600 Ah): mehrere Akkus parallel oder eine höhere Systemspannung wählen.',
    querschnittGross: 'Größer als der größte Normquerschnitt (95 mm²): Länge verkürzen, Strom senken oder die Systemspannung erhöhen.',
    spannungsfallViel: 'Mehr als 3 % Spannungsfall: Nimm mehr Querschnitt.',
    dpvRegel: 'Gerechnet wird mit dem Kupferwert κ, den du angibst (56 bis 58 m/(Ω·mm²) im Tabellenbuch).',
    sonnenhoeheHinweis: 'Gilt für die Sonnenzeit am Mittag (Sonne genau im Süden).',
    ladezeitHinweis: 'Näherung mit konstantem Ladewirkungsgrad. Die Absorptionsphase (Strom klingt ab) dauert in Wirklichkeit länger.',
    crateHinweis: 'Die C-Rate hat die Einheit 1/h und wird als Vielfaches von C geschrieben.',
    etaGross: 'Der Wirkungsgrad wäre größer als 100 %. Prüfe die Werte.'
  };
  const TEXTS = C.TEXTS = (C.TEXTS && typeof C.TEXTS === 'object') ? C.TEXTS : {};
  try { TEXTS.calc = TXT; } catch (e) { /* TEXTS eingefroren */ }

  /* ---------- Normwerte-Tabellen (calc.skal) ---------- */
  const SK = {
    querschnitte: [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95],
    sicherungen: [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250],
    akku: [50, 75, 100, 120, 150, 200, 250, 300, 400, 600],
    regler: [10, 20, 30, 40, 60],
    kappa: { kupfer: 56, alt: [57, 58], rhoAlt: [0.0178, 0.0172] },
    euro: { p: [0.05, 0.10, 0.20, 0.30, 0.50, 1.0], w: [0.03, 0.06, 0.13, 0.10, 0.48, 0.20] }
  };
  function up(list, x) {
    x = num(x, NaN);
    if (!Array.isArray(list) || !isFinite(x)) return NaN;
    for (let i = 0; i < list.length; i++) if (list[i] >= x * (1 - 1e-9)) return list[i];
    return NaN;
  }
  function down(list, x) {
    x = num(x, NaN);
    if (!Array.isArray(list) || !isFinite(x)) return NaN;
    let best = NaN;
    for (let i = 0; i < list.length; i++) if (list[i] <= x * (1 + 1e-9)) best = list[i];
    return best;
  }
  const skal = {
    querschnitte: SK.querschnitte, sicherungen: SK.sicherungen, akku: SK.akku, regler: SK.regler, kappa: SK.kappa, euro: SK.euro,
    up: Cg(up), down: Cg(down),
    upQuerschnitt: Cg(function (x) { return up(SK.querschnitte, x); }),
    upSicherung: Cg(function (x) { return up(SK.sicherungen, x); }),
    upAkku: Cg(function (x) { return up(SK.akku, x); }),
    upRegler: Cg(function (x) { return up(SK.regler, x); })
  };

  /* =====================================================================================================
   *  FORMELN
   * ===================================================================================================== */
  const FORM = {};
  const ORDER = [];
  /* defF(id, name, symbol, expr, unit, inputs[[key,label,unit,def]], validate(...a) -> Text | null, calc(...a) -> Zahl, subst(...a, v) -> Text, opts) */
  function defF(id, name, symbol, expr, unit, inputs, validate, calcFn, subst, opts) {
    opts = opts || {};
    function evalArgs(args) {
      const a = [];
      for (let i = 0; i < inputs.length; i++) {
        const x = num(args[i], NaN);
        if (!isFinite(x)) return { why: TXT.ungueltig };
        a.push(x);
      }
      const why = validate.apply(null, a);
      if (why) return { why: why };
      const v = calcFn.apply(null, a);
      if (!isFinite(v)) return { why: TXT.ungueltig };
      if (opts.maxOne && v > 1 + 1e-12) return { why: opts.maxOne };
      return { a: a, v: v };
    }
    const fn = Cg(function () { const r = evalArgs(arguments); return r.why ? NaN : r.v; });
    const explain = S(function () {
      const r = evalArgs(arguments);
      if (r.why) return fail(r.why, { steps: [] });
      const a = r.a, v = r.v;
      const out = { ok: true, value: v, unit: unit, steps: [expr, subst.apply(null, a.concat([v]))] };
      out.shown = opts.pct ? fmt(v * 100) + ' %' : fmt(v) + (unit ? ' ' + unit : '');
      if (opts.note) { const n = opts.note.apply(null, a.concat([v])); if (n) out.note = n; }
      if (opts.extra) { const e = opts.extra.apply(null, a.concat([v])); if (e) out.extra = e; }
      return out;
    });
    const e = { id: id, name: name, symbol: symbol, expr: expr, unit: unit, pct: !!opts.pct,
      inputs: inputs.map(function (x) { return { key: x[0], label: x[1], unit: x[2], def: x[3] }; }), fn: fn, explain: explain };
    FORM[id] = e; ORDER.push(id);
  }
  const pctTxt = function (v) { return N_(v) + ' (' + N_(v * 100) + ' %)'; };

  defF('leistung', 'elektrische Leistung', 'P', 'P = U · I', 'W',
    [['u', 'Spannung U', 'V', 30], ['i', 'Strom I', 'A', 8]],
    function (u, i) { return u >= 0 && i >= 0 ? null : 'Spannung und Strom müssen größer oder gleich 0 sein.'; },
    function (u, i) { return u * i; },
    function (u, i, v) { return 'P = ' + N_(u) + ' V · ' + N_(i) + ' A = ' + N_(v) + ' W'; });
  defF('energie', 'Energie', 'E', 'E = P · t', 'Wh',
    [['p', 'Leistung P', 'W', 250], ['t', 'Zeit t', 'h', 5]],
    function (p, t) { return p >= 0 && t >= 0 ? null : 'Leistung und Zeit müssen größer oder gleich 0 sein.'; },
    function (p, t) { return p * t; },
    function (p, t, v) { return 'E = ' + N_(p) + ' W · ' + N_(t) + ' h = ' + N_(v) + ' Wh (' + N_(v / 1000) + ' kWh)'; });
  defF('eta', 'Wirkungsgrad', 'η', 'η = P_aus / P_ein', '',
    [['paus', 'abgegebene Leistung P_aus', 'W', 250], ['pein', 'aufgenommene Leistung P_ein', 'W', 1000]],
    function (a, e) { return e > 0 ? (a >= 0 && a <= e ? null : 'Der Wirkungsgrad kann nicht größer als 100 % sein: P_aus muss kleiner oder gleich P_ein sein.') : 'Die aufgenommene Leistung muss größer als 0 sein, sonst gibt es keinen Wirkungsgrad.'; },
    function (a, e) { return a / e; },
    function (a, e, v) { return 'η = ' + N_(a) + ' W / ' + N_(e) + ' W = ' + pctTxt(v); }, { pct: true });
  defF('etaPv', 'Wirkungsgrad des Moduls', 'η', 'η = Pmpp / (G · A)', '',
    [['pmpp', 'Leistung im MPP Pmpp', 'W', 268], ['g', 'Einstrahlung G', 'W/m²', 1000], ['a', 'Modulfläche A', 'm²', 1.65]],
    function (p, g, a) {
      if (g < 1) return 'Bei Nacht (G unter 1 W/m²) fällt kein Licht ein: Es gibt keinen Wirkungsgrad.';
      if (!(a > 0)) return 'Die Modulfläche muss größer als 0 sein.';
      return p >= 0 ? null : 'Die Leistung darf nicht negativ sein.';
    },
    function (p, g, a) { return p / (g * a); },
    function (p, g, a, v) { return 'η = ' + N_(p) + ' W / (' + N_(g) + ' W/m² · ' + N_(a) + ' m²) = ' + pctTxt(v); }, { pct: true, maxOne: TXT.etaGross });
  defF('ff', 'Füllfaktor', 'FF', 'FF = Pmpp / (Uoc · Isc)', '',
    [['pmpp', 'Leistung im MPP Pmpp', 'W', 268], ['uoc', 'Leerlaufspannung Uoc', 'V', 38.2], ['isc', 'Kurzschlussstrom Isc', 'A', 9.5]],
    function (p, u, i) { return u > 0 && i > 0 ? (p >= 0 ? null : 'Die Leistung darf nicht negativ sein.') : 'Uoc und Isc müssen größer als 0 sein (bei Nacht gibt es keinen Füllfaktor).'; },
    function (p, u, i) { return p / (u * i); },
    function (p, u, i, v) { return 'FF = ' + N_(p) + ' W / (' + N_(u) + ' V · ' + N_(i) + ' A) = ' + N_(v); },
    { maxOne: 'Der Füllfaktor ist immer kleiner als 1: Pmpp kann nicht größer als Uoc · Isc sein.' });
  defF('pTemp', 'Modulleistung bei Zelltemperatur', 'P(T)', 'P(T) = P_STC · (1 + γP · (T − 25 °C))', 'W',
    [['pstc', 'Leistung bei STC P_STC', 'W', 268], ['gp', 'Temperaturkoeffizient γP', '%/K', -0.38], ['t', 'Zelltemperatur T', '°C', 60]],
    function (p, g, t) {
      if (t < -40 || t > 120) return 'Die Zelltemperatur muss zwischen −40 °C und 120 °C liegen.';
      if (p < 0) return 'Die Leistung darf nicht negativ sein.';
      return 1 + g / 100 * (t - 25) >= 0 ? null : 'Mit diesem Koeffizienten wird die Leistung negativ: Der Koeffizient gilt nur nahe 25 °C.';
    },
    function (p, g, t) { return p * (1 + g / 100 * (t - 25)); },
    function (p, g, t, v) { return 'P(T) = ' + N_(p) + ' W · (1 + (' + N_(g) + ' %/K) · (' + N_(t) + ' °C − 25 °C)) = ' + N_(v) + ' W'; },
    { note: function (p, g, t, v) { return 'Faustformel mit dem Koeffizienten aus dem Datenblatt; der Kern rechnet die Kennlinie exakt.'; } });
  defF('uocTemp', 'Leerlaufspannung bei Zelltemperatur', 'Uoc(T)', 'Uoc(T) = Uoc_STC · (1 + βU · (T − 25 °C))', 'V',
    [['uoc', 'Leerlaufspannung bei STC', 'V', 38.2], ['bu', 'Temperaturkoeffizient βU', '%/K', -0.30], ['t', 'Zelltemperatur T', '°C', -10]],
    function (u, b, t) {
      if (t < -40 || t > 120) return 'Die Zelltemperatur muss zwischen −40 °C und 120 °C liegen.';
      if (u <= 0) return 'Die Leerlaufspannung muss größer als 0 sein.';
      return 1 + b / 100 * (t - 25) > 0 ? null : 'Mit diesem Koeffizienten wird die Spannung nicht positiv.';
    },
    function (u, b, t) { return u * (1 + b / 100 * (t - 25)); },
    function (u, b, t, v) { return 'Uoc(T) = ' + N_(u) + ' V · (1 + (' + N_(b) + ' %/K) · (' + N_(t) + ' °C − 25 °C)) = ' + N_(v) + ' V'; },
    { note: function () { return TXT.uocTempHinweis; } });
  defF('serie', 'Reihenschaltung von Modulen', 'Uoc_ges', 'Uoc_ges = ns · Uoc', 'V',
    [['ns', 'Module in Reihe ns', '', 4], ['uoc', 'Leerlaufspannung je Modul Uoc', 'V', 38.2]],
    function (n, u) { return n >= 1 && n <= 100 && Math.round(n) === n ? (u > 0 ? null : 'Die Leerlaufspannung muss größer als 0 sein.') : 'Die Zahl der Module in Reihe muss eine ganze Zahl zwischen 1 und 100 sein.'; },
    function (n, u) { return n * u; },
    function (n, u, v) { return 'Uoc_ges = ' + N_(n) + ' · ' + N_(u) + ' V = ' + N_(v) + ' V'; },
    { note: function () { return TXT.serieHinweis; } });
  defF('parallel', 'Parallelschaltung von Strängen', 'Isc_ges', 'Isc_ges = np · Isc', 'A',
    [['np', 'Stränge parallel np', '', 3], ['isc', 'Kurzschlussstrom je Strang Isc', 'A', 9.5]],
    function (n, i) { return n >= 1 && n <= 100 && Math.round(n) === n ? (i >= 0 ? null : 'Der Strom darf nicht negativ sein.') : 'Die Zahl der Stränge muss eine ganze Zahl zwischen 1 und 100 sein.'; },
    function (n, i) { return n * i; },
    function (n, i, v) { return 'Isc_ges = ' + N_(n) + ' · ' + N_(i) + ' A = ' + N_(v) + ' A'; },
    { note: function () { return TXT.parallelHinweis; } });
  defF('stringMax', 'größte Modulzahl in Reihe', 'ns,max', 'ns,max = abrunden(U_max / Uoc_kalt)', '',
    [['uoc', 'Leerlaufspannung je Modul bei tiefster Temperatur', 'V', 42.2], ['umax', 'höchste Eingangsspannung', 'V', 500]],
    function (u, m) {
      if (!(u > 0) || !(m > 0)) return 'Beide Spannungen müssen größer als 0 sein.';
      return u <= m ? null : 'Schon ein einzelnes Modul (' + N_(u) + ' V) überschreitet die Grenze von ' + N_(m) + ' V: Das Modul passt nicht an diesen Eingang.';
    },
    function (u, m) { return Math.floor(m / u + 1e-9); },
    function (u, m, v) { return 'ns,max = abrunden(' + N_(m) + ' V / ' + N_(u) + ' V) = abrunden(' + N_(m / u) + ') = ' + N_(v); },
    { note: function () { return TXT.stringMaxHinweis; } });
  defF('stringMin', 'kleinste Modulzahl in Reihe', 'ns,min', 'ns,min = aufrunden(U_min / Umpp_heiß)', '',
    [['umpp', 'MPP-Spannung je Modul bei höchster Temperatur', 'V', 27], ['umin', 'untere Grenze des MPP-Fensters', 'V', 150]],
    function (u, m) { return u > 0 && m > 0 ? null : 'Beide Spannungen müssen größer als 0 sein.'; },
    function (u, m) { return Math.ceil(m / u - 1e-9); },
    function (u, m, v) { return 'ns,min = aufrunden(' + N_(m) + ' V / ' + N_(u) + ' V) = aufrunden(' + N_(m / u) + ') = ' + N_(v); },
    { note: function () { return TXT.stringMinHinweis; } });
  defF('crate', 'C-Rate', 'C-Rate', 'C-Rate = I / C   (Einheit 1/h, geschrieben „C“)', 'C',
    [['i', 'Strom I', 'A', 10], ['c', 'Kapazität C', 'Ah', 100]],
    function (i, c) { return c > 0 ? (i >= 0 ? null : 'Der Strom muss positiv angegeben werden (Betrag).') : 'Die Kapazität muss größer als 0 sein.'; },
    function (i, c) { return i / c; },
    function (i, c, v) { return 'C-Rate = ' + N_(i) + ' A / ' + N_(c) + ' Ah = ' + N_(v) + ' C'; },
    { note: function () { return TXT.crateHinweis; } });
  defF('ladezeit', 'Ladezeit', 't', 't ≈ C · ΔSoC / (η · I)', 'h',
    [['c', 'Kapazität C', 'Ah', 100], ['dsoc', 'Ladehub ΔSoC', '%', 80], ['eta', 'Ladewirkungsgrad η', '%', 90], ['i', 'Ladestrom I', 'A', 10]],
    function (c, d, e, i) {
      if (!(c > 0)) return 'Die Kapazität muss größer als 0 sein.';
      if (!(d > 0 && d <= 100)) return 'Der Ladehub muss zwischen 0 und 100 % liegen.';
      if (!(e > 0 && e <= 100)) return 'Der Ladewirkungsgrad muss zwischen 0 und 100 % liegen.';
      return i > 0 ? null : 'Der Ladestrom muss größer als 0 sein: Bei 0 A wird der Akku nie voll (z. B. bei Nacht).';
    },
    function (c, d, e, i) { return c * (d / 100) / ((e / 100) * i); },
    function (c, d, e, i, v) { return 't ≈ ' + N_(c) + ' Ah · ' + N_(d / 100) + ' / (' + N_(e / 100) + ' · ' + N_(i) + ' A) = ' + N_(v) + ' h'; },
    { note: function () { return TXT.ladezeitHinweis; } });
  defF('autonomie', 'Autonomiezeit', 'Tage', 'Tage = C · Usys · DoD · η / E_d', 'Tage',
    [['c', 'Kapazität C', 'Ah', 100], ['usys', 'Systemspannung Usys', 'V', 12], ['dod', 'nutzbare Entladetiefe DoD', '%', 50], ['eta', 'Wirkungsgrad Wechselrichter (Gleichstromlast: 100)', '%', 100], ['ed', 'Tagesenergie E_d', 'Wh', 600]],
    function (c, u, d, e, ed) {
      if (!(c > 0) || !(u > 0)) return 'Kapazität und Systemspannung müssen größer als 0 sein.';
      if (!(d > 0 && d <= 100)) return 'Die Entladetiefe muss zwischen 0 und 100 % liegen.';
      if (!(e > 0 && e <= 100)) return 'Der Wirkungsgrad muss zwischen 0 und 100 % liegen.';
      return ed > 0 ? null : 'Ohne Verbrauch (E_d = 0) ergibt die Autonomie keinen Sinn.';
    },
    function (c, u, d, e, ed) { return c * u * (d / 100) * (e / 100) / ed; },
    function (c, u, d, e, ed, v) { return 'Tage = ' + N_(c) + ' Ah · ' + N_(u) + ' V · ' + N_(d / 100) + ' · ' + N_(e / 100) + ' / ' + N_(ed) + ' Wh = ' + N_(v) + ' Tage'; });
  defF('batterieKap', 'Akkukapazität', 'C', 'C = (E_d / η) · Tage / (Usys · DoD)', 'Ah',
    [['ed', 'Tagesenergie E_d', 'Wh', 600], ['tage', 'Autonomietage', 'Tage', 3], ['usys', 'Systemspannung Usys', 'V', 12], ['dod', 'nutzbare Entladetiefe DoD', '%', 50], ['eta', 'Wirkungsgrad Wechselrichter (Gleichstromlast: 100)', '%', 100]],
    function (ed, t, u, d, e) {
      if (!(ed > 0)) return 'Ohne Verbrauch (E_d = 0) braucht die Anlage keinen Akku.';
      if (!(t > 0) || !(u > 0)) return 'Autonomietage und Systemspannung müssen größer als 0 sein.';
      if (!(d > 0 && d <= 100)) return 'Die Entladetiefe muss zwischen 0 und 100 % liegen.';
      return e > 0 && e <= 100 ? null : 'Der Wirkungsgrad muss zwischen 0 und 100 % liegen.';
    },
    function (ed, t, u, d, e) { return (ed / (e / 100)) * t / (u * (d / 100)); },
    function (ed, t, u, d, e, v) { return 'C = (' + N_(ed) + ' Wh / ' + N_(e / 100) + ') · ' + N_(t) + ' / (' + N_(u) + ' V · ' + N_(d / 100) + ') = ' + N_(v) + ' Ah'; },
    { extra: function (ed, t, u, d, e, v) { return { norm: up(SK.akku, v) }; },
      note: function (ed, t, u, d, e, v) { const n = up(SK.akku, v); return isFinite(n) ? 'Aufgerundet auf den Normwert ' + N_(n) + ' Ah.' : TXT.akkuGross; } });
  defF('pvBedarf', 'erforderliche Modulleistung', 'P_pv', 'P_pv = E_d / (PSH · PR)', 'W',
    [['ed', 'Tagesenergie E_d', 'Wh', 600], ['psh', 'Sonnenstunden PSH', 'h', 2], ['pr', 'Performance Ratio PR', '', 0.65]],
    function (ed, h, pr) {
      if (!(h > 0)) return 'Ohne Sonnenstunden (PSH = 0, z. B. Polarnacht) lässt sich keine Modulleistung auslegen.';
      if (!(pr > 0 && pr <= 1)) return 'Die Performance Ratio muss zwischen 0 und 1 liegen.';
      return ed >= 0 ? null : 'Die Tagesenergie darf nicht negativ sein.';
    },
    function (ed, h, pr) { return ed / (h * pr); },
    function (ed, h, pr, v) { return 'P_pv = ' + N_(ed) + ' Wh / (' + N_(h) + ' h · ' + N_(pr) + ') = ' + N_(v) + ' W'; });
  function kappaOk(k) { return k >= 30 && k <= 62 ? null : 'κ liegt für Kupfer bei 56 bis 58 m/(Ω·mm²) (Aluminium bei 34 bis 36).'; }
  defF('spannungsfall', 'Spannungsfall auf der Leitung', 'ΔU', 'ΔU = 2 · L · I / (κ · A)', 'V',
    [['l', 'einfache Leitungslänge L', 'm', 5], ['i', 'Strom I', 'A', 10], ['a', 'Querschnitt A', 'mm²', 4], ['kappa', 'Leitwert κ', 'm/(Ω·mm²)', 56], ['u', 'Systemspannung (für den Vergleich)', 'V', 12]],
    function (l, i, a, k, u) {
      if (!(l >= 0) || !(i >= 0)) return 'Länge und Strom dürfen nicht negativ sein.';
      if (!(a > 0)) return 'Der Querschnitt muss größer als 0 sein.';
      if (!(u > 0)) return 'Die Systemspannung muss größer als 0 sein.';
      return kappaOk(k);
    },
    function (l, i, a, k) { return 2 * l * i / (k * a); },
    function (l, i, a, k, u, v) { return 'ΔU = 2 · ' + N_(l) + ' m · ' + N_(i) + ' A / (' + N_(k) + ' m/(Ω·mm²) · ' + N_(a) + ' mm²) = ' + N_(v) + ' V (' + N_(v / u * 100) + ' % von ' + N_(u) + ' V)'; },
    { note: function (l, i, a, k, u, v) { return v / u > 0.03 ? TXT.spannungsfallViel : ''; } });
  defF('querschnitt', 'erforderlicher Querschnitt', 'A_min', 'A_min = 2 · L · I / (κ · ΔU)', 'mm²',
    [['l', 'einfache Leitungslänge L', 'm', 5], ['i', 'Strom I', 'A', 10], ['du', 'zulässiger Spannungsfall ΔU', 'V', 0.24], ['kappa', 'Leitwert κ', 'm/(Ω·mm²)', 56]],
    function (l, i, du, k) {
      if (!(du > 0)) return 'Der zulässige Spannungsfall muss größer als 0 V sein (sonst Division durch 0).';
      if (!(l >= 0) || !(i >= 0)) return 'Länge und Strom dürfen nicht negativ sein.';
      return kappaOk(k);
    },
    function (l, i, du, k) { return 2 * l * i / (k * du); },
    function (l, i, du, k, v) { return 'A_min = 2 · ' + N_(l) + ' m · ' + N_(i) + ' A / (' + N_(k) + ' m/(Ω·mm²) · ' + N_(du) + ' V) = ' + N_(v) + ' mm²'; },
    { extra: function (l, i, du, k, v) { return { norm: up(SK.querschnitte, v) }; },
      note: function (l, i, du, k, v) { const n = up(SK.querschnitte, v); return isFinite(n) ? 'Aufgerundet auf den Normquerschnitt ' + N_(n) + ' mm².' : TXT.querschnittGross; } });
  defF('leitungsverlust', 'Verlustleistung auf der Leitung', 'P_V', 'P_V = I² · 2 · L / (κ · A)', 'W',
    [['i', 'Strom I', 'A', 10], ['l', 'einfache Leitungslänge L', 'm', 5], ['a', 'Querschnitt A', 'mm²', 4], ['kappa', 'Leitwert κ', 'm/(Ω·mm²)', 56]],
    function (i, l, a, k) {
      if (!(i >= 0) || !(l >= 0)) return 'Strom und Länge dürfen nicht negativ sein.';
      return a > 0 ? kappaOk(k) : 'Der Querschnitt muss größer als 0 sein.';
    },
    function (i, l, a, k) { return i * i * 2 * l / (k * a); },
    function (i, l, a, k, v) { return 'P_V = (' + N_(i) + ' A)² · 2 · ' + N_(l) + ' m / (' + N_(k) + ' m/(Ω·mm²) · ' + N_(a) + ' mm²) = ' + N_(v) + ' W'; });
  defF('wrEta', 'Wirkungsgrad des Wechselrichters', 'η', 'η = P_AC / P_DC', '',
    [['pac', 'Wechselstromleistung P_AC', 'W', 900], ['pdc', 'Gleichstromleistung P_DC', 'W', 940]],
    function (a, d) { return d > 0 ? (a >= 0 && a <= d ? null : 'P_AC darf nicht größer sein als P_DC (der Wechselrichter erzeugt keine Energie).') : 'P_DC muss größer als 0 sein: Ohne Eingangsleistung gibt es keinen Wirkungsgrad.'; },
    function (a, d) { return a / d; },
    function (a, d, v) { return 'η = ' + N_(a) + ' W / ' + N_(d) + ' W = ' + pctTxt(v); }, { pct: true });
  function euroDef(k) {
    const f = C.inv && C.inv.eta;
    const fb = [90, 94, 96, 97, 97, 97];
    try { if (typeof f === 'function') { const v = f('standard', SK.euro.p[k]); if (isFinite(v)) return rd(v * 100, 1); } } catch (e) { /* Rueckfall */ }
    return fb[k];
  }
  defF('euroEta', 'Europäischer Wirkungsgrad', 'η_Euro', 'η_Euro = 0,03·η5 + 0,06·η10 + 0,13·η20 + 0,10·η30 + 0,48·η50 + 0,20·η100', '',
    [['e5', 'η bei 5 % Last', '%', euroDef(0)], ['e10', 'η bei 10 % Last', '%', euroDef(1)], ['e20', 'η bei 20 % Last', '%', euroDef(2)],
      ['e30', 'η bei 30 % Last', '%', euroDef(3)], ['e50', 'η bei 50 % Last', '%', euroDef(4)], ['e100', 'η bei 100 % Last', '%', euroDef(5)]],
    function () { for (let i = 0; i < arguments.length; i++) if (!(arguments[i] > 0 && arguments[i] <= 100)) return 'Jeder Wirkungsgrad muss zwischen 0 und 100 % liegen.'; return null; },
    function () { let s = 0; for (let i = 0; i < 6; i++) s += SK.euro.w[i] * arguments[i] / 100; return s; },
    function (a, b, c, d, e, f, v) { return 'η_Euro = 0,03 · ' + N_(a) + ' % + 0,06 · ' + N_(b) + ' % + 0,13 · ' + N_(c) + ' % + 0,10 · ' + N_(d) + ' % + 0,48 · ' + N_(e) + ' % + 0,20 · ' + N_(f) + ' % = ' + pctTxt(v); }, { pct: true });
  function refSpacing(l, b, al) {
    const r = C.sun && C.sun.rowSpacing;
    if (typeof r === 'function') { try { const v = r({ l: l, beta: b, alt: al }); if (isFinite(v)) return v; } catch (e) { /* lokal */ } }
    const rad = Math.PI / 180;
    return l * Math.cos(b * rad) + l * Math.sin(b * rad) / Math.tan(al * rad);
  }
  defF('sonnenhoehe', 'höchste Sonnenhöhe am Tag', 'α_max', 'α_max = 90° − φ + δ', '°',
    [['phi', 'Breitengrad φ', '°', 51.7], ['delta', 'Deklination δ', '°', 23.45]],
    function (p, d) { return Math.abs(p) <= 90 && Math.abs(d) <= 24 ? null : 'Der Breitengrad liegt zwischen −90° und 90°, die Deklination zwischen −23,45° und 23,45°.'; },
    function (p, d) { return 90 - Math.abs(p - d); },
    function (p, d, v) { const ds = d < 0 ? ' − ' + N_(-d) + '°' : ' + ' + N_(d) + '°';
      return p >= d ? 'α_max = 90° − ' + N_(p) + '°' + ds + ' = ' + N_(v) + '°' : 'α_max = 90° − |' + N_(p) + '° − ' + N_(d) + '°| = ' + N_(v) + '°'; },
    { note: function () { return TXT.sonnenhoeheHinweis; } });
  defF('reihenabstand', 'Reihenabstand', 'd', 'd = l · cos β + l · sin β / tan α', 'm',
    [['l', 'Modullänge l entlang der Neigung', 'm', 1.65], ['beta', 'Neigung β', '°', 35], ['alt', 'kleinste Sonnenhöhe α', '°', 14.85]],
    function (l, b, a) {
      if (!(a > 0 && a <= 90)) return 'Bei Sonnenhöhe 0° (Sonne am Horizont, Polarnacht) wird der Abstand unendlich groß. Wähle α größer als 0°.';
      if (!(b >= 0 && b <= 90)) return 'Die Neigung liegt zwischen 0° (waagerecht) und 90°.';
      return l > 0 ? null : 'Die Modullänge muss größer als 0 sein.';
    },
    function (l, b, a) { return refSpacing(l, b, a); },
    function (l, b, a, v) { return 'd = ' + N_(l) + ' m · cos ' + N_(b) + '° + ' + N_(l) + ' m · sin ' + N_(b) + '° / tan ' + N_(a) + '° = ' + N_(v) + ' m'; });
  defF('ertrag', 'Jahresertrag (Annahme)', 'E_a', 'E_a = P_peak · H · PR', 'kWh',
    [['kwp', 'Anlagenleistung P_peak', 'kWp', 5], ['h', 'Einstrahlung H (Annahme)', 'kWh/(m²·a)', 1000], ['pr', 'Performance Ratio PR (Annahme)', '', 0.8]],
    function (k, h, pr) { return k >= 0 && h >= 0 && pr > 0 && pr <= 1 ? null : 'Leistung und Einstrahlung dürfen nicht negativ sein, die Performance Ratio liegt zwischen 0 und 1.'; },
    function (k, h, pr) { return k * h * pr; },
    function (k, h, pr, v) { return 'E_a = ' + N_(k) + ' kWp · ' + N_(h) + ' kWh/(m²·a) · ' + N_(pr) + ' = ' + N_(v) + ' kWh pro Jahr'; },
    { note: function () { return TXT.ertragHinweis; } });
  defF('amortisation', 'Amortisationszeit (grob)', 't', 't = Invest / (E_eigen · Bezugspreis + E_einsp · Vergütung)', 'Jahre',
    [['invest', 'Investition (Annahme)', '€', 8000], ['eigen', 'Eigenverbrauch E_eigen', 'kWh/a', 2000], ['bezug', 'Bezugspreis (Annahme)', '€/kWh', 0.35], ['einsp', 'Einspeisung E_einsp', 'kWh/a', 2500], ['verg', 'Vergütung (Annahme)', '€/kWh', 0.08]],
    function (inv, e, b, s, v) {
      if (!(inv >= 0) || !(e >= 0) || !(b >= 0) || !(s >= 0) || !(v >= 0)) return 'Kosten, Energien und Preise dürfen nicht negativ sein.';
      return e * b + s * v > 0 ? null : 'Ohne Ersparnis und ohne Vergütung amortisiert sich die Anlage nie.';
    },
    function (inv, e, b, s, v) { return inv / (e * b + s * v); },
    function (inv, e, b, s, v, t) { return 't = ' + N_(inv) + ' € / (' + N_(e) + ' kWh · ' + N_(b) + ' €/kWh + ' + N_(s) + ' kWh · ' + N_(v) + ' €/kWh) = ' + N_(t) + ' Jahre'; },
    { note: function () { return TXT.amortiHinweis; } });
  defF('eigenquote', 'Eigenverbrauchsquote', 'Q', 'Quote = E_Eigen / E_PV', '',
    [['eigen', 'selbst genutzte Energie (direkt und aus dem Speicher)', 'kWh', 2000], ['epv', 'erzeugte Energie E_PV', 'kWh', 4500]],
    function (e, p) { return p > 0 ? (e >= 0 && e <= p ? null : 'Die selbst genutzte Energie kann nicht größer sein als die erzeugte.') : 'Ohne Erzeugung gibt es keine Eigenverbrauchsquote.'; },
    function (e, p) { return e / p; },
    function (e, p, v) { return 'Quote = ' + N_(e) + ' kWh / ' + N_(p) + ' kWh = ' + pctTxt(v); }, { pct: true });
  defF('autarkie', 'Autarkiegrad', 'A', 'Autarkie = E_Eigen / E_Haus', '',
    [['eigen', 'aus der Anlage gedeckter Verbrauch (direkt und aus dem Speicher)', 'kWh', 2000], ['haus', 'Verbrauch im Haus E_Haus', 'kWh', 4000]],
    function (e, h) { return h > 0 ? (e >= 0 && e <= h ? null : 'Die aus der Anlage gedeckte Energie kann nicht größer sein als der Verbrauch.') : 'Ohne Verbrauch im Haus gibt es keinen Autarkiegrad.'; },
    function (e, h) { return e / h; },
    function (e, h, v) { return 'Autarkie = ' + N_(e) + ' kWh / ' + N_(h) + ' kWh = ' + pctTxt(v); }, { pct: true });

  const formulas = FORM;
  hide(FORM, 'list', function () { return ORDER.map(function (id) { return FORM[id]; }); });
  hide(FORM, 'get', function (id) { return has(FORM, id) ? FORM[id] : null; });
  hide(FORM, 'ids', ORDER.slice());
  const F_ = function (id) { return FORM[id]; };

  /* =====================================================================================================
   *  EINHEITEN IN EINGABEN ("2,5 kWh", "250 W")
   * ===================================================================================================== */
  const BASES = ['wh', 'ah', 'wp', 'va', 'mm²', 'mm2', 'w', 'v', 'a', 'ω', 'm', 'h'];
  function unitOf(text) {
    if (typeof text !== 'string') return null;
    const s = text.replace(/\s/g, '');
    const m = s.match(/^[+\-−]?[\d.,]+(?:[eE][+\-]?\d+)?(.*)$/);
    return m && m[1] ? parseUnit(m[1]) : null;
  }
  function parseUnit(u) {
    if (typeof u !== 'string' || !u) return null;
    if (u === '%') return { base: '%', f: 1 };
    const low = u.toLowerCase();
    for (let i = 0; i < BASES.length; i++) {
      const b = BASES[i];
      if (low.length >= b.length && low.slice(low.length - b.length) === b) {
        const pre = u.slice(0, u.length - b.length);
        const base = b === 'mm2' ? 'mm²' : b;
        if (pre === '') return { base: base, f: 1 };
        if (pre === 'k' || pre === 'K') return { base: base, f: 1e3 };
        if (pre === 'm') return { base: base, f: 1e-3 };
        if (pre === 'M') return { base: base, f: 1e6 };
        if (pre === 'µ' || pre === 'u') return { base: base, f: 1e-6 };
        return null;
      }
    }
    return null;
  }

  /* =====================================================================================================
   *  UEBUNGSGENERATOR
   * ===================================================================================================== */
  const EX_KINDS = ['pel', 'etaPv', 'ff', 'tempkorr', 'serie', 'parallel', 'stringcheck', 'batterie', 'autonomie', 'crate', 'ladezeit', 'kabel', 'verlust', 'euroeta', 'ertrag', 'amorti', 'sonnenhoehe', 'abstand', 'pvbedarf'];
  const MODNAME = { si36: 'Modul mit 36 Zellen', si60: 'Modul mit 60 Zellen', si72: 'Modul mit 72 Zellen' };
  const FAKTOR_TEXT = {
    wh: 'Du hast Wh und kWh verwechselt: 1 kWh = 1000 Wh.', kwh: 'Du hast Wh und kWh verwechselt: 1 kWh = 1000 Wh.',
    w: 'Du hast W und kW verwechselt: 1 kW = 1000 W.', wp: 'Du hast W und kW verwechselt: 1 kW = 1000 W.',
    v: 'Du hast V und mV (oder kV) verwechselt: 1 V = 1000 mV.', a: 'Du hast A und mA verwechselt: 1 A = 1000 mA.',
    ah: 'Du hast Ah und mAh verwechselt: 1 Ah = 1000 mAh.'
  };
  function modData(id, G, Tc) {
    const P = C.pv;
    if (!P || typeof P.keys !== 'function' || !P.presets || !P.presets[id]) return null;
    const spec = P.presets[id];
    const k = P.keys(spec, { G: G, Tc: Tc });
    if (!k || !k.ok || !isFinite(k.Pmpp) || !isFinite(k.Uoc)) return null;
    return { spec: spec, k: k };
  }
  function exercise(kind, seed) {
    const idx = EX_KINDS.indexOf(kind);
    if (idx < 0) return fail('Unbekannte Übungsart „' + String(kind) + '“. Erlaubt: ' + EX_KINDS.join(', ') + '.');
    const sd = isFinite(num(seed, NaN)) ? Math.floor(num(seed, 1)) : 1;
    const R = rng(sd * 7919 + idx * 104729 + 13);
    const pick = function (a) { return a[Math.floor(R.next() * a.length) % a.length]; };
    let q = '', given = {}, ans = null, steps = [], tables = [], lowHint = '', highHint = '', altNote = '';
    const wrongs = [];
    function ex(value, unit, tol, alt) { ans = { value: value, unit: unit, tol: tol, alt: (alt || []).filter(fin) }; }
    function addWrong(id, v, text) {
      if (!ans || !fin(v)) return;
      const tol2 = 2 * ans.tol;
      const near = function (x, y) { return Math.abs(x - y) <= tol2 * Math.abs(y) + 1e-9; };
      if (near(v, ans.value)) return;
      for (let i = 0; i < ans.alt.length; i++) if (near(v, ans.alt[i])) return;
      for (let i = 0; i < wrongs.length; i++) if (near(v, wrongs[i].v)) return;
      wrongs.push({ id: id, v: v, text: text });
    }
    const f = F_;
    const ex1 = function (id) { const r = f(id).explain.apply(null, Array.prototype.slice.call(arguments, 1)); return r.steps || []; };
    const tab = function (caption, rows, head) { return { caption: caption, head: head || ['Größe', 'Wert'], rows: rows }; };
    const kernFehlt = function () { return fail(TXT.kernFehlt); };
    const kappas = [56, 57, 58, 1 / 0.0178, 1 / 0.0172];

    switch (kind) {
      case 'pel': {
        const u = pick([12, 18, 24, 30, 36]), i = pick([1.5, 2, 3, 4, 5, 8]);
        given = { u: u, i: i };
        q = 'Ein Solarmodul liefert im Punkt maximaler Leistung die Spannung U = ' + N_(u) + ' V bei einem Strom I = ' + N_(i) + ' A. Berechne die Leistung in W.';
        const v = f('leistung').fn(u, i); ex(v, 'W', 0.02); steps = ex1('leistung', u, i);
        addWrong('summe', u + i, 'Du hast U und I addiert. Die Leistung ist das Produkt P = U · I.');
        addWrong('quotient', u / i, 'Du hast U durch I geteilt: Das ist der Widerstand R in Ω, nicht die Leistung.');
        addWrong('kw', v / 1000, 'Du hast in kW gerechnet. Gesucht ist die Leistung in W (1 kW = 1000 W).');
        lowHint = 'Prüfe: P = U · I.'; highHint = lowHint;
        break;
      }
      case 'etaPv': {
        const id = pick(['si36', 'si60', 'si72']), g = pick([200, 400, 500, 800, 1000]);
        const m = modData(id, g, 25); if (!m) return kernFehlt();
        const pm = rd(m.k.Pmpp, 1), a = m.spec.A;
        given = { module: id, g: g, pmpp: pm, a: a };
        tables = [tab('Messung am Übungsmodul (Zelltemperatur 25 °C)', [['Einstrahlung G', N_(g) + ' W/m²'], ['Leistung im MPP', N_(pm) + ' W'], ['Modulfläche A', N_(a) + ' m²']])];
        q = 'Ein ' + MODNAME[id] + ' wird gemessen (Werte in der Tabelle). Berechne den Wirkungsgrad des Moduls in %.';
        const v = f('etaPv').fn(pm, g, a); ex(v * 100, '%', 0.03); steps = ex1('etaPv', pm, g, a);
        addWrong('ohne-a', pm / g * 100, 'Du hast die Modulfläche vergessen: η = Pmpp / (G · A).');
        addWrong('kehrwert', g * a / pm * 100, 'Du hast den Bruch umgedreht. Der Wirkungsgrad ist die Nutzleistung geteilt durch die eingestrahlte Leistung G · A.');
        addWrong('ohne-g', pm / a / 1000 * 100, 'Du hast mit 1000 W/m² gerechnet, die Tabelle nennt aber die gemessene Einstrahlung G.');
        lowHint = 'Prüfe: η = Pmpp / (G · A) mit der eingestrahlten Leistung G · A im Nenner.'; highHint = lowHint;
        break;
      }
      case 'ff': {
        const id = pick(['si36', 'si60', 'si72']), g = pick([400, 600, 800, 1000]);
        const m = modData(id, g, 25); if (!m) return kernFehlt();
        const pm = rd(m.k.Pmpp, 1), uoc = rd(m.k.Uoc, 1), isc = rd(m.k.Isc, 2);
        given = { module: id, g: g, pmpp: pm, uoc: uoc, isc: isc };
        tables = [tab('Übungsmodul (Zelltemperatur 25 °C)', [['Einstrahlung G', N_(g) + ' W/m²'], ['Leistung im MPP', N_(pm) + ' W'], ['Leerlaufspannung Uoc', N_(uoc) + ' V'], ['Kurzschlussstrom Isc', N_(isc) + ' A']])];
        q = 'Für ein ' + MODNAME[id] + ' stehen die Messwerte bei der angegebenen Einstrahlung in der Tabelle. Berechne den Füllfaktor FF (eine Zahl zwischen 0 und 1).';
        const v = f('ff').fn(pm, uoc, isc); ex(v, '', 0.03); steps = ex1('ff', pm, uoc, isc);
        addWrong('produkt', uoc * isc, 'Das ist Uoc · Isc, die theoretische Höchstleistung. Teile Pmpp durch dieses Produkt.');
        addWrong('kehrwert', uoc * isc / pm, 'Du hast den Bruch umgedreht. Der Füllfaktor ist kleiner als 1: Pmpp / (Uoc · Isc).');
        addWrong('prozent', v * 100, 'Der Füllfaktor wird als Zahl zwischen 0 und 1 angegeben, nicht in Prozent.');
        lowHint = 'Prüfe: FF = Pmpp / (Uoc · Isc).'; highHint = lowHint;
        break;
      }
      case 'tempkorr': {
        const id = pick(['si36', 'si60', 'si72']), t = pick([-10, 0, 45, 55, 65, 70]);
        const m = modData(id, 1000, 25), tc = C.pv && typeof C.pv.tempCoeff === 'function' ? C.pv.tempCoeff(m && m.spec) : null;
        if (!m || !tc || !isFinite(tc.gammaP)) return kernFehlt();
        const gpRaw = Math.abs(tc.gammaP) > 0.05 ? tc.gammaP : tc.gammaP * 100;
        const pm = rd(m.k.Pmpp, 0), gp = rd(gpRaw, 2);
        given = { module: id, pstc: pm, gp: gp, t: t };
        tables = [tab('Übungsmodul (Datenblatt)', [['Leistung bei STC', N_(pm) + ' W'], ['Temperaturkoeffizient γP', N_(gp) + ' %/K']])];
        q = 'Ein ' + MODNAME[id] + ' hat die Werte der Tabelle. Berechne die Leistung bei einer Zelltemperatur von ' + N_(t) + ' °C und der Einstrahlung 1000 W/m².';
        const v = f('pTemp').fn(pm, gp, t); ex(v, 'W', 0.02); steps = ex1('pTemp', pm, gp, t);
        addWrong('t-statt-dt', pm * (1 + gp / 100 * t), 'Du hast die Zelltemperatur direkt eingesetzt. Der Koeffizient gilt für die Abweichung von 25 °C: (T − 25 °C).');
        addWrong('vorzeichen', pm * (1 - gp / 100 * (t - 25)), 'Das Vorzeichen stimmt nicht: γP ist negativ, bei Wärme sinkt die Leistung, bei Kälte steigt sie.');
        addWrong('verlust', pm * (-gp / 100 * (t - 25)), 'Das ist die Änderung der Leistung. Gesucht ist die Leistung bei dieser Temperatur: P_STC plus die Änderung.');
        addWrong('prozent', pm * (1 + gp * (t - 25)), 'Du hast γP in %/K nicht durch 100 geteilt: −0,38 %/K sind −0,0038 je K.');
        lowHint = 'Prüfe: P(T) = P_STC · (1 + γP · (T − 25 °C)), γP in %/K durch 100 teilen.'; highHint = lowHint;
        break;
      }
      case 'serie': {
        const id = pick(['si36', 'si60', 'si72']), ns = pick([2, 3, 4, 5, 6, 8, 10]);
        const m = modData(id, 1000, 25); if (!m) return kernFehlt();
        const uoc = rd(m.k.Uoc, 1), isc = rd(m.k.Isc, 2);
        given = { module: id, ns: ns, uoc: uoc, isc: isc };
        tables = [tab('Übungsmodul bei STC', [['Leerlaufspannung Uoc', N_(uoc) + ' V'], ['Kurzschlussstrom Isc', N_(isc) + ' A']])];
        q = ns + ' gleiche Module (Daten in der Tabelle) werden in Reihe geschaltet. Berechne die Leerlaufspannung des Strangs in V.';
        const v = f('serie').fn(ns, uoc); ex(v, 'V', 0.02); steps = ex1('serie', ns, uoc);
        addWrong('einzel', uoc, 'Das ist die Spannung eines einzelnen Moduls. In der Reihenschaltung addieren sich die Spannungen: ns · Uoc.');
        addWrong('strom', ns * isc, 'Du hast den Strom vervielfacht. In der Reihenschaltung bleibt der Strom gleich, nur die Spannungen addieren sich.');
        lowHint = 'Prüfe: Bei Reihenschaltung addieren sich die Spannungen (ns · Uoc).'; highHint = lowHint;
        break;
      }
      case 'parallel': {
        const id = pick(['si36', 'si60', 'si72']), np = pick([2, 3, 4]);
        const m = modData(id, 1000, 25); if (!m) return kernFehlt();
        const uoc = rd(m.k.Uoc, 1), isc = rd(m.k.Isc, 2);
        given = { module: id, np: np, uoc: uoc, isc: isc };
        tables = [tab('Übungsmodul bei STC', [['Leerlaufspannung Uoc', N_(uoc) + ' V'], ['Kurzschlussstrom Isc', N_(isc) + ' A']])];
        q = np + ' gleiche Stränge aus je einem Modul (Daten in der Tabelle) werden parallel geschaltet. Berechne den Kurzschlussstrom des Feldes in A.';
        const v = f('parallel').fn(np, isc); ex(v, 'A', 0.02); steps = ex1('parallel', np, isc);
        addWrong('einzel', isc, 'Das ist der Strom eines einzelnen Strangs. In der Parallelschaltung addieren sich die Ströme: np · Isc.');
        addWrong('spannung', np * uoc, 'Die Spannungen addieren sich nur in Reihenschaltung. In der Parallelschaltung bleibt die Spannung gleich, die Ströme addieren sich.');
        lowHint = 'Prüfe: Bei Parallelschaltung addieren sich die Ströme (np · Isc).'; highHint = lowHint;
        break;
      }
      case 'stringcheck': {
        const id = pick(['si36', 'si60', 'si72']), umax = pick([150, 500, 600, 800, 1000]);
        const cold = modData(id, 1000, -10), stc = modData(id, 1000, 25);
        if (!cold || !stc) return kernFehlt();
        const uk = rd(cold.k.Uoc, 1), us = rd(stc.k.Uoc, 1);
        if (uk > umax) return fail('Interner Fehler: Das Modul passt nicht an den gewählten Eingang.');
        given = { module: id, uocKalt: uk, uocStc: us, umax: umax };
        tables = [tab('Strangauslegung', [['Uoc bei −10 °C', N_(uk) + ' V'], ['Uoc bei 25 °C', N_(us) + ' V'], ['höchste Eingangsspannung des Wechselrichters', N_(umax) + ' V']])];
        q = 'An einen Wechselrichter-Eingang soll ein Strang aus Modulen (' + MODNAME[id] + ') in Reihe. Die Tabelle nennt die Leerlaufspannung je Modul und die Grenze des Eingangs. Wie viele Module dürfen höchstens in Reihe liegen? (Kälte gefährdet den Eingang, der kälteste Wert gilt.)';
        const v = f('stringMax').fn(uk, umax); ex(v, '', 0, []); steps = ex1('stringMax', uk, umax);
        addWrong('stc', Math.floor(umax / us + 1e-9), 'Du hast Uoc bei 25 °C benutzt. Bei Kälte steigt die Leerlaufspannung, deshalb gilt der Wert bei −10 °C.');
        addWrong('aufrunden', Math.ceil(umax / uk - 1e-9), 'Du hast aufgerundet. Bei der Höchstzahl wird abgerundet: Eine Überschreitung der Eingangsspannung zerstört den Wechselrichter.');
        addWrong('nicht-ganz', umax / uk, 'Die Modulzahl muss eine ganze Zahl sein. Runde ab, nicht auf.');
        lowHint = 'Prüfe: Höchstzahl = abrunden(U_max / Uoc bei −10 °C).'; highHint = 'Prüfe: Das Ergebnis darf U_max bei Kälte nicht überschreiten: abrunden(U_max / Uoc bei −10 °C).';
        break;
      }
      case 'batterie': {
        const ed = pick([200, 300, 400, 500, 600, 800, 1000]), tage = pick([2, 3, 4, 5]), usys = pick([12, 24]), chem = pick(['blei', 'lifepo4']);
        const dod = chem === 'blei' ? 50 : 80;
        given = { ed: ed, tage: tage, usys: usys, chem: chem, dod: dod };
        const cn = chem === 'blei' ? 'Blei-Akku (nutzbare Entladetiefe 50 %)' : 'Lithium-Akku (LiFePO4, nutzbare Entladetiefe 80 %)';
        q = 'Ein Verbraucher mit Gleichstrom braucht ' + N_(ed) + ' Wh pro Tag. Die Anlage (Systemspannung ' + N_(usys) + ' V) soll ' + tage + ' Tage ohne Sonne durchhalten, mit einem ' + cn + '. Berechne die nötige Kapazität in Ah.';
        const v = f('batterieKap').fn(ed, tage, usys, dod, 100);
        const alts = [up(SK.akku, v)];
        if (chem === 'lifepo4' && usys === 12) alts.push(f('batterieKap').fn(ed, tage, 12.8, dod, 100));
        ex(v, 'Ah', 0.03, alts); steps = ex1('batterieKap', ed, tage, usys, dod, 100);
        altNote = 'Auch der aufgerundete Normwert' + (alts.length > 1 ? ' und die Rechnung mit 12,8 V Nennspannung' : '') + ' gilt als richtig.';
        addWrong('ohne-dod', ed * tage / usys, 'Du hast die Entladetiefe vergessen: Der Akku darf nur bis zur nutzbaren Entladetiefe entladen werden, also ist die Kapazität größer.');
        addWrong('ohne-tage', ed / (usys * dod / 100), 'Du hast die Autonomietage vergessen: Die Energie muss für alle ' + tage + ' Tage im Akku stehen.');
        addWrong('ohne-usys', ed * tage / (dod / 100), 'Das ist die Energie in Wh. Teile durch die Systemspannung, um die Kapazität in Ah zu erhalten.');
        addWrong('kwh', v / 1000, 'Das ist die Energie in kWh geteilt durch V. Gesucht ist die Kapazität in Ah.');
        lowHint = 'Prüfe: C = E_d · Tage / (Usys · DoD), DoD als Anteil (z. B. 0,5).'; highHint = lowHint;
        break;
      }
      case 'autonomie': {
        let ed, c, usys, chem, eta, tage;
        for (let tries = 0; tries < 50; tries++) {
          ed = pick([200, 300, 400, 500, 600, 800, 1000]); c = pick([100, 120, 150, 200]); usys = pick([12, 24]); chem = pick(['blei', 'lifepo4']); eta = pick([100, 90]);
          tage = f('autonomie').fn(c, usys, chem === 'blei' ? 50 : 80, eta, ed);
          if (tage >= 0.5 && tage <= 10) break;
        }
        const dod = chem === 'blei' ? 50 : 80;
        given = { ed: ed, c: c, usys: usys, chem: chem, dod: dod, eta: eta };
        const cn = chem === 'blei' ? 'ein Blei-Akku (nutzbare Entladetiefe 50 %)' : 'ein Lithium-Akku (LiFePO4, nutzbare Entladetiefe 80 %)';
        q = 'Es ist ' + cn + ' mit ' + N_(c) + ' Ah bei ' + N_(usys) + ' V eingebaut. Der Verbrauch beträgt ' + N_(ed) + ' Wh pro Tag' + (eta < 100 ? ' (Wechselstromlast, Wirkungsgrad des Wechselrichters ' + N_(eta) + ' %)' : ' (Gleichstromlast)') + '. Wie viele Tage hält der Akku ohne Sonne durch?';
        const v = f('autonomie').fn(c, usys, dod, eta, ed); ex(v, 'Tage', 0.03); steps = ex1('autonomie', c, usys, dod, eta, ed);
        addWrong('ohne-dod', c * usys * (eta / 100) / ed, 'Du hast die Entladetiefe vergessen: Es darf nur der nutzbare Teil der Kapazität entnommen werden.');
        if (eta < 100) addWrong('ohne-eta', c * usys * (dod / 100) / ed, 'Du hast den Wirkungsgrad des Wechselrichters vergessen: Er verbraucht einen Teil der Energie.');
        addWrong('ohne-usys', c * (dod / 100) * (eta / 100) / ed, 'Ah und Wh passen nicht zusammen: C · Usys ergibt die gespeicherte Energie in Wh.');
        lowHint = 'Prüfe: Tage = C · Usys · DoD · η / E_d.'; highHint = lowHint;
        break;
      }
      case 'crate': {
        const c = pick([50, 100, 120, 200]), rate = pick([0.05, 0.1, 0.2, 0.25, 0.5, 1]), i = rd(rate * c, 2);
        given = { i: i, c: c };
        q = 'Ein Akku mit ' + N_(c) + ' Ah wird mit ' + N_(i) + ' A geladen. Berechne die C-Rate (Vielfaches von C, Einheit 1/h).';
        const v = f('crate').fn(i, c); ex(v, 'C', 0.03); steps = ex1('crate', i, c);
        addWrong('kehrwert', c / i, 'Das ist der Kehrwert: die Zeit in h, in der der Akku bei diesem Strom leer wäre. Die C-Rate ist I / C.');
        addWrong('prozent', v * 100, 'Die C-Rate wird nicht in Prozent angegeben, sondern als Vielfaches von C.');
        addWrong('produkt', i * c, 'Du hast I und C multipliziert. Die C-Rate ist der Quotient I / C.');
        lowHint = 'Prüfe: C-Rate = I / C.'; highHint = lowHint;
        break;
      }
      case 'ladezeit': {
        const c = pick([50, 100, 120, 200]), dsoc = pick([50, 60, 70, 80]), eta = pick([90, 95]), i = pick([5, 10, 12, 20]);
        given = { c: c, dsoc: dsoc, eta: eta, i: i };
        q = 'Ein Akku mit ' + N_(c) + ' Ah soll von ' + N_(100 - dsoc) + ' % auf 100 % Ladezustand geladen werden. Der Ladestrom beträgt ' + N_(i) + ' A, der Ladewirkungsgrad ' + N_(eta) + ' %. Berechne die Ladezeit in h (Näherung mit gleichbleibendem Strom).';
        const v = f('ladezeit').fn(c, dsoc, eta, i); ex(v, 'h', 0.03); steps = ex1('ladezeit', c, dsoc, eta, i);
        addWrong('ohne-eta', c * dsoc / 100 / i, 'Du hast den Ladewirkungsgrad vergessen: Nicht jeder Ladestrom wird gespeichert, es dauert länger.');
        addWrong('ohne-dsoc', c / ((eta / 100) * i), 'Du hast die ganze Kapazität geladen. Es fehlt nur der Teil ΔSoC.');
        addWrong('minuten', v * 60, 'Du hast in Minuten gerechnet. Gesucht ist die Zeit in Stunden.');
        lowHint = 'Prüfe: t ≈ C · ΔSoC / (η · I) mit ΔSoC und η als Anteil.'; highHint = lowHint;
        break;
      }
      case 'kabel': {
        const l = pick([2, 3, 4, 5, 6, 8, 10]), i = pick([8, 10, 12, 15, 20, 25, 30]), usys = pick([12, 24]), du = rd(0.02 * usys, 2);
        given = { l: l, i: i, usys: usys, du: du, kappa: 56 };
        q = 'Ein Verbraucher mit ' + N_(i) + ' A hängt in einer Anlage mit ' + N_(usys) + ' V an einer Leitung mit der einfachen Länge ' + N_(l) + ' m (Hin- und Rückleitung aus Kupfer). Der Spannungsfall darf 2 % betragen (' + N_(du) + ' V). Berechne den erforderlichen Querschnitt in mm² (κ = 56 m/(Ω·mm²), Tabellenbuch: ρ = 0,0178 Ω·mm²/m).';
        const v = f('querschnitt').fn(l, i, du, 56);
        const alts = kappas.slice(1).map(function (k) { return f('querschnitt').fn(l, i, du, k); }).concat([up(SK.querschnitte, v)]);
        ex(v, 'mm²', 0.03, alts); steps = ex1('querschnitt', l, i, du, 56);
        altNote = 'Auch Rechnungen mit κ = 57 oder 58 (bzw. ρ = 0,0178 oder 0,0172 Ω·mm²/m) und der aufgerundete Normquerschnitt gelten als richtig.';
        addWrong('einfach', l * i / (56 * du), 'Du hast die Leitungslänge nicht verdoppelt: Der Strom fließt hin und zurück, also gilt 2 · L.');
        addWrong('zwei-volt', 2 * l * i / (56 * 2), 'Du hast mit 2 V Spannungsfall gerechnet. Zulässig sind 2 % der Systemspannung, hier ' + N_(du) + ' V.');
        const dn = down(SK.querschnitte, v);
        addWrong('abgerundet', dn, 'Normquerschnitte werden aufgerundet. Sonst wird der Spannungsfall größer als zulässig.');
        lowHint = 'Prüfe: A_min = 2 · L · I / (κ · ΔU) mit der einfachen Länge L.'; highHint = lowHint;
        break;
      }
      case 'verlust': {
        const l = pick([2, 3, 4, 5, 6, 8, 10]), i = pick([8, 10, 12, 15, 20, 25]), a = pick([2.5, 4, 6, 10]);
        given = { l: l, i: i, a: a, kappa: 56 };
        q = 'Eine Kupferleitung (einfache Länge ' + N_(l) + ' m, Querschnitt ' + N_(a) + ' mm²) führt ' + N_(i) + ' A. Berechne die Verlustleistung der Leitung in W (κ = 56 m/(Ω·mm²)).';
        const v = f('leitungsverlust').fn(i, l, a, 56);
        const alts = kappas.slice(1).map(function (k) { return f('leitungsverlust').fn(i, l, a, k); });
        ex(v, 'W', 0.03, alts); steps = ex1('leitungsverlust', i, l, a, 56);
        altNote = 'Auch Rechnungen mit κ = 57 oder 58 (bzw. ρ = 0,0178 oder 0,0172 Ω·mm²/m) gelten als richtig.';
        addWrong('einfach', i * i * l / (56 * a), 'Du hast die Leitungslänge nicht verdoppelt: Der Strom fließt hin und zurück, also gilt 2 · L.');
        addWrong('spannungsfall', 2 * l * i / (56 * a), 'Das ist der Spannungsfall ΔU in V. Multipliziere ihn mit dem Strom: P_V = ΔU · I = I² · R.');
        lowHint = 'Prüfe: P_V = I² · R mit R = 2 · L / (κ · A).'; highHint = lowHint;
        break;
      }
      case 'euroeta': {
        const model = pick(['standard', 'einfach', 'insel']), P = C.inv;
        if (!P || typeof P.eta !== 'function') return kernFehlt();
        const e = SK.euro.p.map(function (p) { return rd(P.eta(model, p) * 100, 1); });
        if (!e.every(fin)) return kernFehlt();
        given = { model: model, eta: e };
        tables = [tab('Wirkungsgrad des Wechselrichters', SK.euro.p.map(function (p, k) { return [N_(p * 100) + ' % der Nennleistung', N_(e[k]) + ' %']; }), ['Last', 'Wirkungsgrad η'])];
        q = 'Für einen Netzwechselrichter sind sechs Wirkungsgrade gemessen (Tabelle). Berechne den Europäischen Wirkungsgrad in % mit den Gewichten 0,03; 0,06; 0,13; 0,10; 0,48; 0,20 (für 5, 10, 20, 30, 50, 100 % Last).';
        const v = f('euroEta').fn(e[0], e[1], e[2], e[3], e[4], e[5]);
        const exact = typeof P.euroEta === 'function' ? P.euroEta(model) : NaN;
        ex(v * 100, '%', 0.003, [exact * 100]); steps = ex1('euroEta', e[0], e[1], e[2], e[3], e[4], e[5]);
        altNote = 'Der Wert aus dem Modell (ohne Rundung der Tabellenwerte) gilt ebenfalls als richtig.';
        addWrong('mittelwert', e.reduce(function (s, x) { return s + x; }, 0) / 6, 'Du hast den einfachen Mittelwert gebildet. Die Lastpunkte werden unterschiedlich gewichtet (0,48 bei 50 % Last).');
        addWrong('nur-50', e[4], 'Du hast nur den Wert bei 50 % Last benutzt. Der Europäische Wirkungsgrad gewichtet alle sechs Lastpunkte.');
        addWrong('summe-gewichte', e[0] * 0.03 + e[1] * 0.06 + e[2] * 0.13 + e[3] * 0.10 + e[4] * 0.48, 'Du hast den Lastpunkt 100 % vergessen (Gewicht 0,20).');
        lowHint = 'Prüfe: η_Euro = 0,03·η5 + 0,06·η10 + 0,13·η20 + 0,10·η30 + 0,48·η50 + 0,20·η100.'; highHint = lowHint;
        break;
      }
      case 'ertrag': {
        const kwp = pick([3, 5, 8, 10]), h = 1000, pr = pick([0.75, 0.8, 0.85]);
        given = { kwp: kwp, h: h, pr: pr };
        q = 'Eine Anlage hat ' + N_(kwp) + ' kWp. Nimm eine Einstrahlung von H = ' + N_(h) + ' kWh/(m²·a) und eine Performance Ratio von ' + N_(pr) + ' an (Annahmewerte, bitte aktualisieren). Berechne den Jahresertrag in kWh.';
        const v = f('ertrag').fn(kwp, h, pr); ex(v, 'kWh', 0.02); steps = ex1('ertrag', kwp, h, pr);
        addWrong('ohne-pr', kwp * h, 'Du hast die Performance Ratio vergessen: Verluste (Temperatur, Leitungen, Wechselrichter) mindern den Ertrag.');
        addWrong('mwh', v / 1000, 'Du hast in MWh gerechnet. Gesucht ist der Ertrag in kWh.');
        lowHint = 'Prüfe: E_a = P_peak · H · PR.'; highHint = lowHint;
        break;
      }
      case 'amorti': {
        const invest = pick([6000, 8000, 10000, 12000, 15000]), eigen = pick([1500, 2000, 2500, 3000]), einsp = pick([1500, 2000, 2500, 3000]), bezug = 0.35, verg = 0.08;
        given = { invest: invest, eigen: eigen, einsp: einsp, bezug: bezug, verg: verg };
        q = 'Eine Anlage kostet ' + N_(invest) + ' €. Die Anlage liefert ' + N_(eigen) + ' kWh pro Jahr für den Eigenverbrauch (Bezugspreis ' + N_(bezug) + ' €/kWh) und speist ' + N_(einsp) + ' kWh pro Jahr ein (Vergütung ' + N_(verg) + ' €/kWh). Preise sind Annahmen, bitte aktualisieren. Berechne die Amortisationszeit in Jahren (ohne Zins und Alterung).';
        const v = f('amortisation').fn(invest, eigen, bezug, einsp, verg); ex(v, 'Jahre', 0.03); steps = ex1('amortisation', invest, eigen, bezug, einsp, verg);
        addWrong('ohne-einsp', invest / (eigen * bezug), 'Du hast die Einspeisevergütung vergessen: Auch die eingespeiste Energie bringt Geld.');
        addWrong('alles-bezug', invest / ((eigen + einsp) * bezug), 'Du hast die eingespeiste Energie mit dem Bezugspreis bewertet. Dafür gibt es nur die Vergütung.');
        addWrong('monate', v * 12, 'Du hast in Monaten gerechnet. Gesucht ist die Zeit in Jahren.');
        lowHint = 'Prüfe: t = Invest / (E_eigen · Bezugspreis + E_einsp · Vergütung).'; highHint = lowHint;
        break;
      }
      case 'sonnenhoehe': {
        const phi = pick([37.4, 48, 51.7, 60]), tag = pick([['21. Juni', 23.45], ['21. Dezember', -23.45], ['21. März', 0]]);
        given = { phi: phi, delta: tag[1] };
        q = 'Berechne die höchste Sonnenhöhe (am Mittag der Sonnenzeit) am ' + tag[0] + ' bei einem Breitengrad von φ = ' + N_(phi) + '°. Die Deklination der Sonne beträgt an diesem Tag δ = ' + N_(tag[1]) + '°.';
        const v = f('sonnenhoehe').fn(phi, tag[1]);
        const alt = tag[1] === 0 ? [] : [90 - phi + Math.sign(tag[1]) * 23.5];
        ex(v, '°', 0.02, alt); steps = ex1('sonnenhoehe', phi, tag[1]);
        altNote = tag[1] === 0 ? '' : 'Auch die Rechnung mit δ = ' + N_(Math.sign(tag[1]) * 23.5) + '° gilt als richtig.';
        addWrong('vorzeichen', 90 - phi - tag[1], 'Das Vorzeichen von δ stimmt nicht: Im Sommer (δ positiv) steht die Sonne höher, im Winter (δ negativ) tiefer.');
        addWrong('ohne-delta', 90 - phi, 'Du hast die Deklination vergessen. Die Deklination hebt (Sommer) oder senkt (Winter) die Mittagshöhe um bis zu 23,45°.');
        addWrong('phi-minus', phi - tag[1], 'Du hast den Breitengrad statt des Winkels zum Zenit benutzt: Die Sonnenhöhe ist 90° − φ + δ.');
        lowHint = 'Prüfe: α_max = 90° − φ + δ.'; highHint = lowHint;
        break;
      }
      case 'abstand': {
        const l = pick([1.65, 1.95]), beta = pick([25, 30, 35]), alt = pick([14.85, 17, 20]);
        given = { l: l, beta: beta, alt: alt };
        q = 'Modulreihen (Modullänge ' + N_(l) + ' m entlang der Neigung) stehen mit der Neigung ' + N_(beta) + '° hintereinander. Zur Mittagszeit des kürzesten Tages steht die Sonne ' + N_(alt) + '° hoch. Berechne den Mindestabstand von Unterkante zu Unterkante in m, damit keine Reihe die nächste verschattet.';
        const v = f('reihenabstand').fn(l, beta, alt); ex(v, 'm', 0.03); steps = ex1('reihenabstand', l, beta, alt);
        const rad = Math.PI / 180;
        addWrong('schatten', l * Math.sin(beta * rad) / Math.tan(alt * rad), 'Das ist nur die Länge des Schattens. Addiere die waagerechte Grundfläche des Moduls l · cos β.');
        addWrong('nur-flaeche', l * Math.cos(beta * rad), 'Das ist nur die waagerechte Grundfläche des Moduls. Es fehlt der Schatten l · sin β / tan α.');
        addWrong('tan-vertauscht', l * Math.cos(beta * rad) + l * Math.sin(beta * rad) * Math.tan(alt * rad), 'Du hast mit tan α multipliziert statt zu teilen: Je flacher die Sonne steht, desto länger ist der Schatten.');
        lowHint = 'Prüfe: d = l · cos β + l · sin β / tan α.'; highHint = lowHint;
        break;
      }
      case 'pvbedarf': {
        const ed = pick([200, 300, 500, 600, 800, 1000, 1500]), psh = pick([1, 1.5, 2, 3, 4, 5]), pr = pick([0.6, 0.65, 0.7]);
        given = { ed: ed, psh: psh, pr: pr };
        q = 'Eine Inselanlage braucht ' + N_(ed) + ' Wh pro Tag. Am Auslegungstag gibt es ' + N_(psh) + ' Sonnenstunden (Volllaststunden), die Performance Ratio beträgt ' + N_(pr) + '. Berechne die erforderliche Modulleistung in W.';
        const v = f('pvBedarf').fn(ed, psh, pr); ex(v, 'W', 0.03); steps = ex1('pvBedarf', ed, psh, pr);
        addWrong('ohne-pr', ed / psh, 'Du hast die Performance Ratio vergessen: Leitungen, Regler, Wärme und Akku kosten Energie, die Anlage muss größer sein.');
        addWrong('ohne-psh', ed / pr, 'Du hast nicht durch die Sonnenstunden geteilt: Das Modul liefert seine Nennleistung nur während dieser Volllaststunden.');
        addWrong('kw', v / 1000, 'Du hast in kW gerechnet. Gesucht ist die Leistung in W.');
        lowHint = 'Prüfe: P_pv = E_d / (PSH · PR).'; highHint = lowHint;
        break;
      }
    }

    /* Einheitenverwechslungen (Faktor 1000) und Prozent: allgemeine Fehlerhinweise */
    const U = parseUnit(ans.unit);
    if (U && FAKTOR_TEXT[U.base]) {
      addWrong('faktor-gross', ans.value * 1000, FAKTOR_TEXT[U.base]);
      addWrong('faktor-klein', ans.value / 1000, FAKTOR_TEXT[U.base]);
    }
    if (ans.unit === '%') addWrong('als-anteil', ans.value / 100, 'Gib das Ergebnis in Prozent an: ' + N_(ans.value / 100) + ' entspricht ' + N_(ans.value) + ' %.');

    const value = ans.value, tol = ans.tol, alts = ans.alt, unit = ans.unit;
    function uText(u) { return u ? ' ' + u : ''; }
    function matches(v, c) { return Math.abs(v - c) <= tol * Math.abs(c) + 1e-12; }
    function evalInput(input) {
      const v0 = parseNum(input);
      if (!isFinite(v0)) return NaN;
      const ui = unitOf(typeof input === 'string' ? input : ''), ue = parseUnit(unit);
      if (ui && ue && ui.base === ue.base) return v0 * ui.f / ue.f;
      return v0;
    }
    function diag(input) {
      const v = evalInput(input);
      if (!isFinite(v)) return { ok: false, id: 'keine-zahl', hint: TXT.keineZahl };
      if (matches(v, value)) return { ok: true, id: 'richtig', hint: '' };
      for (let i = 0; i < alts.length; i++) if (matches(v, alts[i])) return { ok: true, id: 'alt', hint: '' };
      for (let i = 0; i < wrongs.length; i++) if (matches(v, wrongs[i].v)) return { ok: false, id: wrongs[i].id, hint: wrongs[i].text };
      return { ok: false, id: v < value ? 'zu-klein' : 'zu-gross', hint: v < value ? lowHint : highHint };
    }
    function check(input) {
      try {
        const v = evalInput(input);
        if (!isFinite(v)) return { ok: false, text: TXT.keineZahl };
        const d = diag(input);
        if (d.ok) return { ok: true, text: 'Richtig: ' + fmt(value) + uText(unit) + '.' + (d.id === 'alt' && altNote ? ' ' + altNote : '') };
        const small = v < value;
        let text = small ? TXT.zuKlein : TXT.zuGross;
        if (tol > 0) { const lo = value * (1 - tol), hi = value * (1 + tol); text = small ? 'Dein Wert ist zu klein (' + fmt(v) + ' < ' + fmt(Math.min(lo, hi)) + ').' : 'Dein Wert ist zu groß (' + fmt(v) + ' > ' + fmt(Math.max(lo, hi)) + ').'; }
        return { ok: false, text: text + (d.hint ? ' ' + d.hint : '') };
      } catch (e) { return { ok: false, text: TXT.keineZahl }; }
    }
    const res = { ok: true, kind: kind, seed: sd, question: q, given: given, table: tables, answer: ans, steps: steps, check: check, diagnose: function (inp) { try { return diag(inp); } catch (e) { return { ok: false, id: 'keine-zahl', hint: TXT.keineZahl }; } } };
    hide(res, 'wrongs', wrongs);
    return res;
  }
  const exerciseG = S(exercise);
  exerciseG.kinds = EX_KINDS.slice();

  calc.formulas = formulas;
  calc.exercise = exerciseG;
  calc.skal = skal;
  calc.version = '1.0';
  C.calc = calc;
  if (typeof module !== 'undefined') module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
