/* regdata.js - Regelungstechnik-Lab: Beispiele (REG_DATA) und Aufgabenregister (REG_TASKS), ohne Browser lauffähig.
 * window.REG_DATA  = { examples: [ { id:'rgx1'..'rgx24', name, cat, rig, desc, controls, seq?, dur?, op?, vals } ] }
 *   Alle Zahlen in `desc` kommen aus Simulation und Kern (REG_CORE, REG_RIGS) und stehen in `vals`. `examples` wird beim ersten Zugriff
 *   gerechnet (Getter); fehlen Kern oder Prüfstände, ist die Liste leer (regui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Prüfstands, seq im Format von REG_CORE.runSeq (t in Prozess-SEKUNDEN, set | ramp), dur in Sekunden,
 *   op = { y } (setOperatingPoint, schaltet auf Hand; Beispiele mit Regler setzen deshalb { t:0, set:{ mode:'auto' } } an den Anfang).
 * window.REG_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id) }
 *   Die Aufgaben stehen in regtasks1.js (rg1-rg15) und regtasks2.js (rg16-rg30) und melden sich mit REG_TASKS.register([...]) an;
 *   die Reihenfolge der Registry ist immer rg1, rg2, ... (unabhängig von der Ladereihenfolge).
 *   Aufgabe: { id:'rgN', lab:'reg', cat, title, level, rig, text, hint[3], start(), sol(), check(answer), fields?, choices?, ask?, hintVals() }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls:{key:Wert}, seq:[{t(s), set|ramp}], rows, dur(s), state, simTime, value, text, fields:{key:Zahl|null},
 *              choices:{key:Wert}, kennwerte:{Ks,Kis,Tu,Tg,Kkrit,Tkrit,T1,TsumKlein (Sekunden)}, op }
 *   start() und sol() liefern { rig, controls, op?, seq?, dur?, value?, fields?, choices? }; value/fields/choices dienen dem Selbsttest.
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * REG_TASKS.util (für regtasks1.js und regtasks2.js; Schnittstelle, die WP4b mitbenutzen kann):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); run(rig, ctl, seq, T, o?) -> Ergebnis von REG_CORE.runSeq (Prüfstand frisch, Steuerwerte in fester Reihenfolge, o.op, o.after,
 *   o.sampleS, o.seed, o.x0); mk(rigId, fn) -> check(answer); inputRow(c, r, sim, a, rigId); idAt(rig, ctl, y) -> identify am Arbeitspunkt;
 *   winMean/winMax/winMin/winP2P(samples, t0, t1, f); at(samples, t); faultHas(res, id); memo(obj, key, fn); fieldNum(a, key); numAns(a);
 *   cycles(samples, key); stepSeg(samples, t0, t1, w0, w1, range) (stepMetrics eines Abschnitts); hasWord(texts); variants(v) (Zahlentoken);
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben.
 * REG_TASKS.audit(task) und REG_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) für den Selbsttest und die Tests;
 *   REG_TASKS.answerOf(task, startOderSol) baut ein Antwortobjekt wie die Oberfläche; REG_TASKS.thresholds1() (regtasks1.js) nennt die Musterwerte. */
