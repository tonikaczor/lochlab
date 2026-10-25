/* anadata.js - ANA-Lab (Analogtechnik: Halbleiter und Verstaerker): Beispiele (ANA_DATA) und Aufgabenregister (ANA_TASKS), ohne Browser lauffaehig (WP4a).
 * Quelle: quelle/analab/_wp4a/p1_util.js + p2_examples_*.js, zusammengesetzt mit `node quelle/analab/_wp4a/build_ana.js` (nach Aenderungen neu bauen).
 *
 * window.ANA_DATA  = { examples: [ { id:'aex1'..'aex34', name, cat, rig, desc, controls, ref?, seq?, dur?, vals } ], exampleCount, exampleIds, rebuild }
 *   Alle Zahlen in `desc` kommen aus der Simulation (ANA_RIGS) und dem Kern (ANA_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff gerechnet (Getter);
 *   fehlen Kern oder Pruefstaende, enthaelt der Eintrag `error` und eine ehrliche Meldung statt einer Beschreibung (anaui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Pruefstands (Zustand bei Beginn bzw. NACHHER), ref = abweichende Steuerwerte des Zustands VORHER, seq im Format von ANA_CORE.runSeq
 *   (t in Sekunden: set | ramp | fire), dur in Sekunden. Behauptungen in den Texten stehen hinter must(bedingung, text): Traegt die gerechnete Zahl die Aussage nicht,
 *   meldet sich der Eintrag als fehlerhaft (Regel 2). Kategorien (SPEC 8.3): Diode, Transistorschalter, Transistorverstaerker, OPV-Grundschaltungen, Komparator und
 *   Schmitt-Trigger, Aktive Schaltungen, Fehlersuche (aex7, aex12, aex20, aex24); Pruefungsnah nur bei Aufgaben.
 * window.ANA_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in anatasks1.js (ae1-ae16) und anatasks2.js (ae17-ae32) und melden sich mit ANA_TASKS.register([...]) an; die Reihenfolge der Registry ist immer
 *   ae1, ae2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'aeN', lab:'ana', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, clicks, bericht, diagnose }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), seq?, value?, fields?, choices?, fired?, bericht?, lock?, hidden? } (Startvorlage bzw. Musterloesung samt
 *   Selbsttest-Antwort); bei Fehlersuche-Aufgaben liefert start() zusaetzlich lock:['fehler'] und hidden:['fehler'] (der Fehlerfall ist gesetzt, aber gesperrt und verdeckt).
 *   wrong() liefert [{ name, answer }] mit mindestens zwei absichtlich falschen Antworten (zu klein / zu gross bzw. falsch herum) fuer den Test (Regel 3).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * ANA_TASKS.util (fuer anatasks1.js, anatasks2.js und die Tests; Namen wie in wsldata.js, elsdata.js und ntsdata.js, damit alle Aufgabendateien dieselbe Huelle benutzen):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); snap(rigId, ctl, act?) -> { ok, rig, m (readMeters), a (assess), d (diagnose), s (state), rejected, errors }
 *   (Pruefstand frisch, Seed 1, Steuerwerte in fester Reihenfolge, gecacht; act = true | 'fire' | 'step:<ms>' | Liste davon); effOf; cdef; dlabel; olabel; setRow;
 *   mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId); numRow(r, val, opt); exRow(r, ex, raw, label); rawOf(a, key); fieldNum; numAns; choiceOf;
 *   calcEx({ kind, given, tol?, extras? } | { value, unit, ... }) -> Rechenuebung mit check(raw) auf Kernwerten (exercise.solve, auch mit festen Poolwerten); calcRow(r, ex, raw, label);
 *   choiceDef(key, frage, optionen[{value,label,reason}]); choiceRow(r, a, spec) (Auswahlfrage mit Fachgrund je falscher Antwort); firedOf(a) (Taste/fire benutzt?);
 *   faultOf(a) (gewaehlte Ursache: choices.ursache, choices.fehler oder diagnose); faultOpts(rigId, ids) (Ursachen-Auswahl aus den Optionen des Pruefstands);
 *   hiddenRig(rigId, ctl) (Pruefstand mit gesperrtem und verdecktem Fehler); variants; pctOf; rowsToSeq; lim(id) (Wert aus ANA_CORE.limits); CORE; RIGS; core (= CORE); rigs (= RIGS); nodeReq.
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben. Die Pruefung rechnet immer neu aus den abgegebenen Steuerwerten und den festen Werten der Aufgabe (nur die
 *   freigegebenen Steuerwerte `own` zaehlen; alles andere setzt die Pruefung selbst), nie aus dem angezeigten Zustand. Fehlersuche: Der Fehler steht nur in start().controls
 *   (gesperrt, verdeckt), nie in Text, Tipp oder Pruefmeldung vor der Antwort.
 * ANA_TASKS.audit(task) und ANA_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) fuer Selbsttest und Tests.
 * Uebungsanlage: Alle Bauteil- und Anlagenwerte sind Uebungswerte. Dies ist ein Simulations- und Uebungslabor fuer Kleinspannung, keine Anleitung fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.ANA_CORE || !root.ANA_CORE.exercise) nodeReq('./anacore-res.js'); return root.ANA_CORE || null; };
  const RIGFILES = ['./anarig-diode.js', './anarig-schalter.js', './anarig-emitter.js', './anarig-folger.js', './anarig-opvinv.js', './anarig-opvnin.js', './anarig-opvkomp.js', './anarig-opvaktiv.js'];
  const RIGS = id => { let R = root.ANA_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); nodeReq('./anarig-base.js'); RIGFILES.forEach(nodeReq); R = root.ANA_RIGS; } return R || null; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => { if (!fin(x)) return '–'; return (+x).toFixed(d == null ? 1 : d).replace('.', ',').replace(/^-(?=\d)/, '−'); };
  const toNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); const s = v.replace(/−/g, '-'); return C && typeof C.parseNum === 'function' ? C.parseNum(s) : parseFloat(s.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const lim = id => { const l = CORE().limit(id); return l && l.ok !== false ? l.value : NaN; };

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
      const o = (def.options || []).map(x => (isObj(x) ? x : { value: x, label: String(x) })), norm = s => String(s).trim().replace(',', '.');
      let m = o.find(x => x.value === v) || o.find(x => norm(x.value) === norm(v)) || o.find(x => String(x.label).toLowerCase() === String(v).toLowerCase());
      if (!m && (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && o.every(x => fin(+x.value))) {
        const q = toNum(v); if (fin(q)) { const c = o.slice().sort((a, b) => Math.abs(a.value - q) - Math.abs(b.value - q))[0]; if (c && Math.abs(c.value - q) <= 1e-3 * Math.max(1, Math.abs(c.value))) m = c; }
      }
      return m ? m.value : undefined;
    }
    return v;
  }
  /* Ablauf-Zeilen { t, kind:'set'|'ramp'|'fire'|'do', key, value|to, dur } -> runSeq-Format */
  function rowsToSeq(rows) {
    const m = new Map(), other = [];
    (Array.isArray(rows) ? rows : []).forEach(r => {
      if (!isObj(r)) return;
      const t = Math.max(0, toNum(r.t) || 0);
      if (r.kind === 'fire') { other.push({ t, fire: true }); return; }
      if (r.kind === 'do') { if (r.key) other.push({ t, do: String(r.key) }); return; }
      if (typeof r.key !== 'string') return;
      if (r.kind === 'ramp') { other.push({ t, ramp: { key: r.key, to: toNum(r.to != null ? r.to : r.value), durS: toNum(r.dur) } }); return; }
      if (!m.has(t)) m.set(t, {});
      m.get(t)[r.key] = r.value;
    });
    return [...m.entries()].map(([t, set]) => ({ t, set })).concat(other).sort((a, b) => a.t - b.t);
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
    if (isObj(a.controls)) Object.keys(a.controls).forEach(k => { if (map[k] && map[k].type === 'button') return; if (k === 'fire') return; const x = one(k, a.controls[k], ''); if (x !== undefined) controls[k] = x; });
    const src = Array.isArray(a.seq) && a.seq.length ? a.seq : rowsToSeq(a.rows), seq = [];
    src.forEach((e, i) => {
      if (!isObj(e)) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm ist unlesbar.'); return; }
      const t = toNum(e.t);
      if (!fin(t) || t < 0) { problems.push('Schritt ' + (i + 1) + ' im Ablaufprogramm hat keine gültige Zeit.'); return; }
      const out = { t };
      const set = isObj(e.set) ? e.set : (typeof e.key === 'string' && e.kind !== 'do' ? { [e.key]: e.value } : null);
      if (set) { out.set = {}; Object.keys(set).forEach(k => { if (map[k] && map[k].type === 'button') { if (set[k]) out.press = (out.press || []).concat(k); return; } const x = one(k, set[k], ' (Schritt ' + (i + 1) + ')'); if (x !== undefined) out.set[k] = x; }); }
      if (isObj(e.ramp) && typeof e.ramp.key === 'string') {
        if (defs && !map[e.ramp.key]) { if (relevant(e.ramp.key)) problems.push('Den Steuerwert „' + e.ramp.key + '“ gibt es an diesem Prüfstand nicht (Schritt ' + (i + 1) + ').'); }
        else out.ramp = { key: e.ramp.key, to: toNum(e.ramp.to), durS: toNum(e.ramp.durS) };
      }
      if (e.fire) out.fire = true;
      if (typeof e.do === 'string' && e.do) out.do = e.do;
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
  /* Rohtext einer Eingabe (Zahl oder String) fuer calcEx(...).check; null = nichts eingetragen */
  function rawOf(a, key) {
    let v = null;
    if (key === 'value' || key == null) v = isObj(a) ? (a.value !== undefined && a.value !== null && a.value !== '' ? a.value : a.text) : null;
    else v = isObj(a) && isObj(a.fields) ? a.fields[key] : null;
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
    return typeof v === 'number' ? (fin(v) ? String(v).replace('.', ',') : null) : String(v);
  }
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);
  /* feuert fire (Spannungsdurchlauf, Schaltvorgang, Aussteuerung, Lastwechsel, Frequenzdurchlauf, Eingangsdurchlauf, Start) in der Antwort? */
  function firedOf(a) {
    if (!isObj(a)) return false;
    if (a.fired === true) return true;
    if (isObj(a.state) && a.state.fired === true) return true;
    const seq = Array.isArray(a.seq) ? a.seq : rowsToSeq(a.rows);
    return seq.some(e => isObj(e) && e.fire === true);
  }

  /* ====================================================================== Pruefstand: Momentaufnahme */
  /* erst Auswahlen, von denen andere Werte abhaengen (Betriebsart, Schaltung, Last, Bauteil, Modell, OPV ...), dann der Rest in der Reihenfolge der Bedienelemente */
  const FIRST = ['betrieb', 'schaltung', 'last', 'typ', 'modell', 'opv', 'eingang', 'form', 'ansicht'];
  const snapCache = new Map();
  const actList = act => (act === true ? ['fire'] : typeof act === 'string' && act ? [act] : Array.isArray(act) ? act.filter(x => typeof x === 'string' && x) : []);
  const orderKeys = ctl => Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0));
  function snap(rigId, ctl, act) {
    ctl = isObj(ctl) ? ctl : {};
    const acts = actList(act);
    const key = rigId + '|' + acts.join(',') + '|' + JSON.stringify(ctl);
    if (snapCache.has(key)) return snapCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId); if (!R || !R.defs || !R.defs[rigId]) throw new Error('Den Prüfstand „' + rigId + '“ gibt es nicht.');
      const rig = R.create(rigId, { seed: 1, noDraw: true });
      orderKeys(ctl).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push({ key: k, value: ctl[k] });
      });
      acts.forEach(x => {
        if (x === 'fire') { if (typeof rig.fire === 'function') rig.fire(); }
        else if (/^step:/.test(x)) { let ms = +x.slice(5) || 0; while (ms > 0) { const d = Math.min(ms, 400); rig.step(d); ms -= d; } }
      });
      out.rig = rig; out.m = clone(rig.readMeters()); out.a = clone(rig.assess()); out.d = clone(rig.diagnose()); out.s = clone(rig.state());
      out.ok = true;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message || e)); out.m = {}; out.a = null; out.d = []; out.s = {}; }
    if (snapCache.size > 500) snapCache.clear();
    snapCache.set(key, out);
    return out;
  }
  /* alle Steuerwerte eines Pruefstands in der Reihenfolge der Bedienelemente: Standardwerte des frischen Pruefstands, darueber over (in dieser Reihenfolge angewendet, damit
   * abhaengige Werte stimmen, z. B. Rf beim Schaltungswechsel); Tasten (button) fehlen */
  function fullCtl(rigId, over) {
    const R = RIGS(rigId), defs = ctlDefs(rigId);
    over = isObj(over) ? over : {};
    if (!R || !defs) return Object.assign({}, over);
    let rig = null; try { rig = R.create(rigId, { seed: 1, noDraw: true }); } catch (e) { rig = null; }
    const out = {};
    if (rig) orderKeys(over).forEach(k => { try { rig.setControl(k, over[k]); } catch (e) { /* unbekannt */ } });
    defs.forEach(c => { if (c.type === 'button') return; let v; try { v = rig ? rig.getControl(c.key) : undefined; } catch (e) { v = undefined; } out[c.key] = v !== undefined ? v : c.value; });
    Object.keys(over).forEach(k => { if (!(k in out)) out[k] = over[k]; });
    return out;
  }
  /* Eingaben der Aufgabe: freigegebene Steuerwerte (own) ueber den festen Werten (fix) und den Standardwerten des Pruefstands */
  const effOf = (c, rigId, own, fix) => fullCtl(rigId, Object.assign({}, fix, initial(c, own)));
  const cdef = (rigId, key) => (ctlDefs(rigId) || []).find(x => x.key === key) || null;
  const dlabel = (rigId, key) => { const d = cdef(rigId, key); return d && d.label ? d.label : key; };
  function olabel(rigId, key, v) {
    const d = cdef(rigId, key);
    if (d && Array.isArray(d.options)) { const o = d.options.map(x => (isObj(x) ? x : { value: x, label: String(x) })).find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    if (typeof v === 'number') {
      const u = d && d.unit ? d.unit : '';
      if (['Hz', 'V', 'A', 'Ω', 'H', 'F', 'W', 's'].includes(u)) { const C = CORE(); if (C && typeof C.fmtEng === 'function') return C.fmtEng(v, u); }
      return fm(v, Math.abs(v) < 1 && v !== 0 ? 4 : 2).replace(/,?0+$/, '') + (u ? ' ' + u : '');
    }
    return String(v);
  }
  /* Steuerwerte-Zeile: specs = [{ key, want, tol? (relativ, nur Zahlen) }]; ok, wenn alle stimmen; why nennt nur die abweichenden */
  function setRow(r, rigId, eff, specs, label) {
    const bad = [];
    specs.forEach(s => {
      const x = eff[s.key];
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
   *   tol (relativ, Standard 0,03) oder absTol (absolut, in der Einheit der Zahl), unit, digits, wrong:[{v, msg}] (typische Fehlerbilder, jedes gerechnet) }.
   * Die Warum-Texte sagen nur, was verglichen wurde: Richtung (zu klein/zu gross) und passendes Fehlerbild, nie mehr (Regel 2 und 3). */
  function numRow(r, val, opt) {
    const pctTxt = q => fm(100 * q, Math.abs(100 * q - Math.round(100 * q)) < 1e-9 ? 0 : 1);
    const absMode = fin(opt.absTol), tol = fin(opt.tol) ? opt.tol : 0.03, dg = opt.digits == null ? 2 : opt.digits, u = opt.unit ? ' ' + opt.unit : '';
    const refs = opt.refs.filter(x => fin(x.v)), main = refs[0];
    const near = (a, b) => (absMode ? Math.abs(a - b) <= opt.absTol + 1e-9 : Math.abs(a - b) <= tol * Math.abs(b) + 1e-12);
    const tolTxt = absMode ? 'Toleranz ±' + fm(opt.absTol, 1) + u : 'Toleranz ' + pctTxt(tol) + ' %';
    const good = val !== null && !!main && refs.some(x => near(val, x.v));
    let why = 'Du hast keine Zahl eingetragen.';
    if (val !== null && main) {
      why = 'Dein Wert ' + fm(val, dg) + u + ' weicht um mehr als ' + (absMode ? fm(opt.absTol, 1) + u : pctTxt(tol) + ' %') + ' vom Rechenwert ab (' + fm(main.v, dg) + u + ').';
      const w = (opt.wrong || []).find(x => fin(x.v) && near(val, x.v));
      if (w) why = 'Dein Wert ' + fm(val, dg) + u + ' passt zu einem häufigen Fehler: ' + w.msg;
      else why += val < main.v ? ' Er ist zu klein.' : ' Er ist zu groß.';
    }
    r(good, opt.label + ' (' + tolTxt + ')', why);
    return good;
  }

  /* ====================================================================== Rechenuebungen auf Kernwerten (feste Poolwerte moeglich) */
  const PREFS = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function dispOf(v, unit) {
    if (unit === '' || unit === 'dB' || unit === '°' || !fin(v) || v === 0) return { value: v, unit, factor: 1 };
    const a = Math.abs(v); let p = PREFS[PREFS.length - 1];
    for (let i = 0; i < PREFS.length; i++) if (a >= PREFS[i][0] * 0.99995) { p = PREFS[i]; break; }
    return { value: v / p[0], unit: p[1] + unit, factor: p[0] };
  }
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 's', 'S', 'dB', 'V/s', 'V/µs', 'V/us'];
  function baseUnit(u) {
    if (!u) return '';
    const b = x => (x === 'Ohm' || x === 'ohm' ? 'Ω' : x);
    if (ULIST.includes(u)) return b(u);
    if (u.length >= 2 && 'TGMkKmµμunp'.includes(u[0]) && ULIST.includes(u.slice(1))) return b(u.slice(1));
    return '';
  }
  /* Zahl und Einheit einer Eingabe: { a (SI nach Vorsatz), unit (Rest) } oder null */
  function parseAns(raw) {
    const C = CORE();
    if (typeof raw === 'number') return fin(raw) ? { a: raw, rest: '' } : null;
    if (typeof raw !== 'string') return null;
    const s = raw.trim().replace(/−/g, '-'); if (!s) return null;
    const a = C.parseNum(s); if (!fin(a)) return null;
    const m = s.match(/^[+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?\s*(.*)$/);
    return { a, rest: m ? m[1].trim() : '' };
  }
  /* spec = { kind, given } (Kernwerte ueber exercise.solve, Poolzahlen frei waehlbar) oder { value, unit, what, alt?, wrong? } (eigener Wert aus dem Kern);
   * tol (relativ, Standard aus der Kernuebung bzw. 0,03), extras:[{ v (SI), msg }] zusaetzliche typische Fehler, altExtra:[SI] weitere richtige Werte (Tabellenbuch-Rundungen) */
  function calcEx(spec) {
    const C = CORE(); let value, unit, alt = [], wrong = [], disp, tol = 0.03, what = spec.what || '';
    try {
      if (spec.kind) {
        const s = C.exercise.solve(spec.kind, spec.given);
        if (!s || s.ok === false) return { ok: false, why: (s && s.why) || 'Die Aufgabenart ist nicht verfügbar.' };
        value = s.value; unit = s.unit; alt = (s.alt || []).slice(); wrong = (s.wrong || []).map(w => ({ id: w.id, value: w.value, text: w.text })); if (fin(s.tol)) tol = s.tol;
      } else { value = spec.value; unit = spec.unit || ''; alt = (spec.alt || []).slice(); wrong = (spec.wrong || []).map(w => ({ id: w.id || 'x', value: w.v !== undefined ? w.v : w.value, text: w.msg || w.text })); }
    } catch (e) { return { ok: false, why: 'Der Rechenkern ist nicht verfügbar.' }; }
    if (!fin(value)) return { ok: false, why: 'Die Aufgabe hat keinen gültigen Wert.' };
    if (fin(spec.tol)) tol = spec.tol;
    (spec.altExtra || []).forEach(v => { if (fin(v)) alt.push(v); });
    (spec.extras || []).forEach(x => { if (fin(x.v)) wrong.push({ id: 'extra', value: x.v, text: x.msg }); });
    disp = dispOf(value, unit);
    const msg = (id, vars) => C.exercise.msg(id, vars);
    const fe = (x, u) => C.fmtEng(x, u);
    const near = (a, b) => Math.abs(a - b) <= tol * Math.abs(b) + 1e-300;
    const ex = { ok: true, kind: spec.kind || null, value, unit, alt, wrong, disp, tol, what,
      check(raw) {
        const q = parseAns(raw);
        if (!q) return { ok: false, why: 'keine-zahl', text: msg('keine-zahl') };
        const hasUnit = q.rest !== '';
        if (hasUnit && unit) { const b = baseUnit(q.rest), same = b === unit || (unit === 'V/s' && (b === 'V/µs' || b === 'V/us')); if (b && !same && !(b === 'dB' && unit === '')) return { ok: false, why: 'einheit', text: msg('einheit', { gesucht: unit }) }; }
        const cands = [q.a]; if (!hasUnit && disp.factor !== 1) cands.push(q.a * disp.factor);
        const refs = [value].concat(alt);
        for (let i = 0; i < cands.length; i++) for (let j = 0; j < refs.length; j++) if (near(cands[i], refs[j])) return { ok: true, why: 'richtig', text: msg('richtig', { was: what, wert: fe(value, unit) }) };
        let a = cands[0];
        if (cands.length > 1 && value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / value))); if (l1 < l0) a = cands[1]; }
        for (let k = 0; k < wrong.length; k++) for (let i = 0; i < cands.length; i++) if (near(cands[i], wrong[k].value)) return { ok: false, why: wrong[k].id, text: wrong[k].text };
        if (a !== 0 && value !== 0 && (a > 0) === (value > 0)) {
          const rr = a / value, lr = Math.log(Math.abs(rr)) / Math.LN10;
          if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) return { ok: false, why: 'vorsatz', text: msg('vorsatz', { faktor: Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')' }) };
          if (Math.abs(rr / (2 * Math.PI) - 1) < 0.03 || Math.abs(rr * 2 * Math.PI - 1) < 0.03) return { ok: false, why: 'zwei-pi', text: msg('zwei-pi') };
          return rr < 1 ? { ok: false, why: 'zu-klein', text: msg('zu-klein', { pct: fm((1 - rr) * 100, 0) }) } : { ok: false, why: 'zu-gross', text: msg('zu-gross', { pct: fm((rr - 1) * 100, 0) }) };
        }
        if (a !== 0 && value !== 0) return { ok: false, why: 'vorzeichen', text: msg('vorzeichen') };
        return a < value ? { ok: false, why: 'zu-klein', text: msg('zu-klein', { pct: '100' }) } : { ok: false, why: 'zu-gross', text: msg('zu-gross', { pct: fm(Math.abs(a - value) / Math.max(Math.abs(value), 1e-300) * 100, 0) }) };
      } };
    return ex;
  }
  /* Zeile fuer eine Rechenuebung (calcEx oder Kernuebung): raw = Rohtext der Eingabe (rawOf); die Texte stammen aus ex.check */
  function calcRow(r, ex, raw, label) {
    if (!ex || ex.ok === false || typeof ex.check !== 'function') { r(false, label, 'Die Übung konnte nicht erzeugt werden: ' + (ex && ex.why ? ex.why : 'Rechenkern fehlt.')); return false; }
    if (raw === null || raw === undefined) { r(false, label, 'Du hast keine Zahl eingetragen.'); return false; }
    let q; try { q = ex.check(raw); } catch (e) { q = { ok: false, text: 'Die Prüfung der Zahl ist fehlgeschlagen.' }; }
    r(!!q.ok, label, q.ok ? '' : q.text + (q.why && !/^[a-zäöü0-9-]+$/i.test(q.why) ? ' ' + q.why : ''));
    return !!q.ok;
  }
  const exRow = calcRow;
  /* Auswahlfrage: key, q (Frage), opts = [{ value, label, reason }]; right = Wert der richtigen Option */
  function choiceDef(key, q, opts) { return { key, q, options: opts.map(o => ({ value: o.value, label: o.label })) }; }
  function choiceRow(r, a, spec) {
    const got = choiceOf(a, spec.key), none = got === undefined || got === null || got === '';
    const hit = none ? null : (spec.opts || []).find(o => String(o.value) === String(got));
    const good = !none && String(got) === String(spec.right);
    r(good, spec.label, none ? 'Wähle eine Antwort aus.' : hit ? 'Deine Antwort „' + hit.label + '“ stimmt nicht. ' + (hit.reason || '') : 'Deine Auswahl gehört nicht zu den Antworten.');
    return good;
  }
  /* Fehlersuche: gewaehlte Ursache (eigene Auswahl `ursache`, sonst Diagnose der Oberflaeche `fehler`, sonst `diagnose`) */
  function faultOf(a) {
    if (!isObj(a)) return null;
    const c = isObj(a.choices) ? a.choices : {};
    for (const v of [c.ursache, c.fehler, a.diagnose]) if (typeof v === 'string' && v.trim() !== '') return v;
    return null;
  }
  /* Ursachen-Auswahl aus den Optionen des Fehlerfeldes (Namen wie in der Diagnose der Oberflaeche); ids = Werte der Kandidaten */
  function faultOpts(rigId, ids) {
    const d = cdef(rigId, 'fehler'), o = ((d && d.options) || []).map(x => (isObj(x) ? x : { value: x, label: String(x) }));
    return ids.map(id => { const x = o.find(q => q.value === id); return { value: id, label: x ? x.label : id }; });
  }
  /* Pruefstand mit gesperrtem und verdecktem Fehler (wie die Oberflaeche ihn fuer start() baut); fuer Tests der Verdeckung */
  function hiddenRig(rigId, ctl) {
    const R = RIGS(rigId); if (!R || !R.defs || !R.defs[rigId]) return null;
    const rig = R.create(rigId, { seed: 1, noDraw: true });
    orderKeys(ctl || {}).forEach(k => { try { rig.setControl(k, ctl[k]); } catch (e) { /* unbekannt */ } });
    if (typeof rig.setLock === 'function') rig.setLock(['fehler']);
    if (typeof rig.setHidden === 'function') rig.setHidden(['fehler']);
    return rig;
  }
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 6; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^ae(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const ANA_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, ctlDefs, coerce, clean, initial, snap, effOf, mk, inputRow, setRow, numRow, exRow, calcEx, calcRow, choiceDef, choiceRow, firedOf, variants, fieldNum, numAns,
      choiceOf, rawOf, pctOf, rowsToSeq, cdef, dlabel, olabel, lim, faultOf, faultOpts, hiddenRig, CORE, RIGS, core: CORE, rigs: RIGS, nodeReq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberflaeche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, ref: o.ref || null, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: isObj(o.state) ? o.state : null, simTime: 0,
      fired: !!o.fired, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [], bericht: isObj(o.bericht) ? o.bericht : null,
      diagnose: typeof o.diagnose === 'string' ? o.diagnose : null };
  }
  ANA_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel, einer Formelkonstante (task.consts), den Grenzwerten aus ANA_CORE.limits
   * oder einem Bedienelement-/Optionsnamen des Pruefstands stammen; 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).match(/\d+(?:,\d+)?/g) || []);
  const FREI = ['0', '1', '2', '3', '100'];
  function partTokens() {
    const out = [], R = RIGS(); if (!R || !R.defs) return out;
    try { Object.keys(R.defs).forEach(id => flat(R.defs[id].controls, []).forEach(c => { [c.key, c.label].forEach(x => numTokens(x).forEach(y => out.push(y))); (c.options || []).forEach(o => (isObj(o) ? [o.value, o.label] : [o]).forEach(x => numTokens(x).forEach(y => out.push(y)))); })); } catch (e) { /* ohne Tabelle keine Namen */ }
    const C = CORE(); try { (C.limits || []).forEach(l => { if (fin(l.value)) variants(l.value).forEach(y => out.push(y)); }); } catch (e) { /* ohne Grenzwerte */ }
    return out;
  }
  function allowedTokens(vals, extra, texts) {
    const set = new Set(FREI); partTokens().forEach(x => set.add(x));
    (function walk(o) { Object.keys(o || {}).forEach(k => { const v = o[k]; if (isObj(v) || Array.isArray(v)) walk(v); else variants(v).forEach(x => set.add(x)); }); })(vals);
    (extra || []).forEach(v => variants(v).forEach(x => set.add(x)));
    (texts || []).forEach(tx => numTokens(tx).forEach(x => set.add(x)));
    return set;
  }
  ANA_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  ANA_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.ref || {}, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.ANA_TASKS = ANA_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await ANA_TASKS.run(t, answerOf(t, t.start()))), L = await ANA_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (34) */
  /* Jedes Beispiel: spec() liefert das Szenario (preset | ctl = Steuerwerte NACHHER bzw. zu Beginn, ref = abweichende Steuerwerte VORHER, seq, dur, fire), die Simulation rechnet es genau wie die
   * Oberflaeche (Steuerwerte, Pruefstaende, ANA_CORE), und text(X) formuliert die Beschreibung. X.a = Zustand nachher (bei seq mit fire: nach der Ausloesung), X.b = Zustand vorher (oder null),
   * X.S(over, act) = Zustand mit abweichenden Steuerwerten, X.n(schluessel, wert, stellen) = Zahl im Text. Jede Zahl der Beschreibung laeuft ueber n(): Sie steht danach in `vals` und stammt aus
   * Simulation, Pruefstand oder Kern (Regel 1). Alles Uebungswerte (Uebungsschaltung). Fachbegriffe wie in SPEC Abschnitt 2, Verstaerkung immer V_u.
   * Messgeraete (Anzeigeeinheit): diode ud V, id mA, ur V, pr mW, pd mW; schalter ic mA, ib µA, uce V, ube V, ubm V (Betriebsspannung gemessen), ibmin µA, rbmax kΩ, plast mW, pv mW; emitter ic mA, ib µA, rin und ra kΩ, klirr %;
   * state() dagegen in SI (A, V, Ω, W, s). */
  const m = (s, k) => (s && s.m ? s.m[k] : NaN);
  const st = (s, k) => (s && s.s ? s.s[k] : NaN);
  const g = (s, k) => (s && s.rig ? +s.rig.getControl(k) : NaN);
  const gs = (s, k) => (s && s.rig ? s.rig.getControl(k) : undefined);        // Auswahlwert (Text) aus dem Pruefstand               // Steuerwert aus dem Pruefstand (Text und Simulation haben dieselbe Quelle)
  const must = (c, why) => { if (!c) throw new Error('Behauptung im Text nicht belegt: ' + why); };
  const close = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-3 : rel) * Math.max(Math.abs(b), 1e-12);
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const ampName = s => (s && s.a ? AMP[s.a.ampel] || s.a.ampel : '');
  const K = 1e3, MA = 1e3, UA = 1e6, MV = 1e3;                                  // Anzeige in kΩ, mA, µA, mV

  const EXDEFS = [
    /* ---------------------------------------------------------------- Diode */
    { id: 'aex1', name: 'LED mit Vorwiderstand an 24 V', cat: 'Diode', rig: 'diode',
      spec: () => ({ preset: 'led-24v' }),
      text(X) {
        const { a, n } = X, C = CORE(), uf = st(a, 'uf'), rv10 = C.diode.rvFor({ uq: g(a, 'uq'), uf, i: 0.01 });
        must(st(a, 'zustand') === 'leitet' && close(m(a, 'ur'), g(a, 'uq') - uf, 1e-9) && close(st(a, 'id'), m(a, 'ur') / g(a, 'rv'), 1e-6) && close(m(a, 'pr'), m(a, 'ur') * st(a, 'id') * MA, 1e-6) && close(m(a, 'pd'), uf * st(a, 'id') * MA, 1e-6), 'U_R = U_B − U_F, I = U_R / R_V, P_R = U_R · I, P_LED = U_F · I');
        return 'Eine rote LED mit der Flussspannung U_F = ' + n('uf', uf, 1) + ' V liegt in Reihe mit R_V = ' + n('rv', g(a, 'rv') / K, 1) + ' kΩ an U_B = ' + n('uq', g(a, 'uq'), 0) + ' V. Am Vorwiderstand liegt der Rest der Spannung, U_R = U_B − U_F = ' + n('ur', m(a, 'ur'), 1) +
          ' V; der Strom ist I = U_R / R_V = ' + n('i', m(a, 'id'), 3) + ' mA. Im Vorwiderstand werden P_R = U_R · I = ' + n('pr', m(a, 'pr'), 1) + ' mW in Wärme umgesetzt, in der LED nur ' + n('pd', m(a, 'pd'), 2) + ' mW. Für I_F = ' + n('if', 10, 0) +
          ' mA bräuchtest du R_V = (U_B − U_F) / I_F = ' + n('rv10', rv10 / K, 1) + ' kΩ. Der Vorwiderstand begrenzt den Strom: Ohne ihn bestimmt nur die Kennlinie der LED, wie viel Strom fließt (Gefahr für die LED, nur Simulation).';
      } },
    { id: 'aex2', name: 'Kennlinien im Vergleich und Temperatur', cat: 'Diode', rig: 'diode',
      spec: () => ({ preset: 'si-1k', ctl: { temp: 87 }, ref: { temp: 27 } }),
      text(X) {
        const { a, b, S, n } = X, sk = S({ typ: 'schottky', temp: 27 }), tk = CORE().limit('tk_uf').value;
        must(st(b, 'zustand') === 'leitet' && close(m(b, 'rd'), 0.026 / st(b, 'id'), 1e-3) && close(m(b, 'us'), m(b, 'ud') - st(b, 'id') * m(b, 'rd'), 1e-3) && m(a, 'ud') < m(b, 'ud') && m(sk, 'ud') < m(b, 'ud') && Math.abs((m(a, 'ud') - m(b, 'ud')) / 60 - tk) < 0.0002, 'r_d = U_T / I, Tangente U_S = U_D − I·r_d, U_F sinkt mit der Temperatur, Schottky niedriger');
        return 'Dieselbe Reihenschaltung (U_q = ' + n('uq', g(b, 'uq'), 0) + ' V, R_V = ' + n('rv', g(b, 'rv') / K, 0) + ' kΩ) mit einer Siliziumdiode: Der Arbeitspunkt liegt auf der Kennlinie bei U_D = ' + n('ud', m(b, 'ud'), 3) + ' V und I = ' + n('i', m(b, 'id'), 2) + ' mA. ' +
          'Dort ist der dynamische Widerstand r_d = U_T / I = ' + n('rd', m(b, 'rd'), 2) + ' Ω; die Tangente im Arbeitspunkt schneidet die Spannungsachse bei U_S = ' + n('us', m(b, 'us'), 3) + ' V. Das ist die „Schwellspannung“ als Näherung: Die Diode beginnt nicht erst dort zu leiten, die Kennlinie ist ein glatter Exponentialverlauf. ' +
          'Eine Schottky-Diode erreicht bei gleichem Aufbau nur U_D = ' + n('uds', m(sk, 'ud'), 3) + ' V (Strom ' + n('is', m(sk, 'id'), 2) + ' mA). Wird die Diode um ' + n('dt', g(a, 'temp') - g(b, 'temp'), 0) + ' K wärmer (' + n('t2', g(a, 'temp'), 0) + ' °C), sinkt U_D auf ' + n('uh', m(a, 'ud'), 3) + ' V, das sind ' +
          n('du', (m(a, 'ud') - m(b, 'ud')) * MV, 1) + ' mV (Lehrwert ' + n('tk', tk * MV, 0) + ' mV je Kelvin, Übungswert; der kleine Unterschied zu ' + n('dt2', tk * MV * 60, 0) + ' mV entsteht, weil sich mit der Spannung auch der Strom ändert).';
      } },
    { id: 'aex3', name: 'Z-Diode mit Last', cat: 'Diode', rig: 'diode',
      spec: () => ({ preset: 'z-12v' }),
      text(X) {
        const { a, S, n } = X, C = CORE(), lo = S({ uq: 4 }), vp = S({ uq: -12 }), iz = C.formulas.izLast(g(a, 'uq'), g(a, 'uz'), g(a, 'rv'), g(a, 'rlast'));
        must(st(a, 'zustand') === 'durchbruch' && close(m(a, 'iz') / MA, iz, 1e-6) && st(lo, 'zustand') === 'sperrt' && m(lo, 'iz') === 0 && st(vp, 'zustand') === 'verpolt' && close(m(vp, 'ud'), -0.7, 1e-6), 'Durchbruch mit I_Z = (U_q − U_Z)/R_V − U_Z/R_L, darunter sperrt sie, verpolt leitet sie mit 0,7 V');
        const ir = st(a, 'iq'), il = st(a, 'ilast');
        return 'Die Z-Diode (U_Z = ' + n('uz', g(a, 'uz'), 1) + ' V) arbeitet in Sperrrichtung im Durchbruch: An ihr liegen ' + n('ud', m(a, 'ud'), 1) + ' V, solange genug Strom fließt. Aus U_q = ' + n('uq', g(a, 'uq'), 0) + ' V über R_V = ' + n('rv', g(a, 'rv'), 0) + ' Ω fließt I_R = (U_q − U_Z) / R_V = ' + n('ir', ir * MA, 3) +
          ' mA. Davon nimmt die Last R_L = ' + n('rl', g(a, 'rlast') / K, 1) + ' kΩ I_L = U_Z / R_L = ' + n('il', il * MA, 3) + ' mA, der Rest fließt durch die Z-Diode: I_Z = I_R − I_L = ' + n('iz', m(a, 'iz'), 3) + ' mA. Sinkt die Quellenspannung auf ' + n('uq2', g(lo, 'uq'), 0) +
          ' V, liegt sie unter U_Z: Es gibt keinen Durchbruch (I_Z = ' + n('iz2', m(lo, 'iz'), 0) + ' mA), die Spannung an der Diode folgt nur dem Spannungsteiler (' + n('ud2', m(lo, 'ud'), 2) + ' V). Wird die Quelle verpolt (' + n('uq3', g(vp, 'uq'), 0) + ' V), leitet die Z-Diode wie eine normale Diode in Durchlassrichtung bei ' + n('ud3', Math.abs(m(vp, 'ud')), 1) + ' V; es fließen ' + n('i3', Math.abs(m(vp, 'id')), 1) + ' mA.';
      } },
    /* ---------------------------------------------------------------- Transistor als Schalter */
    { id: 'aex4', name: 'Transistor schaltet eine LED', cat: 'Transistorschalter', rig: 'schalter',
      spec: () => ({ preset: 'led-5v' }),
      text(X) {
        const { a, n } = X, C = CORE(), sw = C.tr.switch({ ub: g(a, 'ub'), last: 'led', uf: g(a, 'uf'), rv: g(a, 'rv'), ust: g(a, 'ust'), rb: g(a, 'rb'), b: g(a, 'b') });
        must(st(a, 'zustand') === 'saettigung' && close(st(a, 'ic'), sw.ic, 1e-9) && close(m(a, 'ueb'), sw.ueb, 1e-9) && close(st(a, 'ic'), (g(a, 'ub') - g(a, 'uf') - st(a, 'uce')) / g(a, 'rv'), 1e-6) && close(m(a, 'ibmin'), st(a, 'ic') / g(a, 'b') * UA, 1e-6), 'I_C,sat = (U_B − U_F − U_CE,sat)/R_V, I_B,min = I_C/B, ü = I_B/I_B,min');
        return 'Ein Steuersignal von ' + n('ust', g(a, 'ust'), 0) + ' V schaltet über R_B = ' + n('rb', g(a, 'rb') / K, 1) + ' kΩ einen Transistor (B = ' + n('b', g(a, 'b'), 0) + '), der eine rote LED (U_F = ' + n('uf', g(a, 'uf'), 1) + ' V) mit R_V = ' + n('rv', g(a, 'rv'), 0) + ' Ω an U_B = ' + n('ub', g(a, 'ub'), 0) +
          ' V schaltet. Durchgesteuert fällt nur U_CE,sat = ' + n('ucs', st(a, 'uce'), 1) + ' V am Transistor ab: I_C = (U_B − U_F − U_CE,sat) / R_V = ' + n('ic', m(a, 'ic'), 3) + ' mA. Der Basisstrom ist I_B = (U_St − U_BE) / R_B = ' + n('ib', m(a, 'ib'), 1) + ' µA, mindestens nötig wären I_B,min = I_C / B = ' + n('ibm', m(a, 'ibmin'), 2) +
          ' µA. Der Übersteuerungsfaktor ü = I_B / I_B,min = ' + n('ueb', m(a, 'ueb'), 1) + ' sagt: Der Transistor ist sicher gesättigt, die Verlustleistung im Transistor beträgt nur P_V = ' + n('pv', m(a, 'pv'), 2) + ' mW.';
      } },
    { id: 'aex5', name: 'Basisvorwiderstand und Übersteuerung', cat: 'Transistorschalter', rig: 'schalter',
      spec: () => ({ preset: 'ueb-3', ref: { rb: 200000 } }),
      text(X) {
        const { a, b, S, n } = X, k1 = S({ rb: 50000 });
        must(st(a, 'zustand') === 'saettigung' && st(b, 'zustand') === 'aktiv' && st(k1, 'zustand') === 'saettigung' && m(k1, 'ueb') > 1 && m(k1, 'ueb') < 1.05 && close(m(a, 'rbmax'), st(a, 'rbMax') / K, 1e-9) && m(b, 'pv') > m(a, 'pv') && close(m(b, 'ic'), g(b, 'b') * m(b, 'ib') / 1000, 1e-3), 'R_B,max gibt ü = 1; ü = 3 bei R_B,soll; 200 kΩ nur aktiv und mehr Verlust');
        return 'Für I_C,sat = ' + n('ics', st(a, 'icSat') * MA, 3) + ' mA und B = ' + n('b', g(a, 'b'), 0) + ' ist I_B,min = ' + n('ibm', m(a, 'ibmin'), 2) + ' µA. Der größte Basisvorwiderstand, bei dem der Transistor gerade noch sättigt, ist R_B,max = ' + n('rbm', m(a, 'rbmax'), 2) + ' kΩ (ü = 1). Bei ' +
          n('r1', g(k1, 'rb') / K, 0) + ' kΩ ist ü = ' + n('u1', m(k1, 'ueb'), 2) + ': gerade noch gesättigt, aber ohne Reserve (Streuung von B). Mit R_B,soll = ' + n('rbs', st(a, 'rbSoll') / K, 2) + ' kΩ wäre ü = ' + n('ut', lim('ue_typ'), 0) + ' (Vorschlag, Übungswert); der Prüfstand steht auf ' + n('r2', g(a, 'rb') / K, 0) + ' kΩ mit ü = ' + n('u2', m(a, 'ueb'), 2) +
          ' und P_V = ' + n('pv', m(a, 'pv'), 2) + ' mW. Vorher stand er auf ' + n('r3', g(b, 'rb') / K, 0) + ' kΩ: Dann fließen nur I_B = ' + n('ib3', m(b, 'ib'), 1) + ' µA, der Transistor ist nicht gesättigt, sondern nur aktiv (halb offen): I_C = B · I_B = ' + n('ic3', m(b, 'ic'), 2) + ' mA, U_CE = ' + n('uc3', m(b, 'uce'), 2) +
          ' V, und im Transistor entstehen ' + n('pv3', m(b, 'pv'), 2) + ' mW statt ' + n('pv2', m(a, 'pv'), 2) + ' mW.';
      } },
    { id: 'aex6', name: 'Relais mit Freilaufdiode', cat: 'Transistorschalter', rig: 'schalter',
      spec: () => ({ preset: 'mcu-relais', ref: { freilauf: false }, seq: [{ t: 0, fire: true }], dur: 5 }),
      text(X) {
        const { a, b, n } = X, C = CORE(), rel = C.tr.relais({ ub: g(a, 'ub'), rspule: g(a, 'rspule'), lspule: g(a, 'lspule'), freilauf: true });
        must(st(a, 'zustand') === 'saettigung' && close(st(a, 'tau'), g(a, 'lspule') / g(a, 'rspule'), 1e-9) && close(st(a, 'tAn90'), rel.tAn90, 1e-6) && close(st(a, 'ucePeak'), g(a, 'ub') + C.limit('ufd_freilauf').value, 1e-9) && st(b, 'ueberUceo') === true && st(a, 'ueberUceo') === false && close(st(b, 'ucePeak'), C.limit('uceo').value, 1e-9), 'τ = L/R, t_90 = τ·ln 10, Spitze mit Diode U_B + 0,7 V, ohne Diode U_CEO');
        return 'Das Relais (R = ' + n('r', g(a, 'rspule'), 0) + ' Ω, L = ' + n('l', g(a, 'lspule'), 1) + ' H) liegt an U_B = ' + n('ub', g(a, 'ub'), 0) + ' V und wird von einem 3,3-V-Signal über R_B = ' + n('rb', g(a, 'rb') / K, 1) + ' kΩ geschaltet (ü = ' + n('ueb', m(a, 'ueb'), 1) + ', gesättigt). Der Strom steigt mit der Zeitkonstante τ = L / R = ' + n('tau', m(a, 'tau'), 2) +
          ' ms und erreicht nach ' + n('t90', st(a, 'tAn90') * 1000, 3) + ' ms ' + n('p90', 90, 0) + ' % von I_C = ' + n('ic', m(a, 'ic'), 2) + ' mA. Beim Abschalten will die Spule den Strom weiterführen. Mit Freilaufdiode (U_FD = ' + n('ufd', C.limit('ufd_freilauf').value, 1) + ' V) fließt er über die Diode ab, die Spannung am Transistor erreicht nur U_B + U_FD = ' + n('up', st(a, 'ucePeak'), 1) +
          ' V, nach ' + n('ta', st(a, 'tAus') * 1000, 3) + ' ms ist der Strom null. Vorher (Diode weggelassen, nur Simulation) steigt die Spannung im Modell bis zur Durchbruchspannung U_CEO = ' + n('uceo', st(b, 'ucePeak'), 0) + ' V (Übungswert): Das ist ein Fehlerbild und für den Transistor gefährlich. Die Freilaufdiode schützt den Transistor vor der Selbstinduktionsspannung.';
      } },
    { id: 'aex7', name: 'Fehlersuche: Die Last bleibt aus', cat: 'Fehlersuche', rig: 'schalter',
      spec: () => ({ preset: 'mcu-relais', ctl: { fehler: 'rb offen' } }),
      text(X) {
        const { a, S, n } = X, ll = S({ fehler: 'last offen' }), cs = S({ fehler: 'ce schluss' }), ok = S({ fehler: 'keiner' });
        must(m(a, 'ic') < 0.001 && m(a, 'ib') < 0.001 && close(m(a, 'uce'), g(a, 'ub'), 1e-6) && m(ll, 'ic') < 0.001 && m(ll, 'ib') > 100 && close(m(ll, 'uce'), 0.2, 1e-6) && close(m(cs, 'uce'), 0, 1e-6) && m(cs, 'ic') > m(ok, 'ic') * 0.99, 'rb offen: I_B und I_C null, U_CE = U_B; Last offen: I_B normal, U_CE 0,2 V; ce schluss: U_CE 0, Last dauernd an');
        return 'Das Relais zieht nicht an. Miss I_B, I_C und U_CE und vergleiche, bevor du Bauteile verdächtigst. Fall 1 (hier eingestellt): I_B = ' + n('ib', m(a, 'ib'), 0) + ' µA, I_C = ' + n('ic', m(a, 'ic'), 0) + ' mA und U_CE = ' + n('uce', m(a, 'uce'), 1) + ' V, also gleich der Betriebsspannung: Es fließt kein Basisstrom, der Transistor sperrt. Die Unterbrechung liegt vor der Basis, hier im Basisvorwiderstand (Fehlerfall „rb offen“). ' +
          'Fall 2: I_B = ' + n('ib2', m(ll, 'ib'), 0) + ' µA fließt, der Transistor ist durchgesteuert (U_CE = ' + n('uce2', m(ll, 'uce'), 1) + ' V), aber I_C = ' + n('ic2', m(ll, 'ic'), 0) + ' mA: Die Last ist unterbrochen („last offen“). Fall 3: U_CE = ' + n('uce3', m(cs, 'uce'), 0) + ' V und I_C = ' + n('ic3', m(cs, 'ic'), 0) +
          ' mA, die Last ist dauernd an („ce schluss“, defekter Transistor). Messen, vergleichen, dann auf die Ursache schließen: Das ist die Reihenfolge der Fehlersuche. Fehlerbilder sind hier nur Simulation.';
      } },
    /* ---------------------------------------------------------------- Emitterschaltung */
    { id: 'aex8', name: 'Arbeitspunkt der Emitterschaltung', cat: 'Transistorverstärker', rig: 'emitter',
      spec: () => ({ preset: 'standard', ctl: { r2: 15000 }, ref: { r2: 10000 } }),
      text(X) {
        const { a, b, S, n } = X, C = CORE(), F = C.formulas, ub = g(b, 'ub'), r1 = g(b, 'r1'), r2 = g(b, 'r2'), re = g(b, 're1') + g(b, 're2'), ubb = F.ubb(ub, r1, r2), rbth = F.rbTh(r1, r2), ib = F.ibEmitter(ubb, 0.7, rbth, g(b, 'b'), re);
        must(close(st(b, 'ic'), F.icAusIb(g(b, 'b'), ib), 1e-6) && close(m(b, 'uce'), st(b, 'uce'), 1e-9) && st(b, 'zustand') === 'aktiv' && m(a, 'uce') < m(b, 'uce') && m(a, 'ic') > m(b, 'ic'), 'U_BB, R_B, I_B, I_C nach Tabellenbuch; größeres R_2 gibt größeres I_C und kleineres U_CE');
        return 'Der Basisspannungsteiler (R_1 = ' + n('r1', r1 / K, 0) + ' kΩ, R_2 = ' + n('r2', r2 / K, 0) + ' kΩ an U_B = ' + n('ub', ub, 0) + ' V) legt die Basis auf U_BB = U_B · R_2 / (R_1 + R_2) = ' + n('ubb', ubb, 3) + ' V, sein Ersatzwiderstand ist R_B = R_1 ∥ R_2 = ' + n('rb', rbth / K, 3) + ' kΩ. Mit R_E = R_E1 + R_E2 = ' + n('re', re, 0) +
          ' Ω und B = ' + n('b', g(b, 'b'), 0) + ' ist I_B = (U_BB − U_BE) / (R_B + (B + 1) · R_E) = ' + n('ib', ib * UA, 2) + ' µA, daraus I_C = B · I_B = ' + n('ic', m(b, 'ic'), 3) + ' mA und U_CE = U_B − I_C · R_C − I_E · R_E = ' + n('uce', m(b, 'uce'), 2) + ' V: etwa die halbe Betriebsspannung, der Arbeitspunkt liegt in der Mitte. ' +
          'Wird R_2 auf ' + n('r2b', g(a, 'r2') / K, 0) + ' kΩ vergrößert, hebt das die Basisspannung an: I_C steigt auf ' + n('ic2', m(a, 'ic'), 3) + ' mA, mehr Spannung fällt an R_C ab und U_CE sinkt auf ' + n('uce2', m(a, 'uce'), 2) + ' V; die Basis-Emitter-Spannung bleibt bei ' + n('ube', m(a, 'ube'), 1) + ' V.';
      } },
    { id: 'aex9', name: 'Spannungsverstärkung und Gegenkopplung', cat: 'Transistorverstärker', rig: 'emitter',
      spec: () => ({ preset: 'standard', ref: { ce: false } }),
      text(X) {
        const { a, b, S, n } = X, C = CORE(), un = S({ rl: 1e6 }), db = C.formulas.vDb(Math.abs(m(a, 'vu'))), ph = C.emit.ac({ ub: g(a, 'ub'), r1: g(a, 'r1'), r2: g(a, 'r2'), rc: g(a, 'rc'), re1: g(a, 're1'), re2: g(a, 're2'), ce: true, b: g(a, 'b'), rl: g(a, 'rl'), rg: g(a, 'rg') }).phase;
        must(m(a, 'vu') < -1 && close(Math.abs(ph), 180, 1e-9) && m(un, 'vu') < m(a, 'vu') && m(b, 'vu') < 0 && Math.abs(m(b, 'vu')) < Math.abs(m(a, 'vu')) && close(db, 20 * Math.log10(Math.abs(m(a, 'vu'))), 1e-9) && m(b, 'klirr') < m(a, 'klirr'), 'V_u negativ (180°), unbelastet größer als belastet, ohne C_E kleiner und weniger Klirren, a = 20 lg |V_u|');
        return 'Die Emitterschaltung verstärkt und dreht die Phase: V_u ist negativ, der Ausgang ist gegenüber dem Eingang um ' + n('ph', Math.abs(ph), 0) + '° gedreht. Mit überbrücktem Emitterwiderstand (C_E) ist V_u = ' + n('vu', m(a, 'vu'), 2) + ' bei R_L = ' + n('rl', g(a, 'rl') / K, 0) + ' kΩ, im Leerlauf (R_L sehr groß) ' + n('vul', m(un, 'vu'), 2) +
          '; die Last liegt parallel zu R_C, deshalb sinkt die Verstärkung. Das Verstärkungsmaß ist a = 20 · lg |V_u| = ' + n('a', db, 2) + ' dB. Ohne C_E (Emitterwiderstand ungebrückt) wirkt R_E als Gegenkopplung: V_u fällt auf ' + n('vug', m(b, 'vu'), 2) + '. Das ist weniger Verstärkung, dafür ist die Stufe unempfindlicher gegen Streuung von B und der Klirrfaktor sinkt.';
      } },
    { id: 'aex10', name: 'Aussteuerung, Klirren, Übersteuerung', cat: 'Transistorverstärker', rig: 'emitter',
      spec: () => ({ preset: 'uebersteuert' }),
      text(X) {
        const { a, S, n } = X, k5 = S({ ue: 0.005 }), k300 = S({ ue: 0.3 }), au = S({ r1: 27000, ue: 0.1 }), grenze = CORE().limit('klirr_grenze').value * 100;
        must(st(a, 'clip') === 'beide' && st(au, 'clip') === 'unten' && m(k5, 'klirr') < m(k300, 'klirr') && m(k300, 'klirr') > grenze && m(k5, 'klirr') < grenze && st(k300, 'clip') === '', 'Klirrfaktor wächst mit der Aussteuerung, Begrenzen beide Seiten bei 400 mV, nur unten bei zu kleinem R_1');
        return 'Bei kleiner Aussteuerung (U_e = ' + n('u1', g(k5, 'ue') * MV, 0) + ' mV) ist der Ausgang fast verzerrungsfrei: Klirrfaktor ' + n('k1', m(k5, 'klirr'), 3) + ' %. Bei ' + n('u2', g(k300, 'ue') * MV, 0) + ' mV sind es ' + n('k2', m(k300, 'klirr'), 2) + ' %, über der Meldegrenze von ' + n('kg', grenze, 0) + ' % (Übungswert); die Kennlinie des Transistors ist nicht linear. ' +
          'Bei ' + n('u3', g(a, 'ue') * MV, 0) + ' mV wird der Ausgang beidseitig begrenzt: oben bei etwa ' + n('ao', st(a, 'apOben'), 2) + ' V (der Transistor sperrt), unten bei etwa ' + n('au', st(a, 'apUnten'), 2) + ' V (der Transistor geht in die Sättigung); der Klirrfaktor steigt auf ' + n('k3', m(a, 'klirr'), 1) + ' %. ' +
          'Liegt der Arbeitspunkt falsch, begrenzt es früher und einseitig: Mit R_1 = ' + n('r1', g(au, 'r1') / K, 0) + ' kΩ ist U_CE nur ' + n('uc', m(au, 'uce'), 2) + ' V, und schon bei ' + n('u4', g(au, 'ue') * MV, 0) + ' mV wird die negative Halbwelle des Ausgangs abgeflacht (Sättigung), der Klirrfaktor beträgt ' + n('k4', m(au, 'klirr'), 1) + ' %.';
      } },
    { id: 'aex11', name: 'Ein- und Ausgangswiderstand, Koppelkondensator', cat: 'Transistorverstärker', rig: 'emitter',
      spec: () => ({ preset: 'standard' }),
      text(X) {
        const { a, S, n } = X, kl = S({ c1: 1e-6 });
        must(close(m(a, 'vus'), m(a, 'vu') * (m(a, 'rin') * K) / (m(a, 'rin') * K + g(a, 'rg')), 1e-6) && close(m(a, 'ra'), g(a, 'rc') / K, 1e-6) && m(kl, 'fu') > m(a, 'fu'), 'V_u,Quelle = V_u · r_ein/(r_ein + R_G), r_aus = R_C, kleineres C_1 hebt f_u an');
        return 'Die Stufe hat den Eingangswiderstand r_ein = R_1 ∥ R_2 ∥ r_in,T = ' + n('rin', m(a, 'rin'), 2) + ' kΩ (r_in,T ist der Eingangswiderstand am Transistor, er enthält r_BE = ' + n('rbe', m(a, 'rbe'), 3) + ' kΩ) und den Ausgangswiderstand r_aus = R_C = ' + n('ra', m(a, 'ra'), 1) + ' kΩ. Die Signalquelle mit R_G = ' + n('rg', g(a, 'rg'), 0) +
          ' Ω und r_ein bilden einen Spannungsteiler: Statt V_u = ' + n('vu', m(a, 'vu'), 2) + ' kommt nur ' + n('vus', m(a, 'vus'), 2) + ' bezogen auf die Quellenspannung an. Die Koppelkondensatoren sind Hochpässe: Mit C_1 = C_2 = ' + n('c1', g(a, 'c1') * 1e6, 0) + ' µF liegt die untere Grenzfrequenz bei f_u = ' + n('fu', m(a, 'fu'), 2) + ' Hz. Mit C_1 = ' + n('c1b', g(kl, 'c1') * 1e6, 0) + ' µF steigt sie auf ' + n('fu2', m(kl, 'fu'), 2) + ' Hz: Ein kleinerer Koppelkondensator schneidet tiefe Frequenzen früher ab.';
      } },
    { id: 'aex12', name: 'Fehlersuche: Arbeitspunkt verschoben', cat: 'Fehlersuche', rig: 'emitter',
      spec: () => ({ preset: 'standard', ctl: { fehler: 'r2 offen' } }),
      text(X) {
        const { a, S, n } = X, r1 = S({ fehler: 'r1 offen' }), ce = S({ fehler: 'ce offen' }), ok = S({ fehler: 'keiner' });
        must(st(a, 'zustand') === 'saettigung' && close(m(a, 'uce'), 0.2, 1e-6) && st(r1, 'zustand') === 'sperrt' && close(m(r1, 'uce'), g(r1, 'ub'), 1e-6) && st(ce, 'zustand') === 'aktiv' && Math.abs(m(ce, 'vu')) < Math.abs(m(ok, 'vu')) && close(m(ce, 'uce'), m(ok, 'uce'), 1e-6), 'r2 offen: Sättigung; r1 offen: Sperren; ce offen: Arbeitspunkt unverändert, V_u kleiner');
        return 'Die Stufe verstärkt nicht mehr richtig. Miss zuerst U_CE: Liegt sie nahe bei null, ist der Transistor in der Sättigung; liegt sie nahe bei U_B, sperrt er; liegt sie in der Mitte, stimmt der Arbeitspunkt. Fall 1 (hier eingestellt): U_CE = ' + n('u1', m(a, 'uce'), 1) + ' V bei I_C = ' + n('i1', m(a, 'ic'), 2) + ' mA, die Basis bekommt zu viel Spannung, weil der untere Teilerwiderstand fehlt (R_2 offen); es gibt keine Aussteuerung mehr. ' +
          'Fall 2: U_CE = ' + n('u2', m(r1, 'uce'), 1) + ' V und I_C = ' + n('i2', m(r1, 'ic'), 0) + ' mA, die Basis bekommt gar keinen Strom (R_1 offen), der Transistor sperrt. Fall 3: U_CE = ' + n('u3', m(ce, 'uce'), 2) + ' V ist unverändert, aber V_u beträgt nur ' + n('v3', m(ce, 'vu'), 2) + ' statt ' + n('v0', m(ok, 'vu'), 2) +
          ': Der Emitterkondensator fehlt (C_E offen), R_E wirkt als Gegenkopplung. Gleichspannungen verraten den Arbeitspunkt, die Verstärkung verrät die Wechselstromseite. Fehlerbilder sind hier nur Simulation.';
      } },
    /* ---------------------------------------------------------------- Kollektorschaltung, Z-Folger, Stromquelle */
    { id: 'aex13', name: 'Emitterfolger als Impedanzwandler', cat: 'Transistorverstärker', rig: 'folger',
      spec: () => ({ preset: 'emitterfolger' }),
      text(X) {
        const { a, n } = X, dir = st(a, 'direktAnteil');
        must(close(dir, g(a, 'rl') / (g(a, 'rg') + g(a, 'rl')), 1e-6) && close(m(a, 'direkt'), g(a, 'ue') * MV * dir, 1e-6) && m(a, 'mit') > m(a, 'direkt') && m(a, 'vu') < 1 && m(a, 'vu') > 0.9 && close(m(a, 'vus'), m(a, 'mit') / (g(a, 'ue') * MV), 1e-6) && close(m(a, 'vus'), m(a, 'vu') * m(a, 'rin') / (m(a, 'rin') + g(a, 'rg')), 1e-6), 'direkt = R_L/(R_G+R_L), mit Folger mehr, V_u knapp unter 1, Teiler r_ein/(r_ein+R_G)');
        return 'Eine hochohmige Quelle (R_G = ' + n('rg', g(a, 'rg') / K, 0) + ' kΩ) soll eine kleine Last (R_L = ' + n('rl', g(a, 'rl'), 0) + ' Ω) treiben. Direkt angeschlossen bildet R_G mit R_L einen Spannungsteiler: Nur der Anteil R_L / (R_G + R_L) = ' + n('d', dir, 4) + ' kommt an, von ' + n('ue', g(a, 'ue') * MV, 0) + ' mV bleiben ' + n('dm', m(a, 'direkt'), 2) +
          ' mV. Mit Emitterfolger (Kollektorschaltung) ist V_u = ' + n('vu', m(a, 'vu'), 4) + ': knapp unter 1, ohne Phasendrehung. Die Quelle sieht jetzt den Eingangswiderstand r_ein = ' + n('rin', m(a, 'rin') / K, 2) + ' kΩ statt der Last von ' + n('rl2', g(a, 'rl'), 0) + ' Ω; der Ausgangswiderstand des Folgers ist nur r_aus = ' + n('ro', m(a, 'rout'), 2) + ' Ω. Der Teiler r_ein / (r_ein + R_G) = ' + n('ta', m(a, 'rin') / (m(a, 'rin') + g(a, 'rg')), 4) + ' liefert zusammen mit V_u den Anteil ' + n('vs', m(a, 'vus'), 4) + ' an der Last: ' + n('mm', m(a, 'mit'), 2) + ' mV statt ' + n('dm2', m(a, 'direkt'), 2) +
          ' mV, das ist das ' + n('fk', m(a, 'mit') / m(a, 'direkt'), 1) + '-fache. Die Schaltung verstärkt die Spannung nicht, wohl aber die Leistung: Sie ist ein Impedanzwandler.';
      } },
    { id: 'aex14', name: 'Z-Diode am Folger', cat: 'Transistorverstärker', rig: 'folger',
      spec: () => ({ preset: 'z-folger' }),
      text(X) {
        const { a, n } = X, C = CORE(), zf = C.tr.zfolger({ ub: g(a, 'ub'), uz: g(a, 'uz'), ic: g(a, 'ic'), b: g(a, 'b'), iz: g(a, 'iz') });
        must(close(m(a, 'r1z'), zf.r1, 1e-9) && close(m(a, 'ues'), zf.ue, 1e-9) && close(st(a, 'ib'), g(a, 'ic') / g(a, 'b'), 1e-9) && close(zf.ue, g(a, 'uz') - 0.7, 1e-9), 'I_B = I_C/B, R_1 = (U_B − U_Z)/(I_Z + I_B), U_E = U_Z − U_BE');
        return 'Ein Transistor (B = ' + n('b', g(a, 'b'), 0) + ') arbeitet als Emitterfolger an U_B = ' + n('ub', g(a, 'ub'), 0) + ' V. Seine Basis hängt an einer Z-Diode (U_Z = ' + n('uz', g(a, 'uz'), 1) + ' V), die mit I_Z = ' + n('iz', g(a, 'iz') * MA, 0) + ' mA arbeiten soll; der Kollektorstrom ist I_C = ' + n('ic', g(a, 'ic') * MA, 0) + ' mA. Der Basisstrom beträgt I_B = I_C / B = ' + n('ib', st(a, 'ib') * MA, 0) +
          ' mA. Durch R_1 fließen I_Z + I_B = ' + n('i1', (g(a, 'iz') + st(a, 'ib')) * MA, 0) + ' mA bei ' + n('ur', g(a, 'ub') - g(a, 'uz'), 1) + ' V Spannung, also R_1 = (U_B − U_Z) / (I_Z + I_B) = ' + n('r1', m(a, 'r1z'), 0) + ' Ω. Die Emitterspannung liegt um U_BE unter der Z-Spannung: U_E = U_Z − U_BE = ' + n('ue', m(a, 'ues'), 1) +
          ' V, fast unabhängig von der Last. Wäre R_1 größer, bekäme die Z-Diode zu wenig Strom (sie verliert die Spannung), wäre R_1 zu klein, würde sie überlastet.';
      } },
    { id: 'aex15', name: 'Konstantstromquelle', cat: 'Transistorverstärker', rig: 'folger',
      spec: () => ({ preset: 'konstantstrom' }),
      text(X) {
        const { a, n } = X, C = CORE(), cs2 = C.tr.cs({ nd: 2, ud: 0.75, ube: 0.65, ic: 0.02 });
        must(close(m(a, 'reK'), C.tr.cs({ nd: g(a, 'nd'), ud: g(a, 'ud'), ube: 0.7, ic: g(a, 'ic') }).re, 1e-9) && close(st(a, 'ure'), g(a, 'nd') * g(a, 'ud') - 0.7, 1e-9) && close(cs2.re, 42.5, 1e-9), 'R_E = (n·U_D − U_BE)/I_C');
        return 'Drei Dioden in Reihe (je U_D = ' + n('ud', g(a, 'ud'), 1) + ' V) halten die Basis auf ' + n('ub', g(a, 'nd') * g(a, 'ud'), 1) + ' V über dem Bezugspotential. Abzüglich U_BE = ' + n('ube', 0.7, 1) + ' V bleiben am Emitterwiderstand U_RE = ' + n('ure', st(a, 'ure'), 1) + ' V. Für I_C = ' + n('ic', g(a, 'ic') * MA, 0) + ' mA braucht man R_E = (n · U_D − U_BE) / I_C = ' + n('re', m(a, 'reK'), 0) +
          ' Ω. Solange der Transistor aktiv bleibt, hängt der Strom im Lehrmodell (ohne Early-Effekt) nur von dieser Spannung und von R_E ab, nicht von der Last. Rechnest du mit zwei Dioden à ' + n('ud2', 0.75, 2) + ' V, U_BE = ' + n('ube2', 0.65, 2) + ' V und I_C = ' + n('ic2', 20, 0) + ' mA, ergibt sich R_E = ' + n('re2', cs2.re, 1) + ' Ω (nur gerechnet; der Prüfstand benutzt für U_BE immer ' + n('ube3', 0.7, 1) + ' V).';
      } },
    { id: 'aex16', name: 'Die drei Grundschaltungen im Vergleich', cat: 'Transistorverstärker', rig: 'folger',
      spec: () => ({ preset: 'vergleich' }),
      text(X) {
        const { a, S, n } = X, E = S({ schaltung: 'emitter' }), Kl = S({ schaltung: 'kollektor' }), Ba = S({ schaltung: 'basis' });
        must(m(E, 'vu') < 0 && m(Kl, 'vu') > 0.9 && m(Kl, 'vu') < 1 && m(Ba, 'vu') > 1 && close(m(E, 'vu'), m(a, 'vuE'), 1e-9) && close(m(Kl, 'vu'), m(a, 'vuK'), 1e-9) && close(m(Ba, 'vu'), m(a, 'vuB'), 1e-9) && m(Kl, 'rout') < m(E, 'rout') && m(Ba, 'rin') < m(E, 'rin'), 'Vorzeichen und Größenordnung der drei Verstärkungen, r_aus Kollektor am kleinsten, r_ein Basis am kleinsten');
        return 'Alle drei Grundschaltungen arbeiten hier mit demselben Arbeitspunkt (I_C = ' + n('ic', m(a, 'ic'), 3) + ' mA), einer Quelle mit R_G = ' + n('rg', g(a, 'rg'), 0) + ' Ω und der Last R_L = ' + n('rl', g(a, 'rl') / K, 0) + ' kΩ. Emitterschaltung (hier ohne Emitterkondensator): V_u = ' + n('ve', m(E, 'vu'), 2) + ' (negativ: Phase 180°), r_ein = ' + n('ie', m(E, 'rin') / K, 2) + ' kΩ, r_aus = ' + n('oe', m(E, 'rout') / K, 1) + ' kΩ. Kollektorschaltung: V_u = ' + n('vk', m(Kl, 'vu'), 4) +
          ' (knapp unter 1, 0°), r_ein = ' + n('ik', m(Kl, 'rin') / K, 2) + ' kΩ, r_aus = ' + n('ok', m(Kl, 'rout'), 2) + ' Ω. Basisschaltung: V_u = ' + n('vb', m(Ba, 'vu'), 1) + ' (gleichphasig), r_ein = ' + n('ib', m(Ba, 'rin'), 2) + ' Ω, r_aus = ' + n('ob', m(Ba, 'rout') / K, 1) + ' kΩ. Die Emitterschaltung verstärkt die Spannung und dreht die Phase, die Kollektorschaltung passt als Impedanzwandler den Widerstand an, die Basisschaltung hat einen sehr kleinen Eingangswiderstand und gehört zu den Spezialfällen; hier wird sie nur als Vergleich gerechnet.';
      } },
    /* ---------------------------------------------------------------- Operationsverstaerker: Invertierer und Summierer */
    { id: 'aex17', name: 'Invertierer mit V_u = −10', cat: 'OPV-Grundschaltungen', rig: 'opv_inv',
      spec: () => ({ preset: 'v-10' }),
      text(X) {
        const { a, n } = X, ph = lim('opv_inv_phase');
        must(close(m(a, 'v'), -g(a, 'rf') / g(a, 'r1'), 1e-9) && close(m(a, 'uaPeak'), Math.abs(m(a, 'v')) * g(a, 'ue'), 1e-9) && close(m(a, 'ri'), g(a, 'r1'), 1e-9) && ph === 180, 'V_u = −R_f/R_1, Amplitude = |V_u|·û, r_ein = R_1, Phase 180°');
        return 'Der invertierende Verstärker mit R_1 = ' + n('r1', g(a, 'r1') / K, 1) + ' kΩ und R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ hat die Spannungsverstärkung V_u = −R_f / R_1 = ' + n('v', m(a, 'v'), 0) + '. Eine Eingangsamplitude von ' + n('ue', g(a, 'ue'), 1) + ' V ergibt am Ausgang die Amplitude ' + n('ua', m(a, 'uaPeak'), 1) + ' V; das Minuszeichen heißt: Der Ausgang ist gegenüber dem Eingang um ' + n('ph', ph, 0) +
          '° gedreht. Durch die Gegenkopplung liegt der −Eingang auf dem „virtuellen Nullpunkt“ (er folgt dem +Eingang an Masse); deshalb ist der Eingangswiderstand der Schaltung r_ein = R_1 = ' + n('ri', m(a, 'ri') / K, 1) + ' kΩ. Beim idealen Operationsverstärker hängt die Verstärkung nur von den beiden Widerständen ab, nicht vom Verstärker selbst.';
      } },
    { id: 'aex18', name: 'Summierer', cat: 'OPV-Grundschaltungen', rig: 'opv_inv',
      spec: () => ({ preset: 'summierer' }),
      text(X) {
        const { a, n } = X, C = CORE(), sm = C.op.sum({ rf: g(a, 'rf'), r: [g(a, 'r1'), g(a, 'r2'), g(a, 'r3')], u: [g(a, 'ue'), g(a, 'ue2'), g(a, 'ue3')] });
        must(sm.ok && close(sm.ua, m(a, 'ua'), 1e-9) && close(m(a, 'ua'), -g(a, 'rf') * (g(a, 'ue') / g(a, 'r1') + g(a, 'ue2') / g(a, 'r2')), 1e-9), 'U_a = −R_f·Σ(U_k/R_k)');
        const i1 = g(a, 'ue') / g(a, 'r1'), i2 = g(a, 'ue2') / g(a, 'r2');
        return 'Zwei Gleichspannungen werden gewichtet addiert: U_1 = ' + n('u1', g(a, 'ue'), 1) + ' V an R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ und U_2 = ' + n('u2', g(a, 'ue2'), 1) + ' V an R_2 = ' + n('r2', g(a, 'r2') / K, 0) + ' kΩ. Die Eingangsströme fließen zum virtuellen Nullpunkt und müssen komplett durch R_f: I_1 = ' + n('i1', i1 * UA, 0) + ' µA, I_2 = ' + n('i2', i2 * UA, 0) +
          ' µA, zusammen ' + n('i', (i1 + i2) * UA, 0) + ' µA. Mit R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ ergibt sich U_a = −R_f · (U_1 / R_1 + U_2 / R_2) = ' + n('ua', m(a, 'ua'), 1) + ' V. Das Minuszeichen kommt vom invertierenden Eingang; jeder Zweig hat seine eigene Verstärkung −R_f / R_k, die Eingänge beeinflussen sich nicht.';
      } },
    { id: 'aex19', name: 'Aussteuergrenze', cat: 'OPV-Grundschaltungen', rig: 'opv_inv',
      spec: () => ({ preset: 'saettigung', ref: { ue: 1 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), dsat = C.deep.sat({ opv: 'ideal', uv: g(a, 'uv'), v: m(a, 'v') });
        must(st(a, 'sat') === 1 && st(b, 'sat') === 0 && close(m(a, 'ua'), -g(a, 'uv'), 1e-9) && close(m(b, 'ua'), m(b, 'v') * g(b, 'ue'), 1e-9) && close(dsat.ueMax, g(a, 'uv') / Math.abs(m(a, 'v')), 1e-9), 'U_e,max = U_sat/|V_u|, darüber Ausgang an der Grenze');
        return 'Ein Operationsverstärker mit ±' + n('uv', g(a, 'uv'), 0) + ' V Betriebsspannung kann am Ausgang höchstens die Aussteuergrenze U_sat erreichen (hier ideal: ' + n('us', st(a, 'usat'), 0) + ' V). Mit R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ und R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ ist V_u = ' + n('v', m(a, 'v'), 0) + ', also bleibt der Ausgang nur bis U_e,max = U_sat / |V_u| = ' + n('um', dsat.ueMax, 1) + ' V Eingangsspannung linear. ' +
          'Bei U_e = ' + n('ub', g(b, 'ue'), 0) + ' V (vorher) liegt U_a = ' + n('ua0', m(b, 'ua'), 0) + ' V noch im Bereich; bei U_e = ' + n('ue', g(a, 'ue'), 0) + ' V wären rechnerisch ' + n('ul', m(a, 'v') * g(a, 'ue'), 0) + ' V nötig, der Ausgang bleibt aber bei ' + n('ua', m(a, 'ua'), 0) + ' V stehen: Er ist begrenzt, die Schaltung verstärkt dann nicht mehr linear (Messgerät „Begrenzen“: ja).';
      } },
    { id: 'aex20', name: 'Fehlersuche: Rückkopplung unterbrochen', cat: 'Fehlersuche', rig: 'opv_inv',
      spec: () => ({ preset: 'v-10', ctl: { opv: 'langsam', fehler: 'rf offen' }, ref: { fehler: 'keiner' } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), a0 = lim('a0'), us = st(a, 'usat');
        must(st(a, 'sat') === 1 && st(b, 'sat') === 0 && close(m(b, 'v'), -g(b, 'rf') / g(b, 'r1'), 1e-3) && Math.abs(m(a, 'ua')) >= us - 1e-9 && a0 === 100000 && us / a0 < g(a, 'ue') / 100, 'Mit R_f offen ist die Verstärkung gleich der Leerlaufverstärkung, der Ausgang steht an der Grenze');
        return 'Der Ausgang steht fest an der Aussteuergrenze, obwohl am Eingang nur ' + n('ue', g(a, 'ue'), 1) + ' V anliegen. Vor dem Fehler war V_u = ' + n('v0', m(b, 'v'), 1) + ' und U_a = ' + n('ua0', m(b, 'ua'), 1) + ' V (Amplitude ' + n('up0', m(b, 'uaPeak'), 1) + ' V). Jetzt ist der Rückkopplungszweig unterbrochen (R_f offen): Es gibt keine Gegenkopplung mehr, der Operationsverstärker arbeitet als Komparator und verstärkt mit seiner Leerlaufverstärkung A₀ = ' + n('a0', a0, 0) +
          '. Schon eine Eingangsspannung von U_sat / A₀ = ' + n('ue0', us / a0 * MV, 3) + ' mV reicht, um den Ausgang auf die Grenze von ' + n('us', us, 1) + ' V zu treiben; bei ' + n('ue2', g(a, 'ue'), 1) + ' V ist er immer begrenzt (Messgerät „Begrenzen“: ja). Merke: Ohne Gegenkopplung bleibt die Verstärkung nicht mehr durch R_f / R_1 festgelegt. Fehlerbild nur Simulation.';
      } },
    /* ---------------------------------------------------------------- Operationsverstaerker: nichtinvertierend, Folger, Differenz */
    { id: 'aex21', name: 'Nichtinvertierender Verstärker', cat: 'OPV-Grundschaltungen', rig: 'opv_nin',
      spec: () => ({ preset: 'v-5-7' }),
      text(X) {
        const { a, n } = X;
        must(close(m(a, 'v'), 1 + g(a, 'rf') / g(a, 'rg'), 1e-9) && close(m(a, 'ua'), m(a, 'v') * g(a, 'ue'), 1e-9) && m(a, 'v') >= 1 && close(m(a, 'ri'), 1e12, 1e-9), 'V_u = 1 + R_f/R_g, U_a = V_u·U_e, nie unter 1');
        return 'Beim nichtinvertierenden Verstärker liegt das Eingangssignal am +Eingang. Mit R_g = ' + n('rg', g(a, 'rg') / K, 0) + ' kΩ und R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ ist V_u = 1 + R_f / R_g = ' + n('v', m(a, 'v'), 1) + '. Bei U_e = ' + n('ue', g(a, 'ue'), 2) + ' V ergibt das U_a = V_u · U_e = ' + n('ua', m(a, 'ua'), 3) +
          ' V, ohne Phasendrehung (gleichphasig). Die Verstärkung kann nie kleiner als 1 werden, denn der Summand 1 steht immer da: Ist R_f = 0 oder R_g offen, bleibt V_u = 1 (Spannungsfolger). Der Eingangswiderstand ist beim idealen Operationsverstärker sehr groß (Anzeige ∞); die Quelle wird kaum belastet.';
      } },
    { id: 'aex22', name: 'Spannungsfolger', cat: 'OPV-Grundschaltungen', rig: 'opv_nin',
      spec: () => ({ preset: 'folger', ctl: { opv: 'langsam' }, ref: { opv: 'ideal' } }),
      text(X) {
        const { a, b, n } = X, C = CORE();
        must(close(m(b, 'v'), 1, 1e-12) && m(a, 'v') < 1 && m(a, 'v') > 0.9999 && close(m(a, 'fg') / 1e6, C.limit('gbw_langsam').value / 1e6, 1e-3) && m(a, 'ri') > 1e10 && close(m(b, 'ri'), 1e12, 1e-9), 'Folger: V_u = 1 (ideal), real 0,99999 und f_g ≈ GBW');
        return 'Der Spannungsfolger ist ein nichtinvertierender Verstärker ohne Widerstände: Der Ausgang ist direkt auf den −Eingang zurückgeführt, V_u = 1 (idealer Operationsverstärker). Er verstärkt die Spannung nicht, wandelt aber die Widerstände (Impedanzwandler): Der Eingangswiderstand ist sehr groß (ideal: ∞), der Ausgangswiderstand sehr klein. Mit dem Lehrmodell „langsam“ (Übungswerte) ist V_u = ' + n('v', m(a, 'v'), 5) +
          ' (die endliche Leerlaufverstärkung A₀ = ' + n('a0', lim('a0'), 0) + ' macht den Fehler), die Grenzfrequenz ist f_g = ' + n('fg', m(a, 'fg') / 1e6, 5) + ' MHz = GBW, weil die Gegenkopplung hier die Verstärkung 1 hat (V_n = 1), und der Eingangswiderstand liegt noch bei ' + n('ri', m(a, 'ri') / 1e9, 0) + ' GΩ.';
      } },
    { id: 'aex23', name: 'Differenzverstärker', cat: 'OPV-Grundschaltungen', rig: 'opv_nin',
      spec: () => ({ preset: 'differenz', ref: { r4: 50000 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), d = C.op.diff({ r1: g(a, 'r1'), r2: g(a, 'r2'), r3: g(a, 'r3'), r4: g(a, 'r4'), u1: g(a, 'u1'), u2: g(a, 'u2') });
        must(d.ok && close(d.ua, m(a, 'ua'), 1e-9) && close(m(a, 'vgl'), 0, 1e-9 + 1e-9) && Math.abs(m(b, 'vgl')) > 0.04 && close(m(a, 'ua'), m(a, 'a2') * (g(a, 'u2') - g(a, 'u1')), 1e-9), 'U_a = V_u·(U_2 − U_1) bei R_4/R_2 = R_3/R_1, verstimmt Gleichtaktverstärkung ungleich null');
        return 'Der Differenzverstärker verstärkt die Differenz der Eingänge: U_1 = ' + n('u1', g(a, 'u1'), 1) + ' V an R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ (zum −Eingang), U_2 = ' + n('u2', g(a, 'u2'), 1) + ' V an R_2 = ' + n('r2', g(a, 'r2') / K, 0) + ' kΩ (zum +Eingang), R_3 = ' + n('r3', g(a, 'r3') / K, 0) + ' kΩ als Rückkopplung und R_4 = ' + n('r4', g(a, 'r4') / K, 0) + ' kΩ nach Masse. ' +
          'U_a = U_2 · R_4 / (R_2 + R_4) · (1 + R_3 / R_1) − U_1 · R_3 / R_1 = ' + n('ua', m(a, 'ua'), 2) + ' V. Bei abgeglichenen Widerständen (R_4 / R_2 = R_3 / R_1) ist U_a = V_u · (U_2 − U_1) mit V_u = ' + n('v', m(a, 'a2'), 1) + ', und die Gleichtaktverstärkung ist ' + n('vg', m(a, 'vgl'), 0) + '. Mit R_4 = ' + n('r4b', g(b, 'r4') / K, 0) + ' kΩ (verstimmt) wird sie ' + n('vg2', m(b, 'vgl'), 2) +
          ': Gleiche Spannungen an beiden Eingängen erscheinen dann teilweise am Ausgang. Deshalb braucht der Differenzverstärker genau passende Widerstandspaare.';
      } },
    { id: 'aex24', name: 'Fehlersuche: R_g offen oder negative Versorgung fehlt', cat: 'Fehlersuche', rig: 'opv_nin',
      spec: () => ({ preset: 'v-5-7', ctl: { fehler: 'rg offen' }, ref: { fehler: 'keiner' } }),
      text(X) {
        const { a, b, S, n } = X, vm = S({ fehler: 'versorgung minus fehlt', ue: -0.25 }), ok = S({ fehler: 'keiner', ue: -0.25 });
        must(close(m(a, 'v'), 1, 1e-9) && close(m(a, 'ua'), g(a, 'ue'), 1e-9) && m(b, 'v') > 5 && close(m(vm, 'ua'), 0, 1e-9) && m(ok, 'ua') < -1 && st(vm, 'usatN') === 0, 'R_g offen: V_u = 1; negative Versorgung fehlt: Ausgang nie negativ');
        return 'Der Verstärker liefert zu wenig. Fall 1 (hier eingestellt): Statt V_u = ' + n('v0', m(b, 'v'), 1) + ' misst du V_u = ' + n('v', m(a, 'v'), 0) + ', der Ausgang folgt dem Eingang (' + n('ua', m(a, 'ua'), 2) + ' V statt ' + n('ua0', m(b, 'ua'), 3) + ' V). Das passt zu einem offenen R_g: Ohne den Zweig nach Masse bleibt nur die Gegenkopplung über R_f, die Schaltung arbeitet als Spannungsfolger. ' +
          'Fall 2: Der Verstärker arbeitet bei positiver Eingangsspannung richtig, aber bei U_e = ' + n('ue2', g(vm, 'ue'), 2) + ' V bleibt der Ausgang bei ' + n('ua2', m(vm, 'ua'), 0) + ' V, obwohl rechnerisch ' + n('ul', m(ok, 'ua'), 3) + ' V nötig wären: Die negative Versorgung fehlt, der Ausgang kann nicht unter 0 V gehen (Einfachversorgung). Beide Fehler zeigen sich nur an bestimmten Messpunkten: Prüfe V_u und beide Vorzeichen des Eingangs. Fehlerbilder nur Simulation.';
      } },
    /* ---------------------------------------------------------------- Komparator, Schmitt-Trigger, Rechteckgenerator */
    { id: 'aex25', name: 'Komparator ohne Gegenkopplung', cat: 'Komparator und Schmitt-Trigger', rig: 'opv_komp',
      spec: () => ({ preset: 'komparator', ctl: { uref: 2.5, uoff: 3, ue: 0.1 }, ref: { uoff: 1.8 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), hoch = C.komp.comparator({ up: g(a, 'uoff'), un: g(a, 'uref') }), tief = C.komp.comparator({ up: g(b, 'uoff'), un: g(b, 'uref') });
        must(hoch.ok && tief.ok && close(m(a, 'ua'), hoch.ua, 1e-9) && close(m(b, 'ua'), tief.ua, 1e-9) && hoch.ua > 0 && tief.ua < 0 && close(m(a, 'uo'), g(a, 'uref'), 1e-9) && close(m(a, 'uu'), g(a, 'uref'), 1e-9) && close(m(a, 'uh'), 0, 1e-9 + 1e-12), 'Ausgang +U_sat über, −U_sat unter der Bezugsspannung, Schwellen gleich, Hysterese null');
        return 'Ohne Gegenkopplung verstärkt der Operationsverstärker die Differenz seiner Eingänge mit der Leerlaufverstärkung (' + n('a0', lim('a0'), 0) + '): Schon eine winzige Differenz (U_sat / A₀ = ' + n('d0', st(a, 'usat') / lim('a0') * MV, 2) + ' mV) reicht, und der Ausgang steht an der Aussteuergrenze. Er arbeitet als Komparator. Hier liegt die Bezugsspannung U_ref = ' + n('ur', g(a, 'uref'), 1) + ' V am −Eingang, das Eingangssignal am +Eingang (Konvention des Prüfstands). ' +
          'Ein Eingangssignal um ' + n('ue1', g(a, 'uoff'), 1) + ' V (über der Bezugsspannung) ergibt U_a = ' + n('ua1', m(a, 'ua'), 0) + ' V; um ' + n('ue2', g(b, 'uoff'), 1) + ' V (darunter) ergibt es U_a = ' + n('ua2', m(b, 'ua'), 0) + ' V. Die Schaltschwelle ist U_ref, die Hysterese ist ' + n('uh', m(a, 'uh'), 0) + ' V: Liegt das Signal nahe an der Schwelle, kann Rauschen den Ausgang mehrfach kippen lassen. Dagegen hilft die Mitkopplung des Schmitt-Triggers.';
      } },
    { id: 'aex26', name: 'Invertierender Schmitt-Trigger', cat: 'Komparator und Schmitt-Trigger', rig: 'opv_komp',
      spec: () => ({ preset: 'schmitt-inv', seq: [{ t: 0, fire: true }], dur: 8 }),
      text(X) {
        const { a, S, n } = X, C = CORE(), v3 = S({ uref: 3 }), us = st(a, 'usat'), f = C.formulas.schmittInv(us, g(a, 'r2'), g(a, 'r3'));
        must(close(m(a, 'uo'), f, 1e-9) && close(m(a, 'uu'), -f, 1e-9) && close(m(a, 'uh'), 2 * f, 1e-9) && close(m(v3, 'uo'), 6, 1e-9) && close(m(v3, 'uu'), -2, 1e-9), 'U_o = U_sat·R_3/(R_2 + R_3), symmetrisch, mit U_ref verschoben');
        return 'Beim invertierenden Schmitt-Trigger liegt das Eingangssignal am −Eingang, die Mitkopplung führt einen Teil des Ausgangs über R_2 auf den +Eingang (R_3 liegt an der Bezugsspannung). Mit R_2 = ' + n('r2', g(a, 'r2') / K, 0) + ' kΩ, R_3 = ' + n('r3', g(a, 'r3') / K, 0) + ' kΩ und U_sat = ' + n('us', us, 0) + ' V ist die obere Schaltschwelle U_o = U_sat · R_3 / (R_2 + R_3) = ' + n('uo', m(a, 'uo'), 1) +
          ' V und die untere U_u = ' + n('uu', m(a, 'uu'), 1) + ' V; die Hysterese ist U_H = U_o − U_u = ' + n('uh', m(a, 'uh'), 1) + ' V. Steigt U_e über U_o, kippt der Ausgang auf −U_sat; erst wenn U_e unter U_u fällt, kippt er zurück auf +U_sat. Mit U_ref = ' + n('ur', g(v3, 'uref'), 0) + ' V verschieben sich beide Schwellen um denselben Betrag: U_o = ' + n('uo3', m(v3, 'uo'), 0) + ' V und U_u = ' + n('uu3', m(v3, 'uu'), 0) +
          ' V, die Hysterese bleibt ' + n('uh3', m(v3, 'uh'), 0) + ' V. Der „Eingangsdurchlauf“ zeichnet die Hysterese-Schleife: Die Kippstellen liegen je nach Richtung an verschiedenen Eingangsspannungen.';
      } },
    { id: 'aex27', name: 'Nichtinvertierender Schmitt-Trigger', cat: 'Komparator und Schmitt-Trigger', rig: 'opv_komp',
      spec: () => ({ preset: 'schmitt-nin' }),
      text(X) {
        const { a, n } = X, C = CORE(), us = st(a, 'usat'), f = C.formulas.schmittNin(us, g(a, 'r1'), g(a, 'r2'));
        must(close(m(a, 'uo'), f, 1e-9) && close(m(a, 'uu'), -f, 1e-9) && close(m(a, 'uh'), 2 * f, 1e-9), 'U_o = U_sat·R_1/R_2 (U_ref = 0), symmetrisch');
        return 'Beim nichtinvertierenden Schmitt-Trigger liegt das Eingangssignal über R_1 am +Eingang, die Mitkopplung über R_2 vom Ausgang ebenfalls; der −Eingang liegt an der Bezugsspannung (hier ' + n('ur', g(a, 'uref'), 0) + ' V). Mit R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ, R_2 = ' + n('r2', g(a, 'r2') / K, 0) + ' kΩ und U_sat = ' + n('us', us, 0) +
          ' V kippt der Ausgang bei U_o = U_sat · R_1 / R_2 = ' + n('uo', m(a, 'uo'), 3) + ' V nach oben und bei U_u = ' + n('uu', m(a, 'uu'), 3) + ' V nach unten; die Hysterese ist U_H = ' + n('uh', m(a, 'uh'), 3) + ' V. Anders als beim invertierenden Schmitt-Trigger folgt der Ausgang dem Eingang gleichsinnig: Steigt U_e über U_o, geht der Ausgang auf +U_sat. ' +
          'Eine größere Hysterese macht die Schaltung unempfindlicher gegen Rauschen, verschiebt aber die Schaltpunkte weiter auseinander.';
      } },
    { id: 'aex28', name: 'Rechteckgenerator', cat: 'Komparator und Schmitt-Trigger', rig: 'opv_komp',
      spec: () => ({ preset: 'rechteck', ref: { c: 2e-7 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), o = C.komp.osc({ r: g(a, 'rt'), c: g(a, 'c'), r2: g(a, 'r2'), r3: g(a, 'r3'), uv: g(a, 'uv') }), beta = g(a, 'r3') / (g(a, 'r2') + g(a, 'r3'));
        must(o.ok && o.valid && close(m(a, 'T') / 1000, o.T, 1e-9) && close(m(a, 'fosz'), o.f, 1e-9) && close(o.T, 2 * g(a, 'rt') * g(a, 'c') * Math.log((1 + beta) / (1 - beta)), 1e-9) && close(m(b, 'T'), 2 * m(a, 'T'), 1e-6) && close(m(a, 'tastgrad'), 50, 1e-9), 'T = 2·R·C·ln((1+β)/(1−β)); doppeltes C gibt doppelte Periode');
        return 'Der Rechteckgenerator ist ein invertierender Schmitt-Trigger, dessen Ausgang über R = ' + n('r', g(a, 'rt') / K, 0) + ' kΩ den Kondensator C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF lädt. Mit R_2 = R_3 = ' + n('r2', g(a, 'r2') / K, 0) + ' kΩ ist β = R_3 / (R_2 + R_3) = ' + n('be', beta, 1) + '; die Schwellen sind U_o = ' + n('uo', m(a, 'uo'), 1) + ' V und U_u = ' + n('uu', m(a, 'uu'), 1) +
          ' V. Der Kondensator pendelt zwischen diesen Schwellen mit τ = R · C = ' + n('tau', g(a, 'rt') * g(a, 'c') * 1000, 1) + ' ms. Die Periodendauer ist T = 2 · R · C · ln((1 + β) / (1 − β)) = ' + n('t', m(a, 'T'), 3) + ' ms, also f = ' + n('f', m(a, 'fosz'), 1) + ' Hz bei einem Tastgrad von ' + n('tg', m(a, 'tastgrad'), 0) + ' %. Mit dem doppelten C (' + n('c2', g(b, 'c') * 1e9, 0) +
          ' nF) wird die Periode doppelt so lang: T = ' + n('t2', m(b, 'T'), 3) + ' ms. In der Anzeige läuft der Verlauf verlangsamt, damit nichts über 3 Hz flackert.';
      } },
    /* ---------------------------------------------------------------- Integrierer, Differenzierer, Filter, realer OPV */
    { id: 'aex29', name: 'Integrierer', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'integrierer', seq: [{ t: 0, fire: true }], dur: 6 }),
      text(X) {
        const { a, S, n } = X, C = CORE(), rect = S({ form: 'rechteck', f: 5 }), real = S({ opv: 'langsam' }), sl = C.formulas.slopeInt(g(a, 'ue'), g(a, 'r1'), g(a, 'c'));
        must(close(m(a, 'slope'), sl, 1e-9) && close(m(a, 'tau') / 1000, g(a, 'r1') * g(a, 'c'), 1e-9) && close(m(a, 'tsat'), st(a, 'usat') / Math.abs(sl), 1e-9) && close(m(rect, 'uaPeak'), Math.abs(sl) * 0.5 / g(rect, 'f'), 1e-6) && close(m(real, 'tsat'), 10.5 / Math.abs(sl), 1e-9), 'Steigung −U_e/(R·C), t_sat = U_sat/|Steigung|, Rechteck gibt eine Dreieckänderung je Halbperiode');
        return 'Der Integrierer summiert die Eingangsspannung über der Zeit auf: U_a = −(1 / (R · C)) · ∫U_e dt. Mit R = ' + n('r', g(a, 'r1') / K, 0) + ' kΩ und C = ' + n('c', g(a, 'c') * 1e6, 0) + ' µF ist τ = R · C = ' + n('tau', m(a, 'tau'), 0) + ' ms. Eine konstante Eingangsspannung von ' + n('ue', g(a, 'ue'), 0) + ' V lässt den Ausgang mit der Steigung −U_e / (R · C) = ' + n('sl', m(a, 'slope'), 0) +
          ' V/s fallen, bis er an die Aussteuergrenze stößt: Bei ±' + n('us', st(a, 'usat'), 0) + ' V (ideal) ist das nach t_sat = ' + n('ts', m(a, 'tsat'), 1) + ' s erreicht, mit dem realen Lehrmodell (U_sat = ' + n('us2', st(real, 'usat'), 1) + ' V) nach ' + n('ts2', m(real, 'tsat'), 3) + ' s. Ein Rechtecksignal (±' + n('ue2', g(rect, 'ue'), 0) + ' V, ' + n('f', g(rect, 'f'), 0) + ' Hz) wird zum Dreieck: Der Ausgang ändert sich in jeder Halbperiode um ' + n('du', m(rect, 'uaPeak'), 1) +
          ' V. Im Frequenzbereich fällt |V| um 20 dB je Dekade; bei f = 1 / (2π · R · C) = ' + n('fr', 1 / (2 * Math.PI * g(a, 'r1') * g(a, 'c')), 2) + ' Hz ist der Betrag 1. Der Start (Taste) entlädt den Kondensator und lässt den Ausgang loslaufen.';
      } },
    { id: 'aex30', name: 'Differenzierer', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'differenzierer' }),
      text(X) {
        const { a, S, n } = X, C = CORE(), rect = S({ form: 'rechteck' }), d = C.act.differentiator({ rf: g(a, 'rf'), c: g(a, 'c'), rs: g(a, 'rs'), f: g(a, 'f') });
        must(d.ok && close(m(a, 'tau') / 1000, d.tau, 1e-9) && close(m(a, 'fg'), d.fgRs, 1e-9) && close(m(a, 'hf'), d.vf, 1e-6) && close(m(a, 'uaPeak'), g(a, 'rf') * g(a, 'c') * 4 * g(a, 'ue') * g(a, 'f'), 1e-3) && st(rect, 'begrenzt') === true && st(a, 'begrenzt') === false, 'U_a = −R_f·C·dU_e/dt: Dreieck gibt Rechteck mit R_f·C·Steigung; Rechteck gibt Nadeln, die begrenzt werden');
        return 'Der Differenzierer liefert die Änderungsgeschwindigkeit des Eingangs: U_a = −R_f · C · dU_e / dt. Mit R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ und C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF ist τ = R_f · C = ' + n('tau', m(a, 'tau'), 0) + ' ms. Ein Dreiecksignal (Amplitude ' + n('ue', g(a, 'ue'), 0) + ' V, ' + n('f', g(a, 'f'), 0) + ' Hz) hat die konstante Steigung ' + n('st', 4 * g(a, 'ue') * g(a, 'f'), 0) +
          ' V/s und wird zum Rechteck mit der Amplitude ' + n('up', m(a, 'uaPeak'), 1) + ' V. Ein Rechtecksignal dagegen hat in den Flanken sehr große Steigungen: Der Ausgang zeigt Nadelimpulse, die hier an der Aussteuergrenze von ' + n('us', st(rect, 'uaPeak'), 0) + ' V abgeschnitten werden. Der Serienwiderstand R_s = ' + n('rs', g(a, 'rs'), 0) + ' Ω am Eingang begrenzt die Verstärkung bei hohen Frequenzen oberhalb von f = 1 / (2π · R_s · C) = ' + n('fg', m(a, 'fg') / K, 2) +
          ' kHz; bei ' + n('f2', g(a, 'f'), 0) + ' Hz ist |V| = ' + n('v', m(a, 'hf'), 4) + '. Differenzierer verstärken Rauschen besonders stark: Der Betrag wächst mit 20 dB je Dekade.';
      } },
    { id: 'aex31', name: 'Aktiver Tiefpass', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'tp-1khz' }),
      text(X) {
        const { a, n } = X, C = CORE(), t = C.act.tp({ r1: g(a, 'r1'), rf: g(a, 'rf'), cf: g(a, 'c') });
        must(t.ok && close(m(a, 'v'), t.v0, 1e-9) && close(m(a, 'fg'), t.fg, 1e-9) && close(m(a, 'hf'), Math.abs(t.v0) / Math.sqrt(1 + Math.pow(g(a, 'f') / t.fg, 2)), 1e-3), 'V_0 = −R_f/R_1, f_g = 1/(2π·R_f·C_f), |V| = |V_0|/√(1+(f/f_g)²)');
        return 'Der aktive Tiefpass erster Ordnung ist ein Invertierer mit einem Kondensator C_f parallel zu R_f. Im Durchlassbereich gilt V_0 = −R_f / R_1 = ' + n('v0', m(a, 'v'), 0) + ' (R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ, R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ). Der Kondensator wirkt bei hohen Frequenzen wie ein Kurzschluss und senkt die Verstärkung: Die Grenzfrequenz ist f_g = 1 / (2π · R_f · C_f) = ' + n('fg', m(a, 'fg'), 1) +
          ' Hz mit C_f = ' + n('c', g(a, 'c') * 1e9, 2) + ' nF. Bei f = ' + n('f', g(a, 'f'), 0) + ' Hz, also nahe f_g, beträgt |V| = ' + n('h', m(a, 'hf'), 2) + ' statt ' + n('v1', Math.abs(m(a, 'v')), 0) + ': Das ist der Faktor 1 / √2, also −3 dB. Oberhalb von f_g fällt der Betrag mit 20 dB je Dekade. Die Phase des Invertierers (180°) wird dabei zusätzlich um bis zu ' + n('d90', 90, 0) + '° verschoben.';
      } },
    { id: 'aex32', name: 'Vertiefung: Bode-Diagramm und GBW', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'real-gbw' }),
      text(X) {
        const { a, n } = X, C = CORE(), bd = C.deep.bode({ art: 'inv', r1: g(a, 'r1'), rf: g(a, 'rf'), opv: gs(a, 'opv') }), fq = C.op.freq({ art: 'inv', r1: g(a, 'r1'), rf: g(a, 'rf'), opv: gs(a, 'opv') }, [m(a, 'fg')]);
        must(bd.ok && bd.valid && close(bd.fg, m(a, 'fg'), 1e-9) && close(bd.fA, 10, 1e-9) && close(bd.gbw, lim('gbw_langsam'), 1e-9) && bd.abwNaeh < 0.001 && close(m(a, 'hf'), Math.abs(m(a, 'v')) / Math.SQRT2, 2e-3) && close(fq.phi[0], 135, 1e-3), 'f_A = GBW/A₀, f_g exakt und Näherung GBW/V_n, bei f_g −3 dB und 45° Phasenverschiebung');
        return 'Ein realer Operationsverstärker (Lehrmodell „langsam“, Übungswerte) hat nur eine endliche Leerlaufverstärkung A₀ = ' + n('a0', bd.a0, 0) + ' und das Verstärkungs-Bandbreite-Produkt GBW = ' + n('gbw', bd.gbw / 1e6, 0) + ' MHz. Im Leerlauf fällt die Verstärkung ab f_A = GBW / A₀ = ' + n('fa', bd.fA, 0) + ' Hz mit −20 dB je Dekade. Mit Gegenkopplung (R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ, R_f = ' + n('rf', g(a, 'rf') / K, 0) +
          ' kΩ) ist V_n = 1 + R_f / R_1 = ' + n('vn', bd.vn, 0) + ' (die Verstärkung der Schleife, nicht |V_u| = ' + n('vu', Math.abs(bd.v0), 0) + ') und die Grenzfrequenz f_g = ' + n('fg', bd.fg / K, 2) + ' kHz; die Näherung GBW / V_n = ' + n('fgn', bd.fgNaeh / K, 2) + ' kHz liegt nur ' + n('abw', bd.abwNaeh * 100, 3) + ' % daneben. Bei f_g ist |V| auf ' + n('h', m(a, 'hf'), 2) + ' gefallen (−3 dB) und die Phase um ' + n('ph', 180 - fq.phi[0], 0) +
          '° verschoben. Merke: Je größer die Verstärkung der Stufe, desto kleiner die Bandbreite; das Produkt V_n · f_g bleibt etwa GBW.';
      } },
    { id: 'aex33', name: 'Vertiefung: Slew-Rate', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'real-slew' }),
      text(X) {
        const { a, S, n } = X, C = CORE(), sl = C.deep.slew({ opv: gs(a, 'opv'), uhat: 10, f: g(a, 'f') }), fast = S({ opv: 'schnell' });
        must(sl.ok && st(a, 'slewBegrenzt') === true && st(fast, 'slewBegrenzt') === false && close(sl.fpb, 7957.747154594767, 1e-6) && m(a, 'uaPeak') < m(a, 'hf') * g(a, 'ue') && close(m(fast, 'uaPeak'), m(fast, 'hf') * g(fast, 'ue'), 5e-3), 'f_max = SR/(2π·û) für û = 10 V; mit langsam begrenzt die Slew-Rate, mit schnell nicht');
        return 'Die Slew-Rate SR (hier ' + n('sr', lim('sr_langsam') / 1e6, 1) + ' V/µs, Übungswert) ist die größte Anstiegsgeschwindigkeit des Ausgangs. Ein Sinus mit der Amplitude û und der Frequenz f braucht SR ≥ 2π · f · û. Für û = ' + n('uh', 10, 0) + ' V ergibt das die Vollaussteuerungsbandbreite f_max = SR / (2π · û) = ' + n('fm', sl.fpb / K, 2) + ' kHz; bei f = ' + n('f', g(a, 'f') / K, 0) + ' kHz ist nur û_max = SR / (2π · f) = ' + n('um', sl.uhatMax, 2) +
          ' V möglich. Der Invertierer mit R_1 = ' + n('r1', g(a, 'r1') / K, 0) + ' kΩ und R_f = ' + n('rf', g(a, 'rf') / K, 0) + ' kΩ (V_u = ' + n('v', m(a, 'v'), 2) + ') und U_e = ' + n('ue', g(a, 'ue'), 0) + ' V bei ' + n('f2', g(a, 'f') / K, 0) + ' kHz sollte nach dem Frequenzgang ' + n('u1', m(a, 'hf') * g(a, 'ue'), 2) + ' V Amplitude liefern, erreicht wegen der Slew-Rate aber nur ' + n('u2', m(a, 'uaPeak'), 2) +
          ' V: Die Sinuskurve verformt sich zum Dreieck, weil der Ausgang nicht schneller als mit der Slew-Rate steigen kann. Mit dem Lehrmodell „schnell“ (' + n('sr2', lim('sr_schnell') / 1e6, 0) + ' V/µs) bleibt der Verlauf unbegrenzt, die Amplitude beträgt ' + n('u3', m(fast, 'uaPeak'), 2) + ' V.';
      } },
    { id: 'aex34', name: 'Vertiefung: Offsetspannung und Sättigung', cat: 'Aktive Schaltungen', rig: 'opv_aktiv',
      spec: () => ({ preset: 'offset-drift' }),
      text(X) {
        const { a, S, n } = X, C = CORE(), re = S({ schaltung: 'real', r1: 1000, rf: 100000 }), rp = S({ rf: 1e6 }), ig = C.act.integrator({ r: g(a, 'r1'), c: g(a, 'c'), ue: 0, f: g(a, 'f'), uv: g(a, 'uv'), opv: gs(a, 'opv') }), off = C.deep.offset({ opv: 'langsam', rf: 1e5, r1: 1e3 });
        must(ig.ok && close(m(a, 'tsat'), ig.tSatOff, 1e-9) && close(m(re, 'uosOut') / 1000, off.uaOff, 1e-9) && close(m(rp, 'uosOut'), 22, 1e-9) && st(rp, 'hatRp') === true && close(m(a, 'tsat'), st(a, 'usat') / ig.drift, 1e-6), 'U_a,off = U_os·(1 + R_f/R_1); Integrierer ohne R_p driftet und sättigt, mit R_p endet er bei U_os·(1 + R_p/R)');
        return 'Die Offsetspannung U_os (hier ' + n('uos', off.uos * 1000, 0) + ' mV, Übungswert) wirkt wie eine kleine Gleichspannung am Eingang und wird mit V_n = 1 + R_f / R_1 verstärkt: Mit R_1 = ' + n('r1', 1, 0) + ' kΩ und R_f = ' + n('rf', 100, 0) + ' kΩ erscheint am Ausgang bei U_e = 0 die Spannung U_a,off = U_os · (1 + R_f / R_1) = ' + n('ua', m(re, 'uosOut'), 0) + ' mV (V_n = ' + n('vn', off.vn, 0) + '). ' +
          'Beim Integrierer ohne Parallelwiderstand ist das gefährlicher: Die Offsetspannung wird aufintegriert. Mit R = ' + n('r', g(a, 'r1') / K, 0) + ' kΩ und C = ' + n('c', g(a, 'c') * 1e6, 0) + ' µF driftet der Ausgang mit ' + n('dr', ig.drift, 2) + ' V/s und steht nach ' + n('ts', m(a, 'tsat'), 0) + ' s an der Aussteuergrenze von ' + n('us', st(a, 'usat'), 1) + ' V (Sättigung); danach integriert er nichts mehr. ' +
          'Ein Parallelwiderstand R_p = ' + n('rp', g(rp, 'rf') / 1e6, 0) + ' MΩ parallel zu C macht aus dem Integrierer unterhalb von f_g = ' + n('fg', m(rp, 'fg'), 2) + ' Hz einen Verstärker mit endlicher Gleichstromverstärkung: Der Ausgang endet bei U_os · (1 + R_p / R) = ' + n('ue', m(rp, 'uosOut'), 0) + ' mV, statt in die Sättigung zu laufen.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['diode', 'schalter', 'emitter', 'folger', 'opv_inv', 'opv_nin', 'opv_komp', 'opv_aktiv']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), preset = d.preset ? R.defs[def.rig].presets.find(p => p.id === d.preset) : null;
        if (d.preset && !preset) throw new Error('Voreinstellung „' + d.preset + '“ fehlt');
        const base = Object.assign({}, preset ? (preset.controls || preset.params || {}) : {}, d.ctl || {});
        const controls = fullCtl(def.rig, base);
        const acts = d.fire ? ['fire'] : [];
        const S = (over, act) => snap(def.rig, Object.assign({}, controls, over || {}), act === undefined ? acts : act);
        const X = { a: S({}), b: d.ref ? S(d.ref, []) : null, S };
        if (!X.a.ok || (X.b && !X.b.ok)) throw new Error((X.a.errors.concat(X.b ? X.b.errors : [])[0]) || 'Prüfstand nicht verfügbar');
        if (X.a.rejected.length || (X.b && X.b.rejected.length)) throw new Error('Der Prüfstand lehnt Werte ab: ' + X.a.rejected.concat(X.b ? X.b.rejected : []).map(x => x.key).join(', '));
        const vals = {};
        const nf = (k, v, dg) => { if (!fin(v)) throw new Error('Wert "' + k + '" ist keine Zahl'); vals[k] = v; return fm(v, dg); };
        X.n = (k, v, dg) => { const t = nf(k, v, dg); return t.indexOf(',') >= 0 ? t.replace(/0+$/, '').replace(/,$/, '') : t; };
        let desc = def.text(X, d);
        if (!/Übung/.test(desc)) desc += ' Alle Zahlen sind Übungswerte der Schaltung.';
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
  const ANA_DATA = {};
  Object.defineProperty(ANA_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  ANA_DATA.exampleCount = EXDEFS.length;
  ANA_DATA.exampleIds = EXDEFS.map(d => d.id);
  ANA_DATA.rebuild = () => buildExamples();                  // Neuberechnung ohne Zwischenspeicher (Tests: Determinismus)
  root.ANA_DATA = ANA_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.ANA_DATA.examples; }, tasks, register, ANA_TASKS, answerOf, clean, snap };
})(typeof window !== 'undefined' ? window : globalThis);
