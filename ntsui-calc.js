'use strict';
/* Tonfunk Netzteil-Lab: Tab "Rechnen" (WP3c, SPEC 6.3).
   Sieben Karten aus NTS_CORE.formulas (alle 30 Einträge: Formelzeile expr, Rechenweg mit Eingaben, Ergebnis aus formulas[id].run), dazu der Übungsgenerator
   ("Neue Aufgabe") für alle NTS_CORE.exercise.kinds (19 Arten, Prüfung mit exercise.check, Zähler ntscalc über api.stat).
   ALLE Zahlen kommen aus NTS_CORE (formulas[id].run/fn, exercise, TEXTS, limit); hier steht keine zweite Formelimplementierung (SPEC Regel 7).
   Die Prozentanzeige (D, η) ist nur die Darstellung desselben Kernwerts mal 100. Fehlt der Kern oder eine Funktion, erscheint ein deutscher Hinweis statt Zahlen.
   Alle Beispielwerte in den Feldern sind Übungswerte (aus formulas[].args[].def).
   Schnittstelle (VERTRAG 6.4): window.NTS_UI_EXT.calc.render(host, api). Die Rechenfunktionen (ohne DOM) hängen unter NTS_UI_EXT.calc.fn
   und werden von quelle/ntslab/test_ntsui_ext2.js geprüft. */
