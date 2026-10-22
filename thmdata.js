/* thmdata.js - Thermik-Lab: Beispiele (THM_DATA) und Aufgabenregister (THM_TASKS), ohne Browser lauffähig.
 * window.THM_DATA  = { examples: [ { id:'thx1'..'thx24', name, cat, rig, desc, controls, seq?, dur?, settle, vals } ] }
 *   Alle Zahlen in `desc` kommen aus Simulation und Kern (THM_CORE, THM_RIGS) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff
 *   gerechnet (Getter); fehlen Kern oder Prüfstände, ist die Liste leer (thmui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Prüfstands, seq im Format von THM_CORE.runSeq (t in Prozess-SEKUNDEN, set | ramp), dur in Sekunden,
 *   settle = true: Der Versuch beginnt im Beharrungszustand (rig.settle()), false: kalt bei Ta. Texte tragen {sym:key}-Platzhalter (THM_CORE.tpl).
 * window.THM_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in thmtasks1.js (th1-th15) und thmtasks2.js (th16-th30) und melden sich mit THM_TASKS.register([...]) an;
 *   die Reihenfolge der Registry ist immer th1, th2, ... (unabhängig von der Ladereihenfolge).
 *   Aufgabe: { id:'thN', lab:'thm', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), fields?, choices?, ask?, hintVals() }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls:{key:Wert}, seq:[{t(s), set|ramp}], rows, dur(s), state, simTime, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, kennwerte }
 *   start() und sol() liefern { rig, controls, seq?, dur?, settle?, value?, fields?, choices? }; value/fields/choices dienen dem Selbsttest und dem Auto-Weg.
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * THM_TASKS.util (für thmtasks1.js und thmtasks2.js; Schnittstelle, die WP4b mitbenutzen kann):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); run(rigId, ctl, seq, T, o?) -> Ergebnis von THM_CORE.runSeq (Prüfstand frisch, Steuerwerte in fester Reihenfolge,
 *   o.after, o.sampleS, o.seed, o.settle (Standard true wie runSeq)); mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId);
 *   win/winMean/winMax/winMin/winP2P(samples, t0, t1, f); at(samples, t); faultHas(res, id); memo(obj, key, fn); fieldNum(a, key); numAns(a);
 *   variants(v) (Zahlentoken); cfgOf(ctl, device); numRow(r, opt) (Zahlenzeile mit Alternativen und Fehlerbildern); tpl(text).
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben.
 * THM_TASKS.audit(task) und THM_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) für den Selbsttest und die Tests;
 *   THM_TASKS.answerOf(task, startOderSol) baut ein Antwortobjekt wie die Oberfläche; THM_TASKS.thresholds1() (thmtasks1.js) nennt die Musterwerte. */
