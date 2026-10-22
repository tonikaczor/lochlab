'use strict';
/* Tonfunk Energie-Lab: Tab "Rechnen" (WP4b).
   Acht Karten (SPEC 6.5): (1) Leistung, Energie, Wirkungsgrad; (2) Modul bei Bedingungen; (3) Verschaltung; (4) Akku; (5) Leitung; (6) Ertrag und Amortisation;
   (7) Wechselrichter; (8) Sonne; dazu der Übungsgenerator (calc.exercise, Kontrolle mit check, Zähler enrcalc).
   ALLE Rechnungen laufen über ENR_CORE (calc.formulas.explain, pv.keys, pv.tempCoeff, pv.cellTemp, batt.cycleLife/lifeYears, inv.eta/euroEta/loss, sun.*, calc.exercise);
   hier steht keine zweite Formelimplementierung (SPEC Regel 7). Fehlt eine Kernfunktion, erscheint ein Hinweis statt Zahlen.
   Schnittstelle (SPEC 6.7): window.ENR_UI_EXT.calc.render(host, api), api = { S, rig, setTab, loadExample, startTask, toast, esc, stat, lsGet, lsSet, loadDesign, ENR_CORE, ENR_CHART }.
   Die Rechenfunktionen (ohne DOM) hängen unter ENR_UI_EXT.calc.fn und werden von test_enrui_ext.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.ENR_CORE;
  const fnum = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 1 : d).replace('.', ',') : '–');
  const adig = v => { v = Math.abs(v); if (v === 0) return 0; return v >= 100 ? 0 : v >= 10 ? 1 : v >= 1 ? 2 : v >= 0.1 ? 3 : 4; };
  const fa = v => (fin(v) ? (Number.isInteger(v) ? String(v) : fnum(v, adig(v))) : '–');
  const pn = s => {
    if (typeof s === 'number') return fin(s) ? s : NaN; const t = String(s == null ? '' : s), C = CORE();
    if (C && typeof C.parseNum === 'function') { const v = C.parseNum(t); return fin(v) ? v : NaN; }
    const v = parseFloat(t.replace(/\s/g, '').replace(',', '.')); return fin(v) ? v : NaN;
  };
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const NOCORE = 'Der Rechenkern ist nicht geladen (enrcore.js fehlt). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (enrcore.js, enrsys.js oder enrcalc.js ist nicht vollständig geladen). Dieser Rechner liefert deshalb noch keine Zahlen.';
  const has = (...path) => { let o = CORE(); for (const k of path) { if (!o) return false; o = o[k]; } return typeof o === 'function'; };
  let A = null; /* api der Seite (nur für Oberfläche, nie für Rechnung) */

  /* ============================================================ reine Rechenfunktionen (alle rufen ENR_CORE) */
  const stepsOf = r => (r && Array.isArray(r.steps) ? r.steps : []);
  function formulaById(id) { const C = CORE(), f = C && C.calc && C.calc.formulas; if (!f) return null; try { return typeof f.get === 'function' ? f.get(id) || f[id] || null : f[id] || null; } catch (e) { return null; } }
  function formulaList() { const C = CORE(), f = C && C.calc && C.calc.formulas; if (!f) return []; try { return typeof f.list === 'function' ? f.list() : Object.keys(f).map(k => f[k]); } catch (e) { return []; } }
  const formulaInputs = f => ((f && f.inputs) || []).map(i => ({ key: i.key, label: i.label || i.key, unit: i.unit || '', def: i.def }));
  /* Formel rechnen: Werte positionell nach inputs, Ergebnis aus explain (Anzeige "shown" kommt vom Kern) */
  function formulaCalc(id, vals) {
    const f = formulaById(id); if (!f || (typeof f.explain !== 'function' && typeof f.fn !== 'function')) return { ok: false, why: CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE };
    const ins = formulaInputs(f), o = {}; vals = vals || {}; ins.forEach(i => { o[i.key] = pn(vals[i.key] != null ? vals[i.key] : i.def); });
    if (ins.some(i => !fin(o[i.key]))) return { ok: false, why: 'Bitte in alle Felder Zahlen eintragen (Komma oder Punkt).', f };
    const pos = ins.map(i => o[i.key]); let r = null;
    if (typeof f.explain === 'function') { try { r = f.explain(...pos); } catch (e) { r = null; } }
    if ((!r || r.ok === undefined) && typeof f.fn === 'function') { let x = NaN; try { x = f.fn(...pos); } catch (e) { x = NaN; } if (fin(x)) r = { ok: true, value: x, unit: f.unit }; }
    if (!r || r.ok === false) return { ok: false, why: (r && r.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    if (!fin(r.value)) return { ok: false, why: r.why || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0).', f };
    return { ok: true, f, value: r.value, unit: r.unit != null ? r.unit : (f.unit || ''), shown: r.shown || (fa(r.value) + (f.unit ? ' ' + f.unit : '')), steps: stepsOf(r), note: r.note || '', extra: r.extra || null, values: o };
  }
  /* Modultabelle (Auswahl) aus dem Kern */
  const SPEC_ORDER = ['si60', 'si36', 'si72', 'zelle'];
  function specList() { const C = CORE(); if (!C || !C.pv || !C.pv.presets) return []; return SPEC_ORDER.filter(id => C.pv.presets[id]).map(id => ({ value: id, label: (C.pv.presets[id].name || id) })); }
  /* (2) Modul bei Bedingungen: Kennwerte aus pv.keys; Zelltemperatur aus Umgebung nach NOCT (pv.cellTemp); Faustformel pTemp nur zum Vergleich bei 1000 W/m² */
  function modulCalc(v) {
    const C = CORE(); if (!C || !C.pv) return { ok: false, why: NOCORE }; if (!has('pv', 'keys') || !has('pv', 'tempCoeff')) return { ok: false, why: NOFN('pv.keys / pv.tempCoeff') };
    v = v || {}; const id = v.spec || 'si60', sp = C.pv.spec(id); if (!sp || sp.ok === false) return { ok: false, why: (sp && sp.why) || 'Dieses Modul gibt es nicht.' };
    const G = pn(v.G); if (!fin(G) || G < 0) return { ok: false, why: 'Bitte die Einstrahlung als Zahl größer oder gleich 0 eintragen.' };
    let Tc = NaN, taSteps = null;
    if (v.mode === 'ta') { const Ta = pn(v.Ta); if (!fin(Ta)) return { ok: false, why: 'Bitte die Umgebungstemperatur als Zahl eintragen.' }; Tc = has('pv', 'cellTemp') ? C.pv.cellTemp(Ta, G, sp.NOCT) : NaN; if (!fin(Tc)) return { ok: false, why: NOFN('pv.cellTemp') }; taSteps = 'Tc = Ta + (NOCT − 20)/800 · G = ' + fa(Ta) + ' °C + (' + fa(sp.NOCT) + ' − 20)/800 · ' + fa(G) + ' = ' + fa(Tc) + ' °C'; }
    else Tc = pn(v.Tc);
    if (!fin(Tc)) return { ok: false, why: 'Bitte die Zelltemperatur als Zahl eintragen.' };
    const k = C.pv.keys(id, { G, Tc }); if (!k || k.ok === false) return { ok: false, why: (k && k.why) || 'Mit diesen Werten gibt es kein Ergebnis.' };
    const stc = C.pv.keys(id, { G: 1000, Tc: 25 }), hot = C.pv.keys(id, { G: 1000, Tc }), tc = C.pv.tempCoeff(id);
    const out = { ok: true, spec: id, G, Tc, taSteps, keys: k, stc, tempCoeff: tc, clamped: !!k.clamped };
    if (stc && stc.ok !== false && hot && hot.ok !== false && tc && tc.ok !== false && fin(tc.gammaP)) {
      const fz = formulaCalc('pTemp', { pstc: stc.Pmpp, gp: tc.gammaP * 100, t: Tc }), fu = tc && fin(tc.betaU) ? formulaCalc('uocTemp', { uoc: stc.Uoc, bu: tc.betaU * 100, t: Tc }) : null;
      out.faust = fz.ok ? { p: fz.value, steps: fz.steps, model: hot.Pmpp, dev: hot.Pmpp > 0 ? (fz.value - hot.Pmpp) / hot.Pmpp : NaN } : null;
      out.faustU = fu && fu.ok ? { u: fu.value, model: hot.Uoc } : null;
    }
    return out;
  }
  /* (3) Strang: Uoc kalt und Umpp heiß aus pv.keys (Grenztemperaturen), zum Einsetzen in stringMax/stringMin */
  function stringHelp(specId, tCold, tHot) {
    const C = CORE(); if (!C || !has('pv', 'keys')) return { ok: false, why: C ? NOFN('pv.keys') : NOCORE };
    const tc = pn(tCold), th = pn(tHot); if (!fin(tc) || !fin(th)) return { ok: false, why: 'Bitte beide Temperaturen als Zahlen eintragen.' };
    const a = C.pv.keys(specId, { G: 1000, Tc: tc }), b = C.pv.keys(specId, { G: 1000, Tc: th });
    if (!a || a.ok === false || !b || b.ok === false) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, uocCold: a.Uoc, umppHot: b.Umpp, tCold: tc, tHot: th };
  }
  /* (4) Akku: Zyklenzahl und Lebensdauer grob (batt.cycleLife, batt.lifeYears) */
  function lifeCalc(v) {
    const C = CORE(); if (!C || !C.batt) return { ok: false, why: NOCORE }; if (!has('batt', 'cycleLife') || !has('batt', 'lifeYears')) return { ok: false, why: NOFN('batt.cycleLife / batt.lifeYears') };
    v = v || {}; const chem = v.chem === 'lifepo4' ? 'lifepo4' : 'blei', dod = pn(v.dod) / 100, cyc = pn(v.cycles), tmp = pn(v.temp);
    if (![dod, cyc, tmp].every(fin) || !(dod > 0) || dod > 1 || cyc < 0) return { ok: false, why: 'Bitte Entladetiefe (1 bis 100 %), Zyklen je Jahr und Temperatur als Zahlen eintragen.' };
    const n = C.batt.cycleLife(chem, dod), y = C.batt.lifeYears({ chem, dod, cyclesPerYear: cyc, tempC: tmp }), yv = fin(y) ? y : (y && fin(y.years) ? y.years : NaN), nv = fin(n) ? n : (n && fin(n.cycles) ? n.cycles : NaN);
    if (!fin(nv) || !fin(yv)) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    const d = C.batt.defaults ? C.batt.defaults(chem, 12) : null;
    return { ok: true, chem, dod, cycles: nv, years: yv, dodMax: d && d.ok !== false ? d.dodMax : NaN };
  }
  /* (7) Wechselrichter: Wirkungsgrad an den sechs Stützstellen, Europäischer Wirkungsgrad, Standby (inv.eta/euroEta/loss) */
  function wrModels() { const C = CORE(); if (!C || !C.inv || !C.inv.models) return []; return Object.keys(C.inv.models).map(k => ({ value: k, label: C.inv.models[k].name || k })); }
  function wrCalc(v) {
    const C = CORE(); if (!C || !C.inv) return { ok: false, why: NOCORE }; if (!has('inv', 'eta') || !has('inv', 'euroEta') || !has('inv', 'loss')) return { ok: false, why: NOFN('inv.eta / inv.euroEta / inv.loss') };
    v = v || {}; const m = v.model || 'standard', Pn = pn(v.Pn); if (!C.inv.models[m]) return { ok: false, why: 'Dieses Wechselrichter-Modell gibt es nicht.' };
    if (!fin(Pn) || !(Pn > 0)) return { ok: false, why: 'Bitte die Nennleistung als Zahl größer 0 eintragen.' };
    const pts = (C.inv.euroWeights || [[0.05, 0.03], [0.1, 0.06], [0.2, 0.13], [0.3, 0.1], [0.5, 0.48], [1, 0.2]]).map(x => x[0]);
    const rows = pts.map(p => ({ p, eta: C.inv.eta(m, p), pac: p * Pn })); const euro = C.inv.euroEta(m), standby = C.inv.loss(m, Pn, 0);
    if (rows.some(r => !fin(r.eta)) || !fin(euro) || !fin(standby)) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    let spar = NaN; if (m === 'insel' && C.inv.create) { const w = tryf(() => C.inv.create({ kind: 'insel', model: 'insel', Sn: Pn, sparmodus: true, Usys: 12 }), null), r = w && w.step ? tryf(() => w.step(60, { pAc: 0, s: 0, ub: 12.5 }), null) : null; if (r && fin(r.standby)) spar = r.standby; }
    return { ok: true, model: m, Pn, rows, euro, standby, standbyWh: standby * 24, spar, sparWh: fin(spar) ? spar * 24 : NaN };
  }
  /* (8) Sonne: Deklination, Mittagshöhe, Tageslänge, Polarfälle (sun.*) */
  const DAYS = [['21. März', 80], ['21. Juni', 172], ['23. September', 266], ['21. Dezember', 355]];
  function siteList() { const C = CORE(); if (!C || !C.sun || !C.sun.sites) return []; return Object.keys(C.sun.sites).map(k => ({ value: k, label: C.sun.sites[k].name || k })); }
  function sonneCalc(v) {
    const C = CORE(); if (!C || !C.sun) return { ok: false, why: NOCORE }; if (!has('sun', 'declination') || !has('sun', 'position') || !has('sun', 'sunriseSunset')) return { ok: false, why: NOFN('sun.*') };
    v = v || {}; const site = C.sun.sites && C.sun.sites[v.ort]; if (!site) return { ok: false, why: 'Diesen Standort gibt es nicht.' };
    const N = Math.round(pn(v.N)); if (!fin(N) || N < 1 || N > 365) return { ok: false, why: 'Bitte den Tag des Jahres als Zahl von 1 bis 365 eintragen.' };
    const delta = C.sun.declination(N), pos = C.sun.position(N, 12, site.lat), ss = C.sun.sunriseSunset(N, site.lat), len = has('sun', 'dayLength') ? C.sun.dayLength(N, site.lat) : (ss && ss.length);
    if (!fin(delta) || !pos || !fin(pos.alt) || !ss || ss.ok === false) return { ok: false, why: 'Mit diesen Werten gibt es kein Ergebnis.' };
    return { ok: true, lat: site.lat, N, delta, altNoon: pos.alt, up: pos.up !== false && pos.alt > 0, rise: ss.rise, set: ss.set, polar: ss.polar || null, length: len, text: ss.polar === 'nacht' ? 'Polarnacht: Die Sonne geht nicht auf.' : ss.polar === 'tag' ? 'Polartag: Die Sonne geht nicht unter.' : '' };
  }
  /* Übungsgenerator (calc.exercise): alle Arten aus exercise.kinds */
  const XNAMES = { pel: 'Leistung (P = U · I)', etaPv: 'Modulwirkungsgrad', ff: 'Füllfaktor', tempkorr: 'Temperaturkorrektur der Leistung', serie: 'Module in Reihe', parallel: 'Module parallel', stringcheck: 'Strang prüfen (Höchstzahl in Reihe)', batterie: 'Akku dimensionieren', autonomie: 'Autonomiedauer', crate: 'C-Rate', ladezeit: 'Ladezeit', kabel: 'Leitungsquerschnitt', verlust: 'Leitungsverlust', euroeta: 'Europäischer Wirkungsgrad', ertrag: 'Jahresertrag', amorti: 'Amortisation (grob)', sonnenhoehe: 'Mittagshöhe der Sonne', abstand: 'Reihenabstand', pvbedarf: 'Modulleistung für den Bedarf' };
  function exKinds() { const C = CORE(), k = C && C.calc && C.calc.exercise && C.calc.exercise.kinds; return Array.isArray(k) ? k.slice() : []; }
  function newExercise(kind, seed) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE }; if (!has('calc', 'exercise')) return { ok: false, why: NOFN('calc.exercise') };
    let ex; try { ex = C.calc.exercise(kind, seed); } catch (e) { ex = null; } if (!ex || ex.ok === false || typeof ex.check !== 'function') return { ok: false, why: (ex && ex.why) || 'Diese Übung lässt sich nicht erzeugen.' };
    return { ok: true, ex };
  }
  function checkExercise(ex, input) {
    if (!ex || typeof ex.check !== 'function') return { ok: false, text: 'Es gibt noch keine Aufgabe.' };
    let r; try { r = ex.check(input); } catch (e) { r = null; } return r && typeof r === 'object' ? { ok: !!r.ok, text: String(r.text || '') } : { ok: false, text: 'Die Kontrolle ist fehlgeschlagen.' };
  }

  /* ============================================================ Oberfläche */
  const ST = {
    f: {}, /* Formelwerte je Gruppe: ST.f[group][key] */
    modul: { spec: 'si60', mode: 'tc', G: 1000, Tc: 65, Ta: 30, sheet: false },
    ver: { spec: 'si60', tCold: -10, tHot: 60 },
    life: { chem: 'blei', dod: 50, cycles: 200, temp: 25 },
    wr: { model: 'standard', Pn: 3000 },
    sonne: { ort: 'mitte', N: 355 },
    ex: { kind: 'pel', seed: 0, ex: null, input: '', res: null, solved: 0, shown: false }
  };
  const fld = (key, label, unit, val, extra) => `<label class="f"><span>${esc(label)}${unit ? ' (' + esc(unit) + ')' : ''}</span><input data-f="${esc(key)}" inputmode="decimal" autocomplete="off" value="${esc(typeof val === 'number' ? fa(val) : (val == null ? '' : val))}"${extra || ''}></label>`;
  const sel = (key, label, opts, val) => `<label class="f"><span>${esc(label)}</span><select data-f="${esc(key)}">${opts.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(val) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select></label>`;
  const stepsHtml = steps => (steps && steps.length ? `<ol>${steps.map(s => `<li>${esc(typeof s === 'string' ? s : (s && (s.text || (s.lines || []).join(' '))) || '')}</li>`).join('')}</ol>` : '');
  const warnHtml = (w, c) => `<p class="hint2" style="color:${c || 'var(--warn)'};margin:8px 0 0">${esc(w)}</p>`;
  const resHtml = (big, steps, extra) => `<div class="res"><div class="big2">${big}</div>${extra || ''}${stepsHtml(steps)}</div>`;
  const kv = (k, v) => `<div class="kvs"><span>${k}</span><b>${v}</b></div>`;
  const used = () => { if (A && A.S) A.S.calcUsed = true; if (A && typeof A.stat === 'function') A.stat('enrcalc', 1, 'max'); };
  const card = (id, title, body, open) => `<details class="fm" data-card="${id}"${open ? ' open' : ''}><summary>${title}</summary><div class="fmb">${body}</div></details>`;
  const vals0 = id => { const f = formulaById(id), o = {}; formulaInputs(f).forEach(i => { o[i.key] = i.def; }); return o; };
  const fvals = (g, id) => Object.assign(vals0(id), ST.f[g] || {});

  /* eine Formel als Unterformular (Eingaben aus formulas[id].inputs, Ergebnis aus explain) */
  function fform(group, id, title, note) {
    const f = formulaById(id); if (!f) return `<div class="ex"><b>${esc(title || id)}</b>${warnHtml(CORE() ? 'Diese Formel gibt es im Kern nicht.' : NOCORE)}</div>`;
    const v = fvals(group, id);
    return `<div class="ex" data-fg="${esc(group)}" data-fid="${esc(id)}"><b>${esc(title || f.name)}</b><div class="hint2" style="margin:2px 0 6px">${esc(f.expr)}</div>${note ? `<div class="hint2" style="margin:0 0 6px">${esc(note)}</div>` : ''}<div class="frm">${formulaInputs(f).map(i => fld('f:' + group + ':' + i.key, i.label, i.unit, v[i.key])).join('')}</div><div data-res="r-${esc(group)}">${fview(group, id)}</div></div>`;
  }
  function fview(group, id) {
    const r = formulaCalc(id, fvals(group, id)); if (!r.ok) return warnHtml(r.why);
    const norm = r.extra && fin(r.extra.norm) ? kv('Normwert (aufgerundet)', fa(r.extra.norm) + ' ' + esc(r.unit)) : '';
    return resHtml(esc(r.shown), r.steps, norm + (r.note ? `<p class="hint2" style="margin:6px 0 0">${esc(r.note)}</p>` : ''));
  }
  const setRes = (host, name, html) => { const el = host.querySelector('[data-res="' + name + '"]'); if (el) el.innerHTML = html; };

  /* ---- 1 Leistung, Energie, Wirkungsgrad ---- */
  const bodyP = () => fform('leistung', 'leistung') + fform('energie', 'energie') + fform('eta', 'eta') + fform('etaPv', 'etaPv') + fform('ff', 'ff');

  /* ---- 2 Modul bei Bedingungen ---- */
  function modulBody() {
    const st = ST.modul;
    return `<p class="hint2" style="margin:0 0 8px">Kennwerte aus dem Ein-Dioden-Modell des Labs bei beliebiger Einstrahlung und Zelltemperatur. Die Faustformel für die Temperatur steht zum Vergleich daneben.</p>
      <div class="frm">${sel('m:spec', 'Modul', specList(), st.spec)}${sel('m:mode', 'Temperatur', [{ value: 'tc', label: 'Zelltemperatur direkt' }, { value: 'ta', label: 'aus Umgebung (NOCT-Formel)' }], st.mode)}${fld('m:G', 'Einstrahlung G', 'W/m²', st.G)}${st.mode === 'ta' ? fld('m:Ta', 'Umgebungstemperatur Ta', '°C', st.Ta) : fld('m:Tc', 'Zelltemperatur Tc', '°C', st.Tc)}</div>
      <div data-res="modul">${modulView()}</div>`;
  }
  function modulView() {
    const r = modulCalc(ST.modul); if (!r.ok) return warnHtml(r.why); const k = r.keys, C = CORE();
    let h = `<div class="res">${r.taSteps ? `<p style="margin:0 0 6px">${esc(r.taSteps)}</p>` : ''}${kv('Leerlaufspannung Uoc', fa(k.Uoc) + ' V')}${kv('Kurzschlussstrom Isc', fa(k.Isc) + ' A')}${kv('Spannung im MPP Umpp', fa(k.Umpp) + ' V')}${kv('Strom im MPP Impp', fa(k.Impp) + ' A')}<div class="big2">Pmpp = ${fa(k.Pmpp)} W</div>${kv('Füllfaktor FF', fnum(k.FF, 2))}${kv('Wirkungsgrad η', fin(k.eta) ? fnum(k.eta * 100, 1) + ' %' : '–')}${r.clamped ? warnHtml('Der Wert liegt außerhalb des Bereichs des Modells und wurde auf die Grenze gesetzt.') : ''}</div>`;
    if (r.faust) h += `<div class="res"><b>Faustformel gegen Modell (bei 1000 W/m², Tc = ${fa(r.Tc)} °C)</b>${kv('Faustformel P(T)', fa(r.faust.p) + ' W')}${kv('Modell Pmpp', fa(r.faust.model) + ' W')}${kv('Abweichung', (r.faust.dev >= 0 ? '+' : '') + fnum(100 * r.faust.dev, 1) + ' %')}${r.faustU ? kv('Uoc nach Faustformel / Modell', fa(r.faustU.u) + ' V / ' + fa(r.faustU.model) + ' V') : ''}${stepsHtml(r.faust.steps)}<p class="hint2" style="margin:6px 0 0">Der Temperaturkoeffizient ${fnum(100 * r.tempCoeff.gammaP, 3)} %/K ist ein Ergebnis des Modells, kein Eingabewert. Die Faustformel kennt nur die Temperatur, nicht die Einstrahlung.</p></div>`;
    if (ST.modul.sheet && C.pv.datasheet) { const d = C.pv.datasheet(ST.modul.spec); if (d && d.rows) h += `<div class="res"><table class="kt"><tr><th>Größe</th><th class="n">Wert</th></tr>${d.rows.map(x => `<tr><td>${esc(x.label)}</td><td class="n">${esc(x.text)} ${esc(x.unit)}</td></tr>`).join('')}</table><p class="hint2" style="margin:6px 0 0">${esc(d.note || '')}</p></div>`; }
    return h + `<div class="btns"><button class="btn" data-act="sheet">${ST.modul.sheet ? 'Datenblatt ausblenden' : 'Moduldatenblatt zeigen'}</button></div>`;
  }

  /* ---- 3 Verschaltung ---- */
  function verBody() {
    const st = ST.ver, h = stringHelp(st.spec, st.tCold, st.tHot);
    return `${fform('serie', 'serie')}${fform('parallel', 'parallel')}
      <div class="ex"><b>Strangauslegung: Werte aus dem Modul holen</b><div class="frm">${sel('v:spec', 'Modul', specList(), st.spec)}${fld('v:tCold', 'Tiefste Zelltemperatur', '°C', st.tCold)}${fld('v:tHot', 'Höchste Zelltemperatur', '°C', st.tHot)}</div><div data-res="ver">${verView(h)}</div></div>
      ${fform('stringMax', 'stringMax')}${fform('stringMin', 'stringMin')}`;
  }
  function verView(h) {
    h = h || stringHelp(ST.ver.spec, ST.ver.tCold, ST.ver.tHot); if (!h.ok) return warnHtml(h.why);
    return `<div class="res">${kv('Uoc bei ' + fa(h.tCold) + ' °C (Kälte, Höchstzahl)', fa(h.uocCold) + ' V')}${kv('Umpp bei ' + fa(h.tHot) + ' °C (Hitze, Mindestzahl)', fa(h.umppHot) + ' V')}<div class="btns"><button class="btn" data-act="ver-use">In die Formeln unten einsetzen</button></div></div>`;
  }

  /* ---- 4 Akku ---- */
  function akkuBody() {
    return fform('batterieKap', 'batterieKap') + fform('autonomie', 'autonomie') + fform('crate', 'crate') + fform('ladezeit', 'ladezeit') +
      `<div class="ex"><b>Entladetiefe und Lebensdauer (grob)</b><div class="frm">${sel('l:chem', 'Akku', [{ value: 'blei', label: 'Blei (AGM/Gel)' }, { value: 'lifepo4', label: 'Li-Ion (LiFePO4)' }], ST.life.chem)}${fld('l:dod', 'Entladetiefe je Zyklus', '%', ST.life.dod)}${fld('l:cycles', 'Zyklen je Jahr', '', ST.life.cycles)}${fld('l:temp', 'mittlere Temperatur', '°C', ST.life.temp)}</div><div data-res="life">${lifeView()}</div></div>`;
  }
  function lifeView() {
    const r = lifeCalc(ST.life); if (!r.ok) return warnHtml(r.why);
    return `<div class="res"><div class="big2">etwa ${fa(r.years)} Jahre</div>${kv('Zyklen bis zum Lebensende (grob)', fa(r.cycles))}${fin(r.dodMax) ? kv('empfohlene größte Entladetiefe', fnum(100 * r.dodMax, 0) + ' %') : ''}${r.dod > r.dodMax + 1e-9 ? warnHtml('Diese Entladetiefe liegt über der empfohlenen. Der Akku altert schneller.') : ''}<p class="hint2" style="margin:6px 0 0">Sehr grobe Annahme (Größenordnung). Das Datenblatt des Herstellers gilt.</p></div>`;
  }

  /* ---- 5 Leitung ---- */
  const leitBody = () => fform('spannungsfall', 'spannungsfall') + fform('querschnitt', 'querschnitt') + fform('leitungsverlust', 'leitungsverlust') +
    '<p class="hint2" style="margin:6px 0 0">Gilt für Hin- und Rückleitung (zweimal die einfache Länge). Kupfer: κ = 56 m/(Ω·mm²); die Tabellenbuchwerte 57 und 58 gelten auch.</p>';

  /* ---- 6 Ertrag und Amortisation ---- */
  const ertragBody = () => '<p class="hint2" style="margin:0 0 8px">Annahme, bitte aktualisieren: Einstrahlung, Preise und Vergütung sind Eingabewerte, keine Fachwerte. Das Tagesmodell des Labs wird nicht auf ein Jahr hochgerechnet. Die Amortisation rechnet ohne Zins und ohne Alterung.</p>' +
    fform('ertrag', 'ertrag') + fform('amortisation', 'amortisation') + fform('eigenquote', 'eigenquote') + fform('autarkie', 'autarkie');

  /* ---- 7 Wechselrichter ---- */
  function wrBody() {
    const st = ST.wr; return `<div class="ex"><b>Wirkungsgrad und Standby aus dem Verlustmodell</b><div class="frm">${sel('w:model', 'Modell', wrModels(), st.model)}${fld('w:Pn', 'Nennleistung Pn', 'W', st.Pn)}</div><div data-res="wr">${wrView()}</div></div>${fform('wrEta', 'wrEta')}${fform('euroEta', 'euroEta')}`;
  }
  function wrView() {
    const r = wrCalc(ST.wr); if (!r.ok) return warnHtml(r.why);
    return `<div class="res"><table class="kt"><tr><th>Last P/Pn</th><th class="n">P_AC in W</th><th class="n">η in %</th></tr>${r.rows.map(x => `<tr><td>${fnum(100 * x.p, 0)} %</td><td class="n">${fa(x.pac)}</td><td class="n">${fnum(100 * x.eta, 1)}</td></tr>`).join('')}</table><div class="big2">η Euro = ${fnum(100 * r.euro, 1)} %</div>${kv('Standby ohne Last (Normalbetrieb)', fa(r.standby) + ' W = ' + fa(r.standbyWh) + ' Wh je Tag')}${fin(r.spar) ? kv('im Sparmodus', fa(r.spar) + ' W = ' + fa(r.sparWh) + ' Wh je Tag') : ''}<p class="hint2" style="margin:6px 0 0">Die sechs Werte kannst du unten in die Formel für den Europäischen Wirkungsgrad eintragen.</p><div class="btns"><button class="btn" data-act="wr-use">Werte in die Euro-Formel einsetzen</button></div></div>`;
  }

  /* ---- 8 Sonne ---- */
  function sonneBody() {
    const st = ST.sonne;
    return `<div class="ex"><b>Sonnenstand am Mittag und Tageslänge</b><div class="chips" style="padding:0 0 6px">${DAYS.map(d => `<button class="chip s${st.N === d[1] ? ' on' : ''}" data-act="day" data-n="${d[1]}">${esc(d[0])}</button>`).join('')}</div><div class="frm">${sel('s:ort', 'Standort', siteList(), st.ort)}${fld('s:N', 'Tag des Jahres N', '', st.N)}</div><div data-res="sonne">${sonneView()}</div></div>${fform('sonnenhoehe', 'sonnenhoehe', null, 'Sonnenzeit, nicht die Uhrzeit an der Wand: Mittag ist, wenn die Sonne am höchsten steht.')}${fform('reihenabstand', 'reihenabstand')}`;
  }
  function sonneView() {
    const r = sonneCalc(ST.sonne); if (!r.ok) return warnHtml(r.why);
    return `<div class="res">${kv('Breitengrad φ', fnum(r.lat, 1) + ' °')}${kv('Deklination δ', fnum(r.delta, 2) + ' °')}${kv('Sonnenhöhe am Mittag (Sonnenzeit)', r.up ? fnum(r.altNoon, 2) + ' °' : 'unter dem Horizont')}${r.polar ? '' : kv('Tageslänge', fnum(r.length, 2) + ' h')}${r.polar ? '' : kv('Aufgang / Untergang (Sonnenzeit)', fnum(r.rise, 2) + ' h / ' + fnum(r.set, 2) + ' h')}${r.text ? `<div class="big2">${esc(r.text)}</div>` : ''}<div class="btns"><button class="btn" data-act="sonne-use">φ, δ und Mittagshöhe in die Formeln einsetzen</button></div></div>`;
  }

  /* ---- Übungsgenerator ---- */
  function tablesHtml(t) {
    if (!Array.isArray(t) || !t.length) return '';
    return t.map(x => `<div class="rl" style="margin:6px 0"><table class="kt">${x.caption ? `<caption style="text-align:left;color:var(--mute);font-size:12px;padding:2px 0">${esc(x.caption)}</caption>` : ''}${Array.isArray(x.head) ? '<tr>' + x.head.map(h => `<th>${esc(h)}</th>`).join('') + '</tr>' : ''}${(x.rows || []).map(r => '<tr>' + [].concat(r).map(c => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')}</table></div>`).join('');
  }
  function exBody() {
    const x = ST.ex, kinds = exKinds();
    return `<p class="hint2" style="margin:0 0 8px">Rechne die Aufgabe im Kopf oder auf Papier und gib dein Ergebnis ein. Die Kontrolle sagt dir, ob es stimmt, und erkennt typische Fehler. Die Einheit darfst du dazuschreiben.</p><div class="frm">${sel('xkind', 'Art der Aufgabe', kinds.map(k => ({ value: k, label: XNAMES[k] || k })), x.kind)}</div><div class="btns"><button class="btn pri" data-act="ex-new">Neue Aufgabe</button></div><div data-res="ex">${exView()}</div>`;
  }
  function exView() {
    const x = ST.ex; if (!x.ex) return '<p class="hint2">Tippe auf „Neue Aufgabe“.</p>'; const e = x.ex;
    return `<div class="res"><p style="margin:0 0 8px">${esc(e.question || '')}</p>${tablesHtml(e.table)}<label class="f"><span>Dein Ergebnis${e.answer && e.answer.unit ? ' in ' + esc(e.answer.unit) : ''}</span><input data-f="exin" inputmode="decimal" autocomplete="off" value="${esc(x.input)}"></label>
      <div class="btns"><button class="btn pri" data-act="ex-check">✓ Prüfen</button><button class="btn" data-act="ex-solve">Lösungsweg zeigen</button></div>
      ${x.res ? `<div class="ex ${x.res.ok ? 'ok' : 'bad'}">${esc(x.res.text)}</div>` : ''}${x.shown ? `<div class="ex"><b>Lösungsweg</b>${stepsHtml(e.steps)}</div>` : ''}<p class="hint2" style="margin:6px 0 0">Richtig gelöst: ${x.solved}</p></div>`;
  }

  function renderAll() {
    return `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für das Energie-Lab</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, gleiche Tabellen, Zahlen mit Komma und Rechenweg.</p></div>` +
      card('p', '⚡ 1 Leistung, Energie, Wirkungsgrad', bodyP(), true) + card('modul', '☀️ 2 Modul bei Bedingungen', modulBody()) + card('ver', '🔌 3 Verschaltung: Reihe, parallel, Strang', verBody()) + card('akku', '🔋 4 Akku', akkuBody()) +
      card('leit', '📏 5 Leitung: Spannungsfall und Querschnitt', leitBody()) + card('ertrag', '💶 6 Ertrag und Amortisation (Annahmen)', ertragBody()) + card('wr', '🔁 7 Wechselrichter', wrBody()) + card('sonne', '🌞 8 Sonne', sonneBody()) +
      card('ex', '🎯 Übungsgenerator: Neue Aufgabe', exBody());
  }

  /* ---- Ereignisse ---- */
  const coerceVal = el => (el.type === 'checkbox' ? el.checked : el.value);
  function setField(host, group, id, key, v) { (ST.f[group] = ST.f[group] || {})[key] = v; const inp = host.querySelector('[data-f="f:' + group + ':' + key + '"]'); if (inp) inp.value = typeof v === 'number' ? fa(v) : v; setRes(host, 'r-' + group, fview(group, id)); }
  function onInput(host, e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-f]') : null; if (!el) return; const k = el.dataset.f, val = coerceVal(el); used();
    const card0 = el.closest('[data-card]'), cid = card0 && card0.dataset.card;
    const redo = body => { const b = card0 && card0.querySelector ? card0.querySelector('.fmb') : null; if (b) b.innerHTML = body(); };
    if (k.indexOf('f:') === 0) { const p = k.split(':'), g = el.closest('[data-fg]'); (ST.f[p[1]] = ST.f[p[1]] || {})[p[2]] = val; if (g) setRes(g, 'r-' + p[1], fview(p[1], g.dataset.fid)); return; }
    if (k === 'xkind') { ST.ex.kind = val; ST.ex.ex = null; ST.ex.res = null; ST.ex.shown = false; setRes(host, 'ex', exView()); return; }
    if (k === 'exin') { ST.ex.input = val; return; }
    if (cid === 'modul' && k.indexOf('m:') === 0) { ST.modul[k.slice(2)] = val; if (k === 'm:mode') redo(modulBody); else setRes(host, 'modul', modulView()); }
    else if (cid === 'ver' && k.indexOf('v:') === 0) { ST.ver[k.slice(2)] = val; setRes(host, 'ver', verView()); }
    else if (cid === 'akku' && k.indexOf('l:') === 0) { ST.life[k.slice(2)] = val; setRes(host, 'life', lifeView()); }
    else if (cid === 'wr' && k.indexOf('w:') === 0) { ST.wr[k.slice(2)] = val; setRes(host, 'wr', wrView()); }
    else if (cid === 'sonne' && k.indexOf('s:') === 0) { ST.sonne[k.slice(2)] = k === 's:N' ? val : val; setRes(host, 'sonne', sonneView()); }
  }
  function onClick(host, e) {
    const b = e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return; const a = b.dataset.act;
    if (a === 'sheet') { ST.modul.sheet = !ST.modul.sheet; setRes(host, 'modul', modulView()); }
    else if (a === 'ver-use') { const h = stringHelp(ST.ver.spec, ST.ver.tCold, ST.ver.tHot); if (h.ok) { setField(host, 'stringMax', 'stringMax', 'uoc', Math.round(h.uocCold * 100) / 100); setField(host, 'stringMin', 'stringMin', 'umpp', Math.round(h.umppHot * 100) / 100); used(); } }
    else if (a === 'wr-use') { const r = wrCalc(ST.wr); if (r.ok) { ['e5', 'e10', 'e20', 'e30', 'e50', 'e100'].forEach((key, i) => setField(host, 'euroEta', 'euroEta', key, Math.round(r.rows[i].eta * 1000) / 10)); used(); } }
    else if (a === 'day') { ST.sonne.N = +b.dataset.n; const body = host.querySelector('[data-card="sonne"] .fmb'); if (body) body.innerHTML = sonneBody(); used(); }
    else if (a === 'sonne-use') { const r = sonneCalc(ST.sonne); if (r.ok) { setField(host, 'sonnenhoehe', 'sonnenhoehe', 'phi', Math.round(r.lat * 100) / 100); setField(host, 'sonnenhoehe', 'sonnenhoehe', 'delta', Math.round(r.delta * 100) / 100); if (r.up) setField(host, 'reihenabstand', 'reihenabstand', 'alt', Math.round(r.altNoon * 100) / 100); used(); } }
    else if (a === 'ex-new') { used(); const x = ST.ex; x.seed = (x.seed || (A && A.lsGet ? +A.lsGet('enr.calcseed', 0) || 0 : 0)) + 1; if (A && A.lsSet) A.lsSet('enr.calcseed', x.seed); const r = newExercise(x.kind, x.seed); x.input = ''; x.res = null; x.shown = false; if (r.ok) x.ex = r.ex; else { x.ex = null; setRes(host, 'ex', warnHtml(r.why)); return; } setRes(host, 'ex', exView()); }
    else if (a === 'ex-check') { const x = ST.ex; if (!x.ex) return; const inp = host.querySelector('[data-f="exin"]'); if (inp) x.input = inp.value; x.res = checkExercise(x.ex, x.input); if (x.res.ok) { x.solved++; if (A && A.stat) A.stat('enrcalc', x.solved, 'max'); } setRes(host, 'ex', exView()); }
    else if (a === 'ex-solve') { ST.ex.shown = true; setRes(host, 'ex', exView()); }
  }
  function render(host, api) {
    A = api; host.innerHTML = renderAll();
    if (!host._enrCalc) { host._enrCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }
  const api0 = { render, fn: { formulaById, formulaList, formulaInputs, formulaCalc, modulCalc, stringHelp, lifeCalc, wrCalc, wrModels, sonneCalc, siteList, specList, newExercise, checkExercise, exKinds, XNAMES, DAYS }, ST };
  root.ENR_UI_EXT = root.ENR_UI_EXT || {}; root.ENR_UI_EXT.calc = api0;
  if (typeof module !== 'undefined') module.exports = api0;
})(typeof window !== 'undefined' ? window : globalThis);
