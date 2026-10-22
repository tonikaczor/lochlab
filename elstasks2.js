/* elstasks2.js - ELS-Lab: Aufgaben el17 bis el32 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig) (WP4b)
 * Registrierung: ELS_TASKS.register([ ... ]) (ELS_TASKS kommt aus elsdata.js; elsdata.js VOR dieser Datei laden, in Node holt sich die Datei es per require).
 * Format, Regeln und answer-Objekt wie in elsdata.js: { id:'elN', lab:'els', cat, title, level, rig, text, table?, hint[3], start(), sol(), wrong(), check(answer), hintVals(),
 *   fields? | choices?, consts? }; answer = { rig, controls, ref, seq, rows, state, fired, value, text, fields, choices, clicks, protokoll }.
 * Diese Datei ist bewusst eigenstaendig: Sie braucht von elsdata.js nur register(); Hilfsfunktionen (Simulation, Zeilen, Zahlenpruefung) stehen unten.
 * Rechnen nur ueber ELS_CORE (grid, prot, rcd, cls, ip, insu, pe, leak, device, protocol, rules, aid, exercise, limits); die Pruefstaende rechnen selbst nur ueber den Kern.
 * Schwellen und Musterwerte kommen aus dem Kern; Grenzwerte in Texten nur ueber ELS_CORE.limitText. T.thresholds2() nennt die Musterwerte aller Aufgaben.
 * Pruefregeln: Jede Aufgabe ist ein Satz aus Zeilen { ok, text, why }; "why" nennt den Fehler mit der Zahl aus derselben Rechnung. Pruefplatz-Aufgaben (el24-el27, el32)
 *   pruefen die durchgefuehrten Schritte, ihre Reihenfolge und das Protokoll (protocol.check); der Pruefling kommt aus dem Pruefstand (rig.pruefling()).
 * Mangel-Zufall: el25 und el32 nutzen den Zufall des Pruefplatzes mit festem Seed (deterministisch, die Mangel-Schalter sind dann im Pruefstand ausgeblendet).
 * Sicherheit: Keine Anleitung zu Arbeiten an Netzspannung; Erste Hilfe nur Notruf 112 und Schrittfolge (keine Zahlen); alle Zahlen sind Uebungswerte (Uebungsanlage).
 * Abweichungen von der SPEC (siehe auch ABWEICHUNGEN.md und AUSBILDER.md F31 ff.):
 *   el17 fragt Typ B bei glattem Gleichfehlerstrom am Pruefstand und den kleinsten Typ bei Pulsstrom als Auswahl (Typ AC bei Sinus bewusst nicht gefragt, F31);
 *   el20 verbindet Pruefstand (Koerperschluss ausloesen) und Auswahl der Folge; el26 nutzt das Ladegeraet (SK II, Berührungsstrom 0,36 mA unter 0,5 mA, ueber 0,25 mA);
 *   el27 liest die Messwerte von fuenf Pruefstand-Prueflingen aus einer Tabelle (Kern: device.measureAll), el32 verbindet Pruefplatz mit einem Netz-Ausschnitt. */
