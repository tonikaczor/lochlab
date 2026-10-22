/* thmtasks2.js - Thermik-Lab: Aufgaben th16 bis th30 mit automatischer Pruefung (Rechnung und Simulation, ohne Browser lauffaehig)
 * Registrierung: THM_TASKS.register([ ... ]) (THM_TASKS kommt aus thmdata.js; fehlt es, legt diese Datei ein gleichwertiges Geruest an).
 * Format je Aufgabe: { id, lab:'thm', cat, title, level, rig, text, table?, hint[3], start(), sol(), check(answer), hintVals(), ask? | fields? , choices? }
 *   start() und sol() liefern { rig, controls, settle?, fields?, choices?, value? } (Steuerwerte des Pruefstands, Beharrungszustand, Selbsttest-Antworten).
 *   answer = { rig, controls, seq, rows, dur, state, simTime, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, kennwerte }.
 *   check(answer) liefert eine Liste [{ ok, text, why }]; Prozent der Treffer = Ergebnis (Start < 100, Musterloesung = 100).
 * Regeln (SPEC Abschnitt 7 und 9):
 *   - Alle Zahlen in text, table, hint und Pruefmeldungen stammen aus THM_CORE (Formeln, Tabellen, Simulation) und stehen in hintVals() (Regel 1);
 *     text, table und hint werden erst beim ersten Zugriff gerechnet.
 *   - Pruefmeldungen (why) behaupten nur, was verglichen wurde. Typische Fehler werden erst genannt, wenn der Wert des Lernenden mit dem
 *     gerechneten Fehlerwert uebereinstimmt (Regel 2 und 3). Texte enthalten Symbole nur als {sym:key}-Platzhalter (Regel 5, die Oberflaeche setzt sie ein).
 *   - Schwellwerte stammen aus der gerechneten Musterloesung (th30: Aufwand, Reserve 25 %, Stand 2026-10-20); die Toleranzen der Rechenaufgaben stehen je Aufgabe
 *     in der Aufgabenliste (Abweichungen von der SPEC in quelle/thmlab/ABWEICHUNGEN.md, WP4b).
 *   - Geprueft werden nur die freigegebenen Steuerwerte der Aufgabe (WL); alles andere setzt die Pruefung selbst (FIX), damit gleiche Eingaben gleiche Ergebnisse liefern.
 * Benoetigt: thmcore.js und die Pruefstaende thmrig-linear.js, thmrig-transistor.js, thmrig-mosfet.js, thmrig-bauteil.js (in Node holt sich die Datei fehlende Teile per require). */
