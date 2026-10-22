/* emvtasks1.js - EMV-Lab: Aufgaben em1 bis em16 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4a.
 * Registrierung: EMV_TASKS.register([ ... ]) (EMV_TASKS und die Hilfsfunktionen EMV_TASKS.util kommen aus emvdata.js; emvdata.js VOR dieser Datei laden,
 * in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'emN', lab:'emv', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), value?, fields?, choices? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort).
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, clicks }.
 *   check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis (Start < 100, Musterloesung = 100).
 * Regeln (SPEC Abschnitte 9 und 11):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus der Simulation (Pruefstaende) und EMV_CORE und stehen in hintVals() (Regel 1); text, table und hint
 *     werden erst beim ersten Zugriff gerechnet. EMV_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3.
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert
 *     uebereinstimmt; Auswahlfragen nennen die Zahlen der Simulation.
 *   - Schwellwerte stehen als Konstanten mit Kommentar (aus Musterloesung, Stand 2026-10-22); test_emvdata1.js prueft die Reserve gegen die frische Musterloesung
 *     (3 dB bei Pegeln, 25 % bei Groessen wie Verlust). Vorgaben der Aufgabe (Ableitstrom, Snubber-Verlust ...) stehen im Aufgabentext, nie als Normwert (A13).
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (BASE), damit gleiche Eingaben gleiche Ergebnisse liefern.
 *   - Abweichungen von der SPEC: quelle/emvlab/ABWEICHUNGEN.md, Abschnitt WP4a.
 * Uebungsanlage: Alle Zahlen sind Uebungswerte. Herstellerdokumentation und aktuelle Norm massgeblich. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const TT = () => { if (!root.EMV_TASKS) nodeReq('./emvdata.js'); return root.EMV_TASKS || null; };
  const T = TT();
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('emvtasks1.js: emvdata.js fehlt, die Aufgaben em1 bis em16 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, isObj = U.isObj, initial = U.initial, fullCtl = U.fullCtl, mk = U.mk, inputRow = U.inputRow, numRow = U.numRow, snap = U.snap, effOf = U.effOf, setRow = U.setRow, cdef = U.cdef;
  const CORE = () => U.CORE();
  const RIGS = id => U.RIGS(id);
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const answerOf = (task, o) => T.answerOf(task, o);
  const choiceOf = (a, k) => U.choiceOf(a, k);
  const kit = () => RIGS('filter').base.kit(CORE());
  const tbl = (caption, head, rows) => ({ caption, head, rows });
  const presetOf = (rig, id) => { const p = (RIGS(rig).defs[rig].presets || []).find(x => x.id === id); return p ? Object.assign({}, p.params || p.controls || {}) : {}; };
  const S = (rig, over) => ({ rig, controls: fullCtl(rig, over) });
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const db = (a, b) => 20 * Math.log10(a / b);
  const first = s => String(s || '').split(/(?<=\.)\s/)[0];
  const optLabel = (rig, key, v) => U.olabel(rig, key, v);
  const BAND = [25e6, 30e6];                                // Bereich fuer die Linie "bei 30 MHz" (em11): hoechste Linie von 25 bis 30 MHz, siehe ABWEICHUNGEN WP4a
  const bandL = s => U.bandMax(s.rig, BAND[0], BAND[1]);

  /* ====================================================================== em1: Bedienelemente und Hebel */
  const M1 = (() => {
    const KEYS = ['us', 's', 'schirm', 'ro', 'sym'];
    const LV = () => ['quelle', 'pfad', 'senke'].map(id => ({ value: id, label: CORE().levers[id].name }));
    const want = () => KEYS.reduce((o, k) => { o[k] = (cdef('kopplung', k) || {}).lever; return o; }, {});
    const lname = id => CORE().levers[id].name;
    const text = () => 'Jedes Bedienelement im Prüfstand gehört zu einem von drei Hebeln: „' + lname('quelle') + '“, „' + lname('pfad') + '“ oder „' + lname('senke') + '“. Im Bedienpult des Kopplungs-Labors stehen die Elemente nach Hebeln gruppiert. Ordne fünf Bedienelemente dem Hebel zu, zu dem sie gehören.';
    const hint = () => [
      'Frage dich bei jedem Element: Verändert es die Störquelle selbst, den Weg der Störung zwischen den Leitungen oder die Empfindlichkeit der Störsenke?',
      'Schau im Bedienpult nach: Die Gruppenüberschrift über den Reglern nennt den Hebel. Die Spannung der Störquelle gehört zu „' + lname('quelle') + '“.',
      'Musterlösung: ' + KEYS.map(k => (cdef('kopplung', k) || {}).label + ' → ' + lname(want()[k])).join('; ') + '.'
    ];
    const choices = () => KEYS.map(k => ({ key: k, q: 'Zu welchem Hebel gehört „' + (cdef('kopplung', k) || {}).label + '“?', options: LV() }));
    const check = mk('kopplung', [], (c, r, a) => {
      const w = want();
      KEYS.forEach(k => {
        const d = cdef('kopplung', k) || {}, got = choiceOf(a, k), none = got === undefined || got === null || got === '', hit = none ? null : LV().find(y => String(y.value) === String(got));
        r(!none && String(got) === w[k], '„' + d.label + '“ richtig zugeordnet',
          none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + 'Im Bedienpult steht „' + d.label + '“ in der Gruppe „' + lname(w[k]) + '“. ' + first(d.help));
      });
    });
    return { vals: () => ({}), text, hint, choices, check, start: () => S('kopplung', {}), sol: () => Object.assign(S('kopplung', {}), { choices: want() }) };
  })();

  /* ====================================================================== em2: dominierende Kopplung der Voreinstellungen */
  const M2 = (() => {
    const IDS = ['audio', 'sensor', 'relais'];
    const OPT = [{ value: 'kapazitiv', label: 'kapazitive Kopplung' }, { value: 'induktiv', label: 'induktive Kopplung' }, { value: 'galvanisch', label: 'galvanische Kopplung' }, { value: 'brummen', label: 'Brummen durch Masseschleife' }];
    const cases = () => once('c2', () => IDS.map(id => {
      const p = RIGS('kopplung').defs.kopplung.presets.find(x => x.id === id), s = snap('kopplung', fullCtl('kopplung', Object.assign({}, p.params || p.controls))), t = String((s.s && s.s.domText) || '');
      return { id, name: p.name, s, dom: t.toLowerCase(), m: s.m };
    }));
    const text = () => 'Das Kopplungs-Labor hat Voreinstellungen für typische Fälle. Lade die Voreinstellungen „' + cases().map(x => x.name).join('“, „') + '“ nacheinander und lies am Messgerät „Dominante Kopplung“ ab, welche Kopplung jeweils überwiegt. Gib sie unten an.';
    const hint = () => {
      const c = cases();
      return ['Die dominante Kopplung ist der größte der vier Anteile uKap, uInd, uGalv und uBrumm. Das Messgerät zeigt sie als Text an.',
        'Schau dir die Messgeräte an: ' + c.map(x => x.name + ': uKap ' + f(x.m.uKap, 1) + ' mV, uInd ' + f(x.m.uInd, 1) + ' mV, uBrumm ' + f(x.m.uBrumm, 1) + ' mV').join('; ') + '. Der größte Wert gewinnt.',
        'Musterlösung: ' + c.map(x => x.name + ' → ' + (OPT.find(o => o.value === x.dom) || { label: x.dom }).label).join('; ') + '.'];
    };
    const choices = () => cases().map(x => ({ key: x.id, q: 'Welche Kopplung dominiert in der Voreinstellung „' + x.name + '“?', options: OPT }));
    const check = mk('kopplung', [], (c, r, a) => {
      cases().forEach(x => {
        const got = choiceOf(a, x.id), none = got === undefined || got === null || got === '', hit = none ? null : OPT.find(y => String(y.value) === String(got)), m = x.m;
        r(!none && String(got) === x.dom, 'Voreinstellung „' + x.name + '“: dominante Kopplung richtig',
          none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + 'In der Voreinstellung sind uKap = ' + f(m.uKap, 2) + ' mV, uInd = ' + f(m.uInd, 2) + ' mV, uGalv = ' + f(m.uGalv, 2) + ' mV und uBrumm = ' + f(m.uBrumm, 2) + ' mV; der größte Anteil ist „' + (OPT.find(o => o.value === x.dom) || { label: x.dom }).label + '“.');
      });
    });
    return { vals: () => cases().reduce((o, x) => { o[x.id] = { ukap: x.m.uKap, uind: x.m.uInd, ugalv: x.m.uGalv, ubrumm: x.m.uBrumm }; return o; }, {}), text, hint, choices, check, start: () => S('kopplung', {}), sol: () => Object.assign(S('kopplung', {}), { choices: cases().reduce((o, x) => { o[x.id] = x.dom; return o; }, {}) }) };
  })();

  /* ====================================================================== Rechenaufgaben aus den Kernuebungen (em3, em13) */
  function calcModule(list, texts) {
    const ex = () => once('ex' + list.map(x => x.join(':')).join(','), () => list.map(([kind, seed]) => CORE().exercise(kind, seed)));
    const keys = list.map((x, i) => 'a' + (i + 1));
    const nums = s => (String(s).match(/-?\d+(?:,\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
    const vals = () => { const o = {}; ex().forEach((e, i) => { o[keys[i]] = { wert: e.answer.value, schritte: nums((e.steps || []).join(' ')), frage: nums(e.question) }; }); return o; };
    const fields = () => ex().map((e, i) => ({ key: keys[i], question: (i + 1) + '. ' + e.question, unit: e.answer.unit }));
    const check = mk(null, [], (c, r, a) => {
      ex().forEach((e, i) => {
        const v = U.fieldNum(a, keys[i]), res = U.exCheck(list[i][0], list[i][1], v);
        r(res.ok === true, 'Aufgabe ' + (i + 1) + ': ' + (texts.labels[i] || e.kind) + ' richtig', res.ok ? '' : res.text);
      });
    });
    const hint = () => [texts.h0, texts.h1, 'Musterlösung: ' + ex().map((e, i) => (i + 1) + '. ' + (e.steps || []).join(' → ')).join('  ')];
    return { vals, fields, check, hint, start: () => ({ controls: {}, fields: {} }), sol: () => ({ controls: {}, fields: keys.reduce((o, k, i) => { o[k] = ex()[i].answer.value; return o; }, {}) }) };
  }
  const M3 = Object.assign(calcModule([['dbV', 1], ['dbP', 2], ['dbuv', 3]], {
    labels: ['Spannungsverhältnis in dB', 'Leistungsverhältnis in dB', 'Pegel in dBµV'],
    h0: 'Verhältnisse in dB: Bei Spannungen gilt a = 20·lg(U2/U1), bei Leistungen a = 10·lg(P2/P1). Der Pegel in dBµV hat den Bezug 1 µV: L = 20·lg(U/1 µV).',
    h1: 'Rechne erst alle Größen in dieselbe Einheit um (zum Beispiel alles in Volt oder alles in µV), dann bilde das Verhältnis und nimm den Zehnerlogarithmus. Ein Faktor 10 in der Spannung sind 20 dB, in der Leistung 10 dB.'
  }), { text: () => 'Rechne in dB: ein Spannungsverhältnis, ein Leistungsverhältnis und die Umrechnung einer Spannung in einen Pegel in dBµV. Trage die Ergebnisse mit der angegebenen Einheit ein; du kannst den Rechner im Tab „Rechnen“ benutzen.' });

  /* ====================================================================== em4: kapazitive Einkopplung um 20 dB senken */
  const M4 = (() => {
    const BASE = { ro: 1e5, f: 1e6, us: 24, rl: 48, s: 0.01, h: 0.01, len: 1, schirm: 'kein', twist: 0, sym: 'unsym', gem: false, rgem: 0.05, loop: false, dUg: 0.5, uNutz: 0.1, snrReq: 40 };
    const OWN = ['s', 'h', 'len', 'schirm', 'twist', 'sym', 'us', 'f', 'ro', 'rl'];
    const FACTOR = 10;                                                  // Vorgabe der Aufgabe: uKap hoechstens ein Zehntel (20 dB); Musterloesung (Schirm einseitig) liefert 40 dB, Reserve 20 dB
    const vals = () => once('v4', () => {
      const s0 = snap('kopplung', fullCtl('kopplung', BASE)), s1 = snap('kopplung', fullCtl('kopplung', Object.assign({}, BASE, { schirm: 'eine' })));
      return { uk0: s0.m.uKap, thr: s0.m.uKap / FACTOR, uk1: s1.m.uKap, gain: db(s0.m.uKap, s1.m.uKap), dbReq: 20 * Math.log10(FACTOR), ui0: s0.m.uInd, us: BASE.us, f: BASE.f, ro: BASE.ro };
    });
    const text = () => { const v = vals(); return 'Ein hochohmiger Sensoreingang (ro = ' + f(v.ro / 1000, 0) + ' kΩ) liegt ' + f(BASE.len, 0) + ' m weit neben einer Störleitung (us = ' + f(v.us, 0) + ' V, f = ' + f(v.f / 1e6, 0) + ' MHz, Abstand ' + f(BASE.s * 1000, 0) + ' mm). Am Start misst der Prüfstand uKap = ' + f(v.uk0, 1) +
      ' mV. Verringere die kapazitive Einkopplung um mindestens ' + f(v.dbReq, 0) + ' dB, also auf höchstens ' + f(v.thr, 1) + ' mV. Die Störquelle (us, f, rl) und der Sensoreingang (ro) gehören zur Aufgabe und bleiben unverändert; die induktive Einkopplung uInd darf nicht größer werden.'; };
    const hint = () => { const v = vals(); return [
      'Bei einem hochohmigen Eingang dominiert die kapazitive Kopplung. Dagegen helfen mehr Abstand der Leitungen, eine kürzere Leitung oder ein Schirm. Spannung und Frequenz der Störquelle bleiben, wie sie sind.',
      'Du brauchst uKap ≤ ' + f(v.thr, 1) + ' mV; am Start sind es ' + f(v.uk0, 1) + ' mV. Im Modell senkt ein einseitig angeschlossener Schirm die kapazitive Kopplung auf ein Hundertstel.',
      'Musterlösung: Schirm „einseitig aufgelegt“ (schirm = eine). uKap sinkt von ' + f(v.uk0, 1) + ' mV auf ' + f(v.uk1, 2) + ' mV (' + f(v.gain, 1) + ' dB); uInd bleibt bei ' + f(v.ui0, 1) + ' mV.']; };
    const check = mk('kopplung', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'kopplung', OWN, BASE), sim = snap('kopplung', eff);
      inputRow(c, r, sim, a, 'kopplung');
      setRow(r, 'kopplung', eff, [{ key: 'us', want: BASE.us }, { key: 'f', want: BASE.f, tol: 1e-6 }, { key: 'ro', want: BASE.ro, tol: 1e-6 }, { key: 'rl', want: BASE.rl }], 'Die Vorgaben der Aufgabe (us, f, ro, rl) sind unverändert');
      const uk = sim.m.uKap, ok = uk <= v.thr * (1 + 1e-9);
      r(ok, 'Die kapazitive Einkopplung uKap ist höchstens ' + f(v.thr, 1) + ' mV (mindestens ' + f(v.dbReq, 0) + ' dB weniger als am Start)', 'uKap ist ' + f(uk, 1) + ' mV, am Start waren es ' + f(v.uk0, 1) + ' mV: Das sind ' + (uk < v.uk0 ? f(db(v.uk0, uk), 1) + ' dB weniger, verlangt sind ' + f(v.dbReq, 0) + ' dB.' : 'nicht weniger als am Start.'));
      r(sim.m.uInd <= v.ui0 * (1 + 1e-6), 'Die induktive Einkopplung uInd ist nicht größer als am Start (' + f(v.ui0, 1) + ' mV)', 'uInd ist ' + f(sim.m.uInd, 1) + ' mV und damit größer als am Start (' + f(v.ui0, 1) + ' mV): Deine Maßnahme verschlechtert die induktive Kopplung.');
    });
    return { vals, text, hint, check, OWN, BASE, FACTOR, start: () => S('kopplung', BASE), sol: () => S('kopplung', Object.assign({}, BASE, { schirm: 'eine' })) };
  })();

  /* ====================================================================== em5: induktive Einkopplung durch Verdrillen */
  const M5 = (() => {
    const BASE = { s: 0.005, h: 0.01, len: 2, f: 1e4, us: 24, rl: 100, ro: 50, schirm: 'kein', twist: 0, sym: 'unsym', gem: false, rgem: 0.05, loop: false, dUg: 0.5, uNutz: 0.1, snrReq: 40 };
    const OWN = ['s', 'h', 'len', 'schirm', 'twist', 'sym'];
    const FACTOR = 10;                                                  // Vorgabe: uInd hoechstens ein Zehntel (20 dB); Musterloesung twist 20 je m liefert gut 30 dB, Reserve ueber 10 dB
    const TW = 20;
    const vals = () => once('v5', () => {
      const s0 = snap('kopplung', fullCtl('kopplung', BASE)), s1 = snap('kopplung', fullCtl('kopplung', Object.assign({}, BASE, { twist: TW })));
      return { ui0: s0.m.uInd, thr: s0.m.uInd / FACTOR, ui1: s1.m.uInd, gain: db(s0.m.uInd, s1.m.uInd), dbReq: 20 * Math.log10(FACTOR), tw: TW, fmin: CORE().coupling.twist(1e9), uk0: s0.m.uKap, f: BASE.f, ro: BASE.ro, rl: BASE.rl, len: BASE.len, s: BASE.s * 1000 };
    });
    const text = () => { const v = vals(); return 'Eine Relaisleitung (us = ' + f(BASE.us, 0) + ' V, rl = ' + f(v.rl, 0) + ' Ω) liegt ' + f(v.len, 0) + ' m lang im Abstand ' + f(v.s, 0) + ' mm neben einer niederohmigen Signalleitung (ro = ' + f(v.ro, 0) + ' Ω, f = ' + f(v.f / 1000, 0) + ' kHz). Dort dominiert die induktive Kopplung: Der Prüfstand misst uInd = ' + f(v.ui0, 2) +
      ' mV. Verringere sie durch Verdrillen der Leitungen auf höchstens ' + f(v.thr, 2) + ' mV (mindestens ' + f(v.dbReq, 0) + ' dB weniger). Abstand und Geometrie darfst du dabei nicht als Ersatz benutzen: Die Leitung muss verdrillt sein (Verdrillung größer als 0 je Meter).'; };
    const hint = () => { const v = vals(); return [
      'Beim Verdrillen heben sich die Spannungen benachbarter Schleifen auf. Der Regler „Verdrillung“ gibt die Anzahl der Verdrillungen je Meter an.',
      'Du brauchst uInd ≤ ' + f(v.thr, 2) + ' mV; am Start sind es ' + f(v.ui0, 2) + ' mV. Im Modell wirkt der Faktor 1/(1 + N) mit N = Verdrillung · Länge (mindestens ' + f(v.fmin, 2) + ').',
      'Musterlösung: Verdrillung ' + f(v.tw, 0) + ' je m. uInd sinkt von ' + f(v.ui0, 2) + ' mV auf ' + f(v.ui1, 3) + ' mV (' + f(v.gain, 1) + ' dB).']; };
    const check = mk('kopplung', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'kopplung', OWN, BASE), sim = snap('kopplung', eff);
      inputRow(c, r, sim, a, 'kopplung');
      r(eff.twist > 0, 'Die Leitungen sind verdrillt (Verdrillung größer als 0 je Meter)', 'Die Verdrillung steht auf ' + f(eff.twist, 0) + ' je Meter: Die Leitungen sind nicht verdrillt. Ohne Verdrillen gilt diese Aufgabe nicht als gelöst, auch wenn uInd anders klein wird.');
      const ui = sim.m.uInd;
      r(ui <= v.thr * (1 + 1e-9), 'Die induktive Einkopplung uInd ist höchstens ' + f(v.thr, 2) + ' mV (mindestens ' + f(v.dbReq, 0) + ' dB weniger als am Start)', 'uInd ist ' + f(ui, 3) + ' mV, am Start waren es ' + f(v.ui0, 2) + ' mV: ' + (ui < v.ui0 ? f(db(v.ui0, ui), 1) + ' dB weniger, verlangt sind ' + f(v.dbReq, 0) + ' dB.' : 'nicht weniger als am Start.'));
    });
    return { vals, text, hint, check, OWN, BASE, FACTOR, TW, start: () => S('kopplung', BASE), sol: () => S('kopplung', Object.assign({}, BASE, { twist: TW })) };
  })();

  /* ====================================================================== em6: Schirmung waehlen (zwei Faelle) */
  const M6 = (() => {
    const ORDER = ['kein', 'eine', 'beide'];                            // von der einfachsten zur aufwendigsten Schirmung
    const CASES = [
      { key: 'a', name: 'Fall A: hochohmiger Sensoreingang', ctl: { ro: 1e5, f: 1e5, us: 24, rl: 48, uNutz: 1, snrReq: 20 }, want: 'eine' },
      { key: 'b', name: 'Fall B: niederohmiger Eingang, starker Strom', ctl: { ro: 50, f: 1e6, us: 24, rl: 48, uNutz: 1, snrReq: 20 }, want: 'beide' }
    ];
    const base = c => Object.assign({ s: 0.01, h: 0.01, len: 1, schirm: 'kein', twist: 0, sym: 'unsym', gem: false, rgem: 0.05, loop: false, dUg: 0.5 }, c.ctl);
    const res = () => once('r6', () => CASES.map(c => { const o = {}; ORDER.forEach(k => { const s = snap('kopplung', fullCtl('kopplung', Object.assign(base(c), { schirm: k }))); o[k] = { snr: s.m.snr, uKap: s.m.uKap, uInd: s.m.uInd }; }); return { c, o, req: c.ctl.snrReq }; }));
    const enough = (x, k) => x.o[k].snr >= x.req - 1e-9;
    const minimal = x => ORDER.find(k => enough(x, k));
    const LBL = () => (cdef('kopplung', 'schirm').options || []).reduce((o, x) => { o[x.value] = x.label; return o; }, {});
    const opts = () => ORDER.map(k => ({ value: k, label: LBL()[k] || k }));
    const text = () => { const b = base(CASES[0]); return 'Zwei Leitungen laufen ' + f(b.len, 0) + ' m lang im Abstand ' + f(b.s * 1000, 0) + ' mm nebeneinander (Störspannung ' + f(b.us, 0) + ' V, Nutzsignal ' + f(b.uNutz, 0) + ' V). Der Störabstand soll mindestens ' + f(res()[0].req, 0) + ' dB betragen. Wähle für jeden Fall die einfachste Schirmung der Opferleitung, mit der die Rechnung des Prüfstands die Vorgabe erreicht. Probiere die Fälle im Prüfstand aus.'; };
    const table = () => tbl('Die beiden Fälle', ['Fall', 'Abschluss ro', 'Frequenz f', 'Dominante Kopplung ohne Schirm'], res().map(x => [x.c.name, CORE().fmtEng(x.c.ctl.ro, 'Ω'), CORE().fmtEng(x.c.ctl.f, 'Hz'), String(snap('kopplung', fullCtl('kopplung', base(x.c))).s.domText || '–') + 'e Kopplung']));
    const hint = () => { const R = res(); return [
      'Einseitig aufgelegt wirkt der Schirm nur gegen das elektrische Feld, beidseitig aufgelegt auch gegen das Magnetfeld, aber erst oberhalb der Schirm-Grenzfrequenz. Prüfe, welche Kopplung im Fall dominiert.',
      R.map(x => x.c.name + ': Störabstand ohne Schirm ' + f(x.o.kein.snr, 1) + ' dB, einseitig ' + f(x.o.eine.snr, 1) + ' dB, beidseitig ' + f(x.o.beide.snr, 1) + ' dB (Vorgabe ' + f(x.req, 0) + ' dB)').join('; ') + '.',
      'Musterlösung: ' + R.map(x => x.c.name + ' → ' + (LBL()[minimal(x)] || minimal(x))).join('; ') + '.']; };
    const choices = () => CASES.map(c => ({ key: c.key, q: c.name + ': Welche Schirmung genügt?', options: opts() }));
    const check = mk('kopplung', [], (c, r, a) => {
      res().forEach(x => {
        const got = choiceOf(a, x.c.key), none = got === undefined || got === null || got === '', ok = ORDER.includes(got), mn = minimal(x);
        let why = 'Wähle eine Antwort aus.';
        if (!none && !ok) why = 'Deine Auswahl gehört nicht zu den Antworten.';
        else if (!none) {
          const v = x.o[got];
          if (!enough(x, got)) why = 'Du hast „' + LBL()[got] + '“ gewählt. Dafür rechnet der Prüfstand einen Störabstand von ' + f(v.snr, 1) + ' dB; verlangt sind ' + f(x.req, 0) + ' dB. Die Schirmung reicht nicht (uKap ' + f(v.uKap, 1) + ' mV, uInd ' + f(v.uInd, 1) + ' mV).';
          else if (got !== mn) why = 'Du hast „' + LBL()[got] + '“ gewählt: Damit erreichst du ' + f(v.snr, 1) + ' dB und damit die Vorgabe; es gibt aber eine einfachere Schirmung („' + LBL()[mn] + '“, ' + f(x.o[mn].snr, 1) + ' dB), die ebenfalls genügt.';
        }
        r(!none && ok && got === mn, x.c.name + ': die einfachste ausreichende Schirmung gewählt', why);
      });
    });
    return { vals: () => res().reduce((o, x) => { o[x.c.key] = { req: x.req, kein: x.o.kein.snr, eine: x.o.eine.snr, beide: x.o.beide.snr, ro: x.c.ctl.ro, f: x.c.ctl.f }; return o; }, {}), text, table, hint, choices, check, CASES, res, minimal, start: () => S('kopplung', base(CASES[0])), sol: () => Object.assign(S('kopplung', base(CASES[0])), { choices: CASES.reduce((o, c, i) => { o[c.key] = minimal(res()[i]); return o; }, {}) }) };
  })();

  /* ====================================================================== em7: Brummen im Audiokabel */
  const M7 = (() => {
    const BASE = Object.assign(presetOf('kopplung', 'audio'), { snrReq: 20 });
    const OWN = ['loop', 'schirm', 'sym', 'twist', 'gem', 'uNutz', 'len'];
    const RATIO = 0.1;                                                  // Vorgabe: uBrumm hoechstens 10 % des Nutzsignals; Musterloesung (Schleife auftrennen) liefert 0 mV, Alternative symmetrisch 0,15 mV
    const vals = () => once('v7', () => {
      const s0 = snap('kopplung', fullCtl('kopplung', BASE)), s1 = snap('kopplung', fullCtl('kopplung', Object.assign({}, BASE, { loop: false }))), s2 = snap('kopplung', fullCtl('kopplung', Object.assign({}, BASE, { sym: 'sym' })));
      const un = BASE.uNutz * 1000;
      return { ub0: s0.m.uBrumm, un, thr: RATIO * un, snr0: s0.m.snr, snr1: s1.m.snr, ub1: s1.m.uBrumm, ub2: s2.m.uBrumm, snr2: s2.m.snr, req: BASE.snrReq, f: BASE.f, len: BASE.len, dug: BASE.dUg };
    });
    const text = () => { const v = vals(); return 'Ein Mikrofonkabel von ' + f(v.len, 0) + ' m Länge (unsymmetrisch, ' + f(BASE.ro, 0) + ' Ω) liegt neben einer Netzleitung und ist an beiden Enden geerdet: Die Masseschleife erzeugt ein Brummen mit ' + f(v.f, 0) + ' Hz, der Prüfstand misst uBrumm = ' + f(v.ub0, 1) + ' mV bei einem Nutzsignal von ' + f(v.un, 0) +
      ' mV (Störabstand ' + f(v.snr0, 1) + ' dB). Beseitige das Brummen, ohne das Nutzsignal zu ändern: uBrumm darf höchstens ' + f(100 * RATIO, 0) + ' % des Nutzsignals betragen (' + f(v.thr, 2) + ' mV), und der Störabstand soll mindestens ' + f(v.req, 0) + ' dB erreichen (Vorgabe der Aufgabe).'; };
    const hint = () => { const v = vals(); return [
      'Das Brummen entsteht in der Masseschleife. Du kannst sie auftrennen oder ihre Wirkung am Eingang unterdrücken; das Nutzsignal und die Netzleitung gehören zur Aufgabe.',
      'Du brauchst uBrumm ≤ ' + f(v.thr, 2) + ' mV und Störabstand ≥ ' + f(v.req, 0) + ' dB. Ein Schirm allein senkt das Brummen nicht; die symmetrische Übertragung unterdrückt es um 60 dB, ohne die Schleife aufzutrennen.',
      'Musterlösung: Masseschleife auftrennen (loop aus). uBrumm sinkt von ' + f(v.ub0, 1) + ' mV auf ' + f(v.ub1, 1) + ' mV, der Störabstand steigt von ' + f(v.snr0, 1) + ' dB auf ' + f(v.snr1, 1) + ' dB. Alternative: symmetrische Übertragung (uBrumm ' + f(v.ub2, 2) + ' mV, ' + f(v.snr2, 1) + ' dB).']; };
    const check = mk('kopplung', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'kopplung', OWN, BASE), sim = snap('kopplung', eff);
      inputRow(c, r, sim, a, 'kopplung');
      setRow(r, 'kopplung', eff, [{ key: 'uNutz', want: BASE.uNutz, tol: 1e-6 }], 'Das Nutzsignal ist unverändert (' + f(v.un, 0) + ' mV)');
      r(sim.m.uBrumm <= v.thr * (1 + 1e-9), 'Die Brummspannung uBrumm ist höchstens ' + f(v.thr, 2) + ' mV', 'uBrumm ist ' + f(sim.m.uBrumm, 2) + ' mV und damit größer als ' + f(v.thr, 2) + ' mV.');
      r(sim.m.snr >= v.req - 1e-9, 'Der Störabstand ist mindestens ' + f(v.req, 0) + ' dB', 'Der Störabstand ist ' + f(sim.m.snr, 1) + ' dB; verlangt sind ' + f(v.req, 0) + ' dB.');
    });
    return { vals, text, hint, check, OWN, BASE, RATIO, start: () => S('kopplung', BASE), sol: () => S('kopplung', Object.assign({}, BASE, { loop: false })) };
  })();

  /* ====================================================================== em8: Rechnen: Schleifenflaeche, induzierte Spannung, kapazitiver Teiler */
  const M8 = Object.assign(calcModule([['schleife', 1], ['uInd', 1], ['kapTeiler', 1]], {
    labels: ['Schleifenfläche', 'induzierte Spannung', 'kapazitiver Spannungsteiler'],
    h0: 'Die Schleifenfläche ist Länge mal Höhe (A = b·h). In einer Schleife der Fläche A, die senkrecht in einem Wechselfeld steht, wird û = 2π·f·B̂·A induziert; B = µ0·H. Der kapazitive Teiler lautet UN = Us·Cm/(Cm + Cg).',
    h1: 'Achte auf die Einheiten: cm² sind 10⁻⁴ m², µT sind 10⁻⁶ T, pF sind 10⁻¹² F. Beim Teiler steht im Nenner die Summe Cm + Cg, bei der Induktion der Faktor 2π.'
  }), { text: () => 'Rechne drei Kopplungsaufgaben: die Fläche einer Leiterschleife, die in ihr induzierte Spannung und die Störspannung, die ein kapazitiver Spannungsteiler liefert. Gib jedes Ergebnis in der angegebenen Einheit ein; du kannst den Rechner im Tab „Rechnen“ benutzen.' });

  /* ====================================================================== em9: Gegentakt-Pegel und fehlende Oberwellen */
  const M9 = (() => {
    const N = 5, NMAX = 12;
    const BASE = {};
    const st = () => once('s9', () => snap('quelle', fullCtl('quelle', BASE)));
    const lines = view => U.lineAt(st().rig, N, view);
    const missing = () => { const sp = U.spectrumOf(st().rig), fs = st().rig.getControl('fs'), out = []; for (let n = 1; n <= NMAX; n++) { const l = sp.lines.find(x => Math.abs(x.f - n * fs) < 1e-3 * fs); if (!l || l.L <= sp.floor + 1) out.push(n); } return out; };
    const classify = a => {
      const ev = [], od = [], dr = [];
      for (let n = 1; n <= NMAX; n++) { if (n % 2 === 0) ev.push(n); else od.push(n); if (n % 3 === 0) dr.push(n); }
      const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
      if (!a.length) return 'keine'; if (same(a, ev)) return 'gerade'; if (same(a, od)) return 'ungerade'; if (same(a, dr)) return 'dritte'; return 'andere';
    };
    const OPT = [{ value: 'ungerade', label: 'die ungeraden Oberwellen (n = 3, 5, 7, …)' }, { value: 'gerade', label: 'die geraden Oberwellen (n = 2, 4, 6, …)' }, { value: 'dritte', label: 'jede dritte Oberwelle (n = 3, 6, 9, …)' }, { value: 'keine', label: 'keine, alle Oberwellen sind vorhanden' }];
    const vals = () => { const g = lines('gg'), s = lines('sum'), fs = st().rig.getControl('fs'); return { fs: fs / 1000, f5: N * fs / 1000, lgg: g.L, lsum: s.L, l3: U.lineAt(st().rig, 3, 'gg').L, l7: U.lineAt(st().rig, 7, 'gg').L, duty: st().rig.getControl('duty'), tol: 2 }; };
    const text = () => { const v = vals(); return 'Die Störquelle schaltet mit fs = ' + f(v.fs, 0) + ' kHz und dem Tastverhältnis D = ' + f(v.duty, 0) + ' % (Voreinstellung „Netzteil 325 V“). Öffne im Prüfstand das Spektrum und lies den Gegentakt-Pegel der ' + N + '. Oberwelle (' + f(v.f5, 0) + ' kHz) in dBµV ab. Außerdem: Welche Oberwellen fehlen bei diesem Tastverhältnis im Spektrum (betrachte n = 1 bis ' + NMAX + ')?'; };
    const hint = () => { const v = vals(); return [
      'Der Gegentakt-Pegel steht im Spektrum bei der Frequenz n · fs; schalte die Ansicht auf Gegentakt (GG). Zähle die Linien durch: Welche Vielfachen von fs sind nicht da?',
      'Die ' + N + '. Oberwelle liegt bei ' + f(v.f5, 0) + ' kHz. Bei D = ' + f(v.duty, 0) + ' % verschwinden die Linien, bei denen n · D eine ganze Zahl ist.',
      'Musterlösung: Gegentakt-Pegel der ' + N + '. Oberwelle ' + f(v.lgg, 1) + ' dBµV (die Summe aus Gleichtakt und Gegentakt liegt bei ' + f(v.lsum, 1) + ' dBµV). Es fehlen n = ' + missing().join(', ') + '.']; };
    const ask = { label: 'Gegentakt-Pegel der ' + N + '. Oberwelle', unit: 'dBµV' };
    const choices = () => [{ key: 'fehlen', q: 'Welche Oberwellen fehlen bei diesem Tastverhältnis?', options: OPT }];
    const check = mk('quelle', [], (c, r, a) => {
      const v = vals(), got = choiceOf(a, 'fehlen'), none = got === undefined || got === null || got === '', cls = classify(missing()), hit = none ? null : OPT.find(y => String(y.value) === String(got));
      numRow(r, U.numAns(a), { label: 'Gegentakt-Pegel der ' + N + '. Oberwelle (dBµV)', refs: [{ v: v.lgg }, { v: v.lsum }], absTol: v.tol, unit: 'dBµV', digits: 1, wrong: [
        { v: v.l3, msg: 'Das ist der Gegentakt-Pegel der 3. Oberwelle (' + f(3 * v.fs, 0) + ' kHz), nicht der 5.' }, { v: v.l7, msg: 'Das ist der Gegentakt-Pegel der 7. Oberwelle (' + f(7 * v.fs, 0) + ' kHz), nicht der 5.' }] });
      r(!none && String(got) === cls, 'Die fehlenden Oberwellen richtig angegeben', none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + 'Im Spektrum der Aufgabe fehlen für n = 1 bis ' + NMAX + ' die Linien n = ' + (missing().join(', ') || '–') + '.');
    });
    return { vals, text, hint, ask, choices, check, classify, missing, start: () => S('quelle', BASE), sol: () => Object.assign(S('quelle', BASE), { value: vals().lgg, choices: { fehlen: classify(missing()) } }) };
  })();

  /* ====================================================================== em10: Viertelwellen-Resonanz und Marge */
  const M10 = (() => {
    const BASE = { fclk: 5e7, len: 1.5, tr: 2e-9, kcm: -70, kabel: 'ungeschirmt', ferrit: 'kein', r: 3, klasse: 'B' };
    const OWN = ['fclk', 'tr', 'kcm', 'len', 'kabel', 'ferrit'];
    const SOL = { kabel: 'geschirmt360' };
    const vals = () => once('v10', () => {
      const C = CORE(), s0 = snap('abstrahlung', fullCtl('abstrahlung', BASE)), s1 = snap('abstrahlung', fullCtl('abstrahlung', Object.assign({}, BASE, SOL))), s2 = snap('abstrahlung', fullCtl('abstrahlung', Object.assign({}, BASE, { ferrit: 'x2' })));
      const fr = C.antenna.resonance(BASE.len, 1) / 1e6, c0 = C.C0;
      return { fr, fr3: C.antenna.resonance(BASE.len, 2) / 1e6, frHalf: c0 / (2 * BASE.len) / 1e6, fr3e8: 3e8 / (4 * BASE.len) / 1e6, len: BASE.len, fclk: BASE.fclk / 1e6, m0: s0.a.margin, m1: s1.a.margin, m2: s2.a.margin, e0: s0.m.eMax, e1: s1.m.eMax, req: 6, tol: 0.05 };
    });
    const text = () => { const v = vals(); return 'Ein ' + f(v.len, 1) + ' m langes ungeschirmtes Kabel hängt an einem Gerät mit ' + f(v.fclk, 0) + ' MHz Takt. Gib die erste Viertelwellen-Resonanz des Kabels an (Toleranz ' + f(100 * v.tol, 0) + ' %, das Modell rechnet mit Verkürzungsfaktor 1) und bringe die Marge zur Übungsgrenzlinie auf mindestens ' + f(v.req, 0) + ' dB (Ampel grün), ohne den Takt oder die Kabellänge zu ändern. Am Start ist die Marge ' + f(v.m0, 1) + ' dB.'; };
    const hint = () => { const v = vals(); return [
      'Ein Kabel strahlt am besten bei der Frequenz, bei der es eine Viertelwellenlänge lang ist: f = c/(4·ℓ). Gegen die Abstrahlung helfen ein geschirmtes Kabel, ein Ferrit oder ein kleinerer Gleichtaktanteil.',
      'Die Resonanz liegt bei f = c/(4·ℓ) = ' + f(v.fr, 1) + ' MHz. Du brauchst eine Marge von mindestens ' + f(v.req, 0) + ' dB; am Start sind es ' + f(v.m0, 1) + ' dB.',
      'Musterlösung: Resonanz ' + f(v.fr, 1) + ' MHz; Kabel „geschirmt, 360° angebunden“: Die Marge steigt auf ' + f(v.m1, 1) + ' dB. Auch der Ferrit mit 200 Ω bei 100 MHz reicht knapp (' + f(v.m2, 1) + ' dB).']; };
    const ask = { label: 'Erste Viertelwellen-Resonanz des Kabels', unit: 'MHz' };
    const check = mk('abstrahlung', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'abstrahlung', OWN, BASE), sim = snap('abstrahlung', eff);
      inputRow(c, r, sim, a, 'abstrahlung');
      setRow(r, 'abstrahlung', eff, [{ key: 'fclk', want: BASE.fclk }, { key: 'len', want: BASE.len, tol: 1e-6 }], 'Takt und Kabellänge sind unverändert');
      const ok = sim.a && sim.a.ampel === 'gruen';
      r(ok, 'Die Ampel steht auf grün (Marge mindestens ' + f(v.req, 0) + ' dB)', 'Die Ampel zeigt ' + (sim.a ? AMP[sim.a.ampel] || sim.a.ampel : '–') + ', die Marge beträgt ' + f(sim.a ? sim.a.margin : NaN, 1) + ' dB; verlangt sind mindestens ' + f(v.req, 0) + ' dB.');
      numRow(r, U.numAns(a), { label: 'Erste Viertelwellen-Resonanz (MHz)', refs: [{ v: v.fr }, { v: v.fr3e8 }], tol: v.tol, unit: 'MHz', digits: 1, wrong: [
        { v: v.frHalf, msg: 'Das ist die Halbwellen-Resonanz c/(2·ℓ). Eine Viertelwelle ist halb so lang: c/(4·ℓ).' }, { v: v.fr3, msg: 'Das ist die nächste Resonanz (3·c/(4·ℓ)), nicht die erste.' }] });
    });
    return { vals, text, hint, ask, check, OWN, BASE, SOL, start: () => S('abstrahlung', BASE), sol: () => Object.assign(S('abstrahlung', Object.assign({}, BASE, SOL)), { value: vals().fr }) };
  })();

  /* ====================================================================== em11: Flanke langsamer machen */
  const M11 = (() => {
    const BASE = {};                                                    // Voreinstellung Netzteil 325 V (Standardwerte des Prüfstands)
    const OWN = ['u', 'fs', 'duty', 'rg', 'cp', 'isw', 'idm', 'snub', 'rsn', 'csn', 'ferrit', 'jitter'];
    const DROP = 10;                                                    // Vorgabe der Aufgabe: mindestens 10 dB weniger; aus Musterloesung Rg 36 Ohm: 13,9 dB, Reserve 3,9 dB (Stand 2026-10-22)
    const PSW = 0.68;                                                   // Vorgabe der Aufgabe: Schaltverlust hoechstens 0,68 W; aus Musterloesung (0,543 W) mal 1,25, Reserve 25 %
    const RG = 36, SLOWER = 1.5;                                        // Musterloesung; die Flanke muss mindestens 1,5-mal so lang werden wie am Start
    const st = o => snap('quelle', fullCtl('quelle', Object.assign({}, BASE, o || {})));
    const vals = () => once('v11', () => { const s0 = st(), s1 = st({ rg: RG }); return { l0: bandL(s0).L, l1: bandL(s1).L, thrL: bandL(s0).L - DROP, drop: DROP, drop1: bandL(s0).L - bandL(s1).L, p0: s0.m.pSw, p1: s1.m.pSw, pmax: PSW, rg0: s0.rig.getControl('rg'), rg1: RG, tr0: s0.m.tr, tr1: s1.m.tr, u: s0.rig.getControl('u'), fs: s0.rig.getControl('fs') / 1000, fa: BAND[0] / 1e6, fb: BAND[1] / 1e6, fl0: bandL(s0).f / 1e6, slower: SLOWER, duty: s0.rig.getControl('duty') }; });
    const text = () => { const v = vals(); return 'Ein Netzteil schaltet ' + f(v.u, 0) + ' V mit fs = ' + f(v.fs, 0) + ' kHz (Rg = ' + f(v.rg0, 0) + ' Ω). Die höchste Linie im Bereich von ' + f(v.fa, 0) + ' bis ' + f(v.fb, 0) + ' MHz (Spitzenwert am Messeingang der Netznachbildung) liegt bei ' + f(v.l0, 1) + ' dBµV, der Schaltverlust ist ' + f(v.p0, 2) +
      ' W. Senke diese Linie durch eine Flankenmaßnahme um mindestens ' + f(v.drop, 0) + ' dB. Der Schaltverlust darf höchstens ' + f(v.pmax, 2) + ' W betragen (Vorgabe der Aufgabe), die Schaltspannung und die Schaltfrequenz bleiben unverändert. Bei D = ' + f(v.duty, 0) + ' % gibt es nur Linien bei ungeraden Vielfachen von fs, und der Pegel einzelner Linien schwankt an den Nullstellen des Spektrums; geprüft wird deshalb die höchste Linie im ganzen Bereich.'; };
    const hint = () => { const v = vals(); return [
      'Eine langsamere Flanke (größerer Gate-Widerstand) senkt die hohen Oberwellen, kostet aber Schaltverlust. Beobachte beides in den Messgeräten.',
      'Gesucht: höchste Linie von ' + f(v.fa, 0) + ' bis ' + f(v.fb, 0) + ' MHz höchstens ' + f(v.thrL, 1) + ' dBµV (Start ' + f(v.l0, 1) + ' dBµV) und Schaltverlust höchstens ' + f(v.pmax, 2) + ' W (Start ' + f(v.p0, 2) + ' W). Der Pegel einzelner Linien hängt an den Nullstellen des Spektrums und fällt nicht gleichmäßig mit Rg.',
      'Musterlösung: Rg = ' + f(v.rg1, 0) + ' Ω. Die Flanke wird ' + f(v.tr1, 1) + ' ns lang (Start ' + f(v.tr0, 1) + ' ns), die höchste Linie sinkt um ' + f(v.drop1, 1) + ' dB auf ' + f(v.l1, 1) + ' dBµV, der Schaltverlust steigt auf ' + f(v.p1, 2) + ' W.']; };
    const check = mk('quelle', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'quelle', OWN, BASE), sim = snap('quelle', eff), b = sim.ok ? bandL(sim) : null;
      inputRow(c, r, sim, a, 'quelle');
      setRow(r, 'quelle', eff, [{ key: 'u', want: v.u }, { key: 'fs', want: v.fs * 1000, tol: 1e-6 }], 'Schaltspannung und Schaltfrequenz sind unverändert');
      r(sim.m.tr >= v.tr0 * v.slower, 'Die Flanke ist deutlich langsamer geworden (Anstiegszeit mindestens ' + f(v.slower, 1) + '-mal so lang wie am Start)', 'Die Anstiegszeit beträgt ' + f(sim.m.tr, 1) + ' ns, am Start waren es ' + f(v.tr0, 1) + ' ns. Die Aufgabe verlangt eine Flankenmaßnahme, kein anderes Mittel.');
      const dr = b ? v.l0 - b.L : NaN;
      r(fin(dr) && dr >= v.drop - 1e-9, 'Die höchste Linie von ' + f(v.fa, 0) + ' bis ' + f(v.fb, 0) + ' MHz liegt mindestens ' + f(v.drop, 0) + ' dB unter dem Startwert', 'Die höchste Linie in diesem Bereich liegt bei ' + f(b ? b.L : NaN, 1) + ' dBµV, am Start waren es ' + f(v.l0, 1) + ' dBµV: ' + (dr > 0 ? 'nur ' + f(dr, 1) + ' dB weniger' : 'nicht weniger') + ', verlangt sind ' + f(v.drop, 0) + ' dB.');
      r(sim.m.pSw <= v.pmax * (1 + 1e-9), 'Der Schaltverlust ist höchstens ' + f(v.pmax, 2) + ' W', 'Der Schaltverlust beträgt ' + f(sim.m.pSw, 2) + ' W und liegt über der Vorgabe von ' + f(v.pmax, 2) + ' W: Die Flanke ist zu langsam.');
    });
    return { vals, text, hint, check, OWN, BASE, DROP, PSW, RG, start: () => S('quelle', BASE), sol: () => S('quelle', Object.assign({}, BASE, { rg: RG })) };
  })();

  /* ====================================================================== em12: Snubber dimensionieren */
  const M12 = (() => {
    const BASE = {};
    const OWN = ['snub', 'rsn', 'csn'];
    const BUMP = 3;                                                     // Vorgabe der Aufgabe: Ring-Buckel hoechstens 3 dB
    const MUSTER = { snub: 'ein', rsn: 39, csn: 1e-10 };                // Musterloesung (Standardwerte der Anlage)
    const PCAP = 1.25;                                                  // Reserve 25 % auf den Snubber-Verlust der Musterloesung
    const st = o => snap('quelle', fullCtl('quelle', Object.assign({}, BASE, o || {})));
    const vals = () => once('v12', () => { const s0 = st(), s1 = st(MUSTER); return { b0: s0.m.ringBump, bmax: BUMP, b1: s1.m.ringBump, ps1: s1.m.pSn, pmax: Math.ceil(100 * PCAP * s1.m.pSn - 1e-9) / 100, fr: s0.m.fr, rs: MUSTER.rsn, cs: MUSTER.csn * 1e12, pw: s0.m.pSw }; });
    const text = () => { const v = vals(); return 'Die Störquelle schwingt nach jeder Flanke bei fr = ' + f(v.fr, 1) + ' MHz nach (Ring-Buckel ' + f(v.b0, 1) + ' dB). Dimensioniere einen Snubber (Rs und Cs) so, dass der Ring-Buckel höchstens ' + f(v.bmax, 0) + ' dB beträgt. Der Verlust im Snubber darf höchstens ' + f(v.pmax, 2) + ' W betragen (Vorgabe der Aufgabe); alle anderen Werte der Quelle bleiben.'; };
    const hint = () => { const v = vals(); return [
      'Ein Snubber dämpft den Schwingkreis: Der Widerstand nimmt die Schwingenergie auf, der Kondensator koppelt ihn an den Schwingkreis. Der Verlust wächst mit der Kapazität.',
      'Gesucht: Ring-Buckel ≤ ' + f(v.bmax, 0) + ' dB (Start ' + f(v.b0, 1) + ' dB) und Snubber-Verlust ≤ ' + f(v.pmax, 2) + ' W. Ein zu kleiner Kondensator dämpft kaum, ein zu großer verbraucht viel Leistung.',
      'Musterlösung: Snubber ein, Rs = ' + f(v.rs, 0) + ' Ω, Cs = ' + f(v.cs, 0) + ' pF. Der Buckel sinkt auf ' + f(v.b1, 2) + ' dB, der Snubber verbraucht ' + f(v.ps1, 2) + ' W.']; };
    const check = mk('quelle', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'quelle', OWN, BASE), sim = snap('quelle', eff);
      inputRow(c, r, sim, a, 'quelle');
      r(eff.snub === 'ein', 'Der Snubber ist eingeschaltet', 'Der Snubber ist ausgeschaltet; der Ring-Buckel beträgt ' + f(sim.m.ringBump, 1) + ' dB.');
      r(sim.m.ringBump <= v.bmax + 1e-9, 'Der Ring-Buckel ist höchstens ' + f(v.bmax, 0) + ' dB', 'Der Ring-Buckel beträgt ' + f(sim.m.ringBump, 1) + ' dB und liegt über ' + f(v.bmax, 0) + ' dB: Der Snubber dämpft zu wenig.');
      r(sim.m.pSn <= v.pmax * (1 + 1e-9), 'Der Verlust im Snubber ist höchstens ' + f(v.pmax, 2) + ' W', 'Der Snubber verbraucht ' + f(sim.m.pSn, 2) + ' W und liegt über der Vorgabe von ' + f(v.pmax, 2) + ' W: Der Kondensator ist zu groß.');
    });
    return { vals, text, hint, check, OWN, BASE, BUMP, MUSTER, PCAP, start: () => S('quelle', BASE), sol: () => S('quelle', Object.assign({}, BASE, MUSTER)) };
  })();

  /* ====================================================================== em13: Knickfrequenzen und Pegel der Einhuellenden */
  const M13 = Object.assign(calcModule([['knick', 1], ['knick', 3], ['hnw', 2]], {
    labels: ['Knickfrequenz f1', 'Knickfrequenz f1 (andere Einheit)', 'Pegel der Einhüllenden'],
    h0: 'Die Einhüllende des Trapezspektrums hat zwei Knickfrequenzen: f1 = 1/(π·τ) und f2 = 1/(π·tr). Davor ist sie flach, zwischen f1 und f2 fällt sie mit 20 dB je Dekade, danach mit 40 dB je Dekade.',
    h1: 'Achte auf die Einheit der Antwort (kHz oder MHz) und auf den Effektwert: Der Pegel in dBµV bezieht sich auf den Effektwert (Spitzenwert durch √2). Faktor 2 und π nicht vergessen.'
  }), { text: () => 'Berechne für Rechtecksignale die Knickfrequenzen der Einhüllenden und den Pegel der Einhüllenden bei einer Oberwelle. Gib jedes Ergebnis in der angegebenen Einheit ein; du kannst den Rechner im Tab „Rechnen“ benutzen.' });

  /* ====================================================================== em14: Y-Kondensator */
  const M14 = (() => {
    const BASE = { topo: 'pi', cx: 1e-7, cy: 4.7e-9, drossel: 'd10', ld: 0, lead: 0.015, ferrit: false, iLast: 1, klasse: 'B', leakReq: 0.3 };
    const OWN = ['topo', 'cx', 'cy', 'drossel', 'ld', 'lead', 'ferrit', 'iLast'];
    const MUSTER = { cy: 2.2e-9 };
    const RES = 3;                                                      // Reserve 3 dB auf die Gleichtakt-Daempfung der Musterloesung (Stand 2026-10-22)
    const vals = () => once('v14', () => { const s0 = snap('filter', fullCtl('filter', BASE)), s1 = snap('filter', fullCtl('filter', Object.assign({}, BASE, MUSTER))), s2 = snap('filter', fullCtl('filter', Object.assign({}, BASE, { cy: 0 }))); return { leak0: s0.m.leak, req: BASE.leakReq, gt0: s0.m.ilGT1M, gt1: s1.m.ilGT1M, thr: s1.m.ilGT1M - RES, leak1: s1.m.leak, gt2: s2.m.ilGT1M, cy1: MUSTER.cy * 1e9, cy0: BASE.cy * 1e9, res: RES }; });
    const text = () => { const v = vals(); return 'Im π-Filter eines Netzteils (Cx = ' + f(BASE.cx * 1e9, 0) + ' nF, Drossel ' + f(10, 0) + ' mH) sitzt ein Y-Kondensator von ' + f(v.cy0, 1) + ' nF. Der Ableitstrom nach Schutzleiter beträgt ' + f(v.leak0, 3) + ' mA. Die Aufgabe verlangt einen Ableitstrom von höchstens ' + f(v.req, 1) +
      ' mA (Vorgabe der Aufgabe, kein Normwert). Wähle die Bauteile so, dass diese Vorgabe erfüllt ist und die Gleichtakt-Dämpfung bei 1 MHz möglichst groß bleibt: Die Dämpfung soll mindestens ' + f(v.thr, 1) + ' dB betragen (das sind ' + f(v.res, 0) + ' dB weniger als mit dem größten zulässigen Y-Kondensator bei sonst gleichem Filter).'; };
    const hint = () => { const v = vals(); return [
      'Der Ableitstrom wächst mit der Kapazität des Y-Kondensators, und die Gleichtakt-Dämpfung wächst mit ihr ebenfalls. Gesucht ist die größte Kapazität, die die Vorgabe noch einhält.',
      'Am Start (' + f(v.cy0, 1) + ' nF) fließen ' + f(v.leak0, 3) + ' mA, erlaubt sind ' + f(v.req, 1) + ' mA. Mit der nächstkleineren Stufe sind es ' + f(v.leak1, 3) + ' mA bei ' + f(v.gt1, 1) + ' dB Gleichtakt-Dämpfung; ganz ohne Y-Kondensator nur ' + f(v.gt2, 1) + ' dB.',
      'Musterlösung: Cy = ' + f(v.cy1, 1) + ' nF. Ableitstrom ' + f(v.leak1, 3) + ' mA, Gleichtakt-Dämpfung bei 1 MHz ' + f(v.gt1, 1) + ' dB. Auch 1 nF genügt (Untergrenze ' + f(v.thr, 1) + ' dB).']; };
    const check = mk('filter', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'filter', OWN, BASE), sim = snap('filter', eff);
      inputRow(c, r, sim, a, 'filter');
      r(sim.m.leak <= v.req + 1e-9, 'Der Ableitstrom ist höchstens ' + f(v.req, 1) + ' mA (Vorgabe der Aufgabe)', 'Der Ableitstrom beträgt ' + f(sim.m.leak, 3) + ' mA und liegt über der Vorgabe von ' + f(v.req, 1) + ' mA.');
      r(sim.m.ilGT1M >= v.thr - 1e-9, 'Die Gleichtakt-Dämpfung bei 1 MHz ist mindestens ' + f(v.thr, 1) + ' dB', 'Die Gleichtakt-Dämpfung bei 1 MHz beträgt nur ' + f(sim.m.ilGT1M, 1) + ' dB; verlangt sind mindestens ' + f(v.thr, 1) + ' dB.');
    });
    return { vals, text, hint, check, OWN, BASE, MUSTER, RES, start: () => S('filter', BASE), sol: () => S('filter', Object.assign({}, BASE, MUSTER)) };
  })();

  /* ====================================================================== em15: Eigenresonanz der Drossel */
  const M15 = (() => {
    const F = 20e6, DR = ['d1', 'd3', 'd10', 'd22'];
    const BASE = { topo: 'pi', cx: 1e-7, cy: 2.2e-9, drossel: 'd22', ld: 0, lead: 0.015, ferrit: false, iLast: 0.1, klasse: 'B', leakReq: 0.3 };
    const OWN = ['drossel', 'iLast'];
    const il = (d, extra) => kit().il(Object.assign({ topo: 'pi', cx: BASE.cx, cy: BASE.cy, drossel: d, ld: 0, lead: BASE.lead, ferrit: false, iLast: BASE.iLast }, extra || {}), F);
    const vals = () => once('v15', () => {
      const K = kit(), s = snap('filter', fullCtl('filter', BASE)), p = K.part('d22'), fr = K.fresDr('d22').f / 1000, t = {};
      DR.forEach(d => { t[d] = { l: K.part(d).L * 1000, gt: il(d).gt, fres: K.fresDr(d).f / 1000 }; });
      return { f: F / 1e6, fres: fr, fres2pi: 1 / Math.sqrt(p.L * p.Cw) / 1000, fresX: fr * 1000 / 1e6, l: p.L * 1000, gt22: t.d22.gt, gt1: t.d1.gt, gt3: t.d3.gt, gt10: t.d10.gt, sat: s.m.satur, cy: BASE.cy * 1e9, gtCy47: il('d22', { cy: 4.7e-9 }).gt, gtCy22: il('d22').gt, iLast: BASE.iLast, tol: 0.1, t };
    });
    const OPT = [
      { value: 'klein', label: 'Die Induktivität ist zu klein.' },
      { value: 'satur', label: 'Der Kern ist gesättigt, die Induktivität ist eingebrochen.' },
      { value: 'kap', label: 'Oberhalb ihrer Eigenresonanz wirkt die Windungskapazität: Die Drossel verhält sich wie ein Kondensator.' },
      { value: 'cy', label: 'Der Y-Kondensator ist zu klein.' }];
    const right = () => { const v = vals(); return v.f * 1000 > v.fres && v.gt1 > v.gt22 ? 'kap' : null; };
    const text = () => { const v = vals(); return 'Ein Netzfilter (π, Cx = ' + f(BASE.cx * 1e9, 0) + ' nF, Cy = ' + f(v.cy, 1) + ' nF) enthält die Drossel ' + f(v.l, 0) + ' mH (d22), der Laststrom ist ' + f(v.iLast, 1) + ' A. Bei ' + f(v.f, 0) + ' MHz dämpft sie den Gleichtakt kaum: ' + f(v.gt22, 1) + ' dB. Finde den Grund (die Tabelle zeigt die Drosseln des Labors) und gib die Eigenresonanz der Drossel d22 in kHz an; im Prüfstand zeigt ein Messgerät sie bei der Drossel d22.'; };
    const table = () => { const v = vals(); return tbl('Gleichtakt-Dämpfung bei ' + f(v.f, 0) + ' MHz (π-Filter, Cx ' + f(BASE.cx * 1e9, 0) + ' nF, Cy ' + f(v.cy, 1) + ' nF)', ['Drossel', 'Induktivität', 'Dämpfung bei ' + f(v.f, 0) + ' MHz'], DR.map(d => [d, f(v.t[d].l, 1) + ' mH', f(v.t[d].gt, 1) + ' dB'])); };
    const hint = () => { const v = vals(); return [
      'Vergleiche in der Tabelle die Drosseln: Dämpft die größte Induktivität am meisten? Jede Drossel hat zwischen ihren Windungen eine Kapazität; zusammen mit der Induktivität bildet sie einen Schwingkreis.',
      'Die Eigenresonanz ist f = 1/(2π·√(L·Cw)). Bei ' + f(v.f, 0) + ' MHz dämpft d1 mit ' + f(v.gt1, 1) + ' dB mehr als d22 mit ' + f(v.gt22, 1) + ' dB, obwohl sie eine kleinere Induktivität hat. Der Laststrom ' + f(v.iLast, 1) + ' A lässt die Induktivität bei ' + f(v.sat, 1) + ' % des Nennwerts.',
      'Musterlösung: Die Eigenresonanz von d22 liegt bei ' + f(v.fres, 1) + ' kHz, weit unter ' + f(v.f, 0) + ' MHz. Oberhalb davon wirkt die Windungskapazität: Die Drossel verhält sich wie ein Kondensator.']; };
    const ask = { label: 'Eigenresonanz der Drossel d22', unit: 'kHz' };
    const choices = () => [{ key: 'grund', q: 'Warum dämpft die Drossel d22 bei dieser Frequenz kaum?', options: OPT }];
    const check = mk('filter', OWN, (c, r, a) => {
      const v = vals(), got = choiceOf(a, 'grund'), none = got === undefined || got === null || got === '', hit = none ? null : OPT.find(y => String(y.value) === String(got));
      const why = { kap: '', satur: 'Der Laststrom beträgt nur ' + f(v.iLast, 1) + ' A; die Induktivität liegt dabei noch bei ' + f(v.sat, 1) + ' % des Nennwerts: Die Sättigung erklärt es nicht.',
        klein: 'Die Drossel d22 hat ' + f(v.l, 0) + ' mH und damit die größte Induktivität des Labors; die Drossel d1 mit ' + f(v.t.d1.l, 0) + ' mH dämpft bei ' + f(v.f, 0) + ' MHz mit ' + f(v.gt1, 1) + ' dB mehr als d22 mit ' + f(v.gt22, 1) + ' dB.',
        cy: 'Mit Cy = ' + f(4.7, 1) + ' nF dämpft die Anordnung bei ' + f(v.f, 0) + ' MHz nur ' + f(v.gtCy47, 1) + ' dB, mit Cy = ' + f(v.cy, 1) + ' nF sind es ' + f(v.gtCy22, 1) + ' dB: Ein größerer Y-Kondensator hilft hier nicht.' };
      r(!none && String(got) === right(), 'Der Grund ist richtig angegeben', none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + (hit ? why[hit.value] || '' : ''));
      numRow(r, U.numAns(a), { label: 'Eigenresonanz der Drossel d22 (kHz)', refs: [{ v: v.fres }], tol: v.tol, unit: 'kHz', digits: 1, wrong: [
        { v: v.fres2pi, msg: 'Du hast den Faktor 2π vergessen: f = 1/(2π·√(L·Cw)).' }, { v: v.t.d10.fres, msg: 'Das ist die Eigenresonanz der Drossel d10, nicht d22.' }, { v: v.t.d3.fres, msg: 'Das ist die Eigenresonanz der Drossel d3, nicht d22.' }] });
    });
    return { vals, text, table, hint, ask, choices, check, OWN, BASE, F, right, start: () => S('filter', BASE), sol: () => Object.assign(S('filter', BASE), { value: vals().fres, choices: { grund: right() } }) };
  })();

  /* ====================================================================== em16: Netzfilter auslegen */
  const M16 = (() => {
    const BASE = { topo: 'kein', cx: 1e-7, cy: 2.2e-9, drossel: 'ohne', ld: 0, lead: 0.015, ferrit: false, iLast: 1, klasse: 'B', leakReq: 0.3 };
    const OWN = ['topo', 'cx', 'cy', 'drossel', 'ld', 'lead', 'ferrit'];
    const MUSTER = { topo: 'pi', cx: 1e-6, cy: 2.2e-9, drossel: 'd3', ld: 5e-4, lead: 0.005, ferrit: true };     // Voreinstellung "gut" (bestes Filter allein)
    const SAT = 89.999;                                                 // Saettigung "mindestens 90 %" mit Toleranz: d10 bei 1 A hat 89,99999999999999 %
    const vals = () => once('v16', () => { const s0 = snap('filter', fullCtl('filter', BASE)), s1 = snap('filter', fullCtl('filter', Object.assign({}, BASE, MUSTER))); return { m0: s0.a.margin, a0: AMP[s0.a.ampel], m1: s1.a.margin, a1: AMP[s1.a.ampel], leak: s1.m.leak, req: BASE.leakReq, sat: s1.m.satur, satMin: 90, i: BASE.iLast, lmax1: s1.m.lMax, lmax0: s0.m.lMax }; });
    const text = () => { const v = vals(); return 'Ein Netzteil (Laststrom ' + f(v.i, 0) + ' A) soll an der Netznachbildung die Vorprüfung bestehen. Ohne Filter liegt der Spitzenwert bei ' + f(v.lmax0, 1) + ' dBµV und die Ampel steht auf ' + v.a0 + '. Lege ein Netzfilter aus, das die Ampel mindestens auf gelb bringt (der Spitzenwert liegt dann unter der Quasi-Spitzenwert-Grenzlinie; grün ist mit dem Filter allein nicht erreichbar). Der Ableitstrom darf höchstens ' +
      f(v.req, 1) + ' mA betragen (Vorgabe der Aufgabe), und die Drossel darf bei ' + f(v.i, 0) + ' A nicht in die Sättigung gehen: Die Induktivität der Drossel soll bei mindestens ' + f(v.satMin, 0) + ' % des Nennwerts bleiben.'; };
    const hint = () => { const v = vals(); return [
      'Ein π-Filter besteht aus Cx, Drossel und Cy. Cy wird vom Ableitstrom begrenzt, die Drossel vom Laststrom (Sättigung); Cx und kurze Anschlüsse helfen gegen den Gegentakt.',
      'Gesucht: Ampel mindestens gelb, Ableitstrom ≤ ' + f(v.req, 1) + ' mA, Induktivität ≥ ' + f(v.satMin, 0) + ' % bei ' + f(v.i, 0) + ' A. Grün ist mit dem Filter allein nicht zu erreichen: Die Musterlösung kommt auf eine Marge von ' + f(v.m1, 1) + ' dB (' + v.a1 + '); ohne Filter sind es ' + f(v.m0, 1) + ' dB.',
      'Musterlösung: π-Filter mit Cx = ' + f(MUSTER.cx * 1e6, 0) + ' µF, Cy = ' + f(MUSTER.cy * 1e9, 1) + ' nF, Drossel 3,3 mH, Differenzdrossel ' + f(MUSTER.ld * 1e6, 0) + ' µH, Anschlüsse ' + f(MUSTER.lead * 1000, 0) + ' mm und Ferrit. Marge ' + f(v.m1, 1) + ' dB (' + v.a1 + '), Ableitstrom ' + f(v.leak, 3) + ' mA, Induktivität ' + f(v.sat, 1) + ' %.']; };
    const check = mk('filter', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'filter', OWN, BASE), sim = snap('filter', eff);
      inputRow(c, r, sim, a, 'filter');
      const am = sim.a ? sim.a.ampel : null;
      r(am === 'gelb' || am === 'gruen', 'Die Ampel steht mindestens auf gelb', 'Die Ampel zeigt ' + (AMP[am] || '–') + ': ' + (sim.a ? sim.a.text : ''));
      r(sim.m.leak <= v.req + 1e-9, 'Der Ableitstrom ist höchstens ' + f(v.req, 1) + ' mA (Vorgabe der Aufgabe)', 'Der Ableitstrom beträgt ' + f(sim.m.leak, 3) + ' mA und liegt über der Vorgabe von ' + f(v.req, 1) + ' mA.');
      r(sim.m.satur >= SAT, 'Die Drossel sättigt bei ' + f(v.i, 0) + ' A nicht (Induktivität mindestens ' + f(v.satMin, 0) + ' %)', 'Die Induktivität liegt bei ' + f(sim.m.satur, 1) + ' % des Nennwerts, verlangt sind mindestens ' + f(v.satMin, 0) + ' %: Die Drossel ist für ' + f(v.i, 0) + ' A zu klein.');
    });
    return { vals, text, hint, check, OWN, BASE, MUSTER, SAT, start: () => S('filter', BASE), sol: () => S('filter', Object.assign({}, BASE, MUSTER)) };
  })();

  /* ====================================================================== Registrierung */
  function tk(head, M) {
    const t = Object.assign({}, head);
    const lazy = (name, get) => Object.defineProperty(t, name, { enumerable: true, configurable: true, get() { const v = get(); Object.defineProperty(t, name, { value: v, enumerable: true, configurable: true, writable: true }); return v; } });
    lazy('text', M.text); if (M.table) lazy('table', M.table); lazy('hint', M.hint);
    if (M.fields) lazy('fields', M.fields); if (M.choices) lazy('choices', M.choices);
    if (M.ask) t.ask = M.ask; if (M.consts) t.consts = M.consts;
    t.start = M.start; t.sol = M.sol; t.check = M.check; t.hintVals = M.vals;
    return t;
  }
  T.register([
    tk({ id: 'em1', lab: 'emv', cat: 'Grundlagen', title: 'Fünf Bedienelemente, drei Hebel', level: 1, rig: 'kopplung' }, M1),
    tk({ id: 'em2', lab: 'emv', cat: 'Grundlagen', title: 'Welche Kopplung dominiert?', level: 1, rig: 'kopplung' }, M2),
    tk({ id: 'em3', lab: 'emv', cat: 'Grundlagen', title: 'Rechnen in dB', level: 1 }, M3),
    tk({ id: 'em4', lab: 'emv', cat: 'Kopplung', title: 'Hochohmiger Eingang: 20 dB weniger', level: 1, rig: 'kopplung' }, M4),
    tk({ id: 'em5', lab: 'emv', cat: 'Kopplung', title: 'Relaisleitung verdrillen', level: 1, rig: 'kopplung' }, M5),
    tk({ id: 'em6', lab: 'emv', cat: 'Kopplung', title: 'Die passende Schirmung wählen', level: 2, rig: 'kopplung' }, M6),
    tk({ id: 'em7', lab: 'emv', cat: 'Kopplung', title: 'Brummen im Audiokabel', level: 2, rig: 'kopplung' }, M7),
    tk({ id: 'em8', lab: 'emv', cat: 'Kopplung', title: 'Schleife, Induktion und Teiler', level: 2 }, M8),
    tk({ id: 'em9', lab: 'emv', cat: 'Spektrum', title: 'Oberwellen ablesen', level: 1, rig: 'quelle' }, M9),
    tk({ id: 'em10', lab: 'emv', cat: 'Abstrahlung', title: 'Das Kabel als Antenne', level: 2, rig: 'abstrahlung' }, M10),
    tk({ id: 'em11', lab: 'emv', cat: 'Spektrum', title: 'Flanke langsamer machen', level: 2, rig: 'quelle' }, M11),
    tk({ id: 'em12', lab: 'emv', cat: 'Spektrum', title: 'Snubber dimensionieren', level: 2, rig: 'quelle' }, M12),
    tk({ id: 'em13', lab: 'emv', cat: 'Spektrum', title: 'Knickfrequenzen und Einhüllende', level: 3 }, M13),
    tk({ id: 'em14', lab: 'emv', cat: 'Filter', title: 'Y-Kondensator und Ableitstrom', level: 1, rig: 'filter' }, M14),
    tk({ id: 'em15', lab: 'emv', cat: 'Filter', title: 'Warum wirkt die Drossel nicht?', level: 2, rig: 'filter' }, M15),
    tk({ id: 'em16', lab: 'emv', cat: 'Filter', title: 'Ein Netzfilter auslegen', level: 2, rig: 'filter' }, M16)
  ]);
  /* Zugriff fuer Tests: Module mit Schwellwerten, Hilfsfunktionen */
  T.thresholds1 = () => ({ em4: { factor: M4.FACTOR }, em5: { factor: M5.FACTOR }, em7: { ratio: M7.RATIO }, em11: { drop: M11.DROP, pSw: M11.PSW, rg: M11.RG }, em12: { bump: M12.BUMP, cap: M12.PCAP }, em14: { reserve: M14.RES }, em16: { sat: M16.SAT } });
  T.modules1 = { M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15, M16 };
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks, modules: T.modules1 };
})(typeof window !== 'undefined' ? window : globalThis);
