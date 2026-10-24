/* elsdata.js - ELS-Lab: Beispiele (ELS_DATA) und Aufgabenregister (ELS_TASKS), ohne Browser lauffaehig (WP4a).
 * Quelle: quelle/elslab/_wp4a/p1_util.js + p2_examples.js, zusammengesetzt mit `node quelle/elslab/_wp4a/build_elsdata.js` (nach Aenderungen neu bauen).
 *
 * window.ELS_DATA  = { examples: [ { id:'elx1'..'elx34', name, cat, rig, desc, controls, ref?, seq?, dur?, vals } ], exampleCount, exampleIds, rebuild }
 *   Alle Zahlen in `desc` kommen aus der Simulation (ELS_RIGS) und dem Kern (ELS_CORE) und stehen in `vals` (Regel 1). `examples` wird beim ersten Zugriff gerechnet (Getter);
 *   fehlen Kern oder Pruefstaende, enthaelt der Eintrag `error` und eine ehrliche Meldung statt einer Beschreibung (elsui.js nimmt dann seine eingebauten Beispiele).
 *   controls = alle Steuerwerte des Pruefstands (Zustand bei Beginn bzw. NACHHER), ref = abweichende Steuerwerte des Zustands VORHER, seq im Format von ELS_CORE.runSeq
 *   (t in Sekunden: set | ramp | fire | do), dur in Sekunden. Behauptungen in den Texten stehen hinter must(bedingung, text): Traegt die gerechnete Zahl die Aussage nicht,
 *   meldet sich der Eintrag als fehlerhaft (Regel 2).
 * window.ELS_TASKS = { tasks, register(list), run(task, answer) -> Promise<[{ok,text,why}]>, util, byId(id), audit, auditExample, answerOf }
 *   Die Aufgaben stehen in elstasks1.js (el1-el16) und elstasks2.js (el17-el32) und melden sich mit ELS_TASKS.register([...]) an; die Reihenfolge der Registry ist immer
 *   el1, el2, ... (unabhaengig von der Ladereihenfolge).
 *   Aufgabe: { id:'elN', lab:'els', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(), ask? | fields? | choices?, consts? }
 *   hint[1] und hint[2] enthalten nur Zahlen aus hintVals() (Regel 1); hint ist ein Getter, der beim ersten Zugriff rechnet.
 *   answer = { rig, controls, ref, seq, rows, dur, state, simTime, fired, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, clicks, protokoll }
 *   start() und sol() liefern { rig, controls (alle Steuerwerte), seq?, value?, fields?, choices?, fired?, protokoll? } (Startvorlage bzw. Musterloesung samt Selbsttest-Antwort);
 *   wrong() liefert [{ name, answer }] mit mindestens zwei absichtlich falschen Antworten (zu wenig / zu viel Schutz bzw. zu klein / zu gross) fuer den Test (Regel 3).
 * window.TaskTest = async only => [ { id, pct, startPct, bad } ]
 *
 * ELS_TASKS.util (fuer elstasks1.js, elstasks2.js und die Tests; Namen wie in emvdata.js und enrdata.js, damit beide Aufgabendateien dieselbe Huelle benutzen):
 *   fm(x, d) Dezimalkomma; fin; clamp; clone; isObj; toNum(v); ctlDefs(rig); coerce(def, v); clean(answer, rig, own?) -> { controls, seq, problems };
 *   initial(c, own?); fullCtl(rig, over); snap(rigId, ctl, act?) -> { ok, rig, m (readMeters), a (assess), d (diagnose), s (state), rejected, errors }
 *   (Pruefstand frisch, Seed 1, Steuerwerte in fester Reihenfolge, gecacht; act = true | 'fire' | Liste aus 'fire', 'taste' und Schrittnamen fuer rig.do); effOf; cdef; dlabel; olabel; setRow;
 *   mk(rigId, own, fn) -> check(answer); inputRow(c, r, sim, a, rigId); numRow(r, val, opt); exRow(r, ex, raw, label); exCheck(kind, seed, val); rawOf(a, key); fieldNum; numAns; choiceOf;
 *   variants; pctOf; rowsToSeq; seqOf(a) (do-Schritte der Antwort); stepsOf(a, rigId, eff) (Folge der bestaetigten Schritte oder Pruefschritte); tasteUsed(a); devOf(eff) (Pruefling aus den Steuerwerten);
 *   CORE; RIGS; core (= CORE); rigs (= RIGS); nodeReq; seedFor(kind, pred) (kleinster Seed einer Kernuebung, der pred erfuellt); naheRatio() (Grenze fuer nahe Ableitstroeme, 0,3, aus dem Kern gefunden).
 *   Alle Szenarien laufen mit Seed 1, kein Zufall in den Aufgaben. Die Pruefung rechnet immer neu aus den abgegebenen Steuerwerten und den festen Werten der Aufgabe (nur die freigegebenen
 *   Steuerwerte `own` zaehlen; alles andere setzt die Pruefung selbst), nie aus dem angezeigten Zustand.
 * ELS_TASKS.audit(task) und ELS_TASKS.auditExample(example) -> { ok, bad[] }: Hinweiszahlen-Audit (Regel 1) fuer Selbsttest und Tests.
 * Uebungsanlage: Alle Zahlen sind Uebungswerte, keine Vorhersage echter Anlagen. Norm und Vorschrift massgeblich. Dies ist ein Simulations- und Uebungslabor, keine Anleitung
 * fuer Arbeiten an Netzspannung. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => { if (!root.ELS_CORE) nodeReq('./elscore.js'); if (root.ELS_CORE && !root.ELS_CORE.exercise) nodeReq('./elscore-pruef.js'); return root.ELS_CORE || null; };
  const RIGFILES = ['./elsrig-koerper.js', './elsrig-netz.js', './elsrig-schutz.js', './elsrig-rcd.js', './elsrig-klassen.js', './elsrig-isolation.js', './elsrig-pruefplatz.js', './elsrig-regeln.js'];
  const RIGS = id => { let R = root.ELS_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { CORE(); nodeReq('./elsrig-base.js'); RIGFILES.forEach(nodeReq); R = root.ELS_RIGS; } return R || null; };
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
  /* Rohtext einer Eingabe (Zahl oder String) fuer ELS_CORE.exercise(...).check; null = nichts eingetragen */
  function rawOf(a, key) {
    let v = null;
    if (key === 'value' || key == null) v = isObj(a) ? (a.value !== undefined && a.value !== null && a.value !== '' ? a.value : a.text) : null;
    else v = isObj(a) && isObj(a.fields) ? a.fields[key] : null;
    if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
    return typeof v === 'number' ? (fin(v) ? String(v).replace('.', ',') : null) : String(v);
  }
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);

  /* ====================================================================== Pruefstand: Momentaufnahme */
  /* erst Auswahlen, von denen andere Werte abhaengen (Netzform, Pruefling, Modus ...), dann der Rest in der Reihenfolge der Bedienelemente */
  const FIRST = ['form', 'geraet', 'modus', 'art', 'sk', 'dev', 'typ', 'szene'];
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
        else if (x === 'taste') rig.setControl('taste', true);
        else if (typeof rig.do === 'function') rig.do(x);
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
    if (d && Array.isArray(d.options)) { const o = d.options.find(x => x.value === v); if (o) return o.label; }
    if (typeof v === 'boolean') return v ? 'ein' : 'aus';
    if (typeof v === 'number') return fm(v, Math.abs(v) < 1 && v !== 0 ? 4 : 2).replace(/,?0+$/, '') + (d && d.unit ? ' ' + d.unit : '');
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
  /* Zeile fuer eine Aufgabe aus ELS_CORE.exercise: ex = Uebung, raw = Rohtext der Eingabe (rawOf); die Texte stammen aus ex.check (Richtung, Vorsatz, Faktor 2, Faktor 5 gegen 10) */
  function exRow(r, ex, raw, label) {
    if (!ex || ex.ok === false || typeof ex.check !== 'function') { r(false, label, 'Die Übung konnte nicht erzeugt werden: ' + (ex && ex.why ? ex.why : 'Rechenkern fehlt.')); return false; }
    if (raw === null || raw === undefined) { r(false, label, 'Du hast keine Zahl eingetragen.'); return false; }
    let q; try { q = ex.check(raw); } catch (e) { q = { ok: false, text: 'Die Prüfung der Zahl ist fehlgeschlagen.' }; }
    r(!!q.ok, label, q.ok ? '' : q.text + (q.why ? ' ' + q.why : ''));
    return !!q.ok;
  }
  /* Kernuebung pruefen: liefert { ok, text } oder { ok:false, text:'Keine Zahl.' } */
  function exCheck(kind, seed, val) {
    const C = CORE(); let e = null; try { e = C.exercise(kind, seed); } catch (er) { e = null; }
    if (!e || e.ok === false || typeof e.check !== 'function') return { ok: false, text: 'Die Übung ist nicht verfügbar.', why: 'kern' };
    if (val === null || val === undefined) return { ok: false, text: 'Du hast keine Zahl eingetragen.', why: 'keineZahl' };
    let res = null; try { res = e.check(val); } catch (er) { res = null; }
    return res && typeof res === 'object' ? res : { ok: false, text: 'Die Übung ist nicht prüfbar.', why: 'kern' };
  }
  /* kleinster Seed (1 bis 400), dessen Kernuebung pred(uebung) erfuellt; null, wenn keiner passt */
  const seedMemo = {};
  function seedFor(kind, pred, tag) {
    const k = kind + '|' + (tag || String(pred));
    if (k in seedMemo) return seedMemo[k];
    const C = CORE(); let found = null;
    for (let s = 1; s <= 400 && found === null; s++) { let e = null; try { e = C.exercise(kind, s); } catch (er) { e = null; } if (e && e.ok !== false && pred(e)) found = s; }
    return (seedMemo[k] = found);
  }
  /* Grenze "Ableitstroeme nahe an der Fehlausloesung" (Verhaeltnis Summe / IΔn): aus ELS_CORE.rcd.leakSum durch Halbieren gefunden, nicht kopiert (Lehrfaustwert) */
  let naheMemo = null;
  function naheRatio() {
    if (naheMemo !== null) return naheMemo;
    const C = CORE(); let lo = 0, hi = 0.5;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, r = C.rcd.leakSum([mid * 30], { idn: 30 }); if (r && r.nahe) hi = mid; else lo = mid; }
    return (naheMemo = Math.round(hi * 1e4) / 1e4);
  }
  /* Zahlentoken, die ein Wert in Texten haben darf (Test der Zahlenkonsistenz, Regel 1) */
  function variants(v) {
    const out = new Set(); if (!fin(v)) return out;
    for (let d = 0; d <= 6; d++) { const s = Math.abs(v).toFixed(d).replace('.', ','); out.add(s); if (s.includes(',')) out.add(s.replace(/0+$/, '').replace(/,$/, '')); }
    return out;
  }
  const pctOf = rows => Math.round(100 * rows.filter(l => l.ok).length / Math.max(rows.length, 1));

  /* ====================================================================== Antworten lesen (Ablauf, Schritte, Pruefling) */
  /* do-Schritte der Antwort in zeitlicher Folge (Ablauftabelle); [] ohne Ablauf */
  function seqOf(a) {
    const src = isObj(a) ? (Array.isArray(a.seq) && a.seq.length ? a.seq : rowsToSeq(a.rows)) : [];
    return src.filter(e => isObj(e) && typeof e.do === 'string' && e.do).map(e => ({ t: toNum(e.t) || 0, do: e.do })).sort((p, q) => p.t - q.t);
  }
  /* Prueftaste benutzt? (Taste gehalten, Ablauf mit fire/taste, grosse Ausloesetaste oder Zustand des Pruefstands) */
  function tasteUsed(a) {
    if (!isObj(a)) return false;
    if (a.fired === true) return true;
    if (isObj(a.state) && (a.state.tasteGedrueckt === true || a.state.fired === true)) return true;
    if (isObj(a.controls) && a.controls.taste === true) return true;
    const seq = Array.isArray(a.seq) ? a.seq : rowsToSeq(a.rows);
    return seq.some(e => isObj(e) && (e.fire === true || (isObj(e.set) && e.set.taste === true) || (Array.isArray(e.press) && e.press.includes('taste'))));
  }
  /* Pruefling (device.make-Form) aus den Steuerwerten des Pruefplatzes: { id, faults[], seed } */
  const FAULTKEYS = ['leitung_beschaedigt', 'stecker_lose', 'gehaeuse_gebrochen', 'pe_unterbrochen', 'pe_hochohmig', 'isolation_feucht', 'isolation_defekt', 'y_kondensator_alt'];
  function devOf(eff) {
    const e = isObj(eff) ? eff : {};
    return { id: String(e.geraet || ''), faults: FAULTKEYS.filter(k => e['m_' + k] === true).map(k => k.replace(/_/g, '-')), seed: fin(+e.seed) ? +e.seed : 1 };
  }
  /* Folge der bestaetigten Schritte (regeln: modus regeln oder rettung) bzw. der Pruefschritte (pruefplatz): bevorzugt aus der Ablauftabelle (do), sonst aus dem Zustand */
  function stepsOf(a, rigId, eff) {
    const s = seqOf(a).map(x => x.do);
    if (s.length) return s;
    const st = isObj(a) && isObj(a.state) ? a.state : null;
    if (!st) return [];
    if (rigId === 'regeln') return Array.isArray(st.folge) ? st.folge.map(String) : [];
    if (rigId === 'pruefplatz') return Array.isArray(st.done) ? st.done.map(String) : [];
    return [];
  }

  /* ====================================================================== Registry */
  const tasks = [];
  const idNum = id => { const m = /^el(\d+)$/.exec(String(id)); return m ? +m[1] : 1e9; };
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
  const ELS_TASKS = {
    tasks, register,
    byId: id => tasks.find(t => t.id === id) || null,
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    },
    util: { fullCtl, fm, fin, clamp, clone, isObj, toNum, ctlDefs, coerce, clean, initial, snap, effOf, mk, inputRow, setRow, numRow, exRow, exCheck, variants, fieldNum, numAns, choiceOf, rawOf,
      pctOf, rowsToSeq, cdef, dlabel, olabel, seqOf, stepsOf, tasteUsed, devOf, seedFor, naheRatio, CORE, RIGS, core: CORE, rigs: RIGS, nodeReq }
  };
  /* Antwortobjekt aus start() oder sol() bauen (wie es die Oberflaeche liefert, soweit der Test es braucht) */
  function answerOf(task, o) {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, ref: o.ref || null, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: isObj(o.state) ? o.state : null, simTime: 0,
      fired: !!o.fired, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, clicks: o.clicks || [], protokoll: isObj(o.protokoll) ? o.protokoll : null };
  }
  ELS_TASKS.answerOf = answerOf;
  /* Hinweiszahlen-Audit (Regel 1): jede Zahl in Tipp 2 und 3 muss aus hintVals(), dem Aufgabentext, dem Titel, einer Formelkonstante (task.consts), den Grenzwerten aus ELS_CORE.limits
   * oder einem Bedienelement-/Optionsnamen des Pruefstands stammen; 0 bis 3 und 100 sind frei (Formelschreibweise). -> { ok, bad:[Token] } */
  const numTokens = s => (String(s == null ? '' : s).match(/\d+(?:,\d+)?/g) || []);
  const FREI = ['0', '1', '2', '3', '100'];
  function partTokens() {
    const out = [], R = RIGS(); if (!R || !R.defs) return out;
    try { Object.keys(R.defs).forEach(id => flat(R.defs[id].controls, []).forEach(c => { [c.key, c.label].forEach(x => numTokens(x).forEach(y => out.push(y))); (c.options || []).forEach(o => [o.value, o.label].forEach(x => numTokens(x).forEach(y => out.push(y)))); })); } catch (e) { /* ohne Tabelle keine Namen */ }
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
  ELS_TASKS.audit = function (task) {
    const bad = [];
    try {
      const set = allowedTokens(task.hintVals(), task.consts, [task.text, task.title]), h = task.hint;
      [1, 2].forEach(i => numTokens(h[i]).forEach(x => { if (!set.has(x)) bad.push('Tipp ' + (i + 1) + ': ' + x); }));
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };
  /* gleiche Pruefung fuer eine Beispielbeschreibung: erlaubt sind vals, Zahlen der Steuerwerte, des Ablaufs und der Dauer */
  ELS_TASKS.auditExample = function (ex) {
    const bad = [];
    try {
      const extra = []; JSON.stringify([ex.controls, ex.ref || {}, ex.seq || [], ex.dur]).replace(/-?\d+(?:\.\d+)?(?:e-?\d+)?/g, m => { extra.push(+m); return m; });
      const set = allowedTokens(ex.vals, extra, [ex.name]);
      numTokens(ex.desc).forEach(x => { if (!set.has(x)) bad.push(x); });
    } catch (e) { bad.push('Fehler: ' + String(e && e.message || e)); }
    return { ok: bad.length === 0, bad };
  };

  root.ELS_TASKS = ELS_TASKS;
  root.TaskTest = async only => {
    const ids = only || tasks.map(t => t.id), out = [];
    for (const id of ids) {
      const t = tasks.find(x => x.id === id);
      if (!t) { out.push({ id, err: 'unbekannt' }); continue; }
      try {
        const a = pctOf(await ELS_TASKS.run(t, answerOf(t, t.start()))), L = await ELS_TASKS.run(t, answerOf(t, t.sol()));
        out.push({ id, pct: pctOf(L), startPct: a, bad: L.filter(x => !x.ok).map(x => x.text) });
      } catch (e) { out.push({ id, err: String(e) }); }
    }
    return out;
  };

  /* ====================================================================== Beispiele (34) */
  /* Jedes Beispiel: spec() liefert das Szenario (ctl = Steuerwerte NACHHER bzw. zu Beginn, ref = abweichende Steuerwerte VORHER, seq, dur, fire), die Simulation rechnet es genau wie die
   * Oberflaeche (Steuerwerte, Pruefstaende, ELS_CORE), und text(X) formuliert die Beschreibung. X.a = Zustand nachher (bei seq: zu Beginn, nach allen do- und fire-Schritten der Folge),
   * X.b = Zustand vorher (oder null), X.S(over, act) = Zustand mit abweichenden Steuerwerten, X.n(schluessel, wert, stellen) = Zahl im Text. Jede Zahl der Beschreibung laeuft ueber n():
   * Sie steht danach in `vals` und stammt aus Simulation, Pruefstand oder Kern (Regel 1). Alles Uebungswerte (Uebungsanlage). Fachbegriffe wie in SPEC Abschnitt 2. */
  const m = (s, k) => (s && s.m ? s.m[k] : NaN);
  const g = (s, k) => (s && s.rig ? +s.rig.getControl(k) : NaN);               // Steuerwert aus dem Pruefstand (Text und Simulation haben dieselbe Quelle)
  const AMP = { gruen: 'grün', gelb: 'gelb', rot: 'rot', grau: 'grau' };
  const ampName = s => (s && s.a ? AMP[s.a.ampel] || s.a.ampel : '');
  const must = (c, why) => { if (!c) throw new Error('Behauptung im Text nicht belegt: ' + why); };
  const listDe = a => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' und ' + a[a.length - 1]);
  const lim = id => CORE().limit(id).value;
  const gcfg = s => { const c = s.rig.getControls(); return { form: c.form, q: c.q, qpe: c.qpe, l: c.l, zv: c.zv, dev: c.dev, In: c.In, kreis: c.kreis, ra: c.ra, rb: c.rb, fehler: 'koerperschluss', rcd: { on: +c.rcd > 0, idn: +c.rcd > 0 ? +c.rcd : 30 } }; };
  const WNAME = { sinus: 'sinusförmigem Wechselstrom', puls: 'pulsierendem Gleichstrom', mix: 'Frequenzgemisch', gleich: 'glattem Gleichstrom' };

  const EXDEFS = [
    /* ---------------------------------------------------------------- Körper */
    { id: 'elx1', name: '230 V an trockener Haut', cat: 'Körper', rig: 'koerper',
      spec: () => ({ ctl: { u: 230, haut: 'trocken' } }),
      text(X) {
        const { a, n } = X, C = CORE(), z = C.body.zone(m(a, 'ik') / 1000, g(a, 't'));
        must(m(a, 'zone') === 4 && z.zone === 4, 'Zone 4 bei 230 V und trockener Haut');
        return 'Eine Hand berührt einen Leiter mit ' + n('u', g(a, 'u'), 0) + ' V, der Strom fließt von der Hand zum Fuß. Bei trockener Haut beträgt der Körperwiderstand ' + n('rk', m(a, 'rk'), 0) + ' Ω, der Körperstrom ist I = U / R = ' + n('ik', m(a, 'ik'), 1) + ' mA. ' +
          'Bei ' + n('t', g(a, 't'), 0) + ' ms Einwirkdauer liegt dieser Strom in Zone ' + n('z', m(a, 'zone'), 0) + ' (' + z.name + '): Das ist lebensgefährlich, die Ampel zeigt ' + ampName(a) + '. Das Zonenbild ist eine Lehrdarstellung, alle Zahlen sind Übungswerte.';
      } },
    { id: 'elx2', name: 'Nasse Hände', cat: 'Körper', rig: 'koerper',
      spec: () => ({ ctl: { u: 24, haut: 'nass' }, ref: { haut: 'trocken' } }),
      text(X) {
        const { a, b, n } = X;
        must(m(b, 'zone') === 2 && m(a, 'zone') === 3 && m(a, 'ik') > m(b, 'ik'), 'trocken Zone 2, nass Zone 3, Strom steigt');
        return 'Dieselbe Spannung von ' + n('u', g(a, 'u'), 0) + ' V wirkt unterschiedlich, je nachdem, wie feucht die Haut ist. Trocken beträgt der Körperwiderstand ' + n('rk0', m(b, 'rk'), 0) + ' Ω und der Körperstrom ' + n('i0', m(b, 'ik'), 1) + ' mA (Zone ' + n('z0', m(b, 'zone'), 0) +
          ': spürbar, Loslassen möglich). Mit nasser Haut sinkt der Körperwiderstand auf ' + n('rk1', m(a, 'rk'), 0) + ' Ω, der Strom steigt auf ' + n('i1', m(a, 'ik'), 1) + ' mA und die Zone wechselt auf ' + n('z1', m(a, 'zone'), 0) + ': Muskelverkrampfung, Loslassen nicht möglich. ' +
          'Deshalb gelten die ' + n('ul', lim('ul_ac'), 0) + ' V Grenzspannung nur für trockene Bedingungen: Bei Nässe ist die Gefährdung größer.';
      } },
    { id: 'elx3', name: 'Boden und Schuhe', cat: 'Körper', rig: 'koerper',
      spec: () => ({ ctl: { u: 230, haut: 'nass', rv: 100000 }, ref: { rv: 0 } }),
      text(X) {
        const { a, b, n } = X;
        must(m(b, 'zone') === 4 && m(a, 'zone') === 2 && m(a, 'ik') < m(b, 'ik'), 'ohne Übergangswiderstand Zone 4, mit Zone 2');
        return 'Boden und Schuhe liegen mit dem Körper in Reihe: R_ges = R_K + R_v. Ohne Übergangswiderstand (R_v = ' + n('rv0', g(b, 'rv'), 0) + ' Ω) fließen bei ' + n('u', g(a, 'u'), 0) + ' V und nasser Haut ' + n('i0', m(b, 'ik'), 0) + ' mA, Zone ' + n('z0', m(b, 'zone'), 0) +
          '. Mit R_v = ' + n('rv1', g(a, 'rv'), 0) + ' Ω steigt R_ges auf ' + n('rg', m(a, 'rges'), 0) + ' Ω, der Strom sinkt auf ' + n('i1', m(a, 'ik'), 2) + ' mA, Zone ' + n('z1', m(a, 'zone'), 0) + '. Das Modell ist vereinfacht: In der Wirklichkeit sinkt der Körperwiderstand mit der Spannung.';
      } },
    { id: 'elx4', name: 'Einwirkdauer', cat: 'Körper', rig: 'koerper',
      spec: () => ({ ctl: { u: 230, haut: 'trocken', t: 10 }, seq: [{ t: 2, ramp: { key: 't', to: 10000, durS: 8 } }], dur: 10 }),
      text(X) {
        const { a, S, n } = X, C = CORE(), e = S({ t: 10000 }), f0 = C.body.zoneCurve(g(a, 't')), f1 = C.body.zoneCurve(g(e, 't'));
        must(m(a, 'zone') === 3 && m(e, 'zone') === 4 && Math.abs(m(a, 'ik') - m(e, 'ik')) < 1e-9, 'gleicher Strom, kurz Zone 3, lang Zone 4');
        return 'Der Körperstrom bleibt bei ' + n('ik', m(a, 'ik'), 1) + ' mA, nur die Einwirkdauer wächst. Bei ' + n('t0', g(a, 't'), 0) + ' ms liegt die Flimmergrenze der Lehrkurve bei ' + n('f0', f0.flimmer * 1000, 0) + ' mA: Der Betriebspunkt bleibt in Zone ' + n('z0', m(a, 'zone'), 0) +
          '. Bei ' + n('t1', g(e, 't') / 1000, 0) + ' s sinkt die Grenze auf ' + n('f1', f1.flimmer * 1000, 0) + ' mA, derselbe Strom liegt jetzt in Zone ' + n('z1', m(e, 'zone'), 0) + ' (Herzkammerflimmern möglich). Je länger der Strom fließt, desto weniger verträgt der Körper: deshalb ist die Abschaltzeit der Schutzeinrichtung so wichtig. Die Zahlen sind Übungswerte (Lehrkurve).';
      } },
    { id: 'elx5', name: 'Zonenbild lesen', cat: 'Körper', rig: 'koerper',
      spec: () => ({ ctl: { u: 230, haut: 'trocken', t: 1000 } }),
      text(X) {
        const { a, n } = X, C = CORE(), zc = C.body.zoneCurve(g(a, 't')), z100 = C.body.zone(m(a, 'ik') / 1000, 100);
        must(m(a, 'zone') === 4 && z100.zone === 3, 'bei 1 s Zone 4, bei 100 ms Zone 3');
        return 'Das Zonenbild zeigt den Strom über der Einwirkdauer. Bei ' + n('t', g(a, 't') / 1000, 0) + ' s sind die Grenzen: kaum wahrnehmbar bis ' + n('z1', zc.z1 * 1000, 1) + ' mA (Zone 1), Loslassgrenze ' + n('z2', zc.z2 * 1000, 0) + ' mA (Zone 2), Flimmerkurve ' + n('z3', zc.flimmer * 1000, 0) +
          ' mA (Zone 3 darunter, Zone 4 darüber). Der Betriebspunkt ' + n('ik', m(a, 'ik'), 1) + ' mA liegt in Zone ' + n('z', m(a, 'zone'), 0) + '. Verkürzt sich die Einwirkdauer auf ' + n('t2', 100, 0) + ' ms, steigt die Flimmergrenze auf ' + n('f2', C.body.zoneCurve(100).flimmer * 1000, 0) +
          ' mA und derselbe Strom liegt in Zone ' + n('z4', z100.zone, 0) + '. Alle Zonengrenzen sind Übungswerte (Lehrdarstellung für Wechselstrom, 50 Hz).';
      } },
    /* ---------------------------------------------------------------- Netz */
    { id: 'elx6', name: 'TN-S: Körperschluss mit B16', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, fehler: 'koerperschluss' }, fire: true }),
      text(X) {
        const { a, n } = X, f = CORE().grid.fault(gcfg(a));
        must(f.bedingung === true && f.ausgeloest === true && m(a, 'zs') <= m(a, 'zsMax') && m(a, 'tab') <= lim('tab_033'), 'Abschaltbedingung erfüllt, Auslösung sicher');
        return 'Ein TN-S-System mit Zv = ' + n('zv', g(a, 'zv'), 1) + ' Ω, ' + n('q', g(a, 'q'), 1) + ' mm² und ' + n('l', g(a, 'l'), 0) + ' m Leitung (Kupfer): Hin- und Rückleiter haben je ' + n('rl', f.rl, 4) + ' Ω, die Schleifenimpedanz ist Zs = ' + n('zs', m(a, 'zs'), 4) +
          ' Ω und der Fehlerstrom im Körperschluss I_F = U0 / Zs = ' + n('if', m(a, 'ifehler'), 1) + ' A. Der LS-Schalter B16 löst oberhalb Ia = ' + n('ia', f.ia, 0) + ' A sicher aus (Zs_max = ' + n('zm', m(a, 'zsMax'), 3) + ' Ω): Die Abschaltbedingung Zs ≤ U0 / Ia ist erfüllt, die Abschaltzeit liegt bei höchstens ' + n('tab', m(a, 'tab'), 1) +
          ' s (Grenze ' + n('tg', lim('tab_033'), 1) + ' s). Am Gehäuse steht bis zur Abschaltung die Berührungsspannung U_B = ' + n('ub', m(a, 'ub'), 1) + ' V; die Ampel zeigt ' + ampName(a) + ', weil sie ab ' + n('ug', 40, 0) + ' V (Lehrfaustwert) warnt. Grün heißt nie, dass du etwas gefahrlos anfassen darfst.';
      } },
    { id: 'elx7', name: 'Die Leitung ist zu lang', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, fehler: 'koerperschluss' }, seq: [{ t: 2, ramp: { key: 'l', to: 200, durS: 18 } }], dur: 20, fire: true }),
      text(X) {
        const { a, S, n } = X, ml = CORE().grid.maxLength(gcfg(a)), ok = S({ l: 170 }), bad = S({ l: 180 });
        must(ml.ok && ml.lMax > 170 && ml.lMax < 180 && m(ok, 'zs') <= m(ok, 'zsMax') && m(bad, 'zs') > m(bad, 'zsMax') && bad.a.ampel === 'rot', 'Bedingung kippt zwischen 170 m und 180 m');
        return 'Die Schleife wird mit der Leitungslänge länger, Zs wächst. Bei ' + n('l0', g(a, 'l'), 0) + ' m ist Zs = ' + n('zs0', m(a, 'zs'), 4) + ' Ω weit unter Zs_max = ' + n('zm', m(a, 'zsMax'), 3) + ' Ω. Der Kern löst die Bedingung nach der Länge auf: Bis ' + n('lm', ml.lMax, 1) +
          ' m bleibt Zs höchstens so groß. Bei ' + n('l1', g(ok, 'l'), 0) + ' m ist Zs = ' + n('zs1', m(ok, 'zs'), 4) + ' Ω (noch erfüllt), bei ' + n('l2', g(bad, 'l'), 0) + ' m ist Zs = ' + n('zs2', m(bad, 'zs'), 4) + ' Ω und damit größer als Zs_max: Die Auslösung ist nicht mehr sicher, die Ampel zeigt ' + ampName(bad) +
          '. Ein größerer Querschnitt oder ein kleineres Zs_max (anderer Typ) verschiebt die Grenze. Übungsanlage.';
      } },
    { id: 'elx8', name: 'B, C oder D', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 60, zv: 0.4, dev: 'LS-B', In: 16, fehler: 'koerperschluss' }, seq: [{ t: 4, set: { dev: 'LS-C' } }, { t: 8, set: { dev: 'LS-D' } }], dur: 12, fire: true }),
      text(X) {
        const { a, S, n } = X, c = S({ dev: 'LS-C' }), d = S({ dev: 'LS-D' }), fx = id => CORE().prot.devices.find(x => x.id === id).hi;
        must(m(a, 'zs') <= m(a, 'zsMax') && m(c, 'zs') <= m(c, 'zsMax') && m(d, 'zs') > m(d, 'zsMax') && d.a.ampel === 'rot', 'B und C erfüllen die Bedingung, D nicht');
        return 'Dieselbe Leitung (' + n('l', g(a, 'l'), 0) + ' m, ' + n('q', g(a, 'q'), 1) + ' mm²) hat die Schleifenimpedanz Zs = ' + n('zs', m(a, 'zs'), 4) + ' Ω. Der LS-Schalter bestimmt, wie groß Zs höchstens sein darf: B16 sichert die Auslösung bei ' + n('fb', fx('LS-B'), 0) + ' · In, also Zs_max = ' + n('zb', m(a, 'zsMax'), 3) +
          ' Ω; C16 (' + n('fc', fx('LS-C'), 0) + ' · In) erlaubt nur ' + n('zc', m(c, 'zsMax'), 4) + ' Ω; D16 (' + n('fd', fx('LS-D'), 0) + ' · In) nur ' + n('zd', m(d, 'zsMax'), 5) + ' Ω. Mit B und C ist die Bedingung erfüllt (Reserve ' + n('rb', m(a, 'reserve'), 2) + ' und ' + n('rc', m(c, 'reserve'), 2) + '), mit D16 ist Zs größer als Zs_max, die Ampel zeigt ' + ampName(d) +
          '. Je größer der Auslösefaktor, desto kleiner darf Zs sein. Die Faktoren für C und D sind Übungswerte, der Faktor 5 für B ist belegt.';
      } },
    { id: 'elx9', name: 'TT mit RCD', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'TT', q: 2.5, qpe: 2.5, l: 20, ra: 50, rb: 2, rcd: 30, fehler: 'koerperschluss' }, fire: true }),
      text(X) {
        const { a, S, n } = X, C = CORE(), hi = S({ ra: 1800 }), no = S({ rcd: 0 });
        must(m(a, 'zs') < 100 && m(a, 'reserve') > 1.2 && hi.a.ampel === 'rot' && no.a.ampel === 'rot' && a.a.ampel === 'gruen', 'R_A klein grün, R_A groß rot, ohne RCD rot');
        return 'Im TT-System hat die Anlage einen eigenen Erder. Die Bedingung lautet R_A ≤ U_L / IΔn: mit U_L = ' + n('ul', lim('ul_ac'), 0) + ' V und IΔn = ' + n('idn', g(a, 'rcd'), 0) + ' mA ist R_A höchstens ' + n('ra', m(a, 'zsMax'), 1) + ' Ω. Der Erder mit R_A = ' + n('r0', g(a, 'ra'), 0) +
          ' Ω liegt weit darunter (Reserve ' + n('res', m(a, 'reserve'), 1) + '), der RCD löst aus, die Ampel zeigt ' + ampName(a) + '. Mit R_A = ' + n('r1', g(hi, 'ra'), 0) + ' Ω ist die Bedingung verletzt (Ampel ' + ampName(hi) + '). Mit einem 300-mA-RCD wären nur ' + n('r3', C.grid.raMax(300), 1) +
          ' Ω erlaubt. Ohne RCD löst der Leitungsschutz im TT-System bei diesem Fehlerstrom nicht sicher aus (Ampel ' + ampName(no) + '). Der Wert 50 V gilt für trockene Bedingungen. Übungsanlage.';
      } },
    { id: 'elx10', name: 'Schutzleiter unterbrochen', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, rcd: 30, haut: 'nass', rv: 0, fehler: 'pe-unterbrochen' }, ref: { rcd: 0 }, fire: true }),
      text(X) {
        const { a, b, n } = X, p = CORE().rcd.person({ idn: g(a, 'rcd'), haut: a.rig.getControl('haut'), rv: g(a, 'rv') });
        must(m(a, 'ifehler') === 0 && m(a, 'ub') >= 229 && b.a.ampel === 'rot' && a.a.ampel === 'gelb' && p.trip.tripped === true, 'kein Fehlerstrom, RCD löst über den Menschen aus, ohne RCD rot, mit RCD gelb');
        return 'Ist der Schutzleiter unterbrochen, schließt sich bei einem Körperschluss keine Fehlerschleife: Der Fehlerstrom beträgt ' + n('if', m(a, 'ifehler'), 0) + ' A, der Leitungsschutz bleibt stumm und das Gehäuse kann bis zu ' + n('ub', m(a, 'ub'), 0) + ' V führen. Ohne RCD zeigt die Ampel ' + ampName(b) +
          '. Mit einem RCD (IΔn = ' + n('idn', g(a, 'rcd'), 0) + ' mA) löst erst der Strom über den Menschen aus: Bei nasser Haut sind es ' + n('ik', p.iKmA, 0) + ' mA, höchstens nach ' + n('t', m(a, 'tab') * 1000, 0) + ' ms. Die Ampel zeigt trotzdem nur ' + ampName(a) +
          ': Der Zusatzschutz ersetzt den Schutzleiter nicht, er verkürzt nur die Einwirkzeit. Dieser Fehler ist eine Simulation und wird als Fehler erklärt, nie als Vorgehen.';
      } },
    { id: 'elx11', name: 'IT-Netz: erster und zweiter Fehler', cat: 'Netz', rig: 'netz',
      spec: () => ({ ctl: { form: 'IT', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, cleck: 50, fehler: 'koerperschluss' }, fire: true }),
      text(X) {
        const { a, n } = X, C = CORE(), it = C.grid.it({ form: 'IT', cleck: g(a, 'cleck'), q: g(a, 'q'), qpe: g(a, 'qpe'), l: g(a, 'l'), zv: g(a, 'zv'), dev: 'LS-B', In: 16, zweiterFehler: true }), tn = C.grid.fault({ form: 'TN-S', q: g(a, 'q'), qpe: g(a, 'qpe'), l: g(a, 'l'), zv: g(a, 'zv'), dev: 'LS-B', In: 16, fehler: 'koerperschluss' });
        must(it.abschaltung === false && it.meldung === true && m(a, 'ub') < 1 && tn.ausgeloest === true, 'erster Fehler ohne Abschaltung, kleine Berührungsspannung, Doppelfehler schaltet ab');
        return 'Im IT-System ist das Netz von Erde isoliert, die Körper der Anlage sind geerdet. Beim ersten Körperschluss schließt sich der Strom nur über die Leitungskapazität (' + n('c', g(a, 'cleck'), 0) + ' nF, Lehrmodell): I_F1 = ' + n('i1', m(a, 'ifehler') * 1000, 2) + ' mA und U_B = ' + n('ub', m(a, 'ub'), 2) +
          ' V. Das Schutzorgan schaltet nicht ab, die Isolationsüberwachung meldet den Fehler, und der Anlagenbetrieb geht zunächst weiter (die Ampel zeigt ' + ampName(a) + '). Kommt ein zweiter Fehler dazu, entsteht im Lehrmodell eine Schleife wie im TN-System (Zs = ' + n('zs2', it.zs2, 4) +
          ' Ω): Das Schutzorgan schaltet dann nach höchstens ' + n('t2', tn.tAb, 1) + ' s ab. Deshalb muss ein gemeldeter erster Fehler beseitigt werden. Übungsanlage.';
      } },
    /* ---------------------------------------------------------------- Schutzorgane */
    { id: 'elx12', name: 'B16 bei Überlast', cat: 'Schutzorgane', rig: 'schutz',
      spec: () => ({ ctl: { dev: 'LS-B', In: 16, q: 2.5, ib: 10, i: 1.13 }, seq: [{ t: 4, set: { i: 1.45 } }, { t: 8, set: { i: 3 } }, { t: 12, set: { i: 6 } }], dur: 16 }),
      text(X) {
        const { a, S, n } = X, b = S({ i: 1.45 }), c = S({ i: 3 }), d = S({ i: 6 });
        must(a.s.bereichName === 'thermischer Bereich' && c.s.bereichName === 'unsicherer Bereich' && d.s.bereichName === 'sicherer Bereich' && m(b, 'tMax') <= 3600 + 1e-6, 'Bereiche bei 1,13, 3 und 6 mal In');
        return 'Das Kennlinienband des B16 zeigt, wie lange der LS-Schalter braucht. Bei ' + n('x0', g(a, 'i'), 2) + ' · In (' + n('i0', m(a, 'strom'), 1) + ' A) liegt die Auslösung im thermischen Bereich zwischen ' + n('a0', m(a, 'tMin'), 0) + ' s und ' + n('b0', m(a, 'tMax'), 0) + ' s; bei ' + n('x1', g(b, 'i'), 2) + ' · In löst er innerhalb ' + n('t1', m(b, 'tMax'), 0) +
          ' s sicher aus. Bei ' + n('x2', g(c, 'i'), 0) + ' · In (' + n('i2', m(c, 'strom'), 0) + ' A) liegt der Strom im unsicheren Bereich (Auslösung möglich, aber nicht garantiert, bis ' + n('b2', m(c, 'tMax'), 0) + ' s), erst ab ' + n('x3', g(d, 'i'), 0) + ' · In (' + n('i3', m(d, 'strom'), 0) +
          ' A, mindestens Ia = ' + n('ia', m(d, 'ia'), 0) + ' A) ist die magnetische Auslösung sicher und dauert höchstens ' + n('b3', m(d, 'tMax') * 1000, 0) + ' ms. Der Faktor 5 für B ist belegt, die übrigen Grenzen sind Übungswerte (Lehrmodell).';
      } },
    { id: 'elx13', name: 'Motoranlauf', cat: 'Schutzorgane', rig: 'schutz',
      spec: () => ({ ctl: { dev: 'LS-B', In: 16, q: 2.5, ib: 5, ein: 6, i: 2 }, seq: [{ t: 4, set: { dev: 'LS-C' } }, { t: 8, set: { dev: 'LS-D' } }], dur: 12 }),
      text(X) {
        const { a, S, n } = X, c = S({ dev: 'LS-C' }), d = S({ dev: 'LS-D' }), C = CORE(), ia = dev => C.prot.ia(dev, g(a, 'In')), lo = dev => C.prot.devices.find(x => x.id === dev).lo * g(a, 'In'), ein = g(a, 'ein') * g(a, 'In');
        const ib = C.prot.inrush('LS-B', g(a, 'In'), g(a, 'ein')), ic = C.prot.inrush('LS-C', g(a, 'In'), g(a, 'ein')), id = C.prot.inrush('LS-D', g(a, 'In'), g(a, 'ein'));
        must(ib.ausloesung === 'ja' && ic.ausloesung === 'moeglich' && id.ausloesung === 'nein' && a.a.ampel === 'rot' && d.a.ampel === 'gruen', 'B löst aus, C unsicher, D hält');
        return 'Ein Motor nimmt beim Anlauf kurz das ' + n('ein', g(a, 'ein'), 0) + '-fache seines Nennstroms auf: ' + n('ie', ein, 0) + ' A bei In = ' + n('in', g(a, 'In'), 0) + ' A. Der B16 löst oberhalb Ia = ' + n('ib', ia('LS-B'), 0) + ' A sicher aus: Der Motor kann nicht anlaufen, die Ampel zeigt ' + ampName(a) +
          '. Der C16 hat den magnetischen Bereich von ' + n('c0', lo('LS-C'), 0) + ' A bis ' + n('c1', ia('LS-C'), 0) + ' A: Der Anlaufstrom liegt darin, die Auslösung ist möglich, aber nicht sicher (Ampel ' + ampName(c) + '). Der D16 löst erst ab ' + n('d0', lo('LS-D'), 0) + ' A aus: Der Anlaufstrom bleibt darunter, die Ampel zeigt ' + ampName(d) +
          '. Dafür darf bei D die Schleifenimpedanz am kleinsten sein, die Leitung also am kürzesten (Beispiel B, C oder D). Der Faktor 5 für B ist belegt, die Grenzen für C und D sind Übungswerte.';
      } },
    { id: 'elx14', name: 'Leitung zu schwach', cat: 'Schutzorgane', rig: 'schutz',
      spec: () => ({ ctl: { dev: 'LS-B', In: 20, q: 1.5, ib: 12, i: 2 }, ref: { In: 13 } }),
      text(X) {
        const { a, b, n } = X;
        must(m(a, 'iz') < g(a, 'In') && a.a.ampel === 'rot' && b.a.ampel === 'gruen' && m(b, 'iz') >= g(b, 'In') && g(b, 'ib') <= g(b, 'In'), 'In > Iz rot, In = Iz grün');
        return 'Eine Leitung mit ' + n('q', g(a, 'q'), 1) + ' mm² darf im Modell höchstens ' + n('iz', m(a, 'iz'), 0) + ' A dauernd führen (Übungstabelle, Verlegeart B2, 3 belastete Adern). Ein LS-Schalter mit In = ' + n('in', g(a, 'In'), 0) + ' A löst bei Überlast erst oberhalb dieses Werts aus: Die Leitung wäre nicht geschützt, die Ampel zeigt ' + ampName(a) +
          '. Mit In = ' + n('in0', g(b, 'In'), 0) + ' A gilt Ib ≤ In ≤ Iz (' + n('ib', g(b, 'ib'), 0) + ' A ≤ ' + n('in1', g(b, 'In'), 0) + ' A ≤ ' + n('iz1', m(b, 'iz'), 0) + ' A) und die Ampel zeigt ' + ampName(b) + '. Der Nennstrom wird nach der Leitung gewählt, nicht nach dem Verbraucher allein. Die Belastbarkeiten sind Übungswerte.';
      } },
    { id: 'elx15', name: 'Schmelzsicherung gG', cat: 'Schutzorgane', rig: 'schutz',
      spec: () => ({ ctl: { dev: 'gG', In: 16, q: 2.5, ib: 10, i: 3 }, seq: [{ t: 4, set: { i: 5 } }, { t: 8, set: { i: 10 } }], dur: 12 }),
      text(X) {
        const { a, S, n } = X, b = S({ i: 5 }), c = S({ i: 10 });
        must(m(a, 'tMax') > m(b, 'tMax') && m(b, 'tMax') > m(c, 'tMax') && m(a, 'tMin') < m(a, 'tMax'), 'Schmelzzeit sinkt mit dem Strom, Band');
        return 'Die Schmelzsicherung gG16 schmilzt umso schneller, je größer der Strom ist (Lehrmodell mit I²t). Bei ' + n('x0', g(a, 'i'), 0) + ' · In (' + n('i0', m(a, 'strom'), 0) + ' A) dauert es ' + n('a0', m(a, 'tMin'), 2) + ' s bis ' + n('b0', m(a, 'tMax'), 2) + ' s, bei ' + n('x1', g(b, 'i'), 0) + ' · In (' + n('i1', m(b, 'strom'), 0) + ' A) nur ' +
          n('a1', m(b, 'tMin'), 2) + ' s bis ' + n('b1', m(b, 'tMax'), 2) + ' s und bei ' + n('x2', g(c, 'i'), 0) + ' · In (' + n('i2', m(c, 'strom'), 0) + ' A) ' + n('a2', m(c, 'tMin') * 1000, 0) + ' ms bis ' + n('b2', m(c, 'tMax') * 1000, 0) + ' ms. Das Band zeigt die Streuung der Sicherung. Das ist ein Lehrmodell: Die Herstellerkennlinie ist maßgeblich.';
      } },
    { id: 'elx16', name: 'Kurzschlussstrom am Verteiler und an der Steckdose', cat: 'Schutzorgane', rig: 'netz',
      spec: () => ({ ctl: { form: 'TN-S', q: 2.5, qpe: 2.5, l: 40, zv: 0.4, dev: 'LS-B', In: 16, kreis: 'end', fehler: 'koerperschluss' }, ref: { l: 5 }, fire: true }),
      text(X) {
        const { a, b, n } = X, C = CORE(), sa = C.prot.shortCircuit({ q: g(a, 'q'), l: g(a, 'l'), zv: g(a, 'zv') }), sb = C.prot.shortCircuit({ q: g(b, 'q'), l: g(b, 'l'), zv: g(b, 'zv') }), ia = C.prot.ia('LS-B', 16);
        must(sa.ok && sb.ok && sb.ik > sa.ik && sa.ik > ia, 'Kurzschlussstrom am Verteiler größer, beide über Ia');
        return 'Der Kurzschlussstrom hängt vom Weg durch die Schleife aus Außenleiter und Neutralleiter ab: I_K = U0 / Z. Am Verteiler (nach ' + n('l0', g(b, 'l'), 0) + ' m Leitung) ist Z = ' + n('z0', sb.zLN, 4) + ' Ω und I_K = ' + n('k0', sb.ik, 0) + ' A. An der Steckdose (nach ' + n('l1', g(a, 'l'), 0) + ' m) ist Z = ' + n('z1', sa.zLN, 4) + ' Ω und I_K = ' +
          n('k1', sa.ik, 0) + ' A. Beide Ströme liegen weit über Ia = ' + n('ia', ia, 0) + ' A des B16: Der LS-Schalter löst sicher aus. Das Ausschaltvermögen des Schutzorgans muss zum größten Kurzschlussstrom passen (Datenblatt, Norm maßgeblich). Übungsanlage.';
      } },
    /* ---------------------------------------------------------------- RCD */
    { id: 'elx17', name: 'Die Prüftaste', cat: 'RCD', rig: 'rcd',
      spec: () => ({ ctl: { idn: 30, type: 'A', form: 'sinus', iFehler: 0, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 }, seq: [{ t: 1, fire: true }], dur: 6, fire: true }),
      text(X) {
        const { a, n } = X, tb = CORE().rcd.testButton({ idn: g(a, 'idn'), type: a.rig.getControl('type') });
        must(tb.tripped === true && tb.prueftSchutzleiter === false && a.s.tasteGedrueckt === true, 'Prüftaste löst aus, prüft den Schutzleiter nicht');
        return 'Die Prüftaste erzeugt im RCD (IΔn = ' + n('idn', g(a, 'idn'), 0) + ' mA, Typ ' + a.rig.getControl('type') + ') einen künstlichen Differenzstrom: Der RCD löst aus, die Auslösefunktion arbeitet. Die Prüftaste prüft aber nur diese Funktion, nicht den Schutzleiter und nicht den Erdungswiderstand: Der Schutzleiter der Anlage bleibt ungeprüft. ' +
          'Die Ableitströme der drei Geräte ergeben ' + n('id', m(a, 'idiff'), 0) + ' mA, das sind ' + n('r', m(a, 'ratio'), 2) + ' · IΔn und liegen unter der Grenze von ' + n('rg', naheRatio(), 1) + ' · IΔn (Lehrfaustwert). Drücke die Prüftaste im Prüfstand selbst.';
      } },
    { id: 'elx18', name: 'Körperschluss über den Menschen', cat: 'RCD', rig: 'rcd',
      spec: () => ({ ctl: { idn: 30, type: 'A', form: 'sinus', iFehler: 0, person: true, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 }, seq: [{ t: 1, fire: true }], dur: 6, fire: true }),
      text(X) {
        const { a, n } = X, p = CORE().rcd.person({ idn: g(a, 'idn'), haut: 'rechen', rv: 0 });
        must(m(a, 'ausgeloest') === 1 && p.verkuerzt === true && p.zoneOhne.zone === 4 && p.zoneMit.zone === 3, 'RCD löst aus, Zone 4 wird auf Zone 3 verkürzt');
        return 'Ein Mensch berührt einen unter Spannung stehenden Leiter. Mit dem Rechenwert von ' + n('rk', p.rges, 0) + ' Ω für den Körper fließen ' + n('ik', p.iKmA, 0) + ' mA, der Differenzstrom am RCD beträgt mit den Ableitströmen ' + n('id', m(a, 'idiff'), 0) + ' mA. Das ist mehr als IΔn = ' + n('idn', g(a, 'idn'), 0) +
          ' mA: Der RCD löst höchstens nach ' + n('t', m(a, 'tTrip'), 0) + ' ms aus. Ohne RCD läge der Strom bei langer Einwirkung in Zone ' + n('z0', p.zoneOhne.zone, 0) + ', mit der kurzen Zeit in Zone ' + n('z1', p.zoneMit.zone, 0) + '. Der Zusatzschutz verkürzt die Einwirkzeit; er macht die Berührung nicht ungefährlich (die Ampel zeigt ' + ampName(a) + '). Die Auslösezeit ist ein Übungswert.';
      } },
    { id: 'elx19', name: 'Ableitströme summieren sich', cat: 'RCD', rig: 'rcd',
      spec: () => ({ ctl: { idn: 30, type: 'A', form: 'sinus', iFehler: 0, person: false, pe: 'angeschlossen', leak1: 8, leak2: 6, leak3: 4 }, ref: { leak1: 3, leak2: 2, leak3: 1 } }),
      text(X) {
        const { a, b, n } = X, ls = CORE().rcd.leakSum([g(a, 'leak1'), g(a, 'leak2'), g(a, 'leak3')], { idn: g(a, 'idn') });
        must(ls.fehlausloesung === true && m(a, 'ratio') >= lim('rcd_bereich') && m(b, 'ratio') < naheRatio() && m(a, 'ausgeloest') === 0, 'Fehlauslösung nur nach dem Hinzufügen der Ableitströme');
        return 'Jedes Gerät hat einen kleinen Ableitstrom nach Erde (zum Beispiel über Y-Kondensatoren). Hinter einem RCD addieren sich die Ableitströme: ' + n('a1', g(b, 'leak1'), 0) + ' + ' + n('a2', g(b, 'leak2'), 0) + ' + ' + n('a3', g(b, 'leak3'), 0) + ' = ' + n('s0', m(b, 'idiff'), 0) + ' mA, das sind ' + n('r0', m(b, 'ratio'), 2) +
          ' · IΔn (Ampel ' + ampName(b) + '). Mit ' + n('c1', g(a, 'leak1'), 0) + ', ' + n('c2', g(a, 'leak2'), 0) + ' und ' + n('c3', g(a, 'leak3'), 0) + ' mA sind es ' + n('s1', ls.sum, 0) + ' mA = ' + n('r1', ls.ratio, 2) + ' · IΔn: Ab ' + n('rg', lim('rcd_bereich'), 1) +
          ' · IΔn kann der RCD ohne Körperschluss auslösen (Fehlauslösung, Ampel ' + ampName(a) + '). Abhilfe: Geräte auf mehrere RCD verteilen. Die Grenze ist ein Lehrfaustwert (Übungswert).';
      } },
    { id: 'elx20', name: 'Glatter Gleichfehlerstrom', cat: 'RCD', rig: 'rcd',
      spec: () => ({ ctl: { idn: 30, type: 'B', form: 'gleich', iFehler: 30, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 }, ref: { type: 'A' }, seq: [{ t: 1, fire: true }], dur: 6, fire: true }),
      text(X) {
        const { a, b, n } = X;
        must(b.s.blind === true && m(b, 'ausgeloest') === 0 && b.a.ampel === 'rot' && a.s.blind === false && m(a, 'ausgeloest') === 1, 'Typ A blind, Typ B löst aus');
        return 'Ein Gerät mit Gleichrichter kann einen glatten Gleichfehlerstrom (hier ' + n('i', g(a, 'iFehler'), 0) + ' mA) erzeugen. Ein RCD vom Typ ' + b.rig.getControl('type') + ' ist für diese Stromform blind: Er erkennt den Differenzstrom von ' + n('d0', m(b, 'idiff'), 0) + ' mA nicht und löst nicht aus, der Fehler bleibt unbemerkt (Ampel ' + ampName(b) +
          '). Ein RCD vom Typ ' + a.rig.getControl('type') + ' erkennt auch glatten Gleichstrom und löst bei ' + n('d1', m(a, 'idiff'), 0) + ' mA höchstens nach ' + n('t', m(a, 'tTrip'), 0) + ' ms aus. Welche Stromform ein Typ erkennt, ist im Lehrmodell festgelegt (Übungswerte).';
      } },
    { id: 'elx21', name: 'Typen AC, A, F, B', cat: 'RCD', rig: 'rcd',
      spec: () => ({ ctl: { idn: 30, type: 'AC', form: 'puls', iFehler: 50, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 }, seq: [{ t: 3, set: { type: 'A' } }, { t: 6, set: { type: 'F' } }, { t: 9, set: { type: 'B' } }], dur: 12 }),
      text(X) {
        const { a, S, n } = X, C = CORE(), types = ['AC', 'A', 'F', 'B'], shapes = ['sinus', 'puls', 'mix', 'gleich'];
        const sees = sh => types.filter(t => C.rcd.trip({ idn: g(a, 'idn'), type: t }, sh, 50).blind !== true);
        must(sees('sinus').length === 4 && sees('puls').join() === 'A,F,B' && sees('mix').join() === 'F,B' && sees('gleich').join() === 'B' && a.s.blind === true && S({ type: 'A' }).s.blind === false, 'Tabelle Typ gegen Stromform');
        return 'Nicht jeder RCD erkennt jede Stromform. Im Lehrmodell gilt: ' + shapes.map(sh => 'bei ' + WNAME[sh] + ' ' + (sees(sh).length === 1 ? 'erkennt nur der Typ ' : 'erkennen die Typen ') + listDe(sees(sh)) + ' den Fehler').join('; ') + '. Hier fließen ' + n('i', g(a, 'iFehler'), 0) + ' mA pulsierender Gleichstrom: Der Typ ' + a.rig.getControl('type') + ' ist blind, schon der Typ ' + S({ type: 'A' }).rig.getControl('type') +
          ' löst aus. Der Ablauf schaltet die Typen nacheinander um. Die Zuordnung ist ein Lehrmodell (Übungswerte), die Angaben des Herstellers sind maßgeblich.';
      } },
    /* ---------------------------------------------------------------- Schutzklassen */
    { id: 'elx22', name: 'Schutzklasse I: Körperschluss', cat: 'Schutzklassen', rig: 'klassen',
      spec: () => ({ ctl: { sk: 'I', pe: true, fehler: 'koerperschluss', ipa: 4, ipb: 4, umgebung: 'wohnraum', quelle: 'netz', zusatz: 0 }, fire: true }),
      text(X) {
        const { a, n } = X, f = CORE().grid.fault({ form: 'TN-S', q: 2.5, qpe: 2.5, l: 20, zv: 0.4, dev: 'LS-B', In: 16, fehler: 'koerperschluss' });
        must(Math.abs(f.uB - m(a, 'ub')) < 1e-6 && f.ausgeloest === true && m(a, 'tab') > 0, 'Schutzleiter trägt den Fehlerstrom, Abschaltung');
        return 'Bei Schutzklasse I ist das Gehäuse mit dem Schutzleiter verbunden. Im Körperschluss fließt der Fehlerstrom I_F = ' + n('if', f.iF, 0) + ' A über den Schutzleiter zurück zum Netz und löst den LS-Schalter aus (Fehlerschutz durch Abschaltung, höchstens ' + n('t', m(a, 'tab'), 0) +
          ' ms). Bis dahin steht am Gehäuse die Berührungsspannung U_B = ' + n('ub', m(a, 'ub'), 1) + ' V; ein Mensch würde ' + n('ik', m(a, 'ik'), 1) + ' mA aufnehmen (Ampel ' + ampName(a) + '). Ohne Schutzleiteranschluss wäre diese Schutzmaßnahme wirkungslos. Übungsanlage.';
      } },
    { id: 'elx23', name: 'Schutzklasse II: Schutzisolierung', cat: 'Schutzklassen', rig: 'klassen',
      spec: () => ({ ctl: { sk: 'II', pe: true, fehler: 'koerperschluss', ipa: 4, ipb: 4, umgebung: 'wohnraum', quelle: 'netz', zusatz: 0 }, fire: true }),
      text(X) {
        const { a, n } = X, info = CORE().cls.info('II');
        must(m(a, 'ub') === 0 && m(a, 'ik') === 0 && info.pe === false && info.pruefung.indexOf('rpe') < 0, 'kein Gehäusepfad, keine Schutzleiterwiderstandsprüfung');
        return 'Schutzklasse II (Symbol: Doppelquadrat) schützt durch Schutzisolierung statt durch einen Schutzleiter. Auch beim Isolationsfehler führt das berührbare Gehäuse im Modell keine Spannung (U_B = ' + n('ub', m(a, 'ub'), 0) + ' V, Körperstrom ' + n('ik', m(a, 'ik'), 0) +
          ' mA), solange die Schutzisolierung unbeschädigt ist. Deshalb gibt es keinen Schutzleiteranschluss und bei der Geräteprüfung keinen Schutzleiterwiderstand: geprüft werden die Sichtprüfung, der Isolationswiderstand (mindestens ' + n('r', lim('riso_sk2'), 0) + ' MΩ) und der Berührungsstrom (höchstens ' + n('b', lim('ber_sk2'), 1) + ' mA).';
      } },
    { id: 'elx24', name: 'SELV, PELV, Netzteil', cat: 'Schutzklassen', rig: 'klassen',
      spec: () => ({ ctl: { sk: 'III', pe: true, fehler: 'koerperschluss', ipa: 5, ipb: 1, umgebung: 'werkstatt', quelle: 'selv', zusatz: 0 }, ref: { quelle: 'pelv', umgebung: 'bad', ipa: 4, ipb: 4 }, fire: true }),
      text(X) {
        const { a, b, n } = X, C = CORE(), se = C.cls.extra('SELV'), pe = C.cls.extra('PELV');
        must(se.geerdet === false && pe.geerdet === true && m(a, 'ub') < lim('ul_ac') && m(a, 'ik') < m(b, 'ik') && b.a.ampel === 'gelb', 'SELV ungeerdet, PELV geerdet, kleine Spannung, Nässe erhöht den Strom');
        return 'Kleinspannung bleibt unter ' + n('ul', lim('ul_ac'), 0) + ' V Wechselspannung beziehungsweise ' + n('ud', lim('ul_dc'), 0) + ' V glattem Gleichstrom. SELV ist ungeerdet und vom Netz sicher getrennt, PELV ist ebenfalls sicher getrennt, aber geerdet. Im Körperschluss an der Quelle liegen im Modell höchstens ' + n('ub', m(a, 'ub'), 0) +
          ' V am Gehäuse. In der trockenen Werkstatt ergibt das ' + n('ik', m(a, 'ik'), 0) + ' mA (Ampel ' + ampName(a) + '), im Bad mit nasser Haut ' + n('ik1', m(b, 'ik'), 0) + ' mA (Ampel ' + ampName(b) + '): Die Grenzspannung gilt für trockene Bedingungen, bei Nässe ist die Gefährdung größer. Die Quellenspannung ist ein Übungswert.';
      } },
    { id: 'elx25', name: 'IP44 und IP65 lesen', cat: 'Schutzklassen', rig: 'klassen',
      spec: () => ({ ctl: { sk: 'II', pe: true, fehler: 'ohne', ipa: 6, ipb: 5, umgebung: 'aussen', quelle: 'netz', zusatz: 0 }, ref: { ipa: 4, ipb: 4 } }),
      text(X) {
        const { a, b, n } = X, C = CORE(), da = C.ip.decode('IP' + g(a, 'ipa') + g(a, 'ipb')), db = C.ip.decode('IP' + g(b, 'ipa') + g(b, 'ipb'));
        must(da.ok && db.ok && da.a === 6 && da.b === 5 && db.a === 4 && db.b === 4, 'IP65 und IP44 aus dem Kern');
        return 'Der IP-Code besteht aus zwei Ziffern: Die erste (' + n('a0', db.a, 0) + ' bei IP44) beschreibt den Schutz gegen Fremdkörper und Berühren, die zweite (' + n('b0', db.b, 0) + ') den Schutz gegen Wasser. IP44 heißt: ' + db.textA + '; ' + db.textB + '. IP65 heißt: ' + da.textA + '; ' + da.textB + '. Für den Einsatz im Freien ist die zweite Ziffer entscheidend (hier ' + n('b1', da.b, 0) +
          '). Die Tabelle der Ziffern ist eine Übungsdarstellung, Norm maßgeblich.';
      } },
    /* ---------------------------------------------------------------- Isolation und Schutzleiter */
    { id: 'elx26', name: 'Isolationswiderstand trocken und feucht', cat: 'Isolation', rig: 'isolation',
      spec: () => ({ ctl: { art: 'riso', sk: 'I', feuchte: 0.8, schmutz: 0, defekt: false }, ref: { feuchte: 0 }, fire: true }),
      text(X) {
        const { a, b, n } = X, p = CORE().insu.parts({ feuchte: g(a, 'feuchte'), schmutz: 0 }), rm = p.parts[0].R / 1e6, rf = p.parts[1].R / 1e6;
        must(m(b, 'urteil') === 1 && m(a, 'urteil') === 2 && m(a, 'riso') < lim('riso_sk1') && m(b, 'riso') > lim('riso_sk1'), 'trocken bestanden, feucht unter dem Grenzwert');
        return 'Trocken beträgt der Isolationswiderstand ' + n('r0', m(b, 'riso'), 0) + ' MΩ. Feuchtigkeit schafft einen Leckpfad parallel zum Material: Bei der Feuchte ' + n('f', g(a, 'feuchte'), 1) + ' sind es ' + n('rf', rf, 3) + ' MΩ parallel zu ' + n('rm', rm, 0) + ' MΩ. Parallele Pfade addieren sich über die Leitwerte, der kleinste Pfad bestimmt das Ergebnis: ' +
          n('r1', m(a, 'riso'), 3) + ' MΩ. Das liegt unter dem Grenzwert von ' + n('g', lim('riso_sk1'), 0) + ' MΩ für Schutzklasse I: nicht bestanden. Gemessen wird nur am freigeschalteten, getrennten Prüfling. Die Prüfspannung und das Feuchtemodell sind Übungswerte.';
      } },
    { id: 'elx27', name: 'Schutzleiterwiderstand: 2-Leiter gegen 4-Leiter', cat: 'Isolation', rig: 'isolation',
      spec: () => ({ ctl: { art: 'rpe', sk: 'I', mode: '2L', rk: 0.2, len: 5, q: 0.75, bruch: 'kein', wiggle: false }, ref: { mode: '4L' }, fire: true }),
      text(X) {
        const { a, b, n } = X, pm = CORE().pe.measure({ len: g(a, 'len'), q: g(a, 'q'), mode: '4L' });
        must(a.a.ampel === 'rot' && b.a.ampel === 'gruen' && m(a, 'rpe') > lim('rpe_5m') && m(b, 'rpe') < lim('rpe_5m'), '2-Leiter fälschlich rot, 4-Leiter grün');
        return 'Die Anschlussleitung ist ' + n('len', g(a, 'len'), 0) + ' m lang (' + n('q', g(a, 'q'), 2) + ' mm²), ihr Schutzleiter hat nur ' + n('rl', pm.R_Leitung, 3) + ' Ω. Bei der 2-Leiter-Messung addiert sich der Kontaktwiderstand der Messspitzen (' + n('rk', g(a, 'rk'), 1) + ' Ω) und das Gerät zeigt ' + n('r2', m(a, 'rpe'), 3) +
          ' Ω: Das liegt über dem Grenzwert von ' + n('g', lim('rpe_5m'), 1) + ' Ω (Leitung bis 5 m), die Ampel zeigt ' + ampName(a) + ', obwohl der Schutzleiter in Ordnung ist. Bei der 4-Leiter-Messung greift die Spannung getrennt ab, der Kontaktwiderstand fällt heraus: ' + n('r4', m(b, 'rpe'), 3) + ' Ω, Ampel ' + ampName(b) + '. Gemessen wird nur am freigeschalteten, getrennten Prüfling. Übungswerte.';
      } },
    { id: 'elx28', name: 'Y-Kondensator und Berührungsstrom', cat: 'Isolation', rig: 'isolation',
      spec: () => ({ ctl: { art: 'ableit', sk: 'II', cy: 2.2 }, seq: [{ t: 4, set: { cy: 4.7 } }, { t: 8, set: { cy: 10 } }], dur: 12, fire: true }),
      text(X) {
        const { a, S, n } = X, b = S({ cy: 4.7 }), c = S({ cy: 10 }), lt = CORE().leak.touch({ cy: 2.2, sk: 'II' });
        must(Math.abs(m(a, 'iAbleit') - 0.159) < 0.001 && m(b, 'iAbleit') < lim('ber_sk2') && m(c, 'iAbleit') > lim('ber_sk2') && lt.cMaxNf > 6.9 && lt.cMaxNf < 6.95, 'Ströme und größtes C');
        return 'Der Y-Kondensator zwischen Netz und berührbarem Teil lässt Wechselstrom nach Erde fließen: I = 2π · f · C · U. Mit ' + n('c0', g(a, 'cy'), 1) + ' nF sind es ' + n('i0', m(a, 'iAbleit'), 3) + ' mA, mit ' + n('c1', g(b, 'cy'), 1) + ' nF ' + n('i1', m(b, 'iAbleit'), 3) + ' mA. Der Grenzwert für den Berührungsstrom bei Schutzklasse II beträgt ' + n('g', lim('ber_sk2'), 1) +
          ' mA: Das größte zulässige C ist ' + n('cm', lt.cMaxNf, 2) + ' nF. Mit ' + n('c2', g(c, 'cy'), 0) + ' nF fließen ' + n('i2', m(c, 'iAbleit'), 3) + ' mA, die Ampel zeigt ' + ampName(c) + '. Der Kondensator entstört das Gerät (EMV-Lab), vergrößert aber den Ableitstrom. Messung am Prüfgerät durch die Elektrofachkraft; die Rechnung ist eine Simulation.';
      } },
    /* ---------------------------------------------------------------- Prüfplatz */
    { id: 'elx29', name: 'Wasserkocher ohne Mangel', cat: 'Prüfplatz', rig: 'pruefplatz',
      spec: () => ({ ctl: { geraet: 'wasserkocher' }, seq: [{ t: 1, do: 'sicht' }, { t: 2, do: 'rpe' }, { t: 3, do: 'riso' }, { t: 4, do: 'ipe' }, { t: 5, do: 'ergebnis' }], dur: 6 }),
      text(X) {
        const { a, n } = X;
        must(a.s.gesamt === 'bestanden' && m(a, 'urteil') === 1 && a.a.ampel === 'gruen' && m(a, 'rpe') < lim('rpe_5m') && m(a, 'riso') > lim('riso_sk1') && m(a, 'ipe') < lim('ipe_sk1'), 'alle vier Schritte im Grenzbereich, bestanden');
        return 'Der Wasserkocher (Schutzklasse I) wird in der festen Reihenfolge geprüft: Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom. Die Sichtprüfung findet keine Mängel. Der Schutzleiterwiderstand beträgt ' + n('rpe', m(a, 'rpe'), 3) + ' Ω (Grenzwert ' + n('g1', lim('rpe_5m'), 1) + ' Ω bei Leitungen bis 5 m), der Isolationswiderstand ' + n('riso', m(a, 'riso'), 0) +
          ' MΩ (mindestens ' + n('g2', lim('riso_sk1'), 0) + ' MΩ) und der Schutzleiterstrom ' + n('ipe', m(a, 'ipe'), 3) + ' mA (Übungsgrenze ' + n('g3', lim('ipe_sk1'), 1) + ' mA). „Bestanden“ gilt nur, weil alle vier Schritte durchgeführt und mit dem Grenzwert verglichen sind; fehlt ein Schritt, gibt es kein Urteil. Übungsprotokoll, kein Prüfnachweis.';
      } },
    { id: 'elx30', name: 'Bohrmaschine mit Isolationsfehler', cat: 'Prüfplatz', rig: 'pruefplatz',
      spec: () => ({ ctl: { geraet: 'bohrmaschine', m_isolation_defekt: true }, seq: [{ t: 1, do: 'sicht' }, { t: 2, do: 'riso' }, { t: 3, do: 'ipe' }, { t: 4, do: 'ergebnis' }], dur: 5 }),
      text(X) {
        const { a, n } = X;
        must(a.s.gesamt === 'nicht bestanden' && m(a, 'riso') < lim('riso_sk2') && m(a, 'ipe') < lim('ber_sk2') && m(a, 'urteil') === 2, 'Isolation unter 2 MΩ, Berührungsstrom in Ordnung, nicht bestanden');
        return 'Die Bohrmaschine ist Schutzklasse II: Es gibt keinen Schutzleiter, also entfällt der Schutzleiterwiderstand. Geprüft werden die Sichtprüfung (keine Mängel), der Isolationswiderstand und der Berührungsstrom. Der Isolationswiderstand beträgt nur ' + n('riso', m(a, 'riso'), 3) + ' MΩ, verlangt sind mindestens ' + n('g1', lim('riso_sk2'), 0) +
          ' MΩ: Dieser Schritt ist rot. Der Berührungsstrom von ' + n('ber', m(a, 'ipe'), 3) + ' mA liegt unter dem Grenzwert von ' + n('g2', lim('ber_sk2'), 1) + ' mA. Ein einziger nicht eingehaltener Schritt genügt: nicht bestanden, das Gerät wird nicht weiterverwendet (reparieren oder aussondern). Übungsprotokoll, kein Prüfnachweis.';
      } },
    { id: 'elx31', name: 'Verlängerung mit Schutzleiterbruch', cat: 'Prüfplatz', rig: 'pruefplatz',
      spec: () => ({ ctl: { geraet: 'verlaengerung', m_pe_unterbrochen: true }, seq: [{ t: 1, do: 'sicht' }, { t: 2, do: 'rpe' }, { t: 3, do: 'riso' }, { t: 4, do: 'ipe' }, { t: 5, do: 'ergebnis' }], dur: 6 }),
      text(X) {
        const { a, n } = X, dev = a.rig.pruefling();
        must(a.s.gesamt === 'nicht bestanden' && m(a, 'rpe') > 5e5 && m(a, 'riso') > lim('riso_sk1') && m(a, 'ipe') < lim('ipe_sk1') && dev.faults.join() === 'pe-unterbrochen', 'Überlauf beim Schutzleiterwiderstand, übrige Schritte in Ordnung');
        return 'Die Verlängerungsleitung ist ' + n('len', CORE().device.catalog.find(x => x.id === 'verlaengerung').leitungM, 0) + ' m lang, deshalb gilt der Grenzwert ' + n('g', lim('rpe_5m'), 1) + ' Ω. Die Sichtprüfung findet nichts: Der Schutzleiterbruch sitzt im Inneren und lässt sich nur messen. Der Schutzleiterwiderstand liegt über dem Messbereich des Geräts (Überlauf): Der Schutzleiter ist unterbrochen. ' +
          'Der Isolationswiderstand (' + n('riso', m(a, 'riso'), 0) + ' MΩ) und der Schutzleiterstrom (' + n('ipe', m(a, 'ipe'), 3) + ' mA) sind in Ordnung, trotzdem gilt: nicht bestanden. Die Messreihenfolge deckt solche Fehler auf, ein einzelner guter Wert nicht. Übungsprotokoll, kein Prüfnachweis.';
      } },
    /* ---------------------------------------------------------------- Sicherheitsregeln und Erste Hilfe */
    { id: 'elx32', name: 'Fünf Sicherheitsregeln am Schaltschrank', cat: 'Sicherheitsregeln', rig: 'regeln',
      spec: () => ({ ctl: { modus: 'regeln', szene: 'schaltschrank' }, seq: [{ t: 1, do: 'freischalten' }, { t: 2, do: 'sichern' }, { t: 3, do: 'spannungsfrei' }, { t: 4, do: 'erden' }, { t: 5, do: 'abdecken' }], dur: 6 }),
      text(X) {
        const { a, n } = X, L = CORE().rules.list;
        must(m(a, 'schritte') === 5 && m(a, 'fehler') === 0 && a.a.ampel === 'gruen' && a.s.folge.join() === CORE().rules.five.join(), 'fünf Schritte richtig, kein Fehler');
        return 'Vor Arbeiten an einer elektrischen Anlage gelten die fünf Sicherheitsregeln in dieser festen Reihenfolge: ' + L.map((r, i) => (i + 1) + '. ' + r.name).join('; ') + '. Hier sind ' + n('s', m(a, 'schritte'), 0) + ' von ' + n('s5', 5, 0) + ' Schritten richtig, Fehler: ' + n('f', m(a, 'fehler'), 0) + '. Jede Regel hat ihren Grund: Zum Beispiel beweist erst die Feststellung der Spannungsfreiheit, dass das Freischalten gewirkt hat. ' +
          'Spannungsprüfer, Schloss und Erdungsseil sind nur Symbole. Das ist eine Übung ohne echte Anlage und ersetzt keine Unterweisung. Arbeiten an elektrischen Anlagen sind Sache der Elektrofachkraft oder unterwiesener Personen.';
      } },
    { id: 'elx33', name: 'Rettungskette', cat: 'Sicherheitsregeln', rig: 'regeln',
      spec: () => ({ ctl: { modus: 'rettung', szene: 'schaltschrank' }, seq: [{ t: 1, do: 'eigenschutz' }, { t: 2, do: 'abschalten' }, { t: 3, do: 'notruf' }, { t: 4, do: 'pruefen' }, { t: 5, do: 'massnahmen' }], dur: 6 }),
      text(X) {
        const { a, n } = X, L = CORE().aid.list;
        must(m(a, 'schritte') === 5 && m(a, 'fehler') === 0 && a.a.ampel === 'gruen' && a.s.folge.join() === CORE().aid.chain.join(), 'Rettungskette richtig');
        return 'Nach einem Stromunfall im Labor gilt diese Reihenfolge: ' + L.map((r, i) => (i + 1) + '. ' + r.name).join('; ') + '. Der Eigenschutz steht am Anfang, weil wer selbst verunglückt, nicht helfen kann; der Notruf ' + n('nr', 112, 0) + ' wird abgesetzt, sobald die Gefahrenquelle abgeschaltet ist. Die Maßnahmen richten sich nach dem Befund. Hier sind ' +
          n('s', m(a, 'schritte'), 0) + ' von ' + n('s5', 5, 0) + ' Schritten richtig. Dieses Lab ersetzt keine Unterweisung und keinen Erste-Hilfe-Kurs: Zahlen zur Wiederbelebung lernst du dort. Das ist eine Übung ohne echte Anlage.';
      } },
    { id: 'elx34', name: 'Falsche Reihenfolge', cat: 'Sicherheitsregeln', rig: 'regeln',
      spec: () => ({ ctl: { modus: 'regeln', szene: 'schaltschrank', reihenfolgeFrei: true }, seq: [{ t: 1, do: 'freischalten' }, { t: 2, do: 'sichern' }, { t: 3, do: 'erden' }, { t: 4, do: 'spannungsfrei' }, { t: 5, do: 'abdecken' }], dur: 6 }),
      text(X) {
        const { a, n } = X, C = CORE(), chk = C.rules.check(['freischalten', 'sichern', 'erden'], 'schaltschrank'), ge = C.rules.info('erden');
        must(m(a, 'fehler') >= 1 && m(a, 'schritte') === 2 && a.a.ampel === 'rot' && chk.art === 'reihenfolge' && chk.firstError === 2, 'Erden vor der Spannungsprüfung wird als Reihenfolgefehler erkannt');
        return 'In dieser Folge wird nach dem Sichern sofort geerdet, bevor die Spannungsfreiheit festgestellt ist. Die Prüfung meldet: „' + chk.text + '“ Nur ' + n('s', m(a, 'schritte'), 0) + ' Schritte stehen am Anfang in der richtigen Reihenfolge, die Fehlerzahl ist ' + n('f', m(a, 'fehler'), 0) + ' (die Ampel zeigt ' + ampName(a) +
          '). Der Grund der Regel: ' + ge.grund + ' Die Reihenfolge der fünf Sicherheitsregeln ist fest; wer sie vertauscht, kann sich und andere gefährden. Das ist eine Übung ohne echte Anlage und ersetzt keine Unterweisung.';
      } }
  ];

  let EX_CACHE = null;
  function buildExamples() {
    const C = CORE(), R = RIGS();
    if (!C || !R || !R.defs) return [];
    for (const k of ['koerper', 'netz', 'schutz', 'rcd', 'klassen', 'isolation', 'pruefplatz', 'regeln']) if (!R.defs[k]) return [];
    const out = [];
    EXDEFS.forEach(def => {
      try {
        const d = def.spec(), preset = d.preset ? R.defs[def.rig].presets.find(p => p.id === d.preset) : null;
        const base = Object.assign({}, preset ? (preset.params || preset.controls || {}) : {}, d.ctl || {});
        const controls = fullCtl(def.rig, base);
        const seqActs = (d.seq || []).filter(e => e && (e.fire || e.do)).slice().sort((a, b) => a.t - b.t).map(e => (e.do ? e.do : 'fire'));
        const acts = d.act ? d.act.slice() : (d.fire && !seqActs.includes('fire') ? ['fire'].concat(seqActs) : seqActs);
        const S = (over, act) => snap(def.rig, Object.assign({}, controls, over || {}), act === undefined ? acts : act);
        const X = { a: S({}), b: d.ref ? S(d.ref) : null, S };
        if (!X.a.ok || (X.b && !X.b.ok)) throw new Error((X.a.errors.concat(X.b ? X.b.errors : [])[0]) || 'Prüfstand nicht verfügbar');
        if (X.a.rejected.length || (X.b && X.b.rejected.length)) throw new Error('Der Prüfstand lehnt Werte ab: ' + X.a.rejected.concat(X.b ? X.b.rejected : []).map(x => x.key).join(', '));
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
  const ELS_DATA = {};
  Object.defineProperty(ELS_DATA, 'examples', { enumerable: true, configurable: true, get() { if (EX_CACHE) return EX_CACHE; const e = buildExamples(); if (e.length === EXDEFS.length && !e.some(x => x.error)) EX_CACHE = e; return e; } });
  ELS_DATA.exampleCount = EXDEFS.length;
  ELS_DATA.exampleIds = EXDEFS.map(d => d.id);
  ELS_DATA.rebuild = () => buildExamples();                  // Neuberechnung ohne Zwischenspeicher (Tests: Determinismus)
  root.ELS_DATA = ELS_DATA;
  if (typeof module !== 'undefined') module.exports = { get examples() { return root.ELS_DATA.examples; }, tasks, register, ELS_TASKS, answerOf, clean, snap };
})(typeof window !== 'undefined' ? window : globalThis);
