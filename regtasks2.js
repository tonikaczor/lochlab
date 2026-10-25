/* regtasks2.js - Regelungstechnik-Lab: Aufgaben rg16 bis rg30 mit automatischer Prüfung (Simulation, ohne Browser lauffähig)
 * Registrierung: REG_TASKS.register([ ... ]) (REG_TASKS kommt aus regdata.js; fehlt es, legt diese Datei ein gleichwertiges Gerüst an).
 * Format je Aufgabe: { id, lab:'reg', cat, title, level, rig, text, hint[3], start(), sol(), check(answer), hintVals(), ask? | fields? | choices? }
 *   start() und sol() liefern { rig, controls, op?, seq?, dur?, value?, fields?, choices? } (seq im runSeq-Format: [{t(s), set|ramp}], dur in s).
 *   answer = { rig, controls, seq, rows, dur, state, simTime, value, text, fields:{key:Zahl|null}, choices:{key:Wert}, kennwerte, op }.
 *   check(answer) liefert eine Liste [{ ok, text, why }]; Prozent der Treffer = Ergebnis (Start < 100, Musterlösung = 100).
 * Regeln (SPEC Abschnitt 7 und 9):
 *   - Schwellwerte stammen aus der simulierten Musterlösung (MUSTER, Reserve 25 % bei Zeiten, 3 Prozentpunkte bei Überschwingen); keine geschätzten Zahlen.
 *   - Jede Zahl in text, hint[1], hint[2] kommt aus hintVals() (dieselbe Simulation wie die Prüfung); text und hint werden erst beim ersten Zugriff gerechnet.
 *   - Prüfmeldungen (why) behaupten nur, was in der Prüfung verglichen wurde. Die Kenngrößen messen die Zahlen aus REG_CORE.runSeq.
 *   - Geprüft werden nur die freigegebenen Steuerwerte der Aufgabe (WL); alles andere setzt die Prüfung selbst (FIX), damit gleiche Eingaben gleiche Ergebnisse liefern.
 * Benötigt: regcore.js, die sieben Prüfstände (regrig-*.js). */
