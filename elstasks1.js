/* elstasks1.js - ELS-Lab: Aufgaben el1 bis el16 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4a.
 * Registrierung: ELS_TASKS.register([ ... ]) (ELS_TASKS und die Hilfsfunktionen ELS_TASKS.util kommen aus elsdata.js; elsdata.js VOR dieser Datei laden,
 * in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'elN', lab:'els', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), value?, fields?, choices?, fired? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert mindestens zwei absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Regeln (SPEC Abschnitte 8, 9 und 11):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus der Simulation (Pruefstaende) und ELS_CORE und stehen in hintVals() (Regel 1); text, table und hint werden erst
 *     beim ersten Zugriff gerechnet. ELS_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3. Rechnen nur ueber den Kern (exercise, grid, prot, rcd, body).
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde (Regel 2): Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert uebereinstimmt;
 *     Auswahlfragen nennen die Zahlen der Simulation und den Fachgrund aus dem Kern.
 *   - Grenzwerte stehen nur in ELS_CORE.limits (Status A im Text als Uebungswert); Vorgaben der Aufgabe (Zs, Betriebsstrom) stehen im Aufgabentext und als Steuerwert, nie als Normwert.
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (BASE), damit gleiche Eingaben gleiche Ergebnisse liefern.
 *   - Abweichungen von der SPEC: quelle/elslab/ABWEICHUNGEN.md, Abschnitt WP4a.
 * Uebungsanlage: Alle Zahlen sind Uebungswerte. Norm und Vorschrift massgeblich. Simulation: keine Anleitung fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const TT = () => { if (!root.ELS_TASKS) nodeReq('./elsdata.js'); return root.ELS_TASKS || null; };
  const T = TT();
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('elstasks1.js: elsdata.js fehlt, die Aufgaben el1 bis el16 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, mk = U.mk, inputRow = U.inputRow, numRow = U.numRow, snap = U.snap, effOf = U.effOf, setRow = U.setRow, fullCtl = U.fullCtl, cdef = U.cdef;
  const CORE = () => U.CORE();
  const f = (x, d) => U.fm(x, d == null ? 2 : d);
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const choiceOf = (a, k) => U.choiceOf(a, k);
  const S = (rig, over, extra) => Object.assign({ rig, controls: fullCtl(rig, over) }, extra || {});
  const lim = id => CORE().limit(id).value;
  const noChoice = g => g === undefined || g === null || g === '';
  const nums = s => (String(s).match(/-?\d+(?:,\d+)?/g) || []).map(x => parseFloat(x.replace(',', '.')));
  const U0 = () => CORE().const.U0;
  const RHO = () => CORE().const.rho;
  /* Kernuebung einer Art (kleinster passender Seed, deterministisch) */
  const exOf = (kind, pred, tag) => once('ex:' + kind + ':' + tag, () => { const s = U.seedFor(kind, pred, tag); return CORE().exercise(kind, s === null ? 1 : s); });
  /* Pruefzeile fuer eine Kernuebung; extras = [{ si, msg }]: zusaetzliche typische Fehler dieser Aufgabe (erst genannt, wenn der Wert zu ihnen passt) */
  function exRow(r, ex, raw, label, extras) {
    if (!ex || ex.ok === false || typeof ex.check !== 'function') { r(false, label, 'Die Übung konnte nicht erzeugt werden: ' + (ex && ex.why ? ex.why : 'Rechenkern fehlt.')); return false; }
    if (raw === null || raw === undefined) { r(false, label, 'Du hast keine Zahl eingetragen.'); return false; }
    let q; try { q = ex.check(raw); } catch (e) { q = { ok: false, text: 'Die Prüfung der Zahl ist fehlgeschlagen.' }; }
    let why = q.ok ? '' : q.text + (q.why ? ' ' + q.why : '');
    if (!q.ok && Array.isArray(extras)) {
      let p = null; try { p = CORE().parseQty(raw); } catch (e) { p = null; }
      if (p && isFinite(p.v)) {
        const v = p.hasUnit ? p.v : p.raw * ex.answer.scale, hit = extras.find(x => Math.abs(v - x.si) <= ex.answer.tol * Math.abs(x.si));
        if (hit) why = hit.msg + (q.why ? ' ' + q.why : '');
      }
    }
    r(!!q.ok, label, why);
    return !!q.ok;
  }

  /* ====================================================================== el1: welche Zone ist das? */
  const M1 = (() => {
    const CASES = [{ id: 'f1', u: 24, t: 1000 }, { id: 'f2', u: 50, t: 1000 }, { id: 'f3', u: 230, t: 1000 }, { id: 'f4', u: 230, t: 10 }];
    const BASE = { u: 230, typ: 'wechsel', haut: 'trocken', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 0 };
    const cases = () => once('c1', () => CASES.map(c => {
      const s = snap('koerper', fullCtl('koerper', Object.assign({}, BASE, { u: c.u, t: c.t })));
      return { id: c.id, u: c.u, t: c.t, ik: s.m.ik, zone: s.m.zone, rk: s.m.rk, name: CORE().body.zone(s.m.ik / 1000, c.t).name, flim: CORE().body.zoneCurve(c.t).flimmer * 1000 };
    }));
    const zones = () => once('z1', () => [0.0002, 0.005, 0.02, 0.1].map((i, k) => ({ value: k + 1, label: 'Zone ' + (k + 1) + ': ' + CORE().body.zone(i, 1000).name })));
    const label = c => c.id.replace('f', 'Fall ') + ' (' + f(c.u, 0) + ' V, trockene Haut, ' + f(c.t, 0) + ' ms)';
    const text = () => 'Eine Hand berührt einen Leiter, der Strom fließt von der Hand zum Fuß, die Haut ist trocken (Körperwiderstand ' + f(cases()[0].rk, 0) + ' Ω, Übungswert). Ordne den vier Fällen die Zone des Zonenbilds zu. Stelle die Fälle im Prüfstand „Stromwirkung auf den Körper“ ein (Spannung und Einwirkdauer) und lies Körperstrom und Zone ab: ' +
      cases().map(label).join('; ') + '.';
    const hint = () => { const c = cases(); return [
      'Berechne oder lies den Körperstrom ab (I = U / R_K) und vergleiche ihn im Zonenbild mit den Grenzen. Dieselbe Spannung kann je nach Einwirkdauer in einer anderen Zone liegen, weil die Flimmergrenze mit der Zeit sinkt.',
      c.map(x => x.id.replace('f', 'Fall ') + ': ' + f(x.ik, 1) + ' mA').join('; ') + '. Die Flimmergrenze liegt bei ' + f(c[2].t, 0) + ' ms bei ' + f(c[2].flim, 0) + ' mA, bei ' + f(c[3].t, 0) + ' ms bei ' + f(c[3].flim, 0) + ' mA.',
      'Musterlösung: ' + c.map(x => x.id.replace('f', 'Fall ') + ' → Zone ' + f(x.zone, 0)).join('; ') + '.'
    ]; };
    const choices = () => cases().map(c => ({ key: c.id, q: 'Welche Zone gehört zu ' + label(c) + '?', options: zones() }));
    const check = mk('koerper', [], (c, r, a) => {
      cases().forEach(x => {
        const got = choiceOf(a, x.id), none = noChoice(got), hit = none ? null : zones().find(y => String(y.value) === String(got));
        const dir = !hit ? '' : (+hit.value > x.zone ? ' Du hast die Zone zu hoch gewählt.' : +hit.value < x.zone ? ' Du hast die Zone zu niedrig gewählt.' : '');
        r(!none && +got === x.zone, label(x) + ': richtige Zone', none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt.' + dir : 'Deine Auswahl gehört nicht zu den Antworten.') +
          ' Der Körperstrom beträgt ' + f(x.ik, 1) + ' mA bei ' + f(x.t, 0) + ' ms (Flimmergrenze ' + f(x.flim, 0) + ' mA): Das ist Zone ' + f(x.zone, 0) + ', ' + x.name + '.');
      });
    });
    const sol = () => S('koerper', {}, { choices: cases().reduce((o, x) => { o[x.id] = x.zone; return o; }, {}) });
    return { vals: () => cases().reduce((o, x) => { o[x.id] = { u: x.u, t: x.t, ik: x.ik, zone: x.zone, flim: x.flim }; return o; }, { rk: cases()[0].rk }), text, hint, choices, check, start: () => S('koerper', {}), sol,
      wrong: () => [{ name: 'Zone zu hoch', answer: S('koerper', {}, { choices: cases().reduce((o, x) => { o[x.id] = Math.min(4, x.zone + 1); return o; }, {}) }) }, { name: 'Zone zu niedrig', answer: S('koerper', {}, { choices: cases().reduce((o, x) => { o[x.id] = Math.max(1, x.zone - 1); return o; }, {}) }) }] };
  })();

  /* ====================================================================== el2: Koerperstrom berechnen */
  const M2 = (() => {
    const ex = () => exOf('koerperStrom', e => e.given.U === 230 && e.given.rv === 1000, 'U230rv1000');
    const vals = () => once('v2', () => { const e = ex(); return { u: e.given.U, rk: e.given.rk, rv: e.given.rv, rges: e.given.rk + e.given.rv, ik: e.answer.value, ikOhneRv: e.given.U / e.given.rk * 1000, schritte: nums((e.steps || []).join(' ')), frage: nums(e.question) }; });
    const check = mk('koerper', [], (c, r, a) => { exRow(r, ex(), U.rawOf(a, 'value'), 'Körperstrom richtig berechnet', [{ si: ex().given.U / ex().given.rk, msg: 'Du hast den Übergangswiderstand vergessen: Er liegt mit dem Körperwiderstand in Reihe.' }]); });
    return { vals, check,
      text: () => ex().question + ' Du kannst das Ergebnis im Prüfstand „Stromwirkung auf den Körper“ prüfen (Haut „nass“ entspricht dem Rechenwert von ' + f(ex().given.rk, 0) + ' Ω). Gib den Strom in mA an.',
      ask: { label: 'Körperstrom', unit: 'mA' },
      hint: () => { const v = vals(), e = ex(); return [
        'Körperwiderstand und Übergangswiderstand liegen in Reihe: R_ges = R_K + R_v. Dann gilt I = U / R_ges. Achte auf die Einheit: mA oder A.',
        'Der Gesamtwiderstand beträgt ' + f(v.rges, 0) + ' Ω. Ohne den Übergangswiderstand wären es nur ' + f(v.rk, 0) + ' Ω und ' + f(v.ikOhneRv, 0) + ' mA: Das wäre zu viel.',
        'Musterlösung: ' + (e.steps || []).join(' → ') + '.'
      ]; },
      start: () => S('koerper', { haut: 'nass', rv: 0 }, { value: null }),
      sol: () => S('koerper', { haut: 'nass', rv: ex().given.rv }, { value: ex().answer.value }),
      wrong: () => { const e = ex(); return [{ name: 'zu klein', answer: S('koerper', {}, { value: e.answer.value * 0.4 }) }, { name: 'zu groß (Übergangswiderstand vergessen)', answer: S('koerper', {}, { value: e.given.U / e.given.rk * 1000 }) }, { name: 'A gegen mA (Faktor 1000)', answer: S('koerper', {}, { value: e.answer.value * 1000 }) }]; } };
  })();

  /* ====================================================================== el3: Strom unter die Zone Z2 bringen */
  const M3 = (() => {
    const BASE = { u: 230, typ: 'wechsel', haut: 'nass', weg: 'hand-fuss', rv: 0, t: 1000, rcd: 0 };
    const OWN = ['u', 'typ', 'haut', 'weg', 'rv', 't', 'rcd'];
    const MUSTER = 30000;                                                // Uebergangswiderstand der Musterloesung (Ohm): Strom etwa 26 % unter der Zonengrenze, Reserve
    const z2 = () => CORE().body.zoneCurve(BASE.t).z2 * 1000;
    const vals = () => once('v3', () => {
      const s = snap('koerper', fullCtl('koerper', Object.assign({}, BASE, { rv: MUSTER }))), s0 = snap('koerper', fullCtl('koerper', BASE));
      return { u: BASE.u, t: BASE.t, rk: s0.m.rk, ik0: s0.m.ik, z0: s0.m.zone, z2: z2(), rgMin: BASE.u / (z2() / 1000), rvMin: BASE.u / (z2() / 1000) - s0.m.rk, rv: MUSTER, rges: s.m.rges, ik1: s.m.ik, z1: s.m.zone };
    });
    const text = () => { const v = vals(); return 'Ein Mensch mit nasser Haut (Körperwiderstand ' + f(v.rk, 0) + ' Ω, Hand zu Fuß) berührt ' + f(v.u, 0) + ' V für ' + f(v.t, 0) + ' ms. Am Start beträgt der Körperstrom ' + f(v.ik0, 0) + ' mA (Zone ' + f(v.z0, 0) + '). Verändere die Bedingungen im Prüfstand „Stromwirkung auf den Körper“ (Boden und Schuhe, Haut, Strompfad) so, dass der Körperstrom höchstens in Zone 2 liegt, also höchstens ' +
      f(v.z2, 0) + ' mA erreicht. Die Netzspannung ' + f(v.u, 0) + ' V, die Einwirkdauer und die Stromart gehören zur Aufgabe und bleiben unverändert; ein RCD zählt hier nicht.'; };
    const hint = () => { const v = vals(); return [
      'Der Übergangswiderstand von Boden und Schuhen liegt in Reihe mit dem Körper (R_ges = R_K + R_v). Ein großer Übergangswiderstand begrenzt den Strom, die Spannung kannst du nicht ändern.',
      'Für höchstens ' + f(v.z2, 0) + ' mA bei ' + f(v.u, 0) + ' V braucht der Gesamtwiderstand mindestens ' + f(v.rgMin, 0) + ' Ω, also R_v von mindestens ' + f(v.rvMin, 0) + ' Ω. Am Start sind es ' + f(v.ik0, 0) + ' mA.',
      'Musterlösung: R_v = ' + f(v.rv, 0) + ' Ω (Boden und Schuhe). R_ges = ' + f(v.rges, 0) + ' Ω, der Körperstrom sinkt auf ' + f(v.ik1, 1) + ' mA, Zone ' + f(v.z1, 0) + '.'
    ]; };
    const check = mk('koerper', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'koerper', OWN, BASE), sim = snap('koerper', eff);
      inputRow(c, r, sim, a, 'koerper');
      setRow(r, 'koerper', eff, [{ key: 'u', want: BASE.u }, { key: 't', want: BASE.t }, { key: 'typ', want: BASE.typ }, { key: 'rcd', want: BASE.rcd }], 'Die Vorgaben der Aufgabe (Spannung, Einwirkdauer, Stromart, kein RCD) sind unverändert');
      const z = sim.m.zone, ik = sim.m.ik;
      r(z >= 1 && z <= 2, 'Der Körperstrom liegt höchstens in Zone 2 (höchstens ' + f(v.z2, 0) + ' mA)', 'Der Körperstrom beträgt ' + f(ik, 1) + ' mA bei ' + f(eff.t, 0) + ' ms und liegt in Zone ' + f(z, 0) + (ik > v.z2 ? ', also über ' + f(v.z2, 0) + ' mA' : '') + '. Der Gesamtwiderstand ist ' + f(sim.m.rges, 0) + ' Ω, nötig sind mindestens ' + f(v.rgMin, 0) + ' Ω.');
    });
    return { vals, text, hint, check, OWN, BASE, MUSTER, consts: [BASE.u], start: () => S('koerper', BASE), sol: () => S('koerper', Object.assign({}, BASE, { rv: MUSTER })),
      wrong: () => [{ name: 'zu wenig Übergangswiderstand', answer: S('koerper', Object.assign({}, BASE, { rv: 5000 })) }, { name: 'Spannung geändert (Vorgabe verletzt)', answer: S('koerper', Object.assign({}, BASE, { u: 24 })) }] };
  })();

  /* ====================================================================== el4: Zs-Grenze fuer B16 (Pool) */
  const M4 = (() => {
    const ex = () => exOf('zsMax', e => e.given.dev === 'LS-B' && e.given.In === 16, 'B16');
    const vals = () => once('v4', () => { const e = ex(), ia = CORE().prot.ia('LS-B', 16); return { u0: e.given.U0, ia, in: 16, faktor: e.given.faktor, zs: e.answer.value, zsC: CORE().grid.zsMax('LS-C', 16), mitFaktor: 0.8 * e.answer.value, schritte: nums((e.steps || []).join(' ')), frage: nums(e.question) }; });
    const check = mk('netz', [], (c, r, a) => {
      const e = ex(), v = vals();
      exRow(r, e, U.rawOf(a, 'value'), 'Größte zulässige Schleifenimpedanz Zs_max richtig berechnet', [{ si: v.mitFaktor, msg: 'Hier wird ohne Spannungsfaktor gerechnet (vereinfachte Rechnung wie in der Prüfung, Übungswert): Zs ≤ U0 / Ia, ohne zusätzlichen Faktor.' }]);
    });
    return { vals, check,
      text: () => ex().question + ' Du kannst Zs_max auch im Prüfstand „Netzform und Fehlerschleife“ am Messgerät Zs_max ablesen, wenn du Typ und Nennstrom einstellst. Gib das Ergebnis in Ω an.',
      ask: { label: 'Größte zulässige Schleifenimpedanz Zs_max', unit: 'Ω' },
      hint: () => { const v = vals(), e = ex(); return [
        'Die Abschaltbedingung lautet Zs ≤ U0 / Ia. Der LS-Schalter löst sicher aus, wenn der Strom mindestens Ia = Faktor · In beträgt.',
        'Ia = ' + f(v.faktor, 0) + ' · ' + f(v.in, 0) + ' A = ' + f(v.ia, 0) + ' A. Mit dem Faktor des Typs C wäre es der doppelte Strom und Zs_max nur ' + f(v.zsC, 4) + ' Ω.',
        'Musterlösung: ' + (e.steps || []).join(' → ') + '.'
      ]; },
      start: () => S('netz', {}, { value: null }),
      sol: () => S('netz', { dev: 'LS-B', In: 16 }, { value: ex().answer.value }),
      wrong: () => { const v = vals(); return [{ name: 'Faktor 10 statt 5', answer: S('netz', {}, { value: CORE().grid.zsMax('LS-C', 16) }) }, { name: 'durch In geteilt', answer: S('netz', {}, { value: v.u0 / v.in }) }, { name: 'mit Faktor 0,8', answer: S('netz', {}, { value: v.mitFaktor }) }]; } };
  })();

  /* ====================================================================== el5: Querschnitt waehlen */
  const M5 = (() => {
    const BASE = { form: 'TN-S', zv: 0.4, dev: 'LS-B', In: 16, kreis: 'end', fehler: 'koerperschluss', rcd: 0, l: 150, q: 1.5, qpe: 1.5 };
    const OWN = ['q', 'qpe'], IB = 10;                                   // Betriebsstrom der Aufgabe (A); Ib <= In <= Iz fuer jeden Querschnitt der Auswahl
    const mc = () => once('mc5', () => CORE().design.minCross({ ib: IB, l: BASE.l, form: BASE.form, dev: BASE.dev, In: BASE.In, zv: BASE.zv, rho: RHO() }));
    const vals = () => once('v5', () => {
      const g = q => CORE().grid.maxLength({ form: 'TN-S', dev: 'LS-B', In: 16, q, qpe: q, zv: BASE.zv });
      const s0 = snap('netz', fullCtl('netz', BASE)), s1 = snap('netz', fullCtl('netz', Object.assign({}, BASE, { q: mc().q, qpe: mc().q })));
      return { l: BASE.l, in: BASE.In, ib: IB, zv: BASE.zv, zsMax: s0.m.zsMax, zs0: s0.m.zs, qMin: mc().q, zs1: s1.m.zs, l15: g(1.5).lMax, l25: g(2.5).lMax, l4: g(4).lMax };
    });
    const text = () => { const v = vals(); return 'Ein Außenleiter und ein Schutzleiter gleichen Querschnitts versorgen im TN-S-System (Zv = ' + f(v.zv, 1) + ' Ω) einen Verbraucher mit Ib = ' + f(v.ib, 0) + ' A. Der LS-Schalter B' + f(v.in, 0) + ' schützt die ' + f(v.l, 0) + ' m lange Leitung. Wähle im Prüfstand „Netzform und Fehlerschleife“ den kleinsten Querschnitt (für Außenleiter und Schutzleiter), bei dem die Abschaltbedingung Zs ≤ U0 / Ia erfüllt ist. Er soll nicht dicker sein als nötig.'; };
    const hint = () => { const v = vals(); return [
      'Mit dem Querschnitt sinkt der Leitungswiderstand und damit Zs. Stelle q und q_PE auf denselben Wert und lies am Messgerät Zs und Zs_max ab, bis Zs ≤ Zs_max gilt. Dicker als nötig kostet unnötig Kupfer.',
      'Zs_max beträgt ' + f(v.zsMax, 3) + ' Ω. Die größte erlaubte Länge ist bei 1,5 mm² nur ' + f(v.l15, 1) + ' m, bei 2,5 mm² ' + f(v.l25, 1) + ' m und bei 4 mm² ' + f(v.l4, 1) + ' m; deine Leitung hat ' + f(v.l, 0) + ' m.',
      'Musterlösung: ' + f(v.qMin, 1) + ' mm² für beide Leiter, Zs = ' + f(v.zs1, 4) + ' Ω ≤ ' + f(v.zsMax, 3) + ' Ω. Mit 1,5 mm² wäre Zs = ' + f(v.zs0, 4) + ' Ω.'
    ]; };
    const check = mk('netz', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'netz', OWN, BASE), sim = snap('netz', eff);
      inputRow(c, r, sim, a, 'netz');
      const zs = sim.m.zs, zm = sim.m.zsMax;
      r(zs <= zm, 'Die Abschaltbedingung Zs ≤ Zs_max ist erfüllt', 'Mit ' + f(eff.q, 1) + ' mm² (Außenleiter) und ' + f(eff.qpe, 1) + ' mm² (Schutzleiter) ist Zs = ' + f(zs, 4) + ' Ω und damit größer als Zs_max = ' + f(zm, 3) + ' Ω: Die Auslösung des LS-Schalters ist nicht sicher. Der Querschnitt ist zu dünn.');
      const same = eff.q === v.qMin && eff.qpe === v.qMin;
      r(zs <= zm && same, 'Der Querschnitt ist der kleinste, der die Bedingung erfüllt (' + f(v.qMin, 1) + ' mm² für beide Leiter)', zs <= zm ? 'Du hast ' + f(eff.q, 1) + ' mm² für den Außenleiter und ' + f(eff.qpe, 1) + ' mm² für den Schutzleiter gewählt. Es reichen ' + f(v.qMin, 1) + ' mm² (Zs = ' + f(v.zs1, 4) + ' Ω ≤ ' + f(zm, 3) + ' Ω): Ein dickerer Querschnitt kostet unnötig Kupfer.' : 'Zuerst muss die Abschaltbedingung erfüllt sein.');
    });
    return { vals, text, hint, check, OWN, BASE, consts: [IB], start: () => S('netz', BASE), sol: () => S('netz', Object.assign({}, BASE, { q: mc().q, qpe: mc().q })),
      wrong: () => [{ name: 'zu dünn', answer: S('netz', Object.assign({}, BASE, { q: 1.5, qpe: 1.5 })) }, { name: 'unnötig dick', answer: S('netz', Object.assign({}, BASE, { q: 6, qpe: 6 })) }] };
  })();

  /* ====================================================================== el6: Schleifenimpedanz und Fehlerstrom */
  const M6 = (() => {
    const ex = () => exOf('zs', e => e.given.zv === 0.4 && e.given.q === 2.5 && e.given.l >= 20, 'zv04q25');
    const vals = () => once('v6', () => {
      const e = ex(), g = e.given, lp = CORE().grid.loop({ form: 'TN-S', zv: g.zv, q: g.q, l: g.l, rho: RHO() }), U = U0();
      return { zv: g.zv, l: g.l, q: g.q, rl: lp.rl, rpe: lp.rpe, zs: e.answer.value, u0: U, iF: U / e.answer.value, iFhin: U / (g.zv + lp.rl), iFohneZv: U / (lp.rl + lp.rpe), zsHin: g.zv + lp.rl, schritte: nums((e.steps || []).join(' ')), frage: nums(e.question) };
    });
    const check = mk('netz', [], (c, r, a) => {
      const e = ex(), v = vals();
      exRow(r, e, U.rawOf(a, 'zs'), 'Schleifenimpedanz Zs richtig berechnet');
      numRow(r, U.fieldNum(a, 'iF'), { label: 'Fehlerstrom I_F = U0 / Zs richtig berechnet', refs: [{ v: v.iF }], tol: 0.03, unit: 'A', digits: 1, wrong: [
        { v: v.iFhin, msg: 'Du hast nur den Hinleiter gerechnet (Zs = Zv + R_L): Die Fehlerschleife besteht aus Außenleiter und Schutzleiter.' },
        { v: v.iFohneZv, msg: 'Du hast die Netzimpedanz Zv vergessen: Sie gehört zur Schleife (Zs = Zv + R_L + R_PE).' }] });
    });
    return { vals, check, text: () => ex().question + ' Berechne danach den Fehlerstrom I_F bei U0 = ' + f(U0(), 0) + ' V. Du kannst den Aufbau im Prüfstand „Netzform und Fehlerschleife“ nachstellen (Querschnitt, Länge, Zv).',
      fields: () => [{ key: 'zs', question: '1. Schleifenimpedanz Zs', unit: 'Ω' }, { key: 'iF', question: '2. Fehlerstrom I_F', unit: 'A' }],
      hint: () => { const v = vals(), e = ex(); return [
        'In der Fehlerschleife liegen Netz (Zv), Außenleiter und Schutzleiter in Reihe: Zs = Zv + R_L + R_PE mit R = ρ · l / q. Danach gilt I_F = U0 / Zs.',
        'Jeder der beiden Leiter hat ' + f(v.rl, 4) + ' Ω. Nur der Hinleiter ergäbe Zs = ' + f(v.zsHin, 4) + ' Ω und ' + f(v.iFhin, 1) + ' A: Das wäre zu viel.',
        'Musterlösung: ' + (e.steps || []).join(' → ') + '; I_F = ' + f(v.u0, 0) + ' V / ' + f(v.zs, 4) + ' Ω = ' + f(v.iF, 1) + ' A.'
      ]; },
      start: () => S('netz', {}, { fields: { zs: null, iF: null } }),
      sol: () => { const v = vals(), g = ex().given; return S('netz', { q: g.q, qpe: g.q, l: g.l, zv: g.zv }, { fields: { zs: v.zs, iF: v.iF } }); },
      wrong: () => { const v = vals(); return [{ name: 'nur Hinleiter', answer: S('netz', {}, { fields: { zs: v.zsHin, iF: v.iFhin } }) }, { name: 'Netzanteil vergessen', answer: S('netz', {}, { fields: { zs: v.rl + v.rpe, iF: v.iFohneZv } }) }, { name: 'zu klein', answer: S('netz', {}, { fields: { zs: v.zs * 0.4, iF: v.iF * 0.4 } }) }]; } };
  })();

  /* ====================================================================== el7: Schutzleiter unterbrochen */
  const M7 = (() => {
    const BASE = { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, kreis: 'end', fehler: 'pe-unterbrochen', haut: 'nass', rv: 0, rcd: 0 };
    const OWN = ['fehler', 'haut', 'rv', 'rcd'];
    const person = (idn, eff) => CORE().rcd.person({ idn, haut: eff.haut, rv: eff.rv });
    const vals = () => once('v7', () => {
      const s0 = snap('netz', fullCtl('netz', BASE)), s30 = snap('netz', fullCtl('netz', Object.assign({}, BASE, { rcd: 30 }))), s300 = snap('netz', fullCtl('netz', Object.assign({}, BASE, { rcd: 300 }))), p = person(30, BASE);
      return { ub: s0.m.ub, iF: s0.m.ifehler, ik: p.iKmA, idn: 30, idnGross: 300, t: s30.m.tab * 1000, faktor: p.iKmA / 30, amp0: s0.a.ampel, amp30: s30.a.ampel, amp300: s300.a.ampel, rcd300Trip: person(300, BASE).trip.tripped };
    });
    const text = () => { const v = vals(); return 'Bei einer Leitung ist der Schutzleiter unterbrochen und es tritt ein Körperschluss auf (Simulation, nasse Haut, kein Übergangswiderstand). Ohne RCD fließt kein Fehlerstrom (' + f(v.iF, 0) + ' A), der Leitungsschutz löst nicht aus, am Gehäuse stehen bis zu ' + f(v.ub, 0) + ' V. Schalte im Prüfstand „Netzform und Fehlerschleife“ einen Zusatzschutz (RCD) so ein, dass er bei Berührung auslöst: Der Körperstrom ist ' +
      f(v.ik, 0) + ' mA. Beachte: Der Zusatzschutz ersetzt den Schutzleiter nicht, die Ampel wird deshalb höchstens gelb. Die Fehlerart, die Haut und der Boden (Übergangswiderstand) gehören zur Aufgabe.'; };
    const hint = () => { const v = vals(); return [
      'Ohne Schutzleiter schließt sich der Fehlerstrom nicht über PE. Der RCD löst erst aus, wenn der Strom über den Menschen mindestens seinen Nennfehlerstrom erreicht. Wähle IΔn also kleiner als den Körperstrom.',
      'Der Körperstrom beträgt ' + f(v.ik, 0) + ' mA. Ein RCD mit ' + f(v.idn, 0) + ' mA liegt weit darunter (Faktor ' + f(v.faktor, 1) + '); ein RCD mit ' + f(v.idnGross, 0) + ' mA liegt darüber und löst nicht sicher aus.',
      'Musterlösung: RCD mit ' + f(v.idn, 0) + ' mA: Er löst bei ' + f(v.ik, 0) + ' mA höchstens nach ' + f(v.t, 0) + ' ms aus, die Ampel zeigt gelb (nicht grün: Der Schutzleiter fehlt weiter).'
    ]; };
    const check = mk('netz', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'netz', OWN, BASE), sim = snap('netz', eff);
      inputRow(c, r, sim, a, 'netz');
      setRow(r, 'netz', eff, [{ key: 'fehler', want: BASE.fehler }, { key: 'haut', want: BASE.haut }, { key: 'rv', want: BASE.rv }], 'Die Vorgaben der Aufgabe (Fehlerart, Haut, Boden) sind unverändert');
      const idn = +eff.rcd, p = person(idn > 0 ? idn : 30, eff);
      r(idn > 0 && p.trip.tripped === true, 'Der RCD löst bei Berührung aus (Körperstrom ' + f(v.ik, 0) + ' mA ≥ IΔn)', idn > 0 ? 'Der Körperstrom beträgt ' + f(p.iKmA, 0) + ' mA, der RCD hat IΔn = ' + f(idn, 0) + ' mA: ' + p.trip.text : 'Es ist kein RCD eingestellt: Der Leitungsschutz löst ohne Schutzleiter nicht aus, am Gehäuse stehen bis zu ' + f(sim.m.ub, 0) + ' V.');
      r(sim.a && sim.a.ampel !== 'rot', 'Die Ampel zeigt nicht rot', 'Die Ampel zeigt ' + (sim.a ? sim.a.ampel : '–') + ': ' + (sim.a ? sim.a.text : ''));
    });
    return { vals, text, hint, check, OWN, BASE, consts: [BASE.rcd, 30, 300], start: () => S('netz', BASE), sol: () => S('netz', Object.assign({}, BASE, { rcd: 30 })),
      wrong: () => [{ name: 'ohne RCD', answer: S('netz', Object.assign({}, BASE, { rcd: 0 })) }, { name: 'RCD mit 300 mA', answer: S('netz', Object.assign({}, BASE, { rcd: 300 })) }] };
  })();

  /* ====================================================================== el8: Welche Netzform ist das? (Pool) */
  const M8 = (() => {
    const ORDER = ['TT', 'TN-C-S', 'IT', 'TN-S'];                       // Reihenfolge der Beschreibungen (gemischt, die Loesung steht nicht in der Auswahl)
    const forms = () => once('f8', () => ORDER.map(id => CORE().grid.forms.find(x => x.id === id)));
    const keyOf = id => 'n' + ORDER.indexOf(id);
    const opts = () => ['TN-S', 'TN-C-S', 'TT', 'IT'].map(id => ({ value: id, label: CORE().grid.forms.find(x => x.id === id).name }));
    const nameOf = id => (CORE().grid.forms.find(x => x.id === id) || {}).name;
    const textOf = id => (CORE().grid.forms.find(x => x.id === id) || {}).text;
    const check = mk('netz', [], (c, r, a) => {
      forms().forEach((fm0, i) => {
        const got = choiceOf(a, keyOf(fm0.id)), none = noChoice(got), hit = none ? null : opts().find(y => String(y.value) === String(got));
        r(!none && String(got) === fm0.id, 'Beschreibung ' + (i + 1) + ': richtige Netzform', none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' + hit.label + ' bedeutet: ' + textOf(hit.value) + ' ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + 'Die Beschreibung passt zu „' + fm0.name + '“.');
      });
    });
    return { vals: () => ({ n: ORDER.length }), check,
      text: () => 'Ordne jeder Beschreibung die Netzform zu. Im Prüfstand „Netzform und Fehlerschleife“ siehst du beim Umschalten der Form, wie PE und N geführt werden und wo geerdet ist. Die Buchstaben der Kurzzeichen: T = direkte Erdung, I = Isolierung gegen Erde, N = Verbindung mit dem Neutralleiter, S = getrennt, C = kombiniert.',
      choices: () => forms().map((fm0, i) => ({ key: keyOf(fm0.id), q: 'Beschreibung ' + (i + 1) + ': ' + fm0.text, options: opts() })),
      hint: () => [
        'Frage dich bei jeder Beschreibung: Wo ist das Netz geerdet (T oder I), und wie sind Neutralleiter und Schutzleiter geführt (getrennt, kombiniert oder aufgeteilt)?',
        'Die Kennbuchstaben helfen: der erste Buchstabe sagt, ob die Quelle geerdet ist (T) oder isoliert (I), der zweite, wie die Körper der Anlage geerdet sind (T eigener Erder, N über das Netz).',
        'Musterlösung: ' + forms().map((fm0, i) => 'Beschreibung ' + (i + 1) + ' → ' + fm0.name).join('; ') + '.'
      ],
      start: () => S('netz', {}),
      sol: () => S('netz', {}, { choices: ORDER.reduce((o, id) => { o[keyOf(id)] = id; return o; }, {}) }),
      wrong: () => [{ name: 'TN-C-S gegen TN-S vertauscht', answer: S('netz', {}, { choices: { n0: 'TT', n1: 'TN-S', n2: 'IT', n3: 'TN-C-S' } }) }, { name: 'TT gegen TN verwechselt', answer: S('netz', {}, { choices: { n0: 'TN-S', n1: 'TT', n2: 'IT', n3: 'TN-C-S' } }) }] };
  })();

  /* ====================================================================== el9: TT, groesster Erdungswiderstand */
  const M9 = (() => {
    const e30 = () => exOf('raTT', e => e.given.idn === 30, 'idn30'), e300 = () => exOf('raTT', e => e.given.idn === 300, 'idn300');
    const vals = () => once('v9', () => ({ ul: lim('ul_ac'), u0: U0(), idn30: 30, idn300: 300, ra30: e30().answer.value, ra300: e300().answer.value, falsch230: U0() / 0.03, schritte30: nums((e30().steps || []).join(' ')), schritte300: nums((e300().steps || []).join(' ')), frage30: nums(e30().question), frage300: nums(e300().question) }));
    const check = mk('netz', [], (c, r, a) => {
      exRow(r, e30(), U.rawOf(a, 'ra30'), 'R_A,max für 30 mA richtig berechnet');
      exRow(r, e300(), U.rawOf(a, 'ra300'), 'R_A,max für 300 mA richtig berechnet');
    });
    return { vals, check, consts: [30, 300],
      text: () => 'Im TT-System hat die Anlage einen eigenen Erder mit dem Widerstand R_A. Der RCD schaltet sicher ab, wenn R_A · IΔn höchstens die Grenzspannung beträgt. Berechne den größten zulässigen Erdungswiderstand für zwei RCD. Du kannst den Wert im Prüfstand „Netzform und Fehlerschleife“ (Form TT, Messgerät Zs_max) kontrollieren.',
      fields: () => [{ key: 'ra30', question: '1. ' + e30().question, unit: 'Ω' }, { key: 'ra300', question: '2. ' + e300().question, unit: 'Ω' }],
      hint: () => { const v = vals(); return [
        'Die TT-Bedingung lautet R_A ≤ U_L / IΔn mit der Grenzspannung U_L = ' + f(v.ul, 0) + ' V (gilt für trockene Bedingungen). Rechne IΔn in A.',
        'Mit 230 V statt ' + f(v.ul, 0) + ' V käme ' + f(v.falsch230, 1) + ' Ω heraus: Das wäre falsch. Je größer IΔn, desto kleiner muss R_A sein.',
        'Musterlösung: ' + (e30().steps || []).join(' → ') + '; ' + (e300().steps || []).join(' → ') + '.'
      ]; },
      start: () => S('netz', { form: 'TT' }, { fields: { ra30: null, ra300: null } }),
      sol: () => S('netz', { form: 'TT' }, { fields: { ra30: e30().answer.value, ra300: e300().answer.value } }),
      wrong: () => { const v = vals(); return [{ name: '230 V statt 50 V', answer: S('netz', {}, { fields: { ra30: v.u0 / 0.03, ra300: v.u0 / 0.3 } }) }, { name: 'mA gegen A', answer: S('netz', {}, { fields: { ra30: v.ul / 30, ra300: v.ul / 300 } }) }]; } };
  })();

  /* ====================================================================== el10: Welcher LS-Typ? */
  const M10 = (() => {
    const IN = 16;
    const CASES = [{ id: 'l1', ein: 2, name: 'Leuchten und Steckdosen im Wohnraum (kleiner Einschaltstrom)' }, { id: 'l2', ein: 4, name: 'Kleiner Motor (mittlerer Anlaufstrom)' }, { id: 'l3', ein: 8, name: 'Großer Motor oder Transformator (hoher Einschaltstrom)' }];
    const TYPES = ['LS-B', 'LS-C', 'LS-D'];
    const best = ein => TYPES.find(d => CORE().prot.inrush(d, IN, ein).ausloesung === 'nein');
    const cases = () => once('c10', () => CASES.map(c => ({ id: c.id, ein: c.ein, name: c.name, i: c.ein * IN, best: best(c.ein), by: TYPES.reduce((o, d) => { o[d] = CORE().prot.inrush(d, IN, c.ein); return o; }, {}), zs: TYPES.reduce((o, d) => { o[d] = CORE().grid.zsMax(d, IN); return o; }, {}) })));
    const opts = () => TYPES.map(d => ({ value: d, label: 'Typ ' + d.slice(3) }));
    const label = c => c.name + ', Einschaltstrom das ' + f(c.ein, 0) + '-fache von In (' + f(c.i, 0) + ' A bei In = ' + f(IN, 0) + ' A)';
    const text = () => 'Wähle für jede Last den passenden Typ des Leitungsschutzschalters (B, C oder D) mit In = ' + f(IN, 0) + ' A. Der Einschaltstrom darf den LS-Schalter nicht auslösen; gewählt wird der empfindlichste Typ, bei dem das noch gilt (je kleiner der Auslösefaktor, desto größer darf Zs sein). Prüfe im Prüfstand „Sicherung und LS-Schalter“ mit dem Regler „Einschaltstrom“, wie sich die Ampel je Typ verhält.';
    const hint = () => { const c = cases(); return [
      'Vergleiche den Einschaltstrom mit dem magnetischen Bereich des Typs: Darunter löst der LS-Schalter nicht aus, im Bereich kann er auslösen, darüber löst er sicher aus. Typ B löst ab dem 3- bis 5-fachen, C ab dem 5- bis 10-fachen und D ab dem 10- bis 20-fachen von In aus (Übungswerte, nur der Faktor 5 für B ist belegt).',
      c.map(x => x.id.replace('l', 'Last ') + ': ' + f(x.i, 0) + ' A').join('; ') + '. Ia beträgt bei B16 ' + f(CORE().prot.ia('LS-B', IN), 0) + ' A, bei C16 ' + f(CORE().prot.ia('LS-C', IN), 0) + ' A und bei D16 ' + f(CORE().prot.ia('LS-D', IN), 0) + ' A.',
      'Musterlösung: ' + c.map(x => x.id.replace('l', 'Last ') + ' → Typ ' + x.best.slice(3)).join('; ') + '.'
    ]; };
    const choices = () => cases().map(c => ({ key: c.id, q: 'Welcher Typ passt zu: ' + label(c) + '?', options: opts() }));
    const check = mk('schutz', [], (c, r, a) => {
      cases().forEach(x => {
        const got = choiceOf(a, x.id), none = noChoice(got), hit = none ? null : opts().find(y => String(y.value) === String(got));
        let why = 'Wähle eine Antwort aus.';
        if (!none) {
          why = hit ? 'Du hast „' + hit.label + '“ gewählt. ' + CORE().prot.inrush(hit.value, IN, x.ein).text + ' ' : 'Deine Auswahl gehört nicht zu den Antworten. ';
          if (hit && hit.value !== x.best) why += TYPES.indexOf(hit.value) < TYPES.indexOf(x.best) ? 'Dieser Typ löst beim Einschalten aus oder kann es.' : 'Dieser Typ ist unnötig unempfindlich: Zs_max sinkt auf ' + f(x.zs[hit.value], 4) + ' Ω (beim passenden Typ ' + f(x.zs[x.best], 4) + ' Ω).';
          why += ' Passend ist Typ ' + x.best.slice(3) + ': ' + x.by[x.best].text;
        }
        r(!none && String(got) === x.best, x.name + ': richtiger Typ', why);
      });
    });
    return { vals: () => cases().reduce((o, x) => { o[x.id] = { ein: x.ein, i: x.i, zs: x.zs[x.best] }; return o; }, { in: IN, iaB: CORE().prot.ia('LS-B', IN), iaC: CORE().prot.ia('LS-C', IN), iaD: CORE().prot.ia('LS-D', IN) }), text, hint, choices, check, consts: [3, 5, 10, 20], start: () => S('schutz', { ib: 5 }),
      sol: () => S('schutz', { ib: 5 }, { choices: cases().reduce((o, x) => { o[x.id] = x.best; return o; }, {}) }),
      wrong: () => [{ name: 'immer Typ B', answer: S('schutz', {}, { choices: { l1: 'LS-B', l2: 'LS-B', l3: 'LS-B' } }) }, { name: 'immer Typ D', answer: S('schutz', {}, { choices: { l1: 'LS-D', l2: 'LS-D', l3: 'LS-D' } }) }] };
  })();

  /* ====================================================================== el11: Motor-Anlauf ohne Ausloesung */
  const M11 = (() => {
    const BASE = { dev: 'LS-B', In: 16, q: 2.5, ib: 5, ein: 4, sel: 'keine', i: 2 };
    const OWN = ['dev', 'In', 'q', 'ib', 'ein'], ZS = 0.8;              // Vorgabe der Aufgabe: Schleifenimpedanz am Verbraucher (Ohm)
    const types = ['LS-B', 'LS-C', 'LS-D'];
    const vals = () => once('v11', () => {
      const C = CORE(), I = BASE.ein * BASE.In;
      return { in: BASE.In, ib: BASE.ib, ein: BASE.ein, i: I, zs: ZS, iaB: C.prot.ia('LS-B', BASE.In), iaC: C.prot.ia('LS-C', BASE.In), iaD: C.prot.ia('LS-D', BASE.In), zmB: C.grid.zsMax('LS-B', BASE.In), zmC: C.grid.zsMax('LS-C', BASE.In), zmD: C.grid.zsMax('LS-D', BASE.In),
        loC: C.prot.devices.find(x => x.id === 'LS-C').lo * BASE.In, reserve: C.prot.devices.find(x => x.id === 'LS-C').lo * BASE.In / I };
    });
    const text = () => { const v = vals(); return 'Ein Motor mit Ib = ' + f(v.ib, 0) + ' A nimmt beim Anlauf kurz das ' + f(v.ein, 0) + '-fache von In = ' + f(v.in, 0) + ' A auf, also ' + f(v.i, 0) + ' A. Die Leitung (2,5 mm²) hat am Motor die Schleifenimpedanz Zs = ' + f(v.zs, 1) + ' Ω. Stelle im Prüfstand „Sicherung und LS-Schalter“ den Typ so ein, dass der Anlauf den LS-Schalter nicht auslöst, der Kurzschlussschutz aber noch sicher ist (Zs ≤ Zs_max). In, Ib, Einschaltstrom und Leitung bleiben unverändert.'; };
    const hint = () => { const v = vals(); return [
      'Zwei Bedingungen: Der Anlaufstrom muss unter dem magnetischen Bereich des Typs bleiben (sonst löst der LS-Schalter beim Anlauf aus), und Zs darf höchstens U0 / Ia sein (sonst löst er im Kurzschluss nicht sicher aus).',
      'Anlaufstrom ' + f(v.i, 0) + ' A: B16 löst ab ' + f(v.iaB, 0) + ' A sicher aus (kann schon früher), C16 hat den Bereich ab ' + f(v.loC, 0) + ' A. Zs_max beträgt bei B16 ' + f(v.zmB, 3) + ' Ω, bei C16 ' + f(v.zmC, 4) + ' Ω und bei D16 ' + f(v.zmD, 5) + ' Ω; deine Schleife hat ' + f(v.zs, 1) + ' Ω.',
      'Musterlösung: Typ C16. Der Anlaufstrom ' + f(v.i, 0) + ' A bleibt unter ' + f(v.loC, 0) + ' A (Reserve ' + f((v.reserve - 1) * 100, 0) + ' %), und Zs = ' + f(v.zs, 1) + ' Ω ≤ Zs_max = ' + f(v.zmC, 4) + ' Ω.'
    ]; };
    const check = mk('schutz', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'schutz', OWN, BASE), sim = snap('schutz', eff), C = CORE();
      inputRow(c, r, sim, a, 'schutz');
      setRow(r, 'schutz', eff, [{ key: 'In', want: BASE.In }, { key: 'ib', want: BASE.ib }, { key: 'ein', want: BASE.ein }, { key: 'q', want: BASE.q }], 'Die Vorgaben der Aufgabe (In, Ib, Anlaufstrom, Leitung) sind unverändert');
      const ir = C.prot.inrush(eff.dev, eff.In, eff.ein);
      r(ir.ausloesung === 'nein', 'Der Anlaufstrom löst den LS-Schalter nicht aus', ir.text + ' Der Motor soll anlaufen können.');
      const zm = C.grid.zsMax(eff.dev, eff.In);
      r(zm >= v.zs - 1e-12, 'Die Auslösung im Kurzschluss ist sicher (Zs ≤ Zs_max)', 'Die Schleife hat Zs = ' + f(v.zs, 1) + ' Ω, der Typ ' + String(eff.dev).slice(3) + ' erlaubt aber höchstens Zs_max = ' + f(zm, 5) + ' Ω: Der LS-Schalter löst im Kurzschluss nicht sicher aus.');
    });
    return { vals, text, hint, check, OWN, BASE, consts: [BASE.q, ZS], start: () => S('schutz', BASE), sol: () => S('schutz', Object.assign({}, BASE, { dev: 'LS-C' })),
      wrong: () => [{ name: 'Typ B löst beim Anlauf aus', answer: S('schutz', Object.assign({}, BASE, { dev: 'LS-B' })) }, { name: 'Typ D: Kurzschluss nicht sicher', answer: S('schutz', Object.assign({}, BASE, { dev: 'LS-D' })) }] };
  })();

  /* ====================================================================== el12: Ia und Zs_max fuer C20 */
  const M12 = (() => {
    const ei = () => exOf('ia', e => e.given.dev === 'LS-C' && e.given.In === 20, 'C20'), ez = () => exOf('zsMax', e => e.given.dev === 'LS-C' && e.given.In === 20, 'C20');
    const vals = () => once('v12', () => ({ in: 20, ia: ei().answer.value, zs: ez().answer.value, iaB: CORE().prot.ia('LS-B', 20), zsB: CORE().grid.zsMax('LS-B', 20), u0: U0(), schritte1: nums((ei().steps || []).join(' ')), schritte2: nums((ez().steps || []).join(' ')), frage1: nums(ei().question), frage2: nums(ez().question) }));
    const check = mk('schutz', [], (c, r, a) => {
      exRow(r, ei(), U.rawOf(a, 'ia'), 'Auslösestrom Ia richtig berechnet');
      exRow(r, ez(), U.rawOf(a, 'zs'), 'Zs_max richtig berechnet');
    });
    return { vals, check, consts: [20],
      text: () => 'Ein Leitungsschutzschalter C20 schützt einen Stromkreis in einem TN-System (U0 = ' + f(U0(), 0) + ' V). Berechne den Auslösestrom Ia und die größte zulässige Schleifenimpedanz Zs_max. Im Prüfstand „Sicherung und LS-Schalter“ (Messgerät Ia) und „Netzform und Fehlerschleife“ (Messgerät Zs_max) kannst du die Ergebnisse kontrollieren.',
      fields: () => [{ key: 'ia', question: '1. ' + ei().question, unit: 'A' }, { key: 'zs', question: '2. ' + ez().question, unit: 'Ω' }],
      hint: () => { const v = vals(); return [
        'Ia = Faktor · In mit dem Faktor des Typs (C: sichere Auslösung bei 10 · In, Übungswert). Danach gilt Zs_max = U0 / Ia.',
        'Mit dem Faktor des Typs B käme Ia = ' + f(v.iaB, 0) + ' A und Zs_max = ' + f(v.zsB, 3) + ' Ω heraus: Das wäre der Fehler "Faktor 5 statt 10". Vergiss den Nennstrom ' + f(v.in, 0) + ' A nicht.',
        'Musterlösung: ' + (ei().steps || []).join(' → ') + '; ' + (ez().steps || []).join(' → ') + '.'
      ]; },
      start: () => S('schutz', { dev: 'LS-C', In: 20 }, { fields: { ia: null, zs: null } }),
      sol: () => S('schutz', { dev: 'LS-C', In: 20 }, { fields: { ia: ei().answer.value, zs: ez().answer.value } }),
      wrong: () => { const v = vals(); return [{ name: 'Faktor 5 statt 10', answer: S('schutz', {}, { fields: { ia: v.iaB, zs: v.zsB } }) }, { name: 'In vergessen', answer: S('schutz', {}, { fields: { ia: 10, zs: v.u0 / 20 } }) }]; } };
  })();

  /* ====================================================================== el13: Leitung und Automat abstimmen */
  const M13 = (() => {
    const BASE = { dev: 'LS-B', In: 20, q: 1.5, ib: 14, ein: 1, sel: 'keine', i: 2 };
    const OWN = ['dev', 'In', 'q', 'ib'];
    const iz = q => CORE().prot.cable(q).iz;
    const vals = () => once('v13', () => ({ ib: BASE.ib, iz15: iz(1.5), iz25: iz(2.5), iz4: iz(4), inMuster: 16, qMuster: 1.5, in0: BASE.In, q0: BASE.q }));
    const text = () => { const v = vals(); return 'Ein Verbraucher nimmt dauernd Ib = ' + f(v.ib, 0) + ' A auf. Wähle im Prüfstand „Sicherung und LS-Schalter“ den Nennstrom In des LS-Schalters (Typ B) und den Leitungsquerschnitt so, dass Ib ≤ In ≤ Iz gilt: Der LS-Schalter soll im Betrieb nicht auslösen und die Leitung bei Überlast schützen. Iz steht im Messgerät (Übungstabelle, Verlegeart B2). Typ und Betriebsstrom bleiben unverändert.'; };
    const hint = () => { const v = vals(); return [
      'Zwei Seiten: In muss mindestens so groß sein wie Ib (sonst Fehlauslösung im Betrieb) und höchstens so groß wie die Strombelastbarkeit Iz der Leitung (sonst ist die Leitung bei Überlast nicht geschützt).',
      'Iz beträgt bei 1,5 mm² ' + f(v.iz15, 0) + ' A, bei 2,5 mm² ' + f(v.iz25, 0) + ' A und bei 4 mm² ' + f(v.iz4, 0) + ' A (Übungswerte). Der Start mit In = ' + f(v.in0, 0) + ' A auf ' + f(v.q0, 1) + ' mm² verletzt In ≤ Iz.',
      'Musterlösung: In = ' + f(v.inMuster, 0) + ' A auf ' + f(v.qMuster, 1) + ' mm²: ' + f(v.ib, 0) + ' A ≤ ' + f(v.inMuster, 0) + ' A ≤ ' + f(v.iz15, 0) + ' A. Auch In = ' + f(v.inMuster, 0) + ' A auf ' + f(2.5, 1) + ' mm² ist richtig.'
    ]; };
    const check = mk('schutz', OWN, (c, r, a) => {
      const eff = effOf(c, 'schutz', OWN, BASE), sim = snap('schutz', eff), ch = CORE().prot.check(BASE.ib, eff.In, iz(eff.q));
      inputRow(c, r, sim, a, 'schutz');
      setRow(r, 'schutz', eff, [{ key: 'ib', want: BASE.ib }, { key: 'dev', want: BASE.dev }], 'Die Vorgaben der Aufgabe (Betriebsstrom, Typ B) sind unverändert');
      r(ch.ibOk === true, 'Der Nennstrom ist mindestens so groß wie der Betriebsstrom (Ib ≤ In)', 'In = ' + f(eff.In, 0) + ' A, Ib = ' + f(BASE.ib, 0) + ' A: ' + ch.text);
      r(ch.izOk === true, 'Der Nennstrom ist höchstens so groß wie die Strombelastbarkeit der Leitung (In ≤ Iz)', 'Leitung ' + f(eff.q, 1) + ' mm², In = ' + f(eff.In, 0) + ' A: ' + ch.text);
    });
    return { vals, text, hint, check, OWN, BASE, consts: [BASE.q], start: () => S('schutz', BASE), sol: () => S('schutz', Object.assign({}, BASE, { In: 16, q: 1.5 })),
      wrong: () => [{ name: 'In größer als Iz', answer: S('schutz', Object.assign({}, BASE, { In: 20, q: 1.5 })) }, { name: 'In kleiner als Ib', answer: S('schutz', Object.assign({}, BASE, { In: 13, q: 2.5 })) }] };
  })();

  /* ====================================================================== el14: RCD einsetzen und pruefen */
  const M14 = (() => {
    const BASE = { idn: 300, type: 'A', form: 'sinus', iFehler: 0, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 };
    const OWN = ['idn'];
    const vals = () => once('v14', () => {
      const ls = CORE().rcd.leakSum([BASE.leak1, BASE.leak2, BASE.leak3], { idn: lim('idn_zusatz') }), l10 = CORE().rcd.leakSum([BASE.leak1, BASE.leak2, BASE.leak3], { idn: 10 });
      return { idn: lim('idn_zusatz'), idn0: BASE.idn, leak: ls.sum, ratio30: ls.ratio, ratio10: l10.ratio };
    });
    const text = () => { const v = vals(); return 'Für den Zusatzschutz in einem Steckdosenstromkreis im Wohnbereich braucht die Anlage einen RCD mit einem Nennfehlerstrom von höchstens ' + f(v.idn, 0) + ' mA (belegt). Stelle im Prüfstand „RCD – der Summenstrom“ den passenden Nennfehlerstrom ein und löse die Prüftaste aus: Der RCD soll auslösen. Hinter dem RCD hängen drei Geräte mit zusammen ' + f(v.leak, 0) + ' mA Ableitstrom. Denke daran, dass die Prüftaste nur die Auslösefunktion prüft.'; };
    const hint = () => { const v = vals(); return [
      'Wähle den Nennfehlerstrom aus der Reihe 10, 30, 100, 300 und 500 mA nach dem Zweck: Zusatzschutz für Personen braucht höchstens ' + f(v.idn, 0) + ' mA. Drücke danach die Prüftaste (halten) oder die Auslösetaste.',
      'Der Start hat ' + f(v.idn0, 0) + ' mA und ist für Zusatzschutz zu groß. Mit ' + f(v.idn, 0) + ' mA liegen die Ableitströme bei ' + f(v.ratio30, 2) + ' · IΔn; mit 10 mA wären es ' + f(v.ratio10, 2) + ' · IΔn (Fehlauslösung möglich).',
      'Musterlösung: IΔn = ' + f(v.idn, 0) + ' mA einstellen, Prüftaste drücken: Der RCD löst aus. Die Ableitströme (' + f(v.leak, 0) + ' mA = ' + f(v.ratio30, 2) + ' · IΔn) lösen keine Fehlauslösung aus.'
    ]; };
    const check = mk('rcd', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'rcd', OWN, BASE), sim = snap('rcd', eff), C = CORE(), idn = +eff.idn;
      inputRow(c, r, sim, a, 'rcd');
      r(idn <= v.idn, 'Der Nennfehlerstrom beträgt höchstens ' + f(v.idn, 0) + ' mA (Zusatzschutz)', 'Der RCD hat IΔn = ' + f(idn, 0) + ' mA. Für den Zusatzschutz im Wohnbereich gilt höchstens ' + f(v.idn, 0) + ' mA (belegt): Ein größerer Nennfehlerstrom schützt Personen nicht.');
      const tb = C.rcd.testButton({ idn, type: eff.type }), used = U.tasteUsed(a);
      r(used && tb.tripped === true, 'Die Prüftaste wurde benutzt und der RCD löst aus', used ? 'Die Prüftaste wurde benutzt, der RCD löst aber nicht aus: ' + tb.text : 'Du hast die Prüftaste nicht benutzt. Ohne sie weißt du nicht, ob die Auslösefunktion arbeitet. ' + C.TEXTS.prueftaste);
      const ls = C.rcd.leakSum([eff.leak1, eff.leak2, eff.leak3], { idn });
      r(!ls.fehlausloesung && !ls.nahe, 'Die Ableitströme lösen den RCD nicht von selbst aus (unter ' + f(U.naheRatio(), 1) + ' · IΔn)', 'Die Ableitströme ergeben ' + f(ls.sum, 0) + ' mA, das sind ' + f(ls.ratio, 2) + ' · IΔn (Grenze ' + f(U.naheRatio(), 1) + ' · IΔn, Lehrfaustwert): Der RCD kann ohne Körperschluss auslösen.');
    });
    return { vals, text, hint, check, OWN, BASE, consts: [10, 30, 100, 300, 500], start: () => S('rcd', BASE), sol: () => S('rcd', Object.assign({}, BASE, { idn: 30 }), { fired: true }),
      wrong: () => [{ name: 'Taste nicht benutzt', answer: S('rcd', Object.assign({}, BASE, { idn: 30 }), { fired: false }) }, { name: 'falscher Nennfehlerstrom (300 mA)', answer: S('rcd', Object.assign({}, BASE, { idn: 300 }), { fired: true }) }, { name: 'Nennfehlerstrom 10 mA (Fehlauslösung)', answer: S('rcd', Object.assign({}, BASE, { idn: 10 }), { fired: true }) }] };
  })();

  /* ====================================================================== el15: Was prueft die Pruefaste? (Pool) */
  const M15 = (() => {
    const tb = () => once('tb15', () => CORE().rcd.testButton({ idn: 30, type: 'A' }));
    const OPT1 = [{ value: 'funktion', label: 'die Auslösefunktion des RCD' }, { value: 'schutzleiter', label: 'den Schutzleiterwiderstand der Anlage' }, { value: 'erdung', label: 'den Erdungswiderstand' }];
    const OPT2 = [{ value: 'geprueft', label: 'Er ist damit geprüft und in Ordnung.' }, { value: 'offen', label: 'Darüber sagt die Prüftaste nichts: Der Schutzleiter bleibt ungeprüft.' }];
    const right1 = () => ({ funktion: tb().tripped === true, schutzleiter: tb().prueftSchutzleiter === true, erdung: !/nicht den Erdungswiderstand/.test(tb().text) }); // aus dem Kern abgeleitet
    const right2 = () => ({ geprueft: tb().prueftSchutzleiter === true, offen: tb().prueftSchutzleiter === false });
    const best = r => Object.keys(r).filter(k => r[k]);
    const choices = () => [{ key: 'was', q: 'Was prüft die Prüftaste eines RCD?', options: OPT1 }, { key: 'folge', q: 'Der RCD löst mit der Prüftaste aus. Was weißt du dann über den Schutzleiter der Anlage?', options: OPT2 }];
    const check = mk('rcd', [], (c, r, a) => {
      [['was', OPT1, right1()], ['folge', OPT2, right2()]].forEach(([k, opts, rt]) => {
        const got = choiceOf(a, k), none = noChoice(got), hit = none ? null : opts.find(y => String(y.value) === String(got)), ok = !none && rt[got] === true;
        r(ok, k === 'was' ? 'Die Prüfung der Prüftaste ist richtig benannt' : 'Die Folgerung für den Schutzleiter ist richtig', none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + CORE().TEXTS.prueftaste);
      });
    });
    return { vals: () => ({ idn: 30 }), check, consts: [30],
      text: () => 'Der RCD eines Stromkreises hat eine Prüftaste. Sie löst einen künstlichen Differenzstrom aus. Probiere es im Prüfstand „RCD – der Summenstrom“ mit der Taste aus und beantworte die Fragen. Dieses Wissen gehört zu den Aufgaben der Prüfung.',
      choices,
      hint: () => [
        'Die Taste erzeugt im RCD einen Differenzstrom und prüft damit, ob der Auslösemechanismus arbeitet. Sie beeinflusst nur den RCD selbst.',
        'Die Taste greift nicht in die Anlage ein: Weder der Schutzleiter noch der Erdungswiderstand werden dabei gemessen. Dafür braucht es eigene Messungen durch die Elektrofachkraft.',
        'Musterlösung: Sie prüft die Auslösefunktion; der Schutzleiter bleibt ungeprüft. ' + CORE().TEXTS.prueftaste
      ],
      start: () => S('rcd', {}),
      sol: () => S('rcd', {}, { choices: { was: best(right1()).find(k => k === 'funktion'), folge: best(right2())[0] }, fired: true }),
      wrong: () => [{ name: 'Schutzleiter genannt', answer: S('rcd', {}, { choices: { was: 'schutzleiter', folge: 'geprueft' } }) }, { name: 'Erdung genannt', answer: S('rcd', {}, { choices: { was: 'erdung', folge: 'geprueft' } }) }] };
  })();

  /* ====================================================================== el16: Fehlausloesung beheben */
  const M16 = (() => {
    const L0 = { leak1: 7, leak2: 5, leak3: 3 };                         // Ableitstroeme der drei Geraete (mA, Vorgabe): Summe 15 mA = 0,5 mal IΔn am Start
    const BASE = Object.assign({ idn: 30, type: 'A', form: 'sinus', iFehler: 0, person: false, pe: 'angeschlossen' }, L0);
    const OWN = ['idn', 'leak1', 'leak2', 'leak3'], KEYS = ['leak1', 'leak2', 'leak3'];
    const ok2 = (list, idn) => { const l = CORE().rcd.leakSum(list, { idn }); return !l.nahe && !l.fehlausloesung; };
    const vals = () => once('v16', () => {
      const C = CORE(), all = C.rcd.leakSum(KEYS.map(k => L0[k]), { idn: 30 }), a = C.rcd.leakSum([7], { idn: 30 }), b = C.rcd.leakSum([5, 3], { idn: 30 });
      return { idn: 30, sum: all.sum, ratio: all.ratio, a1: 7, a2: 5, a3: 3, ra: a.ratio, rb: b.ratio, sumB: b.sum, grenze: U.naheRatio(), grenze5: lim('rcd_bereich'), idnGross: 300, ratioGross: C.rcd.leakSum([15], { idn: 300 }).ratio };
    });
    const text = () => { const v = vals(); return 'Hinter einem RCD (IΔn = ' + f(v.idn, 0) + ' mA, Zusatzschutz) hängen drei Geräte mit den Ableitströmen ' + f(v.a1, 0) + ' mA, ' + f(v.a2, 0) + ' mA und ' + f(v.a3, 0) + ' mA. Der RCD löst ohne Körperschluss aus (Fehlauslösung). Verteile die Geräte auf zwei RCD: Im Prüfstand „RCD – der Summenstrom“ stellst du den Ableitstrom der Geräte, die am zweiten RCD hängen, auf 0 mA. Beide RCD sollen unter ' + f(v.grenze, 1) +
      ' · IΔn bleiben (Lehrfaustwert), der Zusatzschutz von ' + f(v.idn, 0) + ' mA bleibt erhalten. Die Ableitströme der Geräte selbst änderst du nicht.'; };
    const hint = () => { const v = vals(); return [
      'Die Ableitströme hinter einem RCD addieren sich. Teile die drei Geräte so auf zwei RCD, dass die Summe an jedem unter dem Grenzwert bleibt. Ein RCD mit größerem Nennfehlerstrom wäre keine Lösung: Der Zusatzschutz geht verloren.',
      'Alle drei zusammen ergeben ' + f(v.sum, 0) + ' mA = ' + f(v.ratio, 2) + ' · IΔn. Das Gerät mit ' + f(v.a1, 0) + ' mA allein ergibt ' + f(v.ra, 2) + ' · IΔn, die beiden anderen zusammen ' + f(v.sumB, 0) + ' mA = ' + f(v.rb, 2) + ' · IΔn. Ein RCD mit ' + f(v.idnGross, 0) + ' mA hätte nur ' + f(v.ratioGross, 2) + ' · IΔn, schützt aber Personen nicht mehr.',
      'Musterlösung: Ein RCD behält das Gerät mit ' + f(v.a1, 0) + ' mA (' + f(v.ra, 2) + ' · IΔn), der zweite die beiden anderen (' + f(v.sumB, 0) + ' mA = ' + f(v.rb, 2) + ' · IΔn). Am Prüfstand stehen dann die Ableitströme ' + f(v.a2, 0) + ' mA und ' + f(v.a3, 0) + ' mA auf 0 mA.'
    ]; };
    const check = mk('rcd', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'rcd', OWN, BASE), sim = snap('rcd', eff), idn = +eff.idn;
      inputRow(c, r, sim, a, 'rcd');
      const rest = KEYS.map(k => +eff[k]), moved = KEYS.map((k, i) => (rest[i] === 0 ? L0[k] : 0)), keepOk = KEYS.every((k, i) => rest[i] === L0[k] || rest[i] === 0);
      r(keepOk, 'Die Ableitströme der Geräte sind unverändert (ein Gerät bleibt oder wandert zum zweiten RCD)', 'Die Ableitströme stehen auf ' + rest.map(x => f(x, 1) + ' mA').join(', ') + ' (Vorgabe ' + KEYS.map(k => f(L0[k], 0) + ' mA').join(', ') + '). Ein Gerät wird nicht verändert, sondern nur an den anderen RCD gehängt (Wert 0 mA).');
      r(idn <= v.idn, 'Der Zusatzschutz bleibt erhalten (IΔn höchstens ' + f(v.idn, 0) + ' mA)', 'Der RCD hat IΔn = ' + f(idn, 0) + ' mA. Damit verschwindet zwar die Fehlauslösung (' + f(CORE().rcd.leakSum([rest.reduce((s, x) => s + x, 0)], { idn }).ratio, 2) + ' · IΔn), aber der Zusatzschutz für Personen mit höchstens ' + f(v.idn, 0) + ' mA ist verloren.');
      const s1 = CORE().rcd.leakSum(rest, { idn }), s2 = CORE().rcd.leakSum(moved, { idn });
      r(keepOk && ok2(rest, idn), 'Der erste RCD bleibt unter ' + f(v.grenze, 1) + ' · IΔn', !keepOk ? 'Zuerst müssen die Ableitströme der Geräte unverändert sein.' : 'An diesem RCD hängen ' + f(s1.sum, 0) + ' mA = ' + f(s1.ratio, 2) + ' · IΔn (Grenze ' + f(v.grenze, 1) + ' · IΔn): Hier ist die Fehlauslösung noch möglich. Hänge ein Gerät an den zweiten RCD.');
      r(keepOk && ok2(moved, idn), 'Der zweite RCD bleibt unter ' + f(v.grenze, 1) + ' · IΔn', !keepOk ? 'Zuerst müssen die Ableitströme der Geräte unverändert sein.' : moved.every(x => x === 0) ? 'Am zweiten RCD hängt noch kein Gerät; verlege die Geräte so, dass beide RCD unter ' + f(v.grenze, 1) + ' · IΔn bleiben.' : 'Am zweiten RCD hängen ' + f(s2.sum, 0) + ' mA = ' + f(s2.ratio, 2) + ' · IΔn (Grenze ' + f(v.grenze, 1) + ' · IΔn): Dort wäre die Fehlauslösung möglich. Verteile die Geräte anders.');
    });
    return { vals, text, hint, check, OWN, BASE, L0, consts: [30, 300], start: () => S('rcd', BASE), sol: () => S('rcd', Object.assign({}, BASE, { leak2: 0, leak3: 0 })),
      wrong: () => [{ name: 'alles hinter einem RCD', answer: S('rcd', BASE) }, { name: 'RCD mit 300 mA', answer: S('rcd', Object.assign({}, BASE, { idn: 300 })) }, { name: 'Ableitströme verändert', answer: S('rcd', Object.assign({}, BASE, { leak1: 2, leak2: 2, leak3: 2 })) }] };
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
    tk({ id: 'el1', lab: 'els', cat: 'Schutzklassen', title: 'Welche Zone ist das?', level: 1, rig: 'koerper' }, M1),
    tk({ id: 'el2', lab: 'els', cat: 'Schutzklassen', title: 'Körperstrom berechnen', level: 2, rig: 'koerper' }, M2),
    tk({ id: 'el3', lab: 'els', cat: 'Schutzklassen', title: 'Den Strom unter die Zone 2 bringen', level: 2, rig: 'koerper' }, M3),
    tk({ id: 'el4', lab: 'els', cat: 'Prüfungsnah', title: 'Zs-Grenze für B16', level: 2, rig: 'netz' }, M4),
    tk({ id: 'el5', lab: 'els', cat: 'Prüfungsnah', title: 'Querschnitt wählen', level: 2, rig: 'netz' }, M5),
    tk({ id: 'el6', lab: 'els', cat: 'Prüfungsnah', title: 'Schleifenimpedanz und Fehlerstrom', level: 3, rig: 'netz' }, M6),
    tk({ id: 'el7', lab: 'els', cat: 'Schutzklassen', title: 'Schutzleiter unterbrochen', level: 3, rig: 'netz' }, M7),
    tk({ id: 'el8', lab: 'els', cat: 'Prüfungsnah', title: 'Welche Netzform ist das?', level: 2, rig: 'netz' }, M8),
    tk({ id: 'el9', lab: 'els', cat: 'Prüfungsnah', title: 'TT: größter Erdungswiderstand', level: 3, rig: 'netz' }, M9),
    tk({ id: 'el10', lab: 'els', cat: 'Schutzklassen', title: 'Welcher LS-Typ?', level: 1, rig: 'schutz' }, M10),
    tk({ id: 'el11', lab: 'els', cat: 'Schutzklassen', title: 'Motor-Anlauf ohne Auslösung', level: 2, rig: 'schutz' }, M11),
    tk({ id: 'el12', lab: 'els', cat: 'Prüfungsnah', title: 'Ia und Zs_max für C20', level: 2, rig: 'schutz' }, M12),
    tk({ id: 'el13', lab: 'els', cat: 'Schutzklassen', title: 'Leitung und Automat abstimmen', level: 3, rig: 'schutz' }, M13),
    tk({ id: 'el14', lab: 'els', cat: 'RCD', title: 'RCD einsetzen und prüfen', level: 1, rig: 'rcd' }, M14),
    tk({ id: 'el15', lab: 'els', cat: 'Prüfungsnah', title: 'Was prüft die Prüftaste?', level: 2, rig: 'rcd' }, M15),
    tk({ id: 'el16', lab: 'els', cat: 'RCD', title: 'Fehlauslösung beheben', level: 3, rig: 'rcd' }, M16)
  ]);
  /* Zugriff fuer Tests: Module mit Schwellwerten und Vorgaben (Stand 2026-10-22) */
  T.thresholds1 = () => ({ el3: { rv: M3.MUSTER }, el5: M5.BASE, el11: { zs: 0.8 }, el13: M13.BASE, el16: M16.L0 });
  T.modules1 = { M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15, M16 };
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks, modules: T.modules1 };
})(typeof window !== 'undefined' ? window : globalThis);
