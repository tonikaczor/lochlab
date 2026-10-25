/* emvtasks2.js - EMV-Lab: Aufgaben em17 bis em32 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig), Paket WP4b.
 * Registrierung: EMV_TASKS.register([ ... ]) (EMV_TASKS kommt aus emvdata.js; fehlt es, legt diese Datei ein gleichwertiges Geruest an).
 * Format je Aufgabe: { id, lab:'emv', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), hintVals(), fields? | choices? | ask? | clicks? }
 *   start() und sol() liefern { rig, controls, fields?, choices?, value?, clicks? } (Steuerwerte des Pruefstands in SI-Einheiten, Selbsttest-Antworten).
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, clicks:[{x,y,hit,fall}] }.
 *   check(answer) liefert eine Liste [{ ok, text, why }]; Prozent der Treffer = Ergebnis (Start < 100, Musterloesung = 100).
 * Regeln (SPEC Abschnitt 9 und 11):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus EMV_CORE, den Pruefstaenden (EMV_RIGS) oder EMV_CORE.exercise und stehen in hintVals() (Regel 1);
 *     text, table, hint und choices werden erst beim ersten Zugriff gerechnet.
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde; typische Fehler werden erst genannt, wenn der Wert des Lernenden zum gerechneten Fehlerwert passt (Regel 2, 3).
 *   - Schwellwerte stammen aus der simulierten Musterloesung (Reserve 25 % bei Groessen, 3 dB bei Pegeln, Stand 2026-10-22) oder sind Vorgaben im Aufgabentext;
 *     die Reserve prueft test_emvdata2.js gegen die frische Musterloesung.
 *   - Geprueft werden nur die freigegebenen Steuerwerte (WL); alles andere setzt die Pruefung selbst (FIX), die Vorgaben der Aufgabe werden auf Aenderung geprueft.
 *   - Impulsaufgaben feuern den Impuls in der Pruefung selbst (fire), unabhaengig davon, ob der Nutzer ausgeloest hat.
 * Benoetigt: emvcore.js, emvcore-lay.js und die Pruefstaende schirm, layout, esd, tastkopf, vorpruef (in Node holt sich die Datei fehlende Teile per require).
 * Uebungsanlage: alle Zahlen sind Uebungswerte. Herstellerdokumentation und aktuelle Norm massgeblich. EMV-Massnahmen ersetzen keine Schutzmassnahmen. */