(function (root) {
  'use strict';
  const CORE = () => root.REG_CORE, RIGS = () => root.REG_RIGS;
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return C.fmt(x, d); return fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '–'; };
  const toNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && typeof C.parseNum === 'function' ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);

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
      if (isObj(v) && 'rel' in v) v = def.min + (def.max - def.min) * (+v.rel || 0);
      const x = toNum(v); return fin(x) ? clamp(x, def.min, def.max) : undefined;
    }
    if (def.type === 'switch' || def.type === 'button') return v === undefined || v === null || isObj(v) || Array.isArray(v) ? undefined : !!v;
    if (def.type === 'select') {
      const o = def.options || [];
      const m = o.find(x => x.value === v) || o.find(x => String(x.value) === String(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
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
  const FIRST = ['device', 'type'];   // erst Gerät bzw. Streckenart, dann deren Werte (Bereiche ändern sich)
  /* Prüfstand frisch erzeugen, Steuerwerte setzen, optional Arbeitspunkt (Hand) und danach `after`, dann REG_CORE.runSeq.
   * o = { op:{y, x0?}, after:{key:Wert}, sampleS, seed, rigOpts } ; abgelehnte Werte stehen in result.rejected */
  function run(rigId, ctl, seq, T, o) {
    o = o || {};
    const C = CORE(), R = RIGS(), rejected = [];
    if (!C || typeof C.runSeq !== 'function') return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Der Kern (regcore.js) ist nicht geladen.'], rejected };
    if (!R || !R.defs || !R.defs[rigId]) return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Den Prüfstand „' + rigId + '“ gibt es nicht.'], rejected };
    const seed = fin(o.seed) ? o.seed : 1;
    let rig;
    try { rig = R.create(rigId, Object.assign({}, o.rigOpts || {}, { seed })); } catch (e) { return { ok: false, samples: [], final: null, events: [], faults: [], metrics: {}, errors: ['Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)], rejected }; }
    const setAll = (obj) => {
      if (!isObj(obj)) return;
      const ks = Object.keys(obj).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
      ks.forEach(k => { let ok; try { ok = rig.setControl(k, obj[k]); } catch (e) { ok = false; } if (ok === false) rejected.push({ key: k, value: obj[k] }); });
    };
    setAll(ctl);
    if (isObj(o.op) && fin(o.op.y)) { try { rig.setOperatingPoint(o.op.y, o.op.x0); } catch (e) { /* Prüfstand ohne Arbeitspunkt */ } }
    setAll(o.after);
    const res = C.runSeq(rig, Array.isArray(seq) ? seq : [], T, { reset: false, sampleS: o.sampleS, seed });
    res.rejected = (res.rejected || []).concat(rejected);
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
  /* Beginn der letzten n vollständigen Schaltspiele aus einem 0/1-Verlauf (Anfänge der Einschaltflanken); NaN bei weniger als n+1 Flanken */
  function cycleStart(samples, key, n) {
    const edges = []; let prev = null;
    samples.forEach(s => { const v = s.state && s.state[key] ? 1 : 0; if (prev === 0 && v === 1) edges.push(s.t); prev = v; });
    return edges.length >= n + 1 ? edges[edges.length - 1 - n] : NaN;
  }
  /* stepMetrics eines Abschnitts der Aufzeichnung [t0, t1) für einen Sollwertsprung w0 -> w1 bei t0 (x in Einheiten wie w) */
  function stepSeg(samples, t0, t1, w0, w1, range, xf) {
    const C = CORE(); const g = xf || (s => s.x), seg = samples.filter(s => s.t >= t0 - 1e-9 && s.t < t1 - 1e-9);
    return C.stepMetrics(seg.map(s => s.t), seg.map(g), { w0, w1, t0, tol: 0.02, range });
  }
  /* identify am Arbeitspunkt y (Hand, eingeschwungen) mit den Steuerwerten ctl */
  function idAt(rigId, ctl, y, o) {
    const R = RIGS(), C = CORE(); const rig = R.create(rigId, Object.assign({ seed: 1 }, o || {}));
    const ks = Object.keys(ctl || {}).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
    ks.forEach(k => rig.setControl(k, ctl[k]));
    if (fin(y) && typeof rig.setOperatingPoint === 'function') rig.setOperatingPoint(y);
    return { id: C.identify(rig.linBlocks()), rig };
  }
  /* alle Steuerwerte eines Prüfstands in der Reihenfolge der Bedienelemente (Standardwerte des frischen Prüfstands), darüber over */
  function fullCtl(rigId, over) {
    const R = RIGS(), defs = ctlDefs(rigId); const out = {};
    if (!R || !defs) return Object.assign({}, over || {});
    let rig = null; try { rig = R.create(rigId, { seed: 1 }); } catch (e) { rig = null; }
    defs.forEach(c => { let v; try { v = rig ? rig.getControl(c.key) : undefined; } catch (e) { v = undefined; } out[c.key] = v !== undefined ? v : c.value; });
    return Object.assign(out, over || {});
  }
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
        const r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
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
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 4; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^rg(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const REG_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, mean, ctlDefs, coerce, clean, initial, run, mk, inputRow, idAt, win, winMean, winMax, winMin, winP2P, at, faultHas, cycleStart, stepSeg, memo, fieldNum, numAns, variants, smp, pctOf, rowsToSeq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberfläche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig || task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null, text: '', fields: o.fields || {}, choices: o.choices || {}, kennwerte: o.kennwerte || null, op: o.op || null };
  }
  REG_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1, auch für den Selbsttest): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel
   * oder einer benannten Formelkonstante (task.consts) stammen; 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).match(/\d+(?:,\d+)?/g) || []);
  const FREI = ['0', '1', '2', '3', '100'];
  function allowedTokens(vals, extra, texts) {
    const set = new Set(FREI);
    Object.keys(vals || {}).forEach(k => variants(vals[k]).forEach(x => set.add(x)));
    (extra || []).forEach(v => variants(v).forEach(x => set.add(x)));
    (texts || []).forEach(tx => numTokens(tx).forEach(x => set.add(x)));
    return set;
  }
  REG_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Prüfung für eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs, des Arbeitspunkts und der Dauer */
  REG_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.seq || [], ex.op || {}, ex.dur]).replace(/-?\d+(?:\.\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.REG_TASKS = REG_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await REG_TASKS.run(t, answerOf(t, t.start()))), L = await REG_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };
  /* ====================================================================== Beispiele (24) */
  /* Jedes Beispiel: spec() liefert das Szenario (alle Steuerwerte, Arbeitspunkt, Ablauf), die Simulation rechnet es genau wie die Oberfläche
   * (Steuerwerte, Arbeitspunkt, Ablauf mit REG_CORE.runSeq), und text(res, n) formuliert die Beschreibung. Jede Zahl der Beschreibung läuft über
   * n(schlüssel, wert, stellen): Sie steht danach in `vals` und stammt aus Simulation, Prüfstand oder Kern (Regel 1). */
  const rigOf = (id, ctl) => { const r = RIGS().create(id, { seed: 1 }); const ks = Object.keys(ctl || {}).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)); ks.forEach(k => r.setControl(k, ctl[k])); return r; };
  const fc = (rig, over) => fullCtl(rig, over);
  const roundTo = (x, d) => { const f = Math.pow(10, d || 0); return Math.round(x * f) / f; };
  const idOf = (rigId, ctl, y) => { const r = rigOf(rigId, ctl); if (fin(y)) r.setOperatingPoint(y); return CORE().identify(r.linBlocks()); };
  const ruleOf = (m, id, type) => CORE().rules.apply(m, { Ks: id.Ks, Tu: id.Tu, Tg: id.Tg, Tsum: id.Tsum, TsumKlein: id.TsumKlein, T1: id.T1, T2: id.T2 }, type);
  const xAt = (L, t) => at(L, t).x;
  const pctOfRange = (x, lo, hi) => 100 * (x - lo) / (hi - lo);
  /* Pausen eines 0/1-Zustands (Zeit zwischen Aus- und nächstem Einschalten) innerhalb [t0, t1] */
  function pausesOf(L, key, t0, t1) {
    const out = []; let tOff = null, prev = null;
    L.forEach(s => { const v = s.state && s.state[key] ? 1 : 0; if (prev === 1 && v === 0) tOff = s.t; if (prev === 0 && v === 1 && tOff !== null) { if (tOff >= t0 && s.t <= t1) out.push(s.t - tOff); tOff = null; } prev = v; });
    return out;
  }
  const BK_PT3 = { type: 'pt3', ks: 1, t1: 10, t2: 5, t3: 2, tt: 0 };

  const EXDEFS = [
    /* ---------------------------------------------------------------- Füllstand */
    { id: 'rgx1', name: 'Füllstand von Hand: Arbeitspunkt finden', cat: 'Füllstand', rig: 'fuellstand',
      spec: () => ({ controls: fc('fuellstand', { mode: 'hand', yHand: 20, w: 50, z: 0, outflow: 'sqrt', noise: 0 }), op: { y: 20 }, seq: [{ t: 30, set: { yHand: 40 } }], dur: 400, sampleS: 1 }),
      text(res, n) {
        const rig = rigOf('fuellstand', { z: 0 }), h0 = rig.steady(20), h1 = rig.steady(40), L = smp(res), f = L.find(s => s.t >= 30 && s.x >= h0 + 0.95 * (h1 - h0));
        return 'Handbetrieb: Die Pumpe läuft mit fester Stellgröße, ein Regler greift nicht ein. Bei ' + n('y0', 20, 0) + ' % Pumpenleistung stellt sich der Füllstand auf ' + n('h0', h0, 1) + ' cm ein. Nach ' + n('tSprung', 30, 0) + ' s Prozesszeit steigt die Stellgröße auf ' + n('y1', 40, 0) + ' %, und der Füllstand wandert auf den neuen Beharrungswert ' + n('h1', h1, 1) + ' cm (Zufluss gleich Abfluss; bei dieser Übungsanlage gilt h = 2 m · (y / 100)²). Er braucht dafür ' + n('t95', f ? f.t - 30 : NaN, 0) + ' s Prozesszeit bis auf ' + n('tol', 5, 0) + ' % an den Endwert: Die Regelstrecke ist träge. Vergleiche die Werte an den Messgeräten mit dem Messschreiber.';
      } },
    { id: 'rgx2', name: 'Füllstand P-Regler: bleibende Abweichung', cat: 'Füllstand', rig: 'fuellstand',
      spec: () => ({ controls: fc('fuellstand', { mode: 'auto', ctrl: 'P', kp: 10, tv: 0, u0: 0, w: 40, z: 0, outflow: 'sqrt', noise: 0 }), seq: [{ t: 300, set: { kp: 20 } }], dur: 600, sampleS: 1 }),
      text(res, n) {
        const L = smp(res), e1 = 40 - winMean(L, 280, 299, s => s.x), e2 = 40 - winMean(L, 580, 600, s => s.x);
        return 'Der P-Regler stellt die Pumpe proportional zur Regeldifferenz. Mit Kp = ' + n('kp1', 10, 0) + ' erreicht der Füllstand den Sollwert ' + n('w', 40, 0) + ' cm nicht: Er bleibt ' + n('e1', e1, 1) + ' cm darunter (bleibende Regelabweichung), weil der Regler für jede Stellgröße eine Regeldifferenz braucht. Nach ' + n('tKp', 300, 0) + ' s Prozesszeit wird Kp auf ' + n('kp2', 20, 0) + ' verdoppelt: Die Abweichung sinkt auf ' + n('e2', e2, 1) + ' cm, verschwindet aber nie ganz. Erst ein I-Anteil (PI-Regler) beseitigt sie.';
      } },
    { id: 'rgx3', name: 'Füllstand PI-Regler: Abweichung verschwindet', cat: 'Füllstand', rig: 'fuellstand',
      spec: () => { const id = idOf('fuellstand', { z: 0 }, 50), a = ruleOf('zn-sprung', id, 'PI'); return { controls: fc('fuellstand', { mode: 'auto', ctrl: 'PI', kp: roundTo(a.Kp, 1), tn: roundTo(a.Tn, 1), tv: 0, aw: 'rueck', w: 50, z: 0, outflow: 'sqrt', noise: 0 }), op: { y: 50 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 20, set: { w: 65 } }], dur: 300, sampleS: 0.5, id, a }; },
      text(res, n, d) {
        const m = res.metrics.step, id = d.id;
        return 'Der PI-Regler hat die Werte der Einstellregel Ziegler-Nichols (Sprungantwort), gerechnet aus den Kennwerten der Strecke bei ' + n('y0', 50, 0) + ' % Pumpenleistung: Ks = ' + n('Ks', id.Ks, 1) + ', Tu = ' + n('Tu', id.Tu, 1) + ' s, Tg = ' + n('Tg', id.Tg, 1) + ' s, daraus Kp = ' + n('kp', d.controls.kp, 1) + ' und Tn = ' + n('tn', d.controls.tn, 1) + ' s. Nach dem Sollwertsprung von ' + n('w0', 50, 0) + ' auf ' + n('w1', 65, 0) + ' cm ist die bleibende Regelabweichung ' + n('ebl', Math.abs(m.ebl), 2) + ' cm: Der I-Anteil gleicht sie aus. Ziegler-Nichols stellt bewusst scharf ein: Das Überschwingen beträgt ' + n('ueber', m.ueberPct, 1) + ' %, die Ausregelzeit (2 %) ' + n('tAus', m.tAus2, 0) + ' s.';
      } },
    { id: 'rgx4', name: 'Füllstand: Entnahme als Störung', cat: 'Füllstand', rig: 'fuellstand',
      spec: () => ({ controls: fc('fuellstand', { mode: 'auto', ctrl: 'PI', kp: 5, tn: 40, tv: 0, aw: 'rueck', w: 50, z: 0, outflow: 'sqrt', noise: 0 }), op: { y: 50 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 30, set: { z: 60 } }], dur: 300, sampleS: 0.5 }),
      text(res, n) {
        const L = smp(res), d = CORE().disturbMetrics(L.map(s => s.t), L.map(s => s.x), { w: 50, tz: 30, range: 100, unit: 'cm' }), hand = rigOf('fuellstand', { z: 0 }).steady(50, 60);
        return 'Der Füllstand steht eingeschwungen bei ' + n('w', 50, 0) + ' cm. Nach ' + n('tz', 30, 0) + ' s Prozesszeit öffnet das Entnahmeventil auf ' + n('z', 60, 0) + ' %: Die Störgröße springt, es fließt mehr ab. Ohne Regler (Handbetrieb bei y = ' + n('y0', 50, 0) + ' %) sänke der Füllstand auf ' + n('hHand', hand, 1) + ' cm. Der PI-Regler (Kp = ' + n('kp', 5, 0) + ', Tn = ' + n('tn', 40, 0) + ' s) lässt ihn nur um ' + n('xd', Math.abs(d.xdMax), 1) + ' cm absinken und regelt ihn nach ' + n('tAus', d.tAus, 1) + ' s wieder ins Band von ±' + n('band', d.band, 0) + ' cm; die bleibende Abweichung ist ' + n('ebl', Math.abs(d.eblStoer), 2) + ' cm.';
      } },
    { id: 'rgx5', name: 'Füllstand: Düse oder Kapillare?', cat: 'Füllstand', rig: 'fuellstand',
      spec: () => ({ controls: fc('fuellstand', { mode: 'hand', yHand: 30, w: 50, z: 0, outflow: 'sqrt', noise: 0 }), op: { y: 30 }, seq: [{ t: 300, set: { outflow: 'lin' } }], dur: 800, sampleS: 1 }),
      text(res, n) {
        const a = rigOf('fuellstand', { outflow: 'sqrt', z: 0 }), b = rigOf('fuellstand', { outflow: 'lin', z: 0 }); a.setOperatingPoint(30); b.setOperatingPoint(30);
        const ia = CORE().identify(a.linBlocks()), ib = CORE().identify(b.linBlocks());
        return 'Der Abfluss kann über eine Düse (Auslauf mit Wurzelgesetz) oder eine Kapillare (laminar, Abfluss proportional zum Füllstand) erfolgen. Bei ' + n('y', 30, 0) + ' % Pumpenleistung steht der Füllstand mit der Düse bei ' + n('h1', a.steady(30), 1) + ' cm; nach ' + n('tU', 300, 0) + ' s Prozesszeit wird auf die Kapillare umgeschaltet, und er steigt auf ' + n('h2', b.steady(30), 1) + ' cm. Auch die Eigenschaften der Regelstrecke ändern sich: Düse Ks = ' + n('Ks1', ia.Ks, 2) + ' und größte Zeitkonstante ' + n('T1a', ia.T1, 0) + ' s, Kapillare Ks = ' + n('Ks2', ib.Ks, 2) + ' und ' + n('T1b', ib.T1, 0) + ' s. Die Düsenstrecke ist nichtlinear: Ks und T hängen vom Arbeitspunkt ab.';
      } },
    /* ---------------------------------------------------------------- Durchfluss */
    { id: 'rgx6', name: 'Durchfluss: linear oder gleichprozentig', cat: 'Durchfluss', rig: 'durchfluss',
      spec: () => ({ controls: fc('durchfluss', { mode: 'hand', yHand: 15, w: 50, z: 0, char: 'gleichprozentig', slew: '0', noise: 0 }), op: { y: 15 }, seq: [{ t: 10, set: { yHand: 25 } }, { t: 40, set: { yHand: 75 } }, { t: 70, set: { yHand: 85 } }], dur: 100, sampleS: 0.1 }),
      text(res, n) {
        const L = smp(res), g = y => { const r = rigOf('durchfluss', { char: 'gleichprozentig', z: 0 }); r.setOperatingPoint(y); return r.readMeters().gain; };
        const lin = (() => { const r = rigOf('durchfluss', { char: 'linear', z: 0 }); r.setOperatingPoint(50); return r.readMeters().gain; })();
        const d1 = xAt(L, 39) - xAt(L, 9), d2 = xAt(L, 99) - xAt(L, 69), g20 = g(20), g80 = g(80);
        return 'Das Regelventil hat hier eine gleichprozentige Kennlinie (R = ' + n('R', 30, 0) + '). Im Handbetrieb springt die Stellgröße zweimal um ' + n('dy', 10, 0) + ' %: von ' + n('a1', 15, 0) + ' auf ' + n('a2', 25, 0) + ' % Hub (um ' + n('m1', 20, 0) + ' % herum) und später von ' + n('b1', 75, 0) + ' auf ' + n('b2', 85, 0) + ' % (um ' + n('m2', 80, 0) + ' % herum). Der Durchfluss ändert sich beim ersten Sprung um ' + n('dQ1', d1, 1) + ' L/min, beim zweiten um ' + n('dQ2', d2, 1) + ' L/min. Das Messgerät „gain“ zeigt die Streckenverstärkung: bei ' + n('h20', 20, 0) + ' % Hub Ks = ' + n('g20', g20, 2) + ', bei ' + n('h80', 80, 0) + ' % Hub Ks = ' + n('g80', g80, 2) + ', das Verhältnis ist ' + n('ratio', g80 / g20, 1) + '. Bei linearer Kennlinie ist Ks überall ' + n('gLin', lin, 2) + '. Ein Regler muss bei so einer Strecke für beide Arbeitspunkte passen.';
      } },
    { id: 'rgx7', name: 'Durchfluss: Vordruck bricht ein', cat: 'Durchfluss', rig: 'durchfluss',
      spec: () => ({ controls: fc('durchfluss', { mode: 'auto', ctrl: 'PI', kp: 1, tn: 5, tv: 0, aw: 'rueck', w: 50, z: 0, char: 'linear', slew: '0', noise: 0 }), op: { y: 50 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 20, set: { z: -30 } }], dur: 80, sampleS: 0.05 }),
      text(res, n) {
        const L = smp(res), d = CORE().disturbMetrics(L.map(s => s.t), L.map(s => s.x), { w: 50, tz: 20, range: 120, unit: 'L/min' }), hand = rigOf('durchfluss', { char: 'linear', z: 0 }).steady(50, -30);
        const drop = 50 - hand, same = Math.abs(Math.abs(d.xdMax) - drop) < 0.5;
        return 'Der Durchfluss ist auf ' + n('w', 50, 0) + ' L/min geregelt. Nach ' + n('tz', 20, 0) + ' s Prozesszeit bricht der Vordruck um ' + n('z', 30, 0) + ' % ein (Störgröße). Ohne Regler (Handbetrieb) fiele der Durchfluss dauerhaft auf ' + n('qHand', hand, 1) + ' L/min. Mit dem PI-Regler (Kp = ' + n('kp', 1, 0) + ', Tn = ' + n('tn', 5, 0) + ' s) fällt er zuerst ' + (same ? 'genauso tief' : 'um ' + n('xd0', Math.abs(d.xdMax), 1) + ' L/min') + ' (um ' + n('xd', Math.abs(d.xdMax), 1) + ' L/min), weil Stellantrieb, Totzeit und Messglied den Regler verzögern. Dann öffnet der Regler das Ventil von ' + n('yA', at(L, 19).y, 0) + ' % auf ' + n('yE', res.final.y, 1) + ' %, und der Durchfluss ist nach ' + n('tAus', d.tAus, 1) + ' s wieder im Band von ±' + n('band', d.band, 1) + ' L/min. Die bleibende Abweichung ist ' + n('ebl', Math.abs(d.eblStoer), 2) + ' L/min.';
      } },
    /* ---------------------------------------------------------------- Raumtemperatur */
    { id: 'rgx8', name: 'Raumtemperatur: Sprungantwort mit Totzeit', cat: 'Raumtemperatur', rig: 'raumtemp',
      spec: () => ({ controls: fc('raumtemp', { mode: 'hand', yHand: 40, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 40 }, seq: [{ t: 600, set: { yHand: 50 } }], dur: 21600, sampleS: 10 }),
      text(res, n) {
        const L = smp(res), f = CORE().fitStep(L.map(s => s.t), L.map(s => pctOfRange(s.state.xm, 10, 30)), 10, { t0: 600 });
        return 'Im Handbetrieb springt die Ventilstellung nach ' + n('tS', 10, 0) + ' min Prozesszeit von ' + n('y0', 40, 0) + ' auf ' + n('y1', 50, 0) + ' %. Der Raum reagiert erst nach der Verzugszeit Tu = ' + n('Tu', f.Tu / 60, 1) + ' min (Heizkörper, Rohr-Totzeit und Fühler), und die Temperatur braucht die Ausgleichszeit Tg = ' + n('Tg', f.Tg / 60, 1) + ' min bis zum neuen Wert. Die Wendetangente liefert die Streckenverstärkung Ks = ' + n('Ks', f.Ks, 2) + ' (Änderung von x in % des Messbereichs durch die Änderung von y). Die Regelbarkeit Tg / Tu beträgt ' + n('reg', f.regelbarkeit, 1) + ': ' + f.urteil + '. Alle Zeiten sind Minuten Prozesszeit.';
      } },
    { id: 'rgx9', name: 'Raumtemperatur: PI an kaltem Tag', cat: 'Raumtemperatur', rig: 'raumtemp',
      spec: () => { const id = idOf('raumtemp', { w: 21 }, 80), a = ruleOf('tsumme', id, 'PI'); return { controls: fc('raumtemp', { mode: 'auto', ctrl: 'PI', kp: roundTo(a.Kp, 2), tn: roundTo(a.Tn, 0), tv: 0, aw: 'rueck', w: 21, z: 0, tOut: -5, window: false, noise: 0 }), seq: [{ t: 0, set: { mode: 'auto' } }], dur: 21600, sampleS: 30, id, a }; },
      text(res, n, d) {
        const L = smp(res), f = res.final, m = CORE().stepMetrics(L.map(s => s.t), L.map(s => s.x), { w0: 15, w1: 21, t0: 0, tol: 0.02, range: 20 });
        return 'Draußen sind ' + n('tOut', -5, 0) + ' °C, der Raum startet bei ' + n('t0', 15, 0) + ' °C und soll ' + n('w', 21, 0) + ' °C haben. Dafür braucht er einen Heizbedarf von ' + n('Pben', f.Pben, 0) + ' W, die Heizung liefert höchstens ' + n('Pmax', f.Pmax, 0) + ' W: Der Sollwert ist erreichbar, die Ventilstellung endet bei ' + n('yEnd', f.y, 1) + ' %. Der PI-Regler (Kp = ' + n('kp', d.controls.kp, 2) + ', Tn = ' + n('tnMin', d.controls.tn / 60, 0) + ' min nach der T-Summen-Regel) erreicht das 2-%-Band nach ' + n('tAus', m.tAus2 / 60, 0) + ' min Prozesszeit mit ' + n('ueber', m.ueberPct, 1) + ' % Überschwingen. Die Wärme kommt über Heizkörper und Rohr mit Verzögerung und Totzeit an: Der Regler muss deshalb langsam eingestellt werden, sonst schwingt der Raum.';
      } },
    { id: 'rgx10', name: 'Raumtemperatur: Fenster auf', cat: 'Raumtemperatur', rig: 'raumtemp',
      spec: () => ({ controls: fc('raumtemp', { mode: 'hand', yHand: 80, w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 80 }, seq: [{ t: 7200, set: { window: true } }], dur: 28800, sampleS: 60 }),
      text(res, n) {
        const a = rigOf('raumtemp', { z: 0, tOut: -5 }); a.setOperatingPoint(80); const sa = a.state(), ta = a.steady(80); a.setControl('window', true); const sb = a.state(), tb = a.steady(80);
        return 'Im Handbetrieb bei ' + n('y', 80, 0) + ' % Ventilstellung stellt sich bei geschlossenem Fenster ' + n('t1', ta, 1) + ' °C ein. Nach ' + n('tF', 120, 0) + ' min Prozesszeit geht das Fenster auf: Der Wärmeverlust steigt, und die Raumtemperatur fällt auf ' + n('t2', tb, 1) + ' °C. Das Fenster ändert Streckenverstärkung und Zeitkonstante zugleich: Ks sinkt von ' + n('Ks1', sa.Ks, 1) + ' auf ' + n('Ks2', sb.Ks, 1) + ', die Zeitkonstante von ' + n('T1', sa.T / 60, 0) + ' min auf ' + n('T2', sb.T / 60, 0) + ' min. Das ist mehr als eine Störgröße: Die Regelstrecke selbst ändert sich, und ein einmal eingestellter Regler passt nicht mehr optimal.';
      } },
    { id: 'rgx11', name: 'Raumtemperatur: zu scharf eingestellt', cat: 'Raumtemperatur', rig: 'raumtemp',
      spec: () => { const id = idOf('raumtemp', { w: 20 }, 83.3333), kp = roundTo(1.3 * id.Kkrit, 0); return { controls: fc('raumtemp', { mode: 'auto', ctrl: 'P', kp, tv: 0, u0: 0, aw: 'rueck', w: 20, z: 0, tOut: -5, window: false, noise: 0 }), op: { y: 83.3333 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 600, set: { w: 21 } }], dur: 43200, sampleS: 30, id, kp }; },
      text(res, n, d) {
        const L = smp(res).filter(s => s.t >= 43200 - 14400), o = CORE().oscillation(L.map(s => s.t), L.map(s => s.x), { range: 20 }), id = d.id;
        const rg = rigOf('raumtemp', { w: 20 }); rg.setOperatingPoint(80); const m = CORE().margins(CORE().freq.loopBlocks(rg.linBlocks(), { type: 'P', Kp: id.Kkrit / 2, dir: 'direkt' }));
        const yMax = winMax(smp(res), 43200 - 14400, 43200, s => s.y);
        return 'Die kritische Verstärkung dieser Regelstrecke ist Kkrit = ' + n('Kkrit', id.Kkrit, 1) + ' (Periodendauer Tkrit = ' + n('Tkrit', id.Tkrit / 60, 0) + ' min Prozesszeit). Der P-Regler hat hier Kp = ' + n('kp', d.kp, 0) + ', also mehr als Kkrit: Nach dem Sollwertsprung von ' + n('w0', 20, 0) + ' auf ' + n('w1', 21, 0) + ' °C klingt die Schwingung nicht mehr ab, die Raumtemperatur schwingt dauernd mit einer gemessenen Periode von ' + n('per', o.period / 60, 0) + ' min' + (yMax >= 99.5 ? ' und die Stellgröße stößt oben an die Grenze ' + n('yMax', 100, 0) + ' %' : '') + '. Schon bei Kp = Kkrit / 2 = ' + n('kpHalb', id.Kkrit / 2, 1) + ' beträgt die Amplitudenreserve nur ' + n('AR', m.AR, 1) + ' dB (Faktor 2) und die Phasenreserve ' + n('phiR', m.phiR, 0) + '°' + (m.stable && m.phiR < 45 ? ': Der Kreis ist stabil, aber schwach gedämpft (als Richtwert gelten mindestens ' + n('richt', 45, 0) + '° Phasenreserve).' : '.');
      } },
    /* ---------------------------------------------------------------- Zweipunktregler */
    { id: 'rgx12', name: 'Bügeleisen: Zweipunktregler', cat: 'Zweipunktregler', rig: 'thermostat',
      spec: () => ({ controls: fc('thermostat', { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 6, fb: 0, z: 0, noise: 0, power: true }), seq: [], dur: 2400, sampleS: 0.5 }),
      text(res, n) {
        const rg = rigOf('thermostat', { device: 'heizen', hyst: 6, w: 150, z: 0 }), ref = rg.reference(), f = res.final, L = smp(res);
        return 'Das Bügeleisen (Übungsanlage) heizt die Sohle von ' + n('t0', L[0].x, 0) + ' °C auf den Sollwert ' + n('w', 150, 0) + ' °C. Der Zweipunktregler schaltet die Heizung aus, wenn der Fühler ' + n('tOben', 153, 0) + ' °C erreicht, und wieder ein bei ' + n('tUnten', 147, 0) + ' °C (Sollwert ± halbe Schaltdifferenz, Schaltdifferenz ' + n('hyst', 6, 0) + ' K). Die Formel für einen trägheitsfreien Fühler gibt eine Schaltspielzeit von ' + n('Tf', ref.T, 0) + ' s Prozesszeit und eine Einschaltdauer von ' + n('EDf', ref.ED, 0) + ' %. Gemessen mit dem trägen Bimetall-Fühler sind es ' + n('Tm', f.period, 0) + ' s und ' + n('EDm', f.ed, 0) + ' %; die Schwankungsbreite der Sohle beträgt ' + n('swing', f.swing, 1) + ' K, größer als die Schaltdifferenz.';
      } },
    { id: 'rgx13', name: 'Schaltdifferenz klein und groß', cat: 'Zweipunktregler', rig: 'thermostat',
      spec: () => ({ controls: fc('thermostat', { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: 150, hyst: 2, fb: 0, z: 0, noise: 0, power: true }), seq: [{ t: 1200, set: { hyst: 20 } }], dur: 2400, sampleS: 0.5 }),
      text(res, n) {
        const L = smp(res), a = at(L, 1195).state, b = res.final;
        return 'Zuerst schaltet der Zweipunktregler mit der Schaltdifferenz ' + n('h1', 2, 0) + ' K: Die Sohle schwankt um ' + n('sw1', a.swing, 1) + ' K, es gibt ' + n('sp1', a.spph, 0) + ' Schaltspiele je Stunde Prozesszeit. Nach ' + n('tU', 1200, 0) + ' s Prozesszeit steht die Schaltdifferenz auf ' + n('h2', 20, 0) + ' K: Die Schwankungsbreite wächst auf ' + n('sw2', b.swing, 1) + ' K, die Schaltspiele sinken auf ' + n('sp2', b.spph, 0) + ' je Stunde. Eine kleine Schaltdifferenz hält die Temperatur genauer, belastet aber Schaltkontakt oder Verdichter mit vielen Schaltspielen; eine große schont sie und lässt die Temperatur grob schwanken.';
      } },
    { id: 'rgx14', name: 'Kühlschrank: inverser Wirkungssinn', cat: 'Zweipunktregler', rig: 'thermostat',
      spec: () => ({ controls: fc('thermostat', { device: 'kuehlen', mode: 'auto', ctrl: '2P', dir: 'invers', w: 5, hyst: 0.4, fb: 0, lockout: 'aus', z: 0, noise: 0, power: true }), seq: [{ t: 14400, set: { lockout: '3min' } }], dur: 28800, sampleS: 2 }),
      text(res, n) {
        const L = smp(res), p1 = pausesOf(L, 'cooling', 3600, 14400), p2 = pausesOf(L, 'cooling', 18000, 28800), a = at(L, 14390).state, b = res.final, sp = res.faults.includes('sperre');
        return 'Der Kühlschrank (Übungsanlage) soll ' + n('w', 5, 0) + ' °C halten. Der Verdichter muss einschalten, wenn es zu warm ist: Das ist der inverse Wirkungssinn (e = −(w − x)). Mit der Schaltdifferenz ' + n('hyst', 0.4, 1) + ' K schaltet er alle ' + n('T1', a.period, 0) + ' s Prozesszeit, und seine kürzeste Pause beträgt ' + n('p1', Math.min(...p1), 0) + ' s. Nach ' + n('tS', 14400, 0) + ' s Prozesszeit wird die Wiedereinschaltsperre von ' + n('sperre', 3, 0) + ' min eingeschaltet: Der Verdichter darf nach dem Ausschalten erst nach ' + n('sperreS', 180, 0) + ' s wieder starten. Die kürzeste Pause ist jetzt ' + n('p2', Math.min(...p2), 0) + ' s und die Schaltspielzeit ' + n('T2', b.period, 0) + ' s' + (sp ? ' (die Anlage meldet die Sperre)' : '') + '. Die Sperre schützt den Verdichter vor schnellem Wiedereinschalten gegen den Druck.';
      } },
    { id: 'rgx15', name: 'Klimagerät: Dreipunktregler mit Totzone', cat: 'Zweipunktregler', rig: 'thermostat',
      spec: () => ({ controls: fc('thermostat', { device: 'beides', mode: 'auto', ctrl: '3P', dir: 'direkt', w: 21, hyst: 1, dead: 1, fb: 0, z: 0, noise: 0, power: true }), seq: [{ t: 18000, set: { z: 1500 } }], dur: 43200, sampleS: 20 }),
      text(res, n) {
        const L = smp(res), both = L.filter(s => s.state.heating && s.state.cooling).length, seg = (a, b) => { const w = win(L, a, b - 1e-6); return { heat: w.filter(s => s.state.heating).length / w.length, cool: w.filter(s => s.state.cooling).length / w.length, min: Math.min(...w.map(s => s.x)), max: Math.max(...w.map(s => s.x)) }; };
        const s1 = seg(7200, 18000), s2 = seg(25200, 43200);
        return 'Der Dreipunktregler des Klimageräts kennt drei Zustände: heizen, nichts tun, kühlen. Zwischen Heizen und Kühlen liegt die Totzone (halbe Breite ' + n('dead', 1, 0) + ' K um den Sollwert ' + n('w', 21, 0) + ' °C, Schaltdifferenz ' + n('hyst', 1, 0) + ' K). In den ersten Stunden (nach dem Aufheizen) heizt das Gerät und hält die Raumtemperatur zwischen ' + n('a1', s1.min, 1) + ' und ' + n('a2', s1.max, 1) + ' °C; die Heizung ist ' + n('shHeiz', 100 * s1.heat, 0) + ' % der Zeit an. Nach ' + n('tZ', 5, 0) + ' h Prozesszeit liefern Personen ' + n('z', 1500, 0) + ' W Fremdwärme: Jetzt kühlt das Gerät und hält die Temperatur zwischen ' + n('b1', s2.min, 1) + ' und ' + n('b2', s2.max, 1) + ' °C. Heizen und Kühlen waren in der ganzen Simulation in ' + n('both', both, 0) + ' von ' + n('nS', L.length, 0) + ' Abtastungen zugleich an.';
      } },
    /* ---------------------------------------------------------------- Drehzahl */
    { id: 'rgx16', name: 'Drehzahl: Lastsprung ohne und mit I-Anteil', cat: 'Drehzahl', rig: 'drehzahl',
      spec: () => ({ controls: fc('drehzahl', { mode: 'auto', ctrl: 'P', kp: 5, tn: 0.2, tv: 0, u0: 65, aw: 'rueck', w: 1500, z: 0, noise: 0, ymax: 100, ta: 0.005 }), seq: [{ t: 0, set: { mode: 'auto' } }, { t: 1.5, set: { z: 50 } }, { t: 3.5, set: { ctrl: 'PI' } }], dur: 6, sampleS: 0.005 }),
      text(res, n) {
        const L = smp(res), drop = 1500 - winMin(L, 1.5, 3.5, s => s.x), eP = 1500 - winMean(L, 3.3, 3.5, s => s.x), ePI = 1500 - winMean(L, 5.8, 6, s => s.x), e0 = 1500 - winMean(L, 1.3, 1.5, s => s.x);
        return 'Der Motor läuft mit dem P-Regler (Kp = ' + n('kp', 5, 0) + ', Arbeitspunkt u0 = ' + n('u0', 65, 0) + ' %) auf ' + n('w', 1500, 0) + ' 1/min, die Abweichung ohne Last ist nur ' + n('e0', e0, 1) + ' 1/min. Nach ' + n('tz', 1.5, 1) + ' s springt die Last auf ' + n('z', 50, 0) + ' % des größten Lastmoments: Die Drehzahl bricht um ' + n('drop', drop, 0) + ' 1/min ein und bleibt mit dem P-Regler ' + n('eP', eP, 0) + ' 1/min unter dem Sollwert (bleibende Regelabweichung). Nach ' + n('tPI', 3.5, 1) + ' s wird auf den PI-Regler umgeschaltet: Der I-Anteil gleicht die Last aus, die Abweichung ist nach ' + n('tEnd', 6, 0) + ' s nur noch ' + n('ePI', Math.abs(ePI), 3) + ' 1/min.';
      } },
    { id: 'rgx17', name: 'Drehzahl: Windup an der Stromgrenze', cat: 'Drehzahl', rig: 'drehzahl',
      spec: () => ({ controls: fc('drehzahl', { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, tv: 0, aw: 'aus', u0: 0, w: 0, z: 0, noise: 0, ymax: 60, ta: 0.005 }), op: { y: 0 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 0.5, set: { w: 1200 } }], dur: 6, sampleS: 0.005 }),
      text(res, n) {
        const m = res.metrics.step, other = aw => { const c = fc('drehzahl', { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.2, tv: 0, aw, u0: 0, w: 0, z: 0, noise: 0, ymax: 60, ta: 0.005 }); return run('drehzahl', c, [{ t: 0, set: { mode: 'auto' } }, { t: 0.5, set: { w: 1200 } }], 6, { op: { y: 0 }, sampleS: 0.005 }).metrics.step.ueberPct; };
        const nMax = rigOf('drehzahl').steady(60), ws = res.faults.includes('windup');
        return 'Die Stellgröße ist auf ' + n('ymax', 60, 0) + ' % begrenzt; ohne Last erreicht der Motor dann höchstens ' + n('nMax', nMax, 0) + ' 1/min. Beim Hochfahren auf ' + n('w', 1200, 0) + ' 1/min steht die Stellgröße zuerst an der Grenze' + (res.faults.includes('stromgrenze') ? ', und der Strom stößt an die Stromgrenze von ' + n('imax', rigOf('drehzahl').params.Imax, 0) + ' A (die Anlage meldet sie)' : '') + '. Mit Anti-Windup „aus“ summiert der I-Anteil trotzdem weiter' + (ws ? ' (die Anlage meldet Windup)' : '') + ' und treibt die Drehzahl über den Sollwert: Überschwingen ' + n('ueberAus', m.ueberPct, 1) + ' %. Mit denselben Reglerwerten (Kp = ' + n('kp', 2, 0) + ', Tn = ' + n('tn', 0.2, 1) + ' s) und Anti-Windup „rueck“ sind es ' + n('ueberRueck', other('rueck'), 1) + ' %, mit „klemmen“ ' + n('ueberKlemmen', other('klemmen'), 1) + ' %. Stelle den Anti-Windup im Prüfstand um und vergleiche.';
      } },
    { id: 'rgx18', name: 'Drehzahl: Abtastzeit zu groß', cat: 'Drehzahl', rig: 'drehzahl',
      spec: () => ({ controls: fc('drehzahl', { mode: 'auto', ctrl: 'PI', kp: 6, tn: 0.2, tv: 0, aw: 'rueck', u0: 0, w: 1000, z: 0, noise: 0, ymax: 100, ta: 0.005 }), op: { y: roundTo(100 * 1000 / rigOf('drehzahl').steady(100), 4) }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 0.5, set: { w: 1500 } }, { t: 3, set: { ta: 0.1 } }, { t: 3.5, set: { w: 1000 } }], dur: 9, sampleS: 0.01 }),
      text(res, n) {
        const rg = rigOf('drehzahl', { ctrl: 'PI', kp: 6, tn: 0.2 }); rg.setOperatingPoint(50); rg.setControl('mode', 'auto');
        const mg = ta => { rg.setControl('ta', ta); return rg.analysis().margins; }, a = mg(0.005), b = mg(0.1), L = smp(res);
        const m = stepSeg(L, 0.5, 3, 1000, 1500, 3000), ab = res.faults.includes('abtast');
        return 'Der Regler rechnet nur alle Ta und hält die Stellgröße dazwischen: Das wirkt wie eine zusätzliche Verzögerung von etwa Ta / 2. Mit Ta = ' + n('ta1', 5, 0) + ' ms hat der PI-Regler (Kp = ' + n('kp', 6, 0) + ', Tn = ' + n('tn', 0.2, 1) + ' s) eine Phasenreserve von ' + n('phi1', a.phiR, 0) + '° und überschwingt beim Sprung von ' + n('w0', 1000, 0) + ' auf ' + n('w1', 1500, 0) + ' 1/min um ' + n('ueber', m.ueberPct, 1) + ' %. Nach ' + n('tU', 3, 0) + ' s wird Ta auf ' + n('ta2', 100, 0) + ' ms gestellt: Die Phasenreserve sinkt auf ' + n('phi2', b.phiR, 0) + '°' + (b.stable ? '' : ', der Kreis ist nach der Frequenzgangrechnung nicht mehr stabil') + (ab ? '; die Anlage meldet den Phasenverlust durch die Abtastzeit' : '') + '. Wähle Ta klein gegen die Zeitkonstanten der Regelstrecke.';
      } },
    /* ---------------------------------------------------------------- Lage */
    { id: 'rgx19', name: 'Lageregelung: PD gegen PI', cat: 'Lageregelung', rig: 'position',
      spec: () => ({ controls: fc('position', { mode: 'auto', ctrl: 'PD', kp: 4, tn: 1, tv: 0.2, aw: 'rueck', u0: 50, w: 20, z: 0, friction: 0, backlash: 0, noise: 0, ymax: 100, ta: 0.002 }), seq: [{ t: 0, set: { mode: 'auto' } }, { t: 1, set: { w: 60 } }, { t: 6, set: { ctrl: 'PI', tv: 0, w: 20 } }], dur: 12, sampleS: 0.01 }),
      text(res, n) {
        const L = smp(res), a = stepSeg(L, 1, 6, 20, 60, 100), b = stepSeg(L, 6, 12, 60, 20, 100);
        return 'Die Spindelachse fährt mit dem PD-Regler (Kp = ' + n('kp', 4, 0) + ', Vorhaltzeit Tv = ' + n('tv', 0.2, 1) + ' s) von ' + n('w0', 20, 0) + ' auf ' + n('w1', 60, 0) + ' mm: Überschwingen ' + n('ueberPD', a.ueberPct, 1) + ' %, Ausregelzeit (2 %) ' + n('tPD', a.tAus2, 2) + ' s. Die Achse ist eine Strecke ohne Ausgleich: Sie braucht für die Lage keinen I-Anteil. Nach ' + n('tU', 6, 0) + ' s wird auf einen PI-Regler (Tn = ' + n('tn', 1, 0) + ' s) umgeschaltet und zurück auf ' + n('w2', 20, 0) + ' mm gefahren: Jetzt beträgt das Überschwingen ' + n('ueberPI', b.ueberPct, 1) + ' %, die Ausregelzeit ' + n('tPI', b.tAus2, 2) + ' s. Der I-Anteil an einer I-Strecke bringt zwei Integratoren in den Kreis und macht ihn schwingfreudig.';
      } },
    { id: 'rgx20', name: 'Lageregelung: Haftreibung und Lose', cat: 'Lageregelung', rig: 'position',
      spec: () => ({ controls: fc('position', { mode: 'auto', ctrl: 'PI', kp: 2, tn: 0.5, tv: 0, aw: 'rueck', u0: 50, w: 50, z: 0, friction: 5, backlash: 1, noise: 0, ymax: 100, ta: 0.002 }), seq: [{ t: 0, set: { mode: 'auto' } }, { t: 1, set: { w: 60 } }, { t: 80, set: { ctrl: 'PD', kp: 10, tv: 0.3 } }], dur: 140, sampleS: 0.02 }),
      text(res, n) {
        const L = smp(res), o = CORE().oscillation(win(L, 40, 80).map(s => s.t), win(L, 40, 80).map(s => s.x), { range: 100 }), p1 = winP2P(L, 50, 80, s => s.x), p2 = winP2P(L, 120, 140, s => s.x), e2 = 60 - winMean(L, 130, 140, s => s.x), gz = res.faults.includes('grenz');
        return 'Die Achse hat ' + n('fr', 5, 0) + ' % Haftreibung und ' + n('lose', 1, 0) + ' mm Lose in der Spindel. Der PI-Regler (Kp = ' + n('kp', 2, 0) + ', Tn = ' + n('tn', 0.5, 1) + ' s) bleibt nie ruhig: Er fährt die Lage in einen Grenzzyklus' + (gz ? ' (die Anlage meldet ihn)' : '') + ' mit ' + n('p1', p1, 1) + ' mm Schwingweite (Spitze-Spitze) und einer Periode von ' + n('per', o.period, 1) + ' s. Der I-Anteil integriert die Regeldifferenz auf, bis die Haftreibung überwunden ist, und schießt dann über. Nach ' + n('tU', 80, 0) + ' s wird auf einen PD-Regler (Kp = ' + n('kp2', 10, 0) + ', Tv = ' + n('tv2', 0.3, 1) + ' s) umgeschaltet: Die Schwingung hört auf (Schwingweite ' + n('p2', p2, 2) + ' mm), und die Lage bleibt ' + n('e2', Math.abs(e2), 2) + ' mm neben dem Sollwert stehen.';
      } },
    /* ---------------------------------------------------------------- Baukasten */
    { id: 'rgx21', name: 'Baukasten: Schwingversuch an PT3', cat: 'Baukasten', rig: 'baukasten',
      spec: () => { const ult = CORE().ultimate(rigOf('baukasten', BK_PT3).linBlocks()); return { controls: fc('baukasten', Object.assign({ mode: 'auto', ctrl: 'P', kp: roundTo(ult.Kkrit, 1), tv: 0, u0: 50, w: 50, ymax: 100, ta: 0.01, aw: 'rueck', z: 0, noise: 0 }, BK_PT3)), op: { y: 50 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 5, set: { w: 55 } }], dur: 300, sampleS: 0.05, ult }; },
      text(res, n, d) {
        const fcr = CORE().findCritical(() => { const r = rigOf('baukasten', BK_PT3); const op = r.setOperatingPoint; r.setOperatingPoint = function (y, x) { const ok = op.call(r, y, x); r.setControl('mode', 'auto'); return ok; }; return r; }, { op: { y: 50 } });
        const L = smp(res), o = CORE().oscillation(win(L, 150, 300).map(s => s.t), win(L, 150, 300).map(s => s.x), { range: 100 }), p1 = winP2P(L, 100, 150, s => s.x), p2 = winP2P(L, 250, 300, s => s.x);
        return 'Die Strecke hat drei Zeitkonstanten (' + n('t1', 10, 0) + ' s, ' + n('t2', 5, 0) + ' s und ' + n('t3', 2, 0) + ' s). Die Frequenzgangrechnung liefert die kritische Verstärkung Kkrit = ' + n('Kkrit', d.ult.Kkrit, 1) + ' und die Periodendauer Tkrit = ' + n('Tkrit', d.ult.Tkrit, 1) + ' s. Der automatische Schwingversuch (Kp steigern, bis die Schwingung nicht mehr abklingt) findet Kkrit = ' + n('KkritA', fcr.Kkrit, 1) + ' und Tkrit = ' + n('TkritA', fcr.Tkrit, 1) + ' s; das weicht um ' + n('abw', 100 * Math.abs(fcr.Kkrit - d.ult.Kkrit) / d.ult.Kkrit, 1) + ' % ab. Mit Kp = ' + n('kp', d.controls.kp, 1) + ' schwingt der Kreis nach dem Sollwertsprung weiter: Die Schwingweite (Spitze-Spitze) ist in den Sekunden ' + n('a1', 100, 0) + ' bis ' + n('a2', 150, 0) + ' gleich ' + n('p1', p1, 1) + ' % und in den Sekunden ' + n('b1', 250, 0) + ' bis ' + n('b2', 300, 0) + ' gleich ' + n('p2', p2, 1) + ' %, die gemessene Periode ' + n('per', o.period, 1) + ' s.';
      } },
    { id: 'rgx22', name: 'Baukasten: Reserven und Totzeit', cat: 'Baukasten', rig: 'baukasten',
      spec: () => { const seq = [{ t: 0, set: { mode: 'auto' } }]; [[1, 60], [2, 50], [3, 60], [4, 50]].forEach((p, i) => seq.push({ t: 5 + i * 100, set: { kp: p[0], w: p[1] } })); return { controls: fc('baukasten', { mode: 'auto', ctrl: 'PI', kp: 1, tn: 10, tv: 0, u0: 50, w: 50, ymax: 100, ta: 0.01, aw: 'rueck', z: 0, noise: 0, type: 'pt1tt', ks: 1, t1: 10, tt: 3 }), op: { y: 50 }, seq, dur: 405, sampleS: 0.05 }; },
      text(res, n) {
        const rg = rigOf('baukasten', { type: 'pt1tt', ks: 1, t1: 10, tt: 3, ctrl: 'PI', tn: 10 }), L = smp(res), out = [];
        [1, 2, 3, 4].forEach((kp, i) => { rg.setControl('kp', kp); const m = rg.analysis().margins, t0 = 5 + i * 100, w0 = i % 2 === 0 ? 50 : 60, w1 = i % 2 === 0 ? 60 : 50, st = stepSeg(L, t0, t0 + 100, w0, w1, 100); out.push({ kp, phi: m.phiR, ueber: st.ueberPct }); });
        return 'Die Strecke ist ein Verzögerungsglied (T = ' + n('T1', 10, 0) + ' s) mit der Totzeit ' + n('Tt', 3, 0) + ' s. Ein PI-Regler mit Tn = ' + n('tn', 10, 0) + ' s regelt sie; Kp steigt alle ' + n('dt', 100, 0) + ' s Prozesszeit. Die Totzeit kostet Phase, und sie wächst mit der Durchtrittsfrequenz: Kp = ' + n('k1', 1, 0) + ' gibt die Phasenreserve ' + n('f1', out[0].phi, 0) + '° (Überschwingen ' + n('u1', out[0].ueber, 1) + ' %), Kp = ' + n('k2', 2, 0) + ' gibt ' + n('f2', out[1].phi, 0) + '° (' + n('u2', out[1].ueber, 1) + ' %), Kp = ' + n('k3', 3, 0) + ' gibt ' + n('f3', out[2].phi, 0) + '° (' + n('u3', out[2].ueber, 1) + ' %) und Kp = ' + n('k4', 4, 0) + ' nur noch ' + n('f4', out[3].phi, 0) + '° (' + n('u4', out[3].ueber, 1) + ' %). Als Richtwert gilt eine Phasenreserve von mindestens ' + n('richt', 45, 0) + '° als gut gedämpft; je kleiner sie ist, desto stärker schwingt der Kreis.';
      } },
    { id: 'rgx23', name: 'Baukasten: Einstellregeln im Vergleich', cat: 'Baukasten', rig: 'baukasten',
      spec: () => { const id = idOf('baukasten', BK_PT3, 50), seq = [{ t: 0, set: { mode: 'auto' } }], ph = []; ['zn-sprung', 'chr-fuehr-0', 'tsumme'].forEach((m, i) => { const a = ruleOf(m, id, 'PI'), t0 = 5 + i * 200, w0 = i % 2 === 0 ? 50 : 60, w1 = i % 2 === 0 ? 60 : 50; seq.push({ t: t0, set: { kp: roundTo(a.Kp, 2), tn: roundTo(a.Tn, 1), w: w1 } }); ph.push({ m, kp: roundTo(a.Kp, 2), tn: roundTo(a.Tn, 1), t0, w0, w1 }); }); return { controls: fc('baukasten', Object.assign({ mode: 'auto', ctrl: 'PI', kp: 1, tn: 20, tv: 0, u0: 50, w: 50, ymax: 100, ta: 0.01, aw: 'rueck', z: 0, noise: 0 }, BK_PT3)), op: { y: 50 }, seq, dur: 605, sampleS: 0.1, ph, id }; },
      text(res, n, d) {
        const L = smp(res), name = { 'zn-sprung': 'Ziegler-Nichols (Sprungantwort)', 'chr-fuehr-0': 'Chien-Hrones-Reswick (Führung, aperiodisch)', 'tsumme': 'T-Summe (Betragsoptimum)' };
        const parts = d.ph.map((p, i) => { const m = stepSeg(L, p.t0, p.t0 + 200, p.w0, p.w1, 100); return name[p.m] + ': Kp = ' + n('kp' + i, p.kp, 2) + ', Tn = ' + n('tn' + i, p.tn, 1) + ' s, Überschwingen ' + n('ue' + i, m.ueberPct, 1) + ' %, Ausregelzeit (2 %) ' + n('ta' + i, m.tAus2, 0) + ' s'; });
        return 'Dieselbe Strecke (drei Zeitkonstanten ' + n('t1', 10, 0) + ' s, ' + n('t2', 5, 0) + ' s und ' + n('t3', 2, 0) + ' s) wird nacheinander mit drei Einstellregeln für den PI-Regler geregelt, jeweils ' + n('dt', 200, 0) + ' s lang mit einem Sollwertsprung. Die Kennwerte aus der Sprungantwort sind Ks = ' + n('Ks', d.id.Ks, 1) + ', Tu = ' + n('Tu', d.id.Tu, 1) + ' s und Tg = ' + n('Tg', d.id.Tg, 1) + ' s. ' + parts.join('. ') + '. Die Regeln sind Näherungen: Ziegler-Nichols stellt scharf ein, die anderen beiden dämpfen stärker.';
      } },
    { id: 'rgx24', name: 'Baukasten: instabiler Kreis', cat: 'Baukasten', rig: 'baukasten',
      spec: () => { const ult = CORE().ultimate(rigOf('baukasten', BK_PT3).linBlocks()); return { controls: fc('baukasten', Object.assign({ mode: 'auto', ctrl: 'P', kp: 19, tv: 0, u0: 50, w: 50, ymax: 100, ta: 0.01, aw: 'rueck', z: 0, noise: 0 }, BK_PT3)), op: { y: 50 }, seq: [{ t: 0, set: { mode: 'auto' } }, { t: 5, set: { w: 51 } }], dur: 200, sampleS: 0.05, ult }; },
      text(res, n, d) {
        const L = smp(res), first = L.find(s => s.t > 5.1 && (s.y >= 99.5 || s.y <= 0.5)), p1 = winP2P(L, 5, 40, s => s.x), p2 = winP2P(L, 160, 200, s => s.x), o = CORE().oscillation(win(L, 100, 200).map(s => s.t), win(L, 100, 200).map(s => s.x), { range: 100 });
        return 'Mit der kritischen Verstärkung Kkrit = ' + n('Kkrit', d.ult.Kkrit, 1) + ' schwingt dieser Kreis gerade noch gleichmäßig. Hier ist Kp = ' + n('kp', d.controls.kp, 0) + ' deutlich größer: Schon ein Sollwertsprung von ' + n('w0', 50, 0) + ' auf ' + n('w1', 51, 0) + ' % genügt, damit die Schwingung bei jeder Periode wächst. Die Schwingweite (Spitze-Spitze) beträgt in den ersten ' + n('t35', 35, 0) + ' s nach dem Sprung ' + n('p1', p1, 1) + ' %, in den letzten ' + n('t40', 40, 0) + ' s ' + n('p2', p2, 1) + ' %' + (first ? '; ab ' + n('tSat', first.t, 0) + ' s Prozesszeit stößt die Stellgröße an eine Grenze (0 oder 100 %), und die Schwingweite wächst nicht weiter' : '') + '. Die gemessene Periode ist ' + n('per', o.period, 1) + ' s. Die Regelstrecke allein ist stabil: Erst der Regler mit zu großem Kp macht den geschlossenen Kreis instabil.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['fuellstand', 'durchfluss', 'raumtemp', 'thermostat', 'drehzahl', 'position', 'baukasten']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), res = run(def.rig, d.controls, d.seq || [], d.dur, { op: d.op, sampleS: d.sampleS }), vals = {};
        const n = (k, v, dg) => { vals[k] = v; return fm(v, dg); };
        const desc = def.text(res, n, d).replace(/(^|[\s(])-(\d)/g, '$1−$2');
        const ex = { id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc, controls: d.controls, vals };
        if (d.op) ex.op = d.op;
        if (d.seq && d.seq.length) ex.seq = d.seq;
        ex.dur = d.dur;
        out.push(ex);
      } catch (e) { out.push({ id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc: 'Dieses Beispiel konnte nicht berechnet werden: ' + String(e && e.message || e), controls: {}, vals: {}, error: String(e && e.message || e) }); }
    });
    return out;
  }
  const REG_DATA = {};
  Object.defineProperty(REG_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  REG_DATA.exampleCount = EXDEFS.length;
  root.REG_DATA = REG_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.REG_DATA.examples; }, tasks, register, REG_TASKS, answerOf, clean, run };
})(typeof window !== 'undefined' ? window : globalThis);
