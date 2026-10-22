/* emvdata.js - EMV-Lab: Beispiele (EMV_DATA) und Aufgabenregister (EMV_TASKS), ohne Browser lauffaehig (WP4a).
 * Quelle: quelle/emvlab/wp4a/p1_util.js + p2_examples.js, zusammengesetzt mit `node quelle/emvlab/wp4a/build_emvdata.js` (nach Aenderungen neu bauen).
 *
 * window.EMV_DATA  = { examples: [ { id:'emx1'..'emx26', name, cat, rig, desc, controls, ref?, seq?, dur?, vals } ] }
 *   Alle Zahlen in `desc` kommen aus der Simulation (Pruefstaende) und dem Kern (EMV_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten
 *   Zugriff gerechnet (Getter); fehlen Kern oder Pruefstaende, ist die Liste leer (emvui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Pruefstands (Zustand NACHHER), ref = Steuerwerte des Zustands VORHER (nur die abweichenden Schluessel; die Seite legt sie ueber controls),
 *   seq im Format von EMV_CORE.runSeq (t in Sekunden: set | ramp | fire), dur in Sekunden.
 * window.EMV_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in emvtasks1.js (em1-em16) und emvtasks2.js (em17-em32) und melden sich mit EMV_TASKS.register([...]) an; die Reihenfolge der Registry ist immer
 *   em1, em2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'emN', lab:'emv', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), fields?, choices?, ask?, clicks?, hintVals(), consts? }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, clicks:[{x,y,hit,fall}] }
 *   start() und sol() liefern { rig, controls, seq?, dur?, ref?, value?, fields?, choices?, fired? } (die Seite uebernimmt controls/seq/ref, der Selbsttest value/fields/choices).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * EMV_TASKS.util (fuer emvtasks1.js und emvtasks2.js):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); snap(rigId, ctl, fire?) -> { ok, rig, m (readMeters), a (assess), d (diagnose), s (state), rejected, errors } (Pruefstand frisch, Seed 1,
 *   Steuerwerte in fester Reihenfolge, gecacht; fire = true loest die Entladung aus); mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId);
 *   numRow(r, val, opt) (Zahlenzeile mit Alternativen und Fehlerbildern); fieldNum(a, key); numAns(a); variants(v); lineAt(rig, n, view); bandMax(rig, f0, f1, view);
 *   exCheck(kind, seed, val) (Kernuebung pruefen); pctOf(rows).
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben. Die Pruefung rechnet immer neu aus den abgegebenen Steuerwerten und den festen Werten der Aufgabe
 *   (nur die freigegebenen Steuerwerte `own` zaehlen; alles andere setzt die Pruefung selbst), nie aus dem angezeigten Zustand.
 * EMV_TASKS.audit(task) und EMV_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) fuer Selbsttest und Tests.
 * Uebungsanlage: Alle Zahlen sind Uebungswerte, keine Vorhersage echter Geraete. Herstellerdokumentation und aktuelle Norm massgeblich. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.EMV_CORE) { nodeReq('./emvcore.js'); } if (root.EMV_CORE && !root.EMV_CORE.layout) nodeReq('./emvcore-lay.js'); return root.EMV_CORE || null; };
  const RIGFILES = ['./emvrig-quelle.js', './emvrig-filter.js', './emvrig-kopplung.js', './emvrig-schirm.js', './emvrig-antenne.js', './emvrig-layout.js', './emvrig-impuls.js', './emvrig-messen.js'];
  const RIGS = id => { let R = root.EMV_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { nodeReq('./emvrig-base.js'); RIGFILES.forEach(nodeReq); R = root.EMV_RIGS; } return R || null; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => {
    if (!fin(x)) return '–';
    const C = CORE();
    if (C && typeof C.fmt === 'function') return C.fmt(x, d == null ? 1 : d);
    return (+x).toFixed(d == null ? 1 : d).replace('.', ',').replace(/^-(?=\d)/, '−');
  };
  const toNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && typeof C.parseNum === 'function' ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };

  /* ====================================================================== Eingabe pruefen und aufbereiten */
  function flat(list, out) {
    (Array.isArray(list) ? list : []).forEach(c => {
      if (c && Array.isArray(c.controls)) flat(c.controls, out); else if (c && Array.isArray(c.items)) flat(c.items, out); else if (c && typeof c.key === 'string') out.push(c);
    });
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
  /* Ablauf-Zeilen { t, kind:'set'|'ramp'|'fire', key, value|to, dur } -> runSeq-Format */
  function rowsToSeq(rows) {
    const m = new Map(), ramps = [], fires = [];
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r)) return;
      const t = Math.max(0, toNum(r.t) || 0);
      if (r.kind === 'fire') { fires.push({ t, fire: true }); return; }
      if (typeof r.key !== 'string') return;
      if (r.kind === 'ramp') { ramps.push({ t, ramp: { key: r.key, to: toNum(r.to != null ? r.to : r.value), durS: toNum(r.dur) } }); return; }
      if (!m.has(t)) m.set(t, {});
      m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(ramps, fires).sort((a, b) => a.t - b.t);
  }
  /* -> { controls, seq, problems[] } ; wirft nie. own = Liste der Schluessel, die der Lernende waehlen darf (nur dort werden Probleme gemeldet) */
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
    if (isObj(a.controls)) Object.keys(a.controls).forEach(k => { if (k === 'fire') return; const x = one(k, a.controls[k], ''); if (x !== undefined) controls[k] = x; });
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
      if (e.fire) out.fire = true;
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
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);

  /* ====================================================================== Pruefstand: Momentaufnahme */
  /* erst Auswahlen, von denen andere Werte abhaengen (Fall, Prueffart, Stapel, Topologie ...), dann der Rest in der Reihenfolge der Bedienelemente */
  const FIRST = ['pruef', 'fall', 'stack', 'modus', 'topo', 'feld', 'mat', 'kabel', 'schutz', 'drossel'];
  const snapCache = new Map();
  function snap(rigId, ctl, fire) {
    ctl = isObj(ctl) ? ctl : {};
    const key = rigId + '|' + (fire ? 'F' : '-') + '|' + JSON.stringify(ctl);
    if (snapCache.has(key)) return snapCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId); if (!R || !R.defs || !R.defs[rigId]) throw new Error('Den Prüfstand „' + rigId + '“ gibt es nicht.');
      const rig = R.create(rigId, { seed: 1, noDraw: true });
      Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push({ key: k, value: ctl[k] });
      });
      if (fire && typeof rig.fire === 'function') rig.fire();
      out.rig = rig; out.m = clone(rig.readMeters()); out.a = clone(rig.assess()); out.d = clone(rig.diagnose()); out.s = clone(rig.state());
      out.ok = true;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message || e)); out.m = {}; out.a = null; out.d = []; out.s = {}; }
    if (snapCache.size > 500) snapCache.clear();
    snapCache.set(key, out);
    return out;
  }
  /* alle Steuerwerte eines Pruefstands in der Reihenfolge der Bedienelemente (Standardwerte des frischen Pruefstands), darueber over; Tasten (button) fehlen */
  function fullCtl(rigId, over) {
    const R = RIGS(rigId), defs = ctlDefs(rigId), out = {};
    if (!R || !defs) return Object.assign({}, over || {});
    let rig = null; try { rig = R.create(rigId, { seed: 1, noDraw: true }); } catch (e) { rig = null; }
    defs.forEach(c => { if (c.type === 'button') return; let v; try { v = rig ? rig.getControl(c.key) : undefined; } catch (e) { v = undefined; } out[c.key] = v !== undefined ? v : c.value; });
    return Object.assign(out, over || {});
  }
  /* Eingaben der Aufgabe: freigegebene Steuerwerte (own) ueber den festen Werten (fix) und den Standardwerten des Pruefstands */
  const effOf = (c, rigId, own, fix) => fullCtl(rigId, Object.assign({}, fix, initial(c, own)));
  const spectrumOf = (rig, view) => { try { return rig && typeof rig.spectrum === 'function' ? rig.spectrum(view ? { view } : undefined) : null; } catch (e) { return null; } };
  /* Linie der n-ten Oberwelle (Quelle): { f, L, Lcm, Ldm } oder null */
  function lineAt(rig, n, view) {
    const sp = spectrumOf(rig, view), fs = rig && rig.getControl ? +rig.getControl('fs') : NaN;
    if (!sp || !Array.isArray(sp.lines) || !(fs > 0)) return null;
    return sp.lines.find(l => Math.abs(l.f - n * fs) < 1e-3 * fs) || null;
  }
  /* hoechste Linie im Bereich [f0, f1] (Hz): { L, f } oder null */
  function bandMax(rig, f0, f1, view) {
    const sp = spectrumOf(rig, view); if (!sp || !Array.isArray(sp.lines)) return null;
    let best = null; sp.lines.forEach(l => { if (l.f >= f0 && l.f <= f1 && (!best || l.L > best.L)) best = { L: l.L, f: l.f }; });
    return best;
  }
  const cdef = (rigId, key) => (ctlDefs(rigId) || []).find(x => x.key === key) || null;
  const dlabel = (rigId, key) => { const d = cdef(rigId, key); return d && d.label ? d.label : key; };
  function olabel(rigId, key, v) {
    const d = cdef(rigId, key);
    if (d && Array.isArray(d.options)) { const o = d.options.find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    if (typeof v === 'number') {
      const C = CORE();
      if (d && ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'm', 's', 'W'].includes(d.unit) && C && typeof C.fmtEng === 'function') return C.fmtEng(v, d.unit);
      return fm(v, Math.abs(v) < 1 && v !== 0 ? 4 : 2) + (d && d.unit ? ' ' + d.unit : '');
    }
    return String(v);
  }
  /* Steuerwerte-Zeile: specs = [{ key, want, tol? (relativ, nur Zahlen) }]; ok, wenn alle stimmen; why nennt nur die abweichenden */
  function setRow(r, rigId, eff, specs, label) {
    const bad = [];
    specs.forEach(s => {
      const x = eff[s.key], d = cdef(rigId, s.key);
      if (typeof s.want === 'number') {
        const tol = s.tol != null ? s.tol : 0.02;
        if (!(fin(+x) && Math.abs(x - s.want) <= tol * Math.abs(s.want) + 1e-12)) bad.push('„' + dlabel(rigId, s.key) + '“ steht auf ' + olabel(rigId, s.key, x) + ', verlangt ist ' + olabel(rigId, s.key, s.want));
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
    if (sim && sim.rejected && sim.rejected.length) sim.rejected.forEach(x => errs.push('Der Prüfstand lehnt den Wert für „' + x.key + '“ ab.'));
    if (rigId && isObj(a) && typeof a.rig === 'string' && a.rig !== rigId) {
      const R = RIGS(), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
  }
  /* Zahlenzeile (Ablese- und Rechenaufgaben): val = Eingabe (Zahl oder null); opt = { label, refs:[{v}] (richtige Werte, der erste ist der Hauptwert),
   *   tol (relativ, Standard 0,02) oder absTol (absolut, in der Einheit der Zahl), unit, digits, wrong:[{v, msg}] (typische Fehlerbilder, jedes gerechnet) }.
   * Die Warum-Texte sagen nur, was verglichen wurde: Richtung (zu klein/zu gross) und passendes Fehlerbild, nie mehr. */
  function numRow(r, val, opt) {
    const pctTxt = q => fm(100 * q, Math.abs(100 * q - Math.round(100 * q)) < 1e-9 ? 0 : 1);
    const absMode = fin(opt.absTol), tol = fin(opt.tol) ? opt.tol : 0.02, dg = opt.digits == null ? 2 : opt.digits, u = opt.unit ? ' ' + opt.unit : '';
    const refs = opt.refs.filter(x => fin(x.v)), main = refs[0];
    const near = (a, b) => (absMode ? Math.abs(a - b) <= opt.absTol + 1e-9 : Math.abs(a - b) <= tol * Math.abs(b) + 1e-12);
    const tolTxt = absMode ? 'Toleranz ±' + fm(opt.absTol, 1) + u : 'Toleranz ' + pctTxt(tol) + ' %';
    const good = val !== null && refs.some(x => near(val, x.v));
    let why = 'Du hast keine Zahl eingetragen.';
    if (val !== null) {
      why = 'Dein Wert ' + fm(val, dg) + u + ' weicht um mehr als ' + (absMode ? fm(opt.absTol, 1) + u : pctTxt(tol) + ' %') + ' vom Rechenwert ab (' + fm(main.v, dg) + u + ').';
      const w = (opt.wrong || []).find(x => fin(x.v) && near(val, x.v));
      if (w) why = 'Dein Wert ' + fm(val, dg) + u + ' passt zu einem häufigen Fehler: ' + w.msg;
      else why += val < main.v ? ' Er ist zu klein.' : ' Er ist zu groß.';
    }
    r(good, opt.label + ' (' + tolTxt + ')', why);
    return good;
  }
  /* Kernuebung pruefen (EMV_CORE.exercise): liefert { ok, text } oder { ok:false, text:'Keine Zahl.' } */
  function exCheck(kind, seed, val) {
    const C = CORE(); let e = null; try { e = C.exercise(kind, seed); } catch (er) { e = null; }
    if (!e || e.ok === false || typeof e.check !== 'function') return { ok: false, text: 'Die Übung ist nicht verfügbar.', why: 'kern' };
    if (val === null || val === undefined || !fin(+val)) return { ok: false, text: 'Du hast keine Zahl eingetragen.', why: 'keineZahl' };
    let res = null; try { res = e.check(+val); } catch (er) { res = null; }
    return res && typeof res === 'object' ? res : { ok: false, text: 'Die Übung ist nicht prüfbar.', why: 'kern' };
  }
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 4; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^em(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const EMV_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, ctlDefs, coerce, clean, initial, snap, effOf, mk, inputRow, setRow, numRow, exCheck, variants, lineAt, bandMax, spectrumOf, fieldNum, numAns, choiceOf, pctOf, rowsToSeq, cdef, dlabel, olabel, CORE, RIGS, nodeReq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberflaeche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, ref: o.ref || null, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, fired: !!o.fired, value: fin(o.value) ? o.value : null, text: '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [] };
  }
  EMV_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel, einer Formelkonstante (task.consts) oder einem
   * Bauteil-/Optionsnamen des Pruefstands stammen; 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).match(/\d+(?:,\d+)?/g) || []);
  const FREI = ['0', '1', '2', '3', '100'];
  function partTokens() {
    const out = [], R = RIGS(); if (!R || !R.defs) return out;
    try { Object.keys(R.defs).forEach(id => flat(R.defs[id].controls, []).forEach(c => { [c.key, c.label].forEach(x => numTokens(x).forEach(y => out.push(y))); (c.options || []).forEach(o => [o.value, o.label].forEach(x => numTokens(x).forEach(y => out.push(y)))); })); } catch (e) { /* ohne Tabelle keine Namen */ }
    return out;
  }
  function allowedTokens(vals, extra, texts) {
    const set = new Set(FREI); partTokens().forEach(x => set.add(x));
    (function walk(o) { Object.keys(o || {}).forEach(k => { const v = o[k]; if (isObj(v) || Array.isArray(v)) walk(v); else variants(v).forEach(x => set.add(x)); }); })(vals);
    (extra || []).forEach(v => variants(v).forEach(x => set.add(x)));
    (texts || []).forEach(tx => numTokens(tx).forEach(x => set.add(x)));
    return set;
  }
  EMV_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  EMV_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.ref || {}, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.EMV_TASKS = EMV_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await EMV_TASKS.run(t, answerOf(t, t.start()))), L = await EMV_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (26) */
  /* Jedes Beispiel: spec() liefert das Szenario (ctl = Steuerwerte NACHHER, ref = abweichende Steuerwerte VORHER, seq, dur, fire), die Simulation rechnet es genau wie die
   * Oberflaeche (Steuerwerte, Pruefstaende, EMV_CORE), und text(X) formuliert die Beschreibung. X.a = Zustand nachher, X.b = Zustand vorher (oder null), X.S(over) = Zustand
   * mit abweichenden Steuerwerten, X.n(schluessel, wert, stellen) = Zahl im Text. Jede Zahl der Beschreibung laeuft ueber n(): Sie steht danach in `vals` und stammt aus Simulation,
   * Pruefstand oder Kern (Regel 1). Alles Uebungswerte (Uebungsanlage). */
  const m = (s, k) => (s && s.m ? s.m[k] : NaN);
  const g = (s, k) => (s && s.rig ? +s.rig.getControl(k) : NaN);               // Steuerwert aus dem Pruefstand (Text und Simulation haben dieselbe Quelle)
  const dom = s => (s && s.s && s.s.domText ? s.s.domText : '');
  const mm = x => 1000 * x;
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const ampName = s => (s && s.a ? AMP[s.a.ampel] || s.a.ampel : '');
  const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(Math.abs(a), Math.abs(b), 1e-12);
  const must = (c, why) => { if (!c) throw new Error('Behauptung im Text nicht belegt: ' + why); };
  /* Linien n = 1..nMax, die im Spektrum fehlen (Pegel am Boden) */
  function missingLines(rig, nMax) {
    const out = [], sp = spectrumOf(rig), fs = +rig.getControl('fs'); if (!sp) return out;
    for (let n = 1; n <= nMax; n++) { const l = sp.lines.find(x => Math.abs(x.f - n * fs) < 1e-3 * fs); if (!l || l.L <= sp.floor + 1) out.push(n); }
    return out;
  }
  const listDe = a => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]);
  const kitOf = () => root.EMV_RIGS.base.kit(CORE());
  const cfgFilter = c => ({ topo: c.topo, cx: c.cx, cy: c.cy, drossel: c.drossel, ld: c.ld, lead: c.lead, ferrit: !!c.ferrit, iLast: c.iLast });
  const ilAt = (s, f) => kitOf().il(cfgFilter(s.rig.getControls()), f);
  const bandOf = (s, view) => bandMax(s.rig, 25e6, 30e6, view);
  const partOf = id => kitOf().part(id);

  const EXDEFS = [
    /* ---------------------------------------------------------------- Kopplung */
    { id: 'emx1', name: 'Zwei Leitungen: Der Abstand wirkt', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ ctl: { s: 0.05, f: 1e6, ro: 1e4 }, ref: { s: 0.005 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), w0 = C.coupling.wires({ s: g(b, 's'), h: g(b, 'h'), len: g(b, 'len') }), w1 = C.coupling.wires({ s: g(a, 's'), h: g(a, 'h'), len: g(a, 'len') });
        must(m(a, 'uKap') < m(b, 'uKap') && m(a, 'uInd') < m(b, 'uInd'), 'beide Störspannungen sinken');
        return 'Zwei Leitungen laufen ' + n('len', g(a, 'len'), 0) + ' m lang im Abstand s über der Masse (Höhe h = ' + n('h', mm(g(a, 'h')), 0) + ' mm). Bei s = ' + n('s0', mm(g(b, 's')), 0) + ' mm koppeln sie mit Cm = ' + n('cm0', w0.CmTot * 1e12, 1) + ' pF und M = ' +
          n('m0', w0.MTot * 1e9, 0) + ' nH; am hochohmigen Eingang (ro = ' + n('ro', g(a, 'ro') / 1000, 0) + ' kΩ, f = ' + n('f', g(a, 'f') / 1e6, 0) + ' MHz) entstehen uKap = ' + n('uk0', m(b, 'uKap'), 0) + ' mV und uInd = ' + n('ui0', m(b, 'uInd'), 0) + ' mV. Bei s = ' +
          n('s1', mm(g(a, 's')), 0) + ' mm sinken Cm auf ' + n('cm1', w1.CmTot * 1e12, 2) + ' pF und M auf ' + n('m1', w1.MTot * 1e9, 0) + ' nH, die Störspannungen auf uKap = ' + n('uk1', m(a, 'uKap'), 0) + ' mV und uInd = ' + n('ui1', m(a, 'uInd'), 0) +
          ' mV. Mehr Abstand verkleinert beide Kopplungen; das ist die Maßnahme „Kopplung verringern“. Schiebe s im Prüfstand selbst hin und her und beobachte die Wirkungskette. Übungsanlage: Die Zahlen gelten nur für diese Anordnung.';
      } },
    { id: 'emx2', name: 'Hochohmig oder niederohmig?', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ ctl: { f: 1e5, ro: 1e5 }, ref: { ro: 50 } }),
      text(X) {
        const { a, b, n } = X;
        must(dom(b) === 'induktiv' && dom(a) === 'kapazitiv', 'dominierende Kopplung vorher induktiv, nachher kapazitiv');
        return 'Dieselbe Leitungsanordnung stört bei f = ' + n('f', g(a, 'f') / 1000, 0) + ' kHz unterschiedlich, je nachdem, wie hochohmig die Störsenke ist. Mit ro = ' + n('ro0', g(b, 'ro'), 0) + ' Ω (niederohmig) entstehen uKap = ' + n('uk0', m(b, 'uKap'), 2) + ' mV und uInd = ' + n('ui0', m(b, 'uInd'), 1) +
          ' mV: Es dominiert die ' + dom(b) + 'e Kopplung. Mit ro = ' + n('ro1', g(a, 'ro') / 1000, 0) + ' kΩ (hochohmig) sind es uKap = ' + n('uk1', m(a, 'uKap'), 0) + ' mV und uInd = ' + n('ui1', m(a, 'uInd'), 1) + ' mV: Jetzt dominiert die ' + dom(a) +
          'e Kopplung. Ein hochohmiger Eingang bildet mit der Koppelkapazität einen Spannungsteiler und sammelt elektrisches Feld auf; ein niederohmiger Eingang wird vom Magnetfeld der Schleife getrieben. Wähle die Maßnahme nach der dominierenden Kopplung.';
      } },
    { id: 'emx3', name: 'Verdrillt gegen parallel', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ ctl: { f: 1e5, ro: 50, s: 0.005, twist: 50 }, ref: { twist: 0 } }),
      text(X) {
        const { a, b, n } = X, C = CORE();
        must(near(m(a, 'uKap'), m(b, 'uKap'), 1e-9), 'uKap ändert sich durch die Verdrillung nicht'); must(dom(b) === 'induktiv', 'induktive Kopplung dominiert vorher');
        return 'Die Leitungen liegen im Abstand ' + n('s', mm(g(a, 's')), 0) + ' mm, die Senke ist niederohmig (ro = ' + n('ro', g(a, 'ro'), 0) + ' Ω), f = ' + n('f', g(a, 'f') / 1000, 0) + ' kHz: Es dominiert die induktive Kopplung. Parallel geführt (Verdrillung ' + n('t0', g(b, 'twist'), 0) + ' je m) entsteht uInd = ' + n('ui0', m(b, 'uInd'), 1) +
          ' mV. Mit ' + n('t1', g(a, 'twist'), 0) + ' Verdrillungen je Meter (N = ' + n('nn', g(a, 'twist') * g(a, 'len'), 0) + ' bei ' + n('len', g(a, 'len'), 0) + ' m Länge) bleibt nach dem Modell der Faktor ' + n('tf', C.coupling.twist(g(a, 'twist') * g(a, 'len')), 3) + ' übrig, also uInd = ' + n('ui1', m(a, 'uInd'), 2) +
          ' mV. Beim Verdrillen heben sich die Spannungen benachbarter Schleifen auf; gegen die kapazitive Kopplung hilft es nicht (uKap bleibt ' + n('uk', m(a, 'uKap'), 2) + ' mV). Das Modell begrenzt den Faktor nach unten auf ' + n('fmin', C.coupling.twist(1e9), 2) + ' (Übungswert).';
      } },
    { id: 'emx4', name: 'Schirm einseitig oder beidseitig', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ ctl: { schirm: 'beide', ro: 50, f: 1e3 }, ref: { schirm: 'kein' }, seq: [{ t: 0, ramp: { key: 'f', to: 1e6, durS: 20 } }], dur: 20 }),
      text(X) {
        const { S, n } = X, C = CORE(), a0 = S({ f: 1e3, schirm: 'kein' }), a1 = S({ f: 1e3, schirm: 'beide' }), b0 = S({ f: 1e6, schirm: 'kein' }), b1 = S({ f: 1e6, schirm: 'beide' }), e0 = S({ f: 1e6, ro: 1e4, schirm: 'kein' }), e1 = S({ f: 1e6, ro: 1e4, schirm: 'eine' });
        must(near(m(a0, 'uInd'), m(a1, 'uInd'), 0.3) && m(b1, 'uInd') < 0.05 * m(b0, 'uInd'), 'Schirm wirkt erst oberhalb von fc auf uInd');
        must(m(e1, 'uKap') < 0.05 * m(e0, 'uKap'), 'einseitiger Schirm senkt uKap');
        return 'Ein Schirm schützt gegen das Magnetfeld erst oberhalb seiner Knickfrequenz fc = ' + n('fc', C.coupling.fc / 1000, 2) + ' kHz (Übungswerte des Schirms). Bei f = ' + n('f0', 1, 0) + ' kHz ändert der beidseitig angeschlossene Schirm die induktive Störung kaum: uInd = ' + n('i0', m(a0, 'uInd'), 2) + ' mV ohne und ' + n('i1', m(a1, 'uInd'), 2) +
          ' mV mit Schirm. Bei f = ' + n('f1', 1, 0) + ' MHz sinkt uInd von ' + n('j0', m(b0, 'uInd'), 1) + ' mV auf ' + n('j1', m(b1, 'uInd'), 2) + ' mV. Gegen die kapazitive Kopplung genügt schon ein einseitig angeschlossener Schirm: Am hochohmigen Eingang (ro = ' + n('ro', g(e0, 'ro') / 1000, 0) + ' kΩ) fällt uKap bei ' + n('f2', 1, 0) + ' MHz von ' + n('k0', m(e0, 'uKap'), 0) + ' mV auf ' + n('k1', m(e1, 'uKap'), 1) +
          ' mV. Im Ablauf läuft f von ' + n('fa', g(X.a, 'f') / 1000, 0) + ' kHz bis ' + n('fb', 1, 0) + ' MHz.';
      } },
    { id: 'emx5', name: 'Brummen durch Masseschleife', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ preset: 'audio', ctl: { loop: false }, ref: { loop: true } }),
      text(X) {
        const { a, b, S, n } = X, c = S({ loop: true, sym: 'sym' });
        must(dom(b) === 'Brummen' && dom(a) === 'kapazitiv' && m(a, 'snr') < g(a, 'snrReq'), 'Brummen dominiert vorher, danach kapazitiv, Vorgabe noch nicht erreicht');
        return 'Ein Audiokabel von ' + n('len', g(a, 'len'), 0) + ' m Länge ist an beiden Enden geerdet: Die Masseschleife fängt die Potenzialdifferenz zwischen den Erdungspunkten ein (dUg = ' + n('dug', g(a, 'dUg'), 1) + ' V, Netzfrequenz ' + n('f', g(a, 'f'), 0) + ' Hz). Mit geschlossener Schleife entsteht die Brummspannung uBrumm = ' + n('ub0', m(b, 'uBrumm'), 1) +
          ' mV, größer als das Nutzsignal von ' + n('un', g(a, 'uNutz') * 1000, 0) + ' mV; der Störabstand ist ' + n('s0', m(b, 'snr'), 1) + ' dB. Ohne Masseschleife verschwindet uBrumm (' + n('ub1', m(a, 'uBrumm'), 1) + ' mV), der Störabstand steigt auf ' + n('s1', m(a, 'snr'), 1) + ' dB. Die Vorgabe der Voreinstellung (' + n('req', g(a, 'snrReq'), 0) +
          ' dB) ist damit noch nicht erreicht, denn nun dominiert die kapazitive Kopplung (uKap = ' + n('uk', m(a, 'uKap'), 2) + ' mV). Eine symmetrische Übertragung lässt die Schleife bestehen, drückt aber das Brummen auf uBrumm = ' + n('ub2', m(c, 'uBrumm'), 2) + ' mV. Merke: erst die Schleife auftrennen, dann nachmessen.';
      } },
    { id: 'emx6', name: 'Sensorleitung: Strom oder Spannung', cat: 'Kopplung', rig: 'kopplung',
      spec: () => ({ preset: 'sensor', ctl: {}, ref: { ro: 1e5 } }),
      text(X) {
        const { a, b, n } = X;
        must(near(m(a, 'uInd'), m(b, 'uInd'), 1e-9) && m(a, 'uKap') < m(b, 'uKap'), 'uInd unabhängig von ro, uKap sinkt');
        return 'Ein Sensor liefert sein Signal ' + n('len', g(a, 'len'), 0) + ' m weit neben einer Leistungsleitung (f = ' + n('f', g(a, 'f') / 1000, 0) + ' kHz). Mit einem hochohmigen Spannungseingang (ro = ' + n('ro1', g(b, 'ro') / 1000, 0) + ' kΩ) entstehen uKap = ' + n('uk1', m(b, 'uKap'), 0) + ' mV und uInd = ' + n('ui1', m(b, 'uInd'), 1) + ' mV, der Störabstand ist ' + n('s1', m(b, 'snr'), 1) +
          ' dB. Mit einer niederohmigen Stromschleife (ro = ' + n('ro0', g(a, 'ro'), 0) + ' Ω) sinkt uKap auf ' + n('uk0', m(a, 'uKap'), 1) + ' mV, uInd bleibt bei ' + n('ui0', m(a, 'uInd'), 1) + ' mV, der Störabstand steigt auf ' + n('s0', m(a, 'snr'), 1) + ' dB. Die niederohmige Senke härtet gegen elektrische Felder (Maßnahme „Senke härten“); gegen die induktive Kopplung hilft sie nicht.';
      } },
    /* ---------------------------------------------------------------- Spektrum */
    { id: 'emx7', name: 'Das Rechteck und seine Oberwellen', cat: 'Spektrum', rig: 'quelle',
      spec: () => ({ ctl: { rg: 1, isw: 0.05, duty: 20 }, ref: { duty: 50 } }),
      text(X) {
        const { a, b, n } = X, fs = g(a, 'fs'), mb = missingLines(b.rig, 10), ma = missingLines(a.rig, 10), l1 = lineAt(b.rig, 1), l3 = lineAt(b.rig, 3), s = CORE().spec;
        must(mb.join() === '2,4,6,8,10' && ma.join() === '5,10', 'fehlende Linien bis n = 10');
        return 'Die Quelle schaltet mit fs = ' + n('fs', fs / 1000, 0) + ' kHz ein Rechteck (u = ' + n('u', g(a, 'u'), 0) + ' V). Bei D = ' + n('d0', g(b, 'duty'), 0) + ' % fehlen die Oberwellen n = ' + listDe(mb.map(String)) + ' (und alle weiteren geraden): Die Linien liegen nur bei ungeraden Vielfachen von fs. Die Grundwelle erreicht ' + n('l1', l1.L, 1) +
          ' dBµV, die dritte Oberwelle ' + n('l3', l3.L, 1) + ' dBµV. Bei D = ' + n('d1', g(a, 'duty'), 0) + ' % fehlen bis n = ' + n('nm', 10, 0) + ' nur ' + listDe(ma.map(String)) + '; alle anderen Linien sind da. Die Einhüllende fällt ab f1 = ' + n('f1a', m(b, 'f1') * 1000, 0) + ' kHz (D = ' + n('d2', g(b, 'duty'), 0) + ' %) beziehungsweise f1 = ' + n('f1b', m(a, 'f1') * 1000, 0) +
          ' kHz (D = ' + n('d3', g(a, 'duty'), 0) + ' %) um ' + n('s1', 20, 0) + ' dB je Dekade und ab f2 = ' + n('f2', m(a, 'f2'), 0) + ' MHz um ' + n('s2', 40, 0) + ' dB je Dekade (Flanke tr = ' + n('tr', m(a, 'tr'), 0) + ' ns). Die Pegel gelten am Messeingang der Netznachbildung, es sind Spitzenwerte.';
      } },
    { id: 'emx8', name: 'Flanke langsamer: Rg 10 → 100 Ω', cat: 'Spektrum', rig: 'quelle',
      spec: () => ({ ctl: { rg: 100 }, ref: { rg: 10 } }),
      text(X) {
        const { a, b, n } = X, ba = bandOf(a), bb = bandOf(b);
        must(Math.abs(m(a, 'lMax') - m(b, 'lMax')) < 0.5, 'höchster Pegel ändert sich kaum');
        return 'Mit Rg = ' + n('r0', g(b, 'rg'), 0) + ' Ω schaltet die Flanke in tr = ' + n('tr0', m(b, 'tr'), 1) + ' ns, f2 liegt bei ' + n('f20', m(b, 'f2'), 1) + ' MHz; die höchste Linie zwischen ' + n('fa', 25, 0) + ' und ' + n('fb', 30, 0) + ' MHz erreicht ' + n('l0', bb.L, 1) + ' dBµV, der Schaltverlust ist ' + n('p0', m(b, 'pSw'), 2) +
          ' W. Mit Rg = ' + n('r1', g(a, 'rg'), 0) + ' Ω dauert die Flanke tr = ' + n('tr1', m(a, 'tr'), 1) + ' ns, f2 sinkt auf ' + n('f21', m(a, 'f2'), 2) + ' MHz und die höchste Linie in diesem Bereich auf ' + n('l1', ba.L, 1) + ' dBµV; der Schaltverlust steigt aber auf ' + n('p1', m(a, 'pSw'), 2) +
          ' W. Die langsamere Flanke nimmt die hohen Oberwellen weg, kostet aber Schaltverlust: Nichts davon ist kostenlos. Der höchste Pegel überhaupt liegt bei den niedrigen Oberwellen und bleibt bei ' + n('lm', m(a, 'lMax'), 1) + ' dBµV.';
      } },
    { id: 'emx9', name: 'Ringing und Snubber', cat: 'Spektrum', rig: 'quelle',
      spec: () => ({ ctl: { snub: 'ein' }, ref: { snub: 'aus' } }),
      text(X) {
        const { a, b, n } = X;
        must(near(m(a, 'pSw'), m(b, 'pSw'), 1e-9) && m(a, 'ringBump') < m(b, 'ringBump'), 'Schaltverlust gleich, Buckel sinkt');
        return 'Die Streuinduktivität und die Ausgangskapazität des Schalters bilden einen Schwingkreis: Nach der Flanke klingt eine Schwingung bei fr = ' + n('fr', m(b, 'fr'), 1) + ' MHz ab (Dämpfung ζ = ' + n('z0', m(b, 'zeta'), 3) + '). Im Spektrum hebt sie die Linien um den Ring-Buckel von ' + n('b0', m(b, 'ringBump'), 1) +
          ' dB an. Ein Snubber mit Rs = ' + n('rs', g(a, 'rsn'), 0) + ' Ω und Cs = ' + n('cs', g(a, 'csn') * 1e12, 0) + ' pF dämpft den Kreis (ζ = ' + n('z1', m(a, 'zeta'), 2) + ') und senkt den Buckel auf ' + n('b1', m(a, 'ringBump'), 2) + ' dB. Er verbraucht aber Leistung: ' + n('ps', m(a, 'pSn'), 2) +
          ' W im Snubber (ohne ' + n('ps0', m(b, 'pSn'), 0) + ' W). Dämpfe nur so viel wie nötig; der Schaltverlust des Schalters bleibt gleich (' + n('pw', m(a, 'pSw'), 2) + ' W).';
      } },
    { id: 'emx10', name: 'Frequenzjitter verteilt die Spitzen', cat: 'Spektrum', rig: 'quelle',
      spec: () => ({ ctl: { jitter: 6 }, ref: { jitter: 0 } }),
      text(X) {
        const { a, b, n } = X, ba = bandOf(a), bb = bandOf(b);
        must(ba.L < bb.L && m(a, 'lMax') < m(b, 'lMax'), 'Jitter senkt die Anzeige');
        return 'Ein Jitter der Schaltfrequenz verteilt die Energie jeder Oberwelle auf einen breiteren Frequenzbereich; je höher die Ordnung, desto größer ist die Verschiebung der Linie. Ohne Jitter liegt der höchste Pegel bei ' + n('l0', m(b, 'lMax'), 1) + ' dBµV und die höchste Linie zwischen ' + n('fa', 25, 0) + ' und ' + n('fb', 30, 0) + ' MHz bei ' + n('h0', bb.L, 1) +
          ' dBµV. Mit ' + n('j', g(a, 'jitter'), 0) + ' % Jitter sind es ' + n('l1', m(a, 'lMax'), 1) + ' dBµV beziehungsweise ' + n('h1', ba.L, 1) + ' dBµV (Messbandbreite des Analysators nach Übungsmodell). Der Jitter verteilt die Energie nur auf mehr Messbandbreite; er ersetzt keine Filterung, senkt aber die Anzeige am Analysator. Die Marge zur Mittelwert-Linie ändert sich von ' + n('m0', m(b, 'margin'), 1) + ' dB auf ' + n('m1', m(a, 'margin'), 1) + ' dB.';
      } },
    /* ---------------------------------------------------------------- Filter */
    { id: 'emx11', name: 'Netzfilter: X und Y', cat: 'Filter', rig: 'filter',
      spec: () => ({ ctl: { topo: 'pi', drossel: 'd10' }, ref: { topo: 'kein', drossel: 'ohne' },
        seq: [{ t: 0, set: { topo: 'kein', drossel: 'ohne' } }, { t: 6, set: { topo: 'C' } }, { t: 12, set: { topo: 'pi', drossel: 'd10' } }], dur: 18 }),
      text(X) {
        const { a, S, n } = X, k = S({ topo: 'kein', drossel: 'ohne' }), c = S({ topo: 'C', drossel: 'ohne' }), p = a, zc = 1 / (2 * Math.PI * 1e6 * g(a, 'cy'));
        must(m(c, 'ilGG1M') > 20 && m(c, 'ilGT1M') < 3 && m(p, 'ilGT1M') > 30, 'einfaches Filter dämpft nur den Gegentakt');
        return 'Der Ablauf zeigt drei Zustände: ohne Filter (Marge zur Mittelwert-Linie ' + n('m0', m(k, 'margin'), 1) + ' dB), mit einfachem Filter aus den Kondensatoren Cx und Cy (Marge ' + n('m1', m(c, 'margin'), 1) + ' dB) und mit π-Filter aus Cx = ' + n('cx', g(a, 'cx') * 1e9, 0) + ' nF, Cy = ' + n('cy', g(a, 'cy') * 1e9, 1) + ' nF und einer Drossel von ' + n('ld', partOf(a.rig.getControl('drossel')).L * 1000, 0) + ' mH (Marge ' + n('m2', m(p, 'margin'), 1) +
          ' dB). Der X-Kondensator liegt zwischen den Netzleitern und dämpft den Gegentakt: Das einfache Filter schafft bei 1 MHz ' + n('gg0', m(c, 'ilGG1M'), 1) + ' dB. Den Gleichtakt dämpft es nur mit ' + n('gt0', m(c, 'ilGT1M'), 1) + ' dB: Der Y-Kondensator hat bei 1 MHz ' + n('zc', zc, 0) + ' Ω und teilt gegen die Quelle kaum herunter. Erst die Drossel davor macht den Teiler wirksam: ' + n('gt1', m(p, 'ilGT1M'), 1) + ' dB bei 1 MHz (Gegentakt ' + n('gg1', m(p, 'ilGG1M'), 1) +
          ' dB). Dafür fließt über den Y-Kondensator ein Ableitstrom von ' + n('lk', m(p, 'leak'), 3) + ' mA (Vorgabe der Übung ' + n('lr', g(a, 'leakReq'), 1) + ' mA). Die Ampel des π-Filters zeigt ' + ampName(p) + ': Es reicht noch nicht für die Mittelwert-Linie.';
      } },
    { id: 'emx12', name: 'Große Drossel, kleine Wirkung', cat: 'Filter', rig: 'filter',
      spec: () => ({ ctl: { drossel: 'd22', iLast: 0.1 }, ref: { drossel: 'd3' } }),
      text(X) {
        const { a, b, n } = X, f = 10e6, ia = ilAt(a, f), ib = ilAt(b, f);
        must(ia.gt < ib.gt && m(a, 'fresD') < f / 1e3 && m(b, 'fresD') < f / 1e3, 'beide Drosseln über ihrer Eigenresonanz, die große dämpft weniger');
        return 'Eine größere Induktivität dämpft nicht immer mehr. Die Drossel ' + n('l0', partOf('d3').L * 1000, 1) + ' mH (d3) hat eine Eigenresonanz bei ' + n('r0', m(b, 'fresD'), 0) + ' kHz und dämpft den Gleichtakt bei ' + n('f', f / 1e6, 0) + ' MHz um ' + n('g0', ib.gt, 1) + ' dB. Die Drossel ' + n('l1', partOf('d22').L * 1000, 0) + ' mH (d22) schwingt schon bei ' + n('r1', m(a, 'fresD'), 0) +
          ' kHz in Eigenresonanz und dämpft bei derselben Frequenz nur ' + n('g1', ia.gt, 1) + ' dB. Oberhalb der Eigenresonanz wirkt die Windungskapazität: Die Drossel verhält sich wie ein Kondensator. Der Laststrom ist hier auf ' + n('il', g(a, 'iLast'), 1) + ' A gesenkt, damit die Sättigung keine Rolle spielt (Induktivität noch ' + n('sa', m(a, 'satur'), 1) + ' % des Nennwerts). Wähle die Drossel nach der Frequenz, die du dämpfen willst.';
      } },
    { id: 'emx13', name: 'Der Kondensator wird zur Spule', cat: 'Filter', rig: 'filter',
      spec: () => ({ ctl: { topo: 'C', drossel: 'ohne', lead: 0.03 }, ref: { lead: 0.005 } }),
      text(X) {
        const { a, b, n } = X, K = kitOf(), f = 30e6, ia = ilAt(a, f), ib = ilAt(b, f);
        must(m(a, 'fresX') < f / 1e6 && m(b, 'fresX') < f / 1e6 && ia.gg < ib.gg, 'beide über der Eigenresonanz, längerer Anschluss dämpft weniger');
        return 'Jeder Kondensator hat eine Anschlussinduktivität (ESL): Das Modell rechnet ' + n('e0', K.eslOf('cx', 0) * 1e9, 0) + ' nH Grundwert plus ' + n('e1', (K.eslOf('cx', 0.001) - K.eslOf('cx', 0)) * 1e9, 0) + ' nH je Millimeter Anschlusslänge. Bei ' + n('l0', mm(g(b, 'lead')), 0) + ' mm Anschluss sind das ' + n('esl0', K.eslOf('cx', g(b, 'lead')) * 1e9, 0) + ' nH, der X-Kondensator (' + n('cx', g(a, 'cx') * 1e9, 0) + ' nF) schwingt bei ' + n('r0', m(b, 'fresX'), 2) +
          ' MHz in Eigenresonanz; bei ' + n('l1', mm(g(a, 'lead')), 0) + ' mm sind es ' + n('esl1', K.eslOf('cx', g(a, 'lead')) * 1e9, 0) + ' nH und ' + n('r1', m(a, 'fresX'), 2) + ' MHz. Oberhalb der Eigenresonanz wirkt er wie eine Spule: Die Gegentakt-Dämpfung des einfachen Filters bei ' + n('f', f / 1e6, 0) + ' MHz fällt von ' + n('g0', ib.gg, 1) + ' dB auf ' + n('g1', ia.gg, 1) + ' dB. Kurze Anschlüsse sind die billigste Maßnahme.';
      } },
    { id: 'emx14', name: 'Drossel gesättigt', cat: 'Filter', rig: 'filter',
      spec: () => ({ ctl: { drossel: 'd10', iLast: 6 }, ref: { iLast: 1 } }),
      text(X) {
        const { a, b, n } = X, p = partOf('d10'), f = 150e3, ia = ilAt(a, f), ib = ilAt(b, f);
        must(ia.gt < ib.gt && m(a, 'satur') < m(b, 'satur') && m(a, 'lMax') > m(b, 'lMax'), 'gesättigte Drossel dämpft bei 150 kHz weniger, Pegel steigt');
        return 'Die Drossel ' + n('l', p.L * 1000, 0) + ' mH (d10) ist für ' + n('in', p.In, 0) + ' A Nennstrom ausgelegt; im Modell halbiert sich ihre Induktivität bei Isat = ' + n('is', p.Isat, 0) + ' A (L fällt wie 1/(1 + (I/Isat)²)). Bei ' + n('i0', g(b, 'iLast'), 0) + ' A Laststrom hat sie noch ' + n('s0', m(b, 'satur'), 1) + ' % ihrer Induktivität, bei ' + n('i1', g(a, 'iLast'), 0) + ' A nur noch ' + n('s1', m(a, 'satur'), 1) +
          ' %. Die Gleichtakt-Dämpfung bei ' + n('f', f / 1000, 0) + ' kHz sinkt von ' + n('g0', ib.gt, 1) + ' dB auf ' + n('g1', ia.gt, 1) + ' dB, der höchste Pegel am Messeingang der Netznachbildung steigt von ' + n('p0', m(b, 'lMax'), 1) + ' dBµV auf ' + n('p1', m(a, 'lMax'), 1) + ' dBµV. Wähle die Drossel nach dem Laststrom; die Sättigung ist ein Übungsmodell.';
      } },
    /* ---------------------------------------------------------------- Schirmung */
    { id: 'emx15', name: 'Schlitz so lang wie die halbe Wellenlänge', cat: 'Schirmung', rig: 'schirm',
      spec: () => ({ ctl: { slot: 0.15, f: 1e9 }, ref: { slot: 0.01 } }),
      text(X) {
        const { a, b, n } = X;
        must(m(a, 'seSlot') <= 0.01 && m(a, 'fSlot') < g(a, 'f') / 1e6 && m(a, 'seMat') > 100, 'Schlitz lässt bei f oberhalb fSlot alles durch');
        return 'Ein Schlitz im Gehäuse strahlt wie eine Antenne, sobald er mindestens eine halbe Wellenlänge lang ist. Bei f = ' + n('f', g(a, 'f') / 1e6, 0) + ' MHz beträgt die Schirmdämpfung des Schlitzes mit ' + n('l0', mm(g(b, 'slot')), 0) + ' mm Länge ' + n('s0', m(b, 'seSlot'), 1) + ' dB; seine kritische Frequenz liegt bei ' + n('k0', m(b, 'fSlot') / 1000, 1) + ' GHz. Mit ' + n('l1', mm(g(a, 'slot')), 0) +
          ' mm Länge liegt die kritische Frequenz bei ' + n('k1', m(a, 'fSlot'), 0) + ' MHz, und bei f = ' + n('f2', g(a, 'f') / 1e6, 0) + ' MHz ist die Schirmdämpfung des Schlitzes ' + n('s1', Math.max(0, m(a, 'seSlot')), 1) + ' dB: Der Schlitz lässt alles durch, die Schirmdämpfung des ganzen Gehäuses sinkt auf ' + n('g1', Math.max(0, m(a, 'seGes')), 1) + ' dB, obwohl das Blech selbst sehr gut schirmt. Das Modell nutzt die Faustformel für Schlitze (Übungswert); kürze lange Schlitze oder teile sie mit Kontakten.';
      } },
    { id: 'emx16', name: 'Magnetfeld bei 10 kHz: Aluminium oder Stahl', cat: 'Schirmung', rig: 'schirm',
      spec: () => ({ ctl: { mat: 'stahl', feld: 'hnah', f: 1e4, t: 0.001 }, ref: { mat: 'alu' } }),
      text(X) {
        const { a, b, S, n } = X, k = S({ mat: 'kupfer' });
        must(m(a, 'seGes') > m(b, 'seGes') && m(a, 'seA') > m(a, 'seR'), 'Stahl schirmt mehr, überwiegend durch Absorption');
        return 'Ein magnetisches Nahfeld bei f = ' + n('f', g(a, 'f') / 1000, 0) + ' kHz schirmt Aluminium mit ' + n('t', mm(g(a, 't')), 0) + ' mm Dicke nur mit ' + n('s0', m(b, 'seGes'), 1) + ' dB; die Hauttiefe beträgt ' + n('d0', m(b, 'delta'), 0) + ' µm und ist damit nicht viel kleiner als das Blech. Kupfer mit derselben Dicke kommt auf ' + n('sk', m(k, 'seGes'), 1) +
          ' dB. Stahl hat im Modell eine konstante Permeabilitätszahl von ' + n('mur', CORE().shield.materials.stahl.mur, 0) + ' (Übungswert, bei echtem Stahl hängt sie von Legierung und Frequenz ab) und damit nur δ = ' + n('d1', m(a, 'delta'), 0) + ' µm: Er schirmt ' + n('s1', m(a, 'seGes'), 1) + ' dB, überwiegend durch Absorption (' + n('sa', m(a, 'seA'), 1) + ' dB). Niederfrequente Magnetfelder brauchen im Modell vor allem Absorption, und die liefert eine große Permeabilität.';
      } },
    { id: 'emx17', name: 'Schirmanbindung: Pigtail oder 360°', cat: 'Schirmung', rig: 'schirm',
      spec: () => ({ ctl: { kabel: '360', lp: 0.05, f: 1e8 }, ref: { kabel: 'pigtail' } }),
      text(X) {
        const { a, b, n } = X;
        must(a.s.zt < b.s.zt && m(a, 'uIn') < m(b, 'uIn'), 'die 360°-Anbindung ist besser');
        return 'Ein Kabelschirm schützt nur so gut, wie er angeschlossen ist. Mit Pigtail (Schirmlitze von ' + n('lp', mm(g(b, 'lp')), 0) + ' mm Länge) hat die Anbindung bei f = ' + n('f', g(a, 'f') / 1e6, 0) + ' MHz die Kopplungsimpedanz ' + n('z0', b.s.zt, 1) + ' Ω, und innen liegen ' + n('u0', m(b, 'uIn'), 1) + ' dBµV. Mit einer 360°-Anbindung sinkt sie auf ' + n('z1', a.s.zt, 2) + ' Ω und die Störspannung innen auf ' + n('u1', m(a, 'uIn'), 1) +
          ' dBµV, also um ' + n('du', m(b, 'uIn') - m(a, 'uIn'), 1) + ' dB. Im Modell wirkt die Litze als Induktivität (' + n('lit', 1, 0) + ' nH je Millimeter, Übungswert) und bestimmt die Kopplungsimpedanz bei hohen Frequenzen. Schließe den Schirm rundum und kurz an das Gehäuse an.';
      } },
    /* ---------------------------------------------------------------- Abstrahlung */
    { id: 'emx25', name: 'Das Kabel als Viertelwellen-Antenne', cat: 'Abstrahlung', rig: 'abstrahlung',
      spec: () => ({ ctl: { len: 1.5, fclk: 5e7, ferrit: 'x2' }, ref: { ferrit: 'kein' } }),
      text(X) {
        const { a, b, n } = X, C = CORE();
        must(near(m(b, 'fRes'), C.antenna.resonance(g(b, 'len'), 1) / 1e6, 1e-6) && m(a, 'eMax') < m(b, 'eMax'), 'Resonanz aus dem Kern, Ferrit senkt die Feldstärke');
        return 'Ein ' + n('len', g(a, 'len'), 1) + ' m langes Kabel ist bei ' + n('fr', m(b, 'fRes'), 2) + ' MHz eine Viertelwellenlänge lang (Verkürzung durch die Isolierung ist im Modell nicht berücksichtigt). Der Takt von ' + n('fc', g(a, 'fclk') / 1e6, 0) + ' MHz trifft diese Resonanz: Das Kabel strahlt mit ' + n('e0', m(b, 'eMax'), 1) + ' dBµV/m bei ' + n('fm', m(b, 'fMax'), 0) + ' MHz, die Marge zur Übungsgrenzlinie ist ' + n('g0', m(b, 'margin'), 1) +
          ' dB. Ein Ferrit auf dem Kabel („' + olabel('abstrahlung', 'ferrit', a.rig.getControl('ferrit')) + '“) verringert den Gleichtaktstrom am Kabelfuß von ' + n('i0', m(b, 'iCm'), 1) + ' µA auf ' + n('i1', m(a, 'iCm'), 1) + ' µA; die Feldstärke sinkt auf ' + n('e1', m(a, 'eMax'), 1) + ' dBµV/m, die Marge steigt auf ' + n('g1', m(a, 'margin'), 1) + ' dB. Die Übungsgrenzlinie ist ein Lehrwert; Herstellerdokumentation und aktuelle Norm maßgeblich.';
      } },
    /* ---------------------------------------------------------------- Layout */
    { id: 'emx18', name: 'Rückstrom und Schlitz', cat: 'Layout', rig: 'layout',
      spec: () => ({ preset: 'schlitz', ctl: { fall: 'schlitz', f: 1e4 }, seq: [{ t: 0, ramp: { key: 'f', to: 1e8, durS: 20 } }], dur: 20 }),
      text(X) {
        const { S, n } = X, lo = S({ f: 1e4 }), hi = S({ f: 1e8 });
        must(hi.d.some(x => x.id === 'rueck-umweg') && m(lo, 'hf') < 20 && m(hi, 'hf') > 95, 'Umweg-Meldung, Rückstromanteil unter dem Hinleiter wächst mit f');
        return 'Der Rückstrom wählt den Weg der kleinsten Impedanz, nicht den kürzesten. Unterhalb der Übergangsfrequenz ft = ' + n('ft', m(hi, 'ft'), 1) + ' kHz überwiegt der Widerstand: Bei f = ' + n('f0', 10, 0) + ' kHz fließen nur ' + n('h0', m(lo, 'hf'), 1) + ' % des Rückstroms unter dem Hinleiter, der Rest verteilt sich breiter über die Massefläche. Oberhalb von ft überwiegt die Induktivität: Bei f = ' +
          n('f1', 100, 0) + ' MHz sind es ' + n('h1', m(hi, 'hf'), 1) + ' %. Der Schlitz zwingt den Rückstrom dann zum Umweg (Meldung des Prüfstands); die Schleifenfläche beträgt ' + n('a', m(hi, 'area'), 0) + ' mm², die Abstrahlung bei 3 m ' + n('e', m(hi, 'eDb'), 1) + ' dBµV/m, die Marge zur Übungsgrenzlinie ' + n('mg', m(hi, 'margin'), 1) + ' dB. Im Ablauf läuft f von ' + n('fa', 10, 0) + ' kHz bis ' + n('fb', 100, 0) + ' MHz; die Partikel wechseln den Weg.';
      } },
    { id: 'emx19', name: 'Der Abblockkondensator am Pin', cat: 'Layout', rig: 'layout',
      spec: () => ({ preset: 'abblock-weit-ok', ctl: { fall: 'abblock-weit', fix1: true, fix2: true }, ref: { fix1: false, fix2: false } }),
      text(X) {
        const { a, b, n } = X, cs = CORE().layout.cases.find(c => c.id === 'abblock-weit');
        must(cs && m(a, 'z100') < m(b, 'z100') && m(a, 'lloop') < m(b, 'lloop'), 'Maßnahmen senken Impedanz und Induktivität');
        return 'Der Abblockkondensator versorgt den Baustein mit der Ladung für die Schaltflanken, aber nur, wenn seine Zuleitung kurz ist. Im Fall „weit entfernt“ ist die Schleife ' + n('a0', m(b, 'area'), 0) + ' mm² groß, ihre Induktivität ' + n('l0', m(b, 'lloop'), 1) + ' nH, die Impedanz bei ' + n('f', 100, 0) + ' MHz ' + n('z0', m(b, 'z100'), 1) + ' Ω und die Abstrahlung ' + n('e0', m(b, 'eDb'), 1) +
          ' dBµV/m. Nach den beiden Maßnahmen („' + cs.fixes[0].text + '“ und „' + cs.fixes[1].text + '“) sinken die Fläche auf ' + n('a1', m(a, 'area'), 1) + ' mm², die Induktivität auf ' + n('l1', m(a, 'lloop'), 2) + ' nH, die Impedanz auf ' + n('z1', m(a, 'z100'), 2) + ' Ω und die Abstrahlung auf ' + n('e1', m(a, 'eDb'), 1) + ' dBµV/m (' + n('d', -m(a, 'eRel'), 1) + ' dB weniger). Setze den Abblockkondensator immer zuerst an den Pin.';
      } },
    { id: 'emx20', name: 'Zwei Lagen oder vier', cat: 'Layout', rig: 'layout',
      spec: () => ({ preset: 'lagen', ctl: { fall: 'lagen', stack: '4' }, ref: { stack: '2' } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), h4 = C.layout.solve('lagen', { stack: '4' }).hStack;
        must(m(a, 'eDb') < m(b, 'eDb') && m(a, 'area') < m(b, 'area') && m(b, 'ft') === 0, 'vier Lagen strahlen weniger, bei zwei Lagen gibt es keine Massefläche');
        return 'Mit zwei Lagen fehlt die Massefläche unter der Bahn: Der Rückstrom fließt im Rückleiter, die Schleife ist ' + n('a0', m(b, 'area'), 0) + ' mm² groß und die Abstrahlung bei 3 m erreicht ' + n('e0', m(b, 'eDb'), 1) + ' dBµV/m (Marge ' + n('m0', m(b, 'margin'), 1) + ' dB zur Übungsgrenzlinie). Mit vier Lagen liegt die Massefläche dicht unter der Bahn (' + n('h', h4, 1) +
          ' mm Lagenabstand im Modell): Die Schleife schrumpft auf ' + n('a1', m(a, 'area'), 0) + ' mm², die Übergangsfrequenz steigt auf ' + n('ft', m(a, 'ft'), 0) + ' kHz, die Abstrahlung sinkt auf ' + n('e1', m(a, 'eDb'), 1) + ' dBµV/m, also um ' + n('d', -m(a, 'eRel'), 1) + ' dB, und die Marge steigt auf ' + n('m1', m(a, 'margin'), 1) + ' dB. Die Lagenzahl ist eine sehr wirksame Layout-Maßnahme, kostet aber Platinenpreis.';
      } },
    /* ---------------------------------------------------------------- Impulse */
    { id: 'emx21', name: 'ESD ohne und mit TVS', cat: 'Impulse', rig: 'esd',
      spec: () => ({ preset: 'esd-tvs', ctl: { pruef: 'esdk', kv: 4, ort: 'io', masse: 'g360', schutz: 'tvsrs', tvs: 'tvs5', rs: 100 }, ref: { schutz: 'kein' }, seq: [{ t: 1, fire: true }], dur: 8, fire: true }),
      text(X) {
        const { a, b, n } = X, C = CORE(), vabs = C.device.params.vabs;
        must(m(b, 'vq') > vabs && m(a, 'vq') < vabs && b.s.kriterium === 'Ausfall', 'ohne Schutz über der Grenze (Ausfall), mit Schutz darunter');
        return 'Eine Kontaktentladung mit ' + n('kv', g(a, 'kv'), 0) + ' kV trifft den Stecker-Pin. Ohne Schutz erreicht die Spitze am Controller-Eingang ' + n('v0', m(b, 'vq'), 1) + ' V, höchstzulässig sind ' + n('vabs', vabs, 1) + ' V (Übungsgerät): Das Gerät fällt aus (Bewertung: ' + b.s.kriterium + '). Mit TVS-Diode (Typ ' + olabel('esd', 'tvs', a.rig.getControl('tvs')) + ') und Reihenwiderstand ' + n('rs', g(a, 'rs'), 0) +
          ' Ω bleibt die Spitze bei ' + n('v1', m(a, 'vq'), 1) + ' V; am Pin selbst liegen ' + n('vp', m(a, 'vp'), 1) + ' V, der Entladestrom ist ' + n('ip', m(a, 'ip'), 0) + ' A. Das Bewertungskriterium wird ' + a.s.kriterium + ' (Datenfehler: ' + n('ng', m(a, 'nGlitch'), 0) + ', Resets: ' + n('nr', m(a, 'nReset'), 0) + '). Löse die Entladung im Prüfstand selbst aus; die Zahlen sind Übungswerte, Herstellerdokumentation und aktuelle Norm maßgeblich.';
      } },
    { id: 'emx22', name: 'Burst addiert sich', cat: 'Impulse', rig: 'esd',
      spec: () => ({ preset: 'burst-reset', ctl: { pruef: 'burst', kv: 2, frep: 1e5, ort: 'io', schutz: 'kein' }, ref: { frep: 5000 }, seq: [{ t: 1, fire: true }], dur: 8, fire: true }),
      text(X) {
        const { a, b, S, n } = X, ta = a.s.treppe || {}, tb = b.s.treppe || {}, c = S({ schutz: 'rc', rs: 100, cbuf: 1e-7 }), tc = c.s.treppe || {};
        must(ta.treppe === true && tb.treppe === false && ta.vN > tb.vN && a.s.kriterium === b.s.kriterium, 'Treppe nur bei der hohen Wiederholrate, Kriterium gleich');
        return 'Ein Burst besteht aus ' + n('n', ta.n, 0) + ' Einzelimpulsen. Bei ' + n('f0', g(b, 'frep') / 1000, 0) + ' kHz Wiederholrate liegen ' + n('g0', tb.gap * 1e6, 0) + ' µs zwischen den Impulsen, die Zeitkonstante des Eingangs beträgt ' + n('t0', tb.tau * 1e6, 0) + ' µs: Der Eingang entlädt sich dazwischen, die Spannung erreicht höchstens ' + n('v0', tb.vN, 0) + ' V. Bei ' + n('f1', g(a, 'frep') / 1000, 0) +
          ' kHz sind es nur ' + n('g1', ta.gap * 1e6, 0) + ' µs Abstand, kürzer als die Zeitkonstante: Die Spannung addiert sich treppenförmig auf ' + n('v1', ta.vN, 0) + ' V. Ein RC-Glied mit Rs = ' + n('rs', g(c, 'rs'), 0) + ' Ω und Cbuf = ' + n('cb', g(c, 'cbuf') * 1e9, 0) + ' nF drückt die Treppe auf ' + n('v2', tc.vN, 0) + ' V. Ohne Schutz erreicht das Gerät in beiden Fällen Kriterium ' + a.s.kriterium +
          ' (Datenfehler: ' + n('ng', m(a, 'nGlitch'), 0) + '), mit dem RC-Glied ' + c.s.kriterium + ' (Datenfehler: ' + n('ng2', m(c, 'nGlitch'), 0) + '). Übungsimpuls nach Vorbild der Prüfnorm; Herstellerdokumentation und aktuelle Norm maßgeblich.';
      } },
    { id: 'emx23', name: 'Surge und Varistor', cat: 'Impulse', rig: 'esd',
      spec: () => ({ preset: 'surge-var', ctl: { pruef: 'surge', kv: 2, ort: 'netzln', schutz: 'varistor', var: 'v275' }, ref: { var: 'v230' }, seq: [{ t: 1, fire: true }], dur: 8, fire: true }),
      text(X) {
        const { a, b, n } = X, C = CORE(), pa = C.protect.parts.var.v275, pb = C.protect.parts.var.v230, du = b.d.some(x => x.id === 'var-dauer');
        must(du && !a.d.some(x => x.id === 'var-dauer') && m(a, 'vq') > m(b, 'vq'), 'v230 meldet Dauerspannung, v275 nicht, v275 klemmt höher');
        return 'Ein Surge mit ' + n('kv', g(a, 'kv'), 0) + ' kV auf L–N trifft einen Varistor am Netzeingang. Der Varistor mit Vac,max = ' + n('va0', pb.vacMax, 0) + ' V (Typ v230) klemmt den Stoß auf ' + n('v0', m(b, 'vq'), 0) + ' V und nimmt ' + n('w0', m(b, 'wVar'), 1) + ' J auf; die Dauerspannung am Netz (' + n('un', 253, 0) + ' V, das sind ' + n('u230', 230, 0) +
          ' V plus ' + n('pz', 10, 0) + ' %) liegt aber über seiner Dauerspannung: Er wird warm und altert (Meldung des Prüfstands). Der Typ v275 mit Vac,max = ' + n('va1', pa.vacMax, 0) + ' V hält die Dauerspannung aus, klemmt dafür aber höher: ' + n('v1', m(a, 'vq'), 0) + ' V hinter dem Varistor bei ' + n('w1', m(a, 'wVar'), 1) +
          ' J Energie. Eine höhere Dauerspannungsklasse schont den Varistor, belastet aber das Gerät dahinter stärker; das Gerät muss die Klemmspannung aushalten. Übungswerte, Herstellerdokumentation und aktuelle Norm maßgeblich.';
      } },
    /* ---------------------------------------------------------------- Messen */
    { id: 'emx24', name: 'Masseklemme oder Federkontakt', cat: 'Messen', rig: 'tastkopf',
      spec: () => ({ ctl: { lead: 'feder' }, ref: { lead: 'klemme' } }),
      text(X) {
        const { a, b, n } = X;
        must(m(a, 'os') < m(b, 'os') && m(a, 'pick') < m(b, 'pick') && near(m(a, 'trFehler'), m(b, 'trFehler'), 1e-9), 'Feder senkt Überschwinger und Einstreuung, der Anstiegszeit-Fehler bleibt');
        return 'Die Masseklemme des Tastkopfs ist eine lange Leitung (im Modell ' + n('lk', 150, 0) + ' mm, ' + n('lh', 150, 0) + ' nH); mit der Tastkopfkapazität bildet sie einen Schwingkreis bei ' + n('f0', m(b, 'fr'), 0) + ' MHz. Am Sprung von ' + n('amp', g(a, 'amp'), 1) + ' V mit ' + n('tr', g(a, 'trs'), 0) + ' ns Anstiegszeit zeigt das Oszilloskop dadurch einen Überschwinger von ' + n('o0', m(b, 'os'), 1) + ' %, und die Spur fängt ' + n('p0', m(b, 'pick'), 1) +
          ' mV Störspannung aus der Nachbarschaft ein. Mit dem Federkontakt (' + n('lf', 12, 0) + ' mm) liegt die Resonanz bei ' + n('f1', m(a, 'fr'), 0) + ' MHz, der Überschwinger sinkt auf ' + n('o1', m(a, 'os'), 1) + ' % und die eingefangene Störspannung auf ' + n('p1', m(a, 'pick'), 1) + ' mV. Der Messfehler der Anstiegszeit bleibt dagegen bei ' + n('tf', m(a, 'trFehler'), 1) +
          ' %, weil die Bandbreite des Systems (' + n('bw', m(a, 'bwSys'), 0) + ' MHz) die Flanke begrenzt: Ein kurzer Masseanschluss ersetzt keine ausreichende Bandbreite.';
      } },
    { id: 'emx26', name: 'Hot-Spot suchen und Vorprüfung', cat: 'Messen', rig: 'vorpruef',
      spec: () => {
        const rig = snap('vorpruef', { modus: 'nahfeld' }).rig, mx = rig.fieldGrid().max, gut = { rg: 33, snub: true, layout: 'optimiert', topo: 'pi', cx: 3.3e-7, cy: 2.2e-9, drossel: 'd3', jitter: 8 };
        return { ctl: { modus: 'nahfeld', px: +(+mx.x01).toFixed(4), py: +(+mx.y01).toFixed(4) }, seq: [{ t: 8, set: { modus: 'lisn' } }, { t: 16, set: gut }], dur: 24, gut };
      },
      text(X, d) {
        const { a, S, n } = X, mx = a.rig.fieldGrid().max, lis = S({ modus: 'lisn' }), gut = S(Object.assign({ modus: 'lisn' }, d.gut));
        must(m(a, 'nahfeld') > -0.5 && lis.a.ampel === 'rot' && gut.a.ampel === 'gruen', 'Sonde steht auf dem Hot-Spot, ohne Maßnahmen rot, mit Maßnahmen grün');
        return 'Die Vorprüfung beginnt mit der Nahfeldsonde: Die Karte zeigt den relativen Pegel des Magnetfelds über der Platine (nur relativ, in dB zum Maximum; Dipolmodell als Übungswert). Der Hot-Spot liegt bei x = ' + n('x', mx.xmm, 0) + ' mm und y = ' + n('y', mx.ymm, 0) + ' mm; dort zeigt das Messgerät ' + n('nf', m(a, 'nahfeld'), 1) +
          ' dB. Dann folgt der Test an der Netznachbildung: Ohne Maßnahmen liegt der höchste Spitzenwert bei ' + n('l0', m(lis, 'lMax'), 1) + ' dBµV (Marge zur Mittelwert-Linie ' + n('m0', m(lis, 'margin'), 1) + ' dB), die Ampel zeigt ' + ampName(lis) + '. Zuletzt setzt der Ablauf die Maßnahmen Rg ' + n('rg', d.gut.rg, 0) + ' Ω, Snubber, optimiertes Layout, π-Filter und Jitter ' + n('j', d.gut.jitter, 0) +
          ' %: Der höchste Spitzenwert sinkt auf ' + n('l1', m(gut, 'lMax'), 1) + ' dBµV, die Marge steigt auf ' + n('m1', m(gut, 'margin'), 1) + ' dB, die Ampel zeigt ' + ampName(gut) + '. Dafür kosten die Maßnahmen ' + n('pk', m(gut, 'punkte'), 0) + ' Punkte und ' + n('ps', m(gut, 'pSw'), 2) + ' W Schaltverlust. Die Vorprüfung ersetzt keine Prüfung im Labor.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['kopplung', 'quelle', 'filter', 'schirm', 'abstrahlung', 'layout', 'esd', 'tastkopf', 'vorpruef']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), preset = d.preset ? R.defs[def.rig].presets.find(p => p.id === d.preset) : null;
        const base = Object.assign({}, preset ? (preset.params || preset.controls || {}) : {}, d.ctl || {});
        const controls = fullCtl(def.rig, base);
        const S = (over, fire) => snap(def.rig, Object.assign({}, controls, over || {}), fire === undefined ? !!d.fire : fire);
        const X = { a: S({}), b: d.ref ? S(d.ref) : null, S };
        if (!X.a.ok || (X.b && !X.b.ok)) throw new Error((X.a.errors.concat(X.b ? X.b.errors : [])[0]) || 'Prüfstand nicht verfügbar');
        const vals = {};
        const nf = (k, v, dg) => { if (!fin(v)) throw new Error('Wert "' + k + '" ist keine Zahl'); vals[k] = v; return fm(v, dg); };
        X.n = (k, v, dg) => { const t = nf(k, v, dg); return t.indexOf(',') >= 0 ? t.replace(/0+$/, '').replace(/,$/, '') : t; };
        let desc = def.text(X, d);
        if (!/Übung/.test(desc)) desc += ' Alle Zahlen sind Übungswerte der Anlage.';
        if (/NaN|undefined|Infinity/.test(desc)) throw new Error('ungültiger Wert im Text: ' + desc.slice(0, 80));
        const ex = { id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc, controls, vals };
        if (d.ref) ex.ref = clone(d.ref);
        if (d.seq && d.seq.length) ex.seq = clone(d.seq);
        if (d.dur) ex.dur = d.dur;
        out.push(ex);
      } catch (e) { out.push({ id: def.id, name: def.name, cat: def.cat, rig: def.rig, desc: 'Dieses Beispiel konnte nicht berechnet werden: ' + String(e && e.message || e), controls: {}, vals: {}, error: String(e && e.message || e) }); }
    });
    return out;
  }
  const EMV_DATA = {};
  Object.defineProperty(EMV_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  EMV_DATA.exampleCount = EXDEFS.length;
  EMV_DATA.rebuild = () => buildExamples();                  // Neuberechnung ohne Zwischenspeicher (Tests: Determinismus)
  root.EMV_DATA = EMV_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.EMV_DATA.examples; }, tasks, register, EMV_TASKS, answerOf, clean, snap };
})(typeof window !== 'undefined' ? window : globalThis);
