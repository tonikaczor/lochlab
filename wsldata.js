/* wsldata.js - WSL-Lab (Wechselstrom und Schwingkreise): Beispiele (WSL_DATA) und Aufgabenregister (WSL_TASKS), ohne Browser lauffaehig (WP4a).
 * Quelle: quelle/wsllab/_wp4a/p1_util.js + p2_examples.js, zusammengesetzt mit `node quelle/wsllab/_wp4a/build_wsl.js` (nach Aenderungen neu bauen).
 *
 * window.WSL_DATA  = { examples: [ { id:'wsx1'..'wsx34', name, cat, rig, desc, controls, ref?, seq?, dur?, vals } ], exampleCount, exampleIds, rebuild }
 *   Alle Zahlen in `desc` kommen aus der Simulation (WSL_RIGS) und dem Kern (WSL_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff gerechnet (Getter);
 *   fehlen Kern oder Pruefstaende, enthaelt der Eintrag `error` und eine ehrliche Meldung statt einer Beschreibung (wslui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Pruefstands (Zustand bei Beginn bzw. NACHHER), ref = abweichende Steuerwerte des Zustands VORHER, seq im Format von WSL_CORE.runSeq
 *   (t in Sekunden: set | ramp | fire), dur in Sekunden. Behauptungen in den Texten stehen hinter must(bedingung, text): Traegt die gerechnete Zahl die Aussage nicht,
 *   meldet sich der Eintrag als fehlerhaft (Regel 2).
 * window.WSL_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in wsltasks1.js (ws1-ws16) und wsltasks2.js (ws17-ws32) und melden sich mit WSL_TASKS.register([...]) an; die Reihenfolge der Registry ist immer
 *   ws1, ws2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'wsN', lab:'wsl', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|String|null}, choices:{key:Wert}, clicks, bericht }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), seq?, value?, fields?, choices?, fired?, bericht? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert [{ name, answer }] mit mindestens zwei absichtlich falschen Antworten (zu klein / zu gross bzw. falsch herum) fuer den Test (Regel 3).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * WSL_TASKS.util (fuer wsltasks1.js, wsltasks2.js und die Tests; Namen wie in elsdata.js, emvdata.js und enrdata.js, damit alle Aufgabendateien dieselbe Huelle benutzen):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); snap(rigId, ctl, act?) -> { ok, rig, m (readMeters), a (assess), d (diagnose), s (state), rejected, errors }
 *   (Pruefstand frisch, Seed 1, Steuerwerte in fester Reihenfolge, gecacht; act = true | 'fire' | 'step:<ms>' | Liste davon); effOf; cdef; dlabel; olabel; setRow;
 *   mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId); numRow(r, val, opt); exRow(r, ex, raw, label); rawOf(a, key); fieldNum; numAns; choiceOf;
 *   calcEx({ kind, given, tol?, extras? } | { value, unit, ... }) -> Rechenuebung mit check(raw) auf Kernwerten (exercise.solve, auch mit festen Poolwerten); calcRow(r, ex, raw, label);
 *   choiceDef(key, frage, optionen[{value,label,reason}]); choiceRow(r, a, spec) (Auswahlfrage mit Fachgrund je falscher Antwort); firedOf(a) (Taste/fire benutzt?);
 *   variants; pctOf; rowsToSeq; lim(id) (Wert aus WSL_CORE.limits); CORE; RIGS; core (= CORE); rigs (= RIGS); nodeReq.
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben. Die Pruefung rechnet immer neu aus den abgegebenen Steuerwerten und den festen Werten der Aufgabe (nur die
 *   freigegebenen Steuerwerte `own` zaehlen; alles andere setzt die Pruefung selbst), nie aus dem angezeigten Zustand.
 * WSL_TASKS.audit(task) und WSL_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) fuer Selbsttest und Tests.
 * Uebungsanlage: Alle Bauteil- und Anlagenwerte sind Uebungswerte. Dies ist ein Simulations- und Uebungslabor, keine Anleitung fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.WSL_CORE) nodeReq('./wslcore.js'); if (root.WSL_CORE && !root.WSL_CORE.exercise) nodeReq('./wslcore-res.js'); return root.WSL_CORE || null; };
  const RIGFILES = ['./wslrig-sinus.js', './wslrig-rlc.js', './wslrig-leistung.js', './wslrig-kompens.js', './wslrig-schwing.js', './wslrig-filter.js', './wslrig-trafo.js', './wslrig-drehstrom.js'];
  const RIGS = id => { let R = root.WSL_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); nodeReq('./wslrig-base.js'); RIGFILES.forEach(nodeReq); R = root.WSL_RIGS; } return R || null; };
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
  const FIRST = ['aufbau', 'art', 'form', 'modus', 'typ', 'dc', 'schaltung', 'gib', 'eingang', 'bezug', 'wert', 'raster', 'ansicht'];
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
    if (unit === '' || unit === 'dB' || unit === '°' || !fin(v) || v === 0) return { value: v, unit, factor: 1 };
    const a = Math.abs(v); let p = PREFS[PREFS.length - 1];
    for (let i = 0; i < PREFS.length; i++) if (a >= PREFS[i][0] * 0.99995) { p = PREFS[i]; break; }
    return { value: v / p[0], unit: p[1] + unit, factor: p[0] };
  }
  const ULIST = ['Hz', 'V', 'A', 'F', 'H', 'Ω', 'Ohm', 'ohm', 'W', 'var', 'VA', 's', 'S', 'dB', '°'];
  function baseUnit(u) {
    if (!u) return '';
    const b = x => (x === 'Ohm' || x === 'ohm' ? 'Ω' : x);
    if (ULIST.includes(u)) return b(u);
    if (u.length >= 2 && 'TGMkKmµμunp'.includes(u[0]) && ULIST.includes(u.slice(1))) return b(u.slice(1));
    return '';
  }
  /* spec = { kind, given } (Kernwerte ueber exercise.solve, Poolzahlen frei waehlbar) oder { value, unit, what, alt?, wrong? } (eigener Wert aus dem Kern);
   * tol (relativ, Standard aus der Kernuebung bzw. 0,03), extras:[{ v (SI), msg }] zusaetzliche typische Fehler, altExtra:[SI] weitere richtige Werte (Tabellenbuch-Rundungen) */
  function calcEx(spec) {
    const C = CORE(); let value, unit, alt = [], wrong = [], disp, tol = 0.03, what = spec.what || '';
    try {
      if (spec.kind) {
        const s = C.exercise.solve(spec.kind, spec.given);
        if (!s || s.ok === false) return { ok: false, why: (s && s.why) || 'Die Aufgabenart ist nicht verfügbar.' };
        value = s.value; unit = s.unit; alt = (s.alt || []).slice(); wrong = (s.wrong || []).map(w => ({ id: w.id, value: w.value, text: w.text }));
        try { const e1 = C.exercise(spec.kind, 1); if (e1 && e1.answer && fin(e1.answer.tol)) tol = e1.answer.tol; if (!what && e1 && e1.answer) what = ''; } catch (e) { /* Standardtoleranz */ }
      } else { value = spec.value; unit = spec.unit || ''; alt = (spec.alt || []).slice(); wrong = (spec.wrong || []).map(w => ({ id: w.id || 'x', value: w.v !== undefined ? w.v : w.value, text: w.msg || w.text })); }
    } catch (e) { return { ok: false, why: 'Der Rechenkern ist nicht verfügbar.' }; }
    if (!fin(value)) return { ok: false, why: 'Die Aufgabe hat keinen gültigen Wert.' };
    if (fin(spec.tol)) tol = spec.tol;
    (spec.altExtra || []).forEach(v => { if (fin(v)) alt.push(v); });
    (spec.extras || []).forEach(x => { if (fin(x.v)) wrong.push({ id: 'extra', value: x.v, text: x.msg }); });
    disp = dispOf(value, unit);
    const T = C.TEXTS;
    const fe = (x, u) => C.fmtEng(x, u);
    const sqT = w => { const ok = w === 3 ? spec.kind === 'pDrehstrom' : ['eff', 'zeitversatz', 'uGeom', 'fgRC', 'cFuerFg', 'siebglied', 'dbDekade'].indexOf(spec.kind) >= 0; return ok ? T.get(w === 3 ? 'wurzel3' : 'wurzel') : T.get('wurzel-allg', { f: w === 3 ? '√3' : '√2' }); };
    const near = (a, b) => Math.abs(a - b) <= tol * Math.abs(b) + 1e-300;
    const ex = { ok: true, kind: spec.kind || null, value, unit, alt, wrong, disp, tol, what,
      check(raw) {
        const q = C.parseQty(raw);
        if (!q || !fin(q.v)) return { ok: false, why: 'keine-zahl', text: T.keineZahl };
        if (q.hasUnit && unit) { const b = baseUnit(q.unit); if (b && b !== unit) return { ok: false, why: 'einheit', text: T.get('einheit', { gesucht: unit }) }; }
        const cands = [q.v]; if (!q.hasUnit && disp.factor !== 1) cands.push(q.v * disp.factor);
        const refs = [value].concat(alt);
        for (let i = 0; i < cands.length; i++) for (let j = 0; j < refs.length; j++) if (near(cands[i], refs[j])) return { ok: true, why: 'richtig', text: T.get('richtig', { was: what, wert: fe(value, unit) }) };
        let a = cands[0];
        if (cands.length > 1 && value !== 0) { const l0 = Math.abs(Math.log(Math.abs(cands[0] / value))), l1 = Math.abs(Math.log(Math.abs(cands[1] / value))); if (l1 < l0) a = cands[1]; }
        for (let k = 0; k < wrong.length; k++) for (let i = 0; i < cands.length; i++) if (near(cands[i], wrong[k].value)) return { ok: false, why: wrong[k].id, text: wrong[k].text };
        if (a !== 0 && value !== 0 && (a > 0) === (value > 0)) {
          const rr = a / value, lr = Math.log(Math.abs(rr)) / Math.LN10;
          if (Math.abs(lr - Math.round(lr)) < 0.012 && Math.round(lr) !== 0) return { ok: false, why: 'vorsatz', text: T.get('vorsatz', { faktor: Math.round(lr) > 0 ? '10^' + Math.round(lr) : '10^(−' + (-Math.round(lr)) + ')' }) };
          if (Math.abs(rr / (2 * Math.PI) - 1) < 0.03 || Math.abs(rr * 2 * Math.PI - 1) < 0.03) return { ok: false, why: 'omega-vergessen', text: T.get('omega-vergessen', { w: fe(a, unit) }) };
          if (Math.abs(rr / Math.SQRT2 - 1) < 0.03 || Math.abs(rr * Math.SQRT2 - 1) < 0.03) return { ok: false, why: 'wurzel', text: sqT(2) };
          if (Math.abs(rr / Math.sqrt(3) - 1) < 0.03 || Math.abs(rr * Math.sqrt(3) - 1) < 0.03) return { ok: false, why: 'wurzel3', text: sqT(3) };
          return rr < 1 ? { ok: false, why: 'zu-klein', text: T.get('zu-klein', { pct: fm((1 - rr) * 100, 0) }) } : { ok: false, why: 'zu-gross', text: T.get('zu-gross', { pct: fm((rr - 1) * 100, 0) }) };
        }
        if (a !== 0 && value !== 0) return { ok: false, why: 'vorzeichen', text: T.get('vorzeichen') };
        return a < value ? { ok: false, why: 'zu-klein', text: T.get('zu-klein', { pct: '100' }) } : { ok: false, why: 'zu-gross', text: T.get('zu-gross', { pct: fm(Math.abs(a - value) / Math.max(Math.abs(value), 1e-300) * 100, 0) }) };
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
  const idNum = id => { const m = /^ws(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const WSL_TASKS = {
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
      fired: !!o.fired, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [], bericht: isObj(o.bericht) ? o.bericht : null };
  }
  WSL_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel, einer Formelkonstante (task.consts), den Grenzwerten aus WSL_CORE.limits
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
  WSL_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  WSL_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.ref || {}, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.WSL_TASKS = WSL_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await WSL_TASKS.run(t, answerOf(t, t.start()))), L = await WSL_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (34) */
  /* Jedes Beispiel: spec() liefert das Szenario (preset | ctl = Steuerwerte NACHHER bzw. zu Beginn, ref = abweichende Steuerwerte VORHER, seq, dur, fire), die Simulation rechnet es genau wie die
   * Oberflaeche (Steuerwerte, Pruefstaende, WSL_CORE), und text(X) formuliert die Beschreibung. X.a = Zustand nachher (bei seq mit fire: nach der Ausloesung), X.b = Zustand vorher (oder null),
   * X.S(over, act) = Zustand mit abweichenden Steuerwerten, X.n(schluessel, wert, stellen) = Zahl im Text. Jede Zahl der Beschreibung laeuft ueber n(): Sie steht danach in `vals` und stammt aus
   * Simulation, Pruefstand oder Kern (Regel 1). Alles Uebungswerte (Uebungsschaltung). Fachbegriffe wie in SPEC Abschnitt 2. */
  const m = (s, k) => (s && s.m ? s.m[k] : NaN);
  const st = (s, k) => (s && s.s ? s.s[k] : NaN);
  const g = (s, k) => (s && s.rig ? +s.rig.getControl(k) : NaN);               // Steuerwert aus dem Pruefstand (Text und Simulation haben dieselbe Quelle)
  const must = (c, why) => { if (!c) throw new Error('Behauptung im Text nicht belegt: ' + why); };
  const close = (a, b, rel) => fin(a) && fin(b) && Math.abs(a - b) <= (rel == null ? 1e-3 : rel) * Math.max(Math.abs(b), 1e-12);
  const M = 1e6;                                                               // Anzeige in µF bzw. µs
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const ampName = s => (s && s.a ? AMP[s.a.ampel] || s.a.ampel : '');

  const EXDEFS = [
    /* ---------------------------------------------------------------- Sinus */
    { id: 'wsx1', name: 'Netzspannung 230 V: Scheitelwert', cat: 'Sinus', rig: 'sinus',
      spec: () => ({ preset: 'netz-230' }),
      text(X) {
        const { a, n } = X, C = CORE();
        must(close(m(a, 'ueff') * Math.SQRT2, st(a, 'peak'), 1e-3) && close(m(a, 'umittel'), 2 * st(a, 'peak') / Math.PI, 1e-3) && close(st(a, 'formFactor'), m(a, 'ueff') / m(a, 'umittel'), 1e-3), 'û = U · √2, Gleichrichtwert 2û/π, Formfaktor U / Gleichrichtwert');
        must(close(C.sine.values({ form: 'sinus', ampl: g(a, 'ampl'), f: g(a, 'f') }).rms, m(a, 'ueff'), 1e-9), 'Effektivwert = Kern');
        return 'Die Netzspannung hat den Effektivwert U = ' + n('ueff', m(a, 'ueff'), 0) + ' V bei f = ' + n('f', g(a, 'f'), 0) + ' Hz. Der Scheitelwert ist û = U · √2 = ' + n('peak', st(a, 'peak'), 2) + ' V, der Spitze-Spitze-Wert beträgt ' + n('pp', st(a, 'pp'), 2) + ' V. ' +
          'Der Effektivwert ist über die Wärmewirkung definiert: Ein Widerstand erwärmt sich an dieser Wechselspannung so stark wie an einer Gleichspannung von ' + n('u2', m(a, 'ueff'), 0) + ' V. Das Messgerät „Gleichrichtwert“ zeigt ' + n('rect', m(a, 'umittel'), 2) +
          ' V (Mittelwert des gleichgerichteten Signals); der Formfaktor U / Gleichrichtwert ist ' + n('ff', st(a, 'formFactor'), 2) + '. Der arithmetische Mittelwert über eine volle Periode ist null.';
      } },
    { id: 'wsx2', name: 'Phase und Zeitversatz', cat: 'Sinus', rig: 'sinus',
      spec: () => ({ preset: 'phase-45', ref: { phi: 0 } }),
      text(X) {
        const { a, b, S, n } = X, neg = S({ phi: -g(a, 'phi') });
        must(st(a, 'dir') === 'vor' && close(m(a, 'dt'), 1000 * (g(a, 'phi') / 360) * st(a, 'T'), 1e-6) && st(neg, 'dir') === 'nach' && st(b, 'dir') === 'gleich', 'positiver Winkel eilt vor, negativer nach, Δt = φ / 360° · T');
        return 'Bei f = ' + n('f', g(a, 'f'), 0) + ' Hz dauert eine Periode T = ' + n('t', m(a, 'periode'), 0) + ' ms. Eine Phasenverschiebung von φ = ' + n('phi', g(a, 'phi'), 0) + '° ist der ' + n('teil', 360 / g(a, 'phi'), 0) + '. Teil der Periode: Δt = φ / ' + n('vw', 360, 0) + '° · T = ' + n('dt', m(a, 'dt'), 1) +
          ' ms. Die Spannung eilt dem Bezug dann um diese Zeit vor (links im Zeitbild, der Zeiger liegt gegen den Uhrzeigersinn davor). Bei φ = ' + n('phin', g(neg, 'phi'), 0) + '° ist es umgekehrt: Die Spannung eilt dem Bezug um ' + n('dt2', Math.abs(m(neg, 'dt')), 1) +
          ' ms nach. Vorher (φ = ' + n('phi0', g(b, 'phi'), 0) + '°) liegen beide Kurven übereinander.';
      } },
    { id: 'wsx3', name: 'Drei Kurvenformen, gleicher Scheitelwert', cat: 'Sinus', rig: 'sinus',
      spec: () => ({ preset: 'rechteck', ctl: { form: 'sinus', ampl: 100, f: 1000 }, seq: [{ t: 0, set: { form: 'sinus' } }, { t: 5, set: { form: 'rechteck' } }, { t: 10, set: { form: 'dreieck' } }], dur: 15 }),
      text(X) {
        const { a, S, n } = X, r = S({ form: 'rechteck' }), d = S({ form: 'dreieck' });
        must(close(m(r, 'ueff'), g(a, 'ampl'), 1e-9) && close(m(a, 'ueff'), g(a, 'ampl') / Math.SQRT2, 1e-3) && close(m(d, 'ueff'), g(a, 'ampl') / Math.sqrt(3), 1e-3) && m(r, 'ueff') > m(a, 'ueff') && m(a, 'ueff') > m(d, 'ueff'), 'Rechteck > Sinus > Dreieck bei gleichem Scheitelwert');
        return 'Alle drei Kurvenformen haben den Scheitelwert û = ' + n('u0', g(a, 'ampl'), 0) + ' V und f = ' + n('f', g(a, 'f'), 0) + ' Hz, trotzdem unterscheiden sich die Effektivwerte: Sinus ' + n('us', m(a, 'ueff'), 2) + ' V (û / √2), Rechteck ' + n('ur', m(r, 'ueff'), 2) +
          ' V (hier ist der Effektivwert gleich dem Scheitelwert) und Dreieck ' + n('ud', m(d, 'ueff'), 2) + ' V (û / √3). Der Effektivwert folgt aus der Wärmewirkung und hängt von der Kurvenform ab; der Faktor 1 / √2 gilt nur für den Sinus. ' +
          'Die Formfaktoren (Effektivwert / Gleichrichtwert) sind ' + n('fs', st(a, 'formFactor'), 2) + ', ' + n('fr', st(r, 'formFactor'), 2) + ' und ' + n('fd', st(d, 'formFactor'), 2) + '.';
      } },
    { id: 'wsx4', name: 'Periode vom Raster ablesen', cat: 'Sinus', rig: 'sinus',
      spec: () => ({ preset: 'netz-230', ctl: { ampl: 100, f: 156.25 }, tb: 2 }),
      text(X, d) {
        const { a, n } = X, T = m(a, 'periode'), div = T / d.tb;
        must(close(T, 1000 / g(a, 'f'), 1e-9) && close(div, 3.2, 1e-9), 'f = 156,25 Hz gibt T = 6,4 ms und 3,2 Teilungen bei 2 ms je Teilung');
        return 'Am Oszilloskop-Raster liest du die Periode so ab: Teilungen mal Zeitbasis. Bei der Zeitablenkung ' + n('tb', d.tb, 0) + ' ms je Teilung erstreckt sich hier eine Periode über ' + n('div', div, 1) + ' Teilungen, also T = ' + n('div2', div, 1) + ' · ' + n('tb2', d.tb, 0) + ' ms = ' + n('t', T, 1) +
          ' ms. Die Frequenz ist der Kehrwert: f = 1 / T = ' + n('f', g(a, 'f'), 2) + ' Hz; der Prüfstand ist auf genau diese Frequenz eingestellt. Das Raster ist nur die Darstellung: Die Zeitbasis ändert nichts an der Spannung, nur an dem, was du siehst.';
      } },
    /* ---------------------------------------------------------------- R, L, C */
    { id: 'wsx5', name: 'Spule am Wechselstrom', cat: 'R, L, C', rig: 'rlc',
      spec: () => ({ preset: 'spule' }),
      text(X) {
        const { a, S, n } = X, h = S({ f: 2 * g(a, 'f') });
        must(st(a, 'art') === 'induktiv' && close(m(a, 'phi'), 90, 1e-9) && close(m(a, 'xl'), 2 * Math.PI * g(a, 'f') * g(a, 'l'), 1e-6) && close(m(h, 'xl'), 2 * m(a, 'xl'), 1e-6) && m(h, 'i') < m(a, 'i'), 'X_L = 2π f L, doppelte Frequenz doppelter Blindwiderstand, kleinerer Strom, Spannung eilt vor');
        return 'Eine ideale Spule mit L = ' + n('l', g(a, 'l'), 1) + ' H liegt an ' + n('u', g(a, 'u'), 0) + ' V und ' + n('f', g(a, 'f'), 0) + ' Hz. Der Blindwiderstand ist X_L = 2π · f · L = ' + n('xl', m(a, 'xl'), 2) + ' Ω, der Strom I = U / X_L = ' + n('i', m(a, 'i'), 2) +
          ' A. Die Spannung eilt dem Strom um ' + n('phi', m(a, 'phi'), 0) + '° vor, der Strom eilt der Spannung nach. Bei doppelter Frequenz (' + n('f2', g(h, 'f'), 0) + ' Hz) verdoppelt sich X_L auf ' + n('xl2', m(h, 'xl'), 2) + ' Ω, und der Strom sinkt auf ' + n('i2', m(h, 'i'), 2) + ' A: Je höher die Frequenz, desto stärker sperrt die Spule.';
      } },
    { id: 'wsx6', name: 'Kondensator am Wechselstrom', cat: 'R, L, C', rig: 'rlc',
      spec: () => ({ preset: 'kondensator', seq: [{ t: 0, set: { c: 4.7e-6 } }, { t: 5, set: { c: 10e-6 } }], dur: 10 }),
      text(X) {
        const { a, S, n } = X, k = S({ c: 10e-6 });
        must(st(a, 'art') === 'kapazitiv' && close(m(a, 'phi'), -90, 1e-9) && close(m(a, 'xc'), 1 / (2 * Math.PI * g(a, 'f') * g(a, 'c')), 1e-6) && m(k, 'xc') < m(a, 'xc') && m(k, 'i') > m(a, 'i'), 'X_C = 1 / (2π f C), größeres C gibt kleineres X_C, größeren Strom, Strom eilt vor');
        return 'Ein Kondensator mit C = ' + n('c', g(a, 'c') * M, 1) + ' µF liegt an ' + n('u', g(a, 'u'), 0) + ' V und ' + n('f', g(a, 'f'), 0) + ' Hz. Sein Blindwiderstand ist X_C = 1 / (2π · f · C) = ' + n('xc', m(a, 'xc'), 1) + ' Ω, der Strom beträgt ' + n('i', m(a, 'i'), 2) +
          ' A. Wächst die Kapazität auf ' + n('c2', g(k, 'c') * M, 0) + ' µF, fällt X_C auf ' + n('xc2', m(k, 'xc'), 1) + ' Ω und der Strom steigt auf ' + n('i2', m(k, 'i'), 2) + ' A. Beim Kondensator eilt der Strom der Spannung um ' + n('phi', Math.abs(m(a, 'phi')), 0) + '° vor, die Spannung eilt dem Strom nach (φ negativ).';
      } },
    { id: 'wsx7', name: 'Reihe R-L: Spannungsdreieck', cat: 'R, L, C', rig: 'rlc',
      spec: () => ({ preset: 'rl-reihe' }),
      text(X) {
        const { a, n } = X, ur = m(a, 'ur'), ul = m(a, 'ul');
        must(close(Math.hypot(ur, ul), g(a, 'u'), 1e-3) && ur + ul > g(a, 'u') && st(a, 'art') === 'induktiv' && close(m(a, 'phi'), Math.atan2(ul, ur) * 180 / Math.PI, 1e-3), 'Teilspannungen geometrisch, arithmetische Summe größer, φ = arctan(U_L / U_R)');
        return 'In der Reihenschaltung aus R = ' + n('r', g(a, 'r'), 0) + ' Ω und L = ' + n('l', g(a, 'l'), 1) + ' H an ' + n('u', g(a, 'u'), 0) + ' V fließt der Strom I = ' + n('i', m(a, 'i'), 2) + ' A. Am Widerstand liegen U_R = ' + n('ur', ur, 1) + ' V, an der Spule U_L = ' + n('ul', ul, 1) +
          ' V. Die Teilspannungen stehen im rechten Winkel zueinander und werden geometrisch addiert: U = √(U_R² + U_L²) = ' + n('ug', Math.hypot(ur, ul), 1) + ' V. Die arithmetische Summe ' + n('us', ur + ul, 1) + ' V wäre falsch. Der Winkel zwischen Spannung und Strom ist φ = ' + n('phi', m(a, 'phi'), 1) + '°.';
      } },
    { id: 'wsx8', name: 'Reale Spule: aus Messwerten R und L', cat: 'R, L, C', rig: 'rlc',
      spec: () => ({ preset: 'reale-spule' }),
      text(X) {
        const { a, n } = X, C = CORE(), c = C.rlc.coil({ u: g(a, 'u'), i: m(a, 'i'), p: st(a, 'p') });
        must(c.ok && close(c.r, g(a, 'r'), 1e-6) && close(c.xl, m(a, 'xl'), 1e-6) && close(c.z, m(a, 'z'), 1e-6) && close(c.l, g(a, 'l'), 1e-6), 'coil gibt R, X_L und L der Anlage zurück');
        return 'Eine reale Spule besteht aus R und L in Reihe. Du misst U = ' + n('u', g(a, 'u'), 0) + ' V, I = ' + n('i', m(a, 'i'), 1) + ' A und P = ' + n('p', st(a, 'p'), 0) + ' W. Daraus folgt der Scheinwiderstand (Impedanz) Z = U / I = ' + n('z', c.z, 0) + ' Ω, der Wirkwiderstand R = P / I² = ' + n('r', c.r, 0) +
          ' Ω und der Blindwiderstand X_L = √(Z² − R²) = ' + n('xl', c.xl, 1) + ' Ω, also L = X_L / ω = ' + n('l', c.l * 1000, 1) + ' mH. Der Wirkwiderstand lässt sich nicht mit U / I bestimmen: Das wäre der Scheinwiderstand ' + n('z2', c.z, 0) + ' Ω.';
      } },
    { id: 'wsx9', name: 'Reihe R-L-C: Strom 0,379 A', cat: 'R, L, C', rig: 'rlc',
      spec: () => ({ preset: 'rlc-reihe' }),
      text(X) {
        const { a, n } = X, ur = m(a, 'ur'), ul = m(a, 'ul'), uc = m(a, 'uc');
        must(close(Math.hypot(ur, ul - uc), g(a, 'u'), 1e-3) && m(a, 'xc') > m(a, 'xl') && st(a, 'art') === 'kapazitiv' && uc > g(a, 'u') && close(m(a, 'z'), Math.hypot(g(a, 'r'), m(a, 'xl') - m(a, 'xc')), 1e-6), 'Z und U geometrisch, kapazitiv, U_C größer als die Quellenspannung');
        return 'Die Reihenschaltung R = ' + n('r', g(a, 'r'), 0) + ' Ω, L = ' + n('l', g(a, 'l'), 2) + ' H, C = ' + n('c', g(a, 'c') * M, 1) + ' µF an ' + n('u', g(a, 'u'), 0) + ' V und ' + n('f', g(a, 'f'), 0) + ' Hz hat X_L = ' + n('xl', m(a, 'xl'), 2) + ' Ω und X_C = ' + n('xc', m(a, 'xc'), 1) +
          ' Ω. Der Gesamtblindwiderstand X = X_L − X_C ist negativ, der Kreis wirkt kapazitiv: Z = √(R² + X²) = ' + n('z', m(a, 'z'), 1) + ' Ω, I = ' + n('i', m(a, 'i'), 3) + ' A, φ = ' + n('phi', m(a, 'phi'), 1) + '°. Die Teilspannungen sind U_R = ' + n('ur', ur, 1) + ' V, U_L = ' + n('ul', ul, 1) + ' V und U_C = ' + n('uc', uc, 1) +
          ' V; sie ergeben geometrisch die ' + n('ug', Math.hypot(ur, ul - uc), 0) + ' V der Quelle. U_C ist größer als die Quellenspannung: Das ist bei Reihenschaltung möglich.';
      } },
    /* ---------------------------------------------------------------- Leistung */
    { id: 'wsx10', name: 'Drei Messgeräte: P, Q, S', cat: 'Leistung', rig: 'leistung',
      spec: () => ({ preset: 'spule-messen', seq: [{ t: 0, fire: true }], dur: 3, fire: true }),
      text(X) {
        const { a, n } = X, s = m(a, 'u' in {} ? 'u' : 's'), u = g(a, 'u'), i = m(a, 'i');
        must(close(u * i, m(a, 's'), 1e-9) && close(Math.sqrt(Math.pow(m(a, 's'), 2) - Math.pow(m(a, 'p'), 2)), m(a, 'q'), 1e-6) && Array.isArray(st(a, 'rechenweg')) && st(a, 'rechenweg').length >= 3, 'S = U · I, Q = √(S² − P²), Rechenweg liegt vor');
        return 'Eine Spule wird mit einem Spannungsmesser (' + n('u', u, 0) + ' V), einem Strommesser (' + n('i', i, 2) + ' A) und einem Leistungsmesser (' + n('p', m(a, 'p'), 0) + ' W) untersucht. Die Scheinleistung ist S = U · I = ' + n('s', m(a, 's'), 0) + ' VA, die Wirkleistung P = ' + n('p2', m(a, 'p'), 0) +
          ' W. Im Leistungsdreieck ist S die Hypotenuse: Q = √(S² − P²) = ' + n('q', m(a, 'q'), 1) + ' var, und der Leistungsfaktor ist cos φ = P / S = ' + n('cos', m(a, 'cosphi'), 2) + '. Die Blindleistung wird in var angegeben, nicht in W; die Wirkleistung ist nicht S − P.';
      } },
    { id: 'wsx11', name: 'Motor mit cos φ 0,8', cat: 'Leistung', rig: 'leistung',
      spec: () => ({ preset: 'motor' }),
      text(X) {
        const { a, S, n } = X, k = S({ art: 'kapazitiv' });
        must(close(m(a, 's'), g(a, 'p') / g(a, 'cosphi'), 1e-9) && close(m(a, 'q'), g(a, 'p') * Math.tan(Math.acos(g(a, 'cosphi'))), 1e-6) && close(m(a, 'i'), m(a, 's') / g(a, 'u'), 1e-9) && m(a, 'q') > 0 && m(k, 'q') < 0, 'S = P / cos φ, Q = P · tan φ, I = S / U, kapazitive Last hat negatives Q');
        return 'Ein Motor nimmt an ' + n('u', g(a, 'u'), 0) + ' V die Wirkleistung P = ' + n('p', g(a, 'p') / 1000, 1) + ' kW bei cos φ = ' + n('cos', g(a, 'cosphi'), 1) + ' auf. Die Scheinleistung ist S = P / cos φ = ' + n('s', m(a, 's') / 1000, 1) + ' kVA, die Blindleistung Q = P · tan φ = ' + n('q', m(a, 'q') / 1000, 2) +
          ' kvar und der Strom I = S / U = ' + n('i', m(a, 'i'), 2) + ' A. Ein Teil davon, ' + n('i0', g(a, 'p') / g(a, 'u'), 2) + ' A, wäre bei cos φ = ' + n('c1', 1, 0) + ' nötig; der Rest pendelt nur zwischen Quelle und Motor. Wäre die Last kapazitiv, hätte Q das Vorzeichen minus (' + n('qk', m(k, 'q') / 1000, 2) + ' kvar).';
      } },
    { id: 'wsx12', name: 'p(t) mit Blindanteil', cat: 'Leistung', rig: 'leistung',
      spec: () => ({ preset: 'motor', ctl: { ansicht: 'zeit' } }),
      text(X) {
        const { a, n } = X, w = a.rig.waveform(), ps = (w.series.find(q => q.name === 'p') || { y: [] }).y, pmax = Math.max.apply(null, ps), pmin = Math.min.apply(null, ps);
        must(ps.length > 10 && close(w.pMean, m(a, 'p'), 1e-6) && close(pmax, m(a, 'p') + m(a, 's'), 1e-3) && close(pmin, m(a, 'p') - m(a, 's'), 1e-3) && pmin < 0 && st(a, 'valid') !== false, 'Mittelwert von p(t) ist P, Extrema P + S und P − S, Minimum negativ');
        return 'Die Augenblicksleistung p(t) = u · i pendelt mit der doppelten Netzfrequenz. Sie hat positive und negative Flächen: Bei diesem Motor liegt sie zwischen ' + n('pmin', pmin, 0) + ' W und ' + n('pmax', pmax, 0) + ' W. In den negativen Abschnitten fließt Energie vom Motor zur Quelle zurück, das ist der Blindanteil. ' +
          'Der Mittelwert von p(t) über eine Periode ist die Wirkleistung P = ' + n('p', w.pMean, 0) + ' W; die Scheinleistung S = ' + n('s', m(a, 's'), 0) + ' VA ist der Abstand vom Mittelwert zum Maximum. Ohne Phasenverschiebung (cos φ = ' + n('c1', 1, 0) + ') gäbe es keine negativen Abschnitte.';
      } },
    { id: 'wsx13', name: 'Leitungsverlust bei schlechtem cos φ', cat: 'Leistung', rig: 'leistung',
      spec: () => ({ preset: 'motor', ctl: { rl: 0.5 }, ref: { cosphi: 1 } }),
      text(X) {
        const { a, b, n } = X;
        must(close(m(a, 'p'), m(b, 'p'), 1e-9) && m(a, 'i') > m(b, 'i') && m(a, 'pv') > m(b, 'pv') && close(m(a, 'pv') / m(b, 'pv'), Math.pow(g(b, 'cosphi') / g(a, 'cosphi'), 2), 1e-6), 'gleiche Wirkleistung, größerer Strom, Verlust wächst mit 1 / cos² φ');
        return 'Derselbe Verbraucher nimmt die Wirkleistung P = ' + n('p', m(a, 'p'), 0) + ' W auf, einmal mit cos φ = ' + n('c1', g(b, 'cosphi'), 1) + ' und einmal mit cos φ = ' + n('c2', g(a, 'cosphi'), 1) + '. Bei cos φ = ' + n('c1b', g(b, 'cosphi'), 1) + ' fließen ' + n('i1', m(b, 'i'), 2) + ' A, bei cos φ = ' + n('c2b', g(a, 'cosphi'), 1) + ' sind es ' + n('i2', m(a, 'i'), 2) +
          ' A, weil die Blindleistung mitgeführt wird. Die Zuleitung (Übungswert R_L = ' + n('rl', g(a, 'rl'), 1) + ' Ω) erwärmt sich mit P_V = I² · R_L: ' + n('pv1', m(b, 'pv'), 1) + ' W gegen ' + n('pv2', m(a, 'pv'), 1) + ' W, das ist das ' + n('f', m(a, 'pv') / m(b, 'pv'), 2) + '-fache. Ein schlechter cos φ belastet die Leitung, ohne dass mehr Wirkleistung ankommt.';
      } },
    /* ---------------------------------------------------------------- Kompensation */
    { id: 'wsx14', name: 'Kompensation auf cos φ 0,95', cat: 'Kompensation', rig: 'kompens',
      spec: () => {
        const C = CORE(), nd = C.comp.need({ p: 3200, cos1: 0.8, cos2: 0.95, u: 230, f: 50, form: 'parallel' });
        return { preset: 'ziel-095', ctl: { c: Math.ceil(nd.c * 1e7) / 1e7 }, ref: { c: 0 } };
      },
      text(X) {
        const { a, b, n } = X, C = CORE(), nd = C.comp.need({ p: g(a, 'p'), cos1: g(a, 'cos1'), cos2: g(a, 'ziel'), u: g(a, 'u'), f: 50, form: 'parallel' });
        must(a.a.ampel === 'gruen' && st(a, 'zustand') === 'ziel' && close(m(a, 'cNoetig') / M, nd.c, 1e-9) && m(a, 'i2') < m(b, 'i2') && close(m(a, 'cos2'), g(a, 'ziel'), 0.01), 'C stellt cos φ auf das Ziel, Strom sinkt, Ampel grün');
        return 'Der Motor (P = ' + n('p', g(a, 'p'), 0) + ' W, cos φ = ' + n('c1', g(a, 'cos1'), 1) + ', ' + n('u', g(a, 'u'), 0) + ' V) soll auf cos φ = ' + n('ziel', g(a, 'ziel'), 2) + ' kompensiert werden (Übungsziel). Dazu muss ein Kondensator parallel zur Last die Blindleistung Q_C = P · (tan φ₁ − tan φ₂) = ' + n('qc', nd.qc, 1) +
          ' var liefern, das ist C = Q_C / (ω · U²) = ' + n('cn', nd.c * M, 2) + ' µF. Mit eingestellten ' + n('c', g(a, 'c') * M, 1) + ' µF erreicht der Prüfstand cos φ = ' + n('cos2', m(a, 'cos2'), 3) + ' (Ampel ' + ampName(a) + '). Der Netzstrom sinkt von ' + n('i1', m(b, 'i2'), 2) + ' A auf ' + n('i2', m(a, 'i2'), 2) + ' A, die Wirkleistung bleibt gleich, der Leitungsverlust sinkt auf ' + n('dpv', m(a, 'dpv'), 1) + ' %.';
      } },
    { id: 'wsx15', name: 'Überkompensation', cat: 'Kompensation', rig: 'kompens',
      spec: () => { const nd = CORE().comp.need({ p: 3200, cos1: 0.8, cos2: 0.95, u: 230, f: 50, form: 'parallel' }); return { preset: 'ueberkomp', ref: { c: Math.ceil(nd.c * 1e7) / 1e7 } }; },
      text(X) {
        const { a, b, n } = X, C = CORE(), cm = C.comp.cMax({ p: g(a, 'p'), cos1: g(a, 'cos1'), u: g(a, 'u'), f: 50 });
        must(st(a, 'zustand') === 'ueber' && a.a.ampel === 'rot' && st(a, 'q') < 0 && g(a, 'c') > cm && st(b, 'zustand') === 'ziel' && m(a, 'i2') > m(b, 'i2') && m(a, 'cos2') < g(b, 'cos1') + 0.001 + 0, 'Überkompensation: Q negativ, Strom und Verlust steigen, cos φ sinkt unter den Ausgangswert');
        return 'Mit C = ' + n('c1', g(b, 'c') * M, 1) + ' µF ist der Motor auf cos φ ' + n('cb', m(b, 'cos2'), 3) + ' kompensiert. Wächst C auf ' + n('c2', g(a, 'c') * M, 0) + ' µF, liegt es über der Grenze ' + n('cm', cm * M, 1) + ' µF, bei der die Blindleistung des Motors ganz kompensiert ist: Die Last wird kapazitiv, Q ist negativ (' + n('q', st(a, 'q'), 0) +
          ' var), cos φ sinkt wieder auf ' + n('cos', m(a, 'cos2'), 3) + ', der Netzstrom steigt auf ' + n('i2', m(a, 'i2'), 2) + ' A (vorher ' + n('i1', m(b, 'i2'), 2) + ' A) und der Leitungsverlust auf ' + n('dpv', m(a, 'dpv'), 0) + ' %. Das ist ein Fehler: Ein hoher cos φ allein heißt nicht „gut kompensiert“; die Ampel zeigt ' + ampName(a) + '.';
      } },
    { id: 'wsx16', name: 'Kompensation auf cos φ 1,0', cat: 'Kompensation', rig: 'kompens',
      spec: () => ({ preset: 'ziel-10', ctl: { c: CORE().comp.cMax({ p: 3200, cos1: 0.8, u: 230, f: 50 }) }, ref: { c: 0 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), nd = C.comp.need({ p: g(a, 'p'), cos1: g(a, 'cos1'), cos2: 1, u: g(a, 'u'), f: 50, form: 'parallel' }), more = X.S({ c: g(a, 'c') * 1.5 });
        must(a.a.ampel === 'gruen' && st(a, 'zustand') === 'ziel' && close(nd.qc, b.m.qc + (m(b, 'qc') === 0 ? 2400 : 0), 1e-3) && close(nd.c, g(a, 'c'), 1e-9) && st(more, 'zustand') === 'ueber', 'Q_C gleich Q der Last, mehr C überkompensiert');
        return 'Für cos φ = ' + n('ziel', g(a, 'ziel'), 1) + ' muss der Kondensator die ganze Blindleistung der Last liefern: Q_C = Q = ' + n('qc', nd.qc, 0) + ' var. Das gibt C = ' + n('c', nd.c * M, 1) + ' µF. Dann bleibt nur die Wirkleistung P = ' + n('p', g(a, 'p'), 0) + ' W übrig, der Strom sinkt von ' + n('i1', m(b, 'i2'), 2) + ' A auf ' + n('i2', m(a, 'i2'), 2) +
          ' A. Jedes größere C überkompensiert: Mit ' + n('c2', g(more, 'c') * M, 1) + ' µF ist der Zustand „Überkompensation“ (cos φ ' + n('cos', m(more, 'cos2'), 3) + ', kapazitiv). Das Übungsziel ' + n('z2', g(a, 'ziel'), 0) + ' ist nur ein Grenzfall; praktisch zielt man auf einen Wert darunter.';
      } },
    /* ---------------------------------------------------------------- Schwingkreise */
    { id: 'wsx17', name: 'Reihenresonanz', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ preset: 'reihe-10' }),
      text(X) {
        const { a, S, n } = X, off = S({ f: g(a, 'f') * 2 });
        must(st(a, 'aufResonanz') && close(m(a, 'i'), g(a, 'u') / g(a, 'r'), 1e-3) && m(off, 'i') < m(a, 'i') && close(m(a, 'qg'), m(a, 'z0') / g(a, 'r'), 1e-9) && close(m(a, 'fo') - m(a, 'fu'), m(a, 'b'), 1e-9), 'bei f₀ Z = R, I = U / R maximal, B = f_o − f_u');
        return 'Der Reihenschwingkreis mit L = ' + n('l', g(a, 'l') * 1000, 0) + ' mH, C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF und R = ' + n('r', g(a, 'r'), 0) + ' Ω hat die Resonanzfrequenz f₀ = 1 / (2π · √(L · C)) = ' + n('f0', m(a, 'f0'), 1) + ' Hz und den Kennwiderstand Z₀ = √(L / C) = ' + n('z0', m(a, 'z0'), 0) +
          ' Ω. Die Güte ist Q_G = Z₀ / R = ' + n('qg', m(a, 'qg'), 0) + ', die Bandbreite B = f₀ / Q_G = ' + n('b', m(a, 'b'), 1) + ' Hz (von f_u = ' + n('fu', m(a, 'fu'), 1) + ' Hz bis f_o = ' + n('fo', m(a, 'fo'), 1) + ' Hz). Bei Resonanz ist der Scheinwiderstand am kleinsten, Z = R = ' + n('z', m(a, 'z'), 0) + ' Ω, und der Strom am größten: I = ' + n('i', m(a, 'i'), 2) +
          ' A. Bei der doppelten Frequenz (' + n('f2', g(off, 'f'), 0) + ' Hz) fließen nur noch ' + n('i2', m(off, 'i'), 3) + ' A.';
      } },
    { id: 'wsx18', name: 'Spannungsüberhöhung', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ ctl: { art: 'reihe', u: 230, f: 50, l: 0.2, r: 22, c: CORE().exercise.solve('cAusF0', { l: 0.2, f0: 50 }).value } }),
      text(X) {
        const { a, n } = X;
        must(m(a, 'ul') > g(a, 'u') && close(m(a, 'ul'), m(a, 'uc'), 1e-6) && close(m(a, 'ul'), m(a, 'qg') * g(a, 'u'), 1e-6) && st(a, 'aufResonanz'), 'U_L = U_C = Q_G · U bei Resonanz');
        return 'Ein Reihenkreis mit R = ' + n('r', g(a, 'r'), 0) + ' Ω, L = ' + n('l', g(a, 'l'), 1) + ' H liegt an ' + n('u', g(a, 'u'), 0) + ' V und ' + n('f', g(a, 'f'), 0) + ' Hz; C = ' + n('c', g(a, 'c') * M, 2) + ' µF ist so gewählt, dass Resonanz herrscht. Dann begrenzt nur R den Strom: I = U / R = ' + n('i', m(a, 'i'), 2) + ' A. An der Spule (X_L = ' + n('xl', m(a, 'z0'), 2) + ' Ω) fallen U_L = I · X_L = ' + n('ul', m(a, 'ul'), 1) +
          ' V ab, am Kondensator genauso viel: ' + n('uc', m(a, 'uc'), 1) + ' V, das ist das ' + n('qg', m(a, 'qg'), 2) + '-fache der Quellenspannung (Q_G). Beide heben sich im Kreis auf, deshalb zeigt die Quelle nur ' + n('u2', g(a, 'u'), 0) + ' V. Die Spannungsüberhöhung kann ein Bauteil zerstören: Das ist ein Lehrbeispiel zum Auslegen der Spannungsfestigkeit, nichts zum Nachbauen.';
      } },
    { id: 'wsx19', name: 'Güte und Bandbreite', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ preset: 'reihe-10', ctl: { r: 20 }, ref: { r: 10 } }),
      text(X) {
        const { a, b, n } = X;
        must(close(m(a, 'qg'), m(b, 'qg') / 2, 1e-6) && close(m(a, 'b'), 2 * m(b, 'b'), 1e-6) && close(m(a, 'f0'), m(b, 'f0'), 1e-9) && m(a, 'i') < m(b, 'i'), 'R doppelt: Güte halbiert, Bandbreite doppelt, f₀ unverändert');
        return 'Verdoppelst du den Verlustwiderstand von R = ' + n('r1', g(b, 'r'), 0) + ' Ω auf ' + n('r2', g(a, 'r'), 0) + ' Ω, bleibt die Resonanzfrequenz f₀ = ' + n('f0', m(a, 'f0'), 1) + ' Hz gleich, aber die Güte Q_G = Z₀ / R halbiert sich von ' + n('q1', m(b, 'qg'), 0) + ' auf ' + n('q2', m(a, 'qg'), 0) +
          ', und die Bandbreite B = f₀ / Q_G verdoppelt sich von ' + n('b1', m(b, 'b'), 1) + ' Hz auf ' + n('b2', m(a, 'b'), 1) + ' Hz. Die Kurve wird breiter und flacher; der Strom bei Resonanz sinkt von ' + n('i1', m(b, 'i'), 2) + ' A auf ' + n('i2', m(a, 'i'), 2) + ' A. Hohe Güte heißt schmale Kurve und starke Überhöhung.';
      } },
    { id: 'wsx20', name: 'Parallelkreis als Sperrkreis', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ preset: 'parallel-sperr', ref: { f: 5000 } }),
      text(X) {
        const { a, b, n } = X;
        must(g(a, 'f') > 0 && close(m(a, 'z'), g(a, 'rp'), 1e-3) && m(a, 'i') < m(b, 'i') && m(a, 'z') > m(b, 'z') && close(m(a, 'il'), m(a, 'ic'), 1e-3) && m(a, 'il') > m(a, 'i'), 'Parallelkreis: bei f₀ Z maximal, Quellenstrom minimal, Kreisstrom groß');
        return 'Beim Parallelschwingkreis (L = ' + n('l', g(a, 'l') * 1000, 0) + ' mH, C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF, Verlustwiderstand R_p = ' + n('rp', g(a, 'rp'), 0) + ' Ω parallel) ist bei der Resonanzfrequenz f₀ = ' + n('f0', m(a, 'f0'), 1) + ' Hz der Scheinwiderstand am größten: Z = R_p = ' + n('z', m(a, 'z'), 0) + ' Ω. Die Quelle (' + n('u', g(a, 'u'), 0) +
          ' V) liefert dann nur I = ' + n('i', m(a, 'i') * 1000, 1) + ' mA, der kleinste Strom. Im Kreis selbst fließen je ' + n('ik', m(a, 'il') * 1000, 1) + ' mA durch L und C, sie heben sich in der Quelle auf. Bei f = ' + n('f1', g(b, 'f'), 0) + ' Hz ist Z nur ' + n('z1', m(b, 'z'), 1) + ' Ω und der Strom ' + n('i1', m(b, 'i') * 1000, 0) + ' mA. Deshalb wirkt der Kreis als Sperrkreis für seine Resonanzfrequenz.';
      } },
    { id: 'wsx21', name: 'Welche Kapazität für 50 Hz?', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ ctl: { art: 'reihe', u: 10, f: 50, l: 0.25, r: 10, c: CORE().exercise.solve('cAusF0', { l: 0.25, f0: 50 }).value } }),
      text(X) {
        const { a, n } = X, ex = CORE().exercise.solve('cAusF0', { l: g(a, 'l'), f0: g(a, 'f') });
        must(ex.ok && close(ex.value, g(a, 'c'), 1e-9) && close(m(a, 'f0'), g(a, 'f'), 1e-6) && close(m(a, 'z0'), 2 * Math.PI * g(a, 'f') * g(a, 'l'), 1e-6), 'C = 1 / (ω² L), f₀ gleich Quellenfrequenz, Z₀ = X_L');
        return 'Ein Reihenschwingkreis mit L = ' + n('l', g(a, 'l'), 2) + ' H soll bei ' + n('f', g(a, 'f'), 0) + ' Hz in Resonanz sein. Aus f₀ = 1 / (2π · √(L · C)) folgt C = 1 / (ω₀² · L) = ' + n('c', ex.value * M, 2) + ' µF mit ω₀ = 2π · f₀. Der Prüfstand bestätigt: f₀ = ' + n('f0', m(a, 'f0'), 1) +
          ' Hz. Bei Resonanz sind die Blindwiderstände gleich groß, X_L = X_C = Z₀ = ' + n('z0', m(a, 'z0'), 1) + ' Ω. Rechne mit ω² (dem Quadrat von 2π · f₀): Wer das Quadrat vergisst, erhält ein falsches C.';
      } },
    { id: 'wsx22', name: 'Resonanzfrequenz 495 kHz', cat: 'Schwingkreis', rig: 'schwing',
      spec: () => ({ preset: 'radio-495k' }),
      text(X) {
        const { a, n } = X, ex = CORE().exercise.solve('f0', { l: g(a, 'l'), c: g(a, 'c') });
        must(ex.ok && close(ex.value, m(a, 'f0'), 1e-6) && close(m(a, 'qg'), g(a, 'rp') / m(a, 'z0'), 1e-6), 'f₀ = Kern, Q_G = R_p / Z₀ beim Parallelkreis');
        return 'Ein Parallelkreis für den Mittelwellenbereich hat L = ' + n('l', g(a, 'l') * 1e6, 0) + ' µH und C = ' + n('c', g(a, 'c') * 1e12, 0) + ' pF. Seine Resonanzfrequenz ist f₀ = 1 / (2π · √(L · C)) = ' + n('f0', m(a, 'f0') / 1000, 1) + ' kHz, gerundet ' + n('f0r', Math.round(m(a, 'f0') / 1000), 0) +
          ' kHz. Mit dem Verlustwiderstand R_p = ' + n('rp', g(a, 'rp') / 1000, 0) + ' kΩ (parallel, Übungswert) ergibt sich die Güte Q_G = R_p / Z₀ = ' + n('qg', m(a, 'qg'), 1) + ' (Z₀ = ' + n('z0', m(a, 'z0'), 1) + ' Ω) und die Bandbreite B = f₀ / Q_G = ' + n('b', m(a, 'b') / 1000, 2) + ' kHz. Je höher die Güte, desto schärfer trennt der Kreis eng benachbarte Frequenzen.';
      } },
    /* ---------------------------------------------------------------- Filter */
    { id: 'wsx23', name: 'RC-Tiefpass: Grenzfrequenz', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'tiefpass-rc', ctl: { r: 10000, c: 47e-9, f: CORE().filter.rc({ typ: 'tief', r: 10000, c: 47e-9 }).fg } }),
      text(X) {
        const { a, n } = X, ex = CORE().exercise.solve('fgRC', { r: g(a, 'r'), c: g(a, 'c') });
        must(ex.ok && close(ex.value, m(a, 'fg'), 1e-6) && close(m(a, 'tau') / M, g(a, 'r') * g(a, 'c'), 1e-6) && close(m(a, 'h'), lim('fg_betrag'), 2e-3), 'f_g = 1 / (2π R C), τ = R C, |H| bei f_g = 0,7071');
        return 'Ein RC-Tiefpass aus R = ' + n('r', g(a, 'r') / 1000, 0) + ' kΩ und C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF hat die Zeitkonstante τ = R · C = ' + n('tau', m(a, 'tau'), 0) + ' µs und die Grenzfrequenz f_g = 1 / (2π · R · C) = ' + n('fg', m(a, 'fg'), 1) + ' Hz. Der Prüfstand läuft auf dieser Frequenz: Dort ist |H| = ' + n('h', m(a, 'h'), 3) +
          ' (' + n('pct', 100 * m(a, 'h'), 1) + ' %), das Dämpfungsmaß a = ' + n('a', m(a, 'a'), 2) + ' dB. Unterhalb von f_g gehen Signale fast ungedämpft durch, oberhalb werden sie schwächer: Der Tiefpass lässt tiefe Frequenzen durch.';
      } },
    { id: 'wsx24', name: 'Bei f_g: 70,7 %, −3 dB, 45°', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'tiefpass-rc', ctl: { f: CORE().filter.rc({ typ: 'tief', r: 1000, c: 1e-7 }).fg } }),
      text(X) {
        const { a, n } = X;
        must(close(m(a, 'h'), lim('fg_betrag'), 2e-3) && close(m(a, 'a'), lim('fg_db'), 0.01 + 0) && close(Math.abs(m(a, 'phi')), lim('fg_phase'), 1e-6) && close(st(a, 'xc'), g(a, 'r'), 1e-6) && m(a, 'phi') < 0, 'bei f_g: 0,707, −3 dB, −45°, X_C = R');
        return 'Bei der Grenzfrequenz f_g = ' + n('fg', m(a, 'fg'), 1) + ' Hz des RC-Tiefpasses (R = ' + n('r', g(a, 'r'), 0) + ' Ω, C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF) gilt: Der Blindwiderstand ist so groß wie der Wirkwiderstand, X_C = ' + n('xc', st(a, 'xc'), 0) + ' Ω = R. Die Ausgangsspannung ist ' + n('pct', 100 * m(a, 'h'), 1) +
          ' % der Eingangsspannung (|H| = ' + n('h', m(a, 'h'), 4) + '), das Dämpfungsmaß beträgt ' + n('a', m(a, 'a'), 2) + ' dB, gerundet ' + n('a3', lim('fg_db'), 0) + ' dB, und die Ausgangsspannung eilt der Eingangsspannung um ' + n('phi', Math.abs(m(a, 'phi')), 0) + '° nach. Diese drei Werte (' + n('h7', lim('fg_betrag'), 3) + ', ' + n('a4', lim('fg_db'), 0) + ' dB, ' + n('p4', lim('fg_phase'), 0) + '°) gelten bei jedem RC-Tiefpass an der Grenzfrequenz, nicht 50 %.';
      } },
    { id: 'wsx25', name: 'RC-Hochpass', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'hochpass-rc', ctl: { r: 15000, c: 1e-7, f: CORE().filter.rc({ typ: 'hoch', r: 15000, c: 1e-7 }).fg } }),
      text(X) {
        const { a, S, n } = X, lo = S({ f: m(a, 'fg') / 10 }), hi = S({ f: m(a, 'fg') * 10 });
        must(g(a, 'f') > 0 && close(m(a, 'h'), lim('fg_betrag'), 2e-3) && m(a, 'phi') > 0 && m(lo, 'h') < 0.2 && m(hi, 'h') > 0.95 && close(m(a, 'fg'), CORE().exercise.solve('fgRC', { r: g(a, 'r'), c: g(a, 'c') }).value, 1e-6), 'Hochpass sperrt unten, lässt oben durch, φ bei f_g positiv');
        return 'Beim RC-Hochpass liegt der Ausgang am Widerstand. Mit R = ' + n('r', g(a, 'r') / 1000, 0) + ' kΩ und C = ' + n('c', g(a, 'c') * 1e9, 0) + ' nF ist die Grenzfrequenz f_g = 1 / (2π · R · C) = ' + n('fg', m(a, 'fg'), 1) + ' Hz. Dort ist |H| = ' + n('h', m(a, 'h'), 3) + ', und die Ausgangsspannung eilt der Eingangsspannung um ' + n('phi', m(a, 'phi'), 0) +
          '° vor. Bei einem Zehntel der Grenzfrequenz (' + n('fl', g(lo, 'f'), 1) + ' Hz) ist |H| nur ' + n('hl', m(lo, 'h'), 3) + ', bei dem Zehnfachen (' + n('fh', g(hi, 'f'), 0) + ' Hz) schon ' + n('hh', m(hi, 'h'), 3) + ': Der Hochpass sperrt tiefe Frequenzen und lässt hohe durch (zum Beispiel als Koppelkondensator vor einem Verstärker).';
      } },
    { id: 'wsx26', name: 'Siebglied', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'siebglied' }),
      text(X) {
        const { a, n } = X, sv = CORE().filter.sieve({ r: g(a, 'r'), c: g(a, 'c'), f: g(a, 'f'), u1: g(a, 'ue') });
        must(sv.ok && close(sv.u2, m(a, 'ua'), 1e-6) && close(sv.z, st(a, 'z'), 1e-6) && close(sv.xc, st(a, 'xc'), 1e-6), 'Siebglied: X_C, Z und U₂ aus dem Kern');
        return 'Ein RC-Siebglied (R = ' + n('r', g(a, 'r'), 0) + ' Ω in Reihe, C = ' + n('c', g(a, 'c') * M, 1) + ' µF nach Masse, Ausgang am Kondensator, Last hochohmig) bekommt ' + n('ue', g(a, 'ue'), 0) + ' V Wechselspannung mit f = ' + n('f', g(a, 'f'), 0) + ' Hz. Der Kondensator hat X_C = 1 / (2π · f · C) = ' + n('xc', sv.xc, 1) +
          ' Ω, der Scheinwiderstand ist Z = √(R² + X_C²) = ' + n('z', sv.z, 1) + ' Ω (nicht R + X_C). Die Ausgangs-Wechselspannung beträgt U₂ = U₁ · X_C / Z = ' + n('u2', sv.u2, 3) + ' V, also |H| = ' + n('h', m(a, 'h'), 3) + '. Für ein Siebglied heißt das: Je größer R und C, desto kleiner bleibt die Restwelligkeit am Ausgang.';
      } },
    { id: 'wsx27', name: 'Rechteck am RC', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'rechteck-hp', ref: { typ: 'tief' } }),
      text(X) {
        const { a, b, n } = X;
        must(g(a, 'f') > 0 && st(a, 'nadel') === true && st(b, 'nadel') === false && st(a, 'randfall') === 'T-viel-groesser-tau' && st(b, 'randfall') === 'T-viel-groesser-tau' && close(st(a, 'tau'), g(a, 'r') * g(a, 'c'), 1e-9), 'Hochpass Nadelimpulse, Tiefpass keine, T viel größer als τ');
        return 'Ein Rechtecksignal mit f = ' + n('f', g(a, 'f'), 0) + ' Hz (Periode T = ' + n('t', st(a, 'T') * 1000, 0) + ' ms) liegt an einem RC-Glied mit τ = R · C = ' + n('tau', st(a, 'tau') * M, 0) + ' µs. Hier ist T viel größer als τ (T / τ = ' + n('vt', st(a, 'verhaeltnis'), 0) + '). Der Tiefpass verschleift die Flanken: Der Ausgang braucht etwa ' + n('t5', 5 * st(a, 'tau') * M, 0) +
          ' µs (5 · τ) bis zum Endwert. Der Hochpass überträgt nur die Flanken: Es entstehen Nadelimpulse (Hub bis ' + n('hub', st(a, 'hub'), 2) + ' V bei ' + n('ue', g(a, 'ue'), 0) + ' V Eingang), dazwischen fällt die Spannung auf null ab, weil der Kondensator Gleichanteile sperrt.';
      } },
    { id: 'wsx28', name: 'Vertiefung: Bode-Diagramm', cat: 'Filter', rig: 'filter',
      spec: () => ({ preset: 'tiefpass-rc', ctl: { f: CORE().filter.rc({ typ: 'tief', r: 1000, c: 1e-7 }).fg } }),
      text(X) {
        const { a, n } = X, bd = CORE().filter.bode({ art: 'RC', typ: 'tief', r: g(a, 'r'), c: g(a, 'c') }, 41);
        must(bd.ok && close(bd.steigung, -20, 1e-9) && close(st(a, 'steigung'), -20, 1e-9) && close(st(a, 'knickPhi'), -45, 1e-9) && close(st(a, 'knickDiff'), lim('fg_db'), 0.01) && close(st(a, 'dekadeA'), -20, 0.01) && st(a, 'dekadeF') > m(a, 'fg'), 'Bode: Steigung −20 dB je Dekade, Knick −3 dB, Phase −45°, eine Dekade über f_g etwa −20 dB');
        return 'Klappe im Tab Prüfstand „Vertiefung: Bode-Diagramm“ auf: Das Bode-Diagramm trägt das Dämpfungsmaß a = 20 · lg |H| in dB über der Frequenz auf einer logarithmischen Achse (Dekaden) auf. Beim RC-Tiefpass (f_g = ' + n('fg', m(a, 'fg'), 1) + ' Hz) verläuft die Asymptote bis f_g bei ' + n('a0', 0, 0) + ' dB und fällt danach mit ' + n('sl', st(a, 'steigung'), 0) +
          ' dB je Dekade. Genau bei f_g liegt die Kurve ' + n('kd', Math.abs(st(a, 'knickDiff')), 2) + ' dB unter der Asymptote, die Phase beträgt ' + n('ph', st(a, 'knickPhi'), 0) + '°. Eine Dekade höher (' + n('f10', st(a, 'dekadeF'), 0) + ' Hz) ist a = ' + n('ad', st(a, 'dekadeA'), 2) + ' dB. Das gilt nur für das unbelastete Glied erster Ordnung; es ist eine Vertiefung, kein Prüfungsstoff.';
      } },
    /* ---------------------------------------------------------------- Transformator */
    { id: 'wsx29', name: 'Trafo 230 V auf 12 V', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'klingel', ctl: { modus: 'ideal', u1: 230, n1: 1150, n2: 60, rlast: 6 } }),
      text(X) {
        const { a, n } = X;
        must(close(m(a, 'ueb'), g(a, 'n1') / g(a, 'n2'), 1e-9) && close(m(a, 'u2'), g(a, 'u1') * g(a, 'n2') / g(a, 'n1'), 1e-9) && close(m(a, 'i1'), m(a, 'i2') / m(a, 'ueb'), 1e-6) && m(a, 'i1') < m(a, 'i2') && close(m(a, 'p1'), m(a, 'p2'), 1e-6), 'U₂ = U₁ · N₂ / N₁, I₁ = I₂ / ü, ideal gleiche Leistung');
        return 'Ein Trafo mit N₁ = ' + n('n1', g(a, 'n1'), 0) + ' und N₂ = ' + n('n2', g(a, 'n2'), 0) + ' Windungen hat das Übersetzungsverhältnis ü = N₁ / N₂ = ' + n('ueb', m(a, 'ueb'), 2) + '. An ' + n('u1', g(a, 'u1'), 0) + ' V Primärspannung entstehen auf der Sekundärseite U₂ = U₁ / ü = ' + n('u2', m(a, 'u2'), 1) +
          ' V. Mit dem Lastwiderstand ' + n('r', g(a, 'rlast'), 0) + ' Ω fließen sekundär I₂ = ' + n('i2', m(a, 'i2'), 1) + ' A; der Primärstrom ist um den Faktor ü kleiner: I₁ = I₂ / ü = ' + n('i1', m(a, 'i1') * 1000, 1) + ' mA. Beim idealen Trafo ist die Leistung beider Seiten gleich (' + n('p', m(a, 'p2'), 1) + ' W); die Spannung wird herabgesetzt, der Strom heraufgesetzt.';
      } },
    { id: 'wsx30', name: 'Stromübersetzung', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'last-doppelt', ctl: { modus: 'ideal', u1: 230, n1: 1150, n2: 69, rlast: 5.52 } }),
      text(X) {
        const { a, n } = X, ex = CORE().exercise.solve('i1', { n1: g(a, 'n1'), n2: g(a, 'n2'), i2: m(a, 'i2') });
        must(ex.ok && close(ex.value, m(a, 'i1'), 1e-3) && close(m(a, 'i1') / m(a, 'i2'), g(a, 'n2') / g(a, 'n1'), 1e-6), 'I₁ / I₂ = N₂ / N₁');
        return 'Ein idealer Trafo hat N₁ = ' + n('n1', g(a, 'n1'), 0) + ' und N₂ = ' + n('n2', g(a, 'n2'), 0) + ' Windungen, also ü = ' + n('ueb', m(a, 'ueb'), 3) + '. Sekundär fließen I₂ = ' + n('i2', m(a, 'i2'), 1) + ' A (U₂ = ' + n('u2', m(a, 'u2'), 1) + ' V an R = ' + n('r', g(a, 'rlast'), 2) + ' Ω). Die Ströme verhalten sich umgekehrt wie die Windungszahlen: I₁ / I₂ = N₂ / N₁, also I₁ = I₂ · N₂ / N₁ = ' +
          n('i1', m(a, 'i1') * 1000, 0) + ' mA. Nimm nicht das Spannungsverhältnis für die Ströme: Auf der Seite mit der höheren Spannung fließt der kleinere Strom.';
      } },
    { id: 'wsx31', name: 'Trafo mit Verlusten und Last', cat: 'Transformator', rig: 'trafo',
      spec: () => ({ preset: 'labor-230-12', ref: { rlast: 10000 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), L = C.trafo.load({ u1: g(a, 'u1'), n1: g(a, 'n1'), n2: g(a, 'n2'), sn: g(a, 'sn'), r1: g(a, 'r1'), r2: g(a, 'r2'), rlast: g(a, 'rlast'), pfe: g(a, 'pfe') });
        must(L.ok && L.opt && close(L.opt.pcu, L.opt.pfe, 2e-2) && m(a, 'u2') < m(b, 'u2') && m(a, 'eta') < 100 && m(a, 'eta') > 50 && close(m(a, 'p2'), m(a, 'u2') * m(a, 'i2'), 1e-3), 'unter Last sinkt U₂, η kleiner 100 %, bestes η bei P_Cu = P_Fe');
        return 'Das Lehrmodell des Trafos hat Wicklungswiderstände (R₁ = ' + n('r1', g(a, 'r1'), 0) + ' Ω, R₂ = ' + n('r2', g(a, 'r2'), 2) + ' Ω) und einen festen Eisenverlust (P_Fe = ' + n('pfe', g(a, 'pfe'), 0) + ' W); alle Werte sind Übungswerte. Im Leerlauf zeigt die Sekundärseite U₂ = ' + n('u20', m(b, 'u2'), 2) + ' V, unter Last (R = ' + n('r', g(a, 'rlast'), 1) + ' Ω) nur ' + n('u2', m(a, 'u2'), 2) +
          ' V: Die Spannung sinkt leicht, weil an den Wicklungen Spannung abfällt. Aufgenommen werden ' + n('p1', m(a, 'p1'), 1) + ' W, abgegeben ' + n('p2', m(a, 'p2'), 1) + ' W; der Wirkungsgrad ist η = P₂ / P₁ = ' + n('eta', m(a, 'eta'), 1) + ' %. Der Kupferverlust wächst mit I², der Eisenverlust bleibt konstant: Den besten Wirkungsgrad (' + n('etam', L.opt.eta * 100, 1) + ' %) gibt es bei I₂ = ' + n('i2o', L.opt.i2, 2) + ' A, wo beide gleich groß sind (je ' + n('po', L.opt.pcu, 2) + ' W).';
      } },
    /* ---------------------------------------------------------------- Drehstrom */
    { id: 'wsx32', name: 'Drehstrom: drei Zeiger 120°', cat: 'Drehstrom', rig: 'drehstrom',
      spec: () => ({ preset: 'stern-400' }),
      text(X) {
        const { a, n } = X, ph = CORE().three.phases({ ul: g(a, 'ul'), f: 50 }, [0, 0.005, 0.01]);
        must(close(m(a, 'ustr') * Math.sqrt(3), g(a, 'ul'), 1e-6) && close(m(a, 'summe'), 0, 1) && ph.ok && Math.abs(ph.sum[0]) < 1e-6 && Math.abs(ph.sum[1]) < 1e-6 && Math.abs(ph.sum[2]) < 1e-6, 'Summe der drei Spannungen null, U_Str = U_L / √3');
        return 'Im Drehstromnetz gibt es drei Spannungen gleicher Größe, die um ' + n('w', 120, 0) + '° gegeneinander versetzt sind. Die Strangspannung ist ' + n('ustr', m(a, 'ustr'), 1) + ' V, die Außenleiterspannung zwischen zwei Außenleitern ' + n('ul', g(a, 'ul'), 0) + ' V (Übungsnetz, Übungswert). Zu jedem Zeitpunkt ist die Summe der drei Spannungen null (zum Beispiel ' + n('s0', Math.abs(ph.sum[1]) < 1e-9 ? 0 : ph.sum[1], 1) +
          ' V bei ' + n('t1', 5, 0) + ' ms), und bei symmetrischer Last ist auch die Summe der drei Leiterströme null (' + n('sa', m(a, 'summe'), 1) + ' A): Im Sternpunkt fließt dann kein Strom. Gerechnet wird nur die symmetrische Last; alles andere ist hier nur ein Begriff. Dies ist eine Rechenübung, keine Anleitung für Arbeiten am Netz.';
      } },
    { id: 'wsx33', name: 'Stern und Dreieck', cat: 'Drehstrom', rig: 'drehstrom',
      spec: () => ({ preset: 'stern-400', seq: [{ t: 0, fire: true }], dur: 3, fire: true }),
      text(X) {
        const { a, b, S, n } = X, ss = S({ schaltung: 'stern' }, []), dd = S({ schaltung: 'dreieck' }, []);
        must(close(st(a, 'faktor'), 3, 1e-6) && close(st(a, 'pDreieck'), 3 * st(a, 'pStern'), 1e-6) && close(m(ss, 'ustr') * Math.sqrt(3), m(dd, 'ustr'), 1e-6) && close(m(dd, 'ustr'), g(a, 'ul'), 1e-6) && close(m(ss, 'p'), st(a, 'pStern'), 1e-6) && close(m(dd, 'p'), st(a, 'pDreieck'), 1e-6), 'U_L = √3 · U_Str, Leistung ×3 beim Wechsel, Rechenvergleich');
        return 'In der Sternschaltung liegt jeder Strang an der Strangspannung ' + n('us', m(ss, 'ustr'), 1) + ' V = U_L / √3; in der Dreieckschaltung liegt er an der vollen Außenleiterspannung U_L = ' + n('ul', m(dd, 'ustr'), 0) + ' V. Bei derselben Last von ' + n('z', g(a, 'rstr'), 2) + ' Ω je Strang ist die Leistung deshalb im Dreieck ' + n('f', st(a, 'faktor'), 0) +
          ' mal so groß: Stern P = ' + n('ps', st(a, 'pStern'), 1) + ' W, Dreieck P = ' + n('pd', st(a, 'pDreieck'), 1) + ' W. Das ist ein reiner Rechenvergleich der Leistung bei gleichen Strängen; ein Anlaufmodell mit zeitlichem Verlauf enthält das Lab nicht.';
      } },
    { id: 'wsx34', name: 'Drehstromleistung', cat: 'Drehstrom', rig: 'drehstrom',
      spec: () => ({ preset: 'leistung' }),
      text(X) {
        const { a, n } = X, C = CORE(), ex = C.exercise.solve('pDrehstrom', { ul: g(a, 'ul'), il: m(a, 'il'), cosphi: g(a, 'cosphi') });
        must(ex.ok && close(ex.value, m(a, 'p'), 1e-6) && close(m(a, 's'), Math.sqrt(3) * g(a, 'ul') * m(a, 'il'), 1e-6) && close(m(a, 'q'), Math.sqrt(Math.pow(m(a, 's'), 2) - Math.pow(m(a, 'p'), 2)), 1e-4), 'S = √3 · U_L · I_L, P = S · cos φ, Q = √(S² − P²)');
        return 'Ein symmetrischer Drehstromverbraucher nimmt am Übungsnetz mit U_L = ' + n('ul', g(a, 'ul'), 0) + ' V den Leiterstrom I_L = ' + n('il', m(a, 'il'), 0) + ' A bei cos φ = ' + n('cos', g(a, 'cosphi'), 1) + ' auf. Die Scheinleistung ist S = √3 · U_L · I_L = ' + n('s', m(a, 's'), 1) + ' VA, die Wirkleistung P = S · cos φ = ' + n('p', m(a, 'p'), 1) +
          ' W und die Blindleistung Q = √(S² − P²) = ' + n('q', m(a, 'q'), 1) + ' var. Rechne mit dem Außenleiterstrom und der Außenleiterspannung; wer √3 weglässt, erhält ein Drittel zu wenig. Die Zahlen sind Übungswerte, es wird nur symmetrische Last gerechnet.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['sinus', 'rlc', 'leistung', 'kompens', 'schwing', 'filter', 'trafo', 'drehstrom']) if (!R.defs[k]) return [];
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
  const WSL_DATA = {};
  Object.defineProperty(WSL_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  WSL_DATA.exampleCount = EXDEFS.length;
  WSL_DATA.exampleIds = EXDEFS.map(d => d.id);
  WSL_DATA.rebuild = () => buildExamples();                  // Neuberechnung ohne Zwischenspeicher (Tests: Determinismus)
  root.WSL_DATA = WSL_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.WSL_DATA.examples; }, tasks, register, WSL_TASKS, answerOf, clean, snap };
})(typeof window !== 'undefined' ? window : globalThis);
