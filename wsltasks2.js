/* wsltasks2.js - WSL-Lab (Wechselstrom und Schwingkreise): Aufgaben ws17 bis ws32 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig) (WP4b)
 * Registrierung: WSL_TASKS.register([ ... ]) (WSL_TASKS kommt aus wsldata.js; wsldata.js VOR dieser Datei laden, in Node holt sich die Datei es per require).
 * Format wie SPEC 8 / elstasks2.js: { id:'wsN', lab:'wsl', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(),
 *   fields? | choices?, consts? }; answer = { rig, controls, ref, seq, rows, state, fired, value, text, fields, choices, clicks, bericht }.
 *   start() und sol() liefern { rig, controls, fields?, choices?, bericht? } (Startvorlage und Musterloesung / Auto-Weg); wrong() liefert mindestens zwei
 *   absichtlich falsche Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Diese Datei ist bewusst eigenstaendig: Sie braucht von wsldata.js nur register(); Hilfsfunktionen (Simulation, Zeilen, Zahlenpruefung) stehen unten.
 * Rechnen nur ueber WSL_CORE (exercise.solve, res, filter, trafo, three, rlc, comp, report, runSeq, limits); die Pruefstaende rechnen selbst nur ueber den Kern.
 * Schwellen: aus der gerechneten Musterloesung; Fenster nur aus limits (res_fenster 2 %, amp_gelb 5 %, Uebungswerte A, F13). WSL_TASKS.thresholds2() nennt die Musterwerte.
 * Aufgaben mit Pool-Bezug tragen die Kategorie "Pruefungsnah" (Zahlen aus dem Pool, SPEC 12.1); Aufgaben ohne Pool-Bezug (ws19, ws20, ws27, ws30, ws32) nicht.
 * Sicherheit: nur Simulation und Rechnung; Drehstrom (ws30) nur als Rechenvergleich mit dem Uebungsnetz 400 V (limits u_aussen, F7), Gleichspannung am Trafo (ws29) nur als
 *   Fehlerbild, keine Anleitung fuer Arbeiten an Netzspannung. Alle Bauteilwerte sind Aufgabenwerte (Text "Uebungsschaltung").
 * Abweichungen von der SPEC (siehe ABWEICHUNGEN.md, Abschnitt WP4b):
 *   ws19 stimmt C und R auf eine feste Generatorfrequenz (f0 im Fenster 2 %, Q_G wie Vorgabe); ws30 verlangt zusaetzlich I_Str, I_L und den Leistungsfaktor 3 als Rechenvergleich;
 *   ws31 prueft Z, I, cos phi, P und Q einzeln (Pool W2024-10); ws32 prueft den Aufbau (f0, B), die Messreihe (report.check, ein Punkt je Zeile) und die Kompensation (Rechnung). */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.WSL_TASKS) nodeReq('./wsldata.js');
  const T = root.WSL_TASKS;
  if (!T || typeof T.register !== 'function') { if (typeof console !== 'undefined') console.warn('wsltasks2.js: wsldata.js fehlt, die Aufgaben ws17 bis ws32 werden nicht angemeldet.'); return; }

  /* ====================================================================== Hilfsfunktionen */
  const RIGFILES = ['./wsldraw.js', './wslrig-base.js', './wslrig-sinus.js', './wslrig-rlc.js', './wslrig-leistung.js', './wslrig-kompens.js', './wslrig-schwing.js', './wslrig-filter.js', './wslrig-trafo.js', './wslrig-drehstrom.js'];
  const core = () => { if (!root.WSL_CORE) { nodeReq('./wslcore.js'); nodeReq('./wslcore-res.js'); } return root.WSL_CORE || null; };
  const rigs = id => { let R = root.WSL_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { core(); RIGFILES.forEach(nodeReq); R = root.WSL_RIGS; } return R || null; };
  const C = () => { const c = core(); if (!c || !c.exercise || !c.res || !c.report || !c.runSeq) throw new Error('Rechenkern fehlt'); return c; };
  const fin = x => typeof x === 'number' && isFinite(x);
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const obj = x => (isObj(x) ? x : {});
  const clone = o => JSON.parse(JSON.stringify(o));
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const f = (x, d) => (fin(x) ? C().fmt(x, d == null ? 2 : d) : '–');
  const lv = id => C().limit(id).value;
  const A = (rig, controls, extra) => Object.assign({ rig, controls: controls || {} }, extra || {});
  const SQ2 = Math.sqrt(2), SQ3 = Math.sqrt(3), TWO_PI = 2 * Math.PI;
  const RES_TOL = () => lv('res_fenster') / 100;   // 2 % (A, F13)
  const AMP_TOL = () => lv('amp_gelb') / 100;      // 5 % (A, F13)
  const RECH_TOL = 0.03;                           // Rechenaufgaben 3 % (Regel 4: Tabellenbuch-Rundungen)

  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 4; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }

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

  /* ---------- Simulation: Beharrungszustand eines Pruefstands ueber WSL_CORE.runSeq (Seed 1, gecacht) ---------- */
  const simCache = new Map();
  function sim(rigId, ctl) {
    const key = rigId + '|' + JSON.stringify(ctl);
    if (simCache.has(key)) return simCache.get(key);
    rigs(rigId);
    const res = C().runSeq(rigId, [], 1, { controls: ctl, seed: 1 });
    const last = res.samples && res.samples.length ? res.samples[res.samples.length - 1] : null;
    const v = { ok: !!res.ok && !(res.errors && res.errors.length), st: res.final || {}, m: (last && last.meters) || {}, errors: (res.errors || []).slice(), rejected: (res.rejected || []).slice() };
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
      if (typeof v === 'string' && fin(numOf(v))) v = numOf(v);
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
  const BASEU = { Ohm: 'Ω', ohm: 'Ω' };
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'var', 'VA', 's', 'S', 'dB', '°'];
  function baseUnit(u) {
    if (!u) return '';
    if (ULIST.indexOf(u) >= 0) return BASEU[u] || u;
    if (u.length >= 2 && 'TGMkKmµμunp'.indexOf(u[0]) >= 0 && ULIST.indexOf(u.slice(1)) >= 0) return BASEU[u.slice(1)] || u.slice(1);
    return '';
  }
  /* Referenz aus dem Kern: exercise.solve (Wert in SI, Tabellenbuch-Varianten alt, Fehlerbilder mit Text aus TEXTS.diag) */
  function ref(kind, given, tol) {
    const s = C().exercise.solve(kind, given);
    if (!s || !s.ok) throw new Error('Rechenkern: Aufgabenart ' + kind + ' fehlt');
    return { value: s.value, alts: (s.alt || []).slice(), wrongs: (s.wrong || []).map(w => ({ v: w.value, id: w.id, text: w.text })), factor: s.disp.factor, dispUnit: s.disp.unit, unit: s.unit, disp: s.disp.value, tol: tol || RECH_TOL, kind: kind };
  }
  /* Eigene Referenz (Wert aus dem Kern, Fehlerbilder gerechnet) */
  const own = (value, unit, wrongs, o) => Object.assign({ value, alts: [], wrongs: wrongs || [], factor: 1, dispUnit: unit || '', unit: unit || '', disp: value, tol: RECH_TOL }, o || {});
  /* Zahlenzeile: raw = Eingabe (Zahl, Text oder null); rf = Referenz; die Warum-Texte sagen nur, was verglichen wurde (Regel 2 und 3) */
  function numRow(r, raw, rf, label, d) {
    const W = C(), tol = rf.tol, dg = d == null ? 2 : d;
    const sqT = w => { const ok = w === 3 ? rf.kind === 'pDrehstrom' : ['eff', 'zeitversatz', 'uGeom', 'fgRC', 'cFuerFg', 'siebglied', 'dbDekade'].indexOf(rf.kind) >= 0; return ok ? W.TEXTS.get(w === 3 ? 'wurzel3' : 'wurzel') : W.TEXTS.get('wurzel-allg', { f: w === 3 ? '√3' : '√2' }); };
    let q = null;
    if (typeof raw === 'string') q = W.parseQty(raw); else if (fin(raw)) q = { v: raw, hasUnit: false, unit: '' };
    const tolTxt = 'Toleranz ' + f(100 * tol, 0) + ' %';
    if (!q || !fin(q.v)) { r(false, label + ' (' + tolTxt + ')', typeof raw === 'string' && raw.trim() !== '' ? W.TEXTS.keineZahl : 'Du hast keine Zahl eingetragen.'); return false; }
    if (q.hasUnit && rf.unit) { const b = baseUnit(q.unit); if (b && b !== rf.unit) { r(false, label + ' (' + tolTxt + ')', W.TEXTS.get('einheit', { gesucht: rf.unit })); return false; } }
    const cands = [q.v]; if (!q.hasUnit && rf.factor !== 1) cands.push(q.v * rf.factor);
    const refs = [rf.value].concat(rf.alts);
    const close = (x, y) => Math.abs(x - y) <= tol * Math.abs(y) + 1e-300;
    if (cands.some(c => refs.some(y => close(c, y)))) { r(true, label + ' (' + tolTxt + ')', ''); return true; }
    let x = cands[0];
    if (cands.length > 1 && rf.value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / rf.value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / rf.value))); if (l1 < l0) x = cands[1]; }
    let why = null;
    for (let k = 0; k < rf.wrongs.length && why === null; k++) { const w = rf.wrongs[k]; if (cands.some(c => close(c, w.v))) why = w.text; }
    if (why === null) {
      const v = rf.value;
      if (x !== 0 && v !== 0 && (x > 0) === (v > 0)) {
        const ra = x / v, lr = Math.log(Math.abs(ra)) / Math.LN10;
        if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) why = W.TEXTS.get('vorsatz', { faktor: Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')' });
        else if (Math.abs(ra / TWO_PI - 1) < 0.03 || Math.abs(ra * TWO_PI - 1) < 0.03) why = W.TEXTS.get('omega-vergessen', { w: f(x, dg) });
        else if (Math.abs(ra / SQ2 - 1) < 0.03 || Math.abs(ra * SQ2 - 1) < 0.03) why = sqT(2);
        else if (Math.abs(ra / SQ3 - 1) < 0.03 || Math.abs(ra * SQ3 - 1) < 0.03) why = sqT(3);
        else if (ra < 1) why = W.TEXTS.get('zu-klein', { pct: f((1 - ra) * 100, 0) });
        else why = W.TEXTS.get('zu-gross', { pct: f((ra - 1) * 100, 0) });
      } else why = (x < v ? W.TEXTS.get('zu-klein', { pct: '100' }) : W.TEXTS.get('zu-gross', { pct: f(Math.abs(x - v) / Math.max(Math.abs(v), 1e-300) * 100, 0) }));
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
  const TXT = () => C().TEXTS;
  const eng = (x, u) => C().fmtEng(x, u);

  /* ====================================================================== ws17: Resonanzfrequenz (Pool W2023-15) */
  const M17 = (() => {
    const G = { l: 220e-6, c: 470e-12 };
    const rf = () => once('r17', () => ref('f0', G));
    const wr = id => rf().wrongs.find(w => w.id === id);
    const vals = () => once('v17', () => { const R = rf(), om = wr('omega-vergessen'); return { l: G.l * 1e6, c: G.c * 1e12, wurzelNs: Math.sqrt(G.l * G.c) * 1e9, f0: R.value / 1e3, f0r: R.value, ohneMHz: om ? om.v / 1e6 : NaN, alt: R.alts[0] / 1e3 }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'f0'), rf(), 'Die Resonanzfrequenz f₀ ist richtig berechnet', 1); });
    return { vals, check, consts: [3.14],
      text: () => 'Ein Schwingkreis besteht aus einer Spule mit L = ' + eng(G.l, 'H') + ' und einem Kondensator mit C = ' + eng(G.c, 'F') + ' (Übungsschaltung). Wie groß ist die Resonanzfrequenz f₀? Trage sie in kHz ein; ca. 495 kHz zählt als Rechenwert.',
      fields: () => [{ key: 'f0', label: 'Resonanzfrequenz f₀', unit: 'kHz' }],
      hint: () => { const v = vals(); return [
        'Bei Resonanz sind X_L und X_C gleich groß. Daraus folgt f₀ = 1 / (2π · √(L · C)); der Faktor 2π steht im Nenner, die Wurzel gehört nur zu L · C.',
        'Rechne in Schritten: √(L · C) = ' + f(v.wurzelNs, 1) + ' ns. Beim Kehrwert mit 2π im Nenner ergibt sich eine Frequenz im Bereich von einigen hundert kHz.',
        'Musterlösung: f₀ = 1 / (2π · ' + f(v.wurzelNs, 1) + ' ns) = ' + f(v.f0, 1) + ' kHz (mit π = 3,14 ' + f(v.alt, 1) + ' kHz). Ohne den Faktor 2π käme ' + f(v.ohneMHz, 2) + ' MHz heraus.'
      ]; },
      start: () => A('schwing', { art: 'parallel', l: G.l, c: G.c, rp: 68000, f: 495000 }, { fields: { f0: null } }),
      sol: () => A('schwing', { art: 'parallel', l: G.l, c: G.c, rp: 68000, f: 495000 }, { fields: { f0: vals().f0 }, value: vals().f0 }),
      wrong: () => { const v = vals(); return [{ name: '2π vergessen (zu groß)', answer: A('schwing', {}, { fields: { f0: v.ohneMHz * 1000 } }) }, { name: 'zu klein (durch π geteilt)', answer: A('schwing', {}, { fields: { f0: v.f0 / Math.PI } }) }]; } };
  })();

  /* ====================================================================== ws18: Kapazitaet fuer Resonanz (Pool S2023-N04) */
  const M18 = (() => {
    const G = { l: 0.25, f0: 50 };
    const rf = () => once('r18', () => ref('cAusF0', G));
    const wr = id => rf().wrongs.find(w => w.id === id);
    const vals = () => once('v18', () => { const R = rf(), q = wr('quadrat-vergessen'), om = wr('omega-vergessen'); return { l: G.l, f: G.f0, w: TWO_PI * G.f0, w2: Math.pow(TWO_PI * G.f0, 2), c: R.value * 1e6, quadratMF: q ? q.v * 1e3 : NaN, ohneMF: om ? om.v * 1e3 : NaN }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'c'), rf(), 'Die Kapazität C ist richtig berechnet', 2); });
    return { vals, check, consts: [6.28],
      text: () => 'Ein Reihenschwingkreis mit einer Spule von L = ' + f(G.l, 2) + ' H soll bei f = ' + f(G.f0, 0) + ' Hz in Resonanz sein (Übungsschaltung). Welche Kapazität C wird benötigt? Trage sie in µF ein.',
      fields: () => [{ key: 'c', label: 'Kapazität C', unit: 'µF' }],
      hint: () => { const v = vals(); return [
        'Die Resonanzbedingung ist X_L = X_C, also f₀ = 1 / (2π · √(L · C)). Stelle nach C um: Das Quadrat von 2π · f₀ steht im Nenner zusammen mit L.',
        'Rechne zuerst ω = 2π · f₀ = ' + f(v.w, 2) + ' 1/s, dann ω² = ' + f(v.w2, 0) + ' 1/s². Danach C = 1 / (ω² · L); das Ergebnis liegt in der Größenordnung von einigen zehn µF.',
        'Musterlösung: C = 1 / (' + f(v.w2, 0) + ' 1/s² · ' + f(v.l, 2) + ' H) = ' + f(v.c, 2) + ' µF. Wer das Quadrat vergisst, kommt auf ' + f(v.quadratMF, 1) + ' mF.'
      ]; },
      start: () => A('schwing', { art: 'reihe', l: G.l, c: 1e-5, r: 10, f: G.f0 }, { fields: { c: null } }),
      sol: () => A('schwing', { art: 'reihe', l: G.l, c: vals().c * 1e-6, r: 10, f: G.f0 }, { fields: { c: vals().c }, value: vals().c }),
      wrong: () => { const v = vals(); return [{ name: 'Quadrat vergessen (zu groß)', answer: A('schwing', {}, { fields: { c: v.quadratMF * 1000 } }) }, { name: 'zu klein', answer: A('schwing', {}, { fields: { c: v.c * 0.5 } }) }]; } };
  })();

  /* ====================================================================== ws19: Reihenkreis auf f0 abstimmen (schwing, Verhalten) */
  const M19 = (() => {
    const FIX = { art: 'reihe', l: 1e-3, u: 10, f: 20000, modus: 'durchlauf' }, OWN = ['c', 'r'], QZ = 10, START = { c: 1e-7, r: 10 };
    const par = () => once('p19', () => { const w = TWO_PI * FIX.f, c = 1 / (w * w * FIX.l), z0 = Math.sqrt(FIX.l / c); return { c, z0, r: z0 / QZ }; });
    const vals = () => once('v19', () => { const p = par(), s0 = C().res.series({ l: FIX.l, c: START.c, r: START.r }), bad = C().res.series({ l: FIX.l, c: p.c, r: 50 }); return { l: FIX.l * 1e3, f: FIX.f / 1e3, c: p.c * 1e9, z0: p.z0, r: p.r, q: QZ, f0Start: s0.f0 / 1e3, r50: 50, q50: bad.qg }; });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('schwing', ctl), st = s.st, fg = FIX.f, tol = RES_TOL(), qt = AMP_TOL();
      inputRow(r, a, s, 'schwing');
      const f0 = st.f0, abw = Math.abs(f0 - fg) / fg;
      r(s.ok && fin(f0) && abw <= tol, 'Der Kreis ist in Resonanz (f₀ höchstens ' + f(100 * tol, 0) + ' % neben der Generatorfrequenz)',
        'Der Kreis hat f₀ = ' + f(f0 / 1e3, 2) + ' kHz, der Generator läuft mit ' + f(fg / 1e3, 2) + ' kHz (Abweichung ' + f(100 * abw, 1) + ' %). ' + (f0 < fg ? 'f₀ liegt zu tief: Bei L = ' + f(FIX.l * 1e3, 0) + ' mH ist die Kapazität zu groß.' : 'f₀ liegt zu hoch: Bei L = ' + f(FIX.l * 1e3, 0) + ' mH ist die Kapazität zu klein.'));
      const q = st.qg;
      r(s.ok && fin(q) && st.valid !== false && Math.abs(q - QZ) <= qt * QZ, 'Die Güte Q_G stimmt mit der Vorgabe ' + f(QZ, 0) + ' überein (Toleranz ' + f(100 * qt, 0) + ' %)',
        fin(q) && st.valid !== false ? 'Die Güte ist Q_G = ' + f(q, 2) + ', verlangt ist ' + f(QZ, 0) + '. ' + (q < QZ ? 'Q_G = Z₀ / R ist zu klein: Der Widerstand R = ' + f(ctl.r, 2) + ' Ω ist zu groß für Z₀ = ' + f(st.z0, 1) + ' Ω.' : 'Q_G = Z₀ / R ist zu groß: Der Widerstand R = ' + f(ctl.r, 2) + ' Ω ist zu klein für Z₀ = ' + f(st.z0, 1) + ' Ω.') : 'Der Prüfstand meldet für diese Werte keine Güte (' + (st.text || 'ideal') + ').');
    });
    return { vals, check,
      text: () => 'Der Generator läuft fest mit f = ' + f(FIX.f, 0) + ' Hz. Im Prüfstand „Schwingkreis“ ist ein Reihenkreis mit L = ' + f(FIX.l * 1e3, 0) + ' mH aufgebaut (Übungsschaltung, ideale Bauteile). Stelle die Kapazität C so ein, dass der Kreis bei dieser Frequenz in Resonanz ist (f₀ im Fenster von ' + f(100 * RES_TOL(), 0) + ' %), und wähle den Widerstand R so, dass die Güte Q_G = ' + f(QZ, 0) + ' beträgt (Toleranz ' + f(100 * AMP_TOL(), 0) + ' %). Das Fenster ist ein Übungswert.',
      hint: () => { const v = vals(); return [
        'Zuerst C aus der Resonanzbedingung: C = 1 / ((2π · f)² · L). Danach die Güte: Q_G = Z₀ / R mit dem Kennwiderstand Z₀ = √(L / C). Du siehst f₀, Z₀ und Q_G an den Messgeräten.',
        'Mit der Startkapazität liegt f₀ bei ' + f(v.f0Start, 2) + ' kHz, also neben den ' + f(v.f, 0) + ' kHz. Für die richtige Kapazität ist Z₀ = ' + f(v.z0, 1) + ' Ω; daraus folgt R = Z₀ / Q_G.',
        'Musterlösung: C = ' + f(v.c, 2) + ' nF, R = ' + f(v.z0, 1) + ' Ω / ' + f(v.q, 0) + ' = ' + f(v.r, 2) + ' Ω. Mit R = ' + f(v.r50, 0) + ' Ω fiele die Güte auf ' + f(v.q50, 2) + '.'
      ]; },
      start: () => A('schwing', Object.assign({}, FIX, START, { ziel: FIX.f, zielQ: QZ }), {}),
      sol: () => A('schwing', Object.assign({}, FIX, { c: par().c, r: par().r, ziel: FIX.f, zielQ: QZ }), {}),
      wrong: () => [{ name: 'Kapazität nicht abgestimmt (f₀ daneben)', answer: A('schwing', Object.assign({}, FIX, { c: 1e-7, r: 10 }), {}) }, { name: 'Güte zu klein (R zu groß)', answer: A('schwing', Object.assign({}, FIX, { c: par().c, r: 50 }), {}) }] };
  })();

  /* ====================================================================== ws20: Bandbreite einstellen (schwing, Verhalten) */
  const M20 = (() => {
    const FIX = { art: 'reihe', l: 1e-3, c: 1e-7, u: 10, f: 15915.494309189531, modus: 'durchlauf' }, OWN = ['r'], BT = 2400, START = { r: 10 };
    const par = () => once('p20', () => { const r = BT * TWO_PI * FIX.l; return { r, q: Math.sqrt(FIX.l / FIX.c) / r }; });
    const vals = () => once('v20', () => { const p = par(), s0 = C().res.series({ l: FIX.l, c: FIX.c, r: START.r }), hi = C().res.series({ l: FIX.l, c: FIX.c, r: 40 }), lo = C().res.series({ l: FIX.l, c: FIX.c, r: 5 }); return { l: FIX.l * 1e3, c: FIX.c * 1e9, f0: s0.f0 / 1e3, z0: s0.z0, b: BT, r: p.r, q: p.q, bStart: s0.b, rStart: START.r, bHoch: hi.b, rHoch: 40, bKlein: lo.b, rKlein: 5 }; });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('schwing', ctl), st = s.st, tol = 0.03;
      inputRow(r, a, s, 'schwing');
      const b = st.b, ok = s.ok && st.valid !== false && fin(b) && Math.abs(b - BT) <= tol * BT;
      r(ok, 'Die Bandbreite B liegt bei ' + f(BT, 0) + ' Hz (Toleranz ' + f(100 * tol, 0) + ' %)',
        fin(b) && st.valid !== false ? 'Mit R = ' + f(ctl.r, 2) + ' Ω ist B = ' + f(b, 0) + ' Hz (Güte Q_G = ' + f(st.qg, 2) + '), verlangt sind ' + f(BT, 0) + ' Hz. ' + (b > BT ? 'B ist zu groß: Ein kleinerer Widerstand verkleinert B (B = f₀ / Q_G, Q_G = Z₀ / R).' : 'B ist zu klein: Ein größerer Widerstand vergrößert B (B = f₀ / Q_G, Q_G = Z₀ / R).') : 'Der Prüfstand meldet bei R = ' + f(ctl.r, 2) + ' Ω keine Bandbreite (' + (st.text || 'ideal') + ').');
    });
    return { vals, check,
      text: () => 'Im Prüfstand „Schwingkreis“ liegt ein Reihenkreis mit L = ' + f(FIX.l * 1e3, 0) + ' mH und C = ' + f(FIX.c * 1e9, 0) + ' nF an der Quelle (Übungsschaltung, ideale Bauteile). Die Resonanzkurve soll eine Bandbreite von B = ' + f(BT, 0) + ' Hz haben (Toleranz ' + f(100 * 0.03, 0) + ' %). Ändere nur den Widerstand R.',
      hint: () => { const v = vals(); return [
        'Die Bandbreite ist B = f₀ / Q_G, die Güte ist Q_G = Z₀ / R. Je größer R, desto kleiner die Güte und desto größer B. L und C bleiben stehen, also auch f₀ und Z₀.',
        'Hier ist f₀ = ' + f(v.f0, 2) + ' kHz und Z₀ = ' + f(v.z0, 1) + ' Ω. Mit R = ' + f(v.rStart, 0) + ' Ω ergibt sich B = ' + f(v.bStart, 0) + ' Hz, das ist zu schmal. Es gilt auch B = R / (2π · L).',
        'Musterlösung: R = B · 2π · L = ' + f(v.r, 2) + ' Ω (Güte Q_G = ' + f(v.q, 2) + '). Mit R = ' + f(v.rHoch, 0) + ' Ω wäre B = ' + f(v.bHoch, 0) + ' Hz, mit R = ' + f(v.rKlein, 0) + ' Ω nur ' + f(v.bKlein, 0) + ' Hz.'
      ]; },
      start: () => A('schwing', Object.assign({}, FIX, START, { zielB: BT }), {}),
      sol: () => A('schwing', Object.assign({}, FIX, { r: par().r, zielB: BT }), {}),
      wrong: () => [{ name: 'Widerstand zu groß (B zu groß)', answer: A('schwing', Object.assign({}, FIX, { r: 40 }), {}) }, { name: 'Widerstand zu klein (B zu klein)', answer: A('schwing', Object.assign({}, FIX, { r: 5 }), {}) }] };
  })();

  /* ====================================================================== ws21: Reihe oder Parallel? (Pool W2023-14) */
  const M21 = (() => {
    const RC = { l: 1e-3, c: 1e-7 }, RS = 10, RP = 1000, U = 10;
    const ser = f => C().res.series({ l: RC.l, c: RC.c, r: RS, u: U, f }), par = f => C().res.parallel({ l: RC.l, c: RC.c, rp: RP, u: U, f });
    const data = () => once('d21', () => {
      const f0 = ser().f0, s = [ser(f0 / 2).z, ser(f0).z, ser(f0 * 2).z], p = [par(f0 / 2).z, par(f0).z, par(f0 * 2).z], pr = par(f0);
      return { f0, zs: s, zp: p, ip: pr.i, ik: pr.il, reiheMin: s[1] < s[0] && s[1] < s[2], parMax: p[1] > p[0] && p[1] > p[2], kreisGross: pr.il > pr.i };
    });
    const specs = () => once('s21', () => {
      const d = data(), z = (x, dg) => f(x, dg == null ? 1 : dg), f0k = f(d.f0 / 1e3, 2);
      const opts = (minTxt, maxTxt) => [
        { value: 'zmin', label: 'Z am kleinsten (Z = R), Strom am größten', grund: minTxt },
        { value: 'zmax', label: 'Z am größten, Strom am kleinsten', grund: maxTxt },
        { value: 'gleich', label: 'Z und Strom bleiben bei Resonanz unverändert', grund: 'Z und Strom ändern sich mit der Frequenz deutlich: Beim Reihenkreis steigt Z von ' + z(d.zs[1], 0) + ' Ω bei f₀ auf ' + z(d.zs[0]) + ' Ω bei halber Frequenz, beim Parallelkreis fällt Z von ' + z(d.zp[1], 0) + ' Ω auf ' + z(d.zp[0]) + ' Ω.' }];
      return [
        { key: 'reihe', q: 'Reihenschwingkreis (R = ' + f(RS, 0) + ' Ω) bei der Resonanzfrequenz f₀ = ' + f0k + ' kHz: Was gilt für Scheinwiderstand Z und Strom?', short: 'Der Reihenschwingkreis bei Resonanz ist richtig beschrieben', right: d.reiheMin ? 'zmin' : 'zmax',
          options: opts('Bei f₀ heben sich X_L und X_C auf, es bleibt Z = R = ' + z(d.zs[1], 0) + ' Ω; bei halber Frequenz ist Z = ' + z(d.zs[0]) + ' Ω, bei doppelter ' + z(d.zs[2]) + ' Ω. Z ist also am kleinsten, der Strom am größten.', 'Z am größten gilt für den Parallelkreis. Beim Reihenkreis ist Z bei f₀ nur ' + z(d.zs[1], 0) + ' Ω, bei halber Frequenz aber ' + z(d.zs[0]) + ' Ω.') },
        { key: 'parallel', q: 'Parallelschwingkreis (Verlustwiderstand parallel, R_p = ' + f(RP, 0) + ' Ω) bei f₀: Was gilt für Scheinwiderstand Z und Quellenstrom?', short: 'Der Parallelschwingkreis bei Resonanz ist richtig beschrieben', right: d.parMax ? 'zmax' : 'zmin',
          options: opts('Z am kleinsten gilt für den Reihenkreis. Beim Parallelkreis ist Z bei f₀ gerade am größten (' + z(d.zp[1], 0) + ' Ω gegen ' + z(d.zp[0]) + ' Ω bei halber Frequenz).', 'Bei f₀ heben sich die Blindströme von L und C auf, die Quelle liefert nur den Verluststrom I = ' + f(d.ip * 1000, 1) + ' mA: Z = R_p = ' + z(d.zp[1], 0) + ' Ω ist am größten, der Quellenstrom am kleinsten (Sperrkreis).') },
        { key: 'kreis', q: 'Parallelschwingkreis bei f₀: Wie groß sind die Ströme in Spule und Kondensator im Vergleich zum Quellenstrom?', short: 'Die Ströme im Parallelkreis bei Resonanz sind richtig beurteilt', right: d.kreisGross ? 'gross' : 'klein',
          options: [
            { value: 'gross', label: 'Viel größer als der Quellenstrom (Stromüberhöhung im Kreis)', grund: 'Der Kreisstrom beträgt ' + f(d.ik * 1000, 0) + ' mA gegen ' + f(d.ip * 1000, 1) + ' mA aus der Quelle: Die Blindströme von L und C kompensieren sich nur nach außen und fließen im Kreis.' },
            { value: 'klein', label: 'Genauso klein wie der Quellenstrom', grund: 'Die Ströme in L und C sind nicht klein, sie betragen ' + f(d.ik * 1000, 0) + ' mA, der Quellenstrom nur ' + f(d.ip * 1000, 1) + ' mA.' },
            { value: 'null', label: 'Null, weil sich alles aufhebt', grund: 'Nur die Summe der Blindströme nach außen ist null; durch L und C fließen je ' + f(d.ik * 1000, 0) + ' mA.' }] }];
    });
    const vals = () => { const d = data(); return { f0: d.f0 / 1e3, zsMin: d.zs[1], zsLow: d.zs[0], zpMax: d.zp[1], zpLow: d.zp[0], ip: d.ip * 1000, ik: d.ik * 1000, rs: RS, rp: RP }; };
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    const START = () => A('schwing', { art: 'parallel', l: RC.l, c: RC.c, rp: RP, r: RS, u: U, f: 15915.5 }, { choices: {} });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Zwei Übungskreise mit L = ' + f(RC.l * 1e3, 0) + ' mH und C = ' + f(RC.c * 1e9, 0) + ' nF: ein Reihenkreis mit R = ' + f(RS, 0) + ' Ω und ein Parallelkreis mit dem Verlustwiderstand R_p = ' + f(RP, 0) + ' Ω. Beide liegen an einer Quelle mit veränderbarer Frequenz. Beantworte, was bei der Resonanzfrequenz gilt. Im Prüfstand „Schwingkreis“ kannst du die Frequenz durchlaufen lassen und die Resonanzkurven vergleichen.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Reihenkreis ist ein Spannungsteiler aus R, X_L und X_C; bei Resonanz heben sich X_L und X_C auf. Der Parallelkreis verhält sich umgekehrt: Dort heben sich die Blindströme auf. Lass im Prüfstand den Frequenzdurchlauf laufen und achte auf Z.',
        'Beim Reihenkreis ist Z bei f₀ = ' + f(v.f0, 2) + ' kHz nur ' + f(v.zsMin, 0) + ' Ω, bei halber Frequenz ' + f(v.zsLow, 1) + ' Ω. Beim Parallelkreis ist Z bei f₀ ' + f(v.zpMax, 0) + ' Ω, bei halber Frequenz nur ' + f(v.zpLow, 1) + ' Ω.',
        'Musterlösung: Reihe: Z am kleinsten, Strom am größten. Parallel: Z am größten, Quellenstrom am kleinsten (' + f(v.ip, 1) + ' mA), Ströme in L und C groß (' + f(v.ik, 0) + ' mA).'
      ]; },
      start: START, sol: () => A('schwing', START().controls, { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'vertauscht', answer: A('schwing', {}, { choices: { reihe: 'zmax', parallel: 'zmin', kreis: 'klein' } }) }, { name: 'nur Reihenkreis richtig', answer: A('schwing', {}, { choices: { reihe: 'zmin', parallel: 'zmin', kreis: 'null' } }) }] };
  })();

  /* ====================================================================== ws22: Grenzfrequenz berechnen (Pool S2025-F13) */
  const M22 = (() => {
    const G = { r: 10000, c: 47e-9 };
    const rf = () => once('r22', () => ref('fgRC', G));
    const vals = () => once('v22', () => { const R = rf(), w = rf().wrongs.find(x => x.id === 'fg-f'); return { r: G.r / 1e3, c: G.c * 1e9, tau: G.r * G.c * 1e3, fg: R.value, alt: R.alts[0], ohne: w ? w.v : NaN }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'fg'), rf(), 'Die Grenzfrequenz f_g ist richtig berechnet', 1); });
    return { vals, check, consts: [3.14, 6.28],
      text: () => 'Ein passiver RC-Tiefpass besteht aus einem Widerstand von ' + eng(G.r, 'Ω') + ' in Reihe und einem Kondensator von ' + eng(G.c, 'F') + ' gegen Masse (Übungsschaltung). Wie groß ist die Grenzfrequenz f_g in Hz?',
      fields: () => [{ key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz' }],
      hint: () => { const v = vals(); return [
        'Die Grenzfrequenz liegt dort, wo X_C = R ist. Daraus folgt f_g = 1 / (2π · R · C). Setze R in Ω und C in F ein.',
        'Zuerst die Zeitkonstante τ = R · C = ' + f(v.tau, 3) + ' ms. Dann f_g = 1 / (2π · τ). Das Ergebnis liegt im Bereich einiger hundert Hz.',
        'Musterlösung: f_g = 1 / (2π · ' + f(v.tau, 3) + ' ms) = ' + f(v.fg, 1) + ' Hz (mit π = 3,14 ' + f(v.alt, 1) + ' Hz). Ohne 2π käme ' + f(v.ohne, 0) + ' Hz heraus.'
      ]; },
      start: () => A('filter', { art: 'RC', typ: 'tief', r: G.r, c: G.c, f: 1000 }, { fields: { fg: null } }),
      sol: () => A('filter', { art: 'RC', typ: 'tief', r: G.r, c: G.c, f: vals().fg }, { fields: { fg: vals().fg }, value: vals().fg }),
      wrong: () => { const v = vals(); return [{ name: '2π vergessen (zu groß)', answer: A('filter', {}, { fields: { fg: v.ohne } }) }, { name: 'zu klein (halber Wert)', answer: A('filter', {}, { fields: { fg: v.fg * 0.5 } }) }]; } };
  })();

  /* ====================================================================== ws23: Hochpass oder Tiefpass? (Pool W2025-22, H2026-12) */
  const M23 = (() => {
    const FC = { r: 10000, c: 22e-9 };
    const typOf = typ => { const rc = C().filter.rc(Object.assign({ typ }, FC)), fg = rc.fg, lo = C().filter.rc(Object.assign({ typ }, FC, { f: fg / 10 })), hi = C().filter.rc(Object.assign({ typ }, FC, { f: fg * 10 })); return { fg, lo: lo.h, hi: hi.h, kind: lo.h < hi.h ? 'hoch' : 'tief', nadel: C().filter.square(Object.assign({ typ }, FC), 1 / (fg / 10), 4).nadel === true }; };
    const data = () => once('d23', () => ({ A: typOf('hoch'), B: typOf('tief') }));
    const specs = () => once('s23', () => {
      const d = data(), nm = { hoch: 'Hochpass', tief: 'Tiefpass' };
      const grundTyp = (x, typ) => ({ hoch: typ === 'hoch' ? 'Bei einem Zehntel von f_g kommen nur ' + f(100 * x.lo, 1) + ' % der Eingangsspannung durch, bei dem Zehnfachen ' + f(100 * x.hi, 1) + ' %: hohe Frequenzen passieren, tiefe werden gesperrt (Hochpass).' : 'Der Hochpass lässt hohe Frequenzen durch (' + f(100 * x.hi, 1) + ' % beim Zehnfachen von f_g), dieser Aufbau tut es nicht.', tief: typ === 'tief' ? 'Bei einem Zehntel von f_g kommen ' + f(100 * x.lo, 1) + ' % der Eingangsspannung durch, beim Zehnfachen nur ' + f(100 * x.hi, 1) + ' %: tiefe Frequenzen passieren, hohe werden nach Masse abgeleitet (Tiefpass).' : 'Der Tiefpass lässt tiefe Frequenzen durch (' + f(100 * x.lo, 1) + ' % bei einem Zehntel von f_g), dieser Aufbau tut es nicht.' });
      const typOpts = x => [
        { value: 'tief', label: 'Tiefpass', grund: grundTyp(x, x.kind).tief },
        { value: 'hoch', label: 'Hochpass', grund: grundTyp(x, x.kind).hoch },
        { value: 'keine', label: 'Weder Tiefpass noch Hochpass (keine Filterwirkung)', grund: 'Ein Widerstand mit einem Kondensator bildet ein Filter erster Ordnung: Die Spannung am Ausgang ändert sich mit der Frequenz (' + f(100 * Math.min(x.lo, x.hi), 1) + ' % gegen ' + f(100 * Math.max(x.lo, x.hi), 1) + ' % bei einem Zehntel und dem Zehnfachen von f_g).' }];
      return [
        { key: 'a', q: 'Schaltung A: Der Kondensator (' + eng(FC.c, 'F') + ') liegt im Längszweig zwischen Ein- und Ausgang, der Widerstand (' + eng(FC.r, 'Ω') + ') im Querzweig parallel zum Ausgang. Um welches Filter handelt es sich?', short: 'Schaltung A ist richtig erkannt', right: d.A.kind, options: typOpts(d.A) },
        { key: 'b', q: 'Schaltung B: Der Widerstand (' + eng(FC.r, 'Ω') + ') liegt im Längszweig, der Kondensator (' + eng(FC.c, 'F') + ') gegen Masse, der Ausgang wird am Kondensator abgegriffen. Um welches Filter handelt es sich?', short: 'Schaltung B ist richtig erkannt', right: d.B.kind, options: typOpts(d.B) },
        { key: 'rechteck', q: 'Ein Rechtecksignal mit der Periodendauer T = ' + f(10000 / d.A.fg, 1) + ' ms (viel länger als die Zeitkonstante) wird auf beide Schaltungen gegeben. Bei welcher Schaltung entstehen am Ausgang Nadelimpulse an den Flanken?', short: 'Die Antwort zum Rechtecksignal ist richtig', right: d.A.nadel && !d.B.nadel ? 'a' : (d.B.nadel && !d.A.nadel ? 'b' : 'beide'),
          options: [
            { value: 'a', label: 'Schaltung A (' + nm[d.A.kind] + ')', grund: 'Beim Hochpass fällt die Spannung am Ausgang nach jeder Flanke auf null ab (T/2 ist viel länger als 5 · τ): Es bleiben Nadelimpulse. ' + (d.A.nadel ? 'Die Rechnung des Kerns bestätigt es für Schaltung A.' : 'Für Schaltung A ist das nicht der Fall.') },
            { value: 'b', label: 'Schaltung B (' + nm[d.B.kind] + ')', grund: 'Beim Tiefpass (f_g = ' + f(d.B.fg, 0) + ' Hz) werden Flanken nur verschliffen und der Ausgang folgt dem Rechteck; Nadelimpulse entstehen dort nicht (' + (d.B.nadel ? 'Kern: Nadel' : 'Kern: keine Nadel') + ').' },
            { value: 'beide', label: 'Bei beiden Schaltungen', grund: 'Nur das Hochpass-Glied (f_g = ' + f(d.A.fg, 0) + ' Hz) differenziert die Flanken zu Nadelimpulsen, das Tiefpass-Glied glättet sie.' }] }];
    });
    const vals = () => { const d = data(); return { r: FC.r / 1e3, c: FC.c * 1e9, fg: d.A.fg, loHoch: 100 * d.A.lo, hiHoch: 100 * d.A.hi, loTief: 100 * d.B.lo, hiTief: 100 * d.B.hi }; };
    const START = () => A('filter', { art: 'RC', typ: 'tief', r: FC.r, c: FC.c, f: 1000 }, { choices: {} });
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Zwei Übungsschaltungen mit demselben Widerstand und demselben Kondensator, nur anders angeordnet. Erkenne die Filterart und beantworte die Frage zum Rechtecksignal. Im Prüfstand „Hoch- und Tiefpass“ kannst du beide Anordnungen aufbauen (Tiefpass: Ausgang am Kondensator, Hochpass: Ausgang am Widerstand) und mit dem Frequenzdurchlauf prüfen.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Ein Kondensator sperrt tiefe Frequenzen und lässt hohe durch. Liegt er im Längszweig, kommen hohe Frequenzen zum Ausgang (Hochpass). Liegt er gegen Masse, werden hohe Frequenzen abgeleitet (Tiefpass).',
        'Die Grenzfrequenz beider Schaltungen ist f_g = ' + f(v.fg, 1) + ' Hz. Beim Hochpass kommen bei einem Zehntel von f_g ' + f(v.loHoch, 1) + ' % an, beim Zehnfachen ' + f(v.hiHoch, 1) + ' %; beim Tiefpass ist es umgekehrt (' + f(v.loTief, 1) + ' % und ' + f(v.hiTief, 1) + ' %).',
        'Musterlösung: Schaltung A ist ein Hochpass, Schaltung B ein Tiefpass. Nadelimpulse am Rechteck entstehen beim Hochpass (Schaltung A).'
      ]; },
      start: START, sol: () => A('filter', START().controls, { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'vertauscht', answer: A('filter', {}, { choices: { a: 'tief', b: 'hoch', rechteck: 'b' } }) }, { name: 'Rechteck falsch, Filter richtig', answer: A('filter', {}, { choices: { a: 'hoch', b: 'tief', rechteck: 'beide' } }) }] };
  })();

  /* ====================================================================== ws24: Koppelkondensator dimensionieren (Pool W2021-N46) */
  const M24 = (() => {
    const G = { r: 2200, fg: 250 };
    const rf = () => once('r24', () => ref('cFuerFg', G));
    const vals = () => once('v24', () => { const R = rf(), w = R.wrongs.find(x => x.id === 'fg-f'); return { r: G.r / 1e3, rOhm: G.r, fg: G.fg, w: TWO_PI * G.fg, c: R.value * 1e9, alt: R.alts[0] * 1e9, ohne: w ? w.v * 1e6 : NaN }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'c'), rf(), 'Die Kapazität C ist richtig berechnet', 1); });
    return { vals, check, consts: [3.14, 6.28],
      text: () => 'Der Eingangskreis einer Transistorstufe besteht aus dem Koppelkondensator C in Reihe zum Eingangswiderstand R = ' + eng(G.r, 'Ω') + ' und wirkt als Hochpass (Übungsschaltung). Die untere Grenzfrequenz soll ' + f(G.fg, 0) + ' Hz betragen. Welche Kapazität C ist nötig? Trage sie in nF ein.',
      fields: () => [{ key: 'c', label: 'Kapazität C', unit: 'nF' }],
      hint: () => { const v = vals(); return [
        'Bei der Grenzfrequenz gilt X_C = R, also f_g = 1 / (2π · R · C). Stelle die Formel nach C um: C = 1 / (2π · f_g · R). Achte auf kΩ und nF.',
        'Rechne zuerst ω = 2π · f_g = ' + f(v.w, 1) + ' 1/s. Dann C = 1 / (ω · R) mit R = ' + f(v.r, 1) + ' kΩ. Das Ergebnis liegt bei einigen hundert nF.',
        'Musterlösung: C = 1 / (' + f(v.w, 1) + ' 1/s · ' + f(v.r * 1000, 0) + ' Ω) = ' + f(v.c, 1) + ' nF (mit π = 3,14 ' + f(v.alt, 1) + ' nF). Setzt du f statt ω ein, kommt ' + f(v.ohne, 2) + ' µF heraus.'
      ]; },
      start: () => A('filter', { art: 'RC', typ: 'hoch', r: G.r, c: 1e-7, f: G.fg }, { fields: { c: null } }),
      sol: () => A('filter', { art: 'RC', typ: 'hoch', r: G.r, c: vals().c * 1e-9, f: G.fg }, { fields: { c: vals().c }, value: vals().c }),
      wrong: () => { const v = vals(); return [{ name: 'f statt ω eingesetzt (zu groß)', answer: A('filter', {}, { fields: { c: v.ohne * 1000 } }) }, { name: 'R in kΩ statt Ω (Vorsatz, zu klein)', answer: A('filter', {}, { fields: { c: v.c / 1000 } }) }]; } };
  })();

  /* ====================================================================== ws25: Was gilt bei f_g? (Pool W2024-20) */
  const M25 = (() => {
    const FC = { typ: 'tief', r: 1000, c: 1e-7 };
    const data = () => once('d25', () => {
      const at = C().filter.rc(FC), half = 0.5, tenth = 0.1;
      return { fg: at.fg, h: at.h, a: at.a, phi: at.phi, xc: at.xc, r: FC.r, aHalf: 20 * Math.log10(half), aTenth: 20 * Math.log10(tenth), hoch: C().filter.rc(Object.assign({}, FC, { typ: 'hoch' })).phi };
    });
    const specs = () => once('s25', () => {
      const d = data(), pc = x => f(100 * x, 1);
      return [
        { key: 'h', q: 'RC-Tiefpass bei seiner Grenzfrequenz f_g: Wie groß ist das Übertragungsverhältnis |H| = U_a / U_e?', short: 'Das Übertragungsverhältnis bei f_g ist richtig', right: 'h707',
          options: [
            { value: 'h707', label: '0,707 (70,7 %)', grund: 'Bei f_g ist X_C = R = ' + f(d.r, 0) + ' Ω, der Scheinwiderstand ist √2 · R; daraus folgt |H| = R-Teiler = 1 / √2 = ' + f(d.h, 4) + ' (' + pc(d.h) + ' %).' },
            { value: 'h50', label: '0,5 (50 %)', grund: '50 % entsprächen ' + f(d.aHalf, 1) + ' dB; bei f_g sinkt |H| nur auf ' + pc(d.h) + ' % (' + f(d.a, 2) + ' dB).' },
            { value: 'h10', label: '0,1 (10 %)', grund: '10 % entsprächen ' + f(d.aTenth, 0) + ' dB; das ist eine Dekade oberhalb von f_g, nicht f_g selbst.' },
            { value: 'h1', label: '1 (die volle Eingangsspannung)', grund: 'Die volle Eingangsspannung (0 dB) liegt weit unterhalb von f_g an; bei f_g sind es ' + pc(d.h) + ' %.' }] },
        { key: 'a', q: 'Wie groß ist das Dämpfungsmaß a = 20 · lg |H| bei f_g?', short: 'Das Dämpfungsmaß bei f_g ist richtig', right: 'a3',
          options: [
            { value: 'a3', label: '−3 dB', grund: 'a = 20 · lg ' + f(d.h, 4) + ' = ' + f(d.a, 2) + ' dB, also rund −3 dB (Halbierung der Leistung).' },
            { value: 'a6', label: '−6 dB', grund: '−6 dB entsprächen |H| = 0,5; bei f_g ist |H| = ' + f(d.h, 4) + ', also ' + f(d.a, 2) + ' dB.' },
            { value: 'a20', label: '−20 dB', grund: '−20 dB entsprächen |H| = 0,1, das ist eine Dekade oberhalb von f_g; bei f_g sind es ' + f(d.a, 2) + ' dB.' },
            { value: 'a0', label: '0 dB', grund: '0 dB hieße |H| = 1, also keine Dämpfung; bei f_g ist |H| = ' + f(d.h, 4) + ' (' + f(d.a, 2) + ' dB).' }] },
        { key: 'phi', q: 'Wie groß ist die Phasenverschiebung zwischen Ein- und Ausgangsspannung bei f_g?', short: 'Die Phasenverschiebung bei f_g ist richtig', right: 'p45',
          options: [
            { value: 'p45', label: '45° (die Ausgangsspannung eilt nach)', grund: 'Bei X_C = R ist tan φ = X_C / R = ' + f(d.xc / d.r, 0) + ', also φ = ' + f(Math.abs(d.phi), 0) + '°; beim Tiefpass eilt die Ausgangsspannung der Eingangsspannung nach.' },
            { value: 'p90', label: '90°', grund: 'Erst weit oberhalb von f_g nähert sich die Phase 90°; bei f_g ist sie ' + f(Math.abs(d.phi), 0) + '°.' },
            { value: 'p0', label: '0° (in Phase)', grund: 'In Phase sind die Spannungen nur weit unterhalb von f_g; bei f_g sind es ' + f(Math.abs(d.phi), 0) + '°.' },
            { value: 'p60', label: '60°', grund: 'Mit X_C = R ergibt sich ' + f(Math.abs(d.phi), 0) + '°, nicht 60°; tan 60° wäre ' + f(Math.tan(Math.PI / 3), 2) + ' statt ' + f(d.xc / d.r, 0) + '.' }] }];
    });
    const vals = () => { const d = data(); return { r: d.r, c: FC.c * 1e9, fg: d.fg, xc: d.xc, h: d.h, hPct: 100 * d.h, a: d.a, phi: Math.abs(d.phi) }; };
    const START = () => A('filter', Object.assign({ art: 'RC', f: 1000 }, FC), { choices: {} });
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Ein RC-Tiefpass (R = ' + eng(FC.r, 'Ω') + ', C = ' + eng(FC.c, 'F') + ', Übungsschaltung) wird mit Sinusspannung betrieben. Beantworte, was bei der Grenzfrequenz f_g gilt. Im Prüfstand „Hoch- und Tiefpass“ kannst du f auf f_g stellen und die Messgeräte ablesen.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Grenzfrequenz ist so definiert, dass dort der Blindwiderstand des Kondensators genau so groß ist wie der Widerstand: X_C = R. Daraus ergibt sich die Spannungsteilung und die Phase.',
        'Hier ist f_g = ' + f(v.fg, 1) + ' Hz und X_C = ' + f(v.xc, 0) + ' Ω bei f_g. Stelle f im Prüfstand auf diesen Wert: |H| zeigt ' + f(v.h, 4) + ', das Dämpfungsmaß ' + f(v.a, 2) + ' dB, die Phase ' + f(v.phi, 0) + '°.',
        'Musterlösung: |H| = 0,707 (70,7 %), a = −3 dB, φ = 45° (Ausgang eilt nach).'
      ]; },
      start: START, sol: () => A('filter', START().controls, { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'Halbe Spannung (−6 dB)', answer: A('filter', {}, { choices: { h: 'h50', a: 'a6', phi: 'p45' } }) }, { name: 'zehnfach gedämpft und 90°', answer: A('filter', {}, { choices: { h: 'h10', a: 'a20', phi: 'p90' } }) }] };
  })();

  /* ====================================================================== ws26: Siebglied berechnen (Pool S2024-28) */
  const M26 = (() => {
    const G = { r: 470, c: 2.2e-6, f: 100, u1: 4 };
    const rf = () => once('r26', () => ref('siebglied', G));
    const vals = () => once('v26', () => { const R = rf(), s = C().filter.sieve(G), add = R.wrongs.find(x => x.id === 'z-addiert'); return { r: G.r, c: G.c * 1e6, f: G.f, u1: G.u1, xc: s.xc, z: s.z, u2: R.value, zAdd: G.r + s.xc, ohne: add ? add.v : NaN }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'u2'), rf(), 'Die Ausgangs-Wechselspannung U₂ ist richtig berechnet', 2); });
    return { vals, check,
      text: () => 'Ein RC-Siebglied (Reihenwiderstand R = ' + eng(G.r, 'Ω') + ', Kondensator C = ' + eng(G.c, 'F') + ' nach Masse, Ausgang am Kondensator, Übungsschaltung) soll die Wechselspannung ' + f(G.u1, 0) + ' V bei ' + f(G.f, 0) + ' Hz verringern. Die Last ist hochohmig. Berechne die verbleibende Wechselspannung U₂ am Ausgang.',
      fields: () => [{ key: 'u2', label: 'Ausgangs-Wechselspannung U₂', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Siebglied heißt Spannungsteiler aus R und X_C. Die Teilspannung am Kondensator ist U₂ = U₁ · X_C / Z. Der Scheinwiderstand Z entsteht aus R und X_C im rechten Winkel (Pythagoras), nicht durch Addieren.',
        'Rechne X_C = 1 / (2π · f · C) = ' + f(v.xc, 1) + ' Ω und Z = √(R² + X_C²) = ' + f(v.z, 1) + ' Ω.',
        'Musterlösung: U₂ = ' + f(v.u1, 0) + ' V · ' + f(v.xc, 1) + ' Ω / ' + f(v.z, 1) + ' Ω = ' + f(v.u2, 3) + ' V. Addierst du R und X_C (' + f(v.zAdd, 1) + ' Ω), ergibt sich ' + f(v.ohne, 2) + ' V.'
      ]; },
      start: () => A('filter', { art: 'RC', typ: 'tief', r: G.r, c: G.c, f: G.f, ue: G.u1 }, { fields: { u2: null } }),
      sol: () => A('filter', { art: 'RC', typ: 'tief', r: G.r, c: G.c, f: G.f, ue: G.u1 }, { fields: { u2: vals().u2 }, value: vals().u2 }),
      wrong: () => { const v = vals(); return [{ name: 'Z ohne Pythagoras (zu klein)', answer: A('filter', {}, { fields: { u2: v.ohne } }) }, { name: 'zu groß', answer: A('filter', {}, { fields: { u2: 3.7 } }) }]; } };
  })();

  /* ====================================================================== ws27: Uebersetzungsverhaeltnis (trafo) */
  const M27 = (() => {
    const G = { n1: 1150, n2: 60 };
    const rfU = () => once('r27u', () => ref('ueb', G));
    const u1 = () => lv('u_netz');
    const rfV = () => once('r27v', () => { const e = rfU().value, u2 = u1() / e; return own(u2, 'V', [{ v: u1() * e, id: 'u-mal', text: 'Dein Wert passt zu U₂ = U₁ · ü. Das Übersetzungsverhältnis ü = N₁ / N₂ ist größer als 1; die Sekundärspannung ist kleiner als die Primärspannung: U₂ = U₁ / ü.' }, { v: e, id: 'u-ueb', text: 'Dein Wert ist das Übersetzungsverhältnis ü selbst. Die Sekundärspannung ist U₂ = U₁ / ü.' }], { dispUnit: 'V' }); });
    const vals = () => once('v27', () => ({ n1: G.n1, n2: G.n2, u1: u1(), ueb: rfU().value, u2: rfV().value, uebKehr: G.n2 / G.n1, uMal: u1() * rfU().value }));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ueb'), rfU(), 'Das Übersetzungsverhältnis ü ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'u2'), rfV(), 'Die Sekundärspannung U₂ ist richtig berechnet', 2);
    });
    const ctl = () => ({ u1: u1(), n1: G.n1, n2: G.n2, modus: 'ideal', dc: 'wechsel' });
    return { vals, check,
      text: () => 'Ein Transformator hat auf der Primärseite N₁ = ' + f(G.n1, 0) + ' und auf der Sekundärseite N₂ = ' + f(G.n2, 0) + ' Windungen (Übungsschaltung). Er liegt primär an ' + C().limitText('u_netz') + '. Berechne das Übersetzungsverhältnis ü und die Sekundärspannung U₂ (ideales Modell).',
      fields: () => [{ key: 'ueb', label: 'Übersetzungsverhältnis ü', unit: '' }, { key: 'u2', label: 'Sekundärspannung U₂', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Beim idealen Transformator verhalten sich die Spannungen wie die Windungszahlen: U₁ / U₂ = N₁ / N₂ = ü. Das Übersetzungsverhältnis ist Primärseite durch Sekundärseite.',
        'Setze N₁ = ' + f(v.n1, 0) + ' und N₂ = ' + f(v.n2, 0) + ' ein: ü liegt deutlich über 1, die Spannung wird heruntergesetzt. Dann ist U₂ = U₁ / ü.',
        'Musterlösung: ü = ' + f(v.n1, 0) + ' / ' + f(v.n2, 0) + ' = ' + f(v.ueb, 2) + '. U₂ = ' + f(v.u1, 0) + ' V / ' + f(v.ueb, 2) + ' = ' + f(v.u2, 1) + ' V. Der Kehrwert ' + f(v.uebKehr, 3) + ' wäre falsch herum.'
      ]; },
      start: () => A('trafo', ctl(), { fields: { ueb: null, u2: null } }),
      sol: () => A('trafo', ctl(), { fields: { ueb: vals().ueb, u2: vals().u2 }, value: vals().ueb }),
      wrong: () => { const v = vals(); return [{ name: 'Kehrwert (ü falsch herum)', answer: A('trafo', {}, { fields: { ueb: v.uebKehr, u2: v.uMal } }) }, { name: 'U₂ falsch herum gerechnet', answer: A('trafo', {}, { fields: { ueb: v.ueb, u2: v.uMal } }) }]; } };
  })();

  /* ====================================================================== ws28: Primaerstrom (Pool F2021-N04) */
  const M28 = (() => {
    const G = { n1: 1150, n2: 69, i2: 2.5 };
    const rf = () => once('r28', () => ref('i1', G));
    const vals = () => once('v28', () => { const R = rf(), ti = R.wrongs.find(x => x.id === 'trafo-i'); return { n1: G.n1, n2: G.n2, i2: G.i2, ueb: G.n1 / G.n2, verh: G.n2 / G.n1, i1: R.value * 1000, i1A: R.value, ohne: ti ? ti.v : NaN }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'i1'), rf(), 'Der Primärstrom I₁ ist richtig berechnet', 0); });
    const ctl = () => ({ u1: lv('u_netz'), n1: G.n1, n2: G.n2, rlast: 5.52, modus: 'ideal', dc: 'wechsel' });
    return { vals, check,
      text: () => 'Ein idealer Transformator hat primär N₁ = ' + f(G.n1, 0) + ' Windungen und sekundär N₂ = ' + f(G.n2, 0) + ' Windungen (Übungsschaltung). Sekundärseitig fließen ' + f(G.i2, 1) + ' A. Wie groß ist der Primärstrom I₁? Trage ihn in mA ein.',
      fields: () => [{ key: 'i1', label: 'Primärstrom I₁', unit: 'mA' }],
      hint: () => { const v = vals(); return [
        'Die Ströme verhalten sich umgekehrt wie die Windungszahlen: I₁ / I₂ = N₂ / N₁. Auf der Seite mit den vielen Windungen fließt der kleine Strom.',
        'Das Windungsverhältnis ist N₂ / N₁ = ' + f(v.n2, 0) + ' / ' + f(v.n1, 0) + ' = ' + f(v.n2 / v.n1, 4) + '. Mit diesem Faktor wird I₂ = ' + f(v.i2, 1) + ' A multipliziert.',
        'Musterlösung: I₁ = ' + f(v.i2, 1) + ' A · ' + f(v.n2, 0) + ' / ' + f(v.n1, 0) + ' = ' + f(v.i1A, 2) + ' A = ' + f(v.i1, 0) + ' mA. Mit dem falschen Verhältnis N₁ / N₂ käme ' + f(v.ohne, 1) + ' A heraus.'
      ]; },
      start: () => A('trafo', ctl(), { fields: { i1: null } }),
      sol: () => A('trafo', ctl(), { fields: { i1: vals().i1 }, value: vals().i1 }),
      wrong: () => { const v = vals(); return [{ name: 'Stromverhältnis wie Spannungsverhältnis (zu groß)', answer: A('trafo', {}, { fields: { i1: v.ohne * 1000 } }) }, { name: 'Sekundärstrom übernommen', answer: A('trafo', {}, { fields: { i1: G.i2 * 1000 } }) }]; } };
  })();

  /* ====================================================================== ws29: Trafo an Gleichspannung (Pool F2023-N17) */
  const M29 = (() => {
    const BASE = { u1: 230, n1: 1150, n2: 69, rlast: 5.52, modus: 'ideal', r1: 25 };
    const data = () => once('d29', () => {
      const ac = sim('trafo', Object.assign({}, BASE, { dc: 'wechsel' })), dc = sim('trafo', Object.assign({}, BASE, { dc: 'gleich' }));
      const i1ac = ac.m.i1, i1dc = dc.m.i1, u2ac = ac.m.u2, u2dc = dc.m.u2;
      return { u1: BASE.u1, r1: BASE.r1, i1ac, i1dc, u2ac, u2dc, faktor: i1dc / i1ac, gross: i1dc > 10 * i1ac, null2: u2dc === 0 };
    });
    const specs = () => once('s29', () => {
      const d = data();
      return [
        { key: 'strom', q: 'Ein Netztransformator wird an eine Gleichspannung von ' + f(d.u1, 0) + ' V angeschlossen (Simulation, Fehlerbild). Was fließt primär?', short: 'Der Primärstrom bei Gleichspannung ist richtig beurteilt', right: d.gross ? 'gross' : 'normal',
          options: [
            { value: 'gross', label: 'Ein sehr großer Strom: nur der Wicklungswiderstand begrenzt ihn', grund: 'Bei Gleichspannung gibt es keinen induktiven Widerstand, es wirkt nur R₁ = ' + f(d.r1, 0) + ' Ω: I = U / R₁ = ' + f(d.i1dc, 2) + ' A, im Wechselbetrieb sind es nur ' + f(d.i1ac * 1000, 0) + ' mA (das ' + f(d.faktor, 0) + '-Fache).' },
            { value: 'normal', label: 'Derselbe Strom wie an Wechselspannung', grund: 'Im Wechselbetrieb begrenzt der induktive Widerstand den Strom auf ' + f(d.i1ac * 1000, 0) + ' mA; bei Gleichspannung fehlt er, es fließen ' + f(d.i1dc, 2) + ' A.' },
            { value: 'null', label: 'Gar kein Strom, weil sich kein Fluss ändert', grund: 'Der Strom fließt trotzdem: Die Wicklung ist ein Draht mit R₁ = ' + f(d.r1, 0) + ' Ω, also I = ' + f(d.i1dc, 2) + ' A. Nur die Induktion bleibt aus.' }] },
        { key: 'sek', q: 'Welche Spannung liegt dabei an der Sekundärseite?', short: 'Die Sekundärspannung bei Gleichspannung ist richtig beurteilt', right: d.null2 ? 'null' : 'uebersetzt',
          options: [
            { value: 'null', label: '0 V: Gleichspannung wird nicht übersetzt', grund: 'Induziert wird nur bei Flussänderung. Bei Gleichspannung ist der Fluss konstant, die Simulation zeigt U₂ = ' + f(d.u2dc, 1) + ' V (im Wechselbetrieb ' + f(d.u2ac, 1) + ' V).' },
            { value: 'uebersetzt', label: 'Die Spannung wird übersetzt wie bei Wechselspannung', grund: 'Im Wechselbetrieb sind es ' + f(d.u2ac, 1) + ' V; bei Gleichspannung entsteht keine Induktion, U₂ = ' + f(d.u2dc, 1) + ' V.' },
            { value: 'gleich', label: 'Dieselbe Gleichspannung wie primär', grund: 'Ein Transformator überträgt keine Gleichspannung; die Sekundärseite bleibt bei ' + f(d.u2dc, 1) + ' V.' }] },
        { key: 'gefahr', q: 'Die Sekundärspannung ist 0 V. Ist die Lage damit ungefährlich?', short: 'Die Gefahr bei Gleichspannung ist richtig beurteilt', right: d.gross ? 'nein' : 'ja',
          options: [
            { value: 'nein', label: 'Nein: Die Primärwicklung wird überlastet und kann zerstört werden', grund: 'Der Strom ist mit ' + f(d.i1dc, 2) + ' A das ' + f(d.faktor, 0) + '-Fache des Stroms im Wechselbetrieb (' + f(d.i1ac * 1000, 0) + ' mA); die Wicklung erwärmt sich stark.' },
            { value: 'ja', label: 'Ja: 0 V auf der Sekundärseite heißt ungefährlich', grund: 'Die Sekundärspannung sagt nichts über die Primärseite: Dort fließen ' + f(d.i1dc, 2) + ' A statt ' + f(d.i1ac * 1000, 0) + ' mA. Außerdem gilt grün in der Simulation nie als gefahrlos.' }] }];
    });
    const vals = () => { const d = data(); return { u1: d.u1, r1: d.r1, i1ac: d.i1ac * 1000, i1dc: d.i1dc, u2ac: d.u2ac, u2dc: d.u2dc, faktor: d.faktor }; };
    const START = () => A('trafo', Object.assign({}, BASE, { dc: 'wechsel' }), { choices: {} });
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Im Prüfstand „Transformator“ ist ein Netztrafo (Übungsschaltung, Lehrmodell) aufgebaut. Schalte dort probeweise von Wechsel- auf Gleichspannung um (Simulation, ein Fehlerbild; am echten Gerät wird das nicht probiert) und beantworte die drei Fragen zum Fehlerbild.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Ein Transformator überträgt nur Änderungen des Flusses. Bei Gleichspannung ändert sich der Fluss nicht, also wird nichts induziert. Gleichzeitig fehlt der induktive Widerstand, nur der kleine ohmsche Wicklungswiderstand begrenzt den Strom.',
        'Im Wechselbetrieb nimmt die Primärseite ' + f(v.i1ac, 0) + ' mA auf und U₂ ist ' + f(v.u2ac, 1) + ' V. Bei Gleichspannung rechnet der Prüfstand I = U / R₁ = ' + f(v.u1, 0) + ' V / ' + f(v.r1, 0) + ' Ω = ' + f(v.i1dc, 2) + ' A.',
        'Musterlösung: Es fließt ein sehr großer Strom (nur der Wicklungswiderstand begrenzt ihn), die Sekundärspannung ist 0 V, und die Lage ist nicht ungefährlich: Die Primärwicklung kann zerstört werden.'
      ]; },
      start: START, sol: () => A('trafo', Object.assign({}, BASE, { dc: 'gleich' }), { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'Spannung wird übersetzt, ungefährlich', answer: A('trafo', {}, { choices: { strom: 'normal', sek: 'uebersetzt', gefahr: 'ja' } }) }, { name: 'Sekundärspannung null, also ungefährlich', answer: A('trafo', {}, { choices: { strom: 'null', sek: 'null', gefahr: 'ja' } }) }] };
  })();

  /* ====================================================================== ws30: Stern oder Dreieck? (drehstrom, Rechenvergleich) */
  const M30 = (() => {
    const FIX = { ul: 400, rstr: 23, cosphi: 0.8, ansicht: 'zeit' }, OWN = ['schaltung'], START = { schaltung: 'stern' };
    const data = () => once('d30', () => {
      const ul = lv('u_aussen'), cfg = Object.assign({}, FIX, { ul }), d = sim('drehstrom', Object.assign({}, cfg, { schaltung: 'dreieck' })), s = sim('drehstrom', Object.assign({}, cfg, { schaltung: 'stern' })), tp = C().three.power({ ul, zstr: FIX.rstr, cosphi: FIX.cosphi });
      return { ul, z: FIX.rstr, cos: FIX.cosphi, dUstr: d.m.ustr, dIstr: d.m.istr, dIl: d.m.il, sUstr: s.m.ustr, sIstr: s.m.istr, sIl: s.m.il, pD: d.m.p, pS: s.m.p, faktor: tp.faktor };
    });
    const rfI = () => { const d = data(); return own(d.dIstr, 'A', [{ v: d.sIstr, id: 'stern', text: 'Dein Wert ' + f(d.sIstr, 2) + ' A ist der Strangstrom der Sternschaltung (U_Str = ' + f(d.sUstr, 1) + ' V). Im Dreieck liegt jeder Strang an U_L = ' + f(d.ul, 0) + ' V, also I_Str = U_L / Z = ' + f(d.dIstr, 2) + ' A.' }]); };
    const rfL = () => { const d = data(); return own(d.dIl, 'A', [{ v: d.dIstr, id: 'sqrt3-vergessen', text: 'Dein Wert ' + f(d.dIstr, 2) + ' A ist der Strangstrom. Im Dreieck gilt I_L = √3 · I_Str = ' + f(d.dIl, 2) + ' A.' }, { v: d.sIl, id: 'stern', text: 'Dein Wert ' + f(d.sIl, 2) + ' A gehört zur Sternschaltung. Im Dreieck gilt I_L = √3 · I_Str = ' + f(d.dIl, 2) + ' A.' }, { v: d.dIstr * 3, id: 'sqrt3-doppelt', text: 'Dein Wert ' + f(d.dIstr * 3, 1) + ' A passt zu einem dreifachen Strangstrom; der Faktor √3 gilt nur einmal: I_L = √3 · I_Str = ' + f(d.dIl, 2) + ' A.' }]); };
    const rfF = () => { const d = data(); return own(d.faktor, '', [{ v: SQ3, id: 'sqrt3', text: 'Dein Wert ' + f(SQ3, 2) + ' ist √3: So groß ist der Faktor beim Strom und beim Spannungsverhältnis. Die Leistung P = √3 · U_L · I_L · cos φ steigt von ' + f(d.pS, 0) + ' W auf ' + f(d.pD, 0) + ' W, also um den Faktor ' + f(d.faktor, 0) + '.' }, { v: 1 / 3, id: 'drittel', text: 'Dein Wert ' + f(1 / 3, 2) + ' kehrt den Faktor um: Im Dreieck wird mehr Leistung aufgenommen, nicht weniger (' + f(d.pS, 0) + ' W gegen ' + f(d.pD, 0) + ' W).' }]); };
    const vals = () => { const d = data(); return { ul: d.ul, z: d.z, cos: d.cos, dUstr: d.dUstr, dIstr: d.dIstr, dIl: d.dIl, sUstr: d.sUstr, sIstr: d.sIstr, sIl: d.sIl, pD: d.pD, pS: d.pS, faktor: d.faktor, sq3: SQ3 }; };
    const check = mk((r, a) => {
      const d = data(), ctl = effCtl(a, OWN, Object.assign({}, FIX, { ul: d.ul }), START), s = sim('drehstrom', ctl);
      inputRow(r, a, s, 'drehstrom');
      r(ctl.schaltung === 'dreieck' && s.ok, 'Der Verbraucher ist im Dreieck geschaltet (jeder Strang an der vollen Außenleiterspannung)',
        'Die Schaltung steht auf „' + (ctl.schaltung === 'stern' ? 'Stern' : String(ctl.schaltung)) + '“: Jeder Strang liegt dann an U_Str = ' + f(d.sUstr, 1) + ' V (= U_L / √3). Der Strang ist für ' + f(d.ul, 0) + ' V ausgelegt, also muss er an U_L = ' + f(d.ul, 0) + ' V liegen: Dreieck.');
      numRow(r, rawOf(a, 'istr'), Object.assign(rfI(), { kind: 'pDrehstrom' }), 'Der Strangstrom I_Str im Dreieck ist richtig', 2);
      numRow(r, rawOf(a, 'il'), Object.assign(rfL(), { kind: 'pDrehstrom' }), 'Der Leiterstrom I_L im Dreieck ist richtig', 2);
      numRow(r, rawOf(a, 'faktor'), Object.assign(rfF(), { kind: 'pDrehstrom' }), 'Der Leistungsfaktor Dreieck gegen Stern ist richtig', 2);
    });
    return { vals, check, consts: [],
      text: () => 'Ein symmetrischer Verbraucher hat je Strang den Scheinwiderstand ' + f(FIX.rstr, 0) + ' Ω bei cos φ = ' + f(FIX.cosphi, 1) + ' (Übungswerte). Jeder Strang ist für eine Strangspannung von ' + f(lv('u_aussen'), 0) + ' V ausgelegt und soll am Übungsnetz mit ' + C().limitText('u_aussen') + ' laufen. Stelle im Prüfstand „Drehstrom“ die passende Schaltung ein. Lies dann den Strangstrom I_Str und den Leiterstrom I_L ab und trage ein, um welchen Faktor die Leistung beim Wechsel von Stern auf Dreieck steigt (Rechenvergleich). ' + C().TEXTS.dreiOhne,
      fields: () => [{ key: 'istr', label: 'Strangstrom I_Str', unit: 'A' }, { key: 'il', label: 'Leiterstrom I_L', unit: 'A' }, { key: 'faktor', label: 'Leistungsfaktor Dreieck : Stern', unit: '' }],
      hint: () => { const v = vals(); return [
        'Im Stern liegt jeder Strang an der Strangspannung U_Str = U_L / √3, im Dreieck an der vollen Außenleiterspannung U_L. Ein Strang, der für ' + f(v.ul, 0) + ' V gebaut ist, gehört also ins Dreieck. Beim Strom ist es umgekehrt: Im Dreieck ist I_L = √3 · I_Str.',
        'Im Dreieck liegen ' + f(v.dUstr, 0) + ' V am Strang: I_Str = U_Str / Z = ' + f(v.dIstr, 2) + ' A. Im Stern wären es nur ' + f(v.sUstr, 1) + ' V und ' + f(v.sIstr, 2) + ' A. Die Leistung ist P = √3 · U_L · I_L · cos φ.',
        'Musterlösung: Dreieck, I_Str = ' + f(v.dIstr, 2) + ' A, I_L = √3 · ' + f(v.dIstr, 2) + ' A = ' + f(v.dIl, 2) + ' A. Leistung: ' + f(v.pS, 0) + ' W im Stern, ' + f(v.pD, 0) + ' W im Dreieck, also das ' + f(v.faktor, 0) + '-Fache.'
      ]; },
      start: () => A('drehstrom', Object.assign({}, FIX, { ul: lv('u_aussen') }, START), { fields: { istr: null, il: null, faktor: null } }),
      sol: () => A('drehstrom', Object.assign({}, FIX, { ul: lv('u_aussen'), schaltung: 'dreieck' }), { fields: { istr: vals().dIstr, il: vals().dIl, faktor: vals().faktor }, value: vals().dIstr }),
      wrong: () => { const v = vals(); return [{ name: 'Stern gewählt, Sternwerte', answer: A('drehstrom', Object.assign({}, FIX, { ul: lv('u_aussen'), schaltung: 'stern' }), { fields: { istr: v.sIstr, il: v.sIl, faktor: 1 } }) }, { name: 'Dreieck, aber √3 am falschen Wert', answer: A('drehstrom', Object.assign({}, FIX, { ul: lv('u_aussen'), schaltung: 'dreieck' }), { fields: { istr: v.dIstr, il: v.dIstr, faktor: SQ3 } }) }]; } };
  })();

  /* ====================================================================== ws31: Teil-A-Rechnung "Wechselstrom" (Pool W2024-10) */
  const M31 = (() => {
    const G = { aufbau: 'RL', u: 230, f: 50, r: 22, l: 0.1 };
    const data = () => once('d31', () => {
      const s = C().rlc.series(G), u = G.u, i = s.i, xl = s.xl, z = s.z;
      return { s, u, f: G.f, r: G.r, l: G.l, xl, z, i, cos: s.cosphi, p: s.p, q: s.q, sva: s.s, zAdd: G.r + xl, iAdd: u / (G.r + xl), iNurR: u / G.r, iNurX: u / xl, sin: xl / z, qSin: s.p * Math.sin(s.phi * Math.PI / 180) };
    });
    const rfs = () => once('rf31', () => { const d = data();
      return {
        z: own(d.z, 'Ω', [{ v: d.zAdd, id: 'zadd', text: 'Dein Wert ' + f(d.zAdd, 1) + ' Ω ist R + X_L. Wirk- und Blindwiderstand stehen im rechten Winkel: Z = √(R² + X_L²) = ' + f(d.z, 2) + ' Ω.' }, { v: d.xl, id: 'nurx', text: 'Dein Wert ' + f(d.xl, 1) + ' Ω ist nur der Blindwiderstand X_L. Der Wirkwiderstand R = ' + f(d.r, 0) + ' Ω gehört in die geometrische Summe: Z = √(R² + X_L²) = ' + f(d.z, 2) + ' Ω.' }, { v: d.r, id: 'nurr', text: 'Dein Wert ' + f(d.r, 0) + ' Ω ist nur der Wirkwiderstand R. Die Spule hat bei ' + f(d.f, 0) + ' Hz X_L = ' + f(d.xl, 1) + ' Ω; Z = √(R² + X_L²) = ' + f(d.z, 2) + ' Ω.' }]),
        i: own(d.i, 'A', [{ v: d.iAdd, id: 'iadd', text: 'Dein Wert ' + f(d.iAdd, 2) + ' A folgt aus Z = R + X_L. Mit Z = √(R² + X_L²) = ' + f(d.z, 2) + ' Ω ist I = U / Z = ' + f(d.i, 2) + ' A.' }, { v: d.iNurR, id: 'inurr', text: 'Dein Wert ' + f(d.iNurR, 2) + ' A ist U / R. Die Spule begrenzt den Strom zusätzlich: I = U / Z = ' + f(d.i, 2) + ' A.' }, { v: d.iNurX, id: 'inurx', text: 'Dein Wert ' + f(d.iNurX, 2) + ' A ist U / X_L. Der Wirkwiderstand gehört in Z: I = U / Z = ' + f(d.i, 2) + ' A.' }]),
        cos: own(d.cos, '', [{ v: d.sin, id: 'sin', text: 'Dein Wert ' + f(d.sin, 3) + ' ist X_L / Z, das ist sin φ. Der Leistungsfaktor ist cos φ = R / Z = ' + f(d.cos, 3) + '.' }]),
        p: own(d.p, 'W', [{ v: d.sva, id: 's', text: 'Dein Wert ' + f(d.sva, 0) + ' W passt zu U · I = ' + f(d.sva, 0) + ' VA, das ist die Scheinleistung S. Die Wirkleistung ist P = I² · R = ' + f(d.p, 0) + ' W.' }]),
        q: own(d.q, 'var', [{ v: d.sva, id: 's', text: 'Dein Wert ' + f(d.sva, 0) + ' ist die Scheinleistung S in VA. Die Blindleistung ist Q = I² · X_L = ' + f(d.q, 0) + ' var.' }, { v: d.qSin, id: 'qsin', text: 'Dein Wert ' + f(d.qSin, 0) + ' var passt zu Q = P · sin φ. Aus der Wirkleistung gilt Q = P · tan φ = ' + f(d.q, 0) + ' var.' }])
      }; });
    const vals = () => { const d = data(); return { u: d.u, f: d.f, r: d.r, l: d.l * 1000, xl: d.xl, z: d.z, i: d.i, cos: d.cos, p: d.p, q: d.q, s: d.sva, zAdd: d.zAdd, iAdd: d.iAdd, iNurR: d.iNurR }; };
    const check = mk((r, a) => {
      const R = rfs();
      numRow(r, rawOf(a, 'z'), R.z, 'Der Scheinwiderstand Z (Impedanz) ist richtig', 2);
      numRow(r, rawOf(a, 'i'), R.i, 'Der Strom I ist richtig', 2);
      numRow(r, rawOf(a, 'cos'), R.cos, 'Der Leistungsfaktor cos φ ist richtig', 3);
      numRow(r, rawOf(a, 'p'), R.p, 'Die Wirkleistung P ist richtig', 1);
      numRow(r, rawOf(a, 'q'), R.q, 'Die Blindleistung Q ist richtig', 1);
    });
    const ctl = () => ({ aufbau: 'RL', u: G.u, f: G.f, r: G.r, l: G.l });
    return { vals, check,
      text: () => 'Eine Spule (Übungsschaltung: Wirkwiderstand R = ' + f(G.r, 0) + ' Ω in Reihe mit L = ' + f(G.l * 1000, 0) + ' mH) liegt an ' + C().limitText('u_netz') + ' und ' + C().limitText('f_netz') + '. Berechne den Scheinwiderstand Z (Impedanz), den Strom I, den Leistungsfaktor cos φ, die Wirkleistung P und die Blindleistung Q. Rechne Schritt für Schritt; jeder Teilschritt wird einzeln geprüft.',
      fields: () => [{ key: 'z', label: 'Scheinwiderstand Z', unit: 'Ω' }, { key: 'i', label: 'Strom I', unit: 'A' }, { key: 'cos', label: 'Leistungsfaktor cos φ', unit: '' }, { key: 'p', label: 'Wirkleistung P', unit: 'W' }, { key: 'q', label: 'Blindleistung Q', unit: 'var' }],
      hint: () => { const v = vals(); return [
        'Gehe in der Reihenfolge vor: X_L = 2π · f · L, dann Z = √(R² + X_L²), dann I = U / Z. Der Leistungsfaktor ist cos φ = R / Z. Die Wirkleistung ist P = I² · R, die Blindleistung Q = I² · X_L.',
        'Zwischenwerte: X_L = ' + f(v.xl, 2) + ' Ω, Z = ' + f(v.z, 2) + ' Ω, I = ' + f(v.i, 2) + ' A. Die Scheinleistung S = U · I = ' + f(v.s, 0) + ' VA liegt über P und Q (S² = P² + Q²).',
        'Musterlösung: cos φ = ' + f(v.r, 0) + ' Ω / ' + f(v.z, 2) + ' Ω = ' + f(v.cos, 3) + '; P = ' + f(v.p, 0) + ' W; Q = ' + f(v.q, 0) + ' var. Addierst du R und X_L (' + f(v.zAdd, 1) + ' Ω), ergibt sich nur ' + f(v.iAdd, 2) + ' A.'
      ]; },
      start: () => A('rlc', ctl(), { fields: { z: null, i: null, cos: null, p: null, q: null } }),
      sol: () => { const v = vals(); return A('rlc', ctl(), { fields: { z: v.z, i: v.i, cos: v.cos, p: v.p, q: v.q }, value: v.z }); },
      wrong: () => { const d = data(); return [{ name: 'Z addiert, Folgefehler (Teilschritt vergessen)', answer: A('rlc', {}, { fields: { z: d.zAdd, i: d.iAdd, cos: d.sin, p: d.sva, q: d.sva } }) }, { name: 'nur Wirkwiderstand gerechnet', answer: A('rlc', {}, { fields: { z: d.r, i: d.iNurR, cos: 1, p: d.sva, q: d.qSin } }) }]; } };
  })();

  /* ====================================================================== ws32: Meisterstueck (schwing, Messreihe) */
  const M32 = (() => {
    const FIX = { art: 'reihe', l: 2.2e-3, u: 10, f: 10000, modus: 'durchlauf' }, OWN = ['c', 'r'], F0T = 10000, BT = 500, START = { c: 1e-7, r: 10 }, KOMP = { p: 3200, cos1: 0.8, u: 230, f: 50 };
    const par = () => once('p32', () => { const w = TWO_PI * F0T, c = 1 / (w * w * FIX.l), z0 = Math.sqrt(FIX.l / c), r = BT * TWO_PI * FIX.l; return { c, z0, r, q: z0 / r }; });
    const kompG = () => Object.assign({}, KOMP, { cos2: lv('cos_ziel') });
    const rfK = () => once('rk32', () => ref('cKomp', kompG()));
    const stateOf = ctl => ({ art: 'reihe', l: FIX.l, c: ctl.c, r: ctl.r, u: FIX.u });
    const BER = { name: 'Name ist eingetragen', datum: 'Datum ist eingetragen', schaltung: 'Schaltung ist eingetragen', ergebnis: 'Ergebnis ist eingetragen', bauteile: 'Bauteilwerte sind eingetragen', quelle: 'Quellenspannung ist eingetragen', zeilen: 'Messreihe hat mindestens drei Zeilen', messwerte: 'Messwerte stimmen mit der Rechnung überein', auswertung: 'Auswertung ist ausgefüllt', 'auswertung.f0': 'Resonanzfrequenz f₀ in der Auswertung stimmt', 'auswertung.qg': 'Güte Q_G in der Auswertung stimmt', 'auswertung.b': 'Bandbreite B in der Auswertung stimmt' };
    const vals = () => once('v32', () => { const p = par(), s0 = C().res.series({ l: FIX.l, c: START.c, r: START.r }), K = rfK(); return { l: FIX.l * 1e3, f0: F0T / 1e3, b: BT, c: p.c * 1e9, z0: p.z0, q: p.q, r: p.r, f0Start: s0.f0 / 1e3, bStart: s0.b, cK: K.value * 1e6, cos1: KOMP.cos1, cos2: lv('cos_ziel'), p: KOMP.p, u: KOMP.u }; });
    const berichtOf = (ctl, o) => {
      const g = C().report.generate('schwing', stateOf(ctl), 1), base = C().res.series({ l: FIX.l, c: ctl.c, r: ctl.r, u: FIX.u });
      const e = clone(g.entry);
      e.name = 'Musterlösung'; e.datum = 'heute'; e.ergebnis = 'f₀ = ' + f(base.f0, 0) + ' Hz, Q_G = ' + f(base.qg, 1) + ', B = ' + f(base.b, 0) + ' Hz';
      e.auswertung = { f0: base.f0, qg: base.qg, b: base.b };
      return Object.assign(e, o || {});
    };
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('schwing', ctl), st = s.st, tf = RES_TOL(), tb = AMP_TOL();
      inputRow(r, a, s, 'schwing');
      const f0 = st.f0, b = st.b;
      r(s.ok && fin(f0) && Math.abs(f0 - F0T) <= tf * F0T, 'Der Kreis hat die Resonanzfrequenz f₀ = ' + f(F0T / 1e3, 0) + ' kHz (Toleranz ' + f(100 * tf, 0) + ' %)',
        'Der Kreis hat f₀ = ' + f(f0 / 1e3, 2) + ' kHz, verlangt sind ' + f(F0T / 1e3, 0) + ' kHz (Abweichung ' + f(100 * Math.abs(f0 - F0T) / F0T, 1) + ' %). ' + (f0 < F0T ? 'Bei L = ' + f(FIX.l * 1e3, 1) + ' mH ist die Kapazität zu groß.' : 'Bei L = ' + f(FIX.l * 1e3, 1) + ' mH ist die Kapazität zu klein.'));
      r(s.ok && st.valid !== false && fin(b) && Math.abs(b - BT) <= tb * BT, 'Die Bandbreite beträgt B = ' + f(BT, 0) + ' Hz (Toleranz ' + f(100 * tb, 0) + ' %)',
        fin(b) && st.valid !== false ? 'Mit R = ' + f(ctl.r, 2) + ' Ω ist B = ' + f(b, 0) + ' Hz, verlangt sind ' + f(BT, 0) + ' Hz. ' + (b > BT ? 'B ist zu groß: Ein kleinerer Widerstand verkleinert B.' : 'B ist zu klein: Ein größerer Widerstand vergrößert B.') : 'Der Prüfstand meldet keine Bandbreite (' + (st.text || 'ideal') + ').');
      /* Messreihe: gegen den ausgelegten Kreis (nicht gegen die Angaben im Bericht) */
      const be = obj(a.bericht), en = isObj(be.entry) ? be.entry : be;
      if (!isObj(en) || !Array.isArray(en.zeilen)) { r(false, 'Die Messreihe liegt vor', 'Du hast noch keine Messreihe aufgenommen. Öffne den Tab „Messreihe“, nimm die Messreihe an deinem Kreis auf und trage Name, Datum und die Auswertung ein.'); }
      else {
        const zst = obj(en.zustand), bt = obj(en.bauteile);
        const lC = [['c', ctl.c], ['r', ctl.r], ['l', FIX.l]].filter(p => (fin(numOf(zst[p[0]])) ? Math.abs(numOf(zst[p[0]]) - p[1]) > 0.03 * p[1] : (fin(numOf(bt[p[0]])) ? Math.abs(numOf(bt[p[0]]) - p[1]) > 0.03 * p[1] : false)));
        r(en.rigId === 'schwing' && lC.length === 0, 'Die Messreihe gehört zu deinem ausgelegten Kreis',
          en.rigId !== 'schwing' ? 'Die Messreihe wurde an einer anderen Anlage aufgenommen; verlangt ist der Schwingkreis.' : 'Die Messreihe wurde mit anderen Bauteilwerten aufgenommen (abweichend: ' + lC.map(p => p[0].toUpperCase()).join(', ') + '). Nimm sie nach der Auslegung neu auf.');
        let chk = null;
        try { chk = C().report.check(en, { state: stateOf(ctl) }); } catch (e) { chk = null; }
        if (!chk || !chk.ok || !Array.isArray(chk.items)) r(false, 'Die Messreihe ist prüfbar', (chk && chk.why) || 'Die Messreihe konnte nicht geprüft werden.');
        else chk.items.forEach(it => r(it.ok, BER[it.feld] || ('Messreihe: ' + it.feld), it.text));
      }
      const K = rfK();
      numRow(r, rawOf(a, 'cKomp'), K, 'Der Kompensationskondensator C ist richtig berechnet', 1);
    });
    return { vals, check, consts: [],
      text: () => 'Meisterstück in drei Schritten (Übungsschaltung, ideale Bauteile). (1) Im Prüfstand „Schwingkreis“ ist die Spule mit L = ' + f(FIX.l * 1e3, 1) + ' mH fest. Stelle C und R so ein, dass der Reihenkreis bei f₀ = ' + f(F0T / 1e3, 0) + ' kHz in Resonanz ist (Fenster ' + f(100 * RES_TOL(), 0) + ' %) und eine Bandbreite von B = ' + f(BT, 0) + ' Hz hat (Fenster ' + f(100 * AMP_TOL(), 0) + ' %). (2) Nimm im Tab „Messreihe“ die Messreihe an diesem Kreis auf, trage Name, Datum, f₀, Q_G und B ein und kontrolliere sie. (3) Berechne, welche Kapazität C parallel zu einer Last (P = ' + f(KOMP.p / 1000, 1) + ' kW, cos φ = ' + f(KOMP.cos1, 1) + ', ' + C().limitText('u_netz') + ', ' + C().limitText('f_netz') + ') den Leistungsfaktor auf cos φ = ' + f(lv('cos_ziel'), 2) + ' bringt (Zielwert ist ein Übungswert). Trage C in µF ein.',
      fields: () => [{ key: 'cKomp', label: 'Kompensationskondensator C', unit: 'µF' }],
      table: () => ({ caption: 'Vorgaben', head: ['Größe', 'Wert'], rows: [['Resonanzfrequenz f₀', f(F0T / 1e3, 0) + ' kHz'], ['Bandbreite B', f(BT, 0) + ' Hz'], ['Spule L', f(FIX.l * 1e3, 1) + ' mH (fest)'], ['Quellenspannung', f(FIX.u, 0) + ' V']] }),
      hint: () => { const v = vals(); return [
        'Schritt 1: C folgt aus f₀ = 1 / (2π · √(L · C)), der Widerstand aus der Bandbreite: B = R / (2π · L). Schritt 2: Die Messreihe nimmt das Lab aus deinem Aufbau auf; die Kennwerte f₀, Q_G und B trägst du selbst in die Auswertung ein (Q_G = f₀ / B). Schritt 3: C = P · (tan φ₁ − tan φ₂) / (2π · f · U²).',
        'Mit der Startschaltung liegt f₀ bei ' + f(v.f0Start, 2) + ' kHz und B bei ' + f(v.bStart, 0) + ' Hz, beides daneben. Für die Vorgabe wird Z₀ = ' + f(v.z0, 1) + ' Ω; die Güte ist Q_G = ' + f(v.q, 0) + '.',
        'Musterlösung: C = ' + f(v.c, 2) + ' nF, R = B · 2π · L = ' + f(v.r, 2) + ' Ω (Q_G = ' + f(v.q, 0) + '). Kompensation von cos φ ' + f(v.cos1, 1) + ' auf ' + f(v.cos2, 2) + ': C = ' + f(v.cK, 1) + ' µF.'
      ]; },
      start: () => A('schwing', Object.assign({}, FIX, START, { ziel: F0T, zielB: BT }), { fields: { cKomp: null } }),
      sol: () => { const p = par(), ctl = { c: p.c, r: p.r }; return A('schwing', Object.assign({}, FIX, ctl, { ziel: F0T, zielB: BT }), { fields: { cKomp: vals().cK }, value: vals().cK, bericht: berichtOf(ctl) }); },
      wrong: () => {
        const p = par(), ctl = { c: p.c, r: p.r }, full = berichtOf(ctl), kv = vals().cK;
        const thin = clone(full); thin.zeilen = thin.zeilen.slice(0, 2); thin.name = ''; thin.auswertung = {};
        const fehl = clone(full); fehl.zeilen[3] = Object.assign({}, fehl.zeilen[3], { z: fehl.zeilen[3].z * TWO_PI }); fehl.auswertung = Object.assign({}, fehl.auswertung, { f0: fehl.auswertung.f0 * TWO_PI });
        return [
          { name: 'Messreihe unvollständig', answer: A('schwing', Object.assign({}, FIX, ctl), { fields: { cKomp: kv }, bericht: thin }) },
          { name: 'Fehlwert in der Messreihe (2π falsch)', answer: A('schwing', Object.assign({}, FIX, ctl), { fields: { cKomp: kv }, bericht: fehl }) },
          { name: 'Kreis nicht ausgelegt, Kompensation zu klein', answer: A('schwing', Object.assign({}, FIX, START), { fields: { cKomp: kv * 0.5 }, bericht: full }) }
        ];
      } };
  })();

  /* ====================================================================== Registrierung */
  const tasks = [
    tk({ id: 'ws17', lab: 'wsl', cat: 'Prüfungsnah', title: 'Resonanzfrequenz berechnen', level: 1, rig: 'schwing' }, M17),
    tk({ id: 'ws18', lab: 'wsl', cat: 'Prüfungsnah', title: 'Kapazität für Resonanz', level: 2, rig: 'schwing' }, M18),
    tk({ id: 'ws19', lab: 'wsl', cat: 'Schwingkreis', title: 'Reihenkreis auf f₀ abstimmen', level: 2, rig: 'schwing' }, M19),
    tk({ id: 'ws20', lab: 'wsl', cat: 'Schwingkreis', title: 'Bandbreite einstellen', level: 3, rig: 'schwing' }, M20),
    tk({ id: 'ws21', lab: 'wsl', cat: 'Prüfungsnah', title: 'Reihe oder Parallel?', level: 1, rig: 'schwing' }, M21),
    tk({ id: 'ws22', lab: 'wsl', cat: 'Prüfungsnah', title: 'Grenzfrequenz berechnen', level: 1, rig: 'filter' }, M22),
    tk({ id: 'ws23', lab: 'wsl', cat: 'Prüfungsnah', title: 'Hochpass oder Tiefpass?', level: 1, rig: 'filter' }, M23),
    tk({ id: 'ws24', lab: 'wsl', cat: 'Prüfungsnah', title: 'Koppelkondensator dimensionieren', level: 3, rig: 'filter' }, M24),
    tk({ id: 'ws25', lab: 'wsl', cat: 'Prüfungsnah', title: 'Was gilt bei f_g?', level: 2, rig: 'filter' }, M25),
    tk({ id: 'ws26', lab: 'wsl', cat: 'Prüfungsnah', title: 'Siebglied berechnen', level: 3, rig: 'filter' }, M26),
    tk({ id: 'ws27', lab: 'wsl', cat: 'Transformator', title: 'Übersetzungsverhältnis', level: 1, rig: 'trafo' }, M27),
    tk({ id: 'ws28', lab: 'wsl', cat: 'Prüfungsnah', title: 'Primärstrom', level: 2, rig: 'trafo' }, M28),
    tk({ id: 'ws29', lab: 'wsl', cat: 'Prüfungsnah', title: 'Trafo an Gleichspannung', level: 2, rig: 'trafo' }, M29),
    tk({ id: 'ws30', lab: 'wsl', cat: 'Drehstrom', title: 'Stern oder Dreieck?', level: 2, rig: 'drehstrom' }, M30),
    tk({ id: 'ws31', lab: 'wsl', cat: 'Prüfungsnah', title: 'Teil-A-Rechnung Wechselstrom', level: 3, rig: 'rlc' }, M31),
    tk({ id: 'ws32', lab: 'wsl', cat: 'Meisterstück', title: 'Meisterstück: Der Labortisch-Wechselstrom', level: 3, rig: 'schwing' }, M32)
  ];
  const MODS = { ws17: M17, ws18: M18, ws19: M19, ws20: M20, ws21: M21, ws22: M22, ws23: M23, ws24: M24, ws25: M25, ws26: M26, ws27: M27, ws28: M28, ws29: M29, ws30: M30, ws31: M31, ws32: M32 };
  /* Musterwerte der Aufgaben (Schwellen aus den Musterloesungen, SPEC 8: Schwellwerte aus der Musterloesung) */
  T.thresholds2 = function () { const o = {}; Object.keys(MODS).forEach(k => { try { o[k] = MODS[k].vals(); } catch (e) { o[k] = { error: String(e && e.message || e) }; } }); return o; };
  T.register(tasks);
  if (typeof module !== 'undefined') module.exports = { tasks };
})(typeof window !== 'undefined' ? window : globalThis);
