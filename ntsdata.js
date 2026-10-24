/* ntsdata.js - NTS-Lab (Netzteile und Schaltregler): Beispiele (NTS_DATA) und Aufgabenregister (NTS_TASKS), ohne Browser lauffaehig (WP4a).
 * Quelle: quelle/ntslab/_wp4a/p1_util.js + p2_examples.js, zusammengesetzt mit `node quelle/ntslab/_wp4a/build_nts.js` (nach Aenderungen neu bauen).
 *
 * window.NTS_DATA  = { examples: [ { id:'ntx1'..'ntx34', name, cat, rig, desc, controls, ref?, seq?, dur?, vals } ], exampleCount, exampleIds, rebuild }
 *   Alle Zahlen in `desc` kommen aus der Simulation (NTS_RIGS) und dem Kern (NTS_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff gerechnet (Getter);
 *   fehlen Kern oder Pruefstaende, enthaelt der Eintrag `error` und eine ehrliche Meldung statt einer Beschreibung (ntsui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Pruefstands (Zustand bei Beginn bzw. NACHHER), ref = abweichende Steuerwerte des Zustands VORHER, seq im Format von NTS_CORE.runSeq
 *   (t in Sekunden: set | ramp | fire | do, do nur am Pruefstand fehler), dur in Sekunden. Behauptungen in den Texten stehen hinter must(bedingung, text): Traegt die gerechnete Zahl
 *   die Aussage nicht, meldet sich der Eintrag als fehlerhaft (Regel 2).
 * window.NTS_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in ntstasks1.js (nt1-nt16) und ntstasks2.js (nt17-nt32) und melden sich mit NTS_TASKS.register([...]) an; die Reihenfolge der Registry ist immer
 *   nt1, nt2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'ntN', lab:'nts', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|String|null}, choices:{key:Wert}, clicks, diagnose, bericht }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), seq?, value?, fields?, choices?, fired?, clicks?, diagnose? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert [{ name, answer }] mit mindestens zwei absichtlich falschen Antworten (zu klein / zu gross bzw. falsch herum) fuer den Test (Regel 3).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * NTS_TASKS.util (fuer ntstasks1.js, ntstasks2.js und die Tests; gleiche Huelle wie elsdata.js, wsldata.js, emvdata.js und enrdata.js):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); snap(rigId, ctl, act?) -> { ok, rig, m (readMeters), a (assess), d (diagnose), s (state), rejected, errors }
 *   (Pruefstand frisch, Seed 1, Steuerwerte in fester Reihenfolge, gecacht; act = true | 'fire' | 'step:<ms>' | 'sicht' | 'messe:<punkt>' | 'tausche:<bauteil>' | Liste davon); effOf; cdef; dlabel; olabel; setRow;
 *   mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId); numRow(r, val, opt); exRow(r, ex, raw, label); rawOf(a, key); fieldNum; numAns; choiceOf;
 *   calcEx({ value (SI), unit, what, tol?, extras?, pct? } | { fid, args, ... }) -> Rechenuebung mit check(raw) auf Kernwerten (NTS_CORE.formulas, auch mit festen Poolwerten); calcRow(r, ex, raw, label);
 *   choiceDef(key, frage, optionen[{value,label,reason}]); choiceRow(r, a, spec) (Auswahlfrage mit Fachgrund je falscher Antwort); firedOf(a) (Taste/fire benutzt?);
 *   variants; pctOf; rowsToSeq; lim(id) (Wert aus NTS_CORE.limits); CORE; RIGS; core (= CORE); rigs (= RIGS); nodeReq.
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben. Die Pruefung rechnet immer neu aus den abgegebenen Steuerwerten und den festen Werten der Aufgabe (nur die
 *   freigegebenen Steuerwerte `own` zaehlen; alles andere setzt die Pruefung selbst), nie aus dem angezeigten Zustand.
 * NTS_TASKS.audit(task) und NTS_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) fuer Selbsttest und Tests.
 * Uebungsanlage: Alle Bauteil- und Anlagenwerte sind Uebungswerte. Simulation: keine Anleitung zum Bauen oder Messen an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.NTS_CORE) nodeReq('./ntscore.js'); if (root.NTS_CORE && !root.NTS_CORE.exercise) { nodeReq('./ntscore-sw.js'); nodeReq('./ntscore-diag.js'); } return root.NTS_CORE || null; };
  const RIGFILES = ['./ntsrig-trafo.js', './ntsrig-gleich.js', './ntsrig-stabil.js', './ntsrig-buck.js', './ntsrig-topo.js', './ntsrig-gate.js', './ntsrig-regel.js', './ntsrig-fehler.js'];
  const RIGS = id => { let R = root.NTS_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); nodeReq('./ntsrig-base.js'); RIGFILES.forEach(nodeReq); R = root.NTS_RIGS; } return R || null; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const fm = (x, d) => { if (!fin(x)) return '–'; return (+x).toFixed(d == null ? 1 : d).replace('.', ',').replace(/^-(?=\d)/, '−'); };
  const toNum = v => {
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && typeof C.parseNum === 'function' ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
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
  /* feuert fire (Frequenzdurchlauf, Messung, Zuschalten, Stern-Dreieck) in der Antwort? */
  function firedOf(a) {
    if (!isObj(a)) return false;
    if (a.fired === true) return true;
    if (isObj(a.state) && a.state.fired === true) return true;
    const seq = Array.isArray(a.seq) ? a.seq : rowsToSeq(a.rows);
    return seq.some(e => isObj(e) && e.fire === true);
  }

  /* ====================================================================== Pruefstand: Momentaufnahme */
  /* erst Auswahlen, von denen andere Werte abhaengen (Aufbau, Art, Modus ...), dann der Rest in der Reihenfolge der Bedienelemente */
  const FIRST = ['netz', 'art', 'topo', 'modus', 'steuer', 'uf', 'halbbruecke', 'gleichspannung', 'last'];
  const snapCache = new Map();
  const actList = act => (act === true ? ['fire'] : typeof act === 'string' && act ? [act] : Array.isArray(act) ? act.filter(x => typeof x === 'string' && x) : []);
  function snap(rigId, ctl, act) {
    ctl = isObj(ctl) ? ctl : {};
    const acts = actList(act);
    const key = rigId + '|' + acts.join(',') + '|' + JSON.stringify(ctl);
    if (snapCache.has(key)) return snapCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId); if (!R || !R.defs || !R.defs[rigId]) throw new Error('Den Prüfstand „' + rigId + '“ gibt es nicht.');
      const rig = R.create(rigId, { seed: 1, noDraw: true });
      Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push({ key: k, value: ctl[k] });
      });
      acts.forEach(x => {
        if (x === 'fire') { if (typeof rig.fire === 'function') rig.fire(); }
        else if (x === 'sicht') { if (typeof rig.sicht === 'function') rig.sicht(); }
        else if (/^messe:/.test(x)) { rig.setControl('messpunkt', x.slice(6)); if (typeof rig.fire === 'function') rig.fire(); }
        else if (/^tausche:/.test(x)) { rig.setControl('tausche', x.slice(8)); }
        else if (/^step:/.test(x)) { let ms = +x.slice(5) || 0; while (ms > 0) { const d = Math.min(ms, 400); rig.step(d); ms -= d; } }
      });
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
  const cdef = (rigId, key) => (ctlDefs(rigId) || []).find(x => x.key === key) || null;
  const dlabel = (rigId, key) => { const d = cdef(rigId, key); return d && d.label ? d.label : key; };
  function olabel(rigId, key, v) {
    const d = cdef(rigId, key);
    if (d && Array.isArray(d.options)) { const o = d.options.map(x => (isObj(x) ? x : { value: x, label: String(x) })).find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    if (typeof v === 'number') {
      const u = d && d.unit ? d.unit : '';
      if (['Hz', 'V', 'A', 'Ω', 'H', 'F', 'W', 'var', 'VA', 's'].includes(u)) { const C = CORE(); if (C && typeof C.fmtEng === 'function') return C.fmtEng(v, u); }
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
    if (unit === '' || unit === '%' || !fin(v) || v === 0) return { value: v, unit, factor: 1 };
    const a = Math.abs(v); let p = PREFS[PREFS.length - 1];
    for (let i = 0; i < PREFS.length; i++) if (a >= PREFS[i][0] * 0.99995) { p = PREFS[i]; break; }
    return { value: v / p[0], unit: p[1] + unit, factor: p[0] };
  }
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 's'];
  function baseUnit(u, factor) {
    if (!u) return '';
    const b = x => (x === 'Ohm' || x === 'ohm' ? 'Ω' : x);
    if (ULIST.includes(u)) return b(u);
    if (u.length >= 2 && factor !== 1 && ULIST.includes(u.slice(1))) return b(u.slice(1));
    return '?';
  }
  /* spec = { value (SI), unit ('V','A','Ω','W','Hz','F','H','s', '' fuer Verhaeltnis, '%' fuer Anteil als Bruch 0..1), what, tol (relativ, Standard 0,03),
   *          extras:[{ v (SI), msg }] typische Fehler (jeder gerechnet), altExtra:[SI] weitere richtige Werte (Tabellenbuch-Rundungen) }
   *   oder { fid, args:[SI...] } = Wert aus NTS_CORE.formulas.get(fid).run(...args) (Einheit der Formel). Die Texte nennen nur, was verglichen wurde (Regel 2 und 3). */
  function calcEx(spec) {
    const C = CORE(); let value, unit, what = spec.what || '';
    try {
      if (spec.fid) {
        const F = C.formulas.get(spec.fid), r = F ? F.run.apply(null, spec.args || []) : null;
        if (!r || !r.ok) return { ok: false, why: (r && r.why) || 'Die Formel „' + spec.fid + '“ gibt es nicht.' };
        value = r.value; unit = spec.unit !== undefined ? spec.unit : F.unit;
      } else { value = spec.value; unit = spec.unit || ''; }
    } catch (e) { return { ok: false, why: 'Der Rechenkern ist nicht verfügbar.' }; }
    if (!fin(value)) return { ok: false, why: 'Die Aufgabe hat keinen gültigen Wert.' };
    const tol = fin(spec.tol) ? spec.tol : 0.03, pct = unit === '%' || spec.pct === true, baseU = unit === '%' ? '' : unit;
    const alt = (spec.altExtra || []).filter(fin), wrong = (spec.extras || []).filter(x => fin(x.v)).map(x => ({ id: 'extra', value: x.v, text: x.msg }));
    const disp = dispOf(value, baseU);
    const fe = (x, u) => { const C2 = CORE(); return pct ? fm(x * 100, 1) + ' %' : C2.fmtEng(x, u); };
    const near = (a, b) => Math.abs(a - b) <= tol * Math.abs(b) + 1e-300;
    const ex = { ok: true, value, unit, alt, wrong, disp, tol, what, pct,
      check(raw) {
        const q = C.parseUnit(String(raw == null ? '' : raw).trim());
        if (!q || !fin(q.value)) return { ok: false, why: 'keine-zahl', text: 'Das ist keine Zahl: Gib den Wert als Zahl ein, zum Beispiel 2,5 oder 2,5 ' + (pct ? '%' : baseU || 'V') + '.' };
        let cands, hasUnit = !!q.unit;
        if (hasUnit && q.unit === '%') {
          if (!pct) return { ok: false, why: 'einheit', text: 'Die Einheit „%“ passt nicht zur gesuchten Größe (gesucht: ' + (baseU || 'ohne Einheit') + '). Prüfe die Einheit.' };
          cands = [q.value / 100];
        } else if (hasUnit) {
          const b = baseUnit(q.unit, q.factor);
          if (pct || b === '?' || (baseU && b !== baseU) || (!baseU && b !== '')) return { ok: false, why: 'einheit', text: 'Die Einheit „' + q.unit + '“ passt nicht zur gesuchten Größe (gesucht: ' + (pct ? '%' : baseU || 'ohne Einheit') + '). Prüfe die Einheit.' };
          cands = [q.si];
        } else {
          cands = pct ? [q.value, q.value / 100] : [q.value]; if (!pct && disp.factor !== 1) cands.push(q.value * disp.factor);
        }
        const refs = [value].concat(alt);
        for (let i = 0; i < cands.length; i++) for (let j = 0; j < refs.length; j++) if (near(cands[i], refs[j])) return { ok: true, why: 'richtig', text: 'Richtig: ' + (what ? what + ' = ' : '') + fe(value, baseU) + '.' };
        for (let k = 0; k < wrong.length; k++) for (let i = 0; i < cands.length; i++) if (near(cands[i], wrong[k].value)) return { ok: false, why: wrong[k].id, text: wrong[k].text };
        let a = cands[0];
        if (cands.length > 1 && value !== 0) { let best = 1e300; cands.forEach(c => { const l = c !== 0 ? Math.abs(Math.log(Math.abs(c / value))) : 1e300; if (l < best) { best = l; a = c; } }); }
        if (a !== 0 && value !== 0 && (a > 0) === (value > 0)) {
          const rr = a / value, lr = Math.log(Math.abs(rr)) / Math.LN10;
          if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) return { ok: false, why: 'vorsatz', text: 'Dein Wert ist um den Faktor ' + (Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')') + ' zu ' + (Math.round(lr) > 0 ? 'groß' : 'klein') + ': Prüfe die Einheiten (mA/A, µF/mF, kΩ/Ω).' };
          return rr < 1 ? { ok: false, why: 'zu-klein', text: 'Dein Wert ist zu klein (rund ' + fm((1 - rr) * 100, 0) + ' % unter dem Rechenwert). Rechne die Schritte noch einmal durch.' }
            : { ok: false, why: 'zu-gross', text: 'Dein Wert ist zu groß (rund ' + fm((rr - 1) * 100, 0) + ' % über dem Rechenwert). Rechne die Schritte noch einmal durch.' };
        }
        if (a !== 0 && value !== 0) return { ok: false, why: 'vorzeichen', text: 'Das Vorzeichen deines Werts stimmt nicht mit dem Rechenwert überein.' };
        return a < value ? { ok: false, why: 'zu-klein', text: 'Dein Wert ist zu klein. Rechne die Schritte noch einmal durch.' } : { ok: false, why: 'zu-gross', text: 'Dein Wert ist zu groß. Rechne die Schritte noch einmal durch.' };
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
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 6; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^nt(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const NTS_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, ctlDefs, coerce, clean, initial, snap, effOf, mk, inputRow, setRow, numRow, exRow, calcEx, calcRow, choiceDef, choiceRow, firedOf, variants, fieldNum, numAns,
      choiceOf, rawOf, pctOf, rowsToSeq, cdef, dlabel, olabel, lim, CORE, RIGS, core: CORE, rigs: RIGS, nodeReq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberflaeche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, ref: o.ref || null, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: isObj(o.state) ? o.state : null, simTime: 0,
      fired: !!o.fired, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [], diagnose: typeof o.diagnose === 'string' ? o.diagnose : null, bericht: isObj(o.bericht) ? o.bericht : null };
  }
  NTS_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel, einer Formelkonstante (task.consts), den Grenzwerten aus NTS_CORE.limits
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
  NTS_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  NTS_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.ref || {}, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.NTS_TASKS = NTS_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await NTS_TASKS.run(t, answerOf(t, t.start()))), L = await NTS_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (34) */
  /* Jedes Beispiel: spec() liefert das Szenario (preset | ctl = Steuerwerte NACHHER bzw. zu Beginn, ref = abweichende Steuerwerte VORHER, seq, dur, fire, acts), die Simulation rechnet es genau wie die
   * Oberflaeche (Steuerwerte, Pruefstaende, NTS_CORE), und text(X) formuliert die Beschreibung. X.a = Zustand nachher (bei fire bzw. acts: nach der Ausloesung), X.b = Zustand vorher (oder null),
   * X.S(over, act) = Zustand mit abweichenden Steuerwerten, X.n(schluessel, wert, stellen) = Zahl im Text. Jede Zahl der Beschreibung laeuft ueber n(): Sie steht danach in `vals` und stammt aus
   * Simulation, Pruefstand oder Kern (Regel 1). Alles Uebungswerte (Uebungsschaltung); alle Pruefstaende arbeiten mit Kleinspannung, nur ntx1 und ntx3 nennen die Netzspannung als Zahl.
   * Fachbegriffe wie in SPEC Abschnitt 2 (Ladekondensator, Linearregler, Brummspannung, Schaltregler). */
  const m = (s, k) => (s && s.m ? s.m[k] : NaN);
  const st = (s, k) => (s && s.s ? s.s[k] : NaN);
  const g = (s, k) => (s && s.rig ? +s.rig.getControl(k) : NaN);               // Steuerwert aus dem Pruefstand (Text und Simulation haben dieselbe Quelle)
  const must = (c, why) => { if (!c) throw new Error('Behauptung im Text nicht belegt: ' + why); };
  const close = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-3 : rel) * Math.max(Math.abs(b), 1e-12);
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const ampName = s => (s && s.a ? AMP[s.a.ampel] || s.a.ampel : '');
  const gs = (s, k) => (s && s.rig ? s.rig.getControl(k) : undefined);
  const bparts = s => CORE().loss.parts({ kind: 'buck', Uin: g(s, 'uin'), Uout: g(s, 'uout'), Iout: g(s, 'iout'), f: g(s, 'f') * 1e3, L: g(s, 'l') / MIKRO, rdson: g(s, 'rdson') * 1e-3, esr: g(s, 'esr') * 1e-3, sync: gs(s, 'uf') === 'sync' });
  const diagIds = s => (s && Array.isArray(s.d) ? s.d.map(x => x.id) : []);
  const MIKRO = 1e6;

  const EXDEFS = [
    /* ---------------------------------------------------------------- Transformator */
    { id: 'ntx1', name: 'Übersetzung 230 V auf 13,8 V', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'belastet', ref: { iLast: 0 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), n1 = g(a, 'n1'), n2 = g(a, 'n2'), r = C.trafo.ratio({ n1, n2, iLast: g(a, 'iLast'), U1: lim('u_netz') });
        must(r.ok && close(r.I1 * 1000, m(a, 'i1'), 1e-6) && close(r.I1, g(a, 'iLast') * n2 / n1, 1e-9) && close(r.U2_leer * r.ue, lim('u_netz'), 1e-9) && close(m(b, 'i1'), 0, 1e-9), 'Übersetzung, Primärstrom I1 = I2 · N2/N1, Vorher stromlos');
        return 'Der Transformator hat primär N1 = ' + n('n1', n1, 0) + ' und sekundär N2 = ' + n('n2', n2, 0) + ' Windungen, das Übersetzungsverhältnis ist ü = N1 / N2 = ' + n('ue', r.ue, 2) + '. An der Netzspannung von ' + n('u1', lim('u_netz'), 0) +
          ' V (nur als Zahl gerechnet, nichts zum Nachbauen) liegen im Leerlauf sekundär U2 = ' + n('u2', r.U2_leer, 1) + ' V an. Die Ströme verhalten sich umgekehrt wie die Windungszahlen: Bei I2 = ' + n('i2', g(a, 'iLast'), 1) +
          ' A fließt primär I1 = I2 · N2 / N1 = ' + n('i1', m(a, 'i1'), 0) + ' mA, also ' + n('i1a', r.I1, 2) + ' A. Vorher, im Leerlauf, war der Primärstrom ' + n('i0', m(b, 'i1'), 0) + ' mA. Unter Last fällt die Klemmenspannung durch den Innenwiderstand (' +
          n('ri', g(a, 'ri'), 1) + ' Ω) auf ' + n('uk', m(a, 'u2'), 1) + ' V.';
      } },
    { id: 'ntx2', name: 'Klemmenspannung unter Last', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'belastet', ctl: { n2: 63, iLast: 3 }, ref: { iLast: 0 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), l = C.trafo.load({ U1: lim('u_netz'), n1: g(a, 'n1'), n2: g(a, 'n2'), ri: g(a, 'ri'), iLast: g(a, 'iLast') });
        must(l.ok && close(l.U2_klemme, m(a, 'u2'), 1e-9) && close(l.U2_leer, m(b, 'u2'), 1e-9) && close(l.U2_klemme, l.U2_leer - g(a, 'ri') * g(a, 'iLast'), 1e-9) && close(m(a, 'einbruch'), 100 * l.einbruch, 1e-6) && st(a, 'ampel') === 'gelb', 'Klemmenspannung = Leerlauf − I·Ri, Einbruch gelb');
        return 'Ein Transformator mit der Leerlaufspannung U2 = ' + n('ul', l.U2_leer, 1) + ' V und dem Innenwiderstand R_i = ' + n('ri', g(a, 'ri'), 1) + ' Ω wird mit I = ' + n('i', g(a, 'iLast'), 0) + ' A belastet. Am Innenwiderstand fallen I · R_i = ' + n('ur', g(a, 'iLast') * g(a, 'ri'), 1) +
          ' V ab, die Klemmenspannung sinkt von ' + n('ul2', m(b, 'u2'), 1) + ' V auf ' + n('uk', m(a, 'u2'), 1) + ' V. Das ist ein Einbruch von ' + n('e', m(a, 'einbruch'), 1) + ' % (die Ampel zeigt ' + ampName(a) +
          '). Der Wirkungsgrad sinkt auf ' + n('eta', m(a, 'eta'), 1) + ' %, weil im Innenwiderstand die Verlustleistung ' + n('pv', m(a, 'pv'), 1) + ' W bleibt. Je größer der Strom, desto kleiner die Klemmenspannung.';
      } },
    { id: 'ntx3', name: 'Transformator an Gleichspannung', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'gleichstrom', ref: { gleichspannung: false } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), d = C.trafo.dc({ U1: lim('u_netz'), n1: g(a, 'n1'), n2: g(a, 'n2'), ri: g(a, 'ri') });
        must(d.ok && d.valid && close(d.I * 1000, m(a, 'i1'), 1e-6) && close(m(a, 'u2'), 0, 1e-9) && st(a, 'ampel') === 'rot' && diagIds(a).includes('trafo-dc') && m(b, 'u2') > 10, 'Gleichspannung: I = U/R_w, keine Sekundärspannung, rot');
        return 'Ein Transformator braucht Wechselspannung: Nur die Änderung des Flusses induziert die Gegenspannung, die den Strom bremst. An Gleichspannung fehlt sie, und nur der Wicklungswiderstand R_w = ' + n('rw', d.Rw, 0) +
          ' Ω (Übungswert) begrenzt den Strom auf I = U / R_w = ' + n('i', d.I, 0) + ' A (Rechenbeispiel mit ' + n('u1', lim('u_netz'), 0) + ' V). Die Sekundärspannung bleibt bei ' + n('u2', m(a, 'u2'), 0) + ' V, die Ampel zeigt ' + ampName(a) +
          ': Die Wicklung würde zerstört. Vorher, an Wechselspannung, lieferte der Transformator sekundär ' + n('u2w', m(b, 'u2'), 1) + ' V. Das ist nur ein Rechenbeispiel in der Simulation.';
      } },
    /* ---------------------------------------------------------------- Gleichrichter und Siebung */
    { id: 'ntx4', name: 'Einweg: 50 Impulse', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'einweg-brueck', ctl: { iLast: 0.25 }, ref: { topo: 'bruecke' } }),
      text(X) {
        const { a, b, n } = X;
        must(gs(a, 'topo') === 'einweg' && close(m(a, 'fp'), 50, 1e-9) && close(m(b, 'fp'), 100, 1e-9) && close(m(a, 'dubrumm'), 2 * m(b, 'dubrumm'), 1e-3) && !diagIds(a).includes('ripple-naeherung'), 'Einweg fp 50 Hz, doppelte Brummspannung gegen Brücke');
        return 'Der Einweggleichrichter (M1) lässt nur eine Halbwelle durch: Der Ladekondensator bekommt einen Impuls je Netzperiode, die Pulsfrequenz ist f_p = ' + n('fp', m(a, 'fp'), 0) + ' Hz. Die Brummspannung ist ΔU = I / (f_p · C) = ' + n('du', m(a, 'dubrumm'), 2) + ' V bei ' +
          n('i', g(a, 'iLast'), 2) + ' A und ' + n('c', g(a, 'c'), 0) + ' µF. Vorher, mit der Brücke, waren es f_p = ' + n('fpb', m(b, 'fp'), 0) + ' Hz und nur ΔU = ' + n('dub', m(b, 'dubrumm'), 2) + ' V: Mit der halben Pulsfrequenz ist die Brummspannung doppelt so groß. ' +
          'Außerdem liegt im Einweggleichrichter nur eine Diode im Strompfad, der Scheitelwert ist Û = ' + n('uh', m(a, 'uhat'), 2) + ' V.';
      } },
    { id: 'ntx5', name: 'Brücke: 100 Impulse', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'einweg-brueck', ctl: { topo: 'bruecke' }, ref: { topo: 'einweg' } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), uf = lim('uf_si'), u2 = g(a, 'u2');
        must(close(m(a, 'fp'), 100, 1e-9) && close(m(a, 'uhat'), u2 * Math.SQRT2 - 2 * uf, 1e-6) && close(m(b, 'uhat'), u2 * Math.SQRT2 - uf, 1e-6) && close(C.rect.peak({ topo: 'bruecke', U2: u2, uf }), m(a, 'uhat'), 1e-9), 'Brücke fp 100 Hz, Û = U·√2 − 2·U_F');
        return 'In der Brücke (B2) richten vier Dioden beide Halbwellen gleich: Der Ladekondensator wird zweimal je Netzperiode nachgeladen, f_p = ' + n('fp', m(a, 'fp'), 0) + ' Hz. In jedem Strompfad liegen zwei Dioden, deshalb gilt Û = U · √2 − 2 · U_F = ' + n('u2', u2, 0) +
          ' V · ' + n('sq', Math.SQRT2, 3) + ' − 2 · ' + n('uf', uf, 1) + ' V = ' + n('uh', m(a, 'uhat'), 2) + ' V (Einweg: ' + n('uhe', m(b, 'uhat'), 2) + ' V mit nur einer Diode). Der Strom fließt nur kurz in Impulsen von rund ' + n('tl', m(a, 'tLeit'), 2) + ' ms Dauer mit dem Spitzenwert ' + n('ip', m(a, 'iPeak'), 2) +
          ' A, obwohl der Mittelwert ' + n('i', g(a, 'iLast'), 1) + ' A beträgt.';
      } },
    { id: 'ntx6', name: 'C größer, Brumm kleiner', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'einweg-brueck', ctl: { topo: 'bruecke', c: 4400 }, ref: { topo: 'bruecke', c: 2200 } }),
      text(X) {
        const { a, b, n } = X;
        must(close(m(a, 'dubrumm'), m(b, 'dubrumm') / 2, 1e-3) && close(m(a, 'dubrumm'), g(a, 'iLast') / (m(a, 'fp') * g(a, 'c') / MIKRO), 1e-6) && !diagIds(a).includes('ripple-naeherung') && !diagIds(b).includes('ripple-naeherung'), 'doppeltes C halbiert ΔU, Formel gilt');
        return 'Die Brummspannung folgt ΔU = I / (f_p · C). Bei I = ' + n('i', g(a, 'iLast'), 1) + ' A und f_p = ' + n('fp', m(a, 'fp'), 0) + ' Hz ergibt ein Ladekondensator mit ' + n('c1', g(b, 'c'), 0) + ' µF eine Brummspannung von ' + n('d1', m(b, 'dubrumm'), 2) + ' V. Mit ' + n('c2', g(a, 'c'), 0) +
          ' µF, also doppelter Kapazität, sinkt sie auf ' + n('d2', m(a, 'dubrumm'), 2) + ' V: Jede Verdopplung von C halbiert die Brummspannung. Die Formel ist eine Näherung (Sägezahn); sie gilt, solange ΔU klein gegen den Scheitelwert Û = ' + n('uh', m(a, 'uhat'), 2) + ' V bleibt.';
      } },
    { id: 'ntx7', name: 'Last verdoppeln', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'last-doppelt', ctl: { topo: 'bruecke', c: 2200, iLast: 0.5 }, ref: { topo: 'bruecke', c: 2200, iLast: 0.25 } }),
      text(X) {
        const { a, b, n } = X;
        must(close(m(a, 'dubrumm'), 2 * m(b, 'dubrumm'), 1e-3) && !diagIds(a).includes('ripple-naeherung') && !diagIds(b).includes('ripple-naeherung'), 'doppelter Strom, doppelte Brummspannung');
        return 'Bei gleicher Kapazität C = ' + n('c', g(a, 'c'), 0) + ' µF und gleicher Netzfrequenz ist die Brummspannung proportional zum Laststrom: Mit ' + n('i1', g(b, 'iLast'), 2) + ' A beträgt ΔU = ' + n('d1', m(b, 'dubrumm'), 2) + ' V, mit dem doppelten Strom ' + n('i2', g(a, 'iLast'), 2) +
          ' A ist es ΔU = ' + n('d2', m(a, 'dubrumm'), 2) + ' V, also doppelt so viel (Pool-Frage zur Brummspannung). Der Kondensator wird stärker entladen, bevor der nächste Impuls ihn nachlädt. Die kleinste Spannung am Kondensator sinkt dabei von ' + n('u1', m(b, 'umin'), 2) + ' V auf ' + n('u2', m(a, 'umin'), 2) + ' V.';
      } },
    { id: 'ntx8', name: 'Einschaltstromstoß', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'einschaltstrom', ref: { rs: 0 }, fire: true }),
      text(X) {
        const { a, b, n } = X, C = CORE(), ri = lim('ri_trafo'), u = C.rect.inrush({ topo: gs(a, 'topo'), U2: g(a, 'u2'), ri, rs: g(a, 'rs') });
        must(u.ok && close(u.Imax, m(a, 'imax'), 1e-9) && close(m(b, 'imax'), u.peak / ri, 1e-6) && st(a, 'fired') === true && diagIds(a).includes('einschalt-hoch') && m(a, 'umin') < m(b, 'umin'), 'Einschaltstrom = Û/(R_i + R_s), fire ausgelöst, U_min mit Vorwiderstand kleiner');
        return 'Ein leerer Ladekondensator wirkt im Einschaltmoment wie ein Kurzschluss: Nur der Innenwiderstand R_i = ' + n('ri', ri, 1) + ' Ω und ein Vorwiderstand begrenzen den Strom auf I = Û / (R_i + R_s). Ohne Vorwiderstand (R_s = ' + n('rs0', g(b, 'rs'), 0) +
          ' Ω) fließen bis zu ' + n('i0', m(b, 'imax'), 1) + ' A. Mit R_s = ' + n('rs', g(a, 'rs'), 1) + ' Ω sind es noch ' + n('i1', m(a, 'imax'), 2) + ' A bei Û = ' + n('uh', u.peak, 2) + ' V (Pool-Frage zum Vorwiderstand). Die Pulsfrequenz bleibt f_p = ' + n('fp', m(a, 'fp'), 0) +
          ' Hz. Im Dauerbetrieb kostet der Widerstand Spannung und erzeugt Wärme, deshalb bleibt er klein: Weil der Ladestrom nur in kurzen Impulsen fließt, sinkt die kleinste Spannung am Ladekondensator von ' + n('um0', m(b, 'umin'), 2) + ' V auf ' + n('um1', m(a, 'umin'), 2) + ' V, mehr als der mittlere Laststrom allein am Widerstand erwarten ließe (Zeitschrittmodell, Messgerät U_min).';
      } },
    { id: 'ntx9', name: 'RC-Sieb hinter dem Ladekondensator', cat: 'Gleichrichter', rig: 'gleich',
      spec: () => ({ preset: 'einweg-brueck', ctl: { topo: 'bruecke', rsieb: true }, ref: { topo: 'bruecke', rsieb: false } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), pool = C.rect.rcSieb({ U1: 3, R: 470, C: 1000, fp: 100 }), rig = C.rect.rcSieb({ U1: m(a, 'dubrumm'), R: lim('rc_r'), C: lim('rc_c'), fp: m(a, 'fp') });
        must(pool.ok && close(pool.U2 * 1000, 10.16, 1e-3) && rig.ok && close(rig.U2 * 1000, m(a, 'dusieb'), 1e-6) && m(a, 'dusieb') < 1000 * m(a, 'dubrumm') && close(m(b, 'dusieb'), 0, 1e-9), 'RC-Glied Kern gleich Messgerät, kleiner als die Brummspannung');
        return 'Ein RC-Glied hinter dem Ladekondensator wirkt als Spannungsteiler aus R und dem Blindwiderstand X_C = 1 / (2π · f_p · C). Rechenbeispiel (Kernfunktion): ' + n('u1', 3, 1) + ' V Brummspannung, R = ' + n('rp', 470, 0) + ' Ω, C = ' + n('cp', 1000, 0) + ' µF und f_p = ' + n('fpp', 100, 0) + ' Hz ergeben ' + n('u2', pool.U2 * 1000, 2) +
          ' mV. Im Prüfstand ist das Glied mit R = ' + n('r', lim('rc_r'), 1) + ' Ω und C = ' + n('c', lim('rc_c'), 0) + ' µF (Übungswerte) schaltbar: Die Brummspannung ' + n('d1', m(a, 'dubrumm'), 2) + ' V am Ladekondensator wird dahinter auf ' + n('d2', m(a, 'dusieb') / 1000, 2) +
          ' V geteilt (Faktor ' + n('fk', rig.faktor, 3) + '). Der Preis ist der Spannungsabfall I · R am Widerstand.';
      } },
    /* ---------------------------------------------------------------- Z-Diode */
    { id: 'ntx10', name: 'Z-Diode mit Last', cat: 'Z-Diode', rig: 'stabil',
      spec: () => ({ preset: 'z-5v1' }),
      text(X) {
        const { a, n } = X, C = CORE(), z = C.zener.stage({ Ue: g(a, 'ue'), Uz: g(a, 'uz'), Rv: g(a, 'rv'), Rlast: g(a, 'rlast') });
        must(z.ok && z.aktiv && close(z.Iz * 1000, m(a, 'iz'), 1e-6) && close(z.Iz, z.Iges - z.Ilast, 1e-9) && close(m(a, 'uaus'), g(a, 'uz'), 1e-9), 'I_Z = I_ges − I_Last, Z-Diode aktiv');
        return 'Eine Z-Diode mit U_Z = ' + n('uz', g(a, 'uz'), 1) + ' V wird aus ' + n('ue', g(a, 'ue'), 0) + ' V über den Vorwiderstand R_V = ' + n('rv', g(a, 'rv'), 0) + ' Ω gespeist, parallel liegt die Last R_L = ' + n('rl', g(a, 'rlast'), 0) + ' Ω. Der Gesamtstrom ist I_ges = (U_ein − U_Z) / R_V = ' + n('ig', z.Iges * 1000, 2) +
          ' mA, davon nimmt die Last I_L = U_Z / R_L = ' + n('il', z.Ilast * 1000, 2) + ' mA, der Rest fließt durch die Z-Diode: I_Z = ' + n('iz', m(a, 'iz'), 2) + ' mA (Pool-Aufgabe). Die Ausgangsspannung steht bei ' + n('ua', m(a, 'uaus'), 1) +
          ' V. Der Wirkungsgrad ist schlecht (' + n('eta', m(a, 'eta'), 1) + ' %), weil der Vorwiderstand und die Z-Diode den größten Teil der Leistung verbrauchen.';
      } },
    { id: 'ntx11', name: 'Z-Diode im Leerlauf', cat: 'Z-Diode', rig: 'stabil',
      spec: () => ({ preset: 'z-5v1', ctl: { ue: 24, uz: 12, rv: 288, rlast: 47000 } }),
      text(X) {
        const { a, n } = X, C = CORE(), r6 = C.zener.rvMin({ Ue: 24, Uz: 12, Pmax: 0.6 }), pm = lim('pz_max'), r5 = C.zener.rvMin({ Ue: g(a, 'ue'), Uz: g(a, 'uz'), Pmax: pm }), z = C.zener.stage({ Ue: g(a, 'ue'), Uz: g(a, 'uz'), Rv: g(a, 'rv'), Rlast: g(a, 'rlast') });
        must(close(r6, 240, 1e-9) && close(r5, g(a, 'rv'), 1e-9) && z.ok && z.Pz <= pm * 1.0001 && close(z.Iz * 1000, m(a, 'iz'), 1e-6), 'R_V,min = (U_ein − U_Z) · U_Z / P_max, Prüfstand-Wert hält P_max ein');
        return 'Im Leerlauf trägt die Z-Diode den ganzen Strom. Pool-Aufgabe: U_Z = ' + n('uz', g(a, 'uz'), 0) + ' V, P_max = ' + n('p6', 0.6, 1) + ' W, Eingangsspannung bis ' + n('ue', g(a, 'ue'), 0) + ' V: I_Z,max = P / U_Z = ' + n('izm', 0.6 / 12 * 1000, 0) + ' mA und R_V,min = (U_ein − U_Z) / I_Z,max = ' + n('r6', r6, 0) +
          ' Ω. Der Prüfstand rechnet mit P_max = ' + n('pm', pm, 1) + ' W (Übungswert, Datenblatt maßgeblich); dafür ist R_V,min = ' + n('r5', r5, 0) + ' Ω. Mit R_V = ' + n('rv', g(a, 'rv'), 0) + ' Ω und der Last R_L = ' + n('rl', g(a, 'rlast'), 0) + ' Ω (praktisch Leerlauf) fließt I_Z = ' + n('iz', m(a, 'iz'), 1) +
          ' mA, die Z-Diode nimmt P_Z = ' + n('pz', z.Pz, 3) + ' W auf. Ein kleinerer Vorwiderstand würde sie überlasten.';
      } },
    { id: 'ntx12', name: 'Z-Diode fällt aus der Regelung', cat: 'Z-Diode', rig: 'stabil',
      spec: () => ({ preset: 'z-5v1', ctl: { rlast: 250 }, ref: { rlast: 4700 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), z = C.zener.stage({ Ue: g(a, 'ue'), Uz: g(a, 'uz'), Rv: g(a, 'rv'), Rlast: g(a, 'rlast') });
        must(z.ok && !z.aktiv && z.Iz === 0 && close(m(a, 'uaus'), z.Uaus, 1e-6) && m(a, 'uaus') < g(a, 'uz') && close(m(b, 'uaus'), g(b, 'uz'), 1e-9) && diagIds(a).includes('z-aus'), 'Z-Strom unter I_Z,min: Ausgang unter U_Z');
        return 'Mit der kleinen Last R_L = ' + n('rl', g(a, 'rlast'), 0) + ' Ω zieht die Last bei U_Z = ' + n('uz', g(a, 'uz'), 1) + ' V schon ' + n('il', z.Ilast * 1000, 1) + ' mA, mehr als der Vorwiderstand R_V = ' + n('rv', g(a, 'rv'), 0) + ' Ω aus ' + n('ue', g(a, 'ue'), 0) + ' V liefern kann (I_ges = ' + n('ig', z.Iges * 1000, 1) +
          ' mA). Für die Z-Diode bleibt nichts übrig: Die Diode sperrt, I_Z = ' + n('iz', m(a, 'iz'), 0) + ' mA, und die Ausgangsspannung bricht von ' + n('ua0', m(b, 'uaus'), 1) + ' V auf ' + n('ua1', m(a, 'uaus'), 2) + ' V ein; das Gerät bleibt ungeregelt. Die Z-Diode stabilisiert nur, solange ihr Strom über dem Mindeststrom ' +
          n('izmin', z.izmin * 1000, 0) + ' mA bleibt (Übungswert).';
      } },
    /* ---------------------------------------------------------------- Linearregler */
    { id: 'ntx13', name: '7805 an 14 V', cat: 'Linearregler', rig: 'stabil',
      spec: () => ({ preset: '7805-14v' }),
      text(X) {
        const { a, n } = X, C = CORE(), pv = C.lin.loss(g(a, 'ue'), 5, g(a, 'iLast')), eta = C.lin.eta(g(a, 'ue'), 5, g(a, 'iLast'));
        must(close(pv, m(a, 'pv'), 1e-6) && close(eta * 100, m(a, 'eta'), 1e-6) && close(m(a, 'uaus'), 5, 1e-9), 'P_V = (U_ein − U_aus) · I, η = U_aus/U_ein');
        return 'Ein Festspannungsregler 7805 liefert ' + n('ua', m(a, 'uaus'), 0) + ' V bei ' + n('i', g(a, 'iLast'), 1) + ' A aus ' + n('ue', g(a, 'ue'), 0) + ' V. Der Linearregler verbraucht die Differenzspannung als Wärme: P_V = (U_ein − U_aus) · I = (' + n('ue2', g(a, 'ue'), 0) + ' V − ' + n('ua2', m(a, 'uaus'), 0) + ' V) · ' +
          n('i2', g(a, 'iLast'), 1) + ' A = ' + n('pv', m(a, 'pv'), 1) + ' W (Pool-Aufgabe). Nutzbar sind nur ' + n('pab', m(a, 'uaus') * g(a, 'iLast'), 1) + ' W, der Wirkungsgrad beträgt η = U_aus / U_ein = ' + n('eta', m(a, 'eta'), 1) + ' %. Kühlung und Sperrschichttemperatur rechnest du im Thermik-Lab.';
      } },
    { id: 'ntx14', name: '7805 an 9 V gegen 15 V', cat: 'Linearregler', rig: 'stabil',
      spec: () => ({ preset: '7805-14v', ctl: { ue: 9, iLast: 0.3 }, ref: { ue: 15, iLast: 0.3 } }),
      text(X) {
        const { a, b, S, n } = X, C = CORE(), tief = S({ ue: 6 }), dmin = lim('dropout_7805');
        must(close(m(a, 'pv'), (9 - 5) * 0.3, 1e-6) && close(m(b, 'pv'), (15 - 5) * 0.3, 1e-6) && m(a, 'eta') > m(b, 'eta') && g(a, 'ue') >= 5 + dmin && g(tief, 'ue') < 5 + dmin && m(tief, 'uaus') < 5 && diagIds(tief).includes('regler-dropout'), 'P_V und Dropout');
        return 'Je höher die Eingangsspannung, desto mehr Wärme im Linearregler: Bei ' + n('i', g(a, 'iLast'), 1) + ' A ist P_V = ' + n('p1', m(a, 'pv'), 1) + ' W aus ' + n('ue1', g(a, 'ue'), 0) + ' V (η = ' + n('e1', m(a, 'eta'), 1) + ' %), aber ' + n('p2', m(b, 'pv'), 1) + ' W aus ' + n('ue2', g(b, 'ue'), 0) +
          ' V (η = ' + n('e2', m(b, 'eta'), 1) + ' %). Nach unten gibt es eine Grenze: Der Regler braucht mindestens ' + n('dm', dmin, 0) + ' V Abstand zwischen Eingang und Ausgang (Übungswert, Datenblatt maßgeblich), also ' + n('um', 5 + dmin, 0) + ' V am Eingang. Bei ' + n('ue3', g(tief, 'ue'), 0) +
          ' V (Dropout) erreicht der Ausgang nur noch ' + n('ua3', m(tief, 'uaus'), 1) + ' V und regelt nicht mehr.';
      } },
    { id: 'ntx15', name: 'LM317 einstellen', cat: 'Linearregler', rig: 'stabil',
      spec: () => ({ preset: 'lm317-9v', ctl: { r1: 240, r2: 970 } }),
      text(X) {
        const { a, n } = X, C = CORE(), l = C.lin.lm317({ R1: g(a, 'r1'), R2: g(a, 'r2') });
        must(l.ok && close(l.Uaus, m(a, 'uaus'), 1e-9) && close(l.Uaus, 1.25 * (1 + g(a, 'r2') / g(a, 'r1')), 1e-9), 'U_aus = 1,25 V · (1 + R2/R1)');
        return 'Der LM317 hält zwischen Ausgang und Adjust-Anschluss die Referenzspannung 1,25 V. Der Teiler aus R1 (Ausgang nach Adjust, ' + n('r1', g(a, 'r1'), 0) + ' Ω) und R2 (Adjust nach Masse, ' + n('r2', g(a, 'r2'), 0) + ' Ω, in der Pool-Aufgabe Festwiderstand plus Poti) stellt die Ausgangsspannung ein: U_aus = 1,25 V · (1 + R2 / R1) = ' +
          n('ua', m(a, 'uaus'), 3) + ' V. Der Adjust-Strom ist vernachlässigt. Mit größerem R2 steigt die Ausgangsspannung, mit R2 = ' + n('r20', 0, 0) + ' Ω sind es nur noch die ' + n('uref', 1.25, 2) + ' V der Referenz. Am Eingang braucht der Regler mindestens ' + n('dm', lim('dropout_317'), 0) + ' V mehr als am Ausgang (Übungswert).';
      } },
    { id: 'ntx16', name: '7805 durch LM317 ersetzen', cat: 'Linearregler', rig: 'stabil',
      spec: () => ({ preset: 'lm317-9v', ctl: { art: 'lm317', r1: 240, r2: 720 }, ref: { art: '7805' } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), r2 = C.lin.r2For(5, 240);
        must(close(r2, 720, 1e-9) && close(m(a, 'uaus'), 5, 1e-6) && close(m(b, 'uaus'), 5, 1e-9) && g(b, 'art') !== g(a, 'art'), 'R2 für 5 V, beide Regler liefern 5 V');
        return 'Der 7805 hat eine feste Ausgangsspannung (IN, GND, OUT). Der LM317 braucht dafür einen Spannungsteiler OUT–ADJ–GND: R1 zwischen Ausgang und Adjust, R2 zwischen Adjust und Masse (Pool-Aufgabe zum Austausch). Für ' + n('ua', 5, 0) + ' V bei R1 = ' + n('r1', g(a, 'r1'), 0) + ' Ω folgt R2 = R1 · (U_aus / 1,25 V − 1) = ' +
          n('r2', r2, 0) + ' Ω. Dann liefert der Prüfstand ' + n('ua2', m(a, 'uaus'), 3) + ' V, vorher mit dem 7805 ' + n('ua1', m(b, 'uaus'), 3) + ' V: Die Ausgangsspannung bleibt erhalten, nur der Teiler ist neu. Ohne den Teiler würde der LM317 am Adjust-Anschluss keine Spannung kennen.';
      } },
    { id: 'ntx17', name: 'Strombegrenzung mit Messwiderstand', cat: 'Linearregler', rig: 'stabil',
      spec: () => ({ preset: 'kurzschluss-t2' }),
      text(X) {
        const { a, n } = X, C = CORE(), l = C.lin.limitT2({ R3: g(a, 'r3') });
        must(l.ok && close(l.Ilim, m(a, 'iaus'), 1e-6) && close(l.Ilim, lim('ube') / g(a, 'r3'), 1e-6) && g(a, 'kurz') === 1 && m(a, 'pv') > 5, 'I_lim = U_BE / R3, Kurzschluss-Verlust');
        return 'Ein zweiter Transistor T2 misst den Spannungsabfall am Messwiderstand R3 im Laststrom. Sobald er die Basis-Emitter-Schwelle ' + n('ube', lim('ube'), 1) + ' V erreicht, leitet T2 und nimmt dem Längstransistor den Basisstrom: I_lim = U_BE / R3 = ' + n('ube2', lim('ube'), 1) + ' V / ' + n('r3', g(a, 'r3'), 1) + ' Ω = ' + n('il', l.Ilim, 2) +
          ' A (Pool-Aufgabe). Im Kurzschluss begrenzt die Schaltung auf ' + n('ik', m(a, 'iaus'), 2) + ' A, doch die ganze Eingangsspannung ' + n('ue', g(a, 'ue'), 0) + ' V fällt im Regler ab: P_V = ' + n('pv', m(a, 'pv'), 1) + ' W. Die Strombegrenzung schützt die Last, der Regler wird dabei heiß.';
      } },
    /* ---------------------------------------------------------------- Tiefsetzsteller */
    { id: 'ntx18', name: 'Linear gegen Schaltregler', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v', ctl: { iout: 0.4 } }),
      text(X) {
        const { a, n } = X, C = CORE(), v = C.loss.vsLinear({ Uin: 12, Uout: 5, Iout: 0.4, etaSchalt: 0.88 });
        must(v.ok && close(v.PvLin, 2.8, 1e-9) && close(v.PvSchalt, 0.2727, 1e-3) && close(v.diff, 2.527, 1e-3) && m(a, 'eta') > 80, 'Linear 2,8 W, Schaltregler 0,273 W');
        return 'Bei ' + n('ua', 5, 0) + ' V und ' + n('i', g(a, 'iout'), 1) + ' A aus ' + n('ue', g(a, 'uin'), 0) + ' V (P_ab = ' + n('pab', 5 * 0.4, 1) + ' W) verbrät ein Linearregler P_V = (U_ein − U_aus) · I = ' + n('pl', v.PvLin, 1) + ' W (η = ' + n('el', v.etaLin * 100, 1) + ' %). Ein Schaltregler mit η = ' + n('es', v.etaSchalt * 100, 0) +
          ' % (Pool-Aufgabe) verliert nur P_V = P_ab · (1 / η − 1) = ' + n('ps', v.PvSchalt, 3) + ' W: ' + n('df', v.diff, 3) + ' W weniger Wärme. Der Prüfstand rechnet seinen Wirkungsgrad aus den Einzelverlusten und kommt auf η = ' + n('ep', m(a, 'eta'), 1) + ' %. Dafür braucht der Schaltregler Drossel, Diode und Schalter und erzeugt Störungen (siehe EMV-Lab).';
      } },
    { id: 'ntx19', name: 'Tastverhältnis 12 V auf 5 V', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v' }),
      text(X) {
        const { a, n } = X, C = CORE(), c = C.buck.ccm({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), f: g(a, 'f') * 1e3, L: g(a, 'l') / MIKRO });
        must(c.ok && close(c.D * 100, m(a, 'd'), 1e-6) && close(c.D, g(a, 'uout') / g(a, 'uin'), 1e-9) && close(c.T * 1e6, 1000 / g(a, 'f'), 1e-6), 'D = U_aus / U_ein');
        return 'Der Tiefsetzsteller schaltet die Eingangsspannung ' + n('ue', g(a, 'uin'), 0) + ' V mit der Schaltfrequenz f = ' + n('f', g(a, 'f'), 0) + ' kHz (Periode T = ' + n('t', c.T * 1e6, 0) + ' µs) auf die Drossel. Der Mittelwert am Ausgang ist U_aus = D · U_ein, also D = U_aus / U_ein = ' + n('ua', g(a, 'uout'), 0) + ' V / ' + n('ue2', g(a, 'uin'), 0) +
          ' V = ' + n('d', m(a, 'd'), 2) + ' %. Der Schalter ist ' + n('ton', c.D * c.T * 1e6, 2) + ' µs an und ' + n('toff', (1 - c.D) * c.T * 1e6, 2) + ' µs aus; in der Ausschaltzeit führt die Freilaufdiode den Drosselstrom weiter.';
      } },
    { id: 'ntx20', name: 'Drosselstrom-Welligkeit', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v' }),
      text(X) {
        const { a, n } = X, C = CORE(), c = C.buck.ccm({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), Iout: g(a, 'iout'), f: g(a, 'f') * 1e3, L: g(a, 'l') / MIKRO });
        must(c.ok && close(c.dIL, m(a, 'dIL'), 1e-6) && close(c.dIL, (g(a, 'uin') - g(a, 'uout')) * c.D / (g(a, 'f') * 1e3 * g(a, 'l') / MIKRO), 1e-6) && close(m(a, 'iLmax'), g(a, 'iout') + c.dIL / 2, 1e-6) && c.ccm, 'ΔI_L = (U_ein − U_aus) · D / (f · L)');
        return 'Während der Einschaltzeit liegt die Differenz U_ein − U_aus an der Drossel L = ' + n('l', g(a, 'l'), 0) + ' µH, der Strom steigt linear: ΔI_L = (U_ein − U_aus) · D / (f · L) = ' + n('dil', m(a, 'dIL'), 4) + ' A bei f = ' + n('f', g(a, 'f'), 0) + ' kHz. Um den Mittelwert I_aus = ' + n('i', g(a, 'iout'), 1) +
          ' A schwankt der Drosselstrom als Dreieck zwischen I_Lmin = ' + n('imin', m(a, 'iLmin'), 3) + ' A und I_Lmax = ' + n('imax', m(a, 'iLmax'), 3) + ' A. Weil I_Lmin über null bleibt, läuft der Wandler nicht lückend (Grenzstrom I_krit = ΔI_L / 2 = ' + n('ik', c.Ikrit, 3) + ' A). Der Ausgangskondensator glättet nur diesen Dreieckanteil.';
      } },
    { id: 'ntx21', name: 'L zu klein: lückender Betrieb', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: 'l-klein-lueckt', ctl: { iout: 0.3 }, ref: { l: 100 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), c = C.buck.ccm({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), Iout: g(a, 'iout'), f: g(a, 'f') * 1e3, L: g(a, 'l') / MIKRO }), lk = C.buck.lcrit({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), Imin: g(a, 'iout'), f: g(a, 'f') * 1e3 });
        must(c.ok && c.lueckt && !c.ccm && c.Ikrit > g(a, 'iout') && diagIds(a).includes('lueckt') && !diagIds(b).includes('lueckt') && lk && lk.ok !== false, 'I_krit über I_aus: lückt; Vorher nicht');
        const lc = lk.Lkrit;
        must(fin(lc) && lc > g(a, 'l') / MIKRO && lk.nichtLueckend === undefined, 'L_krit größer als L');
        return 'Mit L = ' + n('l', g(a, 'l'), 0) + ' µH statt ' + n('l0', g(b, 'l'), 0) + ' µH ist die Stromwelligkeit so groß, dass der Drosselstrom bei der kleinen Last ' + n('i', g(a, 'iout'), 2) + ' A in jeder Periode auf 0 A fällt: Der Grenzstrom I_krit = ' + n('ik', c.Ikrit, 2) + ' A liegt über dem Laststrom, der Wandler lückt (Lückbetrieb). ' +
          'Dann stimmt D = U_aus / U_ein nicht mehr; der Regler muss D auf ' + n('d', m(a, 'd'), 2) + ' % verkleinern, um dieselben ' + n('ua', g(a, 'uout'), 0) + ' V zu halten (vorher ' + n('d0', m(b, 'd'), 2) + ' %). Für diese Last wäre mindestens L_krit = ' + n('lc', lc * MIKRO, 0) + ' µH nötig.';
      } },
    { id: 'ntx22', name: 'Schaltfrequenz verdoppeln', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v', ctl: { f: 200 }, ref: { f: 100 } }),
      text(X) {
        const { a, b, n } = X, pa = bparts(a), pb = bparts(b);
        must(close(m(a, 'dIL'), m(b, 'dIL') / 2, 1e-6) && close(pa.schalt, 2 * pb.schalt, 1e-6) && close(pa.gate, 2 * pb.gate, 1e-6) && m(a, 'eta') < m(b, 'eta'), 'ΔI_L halbiert, Schaltverlust verdoppelt, η sinkt');
        return 'Bei höherer Schaltfrequenz bleibt die Drossel kürzer unter Spannung: ΔI_L = (U_ein − U_aus) · D / (f · L) halbiert sich von ' + n('d1', m(b, 'dIL'), 4) + ' A (bei ' + n('f1', g(b, 'f'), 0) + ' kHz) auf ' + n('d2', m(a, 'dIL'), 4) + ' A (bei ' + n('f2', g(a, 'f'), 0) + ' kHz). Dafür steigen die Verluste, die je Umschaltung anfallen: Der Schaltverlust verdoppelt sich von ' +
          n('s1', pb.schalt, 3) + ' W auf ' + n('s2', pa.schalt, 3) + ' W, der Gate-Verlust von ' + n('g1', pb.gate, 3) + ' W auf ' + n('g2', pa.gate, 3) + ' W. Der Wirkungsgrad sinkt von ' + n('e1', m(b, 'eta'), 1) + ' % auf ' + n('e2', m(a, 'eta'), 1) + ' %. Die Schaltfrequenz ist ein Kompromiss zwischen Baugröße der Drossel und Verlust.';
      } },
    { id: 'ntx23', name: 'Wirkungsgrad aufschlüsseln', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v' }),
      text(X) {
        const { a, n } = X, p = bparts(a), sum = p.leitung + p.diode + p.schalt + p.gate + p.drossel + p.kondensator + p.ruhe, pab = g(a, 'uout') * g(a, 'iout');
        must(p.ok && fin(sum) && close(sum, 0.3285, 2e-3) && close(100 * pab / (pab + sum), m(a, 'eta'), 1e-5) && p.diode > p.leitung && p.diode > p.schalt, 'Σ Verluste 0,3285 W, η aus Einzelverlusten, Diode größter Posten');
        return 'Der Wirkungsgrad ist keine Schätzung, er folgt aus den Einzelverlusten: Leitverlust im Schalter ' + n('pc', p.leitung, 3) + ' W, Diode ' + n('pd', p.diode, 3) + ' W, Schalten ' + n('ps', p.schalt, 3) + ' W, Gate-Ansteuerung ' + n('pg', p.gate, 3) + ' W, Drosselkupfer ' + n('pl', p.drossel, 3) + ' W und Kondensator-ESR ' + n('pk', p.kondensator, 4) + ' W. Die Summe ist P_V = ' + n('pv', sum, 4) +
          ' W bei P_ab = ' + n('pab', pab, 0) + ' W. Daraus folgt η = P_ab / (P_ab + P_V) = ' + n('eta', m(a, 'eta'), 1) + ' %. Der größte Posten ist die Diode: Die Diode führt in der Ausschaltzeit den ganzen Laststrom bei der Durchlassspannung ' + n('uf', lim('uf_schottky'), 1) + ' V (Übungswert).';
      } },
    { id: 'ntx24', name: 'Synchrongleichrichter', cat: 'Tiefsetzsteller', rig: 'buck',
      spec: () => ({ preset: '12v-5v', ctl: { uf: 'sync' }, ref: { uf: 'diode' } }),
      text(X) {
        const { a, b, n } = X, pa = bparts(a), pb = bparts(b);
        must(gs(a, 'uf') === 'sync' && gs(b, 'uf') === 'diode' && m(a, 'eta') > m(b, 'eta') && pa.diode < pb.diode, 'Synchrongleichrichter: kleinerer Diodenverlust, höheres η');
        return 'Statt der Freilaufdiode schaltet ein zweiter MOSFET (Synchrongleichrichter) in der Ausschaltzeit ein. An ihm fällt nur I · R_ds,on ab statt der Durchlassspannung der Diode: Der Verlust im Freilaufzweig sinkt von ' + n('pd', pb.diode, 3) + ' W auf ' + n('ps', pa.diode, 3) + ' W. Der Wirkungsgrad steigt von ' + n('e1', m(b, 'eta'), 1) + ' % auf ' + n('e2', m(a, 'eta'), 1) +
          ' %. Dafür braucht der Wandler eine zweite Ansteuerung mit Totzeit, damit beide Schalter nie gleichzeitig leiten (siehe Gate-Prüfstand).';
      } },
    /* ---------------------------------------------------------------- Hochsetzsteller, Inverswandler, Sperrwandler */
    { id: 'ntx25', name: 'Hochsetzsteller 5 V auf 12 V', cat: 'Wandlerarten', rig: 'topo',
      spec: () => ({ preset: 'boost-5-12' }),
      text(X) {
        const { a, n } = X, C = CORE(), c = C.boost.ccm({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), Iout: g(a, 'iout'), f: g(a, 'f'), L: g(a, 'l') / MIKRO });
        must(c.ok && close(c.D * 100, m(a, 'd'), 1e-6) && close(c.D, 1 - g(a, 'uin') / g(a, 'uout'), 1e-9) && close(m(a, 'iL'), g(a, 'iout') / (1 - c.D), 1e-6), 'D = 1 − U_ein/U_aus, I_L = I_aus/(1 − D)');
        return 'Der Hochsetzsteller erzeugt aus ' + n('ue', g(a, 'uin'), 0) + ' V die höhere Spannung ' + n('ua', g(a, 'uout'), 0) + ' V: Die Drossel speichert bei geschlossenem Schalter Energie und gibt sie über die Diode zusätzlich zur Eingangsspannung an den Ausgang. Das Tastverhältnis ist D = 1 − U_ein / U_aus = ' + n('d', m(a, 'd'), 2) +
          ' %. Der Drosselstrom ist größer als der Ausgangsstrom ' + n('io', g(a, 'iout'), 1) + ' A, weil er nur in der Ausschaltzeit zum Ausgang fließt: I_L = I_aus / (1 − D) = ' + n('il', m(a, 'iL'), 2) + ' A. Die Welligkeit beträgt ΔI_L = ' + n('dil', m(a, 'dIL'), 4) + ' A.';
      } },
    { id: 'ntx26', name: 'Inverswandler 12 V auf minus 5 V', cat: 'Wandlerarten', rig: 'topo',
      spec: () => ({ preset: 'invers-12-m5' }),
      text(X) {
        const { a, n } = X, C = CORE(), c = C.bb.ccm({ Uin: g(a, 'uin'), Uout: -g(a, 'uout'), Iout: g(a, 'iout'), f: g(a, 'f'), L: g(a, 'l') / MIKRO });
        must(c.ok && close(c.D * 100, m(a, 'd'), 1e-6) && close(c.D, g(a, 'uout') / (g(a, 'uin') + g(a, 'uout')), 1e-9) && c.Uout < 0, 'D = |U_aus| / (U_ein + |U_aus|), negative Ausgangsspannung');
        return 'Der Inverswandler (Buck-Boost) liefert eine Spannung mit umgekehrtem Vorzeichen: aus ' + n('ue', g(a, 'uin'), 0) + ' V entstehen ' + n('ua', c.Uout, 0) + ' V gegen Masse (Pool-Aufgabe zum Inverswandler). Die Drossel lädt sich bei geschlossenem Schalter auf und entlädt sich in der Ausschaltzeit in umgekehrter Richtung über die Diode in den Ausgangskondensator. ' +
          'Das Tastverhältnis ist D = |U_aus| / (U_ein + |U_aus|) = ' + n('d', m(a, 'd'), 2) + ' %. Der Drosselstrom ist mit I_L = ' + n('il', m(a, 'iL'), 2) + ' A deutlich größer als der Ausgangsstrom ' + n('io', g(a, 'iout'), 1) + ' A. Ein Tief- oder Hochsetzsteller kann das nicht, weil er das Vorzeichen nicht umkehrt.';
      } },
    { id: 'ntx27', name: 'Sperrwandler potentialgetrennt', cat: 'Wandlerarten', rig: 'topo',
      spec: () => ({ preset: 'sperr-n1', ref: { topo: 'invers' } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), c = C.fly.ccm({ Uin: g(a, 'uin'), Uout: g(a, 'uout'), n: g(a, 'n'), Iout: g(a, 'iout'), f: g(a, 'f'), L: g(a, 'l') / MIKRO });
        must(c.ok && close(c.D * 100, m(a, 'd'), 1e-6) && close(c.D, g(a, 'uout') / (g(a, 'uout') + g(a, 'n') * g(a, 'uin')), 1e-9) && close(m(a, 'd'), m(b, 'd'), 1e-6) && close(m(a, 'trennung'), 1, 1e-9) && close(m(b, 'trennung'), 0, 1e-9), 'Sperrwandler: gleiche D wie Inverswandler bei n = 1, Trennung');
        return 'Der Sperrwandler (Flyback) ersetzt die Drossel durch einen Übertrager mit Luftspalt: Bei geschlossenem Schalter speichert die Primärwicklung Energie, in der Sperrphase gibt die Sekundärwicklung sie über die Diode ab. Mit dem Windungsverhältnis n = N2 / N1 = ' + n('n', g(a, 'n'), 0) + ' ist D = U_aus / (U_aus + n · U_ein) = ' +
          n('d', m(a, 'd'), 2) + ' % für ' + n('ua', g(a, 'uout'), 0) + ' V aus ' + n('ue', g(a, 'uin'), 0) + ' V, derselbe Wert wie beim Inverswandler (' + n('db', m(b, 'd'), 2) + ' %). Der Vorteil ist die galvanische Trennung zwischen Ein- und Ausgang. Netzseitig eingesetzt wird der Sperrwandler hier nur als Begriff erklärt, nicht nachgebaut.';
      } },
    { id: 'ntx28', name: 'Welche Topologie?', cat: 'Wandlerarten', rig: 'topo',
      spec: () => ({ preset: 'boost-5-12' }),
      text(X) {
        const { a, n } = X, C = CORE(), fall = [{ Uin: 12, Uout: 5 }, { Uin: 5, Uout: 12 }, { Uin: 12, Uout: -5 }, { Uin: 12, Uout: 5, getrennt: true }], t = fall.map(f => C.topology(f));
        must(t.every(x => x && x.ok) && t[0].topo === 'buck' && t[1].topo === 'boost' && t[2].topo === 'bb' && t[3].topo === 'fly' && st(a, 'empfohlen') === 'boost', 'Topologiewahl für vier Fälle');
        return 'Die Wahl der Grundschaltung folgt aus Eingangs- und Ausgangsspannung: ' + n('a1', 12, 0) + ' V auf ' + n('b1', 5, 0) + ' V (kleiner, gleiches Vorzeichen) gehört zum ' + t[0].name + ', ' + n('a2', 5, 0) + ' V auf ' + n('b2', 12, 0) + ' V (größer) zum ' + t[1].name + ', ' + n('a3', 12, 0) + ' V auf ' + n('b3', -5, 0) + ' V (umgekehrtes Vorzeichen) zum ' + t[2].name +
          ' und ' + n('a4', 12, 0) + ' V auf ' + n('b4', 5, 0) + ' V mit galvanischer Trennung zum ' + t[3].name + '. Im Prüfstand ist ' + n('a5', g(a, 'uin'), 0) + ' V auf ' + n('b5', g(a, 'uout'), 0) + ' V eingestellt; die Empfehlung des Kerns lautet ' + a.s.topoName + '. Ein Linearregler wäre bei großer Differenz möglich, aber verlustreich.';
      } },
    /* ---------------------------------------------------------------- Gate */
    { id: 'ntx29', name: 'Gate-Widerstand und Schaltzeit', cat: 'Gate', rig: 'gate',
      spec: () => ({ preset: 'rg-klein-gross', ctl: { rg: 10 }, ref: { rg: 47 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), d = C.gate.drive({ UG: g(a, 'ug'), Rg: g(a, 'rg'), Qg: g(a, 'qg') * 1e-9, Qgd: g(a, 'qgd') * 1e-9 }), d2 = C.gate.drive({ UG: g(b, 'ug'), Rg: g(b, 'rg'), Qg: g(b, 'qg') * 1e-9, Qgd: g(b, 'qgd') * 1e-9 });
        must(d.ok && d2.ok && close(d.Ig_plateau, 0.55, 1e-6) && close(d.t_sw * 1e9, 9.09, 1e-3) && close(d.t_sw * 1e9, m(a, 'tsw'), 1e-6) && close(d2.t_sw * 1e9, m(b, 'tsw'), 1e-6) && m(b, 'tsw') > m(a, 'tsw') && m(b, 'psw') > m(a, 'psw'), 'Gate-Strom 0,55 A, t_sw 9,09 ns, größeres R_g langsamer');
        return 'Der Gate-Widerstand R_g bestimmt, wie schnell die Gate-Ladung Q_gd (' + n('qgd', g(a, 'qgd'), 0) + ' nC) fließt. Auf dem Miller-Plateau (' + n('up', d.Uplat, 1) + ' V, Übungswert) treibt die Treiberspannung U_G = ' + n('ug', g(a, 'ug'), 0) + ' V den Strom I_G = (U_G − U_Plateau) / R_g = ' + n('ig', d.Ig_plateau, 2) + ' A durch R_g = ' + n('rg', g(a, 'rg'), 0) +
          ' Ω; die Schaltzeit ist t_sw = Q_gd / I_G = ' + n('t1', m(a, 'tsw'), 2) + ' ns. Mit R_g = ' + n('rg2', g(b, 'rg'), 0) + ' Ω dauert das Schalten ' + n('t2', m(b, 'tsw'), 1) + ' ns, und der Schaltverlust steigt von ' + n('p1', m(a, 'psw'), 1) + ' mW auf ' + n('p2', m(b, 'psw'), 1) + ' mW. Ein kleiner Gate-Widerstand schaltet schneller, aber härter und stört mehr.';
      } },
    { id: 'ntx30', name: 'Gate-Spannung zu klein', cat: 'Gate', rig: 'gate',
      spec: () => ({ preset: 'ug-zu-klein', ref: { ug: 10 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), d = C.gate.drive({ UG: g(a, 'ug'), Rg: g(a, 'rg'), Qg: g(a, 'qg') * 1e-9, Qgd: g(a, 'qgd') * 1e-9 });
        must(d.ok === false && d.id === 'ug-zu-klein' && st(a, 'ampel') === 'rot' && st(b, 'ampel') !== 'rot', 'U_G unter dem Plateau: ungültig, rot');
        return 'Ein MOSFET schaltet erst durch, wenn die Gate-Spannung über der Plateauspannung ' + n('up', lim('uplat'), 1) + ' V (Übungswert, Datenblatt maßgeblich) liegt. Mit U_G = ' + n('ug', g(a, 'ug'), 0) + ' V erreicht der Treiber das Plateau nicht: Die Gate-Spannung bringt den MOSFET nicht vollständig durch, der Schalter bleibt im linearen Bereich und wird zur Heizung. Die Simulation rechnet deshalb keine Schaltzeit und zeigt ' + ampName(a) +
          '. Vorher, mit U_G = ' + n('ug0', g(b, 'ug'), 0) + ' V, lag die Gate-Spannung ' + n('res', g(b, 'ug') - lim('uplat'), 1) + ' V über dem Plateau.';
      } },
    { id: 'ntx31', name: 'Totzeit in der Halbbrücke', cat: 'Gate', rig: 'gate',
      spec: () => ({ preset: 'totzeit', ref: { ton: 100 } }),
      text(X) {
        const { a, b, n } = X;
        must(g(a, 'halbbruecke') === 1 && m(a, 'querstrom') > 0 && close(m(b, 'querstrom'), 0, 1e-9) && g(a, 'ton') < m(a, 'tAus') && diagIds(a).includes('querstrom'), 'Totzeit kürzer als Ausschaltzeit: Querstrom');
        return 'In der Halbbrücke dürfen der obere und der untere Schalter nie gleichzeitig leiten. Deshalb wartet die Ansteuerung nach dem Ausschalten die Totzeit ab. Der obere Schalter braucht aber die Ausschaltzeit ' + n('toff', m(a, 'tAus'), 1) + ' ns (aus Q_g und R_g gerechnet): Ist die Totzeit mit ' + n('ton', g(a, 'ton'), 0) + ' ns kürzer, überlappen beide Schalter ' + n('qs', m(a, 'querstrom'), 1) +
          ' ns lang und es fließt ein Querstrom von der Eingangsspannung nach Masse. Mit einer Totzeit von ' + n('ton0', g(b, 'ton'), 0) + ' ns (Übungswert, Datenblatt maßgeblich) entsteht keine Überlappung (' + n('qs0', m(b, 'querstrom'), 0) + ' ns). Zu viel Totzeit kostet dagegen Wirkungsgrad, weil der Strom in dieser Zeit durch die Diode fließt.';
      } },
    /* ---------------------------------------------------------------- Regelkreis */
    { id: 'ntx32', name: 'Rückkopplungsteiler', cat: 'Regelkreis', rig: 'regel',
      spec: () => ({ preset: 'lastsprung', ctl: { lastsprung: 0.5 } }),
      text(X) {
        const { a, S, n } = X, C = CORE(), r2 = C.lin.r2For(9, 1000), o = S({ offen: 'R1' }), p = S({ offen: 'R2' });
        must(close(r2, 6200, 1e-9) && close(m(a, 'uaus'), 9, 1e-6) && close(m(o, 'uaus'), g(a, 'uref'), 1e-6) && m(p, 'uaus') > m(a, 'uaus'), 'R2 für 9 V, R1 offen: nur U_ref, R2 offen: Anschlag');
        return 'Der Regler vergleicht eine Referenz mit dem Bruchteil der Ausgangsspannung, den der Teiler abgreift. Pool-Aufgabe (Schaltregler-IC): R1 liegt nach Masse, R2 zum Ausgang, U_A = ' + n('uref', g(a, 'uref'), 2) + ' V · (1 + R2 / R1). Mit R1 = ' + n('r1', g(a, 'r1'), 0) + ' Ω und U_A = ' + n('ua', 9, 1) + ' V folgt R2 = R1 · (U_A / U_ref − 1) = ' + n('r2', r2, 0) +
          ' Ω; der Prüfstand zeigt dann ' + n('ua2', m(a, 'uaus'), 1) + ' V. Fällt R1 aus (offen), sieht der Regler keinen Teiler mehr und der Ausgang geht auf die Referenz zurück: ' + n('uo1', m(o, 'uaus'), 2) + ' V, viel zu niedrig. Fällt R2 aus, fehlt die Rückkopplung und der Ausgang läuft zum Anschlag (' + n('uo2', m(p, 'uaus'), 1) + ' V).';
      } },
    { id: 'ntx33', name: 'Labornetzteil CV und CC', cat: 'Regelkreis', rig: 'regel',
      spec: () => ({ preset: 'lab-cv', ref: { rlast: 8 }, seq: [{ t: 0, set: { rlast: 20 } }, { t: 5, set: { rlast: 8 } }], dur: 10 }),
      text(X) {
        const { a, b, S, n } = X, C = CORE(), cv = S({ rlast: 20 }), cc = S({ rlast: 8 }), k = C.lab.cvcc({ Uset: g(a, 'uset'), Iset: g(a, 'iset'), Rlast: 20, Rs: g(a, 'rs'), Uin: g(a, 'uin') });
        must(k.ok && close(k.Rkrit, g(a, 'uset') / g(a, 'iset'), 1e-9) && close(m(cv, 'uaus'), 12, 1e-6) && close(m(cv, 'iaus'), 0.6, 1e-6) && close(m(cc, 'uaus'), 8, 1e-6) && close(m(cc, 'iaus'), 1, 1e-6) && m(cv, 'modus') === 1 && m(cc, 'modus') === 0, 'CV bei 20 Ω, CC bei 8 Ω, R_krit = U_set/I_set');
        return 'Ein Labornetzteil regelt die Spannung (CV, Constant Voltage), solange der Laststrom unter der eingestellten Grenze bleibt, und danach den Strom (CC, Constant Current). Der Übergang liegt beim Grenzwiderstand R_krit = U_set / I_set = ' + n('us', g(a, 'uset'), 0) + ' V / ' + n('is', g(a, 'iset'), 0) + ' A = ' + n('rk', k.Rkrit, 0) + ' Ω. Mit der Last ' +
          n('r1', 20, 0) + ' Ω arbeitet das Gerät in CV: ' + n('u1', m(cv, 'uaus'), 0) + ' V und nur ' + n('i1', m(cv, 'iaus'), 1) + ' A. Mit ' + n('r2', 8, 0) + ' Ω würde der Strom die Grenze überschreiten; das Gerät schaltet auf CC, hält ' + n('i2', m(cc, 'iaus'), 0) + ' A und die Spannung sinkt auf ' + n('u2', m(cc, 'uaus'), 1) + ' V. Der Verlauf-Ablauf wechselt nach 5 s von der einen Last zur anderen.';
      } },
    /* ---------------------------------------------------------------- Fehlersuche */
    { id: 'ntx34', name: 'Netzteil ohne Ausgang', cat: 'Fehlersuche', rig: 'fehler',
      spec: () => ({ ctl: { netz: 'buck', fehler: 'diode-offen-schalt' }, acts: ['sicht', 'messe:u_aus', 'messe:u_sw'],
        seq: [{ t: 0, do: 'sicht' }, { t: 1, do: 'messe:u_aus' }, { t: 2, do: 'messe:u_sw' }], dur: 4 }),
      text(X) {
        const { a, n } = X, C = CORE(), f = C.fault.catalog.find(x => x.id === 'diode-offen-schalt'), mw = st(a, 'messwerte') || [];
        const ua = mw.find(x => /Ausgangsspannung/.test(x.name || '')), sw = mw.find(x => /Schaltknoten/.test(x.name || ''));
        must(f && st(a, 'fehlerId') === 'diode-offen-schalt' && ua && sw && ua.abweichung && sw.abweichung && fin(ua.soll) && fin(sw.soll) && /erwärmt/.test(st(a, 'sichtText') || ''), 'Fehlerbild Freilaufdiode offen, Sichtprüfung und Messwerte abweichend');
        return 'Das Gerät in der Simulation, ein Tiefsetzsteller, hat keine Ausgangsspannung. So gehst du vor: erst die Sichtprüfung (kostet nichts und zeigt oft schon das Bauteil), dann die Messpunkte. Die Sichtprüfung meldet: ' + st(a, 'sichtText').replace(/^Sichtprüfung: /, '') + ' Am Ausgang liegen ' + n('ua', ua.value, 0) + ' V statt der Sollspannung ' + n('us', ua.soll, 0) + ' V, am Schaltknoten im Mittel ' + n('sw', sw.value, 0) + ' V statt ' + n('sws', sw.soll, 0) + ' V. Das passt zum Fehlerbild „' + f.name +
          '“: ' + f.symptom + ' Der Fehler wird erst begründet, wenn ein Messwert zum Fehler passt; gleich ein Bauteil zu tauschen, ohne gemessen zu haben, zählt als Fehler. Alle Werte sind simuliert; die Fehlersuche beginnt am freigeschalteten Gerät in der Simulation, nie an Netzspannung.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs || !C.exercise) return [];
    for (const k of ['trafo', 'gleich', 'stabil', 'buck', 'topo', 'gate', 'regel', 'fehler']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), preset = d.preset ? R.defs[def.rig].presets.find(p => p.id === d.preset) : null;
        if (d.preset && !preset) throw new Error('Voreinstellung „' + d.preset + '“ fehlt');
        const base = Object.assign({}, preset ? (preset.controls || preset.params || {}) : {}, d.ctl || {});
        const controls = fullCtl(def.rig, base);
        const acts = d.acts ? d.acts.slice() : d.fire ? ['fire'] : [];
        const S = (over, act) => snap(def.rig, Object.assign({}, controls, over || {}), act === undefined ? acts : act);
        const refCtl = d.ref ? Object.assign({}, controls, d.ref) : null;
        const X = { a: S({}), b: d.ref ? snap(def.rig, refCtl, []) : null, S };
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
  const NTS_DATA = {};
  Object.defineProperty(NTS_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  NTS_DATA.exampleCount = EXDEFS.length;
  NTS_DATA.exampleIds = EXDEFS.map(d => d.id);
  NTS_DATA.rebuild = () => buildExamples();                  // Neuberechnung ohne Zwischenspeicher (Tests: Determinismus)
  root.NTS_DATA = NTS_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.NTS_DATA.examples; }, tasks, register, NTS_TASKS, answerOf, clean, snap };
})(typeof window !== 'undefined' ? window : globalThis);
