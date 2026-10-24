/* wsltasks1.js - WSL-Lab (Wechselstrom und Schwingkreise): Aufgaben ws1 bis ws16 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4a.
 * Quelle: quelle/wsllab/_wp4a/t1_a.js + t1_b.js, zusammengesetzt mit `node quelle/wsllab/_wp4a/build_wsl.js`.
 * Registrierung: WSL_TASKS.register([ ... ]) (WSL_TASKS und WSL_TASKS.util kommen aus wsldata.js; wsldata.js VOR dieser Datei laden, in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'wsN', lab:'wsl', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), value?, fields?, choices? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert mindestens zwei absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Regeln (SPEC Abschnitte 8, 9 und 11):
 *   - Alle Zahlen in text, hint und Pruefmeldungen stammen aus der Simulation (Pruefstaende) und WSL_CORE und stehen in hintVals() (Regel 1); text und hint werden erst beim ersten
 *     Zugriff gerechnet. WSL_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3. Rechnen nur ueber den Kern (exercise.solve, rlc, power, comp, sine, limits).
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert uebereinstimmt;
 *     Auswahlfragen nennen den Fachgrund der gewaehlten Antwort.
 *   - Pool-Zahlen (SPEC 12.1) stehen exakt wie in der Pool-Loesung; Aufgaben mit Pool-Bezug tragen die Kategorie "Prüfungsnah", die anderen (ws3, ws5, ws9, ws13 bis ws16) nicht.
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (BASE), damit gleiche Eingaben gleiche Ergebnisse liefern.
 *   - Abweichungen von der SPEC: quelle/wsllab/ABWEICHUNGEN.md, Abschnitt WP4a.
 * Uebungsschaltung: Alle Bauteil- und Anlagenwerte sind Aufgabenwerte. Simulation: keine Anleitung fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.WSL_TASKS) nodeReq('./wsldata.js');
  const T = root.WSL_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('wsltasks1.js: wsldata.js fehlt, die Aufgaben ws1 bis ws16 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, snap = U.snap, effOf = U.effOf, setRow = U.setRow, fullCtl = U.fullCtl;
  const CORE = () => U.CORE();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const S = (rig, over, extra) => Object.assign({ rig, controls: fullCtl(rig, over) }, extra || {});
  const lim = U.lim;
  const MU = 1e6;
  const near = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= rel * Math.abs(b) + 1e-12;
  const NETZ = () => ({ u: lim('u_netz'), f: lim('f_netz') });
  const opt = (value, label, reason) => ({ value, label, reason });

  /* ====================================================================== ws1: Effektivwert oder Scheitelwert? (Pool) */
  const M1 = (() => {
    const BASE = { f: 1000, phi: 0, offset: 0, zweite: false, ziel: 0 }, OWN = ['form', 'ampl'], A0 = 100;
    const vals = () => once('v1', () => {
      const si = snap('sinus', fullCtl('sinus', Object.assign({}, BASE, { form: 'sinus', ampl: A0 }))), re = snap('sinus', fullCtl('sinus', Object.assign({}, BASE, { form: 'rechteck', ampl: A0 }))), dr = snap('sinus', fullCtl('sinus', Object.assign({}, BASE, { form: 'dreieck', ampl: A0 })));
      return { a0: A0, sinus: si.m.ueff, rechteck: re.m.ueff, dreieck: dr.m.ueff, halb: A0 / 2 };
    });
    const O1 = () => [
      opt('a', 'Der Effektivwert ist bei jeder Kurvenform der Scheitelwert geteilt durch √2.', 'Der Faktor 1 / √2 gilt nur für den Sinus; beim Rechteck ist der Effektivwert gleich dem Scheitelwert.'),
      opt('b', 'Der Effektivwert ist immer gleich dem arithmetischen Mittelwert über eine Periode.', 'Der arithmetische Mittelwert eines Sinus über eine Periode ist null; der Effektivwert nicht.'),
      opt('c', 'Ein Wechselstrom erzeugt in einem Widerstand dieselbe Wärme wie ein Gleichstrom gleicher Größe, wenn sein Effektivwert dem Gleichstrom entspricht.', ''),
      opt('d', 'Der Effektivwert einer symmetrischen Rechteckspannung ist der halbe Scheitelwert.', 'Beim Rechteck liegt die Spannung die ganze Zeit auf dem Scheitelwert, der Effektivwert ist deshalb gleich dem Scheitelwert, nicht die Hälfte.')];
    const O2 = () => { const v = vals(); return [
      opt('r100', f(v.rechteck, 1) + ' V', ''),
      opt('r71', f(v.sinus, 1) + ' V', 'Das ist û / √2 und gilt nur für den Sinus, nicht für das Rechteck.'),
      opt('r50', f(v.halb, 1) + ' V', 'Der halbe Scheitelwert ist weder der Effektivwert noch der Wert einer Rechteckspannung; er entspricht dem Gleichrichtwert eines Dreiecks.')]; };
    const check = mk('sinus', OWN, (c, r, a) => {
      const eff = effOf(c, 'sinus', OWN, BASE), sim = snap('sinus', eff), v = vals();
      inputRow(c, r, sim, a, 'sinus');
      U.choiceRow(r, a, { key: 'q1', right: 'c', opts: O1(), label: 'Aussage zum Effektivwert richtig gewählt' });
      U.choiceRow(r, a, { key: 'q2', right: 'r100', opts: O2(), label: 'Effektivwert der Rechteckspannung richtig gewählt' });
      setRow(r, 'sinus', eff, [{ key: 'form', want: 'rechteck' }, { key: 'ampl', want: A0 }], 'Am Prüfstand ist die Rechteckspannung mit û = ' + f(A0, 0) + ' V eingestellt');
      r(near(sim.m.ueff, eff.ampl, 0.01) && eff.form === 'rechteck', 'Das Messgerät zeigt den Effektivwert gleich dem Scheitelwert', 'Das Messgerät zeigt ' + f(sim.m.ueff, 1) + ' V bei û = ' + f(eff.ampl, 1) + ' V (Form „' + U.olabel('sinus', 'form', eff.form) + '“). Nur beim Rechteck sind beide gleich.');
    });
    return { vals, check, consts: [A0],
      text: () => 'Stelle im Prüfstand „Sinus, Effektivwert und Phase“ eine Rechteckspannung mit dem Scheitelwert û = ' + f(A0, 0) + ' V ein (Frequenz ' + f(BASE.f, 0) + ' Hz) und lies am Messgerät den Effektivwert ab. Beantworte dann die beiden Fragen zum Effektivwert.',
      choices: () => [U.choiceDef('q1', 'Welche Aussage über den Effektivwert eines Wechselstroms ist richtig?', O1()), U.choiceDef('q2', 'Wie groß ist der Effektivwert der Rechteckspannung mit û = ' + f(A0, 0) + ' V?', O2())],
      hint: () => { const v = vals(); return [
        'Der Effektivwert ist über die Wärmewirkung definiert: Er ist der Gleichwert, der im Widerstand dieselbe Leistung erzeugt. Der Faktor 1 / √2 gehört nur zur Sinusform.',
        'Beim Sinus mit û = ' + f(v.a0, 0) + ' V ist U = ' + f(v.sinus, 1) + ' V. Beim Rechteck liegt die Spannung dauernd auf dem Scheitelwert; das Messgerät zeigt bei dir ' + f(v.rechteck, 1) + ' V.',
        'Musterlösung: Aussage 3 stimmt (gleiche Wärme wie Gleichstrom). Rechteck: U = û = ' + f(v.rechteck, 1) + ' V; am Prüfstand Form „Rechteck“ und û = ' + f(v.a0, 0) + ' V einstellen.'
      ]; },
      start: () => S('sinus', Object.assign({}, BASE, { form: 'sinus', ampl: 325.27 }), { choices: {} }),
      sol: () => S('sinus', Object.assign({}, BASE, { form: 'rechteck', ampl: A0 }), { choices: { q1: 'c', q2: 'r100' } }),
      wrong: () => [{ name: 'Scheitelwert statt Effektivwert', answer: S('sinus', Object.assign({}, BASE, { form: 'sinus', ampl: A0 }), { choices: { q1: 'a', q2: 'r71' } }) },
        { name: 'halber Scheitelwert', answer: S('sinus', Object.assign({}, BASE, { form: 'rechteck', ampl: A0 }), { choices: { q1: 'd', q2: 'r50' } }) }] };
  })();

  /* ====================================================================== ws2: Scheitelwert der Netzspannung */
  const M2 = (() => {
    const BASE = { form: 'sinus', f: 50, phi: 0, offset: 0, zweite: false, ziel: 230 }, OWN = ['ampl'];
    const vals = () => once('v2', () => { const u = NETZ().u, peak = u * Math.SQRT2; return { u, peak, durch: u / Math.SQRT2, halb: u / 2, tol: 3 }; });
    const ex = () => once('ex2', () => { const v = vals(); return U.calcEx({ value: v.peak, unit: 'V', what: 'Scheitelwert û', extras: [
      { v: v.u, msg: 'Das ist der Effektivwert selbst: Der Scheitelwert ist größer, û = U · √2.' },
      { v: v.durch, msg: 'Dein Wert passt zu U / √2. Vom Effektivwert zum Scheitelwert geht es mit √2 mal, nicht durch.' },
      { v: v.halb, msg: 'Dein Wert ist die Hälfte des Effektivwerts. Der Scheitelwert ist U · √2, also größer als der Effektivwert.' }] }); });
    const check = mk('sinus', OWN, (c, r, a) => {
      const eff = effOf(c, 'sinus', OWN, BASE), sim = snap('sinus', eff);
      inputRow(c, r, sim, a, 'sinus');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Scheitelwert û der Netzspannung berechnet (Toleranz 3 %)');
      r(sim.a && sim.a.ampel === 'gruen', 'Am Prüfstand liefert der eingestellte Scheitelwert den Effektivwert ' + f(vals().u, 0) + ' V (Ampel grün)', 'Der Prüfstand zeigt ' + f(sim.m.ueff, 1) + ' V Effektivwert bei û = ' + f(eff.ampl, 2) + ' V; die Ampel ist „' + (sim.a ? sim.a.ampel : '–') + '“. ' + (sim.a ? sim.a.text : ''));
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Die Netzspannung ist eine Sinusspannung mit dem Effektivwert U = ' + f(v.u, 0) + ' V. Berechne den Scheitelwert û und stelle ihn im Prüfstand als Amplitude ein: Der Effektivwert muss dann ' + f(v.u, 0) + ' V zeigen (Vorgabe gesetzt).'; },
      ask: { label: 'Scheitelwert û', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Für eine Sinusgröße gilt U = û / √2. Stelle die Formel nach û um.',
        'û = U · √2 mit U = ' + f(v.u, 0) + ' V. Nimmst du den Effektivwert selbst, ' + f(v.u, 0) + ' V, ist das zu wenig; U / √2 = ' + f(v.durch, 1) + ' V wäre die falsche Richtung.',
        'Musterlösung: û = ' + f(v.u, 0) + ' V · √2 = ' + f(v.peak, 2) + ' V.'
      ]; },
      start: () => S('sinus', Object.assign({}, BASE, { ampl: 100 }), { value: null }),
      sol: () => S('sinus', Object.assign({}, BASE, { ampl: vals().peak }), { value: vals().peak }),
      wrong: () => { const v = vals(); return [{ name: '√2 vergessen', answer: S('sinus', Object.assign({}, BASE, { ampl: v.u }), { value: v.u }) }, { name: 'durch statt mal', answer: S('sinus', Object.assign({}, BASE, { ampl: v.durch }), { value: v.durch }) }]; } };
  })();

  /* ====================================================================== ws3: Phase einstellen */
  const M3 = (() => {
    const BASE = { form: 'sinus', ampl: 325.27, f: 50, offset: 0, zweite: false, ziel: 0 }, OWN = ['phi'], PHI = 60;
    const vals = () => once('v3', () => { const sh = CORE().sine.shift({ form: 'sinus', ampl: BASE.ampl, f: BASE.f, phi: PHI }); return { phi: PHI, f: BASE.f, t: 1000 / BASE.f, dt: sh.dtMs, dtS: sh.dtS, voll: 360, anteil: PHI / 360 }; });
    const ex = () => once('ex3', () => U.calcEx({ kind: 'zeitversatz', given: { f: BASE.f, phi: PHI }, what: 'Zeitversatz Δt', extras: [{ v: PHI / 1000, msg: 'Du hast den Winkel ' + f(PHI, 0) + ' wie eine Zeit in ms eingetragen. Der Winkel muss auf die Periode bezogen werden: Δt = φ / 360° · T.' }] }));
    const check = mk('sinus', OWN, (c, r, a) => {
      const eff = effOf(c, 'sinus', OWN, BASE), sim = snap('sinus', eff), v = vals();
      inputRow(c, r, sim, a, 'sinus');
      const okPhi = near(eff.phi, PHI, 0.01) && sim.s.dir === 'vor';
      r(okPhi, 'Die Spannung eilt dem Bezug um ' + f(PHI, 0) + '° vor', 'Eingestellt ist φ = ' + f(eff.phi, 1) + '°: ' + (sim.s.dir === 'nach' ? 'Die Spannung eilt dem Bezug nach, verlangt ist Voreilen (positiver Winkel).' : sim.s.dir === 'gleich' ? 'Beide Kurven liegen übereinander, es gibt keine Phasenverschiebung.' : 'Die Spannung eilt vor, aber um ' + f(Math.abs(eff.phi), 1) + '° statt ' + f(PHI, 0) + '°.'));
      U.calcRow(r, ex(), U.rawOf(a, 'dt'), 'Zeitversatz Δt für ' + f(PHI, 0) + '° bei ' + f(BASE.f, 0) + ' Hz berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [BASE.f],
      text: () => 'Eine Sinusspannung hat die Frequenz ' + f(BASE.f, 0) + ' Hz. Stelle im Prüfstand „Sinus, Effektivwert und Phase“ den Phasenwinkel so ein, dass die Spannung dem Bezug um ' + f(PHI, 0) + '° vorauseilt, und trage den zugehörigen Zeitversatz Δt ein.',
      fields: () => [{ key: 'dt', label: 'Zeitversatz Δt', unit: 'ms' }],
      hint: () => { const v = vals(); return [
        'Voreilen ist ein positiver Phasenwinkel (die Kurve liegt im Zeitbild links). Der Zeitversatz ist der Anteil φ / 360° der Periodendauer T = 1 / f.',
        'Die Periodendauer ist T = ' + f(v.t, 0) + ' ms. Der Winkel ' + f(v.phi, 0) + '° ist ' + f(v.phi / 360, 4) + ' davon.',
        'Musterlösung: φ = +' + f(v.phi, 0) + '°, Δt = ' + f(v.phi, 0) + '° / 360° · ' + f(v.t, 0) + ' ms = ' + f(v.dt, 2) + ' ms.'
      ]; },
      start: () => S('sinus', Object.assign({}, BASE, { phi: 0 }), { fields: { dt: null } }),
      sol: () => S('sinus', Object.assign({}, BASE, { phi: PHI }), { fields: { dt: f(vals().dt, 2) + ' ms' } }),
      wrong: () => [{ name: 'Vorzeichen vertauscht (nacheilend)', answer: S('sinus', Object.assign({}, BASE, { phi: -PHI }), { fields: { dt: f(vals().dt, 2) + ' ms' } }) },
        { name: 'Winkel statt Zeit eingetragen', answer: S('sinus', Object.assign({}, BASE, { phi: PHI }), { fields: { dt: String(PHI) + ' ms' } }) }] };
  })();

  /* ====================================================================== ws4: Periode und Frequenz am Raster (Pool-Stil) */
  const M4 = (() => {
    const BASE = { form: 'sinus', ampl: 100, phi: 0, offset: 0, zweite: false, ziel: 0 }, OWN = ['f'], DIV = 3.2, TB = 2;
    const vals = () => once('v4', () => { const T = DIV * TB, fq = 1000 / T, cv = CORE().sine.values({ form: 'sinus', ampl: 1, f: fq }); return { div: DIV, tb: TB, t: T, f: fq, tKern: cv.T * 1000 }; });
    const exT = () => once('ext4', () => { const v = vals(); return U.calcEx({ value: v.t / 1000, unit: 's', what: 'Periodendauer T', extras: [
      { v: DIV / 1000, msg: 'Das ist die Zahl der Teilungen (' + f(DIV, 1) + '), keine Zeit. T = Teilungen · Zeitbasis.' }, { v: TB / 1000, msg: 'Das ist nur die Zeitbasis je Teilung. Die Periode erstreckt sich über mehrere Teilungen: T = Teilungen · Zeitbasis.' }] }); });
    const exF = () => once('exf4', () => { const v = vals(); return U.calcEx({ value: v.f, unit: 'Hz', what: 'Frequenz f', tol: 0.02, extras: [
      { v: v.t, msg: 'Das ist die Periodendauer in ms als Zahl. Die Frequenz ist der Kehrwert: f = 1 / T.' }, { v: 1000 / DIV, msg: 'Hier sind die Teilungen als Millisekunden gerechnet worden. T ist Teilungen mal Zeitbasis.' }, { v: 1000 / TB, msg: 'Hier ist nur die Zeitbasis für T benutzt worden. T ist Teilungen mal Zeitbasis.' }] }); });
    const check = mk('sinus', OWN, (c, r, a) => {
      const eff = effOf(c, 'sinus', OWN, BASE), sim = snap('sinus', eff), v = vals();
      inputRow(c, r, sim, a, 'sinus');
      U.calcRow(r, exT(), U.rawOf(a, 't'), 'Periodendauer T berechnet (Toleranz 3 %)');
      U.calcRow(r, exF(), U.rawOf(a, 'f'), 'Frequenz f berechnet (Toleranz 2 %)');
      r(near(sim.m.periode, v.t, 0.02), 'Am Prüfstand ist die Frequenz so eingestellt, dass die Periodendauer ' + f(v.t, 1) + ' ms beträgt', 'Das Messgerät zeigt T = ' + f(sim.m.periode, 2) + ' ms bei f = ' + f(eff.f, 2) + ' Hz, verlangt sind ' + f(v.t, 1) + ' ms.');
    });
    return { vals, check, consts: [],
      text: () => 'Auf einem Oszilloskop mit der Zeitablenkung ' + f(TB, 0) + ' ms je Teilung (DIV) erstreckt sich eine volle Periode einer Sinusspannung über ' + f(DIV, 1) + ' Teilungen. Berechne die Periodendauer T und die Frequenz f und stelle diese Frequenz im Prüfstand ein.',
      fields: () => [{ key: 't', label: 'Periodendauer T', unit: 'ms' }, { key: 'f', label: 'Frequenz f', unit: 'Hz' }],
      hint: () => { const v = vals(); return [
        'Die Periodendauer ist die Zahl der Teilungen mal die Zeitbasis je Teilung. Die Frequenz ist der Kehrwert der Periodendauer.',
        'T = ' + f(v.div, 1) + ' · ' + f(v.tb, 0) + ' ms = ' + f(v.t, 1) + ' ms; f = 1 / T.',
        'Musterlösung: T = ' + f(v.t, 1) + ' ms, f = 1 / ' + f(v.t, 1) + ' ms = ' + f(v.f, 2) + ' Hz.'
      ]; },
      start: () => S('sinus', Object.assign({}, BASE, { f: 50 }), { fields: { t: null, f: null } }),
      sol: () => { const v = vals(); return S('sinus', Object.assign({}, BASE, { f: v.f }), { fields: { t: f(v.t, 1) + ' ms', f: f(v.f, 2) + ' Hz' } }); },
      wrong: () => { const v = vals(); return [{ name: 'Zeitbasis statt Periode, f = T', answer: S('sinus', Object.assign({}, BASE, { f: v.t }), { fields: { t: String(TB) + ' ms', f: String(v.t) } }) },
        { name: 'Teilungen als Millisekunden', answer: S('sinus', Object.assign({}, BASE, { f: 1000 / DIV }), { fields: { t: String(DIV) + ' ms', f: f(1000 / DIV, 1) + ' Hz' } }) }]; } };
  })();

  /* ====================================================================== ws5: X_L und X_C berechnen */
  const M5 = (() => {
    const BASE = { aufbau: 'RLC', u: 230, f: 50, r: 100, l: 0.1, c: 4.7e-6, bezug: 'auto', wert: 'effektiv', ziel: 0 };
    const gXl = () => ({ f: BASE.f, l: BASE.l }), gXc = () => ({ f: BASE.f, c: BASE.c });
    const exL = () => once('exl5', () => U.calcEx({ kind: 'xl', given: gXl(), what: 'X_L' }));
    const exC = () => once('exc5', () => U.calcEx({ kind: 'xc', given: gXc(), what: 'X_C' }));
    const vals = () => once('v5', () => { const s = snap('rlc', fullCtl('rlc', BASE)); return { f: BASE.f, l: BASE.l, c: BASE.c * MU, xl: exL().value, xc: exC().value, xlSim: s.m.xl, xcSim: s.m.xc, xlFalsch: BASE.f * BASE.l, xcFalsch: 1 / (BASE.f * BASE.c) }; });
    const check = mk('rlc', [], (c, r, a) => {
      const sim = snap('rlc', fullCtl('rlc', BASE));
      inputRow(c, r, sim, a, 'rlc');
      U.calcRow(r, exL(), U.rawOf(a, 'xl'), 'Blindwiderstand X_L der Spule berechnet (Toleranz 3 %)');
      U.calcRow(r, exC(), U.rawOf(a, 'xc'), 'Blindwiderstand X_C des Kondensators berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [],
      text: () => 'Eine Spule mit L = ' + f(BASE.l, 1) + ' H und ein Kondensator mit C = ' + f(BASE.c * MU, 1) + ' µF liegen an f = ' + f(BASE.f, 0) + ' Hz (Übungsschaltung). Berechne die beiden Blindwiderstände X_L und X_C. Der Prüfstand „R, L, C im Wechselstromkreis“ zeigt dir zur Kontrolle dieselben Werte an den Messgeräten.',
      fields: () => [{ key: 'xl', label: 'Blindwiderstand X_L', unit: 'Ω' }, { key: 'xc', label: 'Blindwiderstand X_C', unit: 'Ω' }],
      hint: () => { const v = vals(); return [
        'Beide Formeln enthalten ω = 2π · f. Bei der Spule ist X_L = ω · L, beim Kondensator der Kehrwert: X_C = 1 / (ω · C).',
        'ω = 2π · ' + f(v.f, 0) + ' Hz. Ohne den Faktor 2π käme X_L = ' + f(v.xlFalsch, 1) + ' Ω heraus, das wäre zu klein.',
        'Musterlösung: X_L = ' + f(v.xl, 2) + ' Ω, X_C = ' + f(v.xc, 1) + ' Ω.'
      ]; },
      start: () => S('rlc', BASE, { fields: { xl: null, xc: null } }),
      sol: () => { const v = vals(); return S('rlc', BASE, { fields: { xl: f(v.xl, 2) + ' Ω', xc: f(v.xc, 1) + ' Ω' } }); },
      wrong: () => { const v = vals(); return [{ name: '2π vergessen', answer: S('rlc', BASE, { fields: { xl: f(v.xlFalsch, 2), xc: f(v.xcFalsch, 0) } }) },
        { name: 'beide zu klein', answer: S('rlc', BASE, { fields: { xl: f(v.xl / 2, 1), xc: f(v.xc / 2, 1) } }) }]; } };
  })();

  /* ====================================================================== ws6: Spule an 230 V (Pool) */
  const M6 = (() => {
    const BASE = { aufbau: 'RL', u: 230, f: 50, r: 22, l: 0.1, c: 4.7e-6, bezug: 'auto', wert: 'effektiv', ziel: 0 };
    const exZ = () => once('exz6', () => { const xl = 2 * Math.PI * BASE.f * BASE.l; return U.calcEx({ kind: 'zReihe', given: { aufbau: 'RL', r: BASE.r, l: BASE.l, c: 0, f: BASE.f }, what: 'Z', extras: [{ v: xl, msg: 'Das ist nur der Blindwiderstand X_L. Der Wirkwiderstand R gehört in den Scheinwiderstand: Z = √(R² + X_L²).' }] }); });
    const exI = () => once('exi6', () => { const xl = 2 * Math.PI * BASE.f * BASE.l; return U.calcEx({ kind: 'iReihe', given: { u: BASE.u, r: BASE.r, l: BASE.l, f: BASE.f }, what: 'I', extras: [{ v: BASE.u / xl, msg: 'Dein Wert passt zu I = U / X_L ohne den Wirkwiderstand. Der Strom ist U / Z mit Z = √(R² + X_L²).' }] }); });
    const vals = () => once('v6', () => { const xl = 2 * Math.PI * BASE.f * BASE.l; return { u: BASE.u, f: BASE.f, r: BASE.r, l: BASE.l, xl, z: exZ().value, i: exI().value, zFalsch: BASE.r + xl, iFalsch: BASE.u / (BASE.r + xl), iNurX: BASE.u / xl }; });
    const check = mk('rlc', [], (c, r, a) => {
      const sim = snap('rlc', fullCtl('rlc', BASE));
      inputRow(c, r, sim, a, 'rlc');
      U.calcRow(r, exZ(), U.rawOf(a, 'z'), 'Scheinwiderstand Z (Impedanz) der Spule berechnet (Toleranz 3 %)');
      U.calcRow(r, exI(), U.rawOf(a, 'i'), 'Stromaufnahme I berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [],
      text: () => 'Eine Magnetspule hat den Wirkwiderstand R = ' + f(BASE.r, 0) + ' Ω und die Induktivität L = ' + f(BASE.l, 1) + ' H. Wie groß sind der Scheinwiderstand Z (Impedanz) und die Stromaufnahme I bei Anschluss an ' + f(BASE.u, 0) + ' V und ' + f(BASE.f, 0) + ' Hz? Der Prüfstand „R, L, C im Wechselstromkreis“ ist als R-L-Reihenschaltung eingestellt und zeigt die Kontrollwerte.',
      fields: () => [{ key: 'z', label: 'Scheinwiderstand Z', unit: 'Ω' }, { key: 'i', label: 'Strom I', unit: 'A' }],
      hint: () => { const v = vals(); return [
        'Erst X_L = 2π · f · L berechnen, dann Z geometrisch aus R und X_L (Pythagoras), dann I = U / Z.',
        'X_L = ' + f(v.xl, 2) + ' Ω. Die einfache Summe R + X_L = ' + f(v.zFalsch, 2) + ' Ω wäre falsch, weil R und X_L im rechten Winkel stehen.',
        'Musterlösung: Z = √(' + f(v.r, 0) + '² + ' + f(v.xl, 2) + '²) Ω = ' + f(v.z, 2) + ' Ω, I = ' + f(v.u, 0) + ' V / ' + f(v.z, 2) + ' Ω = ' + f(v.i, 2) + ' A.'
      ]; },
      start: () => S('rlc', BASE, { fields: { z: null, i: null } }),
      sol: () => { const v = vals(); return S('rlc', BASE, { fields: { z: f(v.z, 2) + ' Ω', i: f(v.i, 2) + ' A' } }); },
      wrong: () => { const v = vals(); return [{ name: 'R + X addiert', answer: S('rlc', BASE, { fields: { z: f(v.zFalsch, 2), i: f(v.iFalsch, 2) } }) },
        { name: 'nur X_L benutzt', answer: S('rlc', BASE, { fields: { z: f(v.xl, 2), i: f(v.iNurX, 2) } }) }]; } };
  })();

  /* ====================================================================== ws7: Reale Spule messen (Pool) */
  const M7 = (() => {
    const BASE = { aufbau: 'RL', u: 230, f: 50, c: 4.7e-6, bezug: 'auto', wert: 'effektiv', ziel: 0 }, OWN = ['r', 'l'], MI = 2.5, MP = 150;
    const coil = () => once('c7', () => CORE().rlc.coil({ u: BASE.u, i: MI, p: MP }));
    const exR = () => once('exr7', () => U.calcEx({ value: coil().r, unit: 'Ω', what: 'R', extras: [{ v: coil().z, msg: 'Das ist der Scheinwiderstand Z = U / I. Der Wirkwiderstand folgt aus der Wirkleistung: R = P / I².' }] }));
    const exX = () => once('exx7', () => U.calcEx({ kind: 'spule', given: { u: BASE.u, i: MI, p: MP }, what: 'X_L' }));
    const vals = () => once('v7', () => { const c = coil(); return { u: BASE.u, i: MI, p: MP, z: c.z, r: c.r, xl: c.xl, l: c.l, lmH: c.l * 1000 }; });
    const check = mk('rlc', OWN, (c, r, a) => {
      const eff = effOf(c, 'rlc', OWN, BASE), sim = snap('rlc', eff), v = vals();
      inputRow(c, r, sim, a, 'rlc');
      U.calcRow(r, exR(), U.rawOf(a, 'r'), 'Wirkwiderstand R der Spule berechnet (Toleranz 3 %)');
      U.calcRow(r, exX(), U.rawOf(a, 'xl'), 'Blindwiderstand X_L der Spule berechnet (Toleranz 3 %)');
      r(near(sim.m.i, v.i, 0.03) && near(sim.s.p, v.p, 0.03), 'Die nachgebaute Spule nimmt ' + f(v.i, 1) + ' A und ' + f(v.p, 0) + ' W auf', 'Im Prüfstand fließen ' + f(sim.m.i, 2) + ' A bei ' + f(sim.s.p, 1) + ' W (R = ' + f(eff.r, 1) + ' Ω, L = ' + f(eff.l, 3) + ' H); verlangt sind ' + f(v.i, 1) + ' A und ' + f(v.p, 0) + ' W.');
    });
    return { vals, check, consts: [BASE.f],
      text: () => 'Eine Spule (Reihenschaltung aus Wirkwiderstand R und Induktivität L) wird an ' + f(BASE.u, 0) + ' V Wechselspannung (' + f(BASE.f, 0) + ' Hz) betrieben. Ein Strommesser zeigt ' + f(MI, 1) + ' A, ein Leistungsmesser ' + f(MP, 0) + ' W. Berechne R und den Blindwiderstand X_L und stelle R und L der Spule im Prüfstand so ein, dass dieselben Messwerte entstehen.',
      fields: () => [{ key: 'r', label: 'Wirkwiderstand R', unit: 'Ω' }, { key: 'xl', label: 'Blindwiderstand X_L', unit: 'Ω' }],
      hint: () => { const v = vals(); return [
        'Die Wirkleistung wird nur im Wirkwiderstand umgesetzt: P = I² · R. Der Scheinwiderstand ist Z = U / I; der Blindwiderstand folgt geometrisch aus Z und R.',
        'Z = ' + f(v.u, 0) + ' V / ' + f(v.i, 1) + ' A = ' + f(v.z, 0) + ' Ω; R = P / I² = ' + f(v.r, 0) + ' Ω. R = U / I wäre der Scheinwiderstand und damit falsch.',
        'Musterlösung: X_L = √(Z² − R²) = ' + f(v.xl, 1) + ' Ω, also L = X_L / ω = ' + f(v.lmH, 1) + ' mH.'
      ]; },
      start: () => S('rlc', Object.assign({}, BASE, { r: 100, l: 0.25 }), { fields: { r: null, xl: null } }),
      sol: () => { const v = vals(); return S('rlc', Object.assign({}, BASE, { r: v.r, l: v.l }), { fields: { r: f(v.r, 1) + ' Ω', xl: f(v.xl, 1) + ' Ω' } }); },
      wrong: () => { const v = vals(); return [{ name: 'R = U / I', answer: S('rlc', Object.assign({}, BASE, { r: v.z, l: v.l }), { fields: { r: f(v.z, 0), xl: f(v.xl, 1) } }) },
        { name: 'X_L = Z − R', answer: S('rlc', Object.assign({}, BASE, { r: v.r, l: v.l }), { fields: { r: f(v.r, 0), xl: f(v.z - v.r, 1) } }) }]; } };
  })();

  /* ====================================================================== ws8: Gesamtspannung (Pool) */
  const M8 = (() => {
    const UR = 15, UL = 30, UC = 10, IA = 0.15, RR = 100, FF = 50;
    const BASE = () => { const w = 2 * Math.PI * FF; return { aufbau: 'RLC', u: CORE().rlc.series ? Math.hypot(UR, UL - UC) : 25, f: FF, r: RR, l: (UL / IA) / w, c: 1 / (w * (UC / IA)), bezug: 'auto', wert: 'effektiv', ziel: 0 }; };
    const ex = () => once('ex8', () => U.calcEx({ kind: 'uGeom', given: { ur: UR, ul: UL, uc: UC }, what: 'U' }));
    const vals = () => once('v8', () => { const s = snap('rlc', fullCtl('rlc', BASE())); return { ur: UR, ul: UL, uc: UC, u: ex().value, summe: UR + UL + UC, ohneC: Math.hypot(UR, UL), diff: UL - UC, urSim: s.m.ur, ulSim: s.m.ul, ucSim: s.m.uc, i: IA }; });
    const check = mk('rlc', [], (c, r, a) => {
      const sim = snap('rlc', fullCtl('rlc', BASE()));
      inputRow(c, r, sim, a, 'rlc');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Gesamtspannung U geometrisch berechnet (Toleranz 3 %)');
    });
    return { vals, check, consts: [],
      text: () => 'In einer Reihenschaltung aus R, L und C (Übungsschaltung, im Prüfstand „R, L, C im Wechselstromkreis“ eingestellt) werden die Teilspannungen U_R = ' + f(UR, 0) + ' V, U_L = ' + f(UL, 0) + ' V und U_C = ' + f(UC, 0) + ' V gemessen. Berechne die Gesamtspannung U der Quelle.',
      ask: { label: 'Gesamtspannung U', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Die Teilspannungen sind gegeneinander phasenverschoben. U_L und U_C zeigen in entgegengesetzte Richtungen und ziehen sich ab; U_R steht im rechten Winkel dazu.',
        'U_L − U_C = ' + f(v.diff, 0) + ' V. Die einfache Summe aller drei Spannungen, ' + f(v.summe, 0) + ' V, ist falsch.',
        'Musterlösung: U = √(' + f(v.ur, 0) + '² + ' + f(v.diff, 0) + '²) V = ' + f(v.u, 0) + ' V.'
      ]; },
      start: () => S('rlc', BASE(), { value: null }),
      sol: () => S('rlc', BASE(), { value: vals().u }),
      wrong: () => { const v = vals(); return [{ name: 'arithmetisch addiert', answer: S('rlc', BASE(), { value: v.summe }) }, { name: 'U_L + U_C mit U_R geometrisch', answer: S('rlc', BASE(), { value: Math.hypot(UR, UL + UC) }) }]; } };
  })();

  /* ====================================================================== ws9: Eilt vor oder nach? */
  const M9 = (() => {
    const BASE = { u: 230, f: 50, r: 100, l: 0.1, c: 4.7e-6, bezug: 'auto', wert: 'effektiv', ziel: 0 };
    const vals = () => once('v9', () => {
      const sl = snap('rlc', fullCtl('rlc', Object.assign({}, BASE, { aufbau: 'L' }))), sc = snap('rlc', fullCtl('rlc', Object.assign({}, BASE, { aufbau: 'C' })));
      return { phiL: sl.m.phi, phiC: sc.m.phi, il: sl.m.i, ic: sc.m.i, artL: sl.s.art, artC: sc.s.art };
    });
    const O = () => [opt('vor', 'Der Strom eilt der Spannung vor.', 'Dann läge der Strom zeitlich vor der Spannung, wie es beim Kondensator ist.'), opt('nach', 'Der Strom eilt der Spannung nach.', 'Dann läge der Strom hinter der Spannung, wie es bei der Spule ist.')];
    const OL = (right) => [opt('vor', 'Der Strom eilt der Spannung vor.', 'Hier ist es umgekehrt: Der Strom folgt der Spannung (Spule) bzw. geht ihr voraus (Kondensator).'), opt('nach', 'Der Strom eilt der Spannung nach.', 'Hier ist es umgekehrt.')].map(o => o);
    const P = () => { const v = vals(); return [opt('minus', 'φ = ' + f(v.phiC, 0) + '° (die Spannung eilt dem Strom nach)', 'Das Vorzeichen ist vertauscht: Beim Kondensator eilt der Strom vor, also ist φ = φ_u − φ_i negativ.'), opt('plus', 'φ = +' + f(Math.abs(v.phiC), 0) + '° (die Spannung eilt dem Strom vor)', 'Das ist das Verhalten der Spule, nicht des Kondensators.'), opt('null', 'φ = 0° (Spannung und Strom sind in Phase)', 'Null Grad hat nur der reine Wirkwiderstand.')]; };
    const check = mk('rlc', [], (c, r, a) => {
      const sim = snap('rlc', fullCtl('rlc', Object.assign({}, BASE, { aufbau: 'RLC' }))), v = vals();
      inputRow(c, r, sim, a, 'rlc');
      const rightL = v.phiL > 0 ? 'nach' : 'vor', rightC = v.phiC < 0 ? 'vor' : 'nach';
      U.choiceRow(r, a, { key: 'spule', right: rightL, opts: O(), label: 'Spule: Lage von Strom und Spannung richtig gewählt' });
      U.choiceRow(r, a, { key: 'kond', right: rightC, opts: O(), label: 'Kondensator: Lage von Strom und Spannung richtig gewählt' });
      U.choiceRow(r, a, { key: 'phiC', right: v.phiC < 0 ? 'minus' : 'plus', opts: P(), label: 'Vorzeichen von φ beim Kondensator richtig gewählt' });
    });
    return { vals, check, consts: [],
      text: () => 'Wähle im Prüfstand „R, L, C im Wechselstromkreis“ nacheinander „L“ und „C“ als Aufbau und sieh dir das Zeigerbild an. Vereinbarung: φ = φ_u − φ_i, die Zeiger drehen gegen den Uhrzeigersinn. Beantworte die drei Fragen.',
      choices: () => [U.choiceDef('spule', 'Spule: Wie liegen Strom und Spannung zueinander?', O()), U.choiceDef('kond', 'Kondensator: Wie liegen Strom und Spannung zueinander?', O()), U.choiceDef('phiC', 'Welcher Phasenwinkel gehört zum Kondensator?', P())],
      hint: () => { const v = vals(); return [
        'Merke: Bei der Spule wächst der Strom erst langsam an, er kommt später als die Spannung. Beim Kondensator fließt der Ladestrom zuerst, der Strom ist früher da.',
        'Der Prüfstand zeigt bei der Spule φ = ' + f(v.phiL, 0) + '°, beim Kondensator φ = ' + f(v.phiC, 0) + '°. Positives φ heißt: Die Spannung eilt dem Strom vor.',
        'Musterlösung: Spule: Der Strom eilt der Spannung nach (um ' + f(Math.abs(v.phiL), 0) + '°). Kondensator: Der Strom eilt der Spannung vor, φ = ' + f(v.phiC, 0) + '°.'
      ]; },
      start: () => S('rlc', Object.assign({}, BASE, { aufbau: 'L' }), { choices: {} }),
      sol: () => S('rlc', Object.assign({}, BASE, { aufbau: 'C' }), { choices: { spule: 'nach', kond: 'vor', phiC: 'minus' } }),
      wrong: () => [{ name: 'Spule und Kondensator vertauscht', answer: S('rlc', BASE, { choices: { spule: 'vor', kond: 'nach', phiC: 'plus' } }) }, { name: 'Kondensator in Phase', answer: S('rlc', BASE, { choices: { spule: 'nach', kond: 'vor', phiC: 'null' } }) }] };
  })();

  /* ====================================================================== ws10: Blindleistung aus drei Messwerten (Pool) */
  const M10 = (() => {
    const BASE = { art: 'induktiv', rl: 0.5, ansicht: 'zeit', ziel: 0 }, OWN = ['u', 'gib', 'i', 'cosphi'], UU = 100, II = 0.25, PP = 12;
    const fm10 = () => once('fm10', () => CORE().power.fromMeasure(UU, II, PP));
    const exS = () => once('exs10', () => U.calcEx({ value: UU * II, unit: 'VA', what: 'S', extras: [{ v: PP, msg: 'Das ist die Wirkleistung P in W. Die Scheinleistung ist S = U · I.' }] }));
    const exQ = () => once('exq10', () => U.calcEx({ kind: 'qAusSP', given: { u: UU, i: II, p: PP }, what: 'Q', extras: [{ v: PP, msg: 'Das ist die Wirkleistung P in W, nicht die Blindleistung. Q = √(S² − P²) mit S = U · I.' }] }));
    const vals = () => once('v10', () => { const m = fm10(); return { u: UU, i: II, p: PP, s: UU * II, q: exQ().value, cos: PP / (UU * II), qFalsch: UU * II - PP }; });
    const check = mk('leistung', OWN, (c, r, a) => {
      const eff = effOf(c, 'leistung', OWN, BASE), sim = snap('leistung', eff), v = vals();
      inputRow(c, r, sim, a, 'leistung');
      U.calcRow(r, exS(), U.rawOf(a, 's'), 'Scheinleistung S berechnet (Toleranz 3 %)');
      U.calcRow(r, exQ(), U.rawOf(a, 'q'), 'Blindleistung Q berechnet (Toleranz 3 %)');
      r(near(sim.m.p, PP, 0.03) && near(sim.m.s, v.s, 0.03), 'Die nachgestellte Last zeigt P = ' + f(PP, 0) + ' W und S = ' + f(v.s, 0) + ' VA', 'Der Prüfstand zeigt P = ' + f(sim.m.p, 2) + ' W und S = ' + f(sim.m.s, 2) + ' VA bei U = ' + f(eff.u, 0) + ' V, ' + (eff.gib === 'i' ? 'I = ' + f(eff.i, 2) + ' A' : 'P = ' + f(eff.p, 1) + ' W') + ' und cos φ = ' + f(eff.cosphi, 2) + '. Wirkleistung ist P = U · I · cos φ.');
    });
    return { vals, check, consts: [],
      text: () => 'Zur Messung an einer Spule (R und L in Reihe) zeigen der Spannungsmesser ' + f(UU, 0) + ' V, der Strommesser ' + f(II, 2) + ' A und der Leistungsmesser ' + f(PP, 0) + ' W. Berechne die Scheinleistung S und die Blindleistung Q. Stelle im Prüfstand „Wirk-, Blind- und Scheinleistung“ eine Last ein, die dieselbe Wirk- und Scheinleistung hat (Strom vorgeben, cos φ = P / S).',
      fields: () => [{ key: 's', label: 'Scheinleistung S', unit: 'VA' }, { key: 'q', label: 'Blindleistung Q', unit: 'var' }],
      hint: () => { const v = vals(); return [
        'Die Scheinleistung ist das Produkt der beiden Zeigermessgrößen S = U · I. Im Leistungsdreieck ist S die Hypotenuse, P und Q sind die Katheten.',
        'S = ' + f(v.u, 0) + ' V · ' + f(v.i, 2) + ' A = ' + f(v.s, 0) + ' VA, cos φ = P / S = ' + f(v.cos, 2) + '. Q = S − P = ' + f(v.qFalsch, 0) + ' var wäre falsch, weil nur geometrisch addiert wird.',
        'Musterlösung: Q = √(S² − P²) = √(' + f(v.s, 0) + '² − ' + f(v.p, 0) + '²) var = ' + f(v.q, 1) + ' var.'
      ]; },
      start: () => S('leistung', Object.assign({}, BASE, { u: 230, gib: 'p', p: 3200, cosphi: 0.8 }), { fields: { s: null, q: null } }),
      sol: () => { const v = vals(); return S('leistung', Object.assign({}, BASE, { u: UU, gib: 'i', i: II, cosphi: v.cos }), { fields: { s: f(v.s, 0) + ' VA', q: f(v.q, 1) + ' var' } }); },
      wrong: () => { const v = vals(); const rc = Object.assign({}, BASE, { u: UU, gib: 'i', i: II, cosphi: v.cos }); return [{ name: 'P statt Q', answer: S('leistung', rc, { fields: { s: f(v.s, 0), q: f(PP, 0) } }) }, { name: 'Q = S − P', answer: S('leistung', rc, { fields: { s: f(v.s, 0), q: f(v.qFalsch, 0) } }) }]; } };
  })();

  /* ====================================================================== ws11: Blindleistung aus P und cos phi (Pool) */
  const M11 = (() => {
    const BASE = { u: 230, gib: 'p', art: 'induktiv', rl: 0.5, ansicht: 'zeit', ziel: 0, i: 10 }, OWN = ['p', 'cosphi'], PP = 3200, CS = 0.8;
    const pc = () => once('pc11', () => CORE().power.fromPcos(PP, CS, 230));
    const exQ = () => once('exq11', () => U.calcEx({ kind: 'qAusPcos', given: { p: PP, cosphi: CS }, what: 'Q', extras: [{ v: pc().s, msg: 'Das ist die Scheinleistung S = P / cos φ (in VA). Gefragt ist die Blindleistung Q = P · tan φ in var.' }] }));
    const vals = () => once('v11', () => ({ p: PP / 1000, cos: CS, phi: pc().phi, tan: Math.tan(pc().phi * Math.PI / 180), q: exQ().value / 1000, s: pc().s / 1000, sin: Math.sin(pc().phi * Math.PI / 180), qSin: PP * Math.sin(pc().phi * Math.PI / 180) / 1000 }));
    const check = mk('leistung', OWN, (c, r, a) => {
      const eff = effOf(c, 'leistung', OWN, BASE), sim = snap('leistung', eff), v = vals();
      inputRow(c, r, sim, a, 'leistung');
      U.calcRow(r, exQ(), U.rawOf(a, 'value'), 'Blindleistung Q berechnet (Toleranz 3 %)');
      r(near(sim.m.q, v.q * 1000, 0.03), 'Der Prüfstand zeigt die Blindleistung ' + f(v.q, 2) + ' kvar', 'Der Prüfstand zeigt Q = ' + f(sim.m.q, 1) + ' var bei P = ' + f(eff.p, 0) + ' W und cos φ = ' + f(eff.cosphi, 2) + '. Stelle P = ' + f(PP, 0) + ' W und cos φ = ' + f(CS, 1) + ' ein.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Wechselstromverbraucher an ' + f(BASE.u, 0) + ' V / ' + f(lim('f_netz'), 0) + ' Hz nimmt laut Leistungsmesser die Wirkleistung ' + f(PP / 1000, 1) + ' kW auf. Der Leistungsfaktormesser zeigt cos φ = ' + f(CS, 1) + '. Wie groß ist die Blindleistung? Stelle die Last auch im Prüfstand „Wirk-, Blind- und Scheinleistung“ ein.',
      ask: { label: 'Blindleistung Q', unit: 'kvar' },
      hint: () => { const v = vals(); return [
        'Aus cos φ folgt der Winkel φ. Die Blindleistung ist die Wirkleistung mal tan φ: Q = P · tan φ.',
        'cos φ = ' + f(v.cos, 1) + ' gibt φ = ' + f(v.phi, 2) + '°, tan φ = ' + f(v.tan, 2) + '. Mit sin φ = ' + f(v.sin, 2) + ' käme ' + f(v.qSin, 2) + ' kvar heraus: Das wäre Q = P · sin φ und damit falsch.',
        'Musterlösung: Q = ' + f(v.p, 1) + ' kW · ' + f(v.tan, 2) + ' = ' + f(v.q, 2) + ' kvar (Kontrolle: S = P / cos φ = ' + f(v.s, 1) + ' kVA).'
      ]; },
      start: () => S('leistung', Object.assign({}, BASE, { p: 1000, cosphi: 1 }), { value: null }),
      sol: () => S('leistung', Object.assign({}, BASE, { p: PP, cosphi: CS }), { text: f(vals().q, 2) + ' kvar' }),
      wrong: () => { const v = vals(); const rc = Object.assign({}, BASE, { p: PP, cosphi: CS }); return [{ name: 'sin statt tan', answer: S('leistung', rc, { text: f(v.qSin, 2) + ' kvar' }) }, { name: 'S statt Q', answer: S('leistung', rc, { text: f(v.s, 2) + ' kvar' }) }]; } };
  })();

  /* ====================================================================== ws12: Welche Aussage stimmt? (Pool) */
  const M12 = (() => {
    const BASE = { u: 230, gib: 'p', p: 3200, cosphi: 0.8, art: 'induktiv', rl: 0.5, ansicht: 'zeiger', ziel: 0, i: 10 };
    const vals = () => once('v12', () => { const s = snap('leistung', fullCtl('leistung', BASE)); return { p: s.m.p / 1000, q: s.m.q / 1000, s: s.m.s / 1000, summe: (s.m.p + s.m.q) / 1000, diff: (s.m.s - s.m.p) / 1000 }; });
    const O1 = () => [
      opt('a', 'Die Scheinleistung ist die Summe aus Wirk- und Blindleistung: S = P + Q.', 'P und Q stehen im rechten Winkel (Leistungsdreieck); sie werden geometrisch addiert, nicht einfach zusammengezählt.'),
      opt('b', 'Die Blindleistung wird in W angegeben und ist die in Wärme umgesetzte Leistung.', 'Die Blindleistung wird in var angegeben; in Wärme wird die Wirkleistung (W) umgesetzt.'),
      opt('c', 'Die Wirkleistung ist immer größer als die Scheinleistung.', 'Die Wirkleistung ist nie größer als die Scheinleistung, P = S · cos φ mit cos φ ≤ 1.'),
      opt('d', 'Bei einer reinen Spule ist die Wirkleistung gleich der Scheinleistung.', 'Bei einer reinen Spule ist die Wirkleistung null (φ = 90°); die Scheinleistung besteht nur aus Blindleistung.'),
      opt('e', 'Die Scheinleistung ist die geometrische Summe aus Wirk- und Blindleistung: S = √(P² + Q²).', '')];
    const O2 = () => { const v = vals(); return [opt('geo', f(v.s, 1) + ' kVA', ''), opt('sum', f(v.summe, 1) + ' kVA', 'Das ist P + Q einfach zusammengezählt. Die Leistungen stehen im rechten Winkel und werden geometrisch addiert.'), opt('dif', f(v.diff, 1) + ' kVA', 'Das ist S − P; im Leistungsdreieck gilt aber der Satz des Pythagoras.')]; };
    const check = mk('leistung', [], (c, r, a) => {
      const sim = snap('leistung', fullCtl('leistung', BASE));
      inputRow(c, r, sim, a, 'leistung');
      U.choiceRow(r, a, { key: 'q1', right: 'e', opts: O1(), label: 'Aussage zu Wirk-, Blind- und Scheinleistung richtig gewählt' });
      U.choiceRow(r, a, { key: 'q2', right: 'geo', opts: O2(), label: 'Scheinleistung im Prüfstand richtig gewählt' });
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Im Prüfstand „Wirk-, Blind- und Scheinleistung“ ist ein Verbraucher mit P = ' + f(v.p, 1) + ' kW und Q = ' + f(v.q, 1) + ' kvar eingestellt; das Zeigerbild zeigt das Leistungsdreieck. Beantworte die beiden Fragen.'; },
      choices: () => [U.choiceDef('q1', 'Welche Aussage zu Wirk-, Blind- und Scheinleistung ist richtig?', O1()), U.choiceDef('q2', 'Wie groß ist die Scheinleistung dieses Verbrauchers?', O2())],
      hint: () => { const v = vals(); return [
        'P, Q und S bilden ein rechtwinkliges Dreieck: S ist die Hypotenuse. Einheiten: P in W, Q in var, S in VA.',
        'Aus P = ' + f(v.p, 1) + ' kW und Q = ' + f(v.q, 1) + ' kvar folgt S durch Pythagoras. Die Summe ' + f(v.summe, 1) + ' kVA wäre falsch.',
        'Musterlösung: Aussage „S = √(P² + Q²)“ ist richtig; S = ' + f(v.s, 1) + ' kVA.'
      ]; },
      start: () => S('leistung', BASE, { choices: {} }),
      sol: () => S('leistung', BASE, { choices: { q1: 'e', q2: 'geo' } }),
      wrong: () => [{ name: 'S = P + Q', answer: S('leistung', BASE, { choices: { q1: 'a', q2: 'sum' } }) }, { name: 'var gegen W vertauscht', answer: S('leistung', BASE, { choices: { q1: 'b', q2: 'dif' } }) }] };
  })();

  /* ====================================================================== ws13: Strom aus Leistung und cos phi */
  const M13 = (() => {
    const BASE = { u: 230, gib: 'p', art: 'induktiv', rl: 0.5, ansicht: 'zeit', ziel: 0, i: 10 }, OWN = ['p', 'cosphi'], PP = 1500, CS = 0.75;
    const pc = () => once('pc13', () => CORE().power.fromPcos(PP, CS, BASE.u));
    const exI = () => once('exi13', () => U.calcEx({ value: pc().i, unit: 'A', what: 'I', extras: [{ v: PP / BASE.u, msg: 'Hier fehlt cos φ: I = P / U wäre der Strom einer reinen Wirklast. Die Scheinleistung S = P / cos φ ist größer, deshalb ist auch der Strom größer.' }, { v: PP * CS / BASE.u, msg: 'Hier ist mit P · cos φ gerechnet worden. Es gilt S = P / cos φ, der Strom ist I = P / (U · cos φ).' }] }));
    const vals = () => once('v13', () => ({ p: PP, cos: CS, u: BASE.u, s: pc().s, i: exI().value, iOhne: PP / BASE.u }));
    const check = mk('leistung', OWN, (c, r, a) => {
      const eff = effOf(c, 'leistung', OWN, BASE), sim = snap('leistung', eff), v = vals();
      inputRow(c, r, sim, a, 'leistung');
      setRow(r, 'leistung', eff, [{ key: 'p', want: PP }, { key: 'cosphi', want: CS }], 'Am Prüfstand sind P = ' + f(PP, 0) + ' W und cos φ = ' + f(CS, 2) + ' eingestellt');
      U.calcRow(r, exI(), U.rawOf(a, 'i'), 'Strom I aus P, U und cos φ berechnet (Toleranz 3 %)');
      r(near(sim.m.i, v.i, 0.03), 'Das Messgerät im Prüfstand zeigt denselben Strom', 'Das Messgerät zeigt I = ' + f(sim.m.i, 2) + ' A, berechnet ist ' + f(v.i, 2) + ' A.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Verbraucher (Übungsschaltung) nimmt an ' + f(BASE.u, 0) + ' V die Wirkleistung P = ' + f(PP, 0) + ' W bei cos φ = ' + f(CS, 2) + ' auf. Stelle ihn im Prüfstand „Wirk-, Blind- und Scheinleistung“ ein und berechne den Strom I, der aus dem Netz fließt.',
      fields: () => [{ key: 'i', label: 'Strom I', unit: 'A' }],
      hint: () => { const v = vals(); return [
        'Der Strom wird von der Scheinleistung bestimmt: S = U · I. Aus der Wirkleistung folgt S = P / cos φ.',
        'S = ' + f(v.p, 0) + ' W / ' + f(v.cos, 2) + ' = ' + f(v.s, 0) + ' VA. Ohne cos φ wären es nur ' + f(v.iOhne, 2) + ' A: Das ist zu wenig.',
        'Musterlösung: I = P / (U · cos φ) = ' + f(v.p, 0) + ' W / (' + f(v.u, 0) + ' V · ' + f(v.cos, 2) + ') = ' + f(v.i, 2) + ' A.'
      ]; },
      start: () => S('leistung', Object.assign({}, BASE, { p: 3200, cosphi: 0.8 }), { fields: { i: null } }),
      sol: () => S('leistung', Object.assign({}, BASE, { p: PP, cosphi: CS }), { fields: { i: f(vals().i, 2) + ' A' } }),
      wrong: () => { const v = vals(); const rc = Object.assign({}, BASE, { p: PP, cosphi: CS }); return [{ name: 'cos φ vergessen', answer: S('leistung', rc, { fields: { i: f(v.iOhne, 2) } }) }, { name: 'zu groß', answer: S('leistung', rc, { fields: { i: f(v.i * 1.6, 2) } }) }]; } };
  })();

  /* ====================================================================== ws14: Kompensiere auf 0,95 */
  const M14 = (() => {
    const BASE = { u: 230, p: 3200, cos1: 0.8, ziel: 0.95, form: 'parallel' }, OWN = ['c'];
    const nd = () => once('nd14', () => CORE().comp.need({ p: BASE.p, cos1: BASE.cos1, cos2: BASE.ziel, u: BASE.u, f: lim('f_netz'), form: 'parallel' }));
    const cMax = () => once('cm14', () => CORE().comp.cMax({ p: BASE.p, cos1: BASE.cos1, u: BASE.u, f: lim('f_netz') }));
    const cSol = () => Math.ceil(nd().c * 1e7) / 1e7;
    const pkC = () => once('pk14', () => CORE().comp.after({ p: BASE.p, cos1: BASE.cos1, u: BASE.u, f: lim('f_netz'), c: cMax() }));
    const vals = () => once('v14', () => { const n = nd(), a = snap('kompens', fullCtl('kompens', Object.assign({}, BASE, { c: cSol() }))); return { p: BASE.p, cos1: BASE.cos1, ziel: BASE.ziel, c: n.c * MU, cs: cSol() * MU, cmax: cMax() * MU, qc: n.qc, i1: n.i1, i2: n.i2, cos2: a.m.cos2, klein: 40, gross: 200 }; });
    const check = mk('kompens', OWN, (c, r, a) => {
      const eff = effOf(c, 'kompens', OWN, BASE), sim = snap('kompens', eff), v = vals();
      inputRow(c, r, sim, a, 'kompens');
      const z = sim.s.zustand;
      r(z === 'ziel' && sim.a && sim.a.ampel === 'gruen', 'cos φ erreicht das Ziel ' + f(BASE.ziel, 2) + ' (Ampel grün)', 'Mit C = ' + f(eff.c * MU, 1) + ' µF ist cos φ = ' + f(sim.m.cos2, 3) + ': ' + (z === 'unter' ? 'Das Ziel ' + f(BASE.ziel, 2) + ' ist nicht erreicht, das C ist zu klein (nötig sind mindestens ' + f(v.c, 2) + ' µF).' : z === 'ueber' ? 'Das C ist größer als die Grenze ' + f(v.cmax, 1) + ' µF, die Last ist überkompensiert.' : 'Der Zustand ist „' + z + '“.'));
      r(z !== 'ueber' && eff.c <= cMax() * 1.000001, 'Es liegt keine Überkompensation vor (C höchstens ' + f(v.cmax, 1) + ' µF)', 'C = ' + f(eff.c * MU, 1) + ' µF ist größer als die Grenze ' + f(v.cmax, 1) + ' µF: Die Last wird kapazitiv (Q negativ). Bei ' + f(v.cmax, 1) + ' µF ist cos φ am größten (' + f(pkC().cos, 1) + ') und der Strom am kleinsten (' + f(pkC().i, 2) + ' A); darüber fällt cos φ wieder auf ' + f(sim.m.cos2, 3) + ', und der Strom steigt gegenüber diesem Minimum wieder auf ' + f(sim.m.i2, 2) + ' A.');
      r(sim.m.i2 < sim.m.i1 - 1e-9 && eff.c > 0, 'Der Netzstrom ist gesunken', 'Der Netzstrom ' + f(sim.m.i2, 2) + ' A ist nicht kleiner als ohne Kondensator (' + f(sim.m.i1, 2) + ' A).');
    });
    return { vals, check, consts: [BASE.u],
      text: () => 'Ein Motor (Übungsschaltung: P = ' + f(BASE.p, 0) + ' W, cos φ = ' + f(BASE.cos1, 1) + ', ' + f(BASE.u, 0) + ' V, ' + f(lim('f_netz'), 0) + ' Hz) soll mit einem Parallelkondensator auf cos φ = ' + f(BASE.ziel, 2) + ' kompensiert werden (Übungsziel, die Vorgabe ist im Prüfstand gesetzt). Stelle im Prüfstand „Blindleistungskompensation“ die Kapazität C so ein, dass das Ziel erreicht wird, ohne zu überkompensieren.',
      hint: () => { const v = vals(); return [
        'Der Kondensator liefert Blindleistung und senkt damit den Blindanteil des Stroms. Zu wenig C erreicht das Ziel nicht, zu viel überkompensiert: Die Last wird kapazitiv und cos φ sinkt wieder.',
        'Bei C = ' + f(v.klein, 0) + ' µF ist das Ziel noch nicht erreicht, bei C = ' + f(v.gross, 0) + ' µF ist es überkompensiert. Die Grenze der Überkompensation liegt bei ' + f(v.cmax, 1) + ' µF, nötig sind ' + f(v.c, 2) + ' µF.',
        'Musterlösung: C = ' + f(v.cs, 1) + ' µF (auf 0,1 µF aufgerundet, exakt ' + f(v.c, 2) + ' µF; Q_C = ' + f(v.qc, 0) + ' var); cos φ = ' + f(v.cos2, 3) + ', der Strom sinkt von ' + f(v.i1, 2) + ' A auf ' + f(v.i2, 2) + ' A.'
      ]; },
      start: () => S('kompens', Object.assign({}, BASE, { c: 0 })),
      sol: () => S('kompens', Object.assign({}, BASE, { c: cSol() })),
      wrong: () => [{ name: 'C zu klein (40 µF)', answer: S('kompens', Object.assign({}, BASE, { c: 40e-6 })) }, { name: 'überkompensiert (200 µF)', answer: S('kompens', Object.assign({}, BASE, { c: 200e-6 })) }] };
  })();

  /* ====================================================================== ws15: Kondensator berechnen */
  const M15 = (() => {
    const BASE = { u: 230, p: 3200, cos1: 0.8, ziel: 0.95, form: 'parallel' }, OWN = ['c'];
    const g15 = () => ({ p: BASE.p, cos1: BASE.cos1, cos2: BASE.ziel, u: BASE.u, f: lim('f_netz') });
    const ex = () => once('ex15', () => {
      const g = g15(), w = 2 * Math.PI * g.f, qc = CORE().comp.need(Object.assign({ form: 'parallel' }, g)).qc, q1 = g.p * Math.tan(Math.acos(g.cos1));
      return U.calcEx({ kind: 'cKomp', given: g, what: 'C', extras: [{ v: q1 / (w * g.u * g.u), msg: 'Hier ist mit tan φ₁ statt mit (tan φ₁ − tan φ₂) gerechnet worden: Das wäre das C für cos φ = 1. Für das Ziel zieht man die Blindleistung des Ziels ab.' }, { v: qc / (w * g.u), msg: 'Hier fehlt das Quadrat der Spannung: C = Q_C / (ω · U²).' }] });
    });
    const vals = () => once('v15', () => { const g = g15(), n = CORE().comp.need(Object.assign({ form: 'parallel' }, g)), w = 2 * Math.PI * g.f; return { p: g.p, cos1: g.cos1, cos2: g.cos2, u: g.u, qc: n.qc, c: ex().value * MU, q1: g.p * Math.tan(Math.acos(g.cos1)), cEins: g.p * Math.tan(Math.acos(g.cos1)) / (w * g.u * g.u) * MU, w }; });
    const check = mk('kompens', OWN, (c, r, a) => {
      const eff = effOf(c, 'kompens', OWN, BASE), sim = snap('kompens', eff), v = vals();
      inputRow(c, r, sim, a, 'kompens');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Kapazität C für das Ziel berechnet (Toleranz 3 %)');
      r(sim.s.zustand === 'ziel' && sim.a && sim.a.ampel !== 'rot', 'Mit deinem C im Prüfstand wird das Ziel erreicht (nicht überkompensiert)', 'Mit C = ' + f(eff.c * MU, 2) + ' µF ist cos φ = ' + f(sim.m.cos2, 3) + ' und der Zustand „' + sim.s.zustand + '“. Das nötige C ist ' + f(v.c, 2) + ' µF.');
    });
    return { vals, check, consts: [BASE.u],
      text: () => 'Eine Last (Übungsschaltung: P = ' + f(BASE.p, 0) + ' W, cos φ = ' + f(BASE.cos1, 1) + ') liegt an ' + f(BASE.u, 0) + ' V / ' + f(lim('f_netz'), 0) + ' Hz. Berechne die Kapazität C, die parallel zur Last den Leistungsfaktor auf cos φ = ' + f(BASE.ziel, 2) + ' bringt, und stelle sie im Prüfstand „Blindleistungskompensation“ ein.',
      ask: { label: 'Kapazität C', unit: 'µF' },
      hint: () => { const v = vals(); return [
        'Erst die nötige Blindleistung Q_C = P · (tan φ₁ − tan φ₂), dann C = Q_C / (ω · U²) mit ω = 2π · f.',
        'Q_C = ' + f(v.qc, 1) + ' var. Mit tan φ₁ allein (Q = ' + f(v.q1, 0) + ' var) käme ' + f(v.cEins, 1) + ' µF heraus, das wäre das C für cos φ = 1 und damit zu groß.',
        'Musterlösung: C = ' + f(v.qc, 1) + ' var / (' + f(v.w, 2) + ' 1/s · (' + f(v.u, 0) + ' V)²) = ' + f(v.c, 2) + ' µF.'
      ]; },
      start: () => S('kompens', Object.assign({}, BASE, { c: 0 }), { value: null }),
      sol: () => S('kompens', Object.assign({}, BASE, { c: Math.ceil(vals().c * 10) / 10 / MU }), { text: f(vals().c, 2) + ' µF' }),
      wrong: () => { const v = vals(); return [{ name: 'tan₁ statt tan₂', answer: S('kompens', Object.assign({}, BASE, { c: v.cEins / MU }), { text: f(v.cEins, 1) + ' µF' }) }, { name: 'U² vergessen', answer: S('kompens', Object.assign({}, BASE, { c: 0 }), { text: f(v.qc / (v.w * v.u) * 1000, 2) + ' mF' }) }]; } };
  })();

  /* ====================================================================== ws16: Was ändert die Kompensation? */
  const M16 = (() => {
    const BASE = { u: 230, p: 3200, cos1: 0.8, ziel: 0.95, form: 'parallel' };
    const C0 = () => Math.ceil(CORE().comp.need({ p: BASE.p, cos1: BASE.cos1, cos2: BASE.ziel, u: BASE.u, f: lim('f_netz'), form: 'parallel' }).c * 1e7) / 1e7;
    const vals = () => once('v16', () => { const b = snap('kompens', fullCtl('kompens', Object.assign({}, BASE, { c: 0 }))), a = snap('kompens', fullCtl('kompens', Object.assign({}, BASE, { c: C0() }))); return { i1: b.m.i1, i2: a.m.i2, p: BASE.p, q1: b.s.q1, q2: a.s.q, dpv: a.m.dpv }; });
    const O1 = () => [opt('sinkt', 'Er sinkt.', ''), opt('steigt', 'Er steigt.', 'Der Kondensator liefert Blindleistung, die vorher aus dem Netz kam: Der Netzstrom wird kleiner, nicht größer.'), opt('gleich', 'Er bleibt gleich.', 'Der Netzstrom ändert sich: Sein Blindanteil wird kleiner, also sinkt der Strom.')];
    const O2 = () => [opt('bleibt', 'Sie bleibt gleich.', ''), opt('sinkt', 'Sie sinkt.', 'Der Motor leistet weiter dasselbe; die Wirkleistung ändert sich durch den Kondensator nicht, nur die Blindleistung.'), opt('steigt', 'Sie steigt.', 'Der Kondensator nimmt keine Wirkleistung auf und gibt auch keine zusätzliche an den Motor ab: Sie bleibt gleich.')];
    const O3 = () => [opt('sinkt', 'Sie sinkt.', ''), opt('steigt', 'Sie steigt.', 'Der Kondensator liefert Blindleistung in der Gegenrichtung zur Spulenwirkung des Motors: Aus dem Netz wird weniger Blindleistung bezogen.'), opt('bleibt', 'Sie bleibt gleich.', 'Genau die Blindleistung wird kleiner, deshalb wird kompensiert.')];
    const check = mk('kompens', [], (c, r, a) => {
      const sim = snap('kompens', fullCtl('kompens', Object.assign({}, BASE, { c: C0() })));
      inputRow(c, r, sim, a, 'kompens');
      U.choiceRow(r, a, { key: 'strom', right: 'sinkt', opts: O1(), label: 'Netzstrom richtig beurteilt' });
      U.choiceRow(r, a, { key: 'wirk', right: 'bleibt', opts: O2(), label: 'Wirkleistung richtig beurteilt' });
      U.choiceRow(r, a, { key: 'blind', right: 'sinkt', opts: O3(), label: 'Blindleistung aus dem Netz richtig beurteilt' });
    });
    return { vals, check, consts: [BASE.u],
      text: () => 'Stelle im Prüfstand „Blindleistungskompensation“ erst ohne Kondensator (C = 0) und dann mit einem Kondensator, der den Motor auf cos φ = ' + f(BASE.ziel, 2) + ' bringt, die Messwerte ein und vergleiche. Beantworte, was sich durch die Kompensation ändert (der Motor leistet dasselbe).',
      choices: () => [U.choiceDef('strom', 'Was passiert mit dem Netzstrom?', O1()), U.choiceDef('wirk', 'Was passiert mit der Wirkleistung P des Motors?', O2()), U.choiceDef('blind', 'Was passiert mit der Blindleistung, die aus dem Netz bezogen wird?', O3())],
      hint: () => { const v = vals(); return [
        'Der Kondensator liefert die Blindleistung für den Motor vor Ort. Aus dem Netz muss weniger Blindleistung kommen; die Wirkleistung, die der Motor in Arbeit umsetzt, bleibt unverändert.',
        'Ohne Kondensator fließen ' + f(v.i1, 2) + ' A, mit Kondensator ' + f(v.i2, 2) + ' A; die Wirkleistung bleibt bei ' + f(v.p, 0) + ' W, die Blindleistung sinkt von ' + f(v.q1, 0) + ' var auf ' + f(v.q2, 0) + ' var.',
        'Musterlösung: Der Netzstrom sinkt, die Wirkleistung bleibt gleich, die bezogene Blindleistung sinkt (Leitungsverlust sinkt auf ' + f(v.dpv, 1) + ' %).'
      ]; },
      start: () => S('kompens', Object.assign({}, BASE, { c: 0 }), { choices: {} }),
      sol: () => S('kompens', Object.assign({}, BASE, { c: C0() }), { choices: { strom: 'sinkt', wirk: 'bleibt', blind: 'sinkt' } }),
      wrong: () => [{ name: 'Wirkleistung sinkt', answer: S('kompens', BASE, { choices: { strom: 'sinkt', wirk: 'sinkt', blind: 'sinkt' } }) }, { name: 'Strom steigt, Blindleistung steigt', answer: S('kompens', BASE, { choices: { strom: 'steigt', wirk: 'bleibt', blind: 'steigt' } }) }] };
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
    tk({ id: 'ws1', lab: 'wsl', cat: 'Prüfungsnah', title: 'Effektivwert oder Scheitelwert?', level: 1, rig: 'sinus' }, M1),
    tk({ id: 'ws2', lab: 'wsl', cat: 'Sinus', title: 'Scheitelwert der Netzspannung', level: 1, rig: 'sinus' }, M2),
    tk({ id: 'ws3', lab: 'wsl', cat: 'Sinus', title: 'Phase einstellen', level: 2, rig: 'sinus' }, M3),
    tk({ id: 'ws4', lab: 'wsl', cat: 'Prüfungsnah', title: 'Periode und Frequenz am Raster', level: 2, rig: 'sinus' }, M4),
    tk({ id: 'ws5', lab: 'wsl', cat: 'R, L, C', title: 'X_L und X_C berechnen', level: 1, rig: 'rlc' }, M5),
    tk({ id: 'ws6', lab: 'wsl', cat: 'Prüfungsnah', title: 'Spule an 230 V', level: 2, rig: 'rlc' }, M6),
    tk({ id: 'ws7', lab: 'wsl', cat: 'Prüfungsnah', title: 'Reale Spule messen', level: 2, rig: 'rlc' }, M7),
    tk({ id: 'ws8', lab: 'wsl', cat: 'Prüfungsnah', title: 'Gesamtspannung', level: 2, rig: 'rlc' }, M8),
    tk({ id: 'ws9', lab: 'wsl', cat: 'R, L, C', title: 'Eilt vor oder nach?', level: 1, rig: 'rlc' }, M9),
    tk({ id: 'ws10', lab: 'wsl', cat: 'Prüfungsnah', title: 'Blindleistung aus drei Messwerten', level: 2, rig: 'leistung' }, M10),
    tk({ id: 'ws11', lab: 'wsl', cat: 'Prüfungsnah', title: 'Blindleistung aus P und cos φ', level: 2, rig: 'leistung' }, M11),
    tk({ id: 'ws12', lab: 'wsl', cat: 'Prüfungsnah', title: 'Welche Aussage stimmt?', level: 1, rig: 'leistung' }, M12),
    tk({ id: 'ws13', lab: 'wsl', cat: 'Leistung', title: 'Strom aus Leistung und cos φ', level: 2, rig: 'leistung' }, M13),
    tk({ id: 'ws14', lab: 'wsl', cat: 'Kompensation', title: 'Kompensiere auf 0,95', level: 2, rig: 'kompens' }, M14),
    tk({ id: 'ws15', lab: 'wsl', cat: 'Kompensation', title: 'Kondensator berechnen', level: 3, rig: 'kompens' }, M15),
    tk({ id: 'ws16', lab: 'wsl', cat: 'Kompensation', title: 'Was ändert die Kompensation?', level: 2, rig: 'kompens' }, M16)
  ]);
  /* Musterwerte der Aufgaben ws1-ws16 (Schwellen aus der gerechneten Musterloesung) fuer Tests und Ausbilder */
  T.thresholds1 = () => ({ ws1: M1.vals(), ws2: M2.vals(), ws3: M3.vals(), ws4: M4.vals(), ws6: M6.vals(), ws7: M7.vals(), ws8: M8.vals(), ws10: M10.vals(), ws11: M11.vals(), ws13: M13.vals(), ws14: M14.vals(), ws15: M15.vals(), ws16: M16.vals() });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
