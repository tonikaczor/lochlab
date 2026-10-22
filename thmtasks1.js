/* thmtasks1.js - Thermik-Lab: Aufgaben th1 bis th15 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig)
 * Registrierung: THM_TASKS.register([ ... ]) (THM_TASKS und die Hilfsfunktionen THM_TASKS.util kommen aus thmdata.js; thmdata.js VOR dieser Datei laden,
 * in Node holt sich die Datei fehlende Teile per require).
 * Format je Aufgabe: { id:'thN', lab:'thm', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), hintVals(), ask? | fields? | choices? }
 *   start() und sol() liefern { rig, controls, settle?, dur?, fields?, choices?, value? } (Steuerwerte des Pruefstands, Beginn im Beharrungszustand oder kalt, Selbsttest-Antworten).
 *   answer = { rig, controls, seq, rows, dur, state, simTime, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, kennwerte }.
 *   check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis (Start < 100, Musterloesung = 100).
 * Regeln (SPEC Abschnitt 7 und 9):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus THM_CORE (Formeln, Tabellen, Simulation) und stehen in hintVals() (Regel 1); text, table und hint
 *     werden erst beim ersten Zugriff gerechnet. THM_TASKS.audit(task) prueft jede Zahl in Tipp 2 und 3.
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde. Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert
 *     uebereinstimmt (Regel 2 und 3). Symbole stehen nur als {sym:key}-Platzhalter (Regel 5).
 *   - Schwellwerte stammen aus der gerechneten Musterloesung (THM_TASKS.thresholds1(), Stand 2026-10-20); die Toleranzen stehen je Aufgabe in der Aufgabenliste
 *     (Abweichungen von der SPEC in quelle/thmlab/ABWEICHUNGEN.md, Paket WP4a).
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (OWN); alles andere setzt die Pruefung selbst (FIX), damit gleiche Eingaben gleiche Ergebnisse liefern.
 * Benoetigt: thmcore.js, thmdata.js und die Pruefstaende thmrig-linear.js, thmrig-transistor.js, thmrig-vergleich.js. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const TT = () => { if (!root.THM_TASKS) nodeReq('./thmdata.js'); return root.THM_TASKS || null; };
  const T = TT();
  if (!T || !T.util) { if (typeof console !== 'undefined') console.warn('thmtasks1.js: thmdata.js fehlt, die Aufgaben th1 bis th15 werden nicht angemeldet.'); return; }
  const U = T.util, fin = U.fin, isObj = U.isObj, clean = U.clean, initial = U.initial, fullCtl = U.fullCtl, mk = U.mk, inputRow = U.inputRow, numRow = U.numRow;
  const CORE = () => root.THM_CORE || nodeReq('./thmcore.js') || root.THM_CORE || null;
  const RIGFILES = ['./thmrig-linear.js', './thmrig-transistor.js', './thmrig-vergleich.js'];
  const RIGS = id => { let R = root.THM_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { RIGFILES.forEach(nodeReq); R = root.THM_RIGS; } return R || null; };
  const f = (x, d) => { const C = CORE(); return C && typeof C.fmt === 'function' ? C.fmt(x, d) : U.fm(x, d == null ? 2 : d); };
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const tbl = (caption, head, rows) => ({ caption, head, rows });
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const noV = keys => keys.reduce((o, k) => { o[k] = null; return o; }, {});
  const HSNAME = { none: 'kein Kühlkörper', fahne: 'Fahnenkühlkörper', s: 'Profil klein', m: 'Profil mittel', l: 'Profil groß', xl: 'Rippenkörper sehr groß', blech: 'Kühlblech (Selbstbau)' };
  const CAT = ['fahne', 's', 'm', 'l', 'xl'];                                           // Katalog der Aufgaben (ohne Selbstbau-Blech)
  const hsRth = id => CORE().heatsinks.byId[id].rthK;
  const rthCK = (pkg, joint, paste, screw) => CORE().mount.rthCK(pkg, joint, paste || 'duenn', screw || 'fest');
  const kW = x => f(x) + ' K/W';
  const MONTAGE = { bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', nonlin: false };   // feste Montagewerte der Pruefung
  const LIN = Object.assign({ device: '7805', loadMode: 'strom', swVergleich: false }, MONTAGE);

  /* ====================================================================== Pruefstand: Momentaufnahme im Beharrungszustand */
  const FIRST = ['device', 'mode', 'n', 'count', 'heatsink'];
  const snapCache = new Map();
  function snap(rigId, ctl) {
    const key = rigId + '|' + JSON.stringify(ctl);
    if (snapCache.has(key)) return snapCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId), rig = R.create(rigId, { seed: 1, noDraw: true });
      Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push({ key: k, value: ctl[k] });
      });
      rig.settle();
      out.st = U.clone(rig.state()); out.steady = U.clone(rig.steady()); out.chain = U.clone(rig.chain() || {});
      out.ok = true;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message || e)); }
    if (snapCache.size > 600) snapCache.clear();
    snapCache.set(key, out);
    return out;
  }
  /* Eingaben der Aufgabe: freigegebene Steuerwerte (own) ueber den festen Werten (fix) und den Standardwerten des Pruefstands */
  const effOf = (c, rigId, own, fix) => fullCtl(rigId, Object.assign({}, fix, initial(c, own)));
  const cdef = (rigId, key) => (U.ctlDefs(rigId) || []).find(x => x.key === key) || null;
  const dlabel = (rigId, key) => { const d = cdef(rigId, key); return d && d.label ? d.label : key; };
  function olabel(rigId, key, v) {
    const d = cdef(rigId, key);
    if (d && Array.isArray(d.options)) { const o = d.options.find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    return typeof v === 'number' ? f(v) : String(v);
  }
  /* Steuerwerte-Zeile: specs = [{ key, want, tol? (relativ, nur Zahlen) }]; ok, wenn alle stimmen; why nennt nur die abweichenden */
  function setRow(r, rigId, eff, specs, label) {
    const bad = [];
    specs.forEach(s => {
      const x = eff[s.key], d = cdef(rigId, s.key), u = d && d.unit ? ' ' + d.unit : '';
      if (typeof s.want === 'number') {
        const tol = s.tol != null ? s.tol : 0.02;
        if (!(fin(+x) && Math.abs(x - s.want) <= tol * Math.abs(s.want) + 1e-9)) bad.push('„' + dlabel(rigId, s.key) + '“ steht auf ' + f(x) + u + ', verlangt sind ' + f(s.want) + u);
      } else if (x !== s.want) bad.push('„' + dlabel(rigId, s.key) + '“ steht auf „' + olabel(rigId, s.key, x) + '“, verlangt ist „' + olabel(rigId, s.key, s.want) + '“');
    });
    r(bad.length === 0, label, 'Im Prüfstand ' + bad.join('; ') + '.');
    return bad.length === 0;
  }
  const answerOf = (task, o) => T.answerOf(task, o);
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);
  const valOf = (a, key) => (key === 'value' ? U.numAns(a) : U.fieldNum(a, key));
  const smallest = (erf, extra) => { const C = CORE(); return C.chooseHeatsink(erf, Object.assign({ pkg: 'TO-220' }, extra || {})); };

  /* ====================================================================== th1: Ersatzschaltbild */
  const M1 = (() => {
    const A = id => (CORE().analogie || []).find(x => x.id === id) || null;
    const ROWS = [
      { key: 'p', art: 'die', id: 'stromquelle', q: 'Welches elektrische Bauteil entspricht im Ersatzschaltbild der Verlustleistung {sym:P}?', label: 'Verlustleistung' },
      { key: 'rth', art: 'der', id: 'widerstand', q: 'Welches elektrische Bauteil entspricht dem Wärmewiderstand {sym:Rth_ges}?', label: 'Wärmewiderstand' },
      { key: 'ta', art: 'die', id: 'spannungsquelle', q: 'Welches elektrische Bauteil entspricht der Umgebungstemperatur {sym:Ta}?', label: 'Umgebungstemperatur' },
      { key: 'cth', art: 'die', id: 'kondensator', q: 'Welches elektrische Bauteil entspricht der Wärmekapazität {sym:Cth}?', label: 'Wärmekapazität' }
    ];
    const opts = () => ['kondensator', 'stromquelle', 'spule', 'widerstand', 'spannungsquelle'].map(id => ({ value: id, label: id === 'spule' ? 'Spule L' : A(id).elek }));
    const want = () => ROWS.reduce((o, x) => { const a = A(x.id); o[x.key] = a ? a.id : null; return o; }, {});
    const text = () => 'Die Wärmekette eines Bauteils lässt sich wie ein Stromkreis zeichnen: Das Ersatzschaltbild im Prüfstand (Ansicht „Ersatzschaltbild“) zeigt Quellen, Widerstände und Kondensatoren. Ordne den vier thermischen Größen das passende elektrische Bauteil zu.';
    const hint = () => {
      const l = id => { const a = A(id); return a.elek + ' ↔ ' + a.therm; };
      return [
        'Frage dich bei jeder Größe: Was treibt die Wärme an, was fließt, was bremst, was speichert? Elektrisch treibt eine Spannung, es fließt ein Strom, ein Widerstand bremst, ein Kondensator speichert.',
        'Die Entsprechungen laut Tabelle des Labs: ' + l('spannung') + '; ' + l('strom') + '; ' + l('widerstand') + '; ' + l('kondensator') + '.',
        'Musterlösung: ' + ROWS.map(x => x.label + ' ↔ ' + A(x.id).elek).join('; ') + '.'
      ];
    };
    const choices = () => ROWS.map(x => ({ key: x.key, q: x.q, options: opts() }));
    const check = mk('linear', [], (c, r, a) => {
      const w = want();
      ROWS.forEach(x => {
        const got = choiceOf(a, x.key), none = got === undefined || got === null || got === '';
        const row = A(x.id), hit = none ? null : opts().find(y => String(y.value) === String(got));
        r(!none && String(got) === w[x.key], x.label + ' richtig zugeordnet',
          none ? 'Wähle eine Antwort aus.' : (hit ? 'Du hast „' + hit.label + '“ gewählt. ' : 'Deine Auswahl gehört nicht zu den Antworten. ') + 'Im Ersatzschaltbild des Labs entspricht ' + x.art + ' ' + x.label + ' dem Bauteil „' + row.elek + '“: ' + row.text);
      });
    });
    return { want, text, hint, choices, check, vals: () => ({}) };
  })();

  /* ====================================================================== th2: Verlustleistung des 7805 */
  const M2 = (() => {
    const UE = 12, IA = 0.4, OWN = ['device', 'loadMode', 'ue', 'iLoad'], FIX = Object.assign({}, LIN, { iq: false, ta: 25, heatsink: 'none' });
    const vals = () => once('v2', () => {
      const C = CORE(), dev = C.devices['7805'], ua = dev.uaFix, p = C.power.linear(UE, ua, IA).p, pq = C.power.linear(UE, ua, IA, dev.iq).p;
      return { ue: UE, ua, ia: IA, du: UE - ua, p, pIq: pq, iqmA: dev.iq * 1000, pIqPart: UE * dev.iq, pUe: UE * IA, pUa: ua * IA, pSum: (UE + ua) * IA, tol: 2 };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'device', want: '7805' }], 'Der Regler ist der 7805');
      setRow(r, 'linear', eff, [{ key: 'loadMode', want: 'strom' }, { key: 'iLoad', want: v.ia }, { key: 'ue', want: v.ue }], 'Eingangsspannung ' + f(v.ue) + ' V und Laststrom ' + f(v.ia) + ' A (feste Stromlast) eingestellt');
      numRow(r, U.numAns(a), { label: 'Verlustleistung des Reglers', refs: [{ v: v.p }, { v: v.pIq }], tol: 0.02, unit: 'W', digits: 2, wrong: [
        { v: v.pUe, msg: 'Du hast Ue · Ia gerechnet. Das ist die aufgenommene Leistung; die Verlustleistung entsteht nur an der Spannung, die der Regler abbaut (Ue − Ua).' },
        { v: v.pUa, msg: 'Du hast Ua · Ia gerechnet. Das ist die Leistung, die der Verbraucher bekommt, nicht die Verlustleistung des Reglers.' },
        { v: v.pSum, msg: 'Du hast Ue und Ua addiert. Für die Verlustleistung zählt der Unterschied Ue − Ua.' }] });
    });
    return { vals, check, OWN, FIX,
      text() { const v = vals(); return 'Der Linearregler 7805 hält seinen Ausgang auf ' + f(v.ua) + ' V. Stelle im Prüfstand ' + f(v.ue) + ' V Eingangsspannung und ' + f(v.ia) + ' A Laststrom ein (feste Stromlast) und berechne die Verlustleistung des Reglers. Den Ruhestrom (' + f(v.iqmA) + ' mA) darfst du vernachlässigen; rechnest du ihn mit, gilt auch dieser Wert.'; },
      hint() { const v = vals(); return [
        'Der Linearregler nimmt am Eingang die Leistung Ue · Ia auf und gibt Ua · Ia an die Last ab. Der Rest wird im Regler zu Wärme: Das ist die Verlustleistung {sym:P}.',
        'Spannungsabfall am Regler: Ue − Ua = ' + f(v.ue) + ' V − ' + f(v.ua) + ' V = ' + f(v.du) + ' V. Diese Spannung fällt bei jedem Ampere Laststrom als Wärme an: P = (Ue − Ua) · Ia.',
        'Musterlösung: P = ' + f(v.du) + ' V · ' + f(v.ia) + ' A = ' + f(v.p, 2) + ' W. Mit Ruhestrom kommt Ue · Iq = ' + f(v.ue) + ' V · ' + f(v.iqmA) + ' mA = ' + f(v.pIqPart, 2) + ' W dazu: ' + f(v.pIq, 2) + ' W.'
      ]; } };
  })();

  /* ====================================================================== th3: Verlustleistung des LM317 */
  const M3 = (() => {
    const UE = 15, UA = 9, IA = 0.3, OWN = ['device', 'loadMode', 'ue', 'ua', 'iLoad'], FIX = Object.assign({}, LIN, { device: 'lm317', iq: true, ta: 25, heatsink: 'none' });
    const vals = () => once('v3', () => {
      const C = CORE(), e = C.devices.lm317.elec({ ue: UE, ua: UA, loadMode: 'strom', iLoad: IA, tj: 25, iq: true }), p5 = C.devices['7805'].uaFix;
      return { ue: UE, ua: UA, ia: IA, du: UE - UA, p: C.power.linear(UE, UA, IA).p, pRig: e.pv, pUe: UE * IA, pUa: UA * IA, pFest: (UE - p5) * IA, uFest: p5, tol: 2 };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'device', want: 'lm317' }], 'Der Regler ist der LM317');
      setRow(r, 'linear', eff, [{ key: 'loadMode', want: 'strom' }, { key: 'iLoad', want: v.ia }, { key: 'ue', want: v.ue }, { key: 'ua', want: v.ua }], 'Eingang ' + f(v.ue) + ' V, Ausgang ' + f(v.ua) + ' V und Laststrom ' + f(v.ia) + ' A eingestellt');
      numRow(r, U.numAns(a), { label: 'Verlustleistung des Reglers', refs: [{ v: v.p }, { v: v.pRig }], tol: 0.02, unit: 'W', digits: 2, wrong: [
        { v: v.pUe, msg: 'Du hast Ue · Ia gerechnet. Das ist die aufgenommene Leistung, nicht die Verlustleistung.' },
        { v: v.pUa, msg: 'Du hast Ua · Ia gerechnet. Das ist die Leistung am Verbraucher.' },
        { v: v.pFest, msg: 'Du hast mit Ua = ' + f(v.uFest) + ' V gerechnet, der Festspannung des 7805. Der LM317 ist hier auf ' + f(v.ua) + ' V eingestellt.' }] });
    });
    return { vals, check, OWN, FIX,
      text() { const v = vals(); return 'Ein LM317 bekommt ' + f(v.ue) + ' V Eingangsspannung. Du stellst seinen Ausgang auf ' + f(v.ua) + ' V ein, die Last zieht ' + f(v.ia) + ' A. Stelle den Prüfstand so ein und berechne die Verlustleistung des Reglers. Ruhestrom und Strom durch den Spannungsteiler darfst du vernachlässigen; der Prüfstand rechnet sie mit, der Unterschied ist klein und auch der Prüfstandswert gilt.'; },
      hint() { const v = vals(); return [
        'Der Linearregler setzt die Spannungsdifferenz zwischen Eingang und Ausgang mal Laststrom in Wärme um. Beim LM317 stellst du den Ausgang ein, die Differenz ändert sich mit dem Ausgang.',
        'Spannungsabfall am Regler: Ue − Ua = ' + f(v.ue) + ' V − ' + f(v.ua) + ' V = ' + f(v.du) + ' V. Er liegt am Laststrom Ia = ' + f(v.ia) + ' A.',
        'Musterlösung: P = ' + f(v.du) + ' V · ' + f(v.ia) + ' A = ' + f(v.p, 2) + ' W. Der Prüfstand zeigt ' + f(v.pRig, 3) + ' W, weil er den Strom durch den Spannungsteiler und den Ruhestrom mitrechnet.'
      ]; } };
  })();

  /* ====================================================================== th4: Gesamt-Wärmewiderstand */
  const M4 = (() => {
    const OWN = ['heatsink', 'joint', 'paste'], FIX = Object.assign({}, LIN, { ue: 12, iLoad: 0.5, iq: false, ta: 25 });
    const vals = () => once('v4', () => {
      const C = CORE(), dev = C.devices['7805'], ck = rthCK('TO-220', 'glimmer', 'duenn'), rk = hsRth('m'), tot = C.chain({ device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }).rthTotal;
      return { rthJC: dev.rthJC, rthCK: ck, rthK: rk, tot, sum: dev.rthJC + ck + rk, rthJA: dev.rthJA, ckKeine: rthCK('TO-220', 'glimmer', 'keine'), tol: 2 };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'heatsink', want: 'm' }], 'Der 7805 sitzt auf dem Profil mittel');
      setRow(r, 'linear', eff, [{ key: 'joint', want: 'glimmer' }], 'Zwischen Gehäuse und Kühlkörper liegt eine Glimmerscheibe');
      setRow(r, 'linear', eff, [{ key: 'paste', want: 'duenn' }], 'Die Wärmeleitpaste ist dünn aufgetragen');
      numRow(r, U.numAns(a), { label: 'Gesamt-Wärmewiderstand der Kette', refs: [{ v: v.tot }], tol: 0.02, unit: 'K/W', digits: 2, wrong: [
        { v: v.rthJC + v.rthK, msg: 'Du hast {sym:Rth_CK} vergessen. Der Übergang mit Glimmerscheibe und Wärmeleitpaste gehört in die Reihe.' },
        { v: v.rthCK + v.rthK, msg: 'Du hast {sym:Rth_JC} vergessen. Der Weg von der Sperrschicht zum Gehäuse gehört in die Reihe.' },
        { v: v.rthJC + v.rthCK, msg: 'Du hast {sym:Rth_K} vergessen. Der Kühlkörper selbst gehört in die Reihe.' },
        { v: v.rthK, msg: 'Du hast nur den Wärmewiderstand des Kühlkörpers genommen. Alle drei Glieder liegen in Reihe und werden addiert.' },
        { v: v.rthJC + v.ckKeine + v.rthK, msg: 'Du hast {sym:Rth_CK} ohne Wärmeleitpaste angesetzt (' + f(v.ckKeine) + ' K/W). Hier ist die Paste dünn aufgetragen.' },
        { v: v.rthJA, msg: 'Du hast den Wärmewiderstand Sperrschicht–Umgebung ohne Kühlkörper ({sym:Rth_JA}) genommen. Hier sitzt der 7805 auf einem Kühlkörper.' }] });
    });
    return { vals, check, OWN, FIX,
      text() { return 'Montiere den 7805 im Prüfstand auf das Profil mittel, mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste. Gib den Gesamt-Wärmewiderstand von der Sperrschicht bis zur Umgebung an und rechne ihn aus den drei Gliedern nach.'; },
      hint() { const v = vals(); return [
        'Die Wärme fließt von der Sperrschicht über das Gehäuse und den Übergang in den Kühlkörper und von dort in die Luft. Die drei Wärmewiderstände liegen in Reihe, wie drei Widerstände in einem Stromkreis: Du addierst sie.',
        'Die Glieder: {sym:Rth_JC} = ' + f(v.rthJC) + ' K/W (Datenblatt des 7805), {sym:Rth_CK} = ' + f(v.rthCK) + ' K/W (Glimmerscheibe mit dünner Wärmeleitpaste), {sym:Rth_K} = ' + f(v.rthK) + ' K/W (Profil mittel). Die Werte zeigt der Prüfstand bei der Montage an.',
        'Musterlösung: {sym:Rth_ges} = ' + f(v.rthJC) + ' K/W + ' + f(v.rthCK) + ' K/W + ' + f(v.rthK) + ' K/W = ' + f(v.tot, 2) + ' K/W. Ohne Kühlkörper wären es ' + f(v.rthJA) + ' K/W.'
      ]; } };
  })();

  /* ====================================================================== th5: Temperaturen der Kette */
  const M5 = (() => {
    const UE = 12, IA = 0.5, TA = 25, OWN = ['ue', 'iLoad', 'ta', 'heatsink', 'joint', 'paste'], FIX = Object.assign({}, LIN, { iq: false });
    const CFG = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v5', () => {
      const C = CORE(), dev = C.devices['7805'], p = C.power.linear(UE, dev.uaFix, IA).p, pq = C.power.linear(UE, dev.uaFix, IA, dev.iq).p, s = C.steady(CFG, p, TA), sq = C.steady(CFG, pq, TA);
      return { ue: UE, ia: IA, ta: TA, p, pIq: pq, rthJC: s.rthJC, rthCK: s.rthCK, rthK: s.rthK, rthTot: s.rthTotal, dJC: s.dJC, dCK: s.dCK, dK: s.dK, tk: s.tk, tc: s.tc, tj: s.tj, tkIq: sq.tk, tcIq: sq.tc, tjIq: sq.tj, tjMax: s.tjMax, dTjSum: s.tj - TA, tol: 1,
        maxDiff: Math.max(Math.abs(s.tk - sq.tk), Math.abs(s.tc - sq.tc), Math.abs(s.tj - sq.tj)) };
    });
    const fields = [{ key: 'tj', label: 'Sperrschichttemperatur {sym:Tj}', unit: '°C' }, { key: 'tc', label: 'Gehäusetemperatur {sym:Tc}', unit: '°C' }, { key: 'tk', label: 'Kühlkörpertemperatur {sym:Tk}', unit: '°C' }];
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'ue', want: v.ue }, { key: 'iLoad', want: v.ia }, { key: 'ta', want: v.ta }, { key: 'heatsink', want: 'm' }, { key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }],
        'Prüfstand wie in der Aufgabe eingestellt (' + f(v.ue) + ' V, ' + f(v.ia) + ' A, ' + f(v.ta) + ' °C, Profil mittel, Glimmerscheibe, Wärmeleitpaste dünn)');
      const wr = (key, a1, a2, name) => numRow(r, U.fieldNum(a, key), { label: name, refs: [{ v: a1 }, { v: a2 }], absTol: 1, unit: '°C', digits: 1, wrong: [
        { v: key === 'tj' ? v.dTjSum : key === 'tc' ? v.dK + v.dCK : v.dK, msg: 'Du hast die Umgebungstemperatur nicht addiert. Von {sym:Ta} aus summieren sich die Temperaturabfälle P · Rth der Glieder.' },
        { v: key === 'tk' ? v.tc : key === 'tc' ? v.tj : v.tk, msg: key === 'tk' ? 'Du hast die Gehäusetemperatur {sym:Tc} eingetragen. Der Kühlkörper ist kälter als das Gehäuse (der Übergang kostet noch ' + f(v.dCK, 2) + ' K).' : key === 'tc' ? 'Du hast die Sperrschichttemperatur {sym:Tj} eingetragen. Das Gehäuse ist kälter als die Sperrschicht ({sym:Rth_JC} kostet ' + f(v.dJC, 2) + ' K).' : 'Du hast die Kühlkörpertemperatur {sym:Tk} eingetragen. Die Sperrschicht ist die heißeste Stelle der Kette.' }] });
      wr('tj', v.tj, v.tjIq, 'Sperrschichttemperatur {sym:Tj} im Beharrungszustand');
      wr('tc', v.tc, v.tcIq, 'Gehäusetemperatur {sym:Tc} im Beharrungszustand');
      wr('tk', v.tk, v.tkIq, 'Kühlkörpertemperatur {sym:Tk} im Beharrungszustand');
    });
    return { vals, check, fields, OWN, FIX, CFG,
      text() { const v = vals(); return 'Der 7805 sitzt auf dem Profil mittel, mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste. Er arbeitet bei ' + f(v.ue) + ' V Eingangsspannung und ' + f(v.ia) + ' A Laststrom, die Umgebung hat ' + f(v.ta) + ' °C. Stelle den Prüfstand so ein, warte den Beharrungszustand ab und lies {sym:Tj}, {sym:Tc} und {sym:Tk} ab. Rechne die drei Temperaturen danach nach: Verlustleistung, Temperaturabfall je Glied ({sym:P} · Rth), von {sym:Ta} aus aufsummiert.\nDer Prüfstand kann den Ruhestrom mitrechnen (Schalter „Ruhestrom berücksichtigen“); das ändert die Werte um weniger als ' + f(v.tol) + ' K. Beide Wege gelten.'; },
      hint() { const v = vals(); return [
        'Im Beharrungszustand fließt die Verlustleistung gleichmäßig durch die Kette. Über jedem Glied fällt die Temperatur um P · Rth ab, genau wie die Spannung über einem Widerstand bei gleichem Strom. Du beginnst bei der Umgebung und gehst Glied für Glied zur Sperrschicht hinauf.',
        'P = (' + f(v.ue) + ' V − 5 V) · ' + f(v.ia) + ' A = ' + f(v.p, 2) + ' W. Temperaturabfälle: Kühlkörper ' + f(v.p, 2) + ' W · ' + f(v.rthK) + ' K/W = ' + f(v.dK, 2) + ' K, Übergang ' + f(v.p, 2) + ' W · ' + f(v.rthCK) + ' K/W = ' + f(v.dCK, 2) + ' K, Gehäuse bis Sperrschicht ' + f(v.p, 2) + ' W · ' + f(v.rthJC) + ' K/W = ' + f(v.dJC, 2) + ' K.',
        'Musterlösung: {sym:Tk} = ' + f(v.ta) + ' °C + ' + f(v.dK, 2) + ' K = ' + f(v.tk, 2) + ' °C; {sym:Tc} = ' + f(v.tk, 2) + ' °C + ' + f(v.dCK, 2) + ' K = ' + f(v.tc, 2) + ' °C; {sym:Tj} = ' + f(v.tc, 2) + ' °C + ' + f(v.dJC, 2) + ' K = ' + f(v.tj, 2) + ' °C. Mit Ruhestrom: ' + f(v.tkIq, 2) + ' °C, ' + f(v.tcIq, 2) + ' °C, ' + f(v.tjIq, 2) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th6: Glimmer mit und ohne Paste (Vergleich) */
  const M6 = (() => {
    const PV = 3.5, TA = 25, OWN = ['device', 'pv', 'heatsink_a', 'joint_a', 'paste_a', 'heatsink_b', 'joint_b', 'paste_b'], FIX = { n: 2, ta: TA };
    const vals = () => once('v6', () => {
      const C = CORE(), cA = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, cB = Object.assign({}, cA, { paste: 'keine' }), sA = C.steady(cA, PV, TA), sB = C.steady(cB, PV, TA);
      return { pv: PV, ta: TA, ckA: sA.rthCK, ckB: sB.rthCK, dCK: sB.rthCK - sA.rthCK, tjA: sA.tj, tjB: sB.tj, dTj: sB.tj - sA.tj, rthK: sA.rthK, rthJC: sA.rthJC, rthA: sA.rthTotal, rthB: sB.rthTotal, tol: 5 };
    });
    const check = mk('vergleich', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'vergleich', OWN, FIX), sim = snap('vergleich', eff);
      inputRow(c, r, sim, a, 'vergleich');
      setRow(r, 'vergleich', eff, [{ key: 'device', want: '7805' }, { key: 'pv', want: v.pv }], 'Beide Aufbauten tragen dieselbe Verlustleistung (7805, ' + f(v.pv) + ' W)');
      setRow(r, 'vergleich', eff, [{ key: 'heatsink_a', want: 'm' }, { key: 'joint_a', want: 'glimmer' }, { key: 'paste_a', want: 'duenn' }], 'Aufbau A: Profil mittel, Glimmerscheibe, Wärmeleitpaste dünn');
      setRow(r, 'vergleich', eff, [{ key: 'heatsink_b', want: 'm' }, { key: 'joint_b', want: 'glimmer' }, { key: 'paste_b', want: 'keine' }], 'Aufbau B: Profil mittel, Glimmerscheibe, ohne Wärmeleitpaste');
      numRow(r, U.numAns(a), { label: 'Um wie viel Kelvin Aufbau B heißer wird als Aufbau A', refs: [{ v: v.dTj }], tol: 0.05, unit: 'K', digits: 2, wrong: [
        { v: v.dCK, msg: 'Du hast den Unterschied der Wärmewiderstände {sym:Rth_CK} angegeben (in K/W). Der Temperaturunterschied ist dieser Unterschied mal die Verlustleistung.' },
        { v: v.pv * v.ckB, msg: 'Du hast die Verlustleistung mit dem ganzen {sym:Rth_CK} von Aufbau B multipliziert. Nur der Unterschied zu Aufbau A zählt.' },
        { v: v.tjB, msg: 'Du hast die Sperrschichttemperatur von Aufbau B angegeben. Gefragt ist der Unterschied zu Aufbau A.' },
        { v: v.tjA, msg: 'Du hast die Sperrschichttemperatur von Aufbau A angegeben. Gefragt ist der Unterschied der beiden Aufbauten.' }] });
    });
    return { vals, check, OWN, FIX,
      text() { const v = vals(); return 'Im Vergleich-Prüfstand tragen zwei gleiche Aufbauten dieselbe Verlustleistung: ein 7805 mit ' + f(v.pv) + ' W bei ' + f(v.ta) + ' °C Umgebung. Beide sitzen auf dem Profil mittel mit Glimmerscheibe. Aufbau A hat dünn aufgetragene Wärmeleitpaste, Aufbau B keine. Stelle beide ein und gib an, um wie viel Kelvin die Sperrschicht von Aufbau B im Beharrungszustand heißer wird.'; },
      hint() { const v = vals(); return [
        'Ohne Wärmeleitpaste bleiben Luftspalte zwischen Gehäuse und Glimmerscheibe: Der Wärmewiderstand des Übergangs {sym:Rth_CK} steigt. Alle anderen Glieder bleiben gleich, also kommt der Unterschied nur von diesem einen Glied: ΔT = P · ΔRth.',
        'Aufbau A: {sym:Rth_CK} = ' + f(v.ckA) + ' K/W, Aufbau B: {sym:Rth_CK} = ' + f(v.ckB) + ' K/W. Der Unterschied beträgt ' + f(v.dCK) + ' K/W und liegt am gleichen Wärmestrom von ' + f(v.pv) + ' W.',
        'Musterlösung: ΔT = ' + f(v.pv) + ' W · ' + f(v.dCK) + ' K/W = ' + f(v.dTj, 2) + ' K. Probe: {sym:Tj} von A = ' + f(v.tjA, 2) + ' °C, von B = ' + f(v.tjB, 2) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th7: 7805 direkt montieren */
  const M7 = (() => {
    const OWN = ['heatsink', 'joint', 'paste', 'bushing', 'screw', 'ksPot'], FIX = Object.assign({}, LIN, { ue: 12, iLoad: 0.5, iq: true, ta: 25 });
    const vals = () => once('v7', () => {
      const C = CORE(), dev = C.devices['7805'], opts = ['keine', 'duenn', 'dick'].map(p => ({ p, ck: rthCK('TO-220', 'direkt', p, 'fest') })), best = opts.slice().sort((x, y) => x.ck - y.ck)[0];
      return { potText: dev.tab.potText, pot: dev.tab.pot, ckDirekt: best.ck, bestPaste: best.p, ckKeine: opts[0].ck, ckDick: opts[2].ck, ckGlimmer: rthCK('TO-220', 'glimmer', 'duenn'), ckLocker: rthCK('TO-220', 'direkt', best.p, 'locker') };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, Object.assign({}, FIX)), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'heatsink', want: 'm' }], 'Der 7805 sitzt auf dem Profil mittel');
      setRow(r, 'linear', eff, [{ key: 'ksPot', want: 'masse' }], 'Der Kühlkörper liegt an Gerätemasse');
      const ck = sim.chain && sim.chain.rthCK, joint = eff.joint === 'direkt';
      r(joint, 'Der 7805 ist direkt montiert, ohne Isolierscheibe', 'Im Prüfstand ist „' + olabel('linear', 'joint', eff.joint) + '“ eingestellt. Die Fahne des 7805 liegt an ' + v.potText + ', der Kühlkörper ebenfalls: Es gibt nichts zu isolieren. Jede Isolierscheibe vergrößert nur {sym:Rth_CK}' + (fin(ck) ? ' (jetzt ' + kW(ck) + ' statt ' + kW(v.ckDirekt) + ' bei direkter Montage mit dünner Paste)' : '') + '.');
      r(eff.paste === v.bestPaste, 'Die Wärmeleitpaste ist so aufgetragen, dass {sym:Rth_CK} bei direkter Montage am kleinsten ist',
        'Im Prüfstand steht die Paste auf „' + olabel('linear', 'paste', eff.paste) + '“: Bei direkter Montage ist {sym:Rth_CK} dann ' + kW(rthCK('TO-220', 'direkt', eff.paste, 'fest')) + ', am kleinsten ist es mit „' + olabel('linear', 'paste', v.bestPaste) + '“ (' + kW(v.ckDirekt) + ').');
      r(eff.screw === 'fest', 'Die Schraube ist fest angezogen', 'Eine lockere Schraube lässt einen Spalt: {sym:Rth_CK} steigt bei direkter Montage von ' + kW(v.ckDirekt) + ' auf ' + kW(v.ckLocker) + '.');
      r(sim.ok && sim.st.short === false, 'Der Aufbau hat keinen Kurzschluss', 'Der Prüfstand meldet einen Kurzschluss zwischen Fahne und Kühlkörper.');
    });
    return { vals, check, OWN, FIX,
      text() { const v = vals(); return 'Beim 7805 liegt die Metallfahne an ' + v.potText + '. Der Kühlkörper im Gerät liegt ebenfalls an Gerätemasse. Baue den 7805 so auf das Profil mittel, dass der Wärmewiderstand des Übergangs {sym:Rth_CK} am kleinsten ist und der Prüfstand keinen Kurzschluss meldet. Braucht der Aufbau eine Isolierscheibe?'; },
      hint() { const v = vals(); return [
        'Eine Isolierscheibe schützt davor, dass die Fahne eine Spannung auf den Kühlkörper bringt. Die Scheibe bremst aber die Wärme: Sie vergrößert {sym:Rth_CK}. Frage dich, auf welchem Potenzial Fahne und Kühlkörper liegen.',
        'Fahne und Kühlkörper liegen auf demselben Potenzial (' + v.potText + '): Eine Isolierscheibe ist nicht nötig. Direkt montiert mit dünner Wärmeleitpaste ist {sym:Rth_CK} = ' + kW(v.ckDirekt) + ', mit Glimmerscheibe und Paste wären es ' + kW(v.ckGlimmer) + '.',
        'Musterlösung: Übergang „direkt“, Wärmeleitpaste dünn, Schraube fest angezogen, Kühlkörper an Gerätemasse. Dann ist {sym:Rth_CK} = ' + kW(v.ckDirekt) + '. Ohne Paste wären es ' + kW(v.ckKeine) + ', mit dick aufgetragener Paste ' + kW(v.ckDick) + '.'
      ]; } };
  })();

  /* ====================================================================== th8: LM317 ohne Isolierscheibe */
  const M8 = (() => {
    const OWN = ['device', 'heatsink', 'joint', 'paste', 'bushing', 'screw', 'ksPot'], FIX = Object.assign({}, LIN, { device: 'lm317', ue: 12, ua: 5, iLoad: 0.5, iq: true, ta: 25 });
    const vals = () => once('v8', () => {
      const dev = CORE().devices.lm317;
      return { potText: dev.tab.potText, pot: dev.tab.pot };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'device', want: 'lm317' }], 'Der Regler ist weiter der LM317');
      setRow(r, 'linear', eff, [{ key: 'ksPot', want: 'masse' }], 'Der Kühlkörper bleibt an Gerätemasse');
      r(eff.joint !== 'direkt', 'Zwischen Gehäuse und Kühlkörper liegt eine Isolierscheibe', 'Im Prüfstand ist „' + olabel('linear', 'joint', eff.joint) + '“ eingestellt: Die Fahne des LM317 liegt am Ausgang und berührt den Kühlkörper direkt.');
      r(eff.bushing === true && eff.joint !== 'direkt', 'Die Isolierbuchse ist eingesetzt', eff.joint === 'direkt' ? 'Eine Isolierbuchse gehört zur Isolierscheibe; ohne Scheibe gibt es nichts zu isolieren.' : 'Ohne Isolierbuchse berührt die Schraube die Fahne und den Kühlkörper: Sie überbrückt die Isolierscheibe.');
      r(sim.ok && sim.st.short === false, 'Der Prüfstand meldet keinen Kurzschluss', 'Der Prüfstand meldet weiter einen Kurzschluss zwischen Fahne und Kühlkörper.');
    });
    return { vals, check, OWN, FIX,
      text() { const v = vals(); return 'Ein LM317 steckt ohne Isolierscheibe auf dem Profil mittel. Seine Fahne liegt an ' + v.potText + ', der Kühlkörper liegt an Gerätemasse: Der Prüfstand meldet einen Kurzschluss. Behebe den Fehler, ohne den Kühlkörper von der Gerätemasse zu trennen.'; },
      hint() { return [
        'Beim LM317 liegt die Fahne nicht an Masse, sondern am Ausgang. Ein Kühlkörper, der an Masse liegt, schließt den Ausgang kurz, wenn er die Fahne berührt. Die Fahne muss elektrisch vom Kühlkörper getrennt sein.',
        'Du brauchst zwei Teile: eine Isolierscheibe zwischen Gehäuse und Kühlkörper und eine Isolierbuchse für die Schraube. Die Scheibe allein genügt nicht, weil die Schraube durch die Fahne führt.',
        'Musterlösung: Übergang „Glimmerscheibe“ (oder Silikonfolie), Isolierbuchse eingesetzt, Wärmeleitpaste dünn, Kühlkörper bleibt an Gerätemasse. Dann meldet der Prüfstand keinen Kurzschluss mehr.'
      ]; } };
  })();

  /* ====================================================================== th9: kleinsten Kuehlkoerper waehlen */
  const M9 = (() => {
    const UE = 12, IA = 0.6, TA = 40, OWN = ['heatsink', 'joint', 'paste'], FIX = Object.assign({}, LIN, { ue: 12, iLoad: 0.6, iq: true, ta: TA });
    const CFG = { device: '7805', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v9', () => {
      const C = CORE(), dev = C.devices['7805'], p0 = C.power.linear(UE, dev.uaFix, IA).p, p = C.power.linear(UE, dev.uaFix, IA, dev.iq).p, ck = rthCK('TO-220', 'glimmer', 'duenn');
      const k = C.rthKerf(Object.assign({ heatsink: 'm' }, CFG), p, TA), k0 = C.rthKerf(Object.assign({ heatsink: 'm' }, CFG), p0, TA), ch = smallest(k.value);
      const idx = CAT.indexOf(ch.id), below = idx > 0 ? CAT[idx - 1] : null;
      const tjOf = id => C.steady(Object.assign({ heatsink: id }, CFG), p, TA).tj;
      return { ue: UE, ua: dev.uaFix, ia: IA, ta: TA, du: UE - dev.uaFix, p0, p, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, dT: dev.tjMax - TA, rthMax: (dev.tjMax - TA) / p, erf: k.value, erf0: k0.value, choice: ch.id, choiceName: HSNAME[ch.id], rthK: ch.rthK, tjChoice: tjOf(ch.id), below, belowName: below ? HSNAME[below] : '', rthBelow: below ? hsRth(below) : NaN, tjBelow: below ? tjOf(below) : NaN, iqmA: dev.iq * 1000, tjFrei: TA + p * dev.rthJA, rthJA: dev.rthJA };
    });
    const tables = () => [tbl('Kühlkörper im Prüfstand (freie Konvektion, senkrecht)', ['Kühlkörper', '{sym:Rth_K}'], CAT.map(id => [HSNAME[id], kW(hsRth(id))]))];
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), C = CORE(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }], 'Der Übergang ist wie in der Aufgabe aufgebaut (Glimmerscheibe, Wärmeleitpaste dünn)');
      const st = sim.steady || {}, tj = st.tj, hs = eff.heatsink;
      r(fin(tj) && tj <= v.tjMax + 1e-9, '{sym:Tj} bleibt im Beharrungszustand höchstens bei {sym:Tjmax} = ' + f(v.tjMax) + ' °C',
        'Im Beharrungszustand beträgt {sym:Tj} ' + f(tj, 1) + ' °C bei ' + f(st.pv, 2) + ' W ({sym:Rth_ges} = ' + kW(sim.chain && sim.chain.rthTotal) + '), erlaubt sind ' + f(v.tjMax) + ' °C. Der Kühlkörper ist zu klein: Wähle einen mit kleinerem {sym:Rth_K}.');
      let why = '';
      if (hs === 'none') why = 'Du hast keinen Kühlkörper gewählt.';
      else if (hs === 'blech') why = 'Das Kühlblech gehört nicht zur Auswahl der Aufgabe (Tabelle).';
      else if (!CAT.includes(hs)) why = 'Dieser Kühlkörper steht nicht in der Tabelle.';
      else if (CAT.indexOf(hs) > CAT.indexOf(v.choice)) why = 'Der Kühlkörper ist größer als nötig: ' + v.choiceName + ' (' + kW(v.rthK) + ') hält {sym:Tj} schon bei ' + f(v.tjChoice, 1) + ' °C und damit unter ' + f(v.tjMax) + ' °C.';
      else why = 'Der Kühlkörper ist zu klein. Der erforderliche Wärmewiderstand beträgt ' + kW(v.erf) + '; ' + HSNAME[hs] + ' hat ' + kW(hsRth(hs)) + '.';
      r(hs === v.choice, 'Der gewählte Kühlkörper ist der kleinste, der ausreicht', why);
    });
    return { vals, check, tables, OWN, FIX, CFG,
      text() { const v = vals(); return 'Der 7805 bekommt ' + f(v.ue) + ' V und liefert ' + f(v.ia) + ' A bei ' + f(v.ua) + ' V Ausgangsspannung. Im Gerät herrschen ' + f(v.ta) + ' °C. Er wird mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste auf einen Kühlkörper geschraubt. Wähle aus der Tabelle den kleinsten Kühlkörper, bei dem die Sperrschichttemperatur im Beharrungszustand höchstens {sym:Tjmax} = ' + f(v.tjMax) + ' °C erreicht. Der Prüfstand rechnet den Ruhestrom (' + f(v.iqmA) + ' mA) mit; für deine Rechnung darfst du ihn weglassen.'; },
      hint() { const v = vals(); return [
        'Rechne rückwärts: Aus dem erlaubten Temperaturunterschied und der Verlustleistung folgt der größte erlaubte Gesamt-Wärmewiderstand. Davon ziehst du die festen Glieder {sym:Rth_JC} und {sym:Rth_CK} ab. Der Rest ist der größte erlaubte Wert für den Kühlkörper: Dein Kühlkörper darf diesen Wert nicht überschreiten, soll aber so klein wie möglich bleiben.',
        'P = (' + f(v.ue) + ' V − ' + f(v.ua) + ' V) · ' + f(v.ia) + ' A = ' + f(v.p0, 2) + ' W (mit Ruhestrom ' + f(v.p, 2) + ' W). Erlaubter Unterschied: ' + f(v.tjMax) + ' °C − ' + f(v.ta) + ' °C = ' + f(v.dT) + ' K. {sym:Rth_ges},max = ' + f(v.dT) + ' K / ' + f(v.p, 2) + ' W = ' + f(v.rthMax, 2) + ' K/W. Davon gehen {sym:Rth_JC} = ' + f(v.rthJC) + ' K/W und {sym:Rth_CK} = ' + f(v.rthCK) + ' K/W ab.',
        'Musterlösung: {sym:Rth_Kerf} = ' + f(v.erf, 2) + ' K/W (ohne Ruhestrom ' + f(v.erf0, 2) + ' K/W). ' + (v.below ? v.belowName + ' hat ' + kW(v.rthBelow) + ', das ist zu viel ({sym:Tj} = ' + f(v.tjBelow, 1) + ' °C). ' : '') + v.choiceName + ' hat ' + kW(v.rthK) + ' und reicht: {sym:Tj} = ' + f(v.tjChoice, 1) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th10: zulaessige Verlustleistung des BD139 */
  const M10 = (() => {
    const TA = 50, OWN = ['ta', 'heatsink', 'joint', 'paste'], FIX = { mode: 'ap', uce: 6, ic: 0.3, count: 1, bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', nonlin: false, runaway: false, re: 0 };
    const CFG = { device: 'bd139', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v10', () => {
      const C = CORE(), dev = C.devices.bd139, ck = rthCK('TO-126', 'glimmer', 'duenn'), rk = hsRth('m'), tot = dev.rthJC + ck + rk, pz = C.pzul(CFG, TA);
      return { ta: TA, ta25: 25, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, rthK: rk, rthTot: tot, dT: dev.tjMax - TA, pzul: pz, pzul25: C.pzul(CFG, 25), dT25: dev.tjMax - 25, pNoCK: (dev.tjMax - TA) / (dev.rthJC + rk), pFrei: (dev.tjMax - TA) / dev.rthJA, rthJA: dev.rthJA, ptotFrei: dev.ptot, tol: 2 };
    });
    const tables = () => { const v = vals(); return [
      tbl('Bauteil BD139 (Übungsdatenblatt)', ['Größe', 'Wert'], [['{sym:Tjmax}', f(v.tjMax) + ' °C'], ['{sym:Rth_JC}', kW(v.rthJC)]]),
      tbl('Aufbau', ['Glied', 'Wärmewiderstand'], [['{sym:Rth_CK} (Glimmerscheibe, Wärmeleitpaste dünn)', kW(v.rthCK)], ['{sym:Rth_K} (Profil mittel)', kW(v.rthK)]])
    ]; };
    const check = mk('transistor', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'transistor', OWN, FIX), sim = snap('transistor', eff);
      inputRow(c, r, sim, a, 'transistor');
      setRow(r, 'transistor', eff, [{ key: 'ta', want: v.ta }], 'Umgebungstemperatur ' + f(v.ta) + ' °C eingestellt');
      setRow(r, 'transistor', eff, [{ key: 'heatsink', want: 'm' }, { key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }], 'Der BD139 sitzt auf dem Profil mittel mit Glimmerscheibe und Wärmeleitpaste dünn');
      numRow(r, U.numAns(a), { label: 'Zulässige Verlustleistung des BD139 am Kühlkörper', refs: [{ v: v.pzul }], tol: 0.02, unit: 'W', digits: 2, wrong: [
        { v: v.pzul25, msg: 'Du hast mit 25 °C Umgebung gerechnet. Hier gilt die eingestellte Umgebungstemperatur von ' + f(v.ta) + ' °C: Je wärmer die Umgebung, desto kleiner die zulässige Verlustleistung.' },
        { v: v.pNoCK, msg: 'Du hast {sym:Rth_CK} vergessen. Der Übergang mit Glimmerscheibe und Wärmeleitpaste gehört zum Gesamt-Wärmewiderstand.' },
        { v: v.pFrei, msg: 'Du hast den Wärmewiderstand ohne Kühlkörper ({sym:Rth_JA}) benutzt. Der BD139 sitzt hier auf dem Profil mittel.' }] });
    });
    return { vals, check, tables, OWN, FIX, CFG,
      text() { const v = vals(); return 'Ein BD139 sitzt auf dem Profil mittel, mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste. Die Umgebung hat ' + f(v.ta) + ' °C. Die Werte stehen in den Tabellen. Stelle den Prüfstand so ein und berechne, wie viel Verlustleistung der Transistor höchstens umsetzen darf, damit die Sperrschichttemperatur {sym:Tjmax} nicht überschreitet.'; },
      hint() { const v = vals(); return [
        'Die zulässige Verlustleistung ist die größte Leistung, bei der die Sperrschicht gerade {sym:Tjmax} erreicht. Du stellst die Kettenformel um: Der erlaubte Temperaturunterschied geteilt durch den Gesamt-Wärmewiderstand.',
        'Erlaubter Unterschied: ' + f(v.tjMax) + ' °C − ' + f(v.ta) + ' °C = ' + f(v.dT) + ' K. Gesamt-Wärmewiderstand: {sym:Rth_ges} = ' + f(v.rthJC) + ' K/W + ' + f(v.rthCK) + ' K/W + ' + f(v.rthK) + ' K/W = ' + f(v.rthTot) + ' K/W.',
        'Musterlösung: P_zul = ' + f(v.dT) + ' K / ' + f(v.rthTot) + ' K/W = ' + f(v.pzul, 3) + ' W. Bei ' + f(v.ta25) + ' °C Umgebung wären es ' + f(v.pzul25, 3) + ' W: Je wärmer die Umgebung, desto weniger darf der Transistor umsetzen.'
      ]; } };
  })();

  /* ====================================================================== th11 und th12: Zeitverhalten */
  /* Aufheizkurve des Kuehlkoerpers aus der Pruefstandssimulation (kalt gestartet): Zeit, bei der die Kuehlkoerpertemperatur den Anteil frac ihres Anstiegs erreicht (Minuten Prozesszeit) */
  function tFrac(rigId, ctl, key, steadyVal, ta, frac, T, stepS) {
    const res = U.run(rigId, ctl, [], T, { settle: false, sampleS: stepS }), L = U.smp(res), target = ta + frac * (steadyVal - ta);
    let prev = { t: 0, v: ta };
    for (const s of L) { const v = s.state[key]; if (v >= target) { const q = v === prev.v ? 0 : (target - prev.v) / (v - prev.v); return (prev.t + q * (s.t - prev.t)) / 60; } prev = { t: s.t, v }; }
    return NaN;
  }
  const TIMEFIX = Object.assign({}, LIN, { ue: 12, iLoad: 0.5, iq: false, ta: 25 });
  const TIMEOWN = ['ue', 'iLoad', 'ta', 'heatsink', 'joint', 'paste'];
  const M11 = (() => {
    const KK = 'm', CFG = { device: '7805', heatsink: KK, joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v11', () => {
      const C = CORE(), dev = C.devices['7805'], p = C.power.linear(12, dev.uaFix, 0.5).p, st = C.steady(CFG, p, 25);
      const ctl = fullCtl('linear', Object.assign({}, TIMEFIX, { heatsink: KK, joint: 'glimmer', paste: 'duenn' }));
      const rig = RIGS('linear').create('linear', { seed: 1, noDraw: true }); Object.keys(ctl).forEach(k => { rig.setControl(k, ctl[k]); });
      const id = rig.identify(), t63 = tFrac('linear', ctl, 'tk', st.tk, 25, 1 - Math.exp(-1), 6000, 5), tj63 = tFrac('linear', ctl, 'tj', st.tj, 25, 1 - Math.exp(-1), 6000, 5);
      return { p, ta: 25, rthK: st.rthK, tkEnd: st.tk, dK: st.dK, frac: 1 - Math.exp(-1), p63: 100 * (1 - Math.exp(-1)), dK63: (1 - Math.exp(-1)) * st.dK, tk63: 25 + (1 - Math.exp(-1)) * st.dK, t63: t63, tau: id.tau / 60, tj63, ue: 12, ia: 0.5, tol: 15 };
    });
    const check = mk('linear', TIMEOWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', TIMEOWN, TIMEFIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'ue', want: v.ue }, { key: 'iLoad', want: v.ia }, { key: 'ta', want: v.ta }, { key: 'heatsink', want: KK }, { key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }],
        'Prüfstand wie in der Aufgabe eingestellt (' + f(v.ue) + ' V, ' + f(v.ia) + ' A, Profil mittel, Glimmerscheibe, Wärmeleitpaste dünn)');
      numRow(r, U.numAns(a), { label: 'Zeitkonstante des Kühlkörpers (63 % des Anstiegs von {sym:Tk}), in Minuten Prozesszeit', refs: [{ v: v.t63 }, { v: v.tau }], tol: 0.15, unit: 'min', digits: 1, wrong: [
        { v: v.tj63, msg: 'Du hast die 63-%-Marke an der Sperrschichttemperatur {sym:Tj} abgelesen. {sym:Tj} steigt zuerst schnell (kleine Wärmekapazität) und erreicht die Marke viel früher. Nimm die Marke am Verlauf des Kühlkörpers {sym:Tk}.' },
        { v: v.t63 * 60, msg: 'Du hast die Zeit in Sekunden eingetragen. Gefragt ist die Prozesszeit in Minuten.' }] });
    });
    return { vals, check, OWN: TIMEOWN, FIX: TIMEFIX,
      text() { const v = vals(); return 'Der 7805 sitzt auf dem Profil mittel (Glimmerscheibe, Wärmeleitpaste dünn), ' + f(v.ue) + ' V Eingangsspannung, ' + f(v.ia) + ' A Laststrom, ' + f(v.ta) + ' °C Umgebung. Starte den Prüfstand kalt (alles auf Umgebungstemperatur) und zeichne die Aufheizkurve auf. Lies ab, nach wie vielen Minuten Prozesszeit der Kühlkörper ({sym:Tk}) im Verlauf des Schreibers ' + f(v.p63, 0) + ' % seines Temperaturanstiegs erreicht hat: Das ist die Zeitkonstante des Aufbaus.'; },
      hint() { const v = vals(); return [
        'Ein Körper, der über einen Wärmewiderstand aufheizt, verhält sich wie ein Kondensator, der über einen Widerstand geladen wird: Der Anstieg wird immer flacher. Nach einer Zeitkonstante sind 63 % des gesamten Anstiegs erreicht. Du brauchst also zuerst den Endwert und den Anstieg.',
        'Endwert: {sym:Tk} = ' + f(v.ta) + ' °C + ' + f(v.p, 2) + ' W · ' + f(v.rthK) + ' K/W = ' + f(v.tkEnd, 2) + ' °C, der Anstieg beträgt ' + f(v.dK, 2) + ' K. 63 % davon sind ' + f(v.dK63, 2) + ' K, also gilt die Marke ' + f(v.tk63, 2) + ' °C. Lies ab, zu welcher Zeit {sym:Tk} im Schreiber diese Marke erreicht.',
        'Musterlösung: {sym:Tk} erreicht ' + f(v.tk63, 2) + ' °C nach ' + f(v.t63, 1) + ' min Prozesszeit (die Zeitkonstante des Aufbaus nach Prüfstand: ' + f(v.tau, 1) + ' min). Die Sperrschichttemperatur {sym:Tj} erreicht ihre 63 % dagegen schon nach ' + f(v.tj63, 1) + ' min: Sie ist nicht die richtige Kurve für diese Aufgabe.'
      ]; } };
  })();

  const M12 = (() => {
    const KK = 'l', CFG = { device: '7805', heatsink: KK, joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v12', () => {
      const C = CORE(), dev = C.devices['7805'], p = C.power.linear(12, dev.uaFix, 0.5).p, st = C.steady(CFG, p, 25);
      const ctl = fullCtl('linear', Object.assign({}, TIMEFIX, { heatsink: KK, joint: 'glimmer', paste: 'duenn' }));
      const rig = RIGS('linear').create('linear', { seed: 1, noDraw: true }); Object.keys(ctl).forEach(k => { rig.setControl(k, ctl[k]); });
      const id = rig.identify(), t90 = tFrac('linear', ctl, 'tk', st.tk, 25, 0.9, 12000, 10), tau = id.tau / 60;
      return { p, ta: 25, frac: 0.9, p90: 90, p63: 100 * (1 - Math.exp(-1)), rthK: st.rthK, tkEnd: st.tk, dK: st.dK, tau, k90: -Math.log(1 - 0.9), t90, t90tau: C.tFraction(id.tau, 0.9) / 60, tkMark: 25 + 0.9 * st.dK, dK90: 0.9 * st.dK, t95: 3 * tau, ue: 12, ia: 0.5, tol: 8 };
    });
    const check = mk('linear', TIMEOWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', TIMEOWN, TIMEFIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'ue', want: v.ue }, { key: 'iLoad', want: v.ia }, { key: 'ta', want: v.ta }, { key: 'heatsink', want: KK }, { key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }],
        'Prüfstand wie in der Aufgabe eingestellt (' + f(v.ue) + ' V, ' + f(v.ia) + ' A, Profil groß, Glimmerscheibe, Wärmeleitpaste dünn)');
      numRow(r, U.numAns(a), { label: 'Zeit bis 90 % des Anstiegs von {sym:Tk}, in Minuten Prozesszeit', refs: [{ v: v.t90 }, { v: v.t90tau }], tol: 0.08, unit: 'min', digits: 1, wrong: [
        { v: v.tau, msg: 'Du hast die Zeitkonstante angegeben. Nach einer Zeitkonstante sind erst 63 % des Anstiegs erreicht.' },
        { v: v.t95, msg: 'Du hast drei Zeitkonstanten angegeben. Dann sind schon 95 % des Anstiegs erreicht, gefragt sind 90 %.' },
        { v: v.t90 * 60, msg: 'Du hast die Zeit in Sekunden eingetragen. Gefragt ist die Prozesszeit in Minuten.' }] });
    });
    return { vals, check, OWN: TIMEOWN, FIX: TIMEFIX,
      text() { const v = vals(); return 'Der 7805 sitzt auf dem Profil groß (Glimmerscheibe, Wärmeleitpaste dünn), ' + f(v.ue) + ' V Eingangsspannung, ' + f(v.ia) + ' A Laststrom, ' + f(v.ta) + ' °C Umgebung. Der Aufbau startet kalt. Berechne, nach wie vielen Minuten Prozesszeit der Kühlkörper ' + f(v.p90, 0) + ' % seines gesamten Temperaturanstiegs (von {sym:Ta} bis zum Endwert von {sym:Tk}) erreicht hat. Du kannst die Zeit auch im Schreiber ablesen.'; },
      hint() { const v = vals(); return [
        'Der Anstieg folgt einer e-Funktion: Zum Zeitpunkt t sind 1 − e^(−t/τ) des Anstiegs erreicht. Löst du nach der Zeit auf, gilt t = −τ · ln(1 − Anteil). Für 90 % brauchst du also ein Vielfaches der Zeitkonstante τ des Aufbaus; τ zeigt dir der Prüfstand (oder du liest sie wie in der vorigen Aufgabe ab).',
        'Der Faktor für 90 %: −ln(1 − ' + f(v.frac) + ') = ' + f(v.k90, 3) + '. Die Zeitkonstante des Aufbaus beträgt ' + f(v.tau, 1) + ' min Prozesszeit. Der Anstieg des Kühlkörpers ist ' + f(v.dK, 2) + ' K, die 90-%-Marke liegt bei {sym:Tk} = ' + f(v.tkMark, 2) + ' °C.',
        'Musterlösung: t = ' + f(v.k90, 3) + ' · ' + f(v.tau, 1) + ' min = ' + f(v.t90tau, 1) + ' min. Die Simulation des Prüfstands erreicht die Marke nach ' + f(v.t90, 1) + ' min Prozesszeit; beide Werte gelten.'
      ]; } };
  })();

  /* ====================================================================== th13: ungünstigster Fall bei schwankender Eingangsspannung */
  const M13 = (() => {
    const UE1 = 12, UE2 = 16, IA = 0.5, TA = 40, OWN = ['ue', 'iLoad', 'ta', 'joint', 'paste'], FIX = Object.assign({}, LIN, { iq: true, heatsink: 'm' });
    const CFG = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v13', () => {
      const C = CORE(), dev = C.devices['7805'], ua = dev.uaFix, pw = C.power.linear(UE2, ua, IA).p, pq = C.power.linear(UE2, ua, IA, dev.iq).p, ck = rthCK('TO-220', 'glimmer', 'duenn');
      const erf = (p, ta) => C.rthKerf(CFG, p, ta == null ? TA : ta).value, pMin = C.power.linear(UE1, ua, IA).p, pMid = C.power.linear((UE1 + UE2) / 2, ua, IA).p;
      return { ue1: UE1, ue2: UE2, ueMid: (UE1 + UE2) / 2, ua, ia: IA, ta: TA, du: UE2 - ua, p: pw, pIq: pq, pMin, pMid, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, dT: dev.tjMax - TA, rthMax: (dev.tjMax - TA) / pw, erf: erf(pw), erfIq: erf(pq), erfMin: erf(pMin), erfMid: erf(pMid), erf25: erf(pw, 25), erfNoCK: (dev.tjMax - TA) / pw - dev.rthJC, erfNoJC: (dev.tjMax - TA) / pw - ck, ck, tol: 2, iqmA: dev.iq * 1000 };
    });
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'ue', want: v.ue2 }, { key: 'iLoad', want: v.ia }, { key: 'ta', want: v.ta }, { key: 'joint', want: 'glimmer' }, { key: 'paste', want: 'duenn' }],
        'Prüfstand auf den ungünstigsten Fall eingestellt (' + f(v.ue2) + ' V, ' + f(v.ia) + ' A, ' + f(v.ta) + ' °C, Glimmerscheibe, Wärmeleitpaste dünn)');
      numRow(r, U.numAns(a), { label: 'Erforderlicher Wärmewiderstand {sym:Rth_Kerf} des Kühlkörpers im ungünstigsten Fall', refs: [{ v: v.erf }, { v: v.erfIq }], tol: 0.02, unit: 'K/W', digits: 2, wrong: [
        { v: v.erfMin, msg: 'Du hast mit der niedrigen Eingangsspannung ' + f(v.ue1) + ' V gerechnet. Der ungünstigste Fall ist die höchste Eingangsspannung ' + f(v.ue2) + ' V: Dann ist die Verlustleistung am größten.' },
        { v: v.erfMid, msg: 'Du hast mit dem Mittelwert ' + f(v.ueMid) + ' V gerechnet. Der Kühlkörper muss für die höchste Eingangsspannung ' + f(v.ue2) + ' V ausreichen.' },
        { v: v.erf25, msg: 'Du hast mit 25 °C Umgebung gerechnet. In der Aufgabe herrschen ' + f(v.ta) + ' °C.' },
        { v: v.erfNoCK, msg: 'Du hast {sym:Rth_CK} nicht abgezogen. Der Übergang mit Glimmerscheibe und Wärmeleitpaste liegt vor dem Kühlkörper in der Reihe.' },
        { v: v.erfNoJC, msg: 'Du hast {sym:Rth_JC} nicht abgezogen. Der Weg von der Sperrschicht zum Gehäuse gehört zur Reihe.' },
        { v: v.rthMax, msg: 'Du hast den Gesamt-Wärmewiderstand angegeben, ohne {sym:Rth_JC} und {sym:Rth_CK} abzuziehen.' }] });
    });
    return { vals, check, OWN, FIX, CFG,
      text() { const v = vals(); return 'Die Eingangsspannung eines 7805 schwankt zwischen ' + f(v.ue1) + ' V und ' + f(v.ue2) + ' V, der Laststrom beträgt ' + f(v.ia) + ' A. Im Gerät herrschen ' + f(v.ta) + ' °C. Der 7805 wird mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste auf einen Kühlkörper geschraubt. Stelle den ungünstigsten Fall im Prüfstand ein und berechne dafür den erforderlichen Wärmewiderstand {sym:Rth_Kerf} des Kühlkörpers, bei dem {sym:Tj} gerade {sym:Tjmax} = ' + f(v.tjMax) + ' °C erreicht. Den Ruhestrom (' + f(v.iqmA) + ' mA) darfst du vernachlässigen; rechnest du ihn mit, gilt auch dieser Wert.'; },
      hint() { const v = vals(); return [
        'Der Kühlkörper muss für den schlimmsten Betriebspunkt reichen, nicht für den mittleren: Das ist die höchste Eingangsspannung, weil der Regler dann die meiste Spannung abbaut. Rechne wie bei jeder Kühlkörperauslegung rückwärts: erlaubter Gesamt-Wärmewiderstand, davon feste Glieder abziehen.',
        'P = (' + f(v.ue2) + ' V − ' + f(v.ua) + ' V) · ' + f(v.ia) + ' A = ' + f(v.p, 2) + ' W. {sym:Rth_ges},max = (' + f(v.tjMax) + ' °C − ' + f(v.ta) + ' °C) / ' + f(v.p, 2) + ' W = ' + f(v.rthMax, 2) + ' K/W. Davon gehen {sym:Rth_JC} = ' + f(v.rthJC) + ' K/W und {sym:Rth_CK} = ' + f(v.rthCK) + ' K/W ab.',
        'Musterlösung: {sym:Rth_Kerf} = ' + f(v.rthMax, 2) + ' K/W − ' + f(v.rthJC) + ' K/W − ' + f(v.rthCK) + ' K/W = ' + f(v.erf, 2) + ' K/W (mit Ruhestrom ' + f(v.erfIq, 2) + ' K/W). Bei nur ' + f(v.ue1) + ' V wären es ' + f(v.erfMin, 2) + ' K/W: Dieser Kühlkörper würde bei ' + f(v.ue2) + ' V nicht reichen.'
      ]; } };
  })();

  /* ====================================================================== th14: Worst-Case am LM317 */
  const M14 = (() => {
    const UE = 15, RL = 10, OWN = ['device', 'loadMode', 'rLoad', 'ue', 'ua'], FIX = Object.assign({}, LIN, { device: 'lm317', iq: true, ta: 25, heatsink: 'none' });
    const vals = () => once('v14', () => {
      const C = CORE(), uaM = UE / 2, pM = (UE - uaM) * uaM / RL, e = C.devices.lm317.elec({ ue: UE, ua: uaM, loadMode: 'widerstand', rLoad: RL, tj: 25, iq: true });
      return { vier: 4, ue: UE, rl: RL, ua: uaM, ia: uaM / RL, p: pM, pRig: e.pv, pUe: UE * uaM / RL, pNoQ: UE * UE / RL, ueVier: UE * UE / (4 * RL), tolUa: 3, tolP: 3, pBei5: (UE - 5) * 5 / RL, pBei10: (UE - 10) * 10 / RL };
    });
    const fields = [{ key: 'ua', label: 'Ausgangsspannung {sym:Ua} bei größter Verlustleistung', unit: 'V' }, { key: 'p', label: 'Größte Verlustleistung {sym:P}', unit: 'W' }];
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff);
      inputRow(c, r, sim, a, 'linear');
      setRow(r, 'linear', eff, [{ key: 'device', want: 'lm317' }, { key: 'loadMode', want: 'widerstand' }, { key: 'rLoad', want: v.rl }, { key: 'ue', want: v.ue }], 'Prüfstand wie in der Aufgabe eingestellt (LM317, ' + f(v.ue) + ' V Eingang, Lastwiderstand ' + f(v.rl) + ' Ω)');
      numRow(r, U.fieldNum(a, 'ua'), { label: 'Ausgangsspannung bei größter Verlustleistung', refs: [{ v: v.ua }], tol: 0.03, unit: 'V', digits: 2, wrong: [
        { v: v.ue, msg: 'Du hast die Eingangsspannung eingetragen. Bei Ua = Ue fällt am Regler keine Spannung ab: Dort ist die Verlustleistung null, nicht am größten.' }] });
      numRow(r, U.fieldNum(a, 'p'), { label: 'Größte Verlustleistung des LM317', refs: [{ v: v.p }, { v: v.pRig }], tol: 0.03, unit: 'W', digits: 2, wrong: [
        { v: v.pNoQ, msg: 'Du hast Ue² / RL gerechnet. Am Maximum liegt nur die Hälfte von Ue am Regler: Es gilt Ue² / (4 · RL).' },
        { v: v.pUe, msg: 'Du hast Ue · Ia gerechnet. Das ist die aufgenommene Leistung, nicht die Verlustleistung.' }] });
    });
    return { vals, check, fields, OWN, FIX,
      text() { const v = vals(); return 'Ein LM317 bekommt ' + f(v.ue) + ' V Eingangsspannung und speist einen festen Lastwiderstand von ' + f(v.rl) + ' Ω. Du kannst die Ausgangsspannung einstellen. Bei welcher Ausgangsspannung ist die Verlustleistung des Reglers am größten, und wie groß ist sie dann? Stelle den Prüfstand ein und probiere die Ausgangsspannung durch, oder rechne.\nDer Prüfstand rechnet Ruhestrom und Strom durch den Spannungsteiler mit; der Unterschied ist klein und auch dieser Wert gilt.'; },
      hint() { const v = vals(); return [
        'Die Verlustleistung ist (Ue − Ua) · Ia, und bei einem festen Lastwiderstand ist Ia = Ua / RL. Beide Faktoren ändern sich gegenläufig mit Ua: Bei kleinem Ua fließt wenig Strom, bei großem Ua fällt wenig Spannung am Regler ab. Dazwischen liegt ein Maximum.',
        'P(Ua) = (Ue − Ua) · Ua / RL ist eine nach unten geöffnete Parabel mit den Nullstellen Ua = 0 und Ua = Ue = ' + f(v.ue) + ' V. Das Maximum liegt in der Mitte zwischen den Nullstellen. Zur Probe: Bei Ua = 5 V ist P = ' + f(v.pBei5, 3) + ' W, bei Ua = 10 V ist P = ' + f(v.pBei10, 3) + ' W.',
        'Musterlösung: Ua = Ue / 2 = ' + f(v.ua, 2) + ' V; der Strom beträgt ' + f(v.ia, 3) + ' A, P = ' + f(v.ua, 2) + ' V · ' + f(v.ia, 3) + ' A = ' + f(v.p, 3) + ' W (= Ue² / (' + f(v.vier) + ' · RL) = ' + f(v.ueVier, 3) + ' W). Der Prüfstand zeigt ' + f(v.pRig, 3) + ' W.'
      ]; } };
  })();

  /* ====================================================================== th15: 7805 schaltet staendig ab */
  const OBS_S = 14400;                                           // Pruefzeitraum: 240 min Prozesszeit, kalt gestartet
  const M15 = (() => {
    const OWN = ['heatsink', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'], FIX = Object.assign({}, LIN, { ue: 12, iLoad: 0.5, iq: true, ta: 25 });
    const runObs = eff => once('obs' + JSON.stringify(eff), () => U.run('linear', eff, [], OBS_S, { settle: false, sampleS: 120 }));
    const vals = () => once('v15', () => {
      const C = CORE(), dev = C.devices['7805'], p = C.power.linear(12, dev.uaFix, 0.5, dev.iq).p, ck = rthCK('TO-220', 'glimmer', 'duenn');
      const cfg = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, k = C.rthKerf(cfg, p, 25), ch = smallest(k.value);
      const idx = CAT.indexOf(ch.id), below = idx > 0 ? CAT[idx - 1] : null, tjOf = id => C.steady(Object.assign({}, cfg, { heatsink: id }), p, 25).tj;
      const free = runObs(effOfStart());
      return { ue: 12, ia: 0.5, ta: 25, p, tjMax: dev.tjMax, rthJC: dev.rthJC, rthJA: dev.rthJA, rthCK: ck, tjFrei: 25 + p * dev.rthJA, shutOn: dev.shutdown.on, shutOff: dev.shutdown.off, obsMin: OBS_S / 60,
        erf: k.value, choice: ch.id, choiceName: HSNAME[ch.id], rthK: ch.rthK, tjChoice: tjOf(ch.id), below, belowName: below ? HSNAME[below] : '', rthBelow: below ? hsRth(below) : NaN, tjBelow: below ? tjOf(below) : NaN, shutFree: free.metrics.shutCount };
    });
    const effOfStart = () => fullCtl('linear', Object.assign({}, FIX, { heatsink: 'none', joint: 'direkt', paste: 'duenn' }));
    const check = mk('linear', OWN, (c, r, a) => {
      const v = vals(), C = CORE(), eff = effOf(c, 'linear', OWN, FIX), sim = snap('linear', eff), obs = runObs(eff);
      inputRow(c, r, sim, a, 'linear');
      const n = obs.metrics && obs.metrics.shutCount;
      r(n === 0, 'Der Regler schaltet im Prüfzeitraum von ' + f(v.obsMin) + ' min Prozesszeit (kalt gestartet) nie ab',
        'Der Regler schaltet im Prüfzeitraum ' + n + '-mal ab: {sym:Tj} erreicht dabei die Abschalttemperatur (Übungswert ' + f(v.shutOn) + ' °C). Die Abschaltung ist ein Schutz, kein Betriebspunkt: Mit dem Kühlkörper muss {sym:Tj} unter dieser Marke bleiben.');
      const st = sim.steady || {}, tj = st.tj;
      r(fin(tj) && tj <= v.tjMax + 1e-9, '{sym:Tj} bleibt im Beharrungszustand höchstens bei {sym:Tjmax} = ' + f(v.tjMax) + ' °C',
        'Im Beharrungszustand beträgt {sym:Tj} ' + f(tj, 1) + ' °C' + (n === 0 ? ' (unter der Abschalttemperatur, aber über dem Grenzwert {sym:Tjmax}: Der Regler schaltet nicht ab, wird aber über seinen zulässigen Wert betrieben)' : '') + '. Verkleinere {sym:Rth_CK} oder {sym:Rth_K}.');
      const hs = eff.heatsink; let why = '';
      const k = fin(tj) && sim.ok ? C.rthKerf({ device: '7805', heatsink: 'm', joint: eff.joint, paste: eff.paste, screw: eff.screw, bushing: eff.bushing, ksPot: eff.ksPot }, st.pv, eff.ta) : null;
      const ch = k && k.ok ? smallest(k.value, { fan: eff.fan, orient: eff.orient }) : null;
      if (hs === 'none') why = 'Du hast keinen Kühlkörper gewählt.';
      else if (hs === 'blech') why = 'Das Kühlblech ist hier nicht vorgesehen; wähle aus den Kühlkörpern des Prüfstands.';
      else if (!ch || !ch.ok) why = 'Mit diesem Übergang reicht kein Kühlkörper der Auswahl.';
      else if (CAT.indexOf(hs) > CAT.indexOf(ch.id)) why = 'Der Kühlkörper ist größer als nötig: ' + HSNAME[ch.id] + ' (' + kW(ch.rthK) + ' bei deiner Montage) reicht für deinen Aufbau schon aus.';
      else why = 'Der Kühlkörper ist zu klein für deinen Aufbau: erforderlich sind ' + kW(k.value) + ' oder weniger.';
      r(!!ch && ch.ok && hs === ch.id, 'Der Kühlkörper ist nicht größer als nötig', why);
    });
    return { vals, check, OWN, FIX, effOfStart,
      text() { const v = vals(); return 'Ein 7805 setzt bei ' + f(v.ue) + ' V Eingangsspannung und ' + f(v.ia) + ' A Laststrom ohne Kühlkörper Verlustleistung um (der Prüfstand rechnet den Ruhestrom mit: ' + f(v.p, 2) + ' W). Er schaltet ständig ab und wieder an. Behebe das mit einem möglichst kleinen Kühlkörper aus dem Prüfstand. Gültig ist ein Aufbau, bei dem der Regler in ' + f(v.obsMin) + ' min Prozesszeit (kalt gestartet) nie abschaltet, {sym:Tj} im Beharrungszustand höchstens {sym:Tjmax} = ' + f(v.tjMax) + ' °C erreicht und kein größerer Kühlkörper als nötig verbaut ist. Die Umgebung hat ' + f(v.ta) + ' °C.'; },
      hint() { const v = vals(); return [
        'Der Regler schaltet ab, wenn die Sperrschicht seine Abschalttemperatur erreicht. Ohne Kühlkörper gilt der große Wärmewiderstand Sperrschicht–Umgebung: Die Temperatur, die sich einstellen würde, liegt weit darüber. Der Kühlkörper muss {sym:Tj} auf höchstens {sym:Tjmax} begrenzen; das Abschalten ist ein Schutz und kein erlaubter Betrieb.',
        'Ohne Kühlkörper: {sym:Tj} = ' + f(v.ta) + ' °C + ' + f(v.p, 2) + ' W · ' + f(v.rthJA) + ' K/W = ' + f(v.tjFrei, 1) + ' °C. Mit Glimmerscheibe und Paste ({sym:Rth_CK} = ' + f(v.rthCK) + ' K/W) darf der Kühlkörper höchstens ' + f(v.erf, 2) + ' K/W haben.',
        'Musterlösung: ' + v.choiceName + ' (' + kW(v.rthK) + '): {sym:Tj} = ' + f(v.tjChoice, 1) + ' °C. ' + (v.below ? v.belowName + ' (' + kW(v.rthBelow) + ') würde {sym:Tj} auf ' + f(v.tjBelow, 1) + ' °C bringen: Das ist unter der Abschalttemperatur, aber über {sym:Tjmax}. ' : '') + 'Ohne Kühlkörper schaltet der Regler im Prüfzeitraum ' + v.shutFree + '-mal ab.'
      ]; } };
  })();

  /* ====================================================================== Aufgabenliste */
  /* text, table und hint werden erst beim ersten Zugriff gerechnet (Kern und Pruefstaende), danach gemerkt */
  const L = (t, M) => {
    let tx = null, hi = null, tb = null;
    Object.defineProperty(t, 'text', { enumerable: true, configurable: true, get() { if (tx === null) { try { tx = M.text(); } catch (e) { return 'Der Aufgabentext konnte nicht berechnet werden (THM_CORE und die Prüfstände müssen geladen sein).'; } } return tx; } });
    Object.defineProperty(t, 'hint', { enumerable: true, configurable: true, get() { if (hi === null) { try { hi = M.hint(); } catch (e) { return ['Tipp nicht verfügbar.', 'Tipp nicht verfügbar.', 'Tipp nicht verfügbar.']; } } return hi; } });
    if (typeof M.tables === 'function') Object.defineProperty(t, 'table', { enumerable: true, configurable: true, get() { if (tb === null) { try { tb = M.tables(); } catch (e) { return []; } } return tb; } });
    if (typeof M.choices === 'function') Object.defineProperty(t, 'choices', { enumerable: true, configurable: true, get() { try { return M.choices(); } catch (e) { return []; } } });
    t.hintVals = () => M.vals();
    t.model = M;
    return t;
  };
  const LST = (extra) => Object.assign({}, MONTAGE, extra);
  const mnt = (hs, joint, paste, extra) => Object.assign({ heatsink: hs, joint: joint, paste: paste }, extra || {});
  const tasks = [
    L({ id: 'th1', lab: 'thm', cat: 'Grundlagen', title: 'Das thermische Ersatzschaltbild', level: 1, rig: 'linear',
      start: () => S('linear', { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, choices: {} }),
      sol: () => S('linear', { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, choices: M1.want() }),
      check: M1.check }, M1),
    L({ id: 'th2', lab: 'thm', cat: 'Verlustleistung', title: 'Verlustleistung des Linearreglers 7805', level: 1, rig: 'linear',
      ask: { label: 'Verlustleistung {sym:P}', unit: 'W' },
      start: () => S('linear', Object.assign({}, M2.FIX, { ue: 9, iLoad: 0.2 }), { settle: true, value: null }),
      sol: () => { const v = M2.vals(); return S('linear', Object.assign({}, M2.FIX, { ue: v.ue, iLoad: v.ia }), { settle: true, value: v.p }); },
      check: M2.check }, M2),
    L({ id: 'th3', lab: 'thm', cat: 'Verlustleistung', title: 'Verlustleistung des LM317', level: 1, rig: 'linear',
      ask: { label: 'Verlustleistung {sym:P}', unit: 'W' },
      start: () => S('linear', Object.assign({}, M3.FIX, { ue: 12, ua: 5, iLoad: 0.5 }), { settle: true, value: null }),
      sol: () => { const v = M3.vals(); return S('linear', Object.assign({}, M3.FIX, { ue: v.ue, ua: v.ua, iLoad: v.ia }), { settle: true, value: v.p }); },
      check: M3.check }, M3),
    L({ id: 'th4', lab: 'thm', cat: 'Wärmekette', title: 'Gesamt-Wärmewiderstand der Kette', level: 1, rig: 'linear',
      ask: { label: 'Gesamt-Wärmewiderstand {sym:Rth_ges}', unit: 'K/W' },
      start: () => S('linear', Object.assign({}, M4.FIX, { heatsink: 'none', joint: 'direkt', paste: 'duenn' }), { settle: true, value: null }),
      sol: () => S('linear', Object.assign({}, M4.FIX, mnt('m', 'glimmer', 'duenn')), { settle: true, value: M4.vals().tot }),
      check: M4.check }, M4),
    L({ id: 'th5', lab: 'thm', cat: 'Wärmekette', title: 'Temperaturen der Kette ablesen und nachrechnen', level: 1, rig: 'linear',
      fields: M5.fields,
      start: () => S('linear', Object.assign({}, M5.FIX, { ue: 12, iLoad: 0.5, ta: 25, heatsink: 'none', joint: 'direkt', paste: 'duenn' }), { settle: true, fields: noV(['tj', 'tc', 'tk']) }),
      sol: () => { const v = M5.vals(); return S('linear', Object.assign({}, M5.FIX, { ue: v.ue, iLoad: v.ia, ta: v.ta }, mnt('m', 'glimmer', 'duenn')), { settle: true, fields: { tj: v.tj, tc: v.tc, tk: v.tk } }); },
      check: M5.check }, M5),
    L({ id: 'th6', lab: 'thm', cat: 'Montage', title: 'Glimmerscheibe mit und ohne Wärmeleitpaste vergleichen', level: 1, rig: 'vergleich',
      ask: { label: 'Aufbau B ist heißer um', unit: 'K' },
      start: () => S('vergleich', { device: '7805', pv: 3.5, ta: 25, n: 2, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'duenn' }, { settle: true, value: null }),
      sol: () => S('vergleich', { device: '7805', pv: M6.vals().pv, ta: 25, n: 2, heatsink_a: 'm', joint_a: 'glimmer', paste_a: 'duenn', heatsink_b: 'm', joint_b: 'glimmer', paste_b: 'keine' }, { settle: true, value: M6.vals().dTj }),
      check: M6.check }, M6),
    L({ id: 'th7', lab: 'thm', cat: 'Montage', title: '7805 direkt auf den Kühlkörper: Braucht er eine Isolierscheibe?', level: 1, rig: 'linear',
      start: () => S('linear', Object.assign({}, M7.FIX, mnt('m', 'glimmer', 'keine')), { settle: true }),
      sol: () => S('linear', Object.assign({}, M7.FIX, mnt('m', 'direkt', M7.vals().bestPaste)), { settle: true }),
      check: M7.check }, M7),
    L({ id: 'th8', lab: 'thm', cat: 'Fehlersuche', title: 'Fehlersuche: LM317 ohne Isolierscheibe', level: 1, rig: 'linear',
      start: () => S('linear', Object.assign({}, M8.FIX, mnt('m', 'direkt', 'duenn')), { settle: true }),
      sol: () => S('linear', Object.assign({}, M8.FIX, mnt('m', 'glimmer', 'duenn')), { settle: true }),
      check: M8.check }, M8),
    L({ id: 'th9', lab: 'thm', cat: 'Kühlkörper wählen', title: 'Den kleinsten ausreichenden Kühlkörper wählen', level: 2, rig: 'linear',
      start: () => S('linear', Object.assign({}, M9.FIX, mnt('none', 'direkt', 'duenn')), { settle: true }),
      sol: () => S('linear', Object.assign({}, M9.FIX, mnt(M9.vals().choice, 'glimmer', 'duenn')), { settle: true }),
      check: M9.check }, M9),
    L({ id: 'th10', lab: 'thm', cat: 'Derating', title: 'Zulässige Verlustleistung des BD139 bei warmer Umgebung', level: 2, rig: 'transistor',
      ask: { label: 'Zulässige Verlustleistung', unit: 'W' },
      start: () => S('transistor', Object.assign({}, M10.FIX, { ta: 25, heatsink: 'none', joint: 'direkt', paste: 'duenn' }), { settle: true, value: null }),
      sol: () => S('transistor', Object.assign({}, M10.FIX, { ta: M10.vals().ta }, mnt('m', 'glimmer', 'duenn')), { settle: true, value: M10.vals().pzul }),
      check: M10.check }, M10),
    L({ id: 'th11', lab: 'thm', cat: 'Zeitverhalten', title: 'Zeitkonstante des Kühlkörpers aus der Aufheizkurve', level: 2, rig: 'linear',
      ask: { label: 'Zeitkonstante (Prozesszeit)', unit: 'min' },
      start: () => S('linear', Object.assign({}, M11.FIX, { heatsink: 'none', joint: 'direkt', paste: 'duenn' }), { settle: false, dur: 3000, value: null }),
      sol: () => S('linear', Object.assign({}, M11.FIX, mnt('m', 'glimmer', 'duenn')), { settle: false, dur: 3600, value: M11.vals().t63 }),
      check: M11.check }, M11),
    L({ id: 'th12', lab: 'thm', cat: 'Zeitverhalten', title: 'Wann ist der Kühlkörper bei 90 % seiner Endtemperatur?', level: 2, rig: 'linear',
      ask: { label: 'Zeit bis 90 % (Prozesszeit)', unit: 'min' },
      start: () => S('linear', Object.assign({}, M12.FIX, { heatsink: 'none', joint: 'direkt', paste: 'duenn' }), { settle: false, dur: 6000, value: null }),
      sol: () => S('linear', Object.assign({}, M12.FIX, mnt('l', 'glimmer', 'duenn')), { settle: false, dur: 6000, value: M12.vals().t90 }),
      check: M12.check }, M12),
    L({ id: 'th13', lab: 'thm', cat: 'Verlustleistung', title: 'Ungünstigster Fall: Kühlkörper für schwankende Eingangsspannung', level: 2, rig: 'linear',
      ask: { label: 'Erforderlicher Wärmewiderstand {sym:Rth_Kerf}', unit: 'K/W' },
      start: () => S('linear', Object.assign({}, M13.FIX, { ue: 12, iLoad: 0.5, ta: 25, joint: 'glimmer', paste: 'duenn' }), { settle: true, value: null }),
      sol: () => { const v = M13.vals(); return S('linear', Object.assign({}, M13.FIX, { ue: v.ue2, iLoad: v.ia, ta: v.ta, joint: 'glimmer', paste: 'duenn' }), { settle: true, value: v.erf }); },
      check: M13.check }, M13),
    L({ id: 'th14', lab: 'thm', cat: 'Verlustleistung', title: 'LM317 an Widerstandslast: Wo ist die Verlustleistung am größten?', level: 2, rig: 'linear',
      fields: M14.fields,
      start: () => S('linear', Object.assign({}, M14.FIX, { loadMode: 'widerstand', rLoad: 10, ue: 15, ua: 5, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }), { settle: true, fields: noV(['ua', 'p']) }),
      sol: () => { const v = M14.vals(); return S('linear', Object.assign({}, M14.FIX, { loadMode: 'widerstand', rLoad: v.rl, ue: v.ue, ua: v.ua, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }), { settle: true, fields: { ua: v.ua, p: v.p } }); },
      check: M14.check }, M14),
    L({ id: 'th15', lab: 'thm', cat: 'Fehlersuche', title: 'Fehlersuche: Der 7805 schaltet ständig ab', level: 2, rig: 'linear',
      start: () => S('linear', M15.effOfStart(), { settle: false, dur: 3000 }),
      sol: () => S('linear', Object.assign({}, M15.FIX, mnt(M15.vals().choice, 'glimmer', 'duenn')), { settle: false, dur: 3000 }),
      check: M15.check }, M15)
  ];
  void LST;

  /* Musterwerte der Aufgaben (Schwellwerte aus der Musterloesung, Stand 2026-10-20); die Tests pruefen sie gegen frische Rechnung */
  T.thresholds1 = () => ({
    th2: { p: M2.vals().p }, th3: { p: M3.vals().p }, th4: { rthTot: M4.vals().tot }, th5: { tj: M5.vals().tj, tc: M5.vals().tc, tk: M5.vals().tk },
    th6: { dTj: M6.vals().dTj }, th7: { rthCK: M7.vals().ckDirekt }, th9: { erf: M9.vals().erf, choice: M9.vals().choice }, th10: { pzul: M10.vals().pzul },
    th11: { t63min: M11.vals().t63, tauMin: M11.vals().tau }, th12: { t90min: M12.vals().t90, t90tauMin: M12.vals().t90tau }, th13: { erf: M13.vals().erf },
    th14: { ua: M14.vals().ua, p: M14.vals().p }, th15: { choice: M15.vals().choice, tjChoice: M15.vals().tjChoice, shutFree: M15.vals().shutFree, obsS: OBS_S }
  });
  if (typeof T.register === 'function') T.register(tasks);
  const api = { tasks, answerOf, models: { M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11, M12, M13, M14, M15 }, helpers: { snap, tFrac, effOf, setRow, olabel, HSNAME, CAT } };
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
