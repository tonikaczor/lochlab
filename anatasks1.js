/* anatasks1.js - ANA-Lab (Analogtechnik: Halbleiter und Verstaerker): Aufgaben ae1 bis ae16 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4a.
 * Quelle: quelle/analab/_wp4a/t1_a.js + t1_b.js, zusammengesetzt mit `node quelle/analab/_wp4a/build_ana.js`.
 * Registrierung: ANA_TASKS.register([ ... ]) (ANA_TASKS und ANA_TASKS.util kommen aus anadata.js; anadata.js VOR dieser Datei laden, in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'aeN', lab:'ana', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), value?, fields?, choices?, lock?, hidden? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   Fehlersuche-Aufgaben (ae3, ae8, ae13): start() setzt den Fehler und liefert lock:['fehler'] und hidden:['fehler']; der Fehler steht in keinem Text, Tipp oder Pruefmeldung vor der Antwort.
 *   wrong() liefert mindestens zwei absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Regeln (SPEC Abschnitte 8, 9 und 11):
 *   - Alle Zahlen in text, hint und Pruefmeldungen stammen aus der Simulation (Pruefstaende) und ANA_CORE und stehen in hintVals() (Regel 1); text und hint werden erst beim ersten
 *     Zugriff gerechnet. ANA_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3. Rechnen nur ueber den Kern (exercise.solve, tr, diode, emit, faults, limits).
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert uebereinstimmt;
 *     Auswahlfragen nennen den Fachgrund der gewaehlten Antwort.
 *   - Pool-Zahlen (SPEC 12.1) stehen exakt wie in der Pool-Loesung und werden dem Kern uebergeben (nie durch limits ersetzt); Aufgaben mit Pool-Bezug tragen die Kategorie "Prüfungsnah",
 *     die Fehlersuche-Aufgaben "Fehlersuche", ae11 (Pool-Luecke) "Transistorverstärker". Kategorien: SPEC 8.3.
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (BASE), damit gleiche Eingaben gleiche Ergebnisse liefern.
 *   - Abweichungen von der SPEC: quelle/analab/ABWEICHUNGEN.md, Abschnitt WP4a.
 * Uebungsschaltung: Alle Bauteil- und Anlagenwerte sind Aufgabenwerte. Simulation fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.ANA_TASKS) nodeReq('./anadata.js');
  const T = root.ANA_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('anatasks1.js: anadata.js fehlt, die Aufgaben ae1 bis ae16 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, snap = U.snap, effOf = U.effOf, setRow = U.setRow, fullCtl = U.fullCtl;
  const CORE = () => U.CORE();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const nz = (x, d) => { const t = f(x, d == null ? 1 : d); return t.indexOf(',') >= 0 ? t.replace(/0+$/, '').replace(/,$/, '') : t; };   // Dezimalkomma ohne Endnullen
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const S = (rig, over, extra) => Object.assign({ rig, controls: fullCtl(rig, over) }, extra || {});
  const lim = U.lim;
  const near = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= rel * Math.abs(b) + 1e-12;
  const opt = (value, label, reason) => ({ value, label, reason });
  const isO = U.isObj;
  /* Auswahl der Oberflaeche (Diagnose abgeben) oder eigene Auswahl `ursache` -> choices.ursache */
  const faultAns = a => { const b = isO(a) ? a : {}; return { choices: Object.assign({}, isO(b.choices) ? b.choices : {}, { ursache: U.faultOf(b) }) }; };

  /* ====================================================================== Fehlersuche: gemeinsamer Baustein (ae3, ae8, ae13)
   * spec = { key, rig, base (alle Steuerwerte ausser fehler), fault, cands[], pic(meters) -> Text der Messwerte, text, frage1, frage2, hint[3], wrongs:[{ name, ursache, beleg }] }
   * Der Fehler steht nur in start().controls (gesperrt und verdeckt). Die Ursachen-Auswahl nennt alle Kandidaten, die Messbilder sind aus dem Pruefstand gerechnet. */
  function faultM(spec) {
    const OWN = [], rig = spec.rig;
    const withF = id => fullCtl(rig, Object.assign({}, spec.base, { fehler: id }));
    const pic = id => once(spec.key + ':' + id, () => { const sim = snap(rig, withF(id)); return sim.ok ? spec.pic(sim.m) : 'keine Messwerte'; });
    const allIds = () => once(spec.key + ':all', () => ((U.cdef(rig, 'fehler') || {}).options || []).map(o => (isO(o) ? o.value : o)).filter(v => v !== 'keiner'));
    const O1 = () => U.faultOpts(rig, allIds()).map(o => opt(o.value, o.label, 'Mit dieser Ursache würdest du ' + pic(o.value) + ' messen. Das passt nicht zu deinen Messwerten.'));
    const O1c = () => O1().filter(o => spec.cands.includes(o.value));
    const O2 = () => spec.cands.map(id => opt(id, pic(id), 'Diese Messwerte gehören zu einem anderen Fehlerbild. Vergleiche sie noch einmal mit deinen eigenen Messungen.'));
    const check = mk(rig, OWN, (c, r, a) => {
      const sim = snap(rig, withF(spec.fault));
      inputRow(c, r, sim, a, rig);
      U.choiceRow(r, faultAns(a), { key: 'ursache', right: spec.fault, opts: O1(), label: 'Ursache richtig gewählt' });
      U.choiceRow(r, a, { key: 'beleg', right: spec.fault, opts: O2(), label: 'Die zur Ursache passenden Messwerte richtig gewählt' });
    });
    const ans = (u, b) => S(rig, Object.assign({}, spec.base, { fehler: spec.fault }), { lock: ['fehler'], hidden: ['fehler'], choices: u ? { ursache: u, beleg: b } : {} });
    return { vals: () => ({}), check, consts: [], text: () => spec.text,
      choices: () => [U.choiceDef('ursache', spec.frage1, O1c()), U.choiceDef('beleg', spec.frage2, O2())],
      hint: () => spec.hint,
      start: () => ans(null),
      sol: () => ans(spec.fault, spec.fault),
      wrong: () => spec.wrongs.map(w => ({ name: w.name, answer: ans(w.ursache, w.beleg) })),
      pic, O1c, O2, fault: spec.fault, cands: spec.cands.slice() };
  }

  /* ====================================================================== ae1: LED-Vorwiderstand (Pool) */
  const M1 = (() => {
    const BASE = { typ: 'led_rot', modell: 'konstant', rv: 330, uz: 5.1, rlast: 1e6, temp: 27, fehler: 'keiner', ziel: 0 }, OWN = ['uq'], G = { ub: 5, uf: 1.9, i: 0.01 };
    const vals = () => once('v1', () => { const rv = CORE().diode.rvFor({ uq: G.ub, uf: G.uf, i: G.i }); return { ub: G.ub, uf: G.uf, imA: G.i * 1000, ur: G.ub - G.uf, rv, ohneUf: G.ub / G.i, faktor: rv * 10 }; });
    const ex = () => once('ex1', () => U.calcEx({ kind: 'rvLed', given: G, what: 'Vorwiderstand R_V' }));
    const check = mk('diode', OWN, (c, r, a) => {
      const eff = effOf(c, 'diode', OWN, BASE), sim = snap('diode', eff);
      inputRow(c, r, sim, a, 'diode');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Vorwiderstand R_V berechnet (Toleranz 3 %)');
      setRow(r, 'diode', eff, [{ key: 'uq', want: G.ub, tol: 0.01 }], 'Am Prüfstand ist die Quellenspannung ' + f(G.ub, 0) + ' V eingestellt');
    });
    return { vals, check, consts: [],
      text: () => 'Eine rote LED mit der Flussspannung U_F = ' + f(G.uf, 1) + ' V (bei I_F = ' + f(G.i * 1000, 0) + ' mA) soll an einer ' + f(G.ub, 0) + '-V-Versorgung betrieben werden. Berechne den erforderlichen Vorwiderstand R_V und trage ihn ein. Stelle am Prüfstand die Quellenspannung auf ' + f(G.ub, 0) + ' V ein. Der Prüfstand rechnet mit einem eigenen Übungswert für die rote LED; für die Aufgabe gelten die Werte aus diesem Text.',
      ask: { label: 'Vorwiderstand R_V', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Am Vorwiderstand liegt die Spannung, die an der LED nicht abfällt. Mit dem gewünschten Strom folgt sein Wert aus dem Ohmschen Gesetz.',
        'Am Vorwiderstand liegt U_R = U_B − U_F = ' + f(v.ub, 0) + ' V − ' + f(v.uf, 1) + ' V = ' + f(v.ur, 1) + ' V bei I_F = ' + f(v.imA, 0) + ' mA. Rechnest du nur mit U_B, kommst du auf ' + f(v.ohneUf, 0) + ' Ω: Das ist zu groß, weil U_F nicht abgezogen wurde.',
        'Musterlösung: R_V = (U_B − U_F) / I_F = ' + f(v.ur, 1) + ' V / ' + f(v.imA, 0) + ' mA = ' + f(v.rv, 0) + ' Ω.'
      ]; },
      start: () => S('diode', Object.assign({}, BASE, { uq: 12 }), { value: null }),
      sol: () => S('diode', Object.assign({}, BASE, { uq: G.ub }), { value: vals().rv }),
      wrong: () => { const v = vals(); return [{ name: 'U_F vergessen', answer: S('diode', Object.assign({}, BASE, { uq: G.ub }), { value: v.ohneUf }) }, { name: 'Faktor 10', answer: S('diode', Object.assign({}, BASE, { uq: G.ub }), { value: v.faktor }) }]; } };
  })();

  /* ====================================================================== ae2: Z-Diode, kleinster Vorwiderstand (Pool) */
  const M2 = (() => {
    const G = { uqmax: 24, uz: 12, pz: 0.6 }, BASE = { typ: 'z', modell: 'konstant', uq: G.uqmax, uz: G.uz, rlast: 1e6, temp: 27, fehler: 'keiner', ziel: 0 }, OWN = ['rv'];
    const vals = () => once('v2', () => { const rv = CORE().diode.rvZMin(G); return { uq: G.uqmax, uz: G.uz, pz: G.pz, izmA: G.pz / G.uz * 1000, ur: G.uqmax - G.uz, rv, ohneUz: G.uqmax / (G.pz / G.uz), pmW: G.pz * 1000 }; });
    const ex = () => once('ex2', () => U.calcEx({ kind: 'rvZ', given: G, what: 'kleinster Vorwiderstand R_V,min' }));
    const check = mk('diode', OWN, (c, r, a) => {
      const eff = effOf(c, 'diode', OWN, BASE), sim = snap('diode', eff), v = vals(), p = sim.m && sim.m.pd;
      inputRow(c, r, sim, a, 'diode');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Kleinster Vorwiderstand R_V,min berechnet (Toleranz 3 %)');
      r(fin(p) && near(p, v.pmW, 0.05), 'Am Prüfstand erreicht die Z-Diode mit deinem Vorwiderstand genau die zulässige Verlustleistung ' + f(v.pmW, 0) + ' mW (Toleranz 5 %)',
        'Mit R_V = ' + f(eff.rv, 0) + ' Ω nimmt die Z-Diode im Leerlauf ' + f(p, 0) + ' mW auf. ' + (p > v.pmW ? 'Das ist mehr als erlaubt: Der Vorwiderstand ist zu klein.' : 'Das ist weniger als zulässig: Der kleinste erlaubte Vorwiderstand ist größer als nötig, hier ist er also zu groß.'));
    });
    return { vals, check, consts: [],
      text: () => 'Eine Z-Diode mit U_Z = ' + f(G.uz, 0) + ' V darf höchstens P_Z = ' + f(G.pz, 1) + ' W aufnehmen. Sie wird über einen Vorwiderstand an einer Spannung betrieben, die bis zu ' + f(G.uqmax, 0) + ' V ansteigen kann; im Leerlauf (ohne Last) fließt der gesamte Strom durch die Z-Diode. Berechne den kleinsten zulässigen Vorwiderstand und stelle ihn am Prüfstand ein (Z-Diode, Leerlauf und ' + f(G.uqmax, 0) + ' V sind vorbereitet).',
      ask: { label: 'Kleinster Vorwiderstand R_V,min', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Der größte Strom fließt im Leerlauf bei der höchsten Eingangsspannung. Er wird durch die zulässige Verlustleistung der Z-Diode begrenzt: P = U_Z · I_Z.',
        'I_Z,max = P_Z / U_Z = ' + f(v.pz, 1) + ' W / ' + f(v.uz, 0) + ' V = ' + f(v.izmA, 0) + ' mA. Am Vorwiderstand liegen nur U_max − U_Z = ' + f(v.ur, 0) + ' V. Wer U_Z nicht abzieht, rechnet ' + f(v.uq, 0) + ' V / ' + f(v.izmA, 0) + ' mA = ' + f(v.ohneUz, 0) + ' Ω.',
        'Musterlösung: R_V,min = (U_max − U_Z) / (P_Z / U_Z) = ' + f(v.ur, 0) + ' V / ' + f(v.izmA, 0) + ' mA = ' + f(v.rv, 0) + ' Ω.'
      ]; },
      start: () => S('diode', Object.assign({}, BASE, { rv: 330 }), { value: null }),
      sol: () => S('diode', Object.assign({}, BASE, { rv: vals().rv }), { value: vals().rv }),
      wrong: () => { const v = vals(); return [{ name: 'U_Z nicht abgezogen', answer: S('diode', Object.assign({}, BASE, { rv: v.ohneUz }), { value: v.ohneUz }) },
        { name: 'P_Z / U_Z vergessen', answer: S('diode', Object.assign({}, BASE, { rv: v.ur / G.pz }), { value: v.ur / G.pz }) }]; } };
  })();

  /* ====================================================================== ae3: Fehlersuche: Die LED leuchtet nicht */
  const M3 = faultM({ key: 'f3', rig: 'diode', fault: 'verpolt', cands: ['verpolt', 'diode offen', 'diode kurz', 'rv offen'],
    base: { typ: 'led_rot', modell: 'kennlinie', uq: 5, rv: 330, uz: 5.1, rlast: 1e6, temp: 27, ziel: 0 },
    pic: m => 'U_D = ' + nz(m.ud, 1) + ' V, U_R = ' + nz(m.ur, 1) + ' V, I_D = ' + nz(m.id, 1) + ' mA',
    text: 'Eine rote LED mit Vorwiderstand an einer 5-V-Quelle leuchtet nicht. Der Fehlerfall ist verdeckt („Fehler: ?“). Miss die Spannung an der LED (U_D), die Spannung am Vorwiderstand (U_R) und den Strom (I_D). Vergleiche deine Messwerte mit den Messbildern der Auswahl, wähle die Ursache und wähle dann die Messwerte, die zu dieser Ursache gehören.',
    frage1: 'Welche Ursache passt zu deinen Messwerten?', frage2: 'Welche Messwerte gehören zu dieser Ursache?',
    hint: ['Miss U_D, U_R und I_D und achte auf die Vorzeichen. Fließt kein Strom, bleibt die ganze Quellenspannung an der Stelle stehen, die den Stromweg sperrt.',
      'Vergleiche deine drei Messwerte mit den Messbildern der Auswahl: Genau ein Messbild passt zu allen drei Werten, bei den anderen weicht mindestens ein Wert ab.',
      'Achte besonders auf das Vorzeichen von U_D und darauf, ob die Spannung am Vorwiderstand null oder gleich der Quellenspannung ist. Wähle erst die Ursache, dann das passende Messbild.'],
    wrongs: [{ name: 'Diode kurz statt Ursache aus den Messwerten', ursache: 'diode kurz', beleg: 'diode kurz' }, { name: 'Ursache mit falschen Messwerten begründet', ursache: 'verpolt', beleg: 'rv offen' }] });

  /* ====================================================================== ae4: Basisvorwiderstand (Pool) */
  const M4 = (() => {
    const G = { ust: 3.3, ic: 0.045, b: 110, ueb: 1, ube: 0.7 };
    const BASE = { ub: 12, ust: G.ust, last: 'relais', rspule: 262.2, lspule: 0.3, rlast: 100, uf: 2, rv: 330, b: G.b, freilauf: true, eingang: 'dauer-ein', ftakt: 100, fehler: 'keiner', ziel: 0 }, OWN = ['rb'];
    const vals = () => once('v4', () => { const s = CORE().exercise.solve('rbSchalter', G), sim = snap('schalter', fullCtl('schalter', Object.assign({}, BASE, { rb: s.value }))), ibmin = G.ic / G.b;
      return { ust: G.ust, icmA: G.ic * 1000, b: G.b, ibmA: ibmin * 1000, ur: G.ust - G.ube, rb: s.value, rbk: s.value / 1000, ohneB: (G.ust - G.ube) / G.ic, ohneUbe: G.ust / ibmin, ohneUbeK: G.ust / ibmin / 1000, ubB: BASE.ub, rsp: BASE.rspule, icSim: sim.m.ic }; });
    const ex = () => once('ex4', () => U.calcEx({ kind: 'rbSchalter', given: G, what: 'Basisvorwiderstand R_B' }));
    const check = mk('schalter', OWN, (c, r, a) => {
      const eff = effOf(c, 'schalter', OWN, BASE), sim = snap('schalter', eff), u = sim.m && sim.m.ueb;
      inputRow(c, r, sim, a, 'schalter');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Basisvorwiderstand R_B für ü = 1 berechnet (Toleranz 3 %)');
      r(fin(u) && u >= 0.95 && u <= 1.05, 'Am Prüfstand liefert dein Basisvorwiderstand den Übersteuerungsfaktor ü = 1 (Toleranz ±5 %)',
        'Mit R_B = ' + f(eff.rb / 1000, 2) + ' kΩ ist ü = ' + f(u, 2) + '. ' + (u > 1.05 ? 'Es fließt mehr Basisstrom als nötig: Der Widerstand ist für ü = 1 zu klein.' : 'Es fließt weniger Basisstrom als für die Sättigung nötig: Der Widerstand ist zu groß.'));
    });
    return { vals, check, consts: [G.ube],
      text: () => { const v = vals(); return 'Ein Mikrocontroller-Ausgang (High-Pegel ' + f(G.ust, 1) + ' V) soll einen npn-Transistor schalten, der einen Relaisspulenstrom von ' + f(G.ic * 1000, 0) + ' mA führt (Prüfstand: Relais mit ' + f(BASE.rspule, 0) + ' Ω an ' + f(BASE.ub, 0) + ' V, I_C = ' + f(v.icSim, 0) + ' mA). Für die Auslegung gilt die kleinste Gleichstromverstärkung B = ' + f(G.b, 0) + ' (keine Übersteuerung, ü = 1) und U_BE = ' + f(G.ube, 1) + ' V. Berechne den Basisvorwiderstand R_B und stelle ihn am Prüfstand ein.'; },
      ask: { label: 'Basisvorwiderstand R_B', unit: 'kΩ' },
      hint: () => { const v = vals(); return [
        'Der Basisstrom ist der Kollektorstrom geteilt durch die Gleichstromverstärkung. Am Basisvorwiderstand liegt die Steuerspannung abzüglich U_BE.',
        'I_B = I_C / B = ' + f(v.icmA, 0) + ' mA / ' + f(v.b, 0) + ' = ' + f(v.ibmA, 3) + ' mA und U_R = ' + f(v.ust, 1) + ' V − ' + f(G.ube, 1) + ' V = ' + f(v.ur, 1) + ' V. Ohne B kämst du auf ' + f(v.ohneB, 1) + ' Ω, ohne U_BE auf ' + f(v.ohneUbeK, 2) + ' kΩ.',
        'Musterlösung: R_B = (U_St − U_BE) / I_B = ' + f(v.ur, 1) + ' V / ' + f(v.ibmA, 3) + ' mA = ' + f(v.rbk, 2) + ' kΩ.'
      ]; },
      start: () => S('schalter', Object.assign({}, BASE, { rb: 4700 }), { value: null }),
      sol: () => S('schalter', Object.assign({}, BASE, { rb: vals().rb }), { value: vals().rb }),
      wrong: () => { const v = vals(); return [{ name: 'B vergessen', answer: S('schalter', Object.assign({}, BASE, { rb: v.ohneB }), { value: v.ohneB }) }, { name: 'U_BE vergessen', answer: S('schalter', Object.assign({}, BASE, { rb: v.ohneUbe }), { value: v.ohneUbe }) }]; } };
  })();

  /* ====================================================================== ae5: Uebersteuerung (Pool) */
  const M5 = (() => {
    const G = { ust: 3.3, ic: 0.06, b: 100, ueb: 3, ube: 0.7 };
    const BASE = { ub: 12, ust: G.ust, last: 'relais', rspule: 196.7, lspule: 0.3, rlast: 100, uf: 2, rv: 330, b: G.b, freilauf: true, eingang: 'dauer-ein', ftakt: 100, fehler: 'keiner', ziel: 0 }, OWN = ['rb'];
    const vals = () => once('v5', () => { const s = CORE().exercise.solve('rbSchalter', G), ibmin = G.ic / G.b;
      return { ust: G.ust, icmA: G.ic * 1000, b: G.b, ueb: G.ueb, ibmA: G.ueb * ibmin * 1000, ur: G.ust - G.ube, rb: s.value, rbk: s.value / 1000, ohneUeb: (G.ust - G.ube) / ibmin, malUeb: G.ueb * (G.ust - G.ube) / ibmin }; });
    const ex = () => once('ex5', () => U.calcEx({ kind: 'rbSchalter', given: G, what: 'Basisvorwiderstand R_B' }));
    const check = mk('schalter', OWN, (c, r, a) => {
      const eff = effOf(c, 'schalter', OWN, BASE), sim = snap('schalter', eff), u = sim.m && sim.m.ueb;
      inputRow(c, r, sim, a, 'schalter');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Basisvorwiderstand R_B für dreifache Übersteuerung berechnet (Toleranz 3 %)');
      r(fin(u) && u >= 2.85 && u <= 3.15, 'Am Prüfstand liefert dein Basisvorwiderstand den Übersteuerungsfaktor ü = ' + f(G.ueb, 0) + ' (Toleranz ±5 %)',
        'Mit R_B = ' + f(eff.rb, 0) + ' Ω ist ü = ' + f(u, 2) + '. ' + (u > 3.15 ? 'Der Basisstrom ist größer als für ü = 3 nötig: Der Widerstand ist zu klein.' : 'Der Basisstrom ist kleiner als für ü = 3 nötig: Der Widerstand ist zu groß.'));
    });
    return { vals, check, consts: [G.ube],
      text: () => 'Ein Mikrocontroller-Port (' + f(G.ust, 1) + ' V) schaltet über einen Basisvorwiderstand einen npn-Transistor, der einen Kollektorstrom von ' + f(G.ic * 1000, 0) + ' mA führen soll (Prüfstand: Relais mit ' + f(BASE.rspule, 1) + ' Ω an ' + f(BASE.ub, 0) + ' V). Gleichstromverstärkung B = ' + f(G.b, 0) + ', U_BE = ' + f(G.ube, 1) + ' V. Der Transistor wird mit dreifacher Übersteuerung betrieben (I_B = 3 · I_C / B). Berechne R_B und stelle ihn am Prüfstand ein.',
      ask: { label: 'Basisvorwiderstand R_B', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Bei Übersteuerung fließt ein Vielfaches des Mindest-Basisstroms I_C / B. Je mehr Basisstrom, desto kleiner der Basisvorwiderstand.',
        'I_B = ü · I_C / B = ' + f(v.ueb, 0) + ' · ' + f(v.icmA, 0) + ' mA / ' + f(v.b, 0) + ' = ' + f(v.ibmA, 1) + ' mA. Ohne ü würdest du ' + f(v.ohneUeb, 0) + ' Ω erhalten; wer mit ü malnimmt statt zu teilen, kommt auf ' + f(v.malUeb, 0) + ' Ω.',
        'Musterlösung: R_B = (U_St − U_BE) / I_B = ' + f(v.ur, 1) + ' V / ' + f(v.ibmA, 1) + ' mA = ' + f(v.rb, 0) + ' Ω.'
      ]; },
      start: () => S('schalter', Object.assign({}, BASE, { rb: 4700 }), { value: null }),
      sol: () => S('schalter', Object.assign({}, BASE, { rb: vals().rb }), { value: vals().rb }),
      wrong: () => { const v = vals(); return [{ name: 'Übersteuerung vergessen', answer: S('schalter', Object.assign({}, BASE, { rb: v.ohneUeb }), { value: v.ohneUeb }) }, { name: 'mal ü statt geteilt', answer: S('schalter', Object.assign({}, BASE, { rb: v.malUeb }), { value: v.malUeb }) }]; } };
  })();

  /* ====================================================================== ae6: LED ueber Transistor (Pool) */
  const M6 = (() => {
    const G = { ub: 5, uf: 2.0, rv: 330, ucesat: 0.2 };
    const BASE = { ub: G.ub, ust: 5, last: 'led', uf: G.uf, rv: G.rv, rspule: 240, lspule: 0.3, rlast: 100, b: 100, freilauf: true, eingang: 'dauer-ein', ftakt: 100, fehler: 'keiner', ziel: 0 }, OWN = ['rb'];
    const vals = () => once('v6', () => { const s = CORE().exercise.solve('icLast', G);
      return { ub: G.ub, uf: G.uf, rv: G.rv, ucesat: G.ucesat, icmA: s.value * 1000, ic: s.value, ur: G.ub - G.uf - G.ucesat, ohneUcesat: (G.ub - G.uf) / G.rv * 1000, ohneUf: (G.ub - G.ucesat) / G.rv * 1000, rbk: 4.7 }; });
    const ex = () => once('ex6', () => U.calcEx({ kind: 'icLast', given: G, what: 'Strom durch die LED' }));
    const check = mk('schalter', OWN, (c, r, a) => {
      const eff = effOf(c, 'schalter', OWN, BASE), sim = snap('schalter', eff);
      inputRow(c, r, sim, a, 'schalter');
      r(sim.s && sim.s.zustand === 'saettigung', 'Am Prüfstand ist der Transistor durchgesteuert (gesättigt)',
        'Der Transistor ist am Prüfstand ' + (sim.s && sim.s.zustand === 'aktiv' ? 'nur aktiv (halb offen): Mit R_B = ' + f(eff.rb / 1000, 1) + ' kΩ fließt zu wenig Basisstrom, ü = ' + f(sim.m.ueb, 2) + '.' : 'nicht gesättigt (Zustand „' + (sim.s ? sim.s.zustand : '–') + '“).') + ' Verkleinere R_B, bis ü über 1 liegt.');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Strom durch die LED berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Logikgatter steuert über einen Basiswiderstand einen npn-Transistor in die Sättigung. Im Kollektorkreis liegen an ' + f(G.ub, 0) + ' V eine rote Leuchtdiode (U_F = ' + f(G.uf, 1) + ' V) in Reihe mit einem Vorwiderstand von ' + f(G.rv, 0) + ' Ω. Die Sättigungsspannung beträgt U_CE,sat = ' + f(G.ucesat, 1) + ' V. Stelle am Prüfstand R_B so ein, dass der Transistor durchsteuert, und berechne den Strom durch die LED.',
      ask: { label: 'LED-Strom I_C', unit: 'mA' },
      hint: () => { const v = vals(); return [
        'Im Kollektorkreis liegt die Betriebsspannung über drei Teilen in Reihe: LED, Vorwiderstand und gesättigter Transistor. Der Vorwiderstand bekommt, was die beiden anderen übrig lassen.',
        'Am Vorwiderstand liegen U_B − U_F − U_CE,sat = ' + f(v.ub, 0) + ' V − ' + f(v.uf, 1) + ' V − ' + f(v.ucesat, 1) + ' V = ' + f(v.ur, 1) + ' V. Ohne U_CE,sat kämst du auf ' + f(v.ohneUcesat, 2) + ' mA, ohne U_F auf ' + f(v.ohneUf, 1) + ' mA.',
        'Musterlösung: I_C = (U_B − U_F − U_CE,sat) / R_V = ' + f(v.ur, 1) + ' V / ' + f(v.rv, 0) + ' Ω = ' + f(v.icmA, 2) + ' mA; am Prüfstand R_B = ' + f(v.rbk, 1) + ' kΩ.'
      ]; },
      start: () => S('schalter', Object.assign({}, BASE, { rb: 200000 }), { value: null }),
      sol: () => S('schalter', Object.assign({}, BASE, { rb: 4700 }), { value: vals().ic }),
      wrong: () => { const v = vals(); return [{ name: 'U_CE,sat vergessen', answer: S('schalter', Object.assign({}, BASE, { rb: 4700 }), { value: v.ohneUcesat / 1000 }) }, { name: 'U_F vergessen', answer: S('schalter', Object.assign({}, BASE, { rb: 4700 }), { value: v.ohneUf / 1000 }) }]; } };
  })();

  /* ====================================================================== ae7: Relais und Freilaufdiode (Auswahl, Pool) */
  const M7 = (() => {
    const BASE = { ub: 12, ust: 3.3, last: 'relais', uf: 2, rv: 330, rspule: 240, lspule: 0.3, rlast: 100, rb: 2200, b: 100, eingang: 'takt', ftakt: 100, fehler: 'keiner', ziel: 0 }, OWN = ['freilauf'];
    const vals = () => once('v7', () => { const on = snap('schalter', fullCtl('schalter', Object.assign({}, BASE, { freilauf: true }))), off = snap('schalter', fullCtl('schalter', Object.assign({}, BASE, { freilauf: false })));
      return { ub: BASE.ub, mit: on.s.ucePeak, ohne: off.s.ucePeak, ufd: lim('ufd_freilauf'), uceo: lim('uceo') }; });
    const O1 = () => [
      opt('ab', 'Sie nimmt beim Abschalten den Spulenstrom auf und verhindert Spannungsspitzen am Transistor.', ''),
      opt('ha', 'Sie erhöht die Haltespannung des Relais.', 'Die Diode liegt in Sperrrichtung und sperrt im normalen Betrieb: Sie liegt dann nicht im Stromweg und ändert die Spannung an der Spule nicht.'),
      opt('es', 'Sie begrenzt den Einschaltstrom der Spule.', 'Beim Einschalten sperrt die Diode. Wie schnell der Strom steigt, bestimmt die Zeitkonstante τ = L / R der Spule, nicht die Diode.'),
      opt('sp', 'Sie schützt die Spule vor Überspannung.', 'Die Spannungsspitze entsteht beim Abschalten durch die Spule und läge sonst am Transistor. Die Freilaufdiode schützt deshalb den Transistor.')];
    const O2 = () => { const v = vals(); return [
      opt('mit', nz(v.mit, 1) + ' V', ''),
      opt('ub', nz(v.ub, 0) + ' V', 'Das ist nur die Betriebsspannung. Die Freilaufdiode leitet erst, wenn die Spule über die Betriebsspannung hinausgeht; dann liegen U_B plus Flussspannung der Diode am Transistor.'),
      opt('ohne', nz(v.ohne, 0) + ' V', 'Das ist die Spitze ohne Freilaufdiode (Durchbruchspannung U_CEO im Modell). Mit eingeschalteter Freilaufdiode bleibt sie deutlich darunter.'),
      opt('ufd', nz(v.ufd, 1) + ' V', 'Das ist nur die Flussspannung der Diode. Am Transistor liegt zusätzlich die Betriebsspannung.')]; };
    const check = mk('schalter', OWN, (c, r, a) => {
      const eff = effOf(c, 'schalter', OWN, BASE), sim = snap('schalter', eff), v = vals();
      inputRow(c, r, sim, a, 'schalter');
      r(eff.freilauf === true && sim.s && sim.s.ueberUceo === false && near(sim.s.ucePeak, v.mit, 0.01), 'Am Prüfstand ist die Freilaufdiode eingeschaltet (Spitze am Transistor ' + nz(v.mit, 1) + ' V)',
        eff.freilauf === true ? 'Die Spitze am Transistor ist ' + f(sim.s ? sim.s.ucePeak : NaN, 1) + ' V.' : 'Die Freilaufdiode ist am Prüfstand ausgeschaltet: Die Spitze am Transistor steigt im Modell bis ' + f(sim.s ? sim.s.ucePeak : NaN, 0) + ' V (Fehlerbild, nur Simulation). Schalte die Diode ein.');
      U.choiceRow(r, a, { key: 'aufgabe', right: 'ab', opts: O1(), label: 'Aufgabe der Freilaufdiode richtig gewählt' });
      U.choiceRow(r, a, { key: 'spitze', right: 'mit', opts: O2(), label: 'Spannungsspitze am Transistor mit Freilaufdiode richtig gewählt' });
    });
    return { vals, check, consts: [],
      text: () => 'Ein Transistor schaltet eine Relaisspule an ' + f(BASE.ub, 0) + ' V (Spule ' + f(BASE.rspule, 0) + ' Ω, ' + f(BASE.lspule, 1) + ' H). Parallel zur Spule liegt eine Diode in Sperrrichtung (bezogen auf die Betriebsspannung). Der Prüfstand zeigt den Aufbau zunächst ohne Diode (Fehlerbild, nur Simulation). Schalte die Freilaufdiode ein, lies die Spannungsspitze am Transistor ab und beantworte die beiden Fragen.',
      choices: () => [U.choiceDef('aufgabe', 'Welche Aufgabe hat die Freilaufdiode?', O1()), U.choiceDef('spitze', 'Wie hoch ist die Spannungsspitze am Transistor mit Freilaufdiode?', O2())],
      hint: () => { const v = vals(); return [
        'Eine Spule hält ihren Strom aufrecht. Beim Abschalten induziert sie eine Spannung mit umgekehrter Polarität (Selbstinduktion). Die Diode muss diesen Strom aufnehmen können.',
        'Mit Freilaufdiode erreicht die Spannung am Transistor nur U_B + U_FD = ' + f(v.ub, 0) + ' V + ' + f(v.ufd, 1) + ' V = ' + f(v.mit, 1) + ' V. Ohne Diode steigt sie im Modell bis zur Durchbruchspannung ' + f(v.ohne, 0) + ' V (Übungswert).',
        'Musterlösung: Aufgabe: Spulenstrom beim Abschalten aufnehmen und Spannungsspitzen am Transistor verhindern. Spitze mit Diode: ' + f(v.mit, 1) + ' V; am Prüfstand die Freilaufdiode einschalten.'
      ]; },
      start: () => S('schalter', Object.assign({}, BASE, { freilauf: false }), { choices: {} }),
      sol: () => S('schalter', Object.assign({}, BASE, { freilauf: true }), { choices: { aufgabe: 'ab', spitze: 'mit' } }),
      wrong: () => [{ name: 'erhöht die Haltespannung', answer: S('schalter', Object.assign({}, BASE, { freilauf: true }), { choices: { aufgabe: 'ha', spitze: 'mit' } }) },
        { name: 'schützt die Spule, Spitze ohne Diode abgelesen', answer: S('schalter', Object.assign({}, BASE, { freilauf: false }), { choices: { aufgabe: 'sp', spitze: 'ohne' } }) }] };
  })();

  /* ====================================================================== ae8: Fehlersuche: Das Relais zieht nicht an */
  const M8 = faultM({ key: 'f8', rig: 'schalter', fault: 'last offen', cands: ['rb offen', 'last offen', 'versorgung fehlt', 'ce schluss'],
    base: { ub: 12, ust: 3.3, last: 'relais', uf: 2, rv: 330, rspule: 240, lspule: 0.3, rlast: 100, rb: 2200, b: 100, freilauf: true, eingang: 'dauer-ein', ftakt: 100, ziel: 0 },
    pic: m => 'I_B = ' + nz(m.ib, 0) + ' µA, I_C = ' + nz(m.ic, 0) + ' mA, U_CE = ' + nz(m.uce, 1) + ' V, U_B = ' + nz(m.ubm, 1) + ' V',
    text: 'Ein Transistor soll ein Relais schalten (12 V, Steuerspannung 3,3 V, Dauer-Ein), das Relais zieht aber nicht an. Der Fehlerfall ist verdeckt („Fehler: ?“). Miss I_B, I_C, U_CE und die Betriebsspannung U_B (gemessen) und vergleiche mit den Messbildern der Auswahl. Wähle die Ursache und danach die Messwerte, die zu dieser Ursache gehören.',
    frage1: 'Welche Ursache passt zu deinen Messwerten?', frage2: 'Welche Messwerte gehören zu dieser Ursache?',
    hint: ['Das Relais zieht nur an, wenn ein Kollektorstrom fließt. Miss, ob Basisstrom fließt, ob Kollektorstrom fließt und wie viel Spannung am Transistor abfällt.',
      'Sieh zuerst auf I_B: Fließt Basisstrom oder nicht? Dann auf U_CE: Liegt sie nahe bei null, gleich der Betriebsspannung oder dazwischen? Prüfe zuletzt, ob die gemessene Betriebsspannung U_B am Prüfstand überhaupt anliegt. Vergleiche die Kombination mit den Messbildern.',
      'Schau auf alle vier Messwerte zusammen. Zwei Messbilder haben keinen Kollektorstrom und eine sehr kleine Spannung U_CE und sind allein daran schlecht zu trennen: Ob die Versorgung überhaupt anliegt, zeigt die gemessene Betriebsspannung U_B, und der Basisstrom zeigt, ob die Steuerung noch arbeitet.'],
    wrongs: [{ name: 'Basisvorwiderstand statt Last', ursache: 'rb offen', beleg: 'rb offen' }, { name: 'Ursache mit falschen Messwerten begründet', ursache: 'last offen', beleg: 'versorgung fehlt' }] });

  /* ====================================================================== ae9: Basisspannungsteiler (Pool) */
  const M9 = (() => {
    const G = { u2: 3, i1: 0.8e-3, ib: 0.08e-3 };
    const vals = () => once('v9', () => { const s = CORE().exercise.solve('r2Teiler', G); return { u2: G.u2, i1mA: G.i1 * 1000, ibmA: G.ib * 1000, i2mA: (G.i1 - G.ib) * 1000, rk: s.value / 1000, r2: s.value, ohneIb: G.u2 / G.i1 / 1000, plusIb: G.u2 / (G.i1 + G.ib) / 1000 }; });
    const ex = () => once('ex9', () => U.calcEx({ kind: 'r2Teiler', given: G, what: 'Widerstand R_2' }));
    const check = mk('emitter', [], (c, r, a) => {
      const sim = snap('emitter', fullCtl('emitter', {}));
      inputRow(c, r, sim, a, 'emitter');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Widerstand R_2 berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Transistor wird über einen Basisspannungsteiler eingestellt. Durch R_1 (von der Betriebsspannung zum Basisknoten) fließen ' + f(G.i1 * 1000, 1) + ' mA, der Basisstrom beträgt ' + f(G.ib * 1000, 2) + ' mA, und über R_2 (vom Basisknoten nach Masse) fallen ' + f(G.u2, 0) + ' V ab. Berechne R_2.',
      ask: { label: 'Widerstand R_2', unit: 'kΩ' },
      hint: () => { const v = vals(); return [
        'Am Basisknoten teilt sich der Strom aus R_1: Ein Teil fließt als Basisstrom in den Transistor, der Rest als Querstrom durch R_2 nach Masse.',
        'Der Querstrom ist I_2 = I_1 − I_B = ' + f(v.i1mA, 1) + ' mA − ' + f(v.ibmA, 2) + ' mA = ' + f(v.i2mA, 2) + ' mA. Rechnest du R_2 mit I_1 statt I_2, kommst du auf ' + f(v.ohneIb, 2) + ' kΩ.',
        'Musterlösung: R_2 = U_2 / (I_1 − I_B) = ' + f(v.u2, 0) + ' V / ' + f(v.i2mA, 2) + ' mA = ' + f(v.rk, 2) + ' kΩ.'
      ]; },
      start: () => S('emitter', {}, { value: null }),
      sol: () => S('emitter', {}, { value: vals().r2 }),
      wrong: () => { const v = vals(); return [{ name: 'I_B nicht abgezogen', answer: S('emitter', {}, { value: v.ohneIb * 1000 }) }, { name: 'I_B addiert statt abgezogen', answer: S('emitter', {}, { value: v.plusIb * 1000 }) }]; } };
  })();

  /* ====================================================================== ae10: Arbeitspunkt U_CE (Pool) */
  const M10 = (() => {
    const G = { ub: 15, rc: 1000, b: 100, ubase: 5, rb: 43000, ube: 0.7 };
    const SETUP = { ub: G.ub, ust: G.ubase, last: 'ohm', rlast: G.rc, rb: G.rb, b: G.b }, OWN = ['ub', 'ust', 'last', 'rlast', 'rb', 'b'];
    const BASE = { uf: 2, rv: 330, rspule: 240, lspule: 0.3, freilauf: true, eingang: 'dauer-ein', ftakt: 100, fehler: 'keiner', ziel: 0 };
    const vals = () => once('v10', () => { const s = CORE().exercise.solve('ucePunkt', G), ib = (G.ubase - G.ube) / G.rb; return { ub: G.ub, ubase: G.ubase, rbk: G.rb / 1000, rc: G.rc, b: G.b, ibmA: ib * 1000, ur: G.ubase - G.ube, icmA: G.b * ib * 1000, urc: G.b * ib * G.rc, uce: s.value, ohneUbe: (G.ub - G.b * (G.ubase / G.rb) * G.rc), ausUb: G.ub - G.b * (G.ub - G.ube) / G.rb * G.rc }; });
    const ex = () => once('ex10', () => U.calcEx({ kind: 'ucePunkt', given: G, what: 'Spannung U_CE' }));
    const check = mk('schalter', OWN, (c, r, a) => {
      const eff = effOf(c, 'schalter', OWN, BASE), sim = snap('schalter', eff);
      inputRow(c, r, sim, a, 'schalter');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Spannung U_CE berechnet (Toleranz 3 %)');
      setRow(r, 'schalter', eff, [{ key: 'last', want: 'ohm' }, { key: 'ub', want: G.ub, tol: 0.01 }, { key: 'ust', want: G.ubase, tol: 0.01 }, { key: 'rlast', want: G.rc, tol: 0.02 }, { key: 'rb', want: G.rb, tol: 0.02 }, { key: 'b', want: G.b, tol: 0.01 }], 'Der Prüfstand ist auf die Aufgabe eingestellt (Widerstandslast, ' + f(G.ub, 0) + ' V, ' + f(G.ubase, 0) + ' V, ' + f(G.rb / 1000, 0) + ' kΩ, B = ' + f(G.b, 0) + ')');
      r(sim.s && sim.s.zustand === 'aktiv', 'Der Transistor arbeitet im aktiven Bereich (nicht gesättigt)', 'Der Transistor ist am Prüfstand „' + (sim.s ? sim.s.zustand : '–') + '“: Stelle die Werte der Aufgabe ein, dann arbeitet er im aktiven Bereich.');
    });
    return { vals, check, consts: [G.ube],
      text: () => 'Ein npn-Transistor (B = ' + f(G.b, 0) + ', U_BE = ' + f(G.ube, 1) + ' V) erhält seinen Basisstrom über ' + f(G.rb / 1000, 0) + ' kΩ aus +' + f(G.ubase, 0) + ' V. Im Kollektorkreis liegt ein Widerstand von ' + f(G.rc / 1000, 0) + ' kΩ an +' + f(G.ub, 0) + ' V, der Emitter liegt auf 0 V. Stelle die Schaltung am Prüfstand ein (Widerstandslast, Steuerspannung ' + f(G.ubase, 0) + ' V, R_B, B) und berechne U_CE.',
      ask: { label: 'Spannung U_CE', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Rechne der Reihe nach: Basisstrom, Kollektorstrom, Spannungsabfall am Kollektorwiderstand, dann U_CE. Prüfe am Ende, ob der Transistor wirklich nicht gesättigt ist.',
        'I_B = (U_St − U_BE) / R_B = ' + f(v.ur, 1) + ' V / ' + f(v.rbk, 0) + ' kΩ = ' + f(v.ibmA, 1) + ' mA und I_C = B · I_B = ' + f(v.icmA, 0) + ' mA. Mit dem Basisstrom aus der Betriebsspannung statt aus ' + f(v.ubase, 0) + ' V kämst du auf ' + f(v.ausUb, 1) + ' V: negativ geht nicht.',
        'Musterlösung: U_RC = I_C · R_C = ' + f(v.urc, 0) + ' V, also U_CE = U_B − U_RC = ' + f(v.ub, 0) + ' V − ' + f(v.urc, 0) + ' V = ' + f(v.uce, 0) + ' V (nicht gesättigt, da über U_CE,sat).'
      ]; },
      start: () => S('schalter', Object.assign({}, BASE, { ub: 5, ust: 5, last: 'led', rb: 4700, b: 100 }), { value: null }),
      sol: () => S('schalter', Object.assign({}, BASE, SETUP), { value: vals().uce }),
      wrong: () => { const v = vals(); return [{ name: 'Basisstrom aus der Betriebsspannung', answer: S('schalter', Object.assign({}, BASE, SETUP), { value: v.ausUb }) }, { name: 'U_BE vergessen', answer: S('schalter', Object.assign({}, BASE, SETUP), { value: v.ohneUbe }) }]; } };
  })();

  /* ====================================================================== ae11: Verstaerkung der Emitterschaltung (Pool-Luecke) */
  const M11 = (() => {
    const BASE = { ub: 12, ue: 0.02, f: 1000, rg: 600, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: true, c1: 1e-5, c2: 1e-5, b: 100, fehler: 'keiner', zielUce: 0, zielVu: 0, ansicht: 'signal' }, OWN = ['rl'], UT = 0.026;
    const leer = () => once('leer11', () => snap('emitter', fullCtl('emitter', Object.assign({}, BASE, { rl: 1e6 }))));
    /* r_e = U_T / I_E (einheitlich mit dem Kern, Review v23 Fach 4): I_E = I_C + I_B aus dem Prüfstand; das Kern-Feld der Aufgabenart vuGegen heißt `ic`, enthält hier aber den Emitterstrom */
    const ieOf = () => leer().s.ic + leer().s.ib;
    const given = () => ({ rc: BASE.rc, rE: BASE.re1, ic: ieOf(), ut: UT });
    const vals = () => once('v11', () => { const s = CORE().exercise.solve('vuGegen', given()), L = leer(), ic = L.s.ic, ie = ieOf();
      return { rc: BASE.rc, re: BASE.re1, icmA: ic * 1000, ibuA: L.s.ib * 1e6, iemA: ie * 1000, utmV: UT * 1000, rez: UT / ie, nenner: BASE.re1 + UT / ie, vu: s.value, ohneRe: -BASE.rc / BASE.re1, vzf: -s.value, exakt: L.m.vu, abw: Math.abs(s.value / L.m.vu - 1) * 100, ph: lim('emitter_phase') }; });
    const ex = () => once('ex11', () => U.calcEx({ kind: 'vuGegen', given: given(), what: 'Spannungsverstärkung V_u', altExtra: [leer().m.vu] }));
    const O1 = () => [
      opt('p180', 'Der Ausgang ist gegenüber dem Eingang um 180° gedreht.', ''),
      opt('p0', 'Ausgang und Eingang sind in Phase (0°).', 'Das gilt für die Kollektorschaltung. In der Emitterschaltung senkt ein größerer Kollektorstrom die Kollektorspannung: Der Ausgang ist gegenüber dem Eingang gedreht.'),
      opt('p90', 'Der Ausgang eilt dem Eingang um 90° voraus.', 'Eine feste Phasenverschiebung von 90° gibt es im Durchlassbereich der Emitterschaltung nicht; die Koppelkondensatoren verschieben die Phase nur bei sehr tiefen Frequenzen.')];
    const check = mk('emitter', OWN, (c, r, a) => {
      const eff = effOf(c, 'emitter', OWN, BASE), sim = snap('emitter', eff);
      inputRow(c, r, sim, a, 'emitter');
      setRow(r, 'emitter', eff, [{ key: 'rl', want: 1e6, tol: 0.01 }], 'Am Prüfstand ist der Lastwiderstand auf Leerlauf gestellt (oberer Anschlag)');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Spannungsverstärkung V_u berechnet, mit Vorzeichen (Toleranz 3 %)');
      U.choiceRow(r, a, { key: 'phase', right: 'p180', opts: O1(), label: 'Phasenlage der Emitterschaltung richtig gewählt' });
    });
    return { vals, check, consts: [UT * 1000],
      text: () => { const v = vals(); return 'Die Emitterschaltung (U_B = ' + f(BASE.ub, 0) + ' V, R_C = ' + f(BASE.rc / 1000, 1) + ' kΩ, R_E1 = ' + f(BASE.re1, 0) + ' Ω, R_E2 überbrückt mit C_E) soll im Leerlauf verstärken. Stelle am Prüfstand den Lastwiderstand auf den oberen Anschlag (Leerlauf) und lies I_C und I_B ab (' + f(v.icmA, 3) + ' mA und ' + f(v.ibuA, 2) + ' µA); der Emitterstrom ist I_E = I_C + I_B. Berechne die Spannungsverstärkung mit der Tabellenbuch-Näherung V_u ≈ −R_C / (R_E1 + r_e) und r_e = U_T / I_E (U_T = ' + f(UT * 1000, 0) + ' mV, Übungswert). Trage V_u mit Vorzeichen ein und wähle die Phasenlage.'; },
      ask: { label: 'Spannungsverstärkung V_u (mit Vorzeichen)', unit: '' },
      choices: () => [U.choiceDef('phase', 'Wie liegt der Ausgang gegenüber dem Eingang?', O1())],
      hint: () => { const v = vals(); return [
        'Für das Signal wirkt bei überbrücktem R_E2 nur R_E1 als Gegenkopplung, dazu kommt der innere Emitterwiderstand r_e = U_T / I_E des Transistors (I_E = I_C + I_B, bei großem B nur wenig größer als I_C). Ohne Last arbeitet R_C allein.',
        'I_E = I_C + I_B = ' + f(v.icmA, 3) + ' mA + ' + f(v.ibuA, 2) + ' µA = ' + f(v.iemA, 3) + ' mA; r_e = U_T / I_E = ' + f(v.utmV, 0) + ' mV / ' + f(v.iemA, 3) + ' mA = ' + f(v.rez, 2) + ' Ω; im Nenner steht R_E1 + r_e = ' + f(v.nenner, 2) + ' Ω. Lässt du r_e weg, erhältst du ' + f(v.ohneRe, 0) + '; fehlt das Minuszeichen, ist dein Wert ' + f(v.vzf, 2) + '.',
        'Musterlösung: V_u ≈ −' + f(v.rc, 0) + ' Ω / ' + f(v.nenner, 2) + ' Ω = ' + f(v.vu, 2) + ', Phase ' + f(v.ph, 0) + '°. Der Prüfstand zeigt im Leerlauf ' + f(v.exakt, 2) + ' (exakte Rechnung), die Näherung liegt ' + f(v.abw, 1) + ' % daneben.'
      ]; },
      start: () => S('emitter', Object.assign({}, BASE, { rl: 10000 }), { value: null, choices: {} }),
      sol: () => S('emitter', Object.assign({}, BASE, { rl: 1e6 }), { value: vals().vu, choices: { phase: 'p180' } }),
      wrong: () => { const v = vals(); return [{ name: 'Vorzeichen vergessen', answer: S('emitter', Object.assign({}, BASE, { rl: 1e6 }), { value: v.vzf, choices: { phase: 'p180' } }) },
        { name: 'r_e vergessen', answer: S('emitter', Object.assign({}, BASE, { rl: 1e6 }), { value: v.ohneRe, choices: { phase: 'p180' } }) },
        { name: 'Phase 0° gewählt', answer: S('emitter', Object.assign({}, BASE, { rl: 1e6 }), { value: v.vu, choices: { phase: 'p0' } }) }]; } };
  })();

  /* ====================================================================== ae12: Arbeitspunkt einstellen (Verhalten, Pool-Stil) */
  const M12 = (() => {
    const ZIEL = 6, BASE = { ub: 12, ue: 0.1, f: 1000, rg: 600, rc: 2200, re1: 100, re2: 470, ce: true, c1: 1e-5, c2: 1e-5, b: 100, rl: 10000, fehler: 'keiner', zielUce: ZIEL, zielVu: 0, ansicht: 'signal' }, OWN = ['r1', 'r2'];
    const win = () => lim('ap_fenster') * BASE.ub;
    const vals = () => once('v12', () => { const ok = snap('emitter', fullCtl('emitter', Object.assign({}, BASE, { r1: 47000, r2: 10000 }))), lo = snap('emitter', fullCtl('emitter', Object.assign({}, BASE, { r1: 10000, r2: 10000 }))), hi = snap('emitter', fullCtl('emitter', Object.assign({}, BASE, { r1: 150000, r2: 10000 })));
      return { ziel: ZIEL, fenster: win(), lo: ZIEL - win(), hi: ZIEL + win(), uce: ok.m.uce, r1k: 47, r2k: 10, uceLo: lo.m.uce, uceHi: hi.m.uce, r1lo: 10, r1hi: 150, ub: BASE.ub, ueMV: BASE.ue * 1000, pct: lim('ap_fenster') * 100 }; });
    const check = mk('emitter', OWN, (c, r, a) => {
      const eff = effOf(c, 'emitter', OWN, BASE), sim = snap('emitter', eff), v = vals(), u = sim.m && sim.m.uce;
      inputRow(c, r, sim, a, 'emitter');
      const given = U.initial(c, OWN);
      r(OWN.every(k => fin(given[k])), 'R_1 und R_2 sind am Prüfstand eingestellt', 'In der Antwort fehlen die Werte für R_1 und R_2: Stelle den Basisspannungsteiler am Prüfstand ein, bevor du die Lösung prüfst.');
      r(fin(u) && Math.abs(u - ZIEL) <= v.fenster + 1e-9, 'Der Arbeitspunkt liegt im Fenster U_CE = ' + f(ZIEL, 0) + ' V ± ' + f(v.fenster, 1) + ' V',
        'Mit R_1 = ' + f(eff.r1 / 1000, 1) + ' kΩ und R_2 = ' + f(eff.r2 / 1000, 1) + ' kΩ liegt U_CE bei ' + f(u, 2) + ' V (Fenster ' + f(v.lo, 1) + ' V bis ' + f(v.hi, 1) + ' V). ' +
        (u < ZIEL ? 'Der Transistor ist zu weit aufgesteuert: Mach R_1 größer oder R_2 kleiner, damit die Basisspannung sinkt.' : 'Der Transistor ist zu wenig aufgesteuert: Mach R_1 kleiner oder R_2 größer, damit die Basisspannung steigt.'));
      r(sim.s && sim.s.clip === '', 'Die Stufe begrenzt bei ' + f(v.ueMV, 0) + ' mV Eingangsamplitude nicht',
        'Bei ' + f(v.ueMV, 0) + ' mV Eingangsamplitude wird der Ausgang ' + (sim.s && sim.s.clip === 'unten' ? 'unten begrenzt (die negative Halbwelle ist flach, der Transistor geht in die Sättigung)' : sim.s && sim.s.clip === 'oben' ? 'oben begrenzt (die positive Halbwelle ist flach, der Transistor sperrt)' : 'begrenzt') + ': Der Arbeitspunkt liegt zu nah an einer Grenze.');
      r(sim.a && sim.a.ampel === 'gruen', 'Die Ampel am Prüfstand ist grün (Vorgabe U_CE ' + f(ZIEL, 0) + ' V erfüllt)', 'Die Ampel steht auf „' + (sim.a ? sim.a.ampel : '–') + '“. ' + (sim.a ? sim.a.text : ''));
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Die Emitterschaltung (U_B = ' + f(BASE.ub, 0) + ' V, R_C = ' + f(BASE.rc / 1000, 1) + ' kΩ, Eingangsamplitude ' + f(v.ueMV, 0) + ' mV) soll mit dem Arbeitspunkt U_CE = ' + f(ZIEL, 0) + ' V arbeiten, also etwa in der Mitte der Betriebsspannung; die Vorgabe U_CE = ' + f(ZIEL, 0) + ' V ist am Prüfstand gesetzt. Stelle den Basisspannungsteiler (R_1 und R_2) so ein, dass der Arbeitspunkt im Fenster von ± ' + f(v.pct, 0) + ' % der Betriebsspannung (Übungswert) liegt und der Ausgang nicht begrenzt (Ampel grün).'; },
      hint: () => { const v = vals(); return [
        'Ein größeres R_2 hebt die Basisspannung an, I_C steigt und U_CE sinkt; ein größeres R_1 senkt die Basisspannung und U_CE steigt. Beobachte U_CE am Messgerät und die Ampel.',
        'Das Fenster reicht von ' + f(v.lo, 1) + ' V bis ' + f(v.hi, 1) + ' V (± ' + f(v.fenster, 1) + ' V um ' + f(v.ziel, 0) + ' V). Mit R_1 = ' + f(v.r1lo, 0) + ' kΩ liegt U_CE bei ' + f(v.uceLo, 2) + ' V (Sättigung, der Ausgang wird unten flach), mit R_1 = ' + f(v.r1hi, 0) + ' kΩ bei ' + f(v.uceHi, 2) + ' V (der Transistor ist kaum aufgesteuert).',
        'Musterlösung: R_1 = ' + f(v.r1k, 0) + ' kΩ und R_2 = ' + f(v.r2k, 0) + ' kΩ (Standardwerte) ergeben U_CE = ' + f(v.uce, 2) + ' V; der Ausgang begrenzt bei ' + f(v.ueMV, 0) + ' mV nicht.'
      ]; },
      start: () => S('emitter', Object.assign({}, BASE, { r1: 27000, r2: 10000 }), {}),
      sol: () => S('emitter', Object.assign({}, BASE, { r1: 47000, r2: 10000 }), {}),
      wrong: () => [{ name: 'R_1 zu klein (Sättigung)', answer: S('emitter', Object.assign({}, BASE, { r1: 10000, r2: 10000 }), {}) }, { name: 'R_1 zu groß (Transistor kaum aufgesteuert)', answer: S('emitter', Object.assign({}, BASE, { r1: 150000, r2: 10000 }), {}) }] };
  })();

  /* ====================================================================== ae13: Fehlersuche an der Emitterschaltung */
  const M13 = faultM({ key: 'f13', rig: 'emitter', fault: 'r1 offen', cands: ['r1 offen', 'r2 offen', 'rc offen', 'ce offen'],
    base: { ub: 12, ue: 0.02, f: 1000, rg: 600, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: true, c1: 1e-5, c2: 1e-5, b: 100, rl: 10000, zielUce: 0, zielVu: 0, ansicht: 'signal' },
    pic: m => 'U_CE = ' + nz(m.uce, 1) + ' V, U_E = ' + nz(m.ues, 1) + ' V, I_C = ' + nz(m.ic, 1) + ' mA, V_u = ' + nz(m.vu, 1),
    text: 'Eine Emitterschaltung (12 V, Basisspannungsteiler, Emitterkondensator, Last 10 kΩ, Eingang 20 mV bei 1 kHz) verstärkt nicht wie erwartet. Der Fehlerfall ist verdeckt („Fehler: ?“). Miss U_CE, die Emitterspannung U_E, den Kollektorstrom I_C und die Spannungsverstärkung V_u. Vergleiche mit den Messbildern der Auswahl, wähle die Ursache und danach die Messwerte, die zu dieser Ursache gehören.',
    frage1: 'Welche Ursache passt zu deinen Messwerten?', frage2: 'Welche Messwerte gehören zu dieser Ursache?',
    hint: ['Miss zuerst die Gleichspannungen: U_CE und U_E zeigen, ob der Arbeitspunkt stimmt. Danach V_u: Sie zeigt, ob die Stufe überhaupt noch verstärkt.',
      'Liegt U_CE nahe bei null, nahe bei der Betriebsspannung oder in der Mitte? Das trennt die Fehlerbilder grob. Vergleiche danach U_E, I_C und V_u mit den vier Messbildern.',
      'Lies U_E und I_C mit: Der Strom durch den Emitterwiderstand verrät, ob der Transistor überhaupt Strom führt. Genau ein Messbild passt zu allen vier Werten.'],
    wrongs: [{ name: 'R_C statt Ursache aus den Messwerten', ursache: 'rc offen', beleg: 'rc offen' }, { name: 'Ursache mit falschen Messwerten begründet', ursache: 'r1 offen', beleg: 'r2 offen' }] });

  /* ====================================================================== ae14: Emitterfolger (Pool) */
  const M14 = (() => {
    const G = { uz: 6, ube: 0.7 };
    const BASE = { betrieb: 'zener', schaltung: 'kollektor', ub: 12, ue: 0.1, f: 1000, rg: 10000, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, b: 100, rl: 220, uz: G.uz, iz: 0.012, ic: 0.09, nd: 3, ud: 0.7, fehler: 'keiner', ziel: 0 }, OWN = ['betrieb', 'uz'];
    const vals = () => once('v14', () => { const s = CORE().exercise.solve('ueFolger', G), sg = snap('folger', fullCtl('folger', Object.assign({}, BASE, { betrieb: 'signal' })));
      return { uz: G.uz, ube: G.ube, ue: s.value, ohneUbe: G.uz, vu: sg.m.vu, plusUbe: G.uz + G.ube }; });
    const ex = () => once('ex14', () => U.calcEx({ kind: 'ueFolger', given: G, what: 'Emitterspannung U_E' }));
    const O1 = () => { const v = vals(); return [
      opt('lt1', 'Knapp unter 1 (hier V_u = ' + f(v.vu, 2) + '), ohne Phasendrehung.', ''),
      opt('zwei', 'V_u = 2, ohne Phasendrehung.', 'Der Emitterfolger verstärkt die Spannung nicht: Der Emitter folgt der Basis, V_u liegt knapp unter 1. Verstärkt wird nur der Strom.'),
      opt('gross', 'Deutlich größer als 1 mit 180° Phasendrehung.', 'Das beschreibt die Emitterschaltung. Beim Emitterfolger (Kollektorschaltung) folgt der Ausgang dem Eingang gleichphasig.'),
      opt('eins', 'Genau 1 (V_u = 1,000).', 'Der Spannungsabfall zwischen Basis und Emitter und der innere Emitterwiderstand r_e machen V_u immer etwas kleiner als 1; genau 1 erreicht nur der Spannungsfolger mit Operationsverstärker (idealisiert).')]; };
    const check = mk('folger', OWN, (c, r, a) => {
      const eff = effOf(c, 'folger', OWN, BASE), sim = snap('folger', eff), v = vals();
      inputRow(c, r, sim, a, 'folger');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Emitterspannung U_E berechnet (Toleranz 3 %)');
      setRow(r, 'folger', eff, [{ key: 'betrieb', want: 'zener' }, { key: 'uz', want: G.uz, tol: 0.01 }], 'Am Prüfstand ist der Z-Folger mit U_Z = ' + f(G.uz, 1) + ' V eingestellt');
      U.choiceRow(r, a, { key: 'vu', right: 'lt1', opts: O1(), label: 'Spannungsverstärkung des Emitterfolgers richtig gewählt' });
    });
    return { vals, check, consts: [],
      text: () => 'Ein npn-Transistor ist als Emitterfolger geschaltet: Der Kollektor liegt an +' + f(BASE.ub, 0) + ' V, die Basis wird konstant auf ' + f(G.uz, 1) + ' V gehalten (am Prüfstand: Betriebsart Z-Folger mit U_Z = ' + f(G.uz, 1) + ' V). Mit U_BE = ' + f(G.ube, 1) + ' V: Welche Spannung liegt am Emitter? Trage U_E ein und wähle die richtige Aussage zur Spannungsverstärkung.',
      ask: { label: 'Emitterspannung U_E', unit: 'V' },
      choices: () => [U.choiceDef('vu', 'Welche Aussage zur Spannungsverstärkung V_u des Emitterfolgers stimmt?', O1())],
      hint: () => { const v = vals(); return [
        'Beim Emitterfolger liegt der Emitter um die Basis-Emitter-Spannung unter der Basis: Er folgt der Basis, sagt schon der Name.',
        'U_E = U_Basis − U_BE = ' + f(v.uz, 1) + ' V − ' + f(v.ube, 1) + ' V. Wer U_BE nicht abzieht, kommt auf ' + f(v.ohneUbe, 1) + ' V, wer sie addiert, auf ' + f(v.plusUbe, 1) + ' V. Die Spannungsverstärkung liegt knapp unter 1 (hier ' + f(v.vu, 2) + ').',
        'Musterlösung: U_E = ' + f(v.uz, 1) + ' V − ' + f(v.ube, 1) + ' V = ' + f(v.ue, 1) + ' V; V_u knapp unter 1, keine Phasendrehung. Am Prüfstand Betriebsart Z-Folger und U_Z = ' + f(v.uz, 1) + ' V einstellen.'
      ]; },
      start: () => S('folger', Object.assign({}, BASE, { betrieb: 'signal' }), { value: null, choices: {} }),
      sol: () => S('folger', BASE, { value: vals().ue, choices: { vu: 'lt1' } }),
      wrong: () => { const v = vals(); return [{ name: 'U_BE nicht abgezogen', answer: S('folger', BASE, { value: v.ohneUbe, choices: { vu: 'lt1' } }) }, { name: 'V_u = 2', answer: S('folger', BASE, { value: v.ue, choices: { vu: 'zwei' } }) }]; } };
  })();

  /* ====================================================================== ae15: Z-Diode am Folger, R_1 (Pool) */
  const M15 = (() => {
    const G = { ub: 15, uz: 6, iz: 0.012, ic: 0.09, b: 30 };
    const BASE = { schaltung: 'kollektor', ue: 0.1, f: 1000, rg: 10000, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, rl: 220, nd: 3, ud: 0.7, fehler: 'keiner', ziel: 0 }, OWN = ['betrieb', 'ub', 'uz', 'iz', 'ic', 'b'];
    const vals = () => once('v15', () => { const s = CORE().exercise.solve('r1Zfolger', G), ib = G.ic / G.b;
      return { ub: G.ub, uz: G.uz, izmA: G.iz * 1000, icmA: G.ic * 1000, b: G.b, ibmA: ib * 1000, imA: (G.iz + ib) * 1000, ur: G.ub - G.uz, r1: s.value, ohneIb: (G.ub - G.uz) / G.iz, icStattIb: (G.ub - G.uz) / (G.iz + G.ic) }; });
    const ex = () => once('ex15', () => U.calcEx({ kind: 'r1Zfolger', given: G, what: 'Vorwiderstand R_1' }));
    const SETUP = { betrieb: 'zener', ub: G.ub, uz: G.uz, iz: G.iz, ic: G.ic, b: G.b };
    const check = mk('folger', OWN, (c, r, a) => {
      const eff = effOf(c, 'folger', OWN, BASE), sim = snap('folger', eff);
      inputRow(c, r, sim, a, 'folger');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Vorwiderstand R_1 berechnet (Toleranz 3 %)');
      setRow(r, 'folger', eff, [{ key: 'betrieb', want: 'zener' }, { key: 'ub', want: G.ub, tol: 0.01 }, { key: 'uz', want: G.uz, tol: 0.01 }, { key: 'iz', want: G.iz, tol: 0.02 }, { key: 'ic', want: G.ic, tol: 0.02 }, { key: 'b', want: G.b, tol: 0.01 }], 'Der Prüfstand ist auf die Aufgabe eingestellt (Z-Folger, ' + f(G.ub, 0) + ' V, U_Z = ' + f(G.uz, 0) + ' V, I_Z = ' + f(G.iz * 1000, 0) + ' mA, I_C = ' + f(G.ic * 1000, 0) + ' mA, B = ' + f(G.b, 0) + ')');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Transistor arbeitet als Emitterfolger: Der Kollektor liegt an +' + f(G.ub, 0) + ' V, der Kollektorstrom beträgt ' + f(G.ic * 1000, 0) + ' mA, die Stromverstärkung B = ' + f(G.b, 0) + '. Die Basis wird über einen Vorwiderstand R_1 aus +' + f(G.ub, 0) + ' V versorgt, parallel zur Basis-Masse-Strecke liegt eine Z-Diode mit U_Z = ' + f(G.uz, 1) + ' V, durch die ' + f(G.iz * 1000, 0) + ' mA fließen. Der Basisstrom wird aus dem Strom durch R_1 gespeist. Stelle die Werte im Prüfstand ein (Betriebsart Z-Folger) und berechne R_1.',
      ask: { label: 'Vorwiderstand R_1', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Durch R_1 fließen zwei Ströme: der Strom der Z-Diode und der Basisstrom des Transistors. An R_1 liegt die Differenz aus Betriebsspannung und Z-Spannung.',
        'I_B = I_C / B = ' + f(v.icmA, 0) + ' mA / ' + f(v.b, 0) + ' = ' + f(v.ibmA, 0) + ' mA, also fließen I_Z + I_B = ' + f(v.imA, 0) + ' mA durch R_1 bei ' + f(v.ur, 0) + ' V. Ohne I_B käme ' + f(v.ohneIb, 0) + ' Ω heraus; mit I_C statt I_B ' + f(v.icStattIb, 1) + ' Ω.',
        'Musterlösung: R_1 = (U_B − U_Z) / (I_Z + I_B) = ' + f(v.ur, 0) + ' V / ' + f(v.imA, 0) + ' mA = ' + f(v.r1, 0) + ' Ω.'
      ]; },
      start: () => S('folger', Object.assign({}, BASE, { betrieb: 'signal' }), { value: null }),
      sol: () => S('folger', Object.assign({}, BASE, SETUP), { value: vals().r1 }),
      wrong: () => { const v = vals(); return [{ name: 'I_B vergessen', answer: S('folger', Object.assign({}, BASE, SETUP), { value: v.ohneIb }) }, { name: 'I_C statt I_B', answer: S('folger', Object.assign({}, BASE, SETUP), { value: v.icStattIb }) }]; } };
  })();

  /* ====================================================================== ae16: Konstantstromquelle, R_E (Pool) */
  const M16 = (() => {
    const G = { nd: 3, ud: 0.7, ube: 0.7, ic: 0.04 };
    const BASE = { schaltung: 'kollektor', ub: 12, ue: 0.1, f: 1000, rg: 10000, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, b: 100, rl: 220, uz: 6, iz: 0.012, fehler: 'keiner', ziel: 0 }, OWN = ['betrieb', 'nd', 'ud', 'ic'];
    const SETUP = { betrieb: 'konstantstrom', nd: G.nd, ud: G.ud, ic: G.ic };
    const vals = () => once('v16', () => { const s = CORE().exercise.solve('reKonst', G); return { nd: G.nd, ud: G.ud, ube: G.ube, icmA: G.ic * 1000, ubasis: G.nd * G.ud, ure: G.nd * G.ud - G.ube, re: s.value, ohneUbe: G.nd * G.ud / G.ic, zweiD: (2 * G.ud - G.ube) / G.ic }; });
    const ex = () => once('ex16', () => U.calcEx({ kind: 'reKonst', given: G, what: 'Emitterwiderstand R_E', extras: [{ v: (2 * G.ud - G.ube) / G.ic, msg: 'Dein Wert passt zu nur zwei Dioden in der Rechnung. Alle in Reihe geschalteten Dioden addieren ihre Flussspannung: Die Basisspannung ist n · U_D.' }] }));
    const check = mk('folger', OWN, (c, r, a) => {
      const eff = effOf(c, 'folger', OWN, BASE), sim = snap('folger', eff);
      inputRow(c, r, sim, a, 'folger');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Emitterwiderstand R_E berechnet (Toleranz 3 %)');
      setRow(r, 'folger', eff, [{ key: 'betrieb', want: 'konstantstrom' }, { key: 'nd', want: G.nd, tol: 0.01 }, { key: 'ud', want: G.ud, tol: 0.01 }, { key: 'ic', want: G.ic, tol: 0.02 }], 'Der Prüfstand ist auf die Aufgabe eingestellt (Konstantstromquelle, ' + f(G.nd, 0) + ' Dioden zu je ' + f(G.ud, 1) + ' V, I_C = ' + f(G.ic * 1000, 0) + ' mA)');
    });
    return { vals, check, consts: [],
      text: () => 'Eine Konstantstromquelle verwendet einen Transistor. Die Basis liegt über drei in Reihe geschaltete Siliziumdioden (je ' + f(G.ud, 1) + ' V, in Durchlassrichtung) an der Versorgung, der Emitter über den Widerstand R_E. |U_BE| des Transistors beträgt ' + f(G.ube, 1) + ' V. Der Kollektorstrom soll ' + f(G.ic * 1000, 0) + ' mA betragen. Stelle die Werte im Prüfstand ein (Betriebsart Konstantstromquelle) und berechne R_E.',
      ask: { label: 'Emitterwiderstand R_E', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Die Dioden legen die Basisspannung fest. Die Spannung am Emitterwiderstand ist diese Spannung abzüglich U_BE. Daraus und aus dem Strom folgt R_E.',
        'Die Basisspannung ist n · U_D = ' + f(v.nd, 0) + ' · ' + f(v.ud, 1) + ' V = ' + f(v.ubasis, 1) + ' V, am Emitterwiderstand liegen davon nach Abzug von U_BE noch ' + f(v.ure, 1) + ' V. Ohne U_BE-Abzug käme ' + f(v.ohneUbe, 1) + ' Ω heraus, mit nur zwei Dioden ' + f(v.zweiD, 1) + ' Ω.',
        'Musterlösung: R_E = (n · U_D − U_BE) / I_C = ' + f(v.ure, 1) + ' V / ' + f(v.icmA, 0) + ' mA = ' + f(v.re, 0) + ' Ω.'
      ]; },
      start: () => S('folger', Object.assign({}, BASE, { betrieb: 'signal' }), { value: null }),
      sol: () => S('folger', Object.assign({}, BASE, SETUP), { value: vals().re }),
      wrong: () => { const v = vals(); return [{ name: 'U_BE nicht abgezogen', answer: S('folger', Object.assign({}, BASE, SETUP), { value: v.ohneUbe }) }, { name: 'nur zwei Dioden gerechnet', answer: S('folger', Object.assign({}, BASE, SETUP), { value: v.zweiD }) }]; } };
  })();

  /* ====================================================================== Registrierung */
  function tk(head, M) {
    const t = Object.assign({}, head);
    const lazy = (name, get) => Object.defineProperty(t, name, { enumerable: true, configurable: true, get() { const v = get(); Object.defineProperty(t, name, { value: v, enumerable: true, configurable: true, writable: true }); return v; } });
    lazy('text', M.text); if (M.table) lazy('table', M.table); lazy('hint', M.hint);
    if (M.fields) lazy('fields', M.fields); if (M.choices) lazy('choices', M.choices);
    if (M.ask) t.ask = M.ask; if (M.consts) t.consts = M.consts;
    t.start = M.start; t.sol = M.sol; t.wrong = M.wrong; t.check = M.check; t.hintVals = M.vals;
    return t;
  }
  T.register([
    tk({ id: 'ae1', lab: 'ana', cat: 'Prüfungsnah', title: 'LED-Vorwiderstand', level: 1, rig: 'diode' }, M1),
    tk({ id: 'ae2', lab: 'ana', cat: 'Prüfungsnah', title: 'Z-Diode: kleinster Vorwiderstand', level: 2, rig: 'diode' }, M2),
    tk({ id: 'ae3', lab: 'ana', cat: 'Fehlersuche', title: 'Fehlersuche: Die LED leuchtet nicht', level: 1, rig: 'diode' }, M3),
    tk({ id: 'ae4', lab: 'ana', cat: 'Prüfungsnah', title: 'Basisvorwiderstand', level: 2, rig: 'schalter' }, M4),
    tk({ id: 'ae5', lab: 'ana', cat: 'Prüfungsnah', title: 'Übersteuerung', level: 3, rig: 'schalter' }, M5),
    tk({ id: 'ae6', lab: 'ana', cat: 'Prüfungsnah', title: 'LED über Transistor', level: 1, rig: 'schalter' }, M6),
    tk({ id: 'ae7', lab: 'ana', cat: 'Prüfungsnah', title: 'Relais und Freilaufdiode', level: 1, rig: 'schalter' }, M7),
    tk({ id: 'ae8', lab: 'ana', cat: 'Fehlersuche', title: 'Fehlersuche: Das Relais zieht nicht an', level: 2, rig: 'schalter' }, M8),
    tk({ id: 'ae9', lab: 'ana', cat: 'Prüfungsnah', title: 'Basisspannungsteiler', level: 2, rig: 'emitter' }, M9),
    tk({ id: 'ae10', lab: 'ana', cat: 'Prüfungsnah', title: 'Arbeitspunkt: U_CE', level: 2, rig: 'schalter' }, M10),
    tk({ id: 'ae11', lab: 'ana', cat: 'Transistorverstärker', title: 'Verstärkung der Emitterschaltung', level: 3, rig: 'emitter' }, M11),
    tk({ id: 'ae12', lab: 'ana', cat: 'Prüfungsnah', title: 'Arbeitspunkt einstellen', level: 2, rig: 'emitter' }, M12),
    tk({ id: 'ae13', lab: 'ana', cat: 'Fehlersuche', title: 'Fehlersuche an der Emitterschaltung', level: 3, rig: 'emitter' }, M13),
    tk({ id: 'ae14', lab: 'ana', cat: 'Prüfungsnah', title: 'Emitterfolger', level: 1, rig: 'folger' }, M14),
    tk({ id: 'ae15', lab: 'ana', cat: 'Prüfungsnah', title: 'Z-Diode am Folger: R_1', level: 3, rig: 'folger' }, M15),
    tk({ id: 'ae16', lab: 'ana', cat: 'Prüfungsnah', title: 'Konstantstromquelle: R_E', level: 2, rig: 'folger' }, M16)
  ]);
  /* Musterwerte der Aufgaben ae1-ae16 (Schwellen aus der gerechneten Musterloesung) fuer Tests und Ausbilder */
  T.thresholds1 = () => ({ ae1: M1.vals(), ae2: M2.vals(), ae4: M4.vals(), ae5: M5.vals(), ae6: M6.vals(), ae7: M7.vals(), ae9: M9.vals(), ae10: M10.vals(), ae11: M11.vals(), ae12: M12.vals(), ae14: M14.vals(), ae15: M15.vals(), ae16: M16.vals() });
  /* Fehlersuche-Aufgaben: Ursache und Messbilder der Kandidaten (fuer Tests und Ausbilder, nie in der Oberflaeche vor der Antwort) */
  T.faults1 = () => ({ ae3: { fault: M3.fault, cands: M3.cands }, ae8: { fault: M8.fault, cands: M8.cands }, ae13: { fault: M13.fault, cands: M13.cands } });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
