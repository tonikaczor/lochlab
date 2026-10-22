/* enrdata.js - Energie-Lab: Beispiele (ENR_DATA) und Aufgabenregister (ENR_TASKS), ohne Browser lauffaehig (WP5a).
 * window.ENR_DATA  = { examples: [ { id:'enx1'..'enx32', name, cat, rig, desc, controls, seq?, dur, vals } ], exampleCount }
 *   Alle Zahlen in `desc` kommen aus Simulation (ENR_RIGS) und Kern (ENR_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff gerechnet
 *   (Getter); fehlen Kern oder Pruefstaende (zum Beispiel ENR_CORE.sys), enthaelt der Eintrag `error` und eine ehrliche Meldung statt einer Beschreibung.
 *   controls = alle Steuerwerte des Pruefstands, seq im Format von runSeq (t in Prozess-SEKUNDEN, set | ramp), dur in Sekunden, sampleS = Abtastung.
 *   Texte der Beispiele sagen nur, was gerechnet wurde (Regel 2): Behauptungen ueber Richtungen stehen hinter `need(bedingung, text)`, das den Eintrag
 *   als fehlerhaft meldet, wenn die gerechnete Zahl die Aussage nicht traegt.
 * window.ENR_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf, thresholds() }
 *   Die Aufgaben stehen in enrtasks1.js (en1-en15) und enrtasks2.js (en16-en30) und melden sich mit ENR_TASKS.register([...]) an; die Reihenfolge der Registry
 *   ist immer en1, en2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'enN', lab:'enr', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), fields?, choices?, ask? }
 *   answer = { rig, controls:{key:Wert}, seq:[{t(s), set|ramp}], dur(s), state, simTime, value, text, fields:{key:Zahl|String|null}, choices:{key:Wert},
 *              design:{ inp, result }, curve:[{u,i,p}] }
 *   start() und sol() liefern { rig, controls, seq?, dur?, value?, fields?, choices?, design? } (Auto-Weg und Selbsttest); wrong() liefert
 *   [{ name, answer:{...} }] mit mindestens zwei absichtlich falschen Antworten (zu klein/zu gross bzw. falsch herum) fuer den Test (Regel 3).
 *   design (Aufgabe en23, Tab Auslegen, WP4b): { inp, result } mit inp = Eingabe von ENR_CORE.design.autoDesign und result = dessen Ergebnis (der Azubi darf
 *   Werte aendern); fehlt result, rechnet die Pruefung es mit autoDesign(inp).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 * ENR_TASKS.util (fuer enrtasks1.js, enrtasks2.js und die Oberflaeche):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); mean; ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); run(rigId, ctl, seq, T, o?) -> { ok, samples:[{t,state,meters}], final, events, faults, errors, rejected, balance, rig };
 *   snap(rigId, ctl, T, o?) (gecachter Lauf); effOf(c, rigId, own, fix); setRow; mk(rigId, own, fn) -> check(answer); inputRow; numRow; exRow; rawOf; choiceOf;
 *   win/winMean/winMax/winMin/at/firstT/dayMax; faultHas; eventHas; memo(obj,key,fn); variants(v); needSys(rigId); hasSys(); core(); rigs(id).
 * Zeit: Alle Laeufe laufen mit Seed 1 (kein Zufall), Tagesprüfstände beginnen bei der Steuerwerte-Uhr `uhr` (Sonnenzeit). */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.ENR_CORE) { nodeReq('./enrcore.js'); nodeReq('./enrsys.js'); nodeReq('./enrcalc.js'); } return root.ENR_CORE || null; };
  const RIGFILES = ['./enrrig-modul.js', './enrrig-schatten.js', './enrrig-regler.js', './enrrig-insel.js', './enrrig-netz.js'];
  const RIGS = id => { let R = root.ENR_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); RIGFILES.forEach(nodeReq); R = root.ENR_RIGS; } return R || null; };
  const SYSRIGS = ['regler', 'insel', 'netz'];
  const needSys = id => SYSRIGS.indexOf(id) >= 0;
  const hasSys = () => { const C = CORE(); return !!(C && C.sys && typeof C.sys.create === 'function'); };
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

  /* ====================================================================== Eingabe pruefen und aufbereiten */
  function flat(list, out) {
    (Array.isArray(list) ? list : []).forEach(c => { if (c && Array.isArray(c.controls)) flat(c.controls, out); else if (c && typeof c.key === 'string') out.push(c); });
    return out;
  }
  const ctlDefs = rig => { const R = RIGS(rig); const d = R && R.defs && R.defs[rig]; return d ? flat(d.controls, []) : null; };
  /* Wert an die Definition des Steuerelements anpassen (wie die Oberflaeche); undefined = unpassend */
  function coerce(def, v) {
    if (!def) return v;
    if (def.type === 'slider') { const x = toNum(v); return fin(x) ? clamp(x, def.min, def.max) : undefined; }
    if (def.type === 'switch' || def.type === 'button') return v === undefined || v === null || isObj(v) || Array.isArray(v) ? undefined : !!v;
    if (def.type === 'select') {
      const o = def.options || [], norm = s => String(s).trim().replace(',', '.');
      let m = o.find(x => x.value === v) || o.find(x => norm(x.value) === norm(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      if (!m && (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && o.every(x => fin(+x.value))) {
        const q = toNum(v); if (fin(q)) { const c = o.slice().sort((a, b) => Math.abs(a.value - q) - Math.abs(b.value - q))[0]; if (c && Math.abs(c.value - q) <= 1e-3 * Math.max(1, Math.abs(c.value))) m = c; }
      }
      return m ? m.value : undefined;
    }
    return v;
  }
  /* -> { controls, seq, problems[] } ; wirft nie. own = Schluessel, die der Lernende waehlen darf (nur dort werden Probleme gemeldet) */
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
    const seq = [];
    (Array.isArray(a.seq) ? a.seq : []).forEach((e, i) => {
      if (!isObj(e)) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm ist unlesbar.'); return; }
      const t = toNum(e.t);
      if (!fin(t) || t < 0) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm hat keine gültige Zeit.'); return; }
      const out = { t };
      if (isObj(e.set)) { out.set = {}; Object.keys(e.set).forEach(k => { const x = one(k, e.set[k], ' (Schritt ' + (i + 1) + ')'); if (x !== undefined) out.set[k] = x; }); }
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
  /* Rohtext einer Eingabe (Zahl oder String), fuer ENR_CORE.calc.exercise.check; null = nichts eingetragen */
  function rawOf(a, key) {
    let v = null;
    if (key === 'value' || key == null) v = isObj(a) ? (a.value !== undefined && a.value !== null && a.value !== '' ? a.value : a.text) : null;
    else v = isObj(a) && isObj(a.fields) ? a.fields[key] : null;
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
    return typeof v === 'number' ? (fin(v) ? String(v).replace('.', ',') : null) : String(v);
  }
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);

  /* ====================================================================== Simulation und Auswertung */
  const FIRST = ['preset', 'modul', 'chem', 'usys', 'ctrl', 'regler', 'ort', 'datum', 'wetter', 'lastprofil', 'wr', 'wrTyp', 'orient', 'schatten', 'lastart', 'quelle'];
  const LAST = ['uAbs', 'uFloat', 'lvdU'];
  const order = obj => {
    const k = Object.keys(obj || {}), rank = key => (FIRST.indexOf(key) >= 0 ? FIRST.indexOf(key) : LAST.indexOf(key) >= 0 ? 200 + LAST.indexOf(key) : 100);
    return k.sort((a, b) => rank(a) - rank(b));
  };
  /* Pruefstand frisch erzeugen, Steuerwerte setzen, Ablauf (seq) abfahren, Messwerte abtasten. Deterministisch (Seed 1), wirft nie.
   * o = { after:{key:Wert} (nach ctl gesetzt), sampleS, seed, start:{ N, tS } }. T in Prozess-Sekunden. */
  function run(rigId, ctl, seq, T, o) {
    o = o || {};
    const out = { ok: false, samples: [], final: null, events: [], faults: [], errors: [], rejected: [], balance: null, rig: null };
    const R = RIGS(rigId);
    if (!R || !R.defs || !R.defs[rigId]) { out.errors.push('Den Prüfstand „' + rigId + '“ gibt es nicht.'); return out; }
    if (needSys(rigId) && !hasSys()) { out.errors.push('Der Rechenkern (ENR_CORE.sys) fehlt: Dieser Prüfstand kann nicht rechnen.'); return out; }
    const seed = fin(o.seed) ? o.seed : 1;
    let rig;
    try { rig = R.create(rigId, { seed }); } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message)); return out; }
    const setAll = obj => {
      if (!isObj(obj)) return;
      order(obj).forEach(k => { let ok; try { ok = rig.setControl(k, obj[k]); } catch (e) { ok = false; } if (ok === false) out.rejected.push({ key: k, value: obj[k] }); });
    };
    try {
      setAll(ctl); setAll(o.after);
      if (o.start && typeof rig.setClock === 'function') rig.setClock(o.start.N, o.start.tS);
      const evs = (Array.isArray(seq) ? seq : []).filter(e => isObj(e) && fin(e.t)).slice().sort((a, b) => a.t - b.t);
      const sampleS = fin(o.sampleS) && o.sampleS > 0 ? o.sampleS : Math.max(1, T / 2000);
      const ramps = [], faults = new Set();
      const sample = t => {
        const st = clone(rig.state()); (st.faults || []).forEach(f => faults.add(f));
        out.samples.push({ t, state: st, meters: clone(rig.readMeters()) });
      };
      let t = 0, k = 0, nextS = sampleS;
      const due = () => {
        while (k < evs.length && evs[k].t <= t + 1e-9) {
          const e = evs[k++];
          if (e.set) setAll(e.set);
          if (e.ramp && typeof e.ramp.key === 'string') { const v0 = +rig.getControl(e.ramp.key); ramps.push({ key: e.ramp.key, v0: fin(v0) ? v0 : 0, to: e.ramp.to, t0: t, dur: Math.max(1e-6, e.ramp.durS || 0) }); }
        }
      };
      due(); sample(0);
      let guard = 0;
      while (t < T - 1e-9 && guard++ < 200000) {
        let dt = Math.min(nextS - t, T - t);
        if (k < evs.length) dt = Math.min(dt, Math.max(evs[k].t - t, 1e-6));
        ramps.forEach(r => { if (t - r.t0 < r.dur) dt = Math.min(dt, Math.max(1e-3, r.dur - (t - r.t0))); });
        dt = Math.max(dt, 1e-6);
        rig.stepProcess(dt); t += dt;
        ramps.forEach(r => { const q = clamp((t - r.t0) / r.dur, 0, 1); try { rig.setControl(r.key, r.v0 + (r.to - r.v0) * q); } catch (e) { /* abgelehnt */ } });
        due();
        if (t >= nextS - 1e-9) { sample(t); nextS += sampleS; }
      }
      out.final = clone(rig.state());
      (out.final.faults || []).forEach(f => faults.add(f));
      out.faults = Array.from(faults);
      out.events = (Array.isArray(rig.events) ? rig.events : []).map(e => Object.assign({}, e));
      if (typeof rig.balance === 'function') { try { out.balance = clone(rig.balance()); } catch (e) { out.balance = null; } }
      out.rig = rig; out.ok = true;
    } catch (e) { out.errors.push('Der Lauf wurde abgebrochen: ' + String(e && e.message || e)); }
    return out;
  }
  const smp = r => (r && Array.isArray(r.samples) ? r.samples : []);
  const win = (s, t0, t1) => s.filter(x => x.t >= t0 - 1e-9 && x.t <= t1 + 1e-9);
  const winMean = (s, t0, t1, f) => mean(win(s, t0, t1).map(f));
  const winMax = (s, t0, t1, f) => win(s, t0, t1).reduce((m, x) => Math.max(m, f(x)), -Infinity);
  const winMin = (s, t0, t1, f) => win(s, t0, t1).reduce((m, x) => Math.min(m, f(x)), Infinity);
  const at = (s, t) => { for (let i = 0; i < s.length; i++) if (s[i].t >= t - 1e-9) return s[i]; return s[s.length - 1] || { t: 0, state: {}, meters: {} }; };
  const firstT = (s, f) => { for (let i = 0; i < s.length; i++) if (f(s[i])) return s[i].t; return null; };
  const faultHas = (r, id) => !!r && Array.isArray(r.faults) && r.faults.includes(id);
  const eventHas = (r, id) => !!r && Array.isArray(r.events) && r.events.some(e => e.id === id || e.fx === id);
  /* groesster Wert einer Tagessumme ueber den Lauf (Tagesmesswerte werden um Mitternacht zurueckgesetzt) */
  const dayMax = (r, key) => smp(r).reduce((m, x) => Math.max(m, fin(x.state[key]) ? x.state[key] : -Infinity), -Infinity);
  /* alle Steuerwerte eines Pruefstands in der Reihenfolge der Bedienelemente (Standardwerte des frischen Pruefstands), darueber over */
  function fullCtl(rigId, over) {
    const R = RIGS(rigId), defs = ctlDefs(rigId); const out = {};
    if (!R || !defs) return Object.assign({}, over || {});
    let rig = null; try { rig = R.create(rigId, { seed: 1 }); } catch (e) { rig = null; }
    defs.forEach(c => { if (c.type === 'button') return; let v; try { v = rig ? rig.getControl(c.key) : undefined; } catch (e) { v = undefined; } out[c.key] = v !== undefined ? v : c.value; });
    return Object.assign(out, over || {});
  }
  const memoMap = new WeakMap();
  function memo(obj, key, fn) {
    let m = memoMap.get(obj); if (!m) { m = {}; memoMap.set(obj, m); }
    if (!(key in m)) { try { m[key] = fn(); } catch (e) { return { error: String(e && e.message || e) }; } }
    return m[key];
  }
  /* gecachter Lauf mit Standard-Abtastung: { ok, res, st (final), errors } */
  const snapCache = new Map();
  function snap(rigId, ctl, T, o) {
    o = o || {};
    const key = rigId + '|' + JSON.stringify(ctl) + '|' + T + '|' + JSON.stringify(o.seq || []) + '|' + (o.sampleS || '') + '|' + JSON.stringify(o.after || {});
    if (snapCache.has(key)) return snapCache.get(key);
    const res = run(rigId, ctl, o.seq || [], T, o);
    const v = { ok: res.ok, res, st: res.final || {}, errors: res.errors.slice() };
    if (snapCache.size > 400) snapCache.clear();
    snapCache.set(key, v);
    return v;
  }
  /* Eingaben der Aufgabe: freigegebene Steuerwerte (own) ueber den festen Werten (fix) und den Standardwerten des Pruefstands */
  const effOf = (c, rigId, own, fix) => fullCtl(rigId, Object.assign({}, fix, initial(c, own)));
  const cdef = (rigId, key) => (ctlDefs(rigId) || []).find(x => x.key === key) || null;
  const dlabel = (rigId, key) => { const d = cdef(rigId, key); return d && d.label ? d.label : key; };
  function olabel(rigId, key, v) {
    const d = cdef(rigId, key);
    if (d && Array.isArray(d.options)) { const o = d.options.find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    return typeof v === 'number' ? fm(v, 2).replace(/,?0+$/, '') : String(v);
  }
  /* Steuerwerte-Zeile: specs = [{ key, want, tol? (relativ, nur Zahlen) }]; ok, wenn alle stimmen; why nennt nur die abweichenden */
  function setRow(r, rigId, eff, specs, label) {
    const bad = [];
    specs.forEach(s => {
      const x = eff[s.key], d = cdef(rigId, s.key), u = d && d.unit ? ' ' + d.unit : '';
      if (typeof s.want === 'number') {
        const tol = s.tol != null ? s.tol : 0.02;
        if (!(fin(+x) && Math.abs(x - s.want) <= tol * Math.abs(s.want) + 1e-9)) bad.push('„' + dlabel(rigId, s.key) + '“ steht auf ' + fm(x, 2).replace(/,?0+$/, '') + u + ', verlangt sind ' + fm(s.want, 2).replace(/,?0+$/, '') + u);
      } else if (x !== s.want) bad.push('„' + dlabel(rigId, s.key) + '“ steht auf „' + olabel(rigId, s.key, x) + '“, verlangt ist „' + olabel(rigId, s.key, s.want) + '“');
    });
    r(bad.length === 0, label, 'Im Prüfstand ' + bad.join('; ') + '.');
    return bad.length === 0;
  }

  /* ====================================================================== Pruefungen bauen */
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
  /* erste Zeile jeder Simulationsaufgabe: richtiger Pruefstand, gueltige Eingaben, Lauf ohne Fehlermeldung */
  function inputRow(c, r, sim, a, rigId) {
    const errs = c.problems.slice();
    if (sim && sim.errors) errs.push(...sim.errors);
    if (sim && sim.res && sim.res.rejected && sim.res.rejected.length) sim.res.rejected.forEach(x => errs.push('Der Prüfstand lehnt den Wert für „' + x.key + '“ ab.'));
    if (rigId && isObj(a) && typeof a.rig === 'string' && a.rig !== rigId) {
      const R = RIGS(), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }
  /* Zahlenzeile: val = Eingabe (Zahl oder null); opt = { label, refs:[{v}] (der erste ist der Hauptwert), tol (relativ, Standard 0,03) oder absTol, unit, digits,
   *   abs (Betrag vergleichen), wrong:[{v, msg}] (typische Fehlerbilder, jedes gerechnet) }. Die Warum-Texte sagen nur, was verglichen wurde:
   *   Richtung (zu klein/zu gross) und ein Fehlerbild erst, wenn der Wert des Lernenden mit dem gerechneten Fehlerwert uebereinstimmt (Regel 2 und 3). */
  function numRow(r, val, opt) {
    const pctTxt = q => fm(100 * q, Math.abs(100 * q - Math.round(100 * q)) < 1e-9 ? 0 : 1);
    const absMode = fin(opt.absTol), tol = fin(opt.tol) ? opt.tol : 0.03, dg = opt.digits == null ? 2 : opt.digits, u = opt.unit ? ' ' + opt.unit : '';
    const refs = opt.refs.filter(x => fin(x.v)), main = refs[0];
    let v = val;
    if (v !== null && opt.abs) v = Math.abs(v);
    const near = (a, b) => (absMode ? Math.abs(a - b) <= opt.absTol + 1e-9 : Math.abs(a - b) <= tol * Math.abs(b) + 1e-12);
    const tolTxt = absMode ? 'Toleranz ±' + fm(opt.absTol, 1) + u : 'Toleranz ' + pctTxt(tol) + ' %';
    const good = v !== null && !!main && refs.some(x => near(v, x.v));
    let why = 'Du hast keine Zahl eingetragen.';
    if (v !== null && main) {
      why = 'Dein Wert ' + fm(val, dg) + u + ' weicht um mehr als ' + (absMode ? fm(opt.absTol, 1) + u : pctTxt(tol) + ' %') + ' vom Rechenwert ab (' + fm(main.v, dg) + u + ').';
      const w = (opt.wrong || []).find(x => fin(x.v) && near(v, x.v));
      if (w) why = 'Dein Wert ' + fm(val, dg) + u + ' passt zu einem häufigen Fehler: ' + w.msg;
      else why += v < main.v ? ' Er ist zu klein.' : ' Er ist zu groß.';
    }
    r(good, opt.label + ' (' + tolTxt + ')', why);
    return good;
  }
  /* Zeile fuer eine Aufgabe aus ENR_CORE.calc.exercise: ex = Uebung, raw = Rohtext der Eingabe (rawOf) */
  function exRow(r, ex, raw, label) {
    if (!ex || ex.ok === false || typeof ex.check !== 'function') { r(false, label, 'Die Übung konnte nicht erzeugt werden: ' + (ex && ex.why ? ex.why : 'Rechenkern fehlt.')); return false; }
    if (raw === null || raw === undefined) { r(false, label, 'Du hast keine Zahl eingetragen.'); return false; }
    let q; try { q = ex.check(raw); } catch (e) { q = { ok: false, text: 'Die Prüfung der Zahl ist fehlgeschlagen.' }; }
    r(!!q.ok, label, q.ok ? '' : q.text);
    return !!q.ok;
  }
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 4; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^en(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  /* Aufgabenobjekt aus einem Modul M bauen: M = { text(), hint() -> [3], vals(), start(), sol(), wrong(), check, table?(), fields?(), choices?(), ask?, consts? };
   * text, hint, table, fields und choices werden erst beim ersten Zugriff gerechnet (Getter), damit das Laden der Datei nichts simuliert. */
  function def(id, cat, title, level, rig, M) {
    const o = { id, lab: 'enr', cat, title, level, rig };
    const lazy = (k, fn) => { Object.defineProperty(o, k, { enumerable: true, configurable: true, get() { const v = fn(); Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true }); return v; } }); };
    lazy('text', () => M.text());
    lazy('hint', () => M.hint());
    if (M.table) lazy('table', () => M.table());
    if (M.fields) lazy('fields', () => M.fields());
    if (M.choices) lazy('choices', () => M.choices());
    if (M.ask) o.ask = M.ask;
    if (M.consts) o.consts = M.consts;
    o.hintVals = () => M.vals(); o.start = () => M.start(); o.sol = () => M.sol(); o.wrong = () => M.wrong(); o.check = M.check;
    return o;
  }
  const ENR_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { def, fullCtl, fm, fin, clamp, clone, isObj, toNum, mean, ctlDefs, coerce, clean, initial, run, snap, effOf, setRow, mk, inputRow, numRow, exRow, rawOf, choiceOf,
      win, winMean, winMax, winMin, at, firstT, dayMax, faultHas, eventHas, memo, fieldNum, numAns, variants, smp, pctOf, needSys, hasSys, core: CORE, rigs: RIGS, cdef, dlabel }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberflaeche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, seq: o.seq || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null,
      text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, design: o.design || null, curve: o.curve || null };
  }
  ENR_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel oder einer benannten Konstante (task.consts) stammen;
   * 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).replace(/\b\d{1,2}\.\d{1,2}\./g, ' ').match(/\d+(?:,\d+)?/g) || []);   // Daten wie 21.12. sind Namen von Tagen
  const FREI = ['0', '1', '2', '3', '100'];
  function partTokens() {   // Namen wie si60, si36, 12 V Systemspannung der Voreinstellungen sind Namen, keine Rechenzahlen
    const out = [], C = CORE(); if (!C || !C.pv || !C.pv.presets) return out;
    try { Object.keys(C.pv.presets).forEach(k => { numTokens(k).forEach(y => out.push(y)); numTokens(C.pv.presets[k].name).forEach(y => out.push(y)); }); } catch (e) { /* ohne Tabelle keine Namen */ }
    return out;
  }
  function allowedTokens(vals, extra, texts) {
    const set = new Set(FREI); partTokens().forEach(x => set.add(x));
    (function walk(o) { Object.keys(o || {}).forEach(k => { const v = o[k]; if (isObj(v) || Array.isArray(v)) walk(v); else variants(v).forEach(x => set.add(x)); }); })(vals);
    (extra || []).forEach(v => variants(v).forEach(x => set.add(x)));
    (texts || []).forEach(tx => numTokens(tx).forEach(x => set.add(x)));
    return set;
  }
  ENR_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  ENR_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  root.ENR_TASKS = ENR_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await ENR_TASKS.run(t, answerOf(t, t.start()))), L = await ENR_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (32) */
  /* Jedes Beispiel: spec() liefert das Szenario (alle Steuerwerte, Ablauf, Dauer, Abtastung), die Simulation rechnet es genau wie die Oberflaeche
   * (Steuerwerte setzen, Ablauf abfahren), und text(res, n, d) formuliert die Beschreibung. Jede Zahl der Beschreibung laeuft ueber n(schluessel, wert, stellen):
   * Sie steht danach in `vals` und stammt aus Simulation, Pruefstand oder Kern (Regel 1). need(bedingung, text) bricht ab, wenn eine Aussage nicht stimmt. */
  const fc = (rig, over) => fullCtl(rig, over);
  const need = (cond, what) => { if (!cond) throw new Error('Aussage nicht gedeckt: ' + what); };
  const MOD = over => fc('modul', Object.assign({ preset: 'si60', ns: 1, np: 1, G: 1000, tcMode: 'manuell', tc: 25, lastart: 'mpp', view: 'kennlinie', compare: 'aus' }, over));
  const SCH = over => fc('schatten', Object.assign({ preset: 'si60', ns: 1, np: 1, orient: 'hochkant', bypass: 'ok', schatten: 'keiner', dunkel: 100, betroffen: 'modul1', G: 1000, diff: 12, tc: 25, mppt: 'global', zeitlauf: 'aus' }, over));
  const REG = over => fc('regler', Object.assign({ modul: 'si36', ns: 1, np: 1, ctrl: 'pwm', chem: 'blei', usys: 12, cap: 100, soc0: 50, tbat: 25, load: 0, lvd: true, lPv: 2, aPv: 4, lBat: 1, aBat: 10, quelle: 'konstant', G: 800, ta: 20, lauf: 'aus' }, over));
  const INS = over => fc('insel', Object.assign({ ort: 'mitte', datum: 'sommer', uhr: 0, wetter: 'klar', seed: 1, lauf: 'aus', modul: 'si60', ns: 1, np: 2, neigung: 35, azimut: 0, regler: 'mppt', chem: 'blei', usys: 12, cap: 200, soc0: 50, lvd: true, wr: 'kein', sparmodus: false, lastprofil: 'gartenhaus' }, over));
  const NET = over => fc('netz', Object.assign({ ort: 'mitte', datum: 'sommer', uhr: 0, wetter: 'klar', seed: 1, lauf: 'aus', modul: 'si60', ns: 10, np: 1, neigung: 35, azimut: 0, wrP: 3000, wrTyp: 'standard', limit: 100, netz: true, last: 'haushalt', lastF: 1, speicher: 0 }, over));
  const stAt = (res, t) => { const L = smp(res); let b = L[0]; for (let i = 0; i < L.length; i++) { if (L[i].t <= t + 1e-9) b = L[i]; else break; } return (b && b.state) || {}; };   // letzter Abtastwert bis t
  const DAY = 86400, TAGEND = 86400 - 60;
  const PROZ = x => 100 * x;

  const EXDEFS = [
    /* ---------------------------------------------------------------- Modul */
    { id: 'enx1', name: 'Eine einzelne Solarzelle', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ preset: 'zelle' }), seq: [], dur: 5, sampleS: 1 }),
      text(res, n, d) {
        const s = stAt(res, 5);
        need(s.uoc < 1 && s.isc > 5, 'Spannung unter 1 V, Strom groß');
        return 'Eine einzelne Solarzelle (156 mm) liefert bei ' + n('g', d.controls.G, 0) + ' W/m² und ' + n('tc', d.controls.tc, 0) + ' °C nur eine Leerlaufspannung von ' + n('uoc', s.uoc, 2) + ' V, aber einen Kurzschlussstrom von ' + n('isc', s.isc, 1) + ' A: Die Spannung ist klein, der Strom groß. Im MPP gibt sie ' + n('pmpp', s.pmpp, 1) + ' W ab (Wirkungsgrad ' + n('eta', s.eta, 1) + ' %, Füllfaktor ' + n('ff', s.ff, 2) + '). Für brauchbare Spannungen müssen viele Zellen in Reihe liegen.';
      } },
    { id: 'enx2', name: 'Das 60-Zellen-Modul bei STC', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({}), seq: [], dur: 5, sampleS: 1 }),
      text(res, n, d) {
        const s = stAt(res, 5), C = CORE(), ds = C.pv.datasheet('si60');
        need(ds && ds.rows && ds.rows.length > 0, 'Datenblattansicht vorhanden');
        const row = id => { const x = ds.rows.find(q => q.id === id); need(x && fin(+x.value), 'Datenblattzeile ' + id); return +x.value; };
        need(Math.abs(row('pmpp') - s.pmpp) < 0.06 * s.pmpp + 1e-9 && Math.abs(row('uoc') - s.uoc) < 0.1, 'Datenblatt gleicht Prüfstand');
        return 'Das 60-Zellen-Modul (Übungsmodul) liefert bei Standardbedingungen (' + n('g', d.controls.G, 0) + ' W/m², ' + n('tc', d.controls.tc, 0) + ' °C) im MPP ' + n('pmpp', s.pmpp, 1) + ' W bei ' + n('umpp', s.umpp, 1) + ' V und ' + n('impp', s.impp, 2) + ' A. Leerlaufspannung ' + n('uoc', s.uoc, 1) + ' V, Kurzschlussstrom ' + n('isc', s.isc, 1) + ' A, Füllfaktor ' + n('ff', s.ff, 2) + ', Wirkungsgrad ' + n('eta', s.eta, 1) + ' %. Die Datenblattansicht im Tab Kennlinien zeigt dieselben Werte (Pmpp dort ' + n('dpmpp', row('pmpp'), 0) + ' W).';
      } },
    { id: 'enx3', name: 'Leistungsanpassung: Lastwiderstand durchfahren', cat: 'Modul', rig: 'modul',
      spec: () => { const k = CORE().pv.keys('si60', { G: 1000, Tc: 25 }), rm = k.Umpp / k.Impp; return { controls: MOD({ lastart: 'widerstand', rLast: 0.2 }), seq: [{ t: 10, set: { rLast: rm } }, { t: 20, set: { rLast: 100 } }], dur: 30, sampleS: 5, rm }; },
      text(res, n, d) {
        const a = stAt(res, 5), b = stAt(res, 15), c = stAt(res, 25);
        need(b.p > a.p && b.p > c.p, 'Maximum beim Widerstand Umpp/Impp');
        return 'Das Modul speist einen Lastwiderstand. Bei R = ' + n('r1', a.rOp, 1) + ' Ω gibt es nur ' + n('p1', a.p, 1) + ' W ab (' + n('a1', a.anpass, 0) + ' % der möglichen Leistung), bei R = ' + n('r2', b.rOp, 2) + ' Ω, also Umpp / Impp, das Maximum ' + n('p2', b.p, 1) + ' W (' + n('a2', b.anpass, 0) + ' %), bei R = ' + n('r3', c.rOp, 0) + ' Ω nur ' + n('p3', c.p, 1) + ' W (' + n('a3', c.anpass, 0) + ' %). Leistungsanpassung heißt: Der Lastwiderstand passt zum MPP.';
      } },
    { id: 'enx4', name: 'Halbe Einstrahlung', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ G: 1000 }), seq: [{ t: 10, set: { G: 500 } }], dur: 20, sampleS: 5 }),
      text(res, n) {
        const a = stAt(res, 5), b = stAt(res, 15);
        need(b.isc < 0.6 * a.isc && b.uoc > 0.85 * a.uoc, 'Isc folgt G, Uoc fällt wenig');
        return 'Bei halber Einstrahlung (von ' + n('g1', a.G != null ? a.G : 1000, 0) + ' auf ' + n('g2', 500, 0) + ' W/m²) sinkt der Kurzschlussstrom von ' + n('i1', a.isc, 2) + ' A auf ' + n('i2', b.isc, 2) + ' A, er folgt der Einstrahlung. Die Leerlaufspannung fällt nur von ' + n('u1', a.uoc, 1) + ' V auf ' + n('u2', b.uoc, 1) + ' V (logarithmisch), die Leistung im MPP von ' + n('p1', a.pmpp, 0) + ' W auf ' + n('p2', b.pmpp, 0) + ' W.';
      } },
    { id: 'enx5', name: 'Heißer Sommer: Zelltemperatur 65 °C', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ tc: 25 }), seq: [{ t: 10, set: { tc: 65 } }], dur: 20, sampleS: 5 }),
      text(res, n) {
        const a = stAt(res, 5), b = stAt(res, 15), C = CORE(), tcf = C.pv.tempCoeff('si60');
        need(b.uoc < a.uoc && b.pmpp < a.pmpp, 'Uoc und Pmpp sinken');
        return 'Wird die Zelltemperatur von ' + n('t1', 25, 0) + ' °C auf ' + n('t2', 65, 0) + ' °C erhöht, sinkt die Leerlaufspannung von ' + n('u1', a.uoc, 1) + ' V auf ' + n('u2', b.uoc, 1) + ' V und die Leistung im MPP von ' + n('p1', a.pmpp, 0) + ' W auf ' + n('p2', b.pmpp, 0) + ' W, das sind ' + n('dp', 100 * (1 - b.pmpp / a.pmpp), 1) + ' %. Das Modell liefert dafür den Leistungskoeffizienten ' + n('gp', 100 * tcf.gammaP, 2) + ' %/K als Ergebnis, kein Eingabewert.';
      } },
    { id: 'enx6', name: 'Kalter klarer Wintertag', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ ns: 2, tc: 0, G: 600 }), seq: [], dur: 5, sampleS: 1 }),
      text(res, n, d) {
        const s = stAt(res, 5), C = CORE(), g = C.inv.gridTable[0];
        need(g && s.uoc > g.udcMax, 'Strangspannung über der Grenze des Mikro-Wechselrichters');
        return 'Bei ' + n('tc', d.controls.tc, 0) + ' °C Zelltemperatur und ' + n('g', d.controls.G, 0) + ' W/m² liegt die Leerlaufspannung von ' + n('ns', d.controls.ns, 0) + ' Modulen in Reihe bei ' + n('uoc', s.uoc, 1) + ' V. Der Mikro-Wechselrichter der Typentabelle verträgt höchstens ' + n('umax', g.udcMax, 0) + ' V am Eingang: Kälte lässt die Spannung steigen, die Strangauslegung muss mit dem kältesten Wert rechnen.';
      } },
    { id: 'enx7', name: 'Module in Reihe', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ ns: 1 }), seq: [{ t: 10, set: { ns: 3 } }], dur: 20, sampleS: 5 }),
      text(res, n) {
        const a = stAt(res, 5), b = stAt(res, 15);
        need(Math.abs(b.uoc / a.uoc - 3) < 0.01 && Math.abs(b.isc - a.isc) < 0.01, 'Spannungen addieren, Strom bleibt');
        return 'Ein Modul hat ' + n('u1', a.uoc, 1) + ' V Leerlaufspannung und ' + n('i1', a.isc, 1) + ' A Kurzschlussstrom. Drei Module in Reihe haben ' + n('u3', b.uoc, 1) + ' V, aber weiter nur ' + n('i3', b.isc, 1) + ' A: Die Spannungen addieren sich, der Strom bleibt. Die MPP-Leistung steigt auf ' + n('p3', b.pmpp, 0) + ' W.';
      } },
    { id: 'enx8', name: 'Module parallel', cat: 'Modul', rig: 'modul',
      spec: () => ({ controls: MOD({ np: 1 }), seq: [{ t: 10, set: { np: 3 } }], dur: 20, sampleS: 5 }),
      text(res, n) {
        const a = stAt(res, 5), b = stAt(res, 15);
        need(Math.abs(b.isc / a.isc - 3) < 0.01 && Math.abs(b.uoc - a.uoc) < 0.01, 'Ströme addieren, Spannung bleibt');
        return 'Ein Modul hat ' + n('i1', a.isc, 1) + ' A Kurzschlussstrom bei ' + n('u1', a.uoc, 1) + ' V Leerlaufspannung. Drei Module parallel haben ' + n('i3', b.isc, 1) + ' A bei weiter ' + n('u3', b.uoc, 1) + ' V: Die Ströme addieren sich, die Spannung bleibt. Die MPP-Leistung steigt auf ' + n('p3', b.pmpp, 0) + ' W.';
      } },
    /* ---------------------------------------------------------------- Verschattung */
    { id: 'enx9', name: 'Ein Laubblatt auf einer Zelle', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ schatten: 'blatt' }), seq: [], dur: 60, sampleS: 10 }),
      text(res, n) {
        const s = stAt(res, 60);
        need(s.bypassN >= 1 && s.loss > s.fracShade, 'Bypassdiode leitet, Verlust größer als der Flächenanteil');
        return 'Ein Laubblatt deckt eine von ' + n('z', 60, 0) + ' Zellen ab, das sind ' + n('f', s.fracShade, 1) + ' % der Fläche. Trotzdem sinkt die MPP-Leistung von ' + n('p0', s.pFree, 0) + ' W auf ' + n('p1', s.pMpp, 0) + ' W, ein Verlust von ' + n('l', s.loss, 0) + ' %: Der Teilstrang mit der verschatteten Zelle wird von der Bypassdiode überbrückt (leitende Bypassdioden: ' + n('b', s.bypassN, 0) + '). In der verschatteten Zelle bleibt eine Verlustleistung von ' + n('h', s.hotP, 0) + ' W.';
      } },
    { id: 'enx10', name: 'Hecke von unten: hochkant gegen quer', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ schatten: 'kante', tiefe: 10, orient: 'hochkant' }), seq: [{ t: 30, set: { orient: 'quer' } }], dur: 60, sampleS: 10 }),
      text(res, n) {
        const a = stAt(res, 25), b = stAt(res, 55);
        need(a.loss > b.loss && a.subsHit.length > b.subsHit.length, 'hochkant verliert mehr als quer');
        return 'Eine Hecke wirft Schatten auf die unteren ' + n('t', 10, 0) + ' % des Moduls. Hochkant montiert sind ' + n('c1', a.shadedCells, 0) + ' Zellen verschattet und ' + n('s1', a.subsHit.length, 0) + ' Teilstränge betroffen: Die Leistung sinkt um ' + n('l1', a.loss, 0) + ' % auf ' + n('p1', a.pMpp, 0) + ' W. Quer montiert sind ' + n('c2', b.shadedCells, 0) + ' Zellen verschattet, aber nur ' + n('s2', b.subsHit.length, 0) + ' Teilstrang betroffen: Der Verlust beträgt nur ' + n('l2', b.loss, 0) + ' % (' + n('p2', b.pMpp, 0) + ' W), die übrigen Teilstränge liefern weiter.';
      } },
    { id: 'enx11', name: 'Zwei Maxima: lokal gegen global', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ schatten: 'kante', tiefe: 10, orient: 'quer', mppt: 'lokal' }), seq: [{ t: 30, set: { mppt: 'global' } }], dur: 90, sampleS: 10 }),
      text(res, n) {
        const a = stAt(res, 25), b = stAt(res, 85);
        need(a.nPeaks >= 2 && a.pOp < 0.95 * a.pMpp && b.pOp >= 0.95 * b.pMpp, 'Tracker lokal hängt, global findet das Maximum');
        return 'Die P-U-Kurve hat ' + n('np', a.nPeaks, 0) + ' Maxima. Der einfache Tracker (lokal) startet bei hoher Spannung und bleibt im lokalen Maximum hängen: Er liefert nur ' + n('p1', a.pOp, 0) + ' W, obwohl das globale Maximum ' + n('pm', a.pMpp, 0) + ' W erreicht. Nach dem Wechsel auf den Suchlauf über den ganzen Spannungsbereich (global) arbeitet er bei ' + n('p2', b.pOp, 0) + ' W.';
      } },
    { id: 'enx12', name: 'Ohne Bypassdiode: Hotspot', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ schatten: 'blatt', bypass: 'ok' }), seq: [{ t: 30, set: { bypass: 'fehlt' } }], dur: 60, sampleS: 10 }),
      text(res, n) {
        const a = stAt(res, 25), b = stAt(res, 55);
        need(b.hotP > a.hotP && b.pMpp < a.pMpp, 'ohne Bypassdiode mehr Hotspot-Leistung und weniger Ertrag');
        return 'Mit funktionierender Bypassdiode bleibt in der verschatteten Zelle eine Verlustleistung von ' + n('h1', a.hotP, 0) + ' W, die Modulleistung ist ' + n('p1', a.pMpp, 0) + ' W. Fehlt die Bypassdiode, steigt die Verlustleistung in der Zelle auf ' + n('h2', b.hotP, 0) + ' W und die Modulleistung fällt auf ' + n('p2', b.pMpp, 0) + ' W. Die Bypassdiode begrenzt den Hotspot, sie beseitigt ihn nicht.';
      } },
    { id: 'enx13', name: 'Der Schatten der Hecke über den Tag', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ schatten: 'hecke', datum: 'winter', uhr: 10, hH: 1.5, hD: 3, beta: 35 }), seq: [{ t: 10, set: { uhr: 11 } }, { t: 20, set: { uhr: 12 } }, { t: 30, set: { uhr: 14 } }, { t: 40, set: { datum: 'fruehling', uhr: 12 } }], dur: 50, sampleS: 5 }),
      text(res, n, d) {
        const a = stAt(res, 5), b = stAt(res, 15), c = stAt(res, 25), e = stAt(res, 35), f = stAt(res, 45);
        need(c.fracShade > 0 && f.fracShade === 0, 'Winter verschattet, Frühling nicht');
        return 'Eine Hecke von ' + n('h', d.controls.hH, 1) + ' m Höhe steht ' + n('d', d.controls.hD, 0) + ' m vor dem Modul. Am 21.12. (Sonnenzeit) beträgt der verschattete Anteil um 10 Uhr ' + n('a1', a.fracShade, 0) + ' %, um 11 Uhr ' + n('a2', b.fracShade, 0) + ' %, um 12 Uhr ' + n('a3', c.fracShade, 0) + ' % (Sonnenhöhe ' + n('al', c.alt, 1) + '°) und um 14 Uhr ' + n('a4', e.fracShade, 0) + ' %. Am 21.3. steht die Sonne mittags bei ' + n('al2', f.alt, 1) + '° und der verschattete Anteil beträgt ' + n('a5', f.fracShade, 0) + ' %.';
      } },
    { id: 'enx14', name: 'Zwei Stränge, einer im Schatten', cat: 'Verschattung', rig: 'schatten',
      spec: () => ({ controls: SCH({ np: 2, schatten: 'kante', tiefe: 100, orient: 'quer', betroffen: 'strang1', mppt: 'global' }), seq: [{ t: 30, set: { mppt: 'fest', uFrac: 100 } }], dur: 60, sampleS: 10 }),
      text(res, n) {
        const a = stAt(res, 25), b = stAt(res, 55), C = CORE(), lim = C.pv.spec('si60').Irev;
        need(b.iRev > 0 && b.iRev < lim && a.pMpp < a.pFree, 'Rückstrom vorhanden und unter der Belastbarkeit');
        return 'Zwei Stränge liegen parallel, einer liegt vollständig im Kernschatten. Im MPP verliert die Anlage ' + n('l', a.loss, 0) + ' % (' + n('p1', a.pMpp, 0) + ' W gegen ' + n('p0', a.pFree, 0) + ' W unverschattet). Bei Leerlaufspannung des Feldes (fest, 100 % von Uoc) fließen ' + n('ir', b.iRev, 1) + ' A rückwärts durch den verschatteten Strang; das Modell setzt die zulässige Rückstrombelastbarkeit mit ' + n('lim', lim, 0) + ' A an. Bei zwei Strängen bleibt der Rückstrom klein, ab drei parallelen Strängen gelten Strangsicherungen als Faustregel.';
      } },
    /* ---------------------------------------------------------------- Laderegler */
    { id: 'enx15', name: 'PWM am 12-V-Akku mit 60-Zellen-Modul', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si60', ctrl: 'pwm', G: 800 }), seq: [], dur: 1200, sampleS: 60 }),
      text(res, n, d) {
        const s = res.final, q = 100 * s.pPv / s.pMpp;
        need(s.uPv < s.uMpp && q < 80, 'PWM zwingt das Modul unter Umpp');
        return 'Der PWM-Regler legt das 60-Zellen-Modul fast direkt an die Akkuspannung: Das Modul arbeitet bei ' + n('u', s.uPv, 1) + ' V statt im MPP bei ' + n('um', s.uMpp, 1) + ' V. Bei ' + n('g', d.controls.G, 0) + ' W/m² liefert es ' + n('p', s.pPv, 0) + ' W statt ' + n('pm', s.pMpp, 0) + ' W: Es bleiben ' + n('q', q, 0) + ' % der möglichen Leistung, ' + n('v', s.pMpp - s.pPv, 0) + ' W gehen verloren.';
      } },
    { id: 'enx16', name: 'PWM passt zum 36-Zellen-Modul', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si36', ctrl: 'pwm', G: 800 }), seq: [], dur: 1200, sampleS: 60 }),
      text(res, n, d) {
        const s = res.final, q = 100 * s.pPv / s.pMpp, r60 = snap('regler', REG({ modul: 'si60', ctrl: 'pwm', G: 800 }), 1200, { sampleS: 60 }).st, q60 = 100 * r60.pPv / r60.pMpp;
        need(q > q60, 'si36 verliert am PWM-Regler weniger als si60');
        return 'Das 36-Zellen-Modul ist für 12 V gebaut: Seine MPP-Spannung (' + n('um', s.uMpp, 1) + ' V) liegt nahe an der Akkuspannung (' + n('u', s.uPv, 1) + ' V am Modul). Der PWM-Regler holt ' + n('q', q, 0) + ' % der möglichen Leistung heraus (' + n('p', s.pPv, 0) + ' W von ' + n('pm', s.pMpp, 0) + ' W). Zum Vergleich: Das 60-Zellen-Modul kommt am PWM-Regler nur auf ' + n('q60', q60, 0) + ' %.';
      } },
    { id: 'enx17', name: 'Dreistufenladung beobachten', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si60', ctrl: 'mppt', cap: 50, soc0: 60, G: 800 }), seq: [], dur: 36000, sampleS: 60 }),
      text(res, n) {
        const L = smp(res), t2 = firstT(L, x => x.state.stage === 2), t3 = firstT(L, x => x.state.stage === 3);
        need(t2 !== null && t3 !== null && t3 > t2, 'Bulk, Absorption und Float treten nacheinander auf');
        const s2 = at(L, t2).state, s3 = at(L, t3).state;
        return 'Der Akku (' + n('c', 50, 0) + ' Ah, Start bei ' + n('s0', 60, 0) + ' % Ladezustand) wird zuerst mit dem größtmöglichen Strom geladen (Bulk) bis zur Ladeschlussspannung. Das ist nach ' + n('t2', t2 / 3600, 1) + ' h bei ' + n('s2', s2.soc, 0) + ' % Ladezustand der Fall: Die Absorption beginnt, die Spannung wird gehalten, der Strom sinkt. Nach ' + n('t3', t3 / 3600, 1) + ' h folgt die Erhaltungsladung (Float) bei ' + n('s3', s3.soc, 0) + ' % Ladezustand. Die Ladeschlussspannung bedeutet nicht „Akku voll“.';
      } },
    { id: 'enx18', name: 'Ladeschlussspannung falsch', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si60', ctrl: 'mppt', cap: 50, soc0: 80, G: 800, uAbs: 15.2 }), seq: [], dur: 18000, sampleS: 60 }),
      text(res, n, d) {
        const s = res.final, lo = snap('regler', REG({ modul: 'si60', ctrl: 'mppt', cap: 50, soc0: 80, G: 800, uAbs: 13.4 }), 18000, { sampleS: 60 }).st, ok = snap('regler', REG({ modul: 'si60', ctrl: 'mppt', cap: 50, soc0: 80, G: 800 }), 18000, { sampleS: 60 }).st;
        need(s.gasAh > ok.gasAh && lo.soc < ok.soc, 'zu hoch gast, zu niedrig lädt nicht voll');
        return 'Mit der Ladeschlussspannung ' + n('ua', d.controls.uAbs, 1) + ' V (Standard für Blei: ' + n('us', ok.uAbs, 1) + ' V) gast der Blei-Akku: In ' + n('h', 5, 0) + ' h sammeln sich ' + n('g', s.gasAh, 2) + ' Ah Gasung gegen ' + n('g0', ok.gasAh, 2) + ' Ah beim Standardwert. Stellt man ' + n('un', 13.4, 1) + ' V ein, wird der Akku nicht voll: ' + n('so', lo.soc, 0) + ' % Ladezustand gegen ' + n('sn', ok.soc, 0) + ' % beim Standardwert.';
      } },
    { id: 'enx19', name: 'Ohne Regler: Der Akku gast', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si60', ctrl: 'direkt', cap: 50, soc0: 90, G: 1000 }), seq: [], dur: 14400, sampleS: 60 }),
      text(res, n) {
        const s = res.final, L = smp(res), um = L.reduce((m, x) => Math.max(m, x.state.uBat || 0), 0);
        need(s.gasAh > 0, 'Gasung tritt auf');
        return 'Ohne Laderegler hängt das 60-Zellen-Modul direkt am Blei-Akku (' + n('c', 50, 0) + ' Ah, Start bei ' + n('s0', 90, 0) + ' %). Der Akku nimmt nur so viel Strom auf, wie seine Ladeannahme erlaubt; der Überschuss hebt die Spannung auf bis zu ' + n('um', um, 1) + ' V. In ' + n('h', 4, 0) + ' h entstehen ' + n('g', s.gasAh, 1) + ' Ah Gasung: Wasser geht verloren, bei Blei entsteht Knallgas.';
      } },
    { id: 'enx20', name: 'Der Tiefentladeschutz schützt', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si36', quelle: 'tagesgang', datum: 'winter', uhr: 18, wetter: 'bedeckt', cap: 100, soc0: 60, load: 100, lvd: true }), seq: [], dur: 43200, sampleS: 300 }),
      text(res, n, d) {
        const off = snap('regler', REG({ modul: 'si36', quelle: 'tagesgang', datum: 'winter', uhr: 18, wetter: 'bedeckt', cap: 100, soc0: 60, load: 100, lvd: false }), 43200, { sampleS: 300 });
        const mn = r => winMin(smp(r), 0, 43200, x => x.state.soc);
        need(mn(res) > mn(off.res), 'mit Schutz bleibt der Ladezustand höher');
        return 'Eine Dauerlast von ' + n('p', d.controls.load, 0) + ' W zieht den Akku (' + n('c', d.controls.cap, 0) + ' Ah, Start bei ' + n('s0', d.controls.soc0, 0) + ' %) über eine Winternacht leer. Mit Tiefentladeschutz trennt der Regler die Last, der Ladezustand fällt nur auf ' + n('m1', mn(res), 0) + ' %. Ohne Schutz sinkt er auf ' + n('m2', mn(off.res), 0) + ' %, die grob geschätzte Lebensdauer des Akkus sinkt dabei um ' + n('dm', off.st.damage, 1) + ' %.';
      } },
    { id: 'enx21', name: 'Dünnes Kabel', cat: 'Laderegler', rig: 'regler',
      spec: () => ({ controls: REG({ modul: 'si60', ctrl: 'pwm', aPv: 1.5, lPv: 20, G: 800 }), seq: [], dur: 1200, sampleS: 60 }),
      text(res, n, d) {
        const s = res.final, kap = res.rig.params.kappa, R = 2 * d.controls.lPv / (kap * d.controls.aPv), du = s.iPv * R, pv = s.iPv * s.iPv * R;
        const dick = snap('regler', REG({ modul: 'si60', ctrl: 'pwm', aPv: 10, lPv: 2, G: 800 }), 1200, { sampleS: 60 }).st;
        need(s.pPv < dick.pPv && du > 0, 'dünnes Kabel liefert weniger');
        return 'Das Modul liegt über ' + n('l', d.controls.lPv, 0) + ' m Leitung mit nur ' + n('a', d.controls.aPv, 1) + ' mm² am Regler. Bei ' + n('i', s.iPv, 1) + ' A fällt auf der Leitung (Hin- und Rückleiter, κ = ' + n('k', kap, 0) + ' m/(Ω·mm²)) eine Spannung von ' + n('du', du, 2) + ' V ab, das sind ' + n('pv', pv, 0) + ' W Verlustleistung. Der Regler misst die Spannung an seinen Klemmen und sieht den Spannungsfall nicht; ' + n('p1', s.pPv, 0) + ' W kommen an, mit kurzem dickem Kabel (' + n('a2', 10, 0) + ' mm², ' + n('l2', 2, 0) + ' m) wären es ' + n('p2', dick.pPv, 0) + ' W.';
      } },
    /* ---------------------------------------------------------------- Inselanlage */
    { id: 'enx22', name: 'Sommertag klar: Tagesgang', cat: 'Inselanlage', rig: 'insel',
      spec: () => ({ controls: INS({ datum: 'sommer', wetter: 'klar', uhr: 0 }), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const L = smp(res), tr = firstT(L, x => x.state.elev > 0), ts = L.slice().reverse().find(x => x.state.elev > 0), gm = winMax(L, 0, TAGEND, x => x.state.gPoa), pm = winMax(L, 0, TAGEND, x => x.state.pPv), e = dayMax(res, 'ePv');
        need(tr !== null && ts && gm > 0 && e > 0, 'Sonne geht auf und unter');
        return 'Am Sommertag (21.6., klarer Himmel, Sonnenzeit) geht die Sonne um etwa ' + n('r', tr / 3600, 0) + ' Uhr auf und um etwa ' + n('s', ts.t / 3600, 0) + ' Uhr unter. Die Einstrahlung in der Modulebene erreicht ' + n('g', gm, 0) + ' W/m², die Solarleistung ' + n('p', pm, 0) + ' W. Das Feld liefert an diesem Tag ' + n('e', e, 0) + ' Wh; die Energieflusspfeile im Prüfstand zeigen, wie sich die Leistung auf Akku und Last verteilt.';
      } },
    { id: 'enx23', name: 'Winter bedeckt: reicht der Akku?', cat: 'Inselanlage', rig: 'insel',
      spec: () => ({ controls: INS({ datum: 'winter', wetter: 'bedeckt', uhr: 12, cap: 100, soc0: 80 }), seq: [], dur: 3 * DAY, sampleS: 900 }),
      text(res, n) {
        const L = smp(res), mn = winMin(L, 0, 3 * DAY, x => x.state.soc), ev = res.events.filter(e => e.id === 'lvd-aus').length, e1 = dayMax(res, 'ePv'), s = res.final.soc;
        return 'Drei bedeckte Wintertage (21.12., Start mittags bei ' + n('s0', 80, 0) + ' % Ladezustand, Akku ' + n('c', 100, 0) + ' Ah): Das Feld liefert an einem Tag höchstens ' + n('e', e1, 0) + ' Wh. Der Ladezustand fällt bis auf ' + n('m', mn, 0) + ' %, am Ende liegt er bei ' + n('s', s, 0) + ' %. Der Tiefentladeschutz hat ' + n('lv', ev, 0) + '-mal die Last getrennt.';
      } },
    { id: 'enx24', name: 'Neigung: steil im Winter, flach im Sommer', cat: 'Inselanlage', rig: 'insel',
      spec: () => ({ controls: INS({ datum: 'winter', wetter: 'klar', uhr: 0, neigung: 35 }), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const C = CORE(), lat = C.sun.site('mitte').lat, bw = C.sun.bestTilt(355, lat, 0, 0), bs = C.sun.bestTilt(172, lat, 0, 0);
        const de = (N, b) => C.sun.dayEnergy({ N, lat, beta: b, gam: 0, c: 0 });
        const steil = snap('insel', INS({ datum: 'winter', wetter: 'klar', uhr: 0, neigung: bw }), TAGEND, { sampleS: 600 }), e35 = dayMax(res, 'ePv'), es = dayMax(steil.res, 'ePv');
        need(bw > bs && de(355, bw) > de(355, 35) && de(172, bs) > de(172, bw) && es > e35, 'Winter steil besser, Sommer flach besser');
        return 'Am 21.12. (klar) trifft die Sonne bei Neigung ' + n('b1', 35, 0) + '° ' + n('w1', de(355, 35), 2) + ' kWh/m² auf das Modul, bei der besten Neigung ' + n('bw', bw, 0) + '° sind es ' + n('w2', de(355, bw), 2) + ' kWh/m²; das Feld liefert dann ' + n('e2', es, 0) + ' Wh statt ' + n('e1', e35, 0) + ' Wh. Im Sommer (21.6.) liegt die beste Neigung bei ' + n('bs', bs, 0) + '° mit ' + n('s2', de(172, bs), 2) + ' kWh/m²: Im Winter ist steil besser, im Sommer flach.';
      } },
    { id: 'enx25', name: 'Camper: Kühlbox über die Nacht', cat: 'Inselanlage', rig: 'insel',
      spec: () => ({ controls: INS({ usys: 24, lastprofil: 'camper', cap: 100, soc0: 100, datum: 'sommer', wetter: 'klar', uhr: 18 }), seq: [], dur: 14 * 3600, sampleS: 600 }),
      text(res, n, d) {
        const L = smp(res), s0 = L[0].state.soc, mn = winMin(L, 0, 14 * 3600, x => x.state.soc), s1 = res.final.soc, C = CORE();
        need(C.loads && typeof C.loads.profile === 'function', 'ENR_CORE.loads (Lastprofile)');
        const lp = C.loads.profile('camper');
        need(mn <= s0 && lp && fin(lp.energyWh), 'Ladezustand sinkt über die Nacht');
        return 'Der Camper (' + n('u', d.controls.usys, 0) + ' V, Akku ' + n('c', d.controls.cap, 0) + ' Ah, Verbrauch laut Geräteliste ' + n('ed', lp.energyWh, 0) + ' Wh pro Tag) beginnt um ' + n('t0', d.controls.uhr, 0) + ' Uhr bei ' + n('s0', s0, 0) + ' % Ladezustand. Die Kühlbox (Verdichter mit Einschaltdauer) läuft die ganze Nacht; um ' + n('t1', (d.controls.uhr + 14) % 24, 0) + ' Uhr morgens liegt der Ladezustand bei ' + n('s1', s1, 0) + ' %, das Minimum war ' + n('m', mn, 0) + ' %.';
      } },
    { id: 'enx26', name: 'Der Wechselrichter-Standby frisst die Nacht', cat: 'Inselanlage', rig: 'insel',
      spec: () => ({ controls: INS({ usys: 12, wr: '1000', sparmodus: false, lastprofil: 'frei', pFrei: 0, datum: 'winter', wetter: 'klar', uhr: 18, cap: 200, soc0: 100 }), seq: [], dur: 12 * 3600, sampleS: 600 }),
      text(res, n, d) {
        const C = CORE(); need(C.inv && C.inv.models && C.inv.models.insel, 'Wechselrichter-Modell');
        const a = C.inv.models.insel.a, sn = 1000, L = smp(res), eBat = -L.reduce((s, x, i) => (i ? s + 0.5 * (x.state.pBat + L[i - 1].state.pBat) * (x.t - L[i - 1].t) / 3600 : s), 0);
        need(eBat > 0, 'Akku gibt Energie ab');
        const h24 = n('h24', 24, 0);
        return 'Ein Inselwechselrichter mit ' + n('sn', sn, 0) + ' VA ohne angeschlossene Last (aber im Normalbetrieb) verbraucht Eigenbedarf: Das Modell rechnet ' + n('a', 100 * a, 1) + ' % der Nennleistung, das sind ' + n('p', a * sn, 0) + ' W oder ' + n('w', a * sn * 24, 0) + ' Wh in ' + h24 + ' Stunden. Im Prüfstand zieht er in der Winternacht von ' + n('t0', d.controls.uhr, 0) + ' bis ' + n('t1', (d.controls.uhr + 12) % 24, 0) + ' Uhr ' + n('e', eBat, 0) + ' Wh aus dem Akku. Im Sparmodus verbraucht er nur ' + n('sp', 1.5, 1) + ' W (' + n('sw', 1.5 * 24, 0) + ' Wh in ' + h24 + ' Stunden), erkennt dafür aber Lasten unter ' + n('sg', 25, 0) + ' W nicht.';
      } },
    /* ---------------------------------------------------------------- Netzanlage */
    { id: 'enx27', name: 'Netzeinspeisung am Sonnentag', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({}), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const s = res.final, L = smp(res), pm = winMax(L, 0, TAGEND, x => x.state.pAc);
        need(s.eEigen >= 0 && s.eEinsp > 0 && s.eBezug > 0, 'Eigenverbrauch, Einspeisung und Bezug');
        return 'An einem klaren Sommertag erreicht die Anlage (' + n('ns', 10, 0) + ' Module in Reihe, Wechselrichter ' + n('wr', 3000, 0) + ' W) höchstens ' + n('pm', pm, 0) + ' W Wechselstromleistung. Der Haushalt verbraucht ' + n('eh', s.eEigen + s.eBezug, 0) + ' Wh, davon deckt die Anlage direkt ' + n('ee', s.eEigen, 0) + ' Wh, ' + n('eb', s.eBezug, 0) + ' Wh kommen aus dem Netz, ' + n('ei', s.eEinsp, 0) + ' Wh werden eingespeist. Eigenverbrauchsquote ' + n('q', s.quote, 0) + ' %, Autarkiegrad ' + n('a', s.autarkie, 0) + ' %.';
      } },
    { id: 'enx28', name: 'Teillast-Wirkungsgrad: Standard gegen einfach', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({ wrTyp: 'standard' }), seq: [{ t: 3600, set: { wrTyp: 'einfach' } }], dur: 7200, sampleS: 600 }),
      text(res, n) {
        const C = CORE(), a = stAt(res, 3000), b = stAt(res, 7200), e1 = C.inv.euroEta('standard'), e2 = C.inv.euroEta('einfach');
        need(e1 > e2, 'Standard hat den besseren Europäischen Wirkungsgrad');
        return 'Der Standard-Wechselrichter hat einen Europäischen Wirkungsgrad von ' + n('e1', 100 * e1, 1) + ' %, der einfache nur ' + n('e2', 100 * e2, 1) + ' %: Der Europäische Wirkungsgrad gewichtet sechs Lastpunkte nach ihrer Häufigkeit. Der Prüfstand zeigt ' + n('m1', a.euroEta, 1) + ' % beziehungsweise ' + n('m2', b.euroEta, 1) + ' % als Kennzahl; im Teillastbereich fällt der Unterschied am größten aus.';
      } },
    { id: 'enx29', name: 'Der Wechselrichter ist zu klein', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({ ns: 12, np: 1, wrP: 1500 }), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const L = smp(res), pm = winMax(L, 0, TAGEND, x => x.state.pAc), pd = winMax(L, 0, TAGEND, x => x.state.pDc), b = res.balance && res.balance.rig, ec = b && fin(b.eCurt) ? b.eCurt : NaN;
        need(pm <= 1500 + 1e-6 && pd > 1500 && fin(ec) && ec > 0, 'Wechselrichter begrenzt auf die Nennleistung');
        return 'Das Feld (' + n('ns', 12, 0) + ' Module in Reihe) könnte mittags ' + n('pd', pd, 0) + ' W liefern, der Wechselrichter ist aber nur für ' + n('pn', 1500, 0) + ' W gebaut und begrenzt auf ' + n('pm', pm, 0) + ' W (Clipping). An diesem Tag gehen dadurch ' + n('ec', ec, 0) + ' Wh verloren.';
      } },
    { id: 'enx30', name: 'Netzausfall mittags', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({ uhr: 10 }), seq: [{ t: 7200, set: { netz: false } }, { t: 10800, set: { netz: true } }], dur: 14400, sampleS: 300 }),
      text(res, n, d) {
        const a = stAt(res, 7000), b = stAt(res, 9000), c = stAt(res, 14400), t0 = d.controls.uhr;
        need(a.pAc > 0 && b.pAc === 0 && c.pAc > 0, 'Abschaltung bei Netzausfall und Wiederanlauf');
        return 'Um ' + n('ta', t0 + 2, 0) + ' Uhr fällt das Netz aus, obwohl die Sonne scheint: Der Wechselrichter schaltet ab, seine Wechselstromleistung fällt von ' + n('p1', a.pAc, 0) + ' W auf ' + n('p2', b.pAc, 0) + ' W. Er geht nicht in den Inselbetrieb, weil sonst die Leitung unter Spannung stehen könnte. Nach der Wiederkehr des Netzes um ' + n('tb', t0 + 3, 0) + ' Uhr speist er wieder mit ' + n('p3', c.pAc, 0) + ' W ein.';
      } },
    { id: 'enx31', name: 'Speicher erhöht den Eigenverbrauch', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({ speicher: 5 }), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const s = res.final, o = snap('netz', NET({ speicher: 0 }), TAGEND, { sampleS: 600 }).st;
        need(s.autarkie > o.autarkie && s.eEinsp < o.eEinsp, 'Speicher erhöht Autarkie und senkt Einspeisung');
        return 'Ohne Speicher deckt die Anlage an diesem Sommertag ' + n('a0', o.autarkie, 0) + ' % des Haushaltsverbrauchs (Eigenverbrauchsquote ' + n('q0', o.quote, 0) + ' %) und speist ' + n('i0', o.eEinsp, 0) + ' Wh ein. Mit ' + n('sp', 5, 0) + ' kWh Speicher steigt der Autarkiegrad auf ' + n('a1', s.autarkie, 0) + ' % (Quote ' + n('q1', s.quote, 0) + ' %), die Einspeisung sinkt auf ' + n('i1', s.eEinsp, 0) + ' Wh. Der Tageswert in Euro beträgt ' + n('e0', o.eurTag, 2) + ' € gegen ' + n('e1', s.eurTag, 2) + ' € (Preise sind Annahmen, bitte aktualisieren).';
      } },
    { id: 'enx32', name: 'Steckersolargerät', cat: 'Netzanlage', rig: 'netz',
      spec: () => ({ controls: NET({ ns: 1, np: 2, wrP: 800 }), seq: [], dur: TAGEND, sampleS: 600 }),
      text(res, n) {
        const s = res.final, L = smp(res), pm = winMax(L, 0, TAGEND, x => x.state.pAc);
        need(pm <= 800 + 1e-6 && s.eEigen > 0, 'Leistung unter 800 VA, Eigenverbrauch vorhanden');
        return 'Zwei 60-Zellen-Module parallel an einem Mikro-Wechselrichter mit ' + n('wr', 800, 0) + ' VA: Die Wechselstromleistung erreicht höchstens ' + n('pm', pm, 0) + ' W. Der Haushalt deckt damit ' + n('ee', s.eEigen, 0) + ' Wh seines Tagesverbrauchs direkt (Autarkiegrad ' + n('a', s.autarkie, 1) + ' %), ' + n('ei', s.eEinsp, 0) + ' Wh gehen ins Netz. Stand der Regelung für solche Geräte bitte beim Ausbilder prüfen.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        if (!R.defs[def.rig]) throw new Error('Prüfstand „' + def.rig + '“ fehlt');
        const d = def.spec(), res = run(def.rig, d.controls, d.seq || [], d.dur, { sampleS: d.sampleS });
        if (!res.ok) throw new Error(res.errors.join(' ') || 'Der Lauf ist fehlgeschlagen');
        if (res.rejected.length) throw new Error('Der Prüfstand lehnt Werte ab: ' + res.rejected.map(x => x.key).join(', '));
        const vals = {};
        const n = (k, v, dg) => { if (!fin(v)) throw new Error('Wert "' + k + '" ist keine Zahl'); vals[k] = v; const s = fm(v, dg); return s.indexOf(',') >= 0 ? s.replace(/0+$/, '').replace(/,$/, '') : s; };
        const desc = def.text(res, n, d);
        if (/NaN|undefined|Infinity/.test(desc)) throw new Error('ungültiger Wert im Text: ' + desc.slice(0, 80));
        const ex = { id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc, controls: d.controls, vals };
        if (d.seq && d.seq.length) ex.seq = d.seq;
        ex.dur = d.dur; ex.sampleS = d.sampleS;
        out.push(ex);
      } catch (e) { out.push({ id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc: 'Dieses Beispiel konnte nicht berechnet werden: ' + String(e && e.message || e), controls: {}, vals: {}, error: String(e && e.message || e) }); }
    });
    return out;
  }
  const ENR_DATA = {};
  Object.defineProperty(ENR_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  ENR_DATA.exampleCount = EXDEFS.length;
  ENR_DATA.exampleIds = EXDEFS.map(d => d.id);
  root.ENR_DATA = ENR_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.ENR_DATA.examples; }, tasks, register, ENR_TASKS, answerOf, clean, run, ENR_DATA };
})(typeof window !== 'undefined' ? window : globalThis);