(function (root) {
  'use strict';
  const CORE = () => root.THM_CORE, RIGS = () => root.THM_RIGS;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => { if (!fin(x)) return '–'; const s = (+x).toFixed(d == null ? 1 : d).replace('.', ','); return s.replace(/^-(?=\d)/, '−'); };
  const toNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && typeof C.parseNum === 'function' ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
  const tpl = s => { const C = CORE(); return C && typeof C.tpl === 'function' ? C.tpl(s) : String(s); };

  /* ====================================================================== Eingabe prüfen und aufbereiten */
  function flat(list, out) {
    (Array.isArray(list) ? list : []).forEach(c => { if (c && Array.isArray(c.controls)) flat(c.controls, out); else if (c && typeof c.key === 'string') out.push(c); });
    return out;
  }
  const ctlDefs = rig => { const R = RIGS(); const d = R && R.defs && R.defs[rig]; return d ? flat(d.controls, []) : null; };
  /* Wert an die Definition des Steuerelements anpassen (wie die Oberfläche); undefined = unpassend */
  function coerce(def, v) {
    if (!def) return v;
    if (def.type === 'slider') {
      const x = toNum(v); return fin(x) ? clamp(x, def.min, def.max) : undefined;
    }
    if (def.type === 'switch' || def.type === 'button') return v === undefined || v === null || isObj(v) || Array.isArray(v) ? undefined : !!v;
    if (def.type === 'select') {
      const o = def.options || [], norm = s => String(s).trim().replace(',', '.');
      let m = o.find(x => x.value === v) || o.find(x => norm(x.value) === norm(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      if (!m && (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && o.every(x => fin(+x.value))) {   // Zahlenauswahl: gerundeter Wert (zum Beispiel 1,571 für die Halbwelle)
        const q = toNum(v); if (fin(q)) { const c = o.slice().sort((a, b) => Math.abs(a.value - q) - Math.abs(b.value - q))[0]; if (c && Math.abs(c.value - q) <= 1e-3 * Math.max(1, Math.abs(c.value))) m = c; }
      }
      return m ? m.value : undefined;
    }
    return v;
  }
  /* Ablauf-Zeilen { t, kind:'set'|'ramp', key, value|to, dur } -> runSeq-Format */
  function rowsToSeq(rows) {
    const m = new Map(), ramps = [];
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r) || typeof r.key !== 'string') return;
      const t = Math.max(0, toNum(r.t) || 0);
      if (r.kind === 'ramp') { ramps.push({ t, ramp: { key: r.key, to: toNum(r.to != null ? r.to : r.value), durS: toNum(r.dur) } }); return; }
      if (!m.has(t)) m.set(t, {});
      m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(ramps).sort((a, b) => a.t - b.t);
  }
  /* -> { controls, seq, problems[] } ; wirft nie. own = Liste der Schlüssel, die der Lernende wählen darf (nur dort werden Probleme gemeldet) */
  function clean(a, rig, own) {
    const problems = [], defs = ctlDefs(rig), map = {}, mine = Array.isArray(own) ? own : null;
    if (defs) defs.forEach(c => { map[c.key] = c; });
    a = isObj(a) ? a : {};
    const relevant = k => !mine || mine.includes(k);
    const one = (k, v, where) => {
      if (defs && !map[k]) { if (relevant(k)) problems.push('Den Steuerwert „' + k + '“ gibt es an diesem Prüfstand nicht' + where + '.'); return undefined; }
      const x = coerce(map[k], v);
      if (x === undefined) { if (relevant(k)) problems.push('Der Wert für „' + k + '“ ist ungültig' + where + '.'); return undefined; }
      return x;
    };
    const controls = {};
    if (isObj(a.controls)) Object.keys(a.controls).forEach(k => { const x = one(k, a.controls[k], ''); if (x !== undefined) controls[k] = x; });
    const src = Array.isArray(a.seq) && a.seq.length ? a.seq : rowsToSeq(a.rows), seq = [];
    src.forEach((e, i) => {
      if (!isObj(e)) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm ist unlesbar.'); return; }
      const t = toNum(e.t);
      if (!fin(t) || t < 0) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm hat keine gültige Zeit.'); return; }
      const out = { t };
      const set = isObj(e.set) ? e.set : (typeof e.key === 'string' ? { [e.key]: e.value } : null);
      if (set) { out.set = {}; Object.keys(set).forEach(k => { const x = one(k, set[k], ' (Schritt ' + (i + 1) + ')'); if (x !== undefined) out.set[k] = x; }); }
      if (isObj(e.ramp) && typeof e.ramp.key === 'string') {
        if (defs && !map[e.ramp.key]) { if (relevant(e.ramp.key)) problems.push('Den Steuerwert „' + e.ramp.key + '“ gibt es an diesem Prüfstand nicht (Schritt ' + (i + 1) + ').'); }
        else out.ramp = { key: e.ramp.key, to: toNum(e.ramp.to), durS: toNum(e.ramp.durS) };
      }
      seq.push(out);
    });
    seq.sort((p, q) => p.t - q.t);
    return { controls, seq, problems };
  }
  /* Startwerte: Steuerwerte plus Schritte ganz am Anfang (t <= 0,05 s) */
  function initial(c, own) {
    const o = Object.assign({}, c.controls);
    c.seq.forEach(e => { if (e.t <= 0.05 && e.set) Object.assign(o, e.set); });
    if (Array.isArray(own)) Object.keys(o).forEach(k => { if (!own.includes(k)) delete o[k]; });
    return o;
  }
  function numAns(a) {
    if (!isObj(a)) return null;
    if (fin(a.value)) return a.value;
    if (typeof a.value === 'string') { const x = toNum(a.value); if (fin(x)) return x; }
    if (typeof a.text === 'string' && a.text.trim() !== '') { const x = toNum(a.text); if (fin(x)) return x; }
    return null;
  }
  function fieldNum(a, key) {
    if (!isObj(a) || !isObj(a.fields)) return null;
    const v = a.fields[key]; const x = fin(v) ? v : toNum(v);
    return fin(x) ? x : null;
  }

  /* ====================================================================== Simulation und Auswertung */
  const FIRST = ['device', 'mode', 'pulse', 'driver', 'loadMode', 'n', 'heatsink'];   // erst Bauteil und Betriebsart, dann deren Werte (Bereiche und Auswahllisten ändern sich)
  const order = obj => Object.keys(obj || {}).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
  /* Prüfstand frisch erzeugen, Steuerwerte setzen, optional `after` setzen, dann THM_CORE.runSeq.
   * o = { after:{key:Wert}, sampleS, seed, settle (Standard true), rigOpts } ; abgelehnte Werte stehen in result.rejected */
  function run(rigId, ctl, seq, T, o) {
    o = o || {};
    const C = CORE(), R = RIGS(), rejected = [];
    if (!C || typeof C.runSeq !== 'function') return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Der Kern (thmcore.js) ist nicht geladen.'], rejected };
    if (!R || !R.defs || !R.defs[rigId]) return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Den Prüfstand „' + rigId + '“ gibt es nicht.'], rejected };
    const seed = fin(o.seed) ? o.seed : 1;
    let rig;
    try { rig = R.create(rigId, Object.assign({}, o.rigOpts || {}, { seed })); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)], rejected }; }
    const setAll = obj => {
      if (!isObj(obj)) return;
      order(obj).forEach(k => { let ok; try { ok = rig.setControl(k, obj[k]); } catch (e) { ok = false; } if (ok === false) rejected.push({ key: k, value: obj[k] }); });
    };
    setAll(ctl); setAll(o.after);
    const res = C.runSeq(rig, Array.isArray(seq) ? seq : [], T, { reset: false, sampleS: o.sampleS, seed, settle: o.settle !== false });
    res.rejected = (res.rejected || []).concat(rejected);
    res.rig = rig;
    return res;
  }
  const smp = r => (r && Array.isArray(r.samples) ? r.samples : []);
  const win = (s, t0, t1) => s.filter(x => x.t >= t0 - 1e-9 && x.t <= t1 + 1e-9);
  const winMean = (s, t0, t1, f) => mean(win(s, t0, t1).map(f));
  const winMax = (s, t0, t1, f) => win(s, t0, t1).reduce((m, x) => Math.max(m, f(x)), -Infinity);
  const winMin = (s, t0, t1, f) => win(s, t0, t1).reduce((m, x) => Math.min(m, f(x)), Infinity);
  const winP2P = (s, t0, t1, f) => { const w = win(s, t0, t1); return w.length ? winMax(s, t0, t1, f) - winMin(s, t0, t1, f) : NaN; };
  const at = (s, t) => { for (let i = 0; i < s.length; i++) if (s[i].t >= t - 1e-9) return s[i]; return s[s.length - 1] || { t: 0, state: {}, meters: {} }; };
  const faultHas = (r, id) => !!r && Array.isArray(r.faults) && r.faults.includes(id);
  /* alle Steuerwerte eines Prüfstands in der Reihenfolge der Bedienelemente (Standardwerte des frischen Prüfstands), darüber over; Tasten (button) fehlen */
  function fullCtl(rigId, over) {
    const R = RIGS(), defs = ctlDefs(rigId); const out = {};
    if (!R || !defs) return Object.assign({}, over || {});
    let rig = null; try { rig = R.create(rigId, { seed: 1 }); } catch (e) { rig = null; }
    defs.forEach(c => { if (c.type === 'button') return; let v; try { v = rig ? rig.getControl(c.key) : undefined; } catch (e) { v = undefined; } out[c.key] = v !== undefined ? v : c.value; });
    return Object.assign(out, over || {});
  }
  const cfgOf = (ctl, device) => { const C = CORE(); return C.cfgFromControls(ctl || {}, device); };
  const memoMap = new WeakMap();
  function memo(obj, key, fn) {
    let m = memoMap.get(obj); if (!m) { m = {}; memoMap.set(obj, m); }
    if (!(key in m)) { try { m[key] = fn(); } catch (e) { return { error: String(e && e.message || e) }; } }
    return m[key];
  }

  /* ====================================================================== Prüfungen bauen */
  /* check-Funktion: fn(c, r, a) schreibt Zeilen mit r(bedingung, text, warum); wirft nie */
  function mk(rigId, own, fn) {
    return function (a) {
      try {
        const c = clean(a, rigId, own), rows = [];
        const r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || 'Die Bedingung ist nicht erfüllt.') }); };
        fn(c, r, a);
        if (!rows.length) rows.push({ ok: false, text: 'Die Prüfung hat nichts geprüft', why: 'Bitte melde das deinem Ausbilder.' });
        return rows;
      } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
    };
  }
  /* erste Zeile jeder Simulationsaufgabe: richtiger Prüfstand, gültige Eingaben, Lauf ohne Fehlermeldung */
  function inputRow(c, r, sim, a, rigId) {
    const errs = c.problems.slice();
    if (sim && sim.errors) errs.push(...sim.errors);
    if (sim && sim.rejected && sim.rejected.length) sim.rejected.forEach(x => errs.push('Der Prüfstand lehnt den Wert für „' + x.key + '“ ab.'));
    if (rigId && isObj(a) && typeof a.rig === 'string' && a.rig !== rigId) {
      const R = RIGS(), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }
  /* Zahlenzeile (Rechenaufgaben): val = Eingabe (Zahl oder null); opt = { label (Prüftext), refs:[{v, note?}] (richtige Werte, der erste ist der Hauptwert),
   *   tol (relativ, Standard 0,02) oder absTol (absolut, in der Einheit der Zahl), unit, digits, abs (Betrag vergleichen), wrong:[{v, msg}] (typische Fehlerbilder, jedes gerechnet) }.
   * Die Toleranz steht hinter dem Prüftext. Die Warum-Texte sagen nur, was verglichen wurde: Richtung (zu klein/zu groß) und passendes Fehlerbild, nie mehr. */
  function numRow(r, val, opt) {
    const pctTxt = q => fm(100 * q, Math.abs(100 * q - Math.round(100 * q)) < 1e-9 ? 0 : 1);
    const absMode = fin(opt.absTol), tol = fin(opt.tol) ? opt.tol : 0.02, dg = opt.digits == null ? 2 : opt.digits, u = opt.unit ? ' ' + opt.unit : '';
    const refs = opt.refs.filter(x => fin(x.v)), main = refs[0];
    let v = val;
    if (v !== null && opt.abs) v = Math.abs(v);
    const near = (a, b) => (absMode ? Math.abs(a - b) <= opt.absTol + 1e-9 : Math.abs(a - b) <= tol * Math.abs(b) + 1e-12);
    const tolTxt = absMode ? 'Toleranz ±' + fm(opt.absTol, 1) + u : 'Toleranz ' + pctTxt(tol) + ' %';
    const good = v !== null && refs.some(x => near(v, x.v));
    let why = 'Du hast keine Zahl eingetragen.';
    if (v !== null) {
      why = 'Dein Wert ' + fm(val, dg) + u + ' weicht um mehr als ' + (absMode ? fm(opt.absTol, 1) + u : pctTxt(tol) + ' %') + ' vom Rechenwert ab (' + fm(main.v, dg) + u + ').';
      const w = (opt.wrong || []).find(x => fin(x.v) && near(v, x.v));
      if (w) why = 'Dein Wert ' + fm(val, dg) + u + ' passt zu einem häufigen Fehler: ' + w.msg;
      else why += v < main.v ? ' Er ist zu klein.' : ' Er ist zu groß.';
    }
    r(good, opt.label + ' (' + tolTxt + ')', why);
    return good;
  }
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 4; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^th(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
  function register(list) {
    let added = 0;
    (Array.isArray(list) ? list : []).forEach(t => {
      if (!isObj(t) || typeof t.id !== 'string' || typeof t.check !== 'function') return;
      if (tasks.some(x => x.id === t.id)) return;
      tasks.push(t); added++;
    });
    tasks.sort((a, b) => idNum(a.id) - idNum(b.id));
    return added;
  }
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));
  const THM_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, mean, ctlDefs, coerce, clean, initial, run, mk, inputRow, numRow, cfgOf, tpl, win, winMean, winMax, winMin, winP2P, at, faultHas, memo, fieldNum, numAns, variants, smp, pctOf, rowsToSeq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberfläche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null, text: '', fields: o.fields || {}, choices: o.choices || {}, kennwerte: o.kennwerte || null };
  }
  THM_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1, auch für den Selbsttest): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel
   * oder einer benannten Formelkonstante (task.consts) stammen; 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).match(/\d+(?:,\d+)?/g) || []);
  const FREI = ['0', '1', '2', '3', '100'];
  /* Bauteil- und Gehäusenamen (7805, LM317, BD139, IRLZ34N, 1N4007, TO-220 ...) sind Namen, keine Rechenzahlen */
  function partTokens() {
    const out = [], C = CORE(); if (!C) return out;
    try { Object.keys(C.devices).forEach(k => { const d = C.devices[k]; [k, d.name, d.part, d.pkg].forEach(x => numTokens(x).forEach(y => out.push(y))); }); } catch (e) { /* ohne Bauteiltabelle keine Namen */ }
    return out;
  }
  function allowedTokens(vals, extra, texts) {
    const set = new Set(FREI); partTokens().forEach(x => set.add(x));
    (function walk(o) { Object.keys(o || {}).forEach(k => { const v = o[k]; if (isObj(v) || Array.isArray(v)) walk(v); else variants(v).forEach(x => set.add(x)); }); })(vals);   // auch verschachtelte Werte (zum Beispiel Soll und Ist je Glied)
    (extra || []).forEach(v => variants(v).forEach(x => set.add(x)));
    (texts || []).forEach(tx => numTokens(tx).forEach(x => set.add(x)));
    return set;
  }
  THM_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Prüfung für eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  THM_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.THM_TASKS = THM_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await THM_TASKS.run(t, answerOf(t, t.start()))), L = await THM_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (24) */
  /* Jedes Beispiel: spec() liefert das Szenario (alle Steuerwerte, Ablauf, Dauer, Beginn im Beharrungszustand oder kalt), die Simulation rechnet es genau wie die
   * Oberfläche (Steuerwerte, THM_CORE.runSeq), und text(res, n, d) formuliert die Beschreibung. Jede Zahl der Beschreibung läuft über n(schlüssel, wert, stellen):
   * Sie steht danach in `vals` und stammt aus Simulation, Prüfstand oder Kern (Regel 1). Texte tragen {sym:key}-Platzhalter. */
  const fc = (rig, over) => fullCtl(rig, over);
  const L7 = over => fc('linear', Object.assign({ device: '7805', ue: 12, ua: 5, loadMode: 'strom', iLoad: 0.5, iq: false, swVergleich: false, heatsink: 'none', joint: 'direkt', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }, over));
  const MKK = { heatsink: 'm', joint: 'glimmer', paste: 'duenn' };            // Profil mittel, Glimmerscheibe, Wärmeleitpaste dünn
  const stOf = (res, i) => { const L = smp(res); const s = L[Math.min(Math.max(i, 0), L.length - 1)]; return s ? s.state || {} : {}; };
  const stAt = (res, t) => at(smp(res), t).state || {};
  const steadyOf = (ctl, dev, P) => CORE().steady(cfgOf(ctl, dev), P, ctl.ta);
  const min1 = s => s / 60;

  const EXDEFS = [
    /* ---------------------------------------------------------------- Linearregler */
    { id: 'thx1', name: '7805 ohne Kühlkörper: Abschaltung', cat: 'Linearregler', rig: 'linear',
      spec: () => ({ controls: L7({}), seq: [], dur: 600, settle: false, sampleS: 1 }),
      text(res, n, d) {
        const s1 = stOf(res, 1), C = CORE(), ch = C.chain(cfgOf(d.controls, '7805')), sd = C.steady(cfgOf(d.controls, '7805'), s1.pv, d.controls.ta), ev = res.events.find(e => e.fx === 'shutdown');
        const aus = smp(res).some(s => s.state && s.state.off);
        return 'Der 7805 steht ohne Kühlkörper im Raum und setzt bei Ue = ' + n('ue', d.controls.ue, 0) + ' V und Ia = ' + n('ia', d.controls.iLoad, 1) + ' A die Verlustleistung {sym:P} = ' + n('p', s1.pv, 1) + ' W um. Freistehend gilt {sym:Rth_JA} = ' + n('rja', ch.rthTotal, 0) + ' K/W: Im Beharrungszustand ergäbe das {sym:Tj} = ' + n('ta', d.controls.ta, 0) + ' °C + ' + n('p2', s1.pv, 1) + ' W · ' + n('rja2', ch.rthTotal, 0) + ' K/W = ' + n('tjInf', sd.tj, 0) + ' °C, weit über den zulässigen ' + n('tjmax', s1.tjMax, 0) + ' °C. Der Regler startet kalt und erreicht nach ' + n('tAb', ev ? ev.t : NaN, 0) + ' s Prozesszeit seine Abschalttemperatur (Übungswert ' + n('tshut', s1.tShut, 0) + ' °C), schaltet ab, kühlt bis ' + n('tback', s1.tShutBack, 0) + ' °C und schaltet wieder ein. In ' + n('dur', d.dur, 0) + ' s Prozesszeit zählt der Prüfstand ' + n('cnt', res.metrics.shutCount, 0) + ' Abschaltungen' + (aus ? ', bei jeder bricht die Ausgangsspannung ein' : '') + '. Die Abschaltung ist ein Schutz und kein Betriebspunkt: Der Regler braucht einen Kühlkörper.';
      } },
    { id: 'thx2', name: '7805 am Kühlkörper: Temperaturen der Kette', cat: 'Linearregler', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [], dur: 300, settle: true, sampleS: 5 }),
      text(res, n, d) {
        const s = stOf(res, 0);
        return 'Der 7805 sitzt auf dem Profil mittel, mit Glimmerscheibe und dünn aufgetragener Wärmeleitpaste. Die Verlustleistung {sym:P} = ' + n('p', s.pv, 1) + ' W fließt durch drei Wärmewiderstände in Reihe: {sym:Rth_JC} = ' + n('rjc', s.rthJC, 1) + ' K/W, {sym:Rth_CK} = ' + n('rck', s.rthCK, 1) + ' K/W und {sym:Rth_K} = ' + n('rk', s.rthK, 1) + ' K/W, zusammen {sym:Rth_ges} = ' + n('rges', s.rthTotal, 1) + ' K/W. Jedes Glied bekommt den Temperaturabfall P · Rth: ' + n('djc', s.dJC, 2) + ' K, ' + n('dck', s.dCK, 2) + ' K und ' + n('dk', s.dK, 0) + ' K. Von der Umgebung ' + n('ta', s.ta, 0) + ' °C aus ergibt sich im Beharrungszustand {sym:Tk} = ' + n('tk', s.tk, 0) + ' °C, {sym:Tc} = ' + n('tc', s.tc, 2) + ' °C und {sym:Tj} = ' + n('tj', s.tj, 2) + ' °C. Die Reserve bis zur zulässigen Sperrschichttemperatur (' + n('tjmax', s.tjMax, 0) + ' °C) beträgt ' + n('res', s.tjMax - s.tj, 2) + ' K.';
      } },
    { id: 'thx3', name: 'Last ändern: P wächst mit dem Strom', cat: 'Linearregler', rig: 'linear',
      spec: () => {
        const I = [0.1, 0.4, 0.7, 1], seq = I.map((v, i) => ({ t: i * 1800, set: { iLoad: v } }));
        return { controls: L7(Object.assign({ iLoad: 0.1 }, MKK)), seq, dur: 7200, settle: true, sampleS: 30, I };
      },
      text(res, n, d) {
        const parts = d.I.map((v, i) => { const s = stAt(res, i * 1800 + 2), sd = steadyOf(d.controls, '7805', s.pv); return { i: v, p: s.pv, tj: sd.tj, tjMax: s.tjMax }; });
        const last = parts[parts.length - 1];
        return 'Die Eingangsspannung bleibt bei ' + n('ue', d.controls.ue, 0) + ' V, der Laststrom Ia steigt alle ' + n('seg', 1800, 0) + ' s Prozesszeit: ' + parts.map((p, k) => n('i' + k, p.i, 1) + ' A').join(', ') + '. Die Verlustleistung {sym:P} = (Ue − Ua) · Ia wächst dabei geradlinig mit dem Strom: ' + parts.map((p, k) => n('p' + k, p.p, 1) + ' W').join(', ') + '. Mit dem Profil mittel (Glimmerscheibe, Paste) ergibt das im Beharrungszustand {sym:Tj} = ' + parts.map((p, k) => n('tj' + k, p.tj, 1) + ' °C').join(', ') + '.' + (last.tj > last.tjMax ? ' Beim größten Strom liegt {sym:Tj} über den zulässigen ' + n('tjmax', last.tjMax, 0) + ' °C: Der Kühlkörper ist für diesen Strom zu klein.' : '');
      } },
    { id: 'thx4', name: 'Eingangsspannung ändern: P wächst mit Ue', cat: 'Linearregler', rig: 'linear',
      spec: () => {
        const U = [8, 12, 16, 20, 24], seq = U.map((v, i) => ({ t: i * 1500, set: { ue: v } }));
        return { controls: L7(Object.assign({ ue: 8, heatsink: 'l', joint: 'glimmer' }, { paste: 'duenn' })), seq, dur: 7500, settle: true, sampleS: 30, U };
      },
      text(res, n, d) {
        const parts = d.U.map((v, i) => { const s = stAt(res, i * 1500 + 2), sd = steadyOf(d.controls, '7805', s.pv); return { u: v, p: s.pv, tj: sd.tj, tjMax: s.tjMax }; });
        return 'Der Laststrom bleibt bei ' + n('ia', d.controls.iLoad, 1) + ' A, die Ausgangsspannung bei ' + n('ua', d.controls.ua, 0) + ' V, die Eingangsspannung steigt alle ' + n('seg', 1500, 0) + ' s Prozesszeit: ' + parts.map((p, k) => n('u' + k, p.u, 0) + ' V').join(', ') + '. Der Regler verbrennt die Differenz: {sym:P} = (Ue − Ua) · Ia = ' + parts.map((p, k) => n('p' + k, p.p, 1) + ' W').join(', ') + '. Mit dem Profil groß (Glimmerscheibe, Paste, {sym:Rth_ges} = ' + n('rges', CORE().chain(cfgOf(d.controls, '7805')).rthTotal, 1) + ' K/W) steigt {sym:Tj} im Beharrungszustand auf ' + parts.map((p, k) => n('tj' + k, p.tj, 0) + ' °C').join(', ') + '. Ein höheres Ue bringt dem Verbraucher nichts, es heizt nur den Regler.';
      } },
    { id: 'thx5', name: 'Glimmerscheibe ohne Paste: wie viel heißer?', cat: 'Montage', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [{ t: 1800, set: { paste: 'keine' } }], dur: 5400, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const C = CORE(), s0 = stOf(res, 0), c1 = Object.assign({}, d.controls), c2 = Object.assign({}, d.controls, { paste: 'keine' });
        const a = C.steady(cfgOf(c1, '7805'), s0.pv, 25), b = C.steady(cfgOf(c2, '7805'), s0.pv, 25), sEnd = stOf(res, smp(res).length - 1);
        return 'Der 7805 sitzt mit Glimmerscheibe am Profil mittel und läuft mit {sym:P} = ' + n('p', s0.pv, 1) + ' W im Beharrungszustand bei {sym:Tj} = ' + n('tj1', a.tj, 2) + ' °C. Nach ' + n('tw', 1800, 0) + ' s Prozesszeit wird die Wärmeleitpaste weggelassen: {sym:Rth_CK} steigt von ' + n('rck1', a.rthCK, 1) + ' K/W auf ' + n('rck2', b.rthCK, 1) + ' K/W, weil Luft zwischen Gehäuse und Glimmerscheibe bleibt. Die Sperrschicht wird um ' + n('dtj', b.tj - a.tj, 2) + ' K heißer (P · ΔRth_CK = ' + n('p2', s0.pv, 1) + ' W · ' + n('drck', b.rthCK - a.rthCK, 1) + ' K/W) und läuft auf ' + n('tj2', b.tj, 2) + ' °C zu; nach ' + n('tend', 5400, 0) + ' s Prozesszeit steht sie bei ' + n('tje', sEnd.tj, 1) + ' °C. Die Paste füllt die Luftspalte und kostet nichts.';
      } },
    { id: 'thx6', name: 'Paste dünn, dick oder keine', cat: 'Montage', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [{ t: 1800, set: { paste: 'dick' } }, { t: 3600, set: { paste: 'keine' } }], dur: 5400, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const C = CORE(), s0 = stOf(res, 0), V = ['duenn', 'dick', 'keine'].map(p => { const c = Object.assign({}, d.controls, { paste: p }); return C.steady(cfgOf(c, '7805'), s0.pv, 25); });
        return 'Dieselbe Montage (Profil mittel, Glimmerscheibe, {sym:P} = ' + n('p', s0.pv, 1) + ' W) mit drei Wärmeleitpasten-Zuständen, jeweils ' + n('seg', 1800, 0) + ' s Prozesszeit lang: dünn aufgetragen {sym:Rth_CK} = ' + n('r1', V[0].rthCK, 2) + ' K/W und {sym:Tj} = ' + n('t1', V[0].tj, 2) + ' °C, zu dick aufgetragen {sym:Rth_CK} = ' + n('r2', V[1].rthCK, 2) + ' K/W und {sym:Tj} = ' + n('t2', V[1].tj, 2) + ' °C, ganz ohne Paste {sym:Rth_CK} = ' + n('r3', V[2].rthCK, 2) + ' K/W und {sym:Tj} = ' + n('t3', V[2].tj, 2) + ' °C.' + (V[1].rthCK > V[0].rthCK && V[1].rthCK < V[2].rthCK ? ' Zu viel Paste ist schlechter als eine dünne Schicht (Faktor ' + n('fd', V[1].rthCK / V[0].rthCK, 1) + ' im Übungsmodell), aber immer noch besser als gar keine. Trage die Paste dünn auf.' : '');
      } },
    { id: 'thx7', name: '7805: Isolierscheibe überflüssig?', cat: 'Montage', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [{ t: 1800, set: { joint: 'direkt' } }], dur: 5400, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const C = CORE(), s0 = stOf(res, 0), c2 = Object.assign({}, d.controls, { joint: 'direkt' }), a = C.steady(cfgOf(d.controls, '7805'), s0.pv, 25), b = C.steady(cfgOf(c2, '7805'), s0.pv, 25), pot = C.devices['7805'].tab.potText;
        const kurz = faultHas(res, 'kurzschluss');
        return 'Beim 7805 liegt die Metallfahne an ' + pot + '. Der Kühlkörper in diesem Aufbau liegt ebenfalls an Masse, deshalb braucht der 7805 hier keine Isolierscheibe. Nach ' + n('tw', 1800, 0) + ' s Prozesszeit wird die Glimmerscheibe weggelassen und das Gehäuse direkt mit Paste auf den Kühlkörper geschraubt: {sym:Rth_CK} sinkt von ' + n('rck1', a.rthCK, 1) + ' K/W auf ' + n('rck2', b.rthCK, 1) + ' K/W, {sym:Tj} im Beharrungszustand von ' + n('tj1', a.tj, 2) + ' °C auf ' + n('tj2', b.tj, 2) + ' °C (' + n('dtj', a.tj - b.tj, 2) + ' K kühler bei {sym:P} = ' + n('p', s0.pv, 1) + ' W).' + (kurz ? '' : ' Die Prüfstandsmeldungen zeigen dabei keinen Kurzschluss.') + ' Bei anderen Bauteilen wäre das ein Fehler: Dort liegt die Fahne an einer Spannung (siehe Beispiel mit dem LM317).';
      } },
    { id: 'thx8', name: 'LM317 mit geerdetem Kühlkörper ohne Isolierung', cat: 'Montage', rig: 'linear',
      spec: () => ({ controls: L7({ device: 'lm317', ue: 15, ua: 5, iLoad: 0.3, heatsink: 'm', joint: 'direkt', paste: 'duenn', ksPot: 'masse' }), seq: [{ t: 60, set: { joint: 'glimmer' } }], dur: 1500, settle: false, sampleS: 5 }),
      text(res, n, d) {
        const C = CORE(), L = smp(res), s1 = (L.find(s => s.state && s.state.short) || L[0]).state, fin_ = stOf(res, L.length - 1), pot = C.devices.lm317.tab.potText;
        return 'Beim LM317 liegt die Metallfahne am Ausgang (' + pot + '). Wird er ohne Isolierscheibe auf den geerdeten Kühlkörper geschraubt, liegt der Ausgang an Masse: Der Prüfstand meldet Kurzschluss, die Ausgangsspannung fällt von ' + n('ua0', d.controls.ua, 0) + ' V auf ' + n('ua1', s1.ua, 0) + ' V, und der Strom steigt bis zur Strombegrenzung auf ' + n('ia1', s1.ia, 1) + ' A. Das ergibt ' + n('p1', s1.pv, 0) + ' W Verlustleistung im Regler, er schaltet thermisch ab und pendelt. Nach ' + n('tfix', 60, 0) + ' s Prozesszeit kommt eine Glimmerscheibe dazu (Isolierbuchse für die Schraube eingebaut): ' + (fin_.short ? 'Der Kurzschluss besteht weiter.' : 'Der Kurzschluss ist weg, am Ende der ' + n('dur', d.dur, 0) + ' s Prozesszeit liefert der LM317 wieder ' + n('ua2', fin_.ua, 1) + ' V bei ' + n('ia2', fin_.ia, 1) + ' A und setzt ' + n('p2', fin_.pv, 1) + ' W um.');
      } },
    { id: 'thx9', name: 'LM317 20 V auf 5 V, 1 A: kritisch', cat: 'Kühlkörper', rig: 'linear',
      spec: () => ({ controls: L7({ device: 'lm317', ue: 20, ua: 5, iLoad: 1, heatsink: 'xl', joint: 'glimmer', paste: 'duenn', ksPot: 'masse', fan: 'aus' }), seq: [{ t: 2400, set: { joint: 'direkt', ksPot: 'frei', fan: 'mittel' } }], dur: 6000, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const C = CORE(), s0 = stOf(res, 0), cfg1 = cfgOf(d.controls, 'lm317'), rk = C.rthKerf(cfg1, s0.pv, 25), c2 = Object.assign({}, d.controls, { joint: 'direkt', ksPot: 'frei', fan: 'mittel' }), a2 = C.steady(cfgOf(c2, 'lm317'), s0.pv, 25);
        const c3 = Object.assign({}, d.controls, { fan: 'stark' }), a3 = C.steady(cfgOf(c3, 'lm317'), s0.pv, 25), best = C.heatsinks.map(h => h.rthK).reduce((m, v) => Math.min(m, v), Infinity) * C.fan.stark, pot = C.devices.lm317.tab.potText;
        return 'Der LM317 wandelt ' + n('ue', d.controls.ue, 0) + ' V auf ' + n('ua', d.controls.ua, 0) + ' V bei ' + n('ia', d.controls.iLoad, 0) + ' A: {sym:P} = ' + n('p', s0.pv, 0) + ' W. Mit Glimmerscheibe und Paste ({sym:Rth_JC} = ' + n('rjc', s0.rthJC, 0) + ' K/W, {sym:Rth_CK} = ' + n('rck', s0.rthCK, 1) + ' K/W) bleibt für den Kühlkörper nur {sym:Rth_Kerf} = ' + n('rkerf', rk.value, 2) + ' K/W übrig. Selbst der größte Kühlkörper mit starkem Lüfter schafft nur ' + n('best', best, 2) + ' K/W: Mit dem Rippenkörper sehr groß liegt {sym:Tj} im Beharrungszustand bei ' + n('tj1', s0.tj, 0) + ' °C, mit Lüfter stark bei ' + n('tj3', a3.tj, 0) + ' °C, beides über den zulässigen ' + n('tjmax', s0.tjMax, 0) + ' °C. Nach ' + n('tw', 2400, 0) + ' s Prozesszeit wird die Isolierscheibe weggelassen (Paste direkt, {sym:Rth_CK} = ' + n('rck2', a2.rthCK, 1) + ' K/W), der Kühlkörper isoliert aufgebaut (er liegt jetzt an der Fahne: ' + pot + ') und der Lüfter mittel eingeschaltet: {sym:Tj} sinkt auf ' + n('tj2', a2.tj, 1) + ' °C. Das Beispiel zeigt auch: Bei dieser Leistung hilft nur Verlustleistung senken, ein anderer Aufbau oder ein Schaltregler.';
      } },
    { id: 'thx10', name: 'LM317 an Widerstandslast: Worst-Case', cat: 'Linearregler', rig: 'linear',
      spec: () => {
        const UA = [2.5, 5, 7.5, 10, 12.5], seq = UA.map((v, i) => ({ t: i * 600, set: { ua: v } }));
        return { controls: L7({ device: 'lm317', ue: 15, ua: 2.5, loadMode: 'widerstand', rLoad: 10, heatsink: 'l', joint: 'glimmer', paste: 'duenn' }), seq, dur: 3000, settle: true, sampleS: 30, UA };
      },
      text(res, n, d) {
        const parts = d.UA.map((v, i) => { const s = stAt(res, i * 600 + 2); return { ua: v, p: s.pv, ia: s.ia }; }), mx = parts.reduce((m, p) => (p.p > m.p ? p : m), parts[0]);
        return 'Der LM317 speist eine Widerstandslast von ' + n('rl', d.controls.rLoad, 0) + ' Ω aus Ue = ' + n('ue', d.controls.ue, 0) + ' V. Die Ausgangsspannung wird alle ' + n('seg', 600, 0) + ' s Prozesszeit verstellt: ' + parts.map((p, k) => n('ua' + k, p.ua, 1) + ' V').join(', ') + '. Der Strom ist dabei Ia = Ua / R, die Verlustleistung {sym:P} = (Ue − Ua) · Ua / R: ' + parts.map((p, k) => n('p' + k, p.p, 2) + ' W').join(', ') + '. Sie ist am größten bei Ua = ' + n('uaMax', mx.ua, 1) + ' V, der Hälfte von Ue (Maximum der Parabel, ' + n('pMax', mx.p, 2) + ' W). Für die Auslegung zählt bei einer Widerstandslast deshalb nicht der größte Strom, sondern dieser Punkt.';
      } },
    { id: 'thx11', name: 'Dropout beim 7805', cat: 'Linearregler', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [{ t: 300, set: { ue: 6.5 } }], dur: 900, settle: true, sampleS: 20 }),
      text(res, n, d) {
        const s0 = stAt(res, 100), s1 = stAt(res, 800);
        return 'Der 7805 braucht zwischen Eingang und Ausgang mindestens die Dropout-Spannung, sonst regelt er nicht mehr. Bei ' + n('ia', d.controls.iLoad, 1) + ' A und dieser Sperrschichttemperatur sind das ' + n('vdo', s1.vdo, 2) + ' V (Datenblatt: steigt mit dem Strom und mit {sym:Tj}). Mit Ue = ' + n('ue0', s0.ue, 0) + ' V liegt der Ausgang bei ' + n('ua0', s0.ua, 1) + ' V. Nach ' + n('tw', 300, 0) + ' s Prozesszeit sinkt Ue auf ' + n('ue1', s1.ue, 1) + ' V: Der Spannungsabfall wäre mit ' + n('du', s1.ue - d.controls.ua, 1) + ' V kleiner als die Dropout-Spannung, der Ausgang bricht auf ' + n('ua1', s1.ua, 2) + ' V ein, und die Verlustleistung fällt auf ' + n('p1', s1.pv, 2) + ' W. Der Regler ist dann nur noch ein Durchlasswiderstand; gutes Siebelko-Brummen am Eingang käme am Ausgang durch.';
      } },
    /* ---------------------------------------------------------------- Vergleich */
    { id: 'thx12', name: 'Lüfter: hilft nur beim Kühlkörper', cat: 'Vergleich', rig: 'vergleich',
      spec: () => {
        const c = { device: '7805', pv: 3.5, ta: 25, n: 2 }; ['a', 'b'].forEach(k => { c['heatsink_' + k] = 'm'; c['joint_' + k] = 'glimmer'; c['paste_' + k] = 'duenn'; c['fan_' + k] = k === 'b' ? 'stark' : 'aus'; });
        return { controls: fc('vergleich', c), seq: [], dur: 300, settle: true, sampleS: 10 };
      },
      text(res, n, d) {
        const s = stOf(res, 0), A = s.aufbau.a, B = s.aufbau.b;
        return 'Zwei gleiche Aufbauten (7805, Profil mittel, Glimmerscheibe, Paste) mit derselben Verlustleistung {sym:P} = ' + n('p', d.controls.pv, 1) + ' W, nur der Lüfter unterscheidet sich. Aufbau A ohne Lüfter: {sym:Rth_JC} = ' + n('ajc', A.rthJC, 1) + ' K/W, {sym:Rth_CK} = ' + n('ack', A.rthCK, 1) + ' K/W, {sym:Rth_K} = ' + n('ak', A.rthK, 1) + ' K/W, {sym:Tj} = ' + n('atj', A.tj, 2) + ' °C. Aufbau B mit starkem Lüfter: {sym:Rth_JC} = ' + n('bjc', B.rthJC, 1) + ' K/W, {sym:Rth_CK} = ' + n('bck', B.rthCK, 1) + ' K/W, {sym:Rth_K} = ' + n('bk', B.rthK, 1) + ' K/W (Faktor ' + n('ff', CORE().fan.stark, 1) + ' auf den Kühlkörper), {sym:Tj} = ' + n('btj', B.tj, 2) + ' °C. Der Lüfter verbessert nur den Weg Kühlkörper–Umgebung. Gehäuse und Übergang bleiben, wie sie sind: Je kleiner {sym:Rth_K} schon ist, desto weniger bringt noch mehr Luft.';
      } },
    { id: 'thx13', name: 'Aufheizkurve: Zeitkonstante aus 63 %', cat: 'Zeitverhalten', rig: 'linear',
      spec: () => ({ controls: L7(MKK), seq: [], dur: 3000, settle: false, sampleS: 10 }),
      text(res, n, d) {
        const C = CORE(), L = smp(res), ch = C.chain(cfgOf(d.controls, '7805')), th = C.thermal(cfgOf(d.controls, '7805')), tau = th.tauDominant();
        const tk0 = L[0].tk, tkE = L[L.length - 1].tk, lev = tk0 + (1 - Math.exp(-1)) * (C.steady(cfgOf(d.controls, '7805'), L[1].p, 25).tk - tk0);
        let t63 = NaN; for (let i = 1; i < L.length; i++) if (L[i].tk >= lev) { t63 = L[i - 1].t + (lev - L[i - 1].tk) / (L[i].tk - L[i - 1].tk) * (L[i].t - L[i - 1].t); break; }
        const sdk = C.steady(cfgOf(d.controls, '7805'), L[1].p, 25).tk;
        return 'Das Bauteil startet kalt bei ' + n('ta', d.controls.ta, 0) + ' °C und heizt den Kühlkörper auf. Wie ein Kondensator über einen Widerstand lädt sich die Wärmekapazität des Kühlkörpers über {sym:Rth_K} = ' + n('rk', ch.rthK, 1) + ' K/W auf: Die Kurve von {sym:Tk} steigt zuerst steil und läuft dann flacher auf ' + n('tkInf', sdk, 0) + ' °C zu. Nach der Zeitkonstante τ sind 63 % des Anstiegs erreicht (nach 3 τ sind es ' + n('p3', 100 * (1 - Math.exp(-3)), 0) + ' %). In der Aufzeichnung wird die 63-%-Marke (' + n('lev', lev, 1) + ' °C) nach ' + n('t63', min1(t63), 1) + ' min Prozesszeit erreicht. Die Rechnung gibt dasselbe: τ ≈ {sym:Rth_K} · {sym:Cth} = ' + n('rk2', ch.rthK, 1) + ' K/W · ' + n('cth', ch.cth.k + ch.cth.c + ch.cth.j, 2) + ' J/K = ' + n('tauS', tau, 0) + ' s, das sind ' + n('tauM', min1(tau), 1) + ' min. Nach ' + n('dur', min1(d.dur), 0) + ' min steht {sym:Tk} bei ' + n('tkE', tkE, 1) + ' °C.';
      } },
    { id: 'thx14', name: 'Kühlkörper klein, mittel und groß', cat: 'Vergleich', rig: 'vergleich',
      spec: () => {
        const c = { device: '7805', pv: 3.5, ta: 25, n: 3 }; [['a', 's'], ['b', 'm'], ['c', 'l']].forEach(([k, h]) => { c['heatsink_' + k] = h; c['joint_' + k] = 'glimmer'; c['paste_' + k] = 'duenn'; c['fan_' + k] = 'aus'; });
        return { controls: fc('vergleich', c), seq: [], dur: 300, settle: true, sampleS: 10 };
      },
      text(res, n, d) {
        const s = stOf(res, 0), X = ['a', 'b', 'c'].map(k => s.aufbau[k]);
        return 'Drei Aufbauten mit demselben 7805 und derselben Verlustleistung {sym:P} = ' + n('p', d.controls.pv, 1) + ' W, jeweils mit Glimmerscheibe und Paste, nur der Kühlkörper ist verschieden. Profil klein: {sym:Rth_K} = ' + n('ak', X[0].rthK, 1) + ' K/W, {sym:Rth_ges} = ' + n('ag', X[0].rthTotal, 1) + ' K/W, {sym:Tj} = ' + n('at', X[0].tj, 2) + ' °C. Profil mittel: {sym:Rth_K} = ' + n('bk', X[1].rthK, 1) + ' K/W, {sym:Rth_ges} = ' + n('bg', X[1].rthTotal, 1) + ' K/W, {sym:Tj} = ' + n('bt', X[1].tj, 2) + ' °C. Profil groß: {sym:Rth_K} = ' + n('ck', X[2].rthK, 1) + ' K/W, {sym:Rth_ges} = ' + n('cg', X[2].rthTotal, 1) + ' K/W, {sym:Tj} = ' + n('ct', X[2].tj, 2) + ' °C. Die Temperaturen unterscheiden sich um P · ΔRth_K: Vom kleinen zum großen Kühlkörper sind das ' + n('dt', X[0].tj - X[2].tj, 2) + ' K. Die festen Anteile {sym:Rth_JC} = ' + n('jc', X[0].rthJC, 0) + ' K/W und {sym:Rth_CK} = ' + n('ck2', X[0].rthCK, 1) + ' K/W sind in allen drei Aufbauten gleich.';
      } },
    { id: 'thx15', name: 'Einbaulage waagrecht', cat: 'Vergleich', rig: 'vergleich',
      spec: () => {
        const c = { device: '7805', pv: 3.5, ta: 25, n: 2 }; ['a', 'b'].forEach(k => { c['heatsink_' + k] = 'm'; c['joint_' + k] = 'glimmer'; c['paste_' + k] = 'duenn'; c['fan_' + k] = 'aus'; c['orient_' + k] = k === 'b' ? 'waagrecht' : 'senkrecht'; });
        return { controls: fc('vergleich', c), seq: [], dur: 300, settle: true, sampleS: 10 };
      },
      text(res, n, d) {
        const s = stOf(res, 0), A = s.aufbau.a, B = s.aufbau.b;
        return 'Dasselbe Profil mittel mit {sym:P} = ' + n('p', d.controls.pv, 1) + ' W, einmal mit senkrecht stehenden Rippen (A) und einmal waagrecht eingebaut (B). Bei senkrechten Rippen steigt die warme Luft wie in einem Kamin zwischen den Rippen auf: {sym:Rth_K} = ' + n('ak', A.rthK, 1) + ' K/W. Waagrecht liegt der Luftstrom quer zu den Rippen, der Übungswert ist der Faktor ' + n('f', CORE().orient.waagrecht, 2) + ': {sym:Rth_K} = ' + n('bk', B.rthK, 1) + ' K/W. Die Sperrschicht wird dadurch von ' + n('at', A.tj, 2) + ' °C auf ' + n('bt', B.tj, 2) + ' °C heißer (' + n('dt', B.tj - A.tj, 2) + ' K = P · ΔRth_K). Die Einbaulage kostet nichts: Stelle Kühlkörper mit den Rippen senkrecht ein, wenn du die Wahl hast.';
      } },
    /* ---------------------------------------------------------------- Transistor */
    { id: 'thx16', name: 'BD139 als Längstransistor: Kühlkörper nötig?', cat: 'Transistor', rig: 'transistor',
      spec: () => ({ controls: fc('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 1, heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq: [], dur: 600, settle: true, sampleS: 10 }),
      text(res, n, d) {
        const C = CORE(), s = stOf(res, 0), frei = C.steady({ device: 'bd139' }, s.pv, 25), dev = C.devices.bd139;
        return 'Der BD139 liegt als Längstransistor an ' + n('uce', d.controls.uce, 0) + ' V Kollektor-Emitter-Spannung und führt ' + n('ic', d.controls.ic, 1) + ' A: {sym:P} = UCE · IC = ' + n('p', s.pv, 1) + ' W. Freistehend gilt {sym:Rth_JA} = ' + n('rja', frei.rthTotal, 0) + ' K/W: Im Beharrungszustand ergäbe das {sym:Tj} = ' + n('tjFrei', frei.tj, 0) + ' °C, weit über den zulässigen ' + n('tjmax', dev.tjMax, 0) + ' °C (im Übungsmodell ist er ab ' + n('dest', dev.destroyAt, 0) + ' °C defekt). Ja, der BD139 braucht hier einen Kühlkörper. Mit dem Profil mittel, Glimmerscheibe und Paste (die Fahne liegt am Kollektor) gilt {sym:Rth_ges} = ' + n('rges', s.rthTotal, 0) + ' K/W und {sym:Tj} = ' + n('tj', s.tj, 1) + ' °C, die Reserve beträgt ' + n('res', s.tjMax - s.tj, 1) + ' K.';
      } },
    { id: 'thx17', name: 'Zwei BD139 auf einem Kühlkörper', cat: 'Transistor', rig: 'transistor',
      spec: () => ({ controls: fc('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 1, heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq: [{ t: 1800, set: { count: 2 } }], dur: 6000, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const C = CORE(), s0 = stOf(res, 0), c1 = cfgOf(d.controls, 'bd139'), c2 = Object.assign({}, c1, { count: 2 }), a = C.steady(c1, s0.pv, 25), b = C.steady(c2, s0.pv, 25);
        return 'Ein BD139 mit {sym:P} = ' + n('p', s0.pv, 1) + ' W sitzt auf dem Profil mittel: {sym:Tk} = ' + n('tk1', a.tk, 1) + ' °C und {sym:Tj} = ' + n('tj1', a.tj, 1) + ' °C im Beharrungszustand. Nach ' + n('tw', 1800, 0) + ' s Prozesszeit kommt ein zweiter, gleicher BD139 dazu. Der Kühlkörper trägt jetzt die Summe ' + n('ps', 2 * s0.pv, 1) + ' W: Sein Temperaturabfall wächst von ' + n('dk1', a.dK, 1) + ' K auf ' + n('dk2', b.dK, 1) + ' K, {sym:Tk} steigt auf ' + n('tk2', b.tk, 1) + ' °C. Jeder Transistor sieht auf dem Weg Sperrschicht–Kühlkörper weiter nur seine eigene Leistung, trotzdem steigt {sym:Tj} auf ' + n('tj2', b.tj, 1) + ' °C. Rechne den Kühlkörper immer für die Gesamtleistung aller Bauteile darauf.';
      } },
    { id: 'thx18', name: 'Endstufe: größte Verlustleistung', cat: 'Transistor', rig: 'transistor',
      spec: () => {
        const A = [10, 30, 50, 64, 80, 100], seq = A.map((v, i) => ({ t: i * 300, set: { aus: v } }));
        return { controls: fc('transistor', { mode: 'endstufe', ub: 15, rl: 8, aus: 10, count: 1, heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq, dur: 1800, settle: true, sampleS: 10, A };
      },
      text(res, n, d) {
        const C = CORE(), e = C.power.endstufe(d.controls.ub, d.controls.rl), parts = d.A.map((v, i) => ({ a: v, p: stAt(res, i * 300 + 2).pv })), mx = parts.reduce((m, q) => (q.p > m.p ? q : m), parts[0]);
        return 'Eine Gegentakt-B-Endstufe mit Ub = ' + n('ub', d.controls.ub, 0) + ' V an RL = ' + n('rl', d.controls.rl, 0) + ' Ω; die Aussteuerung steigt alle ' + n('seg', 300, 0) + ' s Prozesszeit: ' + parts.map((q, k) => n('a' + k, q.a, 0) + ' %').join(', ') + '. Die Verlustleistung je Transistor ist ' + parts.map((q, k) => n('p' + k, q.p, 2) + ' W').join(', ') + ': Sie ist nicht bei Vollaussteuerung am größten, sondern bei Û = 2 · Ub / π, das sind ' + n('amax', 100 * e.aMax, 0) + ' % Aussteuerung. Dort gilt {sym:P}max = Ub² / (π² · RL) = ' + n('pmax', e.pMax, 2) + ' W. Der Kühlkörper muss für diesen Wert ausgelegt werden (größte gemessene Stufe im Versuch: ' + n('amx', mx.a, 0) + ' %).';
      } },
    /* ---------------------------------------------------------------- MOSFET */
    { id: 'thx19', name: 'MOSFET bei Dauerlast: RDS(on) heiß', cat: 'MOSFET', rig: 'mosfet',
      spec: () => ({ controls: fc('mosfet', { id: 10, u: 24, duty: 100, f: 20000, vgs: 5, spec: 'typ', hot: false, pulse: false, heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq: [{ t: 1800, set: { hot: true } }], dur: 7200, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const s0 = stOf(res, 0), sE = stOf(res, smp(res).length - 1), cp = CORE().coupled.mosfet({ i: d.controls.id, d: 1, rds25: s0.rds25, alpha: s0.alpha, u: d.controls.u, f: 0, tr: 0, tf: 0, rth: s0.rthTotal, ta: 25 });
        return 'Der IRLZ34N führt ' + n('i', d.controls.id, 0) + ' A Dauerstrom bei ' + n('vgs', d.controls.vgs, 0) + ' V Gate-Spannung (typischer Wert, ' + n('rds', 1000 * s0.rds25, 0) + ' mΩ bei 25 °C). Zuerst rechnet der Prüfstand mit dem kalten Wert: Leitverlust {sym:P} = I² · RDS(on) = ' + n('p0', s0.pLeit, 2) + ' W und {sym:Tj} = ' + n('tj0', s0.tj, 1) + ' °C. Nach ' + n('tw', 1800, 0) + ' s Prozesszeit wird die Temperaturabhängigkeit eingeschaltet: Der Widerstand wächst mit {sym:Tj} (Übungswert ' + n('al', 100 * s0.alpha, 2) + ' % je K) auf ' + n('rdsH', 1000 * sE.rdsHot, 0) + ' mΩ, die Verlustleistung auf ' + n('p1', sE.pLeit, 2) + ' W und {sym:Tj} auf ' + n('tj1', sE.tj, 1) + ' °C. Die Rückkopplung bleibt stabil, solange die Schleifenverstärkung G = P · α · {sym:Rth_ges} = ' + n('g', sE.G, 2) + ' unter 1 liegt; die geschlossene Rechnung ergibt {sym:Tj} = ' + n('tjc', cp.tj, 1) + ' °C. Rechne bei Dauerlast immer mit dem heißen Widerstandswert.';
      } },
    { id: 'thx20', name: 'MOSFET mit PWM: Schaltverluste über f', cat: 'MOSFET', rig: 'mosfet',
      spec: () => {
        const F = [1000, 20000, 100000], seq = F.map((v, i) => ({ t: i * 900, set: { f: v } }));
        return { controls: fc('mosfet', { id: 10, u: 24, duty: 50, f: 1000, vgs: 5, spec: 'typ', hot: false, pulse: false, heatsink: 'm', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq, dur: 2700, settle: true, sampleS: 30, F };
      },
      text(res, n, d) {
        const dev = CORE().devices.irlz34n, parts = d.F.map((v, i) => { const s = stAt(res, i * 900 + 2); return { f: v, pl: s.pLeit, ps: s.pSw, pt: s.pTotal }; });
        return 'Der IRLZ34N schaltet ' + n('u', d.controls.u, 0) + ' V bei ' + n('i', d.controls.id, 0) + ' A mit ' + n('d', d.controls.duty, 0) + ' % Tastverhältnis; die Frequenz steigt alle ' + n('seg', 900, 0) + ' s Prozesszeit: ' + parts.map((p, k) => n('f' + k, p.f / 1000, 0) + ' kHz').join(', ') + '. Der Leitverlust ' + n('pl', parts[0].pl, 2) + ' W bleibt gleich (D · I² · RDS(on), kalt gerechnet). Der Schaltverlust {sym:P}sw = ½ · U · I · (tr + tf) · f wächst mit der Frequenz: ' + parts.map((p, k) => n('ps' + k, p.ps, 2) + ' W').join(', ') + ' (Näherung mit tr = ' + n('tr', 1e9 * dev.tr, 0) + ' ns und tf = ' + n('tf', 1e9 * dev.tf, 0) + ' ns aus dem Übungsdatenblatt, nur für den dort genannten Gate-Widerstand gültig). Die gesamte Verlustleistung beträgt damit ' + parts.map((p, k) => n('pt' + k, p.pt, 2) + ' W').join(', ') + '.';
      } },
    { id: 'thx21', name: 'MOSFET: thermische Mitkopplung', cat: 'MOSFET', rig: 'mosfet',
      spec: () => ({ controls: fc('mosfet', { id: 18, u: 12, duty: 100, f: 20000, vgs: 5, spec: 'typ', hot: true, pulse: false, heatsink: 's', joint: 'glimmer', paste: 'duenn', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'aus', orient: 'senkrecht', ta: 25 }), seq: [], dur: 3600, settle: false, sampleS: 10 }),
      text(res, n, d) {
        const C = CORE(), L = smp(res), s1 = stOf(res, 1), dev = C.devices.irlz34n, ev = res.events.find(e => /defekt/i.test(e.text || '') || e.id === 'defekt'), cg = C.chain(cfgOf(d.controls, 'irlz34n'));
        const g = s1.pLeit * s1.alpha * cg.rthTotal;
        const cx = Object.assign({}, d.controls, { heatsink: 'xl' }), cgx = C.chain(cfgOf(cx, 'irlz34n')), gx = s1.pLeit * s1.alpha * cgx.rthTotal;
        const last = L[L.length - 1].state;
        return 'Der IRLZ34N führt ' + n('i', d.controls.id, 0) + ' A Dauerstrom bei ' + n('vgs', d.controls.vgs, 0) + ' V Gate-Spannung und sitzt auf dem kleinen Profil ({sym:Rth_ges} = ' + n('rges', cg.rthTotal, 1) + ' K/W). Der Leitverlust ' + n('p0', s1.pLeit, 1) + ' W (kalt) wächst mit {sym:Tj}, weil RDS(on) steigt. Die Schleifenverstärkung ist G = P · α · {sym:Rth_ges} = ' + n('g', g, 2) + ' mit α = ' + n('al', 100 * s1.alpha, 2) + ' % je K, also größer als 1: Jedes Kelvin mehr erzeugt mehr als ein Kelvin zusätzlich, die Temperatur läuft weg. Im Prüfstand' + (ev ? ' meldet der Defekt (Übungsmodell, ab ' + n('dest', dev.destroyAt, 0) + ' °C) nach ' + n('tdef', ev.t, 0) + ' s Prozesszeit' : ' steigt {sym:Tj} nach ' + n('dur', d.dur, 0) + ' s Prozesszeit auf ' + n('tjE', last.tj, 0) + ' °C') + '. Mit dem Rippenkörper sehr groß ({sym:Rth_ges} = ' + n('rgx', cgx.rthTotal, 1) + ' K/W) wäre G = ' + n('gx', gx, 2) + ': stabil. Bei Schalter-MOSFETs gehört die Mitkopplungsbedingung zur Kühlkörperrechnung.';
      } },
    /* ---------------------------------------------------------------- Bauteile */
    { id: 'thx22', name: 'Diode 1 A: Ladeelko-Impulse', cat: 'Bauteile', rig: 'bauteil',
      spec: () => ({ controls: fc('bauteil', { device: 'diode', iF: 1, ff: 1, ta: 25, heatsink: 'none' }), seq: [{ t: 900, set: { ff: 3 } }], dur: 2400, settle: true, sampleS: 20 }),
      text(res, n, d) {
        const s0 = stAt(res, 5), s1 = stAt(res, 2400);
        return 'Die Diode 1N4007 führt im Mittel ' + n('i', d.controls.iF, 0) + ' A. Bei Gleichstrom (Formfaktor ' + n('ff0', s0.iRms / d.controls.iF, 0) + ') ist {sym:P} = ' + n('p0', s0.p, 2) + ' W und {sym:Tj} = ' + n('tj0', s0.tj, 0) + ' °C. Nach ' + n('tw', 900, 0) + ' s Prozesszeit fließt derselbe Mittelwert als Ladeelko-Impulse: Der Effektivwert ist ' + n('irms', s1.iRms, 1) + ' A (Formfaktor ' + n('ff1', s1.iRms / d.controls.iF, 0) + ', Übungswert), die Verlustleistung steigt auf ' + n('p1', s1.p, 2) + ' W, {sym:Tj} auf ' + n('tj1', s1.tj, 0) + ' °C und die Anschlussdrahttemperatur auf ' + n('tl', s1.tL, 0) + ' °C. Der Mittelwert des Stroms sagt allein nicht, wie warm die Diode wird: Die Impulsform zählt über den Effektivwert mit.';
      } },
    { id: 'thx23', name: 'Zementwiderstand: wie heiß wird er?', cat: 'Bauteile', rig: 'bauteil',
      spec: () => ({ controls: fc('bauteil', { device: 'rzement', uR: 12, rR: 47, ta: 25, heatsink: 'none' }), seq: [{ t: 2400, set: { ta: 60 } }], dur: 5400, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const s0 = stAt(res, 5), s1 = stAt(res, 5400);
        return 'Ein Zementwiderstand ' + n('rr', d.controls.rR, 0) + ' Ω an ' + n('u', d.controls.uR, 0) + ' V setzt {sym:P} = U² / R = ' + n('p', s0.p, 2) + ' W um, das sind ' + n('anteil', 100 * s0.p / s0.pNom, 0) + ' % der Nennleistung ' + n('pn', s0.pNom, 0) + ' W. Bei ' + n('ta0', s0.ta, 0) + ' °C Umgebung wird seine Oberfläche ' + n('t0', s0.tj, 0) + ' °C heiß (Übungswert für den Wärmewiderstand), zulässig sind ' + n('pz0', s0.pzul, 1) + ' W. Nach ' + n('tw', 2400, 0) + ' s Prozesszeit steigt die Umgebungstemperatur auf ' + n('ta1', s1.ta, 0) + ' °C, zum Beispiel im Gerät: Die Oberfläche erreicht ' + n('t1', s1.tj, 0) + ' °C, und die zulässige Leistung sinkt auf ' + n('pz1', s1.pzul, 1) + ' W (Derating). Betreibe Leistungswiderstände nicht an der Nennleistung, wenn es im Gerät warm wird.';
      } },
    { id: 'thx24', name: 'LED-Treiber: Vorwiderstand gegen LM317', cat: 'Bauteile', rig: 'bauteil',
      spec: () => ({ controls: fc('bauteil', { device: 'led', n: 3, ub: 24, iLed: 0.7, driver: 'vorwiderstand', heatsink: 'm', joint: 'direkt', paste: 'duenn', ta: 25 }), seq: [{ t: 1800, set: { driver: 'lm317cc' } }], dur: 4500, settle: true, sampleS: 30 }),
      text(res, n, d) {
        const s0 = stAt(res, 5), s1 = stAt(res, 4500);
        return d.controls.n + ' Power-LEDs in Reihe an ' + n('ub', d.controls.ub, 0) + ' V sollen ' + n('il', d.controls.iLed, 1) + ' A führen. Mit Vorwiderstand ' + n('rv', s0.rv, 0) + ' Ω (E12-Wert, aufgerundet) fließt ' + n('i0', s0.iAct, 3) + ' A, und im Widerstand bleiben {sym:P} = ' + n('pt0', s0.pTreiber, 2) + ' W als Verlustleistung des Treibers; die LEDs erreichen {sym:Tj} = ' + n('tj0', s0.tj, 1) + ' °C. Nach ' + n('tw', 1800, 0) + ' s Prozesszeit regelt eine LM317-Konstantstromquelle den Strom: ' + n('i1', s1.iAct, 3) + ' A, der Treiber setzt ' + n('pt1', s1.pTreiber, 2) + ' W um (Regler ' + n('pr', s1.pReg, 2) + ' W und Messwiderstand ' + n('prs', s1.pRs, 2) + ' W), die LEDs erreichen {sym:Tj} = ' + n('tj1', s1.tj, 1) + ' °C. Die Quelle hält den Strom bei Spannungsschwankungen fest; beide Treiber verbrennen den Spannungsüberschuss, ein Schaltregler würde das nicht tun.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['linear', 'transistor', 'mosfet', 'bauteil', 'vergleich']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), res = run(def.rig, d.controls, d.seq || [], d.dur, { settle: d.settle, sampleS: d.sampleS }), vals = {};
        const nf = (k, v, dg) => { if (!fin(v)) throw new Error('Wert "' + k + '" ist keine Zahl'); vals[k] = v; return fm(v, dg); };
        const n = (k, v, dg) => { const t = nf(k, v, dg); return t.indexOf(',') >= 0 ? t.replace(/0+$/, '').replace(/,$/, '') : t; };
        const desc = def.text(res, n, d, nf);
        if (/NaN|undefined|Infinity/.test(desc)) throw new Error('ungültiger Wert im Text: ' + desc.slice(0, 80));
        const rej = new Set((res.rejected || []).map(x => x.key)), ctl = {}; Object.keys(d.controls).forEach(k => { if (!rej.has(k)) ctl[k] = d.controls[k]; });   // Steuerwerte, die dieses Bauteil nicht kennt (zum Beispiel Kühlkörper bei der Diode), bleiben weg
        const ex = { id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc, controls: ctl, vals };
        if (d.seq && d.seq.length) ex.seq = d.seq;
        ex.dur = d.dur; ex.settle = d.settle === true;
        out.push(ex);
      } catch (e) { out.push({ id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc: 'Dieses Beispiel konnte nicht berechnet werden: ' + String(e && e.message || e), controls: {}, vals: {}, error: String(e && e.message || e) }); }
    });
    return out;
  }
  const THM_DATA = {};
  Object.defineProperty(THM_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  THM_DATA.exampleCount = EXDEFS.length;
  root.THM_DATA = THM_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.THM_DATA.examples; }, tasks, register, THM_TASKS, answerOf, clean, run };
})(typeof window !== 'undefined' ? window : globalThis);
