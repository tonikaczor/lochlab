/* ntstasks2.js - NTS-Lab (Netzteile und Schaltregler): Aufgaben nt17 bis nt32 mit automatischer Pruefung (Rechnung, Simulation und Fehlersuche, ohne Browser lauffaehig) (WP4b)
 * Registrierung: NTS_TASKS.register([ ... ]) (NTS_TASKS kommt aus ntsdata.js; ntsdata.js VOR dieser Datei laden, in Node holt sich die Datei es per require).
 * Format wie SPEC 8 / wsltasks2.js: { id:'ntN', lab:'nts', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(),
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
  const RIGFILES = ['./ntsrig-base.js', './ntsrig-trafo.js', './ntsrig-gleich.js', './ntsrig-stabil.js', './ntsrig-buck.js', './ntsrig-topo.js', './ntsrig-gate.js', './ntsrig-regel.js', './ntsrig-fehler.js'];
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
  /* D4: nur im Duell (laufende Duell-Aufgabe id) wird die Reihenfolge der Antwortoptionen aus dem Runden-Code gedreht, damit die Position nichts verraet; Normalmodus unveraendert */
  const duelMix = (list, id) => { let d = 0; try { d = root.Duell && typeof root.Duell.seedFor === 'function' ? root.Duell.seedFor(id) : 0; } catch (e) { d = 0; } if (!(d > 0)) return list; return list.map((c, i) => { const o = c.options.slice(), k = (d + i * 7) % (o.length || 1); return Object.assign({}, c, { options: o.slice(k).concat(o.slice(0, k)) }); }); };
  const choiceAudit = specs => specs.map(s => ({ key: s.key, right: s.right, options: s.options.map(o => ({ value: o.value, label: o.label, grund: o.grund, richtig: o.value === s.right })) }));

  /* Aufgabenobjekt aus einem Modul M bauen (ELS-Muster): text, hint, table, fields, choices erst beim ersten Zugriff rechnen */
  function tk(head, M) {
    const o = Object.assign({}, head);
    const lazy = (k, fn) => { Object.defineProperty(o, k, { enumerable: true, configurable: true, get() { const v = fn(); Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true }); return v; } }); };
    lazy('text', () => M.text());
    lazy('hint', () => M.hint());
    if (M.table) lazy('table', () => M.table());
    if (M.fields) lazy('fields', () => M.fields());
    if (M.choices && M.duelMix) { let base = null; Object.defineProperty(o, 'choices', { enumerable: true, configurable: true, get() { if (base === null) base = M.choices(); return duelMix(base, head.id); } }); } /* D4: Reihenfolge nur im Duell gedreht */
    else if (M.choices) lazy('choices', () => M.choices());
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
      choices: () => publicChoices(specs()), duelMix: true,
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

  /* ====================================================================== nt33 bis nt38: Anbindung an den Berufsschulstoff (Spannungsstabilisierung: Quer- und Laengsstabilisierung, Z-Diode, Regelschaltung)
   * Alle Zahlen stammen aus dem Kern (NTS_CORE.zener, NTS_CORE.lin, NTS_CORE.limit); Bauteilwerte und Grenzen sind Aufgabenwerte (Uebungsschaltung, Datenblatt massgeblich).
   * Auswahlaufgaben nutzen den Baustein pick(): Fachgrund je Antwort, richtige Antwort nicht systematisch die laengste, Position gestreut. */
  function pick(o) {
    const wrongSet = k => { const c = {}; o.specs().forEach(s => { const w = s.options.filter(x => x.value !== s.right); c[s.key] = w[k % w.length].value; }); return c; };
    return { vals: o.vals, consts: [], audit: () => choiceAudit(o.specs()), check: mk((r, a) => { choiceRows(r, a, o.specs()); }),
      text: o.text, hint: o.hint, choices: () => publicChoices(o.specs()),
      start: () => A(o.rig, o.ctl(), { choices: {} }), sol: () => A(o.rig, o.ctl(), { choices: rightOf(o.specs()) }),
      wrong: () => [{ name: 'durchgehend die erste falsche Antwort', answer: A(o.rig, {}, { choices: wrongSet(0) }) }, { name: 'durchgehend die zweite falsche Antwort', answer: A(o.rig, {}, { choices: wrongSet(1) }) }] };
  }
  const mAf = x => f(x, 2) + ' mA';
  const zst = cfg => { const s = C().zener.stage(cfg); if (!s || !s.ok) throw new Error('zener.stage'); return s; };
  const rot = (specs, ks) => specs.map((sp, i) => { const k = (ks[i] || 0) % sp.options.length; return Object.assign({}, sp, { options: sp.options.slice(k).concat(sp.options.slice(0, k)) }); });
  const rname = id => { const R = rigs(id), d = R && R.defs && R.defs[id]; return d ? d.name : id; };

  /* ====================================================================== nt33: Querstabilisierung und Laengsstabilisierung (Lernfeld 9.2, Prinzip der Spannungsstabilisierung) */ /* PRUEFEN P1: Begriffe Quer-, Parallel- und Längsstabilisierung wie im Unterricht; das Wort "Längsregler" ist im Lab-Glossar reserviert und kommt in Aufgabentexten nicht vor */
  const M33 = (() => {
    const G = { ue: 14, ue2: 17, uz: 6.8, rv: 220, rl1: 680, rl2: 3300, uaus: 5, i1: 0.1, i2: 0.02 };
    const CTL = () => ({ art: 'zener', ue: G.ue, uz: G.uz, rv: G.rv, rlast: G.rl1, kurz: false });
    const vals = () => once('v33', () => { const a = zst({ Ue: G.ue, Uz: G.uz, Rv: G.rv, Rlast: G.rl1 }), b = zst({ Ue: G.ue, Uz: G.uz, Rv: G.rv, Rlast: G.rl2 }), c = zst({ Ue: G.ue2, Uz: G.uz, Rv: G.rv, Rlast: G.rl1 }), iq = lv('iq_7805');
      return { ue: G.ue, ue2: G.ue2, uz: G.uz, rv: G.rv, rl1: G.rl1, rl2: G.rl2, iges: a.Iges * 1e3, iz1: a.Iz * 1e3, iz2: b.Iz * 1e3, iz3: c.Iz * 1e3, iges3: c.Iges * 1e3, il1: a.Ilast * 1e3, il2: b.Ilast * 1e3,
        uaus: G.uaus, p1: C().lin.loss(G.ue, G.uaus, G.i1), p2: C().lin.loss(G.ue2, G.uaus, G.i1), i1: G.i1 * 1e3, i2: G.i2 * 1e3, iq: iq * 1e3, iein1: (G.i1 + iq) * 1e3, iein2: (G.i2 + iq) * 1e3, uzRv: G.uz / G.rv * 1e3, ueRv: G.ue / G.rv * 1e3 }; });
    const rIges = () => once('r33', () => { const v = vals(); return own(v.iges / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: v.uzRv / 1e3, text: 'Du hast U_Z / R_V gerechnet (' + mAf(v.uzRv) + '). Am Vorwiderstand liegt nur die Differenz U_E − U_Z, daher I_ges = (U_E − U_Z) / R_V.' }, { v: v.ueRv / 1e3, text: 'Du hast U_E / R_V gerechnet (' + mAf(v.ueRv) + '). Am Vorwiderstand liegt nur U_E − U_Z, nicht die ganze Eingangsspannung.' }] }); });
    const specs0 = () => once('sp33', () => { const v = vals(); return [
      { key: 'zuordnung', q: 'Zwei Schaltungen stabilisieren eine Spannung: die Z-Diode mit Vorwiderstand und der Festspannungsregler 7805. Welche Zuordnung stimmt?', short: 'Die Zuordnung von Quer- und Längsstabilisierung ist richtig', right: 'zl',
        options: [
          { value: 'zz', label: 'Beide arbeiten mit einem Stellglied parallel zur Last', grund: 'Der 7805 liegt mit seiner Regelstrecke zwischen Eingang und Ausgang, in Reihe zur Last. Nur die Z-Diode liegt parallel zur Last.' },
          { value: 'lz', label: 'Z-Diode: Längs (in Reihe), 7805: Quer (parallel)', grund: 'Genau umgekehrt: Die Z-Diode liegt parallel zur Last (Querstabilisierung), der 7805 liegt in Reihe zur Last (Längsstabilisierung).' },
          { value: 'zl', label: 'Z-Diode: Quer (parallel), 7805: Längs (in Reihe)', grund: 'Die Z-Diode liegt als spannungsregelndes Bauelement parallel zur Last (Parallel- oder Querstabilisierung). Der 7805 liegt mit seinem Stellglied in Reihe zur Last (Längsstabilisierung).' },
          { value: 'll', label: 'Beide arbeiten mit einem Stellglied in Reihe zur Last', grund: 'Bei der Z-Diode fließt der Strom über den Vorwiderstand (in Reihe), die regelnde Z-Diode selbst liegt aber parallel zur Last. Das macht sie zur Querstabilisierung.' }] },
      { key: 'eingang', q: 'Die Eingangsspannung steigt (Z-Stufe: ' + f(v.ue, 0) + ' V auf ' + f(v.ue2, 0) + ' V; 7805 bei ' + f(v.i1, 0) + ' mA Last: ebenfalls ' + f(v.ue, 0) + ' V auf ' + f(v.ue2, 0) + ' V). Wie muss sich das Stellglied ändern, damit der Ausgang konstant bleibt?', short: 'Die Änderung des Stellglieds bei steigender Eingangsspannung ist richtig bestimmt', right: 'qlh',
        options: [
          { value: 'beide-klein', label: 'Bei beiden wird das Stellglied niederohmiger', grund: 'Beim 7805 liegt das Stellglied in Reihe: Es muss hochohmiger werden und mehr Spannung übernehmen (hier steigt die Verlustleistung von ' + f(v.p1, 2) + ' W auf ' + f(v.p2, 2) + ' W). Nur bei der Parallelstabilisierung wird es niederohmiger.' },
          { value: 'beide-gross', label: 'Bei beiden wird das Stellglied hochohmiger', grund: 'Bei der Z-Diode liegt das Stellglied parallel zur Last: Es muss mehr Strom aufnehmen, also niederohmiger werden (der Z-Strom steigt von ' + mAf(v.iz1) + ' auf ' + mAf(v.iz3) + '). Nur in der Längsstabilisierung wird es hochohmiger.' },
          { value: 'lqh', label: 'Quer: hochohmiger, Längs: niederohmiger', grund: 'Genau umgekehrt: Das parallele Stellglied (Z-Diode) wird bei steigender Eingangsspannung niederohmiger, das Stellglied in Reihe (7805) wird hochohmiger.' },
          { value: 'qlh', label: 'Quer: niederohmiger, Längs: hochohmiger', grund: 'Quer: Die Z-Diode nimmt mehr Strom auf (' + mAf(v.iz1) + ' auf ' + mAf(v.iz3) + '), ihr Wechselstromwiderstand sinkt. Längs: Der 7805 muss die größere Differenz übernehmen; sein Stellglied wird hochohmiger (P_V von ' + f(v.p1, 2) + ' W auf ' + f(v.p2, 2) + ' W).' }] },
      { key: 'last', q: 'Der Laststrom sinkt (Z-Stufe: R_L von ' + eng(v.rl1, 'Ω') + ' auf ' + eng(v.rl2, 'Ω') + '; 7805: Laststrom von ' + f(v.i1, 0) + ' mA auf ' + f(v.i2, 0) + ' mA). Was ändert sich am Strom aus der Quelle?', short: 'Die Wirkung des kleineren Laststroms auf den Quellenstrom ist richtig bestimmt', right: 'konst',
        options: [
          { value: 'beide-sinkt', label: 'Bei beiden sinkt der Strom aus der Quelle deutlich', grund: 'Bei der Z-Stufe bleibt der Gesamtstrom durch R_V gleich (' + mAf(v.iges) + '), weil die Z-Diode den Rest übernimmt (I_Z steigt von ' + mAf(v.iz1) + ' auf ' + mAf(v.iz2) + '). Nur der 7805 nimmt weniger Strom auf.' },
          { value: 'konst', label: 'Quer bleibt gleich (Z-Strom steigt), Längs sinkt', grund: 'Quer: I_ges = ' + mAf(v.iges) + ' bleibt, die Z-Diode nimmt den Rest auf (' + mAf(v.iz1) + ' auf ' + mAf(v.iz2) + '). Längs: Der Eingangsstrom folgt dem Laststrom und sinkt von ' + mAf(v.iein1) + ' auf ' + mAf(v.iein2) + ' (mit Ruhestrom ' + mAf(v.iq) + ').' },
          { value: 'umgekehrt', label: 'Quer sinkt mit dem Laststrom, Längs bleibt gleich', grund: 'Genau umgekehrt: Die Parallelstabilisierung nimmt immer denselben Strom auf (' + mAf(v.iges) + '), die Längsstabilisierung nur so viel, wie die Last und ihr Ruhestrom brauchen (' + mAf(v.iein2) + ' bei ' + f(v.i2, 0) + ' mA Last).' },
          { value: 'beide-gleich', label: 'Bei beiden bleibt der Strom aus der Quelle gleich', grund: 'Der 7805 gibt nur den Strom weiter, den die Last braucht (plus Ruhestrom): Er sinkt von ' + mAf(v.iein1) + ' auf ' + mAf(v.iein2) + '. Gleich bleibt er nur bei der Z-Stufe (' + mAf(v.iges) + ').' }] }]; });
    const specs = () => once('rot33', () => rot(specs0(), [0, 0, 1]));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'iges'), rIges(), 'Der Gesamtstrom I_ges durch den Vorwiderstand ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Z-Diode mit Vorwiderstand (U_Z = ' + f(G.uz, 1) + ' V, R_V = ' + eng(G.rv, 'Ω') + ', U_E = ' + f(G.ue, 0) + ' V, Übungsschaltung) und ein Festspannungsregler 7805 stabilisieren beide eine Ausgangsspannung. Berechne zuerst den Gesamtstrom I_ges durch den Vorwiderstand der Z-Stufe und beantworte dann drei Fragen zum Prinzip der Stabilisierung. Im Prüfstand „' + rname('stabil') + '“ kannst du beide Schaltungen aufbauen und Last und Eingangsspannung ändern.',
      fields: () => [{ key: 'iges', label: 'Gesamtstrom I_ges durch R_V', unit: 'mA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Bei der Querstabilisierung liegt das regelnde Bauelement parallel zur Last (Z-Diode): Der Strom durch den Vorwiderstand ist fast konstant, die Z-Diode nimmt den Teil auf, den die Last nicht braucht. Bei der Längsstabilisierung liegt das Stellglied in Reihe zur Last (7805): Es übernimmt die überschüssige Spannung.',
        'I_ges = (U_E − U_Z) / R_V = (' + f(v.ue, 0) + ' V − ' + f(v.uz, 1) + ' V) / ' + f(v.rv, 0) + ' Ω. Bei der Z-Stufe ändert sich I_ges nicht, wenn die Last sich ändert; nur die Aufteilung zwischen Last und Z-Diode ändert sich. Der 7805 nimmt nur Laststrom plus Ruhestrom auf.',
        'Musterlösung: I_ges = ' + f(v.iges, 2) + ' mA. Z-Diode: Querstabilisierung, 7805: Längsstabilisierung. Steigt U_E, wird das parallele Stellglied niederohmiger (I_Z von ' + f(v.iz1, 1) + ' mA auf ' + f(v.iz3, 1) + ' mA), das Stellglied in Reihe hochohmiger. Sinkt der Laststrom, bleibt bei der Z-Stufe I_ges = ' + f(v.iges, 2) + ' mA.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { iges: null }, choices: {} }),
      sol: () => A('stabil', CTL(), { fields: { iges: vals().iges }, choices: rightOf(specs()), value: vals().iges }),
      wrong: () => { const v = vals(); return [
        { name: 'U_Z statt U_E − U_Z, Quer und Längs vertauscht', answer: A('stabil', {}, { fields: { iges: v.uzRv }, choices: { zuordnung: 'lz', eingang: 'lqh', last: 'umgekehrt' } }) },
        { name: 'Ganze Eingangsspannung am Vorwiderstand, beide gleich behandelt', answer: A('stabil', {}, { fields: { iges: v.ueRv }, choices: { zuordnung: 'zz', eingang: 'beide-klein', last: 'beide-gleich' } }) }]; } };
  })();

  /* ====================================================================== nt34: Z-Diode bei schwankender Eingangsspannung (Lernfeld 9.2, Arbeitspunkt und Arbeitsbereich) */ /* PRUEFEN P2: P_max = 650 mW (Aufgabenwert), r_z = 10 Ω und I_Z,min = 5 mA sind Übungswerte des Labs, nicht die Werte einer bestimmten Z-Diode */
  const M34 = (() => {
    const G = { uz: 9.1, ue: 18, due: 3, rv: 150, pmax: 0.65, rv2: 200, rv3: 100 };
    const CTL = () => ({ art: 'zener', ue: G.ue, uz: G.uz, rv: G.rv, rlast: 47000, kurz: false });
    const S = (ue, rv) => once('z34|' + ue + '|' + rv, () => zst({ Ue: ue, Uz: G.uz, Rv: rv, Ilast: 0, Pmax: G.pmax }));
    const vals = () => once('v34', () => { const n = S(G.ue, G.rv), h = S(G.ue + G.due, G.rv), t = S(G.ue - G.due, G.rv), g = S(G.ue + G.due, G.rv2), k = S(G.ue + G.due, G.rv3), rg = C().zener.regulation({ dUe: G.due, Rv: G.rv });
      return { uz: G.uz, ue: G.ue, due: G.due, ueMax: G.ue + G.due, ueMin: G.ue - G.due, rv: G.rv, pmax: G.pmax * 1e3, rz: lv('rz'), izmin: lv('iz_min') * 1e3, iz0: n.Iz * 1e3, izMax: h.Iz * 1e3, izMin: t.Iz * 1e3, pzMax: h.Pz * 1e3, pz0: n.Pz * 1e3, dua: rg.dUa, rv2: G.rv2, pzG: g.Pz * 1e3, izG: g.Iz * 1e3, rv3: G.rv3, pzK: k.Pz * 1e3, izK: k.Iz * 1e3 }; });
    const rI0 = () => once('r34a', () => { const v = vals(); return own(v.iz0 / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: G.uz / G.rv, text: 'Du hast U_Z / R_V gerechnet (' + mAf(G.uz / G.rv * 1e3) + '). Am Vorwiderstand liegt U_E − U_Z, und im Leerlauf fließt dieser Strom ganz durch die Z-Diode.' }, { v: G.ue / G.rv, text: 'Du hast U_E / R_V gerechnet. Am Vorwiderstand liegt nur die Differenz U_E − U_Z.' }] }); });
    const rIm = () => once('r34b', () => { const v = vals(); return own(v.izMax / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: v.iz0 / 1e3, text: 'Dein Wert gehört zur Nenn-Eingangsspannung ' + f(G.ue, 0) + ' V. Gefragt ist der Strom bei der höchsten Eingangsspannung ' + f(v.ueMax, 0) + ' V.' }, { v: v.izMin / 1e3, text: 'Dein Wert gehört zur niedrigsten Eingangsspannung ' + f(v.ueMin, 0) + ' V. Gefragt ist die höchste (' + f(v.ueMax, 0) + ' V).' }] }); });
    const rPm = () => once('r34c', () => { const v = vals(); return own(v.pzMax / 1e3, 'W', { factor: 1e-3, wrongs: [{ v: v.pz0 / 1e3, text: 'Dein Wert (' + f(v.pz0, 0) + ' mW) gehört zur Nenn-Eingangsspannung. Bei ' + f(v.ueMax, 0) + ' V ist der Z-Strom größer und damit auch P_Z = U_Z · I_Z.' }, { v: G.ue * v.izMax / 1e3, text: 'Du hast mit der Eingangsspannung multipliziert. In der Z-Diode wird U_Z · I_Z umgesetzt, nicht U_E · I_Z.' }] }); });
    const rDu = () => once('r34d', () => { const v = vals(); return own(v.dua, 'V', { wrongs: [{ v: G.due, text: 'Du hast die ganze Eingangsänderung (' + f(G.due, 0) + ' V) übernommen. Die Z-Diode hält die Ausgangsspannung bis auf einen kleinen Rest konstant: ΔU_a = ΔU_E · r_z / (R_V + r_z).' }, { v: G.due * v.rz / G.rv, text: 'Du hast durch R_V geteilt, ohne r_z zu addieren. Der Teiler ist r_z / (R_V + r_z).' }] }); });
    const specs0 = () => once('sp34', () => { const v = vals(); return [
      { key: 'ueberlast', q: 'Die Z-Diode darf höchstens P_max = ' + f(v.pmax, 0) + ' mW umsetzen (Aufgabenwert). Wie ist die Stufe bei der höchsten Eingangsspannung ' + f(v.ueMax, 0) + ' V zu beurteilen?', short: 'Die Belastung der Z-Diode bei der höchsten Eingangsspannung ist richtig beurteilt', right: 'ja',
        options: [
          { value: 'nein', label: 'Zulässig, P_Z bleibt unter P_max', grund: 'Bei ' + f(v.ueMax, 0) + ' V ist I_Z = ' + mAf(v.izMax) + ' und P_Z = U_Z · I_Z = ' + f(v.pzMax, 0) + ' mW, das liegt über P_max = ' + f(v.pmax, 0) + ' mW. Zulässig wäre die Stufe nur bis zur Nenn-Eingangsspannung (P_Z = ' + f(v.pz0, 0) + ' mW).' },
          { value: 'ja', label: 'Überlastet, P_Z liegt über P_max', grund: 'Bei ' + f(v.ueMax, 0) + ' V fließen I_Z = ' + mAf(v.izMax) + ', und P_Z = ' + f(v.uz, 1) + ' V · ' + mAf(v.izMax) + ' = ' + f(v.pzMax, 0) + ' mW liegt über P_max = ' + f(v.pmax, 0) + ' mW (Überlast).' },
          { value: 'nenn', label: 'Überlastet schon bei Nenn-Eingangsspannung', grund: 'Bei der Nenn-Eingangsspannung ' + f(v.ue, 0) + ' V ist P_Z = ' + f(v.pz0, 0) + ' mW noch unter P_max = ' + f(v.pmax, 0) + ' mW. Zu hoch wird sie erst bei ' + f(v.ueMax, 0) + ' V (' + f(v.pzMax, 0) + ' mW).' },
          { value: 'min', label: 'Kritisch nur bei der niedrigsten Spannung', grund: 'Bei der niedrigsten Spannung ' + f(v.ueMin, 0) + ' V ist I_Z am kleinsten (' + mAf(v.izMin) + ') und P_Z am geringsten. Die größte Belastung entsteht bei der höchsten Eingangsspannung.' }] },
      { key: 'abhilfe', q: 'Welche Änderung allein senkt die Belastung der Z-Diode bei ' + f(v.ueMax, 0) + ' V unter P_max?', short: 'Die Abhilfe gegen die Überlast ist richtig gewählt', right: 'gross',
        options: [
          { value: 'klein', label: 'Den Vorwiderstand verkleinern', grund: 'Ein kleinerer Vorwiderstand erhöht den Strom: Mit R_V = ' + eng(v.rv3, 'Ω') + ' wären es I_Z = ' + mAf(v.izK) + ' und P_Z = ' + f(v.pzK, 0) + ' mW, noch mehr als vorher.' },
          { value: 'nichts', label: 'Nichts ändern, die Z-Diode regelt das selbst', grund: 'Die Z-Diode hält die Spannung konstant, begrenzt ihren Strom aber nicht: Er wird nur durch R_V bestimmt. Bei ' + f(v.ueMax, 0) + ' V sind es ' + mAf(v.izMax) + ' (P_Z = ' + f(v.pzMax, 0) + ' mW).' },
          { value: 'gross', label: 'Den Vorwiderstand vergrößern', grund: 'Ein größerer Vorwiderstand senkt den Strom: Mit R_V = ' + eng(v.rv2, 'Ω') + ' fließen bei ' + f(v.ueMax, 0) + ' V nur I_Z = ' + mAf(v.izG) + ', und P_Z = ' + f(v.pzG, 0) + ' mW liegt unter P_max = ' + f(v.pmax, 0) + ' mW.' }] }]; });
    const specs = () => once('rot34', () => rot(specs0(), [3, 2]));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'iz0'), rI0(), 'Der Z-Strom bei U_E = ' + f(G.ue, 0) + ' V (Leerlauf) ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'izmax'), rIm(), 'Der Z-Strom bei der höchsten Eingangsspannung ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'pzmax'), rPm(), 'Die Verlustleistung der Z-Diode bei der höchsten Eingangsspannung ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'dua'), rDu(), 'Die Änderung der Ausgangsspannung bei ΔU_E = +' + f(G.due, 0) + ' V ist richtig berechnet', 3);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Z-Diode mit U_Z = ' + f(G.uz, 1) + ' V wird aus U_E = ' + f(G.ue, 0) + ' V über R_V = ' + eng(G.rv, 'Ω') + ' gespeist; die Eingangsspannung schwankt um ΔU_E = ±' + f(G.due, 0) + ' V (Übungsschaltung, Last abgeklemmt, dynamischer Widerstand r_z = ' + eng(lv('rz'), 'Ω') + ' als Übungswert). Berechne den Z-Strom bei der Nenn-Eingangsspannung und bei der höchsten Eingangsspannung, die Verlustleistung der Z-Diode bei der höchsten Eingangsspannung und die Änderung der Ausgangsspannung bei +' + f(G.due, 0) + ' V. Beurteile dann die Belastung. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) kannst du die Eingangsspannung verstellen.',
      fields: () => [{ key: 'iz0', label: 'Z-Strom bei Nenn-Eingangsspannung', unit: 'mA' }, { key: 'izmax', label: 'Z-Strom bei der höchsten Eingangsspannung', unit: 'mA' }, { key: 'pzmax', label: 'Verlustleistung P_Z bei der höchsten Eingangsspannung', unit: 'mW' }, { key: 'dua', label: 'Änderung ΔU_a bei ΔU_E = +' + f(G.due, 0) + ' V', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Ohne Last fließt der ganze Strom durch die Z-Diode: I_Z = (U_E − U_Z) / R_V. Die Verlustleistung der Z-Diode ist P_Z = U_Z · I_Z. Die Ausgangsspannung ändert sich nur wenig: ΔU_a = ΔU_E · r_z / (R_V + r_z).',
        'Rechne bei der Nenn-Eingangsspannung ' + f(v.ue, 0) + ' V und bei der höchsten ' + f(v.ueMax, 0) + ' V (U_E + ΔU_E). Beispiel: I_Z = (' + f(v.ueMax, 0) + ' V − ' + f(v.uz, 1) + ' V) / ' + f(v.rv, 0) + ' Ω. Der Teiler für ΔU_a ist ' + f(v.rz, 0) + ' Ω / (' + f(v.rv, 0) + ' Ω + ' + f(v.rz, 0) + ' Ω).',
        'Musterlösung: I_Z = ' + f(v.iz0, 2) + ' mA bei ' + f(v.ue, 0) + ' V und ' + f(v.izMax, 2) + ' mA bei ' + f(v.ueMax, 0) + ' V, P_Z = ' + f(v.pzMax, 0) + ' mW (über P_max = ' + f(v.pmax, 0) + ' mW: Überlast), ΔU_a = ' + f(v.dua, 4) + ' V. Mit R_V = ' + f(v.rv2, 0) + ' Ω wäre P_Z nur ' + f(v.pzG, 0) + ' mW.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { iz0: null, izmax: null, pzmax: null, dua: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', Object.assign(CTL(), { ue: v.ueMax }), { fields: { iz0: v.iz0, izmax: v.izMax, pzmax: v.pzMax, dua: v.dua }, choices: rightOf(specs()), value: v.izMax }); },
      wrong: () => { const v = vals(); return [
        { name: 'U_Z / R_V und Nennwerte statt der Höchstwerte', answer: A('stabil', {}, { fields: { iz0: v.uz / v.rv * 1e3, izmax: v.iz0, pzmax: v.pz0, dua: v.due }, choices: { ueberlast: 'nein', abhilfe: 'klein' } }) },
        { name: 'Niedrigste Spannung verwendet, Teiler ohne r_z', answer: A('stabil', {}, { fields: { iz0: v.iz0, izmax: v.izMin, pzmax: v.ue * v.izMax / 1e3, dua: v.due * v.rz / v.rv }, choices: { ueberlast: 'min', abhilfe: 'nichts' } }) }]; } };
  })();

  /* ====================================================================== nt35: Vorwiderstand fuer den gewuenschten Z-Strom (Lernfeld 9.2, Dimensionierung der Z-Diode-Schaltung) */ /* PRUEFEN P3: Normbelastbarkeiten 0,125 / 0,25 / 0,5 / 1 W für Widerstände; die E-Reihe wird nicht verlangt (R_V wird auf Ω genau gerechnet) */
  const M35 = (() => {
    const G = { ue: 12, uz: 5.6, rl: 470, iz: 0.01 };
    const CTL = () => ({ art: 'zener', ue: G.ue, uz: G.uz, rv: 270, rlast: G.rl, kurz: false });
    const vals = () => once('v35', () => { const il = G.uz / G.rl, ig = il + G.iz, rv = (G.ue - G.uz) / ig, s = zst({ Ue: G.ue, Uz: G.uz, Rv: rv, Rlast: G.rl }), l = zst({ Ue: G.ue, Uz: G.uz, Rv: rv, Ilast: 0 });
      return { ue: G.ue, uz: G.uz, rl: G.rl, iz: G.iz * 1e3, il: il * 1e3, ig: ig * 1e3, rv, rvK: rv, prv: s.Pr * 1e3, pz: s.Pz * 1e3, pzLeer: l.Pz * 1e3, izProbe: s.Iz * 1e3, ohneLast: (G.ue - G.uz) / G.iz, mitUe: G.ue / ig, mitUz: G.uz / ig, izmin: lv('iz_min') * 1e3 }; });
    const rRv = () => once('r35a', () => { const v = vals(); return own(v.rv, 'Ω', { wrongs: [{ v: v.ohneLast, text: 'Dein Wert (' + f(v.ohneLast, 0) + ' Ω) rechnet nur mit dem Z-Strom ' + f(v.iz, 0) + ' mA. Durch R_V fließen aber Z-Strom und Laststrom zusammen (' + mAf(v.ig) + ').' }, { v: v.mitUe, text: 'Du hast U_E / I_ges gerechnet. Am Vorwiderstand liegt nur U_E − U_Z.' }, { v: v.mitUz, text: 'Du hast U_Z / I_ges gerechnet. Am Vorwiderstand liegt die Differenz U_E − U_Z, nicht die Z-Spannung.' }] }); });
    const rPz = () => once('r35b', () => { const v = vals(); return own(v.pzLeer / 1e3, 'W', { factor: 1e-3, wrongs: [{ v: v.pz / 1e3, text: 'Dein Wert (' + f(v.pz, 0) + ' mW) gehört zur angeschlossenen Last. Ohne Last fließt der ganze Strom (' + mAf(v.ig) + ') durch die Z-Diode.' }] }); });
    const OPTS = ['0,125 W', '0,25 W', '0,5 W', '1 W'];
    const specs = () => once('sp35', () => { const v = vals(), p = v.prv, need = x => x >= p / 1e3 - 1e-12;
      const g = (w, k) => { const nom = [0.125, 0.25, 0.5, 1][k]; return nom === 0.25 ? 'R_V setzt P = (U_E − U_Z) · I_ges = ' + f(v.prv, 0) + ' mW um. ' + OPTS[1] + ' ist die kleinste Normbelastbarkeit, die das verträgt.' : nom < 0.25 ? 'R_V setzt P = (U_E − U_Z) · I_ges = ' + f(v.prv, 0) + ' mW um; ' + OPTS[0] + ' (125 mW) reichen dafür nicht.' : OPTS[k] + ' würden reichen, sind aber nicht die kleinste ausreichende Normbelastbarkeit: R_V setzt nur ' + f(v.prv, 0) + ' mW um.'; };
      return [{ key: 'prv', q: 'Welche kleinste Normbelastbarkeit (0,125 W, 0,25 W, 0,5 W, 1 W) muss der Vorwiderstand mindestens haben?', short: 'Die Belastbarkeit des Vorwiderstands ist richtig gewählt', right: '0,25',
        options: [{ value: '1', label: OPTS[3], grund: g(0, 3) }, { value: '0,25', label: OPTS[1], grund: g(0, 1) }, { value: '0,125', label: OPTS[0], grund: g(0, 0) }, { value: '0,5', label: OPTS[2], grund: g(0, 2) }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'rv'), rRv(), 'Der Vorwiderstand R_V ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'pz'), rPz(), 'Die Verlustleistung der Z-Diode ohne Last ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [0.25],
      text: () => 'Eine Z-Diode mit U_Z = ' + f(G.uz, 1) + ' V soll aus U_E = ' + f(G.ue, 0) + ' V eine Last mit R_L = ' + eng(G.rl, 'Ω') + ' versorgen (Übungsschaltung). Damit die Z-Diode sicher stabilisiert, soll im Betrieb ein Z-Strom von ' + f(G.iz * 1e3, 0) + ' mA fließen (Aufgabenwert). Berechne den Vorwiderstand R_V und die Verlustleistung der Z-Diode für den Fall, dass die Last abgeklemmt wird. Wähle dann die Belastbarkeit des Vorwiderstands. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) kannst du das Ergebnis nachstellen.',
      fields: () => [{ key: 'rv', label: 'Vorwiderstand R_V', unit: 'Ω' }, { key: 'pz', label: 'Verlustleistung P_Z ohne Last', unit: 'mW' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Durch den Vorwiderstand fließt der Strom für die Z-Diode und für die Last zusammen: I_ges = I_Z + I_L mit I_L = U_Z / R_L. Am Vorwiderstand liegt die Differenz U_E − U_Z, daher R_V = (U_E − U_Z) / I_ges. Ohne Last fließt I_ges ganz durch die Z-Diode.',
        'Laststrom I_L = ' + f(v.uz, 1) + ' V / ' + f(v.rl, 0) + ' Ω = ' + f(v.il, 2) + ' mA, dazu ' + f(v.iz, 0) + ' mA Z-Strom ergibt I_ges = ' + f(v.ig, 2) + ' mA. Die Leistung im Vorwiderstand ist (U_E − U_Z) · I_ges und bleibt auch ohne Last gleich.',
        'Musterlösung: R_V = (' + f(v.ue, 0) + ' V − ' + f(v.uz, 1) + ' V) / ' + f(v.ig, 2) + ' mA = ' + f(v.rv, 1) + ' Ω. Ohne Last gilt P_Z = ' + f(v.uz, 1) + ' V · ' + f(v.ig, 2) + ' mA = ' + f(v.pzLeer, 1) + ' mW; im Vorwiderstand werden ' + f(v.prv, 0) + ' mW umgesetzt, also 0,25 W.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { rv: null, pz: null }, choices: {} }),
      sol: () => A('stabil', Object.assign(CTL(), { rv: Math.round(vals().rv) }), { fields: { rv: vals().rv, pz: vals().pzLeer }, choices: rightOf(specs()), value: vals().rv }),
      wrong: () => { const v = vals(); return [
        { name: 'Laststrom vergessen (zu groß), zu kleine Belastbarkeit', answer: A('stabil', {}, { fields: { rv: v.ohneLast, pz: v.pz }, choices: { prv: '0,125' } }) },
        { name: 'U_E statt U_E − U_Z (zu groß), Leistung zu hoch gewählt', answer: A('stabil', {}, { fields: { rv: v.mitUe, pz: v.pz }, choices: { prv: '1' } }) }]; } };
  })();

  /* ====================================================================== nt36: Zener- und Lawinendurchbruch (Lernfeld 9.2, Z-Diode: Durchbruch und Temperaturverhalten) */ /* PRUEFEN P4: Grenze Zener/Lawine: Mitschrift nennt etwa 5 V, das Lab sagt bis etwa 5 V Zener, ab etwa 7 V Lawine, dazwischen gemischt; temperaturstabile Referenz bei etwa 5 bis 6 V */
  const M36 = (() => {
    const CTL = () => ({ art: 'zener', ue: 12, uz: 5.1, rv: 470, rlast: 4700, kurz: false });
    const vals = () => once('v36', () => ({ u1: 3.3, u2: 12, g1: 5, g2: 7, g3: 6, ref: 5.6 }));
    const specs0 = () => once('sp36', () => { const v = vals(); return [
      { key: 'klein', q: 'Eine Z-Diode hat U_Z = ' + f(v.u1, 1) + ' V. Welcher Durchbruch bestimmt vor allem ihr Verhalten?', short: 'Der Durchbruch bei kleiner Z-Spannung ist richtig benannt', right: 'zener',
        options: [
          { value: 'lawine', label: 'Lawineneffekt (Stoßionisation)', grund: 'Der Lawineneffekt ist maßgeblich bei größeren Z-Spannungen (ab etwa ' + f(v.g2, 0) + ' V). Bei ' + f(v.u1, 1) + ' V reißt das starke Feld die Valenzelektronen direkt aus ihren Bindungen.' },
          { value: 'zener', label: 'Zener-Effekt (Felddurchbruch)', grund: 'Bei kleinen Z-Spannungen (bis etwa ' + f(v.g1, 0) + ' V) reißt das starke elektrische Feld in der dünnen Sperrschicht Valenzelektronen aus ihren Bindungen: Es entstehen freie Ladungsträger, die Diode wird leitend.' },
          { value: 'therm', label: 'Thermischer Durchbruch durch Erwärmung', grund: 'Ein thermischer Durchbruch zerstört das Bauteil und ist kein Betriebseffekt. Der Durchbruch einer Z-Diode ist umkehrbar und wird durch Feld oder Stoßionisation verursacht.' },
          { value: 'kein', label: 'Kein Durchbruch, sie sperrt wie eine Diode', grund: 'Eine Z-Diode wird gerade in Sperrrichtung betrieben: Bei der Z-Spannung bricht sie durch und leitet. Das ist ihre Aufgabe, der Strom wird dabei durch den Vorwiderstand begrenzt.' }] },
      { key: 'gross', q: 'Eine Z-Diode hat U_Z = ' + f(v.u2, 0) + ' V. Welcher Durchbruch bestimmt vor allem ihr Verhalten?', short: 'Der Durchbruch bei großer Z-Spannung ist richtig benannt', right: 'lawine',
        options: [
          { value: 'zener', label: 'Zener-Effekt (Felddurchbruch)', grund: 'Der Zener-Effekt bestimmt die Dioden mit kleiner Z-Spannung (bis etwa ' + f(v.g1, 0) + ' V). Bei ' + f(v.u2, 0) + ' V werden die Ladungsträger zuerst stark beschleunigt und lösen weitere aus.' },
          { value: 'kein', label: 'Kein Durchbruch, sie sperrt wie eine Diode', grund: 'Die Z-Diode wird in Sperrrichtung betrieben und bricht bei ihrer Z-Spannung durch. Das ist die gewollte Betriebsart, der Strom bleibt durch den Vorwiderstand begrenzt.' },
          { value: 'lawine', label: 'Lawineneffekt (Stoßionisation)', grund: 'Bei höheren Z-Spannungen (ab etwa ' + f(v.g2, 0) + ' V) beschleunigt das Feld die vorhandenen Ladungsträger so stark, dass sie weitere durch Stoßionisation freisetzen: eine Ladungsträgerlawine entsteht.' },
          { value: 'therm', label: 'Thermischer Durchbruch durch Erwärmung', grund: 'Thermisch bricht ein Bauteil nur durch Überlast, ohne Rückkehr. Der Durchbruch der Z-Diode ist umkehrbar und kommt vom Feld.' }] },
      { key: 'temp', q: 'Die Temperatur steigt. Wie ändert sich die Z-Spannung einer Z-Diode mit U_Z = ' + f(v.u1, 1) + ' V (Zener-Effekt)?', short: 'Der Temperaturgang der kleinen Z-Spannung ist richtig beschrieben', right: 'sinkt',
        options: [
          { value: 'steigt', label: 'Die Z-Spannung steigt, ähnlich einem PTC-Widerstand', grund: 'Beim Zener-Effekt sinkt die nötige Sperrspannung mit der Temperatur, weil mehr Ladungsträgerpaare entstehen (Verhalten wie ein NTC). Eine steigende Z-Spannung gehört zum Lawineneffekt.' },
          { value: 'sinkt', label: 'Die Z-Spannung sinkt, ähnlich einem NTC-Widerstand', grund: 'Bei höherer Temperatur entstehen leichter Ladungsträgerpaare; das Feld muss weniger stark sein, die Z-Spannung sinkt (Temperaturkoeffizient negativ, Deutung als NTC).' },
          { value: 'gleich', label: 'Die Z-Spannung bleibt immer gleich, Temperatur ohne Einfluss', grund: 'Die Z-Spannung hängt von der Temperatur ab: Bei kleinen Z-Spannungen (Zener-Effekt) sinkt sie, bei großen (Lawineneffekt) steigt sie.' },
          { value: 'null', label: 'Die Z-Spannung fällt auf null, die Diode wird zum Kurzschluss', grund: 'Der Temperaturgang ist klein und stetig, die Diode wird nicht zum Kurzschluss. Bei Zener-Dioden sinkt die Z-Spannung nur etwas.' }] },
      { key: 'ref', q: 'Welche Z-Spannung eignet sich als besonders temperaturstabile Referenz?', short: 'Die temperaturstabile Z-Spannung ist richtig gewählt', right: 'mitte',
        options: [
          { value: 'klein', label: 'Möglichst klein, etwa 2 V bis 3 V', grund: 'Bei kleinen Z-Spannungen dominiert der Zener-Effekt, die Z-Spannung sinkt deutlich mit der Temperatur. Besser ist der Bereich, in dem sich die beiden Temperaturgänge ausgleichen.' },
          { value: 'gross', label: 'Möglichst groß, über 20 V', grund: 'Bei großen Z-Spannungen dominiert der Lawineneffekt, die Z-Spannung steigt deutlich mit der Temperatur. Besser ist der Bereich, in dem sich beide Effekte ausgleichen.' },
          { value: 'mitte', label: 'Etwa ' + f(v.g1, 0) + ' V bis ' + f(v.g3, 0) + ' V (Übergangsbereich)', grund: 'Im Übergangsbereich um etwa ' + f(v.g1, 0) + ' bis ' + f(v.g3, 0) + ' V haben Zener- und Lawineneffekt gegenläufigen Temperaturgang: Er hebt sich nahezu auf, die Z-Spannung ist am stabilsten.' },
          { value: 'egal', label: 'Jede, der Temperaturgang ist überall gleich', grund: 'Der Temperaturgang ändert sich mit der Z-Spannung, sogar sein Vorzeichen: bei kleinen Spannungen negativ, bei großen positiv.' }] }]; });
    const specs = () => once('rot36', () => rot(specs0(), [1, 0, 2, 0]));
    return pick({ rig: 'stabil', ctl: CTL, specs, vals,
      text: () => 'Eine Z-Diode wird in Sperrrichtung betrieben und bricht bei ihrer Z-Spannung durch. Beantworte vier Fragen zu den beiden Durchbruchsarten und zum Temperaturverhalten (Übungswerte, Datenblatt maßgeblich). Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) siehst du die Stufe mit Vorwiderstand; die Z-Spannung kannst du dort verstellen.',
      hint: () => { const v = vals(); return [
        'Zwei Effekte führen zum Durchbruch: Beim Zener-Effekt (Felddurchbruch) reißt das starke Feld Valenzelektronen aus den Bindungen; er dominiert bei kleinen Z-Spannungen. Beim Lawineneffekt beschleunigen sich vorhandene Ladungsträger und lösen durch Stoßionisation weitere aus; er dominiert bei größeren Z-Spannungen.',
        'Als Faustwert gilt: Bis etwa ' + f(v.g1, 0) + ' V überwiegt der Zener-Effekt, ab etwa ' + f(v.g2, 0) + ' V der Lawineneffekt, dazwischen mischen sich beide. Der Temperaturgang hat bei beiden entgegengesetztes Vorzeichen: Zener: Z-Spannung sinkt (NTC), Lawine: Z-Spannung steigt (PTC).',
        'Musterlösung: ' + f(v.u1, 1) + ' V: Zener-Effekt, ' + f(v.u2, 0) + ' V: Lawineneffekt; bei steigender Temperatur sinkt die Z-Spannung der ' + f(v.u1, 1) + '-V-Diode. Eine temperaturstabile Referenz liegt im Übergangsbereich bei etwa ' + f(v.g1, 0) + ' V bis ' + f(v.g3, 0) + ' V (zum Beispiel ' + f(v.ref, 1) + ' V).'
      ]; } });
  })();

  /* ====================================================================== nt37: Regelschaltung mit Z-Referenz und Laengstransistor (Lernfeld 9.2, Stabilisierung mit Regelverstaerker) */ /* PRUEFEN P5: Z-Referenz am nicht invertierenden, Teiler am invertierenden Eingang, Längstransistor als Emitterfolger; B = 50 ist Aufgabenwert, Grenzen des Operationsverstärker-Ausgangs bleiben unberücksichtigt */
  const M37 = (() => {
    const G = { uref: 4.7, uaus: 12, rb: 4700, uein: 18, i: 0.4, b: 50 };
    const CTL = () => ({ art: 'lm317', ue: G.uein, r1: 240, r2: 2064, iLast: G.i, kurz: false });
    const vals = () => once('v37', () => { const ra = C().lin.r2For(G.uaus, G.rb, G.uref), probe = C().lin.lm317({ R1: G.rb, R2: ra, Uref: G.uref });
      return { uref: G.uref, uaus: G.uaus, rb: G.rb / 1e3, ra: ra / 1e3, raOhm: ra, probe: probe.Uaus, uein: G.uein, i: G.i * 1e3, b: G.b, pv: C().lin.loss(G.uein, G.uaus, G.i), pLast: G.uaus * G.i, pEin: G.uein * G.i, ib: G.i / G.b * 1e3, gesamt: G.rb * G.uaus / G.uref / 1e3, kehr: G.rb * G.uref / (G.uaus - G.uref) / 1e3, ud: G.uein - G.uaus, ibMal: G.i * G.b }; });
    const rRa = () => once('r37a', () => { const v = vals(); return own(v.raOhm, 'Ω', { factor: 1e3, wrongs: [{ v: v.gesamt * 1e3, text: 'Dein Wert (' + f(v.gesamt, 2) + ' kΩ) ist R_a + R_b, der Gesamtwiderstand des Teilers. R_a ist nur der obere Teil: R_a = R_b · (U_aus / U_Z − 1).' }, { v: v.kehr * 1e3, text: 'Du hast das Verhältnis umgekehrt (R_b · U_Z / (U_aus − U_Z)). Die Referenz liegt am unteren Widerstand R_b: U_Z = U_aus · R_b / (R_a + R_b).' }] }); });
    const rPv = () => once('r37b', () => { const v = vals(); return own(v.pv, 'W', { wrongs: [{ v: v.pLast, text: 'Dein Wert (' + f(v.pLast, 1) + ' W) ist die Leistung der Last, U_aus · I. Der Längstransistor setzt (U_ein − U_aus) · I um.' }, { v: v.pEin, text: 'Dein Wert (' + f(v.pEin, 1) + ' W) ist die aufgenommene Eingangsleistung U_ein · I. Im Transistor fällt nur die Differenz U_ein − U_aus ab.' }] }); });
    const rIb = () => once('r37c', () => { const v = vals(); return own(v.ib / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: v.ibMal, text: 'Du hast I_C · B gerechnet. Der Basisstrom ist kleiner als der Kollektorstrom: I_B = I_C / B.' }, { v: v.i / 1e3, text: 'Dein Wert ist der Kollektorstrom (Laststrom). Der Basisstrom ist I_B = I_C / B, hier viel kleiner.' }] }); });
    const specs0 = () => once('sp37', () => { const v = vals(); return [
      { key: 'regel', q: 'Die Last wird kleiner (der Laststrom steigt), die Ausgangsspannung sinkt etwas. Wie reagiert die Regelschaltung? Die Z-Referenz liegt am nicht invertierenden Eingang, der Teiler (Istwert) am invertierenden Eingang des Operationsverstärkers, dessen Ausgang den Längstransistor ansteuert.', short: 'Die Reaktion der Regelschaltung auf eine Laständerung ist richtig beschrieben', right: 'nach',
        options: [
          { value: 'weiter', label: 'Der Istwert sinkt, der Verstärkerausgang sinkt, der Transistor sperrt mehr', grund: 'Sinkt U_aus, sinkt der Istwert am invertierenden Eingang unter die Referenz: Der Ausgang des Verstärkers steigt, der Transistor wird stärker durchgesteuert und hebt U_aus wieder an. Ein Sperren würde U_aus weiter senken (Mitkopplung).' },
          { value: 'nach', label: 'Der Istwert sinkt, der Verstärkerausgang steigt, der Transistor leitet mehr', grund: 'Sinkt U_aus, sinkt der Istwert unter ' + f(v.uref, 1) + ' V: Die Eingangsdifferenz wird positiv, der Verstärkerausgang steigt und steuert den Längstransistor weiter auf. U_aus steigt zurück auf den Sollwert ' + f(v.uaus, 0) + ' V (Gegenkopplung).' },
          { value: 'egal', label: 'Nichts, die Z-Diode allein hält die Ausgangsspannung konstant', grund: 'Die Z-Diode liefert hier nur die Referenz ' + f(v.uref, 1) + ' V; sie trägt keinen Laststrom. Die Ausgangsspannung ' + f(v.uaus, 0) + ' V hält der Regelverstärker mit dem Längstransistor.' },
          { value: 'teiler', label: 'Der Teiler ändert sein Verhältnis und gleicht den Fehler aus', grund: 'Der Teiler ist aus festen Widerständen aufgebaut und ändert sein Verhältnis nicht. Die Regelung geschieht über den Verstärker und den Längstransistor.' }] },
      { key: 'vertauscht', q: 'Der Techniker vertauscht die Eingänge: Die Z-Referenz kommt an den invertierenden, der Teiler an den nicht invertierenden Eingang. Was geschieht?', short: 'Die Folge der vertauschten Eingänge ist richtig beschrieben', right: 'mit',
        options: [
          { value: 'besser', label: 'Die Regelung arbeitet unverändert, nur invertiert', grund: 'Mit vertauschten Eingängen wird aus der Gegenkopplung eine Mitkopplung: Die Abweichung wird nicht kleiner, sondern größer. Unverändert arbeitet die Regelung nicht.' },
          { value: 'mit', label: 'Mitkopplung: Verstärker und Transistor laufen in die Sättigung', grund: 'Steigt U_aus, steigt der Istwert am nicht invertierenden Eingang, der Verstärkerausgang steigt weiter und steuert den Transistor noch mehr auf: Die Abweichung verstärkt sich, bis Verstärker und Transistor in der Sättigung stehen. Die Spannung ist nicht geregelt.' },
          { value: 'halb', label: 'Die Ausgangsspannung halbiert sich, die Regelung bleibt', grund: 'Halbiert würde die Spannung nur bei geändertem Teilerverhältnis. Hier liegt das Problem im Vorzeichen: Mitkopplung statt Gegenkopplung, die Regelung bricht zusammen.' },
          { value: 'ref', label: 'Die Referenzspannung steigt auf die Eingangsspannung', grund: 'Die Referenz bleibt bei ' + f(v.uref, 1) + ' V, sie hängt an der Z-Diode. Verändert wird das Vorzeichen der Rückkopplung: Mitkopplung, Verstärker und Transistor laufen in die Sättigung.' }] }]; });
    const specs = () => once('rot37', () => rot(specs0(), [2, 3]));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ra'), rRa(), 'Der obere Teilerwiderstand R_a ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'pv'), rPv(), 'Die Verlustleistung des Längstransistors ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ib'), rIb(), 'Der Basisstrom des Längstransistors ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Spannungsstabilisierung mit Regelverstärker (Übungsschaltung): Eine Z-Diode liefert die Referenz U_Z = ' + f(G.uref, 1) + ' V an den nicht invertierenden Eingang eines Operationsverstärkers. Die Ausgangsspannung wird über einen Teiler (R_a vom Ausgang zum Teilerpunkt, R_b = ' + eng(G.rb, 'Ω') + ' vom Teilerpunkt nach Masse) als Istwert an den invertierenden Eingang geführt. Der Verstärkerausgang steuert die Basis eines Längstransistors (B = ' + f(G.b, 0) + '). Es gilt U_aus = U_Z · (1 + R_a / R_b). Gesucht: R_a für U_aus = ' + f(G.uaus, 0) + ' V, die Verlustleistung des Längstransistors bei U_ein = ' + f(G.uein, 0) + ' V und I_aus = ' + f(G.i * 1e3, 0) + ' mA und sein Basisstrom. Beantworte dann zwei Fragen zur Regelung. Der LM317 im Prüfstand „' + rname('stabil') + '“ arbeitet nach demselben Prinzip (Referenz 1,25 V).',
      fields: () => [{ key: 'ra', label: 'Oberer Teilerwiderstand R_a', unit: 'kΩ' }, { key: 'pv', label: 'Verlustleistung des Längstransistors', unit: 'W' }, { key: 'ib', label: 'Basisstrom des Längstransistors', unit: 'mA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Regelverstärker hält die Spannung am invertierenden Eingang auf dem Wert der Referenz. Der Teiler liefert dort U_aus · R_b / (R_a + R_b) = U_Z, also U_aus = U_Z · (1 + R_a / R_b). Der Längstransistor übernimmt die Differenz U_ein − U_aus.',
        'Aus der Formel folgt R_a / R_b = U_aus / U_Z − 1 = ' + f(v.uaus, 0) + ' V / ' + f(v.uref, 1) + ' V − 1. Die Verlustleistung ist (U_ein − U_aus) · I_aus mit U_ein − U_aus = ' + f(v.ud, 0) + ' V; der Basisstrom ist I_B = I_C / B bei I_C = I_aus = ' + f(v.i, 0) + ' mA.',
        'Musterlösung: R_a = ' + f(v.rb, 1) + ' kΩ · (' + f(v.uaus, 0) + ' V / ' + f(v.uref, 1) + ' V − 1) = ' + f(v.ra, 2) + ' kΩ; P_V = ' + f(v.ud, 0) + ' V · ' + f(v.i, 0) + ' mA = ' + f(v.pv, 1) + ' W; I_B = ' + f(v.i, 0) + ' mA / ' + f(v.b, 0) + ' = ' + f(v.ib, 1) + ' mA.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { ra: null, pv: null, ib: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', CTL(), { fields: { ra: v.ra, pv: v.pv, ib: v.ib }, choices: rightOf(specs()), value: v.ra }); },
      wrong: () => { const v = vals(); return [
        { name: 'Gesamtwiderstand statt R_a, Last- statt Transistorleistung', answer: A('stabil', {}, { fields: { ra: v.gesamt, pv: v.pLast, ib: v.ibMal }, choices: { regel: 'weiter', vertauscht: 'besser' } }) },
        { name: 'Verhältnis umgekehrt, Eingangsleistung, Kollektorstrom als Basisstrom', answer: A('stabil', {}, { fields: { ra: v.kehr, pv: v.pEin, ib: v.i }, choices: { regel: 'egal', vertauscht: 'halb' } }) }]; } };
  })();

  /* ====================================================================== nt38: Strom- und Lastbereich der Z-Diode-Stufe (Lernfeld 9.2, Z-Diode: Grenzwerte) */ /* PRUEFEN P6: I_Z,min = 5 mA ist der Übungswert des Labs; im Unterricht kann eine Faustregel (Bruchteil von I_Z,max) gelten, die Mitschrift ist hier unleserlich */
  const M38 = (() => {
    const G = { ue: 12, uz: 3.9, ptot: 0.4, rv: 82, rlk: 30 };
    const CTL = () => ({ art: 'zener', ue: G.ue, uz: G.uz, rv: G.rv, rlast: 100, kurz: false });
    const vals = () => once('v38', () => { const izmin = lv('iz_min'), izmax = G.ptot / G.uz, l0 = zst({ Ue: G.ue, Uz: G.uz, Rv: G.rv, Ilast: 0, Pmax: G.ptot }), ig = l0.Iges, ilmax = ig - izmin, rlmin = G.uz / ilmax, k = zst({ Ue: G.ue, Uz: G.uz, Rv: G.rv, Rlast: G.rlk });
      return { ue: G.ue, uz: G.uz, ptot: G.ptot * 1e3, rv: G.rv, izmin: izmin * 1e3, izmax: izmax * 1e3, ig: ig * 1e3, pzLeer: l0.Pz * 1e3, ilmax: ilmax * 1e3, rlmin, rlk: G.rlk, uk: k.Uaus, ik: k.Ilast * 1e3, iz0: l0.Iz * 1e3, malU: G.ptot * G.uz * 1e3, geteilt: G.uz / G.ptot * 1e3, izmaxLast: (izmax - 0) * 1e3 }; });
    const rImax = () => once('r38a', () => { const v = vals(); return own(v.izmax / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: v.malU / 1e6, text: 'Du hast P_tot · U_Z gerechnet. Aus P = U_Z · I folgt I_Z,max = P_tot / U_Z.' }, { v: G.uz / G.ptot, text: 'Du hast U_Z / P_tot gerechnet. Der größte Strom ist die zulässige Leistung durch die Z-Spannung: I_Z,max = P_tot / U_Z.' }] }); });
    const rIl = () => once('r38b', () => { const v = vals(); return own(v.ilmax / 1e3, 'A', { factor: 1e-3, wrongs: [{ v: v.ig / 1e3, text: 'Dein Wert (' + mAf(v.ig) + ') ist der Gesamtstrom I_ges. Vom Gesamtstrom muss der kleinste Z-Strom ' + mAf(v.izmin) + ' für die Regelung abgezogen werden: I_L,max = I_ges − I_Z,min.' }, { v: (v.ig + v.izmin) / 1e3, text: 'Du hast den Mindest-Z-Strom addiert. Er bleibt in der Diode und steht der Last nicht zur Verfügung: I_L,max = I_ges − I_Z,min.' }] }); });
    const rRl = () => once('r38c', () => { const v = vals(); return own(v.rlmin, 'Ω', { wrongs: [{ v: G.uz / (v.ig / 1e3), text: 'Du hast mit dem ganzen Gesamtstrom gerechnet (' + f(G.uz / (v.ig / 1e3), 1) + ' Ω). Die kleinste Last gehört zu I_L,max = I_ges − I_Z,min.' }, { v: G.ue / (v.ilmax / 1e3), text: 'Du hast U_E statt U_Z durch I_L,max geteilt. Die Last liegt an der Z-Spannung: R_L,min = U_Z / I_L,max.' }] }); });
    const specs0 = () => once('sp38', () => { const v = vals(); return [
      { key: 'zukleinlast', q: 'Die Last wird auf R_L = ' + eng(v.rlk, 'Ω') + ' verkleinert (kleiner als R_L,min). Was geschieht mit der Ausgangsspannung?', short: 'Die Folge einer zu kleinen Last ist richtig beschrieben', right: 'bricht',
        options: [
          { value: 'bleibt', label: 'Die Spannung bleibt bei U_Z, die Z-Diode regelt weiter', grund: 'Die Last würde bei U_Z = ' + f(v.uz, 1) + ' V mehr Strom ziehen (' + mAf(v.uz / v.rlk * 1e3) + ') als der Vorwiderstand liefern kann (I_ges = ' + mAf(v.ig) + '). Der Z-Strom fiele auf null, die Diode regelt nicht mehr.' },
          { value: 'bricht', label: 'Die Spannung bricht ein, weil I_Z unter I_Z,min fällt', grund: 'Die Last verlangt mehr Strom, als R_V liefert. Der Z-Strom fällt unter I_Z,min = ' + mAf(v.izmin) + ', die Z-Diode sperrt wieder: Die Ausgangsspannung ist nur noch der Teiler aus R_V und R_L, hier ' + f(v.uk, 2) + ' V statt ' + f(v.uz, 1) + ' V.' },
          { value: 'steigt', label: 'Die Spannung steigt über U_Z, weil mehr Strom fließt', grund: 'Mehr Laststrom heißt mehr Spannungsfall am Vorwiderstand, nicht mehr Ausgangsspannung. Die Ausgangsspannung fällt auf ' + f(v.uk, 2) + ' V.' },
          { value: 'diode', label: 'Die Z-Diode wird überlastet und zerstört', grund: 'Ein kleinerer Lastwiderstand entlastet die Z-Diode: Die Z-Diode bekommt weniger Strom. Das Problem ist die Spannung, die einbricht (' + f(v.uk, 2) + ' V), nicht die Z-Diode.' }] },
      { key: 'leerlauf', q: 'Die Last wird abgeklemmt (Leerlauf). Wie ist die Z-Diode belastet?', short: 'Die Belastung der Z-Diode im Leerlauf ist richtig beurteilt', right: 'ok',
        options: [
          { value: 'zerstoert', label: 'Die Z-Diode ist überlastet, P_Z liegt über P_tot', grund: 'Im Leerlauf fließen I_ges = ' + mAf(v.iz0) + ' durch die Z-Diode, P_Z = ' + f(v.uz, 1) + ' V · ' + mAf(v.iz0) + ' = ' + f(v.pzLeer, 0) + ' mW. Das liegt unter P_tot = ' + f(v.ptot, 0) + ' mW.' },
          { value: 'ok', label: 'Die Z-Diode ist zulässig belastet, P_Z knapp unter P_tot', grund: 'Der ganze Strom I_ges = ' + mAf(v.iz0) + ' geht durch die Z-Diode (I_Z,max = ' + mAf(v.izmax) + '). P_Z = ' + f(v.pzLeer, 0) + ' mW liegt unter P_tot = ' + f(v.ptot, 0) + ' mW.' },
          { value: 'null', label: 'Die Z-Diode ist unbelastet, im Leerlauf fließt kein Strom', grund: 'Ohne Last fließt der gesamte Strom durch die Z-Diode: ' + mAf(v.iz0) + '. Der Leerlauf ist für die Z-Diode der ungünstigste Betriebsfall.' },
          { value: 'ruhe', label: 'Die Z-Diode sperrt, weil die Last fehlt und kein Strom fließt', grund: 'Ohne Last steht der ganze Strom (' + mAf(v.iz0) + ') der Z-Diode zur Verfügung. Sie leitet am stärksten, sie sperrt nicht.' }] }]; });
    const specs = () => once('rot38', () => rot(specs0(), [2, 0]));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'izmax'), rImax(), 'Der größte Z-Strom I_Z,max ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ilmax'), rIl(), 'Der größte Laststrom I_L,max ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'rlmin'), rRl(), 'Der kleinste Lastwiderstand R_L,min ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Z-Diode mit U_Z = ' + f(G.uz, 1) + ' V und der zulässigen Verlustleistung P_tot = ' + f(G.ptot * 1e3, 0) + ' mW (Aufgabenwert) wird aus U_E = ' + f(G.ue, 0) + ' V über R_V = ' + eng(G.rv, 'Ω') + ' gespeist (Übungsschaltung). Der kleinste Z-Strom für eine sichere Stabilisierung beträgt I_Z,min = ' + eng(lv('iz_min'), 'A') + ' (Übungswert). Berechne den größten zulässigen Z-Strom I_Z,max, den größten Laststrom I_L,max und den kleinsten Lastwiderstand R_L,min, bei dem die Stufe noch stabilisiert. Beantworte dann zwei Fragen zu den Grenzfällen. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) kannst du die Last verstellen.',
      fields: () => [{ key: 'izmax', label: 'Größter Z-Strom I_Z,max', unit: 'mA' }, { key: 'ilmax', label: 'Größter Laststrom I_L,max', unit: 'mA' }, { key: 'rlmin', label: 'Kleinster Lastwiderstand R_L,min', unit: 'Ω' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Aus der zulässigen Leistung folgt der größte Z-Strom: I_Z,max = P_tot / U_Z. Durch R_V fließt der Gesamtstrom I_ges = (U_E − U_Z) / R_V; er teilt sich in Z-Strom und Laststrom. Die Stufe stabilisiert, solange I_Z mindestens I_Z,min beträgt, also I_L,max = I_ges − I_Z,min.',
        'I_Z,max = ' + f(v.ptot, 0) + ' mW / ' + f(v.uz, 1) + ' V. I_ges = (' + f(v.ue, 0) + ' V − ' + f(v.uz, 1) + ' V) / ' + f(v.rv, 0) + ' Ω = ' + f(v.ig, 2) + ' mA. Von I_ges ziehst du I_Z,min = ' + f(v.izmin, 0) + ' mA ab. Der kleinste Lastwiderstand ist R_L,min = U_Z / I_L,max.',
        'Musterlösung: I_Z,max = ' + f(v.izmax, 2) + ' mA, I_L,max = ' + f(v.ig, 2) + ' mA − ' + f(v.izmin, 0) + ' mA = ' + f(v.ilmax, 2) + ' mA, R_L,min = ' + f(v.uz, 1) + ' V / ' + f(v.ilmax, 2) + ' mA = ' + f(v.rlmin, 2) + ' Ω. Im Leerlauf ist P_Z = ' + f(v.pzLeer, 0) + ' mW (zulässig).'
      ]; },
      start: () => A('stabil', CTL(), { fields: { izmax: null, ilmax: null, rlmin: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', Object.assign(CTL(), { rlast: Math.round(v.rlmin) }), { fields: { izmax: v.izmax, ilmax: v.ilmax, rlmin: v.rlmin }, choices: rightOf(specs()), value: v.rlmin }); },
      wrong: () => { const v = vals(); return [
        { name: 'Leistung mal Spannung, ganzer Gesamtstrom, Last bleibt stabil', answer: A('stabil', {}, { fields: { izmax: v.malU, ilmax: v.ig, rlmin: v.uz / (v.ig / 1e3) }, choices: { zukleinlast: 'bleibt', leerlauf: 'zerstoert' } }) },
        { name: 'Mindest-Z-Strom addiert, U_E statt U_Z, Diode überlastet', answer: A('stabil', {}, { fields: { izmax: v.geteilt, ilmax: v.ig + v.izmin, rlmin: v.ue / (v.ilmax / 1e3) }, choices: { zukleinlast: 'diode', leerlauf: 'null' } }) }]; } };
  })();

  /* ====================================================================== nt39 bis nt47: Anbindung an den Berufsschulstoff, zweiter Teil (Lernfeld 5.3 Transformator, Gleichrichtung, Siebung; Lernfeld 9.2 Laengstransistor, LM317, Z-Diode)
   * Eigene Zahlen (Uebungswerte), unabhaengig nachgerechnet in quelle/ntslab/test_schule.js; Grenzwerte (U_F, U_BE, U_ref, Dropout, Adjust-Strom, I_Z,min) aus NTS_CORE.limit.
   * Die fragwuerdigen Mitschriftstellen (R_V,max der Z-Diode in Lernfeld 5.3, Verlustleistung im Blatt E9.2) wurden nicht uebernommen, nt47 rechnet die Grenzen neu mit eigenen Zahlen. */
  const TRAFO = () => ({ n1: 1150, n2: 69, ri: 0.4, gleichspannung: false, last: 'R', iLast: 0 });
  const GLEICH = () => ({ u2: 12, topo: 'bruecke', diode: 'si', rs: 0, c: 2200, rsieb: false, iLast: 0 });

  /* ====================================================================== nt39: Windungszahlen aus den Spannungen (Lernfeld 5.3, Transformator) */
  const M39 = (() => {
    const G = { u1: 230, u2: 18, n2: 90, n1b: 1380, n2b: 72, i2: 2 };
    const vals = () => once('v39', () => { const ue = G.u1 / G.u2, n1 = G.n2 * ue, u2b = G.u1 * G.n2b / G.n1b, i1 = G.i2 * G.n2b / G.n1b;
      return { u1: G.u1, u2: G.u2, n2: G.n2, ue, n1, n1b: G.n1b, n2b: G.n2b, u2b, i2: G.i2, i1: i1 * 1e3, n1Kehr: G.n2 / ue, u2bKehr: G.u1 * G.n1b / G.n2b, i1Kehr: G.i2 * G.n1b / G.n2b, s: G.u1 * i1 }; });
    const rN1 = () => once('r39a', () => { const v = vals(); return own(v.n1, '', { wrongs: [{ v: v.n1Kehr, text: 'Du hast das Verhältnis umgedreht. Die Spannungen verhalten sich wie die Windungszahlen: Die Seite mit der höheren Spannung hat mehr Windungen, N_1 = N_2 · U_1 / U_2.' }] }); });
    const rU2 = () => once('r39b', () => { const v = vals(); return own(v.u2b, 'V', { wrongs: [{ v: v.u2bKehr, text: 'Du hast mit N_1 / N_2 multipliziert. Die Sekundärseite hat weniger Windungen, also weniger Spannung: U_2 = U_1 · N_2 / N_1.' }] }); });
    const rI1 = () => once('r39c', () => { const v = vals(); return own(v.i1 * 1e-3, 'A', { factor: 1e-3, wrongs: [{ v: v.i1Kehr, text: 'Du hast den Strom im Verhältnis der Spannungen umgerechnet. Die Ströme verhalten sich umgekehrt: Die Seite mit mehr Windungen führt weniger Strom, I_1 = I_2 · N_2 / N_1.' }, { v: G.i2, text: 'Das ist der Sekundärstrom. Auf der Primärseite fließt nur der N_2 / N_1-te Teil davon.' }] }); });
    const specs = () => once('sp39', () => { const v = vals(); return [
      { key: 'leistung', q: 'Was gilt beim idealen Transformator für die Scheinleistung auf beiden Seiten?', short: 'Die Leistungsbilanz des idealen Transformators ist richtig beschrieben', right: 'gleich',
        options: [
          { value: 'ue', label: 'Die Primärseite hat die ü-fache Leistung der Sekundärseite', grund: 'Dann würde Energie verschwinden. Der ideale Transformator hat keine Verluste: U_1 · I_1 = U_2 · I_2 (hier ' + f(v.s, 0) + ' VA).' },
          { value: 'gleich', label: 'Primär- und Sekundärseite haben dieselbe Leistung', grund: 'Ohne Verluste wird alles übertragen: U_1 · I_1 = U_2 · I_2 = ' + f(v.s, 0) + ' VA. Deshalb ist der Strom auf der Seite mit der höheren Spannung kleiner.' },
          { value: 'sek', label: 'Die Sekundärseite hat mehr Leistung, weil der Strom größer ist', grund: 'Der größere Strom kommt mit einer kleineren Spannung zusammen. Das Produkt bleibt gleich: ' + f(v.s, 0) + ' VA auf beiden Seiten.' },
          { value: 'null', label: 'Die Sekundärseite hat ohne Last schon volle Leistung', grund: 'Ohne Last fließt sekundär kein Strom, es wird keine Leistung übertragen. Erst die Last bestimmt die Leistung (hier ' + f(v.s, 0) + ' VA bei ' + f(v.i2, 0) + ' A).' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'n1'), rN1(), 'Die primäre Windungszahl N_1 ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'u2'), rU2(), 'Die Sekundärspannung des zweiten Transformators ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'i1'), rI1(), 'Der Primärstrom des zweiten Transformators ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Transformator 1 soll aus U_1 = ' + f(G.u1, 0) + ' V die Spannung U_2 = ' + f(G.u2, 0) + ' V machen, die Sekundärwicklung hat N_2 = ' + f(G.n2, 0) + ' Windungen. Berechne N_1. Transformator 2 hat N_1 = ' + f(G.n1b, 0) + ' und N_2 = ' + f(G.n2b, 0) + ' Windungen und liegt ebenfalls an ' + f(G.u1, 0) + ' V. Berechne seine Sekundärspannung und den Primärstrom, wenn sekundär I_2 = ' + f(G.i2, 0) + ' A fließen (idealer Transformator, Übungswerte). Im Prüfstand „' + rname('trafo') + '“ kannst du die Windungszahlen einstellen.',
      fields: () => [{ key: 'n1', label: 'Transformator 1: Windungszahl N_1', unit: '' }, { key: 'u2', label: 'Transformator 2: Sekundärspannung U_2', unit: 'V' }, { key: 'i1', label: 'Transformator 2: Primärstrom I_1', unit: 'mA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Beim idealen Transformator verhalten sich die Spannungen wie die Windungszahlen: U_1 / U_2 = N_1 / N_2 = ü. Die Ströme verhalten sich umgekehrt: I_1 / I_2 = N_2 / N_1.',
        'Übersetzungsverhältnis von Transformator 1: ü = ' + f(v.u1, 0) + ' V / ' + f(v.u2, 0) + ' V = ' + f(v.ue, 2) + ', also N_1 = ü · ' + f(v.n2, 0) + '. Transformator 2: U_2 = ' + f(v.u1, 0) + ' V · ' + f(v.n2b, 0) + ' / ' + f(v.n1b, 0) + ', I_1 = ' + f(v.i2, 0) + ' A · ' + f(v.n2b, 0) + ' / ' + f(v.n1b, 0) + '.',
        'Musterlösung: N_1 = ' + f(v.n1, 0) + ', U_2 = ' + f(v.u2b, 1) + ' V, I_1 = ' + f(v.i1, 1) + ' mA. Probe: ' + f(v.u1, 0) + ' V · ' + f(v.i1, 1) + ' mA = ' + f(v.u2b, 0) + ' V · ' + f(v.i2, 0) + ' A = ' + f(v.s, 0) + ' VA.'
      ]; },
      start: () => A('trafo', TRAFO(), { fields: { n1: null, u2: null, i1: null }, choices: {} }),
      sol: () => { const v = vals(); return A('trafo', Object.assign(TRAFO(), { n1: G.n1b, n2: G.n2b }), { fields: { n1: v.n1, u2: v.u2b, i1: v.i1 }, choices: rightOf(specs()), value: v.u2b }); },
      wrong: () => { const v = vals(); return [
        { name: 'Verhältnis umgedreht (N_1 und U_2), ü-fache Leistung', answer: A('trafo', {}, { fields: { n1: v.n1Kehr, u2: v.u2bKehr, i1: v.i1 }, choices: { leistung: 'ue' } }) },
        { name: 'Strom wie die Spannung umgerechnet, mehr Leistung sekundär', answer: A('trafo', {}, { fields: { n1: v.n1, u2: v.u2b, i1: v.i1Kehr * 1e3 }, choices: { leistung: 'sek' } }) }]; } };
  })();

  /* ====================================================================== nt40: Widerstandsuebersetzung des Transformators (Lernfeld 5.3, Anpassung mit Transformator) */ /* PRUEFEN P8: Übertrager für einen Lautsprecher; der Begriff Impedanz steht nur als Klammerzusatz, gerechnet wird mit Widerständen */
  const M40 = (() => {
    const G = { n1: 1200, n2: 100, r2: 4, r2b: 8, r1b: 800 };
    const vals = () => once('v40', () => { const ue = G.n1 / G.n2, r1 = ue * ue * G.r2, ueb = Math.sqrt(G.r1b / G.r2b), n2b = G.n1 / ueb;
      return { n1: G.n1, n2: G.n2, ue, ue2: ue * ue, r2: G.r2, r1, r2b: G.r2b, r1b: G.r1b, ueb, ueb2: ueb * ueb, n2b, r1Lin: ue * G.r2, n2Lin: G.n1 / (G.r1b / G.r2b) }; });
    const rUe = () => once('r40a', () => { const v = vals(); return own(v.ue, '', { wrongs: [{ v: 1 / v.ue, text: 'Du hast den Kehrwert gebildet. Das Übersetzungsverhältnis ist ü = N_1 / N_2.' }] }); });
    const rR1 = () => once('r40b', () => { const v = vals(); return own(v.r1, 'Ω', { wrongs: [{ v: v.r1Lin, text: 'Du hast nur mit ü multipliziert. Widerstände werden mit ü² übersetzt, weil die Spannung mit ü steigt und der Strom zugleich mit ü sinkt.' }, { v: G.r2 / (v.ue * v.ue), text: 'Du hast durch ü² geteilt. Auf der Seite mit mehr Windungen erscheint der Widerstand größer: R_1 = ü² · R_2.' }] }); });
    const rN2 = () => once('r40c', () => { const v = vals(); return own(v.n2b, '', { wrongs: [{ v: v.n2Lin, text: 'Du hast das Widerstandsverhältnis direkt als Windungsverhältnis genommen. Das Windungsverhältnis ist die Wurzel daraus: ü = √(R_1 / R_2).' }] }); });
    const specs = () => once('sp40', () => { const v = vals(); return [
      { key: 'warum', q: 'Warum geht das Übersetzungsverhältnis beim Widerstand im Quadrat ein?', short: 'Der Grund für ü² ist richtig benannt', right: 'beide',
        options: [
          { value: 'kern', label: 'Weil der Eisenkern den Widerstand quadratisch verstärkt', grund: 'Der Kern führt den magnetischen Fluss, er verstärkt keinen Widerstand. Das Quadrat kommt aus Spannung und Strom: U wird mit ü übersetzt, I mit 1 / ü, R = U / I also mit ü² (hier ' + f(v.ue2, 0) + ').' },
          { value: 'beide', label: 'Weil Spannung mit ü und Strom mit 1 / ü übersetzt werden', grund: 'Primär ist die Spannung ü-mal größer und der Strom ü-mal kleiner. R = U / I wird damit ü · ü = ' + f(v.ue2, 0) + '-mal so groß.' },
          { value: 'zwei', label: 'Weil der Transformator zwei Wicklungen hat', grund: 'Die Zahl der Wicklungen ist nicht der Grund. U wird mit ü übersetzt, I mit 1 / ü; im Verhältnis R = U / I steht deshalb ü².' },
          { value: 'leist', label: 'Weil die Leistung auf der Primärseite ü-mal größer ist', grund: 'Die Leistung ist beim idealen Transformator auf beiden Seiten gleich. Das Quadrat entsteht aus der Übersetzung von Spannung (ü) und Strom (1 / ü).' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ue'), rUe(), 'Das Übersetzungsverhältnis ü ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'r1'), rR1(), 'Der Widerstand, der primär wirksam ist, ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'n2'), rN2(), 'Die Windungszahl N_2 für die zweite Anpassung ist richtig berechnet', 0);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein Übertrager (Transformator) hat N_1 = ' + f(G.n1, 0) + ' und N_2 = ' + f(G.n2, 0) + ' Windungen. Sekundär ist ein Lautsprecher mit R_2 = ' + f(G.r2, 0) + ' Ω angeschlossen (Wechselstromwiderstand, auch Impedanz genannt; Übungswerte). Berechne das Übersetzungsverhältnis ü und den Widerstand, den die Primärseite sieht. Danach soll ein Lautsprecher mit ' + f(G.r2b, 0) + ' Ω an derselben Primärwicklung wie ' + f(G.r1b, 0) + ' Ω wirken: Wie viele Windungen braucht die Sekundärwicklung? Im Prüfstand „' + rname('trafo') + '“ kannst du die Windungszahlen einstellen.',
      fields: () => [{ key: 'ue', label: 'Übersetzungsverhältnis ü', unit: '' }, { key: 'r1', label: 'Primär wirksamer Widerstand R_1', unit: 'Ω' }, { key: 'n2', label: 'Windungszahl N_2 für die zweite Anpassung', unit: '' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Spannungen werden mit ü = N_1 / N_2 übersetzt, Ströme mit 1 / ü. Daraus folgt für Widerstände R_1 = ü² · R_2. Umgekehrt ist ü = √(R_1 / R_2), und N_2 = N_1 / ü.',
        'ü = ' + f(v.n1, 0) + ' / ' + f(v.n2, 0) + ', R_1 = ü² · ' + f(v.r2, 0) + ' Ω. Für die zweite Anpassung: ü = √(' + f(v.r1b, 0) + ' Ω / ' + f(v.r2b, 0) + ' Ω), dann N_2 = ' + f(v.n1, 0) + ' / ü.',
        'Musterlösung: ü = ' + f(v.ue, 0) + ', R_1 = ' + f(v.ue2, 0) + ' · ' + f(v.r2, 0) + ' Ω = ' + f(v.r1, 0) + ' Ω. Zweite Anpassung: ü = ' + f(v.ueb, 0) + ', N_2 = ' + f(v.n2b, 0) + ' Windungen.'
      ]; },
      start: () => A('trafo', TRAFO(), { fields: { ue: null, r1: null, n2: null }, choices: {} }),
      sol: () => { const v = vals(); return A('trafo', TRAFO(), { fields: { ue: v.ue, r1: v.r1, n2: v.n2b }, choices: rightOf(specs()), value: v.r1 }); },
      wrong: () => { const v = vals(); return [
        { name: 'Widerstand nur mit ü übersetzt, Widerstandsverhältnis als Windungsverhältnis', answer: A('trafo', {}, { fields: { ue: v.ue, r1: v.r1Lin, n2: v.n2Lin }, choices: { warum: 'kern' } }) },
        { name: 'Kehrwert von ü, durch ü² geteilt', answer: A('trafo', {}, { fields: { ue: 1 / v.ue, r1: G.r2 / (v.ue * v.ue), n2: v.n2b }, choices: { warum: 'leist' } }) }]; } };
  })();

  /* ====================================================================== nt41: Mittelwert hinter der Bruecke, 0,9 · U minus 2 · U_F (Lernfeld 5.3, Gleichrichterschaltungen) */ /* PRUEFEN P9: U_di = 0,9 · U ist der lineare Mittelwert der Zweiweggleichrichtung (2√2 / π); 2 · U_F wird als Näherung abgezogen, wie im Unterricht */
  const M41 = (() => {
    const G = { u: 12 };
    const vals = () => once('v41', () => { const uf = lv('uf_si'), udi = 0.9 * G.u, ud = udi - 2 * uf, uhat = G.u * Math.SQRT2, uc = uhat - 2 * uf;
      return { u: G.u, uf, udi, ud, uhat, uc, uein: 0.45 * G.u, ud1: udi - uf, faktor: 2 * Math.SQRT2 / Math.PI, zweiUf: 2 * uf }; });
    const rUdi = () => once('r41a', () => { const v = vals(); return own(v.udi, 'V', { wrongs: [{ v: v.uein, text: 'Dein Wert (0,45 · U) gilt für den Einweggleichrichter. Die Brücke nutzt beide Halbwellen: U_di = 0,9 · U.' }, { v: v.uhat, text: 'Das ist der Scheitelwert. Ohne Kondensator zeigt ein Gleichspannungsmessgerät den Mittelwert 0,9 · U.' }] }); });
    const rUd = () => once('r41b', () => { const v = vals(); return own(v.ud, 'V', { wrongs: [{ v: v.ud1, text: 'Du hast nur eine Diode abgezogen. In der Brücke leiten in jeder Halbwelle zwei Dioden in Reihe: 2 · U_F.' }, { v: v.udi, text: 'Du hast die Dioden nicht berücksichtigt. An den zwei leitenden Dioden fallen zusammen etwa 2 · U_F ab.' }] }); });
    const rUc = () => once('r41c', () => { const v = vals(); return own(v.uc, 'V', { wrongs: [{ v: v.ud, text: 'Das ist der Mittelwert ohne Kondensator. Ohne Last lädt sich der Kondensator auf den Scheitelwert minus 2 · U_F auf.' }, { v: v.uhat, text: 'Du hast die Dioden vergessen: Der Kondensator lädt sich nur auf Û − 2 · U_F auf.' }] }); });
    const specs = () => once('sp41', () => { const v = vals(); return [
      { key: 'last', q: 'Am Kondensator wird nun eine Last angeschlossen. Was geschieht mit der Gleichspannung?', short: 'Die Wirkung der Last auf die Gleichspannung ist richtig beschrieben', right: 'sinkt',
        options: [
          { value: 'sinkt', label: 'Die Spannung sinkt etwas unter ' + f(v.uc, 1) + ' V, es entsteht Brumm', grund: 'Zwischen den Ladeimpulsen entlädt die Last den Kondensator: Die Spannung schwankt (Brummspannung) und ihr Mittelwert liegt unter ' + f(v.uc, 2) + ' V, aber deutlich über ' + f(v.ud, 1) + ' V.' },
          { value: 'udi', label: 'Die Spannung fällt genau auf den Mittelwert ' + f(v.ud, 1) + ' V', grund: 'Auf den Mittelwert ohne Kondensator fällt sie nur, wenn der Kondensator fehlt. Mit Kondensator bleibt sie bei mäßiger Last nahe am Scheitelwert, mit etwas Brumm.' },
          { value: 'steigt', label: 'Die Spannung steigt auf den Scheitelwert ' + f(v.uhat, 1) + ' V', grund: 'Die Last nimmt Ladung weg, die Spannung kann nicht steigen. Außerdem fallen an den Dioden immer 2 · U_F ab.' },
          { value: 'gleich', label: 'Die Spannung bleibt bei ' + f(v.uc, 1) + ' V, ganz ohne Brumm', grund: 'Ohne Last bleibt die Ladung erhalten. Mit Last entlädt sich der Kondensator zwischen den Ladeimpulsen, es entsteht eine Brummspannung.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'udi'), rUdi(), 'Der ideale Mittelwert U_di der Brücke ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'ud'), rUd(), 'Der Mittelwert mit den Durchlassspannungen ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'uc'), rUc(), 'Die Spannung am Kondensator ohne Last ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [0.9, 0.45],
      text: () => 'Ein Brückengleichrichter mit Siliziumdioden (U_F = ' + f(lv('uf_si'), 1) + ' V) liegt an einer Wechselspannung mit dem Effektivwert U = ' + f(G.u, 0) + ' V. Ohne Kondensator misst ein Gleichspannungsmessgerät den linearen Mittelwert. Berechne den idealen Mittelwert U_di = 0,9 · U, den Mittelwert mit den Durchlassspannungen der Dioden und die Spannung, auf die sich ein Ladekondensator ohne Last auflädt. Im Prüfstand „' + rname('gleich') + '“ kannst du Scheitelwert und Gleichspannung ablesen.',
      fields: () => [{ key: 'udi', label: 'Idealer Mittelwert U_di', unit: 'V' }, { key: 'ud', label: 'Mittelwert mit Durchlassspannungen', unit: 'V' }, { key: 'uc', label: 'Spannung am Kondensator ohne Last', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der lineare Mittelwert einer zweiweg-gleichgerichteten Sinusspannung ist 0,9 · U (genauer 2√2 / π · U). In der Brücke leiten je Halbwelle zwei Dioden, an ihnen fallen etwa 2 · U_F ab. Ein Kondensator ohne Last lädt sich auf den Scheitelwert minus 2 · U_F auf.',
        'U_di = 0,9 · ' + f(v.u, 0) + ' V. Davon ziehst du 2 · ' + f(v.uf, 1) + ' V = ' + f(v.zweiUf, 1) + ' V ab. Scheitelwert: Û = ' + f(v.u, 0) + ' V · √2 = ' + f(v.uhat, 2) + ' V.',
        'Musterlösung: U_di = ' + f(v.udi, 1) + ' V, mit Dioden ' + f(v.ud, 1) + ' V, am Kondensator ohne Last ' + f(v.uhat, 2) + ' V − ' + f(v.zweiUf, 1) + ' V = ' + f(v.uc, 2) + ' V. Der Einweggleichrichter käme nur auf 0,45 · U = ' + f(v.uein, 1) + ' V.'
      ]; },
      start: () => A('gleich', GLEICH(), { fields: { udi: null, ud: null, uc: null }, choices: {} }),
      sol: () => { const v = vals(); return A('gleich', GLEICH(), { fields: { udi: v.udi, ud: v.ud, uc: v.uc }, choices: rightOf(specs()), value: v.ud }); },
      wrong: () => { const v = vals(); return [
        { name: 'Einweg-Faktor, eine Diode, Mittelwert als Kondensatorspannung', answer: A('gleich', {}, { fields: { udi: v.uein, ud: v.ud1, uc: v.ud }, choices: { last: 'udi' } }) },
        { name: 'Scheitelwert als Mittelwert, Dioden vergessen', answer: A('gleich', {}, { fields: { udi: v.uhat, ud: v.udi, uc: v.uhat }, choices: { last: 'steigt' } }) }]; } };
  })();

  /* ====================================================================== nt42: RC-Siebglied, Siebfaktor und Brummspannung (Lernfeld 5.3, Siebung) */ /* PRUEFEN P10: Siebfaktor S = √(R² + X_C²) / X_C; die Näherung S ≈ ω · R · C wird ebenfalls angenommen (Toleranz 3 %) */
  const M42 = (() => {
    const G = { r: 10, c: 1e-3, fp: 100, ubr: 1.2, il: 0.25, fp3: 300 };
    const vals = () => once('v42', () => { const w = 2 * Math.PI * G.fp, xc = 1 / (w * G.c), s = Math.sqrt(G.r * G.r + xc * xc) / xc, xc3 = 1 / (2 * Math.PI * G.fp3 * G.c), s3 = Math.sqrt(G.r * G.r + xc3 * xc3) / xc3, xc50 = 1 / (2 * Math.PI * 50 * G.c);
      return { r: G.r, c: G.c * 1e6, fp: G.fp, ubr: G.ubr, il: G.il, xc, s, sNah: w * G.r * G.c, ubr2: G.ubr / s * 1e3, du: G.il * G.r, fp3: G.fp3, xc3, s3, xc50, s50: Math.sqrt(G.r * G.r + xc50 * xc50) / xc50, ubrMal: G.ubr * s }; });
    const rXc = () => once('r42a', () => { const v = vals(); return own(v.xc, 'Ω', { wrongs: [{ v: v.xc50, text: 'Du hast mit 50 Hz gerechnet. Hinter der Brücke hat die Brummspannung die Pulsfrequenz f_p = ' + f(v.fp, 0) + ' Hz.' }, { v: 2 * Math.PI * v.fp * G.c, text: 'Du hast ω · C gerechnet. Der Blindwiderstand ist der Kehrwert: X_C = 1 / (ω · C).' }] }); });
    const rS = () => once('r42b', () => { const v = vals(); return own(v.s, '', { alts: [v.sNah], wrongs: [{ v: v.s50, text: 'Dein Siebfaktor passt zu 50 Hz. Rechne mit der Pulsfrequenz ' + f(v.fp, 0) + ' Hz der Brücke.' }, { v: 1 / v.s, text: 'Du hast den Kehrwert gebildet. Der Siebfaktor ist größer als 1: S = U_Br1 / U_Br2 ≈ R / X_C.' }] }); });
    const rU = () => once('r42c', () => { const v = vals(); return own(v.ubr2 * 1e-3, 'V', { factor: 1e-3, alts: [G.ubr / v.sNah], wrongs: [{ v: v.ubrMal, text: 'Du hast mit dem Siebfaktor multipliziert. Das Siebglied verkleinert die Brummspannung: U_Br2 = U_Br1 / S.' }] }); });
    const rDu = () => once('r42d', () => { const v = vals(); return own(v.du, 'V', { wrongs: [{ v: G.il * v.xc, text: 'Du hast mit X_C gerechnet. Der Gleichstrom fließt durch R und nicht durch den Kondensator: ΔU = I · R.' }] }); });
    const specs = () => once('sp42', () => { const v = vals(); return [
      { key: 'drei', q: 'Dasselbe Siebglied sitzt hinter einem Drehstrom-Brückengleichrichter (sechs Pulse, f_p = ' + f(v.fp3, 0) + ' Hz). Wie ändert sich der Siebfaktor?', short: 'Die Wirkung der höheren Pulsfrequenz ist richtig beurteilt', right: 'drei',
        options: [
          { value: 'gleich', label: 'Er bleibt gleich, weil R und C gleich bleiben', grund: 'Der Blindwiderstand hängt von der Frequenz ab: Bei ' + f(v.fp3, 0) + ' Hz ist X_C nur noch ' + f(v.xc3, 3) + ' Ω. Der Siebfaktor steigt auf etwa ' + f(v.s3, 1) + '.' },
          { value: 'drittel', label: 'Er sinkt auf ein Drittel, weil die Frequenz steigt', grund: 'Höhere Frequenz heißt kleinerer Blindwiderstand, der Kondensator schließt die Brummspannung besser kurz. Der Siebfaktor steigt auf etwa ' + f(v.s3, 1) + '.' },
          { value: 'drei', label: 'Er wird etwa dreimal so groß, X_C sinkt', grund: 'X_C sinkt von ' + f(v.xc, 3) + ' Ω auf ' + f(v.xc3, 3) + ' Ω, der Siebfaktor steigt von ' + f(v.s, 2) + ' auf ' + f(v.s3, 1) + ', also etwa auf das Dreifache.' },
          { value: 'neun', label: 'Er wird etwa neunmal so groß, Frequenz im Quadrat', grund: 'Im Quadrat geht die Frequenz beim LC-Siebglied ein. Beim RC-Glied steigt S etwa linear mit der Frequenz: von ' + f(v.s, 2) + ' auf ' + f(v.s3, 1) + '.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'xc'), rXc(), 'Der Blindwiderstand X_C bei der Pulsfrequenz ist richtig berechnet', 3);
      numRow(r, rawOf(a, 's'), rS(), 'Der Siebfaktor S ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ubr2'), rU(), 'Die Brummspannung hinter dem Siebglied ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'du'), rDu(), 'Der Gleichspannungsverlust am Siebwiderstand ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Hinter einem Brückengleichrichter am 50-Hz-Netz (Pulsfrequenz f_p = ' + f(G.fp, 0) + ' Hz) liegt am Ladekondensator eine Brummspannung U_Br1 = ' + f(G.ubr, 1) + ' V (Spitze–Spitze). Ein RC-Siebglied mit R = ' + f(G.r, 0) + ' Ω und einem Kondensator C = ' + f(G.c * 1e6, 0) + ' µF soll sie verkleinern; der Laststrom beträgt ' + f(G.il * 1e3, 0) + ' mA (Übungswerte). Berechne den Blindwiderstand X_C, den Siebfaktor S, die Brummspannung U_Br2 hinter dem Siebglied und den Gleichspannungsverlust am Widerstand. Im Prüfstand „' + rname('gleich') + '“ kannst du ein RC-Glied hinter den Ladekondensator schalten.',
      fields: () => [{ key: 'xc', label: 'Blindwiderstand X_C', unit: 'Ω' }, { key: 's', label: 'Siebfaktor S', unit: '' }, { key: 'ubr2', label: 'Brummspannung U_Br2', unit: 'mV' }, { key: 'du', label: 'Gleichspannungsverlust am Widerstand', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Das Siebglied ist ein Spannungsteiler aus R und dem Kondensator: X_C = 1 / (2π · f_p · C). Der Siebfaktor ist S = U_Br1 / U_Br2 = √(R² + X_C²) / X_C, für R viel größer als X_C ungefähr ω · R · C. Der Gleichstrom fließt durch R und erzeugt dort einen Spannungsfall.',
        'X_C = 1 / (2π · ' + f(v.fp, 0) + ' Hz · ' + f(v.c, 0) + ' µF) = ' + f(v.xc, 3) + ' Ω. Für S teilst du √(' + f(v.r, 0) + '² + X_C²) durch X_C. U_Br2 = ' + f(v.ubr, 1) + ' V / S, ΔU = ' + f(v.il, 2) + ' A · ' + f(v.r, 0) + ' Ω.',
        'Musterlösung: X_C = ' + f(v.xc, 3) + ' Ω, S = ' + f(v.s, 2) + ' (Näherung ω · R · C = ' + f(v.sNah, 2) + '), U_Br2 = ' + f(v.ubr2, 1) + ' mV, ΔU = ' + f(v.du, 1) + ' V.'
      ]; },
      start: () => A('gleich', GLEICH(), { fields: { xc: null, s: null, ubr2: null, du: null }, choices: {} }),
      sol: () => { const v = vals(); return A('gleich', Object.assign(GLEICH(), { rsieb: true }), { fields: { xc: v.xc, s: v.s, ubr2: v.ubr2, du: v.du }, choices: rightOf(specs()), value: v.s }); },
      wrong: () => { const v = vals(); return [
        { name: 'Mit 50 Hz gerechnet, Siebfaktor bleibt gleich', answer: A('gleich', {}, { fields: { xc: v.xc50, s: v.s50, ubr2: G.ubr / v.s50 * 1e3, du: v.du }, choices: { drei: 'gleich' } }) },
        { name: 'Brumm mit S multipliziert, Spannungsfall an X_C, Frequenz im Quadrat', answer: A('gleich', {}, { fields: { xc: v.xc, s: v.s, ubr2: v.ubrMal * 1e3, du: G.il * v.xc }, choices: { drei: 'neun' } }) }]; } };
  })();

  /* ====================================================================== nt43: LC-Siebglied, Induktivitaet bestimmen (Lernfeld 5.3, Siebung) */ /* PRUEFEN P11: S = ω² · L · C − 1 (unbelastetes LC-Glied); die Näherung S ≈ ω² · L · C der Mitschrift wird ebenfalls angenommen; Drosselwiderstand 1,5 Ω ist ein Übungswert */
  const M43 = (() => {
    const G = { c: 1e-3, s: 40, fp: 100, il: 0.5, rl: 1.5 };
    const vals = () => once('v43', () => { const w = 2 * Math.PI * G.fp, w2 = w * w, l = (G.s + 1) / (w2 * G.c), xc = 1 / (w * G.c), rrc = xc * Math.sqrt(G.s * G.s - 1);
      return { c: G.c * 1e6, s: G.s, s1: G.s + 1, fp: G.fp, w, w2, l: l * 1e3, lNah: G.s / (w2 * G.c) * 1e3, il: G.il, rl: G.rl, dul: G.il * G.rl, xc, rrc, durc: G.il * rrc, lOhneQuadrat: (G.s + 1) / (w * G.c) * 1e3 }; });
    const rL = () => once('r43a', () => { const v = vals(); return own(v.l * 1e-3, 'H', { factor: 1e-3, alts: [v.lNah * 1e-3], wrongs: [{ v: v.lOhneQuadrat * 1e-3, text: 'Du hast ω nicht quadriert. Beim LC-Siebglied gilt S + 1 = ω² · L · C, die Frequenz geht im Quadrat ein.' }] }); });
    const rR = () => once('r43b', () => { const v = vals(); return own(v.rrc, 'Ω', { alts: [G.s * v.xc], wrongs: [{ v: v.xc, text: 'Das ist der Blindwiderstand des Kondensators. Für den Siebfaktor ' + f(G.s, 0) + ' muss R etwa ' + f(G.s, 0) + '-mal so groß sein: R ≈ S · X_C.' }] }); });
    const rDu = () => once('r43c', () => { const v = vals(); return own(v.durc, 'V', { alts: [G.il * G.s * v.xc], wrongs: [{ v: v.dul, text: 'Das ist der Spannungsfall an der Drossel. Gefragt ist der Spannungsfall am Widerstand des RC-Glieds mit demselben Siebfaktor.' }] }); });
    const specs = () => once('sp43', () => { const v = vals(); return [
      { key: 'wahl', q: 'Warum nimmt man bei großen Lastströmen eher ein LC-Siebglied als ein RC-Siebglied?', short: 'Der Vorteil des LC-Siebglieds ist richtig benannt', right: 'klein',
        options: [
          { value: 'billig', label: 'Die Drossel ist kleiner und billiger als ein Widerstand', grund: 'Eine Drossel für große Ströme ist groß, schwer und teurer als ein Widerstand. Der Vorteil der Drossel ist der kleine Gleichstromwiderstand: ' + f(v.dul, 2) + ' V Verlust statt ' + f(v.durc, 1) + ' V.' },
          { value: 'klein', label: 'Die Drossel hat nur einen kleinen Gleichstromverlust', grund: 'Für Gleichstrom wirkt nur der Drahtwiderstand der Drossel (' + f(v.rl, 1) + ' Ω, ' + f(v.dul, 2) + ' V Verlust). Das RC-Glied bräuchte für denselben Siebfaktor ' + f(v.rrc, 1) + ' Ω und verlöre ' + f(v.durc, 1) + ' V.' },
          { value: 'gleich', label: 'Beide verlieren gleich viel Gleichspannung', grund: 'Das RC-Glied mit demselben Siebfaktor verliert ' + f(v.durc, 1) + ' V, die Drossel nur ' + f(v.dul, 2) + ' V. Genau deshalb nimmt man bei großen Strömen das LC-Glied.' },
          { value: 'frequenz', label: 'Die Drossel macht aus 100 Hz eine höhere Frequenz', grund: 'Eine Drossel ändert die Frequenz nicht. Die Drossel hat für Wechselstrom einen großen Blindwiderstand, für Gleichstrom aber nur ihren kleinen Drahtwiderstand (' + f(v.rl, 1) + ' Ω).' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'l'), rL(), 'Die Induktivität L der Drossel ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'r'), rR(), 'Der Widerstand eines RC-Glieds mit gleichem Siebfaktor ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'du'), rDu(), 'Der Gleichspannungsverlust des RC-Glieds ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein LC-Siebglied hinter einem Brückengleichrichter (Pulsfrequenz f_p = ' + f(G.fp, 0) + ' Hz) soll den Siebfaktor S = ' + f(G.s, 0) + ' erreichen; der Kondensator hat C = ' + f(G.c * 1e6, 0) + ' µF. Berechne die Induktivität L der Drossel (S = ω² · L · C − 1). Vergleiche dann mit einem RC-Siebglied: Welcher Widerstand R ergibt mit demselben Kondensator denselben Siebfaktor, und wie viel Gleichspannung verliert er bei ' + f(G.il * 1e3, 0) + ' mA Laststrom? Die Drossel hat einen Drahtwiderstand von ' + f(G.rl, 1) + ' Ω (Übungswerte). Im Prüfstand „' + rname('gleich') + '“ kannst du zum Vergleich das RC-Glied einschalten.',
      fields: () => [{ key: 'l', label: 'Induktivität L', unit: 'mH' }, { key: 'r', label: 'Widerstand R des RC-Glieds', unit: 'Ω' }, { key: 'du', label: 'Gleichspannungsverlust des RC-Glieds', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Beim LC-Siebglied gilt S = ω² · L · C − 1, also L = (S + 1) / (ω² · C) mit ω = 2π · f_p. Beim RC-Glied ist S = √(R² + X_C²) / X_C, für große S ungefähr R / X_C. Der Gleichstrom erzeugt am Widerstand einen Spannungsfall I · R.',
        'ω = 2π · ' + f(v.fp, 0) + ' Hz = ' + f(v.w, 1) + ' 1/s, ω² = ' + f(v.w2, 0) + ' 1/s². L = ' + f(v.s1, 0) + ' / (ω² · ' + f(v.c, 0) + ' µF). X_C = 1 / (ω · C) = ' + f(v.xc, 3) + ' Ω, R ≈ ' + f(v.s, 0) + ' · X_C.',
        'Musterlösung: L = ' + f(v.l, 1) + ' mH (Näherung ohne − 1: ' + f(v.lNah, 1) + ' mH). RC-Glied: R = ' + f(v.rrc, 1) + ' Ω, ΔU = ' + f(v.il, 1) + ' A · ' + f(v.rrc, 1) + ' Ω = ' + f(v.durc, 1) + ' V; an der Drossel nur ' + f(v.dul, 2) + ' V.'
      ]; },
      start: () => A('gleich', GLEICH(), { fields: { l: null, r: null, du: null }, choices: {} }),
      sol: () => { const v = vals(); return A('gleich', GLEICH(), { fields: { l: v.l, r: v.rrc, du: v.durc }, choices: rightOf(specs()), value: v.l }); },
      wrong: () => { const v = vals(); return [
        { name: 'ω nicht quadriert, R gleich X_C, Drossel billiger', answer: A('gleich', {}, { fields: { l: v.lOhneQuadrat, r: v.xc, du: G.il * v.xc }, choices: { wahl: 'billig' } }) },
        { name: 'Spannungsfall der Drossel für das RC-Glied, gleicher Verlust', answer: A('gleich', {}, { fields: { l: v.l, r: v.rrc, du: v.dul }, choices: { wahl: 'gleich' } }) }]; } };
  })();

  /* ====================================================================== nt44: Laengstransistor mit Z-Diode auslegen (Lernfeld 9.2, Reihenstabilisierung) */ /* PRUEFEN P12: Z-Strom 10 mA im Betrieb, B = 50 und U_BE = 0,7 V sind Aufgabenwerte; Leerlauf und Kurzschluss als Grenzfälle wie im Unterricht */
  const M44 = (() => {
    const G = { u1: 20, uz: 10, il: 1, b: 50, iz: 0.01 };
    const CTL = () => ({ art: 'zener', ue: G.u1, uz: G.uz, rv: 330, rlast: 1000, kurz: false });
    const vals = () => once('v44', () => { const ube = lv('ube'), ua = G.uz - ube, ib = G.il / G.b, irv = ib + G.iz, rv = (G.u1 - G.uz) / irv, uce = G.u1 - ua, pv = uce * G.il, izl = irv, pzl = G.uz * izl, ibk = (G.u1 - ube) / rv, ick = G.b * ibk, pk = G.u1 * ick;
      return { u1: G.u1, uz: G.uz, ube, ua, il: G.il, b: G.b, ib: ib * 1e3, iz: G.iz * 1e3, irv: irv * 1e3, rv, uce, pv, izl: izl * 1e3, pzl: pzl * 1e3, ibk: ibk * 1e3, ick, pk, rvOhneIb: (G.u1 - G.uz) / G.iz, pvOhneUbe: (G.u1 - G.uz) * G.il }; });
    const rUa = () => once('r44a', () => { const v = vals(); return own(v.ua, 'V', { wrongs: [{ v: G.uz, text: 'Du hast U_BE vergessen. Der Emitter liegt um U_BE = ' + f(v.ube, 1) + ' V unter der Basis: U_A = U_Z − U_BE.' }] }); });
    const rRv = () => once('r44b', () => { const v = vals(); return own(v.rv, 'Ω', { wrongs: [{ v: v.rvOhneIb, text: 'Du hast den Basisstrom vergessen. Durch R_V fließen Z-Strom und Basisstrom zusammen (' + mAf(v.irv) + ').' }, { v: (G.u1 - G.uz) / (v.ib / 1e3), text: 'Du hast nur mit dem Basisstrom gerechnet. Die Z-Diode braucht zusätzlich ihren Betriebsstrom von ' + f(v.iz, 0) + ' mA.' }] }); });
    const rPv = () => once('r44c', () => { const v = vals(); return own(v.pv, 'W', { wrongs: [{ v: v.pvOhneUbe, text: 'Du hast mit U_1 − U_Z gerechnet. Am Transistor liegt U_CE = U_1 − U_A, und U_A ist um U_BE kleiner als U_Z.' }, { v: G.u1 * G.il, text: 'Das ist die aufgenommene Leistung. Im Transistor bleibt nur U_CE · I_L.' }] }); });
    const specs0 = () => once('sp44', () => { const v = vals(); return [
      { key: 'leer', q: 'Die Last wird abgeklemmt (Leerlauf). Was geschieht?', short: 'Der Leerlauf ist richtig beurteilt', right: 'zdiode',
        options: [
          { value: 'trans', label: 'Der Transistor wird heiß, weil er den ganzen Strom führt', grund: 'Ohne Last fließt kein Kollektorstrom, der Transistor ist entlastet. Der Basisstrom fällt weg, und sein Anteil geht zusätzlich durch die Z-Diode (' + mAf(v.izl) + ').' },
          { value: 'zdiode', label: 'Die Z-Diode übernimmt den ganzen Strom durch R_V', grund: 'Ohne Last braucht der Transistor keinen Basisstrom. Der ganze Strom ' + mAf(v.irv) + ' fließt durch die Z-Diode, P_Z = ' + f(v.pzl, 0) + ' mW. Die Z-Diode muss dafür ausgelegt sein.' },
          { value: 'nichts', label: 'Nichts ändert sich, alle Ströme bleiben gleich', grund: 'Der Basisstrom fällt weg (' + mAf(v.ib) + '), dafür steigt der Z-Strom von ' + mAf(v.iz) + ' auf ' + mAf(v.izl) + '.' },
          { value: 'ua', label: 'Die Ausgangsspannung steigt auf U_1', grund: 'Die Ausgangsspannung bleibt durch die Z-Diode etwa bei ' + f(v.ua, 1) + ' V. Die Änderung trifft die Z-Diode: Die Z-Diode führt jetzt ' + mAf(v.izl) + '.' }] },
      { key: 'kurz', q: 'Der Ausgang wird kurzgeschlossen (ohne Strombegrenzung). Was geschieht?', short: 'Der Kurzschluss ist richtig beurteilt', right: 'ueber',
        options: [
          { value: 'zd', label: 'Die Z-Diode brennt durch, der Transistor bleibt heil', grund: 'Die Z-Diode wird eher entlastet, weil der Basisstrom steigt. Belastet wird der Transistor: An ihm liegen ' + f(v.u1, 0) + ' V bei einem Strom von bis zu ' + f(v.ick, 1) + ' A.' },
          { value: 'aus', label: 'Die Schaltung schaltet sich von selbst ab, nichts passiert', grund: 'Ohne Strombegrenzung gibt es keine Abschaltung. Der Basisstrom steigt auf ' + mAf(v.ibk) + ', der Kollektorstrom auf etwa ' + f(v.ick, 1) + ' A.' },
          { value: 'ueber', label: 'Der Transistor wird überlastet, er braucht Strombegrenzung', grund: 'Bei U_A = 0 liegt die ganze Eingangsspannung ' + f(v.u1, 0) + ' V am Transistor, der Kollektorstrom steigt auf etwa B · I_B = ' + f(v.ick, 1) + ' A. Das wären rund ' + f(v.pk, 0) + ' W: Ohne Strombegrenzung wird er zerstört.' },
          { value: 'ua', label: 'Der Strom bleibt bei ' + f(v.il, 0) + ' A, weil die Z-Diode regelt', grund: 'Die Z-Diode regelt die Spannung, nicht den Strom. Im Kurzschluss bestimmt nur noch der Basisstrom (' + mAf(v.ibk) + ') den Kollektorstrom.' }] }]; });
    const specs = () => once('rot44', () => rot(specs0(), [0, 0]));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ua'), rUa(), 'Die Ausgangsspannung U_A ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'rv'), rRv(), 'Der Vorwiderstand R_V ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'pv'), rPv(), 'Die Verlustleistung des Längstransistors ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Stabilisierung mit Längstransistor (Emitterfolger) wird aus U_1 = ' + f(G.u1, 0) + ' V gespeist. Die Basis liegt an einer Z-Diode mit U_Z = ' + f(G.uz, 0) + ' V, die über R_V versorgt wird. Die Last zieht I_L = ' + f(G.il, 0) + ' A, der Transistor hat B = ' + f(G.b, 0) + ', U_BE = ' + f(lv('ube'), 1) + ' V; die Z-Diode soll im Betrieb ' + f(G.iz * 1e3, 0) + ' mA führen (Aufgabenwerte). Berechne die Ausgangsspannung U_A, den Vorwiderstand R_V und die Verlustleistung im Transistor. Beurteile dann Leerlauf und Kurzschluss. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) kannst du die Z-Stufe allein untersuchen.',
      fields: () => [{ key: 'ua', label: 'Ausgangsspannung U_A', unit: 'V' }, { key: 'rv', label: 'Vorwiderstand R_V', unit: 'Ω' }, { key: 'pv', label: 'Verlustleistung im Transistor', unit: 'W' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Transistor arbeitet als Emitterfolger: Der Emitter liegt um U_BE unter der Basis, also U_A = U_Z − U_BE. Der Basisstrom ist I_B = I_L / B; durch R_V fließen I_B und der Z-Strom. Am Transistor liegt U_CE = U_1 − U_A.',
        'U_A = ' + f(v.uz, 0) + ' V − ' + f(v.ube, 1) + ' V. I_B = ' + f(v.il, 0) + ' A / ' + f(v.b, 0) + ' = ' + f(v.ib, 0) + ' mA, dazu ' + f(v.iz, 0) + ' mA: R_V = (' + f(v.u1, 0) + ' V − ' + f(v.uz, 0) + ' V) / ' + f(v.irv, 0) + ' mA. P_V = U_CE · I_L.',
        'Musterlösung: U_A = ' + f(v.ua, 1) + ' V, R_V = ' + f(v.rv, 1) + ' Ω, U_CE = ' + f(v.uce, 1) + ' V, P_V = ' + f(v.pv, 1) + ' W. Leerlauf: Die Z-Diode führt ' + f(v.izl, 0) + ' mA. Kurzschluss: etwa ' + f(v.ick, 1) + ' A am Transistor, Strombegrenzung nötig.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { ua: null, rv: null, pv: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', CTL(), { fields: { ua: v.ua, rv: v.rv, pv: v.pv }, choices: rightOf(specs()), value: v.pv }); },
      wrong: () => { const v = vals(); return [
        { name: 'U_BE vergessen, Basisstrom vergessen, Transistor im Leerlauf heiß', answer: A('stabil', {}, { fields: { ua: G.uz, rv: v.rvOhneIb, pv: v.pvOhneUbe }, choices: { leer: 'trans', kurz: 'zd' } }) },
        { name: 'Aufgenommene Leistung statt Verlust, nichts ändert sich', answer: A('stabil', {}, { fields: { ua: v.ua, rv: v.rv, pv: G.u1 * G.il }, choices: { leer: 'nichts', kurz: 'aus' } }) }]; } };
  })();

  /* ====================================================================== nt45: LM317 mit Einstellbereich (Lernfeld 9.2, einstellbarer Spannungsregler) */ /* PRUEFEN P13: Dropout 2 V und Adjust-Strom 50 µA sind die Übungswerte des Labs; der Bereich 3 bis 12 V ist eigen */
  const M45 = (() => {
    const G = { r1: 240, umin: 3, umax: 12 };
    const CTL = () => ({ art: 'lm317', ue: 14, iLast: 0.3, r1: 240, r2: 970 });
    const vals = () => once('v45', () => { const ur = lv('uref_317'), drop = lv('dropout_317'), iadj = lv('iadj_317'), r2min = G.r1 * (G.umin / ur - 1), r2max = G.r1 * (G.umax / ur - 1), poti = r2max - r2min;
      return { r1: G.r1, umin: G.umin, umax: G.umax, ur, drop, iadj: iadj * 1e6, r2min, r2max, poti, uemin: G.umax + drop, uadj: G.umax + iadj * r2max, dadj: iadj * r2max * 1e3, ir1: ur / G.r1 * 1e3, r2minFalsch: G.r1 * G.umin / ur, r2maxFalsch: G.r1 * G.umax / ur, umin0: ur }; });
    const rMin = () => once('r45a', () => { const v = vals(); return own(v.r2min, 'Ω', { wrongs: [{ v: v.r2minFalsch, text: 'Du hast die Eins vergessen. Aus U = U_ref · (1 + R_2 / R_1) folgt R_2 = R_1 · (U / U_ref − 1).' }] }); });
    const rMax = () => once('r45b', () => { const v = vals(); return own(v.r2max, 'Ω', { wrongs: [{ v: v.r2maxFalsch, text: 'Du hast die Eins vergessen: R_2 = R_1 · (U / U_ref − 1).' }, { v: v.poti, text: 'Das ist die Änderung von R_2 über den Bereich. Gefragt ist der ganze Widerstand R_2 bei ' + f(G.umax, 0) + ' V.' }] }); });
    const rUe = () => once('r45c', () => { const v = vals(); return own(v.uemin, 'V', { wrongs: [{ v: G.umax, text: 'Der Regler braucht einen Mindest-Spannungsabfall (Dropout, hier ' + f(v.drop, 0) + ' V): U_E muss um diesen Betrag über der höchsten Ausgangsspannung liegen.' }, { v: G.umin + v.drop, text: 'Du hast mit der kleinsten Ausgangsspannung gerechnet. Die Eingangsspannung muss auch für ' + f(G.umax, 0) + ' V reichen.' }] }); });
    const rUa = () => once('r45d', () => { const v = vals(); return own(v.dadj * 1e-3, 'V', { factor: 1e-3, wrongs: [{ v: v.iadj * 1e-6 * v.r2min, text: 'Du hast mit R_2,min gerechnet. Gefragt ist die größte Ausgangsspannung, also R_2,max = ' + f(v.r2max, 0) + ' Ω.' }, { v: v.iadj * 1e-6 * G.r1, text: 'Du hast mit R_1 gerechnet. Der Adjust-Strom fließt aus dem ADJ-Anschluss durch R_2 nach Masse: ΔU = I_adj · R_2.' }] }); });
    const specs = () => once('sp45', () => { const v = vals(); return [
      { key: 'r0', q: 'Das Poti für R_2 wird ohne Festwiderstand eingesetzt und auf 0 Ω gedreht. Welche Ausgangsspannung entsteht?', short: 'Die Ausgangsspannung bei R_2 = 0 ist richtig bestimmt', right: 'uref',
        options: [
          { value: 'null', label: '0 V, der Ausgang ist abgeschaltet', grund: 'Der LM317 hält immer U_ref zwischen Ausgang und ADJ. Bei R_2 = 0 liegt ADJ auf Masse, der Ausgang also bei ' + f(v.ur, 2) + ' V.' },
          { value: 'uref', label: f(v.ur, 2) + ' V, die Referenzspannung', grund: 'Mit R_2 = 0 wird U = U_ref · (1 + 0) = ' + f(v.ur, 2) + ' V. Deshalb setzt man einen Festwiderstand R_2,min = ' + f(v.r2min, 0) + ' Ω in Reihe, damit der Bereich bei ' + f(G.umin, 0) + ' V beginnt.' },
          { value: 'ue', label: 'Die volle Eingangsspannung', grund: 'Der Regler bleibt in Betrieb und hält U_ref = ' + f(v.ur, 2) + ' V zwischen Ausgang und ADJ. Die Eingangsspannung erscheint nicht am Ausgang, der Rest fällt am Regler ab.' },
          { value: 'min', label: f(G.umin, 0) + ' V, der untere Bereichswert', grund: 'Die ' + f(G.umin, 0) + ' V gibt es nur mit dem Festwiderstand ' + f(v.r2min, 0) + ' Ω in Reihe zum Poti. Ohne ihn sinkt die Spannung auf ' + f(v.ur, 2) + ' V.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'r2min'), rMin(), 'R_2 für die kleinste Ausgangsspannung ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'r2max'), rMax(), 'R_2 für die größte Ausgangsspannung ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'uemin'), rUe(), 'Die kleinste Eingangsspannung ist richtig bestimmt', 1);
      numRow(r, rawOf(a, 'dadj'), rUa(), 'Die Anhebung durch den Adjust-Strom ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein LM317 (U_ref = ' + f(lv('uref_317'), 2) + ' V) soll mit R_1 = ' + f(G.r1, 0) + ' Ω eine Ausgangsspannung von ' + f(G.umin, 0) + ' V bis ' + f(G.umax, 0) + ' V liefern. Berechne R_2 für beide Enden des Bereichs und die kleinste Eingangsspannung (Dropout ' + f(lv('dropout_317'), 0) + ' V, Übungswert). Berechne dann, um wie viel die größte Ausgangsspannung steigt, wenn der Adjust-Strom I_adj = ' + f(lv('iadj_317') * 1e6, 0) + ' µA durch R_2 mitfließt. Im Prüfstand „' + rname('stabil') + '“ (LM317) kannst du R_1 und R_2 einstellen.',
      fields: () => [{ key: 'r2min', label: 'R_2 für ' + f(G.umin, 0) + ' V', unit: 'Ω' }, { key: 'r2max', label: 'R_2 für ' + f(G.umax, 0) + ' V', unit: 'Ω' }, { key: 'uemin', label: 'Kleinste Eingangsspannung', unit: 'V' }, { key: 'dadj', label: 'Anhebung der größten Spannung durch den Adjust-Strom', unit: 'mV' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der LM317 hält U_ref zwischen Ausgang und ADJ. Mit dem Teiler gilt U = U_ref · (1 + R_2 / R_1), umgestellt R_2 = R_1 · (U / U_ref − 1). Die Eingangsspannung muss um den Dropout über der höchsten Ausgangsspannung liegen. Der Adjust-Strom erzeugt an R_2 zusätzlich I_adj · R_2.',
        'R_2 = ' + f(v.r1, 0) + ' Ω · (' + f(v.umin, 0) + ' V / ' + f(v.ur, 2) + ' V − 1) und ' + f(v.r1, 0) + ' Ω · (' + f(v.umax, 0) + ' V / ' + f(v.ur, 2) + ' V − 1). U_E,min = ' + f(v.umax, 0) + ' V + ' + f(v.drop, 0) + ' V. Mit Adjust-Strom: ' + f(v.iadj, 0) + ' µA · R_2,max dazuzählen.',
        'Musterlösung: R_2 = ' + f(v.r2min, 0) + ' Ω bis ' + f(v.r2max, 0) + ' Ω (Poti ' + f(v.poti, 0) + ' Ω mit ' + f(v.r2min, 0) + ' Ω in Reihe), U_E,min = ' + f(v.uemin, 0) + ' V, U_max = ' + f(v.uadj, 3) + ' V (' + f(v.dadj, 0) + ' mV durch den Adjust-Strom).'
      ]; },
      start: () => A('stabil', CTL(), { fields: { r2min: null, r2max: null, uemin: null, dadj: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', Object.assign(CTL(), { r2: Math.round(v.r2max) }), { fields: { r2min: v.r2min, r2max: v.r2max, uemin: v.uemin, dadj: v.dadj }, choices: rightOf(specs()), value: v.r2max }); },
      wrong: () => { const v = vals(); return [
        { name: 'Eins vergessen, ohne Dropout, ohne Adjust-Strom', answer: A('stabil', {}, { fields: { r2min: v.r2minFalsch, r2max: v.r2maxFalsch, uemin: G.umax, dadj: v.iadj * 1e-3 * v.r2min }, choices: { r0: 'null' } }) },
        { name: 'Änderung als R_2,max, Dropout zur kleinsten Spannung, unterer Bereichswert', answer: A('stabil', {}, { fields: { r2min: v.r2min, r2max: v.poti, uemin: G.umin + v.drop, dadj: v.dadj }, choices: { r0: 'min' } }) }]; } };
  })();

  /* ====================================================================== nt46: Z-Diode, Kennwerte aus der Typbezeichnung (Lernfeld 9.2, Z-Diode: Datenblatt) */ /* PRUEFEN P14: Faustregel I_Z,min ≈ 0,1 · I_Z,max wie in der Mitschrift; das Lab rechnet sonst mit I_Z,min = 5 mA (Übungswert). Kennbuchstabe C = ±5 % */
  const M46 = (() => {
    const G = { uz: 6.8, tol: 0.05, ptot: 0.5 };
    const CTL = () => ({ art: 'zener', ue: 12, uz: 6.8, rv: 470, rlast: 4700, kurz: false });
    const vals = () => once('v46', () => { const izmax = G.ptot / G.uz; return { uz: G.uz, tol: G.tol * 100, ptot: G.ptot * 1e3, uzmin: G.uz * (1 - G.tol), uzmax: G.uz * (1 + G.tol), izmax: izmax * 1e3, izmin: izmax * 100, zehn: 10, malU: G.ptot * G.uz * 1e3, labMin: lv('iz_min') * 1e3 }; });
    const rUmin = () => once('r46a', () => { const v = vals(); return own(v.uzmin, 'V', { wrongs: [{ v: G.uz * 0.9, text: 'Du hast mit ±10 % gerechnet. Der Kennbuchstabe C steht für ±5 %.' }, { v: G.uz * 0.98, text: 'Du hast mit ±2 % gerechnet (Kennbuchstabe B). C steht für ±5 %.' }] }); });
    const rUmax = () => once('r46b', () => { const v = vals(); return own(v.uzmax, 'V', { wrongs: [{ v: G.uz * 1.1, text: 'Du hast mit ±10 % gerechnet. Der Kennbuchstabe C steht für ±5 %.' }] }); });
    const rImax = () => once('r46c', () => { const v = vals(); return own(v.izmax * 1e-3, 'A', { factor: 1e-3, wrongs: [{ v: v.malU * 1e-3, text: 'Du hast P_tot · U_Z gerechnet. Aus P = U · I folgt I_Z,max = P_tot / U_Z.' }] }); });
    const rImin = () => once('r46d', () => { const v = vals(); return own(v.izmin * 1e-3, 'A', { factor: 1e-3, wrongs: [{ v: v.izmax * 1e-3, text: 'Das ist I_Z,max. Nach der Faustregel ist der kleinste Z-Strom etwa ein Zehntel davon.' }] }); });
    const specs = () => once('sp46', () => { const v = vals(); return [
      { key: 'v', q: 'Wofür steht das V in der Kennzeichnung 6V8?', short: 'Die Bedeutung des V ist richtig erkannt', right: 'komma',
        options: [
          { value: 'volt', label: 'Für die Einheit Volt hinter der Zahl 6', grund: 'Dann stünde dort 6 V und eine 8 ohne Bedeutung. Das V ersetzt das Komma: 6V8 heißt ' + f(v.uz, 1) + ' V; so geht beim Druck kein Komma verloren.' },
          { value: 'komma', label: 'Für das Komma: 6V8 bedeutet ' + f(v.uz, 1) + ' V', grund: 'Das V steht an der Stelle des Kommas, wie bei Widerständen das R oder k (4k7). 6V8 bedeutet U_Z = ' + f(v.uz, 1) + ' V.' },
          { value: 'reihe', label: 'Für die Bauform V (bedrahtet)', grund: 'Die Bauform steht im Typnamen oder Gehäuse, nicht in der Spannungsangabe. Das V ersetzt das Komma: ' + f(v.uz, 1) + ' V.' },
          { value: 'max', label: 'Für die größte Sperrspannung von 68 V', grund: 'Die Zahl bezeichnet die Z-Spannung, und das V ist ein Komma: ' + f(v.uz, 1) + ' V, nicht 68 V.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'uzmin'), rUmin(), 'Die kleinste Z-Spannung nach Toleranz ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'uzmax'), rUmax(), 'Die größte Z-Spannung nach Toleranz ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'izmax'), rImax(), 'Der größte Z-Strom I_Z,max ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'izmin'), rImin(), 'Der kleinste Z-Strom nach der Faustregel ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [0.1, 0.05, 4.7, 68, 6, 8],
      text: () => 'Auf einer Z-Diode steht die Kennzeichnung C6V8, im Datenblatt die zulässige Verlustleistung P_tot = ' + f(G.ptot * 1e3, 0) + ' mW (Aufgabenwerte). Der Kennbuchstabe C bedeutet eine Toleranz von ±5 %. Berechne den Bereich, in dem die Z-Spannung liegen darf, den größten zulässigen Z-Strom und den kleinsten Z-Strom nach der Faustregel I_Z,min ≈ 0,1 · I_Z,max. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) ist eine solche Diode eingestellt.',
      fields: () => [{ key: 'uzmin', label: 'Kleinste Z-Spannung', unit: 'V' }, { key: 'uzmax', label: 'Größte Z-Spannung', unit: 'V' }, { key: 'izmax', label: 'Größter Z-Strom I_Z,max', unit: 'mA' }, { key: 'izmin', label: 'Kleinster Z-Strom I_Z,min (Faustregel)', unit: 'mA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'In der Kennzeichnung steht das V an der Stelle des Kommas. Die Toleranz gilt nach oben und unten. Aus der zulässigen Leistung folgt I_Z,max = P_tot / U_Z; nach der Faustregel ist I_Z,min etwa ein Zehntel davon.',
        'Toleranz: ' + f(v.uz, 1) + ' V · (1 ± 0,05). I_Z,max = ' + f(v.ptot, 0) + ' mW / ' + f(v.uz, 1) + ' V, I_Z,min = I_Z,max / ' + f(v.zehn, 0) + '.',
        'Musterlösung: U_Z = ' + f(v.uzmin, 2) + ' V bis ' + f(v.uzmax, 2) + ' V, I_Z,max = ' + f(v.izmax, 1) + ' mA, I_Z,min ≈ ' + f(v.izmin, 2) + ' mA. Das Lab rechnet in anderen Aufgaben mit I_Z,min = ' + f(v.labMin, 0) + ' mA als Übungswert.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { uzmin: null, uzmax: null, izmax: null, izmin: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', CTL(), { fields: { uzmin: v.uzmin, uzmax: v.uzmax, izmax: v.izmax, izmin: v.izmin }, choices: rightOf(specs()), value: v.izmax }); },
      wrong: () => { const v = vals(); return [
        { name: '±10 % statt ±5 %, Leistung mal Spannung, V als Volt', answer: A('stabil', {}, { fields: { uzmin: G.uz * 0.9, uzmax: G.uz * 1.1, izmax: v.malU, izmin: v.izmin }, choices: { v: 'volt' } }) },
        { name: '±2 %, I_Z,max als I_Z,min, Sperrspannung 68 V', answer: A('stabil', {}, { fields: { uzmin: G.uz * 0.98, uzmax: v.uzmax, izmax: v.izmax, izmin: v.izmax }, choices: { v: 'max' } }) }]; } };
  })();

  /* ====================================================================== nt47: Vorwiderstand fuer schwankende Spannung und Last (Lernfeld 9.2, Z-Diode: Arbeitsbereich) */ /* PRUEFEN P15: eigene Werte; R_V,max aus U_E,min und I_L,max, R_V,min aus U_E,max und I_L,min (neu gerechnet, die Zahl der Mitschrift wurde nicht übernommen); E12-Reihe */
  const M47 = (() => {
    const G = { uz: 5.1, ptot: 0.5, uemin: 10, uemax: 14, ilmin: 0.01, ilmax: 0.04 };
    const CTL = () => ({ art: 'zener', ue: 12, uz: 5.1, rv: 470, rlast: 4700, kurz: false });
    const vals = () => once('v47', () => { const izmin = lv('iz_min'), izmax = G.ptot / G.uz, rvmax = (G.uemin - G.uz) / (G.ilmax + izmin), rvmin = (G.uemax - G.uz) / (izmax + G.ilmin), iz82 = (G.uemax - G.uz) / 82 - G.ilmin, iz120 = (G.uemin - G.uz) / 120 - G.ilmax, iz100a = (G.uemax - G.uz) / 100 - G.ilmin, iz100b = (G.uemin - G.uz) / 100 - G.ilmax;
      return { uz: G.uz, ptot: G.ptot * 1e3, uemin: G.uemin, uemax: G.uemax, ilmin: G.ilmin * 1e3, ilmax: G.ilmax * 1e3, izmin: izmin * 1e3, izmax: izmax * 1e3, rvmax, rvmin, dmin: G.uemin - G.uz, dmax: G.uemax - G.uz, imax1: (G.ilmax + izmin) * 1e3, imin1: (izmax + G.ilmin) * 1e3,
        iz82: iz82 * 1e3, iz120: iz120 * 1e3, iz100a: iz100a * 1e3, iz100b: iz100b * 1e3, iz68: ((G.uemax - G.uz) / 68 - G.ilmin) * 1e3, rvmaxFalsch: (G.uemax - G.uz) / (G.ilmax + izmin), rvminFalsch: (G.uemin - G.uz) / (izmax + G.ilmin), rvmaxOhne: (G.uemin - G.uz) / G.ilmax }; });
    const rMax = () => once('r47a', () => { const v = vals(); return own(v.rvmax, 'Ω', { wrongs: [{ v: v.rvmaxFalsch, text: 'Du hast mit der höchsten Eingangsspannung gerechnet. Der größte Vorwiderstand muss auch im ungünstigsten Fall reichen: kleinste Eingangsspannung und größter Laststrom.' }, { v: v.rvmaxOhne, text: 'Du hast den kleinsten Z-Strom vergessen. Auch bei größter Last muss die Z-Diode noch I_Z,min = ' + f(v.izmin, 0) + ' mA führen.' }] }); });
    const rMin = () => once('r47b', () => { const v = vals(); return own(v.rvmin, 'Ω', { wrongs: [{ v: v.rvminFalsch, text: 'Du hast mit der kleinsten Eingangsspannung gerechnet. Die Z-Diode wird am stärksten belastet bei höchster Eingangsspannung und kleinstem Laststrom.' }] }); });
    const specs = () => once('sp47', () => { const v = vals(); return [
      { key: 'e12', q: 'Welcher Normwert der E12-Reihe (68 Ω, 82 Ω, 100 Ω, 120 Ω) erfüllt beide Grenzen?', short: 'Der Normwert für R_V ist richtig gewählt', right: '100',
        options: [
          { value: '82', label: '82 Ω', grund: 'Mit 82 Ω fließen bei ' + f(v.uemax, 0) + ' V und ' + f(v.ilmin, 0) + ' mA Last ' + f(v.iz82, 1) + ' mA durch die Z-Diode, mehr als I_Z,max = ' + f(v.izmax, 1) + ' mA. 82 Ω liegt knapp unter R_V,min = ' + f(v.rvmin, 1) + ' Ω.' },
          { value: '100', label: '100 Ω', grund: '100 Ω liegt zwischen ' + f(v.rvmin, 1) + ' Ω und ' + f(v.rvmax, 1) + ' Ω: Der Z-Strom bleibt zwischen ' + f(v.iz100b, 1) + ' mA und ' + f(v.iz100a, 1) + ' mA, also über I_Z,min und unter I_Z,max.' },
          { value: '120', label: '120 Ω', grund: 'Mit 120 Ω bleiben bei ' + f(v.uemin, 0) + ' V und ' + f(v.ilmax, 0) + ' mA Last nur ' + f(v.iz120, 2) + ' mA für die Z-Diode, weniger als I_Z,min = ' + f(v.izmin, 0) + ' mA: Die Z-Diode stabilisiert nicht mehr.' },
          { value: '68', label: '68 Ω', grund: 'Mit 68 Ω fließen im ungünstigsten Fall ' + f(v.iz68, 1) + ' mA durch die Z-Diode, deutlich mehr als I_Z,max = ' + f(v.izmax, 1) + ' mA.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'rvmax'), rMax(), 'Der größte zulässige Vorwiderstand R_V,max ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'rvmin'), rMin(), 'Der kleinste zulässige Vorwiderstand R_V,min ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [68, 82, 100, 120],
      text: () => 'Eine Z-Diode mit U_Z = ' + f(G.uz, 1) + ' V und P_tot = ' + f(G.ptot * 1e3, 0) + ' mW soll eine Last versorgen, deren Strom zwischen ' + f(G.ilmin * 1e3, 0) + ' mA und ' + f(G.ilmax * 1e3, 0) + ' mA schwankt. Die Eingangsspannung schwankt zwischen ' + f(G.uemin, 0) + ' V und ' + f(G.uemax, 0) + ' V; der kleinste Z-Strom ist I_Z,min = ' + f(lv('iz_min') * 1e3, 0) + ' mA (Übungswerte). Berechne den größten und den kleinsten zulässigen Vorwiderstand und wähle einen Normwert. Im Prüfstand „' + rname('stabil') + '“ (Z-Diode) kannst du die Grenzfälle mit Eingangsspannung und Last nachstellen.',
      fields: () => [{ key: 'rvmax', label: 'Größter Vorwiderstand R_V,max', unit: 'Ω' }, { key: 'rvmin', label: 'Kleinster Vorwiderstand R_V,min', unit: 'Ω' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Zwei ungünstigste Fälle: Damit die Z-Diode noch stabilisiert, muss bei kleinster Eingangsspannung und größtem Laststrom noch I_Z,min fließen (daraus R_V,max). Damit sie nicht überlastet wird, darf bei größter Eingangsspannung und kleinstem Laststrom höchstens I_Z,max = P_tot / U_Z fließen (daraus R_V,min).',
        'R_V,max = (' + f(v.uemin, 0) + ' V − ' + f(v.uz, 1) + ' V) / (' + f(v.ilmax, 0) + ' mA + ' + f(v.izmin, 0) + ' mA). I_Z,max = ' + f(v.ptot, 0) + ' mW / ' + f(v.uz, 1) + ' V = ' + f(v.izmax, 2) + ' mA. R_V,min = (' + f(v.uemax, 0) + ' V − ' + f(v.uz, 1) + ' V) / (' + f(v.izmax, 2) + ' mA + ' + f(v.ilmin, 0) + ' mA).',
        'Musterlösung: R_V,max = ' + f(v.dmin, 1) + ' V / ' + f(v.imax1, 0) + ' mA = ' + f(v.rvmax, 1) + ' Ω, R_V,min = ' + f(v.dmax, 1) + ' V / ' + f(v.imin1, 2) + ' mA = ' + f(v.rvmin, 1) + ' Ω. Normwert: 100 Ω.'
      ]; },
      start: () => A('stabil', CTL(), { fields: { rvmax: null, rvmin: null }, choices: {} }),
      sol: () => { const v = vals(); return A('stabil', Object.assign(CTL(), { rv: 100 }), { fields: { rvmax: v.rvmax, rvmin: v.rvmin }, choices: rightOf(specs()), value: v.rvmax }); },
      wrong: () => { const v = vals(); return [
        { name: 'Grenzfälle vertauscht, zu kleiner Normwert', answer: A('stabil', {}, { fields: { rvmax: v.rvmaxFalsch, rvmin: v.rvminFalsch }, choices: { e12: '82' } }) },
        { name: 'I_Z,min vergessen, zu großer Normwert', answer: A('stabil', {}, { fields: { rvmax: v.rvmaxOhne, rvmin: v.rvmin }, choices: { e12: '120' } }) }]; } };
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
    tk({ id: 'nt32', lab: 'nts', cat: 'Fehlersuche', title: 'Meisterstück: Das Netzteil des Kollegen', level: 3, rig: 'fehler' }, M32),
    tk({ id: 'nt33', lab: 'nts', cat: 'Z-Diode', title: 'Quer- und Längsstabilisierung', level: 1, rig: 'stabil' }, M33),
    tk({ id: 'nt34', lab: 'nts', cat: 'Z-Diode', title: 'Z-Diode bei schwankender Eingangsspannung', level: 2, rig: 'stabil' }, M34),
    tk({ id: 'nt35', lab: 'nts', cat: 'Z-Diode', title: 'Vorwiderstand für den Z-Strom', level: 2, rig: 'stabil' }, M35),
    tk({ id: 'nt36', lab: 'nts', cat: 'Z-Diode', title: 'Zener- und Lawinendurchbruch', level: 2, rig: 'stabil' }, M36),
    tk({ id: 'nt37', lab: 'nts', cat: 'Linearregler', title: 'Regelschaltung mit Referenz und Längstransistor', level: 3, rig: 'stabil' }, M37),
    tk({ id: 'nt38', lab: 'nts', cat: 'Z-Diode', title: 'Strom- und Lastbereich der Z-Diode-Stufe', level: 2, rig: 'stabil' }, M38),
    tk({ id: 'nt39', lab: 'nts', cat: 'Transformator', title: 'Windungszahlen aus den Spannungen', level: 1, rig: 'trafo' }, M39),
    tk({ id: 'nt40', lab: 'nts', cat: 'Transformator', title: 'Widerstandsübersetzung des Transformators', level: 2, rig: 'trafo' }, M40),
    tk({ id: 'nt41', lab: 'nts', cat: 'Gleichrichter', title: 'Mittelwert hinter der Brücke: 0,9 · U minus 2 · U_F', level: 2, rig: 'gleich' }, M41),
    tk({ id: 'nt42', lab: 'nts', cat: 'Gleichrichter', title: 'RC-Siebglied: Siebfaktor und Brummspannung', level: 2, rig: 'gleich' }, M42),
    tk({ id: 'nt43', lab: 'nts', cat: 'Gleichrichter', title: 'LC-Siebglied: Induktivität bestimmen', level: 3, rig: 'gleich' }, M43),
    tk({ id: 'nt44', lab: 'nts', cat: 'Linearregler', title: 'Längstransistor mit Z-Diode auslegen', level: 3, rig: 'stabil' }, M44),
    tk({ id: 'nt45', lab: 'nts', cat: 'Linearregler', title: 'LM317 mit Einstellbereich 3 bis 12 V', level: 2, rig: 'stabil' }, M45),
    tk({ id: 'nt46', lab: 'nts', cat: 'Z-Diode', title: 'Z-Diode: Kennwerte aus der Typbezeichnung', level: 1, rig: 'stabil' }, M46),
    tk({ id: 'nt47', lab: 'nts', cat: 'Z-Diode', title: 'Vorwiderstand für schwankende Spannung und Last', level: 3, rig: 'stabil' }, M47)
  ];
  const MODS = { nt17: M17, nt18: M18, nt19: M19, nt20: M20, nt21: M21, nt22: M22, nt23: M23, nt24: M24, nt25: M25, nt26: M26, nt27: M27, nt28: M28, nt29: M29, nt30: M30, nt31: M31, nt32: M32, nt33: M33, nt34: M34, nt35: M35, nt36: M36, nt37: M37, nt38: M38, nt39: M39, nt40: M40, nt41: M41, nt42: M42, nt43: M43, nt44: M44, nt45: M45, nt46: M46, nt47: M47 };
  /* Musterwerte der Aufgaben (Schwellen aus den Musterloesungen, SPEC 8: Schwellwerte aus der Musterloesung) */
  T.thresholds2 = function () { const o = {}; Object.keys(MODS).forEach(k => { try { o[k] = MODS[k].vals(); } catch (e) { o[k] = { error: String(e && e.message || e) }; } }); return o; };
  T.register(tasks);
  if (typeof module !== 'undefined') module.exports = { tasks };
})(typeof window !== 'undefined' ? window : globalThis);
