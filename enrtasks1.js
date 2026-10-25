/* enrtasks1.js - Energie-Lab: Aufgaben en1 bis en15 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig) (WP5a)
 * Registrierung: ENR_TASKS.register([ ... ]) (ENR_TASKS und ENR_TASKS.util kommen aus enrdata.js; enrdata.js VOR dieser Datei laden, in Node holt sich die
 * Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'enN', lab:'enr', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), fields?, choices?, ask?, consts? }
 *   start() und sol() liefern { rig, controls, fields?, choices?, value? } (Steuerwerte des Pruefstands und Selbsttest-Antworten); wrong() liefert mindestens zwei
 *   absichtlich falsche Antworten [{ name, answer }]; check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Regeln (SPEC Abschnitt 7 und 9):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus ENR_CORE und der Simulation (ENR_RIGS) und stehen in hintVals() (Regel 1); text, hint, table
 *     werden erst beim ersten Zugriff gerechnet. ENR_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3. Keine Zahl aus der Spezifikation steht im Text.
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Richtung (zu klein/zu gross) und typische Fehlerbilder erst, wenn der Wert des Lernenden mit dem
 *     gerechneten Fehlerwert uebereinstimmt (Regel 3). Rechnen mit ENR_CORE.calc.exercise nutzt dessen check (Tabellenbuch-Varianten, Regel 4).
 *   - Schwellwerte stammen aus der gerechneten Musterloesung (ENR_TASKS.thresholds1(), Konstanten mit Kommentar), Toleranzen stehen je Aufgabe (A17).
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (FIX), damit gleiche Eingaben gleiche Ergebnisse liefern.
 * Abweichungen von der SPEC: en14 benutzt den 21.12. mit Hecke 1,5 m / 5 m Abstand statt 21.3. / 3 m: Zur Tagundnachtgleiche ist der Profilwinkel der Sonne (Richtung senkrecht zur Hecke) den ganzen Tag gleich (90° minus Breitengrad), der Schatten
 *   liegt dann entweder den ganzen Tag oder nie auf dem Modul; im Winter gibt es ein schattenfreies Fenster um den Mittag. Siehe AUSBILDER.md;
 *   en15 braucht ENR_CORE.sys (Pruefstand regler).
 * Benoetigt: enrcore.js, enrcalc.js, enrdata.js und die Pruefstaende enrrig-modul.js, enrrig-schatten.js (en15: enrrig-regler.js und enrsys.js). */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.ENR_TASKS) nodeReq('./enrdata.js');
  const T = root.ENR_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('enrtasks1.js: enrdata.js fehlt, die Aufgaben en1 bis en15 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, numRow = U.numRow, exRow = U.exRow, def = U.def;
  const C = () => U.core();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const choiceOf = U.choiceOf;
  const MFIX = { preset: 'si60', ns: 1, np: 1, G: 1000, tcMode: 'manuell', tc: 25, ta: 20, lastart: 'widerstand', rLast: 3, uFrac: 80, view: 'kennlinie', compare: 'aus' };
  const SFIX = { preset: 'si60', ns: 1, np: 1, orient: 'hochkant', bypass: 'ok', schatten: 'keiner', tiefe: 10, dunkel: 100, betroffen: 'modul1', seed: 1, zCol: 3, zRow: 9, G: 1000, diff: 12, tc: 25, mppt: 'global', uFrac: 80, datum: 'winter', uhr: 12, zeitlauf: 'aus', hH: 1.5, hD: 3, beta: 35 };
  const RFIX = { modul: 'si60', ns: 1, np: 1, ctrl: 'pwm', imax: 20, chem: 'blei', usys: 12, cap: 100, soc0: 50, tbat: 25, load: 0, lvd: true, tempComp: true, lPv: 2, aPv: 4, lBat: 1, aBat: 10, quelle: 'konstant', G: 800, ta: 20, lauf: 'aus' };
  const keys = (G, Tc, preset) => C().pv.keys(preset || 'si60', { G, Tc });
  const vk = (v, d) => (fin(v) ? f(v, d) : '–');
  const A = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const noAnswer = (a, key) => U.rawOf(a, key) === null;

  /* ====================================================================== en1: drei Punkte der Kennlinie */
  const M1 = (() => {
    const pts = () => once('p1', () => { const k = keys(1000, 25); return [{ id: 'A', U: k.Umpp, I: k.Impp }, { id: 'B', U: k.Uoc, I: 0 }, { id: 'C', U: 0, I: k.Isc }]; });
    const kind = p => (p.I === 0 ? 'leer' : p.U === 0 ? 'kurz' : 'mpp');
    const want = () => { const o = {}; pts().forEach(p => { o[kind(p)] = p.id; }); o.strom0 = 'kein'; o.spann0 = 'null'; return o; };
    const desc = p => 'Punkt ' + p.id + ' liegt bei U = ' + vk(p.U, 1) + ' V und I = ' + vk(p.I, 2) + ' A';
    const vals = () => once('v1', () => { const P = pts(), a = P.find(p => p.id === 'A'); return { ua: P[0].U, ia: P[0].I, ub: P[1].U, uc: P[2].U, ic: P[2].I, pa: a.U * a.I }; });
    const text = () => { const P = pts(); return 'Die Kennlinie des 60-Zellen-Moduls bei Standardbedingungen (1000 W/m², 25 °C) trägt drei markierte Punkte: ' + P.map(p => 'Punkt ' + p.id + ' (U = ' + vk(p.U, 1) + ' V, I = ' + vk(p.I, 2) + ' A)').join(', ') + '. Ordne die Punkte Leerlauf, Kurzschluss und MPP zu und beantworte die beiden Fragen zu Strom und Spannung.'; };
    const opts = () => pts().map(p => ({ value: p.id, label: 'Punkt ' + p.id }));
    const NAMEN = { leer: 'dem Leerlauf', kurz: 'dem Kurzschluss', mpp: 'dem MPP' };
    const choices = () => [
      { key: 'leer', q: 'Welcher Punkt ist der Leerlauf (nichts angeschlossen)?', options: opts() },
      { key: 'kurz', q: 'Welcher Punkt ist der Kurzschluss (Klemmen verbunden)?', options: opts() },
      { key: 'mpp', q: 'Welcher Punkt ist der MPP (größte Leistung)?', options: opts() },
      { key: 'strom0', q: 'Im Leerlauf fließt …', options: [{ value: 'kein', label: 'kein Strom' }, { value: 'max', label: 'der größte Strom' }] },
      { key: 'spann0', q: 'Im Kurzschluss ist die Spannung …', options: [{ value: 'null', label: 'null' }, { value: 'max', label: 'am größten' }] }
    ];
    const check = mk('modul', [], (c, r, a) => {
      const w = want(), P = pts();
      ['leer', 'kurz', 'mpp'].forEach(k => {
        const got = choiceOf(a, k), none = got === undefined || got === null || got === '', p = none ? null : P.find(x => x.id === got);
        const right = P.find(x => x.id === w[k]);
        r(!none && got === w[k], 'Der Punkt für ' + NAMEN[k].replace('dem ', '') + ' ist richtig zugeordnet',
          none ? 'Wähle einen Punkt aus.' : (p ? 'Du hast ' + desc(p) + ' gewählt. ' : 'Deine Auswahl gehört nicht zu den Punkten. ') + 'Zu ' + NAMEN[k] + ' passt ' + desc(right) + '.');
      });
      const g4 = choiceOf(a, 'strom0'), g5 = choiceOf(a, 'spann0'), leer = P.find(x => x.id === w.leer), kurz = P.find(x => x.id === w.kurz);
      r(g4 === 'kein', 'Strom im Leerlauf richtig beantwortet', g4 === undefined || g4 === null || g4 === '' ? 'Wähle eine Antwort aus.' : 'Im Leerlauf ist nichts angeschlossen: Am Punkt ' + leer.id + ' ist I = ' + vk(leer.I, 0) + ' A, der größte Strom (' + vk(kurz.I, 2) + ' A) fließt im Kurzschluss.');
      r(g5 === 'null', 'Spannung im Kurzschluss richtig beantwortet', g5 === undefined || g5 === null || g5 === '' ? 'Wähle eine Antwort aus.' : 'Im Kurzschluss sind die Klemmen verbunden: Am Punkt ' + kurz.id + ' ist U = ' + vk(kurz.U, 0) + ' V, die größte Spannung (' + vk(leer.U, 1) + ' V) liegt im Leerlauf.');
    });
    const hint = () => { const v = vals(); return [
      'Beim Leerlauf ist nichts angeschlossen, es fließt kein Strom. Im Kurzschluss sind die Klemmen verbunden, die Spannung ist null. Im MPP ist das Produkt U · I am größten.',
      'Rechne für jeden Punkt U · I: Punkt A ergibt ' + f(v.pa, 0) + ' W, Punkt B und Punkt C ergeben je 0 W.',
      'Musterlösung: Leerlauf ist Punkt B (I = 0 A), Kurzschluss ist Punkt C (U = 0 V), der MPP ist Punkt A (P = ' + f(v.pa, 0) + ' W).'
    ]; };
    return { text, hint, vals, choices, check,
      start: () => A('modul', Object.assign({}, MFIX, { lastart: 'mpp' }), { choices: {} }),
      sol: () => A('modul', Object.assign({}, MFIX, { lastart: 'mpp' }), { choices: want() }),
      wrong: () => [{ name: 'vertauscht', answer: A('modul', {}, { choices: { leer: 'C', kurz: 'B', mpp: 'B', strom0: 'max', spann0: 'max' } }) }, { name: 'alles Punkt A', answer: A('modul', {}, { choices: { leer: 'A', kurz: 'A', mpp: 'C', strom0: 'max', spann0: 'null' } }) }] };
  })();

  /* ====================================================================== en2: Uoc und Isc ablesen */
  const M2 = (() => {
    const vals = () => once('v2', () => { const k = keys(1000, 25); return { uoc: k.Uoc, isc: k.Isc, tol: 3 }; });
    const check = mk('modul', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.fieldNum(a, 'uoc'), { label: 'Leerlaufspannung Uoc', refs: [{ v: v.uoc }], tol: 0.03, unit: 'V', digits: 1, wrong: [{ v: v.isc, msg: 'Das ist der Kurzschlussstrom Isc in A, gefragt ist die Spannung bei offenen Klemmen.' }] });
      numRow(r, U.fieldNum(a, 'isc'), { label: 'Kurzschlussstrom Isc', refs: [{ v: v.isc }], tol: 0.03, unit: 'A', digits: 2, wrong: [{ v: v.uoc, msg: 'Das ist die Leerlaufspannung Uoc in V, gefragt ist der Strom bei verbundenen Klemmen.' }] });
    });
    return { vals, check,
      text: () => 'Stelle im Prüfstand „Solarmodul-Kennlinie“ das 60-Zellen-Modul bei Standardbedingungen ein (1000 W/m², Zelltemperatur 25 °C, ein Modul) und lies die Leerlaufspannung Uoc und den Kurzschlussstrom Isc ab.',
      fields: () => [{ key: 'uoc', label: 'Leerlaufspannung Uoc', unit: 'V' }, { key: 'isc', label: 'Kurzschlussstrom Isc', unit: 'A' }],
      hint: () => { const v = vals(); return [
        'Uoc steht bei „Leerlauf“ (I = 0), Isc bei „Kurzschluss“ (U = 0). Du kannst beide am Messgerät ablesen oder an den Achsenabschnitten der Kennlinie.',
        'Die Leerlaufspannung liegt bei etwa ' + f(v.uoc, 0) + ' V, der Kurzschlussstrom bei etwa ' + f(v.isc, 0) + ' A.',
        'Musterlösung: Uoc = ' + f(v.uoc, 1) + ' V, Isc = ' + f(v.isc, 2) + ' A (Toleranz ' + f(v.tol, 0) + ' %).'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX, { lastart: 'leerlauf' }), { fields: { uoc: null, isc: null } }),
      sol: () => { const v = vals(); return A('modul', Object.assign({}, MFIX, { lastart: 'kurzschluss' }), { fields: { uoc: v.uoc, isc: v.isc } }); },
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('modul', {}, { fields: { uoc: v.uoc * 0.5, isc: v.isc * 0.5 } }) }, { name: 'zu groß', answer: A('modul', {}, { fields: { uoc: v.uoc * 1.5, isc: v.isc * 1.5 } }) }, { name: 'vertauscht', answer: A('modul', {}, { fields: { uoc: v.isc, isc: v.uoc } }) }]; } };
  })();

  /* ====================================================================== en3: Leistungsanpassung */
  const M3 = (() => {
    const OWN = ['lastart', 'rLast'], FIX = MFIX, MIN = 97;   // 97 % wie SPEC 7.2 (en3), A17
    const vals = () => once('v3', () => { const k = keys(1000, 25); return { umpp: k.Umpp, impp: k.Impp, rmpp: k.Umpp / k.Impp, min: MIN, pmpp: k.Pmpp }; });
    const check = mk('modul', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'modul', OWN, FIX), sim = U.snap('modul', eff, 2, { sampleS: 1 }), st = sim.st;
      inputRow(c, r, sim, a, 'modul');
      U.setRow(r, 'modul', eff, [{ key: 'lastart', want: 'widerstand' }], 'Die Last ist ein Widerstand');
      const dir = fin(st.rOp) && fin(st.rMpp) ? (st.rOp < st.rMpp ? 'Dein Widerstand ist kleiner als der Widerstand im MPP.' : 'Dein Widerstand ist größer als der Widerstand im MPP.') : '';
      r(fin(st.anpass) && st.anpass >= MIN, 'Das Modul gibt mindestens ' + f(MIN, 0) + ' % der größtmöglichen Leistung ab',
        'Dein Widerstand R = ' + vk(st.rOp, 2) + ' Ω gibt ' + vk(st.p, 1) + ' W ab, das sind ' + vk(st.anpass, 0) + ' % von ' + vk(st.pmpp, 1) + ' W. Im MPP wäre R = Umpp / Impp = ' + vk(st.rMpp, 2) + ' Ω. ' + dir);
    });
    return { vals, check,
      text: () => 'Das Modul liegt an einem einstellbaren Lastwiderstand (60-Zellen-Modul, Standardbedingungen). Stelle die Last auf „Widerstand“ und den Lastwiderstand so ein, dass das Modul möglichst viel Leistung abgibt: mindestens ' + f(MIN, 0) + ' % der größtmöglichen Leistung (Anzeige „Leistungsanpassung“).',
      hint: () => { const v = vals(); return [
        'Zu kleiner Widerstand: Strom hoch, Spannung niedrig. Zu großer Widerstand: Spannung hoch, Strom niedrig. Dazwischen liegt ein Maximum der Leistung.',
        'Im MPP liegen ' + f(v.umpp, 1) + ' V und ' + f(v.impp, 2) + ' A an. Der passende Widerstand ist der Quotient Umpp / Impp.',
        'Musterlösung: R = ' + f(v.umpp, 1) + ' V / ' + f(v.impp, 2) + ' A = ' + f(v.rmpp, 2) + ' Ω.'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX), {}),
      sol: () => A('modul', Object.assign({}, MFIX, { lastart: 'widerstand', rLast: Math.round(vals().rmpp * 20) / 20 }), {}),
      wrong: () => [{ name: 'Widerstand zu klein', answer: A('modul', Object.assign({}, MFIX, { rLast: 0.5 }), {}) }, { name: 'Widerstand zu groß', answer: A('modul', Object.assign({}, MFIX, { rLast: 30 }), {}) }] };
  })();

  /* ====================================================================== en4: halbe Einstrahlung */
  const M4 = (() => {
    const vals = () => once('v4', () => { const a = keys(1000, 25), b = keys(500, 25); return { isc1: a.Isc, isc2: b.Isc, uoc1: a.Uoc, uoc2: b.Uoc, dI: 100 * (1 - b.Isc / a.Isc), dU: 100 * (1 - b.Uoc / a.Uoc), tol: 5 }; });
    const check = mk('modul', [], (c, r, a) => {
      const v = vals(), g = choiceOf(a, 'stark'), none = g === undefined || g === null || g === '';
      r(g === 'isc', 'Die Größe, die sich stark ändert, ist richtig gewählt',
        none ? 'Wähle eine Antwort aus.' : 'Bei halber Einstrahlung ändert sich Isc um ' + f(v.dI, 0) + ' %, Uoc nur um ' + f(v.dU, 0) + ' %. Der Strom folgt der Einstrahlung, die Spannung (logarithmisch) kaum.');
      numRow(r, U.numAns(a), { label: 'Kurzschlussstrom Isc bei der halben Einstrahlung', refs: [{ v: v.isc2 }], tol: 0.05, unit: 'A', digits: 2, wrong: [
        { v: v.isc1, msg: 'Das ist der Kurzschlussstrom bei der vollen Einstrahlung. Lies bei 500 W/m² ab.' },
        { v: v.uoc2, msg: 'Das ist die Leerlaufspannung in V, gefragt ist der Kurzschlussstrom.' }] });
    });
    return { vals, check,
      text: () => 'Stelle im Prüfstand „Solarmodul-Kennlinie“ die Einstrahlung von 1000 W/m² auf 500 W/m² (Zelltemperatur 25 °C, ein 60-Zellen-Modul). Welche Größe ändert sich stark, welche kaum? Gib den Kurzschlussstrom Isc bei 500 W/m² an.',
      choices: () => [{ key: 'stark', q: 'Welche Größe ändert sich bei halber Einstrahlung stark?', options: [{ value: 'isc', label: 'der Kurzschlussstrom Isc' }, { value: 'uoc', label: 'die Leerlaufspannung Uoc' }] }],
      ask: { label: 'Kurzschlussstrom Isc bei 500 W/m²', unit: 'A' },
      hint: () => { const v = vals(); return [
        'Der Strom einer Solarzelle ist ein Photostrom: Er ist der Einstrahlung proportional. Die Spannung hängt nur logarithmisch von ihr ab.',
        'Bei 1000 W/m² beträgt Isc ' + f(v.isc1, 2) + ' A. Halbe Einstrahlung heißt halber Photostrom.',
        'Musterlösung: Isc sinkt um ' + f(v.dI, 0) + ' % auf ' + f(v.isc2, 2) + ' A, Uoc nur um ' + f(v.dU, 0) + ' % von ' + f(v.uoc1, 1) + ' V auf ' + f(v.uoc2, 1) + ' V.'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX, { G: 500, lastart: 'kurzschluss' }), { value: null, choices: {} }),
      sol: () => A('modul', Object.assign({}, MFIX, { G: 500, lastart: 'kurzschluss' }), { value: vals().isc2, choices: { stark: 'isc' } }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('modul', {}, { value: v.isc2 * 0.5, choices: { stark: 'uoc' } }) }, { name: 'zu groß', answer: A('modul', {}, { value: v.isc1, choices: { stark: 'isc' } }) }]; } };
  })();

  /* ====================================================================== en5: Leistungsabnahme bei 65 Grad */
  const M5 = (() => {
    const vals = () => once('v5', () => {
      const a = keys(1000, 25), b = keys(1000, 65), cf = C().pv.tempCoeff('si60');
      return { p25: a.Pmpp, p65: b.Pmpp, dp: 100 * (1 - b.Pmpp / a.Pmpp), anteil: 1 - b.Pmpp / a.Pmpp, gp: Math.abs(100 * cf.gammaP), dT: 40, tol: 10 };
    });
    const check = mk('modul', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.numAns(a), { label: 'Abnahme der MPP-Leistung bei 65 °C gegenüber 25 °C in Prozent', refs: [{ v: v.dp }], tol: 0.10, unit: '%', digits: 1, abs: true, wrong: [
        { v: v.gp, msg: 'Das ist der Leistungskoeffizient je Kelvin (%/K). Gefragt ist die Abnahme über den ganzen Temperaturunterschied.' },
        { v: v.p65, msg: 'Das ist die Leistung bei 65 °C in W. Gefragt ist die Abnahme in Prozent.' },
        { v: 100 - v.dp, msg: 'Das ist die Leistung bei 65 °C in Prozent der Leistung bei 25 °C. Gefragt ist die Abnahme, also 100 % minus diesen Wert.' }] });
    });
    return { vals, check,
      text: () => 'Heißer Sommer: Die Zellen des 60-Zellen-Moduls erreichen 65 °C (Einstrahlung 1000 W/m²). Um wie viel Prozent sinkt die MPP-Leistung gegenüber 25 °C? Miss im Prüfstand beide Werte und gib die Abnahme in Prozent an.',
      ask: { label: 'Abnahme der MPP-Leistung', unit: '%' },
      hint: () => { const v = vals(); return [
        'Miss die MPP-Leistung bei 25 °C und bei 65 °C (Zelltemperatur manuell einstellen) und bilde den Unterschied im Verhältnis zum ersten Wert.',
        'Bei 25 °C liegt die MPP-Leistung bei ' + f(v.p25, 1) + ' W, bei 65 °C bei ' + f(v.p65, 1) + ' W.',
        'Musterlösung: (' + f(v.p25, 1) + ' W − ' + f(v.p65, 1) + ' W) / ' + f(v.p25, 1) + ' W = ' + f(v.anteil, 3) + ', also ' + f(v.dp, 1) + ' % (Toleranz ' + f(v.tol, 0) + ' % des Werts). Das sind rund ' + f(v.gp, 2) + ' % je Kelvin.'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX, { tc: 65, lastart: 'mpp' }), { value: null }),
      sol: () => A('modul', Object.assign({}, MFIX, { tc: 65, lastart: 'mpp' }), { value: vals().dp }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('modul', {}, { value: v.dp * 0.5 }) }, { name: 'zu groß', answer: A('modul', {}, { value: v.dp * 2 }) }, { name: 'Koeffizient genannt', answer: A('modul', {}, { value: v.gp }) }]; } };
  })();

  /* ====================================================================== en6: Fuellfaktor rechnen */
  const M6 = (() => {
    const SEED = 3;
    const ex = () => once('e6', () => C().calc.exercise('ff', SEED));
    const vals = () => once('v6', () => { const e = ex(); return { ff: e.answer.value, pmpp: e.given.pmpp, uoc: e.given.uoc, isc: e.given.isc, g: e.given.g, uocisc: e.given.uoc * e.given.isc }; });
    const check = mk('modul', [], (c, r, a) => { exRow(r, ex(), U.rawOf(a, 'value'), 'Füllfaktor FF richtig berechnet'); });
    return { vals, check,
      text: () => ex().question + ' Die Werte stehen in der Tabelle; du findest sie auch im Prüfstand („Solarmodul-Kennlinie“, Messgeräte).',
      table: () => ex().table,
      ask: { label: 'Füllfaktor FF (Zahl zwischen 0 und 1)', unit: '' },
      hint: () => { const v = vals(); return [
        'Der Füllfaktor vergleicht die Fläche des MPP-Rechtecks (Umpp mal Impp, das ist die Leistung im MPP) mit dem Rechteck Uoc mal Isc.',
        'Das Produkt Uoc · Isc beträgt ' + f(v.uocisc, 1) + ' W, die Leistung im MPP ' + f(v.pmpp, 1) + ' W.',
        'Musterlösung: FF = ' + f(v.pmpp, 1) + ' W / (' + f(v.uoc, 1) + ' V · ' + f(v.isc, 2) + ' A) = ' + f(v.ff, 3) + '.'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX), { value: null }),
      sol: () => A('modul', Object.assign({}, MFIX), { value: vals().ff }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('modul', {}, { value: v.ff * 0.6 }) }, { name: 'zu groß', answer: A('modul', {}, { value: v.ff * 1.3 }) }]; } };
  })();

  /* ====================================================================== en7: Module in Reihe, Spannungsband */
  const M7 = (() => {
    const OWN = ['ns'], FIX = Object.assign({}, MFIX, { lastart: 'leerlauf' }), LO = 100, HI = 130;   // Band aus dem Aufgabentext (SPEC 7.2, en7)
    const vals = () => once('v7', () => { const k = keys(1000, 25); return { uoc: k.Uoc, lo: LO, hi: HI, nlo: LO / k.Uoc, nhi: HI / k.Uoc, ns: 3, u3: 3 * k.Uoc }; });
    const check = mk('modul', OWN, (c, r, a) => {
      const eff = U.effOf(c, 'modul', OWN, FIX), sim = U.snap('modul', eff, 2, { sampleS: 1 }), st = sim.st;
      inputRow(c, r, sim, a, 'modul');
      r(fin(st.uoc) && st.uoc >= LO && st.uoc <= HI, 'Die Leerlaufspannung liegt zwischen ' + f(LO, 0) + ' V und ' + f(HI, 0) + ' V',
        'Mit ' + f(eff.ns, 0) + ' Modul(en) in Reihe beträgt die Leerlaufspannung ' + vk(st.uoc, 1) + ' V (ein Modul: ' + vk(st.uoc / Math.max(1, eff.ns), 1) + ' V). ' + (st.uoc < LO ? 'Das liegt unter dem Band: Es braucht mehr Module in Reihe.' : 'Das liegt über dem Band: Es braucht weniger Module in Reihe.'));
    });
    return { vals, check,
      text: () => 'Schalte im Prüfstand „Solarmodul-Kennlinie“ gleiche 60-Zellen-Module in Reihe, bis die Leerlaufspannung zwischen ' + f(LO, 0) + ' V und ' + f(HI, 0) + ' V liegt (Standardbedingungen, ein Strang).',
      hint: () => { const v = vals(); return [
        'In Reihe addieren sich die Spannungen, der Strom bleibt. Teile das Band durch die Leerlaufspannung eines einzelnen Moduls.',
        'Ein Modul hat ' + f(v.uoc, 1) + ' V Leerlaufspannung. Das Band umfasst ' + f(v.nlo, 1) + ' bis ' + f(v.nhi, 1) + ' Module.',
        'Musterlösung: ' + f(v.ns, 0) + ' Module in Reihe ergeben ' + f(v.ns, 0) + ' · ' + f(v.uoc, 1) + ' V = ' + f(v.u3, 1) + ' V.'
      ]; },
      start: () => A('modul', Object.assign({}, FIX), {}),
      sol: () => A('modul', Object.assign({}, FIX, { ns: vals().ns }), {}),
      wrong: () => [{ name: 'zu wenige Module', answer: A('modul', Object.assign({}, FIX, { ns: 1 }), {}) }, { name: 'zu viele Module', answer: A('modul', Object.assign({}, FIX, { ns: 4 }), {}) }] };
  })();

  /* ====================================================================== en8: Kurzschlussstrom mit moeglichst wenigen Modulen */
  const M8 = (() => {
    const OWN = ['preset', 'ns', 'np'], FIX = Object.assign({}, MFIX, { lastart: 'kurzschluss' }), ZIEL = 25, MODULE = ['si36', 'si60', 'si72'];
    const defs = () => U.cdef('modul', 'np');
    const nmin = () => once('n8', () => { const npMax = defs() ? defs().max : 3; let best = Infinity; MODULE.forEach(p => { const isc = keys(1000, 25, p).Isc, n = Math.ceil(ZIEL / isc - 1e-9); if (n <= npMax) best = Math.min(best, n); }); return best; });
    const vals = () => once('v8', () => { const k = keys(1000, 25); return { isc: k.Isc, ziel: ZIEL, nmin: nmin(), isc2: 2 * k.Isc, isc3: nmin() * k.Isc, nExakt: ZIEL / k.Isc }; });
    const check = mk('modul', OWN, (c, r, a) => {
      const eff = U.effOf(c, 'modul', OWN, FIX), sim = U.snap('modul', eff, 2, { sampleS: 1 }), st = sim.st, n = eff.ns * eff.np, nm = nmin();
      inputRow(c, r, sim, a, 'modul');
      r(MODULE.indexOf(eff.preset) >= 0, 'Die Aufgabe benutzt Module, keine einzelne Zelle', 'Die Voreinstellung „' + eff.preset + '“ ist kein Modul. Wähle ein Modul.');
      r(fin(st.isc) && st.isc >= ZIEL, 'Der Kurzschlussstrom beträgt mindestens ' + f(ZIEL, 0) + ' A', 'Der Aufbau liefert ' + vk(st.isc, 1) + ' A Kurzschlussstrom, das sind ' + vk(ZIEL - st.isc, 1) + ' A zu wenig. Parallel addieren sich die Ströme, in Reihe nicht.');
      r(fin(st.isc) && st.isc >= ZIEL && n === nm, 'Die Zahl der Module ist die kleinste mögliche (' + f(nm, 0) + ')', fin(st.isc) && st.isc >= ZIEL ? 'Du benutzt ' + f(n, 0) + ' Module, es geht mit ' + f(nm, 0) + '. Reihenschaltung erhöht den Strom nicht.' : 'Zuerst muss der Kurzschlussstrom das Ziel erreichen.');
    });
    return { vals, check,
      text: () => 'Erreiche im Prüfstand „Solarmodul-Kennlinie“ mindestens ' + f(ZIEL, 0) + ' A Kurzschlussstrom (Standardbedingungen) mit möglichst wenigen Modulen. Wähle ein Modul (36, 60 oder 72 Zellen) und die Schaltung (Reihe ns, parallel np).',
      hint: () => { const v = vals(); return [
        'Strom addieren nur parallele Module. Teile das Ziel durch den Kurzschlussstrom eines Moduls und runde auf.',
        'Ein 60-Zellen-Modul liefert ' + f(v.isc, 1) + ' A. Das Ziel ' + f(v.ziel, 0) + ' A entspricht ' + f(v.nExakt, 2) + ' Modulen parallel; zwei Module liefern nur ' + f(v.isc2, 1) + ' A.',
        'Musterlösung: ' + f(v.nmin, 0) + ' Module parallel (np = ' + f(v.nmin, 0) + ', ns = 1) liefern ' + f(v.isc3, 1) + ' A.'
      ]; },
      start: () => A('modul', Object.assign({}, FIX), {}),
      sol: () => A('modul', Object.assign({}, FIX, { preset: 'si60', ns: 1, np: nmin() }), {}),
      wrong: () => [{ name: 'zu wenig Strom', answer: A('modul', Object.assign({}, FIX, { ns: 1, np: 2 }), {}) }, { name: 'zu viele Module', answer: A('modul', Object.assign({}, FIX, { ns: 2, np: nmin() }), {}) }] };
  })();

  /* ====================================================================== en9: Strangauslegung bei Kaelte */
  const M9 = (() => {
    const UMAX = 500, TMIN = -10;   // Aufgabentext (SPEC 7.2, en9)
    const vals = () => once('v9', () => { const a = keys(1000, 25), b = keys(1000, TMIN); return { umax: UMAX, tmin: TMIN, tref: 25, uoc25: a.Uoc, uocKalt: b.Uoc, nmax: Math.floor(UMAX / b.Uoc), nWarm: Math.floor(UMAX / a.Uoc), nAuf: Math.ceil(UMAX / b.Uoc), exakt: UMAX / b.Uoc, uMax11: Math.floor(UMAX / b.Uoc) * b.Uoc }; });
    const check = mk('modul', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.numAns(a), { label: 'Höchste Zahl der Module in Reihe', refs: [{ v: v.nmax }], absTol: 0.01, unit: 'Module', digits: 0, wrong: [
        { v: v.nWarm, msg: 'Du hast mit der Leerlaufspannung bei 25 °C gerechnet (' + vk(v.uoc25, 1) + ' V). Bei ' + f(v.tmin, 0) + ' °C ist sie höher (' + vk(v.uocKalt, 1) + ' V), die Kälte entscheidet.' },
        { v: v.nAuf, msg: 'Du hast aufgerundet. Mit ' + f(v.nAuf, 0) + ' Modulen läge die Spannung bei ' + vk(v.nAuf * v.uocKalt, 0) + ' V, über der Grenze. Die Zahl wird abgerundet.' }] });
    });
    return { vals, check,
      text: () => 'Ein Strang aus 60-Zellen-Modulen soll an einen Wechselrichter mit ' + f(UMAX, 0) + ' V höchster Eingangsspannung. Wie viele Module darf der Strang bei ' + f(TMIN, 0) + ' °C Zelltemperatur (Einstrahlung 1000 W/m²) höchstens haben? Stelle die Temperatur im Prüfstand „Solarmodul-Kennlinie“ ein und lies die Leerlaufspannung ab.',
      ask: { label: 'Höchste Zahl der Module in Reihe', unit: 'Module' },
      hint: () => { const v = vals(); return [
        'Die höchste Spannung tritt im Leerlauf bei Kälte auf. Teile die Eingangsgrenze durch die Leerlaufspannung eines Moduls bei der kältesten Temperatur und runde ab.',
        'Bei ' + f(v.tmin, 0) + ' °C hat ein Modul ' + f(v.uocKalt, 1) + ' V Leerlaufspannung (bei ' + f(v.tref, 0) + ' °C: ' + f(v.uoc25, 1) + ' V).',
        'Musterlösung: ' + f(v.umax, 0) + ' V / ' + f(v.uocKalt, 1) + ' V = ' + f(v.exakt, 2) + ', abgerundet ' + f(v.nmax, 0) + ' Module (zusammen ' + f(v.uMax11, 0) + ' V).'
      ]; },
      start: () => A('modul', Object.assign({}, MFIX, { tc: 25, lastart: 'leerlauf' }), { value: null }),
      sol: () => A('modul', Object.assign({}, MFIX, { tc: TMIN, lastart: 'leerlauf' }), { value: vals().nmax }),
      wrong: () => { const v = vals(); return [{ name: 'mit 25 °C gerechnet', answer: A('modul', {}, { value: v.nWarm }) }, { name: 'aufgerundet', answer: A('modul', {}, { value: v.nAuf }) }]; } };
  })();

  /* ====================================================================== en10: Laubblatt */
  const M10 = (() => {
    const FIX = Object.assign({}, SFIX, { schatten: 'blatt' });
    const sim = () => U.snap('schatten', U.fullCtl('schatten', FIX), 60, { sampleS: 10 });
    const vals = () => once('v10', () => { const s = sim().st; return { loss: s.loss, frac: s.fracShade, rest: 100 - s.loss, anteil: s.loss / 100, p0: s.pFree, p1: s.pMpp, zellen: C().pv.presets.si60.Ns, tol: 3 }; });
    const check = mk('schatten', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.numAns(a), { label: 'Verlust der MPP-Leistung durch das Laubblatt in Prozent', refs: [{ v: v.loss }], absTol: 3, unit: '%', digits: 1, wrong: [
        { v: v.frac, msg: 'Das ist der Flächenanteil der verschatteten Zelle. Der Verlust ist größer: Die Bypassdiode überbrückt den ganzen Teilstrang.' },
        { v: v.rest, msg: 'Das ist die Leistung, die bleibt. Gefragt ist der Verlust, also 100 % minus diesen Wert.' }] });
    });
    return { vals, check,
      text: () => 'Ein Laubblatt deckt eine einzelne Zelle in der Mitte der untersten Reihe eines 60-Zellen-Moduls vollständig ab (Kernschatten, intakte Bypassdioden, Einstrahlung 1000 W/m²). Stelle im Prüfstand „Verschattung“ den Schatten „ein Blatt“ ein und lies ab: Wie viel Prozent der Leistung gehen verloren?',
      ask: { label: 'Verlust der MPP-Leistung', unit: '%' },
      hint: () => { const v = vals(); return [
        'Vergleiche die Leistung im globalen Maximum mit der Leistung ohne Schatten („Verlust“-Anzeige). Beachte: Die Bypassdiode überbrückt einen ganzen Teilstrang.',
        'Ohne Schatten liefert das Modul ' + f(v.p0, 0) + ' W, mit Laubblatt ' + f(v.p1, 0) + ' W. Das Blatt deckt nur ' + f(v.frac, 1) + ' % der Fläche ab.',
        'Musterlösung: (' + f(v.p0, 0) + ' W − ' + f(v.p1, 0) + ' W) / ' + f(v.p0, 0) + ' W = ' + f(v.anteil, 2) + ', also ' + f(v.loss, 0) + ' % Verlust (Toleranz ±' + f(v.tol, 0) + ' Prozentpunkte).'
      ]; },
      start: () => A('schatten', Object.assign({}, FIX), { value: null }),
      sol: () => A('schatten', Object.assign({}, FIX), { value: vals().loss }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein (Flächenanteil)', answer: A('schatten', {}, { value: v.frac }) }, { name: 'zu groß (Rest statt Verlust)', answer: A('schatten', {}, { value: v.rest }) }]; } };
  })();

  /* ====================================================================== en11: Hecke, hochkant gegen quer */
  const M11 = (() => {
    const OWN = ['orient'], FIX = Object.assign({}, SFIX, { schatten: 'kante', tiefe: 10, mppt: 'global' });
    const loss = o => U.snap('schatten', U.fullCtl('schatten', Object.assign({}, FIX, { orient: o })), 5, { sampleS: 1 }).st.loss;
    const vals = () => once('v11', () => { const h = loss('hochkant'), q = loss('quer'); return { lh: h, lq: q, thr: q + 3, tiefe: FIX.tiefe, reserve: 3 }; });   // Schwelle = Muster (quer) + 3 Prozentpunkte
    const check = mk('schatten', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'schatten', OWN, FIX), sim = U.snap('schatten', eff, 5, { sampleS: 1 }), st = sim.st;
      inputRow(c, r, sim, a, 'schatten');
      r(fin(st.loss) && st.loss <= v.thr, 'Die Montageart verliert höchstens ' + f(v.thr, 1) + ' % der Leistung',
        'Die Montage „' + U.dlabel('schatten', 'orient').toLowerCase() + ': ' + (eff.orient === 'quer' ? 'quer' : 'hochkant') + '“ verliert ' + vk(st.loss, 1) + ' %. Im Vergleich: hochkant ' + vk(v.lh, 1) + ' %, quer ' + vk(v.lq, 1) + ' %. ' + (v.lh > v.lq ? 'Wähle die Montageart mit dem kleineren Verlust.' : ''));
    });
    return { vals, check,
      text: () => 'Eine Hecke wirft Schatten auf die unteren ' + f(FIX.tiefe, 0) + ' % des 60-Zellen-Moduls (Kernschatten, intakte Bypassdioden, MPP-Suchlauf global). Wähle im Prüfstand „Verschattung“ die Montageart (hochkant oder quer), bei der weniger Leistung verloren geht.',
      hint: () => { const v = vals(); return [
        'Überlege, wie viele Teilstränge der Schatten trifft. Jeder betroffene Teilstrang wird von seiner Bypassdiode überbrückt und liefert dann nichts.',
        'Du kannst beide Montagearten im Prüfstand ausprobieren und den Verlust ablesen: hochkant ' + f(v.lh, 0) + ' %, quer ' + f(v.lq, 0) + ' %.',
        'Musterlösung: quer. Der Verlust beträgt ' + f(v.lq, 1) + ' %; die Prüfung lässt bis ' + f(v.thr, 1) + ' % zu (Reserve ' + f(v.reserve, 0) + ' Prozentpunkte).'
      ]; },
      start: () => A('schatten', Object.assign({}, FIX, { orient: 'hochkant' }), {}),
      sol: () => A('schatten', Object.assign({}, FIX, { orient: 'quer' }), {}),
      wrong: () => [{ name: 'hochkant', answer: A('schatten', Object.assign({}, FIX, { orient: 'hochkant' }), {}) }, { name: 'hochkant mit anderem Muster', answer: A('schatten', Object.assign({}, FIX, { orient: 'hochkant', mppt: 'lokal' }), {}) }] };
  })();

  /* ====================================================================== en12: Tracker haengt im lokalen Maximum */
  const M12 = (() => {
    const OWN = ['mppt', 'uFrac'], FIX = Object.assign({}, SFIX, { schatten: 'kante', tiefe: 10, orient: 'quer', mppt: 'lokal' }), MIN = 0.98, T = 90;   // 98 % wie SPEC 7.2 (en12)
    const vals = () => once('v12', () => { const s = U.snap('schatten', U.fullCtl('schatten', Object.assign({}, FIX, { mppt: 'global' })), T, { sampleS: 5 }).st, l = U.snap('schatten', U.fullCtl('schatten', FIX), T, { sampleS: 5 }).st; return { pmpp: s.pMpp, pLokal: l.pOp, pGlobal: s.pOp, nPeaks: s.nPeaks, anteilLokal: 100 * l.pOp / l.pMpp, min: 100 * MIN }; });
    const check = mk('schatten', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'schatten', OWN, FIX), sim = U.snap('schatten', eff, T, { sampleS: 5 }), st = sim.st;
      inputRow(c, r, sim, a, 'schatten');
      const q = st.pMpp > 0 ? st.pOp / st.pMpp : NaN;
      r(fin(q) && q >= MIN, 'Der Tracker arbeitet bei mindestens ' + f(100 * MIN, 0) + ' % der Leistung im globalen Maximum',
        'Der Tracker arbeitet bei ' + vk(st.pOp, 1) + ' W, das globale Maximum liegt bei ' + vk(st.pMpp, 1) + ' W (' + vk(100 * q, 0) + ' %). ' + (eff.mppt === 'lokal' && st.nPeaks >= 2 ? 'Der Tracker „lokal“ bleibt im lokalen Maximum hängen; die Kurve hat ' + f(st.nPeaks, 0) + ' Maxima.' : eff.mppt === 'fest' ? 'Die feste Spannung (' + vk(st.uOp, 1) + ' V) liegt nicht am globalen Maximum.' : ''));
    });
    return { vals, check,
      text: () => 'Das Modul liegt quer montiert teilweise im Schatten (untere Zellen). Der MPP-Regler („lokal“) liefert deutlich weniger Leistung, als das Modul abgeben könnte. Stelle im Prüfstand „Verschattung“ den Tracker so ein, dass er das globale Maximum findet (Leistung am Arbeitspunkt mindestens ' + f(100 * MIN, 0) + ' % der Leistung im globalen Maximum).',
      hint: () => { const v = vals(); return [
        'Die P-U-Kurve hat zwei Maxima. Ein Tracker, der nur kleine Schritte macht, bleibt im nächstgelegenen Maximum. Es gibt einen Suchlauf über den ganzen Spannungsbereich.',
        'Der Tracker „lokal“ erreicht nur ' + f(v.pLokal, 0) + ' W (' + f(v.anteilLokal, 0) + ' %), obwohl das globale Maximum ' + f(v.pmpp, 0) + ' W erreicht. Die Kurve hat ' + f(v.nPeaks, 0) + ' Maxima.',
        'Musterlösung: Tracker „global“. Er arbeitet bei ' + f(v.pGlobal, 0) + ' W und erfüllt die Schwelle von ' + f(v.min, 0) + ' %.'
      ]; },
      start: () => A('schatten', Object.assign({}, FIX), {}),
      sol: () => A('schatten', Object.assign({}, FIX, { mppt: 'global' }), {}),
      wrong: () => [{ name: 'lokal', answer: A('schatten', Object.assign({}, FIX, { mppt: 'lokal' }), {}) }, { name: 'feste Spannung am lokalen Maximum', answer: A('schatten', Object.assign({}, FIX, { mppt: 'fest', uFrac: 80 }), {}) }] };
  })();

  /* ====================================================================== en13: Hotspot, Bypassdiode */
  const M13 = (() => {
    const OWN = ['bypass'], FIX = Object.assign({}, SFIX, { schatten: 'blatt', bypass: 'fehlt', mppt: 'global' }), RES = 1.25;   // 25 % Reserve auf die Musterlösung (SPEC 7)
    const hot = b => U.snap('schatten', U.fullCtl('schatten', Object.assign({}, FIX, { bypass: b })), 60, { sampleS: 10 }).st;
    const vals = () => once('v13', () => { const ok = hot('ok'), fe = hot('fehlt'); return { hotOk: ok.hotP, hotFehlt: fe.hotP, thr: RES * ok.hotP, lossOk: ok.loss, lossFehlt: fe.loss }; });
    const check = mk('schatten', OWN, (c, r, a) => {
      const v = vals(), eff = U.effOf(c, 'schatten', OWN, FIX), sim = U.snap('schatten', eff, 60, { sampleS: 10 }), st = sim.st;
      inputRow(c, r, sim, a, 'schatten');
      U.setRow(r, 'schatten', eff, [{ key: 'bypass', want: 'ok' }], 'Die Bypassdioden sind in Ordnung');
      r(fin(st.hotP) && st.hotP <= v.thr, 'Die verschattete Zelle verliert höchstens ' + f(v.thr, 0) + ' W',
        'In der verschatteten Zelle bleiben ' + vk(st.hotP, 0) + ' W Verlustleistung. Mit intakten Bypassdioden sind es ' + vk(v.hotOk, 0) + ' W, ohne ' + vk(v.hotFehlt, 0) + ' W. Dein Modul verliert ' + vk(st.loss, 0) + ' % der Leistung.');
    });
    return { vals, check, maskDiag: ['bypass-fehlt'],
      text: () => 'Das 60-Zellen-Modul wird schon bei einem kleinen Schatten (ein Laubblatt auf einer Zelle) sehr heiß. Die Hotspot-Anzeige im Prüfstand „Verschattung“ zeigt eine hohe Verlustleistung in der verschatteten Zelle. Finde den Fehler im Aufbau und behebe ihn.',
      hint: () => { const v = vals(); return [
        'Bei heißen Zellen im Schatten fehlt oft der Schutz, der den Strom an der verschatteten Zelle vorbeileitet. Schau dir die Bypassdioden an (Klick auf eine Diode wechselt den Zustand).',
        'Mit dem Fehler verliert die verschattete Zelle ' + f(v.hotFehlt, 0) + ' W, mit intakten Bypassdioden nur ' + f(v.hotOk, 0) + ' W.',
        'Musterlösung: Bypassdioden „in Ordnung“. Die Prüfung lässt bis ' + f(v.thr, 0) + ' W zu (Musterwert ' + f(v.hotOk, 0) + ' W plus Reserve).'
      ]; },
      start: () => A('schatten', Object.assign({}, FIX, { bypass: 'geliefert' }), {}),   // 'geliefert' verhält sich wie 'fehlt', zeigt den Zustand aber nicht an (Verdeckte-Fehler-Muster)
      sol: () => A('schatten', Object.assign({}, FIX, { bypass: 'ok' }), {}),
      wrong: () => [{ name: 'Bypassdiode fehlt', answer: A('schatten', Object.assign({}, FIX, { bypass: 'fehlt' }), {}) }, { name: 'Bypassdiode durchlegiert', answer: A('schatten', Object.assign({}, FIX, { bypass: 'kurz' }), {}) }] };
  })();

  /* ====================================================================== en14: Hecke, Uhrzeiten ohne Schatten */
  const M14 = (() => {
    const H = 1.5, D = 5, N = 355, BETA = 35, Z0 = 0.5, L = 1.65, TOL = 0.3;   // Hecke 1,5 m, Abstand 5 m am 21.12. (N = 355); Abweichung von der SPEC (21.3., Abstand 3 m), siehe Kopf
    /* Anzahl verschatteter Zellen wie im Prüfstand: Schatten der Hecke (shade.obstacle) als Kante von unten auf das hochkant montierte Modul (shade.make); sichtbar ist erst der Schatten, der eine Zellreihe erreicht */
    const frac = t => { const K = C(), p = K.sun.position(N, t, K.sun.site('mitte').lat); if (!(p.alt > 0)) return 1; const o = K.pv.shade.obstacle({ H, D, z0: Z0, l: L, beta: BETA, alt: p.alt, az: p.az, gam: 0 }); if (!(o && fin(o.frac))) return 1; const m = K.pv.shade.make(K.pv.spec('si60'), 'hochkant', 'kante', { frac: o.frac, dunkel: 1 }); return m && fin(m.count) ? m.count : 1; };
    const edge = () => once('edge14', () => { let lo = 7, hi = 12; if (frac(12) > 0) return { von: NaN, bis: NaN }; lo = 7; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (frac(m) > 0) lo = m; else hi = m; } const von = hi; return { von, bis: 24 - von }; });
    const vals = () => once('v14', () => { const e = edge(), K = C(), p = K.sun.position(N, e.von, K.sun.site('mitte').lat), pm = K.sun.position(N, 12, K.sun.site('mitte').lat); return { H, D, von: e.von, bis: e.bis, altVon: p.alt, altMittag: pm.alt, beta: BETA, tol: TOL, z0: Z0, dauer: e.bis - e.von, schwelle: Math.atan((H - Z0) / D) * 180 / Math.PI }; });
    const check = mk('schatten', [], (c, r, a) => {
      const v = vals();
      numRow(r, U.fieldNum(a, 'von'), { label: 'Beginn der schattenfreien Zeit (Sonnenzeit)', refs: [{ v: v.von }], absTol: TOL, unit: 'h', digits: 1, wrong: [{ v: 12, msg: 'Das ist der Mittag. Der Schatten endet schon vorher; schau nach, ab wann die Verschattung im Prüfstand auf 0 % fällt.' }] });
      numRow(r, U.fieldNum(a, 'bis'), { label: 'Ende der schattenfreien Zeit (Sonnenzeit)', refs: [{ v: v.bis }], absTol: TOL, unit: 'h', digits: 1, wrong: [{ v: 12, msg: 'Das ist der Mittag. Der Schatten kehrt erst später zurück; schau nach, ab wann die Verschattung im Prüfstand wieder über 0 % steigt.' }] });
    });
    return { vals, check,
      text: () => 'Eine Hecke von ' + f(H, 1) + ' m Höhe steht ' + f(D, 0) + ' m vor der Unterkante des Moduls (Neigung ' + f(BETA, 0) + '°, Süd, Unterkante in ' + f(Z0, 1) + ' m Höhe). Am 21.12. ist das Modul nur um die Mittagszeit schattenfrei. Von wann bis wann (Sonnenzeit)? Stelle im Prüfstand „Verschattung“ den Schatten „Hecke vor dem Modul“, den Winter und die Werte der Hecke ein und suche die Uhrzeiten, bei denen der verschattete Anteil auf 0 % fällt und wieder steigt.',
      fields: () => [{ key: 'von', label: 'schattenfrei von', unit: 'h' }, { key: 'bis', label: 'schattenfrei bis', unit: 'h' }],
      hint: () => { const v = vals(); return [
        'Der Schatten fällt, solange die Sonne tief steht. Schau, bei welcher Uhrzeit der verschattete Anteil auf 0 % fällt; die Zeit nach dem Mittag ist spiegelbildlich (Sonnenzeit).',
        'Der Schatten verschwindet, wenn die Sonne (in Richtung der Hecke gesehen) höher steht als ' + f(v.schwelle, 1) + '°. Mittags steht sie bei ' + f(v.altMittag, 1) + '°.',
        'Musterlösung: schattenfrei von ' + f(v.von, 1) + ' h bis ' + f(v.bis, 1) + ' h (Toleranz ±' + f(v.tol, 1) + ' h), das sind ' + f(v.dauer, 1) + ' h.'
      ]; },
      start: () => A('schatten', Object.assign({}, SFIX, { schatten: 'hecke', datum: 'winter', hH: H, hD: D, beta: BETA }), { fields: { von: null, bis: null } }),
      sol: () => { const v = vals(); return A('schatten', Object.assign({}, SFIX, { schatten: 'hecke', datum: 'winter', hH: H, hD: D, beta: BETA }), { fields: { von: v.von, bis: v.bis } }); },
      wrong: () => { const v = vals(); return [{ name: 'zu früh und zu spät', answer: A('schatten', {}, { fields: { von: v.von - 1.5, bis: v.bis + 1.5 } }) }, { name: 'zu kurz', answer: A('schatten', {}, { fields: { von: v.von + 1.5, bis: v.bis - 1.5 } }) }]; } };
  })();

  /* ====================================================================== en15: PWM gegen MPPT (Prueftand regler, braucht ENR_CORE.sys) */
  const M15 = (() => {
    const T15 = 600;
    const run = ctrl => U.snap('regler', U.fullCtl('regler', Object.assign({}, RFIX, { ctrl })), T15, { sampleS: 30 });
    const share = s => (s.pMpp > 0 ? 100 * s.pPv / s.pMpp : NaN);
    const vals = () => once('v15', () => { const p = run('pwm').st, m = run('mppt').st; return { qPwm: share(p), anteilPwm: share(p) / 100, qMppt: share(m), uPv: p.uPv, uMpp: p.uMpp, pPwm: p.pPv, pMpp: p.pMpp, pMppt: m.pPv, tol: 5 }; });
    const best = () => { const v = vals(); return v.qMppt > v.qPwm ? 'mppt' : 'pwm'; };
    const check = mk('regler', [], (c, r, a) => {
      const v = vals(), g = choiceOf(a, 'besser'), none = g === undefined || g === null || g === '';
      numRow(r, U.numAns(a), { label: 'Anteil der möglichen Leistung am PWM-Regler in Prozent', refs: [{ v: v.qPwm }], absTol: 5, unit: '%', digits: 0, wrong: [
        { v: 100 - v.qPwm, msg: 'Das ist der Verlust, nicht die Leistung, die bleibt.' },
        { v: v.qMppt, msg: 'Das ist der Wert des MPPT-Reglers. Gefragt ist der PWM-Regler.' }] });
      r(g === best(), 'Der bessere Reglertyp ist richtig gewählt', none ? 'Wähle eine Antwort aus.' : 'Im Prüfstand holt der PWM-Regler ' + vk(v.qPwm, 0) + ' % der möglichen Leistung heraus, der MPPT-Regler ' + vk(v.qMppt, 0) + ' %.');
    });
    return { vals, check,
      text: () => 'Ein 60-Zellen-Modul liegt über einen PWM-Laderegler an einem 12-V-Blei-Akku (Ladezustand 50 %, 800 W/m², Zelltemperatur nach Umgebungstemperatur 20 °C). Wie viel Prozent der möglichen Leistung (Anzeige „MPP“) bleiben am Akku übrig? Welcher Reglertyp holt mehr heraus (PWM oder MPPT)? Stelle im Prüfstand „Laderegler“ das 60-Zellen-Modul ein und vergleiche.',
      choices: () => [{ key: 'besser', q: 'Welcher Reglertyp holt hier mehr Leistung heraus?', options: [{ value: 'pwm', label: 'PWM-Regler' }, { value: 'mppt', label: 'MPPT-Regler' }] }],
      ask: { label: 'Anteil der möglichen Leistung am PWM-Regler', unit: '%' },
      hint: () => { const v = vals(); return [
        'Der PWM-Regler legt das Modul fast direkt an die Akkuspannung. Vergleiche diese Spannung mit der Spannung im MPP des Moduls (Anzeige „MPP-Spannung“).',
        'Das Modul arbeitet bei ' + f(v.uPv, 1) + ' V, im MPP wären es ' + f(v.uMpp, 1) + ' V. Der PWM-Regler liefert ' + f(v.pPwm, 0) + ' W statt ' + f(v.pMpp, 0) + ' W.',
        'Musterlösung: ' + f(v.pPwm, 0) + ' W / ' + f(v.pMpp, 0) + ' W = ' + f(v.anteilPwm, 2) + ', also ' + f(v.qPwm, 0) + ' % (Toleranz ±' + f(v.tol, 0) + ' Prozentpunkte). Der MPPT-Regler kommt auf ' + f(v.qMppt, 0) + ' %.'
      ]; },
      start: () => A('regler', Object.assign({}, RFIX), { value: null, choices: {} }),
      sol: () => A('regler', Object.assign({}, RFIX), { value: vals().qPwm, choices: { besser: best() } }),
      wrong: () => { const v = vals(); return [{ name: 'zu klein', answer: A('regler', {}, { value: v.qPwm * 0.5, choices: { besser: 'pwm' } }) }, { name: 'zu groß', answer: A('regler', {}, { value: Math.min(100, v.qPwm * 1.6), choices: { besser: best() === 'pwm' ? 'mppt' : 'pwm' } }) }]; } };
  })();

  /* ====================================================================== Registrierung */
  T.register([
    def('en1', 'Grundlagen', 'Punkte der Kennlinie zuordnen', 1, 'modul', M1),
    def('en2', 'Kennlinie', 'Leerlaufspannung und Kurzschlussstrom ablesen', 1, 'modul', M2),
    def('en3', 'Kennlinie', 'Leistungsanpassung: den besten Lastwiderstand finden', 1, 'modul', M3),
    def('en4', 'Kennlinie', 'Halbe Einstrahlung', 1, 'modul', M4),
    def('en5', 'Kennlinie', 'Heißer Sommer: Leistungsabnahme', 2, 'modul', M5),
    def('en6', 'Rechnen', 'Füllfaktor berechnen', 1, 'modul', M6),
    def('en7', 'Verschaltung', 'Module in Reihe: Spannungsband', 1, 'modul', M7),
    def('en8', 'Verschaltung', 'Kurzschlussstrom mit möglichst wenigen Modulen', 2, 'modul', M8),
    def('en9', 'Rechnen', 'Strangauslegung bei Kälte', 2, 'modul', M9),
    def('en10', 'Verschattung', 'Ein Laubblatt auf der Zelle', 1, 'schatten', M10),
    def('en11', 'Verschattung', 'Hecke von unten: hochkant oder quer', 2, 'schatten', M11),
    def('en12', 'Verschattung', 'Das globale Maximum finden', 2, 'schatten', M12),
    def('en13', 'Fehlersuche', 'Das Modul wird bei kleinem Schatten heiß', 2, 'schatten', M13),
    def('en14', 'Verschattung', 'Der Schatten der Hecke über den Tag', 3, 'schatten', M14),
    def('en15', 'Laderegler', 'PWM gegen MPPT am 12-V-Akku', 1, 'regler', M15)
  ]);
  /* Musterwerte der Aufgaben en1-en15 (Schwellen aus Musterloesung, Stand 2026-10-22) fuer Tests und Ausbilder */
  T.thresholds1 = () => ({ en3: M3.vals(), en7: M7.vals(), en8: M8.vals(), en9: M9.vals(), en10: M10.vals(), en11: M11.vals(), en12: M12.vals(), en13: M13.vals(), en14: M14.vals(), en15: M15.vals() });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
