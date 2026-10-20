'use strict';
/* Tonfunk Regelungstechnik-Lab: Tab "Rechnen" (WP3b).
   Sechs Rechner und ein Übungsgenerator. ALLE Rechnungen laufen über REG_CORE (rules.apply, formulas, scale, routh, ultimate, controller, stepMetrics, fitStep, exercise);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Fehlt der Kern, erscheint ein Hinweis statt Zahlen.
   Schnittstelle (SPEC 6.8): window.REG_UI_EXT.calc.render(host, api), api = { S, rig, setTab, loadExample, startTask, toast, esc, stat, lsGet, lsSet, REG_CORE }.
   Die reinen Rechenfunktionen (ohne DOM) hängen unter REG_UI_EXT.calc.fn und werden von test_regui_ext.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const CORE = () => root.REG_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const pn = s => { const C = CORE(); if (typeof s === 'number') return fin(s) ? s : NaN; const t = String(s == null ? '' : s); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(t); return fin(v) ? v : NaN; } const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN; };
  const TDIV = { s: 1, min: 60, h: 3600 };
  const pick = (o, keys) => { if (typeof o === 'number') return o; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (regcore.js fehlt). Ohne ihn gibt es hier keine Zahlen.';

  /* ============================================================ reine Rechenfunktionen (alle rufen REG_CORE) */
  const METHODS = ['zn-schwing', 'zn-sprung', 'chr-fuehr-0', 'chr-fuehr-20', 'chr-stoer-0', 'chr-stoer-20', 'tsumme'];
  const MKIND = { 'zn-schwing': 'swing', 'zn-sprung': 'step', 'chr-fuehr-0': 'step', 'chr-fuehr-20': 'step', 'chr-stoer-0': 'step', 'chr-stoer-20': 'step', tsumme: 'tsum' };
  const MNAME = { 'zn-schwing': 'Ziegler-Nichols (Schwingversuch)', 'zn-sprung': 'Ziegler-Nichols (Sprungantwort)', 'chr-fuehr-0': 'CHR Führung, aperiodisch', 'chr-fuehr-20': 'CHR Führung, 20 % Überschwingen', 'chr-stoer-0': 'CHR Störung, aperiodisch', 'chr-stoer-20': 'CHR Störung, 20 % Überschwingen', tsumme: 'T-Summe (Betragsoptimum)' };
  const TYPES = ['P', 'PI', 'PID'];
  function methodName(id) { const C = CORE(), t = C && C.rules && C.rules.table, e = Array.isArray(t) ? t.find(x => x && x.id === id) : (t && t[id]); return (e && (e.name || e.title)) || MNAME[id] || id; }
  const warnOf = v => (Array.isArray(v) ? v : (v && v.warn) || []);
  /* Einstellregeln: alle Methoden und Reglerarten nebeneinander; k in Sekunden */
  function rulesAll(k) {
    const C = CORE(); if (!C || !C.rules || typeof C.rules.apply !== 'function') return null;
    return METHODS.map(id => {
      const res = {}; TYPES.forEach(t => { try { res[t] = C.rules.apply(id, k, t); } catch (e) { res[t] = { ok: false, why: 'Die Berechnung ist fehlgeschlagen.' }; } });
      let warn = []; try { warn = typeof C.rules.validity === 'function' ? warnOf(C.rules.validity(id, k)) : []; } catch (e) { warn = []; }
      return { id, name: methodName(id), kind: MKIND[id], res, warn };
    });
  }
  /* Stabilität: Routh/Hurwitz, Koeffizienten höchster Grad zuerst, getrennt durch Leerzeichen oder Semikolon */
  function parseCoef(str) { return String(str == null ? '' : str).split(/[;\s]+/).filter(Boolean).map(pn); }
  function routhCalc(str) {
    const C = CORE(); if (!C || typeof C.routh !== 'function') return { ok: false, why: NOCORE };
    const coef = parseCoef(str); if (coef.length < 2 || coef.length > 5 || coef.some(c => !fin(c))) return { ok: false, why: 'Gib 2 bis 5 Koeffizienten ein (Polynom bis 4. Grades), höchster Grad zuerst, getrennt durch Leerzeichen oder Semikolon.' };
    if (coef[0] === 0) return { ok: false, why: 'Der erste Koeffizient (höchster Grad) darf nicht 0 sein.' };
    let r; try { r = C.routh(coef); } catch (e) { return { ok: false, why: 'Die Berechnung ist fehlgeschlagen.' }; }
    return Object.assign({ coef }, r || { ok: false, why: 'Keine Auswertung möglich.' });
  }
  /* Kritische Verstärkung einer Strecke aus Zeitkonstanten (Sekunden); T = 0 heißt: nicht vorhanden */
  function kkritCalc(v) {
    const C = CORE(); if (!C || typeof C.ultimate !== 'function') return { ok: false, why: NOCORE };
    const blocks = []; if (!(v.Ks > 0)) return { ok: false, why: 'Ks muss größer 0 sein.' };
    blocks.push({ t: 'K', K: v.Ks }); let n = 0; [v.T1, v.T2, v.T3].forEach(T => { if (fin(T) && T > 0) { blocks.push({ t: 'PT1', T }); n++; } }); if (!n) return { ok: false, why: 'Gib mindestens eine Zeitkonstante größer 0 ein.' };
    if (fin(v.Tt) && v.Tt > 0) blocks.push({ t: 'Tt', Tt: v.Tt });
    let u; try { u = C.ultimate(blocks); } catch (e) { return { ok: false, why: 'Die Berechnung ist fehlgeschlagen.' }; }
    return u && u.ok === false ? { ok: false, why: u.why, blocks } : Object.assign({ ok: true, blocks }, u);
  }
  /* Formeln: formulas.<id> {args:["Kp","Xp [%]",…], fn(...Werte), explain(...Werte) → {ok,value,unit,steps}} (positionell nach args).
     Startwerte der Eingabefelder stehen hier (FDEF), weil der Kern keine Beispielwerte liefert. */
  const FDEF = {
    xp: [2], kp: [50], v0: [2, 1.5], eblP: [50, 3], tclP1: [50, 3], piStep: [2, 10, 20, 20], pdStep: [2, 10, 5, 1], tnLesen: [10, 80, 40], ks: [15, 10], regelbarkeit: [60, 10], kkrit: [1, 10, 5, 2],
    skal: [13824, 0, 100], maProzent: [12], abtastVerlust: [0.5, 1], ed: [16, 9.6], schaltfreq: [25.6], heizbedarf: [100, 21, -5, 0]
  };
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!f) return null; if (Array.isArray(f)) return f.find(x => x && x.id === id) || null; const e = f[id]; return e && typeof e === 'object' ? (e.id ? e : Object.assign({ id }, e)) : null; }
  function formulaInputs(f) {
    if (f && Array.isArray(f.inputs) && f.inputs.length) return f.inputs.map(i => ({ key: i.key, label: i.label || i.key, unit: i.unit || '', def: i.def }));
    const def = (FDEF[f && f.id]) || [];
    return ((f && f.args) || []).map((a, i) => { const m = String(a).match(/^(.*?)\s*(?:\[(.*)\])?$/); return { key: m[1], label: m[1], unit: m[2] || '', def: def[i] }; });
  }
  function formulaCalc(id, vals) {
    const f = formulaById(id); if (!f || (typeof f.fn !== 'function' && typeof f.explain !== 'function')) return { ok: false, why: CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE };
    const ins = formulaInputs(f), o = {}; ins.forEach(i => { o[i.key] = pn(vals ? vals[i.key] : undefined); });
    if (ins.some(i => !fin(o[i.key]))) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).', f };
    const pos = ins.map(i => o[i.key]); let r = null;
    if (Array.isArray(f.inputs)) { try { r = f.fn(o); } catch (e) { r = null; } if (!(fin(r) || (r && typeof r === 'object'))) { try { r = f.fn(...pos); } catch (e) { r = null; } } }
    else { if (typeof f.explain === 'function') { try { r = f.explain(...pos); } catch (e) { r = null; } } if ((!r || r.ok === false) && typeof f.fn === 'function') { let v = NaN; try { v = f.fn(...pos); } catch (e) { v = NaN; } if (fin(v)) r = { ok: true, value: v, unit: f.unit }; } }
    if (r && r.ok === false) return { ok: false, why: r.why || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    const v = pick(r, ['value', 'v', 'result', 'y']);
    if (!fin(v)) return { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    return { ok: true, f, value: v, unit: (r && r.unit) || f.unit || '', steps: (r && r.steps) || null, inputs: ins.map(i => ({ label: i.label, unit: i.unit, value: o[i.key] })) };
  }
  /* Reglerausgang y(t) bei Sprung der Regeldifferenz: Kern-Regler (controller), kein eigener Regelalgorithmus */
  function ctrlStepResponse(v) {
    const C = CORE(); if (!C || typeof C.controller !== 'function') return { ok: false, why: NOCORE };
    if (!(v.Kp >= 0) || !fin(v.e) || !(v.tEnd > 0)) return { ok: false, why: 'Kp, e und die Dauer müssen Zahlen sein (Kp ≥ 0, Dauer > 0).' };
    const tp = v.type, h = v.tEnd / 400;
    if (/I/.test(tp) && !(v.Tn > 0)) return { ok: false, why: 'Die Nachstellzeit Tn muss größer 0 sein.' };
    const spec = { type: tp, Kp: v.Kp, Tn: v.Tn || 10, Tv: /D/.test(tp) ? (v.Tv || 0) : 0, N: 10, Ta: h, u0: 0, ymin: -1e9, ymax: 1e9, aw: 'aus', dOn: 'e', dir: 'direkt' };
    let c; try { c = C.controller(spec, h); } catch (e) { return { ok: false, why: 'Der Regler konnte nicht erzeugt werden.' }; }
    if (!c || c.ok === false || typeof c.step !== 'function') return { ok: false, why: (c && c.why) || 'Der Regler konnte nicht erzeugt werden.' };
    const t = [], y = []; for (let k = 0; k <= 400; k++) { const yy = c.step(k === 0 ? 0 : v.e, 0); t.push(k * h); y.push(yy); }
    return { ok: true, t, y, h };
  }
  /* SPS-Skalierung: nur Kernfunktionen (scale.*); Fehlerfelder (fault, over, text) werden unverändert weitergereicht */
  function sc(f, ...a) { const C = CORE(); if (!C || !C.scale || typeof C.scale[f] !== 'function') return { ok: false, why: NOCORE }; let r; try { r = C.scale[f](...a); } catch (e) { return { ok: false, why: 'Die Berechnung ist fehlgeschlagen.' }; } return typeof r === 'object' && r ? Object.assign({ ok: true }, r, { value: pick(r, ['value', 'pct', 'p', 'eng', 'raw', 'mA', 'ma']) }) : { ok: true, value: r }; }
  function spsCalc(v) {
    const out = {}; const rawMax = 27648;
    if (fin(v.raw)) { out.pct = sc('rawInfo', v.raw); if (fin(v.lo) && fin(v.hi)) out.eng = sc('rawToEng', v.raw, v.lo, v.hi); }
    if (fin(v.pct)) { out.raw = sc('pctToRaw', v.pct, rawMax); out.ma = sc('pctToMa', v.pct); }
    if (fin(v.mA)) out.pctFromMa = sc('maInfo', v.mA);
    return out;
  }

  /* ---- Kenngrößen aus einer Sprungantwort ablesen: 20 vorbereitete Szenarien, simuliert mit Kern-Strecke und Kern-Regler ---- */
  const S1 = (K, T) => [{ t: 'K', K }, { t: 'PT1', T }];
  const SCEN = [
    { n: 'P-Regler an PT1, V0 = 1', open: false, blocks: S1(1, 10), ctrl: { type: 'P', Kp: 1 }, dw: 20, T: 120 },
    { n: 'P-Regler an PT1, V0 = 2', open: false, blocks: S1(1, 10), ctrl: { type: 'P', Kp: 2 }, dw: 20, T: 120 },
    { n: 'P-Regler an PT1, V0 = 4', open: false, blocks: S1(0.5, 20), ctrl: { type: 'P', Kp: 8 }, dw: 20, T: 160 },
    { n: 'P-Regler an PT2, V0 = 5', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }], ctrl: { type: 'P', Kp: 5 }, dw: 20, T: 150 },
    { n: 'P-Regler an PT2, V0 = 3', open: false, blocks: [{ t: 'K', K: 1.5 }, { t: 'PT1', T: 8 }, { t: 'PT1', T: 4 }], ctrl: { type: 'P', Kp: 2 }, dw: 20, T: 120 },
    { n: 'PI-Regler, Tn = T', open: false, blocks: S1(1, 10), ctrl: { type: 'PI', Kp: 1, Tn: 10 }, dw: 20, T: 80 },
    { n: 'PI-Regler, leicht überschwingend', open: false, blocks: S1(1, 10), ctrl: { type: 'PI', Kp: 3, Tn: 3 }, dw: 20, T: 80 },
    { n: 'PI-Regler, scharf', open: false, blocks: S1(1, 10), ctrl: { type: 'PI', Kp: 5, Tn: 2 }, dw: 20, T: 80 },
    { n: 'PI-Regler an PT2', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }], ctrl: { type: 'PI', Kp: 2, Tn: 12 }, dw: 20, T: 150 },
    { n: 'PI-Regler an PT3', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }, { t: 'PT1', T: 2 }], ctrl: { type: 'PI', Kp: 1.5, Tn: 20 }, dw: 20, T: 200 },
    { n: 'PI-Regler an PT3, stark schwingend', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }, { t: 'PT1', T: 2 }], ctrl: { type: 'PI', Kp: 3, Tn: 25 }, dw: 20, T: 300 },
    { n: 'PID-Regler an PT3', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }, { t: 'PT1', T: 2 }], ctrl: { type: 'PID', Kp: 3, Tn: 16, Tv: 4 }, dw: 20, T: 200 },
    { n: 'PI-Regler an PT1 mit Totzeit', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'Tt', Tt: 2 }], ctrl: { type: 'PI', Kp: 1.5, Tn: 10 }, dw: 20, T: 120 },
    { n: 'P-Regler an I-Strecke mit Verzögerung', open: false, blocks: [{ t: 'I', Ki: 0.1 }, { t: 'PT1', T: 2 }], ctrl: { type: 'P', Kp: 2 }, dw: 20, T: 80 },
    { n: 'PD-Regler an PT2', open: false, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }], ctrl: { type: 'PD', Kp: 4, Tv: 4 }, dw: 20, T: 150 },
    { n: 'Strecke PT1 ohne Regler', open: true, blocks: S1(1.5, 12), dy: 10, T: 80 },
    { n: 'Strecke PT2 ohne Regler', open: true, blocks: [{ t: 'K', K: 0.8 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 6 }], dy: 10, T: 120 },
    { n: 'Strecke PT3 ohne Regler', open: true, blocks: [{ t: 'K', K: 2 }, { t: 'PT1', T: 10 }, { t: 'PT1', T: 5 }, { t: 'PT1', T: 2 }], dy: 10, T: 150 },
    { n: 'I-Strecke ohne Regler', open: true, blocks: [{ t: 'I', Ki: 0.05 }, { t: 'PT1', T: 4 }], dy: 5, T: 80 },
    { n: 'Strecke PT1 mit Totzeit ohne Regler', open: true, blocks: [{ t: 'K', K: 1 }, { t: 'PT1', T: 15 }, { t: 'Tt', Tt: 5 }], dy: 10, T: 100 }
  ];
  const QUANT = {
    ueber: { q: 'Wie groß ist die Überschwingweite (in % des Sollwertsprungs)?', unit: '%', hint: 'Die Überschwingweite misst du vom Sollwert (gestrichelte Linie) bis zum höchsten Punkt, bezogen auf die Höhe des Sprungs.' },
    tAus2: { q: 'Wie groß ist die Ausregelzeit (±2 % des Sprungs)?', unit: 's', hint: 'Die Ausregelzeit ist der Zeitpunkt, ab dem die Kurve dauerhaft im Band von ±2 % des Sprungs um den Sollwert bleibt.' },
    tAn: { q: 'Wie groß ist die Anregelzeit (erster Eintritt in ±2 % des Sprungs)?', unit: 's', hint: 'Die Anregelzeit endet, wenn die Kurve zum ersten Mal ins Band von ±2 % des Sprungs um den Sollwert läuft.' },
    ebl: { q: 'Wie groß ist die bleibende Regelabweichung (in % des Messbereichs, Sollwert minus Endwert)?', unit: '%', hint: 'Die bleibende Abweichung ist Sollwert minus Endwert der Kurve; eine Kurve unter dem Sollwert hat eine positive Abweichung.' },
    art: { q: 'Hat die Strecke einen Ausgleich (mit Ausgleich: P-Strecke) oder keinen (ohne Ausgleich: I-Strecke)?', unit: '', choice: true, hint: 'Eine Strecke mit Ausgleich läuft auf einen festen Endwert zu, eine ohne Ausgleich steigt dauernd weiter.' },
    ks: { q: 'Wie groß ist die Streckenverstärkung Ks (Δx / Δy, beide in %)?', unit: '', hint: 'Lies den Endwert ab und teile die Änderung der Regelgröße durch den Sprung der Stellgröße.' }
  };
  function simScen(i) {
    const C = CORE(); if (!C || typeof C.plant !== 'function' || typeof C.stepMetrics !== 'function') return { ok: false, why: NOCORE };
    const s = SCEN[((i % SCEN.length) + SCEN.length) % SCEN.length], h = s.T / 1500, nT = Math.round(s.T / h), t0 = s.T * 0.05, t = [], x = [];
    let P; try { P = C.plant({ blocks: s.blocks, op: { y: 50, x: 50 } }, h); } catch (e) { return { ok: false, why: 'Die Strecke konnte nicht erzeugt werden.' }; }
    if (!P || typeof P.step !== 'function') return { ok: false, why: 'Die Strecke konnte nicht erzeugt werden.' };
    if (s.open) {
      for (let k = 0; k <= nT; k++) { const tt = k * h; x.push(P.step(tt >= t0 ? 50 + s.dy : 50, 0)); t.push(tt); }
      let fit = null; try { const i0 = Math.round(t0 / h); fit = typeof C.fitStep === 'function' ? C.fitStep(t.slice(i0).map(v => v - t0), x.slice(i0), s.dy, {}) : null; } catch (e) { fit = null; }
      return { ok: true, idx: i0idx(i), s, t, x, t0, h, open: true, fit };
    }
    let K; try { K = C.controller(Object.assign({ Ta: h, u0: 50, ymin: 0, ymax: 100, N: 10, dOn: 'x', aw: 'klemmen', dir: 'direkt', Tn: 10, Tv: 0 }, s.ctrl), h); } catch (e) { return { ok: false, why: 'Der Regler konnte nicht erzeugt werden.' }; }
    if (!K || K.ok === false || typeof K.step !== 'function') return { ok: false, why: (K && K.why) || 'Der Regler konnte nicht erzeugt werden.' };
    let xx = 50; for (let k = 0; k <= nT; k++) { const tt = k * h, w = tt >= t0 ? 50 + s.dw : 50, y = K.step(w, xx); xx = P.step(y, 0); x.push(xx); t.push(tt); }
    let m; try { m = C.stepMetrics(t, x, { w0: 50, w1: 50 + s.dw, t0, tol: 0.02 }); } catch (e) { m = null; }
    return { ok: true, idx: i0idx(i), s, t, x, t0, h, open: false, metrics: m };
  }
  const i0idx = i => ((i % SCEN.length) + SCEN.length) % SCEN.length;
  /* wahre Werte aus derselben Funktion wie die Tafel (stepMetrics) bzw. fitStep */
  function readTruth(sim, q) {
    if (!sim || !sim.ok) return { ok: false, why: (sim && sim.why) || NOCORE };
    if (sim.open) {
      const f = sim.fit; if (!f || f.ok === false) return { ok: false, why: (f && f.why) || 'Die automatische Auswertung ist nicht möglich.' };
      if (q === 'art') return { ok: true, value: f.art, text: f.art === 'I' ? 'ohne Ausgleich (I-Strecke)' : 'mit Ausgleich (P-Strecke)' };
      if (q === 'ks') return f.art === 'I' || !fin(f.Ks) ? { ok: false, why: 'Diese Strecke hat kein Ks (ohne Ausgleich).' } : { ok: true, value: f.Ks, unit: '', cell: 0.1 * Math.abs(f.Ks) };
      return { ok: false, why: 'Diese Größe gibt es bei der offenen Strecke nicht.' };
    }
    const m = sim.metrics; if (!m || m.ok === false) return { ok: false, why: (m && m.why) || 'Keine Auswertung möglich.' };
    const dw = sim.s.dw, G = gridOf(sim), tick = G.xStep;
    if (q === 'ueber') return fin(m.ueberPct) ? { ok: true, value: m.ueberPct, unit: '%', cell: 100 * G.yStep / dw } : { ok: false, why: 'Keine Überschwingweite.' };
    if (q === 'tAus2') return fin(m.tAus2) ? { ok: true, value: m.tAus2, unit: 's', cell: tick } : { ok: false, why: 'nicht ausgeregelt' };
    if (q === 'tAn') return fin(m.tAn) ? { ok: true, value: m.tAn, unit: 's', cell: tick } : { ok: false, why: 'Die Kurve erreicht das Band nie.' };
    if (q === 'ebl') return fin(m.ebl) ? { ok: true, value: m.ebl, unit: '%', cell: G.yStep } : { ok: false, why: 'Keine bleibende Abweichung.' };
    return { ok: false, why: 'Unbekannte Größe.' };
  }
  /* Achsen des Ablese-Diagramms (Zeichnung und Toleranz benutzen dasselbe Gitter) */
  function gridOf(sim) { const s = sim.s, lo = Math.min(...sim.x), hi = Math.max(...sim.x); let yMin, yMax; if (s.open) { yMin = Math.floor(Math.min(lo, 50) - 1); yMax = Math.ceil(hi + 1); } else { yMin = Math.floor(Math.min(lo, 50) - 1); yMax = Math.ceil(Math.max(hi, 50 + s.dw) + 1); } const yStep = niceTick(yMax - yMin, 10); yMin = Math.floor(yMin / yStep) * yStep; yMax = Math.ceil(yMax / yStep) * yStep; return { yMin, yMax, yStep, xStep: niceTick(s.T, 10) }; }
  function niceTick(range, n) { n = n || 10; const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag; }
  /* Welche Fragen gibt es zu einem Szenario? Nur solche mit sinnvoller Antwort (Überschwingen mindestens 2 %, ausgeregelt, nicht ausgeregelt gibt keine Zeit) */
  function readQuestions(sim) {
    if (!sim || !sim.ok) return [];
    if (sim.open) return ['art'].concat(readTruth(sim, 'ks').ok ? ['ks'] : []);
    const m = sim.metrics, out = []; if (!m || m.ok === false) return out;
    if (fin(m.ueberPct) && m.ueberPct >= 2) out.push('ueber'); if (fin(m.tAus2) && m.settled !== false) out.push('tAus2'); if (fin(m.tAn)) out.push('tAn'); if (fin(m.ebl) && Math.abs(m.ebl) >= 1) out.push('ebl');
    return out;
  }
  /* Eingabe prüfen: Toleranz 5 % oder ein Gitterkästchen; Texte nennen nur Geprüftes (Richtung, verwechselte Größe) */
  function readCheck(sim, q, input) {
    const tr = readTruth(sim, q); if (!tr.ok) return { ok: false, text: tr.why };
    if (q === 'art') { const v = String(input); return v === tr.value ? { ok: true, text: 'Richtig: ' + tr.text + '.' } : { ok: false, text: 'Nicht ganz. ' + QUANT.art.hint }; }
    const x = pn(input); if (!fin(x)) return { ok: false, text: 'Das ist keine Zahl. Schreibe zum Beispiel 2,5.' };
    const tol = Math.max(0.05 * Math.abs(tr.value), tr.cell || 0);
    if (Math.abs(x - tr.value) <= tol) return { ok: true, text: 'Richtig. Toleranz: 5 % oder ein Gitterkästchen.' };
    let extra = '';
    const other = { tAn: 'tAus2', tAus2: 'tAn', ueber: 'ebl', ebl: 'ueber' }[q];
    if (other) { const o = readTruth(sim, other); if (o.ok && Math.abs(x - o.value) <= Math.max(0.05 * Math.abs(o.value), o.cell || 0)) extra = ' ' + { tAn: 'Das ist die Ausregelzeit, gefragt ist die Anregelzeit.', tAus2: 'Das ist die Anregelzeit, gefragt ist die Ausregelzeit.', ueber: 'Das ist die bleibende Abweichung, gefragt ist die Überschwingweite.', ebl: 'Das ist die Überschwingweite, gefragt ist die bleibende Abweichung.' }[q]; }
    return { ok: false, text: 'Dein Wert ist zu ' + (x < tr.value ? 'klein' : 'groß') + '.' + extra + ' ' + QUANT[q].hint };
  }

  /* ---- Übungsgenerator: REG_CORE.exercise ---- */
  const KINDS = [['xp', 'Proportionalbereich'], ['v0', 'Kreisverstärkung'], ['ebl', 'Bleibende Abweichung'], ['piStep', 'PI-Sprungantwort'], ['tnLesen', 'Nachstellzeit ablesen'], ['ks', 'Streckenverstärkung'], ['regelbarkeit', 'Regelbarkeit'], ['znSchwing', 'Ziegler-Nichols (Schwingversuch)'],
    ['znSprung', 'Ziegler-Nichols (Sprungantwort)'], ['chr', 'CHR'], ['tsumme', 'T-Summe'], ['stabil', 'Stabilität aus Reserven'], ['routh', 'Routh-Hurwitz'], ['skalierung', 'Skalierung 0 bis 27648'], ['maProzent', '4 bis 20 mA'], ['zweipunkt', 'Zweipunktregler'], ['abtast', 'Abtastzeit']];
  function newExercise(kind, seed) {
    const C = CORE(); if (!C || typeof C.exercise !== 'function') return { ok: false, why: NOCORE };
    let ex; try { ex = C.exercise(kind, seed); } catch (e) { ex = null; }
    if (!ex || ex.ok === false) return { ok: false, why: (ex && ex.why) || 'Diese Übung gibt es nicht.' };
    return { ok: true, ex, kind, seed };
  }
  function exOptions(ex) { const o = ex && (ex.options || (ex.answer && ex.answer.options)); return Array.isArray(o) ? o.map(x => (x && typeof x === 'object' ? { value: x.value, label: x.label != null ? x.label : String(x.value) } : { value: x, label: String(x) })) : null; }

  /* ============================================================ SVG-Zeichnung (Gitter, Kurven) */
  function svgPlot(o) {
    const W = 360, H = o.h || 190, L = 40, R = 10, T = 10, B = 28, pw = W - L - R, ph = H - T - B;
    let xmin = o.xMin, xmax = o.xMax, ymin = o.yMin, ymax = o.yMax;
    const X = v => L + pw * (v - xmin) / (xmax - xmin), Y = v => T + ph * (1 - (v - ymin) / (ymax - ymin)), xs = o.xStep || niceTick(xmax - xmin, 8), ys = o.yStep || niceTick(ymax - ymin, 6);
    let g = '';
    for (let v = Math.ceil(xmin / xs - 1e-9) * xs; v <= xmax + xs * 1e-6; v += xs) { const x = X(v); g += `<line x1="${x.toFixed(1)}" y1="${T}" x2="${x.toFixed(1)}" y2="${T + ph}" stroke="#2c343e" stroke-width="1"/><text x="${x.toFixed(1)}" y="${H - 14}" fill="#8d99a6" font-size="9.5" text-anchor="middle" font-family="system-ui">${esc(fauto(+v.toPrecision(8)))}</text>`; }
    for (let v = Math.ceil(ymin / ys - 1e-9) * ys; v <= ymax + ys * 1e-6; v += ys) { const y = Y(v); g += `<line x1="${L}" y1="${y.toFixed(1)}" x2="${L + pw}" y2="${y.toFixed(1)}" stroke="#2c343e" stroke-width="1"/><text x="${L - 4}" y="${(y + 3).toFixed(1)}" fill="#8d99a6" font-size="9.5" text-anchor="end" font-family="system-ui">${esc(fauto(+v.toPrecision(8)))}</text>`; }
    g += `<rect x="${L}" y="${T}" width="${pw}" height="${ph}" fill="none" stroke="#4a5663"/>`;
    (o.hlines || []).forEach(l => { g += `<line x1="${L}" y1="${Y(l.y).toFixed(1)}" x2="${L + pw}" y2="${Y(l.y).toFixed(1)}" stroke="${l.color || '#ffb340'}" stroke-width="1.4" stroke-dasharray="5 4"/>`; });
    (o.series || []).forEach(s => { const pts = s.pts.filter(p => fin(p[0]) && fin(p[1])).map(p => X(p[0]).toFixed(1) + ',' + clamp(Y(p[1]), T - 4, T + ph + 4).toFixed(1)); g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${s.color || '#3b9eff'}" stroke-width="${s.w || 2.2}" stroke-linejoin="round"${s.dash ? ` stroke-dasharray="${s.dash}"` : ''}/>`; });
    g += `<text x="${L + pw / 2}" y="${H - 2}" fill="#8d99a6" font-size="10" text-anchor="middle" font-family="system-ui">${esc(o.xLabel || '')}</text><text x="10" y="${T + ph / 2}" fill="#8d99a6" font-size="10" text-anchor="middle" font-family="system-ui" transform="rotate(-90 10 ${T + ph / 2})">${esc(o.yLabel || '')}</text>`;
    return `<svg class="dr" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Diagramm')}">${g}</svg>`;
  }

  /* ============================================================ Oberfläche */
  const ST = { unit: null, vals: {}, scen: null, q: null, scenAns: '', scenRes: null, ex: {}, calc: {}, ctrl: { type: 'PI', Kp: '2', e: '10', Tn: '20', Tv: '5', tEnd: '60' }, sps: { raw: '13824', lo: '0', hi: '100', pct: '50', mA: '12' }, rt: '1 6 11 6', kk: { Ks: '1', T1: '10', T2: '5', T3: '2', Tt: '0' }, lastStat: 0 };
  let CUR = null;
  const noteUse = () => { const now = Date.now(); if (CUR && CUR.api && now - ST.lastStat > 1500) { ST.lastStat = now; try { CUR.api.stat('regcalc', 1, 'max'); } catch (e) {} } };
  const tunit = () => { if (ST.unit) return ST.unit; let u = 's'; try { u = (CUR && CUR.api && CUR.api.rig && CUR.api.rig.tUnit) || 's'; } catch (e) {} return TDIV[u] ? u : 's'; };
  const strOf = () => { try { const S = CUR && CUR.api && CUR.api.S; return S && S.strecke && S.rigId === S.strecke.rig ? S.strecke : null; } catch (e) { return null; } };
  const inp = (id, label, v, extra) => `<label class="f${extra && extra.auto ? ' auto' : ''}"><span>${esc(label)}</span><input data-in="${esc(id)}" inputmode="decimal" autocomplete="off" value="${esc(v == null ? '' : v)}"></label>`;

  function rulesCard() {
    const u = tunit(), dv = TDIV[u], s = strOf(), V = ST.vals;
    const def = (k, time) => (V[k] != null ? { v: V[k], auto: false } : (s && fin(s[k]) ? { v: fnum(time ? s[k] / dv : s[k], adig(time ? s[k] / dv : s[k])), auto: true } : { v: '', auto: false }));
    const f = (k, label, time) => { const d = def(k, time); return inp('r.' + k, label + (time ? ' in ' + u : ''), d.v, { auto: d.auto }); };
    return `<div class="card pl" data-card="rules"><h4>1 · Einstellregeln: alle Methoden nebeneinander</h4>
      <p class="hint2" style="margin:0 0 6px">Trage die Kennwerte deiner Strecke ein. Gelb hinterlegte Felder stammen aus „Strecke messen“. Die Faktoren rechnet der Kern aus seiner Tabelle der Einstellregeln.</p>
      <div class="frm"><label class="f"><span>Zeiteinheit der Eingaben</span><select data-in="unit">${['s', 'min', 'h'].map(x => `<option value="${x}"${x === u ? ' selected' : ''}>${x}</option>`).join('')}</select></label></div>
      <div class="gh" style="padding-top:2px">Sprungantwort</div><div class="frm">${f('Ks', 'Ks')}${f('Tu', 'Tu', 1)}${f('Tg', 'Tg', 1)}</div>
      <div class="gh" style="padding-top:2px">Schwingversuch</div><div class="frm">${f('Kkrit', 'Kkrit')}${f('Tkrit', 'Tkrit', 1)}</div>
      <div class="gh" style="padding-top:2px">T-Summe (optional, sonst T1 = Tg und TΣk = Tu)</div><div class="frm">${f('T1', 'T1', 1)}${f('TsumKlein', 'TΣk', 1)}${f('T2', 'T2', 1)}</div>
      <div data-out="rules">${rulesHtml()}</div></div>`;
  }
  function rulesK() {
    const u = tunit(), dv = TDIV[u], s = strOf(), k = {};
    [['Ks', 0], ['Tu', 1], ['Tg', 1], ['Kkrit', 0], ['Tkrit', 1], ['T1', 1], ['TsumKlein', 1], ['T2', 1]].forEach(([key, time]) => {
      let v = ST.vals[key] != null ? pn(ST.vals[key]) : (s && fin(s[key]) ? (time ? s[key] / dv : s[key]) : NaN); if (ST.vals[key] === '') v = NaN;
      if (fin(v)) k[key] = time ? v * dv : v;
    });
    return k;
  }
  function rulesHtml() {
    const k = rulesK(), all = rulesAll(k); if (!all) return `<p class="hint2" style="color:var(--warn)">${esc(NOCORE)}</p>`;
    const dv = TDIV[tunit()], u = tunit(), tt = v => (v == null ? '–' : fnum(v / dv, adig(v / dv)) + ' ' + u);
    if (!Object.keys(k).length) return '<p class="hint2">Noch keine Kennwerte eingetragen.</p>';
    return '<div class="rl">' + all.map(m => `<div class="rm"><b>${esc(m.name)}</b>${m.warn.map(w => `<p class="hint2" style="color:var(--warn);margin:2px 0">${esc(w)}</p>`).join('')}<div class="rg">${TYPES.map(t => { const r = m.res[t]; return r && r.ok ? `<div class="rc"><b>${t}</b><span>Kp = ${fauto(r.Kp)}</span><span>Tn = ${tt(r.Tn)}</span><span>Tv = ${r.Tv == null || !(r.Tv > 0) ? '–' : tt(r.Tv)}</span></div>` : `<div class="rc no"><b>${t}</b><small>${esc((r && r.why) || 'nicht möglich')}</small></div>`; }).join('')}</div></div>`).join('') + '</div><p class="hint2">Tn und Tv stehen in ' + esc(u) + '. „–“ heißt: kein I-Anteil oder kein D-Anteil.</p>';
  }

  function readCard() {
    if (ST.scen == null) ST.scen = Math.floor(Math.random() * SCEN.length);
    const sim = simScen(ST.scen), qs = readQuestions(sim);
    if (!qs.includes(ST.q)) ST.q = qs[0] || null;
    let body;
    if (!sim.ok) body = `<p class="hint2" style="color:var(--warn)">${esc(sim.why)}</p>`;
    else {
      const s = sim.s, T = s.T;
      const G = gridOf(sim), yMin = G.yMin, yMax = G.yMax;
      const pts = sim.t.map((t, i) => [t, sim.x[i]]).filter((p, i) => i % 3 === 0), hl = s.open ? [{ y: 50, color: '#8d99a6' }] : [{ y: 50 + s.dw, color: '#ffb340' }];
      body = svgPlot({ series: [{ pts }], hlines: hl, xMin: 0, xMax: T, yMin: yMin, yMax: yMax, xStep: G.xStep, yStep: G.yStep, xLabel: 'Zeit in s', yLabel: 'x in %', label: 'Sprungantwort zum Ablesen: ' + s.n });
      body += `<p class="hint2" style="margin:2px 0 6px">Szenario: ${esc(s.n)}. ${s.open ? 'Die Regelgröße startet bei 50 %, die Stellgröße springt um +' + fnum(s.dy, 0) + ' %.' : 'Die Regelgröße startet bei 50 %, der Sollwert springt von 50 auf ' + fnum(50 + s.dw, 0) + ' %.'} Ein Gitterkästchen ist ${fauto(G.xStep)} s breit und ${fauto(G.yStep)} % hoch.</p>`;
      body += qs.length ? `<div class="chips">${qs.map(q => `<button class="chip s${q === ST.q ? ' on' : ''}" data-rq="${q}">${esc(({ ueber: 'Überschwingweite', tAus2: 'Ausregelzeit', tAn: 'Anregelzeit', ebl: 'Bleibende Abweichung', art: 'Streckenart', ks: 'Ks' })[q])}</button>`).join('')}</div>` : '<p class="hint2">Zu diesem Szenario gibt es keine Frage. Tippe auf „Neues Szenario“.</p>';
      if (ST.q) {
        const Q = QUANT[ST.q];
        body += `<p style="margin:8px 0 4px">${esc(Q.q)}</p>` + (Q.choice ? `<div class="seg" id="rdChoice"><button data-ra="P">mit Ausgleich</button><button data-ra="I">ohne Ausgleich</button></div>` : `<div class="frm"><label class="f"><span>Dein Wert${Q.unit ? ' in ' + Q.unit : ''}</span><input data-in="rd" inputmode="decimal" autocomplete="off" value="${esc(ST.scenAns)}"></label></div>`) + '<div class="btns"><button class="btn pri" data-rd="chk">✓ Prüfen</button><button class="btn" data-rd="new">Neues Szenario</button></div>';
      } else body += '<div class="btns"><button class="btn" data-rd="new">Neues Szenario</button></div>';
      body += '<div data-out="read"></div>';
    }
    return `<div class="card pl" data-card="read"><h4>2 · Kenngrößen aus der Sprungantwort ablesen</h4>${body}</div>`;
  }

  function exerciseWidget(key, kind, title) {
    const E = ST.ex[key] || (ST.ex[key] = { seed: 1 + Math.floor(Math.random() * 9000), kind, ans: '', res: null, shown: false });
    const k = kind || E.kind, ne = newExercise(k, E.seed);
    if (!ne.ok) return `<div class="exw" data-ex="${key}"><p class="hint2" style="color:var(--warn)">${esc(ne.why)}</p>${k ? '' : ''}</div>`;
    const ex = ne.ex, opt = exOptions(ex), unit = ex.answer && ex.answer.unit ? ex.answer.unit : '';
    return `<div class="exw" data-ex="${key}">${title ? `<div class="gh" style="padding-top:0">${esc(title)}</div>` : ''}<p style="margin:0 0 6px">${esc(ex.question)}</p>
      ${opt ? `<div class="seg exopt">${opt.map((o, i) => `<button data-eo="${i}" class="${E.ans === String(o.value) ? 'on' : ''}">${esc(o.label)}</button>`).join('')}</div>` : `<div class="frm"><label class="f"><span>Dein Ergebnis${unit ? ' in ' + esc(unit) : ''}</span><input data-in="ex.${key}" inputmode="decimal" autocomplete="off" value="${esc(E.ans)}"></label></div>`}
      <div class="btns"><button class="btn pri" data-ec="chk" data-k="${key}">✓ Prüfen</button><button class="btn" data-ec="new" data-k="${key}">Neue Aufgabe</button><button class="btn" data-ec="sol" data-k="${key}">Lösungsweg</button></div><div data-out="ex.${key}">${exResultHtml(key)}</div></div>`;
  }
  function exResultHtml(key) {
    const E = ST.ex[key]; if (!E || (!E.res && !E.shown)) return ''; const ne = newExercise(E.kind, E.seed); if (!ne.ok) return '';
    const steps = ne.ex.steps;
    return (E.res ? `<div class="ex ${E.res.ok ? 'ok' : 'bad'}"><b>${E.res.ok ? '✓ Richtig!' : '✗ Nicht ganz.'}</b> ${esc(E.res.text || '')}</div>` : '') + (E.shown && Array.isArray(steps) ? `<div class="ex"><b>Rechenweg</b><ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : '');
  }
  function exCheck(key, raw) {
    const E = ST.ex[key]; if (!E) return null; const ne = newExercise(E.kind, E.seed); if (!ne.ok) return { ok: false, text: ne.why };
    let r; try { r = ne.ex.check(raw); } catch (e) { r = { ok: false, text: 'Die Prüfung ist fehlgeschlagen.' }; } return r || { ok: false, text: 'Keine Prüfung möglich.' };
  }

  function stabCard() {
    const k = ST.kk, K = kkritCalc({ Ks: pn(k.Ks), T1: pn(k.T1) * TDIV[tunit()], T2: pn(k.T2) * TDIV[tunit()], T3: pn(k.T3) * TDIV[tunit()], Tt: pn(k.Tt) * TDIV[tunit()] }), r = routhCalc(ST.rt), u = tunit(), dv = TDIV[u];
    return `<div class="card pl" data-card="stab"><h4>3 · Stabilitätsprüfung</h4>
      ${exerciseWidget('stabil', 'stabil', 'a) Urteil aus Phasen- und Amplitudenreserve')}
      <div class="gh">b) Routh-Hurwitz für ein Polynom bis 4. Grades</div><p class="hint2" style="margin:0 0 6px">Koeffizienten des Nenners der Übertragungsfunktion des geschlossenen Kreises, höchster Grad zuerst, getrennt durch Leerzeichen oder Semikolon.</p>
      <div class="frm"><label class="f"><span>Koeffizienten</span><input data-in="rt" inputmode="decimal" autocomplete="off" value="${esc(ST.rt)}"></label></div><div data-out="routh">${routhHtml(r)}</div>
      <div class="gh">c) Kritische Verstärkung einer Strecke aus den Zeitkonstanten</div><p class="hint2" style="margin:0 0 6px">Strecke mit Ausgleich aus Verzögerungsgliedern (PT1) und Totzeit. Eine Zeitkonstante 0 heißt: nicht vorhanden. Zeiten in ${esc(u)}.</p>
      <div class="frm">${inp('kk.Ks', 'Ks', k.Ks)}${inp('kk.T1', 'T1 in ' + u, k.T1)}${inp('kk.T2', 'T2 in ' + u, k.T2)}${inp('kk.T3', 'T3 in ' + u, k.T3)}${inp('kk.Tt', 'Totzeit Tt in ' + u, k.Tt)}</div><div data-out="kkrit">${kkritHtml(K, dv, u)}</div></div>`;
  }
  function routhHtml(r) {
    if (!r || r.ok === false) return `<div class="res"><p class="hint2" style="margin:0;color:var(--warn)">${esc((r && r.why) || '')}</p></div>`;
    return `<div class="res"><div class="big2">${r.stable ? 'stabil' : 'nicht stabil'}</div><div class="kvs"><span>Erste Spalte</span><b>${(r.firstColumn || []).map(v => fauto(v)).join(' | ')}</b></div><div class="kvs"><span>Vorzeichenwechsel</span><b>${r.signChanges == null ? '–' : r.signChanges}</b></div><p class="hint2" style="margin:4px 0 0">${esc(r.text || '')}</p></div>`;
  }
  function kkritHtml(K, dv, u) {
    if (!K || K.ok === false) return `<div class="res"><p class="hint2" style="margin:0;color:var(--warn)">${esc((K && K.why) || '')}</p></div>`;
    return `<div class="res"><div class="big2">Kkrit = ${fauto(K.Kkrit)}</div><div class="kvs"><span>Tkrit</span><b>${fin(K.Tkrit) ? fnum(K.Tkrit / dv, adig(K.Tkrit / dv)) + ' ' + u : '–'}</b></div><div class="kvs"><span>Kreisfrequenz ωπ</span><b>${fin(K.wPi) ? fauto(K.wPi) + ' rad/s' : '–'}</b></div><p class="hint2" style="margin:4px 0 0">Bei Kp = Kkrit schwingt der Kreis mit einem P-Regler dauernd.</p></div>`;
  }

  function formulaMini(id, title) {
    const f = formulaById(id); if (!f) return `<details class="fm"><summary>${esc(title)}</summary><p class="hint2">${esc(CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE)}</p></details>`;
    const ins = formulaInputs(f), C = ST.calc[id] || (ST.calc[id] = {}); ins.forEach(i => { if (C[i.key] == null) C[i.key] = i.def != null ? String(i.def).replace('.', ',') : ''; });
    return `<details class="fm" data-fm="${esc(id)}"><summary>${esc(title || f.name)}${f.symbol ? ' (' + esc(f.symbol) + ')' : ''}</summary><div class="fmb"><div class="ex"><b>${esc(f.expr || '')}</b>${typeof f.explain === 'string' && f.explain ? `<br><small>${esc(f.explain)}</small>` : ''}</div>
      <div class="frm">${ins.map(i => inp('f.' + id + '.' + i.key, i.label + (i.unit ? ' in ' + i.unit : ''), C[i.key])).join('')}</div><div data-out="f.${esc(id)}">${formulaHtml(id)}</div></div></details>`;
  }
  function formulaHtml(id) {
    const r = formulaCalc(id, ST.calc[id]); if (!r.ok) return `<div class="res"><span class="hint2">${esc(r.why)}</span></div>`;
    return `<div class="res"><div class="big2">${esc(r.f.symbol || r.f.name)} = ${fauto(r.value)}${r.unit ? ' ' + esc(r.unit) : ''}</div>${r.steps ? `<ol>${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}<p class="hint2" style="margin:4px 0 0">Eingesetzt: ${r.inputs.map(i => esc(i.label) + ' = ' + fauto(i.value) + (i.unit ? ' ' + esc(i.unit) : '')).join(', ')}</p></div>`;
  }
  function loopCard() { return `<div class="card pl" data-card="loop"><h4>4 · Kreisverstärkung und bleibende Abweichung</h4><p class="hint2" style="margin:0 0 6px">Tippe eine Formel an, trage Zahlen ein und lies das Ergebnis mit Eingesetztem ab.</p>${['v0', 'xp', 'kp', 'eblP', 'tclP1', 'ks', 'regelbarkeit'].map(id => formulaMini(id)).join('')}</div>`; }

  function ctrlCard() {
    const c = ST.ctrl;
    return `<div class="card pl" data-card="ctrl"><h4>5 · Reglerausgang bei einem Sprung</h4><p class="hint2" style="margin:0 0 6px">Die Regeldifferenz springt von 0 auf e. Du siehst die Stellgröße y(t), gerechnet vom Regler des Kerns.</p>
      <div class="seg" id="ctType">${['P', 'PI', 'PD', 'PID'].map(t => `<button data-ct="${t}" class="${t === c.type ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div class="frm" style="margin-top:8px">${inp('c.Kp', 'Kp', c.Kp)}${inp('c.e', 'Sprung e in %', c.e)}${inp('c.Tn', 'Tn in s', c.Tn)}${inp('c.Tv', 'Tv in s', c.Tv)}${inp('c.tEnd', 'Dauer in s', c.tEnd)}</div><div data-out="ctrl">${ctrlHtml()}</div></div>`;
  }
  function ctrlHtml() {
    const c = ST.ctrl, r = ctrlStepResponse({ type: c.type, Kp: pn(c.Kp), e: pn(c.e), Tn: pn(c.Tn), Tv: pn(c.Tv), tEnd: pn(c.tEnd) });
    if (!r.ok) return `<div class="res"><span class="hint2">${esc(r.why)}</span></div>`;
    const lo = Math.min(0, ...r.y), hi = Math.max(1, ...r.y) * 1.05, pts = r.t.map((t, i) => [t, r.y[i]]).filter((p, i) => i % 2 === 0);
    let extra = '';
    if (/I/.test(c.type) && !/D/.test(c.type)) { const f = formulaCalc('piStep', { Kp: c.Kp, e: c.e, Tn: c.Tn, t: c.Tn }); if (f.ok) extra = `<p class="hint2" style="margin:4px 0 0">Zur Zeit t = Tn (${esc(c.Tn)} s) ist y = ${fauto(f.value)} %: der I-Anteil ist dann so groß wie der P-Anteil, y ist doppelt so groß wie bei P allein.</p>`; }
    return svgPlot({ series: [{ pts, color: '#4cd964' }], xMin: 0, xMax: r.t[r.t.length - 1], yMin: lo, yMax: hi, xLabel: 'Zeit in s', yLabel: 'y in %', label: 'Stellgröße des Reglers bei einem Sprung' }) + `<p class="hint2" style="margin:0">y(0) = ${fauto(r.y[0])} %, y(Ende) = ${fauto(r.y[r.y.length - 1])} %.</p>` + extra;
  }

  function spsOutHtml() {
    const s = ST.sps, v = { raw: pn(s.raw), lo: pn(s.lo), hi: pn(s.hi), pct: pn(s.pct), mA: pn(s.mA) }, o = spsCalc(v);
    const line = (label, r, unit, d) => { if (!r) return ''; if (r.ok === false) return `<div class="kvs"><span>${esc(label)}</span><b style="color:var(--warn)">${esc(r.why)}</b></div>`; const note = r.fault ? `<p class="hint2" style="color:var(--warn);margin:2px 0">${esc(r.text || r.fault)}</p>` : r.over ? `<p class="hint2" style="color:var(--warn);margin:2px 0">${esc(r.text || 'Übersteuerung')}</p>` : ''; return `<div class="kvs"><span>${esc(label)}</span><b>${fin(r.value) ? fnum(r.value, d == null ? adig(r.value) : d) + (unit ? ' ' + unit : '') : '–'}</b></div>${note}`; };
    return `<div class="res">${line('Rohwert in Prozent', o.pct, '%')}${line('Rohwert in der Messgröße', o.eng, '')}${line('Prozent als Rohwert', o.raw, '', 0)}${line('Prozent als Strom', o.ma, 'mA', 2)}${line('Strom in Prozent', o.pctFromMa, '%')}</div>`;
  }
  function spsCard() {
    const s = ST.sps;
    return `<div class="card pl" data-card="sps"><h4>6 · SPS-Skalierung</h4><p class="hint2" style="margin:0 0 6px">Analogwerte einer S7-Steuerung: Rohwert 0 bis 27648 entspricht 0 bis 100 %. Ein 4-bis-20-mA-Signal entspricht ebenfalls 0 bis 100 %.</p>
      <div class="frm">${inp('s.raw', 'Rohwert', s.raw)}${inp('s.lo', 'Messbereich von', s.lo)}${inp('s.hi', 'Messbereich bis', s.hi)}${inp('s.pct', 'Prozent', s.pct)}${inp('s.mA', 'Strom in mA', s.mA)}</div>
      <div data-out="sps">${spsOutHtml()}</div>
      <div class="gh">Abtastzeit</div>${formulaMini('abtastVerlust', 'Phasenverlust durch die Abtastzeit')}</div>`;
  }
  function genCard() {
    const cur = ST.genKind || 'xp';
    return `<div class="card pl" data-card="gen"><h4>7 · Übungsgenerator</h4><div class="frm"><label class="f"><span>Art der Aufgabe</span><select data-in="genKind">${KINDS.map(k => `<option value="${k[0]}"${k[0] === cur ? ' selected' : ''}>${esc(k[1])}</option>`).join('')}</select></label></div>${exerciseWidget('gen', cur, '')}</div>`;
  }
  const html = () => `<p class="big">Rechnen</p><p class="hint2" style="margin:0 0 12px">Sieben Rechner und Übungen für die Regelungstechnik. Alles rechnet der Kern des Labs, du siehst jeden Rechenweg.</p>${rulesCard()}${readCard()}${stabCard()}${loopCard()}${ctrlCard()}${spsCard()}${genCard()}`;

  /* ---- Ereignisse ---- */
  function out(host, sel, h) { if (!host || typeof host.querySelector !== 'function') return; const el = host.querySelector('[data-out="' + sel + '"]'); if (el) el.innerHTML = h; }
  function onInput(e) {
    const t = e.target, id = t && t.dataset && t.dataset.in; if (!id) return; const host = CUR.host; noteUse();
    if (id.startsWith('r.')) { ST.vals[id.slice(2)] = t.value; if (t.closest) { const l = t.closest('label'); if (l) l.classList.remove('auto'); } out(host, 'rules', rulesHtml()); }
    else if (id === 'rd') ST.scenAns = t.value;
    else if (id === 'rt') { ST.rt = t.value; out(host, 'routh', routhHtml(routhCalc(ST.rt))); }
    else if (id.startsWith('kk.')) { ST.kk[id.slice(3)] = t.value; const dv = TDIV[tunit()], k = ST.kk; out(host, 'kkrit', kkritHtml(kkritCalc({ Ks: pn(k.Ks), T1: pn(k.T1) * dv, T2: pn(k.T2) * dv, T3: pn(k.T3) * dv, Tt: pn(k.Tt) * dv }), dv, tunit())); }
    else if (id.startsWith('f.')) { const p = id.split('.'); (ST.calc[p[1]] = ST.calc[p[1]] || {})[p[2]] = t.value; out(host, 'f.' + p[1], formulaHtml(p[1])); }
    else if (id.startsWith('c.')) { ST.ctrl[id.slice(2)] = t.value; out(host, 'ctrl', ctrlHtml()); }
    else if (id.startsWith('s.')) { ST.sps[id.slice(2)] = t.value; out(host, 'sps', spsOutHtml()); }
    else if (id.startsWith('ex.')) { const E = ST.ex[id.slice(3)]; if (E) E.ans = t.value; }
  }
  function onChange(e) {
    const t = e.target, id = t && t.dataset && t.dataset.in; if (!id) return;
    if (id === 'unit') { ST.unit = t.value; CUR.host.innerHTML = html(); }
    else if (id === 'genKind') { ST.genKind = t.value; ST.ex.gen = { seed: 1 + Math.floor(Math.random() * 9000), kind: t.value, ans: '', res: null, shown: false }; CUR.host.innerHTML = html(); }
  }
  function onClick(e) {
    const g = (s) => e.target.closest && e.target.closest(s); const host = CUR.host, api = CUR.api;
    const rq = g('[data-rq]'), ra = g('[data-ra]'), rd = g('[data-rd]'), ec = g('[data-ec]'), eo = g('[data-eo]'), ct = g('[data-ct]');
    if (rq) { ST.q = rq.dataset.rq; ST.scenAns = ''; ST.scenRes = null; host.innerHTML = html(); return; }
    if (ra) { ST.scenAns = ra.dataset.ra; const seg = g('#rdChoice'); if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === ra)); return; }
    if (rd) {
      noteUse();
      if (rd.dataset.rd === 'new') { ST.scen = (ST.scen + 1 + Math.floor(Math.random() * (SCEN.length - 1))) % SCEN.length; ST.q = null; ST.scenAns = ''; ST.scenRes = null; host.innerHTML = html(); return; }
      const sim = simScen(ST.scen), r = readCheck(sim, ST.q, ST.scenAns); const tr = readTruth(sim, ST.q);
      out(host, 'read', `<div class="ex ${r.ok ? 'ok' : 'bad'}"><b>${r.ok ? '✓ Richtig!' : '✗ Nicht ganz.'}</b> ${esc(r.text)}${r.ok || !tr.ok ? '' : ''}</div>`);
      try { if (r.ok && api.S && root.LochFX) root.LochFX.sound('ding'); } catch (er) {}
      return;
    }
    if (ct) { ST.ctrl.type = ct.dataset.ct; const seg = g('#ctType'); if (seg) seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === ct)); out(host, 'ctrl', ctrlHtml()); noteUse(); return; }
    if (eo) { const w = g('[data-ex]'), key = w && w.dataset.ex, E = ST.ex[key], ne = E && newExercise(E.kind, E.seed); if (ne && ne.ok) { const o = exOptions(ne.ex)[+eo.dataset.eo]; E.ans = String(o.value); w.querySelectorAll('.exopt button').forEach(b => b.classList.toggle('on', b === eo)); } return; }
    if (ec) {
      const key = ec.dataset.k, E = ST.ex[key]; if (!E) return; noteUse();
      if (ec.dataset.ec === 'new') { E.seed = 1 + Math.floor(Math.random() * 9000); E.ans = ''; E.res = null; E.shown = false; host.innerHTML = html(); }
      else if (ec.dataset.ec === 'sol') { E.shown = true; out(host, 'ex.' + key, exResultHtml(key)); }
      else { E.res = exCheck(key, E.ans); if (E.res && E.res.ok) E.shown = true; out(host, 'ex.' + key, exResultHtml(key)); try { if (root.LochFX) root.LochFX.sound(E.res && E.res.ok ? 'ding' : 'buzz', 0.5); } catch (er) {} }
    }
  }
  function render(host, api) {
    CUR = { host, api };
    if (!CORE() && host) { host.innerHTML = `<p class="big">Rechnen</p><div class="card pl"><p class="hint2" style="color:var(--warn);margin:0">${esc(NOCORE)}</p></div>`; }
    else if (host) host.innerHTML = html();
    if (host && typeof host.addEventListener === 'function' && !host._regCalc) { host._regCalc = true; host.addEventListener('input', e => onInput(e)); host.addEventListener('change', e => onChange(e)); host.addEventListener('click', e => onClick(e)); }
  }
  root.REG_UI_EXT = root.REG_UI_EXT || {};
  root.REG_UI_EXT.svgPlot = svgPlot;
  root.REG_UI_EXT.calc = { render, html, fn: { METHODS, TYPES, rulesAll, rulesK, parseCoef, routhCalc, kkritCalc, formulaCalc, formulaInputs, ctrlStepResponse, spsCalc, SCEN, QUANT, simScen, readTruth, readQuestions, readCheck, newExercise, exOptions, KINDS, niceTick, svgPlot }, state: ST };
  if (typeof module !== 'undefined') module.exports = root.REG_UI_EXT.calc;
})(typeof window !== 'undefined' ? window : globalThis);