(function (root) {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const CORE = () => root.NTS_CORE;
  const tryf = (f, d) => { try { const r = f(); return r === undefined ? d : r; } catch (e) { return d; } };
  const fm = (v, d) => { const C = CORE(); if (C && typeof C.fmt === 'function') return tryf(() => C.fmt(v, d), '–'); return fin(v) ? (+v).toFixed(d == null ? 2 : d).replace('.', ',') : '–'; };
  const eng = (v, u) => { if (!u) return fm(v, 4); const C = CORE(); if (C && typeof C.fmtEng === 'function') return tryf(() => C.fmtEng(v, u), '–'); return fin(v) ? fm(v, 3) + ' ' + u : '–'; };
  const NOCORE = 'Der Rechenkern ist nicht geladen (ntscore.js, ntscore-sw.js und ntscore-diag.js fehlen). Ohne ihn gibt es hier keine Zahlen.';
  const NOFN = n => 'Dem Rechenkern fehlt die Funktion ' + n + ' (ntscore-diag.js ist nicht vollständig geladen). Dieser Rechner liefert deshalb keine Zahlen.';
  const textOf = id => { const C = CORE(), t = C && C.TEXTS ? C.TEXTS[id] : null; return typeof t === 'string' ? t : ''; };
  const limOf = id => { const C = CORE(); const l = C && typeof C.limit === 'function' ? tryf(() => C.limit(id), null) : null; return l && fin(l.value) ? l : null; };
  let A = null; /* api der Seite (nur Oberfläche, nie Rechnung) */

  /* ============================================================ Eingaben lesen (nur Zahl und Vorsatz lesen, keine Physik) */
  const PREFIX = { '': 1, p: 1e-12, n: 1e-9, 'µ': 1e-6, u: 1e-6, m: 1e-3, k: 1e3, M: 1e6, G: 1e9 };
  const ALIAS = { Ohm: 'Ω', ohm: 'Ω' };
  /* Text -> SI-Zahl: ohne Einheit im Text gilt die Anzeigeeinheit des Feldes (f.scale), mit Einheit (zum Beispiel "470 nF") Vorsatz plus Grundeinheit des Feldes (f.base) */
  function readNum(txt, f) {
    const C = CORE(), sc = (f && f.scale) || 1, base = (f && f.base) || '';
    if (typeof txt === 'number') return fin(txt) ? txt * sc : NaN;
    const t = String(txt == null ? '' : txt).trim(); if (!t) return NaN;
    const q = C && typeof C.parseUnit === 'function' ? tryf(() => C.parseUnit(t), null) : null;
    let v, unit;
    if (q && fin(q.value)) { v = q.value; unit = String(q.unit || ''); }
    else {
      const m = /^([+-]?\d+(?:[.,]\d+)?(?:[eE][+-]?\d+)?)\s*(\S*)$/.exec(t); if (!m) return NaN;
      v = Number(m[1].replace(',', '.')); unit = m[2] || '';
    }
    if (!fin(v)) return NaN;
    if (unit === '') return v * sc;
    if (unit === '%' && f && f.pct) return v / 100;
    unit = ALIAS[unit] || unit;
    if (!base) return NaN;
    if (unit.length >= base.length && unit.endsWith(base)) { const p = unit.slice(0, unit.length - base.length); if (Object.prototype.hasOwnProperty.call(PREFIX, p)) { const r = v * PREFIX[p]; return fin(r) ? r : NaN; } }
    return NaN;
  }
  /* Zahl für das Eingabefeld (Dezimalkomma, höchstens 6 Stellen) */
  const dnum = x => (fin(x) ? fm(Number(Number(x).toPrecision(6)), 6).replace(/,?0+$/, '') : '');

  /* ============================================================ Karten (Daten, keine Formeln) */
  const CARDS = [
    { id: 'c1', icon: '🔌', title: '1 Transformator', rows: ['uebersetzung', 'strom1', 'uklemme'] },
    { id: 'c2', icon: '〰️', title: '2 Gleichrichter und Brumm', rows: ['scheitel', 'brumm', 'cmin', 'rcSieb'] },
    { id: 'c3', icon: '🔻', title: '3 Z-Diode', rows: ['zStrom', 'rvMin'] },
    { id: 'c4', icon: '🌡️', title: '4 Linearregler und Verlustleistung', rows: ['pvLin', 'etaLin', 'strombegr'] },
    { id: 'c5', icon: '🎚️', title: '5 LM317', rows: ['lm317', 'r2lm317'] },
    { id: 'c6', icon: '⚡', title: '6 Schaltregler: D, ΔI_L, L und C', rows: ['dBuck', 'dBoost', 'dInvers', 'dFlyback', 'dIL', 'lMin', 'iKrit', 'dUc'] },
    { id: 'c7', icon: '📊', title: '7 Wirkungsgrad, Schaltverluste und weitere Rechner', rows: ['pCond', 'pDiode', 'pSw', 'pGate', 'etaSchalt', 'pvSchalt', 'rKrit', 'grenzf'] }
  ];
  /* Anzeigeeinheit je Argument (Eingabe in dieser Einheit, wenn kein Einheitenzusatz getippt wird); die Kern-Argumente stehen in SI */
  const SWROWS = ['dIL', 'lMin', 'iKrit', 'dUc', 'pCond', 'pDiode', 'pSw', 'pGate'];
  function dispUnit(rowId, a) {
    if (a.unit === 'F') return ['µF', 1e-6];
    if (a.unit === 'H') return ['µH', 1e-6];
    if (a.unit === 'C') return ['nC', 1e-9];
    if (a.unit === 's') return ['ns', 1e-9];
    if (a.key === 'f' && SWROWS.indexOf(rowId) >= 0) return ['kHz', 1e3];
    return [a.unit, 1];
  }
  /* Ergebnisse, die zusätzlich als Prozent gezeigt werden (derselbe Kernwert, nur mal 100) */
  const PCT = { dBuck: 1, dBoost: 1, dInvers: 1, dFlyback: 1, etaLin: 1, etaSchalt: 1 };
  const PCTFIELD = { pvSchalt: 'eta' };
  const THERM = { pvLin: 1, pvSchalt: 1 };
  const NOTES = {
    brumm: [() => textOf('elkoHinweis')], cmin: [() => textOf('elkoHinweis')], rcSieb: [() => textOf('elkoHinweis')],
    pCond: [() => textOf('uebungswert'), () => textOf('datenblatt')], pDiode: [() => textOf('uebungswert'), () => textOf('datenblatt')],
    pSw: [() => textOf('uebungswert'), () => textOf('datenblatt')], pGate: [() => textOf('datenblatt')]
  };

  /* ============================================================ reine Rechenfunktionen (alle rufen NTS_CORE) */
  function formulaList() { const C = CORE(), f = C && C.formulas; return Array.isArray(f) ? f.slice() : []; }
  function formulaById(id) { const C = CORE(), f = C && C.formulas; if (!Array.isArray(f)) return null; const e = f.find(x => x && x.id === id); return e && typeof e.run === 'function' ? e : null; }
  /* Zeilen-Beschreibung: Felder aus den Argumenten der Kernformel (Beschriftung, Kerneinheit, Vorgabe), Anzeigeeinheit aus der Tabelle oben */
  function rowById(id) {
    if (!CARDS.some(c => c.rows.indexOf(id) >= 0)) return null;
    const fo = formulaById(id); if (!fo) return null;
    const fields = fo.args.map(a => {
      const du = dispUnit(id, a), pct = PCTFIELD[id] === a.key;
      return { key: a.key, label: a.label, unit: du[0], base: a.unit, scale: du[1], pct, def: dnum(a.def / du[1]) };
    });
    return { id, formula: id, title: fo.name + (fo.symbol ? ' (' + fo.symbol + ')' : ''), symbol: fo.symbol, expr: fo.expr, resUnit: fo.unit, fields };
  }
  function cardList() { return CARDS.map(c => ({ id: c.id, icon: c.icon, title: c.title, rows: c.rows.slice() })); }
  function defaultsOf(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { o[f.key] = f.def; }); return o; }
  function argsOf(r, vals) {
    const out = {}, bad = [];
    r.fields.forEach(f => {
      const raw = vals && vals[f.key] != null ? vals[f.key] : f.def, v = readNum(raw, f);
      if (!fin(v)) bad.push(f.label);
      out[f.key] = v;
    });
    return { args: out, bad };
  }
  /* Eine Zeile rechnen: Ergebnis genau aus formulas[id].run (Zahl vom Kern, Rechenweg aus expr, Eingaben und Ergebnis) */
  function calc(rowId, vals) {
    const C = CORE(); if (!C) return { ok: false, why: NOCORE };
    if (!Array.isArray(C.formulas)) return { ok: false, why: NOFN('formulas') };
    const r = rowById(rowId); if (!r) return { ok: false, why: 'Diesen Rechner gibt es nicht.' };
    const { args, bad } = argsOf(r, vals);
    if (bad.length) return { ok: false, why: 'Bitte in diese Felder Zahlen eintragen (Komma oder Punkt, Einheit nur passend zum Feld): ' + bad.join(', ') + '.' };
    const f = formulaById(rowId); if (!f) return { ok: false, why: NOFN('formulas') };
    const e = tryf(() => f.run.apply(null, f.args.map(a => args[a.key])), null);
    if (!e || e.ok === false || !fin(e.value)) return { ok: false, why: (e && e.why) || 'Mit diesen Werten gibt es kein Ergebnis (zum Beispiel Division durch 0 oder ein Wert, der die Schaltung nicht zulässt).' };
    const unit = f.unit || '';
    let shown = (f.symbol ? f.symbol + ' = ' : '') + eng(e.value, unit);
    if (PCT[rowId]) shown += ' (' + fm(e.value * 100, 2) + ' %)';
    const eingaben = f.args.map(a => a.key + ' = ' + eng(args[a.key], a.unit)).join(', ');
    const notes = [];
    (NOTES[rowId] || []).forEach(g => { const t = g(); if (t) notes.push(t); });
    if (THERM[rowId]) { const l = limOf('pv_therm'); if (l && e.value >= l.value) notes.push('Ab ' + eng(l.value, l.unit) + ' ist Kühlung ein Thema: Das rechnest du im Thermik-Lab, nicht hier.'); }
    return { ok: true, id: rowId, row: rowId, value: e.value, unit, shown, text: shown, steps: [f.expr, 'Eingaben: ' + eingaben, shown], explain: f.explain || '', args, notes };
  }
  function exKinds() { const C = CORE(); return C && C.exercise && Array.isArray(C.exercise.kinds) ? C.exercise.kinds.slice() : []; }
  function exLabel(k) { const f = formulaById(k); return f ? f.name : k; }
  function exNew(kind, seed) {
    const C = CORE(); if (!C || typeof C.exercise !== 'function') return { ok: false, why: NOCORE };
    const e = tryf(() => C.exercise(kind, seed), null);
    if (!e || e.ok === false || typeof e.check !== 'function') return { ok: false, why: (e && e.why) || 'Diese Übung gibt es nicht.' };
    return e;
  }
  function exCheck(ex, input) {
    if (!ex || typeof ex.check !== 'function') return { ok: false, text: 'Erst eine Aufgabe erzeugen.', why: '' };
    const r = tryf(() => ex.check(String(input == null ? '' : input)), null);
    return r && typeof r === 'object' ? r : { ok: false, text: 'Mit dieser Eingabe gibt es kein Ergebnis.', why: '' };
  }

  /* ============================================================ Oberfläche */
  const ST = { vals: {}, ex: null, kind: '', seed: 0, ans: '', res: null, show: false };
  const CSS = '<style>.nc-g{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}.nc-g label{flex:1 1 150px;min-width:130px;font-size:12.5px;color:var(--mute)}.nc-g input,.nc-g select{margin-top:3px;min-height:42px}.nc-row{padding:10px 12px;border-top:1px solid var(--line)}.nc-row:first-child{border-top:0}.nc-row h5{margin:0;font-size:14px}.nc-res{margin-top:8px}.nc-bad{color:var(--danger);font-size:13.5px;margin:6px 0 0}.nc-q{font-size:15px;line-height:1.5;margin:6px 0}</style>';
  function fieldHtml(rowId, f) {
    const k = rowId + '.' + f.key, v = ST.vals[k] != null ? ST.vals[k] : f.def, id = 'nc_' + rowId + '_' + f.key;
    return `<label for="${id}">${esc(f.label)}${f.unit ? ' in ' + esc(f.unit) : ''}<input id="${id}" data-f="${esc(k)}" inputmode="decimal" autocomplete="off" value="${esc(v)}"></label>`;
  }
  function resHtml(res) {
    if (!res) return '';
    if (!res.ok) return `<p class="nc-bad" role="status">${esc(res.why)}</p>`;
    return `<div class="res"><div class="big2">${esc(res.shown)}</div><ol>${res.steps.map(t => `<li>${esc(t)}</li>`).join('')}</ol>${res.explain ? `<p class="hint2">${esc(res.explain)}</p>` : ''}${res.notes.map(t => `<p class="hint2">${esc(t)}</p>`).join('')}</div>`;
  }
  function rowVals(rowId) { const r = rowById(rowId), o = {}; if (r) r.fields.forEach(f => { const k = rowId + '.' + f.key; o[f.key] = ST.vals[k] != null ? ST.vals[k] : f.def; }); return o; }
  function rowHtml(rowId) {
    const r = rowById(rowId); if (!r) return `<div class="nc-row"><p class="nc-bad">${esc(CORE() ? NOFN('formulas.' + rowId) : NOCORE)}</p></div>`;
    return `<div class="nc-row" data-row="${esc(rowId)}"><h5>${esc(r.title)}</h5><p class="hint2" style="margin:2px 0 0">${esc(r.expr)}</p><div class="nc-g">${r.fields.map(f => fieldHtml(rowId, f)).join('')}</div><div class="nc-res" data-res="${esc(rowId)}" aria-live="polite">${resHtml(calc(rowId, rowVals(rowId)))}</div></div>`;
  }
  function cardHtml(c, open) {
    return `<details class="card" data-card="${esc(c.id)}"${open ? ' open' : ''}><summary>${c.icon} ${esc(c.title)}</summary><div class="cb">${c.rows.map(rowHtml).join('')}</div></details>`;
  }
  function exHtml() {
    const kinds = exKinds(), ex = ST.ex;
    const sel = `<label for="nc_kind">Art der Aufgabe<select id="nc_kind" data-act-sel="kind">${kinds.map(k => `<option value="${esc(k)}"${k === ST.kind ? ' selected' : ''}>${esc(exLabel(k))}</option>`).join('')}</select></label>`;
    let body = '';
    if (!kinds.length) body = `<p class="nc-bad">${esc(CORE() ? NOFN('exercise') : NOCORE)}</p>`;
    else if (ex && ex.ok === false) body = `<p class="nc-bad">${esc(ex.why)}</p>`;
    else if (ex) {
      const res = ST.res, un = ex.answer.unit || '';
      body = `<p class="nc-q" data-ex="q">${esc(ex.question)}</p><label for="nc_ans">Deine Antwort${un ? ' (in ' + esc(un) + ')' : ' (ohne Einheit)'}<input id="nc_ans" data-ans="1" inputmode="decimal" autocomplete="off" value="${esc(ST.ans)}"></label>
        <div class="btns"><button class="btn pri" data-act="check">Prüfen</button><button class="btn" data-act="steps">Rechenweg zeigen</button><button class="btn" data-act="newex">Neue Aufgabe</button></div>
        <div data-ex="res" aria-live="polite">${res ? `<div class="ex ${res.ok ? 'ok' : 'bad'}"><b>${res.ok ? 'Richtig. ' : ''}</b>${esc(res.text)}${!res.ok && res.why ? `<details><summary>Warum?</summary>${esc(res.why)}</details>` : ''}</div>` : ''}${ST.show ? `<div class="ex"><b>Rechenweg</b><ol>${(ex.steps || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol><p class="hint2">Ergebnis: ${esc(fm(ex.answer.value, 4) + (un ? ' ' + un : ''))}</p></div>` : ''}</div><p class="hint2">${esc(textOf('uebungswert'))}</p>`;
    } else body = `<div class="btns"><button class="btn pri" data-act="newex">Neue Aufgabe</button></div>`;
    return `<details class="card" data-card="ex" open><summary>🎯 Übungsgenerator: Neue Aufgabe</summary><div class="cb"><div class="nc-row"><div class="nc-g">${sel}</div>${body}</div></div></details>`;
  }
  function renderAll() {
    const C = CORE();
    const top = `<div class="card pl"><h4>Rechnen</h4><p class="big">Rechner für das Netzteil-Lab</p><p class="hint2" style="margin:0">Alle Rechner benutzen denselben Kern wie die Prüfstände und die Aufgaben: gleiche Formeln, Zahlen mit Komma, Rechenweg zum Nachvollziehen. Die Werte in den Feldern sind Übungswerte; einen Einheitenzusatz wie 470 µF oder 15 kHz darfst du mittippen. ${esc(C ? textOf('simOnly') : '')}</p></div>`;
    if (!C) return CSS + top + `<div class="card pl"><p class="nc-bad">${esc(NOCORE)}</p></div>`;
    return CSS + top + CARDS.map((c, i) => cardHtml(c, i === 0)).join('') + exHtml();
  }
  function newEx(newSeed) {
    const kinds = exKinds(); if (!kinds.length) { ST.ex = null; return; }
    if (!ST.kind || kinds.indexOf(ST.kind) < 0) ST.kind = kinds[0];
    if (!ST.seed) ST.seed = 1 + Math.floor(Date.now() / 1000) % 100000; else if (newSeed) ST.seed += 1;
    ST.ex = exNew(ST.kind, ST.seed); ST.ans = ''; ST.res = null; ST.show = false;
  }
  function stat(n) { try { if (A && typeof A.stat === 'function') A.stat('ntscalc', n == null ? 1 : n); } catch (e) {} }
  function redrawEx(host) { const card = host.querySelector('[data-card="ex"]'); if (card) card.outerHTML = exHtml(); else host.innerHTML = renderAll(); }
  function onInput(host, e) {
    const t = e && e.target; if (!t || !t.dataset) return;
    if (t.dataset.f) {
      ST.vals[t.dataset.f] = t.value; const rowId = t.dataset.f.split('.')[0], el = host.querySelector('[data-res="' + rowId + '"]');
      const r = calc(rowId, rowVals(rowId));
      if (el) el.innerHTML = resHtml(r);
      if (e.type === 'change' && r && r.ok) stat();
    } else if (t.dataset.ans) ST.ans = t.value;
    else if (t.dataset.actSel === 'kind' && e.type === 'change') { ST.kind = t.value; newEx(true); redrawEx(host); }
  }
  function onClick(host, e) {
    const b = e && e.target && e.target.closest ? e.target.closest('[data-act]') : null; if (!b) return; const a = b.dataset.act;
    if (a === 'newex') { newEx(true); redrawEx(host); }
    else if (a === 'check') { if (!ST.ex || ST.ex.ok === false) return; ST.res = exCheck(ST.ex, ST.ans); stat(); redrawEx(host); }
    else if (a === 'steps') { ST.show = !ST.show; redrawEx(host); }
  }
  function render(host, api) {
    A = api || A; ST.ex = null; const kinds = exKinds(); if (kinds.length) { if (!ST.kind) ST.kind = kinds[0]; newEx(false); }
    host.innerHTML = renderAll();
    if (!host._ntsCalc) { host._ntsCalc = true; host.addEventListener('input', e => onInput(host, e)); host.addEventListener('change', e => onInput(host, e)); host.addEventListener('click', e => onClick(host, e)); }
  }

  const API = { render, fn: { cardList, rowById, defaultsOf, calc, formulaList, formulaById, readNum, exKinds, exLabel, exNew, exCheck }, _st: ST };
  root.NTS_UI_EXT = root.NTS_UI_EXT || {}; root.NTS_UI_EXT.calc = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
