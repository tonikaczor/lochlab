'use strict';
/* Tonfunk Thermik-Lab: Tab "Rechnen" (WP3b).
   Neun Karten: Prüfungsassistent (recipe, sieben Schritte), Verlustleistung, Wärmekette, erforderlicher Kühlkörper, Wirkungsgrad Linear- gegen Schaltregler,
   Zeitverhalten, Wärmewiderstand einer Schicht, Formelsammlung (alle THM_CORE.formulas) und Übungsgenerator (exercise).
   ALLE Rechnungen laufen über THM_CORE (recipe, steady, chain, pzul, taMax, rthKerf, chooseHeatsink, power.*, formulas, heatCapacity, rthLayerMM, exercise);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Fehlt eine Kernfunktion, erscheint ein Hinweis statt Zahlen.
   Schnittstelle (SPEC 6.7): window.THM_UI_EXT.calc.render(host, api), api = { S, rig, setTab, loadExample, startTask, toast, esc, stat, lsGet, lsSet, THM_CORE, loadRig, sx, sy }.
   Die reinen Rechenfunktionen (ohne DOM) hängen unter THM_UI_EXT.calc.fn und werden von test_thmui_ext.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.THM_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fauto = v => (fin(v) ? fnum(v, adig(v)) : '–');
  const pn = s => { const C = CORE(); if (typeof s === 'number') return fin(s) ? s : NaN; const t = String(s == null ? '' : s); if (C && typeof C.parseNum === 'function') { const v = C.parseNum(t); return fin(v) ? v : NaN; } const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN; };
  const pick = (o, keys) => { if (typeof o === 'number') return o; if (!o || typeof o !== 'object') return NaN; for (const k of keys) if (fin(o[k])) return o[k]; return NaN; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (thmcore.js fehlt). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (thmcore.js ist noch nicht vollständig). Dieser Rechner liefert deshalb noch keine Zahlen.';
  const has = (...path) => { let o = CORE(); for (const k of path) { if (!o) return false; o = o[k]; } return typeof o === 'function'; };
  let A = null; /* api der Seite (nur für Oberfläche, nie für Rechnung) */
  const sx = s => (A && typeof A.sx === 'function' ? A.sx(s) : String(s == null ? '' : s));
  const sy = k => (A && typeof A.sy === 'function' ? A.sy(k) : (CORE() && CORE().sym ? CORE().sym(k) : k));

  /* ============================================================ Tabellen aus dem Kern (Auswahllisten) */
  const DEV_ORDER = ['7805', 'lm317', 'bd139', 'irlz34n', '1n4007', 'r-zement5', 'r-alu50', 'led3w'];
  function deviceList() { const C = CORE(); if (!C || !C.devices) return []; return DEV_ORDER.filter(id => C.devices[id]).map(id => ({ value: id, label: C.devices[id].name || id })); }
  function mountOptions(key) {
    const C = CORE(); let list = []; try { list = C && typeof C.mountControls === 'function' ? C.mountControls() : []; } catch (e) { list = []; }
    const c = (list || []).find(x => x && x.key === key); return c && Array.isArray(c.options) ? c.options.map(o => ({ value: o.value, label: o.label })) : [];
  }
  const MKEYS = ['heatsink', 'joint', 'paste', 'screw', 'fan', 'orient'];
  const MLAB = { heatsink: 'Kühlkörper', joint: 'Übergang', paste: 'Wärmeleitpaste', screw: 'Schraube', fan: 'Lüfter', orient: 'Einbaulage' };
  const MDEF = { heatsink: 'm', joint: 'glimmer', paste: 'duenn', screw: 'fest', fan: 'aus', orient: 'senkrecht' };

  /* ============================================================ reine Rechenfunktionen (alle rufen THM_CORE) */
  /* Aufbau (cfg nach SPEC 4.1) aus Eingabewerten */
  function cfgOf(v) {
    v = v || {}; const cfg = { device: v.device || '7805', heatsink: v.heatsink || 'none', joint: v.joint || 'direkt', paste: v.paste || 'duenn', bushing: true, screw: v.screw || 'fest', ksPot: 'masse', fan: v.fan || 'aus', orient: v.orient || 'senkrecht', count: pn(v.count) > 1 ? Math.round(pn(v.count)) : 1 };
    if (cfg.heatsink === 'blech') cfg.blech = { A_cm2: fin(pn(v.blechA)) ? pn(v.blechA) : 100, d_mm: 2, material: 'al' };
    if (v.free && fin(pn(v.rthJC)) && pn(v.rthJC) >= 0) cfg.overrides = { rthJC: pn(v.rthJC) };
    return cfg;
  }
  const iqOf = id => { const C = CORE(), d = C && C.devices && C.devices[id], q = d && d.iq; return fin(q) && q > 0 ? q : NaN; };
  const stepsOf = r => (r && Array.isArray(r.steps) ? r.steps : []);
  /* Prüfungsassistent: Berechnungsgang in sieben Schritten (THM_CORE.recipe). Betriebspunkt: Linearregler (ue, ua, ia, iq) oder P direkt */
  function assistant(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!has('recipe')) return { ok: false, why: NOFN('recipe') };
    v = v || {}; const cfg = cfgOf(v), ta = pn(v.ta); let p = NaN, pre = null;
    if (!fin(ta)) return { ok: false, why: 'Bitte die Umgebungstemperatur als Zahl eintragen (Komma oder Punkt).' };
    if (v.mode === 'linear') {
      const ue = pn(v.ue), ua = pn(v.ua), ia = pn(v.ia), iq = v.iq ? (typeof v.iq === 'number' ? v.iq : iqOf(cfg.device)) : NaN; /* Ruhestrom: Wert des Bauteils aus dem Kern */
      if (![ue, ua, ia].every(fin)) return { ok: false, why: 'Bitte Ue, Ua und Ia als Zahlen eintragen.' };
      pre = C.power.linear(ue, ua, ia, fin(iq) && iq > 0 ? iq : undefined); if (!pre || pre.ok === false) return { ok: false, why: (pre && pre.why) || 'Die Verlustleistung lässt sich nicht berechnen.' };
      p = pick(pre, ['p', 'value']);
    } else { p = pn(v.p); if (!fin(p) || p < 0) return { ok: false, why: 'Bitte die Verlustleistung als Zahl größer oder gleich 0 eintragen.' }; }
    const inp = { cfg, device: cfg.device, ta, p, count: cfg.count, compare: v.compare !== false };
    if (v.mode === 'linear') Object.assign(inp, { ue: pn(v.ue), ua: pn(v.ua), ia: pn(v.ia), iq: v.iq ? (typeof v.iq === 'number' ? v.iq : iqOf(cfg.device)) : 0 });
    if (v.free) { const tm = pn(v.tjMax); if (fin(tm)) inp.tjMax = tm; }
    let r; try { r = C.recipe(inp); } catch (e) { r = null; }
    if (!r || r.ok === false) return { ok: false, why: (r && (r.why || (Array.isArray(r.warn) && r.warn[0]))) || 'Der Berechnungsgang ist mit diesen Werten nicht möglich.', cfg, p, pre };
    return { ok: true, cfg, p, pre, steps: stepsOf(r), result: r.result || {}, warn: Array.isArray(r.warn) ? r.warn : [], recipe: r };
  }
  /* Verlustleistung: kind = linear | bipolar | mosfet | diode | resistor | led | endstufe */
  const PWR = ['linear', 'bipolar', 'mosfet', 'diode', 'resistor', 'led', 'endstufe'];
  const PNAME = { linear: 'Linearregler', bipolar: 'Längstransistor', mosfet: 'MOSFET-Schalter', diode: 'Diode', resistor: 'Leistungswiderstand', led: 'Power-LED', endstufe: 'Endstufe (Gegentakt-B)' };
  const PFORM = { linear: 'pLinear', bipolar: 'pBipolar', mosfet: 'pMosfet', diode: 'diodeFF', resistor: 'pRes', endstufe: 'endstufe' };
  const LEDF = [{ key: 'n', label: 'Anzahl LEDs n', unit: '', def: 3 }, { key: 'uf', label: 'Flussspannung UF je LED', unit: 'V', def: 3.2 }, { key: 'i', label: 'Strom I', unit: 'A', def: 0.7 }, { key: 'etaTh', label: 'Wärmeanteil η_th (0…1)', unit: '', def: 0.7 }];
  function powerInputs(kind) { if (kind === 'led') return LEDF; const f = formulaById(PFORM[kind]); return f ? formulaInputs(f) : []; }
  function powerCalc(kind, vals) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; vals = vals || {};
    if (kind === 'led') {
      const o = {}; LEDF.forEach(i => { o[i.key] = pn(vals[i.key]); }); if (!LEDF.every(i => fin(o[i.key]))) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).' };
      if (!C.power || typeof C.power.led !== 'function') return { ok: false, why: NOFN('power.led') };
      const r = C.power.led(o); return r && r.ok !== false && fin(pick(r, ['p', 'value'])) ? { ok: true, value: pick(r, ['p', 'value']), unit: 'W', steps: stepsOf(r), core: r } : { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
    }
    if (kind === 'linear') {
      const f = formulaCalc('pLinear', vals); if (!f.ok) return f; const r = C.power && C.power.linear ? C.power.linear(pn(vals.ue), pn(vals.ua), pn(vals.ia), pn(vals.iq) > 0 ? pn(vals.iq) : undefined) : null;
      return Object.assign({}, f, { pOhneIq: r && fin(r.pOhneIq) ? r.pOhneIq : undefined, pMitIq: r && fin(r.pMitIq) ? r.pMitIq : undefined, steps: r && r.ok !== false && stepsOf(r).length ? stepsOf(r) : f.steps });
    }
    return formulaCalc(PFORM[kind], vals);
  }
  /* MOSFET: RDS(on) des Übungsbauteils (Datenblatt, VGS in V, typ oder max), heiß über die Funktion des Bauteils */
  function rdsOf(vgs, spec, tj) {
    const C = CORE(), d = C && C.devices && C.devices.irlz34n; if (!d) return NaN; const tab = spec === 'max' ? d.rdsMax : d.rdsTyp, v = tab && tab[String(vgs)];
    if (!fin(v)) return NaN; if (fin(tj) && tj !== 25 && fin(d.alpha)) { /* heiß: derselbe lineare Ansatz wie der Kern (power.mosfet rechnet mit alpha) */ const pr = C.power && C.power.mosfet ? C.power.mosfet({ i: 1, d: 1, rds25: v, tj, alpha: d.alpha, u: 0, f: 0 }) : null; return pr && fin(pr.rds) ? pr.rds : NaN; } return v;
  }
  /* Wärmekette: Rth_ges, Tj, Tc, Tk, ΔT je Glied, P_zul, Ta,max (steady, pzul, taMax) */
  function chainCalc(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; v = v || {}; const p = pn(v.p), ta = pn(v.ta);
    if (!fin(p) || p < 0) return { ok: false, why: 'Bitte die Verlustleistung als Zahl größer oder gleich 0 eintragen.' }; if (!fin(ta)) return { ok: false, why: 'Bitte die Umgebungstemperatur als Zahl eintragen.' };
    const cfg = cfgOf(v), s = C.steady(cfg, p, ta); if (!s || s.ok === false) return { ok: false, why: (s && s.why) || 'Die Kette lässt sich nicht berechnen.', cfg };
    const ch = C.chain(cfg) || {}, pz = C.pzul(cfg, ta), tam = C.taMax(cfg, p);
    return { ok: true, cfg, s, chain: ch, pzul: fin(pz) ? pz : NaN, taMax: fin(tam) ? tam : NaN, steps: stepsOf(s), notes: Array.isArray(ch.notes) ? ch.notes : [], faults: Array.isArray(s.faults) ? s.faults : (Array.isArray(ch.faults) ? ch.faults : []) };
  }
  /* erforderlicher Kühlkörper: rthKerf mit allen Randfalltexten, chooseHeatsink mit Lüfterwahl, Kontrolle mit dem gewählten (Reserve in K) */
  function kuehlCalc(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; v = v || {}; const p = pn(v.p), ta = pn(v.ta);
    if (!fin(p)) return { ok: false, why: 'Bitte die Verlustleistung als Zahl eintragen.' }; if (!fin(ta)) return { ok: false, why: 'Bitte die Umgebungstemperatur als Zahl eintragen.' };
    const cfg = cfgOf(Object.assign({}, v, { heatsink: 'm', count: 1 })), r = C.rthKerf(cfg, p, ta);
    if (!r) return { ok: false, why: 'Die Berechnung ist fehlgeschlagen.' };
    const out = { ok: r.ok !== false, kind: r.kind, rthKerf: r, value: pick(r, ['value']), why: r.why || '', steps: stepsOf(r), cfg };
    if (out.ok && fin(out.value)) {
      const pkg = C.devices && C.devices[cfg.device] ? C.devices[cfg.device].pkg : undefined, ch = C.chooseHeatsink(out.value, { fan: cfg.fan, orient: cfg.orient, pkg });
      out.choice = ch;
      if (ch && ch.ok !== false && ch.id) { const c2 = Object.assign({}, cfg, { heatsink: ch.id }), s = C.steady(c2, p, ta); out.check = s && s.ok !== false ? { cfg: c2, s, reserve: pick(s, ['margin']), tjMax: s.tjMax } : null; }
    }
    return out;
  }
  /* Wirkungsgrad: Linear- gegen Schaltregler (Übungswert η_sw), Kühlkörper nötig nur nach Vergleich Tj ≤ Tj,max */
  function etaCalc(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; v = v || {}; const ue = pn(v.ue), ua = pn(v.ua), ia = pn(v.ia), eta = pn(v.eta) / 100, ta = pn(v.ta);
    if (![ue, ua, ia, eta, ta].every(fin)) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).' };
    if (!has('power', 'linear') || !has('power', 'switching')) return { ok: false, why: NOFN('power.linear / power.switching') };
    const lin = C.power.linear(ue, ua, ia); if (!lin || lin.ok === false) return { ok: false, why: (lin && lin.why) || 'Die Verlustleistung lässt sich nicht berechnen.' };
    const et = formulaCalc('etaLin', { ue, ua }), pa = ua * ia /* Ausgangsleistung Pa = Ua · Ia (Eingangsgröße für power.switching) */, sw = C.power.switching(pa, eta);
    if (!sw || sw.ok === false) return { ok: false, why: (sw && sw.why) || 'Mit diesem Wirkungsgrad gibt es kein Ergebnis.' };
    const pl = pick(lin, ['p', 'value']), ps = pick(sw, ['p', 'value']), out = { ok: true, pLin: pl, pSw: ps, saved: pl - ps, etaLin: et.ok ? et.value : NaN, pa, steps: stepsOf(lin).concat(stepsOf(sw)), etaSteps: et.steps };
    const dev = v.device === 'lm317' ? 'lm317' : '7805', a = C.steady({ device: dev, heatsink: 'none' }, pl, ta), b = C.steady({ device: '7805', heatsink: 'none', overrides: { rthJA: 50 } }, ps, ta);
    out.kkLin = a && a.ok !== false ? { tj: a.tj, tjMax: a.tjMax, need: a.tj > a.tjMax } : null; out.kkSw = b && b.ok !== false ? { tj: b.tj, tjMax: b.tjMax, need: b.tj > b.tjMax } : null;
    return out;
  }
  /* Zeitverhalten: tau (Rth·Cth), Zeit bis x %, Wärmekapazität m·c, Impuls (Formeln und heatCapacity des Kerns) */
  function capCalc(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!has('heatCapacity')) return { ok: false, why: NOFN('heatCapacity') };
    const m = pn(v.m), mat = v.mat === 'cu' ? 'cu' : 'al'; if (!fin(m) || m <= 0) return { ok: false, why: 'Bitte die Masse in g als Zahl größer 0 eintragen.' };
    const c = C.heatCapacity(m / 1000, mat), mc = C.materials && C.materials[mat]; if (!fin(c)) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, value: c, unit: 'J/K', steps: ['C = m · c = ' + fauto(m / 1000) + ' kg · ' + fauto(mc && mc.c) + ' J/(kg·K) = ' + fauto(c) + ' J/K'] };
  }
  /* Schicht: Rth = d/(λ·A) über rthLayerMM, Beispiel "Warum Paste" aus derselben Funktion */
  function schichtCalc(v) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!has('rthLayerMM')) return { ok: false, why: NOFN('rthLayerMM') };
    const mat = C.materials && C.materials[v.mat], lam = v.mat === 'frei' ? pn(v.lambda) : (mat && mat.lambda), d = pn(v.d), a = pn(v.a);
    if (![lam, d, a].every(fin) || !(lam > 0) || !(d > 0) || !(a > 0)) return { ok: false, why: 'Bitte Dicke, Fläche und Wärmeleitfähigkeit als Zahlen größer 0 eintragen.' };
    const r = C.rthLayerMM(d, lam, a); if (!fin(r)) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, value: r, unit: 'K/W', lambda: lam, steps: ['Rth = d / (λ · A) = ' + fauto(d) + ' mm / (' + fauto(lam) + ' W/(m·K) · ' + fauto(a) + ' cm²) = ' + fauto(r) + ' K/W'] };
  }
  const PASTE_EX = { dLuft: 0.05, dPaste: 0.03 };
  function pasteBeispiel() {
    const C = CORE(); if (!C || !C.packages || !C.materials || !has('rthLayerMM')) return { ok: false, why: C ? NOFN('rthLayerMM') : NOCORE }; const a = (C.packages['TO-220'] || {}).areaCm2;
    const luft = schichtCalc({ mat: 'luft', d: PASTE_EX.dLuft, a }), paste = schichtCalc({ mat: 'paste', d: PASTE_EX.dPaste, a });
    return luft.ok && paste.ok ? { ok: true, a, dLuft: PASTE_EX.dLuft, dPaste: PASTE_EX.dPaste, luft: luft.value, paste: paste.value, ratio: luft.value / paste.value } : { ok: false, why: 'Das Beispiel lässt sich nicht berechnen.' };
  }
  /* Formeln: formulas[…] { inputs:[{key,label,unit,def}], fn, explain(...Werte) → {ok,value,unit,steps} } (positionell nach inputs) */
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!f) return null; if (f.byId && f.byId[id]) return f.byId[id]; if (typeof f.get === 'function') { try { const g = f.get(id); if (g) return g; } catch (e) {} } return Array.isArray(f) ? (f.find(x => x && x.id === id) || null) : null; }
  const formulaList = () => { const C = CORE(); return C && Array.isArray(C.formulas) ? C.formulas.slice() : []; };
  function formulaInputs(f) { return ((f && f.inputs) || []).map(i => ({ key: i.key, label: i.label || i.key, unit: i.unit || '', def: i.def })); }
  function formulaCalc(id, vals) {
    const f = formulaById(id); if (!f || (typeof f.fn !== 'function' && typeof f.explain !== 'function')) return { ok: false, why: CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE };
    const ins = formulaInputs(f), o = {}; vals = vals || {}; ins.forEach(i => { o[i.key] = pn(vals[i.key]); });
    if (ins.some(i => !fin(o[i.key]))) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).', f };
    const pos = ins.map(i => o[i.key]); let r = null;
    if (typeof f.explain === 'function') { try { r = f.explain(...pos); } catch (e) { r = null; } }
    if ((!r || r.ok === false) && typeof f.fn === 'function') { let x = NaN; try { x = f.fn(...pos); } catch (e) { x = NaN; } if (fin(x)) r = { ok: true, value: x, unit: f.unit }; }
    if (r && r.ok === false) return { ok: false, why: r.why || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    const x = pick(r, ['value', 'v', 'result', 'y']); if (!fin(x)) return { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    return { ok: true, f, value: x, unit: (r && r.unit) || f.unit || '', steps: (r && r.steps) || null, inputs: ins.map(i => ({ label: i.label, unit: i.unit, value: o[i.key] })) };
  }
  /* Übungsgenerator (THM_CORE.exercise): alle Arten, Kontrolle über ex.check (mit diagnoseAnswer im Kern) */
  const XKINDS = [['pv', 'Verlustleistung des Linearreglers'], ['pvIq', 'Verlustleistung mit Ruhestrom'], ['rthges', 'Gesamt-Wärmewiderstand'], ['tj', '{sym:Tj} berechnen'], ['tc', '{sym:Tc} berechnen'], ['tk', '{sym:Tk} berechnen'], ['delta', 'Temperaturabfall über ein Glied'], ['pzul', 'zulässige Verlustleistung'],
    ['rthkerf', 'erforderlicher {sym:Rth_K}'], ['tamax', 'höchste Umgebungstemperatur'], ['kuehlerwahl', 'Kühlkörper aus der Tabelle wählen'], ['parallel', 'mehrere Bauteile auf einem Kühlkörper'], ['derating', 'Derating'], ['eta', 'Wirkungsgrad des Linearreglers'], ['pvsw', 'Verlustleistung des Schaltreglers'], ['tau', 'Zeitkonstante'],
    ['tpct', 'Zeit bis x %'], ['mosfet', 'MOSFET-Verlustleistung'], ['diode', 'Diode'], ['widerstand', 'Leistungswiderstand'], ['led', 'Power-LED'], ['endstufe', 'Endstufe'], ['impuls', 'Impulsbetrieb'], ['schicht', 'Wärmewiderstand einer Schicht']];
  function newExercise(kind, seed) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!has('exercise')) return { ok: false, why: NOFN('exercise') };
    let ex; try { ex = C.exercise(kind, seed); } catch (e) { ex = null; } if (!ex || ex.ok === false || typeof ex.check !== 'function') return { ok: false, why: (ex && ex.why) || 'Diese Übung lässt sich nicht erzeugen.' };
    return { ok: true, ex };
  }
  function checkExercise(ex, input) {
    if (!ex || typeof ex.check !== 'function') return { ok: false, text: 'Es gibt noch keine Aufgabe.' };
    let r; try { r = ex.check(input); } catch (e) { r = null; } return r && typeof r === 'object' ? { ok: !!r.ok, text: String(r.text || '') } : { ok: false, text: 'Die Kontrolle ist fehlgeschlagen.' };
  }

  /* ============================================================ Oberfläche */
  const ST = { assist: { mode: 'linear', device: '7805', free: false, tjMax: 125, rthJC: 5, ue: 12, ua: 5, ia: 0.5, iq: false, p: 3.5, ta: 40, heatsink: 'm', joint: 'glimmer', paste: 'duenn', screw: 'fest', fan: 'aus', orient: 'senkrecht', compare: true },
    pwr: { kind: 'linear', vals: {}, vgs: '5', spec: 'typ', tjHot: 100 }, chain: { device: '7805', p: 3.5, ta: 25, count: 1, heatsink: 'm', joint: 'glimmer', paste: 'duenn', screw: 'fest', fan: 'aus', orient: 'senkrecht', blechA: 100 },
    kk: { device: '7805', p: 3.5, ta: 40, joint: 'glimmer', paste: 'duenn', screw: 'fest', fan: 'aus', orient: 'senkrecht' }, eta: { device: '7805', ue: 12, ua: 5, ia: 0.5, eta: 90, ta: 25 },
    zeit: { tau: {}, tpct: {}, pulse: {}, cap: { m: 70, mat: 'al' } }, schicht: { mat: 'luft', d: 0.05, a: 1.5, lambda: 0.5 }, formel: {}, ex: { kind: 'pv', seed: 0, ex: null, input: '', res: null, solved: 0, shown: false } };
  const fld = (key, label, unit, val, extra) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-f="${esc(key)}" inputmode="decimal" autocomplete="off" value="${esc(typeof val === 'number' ? fauto(val) : (val == null ? '' : val))}"${extra || ''}></label>`;
  const sel = (key, label, opts, val) => `<label class="f"><span>${esc(label)}</span><select data-f="${esc(key)}">${opts.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(val) ? ' selected' : ''}>${esc(sx(o.label))}</option>`).join('')}</select></label>`;
  const chk = (key, label, on) => `<label class="chk"><input type="checkbox" data-f="${esc(key)}"${on ? ' checked' : ''}> ${esc(label)}</label>`;
  const montageSel = (st, keys) => (keys || MKEYS).map(k => sel(k, MLAB[k], mountOptions(k), st[k])).join('');
  /* Schritte: Texte oder { n, title, lines:[…], text } (so liefert recipe den Berechnungsgang) */
  const stepsHtml = steps => (steps && steps.length ? `<ol>${steps.map(s => { if (typeof s === 'string') return `<li>${esc(sx(s))}</li>`; const ls = Array.isArray(s && s.lines) ? s.lines : [(s && s.text) || '']; return `<li>${s && s.title ? '<b>' + esc(sx(s.title)) + '</b><br>' : ''}${ls.map(l => esc(sx(l))).join('<br>')}</li>`; }).join('')}</ol>` : '');
  const warnHtml = (w, c) => `<p class="hint2" style="color:${c || 'var(--warn)'};margin:8px 0 0">${esc(sx(w))}</p>`;
  const resHtml = (big, steps, extra) => `<div class="res"><div class="big2">${big}</div>${extra || ''}${stepsHtml(steps)}</div>`;
  const kv = (k, v) => `<div class="kvs"><span>${k}</span><b>${v}</b></div>`;
  const used = () => { if (A && A.S) A.S.calcUsed = true; if (A && typeof A.stat === 'function') A.stat('thmcalc', 1, 'max'); };
  const card = (id, title, body, open) => `<details class="fm" data-card="${id}"${open ? ' open' : ''}><summary>${title}</summary><div class="fmb">${body}</div></details>`;

  /* ---- 1 Prüfungsassistent ---- */
  function assistView() {
    const st = ST.assist, r = assistant(st); let h = '';
    if (!r.ok) return warnHtml(r.why);
    const R = r.result || {}, C = CORE(), hsn = id => { const hs = C && C.heatsinks && C.heatsinks.byId ? C.heatsinks.byId[id] : null; return hs ? hs.name : id; }, tjc = R.verdict === 'heiss' ? 'var(--bad-fg)' : R.verdict === 'ok' ? 'var(--ok)' : 'inherit';
    const rows = [[esc(sy('P')), fin(pick(R, ['p'])) ? fauto(R.p) + ' W' : ''], [esc(sy('Rth_ges')), fin(R.rthTotal) ? fauto(R.rthTotal) + ' K/W' : ''], [esc(sy('Tj')), fin(R.tj) ? '<span style="color:' + tjc + '">' + fauto(R.tj) + ' °C</span>' + (R.verdict === 'heiss' ? ' (zu heiß)' : R.verdict === 'ok' ? ' (in Ordnung)' : '') : ''], [esc(sy('Tc')), fin(R.tc) ? fauto(R.tc) + ' °C' : ''], [esc(sy('Tk')), fin(R.tk) ? fauto(R.tk) + ' °C' : ''],
      [esc(sy('Rth_Kerf')), fin(R.rthKerf) ? fauto(R.rthKerf) + ' K/W' : ''], ['gewählter Kühlkörper', R.heatsink ? esc(hsn(R.heatsink)) + (fin(R.rthKeff) ? ' (' + fauto(R.rthKeff) + ' K/W)' : '') : ''], [esc(sy('Tj')) + ' mit diesem Kühlkörper', fin(R.tjCheck) ? fauto(R.tjCheck) + ' °C' : ''], ['Reserve zu ' + esc(sy('Tjmax')), fin(R.reserveCheck) ? fauto(R.reserveCheck) + ' K' : '']].filter(x => x[1]);
    h = `<div class="res">${rows.map(x => kv(x[0], x[1])).join('')}${stepsHtml(r.steps)}</div>` + (r.warn || []).map(w => warnHtml(w)).join('');
    return h;
  }
  function assistBody() {
    const st = ST.assist, devs = deviceList();
    return `<p class="hint2" style="margin:0 0 8px">Der Berechnungsgang der Prüfung in sieben Schritten: Verlustleistung, Ersatzschaltbild, ${esc(sy('Rth_ges'))}, ${esc(sy('Tj'))} mit Vergleich, ${esc(sy('Rth_Kerf'))}, Kühlkörper wählen und Kontrolle. Jeder Schritt zeigt die eingesetzten Zahlen.</p>
      <div class="frm">${sel('device', 'Bauteil', devs, st.device)}${sel('mode', 'Betriebspunkt', [{ value: 'linear', label: 'Linearregler (Ue, Ua, Ia)' }, { value: 'p', label: 'Verlustleistung direkt' }], st.mode)}</div>
      <div class="frm">${st.mode === 'linear' ? fld('ue', 'Eingangsspannung Ue', 'V', st.ue) + fld('ua', 'Ausgangsspannung Ua', 'V', st.ua) + fld('ia', 'Ausgangsstrom Ia', 'A', st.ia) + chk('iq', 'Ruhestrom Iq des Bauteils' + (fin(iqOf(st.device)) ? ' (' + fauto(iqOf(st.device) * 1000) + ' mA)' : '') + ' berücksichtigen', st.iq) : fld('p', 'Verlustleistung P', 'W', st.p)}${fld('ta', 'Umgebungstemperatur', '°C', st.ta)}</div>
      ${chk('free', 'Freie Werte statt Datenblatt (Tj,max und Rth_JC selbst eintragen)', st.free)}${st.free ? `<div class="frm">${fld('tjMax', 'Tj,max', '°C', st.tjMax)}${fld('rthJC', 'Rth_JC', 'K/W', st.rthJC)}</div>` : ''}
      <div class="frm">${montageSel(st)}</div>${chk('compare', 'Mit Tj,max vergleichen (zu heiß oder in Ordnung)', st.compare)}
      <div data-res="assist">${assistView()}</div>
      <div class="btns"><button class="btn pri" data-act="assist-try">▶ Im Prüfstand ausprobieren</button></div>`;
  }
  /* Aufbau und Betriebspunkt in den Prüfstand laden (Linearregler direkt, sonst Vergleich mit P) */
  function tryAssist() {
    const st = ST.assist, r = assistant(st); if (!r.ok) { A.toast('Der Berechnungsgang liefert noch kein Ergebnis: ' + r.why); return; } used();
    const ta = pn(st.ta), common = { heatsink: st.heatsink, joint: st.joint, paste: st.paste, screw: st.screw, fan: st.fan, orient: st.orient, ta, bushing: true };
    if (st.mode === 'linear' && (st.device === '7805' || st.device === 'lm317')) A.loadRig({ rig: 'linear', name: 'Aus dem Prüfungsassistenten', controls: Object.assign({ device: st.device, loadMode: 'strom', ue: pn(st.ue), ua: pn(st.ua), iLoad: pn(st.ia), iq: !!st.iq }, common), settle: true, confirm: true });
    else if (['7805', 'lm317', 'bd139', 'irlz34n'].includes(st.device)) A.loadRig({ rig: 'vergleich', name: 'Aus dem Prüfungsassistenten', controls: Object.assign({ device: st.device, pv: r.p, ta }, Object.keys(common).reduce((o, k) => { o[k + '_a'] = common[k]; return o; }, {}), { ta }), settle: true, confirm: true });
    else A.toast('Für dieses Bauteil gibt es keinen Prüfstand mit direkter Eingabe der Verlustleistung. Wähle im Tab „Prüfstand“ die passende Anlage.');
  }

  /* ---- 2 Verlustleistung ---- */
  function pwrBody() {
    const st = ST.pwr, ins = powerInputs(st.kind), v = st.vals[st.kind] || (st.vals[st.kind] = {}); let extra = '';
    if (st.kind === 'mosfet') {
      const cold = rdsOf(st.vgs, st.spec, 25), hot = rdsOf(st.vgs, st.spec, pn(st.tjHot));
      extra = `<div class="frm">${sel('vgs', 'Gate-Spannung VGS', [{ value: '4.5', label: '4,5 V' }, { value: '5', label: '5 V' }, { value: '10', label: '10 V' }], st.vgs)}${sel('spec', 'RDS(on) laut Datenblatt', [{ value: 'typ', label: 'typisch' }, { value: 'max', label: 'maximal' }], st.spec)}${fld('tjHot', 'Sperrschichttemperatur für heiß', '°C', st.tjHot)}</div>
        <div class="chips" style="padding:0 0 6px"><button class="chip s" data-act="rds" data-w="cold">RDS(on) kalt: ${fnum(cold * 1000, 1)} mΩ einsetzen</button><button class="chip s" data-act="rds" data-w="hot">RDS(on) heiß bei ${fauto(pn(st.tjHot))} °C: ${fnum(hot * 1000, 1)} mΩ einsetzen</button></div><p class="hint2" style="margin:0 0 6px">Die Datenblattwerte stammen vom Übungsbauteil IRLZ34N, der Wert für heiß aus derselben Rechnung wie im Prüfstand.</p>`;
    }
    return `<div class="frm">${sel('kind', 'Bauteil oder Schaltung', PWR.map(k => ({ value: k, label: PNAME[k] })), st.kind)}</div>${extra}<div class="frm">${ins.map(i => fld('v:' + i.key, i.label, i.unit, v[i.key] != null ? v[i.key] : i.def)).join('')}</div><div data-res="pwr">${pwrView()}</div>`;
  }
  function pwrView() {
    const st = ST.pwr, ins = powerInputs(st.kind), v = Object.assign({}, st.vals[st.kind] || {}); ins.forEach(i => { if (v[i.key] == null) v[i.key] = i.def; });
    const r = powerCalc(st.kind, v); if (!r.ok) return warnHtml(r.why);
    const extra = st.kind === 'linear' && fin(r.pOhneIq) ? kv('ohne Ruhestrom (Prüfungsnäherung)', fauto(r.pOhneIq) + ' W') + kv('mit Ruhestrom Iq', fauto(r.pMitIq) + ' W') : '';
    return resHtml(fauto(r.value) + ' ' + esc(r.unit || 'W'), r.steps, extra) + (st.kind === 'mosfet' ? '' : '');
  }

  /* ---- 3 Wärmekette ---- */
  function chainBody() {
    const st = ST.chain; return `<div class="frm">${sel('device', 'Bauteil', deviceList(), st.device)}${fld('p', 'Verlustleistung P', 'W', st.p)}${fld('ta', 'Umgebungstemperatur', '°C', st.ta)}${sel('count', 'Gleiche Bauteile auf dem Kühlkörper', [{ value: 1, label: '1' }, { value: 2, label: '2' }, { value: 4, label: '4' }], st.count)}</div><div class="frm">${montageSel(st)}${st.heatsink === 'blech' ? fld('blechA', 'Blechfläche', 'cm²', st.blechA) : ''}</div><div data-res="chain">${chainView()}</div>`;
  }
  function chainView() {
    const r = chainCalc(ST.chain); if (!r.ok) return warnHtml(r.why); const s = r.s, T = sy;
    const tj = s.tj > s.tjMax;
    return `<div class="res"><div class="rl" style="margin:0"><table class="kt"><tr><th>Glied</th><th class="n">${esc('R in K/W')}</th><th class="n">ΔT in K</th></tr>
      <tr><td>${esc(T('Rth_JC'))}</td><td class="n">${fauto(s.rthJC)}</td><td class="n">${fauto(s.dJC)}</td></tr><tr><td>${esc(T('Rth_CK'))}</td><td class="n">${fauto(s.rthCK)}</td><td class="n">${fauto(s.dCK)}</td></tr><tr><td>${esc(T('Rth_K'))}</td><td class="n">${fauto(s.rthK)}</td><td class="n">${fauto(s.dK)}</td></tr><tr><td><b>${esc(T('Rth_ges'))}</b></td><td class="n"><b>${fauto(s.rthTotal)}</b></td><td class="n"><b>${fauto(s.sum)}</b></td></tr></table></div>
      ${kv(esc(T('Tj')), '<span style="color:' + (tj ? 'var(--bad-fg)' : 'var(--ok)') + '">' + fauto(s.tj) + ' °C</span> (' + esc(T('Tjmax')) + ' = ' + fauto(s.tjMax) + ' °C' + (tj ? ', zu heiß' : ', Reserve ' + fauto(s.tjMax - s.tj) + ' K') + ')')}${kv(esc(T('Tc')), fauto(s.tc) + ' °C')}${kv(esc(T('Tk')), fauto(s.tk) + ' °C')}${kv('zulässige Verlustleistung ' + esc(T('Pzul')), fin(r.pzul) ? fauto(r.pzul) + ' W' : '–')}${kv('höchste Umgebungstemperatur ' + esc(T('Ta')) + ',max', fin(r.taMax) ? fauto(r.taMax) + ' °C' : '–')}${stepsHtml(r.steps)}</div>` + r.notes.map(n => warnHtml(n)).join('');
  }

  /* ---- 4 erforderlicher Kühlkörper ---- */
  function kkBody() {
    const st = ST.kk; return `<div class="frm">${sel('device', 'Bauteil', deviceList(), st.device)}${fld('p', 'Verlustleistung P', 'W', st.p)}${fld('ta', 'Umgebungstemperatur', '°C', st.ta)}</div><div class="frm">${montageSel(st, ['joint', 'paste', 'screw', 'fan', 'orient'])}</div><div data-res="kk">${kkView()}</div><div class="btns"><button class="btn" data-act="kk-try">▶ Im Prüfstand ausprobieren</button></div>`;
  }
  function kkView() {
    const r = kuehlCalc(ST.kk), T = sy; let h = '';
    if (r.steps && r.steps.length) h += resHtml(fin(r.value) ? esc(T('Rth_Kerf')) + ' = ' + fauto(r.value) + ' K/W' : '–', r.steps);
    if (r.why) h += warnHtml(r.why, r.ok ? 'var(--warn)' : 'var(--bad-fg)');
    if (r.choice) {
      if (r.choice.ok !== false && r.choice.id) { const c = r.choice, hs = c.heatsink || {}; h += `<div class="res">${kv('gewählter Kühlkörper', esc(hs.name || c.id))}${kv(esc(T('Rth_K')) + ',eff', fauto(pick(c, ['rthKeff', 'rthK'])) + ' K/W')}${r.check ? kv(esc(T('Tj')) + ' mit diesem Kühlkörper', fauto(r.check.s.tj) + ' °C') + kv('Reserve zu ' + esc(T('Tjmax')), '<span style="color:' + (r.check.reserve < 0 ? 'var(--bad-fg)' : 'var(--ok)') + '">' + fauto(r.check.reserve) + ' K</span>') : ''}</div>`; }
      else h += warnHtml(r.choice.why || 'Kein Kühlkörper aus der Tabelle reicht.', 'var(--bad-fg)');
    }
    return h || warnHtml('Keine Berechnung möglich.');
  }

  /* ---- 5 Wirkungsgrad ---- */
  function etaBody() {
    const st = ST.eta; return `<div class="frm">${sel('device', 'Linearregler', deviceList().filter(d => d.value === '7805' || d.value === 'lm317'), st.device)}${fld('ue', 'Eingangsspannung Ue', 'V', st.ue)}${fld('ua', 'Ausgangsspannung Ua', 'V', st.ua)}${fld('ia', 'Ausgangsstrom Ia', 'A', st.ia)}${fld('eta', 'Wirkungsgrad Schaltregler (Übungsannahme)', '%', st.eta)}${fld('ta', 'Umgebungstemperatur', '°C', st.ta)}</div><div data-res="eta">${etaView()}</div>`;
  }
  function etaView() {
    const r = etaCalc(ST.eta); if (!r.ok) return warnHtml(r.why); const T = sy, yn = x => (!x ? '–' : x.need ? `<span style="color:var(--bad-fg)">ja: ${esc(T('Tj'))} = ${fauto(x.tj)} °C ist größer als ${fauto(x.tjMax)} °C</span>` : `<span style="color:var(--ok)">nein: ${esc(T('Tj'))} = ${fauto(x.tj)} °C bleibt unter ${fauto(x.tjMax)} °C</span>`);
    return `<div class="res">${kv('Wirkungsgrad Linearregler η', fin(r.etaLin) ? fauto(100 * r.etaLin) + ' %' : '–')}${kv('Verlustleistung Linearregler', fauto(r.pLin) + ' W')}${kv('Verlustleistung Schaltregler', fauto(r.pSw) + ' W')}${kv('eingesparte Verlustleistung', '<span style="color:var(--ok)">' + fauto(r.saved) + ' W</span>')}
      ${kv('Kühlkörper beim Linearregler nötig? (frei montiert)', yn(r.kkLin))}${kv('Kühlkörper beim Schaltregler nötig? (Chip frei, Übungsannahme)', yn(r.kkSw))}${stepsHtml(r.steps)}${stepsHtml(r.etaSteps)}</div>`;
  }

  /* ---- 6 Zeitverhalten ---- */
  function fform(group, id, title) {
    const f = formulaById(id); if (!f) return `<div class="ex"><b>${esc(title)}</b>${warnHtml(CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE)}</div>`;
    const ins = formulaInputs(f), v = ST.zeit[group] || (ST.zeit[group] = {});
    return `<div class="ex" data-fg="${group}" data-fid="${id}"><b>${esc(title)}</b><div class="hint2" style="margin:2px 0 6px">${esc(CORE().tpl ? CORE().tpl(f.expr) : f.expr)}</div><div class="frm">${ins.map(i => fld('z:' + group + ':' + i.key, i.label, i.unit, v[i.key] != null ? v[i.key] : i.def)).join('')}</div><div data-res="z-${group}">${fview(group, id)}</div></div>`;
  }
  function fview(group, id) {
    const f = formulaById(id); if (!f) return ''; const v = Object.assign({}, ST.zeit[group] || {}); formulaInputs(f).forEach(i => { if (v[i.key] == null) v[i.key] = i.def; });
    const r = formulaCalc(id, v); if (!r.ok) return warnHtml(r.why);
    const min = r.unit === 's' ? ' = ' + fauto(r.value / 60) + ' min' : '';
    return resHtml(fauto(r.value) + ' ' + esc(r.unit || '') + min, r.steps);
  }
  function zeitBody() {
    const c = ST.zeit.cap, cr = capCalc(c);
    return fform('tau', 'tau', 'Zeitkonstante') + fform('tpct', 'tPct', 'Zeit bis x % des Endwerts') +
      `<div class="ex"><b>Wärmekapazität eines Kühlkörpers</b><div class="frm">${fld('c:m', 'Masse m', 'g', c.m)}${sel('c:mat', 'Material', [{ value: 'al', label: 'Aluminium' }, { value: 'cu', label: 'Kupfer' }], c.mat)}</div><div data-res="z-cap">${cr.ok ? resHtml(fauto(cr.value) + ' J/K', cr.steps) : warnHtml(cr.why)}</div></div>` + fform('pulse', 'pulse', 'Impulsbetrieb: Spitzentemperatur');
  }

  /* ---- 7 Schicht ---- */
  function schichtBody() {
    const st = ST.schicht, C = CORE(), mats = C && C.materials ? ['luft', 'paste', 'glimmer', 'silikon', 'al', 'cu'].filter(k => C.materials[k]).map(k => ({ value: k, label: C.materials[k].name || k })) : [];
    const ex = pasteBeispiel();
    return `<p class="hint2" style="margin:0 0 8px">Der Wärmewiderstand einer ebenen Schicht: Je dünner die Schicht und je besser das Material leitet, desto kleiner ist er.</p><div class="frm">${sel('mat', 'Material', mats.concat([{ value: 'frei', label: 'freie Wärmeleitfähigkeit' }]), st.mat)}${st.mat === 'frei' ? fld('lambda', 'Wärmeleitfähigkeit λ', 'W/(m·K)', st.lambda) : ''}${fld('d', 'Dicke d', 'mm', st.d)}${fld('a', 'Fläche A', 'cm²', st.a)}</div><div data-res="schicht">${schichtView()}</div>
      <div class="ex"><b>Warum Wärmeleitpaste?</b><div data-res="paste">${ex.ok ? `<p style="margin:4px 0">Auf einer Kontaktfläche von ${fauto(ex.a)} cm² (TO-220): Ein Luftspalt von ${fauto(ex.dLuft)} mm hat ${fauto(ex.luft)} K/W, eine Paste von ${fauto(ex.dPaste)} mm hat ${fauto(ex.paste)} K/W. Die Luft isoliert ${fauto(ex.ratio)} mal so stark (Beispielwerte für die Dicken, Größenordnung).</p>` : warnHtml(ex.why)}</div></div>`;
  }
  function schichtView() { const r = schichtCalc(ST.schicht); return r.ok ? resHtml(fauto(r.value) + ' K/W', r.steps, kv('Wärmeleitfähigkeit λ', fauto(r.lambda) + ' W/(m·K)')) : warnHtml(r.why); }

  /* ---- 8 Formelsammlung (alle Formeln des Kerns) ---- */
  function formelBody() {
    const list = formulaList(); if (!list.length) return warnHtml(CORE() ? 'Der Kern hat keine Formelliste.' : NOCORE);
    return `<p class="hint2" style="margin:0 0 8px">Alle Formeln des Labs aus einer Tabelle: Tippe eine Formel an, setze Zahlen ein und sieh den Rechenweg.</p>` + list.map(f => `<details class="fm" data-formula="${esc(f.id)}"><summary>${esc(sx(f.name))}<span class="hint2" style="margin-left:auto;padding-left:8px">${esc(f.unit || '')}</span></summary><div class="fmb"><div class="hint2" style="margin:0 0 6px">${esc(CORE().tpl ? CORE().tpl(f.expr) : f.expr)}</div><div class="frm">${formulaInputs(f).map(i => fld('f:' + f.id + ':' + i.key, i.label, i.unit, (ST.formel[f.id] || {})[i.key] != null ? ST.formel[f.id][i.key] : i.def)).join('')}</div><div data-res="f-${esc(f.id)}"></div></div></details>`).join('');
  }
  function formelView(id) {
    const f = formulaById(id); if (!f) return ''; const v = Object.assign({}, ST.formel[id] || {}); formulaInputs(f).forEach(i => { if (v[i.key] == null) v[i.key] = i.def; });
    const r = formulaCalc(id, v); return r.ok ? resHtml(fauto(r.value) + ' ' + esc(r.unit || ''), r.steps) : warnHtml(r.why);
  }

  /* ---- 9 Übungsgenerator ---- */
  function exBody() {
    const x = ST.ex;
    return `<p class="hint2" style="margin:0 0 8px">Rechne die Aufgabe im Kopf oder auf Papier und gib dein Ergebnis ein. Die Kontrolle sagt dir, ob es stimmt, und erkennt typische Fehler.</p><div class="frm">${sel('xkind', 'Art der Aufgabe', XKINDS.map(k => ({ value: k[0], label: k[1] })), x.kind)}</div><div class="btns"><button class="btn pri" data-act="ex-new">Neue Aufgabe</button></div><div data-res="ex">${exView()}</div>`;
  }
  function exView() {
    const x = ST.ex; if (!x.ex) return '<p class="hint2">Tippe auf „Neue Aufgabe“.</p>'; const e = x.ex, ch = Array.isArray(e.choices) ? e.choices : null;
    return `<div class="res"><p style="margin:0 0 8px">${esc(sx(e.question || ''))}</p>${e.table ? A.tableHtml(e.table) : ''}${ch ? `<fieldset class="choice"><legend>Deine Wahl</legend>${ch.map((o, i) => `<label class="opt"><input type="radio" name="exch" data-exch="${esc(typeof o === 'object' ? o.value : o)}"${String(x.input) === String(typeof o === 'object' ? o.value : o) ? ' checked' : ''}> ${esc(sx(typeof o === 'object' ? o.label : o))}</label>`).join('')}</fieldset>` : `<label class="f"><span>Dein Ergebnis${e.answer && e.answer.unit ? ' in ' + esc(e.answer.unit) : ''}</span><input data-f="exin" inputmode="decimal" autocomplete="off" value="${esc(x.input)}"></label>`}
      <div class="btns"><button class="btn pri" data-act="ex-check">✓ Prüfen</button><button class="btn" data-act="ex-solve">Lösungsweg zeigen</button></div>
      ${x.res ? `<div class="ex ${x.res.ok ? 'ok' : 'bad'}">${esc(sx(x.res.text))}</div>` : ''}${x.shown ? `<div class="ex"><b>Lösungsweg</b>${stepsHtml(e.steps)}</div>` : ''}<p class="hint2" style="margin:6px 0 0">Richtig gelöst: ${x.solved}</p></div>`;
  }

  function renderAll() {
    return `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für die Wärmekette</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, gleiche Tabellen, Zahlen mit Komma und Rechenweg.</p></div>` +
      card('assist', '🧮 Prüfungsassistent: der Berechnungsgang in sieben Schritten', assistBody(), true) + card('pwr', '⚡ Verlustleistung', pwrBody()) + card('chain', '🔗 Wärmekette: Temperaturen und Grenzen', chainBody()) + card('kk', '📏 Erforderlicher Kühlkörper', kkBody()) + card('eta', '🔋 Wirkungsgrad: Linearregler gegen Schaltregler', etaBody()) +
      card('zeit', '⏱️ Zeitverhalten', zeitBody()) + card('schicht', '🧱 Wärmewiderstand einer Schicht (Vertiefung)', schichtBody()) + card('formel', '📐 Formelsammlung', formelBody()) + card('ex', '🎯 Übungsgenerator', exBody());
  }
  function setRes(host, name, html) { const el = host.querySelector('[data-res="' + name + '"]'); if (el) el.innerHTML = html; }
  const coerceVal = (el) => (el.type === 'checkbox' ? el.checked : el.value);
  function onInput(host, e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-f]') : null; if (!el) return; const k = el.dataset.f, card0 = el.closest('[data-card]'), cid = card0 && card0.dataset.card, val = coerceVal(el); used();
    const redo = (id, body) => { const open = card0.querySelector('.fmb'); open.innerHTML = body(); };
    if (cid === 'assist') { ST.assist[k] = val; if (k === 'mode' || k === 'free') redo('assist', assistBody); else setRes(host, 'assist', assistView()); }
    else if (cid === 'pwr') {
      if (k === 'kind') { ST.pwr.kind = val; redo('pwr', pwrBody); }
      else if (k === 'vgs' || k === 'spec' || k === 'tjHot') { ST.pwr[k] = val; redo('pwr', pwrBody); }
      else if (k.indexOf('v:') === 0) { (ST.pwr.vals[ST.pwr.kind] = ST.pwr.vals[ST.pwr.kind] || {})[k.slice(2)] = val; setRes(host, 'pwr', pwrView()); }
    } else if (cid === 'chain') { ST.chain[k] = val; if (k === 'heatsink') redo('chain', chainBody); else setRes(host, 'chain', chainView()); }
    else if (cid === 'kk') { ST.kk[k] = val; setRes(host, 'kk', kkView()); }
    else if (cid === 'eta') { ST.eta[k] = val; setRes(host, 'eta', etaView()); }
    else if (cid === 'zeit') {
      const p = k.split(':'); if (p[0] === 'z') { (ST.zeit[p[1]] = ST.zeit[p[1]] || {})[p[2]] = val; const g = el.closest('[data-fg]'); setRes(g, 'z-' + p[1], fview(p[1], g.dataset.fid)); if (A && (p[1] === 'tau' || p[1] === 'tpct')) A.stat('thmzeit', 1, 'max'); }
      else if (p[0] === 'c') { ST.zeit.cap[p[1]] = val; const cr = capCalc(ST.zeit.cap); setRes(host, 'z-cap', cr.ok ? resHtml(fauto(cr.value) + ' J/K', cr.steps) : warnHtml(cr.why)); }
    } else if (cid === 'schicht') { ST.schicht[k] = val; if (k === 'mat') redo('schicht', schichtBody); else setRes(host, 'schicht', schichtView()); }
    else if (cid === 'ex') { if (k === 'xkind') { ST.ex.kind = val; ST.ex.ex = null; ST.ex.res = null; ST.ex.shown = false; setRes(host, 'ex', exView()); } else if (k === 'exin') ST.ex.input = val; }
    else { const fd = el.closest('[data-formula]'); if (fd && k.indexOf('f:') === 0) { const p = k.split(':'); (ST.formel[p[1]] = ST.formel[p[1]] || {})[p[2]] = val; setRes(fd, 'f-' + p[1], formelView(p[1])); } }
  }
  function onClick(host, e) {
    const ch = e.target && e.target.closest ? e.target.closest('[data-exch]') : null; if (ch) { ST.ex.input = ch.dataset.exch; return; }
    const b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b) { const fd = e.target && e.target.closest ? e.target.closest('details[data-formula]') : null; if (fd && !fd.dataset.done) { fd.dataset.done = '1'; setRes(fd, 'f-' + fd.dataset.formula, formelView(fd.dataset.formula)); } return; }
    const a = b.dataset.act;
    if (a === 'assist-try') tryAssist();
    else if (a === 'kk-try') { used(); const r = kuehlCalc(ST.kk), st = ST.kk; if (r.choice && r.choice.ok !== false && r.check && (st.device === '7805' || st.device === 'lm317')) A.loadRig({ rig: 'linear', name: 'Aus dem Kühlkörper-Rechner', controls: { device: st.device, loadMode: 'strom', ue: 12, ua: 5, iLoad: pn(st.p) / 7, heatsink: r.choice.id, joint: st.joint, paste: st.paste, screw: st.screw, fan: st.fan, orient: st.orient, ta: pn(st.ta), iq: false }, settle: true, confirm: true, toast: 'Geladen: Linearregler mit dem gewählten Kühlkörper und der Verlustleistung aus dem Rechner' });
      else if (r.choice && r.choice.ok !== false && r.choice.id) A.loadRig({ rig: 'vergleich', name: 'Aus dem Kühlkörper-Rechner', controls: { device: ['7805', 'lm317', 'bd139', 'irlz34n'].includes(st.device) ? st.device : '7805', pv: pn(st.p), ta: pn(st.ta), heatsink_a: r.choice.id, joint_a: st.joint, paste_a: st.paste, fan_a: st.fan, orient_a: st.orient, screw_a: st.screw }, settle: true, confirm: true }); else A.toast('Es gibt noch keinen gewählten Kühlkörper zum Ausprobieren.'); }
    else if (a === 'rds') { const v = rdsOf(ST.pwr.vgs, ST.pwr.spec, b.dataset.w === 'hot' ? pn(ST.pwr.tjHot) : 25); if (fin(v)) { (ST.pwr.vals.mosfet = ST.pwr.vals.mosfet || {}).rds = v; const inp = host.querySelector('[data-f="v:rds"]'); if (inp) inp.value = fauto(v); setRes(host, 'pwr', pwrView()); } }
    else if (a === 'ex-new') { used(); const x = ST.ex; x.seed = (x.seed || (A && A.lsGet ? A.lsGet('thm.calcseed', 0) : 0)) + 1; if (A && A.lsSet) A.lsSet('thm.calcseed', x.seed); const r = newExercise(x.kind, x.seed); x.input = ''; x.res = null; x.shown = false; if (r.ok) x.ex = r.ex; else { x.ex = null; setRes(host, 'ex', warnHtml(r.why)); return; } setRes(host, 'ex', exView()); }
    else if (a === 'ex-check') { const x = ST.ex; if (!x.ex) return; const inp = host.querySelector('[data-f="exin"]'); if (inp) x.input = inp.value; x.res = checkExercise(x.ex, x.input); if (x.res.ok) { x.solved++; if (A) A.stat('thmcalc', x.solved, 'max'); } setRes(host, 'ex', exView()); }
    else if (a === 'ex-solve') { ST.ex.shown = true; setRes(host, 'ex', exView()); }
  }
  function render(host, api) {
    A = api; if (api && !api.tableHtml) { /* Tabellen im Aufgabentext rendert die Seite, hier nur ein einfacher Rückfall */ api.tableHtml = t => (t ? '<div class="thm-tbl"><table><tbody>' + ((t.rows || t) || []).map(r => '<tr>' + [].concat(r).map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' : ''); }
    host.innerHTML = renderAll();
    if (!host._thmCalc) { host._thmCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }
  const api0 = { render, fn: { cfgOf, assistant, powerInputs, powerCalc, rdsOf, chainCalc, kuehlCalc, etaCalc, capCalc, schichtCalc, pasteBeispiel, formulaById, formulaList, formulaInputs, formulaCalc, newExercise, checkExercise, XKINDS, PWR, deviceList, mountOptions, MKEYS, PASTE_EX }, ST };
  root.THM_UI_EXT = root.THM_UI_EXT || {}; root.THM_UI_EXT.calc = api0;
  if (typeof module !== 'undefined') module.exports = api0;
})(typeof window !== 'undefined' ? window : globalThis);