(function (root) {
  'use strict';
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  function nodeReq(f) { try { return typeof require === 'function' ? require(f) : null; } catch (e) { return null; } }
  const CORE = () => root.THM_CORE || nodeReq('./thmcore.js') || root.THM_CORE || null;
  const RIGFILES = ['./thmrig-linear.js', './thmrig-transistor.js', './thmrig-mosfet.js', './thmrig-bauteil.js'];
  const RIGS = id => { let R = root.THM_RIGS; if (!(R && R.defs && (!id || R.defs[id]))) { RIGFILES.forEach(nodeReq); R = root.THM_RIGS; } return R || null; };
  const fm = (x, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return C.fmt(x, d); return fin(x) ? (+x).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const toNum = v => {
    if (typeof v === 'number') return fin(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && C.parseNum ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const memo = {};
  const once = (k, f) => (k in memo ? memo[k] : (memo[k] = f()));

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
  const FIRST = ['device', 'mode', 'count', 'driver'];
  const simCache = new Map();
  /* Pruefstand frisch erzeugen, Steuerwerte in fester Reihenfolge setzen, Beharrungszustand (settle) und stationaere Erwartung (steady) lesen */
  function build(rigId, ctl) {
    const key = rigId + '|' + JSON.stringify(Object.keys(ctl).sort().map(k => [k, ctl[k]]));
    if (simCache.has(key)) return simCache.get(key);
    const out = { ok: false, rejected: [], errors: [] };
    try {
      const R = RIGS(rigId); const rig = R.create(rigId, { seed: 1, noDraw: true });
      Object.keys(ctl).sort((a, b) => (FIRST.includes(b) ? 1 : 0) - (FIRST.includes(a) ? 1 : 0)).forEach(k => {
        let ok; try { ok = rig.setControl(k, ctl[k]); } catch (e) { ok = false; }
        if (ok === false) out.rejected.push(k);
      });
      rig.settle();
      const ch = rig.chain() || {};
      out.st = clone(rig.state()); out.steady = clone(rig.steady());
      out.chain = { rthJC: ch.rthJC, rthCK: ch.rthCK, rthK: ch.rthK, rthTotal: ch.rthTotal, faults: ch.faults || [] };
      out.ok = true;
    } catch (e) { out.errors.push('Der Prüfstand konnte nicht erzeugt werden: ' + (e && e.message || e)); }
    if (simCache.size > 600) simCache.clear();
    simCache.set(key, out);
    return out;
  }
  /* erste Zeile jeder Simulationsaufgabe: richtiger Pruefstand, gueltige Eingaben, Lauf ohne Fehlermeldung */
  function inputRow(r, problems, sim, a, rigId) {
    const errs = problems.slice();
    if (sim && sim.errors) sim.errors.forEach(e => errs.push(String(e)));
    if (sim && sim.rejected && sim.rejected.length) errs.push('Der Prüfstand lehnt Werte ab: ' + sim.rejected.join(', ') + '.');
    if (rigId && isObj(a) && typeof a.rig === 'string' && a.rig !== rigId) {
      const R = RIGS(rigId), d = R && R.defs && R.defs[rigId], d2 = R && R.defs && R.defs[a.rig];
      errs.push('Die Aufgabe gehört zum Prüfstand „' + (d ? d.name : rigId) + '“, im Prüfstand-Tab ist aber „' + (d2 ? d2.name : a.rig) + '“ eingestellt. Wähle den richtigen Prüfstand.');
    }
    r(errs.length === 0, 'Die Eingaben sind gültig und der Prüfstand läuft ohne Fehlermeldung', errs.join(' '));
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
  /* Zahlenzeile: want = Sollwert, o = { tol (relativ), abs (absolut statt relativ), alts:[weitere gueltige Werte], unit, mistakes:[[Fehlerwert, Satzteil nach "bei der"]] };
   * Ein typischer Fehler wird nur genannt, wenn der eingegebene Wert auf 3 % mit dem gerechneten Fehlerwert uebereinstimmt. */
  function numRow(r, label, v, want, o) {
    o = o || {};
    const tol = o.tol != null ? o.tol : 0.02, abs = fin(o.abs) ? o.abs : null, unit = o.unit ? ' ' + o.unit : '';
    const wants = [want].concat(o.alts || []).filter(fin);
    const near = (x, w) => (abs != null ? Math.abs(x - w) <= abs + 1e-9 : relNear(x, w, tol));
    const tolTxt = abs != null ? 'Toleranz ±' + fm(abs) + (o.unit ? ' ' + o.unit : '') : 'Toleranz ' + fm(tol * 100) + ' %';
    if (!fin(v)) { r(false, label + ' (' + tolTxt + ')', 'Trage hier eine Zahl ein (Komma oder Punkt).'); return false; }
    const ok = wants.some(w => near(v, w));
    let why = '';
    if (!ok) {
      const best = wants.reduce((b, w) => (Math.abs(v - w) < Math.abs(v - b) ? w : b), wants[0]);
      why = 'Dein Wert ' + fm(v) + unit + ' ist ' + (v < best ? 'zu klein' : 'zu groß') + '.';
      const hits = (o.mistakes || []).filter(m => fin(m[0]) && m[0] !== 0 && relNear(v, m[0], 0.03)).map(m => m[1]);
      why += hits.length ? ' Dein Wert entspricht einer Rechnung, bei der ' + hits.join(' – oder bei der ') + '.' : ' Rechne mit den Formeln aus dem Tipp noch einmal nach und achte auf die Einheit.';
    }
    r(ok, label + ' (' + tolTxt + ')', why);
    return ok;
  }
  function choiceRow(r, label, got, want, whyWrong) {
    const none = got === undefined || got === null || got === '';
    const ok = !none && String(got) === String(want);
    r(ok, label, ok ? '' : (none ? 'Wähle eine Antwort aus.' : whyWrong(got)));
    return ok;
  }
  /* Rechenaufgabe aus items() des Modells: je Eintrag eine Zahlenzeile; extra(r, a) fuer Auswahlfragen */
  const calcCheck = M => mk((r, a) => {
    M.items().forEach(it => numRow(r, it.label, valOf(a, it.key), it.want, it.altsFor ? Object.assign({}, it, { alts: (it.alts || []).concat(it.altsFor(a)) }) : it));
    if (M.extra) M.extra(r, a);
  });
  const tbl = (caption, head, rows) => ({ caption, head, rows });
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});
  const HSNAME = { fahne: 'Fahnenkühlkörper', s: 'Profil klein', m: 'Profil mittel', l: 'Profil groß', xl: 'Rippenkörper sehr groß' };
  const rthCK = (pkg, joint, paste, screw) => CORE().mount.rthCK(pkg, joint, paste || 'duenn', screw || 'fest');
  const hsRth = id => CORE().heatsinks.byId[id].rthK;
  const kW = x => fm(x) + ' K/W';
  /* kleinster Kuehlkoerper (groesster Rth_K) aus der Liste ids, der rthErf einhaelt; null, wenn keiner reicht */
  function smallestSink(erf, ids) {
    const l = ids.slice().sort((p, q) => hsRth(q) - hsRth(p));
    return l.find(id => hsRth(id) <= erf + 1e-9) || null;
  }
  /* Sperrschichttemperatur zu dem Kuehlkoerper, den der Lernende in der Auswahl gewaehlt hat (Folgefehler der Auswahl wird nicht doppelt bestraft; die Auswahlzeile bleibt rot) */
  function chosenTj(a, powers, ta, n) {
    const id = choiceOf(a, 'kk'), C = CORE(); if (!id || !C.heatsinks.byId[id]) return [];
    const cfg = { device: n ? 'bd139' : '7805', heatsink: id, joint: 'glimmer', paste: 'duenn', count: n || 1 };
    return powers.map(p => (n ? C.parallelDevices(n, cfg, p, ta).tj : C.steady(cfg, p, ta).tj));
  }
  const sinkOptions = ids => ids.map(id => ({ value: id, label: HSNAME[id] + ' (' + kW(hsRth(id)) + ')' }));

  /* ====================================================================== th16: Linearregler gegen Schaltregler */
  const M16 = (() => {
    const UE = 12, UA = 5, IA = 0.5, ETA = 0.9, IQ = 0.005;
    const vals = () => once('v16', () => {
      const C = CORE(), pa = UA * IA, lin = C.power.linear(UE, UA, IA), sw = C.efficiency.switching(pa, ETA);
      return { ue: UE, ua: UA, ia: IA, pa, pLin: lin.p, pLinIq: C.power.linear(UE, UA, IA, IQ).p, etaN: C.efficiency.linear(UE, UA, IA) * 100, etaIq: C.efficiency.linear(UE, UA, IA, IQ) * 100, etaSw: ETA * 100, etaF: ETA, pvSw: sw.p, pIn: sw.pIn, saved: lin.p - sw.p, iqmA: IQ * 1000, tolEta: 1, tolSw: 3 };
    });
    const ctl = on => ({ device: '7805', loadMode: 'strom', ue: UE, iLoad: IA, iq: true, swVergleich: on, etaSw: ETA * 100, ta: 25, heatsink: 'm', joint: 'glimmer', paste: 'duenn' });
    const items = () => { const v = vals(); return [
      { key: 'eta', label: 'Wirkungsgrad des Linearreglers', unit: '%', want: v.etaN, alts: [v.etaIq], tol: 0.01, mistakes: [[v.etaN / 100, 'du den Wirkungsgrad als Faktor statt in Prozent angegeben hast'], [v.ue / v.ua * 100, 'du Ue durch Ua geteilt hast (das Verhältnis steht falsch herum)']] },
      { key: 'pvsw', label: 'Verlustleistung des Schaltreglers', unit: 'W', want: v.pvSw, tol: 0.03, mistakes: [[v.pa * (1 - v.etaF), 'du ' + fm(100 - v.etaSw) + ' % der Ausgangsleistung gerechnet hast (der Wirkungsgrad bezieht sich auf die Eingangsleistung)'], [v.pLin, 'du die Verlustleistung des Linearreglers gerechnet hast'], [v.pIn, 'du die Eingangsleistung des Schaltreglers gerechnet hast, nicht seine Verlustleistung']] }
    ]; };
    const fields = [{ key: 'eta', label: 'Wirkungsgrad des Linearreglers', unit: '%' }, { key: 'pvsw', label: 'Verlustleistung des Schaltreglers {sym:P}', unit: 'W' }];
    return { vals, items, fields, ctl,
      text() { const v = vals(); return 'Ein Gerät braucht ' + fm(v.ua) + ' V bei ' + fm(v.ia) + ' A. Zur Verfügung stehen ' + fm(v.ue) + ' V Eingangsspannung. Du vergleichst zwei Lösungen: Variante A ist der Linearregler 7805, Variante B ein Schaltregler mit dem Wirkungsgrad η = ' + fm(v.etaSw) + ' % (Übungsannahme). Den Ruhestrom des Linearreglers (' + fm(v.iqmA) + ' mA) darfst du vernachlässigen; rechnest du ihn mit, gilt auch dieser Wert.\nBerechne den Wirkungsgrad des Linearreglers in Prozent und die Verlustleistung des Schaltreglers. Im Prüfstand kannst du beides mit dem Schalter „' + lbl('linear', 'swVergleich') + '“ nachstellen.'; },
      hint() { const v = vals(); return [
        'Der Wirkungsgrad ist die Nutzleistung geteilt durch die aufgenommene Leistung. Ein Linearregler setzt die überschüssige Spannung in Wärme um, deshalb hängt sein Wirkungsgrad nur vom Verhältnis der Spannungen ab. Beim Schaltregler zeigt der Wirkungsgrad, welcher Anteil der Eingangsleistung nutzbar bleibt; der Rest ist Verlustleistung.',
        'Die Ausgangsleistung ist Pa = Ua · Ia = ' + fm(v.ua) + ' V · ' + fm(v.ia) + ' A = ' + fm(v.pa) + ' W. Linearregler: η = Ua / Ue = ' + fm(v.ua) + ' V / ' + fm(v.ue) + ' V = ' + fm(v.etaN, 2) + ' % (mit Ruhestrom ' + fm(v.etaIq, 2) + ' %). Schaltregler: Die Eingangsleistung ist Pa / η, die Verlustleistung davon der Rest: P_V = Pa · (1/η − 1).',
        'Musterlösung: η = ' + fm(v.etaN, 2) + ' %, P_V,sw = ' + fm(v.pa) + ' W · (1/' + fm(v.etaF) + ' − 1) = ' + fm(v.pvSw, 3) + ' W. Der Linearregler setzt dagegen ' + fm(v.pLin) + ' W um, also ' + fm(v.saved, 3) + ' W mehr.'
      ]; } };
  })();

  /* ====================================================================== th17: Kuehlkoerper fuer den BD139 */
  const M17 = (() => {
    const UCE = 6, IC = 0.3, TA = 40, CFG = { device: 'bd139', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v17', () => {
      const C = CORE(), dev = C.devices.bd139, p = C.power.bipolar(UCE, IC).p, k = C.rthKerf(CFG, p, TA), ck = rthCK('TO-126', 'glimmer', 'duenn');
      return { uce: UCE, ic: IC, ta: TA, p, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, rthJA: dev.rthJA, erf: k.value, rthMax: k.rthTotMax, dT: dev.tjMax - TA, tjFrei: TA + p * dev.rthJA, ta25: (dev.tjMax - 25) / p - dev.rthJC - ck, tol: 1 };
    });
    const items = () => { const v = vals(); return [{ key: 'value', label: 'Erforderlicher Wärmewiderstand des Kühlkörpers', unit: 'K/W', want: v.erf, tol: 0.01, mistakes: [
      [v.erf + v.rthCK, 'du ' + '{sym:Rth_CK}' + ' nicht abgezogen hast'], [v.erf + v.rthJC, 'du ' + '{sym:Rth_JC}' + ' nicht abgezogen hast'], [v.rthMax, 'du den Gesamt-Wärmewiderstand angegeben hast, ohne {sym:Rth_JC} und {sym:Rth_CK} abzuziehen'],
      [v.tjMax / v.p - v.rthJC - v.rthCK, 'du ' + '{sym:Ta}' + ' nicht von {sym:Tjmax} abgezogen hast'], [v.ta25, 'du mit 25 °C statt der angegebenen Umgebungstemperatur gerechnet hast']] }]; };
    const tables = () => { const v = vals(), C = CORE(); return [
      tbl('Bauteil BD139 (Übungsdatenblatt)', ['Größe', 'Wert'], [['{sym:Tjmax}', fm(v.tjMax) + ' °C'], ['{sym:Rth_JC}', kW(v.rthJC)]]),
      tbl('Übergang Gehäuse–Kühlkörper (TO-126, Schraube fest)', ['Montage', '{sym:Rth_CK}'], [['direkt, Wärmeleitpaste dünn', kW(rthCK('TO-126', 'direkt', 'duenn'))], ['Glimmerscheibe, Wärmeleitpaste dünn', kW(C.mount.rthCK('TO-126', 'glimmer', 'duenn', 'fest'))], ['Glimmerscheibe ohne Wärmeleitpaste', kW(rthCK('TO-126', 'glimmer', 'keine'))]])
    ]; };
    return { vals, items, tables, cfg: CFG,
      text() { const v = vals(); return 'Ein BD139 arbeitet als Längstransistor in einem Netzteil: ' + fm(v.uce) + ' V zwischen Kollektor und Emitter, Kollektorstrom ' + fm(v.ic) + ' A (den Basisstrom vernachlässigst du). Im Gerät herrschen ' + fm(v.ta) + ' °C. Der Transistor wird mit Glimmerscheibe und Wärmeleitpaste auf einen Kühlkörper geschraubt; die Werte stehen in den Tabellen.\nBerechne den erforderlichen Wärmewiderstand {sym:Rth_Kerf} des Kühlkörpers, bei dem die Sperrschichttemperatur gerade die Grenze {sym:Tjmax} erreicht.'; },
      hint() { const v = vals(); return [
        'Rechne rückwärts: Aus der Verlustleistung und dem erlaubten Temperaturunterschied folgt der größte zulässige Gesamt-Wärmewiderstand. Davon ziehst du die Glieder ab, die schon feststehen: {sym:Rth_JC} und {sym:Rth_CK}. Der Rest bleibt für den Kühlkörper.',
        'P = UCE · IC = ' + fm(v.uce) + ' V · ' + fm(v.ic) + ' A = ' + fm(v.p) + ' W. Erlaubter Unterschied: ' + fm(v.tjMax) + ' °C − ' + fm(v.ta) + ' °C = ' + fm(v.dT) + ' K. Größter Gesamt-Wärmewiderstand: ' + fm(v.dT) + ' K / ' + fm(v.p) + ' W = ' + fm(v.rthMax, 2) + ' K/W. Davon gehen {sym:Rth_JC} = ' + fm(v.rthJC) + ' K/W und {sym:Rth_CK} = ' + fm(v.rthCK) + ' K/W ab.',
        'Musterlösung: {sym:Rth_Kerf} = ' + fm(v.rthMax, 2) + ' K/W − ' + fm(v.rthJC) + ' K/W − ' + fm(v.rthCK) + ' K/W = ' + fm(v.erf, 2) + ' K/W. Ohne Kühlkörper würde die Sperrschicht bei ' + fm(v.p) + ' W auf ' + fm(v.tjFrei, 1) + ' °C steigen.'
      ]; } };
  })();

  /* ====================================================================== th18: zwei Transistoren auf einem Kuehlkoerper */
  const M18 = (() => {
    const P1 = 1.8, N = 2, TA = 40, CFG = { device: 'bd139', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v18', () => {
      const C = CORE(), dev = C.devices.bd139, ck = rthCK('TO-126', 'glimmer', 'duenn'), rk = hsRth('m'), par = C.parallelDevices(N, CFG, P1, TA), one = C.steady(CFG, P1, TA);
      return { p1: P1, n: N, ta: TA, rthJC: dev.rthJC, rthCK: ck, rthK: rk, tjMax: dev.tjMax, pTot: par.pTotal, tk: par.tk, dK: par.dK, tj: par.tj, tjEin: one.tj, tkEin: one.tk, rthAll: dev.rthJC + ck + rk, tol: 2 };
    });
    const items = () => { const v = vals(); return [{ key: 'value', label: 'Sperrschichttemperatur jedes Transistors', unit: '°C', want: v.tj, tol: 0.02, mistakes: [
      [v.tjEin, 'du nur einen Transistor auf dem Kühlkörper gerechnet hast (der Kühlkörper trägt die Summe beider Verlustleistungen)'],
      [v.n * v.p1 * v.rthK + v.p1 * (v.rthJC + v.rthCK), '{sym:Ta}' + ' nicht addiert hast'], [v.ta + v.pTot * v.rthAll, 'du die Gesamtleistung durch alle drei Glieder geschickt hast ({sym:Rth_JC} und {sym:Rth_CK} führt nur der eigene Transistor)']] }]; };
    const tables = () => { const v = vals(); return [
      tbl('Aufbau (beide Transistoren gleich)', ['Größe', 'Wert'], [['Verlustleistung je Transistor', fm(v.p1) + ' W'], ['{sym:Rth_JC} je Transistor', kW(v.rthJC)], ['{sym:Rth_CK} je Transistor (Glimmerscheibe, Wärmeleitpaste)', kW(v.rthCK)], ['{sym:Rth_K} des gemeinsamen Kühlkörpers (Profil mittel)', kW(v.rthK)]])
    ]; };
    return { vals, items, tables, cfg: CFG,
      text() { const v = vals(); return 'In einer Endstufe sitzen zwei gleiche BD139 auf einem gemeinsamen Kühlkörper. Jeder Transistor setzt ' + fm(v.p1) + ' W Verlustleistung um, im Gerät herrschen ' + fm(v.ta) + ' °C. Die Werte stehen in der Tabelle.\nBerechne die Sperrschichttemperatur jedes Transistors (beide sind gleich belastet).'; },
      hint() { const v = vals(); return [
        'Der Kühlkörper führt die Wärme beider Transistoren ab, sein Temperaturabfall hängt also von der Summe der Verlustleistungen ab. Zwischen Sperrschicht und Kühlkörper fließt dagegen nur die Wärme des eigenen Transistors.',
        'Gesamtleistung am Kühlkörper: ' + fm(v.n) + ' · ' + fm(v.p1) + ' W = ' + fm(v.pTot) + ' W. {sym:Tk} = {sym:Ta} + P_ges · {sym:Rth_K} = ' + fm(v.ta) + ' °C + ' + fm(v.pTot) + ' W · ' + fm(v.rthK) + ' K/W = ' + fm(v.tk, 1) + ' °C. Danach kommen {sym:Rth_JC} und {sym:Rth_CK} mit der Leistung eines Transistors dazu.',
        'Musterlösung: {sym:Tj} = ' + fm(v.tk, 1) + ' °C + ' + fm(v.p1) + ' W · (' + fm(v.rthJC) + ' K/W + ' + fm(v.rthCK) + ' K/W) = ' + fm(v.tj, 1) + ' °C. Mit nur einem Transistor wären es ' + fm(v.tjEin, 1) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th19: MOSFET im Dauerbetrieb */
  const M19 = (() => {
    const I = 10, VGS = 5, TA = 25, U = 5, CFG = { device: 'irlz34n', heatsink: 'l', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v19', () => {
      const C = CORE(), dev = C.devices.irlz34n, rds = dev.rdsTyp[String(VGS)], ck = rthCK('TO-220', 'glimmer', 'duenn'), rk = hsRth('l'), rth = dev.rthJC + ck + rk;
      const p0 = C.power.mosfet({ i: I, d: 1, rds25: rds, tj: 25, alpha: dev.alpha, u: U, f: 0, tr: dev.tr, tf: dev.tf }).p;
      const cp = C.coupled.mosfet({ i: I, d: 1, rds25: rds, alpha: dev.alpha, u: U, f: 0, tr: dev.tr, tf: dev.tf, rth, ta: TA });
      return { i: I, vgs: VGS, ta: TA, rdsmOhm: rds * 1000, rds, alpha: dev.alpha, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, rthK: rk, rth, p: p0, tj: C.steady(CFG, p0, TA).tj, dT: p0 * rth, pHot: cp.p, tjHot: cp.tj, g: cp.g, dTHot: cp.dT, tolP: 2, tolTj: 3 };
    });
    const items = () => { const v = vals(); return [
      { key: 'p', label: 'Verlustleistung im Durchlasszustand', unit: 'W', want: v.p, alts: [v.pHot], tol: 0.02, mistakes: [[v.i * v.vgs, 'du den Strom mit der Gate-Spannung multipliziert hast (am Kanal fällt nur I · RDS(on) ab)'], [v.i * v.rds, 'du den Strom nicht quadriert hast (P = I² · RDS(on))']] },
      { key: 'tj', label: 'Sperrschichttemperatur', unit: '°C', want: v.tj, alts: [v.tjHot], tol: 0.03, mistakes: [[v.dT, 'du {sym:Ta} nicht addiert hast (P · {sym:Rth_ges} ist nur die Übertemperatur)'], [v.ta + v.p * (v.rthJC + v.rthK), 'du {sym:Rth_CK} vergessen hast']] }
    ]; };
    const fields = [{ key: 'p', label: 'Verlustleistung {sym:P}', unit: 'W' }, { key: 'tj', label: 'Sperrschichttemperatur {sym:Tj}', unit: '°C' }];
    const tables = () => { const v = vals(); return [
      tbl('Bauteil IRLZ34N (Übungsdatenblatt)', ['Größe', 'Wert'], [['RDS(on) typisch bei ' + fm(v.vgs) + ' V Gate und 25 °C', fm(v.rdsmOhm) + ' mΩ'], ['Temperaturbeiwert α von RDS(on)', fm(v.alpha, 4) + ' 1/K'], ['{sym:Rth_JC}', kW(v.rthJC)], ['{sym:Tjmax}', fm(v.tjMax) + ' °C']]),
      tbl('Aufbau', ['Glied', 'Wärmewiderstand'], [['{sym:Rth_CK} (Glimmerscheibe, Wärmeleitpaste)', kW(v.rthCK)], ['{sym:Rth_K} (Profil groß)', kW(v.rthK)]])
    ]; };
    return { vals, items, fields, tables, cfg: CFG,
      text() { const v = vals(); return 'Ein IRLZ34N schaltet eine Last dauerhaft ein: ' + fm(v.i) + ' A bei ' + fm(v.vgs) + ' V am Gate, Tastgrad 100 % (also keine Schaltverluste). Rechne mit dem typischen RDS(on) bei 25 °C aus der Tabelle. Das Bauteil sitzt mit Glimmerscheibe und Wärmeleitpaste auf einem Kühlkörper, die Umgebung hat ' + fm(v.ta) + ' °C.\nBerechne die Verlustleistung und die Sperrschichttemperatur. Zwei Rechenwege gelten: Ohne Rückkopplung rechnest du mit RDS(on) bei 25 °C. Mit Rückkopplung berücksichtigst du, dass RDS(on) mit der Sperrschichttemperatur steigt (Temperaturbeiwert α in der Tabelle); dann gilt für beide Ergebnisse der zweite Wert.'; },
      hint() { const v = vals(); return [
        'Im Durchlasszustand wirkt der Kanal wie ein Widerstand: P = I² · RDS(on). Die Sperrschichttemperatur folgt aus der Kette {sym:Rth_ges} = {sym:Rth_JC} + {sym:Rth_CK} + {sym:Rth_K}. Weil RDS(on) mit der Temperatur steigt, wird die Verlustleistung etwas größer, sobald das Bauteil warm ist.',
        'P = (' + fm(v.i) + ' A)² · ' + fm(v.rdsmOhm) + ' mΩ = ' + fm(v.p) + ' W. {sym:Rth_ges} = ' + fm(v.rthJC) + ' K/W + ' + fm(v.rthCK) + ' K/W + ' + fm(v.rthK) + ' K/W = ' + fm(v.rth) + ' K/W, also {sym:Tj} = ' + fm(v.ta) + ' °C + ' + fm(v.p) + ' W · ' + fm(v.rth) + ' K/W = ' + fm(v.tj, 2) + ' °C.',
        'Mit Rückkopplung: Die Schleifenverstärkung ist G = P · α · {sym:Rth_ges} = ' + fm(v.g, 4) + ' (stabil, weil sie unter 1 liegt); die Erwärmung wächst auf ' + fm(v.dTHot, 2) + ' K, also {sym:Tj} = ' + fm(v.tjHot, 2) + ' °C bei P = ' + fm(v.pHot, 3) + ' W. Ohne Rückkopplung: P = ' + fm(v.p) + ' W und {sym:Tj} = ' + fm(v.tj, 2) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th20: MOSFET im PWM-Betrieb */
  const M20 = (() => {
    const U = 24, I = 10, F = 20000, D = 0.5, VGS = 5;
    const vals = () => once('v20', () => {
      const C = CORE(), dev = C.devices.irlz34n, rds = dev.rdsTyp[String(VGS)];
      const r = C.power.mosfet({ i: I, d: D, rds25: rds, tj: 25, alpha: dev.alpha, u: U, f: F, tr: dev.tr, tf: dev.tf });
      return { u: U, i: I, fkHz: F / 1000, d: D, dPct: D * 100, vgs: VGS, rdsmOhm: rds * 1000, rds, trNs: dev.tr * 1e9, tfNs: dev.tf * 1e9, tr: dev.tr, tf: dev.tf, pLeit: r.pLeit, pSw: r.pSw, pTot: r.p, pLeitVollD: I * I * rds, tref: 25, tol: 3 };
    });
    const items = () => { const v = vals(); return [
      { key: 'psw', label: 'Schaltverluste', unit: 'W', want: v.pSw, tol: 0.03, mistakes: [[2 * v.pSw, 'du den Faktor ½ vergessen hast'], [0.5 * v.u * v.i * v.tr * v.fkHz * 1000, 'du nur die Anstiegszeit tr benutzt hast (die Abfallzeit tf zählt auch)']] },
      { key: 'pges', label: 'Gesamte Verlustleistung', unit: 'W', want: v.pTot, tol: 0.03, mistakes: [[v.pLeitVollD + v.pSw, 'du die Leitverluste ohne den Tastgrad gerechnet hast (D · I² · RDS(on))'], [v.pLeit, 'du die Schaltverluste nicht addiert hast']] }
    ]; };
    const fields = [{ key: 'psw', label: 'Schaltverluste P_sw', unit: 'W' }, { key: 'pges', label: 'Gesamte Verlustleistung {sym:P}', unit: 'W' }];
    const tables = () => { const v = vals(); return [
      tbl('Bauteil IRLZ34N (Übungsdatenblatt)', ['Größe', 'Wert'], [['RDS(on) typisch bei ' + fm(v.vgs) + ' V Gate und 25 °C', fm(v.rdsmOhm) + ' mΩ'], ['Anstiegszeit tr', fm(v.trNs) + ' ns'], ['Abfallzeit tf', fm(v.tfNs) + ' ns']])
    ]; };
    return { vals, items, fields, tables,
      text() { const v = vals(); return 'Ein IRLZ34N schaltet eine Last mit PWM: Schaltfrequenz ' + fm(v.fkHz) + ' kHz, Tastgrad ' + fm(v.dPct) + ' %, Betriebsspannung ' + fm(v.u) + ' V, Strom ' + fm(v.i) + ' A im eingeschalteten Zustand. Rechne mit RDS(on) bei 25 °C aus der Tabelle (die Schaltzeiten gelten für diese Beschaltung).\nBerechne die Schaltverluste mit der Näherung P_sw = ½ · U · I · (tr + tf) · f und die gesamte Verlustleistung (Leitverluste plus Schaltverluste).'; },
      hint() { const v = vals(); return [
        'Zwei Verlustanteile treten auf: Im eingeschalteten Zustand fließt der Strom durch RDS(on), und das nur während des Tastgrades D. Beim Umschalten sind Spannung und Strom gleichzeitig größer als null; diese Überlappung kostet bei jedem Schaltvorgang Energie, also wächst P_sw mit der Frequenz.',
        'Leitverluste: P_leit = D · I² · RDS(on) = ' + fm(v.d) + ' · (' + fm(v.i) + ' A)² · ' + fm(v.rdsmOhm) + ' mΩ = ' + fm(v.pLeit) + ' W. Schaltverluste: P_sw = ½ · ' + fm(v.u) + ' V · ' + fm(v.i) + ' A · (' + fm(v.trNs) + ' ns + ' + fm(v.tfNs) + ' ns) · ' + fm(v.fkHz) + ' kHz.',
        'Musterlösung: P_sw = ' + fm(v.pSw, 3) + ' W (Näherung mit linearer Überlappung), P = ' + fm(v.pLeit) + ' W + ' + fm(v.pSw, 3) + ' W = ' + fm(v.pTot, 3) + ' W.'
      ]; } };
  })();

  /* ====================================================================== th21: thermische Mitkopplung */
  const M21 = (() => {
    const I = 18, VGS = 5;
    const vals = () => once('v21', () => {
      const C = CORE(), dev = C.devices.irlz34n, rds = dev.rdsTyp[String(VGS)], p25 = I * I * rds, crit = 1 / (p25 * dev.alpha);
      const rthS = dev.rthJC + rthCK('TO-220', 'glimmer', 'duenn') + hsRth('s');
      const gS = C.coupled.mosfet({ i: I, d: 1, rds25: rds, alpha: dev.alpha, u: 5, f: 0, tr: dev.tr, tf: dev.tf, rth: rthS, ta: 25 }).g;
      return { i: I, vgs: VGS, rdsmOhm: rds * 1000, rds, alpha: dev.alpha, p25, crit, tjMax: dev.tjMax, critTjMax: (dev.tjMax - 25) / p25, rthS, gS, gCrit: p25 * dev.alpha * crit, tref: 25, tol: 1.5 };
    });
    const items = () => { const v = vals(); return [{ key: 'value', label: 'Kritischer Gesamt-Wärmewiderstand', unit: 'K/W', want: v.crit, tol: 0.015, mistakes: [
      [1 / v.alpha, 'du die Bedingung ohne die Verlustleistung gerechnet hast (1/α)'], [v.critTjMax, 'du den Wärmewiderstand so bestimmt hast, dass {sym:Tj} bei 25 °C Umgebung genau {sym:Tjmax} erreicht, statt die Bedingung P · α · {sym:Rth_ges} = 1 zu lösen']] }]; };
    return { vals, items,
      text() { const v = vals(); return 'Ein IRLZ34N führt im Dauerbetrieb ' + fm(v.i) + ' A bei ' + fm(v.vgs) + ' V Gate. RDS(on) beträgt bei 25 °C ' + fm(v.rdsmOhm) + ' mΩ und steigt mit dem Temperaturbeiwert α = ' + fm(v.alpha, 4) + ' 1/K. Dadurch steigt die Verlustleistung mit der Temperatur, und die Temperatur steigt weiter (thermische Mitkopplung). Die Temperatur läuft weg, sobald die Schleifenverstärkung G = P · α · {sym:Rth_ges} den Wert 1 erreicht; für P setzt du die Verlustleistung bei 25 °C ein.\nBerechne den kritischen Gesamt-Wärmewiderstand {sym:Rth_ges}, bei dem G = 1 ist.'; },
      hint() { const v = vals(); return [
        'Löse die Bedingung G = P · α · {sym:Rth_ges} = 1 nach dem Wärmewiderstand auf. Für P nimmst du die Verlustleistung im Durchlasszustand bei 25 °C: P = I² · RDS(on). Ist der Gesamt-Wärmewiderstand größer als dieser Wert, hat die Rückkopplung mehr als die Verstärkung 1.',
        'P = (' + fm(v.i) + ' A)² · ' + fm(v.rdsmOhm) + ' mΩ = ' + fm(v.p25, 3) + ' W. Dann ist {sym:Rth_ges} = 1 / (P · α) = 1 / (' + fm(v.p25, 3) + ' W · ' + fm(v.alpha, 4) + ' 1/K).',
        'Musterlösung: Der kritische Wert von {sym:Rth_ges} ist ' + fm(v.crit, 2) + ' K/W. Zur Probe: Mit Glimmerscheibe, Wärmeleitpaste und Profil klein ist {sym:Rth_ges} = ' + fm(v.rthS) + ' K/W, also G = ' + fm(v.gS, 3) + ' und damit über 1.'
      ]; } };
  })();

  /* ====================================================================== th22: Diode am Ladeelko */
  const M22 = (() => {
    const I = 1, TA = 60, FF = 3;
    const vals = () => once('v22', () => {
      const C = CORE(), dev = C.devices['1n4007'], dc = C.power.diode({ i: I, ff: 1, u0: dev.u0, rf: dev.rF }), el = C.power.diode({ i: I, ff: FF, u0: dev.u0, rf: dev.rF });
      const tj = C.steady({ device: '1n4007' }, dc.p, TA).tj, tjEl = C.steady({ device: '1n4007' }, el.p, TA).tj;
      return { i: I, ta: TA, ff: FF, u0: dev.u0, rf: dev.rF, rthJA: dev.rthJA, rthJL: dev.rthJL, tjMax: dev.tjMax, p: dc.p, pEl: el.p, tj, tjEl, reserve: dev.tjMax - tj, ueber: tjEl - dev.tjMax, dT: dc.p * dev.rthJA, ok: tj <= dev.tjMax, okEl: tjEl <= dev.tjMax, tol: 2 };
    });
    const items = () => { const v = vals(); return [{ key: 'value', label: 'Sperrschichttemperatur bei Gleichstrom', unit: '°C', want: v.tj, tol: 0.02, mistakes: [
      [v.dT, 'du {sym:Ta} nicht addiert hast (P · {sym:Rth_JA} ist nur die Übertemperatur)'], [v.ta + v.p * v.rthJL, 'du nur den Wärmewiderstand des Anschlussdrahtes ({sym:Rth_JC} steht hier für Sperrschicht–Anschlussdraht) statt {sym:Rth_JA} benutzt hast']] }]; };
    const yn = [{ value: 'ja', label: 'Ja, zulässig' }, { value: 'nein', label: 'Nein, nicht zulässig' }];
    const choices = [
      { key: 'ok', q: 'Ist die Sperrschichttemperatur bei 1 A Gleichstrom zulässig?', options: yn },
      { key: 'elko', q: 'Bleibt sie zulässig, wenn derselbe Mittelwert 1 A als Ladeelko-Impulse mit dem Formfaktor 3 fließt?', options: yn }
    ];
    return { vals, items, choices,
      text() { const v = vals(); return 'Eine Gleichrichterdiode 1N4007 steht freistehend im Gerät (Umgebung ' + fm(v.ta) + ' °C). Sie führt einen Mittelwert von ' + fm(v.i) + ' A. Die Durchlassspannung folgt UF = U0 + rF · IF; die Verlustleistung ist P = U0 · I + rF · (FF · I)², mit dem Formfaktor FF (Gleichstrom: 1). Die Werte stehen in der Tabelle.\nBerechne die Sperrschichttemperatur bei Gleichstrom und entscheide, ob sie zulässig ist. Entscheide danach dieselbe Frage für Ladeelko-Impulse mit dem Formfaktor ' + fm(v.ff) + ' (gleicher Mittelwert).'; },
      tables() { const v = vals(); return [tbl('Diode 1N4007 (Übungsdatenblatt)', ['Größe', 'Wert'], [['{sym:Tjmax}', fm(v.tjMax) + ' °C'], ['{sym:Rth_JA} (freistehend)', kW(v.rthJA)], ['U0', fm(v.u0, 2) + ' V'], ['rF', fm(v.rf, 2) + ' Ω']])]; },
      hint() { const v = vals(); return [
        'Die Verlustleistung der Diode steigt mit dem Effektivwert des Stroms stärker als mit dem Mittelwert: Bei Impulsen ist der Effektivwert FF-mal so groß wie der Mittelwert, und der Widerstandsanteil rechnet mit dem Quadrat. Freistehend gilt {sym:Tj} = {sym:Ta} + P · {sym:Rth_JA}.',
        'Gleichstrom: P = ' + fm(v.u0, 2) + ' V · ' + fm(v.i) + ' A + ' + fm(v.rf, 2) + ' Ω · (' + fm(v.i) + ' A)² = ' + fm(v.p, 3) + ' W, also {sym:Tj} = ' + fm(v.ta) + ' °C + ' + fm(v.p, 3) + ' W · ' + fm(v.rthJA) + ' K/W. Vergleiche das Ergebnis mit {sym:Tjmax} = ' + fm(v.tjMax) + ' °C.',
        'Musterlösung: {sym:Tj} = ' + fm(v.tj, 1) + ' °C (Reserve ' + fm(v.reserve, 1) + ' K), zulässig. Mit Formfaktor ' + fm(v.ff) + ': P = ' + fm(v.pEl, 3) + ' W und {sym:Tj} = ' + fm(v.tjEl, 1) + ' °C, das sind ' + fm(v.ueber, 1) + ' K über {sym:Tjmax}: nicht zulässig.'
      ]; },
      extra(r, a) {
        const v = vals(), ja = 'ja', nein = 'nein';
        choiceRow(r, 'Zulässigkeit bei Gleichstrom richtig beurteilt', choiceOf(a, 'ok'), v.ok ? ja : nein, () => 'Bei ' + fm(v.i) + ' A Gleichstrom liegt die gerechnete Sperrschichttemperatur bei ' + fm(v.tj, 1) + ' °C und damit ' + (v.ok ? 'unter' : 'über') + ' dem Grenzwert von ' + fm(v.tjMax) + ' °C.');
        choiceRow(r, 'Zulässigkeit bei Ladeelko-Impulsen richtig beurteilt', choiceOf(a, 'elko'), v.okEl ? ja : nein, () => 'Mit Formfaktor ' + fm(v.ff) + ' beträgt die Verlustleistung ' + fm(v.pEl, 3) + ' W und die Sperrschichttemperatur ' + fm(v.tjEl, 1) + ' °C, also ' + (v.okEl ? 'unter' : 'über') + ' dem Grenzwert von ' + fm(v.tjMax) + ' °C.');
      } };
  })();

  /* ====================================================================== th23: Zementwiderstand */
  const M23 = (() => {
    const U = 12;
    const vals = () => once('v23', () => {
      const C = CORE(), dev = C.devices['r-zement5'], pN = dev.pNenn, pH = pN / 2, rmin = U * U / pH, e12 = C.eSeries('E12', rmin, 'up'), eDown = C.eSeries('E12', rmin, 'down');
      return { u: U, pNenn: pN, pHalf: pH, rmin, e12, p68: U * U / e12, eDown, pDown: U * U / eDown, rVoll: U * U / pN, eNext: C.eSeries('E12', e12 * 1.01, 'up'), tol: 2 };
    });
    const items = () => { const v = vals(); return [{ key: 'rmin', label: 'Mindestwert des Widerstands', unit: 'Ω', want: v.rmin, tol: 0.02, mistakes: [[v.rVoll, 'du mit der vollen Nennleistung gerechnet hast (die Aufgabe verlangt die halbe)'], [v.u / v.pHalf, 'du die Spannung nicht quadriert hast (R = U² / P)']] }]; };
    const fields = [{ key: 'rmin', label: 'Mindestwert des Widerstands R', unit: 'Ω' }, { key: 'e12', label: 'Gewählter Wert aus der Reihe E12', unit: 'Ω' }];
    return { vals, items, fields,
      text() { const v = vals(); return 'Ein Zementwiderstand mit ' + fm(v.pNenn) + ' W Nennleistung liegt an ' + fm(v.u) + ' V. Er soll nur mit der halben Nennleistung betrieben werden, damit er nicht zu heiß wird (Reserve für das Gehäuse im Gerät).\nBerechne den kleinsten Widerstandswert, bei dem das gilt, und wähle dann den kleinsten passenden Wert aus der Normreihe E12 (1; 1,2; 1,5; 1,8; 2,2; 2,7; 3,3; 3,9; 4,7; 5,6; 6,8; 8,2 mal Zehnerpotenz).'; },
      hint() { const v = vals(); return [
        'Die Verlustleistung am Widerstand ist P = U² / R. Je größer der Widerstand, desto kleiner die Leistung. Die halbe Nennleistung ist die Obergrenze für P; daraus folgt ein Mindestwert für R. Aus der Reihe E12 nimmst du den nächsten Wert nach oben, denn ein kleinerer Wert würde mehr Leistung umsetzen.',
        'Halbe Nennleistung: ' + fm(v.pNenn) + ' W / 2 = ' + fm(v.pHalf) + ' W. R ≥ U² / P = (' + fm(v.u) + ' V)² / ' + fm(v.pHalf) + ' W = ' + fm(v.rmin, 2) + ' Ω.',
        'Musterlösung: R ≥ ' + fm(v.rmin, 2) + ' Ω, nächster E12-Wert nach oben: ' + fm(v.e12) + ' Ω (Leistung ' + fm(v.p68, 3) + ' W). Der nächstkleinere E12-Wert ' + fm(v.eDown) + ' Ω würde ' + fm(v.pDown, 3) + ' W umsetzen, mehr als ' + fm(v.pHalf) + ' W.'
      ]; },
      extra(r, a) {
        const v = vals(), C = CORE(), x = fieldNum(a, 'e12'), label = 'Gewählter Wert aus der Reihe E12 (kleinster passender)';
        if (!fin(x)) { r(false, label, 'Trage hier eine Zahl ein (Komma oder Punkt).'); return; }
        const ok = Math.abs(x - v.e12) <= 0.005 * v.e12, nearest = C.eSeries('E12', x, 'nearest'), isE12 = fin(nearest) && Math.abs(nearest - x) <= 0.005 * x;
        let why = '';
        if (!ok) {
          if (!isE12) why = 'Der Wert ' + fm(x) + ' Ω gehört nicht zur Reihe E12.';
          else if (x < v.e12) why = 'Bei ' + fm(x) + ' Ω setzt der Widerstand an ' + fm(v.u) + ' V ' + fm(v.u * v.u / x, 3) + ' W um, das ist mehr als die halbe Nennleistung (' + fm(v.pHalf) + ' W).';
          else why = 'Bei ' + fm(x) + ' Ω hältst du die halbe Nennleistung ein (' + fm(v.u * v.u / x, 3) + ' W), aber ein kleinerer Wert aus der Reihe E12 reicht schon.';
        }
        r(ok, label, why);
      } };
  })();

  /* ====================================================================== th24: LED-Treiber */
  const M24 = (() => {
    const N = 3, UB = 24, I = 0.7;
    const vals = () => once('v24', () => {
      const C = CORE(), dev = C.devices.led3w, vw = dev.elec({ n: N, ub: UB, iLed: I, driver: 'vorwiderstand' }), cc = dev.elec({ n: N, ub: UB, iLed: I, driver: 'lm317cc' });
      return { n: N, ub: UB, i: I, uf: dev.uf, uLed: vw.uLed, head: vw.headroom, pVw: vw.headroom * I, rvExact: vw.rExact, rvE12: vw.rV, iE12: vw.i, pVwE12: vw.pTreiber, vref: dev.vref, rs: cc.rS, pRs: cc.pRs, pReg: cc.pReg, pCC: cc.pTreiber, uReg: vw.headroom - dev.vref, pTot: UB * I, pLed: N * dev.uf * I, pTh: dev.etaTh * N * dev.uf * I, gleich: Math.abs(vw.headroom * I - cc.pTreiber) <= 1e-9, tol: 3 };
    });
    const items = () => { const v = vals(); return [
      { key: 'pvw', label: 'Verlustleistung des Vorwiderstands', unit: 'W', want: v.pVw, alts: [v.pVwE12], tol: 0.03, mistakes: [[v.pTot, 'du die gesamte Eingangsleistung Ub · I gerechnet hast'], [v.pLed, 'du nur die elektrische Leistung der LED-Kette gerechnet hast'], [v.pTh, 'du nur die Wärmeleistung der LEDs gerechnet hast']] },
      { key: 'pcc', label: 'Verlustleistung der LM317-Schaltung (Regler und Messwiderstand)', unit: 'W', want: v.pCC, tol: 0.03, mistakes: [[v.pReg, 'du nur den LM317 selbst gerechnet hast (der Messwiderstand R_S setzt zusätzlich ' + fm(v.pRs, 3) + ' W um)'], [v.pTot, 'du die gesamte Eingangsleistung Ub · I gerechnet hast'], [v.pLed, 'du nur die elektrische Leistung der LED-Kette gerechnet hast']] }
    ]; };
    const fields = [{ key: 'pvw', label: 'Verlustleistung des Vorwiderstands', unit: 'W' }, { key: 'pcc', label: 'Verlustleistung der LM317-Schaltung', unit: 'W' }];
    const choices = [{ key: 'mehr', q: 'Welcher Treiber setzt bei gleichem LED-Strom mehr Verlustleistung um?', options: [{ value: 'vw', label: 'Der Vorwiderstand' }, { value: 'cc', label: 'Die LM317-Schaltung' }, { value: 'gleich', label: 'Beide gleich viel' }] }];
    return { vals, items, fields, choices,
      text() { const v = vals(); return 'Drei Power-LEDs (Reihenschaltung, je ' + fm(v.uf) + ' V bei ' + fm(v.i) + ' A) hängen an ' + fm(v.ub) + ' V. Der Strom von ' + fm(v.i) + ' A wird entweder mit einem Vorwiderstand eingestellt oder mit einem LM317 als Konstantstromquelle (Messwiderstand R_S, Bezugsspannung ' + fm(v.vref, 2) + ' V). Mit Verlustleistung des Treibers meinen wir alles, was zwischen Betriebsspannung und LED-Kette in Wärme umgesetzt wird (Vorwiderstand, beim LM317 der Regler und der Messwiderstand zusammen). Beim Vorwiderstand darfst du mit dem genauen Wert oder mit dem nächsten Wert aus der Reihe E12 (nach oben gerundet) rechnen; beide Ergebnisse gelten.\nBerechne die Verlustleistung beider Treiber und beantworte die Frage zum Vergleich.'; },
      hint() { const v = vals(); return [
        'Die LED-Kette braucht eine feste Spannung, der Rest der Betriebsspannung fällt am Treiber ab. Bei gleichem Strom setzt dieser Rest die Leistung (Betriebsspannung minus LED-Spannung) mal Strom um, egal ob er an einem Widerstand oder an einer Stromquelle abfällt.',
        'Spannung der LED-Kette: ' + fm(v.n) + ' · ' + fm(v.uf) + ' V = ' + fm(v.uLed) + ' V. Für den Treiber bleiben ' + fm(v.ub) + ' V − ' + fm(v.uLed) + ' V = ' + fm(v.head) + ' V. Beim LM317 fallen davon ' + fm(v.vref, 2) + ' V am Messwiderstand ab (R_S = ' + fm(v.vref, 2) + ' V / ' + fm(v.i) + ' A = ' + fm(v.rs, 3) + ' Ω), der Rest am Regler.',
        'Musterlösung: Vorwiderstand P = ' + fm(v.head) + ' V · ' + fm(v.i) + ' A = ' + fm(v.pVw, 2) + ' W (mit dem E12-Wert ' + fm(v.rvE12) + ' Ω sinkt der Strom auf ' + fm(v.iE12, 3) + ' A und die Leistung auf ' + fm(v.pVwE12, 3) + ' W). LM317-Schaltung: ' + fm(v.pReg, 3) + ' W im Regler plus ' + fm(v.pRs, 3) + ' W im Messwiderstand = ' + fm(v.pCC, 2) + ' W. Bei gleichem Strom ist die Verlustleistung gleich.'
      ]; },
      extra(r, a) {
        const v = vals();
        choiceRow(r, 'Vergleich der Verlustleistungen richtig beurteilt', choiceOf(a, 'mehr'), v.gleich ? 'gleich' : (v.pVw > v.pCC ? 'vw' : 'cc'), () => 'Bei gleichem LED-Strom von ' + fm(v.i) + ' A setzt der Vorwiderstand ' + fm(v.pVw, 2) + ' W um und die LM317-Schaltung ' + fm(v.pCC, 2) + ' W.');
      } };
  })();

  /* ====================================================================== th25: Fehlersuche, Gehaeuse wird zu heiss */
  const M25 = (() => {
    const FIX = { device: '7805', loadMode: 'strom', ue: 15, iLoad: 1, iq: true, swVergleich: false, ta: 40, nonlin: false };
    const START = { heatsink: 'l', joint: 'glimmer', paste: 'keine', bushing: true, screw: 'fest', ksPot: 'masse', fan: 'mittel', orient: 'senkrecht' };
    const MUSTER = Object.assign({}, START, { paste: 'duenn' });
    const WL = ['heatsink', 'blechA', 'joint', 'paste', 'bushing', 'screw', 'ksPot', 'fan', 'orient'];
    const sim = ctl => build('linear', Object.assign({}, FIX, START, ctl));
    const vals = () => once('v25', () => {
      const s = sim({}), m = sim({ paste: 'duenn' }), d = sim({ paste: 'dick' });
      return { ue: FIX.ue, ia: FIX.iLoad, ta: FIX.ta, p: s.steady.pv, tjMax: s.st.tjMax, tjStart: s.steady.tj, tjMuster: m.steady.tj, tjDick: d.steady.tj, ckStart: s.chain.rthCK, ckMuster: m.chain.rthCK, ckDick: d.chain.rthCK, rthJC: s.chain.rthJC, rthK: s.chain.rthK, rthStart: s.chain.rthTotal, rthMuster: m.chain.rthTotal, reserveMuster: s.st.tjMax - m.steady.tj, dTjPaste: s.steady.tj - m.steady.tj, fan: START.fan };
    });
    const choices = [{ key: 'fehler', q: 'Welcher Montage- oder Betriebsfehler liegt vor?', options: [{ value: 'paste', label: 'Die Wärmeleitpaste fehlt' }, { value: 'buchse', label: 'Die Isolierbuchse fehlt' }, { value: 'schraube', label: 'Die Schraube sitzt locker' }, { value: 'luefter', label: 'Der Lüfter ist ausgefallen' }] }];
    const check = mk((r, a) => {
      const v = vals(), p = pick(a, 'linear', WL), eff = Object.assign({}, START, p.controls), s = sim(p.controls), C = CORE();
      inputRow(r, p.problems, s, a, 'linear');
      const ckOk = C.mount.rthCK('TO-220', eff.joint, 'duenn', eff.screw), ckNow = s.chain.rthCK;
      r(eff.paste === 'duenn', 'Die Wärmeleitpaste ist dünn aufgetragen', eff.paste === 'keine' ? 'Im Aufbau fehlt die Paste noch: {sym:Rth_CK} beträgt ' + kW(ckNow) + ', mit dünner Paste (gleiche Montage) wären es ' + kW(ckOk) + '.' : (eff.paste === 'dick' ? 'Die Paste ist zu dick aufgetragen: {sym:Rth_CK} steigt auf ' + kW(ckNow) + ', bei dünnem Auftrag (gleiche Montage) sind es ' + kW(ckOk) + '.' : 'Die Paste ist nicht dünn aufgetragen.'));
      const tj = s.steady && s.steady.tj;
      r(fin(tj) && tj <= v.tjMax, '{sym:Tj} bleibt im Beharrungszustand unter {sym:Tjmax}', 'Im Beharrungszustand beträgt {sym:Tj} ' + fm(tj, 1) + ' °C, erlaubt sind höchstens ' + fm(v.tjMax) + ' °C ({sym:Rth_ges} = ' + kW(s.chain.rthTotal) + ' bei ' + fm(s.steady.pv, 2) + ' W). Verkleinere eines der drei Glieder {sym:Rth_JC}, {sym:Rth_CK}, {sym:Rth_K}.');
      r(s.ok && !s.st.short, 'Der Aufbau hat keinen Kurzschluss', 'Der Prüfstand meldet einen Kurzschluss zwischen Fahne und Kühlkörper.');
      choiceRow(r, 'Fehlerursache richtig erkannt', choiceOf(a, 'fehler'), 'paste', got => {
        const f = { buchse: 'Die Isolierbuchse ist im Aufbau eingebaut (Startvorlage).', schraube: 'Die Schraube sitzt in der Startvorlage fest.', luefter: 'In der Startvorlage läuft der Lüfter (Stufe ' + START.fan + ').' }[got];
        return (f ? f + ' ' : '') + 'Vergleiche {sym:Rth_CK} der Startvorlage (' + kW(v.ckStart) + ') mit dem Wert für eine saubere Montage (' + kW(v.ckMuster) + ').';
      });
    });
    return { FIX, START, MUSTER, WL, sim, vals, choices, check,
      text() { const v = vals(); return 'Ein Netzteil mit dem Linearregler 7805 (' + fm(v.ue) + ' V Eingang, ' + fm(v.ia) + ' A Last, im Gerät ' + fm(v.ta) + ' °C) liegt mit Glimmerscheibe auf einem großen Kühlkörper mit Lüfter. Nach dem Zusammenbau wird der Regler zu heiß: Die Sperrschichttemperatur liegt über dem Grenzwert von ' + fm(v.tjMax) + ' °C. Bei der Montage ist ein typischer Fehler passiert.\nSuche den Fehler im Prüfstand (Messwerte und Meldungen), beantworte die Frage zur Ursache und behebe den Fehler, so dass die Sperrschichttemperatur im Beharrungszustand unter dem Grenzwert bleibt.'; },
      hint() { const v = vals(); return [
        'Vergleiche die Glieder der Kette mit den Sollwerten: Der Prüfstand zeigt die Temperaturabfälle und meldet Montagefehler als Text. Ein Fehler vergrößert genau ein Glied, und der Temperaturabfall über diesem Glied wächst.',
        'Der Übergang Gehäuse–Kühlkörper hat in der Startvorlage {sym:Rth_CK} = ' + fm(v.ckStart) + ' K/W. Mit dünner Wärmeleitpaste wären es ' + fm(v.ckMuster) + ' K/W. Bei ' + fm(v.p, 3) + ' W ist die Sperrschicht dadurch ' + fm(v.dTjPaste, 1) + ' K heißer. Zu viel Paste ist auch falsch: {sym:Rth_CK} steigt dann auf ' + fm(v.ckDick) + ' K/W.',
        'Musterlösung: Die Wärmeleitpaste fehlt. Stelle die Wärmeleitpaste auf „dünn“. Dann ist {sym:Rth_ges} = ' + fm(v.rthMuster) + ' K/W und {sym:Tj} = ' + fm(v.tjMuster, 1) + ' °C (Startvorlage: ' + fm(v.tjStart, 1) + ' °C, Grenze ' + fm(v.tjMax) + ' °C). Mit zu dicker Paste wären es ' + fm(v.tjDick, 1) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th26: Fehlersuche, Kuehlkoerper lauwarm */
  const M26 = (() => {
    const FIX = { device: '7805', loadMode: 'strom', ue: 15, iLoad: 0.8, iq: true, swVergleich: false, ta: 40, nonlin: false };
    const START = { heatsink: 'xl', joint: 'glimmer', paste: 'keine', bushing: true, screw: 'locker', ksPot: 'masse', fan: 'aus', orient: 'senkrecht' };
    const sim = () => build('linear', Object.assign({}, FIX, START));
    const vals = () => once('v26', () => {
      const C = CORE(), s = sim(), st = s.st, p = s.steady.pv, dev = C.devices['7805'];
      const soll = { jc: dev.rthJC, ck: rthCK('TO-220', 'glimmer', 'duenn', 'fest'), k: hsRth('xl') };
      const ist = { jc: st.dJC / p, ck: st.dCK / p, k: st.dK / p };
      const ratio = { jc: ist.jc / soll.jc, ck: ist.ck / soll.ck, k: ist.k / soll.k };
      const maxBy = o => Object.keys(o).reduce((b, k) => (o[k] > o[b] ? k : b), 'jc');
      const cfg = o => Object.assign({ device: '7805', bushing: true, ksPot: 'masse', orient: 'senkrecht', fan: 'aus' }, START, o);
      const montage = C.steady(cfg({ paste: 'duenn', screw: 'fest' }), p, FIX.ta), lueft = C.steady(cfg({ fan: 'stark' }), p, FIX.ta);
      return { ue: FIX.ue, ia: FIX.iLoad, ta: FIX.ta, p, tjMax: st.tjMax, tj: st.tj, tc: st.tc, tk: st.tk, dJC: st.dJC, dCK: st.dCK, dK: st.dK, soll, ist, ratio, glied: maxBy(ratio), gliedDT: maxBy({ jc: st.dJC, ck: st.dCK, k: st.dK }), tjMontage: montage.tj, tjLuefter: lueft.tj, okMontage: montage.tj <= st.tjMax, okLuefter: lueft.tj <= st.tjMax, rthLuefter: lueft.rthK, tol: 1 };
    });
    const fields = [{ key: 'tj', label: 'Gemessene Sperrschichttemperatur {sym:Tj}', unit: '°C' }, { key: 'tc', label: 'Gemessene Gehäusetemperatur {sym:Tc}', unit: '°C' }, { key: 'tk', label: 'Gemessene Kühlkörpertemperatur {sym:Tk}', unit: '°C' }];
    const choices = [
      { key: 'glied', q: 'Welches Glied der Wärmekette ist schuld?', options: [{ value: 'jc', label: 'Der Wärmewiderstand Sperrschicht–Gehäuse ({sym:Rth_JC})' }, { value: 'ck', label: 'Der Übergang Gehäuse–Kühlkörper ({sym:Rth_CK})' }, { value: 'k', label: 'Der Kühlkörper selbst ({sym:Rth_K})' }] },
      { key: 'abhilfe', q: 'Welche Abhilfe bringt die Sperrschichttemperatur unter den Grenzwert?', options: [{ value: 'montage', label: 'Wärmeleitpaste dünn auftragen und die Schraube festziehen' }, { value: 'luefter', label: 'Einen Lüfter auf Stufe stark einschalten' }] }
    ];
    const tables = () => { const v = vals(); return [tbl('Sollwerte laut Datenblatt und Katalog', ['Glied', 'Sollwert'], [['{sym:Rth_JC} (7805)', kW(v.soll.jc)], ['{sym:Rth_CK} (Glimmerscheibe, Wärmeleitpaste dünn, Schraube fest)', kW(v.soll.ck)], ['{sym:Rth_K} (Rippenkörper sehr groß, ohne Lüfter)', kW(v.soll.k)]])]; };
    const check = mk((r, a) => {
      const v = vals();
      [['tj', 'Sperrschichttemperatur', v.tj], ['tc', 'Gehäusetemperatur', v.tc], ['tk', 'Kühlkörpertemperatur', v.tk]].forEach(x => {
        const got = fieldNum(a, x[0]); let why = '';
        const ok = fin(got) && Math.abs(got - x[2]) <= 1 + 1e-9;
        if (!ok) why = fin(got) ? 'Dein Wert ' + fm(got) + ' °C weicht um mehr als 1 K vom Messwert der Startvorlage im Beharrungszustand ab. Miss, ohne etwas zu verstellen, und lies die Temperatur im Beharrungszustand ab.' : 'Trage hier eine Zahl ein (Komma oder Punkt).';
        r(ok, 'Gemessene ' + x[1] + ' (Toleranz ±1 K)', why);
      });
      choiceRow(r, 'Schuldiges Glied erkannt', choiceOf(a, 'glied'), v.glied, got => {
        const k = { jc: 'jc', ck: 'ck', k: 'k' }[got], nm = { jc: '{sym:Rth_JC}', ck: '{sym:Rth_CK}', k: '{sym:Rth_K}' }[got];
        return 'Berechne aus dem Temperaturabfall und der Verlustleistung den Wert des Gliedes: ' + nm + ' = ' + fm({ jc: v.dJC, ck: v.dCK, k: v.dK }[k], 1) + ' K / ' + fm(v.p, 3) + ' W = ' + fm(v.ist[k], 2) + ' K/W gegenüber dem Sollwert ' + fm(v.soll[k], 2) + ' K/W (das Verhältnis ist ' + fm(v.ratio[k], 2) + '). Das Glied mit dem größten Verhältnis ist schuld.';
      });
      choiceRow(r, 'Wirksame Abhilfe erkannt', choiceOf(a, 'abhilfe'), 'montage', got => (got === 'luefter'
        ? 'Mit Lüfter stark sinkt nur {sym:Rth_K} auf ' + kW(v.rthLuefter) + '; die Rechnung ergibt {sym:Tj} = ' + fm(v.tjLuefter, 1) + ' °C, das ist ' + (v.okLuefter ? 'unter' : 'über') + ' dem Grenzwert von ' + fm(v.tjMax) + ' °C.'
        : 'Die Rechnung ergibt mit sauberer Montage {sym:Tj} = ' + fm(v.tjMontage, 1) + ' °C, das ist ' + (v.okMontage ? 'unter' : 'über') + ' dem Grenzwert von ' + fm(v.tjMax) + ' °C.'));
    });
    return { FIX, START, sim, vals, fields, choices, tables, check,
      text() { const v = vals(); return 'Ein Netzteil mit dem Linearregler 7805 (' + fm(v.ue) + ' V Eingang, ' + fm(v.ia) + ' A Last, im Gerät ' + fm(v.ta) + ' °C) sitzt mit Glimmerscheibe auf einem Rippenkörper sehr groß. Der Kühlkörper ist nur lauwarm, die Sperrschicht aber über dem Grenzwert von ' + fm(v.tjMax) + ' °C. Die Sollwerte der Glieder stehen in der Tabelle.\nMiss {sym:Tj}, {sym:Tc} und {sym:Tk} im Beharrungszustand, ohne etwas am Aufbau zu verstellen, und trage die Werte ein. Berechne aus den Temperaturabfällen die Wärmewiderstände der Glieder, entscheide, welches Glied schuld ist, und wähle die wirksame Abhilfe.'; },
      hint() { const v = vals(); return [
        'Die Temperaturabfälle über den Gliedern sind {sym:dT} = P · Rth. Teile jeden Abfall durch die Verlustleistung, dann erhältst du den tatsächlichen Wärmewiderstand des Gliedes und kannst ihn mit dem Sollwert aus der Tabelle vergleichen. Das Glied, das am stärksten vom Sollwert abweicht, ist schuld.',
        'Messwerte im Beharrungszustand: {sym:Tj} = ' + fm(v.tj, 1) + ' °C, {sym:Tc} = ' + fm(v.tc, 1) + ' °C, {sym:Tk} = ' + fm(v.tk, 1) + ' °C bei P = ' + fm(v.p, 3) + ' W. Abfälle: ' + fm(v.dJC, 1) + ' K (Sperrschicht–Gehäuse), ' + fm(v.dCK, 1) + ' K (Gehäuse–Kühlkörper), ' + fm(v.dK, 1) + ' K (Kühlkörper–Umgebung).',
        'Musterlösung: {sym:Rth_JC} = ' + fm(v.ist.jc, 2) + ' K/W (Soll ' + fm(v.soll.jc, 2) + '), {sym:Rth_CK} = ' + fm(v.ist.ck, 2) + ' K/W (Soll ' + fm(v.soll.ck, 2) + '), {sym:Rth_K} = ' + fm(v.ist.k, 2) + ' K/W (Soll ' + fm(v.soll.k, 2) + '). Schuld ist der Übergang. Mit dünner Paste und fester Schraube wird {sym:Tj} = ' + fm(v.tjMontage, 1) + ' °C; ein Lüfter stark ergäbe nur ' + fm(v.tjLuefter, 1) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th27: Pruefungsaufgabe Netzteil mit Laengsregler */
  const M27 = (() => {
    const UE = 18, UA = 5, IA = 0.5, TA = 40, IDS = ['s', 'm', 'l', 'xl'], CFG = { device: '7805', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v27', () => {
      const C = CORE(), dev = C.devices['7805'], ck = rthCK('TO-220', 'glimmer', 'duenn'), p0 = C.power.linear(UE, UA, IA).p, pIq = C.power.linear(UE, UA, IA, dev.iq).p;
      const k0 = C.rthKerf(CFG, p0, TA), kIq = C.rthKerf(CFG, pIq, TA), kk = smallestSink(k0.value, IDS), kkIq = smallestSink(kIq.value, IDS);
      const st0 = kk ? C.steady(Object.assign({}, CFG, { heatsink: kk }), p0, TA) : null, stIq = kkIq ? C.steady(Object.assign({}, CFG, { heatsink: kkIq }), pIq, TA) : null;
      return { ue: UE, ua: UA, ia: IA, ta: TA, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, p: p0, pIq, pa: UA * IA, dT: dev.tjMax - TA, rthMax: k0.rthTotMax, erf: k0.value, erfIq: kIq.value, kk, kkIq, kkRth: kk ? hsRth(kk) : NaN, kkName: kk ? HSNAME[kk] : '', nextRth: hsRth('m'), tj: st0 ? st0.tj : NaN, tjIq: stIq ? stIq.tj : NaN, reserve: st0 ? dev.tjMax - st0.tj : NaN, eta: C.efficiency.linear(UE, UA, IA) * 100, etaIq: C.efficiency.linear(UE, UA, IA, dev.iq) * 100, iqmA: dev.iq * 1000, tolPv: 2, tolEta: 1 };
    });
    const items = () => { const v = vals(); return [
      { key: 'pv', label: 'Verlustleistung des Reglers', unit: 'W', want: v.p, alts: [v.pIq], tol: 0.02, mistakes: [[v.ue * v.ia, 'du die Eingangsleistung Ue · Ia gerechnet hast'], [v.pa, 'du die Ausgangsleistung Ua · Ia gerechnet hast']] },
      { key: 'rkerf', label: 'Erforderlicher Wärmewiderstand des Kühlkörpers', unit: 'K/W', want: v.erf, alts: [v.erfIq], tol: 0.02, mistakes: [
        [v.tjMax / v.p - v.rthJC - v.rthCK, 'du {sym:Ta} nicht von {sym:Tjmax} abgezogen hast'], [v.rthMax - v.rthCK, 'du {sym:Rth_JC} vergessen hast'], [v.rthMax - v.rthJC, 'du {sym:Rth_CK} vergessen hast'], [v.rthMax, 'du den größten Gesamt-Wärmewiderstand angegeben hast, ohne {sym:Rth_JC} und {sym:Rth_CK} abzuziehen']] },
      { key: 'tj', label: 'Sperrschichttemperatur mit dem gewählten Kühlkörper', unit: '°C', want: v.tj, alts: [v.tjIq], tol: 0.02, altsFor: a => chosenTj(a, [v.p, v.pIq], v.ta), mistakes: [[v.p * (v.rthJC + v.rthCK + v.kkRth), 'du {sym:Ta} nicht addiert hast'], [v.ta + v.p * (v.rthJC + v.kkRth), 'du {sym:Rth_CK} vergessen hast']] },
      { key: 'eta', label: 'Wirkungsgrad des Netzteils (Linearregler)', unit: '%', want: v.eta, alts: [v.etaIq], tol: 0.01, mistakes: [[v.eta / 100, 'du den Wirkungsgrad als Faktor statt in Prozent angegeben hast'], [v.ue / v.ua * 100, 'du Ue durch Ua geteilt hast (das Verhältnis steht falsch herum)']] }
    ]; };
    const fields = [{ key: 'pv', label: 'Verlustleistung des Reglers {sym:P}', unit: 'W' }, { key: 'rkerf', label: 'Erforderlicher Wärmewiderstand des Kühlkörpers {sym:Rth_Kerf}', unit: 'K/W' }, { key: 'tj', label: 'Sperrschichttemperatur {sym:Tj} mit dem gewählten Kühlkörper', unit: '°C' }, { key: 'eta', label: 'Wirkungsgrad η', unit: '%' }];
    const choices = () => [{ key: 'kk', q: 'Welchen Kühlkörper wählst du (den kleinsten, der reicht)?', options: sinkOptions(IDS) }];
    return { vals, items, fields, choices, ids: IDS,
      tables() { const v = vals(), C = CORE(); return [
        tbl('Bauteil 7805 (Übungsdatenblatt)', ['Größe', 'Wert'], [['{sym:Tjmax}', fm(v.tjMax) + ' °C'], ['{sym:Rth_JC}', kW(v.rthJC)]]),
        tbl('Übergang Gehäuse–Kühlkörper (TO-220)', ['Montage', '{sym:Rth_CK}'], [['direkt, Wärmeleitpaste dünn', kW(rthCK('TO-220', 'direkt', 'duenn'))], ['Glimmerscheibe, Wärmeleitpaste dünn', kW(C.mount.rthCK('TO-220', 'glimmer', 'duenn', 'fest'))], ['Glimmerscheibe ohne Wärmeleitpaste', kW(rthCK('TO-220', 'glimmer', 'keine'))]]),
        tbl('Kühlkörper (freie Konvektion, ohne Lüfter)', ['Typ', '{sym:Rth_K}'], IDS.map(id => [HSNAME[id], kW(hsRth(id))]))
      ]; },
      text() { const v = vals(); return 'Prüfungsaufgabe (fiktiv): Ein Messgerät hat ein Netzteil mit Längsregler 7805. Nach Trafo, Gleichrichter und Ladeelko stehen ' + fm(v.ue) + ' V zur Verfügung, der Regler liefert ' + fm(v.ua) + ' V bei ' + fm(v.ia) + ' A. Im Gerät herrschen ' + fm(v.ta) + ' °C. Der Regler wird mit Glimmerscheibe und Wärmeleitpaste auf einen Kühlkörper geschraubt. Alle Werte stehen in den Tabellen. Den Ruhestrom (' + fm(v.iqmA) + ' mA) darfst du vernachlässigen; rechnest du ihn mit, gelten die zweiten Werte.\nBerechne die Verlustleistung, den erforderlichen Wärmewiderstand des Kühlkörpers, wähle den kleinsten passenden Kühlkörper aus der Tabelle, kontrolliere damit die Sperrschichttemperatur und berechne den Wirkungsgrad.'; },
      hint() { const v = vals(); return [
        'Gehe wie in der Prüfung der Reihe nach vor: erst die Verlustleistung, dann der größte erlaubte Gesamt-Wärmewiderstand, davon {sym:Rth_JC} und {sym:Rth_CK} abziehen, aus der Tabelle den kleinsten Kühlkörper nehmen, dessen {sym:Rth_K} nicht größer ist als der erforderliche Wert, und zuletzt {sym:Tj} mit diesem Kühlkörper kontrollieren.',
        'P = (Ue − Ua) · Ia = (' + fm(v.ue) + ' V − ' + fm(v.ua) + ' V) · ' + fm(v.ia) + ' A = ' + fm(v.p) + ' W. Größter Gesamt-Wärmewiderstand: (' + fm(v.tjMax) + ' °C − ' + fm(v.ta) + ' °C) / ' + fm(v.p) + ' W = ' + fm(v.rthMax, 3) + ' K/W. Davon gehen {sym:Rth_JC} = ' + fm(v.rthJC) + ' K/W und {sym:Rth_CK} = ' + fm(v.rthCK) + ' K/W ab.',
        'Musterlösung: {sym:Rth_Kerf} = ' + fm(v.erf, 3) + ' K/W. Gewählt: ' + v.kkName + ' mit ' + fm(v.kkRth) + ' K/W (die nächstkleinere Größe hat ' + fm(v.nextRth) + ' K/W und reicht nicht). {sym:Tj} = ' + fm(v.ta) + ' °C + ' + fm(v.p) + ' W · (' + fm(v.rthJC) + ' + ' + fm(v.rthCK) + ' + ' + fm(v.kkRth) + ') K/W = ' + fm(v.tj, 1) + ' °C, Reserve ' + fm(v.reserve, 1) + ' K. Wirkungsgrad: η = Ua / Ue = ' + fm(v.eta, 2) + ' % (mit Ruhestrom ' + fm(v.etaIq, 2) + ' %).'
      ]; },
      extra(r, a) {
        const v = vals();
        choiceRow(r, 'Kleinsten passenden Kühlkörper gewählt', choiceOf(a, 'kk'), v.kk, got => {
          const rt = hsRth(got), small = rt <= v.erf + 1e-9;
          return 'Das Profil ' + (HSNAME[got] || got) + ' hat ' + kW(rt) + '. Erforderlich sind höchstens ' + kW(v.erf) + ': ' + (small ? 'Dieser Kühlkörper reicht, aber es gibt einen kleineren, der auch reicht.' : 'Dieser Kühlkörper reicht nicht.');
        });
      } };
  })();

  /* ====================================================================== th28: Pruefungsaufgabe Endstufe */
  const M28 = (() => {
    const UB = 15, RL = 8, TA = 40, N = 2, IDS = ['s', 'm', 'l', 'xl'], CFG = { device: 'bd139', heatsink: 'm', joint: 'glimmer', paste: 'duenn', count: 2 };
    const vals = () => once('v28', () => {
      const C = CORE(), dev = C.devices.bd139, ck = rthCK('TO-126', 'glimmer', 'duenn'), e = C.power.endstufe(UB, RL, 0.64), pm = e.pMax;
      const k = C.rthKerf(CFG, pm, TA), kk = smallestSink(k.value, IDS), par = kk ? C.parallelDevices(N, Object.assign({}, CFG, { heatsink: kk }), pm, TA) : null;
      return { ub: UB, rl: RL, ta: TA, n: N, tjMax: dev.tjMax, rthJC: dev.rthJC, rthCK: ck, pMax: pm, aMaxPct: e.aMax * 100, pTot: N * pm, dT: dev.tjMax - TA, rthMaxJe: k.rthTotMax, erf: k.value, kk, kkRth: kk ? hsRth(kk) : NaN, kkName: kk ? HSNAME[kk] : '', nextRth: hsRth('s'), tj: par ? par.tj : NaN, tk: par ? par.tk : NaN, reserve: par ? dev.tjMax - par.tj : NaN, erfEin: k.rthTotMax - dev.rthJC - ck, erfGes: (dev.tjMax - TA) / (N * pm) - dev.rthJC - ck, tjEin: kk ? C.steady(Object.assign({}, CFG, { heatsink: kk, count: 1 }), pm, TA).tj : NaN, ub2: UB * UB / RL, tol: 2 };
    });
    const items = () => { const v = vals(); return [
      { key: 'pmax', label: 'Größte Verlustleistung je Transistor', unit: 'W', want: v.pMax, tol: 0.02, mistakes: [[v.pTot, 'du beide Transistoren zusammengezählt hast (gefragt ist der Wert je Transistor)'], [v.ub2, 'du Ub² / RL ohne den Faktor π² gerechnet hast']] },
      { key: 'rkerf', label: 'Erforderlicher Wärmewiderstand des gemeinsamen Kühlkörpers', unit: 'K/W', want: v.erf, tol: 0.02, mistakes: [[v.erfEin, 'du nur einen Transistor auf dem Kühlkörper gerechnet hast (der Kühlkörper trägt die Summe beider Verlustleistungen)'], [v.erfGes, 'du mit der Gesamtleistung gerechnet hast, aber {sym:Rth_JC} und {sym:Rth_CK} vor dem Teilen durch ' + fm(v.n) + ' abgezogen hast (beide gehören zu jedem Transistor einzeln)']] },
      { key: 'tj', label: 'Sperrschichttemperatur jedes Transistors mit dem gewählten Kühlkörper', unit: '°C', want: v.tj, tol: 0.02, altsFor: a => chosenTj(a, [v.pMax], v.ta, v.n), mistakes: [[v.tjEin, 'du nur einen Transistor auf dem Kühlkörper gerechnet hast'], [v.n * v.pMax * v.kkRth + v.pMax * (v.rthJC + v.rthCK), 'du {sym:Ta} nicht addiert hast']] }
    ]; };
    const fields = [{ key: 'pmax', label: 'Größte Verlustleistung je Transistor {sym:P}', unit: 'W' }, { key: 'rkerf', label: 'Erforderlicher Wärmewiderstand des Kühlkörpers {sym:Rth_Kerf}', unit: 'K/W' }, { key: 'tj', label: 'Sperrschichttemperatur {sym:Tj} mit dem gewählten Kühlkörper', unit: '°C' }];
    const choices = () => [{ key: 'kk', q: 'Welchen Kühlkörper wählst du (den kleinsten, der reicht)?', options: sinkOptions(IDS) }];
    return { vals, items, fields, choices, ids: IDS,
      tables() { const v = vals(); return [
        tbl('Transistor BD139 (Übungsdatenblatt)', ['Größe', 'Wert'], [['{sym:Tjmax}', fm(v.tjMax) + ' °C'], ['{sym:Rth_JC} je Transistor', kW(v.rthJC)]]),
        tbl('Übergang je Transistor (TO-126)', ['Montage', '{sym:Rth_CK}'], [['Glimmerscheibe, Wärmeleitpaste dünn', kW(v.rthCK)]]),
        tbl('Kühlkörper (freie Konvektion, ohne Lüfter)', ['Typ', '{sym:Rth_K}'], IDS.map(id => [HSNAME[id], kW(hsRth(id))]))
      ]; },
      text() { const v = vals(); return 'Prüfungsaufgabe (fiktiv): Eine Endstufe im Gegentakt-B-Betrieb hat zwei gleiche Transistoren BD139 auf einem gemeinsamen Kühlkörper. Betriebsspannung Ub = ' + fm(v.ub) + ' V, Lastwiderstand RL = ' + fm(v.rl) + ' Ω, Umgebung im Gerät ' + fm(v.ta) + ' °C. Die Transistoren sind mit Glimmerscheibe und Wärmeleitpaste montiert. Die Werte stehen in den Tabellen; π rechnest du mit dem Taschenrechner.\nBerechne die größte Verlustleistung je Transistor (P_max = Ub² / (π² · RL)), den erforderlichen Wärmewiderstand des gemeinsamen Kühlkörpers, wähle den kleinsten passenden Kühlkörper und kontrolliere damit die Sperrschichttemperatur.'; },
      hint() { const v = vals(); return [
        'Im Gegentakt-B-Betrieb leitet jeder Transistor eine Halbwelle. Die größte Verlustleistung je Transistor tritt nicht bei voller Aussteuerung auf, sondern bei der Aussteuerung 2/π. Der gemeinsame Kühlkörper trägt die Summe beider Transistoren, {sym:Rth_JC} und {sym:Rth_CK} gehören aber zu jedem Transistor einzeln.',
        'P_max = Ub² / (π² · RL) = (' + fm(v.ub) + ' V)² / (π² · ' + fm(v.rl) + ' Ω) = ' + fm(v.pMax, 3) + ' W je Transistor. Für die Kette gilt {sym:Tj} = {sym:Ta} + n · P · {sym:Rth_K} + P · ({sym:Rth_JC} + {sym:Rth_CK}) mit n = ' + fm(v.n) + '. Setze {sym:Tj} = {sym:Tjmax} und löse nach {sym:Rth_K} auf: erst ' + fm(v.dT) + ' K / ' + fm(v.pMax, 3) + ' W = ' + fm(v.rthMaxJe, 3) + ' K/W, davon {sym:Rth_JC} und {sym:Rth_CK} abziehen, dann durch ' + fm(v.n) + ' teilen.',
        'Musterlösung: {sym:Rth_Kerf} = (' + fm(v.rthMaxJe, 3) + ' − ' + fm(v.rthJC) + ' − ' + fm(v.rthCK) + ') K/W / ' + fm(v.n) + ' = ' + fm(v.erf, 3) + ' K/W. Gewählt: ' + v.kkName + ' mit ' + fm(v.kkRth) + ' K/W (die nächstkleinere Größe hat ' + fm(v.nextRth) + ' K/W und reicht nicht). {sym:Tj} = ' + fm(v.tj, 1) + ' °C bei {sym:Tk} = ' + fm(v.tk, 1) + ' °C, Reserve ' + fm(v.reserve, 1) + ' K.'
      ]; },
      extra(r, a) {
        const v = vals();
        choiceRow(r, 'Kleinsten passenden Kühlkörper gewählt', choiceOf(a, 'kk'), v.kk, got => {
          const rt = hsRth(got), small = rt <= v.erf + 1e-9;
          return 'Das Profil ' + (HSNAME[got] || got) + ' hat ' + kW(rt) + '. Erforderlich sind höchstens ' + kW(v.erf) + ': ' + (small ? 'Dieser Kühlkörper reicht, aber es gibt einen kleineren, der auch reicht.' : 'Dieser Kühlkörper reicht nicht.');
        });
      } };
  })();

  /* ====================================================================== th29: Impuls und Zth (Vertiefung) */
  const M29 = (() => {
    const PPK = 100, TP = 0.001, T = 0.1, TA = 25, CFG = { device: 'irlz34n', heatsink: 'm', joint: 'glimmer', paste: 'duenn' };
    const vals = () => once('v29', () => {
      const C = CORE(), dev = C.devices.irlz34n, pj = C.pulseTj(CFG, PPK, TP, T, TA), st = C.steady(CFG, 1, TA);
      return { ppk: PPK, tpMs: TP * 1000, tMs: T * 1000, tpT: (TP + T) * 1000, d: pj.d, dPct: pj.d * 100, ta: TA, rthJC: dev.rthJC, rthCK: st.rthCK, rthK: st.rthK, rth: pj.rthTotal, zTp: pj.zthTp, zT: pj.zthT, zTpT: pj.zthTpT, tj: pj.tj, tjAvg: pj.tjAvg, pAvg: pj.pAvg, zSum: pj.zthTpT - pj.zthT + pj.zthTp, d1: 1 - pj.d, tjDauer: TA + PPK * pj.rthTotal, tjNurZ: TA + PPK * pj.zthTp, tjMax: dev.tjMax, tol: 5 };
    });
    const items = () => { const v = vals(); return [{ key: 'value', label: 'Spitzen-Sperrschichttemperatur', unit: '°C', want: v.tj, tol: 0.05, mistakes: [
      [v.tjAvg, 'du nur mit der mittleren Leistung ' + fm(v.pAvg) + ' W gerechnet hast (die Spitze liegt darüber)'], [v.tjDauer, 'du die Spitzenleistung als Dauerleistung angesetzt hast'], [v.tjNurZ, 'du nur Zth(tp) benutzt hast (die vorangegangenen Impulse fehlen)']] }]; };
    return { vals, items,
      tables() { const v = vals(); return [
        tbl('Thermische Impedanz des Aufbaus (IRLZ34N, Glimmerscheibe, Wärmeleitpaste, Profil mittel)', ['Zeit', 'Zth in K/W'], [[fm(v.tpMs) + ' ms (= tp)', fm(v.zTp, 4)], [fm(v.tMs) + ' ms (= T)', fm(v.zT, 4)], [fm(v.tpT) + ' ms (= tp + T)', fm(v.zTpT, 4)], ['Dauerbetrieb ({sym:Rth_ges})', fm(v.rth, 2)]])
      ]; },
      text() { const v = vals(); return 'Vertiefung: Ein IRLZ34N auf einem Kühlkörper (Aufbau und thermische Impedanz in der Tabelle) bekommt Leistungsimpulse von ' + fm(v.ppk) + ' W mit der Dauer tp = ' + fm(v.tpMs) + ' ms alle T = ' + fm(v.tMs) + ' ms (Tastverhältnis ' + fm(v.dPct) + ' %). Die Umgebung hat ' + fm(v.ta) + ' °C. Die Spitze der Sperrschichttemperatur im eingeschwungenen Zustand ist Tj = Ta + P_pk · [D · Rth_ges + (1 − D) · (Zth(tp + T) − Zth(T) + Zth(tp))], mit D = tp / T.\nBerechne die Spitzen-Sperrschichttemperatur.'; },
      hint() { const v = vals(); return [
        'Ein kurzer Impuls heizt die Sperrschicht nur wenig auf, weil die Wärmekapazität die Wärme zunächst aufnimmt. Das beschreibt Zth(t) für die Dauer tp. Hinzu kommt die Erwärmung durch alle vorangegangenen Impulse; sie steckt in den Zth-Werten der Periode und im Mittelwert D · Rth_ges.',
        'Tastverhältnis D = tp / T = ' + fm(v.tpMs) + ' ms / ' + fm(v.tMs) + ' ms = ' + fm(v.d, 3) + '. Setze Zth(tp) = ' + fm(v.zTp, 4) + ' K/W, Zth(T) = ' + fm(v.zT, 4) + ' K/W, Zth(tp + T) = ' + fm(v.zTpT, 4) + ' K/W und {sym:Rth_ges} = ' + fm(v.rth, 2) + ' K/W in die Formel ein.',
        'Musterlösung: Zth(tp + T) − Zth(T) + Zth(tp) = ' + fm(v.zSum, 4) + ' K/W. Spitze: {sym:Tj} = ' + fm(v.ta) + ' °C + ' + fm(v.ppk) + ' W · [' + fm(v.d, 3) + ' · ' + fm(v.rth, 2) + ' K/W + ' + fm(v.d1, 2) + ' · ' + fm(v.zSum, 4) + ' K/W] = ' + fm(v.tj, 1) + ' °C. Mit der mittleren Leistung ' + fm(v.pAvg) + ' W allein wären es nur ' + fm(v.tjAvg, 1) + ' °C.'
      ]; } };
  })();

  /* ====================================================================== th30: Meisterstueck */
  const M30 = (() => {
    const UE = 20, UA = 5, IA = 0.6, TA = 40, TJ_LIM = 100, TK_LIM = 70, RES = 1.25;   // Reserve 25 % auf den Aufwand der Musterloesung (SPEC 7, Stand 2026-10-20)
    const FIX = { device: '7805', loadMode: 'strom', ue: UE, iLoad: IA, iq: true, swVergleich: false, ta: TA, nonlin: false, ksPot: 'masse' };
    const START = { heatsink: 'none', joint: 'direkt', paste: 'duenn', bushing: true, screw: 'fest', fan: 'aus', orient: 'senkrecht' };
    const WL = ['heatsink', 'joint', 'paste', 'bushing', 'screw', 'fan', 'orient'];
    /* Aufwandspunkte (fiktive Tabelle): Kuehlkoerper, Isolierscheibe mit Buchse, Paste auftragen, Luefter */
    const AUFW = { heatsink: { none: 0, fahne: 1, s: 2, m: 3, l: 4, xl: 8 }, joint: { direkt: 0, glimmer: 2, silikon: 2 }, paste: { keine: 0, duenn: 1, dick: 1 }, fan: { aus: 0, leise: 2, mittel: 3, stark: 5 } };
    const aufwand = c => (c.heatsink in AUFW.heatsink && c.joint in AUFW.joint && c.paste in AUFW.paste && c.fan in AUFW.fan
      ? AUFW.heatsink[c.heatsink] + (c.heatsink === 'none' ? 0 : AUFW.joint[c.joint] + AUFW.paste[c.paste]) + (c.heatsink === 'none' ? 0 : AUFW.fan[c.fan]) : NaN);
    const sim = ctl => build('linear', Object.assign({}, FIX, START, ctl));
    /* alle Aufbauten der Tabelle durchrechnen (Kern, nicht Prüfstand): kleinster Aufwand, der beide Grenzen einhaelt */
    const best = () => once('b30', () => {
      const C = CORE(), p = C.power.linear(UE, UA, IA, C.devices['7805'].iq).p; let b = null, n = 0, nOk = 0;
      Object.keys(AUFW.heatsink).filter(h => h !== 'none').forEach(h => ['direkt', 'glimmer', 'silikon'].forEach(j => ['keine', 'duenn', 'dick'].forEach(pa => ['aus', 'leise', 'mittel', 'stark'].forEach(f => ['senkrecht', 'waagrecht'].forEach(o => {
        const c = { heatsink: h, joint: j, paste: pa, bushing: true, screw: 'fest', fan: f, orient: o }, s = C.steady(Object.assign({ device: '7805', ksPot: 'masse' }, c), p, TA); n++;
        if (s.tj <= TJ_LIM + 1e-9 && s.tk <= TK_LIM + 1e-9) { nOk++; const a = aufwand(c); if (!b || a < b.aufwand || (a === b.aufwand && s.tj < b.tj)) b = { cfg: c, aufwand: a, tj: s.tj, tk: s.tk, rthK: s.rthK, rthTotal: s.rthTotal }; }
      })))));
      return { p, best: b, n, nOk };
    });
    const vals = () => once('v30', () => {
      const C = CORE(), dev = C.devices['7805'], B = best(), b = B.best, ck0 = rthCK('TO-220', 'direkt', 'duenn'), ckG = rthCK('TO-220', 'glimmer', 'duenn'), max = Math.floor(RES * b.aufwand + 1e-9);
      const rthMax = (TJ_LIM - TA) / B.p;
      return { ue: UE, ua: UA, ia: IA, ta: TA, tjLim: TJ_LIM, tkLim: TK_LIM, p: B.p, rthJC: dev.rthJC, rthMax, ck: ck0, ckGlimmer: ckG, erfDirekt: rthMax - dev.rthJC - ck0, erfGlimmer: rthMax - dev.rthJC - ckG, rest: rthMax - dev.rthJC, rthKTk: (TK_LIM - TA) / B.p,
        muster: b.cfg, mAufwand: b.aufwand, mTj: b.tj, mTk: b.tk, mRthK: b.rthK, aMax: max, res: Math.round((RES - 1) * 100), mHs: HSNAME[b.cfg.heatsink], mFan: b.cfg.fan, nOk: B.nOk, n: B.n };
    });
    const tables = () => { const C = CORE(), v = vals(); return [
      tbl('Bauteil 7805 und Übergang (TO-220)', ['Größe', 'Wert', 'Aufwand'], [['{sym:Rth_JC}', kW(v.rthJC), '–'], ['Übergang direkt, Wärmeleitpaste dünn', kW(rthCK('TO-220', 'direkt', 'duenn')), fm(AUFW.joint.direkt + AUFW.paste.duenn)], ['Übergang Glimmerscheibe mit Buchse, Wärmeleitpaste dünn', kW(rthCK('TO-220', 'glimmer', 'duenn')), fm(AUFW.joint.glimmer + AUFW.paste.duenn)], ['Übergang ohne Wärmeleitpaste (je Montage mehr)', 'siehe Prüfstand', '0']]),
      tbl('Kühlkörper (freie Konvektion, senkrecht)', ['Typ', '{sym:Rth_K}', 'Aufwand'], ['fahne', 's', 'm', 'l', 'xl'].map(id => [HSNAME[id], kW(hsRth(id)), fm(AUFW.heatsink[id])])),
      tbl('Lüfter und Einbaulage (Faktor auf {sym:Rth_K})', ['Zusatz', 'Faktor', 'Aufwand'], [['Lüfter leise', fm(C.fan.leise, 2), fm(AUFW.fan.leise)], ['Lüfter mittel', fm(C.fan.mittel, 2), fm(AUFW.fan.mittel)], ['Lüfter stark', fm(C.fan.stark, 2), fm(AUFW.fan.stark)], ['Einbaulage waagrecht', fm(C.orient.waagrecht, 2), '0']])
    ]; };
    const check = mk((r, a) => {
      const v = vals(), p = pick(a, 'linear', WL), eff = Object.assign({}, START, p.controls), s = sim(p.controls);
      inputRow(r, p.problems, s, a, 'linear');
      const tj = s.steady && s.steady.tj, tk = s.steady && s.steady.tk, okTj = fin(tj) && tj <= v.tjLim + 1e-9, okTk = fin(tk) && tk <= v.tkLim + 1e-9;
      r(okTj, '{sym:Tj} bleibt im Beharrungszustand höchstens ' + fm(v.tjLim) + ' °C', 'Im Beharrungszustand beträgt {sym:Tj} ' + fm(tj, 1) + ' °C bei ' + fm(s.steady.pv, 2) + ' W: {sym:Rth_ges} = ' + kW(s.chain.rthJC) + ' + ' + kW(s.chain.rthCK) + ' + ' + kW(s.chain.rthK) + ' = ' + kW(s.chain.rthTotal) + ', erlaubt sind höchstens ' + kW(v.rthMax) + '. Verkleinere {sym:Rth_CK} oder {sym:Rth_K}; {sym:Rth_JC} bleibt.');
      r(okTk, '{sym:Tk} bleibt im Beharrungszustand höchstens ' + fm(v.tkLim) + ' °C (Übungsvorgabe)', 'Der Kühlkörper erreicht ' + fm(tk, 1) + ' °C, erlaubt sind höchstens ' + fm(v.tkLim) + ' °C. Verkleinere {sym:Rth_K} (größerer Kühlkörper, Lüfter).');
      r(s.ok && !s.st.short, 'Der Aufbau hat keinen Kurzschluss', 'Der Prüfstand meldet einen Kurzschluss zwischen Fahne und Kühlkörper.');
      const aw = aufwand(eff), listed = fin(aw);
      let why = '';
      if (!listed) why = 'Dieser Kühlkörper steht nicht in der Aufwandstabelle (das Kühlblech ist hier nicht vorgesehen).';
      else if (!(okTj && okTk)) why = 'Der Aufwand zählt erst, wenn beide Grenzen eingehalten sind (Sperrschichttemperatur ' + fm(tj, 1) + ' °C, Kühlkörpertemperatur ' + fm(tk, 1) + ' °C).';
      else why = 'Dein Aufbau kostet ' + fm(aw) + ' Aufwandspunkte, erlaubt sind höchstens ' + fm(v.aMax) + '. Es gibt einen Aufbau mit weniger Aufwand, der beide Grenzen einhält.';
      r(listed && okTj && okTk && aw <= v.aMax, 'Beide Grenzen gehalten und der Aufwand beträgt höchstens ' + fm(v.aMax) + ' Punkte', why);
    });
    return { FIX, START, WL, AUFW, aufwand, sim, best, vals, tables, check, RES, TJ_LIM, TK_LIM,
      text() { const v = vals(); return 'Meisterstück: Ein Linearregler 7805 setzt ' + fm(v.ue) + ' V Eingangsspannung auf ' + fm(v.ua) + ' V um und liefert ' + fm(v.ia) + ' A (der Prüfstand rechnet den Ruhestrom mit: Der Regler setzt ' + fm(v.p, 2) + ' W um). Im Gerät herrschen ' + fm(v.ta) + ' °C. Die Fahne des 7805 liegt an Gerätemasse und der Kühlkörper ebenfalls.\nBaue den Aufbau (Kühlkörper, Übergang, Wärmeleitpaste, Lüfter, Einbaulage) so, dass die Sperrschichttemperatur im Beharrungszustand höchstens ' + fm(v.tjLim) + ' °C und die Kühlkörpertemperatur höchstens ' + fm(v.tkLim) + ' °C erreicht (Übungsvorgabe, kein Normwert). Der Aufwand soll möglichst klein bleiben: Aufwandspunkte laut Tabelle (fiktiv). Gültig ist ein Aufbau mit beiden Grenzen und höchstens ' + fm(v.aMax) + ' Aufwandspunkten.'; },
      hint() { const v = vals(); return [
        'Rechne zuerst, welchen Gesamt-Wärmewiderstand du höchstens haben darfst, und ziehe davon die Glieder ab, die du nicht ändern kannst. {sym:Rth_JC} steht fest; beim Übergang und beim Kühlkörper entscheidest du. Die Isolierscheibe kostet Wärmeleitung und Aufwand: Prüfe, ob sie bei diesem Regler nötig ist.',
        'Größter Gesamt-Wärmewiderstand: (' + fm(v.tjLim) + ' °C − ' + fm(v.ta) + ' °C) / ' + fm(v.p, 2) + ' W = ' + fm(v.rthMax, 3) + ' K/W. Mit {sym:Rth_JC} = ' + fm(v.rthJC) + ' K/W bleiben für Übergang und Kühlkörper ' + fm(v.rest, 3) + ' K/W. Direkt montiert mit dünner Paste ({sym:Rth_CK} = ' + fm(v.ck) + ' K/W) darf {sym:Rth_K} höchstens ' + fm(v.erfDirekt, 3) + ' K/W haben; mit Glimmerscheibe ({sym:Rth_CK} = ' + fm(v.ckGlimmer) + ' K/W) wäre das Ergebnis ' + fm(v.erfGlimmer, 3) + ' K/W: Das geht nicht. Die Grenze für den Kühlkörper ist {sym:Rth_K} ≤ ' + fm(v.rthKTk, 3) + ' K/W.',
        'Musterlösung: ' + v.mHs + ', direkt montiert mit dünner Wärmeleitpaste, Lüfter ' + v.mFan + '. {sym:Rth_K} wird ' + fm(v.mRthK, 3) + ' K/W, {sym:Tj} = ' + fm(v.mTj, 1) + ' °C, {sym:Tk} = ' + fm(v.mTk, 1) + ' °C, Aufwand ' + fm(v.mAufwand) + ' Punkte. Erlaubt sind ' + fm(v.aMax) + ' Punkte (Musterwert plus ' + fm(v.res) + ' %).'
      ]; } };
  })();

  /* ====================================================================== Aufgabenliste */
  /* text, table und hint werden erst beim ersten Zugriff gerechnet (Kern und Pruefstaende), danach gemerkt */
  const L = (t, M) => {
    let tx = null, hi = null, tb = null;
    Object.defineProperty(t, 'text', { enumerable: true, configurable: true, get() { if (tx === null) { try { tx = M.text(); } catch (e) { return 'Der Aufgabentext konnte nicht berechnet werden (THM_CORE und die Prüfstände müssen geladen sein).'; } } return tx; } });
    Object.defineProperty(t, 'hint', { enumerable: true, configurable: true, get() { if (hi === null) { try { hi = M.hint(); } catch (e) { return ['Tipp nicht verfügbar.', 'Tipp nicht verfügbar.', 'Tipp nicht verfügbar.']; } } return hi; } });
    if (typeof M.tables === 'function') Object.defineProperty(t, 'table', { enumerable: true, configurable: true, get() { if (tb === null) { try { tb = M.tables(); } catch (e) { return []; } } return tb; } });
    if (M.choices) Object.defineProperty(t, 'choices', { enumerable: true, configurable: true, get() { return typeof M.choices === 'function' ? M.choices() : M.choices; } });
    return t;
  };
  /* verschachtelte Werte (z. B. Ist-/Sollwerte je Glied) zu einer flachen Liste, damit das Hinweiszahlen-Audit sie findet */
  const flatVals = o => { const out = Object.assign({}, o); (function w(x, pre) { Object.keys(x).forEach(k => { if (isObj(x[k])) w(x[k], pre + k + '_'); else if (isObj(o[k]) || pre) out[pre + k] = x[k]; }); })(o, ''); return out; };
  const noV = keys => keys.reduce((o, k) => { o[k] = null; return o; }, {});
  const tasks = [
    L({ id: 'th16', lab: 'thm', cat: 'Praxis', title: 'Linearregler gegen Schaltregler: Wirkungsgrad und Verlustleistung', level: 2, rig: 'linear',
      fields: M16.fields,
      start: () => S('linear', M16.ctl(false), { settle: true, fields: noV(['eta', 'pvsw']) }),
      sol: () => { const v = M16.vals(); return S('linear', M16.ctl(true), { settle: true, fields: { eta: v.etaN, pvsw: v.pvSw } }); },
      check: calcCheck(M16), hintVals: () => M16.vals() }, M16),
    L({ id: 'th17', lab: 'thm', cat: 'Kühlkörper wählen', title: 'Erforderlichen Kühlkörper für den BD139 berechnen', level: 2, rig: 'transistor',
      ask: { label: 'Erforderlicher Wärmewiderstand {sym:Rth_Kerf}', unit: 'K/W' },
      start: () => S('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 1, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, value: null }),
      sol: () => S('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 1, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, value: M17.vals().erf }),
      check: calcCheck(M17), hintVals: () => M17.vals() }, M17),
    L({ id: 'th18', lab: 'thm', cat: 'Wärmekette', title: 'Zwei Transistoren auf einem Kühlkörper', level: 2, rig: 'transistor',
      ask: { label: 'Sperrschichttemperatur {sym:Tj} jedes Transistors', unit: '°C' },
      start: () => S('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 1, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, value: null }),
      sol: () => S('transistor', { mode: 'ap', uce: 6, ic: 0.3, count: 2, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, value: M18.vals().tj }),
      check: calcCheck(M18), hintVals: () => M18.vals() }, M18),
    L({ id: 'th19', lab: 'thm', cat: 'Schalter', title: 'MOSFET im Dauerbetrieb: Verlustleistung und Sperrschichttemperatur', level: 2, rig: 'mosfet',
      fields: M19.fields,
      start: () => S('mosfet', { id: 10, u: 5, duty: 100, vgs: 5, spec: 'typ', hot: false, pulse: false, ta: 25, heatsink: 'l', joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: noV(['p', 'tj']) }),
      sol: () => { const v = M19.vals(); return S('mosfet', { id: 10, u: 5, duty: 100, vgs: 5, spec: 'typ', hot: false, pulse: false, ta: 25, heatsink: 'l', joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: { p: v.p, tj: v.tj } }); },
      check: calcCheck(M19), hintVals: () => M19.vals() }, M19),
    L({ id: 'th20', lab: 'thm', cat: 'Schalter', title: 'MOSFET im PWM-Betrieb: Schaltverluste', level: 2, rig: 'mosfet',
      fields: M20.fields,
      start: () => S('mosfet', { id: 10, u: 24, duty: 50, f: 20000, vgs: 5, spec: 'typ', hot: false, pulse: false, ta: 25, heatsink: 'l', joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: noV(['psw', 'pges']) }),
      sol: () => { const v = M20.vals(); return S('mosfet', { id: 10, u: 24, duty: 50, f: 20000, vgs: 5, spec: 'typ', hot: false, pulse: false, ta: 25, heatsink: 'l', joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: { psw: v.pSw, pges: v.pTot } }); },
      check: calcCheck(M20), hintVals: () => M20.vals() }, M20),
    L({ id: 'th21', lab: 'thm', cat: 'Schalter', title: 'Thermische Mitkopplung: Grenze des Wärmewiderstands', level: 3, rig: 'mosfet',
      ask: { label: 'Kritischer Gesamt-Wärmewiderstand', unit: 'K/W' },
      start: () => S('mosfet', { id: 18, u: 5, duty: 100, vgs: 5, spec: 'typ', hot: true, pulse: false, ta: 25, heatsink: 's', joint: 'glimmer', paste: 'duenn' }, { value: null }),
      sol: () => S('mosfet', { id: 18, u: 5, duty: 100, vgs: 5, spec: 'typ', hot: true, pulse: false, ta: 25, heatsink: 's', joint: 'glimmer', paste: 'duenn' }, { value: M21.vals().crit }),
      check: calcCheck(M21), hintVals: () => M21.vals() }, M21),
    L({ id: 'th22', lab: 'thm', cat: 'Bauteile', title: 'Diode am Ladeelko: Ist die Sperrschichttemperatur zulässig?', level: 2, rig: 'bauteil',
      ask: { label: 'Sperrschichttemperatur {sym:Tj} bei Gleichstrom', unit: '°C' },
      start: () => S('bauteil', { device: 'diode', iF: 1, ff: 1, ta: 60 }, { settle: true, value: null, choices: {} }),
      sol: () => { const v = M22.vals(); return S('bauteil', { device: 'diode', iF: 1, ff: 1, ta: 60 }, { settle: true, value: v.tj, choices: { ok: v.ok ? 'ja' : 'nein', elko: v.okEl ? 'ja' : 'nein' } }); },
      check: calcCheck(M22), hintVals: () => M22.vals() }, M22),
    L({ id: 'th23', lab: 'thm', cat: 'Bauteile', title: 'Zementwiderstand: Wert für halbe Nennleistung wählen', level: 2, rig: 'bauteil',
      fields: M23.fields,
      start: () => S('bauteil', { device: 'rzement', uR: 12, rR: 47 }, { settle: true, fields: noV(['rmin', 'e12']) }),
      sol: () => { const v = M23.vals(); return S('bauteil', { device: 'rzement', uR: 12, rR: v.e12 }, { settle: true, fields: { rmin: v.rmin, e12: v.e12 } }); },
      check: calcCheck(M23), hintVals: () => M23.vals() }, M23),
    L({ id: 'th24', lab: 'thm', cat: 'Bauteile', title: 'LED-Treiber: Vorwiderstand gegen LM317-Stromquelle', level: 2, rig: 'bauteil',
      fields: M24.fields,
      start: () => S('bauteil', { device: 'led', driver: 'vorwiderstand', n: 3, ub: 24, iLed: 0.7, heatsink: 'm', joint: 'direkt', paste: 'duenn' }, { settle: true, fields: noV(['pvw', 'pcc']), choices: {} }),
      sol: () => { const v = M24.vals(); return S('bauteil', { device: 'led', driver: 'lm317cc', n: 3, ub: 24, iLed: 0.7, heatsink: 'm', joint: 'direkt', paste: 'duenn' }, { settle: true, fields: { pvw: v.pVw, pcc: v.pCC }, choices: { mehr: v.gleich ? 'gleich' : (v.pVw > v.pCC ? 'vw' : 'cc') } }); },
      check: calcCheck(M24), hintVals: () => M24.vals() }, M24),
    L({ id: 'th25', lab: 'thm', cat: 'Fehlersuche', title: 'Fehlersuche: Das Gerät wird zu heiß', level: 2, rig: 'linear',
      start: () => S('linear', Object.assign({}, M25.FIX, M25.START), { settle: true, choices: {} }),
      sol: () => S('linear', Object.assign({}, M25.FIX, M25.MUSTER), { settle: true, choices: { fehler: 'paste' } }),
      check: M25.check, hintVals: () => M25.vals() }, M25),
    L({ id: 'th26', lab: 'thm', cat: 'Fehlersuche', title: 'Fehlersuche: Der Kühlkörper ist lauwarm, die Sperrschicht zu heiß', level: 3, rig: 'linear',
      fields: M26.fields,
      start: () => S('linear', Object.assign({}, M26.FIX, M26.START), { settle: true, fields: noV(['tj', 'tc', 'tk']), choices: {} }),
      sol: () => { const v = M26.vals(); return S('linear', Object.assign({}, M26.FIX, M26.START), { settle: true, fields: { tj: v.tj, tc: v.tc, tk: v.tk }, choices: { glied: v.glied, abhilfe: 'montage' } }); },
      check: M26.check, hintVals: () => flatVals(M26.vals()) }, M26),
    L({ id: 'th27', lab: 'thm', cat: 'Prüfungsstil', title: 'Prüfungsaufgabe: Netzteil mit Längsregler', level: 3, rig: 'linear',
      fields: M27.fields,
      start: () => S('linear', { device: '7805', loadMode: 'strom', ue: 18, iLoad: 0.5, iq: true, ta: 40, heatsink: 'none' }, { settle: true, fields: noV(['pv', 'rkerf', 'tj', 'eta']), choices: {} }),
      sol: () => { const v = M27.vals(); return S('linear', { device: '7805', loadMode: 'strom', ue: 18, iLoad: 0.5, iq: true, ta: 40, heatsink: v.kk, joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: { pv: v.p, rkerf: v.erf, tj: v.tj, eta: v.eta }, choices: { kk: v.kk } }); },
      check: calcCheck(M27), hintVals: () => M27.vals() }, M27),
    L({ id: 'th28', lab: 'thm', cat: 'Prüfungsstil', title: 'Prüfungsaufgabe: Endstufe mit zwei Transistoren', level: 3, rig: 'transistor',
      fields: M28.fields,
      start: () => S('transistor', { mode: 'endstufe', ub: 15, rl: 8, aus: 64, count: 2, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: noV(['pmax', 'rkerf', 'tj']), choices: {} }),
      sol: () => { const v = M28.vals(); return S('transistor', { mode: 'endstufe', ub: 15, rl: 8, aus: 64, count: 2, ta: 40, heatsink: v.kk, joint: 'glimmer', paste: 'duenn' }, { settle: true, fields: { pmax: v.pMax, rkerf: v.erf, tj: v.tj }, choices: { kk: v.kk } }); },
      check: calcCheck(M28), hintVals: () => M28.vals() }, M28),
    L({ id: 'th29', lab: 'thm', cat: 'Praxis', title: 'Impulsbelastung: Spitzen-Sperrschichttemperatur', level: 3, rig: 'mosfet',
      ask: { label: 'Spitzen-Sperrschichttemperatur {sym:Tj}', unit: '°C' },
      start: () => S('mosfet', { pulse: true, tp: 0.001, T: 0.1, ta: 25, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { value: null }),
      sol: () => S('mosfet', { pulse: true, tp: 0.001, T: 0.1, ta: 25, heatsink: 'm', joint: 'glimmer', paste: 'duenn' }, { value: M29.vals().tj }),
      check: calcCheck(M29), hintVals: () => M29.vals() }, M29),
    L({ id: 'th30', lab: 'thm', cat: 'Prüfungsstil', title: 'Meisterstück: Linearregler mit möglichst wenig Aufwand kühlen', level: 3, rig: 'linear',
      start: () => S('linear', Object.assign({}, M30.FIX, M30.START), { settle: true }),
      sol: () => S('linear', Object.assign({}, M30.FIX, M30.START, M30.vals().muster), { settle: true }),
      check: M30.check, hintVals: () => M30.vals() }, M30)
  ];

  /* ====================================================================== Registrierung */
  const answerOf = (task, o) => {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, kennwerte: o.kennwerte || null };
  };
  const idNum = id => parseInt(String(id).replace(/\D/g, ''), 10) || 0;
  const T = root.THM_TASKS = root.THM_TASKS || {
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
  const api = { tasks, answerOf, models: { M16, M17, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30 }, helpers: { numRow, fm, pick, build, aufwand: M30.aufwand } };
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