(function (root) {
  'use strict';
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  if (!root.ELS_TASKS) nodeReq('./elsdata.js');
  const T = root.ELS_TASKS;
  if (!T || typeof T.register !== 'function') { if (typeof console !== 'undefined') console.warn('elstasks2.js: elsdata.js fehlt, die Aufgaben el17 bis el32 werden nicht angemeldet.'); return; }

  /* ====================================================================== Hilfsfunktionen */
  const RIGFILES = ['./elsrig-base.js', './elsrig-koerper.js', './elsrig-netz.js', './elsrig-schutz.js', './elsrig-rcd.js', './elsrig-klassen.js', './elsrig-isolation.js', './elsrig-pruefplatz.js', './elsrig-regeln.js'];
  const core = () => { if (!root.ELS_CORE) nodeReq('./elscore.js'); if (root.ELS_CORE && !root.ELS_CORE.exercise) nodeReq('./elscore-pruef.js'); return root.ELS_CORE || null; };
  const rigs = id => { let R = root.ELS_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { core(); RIGFILES.forEach(nodeReq); R = root.ELS_RIGS; } return R || null; };
  const C = () => { const c = core(); if (!c || !c.exercise || !c.protocol) throw new Error('Rechenkern fehlt'); return c; };
  const fin = x => typeof x === 'number' && isFinite(x);
  const arr = x => (Array.isArray(x) ? x : []);
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const clone = o => JSON.parse(JSON.stringify(o));
  const memo = {};
  const once = (k, fn) => (k in memo ? memo[k] : (memo[k] = fn()));
  const f = (x, d) => { const c = core(); if (!fin(x)) return '–'; return c && c.fmt ? c.fmt(x, d == null ? 2 : d) : (+x).toFixed(d == null ? 2 : d).replace('.', ','); };
  const lt = id => C().limitText(id);
  const lv = id => C().limit(id).value;
  const A = (rig, controls, extra) => Object.assign({ rig, controls: controls || {} }, extra || {});
  const nameOf = (o, k) => (o && o[k]) || k;

  /* Zeilen sammeln: fn(r) ruft r(ok, text, why); eine Ausnahme wird als letzte Zeile gemeldet (nie werfen) */
  function rowsOf(fn) {
    const out = [];
    const r = (ok, text, why) => { out.push({ ok: !!ok, text: String(text), why: ok ? '' : String(why || '') }); };
    try { fn(r); } catch (e) { out.push({ ok: false, text: 'Die Prüfung konnte nicht vollständig ausgeführt werden', why: String(e && e.message || e) }); }
    if (!out.length) out.push({ ok: false, text: 'Die Prüfung hat nichts geprüft', why: 'Es liegt keine Antwort vor.' });
    return out;
  }
  const mkCheck = fn => answer => rowsOf(r => fn(obj(answer), r));

  const same = (x, y) => {
    if (typeof x === 'number' && typeof y === 'number') return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
    if (typeof x === 'boolean' || typeof y === 'boolean') return !!x === !!y;
    return String(x) === String(y);
  };
  /* Wirksame Steuerwerte: feste Werte der Aufgabe, darueber das, was die Antwort mitbringt */
  const effCtl = (FIX, a) => Object.assign({}, FIX, obj(a.controls));
  function fixRow(r, c, FIX, keys, names) {
    const bad = keys.filter(k => c[k] !== undefined && !same(c[k], FIX[k]));
    r(bad.length === 0, 'Die Vorgaben der Aufgabe sind unverändert', 'Du hast Vorgaben verändert: ' + bad.map(k => nameOf(names, k)).join(', ') + '. Stelle sie wieder auf die Werte aus der Aufgabe.');
  }
  const PRIO = ['geraet', 'zufall', 'seed', 'anzahl', 'modus', 'szene'];
  const ctlOrder = keys => keys.slice().sort((a, b) => { const x = PRIO.indexOf(a), y = PRIO.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y); });
  /* Ablauf mit rig.do (Pruefplatz, Regeln) ueber den Laeufer des Kerns, wenn er alle Schritte kennt; sonst eigener Laeufer. Rueckgabe { ok, state, assess, meters, rig, errors } */
  function sim(rigId, controls, seq, tEnd) {
    const c = core(), R = rigs(rigId), out = { ok: false, state: null, assess: null, meters: null, rig: null, errors: [] };
    if (!c || !R || !R.defs || !R.defs[rigId]) { out.errors.push('Prüfstand fehlt'); return out; }
    const list = arr(seq).filter(e => e && typeof e === 'object' && fin(+e.t));
    const co = obj(controls);
    if (!list.some(e => typeof e.do === 'string') && typeof c.runSeq === 'function') {
      const o = c.runSeq(rigId, list, tEnd || 1, { controls: co, seed: 1, keepRig: true });
      out.ok = o.ok !== false && !!o.final; out.state = o.final; out.assess = o.assess; out.meters = o.samples && o.samples.length ? o.samples[o.samples.length - 1].meters : null; out.errors = o.errors || []; out.rig = o.rig || null;
      return out;
    }
    const rig = R.create(rigId, { seed: 1 }), set = (k, v) => { try { rig.setControl(k, v); } catch (e) { out.errors.push(String(e && e.message || e)); } };
    ctlOrder(Object.keys(co)).forEach(k => set(k, co[k]));
    list.slice().sort((a, b) => a.t - b.t).forEach(e => {
      const es = obj(e.set); Object.keys(es).forEach(k => set(k, es[k]));
      const er = obj(e.ramp); if (typeof er.key === 'string') set(er.key, er.to);
      if (typeof e.do === 'string') { try { if (typeof rig.do === 'function') rig.do(e.do); else if (typeof rig.act === 'function') rig.act(e.do); else { set('schritt', e.do); rig.fire(); } } catch (er) { out.errors.push(String(er && er.message || er)); } }
      if (e.fire && typeof rig.fire === 'function') { try { rig.fire(); } catch (er) { out.errors.push(String(er && er.message || er)); } }
    });
    try { rig.step(tEnd ? tEnd * 1000 : 1000); } catch (e) { /* nur Darstellung */ }
    try { out.state = clone(rig.state()); out.assess = clone(rig.assess()); out.meters = clone(rig.readMeters()); out.ok = true; } catch (e) { out.errors.push(String(e && e.message || e)); }
    out.rig = rig;
    return out;
  }
  const fired = a => a.fired === true || arr(a.seq).some(e => e && e.fire === true) || (obj(a.state).fired === true && !arr(a.seq).length);

  /* Auswahlzeile: value = gewaehlter Wert, correct = richtiger Wert, whyFn(value) = Begruendung fuer falsche Antworten */
  function choiceRow(r, a, key, correct, label, whyFn) {
    const v = obj(a.choices)[key], ok = v !== undefined && v !== null && String(v) === String(correct);
    r(ok, label, ok ? '' : (v === undefined || v === null || v === '' ? 'Du hast hier noch nichts ausgewählt.' : whyFn(v)));
  }
  /* Rechenzeile ueber eine Kernuebung (exercise.check) */
  function exRow(r, ex, v, label) {
    if (!fin(v)) { r(false, label, 'Trage eine Zahl ein.'); return; }
    const c = ex.check(v);
    r(c.ok, label, c.ok ? '' : (c.text + (c.why ? ' ' + c.why : '')));
  }
  /* Zahlenzeile ohne Kernuebung: o = { targets:[Anzeigewert, ...], tol, scale (Anzeigeeinheit in SI, z. B. 0,001 fuer mA), errs:[{v, text}], hint } */
  function numRow(r, label, v, o) {
    if (!fin(v)) { r(false, label, 'Trage eine Zahl ein.'); return; }
    const within = (x, t, tol) => Math.abs(x - t) <= tol * Math.abs(t) + 1e-12;
    const cand = [v]; if (o.scale && o.scale !== 1) cand.push(v / o.scale);
    const hit = list => cand.some(x => list.some(t => within(x, t, o.tol == null ? 0.03 : o.tol)));
    if (hit(o.targets)) { r(true, label, ''); return; }
    const e = arr(o.errs).find(q => hit([q.v]));
    if (e) { r(false, label, e.text); return; }
    r(false, label, 'Dein Wert ' + f(v, 4) + ' ' + (o.unit || '') + ' ist ' + (v < o.targets[0] ? 'zu klein' : 'zu groß') + '. ' + (o.hint || ''));
  }

  /* ---------------------------------------------------------------- Pruefplatz: Zustand, Schritte, Protokoll */
  const STEPNAME = { sicht: 'Sichtprüfung', rpe: 'Schutzleiterwiderstand', riso: 'Isolationswiderstand', ipe: 'Schutzleiterstrom', ber: 'Berührungsstrom' };
  const DISP = v => String(+(+v).toPrecision(4)).replace('.', ',');
  function expectDev(FIX) {
    return once('dev' + JSON.stringify(FIX), () => { const s = sim('pruefplatz', FIX, [], 1); const d = s.rig && s.rig.pruefling ? s.rig.pruefling() : null; if (!d) throw new Error('Prüfling fehlt'); return d; });
  }
  /* Zustand der Pruefung aus der Antwort: bevorzugt der Ablauf (do-Zeilen, wird neu abgespielt), sonst der Zustand des Pruefstands */
  function pruefState(a, FIX) {
    const hasDo = arr(a.seq).some(e => e && typeof e.do === 'string');
    if (hasDo) {
      const s = sim('pruefplatz', effCtl(FIX, a), a.seq, 1);
      if (!s.ok || !s.rig) return null;
      const st = s.state || {}, dev = s.rig.pruefling();
      return { dev, done: arr(st.done).map(String), inspected: arr(st.inspected), ergebnis: st.ergebnis === true };
    }
    const st = obj(a.state);
    if (Array.isArray(st.done)) return { dev: { id: String(st.geraet || ''), faults: arr(st.faults).map(String), seed: fin(+st.seed) ? +st.seed : 1 }, done: st.done.map(String), inspected: arr(st.inspected), ergebnis: st.ergebnis === true };
    return null;
  }
  const catOf = id => C().device.catalog.find(d => d.id === id);
  function schrittRows(r, ps, exp) {
    const c = C(), cat = catOf(exp.id), req = c.cls.info(cat.sk).pruefung;
    r(!!ps && ps.dev.id === exp.id && ps.dev.faults.slice().sort().join() === exp.faults.slice().sort().join(), 'Du prüfst den richtigen Prüfling (' + cat.name + ')',
      'Geprüft wurde ' + (ps ? ps.dev.id : 'nichts') + '. Der Prüfling der Aufgabe ist ' + cat.name + ' mit den Vorgaben der Aufgabe; wechsle den Prüfling nicht.');
    const done = ps ? ps.done : [], missing = req.filter(s => done.indexOf(s) < 0);
    r(!!ps && missing.length === 0, 'Alle Prüfschritte sind durchgeführt (' + req.map(s => STEPNAME[s === 'ipe' && cat.sk === 'II' ? 'ber' : s]).join(', ') + ')',
      'Es fehlt ' + (missing.length ? missing.map(s => STEPNAME[s === 'ipe' && cat.sk === 'II' ? 'ber' : s]).join(', ') : 'der Ablauf') + '. Ein fehlender Prüfschritt verhindert das Urteil „bestanden“ (nicht gemessen heißt nicht bestanden).');
    const doneReq = done.filter(s => req.indexOf(s) >= 0), vd = c.device.verdict({ reihenfolge: doneReq }, { id: cat.id, sk: cat.sk, leitungM: cat.leitungM });
    r(!!ps && doneReq.length > 0 && vd.reihenfolgeOk === true, 'Die Prüfreihenfolge ist eingehalten',
      'Die feste Reihenfolge ist ' + req.map(s => STEPNAME[s === 'ipe' && cat.sk === 'II' ? 'ber' : s]).join(', dann ') + '. Du hast ' + (doneReq.length ? doneReq.map(s => STEPNAME[s === 'ipe' && cat.sk === 'II' ? 'ber' : s]).join(', dann ') : 'noch keinen Schritt') + ' durchgeführt.');
  }
  function protoRows(r, entry, exp) {
    const c = C(), groups = [
      ['Das Kopffeld des Protokolls ist vollständig und stimmt (Gerät, Nummer, Standort, Schutzklasse, Prüfer, Datum, Messgerät, Prüfart)', x => !/^(sicht|ergebnis|massnahme)$/.test(x.feld) && !/^messwerte/.test(x.feld)],
      ['Die Sichtprüfung ist richtig eingetragen (alle Mängel, keine erfundenen)', x => x.feld === 'sicht'],
      ['Die Messwerte im Protokoll passen zur Messung', x => /^messwerte/.test(x.feld)],
      ['Gesamtergebnis und Maßnahme sind richtig', x => x.feld === 'ergebnis' || x.feld === 'massnahme']
    ];
    const e = obj(entry);
    if (!Object.keys(e).length) { groups.forEach(g => r(false, g[0], 'Das Prüfprotokoll fehlt: Fülle es im Tab „Prüfprotokoll“ aus (Werte aus dem Prüfplatz übernehmen).')); return; }
    const chk = c.protocol.check(e, exp), ab = arr(chk.abweichungen);
    const wrongDev = e.dev && obj(e.dev).id !== undefined && String(e.dev.id) !== exp.id;
    groups.forEach((g, i) => {
      const hit = ab.filter(g[1]);
      if (i === 0 && wrongDev) { r(false, g[0], 'Das Protokoll gehört zu einem anderen Prüfling (' + e.dev.id + ').'); return; }
      r(hit.length === 0, g[0], hit.map(x => x.text).join(' '));
    });
    if (chk.ok === false && !ab.length) r(false, 'Das Protokoll ist stimmig', chk.text || chk.why || 'Das Protokoll konnte nicht geprüft werden.');
  }
  /* Musterprotokoll aus den durchgefuehrten Schritten (wie rig.protokollWerte + Eintraege des Azubis) */
  function musterEntry(FIX, over) {
    const c = C(), exp = expectDev(FIX), cat = catOf(exp.id), steps = c.cls.info(cat.sk).pruefung;
    const s = sim('pruefplatz', FIX, steps.map((x, i) => ({ t: i, do: x })).concat([{ t: steps.length, do: 'ergebnis' }]), 1);
    const w = s.rig.protokollWerte(), mw = {};
    Object.keys(obj(w.messwerte)).forEach(k => { if (fin(w.messwerte[k])) mw[k] = DISP(w.messwerte[k]); });
    const gesamt = String(w.ergebnis === 'bestanden' || (obj(s.state).gesamt === 'bestanden') ? 'bestanden' : 'nicht bestanden');
    return Object.assign({ dev: { id: exp.id, faults: exp.faults.slice(), seed: exp.seed }, geraet: cat.name, geraetenummer: 'P-0' + (10 + C().device.catalog.indexOf(cat)), standort: 'Lehrwerkstatt', schutzklasse: cat.sk, pruefer: 'Azubi Übung', datum: '2026-10-22',
      messgeraet: 'Prüfgerät (Übung)', pruefart: 'Wiederholungsprüfung', sicht: arr(w.sicht).map(String), messwerte: mw, ergebnis: gesamt, massnahme: gesamt === 'bestanden' ? 'weiterverwenden' : 'reparieren', naechste: '' }, over || {});
  }
  function musterSeq(sk, ohne) {
    const steps = C().cls.info(sk).pruefung.filter(s => s !== ohne);
    return steps.map((x, i) => ({ t: i, do: x })).concat([{ t: steps.length, do: 'ergebnis' }]);
  }
  /* Messwerte eines Pruefstand-Prueflings (Kern: device.measureAll und verdict mit allen Schritten) */
  function devVals(dev) {
    const c = C(), cat = catOf(dev.id), m = c.device.measureAll(dev, { seed: dev.seed || 1 }), vd = c.device.verdict({ sicht: m.sicht, rpe: m.rpe, riso: m.riso, ipe: m.ipe, ber: m.ber }, { id: cat.id, sk: cat.sk, leitungM: cat.leitungM });
    return { cat, m, vd };
  }

  /* ====================================================================== el17: RCD-Typ bei Gleichfehlerstrom */
  const M17 = (() => {
    const FIX = { idn: 30, type: 'A', form: 'gleich', iFehler: 60, person: false, pe: 'angeschlossen', leak1: 3, leak2: 2, leak3: 1 };
    const NAMES = { idn: 'Nennfehlerstrom', form: 'Stromform', iFehler: 'Fehlerstrom', person: 'Berührung', pe: 'Schutzleiter', leak1: 'Ableitstrom 1', leak2: 'Ableitstrom 2', leak3: 'Ableitstrom 3' };
    const seeing = shape => C().rcd.types.filter(t => arr(t.shapes).indexOf(shape) >= 0);
    const vals = () => once('v17', () => {
      const c = C(), s = sim('rcd', Object.assign({}, FIX, { type: 'B' }), [], 1), ls = c.rcd.leakSum([FIX.leak1, FIX.leak2, FIX.leak3], { idn: FIX.idn });
      return { idn: FIX.idn, iFehler: FIX.iFehler, leak: ls.sum, idiff: s.meters ? s.meters.idiff : NaN, big: seeing('gleich')[0].id, small: seeing('puls')[0].id, nPuls: seeing('puls').length };
    });
    const tname = id => (C().rcd.types.find(t => t.id === id) || { name: 'Typ ' + id }).name;
    const list = shape => seeing(shape).map(t => t.name).join(', ');
    const check = mkCheck((a, r) => {
      const c = C(), v = vals(), ctl = effCtl(FIX, a);
      fixRow(r, ctl, FIX, Object.keys(NAMES), NAMES);
      const tr = c.rcd.trip({ idn: Number(ctl.idn), type: String(ctl.type) }, 'gleich', v.idiff);
      r(tr.ok !== false && tr.tripped === true && !tr.blind, 'Der RCD erkennt den glatten Gleichfehlerstrom und löst aus', 'Typ ' + ctl.type + ': ' + (tr.text || tr.why || 'keine Auslösung') + ' Glatten Gleichstrom erkennt im Lehrmodell nur ' + list('gleich') + '.');
      choiceRow(r, a, 'puls', v.small, 'Für pulsierenden Gleichfehlerstrom ist ' + tname(v.small) + ' der kleinste passende Typ', w => {
        const t2 = c.rcd.trip({ idn: FIX.idn, type: String(w) }, 'puls', v.idiff);
        if (t2.ok === false || t2.blind || !t2.tripped) return tname(w) + ' erkennt pulsierenden Gleichfehlerstrom nicht: ' + (t2.text || t2.why || '') + ' Pulsstrom erkennen ' + list('puls') + '.';
        return tname(w) + ' erkennt pulsierenden Gleichfehlerstrom zwar auch, ist aber mehr als nötig (' + (C().rcd.types.find(t => t.id === w) || { text: '' }).text + '). Der kleinste Typ für Pulsstrom ist ' + tname(v.small) + '.';
      });
    });
    return { vals, check,
      text: () => { const v = vals(); return '(a) Hinter einem RCD mit IΔn = ' + f(v.idn, 0) + ' mA liegt ein Verbraucher mit glattem Gleichfehlerstrom (Fehlerstrom ' + f(v.iFehler, 0) + ' mA, dazu ' + f(v.leak, 0) + ' mA Ableitströme der drei Geräte). Der eingebaute Typ A erkennt diese Stromform nicht (Prüfstand „RCD – der Summenstrom“). Wähle am Prüfstand den passenden Typ. (b) Bei einem anderen Verbraucher fließt ein pulsierender Gleichfehlerstrom: Welcher RCD-Typ ist der kleinste, der ihn noch erkennt? Die Typen sind ein Lehrmodell (Übungswerte, F9, F31).'; },
      choices: () => [{ key: 'puls', q: 'Welcher RCD-Typ ist für pulsierenden Gleichfehlerstrom der kleinste passende?', options: C().rcd.types.map(t => ({ value: t.id, label: t.name })) }],
      hint: () => { const v = vals(); return [
        'Jeder RCD-Typ erkennt nur bestimmte Stromformen. Sieh in der Typ-Tabelle des Prüfstands nach, welche Typen glatten und welche pulsierenden Gleichstrom erkennen. Ein RCD, der die Stromform nicht erkennt, löst trotz großem Differenzstrom nicht aus.',
        'Der Differenzstrom beträgt ' + f(v.idiff, 0) + ' mA und liegt über IΔn = ' + f(v.idn, 0) + ' mA; trotzdem löst Typ A bei glattem Gleichstrom nicht aus. Glatten Gleichstrom erkennt ' + list('gleich') + '. Pulsstrom erkennen ' + f(v.nPuls, 0) + ' Typen: ' + list('puls') + '.',
        'Musterlösung: (a) ' + tname(v.big) + ' am Prüfstand einstellen. (b) ' + tname(v.small) + ': der kleinste Typ, der Pulsstrom noch erkennt; die größeren Typen erkennen ihn auch, sind aber mehr als nötig.'
      ]; },
      start: () => A('rcd', Object.assign({}, FIX), { choices: {} }),
      sol: () => A('rcd', Object.assign({}, FIX, { type: vals().big }), { choices: { puls: vals().small } }),
      wrong: () => { const v = vals(); return [{ name: 'Typ AC, blind', answer: A('rcd', Object.assign({}, FIX, { type: 'AC' }), { choices: { puls: 'AC' } }) }, { name: 'Typ B bei Pulsstrom, übertrieben', answer: A('rcd', Object.assign({}, FIX, { type: v.big }), { choices: { puls: v.big } }) }]; } };
  })();

  /* ====================================================================== el18: Schutzklassen-Symbole */
  const M18 = (() => {
    const IDS = ['I', 'II', 'III'];
    const info = id => C().cls.info(id);
    const QS = [
      { key: 'quadrat', symbol: 'Doppelquadrat', pre: 'Auf dem Typenschild eines Netzteils steht das Zeichen „Doppelquadrat“ (ein kleines Quadrat innerhalb eines größeren Quadrats). Zu welcher Schutzklasse gehört es?' },
      { key: 'pe', symbol: 'Schutzleiter-Symbol', pre: 'Ein Heizlüfter trägt das Schutzleiter-Symbol auf dem Typenschild. Zu welcher Schutzklasse gehört es?' },
      { key: 'raute', symbol: 'römisch III in einer Raute', pre: 'Eine Handleuchte trägt eine römische III in einer Raute. Zu welcher Schutzklasse gehört dieses Zeichen?' }
    ];
    const truth = q => IDS.filter(id => info(id).symbol === q.symbol)[0];
    const vals = () => once('v18', () => ({ n: QS.length, quadrat: truth(QS[0]), pe: truth(QS[1]), raute: truth(QS[2]) }));
    const check = mkCheck((a, r) => {
      QS.forEach(q => {
        const t = truth(q), ti = info(t);
        choiceRow(r, a, q.key, t, 'Das Zeichen „' + q.symbol + '“ gehört zur ' + ti.name, w => {
          const wi = info(String(w)); if (!wi || wi.ok === false) return 'Die Auswahl ist keine Schutzklasse.';
          return 'Du hast ' + wi.name + ' gewählt. Deren Zeichen ist das „' + wi.symbol + '“ (' + wi.merkmal.replace(/[.]$/, '') + '). Gesucht ist das „' + q.symbol + '“: ' + ti.name + ' (' + ti.merkmal.replace(/[.]$/, '') + ').';
        });
      });
    });
    return { vals, check,
      text: () => 'Ordne die Zeichen den Schutzklassen zu (angelehnt an eine Frage der IHK-Prüfung zum Doppelquadrat). Auf dem Prüfstand „Schutzklassen und Schutzart“ siehst du jede Klasse im Gerätequerschnitt.',
      choices: () => QS.map(q => ({ key: q.key, q: q.pre, options: IDS.map(id => ({ value: id, label: info(id).name })) })),
      hint: () => [
        'Jede Schutzklasse hat ein eigenes Zeichen auf dem Typenschild. Schutzklasse I hat einen Schutzleiteranschluss, Schutzklasse II hat keinen und ist schutzisoliert, Schutzklasse III arbeitet mit Kleinspannung.',
        'Schutzklasse I: ' + info('I').symbol + '. Schutzklasse II: ' + info('II').symbol + '. Schutzklasse III: ' + info('III').symbol + '.',
        'Musterlösung: Doppelquadrat gehört zu ' + info('II').name + ', das Schutzleiter-Symbol zu ' + info('I').name + ', die Raute mit III zu ' + info('III').name + '.'
      ],
      start: () => A('klassen', { sk: 'I', pe: true, fehler: 'ohne' }, { choices: {} }),
      sol: () => { const v = vals(); return A('klassen', { sk: 'I', pe: true, fehler: 'ohne' }, { choices: { quadrat: v.quadrat, pe: v.pe, raute: v.raute } }); },
      wrong: () => [{ name: 'Schutzklasse II mit I verwechselt', answer: A('klassen', {}, { choices: { quadrat: 'I', pe: 'II', raute: 'II' } }) }, { name: 'zu hoch eingeordnet', answer: A('klassen', {}, { choices: { quadrat: 'III', pe: 'III', raute: 'I' } }) }] };
  })();

  /* ====================================================================== el19: IP-Code lesen */
  const M19 = (() => {
    const CODE = 'IP54', DA = [5, 4, 2, 6], DB = [4, 5, 3, 7];
    const dec = () => C().ip.decode(CODE);
    const labA = d => C().ip.decode('IP' + d + '0').textA, labB = d => C().ip.decode('IP0' + d).textB;
    const vals = () => once('v19', () => { const d = dec(); return { a: d.a, b: d.b }; });
    const check = mkCheck((a, r) => {
      const d = dec();
      choiceRow(r, a, 'fremd', d.a, 'Erste Ziffer ' + d.a + ' von ' + CODE + ': ' + d.textA, w => {
        const x = Number(w), lab = fin(x) ? labA(x) : String(w);
        return 'Du hast „' + lab + '“ gewählt, das ist die erste Ziffer ' + w + '.' + (x === d.b ? ' Das ist die zweite Ziffer von ' + CODE + ': Die Ziffern sind vertauscht.' : '') + ' Die erste Ziffer von ' + CODE + ' ist ' + d.a + ': ' + d.textA + '.';
      });
      choiceRow(r, a, 'wasser', d.b, 'Zweite Ziffer ' + d.b + ' von ' + CODE + ': ' + d.textB, w => {
        const x = Number(w), lab = fin(x) ? labB(x) : String(w);
        return 'Du hast „' + lab + '“ gewählt, das ist die zweite Ziffer ' + w + '.' + (x === d.a ? ' Das ist die erste Ziffer von ' + CODE + ': Die Ziffern sind vertauscht.' : '') + ' Die zweite Ziffer von ' + CODE + ' ist ' + d.b + ': ' + d.textB + '.';
      });
    });
    return { vals, check,
      text: () => 'Ein Gerät trägt die Schutzart ' + CODE + ' (Prüfstand „Schutzklassen und Schutzart“ zeigt die beiden Ziffern). Lies den Code: Wogegen schützt die erste, wogegen die zweite Ziffer? Die Tabelle ist eine Übungstabelle (F17), die Norm ist maßgeblich.',
      choices: () => [
        { key: 'fremd', q: 'Erste Ziffer von ' + CODE + ': Schutz gegen Fremdkörper und Berühren', options: DA.map(d => ({ value: d, label: labA(d) })) },
        { key: 'wasser', q: 'Zweite Ziffer von ' + CODE + ': Schutz gegen Wasser', options: DB.map(d => ({ value: d, label: labB(d) })) }],
      hint: () => { const v = vals(); return [
        'Der IP-Code hat zwei Ziffern nach den Buchstaben IP. Die erste Ziffer sagt etwas über feste Fremdkörper und Berühren, die zweite über Wasser. Verwechsle die Reihenfolge nicht.',
        'Die erste Ziffer ist ' + f(v.a, 0) + ', die zweite ' + f(v.b, 0) + '. Die erste Ziffer reicht von 0 bis 6, die zweite von 0 bis 8.',
        'Musterlösung: ' + dec().text
      ]; },
      start: () => A('klassen', { sk: 'I', ipa: 5, ipb: 4 }, { choices: {} }),
      sol: () => { const v = vals(); return A('klassen', { sk: 'I', ipa: 5, ipb: 4 }, { choices: { fremd: v.a, wasser: v.b } }); },
      wrong: () => { const v = vals(); return [{ name: 'Ziffern vertauscht', answer: A('klassen', {}, { choices: { fremd: v.b, wasser: v.a } }) }, { name: 'zu viel Schutz angenommen', answer: A('klassen', {}, { choices: { fremd: 6, wasser: 7 } }) }]; } };
  })();

  /* ====================================================================== el20: Isolationsfehler, was geschieht? */
  const M20 = (() => {
    const FIX = { sk: 'II', pe: true, fehler: 'ohne', zusatz: 0, quelle: 'netz' }, OWN = ['fehler'];
    const OPT = { abschaltung: 'Der Fehlerstrom fließt über den Schutzleiter, das Schutzorgan schaltet ab.', isolierung: 'Das Gehäuse bleibt spannungsfrei: Die Schutzisolierung beherrscht den Fehler.', gefahr: 'Das Gehäuse führt Spannung und nichts schaltet ab.' };
    const effT = id => String(C().cls.effect(id, 'koerperschluss').text).replace(/^Schutzklasse (I|II|III): /, '');
    const folgeOf = id => { const e = C().cls.effect(id, 'koerperschluss'); return e.abschaltung ? 'abschaltung' : (!e.gehaeuseSpannung ? 'isolierung' : 'gefahr'); };
    const vals = () => once('v20', () => ({ richtig: folgeOf(FIX.sk) }));
    const check = mkCheck((a, r) => {
      const c = C(), ctl = effCtl(FIX, a), fx = Object.keys(FIX).filter(k => OWN.indexOf(k) < 0);
      fixRow(r, ctl, FIX, fx, { sk: 'Schutzklasse', pe: 'Schutzleiter', zusatz: 'Zusatzschutz', quelle: 'Quelle' });
      r(ctl.fehler === 'koerperschluss' && fired(a), 'Du hast den Isolationsfehler (Körperschluss) am Prüfstand ausgelöst', 'Stelle „Fehler“ auf Körperschluss und löse ihn mit der Taste aus, dann siehst du, was am Gehäuse geschieht.');
      choiceRow(r, a, 'folge', vals().richtig, 'Folge bei Schutzklasse ' + FIX.sk + ': ' + OPT[vals().richtig], w => {
        const map = { abschaltung: 'I', isolierung: 'II', gefahr: null }, id = map[String(w)];
        if (id) return 'Das gilt für ' + c.cls.info(id).name + ': ' + effT(id) + ' Dein Gerät hat Schutzklasse ' + FIX.sk + ' und keinen Schutzleiteranschluss.';
        return 'Bei Schutzklasse ' + FIX.sk + ' gilt: ' + effT(FIX.sk);
      });
    });
    return { vals, check,
      text: () => 'Ein Gerät der Schutzklasse ' + FIX.sk + ' bekommt einen Isolationsfehler. Stelle am Prüfstand „Schutzklassen und Schutzart“ den Körperschluss ein, löse ihn aus und beobachte Gehäuse, Ampel und Meldung. Welche Folge hat der Fehler bei diesem Gerät? (Übungsanlage, nur Simulation.)',
      choices: () => [{ key: 'folge', q: 'Was geschieht beim Körperschluss bei Schutzklasse ' + FIX.sk + '?', options: Object.keys(OPT).map(k => ({ value: k, label: OPT[k] })) }],
      hint: () => [
        'Die Schutzmaßnahme hängt von der Schutzklasse ab. Schutzklasse I leitet den Fehlerstrom über den Schutzleiter ab, Schutzklasse II verlässt sich auf die Schutzisolierung und hat keinen Schutzleiter.',
        'Bei Schutzklasse I: ' + effT('I') + ' Bei Schutzklasse II: ' + effT('II'),
        'Musterlösung: Körperschluss einstellen und auslösen. Bei ' + C().cls.info(FIX.sk).name + ' gilt: ' + OPT[vals().richtig]
      ],
      start: () => A('klassen', Object.assign({}, FIX), { choices: {} }),
      sol: () => A('klassen', Object.assign({}, FIX, { fehler: 'koerperschluss' }), { fired: true, seq: [{ t: 0, fire: true }], choices: { folge: vals().richtig } }),
      wrong: () => [{ name: 'Schutzklasse II mit Schutzleiterpfad angenommen', answer: A('klassen', Object.assign({}, FIX, { fehler: 'koerperschluss' }), { fired: true, seq: [{ t: 0, fire: true }], choices: { folge: 'abschaltung' } }) }, { name: 'Gefahr angenommen, nichts ausgelöst', answer: A('klassen', Object.assign({}, FIX), { choices: { folge: 'gefahr' } }) }] };
  })();

  /* ====================================================================== el21: Isolationswiderstand bewerten */
  const M21 = (() => {
    const FIX = { art: 'riso', sk: 'I', feuchte: 0.8, schmutz: 0, defekt: false, uPruef: 500 };
    const NAMES = { art: 'Messart', sk: 'Schutzklasse', feuchte: 'Feuchte', schmutz: 'Schmutz', defekt: 'Defekt', uPruef: 'Prüfspannung' };
    const SC = { a: { sk: 'I', feuchte: 0.8 }, b: { sk: 'II', feuchte: 0.3 }, c: { sk: 'II', feuchte: 0.5 } };
    const meas = k => C().insu.measure(SC[k]);
    const vals = () => once('v21', () => { const a = meas('a'), b = meas('b'), c = meas('c'); return { rA: a.rMOhm, rB: b.rMOhm, rC: c.rMOhm, g1: lv('riso_sk1'), g2: lv('riso_sk2'), uPruef: a.U_pruef }; });
    const OPT = [{ value: 'bestanden', label: 'bestanden' }, { value: 'nicht bestanden', label: 'nicht bestanden' }];
    const verd = k => (meas(k).bestanden ? 'bestanden' : 'nicht bestanden');
    const check = mkCheck((a, r) => {
      const c = effCtl(FIX, a);
      fixRow(r, c, FIX, Object.keys(NAMES), NAMES);
      r(fired(a) && c.art === 'riso', 'Du hast die Isolationsmessung am Prüfstand durchgeführt (Gerät A)', 'Löse die Messung am Prüfstand aus, bevor du urteilst: Ohne Messung gibt es kein Urteil.');
      [['a', 'Gerät A (am Prüfstand gemessen)'], ['b', 'Gerät B'], ['c', 'Gerät C']].forEach(([k, nm]) => {
        const m = meas(k), ok = verd(k);
        choiceRow(r, a, k, ok, nm + ': ' + ok + ' (' + f(m.rMOhm, 2) + ' MΩ, Grenzwert ' + lt(m.grenzeId) + ')', w => 'Du hast „' + w + '“ gewählt. ' + m.text + ' Vergleiche den Messwert immer mit dem Grenzwert der Schutzklasse des Geräts, nicht mit einem Gefühl.');
      });
    });
    return { vals, check,
      text: () => { const v = vals(); return 'Beurteile drei Geräte nach der Isolationsmessung mit ' + f(v.uPruef, 0) + ' V (Prüfspannung, Übungswert). Gerät A (Schutzklasse I, feuchte Isolierung): Starte am Prüfstand „Isolation und Schutzleiter“ die Messung. Gerät B (Schutzklasse II): ' + f(v.rB, 2) + ' MΩ. Gerät C (Schutzklasse II): ' + f(v.rC, 2) + ' MΩ. Urteile jeweils mit dem Grenzwert der Schutzklasse (Schutzklasse I ' + lt('riso_sk1') + ', Schutzklasse II ' + lt('riso_sk2') + '). Messung nur am freigeschalteten, getrennten Prüfling.'; },
      table: () => { const v = vals(); return [{ caption: 'Messwerte der Isolationsmessung', head: ['Gerät', 'Schutzklasse', 'R_iso in MΩ'], rows: [['A (am Prüfstand messen)', 'I', 'siehe Prüfstand'], ['B', 'II', f(v.rB, 2)], ['C', 'II', f(v.rC, 2)]] }]; },
      choices: () => [{ key: 'a', q: 'Gerät A (Schutzklasse I): Urteil?', options: OPT }, { key: 'b', q: 'Gerät B (Schutzklasse II): Urteil?', options: OPT }, { key: 'c', q: 'Gerät C (Schutzklasse II): Urteil?', options: OPT }],
      hint: () => { const v = vals(); return [
        'Bewerte nicht nach Gefühl: Vergleiche jeden Messwert mit dem Grenzwert der Schutzklasse. Schutzklasse I und II haben verschiedene Grenzwerte (beide belegt).',
        'Grenzwerte: Schutzklasse I mindestens ' + f(v.g1, 0) + ' MΩ, Schutzklasse II mindestens ' + f(v.g2, 0) + ' MΩ. Gerät A misst ' + f(v.rA, 2) + ' MΩ, Gerät B ' + f(v.rB, 2) + ' MΩ, Gerät C ' + f(v.rC, 2) + ' MΩ.',
        'Musterlösung: A ' + verd('a') + ' (' + f(v.rA, 2) + ' MΩ unter ' + f(v.g1, 0) + ' MΩ), B ' + verd('b') + ' (' + f(v.rB, 2) + ' MΩ über ' + f(v.g2, 0) + ' MΩ), C ' + verd('c') + ' (' + f(v.rC, 2) + ' MΩ unter ' + f(v.g2, 0) + ' MΩ, obwohl über ' + f(v.g1, 0) + ' MΩ).'
      ]; },
      start: () => A('isolation', Object.assign({}, FIX), { choices: {} }),
      sol: () => A('isolation', Object.assign({}, FIX), { fired: true, seq: [{ t: 0, fire: true }], choices: { a: verd('a'), b: verd('b'), c: verd('c') } }),
      wrong: () => [{ name: 'zu früh bestanden, ohne Messung', answer: A('isolation', Object.assign({}, FIX), { choices: { a: 'bestanden', b: 'bestanden', c: 'bestanden' } }) }, { name: 'zu streng, ohne Vergleich', answer: A('isolation', Object.assign({}, FIX), { fired: true, seq: [{ t: 0, fire: true }], choices: { a: 'nicht bestanden', b: 'nicht bestanden', c: 'nicht bestanden' } }) }] };
  })();

  /* ====================================================================== el22: Ableitstrom aus dem Y-Kondensator */
  const M22 = (() => {
    const SEED = 1, FIXK = { art: 'ableit', sk: 'II' };
    const ex = () => once('e22', () => C().exercise('ableit', SEED));
    const cyNf = () => ex().given.C * 1e9;
    const FIX = () => Object.assign({}, FIXK, { cy: cyNf() });
    const vals = () => once('v22', () => { const e = ex(), lk = C().leak.touch({ cy: cyNf(), sk: 'II' }); return { cy: cyNf(), imA: lk.imA, grenze: lv('ber_sk2'), ratio: lk.ratio, cMax: lk.cMaxNf, u: e.given.U, hz: e.given.f }; });
    const YN = [{ value: 'ja', label: 'ja, der Grenzwert wird eingehalten' }, { value: 'nein', label: 'nein, der Grenzwert wird überschritten' }];
    const check = mkCheck((a, r) => {
      const lk = C().leak.touch({ cy: cyNf(), sk: 'II' });
      exRow(r, ex(), obj(a.fields).ableit, 'Der Ableitstrom ist richtig berechnet (' + f(lk.imA, 3) + ' mA)');
      choiceRow(r, a, 'grenze', lk.bestanden ? 'ja' : 'nein', 'Vergleich mit dem Grenzwert ' + lt('ber_sk2') + ': ' + (lk.bestanden ? 'wird eingehalten' : 'wird überschritten'), w => 'Du hast „' + w + '“ gewählt. ' + lk.text + ' Die größte Kapazität bei diesem Grenzwert ist ' + f(lk.cMaxNf, 2) + ' nF.');
    });
    return { vals, check,
      text: () => ex().question + ' Vergleiche das Ergebnis mit dem Grenzwert für den Berührungsstrom bei Schutzklasse II: ' + lt('ber_sk2') + '. Am Prüfstand „Isolation und Schutzleiter“ (Messart Ableitstrom) kannst du den Wert kontrollieren.',
      fields: () => [{ key: 'ableit', label: 'Ableitstrom (Berührungsstrom)', unit: 'mA' }],
      choices: () => [{ key: 'grenze', q: 'Hält das Netzteil den Grenzwert ein?', options: YN }],
      hint: () => { const v = vals(); return [
        'Der Ableitstrom über einen Kondensator hängt von der Kapazität, der Spannung und der Frequenz ab. Der Faktor 2π gehört zur Formel, vergiss ihn nicht. Achte auf nF und mA.',
        'Rechne mit C = ' + f(v.cy, 1) + ' nF, U = ' + f(v.u, 0) + ' V und f = ' + f(v.hz, 0) + ' Hz. Der Grenzwert ist ' + f(v.grenze, 1) + ' mA; das Ergebnis liegt beim ' + f(v.ratio, 2) + '-Fachen des Grenzwerts.',
        'Musterlösung: I = 2π · ' + f(v.hz, 0) + ' Hz · ' + f(v.cy, 1) + ' nF · ' + f(v.u, 0) + ' V = ' + f(v.imA, 3) + ' mA. Der Grenzwert ' + f(v.grenze, 1) + ' mA wird ' + (v.imA <= v.grenze ? 'eingehalten.' : 'überschritten (größte erlaubte Kapazität ' + f(v.cMax, 2) + ' nF).')
      ]; },
      start: () => A('isolation', FIX(), { fields: { ableit: null }, choices: {} }),
      sol: () => { const v = vals(); return A('isolation', FIX(), { fields: { ableit: v.imA }, choices: { grenze: v.imA <= v.grenze ? 'ja' : 'nein' } }); },
      wrong: () => { const v = vals(); return [{ name: 'zu klein, Faktor 10', answer: A('isolation', FIX(), { fields: { ableit: v.imA / 10 }, choices: { grenze: 'ja' } }) }, { name: 'zu groß, Faktor 100', answer: A('isolation', FIX(), { fields: { ableit: v.imA * 100 }, choices: { grenze: 'nein' } }) }]; } };
  })();

  /* ====================================================================== el23: Schutzleiterwiderstand richtig messen */
  const M23 = (() => {
    const FIX = { art: 'rpe', sk: 'I', mode: '2L', rk: 0.2, len: 5, q: 0.75, bruch: 'kein', wiggle: false };
    const NAMES = { art: 'Messart', sk: 'Schutzklasse', rk: 'Kontaktwiderstand', len: 'Leitungslänge', q: 'Querschnitt', bruch: 'Bruchstelle' };
    const cfgA = Object.assign({}, { len: FIX.len, q: FIX.q, rk: FIX.rk, mode: '2L' });
    const mA = () => C().pe.measure(cfgA);
    const mB = () => C().pe.measure({ len: FIX.len, q: FIX.q, mode: '4L', bruch: 'wackel', wiggle: true });
    const alt = () => C().pe.measure({ len: FIX.len, q: FIX.q, rho: C().const.rhoAlt, mode: '4L' }).R;
    const vals = () => once('v23', () => { const a = mA(), b = mB(); return { len: FIX.len, q: FIX.q, rk: FIX.rk, r2l: a.R_gemessen, rLeitung: a.R_Leitung, rAlt: alt(), grenze: a.grenze.value, bMin: b.rMin, bMax: b.rMax }; });
    const OPT = [{ value: 'bestanden', label: 'bestanden' }, { value: 'nicht bestanden', label: 'nicht bestanden' }];
    const check = mkCheck((a, r) => {
      const v = vals(), c = effCtl(FIX, a), mb = mB(), ma = mA();
      fixRow(r, c, FIX, ['art', 'sk', 'rk', 'len', 'q', 'bruch'], NAMES);
      r(fired(a) && c.art === 'rpe', 'Du hast den Schutzleiterwiderstand am Prüfstand gemessen', 'Löse die Messung am Prüfstand aus (Messart Schutzleiterwiderstand), bevor du urteilst.');
      numRow(r, 'Der Schutzleiterwiderstand der Leitung (ohne Kontaktwiderstand) ist richtig: ' + f(v.rLeitung, 3) + ' Ω', obj(a.fields).rpe,
        { targets: [v.rLeitung, v.rAlt], tol: 0.03, unit: 'Ω', errs: [{ v: v.r2l, text: 'Dein Wert ' + f(v.r2l, 3) + ' Ω ist die 2-Leiter-Anzeige mit dem Kontaktwiderstand der Messspitze von ' + f(v.rk, 3) + ' Ω. Er gehört nicht zur Leitung: Miss mit Vier-Leiter-Messung oder ziehe ihn ab, dann bleiben ' + f(v.rLeitung, 3) + ' Ω.' }], hint: 'Ziehe den Kontaktwiderstand ab oder wähle die Vier-Leiter-Messung.' });
      choiceRow(r, a, 'urteil', ma.bestanden === false && !ma.verfaelscht ? 'nicht bestanden' : 'bestanden', 'Urteil Prüfling A: bestanden (' + f(v.rLeitung, 3) + ' Ω unter ' + f(v.grenze, 1) + ' Ω)', w => 'Du hast „' + w + '“ gewählt. Die 2-Leiter-Anzeige ' + f(v.r2l, 3) + ' Ω ist durch den Kontaktwiderstand ' + f(v.rk, 3) + ' Ω verfälscht. Ohne ihn sind es ' + f(v.rLeitung, 3) + ' Ω, Grenzwert ' + lt('rpe_5m') + ': Das Urteil lautet bestanden.');
      choiceRow(r, a, 'urteilB', mb.bestanden ? 'bestanden' : 'nicht bestanden', 'Urteil Prüfling B: nicht bestanden (der Wert schwankt beim Bewegen bis ' + f(v.bMax, 3) + ' Ω)', w => 'Du hast „' + w + '“ gewählt. Beim Bewegen der Leitung schwankt der Wert zwischen ' + f(v.bMin, 3) + ' Ω und ' + f(v.bMax, 3) + ' Ω und überschreitet den Grenzwert ' + lt('rpe_5m') + '. Ein Wert, der beim Bewegen so schwankt, zeigt einen Wackelkontakt (Bruchstelle). ' + mb.text);
    });
    return { vals, check,
      text: () => { const v = vals(); return 'Prüfling A hat eine ' + f(v.len, 0) + ' m lange Anschlussleitung mit ' + f(v.q, 2) + ' mm². Miss am Prüfstand „Isolation und Schutzleiter“ den Schutzleiterwiderstand (der Kontaktwiderstand der Messspitze ist mit ' + f(v.rk, 1) + ' Ω vorgegeben, die Messart steht auf 2-Leiter). Trage den Widerstand der Leitung ohne Kontaktwiderstand ein und urteile mit dem Grenzwert (' + lt('rpe_5m') + '). Prüfling B (gleiche Leitung, Vier-Leiter-Messung, Leitung beim Messen bewegt): Die Anzeige schwankt zwischen ' + f(v.bMin, 3) + ' Ω und ' + f(v.bMax, 3) + ' Ω. Wie urteilst du? Messung nur am freigeschalteten, getrennten Prüfling.'; },
      fields: () => [{ key: 'rpe', label: 'Schutzleiterwiderstand der Leitung (ohne Kontaktwiderstand)', unit: 'Ω' }],
      choices: () => [{ key: 'urteil', q: 'Prüfling A: Urteil?', options: OPT }, { key: 'urteilB', q: 'Prüfling B (Anzeige schwankt beim Bewegen): Urteil?', options: OPT }],
      hint: () => { const v = vals(); return [
        'Bei der 2-Leiter-Messung steckt der Kontaktwiderstand der Messspitze im Messwert und verfälscht ihn. Die Vier-Leiter-Messung zieht ihn heraus. Ein Wert, der beim Bewegen der Leitung springt, deutet auf einen Wackelkontakt.',
        'Die Anzeige zeigt ' + f(v.r2l, 3) + ' Ω; davon sind ' + f(v.rk, 1) + ' Ω Kontaktwiderstand. Bei Prüfling B schwankt der Wert zwischen ' + f(v.bMin, 3) + ' Ω und ' + f(v.bMax, 3) + ' Ω; der Grenzwert ist ' + f(v.grenze, 1) + ' Ω.',
        'Musterlösung: Leitung ' + f(v.rLeitung, 3) + ' Ω (' + f(v.r2l, 3) + ' Ω − ' + f(v.rk, 1) + ' Ω), Urteil A bestanden; Prüfling B nicht bestanden (Wackelkontakt, ' + f(v.bMax, 3) + ' Ω über ' + f(v.grenze, 1) + ' Ω).'
      ]; },
      start: () => A('isolation', Object.assign({}, FIX), { fields: { rpe: null }, choices: {} }),
      sol: () => { const v = vals(); return A('isolation', Object.assign({}, FIX, { mode: '4L' }), { fired: true, seq: [{ t: 0, fire: true }], fields: { rpe: v.rLeitung }, choices: { urteil: 'bestanden', urteilB: 'nicht bestanden' } }); },
      wrong: () => { const v = vals(); return [{ name: '2L ohne Korrektur, falsch rot', answer: A('isolation', Object.assign({}, FIX), { fired: true, seq: [{ t: 0, fire: true }], fields: { rpe: v.r2l }, choices: { urteil: 'nicht bestanden', urteilB: 'nicht bestanden' } }) }, { name: 'Bruch übersehen', answer: A('isolation', Object.assign({}, FIX, { mode: '4L' }), { fired: true, seq: [{ t: 0, fire: true }], fields: { rpe: v.rLeitung }, choices: { urteil: 'bestanden', urteilB: 'bestanden' } }) }]; } };
  })();

  /* ====================================================================== Geraetepruefung: gemeinsame Bausteine fuer el24 bis el26, el32 */
  const PFIX = over => Object.assign({ geraet: 'wasserkocher', modus: 'wiederholung', zufall: false, seed: 1, anzahl: 1, schritt: 'sicht' }, over || {});
  function pruefCheck(FIX, extra) {
    return mkCheck((a, r) => {
      const exp = expectDev(FIX);
      const ps = pruefState(a, FIX);
      schrittRows(r, ps, exp);
      protoRows(r, a.protokoll, exp);
      if (extra) extra(a, r, exp, ps);
    });
  }
  function pruefHint(FIX, vals, extraTip) {
    return () => { const v = vals(), c = C(), exp = expectDev(FIX), cat = catOf(exp.id), req = c.cls.info(cat.sk).pruefung; return [
      'Prüfe in der festen Reihenfolge: ' + req.map(s => STEPNAME[s === 'ipe' && cat.sk === 'II' ? 'ber' : s]).join(', dann ') + '. Danach trägst du Werte, Sichtprüfung, Ergebnis und Maßnahme im Tab „Prüfprotokoll“ ein. Nicht gemessen heißt nicht bestanden.',
      (extraTip ? extraTip(v) + ' ' : '') + 'Der Prüfling ist ' + cat.name + ' mit Schutzklasse ' + cat.sk + '. Die Messungen laufen nur in der Simulation am freigeschalteten Prüfling.',
      'Musterlösung: ' + v.muster
    ]; };
  }
  function musterText(FIX) {
    const c = C(), exp = expectDev(FIX), cat = catOf(exp.id), d = devVals(exp), m = d.m, parts = [];
    if (m.rpe !== null) parts.push('R_PE ' + f(m.rpe, 3) + ' Ω');
    parts.push('R_iso ' + f(m.riso, 1) + ' MΩ');
    const i = cat.sk === 'II' ? m.ber : m.ipe; if (i !== null) parts.push((cat.sk === 'II' ? 'Berührungsstrom ' : 'Schutzleiterstrom ') + f(i, 3) + ' mA');
    const sichtN = arr(m.sicht).length;
    return 'Messwerte ' + parts.join(', ') + '; ' + (sichtN ? sichtN + ' Mangel in der Sichtprüfung (' + m.sicht.map(x => c.device.faultName[x]).join('; ') + ')' : 'Sichtprüfung ohne Mängel') + '; Ergebnis ' + d.vd.gesamt + (d.vd.gesamt === 'bestanden' ? ', Maßnahme weiterverwenden.' : ', Maßnahme reparieren oder aussondern.');
  }
  function pruefStart(FIX) { return () => A('pruefplatz', Object.assign({}, FIX), { protokoll: null, fired: false }); }
  function pruefSol(FIX, over) { return () => { const exp = expectDev(FIX), cat = catOf(exp.id); return A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq(cat.sk), protokoll: musterEntry(FIX, over) }); }; }

  /* ====================================================================== el24: Wasserkocher pruefen und protokollieren */
  const M24 = (() => {
    const FIX = PFIX({ geraet: 'wasserkocher' });
    const vals = () => once('v24', () => { const d = devVals(expectDev(FIX)), m = d.m; return { rpe: m.rpe, riso: m.riso, ipe: m.ipe, gRpe: lv('rpe_5m'), gRiso: lv('riso_sk1'), leitungM: d.cat.leitungM, muster: musterText(FIX) }; });
    return { vals, check: pruefCheck(FIX),
      text: () => { const v = vals(); return 'Ein Wasserkocher (Schutzklasse I, Anschlussleitung ' + f(v.leitungM, 1) + ' m) kommt zur Wiederholungsprüfung. Führe am Prüfplatz alle Prüfschritte in der richtigen Reihenfolge durch (Sichtprüfung, Schutzleiterwiderstand, Isolationswiderstand, Schutzleiterstrom), übernimm die Werte im Tab „Prüfprotokoll“, fülle das Protokoll vollständig aus und trage Ergebnis und Maßnahme selbst ein. Übungsprotokoll, kein Prüfnachweis. Grenzwerte: Schutzleiterwiderstand ' + lt('rpe_5m') + ', Isolationswiderstand ' + lt('riso_sk1') + '.'; },
      hint: pruefHint(FIX, vals, v => 'Grenzwerte: Schutzleiterwiderstand höchstens ' + f(v.gRpe, 1) + ' Ω, Isolationswiderstand mindestens ' + f(v.gRiso, 0) + ' MΩ.'),
      start: pruefStart(FIX), sol: pruefSol(FIX),
      wrong: () => { const s = musterSeq('I', 'riso'), e = musterEntry(FIX); delete e.messwerte.riso; return [
        { name: 'Schritt ausgelassen', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: s, protokoll: e }) },
        { name: 'falsches Ergebnis eingetragen', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq('I'), protokoll: musterEntry(FIX, { ergebnis: 'nicht bestanden', massnahme: 'aussondern' }) }) }]; } };
  })();

  /* ====================================================================== el25: Verlaengerung, den Mangel finden */
  const M25 = (() => {
    const FIX = PFIX({ geraet: 'verlaengerung', zufall: true, seed: 2, anzahl: 1 });
    const vals = () => once('v25', () => { const exp = expectDev(FIX), d = devVals(exp); return { rpe: d.m.rpe, riso: d.m.riso, ipe: d.m.ipe, leitungM: d.cat.leitungM, gRpe: lv('rpe_5m'), mangel: exp.faults.map(x => C().device.faultName[x]).join('; '), n: exp.faults.length, muster: musterText(FIX) }; });
    return { vals, check: pruefCheck(FIX),
      text: () => { const v = vals(); return 'Eine Verlängerungsleitung (Schutzklasse I, ' + f(v.leitungM, 0) + ' m, Grenzwert Schutzleiterwiderstand ' + lt('rpe_5m') + ') hat einen Mangel; welchen, zeigt dir der Prüfstand nicht an (Mangel vom Zufall mit festem Seed). Finde ihn mit der Prüfung am Prüfplatz: Sichtprüfung und alle Messschritte in der richtigen Reihenfolge. Trage die Mängel, Messwerte, das Ergebnis und die Maßnahme ins Prüfprotokoll ein (Übungsprotokoll, kein Prüfnachweis).'; },
      hint: pruefHint(FIX, vals, v => 'Die Leitung hat ' + f(v.n, 0) + ' Mangel. Manche Mängel findet nur die Sichtprüfung, die Messwerte bleiben dabei unauffällig; andere zeigt nur die Messung.'),
      start: pruefStart(FIX), sol: pruefSol(FIX),
      wrong: () => { const s = musterSeq('I').filter(e => e.do !== 'sicht'), e = musterEntry(FIX, { sicht: [] }), e2 = musterEntry(FIX); e2.messwerte = { rpe: e2.messwerte.riso, riso: e2.messwerte.rpe, ipe: e2.messwerte.ipe };
        return [{ name: 'Sicht übersprungen', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: s, protokoll: e }) }, { name: 'Messwerte verwechselt', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq('I'), protokoll: e2 }) }]; } };
  })();

  /* ====================================================================== el26: Netzteil SK II, Beruehrungsstrom */
  const M26 = (() => {
    const FIX = PFIX({ geraet: 'ladegeraet' });
    const vals = () => once('v26', () => { const d = devVals(expectDev(FIX)), m = d.m; return { ber: m.ber, grenze: lv('ber_sk2'), cy: d.cat.cy, riso: m.riso, gRiso: lv('riso_sk2'), halb: lv('ber_sk2') / 2, muster: musterText(FIX) }; });
    const extra = (a, r) => {
      const v = vals();
      numRow(r, 'Der Grenzwert für den Berührungsstrom bei Schutzklasse II ist richtig (' + lt('ber_sk2') + ')', obj(a.fields).grenze,
        { targets: [v.grenze], tol: 0.01, scale: 0.001, unit: 'mA', errs: [{ v: v.halb, text: 'Der halbe Wert ' + f(v.halb, 2) + ' mA ist nicht der Grenzwert: Im Lab gilt ' + lt('ber_sk2') + '. Mit der falschen Grenze würdest du ein Gerät mit ' + f(v.ber, 2) + ' mA fälschlich durchfallen lassen.' }], hint: 'Der Grenzwert steht in den Vorgaben der Aufgabe: ' + lt('ber_sk2') + '.' });
    };
    return { vals, check: pruefCheck(FIX, extra),
      text: () => { const v = vals(); return 'Ein Ladegerät (Netzteil mit Y-Kondensator ' + f(v.cy, 1) + ' nF, Schutzklasse II) kommt zur Wiederholungsprüfung. Schutzklasse II hat keinen Schutzleiter: Es entfällt der Schutzleiterwiderstand, geprüft werden Sichtprüfung, Isolationswiderstand (' + lt('riso_sk2') + ') und Berührungsstrom. Führe die Schritte am Prüfplatz durch, trage den Grenzwert für den Berührungsstrom ein und fülle das Protokoll aus (Übungsprotokoll, kein Prüfnachweis).'; },
      fields: () => [{ key: 'grenze', label: 'Grenzwert Berührungsstrom bei Schutzklasse II', unit: 'mA' }],
      hint: pruefHint(FIX, vals, v => 'Der Berührungsstrom steht im Prüfgerät und wird mit dem Grenzwert ' + f(v.grenze, 1) + ' mA verglichen; er beträgt ' + f(v.ber, 2) + ' mA.'),
      start: () => A('pruefplatz', Object.assign({}, FIX), { protokoll: null, fired: false, fields: { grenze: null } }),
      sol: () => { const s = pruefSol(FIX)(); s.fields = { grenze: vals().grenze }; return s; },
      wrong: () => { const v = vals(); return [
        { name: 'Grenze halbiert, Fehlurteil', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq('II'), fields: { grenze: v.halb }, protokoll: musterEntry(FIX, { ergebnis: 'nicht bestanden', massnahme: 'aussondern' }) }) },
        { name: 'Grenze zu groß', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq('II'), fields: { grenze: v.grenze * 10 }, protokoll: musterEntry(FIX) }) }]; } };
  })();

  /* ====================================================================== el27: Fuenf Geraete nacheinander (Stapel) */
  const M27 = (() => {
    const STAPEL = [{ id: 'wasserkocher', faults: [] }, { id: 'bohrmaschine', faults: ['isolation-feucht'] }, { id: 'verlaengerung', faults: ['pe-hochohmig'] }, { id: 'haartrockner', faults: ['gehaeuse-gebrochen'] }, { id: 'ladegeraet', faults: [] }];
    const KEYS = ['g1', 'g2', 'g3', 'g4', 'g5'];
    const dev = i => ({ id: STAPEL[i].id, faults: STAPEL[i].faults.slice(), seed: 1 });
    const dv = i => devVals(dev(i));
    const OPT = [{ value: 'bestanden', label: 'bestanden' }, { value: 'nicht bestanden', label: 'nicht bestanden' }];
    const verd = i => dv(i).vd.gesamt;
    const why = (i, w) => {
      const d = dv(i), c = C(), roten = d.vd.steps.filter(s => s.status === 'rot');
      if (w === 'bestanden') return 'Du hast „bestanden“ gewählt. ' + roten.map(s => s.name + ': ' + (s.id === 'sicht' ? 'Mangel ' + s.mangel.map(x => c.device.faultName[x]).join('; ') : f(s.wert, 3) + ' ' + s.einheit + ', Grenzwert ' + s.grenzText)).join('. ') + ': nicht eingehalten. Ein einziger roter Schritt genügt für „nicht bestanden“.';
      return 'Du hast „nicht bestanden“ gewählt, aber alle Schritte sind eingehalten (' + d.vd.steps.map(s => s.name + ' ' + (s.id === 'sicht' ? 'keine Mängel' : f(s.wert, 3) + ' ' + s.einheit)).join(', ') + '). Ein Gerät ohne Mangel wird nicht ausgesondert.';
    };
    const vals = () => once('v27', () => { const o = { n: KEYS.length }; KEYS.forEach((k, i) => { const m = dv(i).m; o[k + 'rpe'] = m.rpe === null ? 0 : m.rpe; o[k + 'riso'] = m.riso; o[k + 'ipe'] = m.ipe !== null ? m.ipe : m.ber; }); o.nBest = KEYS.filter((k, i) => verd(i) === 'bestanden').length; return o; });
    const check = mkCheck((a, r) => {
      KEYS.forEach((k, i) => { const d = dv(i), ok = verd(i); choiceRow(r, a, k, ok, 'Gerät ' + (i + 1) + ' (' + d.cat.name + '): ' + ok, w => why(i, String(w))); });
    });
    return { vals, check,
      text: () => 'Fünf Geräte liegen am Prüfplatz, alle Prüfschritte der jeweiligen Schutzklasse sind gemessen (Übungswerte, Tabelle). Urteile für jedes Gerät: bestanden oder nicht bestanden. Grenzwerte: Schutzleiterwiderstand ' + lt('rpe_5m') + ', Isolationswiderstand Schutzklasse I ' + lt('riso_sk1') + ', Schutzklasse II ' + lt('riso_sk2') + ', Berührungsstrom Schutzklasse II ' + lt('ber_sk2') + '. Beim Schutzleiterstrom Schutzklasse I gilt ein Übungswert (' + lt('ipe_sk1') + '). Sichtprüfung: Ein Mangel genügt für „nicht bestanden“.',
      table: () => { const c = C(); return [{ caption: 'Messwerte der fünf Prüflinge', head: ['Nr.', 'Gerät', 'Schutzklasse', 'Sichtprüfung', 'R_PE in Ω', 'R_iso in MΩ', 'I_PE bzw. I_Berühr in mA'], rows: KEYS.map((k, i) => { const d = dv(i), m = d.m; return [String(i + 1), d.cat.name, d.cat.sk, arr(m.sicht).length ? arr(m.sicht).map(x => c.device.faultName[x]).join('; ') : 'keine Mängel', m.rpe === null ? '–' : f(m.rpe, 3), f(m.riso, 1), f(m.ipe !== null ? m.ipe : m.ber, 3)]; }) }]; },
      choices: () => KEYS.map((k, i) => ({ key: k, q: 'Gerät ' + (i + 1) + ' (' + dv(i).cat.name + '): Urteil?', options: OPT })),
      hint: () => { const v = vals(); return [
        'Gehe Gerät für Gerät durch: Zuerst die Sichtprüfung, dann jeden Messwert gegen den Grenzwert seiner Schutzklasse. Ein einziger Schritt außerhalb des Grenzwerts oder ein Mangel genügt für „nicht bestanden“.',
        'Von fünf Geräten bestehen ' + f(v.nBest, 0) + '. Schutzklasse II hat keinen Schutzleiterwiderstand. Der Schutzleiterwiderstand bei Gerät 3 beträgt ' + f(v.g3rpe, 3) + ' Ω, der Isolationswiderstand bei Gerät 2 beträgt ' + f(v.g2riso, 3) + ' MΩ.',
        'Musterlösung: ' + KEYS.map((k, i) => 'Gerät ' + (i + 1) + ' ' + verd(i)).join(', ') + '.'
      ]; },
      start: () => A('pruefplatz', PFIX({ geraet: STAPEL[0].id }), { choices: {} }),
      sol: () => { const ch = {}; KEYS.forEach((k, i) => { ch[k] = verd(i); }); return A('pruefplatz', PFIX({ geraet: STAPEL[0].id }), { choices: ch }); },
      wrong: () => { const a1 = {}, a2 = {}; KEYS.forEach(k => { a1[k] = 'bestanden'; a2[k] = 'nicht bestanden'; }); return [{ name: 'Mangel übersehen, alle bestanden', answer: A('pruefplatz', PFIX({ geraet: STAPEL[0].id }), { choices: a1 }) }, { name: 'Gutes ausgesondert, alle nicht bestanden', answer: A('pruefplatz', PFIX({ geraet: STAPEL[0].id }), { choices: a2 }) }]; } };
  })();

  /* ====================================================================== el28 und el29: Reihenfolgen am Pruefstand "regeln" */
  function folgeOf(a) {
    const names = arr(a.seq).filter(e => e && typeof e.do === 'string').map(e => e.do);
    if (names.length) return names;
    const st = obj(a.state);
    return Array.isArray(st.folge) ? st.folge.map(String) : [];
  }
  const M28 = (() => {
    const FIX = { modus: 'regeln', szene: 'schaltschrank', reihenfolgeFrei: true };
    const five = () => C().rules.five.slice();
    const vals = () => once('v28', () => ({ n: five().length }));
    const nm = id => C().rules.info(id).name;
    const check = mkCheck((a, r) => {
      const c = C(), seq = folgeOf(a), chk = c.rules.check(seq, FIX.szene);
      r(seq.length > 0 && (chk.vollstaendig === true || chk.art === 'ok' || (chk.art === 'reihenfolge' && seq.length >= five().length && five().every(x => seq.indexOf(x) >= 0))), 'Alle fünf Sicherheitsregeln sind bestätigt', seq.length ? (chk.art === 'fehlt' ? chk.text : 'Es sind nicht alle fünf Regeln in deiner Folge: ' + chk.text) : 'Du hast noch keine Regel bestätigt. Wähle am Prüfstand „Sicherheitsregeln und Erste Hilfe“ eine Regel und bestätige sie.');
      r(chk.ok === true, 'Die Reihenfolge der fünf Sicherheitsregeln stimmt exakt', chk.text);
    });
    return { vals, check,
      text: () => 'Bestätige am Prüfstand „Sicherheitsregeln und Erste Hilfe“ (Szene Schaltschrank, Reihenfolge frei) die fünf Sicherheitsregeln in der richtigen Reihenfolge, bevor an einer Anlage gearbeitet wird (angelehnt an eine Frage der IHK-Prüfung). Spannungsprüfer und Erdungsseil sind nur Symbole. Dieses Lab ersetzt keine Unterweisung.',
      hint: () => [
        'Die fünf Sicherheitsregeln haben eine feste Reihenfolge. Zuerst wird die Anlage vom Netz getrennt; erst wenn ihre Spannungsfreiheit festgestellt ist, wird geerdet.',
        'Die Reihenfolge lautet: ' + five().map((id, i) => (i + 1) + '. ' + nm(id)).join(', ') + '.',
        'Musterlösung: ' + five().map(nm).join(', dann ') + '.'
      ],
      start: () => A('regeln', Object.assign({}, FIX), { seq: [] }),
      sol: () => A('regeln', Object.assign({}, FIX), { fired: true, seq: five().map((id, i) => ({ t: i, do: id })) }),
      wrong: () => { const s = five(); const t1 = s.slice(); t1[0] = s[1]; t1[1] = s[0]; const t2 = s.slice(); t2[2] = s[3]; t2[3] = s[2]; return [{ name: 'zwei Schritte vertauscht (Sichern vor Freischalten)', answer: A('regeln', Object.assign({}, FIX), { fired: true, seq: t1.map((id, i) => ({ t: i, do: id })) }) }, { name: 'Erden vor dem Feststellen der Spannungsfreiheit', answer: A('regeln', Object.assign({}, FIX), { fired: true, seq: t2.map((id, i) => ({ t: i, do: id })) }) }]; } };
  })();

  const M29 = (() => {
    const FIX = { modus: 'rettung', szene: 'schaltschrank', reihenfolgeFrei: true };
    const chain = () => C().aid.chain.slice();
    const nm = id => C().aid.info(id).name;
    const vals = () => once('v29', () => ({ n: chain().length }));
    const check = mkCheck((a, r) => {
      const c = C(), seq = folgeOf(a), chk = c.aid.check(seq);
      r(seq.length > 0 && seq[0] === 'eigenschutz', 'Der Eigenschutz steht an erster Stelle', 'Zuerst kommt der Eigenschutz: ' + c.aid.info('eigenschutz').grund + ' Du hast ' + (seq.length ? '„' + (c.aid.info(seq[0]).name || seq[0]) + '“' : 'noch keinen Schritt') + ' an die erste Stelle gesetzt.');
      r(seq.length > 0 && (chk.vollstaendig === true || chk.art === 'ok' || (chk.art === 'reihenfolge' && chain().every(x => seq.indexOf(x) >= 0))), 'Alle fünf Schritte der Rettungskette sind bestätigt', seq.length ? 'Es sind nicht alle Schritte in deiner Folge: ' + chk.text : 'Du hast noch keinen Schritt bestätigt. Wähle am Prüfstand die Rettungskette und bestätige die Schritte.');
      r(chk.ok === true, 'Die Reihenfolge der Rettungskette stimmt exakt', chk.text);
    });
    return { vals, check, consts: [112],
      text: () => 'In der Werkstatt ist ein Kollege mit einem Stromunfall gestürzt. Bestätige am Prüfstand „Sicherheitsregeln und Erste Hilfe“ (Modus Rettungskette, Reihenfolge frei) die Schritte der Rettungskette in der richtigen Reihenfolge. Es geht um Reihenfolge und Begriffe; der Notruf ist 112. Die Folge ist das Lehrmodell des Labs (F12, F32). Dieses Lab ersetzt keinen Erste-Hilfe-Kurs.',
      hint: () => [
        'Wer selbst verunglückt, kann nicht helfen: Der Eigenschutz kommt zuerst. Erst danach schaltest du ab oder trennst den Verunfallten sicher vom Stromkreis. Danach holst du Hilfe und prüfst den Verunfallten.',
        'Die Reihenfolge lautet: ' + chain().map((id, i) => (i + 1) + '. ' + nm(id)).join(', ') + '.',
        'Musterlösung: ' + chain().map(nm).join(', dann ') + '.'
      ],
      start: () => A('regeln', Object.assign({}, FIX), { seq: [] }),
      sol: () => A('regeln', Object.assign({}, FIX), { fired: true, seq: chain().map((id, i) => ({ t: i, do: id })) }),
      wrong: () => { const s = chain(); const t1 = s.slice(); t1[0] = s[2]; t1[2] = s[0]; const t2 = s.slice(); t2[2] = s[3]; t2[3] = s[2]; return [{ name: 'Notruf zuerst statt Eigenschutz', answer: A('regeln', Object.assign({}, FIX), { fired: true, seq: t1.map((id, i) => ({ t: i, do: id })) }) }, { name: 'Prüfen vor dem Notruf', answer: A('regeln', Object.assign({}, FIX), { fired: true, seq: t2.map((id, i) => ({ t: i, do: id })) }) }]; } };
  })();

  /* ====================================================================== el30: Welche Regel fehlt? */
  const M30 = (() => {
    const RSEQ = ['freischalten', 'sichern', 'spannungsfrei', 'abdecken'], ASEQ = ['eigenschutz', 'abschalten', 'pruefen', 'massnahmen'];
    const missing = (all, seq) => all.filter(x => seq.indexOf(x) < 0)[0];
    const rm = () => missing(C().rules.five, RSEQ), am = () => missing(C().aid.chain, ASEQ);
    const rn = id => C().rules.info(id).name, an = id => C().aid.info(id).name;
    const vals = () => once('v30', () => ({ nR: RSEQ.length, nA: ASEQ.length }));
    const check = mkCheck((a, r) => {
      const c = C();
      choiceRow(r, a, 'regel', rm(), 'Bei den Sicherheitsregeln fehlt „' + rn(rm()) + '“', w => {
        const nmW = c.rules.info(String(w)).name || String(w);
        return 'Du hast „' + nmW + '“ genannt, die in der Folge schon steht. ' + c.rules.check(RSEQ, 'schaltschrank').text;
      });
      choiceRow(r, a, 'rettung', am(), 'In der Rettungskette fehlt „' + an(am()) + '“', w => {
        const nmW = c.aid.info(String(w)).name || String(w);
        return 'Du hast „' + nmW + '“ genannt, der in der Folge schon steht. ' + c.aid.check(ASEQ).text;
      });
    });
    return { vals, check, consts: [112],
      text: () => 'Zwei Folgen sind unvollständig. Folge 1 (Sicherheitsregeln): ' + RSEQ.map(rn).join(' – ') + '. Folge 2 (Rettungskette): ' + ASEQ.map(an).join(' – ') + '. Welcher Schritt fehlt jeweils? Probiere die Folgen am Prüfstand „Sicherheitsregeln und Erste Hilfe“ aus; dieses Lab ersetzt keine Unterweisung.',
      choices: () => [{ key: 'regel', q: 'Folge 1: Welche der fünf Sicherheitsregeln fehlt?', options: C().rules.five.map(id => ({ value: id, label: rn(id) })) }, { key: 'rettung', q: 'Folge 2: Welcher Schritt der Rettungskette fehlt?', options: C().aid.chain.map(id => ({ value: id, label: an(id) })) }],
      hint: () => { const v = vals(); return [
        'Vergleiche die Folge Schritt für Schritt mit der vollständigen Reihenfolge. Frage dich bei jedem Schritt: Was kommt danach, und fehlt es hier?',
        'Folge 1 hat ' + f(v.nR, 0) + ' von 5 Regeln, Folge 2 hat ' + f(v.nA, 0) + ' von 5 Schritten. In Folge 1 fehlt etwas nach dem Feststellen der Spannungsfreiheit, in Folge 2 etwas zwischen Abschalten und Prüfen.',
        'Musterlösung: Folge 1: „' + rn(rm()) + '“. Folge 2: „' + an(am()) + '“.'
      ]; },
      start: () => A('regeln', { modus: 'regeln', szene: 'schaltschrank', reihenfolgeFrei: true }, { choices: {} }),
      sol: () => A('regeln', { modus: 'regeln', szene: 'schaltschrank', reihenfolgeFrei: true }, { choices: { regel: rm(), rettung: am() } }),
      wrong: () => [{ name: 'falsche Regel genannt', answer: A('regeln', {}, { choices: { regel: 'freischalten', rettung: 'eigenschutz' } }) }, { name: 'benachbarte Schritte genannt', answer: A('regeln', {}, { choices: { regel: 'abdecken', rettung: 'abschalten' } }) }] };
  })();

  /* ====================================================================== el31: Teil-A-Rechnung "Abschaltung" */
  const M31 = (() => {
    const FACT = /\(Typ [BCD]:[^()]*\([^()]*\)[^()]*\)/;
    const seeds = () => once('s31', () => {
      const c = C(); let sM = 1, gm = null;
      for (let s = 1; s <= 400; s++) { const e = c.exercise('maxL', s); if (e.ok && e.given.dev !== 'LS-B' && e.answer.value >= 20 && e.answer.value <= 200) { gm = e; sM = s; break; } }
      if (!gm) gm = c.exercise('maxL', 1);
      let sA = 1, sZ = 1, fa = false, fz = false;
      for (let s = 1; s <= 3000 && !(fa && fz); s++) {
        if (!fa) { const a = c.exercise('ia', s); if (a.given.dev === gm.given.dev && a.given.In === gm.given.In) { sA = s; fa = true; } }
        if (!fz) { const z = c.exercise('zsMax', s); if (z.given.dev === gm.given.dev && z.given.In === gm.given.In) { sZ = s; fz = true; } }
      }
      return { sM, sA, sZ };
    });
    const exA = () => C().exercise('ia', seeds().sA), exZ = () => C().exercise('zsMax', seeds().sZ), exL = () => C().exercise('maxL', seeds().sM);
    const g = () => exL().given;
    const FIXN = () => { const o = g(); return { form: 'TN-S', dev: o.dev, In: o.In, q: o.q, qpe: o.q, zv: o.zv, l: 20, kreis: 'end', fehler: 'ohne', rcd: 0 }; };
    const vals = () => once('v31', () => { const o = g(), c = C(), ml = c.grid.maxLength({ form: 'TN-S', dev: o.dev, In: o.In, q: o.q, zv: o.zv }); return { In: o.In, q: o.q, zv: o.zv, faktor: o.faktor, ia: exA().answer.value, zsMax: exZ().answer.value, lMax: exL().answer.value, frei: ml.frei, u0: c.const.U0 }; });
    const faktorText = () => { const m = exA().question.match(FACT); return m ? m[0] : ''; };
    const check = mkCheck((a, r) => {
      const fl = obj(a.fields);
      exRow(r, exA(), fl.ia, 'Der Auslösestrom Ia ist richtig (' + f(vals().ia, 0) + ' A)');
      exRow(r, exZ(), fl.zsmax, 'Die größte Schleifenimpedanz Zs_max ist richtig (' + f(vals().zsMax, 3) + ' Ω)');
      exRow(r, exL(), fl.lmax, 'Die größte Leitungslänge ist richtig (' + f(vals().lMax, 1) + ' m)');
    });
    return { vals, check,
      text: () => { const v = vals(), o = g(); return 'Teil-A-Rechnung im Prüfungsstil: In einem TN-S-System (U0 = ' + f(v.u0, 0) + ' V, Netzimpedanz Zv = ' + f(o.zv, 1) + ' Ω) schützt ein Leitungsschutzschalter ' + o.dev + ' mit In = ' + f(o.In, 0) + ' A eine Leitung mit ' + f(o.q, 1) + ' mm² für Außenleiter und Schutzleiter (Kupfer, ρ = ' + f(C().const.rho, 4) + ' Ω·mm²/m; ' + f(C().const.rhoAlt, 4) + ' ist ebenfalls zulässig) ' + faktorText() + '. Rechne ohne Spannungsfaktor (vereinfachte Rechnung wie in der Prüfung). (a) Berechne den Auslösestrom Ia. (b) Wie groß darf die Schleifenimpedanz Zs höchstens sein? (c) Wie lang darf die Leitung höchstens sein?'; },
      fields: () => [{ key: 'ia', label: 'Auslösestrom Ia', unit: 'A' }, { key: 'zsmax', label: 'Größte Schleifenimpedanz Zs_max', unit: 'Ω' }, { key: 'lmax', label: 'Größte Leitungslänge', unit: 'm' }],
      hint: () => { const v = vals(); return [
        'Rechne in drei Schritten: Der Auslösestrom folgt aus dem Typ und dem Nennstrom, die größte Schleifenimpedanz aus U0 geteilt durch Ia, die Leitungslänge aus dem Rest von Zs_max nach Abzug der Netzimpedanz Zv. Die Schleife besteht aus Außenleiter und Schutzleiter (doppelte Länge).',
        'Ia = ' + f(v.faktor, 0) + ' · ' + f(v.In, 0) + ' A = ' + f(v.ia, 0) + ' A. Zs_max = ' + f(v.u0, 0) + ' V / ' + f(v.ia, 0) + ' A = ' + f(v.zsMax, 3) + ' Ω. Für die Leitung bleiben ' + f(v.frei, 3) + ' Ω nach Abzug von Zv = ' + f(v.zv, 1) + ' Ω.',
        'Musterlösung: Ia = ' + f(v.ia, 0) + ' A, Zs_max = ' + f(v.zsMax, 3) + ' Ω, l_max = ' + f(v.lMax, 1) + ' m.'
      ]; },
      start: () => A('netz', FIXN(), { fields: { ia: null, zsmax: null, lmax: null } }),
      sol: () => { const v = vals(); return A('netz', FIXN(), { fields: { ia: v.ia, zsmax: v.zsMax, lmax: v.lMax } }); },
      wrong: () => { const v = vals(); return [
        { name: 'Teilschritte vergessen (In, Ia, Zv)', answer: A('netz', FIXN(), { fields: { ia: v.faktor, zsmax: v.u0 / v.In, lmax: v.zsMax / (2 * C().const.rho / v.q) } }) },
        { name: 'Vorsatz daneben, Faktor 10', answer: A('netz', FIXN(), { fields: { ia: v.ia * 10, zsmax: v.zsMax * 10, lmax: v.lMax * 10 } }) }]; } };
  })();

  /* ====================================================================== el32: Meisterstueck, der Pruefdienst */
  const M32 = (() => {
    const FIX = PFIX({ geraet: 'heizluefter', zufall: true, seed: 2, anzahl: 2 });
    const NET = { form: 'TN-S', dev: 'LS-B', In: 16, q: 1.5, qpe: 1.5, zv: 0.4, l: 120, kreis: 'end' };
    const cond = o => C().grid.condition(Object.assign({}, NET, o || {}));
    const OPTS = [{ value: 'quer', label: 'Querschnitt von 1,5 mm² auf 2,5 mm² vergrößern', over: { q: 2.5, qpe: 2.5 } }, { value: 'in', label: 'Nennstrom des LS B von 16 A auf 20 A erhöhen', over: { In: 20 } }, { value: 'typd', label: 'LS Typ D mit 16 A statt Typ B einbauen', over: { dev: 'LS-D' } }];
    const wirkt = () => OPTS.filter(o => cond(o.over).erfuellt === true);
    const vals = () => once('v32', () => { const exp = expectDev(FIX), c = C(), b = cond(), ml = c.grid.maxLength(NET), d = devVals(exp); return { rpe: d.m.rpe, riso: d.m.riso, ipe: d.m.ipe, zs: b.zs, zsMax: b.zsMax, lMax: ml.lMax, l: NET.l, zv: NET.zv, q: NET.q, In: NET.In, nMangel: exp.faults.length, tAb: b.tAb, muster: musterText(FIX), erfuellt: b.erfuellt }; });
    const YN = [{ value: 'ja', label: 'ja, die Abschaltbedingung ist erfüllt' }, { value: 'nein', label: 'nein, die Abschaltbedingung ist nicht erfüllt' }];
    const extra = (a, r) => {
      const v = vals(), c = C(), b = cond(), fl = obj(a.fields), rho = c.const.rho, rhoA = c.const.rhoAlt;
      choiceRow(r, a, 'bed', b.erfuellt ? 'ja' : 'nein', 'Netz-Ausschnitt: Die Abschaltbedingung ist ' + (b.erfuellt ? 'erfüllt' : 'nicht erfüllt') + ' (Zs = ' + f(v.zs, 3) + ' Ω, Zs_max = ' + f(v.zsMax, 3) + ' Ω)', w => 'Du hast „' + w + '“ gewählt. ' + b.text);
      numRow(r, 'Die größte Leitungslänge ist richtig (' + f(v.lMax, 1) + ' m)', fl.lmax, { targets: [v.lMax, c.grid.maxLength(Object.assign({}, NET, { rho: rhoA })).lMax], tol: 0.03, unit: 'm',
        errs: [{ v: v.zsMax / (2 * rho / v.q), text: 'Die Netzimpedanz Zv = ' + f(v.zv, 1) + ' Ω fehlt in deiner Rechnung: Zv geht zuerst von Zs_max = ' + f(v.zsMax, 3) + ' Ω ab.' }, { v: 2 * v.lMax, text: 'Du hast nur einen Leiter gerechnet: Außenleiter und Schutzleiter liegen beide in der Schleife (doppelte Länge).' }], hint: 'l_max = (Zs_max − Zv) / (ρ · 2 / q).' });
      const richtig = wirkt()[0];
      choiceRow(r, a, 'massnahme', richtig ? richtig.value : '', 'Maßnahme: ' + (richtig ? richtig.label : '–'), w => {
        const o = OPTS.find(x => x.value === String(w)); if (!o) return 'Die Auswahl ist keine Maßnahme.';
        const c2 = cond(o.over);
        return 'Du hast „' + o.label + '“ gewählt: ' + c2.text + (c2.zsMax < v.zsMax ? ' Der größere Auslösestrom verkleinert Zs_max (vorher ' + f(v.zsMax, 3) + ' Ω), die Bedingung bleibt verletzt.' : '');
      });
    };
    return { vals, check: pruefCheck(FIX, extra), consts: [2.5, 1.5, 16, 20],
      text: () => { const v = vals(); return 'Meisterstück Prüfdienst. Teil 1: Ein Heizlüfter (Schutzklasse I) hat ' + f(v.nMangel, 0) + ' Mängel, die der Prüfstand nicht anzeigt (Mängel vom Zufall mit festem Seed). Prüfe ihn am Prüfplatz vollständig in der richtigen Reihenfolge und führe das Prüfprotokoll fehlerfrei (Mängel, Messwerte, Ergebnis, Maßnahme; Übungsprotokoll, kein Prüfnachweis). Teil 2: Im Netz-Ausschnitt (TN-S, U0 = 230 V, Zv = ' + f(v.zv, 1) + ' Ω) schützt ein LS B mit ' + f(v.In, 0) + ' A eine ' + f(v.l, 0) + ' m lange Leitung mit ' + f(v.q, 1) + ' mm² für Außenleiter und Schutzleiter. Ist die Abschaltbedingung erfüllt? Wie lang darf die Leitung höchstens sein? Welche Maßnahme behebt den Fehler? (Übungsanlage, nur Simulation, Norm maßgeblich.)'; },
      fields: () => [{ key: 'lmax', label: 'Größte Leitungslänge im Netz-Ausschnitt', unit: 'm' }],
      choices: () => [{ key: 'bed', q: 'Ist die Abschaltbedingung Zs ≤ U0 / Ia im Netz-Ausschnitt erfüllt?', options: YN }, { key: 'massnahme', q: 'Welche Maßnahme behebt den Fehler im Netz-Ausschnitt?', options: OPTS.map(o => ({ value: o.value, label: o.label })) }],
      hint: () => { const v = vals(); return [
        'Arbeite zwei Teile getrennt ab. Teil 1: komplette Prüfung mit allen Schritten, auch der Sichtprüfung, und ein Protokoll, das zu den Messwerten und Mängeln passt. Teil 2: Vergleiche Zs mit Zs_max und rechne die größte Länge aus dem Rest nach Abzug von Zv.',
        'Teil 2: Zs = ' + f(v.zs, 3) + ' Ω gegen Zs_max = ' + f(v.zsMax, 3) + ' Ω; die Leitung darf höchstens ' + f(v.lMax, 1) + ' m lang sein. Ein größerer Nennstrom vergrößert Ia und verkleinert Zs_max; ein größerer Querschnitt verkleinert Zs.',
        'Musterlösung: ' + v.muster + ' Netz-Ausschnitt: nicht erfüllt, l_max = ' + f(v.lMax, 1) + ' m, Querschnitt vergrößern.'
      ]; },
      start: () => A('pruefplatz', Object.assign({}, FIX), { protokoll: null, fired: false, fields: { lmax: null }, choices: {} }),
      sol: () => { const exp = expectDev(FIX), cat = catOf(exp.id), v = vals(), w = wirkt()[0]; return A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq(cat.sk), protokoll: musterEntry(FIX), fields: { lmax: v.lMax }, choices: { bed: 'nein', massnahme: w ? w.value : 'quer' } }); },
      wrong: () => { const exp = expectDev(FIX), cat = catOf(exp.id), v = vals(); return [
        { name: 'nur ein Mangel, Sicht übersprungen', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq(cat.sk).filter(e => e.do !== 'sicht'), protokoll: musterEntry(FIX, { sicht: [] }), fields: { lmax: v.lMax }, choices: { bed: 'nein', massnahme: 'quer' } }) },
        { name: 'Fehlurteil und Nennstrom erhöht', answer: A('pruefplatz', Object.assign({}, FIX), { fired: true, seq: musterSeq(cat.sk), protokoll: musterEntry(FIX, { ergebnis: 'bestanden', massnahme: 'weiterverwenden' }), fields: { lmax: v.zsMax / (2 * C().const.rho / v.q) }, choices: { bed: 'ja', massnahme: 'in' } }) }]; } };
  })();

  /* ====================================================================== Registrierung */
  function def(head, M) {
    const o = Object.assign({}, head);
    const lazy = (k, fn) => { Object.defineProperty(o, k, { enumerable: true, configurable: true, get() { const v = fn(); Object.defineProperty(o, k, { value: v, enumerable: true, configurable: true }); return v; } }); };
    lazy('text', () => M.text());
    lazy('hint', () => M.hint());
    if (M.table) lazy('table', () => M.table());
    if (M.fields) lazy('fields', () => M.fields());
    if (M.choices) lazy('choices', () => M.choices());
    if (M.consts) o.consts = M.consts;
    o.hintVals = () => M.vals(); o.start = () => M.start(); o.sol = () => M.sol(); o.wrong = () => M.wrong(); o.check = M.check;
    return o;
  }
  T.register([
    def({ id: 'el17', lab: 'els', cat: 'RCD', title: 'Gleichfehlerstrom: der richtige Typ', level: 2, rig: 'rcd' }, M17),
    def({ id: 'el18', lab: 'els', cat: 'Schutzklassen', title: 'Symbol zur Schutzklasse', level: 1, rig: 'klassen' }, M18),
    def({ id: 'el19', lab: 'els', cat: 'Schutzklassen', title: 'IP-Code lesen', level: 2, rig: 'klassen' }, M19),
    def({ id: 'el20', lab: 'els', cat: 'Schutzklassen', title: 'Isolationsfehler: was geschieht?', level: 2, rig: 'klassen' }, M20),
    def({ id: 'el21', lab: 'els', cat: 'Isolation und Schutzleiter', title: 'Isolationswiderstand bewerten', level: 2, rig: 'isolation' }, M21),
    def({ id: 'el22', lab: 'els', cat: 'Isolation und Schutzleiter', title: 'Ableitstrom aus dem Y-Kondensator', level: 2, rig: 'isolation' }, M22),
    def({ id: 'el23', lab: 'els', cat: 'Isolation und Schutzleiter', title: 'Schutzleiterwiderstand richtig messen', level: 3, rig: 'isolation' }, M23),
    def({ id: 'el24', lab: 'els', cat: 'Geräteprüfung', title: 'Wasserkocher prüfen und protokollieren', level: 2, rig: 'pruefplatz' }, M24),
    def({ id: 'el25', lab: 'els', cat: 'Geräteprüfung', title: 'Verlängerung: den Mangel finden', level: 3, rig: 'pruefplatz' }, M25),
    def({ id: 'el26', lab: 'els', cat: 'Geräteprüfung', title: 'Netzteil Schutzklasse II: Berührungsstrom', level: 3, rig: 'pruefplatz' }, M26),
    def({ id: 'el27', lab: 'els', cat: 'Geräteprüfung', title: 'Fünf Geräte nacheinander', level: 3, rig: 'pruefplatz' }, M27),
    def({ id: 'el28', lab: 'els', cat: 'Sicherheitsregeln', title: 'Fünf Sicherheitsregeln', level: 1, rig: 'regeln' }, M28),
    def({ id: 'el29', lab: 'els', cat: 'Sicherheitsregeln', title: 'Rettungskette', level: 2, rig: 'regeln' }, M29),
    def({ id: 'el30', lab: 'els', cat: 'Sicherheitsregeln', title: 'Welche Regel fehlt?', level: 2, rig: 'regeln' }, M30),
    def({ id: 'el31', lab: 'els', cat: 'Prüfungsnah', title: 'Teil-A-Rechnung Abschaltung', level: 3, rig: 'netz' }, M31),
    def({ id: 'el32', lab: 'els', cat: 'Prüfungsnah', title: 'Meisterstück: Der Prüfdienst', level: 3, rig: 'pruefplatz' }, M32)
  ]);
  /* Musterwerte der Aufgaben el17-el32 (aus dem Kern, Stand 2026-10-22) fuer Tests und Ausbilder */
  T.thresholds2 = () => ({ el17: M17.vals(), el18: M18.vals(), el19: M19.vals(), el20: M20.vals(), el21: M21.vals(), el22: M22.vals(), el23: M23.vals(), el24: M24.vals(), el25: M25.vals(), el26: M26.vals(), el27: M27.vals(), el28: M28.vals(), el29: M29.vals(), el30: M30.vals(), el31: M31.vals(), el32: M32.vals() });
  if (typeof module !== 'undefined') module.exports = { tasks: T.tasks };
})(typeof window !== 'undefined' ? window : globalThis);