(function (root) {
  'use strict';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.EMV_CORE) { nodeReq('./emvcore.js'); nodeReq('./emvcore-lay.js'); } return root.EMV_CORE || null; };
  const RIGFILES = ['./emvrig-base.js', './emvrig-schirm.js', './emvrig-layout.js', './emvrig-impuls.js', './emvrig-messen.js'];
  const RIGS = id => { let R = root.EMV_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); RIGFILES.forEach(nodeReq); R = root.EMV_RIGS; } return R || null; };
  const fm = (x, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return C.fmt(x, d == null ? 1 : d); return fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '–'; };
  const eng = (x, u) => { const C = CORE(); return C && C.fmtEng ? C.fmtEng(x, u) : fm(x, 3) + ' ' + u; };
  const toNum = v => {
    if (typeof v === 'number') return fin(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && C.parseNum ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const memo = {};
  const once = (k, f) => (k in memo ? memo[k] : (memo[k] = f()));
  const NS = 'Übungsanlage';

  /* ====================================================================== Pruefstand: Eingaben und Simulation */
  const flat = (list, out) => { (Array.isArray(list) ? list : []).forEach(c => { if (c && Array.isArray(c.controls)) flat(c.controls, out); else if (c && typeof c.key === 'string') out.push(c); }); return out; };
  const ctlDefs = id => { const R = RIGS(id); const d = R && R.defs && R.defs[id]; return d ? flat(d.controls, []) : []; };
  const lbl = (id, key) => { const c = ctlDefs(id).find(x => x.key === key); return c && c.label ? c.label : key; };
  function coerce(def, v) {
    if (def.type === 'slider') { const x = toNum(v); return fin(x) ? Math.min(def.max, Math.max(def.min, x)) : undefined; }
    if (def.type === 'switch' || def.type === 'button') return v === undefined || v === null || isObj(v) || Array.isArray(v) ? undefined : !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      return m ? m.value : undefined;
    }
    return v;
  }
  /* freigegebene Steuerwerte aus der Antwort uebernehmen (Rest ignoriert); problems = verstaendliche Texte fuer ungueltige Werte */
  function pick(a, rig, wl) {
    const out = {}, problems = [], map = {};
    ctlDefs(rig).forEach(c => { map[c.key] = c; });
    const src = isObj(a) && isObj(a.controls) ? a.controls : {};
    wl.forEach(k => {
      if (!(k in src)) return;
      if (!map[k]) { problems.push('Den Steuerwert „' + k + '“ gibt es an diesem Prüfstand nicht.'); return; }
      const x = coerce(map[k], src[k]);
      if (x === undefined) problems.push('Der Wert für „' + k + '“ ist ungültig.'); else out[k] = x;
    });
    return { controls: out, problems };
  }
  const FIRST = ['fall', 'pruef', 'modus'];
  const simCache = new Map();
  /* Pruefstand frisch erzeugen, Steuerwerte in fester Reihenfolge setzen (Prueffeld zuerst), bei fire den Impuls ausloesen, Messgeraete, Ampel und Meldungen lesen */
  function build(rigId, ctl, fire) {
    const key = rigId + '|' + (fire ? 'F' : 'n') + '|' + JSON.stringify(Object.keys(ctl).sort().map(k => [k, ctl[k]]));
    if (simCache.has(key)) return simCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId); const rig = R.create(rigId, { seed: 1, noDraw: true });
      Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push(k);
      });
      if (fire && typeof rig.fire === 'function') rig.fire();
      out.rig = rig; out.m = clone(rig.readMeters()); out.as = clone(rig.assess()); out.dg = clone(rig.diagnose() || []); out.ctl = clone(rig.getControls());
      out.ok = true;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message || e)); }
    if (simCache.size > 600) simCache.clear();
    simCache.set(key, out);
    return out;
  }
  /* Auswertung einer Antwort: freigegebene Werte uebernehmen, Rest aus FIX, Pruefstand rechnen */
  function ev(a, rigId, FIX, WL, fire) {
    const p = pick(a, rigId, WL), ctl = Object.assign({}, FIX, p.controls);
    return { p, ctl, sim: build(rigId, ctl, fire) };
  }
  /* erste Zeile jeder Simulationsaufgabe: richtiger Pruefstand, gueltige Eingaben, Lauf ohne Fehlermeldung */
  function inputRow(r, e, a, rigId) {
    const errs = e.p.problems.slice(), sim = e.sim;
    if (sim && sim.errors) sim.errors.forEach(x => errs.push(String(x)));
    if (sim && sim.rejected && sim.rejected.length) errs.push('Der Prüfstand lehnt Werte ab: ' + sim.rejected.join(', ') + '.');
    if (rigId && isObj(a) && typeof a.rig === 'string' && a.rig !== rigId) {
      const R = RIGS(rigId), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
    return errs.length === 0;
  }
  /* Vorgaben der Aufgabe duerfen nicht verstellt sein: keys = Steuerwerte, die gleich FIX bleiben muessen */
  function lockedRow(r, a, rigId, FIX, keys, label) {
    const src = isObj(a) && isObj(a.controls) ? a.controls : {}, bad = [];
    keys.forEach(k => {
      if (!(k in src)) return;
      const def = ctlDefs(rigId).find(c => c.key === k), x = def ? coerce(def, src[k]) : src[k];
      if (x === undefined) return;
      const same = typeof FIX[k] === 'number' ? Math.abs(x - FIX[k]) <= 1e-9 * Math.max(1, Math.abs(FIX[k])) : x === FIX[k];
      if (!same) bad.push('„' + lbl(rigId, k) + '“ steht auf ' + (typeof x === 'number' ? fm(x, 4) : String(x)) + ' statt auf ' + (typeof FIX[k] === 'number' ? fm(FIX[k], 4) : String(FIX[k])));
    });
    r(!bad.length, label, bad.length ? 'Die Vorgabe der Aufgabe wurde verändert: ' + bad.join('; ') + '. Stelle sie wieder ein; die Prüfung rechnet mit dem Wert der Aufgabe.' : '');
  }

  /* ====================================================================== Pruefzeilen */
  function mk(fn) {
    return function (a) {
      try {
        const rows = [], r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
        fn(r, isObj(a) ? a : {});
        if (!rows.length) rows.push({ ok: false, text: 'Die Prüfung hat nichts geprüft', why: 'Bitte melde das deinem Ausbilder.' });
        return rows;
      } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
    };
  }
  const answerNum = a => { if (!isObj(a)) return null; if (fin(a.value)) return a.value; if (typeof a.value === 'string') { const x = toNum(a.value); if (fin(x)) return x; } const t = toNum(a.text); return fin(t) ? t : null; };
  const fieldNum = (a, k) => { if (!isObj(a) || !isObj(a.fields)) return null; const v = a.fields[k]; const x = fin(v) ? v : toNum(v); return fin(x) ? x : null; };
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);
  const valOf = (a, key) => (key === 'value' ? answerNum(a) : fieldNum(a, key));
  const relNear = (x, w, tol) => Math.abs(x - w) <= tol * Math.abs(w) + 1e-12;
  /* Zahlenzeile: want = Sollwert, o = { tol (relativ), abs (absolut), alts, unit, mistakes:[[Fehlerwert, Satzteil nach "bei der"]] }; Fehler wird nur genannt, wenn der Wert auf 3 % passt */
  function numRow(r, label, v, want, o) {
    o = o || {};
    const tol = o.tol != null ? o.tol : 0.03, abs = fin(o.abs) ? o.abs : null, unit = o.unit ? ' ' + o.unit : '';
    const wants = [want].concat(o.alts || []).filter(fin);
    const near = (x, w) => (abs != null ? Math.abs(x - w) <= abs + 1e-9 : relNear(x, w, tol));
    const tolTxt = abs != null ? 'Toleranz ±' + fm(abs) + (o.unit ? ' ' + o.unit : '') : 'Toleranz ' + fm(tol * 100, 0) + ' %';
    if (!fin(v)) { r(false, label + ' (' + tolTxt + ')', 'Trage hier eine Zahl ein (Komma oder Punkt).'); return false; }
    const ok = wants.some(w => near(v, w));
    let why = '';
    if (!ok) {
      const best = wants.reduce((b, w) => (Math.abs(v - w) < Math.abs(v - b) ? w : b), wants[0]);
      why = 'Dein Wert ' + fm(v, 2) + unit + ' ist ' + (v < best ? 'zu klein' : 'zu groß') + '.';
      const hits = (o.mistakes || []).filter(m => fin(m[0]) && m[0] !== 0 && relNear(v, m[0], 0.03)).map(m => m[1]);
      why += hits.length ? ' Dein Wert entspricht einer Rechnung, bei der ' + hits.join(' – oder bei der ') + '.' : ' Lies den Wert noch einmal am Prüfstand ab.';
    }
    r(ok, label + ' (' + tolTxt + ')', why);
    return ok;
  }
  const tbl = (caption, head, rows) => ({ caption, head, rows });
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const KRIT = { A: 'Kriterium A', B: 'Kriterium B', C: 'Kriterium C', Ausfall: 'Ausfall' };
  const KR = ['A', 'B', 'C', 'Ausfall'];
  const kritOf = m => KR[Math.max(0, Math.min(3, Math.round(m.kriterium || 0)))];
  const exNum = x => { const s = String(+(+x).toPrecision(12)); return /e/i.test(s) ? (+x).toFixed(12) : s; };

  /* ====================================================================== em17: Rechner LC, RC, Daempfung */
  const M17 = (() => {
    const KINDS = [['fRes', 1, 'Resonanzfrequenz f0 des LC-Kreises'], ['fgRC', 1, 'Grenzfrequenz fg des RC-Tiefpasses'], ['ilRC', 1, 'Dämpfung des RC-Tiefpasses']];
    const ex = i => once('ex17' + i, () => CORE().exercise(KINDS[i][0], KINDS[i][1]));
    const vals = () => once('v17', () => { const e = [0, 1, 2].map(ex); return { f0: e[0].answer.value, fg: e[1].answer.value, il: e[2].answer.value, L: e[0].given.L * 1e6, C: e[0].given.C * 1e9, R: e[1].given.R, C2: e[1].given.C * 1e9, fgIn: e[2].given.fg / 1e3, fIn: e[2].given.f / 1e3, omega: e[0].wrong && e[0].wrong[0] ? e[0].wrong[0].v : NaN }; });
    const fields = () => KINDS.map((k, i) => ({ key: 'f' + (i + 1), label: 'Aufgabe ' + (i + 1) + ': ' + k[2], unit: ex(i).answer.unit }));
    const check = mk((r, a) => {
      KINDS.forEach((k, i) => {
        const e = ex(i), v = fieldNum(a, 'f' + (i + 1)), tolTxt = e.answer.tolType === 'abs' ? 'Toleranz ±' + fm(e.answer.tol) + ' ' + e.answer.unit : 'Toleranz ' + fm(e.answer.tol * 100, 0) + ' %';
        const label = 'Aufgabe ' + (i + 1) + ': ' + k[2] + ' in ' + e.answer.unit + ' (' + tolTxt + ')';
        if (v === null) { r(false, label, 'Trage hier eine Zahl ein (Komma oder Punkt).'); return; }
        const c = e.check(exNum(v));
        r(!!c.ok, label, c.ok ? '' : String(c.text || ''));
      });
    });
    return { vals, fields, check, ex,
      text() { return 'Rechne drei Aufgaben zur Filterauslegung (Übungswerte):\n' + [0, 1, 2].map(i => (i + 1) + '. ' + ex(i).question).join('\n') + '\nTrage die Ergebnisse in das Antwortblatt ein (Dezimalkomma oder -punkt). Der Rechner im Tab „Rechner“ rechnet mit denselben Formeln.'; },
      hint() { return [
        'Ein LC-Kreis schwingt bei der Frequenz, bei der Spule und Kondensator gleich große Blindwiderstände haben. Beim RC-Tiefpass sinkt der Pegel oberhalb der Grenzfrequenz mit 20 dB je Dekade. Achte immer auf den Faktor 2π: Er trennt die Kreisfrequenz von der Frequenz.',
        '1. ' + ex(0).steps[0] + ': ' + ex(0).steps[1] + '. 2. ' + ex(1).steps[0] + ': ' + ex(1).steps[1] + '. 3. ' + ex(2).steps[0] + ' (die Aufgabe nennt die Ordnung nicht: Rechne mit dem Tiefpass 1. Ordnung, wie in der Aufgabe beschrieben).',
        'Musterlösung: f0 = ' + fm(ex(0).answer.value, 1) + ' ' + ex(0).answer.unit + ', fg = ' + fm(ex(1).answer.value, 1) + ' ' + ex(1).answer.unit + ', Dämpfung = ' + fm(ex(2).answer.value, 1) + ' ' + ex(2).answer.unit + '. ' + ex(0).steps[2] + '; ' + ex(1).steps[2] + '; ' + ex(2).steps[2] + '.'
      ]; } };
  })();

  /* ====================================================================== em18: Schlitz verkuerzen */
  const M18 = (() => {
    const FIX = { mat: 'alu', t: 0.001, f: 3e8, feld: 'fern', holes: 0, dhole: 0.005, rsq: 0.1, r: 0.1, kabel: '360', lp: 0.03, ish: 0.0005, seReq: 40, uInReq: 60 };
    const START = { slot: 0.1 }, MUSTER = { slot: 0.003 }, WL = ['slot'];
    const run = (over) => build('schirm', Object.assign({}, FIX, over));
    const vals = () => once('v18', () => {
      const C = CORE(), st = run(START).m, mu = run(MUSTER).m, lam = C.C0 / FIX.f;
      const lMax = lam / 2 / Math.pow(10, FIX.seReq / 20);
      return { f: FIX.f / 1e6, req: FIX.seReq, slot0: START.slot * 1e3, seStart: st.seSlot, slotM: MUSTER.slot * 1e3, seM: mu.seSlot, resM: mu.seSlot - FIX.seReq, lamHalf: lam / 2 * 1e3, lMax: lMax * 1e3, seAt20: run({ slot: 0.02 }).m.seSlot, reserve: 3 };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'schirm', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'schirm')) return;
      lockedRow(r, a, 'schirm', FIX, ['f', 'seReq', 'feld'], 'Frequenz, Vorgabe und Feldart sind unverändert');
      const m = e.sim.m, slot = e.ctl.slot;
      const hasSlot = slot > 1e-9;
      r(!hasSlot || m.seSlot >= v.req - 1e-9, 'Schirmdämpfung des Schlitzes bei ' + fm(v.f, 0) + ' MHz mindestens ' + fm(v.req, 0) + ' dB',
        'Dein Schlitz (' + fm(slot * 1e3, 1) + ' mm) schirmt nur ' + fm(m.seSlot, 1) + ' dB, verlangt sind ' + fm(v.req, 0) + ' dB. Der Schlitz ist noch zu lang.');
      r(m.seGes >= v.req - 1e-9, 'Gesamt-Schirmdämpfung mindestens ' + fm(v.req, 0) + ' dB', 'Die Gesamt-Schirmdämpfung beträgt ' + fm(m.seGes, 1) + ' dB, verlangt sind ' + fm(v.req, 0) + ' dB.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Ein Aluminiumgehäuse (' + NS + ', Blech ' + fm(FIX.t * 1e3, 1) + ' mm) schirmt eine Störquelle bei ' + fm(v.f, 0) + ' MHz. Es hat einen Schlitz von ' + fm(v.slot0, 0) + ' mm Länge, durch den die Störung nach außen dringt. Verkürze den Schlitz so, dass seine Schirmdämpfung bei ' + fm(v.f, 0) + ' MHz mindestens ' + fm(v.req, 0) + ' dB erreicht. Frequenz und Vorgabe bleiben unverändert. Stelle dazu die Schlitzlänge am Prüfstand „Schirmung“ ein und lies die Schirmdämpfung des Schlitzes ab.'; },
      hint() { const v = vals(); return [
        'Ein Schlitz schirmt umso schlechter, je länger er im Vergleich zur Wellenlänge ist. Als Faustformel gilt SE = 20·lg(λ / (2·ℓ)); ab einer Schlitzlänge von λ/2 schirmt er gar nicht mehr (Faustformel, Gültigkeitsgrenzen beachten).',
        'Bei ' + fm(v.f, 0) + ' MHz ist λ/2 = ' + fm(v.lamHalf, 0) + ' mm. Für ' + fm(v.req, 0) + ' dB darf der Schlitz höchstens ℓ = λ/2 / 10^(' + fm(v.req, 0) + '/20) = ' + fm(v.lMax, 1) + ' mm lang sein. Zum Vergleich: ' + fm(v.slot0, 0) + ' mm schirmen ' + fm(v.seStart, 1) + ' dB, 20 mm schirmen ' + fm(v.seAt20, 1) + ' dB.',
        'Musterlösung: Schlitz auf ' + fm(v.slotM, 0) + ' mm kürzen. Der Prüfstand zeigt dann ' + fm(v.seM, 1) + ' dB, das sind ' + fm(v.resM, 1) + ' dB Reserve über der Vorgabe.'
      ]; } };
  })();

  /* ====================================================================== em19: Material und Dicke im Magnetfeld */
  const M19 = (() => {
    const FIX = { feld: 'hnah', r: 0.1, f: 1e4, rsq: 0.1, slot: 0, holes: 0, dhole: 0.005, kabel: '360', lp: 0.03, ish: 0.0005, seReq: 60, uInReq: 60 };
    const START = { mat: 'alu', t: 0.0002 }, MUSTER = { mat: 'stahl', t: 0.0008 }, WL = ['mat', 't'], TMAX = 0.001;
    const run = (mat, t) => build('schirm', Object.assign({}, FIX, { mat, t })).m;
    const vals = () => once('v19', () => {
      const mu = run(MUSTER.mat, MUSTER.t), st = run(START.mat, START.t);
      return { f: FIX.f / 1e3, req: FIX.seReq, tMax: TMAX * 1e3, r: FIX.r * 1e3, seStart: st.seGes, seM: mu.seGes, resM: mu.seGes - FIX.seReq, tM: MUSTER.t * 1e3,
        seCu3: run('kupfer', 0.003).seGes, seAl1: run('alu', TMAX).seGes, seCu1: run('kupfer', TMAX).seGes, seSt1: run('stahl', TMAX).seGes, seSt05: run('stahl', 0.0005).seGes, reserve: 3 };
    });
    const MATN = { kupfer: 'Kupfer', alu: 'Aluminium', stahl: 'Stahl' };
    const check = mk((r, a) => {
      const e = ev(a, 'schirm', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'schirm')) return;
      lockedRow(r, a, 'schirm', FIX, ['f', 'feld', 'r', 'seReq'], 'Frequenz, Feldart, Abstand und Vorgabe sind unverändert');
      const m = e.sim.m, t = e.ctl.t, mat = e.ctl.mat;
      r(!!MATN[mat], 'Material ist ein Blech aus Kupfer, Aluminium oder Stahl', 'Gewählt ist „' + (mat === 'leitlack' ? 'Leitlack' : String(mat)) + '“. Die Aufgabe verlangt ein Blech, dessen Dicke du wählst.');
      r(t <= TMAX + 1e-9, 'Blechdicke höchstens ' + fm(v.tMax, 1) + ' mm', 'Deine Blechdicke ' + fm(t * 1e3, 2) + ' mm ist größer als die erlaubten ' + fm(v.tMax, 1) + ' mm.');
      r(m.seGes >= v.req - 1e-9, 'Schirmdämpfung im Magnetfeld bei ' + fm(v.f, 0) + ' kHz mindestens ' + fm(v.req, 0) + ' dB', 'Dein Aufbau (' + (MATN[mat] || mat) + ', ' + fm(t * 1e3, 2) + ' mm) erreicht ' + fm(m.seGes, 1) + ' dB, verlangt sind ' + fm(v.req, 0) + ' dB.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Ein Netztrafo erzeugt ein niederfrequentes Magnetfeld (' + fm(v.f, 0) + ' kHz, Nahfeld, Abstand ' + fm(v.r, 0) + ' mm; ' + NS + '). Ein Blech soll es abschirmen: Wähle Material (Kupfer, Aluminium oder Stahl) und Dicke so, dass die Schirmdämpfung mindestens ' + fm(v.req, 0) + ' dB beträgt. Das Blech darf höchstens ' + fm(v.tMax, 1) + ' mm dick sein. Feldart, Frequenz und Vorgabe bleiben unverändert. Probiere am Prüfstand „Schirmung“ verschiedene Kombinationen aus.'; },
      hint() { const v = vals(); return [
        'Bei niedriger Frequenz und Magnetfeld schirmt ein dünnes Blech aus Kupfer oder Aluminium kaum, weil die Hauttiefe groß ist und die Reflexion im Magnetfeld klein bleibt. Ein Material mit hoher Permeabilität (Stahl, in der Übungsanlage mit einem festen Wert angenommen) lenkt das Magnetfeld ab und absorbiert es mit wachsender Dicke stark.',
        'Bei ' + fm(v.tMax, 1) + ' mm schirmen Kupfer ' + fm(v.seCu1, 1) + ' dB, Aluminium ' + fm(v.seAl1, 1) + ' dB und Stahl ' + fm(v.seSt1, 1) + ' dB. Kupfer mit 3 mm würde ' + fm(v.seCu3, 1) + ' dB schirmen, wäre aber zu dick. Stahl mit 0,5 mm schirmt nur ' + fm(v.seSt05, 1) + ' dB.',
        'Musterlösung: Stahl, ' + fm(v.tM, 1) + ' mm. Der Prüfstand zeigt ' + fm(v.seM, 1) + ' dB, das sind ' + fm(v.resM, 1) + ' dB Reserve über der Vorgabe.'
      ]; } };
  })();

  /* ====================================================================== em20: Kabelschirm anbinden */
  const M20 = (() => {
    const FIX = { mat: 'alu', t: 0.001, feld: 'fern', slot: 0, holes: 0, dhole: 0.005, rsq: 0.1, r: 0.1, f: 1e8, ish: 0.0005, seReq: 40, uInReq: 60 };
    const START = { kabel: 'pigtail', lp: 0.05 }, MUSTER = { kabel: '360', lp: 0.03 }, WL = ['kabel', 'lp'];
    const run = (kabel, lp) => build('schirm', Object.assign({}, FIX, { kabel, lp })).m;
    const vals = () => once('v20', () => {
      const st = run('pigtail', 0.05), mu = run('360', 0.03);
      let lo = 0, hi = 0.1;   // groesste Litzenlaenge mit uIn <= Vorgabe (uIn waechst mit lp)
      if (run('pigtail', hi).uIn <= FIX.uInReq) lo = hi; else { for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (run('pigtail', mid).uIn <= FIX.uInReq) lo = mid; else hi = mid; } }
      return { f: FIX.f / 1e6, ish: FIX.ish * 1e3, req: FIX.uInReq, lp0: START.lp * 1e3, uStart: st.uIn, uM: mu.uIn, resM: FIX.uInReq - mu.uIn, uPig10: run('pigtail', 0.01).uIn, lpMax: lo * 1e3, reserve: 3 };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'schirm', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'schirm')) return;
      lockedRow(r, a, 'schirm', FIX, ['f', 'ish', 'uInReq'], 'Frequenz, Schirmstrom und Vorgabe sind unverändert');
      const m = e.sim.m;
      r(m.uIn <= v.req + 1e-9, 'Störspannung innen höchstens ' + fm(v.req, 0) + ' dBµV bei ' + fm(v.f, 0) + ' MHz', 'Die Störspannung innen beträgt ' + fm(m.uIn, 1) + ' dBµV, erlaubt sind ' + fm(v.req, 0) + ' dBµV (' + (e.ctl.kabel === 'pigtail' ? 'Schirmlitze ' + fm(e.ctl.lp * 1e3, 1) + ' mm' : '360°-Anbindung') + ').');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Ein geschirmtes Kabel führt bei ' + fm(v.f, 0) + ' MHz einen Schirmstrom von ' + fm(v.ish, 1) + ' mA (' + NS + '). Der Schirm ist als Litze („Pigtail“) von ' + fm(v.lp0, 0) + ' mm Länge an das Gehäuse geführt; innen liegt dadurch eine Störspannung von ' + fm(v.uStart, 1) + ' dBµV. Verringere die Störspannung innen auf höchstens ' + fm(v.req, 0) + ' dBµV, indem du die Schirmanbindung änderst (Art der Anbindung, Länge der Litze). Frequenz und Schirmstrom bleiben unverändert.'; },
      hint() { const v = vals(); return [
        'Der Schirmstrom fließt über die Anbindung und erzeugt an ihrer Kopplungsimpedanz eine Spannung, die als Störung ins Kabel innen gelangt. Eine lange Litze hat Induktivität, also bei hoher Frequenz eine große Kopplungsimpedanz. Eine rundum angeschlossene 360°-Anbindung hat die kleinste.',
        'Mit der Litze (' + fm(v.lp0, 0) + ' mm) liegt die Störspannung innen bei ' + fm(v.uStart, 1) + ' dBµV; mit 10 mm Litze bei ' + fm(v.uPig10, 1) + ' dBµV. Die Litze dürfte höchstens ' + fm(v.lpMax, 1) + ' mm lang sein, um ' + fm(v.req, 0) + ' dBµV einzuhalten.',
        'Musterlösung: Anbindung „360°“. Die Störspannung innen sinkt auf ' + fm(v.uM, 1) + ' dBµV, das sind ' + fm(v.resM, 1) + ' dB Reserve unter der Vorgabe.'
      ]; } };
  })();

  /* ====================================================================== Layout-Aufgaben em21 bis em24 */
  const LAY = root;   // Platzhalter, damit der Block unten kurz bleibt
  const layRun = (fall, over) => build('layout', Object.assign({ fall }, over));
  const lcase = id => { const C = CORE(); return C.layout.caseOf(id); };

  /* em21: Fehler finden im Fall schlitz */
  const M21 = (() => {
    const FALL = 'schlitz', FIX = { fall: FALL }, WL = ['fix1', 'fix2', 'fix3'], DIV = 5;
    const vals = () => once('v21', () => {
      const cs = lcase(FALL), st = layRun(FALL, {}).m, mu = layRun(FALL, { fix2: true }).m, f1 = layRun(FALL, { fix1: true }).m, f3 = layRun(FALL, { fix3: true }).m;
      return { n: cs.defects.length, ids: cs.defects.map(d => d.id), areaStart: st.area, limit: st.area / DIV, areaM: mu.area, resM: 100 * (1 - mu.area / (st.area / DIV)), area1: f1.area, area3: f3.area, div: DIV, f0: 100 };
    });
    const centres = () => lcase(FALL).defects.map(d => ({ id: d.id, x: d.rect[0] + d.rect[2] / 2, y: d.rect[1] + d.rect[3] / 2 }));
    const check = mk((r, a) => {
      const e = ev(a, 'layout', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'layout')) return;
      const clicks = Array.isArray(a.clicks) ? a.clicks : [], found = new Set();
      clicks.forEach(c => { if (isObj(c) && (c.fall === undefined || c.fall === FALL) && typeof c.hit === 'string' && v.ids.includes(c.hit)) found.add(c.hit); });
      r(found.size === v.n, 'Du hast alle ' + v.n + ' Fehler im Fallbild angetippt', 'Du hast ' + found.size + ' von ' + v.n + ' Fehlern gefunden. Tippe im Tab „Layout-Fälle“ auf die Stellen, an denen etwas schiefläuft (Schlitz, Umweg des Rückstroms, Querung).');
      const m = e.sim.m;
      r(m.area <= v.limit + 1e-9, 'Schleifenfläche höchstens ein Fünftel der Startfläche (' + fm(v.limit, 1) + ' mm²)', 'Die Schleifenfläche beträgt ' + fm(m.area, 1) + ' mm², erlaubt sind ' + fm(v.limit, 1) + ' mm² (Start ' + fm(v.areaStart, 1) + ' mm²). Es fehlt noch eine wirksame Maßnahme.');
    });
    return { FALL, FIX, WL, vals, check, centres,
      text() { const v = vals(); return 'Die Leiterbahn in diesem Fall quert einen Schlitz in der Massefläche (' + NS + ', Taktfrequenz ' + fm(v.f0, 0) + ' MHz). Die Schleifenfläche des Rückstroms beträgt zu Beginn ' + fm(v.areaStart, 1) + ' mm². Finde die ' + v.n + ' Fehler (tippe sie im Tab „Layout-Fälle“ an) und behebe sie mit den Maßnahmen des Falls, bis die Schleifenfläche auf höchstens ein Fünftel gesunken ist (höchstens ' + fm(v.limit, 1) + ' mm²).'; },
      hint() { const v = vals(); return [
        'Der Hochfrequenz-Rückstrom fließt auf der Massefläche direkt unter der Leiterbahn zurück. Fehlt dort die Fläche (Schlitz), muss er einen Umweg gehen, und die Schleife, die als Antenne wirkt, wird groß. Suche die Stellen, an denen die Bahn den Schlitz quert, wo der Rückstrom herumläuft und wo der Schlitz überhaupt entstanden ist.',
        'Startfläche ' + fm(v.areaStart, 1) + ' mm², Ziel höchstens ein Fünftel = ' + fm(v.limit, 1) + ' mm². Die Maßnahme „Bahn umlegen“ allein ergibt ' + fm(v.area1, 1) + ' mm² (zu viel), der „Brücken-Kondensator“ ' + fm(v.area3, 1) + ' mm².',
        'Musterlösung: Schlitz schließen (Maßnahme 2). Die Fläche sinkt auf ' + fm(v.areaM, 1) + ' mm², das sind ' + fm(v.resM, 0) + ' % unter der Grenze. Die Fehler liegen an den drei markierten Stellen des Falls.'
      ]; } };
  })();

  /* em22: Abblockkondensator */
  const M22 = (() => {
    const FALL = 'abblock-weit', FIX = { fall: FALL }, WL = ['fix1', 'fix2'];
    const vals = () => once('v22', () => {
      const st = layRun(FALL, {}).m, mu = layRun(FALL, { fix1: true, fix2: true }).m, f1 = layRun(FALL, { fix1: true }).m, f2 = layRun(FALL, { fix2: true }).m;
      return { lStart: st.lloop, zStart: st.z100, lM: mu.lloop, zM: mu.z100, lMax: mu.lloop * 1.25, l1: f1.lloop, l2: f2.lloop, z1: f1.z100, f0: 100 };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'layout', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'layout')) return;
      const m = e.sim.m;
      r(m.lloop <= v.lMax + 1e-9, 'Schleifeninduktivität höchstens ' + fm(v.lMax, 2) + ' nH (Musterlösung plus 25 %)', 'Die Schleifeninduktivität beträgt ' + fm(m.lloop, 2) + ' nH, erlaubt sind ' + fm(v.lMax, 2) + ' nH (Start ' + fm(v.lStart, 1) + ' nH).');
      r(m.z100 < v.zStart - 1e-9, 'Impedanz der Versorgung bei ' + fm(v.f0, 0) + ' MHz kleiner als zu Beginn (' + fm(v.zStart, 1) + ' Ω)', 'Die Impedanz bei ' + fm(v.f0, 0) + ' MHz beträgt ' + fm(m.z100, 1) + ' Ω und liegt nicht unter dem Startwert ' + fm(v.zStart, 1) + ' Ω.');
    });
    return { FALL, FIX, WL, vals, check,
      text() { const v = vals(); return 'Der Abblockkondensator dieser Platine sitzt weit vom Versorgungspin des ICs (Fall „Abblockkondensator weit vom IC“, ' + NS + '). Die Zuleitung gehört zur Stromschleife: Die Schleifeninduktivität beträgt ' + fm(v.lStart, 1) + ' nH, die Impedanz der Versorgung bei ' + fm(v.f0, 0) + ' MHz ' + fm(v.zStart, 1) + ' Ω. Setze die Maßnahmen des Falls so ein, dass die Schleifeninduktivität höchstens ' + fm(v.lMax, 2) + ' nH beträgt (Musterlösung plus 25 %) und die Impedanz bei ' + fm(v.f0, 0) + ' MHz sinkt.'; },
      hint() { const v = vals(); return [
        'Jeder Millimeter Zuleitung bringt Induktivität in die Schleife. Der Kondensator wirkt bei hohen Frequenzen nur, wenn er unmittelbar am Versorgungspin sitzt und sein Anschluss kurz ist. Vias in Reihe addieren ihre Induktivität.',
        'Start: ' + fm(v.lStart, 1) + ' nH und ' + fm(v.zStart, 1) + ' Ω. Nur die Via-Maßnahme senkt die Schleifeninduktivität kaum (' + fm(v.l2, 1) + ' nH). Den Kondensator an den Pin zu setzen ergibt ' + fm(v.l1, 2) + ' nH und ' + fm(v.z1, 1) + ' Ω.',
        'Musterlösung: beide Maßnahmen. Schleifeninduktivität ' + fm(v.lM, 2) + ' nH, Impedanz bei ' + fm(v.f0, 0) + ' MHz ' + fm(v.zM, 1) + ' Ω. Die Grenze ist die Musterlösung plus 25 % = ' + fm(v.lMax, 2) + ' nH.'
      ]; } };
  })();

  /* em23: Lagenaufbau, Differenz in dB */
  const M23 = (() => {
    const FALL = 'lagen', FIX = { fall: FALL }, WL = ['stack'];
    const vals = () => once('v23', () => {
      const e2 = layRun(FALL, { stack: '2' }).m, eg = layRun(FALL, { stack: '2gnd' }).m, e4 = layRun(FALL, { stack: '4' }).m;
      return { eg: eg.eDb, e4: e4.eDb, diff: eg.eDb - e4.eDb, e2: e2.eDb, diff24: e2.eDb - e4.eDb, diff2g: e2.eDb - eg.eDb, i: layRun(FALL, {}).ctl.i, f: layRun(FALL, {}).ctl.f / 1e6, tol: 0.5 };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'layout', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'layout')) return;
      numRow(r, 'Abnahme der Abstrahlung von „zwei Lagen mit Massefläche“ auf „vier Lagen“ in dB', answerNum(a), v.diff, { abs: v.tol, unit: 'dB', mistakes: [
        [v.diff24, 'du von „zwei Lagen ohne Massefläche“ auf vier Lagen verglichen hast (Ausgangsaufbau falsch)'], [v.diff2g, 'du von „zwei Lagen ohne Massefläche“ auf „zwei Lagen mit Massefläche“ verglichen hast'], [-v.diff, 'du das Vorzeichen vertauscht hast (die Abstrahlung sinkt, gib die Abnahme positiv an)']] });
    });
    return { FALL, FIX, WL, vals, check,
      text() { const v = vals(); return 'Dieselbe Schaltung (Fall „Lagenaufbau“, ' + fm(v.i, 1) + ' mA Spitzenstrom, ' + fm(v.f, 0) + ' MHz, ' + NS + ') kann auf einer Platine mit zwei Lagen und Massefläche („2gnd“) oder mit vier Lagen („4“) aufgebaut werden. Um wie viel dB sinkt die Abstrahlung, wenn du von „2gnd“ auf „4“ wechselst (gleicher Strom)? Stelle beide Lagenaufbauten am Prüfstand „Layout“ ein und lies die Abstrahlung (Pegel in dB) ab. Gib die Abnahme als positive Zahl in dB an.'; },
      hint() { const v = vals(); return [
        'Bei vier Lagen liegt die Massefläche dicht unter der Signallage. Der Lagenabstand h bestimmt die Schleifenfläche (A = Länge mal h) und damit die Abstrahlung. Die Abnahme ist die Differenz der beiden Pegel in dB (Pegel vorher minus Pegel nachher).',
        'Die Abstrahlung beträgt bei „2gnd“ ' + fm(v.eg, 1) + ' dB und bei „4“ ' + fm(v.e4, 1) + ' dB. Zum Vergleich: ohne Massefläche („2“) wären es ' + fm(v.e2, 1) + ' dB.',
        'Musterlösung: ' + fm(v.eg, 1) + ' dB − ' + fm(v.e4, 1) + ' dB = ' + fm(v.diff, 1) + ' dB. Die Abstrahlung sinkt also um ' + fm(v.diff, 1) + ' dB.'
      ]; } };
  })();

  /* em24: Meisterstueck Schaltregler */
  const M24 = (() => {
    const FALL = 'schaltreg', FIX = { fall: FALL }, WL = ['fix1', 'fix2', 'fix3'], MUSTER = { fix1: true, fix2: true }, MARGIN = 6;
    const vals = () => once('v24', () => {
      const st = layRun(FALL, {}).m, mu = layRun(FALL, MUSTER).m, f1 = layRun(FALL, { fix1: true }).m, f2 = layRun(FALL, { fix2: true }).m;
      return { aStart: st.area, aM: mu.area, aMax: mu.area * 1.25, mStart: st.margin, mM: mu.margin, margin: MARGIN, a1: f1.area, a2: f2.area, m1: f1.margin, m2: f2.margin };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'layout', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'layout')) return;
      const m = e.sim.m;
      r(m.area <= v.aMax + 1e-9, 'Hot-Loop-Fläche höchstens ' + fm(v.aMax, 1) + ' mm² (Musterlösung plus 25 %)', 'Die Hot-Loop-Fläche beträgt ' + fm(m.area, 1) + ' mm², erlaubt sind ' + fm(v.aMax, 1) + ' mm² (Start ' + fm(v.aStart, 1) + ' mm²).');
      r(m.margin >= v.margin - 1e-9, 'Abstrahlung mindestens ' + fm(v.margin, 0) + ' dB unter der Übungsgrenzlinie (Faustregel für die Marge)', 'Die Marge beträgt ' + fm(m.margin, 1) + ' dB, verlangt sind mindestens ' + fm(v.margin, 0) + ' dB.');
      r(e.sim.as.ampel === 'gruen', 'Die Ampel des Prüfstands zeigt grün', 'Die Ampel steht auf „' + String(e.sim.as.ampel) + '“.');
    });
    return { FALL, FIX, WL, MUSTER, vals, check,
      text() { const v = vals(); return 'Meisterstück: Ein Schaltregler (Fall „Schaltregler“, ' + NS + ') strahlt über die Hot-Loop, die Stromschleife aus Eingangskondensator, Schalter und Diode. Zu Beginn beträgt ihre Fläche ' + fm(v.aStart, 1) + ' mm², die Marge zur Übungsgrenzlinie ' + fm(v.mStart, 1) + ' dB. Minimiere die Hot-Loop-Fläche mit den Maßnahmen des Falls: höchstens ' + fm(v.aMax, 1) + ' mm² (Musterlösung plus 25 %), die Abstrahlung soll mindestens ' + fm(v.margin, 0) + ' dB unter der Grenzlinie liegen (Faustregel) und die Ampel grün zeigen.'; },
      hint() { const v = vals(); return [
        'Die Hot-Loop führt den schnell schaltenden Strom. Je kleiner ihre Fläche, desto kleiner die Abstrahlung. Zwei Hebel wirken: den Eingangskondensator unmittelbar an den Schalter setzen und den Rückleiter eng unter oder neben den Hinleiter führen.',
        'Start: ' + fm(v.aStart, 1) + ' mm², Marge ' + fm(v.mStart, 1) + ' dB. Nur Maßnahme 1: ' + fm(v.a1, 1) + ' mm² (Marge ' + fm(v.m1, 1) + ' dB). Nur Maßnahme 2: ' + fm(v.a2, 1) + ' mm² (Marge ' + fm(v.m2, 1) + ' dB). Die Grenze ist ' + fm(v.aMax, 1) + ' mm².',
        'Musterlösung: Maßnahme 1 und 2 zusammen. Hot-Loop-Fläche ' + fm(v.aM, 1) + ' mm², Marge ' + fm(v.mM, 1) + ' dB.'
      ]; } };
  })();

  /* ====================================================================== Impuls-Aufgaben em25, em26, em27, em31 */
  const dev = () => CORE().device.params;
  /* em25: ESD 4 kV auf den Pin */
  const M25 = (() => {
    const FIX = { pruef: 'esdk', kv: 4, ort: 'io', masse: 'g50', frep: 5000 };
    const START = { schutz: 'kein' }, MUSTER = { schutz: 'tvsrs', tvs: 'tvs5', rs: 100 }, WL = ['schutz', 'tvs', 'rs', 'cbuf'];
    const run = o => build('esd', Object.assign({}, FIX, o), true);
    const vals = () => once('v25', () => {
      const st = run(START).m, mu = run(MUSTER).m, d = dev(), tvsOnly = run({ schutz: 'tvs', tvs: 'tvs5' }).m, tvs24 = run({ schutz: 'tvs', tvs: 'tvs24' }).m;
      let bestA = false;   // keine Schutzschaltung der Anlage erreicht Kriterium A am Pin (Grundlage der Aufgabenstellung)
      ['kein', 'rc', 'tvs', 'tvsrs'].forEach(s => ['tvs3', 'tvs5', 'tvs12', 'tvs24'].forEach(t => [10, 47, 100, 330, 1000].forEach(rs => [1e-10, 1e-9, 1e-8, 1e-7].forEach(cb => { if (kritOf(run({ schutz: s, tvs: t, rs, cbuf: cb }).m) === 'A') bestA = true; }))));
      return { kv: FIX.kv, vabs: d.vabs, vStart: st.vq, vM: mu.vq, resM: d.vabs - mu.vq, vTvs: tvsOnly.vq, vTvs24: tvs24.vq, kM: kritOf(mu), kStart: kritOf(st), aMoeglich: bestA };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'esd', FIX, WL, true), v = vals();
      if (!inputRow(r, e, a, 'esd')) return;
      lockedRow(r, a, 'esd', FIX, ['pruef', 'kv', 'ort'], 'Prüfart, Prüfpegel und Einkoppelort sind unverändert');
      const m = e.sim.m, k = kritOf(m);
      r(m.vq <= v.vabs + 1e-9, 'Spitze am Controller-Eingang höchstens ' + fm(v.vabs, 1) + ' V (höchstzulässige Spannung des Controllers)', 'Die Spitze am Eingang beträgt ' + fm(m.vq, 1) + ' V, höchstzulässig sind ' + fm(v.vabs, 1) + ' V. Der Controller würde zerstört.');
      r(k === 'A' || k === 'B', 'Das Gerät erreicht höchstens Kriterium B (es wird nicht zerstört)', 'Der Prüfstand bewertet nach der Entladung: ' + KRIT[k] + '.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Eine Prüfperson entlädt sich mit ' + fm(v.kv, 0) + ' kV (ESD, Kontakt) auf einen Stecker-Pin des Geräts (' + NS + '). Ohne Schutz erreicht die Spitze am Controller-Eingang ' + fm(v.vStart, 1) + ' V; der Controller verträgt höchstens ' + fm(v.vabs, 1) + ' V. Wähle den Schutz am Pin (Schutzart, TVS-Typ, Reihenwiderstand) so, dass der Controller nicht zerstört wird und das Gerät höchstens Kriterium B zeigt. Kriterium A ist in dieser Übungsanlage am Pin mit den angebotenen Bauteilen nicht erreichbar. Prüfart, Pegel und Einkoppelort bleiben unverändert. Löse die Entladung am Prüfstand „Impulse“ aus und lies Spitze und Kriterium ab.'; },
      hint() { const v = vals(); return [
        'Eine TVS-Diode klemmt die Spannung, ihr Typ nennt die Spannungsklasse: je höher, desto weniger schützt sie. Ein Reihenwiderstand vor dem Eingang begrenzt zusätzlich den Strom und senkt die Spitze am Controller. Beide zusammen wirken meist besser als eine allein.',
        'Ohne Schutz: ' + fm(v.vStart, 1) + ' V. Nur TVS 5 V: ' + fm(v.vTvs, 1) + ' V (zu hoch). Nur TVS 24 V: ' + fm(v.vTvs24, 1) + ' V. Die Grenze des Controllers ist ' + fm(v.vabs, 1) + ' V.',
        'Musterlösung: TVS mit Reihenwiderstand (TVS 5 V, 100 Ω). Spitze ' + fm(v.vM, 1) + ' V, das sind ' + fm(v.resM, 1) + ' V Reserve unter der Grenze; Bewertung: ' + KRIT[v.kM] + '.'
      ]; } };
  })();

  /* em26: Burst, Treppe */
  const M26 = (() => {
    const FIX = { pruef: 'burst', kv: 1, ort: 'netzln', masse: 'g50', frep: 5000 };
    const START = { schutz: 'kein' }, MUSTER = { schutz: 'rc', rs: 100, cbuf: 1e-7 }, WL = ['schutz', 'tvs', 'rs', 'cbuf'];
    const run = o => build('esd', Object.assign({}, FIX, o), true);
    const vals = () => once('v26', () => {
      const st = run(START).m, mu = run(MUSTER).m, d = dev(), lo = run({ schutz: 'rc', rs: 100, cbuf: 1e-8 }).m, tv = run({ schutz: 'tvs', tvs: 'tvs3' }).m;
      return { kv: FIX.kv, frep: FIX.frep / 1e3, n: 75, vih: d.vih, nGStart: st.nGlitch, kStart: kritOf(st), vM: mu.vq, resM: d.vih - mu.vq, kM: kritOf(mu), nGlo: lo.nGlitch, kLo: kritOf(lo), cLo: 10, cM: 100, kTvs: kritOf(tv), nGtvs: tv.nGlitch };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'esd', FIX, WL, true), v = vals();
      if (!inputRow(r, e, a, 'esd')) return;
      lockedRow(r, a, 'esd', FIX, ['pruef', 'kv', 'ort', 'frep'], 'Prüfart, Prüfpegel, Einkoppelort und Wiederholrate sind unverändert');
      const m = e.sim.m, k = kritOf(m);
      r(m.nGlitch === 0, 'Kein Impuls des Bursts lässt die Leitung über die Eingangsschwelle ' + fm(v.vih, 2) + ' V steigen', m.nGlitch + ' von ' + v.n + ' Impulsen lassen die Leitung über ' + fm(v.vih, 2) + ' V liegen (Spitze der Treppe ' + fm(m.vq, 2) + ' V).');
      r(k === 'A', 'Das Gerät erreicht Kriterium A', 'Der Prüfstand bewertet: ' + KRIT[k] + '.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Auf der Leitung des Geräts (Einkoppelort Netz L–N, ' + NS + ') liegt ein Burst von ' + fm(v.kv, 0) + ' kV mit ' + fm(v.frep, 0) + ' kHz Wiederholrate (' + v.n + ' Impulse je Burst). Ohne Schutz ' + (v.nGStart > 0 ? 'liegt die Leitung bei ' + v.nGStart + ' von ' + v.n + ' Impulsen über der Eingangsschwelle ' + fm(v.vih, 2) + ' V, die Bewertung ist ' + KRIT[v.kStart] : 'liegt die Bewertung bei ' + KRIT[v.kStart]) + '. Beseitige das Problem mit dem RC-Glied (Schutz „RC-Glied“: Reihenwiderstand und Puffer-C) so, dass kein Impuls die Eingangsschwelle überschreitet und das Gerät Kriterium A erreicht. Prüfart, Pegel, Einkoppelort und Wiederholrate bleiben unverändert.'; },
      hint() { const v = vals(); return [
        'Die Impulse eines Bursts folgen so dicht aufeinander, dass sich ihre Spannung am Eingang zu einer Treppe addiert, bevor die Ladung abfließen kann. Ein Puffer-Kondensator nimmt die Ladung jedes Impulses auf und hält die Treppe niedrig.',
        'Ohne Schutz: ' + v.nGStart + ' von ' + v.n + ' Impulsen über der Schwelle (' + fm(v.vih, 2) + ' V). Mit ' + fm(v.cLo, 0) + ' nF Puffer-C bleiben es ' + v.nGlo + ' Impulse (' + KRIT[v.kLo] + '). Eine TVS-Diode allein hilft nicht (' + v.nGtvs + ' Impulse, ' + KRIT[v.kTvs] + ').',
        'Musterlösung: RC-Glied mit ' + fm(v.cM, 0) + ' nF Puffer-C. Die Spitze der Treppe liegt bei ' + fm(v.vM, 2) + ' V, das sind ' + fm(v.resM, 2) + ' V unter der Schwelle; Bewertung: ' + KRIT[v.kM] + '.'
      ]; } };
  })();

  /* em27: Surge und Varistor */
  const M27 = (() => {
    const FIX = { pruef: 'surge', kv: 1, ort: 'netzln', masse: 'g50', frep: 5000 }, VMAX = 800;   // Vorgabe der Aufgabe in V, kein Normwert
    const START = { schutz: 'kein' }, MUSTER = { schutz: 'varistor', var: 'v275' }, WL = ['schutz', 'var'];
    const run = o => build('esd', Object.assign({}, FIX, o), true);
    const hasDauer = s => (s.dg || []).some(d => d.id === 'var-dauer');
    const vals = () => once('v27', () => {
      const C = CORE(), vMuster = run(MUSTER), v230 = run({ schutz: 'varistor', var: 'v230' }), v320 = run({ schutz: 'varistor', var: 'v320' }), st = run(START);
      const txt = (v230.dg.find(d => d.id === 'var-dauer') || {}).text || '', mm = /Dauerspannung ([0-9]+) V/.exec(txt);
      const sp = V => C.protect.surge({ kV: FIX.kv, zi: 2, var: V });
      return { kv: FIX.kv, vmax: VMAX, vac: mm ? +mm[1] : NaN, vStart: st.m.vq, vM: vMuster.m.vq, resM: VMAX - vMuster.m.vq, v230: v230.m.vq, v320: v320.m.vq, wM: vMuster.m.wVar, wLim: sp('v275').wLimit, kM: kritOf(vMuster.m), vac230: C.protect.parts.var.v230.vacMax, vac275: C.protect.parts.var.v275.vacMax, vac320: C.protect.parts.var.v320.vacMax };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'esd', FIX, WL, true), v = vals();
      if (!inputRow(r, e, a, 'esd')) return;
      lockedRow(r, a, 'esd', FIX, ['pruef', 'kv', 'ort'], 'Prüfart, Prüfpegel und Einkoppelort sind unverändert');
      const s = e.sim, m = s.m;
      r(e.ctl.schutz === 'varistor', 'Am Netzeingang ist ein Varistor eingesetzt', 'Der Schutz steht auf „' + String(e.ctl.schutz) + '“. Wähle „Varistor am Netzeingang“ und einen Typ.');
      if (e.ctl.schutz !== 'varistor') { r(false, 'Die Dauerspannung liegt unter der Dauerspannungsgrenze des Varistors', 'Ohne Varistor gibt es nichts zu prüfen.'); r(false, 'Spannung hinter dem Varistor höchstens ' + fm(v.vmax, 0) + ' V', 'Ohne Varistor liegt die volle Spitze von ' + fm(m.vq, 0) + ' V am Gerät.'); return; }
      const dauer = hasDauer(s), part = CORE().protect.parts.var[e.ctl.var];
      r(!dauer, 'Die Dauerspannung ' + fm(v.vac, 0) + ' V liegt unter der Dauerspannungsgrenze des Varistors (keine Warnung „Dauerspannung“)', 'Die Dauerspannung ' + fm(v.vac, 0) + ' V liegt über der Dauerspannungsgrenze des Varistors (' + fm(part ? part.vacMax : NaN, 0) + ' V): Er wird warm und altert.');
      r(m.vq <= v.vmax + 1e-9, 'Spannung hinter dem Varistor höchstens ' + fm(v.vmax, 0) + ' V', 'Die Spannung hinter dem Varistor beträgt ' + fm(m.vq, 0) + ' V, erlaubt sind ' + fm(v.vmax, 0) + ' V.');
      const lim = CORE().protect.surge({ kV: FIX.kv, zi: 2, var: e.ctl.var }).wLimit;
      r(m.wVar <= lim + 1e-9, 'Der Varistor nimmt höchstens seine Grenzenergie auf', 'Der Varistor nimmt ' + fm(m.wVar, 2) + ' J auf, seine Grenze ist ' + fm(lim, 0) + ' J.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Auf die Netzleitung (L–N) eines Geräts trifft ein Surge von ' + fm(v.kv, 0) + ' kV (' + NS + '). Ohne Schutz liegt die Spitze von ' + fm(v.vStart, 0) + ' V am Gerät. Wähle einen Varistor am Netzeingang: Seine Dauerspannungsgrenze muss über der Netz-Dauerspannung von ' + fm(v.vac, 0) + ' V liegen (Netzspannung mit Zuschlag; Übungsannahme), sonst wird er warm und altert. Die Spannung hinter dem Varistor soll höchstens ' + fm(v.vmax, 0) + ' V betragen (Vorgabe dieser Aufgabe) und seine Energieaufnahme unter der Grenze bleiben. Sicherheitshinweis: EMV-Maßnahmen ersetzen keine Schutzmaßnahmen; am Netz arbeitest du nie am Tisch, die Übung ist eine Simulation.'; },
      hint() { const v = vals(); return [
        'Ein Varistor wird bei hoher Spannung niederohmig und begrenzt so die Spitze. Seine Dauerspannungsgrenze (Vac,max) muss über der Netzspannung liegen; ein Typ mit höherer Grenze klemmt aber erst bei höherer Spannung.',
        'Die drei Typen haben Dauerspannungsgrenzen von ' + fm(v.vac230, 0) + ' V, ' + fm(v.vac275, 0) + ' V und ' + fm(v.vac320, 0) + ' V. Die Spannung hinter dem Varistor beträgt bei ' + fm(v.vac230, 0) + ' V: ' + fm(v.v230, 0) + ' V, bei ' + fm(v.vac275, 0) + ' V: ' + fm(v.vM, 0) + ' V, bei ' + fm(v.vac320, 0) + ' V: ' + fm(v.v320, 0) + ' V. Die Vorgabe ist ' + fm(v.vmax, 0) + ' V.',
        'Musterlösung: Varistor mit ' + fm(v.vac275, 0) + ' V Dauerspannungsgrenze. Spannung hinter dem Varistor ' + fm(v.vM, 0) + ' V (' + fm(v.resM, 0) + ' V unter der Vorgabe), Energieaufnahme ' + fm(v.wM, 2) + ' J von höchstens ' + fm(v.wLim, 0) + ' J, ' + KRIT[v.kM] + '.'
      ]; } };
  })();

  /* em31: Reklamation, Gehaeuseanbindung */
  const M31 = (() => {
    const FIX = { pruef: 'esdk', kv: 8, ort: 'gehaeuse', frep: 5000 }, START = { masse: 'lose', schutz: 'kein' }, MUSTER = { masse: 'g360', schutz: 'kein' }, WL = ['masse', 'schutz', 'tvs', 'rs', 'cbuf'];
    const run = o => build('esd', Object.assign({}, FIX, o), true);
    const vals = () => once('v31', () => {
      const C = CORE(), st = run(START).m, mu = run(MUSTER).m, g50 = run({ masse: 'g50', schutz: 'kein' }).m, tv = run({ masse: 'lose', schutz: 'tvsrs', tvs: 'tvs5', rs: 100 }).m, rc = run({ masse: 'lose', schutz: 'rc', rs: 100, cbuf: 1e-7 }).m;
      const cause = (kritOf(mu) === 'A' && st.nReset > 0 && kritOf(tv) === kritOf(st) && kritOf(rc) === kritOf(st)) ? 'masse' : 'unklar';
      return { kv: FIX.kv, kStart: kritOf(st), nR: st.nReset, vqStart: st.vq, vqM: mu.vq, kM: kritOf(mu), k50: kritOf(g50), v50: g50.vq, kTvs: kritOf(tv), kRc: kritOf(rc), cause, lgL: 500, lgM: 5, lg50: 50 };
    });
    const choices = () => { const v = vals(); return [{ key: 'ursache', q: 'Welche Ursache hat der Ausfall?', options: [
      { value: 'pin', label: 'Der Stecker-Pin hat keinen Schutz; die Spitze am Eingang zerstört den Controller.' },
      { value: 'masse', label: 'Der Entladestrom fließt über die Gehäuseanbindung; ihre Induktivität erzeugt einen Spannungssprung L·di/dt, der den Reset-Pegel unter die Schwelle drückt.' },
      { value: 'puffer', label: 'Der Puffer-Kondensator am Pin ist zu klein.' },
      { value: 'netz', label: 'Die Netzspannung bricht beim Entladen ein.' }] }]; };
    const WHY = v => ({
      pin: 'Die Entladung trifft das Gehäuse, nicht den Stecker-Pin. Mit TVS und Reihenwiderstand am Pin bleibt die Bewertung beim Prüfstand ' + KRIT[v.kTvs] + '.',
      puffer: 'Die Entladung trifft das Gehäuse, ein Puffer-C am Pin ändert daran nichts: Mit RC-Glied bleibt die Bewertung beim Prüfstand ' + KRIT[v.kRc] + '.',
      netz: 'Die Prüfung ist eine ESD-Entladung auf das Gehäuse; ein Einbruch der Netzspannung ist eine eigene Prüfung und kommt hier nicht vor.' });
    const check = mk((r, a) => {
      const e = ev(a, 'esd', FIX, WL, true), v = vals();
      if (!inputRow(r, e, a, 'esd')) return;
      lockedRow(r, a, 'esd', FIX, ['pruef', 'kv', 'ort'], 'Prüfart, Prüfpegel und Einkoppelort sind unverändert');
      const got = choiceOf(a, 'ursache'), none = got === undefined || got === null || got === '';
      r(!none && got === v.cause, 'Die Ursache ist richtig gewählt', none ? 'Wähle eine Ursache aus.' : (WHY(v)[got] || 'Diese Antwort gibt es nicht.'));
      const m = e.sim.m, k = kritOf(m);
      r(m.nReset === 0, 'Der Reset-Pegel bleibt über der Schwelle, das Gerät startet nicht neu', 'Der Reset-Pegel fiel ' + fm(m.nReset, 0) + ' ns unter die Schwelle; das Gerät startet neu (Masseversatz am Gehäuse: ' + fm(m.vp, 0) + ' V).');
      r(k === 'A', 'Das Gerät besteht ' + fm(v.kv, 0) + ' kV mit Kriterium A', 'Der Prüfstand bewertet nach der Entladung: ' + KRIT[k] + '.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run, choices,
      text() { const v = vals(); return 'Reklamation: „Das Gerät fällt nach einer Entladung am Gehäuse aus.“ Im Prüfstand „Impulse“ ist der Fall nachgestellt (ESD Kontakt, ' + fm(v.kv, 0) + ' kV, Einkoppelort Gehäuse, ' + NS + '). Die Bewertung ist ' + KRIT[v.kStart] + ', der Reset-Pegel fällt ' + fm(v.nR, 0) + ' ns unter die Schwelle. Wähle die Ursache und behebe sie, sodass das Gerät bei ' + fm(v.kv, 0) + ' kV Kriterium A erreicht. Prüfart, Pegel und Einkoppelort bleiben unverändert.'; },
      hint() { const v = vals(); return [
        'Bei einer Entladung auf das Gehäuse fließt der Strom über die Verbindung des Gehäuses zur Masse der Platine. Jede Induktivität dieser Verbindung erzeugt bei dem schnellen Stromanstieg einen Spannungssprung L·di/dt, der die Masse der Platine gegenüber dem Reset-Eingang anhebt.',
        'Gehäuse lose (' + fm(v.lgL, 0) + ' nH): ' + KRIT[v.kStart] + '. Anbindung als Leitung (' + fm(v.lg50, 0) + ' nH): ' + KRIT[v.k50] + '. Schutz am Pin (TVS mit Reihenwiderstand): ' + KRIT[v.kTvs] + ' – er ändert nichts, weil der Strom nicht über den Pin fließt.',
        'Musterlösung: Gehäuse mit 360°-Verbindung (' + fm(v.lgM, 0) + ' nH) anbinden. Spannungssprung ' + fm(v.vqM, 1) + ' V statt ' + fm(v.vqStart, 0) + ' V, Bewertung ' + KRIT[v.kM] + '.'
      ]; } };
  })();

  /* ====================================================================== em28: richtig messen */
  const M28 = (() => {
    const FIX = { rsrc: 50, trs: 5, amp: 3.3, didt: 10, dnear: 50, errReq: 10 };
    const START = { lead: 'klemme', teiler: 'x10', bwTk: 100, bwOsz: 200 }, MUSTER = { lead: 'feder', teiler: 'x10', bwTk: 200, bwOsz: 500 }, WL = ['lead', 'teiler', 'bwTk', 'bwOsz'];
    const run = o => build('tastkopf', Object.assign({}, FIX, o));
    const load = s => (s.dg || []).some(d => d.id === 'tk-last');
    const vals = () => once('v28', () => {
      const st = run(START).m, mu = run(MUSTER).m, x1 = run(Object.assign({}, MUSTER, { teiler: 'x1' })), kl = run(Object.assign({}, MUSTER, { lead: 'klemme' })).m, sl = run(Object.assign({}, MUSTER, { bwTk: 100, bwOsz: 200 })).m;
      return { req: FIX.errReq, osMax: FIX.errReq / 2, trs: FIX.trs, rsrc: FIX.rsrc, osStart: st.os, trFStart: st.trFehler, pickStart: st.pick, osM: mu.os, trFM: mu.trFehler, pickM: mu.pick, pickMax: mu.pick * 1.25, osKl: kl.os, trFSl: sl.trFehler, osX1: x1.m.os, x1Last: load(x1) };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'tastkopf', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'tastkopf')) return;
      lockedRow(r, a, 'tastkopf', FIX, ['trs', 'rsrc', 'errReq'], 'Flankenzeit, Quellwiderstand und Fehlervorgabe sind unverändert');
      const m = e.sim.m;
      r(m.os <= v.osMax + 1e-9, 'Überschwinger der Spur höchstens ' + fm(v.osMax, 1) + ' % (halbe Fehlervorgabe)', 'Die Spur zeigt ' + fm(m.os, 1) + ' % Überschwinger, erlaubt sind ' + fm(v.osMax, 1) + ' %.');
      r(m.trFehler <= v.req + 1e-9, 'Fehler der gemessenen Anstiegszeit höchstens ' + fm(v.req, 0) + ' %', 'Die gemessene Anstiegszeit weicht um ' + fm(m.trFehler, 1) + ' % von der des Signals ab, erlaubt sind ' + fm(v.req, 0) + ' %.');
      r(m.pick <= v.pickMax + 1e-9, 'Eingestreute Störspannung höchstens ' + fm(v.pickMax, 1) + ' % (Musterlösung plus 25 %)', 'Die eingestreute Störspannung beträgt ' + fm(m.pick, 1) + ' %, erlaubt sind ' + fm(v.pickMax, 1) + ' %.');
      r(!load(e.sim), 'Der Tastkopf belastet die Schaltung nicht mit einem RC-Glied (keine Meldung „Belastung“)', 'Der Prüfstand meldet, dass der Tastkopf die Schaltung belastet (der 1:1-Tastkopf hat die größere Eingangskapazität).');
    });
    return { FIX, START, MUSTER, WL, vals, check, run,
      text() { const v = vals(); return 'Du misst die Flanke einer Schaltung (Anstiegszeit ' + fm(v.trs, 0) + ' ns, Quellwiderstand ' + fm(v.rsrc, 0) + ' Ω; ' + NS + '). Die Spur zeigt ' + fm(v.osStart, 1) + ' % Überschwinger und die gemessene Anstiegszeit ist um ' + fm(v.trFStart, 1) + ' % falsch. Messe richtig: Wähle Masseanschluss, Teiler und Bandbreiten so, dass der Überschwinger höchstens ' + fm(v.osMax, 1) + ' %, der Anstiegszeitfehler höchstens ' + fm(v.req, 0) + ' % und die eingestreute Störspannung höchstens ' + fm(v.pickMax, 1) + ' % beträgt, ohne die Schaltung zu belasten. Flankenzeit, Quellwiderstand und Fehlervorgabe bleiben unverändert.'; },
      hint() { const v = vals(); return [
        'Ein langer Masseanschluss („Klemme“) bildet mit der Eingangskapazität des Tastkopfes einen Schwingkreis: Er erzeugt den Überschwinger, der in der Schaltung gar nicht vorhanden ist. Außerdem fängt die große Schleife Störungen ein. Eine zu geringe Bandbreite von Tastkopf und Oszilloskop verschleift die Flanke.',
        'Mit der Klemme zeigt die Spur ' + fm(v.osKl, 1) + ' % Überschwinger. Mit der Federspitze und den langsamen Geräten (100 MHz Tastkopf, 200 MHz Oszilloskop) ist der Anstiegszeitfehler ' + fm(v.trFSl, 1) + ' % (erlaubt ' + fm(v.req, 0) + ' %). Der 1:1-Tastkopf zeigt ' + fm(v.osX1, 1) + ' % Überschwinger, belastet die Schaltung aber stärker.',
        'Musterlösung: Federspitze, Teiler 10:1, Tastkopf 200 MHz, Oszilloskop 500 MHz. Überschwinger ' + fm(v.osM, 1) + ' %, Anstiegszeitfehler ' + fm(v.trFM, 1) + ' %, Einstreuung ' + fm(v.pickM, 1) + ' %.'
      ]; } };
  })();

  /* ====================================================================== em29 und em32: Vorpruefung */
  const gridOf = (ctl) => { const s = build('vorpruef', ctl); return s.ok ? s.rig.fieldGrid() : null; };
  /* em29: Hot-Spot suchen */
  const M29 = (() => {
    const FIX = { modus: 'nahfeld', layout: 'optimiert' }, START = { nord: 3, px: 0.25, py: 4 / 7 }, WL = ['nord', 'px', 'py'], NORD = 51, TOL = 6, TOLDB = 2;
    const MUSTER = g => ({ nord: NORD, px: g.max.x01, py: g.max.y01 });
    const vals = () => once('v29', () => {
      const g = gridOf(Object.assign({}, FIX, { nord: NORD })), g3 = gridOf(Object.assign({}, FIX, { nord: 3 })), gs = gridOf(Object.assign({}, FIX, { nord: NORD, layout: 'standard' }));
      const sp = g.spots.slice().sort((p, q) => q.db - p.db);
      return { nord: NORD, xmm: g.max.xmm, ymm: g.max.ymm, x01: g.max.x01, y01: g.max.y01, tol: TOL, tolDb: TOLDB, x3: g3.max.xmm, y3: g3.max.ymm, second: sp[1] ? sp[1].name : '', secondDb: sp[1] ? sp[1].db : NaN, xs: gs.max.xmm, ys: gs.max.ymm };
    });
    const check = mk((r, a) => {
      const e = ev(a, 'vorpruef', FIX, WL, false), v = vals();
      if (!inputRow(r, e, a, 'vorpruef')) return;
      r(e.ctl.nord === NORD, 'Die ' + NORD + '. Oberwelle ist eingestellt', 'Eingestellt ist die ' + String(e.ctl.nord) + '. Oberwelle, die Aufgabe verlangt die ' + NORD + '.');
      const g = gridOf(Object.assign({}, FIX, { nord: e.ctl.nord })), px = fin(e.ctl.px) ? e.ctl.px : 0.5, py = fin(e.ctl.py) ? e.ctl.py : 0.5;
      const gm = gridOf(Object.assign({}, FIX, { nord: NORD }));
      const dx = px * 100 - gm.max.xmm, dy = py * 70 - gm.max.ymm, d = Math.sqrt(dx * dx + dy * dy);
      r(d <= TOL + 1e-9, 'Die Sonde steht höchstens ' + fm(TOL, 0) + ' mm vom Maximum der ' + NORD + '. Oberwelle entfernt', 'Deine Sonde steht bei (' + fm(px * 100, 0) + ' mm | ' + fm(py * 70, 0) + ' mm), ' + fm(d, 0) + ' mm vom Maximum der ' + NORD + '. Oberwelle entfernt (erlaubt ' + fm(TOL, 0) + ' mm). Schiebe die Sonde über die Karte und beobachte den Pegel.');
      const want = e.sim.rig.fieldAt(px, py), got = fieldNum(a, 'pegel');
      numRow(r, 'Relativer Pegel an deiner Sondenposition in dB (0 dB = Maximum der Karte)', got, want, { abs: TOLDB, unit: 'dB' });
      void g;
    });
    return { FIX, START, WL, vals, check, MUSTER, fields: [{ key: 'pegel', label: 'Relativer Pegel an deiner Sondenposition', unit: 'dB' }],
      text() { const v = vals(); return 'Mit der Nahfeldsonde suchst du die Stelle der Platine (' + NS + ', 100 mm × 70 mm), an der die ' + v.nord + '. Oberwelle der Taktfrequenz am stärksten abstrahlt (Layout „optimiert“). Stelle die Oberwelle auf ' + v.nord + ' ein, schiebe die Sonde auf die Stelle mit dem größten Pegel (höchstens ' + fm(v.tol, 0) + ' mm daneben) und lies den relativen Pegel an deiner Sondenposition ab (0 dB = Maximum der Karte, Toleranz ±' + fm(v.tolDb, 0) + ' dB).'; },
      hint() { const v = vals(); return [
        'Jede Oberwelle hat eigene Hot-Spots: Niedrige Oberwellen kommen vor allem von den großen Stromschleifen, hohe von kurzen, schnellen Strukturen wie der Taktleitung. Beim Wechsel der Oberwelle wandert das Maximum der Karte.',
        'Bei der 3. Oberwelle liegt das Maximum bei (' + fm(v.x3, 0) + ' mm | ' + fm(v.y3, 0) + ' mm). Für die ' + v.nord + '. Oberwelle liegt es woanders; die zweitstärkste Stelle (' + v.second + ') liegt nur ' + fm(Math.abs(v.secondDb), 1) + ' dB darunter.',
        'Musterlösung: ' + v.nord + '. Oberwelle einstellen, Sonde auf (' + fm(v.xmm, 0) + ' mm | ' + fm(v.ymm, 0) + ' mm) stellen (px = ' + fm(v.x01, 2) + ', py = ' + fm(v.y01, 2) + '). Dort lesen sich 0 dB ab.'
      ]; } };
  })();

  /* em32: Meisterstueck Steckernetzteil */
  const M32 = (() => {
    const FIX = { modus: 'lisn', klasse: 'B', leakReq: 0.3, nord: 3, px: 0.5, py: 0.5 };
    const START = { rg: 10, snub: false, layout: 'standard', topo: 'kein', drossel: 'ohne', jitter: 0 };
    const MUSTER = { rg: 33, snub: true, layout: 'optimiert', topo: 'pi', cx: 3.3e-7, cy: 2.2e-9, drossel: 'd3', jitter: 8 };
    const WL = ['rg', 'snub', 'jitter', 'layout', 'topo', 'cx', 'cy', 'drossel', 'ld', 'lead'];
    const lim = () => once('lim32', () => { const mu = build('vorpruef', Object.assign({}, FIX, MUSTER)).m; return { pswReq: Math.ceil(mu.pSw * 1.25 * 100) / 100, budget: Math.ceil(mu.punkte * 1.25) }; });
    const fixAll = () => Object.assign({}, FIX, { budget: lim().budget, pswReq: lim().pswReq });
    const run = o => build('vorpruef', Object.assign({}, fixAll(), START, o));
    const vals = () => once('v32', () => {
      const L = lim(), st = run({}), mu = run(MUSTER), kn = run({ rg: 33, snub: false, layout: 'optimiert', topo: 'pi', cx: 3.3e-7, cy: 2.2e-9, drossel: 'd3', jitter: 4 }), fl = run(Object.assign({}, MUSTER, { rg: 100 }));
      return { lMax: st.m.lMax, fMax: st.m.fMax * 1000, margin: st.m.margin, tolDb: 2, leakReq: FIX.leakReq, pswReq: L.pswReq, budget: L.budget, mMuster: mu.m.margin, leakM: mu.m.leak, pswM: mu.m.pSw, punkteM: mu.m.punkte, mKnapp: kn.m.margin, aKnapp: kn.as.ampel, pswFl: fl.m.pSw, punkteFl: fl.m.punkte };
    });
    const check = mk((r, a) => {
      const L = lim(), e = ev(a, 'vorpruef', fixAll(), WL, false), v = vals();
      if (!inputRow(r, e, a, 'vorpruef')) return;
      lockedRow(r, a, 'vorpruef', fixAll(), ['modus', 'klasse', 'leakReq', 'pswReq', 'budget'], 'Messart, Klasse und die Vorgaben (Ableitstrom, Schaltverlust, Kosten) sind unverändert');
      numRow(r, 'Höchster Pegel der Störspannung ohne Maßnahmen in dBµV', fieldNum(a, 'lmax'), v.lMax, { abs: v.tolDb, unit: 'dBµV' });
      numRow(r, 'Marge zur Mittelwert-Grenzlinie ohne Maßnahmen in dB', fieldNum(a, 'marge'), v.margin, { abs: v.tolDb, unit: 'dB' });
      const m = e.sim.m, as = e.sim.as;
      r(as.ampel === 'gruen', 'Die Ampel der Vorprüfung zeigt grün', 'Die Ampel steht auf „' + String(as.ampel) + '“ (Marge ' + fm(m.margin, 1) + ' dB' + (as.ampel === 'gelb' ? ': knapp, nachmessen' : '') + ').');
      r(m.leak <= v.leakReq + 1e-9, 'Ableitstrom höchstens ' + fm(v.leakReq, 1) + ' mA (Vorgabe dieser Aufgabe)', 'Der Ableitstrom beträgt ' + fm(m.leak, 3) + ' mA, die Vorgabe ist ' + fm(v.leakReq, 1) + ' mA.');
      r(m.pSw <= L.pswReq + 1e-9, 'Schaltverlust höchstens ' + fm(L.pswReq, 2) + ' W', 'Der Schaltverlust beträgt ' + fm(m.pSw, 2) + ' W, erlaubt sind ' + fm(L.pswReq, 2) + ' W.');
      r(m.punkte <= L.budget + 1e-9, 'Kosten höchstens ' + fm(L.budget, 0) + ' Punkte', 'Die Kosten betragen ' + fm(m.punkte, 0) + ' Punkte, das Budget ist ' + fm(L.budget, 0) + ' Punkte.');
    });
    return { FIX, START, MUSTER, WL, vals, check, run, fixAll, lim,
      fields: [{ key: 'lmax', label: 'Höchster Pegel der Störspannung ohne Maßnahmen', unit: 'dBµV' }, { key: 'marge', label: 'Marge zur Mittelwert-Grenzlinie ohne Maßnahmen', unit: 'dB' }],
      text() { const v = vals(); return 'Meisterstück: Entstöre das Steckernetzteil (Prüfstand „Vorprüfung“, Klasse B, ' + NS + '). Lies zuerst am unentstörten Gerät den höchsten Pegel (in dBµV, ab 150 kHz) und die Marge zur Mittelwert-Grenzlinie ab und trage sie in das Antwortblatt ein (Toleranz ±' + fm(v.tolDb, 0) + ' dB). Entstöre danach das Gerät: Ampel grün, Ableitstrom höchstens ' + fm(v.leakReq, 1) + ' mA (Vorgabe dieser Aufgabe), Schaltverlust höchstens ' + fm(v.pswReq, 2) + ' W und Kosten höchstens ' + fm(v.budget, 0) + ' Punkte. Du darfst Flanke (Gate-Widerstand), Snubber, Layout, Frequenzjitter und Filter verändern.'; },
      hint() { const v = vals(); return [
        'Beginne beim Entstehen der Störung (Flanke, Ringing, Layout), dann das Filter. Ein langsamerer Schalter senkt die Störung, kostet aber Schaltverlust. Ein Y-Kondensator hilft gegen Gleichtakt, erhöht aber den Ableitstrom. Die Ampel wird erst grün, wenn die Marge zur Mittelwert-Grenzlinie groß genug ist (Faustregel 6 dB).',
        'Ohne Maßnahmen: höchster Pegel ' + fm(v.lMax, 1) + ' dBµV bei ' + fm(v.fMax, 0) + ' kHz, Marge ' + fm(v.margin, 1) + ' dB. Vorgaben: Ableitstrom ' + fm(v.leakReq, 1) + ' mA, Schaltverlust ' + fm(v.pswReq, 2) + ' W, Kosten ' + fm(v.budget, 0) + ' Punkte. Gate-Widerstand 100 Ω würde ' + fm(v.pswFl, 2) + ' W Schaltverlust kosten.',
        'Musterlösung: Gate-Widerstand 33 Ω, Snubber, optimiertes Layout, Pi-Filter (330 nF, 2,2 nF, Drossel d3), Jitter 8 %. Marge ' + fm(v.mMuster, 1) + ' dB, Ableitstrom ' + fm(v.leakM, 3) + ' mA, Schaltverlust ' + fm(v.pswM, 2) + ' W, Kosten ' + fm(v.punkteM, 0) + ' Punkte.'
      ]; } };
  })();

  /* ====================================================================== em30: Normen */
  const M30 = (() => {
    const IDS = ['ce', 'richtlinie', 'aussendung', 'festigkeit', 'kriteriumA', 'kriteriumB', 'esd', 'burst'];
    const items = () => once('it30', () => { const N = CORE().glossary.normen; const sel = IDS.map(id => N.find(x => x.id === id)).filter(Boolean); return sel.length === 8 ? sel : N.slice(0, 8); });
    const optsOf = (it, i) => { const all = [it.richtig].concat(it.falsch.map(f => f.text)); const k = (i * 3 + 1) % all.length; return all.slice(k).concat(all.slice(0, k)); };
    const choices = () => items().map((it, i) => ({ key: 'n' + (i + 1), q: (i + 1) + '. ' + it.frage, options: optsOf(it, i).map(t => ({ value: t, label: t })) }));
    const vals = () => ({ n: items().length });
    const check = mk((r, a) => {
      items().forEach((it, i) => {
        const got = choiceOf(a, 'n' + (i + 1)), none = got === undefined || got === null || got === '', ok = !none && got === it.richtig;
        const f = it.falsch.find(x => x.text === got);
        r(ok, 'Frage ' + (i + 1) + ': ' + it.frage, none ? 'Wähle eine Antwort aus.' : (f ? f.grund : 'Diese Antwort gibt es nicht.'));
      });
    });
    return { vals, check, choices, items,
      text() { return 'Beantworte acht Fragen zu CE-Zeichen, EMV-Richtlinie, Störaussendung und Störfestigkeit, den Bewertungskriterien A, B und C und den Prüfarten ESD und Burst. Es geht nur um gesicherte Grundaussagen, ohne Zahlen. Herstellerdokumentation und aktuelle Norm maßgeblich. Wähle bei jeder Frage genau eine Antwort.'; },
      hint() { return [
        'Unterscheide immer die Richtung: Störaussendung ist, was das Gerät abgibt; Störfestigkeit ist, was es aushält. Die Bewertungskriterien beschreiben das Verhalten während und nach der Störung: A normal, B kurze Beeinträchtigung mit Selbsterholung, C Bedienereingriff nötig.',
        'Die Aufgabe hat ' + items().length + ' Fragen mit je vier Antworten; die falschen Antworten verwechseln meist zwei Begriffe (zum Beispiel Aussendung mit Festigkeit oder Kriterium B mit C). Prüfe die Antwort noch einmal und frage dich, welche Richtung gemeint ist.',
        'Musterlösung: Die richtigen Antworten stehen im Glossar des Labs (Tab „Lernen“, Abschnitt Normen und Prüfungen). Nach „Lösung prüfen“ nennt jede falsche Antwort ihren Fachgrund.'
      ]; } };
  })();

  /* ====================================================================== Aufgabenliste */
  const noV = keys => keys.reduce((o, k) => { o[k] = null; return o; }, {});
  const withCtl = (fix, over) => Object.assign({}, fix, over);
  /* Aufgabe mit Modell zusammenbauen: text, table, hint, choices, fields erst beim ersten Zugriff rechnen */
  function L(t, M) {
    const def = (k, f) => { Object.defineProperty(t, k, { enumerable: true, configurable: true, get() { const v = f(); Object.defineProperty(t, k, { value: v, enumerable: true, writable: true, configurable: true }); return v; } }); };
    def('text', () => M.text());
    def('hint', () => M.hint());
    if (M.tables) def('table', () => M.tables());
    return t;
  }
  const ctlOf = (M, startOver) => withCtl(M.FIX, startOver);
  const tasks = [
    L({ id: 'em17', lab: 'emv', cat: 'Filter', title: 'Rechnen: LC-Resonanz, RC-Grenzfrequenz und Dämpfung', level: 3, rig: null,
      consts: [40],   // Formelkonstante 40·lg (2. Ordnung) aus den Rechenschritten der Kernuebung
      get fields() { return M17.fields(); },
      start: () => ({ rig: null, controls: {}, fields: noV(['f1', 'f2', 'f3']) }),
      sol: () => ({ rig: null, controls: {}, fields: { f1: M17.ex(0).answer.value, f2: M17.ex(1).answer.value, f3: M17.ex(2).answer.value } }),
      check: M17.check, hintVals: () => M17.vals() }, M17),
    L({ id: 'em18', lab: 'emv', cat: 'Schirmung', title: 'Der Schlitz im Gehäuse: Länge für die geforderte Schirmdämpfung', level: 1, rig: 'schirm',
      consts: [20],   // Vergleichsschlitz 20 mm im Tipp (Wert aus derselben Simulation)
      start: () => S('schirm', withCtl(M18.FIX, M18.START)),
      sol: () => S('schirm', withCtl(M18.FIX, M18.MUSTER)),
      check: M18.check, hintVals: () => M18.vals() }, M18),
    L({ id: 'em19', lab: 'emv', cat: 'Schirmung', title: 'Magnetfeld bei 10 kHz: Material und Dicke wählen', level: 2, rig: 'schirm',
      start: () => S('schirm', withCtl(M19.FIX, M19.START)),
      sol: () => S('schirm', withCtl(M19.FIX, M19.MUSTER)),
      check: M19.check, hintVals: () => M19.vals() }, M19),
    L({ id: 'em20', lab: 'emv', cat: 'Schirmung', title: 'Kabelschirm: Störspannung innen unter die Vorgabe bringen', level: 2, rig: 'schirm',
      start: () => S('schirm', withCtl(M20.FIX, M20.START)),
      sol: () => S('schirm', withCtl(M20.FIX, M20.MUSTER)),
      check: M20.check, hintVals: () => M20.vals() }, M20),
    L({ id: 'em21', lab: 'emv', cat: 'Layout', title: 'Fehler im Layout finden: Signal quert einen Schlitz', level: 1, rig: 'layout', clicks: true,
      start: () => S('layout', withCtl(M21.FIX, { fix1: false, fix2: false, fix3: false })),
      sol: () => S('layout', withCtl(M21.FIX, { fix1: false, fix2: true, fix3: false }), { clicks: M21.centres().map(c => ({ x: c.x, y: c.y, hit: c.id, fall: M21.FALL })) }),
      check: M21.check, hintVals: () => M21.vals() }, M21),
    L({ id: 'em22', lab: 'emv', cat: 'Layout', title: 'Abblockkondensator an den Versorgungspin setzen', level: 2, rig: 'layout',
      start: () => S('layout', withCtl(M22.FIX, { fix1: false, fix2: false })),
      sol: () => S('layout', withCtl(M22.FIX, { fix1: true, fix2: true })),
      check: M22.check, hintVals: () => M22.vals() }, M22),
    L({ id: 'em23', lab: 'emv', cat: 'Layout', title: 'Lagenaufbau: Wie viel dB bringen vier Lagen?', level: 2, rig: 'layout',
      ask: { label: 'Abnahme der Abstrahlung von „2gnd“ auf „4“', unit: 'dB' },
      start: () => S('layout', withCtl(M23.FIX, { stack: '2gnd' }), { value: null }),
      sol: () => S('layout', withCtl(M23.FIX, { stack: '4' }), { value: M23.vals().diff }),
      check: M23.check, hintVals: () => M23.vals() }, M23),
    L({ id: 'em24', lab: 'emv', cat: 'Layout', title: 'Meisterstück Schaltregler: Hot-Loop-Fläche minimieren', level: 3, rig: 'layout',
      start: () => S('layout', withCtl(M24.FIX, { fix1: false, fix2: false, fix3: false })),
      sol: () => S('layout', withCtl(M24.FIX, { fix1: true, fix2: true, fix3: false })),
      check: M24.check, hintVals: () => M24.vals() }, M24),
    L({ id: 'em25', lab: 'emv', cat: 'Impulse', title: 'ESD 4 kV auf den Pin: Schutz wählen', level: 1, rig: 'esd',
      start: () => S('esd', withCtl(M25.FIX, M25.START), { fired: false }),
      sol: () => S('esd', withCtl(M25.FIX, M25.MUSTER), { fired: true }),
      check: M25.check, hintVals: () => M25.vals() }, M25),
    L({ id: 'em26', lab: 'emv', cat: 'Impulse', title: 'Burst addiert sich: Puffer-C gegen die Treppe', level: 2, rig: 'esd',
      start: () => S('esd', withCtl(M26.FIX, M26.START), { fired: false }),
      sol: () => S('esd', withCtl(M26.FIX, M26.MUSTER), { fired: true }),
      check: M26.check, hintVals: () => M26.vals() }, M26),
    L({ id: 'em27', lab: 'emv', cat: 'Impulse', title: 'Surge 1 kV auf L–N: Varistor wählen', level: 2, rig: 'esd',
      start: () => S('esd', withCtl(M27.FIX, M27.START), { fired: false }),
      sol: () => S('esd', withCtl(M27.FIX, M27.MUSTER), { fired: true }),
      check: M27.check, hintVals: () => M27.vals() }, M27),
    L({ id: 'em28', lab: 'emv', cat: 'Messen', title: 'Die Flanke zeigt Überschwinger: richtig messen', level: 2, rig: 'tastkopf',
      start: () => S('tastkopf', withCtl(M28.FIX, M28.START)),
      sol: () => S('tastkopf', withCtl(M28.FIX, M28.MUSTER)),
      check: M28.check, hintVals: () => M28.vals() }, M28),
    L({ id: 'em29', lab: 'emv', cat: 'Messen', title: 'Hot-Spot der 51. Oberwelle mit der Nahfeldsonde finden', level: 3, rig: 'vorpruef',
      fields: M29.fields,
      start: () => S('vorpruef', withCtl(M29.FIX, M29.START), { fields: noV(['pegel']) }),
      sol: () => { const v = M29.vals(); return S('vorpruef', withCtl(M29.FIX, { nord: v.nord, px: v.x01, py: v.y01 }), { fields: { pegel: 0 } }); },
      check: M29.check, hintVals: () => M29.vals() }, M29),
    L({ id: 'em30', lab: 'emv', cat: 'Normen', title: 'CE, Störaussendung, Störfestigkeit und Bewertungskriterien', level: 1, rig: null,
      get choices() { return M30.choices(); },
      start: () => ({ rig: null, controls: {}, choices: {} }),
      sol: () => ({ rig: null, controls: {}, choices: M30.items().reduce((o, it, i) => { o['n' + (i + 1)] = it.richtig; return o; }, {}) }),
      check: M30.check, hintVals: () => M30.vals() }, M30),
    L({ id: 'em31', lab: 'emv', cat: 'Fehlersuche', title: 'Reklamation: Das Gerät fällt nach einer Entladung am Gehäuse aus', level: 3, rig: 'esd',
      get choices() { return M31.choices(); },
      start: () => S('esd', withCtl(M31.FIX, Object.assign({}, M31.START, { masse: 'geliefert' })), { fired: false, choices: {} }),   // 'geliefert' verhält sich wie 'lose', nennt den Fehler aber nicht (Verdeckte-Fehler-Muster)
      sol: () => S('esd', withCtl(M31.FIX, M31.MUSTER), { fired: true, choices: { ursache: M31.vals().cause } }),
      check: M31.check, hintVals: () => M31.vals() }, M31),
    L({ id: 'em32', lab: 'emv', cat: 'Prüfungsstil', title: 'Meisterstück: Das Steckernetzteil entstören', level: 3, rig: 'vorpruef',
      fields: M32.fields,
      start: () => S('vorpruef', withCtl(M32.fixAll(), M32.START), { fields: noV(['lmax', 'marge']) }),
      sol: () => { const v = M32.vals(); return S('vorpruef', withCtl(M32.fixAll(), M32.MUSTER), { fields: { lmax: v.lMax, marge: v.margin } }); },
      check: M32.check, hintVals: () => M32.vals() }, M32)
  ];
  void ctlOf; void LAY; void tbl;

  /* ====================================================================== Registrierung */
  const answerOf = (task, o) => {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, ref: o.ref || null, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, fired: !!o.fired, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [] };
  };
  const idNum = id => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  const T = root.EMV_TASKS = root.EMV_TASKS || {
    tasks: [],
    register(list) {
      (Array.isArray(list) ? list : []).forEach(t => { if (t && t.id && typeof t.check === 'function' && !this.tasks.some(x => x.id === t.id)) this.tasks.push(t); });
      this.tasks.sort((a, b) => idNum(a.id) - idNum(b.id));
    },
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    }
  };
  if (typeof T.register === 'function') T.register(tasks);
  else if (Array.isArray(T.tasks)) tasks.forEach(t => { if (!T.tasks.some(x => x.id === t.id)) T.tasks.push(t); });
  if (typeof root.TaskTest !== 'function') {
    const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
    root.TaskTest = async only => {
      const ids = only || T.tasks.map(t => t.id), out = [];
      for (const id of ids) {
        const t = T.tasks.find(x => x.id === id);
        if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
        try { const a = pctOf(t.check(answerOf(t, t.start()))), L2 = t.check(answerOf(t, t.sol())); out.push({ id, pct: pctOf(L2), startPct: a, bad: L2.filter(x => !x.ok).map(x => x.text) }); } catch (e) { out.push({ id, err: String(e) }); }
      }
      return out;
    };
  }
  const api = { tasks, answerOf, models: { M17, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30, M31, M32 }, helpers: { numRow, fm, pick, build, ev, kritOf } };
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
