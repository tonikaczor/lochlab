'use strict';
/* Tonfunk Instandhaltungs-Lab: Logik (INS_CORE), per Node testbar (module.exports).
   Inhalt: Zahlen deutsch, Zufall mit Seed, Kennzahlen (MTBF, MTTR, Verfügbarkeit, Ausfallkosten), Wartungsplan-Raster,
   Szenario-Engine der Fehlersuche (Zustand, Prüfschritte, Sicherheitsablauf, Abgabe, Bewertung, Idealweg),
   Fragen (choice, multi, match, num), Zufallsfragen (genQuick), Referenzlösungen für die Tests.
   Das Fehler-Geheimnis: start() legt den Fehler in state.fault. Die Oberfläche zeigt nur view()/publicState() und das Log,
   Fehlernamen erscheinen erst im Ergebnis von submit(). */
(function (root) {
  const D = root.INS_DATA || (typeof require === 'function' ? require('./insdata.js').DATA : null);
  const fin = Number.isFinite;
  const rd = (v, d) => { const f = Math.pow(10, d); return Math.round(v * f) / f; };

  /* ---------------- Zahlen deutsch ---------------- */
  function parseDe(s) {
    if (typeof s === 'number') return fin(s) ? s : NaN;
    s = String(s == null ? '' : s).trim().replace(/\s+/g, '').replace(/(€|euro|eur|%|h|std|stunden|wochen|mal|hübe)$/i, '').replace(',', '.');
    if (!/^[+\-−]?\d+(\.\d+)?$|^[+\-−]?\.\d+$/.test(s)) return NaN;
    return parseFloat(s.replace('−', '-'));
  }
  function fmtDe(v, dec) {
    if (!fin(v)) return '–';
    dec = dec == null ? 2 : dec;
    let s = rd(v, dec).toFixed(dec);
    if (/^-0(\.0*)?$/.test(s)) s = s.slice(1);
    return s.replace('-', '−').replace('.', ',');
  }
  /* kürzeste Darstellung ohne unnötige Nullen */
  const fAny = (v, maxDec) => { const m = maxDec == null ? 2 : maxDec; let s = rd(v, m).toFixed(m); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return fmtDe(parseFloat(s), (s.split('.')[1] || '').length); };

  /* ---------------- Zufall ---------------- */
  function hashStr(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = (typeof seed === 'number' ? seed >>> 0 : hashStr(seed)) || 1;
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  const ri = (R, a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = (R, arr) => arr[Math.floor(R() * arr.length)];
  function shuffle(R, arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* ---------------- Kennzahlen ---------------- */
  /* MTBF = Betriebszeit : Anzahl der Ausfälle (h) */
  const mtbf = (betriebH, ausfaelle) => ausfaelle > 0 ? betriebH / ausfaelle : NaN;
  /* MTTR = Summe der Reparaturzeiten : Anzahl der Reparaturen (h) */
  const mttr = (repH, anzahl) => anzahl > 0 ? repH / anzahl : NaN;
  /* Verfügbarkeit in Prozent = MTBF : (MTBF + MTTR) · 100 */
  const verf = (m1, m2) => (m1 + m2) > 0 ? 100 * m1 / (m1 + m2) : NaN;
  /* Verfügbarkeit in Prozent aus geplanter Zeit und Stillstand */
  const verfZeit = (planH, stillH) => planH > 0 ? 100 * (planH - stillH) / planH : NaN;
  /* Ausfallkosten = Stillstand · Kosten je Stunde + Personen · Stunden · Stundensatz + Ersatzteile */
  const kosten = (stillH, kostenH, personen, repH, lohnH, teile) => stillH * kostenH + personen * repH * lohnH + teile;
  /* Rechenvorschrift aus den Aufgabendaten: calc = ['mtbf', 1200, 6] usw. */
  function evalCalc(c) {
    switch (c[0]) {
      case 'mtbf': return mtbf(c[1], c[2]);
      case 'mttr': return mttr(c[1], c[2]);
      case 'verf': return rd(verf(c[1], c[2]), 2);
      case 'verfzeit': return rd(verfZeit(c[1], c[2]), 2);
      case 'kosten': return kosten(c[1], c[2], c[3], c[4], c[5], c[6]);
      case 'hub': return (c[1] / c[2]) * c[3] * c[4];
      case 'wechsel': return c[1] / (c[2] * c[3]);
      case 'heiz': return rd(c[1] * c[1] / c[2], 2);   /* R = U² : P, Widerstand eines Heizleiters im Betrieb */
      case 'idreh': return rd(c[1] / (Math.sqrt(3) * c[2] * c[3] * c[4]), 2);   /* Bemessungsstrom eines Drehstrommotors: I = P_ab : (Wurzel 3 · U · cos phi · eta) */
      case 'l10h': return rd(1e6 / (60 * c[3]) * Math.pow(c[1] / c[2], c[4]), 0);   /* nominelle Lebensdauer in Stunden: L10h = 1e6 : (60 · n) · (C : P)^p, c = ['l10h', C, P, n, p] (p = 3 für Kugellager) */
      case 'meld': return c[1] * c[2] + c[3];   /* Meldebestand = Verbrauch je Zeiteinheit · Wiederbeschaffungszeit + Sicherheitsbestand */
      case 'oee': return rd(c[1] * c[2] * c[3] / 10000, 2);   /* Gesamtanlageneffektivität in Prozent aus Verfügbarkeit, Leistungsgrad, Qualitätsrate (je in Prozent) */
      case 'fett': return rd(0.005 * c[1] * c[2], 2);   /* Nachschmiermenge in g: G = 0,005 · D · B (D, B in mm) */
      default: return NaN;
    }
  }

  /* ---------------- Wartungsplan (Jahresraster) ---------------- */
  const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MON3 = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  /* Zeile -> 12 Wahrheitswerte (Monate 1..12); iv = Abstand in Monaten, start = erster Monat (1..12) */
  const rowMonths = row => { const a = new Array(12).fill(false); for (let m = row.start; m <= 12; m += row.iv) a[m - 1] = true; return a; };
  const planTruth = plan => plan.rows.map(rowMonths);
  const planCount = plan => planTruth(plan).reduce((n, r) => n + r.filter(Boolean).length, 0);
  const ivText = iv => iv === 1 ? 'jeden Monat' : iv === 12 ? 'einmal im Jahr' : 'alle ' + iv + ' Monate';
  const rowText = row => row.label + ': ' + ivText(row.iv) + (row.iv === 1 ? '' : ', erster Termin im ' + MONTHS[row.start - 1]);
  /* sel = Zeilen mit je 12 Wahrheitswerten (oder Monatsnummern-Liste je Zeile) */
  function checkPlan(plan, sel) {
    const T = planTruth(plan), wrong = []; let miss = 0, extra = 0;
    T.forEach((r, i) => r.forEach((v, j) => { const s = !!(sel && sel[i] && sel[i][j]); if (s !== v) { wrong.push([i, j]); if (v) miss++; else extra++; } }));
    return { ok: wrong.length === 0, wrong, miss, extra, total: planCount(plan) };
  }
  function genPlan(R, level) {
    const n = level >= 3 ? 5 : level === 2 ? 4 : 3, ivs = level === 1 ? [3, 6, 12] : level === 2 ? [2, 3, 6, 12] : [1, 2, 3, 4, 6, 12];
    const labels = shuffle(R, D.planPool).slice(0, n), rows = [];
    labels.forEach(l => { const iv = pick(R, ivs); rows.push({ label: l, iv, start: level === 1 ? ri(R, 1, 3) : ri(R, 1, Math.min(12, Math.max(2, iv))) }); });
    return { rows };
  }

  /* ---------------- Szenario-Engine ---------------- */
  const scenOf = id => D.scenarios.find(s => s.id === id) || null;
  const faultOf = (sc, fid) => sc.faults.find(f => f.id === fid) || null;
  const stepOf = (sc, id) => sc.steps.find(s => s.id === id) || null;
  /* Befund eines Prüfschritts bei einem Fehler: Wahrheitstabelle */
  const resultText = (sc, stepId, fid) => { const s = stepOf(sc, stepId); if (!s) return null; return s.over && s.over[fid] != null ? s.over[fid] : s.def; };

  /* Sicherheitsschritte (für jedes Szenario gleich, 'rest' nur mit Restenergie) */
  function safetySteps(sc) {
    const a = [
      { id: 'frei', g: 'sich', min: 2, label: 'Maschine freischalten (Hauptschalter aus, Energiezufuhr trennen)' },
      { id: 'sich', g: 'sich', min: 2, label: 'Gegen Wiedereinschalten sichern (persönliches Schloss und Schild)' }];
    if (sc.residual) a.push({ id: 'rest', g: 'sich', min: 2, label: sc.residual.label });
    a.push({ id: 'fest', g: 'sich', min: 2, label: 'Energiefreiheit feststellen (Einschaltversuch, Anzeigen, Stillstand prüfen)' });
    a.push({ id: 'start', g: 'sich', min: 3, label: 'Sicherung aufheben und Probelauf starten' });
    return a;
  }
  const SAFE_DONE = { frei: 'Der Hauptschalter ist aus, die Energiezufuhr ist getrennt.', sich: 'Schloss und Schild sind angebracht.', fest: 'Energiefreiheit festgestellt: Einschaltversuch ohne Reaktion, Anzeigen auf null, die Maschine steht. Jetzt darfst du eingreifen.', start: 'Sicherung aufgehoben, Probelauf gestartet. Die Maschine läuft wieder.' };

  /* Idealweg: kleinste Zahl von Prüfschritten (Worst Case), dann kleinste Zeit. Befragen und Unterlagen (g 'doc') sind Hinweise und trennen nicht. */
  const _an = {};
  function analysis(sc) {
    if (_an[sc.id]) return _an[sc.id];
    const steps = sc.steps.filter(s => s.g !== 'doc'), memo = {};
    function solve(ids) {
      if (ids.length <= 1) return { d: 0, c: 0, step: null };
      const key = ids.join('|'); if (memo[key]) return memo[key];
      let best = { d: Infinity, c: Infinity, step: null };
      steps.forEach(s => {
        const groups = {}; ids.forEach(f => { const t = resultText(sc, s.id, f); (groups[t] = groups[t] || []).push(f); });
        const gs = Object.keys(groups).map(k => groups[k]); if (gs.length < 2) return;
        let d = 0, c = 0; gs.forEach(g => { const r = solve(g); d = Math.max(d, r.d); c = Math.max(c, r.c); });
        d += 1; c += s.min;
        if (d < best.d || (d === best.d && c < best.c)) best = { d, c, step: s.id };
      });
      return (memo[key] = best);
    }
    const all = sc.faults.map(f => f.id);
    return (_an[sc.id] = { solve, all, root: solve(all) });
  }
  const distinguishable = sc => isFinite(analysis(sc).root.d);
  const parSteps = sc => analysis(sc).root.d;
  function idealPath(sc, fid) {
    const A = analysis(sc), path = []; let ids = A.all.slice(), guard = 0;
    while (ids.length > 1 && guard++ < 20) {
      const r = A.solve(ids); if (!r.step) break; path.push(r.step);
      const t = resultText(sc, r.step, fid); ids = ids.filter(f => resultText(sc, r.step, f) === t);
    }
    return path;
  }

  /* Zustand starten. opts: seed, fault (feste Ursache), exam */
  function start(sid, opts) {
    opts = opts || {}; const sc = scenOf(sid); if (!sc) return null;
    const seed = opts.seed != null ? opts.seed : String(Math.random()) + Date.now(), R = rng(String(seed) + sid);
    const fid = opts.fault && faultOf(sc, opts.fault) ? opts.fault : pick(R, sc.faults).id;
    return { sid, seed: String(seed), fault: fid, sec: {}, done: {}, log: [], minutes: 0, diag: 0, violations: 0, submitted: null };
  }
  const running = st => !st.sec.frei;
  const isSafe = st => !!st.sec.fest;
  const cost = st => st.minutes * scenOf(st.sid).rate;
  /* Was fehlt noch bis zur Energiefreiheit? */
  function nextSafety(st) { const sc = scenOf(st.sid); if (!st.sec.frei) return 'frei'; if (!st.sec.sich) return 'sich'; if (sc.residual && !st.sec.rest) return 'rest'; if (!st.sec.fest) return 'fest'; return null; }
  const STEP_LABEL = { frei: 'freischalten', sich: 'gegen Wiedereinschalten sichern', rest: 'die Restenergie abbauen', fest: 'die Energiefreiheit feststellen' };
  function addLog(st, e) { e.t = st.minutes; st.log.push(e); return e; }

  function doStep(st, id) {
    const sc = scenOf(st.sid);
    if (st.submitted) return { ok: false, refused: 'closed', msg: 'Die Fehlersuche ist abgeschlossen.' };
    if (id === 'rest' && !sc.residual) return { ok: false, refused: 'na', msg: 'Diese Maschine hat keine Restenergie, die abgebaut werden muss.' };
    const sf = safetySteps(sc).find(s => s.id === id);
    if (sf) {
      if (id === 'start') {
        if (!st.sec.frei) return { ok: false, refused: 'running', msg: 'Die Maschine läuft bereits.' };
        st.sec = {}; st.minutes += sf.min; addLog(st, { id, g: 'sich', label: sf.label, text: SAFE_DONE.start, min: sf.min, kind: 'safety' });
        return { ok: true, kind: 'safety', text: SAFE_DONE.start, min: sf.min };
      }
      if (st.sec[id]) return { ok: false, refused: 'done', msg: 'Dieser Schritt ist schon erledigt.' };
      const need = { frei: [], sich: ['frei'], rest: ['sich'], fest: sc.residual ? ['sich', 'rest'] : ['sich'] }[id];
      const missing = need.find(k => !st.sec[k]);
      if (missing) { const msg = 'Reihenfolge beachten: Zuerst ' + STEP_LABEL[missing] + '.'; addLog(st, { id, g: 'sich', label: sf.label, text: msg, min: 0, kind: 'safety', refused: true }); return { ok: false, refused: 'order', msg }; }
      st.sec[id] = true; st.minutes += sf.min;
      const text = id === 'rest' ? sc.residual.done : SAFE_DONE[id];
      addLog(st, { id, g: 'sich', label: sf.label, text, min: sf.min, kind: 'safety' });
      return { ok: true, kind: 'safety', text, min: sf.min };
    }
    const step = stepOf(sc, id); if (!step) return { ok: false, refused: 'unknown', msg: 'Unbekannter Prüfschritt.' };
    if (st.done[id]) return { ok: false, refused: 'done', msg: 'Diesen Schritt hast du schon gemacht. Das Ergebnis steht im Befund.' };
    if (step.mode === 'run' && !running(st)) {
      const msg = 'Die Maschine ist abgeschaltet. Für diese Prüfung muss sie laufen. Hebe die Sicherung auf und starte den Probelauf.';
      return { ok: false, refused: 'norun', msg };
    }
    if (step.mode === 'safe' && !isSafe(st)) {
      st.violations++; const nx = nextSafety(st);
      const msg = 'Stopp! Für diesen Eingriff muss die Maschine gesichert sein. Es fehlt noch: ' + STEP_LABEL[nx] + '. Der Schritt wurde nicht ausgeführt (Sicherheitsverstoß).';
      addLog(st, { id, g: step.g, label: step.label, text: msg, min: 0, kind: 'diag', refused: true, violation: true });
      return { ok: false, refused: 'unsafe', violation: true, msg };
    }
    const text = resultText(sc, id, st.fault);
    st.done[id] = true; st.diag++; st.minutes += step.min;
    addLog(st, { id, g: step.g, label: step.label, text, min: step.min, kind: 'diag' });
    return { ok: true, kind: 'diag', text, min: step.min };
  }

  /* Auswahl für die Abgabe: Ursachen (alle Fehler des Szenarios) und Maßnahmen (je Fehler eine, dazu zwei allgemeine Falsch-Maßnahmen) */
  function choices(st) {
    const sc = scenOf(st.sid), R = rng(st.seed + 'wahl' + st.sid);
    return {
      causes: shuffle(R, sc.faults.map(f => ({ id: f.id, name: f.name }))),
      measures: shuffle(R, sc.faults.map(f => ({ id: f.id, text: f.measure })).concat(D.measX.map(x => ({ id: x.id, text: x.text }))))
    };
  }
  const STAR_RULE = extra => extra <= 2 ? 3 : extra <= 4 ? 2 : 1;
  function submit(st, causeId, measId) {
    const sc = scenOf(st.sid);
    if (st.submitted) return Object.assign({ again: true }, st.submitted);
    if (!isSafe(st)) {
      st.violations++; const nx = nextSafety(st);
      return { refused: 'unsafe', violation: true, msg: 'Stopp! Vor dem Eingriff (Reparatur) muss die Maschine gesichert sein. Es fehlt noch: ' + STEP_LABEL[nx] + '. Das zählt als Sicherheitsverstoß.' };
    }
    const f = faultOf(sc, st.fault), causeOk = causeId === st.fault, measOk = measId === st.fault, ideal = idealPath(sc, st.fault);
    const stars = STAR_RULE(Math.max(0, st.diag - ideal.length)), safetyPts = Math.max(0, 15 - 5 * st.violations);
    const pts = { cause: causeOk ? 50 : 0, meas: measOk ? 20 : 0, safety: safetyPts, eff: causeOk ? stars * 5 : 0 };
    pts.total = pts.cause + pts.meas + pts.safety + pts.eff;
    const res = {
      ok: causeOk && measOk, causeOk, measOk, violations: st.violations, passed: causeOk && measOk && st.violations === 0,
      diag: st.diag, minutes: st.minutes, cost: cost(st), stars, ideal: ideal.map(i => ({ id: i, label: stepOf(sc, i).label, min: stepOf(sc, i).min })), idealMin: ideal.reduce((n, i) => n + stepOf(sc, i).min, 0),
      pts, fault: { id: f.id, name: f.name, cause: f.cause, measure: f.measure, prev: f.prev },
      chosen: { cause: causeId, measure: measId }
    };
    st.submitted = res; return res;
  }
  /* Was die Oberfläche vor der Abgabe sehen darf (nie den Fehler) */
  function view(st) {
    const sc = scenOf(st.sid);
    return {
      id: sc.id, title: sc.title, machine: sc.machine, intro: sc.intro, symptoms: sc.symptoms.slice(), flow: sc.flow.slice(), rate: sc.rate,
      steps: sc.steps.map(s => ({ id: s.id, g: s.g, mode: s.mode, min: s.min, label: s.label })), safety: safetySteps(sc).map(s => ({ id: s.id, min: s.min, label: s.label })),
      running: running(st), safe: isSafe(st), minutes: st.minutes, cost: cost(st), diag: st.diag, violations: st.violations, next: nextSafety(st)
    };
  }
  const publicState = st => ({ sid: st.sid, sec: Object.assign({}, st.sec), done: Object.assign({}, st.done), log: st.log.map(l => Object.assign({}, l)), minutes: st.minutes, diag: st.diag, violations: st.violations, view: view(st) });

  /* Referenzlösung eines Szenarios (für die Tests): Idealweg ausführen, sichern, richtig abgeben */
  function solveScenario(sid, fault, seed) {
    const st = start(sid, { seed: seed || 'ref', fault }), sc = scenOf(sid), path = idealPath(sc, st.fault);
    path.filter(id => stepOf(sc, id).mode === 'run' || stepOf(sc, id).mode === 'any').forEach(id => doStep(st, id));
    ['frei', 'sich', 'rest', 'fest'].forEach(id => { if (id !== 'rest' || sc.residual) doStep(st, id); });
    path.filter(id => stepOf(sc, id).mode === 'safe').forEach(id => doStep(st, id));
    return { st, res: submit(st, st.fault, st.fault) };
  }

  /* ---------------- Fragen (Aufgaben und Zufallsfragen) ---------------- */
  /* Aufgabe -> Frage-Objekt mit type: choice | multi | match | num */
  function taskQ(t) {
    const q = { id: t.id, type: t.kind, text: t.text, expl: t.expl, svg: t.svg || null };
    if (t.kind === 'choice' || t.kind === 'multi') { q.choices = t.choices; q.correct = t.correct; }
    else if (t.kind === 'match') { q.items = t.items; q.options = t.options; q.correct = t.correct; }
    else if (t.kind === 'num') { q.value = evalCalc(t.calc); q.tol = t.tol; q.unit = t.unit; q.label = t.label; }
    return q;
  }
  const sameSet = (a, b) => a.length === b.length && a.every(x => b.indexOf(x) >= 0);
  /* ans: {c} | {m:[...]} | {a:[...]} | {v:'...'}; Rückgabe {ok, empty?, lines} */
  function checkQ(q, ans) {
    ans = ans || {};
    if (q.type === 'choice') { if (ans.c == null) return { ok: false, empty: true }; return { ok: ans.c === q.correct, given: q.choices[ans.c] }; }
    if (q.type === 'multi') { const m = ans.m || []; if (!m.length) return { ok: false, empty: true }; return { ok: sameSet(m, q.correct), wrongSel: m.filter(x => q.correct.indexOf(x) < 0), missing: q.correct.filter(x => m.indexOf(x) < 0) }; }
    if (q.type === 'match') {
      const a = ans.a || []; if (!q.items.some((x, i) => a[i] != null && a[i] >= 0)) return { ok: false, empty: true };
      const per = q.correct.map((c, i) => a[i] === c); return { ok: per.every(Boolean), per };
    }
    if (q.type === 'num') { const v = parseDe(ans.v); if (!fin(v)) return { ok: false, empty: true }; return { ok: Math.abs(v - q.value) <= q.tol + 1e-9, given: v, value: q.value }; }
    return { ok: false, empty: true };
  }
  /* richtige Antwort für Tests */
  function refAnswer(q) {
    if (q.type === 'choice') return { c: q.correct };
    if (q.type === 'multi') return { m: q.correct.slice() };
    if (q.type === 'match') return { a: q.correct.slice() };
    if (q.type === 'num') return { v: fmtDe(q.value, 2) };
    return {};
  }
  function solutionText(q) {
    if (q.type === 'choice') return q.choices[q.correct];
    if (q.type === 'multi') return q.correct.map(i => q.choices[i]).join(' · ');
    if (q.type === 'match') return q.items.map((it, i) => it + ' → ' + q.options[q.correct[i]]).join('; ');
    if (q.type === 'num') return fAny(q.value) + ' ' + (q.unit || '');
    return '';
  }

  /* ---------------- Zufallsfragen ---------------- */
  /* Vier Antwortmöglichkeiten: richtige + Ablenker, gemischt */
  function mkChoice(R, text, right, others, expl, cat, extra) {
    const o = shuffle(R, others).slice(0, 3), all = shuffle(R, [right].concat(o));
    return Object.assign({ type: 'choice', cat, text, choices: all, correct: all.indexOf(right), expl }, extra || {});
  }
  function genKenn(R, level) {
    level = level || ri(R, 1, 3);
    if (level === 1) {
      if (R() < 0.5) { const n = ri(R, 2, 8), m = ri(R, 2, 20) * 25, b = n * m; return { type: 'num', cat: 'Kennzahlen', text: 'Eine Anlage lief ' + b + ' Betriebsstunden und fiel ' + n + '-mal aus. Wie groß ist die MTBF?', value: m, tol: 0.05, unit: 'h', expl: 'MTBF = Betriebszeit : Ausfälle = ' + b + ' h : ' + n + ' = ' + m + ' h.' }; }
      const n = ri(R, 2, 6), m = pick(R, [1.5, 2, 2.5, 3, 4, 5]), s = rd(n * m, 2);
      return { type: 'num', cat: 'Kennzahlen', text: n + ' Reparaturen dauerten zusammen ' + fmtDe(s, 1) + ' Stunden. Wie groß ist die MTTR?', value: m, tol: 0.05, unit: 'h', expl: 'MTTR = Summe der Reparaturzeiten : Anzahl = ' + fmtDe(s, 1) + ' h : ' + n + ' = ' + fmtDe(m, 1) + ' h.' };
    }
    if (level === 2) {
      if (R() < 0.6) { const a = pick(R, [50, 80, 100, 120, 150, 200, 250]), b = pick(R, [2, 3, 4, 5, 6, 8, 10]), v = rd(verf(a, b), 2); return { type: 'num', cat: 'Kennzahlen', text: 'MTBF = ' + a + ' h, MTTR = ' + b + ' h. Wie hoch ist die Verfügbarkeit in Prozent (zwei Nachkommastellen)?', value: v, tol: 0.1, unit: '%', expl: 'Verfügbarkeit = MTBF : (MTBF + MTTR) = ' + a + ' : ' + (a + b) + ' = ' + fmtDe(v / 100, 4) + ', also ' + fmtDe(v, 2) + ' %.' }; }
      const p = pick(R, [2000, 4000, 8000]), s = pick(R, [20, 40, 50, 80, 100]), v = rd(verfZeit(p, s), 2);
      return { type: 'num', cat: 'Kennzahlen', text: 'Geplante Laufzeit ' + p + ' h, davon Stillstand durch Störungen ' + s + ' h. Wie hoch ist die Verfügbarkeit in Prozent?', value: v, tol: 0.1, unit: '%', expl: 'Verfügbarkeit = (geplante Zeit − Stillstand) : geplante Zeit = (' + p + ' − ' + s + ') : ' + p + ' = ' + fmtDe(v, 2) + ' %.' };
    }
    const st = ri(R, 2, 10), kh = pick(R, [200, 300, 450, 600, 800]), pe = ri(R, 1, 3), rh = ri(R, 2, 6), lo = pick(R, [40, 45, 48, 52]), te = pick(R, [0, 120, 250, 320, 480]), v = kosten(st, kh, pe, rh, lo, te);
    return { type: 'num', cat: 'Kennzahlen', text: 'Stillstand ' + st + ' h bei ' + kh + ' € Ausfallkosten je Stunde. ' + pe + ' Mitarbeiter reparieren je ' + rh + ' h zu ' + lo + ' € je Stunde. Ersatzteile: ' + te + ' €. Wie hoch sind die Gesamtkosten?', value: v, tol: 0.5, unit: '€', expl: 'Stillstand: ' + st + ' · ' + kh + ' = ' + (st * kh) + ' €. Lohn: ' + pe + ' · ' + rh + ' · ' + lo + ' = ' + (pe * rh * lo) + ' €. Ersatzteile: ' + te + ' €. Summe: ' + v + ' €.' };
  }
  function genQuick(R, cat, level) {
    if (!cat || cat === 'mixed') cat = pick(R, ['Begriffe', 'Schmierung', 'Schäden', 'Kennzahlen', 'Sicherheit']);
    if (cat === 'Begriffe') {
      if (R() < 0.35) { const it = pick(R, D.strategieItems), s = D.strategien.find(x => x.id === it.k); return mkChoice(R, 'Welche Instandhaltungsstrategie steckt dahinter? „' + it.t + '“', s.name, D.strategien.filter(x => x.id !== it.k).map(x => x.name).concat(['Verbesserung']), s.long + ': ' + s.was, cat); }
      const it = pick(R, D.begriffeItems), b = D.begriffe.find(x => x.id === it.k);
      return mkChoice(R, 'Zu welchem Teil der Instandhaltung gehört das? „' + it.t + '“', b.name, D.begriffe.filter(x => x.id !== it.k).map(x => x.name), b.name + ': ' + b.def, cat);
    }
    if (cat === 'Schmierung') {
      if (R() < 0.5) { const it = pick(R, D.schmierItems), s = D.schmier.find(x => x.id === it.k); return mkChoice(R, 'Welche Schmierstoffart passt zu: ' + it.t + '?', s.name, D.schmier.filter(x => x.id !== it.k).map(x => x.name).concat(['Wasser']), s.name + ': ' + s.eig, cat); }
      const row = pick(R, D.schmierplan), wrong = D.schmierplan.filter(x => x.stelle !== row.stelle && x.stoff !== row.stoff).map(x => x.stoff);
      return mkChoice(R, 'Im Schmierplan fehlt der Schmierstoff. Schmierstelle: ' + row.stelle + '. Was gehört hinein?', row.stoff, wrong, 'Laut Schmierplan: ' + row.stelle + ' – ' + row.stoff + ' (' + row.intervall + ').', cat);
    }
    if (cat === 'Schäden') {
      const s = pick(R, D.schaeden), u = D.ursachen.find(x => x.id === s.ursache);
      return mkChoice(R, s.teil + ': ' + s.desc + ' Was ist die wahrscheinlichste Ursache?', u.name, D.ursachen.filter(x => x.id !== s.ursache).map(x => x.name), s.name + ': ' + s.warum + ' Maßnahme: ' + s.mass, cat, { dmg: s.id });
    }
    if (cat === 'Kennzahlen') return genKenn(R, level);
    /* Sicherheit */
    if (R() < 0.6) { const r = pick(R, D.sicherheit.rest); return mkChoice(R, 'Welche Maßnahme gehört zur Restenergie „' + r.name + '“ (' + r.bsp + ')?', r.mass, D.sicherheit.rest.filter(x => x.id !== r.id).map(x => x.mass), r.name + ': ' + r.mass + '.', cat); }
    const o = D.sicherheit.ablauf, i = ri(R, 0, o.length - 1);
    return mkChoice(R, 'Welcher Schritt steht im Prüfplatz des Labs an Stelle ' + (i + 1) + ' der Sicherung (von 4)?', o[i], o.filter((x, j) => j !== i).concat(['Maschine anlaufen lassen']), 'Reihenfolge: ' + o.map((x, j) => (j + 1) + ' ' + x).join(', ') + '.', cat);
  }

  /* ---------------- Referenz für Aufgaben (Tests) ---------------- */
  function referenceTask(t) {
    if (t.kind === 'scen') { const r = solveScenario(t.scen, t.fault, 'task-' + t.id); return { ok: r.res.passed, res: r.res }; }
    if (t.kind === 'plan') { const sel = planTruth(t.plan); return { ok: checkPlan(t.plan, sel).ok }; }
    const q = taskQ(t); return { ok: checkQ(q, refAnswer(q)).ok };
  }

  const api = {
    D, parseDe, fmtDe, fAny, hashStr, rng, ri, pick, shuffle,
    mtbf, mttr, verf, verfZeit, kosten, evalCalc,
    MONTHS, MON3, rowMonths, planTruth, planCount, checkPlan, genPlan, ivText, rowText,
    scenOf, faultOf, stepOf, resultText, safetySteps, analysis, distinguishable, parSteps, idealPath, STAR_RULE,
    start, doStep, choices, submit, view, publicState, cost, isSafe, running, nextSafety, solveScenario,
    taskQ, checkQ, refAnswer, solutionText, genQuick, genKenn, referenceTask, mkChoice
  };
  root.INS_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
