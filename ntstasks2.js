/* ntstasks2.js - NTS-Lab (Netzteile und Schaltregler): Aufgaben nt17 bis nt32 mit automatischer Pruefung (Rechnung, Simulation und Fehlersuche, ohne Browser lauffaehig) (WP4b)
 * Registrierung: NTS_TASKS.register([ ... ]) (NTS_TASKS kommt aus ntsdata.js; ntsdata.js VOR dieser Datei laden, in Node holt sich die Datei es per require).
 * Format wie SPEC 8 / elstasks2.js: { id:'ntN', lab:'nts', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(),
 *   fields? | choices?, consts? }; answer = { rig, controls, ref, seq, rows, state, value, text, fields, choices, clicks, diagnose }.
 *   start() und sol() liefern { rig, controls, fields?, choices?, clicks?, diagnose? } (Startvorlage und Musterloesung / Auto-Weg); wrong() liefert mindestens zwei
 *   absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Diese Datei ist bewusst eigenstaendig: Sie braucht von ntsdata.js nur register(); Hilfsfunktionen (Simulation, Zahlenzeilen, Fehlersuche) stehen unten.
 * Rechnen nur ueber NTS_CORE (formulas, lin, buck, boost, bb, loss, gate, loop, lab, topology, fault, runSeq, limits); die Pruefstaende rechnen selbst nur ueber den Kern.
 * Schwellen: aus der gerechneten Musterloesung und aus limits (tol_rechnen, tol_eta, d_min, d_max, ube, ...). Vorgaben der Aufgabe (zum Beispiel "18 W im Kurzschluss",
 *   "ΔI_L höchstens 0,3 A", "P_sw höchstens 50 mW", "Drossel höchstens 470 µH") sind Aufgabenwerte, stehen im Aufgabentext und sind dort als Aufgabenwert gekennzeichnet
 *   (AUSBILDER.md F46). NTS_TASKS.thresholds2() nennt die Musterwerte.
 * Aufgaben mit Pool-Bezug (nt17, nt18, nt19, nt28) tragen die Kategorie "Prüfungsnah"; uebrige Kategorien nach SPEC 8.3.
 * Sicherheit: nur Simulation und Rechnung; die Fehlersuche (nt31, nt32) laeuft am freigeschalteten Geraet hinter dem Transformator im Kleinspannungskreis, keine Messung am Netz,
 *   keine Reparaturanleitung. Alle Bauteilwerte sind Aufgabenwerte (Text "Übungsschaltung").
 * Abweichungen von der SPEC (siehe ABWEICHUNGEN.md, Abschnitt WP4b):
 *   nt17 prueft "zu klein" ueber den Kurzschlussverlust (>18 W) und "zu gross" ueber den Eingriff bei Nennlast; nt22/nt25 begrenzen L nach oben mit einem Bauraum-Wert (Aufgabenwert), weil der
 *   Prueftand weder Isat noch eine Lastsprung-Zeit fuer die Drossel fuehrt; nt29 fragt zusaetzlich R_krit; nt31 prueft die Suche am Netzteil mit Reihenfolge, Messpunkt, Diagnose und Tausch (die drei
 *   Fehlerbilder der SPEC sind die drei Pruefkriterien, der Kern kennt je Symptom dieselbe Reihenfolge); nt32 hat zwei Fehler an zwei Netzteilen des Kollegen (Linearnetzteil am Pruefstand,
 *   Tiefsetzsteller als Messtabelle), weil der Kern je Netzteil nur einen Fehler fuehrt. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.NTS_TASKS) nodeReq('./ntsdata.js');
  const T = root.NTS_TASKS;
  if (!T || typeof T.register !== 'function') { if (typeof console !== 'undefined') console.warn('ntstasks2.js: ntsdata.js fehlt, die Aufgaben nt17 bis nt32 werden nicht angemeldet.'); return; }

  /* ====================================================================== Hilfsfunktionen */
  const RIGFILES = ['./ntsrig-base.js', './ntsrig-stabil.js', './ntsrig-buck.js', './ntsrig-topo.js', './ntsrig-gate.js', './ntsrig-regel.js', './ntsrig-fehler.js'];
  const core = () => { if (!root.NTS_CORE || !root.NTS_CORE.runSeq) { nodeReq('./ntscore.js'); nodeReq('./ntscore-sw.js'); nodeReq('./ntscore-diag.js'); } return root.NTS_CORE || null; };
  const rigs = id => { let R = root.NTS_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { core(); RIGFILES.forEach(nodeReq); R = root.NTS_RIGS; } return R || null; };
  const C = () => { const c = core(); if (!c || !c.exercise || !c.runSeq || !c.formulas || !c.fault) throw new Error('Rechenkern fehlt'); return c; };
  const fin = x => typeof x === 'number' && isFinite(x);
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const obj = x => (isObj(x) ? x : {});
  const clone = o => JSON.parse(JSON.stringify(o));
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const f = (x, d) => (fin(x) ? C().fmt(x, d == null ? 2 : d) : '–');
  const eng = (x, u) => C().fmtEng(x, u);
  const lv = id => C().limit(id).value;
  const A = (rig, controls, extra) => Object.assign({ rig, controls: controls || {} }, extra || {});
  const TOL = () => lv('tol_rechnen') / 100;       // 3 % (belegt, Pool-Feld toleranz)
  const TOLE = () => lv('tol_eta') / 100;           // 2 % fuer Wirkungsgrad, Tastverhaeltnis, Teiler (belegt)
  const fml = (id, ...a) => { const g = C().formulas.get(id); const v = g ? g.fn(...a) : NaN; if (!fin(v)) throw new Error('Formel ' + id + ' nicht rechenbar'); return v; };

  /* Zeilen sammeln: fn(r) ruft r(ok, text, why); eine Ausnahme wird als letzte Zeile gemeldet (nie werfen) */
  function mk(fn) {
    return function (a) {
      const rows = [];
      const r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || 'Die Bedingung ist nicht erfüllt.') }); };
      try { fn(r, obj(a)); } catch (e) { rows.push({ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }); }
      if (!rows.length) rows.push({ ok: false, text: 'Die Prüfung hat nichts geprüft', why: 'Bitte melde das deinem Ausbilder.' });
      return rows;
    };
  }

  /* ---------- Simulation: Beharrungszustand eines Pruefstands ueber NTS_CORE.runSeq (Seed 1, gecacht) ---------- */
  const simCache = new Map();
  function sim(rigId, ctl) {
    const key = rigId + '|' + JSON.stringify(ctl);
    if (simCache.has(key)) return simCache.get(key);
    rigs(rigId);
    const res = C().runSeq(rigId, [], 1, { controls: ctl, seed: 1 });
    const last = res.samples && res.samples.length ? res.samples[res.samples.length - 1] : null;
    const v = { ok: !!res.ok && !(res.errors && res.errors.length), st: res.final || {}, m: (last && last.meters) || {}, as: res.assess || {}, errors: (res.errors || []).slice(), rejected: (res.rejected || []).slice() };
    if (simCache.size > 300) simCache.clear();
    simCache.set(key, v);
    return v;
  }
  const numOf = v => { if (fin(v)) return v; if (typeof v === 'string' && v.trim() !== '') { const x = C().parseNum(v); return fin(x) ? x : NaN; } return NaN; };
  /* freigegebene Steuerwerte (own) aus der Antwort ueber die festen Werte (fix); fehlt einer in der Antwort, gilt der Startwert der Aufgabe */
  function effCtl(a, own, fix, start) {
    const ctl = Object.assign({}, fix), src = obj(a.controls);
    own.forEach(k => {
      let v = Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined && src[k] !== null ? src[k] : start[k];
      if (typeof v === 'string' && fin(numOf(v)) && typeof start[k] === 'number') v = numOf(v);
      ctl[k] = v;
    });
    return ctl;
  }
  /* erste Zeile jeder Simulationsaufgabe: richtiger Pruefstand, gueltige Eingaben, Lauf ohne Fehlermeldung */
  function inputRow(r, a, s, rigId) {
    const errs = [];
    if (s) { errs.push(...s.errors); (s.rejected || []).forEach(x => errs.push('Der Prüfstand lehnt den Wert für „' + x.key + '“ ab.')); }
    if (typeof a.rig === 'string' && a.rig !== rigId) {
      const R = rigs(), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }

  /* ---------- Zahlenzeilen ---------- */
  const ULIST = ['V', 'A', 'W', 'Ω', 'Ohm', 'ohm', 'Hz', 'F', 'H', 's'];
  const baseOf = (u, factor) => { let b = factor !== 1 && u.length > 1 ? u.slice(1) : u; if (b === 'Ohm' || b === 'ohm') b = 'Ω'; return b; };
  /* Referenz: value in SI (bei Prozentgroessen als Anteil), unit = SI-Einheit, factor: SI = Anzeige * factor, pct: Prozentgroesse, tol, alts, wrongs [{ v, text }] */
  const own = (value, unit, o) => Object.assign({ value, alts: [], wrongs: [], factor: 1, unit: unit || '', pct: false, tol: TOL() }, o || {});
  function numRow(r, raw, rf, label, d) {
    const W = C(), tol = rf.tol, dg = d == null ? 2 : d, tolTxt = 'Toleranz ' + f(100 * tol, 0) + ' %';
    let cands = null;
    if (typeof raw === 'number' && fin(raw)) { cands = [raw * rf.factor]; if (rf.factor !== 1) cands.push(raw); }
    else if (typeof raw === 'string' && raw.trim() !== '') {
      const q = W.parseUnit(raw);
      if (!fin(q.value)) { r(false, label + ' (' + tolTxt + ')', 'Das ist keine Zahl: Trage den Wert als Zahl ein, zum Beispiel 2,5.'); return false; }
      if (!q.unit) { cands = [q.value * rf.factor]; if (rf.factor !== 1) cands.push(q.value); }
      else if (q.unit === '%') {
        if (!rf.pct) { r(false, label + ' (' + tolTxt + ')', 'Die Einheit „%“ passt nicht zur gesuchten Größe (gesucht: ' + (rf.unit || 'Zahl ohne Einheit') + '). Prüfe die Einheit.'); return false; }
        cands = [q.value / 100];
      } else {
        const b = baseOf(q.unit, q.factor);
        if (ULIST.indexOf(b) < 0 || b !== rf.unit) { r(false, label + ' (' + tolTxt + ')', 'Die Einheit „' + q.unit + '“ passt nicht zur gesuchten Größe (gesucht: ' + (rf.unit || 'Zahl ohne Einheit') + '). Prüfe die Einheit.'); return false; }
        cands = [q.si];
      }
    } else { r(false, label + ' (' + tolTxt + ')', 'Du hast keine Zahl eingetragen.'); return false; }
    const refs = [rf.value].concat(rf.alts);
    const close = (x, y) => Math.abs(x - y) <= tol * Math.abs(y) + 1e-300;
    if (cands.some(c => refs.some(y => close(c, y)))) { r(true, label + ' (' + tolTxt + ')', ''); return true; }
    let why = null;
    for (let k = 0; k < rf.wrongs.length && why === null; k++) { const w = rf.wrongs[k]; if (cands.some(c => close(c, w.v))) why = w.text; }
    let x = cands[0];
    if (cands.length > 1 && rf.value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / rf.value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / rf.value))); if (l1 < l0) x = cands[1]; }
    if (why === null) {
      const v = rf.value;
      if (x !== 0 && v !== 0 && (x > 0) === (v > 0)) {
        const ra = x / v, lr = Math.log(Math.abs(ra)) / Math.LN10;
        if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) why = 'Dein Wert ist um den Faktor 10^' + (Math.round(lr) > 0 ? '' : '(−') + Math.abs(Math.round(lr)) + (Math.round(lr) > 0 ? '' : ')') + ' ' + (ra > 1 ? 'zu groß' : 'zu klein') + ': Prüfe die Vorsätze (m, µ, k) und die Einheit.';
        else if (ra < 1) why = 'Dein Wert ist um ' + f((1 - ra) * 100, 0) + ' % zu klein. Rechne die Schritte noch einmal durch.';
        else why = 'Dein Wert ist um ' + f((ra - 1) * 100, 0) + ' % zu groß. Rechne die Schritte noch einmal durch.';
      } else why = x < v ? 'Dein Wert ist zu klein (hier sogar mit falschem Vorzeichen). Rechne die Schritte noch einmal durch.' : 'Dein Wert ist zu groß. Rechne die Schritte noch einmal durch.';
    }
    r(false, label + ' (' + tolTxt + ')', why);
    return false;
  }
  const rawOf = (a, key) => { const fo = obj(a.fields); const v = Object.prototype.hasOwnProperty.call(fo, key) ? fo[key] : undefined; if (v === undefined || v === null || v === '') return (key === 'ergebnis' && fin(a.value)) ? a.value : null; return v; };
  const choiceOf = (a, key) => { const c = obj(a.choices); const v = Object.prototype.hasOwnProperty.call(c, key) ? c[key] : undefined; return v === undefined || v === null || v === '' ? null : v; };
  /* Auswahlzeilen: specs = [{ key, q, short, right, options:[{ value, label, grund }] }]; jede Antwort traegt einen Fachgrund mit Zahlen aus dem Kern (Audit) */
  function choiceRows(r, a, specs) {
    specs.forEach(sp => {
      const got = choiceOf(a, sp.key), rt = sp.options.find(o => o.value === sp.right), gt = got === null ? null : sp.options.find(o => String(o.value) === String(got));
      r(gt !== undefined && gt !== null && gt.value === sp.right, sp.short,
        got === null ? 'Wähle eine Antwort aus.' : !gt ? 'Deine Auswahl gehört nicht zu den Antworten. Richtig ist „' + rt.label + '“.' : 'Du hast „' + gt.label + '“ gewählt: ' + gt.grund + ' Richtig ist „' + rt.label + '“: ' + rt.grund);
    });
  }
  const rightOf = specs => { const o = {}; specs.forEach(s => { o[s.key] = s.right; }); return o; };
  const publicChoices = specs => specs.map(s => ({ key: s.key, q: s.q, options: s.options.map(o => ({ value: o.value, label: o.label })) }));
  const choiceAudit = specs => specs.map(s => ({ key: s.key, right: s.right, options: s.options.map(o => ({ value: o.value, label: o.label, grund: o.grund, richtig: o.value === s.right })) }));

  /* Aufgabenobjekt aus einem Modul M bauen (ELS-Muster): text, hint, table, fields, choices erst beim ersten Zugriff rechnen */
  function tk(head, M) {
    const o = Object.assign({}, head);
    const lazy = (k, fn) => { Object.defineProperty(o, k, { enumerable: true, configurable: true, get() { const v = fn(); Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true }); return v; } }); };
    lazy('text', () => M.text());
    lazy('hint', () => M.hint());
    if (M.table) lazy('table', () => M.table());
    if (M.fields) lazy('fields', () => M.fields());
    if (M.choices) lazy('choices', () => M.choices());
    if (M.audit) o.audit = () => M.audit();
    if (M.ask) o.ask = M.ask;
    o.consts = M.consts || [];
    o.hintVals = () => M.vals(); o.start = () => M.start(); o.sol = () => M.sol(); o.wrong = () => M.wrong(); o.check = M.check;
    return o;
  }

  /* Suche im Kern: groesster / kleinster Wert x im Intervall, fuer den pred(x) gilt (pred monoton); nur Kernaufrufe in pred */
  function bisect(lo, hi, pred, wantMax) {
    let a = lo, b = hi;
    for (let k = 0; k < 80; k++) { const m = Math.sqrt(a * b); if (!!pred(m) === !!wantMax) a = m; else b = m; }
    return Math.sqrt(a * b);
  }

  /* ====================================================================== nt17: Strombegrenzung dimensionieren (Pool W2024-23) */
  const M17 = (() => {
    const G = { ue: 14, iN: 0.8, pMax: 18, res: 1.25 };
    const FIX = { art: '7805', ue: G.ue, iLast: G.iN, kurz: false }, OWN = ['t2', 'r3'], START = { t2: false, r3: 0.6 };
    const lim = r3 => C().lin.limitT2({ R3: r3, Uein: G.ue });
    const vals = () => once('v17', () => {
      const ube = lv('ube'), iMin = G.res * G.iN, iMax = G.pMax / G.ue, s = lim(0.6), k = lim(0.3), g = lim(1.0);
      return { ue: G.ue, iN: G.iN, pMax: G.pMax, ube, res: G.res, iMin, iMax, r3Max: ube / iMin, r3Min: ube / iMax, r3: 0.6, ilim: s.Ilim, pKurz: s.PvKurz, r3k: 0.3, ilimK: k.Ilim, pKurzK: k.PvKurz, r3g: 1.0, ilimG: g.Ilim };
    });
    const check = mk((r, a) => {
      const v = vals(), ctl = effCtl(a, OWN, FIX, START), s = sim('stabil', ctl), sk = sim('stabil', Object.assign({}, ctl, { kurz: true }));
      inputRow(r, a, s, 'stabil');
      const on = ctl.t2 === true, L = lim(ctl.r3), good = !!L && L.ok;
      r(on, 'Die Strombegrenzung (T2) ist eingeschaltet', 'Ohne T2 begrenzt nichts den Strom: Im Kurzschluss ist der Strom im Modell nicht begrenzt. Schalte T2 ein.');
      r(on && good && L.Ilim >= v.iMin - 1e-9 && s.m.modus !== 2, 'Bei der Nennlast ' + eng(G.iN, 'A') + ' greift die Begrenzung nicht ein (I_lim mindestens das ' + f(G.res, 2) + '-Fache des Nennstroms, also ' + eng(v.iMin, 'A') + ')',
        !on ? 'Ohne T2 gibt es keine Begrenzung, I_lim ist nicht festgelegt.' : !good ? 'R3 muss eine Zahl größer als 0 sein.'
          : L.Ilim < v.iMin - 1e-9 ? 'Mit R3 = ' + eng(ctl.r3, 'Ω') + ' ist I_lim = U_BE / R3 = ' + eng(L.Ube, 'V') + ' / ' + eng(ctl.r3, 'Ω') + ' = ' + eng(L.Ilim, 'A') + ', verlangt sind mindestens ' + eng(v.iMin, 'A') + '. ' + (s.m.modus === 2 ? 'Die Begrenzung greift schon bei der Nennlast ein: U_aus fällt auf ' + eng(s.m.uaus, 'V') + ' und P_V steigt auf ' + eng(s.m.pv, 'W') + '. R3 ist zu groß.' : 'R3 ist zu groß.')
            : 'Der Prüfstand meldet mit diesen Werten keinen Betrieb ohne Begrenzung (siehe erste Zeile).');
      r(on && good && sk.m.modus === 2 && sk.m.pv <= G.pMax + 1e-9, 'Im Kurzschluss nimmt der Regler höchstens ' + eng(G.pMax, 'W') + ' auf (P_V = U_ein · I_lim)',
        !on ? 'Ohne T2 ist der Strom im Kurzschluss nicht begrenzt.' : !good ? 'R3 muss eine Zahl größer als 0 sein.'
          : 'Im Kurzschluss fließt I_lim = ' + eng(L.Ilim, 'A') + ', der Regler setzt U_ein · I_lim = ' + eng(sk.m.pv, 'W') + ' um, mehr als die Vorgabe ' + eng(G.pMax, 'W') + '. R3 ist zu klein.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein 7805 (Übungsschaltung, Aufgabenwerte) wird mit U_ein = ' + f(G.ue, 0) + ' V betrieben und liefert im Normalbetrieb I_nenn = ' + f(G.iN, 1) + ' A. Die Strombegrenzung mit dem zweiten Transistor T2 und dem Messwiderstand R3 (I_lim = U_BE / R3) soll so ausgelegt werden: (1) Bei der Nennlast darf sie nicht eingreifen, I_lim muss mindestens das ' + f(G.res, 2) + '-Fache des Nennstroms sein. (2) Im Kurzschluss darf der Regler höchstens ' + f(G.pMax, 0) + ' W aufnehmen (P_V = U_ein · I_lim). Schalte im Prüfstand die Strombegrenzung ein und wähle R3. Reserve und Leistungsgrenze sind Aufgabenwerte.',
      hint: () => { const v = vals(); return [
        'Die Strombegrenzung greift, wenn am Messwiderstand R3 die Schwelle U_BE erreicht ist: I_lim = U_BE / R3. Ein größerer R3 begrenzt früher, ein kleinerer später. Beide Vorgaben der Aufgabe ziehen R3 in entgegengesetzte Richtungen.',
        'Aus (1) folgt I_lim ≥ ' + f(v.res, 2) + ' · ' + f(v.iN, 1) + ' A = ' + f(v.iMin, 2) + ' A, also R3 ≤ ' + f(v.ube, 1) + ' V / ' + f(v.iMin, 2) + ' A = ' + f(v.r3Max, 2) + ' Ω. Aus (2) folgt I_lim ≤ ' + f(v.pMax, 0) + ' W / ' + f(v.ue, 0) + ' V = ' + f(v.iMax, 2) + ' A, also R3 ≥ ' + f(v.r3Min, 2) + ' Ω.',
        'Musterlösung: T2 an, R3 = ' + f(v.r3, 1) + ' Ω gibt I_lim = ' + f(v.ilim, 2) + ' A und im Kurzschluss P_V = ' + f(v.pKurz, 1) + ' W. Mit R3 = ' + f(v.r3k, 1) + ' Ω wären es ' + f(v.ilimK, 2) + ' A und ' + f(v.pKurzK, 1) + ' W, mit R3 = ' + f(v.r3g, 1) + ' Ω nur ' + f(v.ilimG, 2) + ' A (kleiner als der Nennstrom).'
      ]; },
      start: () => A('stabil', Object.assign({}, FIX, START), {}),
      sol: () => A('stabil', Object.assign({}, FIX, { t2: true, r3: 0.6 }), {}),
      wrong: () => [{ name: 'R3 zu klein (I_lim zu groß)', answer: A('stabil', Object.assign({}, FIX, { t2: true, r3: 0.3 }), {}) }, { name: 'R3 zu groß (Begrenzung greift bei Nennlast)', answer: A('stabil', Object.assign({}, FIX, { t2: true, r3: 1.0 }), {}) }] };
  })();

  /* ====================================================================== nt18: Linear oder getaktet? (Pool W2023-09) */
  const M18 = (() => {
    const G = { uin: 12, uout: 5, i: 0.4, eta: 0.88 };
    const vs = () => once('vs18', () => C().loss.vsLinear({ Uin: G.uin, Uout: G.uout, Iout: G.i, etaSchalt: G.eta }));
    const vals = () => once('v18', () => {
      const s = vs(), pab = s.Pab, pzu = pab / G.eta;
      return { uin: G.uin, uout: G.uout, i: G.i, eta: G.eta * 100, pab, pvLin: s.PvLin, pvS: s.PvSchalt, diff: s.diff, etaLin: s.etaLin * 100, pzu, pvFalsch: pab * (1 - G.eta), pEin: G.uin * G.i, diffFalsch: s.PvLin - pzu };
    });
    const rfs = () => once('r18', () => { const v = vals();
      return {
        lin: own(v.pvLin, 'W', { wrongs: [{ v: v.pab, text: 'Das ist die Nutzleistung U_aus · I = ' + eng(v.pab, 'W') + '. Der Verlust des Linearreglers entsteht an der Differenz: P_V = (U_ein − U_aus) · I.' }, { v: v.pEin, text: 'Das ist die Eingangsleistung U_ein · I = ' + eng(v.pEin, 'W') + '. Der Verlust ist (U_ein − U_aus) · I.' }] }),
        sw: own(v.pvS, 'W', { wrongs: [{ v: v.pvFalsch, text: 'Du hast P_ab · (1 − η) = ' + eng(v.pvFalsch, 'W') + ' gerechnet: Der Verlust bezieht sich auf die zugeführte Leistung, P_V = P_ab · (1/η − 1).' }, { v: v.pzu, text: 'Das ist die zugeführte Leistung P_zu = P_ab / η = ' + eng(v.pzu, 'W') + '. Der Verlust ist P_zu − P_ab.' }] }),
        diff: own(v.diff, 'W', { wrongs: [{ v: v.diffFalsch, text: 'Du hast von P_V des Linearreglers die zugeführte Leistung des Schaltreglers (' + eng(v.pzu, 'W') + ') abgezogen, nicht seinen Verlust.' }] }) }; });
    const check = mk((r, a) => {
      const R = rfs();
      numRow(r, rawOf(a, 'pvlin'), R.lin, 'Die Verlustleistung des Linearreglers ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'pvs'), R.sw, 'Die Verlustleistung des Schaltreglers ist richtig berechnet', 3);
      numRow(r, rawOf(a, 'diff'), R.diff, 'Die Differenz der Verlustleistungen ist richtig berechnet', 3);
    });
    return { vals, check, consts: [0.88],
      text: () => 'Ein Verbraucher braucht ' + f(G.uout, 0) + ' V bei ' + f(G.i, 1) + ' A und wird aus ' + f(G.uin, 0) + ' V versorgt (Übungsschaltung). Vergleiche einen Linearregler mit einem Schaltregler, dessen Wirkungsgrad ' + f(G.eta * 100, 0) + ' % beträgt. Berechne die Verlustleistung des Linearreglers (Ruhestrom vernachlässigt), die des Schaltreglers und die Differenz. Trage die Werte in W ein.',
      fields: () => [{ key: 'pvlin', label: 'Verlustleistung Linearregler', unit: 'W' }, { key: 'pvs', label: 'Verlustleistung Schaltregler', unit: 'W' }, { key: 'diff', label: 'Differenz der Verlustleistungen', unit: 'W' }],
      hint: () => { const v = vals(); return [
        'Der Linearregler setzt die Spannungsdifferenz mal Strom in Wärme um: P_V = (U_ein − U_aus) · I. Beim Schaltregler kennst du den Wirkungsgrad, daraus folgt der Verlust aus der abgegebenen Leistung: P_V = P_ab · (1/η − 1).',
        'Linearregler: P_V = (' + f(v.uin, 0) + ' V − ' + f(v.uout, 0) + ' V) · ' + f(v.i, 1) + ' A = ' + f(v.pvLin, 2) + ' W. Die abgegebene Leistung ist P_ab = ' + f(v.uout, 0) + ' V · ' + f(v.i, 1) + ' A = ' + f(v.pab, 2) + ' W.',
        'Musterlösung: Schaltregler P_V = ' + f(v.pab, 2) + ' W · (1/0,88 − 1) = ' + f(v.pvS, 3) + ' W; Differenz ' + f(v.pvLin, 2) + ' W − ' + f(v.pvS, 3) + ' W = ' + f(v.diff, 3) + ' W. Wer P_ab · (1 − η) rechnet, bekommt ' + f(v.pvFalsch, 2) + ' W.'
      ]; },
      start: () => A('buck', { uin: G.uin, uout: G.uout, iout: G.i, steuer: 'geregelt' }, { fields: { pvlin: null, pvs: null, diff: null } }),
      sol: () => { const v = vals(); return A('buck', { uin: G.uin, uout: G.uout, iout: G.i, steuer: 'geregelt' }, { fields: { pvlin: v.pvLin, pvs: v.pvS, diff: v.diff }, value: v.pvLin }); },
      wrong: () => { const v = vals(); return [
        { name: 'Verlust des Schaltreglers auf P_ab statt P_zu bezogen', answer: A('buck', {}, { fields: { pvlin: v.pvLin, pvs: v.pvFalsch, diff: v.pvLin - v.pvFalsch } }) },
        { name: 'Zugeführte Leistung statt Verlust', answer: A('buck', {}, { fields: { pvlin: v.pvLin, pvs: v.pzu, diff: v.diffFalsch } }) },
        { name: 'Linearregler mit der Eingangsleistung', answer: A('buck', {}, { fields: { pvlin: v.pEin, pvs: v.pvS, diff: v.diff } }) }]; } };
  })();

  /* ====================================================================== nt19: Welche Topologie? (Pool W2023-08, W2024-09) */
  const M19 = (() => {
    const CASES = [
      { k: 'a', Uin: 12, Uout: 5, tr: false }, { k: 'b', Uin: 5, Uout: 12, tr: false }, { k: 'c', Uin: 5, Uout: -12, tr: false }, { k: 'd', Uin: 12, Uout: 5, tr: true }, { k: 'e', Uin: 24, Uout: 5, tr: false }];
    const NAMES = { buck: 'Tiefsetzsteller', boost: 'Hochsetzsteller', bb: 'Inverswandler', fly: 'Sperrwandler' };
    const sg = x => eng(x, 'V').replace('-', '−');
    const topo = c => once('t19' + c.k, () => { const t = C().topology({ Uin: c.Uin, Uout: c.Uout, getrennt: c.tr }); if (!t || !t.ok) throw new Error('topology'); return t; });
    const specs = () => once('s19', () => CASES.map(c => {
      const t = topo(c), ua = Math.abs(c.Uout), num = ' (U_ein = ' + sg(c.Uin) + ', U_aus = ' + sg(c.Uout) + ')';
      const grund = k => {
        if (k === t.topo) return t.grund + ' ' + t.gegenprobe;
        if (t.falsch && t.falsch[k]) return t.falsch[k] + num + '.';
        if (k === 'fly') return 'Der Sperrwandler trennt Eingang und Ausgang galvanisch; das ist hier nicht verlangt, die einfachere Grundschaltung genügt (mit n = 1 wäre D = ' + f(fml('dFlyback', c.Uin, ua, 1) * 100, 2) + ' %)' + num + '.';
        return 'Der Tiefsetzsteller könnte die Spannung herabsetzen (D = ' + f(fml('dBuck', c.Uin, ua) * 100, 2) + ' %), er trennt Eingang und Ausgang aber nicht galvanisch; verlangt ist Potentialtrennung' + num + '.';
      };
      return { key: c.k, right: t.topo,
        q: 'Aus U_ein = ' + sg(c.Uin) + ' soll U_aus = ' + sg(c.Uout) + (c.Uout < 0 ? ' (gegen Masse negativ)' : '') + ' entstehen' + (c.tr ? '; Eingang und Ausgang müssen galvanisch getrennt sein' : '') + '. Welche Grundschaltung passt?',
        short: 'Fall ' + c.k.toUpperCase() + ': Die Grundschaltung für ' + sg(c.Uin) + ' auf ' + sg(c.Uout) + (c.tr ? ' mit Trennung' : '') + ' ist richtig gewählt',
        options: ['buck', 'boost', 'bb', 'fly'].map(k => ({ value: k, label: NAMES[k], grund: grund(k) })) };
    }));
    const vals = () => once('v19', () => { const o = {}; CASES.forEach(c => { const t = topo(c); o['d' + c.k] = t.D * 100; o['u' + c.k] = c.Uin; o['o' + c.k] = Math.abs(c.Uout); }); return o; });
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    const START = () => A('topo', { topo: 'boost', uin: 5, uout: 12 }, { choices: {} });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Fünf Aufgaben aus der Praxis (Übungswerte): Für jeden Fall ist die Grundschaltung zu wählen. Zur Auswahl stehen der Tiefsetzsteller, der Hochsetzsteller, der Inverswandler und der Sperrwandler. Im Prüfstand „Hoch-, Invers- und Sperrwandler“ kannst du jede Schaltung mit denselben Spannungen ausprobieren; der Prüfstand zeigt sofort, ob die Schaltung zur Aufgabe passt.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Vergleiche zuerst die Vorzeichen und die Beträge von U_ein und U_aus: Kleiner heißt herabsetzen, größer heißt hochsetzen, umgekehrtes Vorzeichen heißt invertieren. Verlangt die Aufgabe eine galvanische Trennung, braucht es einen Übertrager.',
        'Fall A: ' + f(v.ua, 0) + ' V auf ' + f(v.oa, 0) + ' V herabsetzen, D = ' + f(v.da, 2) + ' %. Fall B: ' + f(v.ub, 0) + ' V auf ' + f(v.ob, 0) + ' V hochsetzen, D = ' + f(v.db, 2) + ' %. Fall C: ' + f(v.uc, 0) + ' V auf −' + f(v.oc, 0) + ' V, D = ' + f(v.dc, 2) + ' %.',
        'Musterlösung: A Tiefsetzsteller, B Hochsetzsteller, C Inverswandler, D Sperrwandler (Trennung, mit n = 1 gilt D = ' + f(v.dd, 2) + ' %), E Tiefsetzsteller (D = ' + f(v.de, 2) + ' %).'
      ]; },
      start: START, sol: () => A('topo', START().controls, { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'Tiefsetzsteller für Hochsetzen, Hochsetzsteller für negativ', answer: A('topo', {}, { choices: { a: 'buck', b: 'buck', c: 'boost', d: 'fly', e: 'buck' } }) }, { name: 'immer Inverswandler', answer: A('topo', {}, { choices: { a: 'bb', b: 'bb', c: 'bb', d: 'bb', e: 'bb' } }) }] };
  })();

  /* ====================================================================== nt20: Tastverhaeltnis des Tiefsetzstellers */
  const M20 = (() => {
    const G = { uin: 12, uout: 5 };
    const vals = () => once('v20', () => { const d = fml('dBuck', G.uin, G.uout); return { uin: G.uin, uout: G.uout, d: d * 100, aus: (1 - d) * 100, kehr: G.uin / G.uout * 100, diff: G.uin - G.uout }; });
    const rf = () => once('r20', () => { const v = vals(), d = v.d / 100;
      return own(d, '', { pct: true, factor: 0.01, tol: TOLE(), wrongs: [
        { v: 1 - d, text: 'Du hast (U_ein − U_aus) / U_ein = ' + f(v.aus, 2) + ' % gerechnet: Das ist die Ausschaltdauer, 1 − D. Beim Tiefsetzsteller ist D = U_aus / U_ein.' },
        { v: G.uin / G.uout, text: 'Du hast U_ein / U_aus gerechnet. Beim Tiefsetzsteller ist D = U_aus / U_ein und damit immer kleiner als 100 %.' }] }); });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'd'), rf(), 'Das Tastverhältnis D ist richtig berechnet', 2); });
    return { vals, check, consts: [],
      text: () => 'Ein Tiefsetzsteller (ideal, nicht lückend, Übungsschaltung) soll aus U_ein = ' + f(G.uin, 0) + ' V die Ausgangsspannung U_aus = ' + f(G.uout, 0) + ' V erzeugen. Wie groß ist das Tastverhältnis D? Trage es in Prozent ein; der Anteil als Zahl (zum Beispiel 0,5 statt 50 %) zählt auch.',
      fields: () => [{ key: 'd', label: 'Tastverhältnis D', unit: '%' }],
      hint: () => { const v = vals(); return [
        'Die Drossel bekommt im Mittel genau die Ausgangsspannung. Beim Tiefsetzsteller liegt der Schalter in Reihe: Der Ausgang sieht U_ein nur während der Einschaltdauer, im Mittel also U_aus = D · U_ein.',
        'Stelle um: D = U_aus / U_ein = ' + f(v.uout, 0) + ' V / ' + f(v.uin, 0) + ' V. Das Ergebnis liegt zwischen 0 und 1. In Prozent mal 100 nehmen.',
        'Musterlösung: D = ' + f(v.uout, 0) + ' / ' + f(v.uin, 0) + ' = ' + f(v.d, 2) + ' %. Wer U_ein − U_aus durch U_ein teilt, erhält ' + f(v.aus, 2) + ' %, das ist die Ausschaltdauer.'
      ]; },
      start: () => A('buck', { uin: G.uin, uout: G.uout, steuer: 'geregelt' }, { fields: { d: null } }),
      sol: () => A('buck', { uin: G.uin, uout: G.uout, steuer: 'geregelt' }, { fields: { d: vals().d }, value: vals().d }),
      wrong: () => { const v = vals(); return [{ name: 'Ausschaltdauer statt D', answer: A('buck', {}, { fields: { d: v.aus } }) }, { name: 'Faktor 100 daneben', answer: A('buck', {}, { fields: { d: v.d * 100 } }) }, { name: 'Kehrwert', answer: A('buck', {}, { fields: { d: v.kehr } }) }]; } };
  })();

  /* ====================================================================== nt21: Drosselstrom-Welligkeit berechnen */
  const M21 = (() => {
    const G = { uin: 12, uout: 5, f: 100e3, l: 100e-6 };
    const vals = () => once('v21', () => {
      const d = fml('dBuck', G.uin, G.uout), v = fml('dIL', G.uin, G.uout, G.f, G.l);
      return { uin: G.uin, uout: G.uout, f: G.f / 1e3, l: G.l * 1e6, d: d * 100, dA: d, dil: v, boost: G.uin * d / (G.f * G.l), halb: v / 2, ohneD: (G.uin - G.uout) / (G.f * G.l), diff: G.uin - G.uout, fl: G.f * G.l, vorsatz: (G.uin - G.uout) * d / (G.f * G.l * 1e6) };
    });
    const rf = () => once('r21', () => { const v = vals();
      return own(v.dil, 'A', { wrongs: [
        { v: v.boost, text: 'Du hast den Vorfaktor des Hochsetzstellers genommen (U_ein · D = ' + f(G.uin * v.d / 100, 2) + ' V): Beim Tiefsetzsteller liegt U_ein − U_aus an der Drossel.' },
        { v: v.halb, text: 'Das ist nur die halbe Welligkeit ΔI_L / 2 (Abweichung vom Mittelwert); gefragt ist Spitze-Spitze.' },
        { v: v.ohneD, text: 'Der Faktor D fehlt: ΔI_L = (U_ein − U_aus) · D / (f · L).' },
        { v: v.vorsatz, text: 'Die Drossel steht in µH: Rechne mit L = 100 · 10^(−6) H, sonst ist f · L um den Faktor 10^6 daneben.' }] }); });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'dil'), rf(), 'Die Drosselwelligkeit ΔI_L ist richtig berechnet', 4); });
    return { vals, check, consts: [],
      text: () => 'Ein Tiefsetzsteller (ideal, Übungsschaltung) setzt ' + f(G.uin, 0) + ' V auf ' + f(G.uout, 0) + ' V herab. Die Schaltfrequenz ist f = ' + f(G.f / 1e3, 0) + ' kHz, die Drossel hat L = ' + f(G.l * 1e6, 0) + ' µH. Berechne die Drosselwelligkeit ΔI_L (Spitze-Spitze) in A.',
      fields: () => [{ key: 'dil', label: 'Drosselwelligkeit ΔI_L', unit: 'A' }],
      hint: () => { const v = vals(); return [
        'Während der Einschaltdauer D · T liegt an der Drossel die Spannung U_ein − U_aus; der Strom steigt linear um ΔI_L = (U_ein − U_aus) · D · T / L. Mit T = 1 / f ergibt sich die Formel.',
        'Zuerst D = U_aus / U_ein = ' + f(v.d, 2) + ' %. Dann U_ein − U_aus = ' + f(v.diff, 0) + ' V und f · L = ' + f(v.f, 0) + ' kHz · ' + f(v.l, 0) + ' µH = ' + f(v.fl, 0) + ' V·s/A. Setze alles in SI-Einheiten ein (Hz, H).',
        'Musterlösung: ΔI_L = ' + f(v.diff, 0) + ' V · ' + f(v.dA, 4) + ' / ' + f(v.fl, 0) + ' = ' + f(v.dil, 4) + ' A. Mit dem Vorfaktor des Hochsetzstellers käme ' + f(v.boost, 2) + ' A heraus, die halbe Welligkeit wäre ' + f(v.halb, 4) + ' A.'
      ]; },
      start: () => A('buck', { uin: G.uin, uout: G.uout, f: G.f / 1e3, l: G.l * 1e6, steuer: 'geregelt' }, { fields: { dil: null } }),
      sol: () => A('buck', { uin: G.uin, uout: G.uout, f: G.f / 1e3, l: G.l * 1e6, steuer: 'geregelt' }, { fields: { dil: vals().dil }, value: vals().dil }),
      wrong: () => { const v = vals(); return [{ name: 'Vorfaktor des Hochsetzstellers', answer: A('buck', {}, { fields: { dil: v.boost } }) }, { name: 'nur die halbe Welligkeit', answer: A('buck', {}, { fields: { dil: v.halb } }) }, { name: 'µH nicht umgerechnet', answer: A('buck', {}, { fields: { dil: v.vorsatz } }) }]; } };
  })();

  /* ====================================================================== nt22: Lueckenden Betrieb vermeiden */
  const M22 = (() => {
    const G = { uin: 12, uout: 5, f: 100, iMin: 0.1, res: 1.25, lMax: 470 };
    const FIX = { uin: G.uin, uout: G.uout, steuer: 'geregelt', f: G.f, iout: G.iMin }, OWN = ['l'], START = { l: 10 };
    const lk = l => C().buck.lcrit({ Uin: G.uin, Uout: G.uout, f: G.f * 1e3, L: l * 1e-6, Imin: G.iMin });
    const vals = () => once('v22', () => {
      const k = lk(100), lc = k.Lkrit * 1e6, l = 220, lo = 10, hi = 1000;
      return { uin: G.uin, uout: G.uout, f: G.f, iMin: G.iMin, res: G.res, lMax: G.lMax, lc, lReq: G.res * lc, l, resL: l / lc, lo, resLo: lo / lc, hi, d: k.D * 100 };
    });
    const check = mk((r, a) => {
      const v = vals(), ctl = effCtl(a, OWN, FIX, START), s = sim('buck', ctl), l = ctl.l, k = lk(l);
      inputRow(r, a, s, 'buck');
      const good = k && k.ok;
      r(s.ok && s.m.modus === 1, 'Bei der Kleinstlast ' + eng(G.iMin, 'A') + ' lückt der Betrieb nicht (Drosselstrom fällt nicht auf 0 A)',
        'Bei L = ' + eng(l * 1e-6, 'H') + ' lückt der Betrieb: Der Drosselstrom fällt in jeder Periode auf 0 A. ' + (good ? 'Die Grenze liegt bei L_krit = ' + eng(k.Lkrit, 'H') + '.' : ''));
      r(good && l / (k.Lkrit * 1e6) >= G.res - 1e-9, 'Die Drossel hat eine Reserve von mindestens ' + f((G.res - 1) * 100, 0) + ' % über L_krit = ' + eng(v.lc * 1e-6, 'H') + ' (also mindestens ' + eng(v.lReq * 1e-6, 'H') + ')',
        good ? 'L = ' + eng(l * 1e-6, 'H') + ' ist das ' + f(l / (k.Lkrit * 1e6), 2) + '-Fache von L_krit = ' + eng(k.Lkrit, 'H') + '; verlangt ist das ' + f(G.res, 2) + '-Fache.' : 'Die Drossel ist nicht rechenbar.');
      r(fin(l) && l <= G.lMax + 1e-9, 'Die Drossel passt in den Bauraum (höchstens ' + eng(G.lMax * 1e-6, 'H') + ', Aufgabenwert)',
        'L = ' + eng(l * 1e-6, 'H') + ' ist größer als die Vorgabe ' + eng(G.lMax * 1e-6, 'H') + '. Eine übergroße Drossel kostet Platz, Geld und macht den Strom bei Laständerungen träger.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Tiefsetzsteller (Übungsschaltung) setzt ' + f(G.uin, 0) + ' V auf ' + f(G.uout, 0) + ' V herab, f = ' + f(G.f, 0) + ' kHz. Die Last kann bis auf ' + f(G.iMin, 1) + ' A fallen, auch dann soll der Betrieb nicht lücken, mit einer Reserve von ' + f((G.res - 1) * 100, 0) + ' % über der Grenze L_krit. Wegen des Bauraums darf die Drossel höchstens ' + f(G.lMax, 0) + ' µH haben (Aufgabenwert). Stelle die Drossel L im Prüfstand so ein, dass beides erfüllt ist. Die Reserve ist ein Aufgabenwert.',
      hint: () => { const v = vals(); return [
        'Der Betrieb lückt, wenn der Ausgangsstrom kleiner ist als die halbe Welligkeit ΔI_L / 2. Eine größere Drossel macht ΔI_L kleiner. Die Grenze L_krit gilt für die Kleinstlast, nicht für den Nennstrom.',
        'Mit I_aus = ' + f(v.iMin, 1) + ' A, f = ' + f(v.f, 0) + ' kHz und D = ' + f(v.d, 2) + ' % ist L_krit = ' + f(v.lc, 2) + ' µH. Mit der Reserve ' + f(v.res, 2) + ' folgt L ≥ ' + f(v.lReq, 2) + ' µH, und der Bauraum verlangt L ≤ ' + f(v.lMax, 0) + ' µH.',
        'Musterlösung: L = ' + f(v.l, 0) + ' µH, das ist das ' + f(v.resL, 2) + '-Fache von L_krit. Mit L = ' + f(v.lo, 0) + ' µH (nur das ' + f(v.resLo, 2) + '-Fache) lückt der Betrieb, ' + f(v.hi, 0) + ' µH passen nicht in den Bauraum.'
      ]; },
      start: () => A('buck', Object.assign({}, FIX, START), {}),
      sol: () => A('buck', Object.assign({}, FIX, { l: 220 }), {}),
      wrong: () => [{ name: 'Drossel zu klein (lückt)', answer: A('buck', Object.assign({}, FIX, { l: 10 }), {}) }, { name: 'Drossel übertrieben groß', answer: A('buck', Object.assign({}, FIX, { l: 1000 }), {}) }] };
  })();

  /* ====================================================================== nt23: Schaltfrequenz einstellen */
  const M23 = (() => {
    const G = { uin: 12, uout: 5, l: 100, i: 1, dMax: 0.2, anteil: 0.01 };
    const FIX = { uin: G.uin, uout: G.uout, steuer: 'geregelt', l: G.l, iout: G.i }, OWN = ['f'], START = { f: 20 };
    const pab = G.uout * G.i, pMax = G.anteil * pab;
    const dil = fk => C().buck.ccm({ Uin: G.uin, Uout: G.uout, Iout: G.i, f: fk * 1e3, L: G.l * 1e-6 }).dIL;
    const psw = fk => C().loss.parts({ kind: 'buck', Uin: G.uin, Uout: G.uout, Iout: G.i, f: fk * 1e3, L: G.l * 1e-6 }).schalt;
    const vals = () => once('v23', () => {
      const fMin = bisect(20, 500, x => dil(x) <= G.dMax, false), fMax = bisect(20, 500, x => psw(x) <= pMax, true), fs = 180;
      return { uin: G.uin, uout: G.uout, l: G.l, i: G.i, dMax: G.dMax, pab, pMax: pMax * 1000, anteil: G.anteil * 100, fMin, fMax, f: fs, dil: dil(fs), psw: psw(fs) * 1000, fLo: 20, dilLo: dil(20), fHi: 500, pswHi: psw(500) * 1000, pswHiPct: psw(500) / pab * 100 };
    });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('buck', ctl), fk = ctl.f;
      inputRow(r, a, s, 'buck');
      const d = s.m.dIL, p = fin(fk) ? psw(fk) : NaN;
      r(s.ok && fin(d) && d <= G.dMax + 1e-9, 'Die Drosselwelligkeit ΔI_L ist höchstens ' + eng(G.dMax, 'A') + ' (Aufgabenwert)',
        'Bei f = ' + eng(fk * 1e3, 'Hz') + ' ist ΔI_L = ' + eng(d, 'A') + ', erlaubt sind ' + eng(G.dMax, 'A') + '. Die Schaltfrequenz ist zu klein: ΔI_L sinkt mit steigender Frequenz.');
      r(fin(p) && p <= pMax + 1e-9, 'Der Schaltverlust P_sw bleibt unter ' + f(G.anteil * 100, 0) + ' % der Ausgangsleistung (' + eng(pMax, 'W') + ', Aufgabenwert)',
        'Bei f = ' + eng(fk * 1e3, 'Hz') + ' ist P_sw = ' + eng(p, 'W') + ' (' + f(p / pab * 100, 2) + ' % von P_ab = ' + eng(pab, 'W') + '), erlaubt sind ' + eng(pMax, 'W') + '. Die Schaltfrequenz ist zu groß: P_sw steigt mit der Frequenz.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Tiefsetzsteller (Übungsschaltung) setzt ' + f(G.uin, 0) + ' V auf ' + f(G.uout, 0) + ' V herab und liefert ' + f(G.i, 0) + ' A, die Drossel hat ' + f(G.l, 0) + ' µH (feste Werte). Stelle die Schaltfrequenz so ein, dass die Drosselwelligkeit ΔI_L höchstens ' + f(G.dMax, 1) + ' A beträgt und der Schaltverlust P_sw höchstens ' + f(G.anteil * 100, 0) + ' % der Ausgangsleistung (' + f(pMax * 1000, 0) + ' mW). Beide Grenzen sind Aufgabenwerte. Der Schaltverlust gehört zum Verlustmodell mit Übungswerten.',
      hint: () => { const v = vals(); return [
        'Zwei Wirkungen laufen gegeneinander: Eine höhere Schaltfrequenz verkleinert ΔI_L (ΔI_L ist proportional zu 1/f), vergrößert aber den Schaltverlust (P_sw ist proportional zu f). Gesucht ist das Fenster dazwischen.',
        'Mit P_ab = ' + f(v.pab, 0) + ' W gilt P_sw ≤ ' + f(v.pMax, 0) + ' mW. Aus ΔI_L ≤ ' + f(v.dMax, 1) + ' A folgt f ≥ ' + f(v.fMin, 1) + ' kHz, aus P_sw ≤ ' + f(v.pMax, 0) + ' mW folgt f ≤ ' + f(v.fMax, 1) + ' kHz.',
        'Musterlösung: f = ' + f(v.f, 0) + ' kHz gibt ΔI_L = ' + f(v.dil, 3) + ' A und P_sw = ' + f(v.psw, 1) + ' mW. Mit ' + f(v.fLo, 0) + ' kHz wäre ΔI_L = ' + f(v.dilLo, 2) + ' A, mit ' + f(v.fHi, 0) + ' kHz wäre P_sw = ' + f(v.pswHi, 0) + ' mW (' + f(v.pswHiPct, 1) + ' % von P_ab).'
      ]; },
      start: () => A('buck', Object.assign({}, FIX, START), {}),
      sol: () => A('buck', Object.assign({}, FIX, { f: 180 }), {}),
      wrong: () => [{ name: 'Frequenz zu klein (ΔI_L zu groß)', answer: A('buck', Object.assign({}, FIX, { f: 20 }), {}) }, { name: 'Frequenz zu groß (P_sw zu groß)', answer: A('buck', Object.assign({}, FIX, { f: 500 }), {}) }] };
  })();

  /* ====================================================================== nt24: Wirkungsgrad des Schaltreglers */
  const M24 = (() => {
    const G = { uin: 12, uout: 5, i: 1, f: 100e3, l: 100e-6 };
    const lp = () => once('lp24', () => { const p = C().loss.parts({ kind: 'buck', Uin: G.uin, Uout: G.uout, Iout: G.i, f: G.f, L: G.l }); if (!p || !p.ok) throw new Error('loss.parts'); return p; });
    const part = id => lp().parts.find(x => x.id === id).w;
    const vals = () => once('v24', () => {
      const p = lp(), s = p.Pv, pab = p.Pab, sD = s - part('diode'), sG = s - part('gate');
      return { uin: G.uin, uout: G.uout, i: G.i, f: G.f / 1e3, pab, cond: part('leitung') * 1000, diode: part('diode') * 1000, sw: part('schalt') * 1000, gate: part('gate') * 1000, dr: part('drossel') * 1000, sum: s * 1000, sumW: s, eta: p.eta * 100,
        sumOhneD: sD * 1000, etaOhneD: pab / (pab + sD) * 100, sumOhneG: sG * 1000, etaOhneG: pab / (pab + sG) * 100, anteil: s / (pab + s) * 100 };
    });
    const rfs = () => once('r24', () => { const v = vals(), p = lp();
      return {
        pv: own(p.Pv, 'W', { wrongs: [{ v: p.Pv - part('diode'), text: 'Es fehlt der Diodenverlust P_D = ' + eng(part('diode'), 'W') + ': Er ist hier der größte Einzelverlust, die Summe muss alle fünf Teile enthalten.' }, { v: p.Pv - part('gate'), text: 'Es fehlt der Gate-Verlust P_G = ' + eng(part('gate'), 'W') + ': Er hängt nicht von der Last ab und gehört trotzdem in die Summe.' }] }),
        eta: own(p.eta, '', { pct: true, factor: 0.01, tol: TOLE(), wrongs: [{ v: p.Pab / (p.Pab + p.Pv - part('diode')), text: 'Ohne den Diodenverlust fällt η zu groß aus (' + f(v.etaOhneD, 1) + ' %): Alle Einzelverluste gehören in P_V.' }, { v: p.Pv / (p.Pab + p.Pv), text: 'Das ist der Verlustanteil P_V / P_zu = ' + f(v.anteil, 1) + ' %. Der Wirkungsgrad ist P_ab / P_zu.' }] }) }; });
    const check = mk((r, a) => {
      const R = rfs();
      numRow(r, rawOf(a, 'pv'), R.pv, 'Die gesamte Verlustleistung P_V ist richtig summiert', 3);
      numRow(r, rawOf(a, 'eta'), R.eta, 'Der Wirkungsgrad η ist richtig berechnet', 1);
    });
    return { vals, check, consts: [],
      text: () => 'Ein Tiefsetzsteller (Übungsschaltung) setzt ' + f(G.uin, 0) + ' V auf ' + f(G.uout, 0) + ' V herab und liefert ' + f(G.i, 0) + ' A bei f = ' + f(G.f / 1e3, 0) + ' kHz. Die Tabelle nennt die Einzelverluste (Übungswerte des Lehrmodells, Datenblatt maßgeblich). Berechne die gesamte Verlustleistung P_V in W und den Wirkungsgrad η in Prozent (der Anteil als Zahl zählt auch).',
      table: () => { const v = vals(); return { caption: 'Einzelverluste (Übungswerte)', head: ['Verlust', 'Leistung'], rows: [['Leitverlust des Schalters', f(v.cond, 2) + ' mW'], ['Diodenverlust', f(v.diode, 2) + ' mW'], ['Schaltverlust', f(v.sw, 2) + ' mW'], ['Gate-Verlust', f(v.gate, 2) + ' mW'], ['Drosselkupfer', f(v.dr, 2) + ' mW']] }; },
      fields: () => [{ key: 'pv', label: 'Gesamte Verlustleistung P_V', unit: 'W' }, { key: 'eta', label: 'Wirkungsgrad η', unit: '%' }],
      hint: () => { const v = vals(); return [
        'Der Wirkungsgrad ist abgegebene durch zugeführte Leistung: η = P_ab / (P_ab + P_V). Die Verluste addierst du alle: Leitung, Diode, Schaltvorgang, Gate und Drossel. Rechne in W, nicht in mW.',
        'Die abgegebene Leistung ist P_ab = ' + f(v.uout, 0) + ' V · ' + f(v.i, 0) + ' A = ' + f(v.pab, 0) + ' W. Die Summe der fünf Einzelverluste ergibt ' + f(v.sum, 2) + ' mW.',
        'Musterlösung: P_V = ' + f(v.sum, 2) + ' mW = ' + f(v.sumW, 4) + ' W, η = ' + f(v.pab, 0) + ' W / (' + f(v.pab, 0) + ' W + ' + f(v.sumW, 4) + ' W) = ' + f(v.eta, 1) + ' %. Ohne den Diodenverlust käme P_V = ' + f(v.sumOhneD, 1) + ' mW und η = ' + f(v.etaOhneD, 1) + ' % heraus, ohne den Gate-Verlust P_V = ' + f(v.sumOhneG, 1) + ' mW.'
      ]; },
      start: () => A('buck', { uin: G.uin, uout: G.uout, iout: G.i, f: G.f / 1e3, steuer: 'geregelt' }, { fields: { pv: null, eta: null } }),
      sol: () => { const v = vals(); return A('buck', { uin: G.uin, uout: G.uout, iout: G.i, f: G.f / 1e3, steuer: 'geregelt' }, { fields: { pv: v.sumW, eta: v.eta }, value: v.sumW }); },
      wrong: () => { const v = vals(); return [
        { name: 'Diodenverlust vergessen', answer: A('buck', {}, { fields: { pv: v.sumOhneD / 1000, eta: v.etaOhneD } }) },
        { name: 'Gate-Verlust vergessen', answer: A('buck', {}, { fields: { pv: v.sumOhneG / 1000, eta: v.etaOhneG } }) },
        { name: 'Verlustanteil statt Wirkungsgrad', answer: A('buck', {}, { fields: { pv: v.sumW, eta: v.anteil } }) }]; } };
  })();

  /* ====================================================================== nt25: Hochsetzsteller auslegen */
  const M25 = (() => {
    const G = { uin: 5, uout: 12, i: 0.5, f: 100000, dMax: 0.3, ilMax: 1.5, lMax: 470 };
    const FIX = { topo: 'boost', uin: G.uin, uout: G.uout, iout: G.i, f: G.f, c: 100, n: 1 }, OWN = ['l'], START = { l: 22 };
    const bo = l => C().boost.ccm({ Uin: G.uin, Uout: G.uout, Iout: G.i, f: G.f, L: l * 1e-6, C: 100e-6 });
    const vals = () => once('v25', () => {
      const b = bo(100), lMin = bisect(10, 1000, x => bo(x).dIL <= G.dMax, false), lIl = bisect(10, 1000, x => bo(x).ILmax <= G.ilMax, false), k = bo(47);
      return { uin: G.uin, uout: G.uout, i: G.i, f: G.f / 1e3, dMax: G.dMax, ilMax: G.ilMax, lMax: G.lMax, d: b.D * 100, il: b.ILavg, dil: b.dIL, ilmax: b.ILmax, lMin, lIl, l: 100, lk: 47, dilK: k.dIL, ilmaxK: k.ILmax, lg: 1000, dMin: lv('d_min'), dHi: lv('d_max') };
    });
    const check = mk((r, a) => {
      const v = vals(), ctl = effCtl(a, OWN, FIX, START), s = sim('topo', ctl), l = ctl.l, b = fin(l) && l > 0 ? bo(l) : null;
      inputRow(r, a, s, 'topo');
      const dpc = s.m.d;
      r(s.ok && fin(dpc) && dpc >= lv('d_min') - 1e-9 && dpc <= lv('d_max') + 1e-9, 'Das Tastverhältnis D liegt im Bereich ' + f(lv('d_min'), 0) + ' % bis ' + f(lv('d_max'), 0) + ' % (Lehrfaustwerte)', 'D = ' + f(dpc, 1) + ' % liegt außerhalb des Bereichs ' + f(lv('d_min'), 0) + ' % bis ' + f(lv('d_max'), 0) + ' %.');
      r(!!b && b.ccm === true, 'Der Betrieb lückt nicht (nicht lückender Betrieb bei ' + eng(G.i, 'A') + ')', 'Bei L = ' + eng(l * 1e-6, 'H') + ' lückt der Betrieb: Der Drosselstrom fällt in jeder Periode auf 0 A.');
      r(s.ok && fin(s.m.dIL) && s.m.dIL <= G.dMax + 1e-9, 'Die Drosselwelligkeit ΔI_L ist höchstens ' + eng(G.dMax, 'A') + ' (Aufgabenwert)', 'Bei L = ' + eng(l * 1e-6, 'H') + ' ist ΔI_L = ' + eng(s.m.dIL, 'A') + ', erlaubt sind ' + eng(G.dMax, 'A') + '. Die Drossel ist zu klein.');
      r(s.ok && fin(s.m.iLmax) && s.m.iLmax <= G.ilMax + 1e-9, 'Der Spitzenstrom I_L,max bleibt unter ' + eng(G.ilMax, 'A') + ' (Aufgabenwert, Grenze des Schalters)',
        'I_L,max = ' + eng(s.m.iLmax, 'A') + ' liegt über ' + eng(G.ilMax, 'A') + '. Der mittlere Drosselstrom ist I_L = I_aus / (1 − D) = ' + eng(s.m.iL, 'A') + ', nicht ' + eng(G.i, 'A') + ': Zum Mittelwert kommt noch ΔI_L / 2.');
      r(fin(l) && l <= G.lMax + 1e-9, 'Die Drossel passt in den Bauraum (höchstens ' + eng(G.lMax * 1e-6, 'H') + ', Aufgabenwert)', 'L = ' + eng(l * 1e-6, 'H') + ' ist größer als die Vorgabe ' + eng(G.lMax * 1e-6, 'H') + '.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Hochsetzsteller (Übungsschaltung) erzeugt aus ' + f(G.uin, 0) + ' V die Spannung ' + f(G.uout, 0) + ' V bei ' + f(G.i, 1) + ' A, f = ' + f(G.f / 1e3, 0) + ' kHz. Stelle die Drossel L so ein, dass der Betrieb nicht lückt, die Drosselwelligkeit ΔI_L höchstens ' + f(G.dMax, 1) + ' A beträgt, der Spitzenstrom unter ' + f(G.ilMax, 1) + ' A bleibt und die Drossel in den Bauraum von höchstens ' + f(G.lMax, 0) + ' µH passt. Alle Grenzen sind Aufgabenwerte.',
      hint: () => { const v = vals(); return [
        'Beim Hochsetzsteller fließt der Drosselstrom dauernd in den Eingang: Der mittlere Drosselstrom ist I_L = I_aus / (1 − D), also größer als der Ausgangsstrom. Die Welligkeit ist ΔI_L = U_ein · D / (f · L).',
        'Hier ist D = ' + f(v.d, 2) + ' % und I_L = ' + f(v.il, 2) + ' A. Aus ΔI_L ≤ ' + f(v.dMax, 1) + ' A folgt L ≥ ' + f(v.lMin, 1) + ' µH; aus I_L,max = I_L + ΔI_L / 2 ≤ ' + f(v.ilMax, 1) + ' A folgt L ≥ ' + f(v.lIl, 1) + ' µH; der Bauraum verlangt L ≤ ' + f(v.lMax, 0) + ' µH.',
        'Musterlösung: L = ' + f(v.l, 0) + ' µH gibt ΔI_L = ' + f(v.dil, 3) + ' A und I_L,max = ' + f(v.ilmax, 3) + ' A. Mit ' + f(v.lk, 0) + ' µH wären es ΔI_L = ' + f(v.dilK, 3) + ' A und I_L,max = ' + f(v.ilmaxK, 3) + ' A, mit ' + f(v.lg, 0) + ' µH passt die Drossel nicht in den Bauraum.'
      ]; },
      start: () => A('topo', Object.assign({}, FIX, START), {}),
      sol: () => A('topo', Object.assign({}, FIX, { l: 100 }), {}),
      wrong: () => [{ name: 'Drossel zu klein (ΔI_L zu groß)', answer: A('topo', Object.assign({}, FIX, { l: 47 }), {}) }, { name: 'Drossel übertrieben groß', answer: A('topo', Object.assign({}, FIX, { l: 1000 }), {}) }] };
  })();

  /* ====================================================================== nt26: Inverswandler, negative Spannung */
  const M26 = (() => {
    const G = { uin: 12, uout: 5 };
    const FIX = { uin: G.uin, l: 220, c: 100, iout: 0.5, f: 100000, n: 1 }, OWN = ['topo', 'uout'], START = { topo: 'boost', uout: 12 };
    const bb = () => once('bb26', () => C().bb.ccm({ Uin: G.uin, Uout: -G.uout, Iout: 0.5, f: 100000, L: 220e-6, C: 100e-6 }));
    const vals = () => once('v26', () => { const d = bb().D; return { uin: G.uin, uout: G.uout, summe: G.uin + G.uout, d: d * 100, buck: G.uout / G.uin * 100, rest: (1 - d) * 100, il: bb().ILavg }; });
    const rf = () => once('r26', () => { const v = vals(), d = v.d / 100;
      return own(d, '', { pct: true, factor: 0.01, tol: TOLE(), wrongs: [
        { v: G.uout / G.uin, text: 'Du hast U_aus / U_ein = ' + f(v.buck, 2) + ' % gerechnet (Tiefsetzsteller). Beim Inverswandler ist D = |U_aus| / (U_ein + |U_aus|).' },
        { v: 1 - d, text: 'Das ist 1 − D = ' + f(v.rest, 2) + ' %, die Ausschaltdauer. Gesucht ist die Einschaltdauer D = |U_aus| / (U_ein + |U_aus|).' }] }); });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('topo', ctl);
      inputRow(r, a, s, 'topo');
      const t = C().topology({ Uin: G.uin, Uout: -G.uout });
      r(ctl.topo === 'invers', 'Der Prüfstand ist auf den Inverswandler eingestellt', 'Für eine negative Ausgangsspannung aus ' + eng(G.uin, 'V') + ' braucht es den Inverswandler (Kern: ' + (t && t.name ? t.name : 'Inverswandler') + '), im Prüfstand ist „' + String(s.st && s.st.topoName || ctl.topo) + '“ eingestellt.');
      r(fin(ctl.uout) && Math.abs(ctl.uout - G.uout) < 0.05, 'Der Betrag der Ausgangsspannung ist ' + eng(G.uout, 'V') + ' (gegen Masse negativ)', 'Eingestellt ist ein Betrag von ' + eng(ctl.uout, 'V') + ', verlangt sind ' + eng(G.uout, 'V') + '.');
      numRow(r, rawOf(a, 'd'), rf(), 'Das Tastverhältnis D ist richtig berechnet', 2);
    });
    return { vals, check, consts: [],
      text: () => 'Aus einer Quelle mit U_ein = ' + f(G.uin, 0) + ' V soll eine negative Spannung U_aus = −' + f(G.uout, 0) + ' V gegen Masse entstehen (Übungsschaltung, ideal, nicht lückend). Wähle im Prüfstand die passende Grundschaltung, stelle den Betrag der Ausgangsspannung ein und berechne das Tastverhältnis D. Trage D in Prozent ein; der Anteil als Zahl zählt auch.',
      fields: () => [{ key: 'd', label: 'Tastverhältnis D', unit: '%' }],
      hint: () => { const v = vals(); return [
        'Eine Spannung mit umgekehrtem Vorzeichen erzeugt der Inverswandler (Buck-Boost). Er speichert Energie in der Drossel und gibt sie mit umgekehrter Polarität ab. Die Formel für D unterscheidet sich vom Tiefsetzsteller.',
        'Es gilt D = |U_aus| / (U_ein + |U_aus|) = ' + f(v.uout, 0) + ' V / (' + f(v.uin, 0) + ' V + ' + f(v.uout, 0) + ' V). Der Nenner enthält beide Spannungen.',
        'Musterlösung: D = ' + f(v.uout, 0) + ' / ' + f(v.summe, 0) + ' = ' + f(v.d, 2) + ' %. Wer wie beim Tiefsetzsteller ' + f(v.uout, 0) + ' / ' + f(v.uin, 0) + ' rechnet, erhält ' + f(v.buck, 2) + ' %, die Ausschaltdauer wäre ' + f(v.rest, 2) + ' %.'
      ]; },
      start: () => A('topo', Object.assign({}, FIX, START), { fields: { d: null } }),
      sol: () => A('topo', Object.assign({}, FIX, { topo: 'invers', uout: G.uout }), { fields: { d: vals().d }, value: vals().d }),
      wrong: () => { const v = vals(); return [
        { name: 'falsche Grundschaltung (Hochsetzsteller)', answer: A('topo', Object.assign({}, FIX, { topo: 'boost', uout: G.uout }), { fields: { d: v.d } }) },
        { name: 'D wie beim Tiefsetzsteller', answer: A('topo', Object.assign({}, FIX, { topo: 'invers', uout: G.uout }), { fields: { d: v.buck } }) },
        { name: 'Betrag der Ausgangsspannung falsch', answer: A('topo', Object.assign({}, FIX, { topo: 'invers', uout: 12 }), { fields: { d: v.d } }) }]; } };
  })();

  /* ====================================================================== nt27: Gate-Widerstand waehlen */
  const M27 = (() => {
    const G = { tMin: 12, pMax: 50 };   // ns, mW (Aufgabenwerte)
    const FIX = { ug: 10, qg: 20, qgd: 5, f: 100000, uin: 12, i: 1, halbbruecke: false, ton: 100, toff: 0 }, OWN = ['rg'], START = { rg: 10 };
    const drv = rg => C().gate.drive({ UG: FIX.ug, Rg: rg, Qg: FIX.qg * 1e-9, Qgd: FIX.qgd * 1e-9, f: FIX.f });
    const swc = rg => C().gate.switching({ UG: FIX.ug, Rg: rg, Qg: FIX.qg * 1e-9, Qgd: FIX.qgd * 1e-9, f: FIX.f, Uin: FIX.uin, I: FIX.i });
    const vals = () => once('v27', () => {
      const rMin = bisect(1, 100, x => drv(x).t_sw * 1e9 >= G.tMin, false), rMax = bisect(1, 100, x => swc(x).Psw * 1e3 <= G.pMax, true), rs = 22, d = drv(rs), s = swc(rs), dk = drv(4.7), sg = swc(100);
      return { ug: FIX.ug, uin: FIX.uin, i: FIX.i, tMin: G.tMin, pMax: G.pMax, rMin, rMax, r: rs, tsw: d.t_sw * 1e9, psw: s.Psw * 1e3, rk: 4.7, tswK: dk.t_sw * 1e9, rg: 100, pswG: sg.Psw * 1e3, rStart: 10, tswStart: drv(10).t_sw * 1e9 };
    });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('gate', ctl);
      inputRow(r, a, s, 'gate');
      const t = s.m.tsw, p = s.m.psw;
      r(s.ok && fin(t) && t >= G.tMin - 1e-9, 'Die Schaltzeit t_sw beträgt mindestens ' + f(G.tMin, 0) + ' ns (Aufgabenwert, damit die Störungen klein bleiben)',
        'Bei R_g = ' + eng(ctl.rg, 'Ω') + ' ist t_sw = ' + f(t, 1) + ' ns, verlangt sind mindestens ' + f(G.tMin, 0) + ' ns. Der Gate-Widerstand ist zu klein: Die Flanke ist zu steil, das stört (Link EMV).');
      r(s.ok && fin(p) && p <= G.pMax + 1e-9, 'Der Schaltverlust P_sw beträgt höchstens ' + f(G.pMax, 0) + ' mW (Aufgabenwert)',
        'Bei R_g = ' + eng(ctl.rg, 'Ω') + ' ist P_sw = ' + f(p, 1) + ' mW, erlaubt sind ' + f(G.pMax, 0) + ' mW. Der Gate-Widerstand ist zu groß: Die Flanke ist zu langsam, das kostet Schaltverlust.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein MOSFET (Übungsschaltung) schaltet ' + f(FIX.uin, 0) + ' V bei ' + f(FIX.i, 0) + ' A mit ' + f(FIX.f / 1e3, 0) + ' kHz, die Gate-Spannung beträgt ' + f(FIX.ug, 0) + ' V. Wähle den Gate-Widerstand R_g so, dass die Schaltzeit t_sw mindestens ' + f(G.tMin, 0) + ' ns beträgt (sonst stören die steilen Flanken) und der Schaltverlust P_sw höchstens ' + f(G.pMax, 0) + ' mW (sonst wird die Flanke zu langsam). Beide Grenzen sind Aufgabenwerte.',
      hint: () => { const v = vals(); return [
        'Ein größerer R_g lädt das Gate langsamer um: Die Schaltzeit t_sw wächst mit R_g, der Gate-Strom auf dem Plateau sinkt. Langsames Schalten dämpft Störungen, kostet aber Verluste, denn P_sw wächst mit der Flankenzeit.',
        'Beide Größen sind proportional zu R_g. Aus t_sw ≥ ' + f(v.tMin, 0) + ' ns folgt R_g ≥ ' + f(v.rMin, 1) + ' Ω; aus P_sw ≤ ' + f(v.pMax, 0) + ' mW folgt R_g ≤ ' + f(v.rMax, 1) + ' Ω.',
        'Musterlösung: R_g = ' + f(v.r, 0) + ' Ω gibt t_sw = ' + f(v.tsw, 1) + ' ns und P_sw = ' + f(v.psw, 1) + ' mW. Mit ' + f(v.rk, 1) + ' Ω wäre t_sw = ' + f(v.tswK, 1) + ' ns, mit ' + f(v.rg, 0) + ' Ω wäre P_sw = ' + f(v.pswG, 1) + ' mW.'
      ]; },
      start: () => A('gate', Object.assign({}, FIX, START), {}),
      sol: () => A('gate', Object.assign({}, FIX, { rg: 22 }), {}),
      wrong: () => [{ name: 'R_g zu klein (Flanke zu steil)', answer: A('gate', Object.assign({}, FIX, { rg: 4.7 }), {}) }, { name: 'R_g zu groß (P_sw zu groß)', answer: A('gate', Object.assign({}, FIX, { rg: 100 }), {}) }] };
  })();

  /* ====================================================================== nt28: Rueckkopplungsteiler berechnen (Pool W2023-07, U_aus = 9,0 V gemaess VERTRAG) */
  const M28 = (() => {
    const G = { r1: 1000, ua: 9 };
    const vals = () => once('v28', () => {
      const r2 = fml('r2lm317', G.ua, G.r1), uref = lv('uref_317');
      return { r1: G.r1 / 1e3, ua: G.ua, uref, r2: r2 / 1e3, ratio: G.ua / uref, vertauscht: G.r1 / (G.ua / uref - 1), ohneMinus: G.r1 * G.ua / uref / 1e3, r2s: 3000, uas: C().loop.divider({ R1: G.r1, R2: 3000 }).Uaus };
    });
    const rf = () => once('r28', () => { const v = vals();
      return own(v.r2 * 1e3, 'Ω', { factor: 1e3, tol: TOLE(), wrongs: [
        { v: v.vertauscht, text: 'R1 und R2 sind vertauscht: R2 = R1 / (U_aus/U_ref − 1) = ' + eng(v.vertauscht, 'Ω') + ' ist falsch. R2 liegt im Zähler: R2 = R1 · (U_aus/U_ref − 1).' },
        { v: v.ohneMinus * 1e3, text: 'Es fehlt das „− 1“: R2 = R1 · (U_aus/U_ref − 1), nicht R1 · U_aus/U_ref.' }] }); });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'r2'), rf(), 'Der Widerstand R2 ist richtig berechnet', 2); });
    return { vals, check, consts: [],
      text: () => 'Der Rückkopplungsteiler eines Schaltreglers (Übungsschaltung) hat R1 = ' + f(G.r1 / 1e3, 0) + ' kΩ nach Masse und R2 vom Ausgang zum Rückkopplungseingang. Der Regler hält am Rückkopplungseingang die Referenzspannung ' + eng(lv('uref_317'), 'V') + ' (belegt). Welchen Wert muss R2 haben, damit die Ausgangsspannung U_aus = ' + f(G.ua, 1) + ' V beträgt? Trage R2 in kΩ ein.',
      fields: () => [{ key: 'r2', label: 'Widerstand R2', unit: 'kΩ' }],
      hint: () => { const v = vals(); return [
        'Der Teiler hält am Rückkopplungseingang U_ref. Der Strom durch R1 ist U_ref / R1; derselbe Strom fließt durch R2. Daraus folgt U_aus = U_ref · (1 + R2 / R1). Stelle nach R2 um.',
        'Es ist U_aus / U_ref = ' + f(v.ua, 1) + ' V / ' + f(v.uref, 2) + ' V = ' + f(v.ratio, 1) + '. Davon eins abziehen und mit R1 = ' + f(v.r1, 0) + ' kΩ malnehmen.',
        'Musterlösung: R2 = ' + f(v.r1, 0) + ' kΩ · (' + f(v.ratio, 1) + ' − 1) = ' + f(v.r2, 1) + ' kΩ. Mit vertauschten Widerständen käme ' + f(v.vertauscht, 1) + ' Ω heraus, ohne das „− 1“ ' + f(v.ohneMinus, 1) + ' kΩ.'
      ]; },
      start: () => A('regel', { modus: 'regelung', r1: G.r1, r2: vals().r2s }, { fields: { r2: null } }),
      sol: () => A('regel', { modus: 'regelung', r1: G.r1, r2: vals().r2 * 1e3 }, { fields: { r2: vals().r2 }, value: vals().r2 }),
      wrong: () => { const v = vals(); return [{ name: 'R1 und R2 vertauscht', answer: A('regel', {}, { fields: { r2: v.vertauscht / 1e3 } }) }, { name: 'Minus 1 vergessen', answer: A('regel', {}, { fields: { r2: v.ohneMinus } }) }]; } };
  })();

  /* ====================================================================== nt29: Labornetzteil: CV oder CC? */
  const M29 = (() => {
    const G = { u: 12, i: 1, loads: [{ k: 'l1', r: 47 }, { k: 'l2', r: 20 }, { k: 'l3', r: 8 }, { k: 'l4', r: 3.3 }] };
    const cv = r => C().lab.cvcc({ Uset: G.u, Iset: G.i, Rlast: r });
    const free = r => C().lab.cvcc({ Uset: G.u, Iset: 1e9, Rlast: r });
    const specs = () => once('s29', () => G.loads.map(l => {
      const c = cv(l.r), fr = free(l.r), isCV = c.modus === 'CV';
      const gCV = isCV ? c.diag[0].text : 'Im CV müsste die Last bei ' + eng(G.u, 'V') + ' den Strom ' + eng(fr.Iout, 'A') + ' ziehen (U_set / R_last), mehr als I_set = ' + eng(G.i, 'A') + ': Die Strombegrenzung greift, die Spannung kann nicht gehalten werden.';
      const gCC = !isCV ? c.diag[0].text : 'Im CC wäre der Strom auf ' + eng(G.i, 'A') + ' begrenzt, die Last zieht bei ' + eng(G.u, 'V') + ' aber nur ' + eng(c.Iout, 'A') + ' (U_set / R_last): Die Begrenzung wird nie erreicht, die Spannung bleibt bei ' + eng(G.u, 'V') + '.';
      return { key: l.k, right: isCV ? 'cv' : 'cc', q: 'Das Labornetzteil ist auf ' + eng(G.u, 'V') + ' und ' + eng(G.i, 'A') + ' eingestellt. Die Last hat R_last = ' + eng(l.r, 'Ω') + '. In welchem Betrieb arbeitet es?', short: 'Der Betrieb bei R_last = ' + eng(l.r, 'Ω') + ' ist richtig bestimmt',
        options: [{ value: 'cv', label: 'CV (Spannungsregelung)', grund: gCV }, { value: 'cc', label: 'CC (Stromregelung)', grund: gCC }] };
    }));
    const vals = () => once('v29', () => { const k = cv(20); return { u: G.u, i: G.i, rkrit: k.Rkrit, kehr: G.i / G.u, r1: G.loads[0].r, r2: G.loads[1].r, r3: G.loads[2].r, r4: G.loads[3].r, i2: cv(20).Iout, i3: cv(8).Iout, u3: cv(8).Uout, u4: cv(3.3).Uout }; });
    const rf = () => once('r29', () => { const v = vals();
      return own(v.rkrit, 'Ω', { wrongs: [{ v: v.kehr, text: 'Du hast I_set / U_set = ' + f(v.kehr, 4) + ' gerechnet (das ist ein Leitwert in S). Der Grenzwiderstand ist R_krit = U_set / I_set.' }] }); });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'rkrit'), rf(), 'Der Grenzwiderstand R_krit ist richtig berechnet', 2); choiceRows(r, a, specs()); });
    const START = () => A('regel', { modus: 'labor', uset: G.u, iset: G.i, rlast: 20, rs: 0.6, uin: 24, erwartet: '' }, { fields: { rkrit: null }, choices: {} });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein Labornetzteil (Übungsschaltung) ist auf U_set = ' + f(G.u, 0) + ' V und I_set = ' + f(G.i, 0) + ' A eingestellt. Berechne zuerst den Grenzwiderstand R_krit, bei dem es von der Spannungsregelung (CV) in die Stromregelung (CC) wechselt, und bestimme dann für vier Lastwiderstände den Betrieb. Im Prüfstand „Regelkreis und Labornetzteil“ (Modus Labornetzteil) kannst du alles ausprobieren.',
      fields: () => [{ key: 'rkrit', label: 'Grenzwiderstand R_krit', unit: 'Ω' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Bei großem Lastwiderstand fließt wenig Strom: Die Spannung bleibt auf dem eingestellten Wert (CV). Bei kleinem Lastwiderstand würde der Strom über I_set steigen: Dann hält das Gerät den Strom fest und die Spannung sinkt (CC). Die Grenze liegt bei R_krit = U_set / I_set.',
        'R_krit = ' + f(v.u, 0) + ' V / ' + f(v.i, 0) + ' A = ' + f(v.rkrit, 0) + ' Ω. Lasten über ' + f(v.rkrit, 0) + ' Ω (' + f(v.r1, 0) + ' Ω und ' + f(v.r2, 0) + ' Ω) laufen im CV, Lasten darunter (' + f(v.r3, 0) + ' Ω und ' + f(v.r4, 1) + ' Ω) im CC.',
        'Musterlösung: R_krit = ' + f(v.rkrit, 0) + ' Ω; ' + f(v.r2, 0) + ' Ω: CV mit ' + f(v.i2, 1) + ' A; ' + f(v.r3, 0) + ' Ω: CC mit ' + f(v.i3, 0) + ' A und ' + f(v.u3, 1) + ' V; ' + f(v.r4, 1) + ' Ω: CC mit ' + f(v.u4, 1) + ' V.'
      ]; },
      start: START, sol: () => A('regel', START().controls, { fields: { rkrit: vals().rkrit }, value: vals().rkrit, choices: rightOf(specs()) }),
      wrong: () => { const v = vals(); return [
        { name: 'Grenzwiderstand als Kehrwert, Betriebsarten vertauscht', answer: A('regel', {}, { fields: { rkrit: v.kehr }, choices: { l1: 'cc', l2: 'cc', l3: 'cv', l4: 'cv' } }) },
        { name: 'R_krit richtig, immer CV', answer: A('regel', {}, { fields: { rkrit: v.rkrit }, choices: { l1: 'cv', l2: 'cv', l3: 'cv', l4: 'cv' } }) }]; } };
  })();

  /* ====================================================================== nt30: Labornetzteil einstellen */
  const M30 = (() => {
    const G = { r: 30, us: 9, iMax: 0.5, res: 1.25 };
    const FIX = { modus: 'labor', rlast: G.r, rs: 0.6, uin: 24, erwartet: 'CV' }, OWN = ['uset', 'iset'], START = { uset: 5, iset: 0.1 };
    const cv = (u, i, r) => C().lab.cvcc({ Uset: u, Iset: i, Rlast: r });
    const vals = () => once('v30', () => {
      const il = cv(G.us, 1e9, G.r).Iout, iReq = G.res * il, k = cv(G.us, 0.4, G.r), kz = cv(G.us, 0.4, 0), k1 = cv(G.us, 1.0, 0), k2 = cv(G.us, 0.2, G.r);
      return { r: G.r, us: G.us, iMax: G.iMax, res: G.res, il, iReq, iset: 0.4, rkrit: k.Rkrit, iout: k.Iout, ikurz: kz.Iout, iHoch: 1.0, ikurzHoch: k1.Iout, iKlein: 0.2, rkritKlein: k2.Rkrit, uKlein: k2.Uout };
    });
    const check = mk((r, a) => {
      const v = vals(), ctl = effCtl(a, OWN, FIX, START), s = sim('regel', ctl), sk = sim('regel', Object.assign({}, ctl, { rlast: 0 }));
      inputRow(r, a, s, 'regel');
      const c = cv(ctl.uset, ctl.iset, G.r), good = c && c.ok;
      r(s.ok && s.st.betrieb === 'CV', 'Die Last läuft im CV-Betrieb (Spannungsregelung)',
        good ? 'Mit R_krit = U_set / I_set = ' + eng(c.Rkrit, 'Ω') + ' liegt die Last mit ' + eng(G.r, 'Ω') + ' darunter: Das Labornetzteil arbeitet im CC, der Strom ist auf ' + eng(c.Iout, 'A') + ' begrenzt und U_aus sinkt auf ' + eng(c.Uout, 'V') + '.' : 'Die Einstellung ist nicht rechenbar.');
      r(s.ok && fin(s.m.uaus) && Math.abs(s.m.uaus - G.us) <= TOLE() * G.us, 'Die Ausgangsspannung beträgt ' + eng(G.us, 'V') + ' (Toleranz ' + f(TOLE() * 100, 0) + ' %)', 'Am Ausgang liegen ' + eng(s.m.uaus, 'V') + ', verlangt sind ' + eng(G.us, 'V') + '.');
      r(good && ctl.iset >= v.iReq - 1e-9, 'Die Strombegrenzung hat eine Reserve von mindestens ' + f((G.res - 1) * 100, 0) + ' % über dem Laststrom ' + eng(v.il, 'A') + ' (also mindestens ' + eng(v.iReq, 'A') + ', Aufgabenwert)',
        'I_set = ' + eng(ctl.iset, 'A') + ' ist das ' + f(ctl.iset / v.il, 2) + '-Fache des Laststroms ' + eng(v.il, 'A') + '; verlangt ist das ' + f(G.res, 2) + '-Fache.');
      r(sk.ok && fin(sk.m.iaus) && sk.m.iaus <= G.iMax + 1e-9, 'Im Kurzschluss fließt höchstens ' + eng(G.iMax, 'A') + ' (Schutzgrenze des Verbrauchers, Aufgabenwert)',
        'Im Kurzschluss fließt I_set = ' + eng(sk.m.iaus, 'A') + ', erlaubt sind ' + eng(G.iMax, 'A') + '. I_set ist zu hoch.');
    });
    return { vals, check, consts: [],
      text: () => 'Ein Verbraucher mit dem Ersatzwiderstand R = ' + f(G.r, 0) + ' Ω soll mit ' + f(G.us, 0) + ' V versorgt werden (Übungsschaltung). Er darf auch im Fehlerfall höchstens ' + f(G.iMax, 1) + ' A bekommen (Schutzgrenze, Aufgabenwert). Stelle am Labornetzteil U_set und I_set so ein, dass die Last im CV-Betrieb läuft, die Spannung stimmt (Toleranz ' + f(TOLE() * 100, 0) + ' %), die Strombegrenzung eine Reserve von ' + f((G.res - 1) * 100, 0) + ' % über dem Laststrom hat (Aufgabenwert) und im Kurzschluss höchstens ' + f(G.iMax, 1) + ' A fließen.',
      hint: () => { const v = vals(); return [
        'Im CV-Betrieb bestimmt der Lastwiderstand den Strom: I = U_set / R. Damit das Gerät nicht in die Strombegrenzung läuft, muss I_set über diesem Strom liegen. Im Kurzschluss fließt genau I_set, das ist die Schutzwirkung.',
        'Der Laststrom ist ' + f(v.us, 0) + ' V / ' + f(v.r, 0) + ' Ω = ' + f(v.il, 2) + ' A. Mit der Reserve ' + f(v.res, 2) + ' folgt I_set ≥ ' + f(v.iReq, 3) + ' A, die Schutzgrenze verlangt I_set ≤ ' + f(v.iMax, 1) + ' A.',
        'Musterlösung: U_set = ' + f(v.us, 0) + ' V, I_set = ' + f(v.iset, 1) + ' A (R_krit = ' + f(v.rkrit, 1) + ' Ω, Kurzschlussstrom ' + f(v.ikurz, 1) + ' A). Mit I_set = ' + f(v.iHoch, 1) + ' A flössen im Kurzschluss ' + f(v.ikurzHoch, 1) + ' A, mit ' + f(v.iKlein, 1) + ' A läuft die Last im CC (R_krit = ' + f(v.rkritKlein, 1) + ' Ω, nur ' + f(v.uKlein, 1) + ' V).'
      ]; },
      start: () => A('regel', Object.assign({}, FIX, START), {}),
      sol: () => A('regel', Object.assign({}, FIX, { uset: 9, iset: 0.4 }), {}),
      wrong: () => [{ name: 'I_set zu hoch (Kurzschlussstrom über der Schutzgrenze)', answer: A('regel', Object.assign({}, FIX, { uset: 9, iset: 1 }), {}) }, { name: 'I_set zu klein (Last im CC)', answer: A('regel', Object.assign({}, FIX, { uset: 9, iset: 0.2 }), {}) }] };
  })();

  /* ====================================================================== Fehlersuche (nt31, nt32) */
  const FS = (() => {
    const fmemo = {};
    function facts(netz, fid) {
      const key = netz + '|' + fid; if (fmemo[key]) return fmemo[key];
      const F = C().fault, st = F.make(fid, { netz });
      if (!st || !st.ok) throw new Error('Fehlerfall nicht erzeugbar: ' + fid);
      const wichtig = [];
      F.probe.points.forEach(p => { const q = F.probe(st, p); if (q && q.ok && q.abweichung === true) wichtig.push(p); });
      let bt = null;
      F.parts(netz).forEach(p => { if (bt === null) { const q = F.repair(st, p.id); if (q && q.ok && q.behoben) bt = p.id; } });
      const cat = F.catalog.find(c => c.id === fid) || {};
      return (fmemo[key] = { st, wichtig, bt, cat });
    }
    const pname = (netz, id) => { const p = C().fault.parts(netz).find(x => x.id === id); return p ? p.name : id; };
    const ptname = id => { const i = C().fault.probe.info[id]; return i ? i.name : id; };
    function clicksOf(a) {
      const out = [];
      const add = c => {
        if (typeof c === 'string' && c) out.push(c);
        else if (isObj(c)) { if (c.sicht) out.push('sicht'); else if (typeof c.tausche === 'string' && c.tausche) out.push('tausche:' + c.tausche); else if (typeof c.point === 'string' && c.point) out.push('messe:' + c.point); }
      };
      const src = Array.isArray(a.clicks) && a.clicks.length ? a.clicks : (isObj(a.controls) && Array.isArray(a.controls.clicks) ? a.controls.clicks : []);
      src.slice(0, 300).forEach(add);
      return out.filter((c, i) => i === 0 || c !== out[i - 1]);
    }
    /* Zeilen der Suche am Netzteil des Prueftands: S = { netz, fid, symptom } */
    function searchRows(r, a, S) {
      const F = C().fault, fx = facts(S.netz, S.fid), clicks = clicksOf(a), ctlA = obj(a.controls), errs = [];
      if (typeof a.rig === 'string' && a.rig !== 'fehler') errs.push('Die Aufgabe gehört zum Prüfstand „Fehlersuche“, im Prüfstand-Tab ist aber „' + a.rig + '“ eingestellt.');
      if (typeof ctlA.netz === 'string' && ctlA.netz !== '' && ctlA.netz !== S.netz) errs.push('Im Prüfstand ist ein anderes Netzteil eingestellt als in der Aufgabe. Starte die Aufgabe neu.');
      if (typeof ctlA.fehler === 'string' && ctlA.fehler !== '' && ctlA.fehler !== S.fid) errs.push('Im Prüfstand ist nicht der Fehler der Aufgabe eingebaut. Starte die Aufgabe neu.');
      r(errs.length === 0, 'Im Prüfstand ist das Netzteil der Aufgabe eingestellt', errs.join(' '));
      const gem = clicks.filter(c => /^messe:/.test(c)).map(c => c.slice(6)), tz = clicks.filter(c => /^tausche:/.test(c)).map(c => c.slice(8));
      const o = F.order(clicks, S.symptom) || {}, dg = typeof a.diagnose === 'string' && a.diagnose ? a.diagnose : (typeof ctlA.diagnose === 'string' ? ctlA.diagnose : '');
      r(gem.length > 0, 'Es wurde mindestens ein Messpunkt gemessen', 'Es wurde noch nichts gemessen: Wähle einen Messpunkt und löse die Messung aus.');
      r(gem.length > 0 && o.ok === true && !o.abweichung, 'Die Prüfreihenfolge entspricht der Empfehlung (Sichtprüfung, Versorgung, Zwischenkreis, Regler, Last)',
        gem.length === 0 ? 'Ohne Messung lässt sich die Reihenfolge nicht beurteilen.' : (o.text || 'Die Reihenfolge weicht von der Empfehlung ab.'));
      const treffer = gem.filter(p => fx.wichtig.indexOf(p) >= 0);
      r(treffer.length > 0, 'Ein Messpunkt, an dem sich der Fehler zeigt, wurde gemessen',
        (gem.length ? 'Gemessen wurde: ' + gem.map(ptname).join(', ') + '. ' : '') + 'Der Fehler zeigt sich an: ' + fx.wichtig.slice(0, 3).map(ptname).join(', ') + '.');
      const dgName = dg ? ((C().fault.catalog.find(c => c.id === dg) || {}).name || dg) : '';
      r(dg === S.fid, 'Die Diagnose nennt die richtige Ursache',
        !dg ? 'Du hast noch keine Diagnose abgegeben: Wähle die Ursache aus.' : C().TEXTS.get('fehler-falsch', { diagnose: dgName, fehler: fx.cat.name || S.fid, hinweis: 'Prüfe die Messpunkte: ' + fx.wichtig.slice(0, 3).map(ptname).join(', ') + '.' }).text);
      const falsch = tz.filter(x => x !== fx.bt);
      r(tz.length > 0 && falsch.length === 0 && tz.indexOf(fx.bt) >= 0 && !o.tauschOhneMessung, 'Nur das defekte Bauteil wurde getauscht, und erst nach einer Messung',
        tz.length === 0 ? 'Es wurde noch kein Bauteil getauscht, der Fehler ist nicht behoben.'
          : falsch.length ? 'Getauscht wurde „' + pname(S.netz, falsch[0]) + '“: Dieses Bauteil war nicht defekt, der Fehler bleibt. Erst messen, dann tauschen.'
            : tz.indexOf(fx.bt) < 0 ? 'Das defekte Bauteil wurde nicht getauscht.'
              : 'Du hast getauscht, bevor du etwas gemessen hast: Tauschen ohne Messung ist Raten und kann Schäden anrichten.');
      const seq = clicks.map((c, i) => ({ t: i, do: c }));
      const res = C().runSeq('fehler', seq, clicks.length + 1, { controls: { netz: S.netz, fehler: S.fid, diagnose: dg }, samples: 1 });
      const as = res && res.assess ? res.assess : {};
      r(as.ampel === 'gruen', 'Der Prüfstand meldet: Fehler gefunden und begründet', as.text || 'Der Prüfstand konnte die Suche nicht bewerten.');
    }
    return { facts, pname, ptname, searchRows, clicksOf };
  })();

  /* ====================================================================== nt31: Netzteil repariert? (Fehlersuche) */
  const M31 = (() => {
    const S = { netz: 'linear', fid: 'regler-eingang-niedrig', symptom: 'zu-niedrig' };
    const vals = () => once('v31', () => {
      const fx = FS.facts(S.netz, S.fid), F = C().fault, q = p => F.probe(fx.st, p);
      return { uaus: q('u_aus').value, uausSoll: q('u_aus').soll, usek: q('u_sek').value, usekSoll: q('u_sek').soll, uc: q('u_c').value, ucSoll: q('u_c').soll, n: fx.wichtig.length };
    });
    const check = mk((r, a) => { FS.searchRows(r, a, S); });
    const STARTC = { netz: S.netz, fehler: S.fid };
    return { vals, check, consts: [],
      text: () => 'Ein Linearnetzteil (Übungsschaltung: Transformator, Brückengleichrichter, Ladekondensator, 7805) liefert statt 5 V eine zu niedrige Ausgangsspannung. Du suchst den Fehler am freigeschalteten Gerät in der Simulation, nur hinter dem Transformator im Kleinspannungskreis (keine Messung am Netz, keine Reparaturanleitung). Mache die Sichtprüfung, miss die passenden Messpunkte in der empfohlenen Reihenfolge, gib die Ursache als Diagnose ab und tausche erst dann das defekte Bauteil. Das Lab ersetzt keine Unterweisung; Arbeiten an Netzspannung nur durch Elektrofachkraft oder unterwiesene Person.',
      hint: () => { const v = vals(); return [
        'Gehe vom Symptom zur Ursache: erst ansehen, dann die Versorgung prüfen, dann den Zwischenkreis am Ladekondensator, dann den Regler, zuletzt die Last. Jeder Schritt schließt einen Teil des Netzteils aus. Bauteile tauschst du erst, wenn Messwerte die Ursache zeigen.',
        'Soll und Ist der Ausgangsspannung unterscheiden sich: ' + f(v.uausSoll, 2) + ' V sollen es sein, gemessen sind ' + f(v.uaus, 2) + ' V. Vergleiche danach die Sekundärspannung (Soll ' + f(v.usekSoll, 2) + ' V) und die Spannung am Ladekondensator (Soll ' + f(v.ucSoll, 2) + ' V), um den Fehler einzugrenzen.',
        'Musterlösung: Sichtprüfung, dann u_sek messen (' + f(v.usek, 2) + ' V statt ' + f(v.usekSoll, 2) + ' V, hier weicht es zuerst ab), dann die Spannung am Ladekondensator (' + f(v.uc, 2) + ' V statt ' + f(v.ucSoll, 2) + ' V) und die Ausgangsspannung. Diagnose „Regler-Eingang zu niedrig (Dropout)“, defektes Bauteil ist der Transformator. Ein Tausch des Reglers würde den Fehler nicht beheben.'
      ]; },
      start: () => A('fehler', STARTC, {}),
      sol: () => A('fehler', Object.assign({ diagnose: S.fid }, STARTC), { clicks: ['sicht', 'messe:u_sek', 'messe:u_c', 'messe:u_aus', 'tausche:trafo'], diagnose: S.fid }),
      wrong: () => [
        { name: 'falsches Bauteil getauscht, falsche Diagnose', answer: A('fehler', Object.assign({ diagnose: 'regler-kurzschluss' }, STARTC), { clicks: ['sicht', 'messe:u_aus', 'tausche:regler'], diagnose: 'regler-kurzschluss' }) },
        { name: 'getauscht ohne Messung', answer: A('fehler', Object.assign({ diagnose: S.fid }, STARTC), { clicks: ['tausche:trafo'], diagnose: S.fid }) }] };
  })();

  /* ====================================================================== nt32: Meisterstueck: Das Netzteil des Kollegen */
  const M32 = (() => {
    const A_ = { netz: 'linear', fid: 'gleichrichter-diode-offen', symptom: 'brummt' }, B_ = { netz: 'buck', fid: 'r1-offen' };
    const PTS = ['u_c', 'u_aus', 'u_fb', 'u_r2', 'i_aus'];
    const rowB = () => once('rb32', () => { const fx = FS.facts(B_.netz, B_.fid), F = C().fault; return PTS.map(p => { const q = F.probe(fx.st, p); return { p, name: q.name, ist: q.text, soll: q.sollText, uist: q.value, usoll: q.soll }; }); });
    const specs = () => once('s32', () => {
      const F = C().fault, fx = FS.facts(B_.netz, B_.fid), rb = rowB(), uaus = rb.find(x => x.p === 'u_aus'), ufb = rb.find(x => x.p === 'u_fb');
      const cause = ['r1-offen', 'r2-offen', 'gate-offen', 'rueckkopplung-offen'];
      const causeOpts = cause.map(id => {
        const st = F.make(id, { netz: B_.netz }), qa = F.probe(st, 'u_aus'), qf = F.probe(st, 'u_fb'), cat = F.catalog.find(c => c.id === id);
        const grund = id === B_.fid
          ? 'Gemessen sind U_aus = ' + uaus.ist + ' (Soll ' + uaus.soll + ') bei U_fb = ' + ufb.ist + ': ' + cat.ursache
          : 'Bei „' + cat.name + '“ wären U_aus = ' + qa.text + ' und U_fb = ' + qf.text + ' zu erwarten, gemessen sind aber U_aus = ' + uaus.ist + ' und U_fb = ' + ufb.ist + '.';
        return { value: id, label: cat.name, grund };
      });
      const partOpts = F.parts(B_.netz).filter(p => ['r1', 'r2', 'fb_leitung', 'treiber', 'drossel'].indexOf(p.id) >= 0).map(p => {
        const rep = F.repair(fx.st, p.id), after = F.probe(rep.state, 'u_aus');
        const grund = p.id === fx.bt ? 'Dieses Bauteil ist defekt; nach dem Tausch zeigt U_aus wieder den Sollwert ' + after.text + ' statt ' + uaus.ist + '.'
          : 'Dieses Bauteil war nicht defekt: Nach dem Tausch bleibt U_aus bei ' + after.text + ' (Soll ' + uaus.soll + '), der Fehler bleibt.';
        return { value: p.id, label: p.name, grund };
      });
      return [
        { key: 'ursache', right: B_.fid, q: 'Der Tiefsetzsteller des Kollegen (Messtabelle) liefert nur ' + uaus.ist + ' statt ' + uaus.soll + '. Welche Ursache passt zu den Messwerten?', short: 'Die Ursache am Tiefsetzsteller ist richtig benannt', options: causeOpts },
        { key: 'bauteil', right: fx.bt, q: 'Welches Bauteil stellt die Referenz (Sollwerte der Messtabelle) wieder her?', short: 'Das Bauteil, das die Referenz herstellt, ist richtig gewählt', options: partOpts }];
    });
    const vals = () => once('v32', () => {
      const fx = FS.facts(A_.netz, A_.fid), F = C().fault, qa = p => F.probe(fx.st, p), rb = rowB(), uaus = rb.find(x => x.p === 'u_aus'), ufb = rb.find(x => x.p === 'u_fb');
      return { bruIst: qa('brumm_c').value * 1000, bruSoll: qa('brumm_c').soll * 1000, ucIst: qa('u_c').value, ucSoll: qa('u_c').soll, usek: qa('u_sek').value, usekSoll: qa('u_sek').soll, uausB: uaus.uist, uausBsoll: uaus.usoll, ufbB: ufb.uist };
    });
    const check = mk((r, a) => { FS.searchRows(r, a, A_); choiceRows(r, a, specs()); });
    const STARTC = { netz: A_.netz, fehler: A_.fid };
    const SOLCL = ['sicht', 'messe:u_sek', 'messe:u_c', 'messe:brumm_c', 'tausche:gleichrichter'];
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein Kollege bringt dir zwei Netzteile zur Fehlersuche (Simulation, Übungsschaltungen, nur Kleinspannung und Gleichspannungskreis, keine Messung am Netz). Teil 1: Das Linearnetzteil ist im Prüfstand aufgebaut und brummt. Mache die Sichtprüfung, miss in der empfohlenen Reihenfolge, gib die Ursache als Diagnose ab und tausche erst danach das defekte Bauteil. Teil 2: Für den Tiefsetzsteller liegt nur die Messtabelle vor. Benenne die Ursache und wähle das Bauteil, das die Referenz wieder herstellt. Das Lab ersetzt keine Unterweisung; Arbeiten an Netzspannung nur durch Elektrofachkraft oder unterwiesene Person.',
      table: () => ({ caption: 'Messtabelle Tiefsetzsteller des Kollegen (Soll aus dem Kern)', head: ['Messpunkt', 'Ist', 'Soll'], rows: rowB().map(x => [x.name, x.ist, x.soll]) }),
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Teil 1: Das Symptom ist Brummen, also schaut man auf den Zwischenkreis am Ladekondensator: Wie groß ist die Brummspannung gegenüber dem Soll? Teil 2: Vergleiche in der Tabelle Ist und Soll, besonders die Ausgangsspannung und die Spannung am Rückkopplungseingang; jede Ursache verschiebt andere Werte.',
        'Teil 1: Die Brummspannung am Ladekondensator ist ' + f(v.bruIst, 0) + ' mV statt ' + f(v.bruSoll, 0) + ' mV, die Sekundärspannung stimmt mit ' + f(v.usek, 2) + ' V (Soll ' + f(v.usekSoll, 2) + ' V). Teil 2: Die Ausgangsspannung liegt bei ' + f(v.uausB, 2) + ' V statt ' + f(v.uausBsoll, 0) + ' V, der Rückkopplungseingang meldet ' + f(v.ufbB, 2) + ' V.',
        'Musterlösung Teil 1: Sichtprüfung, u_sek, u_c, brumm_c messen; die Brummspannung ist doppelt so groß wie im Soll (Gleichrichter-Diode offen, die Brücke arbeitet nur noch als Einweggleichrichter), getauscht wird der Brückengleichrichter. Teil 2: R1 ist offen, die Rückkopplung regelt auf ' + f(v.ufbB, 2) + ' V; getauscht wird der Teilerwiderstand R1.'
      ]; },
      start: () => A('fehler', STARTC, { choices: {} }),
      sol: () => A('fehler', Object.assign({ diagnose: A_.fid }, STARTC), { clicks: SOLCL.slice(), diagnose: A_.fid, choices: rightOf(specs()) }),
      wrong: () => [
        { name: 'Teil 1 richtig, Teil 2 nicht bearbeitet (nur ein Fehler)', answer: A('fehler', Object.assign({ diagnose: A_.fid }, STARTC), { clicks: SOLCL.slice(), diagnose: A_.fid, choices: {} }) },
        { name: 'falsches Bauteil getauscht, Teil 2 falsch', answer: A('fehler', Object.assign({ diagnose: 'c-ausgetrocknet' }, STARTC), { clicks: ['sicht', 'messe:u_aus', 'tausche:ladeelko'], diagnose: 'c-ausgetrocknet', choices: { ursache: 'r2-offen', bauteil: 'drossel' } }) },
        { name: 'Teil 1 ohne Messung, Teil 2 richtig', answer: A('fehler', Object.assign({ diagnose: A_.fid }, STARTC), { clicks: ['tausche:gleichrichter'], diagnose: A_.fid, choices: rightOf(specs()) }) }] };
  })();

  /* ====================================================================== Registrierung */
  const tasks = [
    tk({ id: 'nt17', lab: 'nts', cat: 'Prüfungsnah', title: 'Strombegrenzung dimensionieren (Pool W2024-23)', level: 3, rig: 'stabil' }, M17),
    tk({ id: 'nt18', lab: 'nts', cat: 'Prüfungsnah', title: 'Linear oder getaktet? (Pool W2023-09)', level: 2, rig: 'buck' }, M18),
    tk({ id: 'nt19', lab: 'nts', cat: 'Prüfungsnah', title: 'Welche Topologie? (Pool W2023-08, W2024-09)', level: 2, rig: 'topo' }, M19),
    tk({ id: 'nt20', lab: 'nts', cat: 'Schaltregler', title: 'Tastverhältnis des Tiefsetzstellers', level: 1, rig: 'buck' }, M20),
    tk({ id: 'nt21', lab: 'nts', cat: 'Schaltregler', title: 'Drosselstrom-Welligkeit berechnen', level: 3, rig: 'buck' }, M21),
    tk({ id: 'nt22', lab: 'nts', cat: 'Schaltregler', title: 'Lückenden Betrieb vermeiden', level: 3, rig: 'buck' }, M22),
    tk({ id: 'nt23', lab: 'nts', cat: 'Schaltregler', title: 'Schaltfrequenz einstellen', level: 3, rig: 'buck' }, M23),
    tk({ id: 'nt24', lab: 'nts', cat: 'Schaltregler', title: 'Wirkungsgrad des Schaltreglers', level: 3, rig: 'buck' }, M24),
    tk({ id: 'nt25', lab: 'nts', cat: 'Schaltregler', title: 'Hochsetzsteller auslegen', level: 3, rig: 'topo' }, M25),
    tk({ id: 'nt26', lab: 'nts', cat: 'Schaltregler', title: 'Inverswandler: negative Spannung', level: 2, rig: 'topo' }, M26),
    tk({ id: 'nt27', lab: 'nts', cat: 'Gate', title: 'Gate-Widerstand wählen', level: 3, rig: 'gate' }, M27),
    tk({ id: 'nt28', lab: 'nts', cat: 'Prüfungsnah', title: 'Rückkopplungsteiler berechnen (Pool W2023-07)', level: 2, rig: 'regel' }, M28),
    tk({ id: 'nt29', lab: 'nts', cat: 'Regelkreis', title: 'Labornetzteil: CV oder CC?', level: 2, rig: 'regel' }, M29),
    tk({ id: 'nt30', lab: 'nts', cat: 'Regelkreis', title: 'Labornetzteil einstellen', level: 3, rig: 'regel' }, M30),
    tk({ id: 'nt31', lab: 'nts', cat: 'Fehlersuche', title: 'Netzteil repariert? (Fehlersuche)', level: 3, rig: 'fehler' }, M31),
    tk({ id: 'nt32', lab: 'nts', cat: 'Fehlersuche', title: 'Meisterstück: Das Netzteil des Kollegen', level: 3, rig: 'fehler' }, M32)
  ];
  const MODS = { nt17: M17, nt18: M18, nt19: M19, nt20: M20, nt21: M21, nt22: M22, nt23: M23, nt24: M24, nt25: M25, nt26: M26, nt27: M27, nt28: M28, nt29: M29, nt30: M30, nt31: M31, nt32: M32 };
  /* Musterwerte der Aufgaben (Schwellen aus den Musterloesungen, SPEC 8: Schwellwerte aus der Musterloesung) */
  T.thresholds2 = function () { const o = {}; Object.keys(MODS).forEach(k => { try { o[k] = MODS[k].vals(); } catch (e) { o[k] = { error: String(e && e.message || e) }; } }); return o; };
  T.register(tasks);
  if (typeof module !== 'undefined') module.exports = { tasks };
})(typeof window !== 'undefined' ? window : globalThis);
