'use strict';
/* Tonfunk EMV-Lab: Tab "Rechnen" (WP3c).
   Sieben Rechner (dB; Resonanz und Filter; Schleifen und Einkopplung; Oberwellen mit ziehbaren Knickfrequenzen; Schirmung; Leitung als Antenne; Impulse) und ein Übungsgenerator (exercise).
   ALLE Rechnungen laufen über EMV_CORE (formulas.<id>.explain mit Rechenweg, spec.envelope/lines, shield.se/slot/cable, antenna.resonances, db.sum, protect.*, exercise);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Fehlt eine Kernfunktion, erscheint ein Hinweis statt Zahlen.
   Eingaben: Komma oder Punkt, Einheit und Vorsatz erlaubt (2,2 nF, 30 MHz); ohne Vorsatz gilt die SI-Einheit des Felds (in eckigen Klammern).
   Schnittstelle (SPEC 8.8): window.EMV_UI_EXT.calc = { render(host, api), fn }. Die reinen Rechenfunktionen (ohne DOM) hängen unter EMV_UI_EXT.calc.fn und werden von test_emvui_ext.js geprüft. */
(function (root) {
  const E = root.EMV_UI_EXT = root.EMV_UI_EXT || {};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  /* Ereignisbehandler am Host nur einmal anhängen (der Host bleibt bei jedem render derselbe, sein Inhalt wird neu gesetzt) */
  const once = (host, name, ty, fn) => { host.__emvl = host.__emvl || {}; if (host.__emvl[name + ty]) return; host.__emvl[name + ty] = 1; host.addEventListener(ty, fn); };
  const fin = v => typeof v === 'number' && isFinite(v);
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const CORE = () => root.EMV_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const NOCORE = 'Der Rechenkern ist nicht geladen (emvcore.js fehlt). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (emvcore.js ist noch nicht vollständig). Dieser Rechner liefert deshalb noch keine Zahlen.';
  const PRE = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
  function fe(x, unit) {
    const C = CORE(); if (C && typeof C.fmtEng === 'function') { try { const t = C.fmtEng(x, unit || ''); if (typeof t === 'string' && t) return t; } catch (e) {} }
    if (!fin(x)) return '–'; if (x === 0) return '0 ' + (unit || ''); const a = Math.abs(x), p = PRE.find(q => a >= q[0] * 0.9995) || PRE[PRE.length - 1], v = x / p[0];
    return String(+v.toFixed(Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2)).replace('.', ',') + ' ' + p[1] + (unit || '');
  }
  const pn = s => { const C = CORE(); if (typeof s === 'number') return fin(s) ? s : NaN; const t = String(s == null ? '' : s); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(t); return fin(v) ? v : NaN; } const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN; };
  const pick = (o, keys) => { if (typeof o === 'number') return o; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };
  let A = null; /* api der Seite (nur für Oberfläche, nie für Rechnung) */

  /* ============================================================ Formeln: Eingabefelder, Startwerte, Rechnen (alles über EMV_CORE.formulas) */
  /* Startwerte in SI-Einheiten, in der Reihenfolge der args der Formel (der Kern liefert keine Beispielwerte) */
  const FDEF = { dbV: [1, 0.02], dbP: [2, 1], dbuv: [0.001], dbuvInv: [60], dbm: [-30], dbSum: [60, 60], fRes: [1e-6, 1e-9], fgRC: [100, 1e-7], fgLR: [50, 1e-3], ilFirst: [1e6, 1e5, 1], xl: [1e6, 1e-6],
    schleife: [0.1, 0.01], uInd: [1e5, 1e-6, 1e-3, 0], uIndM: [1.6e-7, 1e6], kapTeiler: [24, 2.4e-12, 10.7e-12], kapTeilerNf: [24, 2.4e-12, 1e4, 1e5], galv: [0.5, 0.05], snr: [0.1, 1e-3],
    hnwEnv: [3.3, 1e-5, 5e-6, 2e-9, 3e7], knick: [5e-6], knick2: [5e-9], flankeBw: [4e-9], skin: [1e6, 5.8e7, 1], se: [1e-3, 1e6, 5.8e7, 1], seThin: [0.1], schlitz: [1, 0.1],
    lambda: [1e8], lambda4: [5e7], eKurz: [1e7, 0.1, 1e-3, 3], yStrom: [50, 4.7e-9, 230], hbm: [150e-12, 8000], hbmI: [8000, 330], marge: [56, 62] };
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!f) return null; if (Array.isArray(f)) return f.find(x => x && x.id === id) || null; const e = f[id]; return e && typeof e === 'object' ? (e.id ? e : Object.assign({ id }, e)) : null; }
  function formulaList() { const C = CORE(), f = C && C.formulas; if (!f) return []; if (typeof f.list === 'function') { try { return f.list() || []; } catch (e) { return []; } } return Array.isArray(f) ? f : Object.keys(f).map(k => f[k]).filter(x => x && typeof x === 'object'); }
  /* args: ["U2 [V]", ...] oder inputs: [{key,label,unit,def}] */
  function formulaInputs(f) {
    if (f && Array.isArray(f.inputs) && f.inputs.length) return f.inputs.map(i => ({ key: i.key, label: i.label || i.key, unit: i.unit || '', def: i.def }));
    const def = (FDEF[f && f.id]) || [];
    return ((f && f.args) || []).map((a, i) => { const m = String(a).match(/^(.*?)\s*(?:\[(.*)\])?$/); return { key: String(i), label: m[1], unit: m[2] || '', def: def[i] }; });
  }
  const defText = i => (i.def == null ? '' : /^(Hz|F|H|Ω|V|A|W|J|s|m|m²|S\/m|V\/m)$/.test(i.unit) ? fe(i.def, i.unit) : fnum(i.def, Math.abs(i.def) >= 100 || Number.isInteger(i.def) ? 0 : 2));
  function formulaCalc(id, vals) {
    const f = formulaById(id); if (!f || (typeof f.fn !== 'function' && typeof f.explain !== 'function')) return { ok: false, why: CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE };
    const ins = formulaInputs(f), o = [], arr = Array.isArray(vals) ? vals : ins.map(i => (vals || {})[i.key]);
    ins.forEach((i, k) => { o.push(pn(arr[k])); });
    if (o.some(v => !fin(v))) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt, Einheit erlaubt).', f };
    let r = null;
    if (typeof f.explain === 'function') { try { r = f.explain(...o); } catch (e) { r = null; } }
    if ((!r || (r.ok !== false && !fin(pick(r, ['value'])))) && typeof f.fn === 'function') { let v = NaN; try { v = f.fn(...o); } catch (e) { v = NaN; } if (fin(v)) r = { ok: true, value: v, unit: f.unit }; }
    if (r && r.ok === false) return { ok: false, why: r.why || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f, steps: r.steps };
    const v = pick(r, ['value', 'v', 'result']); if (!fin(v)) return { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    return { ok: true, f, value: v, unit: (r && r.unit) || f.unit || '', steps: (r && r.steps) || null, inputs: ins.map((i, k) => ({ label: i.label, unit: i.unit, value: o[k] })) };
  }
  const SI_UNIT = /^(Hz|F|H|Ω|V|A|W|J|s|m|m²|S\/m|V\/m)$/;
  const valueText = (v, unit) => (SI_UNIT.test(unit || '') ? fe(v, unit) : fnum(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2) + (unit ? ' ' + unit : ''));

  /* ============================================================ Sonderrechner (alle rufen EMV_CORE) */
  const has = (...path) => { let o = CORE(); for (const k of path) { if (!o) return false; o = o[k]; } return typeof o === 'function'; };
  const bad = (why, extra) => Object.assign({ ok: false, why }, extra || {});
  /* Pegel mehrerer Linien addieren: db.sum(Liste) */
  function dbSumList(text) {
    if (!has('db', 'sum')) return bad(CORE() ? NOFN('db.sum') : NOCORE);
    const parts = String(text == null ? '' : text).split(/[;\s]+(?=[-+\d])|;/).map(s => s.trim()).filter(Boolean), l = parts.map(pn);
    if (l.length < 2 || l.some(v => !fin(v))) return bad('Trage mindestens zwei Pegel in dBµV ein, getrennt durch Semikolon (zum Beispiel 60; 60; 57).');
    let v; try { v = CORE().db.sum(l); } catch (e) { v = NaN; } if (!fin(v)) return bad('Mit diesen Pegeln gibt es kein Ergebnis.');
    return { ok: true, value: v, unit: 'dBµV', steps: ['L = 10·lg(Σ 10^(Li/10))', 'Pegel: ' + l.map(x => fnum(x, 1)).join('; ') + ' dBµV', '= ' + fnum(v, 1) + ' dBµV'], list: l };
  }
  /* Kondensator mit Anschlussinduktivität: Eigenresonanz f0 = 1/(2π·√(ESL·C)) über formulas.fRes */
  function eslCalc(v) {
    const r = formulaCalc('fRes', [v.esl, v.c]); if (!r.ok) return r;
    return Object.assign({}, r, { note: 'Oberhalb von ' + fe(r.value, 'Hz') + ' wirkt der Kondensator wie eine Induktivität (Anschlussinduktivität ' + fe(pn(v.esl), 'H') + '): Kürze die Anschlüsse.' });
  }
  const MATS = [['kupfer', 'Kupfer'], ['alu', 'Aluminium'], ['stahl', 'Stahl (µr 200, Übungswert)'], ['leitlack', 'Leitlack']];
  const FELDER = [['fern', 'Fernfeld'], ['enah', 'E-Nahfeld'], ['hnah', 'H-Nahfeld']];
  /* Schirmdämpfung A + R + B (shield.se): Material, Dicke, Frequenz, Feldart, Abstand */
  function shieldCalc(v) {
    if (!has('shield', 'se')) return bad(CORE() ? NOFN('shield.se') : NOCORE); v = v || {};
    const t = pn(v.t), f = pn(v.f), r = pn(v.r), rsq = pn(v.rsq);
    if (!fin(t) || !fin(f) || (v.feld !== 'fern' && !fin(r))) return bad('Bitte Dicke, Frequenz und (bei Nahfeld) den Abstand als Zahlen eintragen.');
    let res; try { res = CORE().shield.se({ mat: v.mat || 'kupfer', t, f, feld: v.feld || 'fern', r: fin(r) ? r : 0.1, rsq: fin(rsq) ? rsq : undefined }); } catch (e) { res = null; }
    if (!res || res.ok === false) return bad((res && res.why) || 'Mit diesen Werten gibt es kein Ergebnis.');
    const se = pick(res, ['se', 'SE']); if (!fin(se)) return bad('Mit diesen Werten gibt es kein Ergebnis.');
    return { ok: true, value: se, unit: 'dB', a: res.A, r: res.R, b: res.B, delta: res.delta, thin: !!res.thin, core: res, steps: res.thin ? ['SE = 20·lg(1 + Z0/(2·R□))', '= ' + fnum(se, 1) + ' dB (dünner Film, unabhängig von der Frequenz)'] : ['SE = A + R + B', 'A = ' + fnum(res.A, 1) + ' dB, R = ' + fnum(res.R, 1) + ' dB, B = ' + fnum(res.B, 2) + ' dB', 'δ = ' + fe(res.delta, 'm'), '= ' + fnum(se, 1) + ' dB'] };
  }
  function slotCalc(v) {
    if (!has('shield', 'slot')) return bad(CORE() ? NOFN('shield.slot') : NOCORE); const len = pn(v && v.len), f = pn(v && v.f);
    if (!fin(len) || !fin(f)) return bad('Bitte Schlitzlänge und Frequenz als Zahlen eintragen.');
    let r; try { r = CORE().shield.slot({ len, f }); } catch (e) { r = null; }
    if (!r || r.ok === false) return bad((r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.');
    return { ok: true, value: r.se, unit: 'dB', fCrit: r.fCrit, lambda: r.lambda, valid: r.valid !== false, why: r.why, steps: ['SE = 20·lg(λ/(2·ℓ)), nur für ℓ < λ/2', 'λ = ' + fe(r.lambda, 'm') + ', kritische Frequenz c0/(2·ℓ) = ' + fe(r.fCrit, 'Hz'), '= ' + fnum(r.se, 1) + ' dB'] };
  }
  function cableCalc(v) {
    if (!has('shield', 'cable')) return bad(CORE() ? NOFN('shield.cable') : NOCORE); const lp = pn(v && v.lp), f = pn(v && v.f), ish = pn(v && v.ish);
    if (![lp, f, ish].every(fin)) return bad('Bitte Länge der Schirmlitze, Frequenz und Schirmstrom als Zahlen eintragen.');
    let r; try { r = CORE().shield.cable({ mode: (v && v.mode) || 'pigtail', lp, f, ish }); } catch (e) { r = null; }
    if (!r || r.ok === false) return bad((r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.');
    return { ok: true, value: r.L, unit: 'dBµV', zt: r.zt, zt360: r.zt360, ratio: r.ratio, uIn: r.uIn, steps: ['uIn = |Zt|·ish', '|Zt| = ' + fnum(r.zt, 2) + ' Ω (360° zum Vergleich: ' + fnum(r.zt360, 2) + ' Ω, Faktor ' + fnum(r.ratio, 0) + ')', '= ' + fnum(r.L, 1) + ' dBµV'] };
  }
  /* Viertelwellen-Resonanzen eines Kabels: antenna.resonances(ℓ, n) */
  function resonanceCalc(v) {
    if (!has('antenna', 'resonances')) return bad(CORE() ? NOFN('antenna.resonances') : NOCORE); const len = pn(v && v.len), n = clamp(Math.round(pn(v && v.n) || 3), 1, 6);
    if (!fin(len) || !(len > 0)) return bad('Bitte die Kabellänge als Zahl größer 0 eintragen.');
    let r; try { r = CORE().antenna.resonances(len, n); } catch (e) { r = null; } const list = Array.isArray(r) ? r : (r && Array.isArray(r.f) ? r.f : null);
    if (!list || !list.length || !list.every(fin)) return bad('Mit dieser Länge gibt es kein Ergebnis.');
    return { ok: true, value: list[0], unit: 'Hz', list, steps: ['f = (2n − 1)·c0/(4·ℓ)', list.map((x, i) => 'n = ' + (i + 1) + ': ' + fe(x, 'Hz')).join('; ')] };
  }
  /* Analysatorwert ↔ Feldstärke: E = U + AF + Kabeldämpfung (nur Addition in dB, kein Kernformel; siehe ABWEICHUNGEN.md WP3c) */
  function afeldCalc(v) {
    v = v || {}; const u = pn(v.u), af = pn(v.af), ac = pn(v.ac), inv = v.dir === 'inv';
    if (![u, af, ac].every(fin)) return bad('Bitte Pegel, Antennenfaktor und Kabeldämpfung als Zahlen in dB eintragen.');
    const e = u + af + ac;
    return inv ? { ok: true, value: u - af - ac, unit: 'dBµV', steps: ['U = E − AF − Kabeldämpfung', fnum(u, 1) + ' − ' + fnum(af, 1) + ' − ' + fnum(ac, 1), '= ' + fnum(u - af - ac, 1) + ' dBµV'] }
      : { ok: true, value: e, unit: 'dBµV/m', steps: ['E = U + AF + Kabeldämpfung', fnum(u, 1) + ' + ' + fnum(af, 1) + ' + ' + fnum(ac, 1), '= ' + fnum(e, 1) + ' dBµV/m'] };
  }
  /* Surge-Energie am Varistor und Burst-Treppe aus dem Kern Teil 2 (protect.*), sonst Hinweis */
  function surgeCalc(v) {
    if (!has('protect', 'surge')) return bad('Dieser Rechner braucht den Kern Teil 2 (Impulse, emvcore-lay.js). Dort liefert protect.surge Spannung, Strom und Energie am Varistor.');
    v = v || {}; const kv = pn(v.kv), zi = pn(v.zi); if (!fin(kv) || !fin(zi)) return bad('Bitte Prüfpegel in kV und Innenwiderstand als Zahlen eintragen.');
    let r; try { r = CORE().protect.surge({ kv, zi, var: v.var || 'v275' }); } catch (e) { r = null; }
    if (!r || r.ok === false || !fin(r.w)) return bad((r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.');
    return { ok: true, value: r.w, unit: 'J', vPeak: r.vPeak, iPeak: r.iPeak, steps: ['W = ∫ u·i dt über den 8/20-µs-Stoß (aus der Kennlinie des Varistors)', 'Spitzenspannung ' + fnum(r.vPeak, 0) + ' V, Spitzenstrom ' + fnum(r.iPeak, 0) + ' A', '= ' + fnum(r.w, 2) + ' J'] };
  }
  function burstCalc(v) {
    if (!has('protect', 'burstLine')) return bad('Dieser Rechner braucht den Kern Teil 2 (Impulse, emvcore-lay.js). Dort liefert protect.burstLine die Treppe der Burst-Impulse.');
    v = v || {}; const kv = pn(v.kv), frep = pn(v.frep), rin = pn(v.rin), cin = pn(v.cin); if (![kv, frep, rin, cin].every(fin)) return bad('Bitte alle Felder als Zahlen eintragen.');
    let r; try { r = CORE().protect.burstLine({ kv, frep, rin, cin }); } catch (e) { r = null; }
    const top = r && (fin(r.vMax) ? r.vMax : fin(r.vEnd) ? r.vEnd : fin(r.vPeak) ? r.vPeak : NaN); if (!r || r.ok === false || !fin(top)) return bad((r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.');
    return { ok: true, value: top, unit: 'V', steps: ['Treppe: jeder Impuls hebt die Spannung um U·Cc/(Cc + Cin); dazwischen entlädt sich die Leitung mit τ = Rin·(Cc + Cin)', '= ' + fnum(top, 1) + ' V nach dem letzten Impuls des Bursts'] };
  }
  /* Oberwellen: Einhüllende und Linien aus τ, tr (spec.envelope, spec.lines); die Knickfrequenzen sind Eingabe oder Ziehpunkte */
  function hnwModel(v) {
    const C = CORE(); if (!C || !C.spec || typeof C.spec.envelope !== 'function' || typeof C.spec.lines !== 'function') return bad(C ? NOFN('spec.envelope') : NOCORE);
    const Aa = pn(v.A), T = pn(v.T), tau = pn(v.tau), tr = pn(v.tr);
    if (![Aa, T, tau, tr].every(fin) || !(Aa > 0) || !(T > 0) || !(tau > 0) || !(tr > 0)) return bad('Bitte Amplitude, Periode, Impulsbreite und Anstiegszeit als Zahlen größer 0 eintragen.');
    const cfg = { A: Aa, T, tau, tr, tf: tr }; let env, ln; try { env = C.spec.envelope(cfg); ln = C.spec.lines(Object.assign({ nMax: 400 }, cfg)); } catch (e) { return bad('Die Rechnung ist fehlgeschlagen.'); }
    if (!env || env.ok === false) return bad((env && env.why) || 'Mit diesen Werten gibt es keine Einhüllende.'); if (!ln || ln.ok === false) return bad((ln && ln.why) || 'Die Flanken sind länger als der Impuls oder die Pause: Das Signal ist kein Trapez mehr.');
    /* at(f): Pegel der Einhüllenden in dBµV (env.at liefert die Amplitude in V, spec.level macht daraus den Effektwert-Pegel) */
    const lvl = typeof C.spec.level === 'function' ? C.spec.level : null;
    return { ok: true, cfg, env, lines: ln.lines || [], f1: env.f1, f2: env.f2, at: f => { try { return lvl ? lvl(env.at(f)) : NaN; } catch (e) { return NaN; } } };
  }
  /* Knickfrequenz → Zeit (Ziehen eines Markers): τ = 1/(π·f1), tr = 1/(π·f2) ist die Umkehrung der Kernformeln knick und knick2 (Rundreise im Test) */
  const tauOfKnick = f => (fin(f) && f > 0 ? 1 / (Math.PI * f) : NaN);

  /* ---- Übungsgenerator (EMV_CORE.exercise) ---- */
  const XNAME = { dbV: 'dB: Spannungsverhältnis', dbP: 'dB: Leistungsverhältnis', dbuv: 'Spannung in dBµV', dbm: 'dBm in dBµV', dbSum: 'Pegel addieren', fRes: 'LC-Resonanz', fgRC: 'RC-Grenzfrequenz', ilRC: 'Dämpfung eines RC-Glieds', schleife: 'Schleifenfläche', uInd: 'Induzierte Spannung', kapTeiler: 'Kapazitiver Teiler', knick: 'Knickfrequenz', hnw: 'Pegel einer Oberwelle', skin: 'Hauttiefe', seFern: 'Schirmdämpfung (Fernfeld)', schlitz: 'Schlitz', lambda4: 'Viertelwellenlänge', yStrom: 'Ableitstrom', hbm: 'ESD-Energie', marge: 'Marge' };
  function exerciseKinds() { const C = CORE(); const k = C && C.exercise && Array.isArray(C.exercise.kinds) ? C.exercise.kinds : []; return k.map(id => ({ id, name: XNAME[id] || id })); }
  function newExercise(kind, seed) {
    const C = CORE(); if (!C || typeof C.exercise !== 'function') return bad(C ? NOFN('exercise') : NOCORE);
    const kinds = exerciseKinds(); if (!kind || !kinds.some(k => k.id === kind)) kind = kinds.length ? kinds[Math.floor((fin(seed) ? Math.abs(seed) : Math.random() * 1e6) % kinds.length)].id : kind;
    let ex; try { ex = C.exercise(kind, fin(seed) ? seed : Math.floor(Math.random() * 1e6) + 1); } catch (e) { ex = null; }
    return ex && ex.ok !== false ? ex : bad((ex && ex.why) || 'Diese Aufgabe gibt es nicht.');
  }
  function checkExercise(ex, input) {
    if (!ex || typeof ex.check !== 'function') return { ok: false, text: 'Es gibt keine Aufgabe zum Prüfen.' };
    let r; try { r = ex.check(input); } catch (e) { r = null; } return r && typeof r === 'object' ? r : { ok: false, text: 'Die Prüfung hat nichts geliefert.' };
  }

  /* ============================================================ Karten */
  const CARDS = [
    { id: 'db', title: '1 · dB-Rechner', intro: 'Verhältnis, Pegel und Marge: Spannung 20·lg, Leistung 10·lg. Pegel in dBµV beziehen sich auf 1 µV, dBm auf 1 mW (50 Ω).', forms: ['dbV', 'dbP', 'dbuv', 'dbuvInv', 'dbm', 'marge'], custom: ['dbsum'] },
    { id: 'filter', title: '2 · Resonanz und Filter', intro: 'Resonanzfrequenz, Grenzfrequenz, Dämpfung eines RC- oder LC-Glieds, Ableitstrom über den Y-Kondensator und die Eigenresonanz eines Kondensators mit Anschlussinduktivität.', forms: ['fRes', 'fgRC', 'fgLR', 'ilFirst', 'xl', 'yStrom'], custom: ['esl'], sketch: true },
    { id: 'schleife', title: '3 · Schleifen und Einkopplung', intro: 'Die Schleifenfläche fängt Magnetfeld ein (u = −dΦ/dt), die Koppelkapazität bildet mit der Opfer-Impedanz einen Teiler.', forms: ['schleife', 'uInd', 'uIndM', 'kapTeiler', 'kapTeilerNf', 'galv', 'snr'], custom: ['gtgg'] },
    { id: 'hnw', title: '4 · Oberwellen', intro: 'Ein Trapezsignal hat Linien bei Vielfachen der Grundfrequenz. Die Einhüllende fällt ab f1 mit 20 dB je Dekade und ab f2 mit 40 dB je Dekade. Ziehe die Knickfrequenzen im Bild: Die Linien folgen.', forms: ['hnwEnv', 'knick', 'knick2', 'flankeBw'], custom: ['hnw'] },
    { id: 'schirm', title: '5 · Schirmung', intro: 'Schirmdämpfung SE = A + R + B für Kupfer, Aluminium, Stahl und Leitlack (Fern- und Nahfeld), Schlitz (λ/2) und Kabelschirm. Alle Werte sind Übungswerte, Herstellerdokumentation und aktuelle Norm maßgeblich.', forms: ['skin', 'se', 'seThin', 'schlitz'], custom: ['shield', 'slot', 'cable'] },
    { id: 'antenne', title: '6 · Leitung als Antenne', intro: 'Wellenlänge, Viertelwellen-Resonanz eines Kabels und Feldstärke eines kurzen Kabels (nur für ℓ unter λ/10). Ein Analysatorwert wird mit Antennenfaktor und Kabeldämpfung in eine Feldstärke umgerechnet.', forms: ['lambda', 'lambda4', 'eKurz'], custom: ['res', 'afeld'] },
    { id: 'impuls', title: '7 · Impulse', intro: 'ESD-Körpermodell: Energie ½·C·U² und der idealisierte Strom U/R. Der Normimpuls hat einen etwas anderen Strom; beide Zahlen stehen im Rechenweg nebeneinander. Prüfpegel sind Übungswerte (A), Herstellerdokumentation und aktuelle Norm maßgeblich.', forms: ['hbm', 'hbmI'], custom: ['surge', 'burst'] }
  ];
  const SEL = (id, label, opts, def) => ({ key: id, label, select: opts, def });
  const CUSTOM = {
    dbsum: { title: 'Pegel addieren (Liste)', inputs: [{ key: 'list', label: 'Pegel in dBµV, getrennt durch Semikolon', text: true, def: '60; 60; 57' }], calc: v => dbSumList(v.list) },
    esl: { title: 'Kondensator mit Anschlussinduktivität: Eigenresonanz', inputs: [{ key: 'c', label: 'C', unit: 'F', def: 1e-7 }, { key: 'esl', label: 'ESL (Anschlussinduktivität)', unit: 'H', def: 2e-8 }], calc: eslCalc },
    gtgg: { title: 'Gleichtakt gegen Gegentakt (Erklärkarte)', explain: true },
    hnw: { title: 'Einhüllende und Linien zeichnen', draw: true },
    shield: { title: 'Schirmdämpfung A + R + B', inputs: [SEL('mat', 'Material', MATS, 'kupfer'), { key: 't', label: 'Dicke t', unit: 'm', def: 1e-3 }, { key: 'f', label: 'Frequenz f', unit: 'Hz', def: 1e6 }, SEL('feld', 'Feldart', FELDER, 'fern'), { key: 'r', label: 'Abstand r (Nahfeld)', unit: 'm', def: 0.1 }, { key: 'rsq', label: 'Flächenwiderstand (nur Leitlack)', unit: 'Ω', def: 0.1 }], calc: shieldCalc },
    slot: { title: 'Schlitz im Gehäuse', inputs: [{ key: 'len', label: 'Schlitzlänge ℓ', unit: 'm', def: 0.1 }, { key: 'f', label: 'Frequenz f', unit: 'Hz', def: 3e8 }], calc: slotCalc },
    cable: { title: 'Kabelschirm: Pigtail gegen 360°', inputs: [SEL('mode', 'Anbindung', [['pigtail', 'Pigtail (Schirmlitze)'], ['360', '360° am Gehäuse']], 'pigtail'), { key: 'lp', label: 'Länge der Schirmlitze', unit: 'm', def: 0.05 }, { key: 'f', label: 'Frequenz f', unit: 'Hz', def: 1e8 }, { key: 'ish', label: 'Schirmstrom', unit: 'A', def: 5e-4 }], calc: cableCalc },
    res: { title: 'Viertelwellen-Resonanzen eines Kabels', inputs: [{ key: 'len', label: 'Kabellänge ℓ', unit: 'm', def: 1.5 }, { key: 'n', label: 'Anzahl (1 bis 6)', unit: '', def: 3 }], calc: resonanceCalc },
    afeld: { title: 'Analysatorwert ↔ Feldstärke', inputs: [SEL('dir', 'Richtung', [['fwd', 'Pegel → Feldstärke'], ['inv', 'Feldstärke → Pegel']], 'fwd'), { key: 'u', label: 'Pegel (oder Feldstärke) in dB', unit: 'dB', def: 40 }, { key: 'af', label: 'Antennenfaktor in dB/m', unit: 'dB', def: 15 }, { key: 'ac', label: 'Kabeldämpfung in dB', unit: 'dB', def: 1.5 }], calc: afeldCalc },
    surge: { title: 'Surge: Energie am Varistor', inputs: [{ key: 'kv', label: 'Prüfpegel in kV', unit: 'kV', def: 2 }, { key: 'zi', label: 'Innenwiderstand', unit: 'Ω', def: 2 }, SEL('var', 'Varistor', [['v230', '230 V'], ['v275', '275 V'], ['v320', '320 V']], 'v275')], calc: surgeCalc },
    burst: { title: 'Burst: Treppenwert', inputs: [{ key: 'kv', label: 'Prüfpegel in kV', unit: 'kV', def: 2 }, { key: 'frep', label: 'Wiederholrate', unit: 'Hz', def: 1e5 }, { key: 'rin', label: 'Eingangswiderstand der Leitung', unit: 'Ω', def: 1e5 }, { key: 'cin', label: 'Eingangskapazität', unit: 'F', def: 1e-10 }], calc: burstCalc }
  };
  const ST = { vals: {}, cvals: {}, ex: null, exKind: '', exRes: null, exSteps: false, hnw: { A: '3,3 V', T: '10 µs', tau: '5 µs', tr: '2 ns' }, n: 0, loop: 0 };
  function customCalc(id, vals) { const c = CUSTOM[id]; if (!c || !c.calc) return bad('Diesen Rechner gibt es nicht.'); const v = {}; (c.inputs || []).forEach(i => { v[i.key] = vals && vals[i.key] != null ? vals[i.key] : (i.select ? i.def : i.text ? i.def : i.def); });
    return c.calc(v); }

  /* ============================================================ Darstellung */
  const resHtml = (r, extra) => {
    if (!r) return '';
    if (!r.ok) return `<div class="res warn" role="status"><b style="color:var(--warn)">Kein Ergebnis.</b> ${esc(r.why || '')}</div>`;
    const steps = Array.isArray(r.steps) ? r.steps : [];
    return `<div class="res" role="status"><div class="big2">${esc(valueText(r.value, r.unit))}</div>${r.note ? `<p class="hint2" style="margin:4px 0 0">${esc(r.note)}</p>` : ''}${steps.length ? `<ol>${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}${extra || ''}</div>`;
  };
  const fld = (name, label, unit, val, o) => (o && o.select ? `<label class="f"><span>${esc(label)}</span><select data-ci="${esc(name)}" aria-label="${esc(label)}">${o.select.map(x => `<option value="${esc(x[0])}"${String(val) === String(x[0]) ? ' selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>`
    : `<label class="f"><span>${esc(label)}${unit ? ' [' + esc(unit) + ']' : ''}</span><input data-ci="${esc(name)}" inputmode="${o && o.text ? 'text' : 'decimal'}" autocomplete="off" value="${esc(val)}" aria-label="${esc(label)}"></label>`);
  function formHtml(id) {
    const f = formulaById(id); if (!f) return `<details class="fm"><summary>${esc(id)}</summary><div class="fmb"><p class="hint2">${esc(CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE)}</p></div></details>`;
    const ins = formulaInputs(f), v = ST.vals[id] || (ST.vals[id] = ins.map(defText));
    return `<details class="fm" data-formula="${esc(id)}"><summary>${esc(f.name || id)}<span class="hint2" style="margin-left:auto;padding-left:8px">${esc(f.unit || '')}</span></summary><div class="fmb"><div class="hint2" style="margin:0 0 6px">${esc(f.expr || '')}</div>
      <div class="frm">${ins.map((i, k) => `<label class="f"><span>${esc(i.label)}${i.unit ? ' [' + esc(i.unit) + ']' : ''}</span><input data-fid="${esc(id)}" data-arg="${k}" inputmode="decimal" autocomplete="off" value="${esc(v[k] != null ? v[k] : defText(i))}" aria-label="${esc(i.label)}"></label>`).join('')}</div><div data-res="f-${esc(id)}">${resHtml(formulaCalc(id, v))}</div></div></details>`;
  }
  function customHtml(id) {
    const c = CUSTOM[id]; if (!c) return '';
    if (c.explain) {
      const g = n => { const C = CORE(); let x = null; try { x = C && C.glossary && C.glossary.get ? C.glossary.get(n) : null; } catch (e) {} return x ? `<p style="margin:4px 0"><b>${esc(x.term)} (${esc(x.symbol || '')}):</b> ${esc(x.text)}</p>` : ''; };
      return `<details class="fm"><summary>${esc(c.title)}</summary><div class="fmb">${g('gleichtakt') || '<p class="hint2">Das Glossar ist nicht geladen.</p>'}${g('gegentakt')}<p class="hint2" style="margin:6px 0 0">Merke: Der Gleichtakt strahlt über das Kabel besonders gut, der Gegentakt koppelt vor allem über die Schleifenfläche.</p></div></details>`;
    }
    if (c.draw) {
      const h = ST.hnw; return `<details class="fm" open data-custom="hnw"><summary>${esc(c.title)}</summary><div class="fmb"><div class="frm">${['A:Amplitude A [V]', 'T:Periode T [s]', 'tau:Impulsbreite τ [s]', 'tr:Anstiegszeit tr [s]'].map(s => { const [k, l] = s.split(':'); return fld(k, l, '', h[k], { }).replace('data-ci', 'data-hn'); }).join('')}</div>
        <div class="hnwwrap"><canvas id="hnwCv" role="img" aria-label="Spektrum der Oberwellen mit Einhüllender"></canvas></div><div class="readout" id="hnwRead" aria-live="polite"></div><div data-res="hnw">${hnwInfo()}</div>
        <p class="hint2">Ziehe die Marker f1 und f2 im Bild: f1 gehört zur Impulsbreite (f1 = 1/(π·τ)), f2 zur Anstiegszeit (f2 = 1/(π·tr)). Die Linien sind Spitzenwerte der Oberwellen in dBµV (Effektwert der Sinusschwingung), die Einhüllende fällt ab f1 mit −20 dB je Dekade, ab f2 mit −40 dB je Dekade.</p></div></details>`;
    }
    const v = ST.cvals[id] || (ST.cvals[id] = {}); (c.inputs || []).forEach(i => { if (v[i.key] == null) v[i.key] = i.select ? i.def : i.text ? i.def : defText({ def: i.def, unit: i.unit }); });
    return `<details class="fm" data-custom="${esc(id)}"><summary>${esc(c.title)}</summary><div class="fmb"><div class="frm">${c.inputs.map(i => fld(id + ':' + i.key, i.label, i.unit && i.unit !== 'kV' ? i.unit : i.unit, v[i.key], i.select ? { select: i.select } : { text: i.text })).join('')}</div><div data-res="c-${esc(id)}">${resHtml(customCalc(id, v))}</div></div></details>`;
  }
  function hnwInfo() {
    const m = hnwModel(ST.hnw); if (!m.ok) return resHtml(m);
    const h = Math.max(1, Math.round(m.cfg.tau / m.cfg.T * 100)); void h;
    return `<div class="res"><div class="big2">f1 = ${esc(fe(m.f1, 'Hz'))}, f2 = ${esc(fe(m.f2, 'Hz'))}</div><ol><li>f1 = 1/(π·τ) = ${esc(fe(m.f1, 'Hz'))} (−20 dB je Dekade darüber)</li><li>f2 = 1/(π·tr) = ${esc(fe(m.f2, 'Hz'))} (−40 dB je Dekade darüber)</li><li>Bandbreite aus der Flanke (10–90 %): 0,35/(0,8·tr) = ${esc(fe(0.35 / (0.8 * m.cfg.tr), 'Hz'))}</li></ol></div>`;
  }
  function sketchHtml() { return '<p class="hint2">Skizze der asymptotischen Kurve: Bis fg bleibt die Dämpfung nahe 0 dB, darüber steigt sie mit 20 dB je Dekade (RC, 1. Ordnung) bzw. 40 dB je Dekade (LC, 2. Ordnung). Die Rechenkarte „Dämpfung eines RC- oder LC-Glieds“ liefert den Wert bei einer Frequenz.</p>'; }
  function cardHtml(c, open) {
    return `<details class="card" data-card="${c.id}"${open ? ' open' : ''}><summary>${esc(c.title)}</summary><div class="cb"><p class="hint2" style="margin:2px 6px 6px">${esc(c.intro)}</p>${c.sketch ? `<div class="skwrap"><canvas data-sketch="1" role="img" aria-label="Asymptotische Dämpfung über der Frequenz"></canvas></div>` + sketchHtml() : ''}${c.forms.map(formHtml).join('')}${(c.custom || []).map(customHtml).join('')}</div></details>`;
  }
  function exHtml() {
    const kinds = exerciseKinds(), ex = ST.ex;
    return `<details class="card" data-card="ex" open><summary>8 · Übungsgenerator</summary><div class="cb"><p class="hint2" style="margin:2px 6px 6px">Eine Aufgabe mit gerundeten Zahlen zum Kopfrechnen oder mit dem Taschenrechner. Das Ergebnis darf mit oder ohne Einheit eingetragen werden (Komma oder Punkt).</p>
      <label class="f" style="padding:0 6px"><span>Art der Aufgabe</span><select id="exKind"><option value="">Zufällig</option>${kinds.map(k => `<option value="${esc(k.id)}"${ST.exKind === k.id ? ' selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>
      <div class="btns" style="padding:0 6px"><button class="btn pri" data-ex="new">Neue Aufgabe</button></div><div id="exBody">${exBodyHtml()}</div></div></details>`;
  }
  function exBodyHtml() {
    const ex = ST.ex; if (!ex) return '<p class="hint2" style="padding:0 6px">Tippe auf „Neue Aufgabe“.</p>'; if (ex.ok === false) return resHtml(ex);
    return `<div class="ex" style="margin:8px 6px"><p style="margin:0">${esc(ex.question)}</p></div><label class="f" style="padding:0 6px"><span>Dein Ergebnis${ex.answer && ex.answer.unit ? ' in ' + esc(ex.answer.unit) : ''}</span><input id="exIn" inputmode="decimal" autocomplete="off" aria-label="Ergebnis"></label>
      <div class="btns" style="padding:0 6px"><button class="btn pri" data-ex="check">Prüfen</button><button class="btn" data-ex="steps">Rechenweg zeigen</button></div>
      ${ST.exRes ? `<div class="ex ${ST.exRes.ok ? 'ok' : 'bad'}" style="margin:8px 6px" role="status"><b>${ST.exRes.ok ? '✓' : '✗'}</b> ${esc(ST.exRes.text)}</div>` : ''}${ST.exSteps && ex.steps ? `<div class="res" style="margin:8px 6px"><ol>${ex.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}`;
  }
  function useStat() { if (!A || !A.stat) return; try { const k = ((A.lsGet ? A.lsGet('emv.calcn', 0) : 0) || 0) + 1; if (A.lsSet) A.lsSet('emv.calcn', k); A.stat('emvcalc', k, 'max'); } catch (e) {} }
  const CSS = `.hnwwrap canvas,.skwrap canvas{display:block;width:100%;height:auto;aspect-ratio:16/8;background:var(--well);border:1px solid var(--line);border-radius:10px;touch-action:none;margin:6px 0}
.skwrap canvas{aspect-ratio:16/5}.hnwwrap canvas{cursor:ew-resize}@media(max-width:600px){.hnwwrap canvas{aspect-ratio:4/3}.skwrap canvas{aspect-ratio:16/8}}
.res.warn{border-color:var(--warn)}.card .fm{margin:6px 6px}`;

  E.calc = E.calc || {};
  E.calc.render = function (host, api) {
    if (!host) return; A = api; const UT = E.util; if (UT && UT.injectCss) UT.injectCss('emv-calc-css', CSS); else if (typeof document !== 'undefined' && !document.getElementById('emv-calc-css')) { const s = document.createElement('style'); s.id = 'emv-calc-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!CORE()) { host.innerHTML = `<div class="card pl"><p class="big">Rechner wird geladen</p><p class="hint2">${esc(NOCORE)}</p><div class="btns"><button class="btn" data-retry>Erneut prüfen</button></div></div>`; return; }
    host.innerHTML = `<div class="card pl"><h4>Rechnen</h4><p class="hint2" style="margin:0">Sieben Rechner und ein Übungsgenerator. Tippe eine Formel an, setze Zahlen ein und sieh den Rechenweg. Eingaben: Komma oder Punkt, Einheit und Vorsatz erlaubt (2,2 nF, 30 MHz); ohne Vorsatz gilt die Einheit in eckigen Klammern. Alle Werte sind Übungswerte (A), Herstellerdokumentation und aktuelle Norm maßgeblich.</p></div>` + CARDS.map((c, i) => cardHtml(c, i === 0)).join('') + exHtml();
    wire(host); drawSketches(host); startHnw(host);
  };

  function wire(host) {
    if (!host.addEventListener) return;
    const recalc = (t) => {
      if (t.dataset && t.dataset.fid) {
        const id = t.dataset.fid, f = formulaById(id), v = ST.vals[id] || (ST.vals[id] = formulaInputs(f).map(defText)); v[+t.dataset.arg] = t.value; const cell = host.querySelector('[data-res="f-' + id + '"]'); if (cell) cell.innerHTML = resHtml(formulaCalc(id, v)); useStat();
      } else if (t.dataset && t.dataset.ci) {
        const m = String(t.dataset.ci).split(':'), id = m[0], key = m[1], v = ST.cvals[id] || (ST.cvals[id] = {}); v[key] = t.value; const cell = host.querySelector('[data-res="c-' + id + '"]'); if (cell) cell.innerHTML = resHtml(customCalc(id, v)); useStat();
      } else if (t.dataset && t.dataset.hn) { ST.hnw[t.dataset.hn] = t.value; const cell = host.querySelector('[data-res="hnw"]'); if (cell) cell.innerHTML = hnwInfo(); ST.hnwDirty = true; useStat(); }
    };
    once(host, 'calc', 'input', e => recalc(e.target)); once(host, 'calc', 'change', e => { const t = e.target; if (t && t.id === 'exKind') { ST.exKind = t.value; return; } recalc(t); });
    once(host, 'calc', 'click', e => {
      const b = e.target.closest && e.target.closest('[data-ex]'); if (!b) return; const k = b.dataset.ex;
      if (k === 'new') { ST.ex = newExercise(ST.exKind, Math.floor(Math.random() * 1e6) + 1); ST.exRes = null; ST.exSteps = false; const body = host.querySelector('#exBody'); if (body) body.innerHTML = exBodyHtml(); }
      else if (k === 'check') { const inp = host.querySelector('#exIn'); ST.exRes = checkExercise(ST.ex, inp ? inp.value : ''); useStat(); const body = host.querySelector('#exBody'); if (body) body.innerHTML = exBodyHtml(); const i2 = host.querySelector('#exIn'); if (i2 && inp) i2.value = inp.value; }
      else if (k === 'steps') { ST.exSteps = !ST.exSteps; const inp = host.querySelector('#exIn'), val = inp ? inp.value : ''; const body = host.querySelector('#exBody'); if (body) body.innerHTML = exBodyHtml(); const i2 = host.querySelector('#exIn'); if (i2) i2.value = val; }
    });
  }
  /* ---- Skizze der asymptotischen Dämpfung (Karte 2): reine Darstellung der Kernformel ilFirst ---- */
  function drawSketches(host) {
    if (!host.querySelectorAll) return; const UT = E.util; if (!UT) return;
    host.querySelectorAll('canvas[data-sketch]').forEach(cv => {
      if (!cv.getContext) return; const W = cv.clientWidth || 400, H = cv.clientHeight || 130, dpr = Math.min(2, root.devicePixelRatio || 1); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const fg = 1e5, P = UT.pal(), pts1 = [], pts2 = []; for (let k = 0; k <= 60; k++) { const f = 1e3 * Math.pow(1e8 / 1e3, k / 60), r1 = formulaCalc('ilFirst', [f, fg, 1]), r2 = formulaCalc('ilFirst', [f, fg, 2]); if (r1.ok) pts1.push([f, r1.value]); if (r2.ok) pts2.push([f, r2.value]); }
      UT.lineChart(g, W, H, { xMin: 1e3, xMax: 1e8, xLog: true, yMin: 0, yMax: 120, series: [{ name: '1. Ordnung', pts: pts1, color: P.acc, width: 2 }, { name: '2. Ordnung', pts: pts2, color: P.src, width: 2, dash: [8, 4] }], vlines: [{ x: fg, text: 'fg = ' + fe(fg, 'Hz') }], xLabel: 'Frequenz in Hz, kHz, MHz', yLabel: 'Dämpfung in dB', xTick: v => fe(v, 'Hz') });
    });
  }
  /* ---- Interaktive Zeichnung der Oberwellen (Karte 4) ---- */
  const HS = { drag: null, geo: null };
  function startHnw(host) {
    if (typeof requestAnimationFrame === 'undefined' || !host.querySelector) return; const cv = host.querySelector('#hnwCv'); if (!cv) return; const my = ++ST.loop; ST.hnwDirty = true;
    const posX = e => { const r = cv.getBoundingClientRect(); return e.clientX - r.left; };
    const setKnick = (which, f) => { const m = hnwModel(ST.hnw); if (!m.ok) return; const hn = ST.hnw; const tauMin = m.cfg.tr * 1.01; let tau = pn(hn.tau), tr = pn(hn.tr); if (which === 'f1') tau = Math.max(tauOfKnick(f), tauMin); else tr = Math.min(tauOfKnick(f), tau / 1.01); ST.hnw.tau = fe(tau, 's'); ST.hnw.tr = fe(tr, 's'); ST.hnwDirty = true;
      host.querySelectorAll('[data-hn]').forEach(i => { if (i.dataset.hn === 'tau') i.value = ST.hnw.tau; if (i.dataset.hn === 'tr') i.value = ST.hnw.tr; }); const cell = host.querySelector('[data-res="hnw"]'); if (cell) cell.innerHTML = hnwInfo(); };
    cv.addEventListener('pointerdown', e => { const g = HS.geo; if (!g) return; const x = posX(e), d1 = Math.abs(x - g.x1), d2 = Math.abs(x - g.x2); HS.drag = d1 < d2 ? (d1 < 40 ? 'f1' : null) : (d2 < 40 ? 'f2' : null); if (HS.drag) { try { cv.setPointerCapture(e.pointerId); } catch (x2) {} e.preventDefault(); } });
    cv.addEventListener('pointermove', e => { if (!HS.drag || !HS.geo) return; setKnick(HS.drag, HS.geo.inv(clamp(posX(e), HS.geo.px0, HS.geo.px0 + HS.geo.pw))); });
    const up = () => { HS.drag = null; }; cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    const tick = () => { if (my !== ST.loop || !host.isConnected) return; requestAnimationFrame(tick); if (!A || !A.S || A.S.tab !== 'calc' || !ST.hnwDirty) return; ST.hnwDirty = false; drawHnw(cv, host); };
    requestAnimationFrame(tick);
  }
  function drawHnw(cv, host) {
    const UT = E.util; if (!UT || !cv.getContext) return; const m = hnwModel(ST.hnw), W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return; const dpr = Math.min(2, root.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); const P = UT.pal(); if (!m.ok) { g.fillStyle = P.bg; g.fillRect(0, 0, W, H); UT.label(g, m.why || 'Keine Zeichnung', 8, H / 2, { size: 13, W }); return; }
    const xMin = 1e4, xMax = 1e9, top = Math.ceil((m.env.at ? m.at(xMin) : 100) / 10) * 10 + 10, ls = m.lines.filter(l => l.f >= xMin && l.f <= xMax), yMin = top - 100;
    const lineSeries = []; ls.forEach(l => { lineSeries.push({ pts: [[l.f, Math.max(yMin, -200)], [l.f, l.L]], color: P.mass, width: W < 460 ? 1.2 : 1.8 }); });
    const env = []; for (let k = 0; k <= 80; k++) { const f = xMin * Math.pow(xMax / xMin, k / 80), L = m.at(f); if (fin(L)) env.push([f, L]); }
    const geo = UT.lineChart(g, W, H, { xMin, xMax, xLog: true, yMin, yMax: top, series: lineSeries.concat([{ pts: env, color: P.fg, width: 2, dash: [8, 4] }]), vlines: [{ x: m.f1, text: 'f1 = ' + fe(m.f1, 'Hz'), color: P.warn, dash: [6, 3], row: 0 }, { x: m.f2, text: 'f2 = ' + fe(m.f2, 'Hz'), color: P.src, dash: [6, 3], row: 1 }], xLabel: 'Frequenz in Hz, kHz, MHz', yLabel: 'Pegel in dBµV', xTick: v => fe(v, 'Hz') });
    if (geo) { HS.geo = { px0: geo.px0, pw: geo.pw, x1: geo.X(m.f1), x2: geo.X(m.f2), inv: geo.inv }; [[m.f1, P.warn], [m.f2, P.src]].forEach(([f, c]) => { const x = geo.X(f); g.fillStyle = c; g.beginPath(); g.moveTo(x - 8, geo.py0 + geo.ph); g.lineTo(x + 8, geo.py0 + geo.ph); g.lineTo(x, geo.py0 + geo.ph - 12); g.closePath(); g.fill(); g.strokeStyle = P.bg; g.lineWidth = 1.5; g.stroke(); }); }
    const rd = host.querySelector('#hnwRead'); if (rd) { const t = 'Linien: ' + ls.length + ' im Bild · ' + (ls[0] ? 'erste Linie ' + fe(ls[0].f, 'Hz') + ' mit ' + fnum(ls[0].L, 1) + ' dBµV' : ''); if (rd.textContent !== t) rd.textContent = t; }
  }
  E.calc.fn = { FDEF, CARDS, CUSTOM, formulaById, formulaList, formulaInputs, formulaCalc, valueText, dbSumList, eslCalc, shieldCalc, slotCalc, cableCalc, resonanceCalc, afeldCalc, surgeCalc, burstCalc, hnwModel, tauOfKnick, exerciseKinds, newExercise, checkExercise, customCalc, defText, fe, fnum };
  E.calc.state = ST;
  if (typeof module !== 'undefined') module.exports = E.calc;
})(typeof window !== 'undefined' ? window : globalThis);
