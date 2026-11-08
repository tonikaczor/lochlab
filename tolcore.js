'use strict';
/* Tonfunk Toleranz-Lab: reine Logik (ohne Oberfläche, auch per Node testbar).
   Inhalt: Noniusablesung (Messschieber 1/10, 1/20, 1/50), Mikrometer-Ablesung (Bügelmessschraube 0,01 mm, 25-mm-Bereiche),
   Abmaße/Höchst-/Mindestmaß/Toleranz, Gut-Nacharbeit-Ausschuss, ISO-Passungen (Einheitsbohrung, Tabelle in toldata.js),
   Zufallsaufgaben (seed-fähig) und Antwortprüfung.
   Rechnung intern mit ganzen Zahlen (Einheit 0,1 µm = 1e-4 mm), damit keine Gleitkommafehler die Grenzfälle verfälschen.
   Export: window.TOL_CORE bzw. module.exports (Node). */
(function (root) {
  const fin = v => typeof v === 'number' && isFinite(v);
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };

  /* ---------------- Zahlen deutsch ---------------- */
  /* "23,35", "23.35 mm", " 0,5" -> Zahl; sonst NaN. Einheit mm/µm/um am Ende wird ignoriert. */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(mm|µm|um)$/i, '').replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  /* Zahl -> deutscher Text mit dec Nachkommastellen (feste Anzahl); optional Vorzeichen */
  function fmtDe(v, dec, sign) {
    if (!fin(v)) return '–';
    let s = rd(v, dec == null ? 2 : dec).toFixed(dec == null ? 2 : dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    if (sign && v > 0) s = '+' + s;
    return s.replace('-', '−').replace('.', ',');
  }

  /* ---------------- Zufall (seed-fähig) ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  /* Liefert eine Funktion () => Zahl in [0,1). Gleicher Seed = gleiche Folge. */
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));

  /* ---------------- Messschieber (Nonius) ---------------- */
  /* den = Schritte je mm (10, 20, 50); span = Länge des Nonius in mm; n = Anzahl Noniusabschnitte.
     1/10: 10 Teile auf 9 mm; 1/20: 20 Teile auf 39 mm (Teilung 1,95 mm); 1/50: 50 Teile auf 49 mm (Teilung 0,98 mm). */
  const NONIUS = {
    10: { den: 10, r: 0.1, span: 9, n: 10, name: '1/10', rtext: '0,1 mm' },
    20: { den: 20, r: 0.05, span: 39, n: 20, name: '1/20', rtext: '0,05 mm' },
    50: { den: 50, r: 0.02, span: 49, n: 50, name: '1/50', rtext: '0,02 mm' }
  };
  const CALIPER_MAX = 150;   /* Messbereich des virtuellen Messschiebers in mm */
  const noniusOf = den => NONIUS[den] || null;

  /* Messwert -> ganze Teilstriche (Einheiten zu 1/den mm) */
  function caliperUnits(v, den) { return Math.round(v * den + 1e-9); }
  /* Ablesung: Hauptskala (volle mm links vom Nullstrich) + Noniusstrich, der sich mit einem Hauptstrich deckt. */
  function readCaliper(v, den) {
    const N = NONIUS[den]; if (!N || !fin(v) || v < 0 || v > CALIPER_MAX + 1e-9) return null;
    const k = caliperUnits(v, den), main = Math.floor(k / den), mark = k % den;
    return { t: 'caliper', den, r: N.r, k, main, mark, vernier: rd(mark / den, 4), value: rd(k / den, 4) };
  }
  /* Rein geometrisch: welcher Noniusstrich deckt sich am besten mit einem Hauptskalenstrich? (Gegenprobe zur Ablesung) */
  function coincidentMark(v, den) {
    const N = NONIUS[den]; if (!N) return -1; const sp = N.span / N.n; let best = -1, bd = 9;
    for (let i = 0; i <= N.n; i++) { const p = v + i * sp, d = Math.abs(p - Math.round(p)); if (d < bd - 1e-9) { bd = d; best = i; } }
    return best;
  }

  /* ---------------- Bügelmessschraube ---------------- */
  /* Spindelsteigung 0,5 mm, Trommel 50 Teilstriche zu 0,01 mm. Messbereiche 0-25, 25-50, 50-75, 75-100 mm (Basis 0, 25, 50, 75). */
  const MICRO_BASES = [0, 25, 50, 75];
  /* base optional: erzwingt den Messbereich (z. B. 25,00 mm im Bereich 0-25 oder 25-50). */
  function readMicrometer(v, base) {
    if (!fin(v) || v < 0 || v > 100 + 1e-9) return null;
    const k = Math.round(v * 100 + 1e-9);
    if (base == null) base = Math.min(75, Math.floor(k / 2500) * 25);
    if (MICRO_BASES.indexOf(base) < 0) return null;
    const rk = k - base * 100; if (rk < 0 || rk > 2500) return null;
    const sleeve = Math.floor(rk / 100), rem = rk % 100, halfK = rem >= 50 ? 50 : 0, thimble = rem - halfK;
    return { t: 'micro', base, r: 0.01, k, sleeve, half: halfK / 100, thimble, sleeveTotal: rd(base + sleeve + halfK / 100, 2), value: rd(k / 100, 2) };
  }

  /* ---------------- Ablesung allgemein ---------------- */
  /* inst = {t:'caliper', den, v} | {t:'micro', base, v} */
  function reading(inst) {
    if (!inst) return null;
    return inst.t === 'caliper' ? readCaliper(inst.v, inst.den) : inst.t === 'micro' ? readMicrometer(inst.v, inst.base) : null;
  }
  const truth = inst => { const r = reading(inst); return r ? r.value : NaN; };
  const tolOf = inst => inst.t === 'caliper' ? (NONIUS[inst.den] || { r: NaN }).r : 0.01;   /* ±1 Teilstrich */
  /* Prüfung: |Antwort − Wahrheit| <= 1 Teilstrich (mit kleiner Rechenreserve) */
  function checkReading(inst, answer) {
    const a = parseDe(answer), t = truth(inst), tol = tolOf(inst);
    if (!fin(a)) return { ok: false, exact: false, empty: true, truth: t, tol, diff: NaN };
    const diff = rd(a - t, 4);
    return { ok: Math.abs(diff) <= tol + 1e-9, exact: Math.abs(diff) < 1e-9, empty: false, truth: t, tol, diff };
  }
  /* Rechenweg als Text (deutsch) */
  function describe(inst) {
    const r = reading(inst); if (!r) return '';
    if (r.t === 'caliper') {
      const N = NONIUS[r.den];
      return 'Hauptskala: ' + r.main + ' mm (letzter Strich links vom Nullstrich des Nonius). Nonius: Strich ' + r.mark + ' deckt sich mit einem Hauptstrich, also ' + r.mark + ' × ' + N.rtext + ' = ' + fmtDe(r.vernier, 2) + ' mm. Messwert: ' + fmtDe(r.value, 2) + ' mm.';
    }
    return 'Messbereich ' + r.base + '–' + (r.base + 25) + ' mm: Hülse zeigt ' + fmtDe(r.sleeveTotal, 2) + ' mm' + (r.half ? ' (der Halbmillimeterstrich ist sichtbar)' : ' (der Halbmillimeterstrich ist noch verdeckt)') + ', Trommel ' + r.thimble + ' × 0,01 = ' + fmtDe(r.thimble / 100, 2) + ' mm. Messwert: ' + fmtDe(r.value, 2) + ' mm.';
  }

  /* ---------------- Zufallsaufgaben ---------------- */
  /* opts: {kind:'caliper'|'micro'|'mixed', level:1..3}. Stufe 1: Nonius 1/10 und Bereich 0-25; 2: 1/20 und 0-50; 3: 1/50, alle Bereiche, gezielt Fallen
     (Nonius-Strich nahe am nächsten mm, Halbmillimeter mit Trommel 0 oder 49). */
  function genReading(R, opts) {
    opts = opts || {}; const lvl = Math.max(1, Math.min(3, opts.level | 0 || 1));
    let kind = opts.kind || 'mixed'; if (kind === 'mixed') kind = R() < 0.5 ? 'caliper' : 'micro';
    if (kind === 'caliper') {
      const den = lvl === 1 ? 10 : lvl === 2 ? 20 : (R() < 0.3 ? 20 : 50);
      const maxMm = lvl === 1 ? 60 : lvl === 2 ? 100 : 150;
      let k = ri(R, 1, maxMm * den - 1);
      if (lvl === 3 && R() < 0.3) k = ri(R, 1, maxMm - 1) * den + (R() < 0.5 ? den - 1 : 0);   /* Falle: Strich ganz am Anfang oder Ende */
      return { t: 'caliper', den, v: rd(k / den, 4) };
    }
    const bases = lvl === 1 ? [0] : lvl === 2 ? [0, 25] : [0, 25, 50, 75];
    const base = bases[ri(R, 0, bases.length - 1)];
    let rk = ri(R, 1, 2499);
    if (lvl === 3 && R() < 0.35) { const mm = ri(R, 0, 24), pick = R(); rk = mm * 100 + (pick < 0.34 ? 50 : pick < 0.67 ? 49 : 99); }   /* Falle: 0,50 / 0,49 / 0,99 */
    return { t: 'micro', base, v: rd(base + rk / 100, 2) };
  }

  /* ---------------- Abmaße, Höchst-/Mindestmaß, Toleranz ---------------- */
  const U = x => Math.round(x * 10000 + (x < 0 ? -1e-6 : 1e-6));   /* mm -> 0,1 µm (ganzzahlig) */
  const UU = x => Math.round(x * 10 + (x < 0 ? -1e-6 : 1e-6));     /* µm -> 0,1 µm */
  const mm = u => u / 10000, um = u => u / 10;
  /* Nennmaß in mm, Abmaße in mm oder µm (unit 'mm' | 'um'). Gibt Fehler zurück, wenn unterer > oberer Abmaß. */
  function dimensions(N, ES, EI, unit) {
    if (!fin(N) || !fin(ES) || !fin(EI)) return { ok: false, error: 'Bitte alle drei Zahlen eingeben.' };
    if (N <= 0) return { ok: false, error: 'Das Nennmaß muss größer als 0 sein.' };
    const f = unit === 'um' ? UU : U, n = U(N), es = f(ES), ei = f(EI);
    if (es < ei) return { ok: false, error: 'Das obere Abmaß darf nicht kleiner sein als das untere.' };
    const go = n + es, gu = n + ei;
    return { ok: true, nU: n, esU: es, eiU: ei, goU: go, guU: gu, tU: es - ei,
      N: mm(n), ES_um: um(es), EI_um: um(ei), Go: mm(go), Gu: mm(gu), T: mm(es - ei), T_um: um(es - ei), C: mm((go + gu) / 2) };
  }
  /* Welle: zu groß = Nacharbeit (abtragen), zu klein = Ausschuss. Bohrung: zu klein = Nacharbeit (aufbohren), zu groß = Ausschuss. */
  function classify(part, measured, dim) {
    if (!dim || !dim.ok || !fin(measured)) return null;
    const m = U(measured), welle = part !== 'bohrung';
    if (m > dim.goU) return { state: welle ? 'nacharbeit' : 'ausschuss', side: 'ueber', mU: m, dev_um: um(m - dim.goU) };
    if (m < dim.guU) return { state: welle ? 'ausschuss' : 'nacharbeit', side: 'unter', mU: m, dev_um: um(dim.guU - m) };
    return { state: 'gut', side: null, mU: m, dev_um: 0 };
  }
  const STATE_TEXT = { gut: 'Gut', nacharbeit: 'Nacharbeit', ausschuss: 'Ausschuss' };

  /* ---------------- ISO-Passungen (Einheitsbohrung) ---------------- */
  function iso() {
    if (root.TOL_ISO) return root.TOL_ISO;
    if (typeof require === 'function') { try { return require('./toldata.js').ISO; } catch (e) { /* weiter */ } }
    throw new Error('toldata.js (ISO-Tabelle) fehlt');
  }
  /* Nennmaßbereich >6–10, >10–18, >18–30, >30–50 (Obergrenze eingeschlossen): Index oder -1 */
  function rangeIndex(N) {
    if (!fin(N)) return -1; const R = iso().ranges;
    for (let i = 0; i < R.length; i++) if (N > R[i][0] && N <= R[i][1]) return i;
    return -1;
  }
  const rangeLabel = i => { const r = iso().ranges[i]; return r ? '>' + r[0] + ' bis ' + r[1] + ' mm' : ''; };
  /* 'H7' -> {ES, EI} in µm; null bei unbekanntem Code oder Nennmaß außerhalb */
  function holeDev(code, N) {
    const i = rangeIndex(N), m = /^H(\d+)$/.exec(String(code)); if (i < 0 || !m) return null;
    const it = iso().IT[m[1]]; if (!it) return null;
    return { code: String(code), ES: it[i], EI: 0, IT: it[i] };
  }
  /* 'f7' -> {es, ei} in µm */
  function shaftDev(code, N) {
    const i = rangeIndex(N), D = iso().shafts[code]; if (i < 0 || !D) return null;
    return { code: String(code), es: D.es[i], ei: D.ei[i], IT: D.es[i] - D.ei[i] };
  }
  /* Passung: Höchstspiel P_so = ES − ei, Mindestspiel P_su = EI − es (µm).
     Spielpassung: P_su >= 0; Übermaßpassung (Press): P_so <= 0; sonst Übergangspassung. */
  function fitArt(Pso, Psu) { return Psu >= 0 ? 'spiel' : Pso <= 0 ? 'press' : 'uebergang'; }
  const ART_TEXT = { spiel: 'Spielpassung', uebergang: 'Übergangspassung', press: 'Übermaßpassung (Presspassung)' };
  function fit(holeCode, shaftCode, N) {
    const h = holeDev(holeCode, N), s = shaftDev(shaftCode, N); if (!h || !s) return null;
    const Pso = h.ES - s.ei, Psu = h.EI - s.es, art = fitArt(Pso, Psu), n10 = U(N);
    return {
      N, range: rangeIndex(N), hole: h, shaft: s, Pso, Psu, art, artText: ART_TEXT[art],
      Ueo: -Psu, Ueu: -Pso,   /* Höchstübermaß = es − EI, Mindestübermaß = ei − ES */
      holeGo: mm(n10 + h.ES * 10), holeGu: mm(n10 + h.EI * 10), shaftGo: mm(n10 + s.es * 10), shaftGu: mm(n10 + s.ei * 10),
      code: holeCode + '/' + shaftCode
    };
  }
  /* Wertepaare für die Anzeige: [Beschriftung, Zahl µm] je nach Passungsart */
  function fitLines(f) {
    if (!f) return [];
    if (f.art === 'spiel') return [['Höchstspiel', f.Pso], ['Mindestspiel', f.Psu]];
    if (f.art === 'press') return [['Höchstübermaß', f.Ueo], ['Mindestübermaß', f.Ueu]];
    return [['Höchstspiel', f.Pso], ['Höchstübermaß', f.Ueo]];
  }

  const api = {
    parseDe, fmtDe, rng, hashStr, NONIUS, noniusOf, CALIPER_MAX, MICRO_BASES,
    caliperUnits, readCaliper, coincidentMark, readMicrometer, reading, truth, tolOf, checkReading, describe, genReading,
    dimensions, classify, STATE_TEXT, rangeIndex, rangeLabel, holeDev, shaftDev, fitArt, fit, fitLines, ART_TEXT
  };
  root.TOL_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
