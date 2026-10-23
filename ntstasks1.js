/* ntstasks1.js - NTS-Lab (Netzteile und Schaltregler): Aufgaben nt1 bis nt16 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4a.
 * Quelle: quelle/ntslab/_wp4a/t1_a.js + t1_b.js, zusammengesetzt mit `node quelle/ntslab/_wp4a/build_nts.js`.
 * Registrierung: NTS_TASKS.register([ ... ]) (NTS_TASKS und NTS_TASKS.util kommen aus ntsdata.js; ntsdata.js VOR dieser Datei laden, in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'ntN', lab:'nts', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), value?, fields?, choices? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert mindestens zwei absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Regeln (SPEC Abschnitte 8, 9 und 11):
 *   - Alle Zahlen in text, hint und Pruefmeldungen stammen aus der Simulation (Pruefstaende) und NTS_CORE und stehen in hintVals() (Regel 1); text und hint werden erst beim ersten
 *     Zugriff gerechnet. NTS_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3. Rechnen nur ueber den Kern (formulas, rect, lin, zener, trafo, limits).
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert uebereinstimmt;
 *     Auswahlfragen nennen den Fachgrund der gewaehlten Antwort.
 *   - Pool-Zahlen (SPEC 12.1) stehen exakt wie in der Pool-Loesung (Toleranz 2 %, Pool-Feld toleranz); Aufgaben mit Pool-Bezug tragen die Kategorie "Prüfungsnah" (SPEC 8.3).
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (BASE), damit gleiche Eingaben gleiche Ergebnisse liefern.
 *   - Abweichungen von der SPEC: quelle/ntslab/ABWEICHUNGEN.md, Abschnitt WP4a.
 * Uebungsschaltung: Alle Bauteil- und Anlagenwerte sind Aufgabenwerte. Simulation: keine Anleitung zum Bauen oder Messen an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.NTS_TASKS) nodeReq('./ntsdata.js');
  const T = root.NTS_TASKS;
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('ntstasks1.js: ntsdata.js fehlt, die Aufgaben nt1 bis nt16 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, snap = U.snap, effOf = U.effOf, setRow = U.setRow, fullCtl = U.fullCtl;
  const CORE = () => U.CORE();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const S = (rig, over, extra) => Object.assign({ rig, controls: fullCtl(rig, over) }, extra || {});
  const lim = U.lim;
  const near = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= rel * Math.abs(b) + 1e-12;
  const opt = (value, label, reason) => ({ value, label, reason });
  const TOL = 0.02;                                   // Pool-Feld toleranz (Rechenaufgaben des Pools: 0,02)
  const FM = id => CORE().formulas.get(id);
  const fv = (id, ...args) => { const r = FM(id).run(...args); return r.ok ? r.value : NaN; };
  const MIKRO = 1e6;

  /* ====================================================================== nt1: Reihenfolge der Funktionsbloecke (Pool H2023-N03) */
  const M1 = (() => {
    const BASE = { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, rsieb: false, iLast: 0.5 }, OWN = ['c'], C1 = 2200, C2 = 4400;
    const chain = () => CORE().fault.chain.map(x => ({ id: x.id, name: x.name }));
    const ord = (c, i, j) => { const a = c.slice(); const t = a[i]; a[i] = a[j]; a[j] = t; return a; };
    const lab = c => c.map(x => x.name).join(', '), key = c => c.map(x => x.id).join(',');
    const vals = () => once('v1', () => { const a = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: C1 }))), b = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: C2 }))); return { c1: C1, c2: C2, d1: a.m.dubrumm, d2: b.m.dubrumm, n: chain().length }; });
    const O1 = () => { const c = chain(); return [
      opt(key(ord(c, 1, 2)), lab(ord(c, 1, 2)), 'Geglättet wird die pulsierende Gleichspannung, die der Gleichrichter erst erzeugt: Die Glättung steht hinter der Gleichrichtung, nicht davor.'),
      opt(key(c), lab(c), ''),
      opt(key(ord(c, 2, 3)), lab(ord(c, 2, 3)), 'Der Stabilisierung gibt man eine möglichst glatte Gleichspannung, sonst muss sie das ganze Brummen ausregeln: Die Glättung steht vor der Stabilisierung.'),
      opt(key(ord(c, 0, 1)), lab(ord(c, 0, 1)), 'Der Gleichrichter bekommt die schon heruntertransformierte Wechselspannung: Der Transformator steht am Netzanschluss, vor der Gleichrichtung.')]; };
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals(), base = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: C1 })));
      inputRow(c, r, sim, a, 'gleich');
      U.choiceRow(r, a, { key: 'q1', right: key(chain()), opts: O1(), label: 'Reihenfolge der vier Funktionsblöcke richtig gewählt' });
      r(eff.c >= C2 * 0.999 && sim.m.dubrumm < base.m.dubrumm, 'Am Prüfstand ist der Ladekondensator (Glättung) größer als ' + f(C1, 0) + ' µF und die Brummspannung ist kleiner geworden',
        'Eingestellt sind ' + f(eff.c, 0) + ' µF mit ΔU = ' + f(sim.m.dubrumm, 2) + ' V; bei ' + f(C1, 0) + ' µF waren es ' + f(base.m.dubrumm, 2) + ' V. Stelle den Ladekondensator auf mindestens ' + f(C2, 0) + ' µF.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein klassisches Linearnetzteil wird in Funktionsblöcke gegliedert. Wähle die richtige Reihenfolge vom Netzanschluss zum Verbraucher. Stelle dann im Prüfstand „Gleichrichter und Siebung“ den Ladekondensator, also den Block „Glättung“, auf mindestens ' + f(C2, 0) + ' µF (vorher ' + f(C1, 0) + ' µF) und beobachte die Brummspannung.',
      choices: () => [U.choiceDef('q1', 'Welche Reihenfolge der Funktionsblöcke vom Netzanschluss zum Verbraucher ist richtig?', O1())],
      hint: () => { const v = vals(); return [
        'Folge dem Weg der Energie: Zuerst wird die Netzspannung heruntertransformiert, dann gleichgerichtet, dann geglättet, zuletzt stabilisiert.',
        'Der Ladekondensator gehört zur Glättung. Mit ' + f(v.c1, 0) + ' µF beträgt die Brummspannung ' + f(v.d1, 2) + ' V, mit ' + f(v.c2, 0) + ' µF nur noch ' + f(v.d2, 2) + ' V.',
        'Musterlösung: Transformator, Gleichrichtung, Glättung, Stabilisierung. Den Ladekondensator am Prüfstand auf ' + f(v.c2, 0) + ' µF stellen.'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { c: C1 }), { choices: {} }),
      sol: () => S('gleich', Object.assign({}, BASE, { c: C2 }), { choices: { q1: key(chain()) } }),
      wrong: () => { const c = chain(); return [{ name: 'Glättung vor Gleichrichtung', answer: S('gleich', Object.assign({}, BASE, { c: C2 }), { choices: { q1: key(ord(c, 1, 2)) } }) },
        { name: 'Stabilisierung vor Glättung', answer: S('gleich', Object.assign({}, BASE, { c: C2 }), { choices: { q1: key(ord(c, 2, 3)) } }) }]; } };
  })();

  /* ====================================================================== nt2: Strom auf der Primaerseite (Pool F2021-N04) */
  const M2 = (() => {
    const BASE = { n1: 1150, n2: 69, ri: 0.4, gleichspannung: false, last: 'R' }, OWN = ['iLast'], I2 = 2.5;
    const vals = () => once('v2', () => { const i1 = fv('strom1', I2, BASE.n1, BASE.n2); return { n1: BASE.n1, n2: BASE.n2, i2: I2, i1, i1ma: i1 * 1000, falsch: I2 * BASE.n1 / BASE.n2, ue: BASE.n1 / BASE.n2 }; });
    const ex = () => once('ex2', () => { const v = vals(); return U.calcEx({ value: v.i1, unit: 'A', what: 'Primärstrom I1', tol: TOL, extras: [
      { v: v.falsch, msg: 'Dein Wert passt zu I2 · N1/N2. Die Ströme verhalten sich umgekehrt wie die Windungszahlen: I1 = I2 · N2/N1, der Primärstrom ist kleiner als der Sekundärstrom.' }] }); });
    const check = mk('trafo', OWN, (c, r, a) => {
      const eff = effOf(c, 'trafo', OWN, BASE), sim = snap('trafo', eff);
      inputRow(c, r, sim, a, 'trafo');
      setRow(r, 'trafo', eff, [{ key: 'iLast', want: I2 }], 'Am Prüfstand ist der Sekundärstrom auf ' + f(I2, 1) + ' A eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Primärstrom I1 des idealen Transformators berechnet (Toleranz 2 %)');
    });
    return { vals, check, consts: [],
      text: () => 'Ein idealer Transformator hat primär N1 = ' + f(BASE.n1, 0) + ' Windungen und sekundär N2 = ' + f(BASE.n2, 0) + ' Windungen. Sekundärseitig fließen ' + f(I2, 1) + ' A. Stelle den Sekundärstrom im Prüfstand „Transformator“ ein und berechne den Primärstrom (in mA).',
      ask: { label: 'Primärstrom I1', unit: 'mA' },
      hint: () => { const v = vals(); return [
        'Ein Transformator setzt die Spannung um, die Leistung bleibt gleich: Die Ströme verhalten sich umgekehrt wie die Windungszahlen. Rechne I1 = I2 · N2 / N1.',
        'Das Übersetzungsverhältnis ist N1 / N2 = ' + f(v.ue, 2) + '. Der Primärstrom ist um diesen Faktor kleiner als ' + f(v.i2, 1) + ' A; ' + f(v.falsch, 2) + ' A wäre die falsche Richtung.',
        'Musterlösung: I1 = ' + f(v.i2, 1) + ' A · ' + f(v.n2, 0) + ' / ' + f(v.n1, 0) + ' = ' + f(v.i1, 2) + ' A = ' + f(v.i1ma, 0) + ' mA.'
      ]; },
      start: () => S('trafo', Object.assign({}, BASE, { iLast: 0 }), { value: null }),
      sol: () => S('trafo', Object.assign({}, BASE, { iLast: I2 }), { value: vals().i1ma, text: f(vals().i1ma, 0) + ' mA' }),
      wrong: () => { const v = vals(); return [{ name: 'Verhältnis umgekehrt', answer: S('trafo', Object.assign({}, BASE, { iLast: I2 }), { text: f(v.falsch, 2) + ' A', value: null }) },
        { name: 'Einheit: Mikro- statt Milliampere', answer: S('trafo', Object.assign({}, BASE, { iLast: I2 }), { text: f(v.i1ma, 0) + ' µA', value: null }) }]; } };
  })();

  /* ====================================================================== nt3: Klemmenspannung berechnen */
  const M3 = (() => {
    const BASE = { n1: 1150, n2: 63, ri: 0.4, gleichspannung: false, last: 'R' }, OWN = ['iLast'], I = 3;
    const vals = () => once('v3', () => { const sim = snap('trafo', fullCtl('trafo', Object.assign({}, BASE, { iLast: I }))), leer = snap('trafo', fullCtl('trafo', Object.assign({}, BASE, { iLast: 0 }))).m.u2, uk = fv('uklemme', leer, BASE.ri, I);
      return { leer, ri: BASE.ri, i: I, uk, ur: BASE.ri * I, rig: sim.m.u2, einbruch: sim.m.einbruch }; });
    const ex = () => once('ex3', () => { const v = vals(); return U.calcEx({ value: v.uk, unit: 'V', what: 'Klemmenspannung', extras: [
      { v: v.leer, msg: 'Dein Wert ist die Leerlaufspannung: Der Spannungsabfall am Innenwiderstand (I · R_i) fehlt.' },
      { v: v.ur, msg: 'Dein Wert ist nur der Spannungsabfall I · R_i am Innenwiderstand; die Klemmenspannung ist Leerlaufspannung minus dieser Abfall.' }] }); });
    const check = mk('trafo', OWN, (c, r, a) => {
      const eff = effOf(c, 'trafo', OWN, BASE), sim = snap('trafo', eff), v = vals();
      inputRow(c, r, sim, a, 'trafo');
      setRow(r, 'trafo', eff, [{ key: 'iLast', want: I }], 'Am Prüfstand ist der Laststrom auf ' + f(I, 0) + ' A eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Klemmenspannung unter Last berechnet (Toleranz 3 %)');
      r(near(sim.m.u2, v.uk, 0.01), 'Das Messgerät am Prüfstand zeigt dieselbe Klemmenspannung', 'Das Messgerät zeigt ' + f(sim.m.u2, 2) + ' V bei ' + f(eff.iLast, 2) + ' A, die berechnete Klemmenspannung ist ' + f(v.uk, 2) + ' V.');
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Ein Transformator liefert im Leerlauf ' + f(v.leer, 1) + ' V und hat den Innenwiderstand R_i = ' + f(v.ri, 1) + ' Ω. Er wird mit ' + f(v.i, 0) + ' A belastet. Stelle den Laststrom im Prüfstand „Transformator“ ein und berechne die Klemmenspannung.'; },
      ask: { label: 'Klemmenspannung', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Der Innenwiderstand lässt unter Last Spannung abfallen. Die Klemmenspannung ist die Leerlaufspannung minus I · R_i.',
        'Am Innenwiderstand fallen ' + f(v.i, 0) + ' A · ' + f(v.ri, 1) + ' Ω = ' + f(v.ur, 1) + ' V ab. Die Leerlaufspannung ' + f(v.leer, 1) + ' V wäre der Wert ohne diesen Abfall.',
        'Musterlösung: U_klemme = ' + f(v.leer, 1) + ' V − ' + f(v.ur, 1) + ' V = ' + f(v.uk, 1) + ' V (Einbruch ' + f(v.einbruch, 1) + ' %).'
      ]; },
      start: () => S('trafo', Object.assign({}, BASE, { iLast: 0 }), { value: null }),
      sol: () => S('trafo', Object.assign({}, BASE, { iLast: I }), { value: vals().uk }),
      wrong: () => { const v = vals(); return [{ name: 'Innenwiderstand vergessen', answer: S('trafo', Object.assign({}, BASE, { iLast: I }), { value: v.leer }) },
        { name: 'nur den Spannungsabfall angegeben', answer: S('trafo', Object.assign({}, BASE, { iLast: I }), { value: v.ur }) }]; } };
  })();

  /* ====================================================================== nt4: Wie viele Impulse? (Pool H2024-09) */
  const M4 = (() => {
    const BASE = { u2: 12, diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 0.5 }, OWN = ['topo'];
    const vals = () => once('v4', () => { const br = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { topo: 'bruecke' }))), ew = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { topo: 'einweg' })))
      ; return { fpb: br.m.fp, fpe: ew.m.fp, netz: lim('f_netz'), db: br.m.dubrumm, de: ew.m.dubrumm }; });
    const O1 = () => [
      opt('25', '25 Hz', 'Die Brummfrequenz ist nie kleiner als die Netzfrequenz: Beim Einweggleichrichter ist sie gleich der Netzfrequenz, in der Brücke doppelt so groß.'),
      opt('50', '50 Hz', 'Das ist die Netzfrequenz und zugleich die Pulsfrequenz des Einweggleichrichters. Die Brücke richtet beide Halbwellen gleich und lädt den Kondensator zweimal je Periode.'),
      opt('100', '100 Hz', ''),
      opt('150', '150 Hz', 'Dreimal die Netzfrequenz kommt nur bei einem Drehstrom-Gleichrichter vor; die Brücke an Wechselspannung liefert zwei Impulse je Periode.'),
      opt('200', '200 Hz', 'Das wären vier Impulse je Periode. Die Brücke richtet nur zwei Halbwellen je Periode gleich, also zwei Impulse.')];
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals();
      inputRow(c, r, sim, a, 'gleich');
      U.choiceRow(r, a, { key: 'q1', right: '100', opts: O1(), label: 'Brummfrequenz der Brücke am 50-Hz-Netz richtig gewählt' });
      r(eff.topo === 'bruecke' && near(sim.m.fp, 2 * v.netz, 1e-9), 'Am Prüfstand ist die Brücke eingestellt und das Messgerät zeigt die Pulsfrequenz ' + f(v.fpb, 0) + ' Hz',
        'Eingestellt ist „' + U.olabel('gleich', 'topo', eff.topo) + '“, das Messgerät zeigt ' + f(sim.m.fp, 0) + ' Hz. Wähle die Brücke.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Brückengleichrichter (B2) wird an einer Wechselspannung mit ' + f(lim('f_netz'), 0) + ' Hz betrieben und lädt einen Ladekondensator. Stelle im Prüfstand „Gleichrichter und Siebung“ die Brücke ein, lies die Pulsfrequenz am Messgerät ab und wähle dann die Frequenz, mit der die Brummspannung am Kondensator schwankt.',
      choices: () => [U.choiceDef('q1', 'Mit welcher Frequenz schwankt die Brummspannung am Kondensator?', O1())],
      hint: () => { const v = vals(); return [
        'Zähle die Ladeimpulse je Netzperiode: Die Brücke richtet beide Halbwellen gleich, der Einweggleichrichter nur eine.',
        'Der Einweggleichrichter lädt ' + f(v.fpe, 0) + ' Mal je Sekunde nach, die Brücke ' + f(v.fpb, 0) + ' Mal. Die Pulsfrequenz, die dein Prüfstand für die Brücke anzeigt, ist auch die Frequenz der Brummspannung.',
        'Musterlösung: Brücke einstellen; die Pulsfrequenz beträgt ' + f(v.fpb, 0) + ' Hz, also schwankt auch die Brummspannung mit ' + f(v.fpb, 0) + ' Hz.'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { topo: 'einweg' }), { choices: {} }),
      sol: () => S('gleich', Object.assign({}, BASE, { topo: 'bruecke' }), { choices: { q1: '100' } }),
      wrong: () => [{ name: 'Netzfrequenz 50 Hz', answer: S('gleich', Object.assign({}, BASE, { topo: 'bruecke' }), { choices: { q1: '50' } }) },
        { name: 'vier Impulse: 200 Hz', answer: S('gleich', Object.assign({}, BASE, { topo: 'bruecke' }), { choices: { q1: '200' } }) }] };
  })();

  /* ====================================================================== nt5: Spitzenspannung der Bruecke (Pool F2020-N25) */
  const M5 = (() => {
    const BASE = { topo: 'bruecke', diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 0 }, OWN = ['u2'], U2 = 12;
    const vals = () => once('v5', () => { const uf = lim('uf_si'), v = fv('scheitel', U2, 2, uf); return { u2: U2, uf, peak: v, ohne: U2 * Math.SQRT2, eine: U2 * Math.SQRT2 - uf, eff: U2 - 2 * uf }; });
    const ex = () => once('ex5', () => { const v = vals(); return U.calcEx({ value: v.peak, unit: 'V', what: 'Spitzenspannung Û', tol: TOL, extras: [
      { v: v.ohne, msg: 'Dein Wert passt zu U · √2 ohne Dioden. In der Brücke liegen zwei Dioden im Strompfad: Û = U · √2 − 2 · U_F.' },
      { v: v.eine, msg: 'Dein Wert passt zu U · √2 − U_F, also nur einer Diode. In der Brücke liegen zwei Dioden im Strompfad (2 · U_F).' },
      { v: v.eff, msg: 'Dein Wert passt zu U − 2 · U_F: Der Effektivwert wurde nicht in den Scheitelwert umgerechnet (· √2).' }] }); });
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals();
      inputRow(c, r, sim, a, 'gleich');
      setRow(r, 'gleich', eff, [{ key: 'u2', want: U2 }], 'Am Prüfstand ist die Sekundärspannung auf ' + f(U2, 0) + ' V eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Spitzenspannung Û am Ladekondensator berechnet (Toleranz 2 %)');
      r(near(sim.m.uhat, v.peak, 0.005), 'Das Messgerät Scheitelwert zeigt die berechnete Spitzenspannung', 'Das Messgerät zeigt ' + f(sim.m.uhat, 2) + ' V bei U2 = ' + f(eff.u2, 1) + ' V, berechnet sind ' + f(v.peak, 2) + ' V.');
    });
    return { vals, check, consts: [],
      text: () => 'Eine Brückenschaltung (B2) mit Ladekondensator wird aus einem Transformator mit der Sekundärspannung ' + f(U2, 0) + ' V (Effektivwert) gespeist. Je Diode beträgt die Durchlassspannung ' + f(lim('uf_si'), 1) + ' V. Stelle die Sekundärspannung im Prüfstand „Gleichrichter und Siebung“ ein und berechne die Spitzenspannung am Ladekondensator bei vernachlässigbarer Last.',
      ask: { label: 'Spitzenspannung Û', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Der Scheitelwert einer Sinusspannung ist der Effektivwert mal √2. Vom Scheitelwert gehen die Durchlassspannungen der Dioden im Strompfad ab; in der Brücke sind das zwei.',
        'U · √2 = ' + f(v.ohne, 2) + ' V ohne Dioden. Mit nur einer Diode wären es ' + f(v.eine, 2) + ' V, in der Brücke zwei Dioden: Û = ' + f(v.ohne, 2) + ' V − 2 · ' + f(v.uf, 1) + ' V.',
        'Musterlösung: Û = ' + f(v.u2, 0) + ' V · √2 − 2 · ' + f(v.uf, 1) + ' V = ' + f(v.peak, 2) + ' V.'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { u2: 24 }), { value: null }),
      sol: () => S('gleich', Object.assign({}, BASE, { u2: U2 }), { value: vals().peak }),
      wrong: () => { const v = vals(); return [{ name: 'ohne Dioden gerechnet', answer: S('gleich', Object.assign({}, BASE, { u2: U2 }), { value: v.ohne }) },
        { name: 'Effektivwert statt Scheitelwert', answer: S('gleich', Object.assign({}, BASE, { u2: U2 }), { value: v.eff }) }]; } };
  })();

  /* ====================================================================== nt6: Brummspannung berechnen */
  const M6 = (() => {
    const BASE = { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, rsieb: false }, OWN = ['c', 'iLast'], CU = 2200, I = 0.5;
    const vals = () => once('v6', () => { const sim = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: CU, iLast: I }))), fp = sim.m.fp, du = fv('brumm', I, fp, CU / MIKRO);
      return { c: CU, cf: CU / MIKRO, i: I, fp, du, du50: fv('brumm', I, lim('f_netz'), CU / MIKRO), dumf: fv('brumm', I, fp, CU / 1000), peak: sim.m.uhat }; });
    const ex = () => once('ex6', () => { const v = vals(); return U.calcEx({ value: v.du, unit: 'V', what: 'Brummspannung ΔU', extras: [
      { v: v.du50, msg: 'Dein Wert passt zur Pulsfrequenz 50 Hz (Netzfrequenz). Die Brücke lädt zweimal je Periode nach: f_p = 100 Hz.' },
      { v: v.dumf, msg: 'Dein Wert passt zu C in mF statt in µF: 2200 µF sind 2,2 mF, nicht 2200 mF.' }] }); });
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals();
      inputRow(c, r, sim, a, 'gleich');
      setRow(r, 'gleich', eff, [{ key: 'c', want: CU }, { key: 'iLast', want: I }], 'Am Prüfstand sind ' + f(CU, 0) + ' µF und ' + f(I, 1) + ' A eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Brummspannung ΔU berechnet (Toleranz 3 %)');
      r(near(sim.m.dubrumm, v.du, 0.01), 'Das Messgerät Brummspannung zeigt denselben Wert', 'Das Messgerät zeigt ' + f(sim.m.dubrumm, 2) + ' V, berechnet sind ' + f(v.du, 2) + ' V.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Brückengleichrichter an ' + f(lim('f_netz'), 0) + ' Hz Netzfrequenz lädt einen Ladekondensator mit C = ' + f(CU, 0) + ' µF und versorgt eine Last mit ' + f(I, 1) + ' A. Stelle Kondensator und Laststrom im Prüfstand „Gleichrichter und Siebung“ ein und berechne die Brummspannung ΔU (Spitze-Spitze).',
      ask: { label: 'Brummspannung ΔU', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Die Brummspannung folgt aus der Entladung des Kondensators zwischen zwei Ladeimpulsen: ΔU = I / (f_p · C). Entscheidend ist die Pulsfrequenz f_p der Brücke, nicht die Netzfrequenz.',
        'Die Brücke hat f_p = ' + f(v.fp, 0) + ' Hz. Mit der Netzfrequenz ' + f(lim('f_netz'), 0) + ' Hz kämen ' + f(v.du50, 2) + ' V heraus (falsch); C = ' + f(v.c, 0) + ' µF sind ' + f(v.cf, 4) + ' F.',
        'Musterlösung: ΔU = ' + f(v.i, 1) + ' A / (' + f(v.fp, 0) + ' Hz · ' + f(v.cf, 4) + ' F) = ' + f(v.du, 2) + ' V.'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { c: 1000, iLast: 1 }), { value: null }),
      sol: () => S('gleich', Object.assign({}, BASE, { c: CU, iLast: I }), { value: vals().du }),
      wrong: () => { const v = vals(); return [{ name: 'Pulsfrequenz 50 Hz statt 100 Hz', answer: S('gleich', Object.assign({}, BASE, { c: CU, iLast: I }), { value: v.du50 }) },
        { name: 'mF statt µF', answer: S('gleich', Object.assign({}, BASE, { c: CU, iLast: I }), { value: v.dumf }) }]; } };
  })();

  /* ====================================================================== nt7: Brummspannung unter 1 V bringen */
  const M7 = (() => {
    const BASE = { u2: 12, topo: 'bruecke', diode: 'si', rs: 0, rsieb: false, iLast: 0.5 }, OWN = ['c'], DU = 1, RES = 1.25;
    const vals = () => once('v7', () => { const cmin = CORE().rect.cmin({ topo: BASE.topo, f: lim('f_netz'), I: BASE.iLast, dU: DU }), cmax = RES * cmin;
      const sol = Math.round(cmin * 1.2 / 100) * 100, a = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: sol }))), k = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: 470 }))), g = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { c: 10000 })));
      return { du: DU, i: BASE.iLast, cmin, cmax, sol, dsol: a.m.dubrumm, dklein: k.m.dubrumm, dgross: g.m.dubrumm, res: (RES - 1) * 100, fp: a.m.fp }; });
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals();
      inputRow(c, r, sim, a, 'gleich');
      r(sim.m.dubrumm <= v.du + 1e-9, 'Die Brummspannung am Prüfstand liegt bei höchstens ' + f(v.du, 0) + ' V', 'Bei ' + f(eff.c, 0) + ' µF zeigt das Messgerät ΔU = ' + f(sim.m.dubrumm, 2) + ' V, verlangt sind höchstens ' + f(v.du, 0) + ' V. Der Ladekondensator ist zu klein.');
      r(eff.c <= v.cmax + 1e-9, 'Der Ladekondensator passt in den Bauraum (höchstens ' + f(v.cmax, 0) + ' µF)', 'Eingestellt sind ' + f(eff.c, 0) + ' µF, der Bauraum erlaubt höchstens ' + f(v.cmax, 0) + ' µF. Der Ladekondensator ist zu groß; der rechnerische Mindestwert ist ' + f(v.cmin, 0) + ' µF.');
    });
    return { vals, check, consts: [470, 10000],
      text: () => { const v = vals(); return 'Ein Brückengleichrichter versorgt eine Last mit ' + f(v.i, 1) + ' A. Die Brummspannung am Ladekondensator darf höchstens ' + f(v.du, 0) + ' V betragen. Auf der Platine ist Platz für einen Ladekondensator, der höchstens ' + f(v.res, 0) + ' % größer ist als der rechnerische Mindestwert (also höchstens ' + f(v.cmax, 0) + ' µF). Stelle den Ladekondensator im Prüfstand „Gleichrichter und Siebung“ passend ein.'; },
      hint: () => { const v = vals(); return [
        'Stelle die Brummformel nach C um: C = I / (f_p · ΔU). Die Pulsfrequenz der Brücke ist doppelt so groß wie die Netzfrequenz. Größer als nötig darf der Kondensator nur im Rahmen des Bauraums sein.',
        'Mit ' + f(v.i, 1) + ' A, ' + f(v.fp, 0) + ' Hz und ' + f(v.du, 0) + ' V folgt der Mindestwert ' + f(v.cmin, 0) + ' µF; der Bauraum erlaubt höchstens ' + f(v.cmax, 0) + ' µF. Bei 470 µF ist ΔU = ' + f(v.dklein, 2) + ' V, bei 10000 µF passt er nicht mehr in den Bauraum.',
        'Musterlösung: ein Ladekondensator zwischen ' + f(v.cmin, 0) + ' µF und ' + f(v.cmax, 0) + ' µF, zum Beispiel ' + f(v.sol, 0) + ' µF (ΔU = ' + f(v.dsol, 2) + ' V).'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { c: 2200 })),
      sol: () => S('gleich', Object.assign({}, BASE, { c: vals().sol })),
      wrong: () => [{ name: 'Kondensator zu klein (470 µF)', answer: S('gleich', Object.assign({}, BASE, { c: 470 })) }, { name: 'Kondensator zu groß (10000 µF)', answer: S('gleich', Object.assign({}, BASE, { c: 10000 })) }] };
  })();

  /* ====================================================================== nt8: Einschaltstrom begrenzen (Pool F2024-N07) */
  const M8 = (() => {
    const BASE = { u2: 12, topo: 'bruecke', diode: 'si', c: 2200, rsieb: false, iLast: 0.5 }, OWN = ['rs'], IMAX = 2;
    const vals = () => once('v8', () => { const k = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { rs: 0 }))), peak = k.m.uhat, ri = lim('ri_trafo'), umin = k.m.umin, regmin = lim('umin_7805'),
      rsmin = peak / IMAX - ri, rsmax = (umin - regmin) / BASE.iLast, sol = Math.round((rsmin + rsmax) / 2), s = snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { rs: sol })));
      return { imax: IMAX, peak, ri, i0: k.m.imax, umin, regmin, rsmin, rsmax, sol, isol: s.m.imax, umsol: umin - BASE.iLast * sol, il: BASE.iLast, i20: snap('gleich', fullCtl('gleich', Object.assign({}, BASE, { rs: 20 }))).m.imax, u20: umin - BASE.iLast * 20 }; });
    const check = mk('gleich', OWN, (c, r, a) => {
      const eff = effOf(c, 'gleich', OWN, BASE), sim = snap('gleich', eff), v = vals(), um = sim.m.umin - eff.iLast * eff.rs;
      inputRow(c, r, sim, a, 'gleich');
      r(sim.m.imax <= v.imax + 1e-9, 'Der Einschaltstrom am Prüfstand liegt bei höchstens ' + f(v.imax, 0) + ' A', 'Das Messgerät zeigt bei R_s = ' + f(eff.rs, 1) + ' Ω einen Einschaltstrom von ' + f(sim.m.imax, 2) + ' A, verlangt sind höchstens ' + f(v.imax, 0) + ' A. Der Vorwiderstand ist zu klein.');
      r(um >= v.regmin - 1e-9, 'Die kleinste Reglereingangsspannung U_min − I · R_s bleibt über ' + f(v.regmin, 0) + ' V', 'Mit R_s = ' + f(eff.rs, 1) + ' Ω ist U_min − I · R_s = ' + f(sim.m.umin, 2) + ' V − ' + f(eff.iLast, 1) + ' A · ' + f(eff.rs, 1) + ' Ω = ' + f(um, 2) + ' V, der Regler braucht mindestens ' + f(v.regmin, 0) + ' V (Übungswert). Der Vorwiderstand ist zu groß.');
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Ein Netzteil mit Brückengleichrichter und Ladekondensator (' + f(BASE.c, 0) + ' µF) versorgt eine Last mit ' + f(v.il, 1) + ' A. Im Einschaltmoment wirkt der leere Kondensator wie ein Kurzschluss. Ein Vorwiderstand R_s in Reihe soll den Einschaltstrom auf höchstens ' + f(v.imax, 0) + ' A begrenzen. Er darf aber nicht so groß sein, dass die kleinste Eingangsspannung des nachfolgenden Reglers (U_min − I · R_s) unter ' + f(v.regmin, 0) + ' V fällt (Übungswert). Stelle R_s im Prüfstand „Gleichrichter und Siebung“ ein.'; },
      hint: () => { const v = vals(); return [
        'Im Einschaltmoment begrenzen nur der Innenwiderstand und der Vorwiderstand den Strom: I = Û / (R_i + R_s). Im Betrieb fließt der Laststrom durch R_s und kostet Spannung: U = I · R_s.',
        'Û = ' + f(v.peak, 2) + ' V und R_i = ' + f(v.ri, 1) + ' Ω ergeben ohne Vorwiderstand ' + f(v.i0, 1) + ' A. Für höchstens ' + f(v.imax, 0) + ' A braucht R_s mindestens ' + f(v.rsmin, 1) + ' Ω; für ' + f(v.regmin, 0) + ' V am Reglereingang darf es höchstens ' + f(v.rsmax, 1) + ' Ω sein.',
        'Musterlösung: R_s zwischen ' + f(v.rsmin, 1) + ' Ω und ' + f(v.rsmax, 1) + ' Ω, zum Beispiel ' + f(v.sol, 0) + ' Ω (Einschaltstrom ' + f(v.isol, 2) + ' A, U_min − I · R_s = ' + f(v.umsol, 2) + ' V).'
      ]; },
      start: () => S('gleich', Object.assign({}, BASE, { rs: 0 })),
      sol: () => S('gleich', Object.assign({}, BASE, { rs: vals().sol })),
      wrong: () => [{ name: 'ohne Vorwiderstand', answer: S('gleich', Object.assign({}, BASE, { rs: 0 })) }, { name: 'Vorwiderstand zu groß (20 Ω)', answer: S('gleich', Object.assign({}, BASE, { rs: 20 })) }] };
  })();

  /* ====================================================================== nt9: Z-Diode, Strom berechnen (Pool S2025-30) */
  const M9 = (() => {
    const BASE = { art: 'zener' }, OWN = ['ue', 'uz', 'rv', 'rlast'], UE = 12, UZ = 5.1, RV = 470, RL = 4700;
    const vals = () => once('v9', () => { const z = CORE().zener.stage({ Ue: UE, Uz: UZ, Rv: RV, Rlast: RL }); return { ue: UE, uz: UZ, rv: RV, rl: RL, iges: z.Iges * 1000, il: z.Ilast * 1000, iz: z.Iz * 1000, izA: z.Iz, igesA: z.Iges, ilA: z.Ilast, aktiv: z.aktiv }; });
    const ex = () => once('ex9', () => { const v = vals(); return U.calcEx({ value: v.izA, unit: 'A', what: 'Z-Strom I_Z', tol: TOL, extras: [
      { v: v.igesA, msg: 'Dein Wert ist der Gesamtstrom (U_ein − U_Z) / R_V. Der Laststrom U_Z / R_L fließt am Z-Zweig vorbei und muss abgezogen werden.' },
      { v: v.ilA, msg: 'Dein Wert ist nur der Laststrom U_Z / R_L. Der Z-Strom ist der Gesamtstrom minus Laststrom.' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      setRow(r, 'stabil', eff, [{ key: 'ue', want: UE }, { key: 'uz', want: UZ }, { key: 'rv', want: RV }, { key: 'rlast', want: RL }], 'Am Prüfstand ist die Z-Diodenstufe mit ' + f(UE, 0) + ' V, ' + f(UZ, 1) + ' V, ' + f(RV, 0) + ' Ω und ' + f(RL, 0) + ' Ω aufgebaut');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Strom durch die Z-Diode berechnet (Toleranz 2 %)');
      r(near(sim.m.iz, v.iz, 0.01), 'Das Messgerät Z-Strom zeigt denselben Wert', 'Das Messgerät zeigt ' + f(sim.m.iz, 2) + ' mA, berechnet sind ' + f(v.iz, 2) + ' mA.');
    });
    return { vals, check, consts: [],
      text: () => 'Eine Z-Diode (U_Z = ' + f(UZ, 1) + ' V) wird aus ' + f(UE, 0) + ' V über einen Vorwiderstand von ' + f(RV, 0) + ' Ω gespeist. Parallel zur Z-Diode liegt ein Lastwiderstand von ' + f(RL, 0) + ' Ω. Baue die Stufe im Prüfstand „Z-Diode und Linearregler“ (Z-Diode) auf und berechne den Strom durch die Z-Diode in mA.',
      ask: { label: 'Strom durch die Z-Diode', unit: 'mA' },
      hint: () => { const v = vals(); return [
        'Der Vorwiderstand führt den Gesamtstrom, er teilt sich in den Laststrom und den Z-Strom. Berechne erst den Gesamtstrom aus dem Spannungsabfall am Vorwiderstand, dann den Laststrom, und ziehe ihn ab.',
        'Gesamtstrom (U_ein − U_Z) / R_V = ' + f(v.iges, 2) + ' mA, Laststrom U_Z / R_L = ' + f(v.il, 2) + ' mA. Der Gesamtstrom allein wäre der falsche Wert.',
        'Musterlösung: I_Z = ' + f(v.iges, 2) + ' mA − ' + f(v.il, 2) + ' mA = ' + f(v.iz, 2) + ' mA.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { ue: 24, uz: 12, rv: 100, rlast: 1000 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { ue: UE, uz: UZ, rv: RV, rlast: RL }), { value: vals().iz }),
      wrong: () => { const v = vals(); return [{ name: 'Laststrom vergessen', answer: S('stabil', Object.assign({}, BASE, { ue: UE, uz: UZ, rv: RV, rlast: RL }), { value: v.iges }) },
        { name: 'nur den Laststrom angegeben', answer: S('stabil', Object.assign({}, BASE, { ue: UE, uz: UZ, rv: RV, rlast: RL }), { value: v.il }) }]; } };
  })();

  /* ====================================================================== nt10: Z-Diode, Vorwiderstand (Pool F2020-N22) */
  const M10 = (() => {
    const BASE = { art: 'zener', ue: 24, uz: 12, rlast: 47000 }, OWN = ['rv'], PMAX = 0.6;
    const vals = () => once('v10', () => { const rmin = fv('rvMin', BASE.ue, BASE.uz, PMAX), izmax = PMAX / BASE.uz, s = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { rv: rmin }))), k = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { rv: 100 })));
      return { ue: BASE.ue, uz: BASE.uz, pmax: PMAX, izmax: izmax * 1000, izmaxA: izmax, rmin, diff: BASE.ue - BASE.uz, falsch: BASE.ue / izmax, izfalsch: PMAX * BASE.uz, rfalsch: BASE.uz / (PMAX * BASE.uz), psol: s.m.uaus * s.m.iz / 1000, pklein: k.m.uaus * k.m.iz / 1000, sol: Math.ceil(rmin / 10) * 10 }; });
    const ex = () => once('ex10', () => { const v = vals(); return U.calcEx({ value: v.rmin, unit: 'Ω', what: 'kleinster Vorwiderstand R_V,min', tol: TOL, extras: [
      { v: v.falsch, msg: 'Dein Wert passt zu U_ein / I_Z,max: Es fehlt der Abzug von U_Z. Am Vorwiderstand fällt nur die Differenz U_ein − U_Z ab.' },
      { v: v.rfalsch, msg: 'Dein Wert passt zu einem Z-Strom P · U_Z. Der größte Z-Strom ist P / U_Z.' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals(), pz = sim.m.uaus * sim.m.iz / 1000;
      inputRow(c, r, sim, a, 'stabil');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Kleinsten zulässigen Vorwiderstand berechnet (Toleranz 2 %)');
      r(pz <= v.pmax * (1 + TOL), 'Am Prüfstand nimmt die Z-Diode im Leerlauf höchstens ' + f(v.pmax, 1) + ' W auf', 'Mit R_V = ' + f(eff.rv, 0) + ' Ω fließen im Leerlauf ' + f(sim.m.iz, 1) + ' mA, die Z-Diode nimmt P_Z = ' + f(pz, 2) + ' W auf, erlaubt sind ' + f(v.pmax, 1) + ' W. Der Vorwiderstand ist zu klein.');
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Eine Z-Diode mit U_Z = ' + f(v.uz, 0) + ' V darf maximal ' + f(v.pmax, 1) + ' W Verlustleistung aufnehmen. Sie wird über einen Vorwiderstand an einer Spannung betrieben, die bis zu ' + f(v.ue, 0) + ' V ansteigen kann. Im Leerlauf (ohne Last) fließt der gesamte Strom durch die Z-Diode. Berechne den kleinsten zulässigen Vorwiderstand und stelle ihn im Prüfstand „Z-Diode und Linearregler“ ein (Eingang ' + f(v.ue, 0) + ' V, Last nahezu offen).'; },
      ask: { label: 'Kleinster Vorwiderstand R_V,min', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Im Leerlauf trägt die Z-Diode den ganzen Strom. Aus der zulässigen Verlustleistung folgt der größte Z-Strom: I_Z,max = P / U_Z. Am Vorwiderstand fällt die Differenz U_ein − U_Z ab.',
        'I_Z,max = ' + f(v.pmax, 1) + ' W / ' + f(v.uz, 0) + ' V = ' + f(v.izmax, 0) + ' mA; die Spannungsdifferenz ist ' + f(v.diff, 0) + ' V. Wer ' + f(v.ue, 0) + ' V ohne Abzug nimmt, erhält ' + f(v.falsch, 0) + ' Ω.',
        'Musterlösung: R_V,min = ' + f(v.diff, 0) + ' V / ' + f(v.izmax, 0) + ' mA = ' + f(v.rmin, 0) + ' Ω; am Prüfstand R_V ≥ ' + f(v.rmin, 0) + ' Ω einstellen.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { rv: 470 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { rv: vals().sol }), { value: vals().rmin }),
      wrong: () => { const v = vals(); return [{ name: 'U_ein statt Differenz', answer: S('stabil', Object.assign({}, BASE, { rv: v.falsch }), { value: v.falsch }) },
        { name: 'Z-Strom als P · U_Z, Widerstand zu klein', answer: S('stabil', Object.assign({}, BASE, { rv: 100 }), { value: v.rfalsch }) }]; } };
  })();

  /* ====================================================================== nt11: Z-Diode regelt nicht mehr */
  const M11 = (() => {
    const BASE = { art: 'zener', ue: 12, uz: 5.1, rlast: 250 }, OWN = ['rv'];
    const zs = rv => CORE().zener.stage({ Ue: BASE.ue, Uz: BASE.uz, Rv: rv, Rlast: BASE.rlast });
    const grenze = (ziel, aufsteigend) => { let lo = 1, hi = 5000; for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2, iz = zs(mid).IzRoh; if ((iz >= ziel) === aufsteigend) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const vals = () => once('v11', () => { const izmin = lim('iz_min'), pmax = lim('pz_max'), rmax = grenze(izmin, true), rmin = grenze(pmax / BASE.uz, true), sol = Math.round((rmax + rmin) / 2 / 10) * 10, zsol = zs(sol), z0 = zs(470);
      return { ue: BASE.ue, uz: BASE.uz, rl: BASE.rlast, izmin: izmin * 1000, pmax, rmax, rmin, sol, izsol: zsol.Iz * 1000, il: zsol.Ilast * 1000, iz470: z0.IzRoh * 1000, ua470: z0.Uaus }; });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals(), pz = sim.m.uaus * sim.m.iz / 1000;
      inputRow(c, r, sim, a, 'stabil');
      r(sim.m.iz >= v.izmin - 1e-9, 'Die Z-Diode regelt wieder: Ihr Strom liegt über dem Mindeststrom ' + f(v.izmin, 0) + ' mA', 'Mit R_V = ' + f(eff.rv, 0) + ' Ω fließen durch die Z-Diode ' + f(sim.m.iz, 1) + ' mA, nötig sind mindestens ' + f(v.izmin, 0) + ' mA; die Ausgangsspannung liegt bei ' + f(sim.m.uaus, 2) + ' V statt ' + f(v.uz, 1) + ' V. Der Vorwiderstand ist zu groß.');
      r(pz <= v.pmax + 1e-9, 'Die Z-Diode wird nicht überlastet: P_Z liegt bei höchstens ' + f(v.pmax, 1) + ' W', 'Mit R_V = ' + f(eff.rv, 0) + ' Ω nimmt die Z-Diode P_Z = ' + f(pz, 2) + ' W auf, der Übungswert für P_max ist ' + f(v.pmax, 1) + ' W (Datenblatt maßgeblich). Der Vorwiderstand ist zu klein.');
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Eine Z-Diode (U_Z = ' + f(v.uz, 1) + ' V) wird aus ' + f(v.ue, 0) + ' V über einen Vorwiderstand gespeist; die Last hat ' + f(v.rl, 0) + ' Ω. Beim eingestellten Vorwiderstand bricht die Ausgangsspannung ein: Die Z-Diode regelt nicht mehr. Ändere nur den Vorwiderstand im Prüfstand „Z-Diode und Linearregler“ so, dass die Z-Diode wieder regelt (Strom über dem Mindeststrom) und nicht überlastet wird.'; },
      hint: () => { const v = vals(); return [
        'Die Last zieht ihren Strom über den Vorwiderstand. Bleibt für die Z-Diode weniger als der Mindeststrom übrig, sperrt sie. Ein kleinerer Vorwiderstand liefert mehr Strom, darf aber die Z-Diode nicht überlasten.',
        'Mit ' + f(v.rl, 0) + ' Ω Last braucht der Vorwiderstand höchstens ' + f(v.rmax, 0) + ' Ω, damit mindestens ' + f(v.izmin, 0) + ' mA durch die Z-Diode fließen, und mindestens ' + f(v.rmin, 0) + ' Ω, damit P_Z unter ' + f(v.pmax, 1) + ' W bleibt. Beim eingestellten Startwert ergibt die Rechnung nur ' + f(v.iz470, 1) + ' mA, also keinen Z-Strom.',
        'Musterlösung: R_V zwischen ' + f(v.rmin, 0) + ' Ω und ' + f(v.rmax, 0) + ' Ω, zum Beispiel ' + f(v.sol, 0) + ' Ω (I_Z = ' + f(v.izsol, 1) + ' mA).'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { rv: 470 })),
      sol: () => S('stabil', Object.assign({}, BASE, { rv: vals().sol })),
      wrong: () => [{ name: 'Vorwiderstand noch größer (1000 Ω)', answer: S('stabil', Object.assign({}, BASE, { rv: 1000 })) }, { name: 'Vorwiderstand viel zu klein (22 Ω)', answer: S('stabil', Object.assign({}, BASE, { rv: 22 })) }] };
  })();

  /* ====================================================================== nt12: Verlustleistung des Linearreglers (Pool H2026-20) */
  const M12 = (() => {
    const BASE = { art: '7805' }, OWN = ['ue', 'iLast'], UE = 14, UA = 5, I = 0.6;
    const vals = () => once('v12', () => { const pv = fv('pvLin', UE, UA, I); return { ue: UE, ua: UA, i: I, pv, pab: UA * I, pzu: UE * I, diff: UE - UA }; });
    const ex = () => once('ex12', () => { const v = vals(); return U.calcEx({ value: v.pv, unit: 'W', what: 'Verlustleistung P_V', tol: TOL, extras: [
      { v: v.pab, msg: 'Dein Wert ist die Ausgangsleistung U_aus · I, also die Nutzleistung. Verloren geht die Differenzspannung mal Strom.' },
      { v: v.pzu, msg: 'Dein Wert ist die aufgenommene Leistung U_ein · I. Die Verlustleistung ist nur der Teil mit der Differenzspannung (U_ein − U_aus) · I.' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      setRow(r, 'stabil', eff, [{ key: 'ue', want: UE }, { key: 'iLast', want: I }], 'Am Prüfstand sind ' + f(UE, 0) + ' V Eingangsspannung und ' + f(I, 1) + ' A Laststrom eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Verlustleistung des Linearreglers berechnet (Toleranz 2 %)');
      r(near(sim.m.pv, v.pv, 0.01), 'Das Messgerät Verlustleistung zeigt denselben Wert', 'Das Messgerät zeigt ' + f(sim.m.pv, 2) + ' W, berechnet sind ' + f(v.pv, 2) + ' W.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Festspannungsregler 7805 wird mit ' + f(UE, 0) + ' V Eingangsspannung betrieben und liefert ' + f(UA, 0) + ' V bei einem Laststrom von ' + f(I, 1) + ' A. Der Ruhestrom des Reglers wird vernachlässigt. Stelle Eingangsspannung und Laststrom im Prüfstand „Z-Diode und Linearregler“ ein und berechne die Verlustleistung des Reglers (in W).',
      ask: { label: 'Verlustleistung P_V', unit: 'W' },
      hint: () => { const v = vals(); return [
        'Der Linearregler wirkt wie ein veränderlicher Vorwiderstand: Die Differenz zwischen Eingangs- und Ausgangsspannung fällt an ihm ab und wird mit dem Laststrom zu Wärme.',
        'Die Differenzspannung ist ' + f(v.ue, 0) + ' V − ' + f(v.ua, 0) + ' V = ' + f(v.diff, 0) + ' V. Die Nutzleistung ' + f(v.pab, 1) + ' W ist nicht der Verlust, ' + f(v.pzu, 1) + ' W ist die Eingangsleistung.',
        'Musterlösung: P_V = (' + f(v.ue, 0) + ' V − ' + f(v.ua, 0) + ' V) · ' + f(v.i, 1) + ' A = ' + f(v.pv, 1) + ' W.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { ue: 9, iLast: 0.3 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { value: vals().pv }),
      wrong: () => { const v = vals(); return [{ name: 'Ausgangsleistung statt Verlust', answer: S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { value: v.pab }) },
        { name: 'Eingangsleistung U_ein · I', answer: S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { value: v.pzu }) }]; } };
  })();

  /* ====================================================================== nt13: Wirkungsgrad des Linearreglers */
  const M13 = (() => {
    const BASE = { art: '7805' }, OWN = ['ue', 'iLast'], UE = 14, UA = 5, I = 0.6;
    const vals = () => once('v13', () => { const eta = fv('etaLin', UE, UA, I); return { ue: UE, ua: UA, i: I, eta, etaPct: eta * 100, verlust: (1 - eta) * 100, kehr: UE / UA * 100 }; });
    const ex = () => once('ex13', () => { const v = vals(); return U.calcEx({ value: v.eta, unit: '%', what: 'Wirkungsgrad η', extras: [
      { v: 1 - v.eta, msg: 'Dein Wert passt zum Verlustanteil (1 − η). Der Wirkungsgrad ist der Nutzanteil: η = U_aus / U_ein.' },
      { v: UE / UA, msg: 'Dein Wert passt zu U_ein / U_aus. Der Wirkungsgrad ist kleiner als 100 %: η = U_aus / U_ein.' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      setRow(r, 'stabil', eff, [{ key: 'ue', want: UE }, { key: 'iLast', want: I }], 'Am Prüfstand sind ' + f(UE, 0) + ' V Eingangsspannung und ' + f(I, 1) + ' A Laststrom eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Wirkungsgrad des Linearreglers berechnet (Toleranz 3 %)');
      r(near(sim.m.eta, v.etaPct, 0.01), 'Das Messgerät Wirkungsgrad zeigt denselben Wert', 'Das Messgerät zeigt ' + f(sim.m.eta, 1) + ' %, berechnet sind ' + f(v.etaPct, 1) + ' %.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Festspannungsregler 7805 liefert ' + f(UA, 0) + ' V bei ' + f(I, 1) + ' A aus ' + f(UE, 0) + ' V Eingangsspannung; der Ruhestrom wird vernachlässigt. Stelle Eingangsspannung und Laststrom im Prüfstand „Z-Diode und Linearregler“ ein und berechne den Wirkungsgrad (in %).',
      ask: { label: 'Wirkungsgrad η', unit: '%' },
      hint: () => { const v = vals(); return [
        'Der Wirkungsgrad ist abgegebene durch aufgenommene Leistung. Beim Linearregler fließt derselbe Strom hinein und heraus, deshalb kürzt sich der Strom: η = U_aus / U_ein.',
        'U_aus / U_ein = ' + f(v.ua, 0) + ' V / ' + f(v.ue, 0) + ' V. Der Verlustanteil wäre ' + f(v.verlust, 1) + ' %, das Kehrverhältnis ' + f(v.kehr, 0) + ' % (beides falsch).',
        'Musterlösung: η = ' + f(v.ua, 0) + ' V / ' + f(v.ue, 0) + ' V = ' + f(v.eta, 3) + ' = ' + f(v.etaPct, 1) + ' %.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { ue: 9, iLast: 0.3 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { value: vals().etaPct, text: f(vals().etaPct, 1) + ' %' }),
      wrong: () => { const v = vals(); return [{ name: 'Verlustanteil statt Wirkungsgrad', answer: S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { text: f(v.verlust, 1) + ' %', value: null }) },
        { name: 'Kehrwert U_ein / U_aus', answer: S('stabil', Object.assign({}, BASE, { ue: UE, iLast: I }), { text: f(v.kehr, 0) + ' %', value: null }) }]; } };
  })();

  /* ====================================================================== nt14: LM317 auf 9 V einstellen (Pool W2025-13) */
  const M14 = (() => {
    const BASE = { art: 'lm317', ue: 14, iLast: 0.3 }, OWN = ['r1', 'r2'], R1 = 240, UA = 9;
    const vals = () => once('v14', () => { const uref = lim('uref_317'), r2 = fv('r2lm317', UA, R1), s = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { r1: R1, r2 })));
      return { ua: UA, r1: R1, uref, faktor: UA / uref, r2, uam: s.m.uaus, vertauscht: R1 / (UA / uref - 1), ohne1: R1 * UA / uref, tol: 3 }; });
    const ex = () => once('ex14', () => { const v = vals(); return U.calcEx({ value: v.r2, unit: 'Ω', what: 'R2', tol: 0.03, extras: [
      { v: v.vertauscht, msg: 'Dein Wert passt zu vertauschten Widerständen: R1 liegt zwischen Ausgang und Adjust, R2 zwischen Adjust und Masse, und R2 muss größer sein als R1, weil U_aus über 1,25 V liegt.' },
      { v: v.ohne1, msg: 'Dein Wert passt zu R1 · U_aus / 1,25 V ohne den Abzug von 1: Aus U_aus = 1,25 V · (1 + R2 / R1) folgt R2 = R1 · (U_aus / 1,25 V − 1).' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'R2 für ' + f(UA, 1) + ' V berechnet (Toleranz 3 %)');
      setRow(r, 'stabil', eff, [{ key: 'r1', want: R1 }], 'Am Prüfstand ist R1 (Ausgang nach Adjust) auf ' + f(R1, 0) + ' Ω eingestellt');
      r(near(sim.m.uaus, UA, 0.03), 'Der Prüfstand liefert ' + f(UA, 1) + ' V am Ausgang (Toleranz 3 %)', 'Das Messgerät zeigt ' + f(sim.m.uaus, 2) + ' V bei R1 = ' + f(eff.r1, 0) + ' Ω und R2 = ' + f(eff.r2, 0) + ' Ω, verlangt sind ' + f(UA, 1) + ' V (U_aus = 1,25 V · (1 + R2 / R1)).');
    });
    return { vals, check, consts: [],
      text: () => 'Ein einstellbarer Spannungsregler LM317 (Referenzspannung zwischen Ausgang und Adjust-Anschluss ' + f(lim('uref_317'), 2) + ' V) soll ' + f(UA, 1) + ' V liefern. R1 zwischen Ausgang und Adjust beträgt ' + f(R1, 0) + ' Ω, R2 liegt zwischen Adjust und Masse. Der Adjust-Strom wird vernachlässigt. Berechne R2 und stelle beide Widerstände im Prüfstand „Z-Diode und Linearregler“ (LM317) ein.',
      ask: { label: 'Widerstand R2', unit: 'Ω' },
      hint: () => { const v = vals(); return [
        'Stelle U_aus = 1,25 V · (1 + R2 / R1) nach R2 um. Der Teilerfaktor ist U_aus / U_ref; davon geht die 1 ab, weil R1 zur Ausgangsspannung beiträgt.',
        'U_aus / U_ref = ' + f(v.ua, 1) + ' V / ' + f(v.uref, 2) + ' V = ' + f(v.faktor, 1) + '. R2 muss größer sein als R1; ohne den Abzug von 1 erhält man ' + f(v.ohne1, 0) + ' Ω, bei vertauschten Widerständen ' + f(v.vertauscht, 1) + ' Ω.',
        'Musterlösung: R2 = ' + f(v.r1, 0) + ' Ω · (' + f(v.faktor, 1) + ' − 1) = ' + f(v.r2, 0) + ' Ω; der Prüfstand zeigt dann ' + f(v.uam, 2) + ' V.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: 970 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: vals().r2 }), { value: vals().r2 }),
      wrong: () => { const v = vals(); return [{ name: 'R1 und R2 vertauscht', answer: S('stabil', Object.assign({}, BASE, { r1: 1000, r2: R1 }), { value: v.vertauscht }) },
        { name: 'Abzug von 1 vergessen, Ausgang zu hoch', answer: S('stabil', Object.assign({}, BASE, { r1: R1, r2: v.ohne1 }), { value: v.ohne1 }) }]; } };
  })();

  /* ====================================================================== nt15: Ausgangsspannung des LM317 (Pool H2025-23) */
  const M15 = (() => {
    const BASE = { art: 'lm317', ue: 14, iLast: 0.3 }, OWN = ['r1', 'r2'], R1 = 240, RF = 470, RP = 500;
    const vals = () => once('v15', () => { const r2 = RF + RP, ua = fv('lm317', R1, r2), s = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { r1: R1, r2 })));
      return { r1: R1, rf: RF, rp: RP, r2, ua, uref: lim('uref_317'), uohne: fv('lm317', R1, RF), uvoll: fv('lm317', R1, RF + 1000), uam: s.m.uaus }; });
    const ex = () => once('ex15', () => { const v = vals(); return U.calcEx({ value: v.ua, unit: 'V', what: 'Ausgangsspannung U_A', tol: TOL, extras: [
      { v: v.uohne, msg: 'Dein Wert passt zu R2 = nur dem Festwiderstand. Der Poti in Mittelstellung liegt in Reihe und zählt mit: R2 = Festwiderstand + wirksamer Poti-Anteil.' },
      { v: v.uvoll, msg: 'Dein Wert passt zu R2 mit dem ganzen Poti. In Mittelstellung ist nur die Hälfte wirksam.' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      setRow(r, 'stabil', eff, [{ key: 'r1', want: R1 }, { key: 'r2', want: v.r2 }], 'Am Prüfstand sind R1 = ' + f(R1, 0) + ' Ω und R2 = ' + f(v.r2, 0) + ' Ω eingestellt');
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'Ausgangsspannung des LM317 berechnet (Toleranz 2 %)');
      r(near(sim.m.uaus, v.ua, 0.01), 'Das Messgerät Ausgangsspannung zeigt denselben Wert', 'Das Messgerät zeigt ' + f(sim.m.uaus, 3) + ' V, berechnet sind ' + f(v.ua, 3) + ' V.');
    });
    return { vals, check, consts: [],
      text: () => { const v = vals(); return 'Ein Spannungsregler LM317 liegt mit R1 = ' + f(v.r1, 0) + ' Ω zwischen Ausgang und Einstellanschluss. Der Widerstand R2 vom Einstellanschluss nach Masse besteht aus einem Festwiderstand von ' + f(v.rf, 0) + ' Ω in Reihe mit einem 1-kΩ-Poti in Mittelstellung (wirksam ' + f(v.rp, 0) + ' Ω). Stelle R1 und R2 im Prüfstand „Z-Diode und Linearregler“ (LM317) ein und berechne die Ausgangsspannung mit U_A = 1,25 V · (1 + R2 / R1).'; },
      ask: { label: 'Ausgangsspannung U_A', unit: 'V' },
      hint: () => { const v = vals(); return [
        'Bestimme zuerst den wirksamen Wert von R2: Festwiderstand und der wirksame Teil des Potis liegen in Reihe und werden addiert. Setze dann in die Formel ein.',
        'R2 = ' + f(v.rf, 0) + ' Ω + ' + f(v.rp, 0) + ' Ω = ' + f(v.r2, 0) + ' Ω. Nur mit dem Festwiderstand erhielte man ' + f(v.uohne, 2) + ' V, mit dem ganzen Poti ' + f(v.uvoll, 2) + ' V (beides falsch).',
        'Musterlösung: U_A = ' + f(v.uref, 2) + ' V · (1 + ' + f(v.r2, 0) + ' / ' + f(v.r1, 0) + ') = ' + f(v.ua, 3) + ' V.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: 0 }), { value: null }),
      sol: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: vals().r2 }), { value: vals().ua }),
      wrong: () => { const v = vals(); return [{ name: 'Poti vergessen (R2 = 470 Ω)', answer: S('stabil', Object.assign({}, BASE, { r1: R1, r2: v.rf }), { value: v.uohne }) },
        { name: 'ganzes Poti gerechnet', answer: S('stabil', Object.assign({}, BASE, { r1: R1, r2: v.rf + 1000 }), { value: v.uvoll }) }]; } };
  })();

  /* ====================================================================== nt16: 7805 durch LM317 ersetzen (Pool W2025-B01) */
  const M16 = (() => {
    const BASE = { art: 'lm317', ue: 14, iLast: 0.3 }, OWN = ['r1', 'r2'], R1 = 240, UA = 5;
    const vals = () => once('v16', () => { const uref = lim('uref_317'), r2 = fv('r2lm317', UA, R1), s = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { r1: R1, r2 }))), n = snap('stabil', fullCtl('stabil', Object.assign({}, BASE, { r1: R1, r2: 0 })));
      return { ua: UA, r1: R1, uref, faktor: UA / uref, r2, uam: s.m.uaus, u0: n.m.uaus }; });
    const O1 = () => [
      opt('a', 'Der Adjust-Anschluss wird direkt mit Masse verbunden, sonst ist keine Änderung nötig.', 'Mit dem Adjust-Anschluss an Masse (R2 = 0 Ω) hält der LM317 nur seine Referenzspannung am Ausgang. Für eine andere Ausgangsspannung braucht er einen Teiler.'),
      opt('b', 'Zwischen OUT und ADJ kommt ein Widerstand R1, zwischen ADJ und Masse ein Widerstand R2; die Ausgangsspannung ergibt sich aus dem Teilerverhältnis.', ''),
      opt('c', 'Zwischen IN und ADJ kommt ein Widerstand R1, zwischen ADJ und OUT ein Widerstand R2.', 'Der Teiler liegt am Ausgang, nicht am Eingang: R1 zwischen OUT und ADJ, R2 zwischen ADJ und Masse. Der Abgriff am ADJ-Anschluss muss die Ausgangsspannung teilen.'),
      opt('d', 'Der Adjust-Anschluss bleibt offen, der Ausgangselko wird auf 5 V Nennspannung vergrößert.', 'Ein offener Adjust-Anschluss legt keine Ausgangsspannung fest. Die Spannung stellt der Teiler ein, nicht der Ausgangselko.'),
      opt('e', 'Am Ausgang wird eine 5,1-V-Z-Diode gegen Masse geschaltet, der Adjust-Anschluss wird mit IN verbunden.', 'Der Adjust-Anschluss gehört an den Teilerabgriff, nicht an den Eingang. Eine Z-Diode am Ausgang ersetzt den Teiler nicht.')];
    const ex = () => once('ex16', () => { const v = vals(); return U.calcEx({ value: v.r2, unit: 'Ω', what: 'R2', tol: 0.03, extras: [
      { v: v.r1 * v.ua / v.uref, msg: 'Dein Wert passt zu R1 · U_aus / 1,25 V ohne den Abzug von 1: R2 = R1 · (U_aus / 1,25 V − 1).' }] }); });
    const check = mk('stabil', OWN, (c, r, a) => {
      const eff = effOf(c, 'stabil', OWN, BASE), sim = snap('stabil', eff), v = vals();
      inputRow(c, r, sim, a, 'stabil');
      U.choiceRow(r, a, { key: 'q1', right: 'b', opts: O1(), label: 'Notwendige Änderung an der Schaltung richtig gewählt' });
      U.calcRow(r, ex(), U.rawOf(a, 'value'), 'R2 für ' + f(UA, 0) + ' V berechnet (Toleranz 3 %)');
      setRow(r, 'stabil', eff, [{ key: 'r1', want: R1 }], 'Am Prüfstand ist R1 (Ausgang nach Adjust) auf ' + f(R1, 0) + ' Ω eingestellt');
      r(near(sim.m.uaus, UA, 0.03), 'Der Prüfstand liefert ' + f(UA, 0) + ' V am Ausgang wie vorher der 7805 (Toleranz 3 %)', 'Das Messgerät zeigt ' + f(sim.m.uaus, 2) + ' V bei R1 = ' + f(eff.r1, 0) + ' Ω und R2 = ' + f(eff.r2, 0) + ' Ω, verlangt sind ' + f(UA, 0) + ' V.');
    });
    return { vals, check, consts: [],
      text: () => 'In einer Netzteilstufe soll ein nicht lieferbarer Festspannungsregler 7805 (Anschlüsse IN, GND, OUT) durch einen LM317 ersetzt werden. Die Ausgangsspannung von ' + f(UA, 0) + ' V muss erhalten bleiben. Wähle die notwendige Änderung an der Schaltung, berechne R2 für R1 = ' + f(R1, 0) + ' Ω und stelle beide Widerstände im Prüfstand „Z-Diode und Linearregler“ (LM317) ein.',
      ask: { label: 'Widerstand R2', unit: 'Ω' },
      choices: () => [U.choiceDef('q1', 'Welche Änderung ist notwendig?', O1())],
      hint: () => { const v = vals(); return [
        'Der 7805 hat seine Ausgangsspannung fest eingebaut, der LM317 hält nur die Referenzspannung zwischen Ausgang und Adjust-Anschluss. Die Ausgangsspannung entsteht erst durch einen Spannungsteiler, dessen Abgriff am Adjust-Anschluss liegt.',
        'Der Teiler liegt zwischen Ausgang, Adjust und Masse (R1 oben, R2 unten). Für ' + f(v.ua, 0) + ' V ist U_aus / U_ref = ' + f(v.faktor, 0) + '; ohne R2 (Adjust an Masse) liefert der Prüfstand nur ' + f(v.u0, 2) + ' V.',
        'Musterlösung: Antwort 2 (Teiler OUT–ADJ–Masse). R2 = ' + f(v.r1, 0) + ' Ω · (' + f(v.faktor, 0) + ' − 1) = ' + f(v.r2, 0) + ' Ω; der Prüfstand zeigt dann ' + f(v.uam, 2) + ' V.'
      ]; },
      start: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: 970 }), { value: null, choices: {} }),
      sol: () => S('stabil', Object.assign({}, BASE, { r1: R1, r2: vals().r2 }), { value: vals().r2, choices: { q1: 'b' } }),
      wrong: () => [{ name: 'Adjust an Masse, Teiler weggelassen', answer: S('stabil', Object.assign({}, BASE, { r1: R1, r2: 0 }), { value: 0, choices: { q1: 'a' } }) },
        { name: 'Teiler am Eingang, R2 viel zu groß', answer: S('stabil', Object.assign({}, BASE, { r1: R1, r2: 3000 }), { value: 3000, choices: { q1: 'c' } }) }] };
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
    tk({ id: 'nt1', lab: 'nts', cat: 'Prüfungsnah', title: 'Reihenfolge der Funktionsblöcke (Pool H2023-N03)', level: 1, rig: 'gleich' }, M1),
    tk({ id: 'nt2', lab: 'nts', cat: 'Prüfungsnah', title: 'Strom auf der Primärseite (Pool F2021-N04)', level: 2, rig: 'trafo' }, M2),
    tk({ id: 'nt3', lab: 'nts', cat: 'Transformator', title: 'Klemmenspannung berechnen', level: 2, rig: 'trafo' }, M3),
    tk({ id: 'nt4', lab: 'nts', cat: 'Prüfungsnah', title: 'Wie viele Impulse? (Pool H2024-09)', level: 1, rig: 'gleich' }, M4),
    tk({ id: 'nt5', lab: 'nts', cat: 'Prüfungsnah', title: 'Spitzenspannung der Brücke (Pool F2020-N25)', level: 2, rig: 'gleich' }, M5),
    tk({ id: 'nt6', lab: 'nts', cat: 'Gleichrichter', title: 'Brummspannung berechnen', level: 2, rig: 'gleich' }, M6),
    tk({ id: 'nt7', lab: 'nts', cat: 'Gleichrichter', title: 'Brummspannung unter 1 V bringen', level: 2, rig: 'gleich' }, M7),
    tk({ id: 'nt8', lab: 'nts', cat: 'Prüfungsnah', title: 'Einschaltstrom begrenzen (Pool F2024-N07)', level: 2, rig: 'gleich' }, M8),
    tk({ id: 'nt9', lab: 'nts', cat: 'Prüfungsnah', title: 'Z-Diode: Strom berechnen (Pool S2025-30)', level: 2, rig: 'stabil' }, M9),
    tk({ id: 'nt10', lab: 'nts', cat: 'Prüfungsnah', title: 'Z-Diode: Vorwiderstand (Pool F2020-N22)', level: 3, rig: 'stabil' }, M10),
    tk({ id: 'nt11', lab: 'nts', cat: 'Z-Diode', title: 'Z-Diode regelt nicht mehr', level: 3, rig: 'stabil' }, M11),
    tk({ id: 'nt12', lab: 'nts', cat: 'Prüfungsnah', title: 'Verlustleistung des Linearreglers (Pool H2026-20)', level: 2, rig: 'stabil' }, M12),
    tk({ id: 'nt13', lab: 'nts', cat: 'Linearregler', title: 'Wirkungsgrad des Linearreglers', level: 2, rig: 'stabil' }, M13),
    tk({ id: 'nt14', lab: 'nts', cat: 'Prüfungsnah', title: 'LM317 auf 9 V einstellen (Pool W2025-13)', level: 3, rig: 'stabil' }, M14),
    tk({ id: 'nt15', lab: 'nts', cat: 'Prüfungsnah', title: 'Ausgangsspannung des LM317 (Pool H2025-23)', level: 2, rig: 'stabil' }, M15),
    tk({ id: 'nt16', lab: 'nts', cat: 'Prüfungsnah', title: '7805 durch LM317 ersetzen (Pool W2025-B01)', level: 3, rig: 'stabil' }, M16)
  ]);
  /* Musterwerte der Aufgaben nt1-nt16 (Schwellen aus der gerechneten Musterloesung) fuer Tests und Ausbilder */
  T.thresholds1 = () => ({ nt1: M1.vals(), nt2: M2.vals(), nt3: M3.vals(), nt4: M4.vals(), nt5: M5.vals(), nt6: M6.vals(), nt7: M7.vals(), nt8: M8.vals(), nt9: M9.vals(), nt10: M10.vals(), nt11: M11.vals(), nt12: M12.vals(), nt13: M13.vals(), nt14: M14.vals(), nt15: M15.vals(), nt16: M16.vals() });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
