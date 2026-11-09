/* anatasks2.js - ANA-Lab (Analogtechnik: Halbleiter und Verstaerker): Aufgaben ae17 bis ae32 (OPV-Schaltungen) mit automatischer Pruefung (ohne Browser lauffaehig) (WP4b)
 * Registrierung: ANA_TASKS.register([ ... ]) (ANA_TASKS kommt aus anadata.js; anadata.js VOR dieser Datei laden, in Node holt sich die Datei es per require).
 * Format wie SPEC 8 / wsltasks2.js: { id:'aeN', lab:'ana', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(),
 *   fields? | choices?, consts? }; answer = { rig, controls, ref, seq, rows, state, fired, value, text, fields, choices, diagnose, clicks, bericht }.
 *   start() und sol() liefern { rig, controls, fields?, choices?, bericht?, lock?, hidden? } (Startvorlage und Musterloesung / Auto-Weg); lock und hidden gelten nur fuer
 *   Fehlersuche-Aufgaben (SPEC 5.0, 6.5: verdeckter Fehler, die Oberflaeche setzt rig.setLock / rig.setHidden); wrong() liefert mindestens zwei absichtlich falsche
 *   Antworten [{ name, answer }] (beide Richtungen, Regel 3); check(answer) liefert [{ ok, text, why }]; Prozent der Treffer = Ergebnis.
 * Diese Datei ist bewusst eigenstaendig: Sie braucht von anadata.js nur register(); Hilfsfunktionen (Simulation, Zeilen, Zahlenpruefung) stehen unten.
 * Rechnen nur ueber ANA_CORE (exercise.solve, op, komp, act, deep, faults, report, runSeq, limit); die Pruefstaende rechnen selbst nur ueber den Kern.
 * Schwellen: aus der gerechneten Musterloesung; Fenster nur aus limits (fenster_op_gruen 2 %, fenster_gruen 5 %, Uebungswerte A, F16). ANA_TASKS.thresholds2() nennt die Musterwerte.
 * Kategorien (gemeinsames Set mit anatasks1.js): Pool-Aufgaben "Pruefungsnah" (ae17 bis ae23, ae25, ae26, ae28, ae29), ae27 "Komparator und Schmitt-Trigger",
 *   ae30 und ae31 "Aktive Schaltungen", ae24 und ae32 "Fehlersuche". Aufgaben ohne Pool-Bezug (ae27, ae30, ae31, ae32) tragen kein Pruefungsjahr.
 * Fehlersuche (ae24, ae32): Der Fehler wird verdeckt gesetzt (start() liefert hidden:['fehler'], ae24 zusaetzlich lock:['fehler']); Text, Tipps und Antwortlisten nennen ihn
 *   nie; die Pruefung nennt bei falscher Wahl nur, was die gewaehlte Ursache messen liesse, nicht die richtige Ursache (Wiederholung bleibt moeglich).
 * Abweichungen von der SPEC (siehe ABWEICHUNGEN.md, Abschnitt WP4b):
 *   ae24 heisst "Fehlersuche: Der Ausgang stimmt nicht" (der SPEC-Titel haette die Ursache verraten); ae32 haelt den Fehler verdeckt, aber nicht gesperrt: erst Diagnose,
 *   dann Aufloesung zeigen und Fehler auf "keiner" stellen, dann auslegen, Messreihe aufnehmen (sonst waere kein Aufbau messbar); ae18/ae19/ae21/ae22/ae23/ae25/ae26/ae31
 *   pruefen zusaetzlich einen Zwischenschritt; ae20 und ae28 stellen die Pool-Frage als Auswahl. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.ANA_TASKS) nodeReq('./anadata.js');
  const T = root.ANA_TASKS;
  if (!T || typeof T.register !== 'function') { if (typeof console !== 'undefined') console.warn('anatasks2.js: anadata.js fehlt, die Aufgaben ae17 bis ae32 werden nicht angemeldet.'); return; }

  /* ====================================================================== Hilfsfunktionen */
  const RIGFILES = ['./anadraw.js', './anarig-base.js', './anarig-diode.js', './anarig-schalter.js', './anarig-emitter.js', './anarig-folger.js', './anarig-opvinv.js', './anarig-opvnin.js', './anarig-opvkomp.js', './anarig-opvaktiv.js'];
  const core = () => { if (!root.ANA_CORE) { const m = nodeReq('./anacore-res.js'); if (!root.ANA_CORE && m) root.ANA_CORE = m; } return root.ANA_CORE || null; };
  const rigs = id => { let R = root.ANA_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { core(); RIGFILES.forEach(nodeReq); R = root.ANA_RIGS; } return R || null; };
  const C = () => { const c = core(); if (!c || !c.exercise || !c.op || !c.komp || !c.act || !c.report || !c.runSeq || !c.faults) throw new Error('Rechenkern fehlt'); return c; };
  const fin = x => typeof x === 'number' && isFinite(x);
  const isObj = x => !!x && typeof x === 'object' && !Array.isArray(x);
  const obj = x => (isObj(x) ? x : {});
  const clone = o => JSON.parse(JSON.stringify(o));
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const f = (x, d) => (fin(x) ? C().fmt(x, d == null ? 2 : d) : '–');
  const fs = (x, d) => f(x, d).replace(/^-/, '−');          // Zahl mit echtem Minuszeichen
  const lv = id => C().limit(id).value;
  const A = (rig, controls, extra) => Object.assign({ rig, controls: controls || {} }, extra || {});
  const TWO_PI = 2 * Math.PI;
  const OP_TOL = () => lv('fenster_op_gruen');   // 2 % (A, F16)
  const AMP_TOL = () => lv('fenster_gruen');     // 5 % (A, F16)
  const RECH_TOL = 0.03;                         // Rechenaufgaben 3 % (Regel 4: Tabellenbuch-Rundungen)
  const eng = (x, u) => C().fmtEng(x, u);
  const rname = id => { const R = rigs(id), d = R && R.defs && R.defs[id]; return d ? d.name : id; };

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

  /* ---------- Simulation: Beharrungszustand eines Pruefstands ueber ANA_CORE.runSeq (Seed 1, gecacht) ---------- */
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
  const numOf = v => { if (fin(v)) return v; if (typeof v === 'string' && v.trim() !== '') { const x = C().parseNum(v.replace(/[−–]/g, '-')); return fin(x) ? x : NaN; } return NaN; };
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
      const d = rname(rigId), d2 = rname(a.rig);
      errs.push('Die Aufgabe gehört zum Prüfstand „' + d + '“, im Prüfstand-Tab ist aber „' + d2 + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }

  /* ---------- Zahlenzeilen ---------- */
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 's', 'S', 'dB', 'V/s', 'V/µs', 'V/μs', 'V/us'];
  const UALIAS = { Ohm: 'Ω', ohm: 'Ω', 'V/µs': 'V/s', 'V/μs': 'V/s', 'V/us': 'V/s' };
  function baseUnit(u) {
    if (!u) return '';
    if (ULIST.indexOf(u) >= 0) return UALIAS[u] || u;
    if (u.length >= 2 && 'TGMkKmµμunp'.indexOf(u[0]) >= 0 && ULIST.indexOf(u.slice(1)) >= 0) return UALIAS[u.slice(1)] || u.slice(1);
    return '';
  }
  /* Eingabe lesen: Zahl, Text mit Einheit ("4,7 kΩ", "-20 V/s", auch mit echtem Minuszeichen) oder leer; parseQty liefert den SI-Wert */
  function parseAns(raw) {
    if (fin(raw)) return { v: raw, hasUnit: false, unit: '' };
    if (typeof raw !== 'string') return null;
    const s = raw.replace(/[−–]/g, '-').trim();
    if (s === '') return null;
    const v = C().parseQty(s);
    if (!fin(v)) return null;
    const m = /^[+-]?\s*(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:[eE][+-]?\d+)?\s*(.*)$/.exec(s), unit = m ? m[1].trim() : '';
    return { v, hasUnit: unit !== '', unit };
  }
  /* Referenz aus dem Kern: exercise.solve (Wert in SI, Tabellenbuch-Varianten alt, Fehlerbilder mit Text) */
  function ref(kind, given, tol) {
    const s = C().exercise.solve(kind, given);
    if (!s || !s.ok) throw new Error('Rechenkern: Aufgabenart ' + kind + ' fehlt');
    return { value: s.value, alts: (s.alt || []).slice(), wrongs: (s.wrong || []).map(w => ({ v: w.value, id: w.id, text: w.text })), factor: s.disp.factor, dispUnit: s.disp.unit, unit: s.unit, disp: s.disp.value, tol: tol || (fin(s.tol) ? s.tol : RECH_TOL) };
  }
  /* Eigene Referenz (Wert aus dem Kern, Fehlerbilder aus dem Kern oder gerechnet) */
  const own = (value, unit, wrongs, o) => Object.assign({ value, alts: [], wrongs: wrongs || [], factor: 1, dispUnit: unit || '', unit: unit || '', disp: value, tol: RECH_TOL }, o || {});
  /* Warum-Text fuer einen Wert, der zu keinem bekannten Fehlerbild passt: sagt nur, was verglichen wurde (Regel 2 und 3) */
  function genericWhy(x, v, dg) {
    if (x !== 0 && v !== 0 && fin(x) && fin(v)) {
      const ra = x / v;
      if (ra < 0 && Math.abs(Math.abs(ra) - 1) < 0.03) return 'Der Betrag deines Werts stimmt, das Vorzeichen nicht. Prüfe, ob die Größe positiv oder negativ ist (Phasendrehung beim Invertierer).';
      if (ra > 0) {
        const lr = Math.log(ra) / Math.LN10;
        if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) return 'Prüfe den Vorsatz: Dein Wert weicht um den Faktor ' + (Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')') + ' vom Ergebnis ab (µ, m, k, M).';
        if (Math.abs(ra / TWO_PI - 1) < 0.03 || Math.abs(ra * TWO_PI - 1) < 0.03) return 'Dein Wert passt zu einer Rechnung mit falschem Faktor 2π (oder ω statt f). Die Frequenz hängt über ω = 2π · f mit der Kreisfrequenz zusammen.';
        if (ra < 1) return 'Dein Wert ist zu klein: Er liegt ' + f((1 - ra) * 100, 0) + ' % unter dem Ergebnis. Rechne die Schritte noch einmal nach.';
        return 'Dein Wert ist zu groß: Er liegt ' + f((ra - 1) * 100, 0) + ' % über dem Ergebnis. Rechne die Schritte noch einmal nach.';
      }
    }
    return x < v ? 'Dein Wert ist zu klein. Rechne die Schritte noch einmal nach.' : 'Dein Wert ist zu groß. Rechne die Schritte noch einmal nach.';
  }
  /* Zahlenzeile: raw = Eingabe (Zahl, Text oder null); rf = Referenz */
  function numRow(r, raw, rf, label, d) {
    const tol = rf.tol, dg = d == null ? 2 : d, q = parseAns(raw);
    const tolTxt = 'Toleranz ' + f(100 * tol, 0) + ' %';
    if (!q || !fin(q.v)) { r(false, label + ' (' + tolTxt + ')', typeof raw === 'string' && raw.trim() !== '' ? 'Das ist keine Zahl. Gib das Ergebnis als Zahl mit Einheit ein, zum Beispiel 4,7 kΩ.' : 'Du hast keine Zahl eingetragen.'); return false; }
    if (q.hasUnit && !rf.unit && baseUnit(q.unit)) { r(false, label + ' (' + tolTxt + ')', 'Die Einheit passt nicht: Gesucht ist eine Zahl ohne Einheit.'); return false; }
    if (q.hasUnit && rf.unit) { const b = baseUnit(q.unit); if (b && b !== rf.unit) { r(false, label + ' (' + tolTxt + ')', 'Die Einheit passt nicht: Gesucht ist eine Größe in ' + rf.unit + '.'); return false; } }
    const cands = [q.v]; if (!q.hasUnit && rf.factor !== 1) cands.push(q.v * rf.factor);
    const refs = [rf.value].concat(rf.alts);
    const close = (x, y) => Math.abs(x - y) <= tol * Math.abs(y) + 1e-300;
    if (cands.some(c => refs.some(y => close(c, y)))) { r(true, label + ' (' + tolTxt + ')', ''); return true; }
    let x = cands[0];
    if (cands.length > 1 && rf.value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / rf.value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / rf.value))); if (l1 < l0) x = cands[1]; }
    let why = null;
    for (let k = 0; k < rf.wrongs.length && why === null; k++) { const w = rf.wrongs[k]; if (cands.some(c => close(c, w.v))) why = w.text; }
    if (why === null) why = genericWhy(x, rf.value, dg);
    r(false, label + ' (' + tolTxt + ')', why);
    return false;
  }
  const rawOf = (a, key) => { const fo = obj(a.fields); const v = Object.prototype.hasOwnProperty.call(fo, key) ? fo[key] : undefined; return v === undefined || v === null || v === '' ? null : v; };
  const choiceOf = (a, key) => { const c = obj(a.choices); const v = Object.prototype.hasOwnProperty.call(c, key) ? c[key] : undefined; return v === undefined || v === null || v === '' ? null : v; };
  /* Auswahlzeilen: specs = [{ key, q, short, right, options:[{ value, label, grund }] }]; jede Antwort traegt einen Fachgrund mit Zahlen aus dem Kern (Audit) */
  function choiceRows(r, a, specs) {
    specs.forEach(sp => {
      const got = choiceOf(a, sp.key), rt = sp.options.find(o => o.value === sp.right), gt = got === null ? null : sp.options.find(o => String(o.value) === String(got));
      r(gt !== undefined && gt !== null && gt.value === sp.right, sp.short,
        got === null ? 'Wähle eine Antwort aus.' : !gt ? 'Deine Auswahl gehört nicht zu den Antworten. Richtig ist „' + rt.label + '“.' : 'Du hast „' + gt.label + '“ gewählt: ' + gt.grund + ' Richtig ist „' + rt.label + '“: ' + rt.grund);
    });
  }
  /* Fehlersuche: wie choiceRows, aber ohne die richtige Ursache zu nennen (die Aufgabe kann wiederholt werden); "ursache" liest auch answer.diagnose */
  function faultRows(r, a, specs) {
    specs.forEach(sp => {
      let got = choiceOf(a, sp.key);
      if (got === null && sp.key === 'ursache' && typeof a.diagnose === 'string' && a.diagnose) got = a.diagnose;
      const gt = got === null ? null : sp.options.find(o => String(o.value) === String(got));
      if (gt && gt.value === sp.right) r(true, sp.short, '');
      else r(false, sp.short, got === null ? 'Wähle eine Antwort aus (bei der Ursache geht auch „Diagnose abgeben“).' : !gt ? 'Deine Auswahl gehört nicht zu den Antworten.' : gt.grund + ' Miss weiter, vergleiche mit deinen Messwerten und wähle neu.');
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

  /* ---------- Fehlersuche: Auswahl der Ursache aus faults.list, Gruende aus faults.predict (Messbilder je Fehlerfall, nur Zahlen) ---------- */
  const FNOTE = {
    'rf offen': 'Ist die Verbindung vom Ausgang zum invertierenden Eingang unterbrochen, arbeitet der Operationsverstärker ohne Gegenkopplung mit seiner Leerlaufverstärkung: Schon kleine Eingangsspannungen treiben den Ausgang an eine Aussteuergrenze.',
    'rg offen': 'Fehlt der Widerstand von R_g nach Masse, entfällt der Spannungsteiler in der Gegenkopplung: Es bleibt V_u = 1 (Spannungsfolger), U_a folgt U_e.',
    'versorgung minus fehlt': 'Ohne negative Versorgung kann der Ausgang nicht unter 0 V; bei positiver Eingangsspannung und positivem Sollwert ändert sich nichts, deshalb fällt dieser Fehler nur bei negativem Ausgang auf.',
    'versorgung fehlt': 'Ohne Versorgung liefert der Operationsverstärker keinen Ausgang: U_a = 0 V, auch wenn die Rechnung ein anderes Ergebnis erwartet.',
    'versorgung verpolt': 'Bei verpolter Versorgung ist der Operationsverstärker im Lehrmodell zerstört: U_a = 0 V (nur Simulation).',
    'eingang offen': 'Ist der Eingang nicht angeschlossen (U_e = 0), liegt der Ausgang bei 0 V, obwohl die Quelle eine Spannung liefern soll.',
    'r1 offen': 'Ohne R_1 fließt kein Eingangsstrom, der Ausgang bleibt bei etwa 0 V und der Eingangswiderstand r_ein ist unbegrenzt.',
    'rf kurz': 'Mit kurzgeschlossenem R_f ist V_u = 0: Der Ausgang bleibt bei etwa 0 V (der Ausgang ist direkt mit dem invertierenden Eingang verbunden).',
    'ausgang defekt': 'Bei defektem Ausgang hängt U_a (im Lehrmodell) an der positiven Aussteuergrenze, unabhängig vom Eingang.'
  };
  function faultSpec(o) {
    const list = C().faults.list(o.rigId), pr = {};
    list.forEach(x => { const p = C().faults.predict(o.rigId, x.id, o.ctl); if (!p || !p.ok) throw new Error('faults.predict: ' + x.id); pr[x.id] = p; });
    const rp = pr[o.right];
    const meas = (p, id) => (typeof o.measText === 'function' ? o.measText(id, p) : 'U_a = ' + eng(p.meas.ua, 'V') + (Math.abs(p.meas.v) < 1e4 ? ' und V_u = ' + f(p.meas.v, 2) : ' und V_u über 10 000'));
    return {
      key: o.key || 'ursache', q: o.q, short: o.short, right: o.right,
      options: list.map(x => ({
        value: x.id, label: x.label,
        grund: x.id === o.right
          ? 'Das passt: Bei diesem Fehlerbild misst du ' + meas(rp, o.right) + ', genau das zeigen deine Messgeräte. ' + (FNOTE[x.id] || '')
          : 'Läge „' + x.label + '“ vor, würdest du ' + meas(pr[x.id], x.id) + ' messen (Simulation). Du misst aber ' + meas(rp, o.right) + '. ' + (FNOTE[x.id] || '')
      })),
      pred: pr
    };
  }

  /* ====================================================================== ae17: Verstaerkung des Invertierers (Pool F2025-17, H2021-N25) */
  const M17 = (() => {
    const GA = { r1: 4700, rf: 47000 }, GB = { r1: 22000, rf: 68000 };
    const rA = () => once('r17a', () => ref('vInv', GA)), rB = () => once('r17b', () => ref('vInv', GB));
    const wr = (R, id) => R.wrongs.find(w => w.id === id);
    const vals = () => once('v17', () => ({ r1a: GA.r1 / 1e3, rfa: GA.rf / 1e3, va: rA().value, r1b: GB.r1 / 1e3, rfb: GB.rf / 1e3, vb: rB().value, vaNin: wr(rA(), 'nin-formel').v, vbNin: wr(rB(), 'nin-formel').v, vaOhne: wr(rA(), 'vorzeichen-vu-inv').v, vbOhne: wr(rB(), 'vorzeichen-vu-inv').v, phi: lv('opv_inv_phase') }));
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'va'), rA(), 'Die Verstärkung V_u der Schaltung A ist richtig berechnet (mit Vorzeichen)', 2);
      numRow(r, rawOf(a, 'vb'), rB(), 'Die Verstärkung V_u der Schaltung B ist richtig berechnet (mit Vorzeichen)', 2);
    });
    const ctl = G => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: 0.5, r1: G.r1, rf: G.rf });
    return { vals, check, consts: [],
      text: () => 'Zwei invertierende Verstärker mit idealem Operationsverstärker (Übungsschaltungen). Schaltung A: R_1 = ' + eng(GA.r1, 'Ω') + ', R_f = ' + eng(GA.rf, 'Ω') + '. Schaltung B: R_1 = ' + eng(GB.r1, 'Ω') + ', R_f = ' + eng(GB.rf, 'Ω') + '. Berechne jeweils die Spannungsverstärkung V_u mit Vorzeichen. Im Prüfstand „' + rname('opv_inv') + '“ kannst du beide Schaltungen nachstellen und V_u am Messgerät vergleichen.',
      fields: () => [{ key: 'va', label: 'V_u der Schaltung A', unit: '' }, { key: 'vb', label: 'V_u der Schaltung B', unit: '' }],
      hint: () => { const v = vals(); return [
        'Beim invertierenden Verstärker liegt der Eingang über R_1 am invertierenden Eingang, R_f führt vom Ausgang dorthin zurück. Die Verstärkung ist V_u = −R_f / R_1, mit Minus (Phasendrehung), und nicht 1 + R_f / R_1.',
        'Schaltung A: R_f / R_1 = ' + f(v.rfa, 0) + ' kΩ / ' + f(v.r1a, 1) + ' kΩ = ' + f(Math.abs(v.va), 0) + '; das Minuszeichen steht für die Phasendrehung um ' + f(v.phi, 0) + '°. Schaltung B: ' + f(v.rfb, 0) + ' kΩ / ' + f(v.r1b, 0) + ' kΩ = ' + f(Math.abs(v.vb), 2) + '.',
        'Musterlösung: V_u(A) = −' + f(v.rfa, 0) + ' kΩ / ' + f(v.r1a, 1) + ' kΩ = ' + fs(v.va, 0) + ', V_u(B) = −' + f(v.rfb, 0) + ' kΩ / ' + f(v.r1b, 0) + ' kΩ = ' + fs(v.vb, 2) + '. Ohne Minus käme +' + f(v.vaOhne, 0) + ', mit der Formel des Nichtinvertierers (1 + R_f / R_1) wären es ' + f(v.vaNin, 0) + '.'
      ]; },
      start: () => A('opv_inv', ctl(GA), { fields: { va: null, vb: null } }),
      sol: () => A('opv_inv', ctl(GA), { fields: { va: vals().va, vb: vals().vb }, value: vals().va }),
      wrong: () => { const v = vals(); return [{ name: 'Vorzeichen vergessen (zu groß)', answer: A('opv_inv', {}, { fields: { va: v.vaOhne, vb: v.vbOhne } }) }, { name: '1 + R_f / R_1 benutzt', answer: A('opv_inv', {}, { fields: { va: v.vaNin, vb: v.vbNin } }) }]; } };
  })();

  /* ====================================================================== ae18: Rueckkopplungswiderstand (Pool H2022-N06) */
  const M18 = (() => {
    const G = { ue: 0.2, ua: -3, r1: 5000 };
    const vV = () => Math.round(G.ua / G.ue * 1e6) / 1e6;
    const rfRef = () => once('r18', () => {
      const R = ref('rfInv', { v: vV(), r1: G.r1 }), tx = { 'rf-r1-vertauscht': 'Dein Wert passt zu R_1 / |V_u|: Die Widerstände sind vertauscht. Aus V_u = −R_f / R_1 folgt R_f = |V_u| · R_1.', 'plus-eins-falsch': 'Dein Wert passt zu (|V_u| + 1) · R_1. Das ist die Rechnung des nichtinvertierenden Verstärkers; beim Invertierer gilt R_f = |V_u| · R_1.' };
      const w = []; R.wrongs.forEach(x => { w.push({ v: Math.abs(x.v), id: x.id, text: tx[x.id] || x.text }); });
      w.push({ v: -R.value, id: 'negativ', text: 'Ein Widerstand ist nie negativ: Das Minuszeichen gehört zu V_u = −R_f / R_1, R_f selbst ist positiv.' });
      R.wrongs = w; return R;
    });
    const vRef = () => once('r18v', () => own(vV(), '', [{ v: -vV(), id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der Ausgang ist negativ, der Eingang positiv, also ist V_u = U_a / U_e negativ.' }, { v: 1 / vV(), id: 'kehrwert', text: 'Dein Wert ist der Kehrwert: V_u = U_a / U_e, also Ausgang durch Eingang.' }]));
    const vals = () => once('v18', () => { const R = rfRef(), w = id => R.wrongs.find(x => x.id === id); return { ue: G.ue, ua: G.ua, r1: G.r1 / 1e3, v: vV(), rf: R.value / 1e3, rfOhm: R.value, tauschK: w('rf-r1-vertauscht').v / 1e3, tauschOhm: w('rf-r1-vertauscht').v, plusK: w('plus-eins-falsch').v / 1e3 }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'v'), vRef(), 'Die Verstärkung V_u = U_a / U_e ist richtig berechnet (mit Vorzeichen)', 2);
      numRow(r, rawOf(a, 'rf'), rfRef(), 'Der Rückkopplungswiderstand R_f ist richtig berechnet', 2);
    });
    const ctl = () => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: G.ue, r1: G.r1, rf: 47000 });
    return { vals, check, consts: [],
      text: () => 'Ein invertierender Verstärker mit idealem Operationsverstärker soll aus der Eingangsspannung U_e = ' + eng(G.ue, 'V') + ' die Ausgangsspannung U_a = −' + eng(-G.ua, 'V') + ' erzeugen. Der Eingangswiderstand beträgt R_1 = ' + eng(G.r1, 'Ω') + ' (Übungsschaltung). Berechne zuerst die nötige Verstärkung V_u und dann den Rückkopplungswiderstand R_f. Trage R_f in kΩ ein.',
      fields: () => [{ key: 'v', label: 'Verstärkung V_u', unit: '' }, { key: 'rf', label: 'Rückkopplungswiderstand R_f', unit: 'kΩ' }],
      hint: () => { const v = vals(); return [
        'Die Verstärkung ist V_u = U_a / U_e. Beim invertierenden Verstärker gilt V_u = −R_f / R_1, also R_f = −V_u · R_1. Das Minuszeichen von V_u hebt sich auf: R_f ist positiv.',
        'Rechne erst V_u = ' + fs(v.ua, 0) + ' V / ' + f(v.ue, 1) + ' V = ' + fs(v.v, 0) + '. Dann R_f = ' + f(Math.abs(v.v), 0) + ' · ' + f(v.r1, 0) + ' kΩ. Das Ergebnis liegt deutlich über R_1.',
        'Musterlösung: V_u = ' + fs(v.v, 0) + ', R_f = ' + f(Math.abs(v.v), 0) + ' · ' + f(v.r1, 0) + ' kΩ = ' + f(v.rf, 0) + ' kΩ. Vertauschst du die Widerstände, kommt ' + f(v.tauschOhm, 0) + ' Ω heraus, mit „+1“ wie beim Nichtinvertierer ' + f(v.plusK, 0) + ' kΩ.'
      ]; },
      start: () => A('opv_inv', ctl(), { fields: { v: null, rf: null } }),
      sol: () => A('opv_inv', Object.assign(ctl(), { rf: vals().rfOhm }), { fields: { v: vals().v, rf: vals().rf }, value: vals().rf }),
      wrong: () => { const v = vals(); return [{ name: 'Widerstände vertauscht (zu klein)', answer: A('opv_inv', {}, { fields: { v: v.v, rf: v.tauschK } }) }, { name: 'Formel des Nichtinvertierers (zu groß)', answer: A('opv_inv', {}, { fields: { v: v.v, rf: v.plusK } }) }, { name: 'Vorzeichen von V_u vergessen', answer: A('opv_inv', {}, { fields: { v: -v.v, rf: v.rf } }) }]; } };
  })();

  /* ====================================================================== ae19: Summierer (Pool W2025-11) */
  const M19 = (() => {
    const G = { rf: 47000, r1: 10000, r2: 22000, u1: 0.5, u2: 1.1 };
    const sumC = () => once('s19', () => C().op.sum({ rf: G.rf, r: [G.r1, G.r2], u: [G.u1, G.u2], opv: 'ideal' }));
    const rfUa = () => once('r19', () => ref('uaSumm', G));
    const rfI = () => once('r19i', () => { const s = sumC(), tot = s.i[0] + s.i[1]; return own(tot, 'A', [{ v: s.i[0], id: 'ein-eingang', text: 'Dein Wert (' + f(s.i[0] * 1e6, 0) + ' µA) ist nur der Strom eines Eingangs. Der Summierer addiert die Ströme beider Eingänge: I = U_1 / R_1 + U_2 / R_2.' }, { v: G.u1 + G.u2, id: 'spannungen', text: 'Dein Wert passt zur Summe der Spannungen. Jede Spannung treibt über ihren eigenen Widerstand einen Strom: I_k = U_k / R_k, und diese Ströme werden addiert.' }], { factor: 1e-6, dispUnit: 'µA', disp: tot * 1e6 }); });
    const vals = () => once('v19', () => { const s = sumC(), R = rfUa(), w = id => R.wrongs.find(x => x.id === id); return { rf: G.rf / 1e3, r1: G.r1 / 1e3, r2: G.r2 / 1e3, u1: G.u1, u2: G.u2, i1: s.i[0] * 1e6, i2: s.i[1] * 1e6, iSum: (s.i[0] + s.i[1]) * 1e6, ua: R.value, uaPlus: w('vorzeichen-ua').v, uaEin: w('nur-ein-eingang').v, uaSumme: w('summe-statt-gewichtet').v }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'i'), rfI(), 'Der Summenstrom I_f ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'ua'), rfUa(), 'Die Ausgangsspannung U_a ist richtig berechnet (mit Vorzeichen)', 2);
    });
    const ctl = () => ({ schaltung: 'summierer', opv: 'ideal', uv: 12, ue: G.u1, ue2: G.u2, ue3: 0, r1: G.r1, r2: G.r2, rf: G.rf });
    return { vals, check, consts: [],
      text: () => 'Ein Summierer mit idealem Operationsverstärker (±12 V) hat den Rückkopplungswiderstand R_f = ' + eng(G.rf, 'Ω') + '. Die Spannung U_1 = ' + eng(G.u1, 'V') + ' liegt über R_1 = ' + eng(G.r1, 'Ω') + ', die Spannung U_2 = ' + eng(G.u2, 'V') + ' über R_2 = ' + eng(G.r2, 'Ω') + ' am invertierenden Eingang (Übungsschaltung). Berechne den Summenstrom I_f durch R_f (in µA) und die Ausgangsspannung U_a mit Vorzeichen. Im Prüfstand „' + rname('opv_inv') + '“ steht die Schaltung „Summierer“ bereit.',
      fields: () => [{ key: 'i', label: 'Summenstrom I_f', unit: 'µA' }, { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Am invertierenden Eingang (virtueller Nullpunkt) addieren sich die Ströme aller Eingänge: I_f = U_1 / R_1 + U_2 / R_2. Dieser Strom fließt durch R_f, daher ist U_a = −R_f · I_f.',
        'Die Teilströme sind I_1 = ' + f(v.u1, 1) + ' V / ' + f(v.r1, 0) + ' kΩ = ' + f(v.i1, 0) + ' µA und I_2 = ' + f(v.u2, 1) + ' V / ' + f(v.r2, 0) + ' kΩ = ' + f(v.i2, 0) + ' µA. Diese Ströme werden addiert, nicht die Spannungen.',
        'Musterlösung: I_f = ' + f(v.i1, 0) + ' µA + ' + f(v.i2, 0) + ' µA = ' + f(v.iSum, 0) + ' µA, U_a = −' + f(v.rf, 0) + ' kΩ · ' + f(v.iSum, 0) + ' µA = ' + fs(v.ua, 1) + ' V. Mit nur einem Eingang kämen ' + fs(v.uaEin, 2) + ' V heraus.'
      ]; },
      start: () => A('opv_inv', ctl(), { fields: { i: null, ua: null } }),
      sol: () => A('opv_inv', ctl(), { fields: { i: vals().iSum, ua: vals().ua }, value: vals().ua }),
      wrong: () => { const v = vals(); return [{ name: 'Vorzeichen vergessen', answer: A('opv_inv', {}, { fields: { i: v.iSum, ua: v.uaPlus } }) }, { name: 'nur ein Eingang gerechnet (zu klein)', answer: A('opv_inv', {}, { fields: { i: v.i1, ua: v.uaEin } }) }, { name: 'Spannungen einfach addiert (zu groß)', answer: A('opv_inv', {}, { fields: { i: v.iSum, ua: v.uaSumme } }) }]; } };
  })();

  /* ====================================================================== ae20: Saettigung, Wie sieht der Ausgang aus? (Pool F2026-07, H2024-13) */
  const M20 = (() => {
    const G = { r1: 10000, rf: 47000, ue: 3, uv: 12 }, K = { up: 3.0, un: 2.5 };
    const data = () => once('d20', () => {
      const inv = C().op.inv({ r1: G.r1, rf: G.rf, ue: G.ue, opv: 'ideal', uv: G.uv }), ueMax = inv.ueMax;
      const gross = C().op.inv({ r1: G.r1, rf: G.rf, ue: G.uv, opv: 'ideal', uv: G.uv }), ueVielfach = Math.abs(gross.ualin);
      const viel = C().op.inv({ r1: G.r1, rf: G.rf, ue: ueVielfach, opv: 'ideal', uv: G.uv }), klein = C().op.inv({ r1: G.r1, rf: G.rf, ue: 0.5, opv: 'ideal', uv: G.uv });
      const op = C().op.open({ up: K.up, un: K.un, opv: 'ideal', uv: G.uv }), a0 = lv('a0');
      return { inv, ueMax, gross, viel, klein, op, a0, ueVielfach };
    });
    const specs = () => once('s20', () => {
      const d = data(), U = x => f(x, 2) + ' V', usat = d.inv.usat, v = Math.abs(d.inv.v);
      return [
        { key: 'ausgang', q: 'Am Eingang des Invertierers liegt eine Sinusspannung mit dem Scheitelwert û_e = ' + U(G.ue) + ' (f = 1 kHz), die Betriebsspannung beträgt ±' + f(G.uv, 0) + ' V. Wie sieht die Ausgangsspannung aus?', short: 'Der Ausgang bei zu großem Eingang ist richtig beschrieben', right: 'begrenzt',
          options: [
            { value: 'begrenzt', label: 'Sinus, bei ±' + f(usat, 0) + ' V abgeflacht, gegenüber dem Eingang um 180° gedreht', grund: 'Mit V_u = ' + fs(d.inv.v, 1) + ' verlangt der Eingang û_a,lin = ' + U(Math.abs(d.inv.ualin)) + ', der Ausgang erreicht aber höchstens ±' + f(usat, 0) + ' V: Die Spitzen werden abgeflacht. Das Minus in V_u bedeutet 180° Phasendrehung.' },
            { value: 'frei', label: 'Sinus mit ' + U(Math.abs(d.inv.ualin)) + ' Spitze, um 180° gedreht', grund: U(Math.abs(d.inv.ualin)) + ' liegen über der Betriebsspannung ±' + f(usat, 0) + ' V; der Ausgang kann diese Spannung nicht erreichen, er stößt an die Aussteuergrenze.' },
            { value: 'gleichphasig', label: 'Sinus, bei ±' + f(usat, 0) + ' V abgeflacht, phasengleich zum Eingang', grund: 'Das Abflachen stimmt, aber V_u = ' + fs(d.inv.v, 1) + ' ist negativ: Der invertierende Verstärker dreht die Phase um 180°, der Ausgang ist nicht phasengleich.' },
            { value: 'gleichspannung', label: 'Konstante Gleichspannung von −' + f(usat, 0) + ' V', grund: 'Eine konstante Spannung entstünde nur bei Gleichspannung am Eingang. Die Sinusspannung läuft durch und wird nur in den Spitzen bei ±' + f(usat, 0) + ' V begrenzt (verlangt wären ' + U(Math.abs(d.inv.ualin)) + ').' }] },
        { key: 'ueMax', q: 'Bis zu welchem Scheitelwert û_e am Eingang arbeitet die Schaltung (V_u = ' + fs(d.inv.v, 1) + ', ±' + f(G.uv, 0) + ' V) ohne Begrenzen?', short: 'Die größte Eingangsspannung ohne Begrenzen ist richtig bestimmt', right: 'max',
          options: [
            { value: 'max', label: 'û_e = ' + U(d.ueMax), grund: 'Es gilt û_e,max = U_sat / |V_u| = ' + f(usat, 0) + ' V / ' + f(v, 1) + ' = ' + U(d.ueMax) + '; darüber begrenzt der Ausgang.' },
            { value: 'usat', label: 'û_e = ' + U(G.uv) + ' (so groß wie die Betriebsspannung)', grund: 'Bei ' + U(G.uv) + ' am Eingang würde die Verstärkung ' + U(Math.abs(d.gross.ualin)) + ' am Ausgang verlangen, weit über ±' + f(usat, 0) + ' V. Die Grenze gilt am Ausgang, nicht am Eingang.' },
            { value: 'mal', label: 'û_e = ' + U(Math.abs(d.gross.ualin)) + ' (U_sat mal |V_u|)', grund: 'Mit ' + U(Math.abs(d.gross.ualin)) + ' am Eingang käme rechnerisch ' + U(Math.abs(d.viel.ualin)) + ' heraus. Die Grenze liegt bei U_sat / |V_u| (geteilt), nicht malgenommen.' },
            { value: 'klein', label: 'û_e = ' + U(0.5), grund: 'Bei ' + U(0.5) + ' ist U_a = ' + U(Math.abs(d.klein.ualin)) + ', also noch ohne Begrenzen. Das ist aber nicht die größte mögliche Eingangsspannung, diese liegt bei ' + U(d.ueMax) + '.' }] },
        { key: 'komp', q: 'Ein Operationsverstärker ohne Gegenkopplung (±' + f(G.uv, 0) + ' V): Der invertierende Eingang liegt fest auf ' + U(K.un) + ', am nichtinvertierenden Eingang liegen ' + U(K.up) + '. Wie verhält sich der Ausgang?', short: 'Der Ausgang ohne Gegenkopplung ist richtig beurteilt', right: 'hoch',
          options: [
            { value: 'hoch', label: 'Er geht in die positive Sättigung (nahe +' + f(d.op.ua, 0) + ' V)', grund: 'Ohne Gegenkopplung wirkt die Leerlaufverstärkung A_0 = ' + f(d.a0, 0) + ' auf die Eingangsdifferenz ' + U(d.op.ud) + '. Da U_+ > U_−, läuft der Ausgang an die positive Aussteuergrenze (+' + f(d.op.ua, 0) + ' V).' },
            { value: 'tief', label: 'Er geht in die negative Sättigung (nahe −' + f(d.op.usatN, 0) + ' V)', grund: 'Negativ würde der Ausgang nur bei U_+ < U_−. Hier ist U_+ = ' + U(K.up) + ' größer als U_− = ' + U(K.un) + ', also positive Sättigung.' },
            { value: 'diff', label: 'Er liegt bei ' + U(d.op.ud), grund: U(d.op.ud) + ' ist nur die Differenz der Eingänge. Der Operationsverstärker verstärkt sie ohne Gegenkopplung mit A_0 = ' + f(d.a0, 0) + ', der Ausgang kann nicht bei ' + U(d.op.ud) + ' stehen bleiben.' },
            { value: 'summe', label: 'Er liegt bei ' + U(K.up + K.un), grund: 'Ein Operationsverstärker addiert seine Eingangsspannungen nicht; er verstärkt die Differenz ' + U(d.op.ud) + ' mit A_0 = ' + f(d.a0, 0) + ' und begrenzt dann bei ' + f(d.op.ua, 0) + ' V.' }] }];
    });
    const vals = () => { const d = data(); return { r1: G.r1 / 1e3, rf: G.rf / 1e3, ue: G.ue, uv: G.uv, v: d.inv.v, ualin: Math.abs(d.inv.ualin), usat: d.inv.usat, phi: lv('opv_inv_phase'), ueMax: d.ueMax, up: K.up, un: K.un, ud: d.op.ud, a0: d.a0, uaSoll: Math.abs(d.klein.ualin) }; };
    const START = () => A('opv_inv', { schaltung: 'invertierer', opv: 'ideal', uv: G.uv, form: 'sinus', ue: G.ue, f: 1000, r1: G.r1, rf: G.rf }, { choices: {} });
    const check = mk((r, a) => { choiceRows(r, a, specs()); });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Ein invertierender Verstärker mit idealem Operationsverstärker (Übungsschaltung): R_1 = ' + eng(G.r1, 'Ω') + ', R_f = ' + eng(G.rf, 'Ω') + ', Betriebsspannung ±' + f(G.uv, 0) + ' V. Beantworte drei Fragen zur Aussteuerung. Im Prüfstand „' + rname('opv_inv') + '“ kannst du û_e verändern und beobachten, wann der Ausgang an die Aussteuergrenze stößt; die dritte Frage betrifft einen Operationsverstärker ganz ohne Gegenkopplung.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Ausgang kann nie größer als die Aussteuergrenze werden (hier die Betriebsspannung). Prüfe: Was verlangt V_u · û_e? Ist das mehr als die Grenze, wird abgeflacht. Das Minus in V_u heißt 180° Phasendrehung. Ohne Gegenkopplung entscheidet nur das Vorzeichen von U_+ − U_−.',
        'Hier ist V_u = ' + fs(v.v, 1) + ' und û_a,lin = ' + f(v.ualin, 1) + ' V gegenüber der Grenze ±' + f(v.usat, 0) + ' V. Die größte Eingangsspannung ist û_e,max = ' + f(v.usat, 0) + ' V / ' + f(Math.abs(v.v), 1) + ' = ' + f(v.ueMax, 2) + ' V. Bei der dritten Frage ist U_+ − U_− = ' + f(v.ud, 1) + ' V positiv.',
        'Musterlösung: Der Ausgang ist bei ±' + f(v.usat, 0) + ' V abgeflacht und um ' + f(v.phi, 0) + '° gedreht; û_e,max = ' + f(v.ueMax, 2) + ' V; ohne Gegenkopplung geht der Ausgang in die positive Sättigung (+' + f(v.usat, 0) + ' V).'
      ]; },
      start: START, sol: () => A('opv_inv', START().controls, { choices: rightOf(specs()) }),
      wrong: () => [{ name: 'Verstärkung ohne Begrenzung, Eingang falsch', answer: A('opv_inv', {}, { choices: { ausgang: 'frei', ueMax: 'usat', komp: 'tief' } }) }, { name: 'phasengleich, Grenze malgenommen', answer: A('opv_inv', {}, { choices: { ausgang: 'gleichphasig', ueMax: 'mal', komp: 'diff' } }) }] };
  })();

  /* ====================================================================== ae21: Nichtinvertierender Verstaerker (Pool H2024-19) */
  const M21 = (() => {
    const G = { rg: 10000, rf: 47000, ue: 0.25 };
    const rV = () => once('r21v', () => ref('vNin', { rg: G.rg, rf: G.rf })), rU = () => once('r21u', () => ref('uaNin', G));
    const vals = () => once('v21', () => { const V = rV(), U = rU(), w = (R, id) => R.wrongs.find(x => x.id === id); return { rg: G.rg / 1e3, rf: G.rf / 1e3, ue: G.ue, v: V.value, ua: U.value, vOhne: w(V, 'plus-eins-vergessen').v, uaOhne: w(U, 'plus-eins-vergessen').v, vInv: w(V, 'inv-formel').v, uaInv: w(U, 'inv-formel').v }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'v'), rV(), 'Die Verstärkung V_u ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ua'), rU(), 'Die Ausgangsspannung U_a ist richtig berechnet (mit Vorzeichen)', 3);
    });
    const ctl = () => ({ schaltung: 'nichtinvertierend', opv: 'ideal', form: 'gleich', ue: G.ue, rg: G.rg, rf: G.rf });
    return { vals, check, consts: [],
      text: () => 'Ein nichtinvertierender Verstärker mit idealem Operationsverstärker hat R_f = ' + eng(G.rf, 'Ω') + ' zwischen Ausgang und invertierendem Eingang und R_g = ' + eng(G.rg, 'Ω') + ' vom invertierenden Eingang nach Masse (Übungsschaltung). Am nichtinvertierenden Eingang liegt U_e = ' + eng(G.ue, 'V') + '. Berechne die Verstärkung V_u und die Ausgangsspannung U_a. Im Prüfstand „' + rname('opv_nin') + '“ kannst du das Ergebnis nachprüfen.',
      fields: () => [{ key: 'v', label: 'Verstärkung V_u', unit: '' }, { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Beim nichtinvertierenden Verstärker gilt V_u = 1 + R_f / R_g. Das Ergebnis ist nie kleiner als 1 und hat dasselbe Vorzeichen wie der Eingang (keine Phasendrehung). Danach U_a = V_u · U_e.',
        'Rechne R_f / R_g = ' + f(v.rf, 0) + ' kΩ / ' + f(v.rg, 0) + ' kΩ = ' + f(v.vOhne, 1) + '. Dann kommt die 1 dazu: V_u = ' + f(v.v, 1) + '. Danach multiplizierst du mit U_e = ' + f(v.ue, 2) + ' V.',
        'Musterlösung: V_u = 1 + ' + f(v.vOhne, 1) + ' = ' + f(v.v, 1) + ', U_a = ' + f(v.v, 1) + ' · ' + f(v.ue, 2) + ' V = ' + f(v.ua, 3) + ' V. Ohne die „+1“ kämen ' + f(v.uaOhne, 3) + ' V heraus, mit der Formel des Invertierers −' + f(v.uaOhne, 3) + ' V.'
      ]; },
      start: () => A('opv_nin', ctl(), { fields: { v: null, ua: null } }),
      sol: () => A('opv_nin', ctl(), { fields: { v: vals().v, ua: vals().ua }, value: vals().ua }),
      wrong: () => { const v = vals(); return [{ name: '„+1“ vergessen (zu klein)', answer: A('opv_nin', {}, { fields: { v: v.vOhne, ua: v.uaOhne } }) }, { name: 'Formel des Invertierers benutzt (Vorzeichen)', answer: A('opv_nin', {}, { fields: { v: v.vInv, ua: v.uaInv } }) }]; } };
  })();

  /* ====================================================================== ae22: Rueckkopplungswiderstand beim Nichtinvertierer (Pool W2024-11) */
  const M22 = (() => {
    const G = { ue: 0.018, ua: 0.216, rg: 2200 };
    const vV = () => Math.round(G.ua / G.ue * 1e6) / 1e6;
    const rRf = () => once('r22', () => ref('rfNin', { v: vV(), rg: G.rg }));
    const rV = () => once('r22v', () => own(vV(), '', [{ v: 1 / vV(), id: 'kehrwert', text: 'Dein Wert ist der Kehrwert: V_u = U_a / U_e, also Ausgang durch Eingang.' }, { v: (G.ua - G.ue) / G.ue, id: 'minus-eins', text: 'Dein Wert passt zu (U_a − U_e) / U_e = V_u − 1. Die Verstärkung ist einfach U_a / U_e.' }]));
    const vals = () => once('v22', () => { const R = rRf(), w = id => R.wrongs.find(x => x.id === id); return { ue: G.ue * 1000, ua: G.ua * 1000, rg: G.rg / 1e3, v: vV(), rf: R.value / 1e3, vm1: vV() - 1, rfOhneM1: w('minus-eins-vergessen').v / 1e3, rfPlus: w('plus-eins-falsch').v / 1e3 }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'v'), rV(), 'Die nötige Verstärkung V_u = U_a / U_e ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'rf'), rRf(), 'Der Rückkopplungswiderstand R_f ist richtig berechnet', 2);
    });
    const ctl = () => ({ schaltung: 'nichtinvertierend', opv: 'ideal', form: 'gleich', ue: G.ue, rg: G.rg, rf: 47000 });
    return { vals, check, consts: [],
      text: () => 'Ein Sensor liefert ' + eng(G.ue, 'V') + '. Ein nichtinvertierender Verstärker mit idealem Operationsverstärker soll daraus ' + eng(G.ua, 'V') + ' für den Analog-Digital-Umsetzer erzeugen (Übungsschaltung). Der Widerstand zwischen dem invertierenden Eingang und Masse beträgt R_g = ' + eng(G.rg, 'Ω') + '. Berechne die nötige Verstärkung V_u und den Rückkopplungswiderstand R_f. Trage R_f in kΩ ein.',
      fields: () => [{ key: 'v', label: 'Verstärkung V_u', unit: '' }, { key: 'rf', label: 'Rückkopplungswiderstand R_f', unit: 'kΩ' }],
      hint: () => { const v = vals(); return [
        'Zuerst die Verstärkung: V_u = U_a / U_e. Beim nichtinvertierenden Verstärker gilt V_u = 1 + R_f / R_g. Stelle das nach R_f um: R_f = (V_u − 1) · R_g.',
        'V_u = ' + f(v.ua, 0) + ' mV / ' + f(v.ue, 0) + ' mV = ' + f(v.v, 0) + '. Die „1“ gehört nicht zum Widerstandsverhältnis: R_f / R_g = ' + f(v.v, 0) + ' − 1 = ' + f(v.vm1, 0) + '.',
        'Musterlösung: R_f = ' + f(v.vm1, 0) + ' · ' + f(v.rg, 1) + ' kΩ = ' + f(v.rf, 1) + ' kΩ. Wer V_u · R_g rechnet, kommt auf ' + f(v.rfOhneM1, 1) + ' kΩ, wer „+1“ nimmt, auf ' + f(v.rfPlus, 1) + ' kΩ.'
      ]; },
      start: () => A('opv_nin', ctl(), { fields: { v: null, rf: null } }),
      sol: () => A('opv_nin', Object.assign(ctl(), { rf: vals().rf * 1000 }), { fields: { v: vals().v, rf: vals().rf }, value: vals().rf }),
      wrong: () => { const v = vals(); return [{ name: 'V_u − 1 vergessen (zu groß)', answer: A('opv_nin', {}, { fields: { v: v.v, rf: v.rfOhneM1 } }) }, { name: '„+1“ statt „−1“ (zu groß)', answer: A('opv_nin', {}, { fields: { v: v.v, rf: v.rfPlus } }) }, { name: 'Verstärkung falsch herum', answer: A('opv_nin', {}, { fields: { v: 1 / v.v, rf: v.rf } }) }]; } };
  })();

  /* ====================================================================== ae23: Differenzverstaerker (Pool W2025-29) */
  const M23 = (() => {
    const G = { r1: 10000, r2: 10000, r3: 47000, r4: 47000, u1: 1.6, u2: 2.1 };
    const dC = () => once('d23', () => C().op.diff(Object.assign({ opv: 'ideal' }, G)));
    const rUa = () => once('r23', () => ref('uaDiff', G));
    const rVd = () => once('r23v', () => { const d = dC(); return own(d.a2, '', [{ v: d.vn, id: 'nin', text: 'Dein Wert passt zu 1 + R_3 / R_1: Das ist die Verstärkung des Nichtinvertierers. Beim Differenzverstärker mit angepassten Widerständen gilt V_d = R_3 / R_1.' }, { v: 1 / d.a2, id: 'kehrwert', text: 'Dein Wert ist der Kehrwert: Die Verstärkung ist R_3 / R_1 (Rückkopplung durch Eingangswiderstand).' }]); });
    const vals = () => once('v23', () => { const d = dC(), R = rUa(), w = id => R.wrongs.find(x => x.id === id); return { r1: G.r1 / 1e3, r3: G.r3 / 1e3, u1: G.u1, u2: G.u2, vd: d.a2, diff: G.u2 - G.u1, ua: R.value, uaOhneV: w('verstaerkung-vergessen').v, uaTausch: w('u-vertauscht').v, vn: d.vn }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'vd'), rVd(), 'Die Differenzverstärkung V_d = R_3 / R_1 ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ua'), rUa(), 'Die Ausgangsspannung U_a ist richtig berechnet (mit Vorzeichen)', 2);
    });
    const ctl = () => ({ schaltung: 'differenz', opv: 'ideal', u1: G.u1, u2: G.u2, r1: G.r1, r2: G.r2, r3: G.r3, r4: G.r4 });
    return { vals, check, consts: [],
      text: () => 'Ein Differenzverstärker mit idealem Operationsverstärker (Übungsschaltung): R_1 = R_2 = ' + eng(G.r1, 'Ω') + ' und R_3 = R_4 = ' + eng(G.r3, 'Ω') + '. U_1 = ' + eng(G.u1, 'V') + ' liegt über R_1 am invertierenden Eingang, U_2 = ' + eng(G.u2, 'V') + ' über R_2 am nichtinvertierenden Eingang (R_4 führt von dort nach Masse, R_3 vom Ausgang zum invertierenden Eingang). Berechne die Differenzverstärkung V_d und die Ausgangsspannung U_a. Im Prüfstand „' + rname('opv_nin') + '“ steht die Schaltung „Differenzverstärker“ bereit.',
      fields: () => [{ key: 'vd', label: 'Differenzverstärkung V_d', unit: '' }, { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Sind die Widerstandsverhältnisse gleich (R_3 / R_1 = R_4 / R_2), verstärkt die Schaltung nur die Differenz der Eingänge: U_a = (R_3 / R_1) · (U_2 − U_1). Gleichtaktspannungen fallen heraus.',
        'Die Differenz ist U_2 − U_1 = ' + f(v.u2, 1) + ' V − ' + f(v.u1, 1) + ' V = ' + f(v.diff, 1) + ' V. Die Verstärkung ist R_3 / R_1 = ' + f(v.r3, 0) + ' kΩ / ' + f(v.r1, 0) + ' kΩ = ' + f(v.vd, 1) + '.',
        'Musterlösung: U_a = ' + f(v.vd, 1) + ' · ' + f(v.diff, 1) + ' V = ' + f(v.ua, 2) + ' V. Ohne die Verstärkung bliebe nur ' + f(v.uaOhneV, 1) + ' V, mit vertauschten Eingängen käme −' + f(v.ua, 2) + ' V heraus.'
      ]; },
      start: () => A('opv_nin', ctl(), { fields: { vd: null, ua: null } }),
      sol: () => A('opv_nin', ctl(), { fields: { vd: vals().vd, ua: vals().ua }, value: vals().ua }),
      wrong: () => { const v = vals(); return [{ name: 'Verstärkung vergessen (zu klein)', answer: A('opv_nin', {}, { fields: { vd: 1, ua: v.uaOhneV } }) }, { name: 'U_1 − U_2 statt U_2 − U_1 (Vorzeichen)', answer: A('opv_nin', {}, { fields: { vd: v.vd, ua: v.uaTausch } }) }]; } };
  })();

  /* ====================================================================== ae24: Fehlersuche, Der Ausgang stimmt nicht (nichtinvertierender Verstaerker, verdeckter Fehler) */
  const M24 = (() => {
    const FIX = { schaltung: 'nichtinvertierend', opv: 'ideal', uv: 12, form: 'gleich', ue: 0.25, rg: 10000, rf: 47000 }, RIG = 'opv_nin', RIGHT = 'rf offen';
    const data = () => once('d24', () => {
      const nin = C().op.nin({ rg: FIX.rg, rf: FIX.rf, ue: FIX.ue, opv: 'ideal', uv: FIX.uv });
      return { nin, soll: nin.ua, v: nin.v, usat: nin.usat };
    });
    const fsp = () => once('f24', () => faultSpec({ rigId: RIG, ctl: FIX, right: RIGHT, key: 'ursache', q: 'Welche Ursache passt zu deinen Messwerten? (Die Liste zeigt alle Fehlerbilder dieser Anlage.)', short: 'Die Ursache des Fehlers ist richtig bestimmt' }));
    const specs = () => once('s24', () => {
      const d = data(), sp = fsp(), m = sp.pred[RIGHT].meas, U = x => eng(x, 'V'), Us = x => f(x, 3) + ' V';
      const kind = x => (Math.abs(x) >= d.usat - 1e-9 ? 'grenze' : Math.abs(x - FIX.ue) < 1e-9 ? 'folger' : Math.abs(x - d.soll) < 1e-9 ? 'soll' : 'null');
      const rk = kind(m.ua), got = U(m.ua);
      const opt = (value, label, own) => ({ value, label, grund: value === rk ? 'Das stimmt: Du misst U_a = ' + got + ' statt der berechneten ' + Us(d.soll) + ' (V_u = ' + f(d.v, 1) + ' bei U_e = ' + U(FIX.ue) + '). ' + own : 'Dieses Messbild (' + label + ') hast du nicht: Gemessen wird U_a = ' + got + ' bei U_e = ' + U(FIX.ue) + '. ' + own });
      return [sp, { key: 'messung', q: 'Welches Messbild zeigt der Prüfstand bei U_e = ' + U(FIX.ue) + ' (Gleichspannung)? Die Ausgangsspannung wird mit der Rechnung verglichen.', short: 'Das Messbild des Ausgangs ist richtig beschrieben', right: rk,
        options: [
          opt('grenze', 'U_a liegt bei ' + U(d.usat) + ' an der Aussteuergrenze, obwohl U_e nur ' + U(FIX.ue) + ' beträgt', 'Der Ausgang folgt V_u · U_e nicht mehr, er klebt an der Betriebsspannung.'),
          opt('folger', 'U_a = ' + U(FIX.ue) + ', gleich U_e (V_u = 1)', 'Das wäre ein Spannungsfolger: Der Ausgang folgt dem Eingang ohne Verstärkung.'),
          opt('soll', 'U_a = ' + Us(d.soll) + ', wie berechnet', 'Dann stimmte der Ausgang mit der Rechnung überein und es gäbe nichts zu suchen.'),
          opt('null', 'U_a = 0 V trotz Eingangsspannung', 'Ein Ausgang bei 0 V bleibt von U_e unabhängig, wie bei fehlender Versorgung oder offenem Eingang.')] }];
    });
    const vals = () => { const d = data(); return { ue: FIX.ue, rg: FIX.rg / 1e3, rf: FIX.rf / 1e3, v: d.v, ua: d.soll, usat: d.usat, vFolger: 1, uvn: 0 }; };
    const START = () => A(RIG, Object.assign({ zielV: data().v }, FIX, { fehler: RIGHT }), { choices: {}, lock: ['fehler'], hidden: ['fehler'] });
    const check = mk((r, a) => { faultRows(r, a, specs()); });
    return { vals, check, audit: () => choiceAudit(specs()),
      text: () => 'Ein nichtinvertierender Verstärker (idealer Operationsverstärker, ±' + f(FIX.uv, 0) + ' V, R_g = ' + eng(FIX.rg, 'Ω') + ', R_f = ' + eng(FIX.rf, 'Ω') + ', Übungsschaltung) soll bei U_e = ' + eng(FIX.ue, 'V') + ' Gleichspannung am Ausgang U_a = ' + f(data().soll, 3) + ' V liefern (V_u = ' + f(data().v, 1) + '). Im Prüfstand „' + rname(RIG) + '“ stimmt der Ausgang aber nicht mit der Rechnung überein. In der Schaltung steckt ein Fehler, er ist verdeckt (Anzeige „Fehler: ?“, die Auswahl ist gesperrt; das Fehlerbild gibt es nur in der Simulation). Miss U_a und V_u, vergleiche mit der Rechnung, beschreibe das Messbild und wähle die Ursache.',
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Rechne zuerst den Sollwert: V_u = 1 + R_f / R_g und U_a = V_u · U_e. Miss dann U_a und V_u am Prüfstand und vergleiche. Wichtig ist, wie die Abweichung aussieht, nicht nur, dass es eine gibt.',
        'Sollwerte: V_u = ' + f(v.v, 1) + ' und U_a = ' + f(v.ua, 3) + ' V bei einer Aussteuergrenze von ±' + f(v.usat, 0) + ' V. Frage dich: Liegt U_a an der Aussteuergrenze, ist V_u genau ' + f(v.vFolger, 0) + ', oder bleibt U_a bei 0 V? Jedes Muster führt zu einer anderen Gruppe von Ursachen.',
        'Vergleiche U_a mit dem Sollwert und schließe daraus auf den fehlerhaften Zweig der Schaltung.'
      ]; },
      start: START,
      sol: () => A(RIG, Object.assign({ zielV: data().v }, FIX, { fehler: RIGHT }), { choices: rightOf(specs()), lock: ['fehler'], hidden: ['fehler'] }),
      wrong: () => [{ name: 'Zweig nach Masse statt Rückführung (V_u = 1 verwechselt)', answer: A(RIG, {}, { choices: { ursache: 'rg offen', messung: 'folger' } }) }, { name: 'Versorgungsfehler gewählt, Messbild falsch', answer: A(RIG, {}, { choices: { ursache: 'versorgung minus fehlt', messung: 'soll' } }) }, { name: 'Ursache richtig, Messbild vom Nullausgang', answer: A(RIG, {}, { choices: { ursache: RIGHT, messung: 'null' } }) }] };
  })();

  /* ====================================================================== ae25: Schmitt-Trigger, Schaltschwelle (Pool S2023-N10) */
  const M25 = (() => {
    const G = { r2: 20000, r3: 10000, usat: 12 };
    const sc = () => once('sc25', () => C().komp.schmitt({ art: 'inv', r2: G.r2, r3: G.r3, uv: G.usat, opv: 'ideal' }));
    const rO = () => once('r25', () => {
      const R = ref('schmittSchwelle', { art: 'inv', usat: G.usat, r2: G.r2, r3: G.r3 }), s = sc();
      R.wrongs = [{ v: s.uh, id: 'hysterese-oder-teiler', text: 'Dein Wert (' + f(s.uh, 1) + ' V) passt zur Hysterese U_H = U_o − U_u (beide Schwellen zusammen) und zugleich zu U_sat · R_2 / (R_2 + R_3) mit vertauschten Widerständen. Gefragt ist die obere Schaltschwelle U_o = U_sat · R_3 / (R_2 + R_3).' }, { v: s.usat * G.r3 / G.r2, id: 'durch-r2', text: 'Dein Wert (' + f(s.usat * G.r3 / G.r2, 1) + ' V) passt zu einer Teilung nur durch R_2. Die Rückkopplungsspannung ist ein Spannungsteiler: U_o = U_sat · R_3 / (R_2 + R_3).' }, { v: s.usat, id: 'usat', text: 'Dein Wert ist die Aussteuergrenze U_sat selbst. Am Pluseingang liegt nur der Teil R_3 / (R_2 + R_3) davon: U_o = U_sat · R_3 / (R_2 + R_3).' }];
      return R; });
    const rU = () => once('r25u', () => { const s = sc(); return own(s.uh, 'V', [{ v: s.uo, id: 'schwelle', text: 'Dein Wert (' + f(s.uo, 1) + ' V) ist nur eine Schaltschwelle. Die Hysterese ist der Abstand der beiden Schwellen: U_H = U_o − U_u.' }]); });
    const vals = () => once('v25', () => { const s = sc(); return { r2: G.r2 / 1e3, r3: G.r3 / 1e3, usat: G.usat, uo: s.uo, uu: s.uu, uh: s.uh, teiler: G.r3 / (G.r2 + G.r3), r2durch: s.usat * G.r3 / G.r2 }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'uo'), rO(), 'Die obere Schaltschwelle U_o ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'uh'), rU(), 'Die Hysterese U_H ist richtig berechnet', 2);
    });
    const ctl = () => ({ schaltung: 'schmitt_inv', opv: 'ideal', uv: G.usat, uref: 0, r2: G.r2, r3: G.r3 });
    return { vals, check, consts: [],
      text: () => 'Ein invertierender Schmitt-Trigger (idealer Operationsverstärker, Übungsschaltung): Das Eingangssignal liegt über R_1 am invertierenden Eingang. Vom Ausgang führt R_2 = ' + eng(G.r2, 'Ω') + ' als Mitkopplung zum nichtinvertierenden Eingang, R_3 = ' + eng(G.r3, 'Ω') + ' liegt von dort an Masse. Der Ausgang schaltet zwischen +' + f(G.usat, 0) + ' V und −' + f(G.usat, 0) + ' V. Berechne die obere Schaltschwelle U_o, bei der der Ausgang von +' + f(G.usat, 0) + ' V auf −' + f(G.usat, 0) + ' V kippt, und die Hysterese U_H. Im Prüfstand „' + rname('opv_komp') + '“ steht der Schmitt-Trigger bereit.',
      fields: () => [{ key: 'uo', label: 'Obere Schaltschwelle U_o', unit: 'V' }, { key: 'uh', label: 'Hysterese U_H', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Die Schaltschwelle ist die Spannung am nichtinvertierenden Eingang: Dort liegt der Spannungsteiler aus R_2 (vom Ausgang) und R_3 (nach Masse). Mit dem Ausgang bei +U_sat gilt U_o = U_sat · R_3 / (R_2 + R_3). Mit dem Ausgang bei −U_sat entsteht die untere Schwelle U_u.',
        'Das Teilerverhältnis ist R_3 / (R_2 + R_3) = ' + f(v.r3, 0) + ' kΩ / (' + f(v.r2, 0) + ' kΩ + ' + f(v.r3, 0) + ' kΩ) = ' + f(v.teiler, 3) + '. Die untere Schwelle ist symmetrisch: U_u = ' + fs(v.uu, 1) + ' V.',
        'Musterlösung: U_o = ' + f(v.usat, 0) + ' V · ' + f(v.teiler, 3) + ' = ' + f(v.uo, 1) + ' V. Die Hysterese ist U_H = U_o − U_u = ' + f(v.uo, 1) + ' V − (' + fs(v.uu, 1) + ' V) = ' + f(v.uh, 1) + ' V (nicht mit der Schwelle verwechseln, sie ist doppelt so groß).'
      ]; },
      start: () => A('opv_komp', ctl(), { fields: { uo: null, uh: null } }),
      sol: () => A('opv_komp', ctl(), { fields: { uo: vals().uo, uh: vals().uh }, value: vals().uo }),
      wrong: () => { const v = vals(); return [{ name: 'Hysterese statt Schwelle (zu groß)', answer: A('opv_komp', {}, { fields: { uo: v.uh, uh: v.uh } }) }, { name: 'Schwelle statt Hysterese (zu klein)', answer: A('opv_komp', {}, { fields: { uo: v.uo, uh: v.uo } }) }, { name: 'nur durch R_2 geteilt (zu groß)', answer: A('opv_komp', {}, { fields: { uo: v.r2durch, uh: v.uh } }) }]; } };
  })();

  /* ====================================================================== ae26: Nichtinvertierender Schmitt-Trigger (Pool W2023-12) */
  const M26 = (() => {
    const G = { r1: 10000, r2: 47000, usat: 12 };
    const sc = () => once('sc26', () => C().komp.schmitt({ art: 'nin', r1: G.r1, r2: G.r2, uv: G.usat, opv: 'ideal' }));
    const rO = () => once('r26', () => ref('schmittSchwelle', { art: 'nin', usat: G.usat, r1: G.r1, r2: G.r2 }));
    const rU = () => once('r26u', () => { const s = sc(); return own(s.uu, 'V', [{ v: s.uo, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Die untere Schwelle gehört zum Ausgang bei +U_sat. Dann muss der Eingang negativ werden, um ihn nach unten zu kippen: U_u = −U_sat · R_1 / R_2.' }]); });
    const vals = () => once('v26', () => { const s = sc(), R = rO(), w = id => R.wrongs.find(x => x.id === id); return { r1: G.r1 / 1e3, r2: G.r2 / 1e3, usat: G.usat, uo: s.uo, uu: s.uu, uh: s.uh, verh: G.r1 / G.r2, uoSumme: w('r1-r1r2').v, uh2: w('hysterese-statt-schwelle').v }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'uo'), rO(), 'Die obere Schaltschwelle U_o ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'uu'), rU(), 'Die untere Schaltschwelle U_u ist richtig berechnet (mit Vorzeichen)', 2);
    });
    const ctl = () => ({ schaltung: 'schmitt_nin', opv: 'ideal', uv: G.usat, uref: 0, r1: G.r1, r2: G.r2 });
    return { vals, check, consts: [],
      text: () => 'Ein nichtinvertierender Schmitt-Trigger (idealer Operationsverstärker, Übungsschaltung): Der invertierende Eingang liegt an Masse. Die Eingangsspannung U_E wird über R_1 = ' + eng(G.r1, 'Ω') + ' an den nichtinvertierenden Eingang geführt, der Ausgang ist über R_2 = ' + eng(G.r2, 'Ω') + ' auf diesen Eingang rückgekoppelt. Der Ausgang schaltet zwischen −' + f(G.usat, 0) + ' V und +' + f(G.usat, 0) + ' V. Der Ausgang steht auf −' + f(G.usat, 0) + ' V. Bei welcher Eingangsspannung U_o kippt er auf +' + f(G.usat, 0) + ' V? Bestimme auch die untere Schwelle U_u (Kippen zurück auf −' + f(G.usat, 0) + ' V).',
      fields: () => [{ key: 'uo', label: 'Obere Schaltschwelle U_o', unit: 'V' }, { key: 'uu', label: 'Untere Schaltschwelle U_u', unit: 'V' }],
      hint: () => { const v = vals(); return [
        'Der Ausgang kippt, wenn die Spannung am nichtinvertierenden Eingang 0 V erreicht (der invertierende Eingang liegt an Masse). Dort überlagern sich U_E (über R_1) und U_a (über R_2): U_E · R_2 / (R_1 + R_2) + U_a · R_1 / (R_1 + R_2) = 0.',
        'Aufgelöst ergibt sich U_E = −U_a · R_1 / R_2. Mit U_a = −' + f(v.usat, 0) + ' V wird die Schwelle positiv: das Verhältnis R_1 / R_2 = ' + f(v.r1, 0) + ' kΩ / ' + f(v.r2, 0) + ' kΩ = ' + f(v.verh, 3) + '. Durch (R_1 + R_2) darf nicht geteilt werden.',
        'Musterlösung: U_o = ' + f(v.usat, 0) + ' V · ' + f(v.verh, 3) + ' = ' + f(v.uo, 2) + ' V, U_u = −' + f(v.uo, 2) + ' V. Mit (R_1 + R_2) im Nenner kämen ' + f(v.uoSumme, 2) + ' V heraus, die Hysterese beträgt ' + f(v.uh, 2) + ' V.'
      ]; },
      start: () => A('opv_komp', ctl(), { fields: { uo: null, uu: null } }),
      sol: () => A('opv_komp', ctl(), { fields: { uo: vals().uo, uu: vals().uu }, value: vals().uo }),
      wrong: () => { const v = vals(); return [{ name: 'durch (R_1 + R_2) geteilt (zu klein)', answer: A('opv_komp', {}, { fields: { uo: v.uoSumme, uu: -v.uoSumme } }) }, { name: 'Hysterese statt Schwelle (zu groß), Vorzeichen falsch', answer: A('opv_komp', {}, { fields: { uo: v.uh2, uu: v.uo } }) }]; } };
  })();

  /* ====================================================================== ae27: Hysterese einstellen (opv_komp, Verhalten) */
  const M27 = (() => {
    const FIX = { schaltung: 'schmitt_inv', opv: 'ideal', uv: 12, uref: 0, fehler: 'keiner' }, OWN = ['r2', 'r3'], UHT = 6, START = { r2: 20000, r3: 20000 };
    const par = () => once('p27', () => { const u = lv('uv_std'), uo = UHT / 2, r3 = START.r2 * uo / (u - uo); return { r2: START.r2, r3, uo, uu: -uo, usat: u }; });
    const vals = () => once('v27', () => {
      const p = par(), s0 = C().komp.schmitt({ art: 'inv', r2: START.r2, r3: START.r3, uv: FIX.uv, opv: 'ideal' }), hi = C().komp.schmitt({ art: 'inv', r2: START.r2, r3: 40000, uv: FIX.uv, opv: 'ideal' }), lo = C().komp.schmitt({ art: 'inv', r2: START.r2, r3: 2000, uv: FIX.uv, opv: 'ideal' });
      return { uh: UHT, usat: p.usat, r2: p.r2 / 1e3, r3: p.r3 / 1e3, r3Ohm: p.r3, uo: p.uo, uhStart: s0.uh, r3Start: START.r3 / 1e3, uhHoch: hi.uh, r3Hoch: 40, uhKlein: lo.uh, r3Klein: 2 };
    });
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, FIX, START), s = sim('opv_komp', ctl), tol = AMP_TOL(), m = s.m;
      inputRow(r, a, s, 'opv_komp');
      const uh = m.uh;
      r(s.ok && fin(uh) && Math.abs(uh - UHT) <= tol * UHT, 'Die Hysterese beträgt U_H = ' + f(UHT, 0) + ' V (Toleranz ' + f(100 * tol, 0) + ' %)',
        fin(uh) ? 'Mit R_2 = ' + f(ctl.r2 / 1e3, 2) + ' kΩ und R_3 = ' + f(ctl.r3 / 1e3, 2) + ' kΩ ist U_H = ' + f(uh, 2) + ' V, verlangt sind ' + f(UHT, 0) + ' V. ' + (uh > UHT ? 'Die Hysterese ist zu groß: Das Teilerverhältnis R_3 / (R_2 + R_3) ist zu groß. Ein kleineres R_3 oder ein größeres R_2 verkleinert U_H.' : 'Die Hysterese ist zu klein: Das Teilerverhältnis R_3 / (R_2 + R_3) ist zu klein. Ein größeres R_3 oder ein kleineres R_2 vergrößert U_H.') : 'Der Prüfstand meldet für diese Werte keine Hysterese.');
      const uo = m.uo, uu = m.uu;
      r(s.ok && fin(uo) && fin(uu) && Math.abs(uo + uu) <= 0.02 * Math.max(Math.abs(uo), Math.abs(uu), 1e-9), 'Die Schaltschwellen liegen symmetrisch zum Nullpunkt (U_o = −U_u)',
        fin(uo) && fin(uu) ? 'Die Schwellen sind U_o = ' + f(uo, 2) + ' V und U_u = ' + f(uu, 2) + ' V; bei Bezugsspannung 0 V und gleichen Aussteuergrenzen müssen sie symmetrisch sein.' : 'Der Prüfstand meldet keine Schwellen.');
    });
    return { vals, check,
      text: () => 'Im Prüfstand „' + rname('opv_komp') + '“ ist ein invertierender Schmitt-Trigger aufgebaut (idealer Operationsverstärker, Bezugsspannung 0 V, Betriebsspannung ±' + f(FIX.uv, 0) + ' V, Übungsschaltung). Stelle R_2 und R_3 so ein, dass die Hysterese U_H = ' + f(UHT, 0) + ' V beträgt (Fenster ' + f(100 * AMP_TOL(), 0) + ' %, ein Übungswert) und die Schaltschwellen symmetrisch zum Nullpunkt liegen. Lies U_o, U_u und U_H an den Messgeräten ab.',
      hint: () => { const v = vals(); return [
        'Die Hysterese ist U_H = U_o − U_u. Bei Bezugsspannung 0 V sind die Schwellen symmetrisch: U_o = U_sat · R_3 / (R_2 + R_3) und U_u = −U_o. Also U_H = 2 · U_sat · R_3 / (R_2 + R_3). Ein größeres R_3 vergrößert die Hysterese.',
        'Mit der Startschaltung (R_2 = R_3 = ' + f(v.r3Start, 0) + ' kΩ) ist U_H = ' + f(v.uhStart, 0) + ' V, das ist zu groß. Gesucht ist U_o = U_H / 2 = ' + f(v.uo, 0) + ' V, also ein Teilerverhältnis R_3 / (R_2 + R_3) = ' + f(v.uo, 0) + ' V / ' + f(v.usat, 0) + ' V.',
        'Musterlösung: Bei R_2 = ' + f(v.r2, 0) + ' kΩ wird R_3 = ' + f(v.r3, 2) + ' kΩ (U_o = ' + f(v.uo, 0) + ' V, U_H = ' + f(v.uh, 0) + ' V). Mit R_3 = ' + f(v.r3Hoch, 0) + ' kΩ wäre U_H = ' + f(v.uhHoch, 1) + ' V, mit R_3 = ' + f(v.r3Klein, 0) + ' kΩ nur ' + f(v.uhKlein, 1) + ' V.'
      ]; },
      start: () => A('opv_komp', Object.assign({}, FIX, START, { zielUh: UHT }), {}),
      sol: () => A('opv_komp', Object.assign({}, FIX, { r2: par().r2, r3: par().r3, zielUh: UHT }), {}),
      wrong: () => [{ name: 'R_3 zu groß (Hysterese zu groß)', answer: A('opv_komp', Object.assign({}, FIX, { r2: START.r2, r3: 40000 }), {}) }, { name: 'R_3 zu klein (Hysterese zu klein)', answer: A('opv_komp', Object.assign({}, FIX, { r2: START.r2, r3: 2000 }), {}) }] };
  })();

  /* ====================================================================== ae28: Integrierer, Steigung (Pool W2023-16) */
  const M28 = (() => {
    const G = { r: 100000, c: 1e-6, ue: 2 }, UV = 12;
    const rS = () => once('r28', () => ref('slopeInt', G));
    const inte = () => once('i28', () => C().act.integrator({ r: G.r, c: G.c, ue: G.ue, opv: 'ideal', uv: UV }));
    const specs = () => once('s28', () => {
      const i = inte(), s = i.slope, t01 = 0.1, u01 = Math.abs(s) * t01, fm = x => f(x, 1);
      return [{ key: 'verlauf', q: 'Der Kondensator ist zu Beginn entladen (U_a = 0). Die Eingangsspannung springt auf +' + f(G.ue, 0) + ' V. Wie verhält sich die Ausgangsspannung?', short: 'Der Verlauf des Ausgangs ist richtig beschrieben', right: 'linear',
        options: [
          { value: 'linear', label: 'U_a fällt linear mit ' + fs(s, 0) + ' V/s bis zur Begrenzung durch die Versorgungsspannung', grund: 'Der Kondensator wird mit dem konstanten Strom ' + f(G.ue / G.r * 1e6, 0) + ' µA geladen: U_a = −U_e · t / (R · C) = ' + fs(s, 0) + ' V/s · t. Nach ' + fm(t01) + ' s sind es ' + fs(u01, 0) + ' V, die Grenze ±' + f(UV, 0) + ' V ist nach ' + f(i.tSat, 1) + ' s erreicht.' },
          { value: 'sprung', label: 'U_a springt sofort auf −' + f(G.ue, 0) + ' V und bleibt dort', grund: 'Ein Sprung auf −' + f(G.ue, 0) + ' V wäre das Verhalten eines invertierenden Verstärkers mit V_u = −1. Beim Integrierer ändert sich der Ausgang nur allmählich: Nach ' + fm(t01) + ' s ist U_a erst ' + fs(u01, 0) + ' V.' },
          { value: 'steigend', label: 'U_a steigt linear mit +' + f(Math.abs(s), 0) + ' V/s bis zur Begrenzung', grund: 'Der Integrierer invertiert: Bei positiver Eingangsspannung fällt der Ausgang mit ' + fs(s, 0) + ' V/s, er steigt nicht.' },
          { value: 'exponentiell', label: 'U_a fällt exponentiell auf −' + f(G.ue, 0) + ' V mit der Zeitkonstante ' + f(i.tau, 1) + ' s', grund: 'Die Zeitkonstante τ = R · C = ' + f(i.tau, 1) + ' s gehört zu einem passiven RC-Glied. Der Operationsverstärker hält den Strom konstant, deshalb läuft U_a linear (' + fs(s, 0) + ' V/s) und strebt keinem Endwert zu.' }] }];
    });
    const vals = () => once('v28', () => { const i = inte(), R = rS(), w = id => R.wrongs.find(x => x.id === id); return { r: G.r / 1e3, c: G.c * 1e6, ue: G.ue, tau: i.tau, slope: R.value, slopeOhne: w('slope-vorzeichen').v, slopeMal: w('mal-statt-durch').v, tSat: i.tSat, usat: UV }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'slope'), rS(), 'Die Steigung der Ausgangsspannung ist richtig berechnet (mit Vorzeichen)', 1);
      choiceRows(r, a, specs());
    });
    const ctl = () => ({ schaltung: 'integrierer', opv: 'ideal', uv: UV, form: 'gleich', ue: G.ue, r1: G.r, rf: 1e8, c: G.c, f: 5 });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein invertierender Integrierer besteht aus einem idealen Operationsverstärker mit R = ' + eng(G.r, 'Ω') + ' am Eingang und C = ' + eng(G.c, 'F') + ' in der Gegenkopplung (Übungsschaltung, ±' + f(UV, 0) + ' V). Der Kondensator ist zu Beginn entladen. Die Eingangsspannung springt auf +' + f(G.ue, 0) + ' V. Berechne die Steigung dU_a/dt der Ausgangsspannung in V/s (mit Vorzeichen) und beschreibe den Verlauf. Im Prüfstand „' + rname('opv_aktiv') + '“ steht der Integrierer bereit; mit „Start“ siehst du den Verlauf.',
      fields: () => [{ key: 'slope', label: 'Steigung dU_a/dt', unit: 'V/s' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Beim Integrierer gilt U_a = −(1 / (R · C)) · ∫ U_e dt. Bei konstanter Eingangsspannung ist das eine Gerade mit der Steigung −U_e / (R · C). Das Minus kommt von der Invertierung.',
        'Zuerst die Zeitkonstante: τ = R · C = ' + f(v.r, 0) + ' kΩ · ' + f(v.c, 0) + ' µF = ' + f(v.tau, 1) + ' s. Die Steigung ist dann −U_e / τ mit U_e = ' + f(v.ue, 0) + ' V. Der Ausgang läuft, bis die Aussteuergrenze ±' + f(v.usat, 0) + ' V erreicht ist.',
        'Musterlösung: dU_a/dt = −' + f(v.ue, 0) + ' V / ' + f(v.tau, 1) + ' s = ' + fs(v.slope, 0) + ' V/s; die Grenze ist nach ' + f(v.tSat, 1) + ' s erreicht. Ohne das Minus käme ' + f(v.slopeOhne, 0) + ' V/s heraus, mit „mal“ statt „durch“ ' + f(v.slopeMal, 1) + ' V/s.'
      ]; },
      start: () => A('opv_aktiv', ctl(), { fields: { slope: null }, choices: {} }),
      sol: () => A('opv_aktiv', ctl(), { fields: { slope: vals().slope }, choices: rightOf(specs()), value: vals().slope }),
      wrong: () => { const v = vals(); return [{ name: 'Vorzeichen vergessen, Verlauf steigend', answer: A('opv_aktiv', {}, { fields: { slope: v.slopeOhne }, choices: { verlauf: 'steigend' } }) }, { name: 'R und C malgenommen, Sprung', answer: A('opv_aktiv', {}, { fields: { slope: v.slopeMal }, choices: { verlauf: 'sprung' } }) }]; } };
  })();

  /* ====================================================================== ae29: Integrierer, Eingangswiderstand (Pool S2023-N08) */
  const M29 = (() => {
    const G = { f: 100, c: 22e-9 };
    const rf = () => once('r29', () => ref('rInt', G));
    const vals = () => once('v29', () => { const R = rf(), w = id => R.wrongs.find(x => x.id === id); return { f: G.f, c: G.c * 1e9, w: TWO_PI * G.f, r: R.value / 1e3, alt: R.alts[0] / 1e3, ohneK: w('zwei-pi').v / 1e3, halbK: w('zweimal-pi').v / 1e3 }; });
    const check = mk((r, a) => { numRow(r, rawOf(a, 'r'), rf(), 'Der Eingangswiderstand R_1 ist richtig berechnet', 1); });
    const ctl = () => ({ schaltung: 'integrierer', opv: 'ideal', form: 'sinus', ue: 1, f: G.f, r1: 100000, rf: 1e8, c: G.c });
    return { vals, check, consts: [3.14],
      text: () => 'Ein invertierender Operationsverstärker-Integrierer mit dem Kondensator C = ' + eng(G.c, 'F') + ' im Rückkoppelzweig soll bei f = ' + f(G.f, 0) + ' Hz die Spannungsverstärkung vom Betrag 1 haben (Übungsschaltung). Wie groß muss der Eingangswiderstand R_1 sein? Trage ihn in kΩ ein; mit π = 3,14 gerechnet zählt ebenfalls.',
      fields: () => [{ key: 'r', label: 'Eingangswiderstand R_1', unit: 'kΩ' }],
      hint: () => { const v = vals(); return [
        'Beim Integrierer ist der Betrag der Verstärkung |V| = X_C / R_1 = 1 / (2π · f · C · R_1). Für |V| = 1 gilt R_1 = X_C = 1 / (2π · f · C).',
        'Berechne zuerst die Kreisfrequenz ω = 2π · f = ' + f(v.w, 1) + ' 1/s. Dann ist der Blindwiderstand des Kondensators X_C = 1 / (ω · C) bei C = ' + f(v.c, 0) + ' nF.',
        'Musterlösung: R_1 = 1 / (' + f(v.w, 1) + ' 1/s · ' + f(v.c, 0) + ' nF) = ' + f(v.r, 2) + ' kΩ (mit π = 3,14 gerechnet ' + f(v.alt, 2) + ' kΩ). Ohne den Faktor 2π käme ' + f(v.ohneK, 1) + ' kΩ heraus.'
      ]; },
      start: () => A('opv_aktiv', ctl(), { fields: { r: null } }),
      sol: () => A('opv_aktiv', Object.assign(ctl(), { r1: vals().r * 1000 }), { fields: { r: vals().r }, value: vals().r }),
      wrong: () => { const v = vals(); return [{ name: '2π vergessen (zu groß)', answer: A('opv_aktiv', {}, { fields: { r: v.ohneK } }) }, { name: 'π statt 2π (zu groß)', answer: A('opv_aktiv', {}, { fields: { r: v.halbK } }) }, { name: 'zu klein (halber Wert)', answer: A('opv_aktiv', {}, { fields: { r: v.r * 0.5 } }) }]; } };
  })();

  /* ====================================================================== ae30: Slew-Rate, hoechste Frequenz (Vertiefung slew) */
  const M30 = (() => {
    const UHAT = 10, FHOCH = 20000;
    const sr = () => lv('sr_langsam') / 1e6;   // V/us
    const rf = () => once('r30', () => ref('fpb', { sr: sr(), uhat: UHAT }));
    const dp = () => once('dp30', () => C().deep.slew({ opv: 'langsam', uhat: UHAT, f: FHOCH }));
    const specs = () => once('s30', () => {
      const d = dp(), U = x => f(x, 2) + ' V', kh = x => f(x / 1e3, 2) + ' kHz', vus = f(sr(), 1) + ' V/µs', need = TWO_PI * FHOCH * UHAT / 1e6;
      return [{ key: 'folge', q: 'Der Ausgang soll bei f = ' + f(FHOCH / 1e3, 0) + ' kHz eine Sinusspannung mit û = ' + U(UHAT) + ' liefern (Slew-Rate ' + vus + '). Was geschieht?', short: 'Die Folge der Slew-Rate ist richtig beschrieben', right: 'dreieck',
        options: [
          { value: 'dreieck', label: 'Der Sinus wird dreieckförmig verformt, weil der Ausgang nicht schnell genug steigen kann', grund: 'Der Sinus verlangt eine Anstiegsgeschwindigkeit von 2π · f · û = ' + f(need, 2) + ' V/µs, der Operationsverstärker schafft nur ' + vus + '. Die höchste Frequenz bei û = ' + U(UHAT) + ' ist ' + kh(d.fpb) + '; bei ' + f(FHOCH / 1e3, 0) + ' kHz wären höchstens ' + U(d.uhatMax) + ' unverformt möglich.' },
          { value: 'abflachen', label: 'Der Sinus wird oben und unten abgeflacht, weil die Aussteuergrenze erreicht wird', grund: 'Das Abflachen entsteht durch die Aussteuergrenze und hängt von der Amplitude ab, nicht von der Frequenz. Hier begrenzt die Anstiegsgeschwindigkeit: ' + vus + ' reichen nur bis ' + kh(d.fpb) + ' bei û = ' + U(UHAT) + '.' },
          { value: 'unverandert', label: 'Nichts: Der Sinus bleibt unverändert', grund: 'Die Anstiegsgeschwindigkeit ist begrenzt: ' + vus + ' erlauben bei û = ' + U(UHAT) + ' höchstens ' + kh(d.fpb) + '. Bei ' + f(FHOCH / 1e3, 0) + ' kHz ist das überschritten.' },
          { value: 'kleiner', label: 'Der Sinus bleibt unverformt, nur die Amplitude sinkt auf 70 %', grund: 'Eine Amplitude von 70 % ist das Verhalten an der Grenzfrequenz (Bandbreite), nicht an der Slew-Rate. Die Slew-Rate verformt das Signal (Dreieck), sobald 2π · f · û über ' + vus + ' liegt (hier ' + f(need, 2) + ' V/µs).' }] }];
    });
    const vals = () => once('v30', () => { const R = rf(), d = dp(), w = id => R.wrongs.find(x => x.id === id); return { sr: sr(), uhat: UHAT, w: TWO_PI * UHAT, fmax: R.value / 1e3, fmaxHz: R.value, alt: R.alts[0] / 1e3, ohneK: w('zwei-pi').v / 1e3, halbK: w('uhat-halbiert').v / 1e3, fhoch: FHOCH / 1e3, uhatMax: d.uhatMax, need: TWO_PI * FHOCH * UHAT / 1e6 }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'fmax'), rf(), 'Die höchste Frequenz f_max ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    const ctl = () => ({ schaltung: 'real', opv: 'langsam', uv: 12, form: 'sinus', ue: 1, f: 5000, r1: 10000, rf: 100000, c: 1e-6 });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [3.14],
      text: () => 'Ein Operationsverstärker (Lehrmodell „langsam“, Übungsschaltung) hat die Slew-Rate SR = ' + f(sr(), 1) + ' V/µs. Am Ausgang soll eine Sinusspannung mit dem Scheitelwert û = ' + f(UHAT, 0) + ' V ohne Verformung stehen. Berechne die höchste Frequenz f_max (in kHz; mit π = 3,14 gerechnet zählt ebenfalls) und beantworte die Frage zu ' + f(FHOCH / 1e3, 0) + ' kHz. Rechne mit û = ' + f(UHAT, 0) + ' V; das Messgerät „Vollaussteuerungsbandbreite“ im Prüfstand „' + rname('opv_aktiv') + '“ rechnet mit der Aussteuergrenze, die Vertiefung „Slew-Rate“ mit der eingestellten Amplitude. Die Schaltung „Realer Operationsverstärker (Verstärker)“ zeigt beides.',
      fields: () => [{ key: 'fmax', label: 'Höchste Frequenz f_max', unit: 'kHz' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Anstiegsgeschwindigkeit eines Sinus ist am größten im Nulldurchgang: 2π · f · û. Diese Größe darf die Slew-Rate nicht überschreiten, daraus folgt f_max = SR / (2π · û). Rechne SR in V/s (1 V/µs = 10^6 V/s).',
        'Der Nenner ist 2π · û = ' + f(v.w, 1) + ' V. Mit SR = ' + f(v.sr, 1) + ' V/µs ergibt sich f_max in der Größenordnung einiger kHz. Bei ' + f(v.fhoch, 0) + ' kHz liegt der Bedarf bei ' + f(v.need, 2) + ' V/µs.',
        'Musterlösung: f_max = ' + f(v.sr, 1) + ' V/µs / (2π · ' + f(v.uhat, 0) + ' V) = ' + f(v.fmax, 2) + ' kHz (mit π = 3,14 gerechnet ' + f(v.alt, 2) + ' kHz). Ohne 2π käme ' + f(v.ohneK, 0) + ' kHz heraus, mit halbiertem Scheitelwert ' + f(v.halbK, 1) + ' kHz.'
      ]; },
      start: () => A('opv_aktiv', ctl(), { fields: { fmax: null }, choices: {} }),
      sol: () => A('opv_aktiv', ctl(), { fields: { fmax: vals().fmax }, choices: rightOf(specs()), value: vals().fmax }),
      wrong: () => { const v = vals(); return [{ name: '2π vergessen (zu groß)', answer: A('opv_aktiv', {}, { fields: { fmax: v.ohneK }, choices: { folge: 'unverandert' } }) }, { name: 'Scheitelwert halbiert (zu groß), Abflachen', answer: A('opv_aktiv', {}, { fields: { fmax: v.halbK }, choices: { folge: 'abflachen' } }) }, { name: 'zu klein', answer: A('opv_aktiv', {}, { fields: { fmax: v.fmax * 0.5 }, choices: { folge: 'kleiner' } }) }]; } };
  })();

  /* ====================================================================== ae31: Aktiver Tiefpass, Grenzfrequenz */
  const M31 = (() => {
    const G = { r1: 10000, rf: 100000, c: 1.59e-9 };
    const rFg = () => once('r31', () => ref('fgAktiv', { art: 'tp', r1: G.r1, rf: G.rf, c: G.c }, 0.05));
    const tpC = () => once('tp31', () => C().act.tp({ r1: G.r1, rf: G.rf, cf: G.c }));
    const rV0 = () => once('r31v', () => { const t = tpC(); return own(t.v0, '', [{ v: -t.v0, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der aktive Tiefpass invertiert im Durchlassbereich, V_0 = −R_f / R_1 ist negativ.' }, { v: G.r1 / G.rf * -1, id: 'kehrwert', text: 'Dein Wert ist der Kehrwert: V_0 = −R_f / R_1, der Rückkopplungswiderstand steht im Zähler.' }]); });
    const vals = () => once('v31', () => { const R = rFg(), t = tpC(), w = id => R.wrongs.find(x => x.id === id); return { r1: G.r1 / 1e3, rf: G.rf / 1e3, c: G.c * 1e9, v0: t.v0, fg: R.value, alt: R.alts[0], ohneK: w('zwei-pi').v / 1e3, r1K: w('r1-statt-rf').v / 1e3, tauUs: t.tau * 1e6 }; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'v0'), rV0(), 'Die Verstärkung im Durchlassbereich V_0 ist richtig berechnet (mit Vorzeichen)', 1);
      numRow(r, rawOf(a, 'fg'), rFg(), 'Die Grenzfrequenz f_g ist richtig berechnet', 1);
    });
    const ctl = () => ({ schaltung: 'tiefpass', opv: 'ideal', form: 'sinus', ue: 1, f: 1000, r1: G.r1, rf: G.rf, c: G.c });
    return { vals, check, consts: [3.14],
      text: () => 'Ein aktiver Tiefpass erster Ordnung (invertierend, idealer Operationsverstärker, Übungsschaltung) hat R_1 = ' + eng(G.r1, 'Ω') + ', R_f = ' + eng(G.rf, 'Ω') + ' und C_f = ' + eng(G.c, 'F') + ' parallel zu R_f. Berechne die Verstärkung im Durchlassbereich V_0 (mit Vorzeichen) und die Grenzfrequenz f_g in Hz; mit π = 3,14 gerechnet zählt ebenfalls. Im Prüfstand „' + rname('opv_aktiv') + '“ steht die Schaltung „Aktiver Tiefpass“ bereit.',
      fields: () => [{ key: 'v0', label: 'Verstärkung V_0', unit: '' }, { key: 'fg', label: 'Grenzfrequenz f_g', unit: 'Hz' }],
      hint: () => { const v = vals(); return [
        'Im Durchlassbereich (tiefe Frequenzen) ist der Kondensator ohne Wirkung: V_0 = −R_f / R_1. Die Grenzfrequenz bestimmt die Zeitkonstante in der Rückkopplung: f_g = 1 / (2π · R_f · C_f), nicht R_1.',
        'Zuerst V_0 = −' + f(v.rf, 0) + ' kΩ / ' + f(v.r1, 0) + ' kΩ = ' + fs(v.v0, 0) + '. Die Zeitkonstante der Rückkopplung ist τ = R_f · C_f = ' + f(v.tauUs, 0) + ' µs; daraus f_g = 1 / (2π · τ).',
        'Musterlösung: f_g = 1 / (2π · ' + f(v.tauUs, 0) + ' µs) = ' + f(v.fg, 1) + ' Hz (mit π = 3,14 gerechnet ' + f(v.alt, 1) + ' Hz). Mit R_1 statt R_f käme ' + f(v.r1K, 1) + ' kHz heraus, ohne den Faktor 2π ' + f(v.ohneK, 2) + ' kHz.'
      ]; },
      start: () => A('opv_aktiv', ctl(), { fields: { v0: null, fg: null } }),
      sol: () => A('opv_aktiv', ctl(), { fields: { v0: vals().v0, fg: vals().fg }, value: vals().fg }),
      wrong: () => { const v = vals(); return [{ name: '2π vergessen (zu groß), Vorzeichen vergessen', answer: A('opv_aktiv', {}, { fields: { v0: -v.v0, fg: v.ohneK * 1000 } }) }, { name: 'R_1 statt R_f (zu groß)', answer: A('opv_aktiv', {}, { fields: { v0: v.v0, fg: v.r1K * 1000 } }) }]; } };
  })();

  /* ====================================================================== ae32: Meisterstueck (opv_inv, Fehlersuche und Messreihe) */
  const M32 = (() => {
    const FIX = { schaltung: 'invertierer', opv: 'langsam', uv: 12, form: 'gleich', ue: 0.2, f: 1000, r1: 10000 }, OWN = ['rf'], VT = 10, START = { rf: 47000 }, RIG = 'opv_inv', RIGHT = 'r1 offen';
    const par = () => once('p32', () => { const rf = FIX.r1 * VT, o = C().op.inv({ r1: FIX.r1, rf, opv: 'langsam' }), s0 = C().op.inv({ r1: FIX.r1, rf: START.rf, opv: 'langsam' }); return { rf, v: o.v, fg: o.fg, vn: o.vn, vId: o.vId, fgStart: s0.fg, vStart: s0.v }; });
    const stateOf = ctl => Object.assign({}, FIX, { rf: ctl.rf, fehler: 'keiner' });
    /* Messbild je Fehlerfall: U_a, V_u und r_ein aus dem Pruefstand (U_a ~ 0 V allein trennt R_1, R_f kurz und Versorgung nicht; erst V_u und r_ein) */
    const measText32 = id => {
      const m = sim(RIG, Object.assign({}, FIX, START, { fehler: id })).m, ua = m.ua, v = m.v, ri = m.ri;
      return (Math.abs(ua) < 1e-3 ? 'U_a ≈ 0 V' : 'U_a = ' + eng(ua, 'V')) + ', ' + (Math.abs(v) < 1e-3 ? 'V_u ≈ 0' : Math.abs(v) < 1e4 ? 'V_u = ' + fs(v, 2) : 'V_u über 10 000') + ' und ' + (ri >= 1e11 ? 'r_ein unbegrenzt' : 'r_ein = ' + eng(ri, 'Ω'));
    };
    const fsp = () => once('f32', () => faultSpec({ rigId: RIG, ctl: Object.assign({}, FIX, START), right: RIGHT, key: 'ursache', q: 'Welche Ursache passt zu deinen Messwerten am Prüfaufbau? (Die Liste zeigt alle Fehlerbilder dieser Anlage.)', short: 'Die Ursache des Fehlers ist richtig bestimmt', measText: measText32 }));
    const BER = { name: 'Name ist eingetragen', datum: 'Datum ist eingetragen', schaltung: 'Schaltung ist eingetragen', ergebnis: 'Ergebnis ist eingetragen', bauteile: 'Bauteilwerte sind eingetragen', quelle: 'Quelle ist eingetragen', messreihe: 'Messreihe hat genug Zeilen', messwerte: 'Messwerte stimmen mit der Rechnung überein', auswertung: 'Auswertung ist ausgefüllt', 'auswertung.v': 'Verstärkung V_u in der Auswertung stimmt', 'auswertung.fg': 'Grenzfrequenz f_g in der Auswertung stimmt' };
    const vals = () => once('v32', () => { const p = par(), tol = OP_TOL(); return { r1: FIX.r1 / 1e3, rf: p.rf / 1e3, v: p.v, vId: p.vId, vn: p.vn, fg: p.fg / 1e3, fgHz: p.fg, fgStart: p.fgStart, fgStartK: p.fgStart / 1e3, rfStart: START.rf / 1e3, vStart: p.vStart, ue: FIX.ue, uaOut: Math.abs(p.v) * FIX.ue, tol: tol * 100, usat: C().op.grenzen({ opv: 'langsam', uv: FIX.uv }).p }; });
    const berichtOf = (ctl, o) => {
      const g = C().report.generate(RIG, stateOf(ctl), 1), p = C().op.inv({ r1: FIX.r1, rf: ctl.rf, opv: 'langsam' });
      const e = clone(g.entry);
      e.name = 'Musterlösung'; e.datum = 'heute'; e.ergebnis = 'V_u = ' + f(p.v, 2) + ', f_g = ' + f(p.fg, 0) + ' Hz';
      e.auswertung = { v: p.v, fg: p.fg };
      return Object.assign(e, o || {});
    };
    const check = mk((r, a) => {
      const ctl = effCtl(a, OWN, Object.assign({}, FIX, { fehler: 'keiner' }), START), s = sim(RIG, ctl), tol = OP_TOL();
      inputRow(r, a, s, RIG);
      faultRows(r, a, [fsp()]);
      const fz = String(obj(a.controls).fehler);
      r(fz === 'keiner', 'Der Fehler ist beseitigt (Fehlerfall im Prüfstand auf „keiner“)',
        'Im Prüfstand ist noch ein Fehlerfall eingestellt' + (fz === 'undefined' ? ' (oder die Auswahl fehlt)' : '') + '. Zeige nach der Diagnose die Auflösung und stelle den Fehlerfall auf „keiner“; erst dann lässt sich die Stufe auslegen und messen.');
      const v = s.m.v;
      r(s.ok && fin(v) && v < 0 && Math.abs(Math.abs(v) - VT) <= tol * VT, 'Die Stufe hat V_u = −' + f(VT, 0) + ' (Toleranz ' + f(100 * tol, 0) + ' %)',
        fin(v) ? 'Mit R_f = ' + f(ctl.rf / 1e3, 2) + ' kΩ und R_1 = ' + f(FIX.r1 / 1e3, 0) + ' kΩ ist V_u = ' + fs(v, 2) + ', verlangt sind −' + f(VT, 0) + '. ' + (v >= 0 ? 'Der invertierende Verstärker hat ein negatives V_u.' : Math.abs(v) > VT ? 'Die Verstärkung ist zu groß: Ein kleineres R_f verkleinert |V_u| (V_u = −R_f / R_1).' : 'Die Verstärkung ist zu klein: Ein größeres R_f vergrößert |V_u| (V_u = −R_f / R_1).') : 'Der Prüfstand meldet keine Verstärkung.');
      /* Messreihe: gegen die ausgelegte Stufe (nicht gegen die Angaben im Bericht) */
      const be = obj(a.bericht), en = isObj(be.entry) ? be.entry : be;
      if (!isObj(en) || !Array.isArray(en.messreihe || en.rows)) { r(false, 'Die Messreihe liegt vor', 'Du hast noch keine Messreihe aufgenommen. Öffne den Tab „Messreihe“, nimm den Frequenzgang deiner Stufe auf und trage Name, Datum, V_u und f_g ein.'); }
      else {
        const zst = obj(en.zustand), bt = obj(en.bauteile);
        const lC = [['rf', ctl.rf], ['r1', FIX.r1]].filter(p => (fin(numOf(zst[p[0]])) ? Math.abs(numOf(zst[p[0]]) - p[1]) > 0.03 * p[1] : (fin(numOf(bt[p[0]])) ? Math.abs(numOf(bt[p[0]]) - p[1]) > 0.03 * p[1] : false)));
        r(en.rigId === RIG && lC.length === 0, 'Die Messreihe gehört zu deiner ausgelegten Stufe',
          en.rigId !== RIG ? 'Die Messreihe wurde an einer anderen Anlage aufgenommen; verlangt ist der invertierende Verstärker.' : 'Die Messreihe wurde mit anderen Bauteilwerten aufgenommen (abweichend: ' + lC.map(p => p[0].toUpperCase().replace('RF', 'R_f').replace('R1', 'R_1')).join(', ') + '). Nimm sie nach der Auslegung neu auf.');
        let chk = null;
        try { chk = C().report.check(en, { state: stateOf(ctl) }); } catch (e) { chk = null; }
        if (!chk || !chk.ok || !Array.isArray(chk.items)) r(false, 'Die Messreihe ist prüfbar', (chk && chk.why) || 'Die Messreihe konnte nicht geprüft werden.');
        else chk.items.forEach(it => r(it.ok, BER[it.feld] || ('Messreihe: ' + it.feld), it.text));
      }
    });
    return { vals, check, audit: () => choiceAudit([fsp()]), consts: [],
      text: () => 'Meisterstück in vier Schritten (Übungsschaltung). Eine invertierende Verstärkerstufe mit realem Operationsverstärker (Lehrmodell „langsam“, ±' + f(FIX.uv, 0) + ' V, R_1 = ' + eng(FIX.r1, 'Ω') + ') soll die Verstärkung V_u = −' + f(VT, 0) + ' haben. Der Prüfaufbau im Prüfstand „' + rname(RIG) + '“ zeigt aber nicht die verlangte Verstärkung: Es steckt ein Fehler darin, er ist verdeckt. (1) Miss am Prüfaufbau (Ausgangsspannung, Verstärkung und Eingangswiderstand), bestimme die Ursache und gib die Diagnose ab. (2) Zeige danach die Auflösung und stelle den Fehlerfall auf „keiner“. (3) Lege die Stufe aus: Stelle R_f so ein, dass V_u = −' + f(VT, 0) + ' erreicht wird (Fenster ' + f(100 * OP_TOL(), 0) + ' %, ein Übungswert). (4) Nimm im Tab „Messreihe“ den Frequenzgang auf, trage Name, Datum, V_u und die Grenzfrequenz f_g des realen Operationsverstärkers ein und kontrolliere die Messreihe.',
      table: () => ({ caption: 'Vorgaben', head: ['Größe', 'Wert'], rows: [['Verstärkung V_u', '−' + f(VT, 0)], ['Eingangswiderstand R_1', eng(FIX.r1, 'Ω') + ' (fest)'], ['Operationsverstärker', 'Lehrmodell „langsam“ (real)'], ['Eingangsspannung', f(FIX.ue, 1) + ' V Gleichspannung']] }),
      choices: () => publicChoices([fsp()]),
      hint: () => { const v = vals(); return [
        'Gehe in der Reihenfolge der Schritte vor. Für die Diagnose zählt, was der Ausgang bei U_e = ' + f(v.ue, 1) + ' V zeigt: Vergleiche U_a mit dem Wert, den eine Stufe mit V_u = −' + f(Math.abs(v.vId), 0) + ' liefern würde (' + f(v.uaOut, 1) + ' V). Ein dritter Messwert hilft bei der Zuordnung: der Eingangswiderstand r_ein, der bei einer intakten Stufe gleich R_1 = ' + f(v.r1, 0) + ' kΩ ist. Für die Auslegung gilt V_u = −R_f / R_1; die Grenzfrequenz liest du in der Messreihe bei einem Abfall um 3 dB ab.',
        'Soll-Ausgang ' + fs(-v.uaOut, 1) + ' V bei der Aussteuergrenze ±' + f(v.usat, 1) + ' V. Für V_u = −' + f(Math.abs(v.vId), 0) + ' wird R_f = ' + f(Math.abs(v.vId), 0) + ' · ' + f(v.r1, 0) + ' kΩ = ' + f(v.rf, 0) + ' kΩ. Der reale Operationsverstärker hat eine Rauschverstärkung V_n = 1 + R_f / R_1 = ' + f(v.vn, 0) + ' und daraus eine Grenzfrequenz f_g ≈ GBW / V_n.',
        'Musterlösung: Ursache anhand des Messbilds bestimmen, Fehlerfall auf „keiner“, R_f = ' + f(v.rf, 0) + ' kΩ (V_u = ' + fs(v.v, 3) + '), Messreihe mit V_u = ' + fs(v.v, 2) + ' und f_g = ' + f(v.fg, 1) + ' kHz in der Auswertung. Mit R_f = ' + f(v.rfStart, 0) + ' kΩ stünde der Frequenzgang bei f_g = ' + f(v.fgStartK, 1) + ' kHz und V_u = ' + fs(v.vStart, 2) + '.'
      ]; },
      start: () => A(RIG, Object.assign({ zielV: VT }, FIX, START, { fehler: RIGHT }), { choices: {}, lock: [], hidden: ['fehler'] }),
      sol: () => { const p = par(), ctl = { rf: p.rf }; return A(RIG, Object.assign({ zielV: VT }, FIX, ctl, { fehler: 'keiner' }), { choices: rightOf([fsp()]), bericht: berichtOf(ctl), value: p.v }); },
      wrong: () => {
        const p = par(), ctl = { rf: p.rf }, full = berichtOf(ctl), good = Object.assign({ zielV: VT }, FIX, ctl, { fehler: 'keiner' }), ch = rightOf([fsp()]);
        const thin = clone(full); thin.messreihe = thin.messreihe.slice(0, 2); thin.rows = thin.messreihe; thin.name = ''; thin.auswertung = {};
        const vz = clone(full); vz.auswertung = Object.assign({}, vz.auswertung, { v: -vz.auswertung.v });
        return [
          { name: 'Messreihe unvollständig', answer: A(RIG, good, { choices: ch, bericht: thin }) },
          { name: 'V_u in der Auswertung mit falschem Vorzeichen', answer: A(RIG, good, { choices: ch, bericht: vz }) },
          { name: 'Ursache falsch gewählt', answer: A(RIG, good, { choices: { ursache: 'ausgang defekt' }, bericht: full }) },
          { name: 'Fehler nicht beseitigt', answer: A(RIG, Object.assign({}, good, { fehler: RIGHT }), { choices: ch, bericht: full }) },
          { name: 'Stufe nicht ausgelegt (R_f zu klein)', answer: A(RIG, Object.assign({}, good, { rf: START.rf }), { choices: ch, bericht: full }) }
        ];
      } };
  })();

  /* ====================================================================== ae33 bis ae40: Anbindung an den Berufsschulstoff (Halbleiter, Arbeitspunkt, Transistor, integrierte Schaltkreise)
   * Alle Zahlen stammen aus dem Kern (ANA_CORE.tr, ANA_CORE.limit) oder aus dem Pruefstand (sim); Bauteilwerte sind Aufgabenwerte (Uebungsschaltung).
   * Auswahlaufgaben ohne Rechnung (ae37, ae38, ae39, ae40) nutzen den Baustein pick(): Fachgrund je Antwort, richtige Antwort nicht systematisch die laengste. */
  /* Baustein: reine Auswahlaufgabe; o = { rig, ctl(), specs(), vals(), text(), hint() } */
  function pick(o) {
    const wrongSet = k => { const c = {}; o.specs().forEach(s => { const w = s.options.filter(x => x.value !== s.right); c[s.key] = w[k % w.length].value; }); return c; };
    return { vals: o.vals, consts: [], audit: () => choiceAudit(o.specs()), check: mk((r, a) => { choiceRows(r, a, o.specs()); }),
      text: o.text, hint: o.hint, choices: () => publicChoices(o.specs()),
      start: () => A(o.rig, o.ctl(), { choices: {} }), sol: () => A(o.rig, o.ctl(), { choices: rightOf(o.specs()) }),
      wrong: () => [{ name: 'durchgehend die erste falsche Antwort', answer: A(o.rig, {}, { choices: wrongSet(0) }) }, { name: 'durchgehend die zweite falsche Antwort', answer: A(o.rig, {}, { choices: wrongSet(1) }) }] };
  }
  const mAf = x => f(x, 2) + ' mA';

  /* ====================================================================== ae33: Arbeitsgerade und Arbeitspunkt der LED (Lernfeld 6.1, grafische Arbeitspunktermittlung) */ /* PRUEFEN P1: Arbeitspunkt wird gerechnet und im Prüfstand abgelesen, nicht von Hand gezeichnet; LED-Kennlinie ist das Lehrmodell (Übungswerte) */
  const M33 = (() => {
    const G = { uq: 9, rv: 470, uq2: 6 };
    const FIX = { typ: 'led_rot', modell: 'kennlinie', temp: 27, fehler: 'keiner', ziel: 0 };
    const ctl = (uq, rv) => Object.assign({}, FIX, { uq, rv });
    const S = (uq, rv) => once('s33|' + uq + '|' + rv, () => { const s = sim('diode', ctl(uq, rv)); if (!s.ok || !fin(s.m.id)) throw new Error('Prüfstand ae33'); return s; });
    const vals = () => once('v33', () => { const a = S(G.uq, G.rv).m, b = S(G.uq2, G.rv).m, c = S(G.uq, 2 * G.rv).m; return {
      uq: G.uq, rv: G.rv, uq2: G.uq2, rv2: 2 * G.rv, ik: G.uq / G.rv * 1e3, ud: a.ud, id: a.id, ur: a.ur, ik2: G.uq2 / G.rv * 1e3, id2: b.id, ud2: b.ud, ik3: G.uq / (2 * G.rv) * 1e3, id3: c.id, idProp: a.id * G.uq2 / G.uq }; });
    const rIk = () => once('r33k', () => { const v = vals(); return own(G.uq / G.rv, 'A', [{ v: v.id / 1e3, id: 'ap', text: 'Dein Wert (' + mAf(v.id) + ') ist der Strom im Arbeitspunkt, (U_q − U_D) / R_V. Der Achsenabschnitt I_k gilt für U = 0, also ohne Spannungsfall an der Diode: I_k = U_q / R_V.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.ik }); });
    const rId = () => once('r33i', () => { const v = vals(); return own(v.id / 1e3, 'A', [{ v: v.ik / 1e3, id: 'ik', text: 'Dein Wert (' + mAf(v.ik) + ') ist der Achsenabschnitt U_q / R_V. So groß wäre der Strom ohne Spannungsfall an der Diode. Im Arbeitspunkt fällt U_D an der Diode ab, der Strom ist (U_q − U_D) / R_V.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.id, tol: AMP_TOL() }); });
    const rUd = () => once('r33u', () => { const v = vals(); return own(v.ud, 'V', [{ v: v.ur, id: 'ur', text: 'Dein Wert (' + f(v.ur, 2) + ' V) ist die Spannung am Vorwiderstand, U_R = U_q − U_D. Gefragt ist die Spannung an der LED.' }, { v: G.uq, id: 'uq', text: 'Dein Wert ist die Quellenspannung. Diese teilt sich auf: Ein kleiner Teil fällt an der LED ab, der Rest am Vorwiderstand.' }], { tol: AMP_TOL() }); });
    const rId2 = () => once('r33j', () => { const v = vals(); return own(v.id2 / 1e3, 'A', [{ v: v.idProp / 1e3, id: 'prop', text: 'Dein Wert (' + mAf(v.idProp) + ') entsteht, wenn der Strom im Verhältnis der Quellenspannungen umgerechnet wird. Das stimmt nicht: Die LED hält U_D fast fest, nur der Rest (U_q − U_D) liegt am Widerstand.' }, { v: v.ik2 / 1e3, id: 'ik2', text: 'Dein Wert (' + mAf(v.ik2) + ') ist der Achsenabschnitt U_q / R_V der neuen Geraden. Im Arbeitspunkt fällt zusätzlich U_D an der LED ab.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.id2, tol: AMP_TOL() }); });
    const specs = () => once('sp33', () => { const v = vals(); return [
      { key: 'rvdopp', q: 'Der Vorwiderstand wird verdoppelt (R_V = ' + eng(v.rv2 * 1, 'Ω') + ', U_q bleibt ' + eng(G.uq, 'V') + '). Wie liegt die neue Arbeitsgerade zur alten?', short: 'Die Arbeitsgerade bei doppeltem Vorwiderstand ist richtig beschrieben', right: 'flacher',
        options: [
          { value: 'parallel', label: 'Parallel nach links verschoben, gleiche Steigung', grund: 'Eine Parallelverschiebung entsteht, wenn sich die Quellenspannung ändert. Hier ändert sich R_V und damit der Anstieg −1 / R_V: Die neue Gerade verläuft nicht parallel zur alten.' },
          { value: 'flacher', label: 'Flacher, Punkt U_q auf der Spannungsachse bleibt', grund: 'Bei I = 0 liegt die ganze Quellenspannung an der Diode: Der Punkt (U_q | 0) bleibt. Bei U = 0 fließt nur noch U_q / R_V = ' + mAf(v.ik3) + ' statt ' + mAf(v.ik) + ', die Gerade dreht sich um (U_q | 0) und wird flacher. Der Arbeitspunkt rutscht auf I_D = ' + mAf(v.id3) + ' (Simulation).' },
          { value: 'steiler', label: 'Steiler, I_k verdoppelt sich auf der Stromachse', grund: 'Ein größerer Widerstand macht die Gerade flacher, nicht steiler: I_k = U_q / R_V sinkt auf ' + mAf(v.ik3) + ' (vorher ' + mAf(v.ik) + ').' },
          { value: 'kennlinie', label: 'Die LED-Kennlinie ändert sich, die Gerade bleibt', grund: 'Die Kennlinie gehört zur LED und bleibt gleich. Die Arbeitsgerade gehört zu Quelle und Vorwiderstand: Die Gerade dreht sich, wenn R_V verdoppelt wird (I_k sinkt von ' + mAf(v.ik) + ' auf ' + mAf(v.ik3) + ').' }] },
      { key: 'uq6', q: 'Die Quellenspannung sinkt auf ' + eng(G.uq2, 'V') + ' (R_V = ' + eng(G.rv, 'Ω') + '). Was geschieht mit Arbeitsgerade und Arbeitspunkt?', short: 'Die Wirkung der kleineren Quellenspannung ist richtig beschrieben', right: 'wandert',
        options: [
          { value: 'dreht', label: 'Die Gerade dreht sich, der Arbeitspunkt bleibt fast gleich', grund: 'Eine Drehung entsteht durch einen anderen Widerstand. Bei kleinerer Quellenspannung bleibt der Anstieg −1 / R_V, die Gerade wird parallel verschoben, und der Strom sinkt von ' + mAf(v.id) + ' auf ' + mAf(v.id2) + '.' },
          { value: 'gleich', label: 'Nichts ändert sich, die LED hält ihre Spannung fest', grund: 'Die LED hält nur ihre Flussspannung (hier ' + f(v.ud2, 2) + ' V) annähernd fest. Der Strom folgt dem Rest: Bei ' + eng(G.uq2, 'V') + ' ist I_D = ' + mAf(v.id2) + ' statt ' + mAf(v.id) + '.' },
          { value: 'wandert', label: 'Gerade parallel verschoben, der Arbeitspunkt sinkt', grund: 'Die Quellenspannung verschiebt die Gerade parallel (I_k = ' + mAf(v.ik2) + ', Punkt U_q auf der Spannungsachse bei ' + eng(G.uq2, 'V') + '). Der Arbeitspunkt wandert auf der LED-Kennlinie nach unten: I_D = ' + mAf(v.id2) + ' statt ' + mAf(v.id) + '.' },
          { value: 'kennlinie', label: 'Die LED-Kennlinie rückt nach links, die Gerade bleibt', grund: 'Die Kennlinie gehört zur LED und ändert sich durch die Quelle nicht. Es ist die Arbeitsgerade, die sich verschiebt: Ihre Schnittpunkte sind jetzt ' + eng(G.uq2, 'V') + ' und ' + mAf(v.ik2) + '.' }] }]; });
    const check = mk((r, a) => {
      inputRow(r, a, S(G.uq, G.rv), 'diode');
      numRow(r, rawOf(a, 'ik'), rIk(), 'Der Achsenabschnitt I_k = U_q / R_V ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'id'), rId(), 'Der Strom I_D im Arbeitspunkt (U_q = ' + f(G.uq, 0) + ' V) stimmt', 2);
      numRow(r, rawOf(a, 'ud'), rUd(), 'Die Spannung U_D an der LED im Arbeitspunkt stimmt', 2);
      numRow(r, rawOf(a, 'id2'), rId2(), 'Der Strom I_D bei U_q = ' + f(G.uq2, 0) + ' V stimmt', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine rote LED liegt in Reihe mit einem Vorwiderstand R_V = ' + eng(G.rv, 'Ω') + ' an U_q = ' + eng(G.uq, 'V') + ' (Übungsschaltung). Die Arbeitsgerade des Vorwiderstands ist die Gerade I = (U_q − U) / R_V; sie schneidet die Spannungsachse bei U_q und die Stromachse bei I_k. Berechne I_k und lies im Prüfstand „' + rname('diode') + '“ (Ansicht Kennlinie) den Arbeitspunkt der LED ab, also I_D und U_D. Danach sinkt die Quellenspannung auf ' + eng(G.uq2, 'V') + ': Wie groß wird I_D? Beantworte zuletzt zwei Fragen zur Lage der Arbeitsgeraden.',
      fields: () => [{ key: 'ik', label: 'Achsenabschnitt I_k (bei U = 0)', unit: 'mA' }, { key: 'id', label: 'Strom I_D im Arbeitspunkt', unit: 'mA' }, { key: 'ud', label: 'Spannung U_D im Arbeitspunkt', unit: 'V' }, { key: 'id2', label: 'Strom I_D bei kleinerer Quellenspannung', unit: 'mA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Arbeitsgerade gehört zum Vorwiderstand: Bei I = 0 liegt die ganze Quellenspannung an der Diode (Punkt U_q auf der Spannungsachse), bei U = 0 fließt I_k = U_q / R_V (Punkt auf der Stromachse). Der Arbeitspunkt ist der Schnittpunkt der Geraden mit der Kennlinie der LED.',
        'I_k = ' + f(v.uq, 0) + ' V / ' + f(v.rv, 0) + ' Ω ergibt etwa ' + f(v.ik, 1) + ' mA. Der Arbeitspunkt liegt bei einer viel kleineren Spannung, weil an einer LED nur wenig Spannung abfällt; der Rest liegt am Widerstand. Im Arbeitspunkt ist der Strom deshalb kleiner als I_k.',
        'Musterlösung: I_k = ' + f(v.ik, 2) + ' mA. Arbeitspunkt: U_D = ' + f(v.ud, 2) + ' V, I_D = ' + f(v.id, 2) + ' mA. Bei ' + f(v.uq2, 0) + ' V verschiebt sich die Gerade parallel (I_k = ' + f(v.ik2, 2) + ' mA), und I_D sinkt auf ' + f(v.id2, 2) + ' mA. Mit doppeltem R_V käme I_k = ' + f(v.ik3, 2) + ' mA.'
      ]; },
      start: () => A('diode', ctl(G.uq, G.rv), { fields: { ik: null, id: null, ud: null, id2: null }, choices: {} }),
      sol: () => { const v = vals(); return A('diode', ctl(G.uq, G.rv), { fields: { ik: v.ik, id: v.id, ud: v.ud, id2: v.id2 }, choices: rightOf(specs()), value: v.id }); },
      wrong: () => { const v = vals(); return [
        { name: 'Achsenabschnitt und Arbeitspunktstrom vertauscht, U_R statt U_D', answer: A('diode', {}, { fields: { ik: v.id, id: v.ik, ud: v.ur, id2: v.idProp }, choices: { rvdopp: 'parallel', uq6: 'dreht' } }) },
        { name: 'Zahlen richtig, Lage der Geraden falsch beschrieben', answer: A('diode', {}, { fields: { ik: v.ik, id: v.id, ud: v.ud, id2: v.id2 }, choices: { rvdopp: 'steiler', uq6: 'gleich' } }) }]; } };
  })();

  /* ====================================================================== ae34: Verlustleistungshyperbel (Lernfeld 6.1, Ausgangskennlinienfeld) */ /* PRUEFEN P2: P_tot = 0,5 W ist der Übungswert des Labs (limit ptot, Frage F4), nicht ein Datenblattwert */
  const M34 = (() => {
    const U1 = 4, U2 = 12, IC3 = 0.06, APS = [{ k: 'pa', u: 6, i: 0.06 }, { k: 'pb', u: 10, i: 0.07 }, { k: 'pc', u: 3, i: 0.15 }];
    const P = () => lv('ptot');
    const FIX = { ub: 12, ust: 5, last: 'ohm', rlast: 100, rb: 4700, b: 100, eingang: 'dauer-ein', fehler: 'keiner', ziel: 0 };
    const vals = () => once('v34', () => { const p = P(); return { p: p * 1e3, u1: U1, u2: U2, i1: p / U1 * 1e3, i2: p / U2 * 1e3, ic3: IC3 * 1e3, umax: p / IC3, pa: APS[0].u * APS[0].i * 1e3, pb: APS[1].u * APS[1].i * 1e3, pc: APS[2].u * APS[2].i * 1e3, wrongI1: p * U1, wrongU: p * IC3 }; });
    const rI1 = () => once('r34a', () => { const p = P(), v = vals(); return own(p / U1, 'A', [{ v: p * U1, id: 'mal', text: 'Du hast P_tot · U_CE gerechnet (' + f(v.wrongI1, 1) + ' W). Auf der Hyperbel gilt P_tot = U_CE · I_C, also I_C = P_tot / U_CE.' }, { v: U1 / p, id: 'kehr', text: 'Du hast U_CE / P_tot gerechnet. Der Strom ist I_C = P_tot / U_CE, die Leistung durch die Spannung.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.i1 }); });
    const rI2 = () => once('r34b', () => { const p = P(), v = vals(); return own(p / U2, 'A', [{ v: p * U2, id: 'mal', text: 'Du hast P_tot · U_CE gerechnet. Auf der Hyperbel gilt I_C = P_tot / U_CE; bei größerer Spannung wird der zulässige Strom kleiner, nicht größer.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.i2 }); });
    const rU = () => once('r34c', () => { const p = P(), v = vals(); return own(p / IC3, 'V', [{ v: p * IC3, id: 'mal', text: 'Du hast P_tot · I_C gerechnet (' + f(v.wrongU, 2) + '). Gesucht ist die Spannung, bei der U_CE · I_C genau P_tot ergibt: U_CE = P_tot / I_C.' }], { dispUnit: 'V', disp: v.umax }); });
    const specs = () => once('sp34', () => { const v = vals(), p = v.p, lab = ['zulässig: Punkt unter der Hyperbel', 'unzulässig: Punkt über der Hyperbel'], pw = { pa: v.pa, pb: v.pb, pc: v.pc };
      const order = { pa: ['nein', 'ok'], pb: ['ok', 'nein'], pc: ['ok', 'nein'] };
      return APS.map(a => { const pv = pw[a.k], ok = pv <= p, ap = 'U_CE = ' + f(a.u, 0) + ' V, I_C = ' + f(a.i * 1e3, 0) + ' mA';
        const g = pv <= p ? 'Die Verlustleistung ist ' + f(a.u, 0) + ' V · ' + f(a.i * 1e3, 0) + ' mA = ' + f(pv, 0) + ' mW und liegt unter P_tot = ' + f(p, 0) + ' mW: Der Punkt liegt unterhalb der Hyperbel.' : 'Die Verlustleistung ist ' + f(a.u, 0) + ' V · ' + f(a.i * 1e3, 0) + ' mA = ' + f(pv, 0) + ' mW und liegt über P_tot = ' + f(p, 0) + ' mW: Der Punkt liegt oberhalb der Hyperbel.';
        const gOpp = pv <= p ? 'Die Verlustleistung ' + f(pv, 0) + ' mW (= ' + f(a.u, 0) + ' V · ' + f(a.i * 1e3, 0) + ' mA) liegt unter P_tot = ' + f(p, 0) + ' mW, der Punkt liegt also unter der Hyperbel und ist zulässig.' : 'Die Verlustleistung ' + f(pv, 0) + ' mW (= ' + f(a.u, 0) + ' V · ' + f(a.i * 1e3, 0) + ' mA) liegt über P_tot = ' + f(p, 0) + ' mW, der Punkt liegt über der Hyperbel und ist nicht zulässig.';
        const opts = { ok: { value: 'ok', label: lab[0], grund: ok ? g : gOpp }, nein: { value: 'nein', label: lab[1], grund: ok ? gOpp : g } };
        return { key: a.k, q: 'Betriebspunkt ' + ap + ': Ist er bezüglich der Verlustleistung zulässig?', short: 'Der Betriebspunkt ' + ap + ' ist richtig beurteilt', right: ok ? 'ok' : 'nein', options: order[a.k].map(k => opts[k]) }; }); });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'i1'), rI1(), 'Der Strom auf der Hyperbel bei U_CE = ' + f(U1, 0) + ' V ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'i2'), rI2(), 'Der Strom auf der Hyperbel bei U_CE = ' + f(U2, 0) + ' V ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'umax'), rU(), 'Die größte Spannung U_CE bei I_C = ' + f(IC3 * 1e3, 0) + ' mA ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein Transistor darf höchstens die Verlustleistung P_tot = ' + eng(P(), 'W') + ' umsetzen (Übungswert). Im Ausgangskennlinienfeld ist die Verlustleistungshyperbel die Linie I_C = P_tot / U_CE; darüber ist der Betrieb unzulässig. Berechne den Strom I_C auf der Hyperbel für U_CE = ' + f(U1, 0) + ' V und für U_CE = ' + f(U2, 0) + ' V und bestimme, bis zu welcher Spannung U_CE ein Kollektorstrom von ' + f(IC3 * 1e3, 0) + ' mA zulässig bleibt. Beurteile dann drei Betriebspunkte. Im Prüfstand „' + rname('schalter') + '“ zeigt das Messgerät „Verlustleistung Transistor“ die Warnmarke bei P_tot.',
      fields: () => [{ key: 'i1', label: 'Strom I_C bei U_CE = ' + f(U1, 0) + ' V', unit: 'mA' }, { key: 'i2', label: 'Strom I_C bei U_CE = ' + f(U2, 0) + ' V', unit: 'mA' }, { key: 'umax', label: 'Größte Spannung U_CE bei ' + f(IC3 * 1e3, 0) + ' mA', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Verlustleistung im Transistor ist ungefähr P = U_CE · I_C. Auf der Hyperbel gilt U_CE · I_C = P_tot. Daraus folgen I_C = P_tot / U_CE und U_CE = P_tot / I_C. Ein Punkt ist zulässig, wenn sein Produkt U_CE · I_C unter P_tot liegt.',
        'Rechne in A, V und W: I_C(' + f(v.u1, 0) + ' V) = ' + f(v.p, 0) + ' mW / ' + f(v.u1, 0) + ' V, danach in mA umrechnen. Bei doppelter Spannung halbiert sich der zulässige Strom. Zur Beurteilung bildest du für jeden Punkt U_CE · I_C und vergleichst mit ' + f(v.p, 0) + ' mW.',
        'Musterlösung: I_C(' + f(v.u1, 0) + ' V) = ' + f(v.i1, 1) + ' mA, I_C(' + f(v.u2, 0) + ' V) = ' + f(v.i2, 2) + ' mA, U_CE,max(' + f(v.ic3, 0) + ' mA) = ' + f(v.umax, 2) + ' V. Die Punkte haben ' + f(v.pa, 0) + ' mW, ' + f(v.pb, 0) + ' mW und ' + f(v.pc, 0) + ' mW: zulässig, unzulässig, zulässig.'
      ]; },
      start: () => A('schalter', FIX, { fields: { i1: null, i2: null, umax: null }, choices: {} }),
      sol: () => { const v = vals(); return A('schalter', FIX, { fields: { i1: v.i1, i2: v.i2, umax: v.umax }, choices: rightOf(specs()), value: v.i1 }); },
      wrong: () => { const v = vals(); return [
        { name: 'Leistung mal Spannung gerechnet (zu groß), alles zulässig', answer: A('schalter', {}, { fields: { i1: v.wrongI1 * 1e3, i2: v.p / 1e3 * U2 * 1e3, umax: v.wrongU }, choices: { pa: 'ok', pb: 'ok', pc: 'ok' } }) },
        { name: 'Kehrwert gerechnet, alles unzulässig', answer: A('schalter', {}, { fields: { i1: U1 / (v.p / 1e3) * 1e3, i2: v.i2, umax: v.umax }, choices: { pa: 'nein', pb: 'nein', pc: 'nein' } }) }]; } };
  })();

  /* ====================================================================== ae35: Betriebszustaende des Transistors (Lernfeld 6.1, Zustaende einer Transistorschaltstufe) */ /* PRUEFEN P3: Das Lab kennt die Zustände gesperrt, aktiv, gesättigt (ü ab 1); der Unterricht trennt Sättigungsbeginn und Übersteuerung */
  const M35 = (() => {
    const G = { ub: 12, rl: 470, rb: 22000, b: 100 }, USTS = [0.5, 2, 4, 8];
    const FIX = { ub: G.ub, last: 'ohm', rlast: G.rl, rb: G.rb, b: G.b, eingang: 'dauer-ein', fehler: 'keiner', ziel: 0 };
    const sw = ust => once('sw35|' + ust, () => { const s = C().tr.switch({ ub: G.ub, ust, rb: G.rb, b: G.b, last: 'ohm', rlast: G.rl }); if (!s || !s.ok) throw new Error('tr.switch ae35'); return s; });
    const ube0 = () => lv('ube');
    const ustmin = () => ube0() + G.rb * sw(20).ibmin;
    const vals = () => once('v35', () => { const s = sw(20), o = {}; USTS.forEach((u, k) => { const r = sw(u); o['ust' + k] = u; o['ib' + k] = r.ib * 1e6; o['ic' + k] = r.ic * 1e3; o['uce' + k] = r.uce; o['ueb' + k] = r.ueb; });
      return Object.assign(o, { ub: G.ub, rl: G.rl, rb: G.rb / 1e3, b: G.b, ube: ube0(), icsat: s.icSat * 1e3, ibmin: s.ibmin * 1e6, ucesat: lv('ucesat'), ustmin: ustmin(), ohneUbe: G.rb * s.ibmin }); });
    const rU = () => once('r35', () => { const v = vals(); return own(v.ustmin, 'V', [{ v: v.ohneUbe, id: 'ubeVergessen', text: 'Dein Wert (' + f(v.ohneUbe, 2) + ' V) ist nur der Spannungsfall an R_B. Die Steuerspannung muss zusätzlich die Basis-Emitter-Spannung U_BE = ' + f(v.ube, 1) + ' V aufbringen.' }, { v: G.ub, id: 'ub', text: 'Die Steuerspannung muss nicht so groß sein wie die Betriebsspannung. Nötig sind nur U_BE plus den Spannungsfall R_B · I_B,min, wobei I_B,min = I_C,sat / B der Basisstrom ist, der den Transistor gerade sättigt.' }], {}); });
    const zname = { sperrt: 'Sperrbereich', aktiv: 'aktiver Bereich', saettigung: 'Sättigung' };
    const OPTS = [['sperrt', 'Sperrbereich (Schalter offen)'], ['aktiv', 'Aktiver Bereich (verstärkend)'], ['saettigung', 'Sättigung (Schalter geschlossen)']];
    const specs = () => once('sp35', () => { const v = vals(); const orders = [[1, 0, 2], [2, 1, 0], [0, 2, 1], [1, 2, 0]];
      return USTS.map((u, k) => { const r = sw(u), z = r.zustand, ibU = f(v['ib' + k], 0) + ' µA', icM = f(v['ic' + k], 1) + ' mA', uceV = f(v['uce' + k], 2) + ' V';
        const g = {
          sperrt: z === 'sperrt' ? 'U_BE = ' + f(u, 1) + ' V liegt unter der Schwelle von ' + f(v.ube, 1) + ' V: Es fließt kein Basisstrom, I_C = 0 und U_CE = U_B = ' + f(G.ub, 0) + ' V.' : 'Gesperrt wäre der Transistor nur ohne Basisstrom (U_BE unter ' + f(v.ube, 1) + ' V). Hier fließt aber I_B = ' + ibU + ' und I_C = ' + icM + '.',
          aktiv: z === 'aktiv' ? 'I_B = ' + ibU + ' wird verstärkt: I_C = B · I_B = ' + icM + ', U_CE = ' + uceV + ' liegt deutlich über U_CE,sat = ' + f(v.ucesat, 1) + ' V, und ü = ' + f(v['ueb' + k], 2) + ' liegt unter 1.' : (z === 'sperrt' ? 'Im aktiven Bereich müsste ein Basisstrom fließen. Hier liegt U_BE = ' + f(u, 1) + ' V unter der Schwelle von ' + f(v.ube, 1) + ' V, der Transistor sperrt.' : 'Im aktiven Bereich wäre I_C = B · I_B = ' + f(G.b * v['ib' + k] / 1e3, 1) + ' mA. Die Last erlaubt aber höchstens I_C,sat = ' + f(v.icsat, 1) + ' mA, und U_CE ist auf ' + uceV + ' gefallen: Der Transistor ist gesättigt.'),
          saettigung: z === 'saettigung' ? 'I_B = ' + ibU + ' liegt über I_B,min = ' + f(v.ibmin, 0) + ' µA (ü = ' + f(v['ueb' + k], 2) + '): I_C wird von der Last bestimmt (I_C,sat = ' + f(v.icsat, 1) + ' mA), U_CE ist nur noch ' + uceV + '.' : (z === 'sperrt' ? 'Zur Sättigung wäre ein Basisstrom über I_B,min = ' + f(v.ibmin, 0) + ' µA nötig. Hier fließt gar keiner, U_CE = ' + uceV + '.' : 'Zur Sättigung wäre I_B über I_B,min = ' + f(v.ibmin, 0) + ' µA nötig; hier sind es ' + ibU + ' (ü = ' + f(v['ueb' + k], 2) + '). U_CE = ' + uceV + ' liegt noch weit über U_CE,sat.')
        };
        return { key: 'z' + k, q: 'Zeile U_St = ' + f(u, 1) + ' V (U_BE = ' + f(Math.min(u, v.ube), 1) + ' V, I_B = ' + ibU + ', I_C = ' + icM + ', U_CE = ' + uceV + '): In welchem Zustand arbeitet der Transistor?', short: 'Der Zustand bei U_St = ' + f(u, 1) + ' V ist richtig bestimmt', right: z,
          options: orders[k].map(i => ({ value: OPTS[i][0], label: OPTS[i][1], grund: g[OPTS[i][0]] })) }; }); });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ustmin'), rU(), 'Die kleinste Steuerspannung für die Sättigung ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein npn-Transistor schaltet im Prüfstand „' + rname('schalter') + '“ einen ohmschen Verbraucher R_L = ' + eng(G.rl, 'Ω') + ' an U_B = ' + eng(G.ub, 'V') + '; der Basisvorwiderstand beträgt R_B = ' + eng(G.rb, 'Ω') + ', die Gleichstromverstärkung B = ' + f(G.b, 0) + ' (Übungsschaltung; U_BE = ' + f(ube0(), 1) + ' V im leitenden Zustand, U_CE,sat = ' + f(lv('ucesat'), 1) + ' V). Die Tabelle zeigt vier Betriebspunkte bei verschiedenen Steuerspannungen U_St. Bestimme für jeden Punkt den Zustand und berechne die kleinste Steuerspannung, bei der die Sättigung beginnt (ü = 1).',
      table: () => { const v = vals(); return { caption: 'Betriebspunkte (Simulation, Übungswerte)', head: ['U_St', 'U_BE', 'I_B', 'I_C', 'U_CE'], rows: USTS.map((u, k) => [f(u, 1) + ' V', f(Math.min(u, v.ube), 1) + ' V', f(v['ib' + k], 0) + ' µA', f(v['ic' + k], 1) + ' mA', f(v['uce' + k], 2) + ' V']) }; },
      fields: () => [{ key: 'ustmin', label: 'Kleinste Steuerspannung für die Sättigung', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Gesperrt: U_BE unter der Schwelle, I_B = 0, I_C = 0. Aktiv: I_C = B · I_B und U_CE deutlich über U_CE,sat. Sättigung: I_B ist größer als I_B,min = I_C,sat / B (ü über 1), I_C wird von der Last bestimmt und U_CE fällt auf U_CE,sat. Die Sättigung beginnt bei I_B = I_B,min.',
        'I_C,sat = (U_B − U_CE,sat) / R_L = ' + f(v.icsat, 1) + ' mA, daraus I_B,min = I_C,sat / B = ' + f(v.ibmin, 0) + ' µA. Die Steuerspannung muss U_BE und den Spannungsfall an R_B (R_B · I_B,min = ' + f(v.ohneUbe, 2) + ' V) liefern.',
        'Musterlösung: Zustände gesperrt, aktiv, aktiv (ü = ' + f(v.ueb2, 2) + '), Sättigung (ü = ' + f(v.ueb3, 2) + '). U_St,min = U_BE + R_B · I_B,min = ' + f(v.ube, 1) + ' V + ' + f(v.ohneUbe, 2) + ' V = ' + f(v.ustmin, 2) + ' V.'
      ]; },
      start: () => A('schalter', Object.assign({}, FIX, { ust: 0.5 }), { fields: { ustmin: null }, choices: {} }),
      sol: () => A('schalter', Object.assign({}, FIX, { ust: vals().ustmin }), { fields: { ustmin: vals().ustmin }, choices: rightOf(specs()), value: vals().ustmin }),
      wrong: () => { const v = vals(); return [
        { name: 'U_BE vergessen (zu klein), jede Zeile aktiv', answer: A('schalter', {}, { fields: { ustmin: v.ohneUbe }, choices: { z0: 'aktiv', z1: 'aktiv', z2: 'aktiv', z3: 'aktiv' } }) },
        { name: 'Betriebsspannung als Schwelle (zu groß), Zustände vertauscht', answer: A('schalter', {}, { fields: { ustmin: G.ub }, choices: { z0: 'saettigung', z1: 'sperrt', z2: 'saettigung', z3: 'aktiv' } }) }]; } };
  })();

  /* ====================================================================== ae36: Stromverstaerkung aus der Messreihe (Lernfeld 6.1, Stromsteuerkennlinie; E9-Labor Bipolartransistor) */ /* PRUEFEN P4: B = 140 und die Messreihe sind Simulationswerte (Modell ohne Early-Effekt, B konstant bis zur Sättigung) */
  const M36 = (() => {
    const G = { ub: 12, rl: 220, rb: 10000, b: 140 }, IBS = [20, 60, 120, 300, 800];
    const FIX = { ub: G.ub, last: 'ohm', rlast: G.rl, rb: G.rb, b: G.b, eingang: 'dauer-ein', fehler: 'keiner', ziel: 0 };
    const ustOf = ib => Math.round((lv('ube') + G.rb * ib * 1e-6) * 10) / 10;
    const sw = ib => once('sw36|' + ib, () => { const s = C().tr.switch({ ub: G.ub, ust: ustOf(ib), rb: G.rb, b: G.b, last: 'ohm', rlast: G.rl }); if (!s || !s.ok) throw new Error('tr.switch ae36'); return s; });
    const vals = () => once('v36', () => { const o = {}; IBS.forEach((ib, k) => { const r = sw(ib); o['ib' + k] = r.ib * 1e6; o['ic' + k] = r.ic * 1e3; o['uce' + k] = r.uce; o['ust' + k] = ustOf(ib); o['b' + k] = r.ic / r.ib; });
      const s = sw(800); return Object.assign(o, { b: G.b, bsat: s.ic / s.ib, icsat: s.icSat * 1e3, ibmin: s.ibmin * 1e6, rl: G.rl, ib2: IBS[2], ic2: o.ic2, kehr: 1 / G.b }); });
    const rB = () => once('r36b', () => { const v = vals(); return own(G.b, '', [{ v: 1 / G.b, id: 'kehr', text: 'Dein Wert ist der Kehrwert I_B / I_C. Die Gleichstromverstärkung ist B = I_C / I_B (Ausgangsstrom durch Eingangsstrom).' }], { tol: 0.03 }); });
    const rBs = () => once('r36s', () => { const v = vals(); return own(v.bsat, '', [{ v: G.b, id: 'linear', text: 'Dein Wert ist die Verstärkung des linearen Bereichs. In der letzten Zeile ist der Transistor gesättigt: I_C = ' + f(v.ic4, 1) + ' mA wird von der Last begrenzt, das Verhältnis I_C / I_B fällt deshalb deutlich ab.' }], { tol: 0.03 }); });
    const specs = () => once('sp36', () => { const v = vals(); return [
      { key: 'letzte', q: 'Die letzte Zeile (I_B = ' + f(IBS[4], 0) + ' µA) liefert einen viel kleineren Wert I_C / I_B als die anderen. Woran liegt das?', short: 'Die Ursache der kleineren Verstärkung in der letzten Zeile ist richtig erkannt', right: 'saettigung',
        options: [
          { value: 'fehler', label: 'Das Messgerät hat bei großem Strom falsch angezeigt', grund: 'Dafür gibt es keinen Hinweis: Die Spannung U_CE = ' + f(v.uce4, 2) + ' V zeigt, dass der Transistor ausgesteuert ist. Er kann nicht mehr Strom führen, als die Last mit R_L = ' + f(G.rl, 0) + ' Ω bei U_B zulässt (' + f(v.icsat, 1) + ' mA).' },
          { value: 'saettigung', label: 'Der Transistor ist gesättigt, die Last begrenzt I_C', grund: 'Mit I_B = ' + f(IBS[4], 0) + ' µA liegt der Basisstrom über I_B,min = ' + f(v.ibmin, 0) + ' µA. I_C ist auf I_C,sat = ' + f(v.icsat, 1) + ' mA begrenzt, U_CE ist nur noch ' + f(v.uce4, 2) + ' V. B = I_C / I_B ist hier nur noch ' + f(v.bsat, 0) + '.' },
          { value: 'heiss', label: 'Der Transistor ist heiß geworden und hat B verloren', grund: 'Die Verlustleistung ist hier sogar klein (U_CE ist nur ' + f(v.uce4, 2) + ' V). Der Abfall von B kommt von der Sättigung: I_C ist auf ' + f(v.icsat, 1) + ' mA begrenzt, obwohl B · I_B größer wäre.' },
          { value: 'sperr', label: 'Der Transistor beginnt zu sperren, weil I_B zu groß ist', grund: 'Ein großer Basisstrom sperrt nicht, er sättigt: I_B = ' + f(IBS[4], 0) + ' µA liegt über I_B,min = ' + f(v.ibmin, 0) + ' µA, U_CE fällt auf ' + f(v.uce4, 2) + ' V.' }] },
      { key: 'kennlinie', q: 'Welche Aussage über die Stromsteuerkennlinie I_C = f(I_B) trifft zu?', short: 'Die Stromsteuerkennlinie ist richtig beschrieben', right: 'gerade',
        options: [
          { value: 'expon', label: 'Exponentieller Anstieg, wie bei der Diodenkennlinie', grund: 'Exponentiell verläuft die Eingangskennlinie I_B = f(U_BE). Die Stromsteuerkennlinie I_C = f(I_B) ist bis zur Sättigung nahezu eine Gerade, die Steigung ist B (hier ' + f(G.b, 0) + ').' },
          { value: 'waag', label: 'Waagerechte Linie: I_C hängt nicht von I_B ab', grund: 'Der Basisstrom steuert den Kollektorstrom: In der Messreihe wächst I_C von ' + f(v.ic0, 1) + ' mA auf ' + f(v.ic3, 1) + ' mA, wenn I_B von ' + f(IBS[0], 0) + ' µA auf ' + f(IBS[3], 0) + ' µA steigt.' },
          { value: 'gerade', label: 'Bis zur Sättigung nahezu eine Ursprungsgerade', grund: 'Im aktiven Bereich gilt I_C = B · I_B: Die Punkte liegen auf einer Geraden durch den Ursprung mit der Steigung B = ' + f(G.b, 0) + '. Erst in der Sättigung knickt sie ab (I_C,sat = ' + f(v.icsat, 1) + ' mA).' },
          { value: 'fallend', label: 'Fallende Linie: mehr I_B bringt weniger I_C', grund: 'Mehr Basisstrom bringt im aktiven Bereich mehr Kollektorstrom (I_C = B · I_B). Die Kennlinie knickt erst in der Sättigung ab, sie fällt nie.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'b'), rB(), 'Die Gleichstromverstärkung B im linearen Bereich ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'bsat'), rBs(), 'Das Verhältnis I_C / I_B der letzten Zeile ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Im Prüfstand „' + rname('schalter') + '“ wurde ein npn-Transistor an U_B = ' + eng(G.ub, 'V') + ' mit einem ohmschen Verbraucher R_L = ' + eng(G.rl, 'Ω') + ' untersucht (Übungsschaltung, Basisvorwiderstand R_B = ' + eng(G.rb, 'Ω') + '). Die Tabelle enthält die Messreihe I_C in Abhängigkeit von I_B. Berechne die Gleichstromverstärkung B = I_C / I_B im linearen Bereich und das Verhältnis I_C / I_B der letzten Zeile; erkläre dann die Abweichung und beschreibe die Stromsteuerkennlinie.',
      table: () => { const v = vals(); return { caption: 'Messreihe (Simulation, Übungswerte)', head: ['U_St', 'I_B', 'I_C', 'U_CE'], rows: IBS.map((ib, k) => [f(v['ust' + k], 1) + ' V', f(v['ib' + k], 0) + ' µA', f(v['ic' + k], 1) + ' mA', f(v['uce' + k], 2) + ' V']) }; },
      fields: () => [{ key: 'b', label: 'Gleichstromverstärkung B im linearen Bereich', unit: '' }, { key: 'bsat', label: 'I_C / I_B in der letzten Zeile', unit: '' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Gleichstromverstärkung ist B = I_C / I_B. Rechne dazu in gleichen Einheiten (mA durch µA gibt den Faktor 1000). Im aktiven Bereich ist B für alle Zeilen nahezu gleich; eine Zeile, die herausfällt, gehört zu einem anderen Zustand.',
        'Beispiel: I_C = ' + f(v.ic2, 1) + ' mA bei I_B = ' + f(v.ib2, 0) + ' µA ergibt B = ' + f(v.ic2, 1) + ' mA / ' + f(v.ib2, 0) + ' µA. Die letzte Zeile hat U_CE = ' + f(v.uce4, 2) + ' V und damit I_C,sat = ' + f(v.icsat, 1) + ' mA; teile auch dort I_C durch I_B.',
        'Musterlösung: B = ' + f(v.b, 0) + ' (alle Zeilen außer der letzten). Letzte Zeile: ' + f(v.icsat, 1) + ' mA / ' + f(v.ib4, 0) + ' µA = ' + f(v.bsat, 1) + ': Der Transistor ist gesättigt, I_C wird von der Last begrenzt (I_B,min = ' + f(v.ibmin, 0) + ' µA).'
      ]; },
      start: () => A('schalter', Object.assign({}, FIX, { ust: 0.9 }), { fields: { b: null, bsat: null }, choices: {} }),
      sol: () => { const v = vals(); return A('schalter', Object.assign({}, FIX, { ust: ustOf(IBS[4]) }), { fields: { b: v.b, bsat: v.bsat }, choices: rightOf(specs()), value: v.b }); },
      wrong: () => { const v = vals(); return [
        { name: 'Kehrwert gerechnet, Messfehler vermutet', answer: A('schalter', {}, { fields: { b: v.kehr, bsat: v.b }, choices: { letzte: 'fehler', kennlinie: 'expon' } }) },
        { name: 'B der Sättigung gleich dem linearen B, Kennlinie fallend', answer: A('schalter', {}, { fields: { b: v.b, bsat: v.b }, choices: { letzte: 'heiss', kennlinie: 'fallend' } }) }]; } };
  })();

  /* ====================================================================== ae37: Dotierung und Sperrschicht (Lernfeld 6.1, Halbleitergrundlagen) */ /* PRUEFEN P5: Diffusionsspannung Silizium etwa 0,7 V und Temperaturgang etwa 2 mV/K stammen aus dem Lehrmodell des Prüfstands */
  const M37 = (() => {
    const CTL = () => ({ typ: 'si', modell: 'kennlinie', uq: 5, rv: 220, temp: 27, fehler: 'keiner', ziel: 0 });
    const T1 = 87;
    const d = t => once('d37|' + t, () => { const s = sim('diode', Object.assign(CTL(), { temp: t })); if (!s.ok) throw new Error('Prüfstand ae37'); return s.m; });
    const vals = () => once('v37', () => { const a = d(27), b = d(T1); return { uf: C().diode.types.find(x => x.id === 'si').uf, t0: 27, t1: T1, dt: T1 - 27, ud0: a.ud, ud1: b.ud, dud: (a.ud - b.ud) * 1e3, kmv: (a.ud - b.ud) * 1e3 / (T1 - 27) }; });
    const specs = () => once('sp37', () => { const v = vals(); return [
      { key: 'dotierung', q: 'Reines Silizium (vierwertig) wird mit Phosphor dotiert, einem Element mit fünf Valenzelektronen. Was entsteht?', short: 'Das Ergebnis der Phosphor-Dotierung ist richtig bestimmt', right: 'n',
        options: [
          { value: 'p', label: 'p-Halbleiter, die Phosphoratome nehmen Elektronen auf', grund: 'Phosphor bringt ein Elektron mehr mit, als das Gitter für die Bindungen braucht. Er gibt es ab (Donator), es entsteht ein n-Halbleiter. Akzeptoren (dreiwertig, zum Beispiel Bor) nehmen Elektronen auf und erzeugen p-Leitung.' },
          { value: 'n', label: 'n-Halbleiter, Elektronen sind die Majoritätsträger', grund: 'Das fünfte Valenzelektron wird nicht zur Bindung gebraucht und ist frei beweglich. Die Phosphoratome sind Donatoren und bleiben als ortsfeste positive Ionen im Gitter. Die Elektronen sind die Majoritätsträger.' },
          { value: 'loch', label: 'n-Halbleiter, Löcher sind die Majoritätsträger', grund: 'Beim n-Halbleiter sind die Elektronen in der Mehrzahl. Die Löcher stammen nur aus der Eigenleitung und sind die Minoritätsträger.' },
          { value: 'iso', label: 'Ein Isolator, weil die Fremdatome Bindungen blockieren', grund: 'Dotieren erhöht die Leitfähigkeit stark, weil zusätzliche bewegliche Ladungsträger entstehen. Ein Isolator entsteht dabei nicht.' }] },
      { key: 'sperrschicht', q: 'Ein p-Gebiet und ein n-Gebiet werden aneinandergefügt, ohne äußere Spannung. Wie entsteht die Sperrschicht?', short: 'Die Entstehung der Sperrschicht ist richtig erklärt', right: 'diff',
        options: [
          { value: 'quelle', label: 'Durch die Spannung der Quelle, die Ladungsträger abzieht', grund: 'Es ist keine Quelle angeschlossen. Die Sperrschicht entsteht von selbst durch Diffusion der Ladungsträger über die Grenze.' },
          { value: 'wander', label: 'Die Fremdatome wandern über die Grenze und mischen sich', grund: 'Die Fremdatome sind im Gitter ortsfest. Es diffundieren die beweglichen Ladungsträger (Elektronen und Löcher), nicht die Atome.' },
          { value: 'warm', label: 'Durch starke Erwärmung, die alle Ladungsträger zerstört', grund: 'Wärme erzeugt zusätzliche Ladungsträgerpaare, sie zerstört keine. Die Bewegung über die Grenze kommt aus der Diffusion, danach bleibt eine Raumladung zurück.' },
          { value: 'diff', label: 'Diffusion und Rekombination lassen ortsfeste Ionen zurück', grund: 'Elektronen wandern ins p-Gebiet, Löcher ins n-Gebiet und rekombinieren dort. Zurück bleiben ortsfeste Ionen (Raumladung); sie bauen die Diffusionsspannung auf und stoppen die weitere Diffusion.' }] },
      { key: 'durchlass', q: 'Eine Siliziumdiode liegt in Durchlassrichtung an einer Spannung. Was geschieht mit der Sperrschicht?', short: 'Das Verhalten der Sperrschicht in Durchlassrichtung ist richtig beschrieben', right: 'abbau',
        options: [
          { value: 'abbau', label: 'Schmaler: ab etwa ' + f(v.uf, 1) + ' V fließt nennenswert Strom', grund: 'Die äußere Spannung wirkt der Diffusionsspannung entgegen (bei Silizium etwa ' + f(v.uf, 1) + ' V): Die Sperrschicht wird abgebaut, Ladungsträger fließen über den Übergang.' },
          { value: 'breiter', label: 'Breiter: der Strom bleibt klein', grund: 'Breiter wird die Sperrschicht in Sperrrichtung. In Durchlassrichtung schwächt die Spannung die Raumladung, die Schicht wird schmaler.' },
          { value: 'gleich', label: 'Unverändert: die Diode leitet schon bei kleinen Spannungen', grund: 'Bei Silizium fließt erst ab etwa ' + f(v.uf, 1) + ' V nennenswert Strom, weil die Diffusionsspannung überwunden werden muss; dabei wird die Sperrschicht abgebaut.' },
          { value: 'ionen', label: 'Verschwunden erst, wenn die Ionen das Gitter verlassen', grund: 'Die Ionen sind ortsfest und verlassen das Gitter nicht. Die Sperrschicht wird abgebaut, weil Ladungsträger sie wieder füllen.' }] },
      { key: 'temperatur', q: 'Die Temperatur einer Siliziumdiode steigt um ' + f(v.dt, 0) + ' K (Prüfstand: ' + f(v.t0, 0) + ' °C auf ' + f(v.t1, 0) + ' °C, Quelle und Vorwiderstand bleiben). Was ist die Folge?', short: 'Die Wirkung der Erwärmung ist richtig beschrieben', right: 'mehrLT',
        options: [
          { value: 'mehrLT', label: 'Mehr Ladungsträgerpaare, die Flussspannung sinkt', grund: 'Wärme erzeugt mehr Elektron-Loch-Paare (Generation), die Diode leitet früher: U_D sinkt hier von ' + f(v.ud0, 2) + ' V auf ' + f(v.ud1, 2) + ' V, etwa ' + f(v.kmv, 1) + ' mV je Kelvin (Simulation).' },
          { value: 'weniger', label: 'Weniger Ladungsträger, die Flussspannung steigt', grund: 'Bei höherer Temperatur entstehen mehr Ladungsträgerpaare, nicht weniger. Die Flussspannung sinkt von ' + f(v.ud0, 2) + ' V auf ' + f(v.ud1, 2) + ' V (Simulation).' },
          { value: 'kein', label: 'Keine Wirkung, die Flussspannung bleibt gleich', grund: 'Die Eigenleitung steigt mit der Temperatur, deshalb verschiebt sich die Kennlinie: U_D fällt um ' + f(v.dud, 0) + ' mV (von ' + f(v.ud0, 2) + ' V auf ' + f(v.ud1, 2) + ' V).' },
          { value: 'sperr', label: 'Die Diode sperrt, weil die Sperrschicht wächst', grund: 'Die Sperrschicht wächst nicht durch Wärme. Es entstehen mehr Ladungsträgerpaare, die Diode leitet früher: U_D sinkt von ' + f(v.ud0, 2) + ' V auf ' + f(v.ud1, 2) + ' V.' }] }]; });
    return pick({ rig: 'diode', ctl: CTL, specs, vals,
      text: () => 'Beantworte vier Fragen zu den Grundlagen der Halbleiter und der Diode: Dotierung, Sperrschicht, Durchlassrichtung und Temperatur. Im Prüfstand „' + rname('diode') + '“ ist eine Siliziumdiode mit Vorwiderstand aufgebaut (Übungsschaltung); mit dem Regler „Temperatur“ kannst du die letzte Frage nachprüfen.',
      hint: () => { const v = vals(); return [
        'Dotieren heißt, Fremdatome einzubauen: Fünfwertige Atome (zum Beispiel Phosphor) geben ein Elektron ab (Donatoren, n-Leitung), dreiwertige (zum Beispiel Bor) nehmen eines auf (Akzeptoren, p-Leitung). Am Übergang diffundieren Ladungsträger über die Grenze und hinterlassen ortsfeste Ionen.',
        'Die Ionen der Sperrschicht sitzen fest im Gitter und bauen die Diffusionsspannung auf (bei Silizium etwa ' + f(v.uf, 1) + ' V). Eine äußere Spannung in Durchlassrichtung wirkt ihr entgegen. Zur Temperatur: Wärme erzeugt zusätzliche Ladungsträgerpaare.',
        'Musterlösung: n-Halbleiter mit Elektronen als Majoritätsträgern; Sperrschicht durch Diffusion, Rekombination und ortsfeste Ionen; in Durchlassrichtung wird sie schmaler (ab etwa ' + f(v.uf, 1) + ' V); bei Erwärmung sinkt U_D von ' + f(v.ud0, 2) + ' V auf ' + f(v.ud1, 2) + ' V.'
      ]; } });
  })();

  /* ====================================================================== ae38: Diodentypen und ihr Einsatz (Lernfeld 6.1, Dioden mit besonderen Eigenschaften) */ /* PRUEFEN P6: Durchlassspannungen Schottky 0,3 V und LED 2 V sind Übungswerte; Suppressordiode "meist bidirektional" wie im Unterricht */
  const M38 = (() => {
    const CTL = () => ({ typ: 'si', modell: 'kennlinie', uq: 5, rv: 220, temp: 27, fehler: 'keiner', ziel: 0 });
    const vals = () => once('v38', () => { const t = C().diode.types, g = id => t.find(x => x.id === id).uf; return { ufSi: g('si'), ufSchottky: g('schottky'), ufLed: g('led_rot') }; });
    const TYPES = [['z', 'Z-Diode'], ['kap', 'Kapazitätsdiode'], ['schottky', 'Schottky-Diode'], ['supp', 'Suppressordiode'], ['foto', 'Fotodiode'], ['led', 'Leuchtdiode']];
    const WHY = v => ({
      z: 'Die Z-Diode arbeitet in Sperrrichtung und hält im Durchbruch ihre Z-Spannung fest; damit stabilisiert man eine Spannung.',
      kap: 'Die Kapazitätsdiode nutzt die Sperrschichtkapazität, die sich mit der Sperrspannung ändert; damit stimmt man Schwingkreise spannungsgesteuert ab.',
      schottky: 'Die Schottky-Diode hat einen Metall-Halbleiter-Übergang, schaltet sehr schnell und hat eine kleine Durchlassspannung (hier ' + f(v.ufSchottky, 1) + ' V gegenüber ' + f(v.ufSi, 1) + ' V bei der Siliziumdiode, Übungswerte).',
      supp: 'Die Suppressordiode wird oberhalb einer Spannungsschwelle schnell leitend und leitet Spannungsspitzen ab; sie liegt parallel zum Schutzobjekt und ist meist bidirektional.',
      foto: 'Die Fotodiode arbeitet in Sperrrichtung: Licht erzeugt Ladungsträgerpaare, der Sperrstrom steigt mit der Beleuchtung (Lichtschranke, Belichtungsmesser).',
      led: 'Die Leuchtdiode arbeitet in Durchlassrichtung (mit Vorwiderstand) und sendet Licht aus; sie ist die Umkehrung der Fotodiode (hier U_F = ' + f(v.ufLed, 1) + ' V für die rote LED, Übungswert).' });
    const CASES = [
      { k: 'f1', right: 'kap', q: 'Der Schwingkreis eines Radios soll über eine Gleichspannung abgestimmt werden, ohne einen Drehkondensator zu bewegen. Welches Bauteil dient als einstellbare Kapazität?', short: 'Die Diode für die Abstimmung des Schwingkreises ist richtig gewählt', order: [2, 0, 5, 1, 3, 4] },
      { k: 'f2', right: 'schottky', q: 'Ein hochfrequentes Signal soll gleichgerichtet werden. Die Diode muss sehr schnell schalten und dabei wenig Spannung verlieren. Welches Bauteil passt?', short: 'Die Diode für die schnelle Gleichrichtung ist richtig gewählt', order: [3, 4, 2, 0, 5, 1] },
      { k: 'f3', right: 'supp', q: 'Ein Signaleingang soll vor kurzen Spannungsspitzen geschützt werden. Das Bauteil liegt parallel zum Eingang und wird erst über einer bestimmten Spannung schnell leitend. Welches ist es?', short: 'Die Diode für den Überspannungsschutz ist richtig gewählt', order: [1, 2, 0, 3, 5, 4] },
      { k: 'f4', right: 'foto', q: 'In einer Lichtschranke soll der Empfänger bei Lichteinfall mehr Strom führen. Er sitzt in Sperrrichtung in der Schaltung. Welches Bauteil ist das?', short: 'Die Diode für den Lichtschranken-Empfänger ist richtig gewählt', order: [5, 4, 1, 2, 0, 3] },
      { k: 'f5', right: 'z', q: 'Eine Gleichspannung soll trotz schwankender Eingangsspannung konstant bleiben. Das Bauteil liegt mit Vorwiderstand in Sperrrichtung parallel zur Last. Welches ist es?', short: 'Die Diode zur Spannungsstabilisierung ist richtig gewählt', order: [0, 3, 1, 4, 2, 5] }];
    const specs = () => once('sp38', () => { const w = WHY(vals()); return CASES.map(c => ({ key: c.k, q: c.q, short: c.short, right: c.right, options: c.order.map(i => { const t = TYPES[i], own = t[0] === c.right; return { value: t[0], label: t[1], grund: own ? w[t[0]] + ' Das passt zur Aufgabe.' : w[t[0]] + ' Das passt nicht zur Aufgabe.' }; }) })); });
    return pick({ rig: 'diode', ctl: CTL, specs, vals,
      text: () => 'Fünf Anwendungen, ein Bauteil je Anwendung: Wähle für jeden Fall die Diodenart, die zur Aufgabe passt. Zur Auswahl stehen Z-Diode, Kapazitätsdiode, Schottky-Diode, Suppressordiode, Fotodiode und Leuchtdiode. Im Prüfstand „' + rname('diode') + '“ kannst du Siliziumdiode, Schottky-Diode, LED und Z-Diode vergleichen.',
      hint: () => { const v = vals(); return [
        'Frage dich bei jedem Fall: In welche Richtung wird die Diode betrieben, und welche Eigenschaft wird genutzt? Z-Diode: Durchbruchspannung. Kapazitätsdiode: Sperrschichtkapazität. Schottky: schnell, kleine Durchlassspannung. Suppressor: leitet Spannungsspitzen ab. Fotodiode: Licht steuert den Sperrstrom. LED: sendet Licht.',
        'Im Prüfstand siehst du den Unterschied bei der Durchlassspannung: Siliziumdiode etwa ' + f(v.ufSi, 1) + ' V, Schottky-Diode etwa ' + f(v.ufSchottky, 1) + ' V, rote LED etwa ' + f(v.ufLed, 1) + ' V. Die Fälle zwei und vier unterscheiden sich in der Betriebsrichtung.',
        'Musterlösung: Abstimmung mit Gleichspannung: Kapazitätsdiode; schnelle Gleichrichtung: Schottky-Diode; Schutz vor Spannungsspitzen: Suppressordiode; Lichtschranken-Empfänger: Fotodiode; Spannung konstant halten: Z-Diode.'
      ]; } });
  })();

  /* ====================================================================== ae39: Basisvorspannung und Ruhearbeitspunkt (Lernfeld 6.1, Arbeitspunkteinstellung) */ /* PRUEFEN P7: Schwelle 0,7 V (Lehrmodell); die Faustregel aus dem Unterricht (Sperren bei etwa 0,5 V, Übersteuern bei etwa 0,9 V) wurde nicht übernommen */
  const M39 = (() => {
    const CTL = () => ({ ub: 12, ue: 0.02, f: 1000, rg: 600, r1: 47000, r2: 10000, rc: 2200, re1: 100, re2: 470, ce: true, c1: 0.00001, c2: 0.00001, b: 100, rl: 10000, fehler: 'keiner', zielUce: 0, zielVu: 0, ansicht: 'signal' });
    const UHAT = 0.3;
    const vals = () => once('v39', () => { const s = sim('emitter', CTL()); if (!s.ok) throw new Error('Prüfstand ae39'); return { ube: lv('ube'), uhat: UHAT, ic: s.m.ic, uce: s.m.uce, ib: s.m.ib, pruhe: s.m.uce * s.m.ic, ub: CTL().ub }; });
    const specs = () => once('sp39', () => { const v = vals(); return [
      { key: 'ohne', q: 'Eine Emitterstufe hat keine Basisvorspannung: Der Ruhearbeitspunkt liegt bei U_BE = 0. An die Basis wird eine Sinusspannung mit dem Scheitelwert û = ' + f(UHAT, 1) + ' V gelegt. Was erscheint am Ausgang?', short: 'Das Verhalten ohne Basisvorspannung ist richtig beschrieben', right: 'nichts',
        options: [
          { value: 'volle', label: 'Eine verstärkte Sinusspannung, um 180° gedreht', grund: 'Ohne Vorspannung erreicht die Basis-Emitter-Spannung nur ±' + f(UHAT, 1) + ' V. Das liegt unter der Schwelle von ' + f(v.ube, 1) + ' V: Der Transistor leitet nie, es gibt keine Verstärkung.' },
          { value: 'nichts', label: 'Praktisch nichts: Der Transistor bleibt gesperrt', grund: 'Der Scheitelwert ' + f(UHAT, 1) + ' V erreicht die Schwelle von etwa ' + f(v.ube, 1) + ' V nicht. Es fließt kein Basisstrom und kein Kollektorstrom, der Ausgang bleibt bei ' + f(v.ub, 0) + ' V.' },
          { value: 'halb', label: 'Nur die negative Halbwelle, verstärkt', grund: 'Die negative Halbwelle sperrt die Basis-Emitter-Strecke erst recht. Bei û = ' + f(UHAT, 1) + ' V bleibt auch die positive Halbwelle unter der Schwelle ' + f(v.ube, 1) + ' V.' },
          { value: 'klirr', label: 'Eine stark verzerrte, aber vorhandene Sinusspannung', grund: 'Verzerrt würde die Spannung erst, wenn die positive Spitze die Schwelle von ' + f(v.ube, 1) + ' V überschreitet. Bei û = ' + f(UHAT, 1) + ' V geschieht das nicht.' }] },
      { key: 'lage', q: 'Wohin legt man den Ruhearbeitspunkt einer Verstärkerstufe für eine möglichst lineare Verstärkung?', short: 'Die Lage des Ruhearbeitspunkts ist richtig gewählt', right: 'mitte',
        options: [
          { value: 'sperr', label: 'Knapp an die Sperrgrenze, damit kaum Ruhestrom fließt', grund: 'Dort würde schon eine Halbwelle in den Sperrbereich laufen und abgeschnitten. Der Arbeitspunkt gehört in den linearen Teil der Eingangskennlinie, mit Platz nach beiden Seiten.' },
          { value: 'mitte', label: 'In den geraden Kennlinienteil, mit Platz nach beiden Seiten', grund: 'So kann das Signal nach oben und unten ausschlagen, ohne zu sperren oder in die Sättigung zu laufen. Im Prüfstand liegt U_CE = ' + f(v.uce, 1) + ' V etwa in der Mitte der Betriebsspannung von ' + f(v.ub, 0) + ' V.' },
          { value: 'sat', label: 'Nahe an die Sättigung, damit U_CE möglichst klein ist', grund: 'Dort läuft die Aussteuerung schnell in die Sättigung, die Halbwelle wird abgeflacht. Besser ist ein Arbeitspunkt mit U_CE in der Mitte der Betriebsspannung.' },
          { value: 'null', label: 'Auf U_BE = 0, denn dort ist der Ruhestrom gleich null', grund: 'Bei U_BE = 0 sperrt der Transistor, das Signal wird von der Schwelle ' + f(v.ube, 1) + ' V verschluckt. Ohne Vorspannung gibt es keine lineare Verstärkung.' }] },
      { key: 'preis', q: 'Welchen Preis hat die Basisvorspannung, die den Ruhearbeitspunkt festlegt?', short: 'Der Nachteil der Vorspannung ist richtig benannt', right: 'ruhe',
        options: [
          { value: 'ruhe', label: 'Schon ohne Signal fließt Strom und Leistung wird umgesetzt', grund: 'Im Ruhebetrieb fließen I_B = ' + f(v.ib, 1) + ' µA und I_C = ' + f(v.ic, 2) + ' mA; im Transistor werden etwa U_CE · I_C = ' + f(v.pruhe, 1) + ' mW umgesetzt, auch ohne Eingangssignal.' },
          { value: 'phase', label: 'Das Signal wird bei der Vorspannung um 90° gedreht', grund: 'Die Phase hat mit der Vorspannung nichts zu tun. Die Emitterschaltung dreht die Phase wegen der Schaltungsart um 180°; die Vorspannung legt nur den Arbeitspunkt fest.' },
          { value: 'schwelle', label: 'Die Schwellspannung der Basis-Emitter-Strecke steigt deutlich', grund: 'Die Schwelle ist eine Eigenschaft der Basis-Emitter-Strecke (etwa ' + f(v.ube, 1) + ' V bei Silizium) und bleibt gleich. Die Vorspannung verschiebt nur den Arbeitspunkt.' },
          { value: 'gleich', label: 'Es gibt keinen Nachteil, der Strom ist nur Signalstrom', grund: 'Der Ruhestrom fließt auch ohne Signal: I_C = ' + f(v.ic, 2) + ' mA, P ≈ ' + f(v.pruhe, 1) + ' mW. Das ist der Preis für den festen Arbeitspunkt.' }] }]; });
    return pick({ rig: 'emitter', ctl: CTL, specs, vals,
      text: () => 'Eine Transistorstufe soll als Verstärker arbeiten. Beantworte drei Fragen zum Ruhearbeitspunkt und zur Basisvorspannung. Im Prüfstand „' + rname('emitter') + '“ steht eine Emitterschaltung (Übungsschaltung) mit Basisspannungsteiler; dort kannst du Strom und Spannung im Ruhezustand ablesen.',
      hint: () => { const v = vals(); return [
        'Der Ruhearbeitspunkt ist der Arbeitspunkt ohne Signal. Die Basis-Emitter-Strecke leitet erst ab etwa ' + f(v.ube, 1) + ' V. Damit auch kleine Signale und beide Halbwellen verarbeitet werden, bringt man die Basis mit einer Gleichspannung (Vorspannung) in den linearen Teil der Kennlinie.',
        'Ohne Vorspannung bleibt ein Signal mit û = ' + f(v.uhat, 1) + ' V unter der Schwelle von ' + f(v.ube, 1) + ' V. Mit der Vorspannung fließen im Ruhezustand I_B = ' + f(v.ib, 1) + ' µA und I_C = ' + f(v.ic, 2) + ' mA, die Betriebsspannung wird teilweise schon im Ruhebetrieb umgesetzt.',
        'Musterlösung: Ohne Vorspannung bleibt der Transistor gesperrt (praktisch kein Ausgangssignal); der Ruhearbeitspunkt liegt im geraden Teil der Kennlinie mit Platz nach beiden Seiten; der Preis ist der Ruhestrom mit etwa ' + f(v.pruhe, 1) + ' mW Ruheleistung.'
      ]; } });
  })();

  /* ====================================================================== ae40: Integrierte Schaltkreise (Lernfeld 9.1, Vorteile monolithischer Schaltungen) */ /* PRUEFEN P8: nur der Teil "integrierte Schaltungen allgemein" aus Lernfeld 9.1; TTL, Lastfaktoren und Pegel gehören in das Digitaltechnik-Lab */
  const M40 = (() => {
    const CTL = () => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: 0.5, r1: 4700, rf: 47000 });
    const DT = 40;
    const dd = t => once('d40|' + t, () => { const s = sim('diode', { typ: 'si', modell: 'kennlinie', uq: 5, rv: 220, temp: t, fehler: 'keiner', ziel: 0 }); if (!s.ok) throw new Error('Prüfstand ae40'); return s.m; });
    const vals = () => once('v40', () => { const a = dd(27), b = dd(27 + 60), k = (a.ud - b.ud) * 1e3 / 60; return { kmv: k, dt: DT, dub: k * DT, dub2: 2 * k * DT, rest: 0 }; });
    const specs = () => once('sp40', () => { const v = vals(); return [
      { key: 'monolith', q: 'Was bedeutet „monolithisch integrierte Schaltung“?', short: 'Der Begriff monolithisch integriert ist richtig erklärt', right: 'chip',
        options: [
          { value: 'gehaeuse', label: 'Einzelne Bauteile stecken fertig in einem gemeinsamen Gehäuse', grund: 'Das beschreibt eine Hybridschaltung. Bei der monolithischen Schaltung entstehen alle Elemente gemeinsam im selben Fertigungsprozess auf einem Plättchen, nicht einzeln.' },
          { value: 'chip', label: 'Alle Elemente entstehen gemeinsam auf einem Siliziumplättchen', grund: 'Transistoren, Dioden und Widerstände werden zusammen auf einem Siliziumplättchen (Chip) hergestellt und intern verbunden: eine vollständige Funktionseinheit.' },
          { value: 'platine', label: 'Alle Bauteile sitzen besonders eng gepackt auf einer Leiterplatte', grund: 'Auf einer Leiterplatte stehen weiterhin einzelne Bauteile mit Lötstellen und Leitungen. Bei der integrierten Schaltung gehört das alles in den Chip.' },
          { value: 'groesse', label: 'Der Chip ist besonders groß und sehr leistungsstark', grund: 'Die Größe ist nicht gemeint. Monolithisch heißt: alles aus einem Stück, hergestellt im gemeinsamen Prozess auf einem Siliziumplättchen.' }] },
      { key: 'streuung', q: 'Zwei Transistoren auf demselben Chip haben deutlich ähnlichere Kennwerte als zwei einzeln gekaufte Transistoren. Warum?', short: 'Der Grund für die kleine Streuung auf dem Chip ist richtig benannt', right: 'prozess',
        options: [
          { value: 'prozess', label: 'Gleicher Prozess und gleiche Temperatur gleichen Abweichungen aus', grund: 'Beide entstehen im selben Prozess, auf engstem Raum und bei gleicher Temperatur. Herstellungsbedingte Abweichungen heben sich zum Teil auf, die Kennwerte streuen weniger.' },
          { value: 'sortiert', label: 'Jeder Chip wird von Hand ausgesucht und paarweise sortiert', grund: 'Aussortiert wird nicht von Hand. Der Grund liegt im gemeinsamen Prozess und in der gemeinsamen Temperatur der Elemente auf dem Chip.' },
          { value: 'gross', label: 'Auf dem Chip sind die Transistoren größer und deshalb genauer', grund: 'Größer sind sie nicht, meist sind sie winzig. Genauer passen sie zusammen, weil sie im selben Prozess und bei gleicher Temperatur entstehen.' },
          { value: 'kuehl', label: 'Das Gehäuse kühlt alle Transistoren gleichmäßig auf null Grad', grund: 'Der Chip wird nicht auf null Grad gekühlt. Wichtig ist, dass alle Elemente dieselbe Temperatur haben, sodass sich temperaturbedingte Änderungen gleichsinnig auswirken.' }] },
      { key: 'temperatur', q: 'Die beiden Eingangstransistoren eines Differenzverstärkers auf einem Chip erwärmen sich um ' + f(DT, 0) + ' K. U_BE sinkt dabei je Transistor um etwa ' + f(v.kmv, 1) + ' mV/K, also um etwa ' + f(v.dub, 0) + ' mV (Wert aus dem Prüfstand). Was bleibt als Unterschied zwischen den beiden Eingängen?', short: 'Die Wirkung gleicher Temperaturänderung ist richtig beurteilt', right: 'klein',
        options: [
          { value: 'doppelt', label: 'Etwa ' + f(v.dub2, 0) + ' mV, weil sich beide Änderungen addieren', grund: 'Die Änderungen addieren sich nicht, sie wirken gleichsinnig. Der Differenzverstärker wertet die Differenz der Eingangsspannungen aus; sie bleibt nahezu null.' },
          { value: 'klein', label: 'Nahezu nichts, weil beide gleich driften', grund: 'Beide U_BE sinken um etwa ' + f(v.dub, 0) + ' mV. Die Differenz bleibt nahezu null, der Differenzverstärker unterdrückt diese gemeinsame Änderung: temperaturbedingte Änderungen wirken teilweise gegeneinander.' },
          { value: 'einer', label: 'Etwa ' + f(v.dub, 0) + ' mV, so groß wie bei einem Transistor', grund: 'Das gälte nur, wenn sich ein einziger Transistor erwärmt. Hier erwärmen sich beide gleich stark; die Differenz bleibt nahezu null.' },
          { value: 'steigt', label: 'Die Differenz wächst mit der Temperatur stetig an', grund: 'Weil beide Transistoren gleich warm werden und gleich driften, wächst die Differenz nicht, sie bleibt nahezu null.' }] },
      { key: 'zuverl', q: 'Warum sind integrierte Schaltungen im Allgemeinen zuverlässiger als dieselbe Schaltung aus einzelnen Bauteilen?', short: 'Der Grund für die höhere Zuverlässigkeit ist richtig benannt', right: 'loet',
        options: [
          { value: 'material', label: 'Der Chip besteht aus einem besonders harten Spezialmaterial', grund: 'Nicht das Material ist entscheidend. Die Zuverlässigkeit steigt, weil Lötstellen und Leitungsverbindungen zwischen den Elementen entfallen.' },
          { value: 'groesser', label: 'Der Chip verträgt meist höhere Spannungen als einzelne Bauteile', grund: 'Das stimmt im Allgemeinen nicht. Der Vorteil ist, dass viele fehleranfällige Verbindungen (Lötstellen, Leitungen) im Chip entfallen und die internen Leitungen sehr kurz sind.' },
          { value: 'loet', label: 'Lötstellen und Leitungen als Ausfallursache entfallen weitgehend', grund: 'Lötstellen und Leitungsverbindungen sind eine häufige Ausfallursache elektronischer Geräte. Im Chip sind sie intern und kurz; das erhöht die Zuverlässigkeit und verringert eingestreute Störungen.' },
          { value: 'wechsel', label: 'Der Chip lässt sich im Fehlerfall besonders leicht nachlöten', grund: 'Nachlöten lässt sich ein Chip-Innenleben nicht. Der Vorteil liegt im Gegenteil darin, dass die fehleranfälligen Verbindungen gar nicht erst nötig sind.' }] }]; });
    return pick({ rig: 'opv_inv', ctl: CTL, specs, vals,
      text: () => 'Ein Operationsverstärker ist ein integrierter Schaltkreis. Beantworte vier Fragen zu den Eigenschaften und Vorteilen integrierter Schaltungen. Im Prüfstand „' + rname('opv_inv') + '“ steht ein Verstärker mit einem solchen Baustein (Übungsschaltung); die dritte Frage nutzt den Temperaturgang einer Siliziumdiode aus dem Prüfstand „' + rname('diode') + '“.',
      hint: () => { const v = vals(); return [
        'Monolithisch heißt: Alle Elemente entstehen gemeinsam auf einem Siliziumplättchen. Daraus folgen Vorteile: kurze Verbindungen, keine Lötstellen zwischen den Elementen, geringe Streuung und gleiche Temperatur aller Elemente.',
        'Bei gleicher Temperatur driften gleichartige Transistoren gleich: Eine Erwärmung um ' + f(v.dt, 0) + ' K verschiebt beide U_BE um etwa ' + f(v.dub, 0) + ' mV. Ein Differenzverstärker bildet die Differenz, die Wirkung hebt sich auf.',
        'Musterlösung: gemeinsamer Fertigungsprozess auf einem Siliziumplättchen; kleine Streuung durch gleichen Prozess und gleiche Temperatur; die gemeinsame Drift von etwa ' + f(v.dub, 0) + ' mV hebt sich in der Differenz nahezu auf; weniger Lötstellen und Leitungen, deshalb höhere Zuverlässigkeit.'
      ]; } });
  })();

  /* ====================================================================== ae41 bis ae50: Anbindung an den Berufsschulstoff, zweiter Teil (Operationsverstaerker-Schaltungen, Basisvorwiderstand, R-2R-Umsetzer, Diodenschaltungen)
   * Eigene Zahlen (Uebungswerte), unabhaengig nachgerechnet in quelle/analab/test_schule.js; Pruefstaende nur zum Nachstellen, die Rechnung steht in vals().
   * Auswahlfragen: Fachgrund je Antwort, richtige Antwort nicht systematisch die laengste, Position gestreut. */

  /* ====================================================================== ae41: Virtueller Kurzschluss am realen Operationsverstaerker (Lernfeld 9.1, Kennwerte des realen OPV) */ /* PRUEFEN P10: V_0 = 200000 und r_D = 2 MΩ sind Übungswerte, nicht die Werte eines bestimmten Typs */
  const M41 = (() => {
    const G = { v0: 200000, rd: 2e6, r1: 10000, rf: 100000, ua: -6 };
    const CTL = () => ({ schaltung: 'real', opv: 'langsam', uv: 12, form: 'sinus', ue: 1, f: 5000, r1: 10000, rf: 100000, c: 1e-6 });
    const vals = () => once('v41', () => { const ud = Math.abs(G.ua) / G.v0, id = ud / G.rd, ue = -G.ua * G.r1 / G.rf, i1 = (ue - ud) / G.r1;
      return { v0: G.v0, rd: G.rd / 1e6, r1: G.r1 / 1e3, rf: G.rf / 1e3, ua: Math.abs(G.ua), ue, udMikro: ud * 1e6, idPiko: id * 1e12, i1Mikro: i1 * 1e6, anteil: ud / ue * 100, verh: Math.round(i1 / id / 1e6), udMal: Math.abs(G.ua) * G.v0, idFalsch: Math.abs(G.ua) / G.rd * 1e6 }; });
    const rUd = () => once('r41a', () => { const v = vals(); return own(v.udMikro * 1e-6, 'V', [{ v: v.udMal, id: 'mal', text: 'Du hast U_a · V_0 gerechnet. Der Verstärker vergrößert die Differenzspannung: U_a = V_0 · U_D, also U_D = |U_a| / V_0.' }, { v: Math.abs(G.ua), id: 'ua', text: 'Das ist die Ausgangsspannung selbst. Zwischen den Eingängen liegt nur der V_0-te Teil davon: U_D = |U_a| / V_0.' }], { factor: 1e-6, dispUnit: 'µV', disp: v.udMikro }); });
    const rId = () => once('r41b', () => { const v = vals(); return own(v.idPiko * 1e-12, 'A', [{ v: v.idFalsch * 1e-6, id: 'ua', text: 'Du hast die Ausgangsspannung durch r_D geteilt. Am Eingangswiderstand liegt nur die Differenzspannung U_D, daher I_D = U_D / r_D.' }], { factor: 1e-12, dispUnit: 'pA', disp: v.idPiko }); });
    const rI1 = () => once('r41c', () => { const v = vals(); return own(v.i1Mikro * 1e-6, 'A', [{ v: v.ua / (G.r1), id: 'ua', text: 'Du hast U_a durch R_1 geteilt. An R_1 liegt die Eingangsspannung (bis auf die winzige Differenzspannung), der Strom ist I_1 = U_e / R_1.' }], { factor: 1e-6, dispUnit: 'µA', disp: v.i1Mikro }); });
    const specs = () => once('sp41', () => { const v = vals(); return [
      { key: 'vk', q: 'Warum darf man beim Rechnen mit dem idealen Verstärker U_D = 0 setzen (virtueller Kurzschluss)?', short: 'Der Grund für den virtuellen Kurzschluss ist richtig benannt', right: 'klein',
        options: [
          { value: 'kurz', label: 'Die beiden Eingänge sind im Inneren leitend verbunden', grund: 'Die Eingänge sind nicht verbunden, zwischen ihnen liegt der große Widerstand r_D = ' + f(v.rd, 0) + ' MΩ. Die Spannung ist nur so klein (' + f(v.udMikro, 0) + ' µV), dass man sie vernachlässigt.' },
          { value: 'klein', label: 'U_D ist winzig gegen U_e und wird vernachlässigt', grund: 'U_D = ' + f(v.udMikro, 0) + ' µV ist nur ' + f(v.anteil, 3) + ' % von U_e = ' + f(v.ue, 1) + ' V. Wegen der großen Leerlaufverstärkung reicht diese winzige Spannung, um den Ausgang auf ' + f(v.ua, 0) + ' V zu treiben.' },
          { value: 'masse', label: 'Der invertierende Eingang ist fest mit Masse verbunden', grund: 'Mit Masse verbunden ist nur der nicht invertierende Eingang. Der invertierende Eingang liegt über R_1 und R_f an Ein- und Ausgang; er ist nur virtuell auf 0 V, weil U_D so klein ist.' },
          { value: 'strom', label: 'Durch R_1 fließt kein Strom, deshalb gibt es keine Spannung', grund: 'Durch R_1 fließt sehr wohl Strom: I_1 = ' + f(v.i1Mikro, 1) + ' µA. In den Eingang des Verstärkers fließt dagegen fast nichts (' + f(v.idPiko, 0) + ' pA).' }] },
      { key: 'rf', q: 'Welcher Strom fließt durch den Rückkopplungswiderstand R_f?', short: 'Der Strom durch R_f ist richtig beurteilt', right: 'gleich',
        options: [
          { value: 'halb', label: 'Die Hälfte von I_1, der Rest fließt in den Eingang', grund: 'In den Eingang fließen nur ' + f(v.idPiko, 0) + ' pA. Das ist rund ' + f(v.verh, 0) + ' Millionen-mal weniger als I_1 = ' + f(v.i1Mikro, 1) + ' µA; fast der ganze Strom fließt über R_f weiter.' },
          { value: 'null', label: 'Gar keiner, der ganze Strom geht in den Eingang', grund: 'Der Eingang ist sehr hochohmig (r_D = ' + f(v.rd, 0) + ' MΩ) und nimmt nur ' + f(v.idPiko, 0) + ' pA auf. Der Strom I_1 muss über R_f zum Ausgang weiter.' },
          { value: 'gleich', label: 'Praktisch derselbe Strom wie durch R_1', grund: 'Der Eingangsstrom I_D = ' + f(v.idPiko, 0) + ' pA ist gegen I_1 = ' + f(v.i1Mikro, 1) + ' µA vernachlässigbar. Deshalb gilt I_f = I_1 und daraus V_u = −R_f / R_1.' },
          { value: 'doppelt', label: 'Den doppelten Strom von R_1, wegen der Verstärkung', grund: 'Ströme werden am Knoten nicht vervielfacht: Was über R_1 ankommt, fließt über R_f ab (bis auf ' + f(v.idPiko, 0) + ' pA in den Eingang).' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ud'), rUd(), 'Die Differenzspannung U_D ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'id'), rId(), 'Der Eingangsstrom I_D ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'i1'), rI1(), 'Der Strom I_1 durch R_1 ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein realer Operationsverstärker hat die Leerlaufverstärkung V_0 = ' + f(G.v0, 0) + ' und zwischen seinen Eingängen den Widerstand r_D = ' + eng(G.rd, 'Ω') + ' (Übungswerte). Er arbeitet als Invertierer mit R_1 = ' + eng(G.r1, 'Ω') + ' und R_f = ' + eng(G.rf, 'Ω') + ' und liefert U_a = −' + f(Math.abs(G.ua), 0) + ' V. Berechne die Differenzspannung U_D zwischen den Eingängen, den Strom I_D in den Eingang und den Strom I_1 durch R_1. Beantworte dann zwei Fragen zum virtuellen Kurzschluss. Im Prüfstand „' + rname('opv_aktiv') + '“ (Schaltung „Realer Operationsverstärker“) kannst du den realen Baustein untersuchen.',
      fields: () => [{ key: 'ud', label: 'Differenzspannung U_D (Betrag)', unit: 'µV' }, { key: 'id', label: 'Eingangsstrom I_D', unit: 'pA' }, { key: 'i1', label: 'Strom I_1 durch R_1', unit: 'µA' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Verstärker vergrößert die Spannung zwischen seinen Eingängen um V_0: U_a = V_0 · U_D. Der Strom in den Eingang folgt aus dem Ohmschen Gesetz mit r_D. Die Eingangsspannung des Invertierers ist U_e = |U_a| · R_1 / R_f.',
        'U_D = ' + f(v.ua, 0) + ' V / ' + f(v.v0, 0) + ', in µV umrechnen. I_D = U_D / ' + f(v.rd, 0) + ' MΩ. U_e = ' + f(v.ua, 0) + ' V · ' + f(v.r1, 0) + ' kΩ / ' + f(v.rf, 0) + ' kΩ = ' + f(v.ue, 1) + ' V, und I_1 ≈ U_e / R_1.',
        'Musterlösung: U_D = ' + f(v.udMikro, 0) + ' µV, I_D = ' + f(v.idPiko, 0) + ' pA, I_1 = ' + f(v.i1Mikro, 1) + ' µA. U_D ist nur ' + f(v.anteil, 3) + ' % von U_e, der Eingangsstrom etwa ' + f(v.verh, 0) + ' Millionen-mal kleiner als I_1: Deshalb rechnet man mit U_D = 0 und I_f = I_1.'
      ]; },
      start: () => A('opv_aktiv', CTL(), { fields: { ud: null, id: null, i1: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_aktiv', CTL(), { fields: { ud: v.udMikro, id: v.idPiko, i1: v.i1Mikro }, choices: rightOf(specs()), value: v.udMikro }); },
      wrong: () => { const v = vals(); return [
        { name: 'U_a mal V_0 und U_a durch r_D gerechnet, Eingänge verbunden', answer: A('opv_aktiv', {}, { fields: { ud: v.udMal * 1e6, id: v.idFalsch * 1e6, i1: v.i1Mikro }, choices: { vk: 'kurz', rf: 'null' } }) },
        { name: 'Ausgangsspannung als U_D, I_1 aus U_a, Strom halbiert', answer: A('opv_aktiv', {}, { fields: { ud: v.ua * 1e6, id: v.idPiko, i1: v.ua / G.r1 * 1e6 }, choices: { vk: 'strom', rf: 'halb' } }) }]; } };
  })();

  /* ====================================================================== ae42: Invertierer aus Eingangsstrom und Ausgangsspannung auslegen (Lernfeld 9.1, Grundschaltungen) */
  const M42 = (() => {
    const G = { ue: 3, i: 0.0002, ua: -9 };
    const CTL = () => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: 0.5, r1: 4700, rf: 47000 });
    const vals = () => once('v42', () => { const r1 = G.ue / G.i, vu = G.ua / G.ue, rf = Math.abs(vu) * r1; return { ue: G.ue, i: G.i * 1e3, ua: Math.abs(G.ua), r1: r1 / 1e3, vu, vb: Math.abs(vu), rf: rf / 1e3, rfNin: (Math.abs(vu) + 1) * r1 / 1e3, r1Ua: Math.abs(G.ua) / G.i / 1e3 }; });
    const rR1 = () => once('r42a', () => { const v = vals(); return own(v.r1 * 1e3, 'Ω', [{ v: v.r1Ua * 1e3, id: 'ua', text: 'Du hast U_a / I gerechnet. Der Strom fließt vom Eingang über R_1 zum invertierenden Eingang (virtuelle Masse, 0 V): An R_1 liegt U_e, also R_1 = U_e / I.' }], { factor: 1e3, dispUnit: 'kΩ', disp: v.r1 }); });
    const rVu = () => once('r42b', () => { const v = vals(); return own(v.vu, '', [{ v: -v.vu, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der Invertierer dreht die Spannung um, U_a ist negativ bei positivem U_e. V_u = U_a / U_e ist negativ.' }, { v: 1 / v.vu, id: 'kehr', text: 'Dein Wert ist der Kehrwert: V_u = U_a / U_e, Ausgang durch Eingang.' }]); });
    const rRf = () => once('r42c', () => { const v = vals(); return own(v.rf * 1e3, 'Ω', [{ v: v.rfNin * 1e3, id: 'nin', text: 'Du hast (|V_u| + 1) · R_1 gerechnet. Das ist die Formel des Nichtinvertierers; beim Invertierer gilt R_f = |V_u| · R_1.' }, { v: v.r1 * 1e3, id: 'r1', text: 'Dein Wert ist R_1. Der Strom I fließt auch durch R_f, an R_f liegt aber die Ausgangsspannung: R_f = |U_a| / I.' }], { factor: 1e3, dispUnit: 'kΩ', disp: v.rf }); });
    const specs = () => once('sp42', () => { const v = vals(); return [
      { key: 'knoten', q: 'Welche Spannung misst du am invertierenden Eingang gegen Masse?', short: 'Die Spannung am invertierenden Eingang ist richtig bestimmt', right: 'null',
        options: [
          { value: 'ue', label: 'Die Eingangsspannung, ' + f(v.ue, 0) + ' V', grund: 'Die Eingangsspannung liegt am linken Ende von R_1. Über R_1 fällt sie ganz ab, am invertierenden Eingang bleiben (fast) 0 V übrig.' },
          { value: 'mitte', label: 'Die Mitte aus U_e und U_a, ' + fs((v.ue - v.ua) / 2, 0) + ' V', grund: 'Die Mitte entstünde bei R_1 = R_f. Hier regelt der Verstärker den Knoten auf 0 V: An R_1 liegen ' + f(v.ue, 0) + ' V, an R_f liegen ' + f(v.ua, 0) + ' V.' },
          { value: 'null', label: 'Etwa 0 V, virtuelle Masse', grund: 'Der nicht invertierende Eingang liegt an Masse, und der Verstärker hält die Differenz zwischen den Eingängen nahe null. Am invertierenden Eingang stehen also etwa 0 V (virtuelle Masse).' },
          { value: 'ua', label: 'Die Ausgangsspannung, −' + f(v.ua, 0) + ' V', grund: 'Die Ausgangsspannung liegt am rechten Ende von R_f und fällt über R_f ganz ab. Der Knoten dazwischen bleibt auf etwa 0 V.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'r1'), rR1(), 'Der Eingangswiderstand R_1 ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'vu'), rVu(), 'Die Verstärkung V_u ist richtig berechnet (mit Vorzeichen)', 1);
      numRow(r, rawOf(a, 'rf'), rRf(), 'Der Rückkopplungswiderstand R_f ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein invertierender Verstärker mit idealem Operationsverstärker soll aus U_e = ' + f(G.ue, 0) + ' V die Ausgangsspannung U_a = −' + f(Math.abs(G.ua), 0) + ' V machen. Die Signalquelle darf dabei nur mit I = ' + f(G.i * 1e3, 1) + ' mA belastet werden (Übungswerte). Berechne R_1, die Verstärkung V_u und R_f. Im Prüfstand „' + rname('opv_inv') + '“ kannst du deine Werte einstellen und U_a ablesen.',
      fields: () => [{ key: 'r1', label: 'Eingangswiderstand R_1', unit: 'kΩ' }, { key: 'vu', label: 'Verstärkung V_u', unit: '' }, { key: 'rf', label: 'Rückkopplungswiderstand R_f', unit: 'kΩ' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der invertierende Eingang ist eine virtuelle Masse. Der Strom aus der Quelle fließt durch R_1 und weiter durch R_f zum Ausgang. An R_1 liegt U_e, an R_f liegt U_a. Die Verstärkung ist V_u = U_a / U_e = −R_f / R_1.',
        'R_1 = ' + f(v.ue, 0) + ' V / ' + f(v.i, 1) + ' mA. V_u = −' + f(v.ua, 0) + ' V / ' + f(v.ue, 0) + ' V. Für R_f nimmst du |V_u| · R_1 oder gleich |U_a| / I.',
        'Musterlösung: R_1 = ' + f(v.r1, 0) + ' kΩ, V_u = ' + fs(v.vu, 0) + ', R_f = ' + f(v.vb, 0) + ' · ' + f(v.r1, 0) + ' kΩ = ' + f(v.rf, 0) + ' kΩ. Der invertierende Eingang bleibt auf etwa 0 V.'
      ]; },
      start: () => A('opv_inv', CTL(), { fields: { r1: null, vu: null, rf: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_inv', Object.assign(CTL(), { ue: G.ue, r1: v.r1 * 1e3, rf: v.rf * 1e3 }), { fields: { r1: v.r1, vu: v.vu, rf: v.rf }, choices: rightOf(specs()), value: v.rf }); },
      wrong: () => { const v = vals(); return [
        { name: 'U_a durch I für R_1, Formel des Nichtinvertierers', answer: A('opv_inv', {}, { fields: { r1: v.r1Ua, vu: v.vu, rf: v.rfNin }, choices: { knoten: 'ue' } }) },
        { name: 'Vorzeichen vergessen, R_f gleich R_1, Knoten am Ausgang', answer: A('opv_inv', {}, { fields: { r1: v.r1, vu: -v.vu, rf: v.r1 }, choices: { knoten: 'ua' } }) }]; } };
  })();

  /* ====================================================================== ae43: Nichtinvertierer, Eingangsspannung aus dem Ausgang (Lernfeld 9.1, Grundschaltungen; Scheitel- und Effektivwert) */
  const M43 = (() => {
    const G = { rg: 12000, rf: 220000, uahat: 5.8 };
    const CTL = () => ({ schaltung: 'nichtinvertierend', opv: 'ideal', form: 'gleich', ue: 0.3, rg: G.rg, rf: G.rf });
    const vals = () => once('v43', () => { const vu = 1 + G.rf / G.rg, uehat = G.uahat / vu, ueeff = uehat / Math.SQRT2, vfalsch = G.rf / G.rg;
      return { rg: G.rg / 1e3, rf: G.rf / 1e3, uahat: G.uahat, vu, quot: vfalsch, uehat: uehat * 1e3, ueeff: ueeff * 1e3, uehatFalsch: G.uahat / vfalsch * 1e3, ueeffMal: uehat * Math.SQRT2 * 1e3, uaeff: G.uahat / Math.SQRT2 }; });
    const rVu = () => once('r43a', () => { const v = vals(); return own(v.vu, '', [{ v: v.quot, id: 'quot', text: 'Dein Wert ist R_f / R_g. Beim Nichtinvertierer kommt die Eins dazu: V_u = 1 + R_f / R_g, weil die Eingangsspannung selbst am Ausgang mit erscheint.' }, { v: -v.vu, id: 'vorzeichen', text: 'Der Nichtinvertierer dreht die Spannung nicht um, V_u ist positiv.' }]); });
    const rHat = () => once('r43b', () => { const v = vals(); return own(v.uehat * 1e-3, 'V', [{ v: v.uehatFalsch * 1e-3, id: 'quot', text: 'Du hast mit V_u = R_f / R_g gerechnet. Mit V_u = 1 + R_f / R_g wird die Eingangsspannung etwas kleiner.' }, { v: G.uahat * v.vu, id: 'mal', text: 'Du hast mit V_u multipliziert. Der Eingang ist kleiner als der Ausgang: û_e = û_a / V_u.' }], { factor: 1e-3, dispUnit: 'mV', disp: v.uehat }); });
    const rEff = () => once('r43c', () => { const v = vals(); return own(v.ueeff * 1e-3, 'V', [{ v: v.ueeffMal * 1e-3, id: 'mal', text: 'Du hast den Scheitelwert mit √2 multipliziert. Der Effektivwert einer Sinusspannung ist kleiner als der Scheitelwert: U_eff = û / √2.' }, { v: v.uehat * 1e-3, id: 'hat', text: 'Das ist der Scheitelwert. Gefragt ist der Effektivwert: U_eff = û / √2.' }], { factor: 1e-3, dispUnit: 'mV', disp: v.ueeff }); });
    const specs = () => once('sp43', () => { const v = vals(); return [
      { key: 'phase', q: 'Wie liegen Eingangs- und Ausgangsspannung des Nichtinvertierers zueinander (Sinus)?', short: 'Die Phasenlage ist richtig bestimmt', right: 'gleich',
        options: [
          { value: 'gegen', label: 'Um 180° gegeneinander verschoben', grund: 'Um 180° dreht der invertierende Verstärker. Beim Nichtinvertierer liegt das Signal am nicht invertierenden Eingang, Ein- und Ausgang sind gleichphasig.' },
          { value: 'vor', label: 'Ausgang eilt um 90° voraus', grund: 'Eine Verschiebung um 90° gäbe es nur mit einem Kondensator (Integrierer, Differenzierer). Der Verstärker aus zwei Widerständen ist gleichphasig.' },
          { value: 'gleich', label: 'Gleichphasig, ohne Verschiebung', grund: 'Das Signal liegt am nicht invertierenden Eingang: Steigt U_e, steigt U_a. Die Spannungen sind gleichphasig, nur um V_u = ' + f(v.vu, 2) + ' größer.' },
          { value: 'nach', label: 'Ausgang eilt um 90° nach', grund: 'Ohne Kondensator gibt es keine 90°-Verschiebung. Der Nichtinvertierer liefert ein gleichphasiges, um V_u = ' + f(v.vu, 2) + ' vergrößertes Signal.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'vu'), rVu(), 'Die Verstärkung V_u ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'uehat'), rHat(), 'Der Scheitelwert û_e der Eingangsspannung ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'ueeff'), rEff(), 'Der Effektivwert U_e der Eingangsspannung ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Ein nichtinvertierender Verstärker mit idealem Operationsverstärker hat R_f = ' + eng(G.rf, 'Ω') + ' und R_g = ' + eng(G.rg, 'Ω') + ' (Übungsschaltung). Am Ausgang misst du eine Sinusspannung mit dem Scheitelwert û_a = ' + f(G.uahat, 1) + ' V. Berechne die Verstärkung V_u, den Scheitelwert û_e und den Effektivwert U_e der Eingangsspannung. Im Prüfstand „' + rname('opv_nin') + '“ kannst du die Stufe nachstellen.',
      fields: () => [{ key: 'vu', label: 'Verstärkung V_u', unit: '' }, { key: 'uehat', label: 'Scheitelwert û_e', unit: 'mV' }, { key: 'ueeff', label: 'Effektivwert U_e', unit: 'mV' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Beim Nichtinvertierer ist V_u = 1 + R_f / R_g. Die Eingangsspannung ist der V_u-te Teil der Ausgangsspannung. Bei einer Sinusspannung gilt zwischen Scheitelwert und Effektivwert U_eff = û / √2.',
        'V_u = 1 + ' + f(v.rf, 0) + ' kΩ / ' + f(v.rg, 0) + ' kΩ. Dann û_e = ' + f(v.uahat, 1) + ' V / V_u, in mV umrechnen, und daraus U_e = û_e / √2.',
        'Musterlösung: V_u = ' + f(v.vu, 2) + ', û_e = ' + f(v.uehat, 0) + ' mV, U_e = ' + f(v.ueeff, 1) + ' mV. Ein- und Ausgang sind gleichphasig. Mit R_f / R_g allein (' + f(v.quot, 2) + ') kämen ' + f(v.uehatFalsch, 1) + ' mV heraus.'
      ]; },
      start: () => A('opv_nin', CTL(), { fields: { vu: null, uehat: null, ueeff: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_nin', CTL(), { fields: { vu: v.vu, uehat: v.uehat, ueeff: v.ueeff }, choices: rightOf(specs()), value: v.uehat }); },
      wrong: () => { const v = vals(); return [
        { name: 'R_f / R_g ohne die Eins, Phase 180°', answer: A('opv_nin', {}, { fields: { vu: v.quot, uehat: v.uehatFalsch, ueeff: v.uehatFalsch / Math.SQRT2 }, choices: { phase: 'gegen' } }) },
        { name: 'Scheitelwert mal √2 als Effektivwert, 90° Verschiebung', answer: A('opv_nin', {}, { fields: { vu: v.vu, uehat: v.uehat, ueeff: v.ueeffMal }, choices: { phase: 'vor' } }) }]; } };
  })();

  /* ====================================================================== ae44: Summierer mit Gewichtung entwerfen (Lernfeld 9.1, Addierer) */ /* PRUEFEN P11: drei Eingänge mit den Gewichten 0,2 / 0,5 / 1; der Prüfstand hat nur zwei Eingänge, die dritte Spannung wird von Hand ergänzt */
  const M44 = (() => {
    const G = { rf: 30000, k: [0.2, 0.5, 1], u: [2, -1, 0.5] };
    const CTL = () => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: 0.5, r1: 4700, rf: 47000 });
    const vals = () => once('v44', () => { const r = G.k.map(k => G.rf / k), ua = -G.k.reduce((s, k, i) => s + k * G.u[i], 0);
      return { rf: G.rf / 1e3, k1: G.k[0], k2: G.k[1], k3: G.k[2], r1: r[0] / 1e3, r2: r[1] / 1e3, r3: r[2] / 1e3, u1: G.u[0], u2: G.u[1], u3: G.u[2], ua, uab: Math.abs(ua), t1: G.k[0] * G.u[0], t2: G.k[1] * G.u[1], t3: G.k[2] * G.u[2], r1mal: G.rf * G.k[0] / 1e3, r2mal: G.rf * G.k[1] / 1e3, uaPlus: -ua }; });
    const rR = (i, key) => () => once('r44' + i, () => { const v = vals(); return own(v['r' + i] * 1e3, 'Ω', [{ v: v.rf * 1e3 * v['k' + i], id: 'mal', text: 'Du hast R_f · k gerechnet. Je kleiner das Gewicht, desto größer muss der Eingangswiderstand sein: R = R_f / k.' }], { factor: 1e3, dispUnit: 'kΩ', disp: v['r' + i] }); });
    const rR1 = rR(1), rR2 = rR(2), rR3 = rR(3);
    const rUa = () => once('r44u', () => { const v = vals(); return own(v.ua, 'V', [{ v: v.uaPlus, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der Summierer ist ein invertierender Verstärker, U_a = −(0,2 · U_1 + 0,5 · U_2 + U_3).' }, { v: -(G.u[0] + G.u[1] + G.u[2]), id: 'ohne', text: 'Du hast die Spannungen ohne Gewichte addiert. Jede Eingangsspannung zählt mit ihrem Gewicht R_f / R.' }]); });
    const specs = () => once('sp44', () => { const v = vals(); return [
      { key: 'entkoppelt', q: 'Warum beeinflussen sich die drei Eingangsspannungen gegenseitig nicht?', short: 'Der Grund für die Entkopplung der Eingänge ist richtig benannt', right: 'masse',
        options: [
          { value: 'gleich', label: 'Weil alle Eingangswiderstände gleich groß sind', grund: 'Die Widerstände sind hier verschieden (' + f(v.r1, 0) + ' kΩ, ' + f(v.r2, 0) + ' kΩ, ' + f(v.r3, 0) + ' kΩ). Die Entkopplung kommt vom Summenpunkt, der auf 0 V gehalten wird.' },
          { value: 'rf', label: 'Weil R_f die Eingänge voneinander abtrennt', grund: 'R_f liegt zwischen Summenpunkt und Ausgang und trennt die Eingänge nicht. Jeder Eingangsstrom hängt nur von seiner Spannung und seinem Widerstand ab, weil der Summenpunkt auf 0 V liegt.' },
          { value: 'quelle', label: 'Weil jede Quelle eine eigene Masse besitzt', grund: 'Alle Quellen haben dieselbe Masse. Entscheidend ist, dass der Summenpunkt virtuell auf 0 V liegt: Jeder Strom ist U / R, egal was an den anderen Eingängen anliegt.' },
          { value: 'masse', label: 'Weil der Summenpunkt virtuell auf 0 V liegt', grund: 'Der Verstärker hält den Summenpunkt auf 0 V. Jeder Eingang treibt deshalb den Strom U / R, unabhängig von den anderen; über R_f werden die Ströme addiert.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'r1'), rR1(), 'Der Widerstand R_1 für das Gewicht ' + f(G.k[0], 1) + ' ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'r2'), rR2(), 'Der Widerstand R_2 für das Gewicht ' + f(G.k[1], 1) + ' ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'r3'), rR3(), 'Der Widerstand R_3 für das Gewicht ' + f(G.k[2], 0) + ' ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'ua'), rUa(), 'Die Ausgangsspannung U_a für die Probe ist richtig berechnet (mit Vorzeichen)', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Entwirf einen Summierer mit idealem Operationsverstärker und drei Eingängen, der U_a = −(' + f(G.k[0], 1) + ' · U_1 + ' + f(G.k[1], 1) + ' · U_2 + U_3) liefert. Der Rückkopplungswiderstand ist R_f = ' + eng(G.rf, 'Ω') + ' (Übungswert). Berechne die drei Eingangswiderstände R_1, R_2 und R_3. Mache dann die Probe für U_1 = ' + f(G.u[0], 0) + ' V, U_2 = −' + f(Math.abs(G.u[1]), 0) + ' V und U_3 = ' + f(G.u[2], 1) + ' V. Im Prüfstand „' + rname('opv_inv') + '“ (Schaltung Summierer, zwei Eingänge) kannst du die Gewichtung für zwei Eingänge nachprüfen.',
      fields: () => [{ key: 'r1', label: 'Eingangswiderstand R_1', unit: 'kΩ' }, { key: 'r2', label: 'Eingangswiderstand R_2', unit: 'kΩ' }, { key: 'r3', label: 'Eingangswiderstand R_3', unit: 'kΩ' }, { key: 'ua', label: 'Ausgangsspannung U_a (Probe)', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Beim Summierer gilt U_a = −R_f · (U_1 / R_1 + U_2 / R_2 + U_3 / R_3). Jeder Eingang hat also das Gewicht R_f / R. Für ein gewünschtes Gewicht k ist R = R_f / k.',
        'R_1 = ' + f(v.rf, 0) + ' kΩ / ' + f(v.k1, 1) + ', R_2 = ' + f(v.rf, 0) + ' kΩ / ' + f(v.k2, 1) + ', R_3 = ' + f(v.rf, 0) + ' kΩ / 1. Für die Probe: ' + f(v.k1, 1) + ' · ' + f(v.u1, 0) + ' V = ' + f(v.t1, 1) + ' V, ' + f(v.k2, 1) + ' · (−' + f(Math.abs(v.u2), 0) + ' V) = −' + f(Math.abs(v.t2), 1) + ' V, dazu ' + f(v.t3, 1) + ' V; die Summe bekommt ein Minus.',
        'Musterlösung: R_1 = ' + f(v.r1, 0) + ' kΩ, R_2 = ' + f(v.r2, 0) + ' kΩ, R_3 = ' + f(v.r3, 0) + ' kΩ. Probe: U_a = −(' + f(v.t1, 1) + ' V − ' + f(Math.abs(v.t2), 1) + ' V + ' + f(v.t3, 1) + ' V) = ' + fs(v.ua, 1) + ' V.'
      ]; },
      start: () => A('opv_inv', CTL(), { fields: { r1: null, r2: null, r3: null, ua: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_inv', CTL(), { fields: { r1: v.r1, r2: v.r2, r3: v.r3, ua: v.ua }, choices: rightOf(specs()), value: v.ua }); },
      wrong: () => { const v = vals(); return [
        { name: 'R_f mal Gewicht statt durch Gewicht, gleiche Widerstände', answer: A('opv_inv', {}, { fields: { r1: v.r1mal, r2: v.r2mal, r3: v.r3, ua: v.ua }, choices: { entkoppelt: 'gleich' } }) },
        { name: 'Probe ohne Minuszeichen, R_f trennt die Eingänge', answer: A('opv_inv', {}, { fields: { r1: v.r1, r2: v.r2, r3: v.r3, ua: v.uaPlus }, choices: { entkoppelt: 'rf' } }) }]; } };
  })();

  /* ====================================================================== ae45: Differenzierer, Ausgang bei Dreieck, Rechteck und Sinus (Lernfeld 9.1, Differenzierer) */
  const M45 = (() => {
    const G = { rf: 10000, c: 1e-7, uhat: 1, f: 500 };
    const CTL = () => ({ schaltung: 'differenzierer', opv: 'ideal', form: 'dreieck', ue: G.uhat, f: G.f, rf: G.rf, c: G.c });
    const vals = () => once('v45', () => { const tau = G.rf * G.c, steil = 4 * G.uhat * G.f, ua = -tau * steil;
      return { rf: G.rf / 1e3, c: G.c * 1e9, uhat: G.uhat, f: G.f, tau: tau * 1e3, steil, ua, uab: Math.abs(ua), phi: 90, uss: 2 * G.uhat, halb: 1 / (2 * G.f) * 1e3, steilHalb: 2 * G.uhat * G.f, uaHalb: -tau * 2 * G.uhat * G.f }; });
    const rS = () => once('r45a', () => { const v = vals(); return own(v.steil, 'V/s', [{ v: v.steilHalb, id: 'halb', text: 'Du hast nur mit dem Scheitelwert gerechnet. Die Flanke läuft von −û nach +û, also über ' + f(v.uss, 0) + ' V in einer halben Periode: du/dt = 2 · û / (T / 2) = 4 · û · f.' }]); });
    const rUa = () => once('r45b', () => { const v = vals(); return own(v.ua, 'V', [{ v: -v.ua, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der Differenzierer invertiert. Bei steigender Flanke ist u_a negativ, u_a = −R_f · C · du/dt.' }, { v: v.uaHalb, id: 'halb', text: 'Dein Wert passt zur halben Steilheit. Rechne die Steilheit der Flanke mit 4 · û · f.' }]); });
    const specs = () => once('sp45', () => { const v = vals(); return [
      { key: 'rechteck', q: 'Am Eingang liegt eine Rechteckspannung. Was zeigt der Ausgang?', short: 'Der Ausgang bei Rechteckeingang ist richtig beschrieben', right: 'nadel',
        options: [
          { value: 'dreieck', label: 'Eine Dreieckspannung mit gleicher Frequenz', grund: 'Aus dem Rechteck macht der Integrierer ein Dreieck. Der Differenzierer reagiert auf die Änderung: Nur an den Flanken ändert sich die Spannung, dort entstehen kurze Spitzen.' },
          { value: 'nadel', label: 'Kurze Nadelimpulse an den Flanken', grund: 'Auf den waagerechten Teilen ist du/dt = 0, der Ausgang bleibt bei 0 V. Nur an den steilen Flanken ist du/dt sehr groß: Es entstehen Nadelimpulse, bei steigender Flanke negativ.' },
          { value: 'gleich', label: 'Ein umgedrehtes Rechteck gleicher Höhe', grund: 'Ein umgedrehtes Rechteck liefert der Invertierer mit Widerständen. Beim Differenzierer zählt nur die Änderung; auf den waagerechten Teilen ist der Ausgang 0 V.' },
          { value: 'sinus', label: 'Eine Sinusspannung mit gleicher Frequenz', grund: 'Eine Sinusspannung entsteht aus dem Rechteck nicht. Der Differenzierer liefert nur an den Flanken Spitzen, dazwischen 0 V.' }] },
      { key: 'sinus', q: 'Am Eingang liegt eine Sinusspannung. Was zeigt der Ausgang?', short: 'Der Ausgang bei Sinuseingang ist richtig beschrieben', right: 'cos',
        options: [
          { value: 'cos', label: 'Wieder eine Sinusform, um 90° verschoben', grund: 'Die Ableitung einer Sinusspannung ist eine Kosinusspannung: wieder sinusförmig, um 90° verschoben (mit der Umkehr des invertierenden Verstärkers zusammen).' },
          { value: 'nadel', label: 'Kurze Nadelimpulse in den Nulldurchgängen', grund: 'Nadelimpulse gibt es nur bei sprunghaften Änderungen. Die Sinusspannung ändert sich stetig, ihre Ableitung ist wieder sinusförmig.' },
          { value: 'rechteck', label: 'Eine Rechteckspannung gleicher Frequenz', grund: 'Ein Rechteck entsteht beim Differenzieren eines Dreiecks, weil dessen Flanken gerade sind. Die Sinusspannung liefert abgeleitet wieder eine Sinusform.' },
          { value: 'gleich', label: 'Eine konstante Gleichspannung', grund: 'Eine Gleichspannung käme nur bei konstanter Steigung heraus. Die Steigung des Sinus ändert sich ständig, der Ausgang ist eine um 90° verschobene Sinusform.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'steil'), rS(), 'Die Steilheit du/dt der Dreieckflanke ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'ua'), rUa(), 'Die Ausgangsspannung während der steigenden Flanke ist richtig berechnet (mit Vorzeichen)', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [4],
      text: () => 'Ein Differenzierer mit idealem Operationsverstärker hat C = ' + eng(G.c, 'F') + ' am Eingang und R_f = ' + eng(G.rf, 'Ω') + ' in der Rückkopplung (Übungsschaltung). Am Eingang liegt eine Dreieckspannung mit dem Scheitelwert û = ' + f(G.uhat, 0) + ' V und der Frequenz f = ' + f(G.f, 0) + ' Hz. Berechne die Steilheit du/dt einer Flanke und die Ausgangsspannung während der steigenden Flanke. Beantworte dann, was bei Rechteck- und Sinuseingang am Ausgang erscheint. Im Prüfstand „' + rname('opv_aktiv') + '“ (Schaltung Differenzierer) kannst du alle drei Eingangsformen ausprobieren.',
      fields: () => [{ key: 'steil', label: 'Steilheit du/dt der Flanke', unit: 'V/s' }, { key: 'ua', label: 'Ausgangsspannung u_a bei steigender Flanke', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Der Differenzierer liefert u_a = −R_f · C · du/dt. Bei der Dreieckspannung ist die Steigung auf jeder Flanke konstant, der Ausgang ist deshalb eine Rechteckspannung. Eine Flanke läuft in einer halben Periode von −û bis +û.',
        'Steilheit: ' + f(v.uss, 0) + ' V in ' + f(v.halb, 0) + ' ms, also du/dt = 4 · û · f. Die Zeitkonstante ist R_f · C = ' + f(v.tau, 0) + ' ms. Bei steigender Flanke ist u_a negativ.',
        'Musterlösung: du/dt = ' + f(v.steil, 0) + ' V/s, u_a = −' + f(v.tau, 0) + ' ms · ' + f(v.steil, 0) + ' V/s = ' + fs(v.ua, 0) + ' V (bei fallender Flanke +' + f(v.uab, 0) + ' V). Rechteck am Eingang gibt Nadelimpulse, Sinus gibt eine um 90° verschobene Sinusform.'
      ]; },
      start: () => A('opv_aktiv', CTL(), { fields: { steil: null, ua: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_aktiv', CTL(), { fields: { steil: v.steil, ua: v.ua }, choices: rightOf(specs()), value: v.ua }); },
      wrong: () => { const v = vals(); return [
        { name: 'Steilheit nur mit û, Rechteck wird Dreieck', answer: A('opv_aktiv', {}, { fields: { steil: v.steilHalb, ua: v.uaHalb }, choices: { rechteck: 'dreieck', sinus: 'rechteck' } }) },
        { name: 'Vorzeichen vergessen, Nadeln beim Sinus', answer: A('opv_aktiv', {}, { fields: { steil: v.steil, ua: -v.ua }, choices: { rechteck: 'gleich', sinus: 'nadel' } }) }]; } };
  })();

  /* ====================================================================== ae46: Idealer und realer Operationsverstaerker (Lernfeld 9.1, Kennwerte) */ /* PRUEFEN P12: reale Größenordnungen (V_0 etwa 100000, Eingangswiderstand im MΩ-Bereich, Ausgangswiderstand einige 10 Ω, Offset einige mV) sind Lehrwerte */
  const M46 = (() => {
    const CTL = () => ({ schaltung: 'real', opv: 'langsam', uv: 12, form: 'sinus', ue: 1, f: 5000, r1: 10000, rf: 100000, c: 1e-6 });
    const vals = () => once('v46', () => ({ gbw: 1, v0: 100000, raus: 10 }));
    const specs = () => once('sp46', () => [
      { key: 'v0', q: 'Leerlaufverstärkung V_0 (ohne Gegenkopplung): Welche Zuordnung stimmt?', short: 'Die Leerlaufverstärkung ist richtig zugeordnet', right: 'gross',
        options: [
          { value: 'eins', label: 'Ideal unendlich, real etwa 1', grund: 'Mit V_0 = 1 wäre der Baustein ein Spannungsfolger ohne Verstärkung. Reale Operationsverstärker erreichen ohne Gegenkopplung etwa 100000 und mehr.' },
          { value: 'gross', label: 'Ideal unendlich, real etwa 100000', grund: 'Der reale Baustein hat eine sehr große, aber endliche Leerlaufverstärkung (Größenordnung 100000). Deshalb bleibt die Differenzspannung klein, aber nicht null.' },
          { value: 'null', label: 'Ideal null, real etwa 100000', grund: 'Ideal ist die Leerlaufverstärkung unendlich groß, nicht null. Daraus folgt der virtuelle Kurzschluss zwischen den Eingängen.' },
          { value: 'gleich', label: 'Ideal und real gleich, beide etwa 100000', grund: 'Die Leerlaufverstärkung ist im Modell unendlich, im realen Baustein endlich (etwa 100000) und sinkt mit der Frequenz (Grenze durch das Verstärkungs-Bandbreite-Produkt).' }] },
      { key: 'rein', q: 'Eingangswiderstand: Welche Zuordnung stimmt?', short: 'Der Eingangswiderstand ist richtig zugeordnet', right: 'hoch',
        options: [
          { value: 'hoch', label: 'Ideal unendlich, real sehr groß (MΩ)', grund: 'In die Eingänge fließt fast kein Strom. Ideal ist der Eingangswiderstand unendlich, real liegt er bei bipolaren Bausteinen im MΩ-Bereich, mit Feldeffekt-Eingang noch viel höher.' },
          { value: 'klein', label: 'Ideal null, real nur einige Ohm', grund: 'Ein Eingangswiderstand von null würde die Quelle kurzschließen. Gewünscht ist das Gegenteil: Ideal ist er unendlich, real im MΩ-Bereich.' },
          { value: 'kilo', label: 'Ideal und real beide etwa 1 kΩ', grund: 'Dann würde der Verstärker die Signalquelle stark belasten. Der Eingang ist sehr hochohmig, ideal unendlich, real MΩ und mehr.' },
          { value: 'gleich', label: 'Ideal unendlich, real ebenfalls unendlich', grund: 'Unendlich groß ist nur das Modell. Real gibt es einen kleinen Eingangsstrom; der Widerstand ist groß, aber endlich.' }] },
      { key: 'raus', q: 'Ausgangswiderstand: Welche Zuordnung stimmt?', short: 'Der Ausgangswiderstand ist richtig zugeordnet', right: 'nieder',
        options: [
          { value: 'hoch', label: 'Ideal unendlich, real einige MΩ', grund: 'Ein hochohmiger Ausgang würde schon bei kleiner Last einbrechen. Der Ausgang soll eine Spannungsquelle sein: ideal 0 Ω, real wenige 10 Ω.' },
          { value: 'gleich', label: 'Ideal null, real genau null', grund: 'Null ist nur das Modell. Real hat der Ausgang einige 10 Ω; durch die Gegenkopplung wirkt er aber noch viel kleiner.' },
          { value: 'nieder', label: 'Ideal null, real einige 10 Ω', grund: 'Der Ausgang soll eine Spannungsquelle sein, deren Spannung bei Last nicht einbricht: ideal 0 Ω, real einige 10 Ω, mit Gegenkopplung wirksam noch kleiner.' },
          { value: 'kilo', label: 'Ideal und real etwa 10 kΩ', grund: 'Dann würde schon eine Last von einigen kΩ die Ausgangsspannung stark senken. Ideal ist der Ausgangswiderstand 0 Ω, real einige 10 Ω.' }] },
      { key: 'offset', q: 'Beide Eingänge liegen an 0 V. Was zeigt der Ausgang ohne Gegenkopplung?', short: 'Die Wirkung der Offsetspannung ist richtig beschrieben', right: 'grenze',
        options: [
          { value: 'null', label: 'Ideal und real genau 0 V, weil nichts anliegt', grund: 'Ideal ja. Real hat jeder Baustein eine kleine Offsetspannung (einige mV); mit der großen Leerlaufverstärkung reicht sie, um den Ausgang an eine Aussteuergrenze zu treiben.' },
          { value: 'grenze', label: 'Real an einer Aussteuergrenze (Offset)', grund: 'Die Offsetspannung von einigen mV wird mit etwa 100000 verstärkt: Das sind mehrere 100 V rechnerisch, also läuft der Ausgang an eine Aussteuergrenze. Mit Gegenkopplung bleibt nur ein kleiner Fehler übrig.' },
          { value: 'halb', label: 'Real die Hälfte der Versorgungsspannung', grund: 'Eine feste Mitte gibt es nicht. Der Ausgang folgt der verstärkten Offsetspannung und läuft ohne Gegenkopplung an eine Aussteuergrenze.' },
          { value: 'schwing', label: 'Real eine Sinusspannung mit Netzfrequenz', grund: 'Eine Schwingung entsteht so nicht. Die kleine Offsetspannung wird verstärkt und treibt den Ausgang an eine Aussteuergrenze.' }] }]);
    return pick({ rig: 'opv_aktiv', ctl: CTL, specs, vals,
      text: () => 'Beim Rechnen nimmt man meist den idealen Operationsverstärker an. Ordne für vier Kennwerte zu, was im Modell gilt und was ein realer Baustein ungefähr erreicht. Im Prüfstand „' + rname('opv_aktiv') + '“ (Schaltung „Realer Operationsverstärker“) kannst du den realen Baustein mit dem idealen vergleichen.',
      hint: () => { const v = vals(); return [
        'Der ideale Operationsverstärker hat unendliche Leerlaufverstärkung, unendlichen Eingangswiderstand, Ausgangswiderstand null und keine Offsetspannung. Überlege bei jedem Kennwert, in welche Richtung der reale Baustein davon abweicht.',
        'Realer Baustein: Leerlaufverstärkung etwa ' + f(v.v0, 0) + ', fällt mit der Frequenz (im Prüfstand: Verstärkungs-Bandbreite-Produkt ' + f(v.gbw, 0) + ' MHz). Eingang sehr hochohmig, Ausgang niederohmig. Eine kleine Offsetspannung wird ohne Gegenkopplung voll verstärkt.',
        'Musterlösung: V_0 ideal unendlich, real etwa ' + f(v.v0, 0) + '; Eingangswiderstand ideal unendlich, real MΩ und mehr; Ausgangswiderstand ideal null, real einige 10 Ω; ohne Gegenkopplung treibt die Offsetspannung den Ausgang an eine Aussteuergrenze.'
      ]; } });
  })();

  /* ====================================================================== ae47: Basisvorwiderstand, Stromverstaerkung aus der Messung (Lernfeld 6.1, Transistor als Schalter) */ /* PRUEFEN P13: Übersteuerungsfaktor ü = 2 und U_CE,sat = 0,2 V sind Übungswerte; E12-Reihe für den Normwert */
  const M47 = (() => {
    const G = { icm: 0.024, ibm: 0.00015, ub: 24, rsp: 400, ucesat: 0.2, ust: 5, ube: 0.7, ue: 2 };
    const CTL = () => ({ ub: 12, last: 'ohm', rlast: 220, rb: 10000, b: 140, eingang: 'dauer-ein', fehler: 'keiner', ziel: 0, ust: 0.9 });
    const vals = () => once('v47', () => { const b = G.icm / G.ibm, ic = (G.ub - G.ucesat) / G.rsp, ib = G.ue * ic / b, rb = (G.ust - G.ube) / ib, ueb = n => (G.ust - G.ube) / n / (ic / b);
      return { icm: G.icm * 1e3, ibm: G.ibm * 1e6, b, ub: G.ub, rsp: G.rsp, ucesat: G.ucesat, ust: G.ust, ube: G.ube, ue: G.ue, ic: ic * 1e3, ib: ib * 1e3, rb: rb / 1e3, ubRb: G.ust - G.ube, kehr: G.ibm / G.icm,
        rbOhneUe: (G.ust - G.ube) / (ic / b) / 1e3, rbOhneUbe: G.ust / ib / 1e3, ue56: ueb(5600), ue68: ueb(6800), ue47: ueb(4700), ue10: ueb(10000) }; });
    const rB = () => once('r47a', () => { const v = vals(); return own(v.b, '', [{ v: v.kehr, id: 'kehr', text: 'Dein Wert ist der Kehrwert I_B / I_C. Die Gleichstromverstärkung ist B = I_C / I_B.' }]); });
    const rIc = () => once('r47b', () => { const v = vals(); return own(v.ic * 1e-3, 'A', [{ v: v.icm * 1e-3, id: 'mess', text: 'Das ist der Strom aus der Messung. Gefragt ist der Spulenstrom: I_C = (U_B − U_CE,sat) / R_Spule.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.ic }); });
    const rRb = () => once('r47c', () => { const v = vals(); return own(v.rb * 1e3, 'Ω', [{ v: v.rbOhneUe * 1e3, id: 'ue', text: 'Du hast ohne Übersteuerung gerechnet. Damit der Transistor sicher durchschaltet, soll der Basisstrom ü = ' + f(G.ue, 0) + '-mal so groß sein wie I_C / B.' }, { v: v.rbOhneUbe * 1e3, id: 'ube', text: 'Du hast U_BE vergessen. Am Basisvorwiderstand liegt nur U_St − U_BE = ' + f(v.ubRb, 1) + ' V.' }], { factor: 1e3, dispUnit: 'kΩ', disp: v.rb }); });
    const specs = () => once('sp47', () => { const v = vals(), g = (n, x) => 'Mit ' + n + ' wird ü = ' + f(x, 2) + '.';
      return [{ key: 'norm', q: 'Welchen Normwert der E12-Reihe setzt du ein, damit ü mindestens ' + f(G.ue, 0) + ' bleibt und der Basisstrom nicht unnötig groß wird?', short: 'Der Normwert für R_B ist richtig gewählt', right: '5k6',
        options: [
          { value: '6k8', label: '6,8 kΩ', grund: g('6,8 kΩ', v.ue68) + ' Das liegt unter ' + f(G.ue, 0) + ': Der nächstgrößere Normwert lässt zu wenig Basisstrom fließen.' },
          { value: '4k7', label: '4,7 kΩ', grund: g('4,7 kΩ', v.ue47) + ' Das reicht sicher, ist aber nicht der nächste Normwert unter ' + f(v.rb, 2) + ' kΩ: Der Basisstrom wird größer als nötig.' },
          { value: '10k', label: '10 kΩ', grund: g('10 kΩ', v.ue10) + ' Der Transistor wird nicht sicher in die Sättigung gesteuert.' },
          { value: '5k6', label: '5,6 kΩ', grund: g('5,6 kΩ', v.ue56) + ' Das ist der nächstkleinere Normwert zu ' + f(v.rb, 2) + ' kΩ, ü bleibt knapp über ' + f(G.ue, 0) + '.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'b'), rB(), 'Die Gleichstromverstärkung B aus der Messung ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'ic'), rIc(), 'Der Spulenstrom I_C ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'rb'), rRb(), 'Der Basisvorwiderstand R_B ist richtig berechnet', 2);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [5.6, 6.8, 4.7, 10],
      text: () => 'An einem npn-Transistor wurde gemessen: I_C = ' + f(G.icm * 1e3, 0) + ' mA bei I_B = ' + f(G.ibm * 1e6, 0) + ' µA (aktiver Bereich). Der Transistor soll nun ein Relais mit dem Spulenwiderstand R_Spule = ' + f(G.rsp, 0) + ' Ω an U_B = ' + f(G.ub, 0) + ' V schalten; die Steuerspannung ist U_St = ' + f(G.ust, 0) + ' V (Übungswerte: U_BE = ' + f(G.ube, 1) + ' V, U_CE,sat = ' + f(G.ucesat, 1) + ' V, Übersteuerungsfaktor ü = ' + f(G.ue, 0) + '). Berechne B, den Spulenstrom I_C und den Basisvorwiderstand R_B und wähle den Normwert. Im Prüfstand „' + rname('schalter') + '“ kannst du die Stufe mit einer Widerstandslast nachstellen.',
      fields: () => [{ key: 'b', label: 'Gleichstromverstärkung B', unit: '' }, { key: 'ic', label: 'Spulenstrom I_C', unit: 'mA' }, { key: 'rb', label: 'Basisvorwiderstand R_B (gerechnet)', unit: 'kΩ' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Aus der Messung im aktiven Bereich folgt B = I_C / I_B. Im Schalterbetrieb liegt am durchgeschalteten Transistor nur U_CE,sat, der Rest an der Spule. Mit Übersteuerung ist I_B = ü · I_C / B, und am Basisvorwiderstand liegt U_St − U_BE.',
        'B = ' + f(v.icm, 0) + ' mA / ' + f(v.ibm, 0) + ' µA (Einheiten angleichen). I_C = (' + f(v.ub, 0) + ' V − ' + f(v.ucesat, 1) + ' V) / ' + f(v.rsp, 0) + ' Ω. I_B = ' + f(v.ue, 0) + ' · I_C / B, R_B = ' + f(v.ubRb, 1) + ' V / I_B.',
        'Musterlösung: B = ' + f(v.b, 0) + ', I_C = ' + f(v.ic, 2) + ' mA, I_B = ' + f(v.ib, 3) + ' mA, R_B = ' + f(v.rb, 2) + ' kΩ. Nächstkleinerer E12-Wert: 5,6 kΩ (ü = ' + f(v.ue56, 2) + ').'
      ]; },
      start: () => A('schalter', CTL(), { fields: { b: null, ic: null, rb: null }, choices: {} }),
      sol: () => { const v = vals(); return A('schalter', CTL(), { fields: { b: v.b, ic: v.ic, rb: v.rb }, choices: rightOf(specs()), value: v.rb }); },
      wrong: () => { const v = vals(); return [
        { name: 'Kehrwert für B, ohne Übersteuerung, nächstgrößerer Normwert', answer: A('schalter', {}, { fields: { b: v.kehr, ic: v.ic, rb: v.rbOhneUe }, choices: { norm: '6k8' } }) },
        { name: 'Messstrom als Spulenstrom, U_BE vergessen, 10 kΩ', answer: A('schalter', {}, { fields: { b: v.b, ic: v.icm, rb: v.rbOhneUbe }, choices: { norm: '10k' } }) }]; } };
  })();

  /* ====================================================================== ae48: R-2R-Netzwerk am Umkehrverstaerker (Lernfeld E10/E12, Digital-Analog-Umsetzer) */ /* PRUEFEN P14: Kettenleiter mit Eingangswiderstand R, Strom Uref / R auf alle Bits verteilt (MSB Uref / 2R); Ausgang an virtueller Masse */
  const M48 = (() => {
    const G = { uref: 5, r: 10000, rf: 20000, code: 13, n: 4 };
    const CTL = () => ({ schaltung: 'invertierer', opv: 'ideal', form: 'gleich', ue: 0.5, r1: 4700, rf: 47000 });
    const vals = () => once('v48', () => { const iv = G.uref / G.r, i = iv * G.code / 16, ua = -G.rf * i, lsb = G.rf * iv / 16, rev = parseInt(G.code.toString(2).padStart(4, '0').split('').reverse().join(''), 2);
      return { uref: G.uref, r: G.r / 1e3, r2: 2 * G.r / 1e3, rf: G.rf / 1e3, code: G.code, iv: iv * 1e3, imsb: iv / 2 * 1e3, i: i * 1e6, ua, uab: Math.abs(ua), lsb, umax: G.rf * iv * 15 / 16, rev, iRev: iv * rev / 16 * 1e6, uaRev: -G.rf * iv * rev / 16, lsb15: G.rf * iv / 15, i8: iv / 2 * 1e6, i4: iv / 4 * 1e6, i1: iv / 16 * 1e6 }; });
    const rI = () => once('r48a', () => { const v = vals(); return own(v.i * 1e-6, 'A', [{ v: v.iRev * 1e-6, id: 'rev', text: 'Dein Wert passt zum Code mit vertauschter Bitreihenfolge (' + f(v.rev, 0) + '). Das linke Bit ist das höchstwertige (MSB) und liefert den halben Strom U_ref / (2 · R).' }, { v: v.iv * 1e-3, id: 'voll', text: 'Das ist der ganze Strom U_ref / R, der nur bei allen Bits auf 1 fast erreicht wird. Jedes Bit trägt nur seinen Anteil bei.' }], { factor: 1e-6, dispUnit: 'µA', disp: v.i }); });
    const rU = () => once('r48b', () => { const v = vals(); return own(v.ua, 'V', [{ v: -v.ua, id: 'vorzeichen', text: 'Dein Wert hat das falsche Vorzeichen: Der Strom fließt in den Summenpunkt des invertierenden Verstärkers, U_a = −R_f · I.' }, { v: v.uaRev, id: 'rev', text: 'Dein Wert passt zum Code mit vertauschter Bitreihenfolge. Das linke Bit ist das MSB.' }]); });
    const rL = () => once('r48c', () => { const v = vals(); return own(v.lsb, 'V', [{ v: v.lsb15, id: 'f15', text: 'Du hast durch 15 geteilt. Beim 4-Bit-Kettenleiter ist der kleinste Schritt R_f · U_ref / (16 · R); 15 Schritte ergeben den Höchstwert.' }]); });
    const specs = () => once('sp48', () => { const v = vals(); return [
      { key: 'vorteil', q: 'Warum nimmt man für viele Bits lieber einen R-2R-Kettenleiter als binär gestufte Widerstände (R, 2R, 4R, 8R …)?', short: 'Der Vorteil des R-2R-Netzwerks ist richtig benannt', right: 'zwei',
        options: [
          { value: 'opv', label: 'Er braucht keinen Operationsverstärker', grund: 'Auch der Kettenleiter braucht den Verstärker: Er addiert die Ströme an der virtuellen Masse und macht daraus U_a = −R_f · I.' },
          { value: 'zwei', label: 'Er braucht nur zwei Widerstandswerte', grund: 'Mit binär gestuften Widerständen wächst der größte Wert mit jedem Bit (bei 12 Bit bis 2048 · R) und muss trotzdem genau sein. Der Kettenleiter kommt mit R und 2R aus, die sich gut genau herstellen lassen.' },
          { value: 'gleich', label: 'Jeder Schalter führt den MSB-Strom', grund: 'Die Bitströme sind binär gestuft: MSB ' + f(v.i8, 0) + ' µA, dann ' + f(v.i4, 0) + ' µA und so weiter bis ' + f(v.i1, 2) + ' µA beim LSB.' },
          { value: 'positiv', label: 'Die Ausgangsspannung wird positiv', grund: 'Am invertierenden Verstärker ist U_a negativ (hier ' + fs(v.ua, 3) + ' V). Das Vorzeichen hängt von der Schaltung des Verstärkers ab, nicht vom Netzwerk.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'i'), rI(), 'Der Strom I in den Summenpunkt beim Code ' + G.code.toString(2) + ' ist richtig berechnet', 2);
      numRow(r, rawOf(a, 'ua'), rU(), 'Die Ausgangsspannung U_a ist richtig berechnet (mit Vorzeichen)', 3);
      numRow(r, rawOf(a, 'lsb'), rL(), 'Die Stufenhöhe (ein LSB) ist richtig berechnet', 3);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [16, 15, 2048, 12, 1111],
      text: () => 'Ein 4-Bit-Digital-Analog-Umsetzer besteht aus einem R-2R-Kettenleiter (R = ' + eng(G.r, 'Ω') + ', 2R = ' + eng(2 * G.r, 'Ω') + ') an der Referenzspannung U_ref = ' + f(G.uref, 0) + ' V und einem invertierenden Verstärker mit R_f = ' + eng(G.rf, 'Ω') + ' (Übungsschaltung). Der Kettenleiter nimmt aus U_ref den Strom U_ref / R auf; das höchstwertige Bit schaltet davon die Hälfte auf den Summenpunkt, jedes weitere Bit die Hälfte des vorigen. Am Eingang liegt das Datenwort ' + G.code.toString(2) + ' (links das MSB). Berechne den Strom I in den Summenpunkt, die Ausgangsspannung U_a und die Stufenhöhe eines LSB. Den Summenpunkt (virtuelle Masse) kannst du im Prüfstand „' + rname('opv_inv') + '“ untersuchen.',
      fields: () => [{ key: 'i', label: 'Strom I in den Summenpunkt', unit: 'µA' }, { key: 'ua', label: 'Ausgangsspannung U_a', unit: 'V' }, { key: 'lsb', label: 'Stufenhöhe (1 LSB)', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Die Bitströme sind binär gestuft: MSB U_ref / (2R), das nächste Bit die Hälfte davon und so weiter. Für ein 4-Bit-Wort gilt I = (U_ref / R) · Z / 16 mit dem Dezimalwert Z des Datenworts. Der Verstärker macht daraus U_a = −R_f · I.',
        'U_ref / R = ' + f(v.uref, 0) + ' V / ' + f(v.r, 0) + ' kΩ = ' + f(v.iv, 1) + ' mA. Das Datenwort hat den Dezimalwert ' + f(v.code, 0) + '. Ein LSB ist R_f · (U_ref / R) / 16 mit R_f = ' + f(v.rf, 0) + ' kΩ.',
        'Musterlösung: I = ' + f(v.iv, 1) + ' mA · ' + f(v.code, 0) + ' / 16 = ' + f(v.i, 2) + ' µA, U_a = −' + f(v.rf, 0) + ' kΩ · ' + f(v.i, 2) + ' µA = ' + fs(v.ua, 3) + ' V, LSB = ' + f(v.lsb, 3) + ' V (Höchstwert bei 1111: −' + f(v.umax, 3) + ' V).'
      ]; },
      start: () => A('opv_inv', CTL(), { fields: { i: null, ua: null, lsb: null }, choices: {} }),
      sol: () => { const v = vals(); return A('opv_inv', CTL(), { fields: { i: v.i, ua: v.ua, lsb: v.lsb }, choices: rightOf(specs()), value: v.ua }); },
      wrong: () => { const v = vals(); return [
        { name: 'Bitreihenfolge vertauscht, LSB durch 15', answer: A('opv_inv', {}, { fields: { i: v.iRev, ua: v.uaRev, lsb: v.lsb15 }, choices: { vorteil: 'gleich' } }) },
        { name: 'Vorzeichen vergessen, ganzer Strom U_ref / R', answer: A('opv_inv', {}, { fields: { i: v.iv * 1e3, ua: -v.ua, lsb: v.lsb }, choices: { vorteil: 'opv' } }) }]; } };
  })();

  /* ====================================================================== ae49: Diodenschaltungen, Spannung am Ausgang (Lernfeld 6.1, Diode im Gleichstromkreis) */ /* PRUEFEN P15: eigene Schaltungen und Zahlen (U_F = 0,7 V Silizium); die Fälle der Mitschrift mit unklarer Lösung wurden nicht übernommen */
  const M49 = (() => {
    const G = { ue: 6, r: 1000 };
    const CTL = () => ({ typ: 'si', modell: 'kennlinie', uq: 5, rv: 220, temp: 27, fehler: 'keiner', ziel: 0 });
    const vals = () => once('v49', () => { const uf = C().diode.types.find(x => x.id === 'si').uf; return { ue: G.ue, r: G.r / 1e3, uf, ua: G.ue - uf, ub: uf, uc: 2 * uf, ia: (G.ue - uf) / G.r * 1e3, ic: (G.ue - 2 * uf) / G.r * 1e3, ur2: G.ue - 2 * uf }; });
    const rA = () => once('r49a', () => { const v = vals(); return own(v.ua, 'V', [{ v: v.ue, id: 'ue', text: 'Du hast U_F nicht abgezogen. An der leitenden Siliziumdiode fallen etwa ' + f(v.uf, 1) + ' V ab, am Widerstand bleibt U_E − U_F.' }, { v: v.uf, id: 'uf', text: 'Das ist die Spannung an der Diode. Gefragt ist die Spannung am Widerstand: U_E − U_F.' }]); });
    const rB = () => once('r49b', () => { const v = vals(); return own(v.ub, 'V', [{ v: v.ua, id: 'ur', text: 'Das ist die Spannung am Widerstand. An der leitenden Diode selbst liegt nur ihre Durchlassspannung U_F.' }, { v: v.ue, id: 'ue', text: 'Die Diode leitet, an ihr liegt nicht die ganze Eingangsspannung, sondern nur U_F.' }]); });
    const rC = () => once('r49c', () => { const v = vals(); return own(v.uc, 'V', [{ v: v.uf, id: 'eins', text: 'Du hast nur eine Diode gezählt. Zwei Dioden in Reihe haben zusammen 2 · U_F.' }]); });
    const rI = () => once('r49i', () => { const v = vals(); return own(v.ia * 1e-3, 'A', [{ v: v.ue / G.r, id: 'ue', text: 'Du hast U_E / R gerechnet. Am Widerstand liegt nur U_E − U_F.' }], { factor: 1e-3, dispUnit: 'mA', disp: v.ia }); });
    const specs = () => once('sp49', () => { const v = vals(); return [
      { key: 'sperrR', q: 'Schaltung D: Die Diode ist in Sperrrichtung eingebaut, sonst wie Schaltung A. Welche Spannung liegt am Widerstand?', short: 'Die Spannung am Widerstand bei gesperrter Diode ist richtig bestimmt', right: 'null',
        options: [
          { value: 'ua', label: f(v.ua, 1) + ' V wie bei Schaltung A', grund: 'In Sperrrichtung fließt (fast) kein Strom. Ohne Strom fällt am Widerstand nichts ab: U_R = I · R = 0 V.' },
          { value: 'null', label: '0 V, es fließt kein Strom', grund: 'Die gesperrte Diode lässt (bis auf einen winzigen Sperrstrom) keinen Strom durch. Ohne Strom ist U_R = I · R = 0 V.' },
          { value: 'ue', label: f(v.ue, 0) + ' V, die ganze Eingangsspannung', grund: 'Die ganze Eingangsspannung liegt an der gesperrten Diode, nicht am Widerstand. Am Widerstand ist U_R = I · R = 0 V.' },
          { value: 'uf', label: f(v.uf, 1) + ' V, die Durchlassspannung', grund: 'U_F gilt nur für eine leitende Diode. Gesperrt fließt kein Strom, am Widerstand fällt nichts ab.' }] },
      { key: 'sperrD', q: 'Schaltung E: wie Schaltung D, gemessen wird aber an der gesperrten Diode. Welche Spannung zeigt das Messgerät?', short: 'Die Spannung an der gesperrten Diode ist richtig bestimmt', right: 'ue',
        options: [
          { value: 'null', label: '0 V, weil durch den Kreis kein Strom fließt', grund: 'Kein Strom heißt: kein Spannungsfall am Widerstand. Die Eingangsspannung liegt dann vollständig an der Diode.' },
          { value: 'uf', label: f(v.uf, 1) + ' V, die Durchlassspannung', grund: 'U_F gilt in Durchlassrichtung. In Sperrrichtung liegt an der Diode die ganze Eingangsspannung (' + f(v.ue, 0) + ' V).' },
          { value: 'ue', label: f(v.ue, 0) + ' V, die ganze Eingangsspannung', grund: 'Ohne Strom fällt am Widerstand nichts ab. Nach der Maschenregel liegt die ganze Eingangsspannung ' + f(v.ue, 0) + ' V an der gesperrten Diode.' },
          { value: 'ua', label: f(v.ua, 1) + ' V, U_E − U_F', grund: 'U_E − U_F wäre die Spannung am Widerstand bei leitender Diode. Gesperrt liegt die ganze Eingangsspannung an der Diode.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'ua'), rA(), 'Schaltung A: Die Spannung am Widerstand ist richtig bestimmt', 1);
      numRow(r, rawOf(a, 'ia'), rI(), 'Schaltung A: Der Strom ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'ub'), rB(), 'Schaltung B: Die Spannung an der Diode ist richtig bestimmt', 1);
      numRow(r, rawOf(a, 'uc'), rC(), 'Schaltung C: Die Spannung an beiden Dioden ist richtig bestimmt', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Gleichspannung U_E = ' + f(G.ue, 0) + ' V speist eine Reihenschaltung aus Siliziumdiode (U_F = ' + f(vals().uf, 1) + ' V, Übungswert) und Widerstand R = ' + eng(G.r, 'Ω') + '. Schaltung A: Diode in Durchlassrichtung, gemessen wird am Widerstand; berechne auch den Strom. Schaltung B: wie A, gemessen wird an der Diode. Schaltung C: zwei gleiche Dioden in Reihe in Durchlassrichtung, gemessen wird an beiden Dioden zusammen. Danach folgen zwei Fragen zur Diode in Sperrrichtung. Im Prüfstand „' + rname('diode') + '“ kannst du U_q auch negativ stellen und so die Sperrrichtung ausprobieren.',
      fields: () => [{ key: 'ua', label: 'Schaltung A: Spannung am Widerstand', unit: 'V' }, { key: 'ia', label: 'Schaltung A: Strom', unit: 'mA' }, { key: 'ub', label: 'Schaltung B: Spannung an der Diode', unit: 'V' }, { key: 'uc', label: 'Schaltung C: Spannung an beiden Dioden', unit: 'V' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'Eine leitende Siliziumdiode hält etwa U_F fest, der Rest der Eingangsspannung liegt am Widerstand (Maschenregel). Eine gesperrte Diode lässt keinen Strom durch: Am Widerstand fällt dann nichts ab, die ganze Spannung liegt an der Diode.',
        'Schaltung A: U_R = ' + f(v.ue, 0) + ' V − ' + f(v.uf, 1) + ' V, I = U_R / ' + f(v.r, 0) + ' kΩ. Schaltung B: an der Diode liegt U_F. Schaltung C: zwei Dioden, also 2 · U_F; am Widerstand bleiben ' + f(v.ur2, 1) + ' V.',
        'Musterlösung: A: ' + f(v.ua, 1) + ' V und ' + f(v.ia, 1) + ' mA; B: ' + f(v.ub, 1) + ' V; C: ' + f(v.uc, 1) + ' V. Gesperrt: am Widerstand 0 V, an der Diode ' + f(v.ue, 0) + ' V.'
      ]; },
      start: () => A('diode', CTL(), { fields: { ua: null, ia: null, ub: null, uc: null }, choices: {} }),
      sol: () => { const v = vals(); return A('diode', CTL(), { fields: { ua: v.ua, ia: v.ia, ub: v.ub, uc: v.uc }, choices: rightOf(specs()), value: v.ua }); },
      wrong: () => { const v = vals(); return [
        { name: 'U_F nicht beachtet, eine Diode statt zwei', answer: A('diode', {}, { fields: { ua: v.ue, ia: v.ue / G.r * 1e3, ub: v.ue, uc: v.uf }, choices: { sperrR: 'ua', sperrD: 'null' } }) },
        { name: 'Diode und Widerstand vertauscht, Sperrrichtung wie Durchlass', answer: A('diode', {}, { fields: { ua: v.uf, ia: v.ia, ub: v.ua, uc: v.uc }, choices: { sperrR: 'uf', sperrD: 'uf' } }) }]; } };
  })();

  /* ====================================================================== ae50: Verlustleistung der Diode in Durchlass- und Sperrrichtung (Lernfeld 6.1, Grenzwerte der Diode) */ /* PRUEFEN P16: eigene Werte einer Gleichrichterdiode (U_R = 800 V, I_R = 5 µA, I_F = 3 A, U_F = 1,1 V); Datenblatt maßgeblich */
  const M50 = (() => {
    const G = { ur: 800, ir: 5e-6, iF: 3, uF: 1.1 };
    const CTL = () => ({ typ: 'si', modell: 'kennlinie', uq: 5, rv: 220, temp: 27, fehler: 'keiner', ziel: 0 });
    const vals = () => once('v50', () => { const rs = G.ur / G.ir, ps = G.ur * G.ir, pf = G.uF * G.iF; return { ur: G.ur, ir: G.ir * 1e6, iF: G.iF, uF: G.uF, rs: rs / 1e6, ps: ps * 1e3, pf, verh: pf / ps, psFalsch: G.ur * G.ur * G.ir * 1e3, rf: G.uF / G.iF }; });
    const rRs = () => once('r50a', () => { const v = vals(); return own(v.rs * 1e6, 'Ω', [{ v: G.ir / G.ur, id: 'kehr', text: 'Dein Wert ist der Kehrwert I_R / U_R. Der Widerstand ist Spannung durch Strom: R = U_R / I_R.' }], { factor: 1e6, dispUnit: 'MΩ', disp: v.rs }); });
    const rPs = () => once('r50b', () => { const v = vals(); return own(v.ps * 1e-3, 'W', [{ v: v.psFalsch * 1e-3, id: 'quadrat', text: 'Du hast U_R² · I_R gerechnet. Die Leistung ist P = U · I, in Sperrrichtung also P_R = U_R · I_R.' }], { factor: 1e-3, dispUnit: 'mW', disp: v.ps }); });
    const rPf = () => once('r50c', () => { const v = vals(); return own(v.pf, 'W', [{ v: G.ur * G.iF, id: 'ur', text: 'Du hast die Sperrspannung mit dem Durchlassstrom multipliziert. Beide treten nie gleichzeitig auf: In Durchlassrichtung liegt nur U_F an der Diode, P_F = U_F · I_F.' }]); });
    const specs = () => once('sp50', () => { const v = vals(); return [
      { key: 'warm', q: 'In welchem Betriebszustand wird die Diode am stärksten erwärmt?', short: 'Der Zustand mit der größeren Verlustleistung ist richtig erkannt', right: 'durch',
        options: [
          { value: 'sperr', label: 'In Sperrrichtung, weil dort ' + f(v.ur, 0) + ' V anliegen', grund: 'Die Spannung ist zwar groß, der Strom aber winzig (' + f(v.ir, 0) + ' µA): P_R = ' + f(v.ps, 0) + ' mW. In Durchlassrichtung sind es ' + f(v.pf, 1) + ' W.' },
          { value: 'gleich', label: 'In beiden Richtungen etwa gleich stark', grund: 'Die Leistungen unterscheiden sich um den Faktor ' + f(v.verh, 0) + ': ' + f(v.pf, 1) + ' W in Durchlassrichtung gegen ' + f(v.ps, 0) + ' mW in Sperrrichtung.' },
          { value: 'durch', label: 'In Durchlassrichtung, wegen des großen Stroms', grund: 'P_F = ' + f(v.uF, 1) + ' V · ' + f(v.iF, 0) + ' A = ' + f(v.pf, 1) + ' W ist rund ' + f(v.verh, 0) + '-mal so groß wie P_R = ' + f(v.ps, 0) + ' mW. Die Durchlassverluste bestimmen die Erwärmung und den Kühlkörper.' },
          { value: 'keiner', label: 'Gar nicht, eine Diode hat grundsätzlich keine Verluste', grund: 'Jede Diode setzt Leistung um: In Durchlassrichtung ' + f(v.pf, 1) + ' W, in Sperrrichtung ' + f(v.ps, 0) + ' mW.' }] }]; });
    const check = mk((r, a) => {
      numRow(r, rawOf(a, 'rs'), rRs(), 'Der Sperrwiderstand R_R ist richtig berechnet', 0);
      numRow(r, rawOf(a, 'ps'), rPs(), 'Die Verlustleistung in Sperrrichtung ist richtig berechnet', 1);
      numRow(r, rawOf(a, 'pf'), rPf(), 'Die Verlustleistung in Durchlassrichtung ist richtig berechnet', 1);
      choiceRows(r, a, specs());
    });
    return { vals, check, audit: () => choiceAudit(specs()), consts: [],
      text: () => 'Eine Gleichrichterdiode sperrt die Spannung U_R = ' + f(G.ur, 0) + ' V; dabei fließt der Sperrstrom I_R = ' + f(G.ir * 1e6, 0) + ' µA. In Durchlassrichtung führt sie I_F = ' + f(G.iF, 0) + ' A bei U_F = ' + f(G.uF, 1) + ' V (Übungswerte). Berechne den Widerstand der Diode in Sperrrichtung, die Verlustleistung in Sperrrichtung und die Verlustleistung in Durchlassrichtung. Im Prüfstand „' + rname('diode') + '“ kannst du die Kennlinie einer Siliziumdiode in beiden Richtungen ansehen.',
      fields: () => [{ key: 'rs', label: 'Widerstand in Sperrrichtung R_R', unit: 'MΩ' }, { key: 'ps', label: 'Verlustleistung in Sperrrichtung P_R', unit: 'mW' }, { key: 'pf', label: 'Verlustleistung in Durchlassrichtung P_F', unit: 'W' }],
      choices: () => publicChoices(specs()),
      hint: () => { const v = vals(); return [
        'In jeder Richtung gilt P = U · I mit der Spannung an der Diode und dem Strom durch sie. Der Widerstand in Sperrrichtung ist R = U_R / I_R. Achte auf die Vorsätze µ, m und M.',
        'Sperrrichtung: R_R = ' + f(v.ur, 0) + ' V / ' + f(v.ir, 0) + ' µA, P_R = ' + f(v.ur, 0) + ' V · ' + f(v.ir, 0) + ' µA. Durchlassrichtung: P_F = ' + f(v.uF, 1) + ' V · ' + f(v.iF, 0) + ' A.',
        'Musterlösung: R_R = ' + f(v.rs, 0) + ' MΩ, P_R = ' + f(v.ps, 0) + ' mW, P_F = ' + f(v.pf, 1) + ' W. Die Durchlassverluste sind rund ' + f(v.verh, 0) + '-mal so groß.'
      ]; },
      start: () => A('diode', CTL(), { fields: { rs: null, ps: null, pf: null }, choices: {} }),
      sol: () => { const v = vals(); return A('diode', CTL(), { fields: { rs: v.rs, ps: v.ps, pf: v.pf }, choices: rightOf(specs()), value: v.pf }); },
      wrong: () => { const v = vals(); return [
        { name: 'Kehrwert als Widerstand, U_R² · I_R, Sperrrichtung wärmer', answer: A('diode', {}, { fields: { rs: G.ir / G.ur / 1e6, ps: v.psFalsch, pf: v.pf }, choices: { warm: 'sperr' } }) },
        { name: 'Sperrspannung mal Durchlassstrom, beide gleich warm', answer: A('diode', {}, { fields: { rs: v.rs, ps: v.ps, pf: G.ur * G.iF }, choices: { warm: 'gleich' } }) }]; } };
  })();

  /* ====================================================================== Registrierung */
  const tasks = [
    tk({ id: 'ae17', lab: 'ana', cat: 'Prüfungsnah', title: 'Verstärkung des Invertierers', level: 1, rig: 'opv_inv' }, M17),
    tk({ id: 'ae18', lab: 'ana', cat: 'Prüfungsnah', title: 'Rückkopplungswiderstand des Invertierers', level: 1, rig: 'opv_inv' }, M18),
    tk({ id: 'ae19', lab: 'ana', cat: 'Prüfungsnah', title: 'Summierer berechnen', level: 2, rig: 'opv_inv' }, M19),
    tk({ id: 'ae20', lab: 'ana', cat: 'Prüfungsnah', title: 'Sättigung: Wie sieht der Ausgang aus?', level: 2, rig: 'opv_inv' }, M20),
    tk({ id: 'ae21', lab: 'ana', cat: 'Prüfungsnah', title: 'Nichtinvertierender Verstärker', level: 1, rig: 'opv_nin' }, M21),
    tk({ id: 'ae22', lab: 'ana', cat: 'Prüfungsnah', title: 'Rückkopplungswiderstand des Nichtinvertierers', level: 2, rig: 'opv_nin' }, M22),
    tk({ id: 'ae23', lab: 'ana', cat: 'Prüfungsnah', title: 'Differenzverstärker', level: 2, rig: 'opv_nin' }, M23),
    tk({ id: 'ae24', lab: 'ana', cat: 'Fehlersuche', title: 'Fehlersuche: Der Ausgang stimmt nicht', level: 2, rig: 'opv_nin' }, M24),
    tk({ id: 'ae25', lab: 'ana', cat: 'Prüfungsnah', title: 'Schmitt-Trigger: Schaltschwelle', level: 2, rig: 'opv_komp' }, M25),
    tk({ id: 'ae26', lab: 'ana', cat: 'Prüfungsnah', title: 'Nichtinvertierender Schmitt-Trigger', level: 3, rig: 'opv_komp' }, M26),
    tk({ id: 'ae27', lab: 'ana', cat: 'Komparator und Schmitt-Trigger', title: 'Hysterese einstellen', level: 3, rig: 'opv_komp' }, M27),
    tk({ id: 'ae28', lab: 'ana', cat: 'Prüfungsnah', title: 'Integrierer: Steigung', level: 2, rig: 'opv_aktiv' }, M28),
    tk({ id: 'ae29', lab: 'ana', cat: 'Prüfungsnah', title: 'Integrierer: Eingangswiderstand', level: 2, rig: 'opv_aktiv' }, M29),
    tk({ id: 'ae30', lab: 'ana', cat: 'Aktive Schaltungen', title: 'Slew-Rate: höchste Frequenz', level: 3, rig: 'opv_aktiv' }, M30),
    tk({ id: 'ae31', lab: 'ana', cat: 'Aktive Schaltungen', title: 'Aktiver Tiefpass: Grenzfrequenz', level: 2, rig: 'opv_aktiv' }, M31),
    tk({ id: 'ae32', lab: 'ana', cat: 'Fehlersuche', title: 'Meisterstück: Fehler finden, Stufe auslegen und messen', level: 3, rig: 'opv_inv' }, M32),
    tk({ id: 'ae33', lab: 'ana', cat: 'Diode', title: 'Arbeitsgerade und Arbeitspunkt der LED', level: 2, rig: 'diode' }, M33),
    tk({ id: 'ae34', lab: 'ana', cat: 'Transistorschalter', title: 'Verlustleistungshyperbel', level: 2, rig: 'schalter' }, M34),
    tk({ id: 'ae35', lab: 'ana', cat: 'Transistorschalter', title: 'Betriebszustände des Transistors', level: 2, rig: 'schalter' }, M35),
    tk({ id: 'ae36', lab: 'ana', cat: 'Transistorschalter', title: 'Stromverstärkung aus der Messreihe', level: 2, rig: 'schalter' }, M36),
    tk({ id: 'ae37', lab: 'ana', cat: 'Diode', title: 'Dotierung und Sperrschicht', level: 1, rig: 'diode' }, M37),
    tk({ id: 'ae38', lab: 'ana', cat: 'Diode', title: 'Diodenarten und ihr Einsatz', level: 1, rig: 'diode' }, M38),
    tk({ id: 'ae39', lab: 'ana', cat: 'Transistorverstärker', title: 'Basisvorspannung und Ruhearbeitspunkt', level: 2, rig: 'emitter' }, M39),
    tk({ id: 'ae40', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Vorteile integrierter Schaltungen', level: 1, rig: 'opv_inv' }, M40),
    tk({ id: 'ae41', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Virtueller Kurzschluss am realen Verstärker', level: 2, rig: 'opv_aktiv' }, M41),
    tk({ id: 'ae42', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Invertierer aus Strom und Spannung auslegen', level: 2, rig: 'opv_inv' }, M42),
    tk({ id: 'ae43', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Nichtinvertierer: Eingangsspannung aus dem Ausgang', level: 2, rig: 'opv_nin' }, M43),
    tk({ id: 'ae44', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Summierer mit Gewichtung entwerfen', level: 3, rig: 'opv_inv' }, M44),
    tk({ id: 'ae45', lab: 'ana', cat: 'Aktive Schaltungen', title: 'Differenzierer: Ausgang bei Dreieck, Rechteck und Sinus', level: 2, rig: 'opv_aktiv' }, M45),
    tk({ id: 'ae46', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'Idealer und realer Operationsverstärker', level: 1, rig: 'opv_aktiv' }, M46),
    tk({ id: 'ae47', lab: 'ana', cat: 'Transistorschalter', title: 'Basisvorwiderstand mit B aus der Messung', level: 2, rig: 'schalter' }, M47),
    tk({ id: 'ae48', lab: 'ana', cat: 'OPV-Grundschaltungen', title: 'R-2R-Umsetzer am invertierenden Verstärker', level: 3, rig: 'opv_inv' }, M48),
    tk({ id: 'ae49', lab: 'ana', cat: 'Diode', title: 'Diodenschaltungen: Spannung am Ausgang', level: 1, rig: 'diode' }, M49),
    tk({ id: 'ae50', lab: 'ana', cat: 'Diode', title: 'Verlustleistung in Durchlass- und Sperrrichtung', level: 2, rig: 'diode' }, M50)
  ];
  const MODS = { ae17: M17, ae18: M18, ae19: M19, ae20: M20, ae21: M21, ae22: M22, ae23: M23, ae24: M24, ae25: M25, ae26: M26, ae27: M27, ae28: M28, ae29: M29, ae30: M30, ae31: M31, ae32: M32, ae33: M33, ae34: M34, ae35: M35, ae36: M36, ae37: M37, ae38: M38, ae39: M39, ae40: M40, ae41: M41, ae42: M42, ae43: M43, ae44: M44, ae45: M45, ae46: M46, ae47: M47, ae48: M48, ae49: M49, ae50: M50 };
  /* Musterwerte der Aufgaben (Schwellen aus den Musterloesungen, SPEC 8: Schwellwerte aus der Musterloesung) */
  T.thresholds2 = function () { const o = {}; Object.keys(MODS).forEach(k => { try { o[k] = MODS[k].vals(); } catch (e) { o[k] = { error: String(e && e.message || e) }; } }); return o; };
  T.register(tasks);
  if (typeof module !== 'undefined') module.exports = { tasks };
})(typeof window !== 'undefined' ? window : globalThis);