(function (root) {
  'use strict';
  const CORE = () => root.REG_CORE, RIGS = () => root.REG_RIGS;
  const isObj = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const fin = x => typeof x === 'number' && isFinite(x);
  const clone = o => JSON.parse(JSON.stringify(o));
  const fm = (x, d) => { const C = CORE(); if (C && C.fmt) return C.fmt(x, d); return fin(x) ? (+x).toFixed(d == null ? 1 : d).replace('.', ',') : '–'; };
  const fmT = (s, u) => { const C = CORE(); return C && C.fmtTime ? C.fmtTime(s, u) : fm(s, 1) + ' s'; };
  const toNum = v => {
    if (typeof v === 'number') return fin(v) ? v : NaN;
    if (typeof v === 'string' && v.trim() !== '') { const C = CORE(); return C && C.parseNum ? C.parseNum(v) : parseFloat(v.replace(/\s/g, '').replace(',', '.')); }
    return NaN;
  };
  const memo = {};
  const once = (k, f) => (k in memo ? memo[k] : (memo[k] = f()));

  /* ====================================================================== Eingabe prüfen und aufbereiten */
  const ctlDefs = id => { const R = RIGS(); const d = R && R.defs && R.defs[id]; return d && Array.isArray(d.controls) ? d.controls : []; };
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
  /* freigegebene Steuerwerte aus der Antwort übernehmen (Rest ignoriert); problems = verständliche Texte für ungültige Werte */
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
  function mkRig(id, controls) {
    const rig = RIGS().create(id, { noDraw: true });
    const first = ['device', 'type', 'char', 'ctrl', 'mode'], c = controls || {};
    first.concat(Object.keys(c).filter(k => !first.includes(k))).forEach(k => { if (k in c) rig.setControl(k, c[k]); });
    return rig;
  }
  /* Prüfung: fn(r, a) füllt die Zeilen; wirft nie */
  function mk(fn) {
    return function (a) {
      try {
        const rows = [], r = (cond, text, why) => { rows.push({ ok: !!cond, text, why: cond ? '' : (why || '') }); };
        fn(r, isObj(a) ? a : {});
        return rows;
      } catch (e) { return [{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]; }
    };
  }
  function inputRow(r, problems, sim) {
    const errs = problems.slice();
    if (sim && sim.errors) sim.errors.forEach(e => errs.push(String(e)));
    if (sim && sim.rejected && sim.rejected.length) errs.push('Die Anlage hat Werte abgelehnt: ' + sim.rejected.map(x => x.key).join(', ') + '.');
    r(errs.length === 0, 'Die Eingaben sind gültig und die Anlage läuft ohne Fehlermeldung', errs.join(' '));
  }
  function run(rig, seq, T, controls, o) {
    return CORE().runSeq(rig, seq, T, Object.assign({ controls: controls || {}, sampleS: 0.05, seed: 1 }, o || {}));
  }
  const stepOf = r => (r && r.metrics && r.metrics.step && r.metrics.step.ok ? r.metrics.step : null);
  const sampleAt = (r, t) => { const s = r.samples; for (let i = 0; i < s.length; i++) if (s[i].t >= t - 1e-9) return s[i]; return s[s.length - 1] || { t: 0, x: NaN, y: NaN, e: NaN, state: {} }; };
  const win = (r, t0, t1) => r.samples.filter(s => s.t >= t0 - 1e-9 && s.t <= t1 + 1e-9);
  const stdev = a => { const C = CORE(); return C && C.stdev ? C.stdev(a) : NaN; };
  const clsOf = (C, ts, xs, range) => { const o = C.oscillation(ts, xs, { range }); return o && o.ok !== false ? o : { cls: 'aperiodisch' }; };
  const badCls = c => c === 'dauerschwingung' || c === 'aufschaukelnd';
  const clsText = c => (c === 'dauerschwingung' ? 'eine Dauerschwingung' : c === 'aufschaukelnd' ? 'eine aufschaukelnde Schwingung' : c === 'gedaempft' ? 'eine abklingende Schwingung' : 'keine Schwingung');
  /* Schwelle auf das Raster der Anzeige aufrunden: Text und Prüfung benutzen denselben Wert */
  const niceUp = (x, step) => Math.ceil(x / step - 1e-9) * step;
  /* längste lückenlose Folge von Gitterwerten, für die fn(x) wahr ist: [von, bis] (null, null ohne Treffer); alle Werte dazwischen sind geprüft.
   * Bricht ab, sobald eine Folge von mindestens drei Treffern endet (spart Rechenzeit; die Fenster der Aufgaben sind zusammenhängend). */
  function scanRange(fn, lo, hi, step) {
    let best = [null, null], bestN = 0, a = null, b = null, n = 0;
    for (let x = lo; x <= hi + 1e-9; x += step) {
      const v = Math.round(x / step) * step;
      if (fn(v)) { if (a === null) { a = v; n = 0; } b = v; n++; if (n > bestN) { bestN = n; best = [a, b]; } } else { if (n >= 3) break; a = null; n = 0; }
    }
    return best;
  }
  /* Werte, die erst beim ersten Lesen gerechnet werden (Simulation): Aufgabentext bleibt schnell, die Tipps rechnen bei Bedarf */
  function mkVals(cheap, thunks) {
    Object.keys(thunks).forEach(k => { let v, d = false; Object.defineProperty(cheap, k, { enumerable: true, configurable: true, get() { if (!d) { v = thunks[k](); d = true; } return v; } }); });
    return cheap;
  }
  /* Zahl prüfen: v = Zahl oder null, want = Sollwert, tol = relative Toleranz, mistakes = [[Wert, Text], ...] (typische Fehler) */
  function numRow(r, label, v, want, tol, mistakes) {
    if (!fin(v)) { r(false, label, 'Trage hier eine Zahl ein (Komma oder Punkt).'); return false; }
    const ok = Math.abs(v - want) <= tol * Math.abs(want);
    let why = '';
    if (!ok) {
      const hit = (mistakes || []).find(m => fin(m[0]) && m[0] !== 0 && Math.abs(v - m[0]) <= 0.05 * Math.abs(m[0]));
      why = hit ? hit[1] : 'Dein Wert ' + fm(v, 3) + ' ist ' + (v < want ? 'zu klein' : 'zu groß') + '. Rechne mit den Formeln aus dem Tipp noch einmal nach und achte auf die Einheit.';
    }
    r(ok, label + ' (Toleranz ' + fm(tol * 100, 0) + ' %)', why);
    return ok;
  }
  const answerNum = a => { if (!isObj(a)) return null; if (fin(a.value)) return a.value; const x = toNum(a.text); return fin(x) ? x : (typeof a.value === 'string' ? (fin(toNum(a.value)) ? toNum(a.value) : null) : null); };
  const fieldNum = (a, k) => (isObj(a) && isObj(a.fields) && fin(a.fields[k]) ? a.fields[k] : null);
  const choiceOf = (a, k) => (isObj(a) && isObj(a.choices) ? a.choices[k] : undefined);
  const S = (rig, controls, extra) => Object.assign({ rig, controls }, extra || {});

  /* ====================================================================== rg16: Lageregelung mit PD */
  const M16 = (() => {
    const W0 = 20, W1 = 60, T0 = 2, TEND = 12, UEB = 5, RES = 1.25;
    const FIX = { mode: 'auto', w: W0, friction: 0, backlash: 0, z: 0, noise: 0, wRamp: 0 };
    const START = { ctrl: 'P', dir: 'direkt', kp: 10, tn: 2, tv: 0, u0: 50, aw: 'rueck', ymax: 100, ta: 0.002 };
    const MUSTER = Object.assign({}, START, { ctrl: 'PD', kp: 10, tv: 0.15 });
    const WL = Object.keys(START);
    function sim(ctl) {
      const r = run('position', [{ t: T0, set: { w: W1 } }], TEND, Object.assign({}, START, ctl, FIX), { sampleS: 0.01 });
      const m = stepOf(r);
      return { r, m, ueber: m ? m.ueberPct : NaN, tAus2: m && fin(m.tAus2) ? m.tAus2 : null, why2: m ? m.tAus2Why : 'Der Sollwertsprung wurde nicht erkannt.', cls: m && m.cls ? m.cls.cls : 'aperiodisch' };
    }
    const muster = () => once('m16', () => sim(MUSTER));
    const tMax = () => niceUp(RES * muster().tAus2, 0.1);
    const good = s => s.m && !badCls(s.cls) && s.ueber <= UEB && s.tAus2 !== null && s.tAus2 <= tMax();
    const base = () => ({ w0: W0, w1: W1, uMax: UEB, aMax: tMax(), tol: 2 });
    function vals() {
      return once('v16', () => {
        const s = sim(START), m = muster();
        const w = () => once('w16', () => scanRange(tv => good(sim(Object.assign({}, MUSTER, { tv }))), 0.01, 0.5, 0.01));
        const best = () => once('p16', () => scanRange(kp => { const q = sim(Object.assign({}, START, { kp })); return q.m && q.ueber <= UEB && q.tAus2 !== null && q.tAus2 <= tMax(); }, 0.5, 40, 0.5));
        const pid = { ctrl: 'PID', kp: MUSTER.kp, tn: 10, tv: MUSTER.tv };
        const pidK = () => good(sim(Object.assign({}, pid, { aw: 'klemmen' }))), pidR = () => good(sim(Object.assign({}, pid, { aw: 'rueck' })));
        return mkVals({ w0: W0, w1: W1, kp: MUSTER.kp, tvMuster: MUSTER.tv, uStart: s.ueber, aStart: s.tAus2, uMax: UEB, aMax: tMax(), uMuster: m.ueber, aMuster: m.tAus2, tol: 2, tvStep: 0.01, tnPid: 10 },
          { tvLo: () => w()[0], tvHi: () => w()[1], pLo: () => best()[0], pHi: () => best()[1], pidOkKlemmen: pidK, pidOkRueck: pidR });
      });
    }
    return { W0, W1, T0, START, MUSTER, WL, FIX, sim, muster, tMax, vals, base, good, UEB,
      text() { const v = vals(); return 'Die Spindelachse (Übungsanlage) soll von ' + fm(v.w0, 0) + ' mm auf ' + fm(v.w1, 0) + ' mm fahren (Sollwertsprung). Der P-Regler der Startvorlage (Kp = ' + fm(v.kp, 0) + ') schießt über das Ziel hinaus: Überschwingen ' + fm(v.uStart, 1) + ' %, Ausregelzeit (±' + fm(v.tol, 0) + ' %) ' + fm(v.aStart, 1) + ' s. Stelle einen Regler mit D-Anteil (PD oder PID) so ein, dass das Überschwingen höchstens ' + fm(v.uMax, 0) + ' % beträgt und die Ausregelzeit (±' + fm(v.tol, 0) + ' %) höchstens ' + fm(v.aMax, 1) + ' s.'; },
      hint() { const v = vals(); return [
        'Ein P-Regler muss sich zwischen schnell und ruhig entscheiden: Ein großes Kp ist schnell, schwingt aber über. Der D-Anteil bremst, sobald sich die Lage schnell ändert, denn er arbeitet auf die Änderung des Istwerts. Schalte die Reglerart um und stelle die Vorhaltzeit Tv ein.',
        'Behalte Kp = ' + fm(v.kp, 0) + ' und schalte auf PD. Beginne mit einem kleinen Tv und erhöhe es, bis das Überschwingen unter ' + fm(v.uMax, 0) + ' % liegt. Mit Kp = ' + fm(v.kp, 0) + ' erfüllen alle Werte von Tv = ' + fm(v.tvLo, 2) + ' s bis ' + fm(v.tvHi, 2) + ' s (in Schritten von ' + fm(v.tvStep, 2) + ' s) beide Bedingungen.' + (v.pidOkKlemmen && !v.pidOkRueck ? ' Ein PID-Regler (Tn = ' + fm(v.tnPid, 0) + ' s, gleiches Kp und Tv) erfüllt sie nur mit dem Anti-Windup „klemmen“, mit „rueck“ nicht.' : ''),
        'Musterlösung: PD-Regler mit Kp = ' + fm(v.kp, 0) + ' und Tv = ' + fm(v.tvMuster, 2) + ' s. Das ergibt ' + fm(v.uMuster, 1) + ' % Überschwingen und eine Ausregelzeit von ' + fm(v.aMuster, 1) + ' s (Schwelle ' + fm(v.aMax, 1) + ' s).'
      ]; } };
  })();
  const checkRg16 = mk((r, a) => {
    const p = pick(a, 'position', M16.WL), eff = Object.assign({}, M16.START, p.controls), s = M16.sim(eff), v = M16.base();
    inputRow(r, p.problems, s.r);
    r(s.m && !badCls(s.cls), 'Die Lage schwingt nicht dauernd', 'Die Auswertung findet ' + clsText(s.cls) + ' (Kp = ' + fm(eff.kp, 2) + ', Tv = ' + fm(eff.tv, 2) + ' s). Verkleinere Kp oder erhöhe Tv.');
    const hasD = (eff.ctrl === 'PD' || eff.ctrl === 'PID') && eff.tv > 0;
    r(s.m && s.ueber <= M16.UEB, 'Das Überschwingen beträgt höchstens ' + fm(v.uMax, 0) + ' %', s.m ? 'Gemessen: ' + fm(s.ueber, 1) + ' % Überschwingen beim Sprung von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' mm. ' + (hasD ? 'Erhöhe die Vorhaltzeit Tv oder verkleinere Kp.' : 'Der Regler hat keinen wirksamen D-Anteil (Reglerart ' + eff.ctrl + ', Tv = ' + fm(eff.tv, 2) + ' s): Schalte auf PD und stelle Tv größer als 0 ein.') : 'Der Sollwertsprung wurde nicht erkannt: ' + s.why2);
    const tm = M16.tMax();
    const hasI = eff.ctrl === 'PI' || eff.ctrl === 'PID';
    let awTip = '';
    if (hasI && eff.aw !== 'klemmen' && !(s.m && s.tAus2 !== null && s.tAus2 <= tm)) { const q = M16.sim(Object.assign({}, eff, { aw: 'klemmen' })); if (M16.good(q)) awTip = ' Dein Regler hat einen I-Anteil: Mit dem Anti-Windup „klemmen“ statt „' + eff.aw + '“ erfüllt er beide Bedingungen (Ausregelzeit ' + fm(q.tAus2, 1) + ' s). Beim großen Sprung läuft der I-Anteil sonst weg.'; }
    r(s.m && s.tAus2 !== null && s.tAus2 <= tm, 'Die Ausregelzeit (±' + fm(v.tol, 0) + ' %) beträgt höchstens ' + fm(tm, 1) + ' s', s.tAus2 === null ? 'Nicht ausgeregelt: ' + s.why2 + awTip : 'Gemessen: ' + fm(s.tAus2, 1) + ' s, erlaubt sind ' + fm(tm, 1) + ' s. ' + (s.ueber <= M16.UEB ? 'Das Überschwingen ist klein genug, die Regelung ist also zu träge: Erhöhe Kp.' : 'Das Überschwingen ist ebenfalls zu groß: Ein D-Anteil dämpft das Nachschwingen, dann kannst du Kp hoch lassen.') + awTip);
  });

  /* ====================================================================== rg17: Messrauschen und Vorhaltzeit (Drehzahl) */
  const M17 = (() => {
    const T_STEP = 0.5, W0 = 500, W1 = 1500, TEND = 4, NOISE = 2, SIG0 = 2.5, RES = 1.25;
    const FIXED = { ctrl: 'PID', kp: 3, tn: 0.2, ta: 0.02 };
    const FIX = { mode: 'auto', w: W0, dir: 'direkt', u0: 0, aw: 'rueck', ymax: 100, z: 0, wRamp: 0 };
    const START = Object.assign({}, FIXED, { tv: 0.04 });
    const MUSTER = Object.assign({}, FIXED, { tv: 0.007 });
    const WL = ['ctrl', 'kp', 'tn', 'ta', 'tv'];
    const sim = (ctl, noise) => run('drehzahl', [{ t: T_STEP, set: { w: W1 } }], TEND, Object.assign({}, FIX, ctl, { noise }), { sampleS: 0.005 });
    /* ctl = Reglerwerte; die vorgegebenen Werte FIXED werden immer eingesetzt (nur tv zählt) */
    function ev(tv) {
      const ctl = Object.assign({}, FIXED, { tv });
      const clean = sim(ctl, 0), noisy = sim(ctl, NOISE), pi = sim(Object.assign({}, FIXED, { ctrl: 'PI', tv: 0 }), 0);
      const m = stepOf(clean), mp = stepOf(pi);
      const ys = win(noisy, SIG0, TEND).map(s => s.y);
      return { clean, noisy, m, sigma: stdev(ys), tAus2: m && fin(m.tAus2) ? m.tAus2 : null, ueber: m ? m.ueberPct : NaN, why2: m ? m.tAus2Why : 'Der Sollwertsprung wurde nicht erkannt.', tPI: mp && fin(mp.tAus2) ? mp.tAus2 : null };
    }
    const muster = () => once('m17', () => ev(MUSTER.tv));
    const thr = () => once('t17', () => { const m = muster(); return { tAus2: niceUp(RES * m.tAus2, 0.01), sigma: niceUp(RES * m.sigma, 0.1) }; });
    const good = e => e.tAus2 !== null && e.tAus2 <= thr().tAus2 && e.sigma <= thr().sigma;
    const base = () => once('b17', () => ({ kp: FIXED.kp, tn: FIXED.tn, ta: FIXED.ta * 1000, noise: NOISE, tPI: muster().tPI, tol: 2, sig0: SIG0, tEnd: TEND }));
    function vals() {
      return once('v17', () => {
        const m = muster(), t = thr();
        const w = () => once('w17', () => scanRange(tv => good(ev(tv)), 0.001, 0.05, 0.001));
        const s = () => once('s17', () => ev(START.tv));
        return mkVals({ kp: FIXED.kp, tn: FIXED.tn, ta: FIXED.ta * 1000, noise: NOISE, w0: W0, w1: W1, tvStart: START.tv, tPI: m.tPI, tvMuster: MUSTER.tv, sMuster: m.sigma, aMuster: m.tAus2, sMax: t.sigma, aMax: t.tAus2, tvStep: 0.001, tol: 2, sig0: SIG0, tEnd: TEND },
          { sStart: () => s().sigma, aStart: () => s().tAus2, sPI: () => ev(0).sigma, tvLo: () => w()[0], tvHi: () => w()[1] });
      });
    }
    return { FIXED, FIX, START, MUSTER, WL, ev, muster, thr, vals, base, SIG0, NOISE,
      text() { const v = vals(); return 'Der Drehzahlregler des Prüfstands (Übungsanlage) arbeitet mit einem PID-Regler (Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tn, 1) + ' s, Abtastzeit Ta = ' + fm(v.ta, 0) + ' ms). Der Tachogenerator liefert ein Messrauschen von ' + fm(v.noise, 0) + ' % des Messbereichs. Stelle die Vorhaltzeit Tv so ein, dass die Stellgröße ruhig bleibt (Standardabweichung der Stellgröße zwischen ' + fm(v.sig0, 1) + ' s und ' + fm(v.tEnd, 0) + ' s höchstens ' + fm(v.sMax, 1) + ' %) und der Sprung von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' 1/min schneller ausgeregelt wird als mit dem reinen PI-Regler (Ausregelzeit (±' + fm(v.tol, 0) + ' %) höchstens ' + fm(v.aMax, 2) + ' s, ohne Rauschen gemessen; das reine PI braucht ' + fm(v.tPI, 2) + ' s). Kp, Tn und Ta bleiben wie vorgegeben. In der Startvorlage ist Tv = ' + fm(v.tvStart, 2) + ' s.'; },
      hint() { const v = vals(); return [
        'Der D-Anteil verstärkt schnelle Änderungen, und Rauschen besteht nur aus schnellen Änderungen. Mit der Vorhaltzeit Tv wächst deshalb die Streuung der Stellgröße. Gleichzeitig bremst der D-Anteil das Überschwingen. Suche den Tv, bei dem der Gewinn an Ruhe im Sprung noch größer ist als das zusätzliche Zittern.',
        'Beginne mit einem sehr kleinen Tv und erhöhe es in kleinen Schritten. Ohne D-Anteil (reines PI) streut die Stellgröße mit ' + fm(v.sPI, 1) + ' %, mit Tv = ' + fm(v.tvStart, 2) + ' s sind es ' + fm(v.sStart, 1) + ' %. Beide Bedingungen erfüllen alle Werte von Tv = ' + fm(v.tvLo, 3) + ' s bis ' + fm(v.tvHi, 3) + ' s (in Schritten von ' + fm(v.tvStep, 3) + ' s).',
        'Musterlösung: PID-Regler mit Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tn, 1) + ' s und Tv = ' + fm(v.tvMuster, 3) + ' s. Das ergibt ' + fm(v.aMuster, 2) + ' s Ausregelzeit und ' + fm(v.sMuster, 1) + ' % Streuung der Stellgröße (Schwellen ' + fm(v.aMax, 2) + ' s und ' + fm(v.sMax, 1) + ' %).'
      ]; } };
  })();
  const checkRg17 = mk((r, a) => {
    const p = pick(a, 'drehzahl', M17.WL), eff = Object.assign({}, M17.START, p.controls), e = M17.ev(eff.tv), v = M17.base(), t = M17.thr();
    inputRow(r, p.problems, e.noisy);
    const diff = [];
    if (eff.ctrl !== 'PID') diff.push('Reglerart ' + eff.ctrl + ' statt PID');
    if (Math.abs(eff.kp - M17.FIXED.kp) > 1e-9) diff.push('Kp = ' + fm(eff.kp, 2));
    if (Math.abs(eff.tn - M17.FIXED.tn) > 1e-9) diff.push('Tn = ' + fm(eff.tn, 3) + ' s');
    if (Math.abs(eff.ta - M17.FIXED.ta) > 1e-9) diff.push('Ta = ' + fm(eff.ta * 1000, 0) + ' ms');
    r(diff.length === 0, 'Reglerart PID, Kp, Tn und Ta stehen auf den vorgegebenen Werten (nur Tv ist frei)', 'Abweichung: ' + diff.join(', ') + '. Die Prüfung rechnet mit Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tn, 1) + ' s und Ta = ' + fm(v.ta, 0) + ' ms; stelle diese Werte wieder ein, sonst passt dein Ergebnis nicht zur Prüfung.');
    r(fin(e.sigma) && e.sigma <= t.sigma, 'Die Stellgröße bleibt ruhig: Streuung höchstens ' + fm(t.sigma, 1) + ' % (bei ' + fm(v.noise, 0) + ' % Messrauschen)', 'Gemessen: ' + fm(e.sigma, 1) + ' % Streuung der Stellgröße bei Tv = ' + fm(eff.tv, 3) + ' s. ' + (eff.tv > 0 ? 'Der D-Anteil verstärkt das Rauschen: Verkleinere Tv.' : 'Mit Tv = 0 kommt die Streuung vom P- und I-Anteil.'));
    r(e.tAus2 !== null && e.tAus2 <= t.tAus2, 'Die Ausregelzeit (±' + fm(v.tol, 0) + ' %) beträgt höchstens ' + fm(t.tAus2, 2) + ' s und ist kürzer als beim reinen PI (' + fm(v.tPI, 2) + ' s)', e.tAus2 === null ? 'Nicht ausgeregelt: ' + e.why2 : 'Gemessen: ' + fm(e.tAus2, 2) + ' s, erlaubt sind ' + fm(t.tAus2, 2) + ' s' + (eff.tv <= 0 ? '. Mit Tv = 0 ist das ein reiner PI-Regler: Der D-Anteil soll die Regelung beschleunigen, stelle Tv größer als 0 ein.' : '. Mit Tv = ' + fm(eff.tv, 3) + ' s ist die Ausregelzeit zu lang: Ändere Tv in kleinen Schritten und beobachte die Kenngrößen-Tafel.'));
  });

  /* ====================================================================== rg18: Gleichprozentiges Ventil (Verstärkungsverhältnis) */
  const M18 = (() => {
    const CH = 'gleichprozentig', Y_HI = 80, Y_LO = 20, TOL = 0.05;
    const gain = y => { const rig = mkRig('durchfluss', { char: CH }); rig.setOperatingPoint(y); return rig.state().gain; };
    function vals() {
      return once('v18', () => {
        const rig = mkRig('durchfluss', { char: CH }), R = rig.params.R, gHi = gain(Y_HI), gLo = gain(Y_LO);
        const phi = y => CORE().valveChar(y, CH, R);
        return { yHi: Y_HI, yLo: Y_LO, R, gHi, gLo, ratio: gHi / gLo, rpow: Math.pow(R, (Y_HI - Y_LO) / 100), expo: (Y_HI - Y_LO) / 100, hubRatio: Y_HI / Y_LO, inv: gLo / gHi, qRatio: phi(Y_HI) / phi(Y_LO), tol: TOL * 100 };
      });
    }
    return { CH, Y_HI, Y_LO, TOL, vals, gain,
      text() { const v = vals(); return 'Bei einem Regelventil mit gleichprozentiger Kennlinie hängt die Streckenverstärkung Ks vom Ventilhub ab. Stelle am Durchfluss-Prüfstand die Kennlinie „gleichprozentig“ ein. Miss die Streckenverstärkung Ks bei ' + fm(v.yLo, 0) + ' % und bei ' + fm(v.yHi, 0) + ' % Hub (zum Beispiel im Handbetrieb mit einem kleinen Sprung der Stellgröße, oder lies das Messgerät „Streckenverstärkung Ks“ ab) und gib das Verhältnis Ks(' + fm(v.yHi, 0) + ' %) / Ks(' + fm(v.yLo, 0) + ' %) an.'; },
      hint() { const v = vals(); return [
        'Die Streckenverstärkung ist der Quotient aus der Änderung der Regelgröße und der Änderung der Stellgröße. Bei der gleichprozentigen Kennlinie ist die Kurve von Hub zu Durchfluss unten flach und oben steil. Die Steigung der Kennlinie ist deshalb nicht überall gleich.',
        'Am Prüfstand misst du bei ' + fm(v.yLo, 0) + ' % Hub Ks = ' + fm(v.gLo, 3) + ' und bei ' + fm(v.yHi, 0) + ' % Hub Ks = ' + fm(v.gHi, 3) + '. Teile den Wert bei ' + fm(v.yHi, 0) + ' % durch den Wert bei ' + fm(v.yLo, 0) + ' %.',
        'Ks(' + fm(v.yHi, 0) + ' %) / Ks(' + fm(v.yLo, 0) + ' %) = ' + fm(v.gHi, 3) + ' / ' + fm(v.gLo, 3) + ' = ' + fm(v.ratio, 2) + '. Das ist genau R hoch ' + fm(v.expo, 1) + ' mit R = ' + fm(v.R, 0) + ': ' + fm(v.rpow, 2) + '.'
      ]; } };
  })();
  const checkRg18 = mk((r, a) => {
    const v = M18.vals(), x = answerNum(a);
    r(fin(x), 'Du hast eine Zahl in das Antwortfeld eingetragen', 'Tippe das Verhältnis als Zahl in das Feld (Komma oder Punkt).');
    if (!fin(x)) { r(false, 'Das Verhältnis stimmt (Toleranz ' + fm(v.tol, 0) + ' %)', 'Ohne Zahl kann nichts geprüft werden.'); return; }
    numRow(r, 'Das Verhältnis Ks(' + fm(v.yHi, 0) + ' %) / Ks(' + fm(v.yLo, 0) + ' %) stimmt', x, v.ratio, M18.TOL, [
      [v.hubRatio, 'Du hast die Hübe geteilt (' + fm(v.yHi, 0) + ' / ' + fm(v.yLo, 0) + '). Gefragt ist das Verhältnis der Streckenverstärkungen, also der Steigungen der Kennlinie, nicht der Hübe.'],
      [v.inv, 'Du hast Ks(' + fm(v.yLo, 0) + ' %) / Ks(' + fm(v.yHi, 0) + ' %) gerechnet. Gefragt ist der Wert bei ' + fm(v.yHi, 0) + ' % im Zähler.'],
      [1, 'Das Verhältnis 1 gilt für die lineare Kennlinie. Hier ist die Kennlinie gleichprozentig: Die Verstärkung wächst mit dem Hub.'],
      [v.qRatio, 'Du hast die Durchflüsse bei ' + fm(v.yHi, 0) + ' % und ' + fm(v.yLo, 0) + ' % verglichen. Gefragt sind die Streckenverstärkungen, also die Steigungen der Kennlinie in diesen Punkten.']
    ]);
  });

  /* ====================================================================== rg19: Schaltspiele pro Stunde (Bügeleisen) */
  const M19 = (() => {
    const W = 150, TEND = 3600, SW_MAX = 10, RES = 1.25;
    const FIX = { device: 'heizen', mode: 'auto', ctrl: '2P', dir: 'direkt', w: W, fb: 0, z: 0, noise: 0, power: true };
    const START = { hyst: 1 }, MUSTER = { hyst: 4 };
    const WL = ['hyst'];
    function sim(hyst) {
      const r = run('thermostat', [], TEND, Object.assign({}, FIX, { hyst }), { sampleS: 10 }), f = r.final || {};
      return { r, f, ok: (f.cycles || 0) >= 3, swing: f.swing, spph: f.spph, cycles: f.cycles || 0, period: f.period };
    }
    const muster = () => once('m19', () => sim(MUSTER.hyst));
    const nMax = () => Math.floor(RES * muster().spph / 10) * 10;
    const good = s => s.ok && s.spph <= nMax() && s.swing <= SW_MAX;
    function vals() {
      return once('v19', () => {
        const s = sim(START.hyst), m = muster(), n = nMax();
        const w = () => once('w19', () => scanRange(h => good(sim(h)), 0.5, 12, 0.5)), big = () => once('b19', () => sim(15));
        return mkVals({ w: W, hStart: START.hyst, spphStart: s.spph, swingStart: s.swing, n, swMax: SW_MAX, hMuster: MUSTER.hyst, spphMuster: m.spph, swingMuster: m.swing, hStep: 0.5, hBig: 15 },
          { hLo: () => w()[0], hHi: () => w()[1], swingBig: () => big().swing, spphBig: () => big().spph });
      });
    }
    return { FIX, START, MUSTER, WL, sim, muster, nMax, vals, SW_MAX, W, TEND,
      text() { const v = vals(); return 'Das Bügeleisen (Übungsanlage, Sollwert ' + fm(v.w, 0) + ' °C) arbeitet mit einem Zweipunktregler. Der Schaltkontakt soll nicht zu oft schalten: höchstens ' + fm(v.n, 0) + ' Schaltspiele pro Stunde (Prozesszeit). Die Schwankungsbreite der Sohlentemperatur darf aber höchstens ' + fm(v.swMax, 0) + ' K betragen. In der Startvorlage ist die Schaltdifferenz ' + fm(v.hStart, 0) + ' K: Das ergibt ' + fm(v.spphStart, 0) + ' Schaltspiele pro Stunde. Wähle die Schaltdifferenz so, dass beide Bedingungen erfüllt sind.'; },
      hint() { const v = vals(); return [
        'Je größer die Schaltdifferenz, desto länger dauert ein Schaltspiel: Der Schalter schaltet seltener. Dafür schwankt die Temperatur stärker. Die Schwankungsbreite ist wegen des trägen Fühlers (Bimetall) größer als die Schaltdifferenz selbst.',
        'Bei ' + fm(v.hStart, 0) + ' K misst du ' + fm(v.swingStart, 1) + ' K Schwankungsbreite und ' + fm(v.spphStart, 0) + ' Schaltspiele pro Stunde, bei ' + fm(v.hBig, 0) + ' K sind es ' + fm(v.swingBig, 1) + ' K und ' + fm(v.spphBig, 0) + ' Schaltspiele pro Stunde. Beide Bedingungen erfüllen alle Schaltdifferenzen von ' + fm(v.hLo, 1) + ' K bis ' + fm(v.hHi, 1) + ' K (in Schritten von ' + fm(v.hStep, 1) + ' K).',
        'Musterlösung: Schaltdifferenz ' + fm(v.hMuster, 0) + ' K. Das ergibt ' + fm(v.spphMuster, 0) + ' Schaltspiele pro Stunde (erlaubt ' + fm(v.n, 0) + ') und ' + fm(v.swingMuster, 1) + ' K Schwankungsbreite (erlaubt ' + fm(v.swMax, 0) + ' K).'
      ]; } };
  })();
  const checkRg19 = mk((r, a) => {
    const p = pick(a, 'thermostat', M19.WL), eff = Object.assign({}, M19.START, p.controls), s = M19.sim(eff.hyst);
    inputRow(r, p.problems, s.r);
    r(s.ok, 'Die Anlage hat mindestens drei Schaltspiele ausgewertet', 'Nach ' + fm(M19.TEND, 0) + ' s Prozesszeit hat die Anlage nur ' + fm(s.cycles, 0) + ' Schaltspiele ausgewertet, die Kennwerte sind noch nicht bekannt. Wähle eine kleinere Schaltdifferenz.');
    const nm = M19.nMax();
    r(s.ok && s.spph <= nm, 'Der Schalter schaltet höchstens ' + fm(nm, 0) + '-mal pro Stunde (Prozesszeit)', s.ok ? 'Gemessen: ' + fm(s.spph, 1) + ' Schaltspiele pro Stunde bei Schaltdifferenz ' + fm(eff.hyst, 1) + ' K. Eine größere Schaltdifferenz verlängert das Schaltspiel.' : 'Ohne ausgewertete Schaltspiele gibt es keinen Messwert.');
    r(s.ok && s.swing <= M19.SW_MAX, 'Die Schwankungsbreite der Sohlentemperatur beträgt höchstens ' + fm(M19.SW_MAX, 0) + ' K', s.ok ? 'Gemessen: ' + fm(s.swing, 1) + ' K Schwankungsbreite bei Schaltdifferenz ' + fm(eff.hyst, 1) + ' K' + (s.swing > eff.hyst ? ' (die Schwankung ist größer als die Schaltdifferenz, weil der Fühler träge ist)' : '') + '. Verkleinere die Schaltdifferenz.' : 'Ohne ausgewertete Schaltspiele gibt es keinen Messwert.');
  });

  /* ====================================================================== rg20: Dreipunktregler mit Totzone (Klimagerät) */
  const M20 = (() => {
    const W = 21, BAND = 1, T_LOAD = 5400, Z_LOAD = 1400, TEND = 14400, SETTLE = 2400, HYST = 1, RES = 0.25;
    const FIX = { device: 'beides', mode: 'auto', ctrl: '3P', dir: 'direkt', w: W, hyst: HYST, fb: 0, noise: 0, lockout: 'aus', power: true, z: 0 };
    const START = { dead: 1 }, MUSTER = { dead: 0.25 };
    const WL = ['dead'];
    function sim(dead) {
      const r = run('thermostat', [{ t: T_LOAD, set: { z: Z_LOAD } }], TEND, Object.assign({}, FIX, { dead }), { sampleS: 1 });
      const s = r.samples;
      const heat = win(r, SETTLE, T_LOAD), cool = win(r, T_LOAD + 3600, TEND);
      const mm = arr => ({ lo: Math.min.apply(null, arr.map(x => x.state.temp)), hi: Math.max.apply(null, arr.map(x => x.state.temp)) });
      let rev = 0, nHeat = 0, nCool = 0;
      for (let i = 1; i < s.length; i++) { const a0 = s[i - 1].state.sw, b0 = s[i].state.sw; if (a0 * b0 < 0) rev++; }
      s.forEach(x => { if (x.state.sw > 0) nHeat++; if (x.state.sw < 0) nCool++; });
      return { r, h: mm(heat), c: mm(cool), rev, nHeat, nCool, ok: heat.length > 0 && cool.length > 0 };
    }
    const lo = () => W - BAND, hi = () => W + BAND;
    const inBand = s => s.ok && s.h.lo >= lo() - 1e-9 && s.c.hi <= hi() + 1e-9 && s.h.hi <= hi() + 1e-9 && s.c.lo >= lo() - 1e-9;
    const muster = () => once('m20', () => sim(MUSTER.dead));
    const good = s => inBand(s) && s.rev === 0;
    const base = () => ({ lo: lo(), hi: hi(), settle: SETTLE / 60, zLoad: Z_LOAD });
    function vals() {
      return once('v20', () => {
        const w = () => once('w20', () => scanRange(d => good(sim(d)), 0, 2, 0.05));
        return mkVals({ w: W, band: BAND, lo: lo(), hi: hi(), hyst: HYST, tLoad: T_LOAD / 60, zLoad: Z_LOAD, deadStart: START.dead, deadMuster: MUSTER.dead, deadStep: 0.05, settle: SETTLE / 60 },
          { loStart: () => once('st20', () => sim(START.dead)).h.lo, loMuster: () => muster().h.lo, hiMuster: () => muster().c.hi, revZero: () => once('z20', () => sim(0)).rev, deadLo: () => w()[0], deadHi: () => w()[1] });
      });
    }
    return { FIX, START, MUSTER, WL, sim, muster, vals, base, lo, hi, inBand, good, W, BAND, SETTLE, T_LOAD,
      text() { const v = vals(); return 'Das Klimagerät (Übungsanlage) hat einen Dreipunktregler mit den Schaltzuständen Heizen, Nichts tun und Kühlen (Sollwert ' + fm(v.w, 0) + ' °C, Schaltdifferenz ' + fm(v.hyst, 0) + ' K). Nach ' + fm(v.tLoad, 0) + ' Minuten Prozesszeit kommen viele Personen: Fremdwärme ' + fm(v.zLoad, 0) + ' W, der Raum muss gekühlt statt geheizt werden. Wähle die Totzone so, dass Heizen und Kühlen nie unmittelbar aufeinander folgen und die Raumtemperatur im Band ' + fm(v.w, 0) + ' ± ' + fm(v.band, 0) + ' K (von ' + fm(v.lo, 0) + ' bis ' + fm(v.hi, 0) + ' °C) bleibt. Die Auswertung beginnt nach ' + fm(v.settle, 0) + ' Minuten Prozesszeit. In der Startvorlage ist die Totzone ' + fm(v.deadStart, 0) + ' K.'; },
      hint() { const v = vals(); return [
        'Zwischen Heizen und Kühlen liegt die Totzone: Dort tut der Regler nichts. Ohne Totzone (0 K) kann der Regler beim Abschalten der Heizung sofort auf Kühlen umschalten. Eine zu große Totzone lässt die Temperatur dagegen weit vom Sollwert weglaufen.',
        'Bei Totzone ' + fm(v.deadStart, 0) + ' K fällt die Raumtemperatur im Heizbetrieb bis auf ' + fm(v.loStart, 2) + ' °C und verlässt das Band. Mit Totzone 0 K zählt die Prüfung ' + fm(v.revZero, 0) + ' direkte Wechsel zwischen Heizen und Kühlen. Beide Bedingungen erfüllen alle Totzonen von ' + fm(v.deadLo, 2) + ' K bis ' + fm(v.deadHi, 2) + ' K (in Schritten von ' + fm(v.deadStep, 2) + ' K).',
        'Musterlösung: Totzone ' + fm(v.deadMuster, 2) + ' K. Im Heizbetrieb fällt die Raumtemperatur dann bis auf ' + fm(v.loMuster, 2) + ' °C, im Kühlbetrieb steigt sie bis ' + fm(v.hiMuster, 2) + ' °C. Heizen und Kühlen wechseln sich nie direkt ab.'
      ]; } };
  })();
  const checkRg20 = mk((r, a) => {
    const p = pick(a, 'thermostat', M20.WL), eff = Object.assign({}, M20.START, p.controls), s = M20.sim(eff.dead), v = M20.base();
    inputRow(r, p.problems, s.r);
    r(s.rev === 0, 'Heizen und Kühlen folgen nie unmittelbar aufeinander (immer eine Pause „Nichts tun“ dazwischen)', 'Die Prüfung zählt ' + fm(s.rev, 0) + ' direkte Wechsel zwischen Heizen und Kühlen bei Totzone ' + fm(eff.dead, 2) + ' K. Der Regler arbeitet dann gegen sich selbst: Vergrößere die Totzone.');
    r(s.ok && s.h.lo >= M20.lo() - 1e-9 && s.h.hi <= M20.hi() + 1e-9, 'Heizbetrieb: Die Raumtemperatur bleibt im Band ' + fm(v.lo, 0) + ' bis ' + fm(v.hi, 0) + ' °C', s.ok ? 'Gemessen: ' + fm(s.h.lo, 2) + ' bis ' + fm(s.h.hi, 2) + ' °C zwischen ' + fm(v.settle, 0) + ' und ' + fm(M20.T_LOAD / 60, 0) + ' Minuten Prozesszeit. ' + (s.h.lo < M20.lo() ? 'Die Raumtemperatur fällt unter ' + fm(v.lo, 0) + ' °C. Die Totzone verschiebt die Einschaltschwelle der Heizung nach unten: Verkleinere sie.' : 'Die Raumtemperatur steigt über ' + fm(v.hi, 0) + ' °C.') : 'Die Auswertung hat keine Messwerte.');
    r(s.ok && s.c.hi <= M20.hi() + 1e-9 && s.c.lo >= M20.lo() - 1e-9, 'Kühlbetrieb mit ' + fm(v.zLoad, 0) + ' W Fremdwärme: Die Raumtemperatur bleibt im Band ' + fm(v.lo, 0) + ' bis ' + fm(v.hi, 0) + ' °C', s.ok ? 'Gemessen: ' + fm(s.c.lo, 2) + ' bis ' + fm(s.c.hi, 2) + ' °C ab ' + fm((M20.T_LOAD + 3600) / 60, 0) + ' Minuten Prozesszeit. ' + (s.c.hi > M20.hi() ? 'Die Raumtemperatur steigt über ' + fm(v.hi, 0) + ' °C. Die Totzone verschiebt die Einschaltschwelle der Kühlung nach oben: Verkleinere sie.' : 'Die Raumtemperatur fällt unter ' + fm(v.lo, 0) + ' °C.') : 'Die Auswertung hat keine Messwerte.');
  });

  /* ====================================================================== rg21: Fehlersuche Wirkungssinn (Raumtemperatur) */
  const M21 = (() => {
    const W0 = 18, W1 = 21, T_STEP = 3600, TEND = 28800, TOUT = -5, BAND = 0.5;
    const FIX = { mode: 'auto', w: W0, z: 0, tOut: TOUT, window: false, noise: 0, wRamp: 0 };
    const START = { ctrl: 'PI', dir: 'invers', kp: 2, tn: 1800, tv: 0, u0: 0, aw: 'rueck', ymax: 100, ta: 1 };
    const MUSTER = Object.assign({}, START, { dir: 'direkt' });
    const WL = Object.keys(START);
    const yOp = () => once('y21', () => mkRig('raumtemp', FIX).yFor(W0));
    const reqDir = () => once('d21', () => mkRig('raumtemp', FIX).requiredDir);
    function sim(ctl) {
      const r = run('raumtemp', [{ t: 0, set: { mode: 'auto' } }, { t: T_STEP, set: { w: W1 } }], TEND, Object.assign({}, START, ctl, FIX), { op: { y: yOp() }, sampleS: 30 });
      const f = r.final || {}, at = sampleAt(r, T_STEP), m = stepOf(r);
      return { r, xAt: at.x, xEnd: f.x, e: f.x - W1, cls: m && m.cls ? m.cls.cls : 'aperiodisch', m };
    }
    const good = s => s.xEnd > s.xAt + 0.5 && Math.abs(s.e) <= BAND && !badCls(s.cls);
    const base = () => ({ w1: W1, hours: TEND / 3600, band: BAND });
    function vals() {
      return once('v21', () => {
        const s = once('s21', () => sim(START));
        return mkVals({ w0: W0, w1: W1, tOut: TOUT, kp: START.kp, tnMin: START.tn / 60, hours: TEND / 3600, xAtStart: s.xAt, xEndStart: s.xEnd, band: BAND, hStep: T_STEP / 3600 },
          { xEndMuster: () => sim(MUSTER).xEnd });
      });
    }
    return { START, MUSTER, WL, FIX, sim, vals, base, reqDir, yOp, good, BAND, W0, W1, TEND, T_STEP,
      text() { const v = vals(); return 'Der Hausmeister meldet: „Die Heizung wird kälter, wenn ich den Sollwert erhöhe.“ Am Prüfstand läuft ein PI-Regler (Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tnMin, 0) + ' min Prozesszeit) bei ' + fm(v.tOut, 0) + ' °C Außentemperatur. Der Sollwert steigt nach ' + fm(v.hStep, 0) + ' Stunde Prozesszeit von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' °C, die Raumtemperatur fällt aber auf ' + fm(v.xEndStart, 1) + ' °C. Finde den Fehler und behebe ihn, sodass die Raumtemperatur nach ' + fm(v.hours, 0) + ' Stunden Prozesszeit höchstens ' + fm(v.band, 1) + ' K neben dem Sollwert liegt.'; },
      hint() { const v = vals(); return [
        'Ein Regelkreis muss gegenkoppeln: Liegt der Istwert unter dem Sollwert, muss der Regler mehr Wärme stellen. Wirkt er andersherum, verstärkt er jede Abweichung. Beobachte, wie Stellgröße und Raumtemperatur auf die Sollwerterhöhung reagieren.',
        'Beim Heizen steigt die Raumtemperatur, wenn die Ventilstellung (die Stellgröße) steigt. Dann muss der Regler bei zu kalter Raumtemperatur die Stellgröße vergrößern. Das ist der Wirkungssinn „' + reqDir() + '“. Mit dem falschen Wirkungssinn sinkt die Raumtemperatur im Versuch auf ' + fm(v.xEndStart, 1) + ' °C.',
        'Stelle den Wirkungssinn auf „' + reqDir() + '“. Dann steigt die Raumtemperatur nach der Erhöhung des Sollwerts auf ' + fm(v.xEndMuster, 1) + ' °C und liegt höchstens ' + fm(v.band, 1) + ' K neben dem Sollwert von ' + fm(v.w1, 0) + ' °C.'
      ]; } };
  })();
  const checkRg21 = mk((r, a) => {
    const p = pick(a, 'raumtemp', M21.WL), eff = Object.assign({}, M21.START, p.controls), s = M21.sim(eff), v = M21.base(), want = M21.reqDir();
    inputRow(r, p.problems, s.r);
    r(eff.dir === want, 'Der Regler hat den Wirkungssinn „' + want + '“', 'Der Regler wirkt „' + eff.dir + '“, die Anlage verlangt „' + want + '“. Beim Heizen muss die Stellgröße steigen, wenn der Istwert unter dem Sollwert liegt.');
    r(fin(s.xEnd) && s.xEnd > s.xAt + 0.5, 'Nach der Erhöhung des Sollwerts auf ' + fm(v.w1, 0) + ' °C steigt die Raumtemperatur', 'Gemessen: ' + fm(s.xAt, 1) + ' °C beim Sprung, ' + fm(s.xEnd, 1) + ' °C am Ende. Die Raumtemperatur steigt nicht.');
    r(fin(s.e) && Math.abs(s.e) <= M21.BAND, 'Nach ' + fm(v.hours, 0) + ' Stunden Prozesszeit liegt die Raumtemperatur höchstens ' + fm(v.band, 1) + ' K neben dem Sollwert', 'Gemessen: ' + fm(s.xEnd, 2) + ' °C bei Sollwert ' + fm(v.w1, 0) + ' °C (Abweichung ' + fm(Math.abs(s.e), 2) + ' K).');
    r(!badCls(s.cls), 'Die Raumtemperatur schwingt nicht dauernd', 'Die Auswertung findet ' + clsText(s.cls) + ' (Kp = ' + fm(eff.kp, 2) + '). Verkleinere Kp.');
  });

  /* ====================================================================== rg22: Heizbedarf beim Kälteeinbruch */
  const M22 = (() => {
    const W = 20, TOUT = -15, TOL = 0.03;
    const FIXC = { tOut: TOUT, w: W, window: false, z: 0, mode: 'hand', yHand: 100 };
    function vals() {
      return once('v22', () => {
        const rig = mkRig('raumtemp', FIXC), UA = rig.params.UA, Pmax = rig.params.Pmax, st = rig.state(), rs = rig.range;
        const pben = st.Pben, tmax = rig.steady(100);
        return { w: W, tOut: TOUT, dT: W - TOUT, UA, Pmax, pben, tmax, reicht: pben <= Pmax, tol: TOL * 100, noSign: UA * (W + TOUT), noOut: UA * W, ohneUA: W - TOUT, hi: rs.hi };
      });
    }
    return { W, TOUT, TOL, FIXC, vals,
      text() { const v = vals(); return 'Draußen herrscht ein Kälteeinbruch mit ' + fm(v.tOut, 0) + ' °C. Der Raum soll auf ' + fm(v.w, 0) + ' °C geheizt werden (Fenster zu, keine Fremdwärme). Er verliert je Kelvin Temperaturunterschied zur Außenluft ' + fm(v.UA, 0) + ' W (UA), und die Heizung liefert höchstens ' + fm(v.Pmax, 0) + ' W. Berechne den Heizbedarf, also die Wärmeleistung, die die Heizung im Beharrungszustand abgeben muss, und gib ihn in Watt an. Entscheide danach, ob die Heizung mit ihrer Höchstleistung ausreicht.'; },
      hint() { const v = vals(); return [
        'Im Beharrungszustand gibt der Raum genau so viel Wärme nach draußen ab, wie die Heizung liefert. Der Wärmeverlust wächst mit dem Temperaturunterschied zwischen innen und außen. Prüfe am Prüfstand im Handbetrieb mit 100 % Stellgröße, welche Raumtemperatur die Heizung höchstens schafft.',
        'Heizbedarf P = UA · (Raumtemperatur − Außentemperatur). Der Temperaturunterschied beträgt ' + fm(v.dT, 0) + ' K. Vergleiche das Ergebnis mit der Höchstleistung von ' + fm(v.Pmax, 0) + ' W.',
        'P = ' + fm(v.UA, 0) + ' W/K · (' + fm(v.w, 0) + ' − (' + fm(v.tOut, 0) + ')) K = ' + fm(v.pben, 0) + ' W. Die Heizung liefert höchstens ' + fm(v.Pmax, 0) + ' W: ' + (v.reicht ? 'Sie reicht aus.' : 'Sie reicht nicht aus. Bei voller Leistung bleibt der Raum bei ' + fm(v.tmax, 1) + ' °C.')
      ]; } };
  })();
  const checkRg22 = mk((r, a) => {
    const v = M22.vals(), x = answerNum(a), ch = choiceOf(a, 'reicht');
    r(fin(x), 'Du hast eine Zahl in das Antwortfeld eingetragen', 'Tippe den Heizbedarf als Zahl in das Feld (Komma oder Punkt).');
    if (fin(x)) numRow(r, 'Der Heizbedarf in Watt stimmt', x, v.pben, M22.TOL, [
      [v.noSign, 'Du hast die Außentemperatur mit falschem Vorzeichen eingesetzt: Bei ' + fm(v.tOut, 0) + ' °C ist der Temperaturunterschied ' + fm(v.dT, 0) + ' K, nicht ' + fm(v.w + v.tOut, 0) + ' K.'],
      [v.noOut, 'Du hast die Außentemperatur nicht berücksichtigt. Der Wärmeverlust hängt vom Unterschied zwischen innen und außen ab.'],
      [v.ohneUA, 'Das ist der Temperaturunterschied in Kelvin. Multipliziere ihn mit UA, um die Leistung in Watt zu bekommen.'],
      [v.Pmax, 'Das ist die Höchstleistung der Heizung, nicht der Heizbedarf.']
    ]); else r(false, 'Der Heizbedarf in Watt stimmt (Toleranz ' + fm(v.tol, 0) + ' %)', 'Ohne Zahl kann nichts geprüft werden.');
    const want = v.reicht ? 'ja' : 'nein';
    r(ch === want, 'Die Entscheidung stimmt: Die Heizung ' + (v.reicht ? 'reicht aus' : 'reicht nicht aus'), ch === undefined ? 'Wähle „ja“ oder „nein“.' : 'Der Heizbedarf beträgt ' + fm(v.pben, 0) + ' W, die Heizung liefert höchstens ' + fm(v.Pmax, 0) + ' W. Vergleiche beide Werte noch einmal.');
  });

  /* ====================================================================== rg23: Analogwerte umrechnen und Drahtbruch (Rechner) */
  const M23 = (() => {
    const SEED_SK = 1, SEED_MA = 4, I_DRAHT = 3.2, TOL = 0.03;
    const exSk = () => CORE().exercise('skalierung', SEED_SK), exMa = () => CORE().exercise('maProzent', SEED_MA);
    const info = () => CORE().scale.maInfo(I_DRAHT);
    function vals() {
      return once('v23', () => {
        const a = exSk(), b = exMa(), i = info();
        return { rawMax: 27648, skGiven: a.given, maGiven: b.given, sk: a.answer.value, ma: b.answer.value, iDraht: I_DRAHT, pctDraht: i.pct, lz: 3.6, lo: 4, hi: 20, span: 16, tol: TOL * 100 };
      });
    }
    return { SEED_SK, SEED_MA, I_DRAHT, exSk, exMa, info, vals, TOL,
      text() { const v = vals(); return 'Eine Steuerung rechnet Analogwerte um. Löse die drei Teilaufgaben. (1) ' + exSk().question + ' (2) ' + exMa().question + ' (3) Ein Messumformer mit dem Normsignal ' + fm(v.lo, 0) + ' bis ' + fm(v.hi, 0) + ' mA liefert ' + fm(v.iDraht, 1) + ' mA. Beurteile das Signal.'; },
      hint() { const v = vals(); return [
        'Rohwert und Messbereich hängen linear zusammen: 0 entspricht dem Messbereichsanfang, ' + fm(v.rawMax, 0) + ' dem Messbereichsende. Auch beim Normsignal ist es eine Gerade: der Anfang bei ' + fm(v.lo, 0) + ' mA, das Ende bei ' + fm(v.hi, 0) + ' mA. Ein Strom unter dem Messbereichsanfang ist ein Fehlerhinweis.',
        'Messwert = Anfang + Rohwert / ' + fm(v.rawMax, 0) + ' · (Ende − Anfang). Beim Normsignal: Prozent = (I − ' + fm(v.lo, 0) + ' mA) / ' + fm(v.span, 0) + ' mA · 100 %. Unter ' + fm(v.lz, 1) + ' mA melden Messumformer und Steuerung Drahtbruch (Live-Zero).',
        'Teil 1: ' + exSk().steps.join('; ') + '. Teil 2: ' + exMa().steps.join('; ') + '. Teil 3: ' + fm(v.iDraht, 1) + ' mA liegen unter ' + fm(v.lz, 1) + ' mA, das ergäbe rechnerisch ' + fm(v.pctDraht, 1) + ' %: Drahtbruch oder Messumformer ausgefallen.'
      ]; } };
  })();
  const checkRg23 = mk((r, a) => {
    const ex1 = M23.exSk(), ex2 = M23.exMa(), v1 = fieldNum(a, 'f1'), v2 = fieldNum(a, 'f2'), ch = choiceOf(a, 'draht'), info = M23.info();
    [[ex1, v1, '(1) Die Umrechnung des Rohwerts stimmt'], [ex2, v2, '(2) Die Umrechnung des Normsignals stimmt']].forEach(([ex, v, label]) => {
      if (!fin(v)) { r(false, label, 'Trage hier eine Zahl ein (Komma oder Punkt).'); return; }
      const c = ex.check(v);
      r(c.ok, label, c.text);
    });
    const want = info.fault === 'drahtbruch' ? 'drahtbruch' : (info.under ? 'unter' : 'ok');
    r(ch === want, '(3) Das Signal ist richtig beurteilt: Drahtbruch oder Messumformer ausgefallen', ch === undefined ? 'Wähle eine der Antworten.' : 'Das Signal liegt unter dem Live-Zero von ' + fm(3.6, 1) + ' mA. Der Messwert gilt dann nicht als Messwert: Die Steuerung meldet Drahtbruch oder Ausfall des Messumformers.');
  });

  /* ====================================================================== rg24: Phasenreserve einstellen (Baukasten PT3) */
  const M24 = (() => {
    const PLANT = { type: 'pt3', ks: 1, t1: 10, t2: 3, t3: 1 }, PHI_MIN = 45, PHI_MAX = 55;
    const START = { ctrl: 'P', kp: 10, tn: 20, tv: 0, ta: 0.01 };
    const MUSTER = { ctrl: 'P', kp: 4.5, tn: 20, tv: 0, ta: 0.01 };
    const WL = Object.keys(START);
    const FIX = { mode: 'auto', w: 50, u0: 50, aw: 'rueck', noise: 0, z: 0, wRamp: 0, dir: 'direkt', ymax: 100, hyst: 2, dead: 1 };
    const ctlFull = ctl => Object.assign({}, PLANT, FIX, ctl);
    function ana(ctl) {
      const rig = mkRig('baukasten', ctlFull(ctl)), an = rig.analysis(), m = an && an.margins ? an.margins : {};
      return { an, m, ok: !!(an && an.margins && an.margins.ok !== false), phi: fin(m.phiR) ? m.phiR : null, note: m.note || (an && an.why) || (m && m.why) || '', V0: an ? an.V0 : NaN };
    }
    function sim(ctl) {
      const r = run('baukasten', [{ t: 0, set: { mode: 'auto' } }, { t: 10, set: { w: 60 } }], 200, ctlFull(ctl), { sampleS: 0.1 });
      const m = stepOf(r); return { r, m, cls: m && m.cls ? m.cls.cls : 'aperiodisch' };
    }
    const kpAt = phi => { let lo = 1.6, hi = 19; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2, p = ana(Object.assign({}, START, { kp: mid })).phi; if (p !== null && p > phi) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const muster = () => once('m24', () => ana(MUSTER));
    const base = () => ({ phiMin: PHI_MIN, phiMax: PHI_MAX });
    function vals() {
      return once('v24', () => {
        const s = ana(START);
        const kpHi = () => once('hi24', () => Math.floor(kpAt(PHI_MIN) * 20) / 20), kpLo = () => once('lo24', () => Math.ceil(kpAt(PHI_MAX) * 20) / 20);
        const at = kp => ana(Object.assign({}, START, { kp }));
        return mkVals({ ks: PLANT.ks, t1: PLANT.t1, t2: PLANT.t2, t3: PLANT.t3, kpStart: START.kp, phiStart: s.phi, phiMin: PHI_MIN, phiMax: PHI_MAX, kpMuster: MUSTER.kp, kp1: 1, kp2: 2 },
          { phiMuster: () => muster().phi, kpHi, kpLo, phiAtHi: () => at(kpHi()).phi, phiAtLo: () => at(kpLo()).phi, phiKp2: () => at(2).phi, v0Kp1: () => at(1).V0, phiKp1: () => at(1).phi });
      });
    }
    return { PLANT, START, MUSTER, WL, FIX, ana, sim, vals, base, PHI_MIN, PHI_MAX, ctlFull,
      text() { const v = vals(); return 'Der Streckenbaukasten zeigt eine PT3-Strecke (Ks = ' + fm(v.ks, 0) + ', T1 = ' + fm(v.t1, 0) + ' s, T2 = ' + fm(v.t2, 0) + ' s, T3 = ' + fm(v.t3, 0) + ' s) mit einem P-Regler (Kp = ' + fm(v.kpStart, 0) + '). Die Phasenreserve beträgt nur ' + fm(v.phiStart, 1) + '°. Stelle Kp so ein, dass die Phasenreserve mindestens ' + fm(v.phiMin, 0) + '° und höchstens ' + fm(v.phiMax, 0) + '° beträgt (der Regler soll gut gedämpft, aber nicht unnötig schwach sein). Du liest die Phasenreserve im Tab „Regler einstellen“ unter „Stabilität (Vertiefung)“ ab. Der Richtwert ' + fm(v.phiMin, 0) + '° ist eine Faustregel.'; },
      hint() { const v = vals(); return [
        'Die Phasenreserve sagt, wie weit der Kreis von der Stabilitätsgrenze entfernt ist. Sie wird kleiner, wenn du Kp erhöhst. An der Stabilitätsgrenze (Kp = Kkrit) ist sie 0°.',
        'Du suchst das Kp, bei dem die Phasenreserve im Bereich von ' + fm(v.phiMin, 0) + '° bis ' + fm(v.phiMax, 0) + '° liegt. Bei Kp = ' + fm(v.kpStart, 0) + ' misst du ' + fm(v.phiStart, 1) + '°, bei Kp = ' + fm(v.kp2, 0) + ' sind es ' + fm(v.phiKp2, 1) + '°. ' + (v.phiKp1 === null ? 'Kp = ' + fm(v.kp1, 0) + ' ist zu klein: Die Kreisverstärkung V0 = ' + fm(v.v0Kp1, 0) + ' bleibt nicht über 1, es gibt keinen Durchtritt durch 0 dB und keine Phasenreserve.' : 'Bei Kp = ' + fm(v.kp1, 0) + ' sind es ' + fm(v.phiKp1, 1) + '°.'),
        'Die Phasenreserve liegt für Kp von ' + fm(v.kpLo, 2) + ' bis ' + fm(v.kpHi, 2) + ' zwischen ' + fm(v.phiMin, 0) + '° und ' + fm(v.phiMax, 0) + '° (bei Kp = ' + fm(v.kpHi, 2) + ' sind es ' + fm(v.phiAtHi, 1) + '°, bei Kp = ' + fm(v.kpLo, 2) + ' sind es ' + fm(v.phiAtLo, 1) + '°). Musterlösung: Kp = ' + fm(v.kpMuster, 1) + ' mit ' + fm(v.phiMuster, 1) + '° Phasenreserve.'
      ]; } };
  })();
  const checkRg24 = mk((r, a) => {
    const p = pick(a, 'baukasten', M24.WL.concat(['type', 'ks', 't1', 't2', 't3'])), eff = Object.assign({}, M24.START, p.controls);
    const same = ['type', 'ks', 't1', 't2', 't3'].filter(k => k in p.controls && String(p.controls[k]) !== String(M24.PLANT[k]));
    const ctl = {}; M24.WL.forEach(k => { ctl[k] = eff[k]; });
    const s = M24.ana(ctl), sm = M24.sim(ctl), v = M24.base();
    inputRow(r, p.problems, sm.r);
    r(same.length === 0, 'Die Strecke ist unverändert (PT3 mit Ks, T1, T2, T3 wie in der Aufgabe)', 'Du hast ' + same.join(', ') + ' verändert. Die Prüfung rechnet mit der vorgegebenen Strecke; stelle die Werte wieder ein.');
    r(!badCls(sm.cls), 'Der Regelkreis schwingt in der Simulation nicht dauernd', 'Die Simulation zeigt ' + clsText(sm.cls) + ' bei Kp = ' + fm(eff.kp, 2) + '. Verkleinere Kp.');
    r(s.ok && s.phi !== null && s.phi >= M24.PHI_MIN, 'Die Phasenreserve beträgt mindestens ' + fm(v.phiMin, 0) + '°', !s.ok ? (s.note || 'Für diesen Regler gibt es keinen Frequenzgang.') : (s.phi === null ? 'Es gibt keinen Durchtritt durch 0 dB, also auch keine Phasenreserve (Kreisverstärkung V0 = ' + fm(s.V0, 2) + '). Wähle ein größeres Kp, damit V0 größer als 1 wird.' : 'Gemessen: ' + fm(s.phi, 1) + '° bei Kp = ' + fm(eff.kp, 2) + '. Verkleinere Kp.'));
    r(s.ok && s.phi !== null && s.phi <= M24.PHI_MAX, 'Die Phasenreserve beträgt höchstens ' + fm(v.phiMax, 0) + '° (der Regler ist nicht unnötig schwach)', !s.ok ? (s.note || 'Für diesen Regler gibt es keinen Frequenzgang.') : (s.phi === null ? 'Es gibt keinen Durchtritt durch 0 dB (Kreisverstärkung V0 = ' + fm(s.V0, 2) + '). Wähle ein größeres Kp.' : 'Gemessen: ' + fm(s.phi, 1) + '° bei Kp = ' + fm(eff.kp, 2) + '. Erhöhe Kp, bis die Phasenreserve unter ' + fm(v.phiMax, 0) + '° sinkt.'));
  });

  /* ====================================================================== rg25: Kkrit aus dem Bode-Diagramm (Baukasten PT2 mit Totzeit) */
  const M25 = (() => {
    const PLANT = { type: 'pt2tt', ks: 2, t1: 10, t2: 4, tt: 2 }, KP = 1, TOL = 0.1;
    const CTL = Object.assign({}, PLANT, { ctrl: 'P', kp: KP, mode: 'auto', w: 50, u0: 50, noise: 0, z: 0, tv: 0, ta: 0.01 });
    function vals() {
      return once('v25', () => {
        const rig = mkRig('baukasten', CTL), an = rig.analysis(), m = an.margins, u = CORE().ultimate(rig.linBlocks());
        const factor = Math.pow(10, m.AR / 20);
        return { ks: PLANT.ks, t1: PLANT.t1, t2: PLANT.t2, tt: PLANT.tt, kp: KP, AR: m.AR, wPi: m.wPi, factor, kkrit: KP * factor, kkritUlt: u.Kkrit, tkrit: u.Tkrit, inv: 1 / u.Kkrit, tol: TOL * 100, c20: 20 };
      });
    }
    return { PLANT, KP, TOL, CTL, vals,
      text() { const v = vals(); return 'Der Streckenbaukasten zeigt eine PT2-Strecke mit Totzeit (Ks = ' + fm(v.ks, 0) + ', T1 = ' + fm(v.t1, 0) + ' s, T2 = ' + fm(v.t2, 0) + ' s, Tt = ' + fm(v.tt, 0) + ' s) mit einem P-Regler (Kp = ' + fm(v.kp, 0) + '). Bestimme aus dem Bode-Diagramm (Tab „Regler einstellen“, „Stabilität (Vertiefung)“) die Amplitudenreserve bei der Frequenz, bei der die Phase −180° erreicht wird, und berechne daraus die kritische Verstärkung Kkrit, bei der der Kreis an der Stabilitätsgrenze liegt. Trage Kkrit ein.'; },
      hint() { const v = vals(); return [
        'Die Amplitudenreserve sagt, um welchen Faktor du Kp erhöhen darfst, bis der Betrag bei der Frequenz ωπ (Phase −180°) genau 0 dB erreicht. Dort schwingt der Kreis gerade noch dauernd. Dieser Faktor mal dein aktuelles Kp ist Kkrit.',
        'Bei Kp = ' + fm(v.kp, 0) + ' liest du ab: ωπ = ' + fm(v.wPi, 3) + ' rad/s und die Amplitudenreserve AR = ' + fm(v.AR, 1) + ' dB. Die Umrechnung von dB in einen Faktor: Faktor = 10 hoch (AR / ' + fm(v.c20, 0) + '). Danach Kkrit = Kp · Faktor.',
        'Faktor = 10 hoch (' + fm(v.AR, 1) + ' / ' + fm(v.c20, 0) + ') = ' + fm(v.factor, 2) + '. Kkrit = ' + fm(v.kp, 0) + ' · ' + fm(v.factor, 2) + ' = ' + fm(v.kkrit, 2) + '. Die kritische Periodendauer ist Tkrit = 2π / ωπ = ' + fm(v.tkrit, 1) + ' s.'
      ]; } };
  })();
  const checkRg25 = mk((r, a) => {
    const v = M25.vals(), x = answerNum(a);
    r(fin(x), 'Du hast eine Zahl in das Antwortfeld eingetragen', 'Tippe Kkrit als Zahl in das Feld (Komma oder Punkt).');
    if (!fin(x)) { r(false, 'Kkrit stimmt (Toleranz ' + fm(v.tol, 0) + ' %)', 'Ohne Zahl kann nichts geprüft werden.'); return; }
    numRow(r, 'Kkrit stimmt', x, v.kkritUlt, M25.TOL, [
      [v.AR, 'Das ist die Amplitudenreserve in dB, nicht Kkrit. Kkrit = Kp · 10 hoch (AR / ' + fm(v.c20, 0) + ').'],
      [v.inv, 'Du hast den Kehrwert gebildet: Der Betrag der Strecke bei ωπ ist 1 / Kkrit. Kkrit selbst ist größer als 1.'],
      [v.tkrit, 'Das ist die kritische Periodendauer Tkrit in Sekunden, nicht die kritische Verstärkung Kkrit.'],
      [v.factor / v.ks, 'Du hast den Faktor durch Ks geteilt. Ks steckt schon in der Amplitudenreserve.']
    ]);
  });

  /* ====================================================================== rg26: Grenzzyklus bei Reibung und Lose (Position) */
  const M26 = (() => {
    const W0 = 50, W1 = 60, T_STEP = 3, TEND = 90, T_OSC = 60, FRICTION = 5, BACKLASH = 1, E_MAX = 1;
    const FIX = { mode: 'auto', w: W0, z: 0, noise: 0, wRamp: 0, friction: FRICTION, backlash: BACKLASH };
    const START = { ctrl: 'PI', dir: 'direkt', kp: 2, tn: 0.5, tv: 0, u0: 50, aw: 'rueck', ymax: 100, ta: 0.002 };
    const MUSTER = Object.assign({}, START, { tn: 5 });
    const PD_LAX = Object.assign({}, START, { ctrl: 'PD', tv: 0.1 });
    const WL = Object.keys(START);
    function sim(ctl) {
      const C = CORE(), r = run('position', [{ t: T_STEP, set: { w: W1 } }], TEND, Object.assign({}, START, ctl, FIX), { sampleS: 0.02 });
      const w = win(r, T_OSC, TEND), xs = w.map(s => s.x), ts = w.map(s => s.t), o = clsOf(C, ts, xs, 100), f = r.final || {};
      return { r, cls: o.cls, period: o.period, pp: Math.max.apply(null, xs) - Math.min.apply(null, xs), e: f.e, eAbs: Math.abs(f.e), x: f.x, hasI: ctl && (ctl.ctrl === 'PI' || ctl.ctrl === 'PID' || ctl.ctrl === 'I') };
    }
    const good = s => fin(s.eAbs) && s.eAbs <= E_MAX && s.cls !== 'dauerschwingung' && s.cls !== 'aufschaukelnd';
    const base = () => ({ fr: FRICTION, eMax: E_MAX, tOsc: TEND - T_OSC });
    function vals() {
      return once('v26', () => {
        const s = once('s26', () => sim(START));
        return mkVals({ fr: FRICTION, bl: BACKLASH, w1: W1, kp: START.kp, tn: START.tn, ppStart: s.pp, perStart: s.period, eMax: E_MAX, tnMuster: MUSTER.tn, tvPD: PD_LAX.tv, tOsc: TEND - T_OSC },
          { eMuster: () => once('m26', () => sim(MUSTER)).eAbs, ppMuster: () => once('m26', () => sim(MUSTER)).pp, ePD: () => once('l26', () => sim(PD_LAX)).eAbs });
      });
    }
    return { START, MUSTER, PD_LAX, WL, FIX, sim, vals, base, good, E_MAX, TEND, T_OSC,
      text() { const v = vals(); return 'Die Spindelachse hat Haftreibung (' + fm(v.fr, 0) + ' %) und Lose (' + fm(v.bl, 0) + ' mm). Mit dem PI-Regler der Startvorlage (Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tn, 1) + ' s) pendelt die Achse nach dem Sprung auf ' + fm(v.w1, 0) + ' mm dauernd um den Sollwert (Grenzzyklus: ' + fm(v.ppStart, 1) + ' mm Schwingweite, Periode ' + fm(v.perStart, 1) + ' s). Beseitige den Grenzzyklus, ohne dass am Ende mehr als ' + fm(v.eMax, 0) + ' mm Regeldifferenz bleiben.'; },
      hint() { const v = vals(); return [
        'Haftreibung und Lose sind Nichtlinearitäten. Ein I-Anteil sammelt die Regeldifferenz auf, bis die Achse losbricht, schießt dann über und sammelt in der Gegenrichtung wieder auf: So entsteht der Grenzzyklus. Du kannst den I-Anteil schwächen oder ganz weglassen.',
        'Weglassen allein reicht nicht: Ein PD-Regler (Tv = ' + fm(v.tvPD, 1) + ' s) mit dem Kp der Startvorlage lässt die Achse zwar ruhig stehen, aber mit ' + fm(v.ePD, 1) + ' mm Regeldifferenz neben dem Sollwert. Das ist mehr als die erlaubten ' + fm(v.eMax, 0) + ' mm. Mit einem größeren Kp oder einem schwachen I-Anteil (großes Tn) gelingt beides.',
        'Musterlösung: PI-Regler mit Kp = ' + fm(v.kp, 0) + ' und Tn = ' + fm(v.tnMuster, 0) + ' s. Der I-Anteil ist so schwach, dass die Achse nicht mehr pendelt (Schwingweite ' + fm(v.ppMuster, 1) + ' mm in den letzten ' + fm(v.tOsc, 0) + ' s), die Regeldifferenz am Ende ist ' + fm(v.eMuster, 2) + ' mm.'
      ]; } };
  })();
  const checkRg26 = mk((r, a) => {
    const p = pick(a, 'position', M26.WL), eff = Object.assign({}, M26.START, p.controls), s = M26.sim(eff), v = M26.base();
    inputRow(r, p.problems, s.r);
    r(s.cls !== 'dauerschwingung' && s.cls !== 'aufschaukelnd', 'Die Achse pendelt am Ende nicht mehr dauernd um den Sollwert', 'Die Auswertung der letzten ' + fm(v.tOsc, 0) + ' s findet ' + clsText(s.cls) + (fin(s.period) ? ' mit Periode ' + fm(s.period, 1) + ' s' : '') + ' und ' + fm(s.pp, 1) + ' mm Schwingweite (Kp = ' + fm(eff.kp, 2) + ', Tn = ' + fm(eff.tn, 2) + ' s). ' + (s.hasI ? 'Der Regler hat einen I-Anteil: Schwäche ihn (größeres Tn) oder nimm einen PD-Regler.' : 'Prüfe Kp und Tv.'));
    const osc = s.cls === 'dauerschwingung' || s.cls === 'aufschaukelnd';
    r(fin(s.eAbs) && s.eAbs <= M26.E_MAX, 'Die Regeldifferenz am Ende beträgt höchstens ' + fm(v.eMax, 0) + ' mm', 'Gemessen: ' + fm(s.eAbs, 2) + ' mm nach ' + fm(M26.TEND, 0) + ' s (Haftreibung ' + fm(v.fr, 0) + ' %). ' + (osc ? 'Die Achse pendelt noch (siehe oben): Der Wert ist eine Momentaufnahme der Schwingung.' : (s.hasI ? 'Der I-Anteil hat die Haftreibung in dieser Zeit noch nicht ausgeglichen: Erhöhe Kp oder verkleinere Tn etwas, aber nicht so weit, dass die Achse wieder pendelt.' : 'Ohne I-Anteil muss die Regeldifferenz so groß werden, dass der P-Anteil die Haftreibung überwindet: Erhöhe Kp oder nimm einen schwachen I-Anteil dazu.')));
  });

  /* ====================================================================== rg27: PI-Regler nach der T-Summen-Regel (Baukasten PT3) */
  const M27 = (() => {
    const PLANT = { type: 'pt3', ks: 1.5, t1: 12, t2: 3, t3: 2 }, TOL = 0.1, UEB = 10;
    const FIX = { mode: 'auto', w: 50, u0: 50, aw: 'rueck', noise: 0, z: 0, wRamp: 0, dir: 'direkt', ymax: 100, ta: 0.01, tv: 0, hyst: 2, dead: 1 };
    const START = { ctrl: 'P', kp: 1, tn: 20 };
    const WL = ['ctrl', 'kp', 'tn'];
    const rule = () => once('r27', () => { const rig = mkRig('baukasten', Object.assign({}, PLANT, FIX)); return { id: rig.identify(), ap: CORE().rules.apply('tsumme', rig.identify(), 'PI') }; });
    function sim(ctl) {
      const r = run('baukasten', [{ t: 0, set: { mode: 'auto' } }, { t: 10, set: { w: 60 } }], 300, Object.assign({}, PLANT, FIX, ctl), { sampleS: 0.1 });
      const m = stepOf(r); return { r, m, ueber: m ? m.ueberPct : NaN, cls: m && m.cls ? m.cls.cls : 'aperiodisch' };
    }
    const MUSTER = () => ({ ctrl: 'PI', kp: rule().ap.Kp, tn: rule().ap.Tn });
    const base = () => once('b27', () => { const { id, ap } = rule(); return { t1: PLANT.t1, tsk: id.TsumKlein, tsAll: id.Tsum, uMax: UEB, kpNoKs: PLANT.t1 / (2 * id.TsumKlein), kpAll: PLANT.t1 / (2 * PLANT.ks * id.Tsum), kFac: CORE().rules.table.find(m => m.id === 'tsumme').rows.PI.Kp.k, kpNoHalf: PLANT.t1 / (PLANT.ks * id.TsumKlein) }; });
    function vals() {
      return once('v27', () => {
        const { id, ap } = rule(), tb = CORE().rules.table.find(m => m.id === 'tsumme').rows.PI;
        return mkVals({ ks: PLANT.ks, t1: PLANT.t1, t2: PLANT.t2, t3: PLANT.t3, tsk: id.TsumKlein, kp: ap.Kp, tn: ap.Tn, kpExpr: CORE().rules.expr(tb.Kp), tnExpr: CORE().rules.expr(tb.Tn), uMax: UEB, kpDbl: 2 * ap.Kp, tol: TOL * 100, kFac: tb.Kp.k, tsAll: id.Tsum, kpNoKs: PLANT.t1 / (2 * id.TsumKlein), kpAll: PLANT.t1 / (2 * PLANT.ks * id.Tsum), kpNoHalf: PLANT.t1 / (PLANT.ks * id.TsumKlein) },
          { uMuster: () => sim(MUSTER()).ueber, uDbl: () => sim({ ctrl: 'PI', kp: 2 * ap.Kp, tn: ap.Tn }).ueber });
      });
    }
    return { PLANT, START, WL, FIX, rule, sim, vals, base, MUSTER, TOL, UEB,
      text() { const v = vals(); return 'Der Streckenbaukasten zeigt eine PT3-Strecke mit Ks = ' + fm(v.ks, 1) + ', T1 = ' + fm(v.t1, 0) + ' s, T2 = ' + fm(v.t2, 0) + ' s und T3 = ' + fm(v.t3, 0) + ' s. Berechne die Einstellwerte eines PI-Reglers nach der T-Summen-Regel (Betragsoptimum): Kp = ' + v.kpExpr + ' und Tn = ' + v.tnExpr + '. Dabei ist TΣk die Summe der kleinen Zeitkonstanten (alle außer T1). Stelle am Prüfstand die Reglerart PI mit deinen Werten ein. Beim Sollwertsprung darf das Überschwingen höchstens ' + fm(v.uMax, 0) + ' % betragen.'; },
      hint() { const v = vals(); return [
        'Bei der T-Summen-Regel kompensiert die Nachstellzeit die größte Zeitkonstante, und die Verstärkung wird so gewählt, dass die restlichen kleinen Zeitkonstanten zusammen die Geschwindigkeit des Kreises bestimmen.',
        'T1 ist die größte Zeitkonstante (' + fm(v.t1, 0) + ' s). Die kleinen Zeitkonstanten sind T2 und T3, ihre Summe ergibt TΣk = ' + fm(v.tsk, 0) + ' s. Setze TΣk, Ks und T1 in die Formel für Kp ein. Die Nachstellzeit Tn ist so groß wie T1.',
        'Kp = ' + fm(v.kFac, 1) + ' · ' + fm(v.t1, 0) + ' / (' + fm(v.ks, 1) + ' · ' + fm(v.tsk, 0) + ') = ' + fm(v.kp, 2) + ', Tn = ' + fm(v.tn, 0) + ' s. Das ergibt ' + fm(v.uMuster, 1) + ' % Überschwingen. Mit doppeltem Kp (' + fm(v.kpDbl, 1) + ') wären es ' + fm(v.uDbl, 1) + ' %.'
      ]; } };
  })();
  const checkRg27 = mk((r, a) => {
    const p = pick(a, 'baukasten', M27.WL), eff = Object.assign({}, M27.START, p.controls), s = M27.sim(eff), rr = M27.rule(), v = M27.base();
    inputRow(r, p.problems, s.r);
    r(eff.ctrl === 'PI', 'Die Reglerart ist PI', 'Die Reglerart ist „' + eff.ctrl + '“. Verlangt ist ein PI-Regler.');
    numRow(r, 'Kp stimmt', eff.kp, rr.ap.Kp, M27.TOL, [
      [v.kpNoKs, 'Du hast Ks vergessen: Kp = T1 / (2 · Ks · TΣk). Ks steht im Nenner.'],
      [v.kpAll, 'Du hast alle Zeitkonstanten, also auch T1, in TΣ eingesetzt. In TΣk gehören nur die kleinen Zeitkonstanten (alle außer T1).'],
      [v.kpNoHalf, 'Du hast den Faktor ' + fm(v.kFac, 1) + ' vergessen: Kp = ' + fm(v.kFac, 1) + ' · T1 / (Ks · TΣk).']
    ]);
    numRow(r, 'Tn stimmt', eff.tn, rr.ap.Tn, M27.TOL, [
      [v.tsAll, 'Das ist die Summe aller Zeitkonstanten. Die Nachstellzeit ist so groß wie die größte Zeitkonstante T1.'],
      [v.tsk, 'Das ist die Summe der kleinen Zeitkonstanten TΣk. Die Nachstellzeit ist so groß wie die größte Zeitkonstante T1.']
    ]);
    r(s.m && s.ueber <= M27.UEB && !badCls(s.cls), 'Das Überschwingen beim Sollwertsprung beträgt höchstens ' + fm(v.uMax, 0) + ' %', s.m ? 'Gemessen: ' + fm(s.ueber, 1) + ' % Überschwingen' + (badCls(s.cls) ? ' und ' + clsText(s.cls) : '') + ' mit Kp = ' + fm(eff.kp, 2) + ' und Tn = ' + fm(eff.tn, 1) + ' s. Prüfe die Werte noch einmal.' : 'Der Sollwertsprung wurde nicht erkannt.');
  });

  /* ====================================================================== rg28: Ziegler-Nichols oder CHR (Raumtemperatur) */
  const M28 = (() => {
    const W0 = 18, W1 = 21, T_STEP = 3600, TEND = 43200, TOUT = -5, SAME = 1;
    const FIX = { mode: 'auto', w: W0, z: 0, tOut: TOUT, window: false, noise: 0, wRamp: 0, dir: 'direkt', u0: 0, aw: 'rueck', ymax: 100, ta: 1, tv: 0 };
    const rigOp = () => { const rig = mkRig('raumtemp', FIX); rig.setOperatingPoint(rig.yFor(W0)); return rig; };
    function simRule(method) {
      const rig = rigOp(), id = rig.identify(), ap = CORE().rules.apply(method, id, 'PI');
      const r = run('raumtemp', [{ t: 0, set: { mode: 'auto' } }, { t: T_STEP, set: { w: W1 } }], TEND, Object.assign({}, FIX, { ctrl: 'PI', kp: ap.Kp, tn: ap.Tn }), { op: { y: rig.yFor(W0) }, sampleS: 30 });
      const m = stepOf(r); return { ap, m, ueber: m ? m.ueberPct : NaN, tAus5: m && fin(m.tAus5) ? m.tAus5 : null };
    }
    const sims = () => once('s28', () => ({ zn: simRule('zn-sprung'), chr: simRule('chr-fuehr-0') }));
    function pickLess(a, b, tol) { if (a === null || b === null) return null; if (Math.abs(a - b) <= tol) return 'gleich'; return a < b ? 'a' : 'b'; }
    function answers() {
      const s = sims(), ueb = pickLess(s.zn.ueber, s.chr.ueber, SAME), fast = (s.zn.tAus5 === null || s.chr.tAus5 === null) ? null : (Math.abs(s.zn.tAus5 - s.chr.tAus5) <= 0.05 * Math.max(s.zn.tAus5, s.chr.tAus5) ? 'gleich' : (s.zn.tAus5 < s.chr.tAus5 ? 'a' : 'b'));
      const map = x => (x === 'a' ? 'zn' : x === 'b' ? 'chr' : x);
      return { ueber: map(ueb), schnell: map(fast) };
    }
    function vals() {
      return once('v28', () => {
        const z = k => () => sims()[k];
        return mkVals({ w0: W0, w1: W1, tOut: TOUT, same: SAME, tol5: 5, hours: TEND / 3600, hStep: T_STEP / 3600 },
          { znKp: () => z('zn')().ap.Kp, znTn: () => z('zn')().ap.Tn, chrKp: () => z('chr')().ap.Kp, chrTn: () => z('chr')().ap.Tn, znU: () => z('zn')().ueber, chrU: () => z('chr')().ueber, znT: () => z('zn')().tAus5, chrT: () => z('chr')().tAus5,
            znTnMin: () => z('zn')().ap.Tn / 60, chrTnMin: () => z('chr')().ap.Tn / 60, znTMin: () => z('zn')().tAus5 / 60, chrTMin: () => z('chr')().tAus5 / 60 });
      });
    }
    const fT = s => fmT(s, 'min');
    return { sims, answers, vals, W0, W1, SAME, fT,
      text() { const v = vals(); return 'Die Raumtemperatur wird mit einem PI-Regler geregelt (Sollwertsprung von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' °C bei ' + fm(v.tOut, 0) + ' °C Außentemperatur). Bestimme aus der Sprungantwort der Strecke die Kennwerte und stelle den Regler einmal nach Ziegler-Nichols (Sprungantwort) und einmal nach Chien-Hrones-Reswick (Führung, aperiodisch) ein. Vergleiche beide Sprungantworten und beantworte die beiden Fragen.'; },
      hint() { const v = vals(); return [
        'Beide Regeln liefern ein Kp und ein Tn aus Tu, Tg und Ks. Ziegler-Nichols ist auf schnelles Anfahren ausgelegt und nimmt Überschwingen in Kauf, Chien-Hrones-Reswick (aperiodisch) ist auf ein Anfahren ohne Überschwingen ausgelegt. Probiere beide am Prüfstand aus und lies das Überschwingen und die Ausregelzeit an der Kenngrößen-Tafel ab.',
        'Ziegler-Nichols ergibt Kp = ' + fm(v.znKp, 2) + ' und Tn = ' + this.fT(v.znTn) + ' Prozesszeit, Chien-Hrones-Reswick ergibt Kp = ' + fm(v.chrKp, 2) + ' und Tn = ' + this.fT(v.chrTn) + ' Prozesszeit. Der größere Wert von Kp und das kleinere Tn machen den Regler schärfer.',
        'Gemessen beim Sprung von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' °C: Ziegler-Nichols ' + fm(v.znU, 1) + ' % Überschwingen und ' + this.fT(v.znT) + ' Ausregelzeit (±' + fm(v.tol5, 0) + ' %), Chien-Hrones-Reswick ' + fm(v.chrU, 1) + ' % und ' + this.fT(v.chrT) + '.'
      ]; } };
  })();
  const checkRg28 = mk((r, a) => {
    const v = M28.vals(), ans = M28.answers(), c1 = choiceOf(a, 'ueber'), c2 = choiceOf(a, 'schnell');
    const nm = x => (x === 'zn' ? 'Ziegler-Nichols' : x === 'chr' ? 'Chien-Hrones-Reswick' : 'beide gleich');
    const sum = 'Gemessen: Ziegler-Nichols ' + fm(v.znU, 1) + ' % Überschwingen, Chien-Hrones-Reswick ' + fm(v.chrU, 1) + ' %.';
    r(c1 === ans.ueber, 'Frage 1: Die Regel mit dem kleineren Überschwingen ist richtig gewählt', c1 === undefined ? 'Wähle eine Antwort.' : sum + ' Du hast „' + nm(c1) + '“ gewählt. Vergleiche die beiden Zahlen noch einmal.');
    const sum2 = 'Gemessen: Ausregelzeit (±5 %) Ziegler-Nichols ' + M28.fT(v.znT) + ', Chien-Hrones-Reswick ' + M28.fT(v.chrT) + ' (Prozesszeit).';
    r(c2 === ans.schnell, 'Frage 2: Die Regel mit der kürzeren Ausregelzeit (±5 %) ist richtig gewählt', c2 === undefined ? 'Wähle eine Antwort.' : sum2 + ' Du hast „' + nm(c2) + '“ gewählt. Vergleiche die beiden Zeiten noch einmal.');
  });

  /* ====================================================================== rg29: Prüfungsaufgabe Heizungsregelung (Raumtemperatur, mehrteilig) */
  const M29 = (() => {
    const W0 = 18, W1 = 21, TOUT = -5, KP_P = 2, TOL_K = 0.15, TOL_KS = 0.1, TOL_ST = 0.2, TOL_EBL = 0.05, UEB_RES = 3, METHOD = 'chr-fuehr-0';
    const FIX = { mode: 'auto', w: W1, z: 0, tOut: TOUT, window: false, noise: 0, wRamp: 0, dir: 'direkt', u0: 0, aw: 'rueck', ymax: 100, ta: 1, tv: 0 };
    const WL = ['ctrl', 'kp', 'tn', 'tv', 'ta', 'u0', 'aw', 'ymax', 'dir'];
    const plantRig = () => { const rig = mkRig('raumtemp', Object.assign({}, FIX, { w: W0 })); rig.setOperatingPoint(rig.yFor(W0)); return rig; };
    const ident = () => once('i29', () => plantRig().identify());
    const rule = () => once('r29', () => CORE().rules.apply(METHOD, ident(), 'PI'));
    const ebl = () => once('e29', () => {
      const rig = mkRig('raumtemp', Object.assign({}, FIX, { w: W1 })), li = rig.loopInfo(), rg = rig.range, wPct = (W1 - rg.lo) / (rg.hi - rg.lo) * 100;
      const ss = CORE().steadyState({ Ks: li.Ks, q: 0, off: li.off }, { type: 'P', Kp: KP_P }, { w: wPct, z: li.zeq, u0: 0, off: li.off });
      return { pct: ss.ebl, K: ss.ebl / 100 * (rg.hi - rg.lo), ok: ss.ok, V0: ss.V0, dT: W1 - TOUT, rangeK: rg.hi - rg.lo };
    });
    function sim(ctl) {
      const rig = plantRig(), r = run('raumtemp', [{ t: 0, set: { mode: 'auto' } }, { t: 3600, set: { w: W1 } }], 43200, Object.assign({}, FIX, { w: W0 }, ctl), { op: { y: rig.yFor(W0) }, sampleS: 30 });
      const m = stepOf(r); return { r, m, ueber: m ? m.ueberPct : NaN, cls: m && m.cls ? m.cls.cls : 'aperiodisch' };
    }
    const muster = () => once('m29', () => sim({ ctrl: 'PI', kp: rule().Kp, tn: rule().Tn }));
    const base = () => once('b29', () => ({ uMax: niceUp(muster().ueber + UEB_RES, 0.1) }));
    function vals() {
      return once('v29', () => {
        const tb = CORE().rules.table.find(x => x.id === METHOD), rows = tb.rows.PI;
        const zn = () => once('zn29', () => { const q = CORE().rules.apply('zn-sprung', ident(), 'PI'); return { q, s: sim({ ctrl: 'PI', kp: q.Kp, tn: q.Tn }) }; });
        return mkVals({ w0: W0, w1: W1, tOut: TOUT, kpP: KP_P, kpFac: rows.Kp.k, tnFac: rows.Tn.k, method: tb.name, kpExpr: CORE().rules.expr(rows.Kp), tnExpr: CORE().rules.expr(rows.Tn), tolK: TOL_K * 100, tolKs: TOL_KS * 100, tolSt: TOL_ST * 100, tolE: TOL_EBL * 100 },
          { TuMin: () => ident().Tu / 60, TgMin: () => ident().Tg / 60, Ks: () => ident().Ks, kp: () => rule().Kp, tnMin: () => rule().Tn / 60, ebl: () => ebl().K, eblPct: () => ebl().pct, V0: () => ebl().V0, denom: () => 1 + ebl().V0, dT: () => ebl().dT,
            uMuster: () => muster().ueber, uMax: () => niceUp(muster().ueber + UEB_RES, 0.1), znKp: () => zn().q.Kp, znU: () => zn().s.ueber, Tu: () => ident().Tu, Tg: () => ident().Tg });
      });
    }
    return { W0, W1, KP_P, TOL_K, TOL_KS, TOL_ST, TOL_EBL, UEB_RES, METHOD, FIX, WL, ident, rule, ebl, sim, muster, vals, base,
      text() { const v = vals(); return 'Prüfungsaufgabe (Übungsanlage, fiktiv): Ein Raum wird über ein Thermostatventil und einen Heizkörper beheizt. Die Außentemperatur beträgt ' + fm(v.tOut, 0) + ' °C. Am Prüfstand kannst du die Sprungantwort der Strecke aufnehmen (Tab „Strecke messen“, Handbetrieb). Alle Zeiten sind Prozesszeit. (a) Bestimme aus der Sprungantwort die Verzugszeit Tu und die Ausgleichszeit Tg in Minuten sowie die Streckenverstärkung Ks. (b) Welche Reglerart beseitigt die bleibende Regeldifferenz (einfachste Wahl aus der Liste)? (c) Berechne Kp und Tn des PI-Reglers nach ' + v.method + ' (Kp = ' + v.kpExpr + ', Tn = ' + v.tnExpr + ') und stelle ihn am Prüfstand ein. (d) Welche bleibende Regeldifferenz in Kelvin ergibt ein P-Regler mit Kp = ' + fm(v.kpP, 0) + ' (Arbeitspunkt u0 = 0 %) beim Sollwert ' + fm(v.w1, 0) + ' °C?'; },
      hint() { const v = vals(); return [
        'Die Kennwerte liest du an der Wendetangente der Sprungantwort ab: Tu ist die Zeit bis zum Schnitt mit dem Anfangswert, Tg die Zeit zwischen den Schnitten mit Anfangs- und Endwert. Ks ist die Änderung der Regelgröße bezogen auf die Änderung der Stellgröße, beide in Prozent des Bereichs. Die bleibende Regeldifferenz eines P-Reglers folgt aus der Kreisverstärkung V0 = Kp · Ks.',
        'Die Strecke hat Tu = ' + fm(v.TuMin, 1) + ' min, Tg = ' + fm(v.TgMin, 1) + ' min und Ks = ' + fm(v.Ks, 1) + '. Nach ' + v.method + ' ist dann Kp = ' + fm(v.kp, 2) + ' und Tn = ' + fm(v.tnMin, 1) + ' min. Für den P-Regler gilt V0 = Kp · Ks = ' + fm(v.V0, 1) + ' und e = (Sollwert − Außentemperatur) / (1 + V0) bei u0 = 0 %.',
        'e = (' + fm(v.w1, 0) + ' − (' + fm(v.tOut, 0) + ')) K / (1 + ' + fm(v.V0, 1) + ') = ' + fm(v.dT, 0) + ' K / ' + fm(v.denom, 1) + ' = ' + fm(v.ebl, 2) + ' K. Der PI-Regler (' + fm(v.kp, 2) + ' / ' + fm(v.tnMin, 1) + ' min) regelt die Regeldifferenz aus. Mit Ziegler-Nichols (Kp = ' + fm(v.znKp, 2) + ') überschwingt der Regler um ' + fm(v.znU, 1) + ' %, mit ' + v.method + ' nur um ' + fm(v.uMuster, 1) + ' %.'
      ]; },
      fields: [
        { key: 'Tu', label: 'Verzugszeit Tu', unit: 'min' },
        { key: 'Tg', label: 'Ausgleichszeit Tg', unit: 'min' },
        { key: 'Ks', label: 'Streckenverstärkung Ks (dimensionslos, % je %)', unit: '' },
        { key: 'kp', label: 'Kp des PI-Reglers', unit: '' },
        { key: 'tn', label: 'Tn des PI-Reglers', unit: 'min' },
        { key: 'ebl', label: 'Bleibende Regeldifferenz mit P-Regler (Kp = 2)', unit: 'K' }
      ],
      choices: [
        { key: 'art', q: 'Welche Reglerart beseitigt die bleibende Regeldifferenz (einfachste Wahl aus der Liste)?', options: [{ value: 'P', label: 'P-Regler' }, { value: 'PD', label: 'PD-Regler' }, { value: 'PI', label: 'PI-Regler' }, { value: '2P', label: 'Zweipunktregler' }] }
      ] };
  })();
  const checkRg29 = mk((r, a) => {
    const v = M29.base(), id = M29.ident(), ap = M29.rule(), e = M29.ebl();
    const zn = (() => { const q = CORE().rules.apply('zn-sprung', id, 'PI'); return { Kp: q.Kp, fac: CORE().rules.table.find(m => m.id === 'zn-sprung').rows.PI.Kp.k }; })();
    const p = pick(a, 'raumtemp', M29.WL), eff = Object.assign({ ctrl: 'P', kp: 2, tn: 1800, tv: 0, ta: 1 }, p.controls);
    numRow(r, '(a) Verzugszeit Tu stimmt', fieldNum(a, 'Tu'), id.Tu / 60, M29.TOL_K, [[id.Tu, 'Das ist Tu in Sekunden. Die Aufgabe verlangt Minuten.'], [id.Tg / 60, 'Das ist die Ausgleichszeit Tg. Tu ist die Zeit bis zum Schnitt der Wendetangente mit dem Anfangswert.']]);
    numRow(r, '(a) Ausgleichszeit Tg stimmt', fieldNum(a, 'Tg'), id.Tg / 60, M29.TOL_K, [[id.Tg, 'Das ist Tg in Sekunden. Die Aufgabe verlangt Minuten.'], [id.Tu / 60, 'Das ist die Verzugszeit Tu. Tg ist die Zeit zwischen den Schnitten der Wendetangente mit Anfangs- und Endwert.']]);
    numRow(r, '(a) Streckenverstärkung Ks stimmt', fieldNum(a, 'Ks'), id.Ks, M29.TOL_KS, [[id.Ks * e.rangeK / 100, 'Das ist die Verstärkung in K je %. Ks ist dimensionslos: Beide Größen in Prozent des Bereichs.']]);
    const ch = choiceOf(a, 'art');
    r(ch === 'PI', '(b) Der PI-Regler ist als einfachste Wahl benannt', ch === undefined ? 'Wähle eine Antwort.' : 'Du hast „' + ch + '“ gewählt. Ein P- oder PD-Regler lässt eine bleibende Regeldifferenz zurück (Aufgabe d), ein Zweipunktregler schaltet ständig. Der I-Anteil baut die Regeldifferenz ab.');
    numRow(r, '(c) Kp stimmt', fieldNum(a, 'kp'), ap.Kp, M29.TOL_ST, [[zn.Kp, 'Das ist das Kp nach Ziegler-Nichols (Faktor ' + fm(zn.fac, 1) + '). Verlangt ist die Tabelle der Aufgabe.']]);
    numRow(r, '(c) Tn stimmt', fieldNum(a, 'tn'), ap.Tn / 60, M29.TOL_ST, [[ap.Tn, 'Das ist Tn in Sekunden. Die Aufgabe verlangt Minuten.']]);
    numRow(r, '(d) Die bleibende Regeldifferenz des P-Reglers in Kelvin stimmt', fieldNum(a, 'ebl'), e.K, M29.TOL_EBL, [[e.pct, 'Das ist die Regeldifferenz in Prozent des Bereichs. Gefragt sind Kelvin: mal Messbereich (' + fm(e.rangeK, 0) + ' K) / ' + fm(100, 0) + ' %.'], [e.dT, 'Das ist die Regeldifferenz ohne Regler (V0 = 0). Teile durch (1 + V0).']]);
    const s = M29.sim({ ctrl: eff.ctrl, kp: eff.kp, tn: eff.tn, tv: eff.tv, ta: eff.ta }), uMax = v.uMax;
    const hasI = eff.ctrl === 'PI' || eff.ctrl === 'PID';
    r(hasI && s.m && s.ueber <= uMax && !badCls(s.cls), '(c) Am Prüfstand ist ein PI-Regler mit deinen Werten eingestellt: höchstens ' + fm(uMax, 1) + ' % Überschwingen beim Sprung', !hasI ? 'Die Reglerart am Prüfstand ist „' + eff.ctrl + '“. Stelle die Reglerart PI ein.' : (s.m ? 'Gemessen: ' + fm(s.ueber, 1) + ' % Überschwingen' + (badCls(s.cls) ? ' und ' + clsText(s.cls) : '') + ' mit Kp = ' + fm(eff.kp, 2) + ' und Tn = ' + fmT(eff.tn, 'min') + '. Nach der Tabelle der Aufgabe sind höchstens ' + fm(uMax, 1) + ' % zu erwarten.' : 'Der Sollwertsprung wurde nicht erkannt.'));
  });

  /* ====================================================================== rg30: Meisterstück (Baukasten PT3, vier Kriterien) */
  const M30 = (() => {
    const PLANT = { type: 'pt3', ks: 1.5, t1: 10, t2: 3, t3: 1 }, UEB = 10, PHI = 40, RES = 1.25, Z_STEP = 20, W1 = 60;
    const FIX = { mode: 'auto', w: 50, u0: 50, aw: 'rueck', noise: 0, dir: 'direkt', ymax: 100, ta: 0.01, wRamp: 0, hyst: 2, dead: 1 };
    const START = { ctrl: 'PI', kp: 2, tn: 10, tv: 0 };
    const MUSTER = { ctrl: 'PID', kp: 2, tn: 15, tv: 2 };
    const WL = Object.keys(START);
    const full = ctl => Object.assign({}, PLANT, FIX, ctl);
    function ev(ctl) {
      const C = CORE(), c = full(ctl);
      const r1 = run('baukasten', [{ t: 0, set: { mode: 'auto' } }, { t: 10, set: { w: W1 } }], 150, c, { sampleS: 0.1 });
      const r2 = run('baukasten', [{ t: 0, set: { mode: 'auto' } }, { t: 100, set: { z: Z_STEP } }], 250, c, { sampleS: 0.1 });
      const m = stepOf(r1), d = C.disturbMetrics(r2.samples.map(s => s.t), r2.samples.map(s => s.x), { w: 50, tz: 100 });
      const an = mkRig('baukasten', c).analysis(), mg = an && an.margins ? an.margins : {};
      return { r1, r2, m, d, ueber: m ? m.ueberPct : NaN, tAus2: m && fin(m.tAus2) ? m.tAus2 : null, why2: m ? m.tAus2Why : 'Der Sollwertsprung wurde nicht erkannt.', xd: d && fin(d.xdMax) ? Math.abs(d.xdMax) : null, phi: fin(mg.phiR) ? mg.phiR : null, note: mg.note || mg.why || '', cls: m && m.cls ? m.cls.cls : 'aperiodisch' };
    }
    const muster = () => once('m30', () => ev(MUSTER));
    const thr = () => once('t30', () => { const m = muster(); return { tAus2: niceUp(RES * m.tAus2, 0.1), xd: niceUp(RES * m.xd, 0.1) }; });
    const good = e => e.m && e.ueber <= UEB && e.phi !== null && e.phi >= PHI && e.tAus2 !== null && e.tAus2 <= thr().tAus2 && e.xd !== null && e.xd <= thr().xd && !badCls(e.cls);
    const base = () => ({ uMax: UEB, phiMin: PHI, zStep: Z_STEP });
    function vals() {
      return once('v30', () => {
        const s = once('s30', () => ev(START)), t = thr(), lax = () => once('l30', () => ev({ ctrl: 'PI', kp: 0.3, tn: 30, tv: 0 }));
        return mkVals({ ks: PLANT.ks, t1: PLANT.t1, t2: PLANT.t2, t3: PLANT.t3, uMax: UEB, phiMin: PHI, aMax: t.tAus2, xdMax: t.xd, zStep: Z_STEP, w0: FIX.w, w1: W1, kpS: START.kp, tnS: START.tn, uStart: s.ueber, aStart: s.tAus2, xdStart: s.xd, phiStart: s.phi, kp: MUSTER.kp, tn: MUSTER.tn, tv: MUSTER.tv, kpLax: 0.3, tnLax: 30, tol: 2 },
          { uMuster: () => muster().ueber, aMuster: () => muster().tAus2, xdMuster: () => muster().xd, phiMuster: () => muster().phi, aLax: () => lax().tAus2, xdLax: () => lax().xd, laxOk: () => !!(lax().m && lax().ueber <= UEB && lax().phi !== null && lax().phi >= PHI) });
      });
    }
    return { PLANT, START, MUSTER, WL, FIX, ev, muster, thr, vals, base, good, UEB, PHI, Z_STEP,
      text() { const v = vals(); return 'Meisterstück: Der Streckenbaukasten zeigt eine PT3-Strecke (Ks = ' + fm(v.ks, 1) + ', T1 = ' + fm(v.t1, 0) + ' s, T2 = ' + fm(v.t2, 0) + ' s, T3 = ' + fm(v.t3, 0) + ' s). Lege den Regler so aus (Reglerart und alle Reglerwerte sind frei wählbar), dass vier Bedingungen zugleich erfüllt sind: (1) Beim Sollwertsprung von ' + fm(v.w0, 0) + ' auf ' + fm(v.w1, 0) + ' % beträgt das Überschwingen höchstens ' + fm(v.uMax, 0) + ' %. (2) Die Ausregelzeit (±' + fm(v.tol, 0) + ' %) beträgt höchstens ' + fm(v.aMax, 1) + ' s. (3) Springt die Störgröße z um ' + fm(v.zStep, 0) + ' %, weicht die Regelgröße höchstens ' + fm(v.xdMax, 1) + ' % vom Sollwert ab. (4) Die Phasenreserve beträgt mindestens ' + fm(v.phiMin, 0) + '°. In der Startvorlage (PI, Kp = ' + fm(v.kpS, 0) + ', Tn = ' + fm(v.tnS, 0) + ' s) sind ' + fm(v.uStart, 1) + ' % Überschwingen und ' + fm(v.aStart, 1) + ' s Ausregelzeit zu viel.'; },
      hint() { const v = vals(); return [
        'Die vier Bedingungen ziehen in verschiedene Richtungen: Eine große Verstärkung dämpft die Störung und regelt schnell aus, kostet aber Phasenreserve und lässt den Sollwertsprung überschwingen. Ein langes Tn macht den I-Anteil sanft, ein D-Anteil gibt Phasenreserve zurück.',
        'Ein sehr schwacher Regler (PI mit Kp = ' + fm(v.kpLax, 1) + ' und Tn = ' + fm(v.tnLax, 0) + ' s) ' + (v.laxOk ? 'hält das Überschwingen klein und die Phasenreserve groß, ' : '') + 'lässt die Störung aber um ' + fm(v.xdLax, 1) + ' % abweichen (erlaubt sind ' + fm(v.xdMax, 1) + ' %)' + (v.aLax === null ? ' und erreicht den Sollwert in der Prüfzeit nicht.' : '.') + ' Probiere einen PID-Regler mit größerem Tn und einer Vorhaltzeit Tv in der Größe von T2.',
        'Musterlösung: PID-Regler mit Kp = ' + fm(v.kp, 0) + ', Tn = ' + fm(v.tn, 0) + ' s und Tv = ' + fm(v.tv, 0) + ' s. Das ergibt ' + fm(v.uMuster, 1) + ' % Überschwingen, ' + fm(v.aMuster, 1) + ' s Ausregelzeit, ' + fm(v.xdMuster, 1) + ' % Abweichung bei der Störung und ' + fm(v.phiMuster, 0) + '° Phasenreserve.'
      ]; } };
  })();
  const checkRg30 = mk((r, a) => {
    const p = pick(a, 'baukasten', M30.WL.concat(['type', 'ks', 't1', 't2', 't3'])), eff = Object.assign({}, M30.START, p.controls), v = M30.base(), t = M30.thr();
    const same = ['type', 'ks', 't1', 't2', 't3'].filter(k => k in p.controls && String(p.controls[k]) !== String(M30.PLANT[k]));
    const ctl = {}; M30.WL.forEach(k => { ctl[k] = eff[k]; });
    const e = M30.ev(ctl);
    inputRow(r, p.problems, e.r1);
    r(same.length === 0, 'Die Strecke ist unverändert (PT3 mit Ks, T1, T2, T3 wie in der Aufgabe)', 'Du hast ' + same.join(', ') + ' verändert. Die Prüfung rechnet mit der vorgegebenen Strecke; stelle die Werte wieder ein.');
    r(e.m && e.ueber <= M30.UEB && !badCls(e.cls), '(1) Das Überschwingen beim Sollwertsprung beträgt höchstens ' + fm(v.uMax, 0) + ' %', e.m ? 'Gemessen: ' + fm(e.ueber, 1) + ' %' + (badCls(e.cls) ? ' und ' + clsText(e.cls) : '') + '. Verkleinere Kp, vergrößere Tn oder dämpfe mit Tv.' : 'Der Sollwertsprung wurde nicht erkannt.');
    r(e.tAus2 !== null && e.tAus2 <= t.tAus2, '(2) Die Ausregelzeit (±2 %) beträgt höchstens ' + fm(t.tAus2, 1) + ' s', e.tAus2 === null ? 'Nicht ausgeregelt: ' + e.why2 : 'Gemessen: ' + fm(e.tAus2, 1) + ' s. Der Regler ist zu träge oder schwingt lange nach: Erhöhe Kp oder verkleinere Tn, ohne das Überschwingen zu vergrößern.');
    r(e.xd !== null && e.xd <= t.xd, '(3) Bei einem Sprung der Störgröße um ' + fm(v.zStep, 0) + ' % weicht die Regelgröße höchstens ' + fm(t.xd, 1) + ' % ab', e.xd === null ? 'Die Störung wurde nicht ausgewertet.' : 'Gemessen: ' + fm(e.xd, 1) + ' % größte Abweichung. Eine größere Verstärkung Kp und ein kleineres Tn drücken die Störung schneller weg.');
    r(e.phi !== null && e.phi >= M30.PHI, '(4) Die Phasenreserve beträgt mindestens ' + fm(v.phiMin, 0) + '°', e.phi === null ? (e.note || 'Für diesen Regler gibt es keine Phasenreserve.') : 'Gemessen: ' + fm(e.phi, 1) + '°. Verkleinere Kp, vergrößere Tn oder nimm einen D-Anteil dazu.');
  });

  /* ====================================================================== Aufgabenliste */
  /* text und hint werden erst beim ersten Zugriff gerechnet (Simulation), danach gemerkt */
  const L = (t, M) => {
    let tx = null, hi = null;
    Object.defineProperty(t, 'text', { enumerable: true, configurable: true, get() { if (tx === null) { try { tx = M.text(); } catch (e) { return 'Der Aufgabentext konnte nicht berechnet werden (REG_CORE und die Prüfstände müssen geladen sein).'; } } return tx; } });
    Object.defineProperty(t, 'hint', { enumerable: true, configurable: true, get() { if (hi === null) { try { hi = M.hint(); } catch (e) { return ['Tipp nicht verfügbar.', 'Tipp nicht verfügbar.', 'Tipp nicht verfügbar.']; } } return hi; } });
    return t;
  };
  const tasks = [
    L({ id: 'rg16', lab: 'reg', cat: 'Regler verstehen', title: 'Schneller und ruhiger mit PD-Regler', level: 2, rig: 'position',
      start: () => S('position', Object.assign({}, M16.FIX, M16.START), { seq: [{ t: M16.T0, set: { w: M16.W1 } }], dur: 12 }),
      sol: () => S('position', Object.assign({}, M16.FIX, M16.MUSTER), { seq: [{ t: M16.T0, set: { w: M16.W1 } }], dur: 12 }),
       check: checkRg16, hintVals: () => M16.vals() }, M16),
    L({ id: 'rg17', lab: 'reg', cat: 'Praxis', title: 'Messrauschen und Vorhaltzeit', level: 2, rig: 'drehzahl',
      start: () => S('drehzahl', Object.assign({ noise: M17.NOISE }, M17.FIX, M17.START), { seq: [{ t: 0.5, set: { w: 1500 } }], dur: 4 }),
      sol: () => S('drehzahl', Object.assign({ noise: M17.NOISE }, M17.FIX, M17.MUSTER), { seq: [{ t: 0.5, set: { w: 1500 } }], dur: 4 }),
       check: checkRg17, hintVals: () => M17.vals() }, M17),
    L({ id: 'rg18', lab: 'reg', cat: 'Strecke messen', title: 'Gleichprozentiges Ventil: Verstärkung bei 80 und 20 Prozent', level: 2, rig: 'durchfluss',
      ask: { label: 'Verhältnis Ks(80 %) / Ks(20 %)', unit: '' },
      start: () => S('durchfluss', { char: 'gleichprozentig', mode: 'hand', yHand: 50, z: 0 }, { op: { y: 50 }, value: null }),
      sol: () => S('durchfluss', { char: 'gleichprozentig', mode: 'hand', yHand: 50, z: 0 }, { op: { y: 50 }, value: M18.vals().ratio }),
       check: checkRg18, hintVals: () => M18.vals() }, M18),
    L({ id: 'rg19', lab: 'reg', cat: 'Zweipunkt', title: 'Schaltspiele pro Stunde begrenzen', level: 2, rig: 'thermostat',
      start: () => S('thermostat', Object.assign({}, M19.FIX, M19.START)),
      sol: () => S('thermostat', Object.assign({}, M19.FIX, M19.MUSTER)),
       check: checkRg19, hintVals: () => M19.vals() }, M19),
    L({ id: 'rg20', lab: 'reg', cat: 'Zweipunkt', title: 'Dreipunktregler: Totzone einstellen', level: 2, rig: 'thermostat',
      start: () => S('thermostat', Object.assign({}, M20.FIX, M20.START), { seq: [{ t: M20.T_LOAD, set: { z: 1400 } }], dur: 14400 }),
      sol: () => S('thermostat', Object.assign({}, M20.FIX, M20.MUSTER), { seq: [{ t: M20.T_LOAD, set: { z: 1400 } }], dur: 14400 }),
       check: checkRg20, hintVals: () => M20.vals() }, M20),
    L({ id: 'rg21', lab: 'reg', cat: 'Fehlersuche', title: 'Fehlersuche: Heizung wird kälter', level: 2, rig: 'raumtemp', maskDiag: ['wirk'],
      start: () => S('raumtemp', Object.assign({}, M21.FIX, M21.START), { op: { y: M21.yOp() }, seq: [{ t: M21.T_STEP, set: { w: M21.W1 } }], dur: M21.TEND }),
      sol: () => S('raumtemp', Object.assign({}, M21.FIX, M21.MUSTER), { op: { y: M21.yOp() }, seq: [{ t: M21.T_STEP, set: { w: M21.W1 } }], dur: M21.TEND }),
       check: checkRg21, hintVals: () => M21.vals() }, M21),
    L({ id: 'rg22', lab: 'reg', cat: 'Praxis', title: 'Kälteeinbruch: Heizbedarf berechnen', level: 2, rig: 'raumtemp',
      ask: { label: 'Heizbedarf', unit: 'W' },
      choices: [{ key: 'reicht', q: 'Reicht die Heizung mit ihrer Höchstleistung aus?', options: [{ value: 'ja', label: 'Ja, die Heizung reicht aus' }, { value: 'nein', label: 'Nein, die Heizung reicht nicht aus' }] }],
      start: () => S('raumtemp', clone(M22.FIXC), { value: null, choices: {} }),
      sol: () => S('raumtemp', clone(M22.FIXC), { value: M22.vals().pben, choices: { reicht: M22.vals().reicht ? 'ja' : 'nein' } }),
       check: checkRg22, hintVals: () => M22.vals() }, M22),
    L({ id: 'rg23', lab: 'reg', cat: 'SPS und Technik', title: 'Analogwerte umrechnen und Drahtbruch erkennen', level: 2, rig: '',
      fields: () => [{ key: 'f1', label: '(1) Messwert aus dem Rohwert', unit: M23.exSk().answer.unit }, { key: 'f2', label: '(2) Ergebnis der Normsignal-Umrechnung', unit: M23.exMa().answer.unit }],
      choices: [{ key: 'draht', q: '(3) Wie beurteilst du das Signal des Messumformers?', options: [{ value: 'drahtbruch', label: 'Drahtbruch oder Messumformer ausgefallen' }, { value: 'unter', label: 'Gültiger Messwert, nur etwas unter 0 %' }, { value: 'null', label: 'Messbereichsanfang (0 %)' }] }],
      start: () => S('', {}, { fields: { f1: null, f2: null }, choices: {} }),
      sol: () => S('', {}, { fields: { f1: M23.exSk().answer.value, f2: M23.exMa().answer.value }, choices: { draht: 'drahtbruch' } }),
       check: checkRg23, hintVals: () => M23.vals() }, M23),
    L({ id: 'rg24', lab: 'reg', cat: 'Stabilität', title: 'Phasenreserve von 45 Grad einstellen', level: 3, rig: 'baukasten',
      start: () => S('baukasten', Object.assign({}, M24.PLANT, M24.FIX, M24.START)),
      sol: () => S('baukasten', Object.assign({}, M24.PLANT, M24.FIX, M24.MUSTER)),
       check: checkRg24, hintVals: () => M24.vals() }, M24),
    L({ id: 'rg25', lab: 'reg', cat: 'Stabilität', title: 'Kkrit aus dem Bode-Diagramm', level: 3, rig: 'baukasten',
      ask: { label: 'Kritische Verstärkung Kkrit', unit: '' },
      start: () => S('baukasten', clone(M25.CTL), { value: null }),
      sol: () => S('baukasten', clone(M25.CTL), { value: M25.vals().kkrit }),
       check: checkRg25, hintVals: () => M25.vals() }, M25),
    L({ id: 'rg26', lab: 'reg', cat: 'Fehlersuche', title: 'Grenzzyklus bei Reibung und Lose beseitigen', level: 3, rig: 'position',
      start: () => S('position', Object.assign({}, M26.FIX, M26.START), { seq: [{ t: 3, set: { w: 60 } }], dur: M26.TEND }),
      sol: () => S('position', Object.assign({}, M26.FIX, M26.MUSTER), { seq: [{ t: 3, set: { w: 60 } }], dur: M26.TEND }),
       check: checkRg26, hintVals: () => M26.vals() }, M26),
    L({ id: 'rg27', lab: 'reg', cat: 'Einstellen', title: 'PI-Regler nach der T-Summen-Regel', level: 3, rig: 'baukasten',
      start: () => S('baukasten', Object.assign({}, M27.PLANT, M27.FIX, M27.START), { seq: [{ t: 10, set: { w: 60 } }], dur: 300 }),
      sol: () => S('baukasten', Object.assign({}, M27.PLANT, M27.FIX, M27.MUSTER()), { seq: [{ t: 10, set: { w: 60 } }], dur: 300 }),
       check: checkRg27, hintVals: () => M27.vals() }, M27),
    L({ id: 'rg28', lab: 'reg', cat: 'Einstellen', title: 'Ziegler-Nichols oder CHR?', level: 3, rig: 'raumtemp',
      choices: [
        { key: 'ueber', q: 'Frage 1: Welche Einstellregel liefert beim Sollwertsprung weniger Überschwingen?', options: [{ value: 'zn', label: 'Ziegler-Nichols (Sprungantwort)' }, { value: 'chr', label: 'Chien-Hrones-Reswick (Führung, aperiodisch)' }, { value: 'gleich', label: 'Beide gleich' }] },
        { key: 'schnell', q: 'Frage 2: Welche Einstellregel regelt auf ±5 % schneller aus?', options: [{ value: 'zn', label: 'Ziegler-Nichols (Sprungantwort)' }, { value: 'chr', label: 'Chien-Hrones-Reswick (Führung, aperiodisch)' }, { value: 'gleich', label: 'Beide gleich' }] }
      ],
      start: () => S('raumtemp', { mode: 'auto', ctrl: 'PI', dir: 'direkt', w: M28.W0, tOut: -5, window: false, z: 0, noise: 0 }, { choices: {} }),
      sol: () => S('raumtemp', { mode: 'auto', ctrl: 'PI', dir: 'direkt', w: M28.W0, tOut: -5, window: false, z: 0, noise: 0 }, { choices: { ueber: M28.answers().ueber, schnell: M28.answers().schnell } }),
       check: checkRg28, hintVals: () => M28.vals() }, M28),
    L({ id: 'rg29', lab: 'reg', cat: 'Prüfungsstil', title: 'Prüfungsaufgabe: Heizungsregelung', level: 3, rig: 'raumtemp',
      fields: M29.fields, choices: M29.choices,
      start: () => S('raumtemp', { mode: 'hand', yHand: 50, ctrl: 'P', dir: 'direkt', kp: 2, w: M29.W0, tOut: -5, window: false, z: 0, noise: 0 }, { fields: { Tu: null, Tg: null, Ks: null, kp: null, tn: null, ebl: null }, choices: {} }),
      sol: () => { const id = M29.ident(), ap = M29.rule(); return S('raumtemp', { mode: 'auto', ctrl: 'PI', dir: 'direkt', kp: ap.Kp, tn: ap.Tn, w: M29.W0, tOut: -5, window: false, z: 0, noise: 0 }, { fields: { Tu: id.Tu / 60, Tg: id.Tg / 60, Ks: id.Ks, kp: ap.Kp, tn: ap.Tn / 60, ebl: M29.ebl().K }, choices: { art: 'PI' } }); },
       check: checkRg29, hintVals: () => M29.vals() }, M29),
    L({ id: 'rg30', lab: 'reg', cat: 'Prüfungsstil', title: 'Meisterstück: Regler auslegen', level: 3, rig: 'baukasten',
      start: () => S('baukasten', Object.assign({}, M30.PLANT, M30.FIX, M30.START), { seq: [{ t: 10, set: { w: 60 } }, { t: 100, set: { z: 20 } }], dur: 200 }),
      sol: () => S('baukasten', Object.assign({}, M30.PLANT, M30.FIX, M30.MUSTER), { seq: [{ t: 10, set: { w: 60 } }, { t: 100, set: { z: 20 } }], dur: 200 }),
       check: checkRg30, hintVals: () => M30.vals() }, M30)
  ];

  /* ====================================================================== Registrierung */
  const answerOf = (task, o) => {
    o = isObj(o) ? o : {};
    return { rig: o.rig !== undefined ? o.rig : task.rig, controls: o.controls || {}, seq: o.seq || [], rows: o.rows || [], dur: o.dur || 0, state: null, simTime: 0, value: fin(o.value) ? o.value : null, text: typeof o.text === 'string' ? o.text : '', fields: o.fields || {}, choices: o.choices || {}, kennwerte: null, op: o.op || null };
  };
  const T = root.REG_TASKS = root.REG_TASKS || {
    tasks: [],
    register(list) {
      (Array.isArray(list) ? list : []).forEach(t => { if (t && t.id && !this.tasks.some(x => x.id === t.id)) this.tasks.push(t); });
      this.tasks.sort((a, b) => (parseInt(String(a.id).replace(/\D/g, ''), 10) || 0) - (parseInt(String(b.id).replace(/\D/g, ''), 10) || 0));
    },
    run(task, answer) {
      return new Promise(res => {
        try { res(task.check(answer)); } catch (e) { res([{ ok: false, text: 'Die Prüfung konnte nicht ausgeführt werden', why: String(e && e.message || e) }]); }
      });
    }
  };
  T.register(tasks);
  const api = { tasks, answerOf, models: { M16, M17, M18, M19, M20, M21, M22, M23, M24, M25, M26, M27, M28, M29, M30 }, helpers: { pick, fm, run } };
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
